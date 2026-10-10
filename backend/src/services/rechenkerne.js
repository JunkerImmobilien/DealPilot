'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * rechenkerne.js — v1899, erweitert in v1925
 *
 * DIE RECHENKERNE DER APP, IM BACKEND NUTZBAR. Kein zweiter Rechenkern.
 *
 * Seit v1925 sind es FUENF (siehe den Block weiter unten). Der Abschnitt
 * „WARUM" darunter stammt von v1899 und sprach noch von zwei — die
 * Begruendung gilt unveraendert, die Zahl nicht mehr.
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
 * ── v1925 · HIER STAND „ES RECHNET KEINEN SCORE" ──────────────────────────
 *
 * Das war richtig beschrieben und falsch begruendet. Der Satz lautete:
 *
 *   > Es rechnet keinen Score. DealPilot-Score und Investor Deal Score
 *   > entstehen im Browser (`dealscore.js`, `dealscore2.js`) und werden am
 *   > Objekt gespeichert; das Backend liest sie.
 *
 * Marcel am 06.10.2026:
 *
 *   „ich moechte mit meinem Telegram-Bot, dass wir auch, wenn wir den
 *    Quick-Check machen, dass dann natuerlich der Deal-Score berechnet
 *    wird und dann auch die Bewertung der Heuristik mit angegeben wird."
 *
 * Der Grund, den der alte Satz nannte, war „eine zweite Rechnung waere
 * eine zweite Meinung" — und das stimmt. Nur folgt daraus nicht, dass das
 * Backend keinen Score rechnen darf, sondern dass es ihn nicht ANDERS
 * rechnen darf. Genau dafuer ist die Spiegelung da. Sie fuehrt jetzt:
 *
 *     DSCR       ->  Dscr.compute()                  (dscr-engine.js)
 *     KPI        ->  DealKpis.compute()              (deal-kpis.js)
 *     Stufe      ->  ScoreTier.stufe()               (score-tiers.js)
 *     Score      ->  DealScore.computeFromKpis()     (dealscore.js)
 *     Heuristik  ->  QcHeuristik.bewerten()          (qc-heuristik.js)
 *
 * Das sind alle vier Kerne, die CLAUDE.md unter „Rechenkerne — nie
 * duplizieren" fuehrt, bis auf den Sachwertfaktor (der hat einen eigenen
 * Weg ueber `lib/gutachterausschuss.js`). Der Investor Deal Score (DS2)
 * bleibt aussen vor: sein Datenmodell ist ein eigenes (Lage, Zustand,
 * Energieklasse), und er wird am Objekt gespeichert — der Bot liest ihn.
 *
 * ── WAS `dealscore.js` BEIM LADEN ANFASST (gemessen, nicht angenommen) ────
 *
 * `dscr-engine.js`, `deal-kpis.js`, `score-tiers.js` und `qc-heuristik.js`
 * sind reine Module: sie setzen ihr Global und fassen sonst nichts an.
 * `dealscore.js` ist es NICHT — in derselben Datei steht unter dem
 * Rechenkern die UI der Score-Karte, und ihr letzter Block liest beim
 * Laden `document.readyState` und ruft `setTimeout`. Ohne Stub stirbt die
 * Datei mit einer ReferenceError, bevor `DealScore` existiert.
 *
 *   > Die Aufteilung von `dealscore.js` in Kern und UI waere die saubere
 *   > Antwort. Sie ist hier aber nicht die vorsichtige: die Datei haengt
 *   > an 900 Zeilen Anzeigecode, und ein Schnitt daran ist ein eigenes
 *   > Paket. Ein kleiner, BENANNTER Stub ist ehrlicher als ein Umbau, den
 *   > niemand bestellt hat.
 *
 * Der Stub kann genau so viel, wie gemessen gebraucht wird, und keinen
 * Deut mehr — `getElementById` gibt immer `null`, `setTimeout` tut nichts.
 * Damit laeuft der Anzeigecode ins Leere, statt irgendetwas zu tun.
 * `localStorage` fehlt bewusst: `_getActivePreset()` faengt den Zugriff ab
 * und faellt auf `balanced` zurueck — also auf dieselben Gewichte, die
 * jeder Browser ohne gespeicherte Wahl benutzt.
 * ═══════════════════════════════════════════════════════════════════════════ */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR = path.join(__dirname, '..', 'generated', 'rechenkerne');
const MANIFEST = path.join(DIR, '_pruefsummen.json');

/* ── Wer wird gebraucht, und wie heisst er im Fenster ────────────────────
 * Die Reihenfolge steht im Manifest (score-tiers VOR dealscore, dscr VOR
 * deal-kpis); diese Liste sagt nur, was danach erreichbar sein MUSS. Eine
 * Spiegelung, die einen Kern nicht liefert, ist kaputt und sagt es. */
const GEBRAUCHT = [
  ['Dscr', 'compute'],
  ['DealKpis', 'compute'],
  ['ScoreTier', 'stufe'],
  ['DealScore', 'computeFromKpis'],
  ['QcHeuristik', 'bewerten'],
  /* v2071 — der RND-Kern. `DealPilotRND_GND` stellt die
     Gesamtnutzungsdauer-Tabelle und muss VOR `DealPilotRND` stehen. */
  ['DealPilotRND_GND', 'getDefault'],
  ['DealPilotRND', 'calcAll'],
];

/* ── Der Stub, und zwar nur hier ─────────────────────────────────────────
 * `tools/rechenkerne-spiegeln.mjs` prueft ueber DIESES Modul, damit es den
 * Stub nicht ein zweites Mal gibt. Ein Pruefwerkzeug mit eigener
 * Verdrahtung misst sich selbst, nicht die Maschine. */
function fensterStub() {
  const fenster = { console };
  fenster.window = fenster;
  fenster.self = fenster;
  fenster.globalThis = fenster;
  /* Gemessen gebraucht von dealscore.js beim Laden — und keinen Deut mehr. */
  fenster.document = {
    readyState: 'complete',
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    addEventListener: function () {},
    body: null,
  };
  fenster.setTimeout = function () { return 0; };
  fenster.clearTimeout = function () {};
  return fenster;
}

let _kerne = null;
let _fehler = null;

function _laden() {
  if (_kerne || _fehler) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const reihe = Array.isArray(manifest.reihenfolge) ? manifest.reihenfolge : [];
    if (!reihe.length) throw new Error('_pruefsummen.json fuehrt keine reihenfolge');

    const ctx = vm.createContext(fensterStub());
    ctx.global = ctx;

    for (const datei of reihe) {
      const quelle = fs.readFileSync(path.join(DIR, datei), 'utf8');
      new vm.Script(quelle, { filename: 'rechenkerne/' + datei }).runInContext(ctx);
    }
    for (const [name, fn] of GEBRAUCHT) {
      if (!ctx[name] || typeof ctx[name][fn] !== 'function') {
        throw new Error(name + '.' + fn + '() nicht erreichbar');
      }
    }
    _kerne = {
      Dscr: ctx.Dscr, DealKpis: ctx.DealKpis, ScoreTier: ctx.ScoreTier,
      DealScore: ctx.DealScore, QcHeuristik: ctx.QcHeuristik,
      /* v2071 - der RND-Kern. Die Dateien wurden ueber `reihenfolge` schon
         geladen und `GEBRAUCHT` hat sie geprueft; hier fehlten sie nur in
         der Weitergabe. Eine Liste, die an zwei Stellen gefuehrt wird,
         laeuft genau so auseinander. */
      DealPilotRND: ctx.DealPilotRND, DealPilotRND_GND: ctx.DealPilotRND_GND,
      manifest: manifest
    };
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

/* ═══ v2071 · DER RND-KERN ALS DIENST ═══════════════════════════════════
 * `DealPilotRND.calcAll()` der App - derselbe Kern, der im RND-Wizard
 * laeuft. Er rechnet sechs Verfahren (linear, Vogels, Ross, Parabel,
 * Punktraster nach Anlage 2, technisch) und gibt `final_rnd` plus die
 * Einzelergebnisse zurueck.
 *
 *   > Er wird hier NICHT nachgebaut. Eine zweite Rechnung waere genau
 *   > der Fehler vom 07.10.2026: der Bot urteilte anders als die App,
 *   > und niemand sah es.
 */
function rnd(eingabe) {
  return _oder_wirf().DealPilotRND.calcAll(eingabe || {});
}

/** Ein DealPilot-Datensatz wird zur RND-Eingabe. Dieselbe Abbildung,
 *  die der Wizard benutzt - so kommt aus `objekte[].daten` des Exports
 *  direkt eine gueltige Eingabe. */
function rndAusObjekt(daten) {
  return _oder_wirf().DealPilotRND.mapDealPilotObject(daten || {});
}

/** Der AfA-Vergleich: was eine kuerzere Restnutzungsdauer steuerlich
 *  bringt. Erwartet { gebaeudeanteil, rnd, grenzsteuersatz,
 *  standardAfaSatz, gutachterkosten, abzinsung }. */
function rndAfaVergleich(eingabe) {
  return _oder_wirf().DealPilotRND.calcAfaVergleich(eingabe || {});
}

/** DealScore.computeFromKpis() der App — der DealPilot-Score, 0 bis 100.
 *  Erwartet { kp, cf_m, nmy, ltv, dscr, wp_kpi, mstg } und gibt
 *  { score, color, label, breakdown[], interpretation, weights }. */
function score(kennzahlen) {
  return _oder_wirf().DealScore.computeFromKpis(kennzahlen || {});
}

/** ScoreTier.stufe() der App — { wort, versal, farbe } zu einem Score.
 *  Die Kette aus CLAUDE.md: 85 / 70 / 50 / 35. */
function stufe(wert) {
  return _oder_wirf().ScoreTier.stufe(wert);
}

/** QcHeuristik.bewerten() der App — Einschaetzung und Kaufempfehlung des
 *  Quick-Checks. Ohne Betonungsfunktion kommt nackter Text, also das, was
 *  in einen Chat gehoert. */
function heuristik(eingabe) {
  return _oder_wirf().QcHeuristik.bewerten(eingabe || {});
}

/** v1936 · Ein einzelner Teil der Heuristik — `stufensatz`,
 *  `kennzahlenAmpel`, `kategorien`, `zielKaufpreis`.
 *
 *  Marcel am 07.10.2026: „beim Quickcheck geben wir doch immer diese
 *  Heuristik aus … Das muss doch da vollumfaenglich stehen."
 *
 *  Ein eigener Export je Teil waere die vierte, fuenfte, sechste
 *  Durchreichung derselben Sorte — und jede neue Funktion in
 *  `qc-heuristik.js` braeuchte hier wieder eine. Deshalb EIN Zugang mit
 *  Namen, und eine Liste, die sagt, was erlaubt ist: ein freier
 *  Namenszugriff waere eine Tuer in jedes Modulinnere. */
const HEURISTIK_TEILE = ['stufensatz', 'kennzahlenAmpel', 'kategorien', 'zielKaufpreis',
  /* v1939 · Der Angebotsabschlag und die schwaechste Groesse. Die Sperre
     hat beim ersten Lauf gegriffen und `marktwertBereinigt` abgewiesen —
     so soll sie sich verhalten: eine Freigabeliste, die man vergisst zu
     pflegen, faellt beim Pruefer auf und nicht beim Kunden. */
  'marktwertBereinigt', 'schwaechstePunkte', 'abschlagFuer'];
function heuristikTeil(name, ...argumente) {
  if (HEURISTIK_TEILE.indexOf(name) < 0) {
    throw new Error('QcHeuristik.' + name + '() ist nicht freigegeben — '
      + 'erlaubt sind: ' + HEURISTIK_TEILE.join(', '));
  }
  const q = _oder_wirf().QcHeuristik;
  if (typeof q[name] !== 'function') {
    throw new Error('QcHeuristik.' + name + '() fehlt in der Spiegelung — '
      + 'node tools/rechenkerne-spiegeln.mjs');
  }
  return q[name].apply(q, argumente);
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

module.exports = {
  kpis, dscr, score, stufe, heuristik,
  heuristikTeil,               /* v1936 — stufensatz / kennzahlenAmpel / kategorien */
  rnd, rndAusObjekt, rndAfaVergleich,   /* v2071 — Restnutzungsdauer */
  vorhanden, herkunft,
  /* nur fuer tools/rechenkerne-spiegeln.mjs — damit der Stub einmal da ist */
  _fensterStub: fensterStub, _GEBRAUCHT: GEBRAUCHT
};
