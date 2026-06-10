// boris/registry.js
// Multi-Land-BORIS-Registry. Jedes Bundesland hat eigene Dienste/Formate/Lizenzen,
// daher EIN generischer WMS-GetFeatureInfo-Resolver + Config pro Land.
//
// Wichtige Unterschiede, die die Config kapselt:
//   - NRW liefert application/geo+json (einfaches JSON), CRS:84 (lon,lat).
//   - Brandenburg liefert nur GML 3.2.1 / HTML, EPSG:4326 in WMS 1.3.0 => Achsen lat,lon,
//     und der Bodenrichtwert-Layer ist JAHRESABHAENGIG (bbv_pg_zobau_JJJJ).
//
// Lizenz ist pro Land geprueft: nur kommerziell freie Open-Data-Laender werden
// automatisch abgefragt. Alles andere (BW: Vermarktung untersagt, Bayern: gebuehren-
// pflichtig, restliche Laender noch nicht verifiziert) faellt auf den manuell in
// DealPilot eingegebenen Bodenrichtwert (Feld "brw") zurueck.
import { httpText } from '../../lib/http.js';

const CURRENT_BRW_YEAR = 2026;

// ---- Hilfen --------------------------------------------------------------
function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v
    : parseFloat(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}
function inBox(lat, lon, b) {
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}
// geo+json: erstes Feature, tolerantes Feld-Mapping
function parseGeoJson(text) {
  let data; try { data = JSON.parse(text); } catch { return null; }
  const f = data && data.features && data.features[0];
  if (!f || !f.properties) return null;
  return f.properties;
}
// GML/XML: Werte aus <ns:feld>wert</ns:feld> ziehen (tolerant, namespace-agnostisch)
function parseGmlField(text, names) {
  for (const nm of names) {
    const re = new RegExp('<(?:[A-Za-z0-9_]+:)?' + nm + '\\b[^>]*>([^<]+)<', 'i');
    const m = text.match(re);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return null;
}
// tolerantes Feld aus geo+json-Properties (case-insensitiv)
function propCI(props, names) {
  const low = {};
  for (const k of Object.keys(props || {})) low[k.toLowerCase()] = props[k];
  for (const n of names) { const v = low[n.toLowerCase()]; if (v != null && String(v).trim() !== '') return v; }
  return null;
}

// Feldnamen-Kandidaten (VBORIS / BRM-Modell variiert pro Land)
const F = {
  value: ['brw', 'bodenrichtwert', 'wert', 'brw_eur', 'brwert', 'bodenwert', 'richtwert', 'bri'],
  stichtag: ['stag', 'stichtag', 'jahr', 'stichtag des bodenrichtwertes', 'jahr des bodenrichtwerts'],
  nutzung: ['nuta', 'nutzung', 'entw', 'nutzungsart', 'entwicklungszustand'],
  zone: ['brwznr', 'wnum', 'zone', 'bodenrichtwertzonen id', 'bodenrichtwertnummer', 'gemarkungsname', 'gemarkung'],
};

// ---- Laender-Konfiguration ----------------------------------------------
// VERIFIZIERT (Capabilities gefetcht): nrw, bb
// VORBEREITET (Endpunkt bekannt, GetFeatureInfo-Felder beim 1. echten Call zu pruefen): be, he
const ADAPTERS = [
  {
    code: 'nrw', name: 'BORIS-NRW', license: 'dl-de/zero-2-0', enabled: true, verified: true,
    base: 'https://www.wms.nrw.de/boris/wms-t_nw_brw',
    bbox: { minLon: 5.70, maxLon: 9.52, minLat: 50.25, maxLat: 52.60 },
    // Laut Capabilities sind die abfragbaren BRW-Layer: brw_sonstige_flaechen (Bauland/bebaut,
    // Tuerkis), brw_aussenbereich (Lila), brw_landwirtschaft (Braun). Kein separater Wohnbau-Layer
    // -> Stadt-/Wohnadressen liegen in 'sonstige_flaechen'. Kaskade: ersten Layer mit Wert nehmen.
    // Echte abfragbare BRW-Layer (aus GetCapabilities): nach Nutzungsart getrennt. Eine Wohnadresse
    // liegt in 'mehrgeschossige_bauweise' (MFH/Wohnung) oder 'ein_zweigeschossig' (EFH/DHH) – NICHT in
    // 'sonstige_flaechen' (war der bisherige Fehler). Kaskade: Wohnbau -> Gewerbe -> ländlich.
    layers: () => [
      'brw_mehrgeschossige_bauweise', 'brw_ein_zweigeschossig', 'brw_gewerbe_industrie_sondergebiete',
      'brw_sonstige_flaechen', 'brw_aussenbereich', 'brw_landwirtschaft', 'brw_forstwirtschaft',
    ],
    // NRW liefert amtlich nur EPSG:25832 (UTM32). Bei CRS:84 transformiert der Server ungenau
    // -> GetFeatureInfo verfehlt die Zone (leeres FeatureCollection). Daher nativ in UTM abfragen.
    crs: 'EPSG:25832', proj: 'utm32', format: 'geojson',
    time: (y) => `${y || CURRENT_BRW_YEAR}-01-01`,
  },
  {
    // Berlin liegt IN der BB-Box -> MUSS vor Brandenburg stehen.
    code: 'be', name: 'BORIS-Berlin', license: 'open data (Berlin)', enabled: true, verified: false,
    base: 'https://gdi.berlin.de/services/wms/bodenrichtwerte', // beim 1. Call verifizieren
    bbox: { minLon: 13.05, maxLon: 13.79, minLat: 52.32, maxLat: 52.69 },
    layer: () => 'brw', crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  {
    code: 'bb', name: 'BORIS-Brandenburg', license: 'dl-de/by-2-0', enabled: true, verified: true,
    base: 'https://isk.geobasis-bb.de/ows/boris_wms',
    bbox: { minLon: 10.89, maxLon: 14.91, minLat: 51.30, maxLat: 53.60 },
    layer: (y) => `bbv_pg_zobau_${y || CURRENT_BRW_YEAR}`,
    crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  {
    code: 'he', name: 'BORIS-Hessen', license: 'open data (HVBG)', enabled: true, verified: false,
    base: 'https://www.gds.hessen.de/wss/service/INSPIRE-HE-Bodenrichtwerte/guest', // verifizieren
    bbox: { minLon: 7.77, maxLon: 10.24, minLat: 49.39, maxLat: 51.66 },
    layer: () => 'brw', crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  {
    // Mecklenburg-Vorpommern: NICHT in BORIS-D, aber eigener freier WMS.
    code: 'mv', name: 'BORIS-MV', license: 'GeoNutzV (MV)', enabled: true, verified: false,
    base: 'https://www.geodaten-mv.de/dienste/bodenrichtwerte_wms',
    bbox: { minLon: 10.55, maxLon: 14.45, minLat: 53.05, maxLat: 54.75 },
    layer: () => 'bodenrichtwerte', crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
  // Restriktive Laender: kein freier Auto-Abruf -> sauberer Fallback auf manuellen BRW + klare Begruendung.
  { code: 'sh', name: 'BORIS-Schleswig-Holstein', restricted: true, enabled: false, verified: false,
    note: 'Schleswig-Holstein ist nicht im freien BORIS-D-Dienst enthalten — Bodenrichtwert bitte manuell eingeben.',
    bbox: { minLon: 7.80, maxLon: 11.40, minLat: 53.30, maxLat: 55.10 } },
  { code: 'by', name: 'BORIS-Bayern', restricted: true, enabled: false, verified: false,
    note: 'Bayern: Bodenrichtwertauskunft ist gebuehrenpflichtig (BORIS-Bayern) — bitte manuell eingeben.',
    bbox: { minLon: 10.50, maxLon: 13.90, minLat: 47.20, maxLat: 50.60 } },
  { code: 'bw', name: 'BORIS-Baden-Wuerttemberg', restricted: true, enabled: false, verified: false,
    note: 'Baden-Wuerttemberg: kein offener WMS; Massen-/Datensatz-Vermarktung untersagt. Einzelner Bodenrichtwert im konkreten Objektbezug (Gutachten/Expose) ist laut BORIS-BW-Nutzungsbedingungen zulaessig — Wert manuell aus boris-bw.de eintragen.',
    bbox: { minLon: 7.50, maxLon: 10.50, minLat: 47.50, maxLat: 49.80 } },
  { code: 'sl', name: 'BORIS-Saarland', restricted: true, enabled: false, verified: false,
    note: 'Saarland ist nicht im freien BORIS-D-Dienst enthalten — bitte manuell eingeben.',
    bbox: { minLon: 6.30, maxLon: 7.50, minLat: 49.10, maxLat: 49.70 } },
  {
    // BUNDESWEITER Catch-all: BORIS-D deckt alle Laender AUSSER BY/BW/SL/SH/MV ab
    // (Berlin, Brandenburg, Bremen, Hamburg, Hessen, Niedersachsen, NRW, RLP, Sachsen,
    // Sachsen-Anhalt, Thueringen). Steht ZULETZT + catchAll -> spezifische verifizierte
    // Landesadapter (NRW...) und die restriktiven Marker gewinnen immer zuerst.
    code: 'borisd', name: 'BORIS-D (bundesweit)', license: 'dl-de/by-2-0 (laenderspezifisch)',
    // Sobald die echte GetFeatureInfo-URL als ENV gesetzt ist, geht der Dienst automatisch live
    // (deckt 11 Laender ab). Keine Code-Aenderung noetig.
    enabled: !!process.env.BORISD_WMS_BASE, verified: false, catchAll: true,
    // OWS-Pfad ist portal-intern (con terra map.apps). Sobald die echte GetFeatureInfo-URL
    // bekannt ist (DevTools-Netzwerk im Portal), hier per ENV setzen -> 11 Laender live.
    base: process.env.BORISD_WMS_BASE || 'https://www.bodenrichtwerte-boris.de/boris-d',
    bbox: { minLon: 5.80, maxLon: 15.10, minLat: 47.20, maxLat: 55.10 },
    layer: () => process.env.BORISD_WMS_LAYER || 'brw', crs: 'EPSG:4326', axis: 'latlon', format: 'gml', time: null,
  },
];

// WGS84 (lat/lon) -> ETRS89/UTM Zone 32N (EPSG:25832). Standard-Transverse-Mercator-Formel.
function wgs84ToUtm32(lat, lon) {
  const a = 6378137.0, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2), lon0 = 9 * Math.PI / 180;
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  const T = Math.tan(la) ** 2, C = ep2 * Math.cos(la) ** 2, A = Math.cos(la) * (lo - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * la
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * la)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * la)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * la));
  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(la) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
    + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { easting, northing };
}

function buildUrl(a, lat, lon, year, layerName) {
  let bbox;
  if (a.proj === 'utm32') {
    // Native UTM-Abfrage: BBox in Metern (~60 m Halbkante), Achsenreihenfolge E,N (WMS 1.3.0).
    const { easting, northing } = wgs84ToUtm32(lat, lon);
    const m = 60;
    bbox = `${easting - m},${northing - m},${easting + m},${northing + m}`;
  } else {
    const d = 0.0009;
    bbox = a.axis === 'lonlat'
      ? `${lon - d},${lat - d},${lon + d},${lat + d}`
      : `${lat - d},${lon - d},${lat + d},${lon + d}`;
  }
  const layer = layerName || (a.layers ? a.layers(year)[0] : a.layer(year));
  const fmt = a.format === 'geojson' ? 'application/geo+json' : 'text/xml;subtype=gml/3.2.1';
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, CRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: fmt, FEATURE_COUNT: '1',
  });
  if (a.time) p.set('TIME', a.time(year));
  return `${a.base}?${p.toString()}`;
}

// Wie buildUrl, aber mit frei waehlbarem INFO_FORMAT (fuer die Diagnose-Probe).
function buildUrlFmt(a, lat, lon, year, layerName, infoFormat) {
  let bbox;
  if (a.proj === 'utm32') {
    const { easting, northing } = wgs84ToUtm32(lat, lon);
    const m = 60;
    bbox = `${easting - m},${northing - m},${easting + m},${northing + m}`;
  } else {
    const d = 0.0009;
    bbox = a.axis === 'lonlat'
      ? `${lon - d},${lat - d},${lon + d},${lat + d}`
      : `${lat - d},${lon - d},${lat + d},${lon + d}`;
  }
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layerName, QUERY_LAYERS: layerName, CRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: infoFormat, FEATURE_COUNT: '5',
  });
  if (a.time) p.set('TIME', a.time(year));
  return `${a.base}?${p.toString()}`;
}

export const BorisRegistry = {
  // Diagnose: holt die echte Layer-Liste vom WMS (GetCapabilities) und testet fuer den Punkt
  // systematisch Layer x INFO_FORMAT durch, bis ein nicht-leeres Ergebnis kommt. Loest die Frage
  // "falscher Layer ODER falsches Format?" ohne Raten.
  async probe(lat, lon) {
    const a = this.claim(lat, lon);
    if (!a) return { error: 'kein_adapter_fuer_punkt', lat, lon };
    const out = { land: a.name, base: a.base, utm: (a.proj === 'utm32' ? wgs84ToUtm32(lat, lon) : null) };

    // 1) GetCapabilities -> Layer-Namen (brw*) + unterstuetzte GetFeatureInfo-Formate
    try {
      const cap = await httpText(`${a.base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`, { timeoutMs: 20000, retries: 1 });
      const names = [...cap.text.matchAll(/<Name>\s*([^<]+?)\s*<\/Name>/g)].map((m) => m[1]);
      out.all_layers = [...new Set(names)];
      out.brw_layers = out.all_layers.filter((n) => /brw|bodenricht|richtwert/i.test(n));
      const fiBlock = (cap.text.match(/<GetFeatureInfo>([\s\S]*?)<\/GetFeatureInfo>/) || [])[1] || '';
      out.getfeatureinfo_formats = [...fiBlock.matchAll(/<Format>\s*([^<]+?)\s*<\/Format>/g)].map((m) => m[1]);
    } catch (e) { out.capabilities_error = e.message; }

    // 2) Probe-Matrix: jeden brw-Layer mit geo+json testen, ersten Layer zusaetzlich mit anderen Formaten
    const layersToTry = (out.brw_layers && out.brw_layers.length ? out.brw_layers : (a.layers ? a.layers() : [a.layer && a.layer()])).filter(Boolean).slice(0, 6);
    const formatsToTry = ['application/geo+json', 'application/json', 'text/html', 'text/plain'];
    const year = new Date().getFullYear() - 1;
    out.probes = [];
    for (const ln of layersToTry) {
      // pro Layer nur geo+json; fuer den ersten Layer alle Formate (um Format-Problem zu erkennen)
      const fmts = ln === layersToTry[0] ? formatsToTry : ['application/geo+json'];
      for (const fmt of fmts) {
        const url = buildUrlFmt(a, lat, lon, year, ln, fmt);
        try {
          const r = await httpText(url, { timeoutMs: 12000, retries: 0 });
          const t = (r.text || '').trim();
          const hasFeature = /"features"\s*:\s*\[\s*\{/.test(t) || /<gml:|<wfs:|<FeatureCollection|brw|bodenwert|richtwert/i.test(t.length < 5000 ? t : t.slice(0, 5000));
          const emptyFc = /"features"\s*:\s*\[\s*\]/.test(t);
          out.probes.push({ layer: ln, format: fmt, status: r.contentType, bytes: t.length,
            result: hasFeature && !emptyFc ? 'DATEN' : (emptyFc ? 'leer' : 'unklar'),
            sample: t.slice(0, 200) });
        } catch (e) { out.probes.push({ layer: ln, format: fmt, result: 'fehler', error: e.message }); }
      }
    }
    return out;
  },

  // Geografisch zustaendiger Adapter. Spezifische Landesadapter (verifiziert ODER restriktiv-
  // markiert) gewinnen IMMER vor dem bundesweiten BORIS-D-Catch-all. Innerhalb der spezifischen
  // wird ein aktiver bevorzugt (sonst der erste passende = "vorbereitet"/"restricted"-Info).
  claim(lat, lon) {
    const specific = ADAPTERS.filter((a) => !a.catchAll && inBox(lat, lon, a.bbox));
    const spec = specific.find((a) => a.enabled) || specific[0];
    if (spec) return spec;
    return ADAPTERS.find((a) => a.catchAll && inBox(lat, lon, a.bbox)) || null;
  },
  // Nur die aktiven (fuer GetFeatureInfo nutzbaren) Adapter.
  pick(lat, lon) {
    const a = this.claim(lat, lon);
    return a && a.enabled ? a : null;
  },

  // Hauptfunktion: { lat, lon, year, manualBrw } -> einheitliches Ergebnis.
  // manualBrw = in DealPilot eingegebener Bodenrichtwert (Feld "brw") als Fallback.
  async landValue({ lat, lon, year, manualBrw }) {
    const fallback = (reason) => {
      const mv = num(manualBrw);
      if (mv != null) {
        return { available: true, source: 'dealpilot-eingabe', value_sqm: mv,
                 note: 'Bodenrichtwert aus DealPilot-Eingabe (kein automatischer Amtsabruf).', reason };
      }
      return { available: false, source: 'boris', reason: reason || 'kein_adapter',
               note: 'Kein automatischer Bodenrichtwert und kein manueller Wert vorhanden.' };
    };

    const claimed = this.claim(lat, lon);
    if (!claimed) return fallback('land_nicht_unterstuetzt');
    if (claimed.restricted) {
      const fb = fallback('land_kostenpflichtig_oder_gesperrt');
      fb.claimed_land = claimed.name;
      fb.note = claimed.note || fb.note;
      return fb;
    }
    if (!claimed.enabled) {
      const fb = fallback('land_vorbereitet_nicht_aktiv');
      fb.claimed_land = claimed.name;
      return fb;
    }
    const a = claimed;

    // Layer- + Jahr-Kaskade: BRW zum aktuellen Stichtag sind oft noch nicht veroeffentlicht,
    // daher die letzten Jahre durchprobieren (neuestes zuerst). Ersten Treffer nehmen.
    const layers = a.layers ? a.layers(year) : [a.layer(year)];
    const nowY = new Date().getFullYear();
    const yearCandidates = year ? [year] : [nowY - 1, nowY - 2, nowY - 3, nowY];
    let value = null, stichtag = null, nutzung = null, zone = null, raw = null, usedLayer = null, usedYear = null, lastErr = null;
    outer:
    for (const yr of yearCandidates) {
      for (const ln of layers) {
        let text;
        try {
          const res = await httpText(buildUrl(a, lat, lon, yr, ln), { timeoutMs: 15000, retries: 1 });
          text = res.text;
        } catch (e) { lastErr = e.message; continue; }

        let v = null, st = null, nu = null, zo = null, rw = null;
        if (a.format === 'geojson') {
          const props = parseGeoJson(text);
          if (props) { rw = props; v = num(propCI(props, F.value)); st = propCI(props, F.stichtag); nu = propCI(props, F.nutzung); zo = propCI(props, F.zone); }
          else rw = (text || '').slice(0, 1200); // kein Feature -> Rohtext fuer Diagnose behalten
        } else {
          rw = text.slice(0, 1200);
          v = num(parseGmlField(text, F.value)); st = parseGmlField(text, F.stichtag);
          nu = parseGmlField(text, F.nutzung); zo = parseGmlField(text, F.zone);
        }
        if (v != null) { value = v; stichtag = st; nutzung = nu; zone = zo; raw = rw; usedLayer = ln; usedYear = yr; break outer; }
        if (rw && raw == null) raw = rw; // letzten Roh-Response fuer Diagnose behalten
      }
    }

    if (value == null) {
      const fb = fallback(lastErr ? 'request_failed:' + lastErr : 'kein_wert_am_punkt');
      fb.tried_source = a.name;
      fb.tried_layers = layers;
      fb.tried_years = yearCandidates;
      fb.properties_raw = raw; // damit das Mapping bei Bedarf justiert werden kann
      return fb;
    }

    return {
      available: true, source: a.name, license: a.license, verified: a.verified,
      value_sqm: value, stichtag, nutzung, zone, used_layer: usedLayer, used_year: usedYear, properties_raw: raw,
    };
  },

  // Ein-Klick-Verifikation: testet jedes hinterlegte Land mit Dienst an einem Beispielpunkt
  // (BBox-Mitte) ueber die ECHTE Pipeline. Laeuft auf dem (vernetzten) Server -> zeigt, welche
  // Endpunkte echte Bodenrichtwerte liefern. Ergebnis -> danach gezielt enabled/Layer justieren.
  async verifyAll() {
    const out = [];
    for (const a of ADAPTERS) {
      if (a.restricted || !a.base) { out.push({ code: a.code, name: a.name, status: 'manuell (kein freier Dienst)' }); continue; }
      const lat = +(((a.bbox.minLat + a.bbox.maxLat) / 2).toFixed(5));
      const lon = +(((a.bbox.minLon + a.bbox.maxLon) / 2).toFixed(5));
      try {
        const r = await this.landValue({ lat, lon });
        out.push({ code: a.code, name: a.name, enabled: a.enabled, testpunkt: { lat, lon },
          liefert_wert: r.available && r.value_sqm != null, value_sqm: r.value_sqm ?? null,
          source: r.source, used_layer: r.used_layer || null, used_year: r.used_year || null,
          reason: r.reason || null });
      } catch (e) { out.push({ code: a.code, name: a.name, error: e.message }); }
    }
    return out;
  },

  // Fuer /health und Transparenz: Abdeckungsuebersicht aller hinterlegten Laender.
  status() {
    return ADAPTERS.map((a) => ({
      code: a.code, name: a.name, enabled: a.enabled, verified: a.verified,
      license: a.license || null, catchAll: !!a.catchAll, restricted: !!a.restricted,
      coverage: a.enabled ? 'live' : (a.restricted ? 'manuell (rechtlich gesperrt/gebührenpflichtig)' : 'vorbereitet (Probe nötig)'),
      note: a.note || null,
    }));
  },
};
