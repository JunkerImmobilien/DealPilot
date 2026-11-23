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

console.log('unterlagen-steuer-pruefen: ' + (geprueft - fehler) + ' von ' + geprueft + ' ok');
process.exit(fehler ? 1 : 0);
