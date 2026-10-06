#!/usr/bin/env node
/* tools/rechenkerne-spiegeln.mjs — v1899, erweitert in v1925
 *
 * Macht die Rechenkerne der App fuer das BACKEND lauffaehig, ohne sie zu
 * duplizieren. Seit v1925 sind es FUENF: Dscr, DealKpis, ScoreTier,
 * DealScore und QcHeuristik — also auch der Deal-Score und die Heuristik
 * des Quick-Checks. Wo unten „die beiden Kerne" steht, war v1899 gemeint;
 * die Begruendung gilt unveraendert fuer alle fuenf.
 *
 * ── WARUM ES DIESES WERKZEUG GIBT ────────────────────────────────────────
 *
 * Marcel am 06.10.2026 zum Telegram-Bot:
 *
 *   „den Telegram-Bot, der soll auch nicht seine eigenen so bilden. Also
 *    wenn, dann soll das schon Hand und Fuss haben, was wir da machen."
 *
 * GEMESSEN am selben Tag: `agentWerkzeuge.js objekt_schnellblick` rechnete
 * Bruttomietrendite, Kaufpreisfaktor und Kapitaldienst mit eigenen Formeln.
 * Sie trafen zufaellig dieselben Zahlen wie `DealKpis.compute()` — aber
 * „zufaellig dieselben" ist kein Zustand, den man pflegen kann. CLAUDE.md
 * sagt dazu:
 *
 *   > DSCR  -> window.Dscr.compute()
 *   > KPI   -> DealKpis.compute()
 *   > Rechenkerne — nie duplizieren
 *
 * Das Problem: `frontend/` liegt NICHT im Backend-Image. Der Build-Kontext
 * ist `./backend` (docker-compose.prod.yml), und der Dockerfile kopiert
 * `src`, `templates`, `migrations`, `seed-data` und `scripts` — kein
 * Frontend. Ein `require('../../frontend/js/deal-kpis.js')` laeuft lokal
 * und stirbt im Container.
 *
 * ── WIE ES ARBEITET ──────────────────────────────────────────────────────
 *
 * Derselbe Weg, den `tools/frontend-konstanten.mjs` seit v1794 fuer die
 * DATEN geht — hier fuer den CODE:
 *
 *   1. Die beiden Kerne werden WOERTLICH nach
 *      `backend/src/generated/rechenkerne/` gespiegelt. Kein Umschreiben,
 *      keine Portierung, kein zweiter Dialekt: es ist Byte fuer Byte
 *      dieselbe Datei. `COPY src ./src` nimmt sie damit ins Image mit.
 *   2. Daneben entsteht `_pruefsummen.json` mit einer SHA-256 je Quelle.
 *      `--pruefen` vergleicht sie gegen das Frontend und gibt RC=1 zurueck,
 *      wenn jemand einen Kern geaendert hat, ohne zu spiegeln.
 *
 *   > Eine Kopie von Hand ist eine zweite Quelle, die beim ersten
 *   > Nachpflegen auseinanderlaeuft. Eine gespiegelte Datei mit Pruefsumme
 *   > ist eine ABLEITUNG: sie ist entweder aktuell oder sie meldet sich.
 *
 * Geladen wird die Spiegelung von `backend/src/services/rechenkerne.js` —
 * in einem vm-Kontext mit einem `window`, weil die Kerne Browser-Module
 * sind (`window.Dscr = (function(){...})()`). Beide fassen kein DOM an;
 * nachgemessen, nicht angenommen.
 *
 * Aufruf:  node tools/rechenkerne-spiegeln.mjs [--pruefen]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..');
const FE = path.join(WURZEL, 'frontend', 'js');
const ZIEL = path.join(WURZEL, 'backend', 'src', 'generated', 'rechenkerne');
const LADER = path.join(WURZEL, 'backend', 'src', 'services', 'rechenkerne.js');

/* ── Die Ladereihenfolge, und warum sie so ist ───────────────────────────
 *   dscr-engine   zuerst — deal-kpis.js ruft `window.Dscr`
 *   score-tiers   vor dealscore — computeFromKpis() liest `window.ScoreTier`
 *   qc-heuristik  zuletzt, sie haengt an nichts
 *
 * v1925: dazugekommen sind score-tiers.js, dealscore.js und
 * qc-heuristik.js. `dealscore.js` ist dabei der Sonderfall — sie fuehrt
 * unter dem Rechenkern noch 600 Zeilen Anzeigecode, und deren letzter
 * Block liest beim Laden `document.readyState`. Der Stub dafuer steht in
 * `backend/src/services/rechenkerne.js` und NUR dort. */
const KERNE = [
  { datei: 'dscr-engine.js', global: 'Dscr' },
  { datei: 'deal-kpis.js', global: 'DealKpis' },
  { datei: 'score-tiers.js', global: 'ScoreTier' },
  { datei: 'dealscore.js', global: 'DealScore' },
  { datei: 'qc-heuristik.js', global: 'QcHeuristik' }
];

const nurPruefen = process.argv.includes('--pruefen');

function summe(datei) {
  return crypto.createHash('sha256').update(fs.readFileSync(datei)).digest('hex');
}

/* ── Der Funktionslauf geht durch das ECHTE Lademodul ────────────────────
 *
 * Hier stand bis v1922 ein eigener vm-Kontext mit eigenem window-Stub.
 * Das war eine zweite Verdrahtung: der Pruefer konnte gruen werden, waehrend
 * `services/rechenkerne.js` an einem fehlenden `document` scheiterte — er
 * hat sich selbst gemessen, nicht die Maschine.
 *
 * Jetzt wird die Spiegelung geschrieben und DANACH ueber dasselbe Modul
 * geladen, das der Backend-Prozess benutzt. Faellt dabei etwas aus, bricht
 * das Werkzeug mit RC=1 ab und sagt es — die Quelle aendern und erneut
 * laufen lassen.
 *
 * Die Sollwerte sind von Hand nachrechenbar. */
function ladenUndPruefen() {
  const require = createRequire(import.meta.url);
  delete require.cache[require.resolve(LADER)];
  const rk = require(LADER);

  if (!rk.vorhanden()) {
    throw new Error(rk.herkunft().fehler || 'rechenkerne.js meldet die Kerne als nicht vorhanden');
  }

  /* DSCR: Miete 12.000, Zins 6.500, Tilgung 3.500 -> Kapitaldienst 10.000,
     brutto 12.000/10.000 = 1,2. */
  const d = rk.dscr({ nkm_j: 12000, ze_j: 0, zins_j: 6500, tilg_j: 3500, bwk_cf: 1800 });
  if (d.kd !== 10000) throw new Error('Dscr.compute: Kapitaldienst ' + d.kd + ', erwartet 10000');
  if (Math.abs(d.brutto - 1.2) > 1e-9) throw new Error('Dscr.compute: brutto ' + d.brutto);

  /* KPI: 200.000 Kaufpreis, 1.000 Miete -> bmy 6 %; 180.000 zu 4+2 % -> 10.800. */
  const k = rk.kpis({ kp: 200000, nkm: 1000, d1: 180000, d1z: 4, d1t: 2 });
  if (Math.abs(k.bmy - 6) > 1e-9) throw new Error('DealKpis.compute: bmy ' + k.bmy);
  if (Math.abs(k.rate_j - 10800) > 1e-9) throw new Error('DealKpis.compute: rate_j ' + k.rate_j);

  /* STUFE: die Kette aus CLAUDE.md, an jeder Schwelle einmal angefasst. */
  [[85, 'Sehr gut'], [84.9, 'Gut'], [70, 'Gut'], [69.9, 'Solide'], [50, 'Solide'],
   [49.9, 'Schwach'], [35, 'Schwach'], [34.9, 'Kritisch'], [0, 'Kritisch']]
    .forEach(([s, wort]) => {
      const g = rk.stufe(s);
      if (g.wort !== wort) throw new Error('ScoreTier.stufe(' + s + '): ' + g.wort + ', erwartet ' + wort);
    });

  /* SCORE: von Hand nachgerechnet mit den Default-Gewichten (balanced,
     30/25/15/15/15) — das ist auch die Lage ohne localStorage.
       cashflow   50 + 200/4            = 100
       rendite    (5 - 2) * 33,33       = 99,99
       ltv        (110 - 80) * 2,5      = 75
       risiko     DSCR 1,5              = 100
       potenzial  30 + min(60, 10 * 3)  = 60   (mstg 1,5 gibt keinen Zuschlag)
       Summe      30 + 24,9975 + 11,25 + 15 + 9 = 90,2475 -> 90 */
  const s = rk.score({ kp: 200000, cf_m: 200, nmy: 5, ltv: 80, dscr: 1.5, wp_kpi: 20000, mstg: 1.5 });
  if (s.score !== 90) throw new Error('DealScore.computeFromKpis: score ' + s.score + ', erwartet 90');
  if (s.label !== 'Sehr gut') throw new Error('DealScore.computeFromKpis: label ' + s.label);
  if (!Array.isArray(s.breakdown) || s.breakdown.length !== 5) {
    throw new Error('DealScore.computeFromKpis: breakdown hat ' + (s.breakdown || []).length + ' Teile, erwartet 5');
  }

  /* HEURISTIK: derselbe Deal. Score 90 liegt ueber 75 -> KAUFEN, und die
     Einschaetzung meldet bei diesen Zahlen nichts Auffaelliges. */
  const h = rk.heuristik({ score: 90, kp: 200000, nkm: 1000, bmr: 6, nmr: 5,
    cfMon: 200, dscr: 1.5, ltv: 80, ekr: 5, bewirtPctNkm: 20 });
  if (!h.empfehlung || h.empfehlung.verdict !== 'KAUFEN') {
    throw new Error('QcHeuristik: verdict ' + (h.empfehlung && h.empfehlung.verdict) + ', erwartet KAUFEN');
  }
  if (h.empfehlung.text.indexOf('<strong>') >= 0) {
    throw new Error('QcHeuristik: der Text traegt ohne Betonungsfunktion HTML');
  }
  if (!Array.isArray(h.einschaetzung) || !h.einschaetzung.length) {
    throw new Error('QcHeuristik: keine Einschaetzung');
  }

  /* Und die Gegenprobe, dass die Heuristik ueberhaupt umschaltet. */
  const h2 = rk.heuristik({ score: 30, kp: 200000, nkm: 500, bmr: 3, nmr: 1.5,
    cfMon: -400, dscr: 0.8, ltv: 100, ekr: 0, bewirtPctNkm: 40 });
  if (!h2.empfehlung || h2.empfehlung.verdict !== 'PASS') {
    throw new Error('QcHeuristik: verdict ' + (h2.empfehlung && h2.empfehlung.verdict) + ', erwartet PASS');
  }
}

const quellen = {};
const summen = {};
for (const k of KERNE) {
  const p = path.join(FE, k.datei);
  if (!fs.existsSync(p)) {
    console.error('Quelle fehlt: ' + path.relative(WURZEL, p));
    process.exit(1);
  }
  quellen[k.datei] = fs.readFileSync(p, 'utf8');
  summen[k.datei] = summe(p);
}

const MANIFEST = path.join(ZIEL, '_pruefsummen.json');

/* ── v1925 · DIE PRUEFUNG LIEF VORHER AUF DEM FRONTEND, NICHT AUF DEM BILD
 *
 * Hier stand `ladenUndPruefen(quellen)` VOR dem Schreiben — gepruefft
 * wurden also die Frontend-Dateien im Speicher, nie die Datei, die
 * nachher im Image liegt. Solange woertlich gespiegelt wird, ist das
 * dasselbe; sobald beim Schreiben etwas schiefgeht (Kodierung, halber
 * Lauf), ist es das nicht mehr.
 *
 *   > Ein Pruefer, der eine andere Datei liest als die Maschine, misst
 *   > sich selbst.
 *
 * Jetzt wird erst geschrieben, dann ueber `services/rechenkerne.js`
 * geladen und gerechnet. */
function pruefenOderAbbrechen() {
  try {
    ladenUndPruefen();
  } catch (e) {
    console.error('Die Kerne laufen im Backend nicht: ' + e.message);
    process.exit(1);
  }
}

if (nurPruefen) {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Es gibt noch keine Spiegelung — einmal ohne --pruefen laufen lassen.');
    process.exit(1);
  }
  const alt = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  let abweichung = 0;
  for (const k of KERNE) {
    const a = (alt.quellen || {})[k.datei];
    if (a !== summen[k.datei]) {
      console.error('ABWEICHUNG ' + k.datei + ': Frontend ' + summen[k.datei].slice(0, 16)
        + ', Spiegel ' + String(a).slice(0, 16));
      abweichung++;
    }
    const sp = path.join(ZIEL, k.datei);
    if (!fs.existsSync(sp) || summe(sp) !== summen[k.datei]) {
      console.error('ABWEICHUNG ' + k.datei + ': die gespiegelte Datei passt nicht zur Quelle');
      abweichung++;
    }
  }
  /* Eine Datei im Manifest, die gar kein Kern mehr ist, waere eine Leiche
     im Image — und eine, die FEHLT, ist der eigentliche Fall: wer einen
     Kern dazunimmt und nicht spiegelt, soll es hier erfahren. */
  const reihe = Array.isArray(alt.reihenfolge) ? alt.reihenfolge : [];
  const soll = KERNE.map((k) => k.datei).join(',');
  if (reihe.join(',') !== soll) {
    console.error('ABWEICHUNG Reihenfolge: Spiegel [' + reihe.join(', ') + '], erwartet ['
      + KERNE.map((k) => k.datei).join(', ') + ']');
    abweichung++;
  }
  if (abweichung) {
    console.error('\n' + abweichung + ' Abweichung(en) — node tools/rechenkerne-spiegeln.mjs');
    process.exit(1);
  }
  pruefenOderAbbrechen();
  console.log('Spiegelung aktuell (' + KERNE.length + ' Kerne): '
    + KERNE.map((k) => k.global).join(', '));
  process.exit(0);
}

fs.mkdirSync(ZIEL, { recursive: true });
for (const k of KERNE) fs.writeFileSync(path.join(ZIEL, k.datei), quellen[k.datei], 'utf8');
fs.writeFileSync(MANIFEST, JSON.stringify({
  erzeugt_am: new Date().toISOString(),
  hinweis: 'Woertliche Spiegelung von frontend/js/ — NICHT hier bearbeiten. '
         + 'Quelle aendern, dann: node tools/rechenkerne-spiegeln.mjs',
  reihenfolge: KERNE.map((k) => k.datei),
  quellen: summen
}, null, 1) + '\n', 'utf8');
pruefenOderAbbrechen();
console.log('Gespiegelt nach ' + path.relative(WURZEL, ZIEL) + ': '
  + KERNE.map((k) => k.datei).join(', '));
console.log('Durch services/rechenkerne.js geladen und nachgerechnet: '
  + KERNE.map((k) => k.global).join(', '));
