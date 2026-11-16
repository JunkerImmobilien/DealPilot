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
 *  H  v3400 BMF-Arbeitshilfe Stand Maerz 2026: Vorlage (Hash), Baupreisindex, Zellzuordnung gegen die
 *     Zeilenbeschriftung; --live: Anwendungsbeispiele I-III der Anleitung im Staging-Backend (LibreOffice)
 *  I  v3401 IRR privat: § 23-Steuer beim Verkauf in der Frist (frist23/paragraph23/steuer23)
 *  J  v3402 RND-Gutachten-Vorteil als Barwert der AfA-Verschiebung bis zum Verkauf
 *  G  Texte: Grenzsteuer-Beispiele im Tooltip gegen den Tarif, Werbungskosten-PDF-Matrix
 *     nachrechenbar, Grunderwerbsteuersaetze der Laender, GrESt ohne Inventar (§ 9 GrEStG)
 *
 * Aufruf: node tools/steuer-audit-pruefen.mjs [--live]   (RC=0 sauber) */
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

/* ── H · v3400 BMF-Arbeitshilfe Kaufpreisaufteilung, Stand Maerz 2026 ──
   Quelle: bundesfinanzministerium.de, Datenportal „Kaufpreisaufteilung-Grundstuecke", aktualisiert
   16.03.2026 („Arbeitshilfe und Anleitung mit Stand vom Maerz 2026"), Kopie unter
   Dateien/BMF-Arbeitshilfe/2026-03/. Die Vorlage ist der Rechenkern (bmfService.js schreibt die
   Eingaben hinein, LibreOffice rechnet). Hier ohne LibreOffice: ist die richtige Vorlage verdrahtet,
   stehen ihre Tabellen auf dem neuen Stand, zeigen die Zellen der Map auf die richtigen Zeilen?
   Mit --live zusaetzlich die drei amtlichen Anwendungsbeispiele der Anleitung (S. 5-12) im
   Staging-Backend durch die echte Strecke (calculateKpa, LibreOffice). */
function xlsxLesen(datei) {
  const zlib = createRequire(import.meta.url)('node:zlib');
  const b = fs.readFileSync(datei);
  let eocd = b.length - 22; while (eocd > 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const n = b.readUInt16LE(eocd + 10); let p = b.readUInt32LE(eocd + 16); const teile = {};
  for (let k = 0; k < n; k++) {
    const meth = b.readUInt16LE(p + 10), csz = b.readUInt32LE(p + 20), fnl = b.readUInt16LE(p + 28),
      exl = b.readUInt16LE(p + 30), cml = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + fnl).toString('utf8');
    const lfn = b.readUInt16LE(off + 26), lex = b.readUInt16LE(off + 28);
    const roh = b.slice(off + 30 + lfn + lex, off + 30 + lfn + lex + csz);
    teile[name] = (meth === 8 ? zlib.inflateRawSync(roh) : roh).toString('utf8');
    p += 46 + fnl + exl + cml;
  }
  const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const ss = [...(teile['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const rels = {};
  for (const m of (teile['xl/_rels/workbook.xml.rels'] || '').matchAll(/<Relationship ([^>]*)\/?>/g)) {
    const id = (m[1].match(/Id="([^"]+)"/) || [])[1], t = (m[1].match(/Target="([^"]+)"/) || [])[1];
    if (id) rels[id] = t;
  }
  const blaetter = {};
  for (const m of teile['xl/workbook.xml'].matchAll(/<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const x = teile['xl/' + rels[m[2]].replace(/^\/?xl\//, '')] || ''; const z = {};
    for (const c of x.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = (c[2].match(/t="([^"]+)"/) || [])[1], inner = c[3] || '';
      const f = (inner.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1];
      let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (v != null) v = (t === 's') ? ss[+v] : (t === 'str' || t === 'e' || isNaN(+v)) ? dec(v) : +v;
      z[c[1]] = { v, f: f != null ? dec(f) : null };
    }
    blaetter[dec(m[1])] = z;
  }
  return blaetter;
}
{
  const require_ = createRequire(import.meta.url);
  const quelle = fs.readFileSync(path.join(ROOT, 'backend/src/services/bmfService.js'), 'utf8');
  const vorlage = (quelle.match(/templates', '([^']+\.xlsx)'/) || [])[1];
  ok(vorlage === 'BMF_Arbeitshilfe_2026-03.xlsx', 'H bmfService rechnet mit der Vorlage Stand Maerz 2026 (' + vorlage + ')');
  const datei = path.join(ROOT, 'backend/templates', vorlage || '-');
  const hash = fs.existsSync(datei) ? require_('node:crypto').createHash('sha256').update(fs.readFileSync(datei)).digest('hex') : null;
  /* SHA-256 der am 15.11.2026 geladenen BMF-Datei (…-Arbeitshilfe-Berechnung.xlsx?__blob=publicationFile&v=9) */
  ok(hash === '2a0f2b8be17cb605ca9e1d2e8fea072904b5a19d3692e8c23f2716ca1055ccd8', 'H Vorlage ist die BMF-Datei vom 16.03.2026, unveraendert');
  ok(/TEMPLATE_VERSION = 'Stand März 2026'/.test(quelle), 'H Fassungsangabe der Antwort: Stand Maerz 2026');
  if (hash) {
    const X = xlsxLesen(datei);
    const kpa = X['KPA'], bi = X['SW-Bau-Index'], nhk = X['SW-NHK'];
    ok(kpa && kpa.K2 && kpa.K2.v === '30.09.2027', 'H Verfalldatum der Vorlage KPA!K2 = 30.09.2027 (' + (kpa && kpa.K2 && kpa.K2.v) + ')');
    /* Baupreisindex Wohngebaeude, 2010 = 100 (Anleitung S. 11: „Index fuer Wohngebaeude 2025: 189,1") */
    const idx = {};
    for (const [ref, c] of Object.entries(bi)) {
      const m = ref.match(/^A(\d+)$/);
      if (m && typeof c.v === 'number') { const f = bi['F' + m[1]]; idx[c.v] = f && f.v; }
    }
    ok(idx[2022] === 164 && idx[2023] === 177.9 && idx[2024] === 183.3 && idx[2025] === 189.1 && idx[2026] === 189.1,
      'H Baupreisindex 2022/2023/2024/2025/2026 = 164 / 177,9 / 183,3 / 189,1 / 189,1 (' + [2022, 2023, 2024, 2025, 2026].map((j) => idx[j]).join(' / ') + ')');
    ok(nhk && nhk.F82 && /'Fiktives Baujahr'!D18/.test(nhk.F82.f || ''), 'H RND der Vorlage beruecksichtigt eine nachgewiesene RND (SW-NHK!F82 liest Fiktives Baujahr!D18)');
    /* die Map gegen die Beschriftung der Zeile - eine verrutschte Zeile schreibt in ein fremdes Feld */
    const map = {};
    for (const m of quelle.matchAll(/^\s+(\w+):\s+\{ sheet: '([^']+)', cell: '([A-Z]+)(\d+)'/gm)) map[m[1]] = { blatt: m[2], sp: m[3], z: +m[4] };
    const lbl = (b, z, sp) => { const c = (X[b] || {})[(sp || 'C') + z] || {}; return String(c.v || c.f || ''); };   /* Formelbeschriftung (KPA!D11) zaehlt mit */
    const soll = { mod_dach: /Dacherneuerung/, mod_fenster: /Fenster/, mod_leitungen: /Leitungssysteme/, mod_heizung: /Heizungsanlage/,
      mod_waermedaemmung: /Wärmedämmung der Außenwände/, mod_baeder: /Bädern/, mod_innenausbau: /Innenausbaus/, mod_grundriss: /Grundrissgestaltung/,
      rnd_gutachten_vorhanden: /Gutachten/, rnd_gutachten_jahre: /Restnutzungsdauer \(RND\) gemäß des Gutachtens/,
      fiktives_baujahr: /^Fiktives Baujahr/, modernisierungsgrad: /^Modernisierungsgrad/ };
    const falsch = Object.keys(soll).filter((k) => !map[k] || map[k].blatt !== 'Fiktives Baujahr' || !soll[k].test(lbl('Fiktives Baujahr', map[k].z)));
    ok(falsch.length === 0, 'H Zellen auf „Fiktives Baujahr" passen zur Beschriftung der Zeile (Modernisierung D22-D29, RND D16/D17, Ausgabe D52/D54)' + (falsch.length ? ': ' + falsch.join(', ') : ''));
    const kpaSoll = { bodenwert: [59, /^Bodenwert/], sachwert_vorlaeufig: [72, /vorläufiger Sachwert/], ertragswert: [101, /vorläufiger Ertragswert/],
      vergleichswert: [112, /Vergleichswert/], gebaeudeanteil_prozent: [116, /Wertanteil/], kaufpreisanteil_grund: [120, /Grund und Boden/],
      kaufpreisanteil_gebaeude: [121, /baulichen Anlagen/] };
    const kf = Object.keys(kpaSoll).filter((k) => !map[k] || map[k].z !== kpaSoll[k][0] || !kpaSoll[k][1].test(lbl('KPA', map[k].z, 'D')));
    ok(kf.length === 0, 'H Ergebniszellen auf KPA passen zur Beschriftung' + (kf.length ? ': ' + kf.join(', ') : ''));
    const eing = { kaufdatum: ['G9', 9, /Datum des Kaufvertrages/], baujahr: ['G11', 11, /Baujahr/], grundstuecksgroesse: ['G17', 17, /Grundstücksgröße/],
      miete_monatlich: ['G40', 40, /Nettokaltmiete/], regionalfaktor: ['G47', 47, /Regionalfaktor/] };
    const ef = Object.keys(eing).filter((k) => !map[k] || (map[k].sp + map[k].z) !== eing[k][0] || !eing[k][2].test(lbl('KPA', eing[k][1], 'D')));
    ok(ef.length === 0, 'H Eingabezellen auf KPA passen zur Beschriftung' + (ef.length ? ': ' + ef.join(', ') : ''));
    ok(!/BMF_Vorlage_Juni2023/.test(quelle), 'H keine Restverdrahtung auf die Fassung Juni 2023');
  }
  const reste = ['bmf-bodenabschlag.js', 'bmf-modal.js', 'bmf-modal-html.html', 'bmf-wahl.js', 'deal-action-boarding.js', 'help.js', 'pdf-anlage-bmf.js']
    .filter((f) => /Juni 2023/.test(js(f)));
  ok(reste.length === 0, 'H Kundentexte nennen nicht mehr die Fassung Juni 2023' + (reste.length ? ': ' + reste.join(', ') : ''));
}

/* ── I · v3401 IRR des privaten Exits mit § 23 EStG ─────────────────────
   Verkauf rechnerisch am 31.12. des Jahres Basisjahr + btj − 1. Frist zehn Jahre ab Kaufvertrag
   (§ 23 Abs. 1 Satz 1 Nr. 1 EStG), Gewinn = Preis − (AK − AfA) (§ 23 Abs. 3 Satz 4), Freigrenze
   1.000 € (§ 23 Abs. 3 Satz 5). Dieselben Kernfunktionen, die calc.js aufruft. */
{
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(js('ueberfuehrung-kern.js'), ctx);
  const K = ctx.DealPilotUeberfuehrungKern;
  const p23 = (kauf, btj, preis, ak, afa) => K.paragraph23({ kaufdat: kauf, stichtag: (2026 + btj - 1) + '-12-31', art: 'kauf',
    kaufpreis: preis, verkehrswert: preis, akPrivat: ak, afaBisher: afa, werbungskosten: 0 });
  const a = p23('2026-06-01', 10, 380000, 330000, 60000);
  ok(a.frist.art === 'steuerpflichtig' && a.gewinn === 110000 && a.steuerpflichtig, 'I Kauf 01.06.2026, btj 10: Verkauf 31.12.2035 in der Frist, Gewinn 380.000 − (330.000 − 60.000) = 110.000 (' + a.gewinn + ')');
  ok(p23('2026-06-01', 11, 380000, 330000, 66000).steuerfrei === true, 'I btj 11: Verkauf 31.12.2036 nach Fristende 01.06.2036 steuerfrei');
  ok(p23('2026-01-01', 10, 380000, 330000, 60000).frist.art === 'steuerpflichtig', 'I ohne Kaufdatum (01.01. des Basisjahres): btj 10 steuerpflichtig, die Frist endet erst am 01.01.2036');
  ok(p23('2026-03-01', 5, 300500, 330000, 30000).unterFreigrenze === true, 'I Gewinn 500 € unter der Freigrenze 1.000 € bleibt steuerfrei');
  const T = lade().Tax;
  const st = K.steuer23(110000, { steuerLast: (z) => T.steuerLast(z, 2035).gesamt, zve: 60000, grenzPct: 42 });
  const soll = T.steuerLast(170000, 2035).gesamt - T.steuerLast(60000, 2035).gesamt;
  ok(nah(st.betrag, Math.round(soll * 100) / 100, 0.01), 'I Steuer auf den Gewinn = Last mit und ohne Gewinn beim zvE (' + st.betrag + ')');
  const calc = js('calc.js');
  ok(/_gesK\.paragraph23\(/.test(calc) && /_exitErloes -= _st23\.betrag/.test(calc) && /if \(!_mandParams && _gesK/.test(calc),
    'I calc.js zieht die § 23-Steuer im privaten Exit vom Erloes ab (nur ohne Gesellschaft, die rechnet KSt)');
  ok(!/10 Jahre = Spekulationsfrist nach § 23 EStG \(steuerfreier Verkauf möglich\)/.test(js('tooltip-content.js')), 'I Hilfetext Betrachtungszeitraum: 10 Jahre heisst nicht mehr „steuerfrei"');
}

/* ── J · v3402 RND-Gutachten: Vorteil als Barwert der AfA-Verschiebung ──
   Beispiel des Audits (Abschnitt 7): Gebaeude 300.000 €, RND 25, Standard 2 %, 42 %, 3 % Abzins.
   Die AfA-Summe bleibt die AHK, der Vorteil ist nur der Zinseffekt bis zum Verkauf. */
{
  const ctx = { console: { log() {}, warn() {} }, Math, JSON, Number, String, Object, Array, Date, isFinite, parseFloat, parseInt };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(js('rnd-calc.js'), ctx);
  const R = ctx.DealPilotRND;
  const b = { gebaeudeanteil: 300000, rnd: 25, grenzsteuersatz: 0.42, standardAfaSatz: 0.02, gutachterkosten: 999, abzinsung: 0.03 };
  const v = (x) => R.calcAfaVergleich(Object.assign({}, b, x));
  const dauer = v({}), frei10 = v({ haltedauer: 10, verkaufSteuerpflichtig: false }), pfl10 = v({ haltedauer: 10 });
  ok(nah(dauer.steuerersparnis_barwert, 22923.26, 0.01) && dauer.haltedauer === 50, 'J Halten auf Dauer: Barwert der Verschiebung 22.923,26 € (' + dauer.steuerersparnis_barwert + ', bis v3401 ' + dauer.barwert_rente_rnd_alt + ')');
  ok(nah(frei10.steuerersparnis_barwert, 21496.11, 0.01), 'J steuerfreier Verkauf nach 10 Jahren: 21.496,11 € (' + frei10.steuerersparnis_barwert + ')');
  ok(pfl10.verkauf_steuerpflichtig && pfl10.steuerersparnis_barwert < frei10.steuerersparnis_barwert && pfl10.rueckholung_23 > 0,
    'J Verkauf in der Frist: die Mehr-AfA kommt als § 23-Gewinn zurueck (' + pfl10.steuerersparnis_barwert + ', Rueckholung ' + pfl10.rueckholung_23 + ')');
  const ohneZins = v({ abzinsung: 1e-9 });
  ok(Math.abs(ohneZins.steuerersparnis_barwert) < 1, 'J ohne Zins kein Vorteil bei Halten auf Dauer (AfA-Summe gleich): ' + ohneZins.steuerersparnis_barwert);
  ok(dauer.steuerersparnis_jahr === 2520, 'J Steuerersparnis im ersten Jahr unveraendert (6.000 × 42 % = 2.520)');
  const spiegel = fs.readFileSync(path.join(ROOT, 'backend/src/generated/rechenkerne/rnd-calc.js'), 'utf8').replace(/\r\n/g, '\n');
  ok(spiegel === js('rnd-calc.js').replace(/\r\n/g, '\n'), 'J Backend-Spiegel rnd-calc.js gleich dem Frontend (rechenkerne-spiegeln)');
}

/* ── H live · Anwendungsbeispiele der Anleitung durch die echte Strecke ── */
if (process.argv.includes('--live')) {
  const { execFileSync } = createRequire(import.meta.url)('node:child_process');
  const FAELLE = [
    /* Anleitung Anhang I, S. 5-6 (Vergleichswert) */
    ['I Vergleichswert', { lage: 'Musterstr. 1', grundstuecksart: 'Wohnungseigentum [WE]', kaufdatum: '2025-02-01', kaufpreis: 220000, baujahr: 2000,
      wohnflaeche: 90, mea_zaehler: 1, mea_nenner: 8, grundstuecksgroesse: 1200, bodenrichtwert: 550, vergleichsfaktor_vorhanden: 'Ja',
      bezugsmassstab: 'Wohn- bzw. Nutzfläche', vergleichsfaktor: 2450, miete_bekannt: 'Nein' }, 62.59, 82302, 137698, 0],
    /* Anhang II, S. 6-9 (Ertragswert) */
    ['II Ertragswert', { lage: 'Musterstr. 1', grundstuecksart: 'Mietwohngrundstücke (Mehrfamilienhäuser)', kaufdatum: '2025-02-01', kaufpreis: 1100000,
      baujahr: 1981, wohnflaeche: 800, grundstuecksgroesse: 1000, bodenrichtwert: 380, vergleichsfaktor_vorhanden: 'Nein', miete_bekannt: 'Ja',
      miete_monatlich: 5000, wohneinheiten: 9 }, 62.4, 413600, 686400, 0],
    /* Anhang III, S. 9-12 (Sachwert). Excel rundet 835 × 2,3 = 1.920,5 auf 1.921, LibreOffice den
       Gleitkommawert 1.920,4999… auf 1.920 - daher 75,51 statt 75,52 % und 55 € Versatz. */
    ['III Sachwert', { lage: 'Musterstr. 1', grundstuecksart: '[EFH] freistehend, KG, EG, DG voll ausgebaut', kaufdatum: '2025-05-02', kaufpreis: 550000,
      baujahr: 2002, wohnflaeche: 140, grundstuecksgroesse: 500, bodenrichtwert: 250, grundstuecksgroesse2: 200, bodenrichtwert2: 63,
      vergleichsfaktor_vorhanden: 'Nein', miete_bekannt: 'Nein', regionalfaktor: 1, sachwertfaktor: 1.1 }, 75.52, 134640, 415360, 0.011],
  ];
  const skript = "const s=require('/app/src/services/bmfService.js');(async()=>{const F=" + JSON.stringify(FAELLE.map((f) => f[1]))
    + ";const o=[];for(const e of F){const r=await s.calculateKpa(e,{includeFile:false});const g=(k)=>r.results&&r.results[k]&&r.results[k].value;"
    + "o.push({p:g('gebaeudeanteil_prozent'),b:g('kaufpreisanteil_grund'),h:g('kaufpreisanteil_gebaeude'),v:r.meta&&r.meta.template_version})}console.log(JSON.stringify(o))})()";
  let roh = null;
  try {
    roh = execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@116.203.214.11', 'docker exec -i dealpilot-backend node -'], { input: skript, encoding: 'utf8', timeout: 240000 });
  } catch (e) { ok(false, 'H live: Staging-Backend nicht erreichbar (' + e.message.split('\n')[0] + ')'); }
  if (roh) {
    const erg = JSON.parse(roh.trim().split('\n').pop());
    FAELLE.forEach((f, k) => {
      const r = erg[k] || {};
      ok(r.v === 'Stand März 2026' && nah(r.p, f[2], f[5] + 1e-9) && Math.abs(r.b - f[3]) <= (f[5] ? 60 : 0.5) && Math.abs(r.h - f[4]) <= (f[5] ? 60 : 0.5),
        'H live Anleitung ' + f[0] + ': Gebaeudeanteil ' + r.p + ' % (Soll ' + f[2] + '), Grund ' + r.b + ' (Soll ' + f[3] + '), Gebaeude ' + r.h + ' (Soll ' + f[4] + '), ' + r.v);
    });
  }
}

/* ── K · v3480 Warnung „Fertigstellung vor 1925 mit 2,0 % statt 2,5 %" (Marcel 16.11.2026, Kanzlei N-05) ──
   § 7 Abs. 4 Satz 1 Nr. 2 Buchst. c EStG: fertiggestellt vor dem 01.01.1925 -> 2,5 %. Warnung, keine
   Korrektur; kein Fehlalarm bei eigenem Satz (§ 7 Abs. 4 Satz 2), anderem Satz, degressiv, ohne Baujahr. */
{
  const A = lade().Afa;
  const P = (p) => A.pruefeSatzFertigstellung(p);
  ok(P({ baujahr: 1908, afaSatz: '2.0' }).warnen === true, 'K Bj 1908, 2,0 % -> Warnung (Bismarckstr. 27)');
  ok(P({ baujahr: '1924', afaSatz: '2,0' }).warnen === true, 'K Bj 1924 (Text), 2,0 % mit Komma -> Warnung');
  ok(P({ baujahr: 1925, afaSatz: '2.0' }).warnen === false, 'K Bj 1925, 2,0 % -> keine Warnung (Buchst. b)');
  ok(P({ baujahr: 1908, afaSatz: '2.5' }).warnen === false, 'K Bj 1908, 2,5 % -> keine Warnung');
  ok(P({ baujahr: 1908, afaSatz: '2.0', eigen: true }).warnen === false, 'K eigener Satz (Gutachten, § 7 Abs. 4 Satz 2) -> kein Fehlalarm');
  ok(P({ baujahr: 1908, afaSatz: '2.94' }).warnen === false, 'K eigener Satz 2,94 % (RND 34) -> kein Fehlalarm');
  ok(P({ baujahr: 1908, afaSatz: '5.0_deg_wechsel' }).warnen === false && P({ baujahr: 1908, afaSatz: '3.0' }).warnen === false, 'K degressiv / 3 % -> keine Warnung dieser Art');
  ok(P({ baujahr: '', afaSatz: '2.0' }).warnen === false && P({ baujahr: 1908, afaSatz: '' }).warnen === false, 'K ohne Baujahr oder ohne Satz -> still');
  const w = P({ baujahr: 1908, afaSatz: '2.0', basis: 400000, gesellschaft: true });
  ok(w.soll === 2.5 && w.mehrJahr === 2000 && /Buchst\. c/.test(w.text) && /Betriebsvermögen/.test(w.text) && /§ 7 Abs\. 4 Satz 2/.test(w.text),
    'K Wortlaut: Buchst. c, 0,5 % von 400.000 = 2.000 EUR mehr, GmbH-Satz, Weg Gutachten');
  ok(!/Betriebsvermögen/.test(P({ baujahr: 1908, afaSatz: '2.0' }).text), 'K privat: kein Satz zum Betriebsvermoegen');
  /* Die Gesellschaft setzt selbst 2,5 % (ueberfuehrung-kern) - dort entsteht keine Warnung */
  const c2 = { console: { log() {} }, window: {} }; c2.window = c2; vm.createContext(c2); vm.runInContext(js('ueberfuehrung-kern.js'), c2);
  const gs = c2.DealPilotUeberfuehrungKern.afaSatzGesellschaft({ baujahr: 1908, wohnzwecke: true });
  ok(gs.satzPct === 2.5 && P({ baujahr: 1908, afaSatz: gs.satzPct.toFixed(1) }).warnen === false, 'K Ueberfuehrung: Gesellschaft schreibt 1908 mit 2,5 % ab, keine Warnung');
  /* Verdrahtung: alle Anzeigestellen lesen DIESELBE Regel */
  const ui = js('afa-ui.js'), dok = js('dp-dokumente.js'), uw = js('ueberfuehrung-wizard.js');
  ok(/Afa\.pruefeSatzFertigstellung/.test(ui) && /data-eigen/.test(ui) && /afaCheck1925\(\); \} catch \(e\) \{\}   \/\* v3480 · vor dem Ausblende/.test(ui),
    'K Steuer-Reiter (afa-ui.js): Regel aus afa-engine, eigener Satz erkannt, Pruefung vor dem Ausblende-Ausstieg');
  ok((dok.match(/afa1925\(B,/g) || []).length >= 3 && /Afa\.pruefeSatzFertigstellung/.test(dok), 'K Dokumente: Steuer-Mappe, Werbungskosten, Kaufpreisaufteilung zeigen den Hinweis');
  ok(/Afa\.pruefeSatzFertigstellung/.test(uw) && /§ 23 Abs\. 3 Satz 4/.test(uw), 'K Ueberfuehrung: Hinweis mit tatsaechlich abgezogener AfA (§ 23 Abs. 3 Satz 4)');
  const idx = fs.readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8');
  ok(idx.indexOf('js/afa-engine.js') >= 0 && idx.indexOf('js/afa-engine.js') < idx.indexOf('js/afa-ui.js'), 'K index.html laedt afa-engine.js vor afa-ui.js');
}

/* ── L · v3480 Steuer-PDFs: Kundentext, Veranlagung, Gesellschaft ohne „Erstattung" ── */
{
  const av = js('anlage-v-2025.js'), dok = js('dp-dokumente.js'), dw = js('dok-weiche.js');
  const ne = ((av.match(/nicht_erfasst:\s*\[([\s\S]*?)\n  \]/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, '');   /* nur Kundentext, ohne Kommentare */
  ok(ne && !/tax_records|afa_linear|afa_sonder_7b|v\d{3,4}|`/.test(ne), 'L Anlage V „nicht erfasst": keine internen Begriffe (tax_records, Feldnamen, Versionsnummern)');
  ok(/function veranlagung\(jahr\)/.test(dok) && (dok.match(/veranlagung\(/g) || []).length >= 4, 'L Veranlagungsart in Werbungskosten-PDF und Steuer-Mappe');
  ok(/function steuerZeileGes/.test(dok) && !/'Ertragsteuer der Gesellschaft auf dieses Objekt \(Belastung −\)'/.test(dok), 'L Gesellschaft: Ertragsteuer je Objekt ohne „Erstattung" bei Verlust');
  /* steuerZeileGes am echten Code: Verlust -> 0 EUR, nie „+“ */
  const ctx = { window: {}, console: { log() {} } }; ctx.window = ctx; ctx.document = { getElementById: () => null };
  vm.createContext(ctx); vm.runInContext(js('dp-dokument.js'), ctx);
  const f = dok.match(/function steuerZeileGes\(B, steuer, ergebnis\) \{[\s\S]*?\n  \}/);
  const z = f ? vm.runInContext('(' + f[0].replace('function steuerZeileGes', 'function') + ')', ctx) : null;
  const zv = z ? z(ctx.DpDokument, -1234, -5000) : null, zg = z ? z(ctx.DpDokument, 800, 5000) : null;
  ok(zv && zv[1] === '0 €' && /keine Erstattung/.test(zv[2].det) && /§ 10d EStG/.test(zv[2].det), 'L Verlust 5.000 / Steuer −1.234: 0 €, „keine Erstattung", Verlustvortrag');
  ok(zg && /^−800 €$/.test(zg[1]), 'L Gewinn: Ertragsteuer −800 € als Belastung');
  ok(/huelle\('exportAbschlussPDF'/.test(dw) && /huelle\('generateBmfPdfAnlage'/.test(dw) && /jahresabschluss: jahresabschluss/.test(dok), 'L Weiche: Jahresabschluss und BMF-Anlage im einheitlichen Dokument');
}

/* ── M · v3481 Kaufpreisaufteilung: Vertragstext, Restnutzungsdauer je Objekt, Fassung, § 199 BewG ── */
{
  const ba = js('bmf-bodenabschlag.js'), bm = js('bmf-modal.js'), dok = js('dp-dokumente.js'), kpa = js('pdf-kaufpreisaufteilung.js');
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/Abschlag von ' \+ pct\(W\.ab, 0\) \+ ' auf den Bodenwert ermittelt/.test(code(ba)), 'M Vertragstext ohne „… mit einem Abschlag von x % auf den Bodenwert ermittelt" (Marcel: „Quatsch")');
  ok(!/§ 199 BewG/.test(code(ba)) && !/§ 199 BewG/.test(code(bm)), 'M kein Verweis auf § 199 BewG (vereinfachtes Ertragswertverfahren, passt nicht)');
  ok(/rnd = rndDiesesObjekts\(\);\s*\n\s*if \(rnd\) P\.push\(/.test(ba) && /_obj = window\._currentObjKey/.test(ba) && /_lastRndResult\._obj/.test(kpa), 'M Punkt 4 „Restnutzungsdauer ermittelt" nur mit RND dieses Objekts (beide PDF-Wege)');
  ok(/_vorlage = \(data\.meta && data\.meta\.template_version\)/.test(bm) && /_lastBmfResults\._vorlage/.test(ba), 'M Fassung der Arbeitshilfe aus der verwendeten Vorlage');
  ok(/Abschreibung je Aufteilung/.test(dok) && /linearNachFertigstellung\(o\.bj\)\) \|\| \{ satz: 2 \}/.test(dok), 'M neues PDF: Abschreibung je Aufteilung mit Spanne, Pauschale nach Fertigstellung');
}

/* ── N · v3510 Garagen und Wohneinheiten erreichen BEIDE Laeufe der Arbeitshilfe ──
   v3345 hat KPA G13 (Garagen) und G42 (Wohneinheiten) in runBmf (/bmf/aufteilung) verdrahtet, die
   Pipeline (/bmf/pipeline: Reiter 3/4, Varianten, Vertragstext) blieb ohne. Messung 16.11.2026 am
   echten Kern, MFH Andersenweg (Bj 1973, 339,91 m2, 1.232 m2 x 135, Miete 2.329, Kauf 12.11.2026):
   Juni 2023 mit 6 WE + 6 Garagen 57,61 % / Ertragswert 392.339 (= PDF 12.11. und Gutachten-Kontrolle),
   ohne beide 60,27 %; Maerz 2026 58,45 % / 400.280 gegen 61,25 % / 429.147. --live rechnet den Fall
   durch calculateKpa UND runPipeline im Staging-Container. */
{
  const pip = fs.readFileSync(path.join(ROOT, 'backend/src/services/bmfPipelineService.js'), 'utf8');
  const v292 = js('bmf-modal-v292.js'), bm = js('bmf-modal.js');
  ok(/garagen: parseInt\(objekt\.garagen, 10\)/.test(pip) && /\{ wohneinheiten: n \}/.test(pip), 'N Pipeline (_phase4_bmf) gibt Garagen und Wohneinheiten an die Arbeitshilfe');
  const idx0 = fs.readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8');
  ok(v292.length > 40000 && /window\._v292CollectInputs = function\(\)\{/.test(v292) && /js\/bmf-modal-v292\.js\?v=/.test(idx0) && !/bmf-pipeline-ergaenzung/.test(idx0) && !fs.existsSync(path.join(ROOT, 'frontend/js/bmf-pipeline-ergaenzung.js')),
    'N bmf-modal-v292.js vorhanden und geladen, keine Huelle mehr (v3512, Freigabe Marcel)');
  {
    /* Sammelfunktion am echten Code: DOM-Attrappe, liefert garagen/einheiten/kpa_kosten_e */
    const dom = { garagen: '6', einheiten: '6', kpa_kosten: '549,00', kpa_kosten_art: 'ank', kp: '390.000', wfl: '339,91', baujahr: '1973', plz: '32429', ort: 'Minden', str: 'Andersenweg', hnr: '3' };
    const leer = { value: '', checked: false, textContent: '', style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {}, setAttribute() {} };
    const doc = { getElementById: (id) => (id in dom ? Object.assign({}, leer, { value: dom[id] }) : null), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => Object.assign({}, leer), body: Object.assign({}, leer), readyState: 'complete' };
    const ctx = { document: doc, console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, fetch: () => new Promise(() => {}), localStorage: { getItem: () => null, setItem() {} } };
    ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(js('kpa-kosten.js'), ctx);
    let r1 = null;
    try { vm.runInContext(v292, ctx); r1 = ctx._v292CollectInputs().phase1_inputs; } catch (e) { r1 = { fehler: e.message }; }
    ok(r1 && r1.objekt && r1.objekt.garagen === 6 && r1.objekt.einheiten === 6 && r1.investition.kpa_kosten_e === 549,
      'N Sammelfunktion (bmf-modal-v292.js) liefert Garagen 6, Einheiten 6, KPA-Kosten 549' + (r1 && r1.fehler ? ' (' + r1.fehler + ')' : ''));
    dom.kpa_kosten_art = 'sofort';
    ok(ctx._v292CollectInputs().phase1_inputs.investition.kpa_kosten_e === 0, 'N „sofort abziehbar": KPA-Kosten nicht in die Pipeline-Nebenkosten');
    dom.kpa_kosten_art = '';
    const k = ctx.DpKpaKosten();
    ok(k.ank === 549 && k.sofort === 0 && k.art === 'ank', 'N ohne Einordnung gilt „Anschaffungsnebenkosten" (Vorgabe, Marcel 16.11.)');
  }
  ok((bm.match(/garagen: \(parseInt/g) || []).length >= 2 && (bm.match(/wohneinheiten: \(function/g) || []).length >= 2, 'N runBmf und XLSX-Lauf (bmf-modal.js) schicken beide Felder (v3345)');
  const rx = /Mietwohngrundst\|gemischt genutzt\/\.test\(art\) && !\/\^Teileigentum\/\.test\(art\)/;
  ok(rx.test(pip) && rx.test(bm), 'N Wohneinheiten in Pipeline und runBmf nach derselben Regel (nur MFH / gemischt, nie Teileigentum)');
  /* v3510 · Kosten der Kaufpreisaufteilung (#kpa_kosten): gespeichert, in beiden PDFs gesondert, nie in der AfA-Basis */
  const idxN = fs.readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8'), sto = js('storage.js'), dokN = js('dp-dokumente.js'), kpaN = js('pdf-kaufpreisaufteilung.js');
  ok(/id="kpa_kosten"/.test(idxN) && /id="kpa_kosten_art"[\s\S]{0,80}<option value="ank" selected>/.test(idxN) && /'kpa_kosten','kpa_kosten_art'/.test(sto.slice(sto.indexOf('var FIELDS'), sto.indexOf('var FIELDS') + 20000)), 'N Felder kpa_kosten und kpa_kosten_art (Vorgabe Anschaffungsnebenkosten) im Formular und in FIELDS');
  ok(/DpKpaKosten\.TEXT_ANK/.test(dokN) && /DpKpaKosten\.TEXT_ANK/.test(kpaN) && /KPA\.sofort > 0\.005/.test(kpaN) && /kpaO\.sofort > 0/.test(dokN), 'N beide KPA-PDFs: Zeile unter den Anschaffungsnebenkosten, „gesondert" nur bei sofort abziehbar');
  ok(!/Kosten, die erst die Abschreibung ermitteln, stehen gesondert und sind sofort abziehbar\.'\);/.test(kpaN), 'N PDF-Satz zur Einordnung ohne Widerspruch (gesondert nur, wenn sofort abziehbar)');
  ok(/if \(!\$\('bmf_art'\)\) \{ try \{ console\.warn\('\[bmf\] runBmf ohne Fenster/.test(bm) && bm.indexOf("if (!$('bmf_art'))") < bm.indexOf('var _fehlt = '), 'N runBmf rechnet nicht ohne Fenster (Grundstuecksart und Miete stehen nur dort)');
  const calcN = js('calc.js'), taxN = js('tax.js'), orN = fs.readFileSync(path.join(ROOT, 'backend/src/services/objektRechnung.js'), 'utf8');
  ok(/return immoKp \+ nk \+ nkWeitere \+ kpaAnk;/.test(bm) && /total \+= DpKpaKosten\(\)\.ank/.test(bm), 'N runBmf und Summe Anschaffungskosten (calcAk) nehmen die KPA-Kosten als Nebenkosten');
  ok(/nk \+= DpKpaKosten\(\)\.ank/.test(js('bmf-bodenabschlag.js')) && /const nk_gesamt = grest \+ notar \+ gba \+ makler \+ ji_sonst \+ kpa;/.test(pip), 'N Reiter 5 und Pipeline (Phase 3) ebenso');
  ok(/nkGesamt \+= _kpaAnk;/.test(calcN) && /kpa_kosten_art === 'sofort' \? 0 : \(z\(d\.kpa_kosten\)/.test(orN), 'N AfA-Basis Steuer-Reiter (calc.js) und Backend objektRechnung mit KPA-Kosten');
  ok(/var k = DpKpaKosten\(\); if \(!\(k\.sofort > 0\)\) return 0;/.test(taxN), 'N „sofort abziehbar": Werbungskosten im Kaufjahr (tax.js verw_sonst)');
  if (process.argv.includes('--live')) {
    const { execFileSync } = createRequire(import.meta.url)('node:child_process');
    const fall = { lage: 'Andersenweg 3, 32429 Minden', grundstuecksart: 'Mietwohngrundstücke (Mehrfamilienhäuser)', kaufdatum: '2026-11-12',
      kaufpreis: 419406, baujahr: 1973, wohnflaeche: 339.91, mea_zaehler: 1000, mea_nenner: 1000, grundstuecksgroesse: 1232, bodenrichtwert: 135,
      miete_bekannt: 'Ja', miete_monatlich: 2329, sachwertfaktor: 1, regionalfaktor: 1, vergleichsfaktor_vorhanden: 'Nein', garagen: 6, wohneinheiten: 6 };
    const pipe = { objekt: { str: 'Andersenweg', hnr: '3', plz: '32429', ort: 'Minden', objart_bmf: fall.grundstuecksart, wfl: 339.91, baujahr: 1973,
      gsfl: 1232, brw: 135, garagen: 6, einheiten: 6 }, investition: { kaufdat: '2026-11-12', kp_brutto: 390000, gest_e: 25350, notar_e: 2886, gba_e: 1170, kpa_kosten_e: 549 },
      inventar: {}, renovierung: {}, miete: { nkm: 2329 }, gaa: {} };
    const skript = "const s=require('/app/src/services/bmfService.js'),p=require('/app/src/services/bmfPipelineService.js');(async()=>{"
      + "const r=await s.calculateKpa(" + JSON.stringify(fall) + ",{includeFile:false});const q=await p.runPipeline(" + JSON.stringify(pipe) + ");"
      + "console.log(JSON.stringify({p:r.results.gebaeudeanteil_prozent.value,e:r.results.ertragswert.value,q:q.phase4_bmf&&q.phase4_bmf.gebaeudeanteil_prozent,ak:q.phase3_prognose_ak&&q.phase3_prognose_ak.prognose_ak}))})()";
    let roh = null;
    try { roh = execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@116.203.214.11', 'docker exec -i dealpilot-backend node -'], { input: skript, encoding: 'utf8', timeout: 240000 }); }
    catch (e) { ok(false, 'N live: Staging-Backend nicht erreichbar (' + e.message.split('\n')[0] + ')'); }
    if (roh) {
      const r = JSON.parse(roh.trim().split('\n').pop());
      ok(nah(r.p, 58.45) && Math.abs(r.e - 400280.24) < 0.5, 'N live Andersenweg, Vorlage Maerz 2026, 6 WE + 6 Garagen: ' + r.p + ' % / Ertragswert ' + r.e + ' (Soll 58,45 / 400.280,24)');
      ok(nah(Number(r.q), 58.45), 'N live Pipeline rechnet denselben Gebaeudeanteil wie runBmf: ' + r.q + ' % (Soll 58,45)');
      ok(Math.abs(Number(r.ak) - 419955) < 0.5, 'N live Pipeline: Prognose-AK mit KPA-Kosten 390.000 + 29.406 + 549 = 419.955 (' + r.ak + ')');
    }
  }
}

console.log('steuer-audit-pruefen: ' + gruen + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
