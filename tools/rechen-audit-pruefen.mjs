/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/rechen-audit-pruefen.mjs · v3760 (Rechen-Audit 18.11.2026)

   Marcel 18.11.2026: „Mir ist ganz wichtig, dass du nochmal alle Rechnungen
   überprüfst … Leg gern Beispiele an, fülle alle Felder aus, auch
   Kombinationen mit mehreren Darlehen und allem."

   Laedt die ECHTEN Dateien der Haupt-App in derselben Reihenfolge wie
   index.html (21 Dateien, darunter calc.js, tax.js, deal-kpis.js,
   dscr-engine.js, darlehen-weitere.js, afa-engine.js, irr-engine.js) in
   eine vm-Sandbox mit nachgebauten Formularfeldern, laesst calcNow()
   rechnen und rechnet JEDE Ergebnisgroesse UNABHAENGIG nach - mit eigener,
   kleiner Rechnung, die keine Zeile der App benutzt:

     · Kaufnebenkosten je Satz, GrESt ohne ausgewiesenes Inventar (§ 9 GrEStG)
     · Gebaeude-AHK (§ 255 HGB): Inventar vorab vom Kaufpreis, GrESt nur aufs
       Grundstueck, AfA = AHK × Satz, Kaufjahr monatsanteilig (§ 7 Abs. 1 S. 4)
     · Tilgungsplan je Darlehen Monat fuer Monat (Annuitaet, Tilgungsaus-
       setzung, Zinsbindung, Anschluss mit fester Rate aus der Restschuld am
       Bindungsende), Restschuld gegen die geschlossene Formel
     · DSCR = (Miete − nicht umlagef. Kosten − Leerstand) / (Zins + Tilgung
       + BSV-Sparrate), Brutto-/Nettomietrendite, Faktor, LTV
     · Cashflow vor Steuern je Jahr, ESt-Tarif § 32a EStG 2026 + Soli (SolZG)
       als Differenz mit/ohne Objekt, Cashflow nach Steuern
     · IRR aus der eigenen Reihe (−EK, Cashflows n. St., Verkauf − Restschuld
       ALLER Darlehen)

   Beispielfaelle (erfundene Daten): ETW, EFH, MFH, WGH; Ankauf, Kauf zur
   Jahresmitte; ein bis drei Darlehen (Annuitaet, Tilgungsaussetzung + BSV,
   KfW, weitere Darlehen), 100 % + NK, Inventar, Leerstand, Sanierung,
   AfA 2 / 2,5 / 3 %, Verkauf nach 10 Jahren.

   Aufruf aus dem Repo-Wurzelverzeichnis:  node tools/rechen-audit-pruefen.mjs [--laut]
   RC=0 ist sauber. Bekannte, mit Marcel noch offene Modell-Entscheidungen
   stehen als OFFEN (gelb) und machen den Pruefer nicht rot - sie sind im
   Bericht Dateien/Rechen-Audit/ benannt.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAUT = process.argv.includes('--laut');
let fehler = 0, geprueft = 0, offen = 0;
const melde = (ok, text, ist) => {
  geprueft++;
  if (!ok) fehler++;
  if (!ok || LAUT) console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (ok ? '' : '  -> ist: ' + JSON.stringify(ist)));
};
const gelb = (text) => { offen++; console.log('  OFFEN ' + text); };
const nah = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) && Math.abs(a - b) <= (tol == null ? 1 : tol);
const r2 = (x) => Math.round(x * 100) / 100;

/* ── Sandbox (Muster: tools/darlehen-pruefen.mjs) ──────────────────────── */
const DATEIEN = ['kpa-kosten.js', 'dscr-engine.js', 'schwellen.js', 'darlehen-weitere.js', 'deal-kpis.js', 'afa-engine.js', 'irr-engine.js',
  'erbbau-engine.js', 'zve-manager.js', 'tax-periods.js', 'wk-aggregator.js', 'anteilig.js', 'calc.js', 'mietentwicklung.js', 'tax.js',
  'score-tiers.js', 'dealscore.js', 'ueberfuehrung-kern.js', 'sonderumlage.js', 'sanierung-plan.js'];
/* --calc=<datei>: Gegenprobe mit einem anderen Stand von calc.js (z. B. git show v3759:frontend/js/calc.js) */
const CALC_ALT = (process.argv.find((x) => x.startsWith('--calc=')) || '').slice(7) || null;
const QUELLEN = DATEIEN.map((d) => ({ d, code: fs.readFileSync(d === 'calc.js' && CALC_ALT ? CALC_ALT : path.join(WURZEL, 'frontend', 'js', d), 'utf8') }));
function element(id, wert) {
  const cb = typeof wert === 'boolean';
  return {
    id, value: cb ? '' : String(wert == null ? '' : wert), checked: cb ? wert : false, type: cb ? 'checkbox' : 'text',
    textContent: '', innerHTML: '', style: {}, dataset: {}, options: [], children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { return c; }, removeChild() {}, insertBefore(c) { return c; }, insertAdjacentHTML() {}, remove() {},
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }, focus() {}, blur() {}, click() {}
  };
}
function rechne(felder) {
  const els = {};
  Object.keys(felder).forEach((k) => { els[k] = element(k, felder[k]); });
  const leise = { log() {}, warn() {}, error() {}, info() {} };
  const w = {
    console: leise, Date, Math, JSON, Intl,
    document: {
      readyState: 'complete', getElementById: (id) => els[id] || null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => element('neu'), createTextNode: () => ({}), addEventListener() {}, removeEventListener() {},
      body: element('body'), documentElement: element('html'), head: element('head')
    },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: '', hash: '', href: '' }, navigator: { userAgent: 'node' }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addListener() {} }), CustomEvent: function () {}, Event: function () {}
  };
  w.window = w; w.self = w; w.globalThis = w;
  const ctx = vm.createContext(w);
  for (const q of QUELLEN) new vm.Script(q.code, { filename: q.d }).runInContext(ctx);
  ctx.calcNow();
  return ctx;
}

/* ══ Unabhaengige Rechnung ═════════════════════════════════════════════ */
/* § 32a Abs. 1 EStG ab VZ 2026 (Wortlaut), zvE und Steuer auf volle Euro abgerundet */
function est2026(zve) {
  const x = Math.floor(Math.max(0, zve));
  if (x <= 12348) return 0;
  if (x <= 17799) { const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); }
  if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.10 * z + 2397) * z + 1034.87); }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}
/* §§ 3, 4 SolZG: Freigrenze 20.350 € (Grundtabelle, ab 2026), Milderungszone 11,9 % */
function soli2026(est) { const fg = 20350; if (est <= fg) return 0; return Math.floor(Math.min(0.055 * est, 0.119 * (est - fg)) * 100) / 100; }
const last2026 = (z) => { const e = est2026(z); return e + soli2026(e); };
const steuerDelta = (zve, vuv) => last2026(Math.max(0, zve + vuv)) - last2026(zve);

/* Ein Darlehen Monat fuer Monat. art: 'annuitaet' | 'aussetzung'.
   Bindung bindj Jahre ab Monat 1, danach (wenn anschl) feste Rate aus der
   Restschuld am Bindungsende × (az + at) / 12, sonst alte Rate weiter. */
function plan(dl, jahre, monateJahr1) {
  const out = [];
  let rs = dl.betrag, rate = dl.art === 'aussetzung' ? dl.betrag * dl.z / 12 : dl.betrag * (dl.z + dl.t) / 12, zins = dl.z;
  let m = 0;
  const bindM = (dl.bindj || 10) * 12;
  for (let j = 1; j <= jahre; j++) {
    const n = j === 1 ? (monateJahr1 == null ? 12 : monateJahr1) : 12;
    let zy = 0, ty = 0;
    for (let k = 0; k < n; k++) {
      if (m === bindM && dl.art !== 'aussetzung') {
        if (dl.anschl) { zins = dl.az; rate = rs * (dl.az + dl.at) / 12; }
      }
      m++;
      const zm = rs * zins / 12;
      const tm = dl.art === 'aussetzung' ? 0 : Math.min(rs, Math.max(0, rate - zm));
      zy += zm; ty += tm; rs -= tm;
    }
    out.push({ zy, ty, rs });
  }
  return out;
}
/* geschlossene Formel der Restschuld nach n Monaten (Annuitaet) */
const rsFormel = (D, z, t, n) => { const i = z / 12, q = Math.pow(1 + i, n), A = D * (z + t) / 12; return D * q - A * (q - 1) / i; };
function irrAus(reihe) {
  const npv = (r) => reihe.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 1.0;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2 * 100;
}

/* ══ Beispielfaelle ═══════════════════════════════════════════════════
   Alle Faelle: Kauf 01.01.2026 (ausser F5), NRW-Saetze (GrESt 6,5 %),
   zvE 70.000 € ledig ohne Kirchensteuer, Mietsteigerung 1,5 %, Kosten 1,5 %. */
const BASIS = { makler_p: '3,57', notar_p: '1,5', gba_p: '0,5', gest_p: '6,5', ji_p: '0', umlagef: '200', d1_anschl_enable: true, anschl_z: '5', anschl_t: '2',
  grenz: '42', zve: '70000', kaufdat: '2026-01-01', mietstg: '1,5', kostenstg: '1,5', wertstg: '1,5', svwert: '', d2_enable: false, darlehen_weitere: '',
  hg_ul: '1800', hg_nul: '900', btj: '20', afa_satz: '2.0', geb_ant: '80', baujahr: '1990', wfl: '75', d1_type: 'annuitaet' };
const FAELLE = [
  { name: 'F1 ETW Ankauf, ein Annuitaetendarlehen, Kueche 5.000 €, Leerstand 2 %',
    f: { kp: '250000', nkm: '1100', ze: '50', ek: '50000', d1: '230000', d1z: '3,8', d1t: '2', d1_bindj: '10', inv_kueche: '5000', leerstand: '2' },
    dl: [{ betrag: 230000, z: 0.038, t: 0.02, bindj: 10, anschl: true, az: 0.05, at: 0.02 }] },
  { name: 'F2 EFH, Darlehen I + II (eigene Bindung 15 J., eigener Anschluss) + KfW als weiteres Darlehen',
    f: { kp: '420000', nkm: '1650', ze: '0', ek: '60000', d1: '300000', d1z: '3,6', d1t: '2', d1_bindj: '10', wfl: '140', geb_ant: '75', hg_ul: '0', hg_nul: '2400',
      d2_enable: true, d2: '60000', d2z: '4,2', d2t: '3', d2_bindj: '15', d2_type: 'annuitaet', d2_anschl_enable: true, d2_az: '5,5', d2_at: '3',
      darlehen_weitere: JSON.stringify([{ bez: 'KfW 261', betrag: 40000, zins: 2.1, tilg: 3, art: 'annuitaet', bindj: 10 }]) },
    dl: [{ betrag: 300000, z: 0.036, t: 0.02, bindj: 10, anschl: true, az: 0.05, at: 0.02 },
      { betrag: 60000, z: 0.042, t: 0.03, bindj: 15, anschl: true, az: 0.055, at: 0.03 },
      { betrag: 40000, z: 0.021, t: 0.03, bindj: 10, anschl: false }] },
  { name: 'F3 MFH 6 Einheiten, 100 % + NK finanziert (EK 0), AfA 2,5 % (Bj 1910)',
    f: { kp: '780000', nkm: '5200', ze: '240', ek: '0', d1: '870000', d1z: '3,9', d1t: '1,5', d1_bindj: '15', wfl: '480', geb_ant: '70', baujahr: '1910', afa_satz: '2.5',
      hg_ul: '9000', hg_nul: '7800', leerstand: '3' },
    dl: [{ betrag: 870000, z: 0.039, t: 0.015, bindj: 15, anschl: true, az: 0.05, at: 0.02 }] },
  { name: 'F4 WGH, Darlehen I + II (Bindung gleich), AfA 3 % (Bj 2023), Verkauf nach 10 Jahren',
    f: { kp: '950000', nkm: '6100', ze: '300', ek: '200000', d1: '600000', d1z: '3,7', d1t: '2', d1_bindj: '10', wfl: '520', geb_ant: '78', baujahr: '2023', afa_satz: '3.0',
      d2_enable: true, d2: '230000', d2z: '4', d2t: '2,5', d2_bindj: '10', d2_type: 'annuitaet', d2_anschl_enable: false, btj: '10', hg_ul: '12000', hg_nul: '9500' },
    dl: [{ betrag: 600000, z: 0.037, t: 0.02, bindj: 10, anschl: true, az: 0.05, at: 0.02 },
      { betrag: 230000, z: 0.04, t: 0.025, bindj: 10, anschl: false }] },
  { name: 'F5 ETW Kauf 01.07.2026 (Jahr 1 anteilig), Darlehen II als Tilgungsaussetzung',
    f: { kp: '310000', nkm: '1250', ze: '0', ek: '40000', d1: '250000', d1z: '3,8', d1t: '2', d1_bindj: '10', kaufdat: '2026-07-01', d1_auszahl: '07.2026',
      d2_enable: true, d2: '50000', d2z: '4,1', d2t: '0', d2_bindj: '10', d2_type: 'tilgungsaussetzung', d2_auszahl: '07.2026' },
    dl: [{ betrag: 250000, z: 0.038, t: 0.02, bindj: 10, anschl: true, az: 0.05, at: 0.02 },
      { betrag: 50000, z: 0.041, t: 0, bindj: 10, art: 'aussetzung' }], monateJahr1: 6 }
];
/* Faelle mit eigener Pruefung (Bausparvertrag, degressive AfA, Sanierung) - gleiche Basis wie F1 */
const F1F = { kp: '250000', nkm: '1100', ze: '0', ek: '50000', d1: '230000', d1z: '3,8', d1t: '2', d1_bindj: '10' };
const SPEZIAL = [
  { name: 'F6 ETW Tilgungsaussetzung + Bausparvertrag (400 €/Monat, Summe 115.000, Quote 40 %)',
    f: Object.assign({}, F1F, { d1_type: 'tilgungsaussetzung', d1t: '0', bspar_rate: '400', bspar_sum: '115000', bspar_zins: '0,5', bspar_dar_z: '2,5', bspar_dar_t: '6', bspar_quote_min: '40' }),
    pruefe(S, K, R) {
      const bspar = 400 * 12, zins = 230000 * 0.038;
      melde(nah(K.dscr, (13200 - 900) / (zins + bspar), 0.0005), 'DSCR mit BSV-Sparrate im Kapitaldienst = ' + ((13200 - 900) / (zins + bspar)).toFixed(4), K.dscr);
      melde(nah(R[0].zy, zins, 0.01) && R[0].ty === 0 && nah(R[0].bspar_y, bspar, 0.01), 'Sparphase: Zins auf volle 230.000 €, keine Tilgung, Sparrate 4.800 €', [R[0].zy, R[0].ty, R[0].bspar_y]);
      melde(nah(R[0].cfop_y, 13200 - 900 - zins - bspar, 0.01), 'Cashflow v. St. = Miete − nul − Zins − Sparrate', R[0].cfop_y);
      /* Guthaben bei Zuteilung (40 % der Summe), eigene Rechnung: 400 €/Monat, 0,5 % p.a. monatlich */
      let fv = 0, n = 0; while (fv < 46000 && n < 600) { fv = fv * (1 + 0.005 / 12) + 400; n++; }
      const jz = Math.ceil(n / 12), iz = jz - 1;
      melde(nah(S.bsvLifecycle.guthabenBeiZuteilung, fv, 0.01) && S.bsvLifecycle.jahreBisZuteilung === jz, 'Zuteilung nach ' + n + ' Monaten (Jahr ' + jz + '), Guthaben ' + r2(fv), [S.bsvLifecycle.guthabenBeiZuteilung, S.bsvLifecycle.jahreBisZuteilung]);
      melde(nah(R[iz].rs, 230000 - fv, 0.5), 'Zuteilungsjahr: Restschuld = 230.000 − Guthaben = ' + r2(230000 - fv), R[iz].rs);
      melde(nah(R[iz].eff_rs, R[iz].rs, 0.01) && nah(R[iz + 2].eff_rs, R[iz + 2].rs, 0.01), 'effektive Restschuld ab Zuteilung = Restschuld (Guthaben nicht doppelt abgezogen, v3760)', [R[iz].eff_rs, R[iz].rs]);
      melde(nah(R[iz - 1].eff_rs, 230000 - R[iz - 1].bspar_kum, 0.01), 'effektive Restschuld vor Zuteilung = 230.000 − Sparsumme', R[iz - 1].eff_rs);
    } },
  { name: 'F7 Neubau-ETW Bj 2026, degressive AfA 5 % (§ 7 Abs. 5a)',
    f: Object.assign({}, F1F, { afa_satz: '5.0_deg', baujahr: '2026' }),
    pruefe(S, K, R) {
      const ahk = S._afaStempel.geb;
      melde(nah(R[0].afa_y, ahk * 0.05, 0.01) && nah(R[1].afa_y, (ahk - ahk * 0.05) * 0.05, 0.01) && nah(R[2].afa_y, ahk * 0.95 * 0.95 * 0.05, 0.01), 'degressiv: 5 % vom Restbuchwert, Jahr 1-3', [R[0].afa_y, R[1].afa_y, R[2].afa_y]);
    } },
  { name: 'F8 Sanierung 20.000 € brutto (unter 15 %): Erhaltungsaufwand sofort',
    f: Object.assign({}, F1F, { san: '20000' }),
    pruefe(S, K, R) {
      melde(nah(S.san15.istNetto, 20000 / 1.19, 0.01) && S.san15.istNetto < S.san15.limit, '15-%-Grenze netto: ' + r2(20000 / 1.19) + ' < ' + r2(S.san15.limit), S.san15);
      melde(nah(S.san15.limit, S._afaStempel.geb * 0.15, 0.01), 'Grenze = 15 % der Gebaeude-AHK', S.san15.limit);
      melde(nah(R[0].zve_steuer, R[0].zve_y - 20000, 0.01), 'Jahr 1: Ueberschuss V+V − 20.000 € (brutto, privat ohne Vorsteuer)', [R[0].zve_steuer, R[0].zve_y]);
      melde(nah(R[0].tax_y, steuerDelta(70000, R[0].zve_steuer), 1), 'Jahr 1: Steuer = Tarif-Differenz', R[0].tax_y);
      melde(nah(S.gi, 250000 + 250000 * 0.1207 + 20000, 0.01), 'Gesamtinvestition mit Sanierung', S.gi);
    } },
  { name: 'F9 Sanierung 60.000 € brutto (ueber 15 %): anschaffungsnahe HK ueber die AfA',
    f: Object.assign({}, F1F, { san: '60000' }),
    pruefe(S, K, R) {
      melde(S.san15.istNetto > S.san15.limit, '15-%-Grenze ueberschritten: ' + r2(S.san15.istNetto) + ' > ' + r2(S.san15.limit), S.san15);
      melde(nah(R[0].zve_steuer, R[0].zve_y - 60000 * 0.02, 0.01) && nah(R[1].zve_steuer, R[1].zve_y - 60000 * 0.02, 0.01), 'Jahr 1 und 2: zusaetzlich 2 % AfA auf 60.000 € (1.200 €), kein Sofortabzug', [R[0].zve_steuer, R[0].zve_y]);
    } }
];

/* ══ Lauf ═════════════════════════════════════════════════════════════ */
const ERGEBNIS = [];
const SCHNAPPSCHUSS = (process.argv.find((x) => x.startsWith('--schnappschuss=')) || '').split('=')[1] || null;
const SCHNAPP = {};
for (const F of FAELLE) {
  console.log(F.name);
  const felder = Object.assign({}, BASIS, F.f);
  let c;
  try { c = rechne(felder); } catch (e) { melde(false, 'Rechenlauf', e.message); continue; }
  const S = c.State, K = S.kpis, R = S.cfRows;
  if (SCHNAPPSCHUSS) SCHNAPP[F.name.slice(0, 2)] = JSON.parse(JSON.stringify({ kpis: K, rows: R, rs: S.rs, irr: S._irrReihe || null }));
  const num = (k) => { const x = String(felder[k] == null ? '' : felder[k]).replace(/\./g, '').replace(',', '.'); return x === '' ? 0 : Number(x); };
  const kp = num('kp'), inv = num('inv_kueche'), san = num('san');
  const p = (k) => num(k) / 100;

  /* 1 · Kaufnebenkosten und Gesamtinvestition */
  const grest = (kp - inv) * p('gest_p');
  const nk = kp * (p('makler_p') + p('notar_p') + p('gba_p') + p('ji_p')) + grest;
  melde(nah(S.gi, kp + nk + san, 0.01), 'Gesamtinvestition = KP + NK (GrESt ohne Inventar ' + r2(grest) + ') = ' + r2(kp + nk + san), S.gi);

  /* 2 · Gebaeude-AHK und AfA Jahr 1 */
  const geb = p('geb_ant');
  const nkAnteilig = nk - grest, nkImmo = nkAnteilig * (kp - inv) / kp + grest;
  const ahk = (kp - inv) * geb + nkImmo * geb;
  const satz = parseFloat(felder.afa_satz) / 100;
  const mon1 = F.monateJahr1 == null ? 12 : F.monateJahr1;
  melde(nah(S._afaStempel.geb, ahk, 0.01), 'Gebaeude-AHK ' + r2(ahk) + ' (Inventar vorab, NK anteilig, GrESt nur Grundstueck)', S._afaStempel.geb);
  melde(nah(K.afa, ahk * satz + (inv > 0 ? 0 : 0), 0.01) || nah(K.afa, ahk * satz + inv / 10, 0.01), 'AfA volles Jahr ' + r2(ahk * satz) + ' (+ Inventar/10 J.)', K.afa);
  melde(nah(R[0].afa_y, ahk * satz * mon1 / 12, 1), 'AfA Kaufjahr ' + mon1 + '/12 = ' + r2(ahk * satz * mon1 / 12), R[0].afa_y);

  /* 3 · Miete, Kosten, Renditen */
  const nkm = num('nkm'), ze = num('ze'), nkmJ = (nkm + ze) * 12;
  const leer = nkmJ * p('leerstand'), nul = num('hg_nul') + leer;
  melde(nah(K.nkm_j, nkmJ, 0.01), 'Jahresmiete (NKM + Zusatz) ' + nkmJ, K.nkm_j);
  melde(nah(K.bmy, nkmJ / kp * 100, 0.01), 'Bruttomietrendite ' + r2(nkmJ / kp * 100) + ' %', K.bmy);
  melde(nah(K.nmy, (nkmJ - nul) / (kp + nk + san) * 100, 0.01), 'Nettomietrendite (Miete − nicht umlagef. − Leerstand) / GI = ' + r2((nkmJ - nul) / (kp + nk + san) * 100) + ' %', K.nmy);
  melde(nah(K.fak, kp / nkmJ, 0.001), 'Kaufpreisfaktor ' + r2(kp / nkmJ), K.fak);

  /* 4 · Kapitaldienst heute, DSCR, LTV */
  let zinsA = 0, tilgA = 0, dSum = 0;
  F.dl.forEach((d) => { zinsA += d.betrag * d.z; tilgA += d.art === 'aussetzung' ? 0 : d.betrag * d.t; dSum += d.betrag; });
  melde(nah(K.zins_j, zinsA, 0.01) && nah(K.tilg_j, tilgA, 0.01), 'Zins/Tilgung heute (Anfangssaetze, alle Darlehen) ' + r2(zinsA) + ' / ' + r2(tilgA), [K.zins_j, K.tilg_j]);
  const dscr = (nkmJ - nul) / (zinsA + tilgA);
  melde(nah(K.dscr, dscr, 0.0005), 'DSCR netto (Miete − nul − Leerstand) / Kapitaldienst = ' + dscr.toFixed(4), K.dscr);
  melde(nah(K.ltv, dSum / kp * 100, 0.01), 'LTV auf den Kaufpreis ' + r2(dSum / kp * 100) + ' %', K.ltv);

  /* 5 · Tilgungsplan je Jahr gegen die eigene Monatsrechnung, alle Darlehen */
  const N = Math.min(R.length, 20);
  const plaene = F.dl.map((d) => plan(d, N, d.bindj && d === F.dl[0] ? mon1 : mon1));
  const zyE = [], tyE = [], rsE = [];
  for (let j = 0; j < N; j++) {
    zyE.push(plaene.reduce((s, pl) => s + pl[j].zy, 0));
    tyE.push(plaene.reduce((s, pl) => s + pl[j].ty, 0));
    rsE.push(plaene.reduce((s, pl) => s + pl[j].rs, 0));
  }
  const abw = [];
  for (let j = 0; j < N; j++) {
    if (!nah(R[j].zy, zyE[j], 1) || !nah(R[j].ty, tyE[j], 1) || !nah(R[j].rs, rsE[j], 1)) abw.push({ jahr: R[j].cal, zy: r2(R[j].zy), soll_zy: r2(zyE[j]), ty: r2(R[j].ty), soll_ty: r2(tyE[j]), rs: r2(R[j].rs), soll_rs: r2(rsE[j]) });
  }
  melde(abw.length === 0, 'Zins, Tilgung, Restschuld je Jahr ' + R[0].cal + '-' + R[N - 1].cal + ' = eigene Monatsrechnung (alle Darlehen)', abw.slice(0, 3));
  const d1 = F.dl[0];
  melde(nah(S.rs1, rsFormel(d1.betrag, d1.z, d1.t, d1.bindj * 12), 0.5), 'Restschuld Darlehen I am Bindungsende = geschlossene Formel ' + r2(rsFormel(d1.betrag, d1.z, d1.t, d1.bindj * 12)), S.rs1);

  /* 6 · Cashflow vor Steuern, Steuer, Cashflow nach Steuern je Jahr */
  const mst = p('mietstg'), kst = p('kostenstg');
  const abwCf = [], abwSt = [], abwNs = [];
  for (let j = 0; j < N; j++) {
    const fac = j === 0 ? mon1 / 12 : 1;
    /* Mietsteigerung auf die Kaltmiete; Zusatzeinnahmen (Stellplatz, Garage) bleiben fest (MietEntwicklung.appliesToZE = false) */
    const nkmY = (nkm * 12 * Math.pow(1 + mst, j) + ze * 12) * fac;
    const nulY = nul * Math.pow(1 + kst, j) * fac;
    const cfop = nkmY - nulY - R[j].zy - R[j].ty - (R[j].bspar_y || 0) - (R[j].su_y || 0) - (R[j].san_y || 0);
    if (!nah(R[j].nkm_y, nkmY, 1) || !nah(R[j].cfop_y, cfop, 1)) abwCf.push({ jahr: R[j].cal, nkm: r2(R[j].nkm_y), soll_nkm: r2(nkmY), cfop: r2(R[j].cfop_y), soll: r2(cfop) });
    /* Steuer: Ueberschuss V+V nach tax.js (zve_steuer) gegen eigene Rechnung, dann Tarif-Differenz */
    const vuv = nkmY - nulY - R[j].zy - R[j].afa_y;
    const vuvApp = typeof R[j].zve_steuer === 'number' ? R[j].zve_steuer : R[j].zve_y;
    const st = steuerDelta(70000, vuvApp);
    if (!nah(vuvApp, vuv, 1) || !nah(R[j].tax_y, st, 1)) abwSt.push({ jahr: R[j].cal, vuv_app: r2(vuvApp), vuv_soll: r2(vuv), steuer: r2(R[j].tax_y), soll: r2(st) });
    if (!nah(R[j].cfns_y, R[j].cfop_y - R[j].tax_y, 0.01)) abwNs.push(R[j].cal);
  }
  melde(abwCf.length === 0, 'Kaltmiete je Jahr (+1,5 %, Zusatzeinnahmen fest) und Cashflow v. St. = Miete − nul − Zins − Tilgung − BSV', abwCf.slice(0, 3));
  melde(abwSt.length === 0, 'Ueberschuss V+V je Jahr und Steuer = ESt+Soli(zvE + V+V) − ESt+Soli(zvE), Tarif 2026', abwSt.slice(0, 3));
  melde(abwNs.length === 0, 'Cashflow n. St. = v. St. − Steuer in jedem Jahr', abwNs);

  /* 7 · IRR: eigene Reihe −EK, CF n. St. je Jahr, Verkauf am Ende von btj
     zum Exit-Preis der App (Jahresmiete btj / Exit-Rendite) minus Restschuld
     ALLER Darlehen minus § 23-Steuer der App */
  const btj = S.btj, ek = num('ek');
  const IR = S._irrReihe;
  if (K.irr != null && IR) {
    const reihe = [-ek];
    for (let j = 0; j < btj; j++) reihe.push(R[j].cfns_y);
    const st23 = (S._exitSteuer23 && S._exitSteuer23.steuer) || 0;
    reihe[btj] += IR.exit_vkp - R[btj - 1].rs - st23;
    const irrSoll = irrAus(reihe);
    ERGEBNIS.push({ fall: F.name.slice(0, 2), irr_app: r2(K.irr), irr_soll: irrSoll == null ? null : r2(irrSoll), rs_exit_app: r2(IR.rs_ende), rs_exit_soll: r2(R[btj - 1].rs) });
    /* Restschuld beim Verkauf: die IRR-Schleife rechnet Darlehen I jahresweise (Zins auf den Jahresanfang),
       die Projektion Monat fuer Monat - nach 20 Jahren rund 1-2 % der Restschuld Unterschied. Darlehen II
       und weitere Darlehen muessen drin sein (bis v3759 fehlten sie ganz). */
    melde(nah(IR.rs_ende, R[btj - 1].rs, Math.max(50, R[btj - 1].rs * 0.02)), 'IRR: Restschuld beim Verkauf (Jahr ' + btj + ') enthaelt alle Darlehen, ' + r2(R[btj - 1].rs) + ' ± 2 %', IR.rs_ende);
    melde(irrSoll != null && nah(K.irr, irrSoll, 0.15), 'IRR ' + (irrSoll == null ? '?' : irrSoll.toFixed(2)) + ' % aus der Projektion (Toleranz 0,15 Pkt.: der IRR rechnet Darlehen I jahresweise)', K.irr);
  }

  /* 8 · Kennzahl heute gegen Projektion Jahr 1 (bekannter offener Punkt „cf_ns gegen cfns_y") */
  if (mon1 === 12) {
    const d = K.cf_ns - R[0].cfns_y;
    if (Math.abs(d) > 1) gelb('Kennzahl CF n. St. ' + r2(K.cf_ns) + ' (Anfangszins, Steuer volles Jahr) gegen Projektion Jahr 1 ' + r2(R[0].cfns_y) + ': ' + r2(d) + ' €/Jahr');
  }
}

for (const F of SPEZIAL) {
  console.log(F.name);
  let c;
  try { c = rechne(Object.assign({}, BASIS, F.f)); } catch (e) { melde(false, 'Rechenlauf', e.message); continue; }
  if (SCHNAPPSCHUSS) SCHNAPP[F.name.slice(0, 2)] = JSON.parse(JSON.stringify({ kpis: c.State.kpis, rows: c.State.cfRows, rs: c.State.rs, irr: c.State._irrReihe || null }));
  F.pruefe(c.State, c.State.kpis, c.State.cfRows);
}

if (SCHNAPPSCHUSS) fs.writeFileSync(SCHNAPPSCHUSS, JSON.stringify(SCHNAPP));
console.log('');
if (LAUT) console.table(ERGEBNIS);
console.log((fehler ? 'ROT' : 'GRUEN') + ' · ' + (geprueft - fehler) + '/' + geprueft + ' Pruefungen' + (offen ? ' · ' + offen + ' offen (Entscheidung)' : ''));
process.exit(fehler ? 1 : 0);
