#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * tools/anlage-v-pruefen.mjs — v3800
 *
 * Marcel 19.11.2026 nach dem Termin bei der Steuerkanzlei: alles, was die
 * Anlage V abfragt, muss eingebbar sein und an der richtigen Zeile ankommen;
 * die Kanzlei las die Zeilennummern als „alt".
 *
 *  A  jede Abschrift frontend/js/anlage-v-<JJJJ>.js: Kopf (Quelle, Kennung,
 *     Stand), jede Zuordnung zeigt auf eine abgeschriebene Zeile, alle Angaben
 *     des Kerns haben eine Zeile, Summenzeilen vorhanden, Kundentext sauber
 *  B  Kern js/anlage-v-kern.js am echten Code: ohne Angaben Wirkung 0, Teile der
 *     Kaltmiete aendern die Summe nicht, Zeile 15 = Kaltmiete − Teile, verteilte
 *     Erhaltung je Ursprungsjahr, § 7b getrennt, Kuerzung, STRENG je Jahr
 *  C  tax.js _computeYearTotal mit gespeichertem Satz (vorgabe): ohne anlage_v
 *     bitgleich, mit Angaben Einnahmen/Werbungskosten/Ergebnis wie der Kern
 *  D  keine Zeilennummer fest im Code der drei Ansichten, kein Ersatzjahr,
 *     Verdrahtung (index.html laedt den Kern, Speichern schickt anlage_v,
 *     Backend nimmt anlage_v an, Migration)
 *  G  Gegenprobe: je eine Stelle zurueckgebaut -> erwartet ROT
 *
 * Aufruf: node tools/anlage-v-pruefen.mjs     RC=0 sauber
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');   /* Arbeitskopie kann CRLF sein (autocrlf) */
let rot = 0, gruen = 0, still = false;
const ok = (b, t) => { if (b) gruen++; else { rot++; if (!still) console.log('  ROT  ' + t); } };
const nah = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;

function kernCtx(quellen) {
  const ctx = { console, Math, Number, String, Object, isFinite };
  ctx.window = ctx; vm.createContext(ctx);
  for (const q of quellen) vm.runInContext(q, ctx);
  return ctx;
}

/* ══ W · v3920 · Werbungskosten-PDF und Steuer-Mappe nach den Bloecken A bis F ═══════════════════════════════
   Marcel 20.11.2026: PDF und Steuerformular sollen nebeneinander dieselben Bloecke A bis F, dieselben
   Zeilennummern und dieselben Zeilentexte zeigen, die Rechnung und alle Betraege bleiben exakt gleich.
   Nachweis: die echten Dateien laufen im Pruefstand (jsPDF-Attrappe, die jeden Text mit Lage aufzeichnet), die
   Faelle unten rechnen mit dem echten _computeYearTotal. WK_VORHER ist der Stand VOR v3920 (v3910, Commit a349f4d0),
   mit diesem Pruefstand aus den damaligen Dateien erzeugt (--wk-basis=<Ordner mit den alten Dateien>):
   Summe der Werbungskosten, Einnahmen, Ergebnis der Aufstellung, jedes Paar (Zeile, Betrag) der Anlage-V-Seite
   (jsPDF und Steuer-Mappe) und die Gesamtuebersicht. Nachher muss jede dieser Zahlen gleich sein. */
const WK_FAELLE = [
  { jahr: 2025, satz: { schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, einnahmen_km: 12000, einnahmen_nk: 2000 } },
  { jahr: 2025, satz: { schuldzinsen: 3000, kontofuehrung: 60, bereitstellung: 120, notar_grundschuld: 400, vermittlung: 900, finanz_sonst: 150, nk_umlf: 2000, nk_n_umlf: 700, betr_sonst: 80,
      hausverwaltung: 360, steuerber: 250, porto: 30, verw_sonst: 45, fahrtkosten: 90, verpflegung: 28, hotel: 110, inserat: 60, gericht: 300, telefon: 40, sonst_kosten: 75, afa: 2500,
      sonst_bewegl_wg: 400, anschaffungsnah: 800, erhaltungsaufwand: 1500, einnahmen_km: 12000, einnahmen_nk: 2000,
      anlage_v: { av_garagen: 1200, av_renten: 600, av_ust_gezahlt: 100, av_nk_nachzahlung: -150, av_zuschuesse: 500, av_zuschuesse_eigen: 100, av_kuerzung_pct: 10, av_erh_m1: 220, av_7h7i: 900, av_fruehere_mieten: 300, _erhV: { 2025: 600, 2024: 400 } } } },
  { jahr: 2025, satz: { schuldzinsen: 3000, afa: 2000, erhaltungsaufwand: 1000, einnahmen_km: 12000, nk_n_umlf: 500, porto: 20,
      anlage_v: { av_anteil_pct: 80, av_zurechnung_a_pct: 50, av_fewo: 2, av_andere_raeume: 3000, av_wohnflaeche: 120, av_eigen_qm: 24 } } },
  { jahr: 2023, satz: { schuldzinsen: 4100, kontofuehrung: 90, afa: 3100, nk_umlf: 1800, hausverwaltung: 420, telefon: 50, sonst_kosten: 120, erhaltungsaufwand: 2500, einnahmen_km: 9600, einnahmen_nk: 1800, anlage_v: { av_garagen: 600, av_renten: 300 } } },
  { jahr: 2021, satz: { schuldzinsen: 5200, afa: 2800, nk_umlf: 1500, nk_n_umlf: 300, verw_sonst: 100, steuerber: 200, erhaltungsaufwand: 700, einnahmen_km: 8400, einnahmen_nk: 1500 } },
  { jahr: 2026, satz: { schuldzinsen: 2900, afa: 2500, nk_umlf: 2000, hausverwaltung: 300, erhaltungsaufwand: 900, einnahmen_km: 12500, einnahmen_nk: 2000, anlage_v: { av_renten: 200 } } }
];
/* die 26 Steuerzeilen (Spalten von tax_records), die bis v3910 in WK/WK_NAME (dp-dokumente.js) standen */
const WK_FELDER_ALT = ['schuldzinsen', 'kontofuehrung', 'bereitstellung', 'notar_grundschuld', 'vermittlung', 'finanz_sonst', 'nk_umlf', 'nk_n_umlf', 'betr_sonst', 'hausverwaltung', 'steuerber', 'porto', 'verw_sonst',
  'fahrtkosten', 'verpflegung', 'hotel', 'inserat', 'gericht', 'telefon', 'sonst_kosten', 'afa', 'sonst_bewegl_wg', 'anschaffungsnah', 'erhaltungsaufwand', 'einnahmen_km', 'einnahmen_nk'];
function wkDoc() {
  const T = []; let seite = 0, gr = 8;
  const d = { setFillColor() {}, rect() {}, roundedRect() {}, setTextColor() {}, setFont() {}, setFontSize(n) { gr = n; }, setDrawColor() {}, setLineWidth() {}, line() {},
    text(t, x, y, o) { (Array.isArray(t) ? t : [t]).forEach((z, i) => T.push({ s: seite, x: Math.round(x * 10) / 10, y: Math.round((y + i * 3.2) * 10) / 10, t: String(z), r: !!(o && o.align === 'right') })); },
    splitTextToSize(t, w) { const out = []; let z = ''; String(t).split(' ').forEach((w2) => { if ((z + ' ' + w2).length * gr * 0.19 > w && z) { out.push(z); z = w2; } else z = z ? z + ' ' + w2 : w2; }); if (z) out.push(z); return out; },
    getTextWidth(t) { return String(t).length * gr * 0.19; }, addPage() { seite++; }, autoTable(o) { T.push({ s: seite, tabelle: o }); }, internal: { pageSize: { getHeight: () => 297 } } };
  return { d, T };
}
function wkLauf(Qx) {
  const c = { console: { log() {}, warn() {}, info() {}, error() {} }, Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN, Number, String, Object, Array, Promise, setTimeout() {}, clearTimeout() {},
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), readyState: 'complete', documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }), addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
  c.window = c; c.parseDe = (x) => { const n = parseFloat(String(x == null ? '' : x).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }; c.State = {};
  vm.createContext(c);
  for (const f of ['anteilig.js', 'afa-engine.js', 'deal-kpis.js']) vm.runInContext(lies('frontend/js/' + f), c);
  for (const f of fs.readdirSync(path.join(ROOT, 'frontend/js')).filter((f) => /^anlage-v-\d{4}\.js$/.test(f)).sort()) vm.runInContext(Qx.jahr && Qx.jahr[f] != null ? Qx.jahr[f] : lies('frontend/js/' + f), c);
  vm.runInContext(Qx.kern, c); vm.runInContext(Qx.tax + ';window._cyt=_computeYearTotal;', c); vm.runInContext(Qx.wk, c);
  /* Steuer-Mappe (dp-dokumente.js): der Teil von der Gliederung bis anlageVBlatt, am echten Code */
  const dS = Qx.dok, m0 = dS.indexOf('  /* v3920 · Die Gliederung kommt aus dem Kern'), a0 = m0 >= 0 ? m0 : dS.indexOf("  var WK = [['1. Finanzierungskosten'"), a1 = dS.indexOf('  /* v3181 · opt.jahr');
  vm.runInContext('(function(){' + dS.slice(a0, a1) + ';window.__dok={anlageVBlatt:anlageVBlatt,blockZeilen:typeof blockZeilen==="function"?blockZeilen:null,wkBasis:typeof wkBasis==="function"?wkBasis:null,satzFelder:typeof satzFelder==="function"?satzFelder:null,avAufstellung:avAufstellung};})()', c);
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
  const zahlF = (v, d) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const B = { esc, zahl: zahlF, eur: (v, d) => zahlF(v, d) + ' €', eurS: (v, d) => { const n = Number(v); return (n > 0 ? '+' : n < 0 ? '−' : '') + zahlF(Math.abs(n), d) + ' €'; } };
  const cyt = c._cyt, eur = /^[−-]?[\d.]+(,\d+)? €$/, aus = [];
  const nachY = (L) => { const m = {}; L.forEach((e) => { if (e.tabelle) return; const k = e.s + '|' + e.y; (m[k] = m[k] || []).push(e); }); return Object.values(m); };
  for (const F of WK_FAELLE) {
    const tot = cyt(F.jahr, 0, F.satz);
    const q = { name: 'Testobjekt', addr: 'Musterweg 1, 12345 Musterstadt', qm: '80', art: 'ETW', totals: tot, regime: { anlageV: true, name: 'Privat', art: 'Privatvermögen' } };
    let { d, T } = wkDoc(); c._renderWerbungskostenPage(d, F.jahr, 0, 210, 297, 16, 178, q);
    const si = T.findIndex((e) => /^SUMME /.test(e.t)), fund = (re) => { const e = T.find((x) => re.test(x.t)); return e ? e.t : null; };
    const wkSeite = { summe: si >= 0 ? T[si + 1].t : null, einnahmen: fund(/^Einnahmen V\+V:/), ergebnis: fund(/^(Überschuss|Verlust): /),
      zwischen: nachY(T).filter((z) => z.some((e) => e.t === 'Zwischensumme')).map((z) => z.find((e) => eur.test(e.t)).t), texte: T };
    ({ d, T } = wkDoc()); const avOk = c._renderAnlageVPage(d, F.jahr, tot, q, 210, 297, 16, 178);
    const av = avOk ? nachY(T).map((z) => { const nr = z.find((e) => /^Zeile \d+$/.test(e.t)), b = z.find((e) => eur.test(e.t) && e.r); return (nr || b) ? [nr ? +nr.t.slice(6) : null, b ? b.t : null] : null; }).filter(Boolean).map((p) => JSON.stringify(p)).sort() : null;
    const h = c.__dok.anlageVBlatt(B, F.jahr, tot);
    const mappe = /<tr/.test(h) ? (h.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).map((tr) => { const nr = (tr.match(/>Zeile (\d+)</) || [])[1], b = (tr.match(/class="r num[^"]*">([^<]+)</) || [])[1]; return (nr || b) ? JSON.stringify([nr ? +nr : null, b || null]) : null; }).filter(Boolean).sort() : null;
    aus.push({ jahr: F.jahr, tot: { ein: tot.einnahmen, wk: tot.werbungskosten, erg: tot.ergebnis }, wk: { summe: wkSeite.summe, einnahmen: wkSeite.einnahmen, ergebnis: wkSeite.ergebnis }, av, mappe,
      _zwischen: wkSeite.zwischen, _texte: wkSeite.texte, _avTexte: avOk ? T : null, _tot: tot, _mappeHtml: h });
  }
  const tots = WK_FAELLE.map((F) => cyt(F.jahr, 0, F.satz)); c._computeYearTotal = (y, i) => tots[i];
  const { d, T } = wkDoc(); c._renderWerbungskostenSummaryPage(d, 2025, WK_FAELLE.length, 210, 297, 16, 178);
  const tab = T.find((e) => e.tabelle);
  const kopf = tab ? tab.tabelle.head[0] : [], spalte = (re) => kopf.findIndex((x) => re.test(x));
  const matrix = tab ? tab.tabelle.body.map((r) => [r[spalte(/^Summe WK$/)], r[spalte(/Einnahmen$/)], r[spalte(/Ergebnis$/)]]) : null;
  return { faelle: aus, matrix, _matrix: tab ? tab.tabelle : null, _ctx: c, _B: B };
}
if (process.argv.find((a) => a.startsWith('--wk-basis='))) {
  const dir = process.argv.find((a) => a.startsWith('--wk-basis=')).slice(11), l2 = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
  const r = wkLauf({ kern: l2('anlage-v-kern.js'), tax: l2('tax.js'), wk: l2('werbungskosten-pdf.js'), dok: l2('dp-dokumente.js') });
  console.log(JSON.stringify({ faelle: r.faelle.map((f) => ({ jahr: f.jahr, tot: f.tot, wk: f.wk, av: f.av, mappe: f.mappe })), matrix: r.matrix }));
  process.exit(0);
}

/* Stand vor v3920 (v3910, a349f4d0), erzeugt mit: node tools/anlage-v-pruefen.mjs --wk-basis=<alte Dateien> */
const WK_VORHER = {"faelle":[{"jahr":2025,"tot":{"ein":14000,"wk":9000,"erg":5000},"wk":{"summe":"9.000 €","einnahmen":"Einnahmen V+V: 14.000 €  (Kaltmiete 12.000 € + Umlagen 2.000 €)","ergebnis":"Überschuss: +5.000 €"},"av":["[15,\"12.000 €\"]","[20,\"2.000 €\"]","[32,\"14.000 €\"]","[35,\"2.500 €\"]","[48,\"3.000 €\"]","[55,\"1.500 €\"]","[75,\"2.000 €\"]","[83,\"9.000 €\"]","[85,\"5.000 €\"]","[86,\"5.000 €\"]"],"mappe":["[15,\"12.000,00 €\"]","[20,\"2.000,00 €\"]","[32,\"14.000,00 €\"]","[35,\"2.500,00 €\"]","[48,\"3.000,00 €\"]","[55,\"1.500,00 €\"]","[75,\"2.000,00 €\"]","[83,\"9.000,00 €\"]","[85,\"5.000,00 €\"]","[86,\"5.000,00 €\"]"]},{"jahr":2025,"tot":{"ein":14550,"wk":15818,"erg":313.79999999999995},"wk":{"summe":"15.818 €","einnahmen":"Einnahmen V+V: 14.550 €  (Kaltmiete 12.000 € + Umlagen 2.000 €)","ergebnis":"Überschuss: +314 €"},"av":["[15,\"10.800 €\"]","[20,\"2.000 €\"]","[21,\"-150 €\"]","[25,\"300 €\"]","[26,\"1.200 €\"]","[29,\"500 €\"]","[30,\"-100 €\"]","[31,\"400 €\"]","[32,\"14.550 €\"]","[35,\"2.500 €\"]","[35,\"800 €\"]","[41,\"900 €\"]","[45,\"400 €\"]","[48,\"120 €\"]","[48,\"3.000 €\"]","[51,\"150 €\"]","[51,\"400 €\"]","[51,\"900 €\"]","[54,\"600 €\"]","[55,\"500 €\"]","[60,\"600 €\"]","[72,\"220 €\"]","[72,\"400 €\"]","[75,\"2.000 €\"]","[78,\"360 €\"]","[78,\"45 €\"]","[78,\"60 €\"]","[78,\"700 €\"]","[78,\"80 €\"]","[79,\"100 €\"]","[82,\"110 €\"]","[82,\"250 €\"]","[82,\"28 €\"]","[82,\"30 €\"]","[82,\"300 €\"]","[82,\"40 €\"]","[82,\"60 €\"]","[82,\"75 €\"]","[82,\"90 €\"]","[83,\"15.818 €\"]","[85,\"-1.268 €\"]","[86,\"-1.268 €\"]","[87,null]"],"mappe":["[15,\"10.800,00 €\"]","[20,\"2.000,00 €\"]","[21,\"-150,00 €\"]","[25,\"300,00 €\"]","[26,\"1.200,00 €\"]","[29,\"500,00 €\"]","[30,\"-100,00 €\"]","[31,\"400,00 €\"]","[32,\"14.550,00 €\"]","[35,\"2.500,00 €\"]","[35,\"800,00 €\"]","[41,\"900,00 €\"]","[45,\"400,00 €\"]","[48,\"120,00 €\"]","[48,\"3.000,00 €\"]","[51,\"150,00 €\"]","[51,\"400,00 €\"]","[51,\"900,00 €\"]","[54,\"600,00 €\"]","[55,\"500,00 €\"]","[60,\"600,00 €\"]","[72,\"220,00 €\"]","[72,\"400,00 €\"]","[75,\"2.000,00 €\"]","[78,\"360,00 €\"]","[78,\"45,00 €\"]","[78,\"60,00 €\"]","[78,\"700,00 €\"]","[78,\"80,00 €\"]","[79,\"100,00 €\"]","[82,\"110,00 €\"]","[82,\"250,00 €\"]","[82,\"28,00 €\"]","[82,\"30,00 €\"]","[82,\"300,00 €\"]","[82,\"40,00 €\"]","[82,\"60,00 €\"]","[82,\"75,00 €\"]","[82,\"90,00 €\"]","[83,\"15.818,00 €\"]","[85,\"-1.268,00 €\"]","[86,\"-1.268,00 €\"]","[87,\"10 %\"]"]},{"jahr":2025,"tot":{"ein":12000,"wk":5216,"erg":6784},"wk":{"summe":"5.216 €","einnahmen":"Einnahmen V+V: 12.000 €","ergebnis":"Überschuss: +6.784 €"},"av":["[10,null]","[11,null]","[12,null]","[15,\"9.000 €\"]","[18,\"3.000 €\"]","[32,\"12.000 €\"]","[34,null]","[35,\"1.600 €\"]","[47,null]","[48,\"2.400 €\"]","[56,\"800 €\"]","[56,null]","[77,null]","[78,\"400 €\"]","[81,null]","[82,\"16 €\"]","[83,\"5.216 €\"]","[85,\"6.784 €\"]","[86,\"3.392 €\"]","[null,\"3.392 €\"]"],"mappe":["[10,null]","[11,\"120 m²\"]","[12,\"24 m²\"]","[15,\"9.000,00 €\"]","[18,\"3.000,00 €\"]","[32,\"12.000,00 €\"]","[34,null]","[35,\"1.600,00 €\"]","[47,null]","[48,\"2.400,00 €\"]","[56,\"800,00 €\"]","[56,null]","[77,null]","[78,\"400,00 €\"]","[81,null]","[82,\"16,00 €\"]","[83,\"5.216,00 €\"]","[85,\"6.784,00 €\"]","[86,\"3.392,00 €\"]","[null,\"3.392,00 €\"]"]},{"jahr":2023,"tot":{"ein":11400,"wk":12480,"erg":-1080},"wk":{"summe":"12.480 €","einnahmen":"Einnahmen V+V: 11.400 €  (Kaltmiete 9.600 € + Umlagen 1.800 €)","ergebnis":"Verlust: -1.080 €"},"av":["[15,\"9.000 €\"]","[20,\"1.800 €\"]","[26,\"600 €\"]","[32,\"11.400 €\"]","[35,\"3.100 €\"]","[47,\"4.100 €\"]","[53,\"300 €\"]","[54,\"2.500 €\"]","[74,\"1.800 €\"]","[77,\"420 €\"]","[77,\"90 €\"]","[81,\"120 €\"]","[81,\"50 €\"]","[82,\"12.480 €\"]","[84,\"-1.080 €\"]","[85,\"-1.080 €\"]"],"mappe":["[15,\"9.000,00 €\"]","[20,\"1.800,00 €\"]","[26,\"600,00 €\"]","[32,\"11.400,00 €\"]","[35,\"3.100,00 €\"]","[47,\"4.100,00 €\"]","[53,\"300,00 €\"]","[54,\"2.500,00 €\"]","[74,\"1.800,00 €\"]","[77,\"420,00 €\"]","[77,\"90,00 €\"]","[81,\"120,00 €\"]","[81,\"50,00 €\"]","[82,\"12.480,00 €\"]","[84,\"-1.080,00 €\"]","[85,\"-1.080,00 €\"]"]},{"jahr":2021,"tot":{"ein":9900,"wk":10800,"erg":-900},"wk":{"summe":"10.800 €","einnahmen":"Einnahmen V+V: 9.900 €  (Kaltmiete 8.400 € + Umlagen 1.500 €)","ergebnis":"Verlust: -900 €"},"av":["[13,\"1.500 €\"]","[21,\"9.900 €\"]","[23,\"-900 €\"]","[24,\"-900 €\"]","[33,\"2.800 €\"]","[37,\"5.200 €\"]","[40,\"700 €\"]","[47,\"1.500 €\"]","[48,\"100 €\"]","[50,\"200 €\"]","[50,\"300 €\"]","[51,\"10.800 €\"]","[9,\"8.400 €\"]"],"mappe":["[13,\"1.500,00 €\"]","[21,\"9.900,00 €\"]","[23,\"-900,00 €\"]","[24,\"-900,00 €\"]","[33,\"2.800,00 €\"]","[37,\"5.200,00 €\"]","[40,\"700,00 €\"]","[47,\"1.500,00 €\"]","[48,\"100,00 €\"]","[50,\"200,00 €\"]","[50,\"300,00 €\"]","[51,\"10.800,00 €\"]","[9,\"8.400,00 €\"]"]},{"jahr":2026,"tot":{"ein":14500,"wk":8800,"erg":5700},"wk":{"summe":"8.800 €","einnahmen":"Einnahmen V+V: 14.500 €  (Kaltmiete 12.500 € + Umlagen 2.000 €)","ergebnis":"Überschuss: +5.700 €"},"av":null,"mappe":null}],"matrix":[["9.000","14.000","+5.000"],["15.818","14.550","+314"],["5.216","12.000","+6.784"],["12.480","11.400","-1.080"],["10.800","9.900","-900"],["8.800","14.500","+5.700"]]};
function pruefen(Q) {
  const r0 = rot;
  /* ── A · Abschriften ── */
  const dateien = fs.readdirSync(path.join(ROOT, 'frontend/js')).filter((f) => /^anlage-v-\d{4}\.js$/.test(f)).sort();
  ok(dateien.length >= 1, 'A mindestens eine Abschrift anlage-v-<Jahr>.js');
  const K0 = kernCtx([Q.kern]).AnlageVKern;
  for (const f of dateien) {
    const jahr = +f.slice(9, 13);
    const src = Q.jahr[f] != null ? Q.jahr[f] : lies('frontend/js/' + f);
    const c = kernCtx([src]); const T = c['AnlageV' + jahr];
    ok(T && T.jahr === jahr && T.zeilen && T.felder, 'A ' + f + ': window.AnlageV' + jahr + ' mit jahr, zeilen, felder');
    if (!T) continue;
    ok(/Quelle|quelle/.test(src.slice(0, 2000)) && T.quelle && T.formular && /^\d{4}AnlV/.test(T.formular) && T.formular.indexOf(String(jahr)) === 0, 'A ' + f + ': Kopf nennt Quelle und Formularkennung des Jahres');
    ok(!!T.stand, 'A ' + f + ': Stand des Vordrucks');
    const fehlt = Object.keys(T.felder).filter((k) => T.felder[k].zeile != null && !T.zeilen[T.felder[k].zeile]);
    ok(!fehlt.length, 'A ' + f + ': jede Zuordnung zeigt auf eine abgeschriebene Zeile ' + fehlt.join(','));
    const ohne = K0.SCHLUESSEL.filter((k) => !T.felder[k]);
    ok(!ohne.length, 'A ' + f + ': jede Angabe des Kerns hat eine Zuordnung (auch null) ' + ohne.join(','));
    const S = T.summen || {};
    ok(['einnahmen', 'werbungskosten', 'ueberschuss'].every((k) => S[k] != null && T.zeilen[S[k]]), 'A ' + f + ': Summenzeilen einnahmen/werbungskosten/ueberschuss abgeschrieben');
    const ne = ((src.match(/nicht_erfasst:\s*\[([\s\S]*?)\n  \]/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/tax_records|afa_linear|afa_sonder_7b|v\d{3,4}|`/.test(ne), 'A ' + f + ': „im Formular selbst" ohne interne Begriffe');
  }

  /* ── B · Kern ── */
  const c = kernCtx([Q.jahr['anlage-v-2025.js'] != null ? Q.jahr['anlage-v-2025.js'] : lies('frontend/js/anlage-v-2025.js'), Q.kern]);
  const K = c.AnlageVKern;
  ok(K && K.aufstellung && K.wirkung && K.tabelle, 'B Schnittstelle AnlageVKern');
  if (!K) return;
  const w0 = K.wirkung({}, 5000);
  ok(w0.ein === 0 && w0.wk === 0 && w0.kuerzung === 0, 'B ohne Angaben: Wirkung 0 (bitgleich)');
  ok(K.tabelle(2026) === null || !!c.AnlageV2026, 'B STRENG: ohne Abschrift 2026 kein Ersatzjahr');
  ok(K.tabelle(2019) === null, 'B STRENG: 2019 ohne Abschrift -> null');   /* v3900: 2020 bis 2024 sind abgeschrieben */
  /* Beispiel: Kaltmiete 12.000 inkl. 1.200 Garagen und 2.400 Angehoerige, Umlagen 2.000 */
  const v = { einnahmen_km: 12000, einnahmen_nk: 2000, av_garagen: 1200, av_angehoerige: 2400, av_nk_nachzahlung: -150,
    schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, av_renten: 600, av_ust_gezahlt: 100,
    av_zuschuesse: 500, av_zuschuesse_eigen: 100, av_kuerzung_pct: 10, av_vorsteuer: 50, av_wohnflaeche: 120 };
  const wkGrund = 3000 + 2500 + 2000 + 1500;
  const w = K.wirkung(v, wkGrund);
  ok(nah(w.ein, -150 + 500 - 100) && nah(w.wk, 700), 'B Wirkung: Einnahmen −150 + 500 − 100, Werbungskosten 600 + 100');
  ok(nah(w.kuerzung, (wkGrund + 700) * 0.10), 'B Kuerzung 10 % auf die vollen Werbungskosten');
  const ein = 14000 + w.ein, wk = wkGrund + w.wk;
  const R = K.aufstellung(2025, { values: v, einnahmen: ein, werbungskosten: wk, ergebnis: ein - wk + w.kuerzung,
    afaLinear: 2000, afaSonder7b: 500, auto: { afa: 2500, erhaltungsaufwand: 1500 }, erhV: { 2025: 600, 2024: 400 }, erhG: 1800 });
  const z = (liste, nr) => liste.filter((e) => e.zeile === nr);
  ok(R && z(R.einnahmen, 15).length === 1 && nah(z(R.einnahmen, 15)[0].betrag, 12000 - 1200 - 2400), 'B Zeile 15 = Kaltmiete − Garagen − Angehoerige (8.400)');
  ok(R && z(R.einnahmen, 26).length === 1 && nah(z(R.einnahmen, 26)[0].betrag, 1200) && z(R.einnahmen, 19).length === 1, 'B Garagen in Zeile 26, Angehoerige in Zeile 19');
  ok(R && z(R.einnahmen, 21).length === 1 && nah(z(R.einnahmen, 21)[0].betrag, -150), 'B Nachzahlung/Erstattung NK in Zeile 21 (negativ)');
  ok(R && z(R.einnahmen, 31).length === 1 && nah(z(R.einnahmen, 31)[0].betrag, 400) && z(R.einnahmen, 30).length === 1, 'B Zeile 29 − Zeile 30 = Zeile 31 (Kz 08)');
  const sumEin = R ? R.einnahmen.filter((e) => !e.teil).reduce((a, e) => a + e.betrag, 0) : 0;
  ok(R && nah(sumEin, ein) && R.summeEinnahmen.zeile === 32 && nah(R.summeEinnahmen.betrag, ein), 'B Einnahmenzeilen ergeben Zeile 32 (' + Math.round(sumEin) + ' / ' + ein + ')');
  const sumWk = R ? R.wk.reduce((a, e) => a + e.betrag, 0) : 0;
  ok(R && nah(sumWk, wk) && R.summeWk.zeile === 83, 'B Werbungskostenzeilen ergeben Zeile 83 (' + Math.round(sumWk) + ' / ' + wk + ')');
  ok(R && z(R.wk, 35).length === 1 && nah(z(R.wk, 35)[0].betrag, 2000) && z(R.wk, 38).length === 1 && nah(z(R.wk, 38)[0].betrag, 500), 'B § 7b getrennt: Zeile 35 linear, Zeile 38 Sonder-AfA');
  ok(R && nah((z(R.wk, 55)[0] || {}).betrag, 500) && nah((z(R.wk, 60)[0] || {}).betrag, 600) && nah((z(R.wk, 72)[0] || {}).betrag, 400), 'B Erhaltung: sofort Zeile 55 (500), verteilt 2025 Zeile 60 (600), aus 2024 Zeile 72 (400)');
  ok(R && z(R.info, 57).length === 1 && z(R.info, 84).length === 1 && z(R.info, 11).length === 1 && z(R.info, 87).length === 1, 'B Angaben ohne Wirkung: Zeilen 11, 57, 84, 87');
  ok(R && z(R.wk, 54).length === 1 && z(R.wk, 79).length === 1, 'B Renten Zeile 54, gezahlte USt Zeile 79');
  ok(R && R.kuerzung && nah(R.kuerzung.betrag, w.kuerzung) && nah(R.ueberschuss.betrag, ein - wk) && R.ueberschuss.zeile === 85, 'B Zeile 85 ungekuerzt, Kuerzung als Hinweis');
  const R2 = K.aufstellung(2025, { values: Object.assign({}, v, { erhaltungsaufwand: 2000 }), einnahmen: ein, werbungskosten: wk + 500, auto: { erhaltungsaufwand: 1500 }, erhV: { 2025: 600 } });
  ok(R2 && nah((z(R2.wk, 55)[0] || {}).betrag, 2000) && R2.hinweise.some((h) => /von Hand/.test(h)), 'B Erhaltung von Hand geaendert: ganz in Zeile 55, mit Hinweis');
  const R3 = K.aufstellung(2025, { values: { einnahmen_km: 1000, av_garagen: 1500 }, einnahmen: 1000, werbungskosten: 0 });
  ok(R3 && R3.hinweise.length >= 1, 'B Teile groesser als die Kaltmiete: Hinweis');
  ok(K.aufstellung(2019, { values: v }) === null, 'B Aufstellung fuer ein Jahr ohne Abschrift: null');

  /* ── B2 · v3800b ── */
  const s7 = (j) => K.sieben(100000, 2020, j).satz;
  ok(s7(2019) === 0 && s7(2020) === 9 && s7(2027) === 9 && s7(2028) === 7 && s7(2031) === 7 && s7(2032) === 0, 'B2 §§ 7h/7i: 2020-2027 je 9 %, 2028-2031 je 7 %, davor/danach 0 (Abs. 1 Satz 1)');
  /* ELSTER-Hilfe Anlage V 2025, Beispiel Familie Muster: 420 / 1.050 = 40 %, Kuerzung 60 %, WK 4.920 -> 1.968 */
  const vb40 = K.verbilligt({ quote: 420 / 1050 * 100 });
  const wB = K.wirkung({ av_kuerzung_pct: vb40.pct }, 4920);
  ok(vb40.pct === 60 && nah(4920 - wB.kuerzung, 1968), 'B2 Beispiel der ELSTER-Hilfe: 40 % entgeltlich -> Kuerzung 60 %, Werbungskosten 4.920 -> 1.968 €');
  const pos = Array.from({ length: 10 }, () => ({ ein: 10000, wk: 9500 })), neg = Array.from({ length: 10 }, () => ({ ein: 10000, wk: 12500 }));
  ok(K.verbilligt({ quote: 60, jahre: pos }).pct === 0 && K.verbilligt({ quote: 60, jahre: neg }).pct === 40, 'B2 60 %: Prognose positiv -> keine Kuerzung, negativ -> 40 % (§ 21 Abs. 2 Satz 2)');
  /* Sicherheitsabschlaege Rz. 34: 30 x 10.000 x 1,1 = 330.000, 30 x 12.000 x 0,9 = 324.000 -> positiv, ohne Zuschlaege negativ */
  ok(K.verbilligt({ quote: 60, jahre: Array.from({ length: 30 }, () => ({ ein: 10000, wk: 12000 })) }).pct === 0, 'B2 Sicherheitszuschlag/-abschlag 10 % (BMF 08.10.2004 Rz. 34)');
  ok(K.verbilligt({ quote: 66 }).pct === 0 && K.verbilligt({ quote: 80 }).pct === 0, 'B2 ab 66 %: voll entgeltlich');
  const wA = K.wirkung({ av_anteil_pct: 80 }, 10000);
  ok(nah(wA.wk, -2000) && nah(K.wirkung({}, 10000).wk, 0) && nah(K.wirkung({ av_anteil_pct: 0 }, 10000).wk, 0), 'B2 abzugsfaehiger Anteil 80 %: Werbungskosten −20 %, fehlend/0 = 100 %');
  const vA = { einnahmen_km: 12000, einnahmen_nk: 0, schuldzinsen: 3000, afa: 2000, erhaltungsaufwand: 1000, av_anteil_pct: 80, av_zurechnung_a_pct: 50, av_fewo: 2, av_angeh_flag: 2, av_andere_raeume: 3000 };
  const RA = K.aufstellung(2025, { values: vA, einnahmen: 12000, werbungskosten: 6000 * 0.8, afaArt: { m: 'linear', s: 2 }, kaufjahr: 2024,
    einheiten: [{ b: 'Wohnung 1', q: 60, e: 500, g: 0 }, { b: 'Wohnung 2', q: 40, e: 250, g: 0 }, { b: 'Laden', q: 50, e: 250, g: 1 }] });
  const zA = (l, nr, teil) => l.filter((e) => e.zeile === nr && !!e.teil === !!teil);
  ok(RA && nah(zA(RA.wk, 35)[0].betrag, 1600) && zA(RA.wk, 34, true).length === 1 && nah(zA(RA.wk, 48)[0].betrag, 2400) && zA(RA.wk, 47, true).length === 1, 'B2 verhaeltnismaessig: Zeile 35 = 80 % der AfA, Zeile 34 Gesamtbetrag/Anteil, ebenso 47/48');
  ok(RA && zA(RA.wk, 56).length === 1 && nah(zA(RA.wk, 56)[0].betrag, 800) && !zA(RA.wk, 55).length, 'B2 Erhaltung verhaeltnismaessig in Zeile 56 (Kz 37), nicht 55');
  ok(RA && nah(RA.wk.filter((e) => !e.teil).reduce((a, e) => a + e.betrag, 0), 4800), 'B2 Summe der Zeilen = Zeile 83 (4.800)');
  ok(RA && zA(RA.einnahmen, 13, true).length === 1 && zA(RA.einnahmen, 14, true).length === 1 && nah(zA(RA.einnahmen, 13, true)[0].betrag + zA(RA.einnahmen, 14, true)[0].betrag, 9000) && nah(zA(RA.einnahmen, 16, true)[0].betrag, 3000), 'B2 Einzelangaben: Zeilen 13/14 ergeben Zeile 15 (9.000), Zeile 16 = Zeile 18 (3.000)');
  ok(RA && RA.zurechnung && RA.zurechnung.zeile === 86 && nah(RA.zurechnung.a, RA.zurechnung.b), 'B2 Zeile 86: haelftige Zurechnung Person A / B');
  ok(RA && RA.info.some((e) => e.zeile === 10 && /2 = Nein/.test(e.text) && e.kz === '61') && RA.info.some((e) => e.zeile === 33 && /wie Vorjahr/.test(e.text)), 'B2 Ankreuzfeld Zeile 10 (Kz 61), AfA-Angaben Zeile 33');

  /* ── C · tax.js mit gespeichertem Satz ── */
  const tc = { console: { log() {}, warn() {}, info() {}, error() {} }, Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN, Number, String, Object, Array, Promise, setTimeout() {}, clearTimeout() {},
    document: { getElementById: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }) }, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
  tc.window = tc; tc.parseDe = (s) => { const n = parseFloat(String(s == null ? '' : s).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }; tc.State = {};
  vm.createContext(tc);
  let cyt = null;
  try {
    for (const f of ['anteilig.js', 'afa-engine.js', 'deal-kpis.js', 'anlage-v-2025.js']) vm.runInContext(lies('frontend/js/' + f), tc);
    vm.runInContext(Q.kern, tc);
    vm.runInContext(Q.tax + ';window._cyt=_computeYearTotal;', tc);
    cyt = tc._cyt;
  } catch (e) { ok(false, 'C tax.js laedt im Pruefstand: ' + e.message); }
  if (cyt) {
    const satz = { schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, einnahmen_km: 12000, einnahmen_nk: 2000 };
    const a = cyt(2025, 0, satz);
    ok(nah(a.einnahmen, 14000) && nah(a.werbungskosten, 9000) && nah(a.ergebnis, 5000), 'C ohne anlage_v bitgleich: 14.000 / 9.000 / 5.000');
    const b = cyt(2025, 0, Object.assign({}, satz, { anlage_v: { av_garagen: 1200, av_renten: 600, av_ust_gezahlt: 100, av_nk_nachzahlung: -150, av_zuschuesse: 500, av_zuschuesse_eigen: 100, av_kuerzung_pct: 10, _erhV: { 2025: 600 } } }));
    ok(nah(b.einnahmen, 14250) && nah(b.werbungskosten, 9700) && nah(b.ergebnis, 14250 - 9700 + 970), 'C mit anlage_v: Einnahmen 14.250, Werbungskosten 9.700, Ergebnis mit Kuerzung 970');
    ok(b.erhV && b.erhV[2025] === 600 && b.values.av_garagen === 1200, 'C Auskunft aus anlage_v kommt an (erhV, av_garagen)');
    const c3 = cyt(2025, 0, Object.assign({}, satz, { anlage_v: { av_anteil_pct: 80, av_zurechnung_a_pct: 50, av_fewo: 2 } }));
    ok(nah(c3.einnahmen, 14000) && nah(c3.werbungskosten, 7200) && nah(c3.ergebnis, 6800), 'C abzugsfaehiger Anteil 80 %: Werbungskosten 7.200, Ergebnis 6.800; Flags/Zurechnung ohne Wirkung');
    if (process.argv.find((a) => a.startsWith('--saetze='))) {
      /* Gespeicherte Saetze ohne anlage_v (JSON-Liste, lesend aus Staging geholt): neue Rechnung = alte Formel */
      const S = JSON.parse(fs.readFileSync(process.argv.find((a) => a.startsWith('--saetze=')).slice(9), 'utf8').replace(/^[^\[]*/, ''));
      const WKF = ['schuldzinsen','kontofuehrung','bereitstellung','notar_grundschuld','vermittlung','finanz_sonst','nk_umlf','nk_n_umlf','betr_sonst','hausverwaltung','steuerber','porto','verw_sonst','fahrtkosten','verpflegung','hotel','inserat','gericht','telefon','sonst_kosten','afa','sonst_bewegl_wg','anschaffungsnah','erhaltungsaufwand'];
      let ab = 0;
      for (const s of S) {
        const e0 = (+s.einnahmen_km) + (+s.einnahmen_nk), w0 = WKF.reduce((a, f) => a + (+s[f] || 0), 0), t = cyt(s.year, 0, s);
        if (!nah(t.einnahmen, e0) || !nah(t.werbungskosten, w0) || !nah(t.ergebnis, e0 - w0)) ab++;
      }
      ok(S.length > 0 && ab === 0, 'C ' + S.length + ' gespeicherte Saetze ohne anlage_v: neue Rechnung = alte Formel (' + ab + ' Abweichungen)');
      if (!still) console.log('  C  ' + S.length + ' gespeicherte Saetze ohne anlage_v nachgerechnet, ' + ab + ' Abweichungen');
    }
  }

  /* ── D · Verdrahtung, keine festen Nummern ── */
  const code = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const dokA = (Q.dok.match(/function anlageVBlatt\([\s\S]*?\n  \}\n/) || [''])[0];
  const wkA = (Q.wk.match(/function _renderAnlageVPage\([\s\S]*?\n\}\n/) || [''])[0];
  const festeNr = /(zl|zeile|summe)\(\s*'?\d{2}\b|'Zeile \d+'|Zeile \d{2}\b/;
  ok(dokA && !festeNr.test(code(dokA)), 'D Steuer-Mappe (anlageVBlatt): keine Zeilennummer im Code');
  ok(wkA && !festeNr.test(code(wkA)), 'D Werbungskosten-PDF (_renderAnlageVPage): keine Zeilennummer im Code');
  ok(/_avK\.zeileFuer\(y\.year, f\)/.test(Q.tax)   /* v3900: Tooltip in _hilfe(f) */ && !/_avAlt/.test(code(Q.tax)), 'D Tooltip: nur die Abschrift des Jahres, kein Ersatzjahr');
  ok(!/ersatz: k\[i\]|ersatz: kandidaten\[i\]/.test(code(Q.dok) + code(Q.wk)), 'D kein Ersatzjahr in Steuer-Mappe und Werbungskosten-PDF');
  ok(/js\/anlage-v-2025\.js\?v=[^"]+"><\/script>\s*\n<script src="js\/anlage-v-kern\.js\?v=/.test(Q.idx), 'D index.html laedt den Kern nach der Abschrift');
  ok(/anlage_v: \(function \(\) \{[\s\S]{0,200}AnlageVKern\.auszug\(v\)/.test(Q.sto), 'D Speichern schickt anlage_v (storage.js)');
  ok(/anlage_v: z\.record/.test(lies('backend/src/routes/taxRecords.js')) && /anlageV\(data\.anlage_v\)/.test(lies('backend/src/services/taxService.js')), 'D Backend nimmt anlage_v an und speichert es');
  ok(fs.existsSync(path.join(ROOT, 'backend/migrations/120_tax_records_anlage_v.sql')), 'D Migration 120 tax_records.anlage_v');
  ok(/av_garagen: \(function/.test(Q.tax) && /DpZeAufteilung, t = Z && Z\.teile/.test(Q.tax), 'D tax.js: Zeile Garagen aus der Aufteilung der Zusatzeinnahmen');
  ok(/erhV: j\.erhV/.test(lies('frontend/js/sanierung-plan.js')), 'D Sanierungsplan liefert verteilte Erhaltung je Ursprungsjahr');

  /* ── E · v3900 Steuerformular nach den Bloecken der Anlage V, Stufen je Zeile (echter Renderer) ── */
  const BASIS = ['schuldzinsen', 'kontofuehrung', 'bereitstellung', 'notar_grundschuld', 'vermittlung', 'finanz_sonst', 'nk_umlf', 'nk_n_umlf', 'betr_sonst',
    'hausverwaltung', 'steuerber', 'porto', 'verw_sonst', 'fahrtkosten', 'verpflegung', 'hotel', 'inserat', 'gericht', 'telefon', 'sonst_kosten', 'afa', 'sonst_bewegl_wg',
    'anschaffungsnah', 'erhaltungsaufwand', 'einnahmen_km', 'einnahmen_nk'];
  const jahrDateien = fs.readdirSync(path.join(ROOT, 'frontend/js')).filter((f) => /^anlage-v-\d{4}\.js$/.test(f)).sort();
  const jahrQuelle = (f) => (Q.jahr[f] != null ? Q.jahr[f] : lies('frontend/js/' + f));
  function rendern(o) {
    const rc = { console: { log() {}, warn() {}, info() {}, error() {} }, Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN, Number, String, Object, Array, Promise, setTimeout() {}, clearTimeout() {},
      document: { getElementById: (id) => (id === 'afa_satz' ? { value: '2' } : null), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }) },
      addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } };
    rc.window = rc; rc.parseDe = tc.parseDe; rc.State = {};
    vm.createContext(rc);
    for (const f of ['anteilig.js', 'afa-engine.js', 'deal-kpis.js']) vm.runInContext(lies('frontend/js/' + f), rc);
    for (const f of jahrDateien) vm.runInContext(jahrQuelle(f), rc);
    vm.runInContext(Q.kern, rc);
    vm.runInContext(Q.tax, rc);
    rc._taxYearlyOverrides = { ['y' + o.jahr]: o.ov || {} }; rc._taxYearlyBemerkungen = {};
    rc.DpDetailgrad = { stufe: () => o.stufe };
    if (o.corp) rc.DealPilotMandanten = { kostenBegriff: () => ({ corp: true, wort: 'Betriebsausgaben', einnahmen: 'Betriebseinnahmen', ergebnis: 'Ergebnis' }) };
    const auto = Object.assign({}, o.auto || {}), values = {};
    BASIS.concat(rc.AnlageVKern.SCHLUESSEL).forEach((f) => { values[f] = (o.ov && o.ov[f] != null) ? o.ov[f] : (auto[f] || 0); });
    rc._computeYearTotal = () => ({ auto, values, werbungskosten: 0, einnahmen: 0, ergebnis: 0, afaSonder7b: o.son7b || null, erhV: o.erhV || null, erhG: o.erhG || 0 });
    rc._ytfSteuerAnzeige = () => ({ text: '0 €', color: '', title: '' });
    rc._mieteQuote66 = () => (o.quote ? { stand: 'ok', quote: o.quote } : null);
    const h = rc._renderDetailForm([{ idx: 0, year: o.jahr }]);
    const zeilen = []; const re = /<tr data-dg-stufe="(\d)"(?: data-ytf-feld="([a-z0-9_]+)")?([^>]*)>([\s\S]*?)<\/tr>/g; let m;
    while ((m = re.exec(h))) zeilen.push({ st: +m[1], f: m[2] || null, cls: m[3], inhalt: m[4] });
    const bl = {}; const rb = /data-ytf-block="([A-F])" data-dg-stufe="(\d)"/g; while ((m = rb.exec(h))) bl[m[1]] = +m[2];
    return { h, zeilen, bl };
  }
  let E1 = null;
  try { E1 = rendern({ jahr: 2025, stufe: 1 }); } catch (e) { ok(false, 'E Renderer laeuft im Pruefstand: ' + e.message); }
  if (E1) {
    const sicht = E1.zeilen.filter((z) => z.st <= 1 && z.f).map((z) => z.f).sort().join(',');
    ok(sicht === ['afa', 'einnahmen_km', 'einnahmen_nk', 'erhaltungsaufwand', 'nk_umlf', 'schuldzinsen'].sort().join(','), 'E Einsteiger ohne Betraege: nur Kaltmiete, Umlagen, Gebaeude-AfA, Schuldzinsen, Erhaltung, umgelegte Kosten (' + sicht + ')');
    ok(E1.zeilen.some((z) => z.st === 1 && !z.f && /Nicht umgelegte Kosten und Verwaltung/.test(z.inhalt) && /einzeln ab Detailgrad Fortgeschritten/.test(z.inhalt)), 'E Einsteiger: Zeile 78 als eine Summe mit „einzeln ab Detailgrad Fortgeschritten"');
    ok(E1.bl.A === 1 && E1.bl.F === 3 && E1.bl.C === 1, 'E Bloecke A bis F, F (Angaben zum Objekt) erst ab Experte');
    ok(/data-dg-stufe="1"/.test(E1.h.slice(0, 80)), 'E Detail-Ansicht selbst ab Einsteiger');
    const alle = rendern({ jahr: 2025, stufe: 3 });
    const zaehl = {}; alle.zeilen.forEach((z) => { if (z.f) zaehl[z.f] = (zaehl[z.f] || 0) + 1; });
    const SOLL_F = BASIS.concat(K.SCHLUESSEL);
    const fehltF = SOLL_F.filter((f) => zaehl[f] !== 1);
    ok(!fehltF.length && Object.keys(zaehl).length === SOLL_F.length, 'E jedes Feld genau einmal (' + SOLL_F.length + ': ' + BASIS.length + ' Steuerzeilen + ' + K.SCHLUESSEL.length + ' Angaben der Anlage V) ' + fehltF.join(','));
    const ein = (f) => (alle.zeilen.find((z) => z.f === f) || {}).inhalt || '';
    ok(/data-field="schuldzinsen"/.test(ein('schuldzinsen')) && /data-field="av_renten"/.test(ein('av_renten')) && /data-field="kontofuehrung"/.test(ein('kontofuehrung')), 'E Eingaben schreiben weiter auf ihr data-field');
    ok(/Z\. 48</.test(ein('schuldzinsen')) && /Z\. 48</.test(ein('bereitstellung')) && /Z\. 51</.test(ein('notar_grundschuld')) && /Z\. 78</.test(ein('kontofuehrung')) && /Z\. 82</.test(ein('porto')) && /Z\. 41</.test(ein('av_7h7i')), 'E 2025: Zeilennummer je Zeile aus der Abschrift (48, 48, 51, 78, 82, 41)');
    ok(!/ytf-dg-note/.test(alle.h), 'E Experte: kein Hinweis „sonst ab …"');
    const e26 = rendern({ jahr: 2026, stufe: 3 });
    ok(!/class="ytf-zeile"/.test(e26.h) && !/ytf-block-zeilen/.test(e26.h), 'E 2026 ohne Abschrift: keine Zeilennummer');
    const ePorto = rendern({ jahr: 2025, stufe: 1, ov: { porto: 50 } });
    const z82 = ePorto.zeilen.find((z) => !z.f && /Sonstige Kosten gesamt/.test(z.inhalt));
    ok(z82 && z82.st === 1 && /\+1 Angabe mit Betrag, einzeln ab Detailgrad Experte/.test(z82.inhalt) && ePorto.zeilen.find((z) => z.f === 'porto').st === 3, 'E Einsteiger, Porto 50 €: die Summenzeile Sonstige Kosten erscheint mit „+1 Angabe mit Betrag", Porto bleibt einzeln Experte');
    const eRente = rendern({ jahr: 2025, stufe: 1, ov: { av_renten: 600 } });
    const zr = eRente.zeilen.find((z) => z.f === 'av_renten');
    ok(zr && zr.st === 1 && /sonst ab Detailgrad Experte/.test(zr.inhalt), 'E Einsteiger, Rente 600 €: Zeile erscheint (keine stille Verwerfung) mit Hinweis');
    const eAuto = rendern({ jahr: 2025, stufe: 1, auto: { sonst_bewegl_wg: 400, av_fewo: 2, av_wohnflaeche: 80, av_zurechnung_a_pct: 100 } });
    ok(eAuto.zeilen.find((z) => z.f === 'sonst_bewegl_wg').st === 1 && eAuto.zeilen.find((z) => z.f === 'av_fewo').st === 3 && eAuto.zeilen.find((z) => z.f === 'av_wohnflaeche').st === 3, 'E Vorschlag mit Wirkung (Kueche 400 €) erscheint, Vorschlaege ohne Wirkung (Ankreuzfeld, Flaeche) nicht');
    const eQ = rendern({ jahr: 2025, stufe: 2, quote: 55 }), eQ0 = rendern({ jahr: 2025, stufe: 2 });
    ok(eQ.zeilen.find((z) => z.f === 'av_kuerzung_pct').st === 2 && eQ0.zeilen.find((z) => z.f === 'av_kuerzung_pct').st === 3, 'E Kuerzung verbilligte Vermietung ab Fortgeschritten nur bei Quote unter 66 %');
    const eC = rendern({ jahr: 2025, stufe: 3, corp: true });
    ok(!eC.zeilen.some((z) => z.f && /^av_/.test(z.f)) && !/class="ytf-zeile"/.test(eC.h), 'E Gesellschaft: keine Angaben der Anlage V, keine Zeilennummern (wie v3800)');
    const e7b = rendern({ jahr: 2025, stufe: 3, son7b: 900, erhV: { 2025: 300 }, erhG: 1500 });
    ok(e7b.zeilen.some((z) => !z.f && /Sonderabschreibung § 7b/.test(z.inhalt) && /Z\. 38</.test(z.inhalt)) && e7b.zeilen.some((z) => !z.f && /§ 82b EStDV/.test(z.inhalt) && z.st === 2), 'E Anzeige § 7b (Zeile 38) ab Experte, verteilte Erhaltung ab Fortgeschritten');
    const kunden = alle.zeilen.map((z) => z.inhalt.replace(/<[^>]*>/g, ' ').replace(/title="[^"]*"/g, '')).join(' ') + ePorto.h.replace(/<[^>]*>/g, ' ');
    ok(!/ – |;/.test(kunden.replace(/&quot;|&amp;/g, '')), 'E Kundentext der Zeilen: kein Gedankenstrich, kein Semikolon');
  }

  /* ── R · v3900a: das Steuerformular RENDERT nur - es schreibt nichts und stoesst keine Rechnung an ──
     Befund Staging 19.11.2026 (Koordinator, A/B): mit v3900 stand der Steuerverlauf beim Laden 8 s auf einem
     anderen Wert. Geprueft wird am echten tax.js: Quick- und Detail-Ansicht (Stufe 1-3, leerer, halber und voller
     Stand) und der Hoerer auf dp:detailgrad aendern keine Eigenwerte, keinen State, keinen Cache, keinen globalen
     Namen, rufen weder calc noch den Steuerverlauf, und die Rechnung (_computeYearTotal) ist danach dieselbe. */
  (function () {
    const hoerer = {};
    const rc = { console: { log() {}, warn() {}, info() {}, error() {} }, Date, Math, JSON, parseFloat, parseInt, isFinite, isNaN, Number, String, Object, Array, Promise, setTimeout() {}, clearTimeout() {},
      document: { getElementById: (id) => (id === 'afa_satz' ? { value: '2' } : null), addEventListener() {}, querySelector: (s) => (rc.__detailDa && /ytf-toolbar/.test(s) ? {} : null), querySelectorAll: () => [], createElement: () => ({ style: {} }) },
      addEventListener(t, f) { (hoerer[t] = hoerer[t] || []).push(f); }, localStorage: { getItem: () => null, setItem() {} } };
    rc.window = rc; rc.parseDe = tc.parseDe; rc.State = { cfRows: [{ cal: 2025 }, { cal: 2026 }] };
    vm.createContext(rc);
    try {
      for (const f of ['anteilig.js', 'afa-engine.js', 'deal-kpis.js']) vm.runInContext(lies('frontend/js/' + f), rc);
      for (const f of jahrDateien) vm.runInContext(jahrQuelle(f), rc);
      vm.runInContext(Q.kern, rc);
      vm.runInContext(Q.tax, rc);
    } catch (e) { ok(false, 'R tax.js laedt im Pruefstand: ' + e.message); return; }
    const satz = { schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, einnahmen_km: 12000, einnahmen_nk: 2000, anlage_v: { av_renten: 600, av_kuerzung_pct: 10 } };
    const vorher = JSON.stringify(rc._computeYearTotal(2025, 0, satz));
    const echteCyt = rc._computeYearTotal;
    rc._taxYearlyOverrides = { y2025: { porto: 30 } }; rc._taxYearlyBemerkungen = {};
    const zaehler = { calc: 0, timeline: 0, setzen: 0, update: 0 };
    rc.calc = () => { zaehler.calc++; }; rc.calcNow = rc.calc;
    rc.renderTaxTimeline = () => { zaehler.timeline++; };
    const echtSetzen = rc._setYearOverride; rc._setYearOverride = function () { zaehler.setzen++; return echtSetzen.apply(this, arguments); };
    rc.updateTaxOverride = () => { zaehler.update++; };
    rc._ytfSteuerAnzeige = () => ({ text: '0 €', color: '', title: '' });
    rc._mieteQuote66 = () => ({ stand: 'ok', quote: 55 });
    const staende = [
      { name: 'leer', auto: {}, values: {} },
      { name: 'halb', auto: { schuldzinsen: 5000, afa: 3000 }, values: { schuldzinsen: 5000 } },
      { name: 'voll', auto: { schuldzinsen: 5000, afa: 3000, einnahmen_km: 12000, nk_umlf: 2000, sonst_bewegl_wg: 400, av_fewo: 2, av_7h7i: 900 }, values: { schuldzinsen: 5000, afa: 3000, einnahmen_km: 12000, nk_umlf: 2000, sonst_bewegl_wg: 400, av_fewo: 2, av_7h7i: 900, porto: 30 } }
    ];
    const blick = () => JSON.stringify({ ov: rc._taxYearlyOverrides, bem: rc._taxYearlyBemerkungen, st: rc.State, vb: rc._dpVbCache, mode: rc._taxFormMode, idx: rc._detailYearIdx });
    rc.DpDetailgrad = { stufe: () => 3 };   /* Pruefstand selbst */
    const namen0 = Object.keys(rc).sort().join(',');
    const b0 = blick();
    let html1 = null, html2 = null, fehler = null;
    try {
      for (const s of staende) {
        const t = { auto: s.auto, values: s.values, werbungskosten: 1, einnahmen: 2, ergebnis: 1, afaSonder7b: 100, erhV: { 2025: 50 }, erhG: 200 };
        const tJson = JSON.stringify(t);
        rc._computeYearTotal = () => t;
        for (const st of [1, 2, 3]) {
          rc.DpDetailgrad = { stufe: () => st };
          const h = rc._renderDetailForm([{ idx: 0, year: 2025 }, { idx: 1, year: 2026 }]);
          rc._renderQuickForm([{ idx: 0, year: 2025 }, { idx: 1, year: 2026 }]);
          if (s.name === 'voll' && st === 3) { if (html1 == null) html1 = h; else html2 = h; }
        }
        if (JSON.stringify(t) !== tJson) fehler = 'Rendern veraendert die Jahreswerte (' + s.name + ')';
      }
      /* zweiter Durchgang mit vollem Stand: gleiches HTML */
      rc.DpDetailgrad = { stufe: () => 3 };
      const t = { auto: staende[2].auto, values: staende[2].values, werbungskosten: 1, einnahmen: 2, ergebnis: 1, afaSonder7b: 100, erhV: { 2025: 50 }, erhG: 200 };
      rc._computeYearTotal = () => t;
      html2 = rc._renderDetailForm([{ idx: 0, year: 2025 }, { idx: 1, year: 2026 }]);
    } catch (e) { fehler = e.message; }
    ok(!fehler, 'R Rendern ohne Fehler und ohne Aenderung der Jahreswerte ' + (fehler || ''));
    ok(blick() === b0, 'R Rendern (Quick und Detail, Stufe 1 bis 3, leerer/halber/voller Stand) schreibt keine Eigenwerte, keinen State, keinen Cache');
    const namenNeu = Object.keys(rc).filter((k) => namen0.split(',').indexOf(k) < 0);
    ok(!namenNeu.length, 'R Rendern legt keinen globalen Namen an ' + namenNeu.join(','));
    ok(zaehler.calc === 0 && zaehler.timeline === 0 && zaehler.setzen === 0 && zaehler.update === 0, 'R Rendern ruft weder calc noch den Steuerverlauf noch das Setzen eines Eigenwerts ' + JSON.stringify(zaehler));
    ok(html1 && html1 === html2, 'R zweimal gerendert, gleicher Stand: gleiches HTML');
    /* Hoerer auf dp:detailgrad: nur in der Detail-Ansicht, nur Anzeige */
    const dg = hoerer['dp:detailgrad'] || [];
    ok(dg.length === 1, 'R tax.js meldet genau einen Hoerer auf dp:detailgrad an (' + dg.length + ')');
    let neuAufbau = 0; const echtRender = rc.renderYearlyTaxForm; rc.renderYearlyTaxForm = () => { neuAufbau++; };
    const b1 = blick();
    rc.__detailDa = false; dg.forEach((f) => f({ detail: { stufe: 1, alt: 3 } }));
    ok(neuAufbau === 0, 'R dp:detailgrad ohne aufgebautes Steuerformular: kein Neuaufbau (v3910)');
    rc.__detailDa = true; dg.forEach((f) => f({ detail: { stufe: 3, alt: 1 } }));
    ok(neuAufbau === 1 && blick() === b1 && zaehler.calc === 0 && zaehler.timeline === 0, 'R dp:detailgrad mit Steuerformular: nur das Steuerformular neu (v3910 auch im Quick-Modus, Knopf haengt an der Stufe), keine Rechnung, kein Steuerverlauf, nichts geschrieben');
    rc.renderYearlyTaxForm = echtRender; rc.__detailDa = false;
    rc._computeYearTotal = echteCyt;
    ok(JSON.stringify(rc._computeYearTotal(2025, 0, satz)) === vorher, 'R die Rechnung (_computeYearTotal mit Satz) ist nach dem Rendern dieselbe');
  })();
  /* Mechanik: detailgrad.js kennt data-dg-stufe (Zeile = Bereich, Felder folgen ihr), style.css blendet vor dem Markieren aus,
     die Karte steht ab Einsteiger in der Zuordnung */
  ok(/querySelectorAll\('\[data-dg-stufe\]'\)[\s\S]{0,200}expl\.set\(el, L\)/.test(Q.dg) && /f\.closest\('\[data-dg-stufe\]'\)/.test(Q.dg), 'E detailgrad.js: data-dg-stufe als Bereich, Felder folgen ihrer Zeile');
  ok(/body\.dp-dg-1 [^{]*\[data-dg-stufe="2"\][\s\S]{0,300}body\.dp-dg-2 [^{]*\[data-dg-stufe="3"\] \{ display: none !important; \}/.test(Q.css), 'E style.css: Zeilen ueber der Stufe ausgeblendet (data-dg-stufe)');
  const zuo = (Q.zuo.match(/"s3-tax": \{\s*"1": \{[\s\S]*?"felder"/) || [''])[0];
  const zuo2 = (Q.zuo.match(/"s3-tax": \{[\s\S]*?"2": \{[\s\S]*?"felder"/) || [''])[0].replace(zuo, '');
  ok(!/#yearly-tax-form-box/.test(zuo) && /#yearly-tax-form-box/.test(zuo2), 'E Zuordnung: Steuerformular pro Jahr ab Fortgeschritten, nicht bei Einsteiger (v3910, Marcel 20.11.2026)');
  ok(/if \(_dgYtf < 3\) mode = 'quick';/.test(Q.tax) && /\(_dgYtf < 3 \? '' : '<div class="ytf-mode-toggle">'/.test(Q.tax), 'E tax.js: unter Experte nur Quick-Modus, kein Knopf Detail-Modus (v3910)');

  /* ── H · v3900 Stempel beim Speichern: Vordruck und Zeilen je Jahr ── */
  const KA = kernCtx(jahrDateien.map(jahrQuelle).concat([Q.kern])).AnlageVKern;
  ok(KA && typeof KA.stempel === 'function', 'H AnlageVKern.stempel');
  if (KA && KA.stempel) {
    const T25 = KA.tabelle(2025);
    const s25 = KA.stempel(2025, { schuldzinsen: 100, notar_grundschuld: 0, av_garagen: 5, _afaSonder7b: 10 });
    ok(s25._formular && s25._formular.jahr === 2025 && s25._formular.kennung === T25.formular && s25._formular.stand === T25.stand && !s25._formular.fehlt, 'H 2025: _formular { jahr, kennung, stand } aus der Abschrift');
    ok(s25._zeilen && s25._zeilen.schuldzinsen === 48 && s25._zeilen.av_garagen === 26 && s25._zeilen.afa_7b === 38 && !('notar_grundschuld' in s25._zeilen), 'H 2025: _zeilen nur fuer Felder mit Betrag (Schuldzinsen 48, Garagen 26, § 7b 38, ohne Betrag keine Zeile)');
    const s30 = KA.stempel(2030, { schuldzinsen: 100 });
    ok(s30._formular && s30._formular.jahr === 2030 && s30._formular.fehlt === true && !s30._zeilen && !s30._formular.kennung, 'H Jahr ohne Abschrift: _formular { jahr, fehlt: true }, keine Zeilen (kein Ersatzjahr)');
    for (const f of jahrDateien) {
      const j = +f.slice(9, 13), T = KA.tabelle(j);
      if (!T) { ok(false, 'H ' + f + ': Abschrift ladbar'); continue; }
      const w = {}; Object.keys(T.felder).forEach((k) => { w[k] = 1; });
      const s = KA.stempel(j, w);
      const falsch = Object.keys(T.felder).filter((k) => T.felder[k].zeile != null && s._zeilen[k] !== T.felder[k].zeile);
      ok(!falsch.length && s._formular.kennung === T.formular, 'H ' + f + ': Stempel traegt die Zeilen des Jahres ' + j + ' ' + falsch.join(','));
      /* Zeilen eindeutig: kein Schluessel doppelt im Quelltext (JS ueberschreibt still) */
      const src = jahrQuelle(f).replace(/\r\n/g, '\n'), zb = (src.match(/\n  zeilen: \{([\s\S]*?)\n  \}/) || [])[1] || '', fb = (src.match(/\n  felder: \{([\s\S]*?)\n  \}/) || [])[1] || '';
      const dop = (txt, re) => { const n = {}; let m; while ((m = re.exec(txt))) n[m[1]] = (n[m[1]] || 0) + 1; return Object.keys(n).filter((k) => n[k] > 1); };
      const ohneK = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
      const dz = dop(ohneK(zb), /^\s{4}(\d+):/gm), df = dop(ohneK(fb), /^\s{4}([a-z_0-9]+):/gm);
      ok(zb && fb && !dz.length && !df.length, 'H ' + f + ': Zeilen und Felder je einmal ' + dz.concat(df).join(','));
      const Sx = T.summen || {}, sz = Object.keys(Sx).filter((k) => typeof Sx[k] === 'number' && !T.zeilen[Sx[k]]);
      ok(!sz.length && Object.keys(T.verh || {}).every((k) => T.zeilen[k]), 'H ' + f + ': jede Summenzeile und jede verh-Zeile abgeschrieben ' + sz.join(','));
      /* Aufstellung des Jahres: Einnahmen- und Werbungskostenzeilen ergeben die Summenzeilen */
      const vv = { einnahmen_km: 12000, einnahmen_nk: 2000, av_garagen: 1200, schuldzinsen: 3000, afa: 2500, nk_umlf: 2000, erhaltungsaufwand: 1500, kontofuehrung: 60, porto: 40, av_renten: 600, av_zuschuesse: 500, av_zuschuesse_eigen: 100 };
      const ww = KA.wirkung(vv, 9100), e0 = 14000 + ww.ein, w0 = 9100 + ww.wk;
      const RR = KA.aufstellung(j, { values: vv, einnahmen: e0, werbungskosten: w0, auto: {} });
      const se = RR ? RR.einnahmen.filter((e) => !e.teil).reduce((a, e) => a + e.betrag, 0) : NaN, sw = RR ? RR.wk.filter((e) => !e.teil).reduce((a, e) => a + e.betrag, 0) : NaN;
      ok(RR && nah(se, e0) && nah(sw, w0) && RR.summeEinnahmen.zeile === T.summen.einnahmen && RR.summeWk.zeile === T.summen.werbungskosten && RR.ueberschuss.zeile === T.summen.ueberschuss, 'H ' + f + ': Aufstellung ergibt Summe der Einnahmen / Werbungskosten in den Zeilen ' + T.summen.einnahmen + ' / ' + T.summen.werbungskosten + ' (' + Math.round(se) + ' / ' + Math.round(sw) + ')');
      ok(RR && !RR.hinweise.concat(RR.kuerzung ? [RR.kuerzung.text] : []).some((h) => /Zeile\s+(eine|vor|\.|$)/.test(h)), 'H ' + f + ': kein Hinweis mit leerer Zeilennummer');
    }
  }
  /* Backend nimmt den Stempel an (Whitelist taxService.anlageV), am echten Code ohne Datenbank */
  try {
    const fn = (Q.svc.match(/function safeNumeric[\s\S]*?\n\}\n/) || [''])[0] + (Q.svc.match(/function anlageV\(o\)[\s\S]*?\n\}\n/) || [''])[0];
    const bc = {}; vm.createContext(bc); vm.runInContext(fn + ';this.anlageV = anlageV;', bc);
    const r1 = JSON.parse(bc.anlageV({ _formular: { jahr: 2025, kennung: '2025AnlV101NET<b>', stand: 'September 2025', x: 1 }, _zeilen: { schuldzinsen: 48, 'BOESE KEY': 3, afa: 'x', notar_grundschuld: 51.5, av_garagen: '26' } }));
    ok(r1._formular && r1._formular.jahr === 2025 && r1._formular.kennung === '2025AnlV101NETb' && r1._formular.stand === 'September 2025' && !('x' in r1._formular), 'H Backend: _formular angenommen, Text bereinigt, fremde Schluessel weg');
    ok(r1._zeilen && r1._zeilen.schuldzinsen === 48 && r1._zeilen.av_garagen === 26 && Object.keys(r1._zeilen).length === 2, 'H Backend: _zeilen nur gueltige Feldnamen mit ganzzahliger Zeile');
    const r2 = bc.anlageV({ _formular: { jahr: 2026, fehlt: true } });
    ok(r2 && JSON.parse(r2)._formular.fehlt === true, 'H Backend: Jahr ohne Abschrift wird gespeichert (fehlt: true)');
    const gross = {}; for (let i = 0; i < 300; i++) gross['f' + i] = 10;
    ok(Object.keys(JSON.parse(bc.anlageV({ _zeilen: gross }))._zeilen).length <= 120 && bc.anlageV({ _formular: 'x', _zeilen: [1, 2] }) === null, 'H Backend: hoechstens 120 Zeilen, falsche Typen verworfen');
  } catch (e) { ok(false, 'H Backend-Whitelist im Pruefstand: ' + e.message); }
  ok(/AnlageVKern\.stempel\(t\.year, v\)/.test(Q.sto) && /return Object\.keys\(o\)\.length \? o : null;/.test(Q.sto), 'H storage.js stempelt jedes Steuerjahr beim Speichern');
  /* index.html laedt jede Abschrift vor dem Kern */
  for (const f of jahrDateien) ok(new RegExp('<script src="js/' + f.replace(/\./g, '\\.') + '\\?v=[^"]+"></script>').test(Q.idx) && Q.idx.indexOf('js/' + f) < Q.idx.indexOf('js/anlage-v-kern.js'), 'H index.html laedt ' + f + ' vor dem Kern');
  /* ── W · v3920 Werbungskosten-PDF, Anlage-V-Seite und Steuer-Mappe nach den Bloecken A bis F (Pruefstand oben) ── */
  let WL = null;
  try { WL = wkLauf(Q); } catch (e) { ok(false, 'W Pruefstand Werbungskosten-PDF und Steuer-Mappe laeuft: ' + e.message); }
  if (WL) {
    const KW = WL._ctx.AnlageVKern;
    const zahlAus = (t) => Number(String(t).replace(/[^\d,−-]/g, '').replace('−', '-').replace(/\./g, '').replace(',', '.'));
    const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    WK_VORHER.faelle.forEach((v0, i) => {
      const n = WL.faelle[i], tag = 'W Fall ' + (i + 1) + ' (' + v0.jahr + ')';
      if (!n) { ok(false, tag + ': Fall fehlt im Pruefstand'); return; }
      ok(JSON.stringify(n.tot) === JSON.stringify(v0.tot), tag + ': Einnahmen, Werbungskosten, Ergebnis wie vor v3920 ' + JSON.stringify(n.tot));
      ok(JSON.stringify(n.wk) === JSON.stringify(v0.wk), tag + ': Aufstellung (Summe, Einnahmen V+V, Ergebnis) wie vor v3920 (' + n.wk.summe + ')');
      ok(JSON.stringify(n.av) === JSON.stringify(v0.av), tag + ': Anlage-V-Seite, jedes Paar Zeile und Betrag wie vor v3920');
      ok(JSON.stringify(n.mappe) === JSON.stringify(v0.mappe), tag + ': Steuer-Mappe, Anlage-V-Blatt, jedes Paar Zeile und Betrag wie vor v3920');
      const bs = KW.blockSummen(n._tot.values);
      ok(nah(bs.einnahmen, n._tot.einnahmen) && nah(bs.werbungskosten, n._tot.werbungskosten), tag + ': Block A = Summe der Einnahmen, B bis E minus nicht abzugsfaehiger Anteil = Summe der Werbungskosten (' + Math.round(bs.werbungskosten) + ' / ' + Math.round(n._tot.werbungskosten) + ')');
      /* Seite der Aufstellung: Bloecke in der Reihenfolge A bis F, je Block die gedruckten Zeilen ohne „davon" = Zwischensumme */
      const T = n._texte, gruppen = {}; T.forEach((e) => { if (e.tabelle) return; const k = e.s + '|' + e.y; (gruppen[k] = gruppen[k] || []).push(e); });
      const folge = T.filter((e) => /^[A-F] · /.test(e.t)).map((e) => e.t.charAt(0));
      ok(folge.length >= 2 && folge.join('') === folge.slice().sort().join(''), tag + ': Bloecke auf der Aufstellung in der Reihenfolge A bis F (' + folge.join('') + ')');
      let blk = null; const sum = {}, zw = {}, eurR = /^[−-]?[\d.]+(,\d+)? €$/;
      Object.values(gruppen).sort((a, b) => a[0].s - b[0].s || a[0].y - b[0].y).forEach((g) => {
        const kopfB = g.find((e) => /^[A-F] · /.test(e.t)); if (kopfB) { blk = kopfB.t.charAt(0); return; }
        if (/^VERHÄLTNISMÄSSIGE/.test(g[0].t)) { blk = 'X'; return; }
        if (g.some((e) => /^SUMME /.test(e.t))) { blk = null; return; }   /* Kasten mit der Summe: kein Block mehr */
        const b = g.find((e) => e.r && eurR.test(e.t)); if (!b || !blk) return;
        if (g.some((e) => e.t === 'Zwischensumme')) { zw[blk] = zahlAus(b.t); return; }
        const lab = g.find((e) => !e.r && !/^Z\. /.test(e.t));
        if (lab && (lab.x === 37 || lab.x === 23)) return;   /* davon-Zeile, eingerueckt */
        sum[blk] = (sum[blk] || 0) + zahlAus(b.t);
      });
      const falsch = Object.keys(zw).filter((k) => Math.abs((sum[k] || 0) - zw[k]) > 6);
      ok(Object.keys(zw).length >= 2 && !falsch.length, tag + ': je Block ergeben die gedruckten Zeilen die Zwischensumme ' + falsch.map((k) => k + ' ' + sum[k] + '/' + zw[k]).join(' '));
      const zSum = Object.keys(zw).filter((k) => k !== 'A').reduce((a, k) => a + zw[k], 0);
      ok(nah(zw.A || 0, Math.round(n._tot.einnahmen), 1) && Math.abs(zSum - n._tot.werbungskosten) <= 3, tag + ': Zwischensummen A = ' + (zw.A || 0) + ' (Einnahmen), B bis E und Anteil = ' + zSum + ' (Werbungskosten ' + Math.round(n._tot.werbungskosten) + ')');
      /* Zeilennummern des Jahres: jede gedruckte „Z. n" steht neben der Zeile, der die Abschrift diese Nummer gibt */
      const AB = KW.aufstellungBloecke(v0.jahr, n._tot.values, { afaSonder7b: n._tot.afaSonder7b, erhV: n._tot.erhV, erhG: n._tot.erhG, afaArt: n._tot.afaArt });
      const fehltNr = [];
      AB.bloecke.forEach((bl) => bl.rows.forEach((r) => {
        const anfang = String(r.text).split(' ').slice(0, 3).join(' ');
        const lab = T.find((e) => !e.r && e.t.indexOf(anfang) === 0);
        if (!lab) { fehltNr.push('Text ' + r.text); return; }
        const nrE = (gruppen[lab.s + '|' + lab.y] || []).find((e) => /^Z\. /.test(e.t));
        if ((r.nr != null ? 'Z. ' + r.nr : null) !== (nrE ? nrE.t : null)) fehltNr.push(r.text + ' ' + (nrE ? nrE.t : '-') + '/' + r.nr);
      }));
      ok(!fehltNr.length, tag + ': jede Zeile mit Zeilentext und Zeilennummer des Jahres ' + v0.jahr + ' ' + fehltNr.slice(0, 3).join(' | '));
      ok(AB.mitNummern === !!KW.tabelle(v0.jahr) && (!AB.mitNummern ? !T.some((e) => /^Z\. /.test(e.t)) : true), tag + ': ohne Abschrift des Jahres keine Zeilennummer');
      /* dieselben Zeilentexte wie das Steuerformular (echter Renderer, Experte, alle Felder mit Betrag) */
      if (v0.jahr !== 2026) {
        const F = rendern({ jahr: v0.jahr, stufe: 3, ov: n._tot.values, son7b: n._tot.afaSonder7b, erhV: n._tot.erhV, erhG: n._tot.erhG });
        const ohneText = [];
        const ABf = KW.aufstellungBloecke(v0.jahr, n._tot.values, { afaSonder7b: n._tot.afaSonder7b, erhV: n._tot.erhV, erhG: n._tot.erhG, afaArt: n._tot.afaArt, afaSatz: 2 });   /* der Pruefstand des Formulars hat #afa_satz = 2 */
        ABf.bloecke.forEach((bl) => bl.rows.forEach((r) => { if (!new RegExp('(>|<b>)' + escRe(r.text) + '(</b>| <span|</td>|,|\\.)').test(F.h)) ohneText.push(r.text); }));
        ok(!ohneText.length, tag + ': jeder Zeilentext der Aufstellung steht genauso im Steuerformular ' + ohneText.slice(0, 3).join(' | '));
        const bForm = Object.keys(F.bl).join(''), bPdf = AB.bloecke.map((b) => b.k).join('');
        ok(bPdf.split('').every((k) => bForm.indexOf(k) >= 0), tag + ': Bloecke der Aufstellung (' + bPdf + ') sind Bloecke des Formulars (' + bForm + ')');
      }
      /* Anlage-V-Seite und Steuer-Mappe: Bloecke A bis F in dieser Reihenfolge */
      if (n._avTexte) {
        const f2 = n._avTexte.filter((e) => /^[A-F] · /.test(e.t)).map((e) => e.t.charAt(0)).join('');
        ok(f2.length >= 2 && f2 === f2.split('').sort().join('') && /^A/.test(f2), tag + ': Anlage-V-Seite nach Bloecken A bis F (' + f2 + ')');
        const f3 = (n._mappeHtml.match(/<h3>([A-F]) · /g) || []).map((x) => x.charAt(4)).join('');
        ok(f3.length >= 2 && f3 === f3.split('').sort().join('') && /^A/.test(f3), tag + ': Steuer-Mappe, Anlage-V-Blatt nach Bloecken A bis F (' + f3 + ')');
      }
    });
    ok(JSON.stringify(WL.matrix) === JSON.stringify(WK_VORHER.matrix), 'W Gesamtuebersicht: Summe WK, Einnahmen, Ergebnis je Jahr wie vor v3920');
    const M = WL._matrix, kopfM = M ? M.head[0].join('|') : '';
    ok(/B Abschr\.\|C Finanz\.\|D Erhaltung\|E Lfd\. Kosten\|Summe WK\|A Einnahmen/.test(kopfM)
      && M.body.every((r) => Math.abs([1, 2, 3, 4].reduce((a, k) => a + zahlAus(r[k]), 0) - zahlAus(r[5])) <= 2), 'W Gesamtuebersicht: Spalten B bis E, ihre Summe ergibt Summe WK (' + kopfM + ')');
    const sf = WL._ctx.__dok.satzFelder ? WL._ctx.__dok.satzFelder().slice().sort().join(',') : '';
    ok(sf === WK_FELDER_ALT.slice().sort().join(',') && KW.BASIS.slice().sort().join(',') === sf, 'W Steuer-Mappe liest dieselben 26 Steuerzeilen wie vor v3920 (tax_records)');
    const dz = WL._ctx.__dok.blockZeilen(WL._B, 2025, WL.faelle[1]._tot.values, {}).zeilen.filter((z) => z[2] && z[2].art === 'summe' && z[1] !== '');
    ok(dz.length === 5 && zahlAus(dz[0][1]) === Math.round(WL.faelle[1]._tot.einnahmen) && dz.map((z) => z[0].charAt(0)).join('') === 'ABCDE', 'W Steuer-Mappe/Finanzamt: Bloecke A bis E mit Zwischensumme, A = Einnahmen (' + dz.map((z) => z[0].charAt(0) + ' ' + z[1]).join(', ') + ')');
    ok(!/_AV_LABEL|'1\. Finanzierungskosten'|'7\. Weitere Werbungskosten/.test(code(Q.wk)) && !/WK_NAME|'1\. Finanzierungskosten'|'7\. Weitere Werbungskosten/.test(code(Q.dok)), 'W keine eigene Abschnittsliste mehr in werbungskosten-pdf.js und dp-dokumente.js');
    ok(/_avK\.bloecke\(y\.year/.test(Q.tax) && !/\{ k: 'A', titel: 'Einnahmen'/.test(code(Q.tax)), 'W tax.js: Gliederung aus AnlageVKern.bloecke, keine zweite Liste');
    const neuT = KW.BLOECKE.map((b) => b.titel + ' ' + b.rows.map((r) => (r.l || '') + ' ' + (r.woher || '')).join(' ')).join(' ');
    ok(!/ – | — |;/.test(neuT), 'W Zeilentexte der Gliederung: kein Gedankenstrich, kein Semikolon');
  }
  return rot - r0;
}

const Q = { kern: lies('frontend/js/anlage-v-kern.js'), tax: lies('frontend/js/tax.js'), dok: lies('frontend/js/dp-dokumente.js'),
  wk: lies('frontend/js/werbungskosten-pdf.js'), idx: lies('frontend/index.html'), sto: lies('frontend/js/storage.js'), jahr: {},
  /* v3900 */ dg: lies('frontend/js/detailgrad.js'), css: lies('frontend/css/style.css'), zuo: lies('frontend/js/data/detailgrad-zuordnung.js'), svc: lies('backend/src/services/taxService.js') };
console.log('Anlage V · Abschriften, Kern, Steuerrechnung, Verdrahtung');
pruefen(Q);
const echt = rot;

console.log('G · Gegenprobe (je eine Stelle zurueckgebaut, erwartet ROT)');
const gegen = [
  ['Kern: Garagen aendern die Summe', Object.assign({}, Q, { kern: Q.kern.replace("av_garagen:        { art: 'davon_km'", "av_garagen:        { art: 'ein'") })],
  ['Kern: Ersatzjahr', Object.assign({}, Q, { kern: Q.kern.replace("return t && t.zeilen && t.felder ? t : null;", "return t && t.zeilen && t.felder ? t : window.AnlageV2025;") })],
  ['Abschrift: Garagen in falscher Zeile', Object.assign({}, Q, { jahr: { 'anlage-v-2025.js': lies('frontend/js/anlage-v-2025.js').replace("av_garagen:         { zeile: 26", "av_garagen:         { zeile: 99") } })],
  ['tax.js ohne anlage_v', Object.assign({}, Q, { tax: Q.tax.replace("einnahmen += _avW.ein;", "") })],
  /* v3900 */
  ['tax.js: Zeilen ohne Stufe', Object.assign({}, Q, { tax: Q.tax.split('<tr data-dg-stufe="\' + r.eff').join('<tr data-x="\' + r.eff') })],
  ['tax.js: verborgene Zeile mit Betrag bleibt verborgen', Object.assign({}, Q, { tax: Q.tax.replace('} else if (r.f && !gedeckt[r.f] && eff > 1 && _wirkt(r.f))', '} else if (false)') })],
  ['Kern: Stempel ohne fehlt', Object.assign({}, Q, { kern: Q.kern.replace('o._formular = { jahr: j, fehlt: true }; return o;', 'return o;') })],
  ['Backend: _zeilen nicht in der Whitelist', Object.assign({}, Q, { svc: Q.svc.replace("k === '_zeilen'", "k === '_zeilenX'") })],
  ['Abschrift 2023: Zeile doppelt', Object.assign({}, Q, { jahr: { 'anlage-v-2023.js': lies('frontend/js/anlage-v-2023.js').replace("    50: { text: 'Geldbeschaffungskosten", "    47: { text: 'Geldbeschaffungskosten") } })],
  ['Abschrift 2022: Summenzeile fehlt', Object.assign({}, Q, { jahr: { 'anlage-v-2022.js': lies('frontend/js/anlage-v-2022.js').replace('sonder7b: 34,', 'sonder7b: 99,') } })],
  ['tax.js: Detail-Ansicht schreibt einen Eigenwert', Object.assign({}, Q, { tax: Q.tax.replace('var _dgNamen = {', "_setYearOverride(y.year, 'porto', 1); var _dgNamen = {") })],
  ['tax.js: Hoerer stoesst den Steuerverlauf an', Object.assign({}, Q, { tax: Q.tax.replace("if (document.querySelector('#yearly-tax-form-box .ytf-toolbar')) renderYearlyTaxForm();", 'renderYearlyTaxForm(); renderTaxTimeline();') })],
  ['detailgrad.js ohne data-dg-stufe', Object.assign({}, Q, { dg: Q.dg.replace("f.closest('[data-dg-stufe]')", 'null') })],
  ['Mappe mit fester Zeile 83', Object.assign({}, Q, { dok: Q.dok.replace("zl(R.summeWk.zeile, null, 'Summe der Werbungskosten'", "zl('83', null, 'Summe der Werbungskosten'") })],
  /* v3920 · Gliederung A bis F, Betraege wie vorher */
  ['Kern: Block zaehlt Garagen ein zweites Mal', Object.assign({}, Q, { kern: Q.kern.replace("return (F.art === 'ein' || F.art === 'wk') ? 1", "return (F.art === 'ein' || F.art === 'wk' || F.art === 'davon_km') ? 1") })],
  ['WK-PDF: falsche Zeilennummer', Object.assign({}, Q, { wk: Q.wk.replace('return { nr: r.nr, text: r.text', 'return { nr: r.nr != null ? r.nr + 1 : null, text: r.text') })],
  ['WK-PDF: Betrag einer Zeile verfaelscht', Object.assign({}, Q, { wk: Q.wk.replace('betrag: r.betrag, davon: r.davon', 'betrag: r.davon ? r.betrag : r.betrag + 10, davon: r.davon') })],
  ['WK-PDF: Bloecke in anderer Reihenfolge', Object.assign({}, Q, { wk: Q.wk.replace('_AB.bloecke.forEach(function (bl) {', '_AB.bloecke.slice().reverse().forEach(function (bl) {') })],
  ['Gesamtuebersicht: Summe WK ohne Anteil', Object.assign({}, Q, { wk: Q.wk.replace('_f(totals.werbungskosten),', '_f(bs ? bs.B + bs.C + bs.D + bs.E : 0),') })],
  ['Mappe: Anlage-V-Blatt aus anderem Jahr', Object.assign({}, Q, { dok: Q.dok.replace('var R = K.aufstellung(jahr, tot); if (!R) return anlageVFehlt(B, jahr);', 'var R = K.aufstellung(jahr - 2, tot) || K.aufstellung(jahr, tot); if (!R) return anlageVFehlt(B, jahr);') })],
  ['tax.js: eigener Zeilentext im Formular', Object.assign({}, Q, { tax: Q.tax.replace('      r.l = r.text;', "      r.l = r.text + ' (Formular)';") })],
];
still = true;
let gegenRot = 0;
for (const [name, q] of gegen) {
  const r = rot; let e = null;
  try { pruefen(q); } catch (x) { e = x; }
  const wurdeRot = rot > r || e;
  rot = r;
  if (!wurdeRot) { gegenRot++; console.log('  ROT  Gegenprobe blieb gruen: ' + name); } else gruen++;
}
still = false;
rot = echt + gegenRot;
console.log(rot ? 'RC=1 ' + rot + ' rot, ' + gruen + ' gruen' : 'RC=0 sauber, ' + gruen + ' gruen');
process.exit(rot ? 1 : 0);
