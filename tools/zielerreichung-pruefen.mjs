#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/zielerreichung-pruefen.mjs · v2989

   Jahresstände · Rechenstand · Zielerreichung (Marcel 27.10.2026).

   Prüft an den ECHTEN Dateien (frontend/js/ankauf.js, bestand-analyse.js,
   dscr-engine.js, jahresstaende.js, storage.js), ersetzt wird nur die
   Umgebung (DOM-Attrappe, State, Ansicht):

     A  Jahresstand: derselbe Jahrgang wird ersetzt, das Vorjahr bleibt
        eingefroren (dasselbe Objekt, Feld für Feld).
     B  Wächter: Soll-Ansicht, fremde Kennzahlen, kein Ankauf-Stand,
        Sicherung vor dem Umschalten -> kein Stand.
     C  Laden schreibt nicht: der Haken steht NUR in saveObj, nach
        collectData(); loadData() ruft ihn nicht.
     D  Rechenstand: höchster Buster der Rechenkerne; Satz bei unbekannt /
        verschieden, leer bei gleich. Festschreiben legt version + plan ab,
        der Ankauf trägt keine Jahresstände (keine Matrjoschka).
     E  Prozent gegen Handrechnung (Miete, Entschuldung, EK, Plan, Rendite,
        Gesamtmittel mit Begrenzung auf 0–100 %).
     F  Fehlende Zahlen -> „fehlt", zählen nicht; Plan ohne eingefrorene
        Projektion entfällt; Rendite erst ab dem zweiten Jahresstand.

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const WURZEL = process.cwd();
let fehler = 0, geprueft = 0;
const melde = (ok, text) => { geprueft++; if (!ok) fehler++; console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text); };
const nah = (a, b, eps) => typeof a === 'number' && Math.abs(a - b) <= (eps || 0.01);

/* ── DOM-Attrappe ─────────────────────────────────────────────────── */
function elem() {
  return { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, appendChild() {}, insertBefore() {}, querySelector() { return null; }, querySelectorAll() { return []; }, innerHTML: '', value: '' };
}
const felder = {};
let skripte = [];
const document = {
  getElementById(id) { return Object.prototype.hasOwnProperty.call(felder, id) ? felder[id] : null; },
  querySelector() { return null; },
  querySelectorAll(sel) { return sel === 'script[src]' ? skripte.map((src) => ({ getAttribute: () => src })) : []; },
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
const lade = (datei) => vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), sandbox, { filename: datei });
lade('frontend/js/dscr-engine.js');
lade('frontend/js/ankauf.js');
lade('frontend/js/bestand-analyse.js');
lade('frontend/js/jahresstaende.js');
const W = sandbox, J = W.DpJahresstaende;
melde(!!J && typeof J.rechne === 'function', 'jahresstaende.js geladen');
melde(typeof W.DealPilotAnkauf.kurzfassung === 'function', 'ankauf.js gibt kurzfassung heraus (EINE Quelle)');

/* ── Umgebung ─────────────────────────────────────────────────────── */
const ANKAUF = { stichtag: '2024-03-01', am: '2024-03-01T10:00:00Z', kurz: { nkm: 1000, _kpis_cf_ns: 2000 }, daten: { nkm: '1000', d1: '300000', ek: '80000' }, korrekturen: [] };
function umgebung({ soll = false, fuer = 'obj-1' } = {}) {
  W._currentObjKey = 'obj-1';
  W.State = { kpis: { _fuer: fuer, ek: 80000 }, cfRows: [
    { cal: 2025, rs: 290000, rs_d1: 290000, rs_d2: null, cfop_y: 5000 },
    { cal: new Date().getFullYear(), rs: 280000, rs_d1: 250000, rs_d2: 30000, cfop_y: 5500 }] };
  W.DealPilotAnkaufAnsicht = { aktiv: () => soll };
  W._dpAnkauf = ANKAUF;
  W._currentObjData = {};
}
const datensatz = (extra) => Object.assign({ nkm: '1100', _kpis_cf_ns: 2600, _kpis_dscr: 1.2, _ankauf: ANKAUF }, extra || {});

/* ── A · Jahresstand ersetzen, Vorjahr eingefroren ────────────────── */
console.log('A  Jahresstand');
umgebung();
const jetzt = new Date().getFullYear();
const vorjahr = { jahr: jetzt - 1, am: (jetzt - 1) + '-12-30T09:00:00Z', version: 'v2950', kz: { nkm: 990, _kpis_cf_ns: 1800 } };
const vorjahrKopie = JSON.stringify(vorjahr);
const altDiesesJahr = { jahr: jetzt, am: jetzt + '-01-05T09:00:00Z', version: 'v2960', kz: { nkm: 1050 } };
let d = datensatz({ _jahresstaende: [altDiesesJahr, vorjahr] });
melde(J.beimSpeichern(d, {}) === true, 'beimSpeichern setzt im Bestand einen Stand');
melde(Array.isArray(d._jahresstaende) && d._jahresstaende.length === 2, 'zwei Stände (Vorjahr + dieses Jahr), nicht drei — ' + (d._jahresstaende || []).length);
const dj = d._jahresstaende.find((s) => s.jahr === jetzt);
melde(dj && dj !== altDiesesJahr && dj.kz.nkm === 1100, 'dieses Jahr ersetzt (Miete 1.100 statt 1.050)');
melde(dj && dj.kz.rs_gesamt === 280000 && dj.kz.rs_d1 === 250000 && dj.kz.rs_d2 === 30000, 'Restschuld gesamt und je Darlehen aus der Projektion des laufenden Jahres');
melde(dj && dj.kz.ek === 80000, 'eingesetztes EK im Stand');
const vj = d._jahresstaende.find((s) => s.jahr === jetzt - 1);
melde(vj === vorjahr && JSON.stringify(vj) === vorjahrKopie, 'Vorjahr unverändert (dasselbe Objekt, Feld für Feld)');
melde(d._jahresstaende[0].jahr < d._jahresstaende[1].jahr, 'nach Jahr sortiert');
melde(W._currentObjData._jahresstaende === d._jahresstaende, 'Liste auch am geladenen Objekt (nächstes collectData nimmt sie mit)');
J.beimSpeichern(d, {});
melde(d._jahresstaende.length === 2, 'zweites Speichern im selben Jahr: weiterhin zwei');
const e1 = J.einfuegen([], { jahr: 2026, kz: {} });
const e2 = J.einfuegen(e1, { jahr: 2026, kz: { x: 1 } });
melde(e2.length === 1 && e2[0].kz.x === 1 && e1[0].kz.x === undefined, 'einfuegen() ist rein: alte Liste unberührt');

/* ── B · Wächter ──────────────────────────────────────────────────── */
console.log('B  Wächter');
umgebung({ soll: true });
d = datensatz();
melde(J.beimSpeichern(d, {}) === false && d._jahresstaende === undefined, 'Soll-Ansicht schreibt keinen Stand');
umgebung({ fuer: 'obj-ANDERES' });
d = datensatz();
melde(J.beimSpeichern(d, {}) === false && d._jahresstaende === undefined, 'Kennzahlen eines anderen Objekts -> kein Stand');
umgebung();
d = datensatz({ _ankauf: undefined });
melde(J.beimSpeichern(d, {}) === false && d._jahresstaende === undefined, 'ohne Ankauf-Stand (nicht gewonnen) -> kein Stand');
d = datensatz();
melde(J.beimSpeichern(d, { _vorAnkauf: true }) === false && d._jahresstaende === undefined, 'Sicherung vor dem Umschalten (_vorAnkauf) -> kein Stand');

/* ── C · Laden schreibt nicht ─────────────────────────────────────── */
console.log('C  Laden schreibt nicht');
const storage = fs.readFileSync(path.join(WURZEL, 'frontend/js/storage.js'), 'utf8');
const haken = [...storage.matchAll(/DpJahresstaende\.beimSpeichern\(/g)].map((m) => m.index);
melde(haken.length === 1, 'genau EIN Haken in storage.js (' + haken.length + ')');
const iSave = storage.indexOf('async function saveObj('), iCollect = storage.indexOf('var data = collectData();', iSave);
const iNaechste = storage.indexOf('\nfunction ', iSave + 10), iLoad = storage.indexOf('function loadData(');
melde(haken.length === 1 && haken[0] > iCollect && iCollect > iSave && (iNaechste < 0 || haken[0] < iNaechste), 'Haken sitzt in saveObj, nach collectData()');
/* Ende von loadData: die nächste Funktion auf oberster Ebene, auch eine async */
const iEnde = Math.min(...['\nfunction ', '\nasync function '].map((t) => storage.indexOf(t, iLoad + 10)).filter((x) => x > 0));
const ladeKoerper = storage.slice(iLoad, iEnde);
melde(ladeKoerper.length > 1000 && ladeKoerper.length < iSave, 'loadData-Körper abgegrenzt (' + ladeKoerper.length + ' Zeichen, vor saveObj)');
melde(!/beimSpeichern|_jahresstaende\s*=/.test(ladeKoerper), 'loadData() setzt keine Jahresstände und ruft den Haken nicht');
melde(!/beimSpeichern/.test(fs.readFileSync(path.join(WURZEL, 'frontend/js/jahresstaende.js'), 'utf8').split("addEventListener('dp:object-ready'")[1].split('});')[0]),
  'dp:object-ready (Laden) zeichnet nur den Ring, schreibt keinen Stand');

/* ── D · Rechenstand ──────────────────────────────────────────────── */
console.log('D  Rechenstand');
skripte = ['js/calc.js?v=v2989', 'js/deal-kpis.js?v=v2261', 'js/ui.js?v=v3001', 'js/score-tiers.js?v=v1950', 'js/anteilig.js?v=5'];
const rs = J.rechenstand();
melde(rs && rs.version === 'v2989', 'höchster Buster der Rechenkerne = v2989 (ui.js zählt nicht) — ' + (rs && rs.version));
melde(rs && rs.kerne['deal-kpis.js'] === 'v2261' && !rs.kerne['ui.js'], 'Kerne einzeln geführt');
melde(/unbekannt \(vor v2989\), heute v2989/.test(J.rechenstandSatz({})), 'ohne Version: „Rechenstand … unbekannt (vor v2989)"');
melde(J.rechenstandSatz({ version: 'v2989' }) === '', 'gleiche Version: kein Satz');
melde(/^Ankauf gerechnet mit Stand v2900, heute v2989 — Abweichungen können auch aus Rechenänderungen stammen\.$/.test(J.rechenstandSatz({ version: 'v2900' })), 'verschieden: Satz mit beiden Ständen');
/* Festschreiben legt version, kerne und plan ab; keine Jahresstände im Ankauf */
umgebung();
felder._deal_won_state = { value: 'true' };
W._dpAnkauf = null;
W.collectData = () => ({ nkm: '1200', _kpis_cf_ns: 3000, _jahresstaende: [vorjahr], _thumb: 'x' });
const neu = W.DealPilotAnkauf.festschreiben('2026-04-01');
melde(neu.version === 'v2989' && neu.kerne && neu.kerne['calc.js'] === 'v2989', 'Festschreiben: _ankauf.version = v2989');
melde(Array.isArray(neu.plan) && neu.plan.length === 2 && neu.plan[1].cfop_y === 5500, 'Festschreiben: Projektion als plan eingefroren');
melde(neu.daten._jahresstaende === undefined && neu.daten._thumb === undefined, 'Ankauf-Daten ohne Jahresstände und ohne Vorschaubild');
W.State.kpis._fuer = 'obj-ANDERES';
W._dpAnkauf = null;
const neu2 = W.DealPilotAnkauf.festschreiben('2026-04-01');
melde(neu2.plan === null && neu2.version === 'v2989', 'fremde Kennzahlen: kein Plan (null), Version trotzdem');
skripte = [];

/* ── E · Prozent gegen Handrechnung ───────────────────────────────── */
console.log('E  Handrechnung');
const voll = {
  ankauf: { nkm: 1000, d_summe: 300000, ek: 80000, ltv: 85, plan_cf: 6000, plan_jahr: 2026 },
  heute: { nkm: 1150, rs: 270000, rs_jahr: 2026, cf_vs: 4500, wert: 400000, gi: 360000 },
  ziel: { nkm: 1300, rs: 200000, rs_ende: '2034', netto: 230000 },
  fristen: [{ wort: 'Ende Zinsbindung Darlehen 1', ende: '2034-03-01', monate: 88 }],
  jahresstaende: [{ jahr: 2025, kz: { _kpis_cf_ns: 3000 } }, { jahr: 2026, kz: { _kpis_cf_ns: 3500 } }]
};
const r = J.rechne(voll), h = (id) => r.hebel.find((x) => x.id === id);
melde(nah(h('miete').pct, 50), 'Miete (1.150 − 1.000) ÷ (1.300 − 1.000) = 50 % — ' + h('miete').pct);
melde(nah(h('entschuldung').pct, 30), 'Entschuldung (300.000 − 270.000) ÷ (300.000 − 200.000) = 30 % — ' + h('entschuldung').pct);
melde(nah(h('entschuldung').getilgt_pct, 10), 'getilgt seit Kauf 30.000 ÷ 300.000 = 10 %');
melde(nah(h('entschuldung').ltv_heute, 67.5), 'LTV heute 270.000 ÷ 400.000 = 67,5 %');
melde(nah(h('ek').pct, 100 / 3, 0.001), 'EK (130.000 − 80.000) ÷ (230.000 − 80.000) = 33,33 % — ' + h('ek').pct);
melde(nah(h('ek').vielfaches, 1.625), 'Nettovermögen 130.000 = 1,625-faches des EK');
melde(nah(h('plan').pct, 75), 'Plan gegen Ist 4.500 ÷ 6.000 = 75 %');
melde(nah(h('rendite').heute, 58.125), 'Rendite (3.000 + 3.500 + 40.000) ÷ 80.000 = 58,125 % — ' + h('rendite').heute);
melde(h('rendite').zaehlt === false, 'Rendite zählt nicht in die Gesamtzahl (kein Zielwert)');
melde(nah(r.gesamt, (50 + 30 + 100 / 3 + 75) / 4, 0.001) && r.anzahl === 4, 'Gesamt = Mittel aus 4 Hebeln = 47,08 % — ' + r.gesamt);
melde(r.ampel && r.ampel.wort === 'unterwegs', 'Ampel gold bei 47 %');
melde(r.fristen.length === 1 && r.fristen[0].monate === 88, 'Fristen durchgereicht');
const ueber = J.rechne(Object.assign({}, voll, { heute: Object.assign({}, voll.heute, { nkm: 1600 }) }));
melde(nah(ueber.hebel[0].pct, 200) && nah(ueber.gesamt, (100 + 30 + 100 / 3 + 75) / 4, 0.001), 'Miete 200 % zeigt 200, zählt im Mittel als 100');

/* ── F · fehlt ────────────────────────────────────────────────────── */
console.log('F  fehlt');
const luecke = J.rechne({ ankauf: { nkm: 1000, d_summe: 300000, ek: 80000 }, heute: { nkm: 1150, rs: 270000 }, ziel: {}, fristen: [], jahresstaende: [{ jahr: 2026, kz: {} }] });
const hl = (id) => luecke.hebel.find((x) => x.id === id);
melde(hl('miete').pct === undefined && hl('miete').fehlt.some((t) => /Zielbild-Miete/.test(t)), 'Miete ohne Zielbild: fehlt „Zielbild-Miete"');
melde(hl('entschuldung').pct === undefined && hl('entschuldung').fehlt.some((t) => /Zinsbindung/.test(t)), 'Entschuldung ohne Ziel-Restschuld: fehlt');
melde(hl('ek').fehlt.some((t) => /Marktpreisindikation/.test(t)), 'EK ohne Marktbericht: fehlt „Marktpreisindikation"');
melde(!hl('plan'), 'ohne eingefrorene Projektion: kein Hebel „Plan gegen Ist"');
melde(hl('rendite').fehlt.some((t) => /ab dem zweiten Jahresstand/.test(t)), 'Rendite mit einem Jahresstand: „ab dem zweiten Jahresstand"');
melde(luecke.gesamt === null && luecke.anzahl === 0 && luecke.ampel === null, 'keine Gesamtzahl ohne vollständigen Hebel');
const nichtsHoeher = J.rechne({ ankauf: { nkm: 1000 }, heute: { nkm: 1000 }, ziel: { nkm: 900 } });
melde(nichtsHoeher.hebel[0].fehlt.some((t) => /über der Ankaufsmiete/.test(t)), 'Zielbild-Miete unter der Ankaufsmiete: kein Prozent, „fehlt"');

/* ── G · Anzeige im Reiter „Ankauf · Bestand · Zielbild" (echte ui.js) ── */
console.log('G  Anzeige');
lade('frontend/js/ui.js');
const render = (a) => vm.runInContext('_renderAIServerAnalysis', sandbox)(a);
umgebung();
felder._deal_won_state = { value: 'true' };
W._dpAnkauf = ANKAUF;
W._currentObjData = { _deal_won: true, _jahresstaende: [vorjahr] };
W.collectData = () => ({ nkm: '1100', _kpis_cf_ns: 2600, _kpis_dscr: 1.2, _ankauf: ANKAUF });
const analyse = { bestand_modus: true, empfehlung: 'Halten', fazit_kurz: 'Halten', empfehlung_begruendung: 'x' };
let html = '';
try { html = render(analyse); } catch (e) { html = 'FEHLER ' + e.message; }
melde(html.includes('data-dp-ziel-host="1"') && html.includes('ZIELERREICHUNG'), 'Bestand: Zielerreichung im Reiter (oben)');
melde(html.indexOf('data-dp-ziel-host') < html.indexOf('abw-tafel-host'), 'Zielerreichung steht VOR „Ankauf gegen Bestand"');
melde(html.includes('Jahresstände') && html.includes('>' + (jetzt - 1) + '<'), 'Tabelle der Jahresstände mit Spalte ' + (jetzt - 1));
melde(/Rechenstand des Ankaufs unbekannt \(vor v2989\)/.test(html), 'Rechenstand-Satz in der Abweichungstafel (Ankauf ohne Version)');
melde(html.includes('Stand ' + jetzt + ' festhalten'), 'Knopf „Stand festhalten"');
W.DealPilotAnkaufAnsicht = { aktiv: () => true };
try { html = render(analyse); } catch (e) { html = 'FEHLER ' + e.message; }
melde(!html.includes('data-dp-ziel-host'), 'Soll-Ansicht: keine Zielerreichung');
W.DealPilotAnkaufAnsicht = { aktiv: () => false };
/* _buildAIPayload() braucht das ganze Formular - hier die Quelle des Felds selbst,
   und die Verdrahtung in ui.js als Text (Zuweisung an bestand.zielerreichung). */
const pl = J.payload();
melde(pl && Array.isArray(pl.hebel) && pl.hebel.length >= 4 && 'gesamt_pct' in pl && pl.rechenstand_ankauf === 'unbekannt (vor v2989)', 'Payload: Hebel, Gesamtzahl, Rechenstand des Ankaufs');
melde(/bp\.zielerreichung = window\.DpJahresstaende\.payload\(\)/.test(fs.readFileSync(path.join(WURZEL, 'frontend/js/ui.js'), 'utf8')), 'ui.js legt bestand.zielerreichung an');

console.log('\n' + (fehler ? 'ROT' : 'GRUEN') + ' · ' + (geprueft - fehler) + ' von ' + geprueft + ' Pruefungen');
process.exit(fehler ? 1 : 0);
