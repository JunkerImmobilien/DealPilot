// v2884 · Sperren mit Weg zur Quelle fuer die NI-Kreise, deren Sachwertfaktor-Kalkulatoren Eingaben verlangen,
// die DealPilot nicht fuehrt (GAG Aurich, GAG Lueneburg), und fuer die Samtgemeinde Harpstedt.
import * as PF from './pfade.mjs';
import { writeFileSync } from 'node:fs';
const ZIEL = PF.REGISTER + 'swf-ni-sperren-2026.json';
const NAV = (tm, wb) => `https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/Sachwertfaktor/${tm}/${wb}`;
const EF = 'einundzweifamilienhaeuser', RH = 'reihenhausdoppelhaushaelfte';
const S = (ags, ebene, gebiet, gaa, zweig, url, warum, beleg) => ({
  land_code: 'NI', ags, ebene, gebiet_name: gebiet, gaa_name: gaa, kennzahl: 'sachwertfaktor', zweig, objektart_bez: null, formel: null, korrekturen: [], modellansaetze: null, geltungsbereich: null,
  belege: [{ art: 'amtliche Veröffentlichung', fundstelle: beleg }], stufe: 'A', stufe_grund: null, fallzahl: null, streuung: null, stichtag: null, berichtsjahr: 2026, modellversion: null,
  quelle_url: url, quelle_parser: 'v2884-hand (Kalkulator-Sitzung, Parameterliste gelesen am 22.10.2026)', quellenvermerk: null, lizenz: 'kein Wert - Lizenz nicht einschlägig', fundstelle: beleg,
  auflagen: ['KEIN Nachbarkreis und kein Landesmittel.'], warum_kein_wert: warum, unvollstaendig_grund: warum, vollstaendig: false });
const out = [];
const AUR = 'Gutachterausschuss für Grundstückswerte Aurich';
const aurE = 'Der Ausschuss veröffentlicht den Sachwertfaktor für freistehende Ein- und Zweifamilienhäuser in Friesland und Ostfriesland als Kalkulator (2026_sw_efh_aurfest, Datenbasis 01.01.2026, frei abrufbar). Der Kalkulator hat KEIN Bodenrichtwert-Feld; er rechnet mit vorläufigem Sachwert, Standardstufe, zehn Lageklassen und drei Gebäudemerkmalen (Dachgeschoss ausgebaut [1,00/0,96], Unterkellerung [1,00/0,96], Flachdach [1,03/1,00]). Die Lageklassen sind teils ORTSTEIL-genau („Küste (Orte mit Tourismus)“ 1,20, „Emden (städtischer Bereich)“ 1,05 gegen „Emden (ländl. Bereich)“ 1,00, „Dornum (ohne Küste)“, „Krummhörn (ohne Greetsiel)“) — einer Anschrift lässt sich die Klasse ohne Ortsteilkarte nicht sicher zuordnen, und die drei Gebäudemerkmale erhebt DealPilot nicht. Ein Faktor mit geratener Lage oder unterstelltem Normobjekt sähe aus wie ein amtlicher. WEG ZUR QUELLE: Kalkulator unter dem Link, Lageklasse und Merkmale dort selbst wählen; den Faktor als eigene Angabe eintragen.';
const aurR = 'Der Reihenhaus-Kalkulator 2026_sw_rh_aurfest (Friesland und Ostfriesland, Datenbasis 01.01.2026) rechnet mit vorläufigem Sachwert, Bodenrichtwert, Standardstufe und drei Gebäudemerkmalen (Flachdach [1,05/1,00], Dachgeschoss ausgebaut [1,00/0,96], Unterkellerung [1,00/0,95]); diese Merkmale erhebt DealPilot nicht, und ein Faktor am unterstellten Normobjekt wäre bei einem unterkellerten Haus fünf Prozent zu hoch. WEG ZUR QUELLE: Kalkulator unter dem Link; den Faktor als eigene Angabe eintragen.';
for (const [ags, eb, name] of [['03452', 'kreis', 'Landkreis Aurich'], ['03455', 'kreis', 'Landkreis Friesland'], ['03457', 'kreis', 'Landkreis Leer'], ['03462', 'kreis', 'Landkreis Wittmund'], ['03402', 'kreis', 'Stadt Emden'], ['03405', 'kreis', 'Stadt Wilhelmshaven']]) {
  out.push(S(ags, eb, `${AUR}, Bereich ${name}`, AUR, 'ezfh', NAV(EF, '2026_sw_efh_aurfest'), aurE, 'Kalkulator 2026_sw_efh_aurfest (Tableau Public, Profil ogagmd2026), Parameter „Parameter LAGEKLNAME AURFEST EFH“ (10 Lageklassen), „Dage“, „Kgesun“, „Dach“; Blatt „Tooltip Normobjekttabelle“ (Lagewert ohne Einfluss, Regionsfaktor 1, Standardstufe 3)'));
  out.push(S(ags, eb, `${AUR}, Bereich ${name}`, AUR, 'rhdhh', NAV(RH, '2026_sw_rh_aurfest'), aurR, 'Kalkulator 2026_sw_rh_aurfest (Tableau Public, Profil ogagmd2026), Parameter „Dach“, „Dage“, „Kgesun“'));
}
const LG = 'Gutachterausschuss für Grundstückswerte Lüneburg';
const lgT = (wbE, wbR, extra) => `Der Ausschuss veröffentlicht den Sachwertfaktor als Kalkulator (${wbE}${wbR ? ', Reihenhäuser ' + wbR : ''}, Datenbasis 01.01.2026, frei abrufbar). Der Kalkulator hat KEIN Bodenrichtwert-Feld; er rechnet mit vorläufigem Sachwert, Wohnfläche, Restnutzungsdauer, Standardstufe, Grundstücksfläche, Bodenwertanteil${extra}. Mehrere dieser Eingaben führt DealPilot nicht; ohne sie rechnet der Kalkulator am Normobjekt, und ein so abgelesener Faktor sähe aus wie ein amtlicher. WEG ZUR QUELLE: Kalkulator unter dem Link; den Faktor als eigene Angabe eintragen.`;
for (const [ags, name, wbE, wbR, extra] of [
  ['03355', 'Landkreis Lüneburg', '2026_sw_efh_lglg', '2026_sw_rh_lglg', ', Entfernung zum Marktplatz von Lüneburg, Gebäudeart (EFH/ZFH), Erbbaurecht und Energieklasse'],
  ['03353', 'Landkreis Harburg', '2026_sw_efh_lgwl', '2026_sw_rh_lgwl', ', Gebäudeart, Bauweise (massiv/Fertighaus), Erbbaurecht und — beim Reihenhaus — Energieklasse; die Entfernung liest er aus einer Karte'],
  ['03360', 'Landkreis Uelzen', '2026_sw_efh_lgue', '2026_sw_rh_lguedan', ', Holzbauweise und eigenen Schaltern für Bienenbüttel und Ebstorf (Reihenhäuser gemeinsam mit Lüchow-Dannenberg, Schalter Bad Bodenteich)'],
  ['03354', 'Landkreis Lüchow-Dannenberg', '2026_sw_efh_lgdan', '2026_sw_rh_lguedan', ' und einer Lageklasse „Capo“ 0–10 ohne Ortsliste (Reihenhäuser gemeinsam mit Uelzen)'],
]) {
  const w = lgT(wbE, wbR, extra);
  out.push(S(ags, 'kreis', `${LG}, Bereich ${name}`, LG, 'ezfh', NAV(EF, wbE), w, `Kalkulator ${wbE} (Tableau Public, Profil ogagmd2026), Parameterliste der Sitzung`));
  out.push(S(ags, 'kreis', `${LG}, Bereich ${name}`, LG, 'rhdhh', NAV(RH, wbR), w, `Kalkulator ${wbR} (Tableau Public, Profil ogagmd2026), Parameterliste der Sitzung`));
}
out.push(S('03458', 'kreis', 'Gutachterausschuss für Grundstückswerte Oldenburg-Cloppenburg, Bereich Landkreis Oldenburg', 'Gutachterausschuss für Grundstückswerte Oldenburg-Cloppenburg', 'ezfh', NAV(EF, '2026_sw_efh_olclpdelollabra'),
  'Der Kalkulator 2026_sw_efh_olclpdelollabra führt den Gemeindekoeffizienten je Gemeinde; die Gemeinden des Landkreises Oldenburg stehen auf Gemeindeebene im Register (swf-ni-ol-2026.json). Die Auswahl nennt „Harpstedt [1,04]“, ohne zu sagen, ob der Flecken oder die Samtgemeinde gemeint ist: der Satz gilt deshalb nur für den Flecken Harpstedt, die übrigen Mitgliedsgemeinden der Samtgemeinde (Beckeln, Colnrade, Dünsen, Groß Ippener, Kirchseelte, Prinzhöfte, Winkelsett) bekommen keinen Faktor. WEG ZUR QUELLE: Kalkulator unter dem Link, Gemeinde dort wählen.',
  'Kalkulator 2026_sw_efh_olclpdelollabra, Auswahl „Gemeinde [Umrechnungskoeffizient]“ (18 Einträge)'));
console.log('Sperren', out.length);
if (process.argv.includes('--schreiben')) { writeFileSync(ZIEL, JSON.stringify(out, null, 1) + '\n'); console.log('geschrieben'); }
