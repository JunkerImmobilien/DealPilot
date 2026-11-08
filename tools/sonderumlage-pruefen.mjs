/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/sonderumlage-pruefen.mjs · v3211
   Backlog N100 (Nachtrag): Sonderumlagen aus WEG-Protokoll und
   Wirtschaftsplan anteilig und im Jahr ihrer Faelligkeit - auch in Raten.

   Laedt die ECHTEN Module:
     frontend/js/dokument-import.js  -> DokumentImport.sonderumlagenAus()
     frontend/js/sonderumlage.js     -> DpSonderumlage.uebernehmen()/jeJahr()
   und spielt die Kette Import -> Liste (#weg_su) -> Cashflow je Jahr
   (das liest calc.js) an erfundenen Faellen durch.

   Aufruf aus dem Repo-Wurzelverzeichnis:  node tools/sonderumlage-pruefen.mjs
   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
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

/* ── Formular-Felder als einfache Objekte; nur die, die die Module lesen ── */
const felder = {};
const feld = (id) => (felder[id] = felder[id] || { id, value: '', dispatchEvent() {} });
['weg_su', 'wirtschaftlicher_uebergang', 'kaufdat', 'objart', 'mea'].forEach(feld);

const sandbox = {
  console,
  document: {
    getElementById: (id) => felder[id] || null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, createElement: () => ({ style: {} }), body: { appendChild() {} }
  },
  Event: function () {},
  Auth: { apiCall: async () => ({}) }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const datei of ['frontend/js/dokument-import.js', 'frontend/js/sonderumlage.js']) {
  vm.runInContext(fs.readFileSync(path.join(WURZEL, datei), 'utf8'), sandbox, { filename: datei });
}
const DI = sandbox.DokumentImport, SU = sandbox.DpSonderumlage;
if (!DI || typeof DI.sonderumlagenAus !== 'function' || !SU || typeof SU.jeJahr !== 'function') {
  console.log('FEHL  Module nicht geladen (DokumentImport.sonderumlagenAus / DpSonderumlage.jeJahr)');
  process.exit(1);
}

const neu = (uebergang) => { felder.weg_su.value = ''; felder.wirtschaftlicher_uebergang.value = uebergang || ''; felder.kaufdat.value = ''; };
const posten = (l) => l.filter((x) => !x.hinweis);
const hinweise = (l) => l.filter((x) => x.hinweis);
const alleUebernehmen = (l) => posten(l).forEach((s) => SU.uebernehmen(JSON.parse(JSON.stringify(s))));
const jeJahr = () => JSON.parse(JSON.stringify(SU.jeJahr()));
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('Sonderumlage: Import -> Liste -> Cashflow je Jahr');

/* 1 · Einmalbetrag, Wohnung mit MEA 8,5 % (Protokoll, beschlossen) */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ versammlungsdatum: '12.05.2026', sonderumlagen_geplant: [
    { beschreibung: 'Sonderumlage für Fassade', betrag_eur: 40000, betrag_einheit_eur: null, jahr: 2027, faellig: '01.06.2027', raten: [], status: 'beschlossen' }
  ] }, 'weg_protokoll', { objart: 'ETW', mea: 8.5 });
  const p = posten(l);
  melde(p.length === 1 && p[0].betrag === 3400 && p[0].jahr === 2027 && p[0].faellig === '01.06.2027', '1 Einmalbetrag ETW: 40.000 x 8,5 % = 3.400 EUR, faellig 01.06.2027', l);
  melde(p[0] && p[0].zweck === 'Fassade', '1 Zweck ohne Vorsilbe "Sonderumlage fuer"', p[0] && p[0].zweck);
  alleUebernehmen(l);
  melde(gleich(jeJahr(), { 2027: 3400 }), '1 Cashflow: 3.400 EUR in 2027', jeJahr());
  /* v3213 · W-19: aus Gemeinschaft x MEA uebernommen -> Regler auf „gesamt", Gesamtbetrag gemerkt */
  const e0 = SU.liste()[0] || {};
  melde(e0.modus === 'gesamt' && e0.gesamt === 40000 && e0.betrag === 3400, '1 W-19: Eintrag merkt modus gesamt + 40.000 EUR, Anteil bleibt 3.400', e0);
}

/* 14 · v3213 W-19: Betrag der Wohnung direkt -> kein Regler „gesamt" */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ art: 'Wirtschaftsplan', jahr: 2026, sonderumlagen: [
    { zweck: 'Dach', betrag_gesamt_eur: 42000, betrag_einheit_eur: 4956, jahr: 2027, faellig: '' }] }, 'hausgeld', { objart: 'ETW', mea: 11.8 });
  alleUebernehmen(l);
  const e0 = SU.liste()[0] || {};
  melde(e0.betrag === 4956 && e0.modus === undefined, '14 W-19: Betrag der Wohnung laut Plan -> Anteil direkt (kein modus)', e0);
  melde(gleich(jeJahr(), { 2027: 4956 }), '14 W-19: Cashflow unveraendert 4.956 EUR in 2027', jeJahr());
}

/* 2 · Raten ueber zwei Jahre (MEA 10 %) */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Dach', betrag_eur: 30000, jahr: 2027, faellig: null, status: 'beschlossen', raten: [
      { faellig: '01.03.2027', betrag_gesamt_eur: 15000, betrag_einheit_eur: null },
      { faellig: '2028-03-01', betrag_gesamt_eur: 15000, betrag_einheit_eur: null }
    ] }
  ] }, 'weg_protokoll', { objart: 'ETW', mea: 10 });
  const p = posten(l);
  melde(p.length === 2, '2 zwei Raten -> zwei Eintraege', l);
  melde(p[0] && p[0].jahr === 2027 && p[0].betrag === 1500 && p[0].zweck === 'Dach · Rate 1/2', '2 Rate 1: 1.500 EUR 2027, Zweck "Dach · Rate 1/2"', p[0]);
  melde(p[1] && p[1].jahr === 2028 && p[1].betrag === 1500 && p[1].faellig === '01.03.2028', '2 Rate 2: 1.500 EUR 2028, ISO-Datum als TT.MM.JJJJ', p[1]);
  alleUebernehmen(l);
  melde(gleich(jeJahr(), { 2027: 1500, 2028: 1500 }), '2 Cashflow: je 1.500 EUR in 2027 und 2028', jeJahr());
}

/* 3 · Zwei gleich hohe Raten im selben Jahr - keine Dublette, Summe im Jahr */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Aufzug', betrag_eur: 20000, jahr: 2027, status: 'beschlossen', raten: [
      { faellig: '01.03.2027', betrag_gesamt_eur: 10000 }, { faellig: '01.09.2027', betrag_gesamt_eur: 10000 }
    ] }
  ] }, 'weg_protokoll', { objart: 'ETW', mea: 5 });
  alleUebernehmen(l);
  melde(SU.liste().length === 2, '3 zwei gleich hohe Raten 2027 stehen beide in der Liste', SU.liste());
  melde(gleich(jeJahr(), { 2027: 1000 }), '3 Cashflow: 500 + 500 = 1.000 EUR in 2027', jeJahr());
  alleUebernehmen(l);   /* dieselbe Unterlage noch einmal eingelesen */
  melde(SU.liste().length === 2, '3 erneutes Einlesen erzeugt keine Dubletten', SU.liste().length);
}

/* 4 · Rate vor dem wirtschaftlichen Uebergang -> Verkaeufer */
{
  neu('01.05.2027');
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Heizung', betrag_eur: 24000, jahr: 2027, status: 'beschlossen', raten: [
      { faellig: '01.03.2027', betrag_gesamt_eur: 12000 }, { faellig: '01.09.2027', betrag_gesamt_eur: 12000 }
    ] }
  ] }, 'weg_protokoll', { objart: 'ETW', mea: 10 });
  alleUebernehmen(l);
  const liste = SU.liste();
  melde(liste.length === 2 && SU._test.vorUebergang(liste[0]) === true && SU._test.vorUebergang(liste[1]) === false, '4 Rate 01.03. vor Uebergang 01.05. = Verkaeufer, Rate 01.09. = Kaeufer', liste);
  melde(gleich(jeJahr(), { 2027: 1200 }), '4 Cashflow: nur die zweite Rate, 1.200 EUR in 2027', jeJahr());
}

/* 5 · nur angekuendigt -> Hinweis, nichts zur Uebernahme */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Balkone', betrag_eur: 60000, jahr: 2028, status: 'angekuendigt', raten: [] }
  ] }, 'weg_protokoll', { objart: 'ETW', mea: 10 });
  melde(posten(l).length === 0 && hinweise(l).length === 1, '5 angekuendigt: kein Posten, ein Hinweis', l);
  melde(/nur angekündigt/.test((hinweise(l)[0] || {}).hinweis || '') && /6\.000 €/.test((hinweise(l)[0] || {}).hinweis || ''), '5 Hinweis nennt "nur angekuendigt" und den Anteil 6.000 EUR', hinweise(l)[0]);
}

/* 6 · ganzes Haus -> Betrag der Gemeinschaft */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Flachdach', betrag_eur: 42000, betrag_einheit_eur: 4956, jahr: 2027, faellig: '01.10.2027', status: 'beschlossen', raten: [] }
  ] }, 'weg_protokoll', { objart: 'MFH', mea: 0 });
  const p = posten(l);
  melde(p.length === 1 && p[0].betrag === 42000 && /ganzes Haus/.test(p[0].wie), '6 Haus ganz: 42.000 EUR (nicht der Betrag einer Wohnung)', p);
}

/* 7 · Summe der Raten weicht vom Gesamtbetrag ab -> Hinweis statt Rechnung */
{
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Fenster', betrag_eur: 30000, jahr: 2027, status: 'beschlossen', raten: [
      { faellig: '01.03.2027', betrag_gesamt_eur: 10000 }, { faellig: '01.03.2028', betrag_gesamt_eur: 10000 }
    ] }
  ] }, 'weg_protokoll', { objart: 'ETW', mea: 10 });
  melde(posten(l).length === 0 && /ergeben 20\.000 €/.test((hinweise(l)[0] || {}).hinweis || ''), '7 Raten 20.000 gegen Gesamt 30.000: Hinweis, kein Posten', l);
}

/* 8 · Rundung: drei gleiche Raten 10.000 / 3 gelten als passend */
{
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [
    { beschreibung: 'Leitungen', betrag_eur: 10000, jahr: 2027, status: 'beschlossen', raten: [
      { jahr: 2027, betrag_gesamt_eur: 3333.33 }, { jahr: 2028, betrag_gesamt_eur: 3333.33 }, { jahr: 2029, betrag_gesamt_eur: 3333.33 }
    ] }
  ] }, 'weg_protokoll', { objart: 'MFH' });
  const p = posten(l);
  melde(p.length === 3 && p.map((x) => x.jahr).join() === '2027,2028,2029' && p[2].zweck === 'Leitungen · Rate 3/3', '8 drei Raten ohne Tag, nur Jahr: 2027/2028/2029', l);
}

/* 9 · Altformat (gespeicherte Auswertung vor v3211): ohne Status, ohne Raten */
{
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [{ beschreibung: 'Sonderumlage Treppenhaus', betrag_eur: 8000, jahr: 2027 }] }, 'weg_protokoll', { objart: 'ETW', mea: 12.5 });
  const p = posten(l);
  melde(p.length === 1 && p[0].betrag === 1000 && p[0].jahr === 2027 && p[0].faellig === '', '9 Altformat: 8.000 x 12,5 % = 1.000 EUR 2027, weiter angeboten', l);
}

/* 10 · Wohnung ohne MEA -> Hinweis */
{
  const l = DI.sonderumlagenAus({ sonderumlagen_geplant: [{ beschreibung: 'Dach', betrag_eur: 30000, jahr: 2027, status: 'beschlossen', raten: [
    { faellig: '01.03.2027', betrag_gesamt_eur: 15000 }, { faellig: '01.03.2028', betrag_gesamt_eur: 15000 }] }] }, 'weg_protokoll', { objart: 'ETW', mea: 0 });
  melde(posten(l).length === 0 && /Miteigentumsanteil/.test((hinweise(l)[0] || {}).hinweis || ''), '10 Raten, Wohnung ohne MEA: Hinweis, kein Posten', l);
}

/* 11 · Wirtschaftsplan (hausgeld) mit Raten und Betrag der Wohnung je Rate */
{
  neu('01.01.2027');
  const l = DI.sonderumlagenAus({ art: 'Wirtschaftsplan', jahr: 2027, sonderumlagen: [
    { zweck: 'Tiefgarage', betrag_gesamt_eur: 50000, betrag_einheit_eur: 2400, jahr: 2027, faellig: null, raten: [
      { faellig: '15.02.2027', betrag_gesamt_eur: 25000, betrag_einheit_eur: 1200 },
      { faellig: '15.02.2028', betrag_gesamt_eur: 25000, betrag_einheit_eur: 1200 }] }
  ] }, 'hausgeld', { objart: 'ETW', mea: 4 });
  const p = posten(l);
  melde(p.length === 2 && p[0].betrag === 1200 && p[1].jahr === 2028 && /Betrag der Wohnung/.test(p[0].wie), '11 Plan: Betrag der Wohnung je Rate gewinnt vor MEA (1.200 / 1.200)', l);
  alleUebernehmen(l);
  melde(gleich(jeJahr(), { 2027: 1200, 2028: 1200 }), '11 Cashflow: 1.200 EUR in 2027 und 2028', jeJahr());
}

/* 12 · Rate ohne eigenen Wohnungsbetrag, Wohnungsbetrag der Umlage bekannt, kein MEA -> anteilig */
{
  const l = DI.sonderumlagenAus({ art: 'Wirtschaftsplan', jahr: 2027, sonderumlagen: [
    { zweck: 'Fassade', betrag_gesamt_eur: 40000, betrag_einheit_eur: 3000, jahr: 2027, raten: [
      { faellig: '01.04.2027', betrag_gesamt_eur: 30000 }, { faellig: '01.04.2028', betrag_gesamt_eur: 10000 }] }
  ] }, 'hausgeld', { objart: 'ETW', mea: 0 });
  const p = posten(l);
  melde(p.length === 2 && p[0].betrag === 2250 && p[1].betrag === 750, '12 Wohnungsbetrag 3.000 anteilig auf Raten 30.000/10.000 = 2.250 / 750', l);
}

/* 13 · Plan-Einmalbetrag: Jahr aus dem Faelligkeitstag, nicht aus dem Planjahr */
{
  const l = DI.sonderumlagenAus({ art: 'Wirtschaftsplan', jahr: 2026, sonderumlagen: [
    { zweck: 'Dach', betrag_gesamt_eur: 42000, betrag_einheit_eur: 4956, jahr: null, faellig: '2027-01-15' }] }, 'hausgeld', { objart: 'ETW', mea: 11.8 });
  const p = posten(l);
  melde(p.length === 1 && p[0].jahr === 2027 && p[0].betrag === 4956 && p[0].faellig === '15.01.2027', '13 Plan 2026, faellig 15.01.2027 -> Jahr 2027, 4.956 EUR', l);
}

console.log((fehler ? 'ROT' : 'GRUEN') + ': ' + (geprueft - fehler) + ' von ' + geprueft + ' Pruefpunkten' + (fehler ? ', ' + fehler + ' Fehler' : ''));
process.exit(fehler ? 1 : 0);
