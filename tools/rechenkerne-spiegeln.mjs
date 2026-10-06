#!/usr/bin/env node
/* tools/rechenkerne-spiegeln.mjs — v1899
 *
 * Macht die Rechenkerne der App fuer das BACKEND lauffaehig, ohne sie zu
 * duplizieren.
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
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..');
const FE = path.join(WURZEL, 'frontend', 'js');
const ZIEL = path.join(WURZEL, 'backend', 'src', 'generated', 'rechenkerne');

/* Die Reihenfolge ist die Ladereihenfolge: deal-kpis.js ruft window.Dscr. */
const KERNE = [
  { datei: 'dscr-engine.js', global: 'Dscr' },
  { datei: 'deal-kpis.js', global: 'DealKpis' }
];

const nurPruefen = process.argv.includes('--pruefen');

function summe(datei) {
  return crypto.createHash('sha256').update(fs.readFileSync(datei)).digest('hex');
}

/* ── Ein window, das gerade genug kann ───────────────────────────────────
 * GEMESSEN, was die beiden Kerne beim Laden anfassen: `window.Dscr = ...`
 * und `window.DealKpis = ...`, dazu zur Laufzeit `typeof window.Dscr`.
 * Kein document, kein localStorage, kein Timer. */
function fensterStub() {
  const window = { console };
  window.window = window;
  window.self = window;
  window.globalThis = window;
  return window;
}

function ladenUndPruefen(quellen) {
  const ctx = vm.createContext(fensterStub());
  ctx.global = ctx;
  for (const k of KERNE) {
    new vm.Script(quellen[k.datei], { filename: k.datei }).runInContext(ctx);
    if (!ctx[k.global] || typeof ctx[k.global].compute !== 'function') {
      throw new Error(k.datei + ': window.' + k.global + '.compute() ist nicht erreichbar');
    }
  }
  /* Ein Funktionslauf, nicht nur ein Ladetest. Die Zahlen sind von Hand
     nachrechenbar: Miete 12.000, Zins 6.500, Tilgung 3.500. */
  const d = ctx.Dscr.compute({ nkm_j: 12000, ze_j: 0, zins_j: 6500, tilg_j: 3500, bwk_cf: 1800 });
  if (d.kd !== 10000) throw new Error('Dscr.compute: Kapitaldienst ' + d.kd + ', erwartet 10000');
  if (Math.abs(d.brutto - 1.2) > 1e-9) throw new Error('Dscr.compute: brutto ' + d.brutto);
  const k = ctx.DealKpis.compute({ kp: 200000, nkm: 1000, d1: 180000, d1z: 4, d1t: 2 });
  if (Math.abs(k.bmy - 6) > 1e-9) throw new Error('DealKpis.compute: bmy ' + k.bmy);
  if (Math.abs(k.rate_j - 10800) > 1e-9) throw new Error('DealKpis.compute: rate_j ' + k.rate_j);
  return ctx;
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

try {
  ladenUndPruefen(quellen);
} catch (e) {
  console.error('Die Kerne laufen in Node nicht: ' + e.message);
  process.exit(1);
}

const MANIFEST = path.join(ZIEL, '_pruefsummen.json');

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
  if (abweichung) {
    console.error('\n' + abweichung + ' Abweichung(en) — node tools/rechenkerne-spiegeln.mjs');
    process.exit(1);
  }
  console.log('Spiegelung aktuell (' + KERNE.length + ' Kerne).');
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
console.log('Gespiegelt nach ' + path.relative(WURZEL, ZIEL) + ': '
  + KERNE.map((k) => k.datei).join(', '));
