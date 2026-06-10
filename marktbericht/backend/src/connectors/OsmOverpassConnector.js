// OsmOverpassConnector.js
// Zweck: POI-Gegenprobe / Fallback zu Geoapify (keyless).
// Auth: keine. Frequenz: on-demand, aber stark rate-limited -> sparsam nutzen.
// Format: Overpass JSON. Fehler: leeres Array. Rate-Limit: Retry via httpJson.
import { cfg } from '../lib/config.js';

// Mikrolage-Kategorie -> Overpass-Tag-Filter
const OSM_FILTER = {
  supermarket: 'node["shop"="supermarket"]',
  school: 'node["amenity"="school"]',
  kita: 'node["amenity"="kindergarten"]',
  doctor: 'node["amenity"="doctors"]',
  pharmacy: 'node["amenity"="pharmacy"]',
  park: 'node["leisure"="park"]',
  transit: 'node["highway"="bus_stop"]',
  station: 'node["railway"="station"]',
};

export const OsmOverpassConnector = {
  code: 'overpass',
  available() { return true; },

  async places(category, lat, lon, radiusM = 1500, limit = 20) {
    const filt = OSM_FILTER[category];
    if (!filt) return [];
    const ql = `[out:json][timeout:15];(${filt}(around:${radiusM},${lat},${lon}););out body ${limit};`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000); // hartes 10s-Limit, nie unbegrenzt
    try {
      const res = await fetch(cfg.overpass.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) return [];
      const data = await res.json();
      const els = (data && data.elements) || [];
      return els
        .map((e) => ({ name: (e.tags && e.tags.name) || category, lat: e.lat, lon: e.lon }))
        .filter((x) => typeof x.lat === 'number' && typeof x.lon === 'number')
        .slice(0, limit);
    } catch {
      clearTimeout(t);
      return [];
    }
  },
};
