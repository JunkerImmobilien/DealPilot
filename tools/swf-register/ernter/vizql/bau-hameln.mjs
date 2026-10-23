// v2888 · Hameln und Bad Pyrmont: Lage "Hameln" bzw. "Bad Pyrmont" nur fuer die Kernstadt-Gemarkung,
// Ortschaften gesperrt. Dazu: 17 RH-Saetze in swf-ni.json verlinkten den EFH-Kalkulator.
//
// BEFUND (23.10.2026): Der Kalkulator 2026_sw_efh_hmhhm fuehrt die Lagen "Hameln" 1,00, "Bad Pyrmont" 0,88,
// "Kleinstaedte" 0,88 und "Doerfer" 0,84 (Blatt "tabweiterelage"). Ob die Ortschaften der Stadt Hameln
// (Afferde, Tuendern, Klein Berkel, ...) als "Hameln" oder als "Doerfer" gelten, sagt weder der Kalkulator
// (alle Blaetter gelesen: Dash, Titel, Button, Berechnung, Diabeschreibung, Tooltip Normobjekttabelle,
// tabweiterelage) noch die verlinkte Modellbeschreibung (hmh_2026_sw_modellbeschreibung.pdf, 5 Seiten).
// Bis v2887 galt der Satz "Hameln" fuer die ganze Stadt - in einem Dorf bis zu 16 Prozent zu hoch.
//
// KONSERVATIV: Wert nur in der Gemarkung, die den Namen der Lage traegt (Hameln 034960, Pyrmont 035803).
// Die uebrigen Gemarkungen der beiden Staedte bekommen eine Sperre mit Weg. Die Gemarkungen stammen aus
// BORIS-D (WMS wms_de_bodenrichtwerte, Felder Gemarkungsnummer/Gemarkungsname, Rasterabfrage ueber das
// Stadtgebiet am 23.10.2026) - derselbe Dienst, aus dem der Bericht die Gemarkung zur Anschrift liest.
// Eine Gemarkung, die hier fehlt, bekommt "lage_noetig": kein Wert, kein Rueckfall.
//
// Aufruf: node bau-hameln.mjs [--schreiben]
import * as PF from './pfade.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const NI = PF.REGISTER + 'swf-ni.json';
const roh = readFileSync(NI, 'utf8');
const reg = JSON.parse(roh);
const fehler = []; const log = [];
const clone = (o) => JSON.parse(JSON.stringify(o));
const EFH_URL = 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/einundzweifamilienhaeuser/2026_sw_efh_hmhhm';
const QUELLE_GEM = 'BORIS-D, WMS https://www.wms.nrw.de/boris/wms_de_bodenrichtwerte (GetFeatureInfo, Felder „Gemarkungsnummer“ und „Gemarkungsname“), Rasterabfrage über das Stadtgebiet im Abstand von rund 650 m am 23.10.2026';

const STAEDTE = [
  { ags: '03252006', name: 'Hameln, Stadt', lage: 'Hameln', kern: ['034960', 'Hameln'], rest_lage: 'Ortschaften der Stadt Hameln',
    rest: [['034738', 'Haverbeck'], ['034739', 'Wehrbergen'], ['034740', 'Halvestorf'], ['034956', 'Welliehausen'], ['034957', 'Holtensen'], ['034958', 'Unsen'], ['034959', 'Groß Hilligsfeld'], ['034961', 'Rohrsen Hn'], ['034962', 'Klein Hilligsfeld'], ['034963', 'Afferde'], ['034964', 'Klein Berkel'], ['034965', 'Hastenbeck'], ['034966', 'Tündern']],
    spanne: 'Hameln 1,00 gegen Dörfer 0,84 — bis zu 16 Prozent' },
  { ags: '03252003', name: 'Bad Pyrmont, Stadt', lage: 'Bad Pyrmont', kern: ['035803', 'Pyrmont'], rest_lage: 'Ortsteile der Stadt Bad Pyrmont',
    rest: [['035801', 'Hagen'], ['035802', 'Holzhausen'], ['035804', 'Oesdorf'], ['035805', 'Löwensen'], ['035806', 'Thal'], ['035807', 'Kleinenberg'], ['035808', 'Großenberg'], ['035809', 'Eichenborn'], ['035810', 'Baarsen'], ['035901', 'Neersen']],
    spanne: 'Bad Pyrmont 0,88 gegen Dörfer 0,84 — rund 5 Prozent' },
];
for (const S of STAEDTE) {
  const i = reg.findIndex((s) => s.ags === S.ags && s.zweig === 'ezfh' && s.kennzahl === 'sachwertfaktor' && s.vollstaendig !== false);
  if (i < 0) { fehler.push(S.ags + ': EZFH-Satz fehlt'); continue; }
  if (reg.some((s) => s.ags === S.ags && s.zweig === 'ezfh' && (s.geltungsbereich || {}).lage)) { fehler.push(S.ags + ': schon umgebaut'); continue; }
  const alt = reg[i];
  if (alt.geltungsbereich.lage_dokument !== S.lage) fehler.push(`${S.ags}: Lage ${alt.geltungsbereich.lage_dokument} != ${S.lage}`);
  const tabelle = [{ gemarkung: S.kern[1], gemarkungsnr: S.kern[0], lageklasse: S.lage }, ...S.rest.map(([nr, g]) => ({ gemarkung: g, gemarkungsnr: nr, lageklasse: S.rest_lage }))];
  const zuordnung = { art: 'gemarkung', quelle: QUELLE_GEM, tabelle,
    hinweis: `Der Kalkulator nennt die Lage „${S.lage}“, ohne zu sagen, ob die Ortschaften der Stadt dazugehören oder als „Dörfer“ gelten. Zugeordnet ist deshalb nur die Gemarkung, die den Namen trägt (${S.kern[1]}, ${S.kern[0]}); ${S.rest.length} weitere Gemarkungen der Stadt sind als „${S.rest_lage}“ gesperrt. Eine Gemarkung, die hier nicht steht, bekommt keinen Faktor.` };
  const wert = clone(alt);
  wert.geltungsbereich = { ...alt.geltungsbereich, lage: S.lage, zuordnung, hinweis: (alt.geltungsbereich.hinweis || '') + ` v2888: gilt nur noch in der Gemarkung ${S.kern[1]}.` };
  wert.quelle_parser = (alt.quelle_parser || '') + '+v2888-gemarkung';
  wert.auflagen = (typeof alt.auflagen === 'string' ? alt.auflagen + ' ' : '') + `Gilt nur in der Gemarkung ${S.kern[1]} (${S.kern[0]}); für die übrigen Gemarkungen der Stadt ist der Faktor gesperrt.`;
  const warum = `Der Kalkulator 2026_sw_efh_hmhhm (Gutachterausschuss Hameln-Hannover, freistehende Ein- und Zweifamilienhäuser, Landkreis Hameln-Pyrmont, frei abrufbar) staffelt den Sachwertfaktor nach den Lagen „Hameln“ 1,00, „Bad Pyrmont“ 0,88, „Kleinstädte“ 0,88 und „Dörfer“ 0,84 (Blatt „Umrechnungskoeffizienten für abweichende Lagen“). Ob die ${S.rest_lage} (Gemarkungen ${S.rest.map((r) => r[1]).join(', ')}) zur Lage „${S.lage}“ oder zu „Dörfer“ gehören, sagen weder der Kalkulator noch seine Modellbeschreibung; der Unterschied beträgt ${S.spanne}. Für die Gemarkung ${S.kern[1]} steht ein Wert. WEG ZUR QUELLE: Kalkulator unter dem Link, Lage dort selbst wählen; den Faktor als eigene Angabe eintragen.`;
  const sperre = { land_code: 'NI', ags: S.ags, ebene: 'gemeinde', gebiet_name: alt.gebiet_name + ', ' + S.rest_lage, gaa_name: alt.gaa_name, kennzahl: 'sachwertfaktor', zweig: 'ezfh', objektart_bez: null, formel: null, korrekturen: [], modellansaetze: null,
    geltungsbereich: { lage: S.rest_lage, zuordnung, raeumlich: S.name },
    belege: [{ art: 'amtliche Veröffentlichung', fundstelle: `Kalkulator 2026_sw_efh_hmhhm (Tableau Public, Profil ogagmd2026), Parameter „Lage“ [Hameln, Bad Pyrmont, Kleinstädte, Dörfer], Blatt „tabweiterelage“; Modellbeschreibung https://www.gag.niedersachsen.de/download/225531/hmh_2026_sw_modellbeschreibung.pdf (ohne Ortsliste); gelesen 23.10.2026` }],
    stufe: 'A', stufe_grund: null, fallzahl: null, streuung: null, stichtag: null, berichtsjahr: 2026, modellversion: null,
    quelle_url: EFH_URL + '#lage=' + encodeURIComponent(S.rest_lage), quelle_parser: 'v2888-hand', quellenvermerk: null, lizenz: 'kein Wert - Lizenz nicht einschlägig',
    fundstelle: 'Kalkulator 2026_sw_efh_hmhhm, Blatt „tabweiterelage“', auflagen: ['KEIN Nachbarkreis und kein Landesmittel.'], zugang: 'kostenfrei', warum_kein_wert: warum, unvollstaendig_grund: warum, vollstaendig: false };
  reg.splice(i, 1, wert, sperre);
  log.push(`${S.ags}: EZFH „${S.lage}“ nur Gemarkung ${S.kern[1]}; Sperre „${S.rest_lage}“ (${S.rest.length} Gemarkungen)`);
}

// RH-Saetze mit dem Link auf den EFH-Kalkulator (Absprung fuehrte zur falschen Objektart)
let url = 0;
for (const s of reg) {
  if (s.kennzahl !== 'sachwertfaktor' || s.zweig !== 'rhdhh') continue;
  const m = /^https:\/\/public\.tableau\.com\/views\/2026_sw_efh_([a-z_]+)\/dash(#.*)?$/i.exec(s.quelle_url || '');
  if (!m) continue;
  const rh = '2026_sw_rh_' + m[1];
  if (!JSON.stringify(s.belege).includes(rh)) { fehler.push(`${s.ags}: Beleg nennt ${rh} nicht`); continue; }
  s.quelle_url = 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/reihenhausdoppelhaushaelfte/' + rh + (m[2] || '');
  s.quelle_parser = (s.quelle_parser || '') + '+v2888-url';
  url++;
}
log.push(`RH-Sätze mit EFH-Link berichtigt: ${url}`);
if (url !== 17) fehler.push('RH-Links: ' + url + ' statt 17');
console.log(log.join('\n')); console.log('Sätze', reg.length, 'Fehler', fehler.length); fehler.forEach((f) => console.log('  F ' + f));
if (process.argv.includes('--schreiben') && !fehler.length) {
  let t = JSON.stringify(reg, null, 2); if (roh.includes('\r\n')) t = t.replace(/\n/g, '\r\n'); if (/\r?\n$/.test(roh)) t += roh.endsWith('\r\n') ? '\r\n' : '\n';
  writeFileSync(NI, t); console.log('geschrieben swf-ni.json');
}
