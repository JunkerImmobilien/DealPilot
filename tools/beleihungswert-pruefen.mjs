#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/beleihungswert-pruefen.mjs · v2630

   Prueft den indikativen Beleihungswert-Check (marktbericht/backend/src/lib/
   beleihungswert.js) an der ECHTEN Datei:

     Teil 1  Regelfaelle der BelWertV mit HANDGERECHNETEN Sollwerten
             (Overrent, Underrent, BWK-Mindestquote, Mindestzins, Sachwert
             > 20 % darunter, Gewerbeanteil, Leerstand, Mindestzins-Herkunft,
             Auslauf/Kleindarlehen, Marktwertdeckel, § 4 Abs. 2, Vervielfaeltiger).
     Teil 2  Kette: die eingefrorenen Demo-Objekte aus tools/wertermittlung-
             faelle.json laufen durch den ECHTEN CrossCheckService.compute
             (offline, feste Uhr, pg gestellt), dann durch eingabenAusBericht()
             und beleihungswert() - kommt der Rechenweg des Berichts an?

   Parameter wie in frontend/js/config.js (BaFin 5,5 / 6,5 %).
   Aufruf: node tools/beleihungswert-pruefen.mjs [--alle]   RC=0 sauber, 1 rot, 2 kaputt
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as nodeModule from 'node:module';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(WURZEL, 'marktbericht/backend/src');
const ALLE = process.argv.includes('--alle');
/* --src=<dir>: CrossCheckService aus einem anderen Stand (z. B. git archive HEAD),
   wenn im Arbeitsverzeichnis gerade jemand anderes am Kern baut. Der Check
   selbst kommt immer aus dem Repo. */
const SRC_CC = ((process.argv.find((a) => a.startsWith('--src=')) || '').slice(6)) || SRC;

const FEST = Date.parse('2026-10-21T12:00:00Z');
const _Date = Date;
class FesteUhr extends _Date { constructor(...a) { if (a.length) super(...a); else super(FEST); } static now() { return FEST; } }
globalThis.Date = FesteUhr;
if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({ resolve(spec, ctx, next) {
    if (spec === 'pg') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
      'class Pool { constructor() {} query() { return Promise.reject(new Error("offline")); } on() {} end() {} }\nexport default { Pool };') };
    return next(spec, ctx);
  } });
}

let K, CCS;
try {
  K = await import(pathToFileURL(path.join(SRC, 'lib/beleihungswert.js')).href);
} catch (e) { console.log('PRUEFER KAPUTT: ' + e.message); process.exit(2); }
try { CCS = (await import(pathToFileURL(path.join(SRC_CC, 'services/CrossCheckService.js')).href)).CrossCheckService; }
catch (e) { CCS = null; console.log('  Hinweis: CrossCheckService nicht ladbar (' + e.message.slice(0, 60) + ') - Teil 2 entfaellt'); }

const P = { mindestzins: { wohnen_pct: 5.5, gewerbe_pct: 6.5, gueltig_ab: '01.01.2024' }, rendite_30j: { pct: 3.86, datum: '21.10.2026' } };
let n = 0, rot = 0; const zeilen = [];
const ok = (id, was, ist, soll, tol = 0) => {
  n++;
  const gut = (soll === null || typeof soll === 'boolean' || typeof soll === 'string') ? ist === soll : (typeof ist === 'number' && Math.abs(ist - soll) <= tol + 1e-9);
  if (!gut) rot++;
  zeilen.push((gut ? '  ok   ' : '  ROT  ') + id + ' ' + was + ': ist ' + ist + ', soll ' + soll + (tol ? ' ±' + tol : ''));
};
const basis = (f = {}) => Object.assign({
  objektart: 'mfh',
  wohnen: { einheiten: [{ nr: 'WE 1', wfl: 100, leer: false, vertrag_jahr: 9600 }], markt_qm: 8 },
  bwk: { verwaltung: 400, instandhaltung: 1400, mietausfall: 192, summe: 1992, rohertrag: 9600 },
  bodenwert: 50000, rnd_jahre: 40, gnd_jahre: 80, lzs_pct: 2.5, lzs_stufe: 'A', verkehrswert: 1e9,
}, f);

/* ── Teil 1 ─────────────────────────────────────────────────────────── */
ok('V', 'Vervielfaeltiger 5 % / 20 J (Tabellenwert 12,4622)', Math.round(K.vervielfaeltiger(5, 20) * 10000) / 10000, 12.4622);

{ // 1 Overrent: Vertrag 12.000 > nachhaltig 8 x 100 x 12 = 9.600
  const r = K.beleihungswert(basis({ wohnen: { einheiten: [{ nr: 'WE 1', wfl: 100, leer: false, vertrag_jahr: 12000 }], markt_qm: 8 },
    bwk: { verwaltung: 400, instandhaltung: 1400, mietausfall: 240, summe: 2040, rohertrag: 12000 } }), P);
  ok('1', 'Overrent: Rohertrag gedeckelt', r.ertragswert.rohertrag, 9600);
  ok('1', 'Overrent: Mietausfall 2 % vom gedeckelten Rohertrag', r.ertragswert.bwk.mietausfall, 192);
  ok('1', 'Overrent: BWK', r.ertragswert.bwk.summe, 1992);
  ok('1', 'Overrent: Ertragswert (4.858 x V(5,5 %/40) + 50.000)', r.ertragswert.wert, 127952, 1);
  ok('1', 'Overrent: gezaehlt', r.ertragswert.overrent_n, 1);
}
{ // 2 Underrent: Vertrag 7.200 < nachhaltig 9.600 -> Vertrag
  const r = K.beleihungswert(basis({ wohnen: { einheiten: [{ nr: 'WE 1', wfl: 100, leer: false, vertrag_jahr: 7200 }], markt_qm: 8 } }), P);
  ok('2', 'Underrent: Vertragsmiete zaehlt', r.ertragswert.rohertrag, 7200);
  ok('2', 'Underrent: BWK 400 + 1.400 + 144', r.ertragswert.bwk.summe, 1944);
  ok('2', 'Underrent: Ertragswert', r.ertragswert.wert, 90212, 1);
}
{ // 3 BWK 992 < 15 % von 9.600 = 1.440
  const r = K.beleihungswert(basis({ bwk: { verwaltung: 300, instandhaltung: 500, mietausfall: 192, summe: 992, rohertrag: 9600 } }), P);
  ok('3', 'BWK auf 15 % angehoben', r.ertragswert.bwk.summe, 1440);
  ok('3', 'Weg mindestquote_15', r.ertragswert.bwk.weg, 'mindestquote_15');
  ok('3', 'Ertragswert', r.ertragswert.wert, 136810, 1);
}
{ // 4 Zins: LZS 2,5 -> 5,5 angehoben; LZS 6,0 bleibt
  const a = K.beleihungswert(basis(), P);
  ok('4', 'LZS 2,5 % -> Mindestzins 5,5 %', a.ertragswert.zins_wohnen_pct, 5.5);
  ok('4', 'angehoben', a.ertragswert.zins_angehoben, true);
  const b = K.beleihungswert(basis({ lzs_pct: 6.0 }), P);
  ok('4', 'LZS 6,0 % ueber dem Mindestzins bleibt', b.ertragswert.zins_wohnen_pct, 6.0);
  ok('4', 'Ertragswert bei 6,0 %', b.ertragswert.wert, 119333, 1);
}
{ // 5 Sachwert > 20 % unter dem Ertragswert
  const r = K.beleihungswert(basis({ sachwert: { hk_gebaeude: 100000, alterswertminderung: -50000, aussenanlagen: 2000, gebaeude_sachwert: 52000, bodenwert: 50000, wert_bericht: 102000 } }), P);
  ok('5', 'Sachwert: 100.000 x 0,9 x 0,5 + 2.000 + 50.000', r.sachwert.wert, 97000);
  ok('5', 'Sicherheitsabschlag 10 %', r.sachwert.sicherheitsabschlag, 10000);
  ok('5', 'Abweichung zum Ertragswert', r.kontrolle.abweichung_pct, -24.19, 0.01);
  ok('5', 'besondere Pruefung', r.kontrolle.besondere_pruefung, true);
  ok('5', 'Ergebnis bleibt Ertragswert (Deckel)', r.beleihungswert, 127000);
}
{ // 6 Gewerbeanteil: Wohnen 9.600, Gewerbe 6.000, je Nutzung eigener Zins
  const r = K.beleihungswert(basis({ gewerbe: { ansatz_jahr: 6000, vertrag_jahr: null },
    bwk: { verwaltung: 580, instandhaltung: 2100, mietausfall: 432, summe: 3112, rohertrag: 15600 } }), P);
  ok('6', 'Gewerbeanteil %', r.ertragswert.gewerbeanteil_pct, 38.46, 0.01);
  ok('6', 'Zins Gewerbe 6,5 %', r.ertragswert.zins_gewerbe_pct, 6.5);
  ok('6', 'Mietausfall 2 % / 4 %', r.ertragswert.bwk.mietausfall, 432);
  ok('6', 'Ertragswert (Wohnen 96.158 + Gewerbe 50.260 + Boden)', r.ertragswert.wert, 196418, 1);
}
{ // 7 Leerstand: leere Einheit mit nachhaltiger Miete
  const r = K.beleihungswert(basis({ wohnen: { einheiten: [{ nr: 'WE 1', wfl: 100, leer: false, vertrag_jahr: 9600 }, { nr: 'WE 2', wfl: 50, leer: true, vertrag_jahr: null }], markt_qm: 8 },
    bwk: { verwaltung: 800, instandhaltung: 2100, mietausfall: 288, summe: 3188, rohertrag: 14400 } }), P);
  ok('7', 'Leerstand: 9.600 + 50 x 8 x 12', r.ertragswert.rohertrag, 14400);
  ok('7', 'Hinweis Leerstand', r.hinweise.some((h) => /leere Einheit/.test(h)), true);
}
{ // 8 Mindestzins-Herkunft
  ok('8', 'BaFin-Satz Wohnen', K.mindestzins(P, 'wohnen').pct, 5.5);
  ok('8', 'aus Rendite 3,86 -> 3,9 + 3 = 6,9 -> Korridor 5,5', K.mindestzins({ rendite_30j: { pct: 3.86 } }, 'wohnen').pct, 5.5);
  ok('8', 'aus Rendite 1,2 -> 1,2 + 3 = 4,2', K.mindestzins({ rendite_30j: { pct: 1.2 } }, 'wohnen').pct, 4.2);
  ok('8', 'aus Rendite 0,3 Gewerbe -> 4,3 -> Untergrenze 4,5', K.mindestzins({ rendite_30j: { pct: 0.3 } }, 'gewerbe').pct, 4.5);
  const u = K.mindestzins({}, 'wohnen');
  ok('8', 'ohne Wert: Untergrenze 3,5', u.pct, 3.5);
  ok('8', 'ohne Wert: gekennzeichnet', u.herkunft, 'untergrenze');
}
{ // 9 Auslauf + Kleindarlehen
  const r = K.beleihungswert(basis({ darlehen: 100000 }), P);
  ok('9', 'Auslauf 100.000 / 127.000', r.auslauf.auslauf_pct, 78.74, 0.01);
  ok('9', '60-%-Grenze', r.auslauf.grenze_60_eur, 76200);
  ok('9', 'ueber 60 %', r.auslauf.ueber_60, true);
  ok('9', 'Kleindarlehen moeglich', r.kleindarlehen.moeglich, true);
  const g = K.beleihungswert(basis({ darlehen: 700000 }), P);
  ok('9', 'ueber 600.000: kein Kleindarlehen', g.kleindarlehen.moeglich, false);
}
{ // 10 Marktwertdeckel (§ 16 Abs. 2 PfandBG)
  const r = K.beleihungswert(basis({ lzs_pct: 1.0, verkehrswert: 100000 }), P);
  ok('10', 'auf Verkehrswert gedeckelt', r.beleihungswert, 100000);
  ok('10', 'basis', r.basis, 'marktwert_deckel');
}
{ // 11 § 4 Abs. 2: ETW ohne Ertragswert, Sachwert vorhanden
  const r = K.beleihungswert({ objektart: 'etw', wohnen: { einheiten: [] }, bodenwert: 20000, rnd_jahre: 30,
    sachwert: { hk_gebaeude: 200000, alterswertminderung: -100000, aussenanlagen: 0, gebaeude_sachwert: 100000, bodenwert: 20000 }, verkehrswert: 1e9 }, P);
  ok('11', 'ETW ohne Ertragswert: Sachwert 90.000 + 20.000', r.beleihungswert, 110000);
  ok('11', 'basis sachwert_4_2', r.basis, 'sachwert_4_2');
  const m = K.beleihungswert({ objektart: 'mfh', wohnen: { einheiten: [] }, rnd_jahre: 30 }, P);
  ok('11', 'MFH ohne Ertragswert: kein Check', m.verfuegbar, false);
}

/* ── Teil 2 · Kette ueber den echten CrossCheckService ─────────────── */
const kette = [];
if (CCS) {
  const F = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tools/wertermittlung-faelle.json'), 'utf8'));
  const faelle = (F.ebene_c && F.ebene_c.faelle) || {};
  /* Sollwerte = die Zahlen DESSELBEN Berichtslaufs (kommt der Rechenweg an?).
     Eingefroren am Stand 06d11137 (21.10.2026): siehe Journal v2630. */
  const soll = { demo: 1, ueber: 1, westerfeld_body: 1 };
  for (const name of Object.keys(soll)) {
    const f = faelle[name];
    if (!f) { ok('K-' + name, 'Fall vorhanden', false, true); continue; }
    const cc = CCS.compute(...JSON.parse(JSON.stringify(f.argumente)));
    const ein = K.eingabenAusBericht(cc, { objektart: f.argumente[0].property_type, darlehen: name === 'westerfeld_body' ? 600000 : 400000 });
    const r = K.beleihungswert(ein, P);
    const ew = cc.ertragswert || {};
    const s = { re: ew.rohertrag_pa_eur };
    ok('K-' + name, 'Bericht: Rohertrag kommt an', ein.bwk.rohertrag, ew.rohertrag_pa_eur);
    ok('K-' + name, 'Bericht: BWK kommt an', ein.bwk.summe, ew.bwk_pa_eur);
    ok('K-' + name, 'Bericht: BWK-Einzelansaetze = Summe', ein.bwk.verwaltung + ein.bwk.instandhaltung + ein.bwk.mietausfall, ew.bwk_pa_eur, 1);
    ok('K-' + name, 'Bericht: LZS kommt an', ein.lzs_pct, ew.liegenschaftszins_pct);
    ok('K-' + name, 'Bericht: RND kommt an', ein.rnd_jahre, ew.restnutzungsdauer_jahre);
    ok('K-' + name, 'Bericht: Bodenwert kommt an', ein.bodenwert, ew.bodenwert_eur);
    ok('K-' + name, 'Einheiten: Summe Ansatz = Rohertrag Wohnen', ein.wohnen.einheiten.reduce((a, e) => a + (e.ansatz_bericht_jahr || 0), 0), ein.wohnen.rohertrag_bericht_jahr, 2);
    ok('K-' + name, 'Einheiten gelesen', ein.wohnen.einheiten.length > 0, true);
    ok('K-' + name, 'Check verfuegbar', r.verfuegbar, true);
    ok('K-' + name, 'Beleihungswert <= Ertragswert des Berichts', r.beleihungswert <= cc.ertragswert.value_eur, true);
    ok('K-' + name, 'Zins = Mindestzins 5,5', r.ertragswert.zins_wohnen_pct, 5.5);
    ok('K-' + name, 'BWK >= 15 %', r.ertragswert.bwk.quote_pct >= 15, true);
    if (name === 'ueber') ok('K-ueber', 'Overrent nie ueber dem Bericht (Rohertrag Bel <= Bericht)', r.ertragswert.rohertrag <= s.re, true);
    kette.push({ name, ew_bericht: cc.ertragswert.value_eur, sw_bericht: cc.sachwert && cc.sachwert.value_eur, r });
  }
}

/* ── Ausgabe ────────────────────────────────────────────────────────── */
const eur = (x) => (x == null ? '–' : Math.round(x).toLocaleString('de-DE'));
console.log('beleihungswert-pruefen · ' + K.VERSION + ' · ' + n + ' Werte, ' + rot + ' rot');
for (const k of kette) {
  const e = k.r.ertragswert;
  console.log('  ' + k.name.padEnd(16) + 'EW Bericht ' + eur(k.ew_bericht) + ' → Beleihungswert ' + eur(k.r.beleihungswert)
    + ' (' + String(k.r.verhaeltnis_zum_verkehrswert_pct).replace('.', ',') + ' %) · RE ' + eur(e.rohertrag) + ' · BWK ' + eur(e.bwk.summe)
    + ' (' + String(e.bwk.quote_pct).replace('.', ',') + ' %) · Zins ' + e.zins_wohnen_pct + ' · RND ' + e.rnd_jahre
    + (k.r.sachwert ? ' · SW ' + eur(k.r.sachwert.wert) + ' (' + k.r.kontrolle.abweichung_pct + ' %)' : '')
    + (k.r.auslauf ? ' · Auslauf ' + k.r.auslauf.auslauf_pct + ' %' : ''));
}
(ALLE ? zeilen : zeilen.filter((z) => z.startsWith('  ROT'))).forEach((z) => console.log(z));
console.log(rot ? 'RC=1 rot' : 'RC=0 sauber');
process.exit(rot ? 1 : 0);
