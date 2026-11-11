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
     K  v3246 · Mietspiegel (Eingabe/Register, oberer Spannenwert, Schalter ms_wahl), veraltet/einfach/qualifiziert,
        Schätzung Angebotsmiete minus Abschlag nach Marktlage (22/10/5 %, Berlin-Warnung), eigene Soll gekappt
     J  v3244 · § 558 nur, wo § 558 gilt: Staffel/Index/Gewerbe -> § 558-Anteil = Ist, die eigene Soll-Angabe
        ist ein eigener Posten (teil558/teilVertrag); Vergleichsmiete eigene -> amtliche (qualifizierter
        Mietspiegel geht jeder Marktmiete vor) -> Marktmiete markiert; me_soll zählt nicht mehr
     L  v3250 · Mietspiegel-Verzeichnis: Route-Funktion mietspiegelFuer() (Detmold qualifiziert, ohne Satz der Weg),
        Anzeige mietspiegelRegister() (qualifiziert/veraltet/keiner/unklar/fehlt), Register füllt Art/Stand/Link,
        Eingabe schlägt Register, keiner/ohne Werte -> keine Mietspiegel-Rechnung, fremde Gemeinde ignoriert
     N  v3266 · DealPilot-Näherung (Zensus-Bestandsmiete, kalibriert an freien Mietspiegeln): Route nur ohne verwendbare
        Werte; Rangfolge nach amtlicher Mietpreisübersicht, vor der Schätzung aus Angebotsmieten; nie gegen eigene Eingabe;
        Hinweis bei Speicherverbot/Rechtevorbehalt (#ms-hinweis, Platzhalter der ms_*-Felder)
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
   weiter treffen - so ist bewiesen, dass sich sonst nichts bewegt hat.
   v3246 (09.11.2026) · GEWOLLT GEÄNDERT (Marcel: eigene Soll-Miete bei normalem Vertrag als § 558-Wert auf die
   Kappungsgrenze begrenzen): gemessen mit --alt=<potenzial.js v3245> --alt-kern=<Kern v3245>: 208 von 5.812 Fällen
   anders = Ist 500 × normaler Vertrag × Soll 640 über der Kappungsgrenze, JEDER nur in miete, herkunft, grenze,
   hinweise, eigen_soll, ueber_kappung (208) und umlage559 (48, wo Maßnahmen bewohnt umgelegt werden).
   E0 baut v3244 und v3246 zurück und trifft weiter die Summe v3075-v3241. */
const SUMME_V3075 = '852a5a0654d9af4af90892e410605866cf92a32fcd135ea2cea455d2c7496a1f';   /* 5796 Fälle, ohne Liste, Stand v3075-v3241 */
const SUMME_SOLL = '6895c24aa427c5cffa20918b7f2f5ff31360386b52bd0ee9508b6cd88bd202e7';   /* 5796 Fälle, ohne Liste, seit v3246 (v3244-v3245: a9db170e…) */
gleich('E Raster ' + neu.length + ' Fälle: Prüfsumme seit v3246 (bei Abweichung: --alt=<alte potenzial.js> --alt-kern=<alter Kern>)', SUMME, SUMME_SOLL);
/* v3246 · eigene Soll über der Kappungsgrenze wird begrenzt: miete = Kappungsgrenze, dazu eigen_soll, ueber_kappung,
   grenze, (umlage559) und ein neuer Hinweistext. zurueck3246 baut genau das auf den Stand v3245 zurück. */
const zurueck3246 = (x) => {
  if (!x || typeof x !== 'object' || !('eigen_soll' in x)) return x;
  const y = Object.assign({}, x);
  y.miete = y.eigen_soll; y.herkunft = 'eigene Angabe'; y.grenze = null;
  delete y.eigen_soll; delete y.ueber_kappung; delete y.umlage559;
  y.hinweise = (y.hinweise || []).map((h) => { const m = /^eigene Soll-Miete .* liegt über der Kappungsgrenze \((\d+) % in 3 Jahren\)/.exec(h); return m ? 'liegt über der Kappungsgrenze (' + m[1] + ' % in 3 Jahren)' : h; });
  return y;
};
const zurueck3244 = (x) => {
  if (!x || typeof x !== 'object' || !('vertrag_monat' in x || 'vertrag_text' in x)) return x;
  const y = Object.assign({}, x); delete y.vertrag_monat; delete y.vertrag_text;
  if (/^eigene Angabe \(/.test(y.herkunft || '')) y.herkunft = 'eigene Angabe';
  return y;
};
const zurueck = (x) => zurueck3244(zurueck3246(x));
const SUMME_ZURUECK = crypto.createHash('sha256').update(JSON.stringify(neu.map(zurueck))).digest('hex');
gleich('E0 Gegenprobe: ohne die v3244- und v3246-Felder (zurückgebaut) dieselbe Summe wie v3075-v3241 (sonst hat sich mehr bewegt)', SUMME_ZURUECK, SUMME_V3075);
if (ARG.summe) console.log('Prüfsumme Raster: ' + SUMME + ' (' + neu.length + ' Fälle), zurückgebaut ' + SUMME_ZURUECK);
if (typeof ARG.alt === 'string') {
  const A = await potenzialLaden(path.resolve(ARG.alt), typeof ARG['alt-kern'] === 'string' ? ARG['alt-kern'] : false);
  const alt = raster(A, true), neuL = raster(P, true);
  let ab = 0;
  /* v3244 · Abweichungen nach Feldern zählen; erlaubt sind nur die v3244-Felder (vertrag_monat, vertrag_text, herkunft) und die v3246-Felder (miete, herkunft, grenze, hinweise, eigen_soll, ueber_kappung, umlage559 bei eigener Soll über der Kappung) */
  const felder = {}; let fremd = 0;
  alt.forEach((x, i) => {
    if (JSON.stringify(x) === JSON.stringify(neuL[i])) return;
    ab++;
    const y = neuL[i] || {}, ks = new Set(Object.keys(x || {}).concat(Object.keys(y)));
    ks.forEach((k) => { if (JSON.stringify((x || {})[k]) !== JSON.stringify(y[k])) felder[k] = (felder[k] || 0) + 1; });
    if (JSON.stringify(zurueck(x)) !== JSON.stringify(zurueck(y))) { fremd++; if (fremd <= 5) console.log('  ABWEICHUNG Fall ' + i + ':\n    alt ' + JSON.stringify(x) + '\n    neu ' + JSON.stringify(y)); }
  });
  console.log('  --alt: ' + ab + ' von ' + alt.length + ' Fällen anders, Felder: ' + JSON.stringify(felder));
  gleich('E --alt: ' + alt.length + ' Fälle gleich bis auf die v3244- und v3246-Felder', fremd, 0);
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
  wahr('J15 ohne amtliche Quelle: Marktmiete nur als markierte Schätzung (v3246: ohne Abschlagsatz im Fenster unverändert 10,00, „Abschlag nicht bekannt“)', m.vgl.qm === 10 && m.vgl.marktmiete === true && /Schätzung aus Angebotsmieten, Abschlag nicht bekannt/.test(m.vgl.herkunft));
  P = await vorschlagLauf({ plz: '52062', zb_vgl_qm: '8' }, { _dpMarktdaten: MS_Q });
  m = P.modell({ einheiten: EIN });
  gleich('J16 eigene Vergleichsmiete geht vor', [m.vgl.qm, m.vgl.art], [8, 'eigen']);
  P = await vorschlagLauf({ plz: '52062' }, { _dpMarktdaten: Object.assign({ fuer: 'a' }, MS_Q), _currentObjKey: 'b' });
  gleich('J17 Marktdaten eines anderen Objekts zählen nicht', P.modell({ einheiten: EIN }).vgl.qm, 0);
}

/* ── K · v3246 · Mietspiegel mit Spanne, Schätzung aus Angebotsmieten nach Marktlage, eigene Soll gekappt ── */
{
  /* der Abschlag kommt aus der ECHTEN config.js (Objektliteral mieteAngebotAbschlag, ohne den Rest der Datei) */
  const cfgText = fs.readFileSync(JS('config.js'), 'utf8').replace(/\r\n/g, '\n');
  const cm = /\n    mieteAngebotAbschlag: (\{[\s\S]*?\n    \}),/.exec(cfgText);
  wahr('K0 config.js führt mieteAngebotAbschlag', !!cm);
  const ABS = cm ? vm.runInNewContext('(' + cm[1] + ')') : { stufen: {} };
  gleich('K0 Stufen 22 / 10 / 5 (Recherche 09.11.2026)', [ABS.stufen.angespannt, ABS.stufen.mittel, ABS.stufen.entspannt], [22, 10, 5]);
  const CFG = { DealPilotConfig: { mieteAngebotAbschlag: ABS } };
  async function lauf(feld, extra, ags) {
    const c = fenster(feld);
    Object.assign(c, CFG, extra || {});
    const F = feld || {};
    c.document.getElementById = (id) => (id in F ? { value: F[id], addEventListener() {}, dispatchEvent() {} } : null);
    c._dpPotenzial = { ags: ags || '05334002', plz: F.plz || '52062' };   /* agsJetzt() verlangt dieselbe PLZ */
    lade(c, JS('mietpotenzial-kern.js')); lade(c, JS('potenzial.js'));
    await c.DpPotenzial.kappungLaden();
    return c.DpPotenzial;
  }
  const H26 = '2026-10';
  /* Kern: Struktur und Wert */
  const MSQ = { art: 'qualifiziert', unten: '6,80', mittel: '7,60', oben: '8,40', stand: '2025-03' };
  const msq = K.mietspiegelAus(null, MSQ);
  gleich('K1 Struktur aus der Eingabe', [msq.art, msq.unten, msq.mittel, msq.oben, msq.stand, msq.gueltig_bis, msq.quelle], ['qualifiziert', 6.8, 7.6, 8.4, '2025-03', '2027-03', 'eingabe']);
  wahr('K1 Herkunft „Mietspiegel (eigene Eingabe aus dem Mietspiegel der Stadt)“', msq.herkunft === 'Mietspiegel (eigene Eingabe aus dem Mietspiegel der Stadt)');
  let w = K.mietspiegelWert(msq, 'oben', H26);
  gleich('K2 Standard oben: 8,40, qualifiziert gültig', [w.qm, w.genutzt, w.qualifiziert, w.veraltet], [8.4, 'oben', true, false]);
  wahr('K2 Hinweis oberer Spannenwert + § 558a Abs. 3', w.hinweise.some((h) => /oberer Spannenwert — trägt nur, wenn Ausstattung und Merkmale/.test(h) && /sonst Mittelwert/.test(h)) && w.hinweise.some((h) => /§ 558a Abs\. 3/.test(h) && /Gutachten oder Vergleichswohnungen/.test(h)));
  w = K.mietspiegelWert(msq, 'mittel', H26);
  gleich('K3 Schalter Mittelwert: 7,60, kein Oben-Hinweis', [w.qm, w.hinweise.some((h) => /oberer Spannenwert/.test(h))], [7.6, false]);
  gleich('K3 Schalter Unterwert: 6,80', K.mietspiegelWert(msq, 'unten', H26).qm, 6.8);
  gleich('K3 Mittelwert fehlt: nächster Wert unten, gesagt', [K.mietspiegelWert(K.mietspiegelAus(null, { art: 'einfach', unten: 7, oben: 9 }), 'mittel', H26).qm,
    K.mietspiegelWert(K.mietspiegelAus(null, { art: 'einfach', unten: 7, oben: 9 }), 'mittel', H26).hinweise.some((h) => /eingetragen nur der unterer Spannenwert/.test(h))], [7, true]);
  w = K.mietspiegelWert(K.mietspiegelAus(null, Object.assign({}, MSQ, { stand: '2024-05' })), 'oben', H26);
  gleich('K4 qualifiziert, Stand 05/2024 (älter als 2 Jahre): veraltet, keine Vermutung', [w.veraltet, w.qualifiziert, w.qm], [true, false, 8.4]);
  wahr('K4 Hinweis „veraltet — nur noch Indiz“ mit § 558d', w.hinweise.some((h) => /veraltet — nur noch Indiz/.test(h) && /§ 558d Abs\. 2 und 3/.test(h)) && /veraltet/.test(w.herkunft));
  w = K.mietspiegelWert(K.mietspiegelAus(null, Object.assign({}, MSQ, { stand: '' })), 'oben', H26);
  wahr('K4 qualifiziert ohne Stand: Hinweis Stand fehlt', w.hinweise.some((h) => /Stand des Mietspiegels fehlt/.test(h)) && w.qualifiziert === false);
  w = K.mietspiegelWert(K.mietspiegelAus(null, { art: 'einfach', unten: 7, mittel: 7.5, oben: 8, stand: '05/2026' }), 'oben', H26);
  wahr('K5 einfacher Mietspiegel: Hinweis drei Vergleichswohnungen § 558a Abs. 2 Nr. 4', w.hinweise.some((h) => /mit drei Vergleichswohnungen absichern \(§ 558a Abs\. 2 Nr\. 4 BGB\)/.test(h)) && w.qualifiziert === false && w.stand === '2026-05');
  /* Register füllt dieselbe Struktur; die Eingabe geht vor, die Vermutungsfrist des Registers gilt nur für denselben Stand */
  const REG = { art: 'qualifiziert', stand: '2025-03', vermutung_bis: '2026-12-31', url: 'https://example.org/ms' };
  gleich('K6 Register ohne Werte + Eingabe: Werte der Eingabe, Frist und Link vom Register', [K.mietspiegelAus(REG, { unten: 6, oben: 8 }).gueltig_bis, K.mietspiegelAus(REG, { unten: 6, oben: 8 }).url, K.mietspiegelAus(REG, { unten: 6, oben: 8 }).art], ['2026-12', 'https://example.org/ms', 'qualifiziert']);
  gleich('K6 Register ohne Werte allein: kein Mietspiegelwert', K.mietspiegelAus(REG, {}), null);
  gleich('K6 Register mit Werten: Herkunft Register', K.mietspiegelAus(Object.assign({ unten: 6, mittel: 7, oben: 8 }, REG), {}).quelle, 'register');
  gleich('K6 Register „keiner“: null', K.mietspiegelAus({ art: 'keiner', unten: 6 }, {}), null);

  /* Abschlag nach Marktlage (Kern, Zahlen aus config.js) */
  gleich('K7 angespannt: Mietpreisbremse -> 22 %', [K.abschlagStufe(ABS, { bremse_gilt: true, kapp_pct: 20 }).pct, K.abschlagStufe(ABS, { bremse_gilt: true }).stufe], [22, 'angespannt']);
  gleich('K7 angespannt: Kappung 15 % ohne Bremse -> 22 %', K.abschlagStufe(ABS, { bremse_gilt: false, kapp_pct: 15 }).pct, 22);
  gleich('K7 mittel: weder Bremse noch 15 % -> 10 %', K.abschlagStufe(ABS, { bremse_gilt: false, kapp_pct: 20 }).pct, 10);
  gleich('K7 entspannt nur mit bekannter Einwohnerzahl < 20.000 -> 5 %', [K.abschlagStufe(ABS, { bremse_gilt: false, kapp_pct: 20, einwohner: 15000 }).pct, K.abschlagStufe(ABS, { bremse_gilt: false, kapp_pct: 20, einwohner: null }).pct, K.abschlagStufe(ABS, { bremse_gilt: false, kapp_pct: 20, einwohner: 25000 }).pct], [5, 10, 10]);
  gleich('K7 Bremse schlägt kleine Gemeinde', K.abschlagStufe(ABS, { bremse_gilt: true, einwohner: 15000 }).pct, 22);
  wahr('K7 Berlin: Warnung', /über 40 % über der Vergleichsmiete — Schätzung nicht belastbar, Mietspiegel eintragen/.test(K.abschlagStufe(ABS, { bremse_gilt: true, ags: '11000000' }).warnung || '') && K.abschlagStufe(ABS, { bremse_gilt: true, ags: '09162000' }).warnung === null);
  const s22 = K.vglAusAngebot(10, { pct: 22, stufe: 'angespannt' });
  gleich('K8 Schätzung 10,00 − 22 % = 7,80', [s22.qm, s22.pct], [7.8, 22]);
  wahr('K8 Kennzeichnung im Wortlaut, ohne Quellennamen', /^Schätzung aus Angebotsmieten abzüglich 22 % \(DealPilot-Ansatz nach Marktlage, nicht amtlich\) — für das Erhöhungsverlangen mit Mietspiegel, drei Vergleichswohnungen oder Gutachten belegen$/.test(s22.text)
    && !/BBSR|Scout|Immowelt|PriceHubble|Sprengnetter|Wohngeld/i.test(s22.text));

  /* potenzial.js: Rangfolge und Wirkung am Modell (Aachen: Kappung 15 %, Bremse gilt) */
  const EIN1 = [{ nr: '1', wfl: '60', ist: '450', status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' }];
  const MSF = { ms_art: 'qualifiziert', ms_unten: '6,80', ms_mittel: '7,60', ms_oben: '8,40', ms_stand: '2025-03' };
  let P = await lauf(Object.assign({ plz: '52062', ds2_marktmiete: '14' }, MSF));
  let m = P.modell({ einheiten: EIN1 });
  gleich('K9 Mietspiegel-Eingabe (Standard oben) vor der Marktmiete: 8,40, § 558 bis 504', [m.vgl.qm, m.vgl.quelle_art, !!m.vgl.marktmiete, P.soll558(m.wohnungen[0])], [8.4, 'mietspiegel_qualifiziert', false, 504]);
  gleich('K9 an der Einheit: Quelle, Mietspiegel und Hinweise', [m.wohnungen[0].soll.vgl_quelle_art, m.wohnungen[0].soll.ms.genutzt, m.wohnungen[0].soll.vgl_hinweise.length > 0], ['mietspiegel_qualifiziert', 'oben', true]);
  let zv = P.mietrechtDaten(m, 0).zeilen.find((z) => z.k === 'Vergleichsmiete');
  wahr('K9 Mietrecht-Zeile „Vergleichsmiete“: 8,40 €/m² · oberer Spannenwert, Quelle und § 558a Abs. 3', zv && /8,40/.test(zv.v) && /oberer Spannenwert/.test(zv.v) && /eigene Eingabe aus dem Mietspiegel der Stadt/.test(zv.u) && /§ 558a Abs\. 3/.test(zv.u));
  P = await lauf(Object.assign({ plz: '52062', ms_wahl: 'mittel' }, MSF));
  m = P.modell({ einheiten: EIN1 });
  gleich('K10 Schalter ms_wahl = mittel: 7,60, § 558 bis 456', [m.vgl.qm, P.soll558(m.wohnungen[0])], [7.6, 456]);
  P = await lauf(Object.assign({ plz: '52062', ms_wahl: 'unten' }, MSF));
  m = P.modell({ einheiten: EIN1 });
  gleich('K10 Schalter ms_wahl = unten: 6,80 unter Ist 7,50 - kein Spielraum, § 558 = Ist', [m.vgl.qm, P.soll558(m.wohnungen[0])], [6.8, 450]);
  P = await lauf(Object.assign({ plz: '52062', zb_vgl_qm: '8' }, MSF));
  m = P.modell({ einheiten: EIN1 });
  gleich('K11 eigene belegte Vergleichsmiete schlägt den Mietspiegel', [m.vgl.qm, m.vgl.quelle_art, m.wohnungen[0].soll.ms === undefined], [8, 'eigen', true]);
  P = await lauf(Object.assign({ plz: '52062' }, MSF), { _dpMarktdaten: { vergleichsmiete: { qm: 9.5, art: 'mietpreisuebersicht', quelle: 'Gutachterausschuss Muster' } } });
  gleich('K12 Mietspiegel-Eingabe vor der amtlichen Mietpreisübersicht', [P.modell({ einheiten: EIN1 }).vgl.qm, P.modell({ einheiten: EIN1 }).vgl.quelle_art], [8.4, 'mietspiegel_qualifiziert']);
  P = await lauf(Object.assign({ plz: '52062', ms_art: 'qualifiziert', ms_oben: '8,40', ms_unten: '6,80', ms_stand: '2024-05' }));
  zv = P.mietrechtDaten(P.modell({ einheiten: EIN1 }), 0).zeilen.find((z) => z.k === 'Vergleichsmiete');
  wahr('K13 veralteter qualifizierter Mietspiegel: Zeile warnt „veraltet — nur noch Indiz“', zv && zv.warn && /veraltet — nur noch Indiz/.test(zv.u));
  P = await lauf(Object.assign({ plz: '52062', ms_art: 'einfach', ms_oben: '8,40', ms_stand: '2026-01' }));
  zv = P.mietrechtDaten(P.modell({ einheiten: EIN1 }), 0).zeilen.find((z) => z.k === 'Vergleichsmiete');
  wahr('K13 einfacher Mietspiegel: Zeile nennt drei Vergleichswohnungen', zv && /drei Vergleichswohnungen/.test(zv.u));

  /* kein Mietspiegel, keine eigene Vergleichsmiete: Marktmiete minus Abschlag nach Marktlage */
  P = await lauf({ plz: '52062', ds2_marktmiete: '10' }, null, '05334002');   /* Aachen: Bremse -> angespannt */
  m = P.modell({ einheiten: EIN1 });
  gleich('K14 angespannt (Aachen): 10,00 − 22 % = 7,80, markiert', [m.vgl.qm, m.vgl.marktmiete, m.vgl.quelle_art, m.vgl.angebot.stufe], [7.8, true, 'angebot_abschlag', 'angespannt']);
  wahr('K14 Herkunft „abzüglich 22 % (DealPilot-Ansatz nach Marktlage, nicht amtlich)“', /abzüglich 22 % \(DealPilot-Ansatz nach Marktlage, nicht amtlich\)/.test(m.vgl.herkunft) && /Gutachten belegen/.test(m.vgl.herkunft));
  zv = P.mietrechtDaten(m, 0).zeilen.find((z) => z.k === 'Vergleichsmiete');
  wahr('K14 Mietrecht-Zeile warnt bei Schätzung', zv && zv.warn && zv.quelle_art === 'angebot_abschlag');
  /* v3286 · Begründung des Abschlags und Rechenweg der Höchstmiete (Marcel 11.11.2026: „DealPilot-Ansatz ohne Begründung") */
  wahr('K14b Vergleichsmiete begründet: Marktmiete 10,00 − 22 % = 7,80, weil Mietpreisbremse gilt, § 558 Abs. 2, Herkunft nur einmal',
    zv && /gerechnet: Marktmiete 10,00 €\/m² \(aktueller Marktdurchschnitt der Angebotsmieten/.test(zv.u) && /− 22 % = 7,80 €\/m²/.test(zv.u)
      && /Abschlag 22 %, weil Mietpreisbremse gilt \(Marktlage angespannt\)/.test(zv.u) && /§ 558 Abs\. 2 BGB/.test(zv.u)
      && zv.u.split('DealPilot-Ansatz nach Marktlage').length === 2 && !/BBSR|Scout|Immowelt|PriceHubble|Sprengnetter|Wohngeld/i.test(zv.u), zv && zv.u);
  let rw = P.mietrechtDaten(m, 0).zeilen.find((z) => z.k === 'Rechenweg');
  wahr('K14c Rechenweg (Aachen 15 %): 450 × 1,15 = 518 · 7,80 × 60 = 468 → höchstens 468, Neuvermietung 7,80 × 1,10 = 8,58',
    rw && rw.v === 'höchstens 468 €/Monat' && /Kappungsgrenze: 450 € × 1,15 = 518 €/.test(rw.u) && /Vergleichsmiete: 7,80 € \/m² × 60 m² = 468 €|Vergleichsmiete: 7,80 €\/m² × 60 m² = 468 €/.test(rw.u)
      && /Neuvermietung: 7,80 €\/m² × 1,10 = 8,58 €\/m²/.test(rw.u), rw && (rw.v + ' | ' + rw.u));
  gleich('K14c Rechenweg = Kern (teil558)', P.soll558(m.wohnungen[0]), 468);
  P = await lauf({ plz: '32609', ds2_marktmiete: '10' }, null, '05758016');   /* weder Bremse noch 15 % -> mittel */
  m = P.modell({ einheiten: EIN1 });
  gleich('K15 mittel (Gemeinde ermittelt: 20 % Gesetz, keine Bremse): 10,00 − 10 % = 9,00', [m.vgl.qm, m.vgl.angebot.stufe, m.kappung.herkunft], [9, 'mittel', 'gesetz']);
  P = await lauf({ plz: '32609', ds2_marktmiete: '10' }, { _dpMarktdaten: { zensus: { einwohner: 13000 } } }, '05758016');
  gleich('K16 entspannt nur mit bekannter Einwohnerzahl (13.000): 10,00 − 5 % = 9,50', [P.modell({ einheiten: EIN1 }).vgl.qm, P.modell({ einheiten: EIN1 }).vgl.angebot.stufe], [9.5, 'entspannt']);
  P = await lauf({ plz: '10115', ds2_marktmiete: '10' }, null, '11000000');
  m = P.modell({ einheiten: EIN1 });
  wahr('K17 Berlin: gerechnet (7,80) mit Warnung in Hinweisen und an der Einheit', m.vgl.qm === 7.8 && m.vgl.hinweise.some((h) => /über 40 %/.test(h)) && m.wohnungen[0].soll.vgl_hinweise.some((h) => /Mietspiegel eintragen/.test(h)));

  /* eigene Soll-Miete über der Kappungsgrenze (normaler Vertrag): als § 558-Wert gekappt */
  let s = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: 640, mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 20 }, vgl_qm: 12, heute: HEUTE });
  gleich('K18 eigene Soll 640 über Kappung 20 % (600): gekappt auf 600, Rest 40', [s.miete, s.eigen_soll, s.ueber_kappung, K.teil558(s, 500), s.grenze], [600, 640, 40, 600, 'Kappungsgrenze 20 %']);
  wahr('K18 Hinweis: der Teil darüber ist keine Erhöhung nach § 558', s.hinweise.some((h) => /eigene Soll-Miete 640,00 € liegt über der Kappungsgrenze \(20 % in 3 Jahren\)/.test(h) && /keine Erhöhung nach § 558/.test(h)) && /^eigene Angabe/.test(s.herkunft));
  s = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: 590, mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 20 }, vgl_qm: 12, heute: HEUTE });
  gleich('K19 eigene Soll 590 unter der Kappung: unverändert', [s.miete, s.eigen_soll, s.herkunft], [590, undefined, 'eigene Angabe']);
  s = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: 640, mv_art: 'staffel' }, { kapp: { pct: 20 }, vgl_qm: 12, heute: HEUTE });
  gleich('K20 Staffel bleibt wie v3244 (nicht gekappt)', [s.miete, s.eigen_soll], [640, undefined]);
  P = await lauf({ plz: '52062' });
  m = P.modell({ einheiten: [{ nr: '1', wfl: '60', ist: '500', status: 'vermietet', soll: '640', mv_letzte_erhoehung: '2023-01-01' }] });
  gleich('K21 Stufe Mieterhöhung (Aachen 15 %): 575 statt 640', [P.soll558(m.wohnungen[0]), m.stufen.mieterhoehung.miete_m, m.wohnungen[0].soll.ueber_kappung], [575, 575, 65]);
  /* v3249 · eigene Soll über einer BELEGTEN Vergleichsmiete: auf Vergleichsmiete × Fläche begrenzt; bei Schätzung nur Hinweis */
  s = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: 580, mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 20 }, vgl_qm: 9, vgl_art: 'mietspiegel_qualifiziert', heute: HEUTE });
  gleich('K22 Mietspiegel 9 €/m² × 60 = 540: eigene Soll 580 → 540', [s.miete, s.eigen_soll, s.ueber_vergleichsmiete, s.grenze], [540, 580, 40, 'Vergleichsmiete']);
  s = K.sollFuer({ ist: 500, wfl: 60, status: 'vermietet', soll: 580, mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 20 }, vgl_qm: 9, vgl_art: 'angebot_abschlag', heute: HEUTE });
  gleich('K23 Schätzung aus Angebot: eigene Soll bleibt 580, mit Hinweis', [s.miete, s.hinweise.some((h) => /geschätzten Vergleichsmiete/.test(h))], [580, true]);
  s = K.sollFuer({ ist: 600, wfl: 60, status: 'vermietet', soll: 650, mv_letzte_erhoehung: '2023-01-01' }, { kapp: { pct: 20 }, vgl_qm: 9, vgl_art: 'mietspiegel_einfach', heute: HEUTE });
  gleich('K24 Ist schon über Vergleichsmiete: § 558 bleibt Ist 600', [s.miete], [600]);
}

/* ── L · v3250 · Mietspiegel-Verzeichnis: Route (echte Funktion, ohne DB), Anzeige (Kern), Wirkung (potenzial.js) ── */
{
  const { mietspiegelFuer } = await import(new URL('file:///' + path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel/verzeichnis.js').replace(/\\/g, '/')).href);
  const det = mietspiegelFuer('05766020');
  gleich('L1 Route Detmold (05766020): qualifiziert, gefunden, Stand, Vermutung, Link', [det.art, det.gefunden, det.stand, det.vermutung_bis, /^https:\/\//.test(det.url)], ['qualifiziert', true, '2025-04-04', '2027-04-03', true]);
  const ohne = mietspiegelFuer('01001999');
  wahr('L1 Route Gemeinde ohne Satz: art null mit Weg (§ 558c Abs. 4, 50.000 Einwohner)', ohne.art === null && ohne.gefunden === false && /50\.000 Einwohnern/.test(ohne.hinweis) && /§ 558c Abs\. 4/.test(ohne.hinweis));
  gleich('L1 Route ohne gültigen AGS: null (Route antwortet 400)', [mietspiegelFuer('abc'), mietspiegelFuer('')], [null, null]);
  wahr('L1 Route ohne Portal- oder Quellennamen im Weg', !/Scout|Immowelt|immonet|PriceHubble|Sprengnetter|BBSR/i.test(ohne.hinweis));
  const loer = mietspiegelFuer('08336050'), unkl = mietspiegelFuer('08317065');
  gleich('L1 Verzeichnis: Lörrach „keiner“, Lahr „unklar“', [loer.art, unkl.art], ['keiner', 'unklar']);

  /* Anzeige: Kern mietspiegelRegister(satz, heute) */
  let z = K.mietspiegelRegister(det, '2026-11-09');
  gleich('L2 qualifiziert: Status, vorhanden, nicht veraltet', [z.status, z.vorhanden, z.veraltet, z.url === det.url], ['qualifiziert', true, false, true]);
  gleich('L2 Wortlaut', z.text, 'Mietspiegel der Gemeinde: qualifiziert (§ 558d BGB) · Stand 04.04.2025 · gilt bis voraussichtlich 03.04.2027');
  gleich('L2 Hinweis ohne Werte', z.werte_hinweis, 'Werte aus dem Mietspiegel eintragen — sonst rechnet DealPilot mit der Schätzung aus Angebotsmieten');
  z = K.mietspiegelRegister(det, '2027-05-01');
  wahr('L3 Register veraltet (vermutung_bis < heute): „veraltet seit 03.04.2027“, § 558d', z.status === 'veraltet' && z.veraltet && z.vorhanden && /veraltet seit 03\.04\.2027 — Vermutungswirkung \(§ 558d Abs\. 2 und 3 BGB\) entfällt, nur noch Indiz/.test(z.text));
  z = K.mietspiegelRegister(loer, '2026-11-09');
  wahr('L4 keiner: „kein Mietspiegel“, nicht vorhanden', z.status === 'keiner' && !z.vorhanden && /^Mietspiegel der Gemeinde: kein Mietspiegel/.test(z.text));
  z = K.mietspiegelRegister(unkl, '2026-11-09');
  wahr('L5 unklar: „ob ein Mietspiegel gilt, ist nicht belegt — bei der Stadt nachfragen“', z.status === 'unklar' && !z.vorhanden && /nicht belegt — ob ein Mietspiegel gilt, ist nicht belegt — bei der Stadt nachfragen/.test(z.text));
  z = K.mietspiegelRegister(ohne, '2026-11-09');
  wahr('L6 nicht im Verzeichnis: Weg mit 50.000 Einwohnern', z.status === 'fehlt' && /nicht im Verzeichnis/.test(z.text) && /50\.000 Einwohnern/.test(z.text));
  z = K.mietspiegelRegister({ art: 'einfach', stand: '2023', gueltig_bis: '2025-12-31', url: 'https://example.org/e' }, '2026-11-09');
  wahr('L6 einfach, gültig_bis vorbei: „abgelaufen am 31.12.2025“, Stand als Jahr', z.status === 'veraltet' && /einfach \(§ 558c BGB\) · Stand 2023 · abgelaufen am 31\.12\.2025/.test(z.text));
  gleich('L6 ohne Satz: null', K.mietspiegelRegister(null), null);

  /* Wirkung in potenzial.js: _dpMarktdaten.mietspiegel_register = { ags, satz } (dpMarktdatenMerken) */
  const cfgText = fs.readFileSync(JS('config.js'), 'utf8').replace(/\r\n/g, '\n');
  const cm = /\n    mieteAngebotAbschlag: (\{[\s\S]*?\n    \}),/.exec(cfgText);
  const CFG = { DealPilotConfig: { mieteAngebotAbschlag: cm ? vm.runInNewContext('(' + cm[1] + ')') : { stufen: {} } } };
  async function lauf(feld, satz, ags, regAgs) {
    const c = fenster(feld);
    Object.assign(c, CFG, satz ? { _dpMarktdaten: { mietspiegel_register: { ags: regAgs || ags, satz } } } : {});
    const F = feld || {};
    c.document.getElementById = (id) => (id in F ? { value: F[id], addEventListener() {}, dispatchEvent() {} } : null);
    c._dpPotenzial = { ags, plz: F.plz };
    lade(c, JS('mietpotenzial-kern.js')); lade(c, JS('potenzial.js'));
    await c.DpPotenzial.kappungLaden();
    return c.DpPotenzial;
  }
  const EIN1 = [{ nr: '1', wfl: '60', ist: '420', status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' }];
  let P = await lauf({ plz: '32756', ms_unten: '6,20', ms_oben: '8,10', ds2_marktmiete: '10' }, det, '05766020');
  let m = P.modell({ einheiten: EIN1 });
  gleich('L7 Register qualifiziert füllt Art, Stand, Frist und Link (Werte aus der Eingabe)', [m.vgl.qm, m.vgl.quelle_art, m.vgl.ms.stand, m.vgl.ms.gueltig_bis, m.vgl.ms.url === det.url, m.vgl.ms.qualifiziert],
    [8.1, 'mietspiegel_qualifiziert', '2025-04', '2027-04', true, true]);
  P = await lauf({ plz: '32756', ms_art: 'einfach', ms_stand: '2026-01', ms_url: 'https://example.org/eigen', ms_oben: '8,10', ds2_marktmiete: '10' }, det, '05766020');
  m = P.modell({ einheiten: EIN1 });
  gleich('L8 Eingabe schlägt Register (Art, Stand, Link)', [m.vgl.quelle_art, m.vgl.ms.stand, m.vgl.ms.url, m.vgl.ms.gueltig_bis], ['mietspiegel_einfach', '2026-01', 'https://example.org/eigen', null]);
  P = await lauf({ plz: '32756', ds2_marktmiete: '10' }, det, '05766020');
  m = P.modell({ einheiten: EIN1 });
  wahr('L9 Register ohne Werte: keine Mietspiegel-Rechnung, Schätzung bleibt; Satz am Objekt lesbar', m.vgl.quelle_art === 'angebot_abschlag' && P.msRegister() && P.msRegister().art === 'qualifiziert');
  P = await lauf({ plz: '79539', ms_oben: '8,10', ds2_marktmiete: '10' }, loer, '08336050');
  m = P.modell({ einheiten: EIN1 });
  gleich('L10 Register „keiner“, Wert eingetragen: die Eingabe trägt, Art fehlt (wie einfach, mit Hinweis)', [m.vgl.quelle_art, m.vgl.hinweise.some((h) => /Art des Mietspiegels nicht angegeben/.test(h))], ['mietspiegel_einfach', true]);
  P = await lauf({ plz: '79539', ds2_marktmiete: '10' }, loer, '08336050');
  gleich('L10 Register „keiner“ ohne Eingabe: keine Mietspiegel-Rechnung', P.modell({ einheiten: EIN1 }).vgl.quelle_art, 'angebot_abschlag');
  P = await lauf({ plz: '32756', ms_oben: '8,10', ds2_marktmiete: '10' }, det, '05766020', '05758016');
  m = P.modell({ einheiten: EIN1 });
  gleich('L11 Satz einer anderen Gemeinde wird nicht gelesen', [P.msRegister(), m.vgl.quelle_art, m.vgl.ms.url, m.vgl.ms.gueltig_bis], [null, 'mietspiegel_einfach', null, null]);
}

/* ── M · v3255 · Mietspiegel-WERTE: Route (echte Funktionen, ohne DB), Wirkung in potenzial.js, MFH je Wohnung ── */
{
  const imp = (d) => import(new URL('file:///' + path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel', d).replace(/\\/g, '/')).href);
  const { mietspiegelFuer } = await imp('verzeichnis.js');
  const { mietspiegelMitWerten, mietspiegelWerteFuer, werteFuer } = await imp('werte.js');
  const route = (q) => mietspiegelMitWerten(mietspiegelFuer(q.ags), q);   /* = GET /mietspiegel (routes/api.js) */
  let a = route({ ags: '05770024', baujahr: '1972', wfl: '50.3' });
  gleich('M1 Tabelle Minden 1972, 50,3 m² (gerundet 50): 6,55 / 7,70 / 8,93, Zelle genannt', [a.werte_verfuegbar, a.werte.unten, a.werte.mittel, a.werte.oben, a.werte.zelle],
    [true, 6.55, 7.7, 8.93, 'Baujahr 1961 bis 1977 · 50 m²']);
  a = route({ ags: '05770024', baujahr: '1972', wfl: '50.3', merkmale: 'balkon,gegensprechanlage' });
  gleich('M1 Anwendungsbeispiel Minden S. 15 (Balkon + Gegensprechanlage): 7,12 / 8,38 / 9,72', [a.werte.unten, a.werte.mittel, a.werte.oben], [7.12, 8.38, 9.72]);
  a = route({ ags: '14713000', baujahr: '1965', wfl: '70' });
  gleich('M2 Regression Leipzig 1965, 70 m²: 5,98 × 0,869 = 5,20; −0,60 / +0,52', [a.werte.unten, a.werte.mittel, a.werte.oben], [4.6, 5.2, 5.72]);
  wahr('M2 Rechenweg nennt Basis und Faktor, Lage-Annahme als Hinweis', /Basis 5,98/.test(a.werte.rechnung) && /0,869/.test(a.werte.rechnung) && a.werte.hinweise.some((h) => /Lage nicht angegeben/.test(h)));
  a = route({ ags: '05766020', baujahr: '1965', wfl: '70', lage: '1', merkmale: 'gefangener_raum,hochwertiger_boden,strassenlaerm' });
  gleich('M2 Detmold ohne Sanitär-Auswahl (Query kennt nur Schalter): 6,12 + 0,57 − 0,32 + 0,44 − 0,27 = 6,54', a.werte.mittel, 6.54);
  a = route({ ags: '05770024', baujahr: '1972', wfl: '170' });
  wahr('M3 außerhalb (Minden 170 m², Geltung bis 160): null mit Hinweis, keine Verlängerung', a.werte.mittel === null && a.werte.unten === null && a.werte.hinweise.some((h) => /außerhalb/.test(h)));
  a = route({ ags: '05758016', baujahr: '2024', wfl: '70' });
  wahr('M3 außerhalb (Hiddenhausen Baujahr 2024, Tabelle bis 2022): null', a.werte.mittel === null && /Baujahr 2024/.test(a.werte.hinweise.join(' ')));
  a = route({ ags: '05770016' });
  gleich('M3 Gemeinde ohne Werte (Hüllhorst): werte_verfuegbar false, keine Werte', [a.werte_verfuegbar, a.werte], [false, undefined]);
  a = route({ ags: '05766020' });
  gleich('M3 ohne Baujahr/Fläche: nur werte_verfuegbar', [a.werte_verfuegbar, a.werte], [true, undefined]);
  gleich('M3 Kern ohne Fläche: null mit Grund', mietspiegelWerteFuer(werteFuer('05770024'), { baujahr: 1972 }).hinweise, ['Wohnfläche fehlt — der Mietspiegel ordnet nach Wohnungsgröße']);

  /* Wirkung: potenzial.js holt die Werte über Auth.apiCall (hier: dieselbe Routenfunktion) */
  const cfgText = fs.readFileSync(JS('config.js'), 'utf8').replace(/\r\n/g, '\n');
  const cm = /\n    mieteAngebotAbschlag: (\{[\s\S]*?\n    \}),/.exec(cfgText);
  const CFG = { DealPilotConfig: { mieteAngebotAbschlag: cm ? vm.runInNewContext('(' + cm[1] + ')') : { stufen: {} } } };
  const rufe = [];
  async function lauf(feld, ags, mfh) {
    const c = fenster(feld);
    const satz = mietspiegelMitWerten(mietspiegelFuer(ags), {});
    Object.assign(c, CFG, { _dpMarktdaten: { mietspiegel_register: { ags, satz } } });
    c.Auth = { apiCall(url) { rufe.push(url); const q = Object.fromEntries(new URL('http://x' + url).searchParams); return Promise.resolve(JSON.parse(JSON.stringify(route(Object.assign(q, { ags: q.ags }))))); } };
    if (mfh) { c._dpMfh = { einheiten: mfh }; c.DpMfhEinheiten = { artMitEinheiten: () => true }; }
    const F = feld || {}, EL = {};
    c.document.getElementById = (id) => (id in F ? (EL[id] = EL[id] || { value: F[id], innerHTML: '', addEventListener() {}, dispatchEvent() {} }) : null);
    c._dpPotenzial = { ags, plz: F.plz };
    lade(c, JS('mietpotenzial-kern.js')); lade(c, JS('potenzial.js'));
    await c.DpPotenzial.kappungLaden();
    c.DpPotenzial._el = EL;
    return c.DpPotenzial;
  }
  const warte = () => new Promise((r) => setImmediate(r));
  let P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', ds2_marktmiete: '12' }, '05770024');
  P.modell(); await warte(); await warte();
  let m = P.modell();
  gleich('M4 Einzelobjekt Minden: Register-Werte rechnen, oberer Wert 8,93 (Standard), qualifiziert, Quelle Register',
    [m.vgl.qm, m.vgl.quelle_art, m.vgl.ms.quelle, m.vgl.ms.unten, m.vgl.ms.mittel, m.vgl.werte && m.vgl.werte.zelle], [8.93, 'mietspiegel_qualifiziert', 'register', 6.55, 7.7, 'Baujahr 1961 bis 1977 · 50 m²']);
  wahr('M4 Abruf mit Baujahr und Fläche über den Proxy', rufe.some((u) => /^\/marktbericht\/mietspiegel\?ags=05770024&baujahr=1972&wfl=50$/.test(u)));
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', ds2_marktmiete: '12', 'ms-hinweis': '' }, '05770024');
  P.modell(); await warte(); await warte();
  P.msHinweis && P.msHinweis();
  const txt = String((P._el['ms-hinweis'] || {}).innerHTML || '').replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ');
  wahr('M7 Anzeige #ms-hinweis: „Mietspiegel der Gemeinde Minden · Werte für Baujahr 1972, 50 m²: 6,55 / 7,70 / 8,93 €/m² · gerechnet mit oberem Wert“',
    /Mietspiegel der Gemeinde Minden · Werte für Baujahr 1972, 50 m²: 6,55 \/ 7,70 \/ 8,93 €\/m² · gerechnet mit oberem Wert/.test(txt));
  wahr('M7 kein „Werte eintragen“, wenn das Register sie führt', !/Werte aus dem Mietspiegel eintragen/.test(txt));
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', ms_wahl: 'mittel', ds2_marktmiete: '12' }, '05770024');
  P.modell(); await warte(); await warte();
  gleich('M4 Wahl Mittelwert: 7,70', P.modell().vgl.qm, 7.7);
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', ms_oben: '9,50', ds2_marktmiete: '12' }, '05770024');
  P.modell(); await warte(); await warte();
  m = P.modell();
  gleich('M5 Eingabe am Objekt schlägt Register-Werte', [m.vgl.qm, m.vgl.ms.quelle], [9.5, 'eingabe']);
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', zb_vgl_qm: '7,10', ds2_marktmiete: '12' }, '05770024');
  P.modell(); await warte(); await warte();
  gleich('M5 eigene Vergleichsmiete schlägt Register-Werte', [P.modell().vgl.qm, P.modell().vgl.quelle_art], [7.1, 'eigen']);
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '170', ds2_marktmiete: '12' }, '05770024');
  P.modell(); await warte(); await warte();
  m = P.modell();
  gleich('M3 außerhalb der Tabelle: kein Mietspiegelwert, Schätzung bleibt', m.vgl.quelle_art, 'angebot_abschlag');
  /* MFH: je Wohnung die eigene Zelle (Wohnungsgröße) */
  const W = werteFuer('05770024');
  const soll = (fl) => mietspiegelWerteFuer(W, { baujahr: 1972, wfl: fl }).oben;
  const EIN = [{ nr: '1', wfl: '35', ist: '250', status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' },
    { nr: '2', wfl: '95', ist: '500', status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' }];
  P = await lauf({ plz: '32423', baujahr: '1972', ds2_marktmiete: '12' }, '05770024', EIN);
  P.modell({ einheiten: EIN }); await warte(); await warte();
  m = P.modell({ einheiten: EIN });
  const vq = m.wohnungen.map((w) => w.soll && w.soll.vgl_qm);
  gleich('M6 MFH: je Wohnung eigene Zelle — 35 m² und 95 m² (oberer Wert)', vq, [soll(35), soll(95)]);
  wahr('M6 die beiden Zellen unterscheiden sich (Wohnungsgröße zählt)', vq[0] > vq[1]);
  gleich('M6 Quelle je Wohnung: qualifizierter Mietspiegel', m.wohnungen.map((w) => w.soll && w.soll.vgl_quelle_art), ['mietspiegel_qualifiziert', 'mietspiegel_qualifiziert']);
}

/* ── N · v3266 · DealPilot-Näherung der Vergleichsmiete (Zensus, kalibriert an freien Mietspiegeln) und Hinweis bei Speicherverbot ── */
{
  const imp = (d) => import(new URL('file:///' + path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel', d).replace(/\\/g, '/')).href);
  const { mietspiegelFuer } = await imp('verzeichnis.js');
  const { mietspiegelMitWerten, werteLaden } = await imp('werte.js');
  const { mietspiegelMitNaeherung, naeherungFuer, naeherungParameter, naeherungText } = await imp('naeherung.js');
  const P0 = naeherungParameter();
  wahr('N0 naeherung.json kalibriert (Modell, Faktor, n, Güte)', P0 && P0.modell && P0.faktor > 0 && P0.n_staedte >= 20 && P0.guete && P0.guete.mape_pct > 0);
  /* Kalibrierung NUR aus freien Wertedateien: keine gesperrte, keine mit Speicherverbot */
  const W = werteLaden().jeAgs;
  const VZ = JSON.parse(fs.readFileSync(path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel/verzeichnis.json'), 'utf8')).saetze;
  const verboten = new Set(VZ.filter((s) => s.werte_nutzung === 'verboten').map((s) => s.ags));
  wahr('N0 Kalibrierung nur freie Mietspiegel (keine gesperrte Datei, kein Speicherverbot)', P0.kalibrierung.every((k) => W.get(k.ags) && W.get(k.ags).freigabe !== 'gesperrt' && !verboten.has(k.ags)));
  /* fester Zensus-Ausschnitt (erfunden): gesamt 10,00, Baujahr 1970-1979 9,00, 60-79 m² 11,00 -> Basis 9,90 */
  const ZEILEN = [{ dimension: 'gesamt', auspraegung: 'INSGESAMT', wert: 10, gebiet_name: 'Prüfstadt' },
    { dimension: 'baujahr', auspraegung: 'BAU1970B1979', auspraegung_text: '1970 - 1979', wert: 9 },
    { dimension: 'baujahr', auspraegung: 'BAU2016BXXXX', auspraegung_text: '2016 und später', wert: 14 },
    { dimension: 'flaeche', auspraegung: 'WFL060B079', auspraegung_text: '60 - 79 m²', wert: 11 }];
  const soll = Math.round(9 * 11 / 10 * P0.faktor * 100) / 100;
  const holen = async () => ZEILEN;
  const route = async (q) => mietspiegelMitNaeherung(mietspiegelMitWerten(mietspiegelFuer(q.ags), q), q, holen);   /* = GET /mietspiegel */
  let a = await route({ ags: '08111000', baujahr: '1975', wfl: '70' });   /* Stuttgart: Speicherverbot, keine Wertedatei */
  gleich('N1 Route Speicherverbot (Stuttgart): keine Werte, Näherung = Faktor × 9 × 11 / 10', [a.werte_verfuegbar, a.naeherung_verfuegbar, a.werte_nutzung, a.naeherung.qm, a.naeherung.quelle_art],
    [false, true, 'verboten', soll, 'dealpilot_naeherung']);
  wahr('N1 Rechenweg nennt Zensus, Klassen und Faktor', /Zensus 2022 Bestandsmiete der Gemeinde 10,00/.test(a.naeherung.rechnung) && /1970 - 1979: 9,00/.test(a.naeherung.rechnung) && /Kalibrierfaktor/.test(a.naeherung.rechnung));
  gleich('N1 Wortlaut der Herkunft', a.naeherung.text, 'DealPilot-Näherung der ortsüblichen Vergleichsmiete (aus der Zensus-Bestandsmiete, kalibriert an ' + P0.n_staedte
    + ' freien Mietspiegeln; mittlere Abweichung ' + P0.guete.mape_pct.toFixed(1).replace('.', ',') + ' %) — nicht der Mietspiegel; für das Erhöhungsverlangen mit dem Mietspiegel, drei Vergleichswohnungen oder Gutachten belegen');
  wahr('N1 ohne Portal- oder Anbieternamen', !/Scout|Immowelt|immonet|PriceHubble|Sprengnetter|BBSR/i.test(JSON.stringify(a.naeherung)));
  a = await route({ ags: '05711000', baujahr: '2030', wfl: '70' });   /* Bielefeld: freie Werte, Baujahr außerhalb */
  gleich('N2 freie Werte (Bielefeld), auch außerhalb der Tabelle: nie Näherung', [a.werte_verfuegbar, a.naeherung_verfuegbar, a.naeherung], [true, false, undefined]);
  a = await route({ ags: '05770024', baujahr: '1972', wfl: '50' });
  gleich('N3 gesperrt auf Staging (Werte ausgeliefert): keine Näherung', [a.werte_verfuegbar, a.naeherung_verfuegbar, a.naeherung], [true, false, undefined]);
  a = await route({ ags: '05770024', baujahr: '1972', wfl: '50', nur_frei: '1' });
  gleich('N3 gesperrt auf Prod (nur_frei): Näherung, Werte zurückgehalten', [a.werte_verfuegbar, a.werte_gesperrt, a.naeherung_verfuegbar, a.naeherung.qm > 0], [false, true, true, true]);
  a = await route({ ags: '08111000' });
  gleich('N3 ohne Baujahr/Fläche: nur naeherung_verfuegbar', [a.naeherung_verfuegbar, a.naeherung], [true, undefined]);
  let r = naeherungFuer(P0, [], { baujahr: 1975, wfl: 70 });
  wahr('N4 ohne Zensuswert: kein Wert (nie Kreis, nie Land)', r.qm === null && /keine Zensus-Bestandsmiete/.test(r.hinweise.join(' ')));
  r = naeherungFuer(P0, ZEILEN, { baujahr: 1955, wfl: 70 });
  gleich('N4 Baujahresklasse ohne Zensuswert: Miete aller Baujahre, mit Hinweis', [r.qm, r.hinweise.some((h) => /Baujahresklasse keinen Wert/.test(h))], [Math.round(10 * 11 / 10 * P0.faktor * 100) / 100, true]);
  gleich('N4 Baujahr 2020 in der offenen Klasse „2016 und später“', naeherungFuer(P0, ZEILEN, { baujahr: 2020, wfl: 70 }).qm, Math.round(14 * 11 / 10 * P0.faktor * 100) / 100);
  gleich('N4 Text-Funktion = Route', naeherungText(P0), naeherungFuer(P0, ZEILEN, { baujahr: 1975, wfl: 70 }).text);

  /* Wirkung in potenzial.js (Rangfolge objektVgl) */
  const cfgText = fs.readFileSync(JS('config.js'), 'utf8').replace(/\r\n/g, '\n');
  const cm = /\n    mieteAngebotAbschlag: (\{[\s\S]*?\n    \}),/.exec(cfgText);
  const CFG = { DealPilotConfig: { mieteAngebotAbschlag: cm ? vm.runInNewContext('(' + cm[1] + ')') : { stufen: {} } } };
  const rufe = [];
  async function lauf(feld, ags, q0) {
    const c = fenster(feld);
    const satz = await mietspiegelMitNaeherung(mietspiegelMitWerten(mietspiegelFuer(ags), q0 || {}), q0 || {}, holen);
    Object.assign(c, CFG, { _dpMarktdaten: { mietspiegel_register: { ags, satz } } });
    c.Auth = { apiCall(url) { rufe.push(url); const q = Object.assign({}, q0 || {}, Object.fromEntries(new URL('http://x' + url).searchParams)); return route(q).then((x) => JSON.parse(JSON.stringify(x))); } };
    const F = feld || {}, EL = {};
    c.document.getElementById = (id) => (id in F ? (EL[id] = EL[id] || { value: F[id], innerHTML: '', placeholder: '', title: '', addEventListener() {}, dispatchEvent() {} }) : null);
    c._dpPotenzial = { ags, plz: F.plz };
    lade(c, JS('mietpotenzial-kern.js')); lade(c, JS('potenzial.js'));
    await c.DpPotenzial.kappungLaden();
    c.DpPotenzial._el = EL;
    return c.DpPotenzial;
  }
  const warte = () => new Promise((res) => setTimeout(res, 0));
  const EIN1 = [{ nr: '1', wfl: '70', ist: '420', status: 'vermietet', mv_letzte_erhoehung: '2023-01-01' }];
  let P = await lauf({ plz: '70173', baujahr: '1975', wfl: '70', ds2_marktmiete: '14', 'ms-hinweis': '', ms_unten: '', ms_mittel: '', ms_oben: '' }, '08111000');
  P.modell(); await warte(); await warte();
  let m = P.modell({ einheiten: EIN1 });
  gleich('N5 Rangfolge: ohne Mietspiegel-Werte rechnet die Näherung (vor der Schätzung aus Angebotsmieten)', [m.vgl.qm, m.vgl.quelle_art, m.vgl.marktmiete, P.vglKurz(m.vgl)], [soll, 'dealpilot_naeherung', undefined, 'DealPilot-Näherung']);
  gleich('N5 Herkunft = Wortlaut der Route', m.vgl.herkunft, naeherungText(P0));
  wahr('N5 Abruf mit Baujahr und Fläche über den Proxy', rufe.some((u) => /^\/marktbericht\/mietspiegel\?ags=08111000&baujahr=1975&wfl=70$/.test(u)));
  P.msHinweis();
  const txt = String((P._el['ms-hinweis'] || {}).innerHTML || '').replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ');
  wahr('N6 #ms-hinweis bei Speicherverbot: „… · Mietspiegel öffnen — Die Werte darf DealPilot nicht vorhalten (Speicherung nur mit Genehmigung des Herausgebers). Bitte die Spanne aus dem Mietspiegel eintragen — bis dahin rechnet DealPilot mit der DealPilot-Näherung.“',
    /^Mietspiegel der Gemeinde: qualifiziert \(§ 558d BGB\) · Stand 04\/2024 · gilt bis 31\.12\.2026 · Mietspiegel öffnen — Die Werte darf DealPilot nicht vorhalten \(Speicherung nur mit Genehmigung des Herausgebers\)\. Bitte die Spanne aus dem Mietspiegel eintragen — bis dahin rechnet DealPilot mit der DealPilot-Näherung\./.test(txt));
  wahr('N6 darunter: „Gerechnet wird mit … — DealPilot-Näherung …“', /Gerechnet wird mit .*\/m² — DealPilot-Näherung der ortsüblichen Vergleichsmiete/.test(txt));
  gleich('N6 Felder unten/mittel/oben: Platzhalter und Fokus-Hinweis', [P._el.ms_oben.placeholder, /^Die Werte darf DealPilot nicht vorhalten/.test(P._el.ms_oben.title || '')], ['bitte aus dem Mietspiegel eintragen', true]);
  P = await lauf({ plz: '70173', baujahr: '1975', wfl: '70', ds2_marktmiete: '14', ms_oben: '9,80' }, '08111000');
  P.modell(); await warte(); await warte();
  m = P.modell({ einheiten: EIN1 });
  gleich('N7 eigene Mietspiegel-Eingabe schlägt die Näherung', [m.vgl.qm, m.vgl.quelle_art], [9.8, 'mietspiegel_qualifiziert']);
  P = await lauf({ plz: '70173', baujahr: '1975', wfl: '70', ds2_marktmiete: '14', zb_vgl_qm: '8,20' }, '08111000');
  P.modell(); await warte(); await warte();
  m = P.modell({ einheiten: EIN1 });
  gleich('N7 eigene Vergleichsmiete schlägt die Näherung', [m.vgl.qm, m.vgl.quelle_art], [8.2, 'eigen']);
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', ds2_marktmiete: '12' }, '05770024');
  P.modell(); await warte(); await warte();
  m = P.modell();
  gleich('N8 freie (bzw. auf Staging ausgelieferte) Werte: Mietspiegel, nie Näherung', [m.vgl.quelle_art, m.vgl.qm], ['mietspiegel_qualifiziert', 8.93]);
  P = await lauf({ plz: '32423', baujahr: '1972', wfl: '50', ds2_marktmiete: '12', 'ms-hinweis': '' }, '05770024', { nur_frei: '1' });
  P.modell(); await warte(); await warte();
  m = P.modell();
  P.msHinweis();
  const t2 = String((P._el['ms-hinweis'] || {}).innerHTML || '').replace(/<[^>]+>/g, '');
  gleich('N9 Vorbehalt auf Prod (Minden, nur_frei): Näherung rechnet', m.vgl.quelle_art, 'dealpilot_naeherung');
  wahr('N9 Hinweis Vorbehalt: „Die Werte darf DealPilot derzeit nicht ausliefern (Rechtevorbehalt …) … DealPilot-Näherung.“',
    /Mietspiegel öffnen — Die Werte darf DealPilot derzeit nicht ausliefern \(Rechtevorbehalt des Herausgebers, die Nutzung wird geklärt\)\. Bitte die Spanne aus dem Mietspiegel eintragen — bis dahin rechnet DealPilot mit der DealPilot-Näherung\./.test(t2));
  /* Kern: ohne Näherung (Route bietet sie nicht an) bleibt der Rückfall im Text */
  const z = K.mietspiegelRegister(Object.assign({}, mietspiegelFuer('08111000'), { naeherung_verfuegbar: false }), '2026-11-09');
  wahr('N10 Speicherverbot ohne Näherung: „bis dahin rechnet DealPilot mit der Schätzung aus Angebotsmieten.“', z.nutzung === 'verboten' && /bis dahin rechnet DealPilot mit der Schätzung aus Angebotsmieten\.$/.test(z.werte_hinweis));
  const z2 = K.mietspiegelRegister(Object.assign({}, mietspiegelFuer('05770024'), { werte_verfuegbar: true }), '2026-11-09');
  wahr('N10 Vorbehalt mit ausgelieferten Werten (Staging): kein Nutzungshinweis', !z2.nutzung && z2.werte_hinweis === K.MS_REG.werte);
}

console.log('mietpotenzial-pruefen (v3075, v3244, v3246, v3250, v3255, v3266, v3286): ' + (n - fehler) + ' von ' + n + ' ok');
process.exit(fehler ? 1 : 0);
