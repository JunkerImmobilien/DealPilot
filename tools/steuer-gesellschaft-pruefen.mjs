#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/steuer-gesellschaft-pruefen.mjs · v3268

   Steuer je Halter: GmbH/UG (vermoegensverwaltend), GbR, Privat.
   Laedt die ECHTEN Dateien in eine vm-Sandbox, nichts nachgebaut:

     frontend/js/ueberfuehrung-kern.js  Kern: steuerReihe (KSt je Jahr, einfache
                                        Kuerzung, Hinzurechnung § 8 Nr. 1 GewStG),
                                        ugRuecklage, ausschuettung,
                                        veraeusserungGesellschaft
     frontend/js/mandanten.js           steuerParameter (kstNachJahr), anteil,
                                        feststellung (§ 180 AO), kostenBegriff
     frontend/js/tax.js                 _computeYearTotal / _computeAutoForYear
                                        (GbR-Anteil, § 82b nur privat)
     frontend/js/sanierung-plan.js      Verteilung § 82b EStDV
     frontend/js/calc.js                nur als Text: Ruecklagen aus nul_st,
                                        Verkaufssteuer im IRR, Zinsen an _mtx
     frontend/js/bestand-analyse.js     Exit: keine Zehnjahresfrist bei GmbH/UG

   Gegenprobe Privat: tax.js der Referenz (REF, Stand vor v3268) gegen die
   aktuelle - _computeYearTotal fuer Halter „privat" bit-gleich ueber 12 Jahre.

   Sollwerte HANDGERECHNET (je Fall im Kommentar).
   Aufruf: node tools/steuer-gesellschaft-pruefen.mjs [--laut]   RC=0 sauber
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => fs.readFileSync(path.join(WURZEL, d), 'utf8');
const REF = '6c939c0e';   /* v3267 - letzter Stand vor v3268 */
const laut = process.argv.includes('--laut');
let rot = 0, gruen = 0;
function soll(name, ist, erwartet, tol = 0.005) {
  const ok = (typeof erwartet === 'number')
    ? (typeof ist === 'number' && isFinite(ist) && Math.abs(ist - erwartet) <= tol)
    : JSON.stringify(ist) === JSON.stringify(erwartet);
  if (ok) gruen++; else rot++;
  if (!ok || laut) console.log((ok ? 'ok   ' : 'ROT  ') + name + (ok ? '' : ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(erwartet)));
}

/* ── Sandbox ──────────────────────────────────────────────────────────── */
function sandbox(opt) {
  opt = opt || {};
  const felder = {};
  const feld = (id, value = '', extra = {}) => (felder[id] = Object.assign({ id, value, checked: false, options: [], style: {}, dispatchEvent() {}, addEventListener() {} }, extra));
  const werte = Object.assign({ halter: 'privat', kp: '300000', nkm: '1000', ze: '', mietstg: '1,5', umlagef: '', kostenstg: '1,0',
    san: '', san_ust: 'brutto', san_tax_years: 'auto', afa_satz: '2.0', moebl: '', wirtschaftlicher_uebergang: '01.01.2026',
    kaufdat: '2026-01-01', zve: '60000', grundsteuer: '', grundsteuerwert: '', san_plan: '' }, opt.felder || {});
  Object.keys(werte).forEach((k) => feld(k, werte[k]));
  felder.san_tax_active = feld('san_tax_active', '', { checked: !!opt.sanAktiv });
  const ls = { dp_mandanten: JSON.stringify({ list: [
    { id: 'privat', name: 'Privat', rechtsform: 'privat', regime: {}, bh: {}, _locked: true },
    { id: 'mGmbH', name: 'Test VV GmbH', rechtsform: 'gmbh', regime: { kst: 15.825, gewst: 400, erw_kuerzung: false }, bh: {} },
    { id: 'mUG', name: 'Test UG', rechtsform: 'ug', regime: { kst: 15.825, gewst: 400, erw_kuerzung: false }, bh: {} },
    { id: 'mGbR', name: 'Test GbR', rechtsform: 'gbr', quote: 50, gesellschafter: [{ name: 'Mitgesellschafterin', anteil: 50 }], regime: {}, bh: {} }
  ] }) };
  const sb = {
    console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Date, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array, Promise,
    document: {
      getElementById: (id) => felder[id] || null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: () => {}, createElement: () => ({ style: {}, appendChild() {}, setAttribute() {}, classList: { add() {}, remove() {} } }),
      body: { appendChild() {} }, readyState: 'complete', head: { appendChild() {} }
    },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem() {}, removeItem() {} },
    Event: function () {}, CustomEvent: function () {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    DealPilotConfig: { pricing: { currentKey: () => 'pro' } },
    State: Object.assign({ _ahk: { sanLimit: 29700, nkQuote: 0 }, cfRows: null, _afaSeriesNormal: Array(60).fill(4800), _afaSeriesSonder: [],
      kpis: { afa: 4800, kp: 300000, nkm_m: 1000 }, _afaBreakdown: { gebaeude: 4800, kueche: 0 } }, opt.state || {})
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb; sb.addEventListener = () => {}; sb.removeEventListener = () => {}; sb.dispatchEvent = () => {};
  vm.createContext(sb);
  const calcSrc = lies('frontend/js/calc.js');
  const mParse = calcSrc.match(/function parseDe\(s\) \{[\s\S]*?\r?\n\}\r?\n/);
  vm.runInContext(mParse[0] + '\nwindow.parseDe = parseDe;', sb, { filename: 'calc.js#parseDe' });
  vm.runInContext(lies('frontend/js/ueberfuehrung-kern.js'), sb, { filename: 'ueberfuehrung-kern.js' });
  vm.runInContext(lies('frontend/js/mandanten.js'), sb, { filename: 'mandanten.js' });
  if (opt.plan) vm.runInContext(lies('frontend/js/sanierung-plan.js'), sb, { filename: 'sanierung-plan.js' });
  vm.runInContext(opt.taxSrc || lies('frontend/js/tax.js'), sb, { filename: 'tax.js' });
  return { sb, felder };
}
/* cfRows: 12 Jahre, Zinsen 6.000 fallend, nicht umlagefaehige BWK 1.200 */
const ROWS = Array.from({ length: 12 }, (_, i) => ({ cal: 2026 + i, zy: 6000 - i * 150, bwk_y: 2400, bwk_st_y: 1200, bwk_cf_y: 1200, rs: 200000 }));

let S, K, M;
try {
  S = sandbox({ state: { cfRows: ROWS } });
  K = S.sb.DealPilotUeberfuehrungKern; M = S.sb.DealPilotMandanten;
  if (!K || !M || typeof S.sb._computeYearTotal !== 'function') throw new Error('Module nicht geladen');
} catch (e) { console.error('KAPUTT: ' + e.message); process.exit(2); }

/* ── 1 · GmbH mit erweiterter Kuerzung: GewSt 0 ─────────────────────────
   Ergebnis 50.000 € (2026), Zinsen 300.000 €. KSt + Soli 50.000 × 15,825 %
   = 7.912,50 €. GewSt: erweiterte Kuerzung -> 0, auch keine Hinzurechnung. */
{
  const r = K.steuerReihe([{ jahr: 2026, erg: 50000, entgelte: 300000 }], { kstSoliPct: 15.825, hebesatz: 400, erwKuerzung: true })[0];
  soll('1 erw. Kuerzung: GewSt 0', r.gewst, 0);
  soll('1 erw. Kuerzung: keine Hinzurechnung', r.hinzurechnung, 0);
  soll('1 erw. Kuerzung: KSt + Soli 7.912,50', r.kst, 7912.5);
}

/* ── 2 · GmbH ohne Kuerzung, Zinsen 300.000 € ───────────────────────────
   Hinzurechnung § 8 Nr. 1 GewStG: 25 % × (300.000 − 200.000) = 25.000 €.
   Ohne Grundsteuerwert: Gewerbeertrag 50.000 + 25.000 = 75.000 €,
   GewSt 75.000 × 3,5 % × 400 % = 10.500 €. KSt unveraendert 7.912,50 €.
   Mit Grundsteuerwert 200.000 €: Kuerzung 0,11 % = 220 € -> 74.780 ->
   abgerundet 74.700 -> GewSt 10.458 €.
   Gegenprobe Freibetrag: Zinsen 200.000 -> Hinzurechnung 0. */
{
  const P = { kstSoliPct: 15.825, hebesatz: 400, erwKuerzung: false };
  soll('2 Hinzurechnung 25 % × 100.000 = 25.000', K.hinzurechnung(300000).betrag, 25000);
  soll('2 Hinzurechnung nur Zinsen erfasst', K.hinzurechnung(300000).nurZinsen, true);
  soll('2 Freibetrag 200.000 -> 0', K.hinzurechnung(200000).betrag, 0);
  soll('2 Mieten unbewegl. 1/2: 300.000 Zinsen + 100.000 Miete -> 25 % × 150.000', K.hinzurechnung(300000, { mietenUnbeweglich: 100000 }).betrag, 37500);
  const r = K.steuerReihe([{ jahr: 2026, erg: 50000, entgelte: 300000 }], P)[0];
  soll('2 Gewerbeertrag 75.000', r.gewerbeertrag, 75000);
  soll('2 GewSt 10.500', r.gewst, 10500);
  soll('2 Kuerzung fehlt ohne Grundsteuerwert', r.kuerzungFehlt, 'Grundsteuerwert');
  soll('2 KSt 7.912,50', r.kst, 7912.5);
  const r2 = K.steuerReihe([{ jahr: 2026, erg: 50000, entgelte: 300000, grundsteuerwert: 200000 }], P)[0];
  soll('2 Kuerzung 0,11 % × 200.000 = 220', r2.gewKuerzung, 220);
  soll('2 GewSt mit Kuerzung 10.458', r2.gewst, 10458);
  /* bis EZ 2024: 1,2 % von 140 % des Einheitswerts 50.000 = 840 € */
  soll('2 Kuerzung 2024 aus Einheitswert 50.000 = 840', K.einfacheKuerzung(2024, null, 50000).betrag, 840);
  /* Verdrahtung: tax.js gibt die Zinsen je Jahr in die Reihe, calc.js an _mtx */
  const tax = lies('frontend/js/tax.js'), calc = lies('frontend/js/calc.js');
  soll('2 tax.js: Entgelte = Zinsen + Gesellschafterdarlehen', /entgelte: \(Number\(r\.entgelte\) \|\| 0\) \+ gd/.test(tax), true);
  soll('2 calc.js: Projektion gibt zy2 an _mtxYear', /_mtxYear\(zve_op_y - _afaJahr\(y\), _v268_baseYear \+ y - 1, zy2\)/.test(calc), true);
  soll('2 Jahresabschluss: Schuldzinsen aller Objekte', /entgelteSchulden \+= _gaNum\(v\.schuldzinsen\)/.test(lies('frontend/js/gesellschaft-abschluss.js')), true);
}

/* ── 3 · UG-Ruecklage § 5a Abs. 3 GmbHG ──────────────────────────────────
   Jahresueberschuss 10.000 €, Verlustvortrag aus dem Vorjahr 4.000 €:
   (10.000 − 4.000) × 25 % = 1.500 € (bis v3267: 2.500 €). Verlustvortrag
   12.000 € -> 0. Ohne Vortrag 4.823 € -> 1.205,75 € (wie bisher). */
{
  soll('3 UG 10.000 − 4.000 -> 1.500', K.ugRuecklage(10000, 4000), 1500);
  soll('3 UG Vortrag groesser -> 0', K.ugRuecklage(10000, 12000), 0);
  soll('3 UG ohne Vortrag 4.823 -> 1.205,75', K.ugRuecklage(4823, 0), 1205.75);
  const a = K.ausschuettung({ jahresueberschuss: 10000, rechtsform: 'ug', verlustvortrag: 4000 });
  soll('3 ausschuettung nutzt dieselbe Stelle: Ruecklage 1.500', a.ruecklage, 1500);
  soll('3 ausschuettbar 8.500, KapESt 26,375 % = 2.241,88', a.kapESt, 8500 * 0.26375, 0.01);
  const ga = lies('frontend/js/gesellschaft-abschluss.js'), tax = lies('frontend/js/tax.js');
  soll('3 Jahresabschluss ruft ugRuecklage(.., Verlustvortrag)', /_KUg\.ugRuecklage\(jahresueberschuss, Math\.max\(0, -gewinnvortrag\)\)/.test(ga), true);
  soll('3 Reiter Steuer ruft ugRuecklage', /_KU\.ugRuecklage\(_nachKSt, _vvUg\)/.test(tax), true);
  soll('3 keine zweite 25-%-Rechnung ohne Kern (ga)', /jahresueberschuss > 0\) \? jahresueberschuss \* 0\.25 : 0;/.test(ga), false);
}

/* ── 4 · KSt-Satz je Jahr (§ 23 Abs. 1 KStG n. F.) ───────────────────────
   15 % bis 2027 -> 15,825 %; 2028 14 % × 1,055 = 14,77 %; 2030 12,66 %;
   ab 2032 10,55 %. Ergebnis 10.000 € 2029: 13 % × 1,055 = 13,715 % -> 1.371,50 €. */
{
  soll('4 2027: 15,825 %', K.kstSoliPct(2027), 15.825, 1e-9);
  soll('4 2028: 14,77 %', K.kstSoliPct(2028), 14.77, 1e-9);
  soll('4 2030: 12,66 %', K.kstSoliPct(2030), 12.66, 1e-9);
  soll('4 2035: 10,55 %', K.kstSoliPct(2035), 10.55, 1e-9);
  soll('4 steuerReihe 2029 mit kstNachJahr: 1.371,50', K.steuerReihe([{ jahr: 2029, erg: 10000 }], { erwKuerzung: true, kstNachJahr: true })[0].kst, 1371.5);
  soll('4 ohne kstNachJahr fest 15,825 % (Altverhalten)', K.steuerReihe([{ jahr: 2029, erg: 10000 }], { kstSoliPct: 15.825, erwKuerzung: true })[0].kst, 1582.5);
  const P = M.steuerParameter('mGmbH');
  soll('4 Mandant auf Vorgabe 15,825 -> kstNachJahr', P && P.kstNachJahr, true);
}

/* ── 5 · GmbH-Verkauf nach 12 Jahren: steuerpflichtig ────────────────────
   Kauf 2026, Verkauf 2038 fuer 400.000 €. AK (Kaufpreis + NK) 300.000 €,
   AfA 12 × 6.000 = 72.000 € -> Buchwert 228.000 €, Verkaufskosten 12.000 €
   -> Gewinn 160.000 €. KSt 2038: 10 % × 1,055 = 10,55 % -> 16.880 €.
   Mit erw. Kuerzung GewSt 0; ohne Kuerzung 160.000 × 3,5 % × 400 % = 22.400 €.
   Eine Zehnjahresfrist gibt es nicht (steuerfreiNachFrist false). */
{
  const b = { preis: 400000, ak: 300000, afaKum: 72000, verkaufskosten: 12000, kstNachJahr: true, jahr: 2038, hebesatz: 400 };
  const v1 = K.veraeusserungGesellschaft(Object.assign({ erwKuerzung: true }, b));
  soll('5 Buchwert 228.000', v1.buchwert, 228000);
  soll('5 Gewinn 160.000', v1.gewinn, 160000);
  soll('5 KSt 2038 16.880', v1.kst, 16880);
  soll('5 GewSt mit erw. Kuerzung 0', v1.gewst, 0);
  soll('5 keine Steuerfreiheit nach Frist', v1.steuerfreiNachFrist, false);
  const v2 = K.veraeusserungGesellschaft(Object.assign({ erwKuerzung: false }, b));
  soll('5 GewSt ohne Kuerzung 22.400', v2.gewst, 22400);
  const v3 = K.veraeusserungGesellschaft(Object.assign({}, b, { erwKuerzung: true, schaedlich: true }));
  soll('5 schaedliche Veraeusserung: GewSt trotz Kuerzung 22.400', v3.gewst, 22400);
  /* Exit im Bestand: bei Halter GmbH keine Frist, Steuer aus dem Kern */
  const B = sandbox({ felder: { halter: 'mGmbH', kaufdat: '2014-03-01' }, state: { cfRows: ROWS, _akKpNk: 300000, _afaSeries: Array(30).fill(6000), kpis: { kp: 280000, gi: 300000 } } });
  B.sb.DpWertZielbild = { bericht: () => ({ market_value: 400000, created_at: '2026-11-01' }) };
  vm.runInContext(lies('frontend/js/bestand-analyse.js'), B.sb, { filename: 'bestand-analyse.js' });
  const BA = B.sb.DpBestand;
  const x = BA && BA.exit ? BA.exit(new Date(2026, 10, 9)) : null;
  soll('5 Exit GmbH: keine Zehnjahresfrist', x && x.frist_ende, null);
  /* AfA bis Ende Vorjahr: 2014..2025 = 12 Jahre × 6.000 = 72.000 -> Gewinn 400.000 − 228.000 = 172.000 */
  soll('5 Exit GmbH: Gewinn 172.000 (ohne Verkaufskosten)', x && x.veraeusserung && x.veraeusserung.gewinn, 172000);
  soll('5 Exit GmbH: KSt 2026 15,825 % = 27.219', x && x.veraeusserung && x.veraeusserung.kst, 27219);
  const P2 = sandbox({ felder: { halter: 'privat', kaufdat: '2014-03-01' }, state: { cfRows: ROWS } });
  P2.sb.DpWertZielbild = { bericht: () => ({ market_value: 400000 }) };
  vm.runInContext(lies('frontend/js/bestand-analyse.js'), P2.sb, { filename: 'bestand-analyse.js' });
  const BP = P2.sb.DpBestand;
  const xp = BP && BP.exit ? BP.exit(new Date(2026, 10, 9)) : null;
  soll('5 Exit privat: Frist bleibt (Kauf + 10 Jahre)', !!(xp && xp.frist_ende), true);
  soll('5 IRR: GmbH-Exit mindert den Erloes um die Steuer', /_exitErloes -= _vg\.steuer/.test(lies('frontend/js/calc.js')), true);
}

/* ── 6 · GbR 50/50: nur 50 % ins zvE ─────────────────────────────────────
   Dasselbe Objekt einmal privat, einmal in der GbR (Anteil 50 %): ergebnis
   gleich, ergebnisAnteil = 50 %, die Steuerwirkung = Tarif auf zvE + 50 %. */
{
  const P = sandbox({ felder: { halter: 'privat' }, state: { cfRows: ROWS } });
  const G = sandbox({ felder: { halter: 'mGbR' }, state: { cfRows: ROWS } });
  const tp = P.sb._computeYearTotal(2027, 1), tg = G.sb._computeYearTotal(2027, 1);
  soll('6 Ergebnis der GbR = Ergebnis privat (ganzes Objekt)', tg.ergebnis, tp.ergebnis, 1e-9);
  soll('6 GbR-Anteil 0,5', tg.gbrAnteil, 0.5);
  soll('6 ergebnisAnteil = 50 %', tg.ergebnisAnteil, tp.ergebnis * 0.5, 1e-9);
  const soll6 = G.sb.Tax.calcImmoTaxImpact(tg.zve, tp.ergebnis * 0.5, 2027).taxDelta;
  soll('6 Steuerwirkung aus 50 % des Ergebnisses', tg.taxDelta, soll6, 1e-9);
  soll('6 Steuerwirkung GbR != privat', Math.abs(tg.taxDelta - tp.taxDelta) > 1, true);
  if (laut) console.log('     2027: Ergebnis ' + tp.ergebnis.toFixed(2) + ' · privat ' + tp.taxDelta.toFixed(2) + ' · GbR 50 % ' + tg.taxDelta.toFixed(2));
  const f = G.sb.DealPilotMandanten.feststellung('mGbR', 10000);
  soll('6 Feststellung: zwei Gesellschafter, je 5.000', f && f.zeilen.map((z) => z.betrag), [5000, 5000]);
  soll('6 Feststellung: Anteile 100 %', f && f.vollstaendig, true);
  soll('6 Begriff GbR: Werbungskosten', G.sb.DealPilotMandanten.kostenBegriff('mGbR').wort, 'Werbungskosten');
  soll('6 Begriff GmbH: Betriebsausgaben', G.sb.DealPilotMandanten.kostenBegriff('mGmbH').wort, 'Betriebsausgaben');
  soll('6 Privat: kein Feststellungsblock', G.sb.DealPilotMandanten.feststellung('privat', 10000), null);
}

/* ── 7 · Privat unveraendert: tax.js REF gegen aktuell, bit-gleich ───────── */
{
  let alt = null;
  try { alt = execFileSync('git', ['-C', WURZEL, 'show', REF + ':frontend/js/tax.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { alt = null; }
  if (!alt) { rot++; console.log('ROT  7 Referenz ' + REF + ' nicht lesbar'); }
  else {
    const A = sandbox({ felder: { halter: 'privat' }, state: { cfRows: ROWS }, taxSrc: alt });
    const N = sandbox({ felder: { halter: 'privat' }, state: { cfRows: ROWS } });
    let gleich = true, erst = null;
    for (let i = 0; i < 12; i++) {
      const a = A.sb._computeYearTotal(2026 + i, i), n = N.sb._computeYearTotal(2026 + i, i);
      for (const k of ['ergebnis', 'werbungskosten', 'einnahmen', 'taxDelta', 'refund', 'zve']) {
        if (a[k] !== n[k]) { gleich = false; if (!erst) erst = { jahr: 2026 + i, k, alt: a[k], neu: n[k] }; }
      }
    }
    soll('7 Privat: _computeYearTotal 12 Jahre bit-gleich mit ' + REF, gleich ? true : erst, true);
    /* Pruefer, der gruen wird: die verglichenen Werte muessen echte Zahlen sein */
    const n1 = N.sb._computeYearTotal(2027, 1);
    soll('7 Gegenprobe misst echte Zahlen (Ergebnis und Steuerwirkung != 0)', typeof n1.taxDelta === 'number' && n1.taxDelta !== 0 && n1.ergebnis !== 0, true);
    if (laut) console.log('     2027 privat: Ergebnis ' + n1.ergebnis.toFixed(2) + ', Steuerwirkung ' + n1.taxDelta.toFixed(2) + ', zvE ' + n1.zve);
  }
}

/* ── 8 · § 82b EStDV nur im Privatvermoegen ───────────────────────────────
   Erhaltung 10.000 € im Jahr 2027, „5 Jahre": privat 2.000 € je Jahr,
   GmbH sofort 10.000 € (Betriebsausgabe). */
{
  const P = sandbox({ felder: { halter: 'privat' }, state: { cfRows: ROWS }, plan: true });
  const kern = P.sb.DpSanierungPlan.kern;
  const l = [{ bez: 'Dach', jahr: 2027, betrag: 10000, art: 'erhaltung', vert: '5' }];
  const ctx = { A: 2026, grenze: 1e9, sanNetto: 0, ust: 'netto', afaSatz: 2 };
  soll('8 privat: 5 Jahre je 2.000', kern.steuerAus(l, ctx).jahre[2027].erh, 2000);
  soll('8 GmbH: sofort 10.000', kern.steuerAus(l, Object.assign({ ohne82b: true }, ctx)).jahre[2027].erh, 10000);
  /* tax.js: #san_tax_years = 5 bei Halter GmbH -> rechnet wie 1 (sofort) */
  const G = sandbox({ felder: { halter: 'mGmbH', san: '20000', san_tax_years: '5' }, sanAktiv: true, state: { cfRows: ROWS } });
  const Pr = sandbox({ felder: { halter: 'privat', san: '20000', san_tax_years: '5' }, sanAktiv: true, state: { cfRows: ROWS } });
  const eg = G.sb._computeAutoForYear(0, 2026), ep = Pr.sb._computeAutoForYear(0, 2026);
  soll('8 tax.js GmbH: Erhaltung 20.000 im Jahr 1', eg.erhaltungsaufwand, 20000);
  soll('8 tax.js privat: Erhaltung 4.000 im Jahr 1 (5 Jahre)', ep.erhaltungsaufwand, 4000);
}

/* ── 9 · Ruecklagen nicht als Werbungskosten (calc.js) ────────────────────
   Beispiel: Hausgeld n. u. 1.539 €, davon WEG-Ruecklage 798 €, eigene
   Ruecklage 600 €. Cashflow weiter 2.139 €, Steuer nur 741 € (vorher 2.139 €). */
{
  const c = lies('frontend/js/calc.js');
  const m = c.match(/var _ruecklageSt = ([^;]+);/);
  soll('9 calc.js: _ruecklageSt = eigen_r + min(weg_r, hg_nul)', !!m && /v\('eigen_r'\) \+ Math\.max\(0, Math\.min\(v\('weg_r'\), v\('hg_nul'\)\)\)/.test(m[1]), true);
  soll('9 calc.js: nul_st = nul − Ruecklagen', /var _mawSteuer = \(typeof _ruecklageSt === 'number' && _ruecklageSt > 0\) \? _ruecklageSt : 0;\s*\/\*[^*]*\*\/\s*var nul_st = nul - _mawSteuer;/.test(c), true);
  const v = { hg_nul: 1539, weg_r: 798, eigen_r: 600 };
  const nul = v.hg_nul + v.eigen_r, st = nul - (v.eigen_r + Math.min(v.weg_r, v.hg_nul));
  soll('9 Beispiel: steuerlich 741 statt 2.139', st, 741);
}

console.log((rot ? 'ROT' : 'GRUEN') + ' · ' + gruen + ' gruen, ' + rot + ' rot (steuer-gesellschaft-pruefen v3268)');
process.exit(rot ? 1 : 0);
