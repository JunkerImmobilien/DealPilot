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

/**
 * Nur die Klassen — fuer Aufrufer, die (noch) keine objectTypes durchreichen
 * koennen. Alte Signatur, damit nichts stumm auf undefined faellt.
 */
export function klassen(propertyType, offerType) {
  return segment(propertyType, offerType).objectClasses;
}
