'use strict';
/* services/fuehrungService.js — die Schritt-fuer-Schritt-Fuehrung (v1794)
 *
 * Marcel am 02.10.2026: "dass wir eine vernuenftige Fuehrungslogik
 * entwickeln, dass wir Objekte anlegen koennen, dass wir diese
 * Schritt-fuer-Schritt-Anleitung, dass das ueber den Bot funktionieren
 * kann" — und davor: "du sollst das auch nicht doppelt bauen."
 *
 * ── WAS HIER NICHT STEHT, UND DAS IST DER PUNKT ──────────────────────────
 *
 * Keine Frage. Keine Reihenfolge. Keine Pflichtfeld-Tabelle. Kein Feldname.
 *
 * All das kommt aus `generated/frontend-konstanten.json`, und die wird von
 * `tools/frontend-konstanten.mjs` aus den FRONTEND-DATEIEN erzeugt —
 * `voice-import.js` ETAPPEN/RFRAGEN, `objektart-felder.js` ARTEN,
 * `storage.js` FIELDS, `index.html` fuer Typ und Optionen. Gemessen am
 * 02.10.2026: diese Strukturen enthalten ZUSAMMEN NULL FUNKTIONEN, sind
 * also reine Daten und damit ableitbar statt abschreibbar.
 *
 *   > Eine Kopie von Hand ist eine zweite Quelle, die beim ersten
 *   > Nachpflegen auseinanderlaeuft. Eine Ableitung ist immer falsch ODER
 *   > immer richtig, nie halb.
 *
 * ── WAS HIER DOCH NEU IST, UND WARUM DAS IN ORDNUNG IST ──────────────────
 *
 * Die AUSWAHL — "welcher Block ist noch offen" — steht im Frontend in
 * `_rfFehlt`/`_rfZuschnitt`/`_rfNachArt` und haengt dort am DOM: sie liest
 * Formularfelder, Checkboxen und `#objart`. Ein Bot hat kein Formular,
 * sondern einen Datensatz.
 *
 * Deshalb ist die Auswahl hier NICHT abgeschrieben, sondern auf dieselben
 * Daten neu angewandt: die Regeln (`nurWenn`, `eins`, `vorbelegt`,
 * `nachArt`, `rang`) stehen in den Bloecken selbst. Was hier dazukommt,
 * ist nur die Antwort auf "ist dieses Feld gefuellt?" — und die ist bei
 * einem Datensatz ein Blick ins Objekt statt ein Blick ins Formular.
 *
 * Keine einzige Zahl, keine Frage und keine Zuordnung wird hier wiederholt.
 */
const fs = require('node:fs');
const path = require('node:path');

const DATEI = path.join(__dirname, '..', 'generated', 'frontend-konstanten.json');

let _k = null;
function konstanten() {
  if (_k) return _k;
  if (!fs.existsSync(DATEI)) {
    const e = new Error('frontend-konstanten.json fehlt — tools/frontend-konstanten.mjs laufen lassen');
    e.code = 'KEINE_KONSTANTEN';
    throw e;
  }
  _k = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
  return _k;
}

/* ── Ist ein Feld beantwortet? ────────────────────────────────────────────
 *
 * `Number(null)` ist 0 und besteht `Number.isFinite` — erst auf Abwesenheit
 * pruefen, dann rechnen. Und eine 0 IST eine Antwort (Eigenkapital 0 ist
 * eine Aussage, kein fehlender Wert). */
function gefuellt(daten, id) {
  if (!daten) return false;
  const v = daten[id];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean') return true;
  return true;
}

/* ── Welche Felder gelten fuer diese Objektart? ───────────────────────── */
function passtZurArt(objektarten, art, id) {
  const ALLE = ['zimmer', 'bad_anz', 'etage', 'etagen_ges', 'einheiten', 'mea'];
  if (ALLE.indexOf(id) < 0) return true;              /* nicht typabhaengig */
  const a = objektarten[String(art || '').toUpperCase()];
  if (!a) return true;                                 /* Art unbekannt: nicht aussperren */
  return a.passt.indexOf(id) >= 0;
}

function pflichtFuerArt(objektarten, art, id) {
  const a = objektarten[String(art || '').toUpperCase()];
  return !!(a && a.pflicht && a.pflicht.indexOf(id) >= 0);
}

/* ── Ein Block, zugeschnitten auf die Objektart ───────────────────────── */
function zuschneiden(block, art, objektarten) {
  if (!block.nachArt) return block;
  const ids = block.ids.filter((id) => {
    if (id === 'einheiten') return pflichtFuerArt(objektarten, art, id)
      || passtZurArt(objektarten, art, id);
    return passtZurArt(objektarten, art, id) !== false;
  });
  if (!ids.length) return null;
  return Object.assign({}, block, { ids });
}

/* ── Ist in diesem Block noch etwas offen? ────────────────────────────── */
function offen(block, daten) {
  /* `nurWenn`: der Block gilt nur, wenn ein Schalter an ist (z.B. Erbbau). */
  if (block.nurWenn && !gefuellt(daten, block.nurWenn)) return false;
  if (block.nurWenn && daten[block.nurWenn] === false) return false;

  /* `eins`: eine der Alternativen genuegt. */
  if (block.eins && block.eins.some((id) => gefuellt(daten, id))) {
    const rest = block.ids.filter((id) => block.eins.indexOf(id) < 0);
    return rest.some((id) => !gefuellt(daten, id));
  }
  return block.ids.some((id) => !gefuellt(daten, id));
}

/* ── Die naechsten Fragen ─────────────────────────────────────────────────
 *
 * Nach `rang` aufsteigend — das ist die Reihenfolge, die im Frontend
 * festgelegt wurde und hier unveraendert gilt. */
function luecken(daten, opts) {
  const k = konstanten();
  const art = (daten && daten.objart) || null;
  const maxEt = (opts && opts.bisEtappe) || 6;   /* 7 und 8 sind `extra` */
  const modus = (opts && opts.modus) || 'anlegen';

  const offene = k.daten.fragen
    .map((b, i) => Object.assign({}, b, { _pos: i }))
    .filter((b) => (b.et || 1) <= maxEt)
    .map((b) => zuschneiden(b, art, k.daten.objektarten))
    .filter(Boolean)
    .filter((b) => offen(b, daten));

  /* ── ZWEI SORTIERUNGEN, BEIDE AUS DENSELBEN DATEN ────────────────────
   *
   * GEMESSEN am 02.10.2026: nach `rang` sortiert lautet die erste Frage an
   * ein leeres Objekt "Baujahr und Kaufpreis?" (Rang 1) — die ADRESSE kommt
   * erst an fuenfter Stelle (Rang 5).
   *
   * Das ist im Frontend richtig so: `rang` ist dort das Gewicht fuer die
   * Rueckfragen NACH einem freien Diktat ("welche drei Luecken frage ich
   * nach?"). Wer schon erzaehlt hat, hat die Adresse meist gesagt.
   *
   * Beim ANLEGEN im Chat stimmt es nicht. Dort haengt an der Adresse alles
   * Weitere — Bodenrichtwert, Marktpreisindikation, Lage,
   * Grunderwerbsteuersatz. Marcel hat genau darauf hingewiesen: sie soll
   * sogar rueckbestaetigt werden.
   *
   *   > Dieselben Daten, zwei Fragen: "was fehlt am dringendsten?" und
   *   > "womit faengt man an?". Die Antworten duerfen verschieden sein.
   *
   * `anlegen`    folgt der Reihenfolge, in der die Bloecke im Frontend
   *              stehen — und dort steht die Adresse zuerst.
   * `rueckfrage` folgt `rang`, wie der Sprechlauf. */
  if (modus === 'rueckfrage') {
    return offene.sort((a, b) => (a.rang || 99) - (b.rang || 99));
  }
  return offene.sort((a, b) => (a.et || 1) - (b.et || 1) || a._pos - b._pos);
}

function naechsteFrage(daten, opts) {
  const l = luecken(daten, opts);
  return l.length ? l[0] : null;
}

/* ── Fortschritt, fuer eine ehrliche Ansage ───────────────────────────── */
function fortschritt(daten, opts) {
  const k = konstanten();
  const art = (daten && daten.objart) || null;
  const maxEt = (opts && opts.bisEtappe) || 6;
  const alle = k.daten.fragen
    .filter((b) => (b.et || 1) <= maxEt)
    .map((b) => zuschneiden(b, art, k.daten.objektarten))
    .filter(Boolean);
  const fehlend = alle.filter((b) => offen(b, daten));
  return { bloecke: alle.length, offen: fehlend.length, fertig: alle.length - fehlend.length };
}

/* ── Feldbeschreibung, damit der Bot sagen kann, was er meint ─────────── */
function feld(id) {
  const k = konstanten();
  return k.daten.felder.find((f) => f.id === id) || null;
}

function etappen() { return konstanten().daten.etappen; }
function etappe(nr) { return konstanten().daten.etappen.find((e) => e.nr === nr) || null; }

/* Der Katalog fuer den Co-Piloten — dieselbe Form, die das Frontend
   schickt ({ id, label, kind, options }). */
function katalog() {
  return konstanten().daten.felder.map((f) => {
    const e = { id: f.id, label: f.label || f.id, kind: f.kind };
    if (f.optionen) e.options = f.optionen.map((o) => o.wert);
    return e;
  });
}

function stand() {
  const k = konstanten();
  return { erzeugt_am: k.erzeugt_am, quellen: k.quellen,
    fragen: k.daten.fragen.length, felder: k.daten.felder.length };
}

module.exports = {
  luecken, naechsteFrage, fortschritt, feld, etappen, etappe, katalog, gefuellt, stand
};
