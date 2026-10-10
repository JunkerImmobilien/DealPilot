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

/* ── Die Tür für später ──────────────────────────────────────────────
   Heute: jeder angemeldete Nutzer darf. Wer die Kerne künftig
   kostenpflichtig machen will, prüft HIER das Plan-Merkmal oder den
   Admin-Schalter — und nirgends sonst. */
function _darfRechnen(req) {
  if (!req.user || !req.user.id) return { ok: false, grund: 'nicht angemeldet' };
  /* PLATZHALTER fuer die spaetere Freigabe, bewusst offen:
       const frei = await featureService.hat(req.user.id, 'rechenkerne');
       if (!frei) return { ok:false, grund:'rechenkerne_nicht_freigeschaltet' };
     Der API-Key-Weg prueft den Pro-Plan bereits in middleware/auth.js. */
  return { ok: true };
}

/* ── Die Zählung für später ──────────────────────────────────────────
   Noch keine Abrechnung, aber schon eine Spur: wer, welcher Kern, wie
   lange. Ohne sie müsste man die Nutzung später schätzen. */
function rechenkerneLog(req, kern, msDauer, ok) {
  try {
    console.log('[rechenkerne] ' + kern
      + ' user=' + (req.user && req.user.id)
      + ' via=' + (req.apiKey ? 'api-key' : 'session')
      + ' ms=' + msDauer + ' ok=' + (ok ? 1 : 0));
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
  const darf = _darfRechnen(req);
  if (!darf.ok) return res.status(403).json({ error: darf.grund });

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
    rechenkerneLog(req, 'rnd', Date.now() - t0, false);
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
  const darf = _darfRechnen(req);
  if (!darf.ok) return res.status(403).json({ error: darf.grund });

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
        rechenkerneLog(req, 'verkehrswert', Date.now() - t0, false);
        return res.status(r.status).json(antwort || { error: 'mb_fehler', roh: String(text).slice(0, 400) });
      }
    } finally { clearTimeout(frist); }

    rechenkerneLog(req, 'verkehrswert', Date.now() - t0, true);
    res.json({
      kern: 'verkehrswert',
      quelle: 'marktbericht-dienst (Register der Gutachterausschuesse)',
      ergebnis: antwort
    });
  } catch (e) {
    rechenkerneLog(req, 'verkehrswert', Date.now() - t0, false);
    res.status(502).json({ error: 'mb_unreachable', message: String(e && e.message || e) });
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
    bepreisung: 'Heute im Plan enthalten. Der Namensraum /rechenkerne/* ist eigens '
              + 'dafuer da, spaeter getrennt freigeschaltet und abgerechnet zu werden; '
              + 'jeder Aufruf wird bereits mit Nutzer, Kern und Dauer protokolliert.'
  });
});

module.exports = router;
