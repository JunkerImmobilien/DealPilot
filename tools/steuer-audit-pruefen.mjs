#!/usr/bin/env node
/* v3380 · Steuer-Audit 14.11.2026 (Marcel: „bitte pruefe auch noch mal alle Steuerberechnungen").
 * Prueft die Steuerrechnung der App an den ECHTEN Dateien, ohne Browser und ohne Datenbank.
 * Jeder Sollwert nennt seine Fundstelle (Gesetz, Richtlinie, amtliches Formular) - nie eine
 * selbst ausgedachte Zahl. Bericht: Dateien/Fehler/steuer-audit-2026-11-14.md
 *
 *  A  Tarif § 32a EStG 2025/2026 (Formeln, Rundung Satz 1/5, Zonengrenzen stetig), Grenzsteuersatz
 *     als Ableitung, Splitting § 32a Abs. 5, Soli §§ 3, 4 SolZG (Freigrenze, Milderungszone 11,9 %),
 *     Jahrgang ohne Tarif -> naechstaelterer und als Ersatz kenntlich
 *  B  AfA-Engine: § 7 Abs. 4 Satz 1 Nr. 2 a/b/c (3 / 2 / 2,5 %), § 7 Abs. 1 Satz 4 (Monate),
 *     § 7 Abs. 5a (5 % vom Restwert, Fenster 01.10.2023-30.09.2029), § 7b (5 % x 4 Jahre,
 *     Bemessung hoechstens 4.000 EUR/m2, Baukosten-Obergrenze 5.200 EUR/m2)
 *  C  v3380 tax.js: Inventar und anschaffungsnahe HK im Kaufjahr monatsanteilig, Rest am Ende,
 *     Summe unveraendert; das volle Jahr (calc.js-Aufruf ohne teiljahr) bitgleich
 *  D  v3380 § 21 Abs. 2 EStG mit Warmmiete (R 21.3 Satz 2 EStR, BFH IX R 44/15)
 *  E  v3380 Fristen: § 23 ab Kaufvertrag, frei erst nach dem Fristtag; 15-%-Quote netto gegen
 *     Gebaeude-AHK einschl. Nebenkosten (§ 6 Abs. 1 Nr. 1a EStG)
 *  F  v3381 Backend objektRechnung: Ruecklagen nicht in der Steuerbemessung (wie calc.js v3268)
 *  G  Texte: Grenzsteuer-Beispiele im Tooltip gegen den Tarif, Werbungskosten-PDF-Matrix
 *     nachrechenbar, Grunderwerbsteuersaetze der Laender, GrESt ohne Inventar (§ 9 GrEStG)
 *
 * Aufruf: node tools/steuer-audit-pruefen.mjs   (RC=0 sauber) */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = (f) => fs.readFileSync(path.join(ROOT, 'frontend/js', f), 'utf8');
let gruen = 0, rot = 0;
const ok = (b, t) => { if (b) gruen++; else { rot++; console.log('  ROT  ' + t); } };
const nah = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;

/* ── Umgebung: tax.js mit nachgebautem Formular ─────────────────────── */
function lade(felder, state) {
  felder = felder || {};
  const el = (id) => (id in felder)
    ? { value: String(felder[id]), checked: felder[id] === true, options: [], addEventListener() {} } : null;
  const ctx = {
    console: { log() {}, warn() {}, info() {}, error() {} }, Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN,
    Number, String, Object, Array, Promise, setTimeout() {}, clearTimeout() {},
    document: { getElementById: el, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }) },
    addEventListener() {}, localStorage: { getItem: () => null, setItem() {} },
  };
  ctx.window = ctx;
  ctx.parseDe = (s) => { const n = parseFloat(String(s == null ? '' : s).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  ctx.State = state || {};
  vm.createContext(ctx);
  for (const f of ['anteilig.js', 'afa-engine.js', 'deal-kpis.js']) vm.runInContext(js(f), ctx);
  vm.runInContext(js('tax.js') + ';window.Tax=Tax;window._cay=_computeAutoForYear;window._m66=_mieteQuote66;', ctx);
  ctx._taxYearlyOverrides = {};
  return ctx;
}

/* ── A · Tarif ──────────────────────────────────────────────────────── */
{
  const T = lade().Tax;
  /* § 32a Abs. 1 EStG ab VZ 2026 (gesetze-im-internet.de, gelesen 14.11.2026):
     bis 12.348: 0 · bis 17.799: (914,51 y + 1.400) y · bis 69.878: (173,10 z + 2.397) z + 1.034,87
     bis 277.825: 0,42 x - 11.135,63 · darueber 0,45 x - 19.470,38; x und Ergebnis abgerundet */
  const est26 = (x) => {
    x = Math.floor(x);
    if (x <= 12348) return 0;
    if (x <= 17799) { const y = (x - 12348) / 1e4; return Math.floor((914.51 * y + 1400) * y); }
    if (x <= 69878) { const z = (x - 17799) / 1e4; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
    if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
    return Math.floor(0.45 * x - 19470.38);
  };
  /* § 32a Abs. 1 ab VZ 2025 (BGBl. 2024 I Nr. 449, Art. 1 Nr. 2) */
  const est25 = (x) => {
    x = Math.floor(x);
    if (x <= 12096) return 0;
    if (x <= 17443) { const y = (x - 12096) / 1e4; return Math.floor((932.30 * y + 1400) * y); }
    if (x <= 68480) { const z = (x - 17443) / 1e4; return Math.floor((176.64 * z + 2397) * z + 1015.13); }
    if (x <= 277825) return Math.floor(0.42 * x - 10911.92);
    return Math.floor(0.45 * x - 19246.67);
  };
  let abw26 = 0, abw25 = 0;
  for (let x = 0; x <= 320000; x += 37) { if (T.calcEStG(x, 2026) !== est26(x)) abw26++; if (T.calcEStG(x, 2025) !== est25(x)) abw25++; }
  ok(abw26 === 0, 'A Tarif 2026: ' + abw26 + ' Abweichungen gegen den Gesetzestext');
  ok(abw25 === 0, 'A Tarif 2025: ' + abw25 + ' Abweichungen gegen den Gesetzestext');
  ok(T.calcEStG(50000.99, 2026) === 10548, 'A Satz 1: zvE auf volle Euro abgerundet (50.000,99 -> 10.548)');
  for (const [g, j] of [[17799, 2026], [69878, 2026], [277825, 2026], [17443, 2025], [68480, 2025]]) {
    ok(Math.abs(T.calcEStG(g + 1, j) - T.calcEStG(g, j)) <= 1, `A stetig an der Zonengrenze ${g} (${j})`);
  }
  ok(nah(T.calcGrenzsteuersatz(12349, 2026), 0.14, 1e-3), 'A Eingangssatz 14 %');
  ok(nah(T.calcGrenzsteuersatz(30000, 2026), 0.2819, 5e-4), 'A Grenzsatz 30.000 = 28,19 % (Ableitung Zone 3)');
  ok(T.calcGrenzsteuersatz(100000, 2026) === 0.42 && T.calcGrenzsteuersatz(300000, 2026) === 0.45, 'A Spitzen-/Reichensteuersatz 42/45 %');
  ok(T.estTarif(100000, 2026, true) === 2 * T.calcEStG(50000, 2026), 'A Splitting § 32a Abs. 5: 2 x Steuer auf die Haelfte');
  /* § 3 Abs. 3 SolZG: 20.350 / 40.700 EUR; § 4: 5,5 %, hoechstens 11,9 % ueber der Freigrenze */
  ok(T.soli(20350, 2026, false) === 0 && T.soli(40700, 2026, true) === 0, 'A Soli-Freigrenze 20.350 / 40.700');
  ok(T.soli(25000, 2026, false) === 553.35, 'A Soli Milderungszone 25.000 -> 553,35 (11,9 % x 4.650)');
  ok(T.soli(40000, 2026, false) === 2200, 'A Soli voll 5,5 % bei 40.000 -> 2.200');
  ok(T.soli(19951, 2025, false) > 0 && T.soli(19950, 2025, false) === 0, 'A Soli-Freigrenze 2025 19.950');
  const i27 = T.tarifInfo(2027);
  ok(i27.jahr === 2026 && i27.exakt === false, 'A Jahrgang 2027 ohne Gesetz -> Tarif 2026, als Ersatz kenntlich');
}

/* ── B · AfA-Engine ─────────────────────────────────────────────────── */
{
  const A = lade().Afa;
  const L = (bj) => (A.linearNachFertigstellung(bj) || {}).satz;
  ok(L(1924) === 2.5 && L(1925) === 2.0 && L(2022) === 2.0 && L(2023) === 3.0, '§ 7 Abs. 4 S. 1 Nr. 2: vor 1925 2,5 %, 1925-2022 2 %, ab 2023 3 %');
  const s = A.linear(100000, 2, 52, 0.25);
  ok(s[0] === 500 && s[1] === 2000 && nah(s.reduce((a, b) => a + b, 0), 100000, 0.01) && nah(s[50], 1500, 0.01),
    '§ 7 Abs. 1 S. 4: Kauf Oktober 3/12 im ersten Jahr, Rest im 51. Jahr, Summe = AHK');
  const ant = lade({ kaufdat: '2026-04-15' }).DealPilotAnteilig;
  ok(ant.startFactorMonths('2026-04-15', 2026) === 0.75 && ant.startFactorMonths('2026-01-31', 2026) === 1
     && nah(ant.startFactorMonths('2026-12-01', 2026), 1 / 12, 1e-9), 'Monatsanteil: Anschaffungsmonat zaehlt voll ((13 - m) / 12)');
  const d = A.degressiv(400000, 5, 30, { wechsel: false, ersterAnteil: 0.25 });
  ok(d.series[0] === 5000 && d.series[1] === 19750, '§ 7 Abs. 5a: 5 % vom Restwert, Kaufjahr anteilig (400.000, Oktober: 5.000 / 19.750)');
  const e1 = A.checkDegressivEligibility({ ds2_zustand: 'neubau', baujahr: 2024, afaSatz: '3.0', kaufdatum: '2023-09-30' });
  const e2 = A.checkDegressivEligibility({ ds2_zustand: 'neubau', baujahr: 2024, afaSatz: '3.0', kaufdatum: '2023-10-01' });
  const e3 = A.checkDegressivEligibility({ ds2_zustand: 'neubau', baujahr: 2024, afaSatz: '3.0', kaufdatum: '2025-02-01' });
  ok(!e1.eligible && e2.eligible && !e3.eligible, '§ 7 Abs. 5a: Fenster ab 01.10.2023, Kauf nur bis Ende des Fertigstellungsjahres');
  ok(A.sonder7bBasis(600000, 100) === 400000 && A.sonder7bBasis(300000, 100) === 300000, '§ 7b Abs. 3: Bemessung hoechstens 4.000 EUR/m2');
  ok(A.sonder7bBaukosten(530000, 100).ok === false && A.sonder7bBaukosten(520000, 100).ok === true, '§ 7b Abs. 2: Baukosten-Obergrenze 5.200 EUR/m2');
  const so = A.sonder7b(400000, 6);
  ok(so[0] === 20000 && so[3] === 20000 && so[4] === 0, '§ 7b Abs. 1: 5 % im Anschaffungsjahr und den drei Folgejahren, ohne Zeitanteil');
}

/* ── C · v3380 Kaufjahr fuer Inventar und anschaffungsnahe HK ──────── */
{
  const rows = []; for (let i = 0; i < 60; i++) rows.push({ cal: 2026 + i, zy: 0, bwk_st_y: 0 });
  const felder = { kp: '300000', san: '20000', san_ust: 'brutto', moebl: '10000', inv_tax_active: true, inv_tax_years: '10',
    san_tax_active: true, san_tax_years: 'auto', afa_satz: '2.0', nkm: '1000', ze: '0', umlagef: '0',
    kaufdat: '2026-10-01', wirtschaftlicher_uebergang: '2026-10-01', halter: 'privat' };
  /* Grenze 15.000 netto: 20.000 brutto = 16.807 netto -> anschaffungsnah */
  const st = { cfRows: rows, _afaSeriesNormal: rows.map(() => 0), _afaSeriesSonder: rows.map(() => 0), _ahk: { sanLimit: 15000, nkInvQuote: 0 } };
  const c = lade(felder, st);
  const t0 = c._cay(0, 2026, true), t1 = c._cay(1, 2027, true), t10 = c._cay(10, 2036, true), t50 = c._cay(50, 2076, true);
  ok(t0.sonst_bewegl_wg === 250, 'C Inventar 10.000 / 10 J., Kauf Oktober: Jahr 1 = 250 (ist ' + t0.sonst_bewegl_wg + ')');
  ok(t1.sonst_bewegl_wg === 1000 && t10.sonst_bewegl_wg === 750, 'C Inventar: volle Jahre 1.000, Rest 750 im 11. Jahr');
  ok(t0.anschaffungsnah === 100 && t1.anschaffungsnah === 400 && t50.anschaffungsnah === 300,
    'C anschaffungsnahe HK 20.000 zu 2 %: 100 / 400 / Rest 300 im 51. Jahr (ist ' + t0.anschaffungsnah + '/' + t1.anschaffungsnah + '/' + t50.anschaffungsnah + ')');
  let sm = 0, sa = 0; for (let i = 0; i < 60; i++) { const a = c._cay(i, 2026 + i, true); sm += a.sonst_bewegl_wg; sa += a.anschaffungsnah; }
  ok(nah(sm, 10000, 0.01) && nah(sa, 20000, 0.01), 'C Summen unveraendert (Inventar 10.000, anschaffungsnah 20.000)');
  const v0 = c._cay(0, 2026);
  ok(v0.sonst_bewegl_wg === 1000 && v0.anschaffungsnah === 400, 'C volles Jahr (calc.js ohne teiljahr) bitgleich zu v3379');
  /* Erhaltung unter der Grenze: Abfluss, kein Zeitanteil */
  st._ahk = { sanLimit: 29700, nkInvQuote: 0 };
  ok(c._cay(0, 2026, true).erhaltungsaufwand === 20000, 'C Erhaltungsaufwand unter der 15-%-Grenze sofort voll (§ 11 Abs. 2 EStG)');
  const c2 = lade(Object.assign({}, felder, { kaufdat: '2026-01-10', wirtschaftlicher_uebergang: '2026-01-10' }), st);
  ok(c2._cay(0, 2026, true).sonst_bewegl_wg === 1000, 'C Kauf im Januar: volles Jahr');
  const src = js('tax.js');
  const aufr = (src.match(/_computeAutoForYear\([^)]*\)/g) || []).filter((x) => !/function|yearIdx, year, teiljahr|\(0, …/.test(x));
  ok(aufr.length >= 4 && aufr.every((x) => /, true\)$/.test(x)), 'C alle Kalenderjahr-Aufrufer in tax.js geben teiljahr mit: ' + aufr.join(' '));
}

/* ── D · § 21 Abs. 2 EStG mit Warmmiete ─────────────────────────────── */
{
  const q = (f) => lade(f)._m66();
  const w = q({ nkm: '500', ds2_marktmiete: '8', wfl: '100', umlagef: '250' });
  ok(w.stand === 'ok' && nah(w.quote, 750 / 1050 * 100, 1e-6), 'D Warmmiete: (500 + 250) / (800 + 250) = 71,4 % (R 21.3 S. 2 EStR)');
  const k = q({ nkm: '500', ds2_marktmiete: '8', wfl: '100' });
  ok(k.stand === 'ok' && nah(k.quote, 62.5, 1e-6), 'D ohne Umlagen kalt: 62,5 %');
  ok(/q >= 66/.test(js('tax.js')) && /q >= 50/.test(js('tax.js')), 'D Schwellen 66 % / 50 % (§ 21 Abs. 2 Satz 1/2 EStG seit VZ 2021)');
}

/* ── E · Fristen ────────────────────────────────────────────────────── */
{
  const ctx = { console, Date, Math, JSON, parseFloat, parseInt, isFinite, Number, String, Object, Array,
    document: { getElementById: () => null, addEventListener() {}, readyState: 'complete' }, addEventListener() {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(js('deal-kpis.js'), ctx);
  vm.runInContext(js('portfolio-strategie.js'), ctx);
  const F = ctx.PortfolioStrategie.fristen;
  const heute = new Date(); const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const vor10 = new Date(heute.getFullYear() - 10, heute.getMonth(), heute.getDate());
  const r1 = F({ kaufdat: iso(vor10), wirtschaftlicher_uebergang: iso(new Date(vor10.getFullYear(), vor10.getMonth() + 2, vor10.getDate())) });
  ok(r1.spekulation_ende && r1.spekulation_ende.getFullYear() === heute.getFullYear() && r1.spekulation_ende.getMonth() === heute.getMonth(),
    'E § 23 zaehlt ab Kaufvertrag (kaufdat), nicht ab Uebergang');
  ok(r1.spekulation_rest_tage === 1, 'E am Fristtag noch steuerpflichtig, frei ab dem Folgetag (Rest 1 Tag, ist ' + r1.spekulation_rest_tage + ')');
  ok(r1.san_frist_ende && r1.san_frist_ende.getMonth() === new Date(vor10.getFullYear(), vor10.getMonth() + 2, vor10.getDate()).getMonth(),
    'E § 6 Abs. 1 Nr. 1a zaehlt ab Uebergang (Anschaffung)');
  /* kp 300.000, Gebaeude 60 %, NK 30.000 (GrESt 19.500) -> Gebaeude-AHK 198.000; 23.800 brutto = 20.000 netto */
  const r2 = F({ kaufdat: '2025-01-01', kp: '300000', geb_ant: '60', san: '23800', gest_e: '19500', notar_e: '6000', makler_e: '4500' });
  ok(nah(r2.san_quote, 20000 / 198000, 1e-6), 'E 15-%-Quote netto gegen Gebaeude-AHK mit NK: ' + (r2.san_quote * 100).toFixed(2) + ' % (soll 10,10 %)');
}

/* ── F · Backend objektRechnung: Ruecklagen ──────────────────────────── */
{
  const require_ = createRequire(import.meta.url);
  const origLoad = Module._load;
  Module._load = function (req) {
    if (/[\\/]db[\\/]pool(\.js)?$/.test(req) || req === '../db/pool' || req === './pool') return { query: async () => { throw new Error('keine DB'); } };
    if (!req.startsWith('.') && !req.startsWith('node:') && !Module.isBuiltin(req) && !path.isAbsolute(req)) {
      try { return origLoad.apply(this, arguments); } catch (e) {
        const leer = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : leer), apply: () => leer, construct: () => leer });
        return leer;
      }
    }
    return origLoad.apply(this, arguments);
  };
  const w = console.warn; console.warn = () => {};
  const OR = require_(path.join(ROOT, 'backend/src/services/objektRechnung.js'));
  console.warn = w; Module._load = origLoad;
  const ctx = lade();
  const kerne = { vorhanden: () => true, kpis: (e) => ctx.DealKpis.compute(e || {}), grestBasis: (a, b) => ctx.DealKpis.grestBasis(a, b),
    gebaeudeAhk: (e) => ctx.DealKpis.gebaeudeAhk(e || {}),
    score: () => ({ score: 0, breakdown: [] }), stufe: () => ({ wort: '' }) };   /* Score ist fuer die Steuer ohne Belang */
  const erg = { vorhanden: { d1z: '3', d1t: '2', gest_p: '6.5', notar_p: '1.5', gba_p: '0.5', makler_p: '0' }, vom_nutzer: {}, vorschlag: {}, fehlt: [] };
  const basis = { kp: '300000', nkm: '1000', d1: '250000', grenz: '42', geb_ant: '70', afa_satz: '2', hg_ul: '1200', hg_nul: '1800', _bwk_mode: 'detail' };
  const ohne = OR.rechnen(Object.assign({}, basis), { erg, kerne });
  const mit = OR.rechnen(Object.assign({}, basis, { eigen_r: '600', weg_r: '900' }), { erg, kerne });
  ok(ohne.K && mit.K, 'F objektRechnung rechnet beide Faelle');
  if (ohne.K && mit.K) {
    ok(nah(mit.K.steuer, ohne.K.steuer + 900 * 0.42, 0.01), 'F eigene Ruecklage (600) mindert die Steuer nicht, der WEG-Anteil im Hausgeld (900) faellt heraus: + 900 x 42 %: ' + mit.K.steuer.toFixed(2) + ' gegen ' + ohne.K.steuer.toFixed(2));
    ok(nah(mit.K.cf_op, ohne.K.cf_op - 600, 0.01), 'F Cashflow traegt die eigene Ruecklage voll (-600)');
  }
}

/* ── G · Texte und Tabellen ──────────────────────────────────────────── */
{
  const T = lade().Tax;
  const tip = js('tooltip-content.js');
  const m = tip.match(/bei zvE 30\.000 € rund (\d+) %, bei 60\.000 € rund (\d+) %/);
  ok(m && +m[1] === Math.round(T.calcGrenzsteuersatz(30000, 2026) * 100) && +m[2] === Math.round(T.calcGrenzsteuersatz(60000, 2026) * 100),
    'G Tooltip zvE: Grenzsatz-Beispiele = Tarif 2026 (' + (m ? m[1] + '/' + m[2] : 'nicht gefunden') + ')');
  ok(!/42% \(Höchstsatz\)/.test(tip), 'G Tooltip: 42 % ist der Spitzensteuersatz, nicht der Hoechstsatz');
  const pdf = fs.readFileSync(path.join(ROOT, 'frontend/js/werbungskosten-pdf.js'), 'utf8');
  ok(/var btr = \(v\.nk_umlf \|\| 0\) \+ v\.nk_n_umlf \+ v\.betr_sonst;/.test(pdf), 'G Werbungskosten-PDF: Spalte Betriebskosten enthaelt die umlagefaehigen Kosten (Summe nachrechenbar)');
  ok(!/Erhaltungsaufwand \(nach 3 Jahren\)/.test(pdf), 'G Werbungskosten-PDF: Erhaltungsaufwand nicht auf „nach 3 Jahren" beschraenkt');
  /* Landesgesetze (§ 11 Abs. 1 GrEStG i. V. m. Art. 105 Abs. 2a GG), Stand 11/2026 */
  const soll = { BW: 5.0, BY: 3.5, BE: 6.0, BB: 6.5, HB: 5.5, HH: 5.5, HE: 6.0, MV: 6.0, NI: 5.0, NW: 6.5, RP: 5.0, SL: 6.5, SN: 5.5, ST: 5.0, SH: 6.5, TH: 5.0 };
  const gr = js('grest-plz-lookup.js');
  const abw = Object.keys(soll).filter((k) => { const r = gr.match(new RegExp("'" + k + "': ([\\d.]+)")); return !r || +r[1] !== soll[k]; });
  ok(abw.length === 0, 'G Grunderwerbsteuersaetze 16 Laender: ' + (abw.length ? 'abweichend ' + abw.join(',') : 'gleich'));
  const nk = lade().DealKpis.nebenkosten({ kp: 300000, inventar: 10000, gest_p: 6.5, notar_p: 1.5 });
  ok(nk.grest === 18850 && nk.notar === 4500, 'G GrESt ohne Inventar (§ 9 GrEStG): 290.000 x 6,5 % = 18.850');
}

console.log('steuer-audit-pruefen: ' + gruen + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
