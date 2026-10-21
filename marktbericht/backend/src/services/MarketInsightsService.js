// MarketInsightsService.js
// Leitet die Lage-/Potenzialbewertungen aus ECHTEN Daten ab (keine Nutzereingabe):
//   - Mikrolage         <- Geoapify-Score (POI-Dichte/Erreichbarkeit)
//   - Nachfrage/Tempo   <- GeoMap Angebotsdauer (TAGEONLINE): kurz = hohe Nachfrage
//   - Wertentwicklung   <- GeoMap Preishistorie (PREISPROQM ueber Jahre) -> CAGR
//   - Mietentwicklung   <- GeoMap Miethistorie (optional)
// Liefert sowohl Einstufungen (gut/mittel/...) als auch die Rohreihen fuer Charts.
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
import { cfg, geomapEnabled } from '../lib/config.js';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { segment, istGewerbe, istGrundstueck } from '../lib/marktsegment.js';   /* v1314, v2241 */
import { einstufen, schwelleText } from '../lib/lage_stufen.js';   /* v2518 */

// Historie/Trends aendern sich kaum -> lang cachen (Default 7 Tage), spart die ~10 Calls.
const INSIGHTS_CACHE_TTL_MS = (parseInt(process.env.INSIGHTS_CACHE_TTL_MIN, 10) || 10080) * 60 * 1000;

/* v1314 - geomapClasses() ist nach lib/marktsegment.js gewandert; die Kopie
 * hier war die zweite von zweien. Sie ist hier BESONDERS teuer gewesen:
 * dieselben Klassen gingen an die Kauf- UND die Mietreihe. Ein MFH wurde
 * damit auf beiden Seiten am Hausmarkt gemessen - der Kaufpreis 22 Prozent
 * zu hoch, die Miete 7,6 Prozent zu hoch, und beides floss in dieselbe
 * Wertentwicklung. Jetzt je Reihe das passende Segment. */
// CAGR aus erstem/letztem validen Punkt einer Zeitreihe
function cagr(series) {
  const pts = series.filter((p) => p.median != null && p.median > 0);
  if (pts.length < 2) return null;
  const first = pts[0], last = pts[pts.length - 1];
  const yrs = last.year - first.year;
  if (yrs <= 0) return null;
  return Math.pow(last.median / first.median, 1 / yrs) - 1;
}

export const MarketInsightsService = {
  /* v2518 · Die Vermarktungsdauer allein - fuer den Messdienst (/lage/gemessen),
     derselbe Abruf wie unten in derive(): KPI TAGEONLINE, Kauf, letzte 12
     Monate. KPI-Abrufe kosten kein Guthaben (gemessen 11.09.2026, v1321).
     -> { tage, von, bis } | null */
  async vermarktungsdauer(ref) {
    if (!geomapEnabled() || !ref || ref.lat == null || ref.lon == null) return null;
    if (istGewerbe(ref.property_type) || istGrundstueck(ref.property_type)) return null;
    const ck = 'vmd|' + ref.lat.toFixed(3) + '|' + ref.lon.toFixed(3) + '|' + (ref.property_type || '?');
    const c = cacheGet(ck);
    if (c) return c;
    const seg = segment(ref.property_type, 'Kauf');
    const von = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const bis = new Date().toISOString().slice(0, 10);
    const t = await GeoMapConnector.kpiCollection({
      lat: ref.lat, lon: ref.lon, offerType: 'Kauf', analyzedField: 'TAGEONLINE', objectClasses: seg.objectClasses, objectTypes: seg.objectTypes, period: { from: von, to: bis },
    });
    if (!t || t.error || t.median == null) return null;
    const r = { tage: t.median, von, bis };
    cacheSet(ck, r, INSIGHTS_CACHE_TTL_MS);
    return r;
  },

  // ref:{lat,lon,property_type}, micro:{score}. Gibt {assessment, series, dynamics} | null.
  async derive(ref, micro) {
    if (!geomapEnabled()) return null;
    /* v2241 · Preis- und Miethistorie, Markttempo und Wertentwicklung
       werden hier am WOHNmarkt gemessen (segment() kennt keine
       Gewerbekategorie, timeSeries() keinen Kategorie-Parameter). Fuer
       Gewerbe und unbebaute Grundstuecke waeren das Aussagen ueber einen
       anderen Markt — dann lieber keine. */
    if (istGewerbe(ref.property_type) || ref.gewerbe_art || istGrundstueck(ref.property_type)) return null;
    /* v1314: zwei Segmente statt einem - Kauf und Miete sind beim MFH
       verschiedene Maerkte. */
    const segKauf  = segment(ref.property_type, 'Kauf');
    const segMiete = segment(ref.property_type, 'Miete');
    const startYear = cfg.geomap.historyStartYear;
    const endYear = new Date().getFullYear();

    // Cache: Historie/Trends pro Standort+Objekttyp (aendert sich nur jaehrlich).
    const ck = [
      'ins', ref.lat != null ? ref.lat.toFixed(3) : '?', ref.lon != null ? ref.lon.toFixed(3) : '?',
      ref.property_type || '?', startYear, micro && micro.score != null ? micro.score : '?',
    ].join('|');
    const cached = cacheGet(ck);
    if (cached) return { ...cached, cached: true };

    // Jahre fuer die Zeitreihe: gleichmaessig auf max. Stuetzpunkte ausduennen (Kostenbremse).
    // Start- und Endjahr bleiben immer erhalten -> CAGR/Trend identisch, nur weniger GeoMap-Calls.
    const allYears = [];
    for (let y = startYear; y <= endYear; y++) allYears.push(y);
    const maxP = cfg.geomap.historyMaxPoints || 5;
    let years;
    if (allYears.length <= maxP) {
      years = allYears;
    } else {
      const picked = [];
      const step = (allYears.length - 1) / (maxP - 1);
      for (let i = 0; i < maxP; i++) picked.push(allYears[Math.round(i * step)]);
      years = [...new Set(picked)];
    }

    // 1) Preis-Zeitreihe (Kauf) + optional Miete
    const priceSeries = await GeoMapConnector.timeSeries({
      lat: ref.lat, lon: ref.lon, offerType: 'Kauf', analyzedField: 'PREISPROQM', objectClasses: segKauf.objectClasses, objectTypes: segKauf.objectTypes, years,
    });
    let rentSeries = [];
    if (cfg.geomap.historyRent) {
      rentSeries = await GeoMapConnector.timeSeries({
        lat: ref.lat, lon: ref.lon, offerType: 'Miete', analyzedField: 'PREISPROQM', objectClasses: segMiete.objectClasses, objectTypes: segMiete.objectTypes, years,
      });
    }
    /* 2) Markttempo: aktuelle Angebotsdauer (Tage online), Kauf.
       v1314 - MIT Zeitfenster. Ohne onlineDateRange aggregiert GeoMap ueber
       ALLE Angebote seit 2015; "wie lange steht hier etwas im Schaufenster"
       wird damit zur Antwort auf "wie lange stand hier je etwas". Dieselbe
       Fehlerklasse wie WSEG10-3, dort mit +36 Prozent gemessen. */
    const tempoVon = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const tempoBis = new Date().toISOString().slice(0, 10);
    const tempo = await GeoMapConnector.kpiCollection({
      lat: ref.lat, lon: ref.lon, offerType: 'Kauf', analyzedField: 'TAGEONLINE', objectClasses: segKauf.objectClasses, objectTypes: segKauf.objectTypes, period: { from: tempoVon, to: tempoBis },
    });
    const daysOnMarket = tempo && !tempo.error ? tempo.median : null;

    // ---- Einstufungen aus echten Werten ----
    const priceCagr = cagr(priceSeries);
    const validPts = priceSeries.filter((p) => p.median != null).length;
    const seriesUsable = validPts >= 3; // Zeitraum-Filter wirkt nur, wenn Werte variieren/vorhanden

    const assessment = {};
    const stufen = {};   /* v2518 · je Einstufung Wert, Stufe, Ton, Schwelle - EINE Skala (lib/lage_stufen.js) */
    const prov = [];
    const setze = (feld, skala, wert, einheit, basis) => {
      const e = einstufen(skala, wert);
      if (!e) return;
      assessment[feld] = e.wort;
      stufen[feld] = { ...e, wert, einheit, basis, schwelle: schwelleText(skala) };
    };

    // Mikrolage aus dem Umfeld-Score
    if (micro && micro.score != null) {
      setze('mikrolage', 'mikrolage', micro.score, 'Score', 'Umfeld-Score (Einkaufen, ÖPNV, Gesundheit, Freizeit, Bildung, Gastronomie, 2 km)');
      prov.push('mikrolage:umfeld');
    }
    // Nachfrage = Vermarktungsdauer der Angebote (Marcel 20.10.2026: ueberall so)
    if (daysOnMarket != null) {
      setze('nachfrage', 'nachfrage', daysOnMarket, 'Tage', 'Vermarktungsdauer der Angebote (Kauf, Median der letzten 12 Monate)');
      prov.push('nachfrage:vermarktungsdauer');
    }
    // Wertsteigerung + Entwicklung aus Preis-CAGR (nur wenn Reihe brauchbar)
    if (seriesUsable && priceCagr != null) {
      const pct = priceCagr * 100;
      setze('wertsteigerung', 'wertsteigerung', Math.round(pct * 10) / 10, '% p. a.', 'Entwicklung der Angebotspreise je Jahr');
      assessment.entwicklung = pct >= 2 ? 'steigend' : pct >= 0 ? 'stabil' : 'rückläufig';
      prov.push('wertsteigerung:geomap-historie');
    }
    // Mietentwicklung aus Miet-CAGR (nur wenn Miethistorie aktiv + brauchbar)
    const rentCagr = cagr(rentSeries);
    const rentValid = rentSeries.filter((p) => p.median != null).length >= 3;
    if (rentValid && rentCagr != null) {
      const rpct = rentCagr * 100;
      assessment.mietentwicklung = rpct >= 3 ? 'stark steigend' : rpct >= 1 ? 'steigend' : rpct >= 0 ? 'stabil' : 'rückläufig';
      prov.push('mietentwicklung:geomap-historie');
    }

    const result = {
      assessment: Object.keys(assessment).length ? assessment : null,
      stufen,
      provenance_detail: prov,
      series: {
        price: priceSeries,
        rent: rentSeries,
        rent_cagr_pct: rentCagr != null ? Math.round(rentCagr * 1000) / 10 : null,
        price_cagr_pct: priceCagr != null ? Math.round(priceCagr * 1000) / 10 : null,
        usable: seriesUsable,
        start_year: startYear, end_year: endYear,
      },
      dynamics: { days_on_market: daysOnMarket },
    };
    cacheSet(ck, result, INSIGHTS_CACHE_TTL_MS);
    return result;
  },
};
