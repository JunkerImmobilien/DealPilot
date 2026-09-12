/* ═══════════════════════════════════════════════════════════════════════
   marktsegment.js · v1314 · Objektart -> GeoMap-Marktsegment
   ═══════════════════════════════════════════════════════════════════════

   WARUM ES DAS GIBT
   `geomapClasses()` stand zweimal im Haus — in MarketAnalysisService und in
   MarketInsightsService — und machte in beiden aus mfh, efh, zfh, dhh und rh
   pauschal `['Haus']`. Ein Mehrfamilienhaus wurde damit am Hausmarkt
   gemessen, und der besteht ueberwiegend aus Ein- und Zweifamilienhaeusern.

   GEMESSEN am 11.09.2026, Bielefeld, 5 km Umkreis, gegen die echte API:

     Kauf  objectClasses ['Haus']                  Median 2.553,47  n=6.684
     Kauf  + objectTypes ['Mehrfamilienhaus']      Median 2.093,15  n=1.541
                                                   -> 22,0 % ZU HOCH

     Miete objectClasses ['Haus']                  Median 9,49      n=1.017
     Miete objectClasses ['Wohnung']               Median 8,82      n=55.056
                                                   ->  7,6 % ZU HOCH

     Kauf  + objectTypes ['EinZweiFamilienhaus']   Median 2.729,15  n=3.748
                                                   ->  6,4 % zu niedrig fuer EFH

   Beim MFH wirken beide Fehler in dieselbe Richtung: der Kaufpreis je m²
   zu hoch UND die Miete zu hoch. Der Rohertrag im Ertragswert steht auf
   einer Miete, die an vermieteten HAEUSERN gemessen wurde — ein MFH
   vermietet aber Wohnungen. Dazu kommt die Stichprobe: 1.017 gegen 55.056.

   WELCHE objectTypes ES GIBT
   Die API nennt sie nicht; ein falscher Wert kommt als
   400 „Unknown objectType: …" zurueck. Aus 14 echten Haus-Angeboten
   gesammelt (getDetailsById -> objectType):

     EinZweiFamilienhaus   9
     Mehrfamilienhaus      3
     Sonstige              2

   Feiner geht es nicht — Reihenhaus, Doppelhaushaelfte, Villa und Bungalow
   quittiert die API alle mit 400. Deshalb fallen dhh und rh mit efh und zfh
   in denselben Topf; das ist immer noch naeher dran als `['Haus']`.
   ═══════════════════════════════════════════════════════════════════════ */

/* Die einzigen objectType-Werte, die die API im Segment Wohnen/Haus kennt. */
export const OBJEKTTYP_MFH = 'Mehrfamilienhaus';
export const OBJEKTTYP_EFH = 'EinZweiFamilienhaus';

/**
 * segment(propertyType, offerType) -> { objectClasses, objectTypes|undefined }
 *
 * propertyType  interne Objektart: 'etw' | 'mfh' | 'efh' | 'zfh' | 'dhh' | 'rh'
 *               oder ein Text, der 'wohn' bzw. 'haus' enthaelt
 * offerType     'Kauf' | 'Miete'
 *
 * Die Rueckgabe wird direkt in die GeoMap-Nutzlast gespreizt. `objectTypes`
 * fehlt, wo es keine sinnvolle Verengung gibt — ein leeres Array waere
 * nicht dasselbe, die API liest es als „nichts davon".
 */
export function segment(propertyType, offerType) {
  const miete = String(offerType || '').toLowerCase().startsWith('m');
  if (!propertyType) return { objectClasses: ['Wohnung', 'Haus'] };
  const p = String(propertyType).toLowerCase();

  /* Eigentumswohnung: Kauf wie Miete am Wohnungsmarkt. */
  if (p.includes('wohn') || p === 'etw') return { objectClasses: ['Wohnung'] };

  /* Mehrfamilienhaus: gekauft wird ein MFH, VERMIETET werden Wohnungen.
     Das ist der Kern des Fehlers — die Miete eines MFH am Markt vermieteter
     Haeuser zu messen heisst, ein Einfamilienhaus als Massstab zu nehmen. */
  if (p === 'mfh' || p.includes('mehrfamilien')) {
    return miete
      ? { objectClasses: ['Wohnung'] }
      : { objectClasses: ['Haus'], objectTypes: [OBJEKTTYP_MFH] };
  }

  /* Ein- und Zweifamilienhaus, Doppelhaushaelfte, Reihenhaus. Feiner
     unterscheidet die API nicht. Beim Kauf wie bei der Miete dasselbe
     Segment: wer ein EFH mietet, mietet ein ganzes Haus. */
  if (['efh', 'zfh', 'dhh', 'rh', 'rmh'].includes(p) || p.includes('haus')) {
    return { objectClasses: ['Haus'], objectTypes: [OBJEKTTYP_EFH] };
  }

  return { objectClasses: ['Wohnung', 'Haus'] };
}

/* ═══ v1323 · Gewerbe ══════════════════════════════════════════════════
   Der Connector setzte objectCategories hart auf ['Wohnen'] - damit war
   Gewerbe gar nicht abfragbar, obwohl die API es kann. Gemessen Bielefeld,
   5 km, 12 Monate: Kauf 1.499,98 EUR/m2 (n=153), Miete 10,00 EUR/m2 (n=856).

   WELCHE KLASSEN ES GIBT, sagt die API nicht; ein falscher Wert kommt als
   400 "Unknown objectClass" zurueck. Aus 16 echten Gewerbe-Angeboten
   gesammelt (getDetailsById -> objectClass):

     BüroPraxis (der Umlaut ist Pflicht)   6
     Sonstige                                        5
     HalleLagerProduktion                            3
     Einzelhandel                                    1
     Gastronomie                                     1

   'Buero', 'BueroPraxis' ohne Umlaut, 'Halle' und 'Lager' quittiert die
   API alle mit 400. Der Umlaut ist Pflicht. */
export const GEWERBE_KLASSEN = {
  buero:   'BüroPraxis',
  praxis:  'BüroPraxis',
  gesch:   'Einzelhandel',
  laden:   'Einzelhandel',
  hotel:   'Gastronomie',
  gastro:  'Gastronomie',
  gew:     'HalleLagerProduktion',
  halle:   'HalleLagerProduktion',
  lager:   'HalleLagerProduktion',
};

/**
 * istGewerbe(propertyType) - gehoert die Objektart ins Segment Gewerbe?
 */
export function istGewerbe(propertyType) {
  if (!propertyType) return false;
  const p = String(propertyType).toLowerCase().replace(/[^a-z]/g, '');
  return Object.prototype.hasOwnProperty.call(GEWERBE_KLASSEN, p);
}

/**
 * gewerbeSegment(propertyType) -> { objectCategories, objectClasses } | null
 * null heisst: keine Gewerbeart, der normale Weg gilt.
 */
export function gewerbeSegment(propertyType) {
  if (!istGewerbe(propertyType)) return null;
  const p = String(propertyType).toLowerCase().replace(/[^a-z]/g, '');
  return { objectCategories: ['Gewerbe'], objectClasses: [GEWERBE_KLASSEN[p]] };
}

/**
 * Nur die Klassen — fuer Aufrufer, die (noch) keine objectTypes durchreichen
 * koennen. Alte Signatur, damit nichts stumm auf undefined faellt.
 */
export function klassen(propertyType, offerType) {
  return segment(propertyType, offerType).objectClasses;
}
