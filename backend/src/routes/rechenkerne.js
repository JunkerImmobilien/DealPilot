'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   routes/rechenkerne.js — v2071
   DIE RECHENKERNE ALS SCHNITTSTELLE
   ═══════════════════════════════════════════════════════════════════════

   Marcel, 10.10.2026:

     „Wir haben ja den Rechenkern für Restnutzungsdauergutachten und auch
      Verkehrswertgutachten, dass wir dort Sachen reingeben können und
      Sachen wieder zurückbekommen, dass wir dafür auch zwei
      Schnittstellen machen. … Jetzt will ich erst mal nur die
      Schnittstelle, dass ich da in meinem anderen Programm einfach Daten
      auch in den Rechenkern schicken kann auf diesem Server."

   ── WAS HIER GERECHNET WIRD, UND WAS NICHT ───────────────────────────

   **Nichts.** Diese Datei rechnet keine einzige Zahl selbst. Sie reicht
   an `services/rechenkerne.js` weiter, und das lädt die **wörtlich
   gespiegelten** Kerne aus `generated/rechenkerne/`.

     > Eine zweite Rechnung wäre genau der Fehler vom 07.10.2026: eine
     > Änderung an `score-tiers.js` blieb ungespiegelt, der Telegram-Bot
     > urteilte stundenlang anders als die App — und zwar lautlos.
     > Seitdem gilt: ein Kern, eine Quelle.

   ── ZWEI WEGE, ZWEI HERKÜNFTE ────────────────────────────────────────

   | Pfad | rechnet wo | Quelle |
   |---|---|---|
   | `POST /rechenkerne/rnd` | **hier im Backend** | `rnd-calc.js`, gespiegelt |
   | `POST /rechenkerne/verkehrswert` | **im Marktbericht-Dienst** | `CrossCheckService` |

   Die Restnutzungsdauer ist ein reiner Rechenkern ohne Datenbank — sie
   läuft im Image. Der Verkehrswert braucht das Register der
   Gutachterausschüsse (Liegenschaftszins, Sachwertfaktor, NHK) und läuft
   deshalb dort, wo dieses Register liegt.

   ── DIE SPÄTERE BEPREISUNG IST VORBEREITET, NICHT GEBAUT ─────────────

   Marcel: „dass wir später aufschlüsseln können, dass ich das im
   Admin-Portal vielleicht später freigeben kann den Kunden gegen
   zusätzliche Gebühren … Das brauchen wir jetzt nicht umsetzen."

   Vorbereitet heißt hier konkret:

   1. **Eigener Namensraum** `/rechenkerne/*` — eine spätere Regel kann
      genau diesen Pfad greifen, ohne andere Endpunkte zu treffen.
   2. **Jeder Aufruf meldet sich** über `rechenkerneLog()` mit Nutzer,
      Kern und Dauer. Wer später abrechnen will, hat die Zählung schon.
   3. **Eine Stelle für die Freigabe**: `_darfRechnen()`. Sie lässt heute
      jeden Pro-Nutzer durch und ist der einzige Ort, an dem später ein
      Plan-Merkmal oder ein Admin-Schalter abgefragt werden muss.

   > Eine Abrechnung, die man später an zwölf Stellen einbauen muss,
   > wird nicht eingebaut. Deshalb steht die Tür schon da — sie ist nur
   > offen.
   ═══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const kerne = require('../services/rechenkerne');

const router = express.Router();
router.use(authenticate);

const MB_BASE = (process.env.MB_BACKEND_URL
  || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

/* ── v2977 · DIE TÜR HAT JETZT EIN SCHLOSS ───────────────────────────
   Marcel 27.10.2026: die Schnittstelle wird ein eigener Zusatz („später
   für Sachverständige oder Makler ein extra Paket“), nur für Pro und
   Partner. Hier stand bis v2976 ein Platzhalter, der jeden angemeldeten
   Nutzer durchließ. Jetzt fragt die Route EINE Stelle:
   zusatzService.darfRechnen() — Plan, Testphase, Zusatz, Monatskontingent.
   Gemessen vorher: auf Produktion gab es einen einzigen API-Schlüssel, nie
   benutzt — die Sperre schneidet niemanden ab. */
const zusatz = require('../services/zusatzService');

async function _darfRechnen(req, kern) {
  try {
    return await zusatz.darfRechnen(req.user, kern);
  } catch (e) {
    /* Ein bezahlter Zusatz geht im Zweifel ZU, nicht auf. */
    console.error('[rechenkerne] Freigabe nicht pruefbar:', e.message);
    return { ok: false, status: 503, grund: 'freigabe_nicht_pruefbar' };
  }
}

function _abgelehnt(res, darf) {
  const s = darf.status || 403;
  const k = Object.assign({ error: darf.grund }, darf);
  delete k.ok; delete k.status; delete k.grund;
  return res.status(s).json(k);
}

/* ── Die Zählung ─────────────────────────────────────────────────────
   Jeder Aufruf landet in rechenkerne_aufrufe (Kontingent, spätere
   Abrechnung) und weiter im Protokoll. */
function rechenkerneLog(req, kern, msDauer, ok, status) {
  try {
    console.log('[rechenkerne] ' + kern
      + ' user=' + (req.user && req.user.id)
      + ' via=' + (req.apiKey ? 'api-key' : 'session')
      + ' ms=' + msDauer + ' ok=' + (ok ? 1 : 0));
    zusatz.aufrufZaehlen({
      userId: req.user && req.user.id, apiKeyId: req.apiKey && req.apiKey.id,
      kern: kern, ok: ok, status: status || (ok ? 200 : null), ms: msDauer,
      externalRef: req.body && req.body.external_ref
    }).catch(function (e) { console.error('[rechenkerne] Zaehlung fehlgeschlagen:', e.message); });
  } catch (e) { /* eine Zaehlung darf nie den Aufruf kippen */ }
}

/* ═══ 1 · RESTNUTZUNGSDAUER ═════════════════════════════════════════════
   POST /api/v1/rechenkerne/rnd

   Zwei Eingabeformen, damit beide Aufrufer bequem sind:

   (a) ein DealPilot-Datensatz, wie er im Portfolio-Export steht:
       { "objekt": { "objart":"ETW", "baujahr":1962, "mod_dach":"Keine/Nie", … } }
       Er wird über `mapDealPilotObject` übersetzt — dieselbe Abbildung,
       die der Wizard benutzt.

   (b) die Kern-Eingabe direkt:
       { "eingabe": { "baujahr":1962, "gnd":80, "objekt_typ":"ETW",
                      "modPoints":4, "verfahren":"punktraster" } }

   Zusätzlich optional `afa`: dann wird der steuerliche Vergleich
   mitgerechnet (was eine kürzere RND bringt).
   ═══════════════════════════════════════════════════════════════════════ */
router.post('/rnd', async function (req, res) {
  const t0 = Date.now();
  const darf = await _darfRechnen(req, 'rnd');
  if (!darf.ok) return _abgelehnt(res, darf);

  try {
    const body = req.body || {};
    let eingabe = body.eingabe || null;

    if (!eingabe && body.objekt) {
      eingabe = kerne.rndAusObjekt(body.objekt);
      /* Was der Datensatz nicht hergibt, darf der Aufrufer nachreichen -
         aber es überschreibt nie, was schon dasteht. */
      if (body.ergaenzung) {
        Object.keys(body.ergaenzung).forEach(function (k) {
          if (eingabe[k] === undefined || eingabe[k] === null || eingabe[k] === '') {
            eingabe[k] = body.ergaenzung[k];
          }
        });
      }
    }
    if (!eingabe) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Erwartet { objekt: … } (ein DealPilot-Datensatz) oder { eingabe: … } (die Kern-Eingabe).'
      });
    }

    const ergebnis = kerne.rnd(eingabe);

    const antwort = {
      kern: 'restnutzungsdauer',
      version: (kerne.herkunft && kerne.herkunft().version) || undefined,
      eingabe_verwendet: eingabe,
      ergebnis: ergebnis
    };

    /* Der AfA-Vergleich nur auf Wunsch: er braucht Gebäudeanteil und
       Grenzsteuersatz, und ohne die wäre jede Zahl geraten. */
    if (body.afa) {
      const a = body.afa;
      const gebAnteil = Number(a.gebaeudeanteil);
      if (!isFinite(gebAnteil) || gebAnteil <= 0) {
        antwort.afa_vergleich = { fehler: 'gebaeudeanteil fehlt oder ist nicht positiv' };
      } else {
        antwort.afa_vergleich = kerne.rndAfaVergleich({
          gebaeudeanteil: gebAnteil,
          rnd: Number(a.rnd) || (ergebnis && ergebnis.final_rnd),
          grenzsteuersatz: Number(a.grenzsteuersatz) || 0.42,
          standardAfaSatz: Number(a.standardAfaSatz) || 0.02,
          gutachterkosten: Number(a.gutachterkosten) || 1500,
          abzinsung: Number(a.abzinsung) || 0.03
        });
      }
    }

    rechenkerneLog(req, 'rnd', Date.now() - t0, true);
    res.json(antwort);
  } catch (e) {
    rechenkerneLog(req, 'rnd', Date.now() - t0, false, 422);
    /* Der Kern wirft bei unbrauchbaren Eingaben - das ist gewollt und
       die Meldung gehört dem Aufrufer, nicht nur dem Protokoll. */
    res.status(422).json({ error: 'rechenfehler', message: String(e && e.message || e) });
  }
});

/* ═══ 2 · VERKEHRSWERT ══════════════════════════════════════════════════
   POST /api/v1/rechenkerne/verkehrswert

   Geht an den Marktbericht-Dienst, weil dort das Register der
   Gutachterausschüsse liegt: Liegenschaftszins (§ 21 Abs. 2),
   Sachwertfaktor (§ 21 Abs. 3), NHK 2010, Bodenrichtwerte.

   Das Leitprinzip des Registers gilt unverändert weiter und wird hier
   NICHT umgangen:
     · Kein Verfahren rechnet halb — fehlt eine Pflichtangabe, erscheint
       das Verfahren nicht.
     · Kein Treffer heißt kein Wert — nie ein Nachbarkreis, nie ein
       Landesmittel.
     · Jede Zahl trägt ihre Herkunft: Stufe A–E, Modellvermerk, Ausschuss.

   `wert_stufe` 3 ist die Wertermittlung nach ImmoWertV.
   ═══════════════════════════════════════════════════════════════════════ */
router.post('/verkehrswert', async function (req, res) {
  const t0 = Date.now();
  const darf = await _darfRechnen(req, 'verkehrswert');
  if (!darf.ok) return _abgelehnt(res, darf);

  try {
    const body = req.body || {};
    if (!body.object && !body.objekt && !body.dealpilot && !body.address) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Erwartet { objekt: … } (ein DealPilot-Datensatz, englisch '
               + '`object` geht auch) oder { address: "…" }. Optional lat/lon, '
               + 'wert_stufe (Vorgabe 3) und external_ref.'
      });
    }

    /* ══ v2076 · DAS FELD HEISST `object`, NICHT `objekt` ═══════════════
       HIER WURDE `body` durchgereicht, also `{ objekt: … }` - deutsch.
       Der Marktbericht-Dienst liest `object` und fand deshalb keine
       Adresse. Gemessen am 10.10.2026 am Objekt 2026-001:

         422 · "Keine Koordinaten - Adresse nicht geokodierbar und
                keine lat/lon angegeben."

       Der Fehler klang nach fehlenden Koordinaten und war ein
       Feldname. Die Adresse war vollstaendig im Datensatz
       (str "Hermannstrasse", hnr "9", plz "32609", ort "Huellhorst") -
       sie kam nur nie an.

       ABGESCHRIEBEN von den echten Aufrufern, nicht geraten:
       `frontend/js/dealpilot-mb.js:603` schickt
         { wert_stufe, external_ref, object: inputs() }
       und `inputs()` (Z. 170) baut flache Felder, darunter
       `objektart` UND `objart` - der Dienst liest `objektart`, der
       DealPilot-Datensatz fuehrt `objart`. Wer nur durchreicht,
       verliert die Objektart still.                                   */
    const roh = body.object || body.objekt || body.dealpilot || null;
    let objFeld = roh;
    if (roh && typeof roh === 'object') {
      objFeld = Object.assign({}, roh);
      /* Der Dienst liest `objektart`; im Datensatz heisst sie `objart`. */
      if (objFeld.objektart == null && objFeld.objart != null) objFeld.objektart = objFeld.objart;
      if (objFeld.objart == null && objFeld.objektart != null) objFeld.objart = objFeld.objektart;
    }

    /* ══ v2076a · DIE STUFE GEHOERT IN `overrides` ══════════════════════
       Mit `wert_stufe` auf der obersten Ebene kam der Bericht als
       STUFE 1 zurueck, obwohl 3 angefordert war:

         cross_check: { available: false, nicht_im_umfang: true, stufe: 1,
           grund: "Boden-, Ertrags- und Sachwert gehoeren zur
                   Wertermittlung nach ImmoWertV (Stufe 3) und sind in
                   dieser Marktpreisindikation nicht enthalten." }

       Der Dienst liest sie unter `overrides`. Dieselbe Falle ist hier
       schon einmal aufgetreten - `routes/marktbericht.js:376` traegt
       den Vermerk: "v1435: bisher fehlte die Stufe hier ganz -
       abgerechnet wurde Stufe 2, der Bericht hielt sich fuer Stufe 1."

       > Eine Stufe, die am falschen Ort steht, wird nicht abgelehnt.
       > Sie wird durch die Vorgabe ersetzt, und der Bericht sieht
       > vollstaendig aus - nur ohne die drei Verfahren, die man wollte.

       Nutzlast exakt wie `marktbericht.js:368-380`, nicht geraten. */
    const stufe = (function () {
      var s = parseInt(body.wert_stufe, 10);
      return (s >= 1 && s <= 3) ? s : 3;    /* Vorgabe: volle Wertermittlung */
    })();
    const nutzlast = {
      object: objFeld,
      overrides: Object.assign({}, body.overrides || {}, {
        wert_stufe: stufe,
        user_id: req.user.id
      })
    };
    if (body.external_ref) nutzlast.overrides.external_ref = body.external_ref;
    if (body.fast) nutzlast.overrides.fast = body.fast;
    if (body.address && !objFeld) { nutzlast.address = body.address; delete nutzlast.object; }
    /* lat/lon durchreichen, damit ein Aufrufer mit eigenen Koordinaten
       nicht am Geokodierer haengt (Backlog N60.26, Punkt 3). */
    if (body.lat != null && nutzlast.object) nutzlast.object.lat = body.lat;
    if (body.lon != null && nutzlast.object) nutzlast.object.lon = body.lon;

    const ctrl = new AbortController();
    const frist = setTimeout(function () { ctrl.abort(); }, 60000);
    let antwort, text;
    try {
      const r = await fetch(MB_BASE + '/reports/from-dealpilot'
        + '?user_id=' + encodeURIComponent(req.user.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nutzlast),
        signal: ctrl.signal
      });
      text = await r.text();
      try { antwort = JSON.parse(text); } catch (e) { antwort = null; }
      if (r.status >= 400) {
        rechenkerneLog(req, 'verkehrswert', Date.now() - t0, false, r.status);
        return res.status(r.status).json(antwort || { error: 'mb_fehler', roh: String(text).slice(0, 400) });
      }
    } finally { clearTimeout(frist); }

    rechenkerneLog(req, 'verkehrswert', Date.now() - t0, true);
    /* v3177 · Marktbericht Profi gleich mit: { …, "pdf": "profi" } druckt aus DIESEM Bericht das
       Profi-PDF (PDF-Dienst, dieselbe Seite wie der Knopf in der App) und legt es base64 bei.
       Scheitert nur das PDF, bleibt die Wertermittlung gueltig - der Fehler steht unter pdf.fehler. */
    let pdfTeil;
    if (String(body.pdf || '') === 'profi' && antwort && antwort.report_id) {
      try {
        const x = await require('../services/telegramPdfService').erzeugen(req.user.id, 'marktbericht_profi',
          /^[0-9a-f-]{36}$/i.test(String(body.external_ref || '')) ? String(body.external_ref) : null, antwort.report_id);
        pdfTeil = { art: 'marktbericht_profi', dateiname: x.dateiname, bytes: x.pdf.length, base64: x.pdf.toString('base64') };
      } catch (e) {
        pdfTeil = { art: 'marktbericht_profi', fehler: String(e && e.message || e) };
      }
    }
    res.json(Object.assign({
      kern: 'verkehrswert',
      quelle: 'marktbericht-dienst (Register der Gutachterausschuesse)',
      ergebnis: antwort
    }, pdfTeil ? { pdf: pdfTeil } : {}));
  } catch (e) {
    rechenkerneLog(req, 'verkehrswert', Date.now() - t0, false, 502);
    res.status(502).json({ error: 'mb_unreachable', message: String(e && e.message || e) });
  }
});

/* ═══ v3177 · Profi-PDF zu einem vorhandenen Bericht (Stufe 3) ═════════
   GET /rechenkerne/profi-pdf?report_id=553[&objekt_id=<uuid>]  ->  application/pdf
   Rechnet nichts neu und bucht nichts; der Bericht muss dem Nutzer gehoeren
   (die App liest ihn mit dessen Sitzung, /reports/one prueft user_id). */
router.get('/profi-pdf', async function (req, res) {
  const rid = String(req.query.report_id || '');
  const oid = String(req.query.objekt_id || '');
  if (!/^\d{1,12}$/.test(rid)) return res.status(400).json({ error: 'report_id fehlt oder ist keine Zahl' });
  if (oid && !/^[0-9a-f-]{36}$/i.test(oid)) return res.status(400).json({ error: 'objekt_id ist keine UUID' });
  const pdf = require('../services/telegramPdfService');
  if (!pdf.verfuegbar()) return res.status(503).json({ error: 'pdf_dienst_fehlt', message: 'Der PDF-Dienst ist hier nicht eingerichtet.' });
  try {
    const x = await pdf.erzeugen(req.user.id, 'marktbericht_profi', oid || null, Number(rid));
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(x.dateiname || ('Marktbericht-Profi-' + rid + '.pdf')));
    res.send(x.pdf);
  } catch (e) {
    res.status(422).json({ error: 'kein_pdf', message: String(e && e.message || e) });
  }
});

/* v3181 · POST /rechenkerne/dok-pdf  { art: 'bank'|'kurz'|'investment'|'kaufpreisaufteilung'|'finanzamt'|
   'finanzamt_anlagev'|'trackrecord'|'bankexport', objekt_id?, optionen? }  ->  application/pdf
   Die einheitlichen Dokumente als PDF: der PDF-Dienst laedt das GESPEICHERTE Objekt mit der Sitzung des
   Nutzers und ruft DpDokumente.dokument(art, optionen). optionen sind nur Daten (Jahre, Anlage V, Objekt-IDs),
   nie HTML - gerendert wird ausschliesslich, was die App selbst baut. */
const DOK_ARTEN = ['bank', 'kurz', 'investment', 'kaufpreisaufteilung', 'finanzamt', 'finanzamt_anlagev', 'trackrecord', 'bankexport', 'vermoegen'];   /* v3226 · Vermögen & Haushalt */
function _dokOptionen(o) {
  const x = {};
  if (!o || typeof o !== 'object') return x;
  if (o.alle === true) x.alle = true;
  if (Number.isInteger(o.jahr) && o.jahr >= 0 && o.jahr < 60) x.jahr = o.jahr;
  if (Array.isArray(o.ids)) x.ids = o.ids.filter((i) => typeof i === 'string' && i.length <= 64).slice(0, 500);
  return x;
}
router.post('/dok-pdf', async function (req, res) {
  const b = req.body || {};
  const art = String(b.art || '');
  const oid = String(b.objekt_id || '');
  if (DOK_ARTEN.indexOf(art) < 0) return res.status(400).json({ error: 'art unbekannt' });
  if (oid && !/^[0-9a-f-]{36}$/i.test(oid)) return res.status(400).json({ error: 'objekt_id ist keine UUID' });
  const pdf = require('../services/telegramPdfService');
  if (!pdf.verfuegbar()) return res.status(503).json({ error: 'pdf_dienst_fehlt', message: 'Der PDF-Dienst ist hier nicht eingerichtet.' });
  try {
    const x = await pdf.erzeugen(req.user.id, 'dok_' + art, oid || null, null, _dokOptionen(b.optionen));
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(x.dateiname || ('DealPilot-' + art + '.pdf')));
    res.send(x.pdf);
  } catch (e) {
    res.status(422).json({ error: 'kein_pdf', message: String(e && e.message || e) });
  }
});

/* v3183 · POST /rechenkerne/html-pdf  { html, titel, fuss: [links, rechts] }  ->  application/pdf
   Die App baut das einheitliche Dokument selbst (DpDokumente, rund 0,5 s) und laesst es hier nur drucken.
   Der PDF-Dienst druckt ohne Skript und ohne Netz (ausser Schriften der App). */
router.post('/html-pdf', async function (req, res) {
  const b = req.body || {};
  const html = typeof b.html === 'string' ? b.html : '';
  if (!html || html.length > 25000000 || !/^<!doctype html>/i.test(html)) return res.status(400).json({ error: 'html fehlt oder ungueltig' });
  const pdf = require('../services/telegramPdfService');
  if (!pdf.verfuegbar()) return res.status(503).json({ error: 'pdf_dienst_fehlt', message: 'Der PDF-Dienst ist hier nicht eingerichtet.' });
  try {
    const fuss = Array.isArray(b.fuss) ? b.fuss.slice(0, 2).map((x) => String(x || '').slice(0, 300)) : [];
    const x = await pdf.erzeugen(req.user.id, 'html', null, null, { html, titel: String(b.titel || 'Dokument').slice(0, 160), fuss });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(x.dateiname || 'DealPilot-Dokument.pdf'));
    res.send(x.pdf);
  } catch (e) {
    res.status(422).json({ error: 'kein_pdf', message: String(e && e.message || e) });
  }
});

/* ═══ 3 · WAS KANN DIESE SCHNITTSTELLE? ═════════════════════════════════
   Ein Verzeichnis, damit der aufrufende Dienst nicht raten muss. Es
   nennt auch, was NICHT geht - das spart die Suche danach.
   ═══════════════════════════════════════════════════════════════════════ */
router.get('/', function (req, res) {
  res.json({
    kerne: [
      {
        pfad: 'POST /api/v1/rechenkerne/rnd',
        was: 'Restnutzungsdauer nach Anlage 2 ImmoWertV, sechs Verfahren',
        rechnet: 'im Backend (gespiegelter Kern rnd-calc.js)',
        eingabe: '{ objekt: <DealPilot-Datensatz> } oder { eingabe: <Kern-Eingabe> }',
        zusatz: '{ afa: { gebaeudeanteil, grenzsteuersatz, standardAfaSatz } } rechnet den Steuervorteil mit',
        ausgabe: 'final_rnd, final_source und die Einzelverfahren'
      },
      {
        pfad: 'POST /api/v1/rechenkerne/verkehrswert',
        was: 'Wertermittlung nach ImmoWertV: Boden-, Ertrags- und Sachwert',
        rechnet: 'im Marktbericht-Dienst (dort liegt das Register der Gutachterausschuesse)',
        eingabe: '{ objekt: <DealPilot-Datensatz>, wert_stufe: 3 }',
        hinweis: 'Kein Treffer im Register heisst KEIN Wert - nie ein Nachbarkreis, nie ein Landesmittel.'
      }
    ],
    zugang: 'Kopfzeile x-api-key, oder angemeldete Sitzung. 120 Aufrufe je Minute.',
    freigabe: 'Zusatz „Schnittstelle Rechenkerne“ (v2977): Plan Pro oder Partner, ausserhalb '
            + 'der Testphase, Zusatz freigeschaltet. Optional ein Monatskontingent je Kern; '
            + 'gezaehlt werden nur erfolgreiche Aufrufe.',
    stand: 'GET /api/v1/rechenkerne/kontingent',
    doku: '/api-doku.html'
  });
});

/* ═══ 4 · v2977 · MEIN STAND ════════════════════════════════════════════
   Freigabe, Kontingent und Aufrufe im laufenden Monat - damit der Kunde
   (oder sein Programm) nicht erst am 429 merkt, dass es knapp wird. */
router.get('/kontingent', async function (req, res) {
  try {
    const z = await zusatz.holen(req.user.id, zusatz.RECHENKERNE);
    const zaehl = await zusatz.monatsZaehlung(req.user.id);
    res.json({
      freigeschaltet: !!(z && z.aktiv),
      monat: zaehl,
      kontingent: { rnd: z ? z.kontingent_rnd : null, verkehrswert: z ? z.kontingent_vw : null },
      hinweis: 'kontingent null = ohne Grenze; gezaehlt wird n_ok (erfolgreiche Aufrufe)'
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: String(e && e.message || e) });
  }
});

module.exports = router;
