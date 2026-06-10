// GeoMapConnector.js — echte GeoMap-Anbindung (api.geomap.immo).
//
// Zweistufiges Modell:
//   1) POST /listing/v1/propertyOffers  -> Offer-IDs (eine Anfrage)
//   2) GET  /listing/v1/getDetailsById/{id} -> Details je Offer (zieht Guthaben!)
// Auth: Bearer-Token. maxDetails begrenzt die Detail-Abrufe = Kostenbremse.
//
// Guthaben-Check: GET /account/v1/getBalance -> { amountEuroNetto }.
import { cfg, geomapEnabled } from '../lib/config.js';
import { httpJson } from '../lib/http.js';

function authHeaders() {
  return { Authorization: `Bearer ${cfg.geomap.token}` };
}

// GeoMap objectClass/objectType -> unser property_type
function mapPropertyType(objectClass, objectType) {
  const c = String(objectClass || '').toLowerCase();
  const t = String(objectType || '').toLowerCase();
  if (c === 'wohnung') return 'wohnung';
  if (c === 'haus') {
    if (/mehrfamilien/.test(t)) return 'mfh';
    return 'haus';
  }
  if (/mehrfamilien/.test(t)) return 'mfh';
  if (/gewerbe|büro|buero|einzelhandel|halle|gastronomie/.test(c)) return 'gewerbe';
  return null;
}

export const GeoMapConnector = {
  code: 'geomap',
  available() {
    return geomapEnabled();
  },

  // Guthaben in EUR netto, oder null wenn nicht verfügbar
  async getBalance() {
    if (!geomapEnabled()) return null;
    try {
      const d = await httpJson(`${cfg.geomap.base}/account/v1/getBalance`, {
        method: 'GET',
        headers: authHeaders(),
        timeoutMs: 12000,
        retries: 1,
      });
      return d && typeof d.amountEuroNetto === 'number' ? d.amountEuroNetto : null;
    } catch {
      return null;
    }
  },

  // GUENSTIGER WEG: Aggregat-Statistik in EINER Anfrage (statt vieler Detail-Abrufe).
  // analyzedField: 'PREISPROQM' | 'PREIS' | 'RENDITE' | 'NUTZFLAECHE' | 'TAGEONLINE'
  // offerType: 'Kauf' | 'Miete'. period: optional {from:'YYYY-MM-DD', to:'YYYY-MM-DD'}.
  // Liefert {count,median,average,min,max,q25,q75} o. null.
  async kpiCollection({ lat, lon, radiusKm, offerType, analyzedField, objectClasses, period, filters }) {
    if (!geomapEnabled()) return null;
    const body = {
      coordinate: { lat, lon },
      radiusInKm: radiusKm || cfg.geomap.radiusKm,
      objectCategories: ['Wohnen'],
      objectClasses: objectClasses && objectClasses.length ? objectClasses : ['Wohnung', 'Haus'],
      offerTypes: [offerType],
      analyzedField: analyzedField || 'PREISPROQM',
      cutOutlier: 'GEOMAP', // GeoMaps eigene Ausreißerbereinigung
    };
    // Zeitraum-Filter (fuer historische Auswertung). Laut GeoMap-Doku (kpi v1.5):
    // onlineDateRange = Objekt { from, to } im Format YYYY-MM-DD (Angebote online verfuegbar).
    if (period && period.from && period.to) {
      body.onlineDateRange = { from: period.from, to: period.to };
    }
    // Praezisierungs-Filter fuer eine engere Vergleichsgruppe (alle laut GeoMap-Doku):
    // propertySpaceRange / usableSpaceRange {from,to}, numberOfRoomsRange {from,to},
    // constructionYearRange {from,to}.
    if (filters) {
      if (filters.spaceFrom != null || filters.spaceTo != null)
        body.propertySpaceRange = { ...(filters.spaceFrom != null ? { from: filters.spaceFrom } : {}), ...(filters.spaceTo != null ? { to: filters.spaceTo } : {}) };
      if (filters.roomsFrom != null || filters.roomsTo != null)
        body.numberOfRoomsRange = { ...(filters.roomsFrom != null ? { from: filters.roomsFrom } : {}), ...(filters.roomsTo != null ? { to: filters.roomsTo } : {}) };
      if (filters.yearFrom != null || filters.yearTo != null)
        body.constructionYearRange = { ...(filters.yearFrom != null ? { from: filters.yearFrom } : {}), ...(filters.yearTo != null ? { to: filters.yearTo } : {}) };
    }
    let d;
    try {
      d = await httpJson(`${cfg.geomap.base}/kpi/v1/collection`, {
        method: 'POST', headers: authHeaders(), body, timeoutMs: 15000, retries: 1,
      });
    } catch (e) {
      return { error: e.message };
    }
    if (!d || typeof d !== 'object') return null;
    const n = (v) => (typeof v === 'number' ? v : (v != null && !isNaN(parseFloat(v)) ? parseFloat(v) : null));
    return {
      count: n(d.count),
      median: n(d.median),
      average: n(d.average),
      min: n(d.minimum),
      max: n(d.maximum),
      q25: n(d.percentile25),
      q75: n(d.percentile75),
      analyzedField: body.analyzedField,
      offerType,
    };
  },

  // HISTORIE: KPI je Jahr -> Zeitreihe. field z.B. 'PREISPROQM' (Wert) oder 'TAGEONLINE' (Markttempo).
  // Liefert [{year, median, count}] fuer die angefragten Jahre.
  async timeSeries({ lat, lon, radiusKm, offerType, analyzedField, objectClasses, years }) {
    if (!geomapEnabled()) return [];
    // Jahre parallel abrufen (war sequenziell -> bei 9 Jahren x2 Reihen der grösste Zeitfresser).
    const out = await Promise.all(years.map(async (y) => {
      const kpi = await this.kpiCollection({
        lat, lon, radiusKm, offerType, analyzedField, objectClasses,
        period: { from: `${y}-01-01`, to: `${y}-12-31` },
      });
      return { year: y, median: kpi && !kpi.error ? kpi.median : null, count: kpi && !kpi.error ? kpi.count : null };
    }));
    return out.sort((a, b) => a.year - b.year);
  },

  // Holt echte Vergleichsangebote um einen Punkt.
  // params: { lat, lon, radiusKm, offerType:'Kauf'|'Miete', maxDetails }
  // Gibt { offers:[...], totalResults, fetchedDetails } zurück.
  async marketOffers({ lat, lon, radiusKm, offerType, maxDetails }) {
    if (!geomapEnabled()) return { offers: [], totalResults: 0, fetchedDetails: 0, reason: 'no_token' };

    const radius = radiusKm || cfg.geomap.radiusKm;
    const cap = maxDetails || cfg.geomap.maxDetails;

    // 1) IDs holen
    const body = {
      coordinate: { lat, lon },
      radiusInKm: radius,
      objectCategories: ['Wohnen'],
      objectClasses: ['Wohnung', 'Haus'],
      offerTypes: [offerType], // 'Kauf' | 'Miete'
      size: Math.min(1000, Math.max(cap, 50)),
      sortField: 'DATUM',
      sortOrder: 'AB', // neueste zuerst
    };

    let idResp;
    try {
      idResp = await httpJson(`${cfg.geomap.base}/listing/v1/propertyOffers`, {
        method: 'POST',
        headers: authHeaders(),
        body,
        timeoutMs: 20000,
        retries: 1,
      });
    } catch (e) {
      return { offers: [], totalResults: 0, fetchedDetails: 0, reason: 'offers_failed:' + e.message };
    }

    const ids = (idResp && idResp.offerIds) || [];
    const totalResults = (idResp && idResp.totalResults) || ids.length;
    const take = ids.slice(0, cap);

    // 2) Details holen (begrenzt). Parallel in kleinen Bündeln, um Rate-Limits zu schonen.
    const offers = [];
    const BATCH = 5;
    for (let i = 0; i < take.length; i += BATCH) {
      const batch = take.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((id) => this._detail(id, offerType).catch(() => null))
      );
      for (const o of results) if (o) offers.push(o);
    }

    return { offers, totalResults, fetchedDetails: offers.length };
  },

  // Einzelnes Detail abrufen und auf unser offer-Format mappen
  async _detail(offerId, offerType) {
    const d = await httpJson(
      `${cfg.geomap.base}/listing/v1/getDetailsById/${encodeURIComponent(offerId)}`,
      { method: 'GET', headers: authHeaders(), timeoutMs: 15000, retries: 1 }
    );
    if (!d) return null;

    const addr = d.address || {};
    const loc = addr.location || {};
    const lat = loc.lat;
    const lon = loc.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;

    const price = num(d.price);
    const space = num(d.usableSpace);
    let ppsm = num(d.pricePerSqm);
    if (ppsm == null && price != null && space) ppsm = price / space;
    if (price == null || ppsm == null) return null;

    const lt = (d.offerType || offerType) === 'Miete' ? 'miete' : 'kauf';
    const offerDate = (d.firstSeenDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);

    return {
      listing_type: lt,
      property_type: mapPropertyType(d.objectClass, d.objectType),
      postcode: addr.postcode || null,
      city: addr.city || null,
      lat, lon,
      living_area: space,
      rooms: num(d?.features?.numbers?.rooms),
      build_year: num(d?.years?.construction),
      condition: null,
      energy_class: null,
      price: Math.round(price),
      price_per_sqm: Math.round(ppsm * 100) / 100,
      offer_date: offerDate,
    };
  },
};

function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}
