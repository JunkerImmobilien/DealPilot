// MicroLocationService.js — POI-Analyse (Geoapify, Fallback Overpass) in 6 Gruppen
// nach Vorbild professioneller Lage-Reports: Einkaufen, Bildung, Gesundheit,
// Gastronomie, Freizeit, Verkehr. Liefert je Gruppe Top-Orte (Name+Distanz),
// naechste Distanz, Anzahl und einen Score 0..100 sowie einen Gesamt-Score.
import { GeoapifyConnector } from '../connectors/GeoapifyConnector.js';
import { OsmOverpassConnector } from '../connectors/OsmOverpassConnector.js';
import { haversineMeters, round } from '../lib/stats.js';
import { cacheGet, cacheSet } from '../lib/cache.js';

// POIs aendern sich kaum -> lang cachen (Default 7 Tage), spart 6 Geoapify-Calls/Bericht.
const MICRO_CACHE_TTL_MS = (parseInt(process.env.MICRO_CACHE_TTL_MIN, 10) || 10080) * 60 * 1000;

// 6 Gruppen: Geoapify-Kategorien (kommagetrennt = ein Call), Gewicht, ideale/max Distanz.
const GROUPS = {
  einkaufen:   { label: 'Einkaufen',   w: 0.22, ideal: 250,  max: 1600,
                 cats: 'commercial.supermarket,commercial.marketplace,commercial.convenience', osm: 'supermarket' },
  verkehr:     { label: 'Verkehr/ÖPNV', w: 0.20, ideal: 200,  max: 1200,
                 cats: 'public_transport.bus,public_transport.train,public_transport.subway,public_transport.tram', osm: 'transit' },
  gesundheit:  { label: 'Gesundheit', w: 0.16, ideal: 350,  max: 2200,
                 cats: 'healthcare.pharmacy,healthcare.hospital,healthcare.clinic_or_praxis', osm: 'pharmacy' },
  freizeit:    { label: 'Freizeit',   w: 0.16, ideal: 350,  max: 2200,
                 cats: 'leisure.park,sport.fitness,sport.sports_centre,entertainment', osm: 'park' },
  bildung:     { label: 'Bildung',    w: 0.14, ideal: 350,  max: 2000,
                 cats: 'education.school,education.college,education.university,childcare.kindergarten', osm: 'school' },
  gastronomie: { label: 'Gastronomie', w: 0.12, ideal: 250,  max: 1600,
                 cats: 'catering.restaurant,catering.cafe,catering.bar', osm: '' },
};

function scoreDistance(dist, ideal, max) {
  if (dist == null) return 0;
  if (dist <= ideal) return 1;
  if (dist >= max) return 0;
  return 1 - (dist - ideal) / (max - ideal);
}

export const MicroLocationService = {
  async analyze(lat, lon, radiusM = 2500) {
    const ck = `micro|${lat != null ? lat.toFixed(4) : '?'}|${lon != null ? lon.toFixed(4) : '?'}|${radiusM}`;
    const cached = cacheGet(ck);
    if (cached) return { ...cached, cached: true };

    const result = { groups: {}, categories: {}, score: 0, source: 'geoapify', notes: [] };
    let usedOsm = false;

    const entries = Object.entries(GROUPS);
    const perGroup = await Promise.all(entries.map(async ([key, g]) => {
      let pois = [];
      if (GeoapifyConnector.available()) {
        pois = await GeoapifyConnector.places(g.cats, lat, lon, radiusM, 20);
      }
      if (!pois.length) {
        const osm = await OsmOverpassConnector.places(g.osm, lat, lon, radiusM, 20);
        if (osm.length) { pois = osm; usedOsm = true; }
      }
      return { key, g, pois };
    }));

    let weightedSum = 0, weightTotal = 0;
    for (const { key, g, pois } of perGroup) {
      const withDist = pois
        .map((p) => ({ name: (p.name == null ? '' : String(p.name)) /* dpmb-name-str */, distance_m: round(haversineMeters(lat, lon, p.lat, p.lon), 0), lat: p.lat, lon: p.lon }))
        .filter((p) => p.name && p.name.trim() && p.distance_m != null)
        .sort((a, b) => a.distance_m - b.distance_m);
      // Duplikate (gleicher Name) entfernen
      const seen = new Set();
      const items = withDist.filter((p) => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

      const nearest = items[0] || null;
      // Differenzierter Score (kein 100er-Sattel mehr): Mittel der 3 naechsten Orte
      // (fehlende mit max aufgefuellt) bestimmt die Erreichbarkeit; Vielfalt (Anzahl
      // unterschiedlicher Orte) geht zu 30 % ein; Deckel 0.98 -> nie glatte 100.
      const top3 = [0, 1, 2].map((i) => (items[i] ? items[i].distance_m : g.max));
      const dMean = top3.reduce((a, b) => a + b, 0) / 3;
      const distScore = Math.max(0, Math.min(1, (g.max - dMean) / (g.max - g.ideal)));
      const variety = Math.min(1, items.length / 12);
      const groupScore = Math.min(0.98, 0.7 * distScore + 0.3 * variety * (distScore > 0 ? 1 : 0));

      weightedSum += groupScore * g.w; weightTotal += g.w;

      result.groups[key] = {
        label: g.label,
        score: round(groupScore * 100, 0),
        score5: round(groupScore * 5, 1),       // 0–5 Darstellung wie in AVM-Reports
        nearest_m: nearest ? nearest.distance_m : null,
        nearest_name: nearest ? nearest.name : null,
        count: items.length,
        items: items.slice(0, 5),                // Top-5 fuer Nahversorgungs-Liste
      };
      // Abwaertskompatibel: flache categories-Struktur fuer bestehende Consumer
      result.categories[key] = { count: items.length, nearest_m: nearest ? nearest.distance_m : null, subscore: round(groupScore * 100, 0) };
    }

    if (usedOsm) result.source = 'mixed';
    result.score = weightTotal ? round((weightedSum / weightTotal) * 100, 0) : 0;
    if (!GeoapifyConnector.available()) result.notes.push('Geoapify nicht konfiguriert – nur OSM-Daten oder leer.');
    if (result.score > 0) cacheSet(ck, result, MICRO_CACHE_TTL_MS);
    return result;
  },
};
