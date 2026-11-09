/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/darlehen-pruefen.mjs · v3215
   W-17 (Entwicklungspartner): beliebig viele weitere Darlehen im Reiter
   Finanzierung - Liste im Feld #darlehen_weitere, Kern
   frontend/js/darlehen-weitere.js (DpDarlehenWeitere).

   Laedt die ECHTEN Dateien und prueft in drei Teilen:

   A  Kern gegen Handrechnung. Ein Annuitaetendarlehen 50.000 € zu 4 % Zins
      und 2 % Tilgung, monatliche Zahlung: Zins, Tilgung und Restschuld der
      Jahre 1-3 gegen die GESCHLOSSENE Formel
         R(n) = D·q^n − A·(q^n − 1)/i,  i = 4 %/12, q = 1 + i, A = D·6 %/12
      (der Kern rechnet Monat fuer Monat - zwei Wege, eine Zahl). Dazu
      Tilgungsaussetzung, spaeteres Start-Jahr, Monate im Jahr 1, Summen ab Kauf.

   B  DealKpis.compute (deal-kpis.js) - ohne Liste Feld fuer Feld identisch
      zum Stand vor W-17 (Referenz-Commit, git show), mit einem D3:
      Darlehenssumme, Zins, Tilgung hoeher, DSCR niedriger.

   C  calc.js - der GANZE Rechenlauf (calcNow) in einer Sandbox mit
      Formularfeldern, alt (Referenz-Commit) gegen neu:
      ohne Liste State.kpis und jede cfRows-Zeile Feld fuer Feld identisch
      (auch mit Darlehen II und mit Kauf zur Jahresmitte); mit D3 Annuitaet:
      Zins/Tilgung je Jahr = ohne Liste + Handrechnung, Restschuld, Summe,
      LTV, DSCR sinkt; ein D3 mit spaeterem Start-Jahr aendert Jahr 1 nicht.

   Aufruf aus dem Repo-Wurzelverzeichnis:  node tools/darlehen-pruefen.mjs [--laut]
   RC=0 ist sauber. Ohne git (Referenz nicht lesbar) RC=1 - ein Pruefer, der
   seinen Vergleich nicht machen kann, wird nicht gruen.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Stand vor W-17 (Version 1.0.81, v3212). Nicht HEAD: nach dem Commit waere
   das der neue Stand, und der Vergleich verglieche sich mit sich selbst. */
const REFERENZ = 'c4b9e72c';
const LAUT = process.argv.includes('--laut');

let fehler = 0, geprueft = 0;
const melde = (ok, text, ist) => {
  geprueft++;
  if (!ok) fehler++;
  if (!ok || LAUT) console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (ok ? '' : '  -> ist: ' + JSON.stringify(ist)));
};
const nah = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= (tol == null ? 0.005 : tol);

const neuLesen = (datei) => fs.readFileSync(path.join(WURZEL, 'frontend', 'js', datei), 'utf8');
function altLesen(datei) {
  return execFileSync('git', ['-C', WURZEL, 'show', REFERENZ + ':frontend/js/' + datei], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/* ── Sandbox: ein Fenster, Formularfelder als einfache Objekte ─────────── */
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
function sandbox(quellen, felder) {
  const els = {};
  Object.keys(felder || {}).forEach((k) => { els[k] = element(k, felder[k]); });
  const leise = { log() {}, warn() {}, error() {}, info() {} };
  const w = {
    console: leise, Date, Math, JSON, Intl,
    document: {
      readyState: 'complete', getElementById: (id) => els[id] || null,
      querySelector: () => null, querySelectorAll: () => [], createElement: () => element('neu'), createTextNode: () => ({}),
      addEventListener() {}, removeEventListener() {}, body: element('body'), documentElement: element('html'), head: element('head')
    },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: '', hash: '', href: '' }, navigator: { userAgent: 'node' },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addListener() {} }), CustomEvent: function () {}, Event: function () {}
  };
  w.window = w; w.self = w; w.globalThis = w;
  const ctx = vm.createContext(w);
  for (const q of quellen) new vm.Script(q.code, { filename: q.name }).runInContext(ctx);
  return ctx;
}

/* ══ A · Kern gegen Handrechnung ════════════════════════════════════════ */
console.log('A · Kern DpDarlehenWeitere gegen Handrechnung');
const kern = sandbox([{ name: 'darlehen-weitere.js', code: neuLesen('darlehen-weitere.js') }], {}).DpDarlehenWeitere;
if (!kern || typeof kern.plan !== 'function') { console.log('FEHL  DpDarlehenWeitere nicht geladen'); process.exit(1); }

const D = 50000, Z = 4, T = 2, i = Z / 100 / 12, A = D * (Z + T) / 100 / 12;
const R = (n) => { const q = Math.pow(1 + i, n); return D * q - A * (q - 1) / i; };   /* geschlossene Formel */
const hand = [1, 2, 3].map((j) => {
  const rs0 = R(12 * (j - 1)), rs1 = R(12 * j), tilg = rs0 - rs1;
  return { zins: A * 12 - tilg, tilg, rs: rs1 };
});
const D3 = [{ bez: 'KfW 261', betrag: 50000, zins: 4, tilg: 2, art: 'annuitaet', bindj: 10 }];
const plan = kern.plan(D3, { basisJahr: 2026, jahre: 12, monateJahr1: 12 });
[0, 1, 2].forEach((k) => {
  melde(nah(plan[k].zins, hand[k].zins), 'Jahr ' + (k + 1) + ' Zins ' + hand[k].zins.toFixed(2), plan[k].zins);
  melde(nah(plan[k].tilg, hand[k].tilg), 'Jahr ' + (k + 1) + ' Tilgung ' + hand[k].tilg.toFixed(2), plan[k].tilg);
  melde(nah(plan[k].rs_ende, hand[k].rs), 'Jahr ' + (k + 1) + ' Restschuld ' + hand[k].rs.toFixed(2), plan[k].rs_ende);
});
melde(nah(kern.restNach(D3, 120, { basisJahr: 2026, monateJahr1: 12 }), R(120)), 'Restschuld nach 10 Jahren ' + R(120).toFixed(2), kern.restNach(D3, 120, {}));
melde(nah(kern.restBindungsende(D3[0]), R(120)), 'Restschuld am Ende der Bindung (10 J.)', kern.restBindungsende(D3[0]));
const an = kern.anfang(D3, { basisJahr: 2026 });
melde(an.betrag === 50000 && nah(an.zins_j, 2000) && nah(an.tilg_j, 1000) && nah(an.rate_m, 250), 'Summen ab Kauf: 50.000 €, Zins 2.000, Tilgung 1.000, Rate 250 €', an);

/* Tilgungsaussetzung: Zins auf die volle Summe, keine Tilgung */
const TA = [{ betrag: 40000, zins: 3, tilg: 5, art: 'tilgungsaussetzung' }];
const pTA = kern.plan(TA, { basisJahr: 2026, jahre: 3 });
melde(nah(pTA[2].zins, 1200) && pTA[2].tilg === 0 && pTA[2].rs_ende === 40000, 'Tilgungsaussetzung: 1.200 € Zins, keine Tilgung, Restschuld bleibt', pTA[2]);
melde(nah(kern.anfang(TA).rate_m, 100), 'Tilgungsaussetzung: Rate = nur Zins (100 €/Monat), Tilgungssatz zaehlt nicht', kern.anfang(TA));

/* Spaeteres Start-Jahr: vorher nichts, ab Januar des Start-Jahres wie ab Kauf */
const SP = [{ betrag: 50000, zins: 4, tilg: 2, start_jahr: 2028 }];
const pSP = kern.plan(SP, { basisJahr: 2026, jahre: 5 });
melde(pSP[0].zins === 0 && pSP[1].zins === 0 && pSP[1].rs_ende === 0, 'Start-Jahr 2028: in 2026 und 2027 nichts', [pSP[0], pSP[1]]);
melde(nah(pSP[2].zins, hand[0].zins) && nah(pSP[4].rs_ende, hand[2].rs), 'Start-Jahr 2028: 2028 wie Jahr 1, 2030 wie Jahr 3', [pSP[2].zins, pSP[4].rs_ende]);
melde(kern.anfang(SP, { basisJahr: 2026 }).betrag === 0, 'Start-Jahr 2028 zaehlt nicht zur Kauffinanzierung (Darlehenssumme, LTV)', kern.anfang(SP, { basisJahr: 2026 }));

/* Monate im Jahr 1 (Kauf im Juli): 6 Monate, danach volle Jahre */
const p6 = kern.plan(D3, { basisJahr: 2026, jahre: 2, monateJahr1: 6 });
melde(nah(p6[0].rs_ende, R(6)) && nah(p6[1].rs_ende, R(18)), 'Kauf zur Jahresmitte: Restschuld nach 6 und 18 Monaten', [p6[0].rs_ende, p6[1].rs_ende]);

/* Lesen: Text aus dem Feld, deutsche Zahlen, leere Eintraege fallen raus */
const gelesen = kern.lesen(JSON.stringify([{ betrag: '50.000', zins: '3,5', tilg: '2' }, { betrag: '' }, null]));
melde(gelesen.length === 1 && gelesen[0].betrag === 50000 && gelesen[0].zins === 3.5, 'lesen: "50.000" / "3,5", leere Eintraege raus', gelesen);
melde(kern.lesen('').length === 0 && kern.lesen('kaputt').length === 0, 'lesen: leer oder kaputt -> keine Darlehen', null);

/* v3256 · Monatsplan eines Eintrags (Dialog „Tilgungsplan / Zinsplan ansehen"):
   dieselbe Schleife wie plan() - Restschuld gegen die geschlossene Formel,
   Jahressummen gegen plan(), Tilgungsaussetzung ohne Tilgung. */
const mp = kern.monatsplan(D3[0], 36);
melde(mp.length === 36 && nah(mp[0].zins, D * i) && nah(mp[0].rate, A), 'Monatsplan: 36 Monate, Monat 1 Zins ' + (D * i).toFixed(2) + ', Rate ' + A.toFixed(2), mp[0]);
melde(nah(mp[11].rs, R(12)) && nah(mp[35].rs, R(36)), 'Monatsplan: Restschuld nach 12 und 36 Monaten = Formel', [mp[11].rs, mp[35].rs]);
const mpJ2 = mp.slice(12, 24).reduce((s, x) => ({ zins: s.zins + x.zins, tilg: s.tilg + x.tilg }), { zins: 0, tilg: 0 });
melde(nah(mpJ2.zins, plan[1].zins) && nah(mpJ2.tilg, plan[1].tilg), 'Monatsplan: Monate 13-24 summiert = plan() Jahr 2', mpJ2);
const mpTA = kern.monatsplan(TA[0], 24);
melde(mpTA.every((x) => x.tilg === 0 && x.rs === 40000 && nah(x.zins, 100)), 'Monatsplan Tilgungsaussetzung: 100 € Zins je Monat, keine Tilgung, Restschuld bleibt', mpTA[23]);
melde(kern.monatsplan({ betrag: '' }, 12).length === 0, 'Monatsplan: ohne Betrag kein Plan', null);

/* ══ B · DealKpis.compute ═══════════════════════════════════════════════ */
console.log('B · DealKpis.compute alt gegen neu');
let altKpis = null, altCalc = null, altDscr = null, altAnteilig = null;
try {
  altKpis = altLesen('deal-kpis.js'); altCalc = altLesen('calc.js'); altDscr = altLesen('dscr-engine.js'); altAnteilig = altLesen('anteilig.js');
} catch (e) {
  console.log('FEHL  Referenz ' + REFERENZ + ' nicht lesbar (git show): ' + e.message.split('\n')[0]);
  process.exit(1);
}
const kAlt = sandbox([{ name: 'dscr-engine.js', code: altDscr }, { name: 'deal-kpis.js', code: altKpis }], {}).DealKpis;
const kNeu = sandbox([{ name: 'dscr-engine.js', code: neuLesen('dscr-engine.js') }, { name: 'darlehen-weitere.js', code: neuLesen('darlehen-weitere.js') },
  { name: 'deal-kpis.js', code: neuLesen('deal-kpis.js') }], {}).DealKpis;
const eingabe = { kp: 250000, nk: 30000, san: 0, nkm: 1100, ze: 50, bwk_ul: 2400, bwk_nul: 1200, d1: 200000, d1z: 3.8, d1t: 2,
  d2: 30000, d2z: 2.5, d2t: 1, ek: 50000, afa: 4000, grenz: 42, leerstand_pct: 2 };
const ka = kAlt.compute(eingabe), kn = kNeu.compute(eingabe);
const abw = Object.keys(ka).filter((k) => !Object.is(ka[k], kn[k]));
melde(abw.length === 0, 'ohne Liste: alle ' + Object.keys(ka).length + ' Kennzahlen bitgleich', abw.map((k) => k + ' ' + ka[k] + ' / ' + kn[k]));
const kn3 = kNeu.compute(Object.assign({}, eingabe, { darlehen_weitere: JSON.stringify(D3) }));
melde(kn3.d_total === ka.d_total + 50000, 'mit D3: Darlehenssumme +50.000', kn3.d_total);
melde(nah(kn3.zins_j, ka.zins_j + 2000) && nah(kn3.tilg_j, ka.tilg_j + 1000), 'mit D3: Zins +2.000, Tilgung +1.000 im Jahr', [kn3.zins_j, kn3.tilg_j]);
melde(kn3.dscr < ka.dscr && kn3.cf_m < ka.cf_m, 'mit D3: DSCR und Cashflow sinken', [ka.dscr, kn3.dscr]);
melde(kn3.ltv > ka.ltv, 'mit D3: LTV steigt', [ka.ltv, kn3.ltv]);
const knSp = kNeu.compute(Object.assign({}, eingabe, { basisjahr: 2026, darlehen_weitere: [{ betrag: 50000, zins: 4, tilg: 2, start_jahr: 2030 }] }));
melde(knSp.d_total === ka.d_total && Object.is(knSp.dscr, ka.dscr), 'D3 ab 2030 (Basisjahr 2026): Kennzahlen beim Kauf unveraendert', [knSp.d_total, knSp.dscr]);

/* ══ C · calc.js, der ganze Rechenlauf ══════════════════════════════════ */
console.log('C · calc.js (calcNow) alt gegen neu');
const FORM = { kp: '250000', makler_p: '3,57', notar_p: '1,5', gba_p: '0,5', gest_p: '6,5', ji_p: '0', nkm: '1100', ze: '0', umlagef: '200',
  ek: '50000', d1: '230000', d1z: '3,8', d1t: '2', d1_bindj: '10', anschl_z: '5', anschl_t: '2', btj: '15', grenz: '42', afa_satz: '2', geb_ant: '80',
  hg_ul: '1800', hg_nul: '900', kaufdat: '2026-01-01', mietstg: '1,5', kostenstg: '1,5', wertstg: '1,5', svwert: '',
  d2_enable: false, d1_anschl_enable: true, darlehen_weitere: '' };
function rechne(alt, felder) {
  const q = alt
    ? [{ name: 'dscr-engine.js', code: altDscr }, { name: 'deal-kpis.js', code: altKpis }, { name: 'anteilig.js', code: altAnteilig }, { name: 'calc.js', code: altCalc }]
    : ['dscr-engine.js', 'darlehen-weitere.js', 'deal-kpis.js', 'anteilig.js', 'calc.js'].map((d) => ({ name: d, code: neuLesen(d) }));
  const ctx = sandbox(q, Object.assign({}, FORM, felder || {}));
  ctx.calcNow();
  return JSON.parse(JSON.stringify({ kpis: ctx.State.kpis, rows: ctx.State.cfRows, rs: ctx.State.rs, phase: ctx.State.phaseTable || null }));
}
function vergleiche(name, a, b) {
  const diff = [];
  Object.keys(a.kpis).forEach((k) => { if (JSON.stringify(a.kpis[k]) !== JSON.stringify(b.kpis[k])) diff.push('kpis.' + k); });
  melde(a.rows.length === b.rows.length && a.rows.length > 0, name + ': ' + a.rows.length + ' Projektionsjahre', b.rows.length);
  a.rows.forEach((r, j) => Object.keys(r).forEach((k) => { if (JSON.stringify(r[k]) !== JSON.stringify((b.rows[j] || {})[k])) diff.push('cfRows[' + j + '].' + k); }));
  if (JSON.stringify(a.rs) !== JSON.stringify(b.rs)) diff.push('State.rs');
  if (JSON.stringify(a.phase) !== JSON.stringify(b.phase)) diff.push('State.phaseTable (heute/EZB/Anschluss)');
  melde(diff.length === 0, name + ': ' + Object.keys(a.kpis).length + ' Kennzahlen und jede Projektionszeile bitgleich', diff.slice(0, 8));
}
const FAELLE = [
  ['nur Darlehen I', {}],
  ['mit Darlehen II (Annuitaet)', { d2_enable: true, d2: '40000', d2z: '3', d2t: '1,5', d2_bindj: '10', d2_type: 'annuitaet' }],
  ['Kauf zur Jahresmitte', { kaufdat: '2026-07-01' }]
];
let basis = null;
FAELLE.forEach(([name, f]) => {
  let a, b;
  try { a = rechne(true, f); b = rechne(false, f); } catch (e) { melde(false, name + ': Rechenlauf', e.message); return; }
  vergleiche(name, a, b);
  if (!basis) basis = b;
});

/* Mit einem D3 Annuitaet 50.000 / 4 % / 2 %, Kauf 01.01.2026 */
let m3 = null;
try { m3 = rechne(false, { darlehen_weitere: JSON.stringify(D3) }); } catch (e) { melde(false, 'mit D3: Rechenlauf', e.message); }
if (m3 && basis) {
  [0, 1, 2].forEach((k) => {
    melde(nah(m3.rows[k].zy - basis.rows[k].zy, hand[k].zins), 'mit D3 Jahr ' + (k + 1) + ': Schuldzinsen +' + hand[k].zins.toFixed(2), m3.rows[k].zy - basis.rows[k].zy);
    melde(nah(m3.rows[k].ty - basis.rows[k].ty, hand[k].tilg), 'mit D3 Jahr ' + (k + 1) + ': Tilgung +' + hand[k].tilg.toFixed(2), m3.rows[k].ty - basis.rows[k].ty);
    melde(nah(m3.rows[k].rs - basis.rows[k].rs, hand[k].rs), 'mit D3 Jahr ' + (k + 1) + ': Restschuld +' + hand[k].rs.toFixed(2), m3.rows[k].rs - basis.rows[k].rs);
    melde(nah(m3.rows[k].rs_dw, hand[k].rs), 'mit D3 Jahr ' + (k + 1) + ': cfRows.rs_dw', m3.rows[k].rs_dw);
    melde(m3.rows[k].cfop_y < basis.rows[k].cfop_y, 'mit D3 Jahr ' + (k + 1) + ': Cashflow v. St. sinkt', [basis.rows[k].cfop_y, m3.rows[k].cfop_y]);
  });
  melde(m3.kpis.d_total === basis.kpis.d_total + 50000, 'mit D3: Darlehenssumme (d_total) +50.000', m3.kpis.d_total);
  melde(nah(m3.kpis.zins_j - basis.kpis.zins_j, 2000) && nah(m3.kpis.tilg_j - basis.kpis.tilg_j, 1000), 'mit D3: Zins/Tilgung im Jahr +2.000 / +1.000 (Kennzahlen heute)', [m3.kpis.zins_j, m3.kpis.tilg_j]);
  melde(m3.kpis.dscr < basis.kpis.dscr, 'mit D3: DSCR sinkt (' + basis.kpis.dscr.toFixed(2) + ' -> ' + m3.kpis.dscr.toFixed(2) + ')', m3.kpis.dscr);
  melde(m3.kpis.ltv > basis.kpis.ltv, 'mit D3: LTV steigt', m3.kpis.ltv);
  melde(nah(m3.rs - basis.rs, R(120), 0.01), 'mit D3: Restschuld am Ende der Zinsbindung +' + R(120).toFixed(2), m3.rs - basis.rs);
  /* Phasen: EZB = Jahr 10, Anschluss = Jahr 11 der Handrechnung (D3 laeuft durchfinanziert weiter) */
  const zJ = (j) => A * 12 - (R(12 * (j - 1)) - R(12 * j));
  melde(nah(m3.kpis.zins_ezb - basis.kpis.zins_ezb, zJ(10)), 'mit D3: Zins in der EZB-Phase +' + zJ(10).toFixed(2) + ' (Jahr 10)', m3.kpis.zins_ezb - basis.kpis.zins_ezb);
  melde(nah(m3.kpis.zins_an - basis.kpis.zins_an, zJ(11)), 'mit D3: Zins in der Anschluss-Phase +' + zJ(11).toFixed(2) + ' (Jahr 11)', m3.kpis.zins_an - basis.kpis.zins_an);
  melde(nah((m3.kpis.zins_an + m3.kpis.tilg_an) - (basis.kpis.zins_an + basis.kpis.tilg_an), 3000), 'mit D3: Rate in der Anschluss-Phase +3.000 €/Jahr', (m3.kpis.zins_an + m3.kpis.tilg_an) - (basis.kpis.zins_an + basis.kpis.tilg_an));
  melde(m3.rows[0].tax_y < basis.rows[0].tax_y, 'mit D3: Steuer Jahr 1 sinkt (Schuldzinsen abziehbar)', [basis.rows[0].tax_y, m3.rows[0].tax_y]);
}
/* D3 ab 2029: Jahr 1-3 unveraendert, ab 2029 Zins wie Jahr 1 der Handrechnung */
try {
  const sp = rechne(false, { darlehen_weitere: JSON.stringify([{ betrag: 50000, zins: 4, tilg: 2, start_jahr: 2029 }]) });
  melde(sp.kpis.d_total === basis.kpis.d_total && Object.is(sp.kpis.dscr, basis.kpis.dscr), 'D3 ab 2029: Kennzahlen beim Kauf unveraendert', [sp.kpis.d_total, sp.kpis.dscr]);
  melde(sp.rows[2].zy === basis.rows[2].zy && nah(sp.rows[3].zy - basis.rows[3].zy, hand[0].zins), 'D3 ab 2029: 2028 unveraendert, 2029 Zins +' + hand[0].zins.toFixed(2), [sp.rows[2].zy - basis.rows[2].zy, sp.rows[3].zy - basis.rows[3].zy]);
} catch (e) { melde(false, 'D3 ab 2029: Rechenlauf', e.message); }

console.log((fehler ? 'ROT' : 'GRUEN') + ' · ' + (geprueft - fehler) + '/' + geprueft + ' Pruefungen (Referenz ' + REFERENZ + ')');
process.exit(fehler ? 1 : 0);
