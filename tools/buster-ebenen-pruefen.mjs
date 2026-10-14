#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * buster-ebenen-pruefen.mjs — v2148c
 *
 * STEHT EIN CACHE-BUSTER EINE EBENE ZU TIEF?
 *
 * DealPilot hat drei eigene Dokumente, die dieselben Kerne laden wie
 * die Haupt-App — jedes mit SEINEM EIGENEN Buster:
 *
 *   frontend/index.html            die Haupt-App
 *   frontend/quickcheck-app.html   Quick-Check (iframe)
 *   frontend/marktbericht-app/...  Marktbericht (iframe)
 *
 * Wird ein Kern geaendert und nur der Buster in `index.html` hochgezogen,
 * dann holt die Haupt-App die neue Datei — und das iframe laedt
 * weiterhin `js/qc-heuristik.js?v=v2146`. Gleiche URL, alter Inhalt aus
 * dem Cache. Der Umbau ist ausgerollt, gemessen, committet und kommt
 * beim Nutzer trotzdem nicht an.
 *
 * GEMESSEN am 12.10.2026: genau das war bei v2148 der Fall. Die
 * Haupt-App stand auf v2148, `quickcheck-app.html` auf v2146.
 *
 *   > Ein Buster beweist nichts, wenn er nur auf EINER Ebene steht.
 *
 * Dieser Pruefer vergleicht je Datei die Buster aller Dokumente, die
 * sie laden. Verschiedene Nummern sind nicht automatisch falsch — ein
 * Dokument kann absichtlich auf einem alten Stand stehen. Aber sie
 * MUESSEN auffallen, und zwar bevor ausgerollt wird.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DOKUMENTE = [
  'frontend/index.html',
  'frontend/quickcheck-app.html',
  'frontend/marktbericht-app/index.html',
  'frontend/messkabine.html',
  'frontend/landing/index.html',
  'frontend/messe-studio.html'   /* v2235 · Messe-Studio laedt whitelabel-override */
].filter(function (p) { return fs.existsSync(path.join(process.cwd(), p)); });

/* Je Dokument: welche js-Datei mit welchem Buster? */
const stand = {};      /* datei -> { dokument -> buster } */
DOKUMENTE.forEach(function (d) {
  const t = fs.readFileSync(path.join(process.cwd(), d), 'latin1');
  const re = /(?:js|\.\.\/js)\/([a-zA-Z0-9_-]+\.js)\?v=([A-Za-z0-9._-]+)/g;
  let m;
  while ((m = re.exec(t))) {
    if (!stand[m[1]]) stand[m[1]] = {};
    stand[m[1]][d] = m[2];
  }
});

console.log('=== Dokumente mit eigenen Bustern ===');
DOKUMENTE.forEach(function (d) { console.log('  ' + d); });
console.log('');

const dateien = Object.keys(stand).sort();
const mehrfach = dateien.filter(function (f) { return Object.keys(stand[f]).length > 1; });

console.log('=== Von mehr als einem Dokument geladen: ' + mehrfach.length + ' Datei(en) ===');
console.log('');

let rot = 0;
mehrfach.forEach(function (f) {
  const wo = stand[f];
  const werte = [...new Set(Object.values(wo))];
  const gleich = werte.length === 1;
  if (!gleich) rot++;
  console.log('  ' + (gleich ? 'ok  ' : 'ROT ') + f);
  Object.keys(wo).forEach(function (d) {
    console.log('        ' + String(wo[d]).padEnd(12) + d);
  });
  if (!gleich) {
    console.log('        ^ VERSCHIEDEN. Entweder ist das Absicht und gehoert');
    console.log('          begruendet, oder das Dokument mit der kleineren');
    console.log('          Nummer laedt beim Nutzer die ALTE Datei aus dem Cache.');
  }
  console.log('');
});

/* ══ IST DER BUSTER AELTER ALS DIE DATEI? ════════════════════════════
 *
 * Das ist die eigentliche Frage. Ein Unterschied zwischen zwei Ebenen
 * ist nur Unordnung — gefaehrlich wird er, wenn die DATEI sich geaendert
 * hat, seit der Buster gesetzt wurde. Dann liegt beim Nutzer unter
 * derselben URL ein alter Inhalt, und nichts widerspricht.
 *
 * GEMESSEN am 12.10.2026, und es war teuer:
 *
 *   deal-kpis.js         geaendert 06.10.2026 (v1898, vier gemessene
 *                        Fehler in der Steuerrechnung)
 *   Buster im iframe     969n, gesetzt am 18.07.2026
 *
 * Jeder, der den Quick-Check seit Juli einmal geoeffnet hatte, rechnete
 * dort mit der Kennzahlen-Engine VON VOR diesen Korrekturen.
 *
 * Gefragt wird git, nicht die Dateizeit: `git log -1` fuer die Datei,
 * `git log -S` fuer die Zeile, die den Buster setzt. Die Dateizeit auf
 * Platte sagt nur, wann jemand sie zuletzt angefasst hat. */
console.log('=== Ist ein Buster aelter als die Datei, die er bustert? ===');
console.log('');
function gitDatum(args) {
  try {
    const r = execFileSync('git', args, { encoding: 'utf8', maxBuffer: 4 << 20 }).trim();
    return r ? r.split('\n')[0].slice(0, 10) : null;
  } catch (e) { return null; }
}
/* NUR die mehrfach geladenen: `git log -S` ueber alle 193 Dateien x 5
   Dokumente braucht Minuten und misst nichts, was hier gefragt ist. */
let veraltet = 0;
mehrfach.forEach(function (f) {
  const quelle = 'frontend/js/' + f;
  if (!fs.existsSync(path.join(process.cwd(), quelle))) return;
  const dateiDatum = gitDatum(['log', '-1', '--format=%ad', '--date=short', '--', quelle]);
  if (!dateiDatum) return;
  Object.keys(stand[f]).forEach(function (dok) {
    const b = stand[f][dok];
    /* Wann kam DIESE Buster-Zeichenkette in DIESES Dokument? `-S` findet
       den Commit, der sie eingefuehrt hat; der letzte ist der geltende. */
    const treffer = (function () {
      try {
        const r = execFileSync('git', ['log', '-S', f + '?v=' + b, '--format=%ad',
          '--date=short', '--', dok], { encoding: 'utf8', maxBuffer: 4 << 20 }).trim();
        const z = r ? r.split('\n') : [];
        return z.length ? z[z.length - 1].slice(0, 10) : null;   /* der EINFUEHRENDE Commit */
      } catch (e) { return null; }
    })();
    if (!treffer) return;                       /* noch nicht committet -> frisch */
    if (treffer < dateiDatum) {
      veraltet++;
      console.log('  ROT ' + f);
      console.log('        Datei geaendert : ' + dateiDatum);
      console.log('        Buster ' + b.padEnd(8) + ' gesetzt am ' + treffer + '  in ' + dok);
      console.log('        -> wer diese URL im Cache hat, laedt die Fassung von ' + treffer);
    }
  });
});
if (!veraltet) console.log('  ok  kein Buster ist aelter als seine Datei');
if (veraltet) rot += veraltet;
console.log('');

/* ── Gegenprobe: findet der Pruefer einen Unterschied ueberhaupt? ──── */
console.log('=== Gegenprobe ===');
const probe = { 'a.js': { 'd1': 'v1', 'd2': 'v1' }, 'b.js': { 'd1': 'v1', 'd2': 'v2' } };
const erkanntGleich  = [...new Set(Object.values(probe['a.js']))].length === 1;
const erkanntAnders  = [...new Set(Object.values(probe['b.js']))].length > 1;
console.log('  ' + (erkanntGleich ? 'ok  ' : 'ROT ') + 'zwei gleiche Buster gelten als sauber');
console.log('  ' + (erkanntAnders ? 'ok  ' : 'ROT ') + 'zwei verschiedene Buster werden erkannt');
if (!erkanntGleich || !erkanntAnders) rot++;

console.log('');
console.log('=== Deckung ===');
console.log('  Dokumente   : ' + DOKUMENTE.length + ' (nur vorhandene)');
console.log('  js-Dateien  : ' + dateien.length + ' mit Buster, davon ' + mehrfach.length + ' mehrfach geladen');
console.log('  Geprueft    : (1) Gleichheit zwischen den Ebenen, (2) ob ein');
console.log('                Buster AELTER ist als die Datei (gegen git gemessen)');
console.log('  NICHT       : ob die Datei beim Nutzer wirklich im Cache liegt.');
console.log('                Das kann nur der Browser sagen — der Befund ist eine');
console.log('                MOEGLICHKEIT, und die reicht fuer einen Rechenkern.');
console.log('');
console.log(rot === 0 ? 'SAUBER — gleiche Buster auf allen Ebenen, keiner aelter als seine Datei.'
                      : 'ROT — ' + rot + ' Befund(e): ' + mehrfach.filter(function (f) {
                          return [...new Set(Object.values(stand[f]))].length > 1; }).length
                        + ' ungleich, ' + veraltet + ' aelter als die Datei.');
process.exit(rot ? 1 : 0);
