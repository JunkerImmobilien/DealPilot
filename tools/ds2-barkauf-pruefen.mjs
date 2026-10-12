#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * ds2-barkauf-pruefen.mjs — v2144
 *
 * AUCH DER INVESTOR DEAL SCORE KENNT DEN BARKAUF
 *
 * Marcels Entscheidung vom 12.10.2026 nach vorgelegten Zahlen: „Nur DSCR
 * und LTV weglassen" — wie beim DealScore in v2141.
 *
 * ── DER BEFUND ──────────────────────────────────────────────────────
 *
 *   finanziert (DSCR 1,18 / LTV 88)   DSCR 76 Pkt, LTV 100   ->  85
 *   BARKAUF    (DSCR 0    / LTV 0)    DSCR  0 Pkt, LTV  85   ->  49
 *   unbekannt  (null      / null)     beide nicht angewandt  ->  60
 *
 *   > Ein schuldenfreies Objekt bekam die Finanzierungsnote eines
 *   > Objekts, das seinen Kapitaldienst nicht deckt. Im DealScore
 *   > SCHOENTE die 50 den Barkauf, hier BESTRAFT ihn die 0.
 *
 * ── WARUM DIESER KERN EINEN EIGENEN PRUEFER BRAUCHT ─────────────────
 *
 * `dealscore2.js` wird NICHT ins Backend-Image gespiegelt (die fuenf
 * Kerne sind dscr-engine, deal-kpis, score-tiers, dealscore,
 * qc-heuristik). Er laeuft nur im Browser, also laedt dieser Pruefer
 * die echte Datei in einen vm-Kontext — kein `require`, keine
 * Nachbildung.
 *
 * ── WAS ER SICHERT ──────────────────────────────────────────────────
 *
 * 1. Beim Barkauf entfallen DSCR und LTV (`applied: false`), mit Grund.
 * 2. Zins, Tilgung und EK-Quote bleiben bewertet — Marcels Entscheidung.
 * 3. Ein FINANZIERTES Objekt aendert sich nicht.
 * 4. Ohne Angabe bleibt alles wie vor v2144.
 * 5. Die LTV-DSCR-Wechselwirkung setzt beim Barkauf aus.
 * 6. Die Rangfolge der Feldnamen ist DIESELBE wie in `dealscore.js`.
 *    Zwei Kerne, die dieselbe Frage verschieden beantworten, waeren
 *    schlimmer als zwei, die sie gar nicht stellen.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = {
  document: { getElementById: () => null },
  localStorage: { getItem: () => null, setItem: () => {} },
  console
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('frontend/js/dealscore2.js', 'utf8'), ctx,
  { filename: 'dealscore2.js' });

const DS2 = ctx.DealScore2;
if (!DS2 || typeof DS2._scoreFinanzierung !== 'function') {
  console.error('DealScore2._scoreFinanzierung nicht erreichbar.');
  process.exit(2);
}
const cfg = DS2.getDefaults();

let rot = 0;
const melde = (ok, txt) => { if (!ok) rot++; console.log('  ' + (ok ? 'ok  ' : 'ROT ') + txt); };
const FIN = { dscr: 1.18, ltv: 88.4, zinsSatz: 4, tilgung: 2, eigenkapitalQuote: 20 };
const BAR = { dscr: 0, ltv: 0, zinsSatz: 4, tilgung: 2, eigenkapitalQuote: 100 };
const lauf = (d) => DS2._scoreFinanzierung(d, cfg);
const teil = (r, k) => r.breakdown.find((x) => x.key === k);

console.log('=== 1 · Beim Barkauf entfallen DSCR und LTV ===');
const bar = lauf(Object.assign({}, BAR, { darlehen: 0 }));
['dscr', 'ltv'].forEach(function (k) {
  const b = teil(bar, k);
  melde(b.points === null && b.applied === false,
    k.padEnd(5) + 'points null, applied false');
  melde(!!b.grund, '      Grund steht dabei: "' + (b.grund || '—') + '"');
});
melde(bar.availableKpis === 3 && bar.totalKpis === 5,
  'drei von fuenf Kennzahlen angewandt (ist: ' + bar.availableKpis + '/' + bar.totalKpis + ')');
console.log('      Kategorie-Score: ' + Math.round(bar.score));

console.log('\n=== 2 · Zins, Tilgung und EK bleiben bewertet (Marcels Entscheidung) ===');
['zins', 'tilgung', 'eigenkapitalbedarf'].forEach(function (k) {
  const b = teil(bar, k);
  melde(b.points !== null && b.applied === true,
    k.padEnd(19) + 'weiter bewertet (' + Math.round(b.points) + ' Pkt)');
});
console.log('      Liesse man Zins+Tilgung auch weg, bliebe allein die EK-Quote —');
console.log('      und deren Skala bestraft 100 % Eigenkapital mit 30 Punkten.');
console.log('      Die Kategorie fiele dann TIEFER als vorher. Deshalb nur zwei.');

console.log('\n=== 3 · DIE PROBE, DIE ZAEHLT: finanziert bleibt gleich ===');
const finOhne = lauf(FIN);
const finMit = lauf(Object.assign({}, FIN, { darlehen: 159120 }));
melde(Math.round(finOhne.score) === Math.round(finMit.score),
  'mit und ohne Parameter: ' + Math.round(finOhne.score) + ' / ' + Math.round(finMit.score));
melde(teil(finMit, 'dscr').applied === true && teil(finMit, 'ltv').applied === true,
  'beide Kennzahlen weiter angewandt');
melde(finMit.availableKpis === 5, 'fuenf von fuenf (ist: ' + finMit.availableKpis + ')');

console.log('\n=== 4 · Ohne Angabe bleibt alles wie vor v2144 ===');
const altBar = lauf(BAR);                       /* kein darlehen-Feld */
melde(teil(altBar, 'dscr').applied === true,
  'DSCR wird bewertet, wenn niemand etwas sagt (Score ' + Math.round(altBar.score) + ')');
melde(Math.round(altBar.score) === 49,
  'und die Kategorie steht auf 49 wie gemessen (ist: ' + Math.round(altBar.score) + ')');
melde(Math.round(bar.score) > Math.round(altBar.score),
  'mit darlehen:0 ist sie besser: ' + Math.round(bar.score) + ' statt ' + Math.round(altBar.score));

console.log('\n=== 5 · Die Wechselwirkung setzt beim Barkauf aus ===');
/* LTV >= 95 mit DSCR < 1,00 gaebe sonst -20 Punkte. Beim Barkauf sind
   beide null, also darf sie gar nicht greifen. */
const heikel = lauf({ dscr: 0, ltv: 0, zinsSatz: 4, tilgung: 2,
                      eigenkapitalQuote: 100, darlehen: 0 });
const hatMalus = (heikel.hinweise || []).some((h) => /Malus|Bonus/i.test(String(h)))
  || /Malus|Bonus/i.test(JSON.stringify(heikel));
melde(!hatMalus, 'kein Bonus und kein Malus aus der LTV-DSCR-Wechselwirkung');

console.log('\n=== 6 · Die Rangfolge ist dieselbe wie in dealscore.js ===');
[['darlehen: 0', { darlehen: 0 }, true],
 ['d_total: 0', { d_total: 0 }, true],
 ['d1: 0', { d1: 0 }, true],
 ['darlehen: 0 schlaegt d1: 99999', { darlehen: 0, d1: 99999 }, true],
 ['d_total: 150000', { d_total: 150000 }, false],
 ['nichts gesagt', {}, false]
].forEach(function (f) {
  const r = lauf(Object.assign({}, BAR, f[1]));
  const weg = teil(r, 'dscr').applied === false;
  melde(weg === f[2], f[0].padEnd(32) + ' -> ' + (weg ? 'entfaellt' : 'zaehlt')
    + '  Kategorie ' + Math.round(r.score));
});

console.log('\n=== Deckung ===');
console.log('  Kern        : die ECHTE frontend/js/dealscore2.js im vm-Kontext');
console.log('                (nicht gespiegelt — er laeuft nur im Browser)');
console.log('  Lagen       : Barkauf, finanziert, ohne Angabe, 6 Namensformen');
console.log('  NICHT hier  : dass die EK-Quote-Skala einen Barkauf bestraft.');
console.log('                Das ist benannt und bleibt offen — eine');
console.log('                Bewertungsentscheidung, keine Reparatur.');

console.log('\n' + (rot === 0
  ? 'SAUBER — der Barkauf wird nicht mehr bestraft.'
  : 'ROT — ' + rot + ' Probe(n).'));
process.exit(rot ? 1 : 0);
