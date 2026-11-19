// Rechnung fuer die Score-Animation: nimmt _zweiTeil() und DEFAULTS WOERTLICH aus
// frontend/js/dealscore2.js (Quelltext ausgeschnitten und ausgewertet, nichts nachgebaut)
// und speist die Hero-Werte der Landing (frontend/landing/dp2.js Z.64-70) ein.
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../../frontend/js/dealscore2.js', import.meta.url), 'utf8').split('\r\n').join('\n');
const cut = (start, endRe) => { const i = src.indexOf(start); const rest = src.slice(i); const m = rest.search(endRe); return rest.slice(0, m); };
const DEFAULTS_SRC = cut('var DEFAULTS = {', /\n    \/\/ Schwellen/) + '};';
const ZUORD_SRC = cut('var ZWEI_ZUORDNUNG = {', /\n\n  function _zweiTeil/);
const TEIL_SRC = cut('function _zweiTeil(', /\n\n  function _zweiStufe/);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const f = new Function('clamp', DEFAULTS_SRC + '\n' + ZUORD_SRC + '\n' + TEIL_SRC + '\nreturn {DEFAULTS, ZWEI_ZUORDNUNG, _zweiTeil};');
const { DEFAULTS, ZWEI_ZUORDNUNG, _zweiTeil } = f(clamp);
const cfg = Object.assign({ neutralFallback: 50 }, DEFAULTS);

// Kennzahl-Punkte: so gewaehlt, dass die Kategorie Rendite genau 98 ergibt (Hero-Balken)
const P = { bruttorendite: 100, nettorendite: 98, cashflow: 100, cashOnCash: 93 };
const bd = (kat, keys) => keys.map(k => ({ key: k, name: k, points: P[k] ?? 0, weight: cfg.subWeights[kat][k], applied: true }));
const rBd = bd('rendite', ['bruttorendite', 'nettorendite', 'cashflow', 'cashOnCash']);
const rScore = rBd.reduce((s, b) => s + b.points * b.weight, 0) / rBd.reduce((s, b) => s + b.weight, 0);
const ganz = (kat, score, n) => ({ score, breakdown: Object.keys(cfg.subWeights[kat]).map((k, i) => ({ key: k, name: k, points: score, weight: cfg.subWeights[kat][k], applied: i < n })) });
const cats = {
  rendite: { score: rScore, breakdown: rBd },
  finanzierung: ganz('finanzierung', 96, 5), risiko: ganz('risiko', 88, 5), lage: ganz('lage', 60, 5), upside: ganz('upside', 53, 4)
};
// bisheriger Gesamtscore (computeFromKpis-Weg): gewichtetes Mittel der fuenf Kategorien
let t = 0, w = 0; for (const k of Object.keys(cfg.weights)) { t += cats[k].score * cfg.weights[k]; w += cfg.weights[k]; }
const inv = _zweiTeil(ZWEI_ZUORDNUNG.investment, cats, cfg);
const fin = _zweiTeil(ZWEI_ZUORDNUNG.finanzierung, cats, cfg);
const anteil = (a) => Math.round(a.gewicht / ((inv.gewicht + fin.gewicht) || 1) * 1000) / 10;
console.log('Rendite-Kategorie', rScore.toFixed(3), '| Gesamt alt', (t / w).toFixed(3), '->', Math.round(t / w));
console.log('Investment roh', inv.roh.toFixed(3), '->', Math.round(inv.roh), 'Anteil', anteil(inv), 'Gewicht', inv.gewicht);
console.log('Finanzierung roh', fin.roh.toFixed(3), '->', Math.round(fin.roh), 'Anteil', anteil(fin), 'Gewicht', fin.gewicht);
console.log('Mittel', ((inv.roh * inv.gewicht + fin.roh * fin.gewicht) / (inv.gewicht + fin.gewicht)).toFixed(3));
for (const g of [...inv.gruppen, ...fin.gruppen]) console.log(' ', g.name, g.score, 'Anteil', g.anteil, 'Gewicht', g.gewicht, g.availableKpis + '/' + g.totalKpis);
