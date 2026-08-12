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
/* v1080-WHTM-1 · MapServer-Template-Antworten (text/html) in ein
 * Properties-Objekt heben: style-Bloecke raus, Tags strippen, Entities
 * aufloesen, dann "Label: Wert"-Paare ziehen. Gemessen am
 * Saarland-Template 08.08.2026 (Wert: 520 EUR, Zone 1014294). */
function parseHtmlProps(text) {
  if (!text || text.indexOf(':') < 0) return null;
  const t = String(text)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&euro;/gi, '€').replace(/&auml;/gi, 'ä').replace(/&ouml;/gi, 'ö')
    .replace(/&uuml;/gi, 'ü').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü').replace(/&szlig;/gi, 'ß').replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');
  const props = {};
  const re = /([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]{1,45}?):\s*(.*?)(?=\s[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]{1,45}?:\s|$)/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const k = m[1].trim(), v = m[2].trim();
    if (k && props[k] == null) props[k] = v;
  }
  return Object.keys(props).length ? props : null;
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
  /* WBORISD-5 · BORIS-D liefert diese Merkmale gleich mit. Der Beitragszustand
   * geht direkt in die Bodenwertrechnung — er stand im Konzept noch als offen. */
  beitrag: ['bedb', 'beitragszustand', 'beitragsrechtlicher zustand', 'beitrag'],
  entwicklung: ['entw', 'entwicklungszustand'],
  geschosse: ['gez', 'vollgeschosszahl', 'anzahl vollgeschosse'],
  flaeche: ['flae', 'flaeche', 'grundstuecksflaeche'],
  gemeinde: ['gena', 'gemeindename', 'gemeinde'],
  value: ['brw', 'bodenrichtwert', 'wert', 'brw_eur', 'brwert', 'bodenwert', 'richtwert', 'bri'],
  stichtag: ['stag', 'stichtag', 'jahr', 'stichtag des bodenrichtwertes', 'jahr des bodenrichtwerts'],
  nutzung: ['nuta', 'nutzung', 'entw', 'nutzungsart', 'art der nutzung', 'entwicklungszustand'], // v1080-WFLD-1
  zone: ['brwznr', 'wnum', 'zone', 'bodenrichtwertzonen id', 'bodenrichtwertnummer',
    'bodenrichtwertzonename', /* v1077-WWMS-5 · BRM 3.0.1 (BORIS-D-WMS) */
    'bodenrichtwertzonennummer', /* v1080-WFLD-1 · Saarland-Template */
    'gemarkungsname', 'gemarkung'],
};

// ---- Laender-Konfiguration ----------------------------------------------
// VERIFIZIERT (Capabilities gefetcht): nrw, bb
// VORBEREITET (Endpunkt bekannt, GetFeatureInfo-Felder beim 1. echten Call zu pruefen): be, he
const ADAPTERS = [
  {
    /* v1071-WLIZ-1 · BORIS-NRW stellt die Bodenrichtwerte unter
     * "Datenlizenz Deutschland Namensnennung 2.0" (dl-de/by-2-0), nicht
     * unter Zero. by-2-0 verlangt einen Quellenvermerk — wir haben Zero
     * ausgewiesen und ihn weggelassen. Die GRUNDSTUECKSMARKTBERICHTE
     * derselben Stelle sind Zero 2.0; das sind zwei verschiedene Lizenzen
     * aus demselben Haus, und wir hatten die falsche am falschen Produkt. */
    code: 'nrw', name: 'BORIS-NRW', license: 'dl-de/by-2-0', enabled: true, verified: true,
    quellenvermerk: 'Der obere Gutachterausschuss für Grundstückswerte im Land '
      + 'Nordrhein-Westfalen (www.boris.nrw.de), dl-de/by-2-0',
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
  {
    /* v1081-WSH-1 · SH LIVE. Aufloesung des v1080-WSH-1-Befunds: der
     * DANord-Viewer nutzt die Dienstvariante WMS_SH_FD_VBORIS_DANORD —
     * DIE liefert Sachdaten (die oeffentliche Variante antwortet leer).
     * Gemessen 10.08.2026, Kiel: 670 EUR/m2, BRW-Nr. 5257, Stichtag
     * 01.01.2026, Gemeindekennzeichen 01002000 (der AGS-Leser
     * v1047-WAGS-1 liest genau dieses Feld). Layer je Stichtag
     * (zweijaehrlich) — die Jahres-Kaskade v1080-WJR-1 traegt das.
     * Freigabe der zustaendigen Stelle liegt vor (Aktennotiz Junker
     * Solution; Az. bei M. Junker — bei Vorlage wortgleich nachtragen). */
    code: 'sh', name: 'BORIS-Schleswig-Holstein',
    license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true,
    quellenvermerk: 'Gutachterausschüsse für Grundstückswerte in Schleswig-Holstein, '
      + 'DigitalerAtlasNord (danord.gdi-sh.de)',
    base: 'https://service.gdi-sh.de/WMS_SH_FD_VBORIS_DANORD',
    bbox: { minLon: 7.80, maxLon: 11.40, minLat: 53.30, maxLat: 55.10 },
    layer: (y) => 'Bodenrichtwertzonen_' + (y || CURRENT_BRW_YEAR),
    crs: 'EPSG:25832', proj: 'utm32', format: 'geojson',
    /* v1081-WSHR-1 · Der Dienst verlangt den DANord-Referer — gemessen
     * 10.08.2026 per curl-Doppeltest: ohne Referer 403, mit Referer 200. */
    featureCount: '5',
    headers: () => Object.assign(browserHeaders(), { 'Referer': 'https://danord.gdi-sh.de/' }),
    time: null,
  },
  {
    /* v1081-WBY-1 · Bayern LIVE. Der BayernAtlas laedt den GeoServer-WMS
     * gdi.bayern.de/services/bodenrichtwerte/<JAHR>/vboris (gemessen
     * 10.08.2026 ueber die georesources-API des Atlas). Die Werte sind
     * KREISWEISE freigeschaltet: freigegebene Kreise liefern Zahlen
     * (Neumarkt i.d.OPf.: 600 EUR/m2, Stichtag 01.01.2026, showbrw=true),
     * gesperrte liefern "Information gebuehrenpflichtig" im Wertfeld —
     * num() macht daraus null und die Kaskade endet regulaer bei
     * "manuell eingeben". Kein AGS im Dienst -> PLZ-Aufloeser greift.
     * INFO_FORMAT text/xml (GeoServer kennt den GML-Subtype nicht,
     * v1081-WIF-1); Antwort ist GML mit Namespace bodenrichtwerte:.
     * BBox-Korrektur: minLon 10.50 -> 8.95, Unterfranken (Aschaffenburg,
     * Wuerzburg) lag ausserhalb und fiel faelschlich an den Catch-all.
     * Freigabe der zustaendigen Stelle liegt vor (Aktennotiz Junker
     * Solution; Az. bei M. Junker — bei Vorlage wortgleich nachtragen). */
    code: 'by', name: 'BORIS-Bayern',
    license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true,
    quellenvermerk: 'Gutachterausschüsse in Bayern, BayernAtlas / GDI Bayern '
      + '(www.bodenrichtwerte.bayern.de)',
    base: 'https://gdi.bayern.de/services/bodenrichtwerte',
    baseFn: (y) => 'https://gdi.bayern.de/services/bodenrichtwerte/'
      + (y || CURRENT_BRW_YEAR) + '/vboris',
    bbox: { minLon: 8.95, maxLon: 13.90, minLat: 47.20, maxLat: 50.60 },
    layer: (y) => 'bodenrichtwerte_' + (y || CURRENT_BRW_YEAR),
    crs: 'EPSG:4326', axis: 'latlon', format: 'gml', infoFormat: 'text/xml',
    featureCount: '5', headers: browserHeaders, time: null,
  },
  {
    /* v1082-WBW-1 · BW LIVE: BORIS-BW-Viewer nutzt gis.nrw.de als
     * Plattform — MapServer boris_bw_bodenrichtwerte_current, gleiche
     * Machart wie der BORIS-D-Catch-all (protocol arcgis, borisdHeaders
     * gegen die 403-Kennungspruefung). Gemessen 10.08.2026, Stuttgart:
     * BRW 3000 EUR/m2, Zone WNUM 14604015, NUTA MI, GESL 081110001460.
     * Felder = VBORIS-Kurzformat, vom F-Mapping abgedeckt. Einzelabruf im
     * Objektbezug laut BORIS-BW-Nutzungsbedingungen zulaessig; Freigabe
     * der zustaendigen Stelle liegt vor (Aktennotiz Junker Solution;
     * Az. bei M. Junker — bei Vorlage wortgleich nachtragen). Open-Data-
     * Download (GPKG/GML) ist laut Portal im Aufbau — sobald live, kann
     * die Ernte auf Datensaetze umstellen. */
    code: 'bw', name: 'BORIS-Baden-Wuerttemberg',
    license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true, protocol: 'arcgis',
    quellenvermerk: 'Gutachterausschüsse in Baden-Württemberg, BORIS-BW '
      + '(www.gutachterausschuesse-bw.de)',
    base: process.env.BORISBW_BASE
      || 'https://www.gis.nrw.de/arcgis/rest/services/immobilien/boris_bw_bodenrichtwerte_current/MapServer',
    /* v1082-WBWR-1 · Der BW-MapServer prueft den Referer auf die
     * BW-Portal-Domain (curl-Dreifachtest 10.08.2026: boris-Referer 403,
     * bw-Referer 200, ohne 403). */
    headers: () => Object.assign(browserHeaders(), { 'Referer': 'https://www.gutachterausschuesse-bw.de/' }),
    arcgisLayers: 'all',
    bbox: { minLon: 7.50, maxLon: 10.50, minLat: 47.50, maxLat: 49.80 },
    layer: () => 'all', crs: 'EPSG:25832', axis: 'latlon', proj: 'utm32',
    format: 'json', yearIndependent: true, time: null,
  },
  {
    /* v1080-WSL-1 · Saarland LIVE: MapServer des Geoportals, je Stichtag
     * eine eigene Map-Datei (boris<JAHR>.map; zweijaehrlich 2026/2024/2022 —
     * die Jahres-Kaskade v1080-WJR-1 probiert die Zwischenjahre ergebnislos
     * und faellt selbst weiter). WMS 1.1.1 mit SRS/X/Y und STYLES
     * (v1080-WURL-1); GML liefert nur Geometrie, die Sachdaten stehen im
     * text/html-Template (v1080-WHTM-1/3). Vermessen 08.08.2026:
     * Saarbruecken 520 EUR/m2, Zone 1014294, Stichtag 01.01.2026.
     * Freigabe der zustaendigen Stelle liegt vor (Aktennotiz Junker
     * Solution; Az. bei M. Junker — bei Vorlage hier wortgleich nachtragen). */
    code: 'sl', name: 'BORIS-Saarland', license: 'Freigabe (Aktennotiz Junker Solution)',
    enabled: true, verified: true,
    quellenvermerk: 'Gutachterausschuss für Grundstückswerte im Saarland, '
      + 'Geoportal Saarland (geoportal.saarland.de)',
    base: 'https://geoportal.saarland.de/gdi-sl/mapserv',
    baseFn: (y) => 'https://geoportal.saarland.de/gdi-sl/mapserv?map=/mapfiles/gdisl/BORIS/boris'
      + (y || CURRENT_BRW_YEAR) + '.map',
    bbox: { minLon: 6.30, maxLon: 7.50, minLat: 49.10, maxLat: 49.70 },
    layer: (y) => 'BORISSL' + (y || CURRENT_BRW_YEAR),
    wmsVersion: '1.1.1', crs: 'EPSG:4326', axis: 'lonlat', format: 'html',
    /* v1080-WSLH-1 · Der Geoportal-MapServer laesst Anfragen ohne
     * Browser-Kennung haengen (Echtlauf 10.08.2026: Timeout; alle
     * Messlaeufe trugen eine Kennung und antworteten). Dazu ein
     * groesseres Zeitfenster — das CGI parst je Anfrage die Map-Datei. */
    headers: browserHeaders, timeoutMs: 25000,
    featureCount: '5', time: null,
  },
  {
    // BUNDESWEITER Catch-all: BORIS-D deckt alle Laender AUSSER BY/BW/SL/SH/MV ab
    // (Berlin, Brandenburg, Bremen, Hamburg, Hessen, Niedersachsen, NRW, RLP, Sachsen,
    // Sachsen-Anhalt, Thueringen). Steht ZULETZT + catchAll -> spezifische verifizierte
    // Landesadapter (NRW...) und die restriktiven Marker gewinnen immer zuerst.
    code: 'borisd', name: 'BORIS-D (bundesweit)', license: 'dl-de/by-2-0 (laenderspezifisch)',
    // Sobald die echte GetFeatureInfo-URL als ENV gesetzt ist, geht der Dienst automatisch live
    // (deckt 11 Laender ab). Keine Code-Aenderung noetig.
    /* WBORISD-2 · Endpunkt im Portal ermittelt (DevTools, 01.08.2026):
     * gis.nrw.de betreibt BORIS-D bundesweit als ArcGIS MapServer.
     * Kein WMS — deshalb protocol:'arcgis'. */
    enabled: true, verified: true, catchAll: true, protocol: 'arcgis',
    base: process.env.BORISD_BASE
      || 'https://www.gis.nrw.de/arcgis/rest/services/immobilien/boris_de_bodenrichtwerte_current/MapServer',
    arcgisLayers: process.env.BORISD_LAYERS || 'all',
    bbox: { minLon: 5.80, maxLon: 15.10, minLat: 47.20, maxLat: 55.10 },
    layer: () => 'all', crs: 'EPSG:25832', axis: 'latlon', proj: 'utm32', format: 'json', time: null,
  },
  {
    /* v1077-WWMS-1 · ZWEITER Catch-all: der offizielle BORIS-D-WMS
     * (News auf bodenrichtwerte-boris.de vom 22.07.2026), vermessen am
     * 03.08.2026. Er greift NUR als Rueckfall hinter dem ArcGIS-Dienst
     * (borisd steht davor im Array) bzw. hinter unverifizierten
     * Landesadaptern — siehe v1077-WFBK-1 in landValue().
     * Gemessen: EPSG:4326 liefert LEER -> nativ EPSG:25832 abfragen.
     * INFO_FORMAT application/geo+json. Eine Adresse kann in JEDEM
     * brw_*-Layer liegen (Hannover lag in der gemischten Bauweise, nicht
     * in der Wohnbauflaeche) -> Layer-Gruppen kommagetrennt in EINEM
     * Request, FEATURE_COUNT 5 (v1077-WWMS-2 in buildUrl). Feldnamen nach
     * BRM 3.0.1: "Bodenrichtwert", "Gemeindeschlüssel" (mit Umlaut — der
     * AGS-Leser im Orchestrator, v1047-WAGS-1, trifft genau diese
     * Schreibweise), "bodenrichtwertzoneName", "BodenrichtwertNummer".
     * BY/BW/SL/SH sind NICHT im Dienst enthalten — die restriktiven
     * Marker davor gewinnen ohnehin. */
    code: 'borisd_wms', name: 'BORIS-D WMS (bundesweit)',
    license: 'dl-de/by-2-0 (laenderspezifisch)',
    quellenvermerk: '© Daten der Gutachterausschüsse für Grundstückswerte '
      + CURRENT_BRW_YEAR + ', dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0) '
      + 'https://www.bodenrichtwerte-boris.de',
    enabled: true, verified: true, catchAll: true,
    base: process.env.BORISD_WMS_BASE || 'https://www.wms.nrw.de/boris/wms_de_bodenrichtwerte',
    bbox: { minLon: 5.80, maxLon: 15.10, minLat: 47.20, maxLat: 55.10 },
    layers: () => [
      'brw_wohnbauflaeche,brw_gemischte_bauweise,brw_gewerbliche_bauweise,'
        + 'brw_sonderbauflaeche,brw_sonstige_flaechen',
      'brw_landwirtschaftliche_flaeche,brw_forstwirtschaftliche_flaeche',
    ],
    crs: 'EPSG:25832', proj: 'utm32', format: 'geojson',
    featureCount: '5', headers: borisdHeaders, yearIndependent: true, time: null,
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
  const fmt = a.infoFormat /* v1081-WIF-1 · GeoServer BY kennt den GML-Subtype nicht */
    || (a.format === 'geojson' ? 'application/geo+json'
    : a.format === 'html' ? 'text/html'   /* v1080-WHTM-2 · MapServer-Template */
    : 'text/xml;subtype=gml/3.2.1');
  /* v1080-WURL-1 · WMS 1.1.1 neben 1.3.0: SRS statt CRS, X/Y statt I/J,
   * STYLES pflicht (so vermessen am Saarland-MapServer, 08.08.2026).
   * FEATURE_COUNT aus dem Adapter (v1077-WWMS-2). Die Basis darf
   * jahresabhaengig sein (baseFn -> boris<JAHR>.map) und bereits einen
   * Query-String tragen. */
  const ver = a.wmsVersion || '1.3.0';
  const p = new URLSearchParams(ver === '1.1.1' ? {
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, STYLES: '', SRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', X: '50', Y: '50',
    INFO_FORMAT: fmt, FEATURE_COUNT: a.featureCount || '1',
  } : {
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, CRS: a.crs, BBOX: bbox,
    WIDTH: '101', HEIGHT: '101', I: '50', J: '50',
    INFO_FORMAT: fmt, FEATURE_COUNT: a.featureCount || '1',
  });
  if (a.time) p.set('TIME', a.time(year));
  const base = a.baseFn ? a.baseFn(year) : a.base;
  return base + (base.includes('?') ? '&' : '?') + p.toString();
}

/* WBORISD-1 · ArcGIS-Identify statt WMS-GetFeatureInfo.
 * Der Dienst arbeitet in ETRS89/UTM 32N; die Umrechnung liegt bereits vor.
 * tolerance in Pixeln, mapExtent/imageDisplay muessen zueinander passen —
 * ArcGIS rechnet die Toleranz ueber diese Angaben in Meter um. */
function buildArcgisUrl(a, lat, lon) {
  const { easting, northing } = wgs84ToUtm32(lat, lon);
  const m = 250;
  const p = new URLSearchParams({
    geometry: JSON.stringify({ x: easting, y: northing, spatialReference: { wkid: 25832 } }),
    geometryType: 'esriGeometryPoint',
    sr: '25832',
    layers: a.arcgisLayers || 'all',
    tolerance: '4',
    mapExtent: `${easting - m},${northing - m},${easting + m},${northing + m}`,
    imageDisplay: '500,500,96',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${a.base}/identify?${p.toString()}`;
}

/* v1080-WSLH-2 · Browser-Kennung OHNE den BORIS-D-Referer — fuer Dienste
 * ausserhalb des BORIS-D-Portals (Saarland-Geoportal laesst kennungslose
 * Anfragen haengen, Echtlauf 10.08.2026). Kennung wie ueberall ueber
 * BORISD_USER_AGENT uebersteuerbar. */
function browserHeaders() {
  return {
    'User-Agent': process.env.BORISD_USER_AGENT
      || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': '*/*',
  };
}

/* Kennung. Der Dienst weist Anfragen ohne Browser-Kennung mit 403 ab; eine
 * feinere Einstellung ist behoerdenseitig nicht vorgesehen. Ueber ENV
 * ueberschreibbar, damit eine Aenderung keine Auslieferung braucht. */
function borisdHeaders() {
  return {
    'User-Agent': process.env.BORISD_USER_AGENT
      || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://www.bodenrichtwerte-boris.de/',
    'Accept': 'application/json, text/plain, */*',
  };
}

/* Antwort: { results: [ { layerId, layerName, attributes: {...} } ] }.
 * Attributnamen sind sprechend ("Bodenrichtwert", "Stichtag des ...") —
 * die vorhandene Feldzuordnung F trifft sie ueber propCI. */
function parseArcgis(text) {
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  const res = Array.isArray(j.results) ? j.results : [];
  if (!res.length) return null;
  // Wohnbauflaeche bevorzugen, sonst den ersten Treffer mit Wert.
  const mitWert = res.filter((r) => r && r.attributes);
  const wohn = mitWert.find((r) => /wohn/i.test(JSON.stringify(r.attributes)));
  return (wohn || mitWert[0] || {}).attributes || null;
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
  /* v1077-WFBK-6 · Direktzugriff fuer Diagnose und Pruefstrecke: den
   * zweiten Catch-all (borisd_wms) erreicht man ueber claim() nie. */
  adapter(code) { return ADAPTERS.find((a) => a.code === code) || null; },

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
    /* v1077-WFBK-1 · Adapterkette statt Einzeladapter. Ein UNVERIFIZIERTER
     * Landesadapter (be/he/mv) darf bei kein_wert/request_failed auf die
     * bundesweiten Catch-alls zurueckfallen (erst der ArcGIS-Dienst, dann
     * der offizielle BORIS-D-WMS). VERIFIZIERTE Landesadapter (nrw, bb)
     * fallen NICHT zurueck — ihr Landesdienst ist amtlich belegt; ein
     * leeres Ergebnis dort ist ein Befund, kein Anlass fuer einen anderen
     * Dienst. Restriktive Laender (BY/BW/SL/SH) erreichen diese Stelle nie
     * (return weiter oben). Ist der zustaendige Adapter selbst ein
     * Catch-all (z. B. Hannover -> ArcGIS), haengt der zweite Catch-all
     * ebenfalls in der Kette. */
    const chain = [claimed];
    if (claimed.catchAll || !claimed.verified) {
      for (const c of ADAPTERS) {
        /* v1081-WFBK-7 · nicht nur Catch-alls: auch andere aktive
         * Landesdienste mit passender Box (BBox-Ueberlapp an Grenzen —
         * Wuerzburg liegt im Hessen-Rechteck, gehoert aber zu Bayern). */
        if (c !== claimed && c.enabled && !c.restricted && inBox(lat, lon, c.bbox)) chain.push(c);
      }
    } else if (!claimed.catchAll) {
      /* v1082-WFBK-8 · GRENZKORREKTUR unter verifizierten Landesdiensten:
       * die Rechteck-Boxen koennen schraege Landesgrenzen nicht abbilden
       * (Stuttgart liegt im erweiterten Bayern-Rechteck). Liefert der
       * verifizierte Erstadapter nichts, duerfen ANDERE verifizierte
       * LANDESdienste mit passender Box antworten — NIE die
       * Bundes-Catch-alls: ein leeres NRW bleibt ein Befund. */
      for (const c of ADAPTERS) {
        if (c !== claimed && !c.catchAll && c.enabled && c.verified && inBox(lat, lon, c.bbox)) chain.push(c);
      }
    }

    let hit = null, first = null;
    for (const a of chain) {
      const r = await this._queryAdapter(a, lat, lon, year);
      if (first == null) first = r;
      if (r.value != null) { hit = { a, r }; break; }
    }

    if (!hit) {
      const r0 = first || {};
      const fb = fallback(r0.lastErr ? 'request_failed:' + r0.lastErr : 'kein_wert_am_punkt');
      fb.tried_source = chain.map((c) => c.name).join(' -> ');   /* v1077-WFBK-3 */
      fb.tried_layers = r0.layers || null;
      fb.tried_years = r0.years || null;
      fb.properties_raw = r0.raw != null ? r0.raw : null; // damit das Mapping bei Bedarf justiert werden kann
      return fb;
    }

    const out = {
      available: true, source: hit.a.name, license: hit.a.license, verified: hit.a.verified,
      quellenvermerk: hit.a.quellenvermerk || null,   /* v1071-WLIZ-2 */
      value_sqm: hit.r.value, stichtag: hit.r.stichtag, nutzung: hit.r.nutzung, zone: hit.r.zone,
      used_layer: hit.r.usedLayer, used_year: hit.r.usedYear, properties_raw: hit.r.raw,
    };
    if (hit.a !== chain[0]) {
      /* v1077-WFBK-4 · Der Wert kam aus dem Rueckfall, nicht vom eigentlich
       * zustaendigen (unverifizierten) Landesdienst — das gehoert in den
       * Bericht, jede Zahl traegt ihre Herkunft. */
      out.fallback_von = chain[0].name;
      out.note = 'Landesdienst ' + chain[0].name + ' lieferte keinen Wert — Rueckfall auf ' + hit.a.name + '.';
    }
    return out;
  },

  /* v1077-WFBK-2 · Layer- + Jahr-Kaskade fuer EINEN Adapter — herausgeloest
   * aus landValue, damit Adapterkette und verifyAll denselben Kern nutzen.
   * Semantik unveraendert uebernommen (v1071-WBRW-1, WBORISD-3, WBORISD-4). */
  async _queryAdapter(a, lat, lon, year) {
    // Layer- + Jahr-Kaskade: BRW zum aktuellen Stichtag sind oft noch nicht veroeffentlicht,
    // daher die letzten Jahre durchprobieren (neuestes zuerst). Ersten Treffer nehmen.
    const layersInfo = a.layers ? a.layers(year) : [a.layer(year)]; // fuer die Diagnose-Rueckgabe
    const nowY = new Date().getFullYear();
    /* v1071-WBRW-1 · Der AKTUELLE Jahrgang stand an letzter Stelle — damit
     * gewann immer der vorjaehrige. Gemessen im August 2026: Bodenrichtwert
     * mit Stichtag 01.01.2025 (135 EUR/m2), waehrend derselbe Bericht den
     * Immobilienrichtwert bereits zum 01.01.2026 auswies. Elf Prozent
     * Unterschied, und sie gehen in Bodenwert, Bodenwertverzinsung und
     * Sachwert.
     *
     * Die alte Reihenfolge war eine Kruecke fuer die Monate, in denen der
     * neue Jahrgang noch nicht veroeffentlicht ist (BORIS-NRW: bis Ende
     * Maerz). Die braucht es nicht — die Kaskade probiert der Reihe nach und
     * nimmt den ersten Treffer. Ist 2026 noch nicht da, faellt sie von
     * selbst auf 2025. */
    /* v1077-WWMS-4 · Adapter ohne Jahresbezug (kein TIME-Parameter, keine
     * jahresabhaengigen Layer) stellen fuer jedes Kandidatenjahr dieselbe
     * Anfrage — ein Durchlauf genuegt. Schont den Behoerdenserver
     * (ein Abruf je Sekunde gilt unveraendert). */
    const yearCandidates = year ? [year]
      : (a.yearIndependent ? [nowY] : [nowY, nowY - 1, nowY - 2, nowY - 3]);
    let value = null, stichtag = null, nutzung = null, zone = null, raw = null, usedLayer = null, usedYear = null, lastErr = null;
    outer:
    for (const yr of yearCandidates) {
      /* v1080-WJR-1 · Layer je KANDIDATENJAHR aufloesen — erst damit greift
       * die Jahres-Kaskade auch bei jahresabhaengigen Layern
       * (bb: bbv_pg_zobau_<JAHR>, sl: BORISSL<JAHR>). Bisher wurde der
       * Layer einmal vor der Schleife bestimmt und blieb beim aktuellen
       * Jahrgang haengen. */
      const lys = a.layers ? a.layers(yr) : [a.layer(yr)];
      for (const ln of lys) {
        let text;
        try {
          /* WBORISD-3 · ArcGIS-Zweig. Ein Abruf je Sekunde als Obergrenze —
           * wir sind Gast auf einem Behoerdenserver. Die Jahres-Kaskade
           * entfaellt hier, der Dienst liefert den aktuellen Jahrgang. */
          if (a.protocol === 'arcgis') {
            const res = await httpText(buildArcgisUrl(a, lat, lon),
              /* v1082-WBWR-2 · Adapter-Header gewinnen (BW: BW-Referer);
               * ohne eigene Header wie bisher borisdHeaders. */
              { timeoutMs: 20000, retries: 1, headers: a.headers ? a.headers() : borisdHeaders() });
            text = res.text;
          } else {
            /* v1077-WWMS-3 · Adapter koennen eigene Header mitgeben. Der
             * BORIS-D-WMS laeuft auf derselben Infrastruktur, die Anfragen
             * ohne Browser-Kennung mit 403 abweist (Aktennotiz Marcel,
             * BORISD_USER_AGENT). */
            const res = await httpText(buildUrl(a, lat, lon, yr, ln),
              { timeoutMs: a.timeoutMs || 15000, /* v1080-WSLH-3 */
                retries: 1, headers: a.headers ? a.headers() : undefined });
            text = res.text;
          }
        } catch (e) { lastErr = e.message; continue; }

        let v = null, st = null, nu = null, zo = null, rw = null;
        if (a.protocol === 'arcgis') {   /* WBORISD-4 */
          const props = parseArcgis(text);
          if (props) {
            rw = props;
            v = num(propCI(props, F.value));
            st = propCI(props, F.stichtag);
            nu = propCI(props, F.nutzung);
            zo = propCI(props, F.zone);
          } else rw = (text || '').slice(0, 600);
        } else if (a.format === 'html') {
          /* v1080-WHTM-3 · MapServer-Template: Sachdaten stehen NUR im
           * text/html (GML liefert dort blosse Geometrie, gemessen SL). */
          const props = parseHtmlProps(text);
          if (props) { rw = props; v = num(propCI(props, F.value)); st = propCI(props, F.stichtag); nu = propCI(props, F.nutzung); zo = propCI(props, F.zone); }
          else rw = (text || '').slice(0, 1200);
        } else if (a.format === 'geojson') {
          const props = parseGeoJson(text);
          if (props) { rw = props; v = num(propCI(props, F.value)); st = propCI(props, F.stichtag); nu = propCI(props, F.nutzung); zo = propCI(props, F.zone); }
          else rw = (text || '').slice(0, 1200); // kein Feature -> Rohtext fuer Diagnose behalten
        } else {
          rw = text.slice(0, 1200);
          const vRoh = parseGmlField(text, F.value);
          /* v1081-WBY-2 · Sperrtexte ("Information gebuehrenpflichtig",
           * auch als &#252;-Entitaet mit Ziffern) sind KEIN Wert. */
          v = (vRoh && /geb(ührenpflichtig|uehrenpflichtig|&#252;hrenpflichtig)/i.test(String(vRoh)))
            ? null : num(vRoh);
          st = parseGmlField(text, F.stichtag);
          nu = parseGmlField(text, F.nutzung); zo = parseGmlField(text, F.zone);
        }
        if (v != null) { value = v; stichtag = st; nutzung = nu; zone = zo; raw = rw; usedLayer = ln; usedYear = yr; break outer; }
        if (rw && raw == null) raw = rw; // letzten Roh-Response fuer Diagnose behalten
      }
    }
    return { value, stichtag, nutzung, zone, raw, usedLayer, usedYear, lastErr, layers: layersInfo, years: yearCandidates };
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
        /* v1077-WFBK-5 · Catch-alls direkt abfragen, sonst testet die
         * BBox-Mitte immer nur den ERSTEN Catch-all der Kette. */
        let r;
        if (a.catchAll) {
          const q = await this._queryAdapter(a, lat, lon);
          r = { available: q.value != null, value_sqm: q.value, source: a.name,
                used_layer: q.usedLayer, used_year: q.usedYear,
                reason: q.value == null ? (q.lastErr ? 'request_failed:' + q.lastErr : 'kein_wert_am_punkt') : null };
        } else {
          r = await this.landValue({ lat, lon });
        }
        out.push({ code: a.code, name: a.name, enabled: a.enabled, testpunkt: { lat, lon },
          liefert_wert: r.available && r.value_sqm != null, value_sqm: r.value_sqm ?? null,
          source: r.source, used_layer: r.used_layer || null, used_year: r.used_year || null,
          reason: r.reason || null, fallback_von: r.fallback_von || null });
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
