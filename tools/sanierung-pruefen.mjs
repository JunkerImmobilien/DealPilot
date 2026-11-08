/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/sanierung-pruefen.mjs · v3214
   Backlog N137 (W-15): weitere Sanierungen in spaeteren Jahren - Liste
   im versteckten Feld #san_plan, Cashflow im Jahr, Steuer nach Art.

   Laedt die ECHTEN Module:
     frontend/js/calc.js            -> nur parseDe() (herausgeschnitten)
     frontend/js/sanierung-plan.js  -> DpSanierungPlan (jeJahr, steuerJahr, kern)
     frontend/js/tax.js             -> _computeAutoForYear() (Steuer je Jahr,
                                       daraus rechnet calc.js tax_y der Projektion)
   und spielt erfundene Faelle durch:
     A  ohne Liste: Steuer je Jahr bitgleich mit und ohne sanierung-plan.js
     B  ein Eintrag Erhaltung im Jahr 2 (sofort und verteilt)
     C  Herstellung erhoeht die AfA ab ihrem Jahr
     D  15-%-Grenze ueberschritten (Sanierung + Erhaltung im Fenster)
     E  Verdrahtung: storage.js speichert/leert san_plan, calc.js zieht san_y
        im Cashflow ab und nicht in gi, index.html laedt das Modul

   Aufruf aus dem Repo-Wurzelverzeichnis:  node tools/sanierung-pruefen.mjs [--laut]
   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => fs.readFileSync(path.join(WURZEL, d), 'utf8');
let fehler = 0, geprueft = 0;
const melde = (ok, text, ist) => {
  geprueft++;
  if (!ok) fehler++;
  if (!ok || process.argv.includes('--laut')) console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (ok ? '' : '  -> ist: ' + JSON.stringify(ist)));
};
const nahe = (a, b, tol = 0.01) => Math.abs((a || 0) - (b || 0)) <= tol;

/* parseDe aus dem echten calc.js (die Funktion steht dort auf oberster Ebene) */
const calcSrc = lies('frontend/js/calc.js');
const mParse = calcSrc.match(/function parseDe\(s\) \{[\s\S]*?\r?\n\}\r?\n/);
if (!mParse) { console.log('FEHL  parseDe in calc.js nicht gefunden'); process.exit(1); }

function umgebung(mitPlan) {
  const felder = {};
  const feld = (id, value = '', extra = {}) => (felder[id] = Object.assign({ id, value, checked: false, dispatchEvent() {}, addEventListener() {} }, extra));
  feld('san_plan'); feld('san', ''); feld('san_ust', 'brutto'); feld('san_tax_active', '', { checked: true });
  feld('san_tax_years', 'auto'); feld('afa_satz', '2.0'); feld('kp', '300000'); feld('moebl', '');
  feld('wirtschaftlicher_uebergang', '01.01.2026'); feld('kaufdat', '');
  feld('nkm', '1000'); feld('ze', ''); feld('mietstg', '1,5'); feld('umlagef', ''); feld('kostenstg', '1,0');
  const sandbox = {
    console, Math, JSON, Date, isFinite, isNaN, parseFloat, parseInt,
    document: {
      getElementById: (id) => felder[id] || null,
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener: () => {}, createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
      body: { appendChild() {} }, readyState: 'complete'
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Event: function () {}, setTimeout: () => 0, clearTimeout() {}, fetch: async () => ({ ok: false, json: async () => ({}) }),
    State: { _ahk: { sanLimit: 29700, nkQuote: 0 }, cfRows: null, _afaSeriesNormal: Array(60).fill(3000), _afaSeriesSonder: [], kpis: { afa: 3000 }, _afaBreakdown: { gebaeude: 3000, kueche: 0 } }
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(mParse[0] + '\nwindow.parseDe = parseDe;', sandbox, { filename: 'calc.js#parseDe' });
  if (mitPlan) vm.runInContext(lies('frontend/js/sanierung-plan.js'), sandbox, { filename: 'sanierung-plan.js' });
  vm.runInContext(lies('frontend/js/tax.js'), sandbox, { filename: 'tax.js' });
  if (typeof sandbox._computeAutoForYear !== 'function') { console.log('FEHL  _computeAutoForYear nicht geladen'); process.exit(1); }
  return { felder, sb: sandbox, jahr: (idx) => sandbox._computeAutoForYear(idx, 2026 + idx) };
}
const STEUERFELDER = ['afa', '_afaLinear', 'anschaffungsnah', 'erhaltungsaufwand', 'sonst_bewegl_wg', 'einnahmen_km'];
const reihe = (U, n = 12) => Array.from({ length: n }, (_, i) => { const o = U.jahr(i); return STEUERFELDER.map((k) => Math.round((o[k] || 0) * 100) / 100); });

console.log('Weitere Sanierungen (N137): Liste -> Cashflow je Jahr und Steuer je Jahr');

/* A · ohne Liste: bitgleich - drei Ausgangslagen fuer #san (keine, unter, ueber der Grenze) */
for (const [san, txt] of [['', 'ohne Sanierung'], ['20000', 'Sanierung 20.000 unter der Grenze'], ['40000', 'Sanierung 40.000 ueber der Grenze']]) {
  const alt = umgebung(false), neu = umgebung(true);
  alt.felder.san.value = san; neu.felder.san.value = san;
  melde(JSON.stringify(reihe(alt)) === JSON.stringify(reihe(neu)), 'A ohne Liste, ' + txt + ': Steuer je Jahr bitgleich mit/ohne sanierung-plan.js', { alt: reihe(alt)[0], neu: reihe(neu)[0] });
  neu.felder.san_plan.value = '[]';
  melde(JSON.stringify(reihe(alt)) === JSON.stringify(reihe(neu)), 'A leere Liste "[]", ' + txt + ': bitgleich', reihe(neu)[0]);
  melde(JSON.stringify(neu.sb.DpSanierungPlan.jeJahr()) === '{}', 'A ohne Eintraege: kein Cashflow', neu.sb.DpSanierungPlan.jeJahr());
}
{ const U = umgebung(true); U.felder.san_plan.value = '{kaputt'; melde(JSON.stringify(reihe(U)) === JSON.stringify(reihe(umgebung(false))), 'A kaputtes JSON: wie ohne Liste', reihe(U)[0]); }

/* B · ein Eintrag Erhaltung im Jahr 2 (2027) */
{
  const U = umgebung(true), basis = umgebung(false);
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Bad', jahr: 2027, betrag: 10000, art: 'erhaltung', vert: 'auto' }]);
  melde(JSON.stringify(U.sb.DpSanierungPlan.jeJahr()) === JSON.stringify({ 2027: 10000 }), 'B Cashflow: 10.000 EUR einmalig 2027', U.sb.DpSanierungPlan.jeJahr());
  melde(nahe(U.jahr(1).erhaltungsaufwand, 10000), 'B Steuer 2027: Erhaltungsaufwand 10.000 sofort', U.jahr(1).erhaltungsaufwand);
  melde(nahe(U.jahr(0).erhaltungsaufwand, 0) && nahe(U.jahr(2).erhaltungsaufwand, 0), 'B 2026 und 2028 ohne Erhaltungsaufwand', [U.jahr(0).erhaltungsaufwand, U.jahr(2).erhaltungsaufwand]);
  melde(nahe(U.jahr(1).afa, basis.jahr(1).afa) && nahe(U.jahr(1).anschaffungsnah, 0), 'B AfA unveraendert, nichts anschaffungsnah', [U.jahr(1).afa, U.jahr(1).anschaffungsnah]);
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Bad', jahr: 2027, betrag: 10000, art: 'erhaltung', vert: '4' }]);
  melde([1, 2, 3, 4].every((i) => nahe(U.jahr(i).erhaltungsaufwand, 2500)) && nahe(U.jahr(5).erhaltungsaufwand, 0), 'B verteilt auf 4 Jahre: 2027-2030 je 2.500, 2031 nichts', [1, 2, 3, 4, 5].map((i) => U.jahr(i).erhaltungsaufwand));
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Bad', jahr: 2027, betrag: 10000, art: '', vert: 'auto' }]);
  melde(nahe(U.jahr(1).erhaltungsaufwand, 0) && JSON.stringify(U.sb.DpSanierungPlan.jeJahr()) === '{"2027":10000}', 'B ohne Art: nur Cashflow, keine Steuer', U.jahr(1).erhaltungsaufwand);
  /* mit #san im Jahr 1 (sofort): beide Betraege im jeweiligen Jahr */
  U.felder.san.value = '5000';
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Bad', jahr: 2026, betrag: 3000, art: 'erhaltung', vert: 'auto' }]);
  melde(nahe(U.jahr(0).erhaltungsaufwand, 8000), 'B #san 5.000 + Eintrag 3.000 im Kaufjahr: 8.000 Erhaltungsaufwand 2026', U.jahr(0).erhaltungsaufwand);
}

/* C · Herstellung erhoeht die AfA ab ihrem Jahr (2 %, 20.000 -> 400 je Jahr, 50 Jahre) */
{
  const U = umgebung(true), basis = umgebung(false);
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Dachausbau', jahr: 2028, betrag: 20000, art: 'herstellung' }]);
  melde(nahe(U.jahr(1).afa, basis.jahr(1).afa), 'C 2027 (vor dem Jahr): AfA unveraendert', [U.jahr(1).afa, basis.jahr(1).afa]);
  melde(nahe(U.jahr(2).afa - basis.jahr(2).afa, 400) && nahe(U.jahr(11).afa - basis.jahr(11).afa, 400), 'C ab 2028: AfA + 400 (20.000 x 2 %), auch 2037', [U.jahr(2).afa - basis.jahr(2).afa, U.jahr(11).afa - basis.jahr(11).afa]);
  melde(nahe(U.jahr(2)._afaLinear - basis.jahr(2)._afaLinear, 400), 'C _afaLinear (Anlage V Z. 35) traegt die 400 mit', U.jahr(2)._afaLinear);
  melde(nahe(U.jahr(2).erhaltungsaufwand, 0) && nahe(U.jahr(2).anschaffungsnah, 0), 'C kein Sofortabzug', [U.jahr(2).erhaltungsaufwand, U.jahr(2).anschaffungsnah]);
  const r = U.sb.DpSanierungPlan.kern.steuerAus([{ jahr: 2028, betrag: 20000, art: 'herstellung' }], { afaSatz: 3 });
  const summe = Object.values(r.jahre).reduce((a, j) => a + j.afa, 0);
  melde(nahe(summe, 20000) && nahe(r.jahre[2061].afa, 200) && !r.jahre[2062], 'C 3 %: 33 Jahre je 600, im 34. Jahr der Rest 200, Summe 20.000', { summe, letzt: r.jahre[2061] });
}

/* D · 15-%-Grenze (29.700 netto): #san 20.000 brutto (16.807 netto) allein darunter,
       + Erhaltung 2027 20.000 brutto (16.807 netto) = 33.613 netto -> darueber */
{
  const U = umgebung(true);
  U.felder.san.value = '20000';
  melde(nahe(U.jahr(0).erhaltungsaufwand, 20000) && nahe(U.jahr(0).anschaffungsnah, 0), 'D vorher: #san 20.000 allein unter der Grenze -> sofort', [U.jahr(0).erhaltungsaufwand, U.jahr(0).anschaffungsnah]);
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Kueche', jahr: 2027, betrag: 20000, art: 'erhaltung', vert: 'auto' }]);
  melde(nahe(U.jahr(0).erhaltungsaufwand, 0) && nahe(U.jahr(0).anschaffungsnah, 400), 'D #san wird anschaffungsnah: 2026 AfA 400 statt 20.000 sofort', [U.jahr(0).erhaltungsaufwand, U.jahr(0).anschaffungsnah]);
  melde(nahe(U.jahr(1).anschaffungsnah, 800) && nahe(U.jahr(1).erhaltungsaufwand, 0), 'D 2027: #san 400 + Kueche 400 anschaffungsnah, kein Erhaltungsaufwand', [U.jahr(1).anschaffungsnah, U.jahr(1).erhaltungsaufwand]);
  const r = U.sb.DpSanierungPlan.kern.steuerAus(JSON.parse(U.felder.san_plan.value), { A: 2026, grenze: 29700, sanNetto: 20000 / 1.19, ust: 'brutto', afaSatz: 2 });
  melde(r.ueber === true && nahe(r.summeNetto, 40000 / 1.19, 0.5), 'D Kern: ueber = true, Summe 33.613 netto', r);
  /* feste Verteilung bleibt die Wahl des Nutzers - mit Warnung */
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Kueche', jahr: 2027, betrag: 20000, art: 'erhaltung', vert: '1' }]);
  const r1 = U.sb.DpSanierungPlan.kern.steuerAus(JSON.parse(U.felder.san_plan.value), { A: 2026, grenze: 29700, sanNetto: 20000 / 1.19, ust: 'brutto', afaSatz: 2 });
  melde(r1.behandlung[0].art === 'erhaltung' && r1.behandlung[0].warnung === true, 'D Verteilung "1 Jahr": bleibt Erhaltung, mit Warnung', r1.behandlung[0]);
  /* ausserhalb des Fensters (2030 > 2026 + 3) zaehlt nicht */
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Kueche', jahr: 2030, betrag: 20000, art: 'erhaltung', vert: 'auto' }]);
  melde(nahe(U.jahr(0).erhaltungsaufwand, 20000) && nahe(U.jahr(4).erhaltungsaufwand, 20000), 'D Eintrag 2030 ausserhalb der drei Jahre: zaehlt nicht zur Grenze, sofort 2030', [U.jahr(0).erhaltungsaufwand, U.jahr(4).erhaltungsaufwand]);
  /* Herstellung zaehlt nicht zur Grenze */
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Anbau', jahr: 2027, betrag: 50000, art: 'herstellung' }]);
  melde(nahe(U.jahr(0).erhaltungsaufwand, 20000), 'D Herstellung im Fenster zaehlt nicht zur 15-%-Grenze', U.jahr(0).erhaltungsaufwand);
  /* netto-Angabe: 20.000 netto + 9.000 netto = 29.000 <= 29.700 */
  U.felder.san_ust.value = 'netto';
  U.felder.san_plan.value = JSON.stringify([{ bez: 'Bad', jahr: 2028, betrag: 9000, art: 'erhaltung', vert: 'auto' }]);
  melde(nahe(U.jahr(0).erhaltungsaufwand, 20000) && nahe(U.jahr(2).erhaltungsaufwand, 9000), 'D netto 20.000 + 9.000 = 29.000 unter 29.700: beides sofort', [U.jahr(0).erhaltungsaufwand, U.jahr(2).erhaltungsaufwand]);
}

/* E · Verdrahtung (Textpruefung an den echten Dateien) */
{
  const st = lies('frontend/js/storage.js'), idx = lies('frontend/index.html');
  const felderListe = st.match(/var FIELDS\s*=\s*\[[\s\S]*?\];/);
  melde(!!felderListe && /'san_plan'/.test(felderListe[0]), 'E storage.js FIELDS speichert san_plan', null);
  const reset = st.match(/var resetFields = \[[\s\S]*?\]\.concat/);
  melde(!!reset && /'san_plan'/.test(reset[0]), 'E storage.js resetFields leert san_plan (kein Erbe von Objekt A)', null);
  melde(/<input type="hidden" id="san_plan"/.test(idx) && /id="san-plan-box"/.test(idx), 'E index.html: Feld #san_plan und Liste #san-plan-box', null);
  melde(/<script src="js\/sanierung-plan\.js\?v=/.test(idx), 'E index.html laedt sanierung-plan.js', null);
  melde(/DpSanierungPlan\.jeJahr\(\)/.test(calcSrc) && /san_y:san_y/.test(calcSrc) && /cfop_y -= san_y; cfns_y -= san_y;/.test(calcSrc), 'E calc.js: Cashflow je Jahr zieht san_y ab und fuehrt es in cfRows', null);
  melde(/var gi=kp\+nk\+v\('san'\);/.test(calcSrc) && !/gi=kp\+nk\+v\('san'\)\s*\+/.test(calcSrc), 'E calc.js: Gesamtinvestition bleibt kp + nk + san (Liste nicht darin)', null);
}

console.log((fehler ? 'ROT' : 'GRUEN') + ': ' + (geprueft - fehler) + '/' + geprueft + ' Pruefungen bestanden');
process.exit(fehler ? 1 : 0);
