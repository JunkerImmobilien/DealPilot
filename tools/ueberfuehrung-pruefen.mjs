#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/ueberfuehrung-pruefen.mjs · v2984, Gruppe v3470

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
  /* v3684: die einfache Kuerzung § 9 Nr. 1 S. 1 GewStG ist ab EZ 2025 die als Betriebsausgabe
     erfasste GRUNDSTEUER (Gesetz vom 02.12.2024, § 36 Abs. 4b GewStG). v3268 hatte faelschlich auf
     0,11 % des Grundsteuerwerts umgestellt. Grundsteuer 275 € -> dieselben Sollwerte wie bisher;
     ein Grundsteuerwert allein kuerzt nichts. */
  const c2 = K.steuerReihe([{ jahr: 2026, erg: 5730, grundsteuer: 275 }], ohne)[0];
  soll('C Grundsteuerwert allein keine Kuerzung (v3684)', K.steuerReihe([{ jahr: 2026, erg: 5730, grundsteuerwert: 250000 }], ohne)[0].gewerbeertrag, 5700);
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

/* ── v3470 · Gruppe: mehrere Objekte, je eigener Stichtag, bestehende Gesellschaft ──
   Handgerechnet. Fall G: drei Privatobjekte in die Muster Immobilien GmbH.
     G1 gekauft 01.04.2020, uebertragen 01.01.2026 (Frist laeuft bis 01.04.2030), Gewinn 600 €
     G2 gekauft 01.07.2023, uebertragen 01.07.2026, Gewinn 700 €
     G3 gekauft 01.02.2015, uebertragen 01.01.2027 (Frist abgelaufen)
   Einzeln laegen G1 und G2 unter der Freigrenze; zusammen 1.300 € >= 1.000 €
   -> beide steuerpflichtig (§ 23 Abs. 3 S. 5 EStG: Gesamtgewinn des Kalenderjahres). */
{
  const G1 = { key: 'g1', label: 'G1', kaufdat: '2020-04-01', stichtag: '2026-01-01', status: 'ueberfuehrt', gewinn23: 600, steuer23: 0, grest: 19500, steuerfrei23: false };
  const G2 = { key: 'g2', label: 'G2', kaufdat: '2023-07-01', stichtag: '2026-07-01', status: 'geplant' };
  const G3 = { key: 'g3', label: 'G3', kaufdat: '2015-02-01', stichtag: '2027-01-01', status: 'geplant' };
  const plan = [G3, G2, G1];
  const w2 = K.weitereGewinne(plan, 'g2', '2026-07-01');
  soll('Gruppe: weitere Gewinne fuer G2 aus G1', w2.betrag, 600);
  soll('Gruppe: G2 sieht kein offenes Objekt im Jahr', w2.offen.length, 0);
  const w1 = K.weitereGewinne(plan, 'g1', '2026-01-01');
  soll('Gruppe: G1 sieht G2 als offen (nicht als 0)', w1.offen.join(','), 'G2');
  soll('Gruppe: anderes Jahr zaehlt nicht', K.weitereGewinne(plan, 'g3', '2027-01-01').betrag, 0);
  /* Kette in den unveraenderten Kern: G2 allein 700 € waere frei, mit G1 steuerpflichtig */
  const p2allein = K.paragraph23({ art: 'kauf', kaufpreis: 100700, verkehrswert: 100700, kaufdat: '2023-07-01', stichtag: '2026-07-01', akPrivat: 100000, afaBisher: 0 });
  soll('Kette: G2 allein unter Freigrenze', p2allein.unterFreigrenze, true);
  const p2 = K.paragraph23({ art: 'kauf', kaufpreis: 100700, verkehrswert: 100700, kaufdat: '2023-07-01', stichtag: '2026-07-01', akPrivat: 100000, afaBisher: 0, weitereGewinne: w2.betrag });
  soll('Kette: G2 mit G1 Gesamtgewinn', p2.gesamtgewinnJahr, 1300);
  soll('Kette: G2 mit G1 steuerpflichtig', p2.steuerpflichtig, true);
  const ord = K.planOrdnen(plan);
  soll('Gruppe: nach Stichtag geordnet', ord.zeilen.map((e) => e.key).join(','), 'g1,g2,g3');
  soll('Gruppe: keine Fehler', ord.fehler.length, 0);
  soll('Gruppe: Stichtag vor Kauf ist Fehler', K.planOrdnen([{ key: 'x', label: 'X', kaufdat: '2026-05-01', stichtag: '2026-01-01' }]).fehler.length, 1);
  soll('Gruppe: doppeltes Objekt ist Fehler', K.planOrdnen([{ key: 'x', stichtag: '2026-01-01' }, { key: 'x', stichtag: '2027-01-01' }]).fehler.length, 1);
  const ausw = K.gruppeAuswerten(plan);
  soll('Gruppe: naechstes Objekt = fruehester geplanter Stichtag', ausw.naechster && ausw.naechster.key, 'g2');
  soll('Gruppe: Jahr 2026 zwei Objekte', ausw.jahre[0].anzahl, 2);
  soll('Gruppe: Jahr 2026 Freigrenze offen solange G2 geplant', ausw.jahre[0].unterFreigrenze, null);
  soll('Gruppe: GrESt 2026', ausw.jahre[0].grest, 19500);
  const fertig = K.gruppeAuswerten([G1, Object.assign({}, G2, { status: 'ueberfuehrt', gewinn23: 700 })]);
  soll('Gruppe: 2026 fertig, 1.300 € nicht unter Freigrenze', fertig.jahre[0].unterFreigrenze, false);
  soll('Gruppe: steuerfreies Objekt traegt nichts bei', K.weitereGewinne([{ key: 'a', stichtag: '2026-03-01', status: 'ueberfuehrt', gewinn23: null, steuerfrei23: true }], 'b', '2026-09-01').betrag, 0);
  /* Drei-Objekt-Grenze: nur Haltedauer <= 5 Jahre, Fenster 5 Jahre */
  soll('Drei-Objekt: G2 einziges kurz gehaltenes', K.dreiObjektGrenze(plan).anzahl, 1);
  const vier = [1, 2, 3, 4].map((i) => ({ key: 'k' + i, kaufdat: '2024-0' + i + '-01', stichtag: '2026-0' + i + '-01' }));
  soll('Drei-Objekt: vier in fuenf Jahren -> ueber der Grenze', K.dreiObjektGrenze(vier).ueberGrenze, true);
  soll('Drei-Objekt: drei -> nicht ueber der Grenze', K.dreiObjektGrenze(vier.slice(0, 3)).ueberGrenze, false);
  const gestreckt = vier.map((e, i) => ({ key: e.key, kaufdat: (2020 + 2 * i) + '-01-01', stichtag: (2021 + 2 * i) + '-01-01' }));
  soll('Drei-Objekt: ueber sieben Jahre gestreckt -> hoechstens drei im Fenster', K.dreiObjektGrenze(gestreckt).anzahl, 3);

  /* Plan am Mandanten (mandanten.js, echte Funktionen) */
  const body = mandSrc.match(/  function uewPlan\(corpId\) \{[\s\S]*?\n  function _uewNaechsterMonatserster/);
  if (!body) { console.error('KAPUTT: Plan-Funktionen in mandanten.js nicht gefunden'); process.exit(2); }
  const st = { list: [{ id: 'privat', rechtsform: 'privat' }, { id: 'm1', name: 'Muster Immobilien GmbH', rechtsform: 'gmbh' }, { id: 'm2', name: 'Zweite UG', rechtsform: 'ug' }] };
  let gespeichert = 0;
  const P = new Function('_state', 'upsert', 'isCorp', body[0].replace(/\n  function _uewNaechsterMonatserster$/, '') +
    '\nreturn { uewPlan, uewPlanFuer, uewPlanHinzu, uewPlanEntfernen, uewPlanErledigt, uewPlanZurueck };')(
    st, () => { gespeichert++; }, (rf) => rf === 'gmbh' || rf === 'ug');
  soll('Plan: zwei hinzugefuegt', P.uewPlanHinzu('m1', [{ key: 'o1', label: 'O1', stichtag: '2026-01-01' }, { key: 'o2', label: 'O2', stichtag: '2027-01-01' }]), 2);
  soll('Plan: gespeichert (Konto-Sync ueber upsert)', gespeichert > 0, true);
  soll('Plan: Objekt gehoert nur einer Gruppe', P.uewPlanHinzu('m2', [{ key: 'o1', stichtag: '2026-02-01' }]), 0);
  soll('Plan: Fundstelle', P.uewPlanFuer('o2').corpId, 'm1');
  P.uewPlanErledigt('m1', 'o1', { gewinn23: 500, gesellschaftKey: 'gm1' });
  soll('Plan: erledigt', P.uewPlanFuer('o1').eintrag.status, 'ueberfuehrt');
  soll('Plan: Ergebnis gespeichert', P.uewPlanFuer('o1').eintrag.gewinn23, 500);
  P.uewPlanErledigt('m1', 'o9', { label: 'O9 einzeln' });
  soll('Plan: Einzeluebertragung in bestehende GmbH wird Teil der Gruppe', P.uewPlan('m1').length, 3);
  P.uewPlanEntfernen('m1', 'o1');
  soll('Plan: Ueberfuehrtes laesst sich nicht entfernen', P.uewPlan('m1').length, 3);
  P.uewPlanEntfernen('m1', 'o2');
  soll('Plan: Geplantes entfernt', P.uewPlan('m1').length, 2);
  P.uewPlanZurueck('o1');
  soll('Plan: Aufheben setzt auf geplant', P.uewPlanFuer('o1').eintrag.status, 'geplant');
  soll('Plan: Aufheben loescht das Ergebnis', P.uewPlanFuer('o1').eintrag.gewinn23, undefined);

  /* Verdrahtung */
  soll('Assistent liest den Plan', /DealPilotMandanten\.uewPlanFuer\(_ck\)/.test(wizSrc), true);
  soll('Assistent gibt weitere Gewinne aus der Gruppe', /K\(\)\.weitereGewinne\(_plan\(\), _ctx\.privatKey, _ctx\._stichtag\)/.test(wizSrc), true);
  soll('Assistent traegt Ergebnis ein', /DealPilotMandanten\.uewPlanErledigt\(c\._halterId, _privatKey/.test(wizSrc), true);
  soll('Assistent rechnet weiter nur im Kern (paragraph23 unveraendert gerufen)', /k\.paragraph23\(\{ art: w\.art/.test(wizSrc), true);
  soll('Aufheben setzt Plan zurueck (zwei Wege)', (mandSrc.match(/try \{ uewPlanZurueck\(privatKey\)/g) || []).length, 2);
  soll('v3472: Privatobjekt wird vor dem Speichern neu gerechnet (Steuersaetze nach dem Einfrieren)', /if \(typeof calc === 'function'\) calc\(\); \} catch \(e\) \{\}\s*if \(typeof saveObj === 'function'\) await saveObj/.test(wizSrc), true);
  soll('Gesellschaftskarte: Objekte ueberfuehren', /openUeberfuehrung\(\\'' \+ esc\(m\.id\) \+ '\\'\)/.test(mandSrc), true);
}

console.log((rot ? 'ROT' : 'GRUEN') + ' · ' + gruen + ' gruen, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
