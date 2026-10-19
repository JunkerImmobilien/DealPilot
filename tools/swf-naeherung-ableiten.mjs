#!/usr/bin/env node
/* swf-naeherung-ableiten.mjs (v2395, nur Messung, NICHT verdrahtet) — misst, ob sich
   aus allen amtlichen Sachwertfaktoren des Registers eine DealPilot-NAEHERUNG
   ableiten liesse. Heute gibt es ohne Ausschusswert KEINEN Faktor (Sachwert
   „vorlaeufig", § 21 Abs. 3 ImmoWertV, „kein Treffer heisst kein Wert").

   FORM (log-linear):
       ln SWF = c + b * ln(vorl. Sachwert / 300.000) + r * RND/10 + a_RDH + s * Stadt + o * Ost
       [+ g * ln(BRW / 150)  nur an Saetzen, deren Formel den BRW fuehrt]

   DATENBASIS: jeder Registersatz `sachwertfaktor` mit Formel (nicht gesperrt),
   Ein-/Zweifamilienhaus (EZFH) oder Reihen-/Doppelhaus (RDH), juengster
   Jahrgang je AGS und Zweig. Jede Formel wird mit dem ECHTEN Auswerter
   (swf_modelle.auswerten) an einem Raster abgetastet — vorl. Sachwert
   150/200/300/400/600 Tsd. EUR, BRW 30/80/150/300/600 EUR/m², RND 25/40 —
   nur dort, wo sie einen Wert liefert (ihr eigener Gueltigkeitsbereich).
   Fuehrt die Formel den BRW nicht, zaehlt der Rasterpunkt einmal ohne BRW.

   PRUEFMASS: Leave-one-LAND-out und Leave-one-AUSSCHUSS-out, |Naeherung/amtlich − 1|
   in Prozent, Median und P90. Vergleich: „kein Faktor" (SWF = 1, vorlaeufiger
   Sachwert), so wie der Bericht heute ohne Ausschusswert rechnet.

   SCHREIBT NUR, WENN ES SICH LOHNT: LOLO-Median UND -P90 mindestens 25 % unter
   „SWF = 1". Sonst Protokoll, RC 0, keine Datei. Mit --lernkurve zusaetzlich
   25/50/75/100 % der Ausschuesse. Nennt die DECKUNG. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(WURZEL, 'marktbericht/backend/src/lib');
const ZIEL = path.join(LIB, 'swf-naeherung.json');
const imp = (d) => import(pathToFileURL(path.join(LIB, d)).href);
const { SAATDATEIEN } = await imp('ausschuss_register.js');
const { auswerten } = await imp('swf_modelle.js');
const TROCKEN = process.argv.includes('--trocken');
const LERNKURVE = process.argv.includes('--lernkurve');
const _err = console.error, _warn = console.warn;

const OST = new Set(['BB', 'MV', 'SN', 'ST', 'TH']);
const istStadt = (s) => /^(02|04|11)/.test(String(s.ags))
  || (/\bstadt\b|stadtkreis|kreisfreie/i.test(String(s.gebiet_name || '') + ' ' + String(s.gaa_name || ''))
      && !/landkreis|\bkreis\b(?!freie)|kreises|region\b|städteregion/i.test(String(s.gebiet_name || '')));
const familie = (z) => { z = String(z || ''); if (/^(ezfh|efh|zfh|dreifh|fertighaus)/.test(z)) return 'EZFH'; if (/^(rhdhh|rh|rmh|dhh|reh)/.test(z)) return 'RDH'; return null; };
const SW = [150000, 200000, 300000, 400000, 600000], BRW = [30, 80, 150, 300, 600], RNDS = [25, 40];

/* ── 1 · Einlesen und abtasten ───────────────────────────────────────── */
let gelesen = 0, dateien = 0;
const juengst = new Map();
for (const d of SAATDATEIEN) {
  const arr = JSON.parse(fs.readFileSync(path.join(LIB, 'register', d), 'utf8')); dateien++;
  for (const s of arr) {
    gelesen++;
    if (s.kennzahl !== 'sachwertfaktor' || s.vollstaendig === false || !s.formel || !familie(s.zweig)) continue;
    const k = s.ags + '|' + s.zweig;
    if (!juengst.has(k) || (juengst.get(k).berichtsjahr || 0) < (s.berichtsjahr || 0)) juengst.set(k, s);
  }
}
const P = []; let nichtAuswertbar = 0;
console.error = () => {}; console.warn = () => {};
for (const s of juengst.values()) {
  const meine = [];
  for (const rnd of RNDS) for (const sw of SW) {
    const werte = [];
    for (const brw of BRW) {
      const e = { sachwert: sw, brw, rnd, baujahr: 2026 - 80 + rnd, standardstufe: 3, wohnflaeche: 140, flaeche: 600, bgf: 250, mod_punkte: 4, unterkellerung: 'ja' };
      let r = null; try { r = auswerten(s.formel, e); } catch (x) { r = null; }
      const w = r && r.verfuegbar ? Number(r.wert ?? r.faktor) : NaN;
      if (Number.isFinite(w) && w > 0.3 && w < 3) werte.push({ brw, w });
    }
    if (!werte.length) continue;
    if (new Set(werte.map((v) => v.w)).size > 1) for (const v of werte) meine.push({ sw, rnd, brw: v.brw, w: v.w, brwAchse: 1 });
    else meine.push({ sw, rnd, brw: null, w: werte[0].w, brwAchse: 0 });
  }
  if (!meine.length) { nichtAuswertbar++; continue; }
  for (const m of meine) P.push({ ...m, F: familie(s.zweig), land: s.land_code, gaa: s.gaa_name || String(s.ags).slice(0, 5), stadt: istStadt(s) ? 1 : 0, ost: OST.has(s.land_code) ? 1 : 0 });
}
console.error = _err; console.warn = _warn;

/* ── 2 · Statistik ───────────────────────────────────────────────────── */
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const quantil = (a, p) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
function kq(X, y, lam = 1e-4) {
  const p = X[0].length; const A = Array.from({ length: p }, () => Array(p + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) { for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; A[a][p] += X[i][a] * y[i]; }
  for (let a = 1; a < p; a++) A[a][a] += lam * X.length;
  for (let c = 0; c < p; c++) {
    let pv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r;
    [A[c], A[pv]] = [A[pv], A[c]]; const v = A[c][c] || 1e-12; for (let k = c; k <= p; k++) A[c][k] /= v;
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r) => r[p]);
}
const skalar = (b, x) => b.reduce((s, v, i) => s + v * x[i], 0);
const m0 = (p) => [1, Math.log(p.sw / 300000), p.rnd / 10, p.F === 'RDH' ? 1 : 0, p.stadt, p.ost];
const m1 = (p) => [...m0(p), Math.log(p.brw / 150)];
const pct = (n, w) => Math.abs(n / w - 1) * 100;
const kennz = (e) => ({ median_pct: r3(median(e)), p90_pct: r3(quantil(e, 0.9)), punkte: e.length });
function auslassen(schl, menge, fx, nurBrw) {
  const e = [], jeGruppe = {};
  for (const g of [...new Set(menge.map(schl))]) {
    const te = menge.filter((p) => schl(p) === g); let tr = P.filter((p) => schl(p) !== g); if (nurBrw) tr = tr.filter((p) => p.brwAchse);
    const b = kq(tr.map(fx), tr.map((p) => Math.log(p.w)));
    const eg = te.map((p) => pct(Math.exp(skalar(b, fx(p))), p.w)); e.push(...eg);
    jeGruppe[g] = { punkte: te.length, median_pct: r3(median(eg)), amtlich_median: r3(median(te.map((p) => p.w))) };
  }
  return { e, jeGruppe };
}
const basis = P.map((p) => pct(1, p.w));
const lolo = auslassen((p) => p.land, P, m0), loao = auslassen((p) => p.gaa, P, m0);
const PB = P.filter((p) => p.brwAchse);
const loloB = auslassen((p) => p.land, PB, m1, true), basisB = PB.map((p) => pct(1, p.w));
const nachIst = [[0, 0.8], [0.8, 1.0], [1.0, 1.2], [1.2, 1.5], [1.5, 9]].map(([lo, hi]) => {
  const idx = P.map((p, i) => (p.w >= lo && p.w < hi ? i : -1)).filter((i) => i >= 0);
  const ePos = new Map(); let k = 0; for (const g of [...new Set(P.map((p) => p.land))]) for (const p of P) if (p.land === g) ePos.set(p, lolo.e[k++]);
  const e = idx.map((i) => ePos.get(P[i]));
  return { amtlich_von: lo, amtlich_bis: hi, ...kennz(e) };
});
const laender = Object.keys(lolo.jeGruppe).sort();
const b = kq(P.map(m0), P.map((p) => Math.log(p.w)));

console.log('DECKUNG: ' + dateien + ' Dateien, ' + gelesen + ' Saetze gelesen, ' + juengst.size + ' Sachwertfaktoren EZFH/RDH (juengster Jahrgang), '
  + nichtAuswertbar + ' am Raster ohne Wert, ' + P.length + ' Rasterpunkte aus ' + new Set(P.map((p) => p.gaa)).size + ' Ausschuessen, Laender ' + laender.join(' '));
console.log('amtliche Faktoren am Raster: Median ' + r3(median(P.map((p) => p.w))) + ' · P10 ' + r3(quantil(P.map((p) => p.w), 0.1)) + ' · P90 ' + r3(quantil(P.map((p) => p.w), 0.9)));
console.log('„kein Faktor" (SWF = 1)        ' + kennz(basis).median_pct + ' % / P90 ' + kennz(basis).p90_pct + ' %');
console.log('Naeherung Leave-one-Land-out   ' + kennz(lolo.e).median_pct + ' % / P90 ' + kennz(lolo.e).p90_pct + ' %   Leave-one-Ausschuss-out ' + kennz(loao.e).median_pct + ' % / P90 ' + kennz(loao.e).p90_pct + ' %');
console.log('nur Formeln mit BRW (' + PB.length + ' Punkte): SWF = 1 ' + kennz(basisB).median_pct + ' / ' + kennz(basisB).p90_pct + ' %   Naeherung mit BRW LOLO ' + kennz(loloB.e).median_pct + ' / ' + kennz(loloB.e).p90_pct + ' %');
console.log('wo sie bricht (LOLO nach amtlichem Faktor): ' + nachIst.map((x) => x.amtlich_von + '-' + x.amtlich_bis + ': ' + x.median_pct + '/' + x.p90_pct + ' %').join(' · '));
console.log('je Land (Median %, amtl. Median): ' + laender.map((l) => l + ' ' + lolo.jeGruppe[l].median_pct + ' (' + lolo.jeGruppe[l].amtlich_median + ')').join('  '));
console.log('Koeffizienten: c ' + r3(b[0]) + ' · ln SW ' + r3(b[1]) + ' · RND/10 ' + r3(b[2]) + ' · RDH ' + r3(b[3]) + ' · Stadt ' + r3(b[4]) + ' · Ost ' + r3(b[5]));

let lernkurve = null;
if (LERNKURVE) {
  let seed = 7; const zufall = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const gremien = [...new Set(P.map((p) => p.gaa))]; const landVon = new Map(P.map((p) => [p.gaa, p.land]));
  lernkurve = {};
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const E = [];
    for (let w = 0; w < (f === 1 ? 1 : 20); w++) for (const L of laender) {
      const mix = gremien.filter((g) => landVon.get(g) !== L);
      for (let i = mix.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [mix[i], mix[j]] = [mix[j], mix[i]]; }
      const wahl = new Set(mix.slice(0, Math.max(1, Math.round(mix.length * f))));
      const tr = P.filter((p) => wahl.has(p.gaa)); const bb = kq(tr.map(m0), tr.map((p) => Math.log(p.w)));
      for (const p of P.filter((x) => x.land === L)) E.push(pct(Math.exp(skalar(bb, m0(p))), p.w));
    }
    lernkurve[Math.round(f * 100) + '%'] = kennz(E);
  }
  console.log('Lernkurve LOLO: ' + Object.entries(lernkurve).map(([k, v]) => k + ' ' + v.median_pct + '/' + v.p90_pct + ' %').join(' · '));
}

const lohnt = median(lolo.e) <= 0.75 * median(basis) && quantil(lolo.e, 0.9) <= 0.75 * quantil(basis, 0.9);
if (!lohnt) {
  console.log('ERGEBNIS: lohnt NICHT — die Naeherung ist kaum genauer als gar kein Faktor (Schwelle: 25 % besser in Median UND P90). '
    + 'Der Faktor haengt am oertlichen Markt, den Sachwert, RND, Hausart, Stadt/Ost nicht tragen. Keine Datei geschrieben.');
} else if (!TROCKEN) {
  fs.writeFileSync(ZIEL, JSON.stringify({ stand: new Date().toISOString().slice(0, 10), verdrahtet: false,
    form: 'ln SWF = c + b ln(SW/300000) + r RND/10 + a_RDH + s Stadt + o Ost', kennzeichnung: 'abgeleitet aus der DealPilot-Formel (nie amtlich)',
    koeffizienten: { c: r3(b[0]), ln_sw: r3(b[1]), rnd_10: r3(b[2]), rdh: r3(b[3]), stadt: r3(b[4]), ost: r3(b[5]) },
    pruefung: { lolo: kennz(lolo.e), loao: kennz(loao.e), kein_faktor: kennz(basis), je_land: lolo.jeGruppe, nach_amtlichem_faktor: nachIst }, lernkurve }, null, 2) + '\n');
  console.log('geschrieben: ' + path.relative(WURZEL, ZIEL));
}
