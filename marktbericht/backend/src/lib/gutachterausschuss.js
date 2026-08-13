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
};

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

function zweigWaehlen(reg, gefuehrt, objektart) {
  const t = String(objektart || '').trim();
  if (!t) return null;
  const direkt = gefuehrt.indexOf(t.toLowerCase());
  if (direkt >= 0) return reg[direkt];
  for (const [muster, vorzug] of ZWEIG_VORZUG) {
    if (!muster.test(t)) continue;
    for (const z of vorzug) {
      const i = gefuehrt.indexOf(z);
      if (i >= 0) return reg[i];
    }
    return null;          /* erkannt, aber der Ausschuss fuehrt sie nicht */
  }
  return null;
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
  const reg = finde('sachwertfaktor', ags);
  if (!reg.length) return null;      /* faellt auf 'kein_ausschuss_hinterlegt' */

  const gefuehrt = reg.map((x) => String(x.zweig || '').toLowerCase());
  const satz = zweigWaehlen(reg, gefuehrt, o.zweig || o.objektart);

  if (!satz) {
    return { verfuegbar: false, grund: 'objektart_nicht_abgeleitet',
      hinweis: 'Der Gutachterausschuss hat für diese Objektart keinen '
        + 'Sachwertfaktor abgeleitet. Geführt werden: ' + gefuehrt.join(', ')
        + '. Faktoren anderer Objektarten dürfen nicht übertragen werden '
        + '(§ 10 ImmoWertV).',
      ausschuss: reg[0].gaa_name || null,
      gefuehrte_zweige: gefuehrt };
  }

  const r = auswerten({ ...(satz.formel || {}),
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
    const r = a.sachwertfaktor(o);
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
export function liegenschaftszinssatz({ ags, zweig } = {}) {
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
  const f = s.formel || {};
  const m = s.modellansaetze || {};
  const b = (s.belege && s.belege[0]) || {};
  return {
    verfuegbar: true,
    wert_pct: f.wert,
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
  bezugsgroesse, kreisAus, liegenschaftszinssatz, registerStand };
