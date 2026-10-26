'use strict';
/* services/telegramMarktService.js — Marktpreisindikation fuer den Bot (v1798)
 *
 * ── WARUM DER BOT HIER DIE EIGENE HTTP-API RUFT ─────────────────────────
 *
 * Die Marktbericht-Route (`routes/marktbericht.js`) ist geldfuehrend: sie
 * ermittelt die faellige Stufe, prueft das Plan-Kontingent VOR der
 * Leistung, rechnet den Aufpreis gegen schon bezahlte Stufen auf und bucht
 * danach ab. Das sind fuenf Schranken, tief mit `req`/`res` verwoben.
 *
 * Sie req/res-frei nachzubauen — wie bei `avmDienst` geschehen — waere
 * hier der falsche Weg:
 *
 *   > Bei einer geldfuehrenden Strecke ist jede zweite Fassung eine zweite
 *   > Stelle, an der abgebucht wird. Eine davon ist irgendwann die
 *   > falsche, und auffallen wird es auf einer Rechnung.
 *
 * Deshalb geht der Bot GENAU DEN WEG, DEN AUCH DER BROWSER GEHT: ein
 * HTTP-Aufruf an die eigene API, mit einem kurzlebigen Token fuer genau
 * diesen Nutzer. Alle fuenf Schranken greifen damit unveraendert, und es
 * gibt weiterhin nur eine Stelle, die bucht.
 *
 * ── DIE STUFEN ──────────────────────────────────────────────────────────
 *
 *   1  mpi       Marktpreisindikation            Lage und Preisspanne
 *   2  mpi_plus  Erweiterte Marktpreisindikation + Zustand und Qualitaet
 *   3  wev       Wertermittlung nach ImmoWertV   (der Bot bietet sie nicht an)
 *
 * ACHTUNG, und das ist teuer: `marktbericht.js` faellt OHNE `wert_stufe`
 * auf STUFE 2 zurueck. Wer sie nicht mitschickt, bucht ungewollt die
 * teurere. Hier wird sie deshalb immer gesetzt.
 */
const jwtUtil = require('../utils/jwt');
const config = require('../config');
const aiCreditsService = require('./aiCreditsService');

/* ── v1808 · STUFE 3 FEHLTE, UND DAS FIEL NICHT AUF ──────────────────────
 *
 * Hier standen nur 1 und 2. `_stufe()` liess die 3 durch, `STUFEN[3]` war
 * aber undefined — und jeder Zugriff fiel still auf Stufe 1 zurueck. Wer
 * eine Wertermittlung nach ImmoWertV wollte, bekam den NAMEN der
 * Marktpreisindikation zu sehen.
 *
 *   > Ein Rueckfall auf den Standard sieht aus wie eine Antwort. Er sagt
 *   > nicht "das kenne ich nicht", sondern etwas Falsches in ruhigem Ton.
 *
 * Marcel will sie ausdruecklich: "Gib mir wirklich eine Wertermittlung
 * komplett, dass ich dann alles bekomme."
 */
const STUFEN = {
  1: { art: 'mpi',      name: 'Marktpreisindikation',
       was: 'Lage und Preisspanne aus den Daten des zustaendigen Gutachterausschusses' },
  2: { art: 'mpi_plus', name: 'Erweiterte Marktpreisindikation',
       was: 'zusaetzlich Zustand und Qualitaet — engere Spanne, mit Dossier' },
  3: { art: 'wev',      name: 'Wertermittlung nach ImmoWertV',
       was: 'Boden-, Ertrags- und Sachwert mit Rechenweg' }
};

/* ══ v2960a · WAS DER BERICHT VOM OBJEKT BEKOMMT, UND WAS ER BRAUCHT ═══
 *
 * GEMESSEN am 26.10.2026: `abrufen()` schickte ZWOELF Felder (plz, ort,
 * str, hnr, objektart, objart, wfl, baujahr, kp, zimmer, nkm, gsfl, mea).
 * Der Browser schickt aus demselben Objekt 88 weitere (`dealpilot-mb.js`
 * ZUSATZ): Zustand, Ausstattung, Energieklasse, Einheiten, Bodenrichtwert,
 * Standardstufe, BGF, Modernisierung … Eine erweiterte Marktpreisindikation
 * aus dem Bot kannte also weder Zustand noch Qualitaet — genau das, wofuer
 * Stufe 2 bezahlt wird —, und eine Wertermittlung aus dem Bot haette ohne
 * Bodenrichtwert und Standardstufe gerechnet.
 *
 *   > Derselbe Bericht aus zwei Tueren muss dieselben Angaben bekommen.
 *   > Sonst kostet er gleich viel und sagt verschieden viel.
 *
 * Die Feldliste, die Pflicht je Stufe und die typabhaengigen Felder kommen
 * aus `generated/frontend-konstanten.json` — geerntet aus dealpilot-mb.js,
 * objekt-reiter.js und objektart-felder.js, nicht abgeschrieben. */
let _bew = null, _labels = null, _arten = null;
function _konst() {
  if (_bew) return;
  const k = require('../generated/frontend-konstanten.json').daten;
  _bew = k.bewertung;
  _arten = k.objektarten || {};
  _labels = {};
  (k.felder || []).forEach((f) => { if (f.label) _labels[f.id] = f.label.replace(/\s+DS2\b/g, '').trim(); });
}

function _leer(v) { return v == null || (typeof v === 'string' && v.trim() === ''); }
function _art(d) { return String((d && (d.objart || d.objektart)) || '').toUpperCase(); }
function _wert(d, id) {
  if (id === 'objart') return _leer(d.objart) ? d.objektart : d.objart;
  return d[id];
}

/** Bezeichnung eines Feldes, wie sie im Formular steht. */
function feldName(id) { _konst(); return _labels[id] || id; }

/** Was fehlt fuer diese Stufe? Dieselbe Liste wie im Reiter Objekt
 *  (pflichtFuer), Zelle fuer Zelle. [] heisst: abrufbar. */
function fehlendeAngaben(daten, stufe) {
  _konst();
  const d = daten || {};
  const art = _art(d);
  const tab = _bew.pflicht[art] || _bew.pflicht[''];
  const gar = parseFloat(String(d.garagen == null ? '' : d.garagen).replace(',', '.'));
  const s = (stufe === 3 && gar > 0) ? '3_mit_garage' : String(stufe);
  return (tab[s] || tab['1']).filter((id) => _leer(_wert(d, id)))
    .map((id) => ({ id: id, name: feldName(id) }));
}

/** Das Objekt, wie `dealpilot-mb.js inputs()` es dem Bericht schickt. */
function objektNutzlast(objekt) {
  _konst();
  const d = (objekt && objekt.daten) || {};
  const art = _art(d);
  const a = _arten[art];
  const o = { id: objekt && objekt.objekt_id };
  _bew.grundfelder.forEach((id) => { if (!_leer(d[id])) o[id] = d[id]; });
  if (_leer(o.objart) && !_leer(d.objektart)) o.objart = d.objektart;
  if (_leer(o.objektart) && !_leer(o.objart)) o.objektart = o.objart;
  _bew.zusatz.forEach((id) => {
    const v = d[id];
    /* wie im Browser (v1851): ein Haekchen reist nur mit, wenn es gesetzt ist */
    if (typeof v === 'boolean') { if (v) o[id] = true; return; }
    if (_leer(v)) return;
    /* wie im Browser (v1437): nur, was zur Objektart passt */
    if (a && _bew.objektart_typfelder.indexOf(id) >= 0 && a.passt.indexOf(id) < 0) return;
    o[id] = v;
  });
  /* v2210 im Browser: die Einheiten des MFH reisen schlank mit — dieselben
     Felder, kein Bild, kein Mietername. */
  const ein = d._mfh && Array.isArray(d._mfh.einheiten) ? d._mfh.einheiten : null;
  if (ein && ein.length) {
    o._mfh_einheiten = ein.map((e) => {
      const x = {};
      _bew.mfh_einheit_felder.forEach((f) => { x[f] = (e && e[f] != null && e[f] !== '') ? e[f] : null; });
      x.art = x.art || 'wohnen';
      x.status = x.status || 'vermietet';
      x.leer_abzug = Boolean(e && e.leer_abzug === true);
      return x;
    });
  }
  return o;
}

function basis() {
  return 'http://127.0.0.1:' + config.port + '/api/v1';
}

/* Ein Token nur fuer diesen einen Aufruf. Es traegt dieselbe Nutzlast wie
   das des Browsers — mehr Rechte bekommt der Bot dadurch nicht. */
function token(userId) {
  return jwtUtil.sign({ id: userId, userId: userId });
}

async function ruf(userId, pfad, opts) {
  const o = opts || {};
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), o.timeoutMs || 120000);
  try {
    const r = await fetch(basis() + pfad, {
      method: o.method || 'GET',
      headers: Object.assign({
        'Authorization': 'Bearer ' + token(userId),
        'Content-Type': 'application/json'
      }, o.headers || {}),
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  } finally { clearTimeout(t); }
}

/* ── Was kostet es? Kostet selbst nichts. ────────────────────────────────
 *
 * `/stufenpreis` rechnet schon bezahlte Stufen gegen — wer eine
 * Marktpreisindikation hat und auf die erweiterte geht, zahlt nur die
 * Differenz. Dieselbe Funktion, die auch abbucht (Kommentar v1154 dort:
 * "Was hier angekuendigt wird, KANN damit nicht mehr von der Abbuchung
 * abweichen").
 */
async function voranschlag(userId, objektId, stufe) {
  const s = STUFEN[stufe] ? stufe : 1;
  const r = await ruf(userId, '/marktbericht/stufenpreis?ref=' + encodeURIComponent(objektId || ''),
    { timeoutMs: 20000 });
  if (r.status !== 200) {
    return { moeglich: false, grund: (r.body && r.body.error) || ('HTTP ' + r.status) };
  }
  /* ── v1888b · DER RUECKFALL FIEL IN DIE GESCHENKTE RICHTUNG ───────────
   *
   * Hier stand `|| { anzahl: 0, art: null }`. Fehlt `kosten` in der
   * Antwort — ein alter Stand der Route, ein geaenderter Vertrag, ein
   * Body, der aus einem anderen Grund anders aussieht —, dann hiess das
   * stillschweigend "anzahl 0", und `so_sagen` sagte darauf dem Nutzer:
   * "Diese Tiefe ist fuer dieses Objekt bereits bezahlt."
   *
   * Die Schwesterstelle in `routes/marktbericht.js` (Zeile 286-289) macht
   * es genau andersherum und nennt auch den Grund: "Im Fehlerfall den
   * vollen Preis melden — lieber zu viel angekuendigt als eine
   * Ermaessigung versprochen, die es nicht gibt."
   *
   *   > Zwei Stellen, die denselben Preis ankuendigen, duerfen nicht in
   *   > verschiedene Richtungen zurueckfallen. Die eine warnt dann, waehrend
   *   > die andere verschenkt — und welche der Nutzer zu sehen bekommt,
   *   > entscheidet der Weg, nicht die Lage.
   *
   * Ein fehlendes Feld ist keine Auskunft. Wer nicht weiss, ob etwas
   * bezahlt ist, sagt NICHT "bereits bezahlt". */
  const _k = r.body && r.body.kosten;
  const kosten = (_k && _k[s]) || (_k ? { anzahl: 0, art: null }
                                      : { anzahl: 1, art: STUFEN[s].art });
  let bestand = null;
  try {
    const st = await aiCreditsService.getStatus(userId);
    const a = st && st.arten && st.arten[STUFEN[s].art];
    bestand = a ? a.rest : null;
  } catch (e) { /* ohne Bestandsangabe geht es auch, nur weniger genau */ }

  /* ── v1808b · "kostet" WAR ZWEIDEUTIG ────────────────────────────────
   *
   * GEMESSEN: der Voranschlag gab `kostet: true` zurueck, und das Modell
   * schrieb daraufhin "kostet *nichts*" bzw. "kostet **0 EUR**". Es las
   * `guthaben_abrufe_uebrig: 36` daneben und schloss, es sei im
   * Kontingent enthalten und damit gratis.
   *
   *   > Bei Geld ist eine zweideutige Formulierung kein Schoenheitsfehler.
   *   > Wer "kostet nichts" liest und ja sagt, hat nicht zugestimmt — er
   *   > hat etwas anderes zugestimmt.
   *
   * Deshalb derselbe Weg wie bei den Betraegen: ein FERTIGER SATZ geht
   * mit. Was fertig dasteht, wird abgeschrieben statt ausgelegt. */
  const kostet = kosten.anzahl > 0;
  const satz = kostet
    ? ('Das verbraucht einen Abruf vom Typ "' + STUFEN[s].name + '" aus deinem '
       + 'Kontingent' + (bestand != null ? ' (noch ' + bestand + ' uebrig)' : '') + '.')
    : ('Diese Tiefe ist fuer dieses Objekt bereits bezahlt — es wird nichts '
       + 'weiter verbraucht.');

  return {
    moeglich: true,
    stufe: s,
    art: STUFEN[s].art,
    name: STUFEN[s].name,
    was_drin_ist: STUFEN[s].was,
    schon_bezahlt: r.body.bezahlte_stufe || 0,
    verbraucht_einen_abruf: kostet,
    so_sagen: satz,
    bestand: bestand
  };
}

/* ── Der Abruf. Nur nach ausdruecklicher Bestaetigung. ───────────────── */
async function abrufen(userId, objekt, stufe, opts) {
  const s = STUFEN[stufe] ? stufe : 1;
  const d = (objekt && objekt.daten) || {};
  /* ── v1808 · `fast` NUR bei der kleinen Stufe ────────────────────────
   *
   * Der Schnellmodus rechnet nur Marktwert- und Mietindikation und
   * ueberspringt KI-Bericht und Preishistorie — das steht woertlich im
   * Ergebnis ("KI-Bericht und Preishistorie wurden uebersprungen").
   *
   * Fuer Stufe 1 ist das richtig: dort will jemand schnell eine Spanne.
   * Fuer die erweiterte Indikation und die Wertermittlung ist es falsch —
   * Marcel will dort "alles, was er dazu gefunden hat, auch zur Lage und
   * allem".
   *
   *   > Wer die teurere Stufe bezahlt und die schnelle bekommt, bezahlt
   *   > fuer etwas, das er nicht sieht. */
  const schnell = (opts && opts.schnell != null) ? Boolean(opts.schnell) : (s === 1);
  const r = await ruf(userId, '/marktbericht/reports/from-dealpilot', {
    method: 'POST',
    timeoutMs: schnell ? 120000 : 240000,
    body: {
      fast: schnell,
      external_ref: objekt.objekt_id,
      wert_stufe: s,            /* NIE weglassen — der Default waere 2 */
      /* v2960a · dieselben Felder wie der Browser, nicht zwoelf */
      object: objektNutzlast(objekt)
    }
  });

  if (r.status === 402) {
    const e = new Error((r.body && r.body.message)
      || 'Dein Kontingent für diese Bewertung ist aufgebraucht.');
    e.fachlich = true; e.kontingent = true; e.upgradeTo = r.body && r.body.upgrade_to;
    throw e;
  }
  if (r.status !== 200 && r.status !== 201) {
    const e = new Error((r.body && (r.body.message || r.body.error)) || ('HTTP ' + r.status));
    e.fachlich = Boolean(r.body && (r.body.message || r.body.error));
    throw e;
  }
  return r.body;
}

/* ── v2960b · Die Berichte eines Objekts (kostet nichts) ─────────────────
 * Derselbe Weg wie die Historie im Browser: /marktbericht/objects/history
 * mit ref = Objekt-Id. Der Proxy bindet den Nutzer selbst (v942). */
async function berichte(userId, objektId) {
  const r = await ruf(userId, '/marktbericht/objects/history?ref=' + encodeURIComponent(objektId || ''),
    { timeoutMs: 20000 });
  if (r.status !== 200) return { ok: false, grund: (r.body && (r.body.message || r.body.error)) || ('HTTP ' + r.status) };
  const h = (r.body && r.body.history) || [];
  return { ok: true, berichte: h.filter((x) => x && x.report_id).map((x) => ({
    report_id: x.report_id, erstellt: x.created_at, adresse: x.address || null })) };
}

/* Der Marktbericht-PDF entsteht im Browser (marktbericht-app/app.js
   exportPdf, jsPDF). `?report=ID&autopdf=1` oeffnet den Bericht und
   speichert das PDF — derselbe Weg wie die Deal-Aktion (v949). */
function berichtPdfLink(reportId) {
  const b = String((config.frontend && config.frontend.baseUrl) || '').replace(/\/+$/, '');
  return b + '/marktbericht-app/index.html?report=' + encodeURIComponent(reportId) + '&autopdf=1';
}

module.exports = { voranschlag, abrufen, STUFEN, fehlendeAngaben, objektNutzlast, feldName,
  berichte, berichtPdfLink };
