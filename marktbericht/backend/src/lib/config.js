// config.js — zentrale Konfiguration aus ENV.
// Pattern bewusst wie DealPilot avm.js: MODE-Flags + Default 'stub', damit
// nichts crasht, wenn ein Key fehlt (liefert dann definierten Fallback statt 500).

export const cfg = {
  port: parseInt(process.env.PORT || '4000', 10),

  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'mb',
    password: process.env.PGPASSWORD || 'mb',
    database: process.env.PGDATABASE || 'marktbericht',
  },

  // Geoapify: echt angebunden. Ohne Key -> Geocoding/Places liefern leeres Resultat
  // statt zu crashen (Service degradiert, kein 500).
  geoapify: {
    key: process.env.GEOAPIFY_KEY || '',
    base: 'https://api.geoapify.com',
  },

  // OSM Overpass: keyless, aber rate-limited. Eigener Endpoint überschreibbar.
  overpass: {
    endpoint: process.env.OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter',
  },

  // KI-Report: 'stub' => Template ohne API-Call. 'openai' => echter Call.
  // Default stub, damit lokal ohne Key lauffähig.
  ai: {
    // Tippfehler-resistent: nur explizit 'stub' bleibt Stub. Jeder andere Wert
    // (z. B. 'openai', 'echter bericht', 'on') wird zu 'openai' normalisiert,
    // sodass ein vorhandener OPENAI_API_KEY zuverlässig die KI aktiviert.
    mode: ((process.env.REPORT_AI_MODE || 'stub').trim().toLowerCase() === 'stub') ? 'stub' : 'openai',
    openaiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    base: 'https://api.openai.com/v1',
  },

  // Marktdaten-Quelle für Vergleichsobjekte.
  // 'seed'  => aus DB (per Seed-Generator/CSV-Import befüllt)
  // später: 'geomap' | 'pricehubble' als Drop-in-Connector
  market: {
    source: process.env.MARKET_SOURCE || 'seed',
  },

  // GeoMap (echte Vergleichsangebote DE/AT/CH). Token aus GeoMap-Account.
  // Zweistufig: propertyOffers (IDs) -> getDetailsById (Details, kostet Guthaben).
  // maxDetails begrenzt die Detail-Abrufe pro Import = Kostenbremse.
  geomap: {
    token: process.env.GEOMAP_TOKEN || '',
    base: process.env.GEOMAP_BASE || 'https://api.geomap.immo',
    maxDetails: parseInt(process.env.GEOMAP_MAX_DETAILS || '40', 10),
    radiusKm: parseFloat(process.env.GEOMAP_RADIUS_KM || '5'),
    // Anzahl echter Einzelobjekte pro Report fuer Karte/Tabelle (je 1 Abruf = Kosten).
    // 0 = nur guenstige KPI-Statistik (Marktwert/Mietspiegel), keine Einzelabrufe.
    reportListings: parseInt(process.env.GEOMAP_REPORT_LISTINGS || '0', 10),
    // Wertentwicklung: ab welchem Jahr die Preishistorie geholt wird (je Jahr 1 guenstige KPI-Anfrage).
    historyStartYear: parseInt(process.env.GEOMAP_HISTORY_START || '2018', 10),
    // Max. Stuetzpunkte der Zeitreihe (Kostenbremse): Start+Ende bleiben immer erhalten,
    // dazwischen wird ausgeduennt. CAGR aendert sich dadurch NICHT (haengt nur an Start/Ende).
    historyMaxPoints: Math.max(2, parseInt(process.env.GEOMAP_HISTORY_MAX_POINTS || '5', 10)),
    // Miethistorie zusaetzlich holen (verdoppelt die Historie-Anfragen). Default aus.
    historyRent: (process.env.GEOMAP_HISTORY_RENT || 'true') === 'true',
  },

  // BORIS-NRW Bodenrichtwerte (Open Data, dl-de/zero-2-0). Kein Key. Nur NRW.
  boris: {
    base: process.env.BORIS_NRW_WMS || 'https://www.wms.nrw.de/boris/wms-t_nw_brw',
    layer: process.env.BORIS_NRW_LAYER || 'brw_sonstige_flaechen',
  },

  // Destatis / Regionalstatistik (GENESIS-Online). Kostenloser Token nach Registrierung.
  // Pfad/Codes aus offizieller GENESIS-Webservice-Doku v5.0 (REST/JSON 2020).
  destatis: {
    token: process.env.DESTATIS_TOKEN || '',          // = username (Token 32 Z. ODER Kennung)
    password: process.env.DESTATIS_PASSWORD || '',     // entfaellt bei Token
    base: process.env.DESTATIS_BASE || 'https://www.regionalstatistik.de/genesisws/rest/2020',
    tablePopulation: process.env.DESTATIS_TABLE_POP || '12411-01-01-4', // Bevoelkerung n. Geschlecht, Kreise (regionalstatistik-Code!)
    tableIncome: process.env.DESTATIS_TABLE_INCOME || '82411-01-03-4', // Verfuegbares Einkommen je Einwohner, Kreise
    tableUnemployment: process.env.DESTATIS_TABLE_UNEMP || '13211-02-05-4', // Arbeitslose + Arbeitslosenquoten (Jahresdurchschnitt), Kreise
  },
};

export function aiEnabled() {
  return cfg.ai.mode === 'openai' && !!cfg.ai.openaiKey;
}

export function geoEnabled() {
  return !!cfg.geoapify.key;
}

export function geomapEnabled() {
  return !!cfg.geomap.token;
}

export function destatisEnabled() {
  return !!cfg.destatis.token;
}
