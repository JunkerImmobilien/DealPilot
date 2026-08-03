// gutachterausschuss.js  (v1073)
//
// DER AUFLOESER.
//
// Jeder Gutachterausschuss veroeffentlicht seine eigenen Daten in seiner
// eigenen Struktur. Gemessen an drei nordrhein-westfaelischen Berichten:
//
//   Minden-Luebbecke  Sachwertfaktoren als Matrix Sachwert x Restnutzungsdauer
//                     Abschnitt 5.1.4, Gruenflaeche 5 EUR/m2 pauschal
//   Luedenscheid      eindimensional + Regressionsformel Y = a * X^b,
//                     Abschnitt 5.1.2, Aussenanlagen 5 % des Gebaeudesachwerts
//   Herford           Matrix Sachwert x BODENRICHTWERT + additive Zu-/Abschlaege
//                     fuer RND und BGF, Abschnitt 5.1.2, Gartenland 20 % des BRW
//
// Gleiches Bundesland, gleiches AGVGA-Modell — und trotzdem drei Strukturen,
// drei Abschnittsnummern, drei Modellansaetze. Ein gemeinsames Schema gibt es
// nicht. Was es geben muss, ist EINE Stelle, die entscheidet, welches Modul
// zustaendig ist. Sonst wandert die Kreispruefung in jedes Modul einzeln, und
// beim vierten vergisst sie jemand — genau so ist in v1060 der Vergleichs-
// faktor aus Minden-Luebbecke in einen Bericht fuer Hiddenhausen geraten.
//
// REGEL: kein Treffer heisst KEIN WERT. Nie ein Nachbarkreis, nie ein
// Landesmittel. Ein Sachwertfaktor gilt im Zustaendigkeitsbereich des
// Ausschusses, der ihn abgeleitet hat (§ 10 ImmoWertV).

import { sachwertfaktor as swfMindenLuebbecke, SWF_STAND as ML_STAND }
  from './sachwertfaktoren_nrw.js';
import { sachwertfaktor as swfHerford, gartenlandAnsatz as gartenHerford,
  HF_STAND, HF_BEZUGSGROESSE_QM } from './sachwertfaktoren_herford.js';
import { UK_STAND as ML_UK } from './umrechnung_nrw.js';

/** Die Ausschuesse, deren Daten hinterlegt sind. */
export const AUSSCHUESSE = [
  {
    ags_kreis: '05770',
    name: ML_STAND.ausschuss,
    bericht: ML_STAND.bericht,
    berichtsjahr: ML_STAND.berichtsjahr,
    sachwertfaktor: swfMindenLuebbecke,
    gartenland: ({ brw_eur_qm }) => ({
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
    ags_kreis: '05758',
    name: HF_STAND.ausschuss,
    bericht: HF_STAND.bericht,
    berichtsjahr: HF_STAND.berichtsjahr,
    sachwertfaktor: swfHerford,
    gartenland: gartenHerford,
    bezugsgroesse_qm: HF_BEZUGSGROESSE_QM,
  },
];

export function kreisAus(ags) {
  return String(ags || '').replace(/\D/g, '').slice(0, 5);
}

/** Zuständiger Ausschuss oder null. */
export function zustaendig(ags) {
  const k = kreisAus(ags);
  if (!k) return null;
  return AUSSCHUESSE.find((a) => a.ags_kreis === k) || null;
}

/**
 * Sachwertfaktor über den zuständigen Ausschuss.
 * Gibt immer dieselbe Form zurück — die Aufrufer müssen die Modelle nicht
 * kennen.
 */
export function sachwertfaktor(o) {
  const a = zustaendig(o && o.ags);
  if (!a) {
    return {
      verfuegbar: false, grund: 'kein_ausschuss_hinterlegt',
      hinweis: 'Für diesen Ort sind noch keine Sachwertfaktoren hinterlegt. '
        + 'Sie werden von jedem Gutachterausschuss einzeln abgeleitet und '
        + 'veröffentlicht; hinterlegt sind bisher '
        + AUSSCHUESSE.map((x) => x.name.replace(/^Der Gutachterausschuss für Grundstückswerte /, '')).join(' und ')
        + '. Übertragen werden dürfen sie nicht (§ 10 ImmoWertV).',
      hinterlegte_ausschuesse: AUSSCHUESSE.map((x) => x.ags_kreis),
    };
  }
  const r = a.sachwertfaktor(o);
  if (r && r.verfuegbar) r.ausschuss = a.name;
  return r;
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
  bezugsgroesse, kreisAus };
