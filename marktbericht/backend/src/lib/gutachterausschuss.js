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
  rnd: ['rnd_jahre', 'restnutzungsdauer_jahre', 'rnd'],
  bgf: ['bgf_qm', 'bgf_direkt', 'bgf'],
  baujahr: ['baujahr', 'build_year'],
  flaeche: ['grundstuecksflaeche_qm', 'flaeche_qm', 'gsfl', 'flaeche'],
  baugrundstuecksflaeche: ['baugrundstuecksflaeche_qm',
    'grundstuecksflaeche_qm', 'flaeche_qm', 'gsfl'],
  baulandflaeche: ['baulandflaeche_qm', 'grundstuecksflaeche_qm', 'gsfl'],
  lagewert: ['lagewert', 'brw_eur_qm', 'brw_sqm'],
  /* v1088 */
  gebaeudestandard: ['gebaeudestandard', 'standardstufe'],
  ort: ['ort', 'gemeinde_name', 'gemeinde'],
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
const ZWEIG_VORZUG = [
  [/eigentumswohnung|etw|whg|wohnung/i, ['etw', 'we', 'wohnung']],
  [/mehrfamilien|mfh/i, ['mfh', 'mfh_bis6', 'mfh_ueber6']],
  [/dreifamilien|dreifh/i, ['dreifh']],
  [/reihenmittel|rmh/i, ['rmh', 'rh', 'rhdhh']],
  [/reihenend|doppelhaus|dhh|reh/i, ['rhdhh', 'dhh', 'reh', 'rh']],
  [/reihenhaus|rh/i, ['rh', 'rhdhh', 'rmh']],
  [/zweifamilien|zfh/i, ['zfh', 'ezfh']],
  [/einfamilien|efh|freistehend/i, ['efh', 'ezfh']],
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

  const gefuehrt = reg.map((x) => String(x.zweig || '').toLowerCase());
  const satz = zweigWaehlen(reg, gefuehrt, o.zweig || o.objektart,
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

  const r = auswerten({ ...(satz.formel || {}),
                        kennzahl: 'sachwertfaktor',
                        korrekturen: satz.korrekturen || [] },
                      eingabeBruecke(o));

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
  return r;
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
    const rr = auswerten({ ...f, kennzahl: 'liegenschaftszinssatz',
                           korrekturen: s.korrekturen || [] },
                         eingabeBruecke({ ...arg }));
    if (!rr.verfuegbar) {
      return { verfuegbar: false, grund: rr.grund, hinweis: rr.hinweis,
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
export function vergleichsfaktor(arg = {}) {
  const { ags, zweig, objektart } = arg;
  const reg = finde('vergleichsfaktor', ags);
  if (!reg.length) {
    return { verfuegbar: false, grund: 'kein_ausschuss_hinterlegt',
      hinweis: 'Für diesen Ort ist kein Vergleichsfaktor hinterlegt. '
        + 'Übertragen werden darf er nicht (§ 10 ImmoWertV).' };
  }
  const s = findeZweig('vergleichsfaktor', ags, zweig)
    || zweigWaehlen(reg, reg, objektart, arg.baujahr)
    || null;
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
    return { verfuegbar: false, grund: 'gefuehrt_aber_nicht_abgeleitet',
      hinweis: 'Der Ausschuss führt diese Objektart, hat für sie aber '
        + 'keinen Vergleichsfaktor abgeleitet.',
      ausschuss: s.gaa_name || null, zweig: s.zweig,
      stichtag: s.stichtag || null, berichtsjahr: s.berichtsjahr ?? null };
  }

  const rr = auswerten({ ...f, kennzahl: 'vergleichsfaktor',
                         korrekturen: s.korrekturen || [] },
                       eingabeBruecke({ ...arg }));
  if (!rr.verfuegbar) {
    return { verfuegbar: false, grund: rr.grund, hinweis: rr.hinweis,
      spanne: rr.spanne || null,
      ausschuss: s.gaa_name || null, zweig: s.zweig, modellform: f.form,
      stichtag: s.stichtag || null, berichtsjahr: s.berichtsjahr ?? null };
  }

  /* Die Bezugsgröße wird NICHT geraten. Ohne sie gibt es den Wert je
   * Einheit und keinen Objektwert. */
  const bez = zahlOderNull(arg.wfl ?? arg.wohnflaeche ?? arg.bgf);
  const objektwert = (rr.liefert === 'wert_eur' && bez)
    ? Math.round(rr.wert * bez) : null;

  return {
    verfuegbar: true,
    wert: rr.wert,
    einheit: rr.einheit || null,
    einheit_bez: f.liefert_einheit || null,
    objektwert,
    objektwert_hinweis: objektwert === null
      ? 'Der Objektwert entsteht erst durch Multiplikation mit der '
        + 'Bezugsgröße (Wohnfläche). Sie ist nicht erfasst; geraten wird '
        + 'sie nicht.'
      : null,
    bezugsgroesse: bez,
    modellform: f.form,
    rechenweg: rr.rechenweg || null,
    korrekturen: rr.korrekturen || [],
    korrekturen_offen: rr.korrekturen_offen || [],
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
  };
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
  bezugsgroesse, kreisAus, liegenschaftszinssatz, bodenpreisniveau,
  marktdaten, durchschnittspreis, vergleichsfaktor, bodenpreisindex,
  registerStand };
