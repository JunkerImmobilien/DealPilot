#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/ueberfuehrung-pruefen.mjs · v2984

   Prueft die Ueberfuehrung Privat -> Kapitalgesellschaft und die Steuer der
   Gesellschaft an den ECHTEN Dateien (per new Function geladen, nichts
   nachgebaut):

     frontend/js/ueberfuehrung-kern.js   Kern: GrESt, AK, AfA, § 23, Frist,
                                         KSt/GewSt mit Verlustvortrag, UG
     frontend/js/calc.js                 Privat-Schnitt im Stichtagsjahr
                                         (Block v816-CUT, ausgeschnitten)
     frontend/js/mandanten.js            effRate()/steuerParameter() —
                                         erweiterte Kuerzung einheitlich
     frontend/js/ueberfuehrung-wizard.js Zahleneingabe (_num)

   Sollwerte sind HANDGERECHNET (Pruefbericht Dateien/gmbh-ueberfuehrung-
   pruefung-20261027.md, Faelle A, A', B, C) plus Randfaelle.
   Aufruf: node tools/ueberfuehrung-pruefen.mjs     RC=0 sauber, 1 rot, 2 kaputt
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(WURZEL, 'frontend/js');
const lies = (f) => fs.readFileSync(path.join(JS, f), 'utf8').replace(/\r\n/g, '\n');

let rot = 0, gruen = 0;
function soll(name, ist, erwartet, tol = 0.5) {
  const ok = (typeof erwartet === 'number')
    ? (typeof ist === 'number' && isFinite(ist) && Math.abs(ist - erwartet) <= tol)
    : ist === erwartet;
  if (ok) gruen++; else { rot++; console.log('ROT  ' + name + ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(erwartet)); }
}

let K, calcSrc, mandSrc, wizSrc;
try {
  const win = {};
  new Function('window', 'globalThis', lies('ueberfuehrung-kern.js'))(win, win);
  K = win.DealPilotUeberfuehrungKern;
  if (!K) throw new Error('Kern nicht exportiert');
  calcSrc = lies('calc.js'); mandSrc = lies('mandanten.js'); wizSrc = lies('ueberfuehrung-wizard.js');
} catch (e) { console.error('KAPUTT: ' + e.message); process.exit(2); }

/* ── Fall A: ETW privat 07.07.2024 KP 132.000 (NK 8,5 %), Kauf durch VV-GmbH 01.01.2026 zum VW 145.000 ── */
const serieA = (akP) => { const j = akP * 0.8 * 0.02; return [j * 6 / 12, j, j]; };
{
  const akP = 132000 * 1.085;
  const ak = K.akGesellschaft({ art: 'kauf', kaufpreis: 145000, verkehrswert: 145000, satzPct: 6.5, notarPct: 2.0, bodenwert: 29000, baujahr: 1990, stichtag: '2026-01-01' });
  soll('A GrESt', ak.grest.betrag, 9425);
  soll('A GrESt-Quelle', ak.grest.quelle, 'gegenleistung');
  soll('A AK Gesellschaft', ak.ak, 157325);
  soll('A Gebaeude-AK', ak.gebaeudeAK, 125860);
  soll('A AfA/Jahr', ak.afaJahr, 2517.2, 0.05);
  soll('A AfA-Satz', ak.afaSatzPct, 2.0);
  soll('A 15-%-Grenze bis', ak.grenze15Bis, '2029-01-01');
  const afa = K.afaBisStichtag({ serie: serieA(akP), kaufdat: '2024-07-07', stichtag: '2026-01-01' });
  soll('A AfA bis Stichtag', afa, 3437.28, 0.01);
  const p = K.paragraph23({ art: 'kauf', kaufpreis: 145000, verkehrswert: 145000, kaufdat: '2024-07-07', stichtag: '2026-01-01', akPrivat: akP, afaBisher: afa });
  soll('A Frist', p.frist.art, 'steuerpflichtig');
  soll('A Fristende', p.frist.fristEnde, '2034-07-07');
  soll('A fortgefuehrte AK', p.fortgefuehrteAK, 139782.72, 0.01);
  soll('A Gewinn', p.gewinn, 5217.28, 0.01);
  soll('A steuerpflichtig', p.steuerpflichtig, true);
  const s = K.steuer23(p.gewinn, { grenzPct: 42 });
  soll('A Steuer 42 % + Soli', s.betrag, 2311.78, 0.01);
  /* Steuerlast-Weg: lineare Last 42 % ohne Soli gibt 42 % des Gewinns */
  const s2 = K.steuer23(p.gewinn, { zve: 80000, steuerLast: (z) => z * 0.42 });
  soll('A Steuer ueber steuerLast', s2.betrag, 2191.26, 0.01);

  /* A' — privat mit Makler 3,57 %: Gewinn 618 € unter der Freigrenze */
  const akP2 = 132000 * (1 + (3.57 + 8.5) / 100);
  const afa2 = K.afaBisStichtag({ serie: serieA(akP2), kaufdat: '2024-07-07', stichtag: '2026-01-01' });
  const p2 = K.paragraph23({ art: 'kauf', kaufpreis: 145000, verkehrswert: 145000, kaufdat: '2024-07-07', stichtag: '2026-01-01', akPrivat: akP2, afaBisher: afa2 });
  soll("A' Gewinn", p2.gewinn, 617.98, 0.01);
  soll("A' Freigrenze", p2.unterFreigrenze, true);
  soll("A' steuerpflichtig", p2.steuerpflichtig, false);
  const p3 = K.paragraph23({ art: 'kauf', kaufpreis: 145000, verkehrswert: 145000, kaufdat: '2024-07-07', stichtag: '2026-01-01', akPrivat: akP2, afaBisher: afa2, weitereGewinne: 400 });
  soll("A' mit weiteren 400 € -> Freigrenze ueberschritten", p3.steuerpflichtig, true);
  /* Makler privat aendert die AfA der Gesellschaft NICHT (war +3,3 %) */
  soll("A' AfA Gesellschaft unveraendert", ak.afaJahr, 2517.2, 0.05);

  /* A teilentgeltlich: Preis 100.000 < VW — § 23 auf den gemeinen Wert, GrESt auf den Preis */
  const t = K.akGesellschaft({ art: 'teilentgeltlich', kaufpreis: 100000, verkehrswert: 145000, satzPct: 6.5, notarPct: 2.0, bodenwert: 29000, baujahr: 1990 });
  soll('A teil GrESt auf Preis', t.grest.betrag, 6500);
  soll('A teil verdeckte Einlage', t.wert.verdeckteEinlage, 45000);
  soll('A teil AK', t.ak, 145000 + 6500 + 2900);
  const pt = K.paragraph23({ art: 'teilentgeltlich', kaufpreis: 100000, verkehrswert: 145000, kaufdat: '2024-07-07', stichtag: '2026-01-01', akPrivat: akP, afaBisher: afa });
  soll('A teil Veraeusserungspreis = gemeiner Wert', pt.veraeusserungspreis, 145000);
  soll('A teil Gewinn (nicht Preis − AK)', pt.gewinn, 5217.28, 0.01);
  /* Preis ueber VW: vGA, § 23 hoechstens VW */
  const pv = K.paragraph23({ art: 'kauf', kaufpreis: 160000, verkehrswert: 145000, kaufdat: '2024-07-07', stichtag: '2026-01-01', akPrivat: akP, afaBisher: afa });
  soll('A Preis > VW: vGA', pv.vga, 15000);
  soll('A Preis > VW: § 23-Preis = VW', pv.veraeusserungspreis, 145000);
}

/* ── Fall B: MFH privat seit 2010, verdeckte Einlage in GmbH 01.01.2026, VW 500.000, Boden 30 % ── */
{
  const b = K.akGesellschaft({ art: 'verdeckt', verkehrswert: 500000, satzPct: 6.5, notarPct: 1.5, bodenwert: 150000, baujahr: 1972, stichtag: '2026-01-01' });
  soll('B GrESt vorlaeufig auf VW', b.grest.betrag, 32500);
  soll('B GrESt vorlaeufig', b.grest.vorlaeufig, true);
  soll('B AK', b.ak, 540000);
  soll('B Gebaeude-AK', b.gebaeudeAK, 378000);
  soll('B AfA', b.afaJahr, 7560);
  const bg = K.akGesellschaft({ art: 'verdeckt', verkehrswert: 500000, grundbesitzwert: 420000, satzPct: 6.5, notarPct: 1.5, bodenwert: 150000, baujahr: 1972 });
  soll('B GrESt auf Grundbesitzwert', bg.grest.betrag, 27300);
  soll('B Quelle Grundbesitzwert', bg.grest.quelle, 'grundbesitzwert');
  const pb = K.paragraph23({ art: 'verdeckt', verkehrswert: 500000, kaufdat: '2010-03-01', stichtag: '2026-01-01', akPrivat: 310500, afaBisher: 90000 });
  soll('B § 23 frei', pb.steuerfrei, true);
  soll('B UG Sacheinlage gesperrt', K.artZulaessig('sacheinlage', 'ug').ok, false);
  soll('B GmbH Sacheinlage erlaubt', K.artZulaessig('sacheinlage', 'gmbh').ok, true);
  soll('B UG verdeckte Einlage erlaubt', K.artZulaessig('verdeckt', 'ug').ok, true);
  const sb = K.akGesellschaft({ art: 'sacheinlage', verkehrswert: 500000, satzPct: 6.5, notarPct: 1.5, bodenwert: 150000, baujahr: 1972 });
  soll('B Sacheinlage gegen Anteile', sb.wert.sacheinlage, 500000);
}

/* ── AfA-Saetze § 7 Abs. 4 ── */
soll('AfA vor 1925', K.afaSatzGesellschaft({ baujahr: 1910 }).satzPct, 2.5);
soll('AfA 2023', K.afaSatzGesellschaft({ baujahr: 2023 }).satzPct, 3.0);
soll('AfA Betriebsgebaeude', K.afaSatzGesellschaft({ baujahr: 1990, wohnzwecke: false }).satzPct, 3.0);
soll('AfA ohne Baujahr unsicher', K.afaSatzGesellschaft({}).sicher, false);

/* ── Zehnjahresfrist taggenau ── */
soll('Frist genau 10 Jahre noch steuerbar', K.frist23('2016-10-27', '2026-10-27').art, 'steuerpflichtig');
soll('Frist einen Tag danach frei', K.frist23('2016-10-27', '2026-10-28').art, 'frei');
soll('Frist ohne Kaufdatum', K.frist23('', '2026-01-01').art, 'unbekannt');

/* ── Stichtagsanteile: kein Monat doppelt ── */
for (const [st, p, gsl] of [['2026-01-01', 0, 12], ['2026-07-01', 6, 6], ['2026-03-15', 2, 10]]) {
  const a = K.stichtagAnteile(st);
  soll('Stichtag ' + st + ' privat', a.privatMonate, p);
  soll('Stichtag ' + st + ' Gesellschaft', a.gesellschaftMonate, gsl);
  soll('Stichtag ' + st + ' Summe 12', a.privatMonate + a.gesellschaftMonate, 12);
}
soll('Stichtag 15.03. nicht Monatserster', K.stichtagAnteile('2026-03-15').monatsErster, false);
soll('AfA bis 01.07.2026', K.afaBisStichtag({ serie: [1000, 2000, 2000], kaufdat: '2024-07-07', stichtag: '2026-07-01' }), 1000 + 2000 + 1000);
soll('AfA im Kaufjahr (Kauf 03/2026, Stichtag 07/2026)', K.afaBisStichtag({ serie: [1000], kaufdat: '2026-03-01', stichtag: '2026-07-01' }), 400);

/* ── calc.js: der echte Schnitt-Block (v816-CUT) ── */
{
  const a = calcSrc.indexOf('  var _v816cut = { active: false, factor: 1 };');
  const e = calcSrc.indexOf('  var mstg=v(\'mietstg\')', a);
  if (a < 0 || e < 0) { console.error('KAPUTT: Schnitt-Block in calc.js nicht gefunden'); process.exit(2); }
  const block = calcSrc.slice(a, e).replace(/try \{ if \(window\.State\) State\._v816cut[^\n]*\n/, '');
  /* DealPilotAnteilig steht im Block auch als nackter Name (Browser: window-Global) */
  const lauf = (felder, base, btj0) => { const DA = { getBaseYear: () => base };
    return new Function('g', 'window', 'DealPilotAnteilig', 'btj', 'State', '_calYearBase',
      block + '\nreturn { btj: btj, cut: _v816cut };')((id) => felder[id] || '', { DealPilotAnteilig: DA }, DA, btj0, {}, base); };
  let r = lauf({ ueberf_ende: '2026-01-01' }, 2024, 15);
  soll('calc 01.01.2026: Jahre privat', r.btj, 2);
  soll('calc 01.01.2026: letztes Jahr voll', r.cut.factor, 1);
  r = lauf({ ueberf_ende: '2026-07-01' }, 2024, 15);
  soll('calc 01.07.2026: Jahre', r.btj, 3);
  soll('calc 01.07.2026: Faktor 6/12 (war 7/12)', r.cut.factor, 0.5, 1e-9);
  r = lauf({ ueberf_ende: '2026-03-15' }, 2024, 15);
  soll('calc 15.03.2026: Faktor 2/12', r.cut.factor, 2 / 12, 1e-9);
  r = lauf({ ueberf_ende: '2026-07-01', wirtschaftlicher_uebergang: '2026-03-01' }, 2026, 15);
  soll('calc Kaufjahr = Stichtagsjahr: 4 von 10 Monaten', r.cut.factor, 0.4, 1e-9);
  r = lauf({ ueberf_ende: '2026-01-01', obj_herkunft: 'ueberfuehrung' }, 2026, 15);
  soll('calc Gesellschaftsobjekt mit geerbtem Ende wird NICHT gekappt', r.cut.active, false);
  soll('calc Gesellschaftsobjekt btj unveraendert', r.btj, 15);
  /* Summe privat + Gesellschaft im Stichtagsjahr = 12/12 (anteilig.js: (13 − m)/12) */
  for (const st of ['2026-01-01', '2026-07-01', '2026-03-15']) {
    const rr = lauf({ ueberf_ende: st }, 2024, 15), m = +st.slice(5, 7);
    const privat = (rr.btj === 3) ? rr.cut.factor : 0;
    soll('calc ' + st + ' privat + Gesellschaft = 1', privat + (13 - m) / 12, 1, 1e-9);
  }
  /* Gesellschaftsobjekt: _mtxYear ohne privaten ESt-Anteil */
  soll('calc _mtxYear ohne _estDelta-Split', /var _taxPrivat = _estDelta\(base \* _pf/.test(calcSrc), false);
}

/* ── Steuer der Gesellschaft (Fall C) ── */
{
  const mit = { kstSoliPct: 15.825, hebesatz: 450, erwKuerzung: true };
  const ohne = { kstSoliPct: 15.825, hebesatz: 450, erwKuerzung: false };
  soll('C mit erw. Kuerzung', K.steuerReihe([{ jahr: 2026, erg: 5730 }], mit)[0].steuer, 906.77, 0.01);
  const c2 = K.steuerReihe([{ jahr: 2026, erg: 5730, grundsteuer: 275 }], ohne)[0];
  soll('C ohne Kuerzung: Gewerbeertrag abgerundet', c2.gewerbeertrag, 5400);
  soll('C ohne Kuerzung: GewSt', c2.gewst, 850.5, 0.01);
  soll('C ohne Kuerzung: gesamt', c2.steuer, 1757.27, 0.01);
  const v = K.steuerReihe([{ jahr: 2026, erg: -4000 }, { jahr: 2027, erg: 3000 }, { jahr: 2028, erg: 3000 }], mit);
  soll('C Vortrag 2026', v[0].steuer, 0); soll('C Vortrag 2027', v[1].steuer, 0); soll('C Vortrag 2028', v[2].steuer, 316.5, 0.01);
  const vg = K.steuerReihe([{ jahr: 2026, erg: -4000 }, { jahr: 2027, erg: 3000 }, { jahr: 2028, erg: 3000 }], ohne);
  soll('C Vortrag ohne Kuerzung 2028 (KSt 316,50 + GewSt 315)', vg[2].steuer, 631.5, 0.01);
  soll('C Verlust keine Erstattung', K.steuerReihe([{ jahr: 2026, erg: -5000 }], ohne)[0].steuer, 0);
  const mb = K.steuerReihe([{ jahr: 2026, erg: -3000000 }, { jahr: 2027, erg: 2000000 }], mit);
  soll('Mindestbesteuerung 2027 (70 %)', mb[1].bemessung, 300000);
  const mb2 = K.steuerReihe([{ jahr: 2028, erg: -3000000 }, { jahr: 2029, erg: 2000000 }], mit);
  soll('Mindestbesteuerung 2029 (60 %)', mb2[1].bemessung, 400000);
  /* Tracker: gleiche Jahre ersetzen, neue Schleife beginnt ohne Vortrag */
  const tr = K.tracker(mit);
  tr.steuer(-4000, 2026); tr.steuer(3000, 2027); tr.steuer(3000, 2027);
  soll('Tracker gleiches Jahr ersetzt', tr.steuer(3000, 2028).steuer, 316.5, 0.01);
  soll('Tracker neue Schleife', tr.steuer(3000, 2026).steuer, 474.75, 0.01);
  const u = K.ausschuettung({ jahresueberschuss: 4823, rechtsform: 'ug' });
  soll('UG Ruecklage', u.ruecklage, 1205.75, 0.01);
  soll('UG KapESt auf 75 %', u.kapESt, 954.05, 0.01);
  soll('GmbH volle Ausschuettung', K.ausschuettung({ jahresueberschuss: 4823, rechtsform: 'gmbh' }).ausschuettbar, 4823);
  soll('Gesellschafterdarlehen 100 % -> Tarif', K.gesellschafterdarlehen({ betrag: 50000, zinsPct: 4, beteiligungPct: 100 }).tarif, true);
  soll('Gesellschafterdarlehen Zins', K.gesellschafterdarlehen({ betrag: 50000, zinsPct: 4, beteiligungPct: 100 }).zins, 2000);
  soll('Gesellschafterdarlehen 5 % -> Abgeltung', K.gesellschafterdarlehen({ betrag: 1, zinsPct: 1, beteiligungPct: 5 }).tarif, false);
}

/* ── Erweiterte Kuerzung: Anzeige und Rechnung sagen dasselbe ── */
{
  soll('erw. Kuerzung nie gespeichert -> aus', K.erwKuerzungStatus({}).aktiv, false);
  soll('erw. Kuerzung beantragt ohne Pruefung -> aus', K.erwKuerzungStatus({ erw_kuerzung: true }).aktiv, false);
  const alle = {}; K.PRUEFPUNKTE.forEach((x) => { alle[x.k] = true; });
  soll('erw. Kuerzung mit allen Pruefpunkten -> an', K.erwKuerzungStatus({ erw_kuerzung: true, erw_pruefung: alle }).aktiv, true);
  const body = mandSrc.match(/function effRate\(id\) \{[\s\S]*?\n  \}\n  function _erwStatus[\s\S]*?\n  \}\n  function _erwAktiv[^\n]*\n/);
  if (!body) { console.error('KAPUTT: effRate in mandanten.js nicht gefunden'); process.exit(2); }
  const eff = (regime) => new Function('_isPro', 'get', 'isCorp', 'document', 'window', body[0] + '\nreturn effRate;')(
    () => true, () => ({ rechtsform: 'gmbh', regime }), (rf) => rf === 'gmbh' || rf === 'ug', { getElementById: () => null }, { DealPilotUeberfuehrungKern: K })('x');
  soll('effRate nie gespeichert, Hebesatz 450', eff({ gewst: 450 }), 0.31575, 1e-9);
  soll('effRate beantragt ohne Pruefung', eff({ gewst: 450, erw_kuerzung: true }), 0.31575, 1e-9);
  soll('effRate mit allen Pruefpunkten', eff({ gewst: 450, erw_kuerzung: true, erw_pruefung: alle }), 0.15825, 1e-9);
  soll('Maske: Haken nur bei === true', /chk\('mand-f-kuerz', reg\.erw_kuerzung === true/.test(mandSrc), true);
}

/* ── Assistent: Zahleneingabe und Kopie ── */
{
  const m = wizSrc.match(/function _num\(x\) \{[\s\S]*?\n  \}/);
  const num = new Function(m[0] + '\nreturn _num;')();
  soll('_num 145.000', num('145.000'), 145000);
  soll('_num 3,85', num('3,85'), 3.85, 1e-9);
  soll('_num 3.85', num('3.85'), 3.85, 1e-9);
  soll('_num leer -> null', num(''), null);
  soll('Zins nicht mehr gerundet', /toFixed\(1\)\.replace\('\.', ','\)/.test(wizSrc), false);
  soll('Gesellschaftsobjekt erbt ueberf_ende nicht', /_g\.ueberf_ende = '';/.test(wizSrc), true);
  soll('Sanierung nicht uebernommen', /_g\.san = '0'/.test(wizSrc), true);
  soll('kein § 7b in der Gesellschaft', /_g\.afa_sonder7b_aktiv = false/.test(wizSrc), true);
  soll('kein BFH-2023-Zitat', /BFH 2023/.test(wizSrc), false);
}

console.log((rot ? 'ROT' : 'GRUEN') + ' · ' + gruen + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
