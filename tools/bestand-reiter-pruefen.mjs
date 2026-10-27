#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/bestand-reiter-pruefen.mjs · v2985

   Pilot-Analyse im BESTAND (Marcel 27.10.2026): zwei Reiterleisten.

   Prueft an den ECHTEN Dateien (frontend/js/ui.js, bestand-analyse.js,
   dscr-engine.js, backend openaiService.js), ersetzt wird nur die
   Umgebung (DOM-Attrappe, Ankauf-Stand, Ansicht, Marktbericht):

     A  Reiter: Bestand (Ankauf-Stand + Ist-Ansicht) -> Bestandsreiter in
        Marcels Reihenfolge, ohne Verhandlung/Bank; kein Ankauf-Stand und
        Soll-Ansicht -> die alten Reiter; alte Analyse im Bestand ->
        Bestandsreiter mit Hinweis „neu abrufen".
     B  Badges: Halten gruen, Optimieren gold, Verkauf pruefen rot.
     C  Anschlussfinanzierung gegen Handrechnung: 300.000 € zu 3 %, 1 %
        Tilgung, Start 01.01.2020, 10 Jahre Bindung.
     D  Exit: Zehnjahresfrist, Netto-Erloes, fehlt-Angaben.
     E  Prompt: exit_strategien nur mit Ankauf-Stand.

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import Module, { createRequire } from 'node:module';

const WURZEL = process.cwd();
let fehler = 0, geprueft = 0;
const melde = (ok, text) => { geprueft++; if (!ok) fehler++; console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text); };
const nah = (a, b, eps) => typeof a === 'number' && Math.abs(a - b) <= (eps || 0.01);

/* ── DOM-Attrappe ─────────────────────────────────────────────────── */
function elem() {
  return { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; }, innerHTML: '', value: '' };
}
const felder = {};
const document = {
  getElementById(id) { return Object.prototype.hasOwnProperty.call(felder, id) ? felder[id] : null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {}, removeEventListener() {}, createElement: elem,
  body: elem(), documentElement: elem(), head: elem()
};
const sandbox = {
  console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
  document, navigator: { userAgent: 'node' }, location: { href: '', search: '', hash: '' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, matchMedia() { return { matches: false, addListener() {} }; },
  getComputedStyle() { return {}; }, requestAnimationFrame() {}, CustomEvent: function () {}, Event: function () {},
  Intl, Date, Math, JSON, Number, String, Array, Object, RegExp, isFinite, isNaN, parseFloat, parseInt, Promise
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function lade(datei) {
  vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), sandbox, { filename: datei });
}
lade('frontend/js/dscr-engine.js');
lade('frontend/js/bestand-analyse.js');
lade('frontend/js/ui.js');
const W = sandbox;
melde(typeof W._renderAIServerAnalysis === 'function' || typeof vm.runInContext('typeof _renderAIServerAnalysis', sandbox) === 'string', 'ui.js geladen');
const render = (a) => vm.runInContext('_renderAIServerAnalysis', sandbox)(a);

function reiter(html) {
  const nav = /<nav class="dp-pa-rail">([\s\S]*?)<\/nav>/.exec(html);
  if (!nav) return [];
  return [...nav[1].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/·/g, '·'));
}

/* ── Umgebung je Fall ─────────────────────────────────────────────── */
function setze({ ankauf, soll }) {
  W.DealPilotAnkauf = ankauf ? { vorhanden: () => true, stand: () => ({ stichtag: '2023-07-01', daten: {} }), abweichung: () => null, KENNZAHLEN: [] } : { vorhanden: () => false, stand: () => null };
  W.DealPilotAnkaufAnsicht = { aktiv: () => !!soll };
  W._dpAnkauf = ankauf ? { daten: {} } : null;
}
const ALT_REITER = ['Briefing', 'Stärken & Risiken', 'Risiko & Szenarien', 'Lage & Markt', 'Wert & Marktpreis', 'Verhandlung & Offerte', 'Bank', 'Steuer'];
const BESTAND_REITER = ['Briefing', 'Wert & Marktpreis', 'Lage & Markt', 'Steuer', 'Anschlussfinanzierung', 'Exit-Strategien', 'Risiko & Szenarien'];
const neu = { bestand_modus: true, empfehlung: 'Halten', fazit_kurz: 'Halten', empfehlung_begruendung: 'PRUEF-BEGRUENDUNG',
  verhandlungsempfehlung: 'PRUEF-BESTANDSSTRATEGIE', bankargumente: ['PRUEF-BANKARGUMENT'],
  anschlussfinanzierung: [{ frage: 'PRUEF-FRAGE-AF', antwort: 'PRUEF-ANTWORT-AF' }],
  exit_strategien: [{ frage: 'PRUEF-FRAGE-EXIT', antwort: 'PRUEF-ANTWORT-EXIT' }] };
const altA = { empfehlung: 'Kaufen', fazit_kurz: 'Kaufen', verhandlungsempfehlung: 'PRUEF-VERHANDLUNG', anschlussfinanzierung: 'PRUEF-ALTER-ABSATZ', bankargumente: ['PRUEF-BANKARGUMENT'] };

console.log('\nA · Reiter je Ansicht');
setze({ ankauf: true, soll: false });
let h = render(neu);
melde(JSON.stringify(reiter(h)) === JSON.stringify(BESTAND_REITER), 'Bestand: ' + reiter(h).join(' | '));
melde(/data-dp-pa-ansicht="bestand"/.test(h), 'Bestand: Wrap markiert');
melde(h.includes('PRUEF-BESTANDSSTRATEGIE') && /BESTANDSSTRATEGIE/.test(h), 'Bestand: Bestandsstrategie im Briefing');
melde(h.includes('PRUEF-FRAGE-AF') && h.includes('PRUEF-ANTWORT-AF'), 'Bestand: Fragen zur Anschlussfinanzierung');
melde(h.includes('PRUEF-FRAGE-EXIT') && h.includes('PRUEF-ANTWORT-EXIT'), 'Bestand: Fragen zum Exit');
melde(h.includes('PRUEF-BANKARGUMENT') && h.includes('ARGUMENTE FÜR DIE BANK'), 'Bestand: Bankargumente unter Anschlussfinanzierung');
melde(h.includes('data-dp-bestand="anschluss"') && h.includes('data-dp-bestand="exit"'), 'Bestand: Platzhalter fuer die Rechnung');
melde(!h.includes('id="dp-pa-verh"') && !h.includes('id="dp-pa-bank"'), 'Bestand: kein Panel Verhandlung/Bank');
melde(!h.includes('Analyse neu abrufen'), 'Bestand neu: kein Hinweis "neu abrufen"');

setze({ ankauf: true, soll: false });
h = render(altA);
melde(JSON.stringify(reiter(h)) === JSON.stringify(BESTAND_REITER), 'Bestand, alte Analyse: Bestandsreiter');
melde((h.match(/Analyse neu abrufen/g) || []).length >= 2, 'Bestand, alte Analyse: Hinweis in beiden neuen Reitern');
melde(h.includes('noch als Kaufangebot'), 'Bestand, alte Analyse: Hinweis im Briefing');
melde(h.includes('PRUEF-ALTER-ABSATZ') && !h.includes('PRUEF-VERHANDLUNG'), 'Bestand, alte Analyse: alter Absatz bleibt, Verhandlung nicht');
melde(h.includes('data-dp-bestand="anschluss"'), 'Bestand, alte Analyse: Rechnung trotzdem');

setze({ ankauf: false });
h = render(altA);
melde(JSON.stringify(reiter(h)) === JSON.stringify(ALT_REITER), 'Ankauf: ' + reiter(h).join(' | '));
melde(h.includes('PRUEF-VERHANDLUNG') && !h.includes('data-dp-bestand='), 'Ankauf: Verhandlung, keine Bestandsrechnung');

setze({ ankauf: true, soll: true });
h = render(altA);
melde(JSON.stringify(reiter(h)) === JSON.stringify(ALT_REITER), 'Soll-Ansicht: alte Reiter');

console.log('\nB · Badges');
const st = vm.runInContext('_dpEmpfStufe', sandbox);
melde(st('Halten').farbe === '#3FA56C' && st('Halten').label === 'HALTEN', 'Halten gruen');
melde(/C9A84C/.test(st('Optimieren').farbe) && st('Optimieren').label === 'OPTIMIEREN', 'Optimieren gold');
melde(st('Verkauf prüfen').farbe === '#B8625C' && st('Verkauf prüfen').label === 'VERKAUF PRÜFEN', 'Verkauf pruefen rot');
melde(st('Kaufen').label === 'KAUFEN' && st('Nicht kaufen').label === 'NICHT KAUFEN' && st('Prüfen').label === 'PRÜFEN', 'Ankauf-Woerter unveraendert');

console.log('\nC · Anschlussfinanzierung gegen Handrechnung');
const B = W.DpBestand;
const heute = new Date(2026, 9, 27);
const r = B.darlehenRechnen({ name: 'D1', betrag: 300000, zins: 0.03, tilgung: 0.01, bindj: 10, start: new Date(2020, 0, 1) }, heute);
/* Hand: Jahresannuitaet A = 300.000 * 4 % = 12.000; Jahreszins auf die Restschuld zu
   Jahresbeginn (wie calc.js): R10 = S*q^10 - A*(q^10-1)/(q-1), q = 1,03 */
const q10 = Math.pow(1.03, 10), R = 300000 * q10 - 12000 * (q10 - 1) / 0.03;
melde(nah(R, 265608.0, 1), 'Handrechnung R10 = ' + R.toFixed(2) + ' € (Erwartung rund 265.608 €)');
melde(nah(r.restschuld, R, 0.01), 'Restschuld nach 10 J.: ' + (r.restschuld || 0).toFixed(2) + ' €');
melde(nah(r.rate_heute_m, 1000, 1e-9), 'Rate heute 1.000 €/Monat');
melde(r.ende && r.ende.getFullYear() === 2030 && r.ende.getMonth() === 0 && r.ende.getDate() === 1, 'Ende der Zinsbindung 01.01.2030');
melde(r.monate_bis_ende === 38, 'ab 27.10.2026 noch 38 Monate (' + r.monate_bis_ende + ')');
const soll = { 3: R * 0.04 / 12, 4: R * 0.05 / 12, 5: R * 0.06 / 12 };
[3, 4, 5].forEach((z) => {
  const s = r.anschluss.find((x) => x.zins_pct === z);
  melde(s && nah(s.rate_m, soll[z], 0.01) && nah(s.delta_m, soll[z] - 1000, 0.01), 'Anschluss ' + z + ' %: ' + (s ? s.rate_m.toFixed(2) : '–') + ' €/Monat (Hand ' + soll[z].toFixed(2) + ')');
});
const rf = B.darlehenRechnen({ name: 'D1', betrag: 300000, zins: 0.03, tilgung: 0.01, bindj: 10, start: null }, heute);
melde(rf.fehlt.some((x) => /Startdatum/.test(x)) && !rf.ende && nah(rf.restschuld, R, 0.01), 'ohne Startdatum: "fehlt", Restschuld trotzdem');
const ra = B.darlehenRechnen({ name: 'D1', betrag: 300000, zins: 0.03, tilgung: 0, bindj: 10, start: new Date(2020, 0, 1), typ: 'tilgungsaussetzung' }, heute);
melde(ra.restschuld === 300000 && !ra.anschluss.length && /Tilgungsaussetzung/.test(ra.hinweis || ''), 'Tilgungsaussetzung: Restschuld voll, keine Anschlussrate');

/* ueber State: D1-Restschuld aus calc.js (State.rs1) hat Vorrang, DSCR ueber Dscr.compute */
W.State = { d1z: 0.03, bindj: 10, rs1: 265000, d1_rate_monthly: 1000, d2_enabled: false,
  kpis: { d1: 300000, d1z_pct: 3, d1t_pct: 1, cf_m: 200, dscr: 1.25, kd_dscr: 12000, nkm_netto_j: 15000, ze_j: 0, bwk_cf: 0, kp: 350000, gi: 380000 },
  cfRows: [{ cal: 2026, rs: 280000 }] };
W.DealPilotAnteilig = { getFinanzierungStartDate: () => '2020-01-01' };
W.dpGetIndicativeZins = () => 3.7;
felder.anschl_z = { value: '4,5' };
const an = B.anschluss(heute);
const d1 = an.darlehen[0];
melde(d1.restschuld === 265000, 'State.rs1 hat Vorrang (265.000 €)');
const s4 = d1.anschluss.find((x) => x.zins_pct === 4);
const kd4 = 12000 + (265000 * 0.05 / 12 - 1000) * 12;
melde(s4 && nah(s4.dscr, 15000 / kd4, 1e-6) && nah(s4.cf_m, 200 - (265000 * 0.05 / 12 - 1000), 1e-6), 'DSCR/Cashflow nach Anschluss 4 %: ' + (s4 ? s4.dscr.toFixed(3) + ' / ' + s4.cf_m.toFixed(2) : '–'));
melde(d1.anschluss.some((x) => x.zins_pct === 3.7 && /Marktzins/.test(x.label || '')), 'Marktzins heute als eigene Zeile');
melde(d1.anschluss.some((x) => x.zins_pct === 4.5 && /Annahme/.test(x.label || '')), 'Annahme aus dem Reiter Finanzierung als eigene Zeile');

console.log('\nD · Exit');
felder.kaufdat = { value: '2019-06-14' };
W.DpWertZielbild = { bericht: () => ({ market_value: 400000, created_at: '2026-10-20T10:00:00Z' }) };
const x = B.exit(heute);
melde(x.frist_ende && x.frist_ende.getFullYear() === 2029 && x.frist_ende.getMonth() === 5 && x.frist_ende.getDate() === 14, 'Fristende 14.06.2029');
melde(x.monate_bis_frist === 31, 'noch 31 Monate (' + x.monate_bis_frist + ')');
melde(x.netto_erloes === 120000 && x.wertzuwachs === 20000 && x.beleihungsreserve === 40000, 'Netto-Erloes 120.000, Wertzuwachs 20.000, Spielraum 40.000');
melde(!x.fehlt.length, 'nichts fehlt');
felder.kaufdat = { value: '' }; W.DpWertZielbild = { bericht: () => null };
const x2 = B.exit(heute);
melde(x2.fehlt.some((f) => /Kaufdatum/.test(f)) && x2.fehlt.some((f) => /Marktbericht/.test(f)) && x2.netto_erloes == null, 'ohne Kaufdatum und Bericht: "fehlt", kein Erloes');
const pl = B.payload(heute);
melde(pl && pl.darlehen[0].restschuld_ende === 265000 && pl.restschuld_heute === 280000, 'payload() fuer den Prompt');
melde(/Exit|Netto-Erlös/.test(B.exitText()) && /Anschluss/.test(B.anschlussText()) && !/[−…]/.test(B.exitText() + B.anschlussText()), 'PDF-Text ohne U+2212/…');

console.log('\nE · Prompt');
const ERSATZ = { dotenv: { config() { return { parsed: {} }; } } };
const _l = Module._load;
Module._load = function (a) { if (a in ERSATZ) { try { return _l.apply(this, arguments); } catch (e) { return ERSATZ[a]; } } return _l.apply(this, arguments); };
const req = createRequire(path.join(WURZEL, 'backend', 'src', 'x.js'));
const oai = req('./services/openaiService.js');
const basis = { objekt: { adresse: 'Teststr. 1, 12345 Ort' }, kennzahlen: {}, finanzierung: {} };
const ohne = oai.buildPrompt(basis, {});
const mit = oai.buildPrompt(Object.assign({}, basis, { ankauf: { stichtag: '2023-07-01', abweichung: null }, bestand: pl }), {});
melde(!/"exit_strategien"/.test(ohne) && /"anschlussfinanzierung": "Restschuld/.test(ohne), 'ohne Ankauf-Stand: kein Exit-Feld, Anschluss als Absatz');
melde(/"exit_strategien"/.test(mit) && /"anschlussfinanzierung": \[/.test(mit) && /BESTAND: ANSCHLUSSFINANZIERUNG UND EXIT/.test(mit), 'mit Ankauf-Stand: Fragen-Felder und Rechenblock');

console.log('\n' + geprueft + ' Pruefungen, ' + fehler + ' rot.');
process.exit(fehler ? 1 : 0);
