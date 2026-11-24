/* ═════════════════════════════════════════════════════════════════
   DealPilot · tools/unterlagen-steuer-pruefen.mjs · v4200
   Befunde B14, B5, B7 aus dem Gesamtdurchlauf „Musterhof 8“ (23.11.2026,
   Dateien/Testdaten/mfh-2021/befunde.md, alle Zahlen MUSTER, erfunden).

   Laedt die ECHTEN Module:
     frontend/js/dokument-import.js    steuerVorschlaege, sonderumlagenAus, ergebnisAusText
     frontend/js/sonderumlage.js       DpSonderumlage.uebernehmen/liste
     frontend/js/jahresabschluss.js    DpJahresabschluss.unterlagenOffen (Schritt Steuer)
     frontend/js/unterlagen-eingang.js DpEingang.istRechnung (Grundsteuerbescheid)

   A  Hausgeldabrechnung 2023 (ganzes Haus, 1.000/1.000 MEA): Verwaltung 1.680,
      nicht umlagefaehig ohne Verwaltung 1.920, Erhaltung aus Ruecklage 14.000,
      Zufuehrung zur Ruecklage NICHT absetzbar, Sonderumlage 15.000 im Jahr 2023
   B  Schritt Steuer: was am Dokument haengt und in der Anlage V fehlt, wird
      angeboten. Steht der Wert schon in der Anlage V, nicht. Sonderumlage schon
      in der Liste, nicht. Andere Jahre nicht.
   C  Nachzahlung/Guthaben aus dem Text nur bei genau einem Betrag
   D  Grundsteuerbescheid ist ein Beleg (geht an den Beleg-Leser, nicht Marktbericht)
   E  Gegenprobe: ohne die Vorschlaege am Dokument meldet Schritt Steuer nichts
      (der Pruefer erkennt also wirklich den Unterschied)

   Aufruf aus dem Repo-Wurzelverzeichnis:  node tools/unterlagen-steuer-pruefen.mjs
   RC=0 ist sauber.
   ═════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fehler = 0, geprueft = 0;
const melde = (ok, text, ist) => {
  geprueft++;
  if (!ok) fehler++;
  if (!ok || process.argv.includes('--laut')) console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text + (ok ? '' : '  -> ist: ' + JSON.stringify(ist)));
};

const felder = {};
const feld = (id) => (felder[id] = felder[id] || { id, value: '', dispatchEvent() {} });
['weg_su', 'wirtschaftlicher_uebergang', 'kaufdat', 'objart', 'mea'].forEach(feld);

/* Anlage V je Jahr, wie tax.js dpSteuerWert sie liefert (Feld -> Wert) */
let anlageV = {};
let dokumente = [];
const sandbox = {
  console,
  document: {
    getElementById: (id) => felder[id] || null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), body: { appendChild() {} }, head: { appendChild() {} }
  },
  Event: function () {},
  Auth: { apiCall: async () => ({}) },
  addEventListener: () => {}, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, location: { search: '', href: '' }, localStorage: { getItem: () => null, setItem() {} },
  dpSteuerWert: (j, f) => (anlageV[j] ? { wert: anlageV[j][f] || 0, eigen: false } : null),
  DpUnterlagen: { laden: () => ({ dokumente }) }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const datei of ['frontend/js/dokument-import.js', 'frontend/js/sonderumlage.js', 'frontend/js/jahresabschluss.js', 'frontend/js/unterlagen-eingang.js']) {
  try { vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), sandbox, { filename: datei }); }
  catch (e) { console.log('FEHL  ' + datei + ' laedt nicht: ' + e.message); process.exit(1); }
}
const DI = sandbox.DokumentImport, SU = sandbox.DpSonderumlage, JAB = sandbox.DpJahresabschluss, EIN = sandbox.DpEingang;
if (!DI || !SU || !JAB || typeof JAB.unterlagenOffen !== 'function' || !EIN || typeof EIN.istRechnung !== 'function') {
  console.log('FEHL  Module nicht vollstaendig geladen (DokumentImport, DpSonderumlage, DpJahresabschluss.unterlagenOffen, DpEingang.istRechnung)');
  process.exit(1);
}

/* ── A · Musterhof, Hausgeldabrechnung 2023, ganzes Haus ─────────────── */
const ktx = { objart: 'MFH', mea: 100 };
felder.objart.value = 'MFH'; felder.mea.value = '100';
const abr2023 = {
  art: 'Jahresabrechnung', jahr: 2023, umfang: 'gesamt',
  gesamt: { umlagefaehig_jahr_eur: 8585, nicht_umlagefaehig_jahr_eur: 3600, verwaltung_jahr_eur: 1680, ruecklage_zufuehrung_jahr_eur: 2400 },
  ruecklage_entnahmen: [{ zweck: 'Dachrinnen und Fassade', betrag_eur: 14000 }],
  sonderumlagen: [{ zweck: 'Dachrinnen und Fassade', betrag_gesamt_eur: 15000, jahr: 2023, faellig: '01.06.2023' }],
  abrechnungsergebnis_eur: -175
};
const sv = JSON.parse(JSON.stringify(DI.steuerVorschlaege(abr2023, 'hausgeld', ktx)));
const wert = (f) => (sv.find((x) => x.feld === f) || {}).betrag;
melde(wert('hausverwaltung') === 1680, 'A1 Hausverwaltung 2023 = 1.680 €', sv);
melde(wert('nk_n_umlf') === 1920, 'A2 nicht umlagefaehig ohne Verwaltung = 1.920 €', sv);
melde(wert('erhaltungsaufwand') === 14000, 'A3 Erhaltung aus Ruecklagen-Entnahme = 14.000 €', sv);
melde(!sv.some((x) => x.betrag === 2400), 'A4 Zufuehrung zur Ruecklage (2.400 €) ist kein Vorschlag', sv);
melde(sv.every((x) => x.jahr === 2023), 'A5 alle Vorschlaege im Jahr der Abrechnung', sv);
const su = JSON.parse(JSON.stringify(DI.sonderumlagenAus(abr2023, 'hausgeld', ktx))).filter((x) => !x.hinweis);
melde(su.length === 1 && Math.round(su[0].betrag) === 15000 && su[0].jahr === 2023, 'A6 Sonderumlage 15.000 € im Jahr 2023 (ganzes Haus)', su);

/* ── B · Schritt Steuer: offene Betraege ───────────────────────────── */
const amDok = (x) => ({ typ: 'hausgeld', art: 'Jahresabrechnung', jahr: 2023, label: 'Hausgeldabrechnung 2023',
  steuer: x.steuer, su: x.su });
dokumente = [amDok({ steuer: sv.map((s) => ({ jahr: s.jahr, feld: s.feld, wort: s.wort, betrag: Math.round(s.betrag) })), su: su.map((s) => ({ jahr: s.jahr, betrag: Math.round(s.betrag), zweck: s.zweck, faellig: s.faellig })) })];
anlageV = { 2023: { hausverwaltung: 0, nk_n_umlf: 0, erhaltungsaufwand: 0 }, 2024: {} };
felder.weg_su.value = '';
let o = JSON.parse(JSON.stringify(JAB.unterlagenOffen(2023)));
melde(o.steuer.length === 3, 'B1 drei Steuerbetraege 2023 fehlen in der Anlage V (Verwaltung, nicht umlagefaehig, Erhaltung)', o.steuer);
melde(o.su.length === 1 && o.su[0].betrag === 15000, 'B2 Sonderumlage 15.000 € fehlt in der Liste', o.su);
anlageV[2023].hausverwaltung = 1680; anlageV[2023].erhaltungsaufwand = 14000;
o = JSON.parse(JSON.stringify(JAB.unterlagenOffen(2023)));
melde(o.steuer.length === 1 && o.steuer[0].feld === 'nk_n_umlf', 'B3 was schon in der Anlage V steht, wird nicht mehr angeboten', o.steuer);
SU.uebernehmen({ zweck: 'Dachrinnen und Fassade', jahr: 2023, betrag: 15000, faellig: '01.06.2023' });
o = JSON.parse(JSON.stringify(JAB.unterlagenOffen(2023)));
melde(o.su.length === 0, 'B4 Sonderumlage in der Liste: nicht mehr angeboten', o.su);
o = JSON.parse(JSON.stringify(JAB.unterlagenOffen(2024)));
melde(o.steuer.length === 0 && o.su.length === 0, 'B5 andere Jahre (2024) melden nichts', o);
anlageV = {};
o = JSON.parse(JSON.stringify(JAB.unterlagenOffen(2023)));
melde(o.steuer.length === 0, 'B6 Jahr nicht in der Zeitleiste: kein Angebot', o.steuer);

/* ── C · Nachzahlung / Guthaben aus dem Text ───────────────────────── */
melde(DI.ergebnisAusText('Vorauszahlungen 14.160,00 € Nachzahlung 681,00 € Erhaltungsruecklage') === 681, 'C1 Nachzahlung 681,00 € (Abrechnung 2022)', null);
melde(DI.ergebnisAusText('Summe 14.585,00 € Guthaben 175,00 € Ruecklage') === -175, 'C2 Guthaben 175,00 € wird negativ', null);
melde(DI.ergebnisAusText('Nachzahlung 1,00 € oder Guthaben 3,00 €') === null, 'C3 zwei verschiedene Betraege: kein Ergebnis', null);
melde(DI.ergebnisAusText('ohne Betrag') === null, 'C4 kein Betrag: kein Ergebnis', null);

/* ── D · Grundsteuerbescheid ────────────────────────────────────────── */
const bescheid = 'Grundsteuerbescheid ab Kalenderjahr 2025 Stadt Herford (MUSTER) Steueramt Bescheid vom 10.02.2025 Grundsteuer B. Grundsteuermessbetrag 118,52 € Hebesatz 540 % Jahresbetrag Grundsteuer ab 2025 640,00 €';
melde(EIN.istRechnung(bescheid, 'grundsteuerbescheid-2025.pdf') === true, 'D1 Grundsteuerbescheid geht an den Beleg-Leser', null);
melde(EIN.istRechnung('Hausgeldabrechnung 2023 Verwaltervergütung 1.680,00 €', 'hausgeldabrechnung-2023.pdf') === false, 'D2 Hausgeldabrechnung ist kein Beleg fuer den Beleg-Leser', null);

/* ── E · Gegenprobe ─────────────────────────────────────────────────── */
anlageV = { 2023: {} };
dokumente = [{ typ: 'hausgeld', art: 'Jahresabrechnung', jahr: 2023 }];
o = JSON.parse(JSON.stringify(JAB.unterlagenOffen(2023)));
melde(o.steuer.length === 0 && o.su.length === 0, 'E1 Gegenprobe: ohne Vorschlaege am Dokument meldet Schritt Steuer nichts', o);

/* ── F · v4340 Belege nach Anlage V: Gliederung, Vorschlag, Umbuchen ── */
for (const datei of ['frontend/js/anlage-v-kern.js', 'frontend/js/anlage-v-2025.js', 'frontend/js/belege-anlage-v.js']) {
  try { vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), sandbox, { filename: datei }); }
  catch (e) { console.log('FEHL  ' + datei + ' laedt nicht: ' + e.message); process.exit(1); }
}
const BAV = sandbox.DpBelegeAv;
melde(!!BAV && typeof BAV.umbuchen === 'function', 'F0 DpBelegeAv geladen', null);
/* Steuerjahr 2025 wie tax.js: eigene Werte (ov) und Vorschlag der App (auto) */
let ov = {}, auto = {}, gesperrt = false;
sandbox.dpWkStand = (j, f) => ({ override: ov[j] && typeof ov[j][f] === 'number' ? ov[j][f] : null, auto: auto[f] != null ? auto[f] : null });
sandbox._setYearOverride = (j, f, v) => { ov[j] = ov[j] || {}; if (v === '' || v == null) delete ov[j][f]; else ov[j][f] = Number(v); };
sandbox.dpWkUebernehmen = (j, p) => { Object.keys(p).forEach((f) => { const alt = ov[j] && typeof ov[j][f] === 'number' ? ov[j][f] : null; sandbox._setYearOverride(j, f, alt == null ? p[f] : alt + p[f]); }); return { ok: true }; };
sandbox.DpJahresbuch = { aenderungErlaubt: () => !gesperrt };
feld('_dok_eingang');
const setzeEingang = (buch) => { felder._dok_eingang.value = JSON.stringify({ herkunft: {}, verlauf: [], buchungen: buch }); };
const buchungen = () => JSON.parse(felder._dok_eingang.value).buchungen;
/* Muster: Handwerkerrechnung als Sonstiges eingelesen, Küche als Erhaltung, Hausverwaltung 1.680 als Sonstiges, Zinsbeleg */
ov = { 2025: { sonst_kosten: 2100, erhaltungsaufwand: 4200, schuldzinsen: 900 } };
auto = { hausverwaltung: 600, schuldzinsen: 3600, einnahmen_km: 7800 };
setzeEingang([
  { jahr: 2025, feld: 'sonst_kosten', betrag: 420, datei: 'rechnung-maler.pdf', position: 'Malerarbeiten Treppenhaus', kategorie: 'Sonstiges' },
  { jahr: 2025, feld: 'erhaltungsaufwand', betrag: 3570, datei: 'kueche.pdf', position: 'Einbauküche Wohnung 2', kategorie: 'Erhaltungsaufwand / Reparatur' },
  { jahr: 2025, feld: 'sonst_kosten', betrag: 1680, datei: 'hv-2025.pdf', position: 'Verwaltervergütung 2025', kategorie: 'Sonstiges' },
  { jahr: 2025, feld: 'schuldzinsen', betrag: 900, datei: 'bank-q1.pdf', position: 'Zinsen 1. Quartal', kategorie: 'Schuldzinsen' }
]);
const zeilen = [
  { feld: 'schuldzinsen', label: 'Schuldzinsen', wert: 900, summe: 900, rest: 0, art: '' },
  { feld: 'erhaltungsaufwand', label: 'Erhaltungsaufwand', wert: 4200, summe: 3570, rest: 630, art: '' },
  { feld: 'sonst_kosten', label: 'Sonstige Kosten', wert: 2100, summe: 2100, rest: 0, art: '' }
];
const G = JSON.parse(JSON.stringify(BAV.gruppen(2025, zeilen)));
melde(G.map((g) => g.k).join('') === 'ACDE', 'F1 Bloecke in der Reihenfolge der Anlage V: Einnahmen, Finanzierung, Erhaltung, Laufende Kosten', G.map((g) => g.k));
const pz = (k, f) => ((G.find((g) => g.k === k) || { posten: [] }).posten.find((p) => p.feld === f) || {});
melde(pz('C', 'schuldzinsen').zeile === 48 && pz('D', 'erhaltungsaufwand').zeile === 55 && pz('E', 'sonst_kosten').zeile === 82, 'F2 Zeilen der Anlage V 2025: Schuldzinsen 48, Erhaltung 55, Sonstige 82', [pz('C', 'schuldzinsen').zeile, pz('D', 'erhaltungsaufwand').zeile, pz('E', 'sonst_kosten').zeile]);
melde(pz('C', 'schuldzinsen').fest === true && pz('A', 'einnahmen_km').fest === true, 'F3 Schuldzinsen und Einnahmen sind fest', null);
const vk = BAV.vorschlag(buchungen()[1]), vh = BAV.vorschlag(buchungen()[2]), vm0 = BAV.vorschlag(buchungen()[0]);
melde(vk && vk.feld === 'sonst_bewegl_wg', 'F4 Einbauküche 3.570 € (über 800 € netto): Vorschlag AfA bewegliche Wirtschaftsgüter', vk);
melde(vh && vh.feld === 'hausverwaltung', 'F5 Verwaltervergütung unter Sonstiges: Vorschlag Hausverwaltung', vh);
melde(vm0 === null, 'F6 Malerarbeiten: kein Vorschlag (keine Regel greift, Zuordnung bleibt bei dir)', vm0);
melde(BAV.vorschlag({ feld: 'erhaltungsaufwand', betrag: 600, position: 'Kühlschrank' }) === null, 'F7 Kühlschrank 600 € brutto (unter 800 € netto, sofort absetzbar): kein AfA-Vorschlag', null);
/* Umbuchen: Malerarbeiten 420 von Sonstiges nach Erhaltung */
let r = JSON.parse(JSON.stringify(BAV.umbuchen(0, 'erhaltungsaufwand')));
melde(r.ok && ov[2025].sonst_kosten === 1680 && ov[2025].erhaltungsaufwand === 4620, 'F8 Umbuchen: Sonstige 2.100 → 1.680, Erhaltung 4.200 → 4.620', [r, ov[2025]]);
melde(buchungen()[0].feld === 'erhaltungsaufwand' && buchungen()[0].zuordnung === 'hand' && buchungen()[0].umgebucht.length === 1, 'F9 die Position traegt die neue Zuordnung und ihre Herkunft', buchungen()[0]);
const summeVor = 2100 + 4200, summeNach = ov[2025].sonst_kosten + ov[2025].erhaltungsaufwand;
melde(summeVor === summeNach, 'F10 Summe der Werbungskosten unveraendert (keine Doppelzaehlung)', [summeVor, summeNach]);
/* Verwaltung 1.680 nach Hausverwaltung: dort stand nur der Vorschlag der App (600) - der Beleg ersetzt ihn */
r = BAV.umbuchen(2, 'hausverwaltung');
melde(r.ok && ov[2025].hausverwaltung === 1680 && ov[2025].sonst_kosten === undefined, 'F11 Sonstige leer → eigener Wert faellt weg, Hausverwaltung 1.680 ersetzt den Vorschlag der App 600', ov[2025]);
r = BAV.umbuchen(3, 'nk_n_umlf');
melde(!r.ok && ov[2025].schuldzinsen === 900, 'F12 Schuldzinsen sind fest: keine Umbuchung', r);
r = BAV.umbuchen(0, 'schuldzinsen');
melde(!r.ok, 'F13 in die Schuldzinsen wird nicht umgebucht', r);
ov[2025].erhaltungsaufwand = 100;
r = BAV.umbuchen(1, 'sonst_bewegl_wg');
melde(!r.ok && ov[2025].erhaltungsaufwand === 100 && ov[2025].sonst_bewegl_wg === undefined, 'F14 Posten von Hand unter die Position gesenkt: keine Umbuchung, nichts geaendert', [r, ov[2025]]);
ov[2025].erhaltungsaufwand = 4620; gesperrt = true;
r = BAV.umbuchen(1, 'sonst_bewegl_wg');
melde(!r.ok && ov[2025].erhaltungsaufwand === 4620, 'F15 festgeschriebenes Jahr: keine Umbuchung', r);
gesperrt = false;
r = BAV.umbuchen(1, '');
melde(r.ok && ov[2025].erhaltungsaufwand === 1050 && buchungen()[1].feld === '', 'F16 nicht absetzbar: Betrag faellt aus der Erhaltung, Position bleibt sichtbar', [ov[2025], buchungen()[1]]);
r = BAV.umbuchen(1, 'sonst_bewegl_wg');
melde(r.ok && ov[2025].sonst_bewegl_wg === 3570 && ov[2025].erhaltungsaufwand === 1050, 'F17 aus „nicht absetzbar“ zurueck in einen Posten: nur dort addiert', ov[2025]);
/* Gegenprobe: ohne Abzug im Quellposten waere die Summe gewachsen */
melde(ov[2025].erhaltungsaufwand + ov[2025].hausverwaltung + ov[2025].sonst_bewegl_wg === 1050 + 1680 + 3570, 'F18 Gegenprobe Summe der Ziele', ov[2025]);

console.log('unterlagen-steuer-pruefen: ' + (geprueft - fehler) + ' von ' + geprueft + ' ok');
process.exit(fehler ? 1 : 0);
