'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * rechenkerne.js — v1899
 *
 * DIE RECHENKERNE DER APP, IM BACKEND NUTZBAR. Kein zweiter Rechenkern.
 *
 * ── WARUM ──────────────────────────────────────────────────────────────────
 *
 * Marcel am 06.10.2026: „den Telegram-Bot, der soll auch nicht seine eigenen
 * so bilden. Also wenn, dann soll das schon Hand und Fuss haben, was wir da
 * machen."
 *
 * CLAUDE.md fuehrt vier Kerne und einen Satz dazu: „Rechenkerne — nie
 * duplizieren." Davon leben hier zwei:
 *
 *     DSCR  ->  Dscr.compute()        (frontend/js/dscr-engine.js)
 *     KPI   ->  DealKpis.compute()    (frontend/js/deal-kpis.js)
 *
 * Beide sind reine Funktionen ohne DOM-Zugriff — nachgemessen, nicht
 * angenommen: der Ladevorgang setzt `window.Dscr` bzw. `window.DealKpis`
 * und fasst sonst nichts an.
 *
 * ── WARUM NICHT DIREKT AUS frontend/ ──────────────────────────────────────
 *
 * Weil `frontend/` nicht im Backend-Image liegt. Der Build-Kontext ist
 * `./backend`, der Dockerfile kopiert `src`, `templates`, `migrations`,
 * `seed-data`, `scripts` — kein Frontend. Ein Pfad nach `../../frontend`
 * laeuft auf dem Entwicklerrechner und stirbt im Container; genau die
 * Sorte Fehler, die erst in Produktion auffaellt.
 *
 * Deshalb liegen die beiden Dateien WOERTLICH gespiegelt unter
 * `src/generated/rechenkerne/` — erzeugt von
 * `tools/rechenkerne-spiegeln.mjs`, mit einer SHA-256 je Quelle. Wer einen
 * Kern aendert und nicht spiegelt, bekommt von
 * `node tools/rechenkerne-spiegeln.mjs --pruefen` RC=1.
 *
 *   > Die gespiegelten Dateien werden NICHT bearbeitet. Wer dort etwas
 *   > aendert, baut genau das zweite Gehirn, das dieses Modul verhindern
 *   > soll — und die Pruefsumme sagt es beim naechsten Lauf.
 *
 * ── WAS ES NICHT TUT ──────────────────────────────────────────────────────
 *
 * Es rechnet keinen Score. DealPilot-Score und Investor Deal Score
 * entstehen im Browser (`dealscore.js`, `dealscore2.js`) und werden am
 * Objekt gespeichert; das Backend liest sie. Daran aendert dieses Modul
 * nichts — siehe den Block „WARUM DIESES WERKZEUG KEINEN DEAL-SCORE
 * RECHNET" in agentWerkzeuge.js.
 * ═══════════════════════════════════════════════════════════════════════════ */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR = path.join(__dirname, '..', 'generated', 'rechenkerne');
const MANIFEST = path.join(DIR, '_pruefsummen.json');

let _kerne = null;
let _fehler = null;

function _laden() {
  if (_kerne || _fehler) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const reihe = Array.isArray(manifest.reihenfolge) ? manifest.reihenfolge : [];
    if (!reihe.length) throw new Error('_pruefsummen.json fuehrt keine reihenfolge');

    /* Ein window, das gerade genug kann. Die Kerne setzen nur ihr eigenes
       Global und lesen `typeof window.Dscr`. */
    const fenster = { console };
    fenster.window = fenster;
    fenster.self = fenster;
    fenster.globalThis = fenster;
    const ctx = vm.createContext(fenster);
    ctx.global = ctx;

    for (const datei of reihe) {
      const quelle = fs.readFileSync(path.join(DIR, datei), 'utf8');
      new vm.Script(quelle, { filename: 'rechenkerne/' + datei }).runInContext(ctx);
    }
    if (!ctx.Dscr || typeof ctx.Dscr.compute !== 'function') {
      throw new Error('Dscr.compute() nicht erreichbar');
    }
    if (!ctx.DealKpis || typeof ctx.DealKpis.compute !== 'function') {
      throw new Error('DealKpis.compute() nicht erreichbar');
    }
    _kerne = { Dscr: ctx.Dscr, DealKpis: ctx.DealKpis, manifest: manifest };
  } catch (e) {
    /* KEIN stiller Rueckfall auf eigene Formeln. Wer hier scheitert, soll
       es merken — eine zweite Rechnung waere schlimmer als keine. */
    _fehler = new Error('Rechenkerne nicht ladbar (' + e.message
      + ') — node tools/rechenkerne-spiegeln.mjs');
  }
}

/** true, wenn die Kerne bereitstehen. Ruft keine Ausnahme hervor. */
function vorhanden() {
  _laden();
  return !!_kerne;
}

/** Wirft, wenn die Spiegelung fehlt oder kaputt ist. */
function _oder_wirf() {
  _laden();
  if (_fehler) throw _fehler;
  return _kerne;
}

/** DealKpis.compute() der App — dieselbe Datei, dieselben Zahlen. */
function kpis(eingabe) {
  return _oder_wirf().DealKpis.compute(eingabe || {});
}

/** Dscr.compute() der App. */
function dscr(eingabe) {
  return _oder_wirf().Dscr.compute(eingabe || {});
}

/** Welche Quellen gespiegelt sind und wann — fuer Auskunft und Pruefung. */
function herkunft() {
  _laden();
  if (!_kerne) return { ok: false, fehler: _fehler ? _fehler.message : 'unbekannt' };
  return {
    ok: true,
    erzeugt_am: _kerne.manifest.erzeugt_am,
    quellen: Object.keys(_kerne.manifest.quellen || {})
  };
}

module.exports = { kpis, dscr, vorhanden, herkunft };
