#!/usr/bin/env node
/* tools/mietpotenzial-pruefen.mjs · v3075 — Prüfstrecke „zulässige Miete nach 3 Jahren"

   Marcel 02.11.2026 (P1.1–P1.3): der Quick-Check zeigt die rechtlich zulässige
   Bestandsmiete nach drei Jahren und einen zweistufigen Zielkaufpreis. Die Regeln
   liegen seit v3075 in frontend/js/mietpotenzial-kern.js; potenzial.js ruft sie auf.

   Geprüft an den ECHTEN Dateien (vm, Uhr fest auf 28.10.2026 wie
   tools/mieterhoehung-termine-pruefen.mjs):
     A  Marcels Beispiel: 180.000 €, NKM 10.800 €/J., Ziel 8 %
        -> heute 135.000 €, mit zulässiger Miete 162.000 € (Kappung 20 %) / 155.250 € (15 %)
     B  zulaessig(): Kappung, Vergleichsmiete, an der Vergleichsmiete, ohne Vergleichsmiete,
        Staffel, Sperrfrist; Angebotsmiete geht nie ein
     C  neuvermietung(): eigene Zeile, Mietpreisbremse 110 %
     D  kappungAus()/mietpreisbremseAus(): AGS und Ortsname
     E  potenzial.js = Kern: sollFuer, kappung, mietpreisbremse, mhTermine über ein Raster
        (Prüfsumme eingefroren; mit --alt=<alte potenzial.js> Fall für Fall gegen den alten Stand)
     F  dealscore.js: Mietpotenzial-Bonus (statt nie erreichbarem mstg 1,5), Zustand-Grenze,
        Haupt-App unverändert; Benchmark Fall D nicht mehr „Sehr gut"
     G  qc-heuristik.js kategorien(): der Rechenweg nennt die Kurven, die die Punkte vergeben
     J  v3244 · § 558 nur, wo § 558 gilt: Staffel/Index/Gewerbe -> § 558-Anteil = Ist, die eigene Soll-Angabe
        ist ein eigener Posten (teil558/teilVertrag); Vergleichsmiete eigene -> amtliche (qualifizierter
        Mietspiegel geht jeder Marktmiete vor) -> Marktmiete markiert; me_soll zählt nicht mehr
   RC=0 sauber, RC=1 Abweichung. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = (d) => path.join(WURZEL, 'frontend/js', d);
const ARG = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));

let fehler = 0, n = 0;
function gleich(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) { fehler++; console.log('  FEHLER ' + name + ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(soll)); }
}
function wahr(name, b) { gleich(name, !!b, true); }
const rund = (x) => Math.round(x);

/* ── vm-Fenster, Uhr fest 28.10.2026 ─────────────────────────────────── */
const ECHT = Date;
class FestDate extends ECHT {
  constructor(...a) { if (a.length) super(...a); else super(2026, 9, 28, 12, 0, 0); }
  static now() { return new ECHT(2026, 9, 28, 12, 0, 0).getTime(); }
}
const KAPP = JSON.parse(fs.readFileSync(JS('data/kappungsgrenzen.json'), 'utf8'));
function fenster(feld) {
  const F = feld || {};
  const el = (id) => (id in F ? { value: F[id] } : null);
  const f = {
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout() {}, clearTimeout() {}, innerWidth: 1280,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(KAPP))) })
  };
  f.window = f; f.self = f;
  f.document = { readyState: 'complete', addEventListener() {}, getElementById: el, querySelector: () => null,
    querySelectorAll() { return []; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    head: { appendChild() {} }, body: { appendChild() {} } };
  return vm.createContext(Object.assign(f, { Date: FestDate, console, Math, JSON, Number, String, Object, Array, isFinite, parseFloat, parseInt, RegExp, Promise }));
}
function lade(ctx, datei, name) { vm.runInContext(fs.readFileSync(datei, 'utf8'), ctx, { filename: name || path.basename(datei) }); }

const cK = fenster(); lade(cK, JS('mietpotenzial-kern.js'));
const K = cK.DpMietpotenzial;
if (!K || !K.zulaessig) { console.log('ABBRUCH: DpMietpotenzial fehlt'); process.exit(2); }
const cH = fenster(); lade(cH, JS('dscr-engine.js')); lade(cH, JS('deal-kpis.js')); lade(cH, JS('score-tiers.js')); lade(cH, JS('qc-heuristik.js')); lade(cH, JS('dealscore.js'));
const H = cH.QcHeuristik, DS = cH.DealScore, DK = cH.DealKpis, ST = cH.ScoreTier;
const HEUTE = '2026-10';

/* ── A · Marcels Beispiel ────────────────────────────────────────────── */
for (const [k, soll3] of [[20, 162000], [15, 155250]]) {
  const z = K.zulaessig({ ist: 900, wfl: 0, kappung_pct: k, heute: HEUTE });
  gleich('A zulässige Miete ' + k + ' % (Monat)', z.miete_monat, 900 * (1 + k / 100));
  gleich('A Grenze ' + k + ' %', z.grund, 'kappung');
  const zk = H.zielKaufpreisZweistufig({ kp: 180000, nkm: 900, nkmZul: z.miete_monat, zielBmr: 8, cfMon: 132 });
  gleich('A Zielkaufpreis heute (8 %)', rund(zk.heute), 135000);
  gleich('A Zielkaufpreis mit zulässiger Miete (' + k + ' %)', rund(zk.nach3), soll3);
  gleich('A Nachlass heute', rund(zk.nachlass_heute), 45000);
  gleich('A Nachlass nach 3 J. (' + k + ' %)', rund(zk.nachlass_3j), 180000 - soll3);
  gleich('A Bruttorendite heute 6,0 %', Math.round(zk.bmr_heute * 10) / 10, 6);
  gleich('A Bruttorendite nach 3 J. (' + k + ' %)', Math.round(zk.bmr_3j * 10) / 10, k === 20 ? 7.2 : 6.9);
}
/* Marcels ursprüngliche 168.750 € (13.500 € NKM) sind mit der Kappung NICHT erreichbar */
gleich('A 13.500 € NKM übersteigt jede Kappung', K.zulaessig({ ist: 900, wfl: 0, kappung_pct: 20, heute: HEUTE }).miete_jahr < 13500, true);
/* Sanierung zählt zur Gesamtinvestition */
gleich('A mit 20.000 € Sanierung: heute 115.000 €', rund(H.zielKaufpreisZweistufig({ kp: 180000, nkm: 900, zielBmr: 8, cfMon: 132, san: 20000 }).heute), 115000);
/* der Marktwert deckelt auch die zweite Stufe */
gleich('A Marktwert 150.000 deckelt die zweite Stufe', rund(H.zielKaufpreisZweistufig({ kp: 180000, nkm: 900, nkmZul: 1080, zielBmr: 8, cfMon: 132, marktwert: 150000 }).nach3), 150000);
/* bisherige Aufrufer ohne san: zielKaufpreis unverändert */
gleich('A zielKaufpreis ohne san unverändert', rund(H.zielKaufpreis({ kp: 180000, nkm: 900, zielBmr: 8, cfMon: 132 })), 135000);

/* ── B · zulaessig() ─────────────────────────────────────────────────── */
let z = K.zulaessig({ ist: 500, wfl: 60, vgl_qm: 10, kappung_pct: 15, heute: HEUTE });
gleich('B1 Kappung bindet (575 < 600)', [z.miete_monat, z.grund], [575, 'kappung']);
z = K.zulaessig({ ist: 500, wfl: 60, vgl_qm: 9, kappung_pct: 20, heute: HEUTE });
gleich('B2 Vergleichsmiete bindet (540 < 600)', [z.miete_monat, z.grund], [540, 'vergleichsmiete']);
z = K.zulaessig({ ist: 650, wfl: 60, vgl_qm: 10, kappung_pct: 20, heute: HEUTE });
gleich('B3 schon über der Vergleichsmiete: bleibt bei Ist', [z.miete_monat, z.grund, z.plus_pct], [650, 'vergleichsmiete_erreicht', 0]);
z = K.zulaessig({ ist: 500, wfl: 60, kappung_pct: 20, heute: HEUTE });
gleich('B4 ohne Vergleichsmiete: Kappung mit Hinweis', [z.miete_monat, z.grund, z.vgl_fehlt], [600, 'kappung', true]);
z = K.zulaessig({ ist: 500, wfl: 60, vgl_qm: 12, kappung_pct: 20, mv_art: 'staffel', heute: HEUTE });
gleich('B5 Staffelmiete: kein § 558', [z.miete_monat, z.grund], [500, 'vertrag']);
z = K.zulaessig({ ist: 500, wfl: 60, vgl_qm: 12, kappung_pct: 20, letzte: '2026-01', heute: HEUTE });
gleich('B6 Sperrfrist: verlangbar 01/2027, wirksam 04/2027, Höhe unverändert', [z.miete_monat, z.sperrfrist, z.termine.verlangbar_ab, z.termine.wirksam_ab], [600, true, '2027-01', '2027-04']);
wahr('B6 Termintext nennt die Sperrfrist', /Sperrfrist/.test(z.termin_text));
z = K.zulaessig({ ist: 500, wfl: 60, vgl_qm: 12, kappung_pct: 20, heute: HEUTE });
gleich('B7 ohne letzte Erhöhung: Hinweis Sperrfrist ungeprüft', z.hinweise.length, 1);
gleich('B8 nächste Erhöhung = sollFuer', [z.naechste.miete, z.naechste.ab], [600, '2027-01']);
gleich('B9 Kappung außerhalb 15/20 -> Gesetz 20 %', K.zulaessig({ ist: 500, wfl: 60, kappung_pct: 30, heute: HEUTE }).kappung_pct, 20);
/* Angebotsmiete ist kein Parameter von zulaessig(): ein Feld `markt_qm` ändert nichts */
gleich('B10 Angebotsmiete wird ignoriert', K.zulaessig({ ist: 500, wfl: 60, vgl_qm: 9, kappung_pct: 20, markt_qm: 14, heute: HEUTE }).miete_monat, 540);

/* ── C · neuvermietung() ─────────────────────────────────────────────── */
let nv = K.neuvermietung({ markt_qm: 14, wfl: 60, vgl_qm: 10, bremse: { gilt: true } });
gleich('C1 Bremse: höchstens 11,00 €/m²', [nv.qm, nv.gedeckelt, nv.monat], [11, true, 660]);
nv = K.neuvermietung({ markt_qm: 14, wfl: 60, vgl_qm: 10, bremse: { gilt: false } });
gleich('C2 ohne Bremse: Marktmiete', [nv.qm, nv.gedeckelt], [14, false]);
nv = K.neuvermietung({ markt_qm: 14, wfl: 60, bremse: { gilt: true } });
gleich('C3 Bremse ohne Vergleichsmiete: ungeprüft gekennzeichnet', [nv.qm, nv.ungeprueft], [14, true]);
gleich('C4 ohne Marktmiete: keine Zeile', K.neuvermietung({ wfl: 60 }), null);

/* ── C5–C10 · v3130 · N115 · zielmieteVorschlag(): Vorschlag je Wohnung, Deckel aus neuvermietung() ── */
let zv = K.zielmieteVorschlag({ wfl: 60, basis_qm: 12.4, vgl_qm: 10, bremse: { gilt: true }, vermietet: true });
gleich('C5 Bremse deckelt den Vorschlag auf 11,00 €/m²', [zv.qm, zv.monat, zv.gedeckelt, zv.basis_qm], [11, 660, true, 12.4]);
wahr('C5 laufender Vertrag: Hinweis Kappung und § 559', /§ 558/.test(zv.bestand) && /§ 559/.test(zv.bestand));
zv = K.zielmieteVorschlag({ wfl: 72.5, basis_qm: 9.87, bremse: { gilt: false }, vermietet: false });
gleich('C6 ohne Bremse: Marktmiete, leer = ab Neuvermietung', [zv.qm, zv.monat, zv.gedeckelt, /Neuvermietung/.test(zv.bestand)], [9.87, 715.58, false, true]);
gleich('C7 ohne Marktmiete: fehlt', K.zielmieteVorschlag({ wfl: 60, bremse: { gilt: true } }), { fehlt: 'marktmiete' });
gleich('C8 Gewerbe: kein Vorschlag', K.zielmieteVorschlag({ wfl: 60, basis_qm: 12, art: 'gewerbe' }), null);
zv = K.zielmieteVorschlag({ wfl: 60, basis_qm: 12, bremse: { gilt: true } });
gleich('C9 Bremse ohne Vergleichsmiete: ungeprüft, nicht gedeckelt', [zv.qm, zv.ungeprueft], [12, true]);
gleich('C10 ohne Fläche: kein Vorschlag', K.zielmieteVorschlag({ basis_qm: 12 }), null);

/* ── D · Kappung und Bremse aus der Liste ────────────────────────────── */
const OPT = { heute: '2026-10-28' };
gleich('D1 Aachen per AGS: 15 %', [K.kappungAus(KAPP, { ags: '05334002' }, OPT).pct, K.kappungAus(KAPP, { ags: '05334002' }, OPT).herkunft], [15, 'verordnung']);
gleich('D2 Aachen per Ortsname: 15 %', [K.kappungAus(KAPP, { land: 'NW', ort: 'Aachen' }, OPT).pct, K.kappungAus(KAPP, { land: 'NW', ort: 'Aachen' }, OPT).zuordnung], [15, 'ortsname']);
wahr('D2 Text nennt die Zuordnung über den Ortsnamen', /Ortsnamen/.test(K.kappungAus(KAPP, { land: 'NW', ort: 'Aachen' }, OPT).text));
gleich('D3 Hüllhorst (nicht gelistet): 20 % Gesetz', [K.kappungAus(KAPP, { land: 'NW', ort: 'Hüllhorst' }, OPT).pct, K.kappungAus(KAPP, { land: 'NW', ort: 'Hüllhorst' }, OPT).herkunft], [20, 'gesetz']);
gleich('D4 eigene Angabe 15 % geht vor', K.kappungAus(KAPP, { land: 'NW', ort: 'Hüllhorst' }, { eigen_pct: 15 }).herkunft, 'eigen');
gleich('D5 ohne Liste: Auffang 20 %, prüfen', [K.kappungAus(null, { land: 'NW', ort: 'Aachen' }).pct, K.kappungAus(null, {}).pruefen], [20, true]);
gleich('D6 ohne Ort: Gemeinde nicht ermittelt', /Gemeinde noch nicht ermittelt/.test(K.kappungAus(KAPP, { land: 'NW' }).text), true);
gleich('D7 Bremse Aachen per Ortsname', K.mietpreisbremseAus(KAPP, { land: 'NW', ort: 'Aachen' }, OPT).gilt, true);
gleich('D8 Bremse Hüllhorst', K.mietpreisbremseAus(KAPP, { land: 'NW', ort: 'Hüllhorst' }, OPT).gilt, false);
const koeln = K.kappungAus(KAPP, { land: 'NW', ort: 'Köln' }, OPT);
gleich('D9 Köln (Umlaut) per Ortsname', koeln.pct, 15);

/* ── E · potenzial.js rechnet mit dem Kern - dieselben Ergebnisse wie vorher ── */
async function potenzialLaden(datei, mitKern) {
  const c = fenster();
  if (typeof mitKern === 'string') lade(c, path.resolve(mitKern), 'mietpotenzial-kern.js');   /* v3244 · --alt-kern */
  else if (mitKern) lade(c, JS('mietpotenzial-kern.js'));
  lade(c, datei, 'potenzial.js');
  await c.DpPotenzial.kappungLaden();
  return c.DpPotenzial;
}
const AGS = ['05334002', '05758016', '09162000', '11000000', '06412000', '99999999', '', '0533'];
function raster(P, mitListe) {
  const aus = [];
  const MASSN = [null, [{ id: 'bad', t: 'Bad', k: 12000, bewohnt: true }], [{ id: 'sonst', t: 'Fenster und Heizung', k: 10000, bewohnt: true, erh: 20 }], [{ id: 'renovierung', t: 'Renovierung', k: 3000, bewohnt: true }]];
  for (const ist of [0, 500, 820]) for (const vgl of [0, 8, 10, 14]) for (const kp of [15, 20]) for (const letzte of ['', '2024-01-01', '2025-03-01', '2026-01-01', '2026-09-01'])
    for (const betrag of ['', '50']) for (const soll of ['', '640']) for (const art of ['', 'staffel', 'index']) for (let mi = 0; mi < MASSN.length; mi++) {
      const e = { ist, wfl: 60, status: ist ? 'vermietet' : 'leer', vgl_qm: '', soll, soll_ab: soll ? '2027-05' : '', mv_art: art, mv_letzte_erhoehung: letzte, mv_letzte_erhoehung_betrag: betrag };
      if (MASSN[mi]) e.massnahmen = MASSN[mi];
      aus.push(P.sollFuer(e, { kapp: { pct: kp }, vgl_qm: vgl }));
    }
  /* Kappung und Bremse haengen an der Liste (kappungsgrenzen.json, eigener Erntestrang) - in der
     Pruefsumme nie (die Liste wird nachgeerntet), mit --alt Fall fuer Fall, sonst unten direkt gegen den Kern */
  if (mitListe) for (const ags of AGS) { aus.push(P.kappung(ags)); aus.push(P.mietpreisbremse(ags)); }
  for (const art of ['558', '559', '557b']) for (const letzte of [null, '2025-03', '2026-01', '2026-08']) for (const eig of [null, '2026-11', '2027-06'])
    aus.push(P.mhTermine({ art, letzte, wirksam_eigen: eig, heute: HEUTE }));
  return aus;
}
const P = await potenzialLaden(JS('potenzial.js'), true);
const neu = raster(P, false);
const SUMME = crypto.createHash('sha256').update(JSON.stringify(neu)).digest('hex');
/* Eingefroren am 02.11.2026 gegen den Stand VOR v3075 (git HEAD f376887a, potenzial.js ohne Kern):
   node tools/mietpotenzial-pruefen.mjs --alt=<alte potenzial.js> meldete alle Fälle gleich.
   v3244 (09.11.2026) · GEWOLLT GEÄNDERT: sollFuer() trägt bei Staffel-/Index-/Gewerbevertrag mit eigener
   Soll-Angabe zwei Felder mehr (vertrag_monat, vertrag_text) und die Herkunft „eigene Angabe (Staffelmiete,
   § 557a BGB)" statt „eigene Angabe". Gemessen mit --alt=<potenzial.js v3241> --alt-kern=<Kern v3241>: 1.280 von
   5.812 Fällen (mit Liste) anders = Ist 500/820 × Staffel/Index × Soll 640 × alle übrigen Achsen (2·2·320), JEDER
   nur in genau diesen drei Feldern.
   Die alte Summe bleibt als Gegenprobe E0: das Raster, um genau diese drei Felder zurückgebaut, muss sie
   weiter treffen - so ist bewiesen, dass sich sonst nichts bewegt hat. */
const SUMME_V3075 = '852a5a0654d9af4af90892e410605866cf92a32fcd135ea2cea455d2c7496a1f';   /* 5796 Fälle, ohne Liste, Stand v3075-v3241 */
const SUMME_SOLL = 'a9db170e6570fd942e85302c17b79c4ce7a48c0a0babee818ef50d5dbddf0b64';   /* 5796 Fälle, ohne Liste, seit v3244 */
gleich('E Raster ' + neu.length + ' Fälle: Prüfsumme seit v3244 (bei Abweichung: --alt=<alte potenzial.js> --alt-kern=<alter Kern>)', SUMME, SUMME_SOLL);
const zurueck = (x) => {
  if (!x || typeof x !== 'object' || !('vertrag_monat' in x || 'vertrag_text' in x)) return x;
  const y = Object.assign({}, x); delete y.vertrag_monat; delete y.vertrag_text;
  if (/^eigene Angabe \(/.test(y.herkunft || '')) y.herkunft = 'eigene Angabe';
  return y;
};
const SUMME_ZURUECK = crypto.createHash('sha256').update(JSON.stringify(neu.map(zurueck))).digest('hex');
gleich('E0 Gegenprobe: ohne die drei v3244-Felder dieselbe Summe wie v3075-v3241 (sonst hat sich mehr bewegt)', SUMME_ZURUECK, SUMME_V3075);
if (ARG.summe) console.log('Prüfsumme Raster: ' + SUMME + ' (' + neu.length + ' Fälle), zurückgebaut ' + SUMME_ZURUECK);
if (typeof ARG.alt === 'string') {
  const A = await potenzialLaden(path.resolve(ARG.alt), typeof ARG['alt-kern'] === 'string' ? ARG['alt-kern'] : false);
  const alt = raster(A, true), neuL = raster(P, true);
  let ab = 0;
  /* v3244 · Abweichungen nach Feldern zählen; erlaubt sind nur die drei v3244-Felder (vertrag_monat, vertrag_text, herkunft) */
  const felder = {}; let fremd = 0;
  alt.forEach((x, i) => {
    if (JSON.stringify(x) === JSON.stringify(neuL[i])) return;
    ab++;
    const y = neuL[i] || {}, ks = new Set(Object.keys(x || {}).concat(Object.keys(y)));
    ks.forEach((k) => { if (JSON.stringify((x || {})[k]) !== JSON.stringify(y[k])) felder[k] = (felder[k] || 0) + 1; });
    if (JSON.stringify(x) !== JSON.stringify(zurueck(y))) { fremd++; if (fremd <= 5) console.log('  ABWEICHUNG Fall ' + i + ':\n    alt ' + JSON.stringify(x) + '\n    neu ' + JSON.stringify(y)); }
  });
  console.log('  --alt: ' + ab + ' von ' + alt.length + ' Fällen anders, Felder: ' + JSON.stringify(felder));
  gleich('E --alt: ' + alt.length + ' Fälle gleich bis auf die drei v3244-Felder', fremd, 0);
}
for (const ags of AGS) {
  gleich('E kappung(' + (ags || 'leer') + ') = Kern', P.kappung(ags), JSON.parse(JSON.stringify(K.kappungAus(KAPP, { ags }))));
  gleich('E mietpreisbremse(' + (ags || 'leer') + ') = Kern', P.mietpreisbremse(ags), JSON.parse(JSON.stringify(K.mietpreisbremseAus(KAPP, { ags }))));
}
gleich('E sollFuer im Kern = potenzial.js (ohne Maßnahmen)', JSON.stringify(K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2025-03-01' }, { kapp: { pct: 20 }, vgl_qm: 10 })),
  JSON.stringify(P.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2025-03-01' }, { kapp: { pct: 20 }, vgl_qm: 10 })));

/* ── F · dealscore.js ────────────────────────────────────────────────── */
const basis = { kp: 200000, cf_m: 50, nmy: 3.5, ltv: 80, dscr: 1.3, wp_kpi: 0, darlehen: 160000 };
const pot = (K2) => DS.computeFromKpis(K2).breakdown.find((b) => b.key === 'potenzial').score;
gleich('F1 Quick-Check bisher (mstg 1,5): kein Bonus', pot(Object.assign({}, basis, { mstg: 1.5 })), 30);
gleich('F2 zulässig +20 %: +10', pot(Object.assign({}, basis, { miet_potenzial_pct: 20 })), 40);
gleich('F3 zulässig +15 %: +7,5', pot(Object.assign({}, basis, { miet_potenzial_pct: 15 })), 37.5);
gleich('F4 an der Vergleichsmiete (0 %): kein Bonus', pot(Object.assign({}, basis, { miet_potenzial_pct: 0 })), 30);
gleich('F5 Haupt-App unverändert: mstg 3 -> +10', pot(Object.assign({}, basis, { mstg: 3 })), 40);
gleich('F6 Haupt-App unverändert: mstg 1,5 -> 0', pot(Object.assign({}, basis, { mstg: 1.5 })), 30);
const gut = Object.assign({}, basis, { cf_m: 400, nmy: 6, ltv: 70, dscr: 1.8, wp_kpi: 20000 });
gleich('F7 ohne Zustand: Sehr gut bleibt', DS.computeFromKpis(gut).score >= 85, true);
gleich('F8 sanierungsbedürftig: höchstens 69', DS.computeFromKpis(Object.assign({}, gut, { zustand: 'stark_sanierungsbeduerftig' })).score, 69);
gleich('F9 Sanierung 30 % des KP: höchstens 69', DS.computeFromKpis(Object.assign({}, gut, { san: 60000 })).score, 69);
gleich('F10 Sanierung 12 % des KP: höchstens 84', DS.computeFromKpis(Object.assign({}, gut, { san: 24000 })).score, 84);
gleich('F11 Zustand normal/gut: keine Grenze', DS.computeFromKpis(Object.assign({}, gut, { zustand: 'normal' })).score, DS.computeFromKpis(gut).score);
wahr('F12 Grund steht in der Interpretation', /sanierungsbedürftig/.test(DS.computeFromKpis(Object.assign({}, gut, { zustand: 'stark_sanierungsbeduerftig' })).interpretation));
/* DSCR-Grenze (v3070) unverändert: niedrigere Grenze gewinnt */
gleich('F13 DSCR 0,85 + sanierungsbedürftig: 69 (beide)', DS.computeFromKpis(Object.assign({}, gut, { dscr: 0.85, zustand: 'stark_sanierungsbeduerftig' })).score <= 69, true);
gleich('F14 DSCR 0,7: 49 bleibt (DSCR-Grenze strenger)', DS.computeFromKpis(Object.assign({}, gut, { dscr: 0.7, zustand: 'stark_sanierungsbeduerftig' })).score <= 49, true);

/* Benchmark Fall D (design/Vorschläge/score-benchmark-p1.md): MFH Pirmasens, KP 300.000, NKM 2.600,
   400 m², stark sanierungsbedürftig, Sanierung 140.000 €, EK NK + 20 %, Marktwert 290.000, Vergleichsmiete
   6,30 €/m², Kappung 20 %. So, wie der Quick-Check rechnet (_dpPilotScore): Sanierung in der
   Gesamtinvestition, das Eigenkapital trägt sie nicht -> Darlehen. */
function fallD(mitP1, ekPlus) {
  const kp = 300000, knk = 0.105, san = mitP1 ? 140000 : 0, ek = 91500 + (ekPlus || 0), nkm = 2600;
  const gesamt = kp * (1 + knk) + san, d1 = Math.max(0, gesamt - ek);
  const k = DK.compute({ kp, nk: kp * knk, san, nkm, ze: 0, bwk_ul: 0, bwk_nul: 7800, d1, d1z: 3.8, d1t: 2, ek, svw: 0, afa: 0, grenz: 0, ekInklNkLtv: false });
  const zul = K.zulaessig({ ist: nkm, wfl: 400, vgl_qm: 6.3, kappung_pct: 20, heute: HEUTE });
  const r = DS.computeFromKpis(Object.assign({ kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr, wp_kpi: 0, darlehen: d1 },
    mitP1 ? { miet_potenzial_pct: zul.plus_pct, zustand: 'stark_sanierungsbeduerftig', san } : { mstg: 1.5 }));
  return { score: r.score, stufe: ST.stufe(r.score).wort, ohne: r.score_ohne_deckel, deckel: r.deckel, nmy: k.nmy, dscr: k.dscr, cf: k.cf_m, ltv: k.ltv, zul };
}
const d0 = fallD(false), d1 = fallD(true);
gleich('F15 Fall D vor v3075: 86 Sehr gut (wie im Benchmark)', [d0.score, d0.stufe], [86, 'Sehr gut']);
wahr('F16 Fall D mit Zustand und Sanierung: nicht mehr „Sehr gut", höchstens Solide', d1.score <= 69);
/* Gegenprobe: traegt das Eigenkapital die Sanierung, bleiben Cashflow und DSCR stark - dann greift die Zustand-Grenze */
const d2 = fallD(true, 140000);
gleich('F17 Fall D, Sanierung aus Eigenkapital: Grenze 69 greift', [d2.score, d2.ohne > 69, /sanierungsbedürftig/.test(d2.deckel || '')], [69, true, true]);
if (ARG.v || ARG.fallD) {
  console.log('Fall D vorher: ' + d0.score + ' ' + d0.stufe + ' | nachher: ' + d1.score + ' ' + d1.stufe + ' (ohne Grenze ' + d1.ohne + ', Grenze: ' + d1.deckel + ')');
  console.log('  Sanierung aus Eigenkapital: ' + d2.score + ' (ohne Grenze ' + d2.ohne + ')');
  console.log('  NMR ' + d1.nmy.toFixed(2) + ' %, DSCR ' + d1.dscr.toFixed(2) + ', CF ' + Math.round(d1.cf) + ' €/Mon, LTV ' + d1.ltv.toFixed(1) + ' %, zulässige Miete +' + d1.zul.plus_pct.toFixed(1) + ' % (' + d1.zul.grund + ')');
}

/* ── G · Rechenwege der Kategorien ───────────────────────────────────── */
const kat = H.kategorien({ bmr: 6, nmr: 4, ekr: 5, cfMon: 100, dscr: 1.3, ltv: 85, bewirtPctNkm: 20, kp: 200000, wp: 10000, mietPotPct: 15 },
  { rendite: 67, cashflow: 75, risiko: 87, ltv: 62, potenzial: 52 });
const rw = Object.fromEntries(kat.map((k) => [k.id, k.rechenweg]));
wahr('G1 Rendite: NMR-Kurve 2 / 3,5 / 5 %', /2 % = 0 Pkt, 3,5 % = 50 Pkt, 5 % = 100 Pkt/.test(rw.rendite));
wahr('G1 Rendite: keine alte BMR/EKR-Gewichtung', !/Gewicht 40 %|Eigenkapitalrendite/.test(rw.rendite));
wahr('G2 Cashflow: −200 / 0 / +200', /−200 €\/Mon = 0 Pkt, 0 € = 50 Pkt, \+200 €\/Mon = 100 Pkt/.test(rw.cashflow));
wahr('G3 DSCR: 0,9 / 1,0 / 1,2 / 1,5', /0,9 und darunter = 0 Pkt, 1,0 = 60 Pkt, 1,2 = 80 Pkt, 1,5 und mehr = 100 Pkt/.test(rw.sicherheit));
wahr('G4 LTV linear, keine Stufen 30/60/80/90', /\(110 − LTV\) × 2,5/.test(rw.finanzierung) && !/ab 100 % → 30 Pkt/.test(rw.finanzierung));
wahr('G5 Potenzial statt Effizienz', kat.find((k) => k.id === 'bewirt').was === 'Potenzial' && /Wertpuffer/.test(rw.bewirt) && /\+7,50 Pkt/.test(rw.bewirt));
/* Gegenprobe: der Text nennt die Kurve, die die Punkte wirklich vergibt */
const pr = DS.computeFromKpis({ kp: 200000, cf_m: 0, nmy: 3.5, ltv: 90, dscr: 1.2, wp_kpi: 20000, miet_potenzial_pct: 20, darlehen: 1 }).breakdown;
const pb = Object.fromEntries(pr.map((b) => [b.key, Math.round(b.score)]));
gleich('G6 Stützstellen aus dem Text = Punkte des Kerns (CF 0 € = 50, NMR 3,5 % = 50, LTV 90 % = 50, DSCR 1,2 = 80, Puffer 10 % + 20 % Miete = 70)',
  [pb.cashflow, pb.rendite, pb.ltv, pb.risiko, pb.potenzial], [50, 50, 50, 80, 70]);

/* ── H · v3130 · N115 · Zielmiete-Vorschlag je Wohnung in potenzial.js (echte Datei, Kern darunter) ── */
async function vorschlagLauf(feld, extra) {
  const c = fenster(feld);
  if (extra) Object.assign(c, extra);   /* v3244 · z. B. _dpMarktdaten */
  const F = feld || {};
  c.document.getElementById = (id) => (id in F ? { value: F[id], addEventListener() {}, dispatchEvent() {} } : null);
  c._dpPotenzial = { ags: '05334002', plz: '52062' };   /* Aachen: Mietpreisbremse gilt (Liste) */
  lade(c, JS('mietpotenzial-kern.js')); lade(c, JS('potenzial.js'));
  await c.DpPotenzial.kappungLaden();
  return c.DpPotenzial;
}
const KARTE = (mm) => JSON.stringify({ card: Object.assign({ area: 300, bericht_datum: '01.11.2026' }, { mm }), fuer: { key: null } });
const EINH = [{ nr: '1', wfl: '60', ist: '480', status: 'vermietet' }, { nr: '2', wfl: '90', ist: '', status: 'leer' }, { nr: 'G', art: 'gewerbe', wfl: '80', ist: '900' }];
{
  /* Marktmiete Mitte 10,00, obere Spanne 12,00; Vergleichsmiete (Tab Miete) 10,00 -> Bremse 11,00 */
  const P = await vorschlagLauf({ plz: '52062', ds2_marktmiete: '10', _mb_state: KARTE({ med: 3000, high: 3600, qm: 10, q75_qm: 12 }) });
  const r = P.zielVorschlaege({ einheiten: EINH });
  gleich('H1 Grundlage obere Spanne 12,00, Mitte 10,00', [r.markt.qm, r.markt.mitte, r.markt.art], [12, 10, 'oben']);
  gleich('H2 Wohnung 1: gedeckelt auf 11,00 (Bremse), 660 €/Monat', [r.zeilen[0].v.qm, r.zeilen[0].v.monat, r.zeilen[0].v.gedeckelt], [11, 660, true]);
  gleich('H3 Gewerbe: kein Vorschlag', r.zeilen[2].v, null);
  wahr('H4 Herkunft ohne Quellennamen, mit Wohnungsgröße und Datum', /aktueller Marktdurchschnitt für Wohnungen um 75 m²/.test(r.markt.herkunft) && /01\.11\.2026/.test(r.markt.herkunft) && !/GeoMap|Scout|PriceHubble|Sprengnetter/i.test(r.markt.herkunft));
  const h = P.zielVorschlagHtml(r);
  wahr('H5 HTML: je Wohnung ein „übernehmen", dazu „alle 2 übernehmen"', (h.match(/data-zv="/g) || []).length === 2 && /alle 2 übernehmen/.test(h));
  wahr('H6 HTML: Hinweis Kappung § 558 und Umlage § 559, § 556d/§ 556f', /§ 558/.test(h) && /§ 559/.test(h) && /§ 556d/.test(h) && /§ 556f/.test(h));
  const r2 = P.zielVorschlaege({ einheiten: EINH.map((e, i) => i === 0 ? Object.assign({}, e, { ziel_qm: '11,00' }) : e) });
  wahr('H7 übernommene Wohnung zeigt „übernommen" statt Knopf', /übernommen<\/span>/.test(P.zielVorschlagHtml(r2)) && (P.zielVorschlagHtml(r2).match(/data-zv="/g) || []).length === 1);
}
{
  const P = await vorschlagLauf({ plz: '52062', _mb_state: '' });
  const r = P.zielVorschlaege({ einheiten: EINH });
  wahr('H8 ohne Marktbewertung: kein Vorschlag, Weg „Marktbewertung abrufen"', r.markt === null && /Marktbewertung abrufen/.test(P.zielVorschlagHtml(r)) && !/data-zv=/.test(P.zielVorschlagHtml(r)));
}
{
  /* ältere Karte ohne q75: high = Mitte × 1,1 ist keine gemessene Spanne -> Mitte */
  const P = await vorschlagLauf({ plz: '52062', _mb_state: KARTE({ med: 3000, high: 3300 }) });
  gleich('H9 alte Karte mit Ersatzspanne × 1,1: Mitte', [P.zielVorschlaege({ einheiten: EINH }).markt.qm, P.zielVorschlaege({ einheiten: EINH }).markt.art], [10, 'mitte']);
  const P2 = await vorschlagLauf({ plz: '52062', zb_markt_qm: '13,5', _mb_state: KARTE({ med: 3000, high: 3600, qm: 10, q75_qm: 12 }) });
  gleich('H10 eigene marktübliche Miete nach Modernisierung geht vor', [P2.zielVorschlaege({ einheiten: EINH }).markt.qm, P2.zielVorschlaege({ einheiten: EINH }).markt.art], [13.5, 'eigen']);
}

/* ── I · v3213 · W-6 · Ziel-Bruttomietrendite in Stufen (potenzial.js, Stufen als Parameter) ── */
{
  const P = await vorschlagLauf({ plz: '52062' });
  const ST = [{ jahr: 1, pct: 5 }, { jahr: 3, pct: 6 }];
  gleich('I1 vor der ersten Stufe (Jahr 0): kein Ziel', P.zielBmrAn(ST, 0), null);
  gleich('I2 Jahr 1 und 2: 5 %', [P.zielBmrAn(ST, 1).pct, P.zielBmrAn(ST, 2).pct], [5, 5]);
  gleich('I3 ab Jahr 3: 6 %', [P.zielBmrAn(ST, 3).pct, P.zielBmrAn(ST, 10).pct], [6, 6]);
  const r = JSON.parse(JSON.stringify(P.zielBmrPruefen(ST, 2024, [
    { k: 'ankauf', jahr: 2024, bmy: 4.5 }, { k: 'bestand', jahr: 2026, bmy: 5.2 }, { k: 'zielbild', jahr: 2027, bmy: 5.9 }, { k: 'mieterhoehung', jahr: null, bmy: 5.5 }])));
  gleich('I4 Ankauf 2024: keine Stufe, kein Urteil', [r.ankauf.ziel, r.ankauf.erreicht], [null, null]);
  gleich('I5 Bestand 2026 (Jahr 2): Ziel 5 %, 5,2 % erreicht', [r.bestand.ziel, r.bestand.erreicht], [5, true]);
  gleich('I6 Zielbild 2027 (Jahr 3): Ziel 6 %, 5,9 % nicht erreicht', [r.zielbild.ziel, r.zielbild.ziel_ab, r.zielbild.erreicht], [6, 3, false]);
  gleich('I7 Spalte ohne Jahr: keine Auswertung', r.mieterhoehung, undefined);
  gleich('I8 ohne Stufen oder ohne Kaufjahr: leer', [JSON.stringify(P.zielBmrPruefen([], 2024, [{ k: 'bestand', jahr: 2026, bmy: 5 }])), JSON.stringify(P.zielBmrPruefen(ST, null, [{ k: 'bestand', jahr: 2026, bmy: 5 }]))], ['{}', '{}']);
}

/* ── J · v3244 · § 558 nur, wo § 558 gilt; Vergleichsmiete ohne Angebotsniveau ─────────────────── */
{
  const ctx = { kapp: { pct: 20 }, vgl_qm: 12, heute: HEUTE };
  for (const [art, norm] of [['staffel', '557a'], ['index', '557b']]) {
    const s = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: 640, mv_art: art }, ctx);
    const v = K.teilVertrag(s, 500);
    gleich('J1 ' + art + ' mit eigener Soll 640: § 558-Anteil = Ist 500', K.teil558(s, 500), 500);
    gleich('J1 ' + art + ': Vertragsposten 640 (+140), Gesamt-Soll bleibt 640', [v.art, v.monat, v.plus, s.miete], [art, 640, 140, 640]);
    wahr('J1 ' + art + ': Norm ' + norm + ', Text nennt den Ausschluss', new RegExp(norm).test(v.norm) && /ausgeschlossen|keine Erhöhung bis zur Vergleichsmiete/.test(v.text));
    const o = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_art: art }, ctx);
    gleich('J2 ' + art + ' ohne eigene Soll: kein Posten-Betrag, § 558 = Ist', [K.teil558(o, 500), K.teilVertrag(o, 500).monat, o.miete], [500, null, null]);
  }
  const sg = K.sollFuer({ ist: 900, wfl: 80, status: 'vermietet', art: 'gewerbe', soll: 1000 }, ctx);
  gleich('J3 Gewerbe: § 558 = Ist, Posten 1.000', [K.teil558(sg, 900), K.teilVertrag(sg, 900).monat, K.teilVertrag(sg, 900).art], [900, 1000, 'gewerbe']);
  /* normale Wohnung: bis zur Vergleichsmiete bzw. Kappung, mit Umlage § 559 getrennt */
  let sw = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 20 }, vgl_qm: 9, heute: HEUTE });
  gleich('J4 Wohnung, Vergleichsmiete 9,00: § 558 bis 540', [K.teil558(sw, 500), K.teilVertrag(sw, 500), sw.grenze], [540, null, 'Vergleichsmiete']);
  sw = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 15 }, vgl_qm: 10, heute: HEUTE });
  gleich('J5 Wohnung, Kappung 15 %: § 558 bis 575', [K.teil558(sw, 500), sw.grenze], [575, 'Kappungsgrenze 15 %']);
  sw = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', mv_letzte_erhoehung: '2023-01-01', massnahmen: [{ id: 'bad', t: 'Bad', k: 12000, bewohnt: true }] }, { kapp: { pct: 20 }, vgl_qm: 9, heute: HEUTE });
  gleich('J6 mit Umlage § 559 80 €: § 558-Anteil ohne Umlage 540, Gesamt 620', [K.teil558(sw, 500), sw.miete], [540, 620]);

  /* potenzial.js: Rangfolge der Vergleichsmiete und die Stufe Mieterhöhung */
  const EIN = [{ nr: '1', wfl: '60', ist: '500', status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' },
               { nr: '2', wfl: '60', ist: '500', status: 'vermietet', soll: '640', mv_art: 'staffel' }];
  const MS_Q = { vergleichsmiete: { qm: 9, art: 'mietspiegel_qualifiziert', quelle: 'Mietspiegel Musterstadt 2025' } };
  const MS_A = { vergleichsmiete: { qm: 9, art: 'mietpreisuebersicht', quelle: 'Gutachterausschuss Muster', datum: '2026-10-01' } };
  let P = await vorschlagLauf({ plz: '52062', me_soll: '20' }, { _dpMarktdaten: MS_Q });
  let m = P.modell({ einheiten: EIN });
  wahr('J7 qualifizierter Mietspiegel: Vergleichsmiete 9,00, Herkunft sagt es', m.vgl.qm === 9 && m.vgl.qualifiziert === true && /qualifizierter Mietspiegel/.test(m.vgl.herkunft));
  const k = m.kappung.pct, z1 = Math.min(540, 500 * (1 + k / 100));
  gleich('J8 Wohnung 1: § 558 bis Mietspiegel/Kappung (' + z1 + '), me_soll 20,00 wirkt nicht', P.soll558(m.wohnungen[0]), z1);
  gleich('J9 Staffelwohnung: § 558 = Ist, Posten 640', [P.soll558(m.wohnungen[1]), P.sollVertrag(m.wohnungen[1]).monat], [500, 640]);
  gleich('J10 Stufe Mieterhöhung: § 558 plus Vertrag, getrennt ausgewiesen',
    [m.stufen.mieterhoehung.miete_m, m.stufen.mieterhoehung.plus558_m, m.stufen.mieterhoehung.vertrag_m], [z1 + 640, z1 - 500, 140]);
  wahr('J11 Zielbild behält die Staffel (Gesamt-Soll nicht still kleiner)', m.stufen.zielbild == null || m.stufen.zielbild.miete_m >= z1 + 640 - 0.01);
  P = await vorschlagLauf({ plz: '52062', ds2_marktmiete: '14' }, { _dpMarktdaten: MS_Q });
  m = P.modell({ einheiten: EIN });
  gleich('J12 qualifizierter Mietspiegel + Marktmiete 14,00: es gilt der Mietspiegel, kein Angebotswert', [m.vgl.qm, !!m.vgl.marktmiete], [9, false]);
  P = await vorschlagLauf({ plz: '52062', ds2_marktmiete: '14' }, { _dpMarktdaten: MS_A });
  m = P.modell({ einheiten: EIN });
  wahr('J13 amtliche Mietpreisübersicht geht der Marktmiete vor, mit Stand', m.vgl.qm === 9 && /Mietpreisübersicht/.test(m.vgl.herkunft) && /01\.10\.2026/.test(m.vgl.herkunft));
  P = await vorschlagLauf({ plz: '52062', me_soll: '20' });
  m = P.modell({ einheiten: EIN });
  gleich('J14 nur me_soll (Einheiten-Soll im Tab Miete): keine Vergleichsmiete, § 558 = Ist', [m.vgl.qm, P.soll558(m.wohnungen[0])], [0, 500]);
  P = await vorschlagLauf({ plz: '52062', me_soll: '20', ds2_marktmiete: '10' });
  m = P.modell({ einheiten: EIN });
  wahr('J15 ohne amtliche Quelle: Marktmiete nur als markierter Ersatz', m.vgl.qm === 10 && m.vgl.marktmiete === true && /Ersatz/.test(m.vgl.herkunft));
  P = await vorschlagLauf({ plz: '52062', zb_vgl_qm: '8' }, { _dpMarktdaten: MS_Q });
  m = P.modell({ einheiten: EIN });
  gleich('J16 eigene Vergleichsmiete geht vor', [m.vgl.qm, m.vgl.art], [8, 'eigen']);
  P = await vorschlagLauf({ plz: '52062' }, { _dpMarktdaten: Object.assign({ fuer: 'a' }, MS_Q), _currentObjKey: 'b' });
  gleich('J17 Marktdaten eines anderen Objekts zählen nicht', P.modell({ einheiten: EIN }).vgl.qm, 0);
}

console.log('mietpotenzial-pruefen (v3075, v3244): ' + (n - fehler) + ' von ' + n + ' ok');
process.exit(fehler ? 1 : 0);
