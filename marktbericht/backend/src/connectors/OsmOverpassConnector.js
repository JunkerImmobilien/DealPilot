// OsmOverpassConnector.js
// Zweck: POI-Gegenprobe / Fallback zu Geoapify (keyless).
// Auth: keine. Frequenz: on-demand, aber stark rate-limited -> sparsam nutzen.
// Format: Overpass JSON. Fehler: leeres Array. Rate-Limit: Retry via httpJson.
import { cfg } from '../lib/config.js';
import { haversineMeters } from '../lib/stats.js';

/* v2514 · DER RUECKFALL SAH NUR DIE HAELFTE
   Gemessen am 20.10.2026 (Bestandsaufnahme):
   - nur `node` - ein Supermarkt, eine Schule, ein Park sind in OSM fast
     immer eine FLAECHE (way/relation) und fielen damit ganz heraus;
   - Gastronomie hatte gar keinen Filter (`osm: ''`) -> immer leer;
   - je Gruppe nur EINE Kategorie (Gesundheit = nur Apotheke, Verkehr = nur
     Bushaltestelle, Bildung = nur Schule), waehrend Geoapify mehrere fragt;
   - ein Ort ohne Namen hiess wie seine Kategorie („supermarket") - beim
     Entdoppeln nach Namen fielen alle Namenlosen auf EINEN zusammen.
   Jetzt: `nwr` mit `out center` (Flaechen liefern ihren Mittelpunkt), je
   Gruppe die Tags, die Geoapify auch fragt, und ein Ort ohne Namen traegt
   einen leeren Namen plus `typ` - der Aufrufer entscheidet, wie er ihn zeigt.
   Die alten Schluessel (supermarket, school, ...) bleiben gueltig. */
const OSM_FILTER = {
  einkaufen: ['["shop"~"^(supermarket|convenience)$"]', '["amenity"="marketplace"]'],
  verkehr: ['["highway"="bus_stop"]', '["railway"~"^(station|halt|tram_stop)$"]'],
  gesundheit: ['["amenity"~"^(pharmacy|doctors|hospital|clinic)$"]'],
  freizeit: ['["leisure"~"^(park|fitness_centre|sports_centre)$"]'],
  bildung: ['["amenity"~"^(school|kindergarten|college|university)$"]'],
  gastronomie: ['["amenity"~"^(restaurant|cafe|fast_food)$"]'],
  supermarket: ['["shop"="supermarket"]'],
  school: ['["amenity"="school"]'],
  kita: ['["amenity"="kindergarten"]'],
  doctor: ['["amenity"="doctors"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  park: ['["leisure"="park"]'],
  transit: ['["highway"="bus_stop"]'],
  station: ['["railway"="station"]'],
};

/* Anzeigename eines namenlosen Orts, deutsch */
const TYP_WORT = {
  supermarket: 'Supermarkt', convenience: 'Lebensmittelgeschäft', marketplace: 'Wochenmarkt',
  bus_stop: 'Bushaltestelle', station: 'Bahnhof', halt: 'Haltepunkt', tram_stop: 'Straßenbahnhaltestelle',
  pharmacy: 'Apotheke', doctors: 'Arztpraxis', hospital: 'Krankenhaus', clinic: 'Klinik',
  park: 'Park', fitness_centre: 'Fitnessstudio', sports_centre: 'Sportanlage',
  school: 'Schule', kindergarten: 'Kita', college: 'Fachschule', university: 'Hochschule',
  restaurant: 'Restaurant', cafe: 'Café', fast_food: 'Imbiss',
};

function typVon(tags) {
  const t = tags || {};
  const roh = t.shop || t.amenity || t.leisure || t.railway || t.highway || '';
  return TYP_WORT[roh] || '';
}

export const OsmOverpassConnector = {
  code: 'overpass',
  available() { return true; },

  async places(category, lat, lon, radiusM = 1500, limit = 20) {
    const filt = OSM_FILTER[category];
    if (!filt || !filt.length) return [];
    const teile = filt.map((f) => 'nwr' + f + '(around:' + radiusM + ',' + lat + ',' + lon + ');').join('');
    /* mehr holen als gebraucht: Overpass liefert nicht nach Entfernung,
       sortiert wird hier, gekappt danach */
    const ql = '[out:json][timeout:15];(' + teile + ');out center ' + (limit * 4) + ';';
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
        .map((e) => {
          const la = typeof e.lat === 'number' ? e.lat : (e.center && e.center.lat);
          const lo = typeof e.lon === 'number' ? e.lon : (e.center && e.center.lon);
          return { name: (e.tags && e.tags.name) || '', typ: typVon(e.tags), lat: la, lon: lo, quelle: 'overpass' };
        })
        .filter((x) => typeof x.lat === 'number' && typeof x.lon === 'number')
        .sort((a, b) => haversineMeters(lat, lon, a.lat, a.lon) - haversineMeters(lat, lon, b.lat, b.lon))
        .slice(0, limit);
    } catch {
      clearTimeout(t);
      return [];
    }
  },
};
