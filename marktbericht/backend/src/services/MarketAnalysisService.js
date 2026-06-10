// MarketAnalysisService.js — Vergleichsobjekt-Engine.
// Primaerquelle: GeoMap (echte Angebotsdaten) via guenstigem KPI-Aggregat-Weg.
// Fallback: mb.offers (Seed/importierte Daten) per PostGIS-Radius + IQR.
import { q } from '../lib/db.js';
import { median, quantile, iqrFilter, confidence, round, haversineMeters } from '../lib/stats.js';
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
import { cfg, geomapEnabled } from '../lib/config.js';
import { cacheGet, cacheSet } from '../lib/cache.js';

// Cache-Lebensdauer fuer Markt-Ergebnisse (Reproduzierbarkeit + Credit-Ersparnis).
// Konfigurierbar via MARKET_CACHE_TTL_MIN, Default 720 Min (12 h).
const MARKET_CACHE_TTL_MS = (parseInt(process.env.MARKET_CACHE_TTL_MIN, 10) || 720) * 60 * 1000;

// Radius-Eskalation, bis genug Vergleichsobjekte da sind.
const RADII = [500, 1000, 2000, 5000];
const MIN_SAMPLE = 8;

// DealPilot/interne Objektart -> GeoMap-Objektklasse
function geomapClasses(pt) {
  if (!pt) return ['Wohnung', 'Haus'];
  const p = String(pt).toLowerCase();
  if (p.includes('wohn') || p === 'etw') return ['Wohnung'];
  if (p.includes('haus') || ['efh', 'mfh', 'dhh', 'rh', 'zfh'].includes(p)) return ['Haus'];
  return ['Wohnung', 'Haus'];
}
// Konfidenz aus reiner Treffermenge (KPI liefert kein Werte-Array)
function countConfidence(n) {
  if (!n) return 0;
  if (n >= 50) return 0.9;
  if (n >= 25) return 0.8;
  if (n >= 12) return 0.7;
  if (n >= 6) return 0.55;
  return 0.4;
}

export const MarketAnalysisService = {
  // Einheitlicher Einstieg: GeoMap-KPI bevorzugt, sonst Seed/DB.
  // listingType: 'kauf' | 'miete'. opts.listings = Anzahl Einzelobjekte (kostet je 1 Abruf).
  async marketLevel(ref, listingType, opts = {}) {
    // v558: Demo-Modus -> GeoMap ueberspringen, Seed-Daten nutzen (kostenlos testen).
    if (process.env.MB_DEMO === '1') {
      const sd = await this.comparables(ref, listingType);
      sd.source = 'seed_demo';
      return sd;
    }
    if (geomapEnabled()) {
      const gm = await this._geomapLevel(ref, listingType, opts);
      if (gm) return gm;
      // GeoMap aktiv, aber kein Ergebnis -> EHRLICH keine Daten (kein Seed/Fake).
      return { listing_type: listingType, source: 'keine_daten', sample_size: 0,
               median_per_sqm: null, q25_per_sqm: null, q75_per_sqm: null,
               min_per_sqm: null, max_per_sqm: null, confidence: 0, comparables: [],
               note: 'Keine Marktdaten von GeoMap für diesen Standort/Objekttyp.' };
    }
    // Kein GeoMap-Token konfiguriert -> Demo-/Seed-Daten nur als ausgewiesener Demo-Modus.
    const s = await this.comparables(ref, listingType);
    s.source = 'seed_demo';
    return s;
  },

  // GeoMap-KPI-Weg (guenstig): eine Aggregat-Anfrage fuer Preis/m²,
  // optional einige Einzelobjekte fuer Karte/Tabelle.
  async _geomapLevel(ref, listingType, opts) {
    const offerType = listingType === 'miete' ? 'Miete' : 'Kauf';
    const objectClasses = geomapClasses(ref.property_type);
    const wfl = ref.living_area && ref.living_area > 0 ? ref.living_area : null;
    const by = ref.build_year && ref.build_year > 1500 ? ref.build_year : null;
    // Hoehere Schwelle = stabilerer Median der engen Gruppe und seltenere Umschaltung
    // breit<->eng (GeoMaps Trefferzahl schwankt leicht). Dampft die grossen Wertspruenge.
    const MIN_SAMPLE = 20;
    // Mehrfach-Abfrage + Median glaettet GeoMaps nicht-deterministischen Algorithmus.
    // Konfigurierbar via GEOMAP_SAMPLES (Default 1). GeoMap-Aggregate sind bei identischer
    // Abfrage deterministisch -> Mehrfachabrufe bringen i.d.R. denselben Wert (= Kosten ohne Nutzen).
    // Nur hochsetzen, falls die API fuer dieselbe Abfrage messbar schwankt.
    const SAMPLES = Math.max(1, Math.min(5, parseInt(process.env.GEOMAP_SAMPLES, 10) || 1));
    const want = opts.listings != null ? opts.listings : (listingType === 'kauf' ? cfg.geomap.reportListings : 0);

    // Cache: gleiche Objekt-Signatur -> reproduzierbares Ergebnis (kein neuer GeoMap-Call).
    const ck = [
      'gm', listingType, ref.lat != null ? ref.lat.toFixed(4) : '?', ref.lon != null ? ref.lon.toFixed(4) : '?',
      ref.property_type || '?', wfl ? Math.round(wfl / 5) * 5 : '?', by || '?', want,
    ].join('|');
    const cached = cacheGet(ck);
    if (cached) return { ...cached, cached: true };

    // n Abfragen einer Stufe, dann Median je Kennzahl (robust gegen Rauschen).
    const med = (arr) => { const s = arr.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const sampleStage = async (st) => {
      const rs = [];
      for (let i = 0; i < SAMPLES; i++) {
        const k = await GeoMapConnector.kpiCollection({
          lat: ref.lat, lon: ref.lon, radiusKm: st.radiusKm,
          offerType, analyzedField: 'PREISPROQM', objectClasses, filters: st.filters,
        });
        if (k && !k.error && k.median != null) rs.push(k);
      }
      if (!rs.length) return null;
      return {
        median: med(rs.map((r) => r.median)), q25: med(rs.map((r) => r.q25)), q75: med(rs.map((r) => r.q75)),
        min: med(rs.map((r) => r.min)), max: med(rs.map((r) => r.max)),
        count: Math.round(rs.reduce((a, r) => a + (r.count || 0), 0) / rs.length),
      };
    };

    // Praezisierungs-Kaskade: erst enge Vergleichsgruppe (aehnliche Flaeche/Baujahr, kleiner
    // Radius); bei zu wenig Treffern Fallback auf breit. Jede Stufe wird gesampelt/geglaettet.
    const stages = [
      { radiusKm: Math.min(3.5, cfg.geomap.radiusKm), label: 'eng',
        filters: {
          spaceFrom: wfl ? Math.round(wfl * 0.55) : null, spaceTo: wfl ? Math.round(wfl * 1.45) : null,
          yearFrom: by ? by - 25 : null, yearTo: by ? by + 25 : null,
        } },
      { radiusKm: cfg.geomap.radiusKm, label: 'breit', filters: null },
    ];
    let kpi = null, used = null;
    for (const st of stages) {
      const k = await sampleStage(st);
      if (k && k.median != null) {
        kpi = k; used = st;
        if (k.count >= MIN_SAMPLE) break;
      }
    }
    if (!kpi || kpi.median == null) return null;

    // Einzelobjekte nur wenn gewuenscht (Kostenbremse) und nur fuer Kauf sinnvoll.
    let comparables = [];
    if (want > 0) {
      const mo = await GeoMapConnector.marketOffers({
        lat: ref.lat, lon: ref.lon, radiusKm: used.radiusKm, offerType, maxDetails: want,
      });
      comparables = (mo.offers || []).map((o) => ({
        property_type: o.property_type, living_area: o.living_area, build_year: o.build_year,
        condition: o.condition, price: o.price, price_per_sqm: o.price_per_sqm,
        offer_date: o.offer_date, lat: o.lat, lon: o.lon, city: o.city, postcode: o.postcode,
        distance_m: round(haversineMeters(ref.lat, ref.lon, o.lat, o.lon), 0),
      }));
    }

    const out = {
      listing_type: listingType,
      source: 'geomap',
      used_radius_m: used.radiusKm * 1000,
      comparable_group: used.label, // 'eng' = aehnliche Objekte, 'breit' = Fallback
      sample_size: kpi.count,
      median_per_sqm: round(kpi.median, 2),
      q25_per_sqm: kpi.q25 != null ? round(kpi.q25, 2) : null,
      q75_per_sqm: kpi.q75 != null ? round(kpi.q75, 2) : null,
      min_per_sqm: kpi.min != null ? round(kpi.min, 2) : null,
      max_per_sqm: kpi.max != null ? round(kpi.max, 2) : null,
      confidence: countConfidence(kpi.count),
      comparables,
      geomap_listings_fetched: comparables.length,
    };
    cacheSet(ck, out, MARKET_CACHE_TTL_MS);
    return out;
  },

  // ref: {lat,lon,property_type,living_area,build_year}
  async comparables(ref, listingType) {
    const monthsBack = 12;
    let chosen = null;

    for (const radius of RADII) {
      const rows = await q(
        `SELECT id, listing_type, property_type, living_area, build_year, condition,
                energy_class, price, price_per_sqm, offer_date, lat, lon,
                ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography) AS dist_m
         FROM mb.offers
         WHERE listing_type = $3
           AND ($4::text IS NULL OR property_type = $4)
           AND offer_date >= (CURRENT_DATE - ($5 || ' months')::interval)
           AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography, $6)
           AND ($7::float8 IS NULL OR (living_area BETWEEN $7*0.75 AND $7*1.25))
           AND ($8::int IS NULL OR (build_year BETWEEN $8-20 AND $8+20))
         ORDER BY dist_m ASC
         LIMIT 200`,
        [ref.lat, ref.lon, listingType, ref.property_type || null, monthsBack,
         radius, ref.living_area || null, ref.build_year || null]
      );

      if (rows.length >= MIN_SAMPLE || radius === RADII[RADII.length - 1]) {
        chosen = { radius, rows };
        if (rows.length >= MIN_SAMPLE) break;
      }
    }

    const rows = chosen ? chosen.rows : [];
    const usedRadius = chosen ? chosen.radius : RADII[RADII.length - 1];

    // Ausreißer per IQR auf €/m²
    const { kept, removed } = iqrFilter(rows, (r) => Number(r.price_per_sqm));
    const ppsm = kept.map((r) => Number(r.price_per_sqm)).filter((x) => !isNaN(x));

    const stats = {
      listing_type: listingType,
      used_radius_m: usedRadius,
      sample_size: kept.length,
      outliers_removed: removed.length,
      median_per_sqm: round(median(ppsm), 2),
      q25_per_sqm: round(quantile(ppsm, 0.25), 2),
      q75_per_sqm: round(quantile(ppsm, 0.75), 2),
      min_per_sqm: ppsm.length ? round(Math.min(...ppsm), 2) : null,
      max_per_sqm: ppsm.length ? round(Math.max(...ppsm), 2) : null,
      confidence: confidence(kept.length, ppsm),
      comparables: kept.slice(0, 12).map((r) => ({
        property_type: r.property_type,
        living_area: round(Number(r.living_area), 0),
        build_year: r.build_year,
        condition: r.condition,
        price: round(Number(r.price), 0),
        price_per_sqm: round(Number(r.price_per_sqm), 2),
        distance_m: round(Number(r.dist_m), 0),
        offer_date: r.offer_date,
        lat: Number(r.lat),
        lon: Number(r.lon),
      })),
    };
    return stats;
  },

  // Mietspiegel-Indikation: Median €/m² Miete (GeoMap-KPI, sonst Seed)
  async rentLevel(ref) {
    return this.marketLevel(ref, 'miete');
  },
  async saleLevel(ref) {
    return this.marketLevel(ref, 'kauf');
  },
};
