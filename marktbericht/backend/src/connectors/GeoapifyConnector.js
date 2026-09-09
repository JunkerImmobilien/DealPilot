// GeoapifyConnector.js
// Zweck: Adresse -> Koordinaten (Geocoding) + POI rund um einen Punkt (Places).
// Auth: API-Key als Query-Param ?apiKey=. Frequenz: on-demand pro Bericht.
// Format: GeoJSON FeatureCollection. Fehler: ohne Key -> leeres Resultat (kein Crash).
// Rate-Limit: httpJson kümmert sich um 429/Retry.
import { cfg, geoEnabled } from '../lib/config.js';
import { httpJson } from '../lib/http.js';

// Geoapify-Place-Kategorien -> unsere Mikrolage-Kategorien
const CATEGORY_MAP = {
  supermarket: 'commercial.supermarket',
  school: 'education.school',
  kita: 'education.kindergarten',
  doctor: 'healthcare.clinic_or_praxis,healthcare.hospital',
  pharmacy: 'healthcare.pharmacy',
  park: 'leisure.park',
  transit: 'public_transport.bus',
  station: 'public_transport.train',
};

export const GeoapifyConnector = {
  code: 'geoapify',

  available() {
    return geoEnabled();
  },

  // Static-Map-Bild (OSM, frei speicher-/einbettbar laut Geoapify-Lizenz). Marker im DealPilot-Gold.
  // Gibt die fertige Geoapify-URL inkl. Key zurueck (NUR serverseitig nutzen, nicht ans Frontend geben).
  staticMapUrl({ lat, lon, width = 880, height = 420, zoom = 16, style = 'osm-bright', marker = true } = {}) {
    if (!geoEnabled() || lat == null || lon == null) return null;
    // Auf dem Deckblatt zeichnen wir den Pin selbst (Radar-Glow) -> marker:false => kein Geoapify-Pin.
    const m = marker
      ? `&marker=lonlat:${lon},${lat};type:material;color:%23c9a84c;size:large;icon:home`
      : '';
    return `https://maps.geoapify.com/v1/staticmap?style=${style}` +
      `&width=${width}&height=${height}&center=lonlat:${lon},${lat}&zoom=${zoom}` +
      m + `&apiKey=${cfg.geoapify.key}`;
  },

  // Forward-Geocoding. Gibt {lat,lon,confidence,formatted,components} | null
  async geocode(address) {
    if (!geoEnabled()) return null;
    const url =
      `${cfg.geoapify.base}/v1/geocode/search` +
      `?text=${encodeURIComponent(address)}&filter=countrycode:de&limit=1&lang=de&apiKey=${cfg.geoapify.key}`;
    const data = await httpJson(url, { timeoutMs: 12000 });
    const f = data && data.features && data.features[0];
    if (!f) return null;
    const p = f.properties || {};
    return {
      lat: p.lat,
      lon: p.lon,
      confidence: (p.rank && p.rank.confidence) || null,
      formatted: p.formatted,
      components: {
        street: p.street,
        house_number: p.housenumber,
        postcode: p.postcode,
        city: p.city || p.town || p.village,
        district: p.district || p.suburb,
        state: p.state,
        country: p.country,
      },
    };
  },

  /* v1270 · Autocomplete kann jetzt nach Art filtern.
     Ohne Filter mischt Geoapify Orte, Ortsteile und Strassen: die Eingabe
     "32120 Hiddenhausen Ha" lieferte gemessen DREI Ortszeilen und keine
     einzige Strasse. Mit type=street kommen Strassen, mit type=postcode der
     Ort zur Postleitzahl. Beides braucht das Objekt-Tab der Haupt-App.
     Ohne Argumente verhaelt sich die Funktion wie bisher. */
  async autocomplete(text, opts) {
    if (!geoEnabled() || !text) return [];
    opts = opts || {};
    const ERLAUBT = ['street', 'postcode', 'city', 'amenity', 'locality'];
    const type = ERLAUBT.indexOf(String(opts.type || '')) >= 0 ? String(opts.type) : null;
    let limit = parseInt(opts.limit, 10);
    if (!Number.isFinite(limit) || limit < 1 || limit > 12) limit = 6;
    /* v1270b · Ortsbezug ueber KOORDINATEN, nicht ueber den Ortsnamen.
       Gemessen: "32120 Hiddenhausen Löh" lieferte die Hiddenhauser Strasse
       in ENGER und eine Hiddenhausener Strasse in Loitz (Vorpommern) - der
       Ortsname im Suchtext wiegt bei Geoapify schwerer als das Praefix der
       Strasse. Mit einem Kreis um die Postleitzahl faellt der Ortsname aus
       dem Text weg und die Treffer liegen dort, wo das Objekt steht.
       Der Kreis ersetzt den Landesfilter; er liegt ohnehin in Deutschland. */
    const lat = parseFloat(opts.lat), lon = parseFloat(opts.lon);
    let radius = parseInt(opts.radius, 10);
    if (!Number.isFinite(radius) || radius < 500 || radius > 50000) radius = 12000;
    const mitKreis = Number.isFinite(lat) && Number.isFinite(lon);
    if (String(text).trim().length < (mitKreis ? 2 : 3)) return [];
    const url =
      `${cfg.geoapify.base}/v1/geocode/autocomplete` +
      `?text=${encodeURIComponent(text)}` +
      (mitKreis ? `&filter=circle:${lon},${lat},${radius}&bias=proximity:${lon},${lat}`
                : `&filter=countrycode:de`) +
      `&limit=${limit}&lang=de` +
      (type ? `&type=${type}` : '') +
      `&apiKey=${cfg.geoapify.key}`;
    const data = await httpJson(url, { timeoutMs: 8000 });
    const feats = (data && data.features) || [];
    return feats
      .map((f) => {
        const p = f.properties || {};
        return { formatted: p.formatted, lat: p.lat, lon: p.lon, postcode: p.postcode || null,
                 city: p.city || p.town || p.village || null, street: p.street || null };
      })
      .filter((x) => x.formatted);
  },

  // Places: POI einer Kategorie im Radius. Gibt Array {name,lat,lon}
  async places(category, lat, lon, radiusM = 1500, limit = 20) {
    if (!geoEnabled()) return [];
    const cats = CATEGORY_MAP[category] || category;
    const url =
      `${cfg.geoapify.base}/v2/places` +
      `?categories=${encodeURIComponent(cats)}` +
      `&filter=circle:${lon},${lat},${radiusM}` +
      `&bias=proximity:${lon},${lat}` +
      `&limit=${limit}&lang=de&apiKey=${cfg.geoapify.key}`;
    let data;
    try {
      data = await httpJson(url, { timeoutMs: 12000 });
    } catch (e) {
      return [];
    }
    const feats = (data && data.features) || [];
    return feats
      .map((f) => {
        const p = f.properties || {};
        return { name: p.name || p.formatted || category, lat: p.lat, lon: p.lon };
      })
      .filter((x) => typeof x.lat === 'number' && typeof x.lon === 'number');
  },
};
