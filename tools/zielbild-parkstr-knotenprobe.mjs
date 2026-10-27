#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * zielbild-parkstr-knotenprobe.mjs — v2988 (27.10.2026)
 *
 * Knotenprobe Parkstr. 9, Bad Oeynhausen (MFH Bj 1905, 5 WE, 427 m²) am ECHTEN
 * Kern: ErtragswertService.ertragswert, PotenzialService.rechne,
 * lib/mietmodell_nrw.marktmiete, DealPilotObjectMapper.reportInput.
 * Zahlen gelesen am 27.10.2026 aus der Prod-DB (nur lesend):
 *   objects.data (_potenzial.ergebnis.basis/haus, _mfh.einheiten), mb.market_reports #32.
 *
 * Prueft Zeile fuer Zeile Rohertrag, BWK, Reinertrag, Bodenwertverzinsung,
 * Barwertfaktor (LZS 2,9 %), RND je Stufe - gegen die eigene Handrechnung aus der
 * Formel der ImmoWertV (§§ 28, 31-34) - und zeigt Bestand gegen Zielbild
 * vorher (v2987) und nachher (v2988) sowie die Wirkung von „Sanierung ausgefuehrt am".
 * Ohne DB und Netz. RC=0 sauber, RC=1 Abweichung.
 * ══════════════════════════════════════════════════════════════════════ */
import path from 'node:path';
import nodeModule from 'node:module';
import { pathToFileURL } from 'node:url';
/* 'pg' ohne node_modules (wie tools/wertermittlung-pruefen.mjs): ein Pool, der nie verbindet */
if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({ resolve(spec, ctx, next) {
    if (spec === 'pg') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
      'class Pool { constructor() {} query() { return Promise.reject(new Error("offline")); } on() {} end() {} } export default { Pool };') };
    return next(spec, ctx);
  } });
}
const B = path.join(process.cwd(), 'marktbericht', 'backend', 'src');
const imp = (p) => import(pathToFileURL(path.join(B, p)).href);
const { ErtragswertService } = await imp('services/ErtragswertService.js');
const PS = await imp('services/PotenzialService.js');
const { marktmiete, klasseAusPunkten } = await imp('lib/mietmodell_nrw.js');
const { DealPilotObjectMapper: M } = await imp('services/DealPilotObjectMapper.js');

let rot = 0;
const ok = (b, t) => { console.log((b ? '  ok  ' : '  ROT ') + t); if (!b) rot++; };
const de = (v) => Math.round(v).toLocaleString('de-DE');

/* ── Eingabe wie auf Prod (Basis des Potenzial-Laufs) ── */
const WE = [{ nr: '1', wfl: 92, ist: 644, soll: 800 }, { nr: '2', wfl: 86, ist: 602, soll: 750 }, { nr: '3', wfl: 92, ist: 874, soll: 874 },
  { nr: '4', wfl: 86, ist: 620, soll: 750 }, { nr: '5', wfl: 71, ist: 455, soll: 620 }];
const AMT_EIN = { ags: '05770004', gemeinde: 'Bad Oeynhausen', baujahr: 1905, wohnflaeche_qm: 85.4, modernisierung_klasse: klasseAusPunkten(8),
  kernsaniert: false, sanierungsjahr: null, wohnlage: 'gut', stichtag_jahr: 2026 };   /* v2991: Lagebeurteilung 1 = gute Wohnlage (amtlich, Örtliche Fachinformationen Minden-Lübbecke S. 1) */

console.log('=== 1 · amtliche Miete (Mietpreisübersicht Minden-Lübbecke, Abschnitt 9) ===');
const a0 = marktmiete(AMT_EIN);
ok(Math.abs(a0.miete_qm - 5.80) < 0.015, 'Bestand: Klasse ' + AMT_EIN.modernisierung_klasse + ', fiktives Bj ' + a0.fiktives_baujahr + ', 5,90 × 1,0 (Lage „gut“ aus Lagebeurteilung 1, seit v2991) × '
  + (0.94 + (1 - 0.94) * (100 - 85.4) / 20).toFixed(3) + ' = ' + a0.miete_qm + ' €/m² (bis v2990 auf Prod: 4,64 mit falscher Lage „einfach“)');
const aGut = marktmiete(Object.assign({}, AMT_EIN, { wohnlage: 'gut' }));
console.log('       Befund Lage: mit „gut“ (Stadtlage, Faktor 1,0) wären es ' + aGut.miete_qm + ' €/m² — siehe Prüfbericht, Entscheidung offen');
[3, 4, 5].forEach((k) => { const r = marktmiete(Object.assign({}, AMT_EIN, { modernisierung_klasse: k })); console.log('       Klasse ' + k + ': fiktives Bj ' + r.fiktives_baujahr + ' → ' + r.miete_qm + ' €/m²'); });

/* ── Basis-Eingabe des Kerns ── */
const roh = 23775, quote = 28;
const ein = { objektart: 'mfh', baujahr: 1905, baustatus: null, wohnflaeche_qm: 427, anzahl_we: 5, stichtag_jahr: 2026,
  miete_markt_jahr: roh, gewerbe_jahr: null, stellplatz_anz: 0, zusatz_jahr: null, sonstige_jahr: null,
  modellversion: 'agvga_nrw_2016', rnd_jahre: null, gnd_jahre: 80, mod_punkte: 8,
  lzs_pct: 2.9, lzs_stufe: 'A', lzs_quelle: 'GMB 2025 Kreis Minden-Lübbecke',
  bwk_modus: 'manuell', bwk_gesamt_jahr: Math.round(roh * quote / 100), bwk_bezugsgroesse_jahr: roh, bwk_quote_pct: quote, bwk_quote_herkunft: 'Modellansatz' };
const bw = { vollstaendig: true, wert: 178582 };
const band = { anker_qm: 4.64, anker_stufe: 'amtlich', anker_etikett: 'amtliche Miete des Gutachterausschusses', unten_qm: 3.71, oben_qm: 5.57, band_pct: 20 };

console.log('\n=== 2 · Bestand Zeile für Zeile (Kern gegen Handrechnung) ===');
const kB = ErtragswertService.ertragswert(Object.assign({}, ein), bw);
const q = 0.029, n = kB.nutzungsdauer.rnd, V = (1 - Math.pow(1 + q, -n)) / q;
/* der Kern rechnet mit dem auf zwei Stellen gerundeten Barwertfaktor (wie die Tabellen der Praxis) */
const RE = roh - Math.round(roh * quote / 100), BWV = Math.round(178582 * q), V2 = Math.round(V * 100) / 100, EW = (RE - BWV) * V2 + 178582;
console.log('       Rohertrag 5 WE: ' + WE.map((w) => '4,64 × ' + w.wfl).join(' + ') + ' × 12 = ' + de(4.64 * 427 * 12) + ' € (alle Ist über 5,57 → Anker)');
ok(Math.abs(4.64 * 427 * 12 - roh) < 1, 'Rohertrag ' + de(roh) + ' €');
ok(Math.abs(RE - 17118) <= 1, 'BWK 28 % = ' + de(roh * 0.28) + ' € → Reinertrag ' + de(RE) + ' €');
ok(n === 32, 'RND Anlage 2 (Bj 1905, 8 Punkte, GND 80) = ' + n + ' J.');
ok(Math.abs(kB.barwertfaktor - V) < 0.01, 'Barwertfaktor (1 − 1,029^−' + n + ') / 0,029 = ' + V.toFixed(2) + ' (Kern ' + kB.barwertfaktor + ')');
ok(Math.abs(kB.wert_ungerundet - EW) < 2, 'Bodenwertverzinsung 178.582 × 2,9 % = ' + de(BWV) + ' €; EW = (' + de(RE) + ' − ' + de(BWV) + ') × ' + V2.toFixed(2) + ' + 178.582 = ' + de(EW) + ' € (ungerundeter Faktor: ' + de((RE - BWV) * V + 178582) + ' €; Kern ' + de(kB.wert_ungerundet) + ', Prod 425.361)');

/* ── Potenzial-Lauf ── */
const wbFuer = (amtEin) => ({ ref: { ags: '05770004', units: 5, living_area: 427, build_year: 1905, property_type: 'mfh' }, cross_check: { ertragswert: { value_eur: 425000 } },
  ertragswert_eingabe: { ein, bodenwert: bw, wohnflaeche_wohnen: 427, miete_qm: 4.64, miete_band: band, markt_qm: 4.64 },
  amtliche_miete_eingabe: amtEin, valuation: null });
const auftrag = (plus, extra) => Object.assign({ varianten: [
  { key: 'mieterhoehung', miete_wohnen_jahr: WE.reduce((a, w) => a + w.soll * 12, 0), mod_punkte_plus: 0, kosten: 0 },
  { key: 'zielbild', miete_wohnen_jahr: WE.reduce((a, w) => a + w.soll * 12, 0), mod_punkte_plus: plus, kosten: 136000 }],
  wohnungen: WE.map((w) => ({ nr: w.nr, art: 'wohnen', wfl: w.wfl, miete_jahr: { bestand: w.ist * 12, mieterhoehung: w.soll * 12, zielbild: w.soll * 12 } })) }, extra || {});

console.log('\n=== 3 · Zielbild (136.000 € Maßnahmen, +1,1 Punkte) ===');
const vorher = await PS.PotenzialService.rechne(wbFuer(null), auftrag(1.1));   /* v2987: ohne amtliche Eingabe = altes Verhalten */
const nach = await PS.PotenzialService.rechne(wbFuer(AMT_EIN), auftrag(1.1));
const zV = vorher.haus.zielbild, zN = nach.haus.zielbild;
ok(vorher.haus.bestand.wert === 425000, 'Bestand 425.000 € (wie Prod)');
ok(zV.wert === 436000 && zV.rnd === 34.4, 'vorher (v2987): Zielbild ' + de(zV.wert) + ' €, RND ' + zV.rnd + ', Rohertrag ' + de(zV.rohertrag) + ' € (Prod: 436.000 / 34,4)');
ok(zN.wert === 436000, 'nachher (v2988): Zielbild ' + de(zN.wert) + ' € — Klasse 3 → ' + (zN.miete_nach_modernisierung || {}).klasse_nachher + ', keine höhere Tabellenmiete');
console.log('       Satz: ' + (zN.miete_nach_modernisierung || {}).satz);
const V34 = Math.round((1 - Math.pow(1.029, -34.4)) / 0.029 * 100) / 100;
ok(Math.abs(zN.wert_ungerundet - ((RE - BWV) * V34 + 178582)) < 2, 'Zielbild-Handrechnung: (' + de(RE) + ' − ' + de(BWV) + ') × ' + V34.toFixed(2) + ' + 178.582 = ' + de((RE - BWV) * V34 + 178582) + ' €');

console.log('\n=== 4 · Wenn die Maßnahmen Klasse 5 erreichen (Probe: +10 Punkte → 18) ===');
const k5 = await PS.PotenzialService.rechne(wbFuer(AMT_EIN), auftrag(10));
const m5 = k5.haus.zielbild.miete_nach_modernisierung;
ok(m5 && m5.wirkt && m5.klasse_nachher === 5, 'Klasse 5: ' + m5.qm_nachher + ' €/m² statt 4,64 → Rohertrag ' + de(k5.haus.zielbild.rohertrag) + ' €, Zielbild ' + de(k5.haus.zielbild.wert) + ' €');
const erwartRoh = WE.reduce((a, w) => { const iq = w.soll / w.wfl; const ob = m5.qm_nachher * 1.2, un = m5.qm_nachher * 0.8;
  return a + ((Math.round(iq * 100) / 100 <= Math.round(ob * 100) / 100 && iq >= un) ? w.soll * 12 : m5.qm_nachher * w.wfl * 12); }, 0);
ok(Math.abs(k5.haus.zielbild.rohertrag - erwartRoh) < 3, 'Rohertrag je Wohnung gegen Band ' + (m5.qm_nachher * 0.8).toFixed(2) + '–' + (m5.qm_nachher * 1.2).toFixed(2) + ': Hand ' + de(erwartRoh) + ' €');

console.log('\n=== 5 · Eigene Angabe „marktübliche Miete nach Modernisierung“ 6,50 €/m² ===');
const eg = await PS.PotenzialService.rechne(wbFuer(AMT_EIN), auftrag(1.1, { zielbild_markt_qm: 6.5 }));
const mE = eg.haus.zielbild.miete_nach_modernisierung;
ok(mE.weg === 'eigene_angabe' && mE.wirkt, 'eigene Angabe: Zielbild ' + de(eg.haus.zielbild.wert) + ' €, Rohertrag ' + de(eg.haus.zielbild.rohertrag) + ' €');
ok(eg.haus.mieterhoehung.wert === 425000, 'Mieterhöhung bleibt beim Bestandsband (eigene Angabe gilt nur im Zielbild): ' + de(eg.haus.mieterhoehung.wert) + ' €');

console.log('\n=== 6 · Quelle staffelt nicht (Anker = Ø Miete des Satzes) ===');
const wbS = wbFuer(null); wbS.ertragswert_eingabe = Object.assign({}, wbS.ertragswert_eingabe, { miete_band: Object.assign({}, band, { anker_stufe: 'satz_mittel', anker_etikett: 'Ø Miete des Liegenschaftszinssatzes' }) });
const ns = await PS.PotenzialService.rechne(wbS, auftrag(1.1));
const mS = ns.haus.zielbild.miete_nach_modernisierung;
ok(mS.weg === 'nicht_gestaffelt' && mS.entscheidung_offen && /eigenen Ansatz/i.test(mS.satz), 'Satz: ' + mS.satz.slice(0, 120) + '…');

console.log('\n=== 7 · „Sanierung ausgeführt am“ (Mapper) ===');
const obj = { objart: 'MFH', wfl: '427', baujahr: '1905', san: '137000', san_ust: 'brutto', kaufdat: '2024-12-23', ds2_zustand: 'renovierungsbeduerftig', plz: '32545', ort: 'Bad Oeynhausen' };
const r0 = M.reportInput({ data: obj });
ok(r0.bom_eur == null && r0.san_status && r0.san_status.regel === 'kaufdatum_12m' && !!r0.san_status.hinweis, 'leer: bisherige Regel (Kauf > 12 Monate) — kein bOM, Hinweis Zustand');
const r1 = M.reportInput({ data: Object.assign({}, obj, { san_ausgefuehrt: '2099-06-30' }) });
ok(r1.bom_eur === -137000 && r1.san_status.regel === 'ausgefuehrt_am' && !r1.san_status.gilt_ausgefuehrt, 'geplant 30.06.2099: bOM −137.000 € (Stau offen)');
const r2 = M.reportInput({ data: Object.assign({}, obj, { san_ausgefuehrt: '2025-09-30' }) });
ok(r2.bom_eur == null && r2.san_status.gilt_ausgefuehrt, 'ausgeführt 30.09.2025: kein bOM');
const r3 = M.reportInput({ data: Object.assign({}, obj, { kaufdat: new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10), san_ausgefuehrt: '2020-01-01' }) });
ok(r3.bom_eur == null, 'Kauf vor 100 Tagen, aber „ausgeführt 01.01.2020“: das Datum gewinnt, kein bOM');

console.log('');
console.log(rot ? 'ROT — ' + rot + ' Abweichung(en)' : 'SAUBER — Parkstraße am echten Kern nachgerechnet.');
process.exit(rot ? 1 : 0);
