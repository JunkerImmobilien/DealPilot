// ausschuss_register.js  (v1083-WREG)
//
// DAS REGISTER — datengetrieben statt ein JS-Modul je Kreis.
//
// WARUM IM SPEICHER UND NICHT PER DB-ABFRAGE:
// CrossCheckService.compute() ist SYNCHRON. holeModelle() aus dem
// param-repository ist async. Den Aufloeser auf einen DB-Lesevorgang
// umzustellen wuerde compute() async machen und damit die ganze Aufrufkette.
// Das Register ist klein (unter 600 Saetze) — es wird einmal geladen und
// danach synchron abgefragt.
//
// WOHER DIE DATEN KOMMEN, in dieser Reihenfolge:
//   1. die versionierte Saatdatei im Repo  (immer vorhanden)
//   2. mb.param_modell, falls befuellt      (ueberschreibt die Saat)
// Damit laeuft das Feature auch, BEVOR die Tabelle befuellt ist. Ein
// vergessener Saatlauf fuehrt nicht zu einem stillen "kein Ausschuss
// hinterlegt" — das waere ein stiller Rueckfall, und die sind schlimmer
// als ein Fehler.
//
// DIE ZUSTAENDIGKEIT LAEUFT UEBER DIE KASKADE, NICHT UEBER FUENF STELLEN.
// Gemessen an schluessel.csv der Grundstuecksmarktdaten NRW: 14 Kreise
// tragen mehr als einen Gutachterausschuss. Der Kreis Wesel hat vier
// (Kreis, Dinslaken, Moers, Wesel), der Maerkische Kreis drei (Kreis,
// Iserlohn, Luedenscheid). Ein Vergleich auf den fuenfstelligen
// Kreisschluessel kann sie nicht auseinanderhalten — ein Registereintrag
// fuer Luedenscheid haette dort still den Maerkischen Kreis getroffen.
// Genau so ist in v1060 ein Vergleichsfaktor aus Minden-Luebbecke in einen
// Bericht fuer Hiddenhausen geraten.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));

/** AGS von fein nach grob: 8 -> 5 -> 3 -> 2. Dieselbe Reihenfolge wie
 *  kaskadeSchluessel() im param-repository — bewusst identisch. */
export function kaskadeSchluessel(ags) {
  const t = String(ags || '').replace(/\D/g, '');
  const stufen = [];
  for (const n of [8, 5, 3, 2]) if (t.length >= n) stufen.push(t.slice(0, n));
  return [...new Set(stufen)];
}

/* ── Zustand ───────────────────────────────────────────────────────────── */

/** Map: `${kennzahl}|${ags}` -> Array von Saetzen */
let _index = new Map();
let _herkunft = 'leer';
let _stand = null;

/* v1084a-WMRG · Die Saat wird als Liste behalten, nicht nur als Index.
 * Ohne sie liesse sich nach einem DB-Lauf nicht mehr sagen, welche Saetze
 * aus der Datei kamen — und genau das braucht die Zusammenfuehrung. */
let _saat = [];

/** Zaehlung je Kennzahl. Die einzige Zahl, an der man von aussen sieht, ob
 *  beide Kennzahlen im Register stehen. Sie gehoert deshalb ins Startlog. */
function jeKennzahl(saetze) {
  const n = {};
  for (const s of saetze) n[s.kennzahl] = (n[s.kennzahl] || 0) + 1;
  return n;
}

function schluessel(kennzahl, ags) { return `${kennzahl}|${ags}`; }

function indizieren(saetze) {
  const ix = new Map();
  for (const s of saetze) {
    if (!s || !s.ags || !s.kennzahl) continue;
    const k = schluessel(s.kennzahl, s.ags);
    if (!ix.has(k)) ix.set(k, []);
    ix.get(k).push(s);
  }
  // Juengster Jahrgang zuerst — bei zwei Jahrgaengen gewinnt der neuere.
  for (const liste of ix.values()) {
    liste.sort((a, b) => (b.berichtsjahr || 0) - (a.berichtsjahr || 0));
  }
  /* v3008 · EIN WERT, DER EINE SPERRE AUSDRUECKLICH ABLOEST.
     Konstanz ETW stand als Sperre (merkmal_fehlt) in vgf-bw-2026.json; seit die
     Leseroutine Wohnlage und Ausstattung kennt, traegt vgf-bw-konstanz-2026.json
     denselben Schluessel (ags, zweig, Jahrgang) als Wert. Bei gleichem Jahrgang
     entschied bisher die Ladereihenfolge - die Sperre lag vorn. Jetzt nur, wenn der
     Wertsatz es SAGT (ersetzt_sperre: true): Sperren desselben Zweigs, Jahrgangs
     und derselben Lage fallen aus dem Index. Ohne das Feld bleibt alles wie es war. */
  const _sperre = (s) => s.vollstaendig === false || !!s.warum_kein_wert;
  const _gl = (s) => [String(s.zweig || '').toLowerCase(), s.berichtsjahr ?? '', String(((s.geltungsbereich || {}).lage) || '').toLowerCase()].join('|');
  for (const [k, liste] of ix) {
    const abl = new Set(liste.filter((s) => s.ersetzt_sperre === true && !_sperre(s)).map(_gl));
    if (abl.size) ix.set(k, liste.filter((s) => !(_sperre(s) && abl.has(_gl(s)))));
  }
  return ix;
}

/* ── Laden ─────────────────────────────────────────────────────────────── */

/** Saatdatei aus dem Repo. Fehlt sie, bleibt das Register leer — aber laut. */
/* v1084-WSAAT · Eine Saatdatei je Kennzahl.
 *
 * Bis v1083 gab es genau eine Datei. Mit den Sachwertfaktoren kaeme eine
 * zweite dazu — und die Versuchung waere, sie an dieselbe Stelle zu haengen.
 * Das ginge einmal gut: beide Kennzahlen teilen sich den Index-Schluessel
 * `kennzahl|ags`, und ein zweites JSON.parse() auf dieselbe Variable haette
 * die erste Datei still ueberschrieben.
 *
 * Deshalb wird GESAMMELT und einmal indiziert. Fehlt eine Datei, laedt die
 * andere trotzdem — aber die Luecke wird gemeldet, nicht verschwiegen. */
/* ═══ v1778 · DIE HANDLISTE WAR ZEHN DATEIEN HINTERHER ═══════════════

   Gemessen am 02.10.2026:

     in SAATDATEIEN          24 Dateien
     im Ordner register/     40 (davon 6 Wegweiser ohne Werte)
     NICHT in der Liste      10 Dateien mit zusammen 89 Saetzen

   Betroffen war die gesamte Ernte vom 01. und 02.10.2026: dresden,
   erfurt, hamburg, leipzig, lzs-bb, lzs-be-2025, lzs-bw, lzs-rp,
   lzs-sh, schwerin.

   DAS IST KEIN NEBENWEG. `gutachterausschuss.js` importiert aus dieser
   Datei, `CrossCheckService` nutzt `gutachterausschuss.js` — der
   Rechenweg zum KUNDENBERICHT laeuft hier entlang. Die Saetze standen
   in `mb.param_modell` (dort liest `register-saat.mjs` hinein) und
   erreichten trotzdem keinen einzigen Bericht.

   > Eine Ernte, die das Repo nicht verlaesst, ist keine Ernte. Eine,
   > die die Datenbank erreicht und den Rechenweg nicht, ist auch keine.

   Der Abgleich unten (`fehlendeSaatdateien`) sorgt dafuer, dass die
   Luecke beim naechsten Mal AUFFAELLT, statt still zu bleiben. */
export const SAATDATEIEN = ['lzs-nrw.json', 'swf-nrw.json', 'lzs-he-2026.json', /* v1880: Hessen regional, 14 Berichte */ 'swf-nw-2026-block2.json', /* v1880b: NRW Sachwertfaktoren Block 2, 19 Ausschuesse */ 'lzs-st-th-sh-ni-2025.json', /* v1880d: Zinssaetze ST/TH/SH/NI */ 'swf-nw-2026-block3.json', /* v1882: NRW Sachwertfaktoren Block 3, 17 Ausschuesse */ 'swf-nw-he-2026-block4.json', /* v1882: NRW-Kreise Block 4 + Kassel 2026 */ 'swf-nw-2026-block5.json', /* v1884: NRW Rest - Remscheid, Arnsberg, Bergisch Gladbach, Dueren, Lippstadt, Luedenscheid, Ratingen, Velbert, Wesel */ 'lzs-be-bb-hh-hb-2026.json', /* v1884: Zinssaetze Brandenburg regional (15 Ausschuesse), Berlin/Bremen Sperren */ 'swf-be-bb-hh-hb-2026.json', /* v1884: Sachwertfaktor-Sperren BE/HB/SPN/OSL */
                            /* v1885 (Linie 7): Sachsen-Anhalt Landkreise - 45
                               Zinssaetze fuer Mehrfamilienhaeuser aus dem Blatt des
                               EINEN Landes-Gutachterausschusses (23 ortsscharfe
                               Mittelzentren plus Grundzentrum und Dorf je Landkreis),
                               Erfurt Eigentumswohnung 2025 (loest die Sperre we_v),
                               23 ST-Sperren (neun Orte mit Spanne statt Zahl, 14x
                               Eigentumswohnung ohne Wertblatt) und 33 Sperren fuer
                               Sachsen - dort ist JEDER Bericht genehmigungspflichtig. */
                            'lzs-th-st-sn-mv-2026.json',
                            /* v1885 (Linie 7): Sachwertfaktor Ludwigslust-Parchim
                               Jahrgang 2025 (Reihenhaus/Doppelhaushaelfte - der Zweig
                               ezfh ist ZURUECKGEHALTEN, weil swf-mv.json dort noch den
                               Jahrgang 2018 fuehrt und zwei Saetze zum selben Zweig
                               ohne Lage eine Rueckfrage statt eines Wertes ergeben)
                               plus 11 Sachwertfaktor-Sperren fuer Sachsen. */
                            'swf-th-st-sn-mv-2026.json',
                            /* v1885 (Linie 8): Niedersachsen-Rest, Schleswig-Holstein-
                               Rest, Rheinland-Pfalz, Saarland.
                               ZINS: zwoelf Werte, die die erste NI-Ernte uebersprang
                               (Reihenhaus/Doppelhaushaelfte Region Hannover und die
                               drei Landkreise Hameln-Pyrmont/Hildesheim/Schaumburg —
                               Kapitel 7.1 wertet beide Objektarten in EINER Stichprobe
                               aus; Altenpflegeheime 2,3 % und Seniorenresidenzen 2,9 %
                               des GAG Sulingen-Verden mit GND 50, nicht 80), dazu zehn
                               NI-Sperren und 41 Sperren fuer RP und SL.
                               SACHWERTFAKTOR: Wochenendhaeuser Sulingen-Verden 0,86
                               (ohne Duemmer See) plus 53 Sperren — zwoelf fuer die
                               SH-Ausschuesse, die kein Faktorenblatt fuehren, 35 fuer
                               Rheinland-Pfalz (Kapitel 4 des LGMB 2025 ist
                               kostenpflichtig UND genehmigungspflichtig) und sechs fuer
                               das Saarland, das bis dahin ueberhaupt nicht im Register
                               stand. */
                            'lzs-nrw-gmb-2025.json',
                            'berlin.json',           /* v1085 */
                            'lzs-nrw-2023.json',     /* v1086 · Zeitreihe */
                            'bodenpreise-nrw.json',  /* v1086 · Flaeche */
                            'marktdaten-nrw.json',   /* v1087 · Marktdaten */
                            'ost.json',              /* v1088 · ST, TH */
                            'sued-nord.json',        /* v1089 · BY, NI */
                            'nord2.json',            /* v1090 · NI */
                            'laender2.json',         /* v1093 · BB, HE, NI, NRW */
                            'laender3.json',        /* v1094 · BB, HE, NI */
                            /* v1339: Erbbaurechtskoeffizienten Braunschweig-Wolfsburg.
                               MARKTABGELEITET - wo sie vorliegen, gehen sie dem
                               finanzmathematischen Wert nach Paragraf 50 ImmoWertV vor. */
                            'erbbau-bs-wob.json',
                            /* v1098: Sachwertfaktoren Hamburg. EIGENE Datei, weil
                               `swf-nrw.json` sonst ein zweites Bundesland unter
                               falschem Namen truege. `rezept2register.py` schreibt
                               seit v1098 je Land eine Datei und nennt sie am Ende
                               seines Laufs - jede davon gehoert hierher. */
                            'swf-hh.json',
                            /* v1098d: Sachwertfaktoren Kassel (Hessen), Jahrgang 2024.
                               dl-de/zero-2-0 - der Bericht sagt woertlich "ohne
                               Einschraenkung oder Bedingung". */
                            'swf-he.json',
                            /* v1098g: Sachwertfaktoren Landkreis Wolfenbüttel.
                               Niedersachsen fuehrt seine Faktoren als Tableau-
                               Kalkulator, nicht als Tabelle im PDF — die Werte
                               sind einzeln am Kalkulator abgefragt. dl-de/by-2-0,
                               Quellenvermerk ist Pflicht. */
                            'swf-ni.json',
                            /* v1098i: Sachwertfaktoren Mainz. Erster Satz aus
                               Rheinland-Pfalz. Der Bericht druckt die Funktion
                               ab UND ein Anwendungsbeispiel — beides
                               nachgerechnet, beides zeichengleich. */
                            'swf-rp.json',
                            /* v1098j: Ludwigslust-Parchim. verwendung: gutachten -
                               auszugsweise Wiedergabe ist gestattet, verlangt aber
                               Quellenangabe UND ein Belegexemplar. Im Kundenbericht
                               steht bis zur Klaerung nur der Link. */
                            'swf-mv.json',
                            /* v1100: Brandenburg - Potsdam (zwei Konstanten) und
                               Oberhavel (Matrix nach Region PLUS BGF-Korrektur je
                               Region, beide laut Bericht gleichzeitig anzuwenden). */
                            'swf-bb.json',
                            /* v1110: Sachsen-Anhalt. Der Gutachterausschuss dort
                               fuehrt keine Tabellen, sondern multiple
                               Regressionsfunktionen - je Region und
                               Baujahresklasse eine eigene. */
                            'swf-st.json',
                            /* v1114: Sachsen. Leipzig fuehrt VIER Gebaeudetypen
                               getrennt - freistehend, Doppelhaushaelfte,
                               Reihenend- und Reihenmittelhaus. */
                            'swf-sn.json',
                            /* v1117: Berlin. Der Satz aus v1085 ordnete ueber
                               ALTBEZIRKE zu und fand sein Feld nie - jetzt
                               laeuft die Zuordnung ueber den Ortsteil, mit der
                               amtlichen Tabelle des Ausschusses. */
                            'swf-be.json',
                            /* v1118: Schleswig-Holstein. Drei Ausschuesse mit
                               Bodenrichtwertklassen als Kurvenschar - Luebeck,
                               Herzogtum Lauenburg, Ostholstein. */
                            'swf-sh.json',
                            /* v1145: THUERINGEN - die erste neue Saatdatei seit
                               v1118. Das TLBG veroeffentlicht die Faktoren als
                               eigene PDF-Blaetter je Ausschuss, nicht im
                               Marktbericht. Eichsfeld/Unstrut-Hainich fuehrt
                               VIER Objektarten getrennt, darunter
                               Reihenmittelhaeuser mit einer viel steileren
                               Kurve als Doppelhaushaelften.

                               WER HIER EINE DATEI ERGAENZT, MUSS SIE AUCH HIER
                               EINTRAGEN. Der Registerbau erzeugt out/swf-th.json
                               klaglos, der Auswerter laedt aber nur, was in
                               dieser Liste steht - genau daran scheiterte
                               Berlin in v1085 mit fuenfzehn Fehltreffern. */
                            'swf-th.json',
                            /* v1160: Baden-Wuerttemberg, Heilbronn. ERSTER Satz
                               aus BW - und die Datei gehoert von Anfang an hier
                               herein, nicht erst wenn jemand merkt, dass nichts
                               rechnet. Das ist die Berlin-Falle aus v1085: der
                               Registerbau schreibt swf-<land>.json fuer JEDES
                               Land, das ein Rezept hat, aber geladen wird nur,
                               was in dieser Liste steht. Eine fehlende Zeile
                               sieht aus wie "kein Ausschuss hinterlegt" und ist
                               keine. */
                            'swf-bw.json',
                            /* ═══ v1778 · die Ernte vom 01./02.10.2026 ═══
                               Zehn Dateien, 89 Saetze, die hier fehlten.
                               Reihenfolge wie im Ordner. */
                            'dresden.json',       /* SN · 6 */
                            'erfurt.json',        /* TH · 1 */
                            'hamburg.json',       /* HH · 6 */
                            'leipzig.json',       /* SN · 18 */
                            'lzs-bb.json',        /* BB · 14 */
                            'lzs-be-2025.json',   /* BE · 6 */
                            'lzs-bw.json',        /* BW · 13 (Heilbronn, Ulm) */
                            'lzs-rp.json',        /* RP · 6 (Mainz) */
                            'lzs-sh.json',        /* SH · 12 */
                            'schwerin.json',      /* MV · 7 */
                            /* v1820 · Ludwigslust-Parchim. Die Sperre im Backlog war
                               falsch: das Zitat vom 13.09.2026 endete mitten im Satz,
                               vor den Worten "ist ohne Genehmigung gestattet". Am
                               Originalimpressum nachgelesen - erlaubt, wortgleich mit
                               Schwerin (gemeinsame Geschaeftsstelle). */
                            'ludwigslust-parchim.json', /* MV · 7 */
                            /* v1888 (Linie 9): Ferienwohnen des GAG Aurich auf
                               GEMEINDEEBENE. 14 Werte (Ferienwohnungen 1,0 % und
                               Apartmenthaeuser/Pensionen 3,2 %, je sieben
                               Inselgemeinden) und 56 Sperren.
                               WARUM GEMEINDE UND NICHT KREIS: der raeumliche
                               Anwendungsbereich dieser Saetze ist eine Liste von ORTEN
                               ("ostfriesische Inseln", Druckseiten 40 und 47), kein
                               Kreis. Auf den Kreisschluessel gelegt bekaeme ein
                               Binnenhaus im Landkreis Aurich den Inselzins von 1,0 %.
                               WARUM DIE 56 SPERREN DAZUGEHOEREN: `finde()` nimmt die
                               feinste Kaskadenstufe mit Treffer und bricht dort ab, sie
                               mischt die Stufen nicht. Gemessen am 05.10.2026 lieferte
                               finde('03452020') vorher sieben Saetze der Ebene "kreis",
                               danach nur noch die beiden Gemeindesaetze. Das ist hier
                               RICHTIG: alle acht Zinssatz-Abschnitte des GAG Aurich
                               tragen "Zustaendigkeitsbereich des GAG Aurich (ohne
                               Inseln)" - Dauerwohnen auf 36/37/38 genauso wie Gewerbe
                               auf 42 bis 45. Der Kreissatz galt auf den Inseln also nie;
                               die Kaskade hat ihn stillschweigend uebertragen. Die
                               Sperren setzen an die Stelle dieses Schweigens eine
                               Begruendung mit Weg. */
                            'lzs-ni-aurich-inseln-2026.json', /* NI · 70 */
                            /* v1885 (Linie 8): Niedersachsen-Rest, Schleswig-Holstein-
                               Rest, Rheinland-Pfalz, Saarland.
                               ZINS (195): zwoelf Werte, die die erste NI-Ernte
                               uebersprang - Reihenhaus/Doppelhaushaelfte Region Hannover
                               und die drei Landkreise Hameln-Pyrmont/Hildesheim/
                               Schaumburg (Kapitel 7.1 wertet beide Objektarten in EINER
                               Stichprobe aus), Altenpflegeheime 2,3 % und
                               Seniorenresidenzen 2,9 % des GAG Sulingen-Verden mit
                               GND 50 statt 80; dazu 19 NI-Sperren und 164 fuer RP und SL.
                               SACHWERTFAKTOR (216): Wochenendhaeuser Sulingen-Verden 0,86
                               (ohne Duemmer See) plus 212 Sperren - zwoelf SH-Ausschuesse
                               ohne Faktorenblatt, Rheinland-Pfalz (Kapitel 4 des LGMB 2025
                               ist kostenpflichtig UND genehmigungspflichtig) und das
                               Saarland, das bis dahin ueberhaupt nicht im Register stand.

                               DIESE ZWEI ZEILEN STANDEN SCHON EINMAL HIER und waren am
                               05.10.2026 wieder weg - eine parallel laufende Erntelinie
                               hat die Datei als Ganzes neu geschrieben und sie dabei
                               verloren. Gemessen hat es `fehlendeSaatdateien()`: 411
                               Saetze lagen im Repo und erreichten keinen Bericht. Genau
                               davor warnt der Abschnitt v1778 weiter oben. Wer diese
                               Liste anfasst, aendert sie ZEILENWEISE - nie als Block. */
                            'lzs-ni-sh-rp-sl-2026.json',
                            'swf-ni-sh-rp-sl-2026.json',
                            /* v2830: Niedersachsen MFH-Liegenschaftszins nach dem
                               Landesmodell des OGA (Tableau-Dashboard 2026, GGR je
                               Gemeinde x RND 15-80), 40 Kreise, 796 Gemeinden. */
                            'lzs-ni-mfh-landesmodell-2026.json',
                            /* v1888 (Linie 9): BAYERN wird erreichbar. 748 Sperren -
                               94 Ausschuesse x 2 Kennzahlen x 4 Zweige.
                               verfuegbarkeit-by.json liegt seit v1613 im Register, ist
                               aber ein OBJEKT und keine Array-Datei: ladeSaat()
                               ueberspringt sie. Gemessen am 05.10.2026 lieferte
                               finde('liegenschaftszinssatz', <jeder BY-Kreis>) deshalb
                               0 Saetze - ganz Bayern war im Rechenweg stumm, obwohl der
                               Wegweiser als Dokument existierte.
                               Am Portal gegengeprueft: neun PDF-Links, alle
                               Landesberichte. Im Landesbericht 2026 (20 MB, 1,38 Mio.
                               Zeichen) kommt "Liegenschaftszinssatz" EINMAL vor - im
                               Abkuerzungsverzeichnis. Keine Tabelle, kein Wert; der
                               Bericht verweist selbst auf die oertlichen Ausschuesse.
                               Jede Sperre traegt den Meldestand DIESES Ausschusses
                               (hat er Werte abgeleitet? hat er einen eigenen Bericht?),
                               weil davon abhaengt, ob eine Anfrage sich lohnt.
                               Muenchen ist beim SACHWERTFAKTOR ausgelassen:
                               sued-nord.json fuehrt dort auf dem Gemeindeschluessel
                               09162000 schon ezfh und rmh, und eine Kreis-Sperre koennte
                               sie verdecken. */
                            'lzs-swf-by-2026-sperren.json', 'lzs-by-bw-2026.json', /* v1891: Zinssaetze Baden-Wuerttemberg (Singen, Horb, Wangen, Pfullingen, Bruchsal) */ 'swf-by-bw-2026.json', /* v1891: Sachwertfaktoren Singen, dazu die Sperren mit Bezugsweg */ /* BY · 748 Sperren */
                            /* v1926 (Ernte-Durchsicht der 139 amtlichen PDFs): Landkreis
                               Rostock, sechs Sperren (vier Zinssatz-Gebaeudetypen, zwei
                               Sachwertfaktor-Zweige). Der Bericht ist KOSTENLOS abrufbar und
                               fuehrt die Werte vollstaendig in den Tabellen 11 bis 13 und
                               Tabelle 18 — er erlaubt die Verbreitung aber nur mit Genehmigung
                               des Herausgebers (S. 3). Also dieselbe Sperre wie Kiel: die
                               LIZENZ sperrt, nicht die Verfuegbarkeit, und der Satz traegt den
                               Weg dorthin (gaa@lkros.de) statt einer Zahl.
                               13072 war die letzte Luecke unter den im Register gefuehrten
                               MV-Landkreisen (13071, 13073, 13076 liegen). */
                            'lzs-swf-mv-rostock-2026-sperren.json',
                            /* Ernte 19.10.2026 (Agent register-ernte): BW-Nachernte - Bodensee West,
                               suedwestl. Schwarzwald-Baar-Kreis (Trendformeln je RND, ETW nach Hausgroesse),
                               Waiblingen/Korb, Bruchsal Jahrgang 2025 (Werte und ihre Sperren). */
                            'lzs-swf-bw-2026-nachernte.json',
                            /* Ernte 19.10.2026: BW-Sperren mit Bezugsweg (kostenpflichtig / genehmigungspflichtig):
                               Pforzheim, Reutlingen, Sindelfingen, Ludwigsburg, Schwaebisch Gmuend, Baiersbronn,
                               Mittleres Remstal, Biberach-Mitte, LK Esslingen, Oberes Gaeu (nur SWF).
                               ACHTUNG Stufe N: 97 Gemeinden ohne Registersatz bekommen damit einen Satz und
                               fallen von N auf D mit Weg (v2401: nie N bei Sperre). Eigene Datei, damit die
                               Entscheidung eine Zeile ist. */
                            'lzs-swf-bw-2026-wege.json',
                            /* Ernte 19.10.2026: Hamburg leitet Sachwertfaktoren nur fuer EFH ab - MFH als Sperre (IMB 2026, Kap. 7.3). */
                            'swf-hh-2026-sperren.json',
                            /* Nachernte 16.10.2026: Grundstuecksmarktdaten NRW, Ausgabe 2026 (lzs.csv, Berichtsjahr 2025), 502 Zinssaetze neben dem Vorjahrgang lzs-nrw.json - gleicher Zweigschluessel, findeZweig nimmt den juengeren Stichtag. */ 'lzs-swf-2026-nachernte.json',
                            /* ══ v1976 · DIE ERSTEN VERGLEICHSFAKTOREN ═══════════

                               Bis zum 08.10.2026 fuehrte das Register 0 Saetze mit
                               der Kennzahl `vergleichsfaktor` — gemessen ueber alle
                               58 Dateien. Der Leseweg war gebaut und ungenutzt:
                               `gutachterausschuss.js:1339` wertet sie aus, `api.js`,
                               `CrossCheckService` und `verfahrenswahl.js` kennen sie.

                               Seit v1971 fuehrt das Vergleichswertverfahren nur noch
                               mit KAUFPREISBASIERTER Grundlage — ohne sie weist der
                               Bericht kein fuehrendes Verfahren aus. Diese zwei
                               Dateien sind der Anfang der Gegenseite.

                               vgf-bb.json · Landkreis Barnim, GMB 2025, 2 WERTE
                                 ezfh  Matrix 13x7 (Wohnflaeche x Bodenwert), Euro/m2
                                       Wohnflaeche, RND-Koeffizient, 123 Kauffaelle,
                                       R2 0,70 -> Stufe B
                                 rhdhh Matrix 9x10, zwei Koeffizienten (RND und
                                       Grundstuecksflaeche), 79 Kauffaelle, R2 0,79
                                       -> Stufe A
                                 Anwendungsbeispiele nachgerechnet: EZFH S. 85 Soll
                                 „rd. 582.000", Ist 581.175 (Abweichung 0,14 % — der
                                 Bericht rechnet mit dem UNGERUNDETEN Faktor 1,0515
                                 und druckt 1,05, deshalb B statt A). DHH S. 102 Soll
                                 „rd. 376.000", Ist 375.685 -> vollstaendig
                                 reproduziert.

                               > ACHTUNG, DOPPELZAEHLUNG: diese Vergleichsfaktoren
                               > ENTHALTEN den Bodenwert („beinhalten den Gebaeude-
                               > und Bodenwert"). Ein zusaetzlicher Bodenwertansatz
                               > zaehlt ihn zweimal. Steht in den `auflagen`.

                               vgf-sl.json · Saarland, 7 SPERREN, kein Wert
                                 3x vergleichsfaktor Saarpfalz-Kreis (10045): die
                                   Faktoren EXISTIEREN, der Ausschuss gibt sie nur
                                   auf Antrag gegen Gebuehr heraus (30,74 Euro je
                                   halbe Stunde) und verbietet die oeffentliche
                                   Wiedergabe ohne Erlaubnis. Kein dl-de, also
                                   `quellenvermerk: null` — ein Vermerk ist hier
                                   nicht FEHLEND, sondern nicht existent.
                                 4x liegenschaftszinssatz Landeshauptstadt
                                   Saarbruecken (10041100, im Register bisher gar
                                   nicht vertreten): als Wert gesperrt, weil es
                                   ANGEWENDETE und nicht abgeleitete Saetze sind, jeder
                                   Modellvermerk nach § 10 fehlt, und eine SPANNE kein
                                   Wert ist — bei MFH 1,5 bis 5,0 % laege ein
                                   Mittelwert um mehr als das Dreifache daneben.

                               > Die Saarpfalz-Faktoren sind der EINZIGE
                               > Vergleichsfaktor-Ausschuss des Landes — amtlich so
                               > gesagt im Immobilienmarktbericht der Landeshauptstadt
                               > 2026, Kap. 7.2, S. 56: „Vergleichsfaktoren liegen
                               > zurzeit im Saarland nur fuer den Saar-Pfalz-Kreis
                               > vor." */
                            'vgf-bb.json',
                            'vgf-sl.json',
                            /* v1976b: Berlin — 3 WERTE und 1 Sperre.

                               ezfh           Matrix 8x7 (Bodenrichtwert x BGF),
                                              Euro/m2 BRUTTO-GRUNDFLAECHE, 2.859
                                              Kauffaelle
                               ezfh_sehr_gut  8 Stuetzstellen, 26 Kauffaelle
                               villa          7 Stuetzstellen, 38 Kauffaelle
                               etw            SPERRE: die neun „Tabellen" sind
                                              gezeichnete ENTSCHEIDUNGSBAEUME. Alle 73
                                              Endknotenwerte und die Altbezirks-
                                              zuordnung sind geerntet (Fallzahlprobe
                                              9.779 = 9.779 ohne Rest), aber NICHT,
                                              welche Split-Schwelle zu welchem
                                              Endknoten fuehrt — die Verbinderlinien
                                              sind von Beschriftungsfeldern
                                              zerschnitten, und drei
                                              Rekonstruktionsregeln ergaben drei
                                              verschiedene Kantenmengen. Das ist
                                              Tuning, keine Messung, also steht kein
                                              geratener Pfad in der Datei. Mit einem
                                              Rasterizer in einem Durchgang
                                              aufloesbar.

                               Anwendungsbeispiel EZFH S. 17 Zeile fuer Zeile
                               nachgerechnet: Ausgangswert 3.336, Baujahr 1936 +/-0,
                               Doppelhaushaelfte -278, schlechter Zustand -566 ->
                               2.492 Euro/m2 BGF, Grundbesitzwert 498.400 Euro. Soll
                               = Ist in jeder Zeile.

                               > ⚠ VERWENDUNG IST „INTERN", UND DAS IST KEIN
                               > FORMFEHLER. Die Blaetter sagen woertlich: „Die
                               > Vergleichsfaktoren ersetzen nicht eine
                               > gutachterliche Ermittlung des Verkehrswertes im
                               > Sinne des § 194 BauGB", und jeder Endknoten tragt
                               > „ausschliesslich fuer die steuerliche Bewertung".
                               > Sie sind amtlich fuer die steuerliche
                               > Bedarfsbewertung und die Kaufpreisaufteilung, NICHT
                               > als Verkehrswert.
                               >
                               > Wer sie an `_vglKaufpreise` in CrossCheckService
                               > verdrahtet (v1971), macht daraus ein fuehrendes
                               > Vergleichswertverfahren, das sie nicht tragen. Die
                               > Verdrahtung muss `verwendung` lesen. */
                            'vgf-be.json',
                            /* Ernte 27.10.2026 (Ost): Sachsen-Anhalt — Gebaeudefaktoren (§ 20) des
                               GAA ST, veroeffentlicht 22.01./13.02.2025, alle 14 Kreise fuer EZFH und
                               RH/DHH (Normobjekt-Kurve je Wohnflaeche x Umrechnungskoeffizienten), dazu
                               ETW Halle aus dem GMB 2023 Abschn. 7.3. Gemeinden mit Grossstadtrandlage
                               bzw. Altkreis Querfurt eigens (8-stellig). Viele Saetze verlangen
                               Standardstufe / Unterkellerung / Garagen / Modernisierungspunkte als
                               formel.bedingungen - ohne diese Eingaben rechnen sie nicht. */
                            'vgf-st-2025.json',
                            /* Ernte 27.10.2026 (Ost): ETW-Vergleichsfaktor-Sperren mit Weg fuer
                               Dresden (nur UK-Modell 7.2.3, formel_vorgemerkt), Leipzig, Schwerin. */
                            'ost-nachernte-2026-10.json',
                            /* Ernte 27.10.2026 (HH/BB/NI): Vergleichs-/Gebaeudefaktoren (§ 20).
                               vgf-hh-2026.json      Hamburg, IMB 2026 Kap. 7.2.1/7.6.1: EFH je Stellung
                                                     (ezfh, dhh, rmh, reh) und ETW, Produktformel. Rechnet
                                                     erst mit NormBRW20/NormBRW18 und Alter (bedingungen).
                               vgf-bb-oga-2025.json  Oberer GAA Brandenburg, Vergleichsfaktoren 2025:
                                                     Berliner Umland je Gemeinde (8-stellig, ohne die fuenf
                                                     Barnimer - Barnim hat eigene, vgf-bb.json), Weiterer
                                                     Metropolenraum als Landessatz 12. Stufe C.
                               vgf-ni-2026.json      NI-Dashboards (VizQL-Bootstrap): Hannover, Braunschweig,
                                                     Osnabrueck, Oldenburg/Ammerland, Hildesheim, Goettingen,
                                                     Lueneburg; Sperren dort, wo Ortsteil/Stadtteil den Wert
                                                     bestimmt. Die meisten verlangen das modifizierte Baujahr. */
                            'vgf-hh-2026.json', 'vgf-bb-oga-2025.json', 'vgf-ni-2026.json',
                            /* Ernte 27.10.2026 (HE): Vergleichsfaktoren des Landes Hessen 2026
                               (ZGGH, Stichtag 01.01.2026, Version 1.1 vom 31.08.2026), alle 17
                               Ausschuesse: EFH/ZFH und RH/DHH = Tabelle Wohnflaeche x
                               Bodenrichtwertbereich plus Korrekturwert (Grundstuecksgroesse x
                               Baujahr, additiv, EUR/m2), ETW = Bodenrichtwertbereich x Baujahr
                               (Wiederverkauf). Geteilte Kreise als ein Satz je Zweig, Marktbereich
                               ueber die achtstellige ags (verzweigt); Main-Kinzig/Wetterau je
                               Gemeinde (MB 2 ohne RH/ETW = Sperre). Frankfurt ETW braucht die Lage
                               (rechnet nicht), Wiesbaden ETW = Klassenmittel (Stufe C). */
                            'vgf-he-2026.json',
                            'vgf-bw-konstanz-2026.json',   /* v3008: Konstanz ETW-Tabelle Wohnlage x Baujahr x Ausstattung (merkmalsmatrix), loest die Sperre in vgf-bw-2026.json ab */
                            /* v2279: Umrechnungskoeffizienten Grundstuecksgroesse
                               (§ 19 ImmoWertV), Kennzahl umrechnungskoeffizient_flaeche.
                               Erster Satz: Stadt Bielefeld (BORIS-NRW 2026). Gelesen
                               von lib/umrechnung_flaeche.js. */
                            'uk-flaeche-nw-2026.json',
                            /* v2281: Niedersachsen (BORIS-NI WFS, Umrechnungstabellen FLAE)
                               und amtliche Landes-/Stadtstaatwerte (HE, TH, ST, MV, RP, HH, HB, BE). */
                            'uk-flaeche-ni-2026.json', 'uk-flaeche-laender-2026.json',
                            /* Ernte 16.10.2026 (LZS/SWF-Linie HB/SL/HH/RP/BY): Mainz, amtlich kein Einfluss der Grundstuecksgroesse (GMB 2025, S. 42-43). */
                            'uk-flaeche-funde-ernte-lzs.json',
                            /* Ernte 16.10.2026: Baden-Wuerttemberg (BORIS-BW-Fachinformationen, Marktberichte) -
                               Werte Heilbronn, Freiburg, Bruchsal; Sperren mit Weg fuer 65 weitere Ausschuesse (davon 7 Stadtkreise), 639 Saetze je Gemeinde. */
                            'uk-flaeche-bw-2026.json',
                            /* Ernte 16.10.2026: Bayern (BORIS-Bayern, Erlaeuterungen von 85 Ausschuessen ueber das WMS-Feld
                               listeumrechnungstabellen) - Wert Amberg (amtlich kein Einfluss); Sperren mit Weg fuer 95 Ausschuesse,
                               davon 4 amtliche Tabellen mit Lizenzverbot als Stuetzstelle vorgemerkt (Fuerth, Landshut, FFB, Weilheim-Schongau). */
                            'uk-flaeche-by-2026.json',
                            /* Ernte 16.10.2026: Ost (BB alle 16 Ausschuesse, SN alle 13, MV Rostock + LUP) - Werte LDS, TF, CB, MOL
                               (Tabellen/Potenz je Raum, Gemeinden des Berliner Umlands mit 8-stelliger AGS) und amtlich „kein Einfluss“
                               BAR, HVL, LOS, P, PM; Sperren mit Weg, SN/Rostock als Stuetzstelle vorgemerkt (Lizenz). TH/ST: kein oertlicher Satz. */
                            'uk-flaeche-ost-2026.json',
                            /* Ernte 16.10.2026: West (HE alle 19 Ausschuesse, RP 11 ohne Mainz, SL 7, SH 15) - Werte AfB Limburg,
                               LK Fulda, Wiesbaden, Trier, Kiel (Tabellen), Suedhessen amtlich „kein Einfluss“, Buedingen/Korbach/Giessen
                               mit der von ihnen beschlossenen Landestabelle (Stufe C); Sperren mit Weg, WWT und RV Saarbruecken als Stuetzstelle. */
                            'uk-flaeche-west-2026.json',
                            /* v2361: Umrechnungskoeffizienten WGFZ (§ 16 Abs. 4 ImmoWertV), Kennzahl
                               umrechnungskoeffizient_wgfz, gelesen von lib/umrechnung_wgfz.js.
                               Erster Satz: Stadt Bielefeld (MFH-Grundstuecke, GMB 2026 S. 30-31). */
                            'uk-wgfz-bielefeld-2026.json',
                            /* v2363: Ernte NRW 17.10.2026 - Bottrop, Duesseldorf, Bonn, Duisburg, Hagen, Muelheim (2), Koeln. */
                            'uk-wgfz-nw-2026.json',
                            /* v2366: Ernte 17.10.2026 - BE, HH, HE, BY, HB, NI: 18 Werte (Berlin, Frankfurt, Wiesbaden,
                               Kassel, Giessen, Fulda, Offenbach, Muenchen, Regensburg, Bremen ...), 78 Sperren mit Weg. */
                            'uk-wgfz-laender-2026.json',
                            /* v2373: Ernte 18.10.2026 - WGFZ fuer NRW (uebrige 75 Ausschuesse: 23 Werte, u. a. Solingen,
                               Leverkusen, Muenster, Herne, Neuss, Wuppertal, Moenchengladbach, Lippe), BW (Wert nur Heilbronn,
                               sonst Sperren je Gemeinde, Lizenz/Gebuehr) und BB/SN/ST/TH/MV/SH/RP/SL (Werte Oberhavel,
                               Halle, Magdeburg, Kiel, Ostholstein, Luebeck, Hzgt. Lauenburg). */
                            'uk-wgfz-nw2-2026.json', 'uk-wgfz-bw-2026.json', 'uk-wgfz-ost-west-2026.json',
                            /* v2367: MFH-Kennzahlen (Rohertragsfaktor, Ø Kaufpreis/Miete der Kauffaelle) - Gegenprobe zur Angebotsindikation. */
                            'mfh-kennzahlen-2026.json',
                            /* Ernte 20.10.2026: Gutachterausschuss Ulm, Immobilienmarktbericht 2026 (Genehmigung vom
                               23.09.2026, laut Marcel Junker auch fuer Jahrgang 2026). 9 Zinssaetze (loesen die Saetze 2025
                               in lzs-bw.json ab - juengster Jahrgang gilt), Sachwertfaktor nur als Diagramm ohne Gleichung
                               (Sperren), keine Umrechnungskoeffizienten Flaeche (Sperren). */
                            'lzs-swf-uk-ulm-2026.json',
                            /* v2650 · Nachernte 21.10.2026 (Harvest-Takt, Teil RP/BE/BY/HB/NI-OGA):
                               Berlin Liegenschaftszinssaetze 2026 (6 Gebietsgruppen, NEU Objektmiete x
                               Wohn-/Nutzflaeche, 432 Zellen = Formel) und Sachwertfaktoren 2026
                               (Teilmarkt 1: 4 Altbezirksgruppen x EFH/DHH/REH/RMH; Teilmarkt 2: Villen),
                               Stichtag 31.12.2025 - loesen 2025 ab; dazu 7 Sperren. dl-de/zero-2-0. */
                            'nachernte-2026-10-be.json',
                            /* v2640 · Nachernte 21.10.2026 (Harvest-Takt, Teil MV): Ludwigslust-Parchim 2026
                               5 Zinssaetze + 7 Rohertragsfaktoren (loesen 2025 ab; WGH/MFH>6 unveraendert
                               aus 2025), SWF 2026 als Sperre (Baupreisindex ohne Zahl, Tabelle vorgemerkt);
                               Hansestadt Rostock 2026, Landkreis Rostock 2026, Vorpommern-Greifswald 2024
                               genehmigungspflichtig - nur Sperren mit Fundstelle und Weg. */
                            'nachernte-2026-10-mv.json',
                            /* v2690 · Nachernte 21.10.2026 (Agent register-ernte BW): Gemeinsamer GAA Boeblingen
                               und Schoenbuchgemeinden, GMB 2025 (Stichtag 01.01.2025, frei, ohne Lizenzvermerk):
                               Liegenschaftszinssaetze als log-Funktion der Mietflaeche bzw. der RND (EFH City,
                               RH/DHH Land, MFH City/Land, ETW City/Land); EFH Land und RH/DHH City gesperrt, weil
                               Diagrammfunktion und Tabelle des Dokuments sich widersprechen; Sachwertfaktoren
                               gesperrt (Baukostenindex ohne Zahl). Gemeinsamer GAA Lahr, GMB 2023/2024: LZS EFH/ZFH,
                               MFH, ETW (Quellenangabe Pflicht), SWF gesperrt (Baupreisindex ohne Zahl). */
                            'nachernte-2026-10b-bw.json',
                            /* v2690 · Sperren mit Bezugsweg (kostenpflichtig / genehmigungspflichtig / auf Anfrage),
                               je Gemeinde und Objektart: Mannheim, Freiburg, Oestl. Bodenseekreis (Friedrichshafen),
                               Oestl. LK Biberach, Sinsheim, Rottenburg, Goeppingen, Esslingen a. N., Kehl,
                               Offenburg-Kinzigtal, Linzgau-Gehrenberg, Neckar-Odenwald, nordoestl. Schwarzwald-Baar,
                               Aalen-Essingen, Tuebingen (10 Gem.), Loerrach/Inzlingen, Leonberg, Heidelberg.
                               ACHTUNG Stufe N (v2401: nie N bei Sperre): Gemeinden ohne Registersatz verlieren
                               damit die DealPilot-Formel und rechnen § 256 BewG mit Weg — eigene Datei, damit die
                               Entscheidung eine Zeile ist. */
                            'nachernte-2026-10b-bw-wege.json',
                            /* v2700 · Nachernte 10b 21.10.2026 (HE/SH/RP/HH): Darmstadt IMB 2026 (neu im Register:
                               LZS MFH nach Baujahr vor/ab 1950, vermietete ETW, WGH/gemischt dünn belegt Stufe B),
                               Sachwertfaktor MFH/ETW je hessischem Ausschuss als Sperre mit Fundstelle (Korbach,
                               Homberg, Frankfurt fuehren MFH-SWF, aber Baupreisindex ohne Zahl), Main-Kinzig/Wetterau-
                               Luecken; SH Datenblaetter Luebeck/Lauenburg/Ostholstein (MFH/ETW-SWF, WGH/Gewerbe-LZS);
                               Worms eigener GMB 2025 kostenpflichtig (50 EUR, Bestellweg); Hamburg WGH-LZS, ETW-SWF. */
                            'nachernte-2026-10b-he.json', 'nachernte-2026-10b-sh.json',
                            'nachernte-2026-10b-rp.json', 'nachernte-2026-10b-hh.json',
                            /* v2710-v2713 · Nachernte 10b 21.10.2026 (TH/MV/SN/ST/BB): Altenburger Land/Greiz/Gera
                               Liegenschaftszinssaetze 2026 (Stichtag 01.01.2025, 9 Werte MFH/WGH/ETW, loesen 2024 ab;
                               Greiz-ETW neu), dazu Sperren je Thueringer Ausschuss fuer nicht abgeleitete Objektarten
                               (EFH/DHH/ETW-Zins, MFH-Sachwertfaktor), Kyffhaeuser/Nordhausen Band 2022 (Stichtag 2020,
                               veraltet); MV Seenplatte und Vorpommern-Ruegen genehmigungspflichtig (Sperren mit
                               Fundstelle und Weg); MFH-Sachwertfaktor-Sperren SN (Dresden, Leipzig), ST (14), BB (16). */
                            'nachernte-2026-10b-th.json', 'nachernte-2026-10b-mv.json', 'nachernte-2026-10b-sn.json',
                            'nachernte-2026-10b-st.json', 'nachernte-2026-10b-bb.json',
                            /* v2620: Umrechnungskoeffizienten zum Immobilienrichtwert NRW (Kennzahl umrechnung_irw,
                               lib/vergleichswert_irw.js, Pruefer tools/irw-pruefen.mjs): Herford, Bielefeld,
                               Koeln, Duesseldorf (Sperren), Bonn, Muenster, Dortmund (Sperren, additiv), Bochum,
                               Essen, Duisburg, Wuppertal; Minden-Luebbecke Sperre (keine IRW beschlossen). */
                            'uk-irw-nw-owl-2026.json', 'uk-irw-nw-rheinland-2026.json',
                            'uk-irw-nw-ruhr-ost-2026.json', 'uk-irw-nw-ruhr-west-2026.json',
                            /* v2680: zweite IRW-Ernte NRW, die uebrigen 58 Ausschuesse nach Region
                               (156 Saetze: 93 Werte, 63 Sperren; additive Verknuepfung, interpolierte
                               Rechteck-Matrizen, Spannen und bedingte Kategorien als Sperre vorgemerkt). */
                            'uk-irw-nw-rheinland-sued-2026.json', 'uk-irw-nw-niederrhein-2026.json',
                            'uk-irw-nw-bergisch-mettmann-2026.json', 'uk-irw-nw-ruhr-nord-2026.json',
                            'uk-irw-nw-muensterland-2026.json', 'uk-irw-nw-ostwestfalen-2026.json',
                            'uk-irw-nw-sauerland-siegerland-2026.json',
                            /* v2881-v2884: Niedersachsen-Sachwertfaktoren aus den Tableau-Kalkulatoren per Sitzung
                               (Parameter setzen, Ergebnisfeld als Vektorbild lesen): GAG Northeim mit Lageklassen
                               ueber die Gemarkung (Goslar, Northeim, Holzminden, LK und Stadt Goettingen),
                               GAG Oldenburg-Cloppenburg je Gemeinde (Gemeindekoeffizient), Sperren mit Weg fuer
                               die Kalkulatoren der GAG Aurich und Lueneburg. */
                            'swf-ni-nom-2026.json', 'swf-ni-ol-2026.json', 'swf-ni-sperren-2026.json',
                            /* v2887: GAG Sulingen-Verden aus den Dashboards ohne Blatt "Berechnung"
                               (ernte-sv.mjs): Stuhr, Syke, Weyhe je Gemeinde (EFH, ZFH, RH), uebriger LK
                               Diepholz EFH/ZFH, LK Nienburg und Heidekreis RH; Sperren mit Weg fuer Verden RH
                               (Bremer Umland ohne Ortsliste) und Nienburg-Land EFH. */
                            'swf-ni-sv-2026.json',
                           ];

/* ═══ v1778 · WAS LIEGT IM ORDNER, STEHT ABER NICHT IN DER LISTE? ═══

   Eine handgefuehrte Liste neben einem Ordner laeuft auseinander, und
   zwar lautlos: die Datei liegt da, der Lauf meldet keinen Fehler, und
   erst eine Zaehlung faellt auf. Am 02.10.2026 waren es zehn Dateien.

   Warum die Liste trotzdem bleibt und nicht durch `readdirSync` ersetzt
   wird: eine neue Datei soll nicht dadurch in den Kundenbericht
   geraten, dass jemand sie ablegt. Die Aufnahme ist eine Entscheidung.

   > Eine Liste, die man pflegen muss, braucht einen, der nachzaehlt.

   Wegweiser (`verfuegbarkeit-*.json`) tragen keine Werte und gehoeren
   nicht hierher — sie werden ausgenommen, nicht gemeldet. */
export function fehlendeSaatdateien() {
  try {
    const ordner = join(HIER, 'register');
    const da = readdirSync(ordner).filter((f) => f.endsWith('.json'));
    const fehlt = [];
    for (const f of da) {
      if (/^verfuegbarkeit-/.test(f)) continue;
      if (SAATDATEIEN.indexOf(f) >= 0) continue;
      let n = 0;
      try {
        const a = JSON.parse(readFileSync(join(ordner, f), 'utf8'));
        n = Array.isArray(a) ? a.length : 0;
      } catch (e) {}
      fehlt.push({ datei: f, saetze: n });
    }
    return fehlt;
  } catch (e) { return []; }
}

/* v2591 · DER LESEWEG DER SAAT, OHNE DEN ZUSTAND ANZUFASSEN.
   Die Deckungsauskunft (register_deckung.js) muss dieselben Dateien auf
   demselben Weg lesen wie der Bericht — aber ladeSaat() SETZT das Register
   neu und wuerfe den DB-Stand des laufenden Servers weg. Deshalb ist das
   Lesen hier herausgezogen; ladeSaat() ruft genau diese Funktion.
   `_datei` traegt den Dateinamen am Satz mit — nur fuer die Auskunft, der
   Rechenweg liest das Feld nicht. */
export function leseSaatdateien(dateien = SAATDATEIEN, { mitDatei = false } = {}) {
  const liste = (Array.isArray(dateien) ? dateien : [dateien])
    .map((d) => (String(d).includes('/') ? String(d) : join(HIER, 'register', d)));
  const alle = [];
  const gelesen = [];
  const vermisst = [];
  for (const datei of liste) {
    try {
      const saetze = JSON.parse(readFileSync(datei, 'utf8'));
      if (!Array.isArray(saetze)) throw new Error('kein Array');
      if (mitDatei) {
        const kurz = String(datei).split(/[\\/]/).pop();
        for (const s of saetze) alle.push({ ...s, _datei: kurz });
      } else alle.push(...saetze);
      gelesen.push({ datei, saetze: saetze.length });   /* v1084a-WMRG */
    } catch (e) {
      vermisst.push({ datei, fehler: e.message });
      console.error('[register] Saatdatei nicht lesbar:', datei, e.message);
    }
  }
  return { alle, gelesen, vermisst };
}

export function ladeSaat(dateien = SAATDATEIEN) {
  const { alle, gelesen, vermisst } = leseSaatdateien(dateien);
  if (alle.length) {
    _saat = alle;                                 /* v1084a-WMRG */
    _index = indizieren(alle);
    _herkunft = 'saatdatei';
    _stand = { saetze: alle.length, gelesen, vermisst,
               je_kennzahl: jeKennzahl(alle) };
    return _stand;
  }
  try {
    throw new Error(vermisst.map((v) => v.fehler).join('; ') || 'keine Saatdatei');
  } catch (e) {
    console.error('[register] Saatdatei nicht lesbar:', e.message);
    /* 'fehlgeschlagen', NICHT 'leer' — sonst versucht der Lazy-Load es bei
     * jedem einzelnen Aufruf erneut. Einmal scheitern reicht. */
    _index = new Map(); _herkunft = 'fehlgeschlagen';
    _stand = { saetze: 0, fehler: e.message };
    return _stand;
  }
}

/**
 * Register aus mb.param_modell nachladen. Ueberschreibt die Saat NUR bei
 * Erfolg und nur, wenn die Tabelle ueberhaupt etwas liefert — eine leere
 * Tabelle darf ein gefuelltes Register nicht loeschen.
 */
/* v2396 · Die Kennzahlen, die der Server aus mb.param_modell holt — als
   eigene Konstante, damit tools/register-db-abgleich.mjs DIESELBE Liste
   prueft statt einer Abschrift. */
export const DB_KENNZAHLEN = Object.freeze(['liegenschaftszinssatz',
                                            'sachwertfaktor',
                                            'bodenpreisniveau',
                                            'durchschnittspreis',
                                            'preisentwicklung',
                                            'erbbauzinssatz',
                                            /* v1094-WKZ */
                                            'vergleichsfaktor',
                                            /* v2279 */
                                            'umrechnungskoeffizient_flaeche',
                                            'bodenpreisindex']);

export async function ladeAusDb(q, kennzahlen = [...DB_KENNZAHLEN]) {
  if (typeof q !== 'function') return { geladen: 0, grund: 'kein_q' };
  try {
    const rows = await q(
      `SELECT land_code, ags, ebene, gebiet_name, gaa_name, kennzahl, zweig,
              formel, korrekturen, modellansaetze, geltungsbereich, belege,
              stufe, fallzahl, stichtag, berichtsjahr, modellversion,
              quelle_url, quellenvermerk, lizenz
         FROM mb.param_modell
        WHERE kennzahl = ANY($1)`, [kennzahlen]);
    if (!rows || !rows.length) {
      return { geladen: 0, grund: 'tabelle_leer', behalten: _herkunft };
    }

    /* v1084a-WMRG · DIE TABELLE GEWINNT JE KENNZAHL, NICHT PAUSCHAL.
     *
     * Bis v1084 ersetzte diese Zeile den ganzen Index. Auf Produktion lagen
     * in mb.param_modell 493 Liegenschaftszinssaetze und NULL
     * Sachwertfaktoren — die 31 Sachwertfaktoren der Saatdatei waren damit
     * zur Laufzeit weg, obwohl die Datei danebenlag und der Marker stand.
     *
     * Die alte Wache fing die LEERE Tabelle. Die halb gefuellte fing sie
     * nicht. Ab hier gilt: was die Tabelle fuehrt, kommt aus der Tabelle;
     * was sie nicht fuehrt, bleibt aus der Saat stehen. Ein Datensatz
     * verschwindet nur, wenn ihn jemand ausdruecklich ersetzt. */
    /* v1095-WMRG2 · JE DATENSATZ, NICHT JE KENNZAHL.
     *
     * Der Rollout von v1094 hat es sichtbar gemacht: die Saatdateien fuehren
     * 2150 Saetze, der laufende Server meldete 1565. In mb.param_modell
     * liegen 493 Liegenschaftszinssaetze aus dem Saatlauf vom 12.08. — nur
     * NRW, nur Berichtsjahr 2024. Weil die Tabelle die KENNZAHL fuehrte,
     * gewann sie fuer die ganze Kennzahl, und die 585 neueren Saetze
     * (Hessen, Niedersachsen, Brandenburg, Berlin, Sachsen-Anhalt,
     * Thueringen, Bayern, dazu der Jahrgang 2023) fielen still heraus.
     *
     * 2150 - 1078 + 493 = 1565. Die Rechnung ging exakt auf.
     *
     * Dieselbe Fehlerklasse wie in v1084a, eine Ebene tiefer: damals fing
     * die Wache die LEERE Tabelle, aber nicht die halb gefuellte; danach
     * fing sie die halb gefuellte, aber nicht die VERALTETE. Beide Male lag
     * dieselbe Annahme darunter — dass die Tabelle mindestens so aktuell
     * ist wie die Datei. Sie stimmt nicht: die Datei ist versioniert und
     * faehrt mit dem Code mit, die Tabelle wird von Hand nachgezogen.
     *
     * Der Schluessel ist derselbe wie der Eindeutigkeitsschluessel der
     * Tabelle. Das ist kein Zufall, sondern die Bedingung dafuer, dass
     * "ersetzen" ueberhaupt eine wohldefinierte Bedeutung hat. */
    /* ═══ v2396 · DIE DATEI IST DIE QUELLE, DIE TABELLE NUR DER WERT ═══════
       Bis v2395 ersetzte jede DB-Zeile JEDEN Saatsatz mit demselben
       Mischschluessel (ags|kennzahl|zweig|jahr). Drei Fehler, gemessen am
       19.10.2026 an Staging (tools/register-db-abgleich.mjs):

         1  DB-WERT UEBER SPERRE: 138 Zeilen (99 LZS, 35 SWF, 1 BPI, 3 UK).
            Muenchen 09162000 Sachwertfaktor EZFH 1,15 / RMH 1,38 kam an,
            obwohl sued-nord.json dort eine Sperre fuehrt — die Sperre trug
            noch eine formel, register-saat spielte sie als Wert ein, und
            die Tabelle kennt kein vollstaendig-Feld.
            v2288a hielt Sperren nur fuer die Umrechnungskoeffizienten.
         2  WAISEN NACH URL-WECHSEL: der Tabellenschluessel traegt die URL,
            der Mischschluessel nicht. Essen 05113000 (Prod) stand mit
            alter und neuer URL je zweimal da; waehleAusGruppe gab bei
            gleichem Jahrgang null.
         3  FELDVERLUST: die Zeile ersetzte den Satz GANZ — streuung,
            verwendung, auflagen, objektart, baujahr_von/bis,
            unvollstaendig_grund, stufe_grund gingen verloren, weil
            param_modell sie nicht fuehrt.

       Die Regel jetzt, je DB-Zeile:
         · Fuehrt die Datei unter dem VOLLEN Tabellenschluessel (mit URL)
           einen Wert, ist die Zeile dieser Wert: Satz der Datei, darauf
           die Wertspalten der Tabelle (formel, korrekturen,
           modellansaetze). Alle anderen Felder kommen aus der Datei.
         · Sonst, fuehrt die Datei unter dem Mischschluessel eine Sperre:
           die Sperre gewinnt, die Zeile faellt weg (protokolliert).
         · Sonst, fuehrt die Datei den Mischschluessel mit anderer URL:
           die Zeile ist eine Waise, die Datei gewinnt (protokolliert).
         · Sonst (Schluessel in keiner Datei): die Zeile bleibt —
           register-db-abgleich.mjs meldet sie, register-saat --aufraeumen
           loescht sie.
       Saatsaetze bleiben stehen, wenn keine Zeile sie ersetzt; Sperren
       ersetzt nie eine Zeile. */
    const _zw = (s) => s.zweig || 'standard';
    const misch = (s) => [s.ags, s.kennzahl, _zw(s), s.berichtsjahr ?? ''].join('|');
    const voll = (s) => [misch(s), s.quelle_url || ''].join('|');
    const _istSperre = (s) => s.vollstaendig === false || !!s.warum_kein_wert;
    const dateiVoll = new Map();      /* voller Schluessel -> Wertsatz der Datei */
    const dateiMisch = new Map();     /* Mischschluessel -> Saetze der Datei */
    for (const s of _saat) {
      if (!s || !s.kennzahl) continue;
      const m = misch(s);
      if (!dateiMisch.has(m)) dateiMisch.set(m, []);
      dateiMisch.get(m).push(s);
      if (!_istSperre(s)) dateiVoll.set(voll(s), s);
    }
    const _WERTSPALTEN = ['formel', 'korrekturen', 'modellansaetze'];
    const ersetzteSaat = new Set();
    const nutzbar = [];
    const verworfen = { ueber_sperre: [], waise_url: [] };
    const ohneDatei = [];
    for (const r of rows) {
      const d = dateiVoll.get(voll(r));
      if (d) {
        const z = { ...d };
        for (const k of _WERTSPALTEN) if (r[k] != null) z[k] = r[k];
        z.id = r.id ?? null;
        z._aus_db = true;
        ersetzteSaat.add(d);
        nutzbar.push(z);
        continue;
      }
      const gl = dateiMisch.get(misch(r));
      if (gl && gl.some(_istSperre)) { verworfen.ueber_sperre.push(voll(r)); continue; }
      if (gl) { verworfen.waise_url.push(voll(r)); continue; }
      ohneDatei.push(voll(r));
      nutzbar.push({ ...r, _aus_db: true });
    }
    if (verworfen.ueber_sperre.length || verworfen.waise_url.length) {
      console.warn(`[register] ${verworfen.ueber_sperre.length} DB-Zeile(n) ueber einer Datei-Sperre`
        + ` und ${verworfen.waise_url.length} mit fremder URL ignoriert - Datei gewinnt.`
        + ' Abgleich: node tools/register-db-abgleich.mjs; aufraeumen: register-saat.mjs --aufraeumen');
      [...verworfen.ueber_sperre, ...verworfen.waise_url].slice(0, 5)
        .forEach((k) => console.warn('[register]    · ' + k));
    }
    const behalten = _saat.filter((s) => !ersetzteSaat.has(s));
    const zusammen = [...behalten, ...nutzbar];
    const ersetzt = ersetzteSaat.size;

    _index = indizieren(zusammen);
    _herkunft = behalten.length ? 'param_modell+saatdatei' : 'param_modell';
    _stand = { saetze: zusammen.length,
               aus_db: rows.length, aus_saat: behalten.length,
               /* v1095-WMRG2 · Wieviele Saetze der Saat die Tabelle
                * tatsaechlich ERSETZT hat. Ohne diese Zahl sieht ein
                * stiller Verlust genauso aus wie eine saubere
                * Zusammenfuehrung — beim v1094-Rollout war genau das der
                * Fall. Sie gehoert ins Startlog. */
               ersetzt,
               /* v2396 · was die Datei gegen die Tabelle gewonnen hat */
               verworfen: { ueber_sperre: verworfen.ueber_sperre.length,
                            waise_url: verworfen.waise_url.length },
               ohne_datei: ohneDatei.length,
               je_kennzahl: jeKennzahl(zusammen),
               db_fuehrt: [...new Set(rows.map(misch))].sort() };
    return { geladen: rows.length, aus_saat: behalten.length,
             verworfen: _stand.verworfen, ohne_datei: ohneDatei.length,
             herkunft: _herkunft, je_kennzahl: _stand.je_kennzahl };
  } catch (e) {
    console.error('[register] param_modell nicht lesbar:', e.message);
    return { geladen: 0, grund: 'fehler', fehler: e.message, behalten: _herkunft };
  }
}

/* ── Abfragen, synchron ────────────────────────────────────────────────── */

/**
 * Saetze einer Kennzahl fuer ein Gebiet, feinste Ebene zuerst.
 * KEIN TREFFER HEISST KEIN WERT — nie ein Nachbarkreis, nie ein Landesmittel.
 */
export function finde(kennzahl, ags) {
  /* v1083a-WLAZ · DIE PRUEFUNG DARF IHRE VORBEDINGUNG NICHT SELBST HERSTELLEN.
   *
   * In v1083 rief ladeSaat() NIEMAND ausser der Pruefstrecke — im laufenden
   * Server blieb das Register leer, und liegenschaftszinssatz() meldete fuer
   * jede Adresse "kein Ausschuss hinterlegt". Die Kettenpruefung war trotzdem
   * gruen, weil sie selbst geladen hat. Ein Test, der sich seine Vorbedingung
   * baut, prueft die Kette nicht.
   *
   * Jetzt laedt das Register sich beim ersten Zugriff selbst. Damit kann es
   * nicht mehr vergessen werden — egal wer zuerst fragt. */
  if (!_index.size && _herkunft === 'leer') ladeSaat();
  if (!_index.size) return [];
  for (const s of kaskadeSchluessel(ags)) {
    const t = _index.get(schluessel(kennzahl, s));
    if (t && t.length) return _zumStichtag(t);   /* v3010 */
  }
  return [];
}

/* ═══ v3010 · DER JAHRGANG ZUM WERTERMITTLUNGSSTICHTAG ══════════════════
   Marcel 27.10.2026: am Stichtag haengt auch die Wahl des Registerjahrgangs.
   § 10 ImmoWertV: es gilt das Modell, das am Stichtag galt. Fuehrt das Register
   fuer denselben Zweig (und dieselbe Lage) mehrere Jahrgaenge, fallen die heraus,
   deren Stichtag NACH dem Wertermittlungsstichtag liegt - aber nur, wenn ein
   aelterer desselben Zweigs bleibt (sonst bleibt alles, wie es war: ein juengerer
   Satz ist besser als keiner, und der Bericht nennt den Jahrgang).
   Gesetzt wird der Stichtag synchron um einen Abruf herum (mitRegisterStichtag);
   ohne ihn aendert sich nichts. */
let _stichtagKontext = null;
export function mitRegisterStichtag(iso, fn) {
  const alt = _stichtagKontext;
  _stichtagKontext = (iso && /^\d{4}-\d{2}-\d{2}$/.test(String(iso))) ? String(iso) : null;
  try { return fn(); } finally { _stichtagKontext = alt; }
}
function _satzTag(s) {
  const t = String((s && s.stichtag) || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const b = Number(s && s.berichtsjahr);
  return Number.isFinite(b) && b > 1900 ? String(b) + '-01-01' : null;
}
function _zumStichtag(liste) {
  if (!_stichtagKontext || liste.length < 2) return liste;
  const grp = (s) => [String(s.zweig || '').toLowerCase(), String(((s.geltungsbereich || {}).lage) || '').toLowerCase()].join('|');
  const hatAelteren = new Set(liste.filter((s) => { const d = _satzTag(s); return d && d <= _stichtagKontext; }).map(grp));
  return liste.filter((s) => { const d = _satzTag(s); return !(d && d > _stichtagKontext && hatAelteren.has(grp(s))); });
}

/** Ein Satz einer Kennzahl fuer einen Zweig (Objektart), oder null. */
/** Welche Lagen fuehrt dieses Gebiet fuer diesen Zweig?
 *
 *  Leere Liste heisst: es gibt nur einen Satz, die Lage spielt keine
 *  Rolle. Mehr als einer heisst: ohne Lage ist die Auswahl nicht
 *  entscheidbar. */
export function lagenFuer(kennzahl, ags, zweig) {
  const z = String(zweig || '').toLowerCase();
  const t = finde(kennzahl, ags).filter((s) => String(s.zweig || '').toLowerCase() === z);
  if (t.length < 2) return [];
  return t.map((s) => ((s.geltungsbereich || {}).lage) || null).filter(Boolean);
}

/**
 * Den Satz fuer einen Zweig finden — und, wo noetig, fuer eine LAGE.
 *
 * v1623 · BIS HIERHER NAHM DIESE FUNKTION DEN ERSTEN TREFFER. Solange
 * es je (ags, zweig) nur einen Satz gab, war das richtig. Die
 * niedersaechsische Ernte liefert aber MEHRERE — einen je Lageklasse,
 * und die Faktoren liegen weit auseinander: an Goslar reicht dieselbe
 * Stellung je nach Lage von 1,36 bis 1,00.
 *
 * Den ersten zu nehmen hiesse, eine Lage fuer alle gelten zu lassen.
 * Das faellt niemandem auf, weil ein Faktor mit falscher Lage genauso
 * aussieht wie einer mit richtiger.
 *
 * Deshalb: gibt es mehrere und ist keine Lage bestimmt, kommt `null`
 * zurueck — der Aufrufer sagt dann, dass die Lage fehlt, statt zu
 * raten. Eine geratene Lageklasse ist teurer als gar kein Wert (an
 * Rostock gemessen: 2,68 gegen 1,77).
 */
export function findeZweig(kennzahl, ags, zweig, lage) {
  const t = finde(kennzahl, ags);
  if (!t.length) return null;
  const z = String(zweig || '').toLowerCase();
  const passend = t.filter((s) => String(s.zweig || '').toLowerCase() === z);
  if (!passend.length) return null;
  if (passend.length === 1) return passend[0];

  /* Mehrere Saetze — die Lage entscheidet. */
  const l = String(lage || '').trim().toLowerCase();
  if (l) {
    const nachLage = passend.find((s) =>
      String(((s.geltungsbereich || {}).lage) || '').trim().toLowerCase() === l);
    if (nachLage) return nachLage;
  }

  /* ── v1816 · ZWEI JAHRGAENGE SIND KEINE MEHRDEUTIGKEIT ─────────────────
   *
   * GEMESSEN am 03.10.2026: 231 von 572 Abrufen scheiterten mit
   * `zweig_nicht_abgeleitet`, obwohl der Zweig im Register stand. Die
   * Ursache war hier: bei mehreren Saetzen und ohne Lageangabe gab diese
   * Funktion `null` zurueck. Die Saetze unterschieden sich aber gar nicht
   * in der Lage —
   *
   *     05711 Bielefeld  we_v  2023  2023-12-31  lage: (leer)
   *     05711 Bielefeld  we_v  2024  2024-12-31  lage: (leer)
   *
   * — sondern im JAHRGANG. Und dafuer gibt es eine Regel, keine Frage:
   * es gilt das Modell des Stichtags (§ 10 ImmoWertV), also der jüngste
   * Satz, der am Stichtag schon veroeffentlicht war.
   *
   *   > Zwei Treffer sind eine Frage, solange man nicht weiss, wodurch
   *   > sie sich unterscheiden. Weiss man es, ist es eine Regel.
   *
   * Nur wenn sich die Saetze WIRKLICH in der Lage unterscheiden, bleibt
   * es eine Frage — dann muss die Lage mitkommen. */
  const lagenVerschieden = new Set(passend.map((s) =>
    String(((s.geltungsbereich || {}).lage) || '').trim().toLowerCase())).size > 1;
  if (lagenVerschieden) return null;

  const jahr = (s) => {
    const t = String(s.stichtag || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const b = Number(s.berichtsjahr);
    return Number.isFinite(b) ? String(b) + '-12-31' : '0000-00-00';
  };
  const sortiert = passend.slice().sort((a, b) => (jahr(a) < jahr(b) ? 1 : jahr(a) > jahr(b) ? -1 : 0));
  return sortiert[0];
}

/** Ist fuer dieses Gebiet ueberhaupt etwas hinterlegt? */
export function hatEintrag(ags, kennzahl) {
  return finde(kennzahl, ags).length > 0;
}

/** Fuer Diagnose und Bericht. */
export function registerStand() {
  /* v1093-WSTD · Auch die Standmeldung loest die Saat aus.
   *
   * `finde()` laedt die Saatdatei beim ersten Zugriff selbst (v1083a-WLAZ).
   * `registerStand()` tat es nicht — wer also zuerst nach dem STAND fragte,
   * bekam "0 Saetze, Herkunft leer", obwohl das Register in Ordnung war.
   *
   * Genau der umgekehrte Fehler wie bei der Abfrage `--stand` aus v1084:
   * dort war die Auskunft gruen und wertlos, hier rot und falsch. Beide Male
   * lag es daran, dass die Auskunftsfunktion einen anderen Weg nimmt als der
   * Rechenweg. Eine Standmeldung, die den Zustand nicht herstellt, den sie
   * meldet, misst sich selbst. */
  if (!_index.size && _herkunft === 'leer') ladeSaat();
  /* v1093-WSTD · Die Laenderzaehlung. Seit v1093 traegt jeder Satz einen
   * abgeleiteten Landesschluessel; ohne diese Zeilen stuende er nur in der
   * Datei und waere keine Auskunft. Gezaehlt wird ueber die ersten beiden
   * Stellen des AGS — dieselbe amtliche Quelle, aus der er abgeleitet ist. */
  const LC = { '01':'SH','02':'HH','03':'NI','04':'HB','05':'NW','06':'HE',
               '07':'RP','08':'BW','09':'BY','10':'SL','11':'BE','12':'BB',
               '13':'MV','14':'SN','15':'ST','16':'TH' };
  const laender = {};
  for (const k of _index.keys()) {
    const c = LC[String(k.split('|')[1] || '').slice(0, 2)];
    if (c) laender[c] = (laender[c] || 0) + 1;
  }
  return { herkunft: _herkunft, ..._stand, laender,
           schluessel: _index.size,
           gebiete: new Set([..._index.keys()].map((k) => k.split('|')[1])).size };
}

/** Nur fuer Tests. */
export function _setzeRegister(saetze) {
  /* v1095-WMRG2 · DER MOCK MUSS DIE ECHTE SCHNITTSTELLE ABBILDEN.
   *
   * Bis v1094 setzte diese Testhilfe nur den Index, nicht die Saatliste.
   * Damit war `_saat` in jedem Test leer — und `ladeAusDb()` konnte gar
   * nichts "behalten", egal wie die Zusammenfuehrung gebaut war. Eine
   * Pruefung der Zusammenfuehrung haette IMMER nur die Tabelle gesehen und
   * das Ergebnis fuer richtig gehalten.
   *
   * Dieselbe Klasse wie der q()-Stub aus v1083, der `{rows: []}` lieferte,
   * wo die echte Funktion `res.rows` direkt gibt: ein Mock, der die
   * Schnittstelle nur halb nachbaut, prueft die halbe Wahrheit. */
  _saat = saetze;
  _index = indizieren(saetze); _herkunft = 'test'; _stand = { saetze: saetze.length };
}

export default { ladeSaat, ladeAusDb, finde, findeZweig, hatEintrag,
                 registerStand, kaskadeSchluessel };
