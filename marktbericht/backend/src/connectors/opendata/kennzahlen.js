// kennzahlen.js  (v1063)
//
// DAS GEMEINSAME VOKABULAR.
//
// Es gibt zwei Parametertabellen, und sie sprechen nicht dieselbe Sprache:
//
//   mb.wert_parameter   typ = 'lzs' | 'sachwertfaktor' | ...
//                       objektart = 'etw' | 'efh' | 'mfh_bis6' | 'mfh_ueber6' | ...
//                       -> die lebende Kaskade (WertParameterService)
//
//   mb.param_werte      kennzahl = frei, kommt aus der Legende des Parsers
//                       objektart = frei
//                       -> die Open-Data-Ernte (param-repository)
//
// Ohne Uebersetzung findet die Kaskade in der OD-Tabelle nichts, egal wie voll
// sie ist. Diese Datei ist die EINZIGE Stelle, an der uebersetzt wird — nicht
// drei Stellen, die auseinanderlaufen (die Lehre aus config.js / pricing-modal
// / landing: drei Wahrheiten von Hand sind zwei zu viel).
//
// Die Namen links sind die kanonischen. Wer eine Legende pflegt
// (data/imbde_legende.csv) oder einen Parser schreibt, benutzt GENAU diese.
// Alles andere landet als semantik_offen und wird von der Kaskade bewusst
// nicht gelesen — lieber unsichtbar als falsch verstanden.

/** kanonische Kennzahl -> typ der lebenden Parametertabelle */
export const KENNZAHL_ZU_TYP = {
  liegenschaftszinssatz: 'lzs',
  sachwertfaktor: 'sachwertfaktor',
  vergleichsfaktor: 'vergleichsfaktor',
  bewirtschaftungskostenquote: 'bwk_quote',
  marktmiete: 'marktmiete',
  restnutzungsdauer: 'rnd',
  gesamtnutzungsdauer: 'gnd',
  bodenrichtwert: 'brw',
  kaufpreis_qm: 'kaufpreis_qm',
  /* v1065-WVOK-1 · Der gezahlte Kaufpreis eines Baugrundstuecks je m2.
   * NICHT dasselbe wie der Bodenrichtwert: der ist ein abgeleiteter
   * Lagewert nach Paragraf 196 BauGB, dies hier ist ein Marktpreis.
   * Beide in einen Topf zu werfen waere bequem und falsch. */
  baulandpreis_qm: 'baulandpreis_qm',
};

export const TYP_ZU_KENNZAHL = Object.keys(KENNZAHL_ZU_TYP)
  .reduce((acc, k) => { acc[KENNZAHL_ZU_TYP[k]] = k; return acc; }, {});

/** typ der Kaskade -> kanonische Kennzahl. null = in OD nicht vorgesehen. */
export function kennzahlFuerTyp(typ) {
  return TYP_ZU_KENNZAHL[String(typ || '')] || null;
}

/**
 * Objektart der Kaskade -> Objektart der OD-Tabelle.
 *
 * Die OD-Quellen unterscheiden Mehrfamilienhaeuser NICHT nach der Zahl der
 * Wohneinheiten — der Immobilienmarktbericht Deutschland kennt schlicht
 * "Mehrfamilienhaus". Beide Kaskadenwerte laufen deshalb auf 'mfh'. Das ist
 * eine Vergroeberung, und sie ist bewusst: die Alternative waere, eine
 * Unterscheidung zu behaupten, die in der Quelle nicht steht.
 */
export const OBJEKTART_ZU_OD = {
  etw: 'etw',
  efh: 'efh',
  zfh: 'zfh',
  dhh: 'dhh',
  rh: 'rh',
  mfh_bis6: 'mfh',
  mfh_ueber6: 'mfh',
  alle: 'alle',
};

export function objektartFuerOd(art) {
  return OBJEKTART_ZU_OD[String(art || '')] || 'alle';
}

/* v1065-WVOK-4 · Die Objektarten, die auf der OD-Seite vorkommen duerfen.
 * 'etw_neubau' steht bewusst darin und in KEINER Zuordnung der Kaskade:
 * der Bericht fuehrt neue und gebrauchte Eigentumswohnungen getrennt
 * (Abb. 4-86 gegen 4-92, 3.430 bis 5.683 gegen 1.400 bis 3.250 Euro/m2).
 * Wer eine Bestandswohnung bewertet, bekommt den Bestandspreis. Der
 * Neubaupreis bleibt als Bestand liegen, ohne je danebengestellt zu werden.
 *
 * Zugleich verhindert die Trennung eine Kollision im Eindeutigkeitsindex:
 * beide Spalten tragen dieselbe Kennzahl und denselben AGS und wuerden
 * sich sonst gegenseitig ueberschreiben. */
export const OD_OBJEKTARTEN = [
  'alle', 'etw', 'etw_neubau', 'efh', 'zfh', 'dhh', 'rh', 'mfh',
];

export function objektartErlaubt(art) {
  return OD_OBJEKTARTEN.indexOf(String(art || '')) >= 0;
}

/** Einheiten, die zu einer Kennzahl passen — Plausibilitaetsbremse. */
export const EINHEIT_ERWARTET = {
  liegenschaftszinssatz: ['%', 'prozent'],
  bewirtschaftungskostenquote: ['%', 'prozent'],
  marktmiete: ['EUR/m²', 'EUR/qm', '€/m²'],
  kaufpreis_qm: ['EUR/m²', 'EUR/qm', '€/m²'],
  baulandpreis_qm: ['EUR/m²', 'EUR/qm', '€/m²'],   /* v1065-WVOK-2 */
  bodenrichtwert: ['EUR/m²', 'EUR/qm', '€/m²'],
  restnutzungsdauer: ['Jahre', 'a'],
  gesamtnutzungsdauer: ['Jahre', 'a'],
};

/**
 * Bremse gegen den teuersten aller OD-Fehler: ein Zinssatz, der in Wahrheit
 * eine Quote ist, oder eine Miete, die ein Kaufpreis ist. Beides sieht in der
 * Datenbank gleich aus und faellt erst im Kundenbericht auf.
 *
 * Ist die Einheit unbekannt (null), wird NICHT abgelehnt — viele Quellen
 * liefern keine. Nur ein WIDERSPRUCH fuehrt zur Ablehnung.
 */
export function einheitPasst(kennzahl, einheit) {
  const erw = EINHEIT_ERWARTET[String(kennzahl || '')];
  if (!erw) return true;
  if (einheit == null || String(einheit).trim() === '') return true;
  const e = String(einheit).toLowerCase().replace(/\s+/g, '');
  return erw.some((x) => e.indexOf(String(x).toLowerCase().replace(/\s+/g, '')) >= 0);
}

/**
 * Plausibler Wertebereich je Kennzahl. Ein Liegenschaftszinssatz von 45 ist
 * kein Zinssatz, sondern eine falsch zugeordnete Spalte.
 */
export const BEREICH = {
  liegenschaftszinssatz: [0.1, 12],
  bewirtschaftungskostenquote: [5, 45],
  marktmiete: [1, 60],
  restnutzungsdauer: [1, 100],
  gesamtnutzungsdauer: [20, 100],
  sachwertfaktor: [0.2, 3.0],
  /* v1065-WVOK-3 · Gemessen an der AK-OGA-Datei 2025: die Klassengrenzen
   * fuer Eigenheim-Bauland reichen von "bis unter 70" bis "500 und mehr",
   * fuer Mehrfamilienhaus-Bauland bis "700 und mehr". Der Rahmen ist
   * grosszuegig gesetzt — er soll falsch zugeordnete Spalten fangen,
   * nicht teure Lagen. */
  baulandpreis_qm: [1, 5000],
  kaufpreis_qm: [100, 25000],
};

export function wertPlausibel(kennzahl, wert) {
  const b = BEREICH[String(kennzahl || '')];
  const n = Number(wert);
  if (!Number.isFinite(n)) return false;
  if (!b) return true;
  return n >= b[0] && n <= b[1];
}

export default {
  KENNZAHL_ZU_TYP, TYP_ZU_KENNZAHL, kennzahlFuerTyp,
  OBJEKTART_ZU_OD, objektartFuerOd, OD_OBJEKTARTEN, objektartErlaubt,   /* v1065-WVOK-5 */
  EINHEIT_ERWARTET, einheitPasst, BEREICH, wertPlausibel,
};
