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
export function sachwertfaktor(o) {
  const ags = o && o.ags;
  const a = zustaendig(ags);
  if (a) {
    const r = a.sachwertfaktor(o);
    if (r && r.verfuegbar) { r.ausschuss = a.name; r.herkunft = 'modul'; }
    return r;
  }
  /* Noch kein Modul — traegt das Register etwas? */
  const reg = finde('sachwertfaktor', ags);
  if (reg.length) {
    return { verfuegbar: false, grund: 'register_ohne_auswerter',
      hinweis: 'Für diesen Ausschuss liegt ein Registereintrag vor, aber noch '
        + 'kein freigeschalteter Auswerter. Er wird im nächsten Schritt '
        + 'verdrahtet; gerechnet wird bis dahin nicht.',
      ausschuss: reg[0].gaa_name || null };
  }
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
