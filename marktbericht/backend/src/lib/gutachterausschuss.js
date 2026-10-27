// gutachterausschuss.js  (v1083-WKAS)
//
// DER AUFLOESER.
//
// Jeder Gutachterausschuss veroeffentlicht seine eigenen Daten in seiner
// eigenen Struktur. Es muss EINE Stelle geben, die entscheidet, welcher
// Ausschuss zustaendig ist. Sonst wandert die Kreispruefung in jedes Modul
// einzeln, und beim vierten vergisst sie jemand — genau so ist in v1060 der
// Vergleichsfaktor aus Minden-Luebbecke in einen Bericht fuer Hiddenhausen
// geraten.
//
// REGEL: kein Treffer heisst KEIN WERT. Nie ein Nachbarkreis, nie ein
// Landesmittel. Ein Sachwertfaktor gilt im Zustaendigkeitsbereich des
// Ausschusses, der ihn abgeleitet hat (§ 10 ImmoWertV).
//
// ── WAS SICH MIT v1083 AENDERT ────────────────────────────────────────────
//
// 1. DIE ZUSTAENDIGKEIT LAEUFT UEBER DIE KASKADE 8 -> 5 -> 3 -> 2,
//    nicht mehr ueber einen Vergleich auf fuenf Stellen.
//
//    Gemessen an schluessel.csv der Grundstuecksmarktdaten NRW (12.08.2026):
//    14 NRW-Kreise tragen MEHR ALS EINEN Gutachterausschuss.
//
//      Kreis Wesel   (05170)  Kreis · Dinslaken · Moers · Wesel
//      Mettmann      (05158)  Kreis · Ratingen · Velbert
//      Maerk. Kreis  (05962)  Kreis · Iserlohn · Luedenscheid
//      Minden-Luebb. (05770)  Kreis · Minden
//      Kreis Paderb. (05774)  Kreis · Stadt Paderborn
//      + neun weitere
//
//    Der alte Vergleich `a.ags_kreis === kreisAus(ags)` kann sie nicht
//    trennen. Der offene Punkt "Luedenscheid in den Aufloeser" waere damit
//    direkt in den Fehler gelaufen: Luedenscheid traegt 05962 wie der
//    Maerkische Kreis, und `find()` haette still den erstbesten genommen.
//
//    Mit der Kaskade traegt jeder Ausschuss seinen Schluessel auf der Ebene,
//    auf der er zustaendig ist — gemeindescharf achtstellig, kreisscharf
//    fuenfstellig — und die feinere Ebene gewinnt von selbst.
//
// 2. DAS REGISTER TRITT NEBEN DIE MODULE. Die beiden handgeschriebenen
//    Module bleiben stehen: sie tragen Umrechnungskoeffizienten und
//    Gartenland, die im Register (noch) nicht abgebildet sind. Gefragt wird
//    erst das Modul, dann das Register — nie umgekehrt.
//
// 3. NEU: liegenschaftszinssatz(). Kommt aus dem Register, deckt alle 73
//    NRW-Ausschuesse ab und traegt den Modellvermerk mit (GND, BWK-Quote,
//    Marktmiete) — ohne den darf der Zinssatz nicht verwendet werden
//    (§ 10 ImmoWertV, Modellkonformitaet).
//
// DIE RUECKGABEFORM BLEIBT UNVERAENDERT. Die Aufrufer merken nichts.

import { sachwertfaktor as swfMindenLuebbecke, SWF_STAND as ML_STAND }
  from './sachwertfaktoren_nrw.js';
import { sachwertfaktor as swfHerford, gartenlandAnsatz as gartenHerford,
  HF_STAND, HF_BEZUGSGROESSE_QM } from './sachwertfaktoren_herford.js';
import { UK_STAND as ML_UK } from './umrechnung_nrw.js';
import { finde, findeZweig, kaskadeSchluessel, registerStand }
  from './ausschuss_register.js';
import { auswerten } from './swf_modelle.js';   /* v1084-WSWF */

/** Die Ausschuesse mit handgeschriebenem Modul. `ags_schluessel` ist die
 *  Ebene, auf der sie zustaendig sind — beide kreisscharf, also fuenfstellig. */
export const AUSSCHUESSE = [
  {
    ags_schluessel: '05770',
    ags_kreis: '05770',            /* beibehalten: Altaufrufer lesen das Feld */
    name: ML_STAND.ausschuss,
    bericht: ML_STAND.bericht,
    berichtsjahr: ML_STAND.berichtsjahr,
    sachwertfaktor: swfMindenLuebbecke,
    gartenland: () => ({
      verfuegbar: true,
      vorschlag_eur_qm: ML_UK.gruenflaeche_eur_qm,
      spanne_eur_qm: ML_UK.gruenflaeche_spanne,
      quelle_text: ML_UK.bericht + ', ' + ML_UK.abschnitt,
      hinweis: 'Der Gutachterausschuss weist für private Grünflächen '
        + ML_UK.gruenflaeche_eur_qm + ' €/m² aus (Spanne '
        + ML_UK.gruenflaeche_spanne[0] + ' bis ' + ML_UK.gruenflaeche_spanne[1]
        + ' €/m²), unabhängig vom Bodenrichtwert — "die Kaufpreise weisen keine '
        + 'lagemäßige Abhängigkeit auf".',
    }),
    bezugsgroesse_qm: null,   /* kommt aus BORIS */
  },
  {
    ags_schluessel: '05758',
    ags_kreis: '05758',
    name: HF_STAND.ausschuss,
    bericht: HF_STAND.bericht,
    berichtsjahr: HF_STAND.berichtsjahr,
    sachwertfaktor: swfHerford,
    gartenland: gartenHerford,
    bezugsgroesse_qm: HF_BEZUGSGROESSE_QM,
    /* v1083-WHFL · Die Liegenschaftszinssaetze des GMB 2026 lagen seit v1073
     * ungenutzt in HF_STAND.lzs. Hier ist der Leseweg. Unabhaengig bestaetigt
     * durch die Grundstuecksmarktdaten NRW (Berichtsjahr 2024): ZFH 1,8 %. */
    lzs: HF_STAND.lzs,
    bwk: HF_STAND.bwk_2026,
  },
];

export function kreisAus(ags) {
  return String(ags || '').replace(/\D/g, '').slice(0, 5);
}

/**
 * Zustaendiger Ausschuss mit handgeschriebenem Modul, oder null.
 * Laeuft die Kaskade von fein nach grob — die feinere Ebene gewinnt.
 */
export function zustaendig(ags) {
  for (const s of kaskadeSchluessel(ags)) {
    const a = AUSSCHUESSE.find((x) => x.ags_schluessel === s);
    if (a) return a;
  }
  return null;
}

/** Namen der hinterlegten Ausschuesse, kurz — fuer Hinweistexte. */
function hinterlegteNamen() {
  return AUSSCHUESSE
    .map((x) => x.name.replace(/^Der Gutachterausschuss für Grundstückswerte /, ''))
    .join(' und ');
}

/**
 * Sachwertfaktor ueber den zustaendigen Ausschuss.
 * Gibt immer dieselbe Form zurueck — die Aufrufer muessen die Modelle nicht
 * kennen.
 */
/* ── v1084-WFELD · Zwei Bruecken, gemessen am echten Aufrufer ───────────
 *
 * CrossCheckService.js ruft sachwertfaktor({ ags, sachwert_eur, rnd_jahre,
 * bgf_qm, brw_eur_qm, objektart }). Die Rezepte des Registers sind in den
 * Namen geschrieben, in denen die Berichte ihre Achsen benennen: sachwert,
 * brw, rnd, bgf. Beides ist fuer sich richtig — aber ohne Uebersetzung
 * haette der Register-Zweig fuer JEDES Objekt 'achse_y_fehlt' gemeldet.
 * Das ist dieselbe Klasse wie ref.ags: gebaut, nie verdrahtet.
 *
 * Die Bruecke ist eine WEISSE LISTE. Ein Achsenfeld, das hier nicht steht,
 * kommt nicht an — und faellt im Auswerter als 'fehlt' auf, statt still
 * durch einen Standardwert ersetzt zu werden.
 *
 * Kategoriale Achsen (Wohnlage, Gebiet, Rheinseite) stehen bewusst NICHT
 * darin: sie werden im Formular nicht erhoben. Der Auswerter meldet dann
 * 'kategorie_fehlt', und der Bericht sagt es. Kein Verfahren rechnet halb. */
const FELDBRUECKE = {
  sachwert: ['sachwert_eur', 'vorlaeufiger_sachwert_eur', 'sachwert'],
  brw: ['brw_eur_qm', 'brw_sqm', 'brw'],
  rnd: ['rnd_jahre', 'restnutzungsdauer_jahre', 'rnd', 'restnutzungsdauer'],   /* v2860 · alle Aufrufer uebergeben 'restnutzungsdauer' (WertParameterService, PotenzialService, ReportOrchestrator) - ohne den Namen meldete jeder nach RND gestaffelte Zinssatz 'achse_fehlt' (gemessen Horb 08237040) */
  bgf: ['bgf_qm', 'bgf_direkt', 'bgf'],
  /* v1103-WWFL - Havelland staffelt seine Sachwertfaktoren im Berliner
     Umland nach Grundstuecks- UND WOHNflaeche. Die Wohnflaeche stand in
     keiner Bruecke; das Modell haette 'achse_y_fehlt' gemeldet, obwohl
     die Zahl im Formular seit jeher erhoben wird. */
  wohnflaeche: ['wohnflaeche_qm', 'wohnflaeche', 'living_area', 'wfl'],
  /* v1113-WKEL - die Altmark fuehrt die Unterkellerung als eigenes Glied
     ihrer Gleichung; vierzehn Prozentpunkte haengen daran. */
  unterkellerung: ['unterkellerung', 'keller_dg', 'keller'],
  /* v1105-WMOD - Cottbus unterscheidet seine Sachwertfaktoren nach dem
     MODERNISIERUNGSGRAD nach Anlage 2 ImmoWertV: 0 bis 6 Punkte gelten
     als unsaniert, ab 7 als teilsaniert bis saniert. Zwischen beiden
     liegen bei gleichem Baujahr bis zu acht Prozent. */
  mod_punkte: ['mod_punkte', 'modernisierungsgrad', 'modg'],


  baujahr: ['baujahr', 'build_year'],
  flaeche: ['grundstuecksflaeche_qm', 'flaeche_qm', 'gsfl', 'flaeche'],
  /* v3008b · Hamburg (swf-hh) nennt die Grundstuecksflaeche gsflaeche - reine Namensbruecke */
  gsflaeche: ['grundstuecksflaeche_qm', 'flaeche_qm', 'gsfl', 'flaeche'],
  baugrundstuecksflaeche: ['baugrundstuecksflaeche_qm',
    'grundstuecksflaeche_qm', 'flaeche_qm', 'gsfl'],
  baulandflaeche: ['baulandflaeche_qm', 'grundstuecksflaeche_qm', 'gsfl'],
  lagewert: ['lagewert', 'brw_eur_qm', 'brw_sqm'],
  /* v1088 */
  gebaeudestandard: ['gebaeudestandard', 'standardstufe'],
  /* v1101-WSTD - GEMESSEN, nicht vermutet: `gebaeudestandard` stand seit
     v1088 in dieser Bruecke und wurde von KEINEM Rezept benutzt. Die
     Rezepte nennen die Achse `standardstufe` - Wolfenbuettel als
     Korrektur (bis 0,81 bis 1,21, also bis 21 Prozent!), Teltow-Flaeming
     als Kategorieachse. Beide liefen damit ins Leere: Wolfenbuettel
     rechnete still OHNE die Standardstufenkorrektur, Teltow-Flaeming
     haette `kategorie_fehlt` gemeldet.

     Der Eintrag darueber bleibt stehen - er kostet nichts und faengt ein
     Rezept ab, das den anderen Namen waehlt. */
  standardstufe: ['standardstufe', 'gebaeudestandard'],
  ort: ['ort', 'gemeinde_name', 'gemeinde', 'stadt'],
  /* v1102-WORT - der Ortsteil ist EIGENSTAENDIG und faellt NICHT auf den
     Gemeindenamen zurueck: wer nach einem Ortsteil zuordnet, meint den
     Ortsteil. Ein stiller Rueckfall auf die Gemeinde koennte in eine
     andere Region zeigen. */
  ortsteil: ['ortsteil', 'stadtteil', 'district'],

};

/* v1096a-WVOK · EIN VOKABULAR, NICHT ZWEI.
 *
 * `eingabeBruecke()` uebersetzt die langen Feldnamen in die kurzen, die der
 * Auswerter des Registers liest. Die zwei handgeschriebenen Module gehen
 * den anderen Weg: sie bekommen das Objekt ROH und lesen ausschliesslich
 * die LANGEN Namen aus ihrer Signatur.
 *
 * Damit verstand `sachwertfaktor({ags, sachwert})` das Register, aber nicht
 * Herford und Minden-Luebbecke — ausgerechnet die beiden Ausschuesse, an
 * denen die Regressionswerte des Projekts haengen. Aufgefallen ist es beim
 * ersten Einsatz des Abnahme-Endpunkts: `sachwert_fehlt`, obwohl der
 * Sachwert danebenstand.
 *
 * Diese Funktion ist die Rueckrichtung der Bruecke und ERGAENZT nur: was
 * der Aufrufer schon in der langen Schreibweise mitgibt, bleibt
 * unangetastet. Ein Aufrufer, der beide Namen mit verschiedenen Werten
 * fuellt, bekommt also weiterhin seinen eigenen Wert — nicht meinen.
 *
 * Die Module selbst werden NICHT umgeschrieben. Sie sind gegen ihre
 * Anwendungsbeispiele belegt; ihre Feldnamen stehen in ihren Signaturen. */
const MODULBRUECKE = {
  sachwert_eur: ['sachwert_eur', 'vorlaeufiger_sachwert_eur', 'sachwert'],
  brw_eur_qm: ['brw_eur_qm', 'bodenrichtwert_eur_qm', 'brw_sqm', 'brw'],
  rnd_jahre: ['rnd_jahre', 'restnutzungsdauer_jahre', 'rnd'],
  bgf_qm: ['bgf_qm', 'bgf_direkt', 'bgf'],
  grundstuecksflaeche_qm: ['grundstuecksflaeche_qm', 'flaeche_qm', 'gsfl',
                           'flaeche'],
};

function fuerModul(o) {
  const e = { ...(o || {}) };
  for (const [ziel, quellen] of Object.entries(MODULBRUECKE)) {
    if (e[ziel] != null && e[ziel] !== '') continue;
    for (const q of quellen) {
      if (e[q] != null && e[q] !== '') { e[ziel] = e[q]; break; }
    }
  }
  return e;
}

function eingabeBruecke(o) {
  const e = { ...(o || {}) };
  for (const [ziel, quellen] of Object.entries(FELDBRUECKE)) {
    if (e[ziel] != null && e[ziel] !== '') continue;
    for (const q of quellen) {
      if (o[q] != null && o[q] !== '') { e[ziel] = o[q]; break; }
    }
  }
  return e;
}

/* v1084-WZWG · Objektart -> Zweig des Registers.
 *
 * Das Formular fuehrt deutschen Klartext ("Zweifamilienhaus"), das Register
 * die Kuerzel der Berichte (zfh, ezfh, rhdhh). Uebersetzt wird ueber eine
 * Vorzugsliste, und in der stehen NUR Zweige, die die Objektart wirklich
 * einschliessen: ein Einfamilienhaus darf auf 'ezfh' fallen, weil der
 * Bericht dort ausdruecklich "Ein- und Zweifamilienhaeuser" meint — aber
 * niemals auf 'rhdhh', denn die Anbauweise ist eine andere Sache.
 *
 * KEIN TREFFER HEISST KEIN WERT. Insbesondere gibt es keinen Rueckfall
 * "das Register fuehrt ohnehin nur einen Zweig, dann nimm den" — das waere
 * ein stiller Rueckfall und wuerde einer Eigentumswohnung den Faktor fuer
 * Einfamilienhaeuser geben. */
/* === v1341 - HIER STANDEN ECHTE BACKSPACE-ZEICHEN ===================
   In dieser Tabelle standen an zwanzig Stellen BACKSPACE-Zeichen (0x08),
   wo eine Wortgrenze \\b hingehoert. Der Unterschied ist im Editor,
   in `grep` und selbst in `String(regex)` UNSICHTBAR:

     String(Z[7][0])  ->  /einfamilien|efh|freistehend/i      sieht richtig aus
     Z[7][0].test("Einfamilienhaus")  ->  true
     Z[7][0].test("EFH")              ->  FALSE

   Sichtbar wurde es erst ueber `JSON.stringify` (dort wird 0x08 als \\b
   ausgegeben) und ueber `file`, das die Datei die ganze Zeit mit
   "with overstriking" gemeldet hat - zweimal ueberlesen.

   WAS DAS ANGERICHTET HAT: unsere Oberflaeche liefert Kurzformen (EFH,
   ETW, MFH, RH, DHH). Genau die wurden von dieser Tabelle NIE erkannt.
   Nur wenn der Registerzweig zufaellig gleich hiess wie die Kurzform in
   Kleinschrift, griff der direkte Weg davor.

   GEMESSEN am 12.09.2026 mit ptype "EFH":

     Remscheid  (Zweig "efh")   -> 1,08     direkter Weg, ging
     Olpe       (Zweig "efh")   -> 0,92     direkter Weg, ging
     Potsdam    (Zweig "ezfh")  -> NICHTS   "objektart_nicht_abgeleitet"
     Uckermark  (Zweig "ezfh")  -> NICHTS

   Mit `objektart: "ezfh"` liefert Potsdam 1,06. Der Faktor lag also die
   ganze Zeit im Register und der Bericht meldete "kein Sachwertfaktor
   abgeleitet" - eine Fehlanzeige, die wie ein Befund aussieht.

   Wer diese Tabelle anfasst: Escape-Sequenzen NIE tippen, immer
   generieren. Ein Werkzeug, das \\b als Steuerzeichen liest, hinterlaesst
   genau diesen Schaden, und er ueberlebt jedes Gegenlesen. */
const ZWEIG_VORZUG = [

  [/eigentumswohnung|\betw\b|\bwhg\b|wohnung/i, ['etw', 'we', 'wohnung']],
  [/mehrfamilien|\bmfh\b/i, ['mfh', 'mfh_bis6', 'mfh_ueber6']],
  [/dreifamilien|\bdreifh\b/i, ['dreifh']],
  [/reihenmittel|\brmh\b/i, ['rmh', 'rh', 'rhdhh']],
  /* v1114-WREH - REIHENENDHAUS UND DOPPELHAUSHAELFTE GETRENNT.
     Beide trafen bisher DIESELBE Zeile und suchten in derselben
     Reihenfolge - ein Reihenendhaus bekam damit den Satz der
     Doppelhaushaelfte, sobald ein Ausschuss beide getrennt fuehrt.
     Leipzig tut genau das: 1,21 fuer Reihenendhaeuser, 1,18 fuer
     Doppelhaushaelften. Drei Prozent, still. */
  [/reihenend|\breh\b/i, ['reh', 'rhdhh', 'rh', 'dhh']],
  [/doppelhaus|\bdhh\b/i, ['dhh', 'rhdhh', 'rh']],
  [/reihenhaus|\brh\b/i, ['rh', 'rhdhh', 'rmh']],
  [/zweifamilien|\bzfh\b/i, ['zfh', 'ezfh']],
  [/einfamilien|\befh\b|freistehend/i, ['efh', 'ezfh']],
  [/fertighaus/i, ['fertighaus']],
];

/* v1088-WBJ · Mehrere Tabellen derselben Objektart, getrennt nach BAUJAHR.
 *
 * Erfurt fuehrt freistehende Haeuser bis 1990 ohne Bodenrichtwertachse und
 * ab 1991 mit — zwei eigene Tabellen. Im eindeutigen Schluessel der Tabelle
 * kollidieren sie, deshalb traegt der Zweig die Gruppe (`efh_bis1990`) und
 * das Feld `objektart` die Art.
 *
 * OHNE BAUJAHR GIBT ES KEINEN WERT, wenn mehrere Gruppen in Frage kommen.
 * Die falsche der beiden zu nehmen waere ein stiller Rueckfall. */
function passtZumBaujahr(s, bj) {
  const von = s.baujahr_von, bis = s.baujahr_bis;
  if (von == null && bis == null) return true;
  const j = Number(bj);
  if (!Number.isFinite(j) || j <= 0) return false;
  if (von != null && j < von) return false;
  if (bis != null && j > bis) return false;
  return true;
}

function nachArt(reg, code) {
  /* v1089-WART2 · Gegen BEIDE Felder vergleichen.
   *
   * `objektart || s.zweig` allein war zu wenig: traegt ein Datensatz in
   * `objektart` versehentlich eine Beschriftung statt eines Kuerzels
   * ("Ein-/Zweifamilienhaus, Doppelhaushaelfte, ..."), faellt der Vergleich
   * aus — UND der Rueckfall auf den Zweig kommt nie zum Zug, weil das erste
   * Feld gesetzt ist. Muenchen und die Resthofstellen lieferten deshalb
   * "objektart_nicht_abgeleitet", obwohl ihr Zweig genau passte. */
  return reg.filter((s) => {
    const z = String(s.zweig || '').toLowerCase().trim();
    const a = String(s.objektart || '').toLowerCase().trim();
    return z === code || a === code;
  });
}

function waehleAusGruppe(kandidaten, baujahr) {
  if (!kandidaten.length) return null;
  if (kandidaten.length === 1) return kandidaten[0];

  /* v1093-WJG · ZUERST DEN JAHRGANG, DANN DIE BAUJAHRSGRUPPE.
   *
   * Der eindeutige Schluessel von mb.param_modell traegt das Berichtsjahr —
   * ausdruecklich, damit zwei Jahrgaenge desselben Ausschusses konfliktfrei
   * nebeneinander stehen koennen (Iserlohn und der Maerkische Kreis fuehren
   * sechs). Potsdam druckt seinen Vorjahrgang mit ab und steht deshalb
   * zweimal unter demselben Zweig.
   *
   * Ohne diese Zeilen sah `waehleAusGruppe` ZWEI Kandidaten, hielt sie fuer
   * zwei Baujahrsgruppen (v1088-WBJ), fand keine passende und gab null —
   * "objektart_nicht_abgeleitet", obwohl der Ausschuss die Objektart sehr
   * wohl fuehrt. Die Zeitreihe, die eine Staerke sein sollte, machte den
   * Datensatz unerreichbar.
   *
   * DER JUENGSTE JAHRGANG GILT, die aelteren sind Dokumentation. Verglichen
   * wird nur, wenn die Jahrgaenge sich UNTERSCHEIDEN — bei gleichem Jahrgang
   * bleibt es bei der Baujahrsfrage, und die entscheidet weiterhin sie. */
  const jahre = kandidaten.map((s) => s.berichtsjahr ?? null);
  if (new Set(jahre).size > 1) {
    const neuestes = Math.max(...jahre.map((j) => Number(j) || 0));
    const jung = kandidaten.filter((s) => (Number(s.berichtsjahr) || 0) === neuestes);
    if (jung.length) kandidaten = jung;
    if (kandidaten.length === 1) return kandidaten[0];
  }

  const passend = kandidaten.filter((s) => passtZumBaujahr(s, baujahr));
  if (passend.length === 1) return passend[0];
  /* Mehrere oder keine Gruppe passt: kein Wert. Lieber nichts als die
   * falsche Tabelle. */
  return null;
}

function zweigWaehlen(reg, gefuehrt, objektart, baujahr) {
  const t = String(objektart || '').trim();
  if (!t) return null;

  const direkt = nachArt(reg, t.toLowerCase());
  if (direkt.length) return waehleAusGruppe(direkt, baujahr);

  for (const [muster, vorzug] of ZWEIG_VORZUG) {
    if (!muster.test(t)) continue;
    for (const z of vorzug) {
      const k = nachArt(reg, z);
      if (k.length) return waehleAusGruppe(k, baujahr);
    }
    return null;          /* erkannt, aber der Ausschuss fuehrt sie nicht */
  }
  return null;
}

/* ── v1085-WKAS · DER SACHWERTFAKTOR FAELLT NIE AUF LANDESEBENE ─────────
 *
 * Gemessen an der Laenderrecherche vom 13.08.: eine Landesebene fuer
 * Sachwertfaktoren existiert in vier von sechzehn Laendern — Berlin und
 * Hamburg (Stadtstaaten, dort IST die Gemeinde das Land), Hessen und
 * Rheinland-Pfalz. Bayern und Baden-Wuerttemberg verweisen in ihren
 * Landesberichten ausdruecklich auf die oertlichen Ausschuesse.
 *
 * Ein Landeswert waere deshalb fast ueberall ein von uns gemittelter Wert,
 * kein amtlicher. "KEIN TREFFER HEISST KEIN WERT" gilt auch nach oben.
 *
 * Beim Liegenschaftszinssatz ist die Landesebene dagegen in acht Laendern
 * amtlich belegbar — dort bleibt die volle Kaskade.
 *
 * Umgesetzt ueber die Ebene des gefundenen Satzes, nicht ueber die Laenge
 * des Schluessels: ein Stadtstaat traegt seinen Satz auf acht Stellen und
 * ist trotzdem das ganze Land. */
const EBENE_GESPERRT = {
  sachwertfaktor: new Set(['bezirk', 'land', 'bund']),
  /* v1339: Ein Erbbaurechtskoeffizient ist das Verhaeltnis zweier
     oertlicher Kaufpreise. Ein Landes- oder Bundesmittel davon hat keine
     Bedeutung - dieselbe Sperre wie beim Sachwertfaktor. */
  erbbaurechtskoeffizient: new Set(['bezirk', 'land', 'bund']),
};

function ebeneErlaubt(kennzahl, satz) {
  const g = EBENE_GESPERRT[kennzahl];
  return !g || !g.has(String(satz && satz.ebene || ''));
}

/* v1085-WVOL · Ein unvollstaendiger Datensatz rechnet nicht.
 *
 * Berlins Liegenschaftszinssatz traegt `vollstaendig: false`, weil die
 * Altbezirks-Korrektur — laut Anwendungshinweis Pflichtbestandteil — nur in
 * einem einzigen Lesedurchgang belegt ist. Der Satz gehoert ins Register:
 * er dokumentiert, WAS der Ausschuss fuehrt. Eine Zahl liefert er nicht. */
function unvollstaendig(satz) {
  if (!satz || satz.vollstaendig !== false) return null;
  return { verfuegbar: false, grund: 'datensatz_unvollstaendig',
    hinweis: 'Für diesen Ausschuss liegt der Datensatz nur unvollständig vor'
      + (satz.unvollstaendig_grund ? ': ' + satz.unvollstaendig_grund : '.')
      + ' Gerechnet wird damit nicht.',
    ausschuss: satz.gaa_name || null,
    stichtag: satz.stichtag || null, berichtsjahr: satz.berichtsjahr ?? null,
    quelle_url: satz.quelle_url || null, lizenz: satz.lizenz || null };
}

/* v1084-WSWF · Der Register-Weg, ausgelagert, damit sachwertfaktor() lesbar
 * bleibt. Gibt null zurueck, wenn das Register fuer dieses Gebiet nichts
 * fuehrt — dann greift die Meldung "kein Ausschuss hinterlegt". */
/**
 * v1624 · Aus Gemarkung oder Gemeinde die LAGEKLASSE bestimmen.
 *
 * Die Ausschuesse veroeffentlichen die Zuordnung selbst — sie liegt im
 * Registersatz unter `geltungsbereich.zuordnung`. Zwei Formen, beide
 * aus der Ernte am 26.09.2026:
 *
 *   `gemarkung` — eine Tabelle Gemarkung -> Lageklasse (Goslar, 24
 *      Eintraege). BORIS nennt die Gemarkungsnummer SECHSstellig mit
 *      Landespraefix (036271), das Dashboard VIERstellig (6271); darum
 *      wird auf die letzten vier Stellen verglichen.
 *   `gemeinde` — die Lagenamen nennen die Gemeinden selbst, durch
 *      Komma getrennt, teils mit Koeffizient in eckigen Klammern
 *      ("Helmstedt, Koenigslutter [1,00]").
 *
 * Gibt `null` zurueck, wenn sich nichts sicher zuordnen laesst. DAS IST
 * DER NORMALFALL FUER EINEN UNBEKANNTEN ORT und kein Fehler — der
 * Aufrufer meldet dann `lage_noetig`. Eine halb passende Zuordnung
 * waere schlimmer als keine: ein Faktor mit falscher Lage sieht aus wie
 * einer mit richtiger.
 */
function lageAusOrt(saetze, o) {
  const norm = (s) => String(s || '').trim().toLowerCase()
    .replace(/\s*\[.*?\]\s*$/, '')          /* Koeffizient abschneiden */
    .replace(/[^a-zäöüß0-9]+/g, '');
  const z = (saetze[0].geltungsbereich || {}).zuordnung || {};

  /* Weg 1: die Gemarkungstabelle des Ausschusses. */
  if (z.art === 'gemarkung' && Array.isArray(z.tabelle) && z.tabelle.length) {
    const nr = String(o.gemarkungsnr || '').replace(/\D/g, '');
    const kurz = nr.length > 4 ? nr.slice(-4) : nr;
    const name = norm(o.gemarkung);
    const treffer = z.tabelle.find((e) => {
      const en = String(e.gemarkungsnr || '').replace(/\D/g, '');
      if (kurz && en && (en === kurz || en.slice(-4) === kurz)) return true;
      return !!name && norm(e.gemarkung) === name;
    });
    return treffer ? treffer.lageklasse : null;
  }

  /* Weg 2: die Lagenamen nennen Orte. Getroffen wird nur ein
     VOLLSTAENDIGER Name — "Lehre" darf nicht auf "Lehrte" passen.

     ORTSTEIL VOR GEMEINDE. Salzgitter staffelt nach ORTSTEILEN ("Barum,
     Beddingen, Beinum, …"), Helmstedt nach GEMEINDEN ("Lehre, Velpke").
     Wer nur die Gemeinde prueft, findet in Salzgitter nie etwas — dort
     heisst die Gemeinde immer "Salzgitter". Gemessen am 26.09.2026. */
  const kandidaten = [o.ortsteil, o.ort, o.gemeinde].map(norm).filter(Boolean);
  if (!kandidaten.length) return null;
  for (const k of kandidaten) {
    for (const s of saetze) {
      const lage = (s.geltungsbereich || {}).lage;
      if (!lage) continue;
      const teile = String(lage).replace(/\s*\[.*?\]\s*$/, '').split(/,|\bund\b/);
      if (teile.some((t) => norm(t) === k)) return lage;
    }
  }
  return null;
}

function ausRegisterRechnen(o, ags) {
  /* v1084-WSWF · Kein Modul — dann rechnet das Register.
   *
   * Bis v1083 stand hier "Registereintrag vorhanden, aber kein Auswerter".
   * Der Auswerter lag seit v1083 vor und rechnete 37 Pruefungen richtig — er
   * wurde nur nie gefragt. Ab hier wird er gefragt.
   *
   * DIE RUECKGABEFORM BLEIBT DIESELBE wie beim handgeschriebenen Modul. */
  const roh = finde('sachwertfaktor', ags);
  /* v1085-WKAS · Ein Satz auf Bezirks-, Landes- oder Bundesebene zaehlt
   * beim Sachwertfaktor als kein Satz. */
  const reg = roh.filter((s) => ebeneErlaubt('sachwertfaktor', s));
  if (!reg.length) return null;      /* faellt auf 'kein_ausschuss_hinterlegt' */

  /* ═══ v1623 · DIE LAGE WIRD VOR DER ZWEIGWAHL AUFGELOEST ════════════
     Sie MUSS hier stehen, nicht danach. `waehleAusGruppe` sieht zwei
     Saetze desselben Zweigs, haelt sie fuer zwei BAUJAHRSGRUPPEN, findet
     keine passende und gibt null — der Bericht sagt dann
     "objektart_nicht_abgeleitet", obwohl der Ausschuss die Objektart
     sehr wohl fuehrt. Genau diese Falle beschreibt der Kommentar bei
     v1093 fuer die Jahrgaenge; Lageklassen laufen hinein wie sie.

     Also werden die Lagevarianten ZUERST ausgesiebt, und `zweigWaehlen`
     sieht danach hoechstens einen Satz je Zweig. */
  const mitLage = reg.filter((s) => ((s.geltungsbereich || {}).lage));
  if (mitLage.length) {
    const gewuenscht = String(o.lage || o.lageklasse
      || lageAusOrt(mitLage, o) || '').trim().toLowerCase();
    const lagen = [...new Set(mitLage.map((s) => s.geltungsbereich.lage))];
    const behalten = gewuenscht
      ? reg.filter((s) => {
          const l = (s.geltungsbereich || {}).lage;
          return !l || String(l).trim().toLowerCase() === gewuenscht;
        })
      : [];
    /* Ohne Lage, oder mit einer, die es hier nicht gibt: KEIN Wert.
       Irgendeinen Satz zu nehmen faellt niemandem auf - ein Faktor mit
       falscher Lage sieht aus wie einer mit richtiger. An Goslar reicht
       dieselbe Stellung je nach Lage von 1,36 bis 1,00.

       Die Lage ist bestimmbar, nicht zu raten: BORIS gibt zur Anschrift
       `Gemarkungsnummer` und `Gemeindesname` zurueck, und die
       Ausschuesse veroeffentlichen die Zuordnung selbst. */
    if (!behalten.length || !behalten.some((s) => (s.geltungsbereich || {}).lage)) {
      return {
        verfuegbar: false,
        grund: gewuenscht ? 'lage_unbekannt' : 'lage_noetig',
        hinweis: 'Dieser Gutachterausschuss staffelt den Sachwertfaktor nach '
          + 'Lageklassen, und sie liegen weit auseinander. '
          + (gewuenscht
              ? 'Die angegebene Lage „' + (o.lage || o.lageklasse) + '" ist hier nicht geführt. '
              : 'Ohne die Lage lässt sich nicht entscheiden, welcher Faktor gilt. ')
          + 'Geführt werden: ' + lagen.join(' · ') + '. '
          + 'Eine geratene Lage wäre teurer als gar kein Wert.',
        ausschuss: mitLage[0].gaa_name || null,
        lagen,
        lage_zuordnung: (mitLage[0].geltungsbereich || {}).zuordnung || null,
      };
    }
    reg.length = 0; behalten.forEach((s) => reg.push(s));
  }

  const gefuehrt = reg.map((x) => String(x.zweig || '').toLowerCase());
  let satz = zweigWaehlen(reg, gefuehrt, o.zweig || o.objektart,
                          o.baujahr || o.build_year);   /* v1088-WBJ */


  if (!satz) {
    return { verfuegbar: false, grund: 'objektart_nicht_abgeleitet',
      hinweis: 'Der Gutachterausschuss hat für diese Objektart keinen '
        + 'Sachwertfaktor abgeleitet. Geführt werden: ' + gefuehrt.join(', ')
        + '. Faktoren anderer Objektarten dürfen nicht übertragen werden '
        + '(§ 10 ImmoWertV).',
      ausschuss: reg[0].gaa_name || null,
      gefuehrte_zweige: gefuehrt };
  }

  const luecke = unvollstaendig(satz);        /* v1085-WVOL */
  if (luecke) { luecke.zweig = satz.zweig; return luecke; }

  /* ═══ v1886-WFW · DIE MODELLANSAETZE REISEN MIT ════════════════════════
     GEMESSEN an Hamburg: der Sachwertfaktor ist ein Produkt aus 19
     Faktoren, und zwei davon — Stadtteilfaktor und Aktualisierungsfaktor —
     liegen NICHT in `formel`, sondern in `modellansaetze`
     (`stadtteilfaktoren`, `aktualisierung`). Der Auswerter bekam bisher nur
     `formel` und konnte sie deshalb nicht finden.

     > Eine Teiltabelle, die im Satz liegt und den Rechenkern nie erreicht,
     > sieht genauso aus wie eine, die fehlt.

     Fuer alle anderen Formen aendert das nichts: sie lesen das Feld nicht. */
  /* v3008b · Groessen, die der Kern aus vorhandenen Zahlen RECHNEN kann, statt sie als
     fehlendes Merkmal zu melden: Bodenwertanteil = Bodenwert / vorlaeufiger Sachwert;
     Sachwertverhaeltnis = vorlaeufiger Sachwert / Normsachwert - nur, wenn der Satz den
     Normsachwert als ZAHL fuehrt (modellansaetze.normsachwert_eur). Eine Angabe des
     Aufrufers geht vor. */
  const _einSwf = eingabeBruecke(o);
  {
    const _swE = Number(_einSwf.sachwert_eur), _bwE = Number(_einSwf.bodenwert_eur);
    const _nsw = Number((satz.modellansaetze || {}).normsachwert_eur);
    if (_einSwf.bodenwertanteil == null && _swE > 0 && _bwE >= 0 && _einSwf.bodenwert_eur != null) {
      _einSwf.bodenwertanteil = Math.round(_bwE / _swE * 10000) / 10000;
    }
    if (_einSwf.sachwertverhaeltnis == null && _swE > 0 && _nsw > 0) {
      _einSwf.sachwertverhaeltnis = Math.round(_swE / _nsw * 10000) / 10000;
    }
  }
  const r = auswerten({ ...(satz.formel || {}),
                        kennzahl: 'sachwertfaktor',
                        modellansaetze: satz.modellansaetze || null,
                        korrekturen: satz.korrekturen || [] },
                      _einSwf);
  /* v3008b · W1 · KEIN SACHWERTFAKTOR MIT FEHLENDER ANPASSUNG (§ 10 Abs. 1, § 21 Abs. 3
     ImmoWertV - der Faktor gilt nur in seinem Modell). Dieselbe Pruefung wie beim
     Vergleichsfaktor: jede Korrektur des Satzes ist angewandt oder liegt in der Norm;
     sonst kein Wert, sondern der Grund mit dem Merkmal (gemessen 27.10.2026: Hamburg
     rechnete mit 2 von 19 Korrekturen). */
  if (r && r.verfuegbar) {
    const _kz = _korrekturenPruefen(satz.korrekturen, _einSwf, r.korrekturen_offen);
    const _bl = _kz.filter((z) => z.status !== 'norm');
    if (_bl.length) {
      const _t = (z) => z.status === 'merkmal_fehlt' ? 'Merkmal fehlt: ' + z.bez + ' (eintragen: ' + _eintragenText(z.feld) + ')'
        : z.status === 'ausserhalb' ? z.bez + ': Angabe ' + z.wert + ' liegt außerhalb der Tabelle des Ausschusses'
          + (z.spanne ? ' (' + z.spanne[0] + ' bis ' + z.spanne[1] + ')' : '') + ' — nicht auf Rand oder Norm gesetzt'
          : z.bez + ': Anpassung im Dokument genannt, ihre Werte liegen nicht rechenbar vor';
      r.faktor_ohne_anpassung = r.wert;
      r.verfuegbar = false;
      r.wert = null;
      r.grund = _bl.some((z) => z.status === 'merkmal_fehlt') ? 'merkmal_fehlt' : 'korrektur_nicht_anwendbar';
      r.korrekturen_offen = _bl;
      r.hinweis = 'Der Sachwertfaktor des Gutachterausschusses (' + (satz.gaa_name || '–') + ') ist an das Objekt '
        + 'anzupassen. Offen: ' + _bl.map(_t).join('; ') + '. Ohne diese Anpassung wird kein Sachwertfaktor angesetzt '
        + '(§ 21 Abs. 3, § 10 Abs. 1 ImmoWertV); der Sachwert bleibt vorläufig.';
    }
  }

  /* Auch der Misserfolg traegt seine Herkunft — sonst steht im Bericht
   * "kein Wert" ohne zu sagen, WER nichts abgeleitet hat. */
  r.ausschuss = satz.gaa_name || null;
  r.herkunft = 'register';
  r.zweig = satz.zweig;
  r.stufe = satz.stufe || null;
  r.fallzahl = satz.fallzahl ?? null;
  r.streuung = satz.streuung ?? null;
  r.stichtag = satz.stichtag || null;
  r.berichtsjahr = satz.berichtsjahr ?? null;
  r.modellversion = satz.modellversion || null;
  r.modellform = (satz.formel || {}).form || null;
  r.fundstelle = satz.fundstelle || null;
  r.quelle_url = satz.quelle_url || null;
  r.quellenvermerk = satz.quellenvermerk || null;
  r.lizenz = satz.lizenz || null;
  r.geltungsbereich = satz.geltungsbereich || null;
  r.beleg = (satz.belege || [])[0] || null;

  /* === v1338 - DIE GESAMTNUTZUNGSDAUER DES MODELLS ====================
     Marcels Frage aus dem Gutachten zu Wolfenbuettel: "Steckst du eine
     Zahl aus dem 80er-Rahmen in ein 70er-Modell, ist das Ergebnis nicht
     mehr modellkonform nach Paragraf 21 Abs. 3."

     Er hat recht, und es traf uns selbst. GEMESSEN im Register:

       38 Saetze fuehren gnd_jahre 70
        4 Saetze fuehren 80
        5 Saetze fuehren 60
       73 Saetze fuehren sie ausdruecklich als null (nicht abgedruckt)

     Und `CrossCheckService.js:24` rechnete ausnahmslos mit einer
     Konstanten: `const GND_JAHRE = 80`. Der Wert stand also seit jeher
     im Register und wurde von NIEMANDEM abgeholt - dasselbe Muster wie
     `restnutzungsdauer_herkunft` (v1337) und `dealpilot_marktbewertung`.

     Was das kostet: bei Alter 30 ergibt GND 70 eine Restnutzungsdauer
     von 40 Jahren, GND 80 eine von 50. An einem Reihenhaus mit rund
     176.000 Euro Herstellungskosten sind das etwa 25.000 Euro
     Gebaeudesachwert - lautlos.

     `null` ist hier eine ANTWORT, keine Luecke: der Bericht des
     Ausschusses druckt dann keine Zahl, und der Wert eines Nachbarkreises
     darf nicht einspringen. Genau das steht in der Saatdatei fuer
     Braunschweig-Wolfsburg woertlich. */
  const _ma = satz.modellansaetze || {};
  /* ═══ v1130-WGND3 · DREI SCHREIBWEISEN, EIN FELD ═══════════════════════
     GEMESSEN am 14.09.2026, und es ist die dritte Stufe derselben Falle.

     Hier stand nur `_ma.gnd_jahre`. Die Rezepte schreiben die
     Gesamtnutzungsdauer aber unter DREI Namen:

       gnd_jahre                 Brandenburg (wird gelesen)
       gesamtnutzungsdauer_jahre Wolfenbuettel (wurde NICHT gelesen)
       gnd                       Koeln, Duesseldorf, Hessen (NICHT gelesen)

     Die Folge: Oberursel rechnet mit GND 70, schrieb sie ordentlich ins
     Rezept — und der Auswerter nahm weiter 80. Zwischen beiden liegen an
     einem Reihenhaus rund 25.000 Euro Gebaeudesachwert.

     Der Fehler war zweimal derselbe und zweimal unsichtbar: erst stand
     die Zahl nur im Fliesstext (v1129), dann im falschen Feld. Beide Male
     sah der Datensatz vollstaendig aus.

     ALLE DREI NAMEN werden jetzt gelesen. Das ist robuster, als 150
     Rezepte zu vereinheitlichen — und es kostet nichts: wo mehrere
     stehen, gewinnt der spezifischste zuerst. Ein Text statt einer Zahl
     ("gemaess Anlage 1 ImmoWertV") ergibt weiterhin `null`, und null ist
     eine Antwort: dann druckt der Bericht keine Zahl. */
  /* v2390 · dieselbe Regel jetzt als gemeinsamer Helfer - der
     Liegenschaftszinssatz liest sie seitdem ebenfalls (gndAusModellansaetzen). */
  r.modell_gnd_jahre = gndAusModellansaetzen(_ma);
  r.modell_gnd_hinweis = _ma.gnd_hinweis || _ma.hinweis || null;
  r.modell_gnd_beleg = _ma.gnd_beleg || null;
  r.modell_gnd_warnung = _ma.gnd_warnung || null;
  r.modellansaetze = _ma;

  return r;
}

/* ═══ v2390 · MODELLANSAETZE EINES SATZES ALS ZAHL ═══════════════════════
   Die Gesamtnutzungsdauer in den drei Schreibweisen der Rezepte (v1130):

       gnd_jahre  >  gesamtnutzungsdauer_jahre  >  gnd

   BEWUSST NICHT gelesen: `gesamtnutzungsdauer` (ohne _jahre). So heisst in
   den NRW-Open-Data-Saetzen die mittlere GND der KAUFFAELLE, eine
   Stichprobenkennzahl - gemessen am 19.10.2026: Werte wie 43, 53, 81, 82
   neben der Modell-GND 80. Ein Mittelwert ist kein Modellansatz.
   Ein Text ("gemaess Anlage 1") ergibt null - null ist eine Antwort. */
export function gndAusModellansaetzen(ma) {
  const m = ma || {};
  const roh = (m.gnd_jahre != null) ? m.gnd_jahre
            : (m.gesamtnutzungsdauer_jahre != null) ? m.gesamtnutzungsdauer_jahre
            : (m.gnd != null) ? m.gnd
            : null;
  const z = Number(roh);
  return (roh == null || typeof roh === 'boolean' || !Number.isFinite(z) || z <= 0) ? null : z;
}

/* Die Bewirtschaftungskostenquote des Satzes in Prozent des Rohertrags:

       bwk_pct  >  bewirtschaftungskostenquote  >  bewirtschaftungskosten_quote

   Sie stammt aus denselben Kauffaellen wie der Zinssatz (v1049-WBWK-1) und
   ist damit der Ansatz, mit dem der Ausschuss den Zins abgeleitet hat.
   Nur Zahlen zwischen 5 und 60 - ein Bruch (0,27) oder eine Eurosumme ist
   kein Prozentwert und wird nicht geraten. */
export function bwkQuoteAusModellansaetzen(ma) {
  const m = ma || {};
  for (const k of ['bwk_pct', 'bewirtschaftungskostenquote', 'bewirtschaftungskosten_quote']) {
    const v = m[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 5 && v <= 60) return { pct: v, feld: k };
  }
  return null;
}

export function sachwertfaktor(o) {
  const ags = (o && o.ags) || null;
  const a = zustaendig(ags);
  if (a) {
    const r = a.sachwertfaktor(fuerModul(o));
    if (r && r.verfuegbar) { r.ausschuss = a.name; r.herkunft = 'modul'; }
    return r;
  }
  const ausRegister = ausRegisterRechnen(o || {}, ags);
  if (ausRegister) return ausRegister;

  return {
    verfuegbar: false, grund: 'kein_ausschuss_hinterlegt',
    hinweis: 'Für diesen Ort sind noch keine Sachwertfaktoren hinterlegt. '
      + 'Sie werden von jedem Gutachterausschuss einzeln abgeleitet und '
      + 'veröffentlicht; hinterlegt sind bisher ' + hinterlegteNamen()
      + '. Übertragen werden dürfen sie nicht (§ 10 ImmoWertV).',
    hinterlegte_ausschuesse: AUSSCHUESSE.map((x) => x.ags_schluessel),
  };
}

/**
 * v1083-WLZS · Liegenschaftszinssatz aus dem Register.
 *
 * Gibt den Modellvermerk MIT zurueck. Wer einen amtlichen Zinssatz mit
 * fremden Bewirtschaftungskosten oder einer fremden Gesamtnutzungsdauer
 * kombiniert, bekommt ein Ergebnis, das amtlich aussieht und es nicht ist.
 * Beispiel aus der Ernte: Bochum leitet Dreifamilien- und Mehrfamilienhaus
 * mit GND 60 ab, nicht 80.
 */
export function liegenschaftszinssatz(arg = {}) {
  const { ags, zweig } = arg;
  const s = findeZweig('liegenschaftszinssatz', ags, zweig);
  if (!s) {
    const alle = finde('liegenschaftszinssatz', ags);
    if (alle.length) {
      return { verfuegbar: false, grund: 'zweig_nicht_abgeleitet',
        hinweis: `Der Gutachterausschuss hat für diese Objektart keinen `
          + `Liegenschaftszinssatz abgeleitet. Geführt werden: `
          + alle.map((x) => x.zweig).join(', ') + '.',
        ausschuss: alle[0].gaa_name || null };
    }
    return { verfuegbar: false, grund: 'kein_ausschuss_hinterlegt',
      hinweis: 'Für diesen Ort ist kein Liegenschaftszinssatz hinterlegt. '
        + 'Übertragen werden darf er nicht (§ 10 ImmoWertV).' };
  }
  const luecke = unvollstaendig(s);          /* v1085-WVOL */
  if (luecke) { luecke.zweig = s.zweig; return luecke; }

  const f = s.formel || {};
  const m = s.modellansaetze || {};
  const b = (s.belege && s.belege[0]) || {};

  /* v1085-WLFN · Nicht jeder Ausschuss fuehrt eine Konstante.
   *
   * Berlin leitet den Liegenschaftszinssatz als Funktion der
   * Objektkaltmiete ab — zehn Stuetzstellen, 2,3 bis 4,6 %. Bis v1084 las
   * diese Funktion stumpf `formel.wert`; bei einer Stufentabelle gibt es
   * den Schluessel nicht, und heraus kam `undefined` — eine Zahl, die
   * fehlt, ohne dass jemand es merkt.
   *
   * Gerechnet wird ueber DENSELBEN Auswerter wie beim Sachwertfaktor. Ein
   * zweiter waere eine Dublette, und Dubletten laufen auseinander. */
  let wertPct = f.wert;
  let rechenweg = null;
  if (wertPct == null && f.form && f.form !== 'konstante') {
    /* ═══ v1886-WFW · EINE FORMEL, DIE AN EINEM ANDEREN ZWEIG HAENGT ═════
       Hamburg leitet Eigentumswohnung und Einfamilienhaus AUS dem
       Mehrfamilienhaus-Zinssatz ab:

         etw:  Liegenschaftszinssatz = 1,16 × LIZI(MFH) − 2,30
         efh:  Liegenschaftszinssatz = 0,85 × LIZI(MFH) − 0,53

       Der Auswerter kennt das Register nicht; er kann den Wert des anderen
       Zweiges nicht holen. DIESE Stelle kann es — sie hat das Register
       schon in der Hand. Gerechnet wird GENAU EINE Stufe tief: ein Bezug
       auf einen Satz, der selbst einen Bezug traegt, wird nicht verfolgt.
       Zwei Blaetter, die sich gegenseitig ableiten, gaebe es nur als
       Erntefehler, und eine Endlosschleife ist die schlechteste Art, ihn
       zu melden. */
    const eingabeLzs = eingabeBruecke({ ...arg });
    const _bezZweig = /zweig\s*=\s*([a-z0-9_]+)/i.exec(String(f.bezug || ''));
    if (_bezZweig && eingabeLzs.bezugswert_pct == null) {
      const quelle = (finde('liegenschaftszinssatz', ags) || [])
        .find((x) => String(x.zweig || '').toLowerCase() === _bezZweig[1].toLowerCase());
      const qf = (quelle || {}).formel || {};
      if (quelle && !qf.bezug) {
        const qw = (qf.wert != null) ? qf.wert
          : (() => {
              const q = auswerten({ ...qf, kennzahl: 'liegenschaftszinssatz',
                                    modellansaetze: quelle.modellansaetze || null,
                                    korrekturen: quelle.korrekturen || [] },
                                  eingabeLzs);
              return q.verfuegbar
                ? (q.dokumentwert != null ? q.dokumentwert : q.wert * 100) : null;
            })();
        if (qw != null) eingabeLzs.bezugswert_pct = qw;
      }
    }
    const rr = auswerten({ ...f, kennzahl: 'liegenschaftszinssatz',
                           modellansaetze: s.modellansaetze || null,
                           korrekturen: s.korrekturen || [] },
                         eingabeLzs);
    if (!rr.verfuegbar) {
      return { verfuegbar: false, grund: rr.grund, hinweis: rr.hinweis,
        /* v1886-WFW · Welche EINGABE fehlt und welcher Faktor schon steht.
         * Ohne diese zwei Zeilen bleibt von einer Auskunft, die jeden
         * Faktor einzeln ausweist, nichts uebrig als ein Fehlercode — und
         * `zinssatzFuerObjekt` muesste wieder raten, was fehlt. */
        fehlende_eingaben: rr.fehlende_eingaben || null,
        teilergebnisse: rr.teilergebnisse || null,
        haengt_an_zweig: rr.haengt_an_zweig || null,
        /* v1093-WSPN2 · DIE SPANNE REIST MIT.
         *
         * Saarbruecken druckt je Grundstuecksart nur eine Spanne ab, kein
         * Punktmass — `spanne_kategorial` liefert deshalb keinen Wert. Ohne
         * diese zwei Zeilen bliebe davon nur ein "nicht verfuegbar" uebrig,
         * und der Bericht muesste schweigen, obwohl die Quelle etwas sagt.
         *
         * Ausgewiesen, nicht gerechnet: das ist der Unterschied zwischen
         * "wir wissen nichts" und "die Quelle nennt einen Rahmen". */
        spanne: rr.spanne || null,
        spanne_wortlaut: rr.spanne_wortlaut || null,
        ausschuss: s.gaa_name || null, zweig: s.zweig,
        modellform: f.form, stichtag: s.stichtag || null,
        berichtsjahr: s.berichtsjahr ?? null };
    }
    /* Der Auswerter rechnet in der Einheit des Dokuments und gibt den
     * Dezimalwert zurueck. Der Zinssatz wird als PROZENT gefuehrt. */
    wertPct = rr.dokumentwert != null ? rr.dokumentwert : rr.wert * 100;
    rechenweg = rr.rechenweg || null;
  }

  return {
    verfuegbar: true,
    wert_pct: wertPct,
    /* v1089-WART · WELCHE Statistik der Wert ist.
     *
     * Otterndorf fuehrt seinen Liegenschaftszinssatz als MEDIAN, nicht als
     * arithmetisches Mittel — bei einer Spanne von -0,57 bis 6,03
     * Prozentpunkten ist das ein anderer Wert, und der Bericht stellt den
     * Median ausdruecklich voran. Jede Zahl traegt ihre Herkunft, und dazu
     * gehoert, welche Statistik sie ist. */
    wert_art: f.wert_art || null,
    wert_art_hinweis: f.wert_art_hinweis || null,
    modellform: f.form || 'konstante',
    rechenweg,
    stufe: s.stufe,
    stufe_grund: s.stufe_grund || null,
    ausschuss: s.gaa_name,
    zweig: s.zweig,
    fallzahl: s.fallzahl ?? b.fallzahl ?? null,
    streuung: s.streuung ?? b.standardabweichung ?? null,
    stichtag: s.stichtag,
    berichtsjahr: s.berichtsjahr,
    /* Modellvermerk — ohne ihn darf der Zinssatz nicht verwendet werden. */
    modell: {
      gesamtnutzungsdauer: m.gesamtnutzungsdauer ?? null,
      restnutzungsdauer_mittel: m.restnutzungsdauer_mittel ?? null,
      bewirtschaftungskosten_quote: m.bewirtschaftungskosten_quote ?? null,
      marktmiete_eur_qm: m.marktmiete_eur_qm ?? null,
      bezug: m.bezug ?? null,
    },
    /* ═══ v2390 · DIE MODELLANSAETZE DES SATZES REISEN MIT ════════════════
       Hier stand nur `modell` (vier umbenannte Felder). `zweigwahl.js` und
       der WertParameterService lesen aber `modellansaetze` - und bekamen
       null. Die GND des Zinssatz-Modells kam deshalb nie im Ertragswert an,
       er rechnete immer mit Anlage 1. § 10 ImmoWertV: der Zins gilt nur mit
       den Ansaetzen, aus denen er abgeleitet wurde. */
    modellansaetze: s.modellansaetze || null,
    modell_gnd_jahre: gndAusModellansaetzen(s.modellansaetze),
    modell_bwk_quote: bwkQuoteAusModellansaetzen(s.modellansaetze),
    quelle_url: s.quelle_url || null,
    /* v2390 · auf welcher Ebene der Satz gilt: ein Landeswert (Oberer
       Gutachterausschuss, ags zweistellig) ist nicht der oertliche Satz. */
    register_ebene: s.ebene || null,
    register_ags: s.ags != null ? String(s.ags) : null,
    quellenvermerk: s.quellenvermerk || null,
    lizenz: s.lizenz || null,
    herkunft: 'register',
  };
}

/**
 * v1086-WBPN · Bodenpreisniveau je Gemeinde und Lage.
 *
 * DAS IST KEIN BODENRICHTWERT. § 196 BauGB verlangt einen aus Kauffällen
 * abgeleiteten, lagebezogenen Wert je Bodenrichtwertzone. Was hier steht,
 * ist ein Niveau für eine GANZE GEMEINDE und eine grob beschriebene Lage,
 * veröffentlicht in den Grundstücksmarktdaten NRW.
 *
 * Es plausibilisiert einen Bodenrichtwert — es ersetzt ihn nicht. Deshalb
 * Stufe B, `indikativ: true`, und ein eigener Zugang: dieser Wert geht in
 * KEINEN Rechenweg. Wer ihn in eine Bodenwertermittlung einsetzt, rechnet
 * gegen ein anderes Modell (§ 10 ImmoWertV).
 *
 * Der Gewinn ist die Fläche: 403 von 427 NRW-Gemeinden, nicht sechzehn
 * handgeerntete Ausschüsse.
 *
 * Lagen wörtlich aus der amtlichen Feldbeschreibung: gut · mittel ·
 * einfach. "einfach" heisst dort nicht "mäßig" — das war eine naheliegende
 * und falsche Lesart.
 */
/**
 * v1339 · ERBBAURECHTSKOEFFIZIENT — was der Markt zahlt, nicht was die
 * Rechnung ergibt.
 *
 * Das Erbbaurecht wird bei uns seit v1312 finanzmathematisch nach
 * Paragraf 50 ImmoWertV gerechnet: Volleigentum minus Bodenwert, plus
 * Zinsvorteil, minus Heimfall. Das ist der richtige Weg, SOLANGE nichts
 * Besseres vorliegt.
 *
 * Es liegt aber etwas Besseres vor, wo ein Gutachterausschuss den
 * Koeffizienten aus echten Kauffaellen abgeleitet hat. Der Ausschuss
 * Braunschweig-Wolfsburg tut das fuer sieben Gebiete aus den Jahren
 * 2021 bis 2024 und druckt sogar ein Anwendungsbeispiel ab:
 *
 *   500.000 Euro Volleigentum x 0,79 = 395.000 Euro Erbbaurecht
 *
 * Ein marktabgeleiteter Koeffizient schlaegt eine Modellrechnung -
 * er enthaelt alles, was die Formel nicht kennt: die Erwartung des
 * Marktes an Vertragsbedingungen, Anpassungsklauseln, Heimfallrisiko.
 *
 * WICHTIG: er gilt gegen den Wert des BEBAUTEN Grundstuecks im
 * Normaleigentum, nicht gegen den Bodenwert. Und er gilt nur fuer die
 * Objektart, fuer die er abgeleitet wurde - Braunschweig-Wolfsburg
 * fuehrt Reihenhaeuser und Doppelhaushaelften NUR fuer die Stadt
 * Wolfsburg.
 */
export function erbbaurechtskoeffizient(arg = {}) {
  const { ags, zweig, objektart, volleigentum_eur } = arg;
  const alle = finde('erbbaurechtskoeffizient', ags).filter((x) => ebeneErlaubt('erbbaurechtskoeffizient', x));
  if (!alle.length) {
    return { verfuegbar: false, grund: 'kein_koeffizient_hinterlegt',
      hinweis: 'Für diesen Ort ist kein marktabgeleiteter '
        + 'Erbbaurechtskoeffizient hinterlegt. Gerechnet wird finanzmathematisch '
        + 'nach § 50 ImmoWertV.' };
  }

  const gefuehrt = alle.map((x) => String(x.zweig || '').toLowerCase());

  /* === v1339b - DIE OBJEKTART DER APP IST NICHT DER ZWEIG DES BERICHTS =
     GEMESSEN am 12.09.2026 im Container:

       erbbaurechtskoeffizient({ags:"03101", objektart:"ezfh"}) -> 0,79 OK
       erbbaurechtskoeffizient({ags:"03101", objektart:"EFH"})  -> nichts

     obwohl `ZWEIG_VORZUG` fuer /efh/ ausdruecklich `[efh, ezfh]` fuehrt und
     `nachArt(satz, "ezfh")` isoliert genau einen Treffer liefert. Die
     Ursache ist INZWISCHEN GEFUNDEN und behoben (v1341): in
     `ZWEIG_VORZUG` standen Backspace-Zeichen statt Wortgrenzen. Die Karte
     unten bleibt trotzdem stehen - sie ist lesbarer als die Regex-Kaskade
     und unabhaengig von ihr.

     Diese Karte loest das Problem aber nicht nur pragmatisch, sie ist auch
     die richtige Stelle: unsere `ptype`-Werte (EFH, DHH, RH, ETW, MFH)
     sind Oberflaechen-Kuerzel, die Zweige der niedersaechsischen Berichte
     heissen anders (`ezfh`, `rh_dhh`). Eine ausdrueckliche Zuordnung ist
     lesbar und pruefbar; eine Regex-Kaskade, die fuer NRW gebaut wurde,
     ist es nicht.

     DHH und RH gehen BEWUSST nicht auf `ezfh`: der Ausschuss wertet
     Reihenhaeuser und Doppelhaushaelften getrennt aus und nur fuer die
     Stadt Wolfsburg. Ein Reihenhaus in Wolfenbuettel bekommt deshalb
     keinen Koeffizienten - und genau das soll es auch (Paragraf 10). */
  const PTYPE_ZU_ZWEIG = {
    efh: ['ezfh', 'efh'],
    zfh: ['ezfh', 'zfh'],
    ezfh: ['ezfh'],
    dhh: ['rh_dhh', 'rhdhh', 'dhh'],
    rh: ['rh_dhh', 'rhdhh', 'rh'],
    rmh: ['rh_dhh', 'rhdhh', 'rmh'],
    etw: ['etw', 'we', 'wohnung'],
    mfh: ['mfh'],
  };
  const _roh = String(zweig || objektart || '').toLowerCase().trim();
  let satz = null;
  if (_roh) {
    const kandidaten = PTYPE_ZU_ZWEIG[_roh] || [_roh];
    for (const z of kandidaten) {
      const t = alle.filter((x) => String(x.zweig || '').toLowerCase().trim() === z
                                || String(x.objektart || '').toLowerCase().trim() === z);
      if (t.length === 1) { satz = t[0]; break; }
      if (t.length > 1) {
        /* Mehrere Jahrgaenge: der juengste gilt, die aelteren sind
           Dokumentation (dieselbe Regel wie waehleAusGruppe). */
        const jung = Math.max(...t.map((x) => Number(x.berichtsjahr) || 0));
        const j = t.filter((x) => (Number(x.berichtsjahr) || 0) === jung);
        if (j.length === 1) { satz = j[0]; break; }
      }
    }
  }
  if (!satz) satz = zweigWaehlen(alle, gefuehrt, zweig || objektart, arg.baujahr || null);

  if (!satz) {
    return { verfuegbar: false, grund: 'objektart_nicht_abgeleitet',
      hinweis: 'Der Gutachterausschuss hat für diese Objektart keinen '
        + 'Erbbaurechtskoeffizienten abgeleitet. Geführt werden: ' + gefuehrt.join(', ')
        + '. Koeffizienten anderer Objektarten dürfen nicht übertragen werden '
        + '(§ 10 ImmoWertV).',
      ausschuss: alle[0].gaa_name || null, gefuehrte_zweige: gefuehrt };
  }

  const luecke = unvollstaendig(satz);
  if (luecke) { luecke.zweig = satz.zweig; return luecke; }

  const k = Number((satz.formel || {}).wert);
  if (!Number.isFinite(k) || !(k > 0)) {
    return { verfuegbar: false, grund: 'kein_wert', ausschuss: satz.gaa_name || null };
  }

  const r = {
    verfuegbar: true,
    wert: k,
    einheit: 'faktor',
    wert_art: (satz.formel || {}).wert_art || null,
    spanne: (satz.formel || {}).spanne || null,
    herkunft: 'register',
    zweig: satz.zweig,
    ausschuss: satz.gaa_name || null,
    gebiet: satz.gebiet_name || null,
    fallzahl: satz.fallzahl ?? null,
    streuung: satz.streuung ?? null,
    stichtag: satz.stichtag || null,
    berichtsjahr: satz.berichtsjahr ?? null,
    modellversion: satz.modellversion || null,
    stufe: satz.stufe || null,
    indikativ: satz.indikativ === true,
    fundstelle: satz.fundstelle || null,
    quelle_url: satz.quelle_url || null,
    quellenvermerk: satz.quellenvermerk || null,
    lizenz: satz.lizenz || null,
    modellansaetze: satz.modellansaetze || {},
    geltungsbereich: satz.geltungsbereich || null,
    quelle_text: (satz.gaa_name || 'Gutachterausschuss')
      + (satz.berichtsjahr ? ', Grundstücksmarktdaten ' + satz.berichtsjahr : '')
      + (satz.fundstelle ? ', ' + satz.fundstelle : ''),
    hinweis: (satz.formel || {}).hinweis || null,
  };

  /* Liegt der Wert des Volleigentums vor, wird gleich gerechnet - genau
     so, wie es das Anwendungsbeispiel des Ausschusses vormacht. */
  const V = Number(volleigentum_eur);
  if (Number.isFinite(V) && V > 0) {
    r.volleigentum_eur = Math.round(V);
    r.erbbaurecht_eur = Math.round(V * k);
    r.abschlag_eur = Math.round(V * k) - Math.round(V);
    r.abschlag_pct = Math.round((k - 1) * 1000) / 10;
    if (r.spanne && r.spanne.length === 2) {
      r.erbbaurecht_spanne_eur = [Math.round(V * r.spanne[0]), Math.round(V * r.spanne[1])];
    }
    r.rechenweg = Math.round(V).toLocaleString('de-DE') + ' \u20ac \u00d7 '
      + String(k).replace('.', ',') + ' = ' + Math.round(V * k).toLocaleString('de-DE') + ' \u20ac';
  }
  return r;
}

/**
 * v1343 · WO BEKOMME ICH DIESE WERTE HER?
 *
 * Marcels Frage: „wenn die Adresse eingegeben ist, dass du automatisch
 * dort ranschreibst, wo man die herbekommt. Also die Gutachterausschuesse
 * oder so, dass du gleich den Link ausgibst."
 *
 * Das Register fuehrt zu jedem Satz Fundstelle, Quell-URL, Lizenz und
 * Berichtsjahr — 31 verschiedene amtliche Quellen. Gelesen hat sie bisher
 * nur der Bericht, wenn ein Wert TATSAECHLICH gerechnet wurde. Wer den
 * Wert von Hand eintragen soll, bekam nichts.
 *
 * Diese Auskunft dreht das um: sie sagt fuer einen Ort, WAS hinterlegt ist
 * (dann muss man nichts suchen), und WO es steht, wenn nicht.
 *
 * KEIN ERFUNDENER LINK. Ausgegeben wird nur, was im Registersatz belegt
 * ist, plus das bundesweite BORIS-D-Portal — das steht seit v1077 in
 * `connectors/boris/registry.js` als geprueft.
 */
const KENNZAHL_NAME = {
  liegenschaftszinssatz: 'Liegenschaftszinssatz',
  sachwertfaktor: 'Sachwertfaktor',
  erbbaurechtskoeffizient: 'Erbbaurechtskoeffizient',
  erbbauzinssatz: 'Erbbauzinssatz',
  bodenpreisniveau: 'Bodenpreisniveau',
  durchschnittspreis: 'Durchschnittspreis',
  preisentwicklung: 'Preisentwicklung',
  bodenpreisindex: 'Bodenpreisindex',
};

/* Die Kennzahlen, die ein Sachverstaendiger im Zusatzwerte-Block von Hand
   eintragen koennte. Reihenfolge = Reihenfolge der Anzeige. */

const QUELLEN_KENNZAHLEN = ['liegenschaftszinssatz', 'sachwertfaktor',
  'erbbaurechtskoeffizient', 'erbbauzinssatz', 'bodenpreisniveau',
  'durchschnittspreis', 'preisentwicklung'];

export function quellen({ ags } = {}) {
  const out = { ags: ags || null, ausschuss: null, gebiet: null,
                hinterlegt: [], fehlt: [], portale: [] };
  if (!ags) { out.grund = 'keine_ags'; return out; }

  for (const k of QUELLEN_KENNZAHLEN) {
    const saetze = finde(k, ags).filter((x) => ebeneErlaubt(k, x));
    if (!saetze.length) { out.fehlt.push({ kennzahl: k, name: KENNZAHL_NAME[k] || k }); continue; }
    /* Der juengste Jahrgang steht vorn. */

    const jung = saetze.slice().sort((a, b) => (Number(b.berichtsjahr) || 0) - (Number(a.berichtsjahr) || 0));
    const s0 = jung[0];
    if (!out.ausschuss && s0.gaa_name) out.ausschuss = s0.gaa_name;
    if (!out.gebiet && s0.gebiet_name) out.gebiet = s0.gebiet_name;
    out.hinterlegt.push({
      kennzahl: k,
      name: KENNZAHL_NAME[k] || k,
      zweige: jung.map((x) => x.zweig).filter(Boolean),
      werte: jung.map((x) => ({
        zweig: x.zweig || null,
        wert: (x.formel && x.formel.form === 'konstante') ? x.formel.wert : null,
        liefert: (x.formel && x.formel.liefert) || null,
        spanne: (x.formel && x.formel.spanne) || null,
        stufe: x.stufe || null,
        fallzahl: x.fallzahl ?? null,
      })),
      berichtsjahr: s0.berichtsjahr ?? null,
      fundstelle: s0.fundstelle || null,
      quelle_url: s0.quelle_url || null,
      quellenvermerk: s0.quellenvermerk || null,
      lizenz: s0.lizenz || null,
      gebiet: s0.gebiet_name || null,
      ausschuss: s0.gaa_name || null,
    });
  }

  /* Ein handgeschriebenes Modul ist mehr wert als ein Registersatz — es
     traegt das ganze Modell, nicht nur eine Zahl. */
  const modul = zustaendig(ags);
  if (modul) {
    out.modul = { name: modul.name, bericht: modul.bericht || null,
                  berichtsjahr: modul.berichtsjahr ?? null };
    if (!out.ausschuss) out.ausschuss = modul.name;
  }

  /* Bodenrichtwerte kommen nicht aus dem Register, sondern aus BORIS.
     Das bundesweite Portal ist in connectors/boris/registry.js als
     geprueft gefuehrt; laenderspezifische Portale werden hier NICHT
     geraten. */
  out.portale.push({
    fuer: 'Bodenrichtwert',
    name: 'BORIS-D (bundesweites Portal der Gutachterausschüsse)',
    url: 'https://www.bodenrichtwerte-boris.de/',
    hinweis: 'Adresse suchen, auf das Grundstück klicken, Wert und Stichtag ablesen. '
      + 'Auf die richtige Nutzungsart achten — für eine Wohnung ist das die Wohnbaufläche.',
  });

  return out;
}

export function bodenpreisniveau({ ags, nutzungsart, lage } = {}) {


  const treffer = finde('bodenpreisniveau', ags);
  if (!treffer.length) {
    return { verfuegbar: false, grund: 'kein_niveau_hinterlegt',
      hinweis: 'Für diese Gemeinde liegt kein Bodenpreisniveau vor. '
        + 'Hinterlegt sind bisher die Gemeinden Nordrhein-Westfalens aus '
        + 'den Grundstücksmarktdaten NRW.' };
  }
  const s = treffer[0];
  const n = ((s.formel || {}).nutzung) || {};

  const art = String(nutzungsart || '').toLowerCase().trim();
  if (!art) {
    /* Ohne Nutzungsart die ganze Aufschluesselung — der Bericht darf sie
     * als Uebersicht zeigen. */
    return { verfuegbar: true, indikativ: true, stufe: s.stufe || 'B',
      gemeinde: s.gebiet_name || null, nutzung: n,
      einheit: 'eur_qm', berichtsjahr: s.berichtsjahr ?? null,
      stichtag: s.stichtag || null, quelle_url: s.quelle_url || null,
      quellenvermerk: s.quellenvermerk || null, lizenz: s.lizenz || null,
      hinweis: 'Bodenpreisniveau der Gemeinde. Kein Bodenrichtwert nach '
        + '§ 196 BauGB; zur Plausibilisierung, nicht zur Ermittlung.' };
  }

  const eintrag = n[art];
  if (!eintrag) {
    return { verfuegbar: false, grund: 'nutzungsart_nicht_gefuehrt',
      hinweis: 'Für diese Nutzungsart führt die Quelle kein Niveau. '
        + 'Geführt werden: ' + Object.keys(n).join(', ') + '.',
      gefuehrte_nutzungsarten: Object.keys(n) };
  }

  const lg = String(lage || '').toLowerCase().trim();
  const wert = lg ? (eintrag.lagen || {})[lg] : undefined;
  if (lg && wert == null) {
    return { verfuegbar: false, grund: 'lage_ohne_wert',
      hinweis: `Für die Lage "${lg}" führt die Quelle keinen Wert. `
        + 'Geführt werden: ' + Object.keys(eintrag.lagen || {}).join(', ')
        + '. Ein Wert einer anderen Lage wird nicht übertragen.',
      gefuehrte_lagen: Object.keys(eintrag.lagen || {}) };
  }

  const auffaellig = ((s.geltungsbereich || {}).monotonie_auffaellig || [])
    .includes(art);

  return {
    verfuegbar: true,
    indikativ: true,                 /* geht in KEINEN Rechenweg */
    stufe: s.stufe || 'B',
    wert_eur_qm: lg ? wert : null,
    lage: lg || null,
    nutzungsart: art,
    bezeichnung: eintrag.bezeichnung || null,
    lagen: eintrag.lagen || {},
    erschliessungsbeitrag_eur_qm: eintrag.erschliessungsbeitrag_eur_qm ?? null,
    gemeinde: s.gebiet_name || null,
    berichtsjahr: s.berichtsjahr ?? null,
    stichtag: s.stichtag || null,
    lagefolge_auffaellig: auffaellig,
    quelle_url: s.quelle_url || null,
    quellenvermerk: s.quellenvermerk || null,
    lizenz: s.lizenz || null,
    hinweis: 'Bodenpreisniveau der Gemeinde, kein Bodenrichtwert nach '
      + '§ 196 BauGB. Zur Plausibilisierung, nicht zur Ermittlung.'
      + (auffaellig ? ' Achtung: die Reihenfolge gut/mittel/einfach ist in '
        + 'dieser Nutzungsart nicht fallend — so steht es in der Quelle.' : ''),
  };
}

/* ── v1087-WMKT · DIE MARKTDATEN-EBENE ─────────────────────────────────
 *
 * Drei Kennzahlen aus den Grundstücksmarktdaten NRW, alle gemeindescharf
 * und alle INDIKATIV:
 *
 *   durchschnittspreis  je Objektart und Baujahrsklasse, €/m² Wohnfläche
 *   preisentwicklung    je Teilmarkt, in Prozent
 *   erbbauzinssatz      Erbbaurecht für individuellen Wohnungsbau, Prozent
 *
 * KEINE VON IHNEN GEHT IN EINEN RECHENWEG. Ein Durchschnittspreis ist kein
 * Vergleichswert nach § 24 ImmoWertV — ein Vergleichswert verlangt
 * hinreichend übereinstimmende Grundstücksmerkmale, hier steht ein
 * Gemeindemittel über eine Baujahrsspanne von bis zu 25 Jahren. Es taugt
 * zur EINORDNUNG ("liegt das Objekt über oder unter dem Gemeindemittel
 * seiner Baujahrsklasse"), nicht zur Ableitung.
 *
 * Auch der Erbbauzinssatz bleibt indikativ, obwohl er eine echte
 * Bewertungsgröße ist: er steht hier als Gemeindemittel über wenige
 * Kauffälle, nicht als abgeleiteter Modellparameter eines
 * Gutachterausschusses. Landesweit führen ihn 15 Gemeinden.
 *
 * EIN ZUGANG STATT DREI. Die drei teilen sich Form und Regeln; drei fast
 * gleiche Funktionen wären drei Stellen, an denen dieselbe Regel später
 * auseinanderläuft. */
const MARKTDATEN = new Set(['durchschnittspreis', 'preisentwicklung',
                            'erbbauzinssatz']);

export function marktdaten({ ags, kennzahl, zweig } = {}) {
  const k = String(kennzahl || '').toLowerCase().trim();
  if (!MARKTDATEN.has(k)) {
    return { verfuegbar: false, grund: 'kennzahl_unbekannt',
      hinweis: 'Als Marktdaten geführt werden: '
        + [...MARKTDATEN].join(', ') + '.' };
  }
  const treffer = finde(k, ags);
  if (!treffer.length) {
    return { verfuegbar: false, grund: 'keine_marktdaten_hinterlegt',
      hinweis: 'Für diese Gemeinde liegen keine Marktdaten dieser Kennzahl '
        + 'vor. Hinterlegt sind die Gemeinden Nordrhein-Westfalens aus den '
        + 'Grundstücksmarktdaten NRW; nicht jede Gemeinde führt jede '
        + 'Kennzahl.' };
  }

  const z = String(zweig || '').toLowerCase().trim();
  const s = (z && treffer.find((x) => String(x.zweig || '').toLowerCase() === z))
    || treffer[0];
  const f = s.formel || {};

  const gemein = {
    verfuegbar: true,
    indikativ: true,                     /* geht in KEINEN Rechenweg */
    kennzahl: k,
    stufe: s.stufe || 'B',
    gemeinde: s.gebiet_name || null,
    berichtsjahr: s.berichtsjahr ?? null,
    stichtag: s.stichtag || null,
    fallzahl: s.fallzahl ?? null,
    quelle_url: s.quelle_url || null,
    quellenvermerk: s.quellenvermerk || null,
    lizenz: s.lizenz || null,
    hinweis: f.hinweis || null,
  };

  if (k === 'durchschnittspreis') return { ...gemein, arten: f.arten || {} };
  if (k === 'preisentwicklung') {
    return { ...gemein, teilmaerkte: f.teilmaerkte || {} };
  }
  /* erbbauzinssatz */
  return { ...gemein, wert_pct: f.wert ?? null, zweig: s.zweig,
           bezeichnung: f.bezeichnung || null };
}

/**
 * Ein einzelner Durchschnittspreis, wenn Objektart und Baujahrsklasse
 * bekannt sind. Ist die Klasse nicht geführt, gibt es KEINEN Wert — der
 * Nachbarjahrgang wird nicht übertragen.
 *
 * Klassen wörtlich aus der amtlichen Feldbeschreibung: neu (Erstverkauf
 * nach Neubau) · z (zusammengefasst) · 20xx (2010–2018) · 2009 (1995–2009)
 * · 1994 (1975–1994) · 1974 (1950–1974) · 1949 (1920–1949) · 1919 (bis 1919)
 */
export function durchschnittspreis({ ags, art, klasse, baujahr } = {}) {
  const r = marktdaten({ ags, kennzahl: 'durchschnittspreis' });
  if (!r.verfuegbar) return r;

  const a = String(art || '').toLowerCase().trim();
  if (!a) return r;
  const eintrag = (r.arten || {})[a];
  if (!eintrag) {
    return { verfuegbar: false, grund: 'objektart_nicht_gefuehrt',
      hinweis: 'Geführt werden: ' + Object.keys(r.arten || {}).join(', ')
        + '.', gefuehrte_arten: Object.keys(r.arten || {}) };
  }

  const kl = klasse ? String(klasse) : klasseAusBaujahr(baujahr);
  if (!kl) return { ...r, art: a, klassen: eintrag.klassen || {} };

  const treffer = (eintrag.klassen || {})[kl];
  if (!treffer) {
    return { verfuegbar: false, grund: 'klasse_ohne_wert',
      hinweis: `Für die Baujahrsklasse "${kl}" führt die Quelle in dieser `
        + 'Gemeinde keinen Wert. Ein Wert einer anderen Klasse wird nicht '
        + 'übertragen.',
      gefuehrte_klassen: Object.keys(eintrag.klassen || {}) };
  }
  return { ...r, art: a, klasse: kl, ...treffer,
           bezeichnung_art: eintrag.bezeichnung || null };
}

/** Baujahr -> Klassenschlüssel der Quelle. Ausserhalb: null, nicht raten. */
function klasseAusBaujahr(bj) {
  const j = Number(bj);
  if (!Number.isFinite(j) || j <= 0) return null;
  if (j >= 2019) return null;      /* die Quelle endet bei 2018 */
  if (j >= 2010) return '20xx';
  if (j >= 1995) return '2009';
  if (j >= 1975) return '1994';
  if (j >= 1950) return '1974';
  if (j >= 1920) return '1949';
  return '1919';
}

/* ── v1094-WKZ · VERGLEICHSFAKTOR (§ 20 ImmoWertV) ─────────────────────
 *
 * Die dritte Säule neben Sachwertfaktor und Liegenschaftszins — und die
 * einzige, bei der § 6 Abs. 1 das Verfahren FÜHREN lässt (typisches
 * Wohnungseigentum). Sie bekommt deshalb einen eigenen Zugang mit eigener
 * Rückgabeform und nicht den Sammelzugang der Marktdaten aus v1087.
 *
 * DER TABELLENWERT IST NICHT DER OBJEKTWERT. Wiesbaden führt seinen
 * Vergleichsfaktor je QUADRATMETER Wohnfläche; der Objektwert entsteht
 * erst durch Multiplikation mit der Wohnfläche, und zwar NACH der
 * Korrektur. Wer den Tabellenwert direkt als Objektwert liest,
 * verrechnet sich um den Faktor der Wohnfläche.
 *
 * Deshalb gibt diese Funktion beides zurück: den Wert je Bezugsgröße und —
 * wenn die Bezugsgröße erfasst ist — den daraus folgenden Objektwert. Was
 * sie NICHT tut: die Bezugsgröße raten. Fehlt sie, gibt es keinen
 * Objektwert, nur den Wert je Einheit. */
/* ══ v1977a · `verwendung` MUSS ZURUECKKOMMEN ══════════════════════════

   Die Antwort fuehrte 23 Felder und `verwendung` war keines davon —
   obwohl es im SATZ steht. Gemessen am 08.10.2026: der Berliner
   Vergleichsfaktor traegt `verwendung: "intern"`, die Leseroutine gab
   es nicht weiter.

   Damit war die Sperre in ReportOrchestrator (v1977) TOTER CODE: sie
   fragt `_r.verwendung === 'intern'` und bekam immer `undefined`. Ein
   Waechter, der nie ausloest, und zwar fuer genau den Fall, fuer den er
   gebaut wurde — die Berliner Faktoren duerfen keinen Verkehrswert
   tragen (Paragraf 194 BauGB, ausdruecklich im Blatt).

   Die Funktion hat mehrere Austritte. Statt jeden anzufassen liegt hier
   ein Umschlag: er ruft den Kern und haengt `verwendung` und
   `verwendung_grund` aus dem gefundenen Satz an. So kann kein kuenftiger
   Austritt das Feld vergessen.
   ══════════════════════════════════════════════════════════════════ */
export function vergleichsfaktor(arg = {}) {
  const _erg = _vergleichsfaktorKern(arg);
  if (!_erg || typeof _erg !== 'object') return _erg;
  if (_erg.verwendung !== undefined) return _erg;
  try {
    /* v3008 · der Satz kommt vom Kern selbst - seit die Ebenen je Zweig
       abgestuft werden, liegt er nicht mehr zwingend auf der ersten Ebene. */
    let _t = _erg._satz || null;
    if (!_t) {
      const _s = finde('vergleichsfaktor', String((arg && arg.ags) || ''));
      const _l = Array.isArray(_s) ? _s : (_s ? [_s] : []);
      _t = _l.find((x) => x && x.zweig === _erg.zweig) || _l[0] || null;
    }
    if (_t) {
      _erg.verwendung = _t.verwendung || null;
      if (_t.auflagen) _erg.auflagen = _t.auflagen;
    }
  } catch (e) { /* ohne Satz bleibt das Feld weg - kein Rateversuch */ }
  return _erg;
}

/* ══ v3008 · WO DER NUTZER EIN FEHLENDES MERKMAL EINTRAEGT ═════════════
   Die Klassen und ihr Wortlaut kommen aus dem SATZ (Dokument des
   Ausschusses); hier steht nur, wo das Feld in DealPilot liegt. Ein
   Merkmal ohne Eintrag hier wird von DealPilot nicht erfasst - das sagt
   der Hinweis dann auch so, statt einen Ort zu erfinden. */
const VGF_EINTRAGEN = {
  vgf_wohnlage: 'Reiter Objekt, Block Wertermittlung: „Wohnlage (Gutachterausschuss)“',
  vgf_ausstattung: 'Reiter Objekt, Block Wertermittlung: „Ausstattungsklasse (Gutachterausschuss)“',
  zimmer: 'Reiter Objekt, Stammdaten: „Zimmer“',
  baujahr: 'Reiter Objekt, Stammdaten: „Baujahr“',
  wohnflaeche: 'Reiter Objekt, Stammdaten: „Wohnfläche“',
  wohnflaeche_qm: 'Reiter Objekt, Stammdaten: „Wohnfläche“',
  flaeche: 'Reiter Objekt: „Grundstücksfläche“',
  bgf_qm: 'Reiter Objekt, Block Wertermittlung: „BGF“',
  standardstufe: 'Reiter Objekt, Block Wertermittlung: „Standardstufe“',
  unterkellerung_pct: 'Reiter Objekt, Block Wertermittlung: Gebäudeart nach NHK (mit/ohne Keller)',
  mod_punkte: 'Reiter Objekt, Block Wertermittlung: „Modernisierungsgrad (Anlage 2)“',
  garagen_anzahl: 'Reiter Objekt: „Garagen“',
  stellplaetze: 'Reiter Objekt: „Garagen“ und „Stellplätze außen“',
  rnd: 'Reiter Objekt: Baujahr und Modernisierungsgrad (Restnutzungsdauer nach Anlage 2)',
  brw: 'Bodenrichtwert (BORIS-Abruf oder Reiter Objekt „Bodenrichtwert“)',
};
function _eintragenText(feld) {
  return VGF_EINTRAGEN[feld] || 'von DealPilot derzeit nicht erfasst';
}

/** Die Ebenen des Registers je Schluessel, feinste zuerst (je Ebene eine Liste). */
function _ebenenListen(kennzahl, ags) {
  const out = [];
  const gesehen = new Set();
  for (const k of kaskadeSchluessel(ags)) {
    const L = finde(kennzahl, k);
    if (!L.length || gesehen.has(L)) continue;
    gesehen.add(L);
    out.push({ key: k, liste: L });
  }
  return out;
}

/** Kommt der Zweig (oder ein Zweig fuer die Objektart) auf dieser Ebene vor -
 *  als Wert ODER als Sperre? Nur wenn nicht, darf die naechste Ebene gelten. */
function _zweigKommtVor(L, zweig, objektart) {
  if (zweig) return L.some((s) => String(s.zweig || '').toLowerCase() === String(zweig).toLowerCase());
  const t = String(objektart || '').trim();
  if (!t) return false;
  if (nachArt(L, t.toLowerCase()).length) return true;
  for (const [muster, vorzug] of ZWEIG_VORZUG) {
    if (!muster.test(t)) continue;
    return vorzug.some((z) => nachArt(L, z).length > 0);
  }
  return false;
}

/* ══ v3008 · MERKMALE DES AUSSCHUSSES (Wohnlage, Ausstattung, Zimmer) ═══
   Fuer die Modellform `merkmalsmatrix`. Je Achse in dieser Reihenfolge:
     1  eigene Angabe des Nutzers (Feld der Achse, z. B. vgf_wohnlage) -
        geprueft gegen die Klassen des Ausschusses, nie unscharf;
     2  die Ableitung, die der SATZ beschreibt (`ableitung`) - nur, wo
        das Dokument des Ausschusses die Zuordnung selbst angibt (Konstanz:
        Lageklasse der Bodenrichtwertzone -> Wohnlage, Merkmalsblatt S. 1);
     3  sonst fehlt das Merkmal, und es gibt keinen Wert.
   Nie wird die DealPilot-eigene Lageeinschaetzung umgedeutet. */
function _merkmaleVorbereiten(f, e) {
  const herkunft = [];
  const fehlen = [];
  for (const g of (Array.isArray(f.geltung) ? f.geltung : [])) {
    const v = zahlOderNull0(e[g.feld]);
    if (v === null) { fehlen.push(g); continue; }
    if ((g.mindestens != null && v < g.mindestens) || (g.hoechstens != null && v > g.hoechstens)) {
      return { ausserhalb: `${g.bez || g.feld} ${String(v).replace('.', ',')}: außerhalb des Geltungsbereichs — `
        + `die Tabelle des Gutachterausschusses gilt nur ${g.text || 'im Anwendungsbereich'}.`, merkmal: g.merkmal || g.feld };
    }
  }
  for (const a of (Array.isArray(f.achsen) ? f.achsen : [])) {
    if (a.art === 'band') {
      const x = zahlOderNull0(e[a.feld]);
      if (x === null) { fehlen.push(a); continue; }
      const b = (a.baender || []).find((r) => (r.von == null || x >= r.von) && (r.bis == null || x <= r.bis));
      if (!b) {
        return { ausserhalb: `${a.bez || a.feld} ${x}: außerhalb des Geltungsbereichs — der Ausschuss führt nur `
          + (a.baender || []).map((r) => r.schluessel).join(', ') + '; extrapoliert wird nicht.', merkmal: a.merkmal || a.feld };
      }
      continue;
    }
    const roh = String(e[a.feld] ?? '').trim();
    if (roh) {
      const k = (a.klassen || []).find((c) => String(c).toLowerCase() === roh.toLowerCase());
      if (k === undefined) {
        return { ausserhalb: `${a.bez || a.feld} „${roh}“ ist keine Klasse des Gutachterausschusses (`
          + (a.klassen || []).join(', ') + ').', merkmal: a.merkmal || a.feld, grund: 'merkmal_unbekannt' };
      }
      e[a.feld] = k;
      herkunft.push({ merkmal: a.merkmal || a.feld, klasse: k, art: 'eigene_angabe',
        text: `${a.bez || a.feld}: ${k} — ${a.eigene_angabe_text || 'eigene Angabe'}` });
      continue;
    }
    const ab = a.ableitung || null;
    if (ab) {
      const r = ab.ortsteil_regel || null;
      const ot = r ? String(e[r.feld] ?? '').trim().toLowerCase() : '';
      if (r && ot && (r.ortsteile || []).some((o) => String(o).toLowerCase() === ot)) {
        e[a.feld] = r.klasse;
        herkunft.push({ merkmal: a.merkmal || a.feld, klasse: r.klasse, art: 'abgeleitet',
          text: `${a.bez || a.feld}: ${r.klasse} — ${r.text || 'Regel des Ausschusses'} (Ortsteil ${e[r.feld]})` });
        continue;
      }
      const lk = zahlOderNull0(e[ab.feld]);
      if (lk !== null) {
        const b = (ab.baender || []).find((x) => (x.von == null || lk >= x.von) && (x.bis == null || lk <= x.bis));
        if (b) {
          e[a.feld] = b.klasse;
          herkunft.push({ merkmal: a.merkmal || a.feld, klasse: b.klasse, art: 'abgeleitet',
            text: `${a.bez || a.feld}: ${b.klasse} — ${ab.bez || ab.feld} ${lk.toFixed(1).replace('.', ',')}`
              + (ab.text ? ' (' + ab.text + ')' : '') });
          continue;
        }
      }
    }
    fehlen.push(a);
  }
  return { herkunft, fehlen };
}
function zahlOderNull0(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* ══ v3008 · W1 · KEIN VERGLEICHSWERT MIT FEHLENDER ANPASSUNG ═══════════
   § 26 Abs. 1 i. V. m. § 9 Abs. 1 S. 3 ImmoWertV, ImmoWertA 26.1: weicht
   das Objekt in einem Merkmal vom Normobjekt ab, ist der Vergleichsfaktor
   anzupassen. Bis hier sammelte `auswerten()` nicht anwendbare Korrekturen
   als `korrekturen_offen` - und der Wert kam trotzdem heraus (gemessen am
   Brandenburger OGA: 40 von 40 Werten ohne Standardstufe/Unterkellerung).

   Je Korrektur des Satzes:
     norm          gerechnet, oder das Modell sieht fuer diesen Fall keine
                   Anpassung vor (Merkmal liegt in der Norm)  -> Wert bleibt
     merkmal_fehlt das Objekt-Merkmal ist nicht erfasst        -> kein Wert
     ausserhalb    Merkmal erfasst, aber ausserhalb der Tabelle der Anpassung
                   (auch knapp daneben - nie stillschweigend Rand oder Norm)
                                                                -> kein Wert
     nicht_rechenbar  die Anpassung steht im Dokument, ihre Werte nicht
                   (art "offen"), und keine Normangabe deckt das Objekt
                                                                -> kein Wert */
function _korrekturenPruefen(korr, e, offenListe) {
  const offen = new Set((offenListe || []).map(String));
  const leer = (v) => v === undefined || v === null || v === '';
  const zeilen = [];
  for (const k of (Array.isArray(korr) ? korr : [])) {
    const name = k.bez || k.feld;
    if (k.fest) { zeilen.push({ bez: name, feld: k.feld, status: 'norm' }); continue; }
    const v = e[k.feld];
    if (k.art === 'offen') {
      if (k.norm !== undefined && !leer(v) && String(v).toLowerCase() === String(k.norm).toLowerCase()) {
        zeilen.push({ bez: name, feld: k.feld, status: 'norm' });
      } else {
        zeilen.push({ bez: name, feld: k.feld, status: leer(v) && VGF_EINTRAGEN[k.feld] ? 'merkmal_fehlt' : 'nicht_rechenbar' });
      }
      continue;
    }
    if (leer(v) || (k.art === 'stufen_kategorial' && leer(e[k.kategorie_feld]))) {
      zeilen.push({ bez: name, feld: leer(v) ? k.feld : k.kategorie_feld, status: 'merkmal_fehlt' });
      continue;
    }
    if (offen.has(String(name))) { zeilen.push({ bez: name, feld: k.feld, status: 'ausserhalb', wert: v }); continue; }
    /* Stufentabellen: ausserhalb der Stuetzstellen rechnete auswerten() mit
       dem Randwert. Fuer den Vergleichsfaktor ist das eine Verlaengerung
       der Tabelle - Regel 3: nicht stillschweigend. */
    if (!k.art || k.art === 'stufen' || k.art === 'stufen_kategorial') {
      let reihe = k.stufen || {};
      if (k.art === 'stufen_kategorial') {
        let kat = String(e[k.kategorie_feld] ?? '');
        if (Array.isArray(k.kategorie_baender) && k.kategorie_baender.length) {
          const zv = Number(e[k.kategorie_feld]);
          const tr = k.kategorie_baender.find((b) => (b.von == null || zv >= b.von) && (b.bis == null || zv <= b.bis));
          kat = tr ? String(tr.kategorie) : '';
        }
        reihe = (k.stufen || {})[kat] || {};
      }
      const st = Object.keys(reihe).map(Number).filter(Number.isFinite);
      const x = Number(v);
      if (st.length && Number.isFinite(x) && (x < Math.min(...st) || x > Math.max(...st))) {
        zeilen.push({ bez: name, feld: k.feld, status: 'ausserhalb', wert: v,
          spanne: [Math.min(...st), Math.max(...st)] });
        continue;
      }
    }
    zeilen.push({ bez: name, feld: k.feld, status: 'norm' });
  }
  return zeilen;
}

function _vergleichsfaktorKern(arg = {}) {
  const { ags, zweig, objektart } = arg;
  const ebenen = _ebenenListen('vergleichsfaktor', ags);
  if (!ebenen.length) {
    return { verfuegbar: false, grund: 'kein_ausschuss_hinterlegt',
      hinweis: 'Für diesen Ort ist kein Vergleichsfaktor hinterlegt. '
        + 'Übertragen werden darf er nicht (§ 10 ImmoWertV).' };
  }
  /* v3008 · EBENEN JE ZWEIG. finde() stuft je Kennzahl ab: ein Kreissatz
     fuer Wohnungseigentum verdeckte den Landessatz des Oberen
     Gutachterausschusses fuer Ein-/Zweifamilienhaeuser („zweig_nicht_
     abgeleitet", Ost-Ernte 27.10.2026). Jetzt gilt die feinste Ebene, auf
     der der Zweig VORKOMMT - als Wert oder als Sperre. Eine Sperre der
     unteren Ebene behaelt damit Vorrang; weitergegangen wird nur, wo der
     Zweig dort gar nicht gefuehrt ist. */
  const ebene = ebenen.find((x) => _zweigKommtVor(x.liste, zweig, objektart)) || ebenen[0];
  const reg = ebene.liste;
  const s = (zweig && findeZweig('vergleichsfaktor', ebene.key, zweig))
    || zweigWaehlen(reg, reg, objektart, arg.baujahr)
    || null;
  const _mitSatz = (o) => { if (s) Object.defineProperty(o, '_satz', { value: s, enumerable: false }); return o; };
  if (!s) {
    return { verfuegbar: false, grund: 'zweig_nicht_abgeleitet',
      hinweis: 'Der Gutachterausschuss hat für diese Objektart keinen '
        + 'Vergleichsfaktor abgeleitet. Geführt werden: '
        + reg.map((x) => x.zweig).join(', ') + '.',
      ausschuss: reg[0].gaa_name || null };
  }
  const f = s.formel || {};
  const b = (s.belege && s.belege[0]) || {};

  /* Ein Datensatz OHNE Modellform ist kein Fehler, sondern eine Aussage:
   * der Ausschuss führt die Objektart, hat aber keinen Faktor abgeleitet.
   * Das ist etwas anderes als "kein Ausschuss hinterlegt", und der Bericht
   * soll den Unterschied sagen können. */
  if (!f.form) {
    /* v2999 · eine Sperre MIT Grund (warum_kein_wert, zugang) ist keine fehlende Ableitung -
       bis hier hiess jede Sperre „hat keinen Vergleichsfaktor abgeleitet", auch wo der Ausschuss
       einen fuehrt, der nur am Ortsteil haengt oder Geld kostet (Ernte NI/Ost 27.10.2026). */
    const _warum = s.warum_kein_wert || (s.sperre && s.sperre.grund) || null;
    return _mitSatz({ verfuegbar: false, grund: _warum ? 'gesperrt' : 'gefuehrt_aber_nicht_abgeleitet',
      hinweis: _warum ? String(_warum) : ('Der Ausschuss führt diese Objektart, hat für sie aber '
        + 'keinen Vergleichsfaktor abgeleitet.'),
      zugang: s.zugang || null, bestell_url: s.bestell_url || null, quelle_url: s.quelle_url || null,
      ausschuss: s.gaa_name || null, zweig: s.zweig,
      stichtag: s.stichtag || null, berichtsjahr: s.berichtsjahr ?? null });
  }

  const eingabe = eingabeBruecke({ ...arg });
  const gemein = { ausschuss: s.gaa_name || null, zweig: s.zweig, modellform: f.form,
    stichtag: s.stichtag || null, berichtsjahr: s.berichtsjahr ?? null, quelle_url: s.quelle_url || null };

  /* v3008 · Merkmale des Ausschusses vorab - ALLE fehlenden auf einmal nennen. */
  let merkmalHerkunft = [];
  if (f.form === 'merkmalsmatrix') {
    const mv = _merkmaleVorbereiten(f, eingabe);
    if (mv.ausserhalb) {
      return _mitSatz({ verfuegbar: false, grund: mv.grund || 'ausserhalb_des_geltungsbereichs',
        hinweis: mv.ausserhalb + ' Ein Vergleichsfaktor wird dafür nicht gebildet (§ 10 ImmoWertV).',
        merkmal: mv.merkmal, ...gemein });
    }
    if (mv.fehlen.length) {
      const fm = mv.fehlen.map((a) => ({ merkmal: a.merkmal || a.feld, feld: a.feld, bez: a.bez || a.feld,
        klassen: a.klassen || null, hilfe: a.hilfe || null, url: a.url || null, eintragen: _eintragenText(a.feld) }));
      return _mitSatz({ verfuegbar: false, grund: 'merkmal_fehlt', fehlende_merkmale: fm,
        hinweis: 'Merkmal fehlt: ' + fm.map((x) => x.bez).join(', ') + '. Der Vergleichsfaktor ('
          + (s.gaa_name || 'Gutachterausschuss') + ') hängt davon ab; ohne die Angabe wird kein Wert gebildet. '
          + fm.map((x) => x.bez + (x.klassen ? ' (' + x.klassen.join(' · ') + ')' : '') + ' eintragen: ' + x.eintragen
            + (x.url ? ' — Grundlage: ' + x.url : '')).join('; ') + '.',
        ...gemein });
    }
    merkmalHerkunft = mv.herkunft;
  }

  const rr = auswerten({ ...f, kennzahl: 'vergleichsfaktor',
                         korrekturen: s.korrekturen || [] }, eingabe);
  if (!rr.verfuegbar) {
    return _mitSatz({ verfuegbar: false, grund: rr.grund, hinweis: rr.hinweis,
      spanne: rr.spanne || null, ...gemein });
  }

  /* v3008 · W1 - jede Korrektur des Satzes muss angewandt oder in der Norm sein. */
  const kz = _korrekturenPruefen(s.korrekturen, eingabe, rr.korrekturen_offen);
  const blockiert = kz.filter((z) => z.status !== 'norm');
  if (blockiert.length) {
    const txt = (z) => z.status === 'merkmal_fehlt'
      ? `Merkmal fehlt: ${z.bez} (eintragen: ${_eintragenText(z.feld)})`
      : z.status === 'ausserhalb'
        ? `${z.bez}: Angabe ${z.wert} liegt außerhalb der Tabelle des Ausschusses`
          + (z.spanne ? ` (${z.spanne[0]} bis ${z.spanne[1]})` : '') + ' — nicht auf Rand oder Norm gesetzt'
        : `${z.bez}: Anpassung im Dokument genannt, ihre Werte liegen nicht rechenbar vor`;
    return _mitSatz({ verfuegbar: false,
      grund: blockiert.some((z) => z.status === 'merkmal_fehlt') ? 'merkmal_fehlt' : 'korrektur_nicht_anwendbar',
      hinweis: 'Für dieses Gebiet führt der Gutachterausschuss (' + (s.gaa_name || '–') + ') einen Vergleichsfaktor ('
        + 'Tabellenwert ' + rr.tabellenwert + ' €/m²), der an das Objekt anzupassen ist (§ 26 Abs. 1, § 9 Abs. 1 '
        + 'ImmoWertV). Offen: ' + blockiert.map(txt).join('; ') + '. Ohne diese Anpassung wird kein Vergleichswert gebildet.',
      korrekturen_offen: blockiert,
      rechenweg: 'Tabellenwert ' + rr.tabellenwert + ' €/m² · offen: ' + blockiert.map((z) => z.bez + ' (' + (z.status === 'merkmal_fehlt' ? 'Merkmal fehlt' : z.status === 'ausserhalb' ? 'außerhalb der Tabelle' : 'nicht rechenbar') + ')').join(' · ') + ' → kein Wert',
      faktor_tabelle: rr.tabellenwert, ...gemein });
  }

  /* v3008 · Ost-Befund 1 · DIE BEZUGSGROESSE IST EINE ART, KEINE ZAHL.
     Hier stand `bezugsgroesse: zahlOderNull(arg.wfl ?? arg.wohnflaeche ?? arg.bgf)`
     - die ZAHL der Wohnflaeche. Der Orchestrator sucht darin „bgf" und
     fand es nie: ein BGF-Faktor waere mit der Wohnflaeche multipliziert
     worden (rund 45 % zu wenig). Die Art steht im Satz (liefert_einheit). */
  const _einheitText = String(f.liefert_einheit || f.einheit || s.einheit || '');
  const bezugsart = /bgf|brutto/i.test(_einheitText) ? 'bgf' : 'wohnflaeche';
  const bez = bezugsart === 'bgf'
    ? zahlOderNull(arg.bgf_qm ?? arg.bgf)
    : zahlOderNull(arg.wfl ?? arg.wohnflaeche ?? arg.wohnflaeche_qm);
  const objektwert = (rr.liefert === 'wert_eur' && bez)
    ? Math.round(rr.wert * bez) : null;

  /* v3008 · Rechenweg der Merkmalsmatrix: woher jede Klasse kommt. */
  let rechenweg = rr.rechenweg || null;
  const hinweise = [];
  if (f.form === 'merkmalsmatrix') {
    const zelle = rr.zelle || [];
    const pfad = zelle.map((z) => z.klasse).join('|');
    const info = (f.zellen_info || {})[pfad] || null;
    const herk = (m) => (merkmalHerkunft.find((h) => h.merkmal === m) || {}).text;
    rechenweg = zelle.map((z) => herk(z.merkmal) || `${z.bez}: ${z.eingabe}${String(z.eingabe) !== z.klasse ? ' → ' + z.klasse : ''}`).join(' · ')
      + ` → Vergleichsfaktor ${rr.wert} €/m² ${bezugsart === 'bgf' ? 'BGF' : 'Wohnfläche'}`
      + (f.beschluss_text ? ` (${f.beschluss_text})` : '');
    if (info && info.text) hinweise.push(info.text);
  } else if (kz.length) {
    const norm = kz.filter((z) => z.status === 'norm' && !(rr.korrekturen || []).some((k) => k.merkmal === z.bez));
    if (norm.length) hinweise.push('Ohne Anpassung, weil das Merkmal in der Norm des Ausschusses liegt: '
      + norm.map((z) => z.bez).join(', ') + '.');
  }

  return _mitSatz({
    verfuegbar: true,
    wert: rr.wert,
    einheit: rr.einheit || null,
    einheit_bez: f.liefert_einheit || null,
    objektwert,
    objektwert_hinweis: objektwert === null
      ? 'Der Objektwert entsteht erst durch Multiplikation mit der '
        + 'Bezugsgröße (' + (bezugsart === 'bgf' ? 'Brutto-Grundfläche' : 'Wohnfläche') + '). Sie ist nicht erfasst; geraten wird '
        + 'sie nicht.'
      : null,
    bezugsgroesse: bezugsart,
    bezugsflaeche_qm: bez,
    modellform: f.form,
    rechenweg,
    merkmale: merkmalHerkunft,
    hinweise,
    korrekturen: rr.korrekturen || [],
    korrekturen_offen: [],
    korrekturen_geprueft: kz,
    stufe: s.stufe,
    stufe_grund: s.stufe_grund || null,
    ausschuss: s.gaa_name,
    zweig: s.zweig,
    fallzahl: s.fallzahl ?? b.fallzahl ?? null,
    stichtag: s.stichtag || null,
    berichtsjahr: s.berichtsjahr ?? null,
    modellansaetze: s.modellansaetze || {},
    quelle_url: s.quelle_url || null,
    quellenvermerk: s.quellenvermerk || null,
    lizenz: s.lizenz || null,
    fundstelle: b.fundstelle || s.fundstelle || null,
  });
}

/** v1094 · Bodenpreisindexreihe. INDIKATIV — eine Indexreihe ist kein
 *  Bewertungsparameter nach § 21, sondern eine Zeitreihe zur Einordnung
 *  und zur Umrechnung auf einen anderen Stichtag. Sie geht in keinen
 *  Rechenweg, solange nicht ausdrücklich auf einen Stichtag umgerechnet
 *  wird. */
export function bodenpreisindex({ ags, zweig, jahr } = {}) {
  const reg = finde('bodenpreisindex', ags);
  if (!reg.length) {
    return { verfuegbar: false, grund: 'kein_index_hinterlegt',
      hinweis: 'Für diesen Ort ist keine Bodenpreisindexreihe hinterlegt.' };
  }
  const s = (zweig && findeZweig('bodenpreisindex', ags, zweig)) || reg[0];
  const f = s.formel || {};
  const gemein = {
    verfuegbar: true, indikativ: true, kennzahl: 'bodenpreisindex',
    stufe: s.stufe || 'B', ausschuss: s.gaa_name, zweig: s.zweig,
    basisjahr: f.basisjahr ?? null, einheit: f.liefert || 'prozent',
    berichtsjahr: s.berichtsjahr ?? null, stichtag: s.stichtag || null,
    quelle_url: s.quelle_url || null, quellenvermerk: s.quellenvermerk || null,
    lizenz: s.lizenz || null, reihe: f.zellen || null,
  };
  if (jahr == null) return gemein;
  const rr = auswerten({ ...f, kennzahl: 'bodenpreisindex' },
                       { jahr: Number(jahr), ...(arguments[0] || {}) });
  if (!rr.verfuegbar) {
    return { ...gemein, verfuegbar: false, grund: rr.grund, hinweis: rr.hinweis };
  }
  return { ...gemein, jahr: Number(jahr), wert: rr.dokumentwert ?? rr.wert };
}

/** Kleine Hilfe: Zahl oder null — Number(null) ist 0 und besteht isFinite. */
function zahlOderNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Vorschlag für den Gartenland-Wertansatz, oder null. */
export function gartenland(o) {
  const a = zustaendig(o && o.ags);
  if (!a || !a.gartenland) return { verfuegbar: false, grund: 'kein_ausschuss_hinterlegt' };
  const r = a.gartenland(o);
  if (r && r.verfuegbar) r.ausschuss = a.name;
  return r;
}

/** Bezugsgröße des Richtwertgrundstücks, wenn der Ausschuss eine nennt. */
export function bezugsgroesse(ags) {
  const a = zustaendig(ags);
  return a && a.bezugsgroesse_qm ? a.bezugsgroesse_qm : null;
}

export default { AUSSCHUESSE, zustaendig, sachwertfaktor, gartenland,
  erbbaurechtskoeffizient,   /* v1339 */
  quellen,                   /* v1343 */
  bezugsgroesse, kreisAus, liegenschaftszinssatz, bodenpreisniveau,
  marktdaten, durchschnittspreis, vergleichsfaktor, bodenpreisindex,
  registerStand };
