#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * zwei-scores-pruefen.mjs — v3076
 *
 * INVESTMENT- UND FINANZIERUNGS-SCORE IM INVESTOR DEAL SCORE
 *
 * Marcel am 02.11.2026: zwei getrennte Bewertungen anbieten und in den
 * Einstellungen zwischen einem Score und zwei Scores wählen lassen.
 * Grundlage: design/Vorschläge/score-benchmark-p1.md (Abschnitte 3–5) und
 * die Demo design/Vorschläge/zwei-scores-demo.html.
 *
 * Geladen werden die ECHTEN Dateien aus frontend/js (score-tiers.js,
 * dscr-engine.js, deal-kpis.js, dealscore2.js) per vm mit Fenster-Stub —
 * dieselbe Art wie der Benchmark. Die acht Fälle A–H sind die Eckdaten aus
 * Abschnitt 3 des Benchmarks (Erwerbsnebenkosten 10,5 %, Zins 3,8 %,
 * Tilgung 2 %, Profil „Ausgewogen").
 *
 * VERTRÄGE (jeder Bruch = RC 1):
 *   V1  `score` ist bitgleich mit dem Stand vor v3076 (git f376887a),
 *       in allen sechs Profilen — sofern git erreichbar ist.
 *   V2  Sind alle vier Rendite-Kennzahlen da, ist das gewichtete Mittel aus
 *       Investment und Finanzierung (vor der Grenze) der bisherige Score
 *       ohne Grenze (±1 Rundung). Die zwei Scores teilen nur auf.
 *   V3  Gesamt = min(Investment, Obergrenze der DSCR-Staffel);
 *       Finanzierung ≤ Obergrenze.
 *   V4  „Kaufen" nur bei Investment ≥ 70, Finanzierung ≥ 50 und DSCR ≥ 1,0
 *       (oder Barkauf).
 *   V5  Barkauf: keine Grenze, Finanzierung gilt als erfüllt.
 *   V6  Darlehen über Marktwert und DSCR < 0,8 → Gesamt ≤ 34 (Kritisch).
 *
 * BÄNDER (Abschnitt 5.3) werden nur BERICHTET, nicht als Fehler gewertet:
 * ein Band ist eine begründete Einordnung, kein Messwert (Benchmark 5).
 * Gerechnet wird zweimal: mit der Angebotsmiete im Feld „Marktmiete"
 * (wie der Benchmark) und mit der ortsüblichen Vergleichsmiete.
 *
 * Aufruf: node tools/zwei-scores-pruefen.mjs        RC 0 = alle Verträge halten
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(ROOT, 'frontend', 'js');
const VOR_V3076 = 'f376887a';

function kontext(quellen) {
  const f = { console };
  f.window = f; f.self = f; f.globalThis = f;
  f.document = { readyState: 'complete', getElementById: () => null, querySelector: () => null, addEventListener() {}, body: null };
  f.setTimeout = () => 0; f.clearTimeout = () => {};
  const ctx = vm.createContext(f); ctx.global = ctx;
  for (const [name, text] of quellen) new vm.Script(text, { filename: name }).runInContext(ctx);
  return ctx;
}
const lies = (d) => fs.readFileSync(path.join(JS, d), 'utf8');
const BASIS = ['score-tiers.js', 'dscr-engine.js', 'deal-kpis.js'].map((d) => [d, lies(d)]);
const neu = kontext([...BASIS, ['dealscore2.js', lies('dealscore2.js')]]);

let alt = null;
try {
  const text = execFileSync('git', ['-C', ROOT, 'show', VOR_V3076 + ':frontend/js/dealscore2.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  alt = kontext([...BASIS, ['dealscore2-alt.js', text]]);
} catch (e) { alt = null; }

const { DealKpis, DealScore2, ScoreTier } = neu;

/* Eckdaten Abschnitt 3 (vgl = ortsübliche Vergleichsmiete, angebot = Angebotsmiete, €/m²) */
const FAELLE = [
  { id: 'A', kp: 250000, nkm: 2000, wfl: 260, zustand: 'normal', energie: 'E', ek: 26250, bwkNul: 5200, mw: 265000, vgl: 7.2, angebot: 8.0, mikro: 'mittel', bev: 'stabil', nachfrage: 'mittel', mietausfall: 'mittel' },
  { id: 'B', kp: 500000, nkm: 1250, wfl: 70, zustand: 'gut', energie: 'B', ek: 302500, bwkNul: 1800, mw: 510000, vgl: 18.5, angebot: 22.5, mikro: 'sehr_gut', bev: 'wachsend', nachfrage: 'sehr_stark', mietausfall: 'sehr_niedrig' },
  { id: 'C', kp: 195000, nkm: 600, wfl: 75, zustand: 'normal', energie: 'D', ek: 39975, bwkNul: 1300, mw: 215000, vgl: 10.6, angebot: 13.5, mikro: 'mittel', bev: 'wachsend', nachfrage: 'stark', mietausfall: 'niedrig' },
  { id: 'D', kp: 300000, nkm: 2600, wfl: 400, zustand: 'stark_sanierungsbeduerftig', energie: 'G', ek: 91500, bwkNul: 7800, mw: 290000, vgl: 6.3, angebot: 6.8, mikro: 'einfach', bev: 'stark_fallend', nachfrage: 'schwach', mietausfall: 'erhoeht' },
  { id: 'E', kp: 150000, nkm: 680, wfl: 68, zustand: 'gut', energie: 'C', ek: 30750, bwkNul: 1250, mw: 205000, vgl: 9.4, angebot: 10.5, mikro: 'gut', bev: 'stabil', nachfrage: 'stark', mietausfall: 'niedrig' },
  { id: 'F', kp: 420000, nkm: 1150, wfl: 85, zustand: 'gut', energie: 'C', ek: 0, bwkNul: 1900, mw: 400000, vgl: 14.0, angebot: 17.0, mikro: 'gut', bev: 'wachsend', nachfrage: 'sehr_stark', mietausfall: 'niedrig' },
  { id: 'G', kp: 640000, nkm: 3650, wfl: 560, zustand: 'gut', energie: 'C', ek: 195200, bwkNul: 10400, mw: 660000, vgl: 6.9, angebot: 7.6, mikro: 'gut', bev: 'stabil', nachfrage: 'stark', mietausfall: 'niedrig' },
  { id: 'H', kp: 460000, nkm: 1120, wfl: 80, zustand: 'gut', energie: 'D', ek: 140300, bwkNul: 1700, mw: 390000, vgl: 13.2, angebot: 17.5, mikro: 'gut', bev: 'wachsend', nachfrage: 'sehr_stark', mietausfall: 'niedrig' }
];
/* Abschnitt 5.3: [von, bis] */
const BAND = {
  A: { g: [70, 84], i: [70, 84], f: [60, 79] }, B: { g: [40, 55], i: [50, 64], f: [35, 49] },
  C: { g: [35, 49], i: [55, 69], f: [0, 34] },  D: { g: [50, 64], i: [50, 64], f: [50, 69] },
  E: { g: [55, 69], i: [70, 84], f: [35, 49] }, F: { g: [0, 34], i: [40, 54], f: [0, 20] },
  G: { g: [70, 84], i: [70, 84], f: [60, 74] }, H: { g: [15, 40], i: [35, 49], f: [0, 34] }
};

function dealFuer(c, miete, opt = {}) {
  const nk = c.kp * 0.105, gi = c.kp + nk, d1 = opt.barkauf ? 0 : Math.max(0, gi - c.ek);
  const ek = opt.barkauf ? gi : c.ek;
  const k = DealKpis.compute({ kp: c.kp, nk, nkm: c.nkm, ze: 0, bwk_ul: 0, bwk_nul: c.bwkNul, d1, d1z: 3.8, d1t: 2, ek, svw: 0, afa: 0, grenz: 0, ekInklNkLtv: false });
  return {
    k,
    deal: {
      bruttorendite: k.bmy, nettorendite: k.nmy, cashflowMonatlich: k.cf_m,
      cashOnCash: ek > 0 ? k.ekr : (k.cf_ns > 0 ? 999 : -50), darlehen: k.d_total,
      dscr: k.dscr, ltv: k.ltv, zinsSatz: 3.8, tilgung: 2, eigenkapitalQuote: ek / k.gi * 100,
      zustand: c.zustand, energieKlasse: c.energie, mietausfallRisiko: c.mietausfall,
      istMieteEurQm: c.nkm / c.wfl, marktmieteEurQm: c[miete], mietwachstumPct: 1.5,
      bevoelkerung: c.bev, nachfrage: c.nachfrage, mikrolage: c.mikro,
      /* Marktfaktor = Marktwert / Jahresmiete → „Faktor vs. Markt" = Kaufpreis / Marktwert */
      eigenerFaktor: c.kp / (c.nkm * 12), marktFaktor: c.mw / (c.nkm * 12),
      marktwert: c.mw
    }
  };
}

const fehler = [];
const pruef = (ok, text) => { if (!ok) fehler.push(text); };
const PRESETS = DealScore2.getPresets().map((p) => p.key);

/* ── Verträge über alle Profile und beide Mietvarianten ─────────────── */
let v1 = 0, v2 = 0;
for (const preset of PRESETS) {
  const cfg = DealScore2.getPresetConfig(preset);
  for (const miete of ['angebot', 'vgl']) {
    for (const c of FAELLE) {
      const { deal } = dealFuer(c, miete);
      const r = DealScore2.compute(JSON.parse(JSON.stringify(deal)), cfg);
      const tag = `${c.id}/${preset}/${miete}`;
      if (alt) {
        const ra = alt.DealScore2.compute(JSON.parse(JSON.stringify(deal)), alt.DealScore2.getPresetConfig(preset));
        pruef(ra.score === r.score && ra.label === r.label && ra.score_ohne_deckel === r.score_ohne_deckel, `V1 ${tag}: score ${ra.score} → ${r.score}`);
        v1++;
      }
      /* V2 */
      const W = cfg.weights;
      const renditeVoll = r.categories.rendite.breakdown.every((b) => b.applied);
      if (renditeVoll) {
        const i = DealScore2._zweiScores(r.categories, cfg, deal);
        const wI = i.investment.gruppen.reduce((a, g) => a + g.gewicht, 0);
        const wF = i.finanzierung.gruppen.reduce((a, g) => a + g.gewicht, 0);
        const mix = (i.investment.gruppen.reduce((a, g) => a + g.score * g.gewicht, 0) + i.finanzierung.gruppen.reduce((a, g) => a + g.score * g.gewicht, 0)) / (wI + wF);
        const wSum = Object.values(W).reduce((a, b) => a + b, 0);
        pruef(Math.abs(wI + wF - wSum) < 0.05, `V2 ${tag}: Gewichte ${wI + wF} ≠ ${wSum}`);
        pruef(Math.abs(mix - r.score_ohne_deckel) <= 1, `V2 ${tag}: Mischung ${mix.toFixed(1)} ≠ ${r.score_ohne_deckel}`);
        v2++;
      }
      /* V3 */
      const dk = ScoreTier.dscrDeckel(deal.dscr, deal.darlehen > deal.marktwert);
      const erwG = dk ? Math.min(r.investment.score, dk.max) : r.investment.score;
      pruef(r.gesamt.score === erwG, `V3 ${tag}: Gesamt ${r.gesamt.score} ≠ ${erwG}`);
      if (dk) pruef(r.finanzierung.score <= dk.max, `V3 ${tag}: Finanzierung ${r.finanzierung.score} über ${dk.max}`);
      pruef(r.gesamt.stufe === ScoreTier.stufe(r.gesamt.score).wort, `V3 ${tag}: Stufe ${r.gesamt.stufe}`);
      /* V4 */
      if (r.gesamt.empfehlung.text === 'Kaufen') {
        pruef(r.investment.score >= 70 && r.finanzierung.score >= 50 && deal.dscr >= 1.0, `V4 ${tag}: Kaufen bei ${r.investment.score}/${r.finanzierung.score}/DSCR ${deal.dscr.toFixed(2)}`);
      }
      /* V6 */
      if (deal.dscr < 0.8 && deal.darlehen > deal.marktwert) pruef(r.gesamt.score <= 34, `V6 ${tag}: Gesamt ${r.gesamt.score} > 34`);
    }
  }
}
/* V5 Barkauf */
{
  const cfg = DealScore2.getPresetConfig('balanced');
  const { deal } = dealFuer(FAELLE[6], 'vgl', { barkauf: true });
  const r = DealScore2.compute(deal, cfg);
  pruef(r.gesamt.deckel === null && r.finanzierung.barkauf === true, 'V5 Barkauf: Grenze oder Barkauf-Kennung falsch');
  pruef(r.gesamt.score === r.investment.score, 'V5 Barkauf: Gesamt ≠ Investment');
  pruef(r.investment.score < 70 || r.gesamt.empfehlung.text === 'Kaufen', `V5 Barkauf: Empfehlung „${r.gesamt.empfehlung.text}" bei Investment ${r.investment.score}`);
}

/* ── Ausgabe: Zuordnung, Fälle A–H, Bänder ─────────────────────────── */
const cfgB = DealScore2.getPresetConfig('balanced');
console.log('Zuordnung (dealscore2.js ZWEI_ZUORDNUNG, Profil Ausgewogen):');
for (const teil of ['investment', 'finanzierung']) {
  const r0 = DealScore2.compute(dealFuer(FAELLE[0], 'vgl').deal, cfgB)[teil];
  console.log('  ' + teil.padEnd(13) + r0.gruppen.map((g) => `${g.name} ${String(g.anteil).replace('.', ',')} % [${g.kpis.join(', ')}]`).join(' · '));
}
const im = (x, b) => x >= b[0] && x <= b[1];
const fmt = (x, b) => `${String(x).padStart(3)}${im(x, b) ? ' ✓' : (x < b[0] ? ' ↓' : ' ↑')}`;
for (const miete of ['angebot', 'vgl']) {
  console.log(`\nFälle A–H, Ausgewogen, Marktmiete = ${miete === 'angebot' ? 'Angebotsmiete (wie Benchmark)' : 'ortsübliche Vergleichsmiete'}`);
  console.log('  Fall  DSCR  Grenze | Invest. (Band)   | Finanz. (Band)   | Gesamt (Band)    | bisher | Empfehlung');
  const treffer = { i: 0, f: 0, g: 0 };
  for (const c of FAELLE) {
    const { deal } = dealFuer(c, miete);
    const r = DealScore2.compute(deal, cfgB), b = BAND[c.id];
    if (im(r.investment.score, b.i)) treffer.i++;
    if (im(r.finanzierung.score, b.f)) treffer.f++;
    if (im(r.gesamt.score, b.g)) treffer.g++;
    const band = (b) => `${b[0]}–${b[1]}`.padEnd(6);
    console.log(`  ${c.id}    ${deal.dscr.toFixed(2)}  ${String(r.gesamt.deckel ? r.gesamt.deckel.max : '–').padStart(4)}   | ${fmt(r.investment.score, b.i)} (${band(b.i)}) | ${fmt(r.finanzierung.score, b.f)} (${band(b.f)}) | ${fmt(r.gesamt.score, b.g)} (${band(b.g)}) | ${String(r.score).padStart(4)}   | ${r.gesamt.empfehlung.text}`);
  }
  console.log(`  im Band: Investment ${treffer.i}/8 · Finanzierung ${treffer.f}/8 · Gesamt ${treffer.g}/8   (✓ im Band, ↑ darüber, ↓ darunter — Einordnung, kein Fehler)`);
}

console.log(`\nVerträge: V1 ${alt ? v1 + ' Läufe gegen ' + VOR_V3076 : 'ÜBERSPRUNGEN (git nicht erreichbar)'} · V2 ${v2} Läufe · V3/V4/V6 ${PRESETS.length * 16} Läufe · V5 Barkauf`);
if (fehler.length) {
  console.log(`ROT — ${fehler.length} Vertragsbruch/-brüche:`);
  fehler.slice(0, 25).forEach((t) => console.log('  ' + t));
  process.exit(1);
}
console.log('GRÜN — alle Verträge halten.');
