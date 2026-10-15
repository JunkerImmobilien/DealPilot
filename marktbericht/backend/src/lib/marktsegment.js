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

/* ═══ v2241 · DIE GEWERBEART GING AUF DEM WEG VERLOREN ═══════════════════
   GEMESSEN am 15.10.2026: der DealPilotObjectMapper machte aus BUERO,
   GESCH, HOTEL und GEW einheitlich `gewerbe`. Dieser Schluessel stand in
   GEWERBE_KLASSEN nicht — `istGewerbe('gewerbe')` war false, der
   Gewerbe-Zweig im Marktkontext griff nie, und `segment('gewerbe')` fiel
   auf ['Wohnung','Haus']. Ein Buerogebaeude wurde damit an Wohnungs- und
   Hausangeboten gemessen (Vergleich UND Miete).

   Jetzt reist die Art getrennt: `property_type` bleibt `gewerbe` (darauf
   pruefen Sachwert, Verfahrenswahl, Erbbaurecht, IRW), die Unterart
   kommt als `gewerbe_art` mit. `gewerbe` ohne Unterart ist Gewerbe — aber
   eines, dessen Klasse niemand kennt, und das wird nicht geraten. */
const GEWERBE_ART_MUSTER = [
  [/buero|büro|bureau|verwaltung/, 'buero'],
  [/praxis|arzt/, 'praxis'],
  [/laden|handel|einzelhandel|markt/, 'laden'],
  [/gesch(ae|ä)?ft|^gesch$/, 'gesch'],
  [/hotel|pension|beherberg/, 'hotel'],
  [/gastro|restaurant|gaststaett|gaststätt|kneipe|cafe/, 'gastro'],
  [/halle/, 'halle'],
  [/lager|logistik/, 'lager'],
  [/^gew$|gewerbe.*industrie|industrie|produktion|werkstatt/, 'gew'],
];

/**
 * gewerbeArt(raw) -> Schluessel aus GEWERBE_KLASSEN | null
 * Liest App-Codes (BUERO, GESCH, HOTEL, GEW) und Freitext (Ladenlokal,
 * Buerohaus, Arztpraxis). Das blosse Wort „Gewerbe" ergibt null: es sagt
 * DASS, aber nicht WELCHES Gewerbe.
 */
export function gewerbeArt(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  const kurz = s.replace(/[^a-zäöü]/g, '');
  if (Object.prototype.hasOwnProperty.call(GEWERBE_KLASSEN, kurz)) return kurz;
  for (const [re, art] of GEWERBE_ART_MUSTER) if (re.test(s)) return art;
  return null;
}

/**
 * istGewerbe(propertyType) - gehoert die Objektart ins Segment Gewerbe?
 * v2241: auch das allgemeine `gewerbe` (ohne Unterart) ist Gewerbe.
 */
export function istGewerbe(propertyType) {
  if (!propertyType) return false;
  const p = String(propertyType).toLowerCase().replace(/[^a-z]/g, '');
  if (p === 'gewerbe') return true;
  return Object.prototype.hasOwnProperty.call(GEWERBE_KLASSEN, p);
}

/**
 * gewerbeSegment(art) -> { objectCategories, objectClasses } | null
 * `art` ist die Gewerbeart (buero, gesch, …) oder ein App-Code.
 * null heisst: keine bestimmbare Gewerbeklasse. Das allgemeine `gewerbe`
 * liefert ebenfalls null — der ganze Gewerbemarkt (Buero, Halle, Laden
 * zusammen) ist kein Vergleichsmassstab fuer ein bestimmtes Objekt.
 */
export function gewerbeSegment(art) {
  const k = gewerbeArt(art);
  if (!k) return null;
  return { objectCategories: ['Gewerbe'], objectClasses: [GEWERBE_KLASSEN[k]], gewerbe_art: k };
}

/* ═══ v2241 · UNBEBAUTES GRUNDSTUECK ═════════════════════════════════════ */
export function istGrundstueck(propertyType) {
  const p = String(propertyType || '').toLowerCase().trim();
  return p === 'grundstueck' || p === 'grst' || /grundst(ue|ü)ck|bauland|unbebaut/.test(p);
}

/**
 * objektartNormal(raw) -> { property_type, gewerbe_art }
 *
 * EINE Stelle, die Gewerbe, Garage und Grundstueck auf den internen
 * Schluessel bringt — egal ob er als App-Code (BUERO, GAR, GRST) aus der
 * Marktbericht-App kommt oder bereits uebersetzt aus dem
 * DealPilotObjectMapper. Wohnarten bleiben UNVERAENDERT stehen (ETW, efh,
 * wohnung …): an ihnen haengen Regex-Pruefungen in zwanzig Modulen, und
 * fuer sie gibt es nichts zu korrigieren.
 */
export function objektartNormal(raw) {
  if (raw == null || raw === '') return { property_type: raw == null ? null : raw, gewerbe_art: null };
  const s = String(raw).toLowerCase().trim();
  if (istGrundstueck(s)) return { property_type: 'grundstueck', gewerbe_art: null };
  if (/^gar$|^garage$|stellplatz/.test(s)) return { property_type: 'garage', gewerbe_art: null };
  if (s === 'gewerbe') return { property_type: 'gewerbe', gewerbe_art: null };
  /* Nur ausdrueckliche Gewerbecodes — kein Freitext-Raten an einer
     Wohnart vorbei („Wohn- und Geschaeftshaus" bleibt, was es war). */
  const kurz = s.replace(/[^a-z]/g, '');
  if (Object.prototype.hasOwnProperty.call(GEWERBE_KLASSEN, kurz)) {
    return { property_type: 'gewerbe', gewerbe_art: kurz };
  }
  return { property_type: raw, gewerbe_art: null };
}

/**
 * zinsObjektart(gewerbeArt) -> Objektart fuer die Zweigwahl des
 * Liegenschaftszinssatzes (lib/zweigwahl.js typVon). Jede Rangfolge dort
 * fuehrt nur GEWERBLICHE Zweige — anders als 'gesch', das typVon als
 * Wohn- und Geschaeftshaus liest und bis zum MFH-Zweig zurueckfaellt.
 */
export function zinsObjektart(art) {
  const k = gewerbeArt(art);
  if (!k) return null;
  return { buero: 'buero', praxis: 'buero', gesch: 'handel', laden: 'handel',
           hotel: 'hotel', gastro: 'hotel', gew: 'gewerbe', halle: 'gewerbe', lager: 'gewerbe' }[k] || null;
}

/**
 * gewerbeAnlage3(art) -> Nutzungsschluessel der Instandhaltung nach
 * Anlage 3 ImmoWertV (wie im MFH-Konfigurator) | null.
 * Hotel und Gastronomie fuehrt Anlage 3 nicht — dort gibt es keinen
 * Ansatz, und es wird keiner erfunden.
 */
export function gewerbeAnlage3(art) {
  const k = gewerbeArt(art);
  if (!k) return null;
  return { buero: 'buero_praxis_laden', praxis: 'buero_praxis_laden', gesch: 'buero_praxis_laden',
           laden: 'buero_praxis_laden', gew: 'lager_logistik', halle: 'lager_logistik',
           lager: 'lager_logistik' }[k] || null;
}

/**
 * gewerbeGndSchluessel(art) -> Schluessel der GND-Tabelle (lib/immowertv.js)
 */
export function gewerbeGndSchluessel(art) {
  const k = gewerbeArt(art);
  if (!k) return null;
  return { buero: 'buero', praxis: 'buero', gesch: 'geschaeft', laden: 'geschaeft',
           hotel: 'hotel', gastro: 'hotel', gew: 'lager', halle: 'lager', lager: 'lager' }[k] || null;
}

/**
 * Nur die Klassen — fuer Aufrufer, die (noch) keine objectTypes durchreichen
 * koennen. Alte Signatur, damit nichts stumm auf undefined faellt.
 */
export function klassen(propertyType, offerType) {
  return segment(propertyType, offerType).objectClasses;
}
