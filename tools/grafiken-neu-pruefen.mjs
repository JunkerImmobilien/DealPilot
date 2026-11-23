#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   grafiken-neu-pruefen.mjs · v4160

   Prüft die Modellrechnungen der Premium-Grafiken (frontend/js/grafiken-premium.js)
   und die Cashflow-Brücke (frontend/js/grafiken-neu.js) an den ECHTEN Dateien,
   geladen in einer vm mit nachgebautem State (Jahreswerte der Demostraße 5,
   gemessen auf Staging am 23.11.2026, Kaufdatum 01.03.2024, Bindung 10 Jahre).

     A  Basisfall = App: rechne(P, {}) trifft jede Jahreszeile der App (Cashflow, Restschuld)
     B  Anschluss-Formel mit dem Zins der App trifft die App nach der Zinsbindung (≤ 15 € im Jahr)
     C  Cashflow-Brücke (Wasserfall aus grafiken-neu.js) endet beim Cashflow der App
     D  Mieteuro: Zufluss = Abfluss
     E  IRR: Plausibilität (bekannter Fall, monoton in der Wertsteigerung, ohne Eigenkapital kein Wert)
     F  Hebel: Basis = IRR des Basisfalls, jede Spanne enthält die Basis, im Bestand kein Kaufpreis-Hebel
     G  Heatmap: Basiszelle = Szenario mit dem App-Zins, höherer Zins nie besser, Miete +x nie schlechter
     H  Monte-Carlo: P10 ≤ Mitte ≤ P90 je Jahr, fester Startwert (zweimal gleich)
     I  v4250 Theme: Farben sind var(--gx-*), Heatmap mischt per color-mix (kein NaN), Mieteuro je 100 € Miete geht auf
     J  v4250 Reiter Bewertung (grafiken-bewertung.js): Vermögenszuwachs = Summe der vier Quellen wie calc.js (_vz),
        Vermögensaufbau: Wert Ende Jahr = Startwert × (1 + Wertsteigerung)^Jahre, Eigenkapital = Wert − Restschuld
     X  Gegenprobe: eine um 5 € verfälschte Rechnung muss A rot machen, ein verfälschter Zuwachs muss J rot machen

   RC 0 = alles grün.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREM = fs.readFileSync(path.join(WURZEL, 'frontend/js/grafiken-premium.js'), 'utf8');
const NEU = fs.readFileSync(path.join(WURZEL, 'frontend/js/grafiken-neu.js'), 'utf8');

/* Jahr, Kaltmiete, Kosten (Cashflow), Zins, Tilgung, CF vor St., CF nach St., Restschuld, Wert, Steuer, AfA, Ergebnis V+V */
const APP = [
  [2024, 5600, 1132, 3928, 2113, -1574, -1574, 122887, 145000, 0, 2168, -1628],
  [2025, 6770, 1372, 4624, 2626, -1852, -997, 120261, 147175, -855, 2602, -1828],
  [2026, 7420, 1386, 4523, 2727, -1216, -703, 117534, 149383, -512, 2602, -1090],
  [2027, 8220, 1400, 4417, 2833, -430, -336, 114701, 151623, -94, 2602, -198],
  [2028, 8397, 1414, 4308, 2942, -267, -301, 111759, 153898, 35, 2602, 74],
  [2029, 8516, 1428, 4194, 3056, -162, -300, 108703, 156206, 138, 2602, 292],
  [2030, 8636, 1442, 4076, 3174, -56, -299, 105529, 158549, 243, 2602, 517],
  [2031, 8759, 1456, 3953, 3297, 52, -298, 102232, 160928, 350, 2602, 748],
  [2032, 8883, 1471, 3826, 3424, 162, -300, 98807, 163341, 462, 2602, 985],
  [2033, 9009, 1486, 3693, 3557, 273, -304, 95250, 165792, 577, 2602, 1228],
  [2034, 9137, 1501, 3577, 2206, 1853, 1169, 93044, 168278, 685, 2602, 1458],
  [2035, 9267, 1516, 3501, 1988, 2262, 1486, 91056, 170803, 775, 2602, 1648],
  [2036, 9398, 1531, 3424, 2065, 2378, 1513, 88991, 173365, 865, 2602, 1842],
  [2037, 9532, 1546, 3345, 2145, 2497, 1538, 86846, 175965, 959, 2602, 2040],
  [2038, 9668, 1561, 3262, 2228, 2617, 1563, 84619, 178605, 1054, 2602, 2243]
];
const cfRows = APP.map(r => ({ cal: r[0], nkm_y: r[1], bwk_cf_y: r[2], zy: r[3], ty: r[4], cfop_y: r[5], cfns_y: r[6], rs: r[7], wert_y: r[8], tax_y: r[9], afa_y: r[10], zve_y: r[11] }));

function umgebung(opt) {
  opt = opt || {};
  const felder = Object.assign({ kaufdat: '2024-03-01', kp: '145000', ek: '35000', grenz: '47.00', halter: 'privat' }, opt.felder || {});
  const el = (id) => (id in felder ? { value: felder[id], closest: () => null } : null);
  const doc = {
    getElementById: el, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete',
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, contains: () => false } }),
    head: { appendChild() {} }, documentElement: {}, addEventListener() {}, body: { classList: { add() {} } }
  };
  const win = { State: { cfRows: opt.cfRows || cfRows, gi: 162603, bindj: 10, az: 0.05, at: 0.01, kpis: {} }, matchMedia: () => ({ matches: true }), addEventListener() {}, document: doc };
  win.window = win;
  const ctx = vm.createContext(Object.assign(win, { document: doc, Intl, Math, Date: opt.Date || Date, console, setTimeout, clearTimeout, MutationObserver: function () { this.observe = () => {}; } }));
  vm.runInContext(NEU, ctx, { filename: 'grafiken-neu.js' });
  vm.runInContext(PREM, ctx, { filename: 'grafiken-premium.js' });
  return ctx;
}

const fehler = [], gruen = [];
function pruefe(name, ok, info) { (ok ? gruen : fehler).push(name + (info ? ' · ' + info : '')); }

/* Uhr fest auf den 23.11.2026, damit „heute“ 2026 ist */
const FEST = new Date('2026-11-23T12:00:00Z').getTime();
class FesteZeit extends Date { constructor(...a) { if (a.length) super(...a); else super(FEST); } static now() { return FEST; } }

function lauf(ctxOpt) {
  const C = umgebung(Object.assign({ Date: FesteZeit }, ctxOpt || {}));
  const M = C.DpGrafikenPremium.MODELL, P = M.basis();
  return { C, M, P };
}

const { C, M, P } = lauf();
pruefe('Grundlage gelesen', P && P.J.length === 15 && P.kaufJ === 2024 && P.heute === 2026, P ? 'Jahre ' + P.J.length + ', Kauf ' + P.kaufJ + ', heute ' + P.heute : 'keine');
pruefe('Anschlusszins aus der App abgeleitet', P.azQuelle === 'App' && Math.abs(P.az - 0.03763) < 0.0002 && Math.abs(P.at - 0.02137) < 0.0003, (P.az * 100).toFixed(3) + ' % / ' + (P.at * 100).toFixed(3) + ' %');

/* A */
function basisGleich(M2, P2) {
  const B = M2.rechne(P2, {}); let max = 0;
  P2.J.forEach(r => { const b = B.rows.find(x => x.j === r.j); max = Math.max(max, Math.abs(b.cfns - r.cfns), Math.abs(b.cfop - r.cfop), Math.abs(b.rs - r.rs)); });
  return max;
}
const devA = basisGleich(M, P);
pruefe('A Basisfall = App in allen 15 Jahren', devA < 0.5, 'größte Abweichung ' + devA.toFixed(2) + ' €');

/* B */
const Bz = M.rechne(P, { zA: P.az }); let devB = 0;
P.J.filter(r => r.j > P.bindEnde).forEach(r => { const b = Bz.rows.find(x => x.j === r.j); devB = Math.max(devB, Math.abs(b.cfns - r.cfns)); });
pruefe('B Anschluss-Formel mit App-Zins trifft die App', devB <= 15, 'größte Abweichung ' + devB.toFixed(1) + ' € im Jahr');

/* C */
const N = C.DpGrafikenNeu._test, r26 = P.J.find(r => r.j === 2026);
const wf = N.wasserfall({ breite: 600, hoehe: 240, schritte: [{ name: 'Miete', wert: r26.nkm, art: 'start' }, { name: 'Kosten', wert: -r26.bwk }, { name: 'Zins', wert: -r26.zins }, { name: 'Tilgung', wert: -r26.tilg }, { name: 'vor Steuer', art: 'summe' }, { name: 'Steuer', wert: r26.cfns - r26.cfop }, { name: 'nach Steuer', art: 'summe' }] });
const ende = wf.zeilen[wf.zeilen.length - 1].b, vorSt = wf.zeilen[4].b;
pruefe('C Brücke endet beim Cashflow nach Steuer der App', Math.abs(ende - r26.cfns) <= 1, Math.round(ende) + ' gegen ' + r26.cfns);
pruefe('C Brücke: Summe vor Steuer = Cashflow vor Steuer der App', Math.abs(vorSt - r26.cfop) <= 1, Math.round(vorSt) + ' gegen ' + r26.cfop);

/* D */
const D = C.DpGrafikenPremium._mieteuro(P), sE = D.ein.reduce((s, a) => s + a.v, 0), sA = D.aus.reduce((s, a) => s + a.v, 0);
pruefe('D Mieteuro: Zufluss = Abfluss', Math.abs(sE - sA) < 1, Math.round(sE) + ' = ' + Math.round(sA));
pruefe('D Mieteuro: Zufluss = Miete + Erstattung + eigene Tasche (+ Sonstiges)', Math.abs(D.ein.filter(a => a.n !== 'Sonstiges').reduce((s, a) => s + a.v, 0) - (r26.nkm + 512 + 703)) <= 1);

/* E */
const sz = { rows: [{ j: 2024, cfns: 0, wert: 0, rs: 0, afa: 0 }, { j: 2025, cfns: 0, wert: 121 / 0.97, rs: 0, afa: 0 }], ekEins: 100, gi: 100 };
const Pe = Object.assign({}, P, { privat: true, kaufJ: 2010 });
const e1 = M.irr(Pe, sz, 2025);
pruefe('E IRR bekannter Fall: −100, nach zwei Jahren 121 → 10 %', e1 && Math.abs(e1.irr - 10) < 0.05, e1 ? e1.irr.toFixed(3) + ' %' : 'null');
const iLo = M.irr(P, M.rechne(P, { wDelta: -0.01 }), 2044).irr, iB = M.irr(P, M.rechne(P, {}), 2044).irr, iHi = M.irr(P, M.rechne(P, { wDelta: 0.01 }), 2044).irr;
pruefe('E IRR steigt mit der Wertsteigerung', iLo < iB && iB < iHi, iLo.toFixed(2) + ' < ' + iB.toFixed(2) + ' < ' + iHi.toFixed(2));
pruefe('E ohne Eigenkapital kein IRR', M.irr(P, Object.assign({}, M.rechne(P, {}), { ekEins: 0 }), 2044) === null);
const i33 = M.irr(P, M.rechne(P, {}), 2033), i34 = M.irr(P, M.rechne(P, {}), 2034);
pruefe('E Spekulationsfrist: 2033 steuerpflichtig, 2034 frei', i33 && i34 && !i33.frei && i34.frei);

/* F */
const T = M.hebel(P, 2044);
pruefe('F Hebel-Basis = IRR des Basisfalls', T && Math.abs(T.basis - iB) < 1e-9, T ? T.basis.toFixed(3) : 'null');
pruefe('F jede Spanne enthält die Basis', T && T.T.every(t => Math.min(t.lo, t.hi) <= T.basis + 1e-9 && Math.max(t.lo, t.hi) >= T.basis - 1e-9), T ? T.T.length + ' Hebel' : '');
pruefe('F im Bestand kein Kaufpreis-Hebel', T && !T.T.some(t => /Kaufpreis/.test(t.n)));
const ank = lauf({ felder: { kaufdat: '2026-12-01' } });
const Ta = ank.M.hebel(ank.P, 2046);
pruefe('F im Ankauf mit Kaufpreis-Hebel', Ta && Ta.T.some(t => /Kaufpreis/.test(t.n)));

/* G */
const H = M.heat(P);
const basisZelle = H.G[H.ri][H.ci], soll = M.rechne(P, { zA: H.Z[H.ci] / 100 }).rows.find(r => r.j === H.jahr).cfns / 12;
pruefe('G Heatmap-Basiszelle = Szenario mit dem Spaltenzins', Math.abs(basisZelle - soll) < 0.01, basisZelle.toFixed(1) + ' €/Monat, Jahr ' + H.jahr);
pruefe('G Heatmap: höherer Zins nie besser', H.G.every(z => z.every((v, i) => i === 0 || v <= z[i - 1] + 1e-9)));
pruefe('G Heatmap: mehr Miete nie schlechter', H.Z.every((_, c) => H.G.every((z, r) => r === 0 || z[c] <= H.G[r - 1][c] + 1e-9)));
pruefe('G Heatmap-Spalten um den App-Zins', H.Z[0] < P.az * 100 && H.Z[H.Z.length - 1] > P.az * 100, H.Z[0] + ' bis ' + H.Z[H.Z.length - 1] + ' %');

/* H */
const mc1 = M.monteCarlo(P, 300), mc2 = M.monteCarlo(P, 300);
pruefe('H P10 ≤ Mitte ≤ P90 je Jahr', mc1.p10.every((v, i) => v <= mc1.p50[i] && mc1.p50[i] <= mc1.p90[i]));
pruefe('H fester Startwert: zweimal gleich', JSON.stringify(mc1.p50) === JSON.stringify(mc2.p50));

/* I · v4250 Theme und Mieteuro */
const Fb = C.DpGrafiken.farben;
pruefe('I Farben hängen an Theme-Variablen', /^var\(--gx-/.test(Fb.tinte) && /^var\(--gx-/.test(Fb.karte) && Fb.gruen === '#3FA56C', Fb.tinte);
const hHost = { clientWidth: 600, innerHTML: '', classList: { contains: () => false, add() {} }, closest: () => null, appendChild() {}, addEventListener() {}, querySelector: () => null };
C.DpGrafiken.heatmap(hHost, { spalten: [3, 4, 5], zeilen: [-10, 0, 10], werte: [[-50, -80, -120], [20, -10, -40], [90, 60, 30]], basis: { z: 1, s: 1 } }, { breite: 600 });
pruefe('I Heatmap: color-mix, kein NaN', /color-mix\(in srgb,#3FA56C \d+%,var\(--gx-flaeche\)\)/.test(hHost.innerHTML) && !/NaN|undefined/.test(hHost.innerHTML));
const je100 = D.aus.filter(a => a.v > 0.5).reduce((s, a) => s + a.v / r26.nkm * 100, 0), ein100 = D.ein.filter(a => a.v > 0.5).reduce((s, a) => s + a.v / r26.nkm * 100, 0);
pruefe('I Mieteuro je 100 € Miete: Wohin = Woher', Math.abs(je100 - ein100) < 0.1, je100.toFixed(1) + ' = ' + ein100.toFixed(1));

/* J · v4250 Reiter Bewertung: Vermögensaufbau und Vermögenszuwachs */
const BEW = fs.readFileSync(path.join(WURZEL, 'frontend/js/grafiken-bewertung.js'), 'utf8');
function bewertung(vz, opt) {
  opt = opt || {};
  const doc = { readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], documentElement: { getAttribute: () => null }, head: { appendChild() {} }, createElement: () => ({}), body: { classList: { add() {} } } };
  const R = cfRows.map((r, i) => Object.assign({}, r, { wert_y: i === 0 ? 145000 : r.wert_y, cal: 2024 + i }));
  const win = { State: { cfRows: R, wstg: opt.wstg != null ? opt.wstg : 0.015, bindj: 10, kpis: { ek: 35000, d1: 125000 }, _vz: vz }, matchMedia: () => ({ matches: true }), addEventListener() {}, document: doc };
  win.window = win;
  const ctx = vm.createContext(Object.assign(win, { document: doc, Intl, Math, Date: FesteZeit, console, setTimeout, clearTimeout }));
  vm.runInContext(BEW, ctx, { filename: 'grafiken-bewertung.js' });
  return ctx;
}
const vzB = { tilg_durch_einnahmen: 38000, bspar_durch_einnahmen: 2381.12, tilg_eigenanteil: 1500, cf_ueberschuss_konto: 6540.4, tax_kum: 4409.77, steuervorteil: 0, wertsteig_kum: 36283.65 };
vzB.verm_zuwachs = vzB.tilg_durch_einnahmen + vzB.bspar_durch_einnahmen + vzB.cf_ueberschuss_konto + (-vzB.tax_kum) + vzB.wertsteig_kum;   /* wie calc.js verm_zuwachs_v88 */
const GB = bewertung(vzB).DpGrafikenBewertung, ZT = GB._zuwachsTeile();
pruefe('J Zuwachs: Summe der vier Quellen = Vermögenszuwachs der App', ZT && Math.abs(ZT.summe - vzB.verm_zuwachs) < 0.01, ZT ? Math.round(ZT.summe) + ' = ' + Math.round(vzB.verm_zuwachs) : 'null');
pruefe('J Zuwachs: gezahlte Steuer mindert', ZT && ZT.T[2].v < 0 && ZT.T[2].u === 'gezahlt');
pruefe('J Zuwachs-Karte meldet „Prüfung: die Summe entspricht“', /Summe entspricht dem Vermögenszuwachs der App/.test(GB._zuwachsHtml()));
const VD = GB._vermDaten(), zl = VD.Z[VD.n - 1];
pruefe('J Aufbau: Wert am Ende = Startwert × 1,015^Jahre', Math.abs(zl.wert - 145000 * Math.pow(1.015, VD.n)) < 0.01, Math.round(zl.wert) + ' €, ' + VD.n + ' Jahre');
pruefe('J Aufbau: Eigenkapital = Wert − Restschuld je Jahr', VD.Z.every(z => Math.abs(z.ek - (z.wert - z.rs)) < 1e-6) && Math.abs(zl.rs - cfRows[cfRows.length - 1].rs) < 0.01);

/* X Gegenprobe */
const orig = M.rechne;
M.rechne = function () { const z = orig.apply(this, arguments); z.rows.forEach(r => { if (r.j === 2030) r.cfns += 5; }); return z; };
const devX = basisGleich(M, P);
M.rechne = orig;
pruefe('X Gegenprobe: 5 € Fehler macht A rot', devX >= 4.9, 'Abweichung ' + devX.toFixed(1) + ' €');
const vzX = Object.assign({}, vzB, { verm_zuwachs: vzB.verm_zuwachs + 50 });
pruefe('X Gegenprobe: verfälschter Zuwachs meldet Abweichung', /Abweichung zur App/.test(bewertung(vzX).DpGrafikenBewertung._zuwachsHtml()));

gruen.forEach(t => console.log('  ok   ' + t));
fehler.forEach(t => console.log('  ROT  ' + t));
console.log(fehler.length ? 'grafiken-neu-pruefen: ' + gruen.length + ' gruen, ' + fehler.length + ' rot' : 'SAUBER · ' + gruen.length + ' Prüfpunkte grün');
process.exit(fehler.length ? 1 : 0);
