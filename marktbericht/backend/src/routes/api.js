// api.js — alle REST-Endpunkte. Bewusst /api/v1/marktbericht-Prefix,
// damit es 1:1 als zusätzlicher Router in DealPilots Express-Backend passt.
import express from 'express';
import { q, q1, ping } from '../lib/db.js';
import { cfg, aiEnabled, geoEnabled, geomapEnabled, destatisEnabled } from '../lib/config.js';
import { ReportOrchestrator } from '../services/ReportOrchestrator.js';
import { MarketAnalysisService } from '../services/MarketAnalysisService.js';
import { MicroLocationService } from '../services/MicroLocationService.js';
import { GeocodingService } from '../services/GeocodingService.js';
import { DealPilotImportService } from '../services/DealPilotImportService.js';
import { openaiSelfCheck } from '../services/ReportGenerationService.js';
import { GeoMapImportService } from '../services/GeoMapImportService.js';
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
import { runLimited, limiterStats } from '../lib/limiter.js';
import { BorisConnector } from '../connectors/BorisConnector.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { AgsResolver } from '../connectors/AgsResolver.js';
import { ZensusConnector } from '../connectors/ZensusConnector.js';
import { GeoapifyConnector } from '../connectors/GeoapifyConnector.js';
import { LocationFinderService } from '../services/LocationFinderService.js';

export const router = express.Router();

router.get('/health', async (req, res) => {
  let db = false;
  try { db = await ping(); } catch {}
  res.json({
    ok: true,
    db,
    geoapify: geoEnabled(),
    ai_mode: cfg.ai.mode,
    ai_enabled: aiEnabled(),
    market_source: cfg.market.source,
    geomap: geomapEnabled(),
    boris: true,
    boris_laender: BorisConnector.status(),
    destatis: destatisEnabled(),
    load: limiterStats(),
  });
});

// GET /boris?lat=&lon=&year=&brw= — isolierter Bodenrichtwert-Test (Multi-Land + Fallback).
// brw = manueller DealPilot-Wert (optional) zum Test des Fallbacks.
router.get('/boris', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
  const manualBrw = req.query.brw != null ? req.query.brw : undefined;
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat und lon erforderlich, z.B. /boris?lat=52.3186&lon=8.671' });
  }
  try {
    const result = await BorisConnector.landValue({ lat, lon, year, manualBrw });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /boris/probe?lat=&lon= — Diagnose: echte Layer-Liste + Layer/Format-Matrix (welche Kombi liefert Daten).
router.get('/boris/probe', async (req, res) => {
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat und lon erforderlich' });
  try { res.json(await BorisConnector.probe(lat, lon)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /boris/verify-all — testet jedes hinterlegte Land-WMS vom Server aus (welche liefern echte Werte).
router.get('/boris/verify-all', async (req, res) => {
  try { res.json(await BorisConnector.verifyAll()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /boris/coverage — Abdeckungsuebersicht aller Bundeslaender (live / vorbereitet / manuell).
router.get('/boris/coverage', (req, res) => {
  const list = BorisConnector.status();
  const sum = { live: 0, vorbereitet: 0, manuell: 0 };
  for (const a of list) {
    if (a.enabled) sum.live++;
    else if (a.restricted) sum.manuell++;
    else sum.vorbereitet++;
  }
  res.json({
    hinweis: 'Kern-Bericht (Markt/Lage/Makro/KI) ist bundesweit. Nur der amtliche Bodenrichtwert ist landesabhaengig; ueberall gibt es den manuellen BRW-Fallback.',
    zusammenfassung: sum, laender: list,
  });
});

// GET /geomap/balance — Guthaben in EUR netto
router.get('/geomap/balance', async (req, res) => {
  if (!geomapEnabled()) return res.status(400).json({ error: 'GeoMap nicht konfiguriert (GEOMAP_TOKEN fehlt)' });
  const bal = await GeoMapConnector.getBalance();
  res.json({ amountEuroNetto: bal });
});

// POST /import/geomap — echte GeoMap-Angebote für einen Standort holen + cachen
// Body: { lat, lon, radiusKm?, maxDetails?, force? }  ODER { address, ... }
router.post('/import/geomap', async (req, res) => {
  try {
    let { lat, lon, radiusKm, maxDetails, force, address } = req.body || {};
    if ((lat == null || lon == null) && address) {
      const g = await GeocodingService.geocode(address);
      if (!g) return res.status(422).json({ error: 'Adresse nicht geokodierbar' });
      lat = g.lat; lon = g.lon;
    }
    console.log(`[import] geomap: lat=${lat} lon=${lon} radius=${radiusKm || cfg.geomap.radiusKm}km`);
    const out = await GeoMapImportService.importLocation({
      lat: Number(lat), lon: Number(lon),
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      maxDetails: maxDetails ? Number(maxDetails) : undefined,
      force: !!force,
    });
    console.log(`[import] geomap fertig:`, JSON.stringify(out));
    res.json(out);
  } catch (e) {
    console.error('[import] geomap FEHLER:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Speichert das vollstaendige Ergebnis als Fixture (key='last' + object_key) fuer kostenlosen Replay.
let _fixturesReady = null;
async function ensureFixtures() {
  if (_fixturesReady) return _fixturesReady;
  _fixturesReady = (async () => {
    await q('CREATE SCHEMA IF NOT EXISTS mb');
    await q(`CREATE TABLE IF NOT EXISTS mb.report_fixtures (
      key TEXT PRIMARY KEY, address TEXT, result JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`);
  })().catch((e) => { _fixturesReady = null; console.error('[fixtures] ensure failed:', e.message); throw e; });
  return _fixturesReady;
}
async function saveFixture(out) {
  try {
    await ensureFixtures();
    const addr = (out && out.data && out.data.address && out.data.address.formatted)
      || (out && out.data && out.data.ref && out.data.ref.address) || null;
    const keys = [...new Set(['last', out && out.object_key].filter(Boolean))];
    for (const k of keys) {
      await q(`INSERT INTO mb.report_fixtures (key,address,result) VALUES ($1,$2,$3)
               ON CONFLICT (key) DO UPDATE SET address=$2, result=$3, created_at=now()`,
        [k, addr, JSON.stringify(out)]);
    }
  } catch (e) { console.error('[fixture] save failed:', e.message); }
}

// POST /reports/generate  — Hauptendpoint
router.post('/reports/generate', async (req, res) => {
  console.log('[req] POST /reports/generate  address=', (req.body && req.body.address) || '(keine)');
  try {
    const out = await runLimited(() => ReportOrchestrator.generate(req.body || {}));
    console.log(`[req] /reports/generate OK in ${out.took_ms}ms (ai_mode=${out.ai_mode})`);
    res.json(out);
    saveFixture(out);
  } catch (e) {
    console.error('[req] /reports/generate FEHLER:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// POST /reports/generate-stream — wie /reports/generate, aber STREAMT den Fortschritt.
// Antwort = NDJSON (eine JSON-Zeile pro Ereignis):
//   {"type":"step","msg":"...","t":...}   Fortschritts-Schritt
//   {"type":"done","result":{...}}         fertiger Bericht (gleiches Objekt wie /generate)
//   {"type":"error","error":"..."}         Fehler
// Frontend liest den Body als Stream und zeigt Live-Fortschritt statt 3-Min-Stillstand.
router.post('/reports/generate-stream', async (req, res) => {
  console.log('[req] POST /reports/generate-stream  address=', (req.body && req.body.address) || '(keine)');
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no', // Proxy-Puffer aus (falls je hinter Caddy)
    Connection: 'keep-alive',
  });
  const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch {} };
  const onStep = (msg) => send({ type: 'step', msg, t: Date.now() });
  onStep('Anfrage angenommen…');
  try {
    const out = await runLimited(() => ReportOrchestrator.generate(req.body || {}, { onStep }));
    console.log(`[req] /reports/generate-stream OK in ${out.took_ms}ms (ai_mode=${out.ai_mode})`);
    send({ type: 'done', result: out });
    res.end();
    saveFixture(out);
  } catch (e) {
    console.error('[req] /reports/generate-stream FEHLER:', e.message);
    send({ type: 'error', error: e.message || 'Fehler' });
    res.end();
  }
});

// GET /static-map?lat=&lon=&zoom= — Objektkarte (Geoapify/OSM) als PNG. Proxy: Key bleibt serverseitig.
router.get('/static-map', async (req, res) => {
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  const zoom = req.query.zoom ? parseInt(req.query.zoom, 10) : 16;
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat und lon erforderlich' });
  // Style-Whitelist (Cover nutzt dark-matter-yellow-roads = gold auf schwarz bzw. positron = hell).
  const ALLOWED = ['osm-bright', 'osm-bright-grey', 'positron', 'klokantech-basic',
    'dark-matter', 'dark-matter-brown', 'dark-matter-yellow-roads'];
  const style = ALLOWED.includes(req.query.style) ? req.query.style : 'osm-bright';
  const width = Math.min(4096, Math.max(200, parseInt(req.query.width, 10) || 880));
  const height = Math.min(4096, Math.max(200, parseInt(req.query.height, 10) || 420));
  const marker = req.query.marker !== '0';
  const url = GeoapifyConnector.staticMapUrl({ lat, lon, zoom, style, width, height, marker });
  if (!url) return res.status(503).json({ error: 'Geoapify nicht konfiguriert' });
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Static-Map-Fehler ' + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', r.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // 1 Tag cachen (Lizenz erlaubt es)
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /streetview?lat&lon — Google Street View Static (env-gated via GOOGLE_MAPS_KEY).
// Key bleibt serverseitig; ohne Key 503 -> Frontend faellt auf /static-map zurueck.
// Bilder werden NICHT persistiert (Google-Lizenz: nur pano_ID darf gecacht werden).
router.get('/streetview', async (req, res) => {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return res.status(503).json({ error: 'Street View nicht konfiguriert (GOOGLE_MAPS_KEY fehlt)' });
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat und lon erforderlich' });
  const w = Math.min(640, Math.max(200, parseInt(req.query.width, 10) || 640));
  const h = Math.min(640, Math.max(150, parseInt(req.query.height, 10) || 400));
  const fov = Math.min(120, Math.max(30, parseInt(req.query.fov, 10) || 82));
  const loc = lat + ',' + lon;
  try {
    const meta = await fetch('https://maps.googleapis.com/maps/api/streetview/metadata?location=' + loc + '&source=outdoor&key=' + key);
    const mj = await meta.json();
    if (!mj || mj.status !== 'OK') return res.status(404).json({ error: 'Kein Street View an diesem Standort', status: mj && mj.status });
    const img = await fetch('https://maps.googleapis.com/maps/api/streetview?size=' + w + 'x' + h + '&location=' + loc + '&fov=' + fov + '&source=outdoor&return_error_code=true&key=' + key);
    if (!img.ok) return res.status(502).json({ error: 'Street-View-Fehler ' + img.status });
    const buf = Buffer.from(await img.arrayBuffer());
    res.set('Content-Type', img.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('X-SV-Pano', mj.pano_id || '');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /isoline?lat&lon&minutes&mode — Erreichbarkeits-Polygon (Geoapify Isoline) als GeoJSON.
router.get('/isoline', async (req, res) => {
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat und lon erforderlich' });
  if (!cfg.geoapify || !cfg.geoapify.key) return res.status(503).json({ error: 'Geoapify nicht konfiguriert' });
  const minutes = Math.min(45, Math.max(3, parseInt(req.query.minutes, 10) || 10));
  const allowed = ['walk', 'drive', 'bicycle', 'transit', 'approximated_transit'];
  const mode = allowed.includes(req.query.mode) ? req.query.mode : 'walk';
  const url = 'https://api.geoapify.com/v1/isoline?lat=' + lat + '&lon=' + lon
    + '&type=time&mode=' + mode + '&range=' + (minutes * 60) + '&apiKey=' + cfg.geoapify.key;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Isoline-Fehler ' + r.status });
    const gj = await r.json();
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(gj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /geocode/autocomplete?text= — Adress-/Standortsuche (Key bleibt serverseitig)
router.get('/geocode/autocomplete', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim();
    if (text.length < 3) return res.json({ results: [] });
    const results = await GeoapifyConnector.autocomplete(text);
    res.json({ results });
  } catch (e) { res.json({ results: [], error: e.message }); }
});

// Standort-Finder: Absichten + Regionen
router.get('/location-finder/meta', (req, res) => {
  res.json(LocationFinderService.meta());
});
// Standort-Finder: ranken nach Absicht + Region
router.post('/location-finder', async (req, res) => {
  try {
    const { intent, region } = req.body || {};
    if (!intent) return res.status(400).json({ error: 'intent erforderlich' });
    const out = await LocationFinderService.run(intent, region || 'owl');
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /objects — Liste aller Objekte (gruppiert) mit dem jeweils neuesten Snapshot.
router.get('/objects', async (req, res) => {
  try {
    const r = await q(
      `SELECT DISTINCT ON (object_key) object_key, external_ref, address, property_type,
              living_area, build_year, market_value, deal_score, created_at,
              (SELECT count(*) FROM mb.object_snapshots s2 WHERE s2.object_key = s1.object_key) AS snapshots
         FROM mb.object_snapshots s1
        ORDER BY object_key, created_at DESC`
    );
    res.json({ objects: r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /objects/history?key=... (oder ?ref=DealPilot-ID) — zeitlicher Verlauf eines Objekts.
router.get('/objects/history', async (req, res) => {
  const key = req.query.key, ref = req.query.ref;
  if (!key && !ref) return res.status(400).json({ error: 'key oder ref erforderlich' });
  try {
    const r = await q(
      `SELECT id, report_id, created_at, market_value, market_value_low, market_value_high,
              median_sqm, gross_yield_pct, rent_multiplier, deal_score, micro_score, macro_score,
              price_cagr_pct, confidence, comparable_group, ai_mode
         FROM mb.object_snapshots
        WHERE ${key ? 'object_key = $1' : 'external_ref = $1'}
        ORDER BY created_at ASC`,
      [key || ref]
    );
    res.json({ key: key || null, ref: ref || null, count: r.length, history: r });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/destatis/check', async (req, res) => {
  if (!destatisEnabled()) return res.json({ configured: false, hinweis: 'Kein DESTATIS_TOKEN in .env gesetzt.' });
  const r = await DestatisConnector.logincheck();
  res.json({ configured: true, ok: r.ok, base: r.base,
    hinweis: r.ok ? ('Zugangsdaten gültig (Pfad: ' + r.base + ') – Sozioökonomie kann angebunden werden.')
                  : 'Anmeldung fehlgeschlagen: ' + (r.reason || r.status || 'unbekannt'),
    status: r.status, username: r.username });
});

// GET /zensus/check — ist die Zensus-CSV da, wie viele Kreise, welche Spalten erkannt + Beispiel.
router.get('/zensus/check', async (req, res) => {
  try {
    const s = ZensusConnector.status();
    res.json({
      ...s,
      hinweis: s.loaded
        ? (s.count + ' Kreise geladen – Zensus-Kennzahlen (Leerstand/Eigentümerquote) sind aktiv.')
        : 'Keine/leere Zensus-CSV. Datei backend/data/zensus2022_kreise.csv befüllen (siehe data/README.md).',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /destatis/raw?ags=05758&table=12411-0014 — roher GENESIS-ffcsv (zum Parser-Justieren).
router.get('/destatis/raw', async (req, res) => {
  const r = await DestatisConnector.raw({ ags: req.query.ags, table: req.query.table });
  res.json(r);
});

// GET /destatis/find?term=Arbeitslosenquote&category=tables — gueltige Tabellencodes suchen.
router.get('/destatis/find', async (req, res) => {
  try {
    const r = await DestatisConnector.find({ term: req.query.term, category: req.query.category || 'tables' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /destatis/macro?ags=05758 — fuehrt die ECHTE macro()-Pipeline aus (cache-frei).
// Zeigt available + abgeleitete Metriken (Bevoelkerungstrend etc.) oder den Grund.
router.get('/destatis/macro', async (req, res) => {
  try {
    const r = await DestatisConnector.macro({ ags: req.query.ags });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /destatis/age?ags=&table= — 18-30-Anteil + Roh-Kopf (zum Finalisieren des Parsers)
router.get('/destatis/age', async (req, res) => {
  try {
    if (req.query.table) process.env.DESTATIS_TABLE_AGE = String(req.query.table);
    const r = await DestatisConnector.ageShare18_30({ ags: req.query.ags });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /openai/check — minimaler KI-Call mit aktuellen Settings -> finish_reason/usage/preview.
// Zeigt cache-frei, ob der KI-Bericht funktioniert oder warum er leer bleibt.
router.get('/openai/check', async (req, res) => {
  try {
    const r = await openaiSelfCheck();
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /ags?plz=32052 — Kreis-Schlüssel (AGS) zur PLZ (via OpenPLZ). Test der AGS-Auflösung.
router.get('/ags', async (req, res) => {
  const info = await AgsResolver.fromPostcode(req.query.plz);
  res.json(info || { error: 'kein AGS gefunden für PLZ ' + (req.query.plz || '') });
});


// Zum Verifizieren: variieren die Jahreswerte -> Zeitraum-Filter wirkt. Alle gleich -> Filter ignoriert.
router.get('/geomap/timeseries', async (req, res) => {
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  const offerType = req.query.type === 'Miete' ? 'Miete' : 'Kauf';
  const from = req.query.from ? parseInt(req.query.from, 10) : 2018;
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat und lon erforderlich' });
  const years = []; const now = new Date().getFullYear();
  for (let y = from; y <= now; y++) years.push(y);
  try {
    const series = await GeoMapConnector.timeSeries({ lat, lon, offerType, analyzedField: 'PREISPROQM', years });
    const vals = series.map((s) => s.median).filter((v) => v != null);
    const varies = new Set(vals).size > 1;
    res.json({ offerType, varies, hinweis: varies ? 'Zeitraum-Filter wirkt – Historie nutzbar.' : 'Alle Jahre gleich/leer – Datums-Parameter greift nicht, anderer Feldname nötig.', series });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// Body: ein .dpkt-Objekt, {data,ai_analysis}, ODER ein Array (erstes Objekt wird genutzt).
// Optional { overrides: {...} } um einzelne Felder zu ueberschreiben.
router.post('/reports/from-dealpilot', async (req, res) => {
  const body = req.body || {};
  const obj = Array.isArray(body) ? body[0] : (body.object || body.dealpilot || body);
  if (!obj || typeof obj !== 'object') {
    return res.status(400).json({ error: 'Kein DealPilot-Objekt im Body (Array, {data,...} oder {object})' });
  }
  console.log('[req] POST /reports/from-dealpilot');
  try {
    const out = await runLimited(() => ReportOrchestrator.generate({ dealpilot: obj, ...(body.overrides || {}) }));
    console.log(`[req] /reports/from-dealpilot OK in ${out.took_ms}ms (ai_mode=${out.ai_mode})`);
    res.json(out);
    saveFixture(out);
  } catch (e) {
    console.error('[req] /reports/from-dealpilot FEHLER:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /reports/fixtures — Liste gespeicherter Berichte (fuer den Demo-/Replay-Picker).
router.get('/reports/fixtures', async (req, res) => {
  try {
    const r = await q('SELECT key,address,created_at FROM mb.report_fixtures ORDER BY created_at DESC LIMIT 50');
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /reports/replay?key=last — gespeicherten Bericht laden, OHNE neue API-Kosten.
router.get('/reports/replay', async (req, res) => {
  try {
    await ensureFixtures();
    const key = req.query.key || 'last';
    const rows = await q('SELECT result FROM mb.report_fixtures WHERE key=$1', [key]);
    if (!rows.length) return res.status(404).json({ error: 'Kein gespeicherter Bericht (key=' + key + '). Erst einen Bericht erstellen.' });
    let out = rows[0].result;
    if (typeof out === 'string') { try { out = JSON.parse(out); } catch {} }
    out._replay = true;
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /reports/:propertyId — letzten Bericht zu einem Objekt holen
router.get('/reports/:propertyId', async (req, res) => {
  const r = await q1(
    'SELECT * FROM mb.market_reports WHERE property_id = $1 ORDER BY id DESC LIMIT 1',
    [parseInt(req.params.propertyId, 10)]
  );
  if (!r) return res.status(404).json({ error: 'kein Bericht' });
  res.json(r);
});

// GET /market/location?lat=&lon=&radius=&type=&listing=
router.get('/market/location', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat/lon erforderlich' });
    const ref = {
      lat, lon,
      property_type: req.query.type || null,
      living_area: req.query.area ? parseFloat(req.query.area) : null,
      build_year: req.query.year ? parseInt(req.query.year, 10) : null,
    };
    const listing = req.query.listing === 'miete' ? 'miete' : 'kauf';
    const stats = await MarketAnalysisService.comparables(ref, listing);
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /comparables/:propertyId
router.get('/comparables/:propertyId', async (req, res) => {
  const p = await q1('SELECT * FROM mb.properties WHERE id = $1', [parseInt(req.params.propertyId, 10)]);
  if (!p) return res.status(404).json({ error: 'unbekanntes Objekt' });
  const ref = { lat: p.lat, lon: p.lon, property_type: p.property_type, living_area: p.living_area, build_year: p.build_year };
  const [kauf, miete] = await Promise.all([
    MarketAnalysisService.comparables(ref, 'kauf'),
    MarketAnalysisService.comparables(ref, 'miete'),
  ]);
  res.json({ kauf, miete });
});

// GET /rent-analysis/:propertyId
router.get('/rent-analysis/:propertyId', async (req, res) => {
  const p = await q1('SELECT * FROM mb.properties WHERE id = $1', [parseInt(req.params.propertyId, 10)]);
  if (!p) return res.status(404).json({ error: 'unbekanntes Objekt' });
  const stats = await MarketAnalysisService.rentLevel({ lat: p.lat, lon: p.lon, property_type: p.property_type, living_area: p.living_area, build_year: p.build_year });
  res.json(stats);
});

// GET /micro/:propertyId
router.get('/micro/:propertyId', async (req, res) => {
  const p = await q1('SELECT * FROM mb.properties WHERE id = $1', [parseInt(req.params.propertyId, 10)]);
  if (!p) return res.status(404).json({ error: 'unbekanntes Objekt' });
  const micro = await MicroLocationService.analyze(p.lat, p.lon, 2000);
  res.json(micro);
});

// GET /geocode?address=
router.get('/geocode', async (req, res) => {
  if (!req.query.address) return res.status(400).json({ error: 'address erforderlich' });
  const g = await GeocodingService.geocode(req.query.address);
  if (!g) return res.status(404).json({ error: 'nicht geokodierbar (Geoapify-Key fehlt?)' });
  res.json(g);
});

// POST /import/offers — CSV-Import (JSON-Array von Angeboten)
// Body: { offers: [ {listing_type,property_type,postcode,city,lat,lon,living_area,
//                    rooms,build_year,condition,energy_class,price,offer_date} ] }
router.post('/import/offers', async (req, res) => {
  const offers = (req.body && req.body.offers) || [];
  if (!Array.isArray(offers) || !offers.length) return res.status(400).json({ error: 'offers[] erforderlich' });
  let n = 0;
  for (const o of offers) {
    const pps = o.price_per_sqm || (o.price && o.living_area ? o.price / o.living_area : null);
    await q(
      `INSERT INTO mb.offers
        (source_code,listing_type,property_type,postcode,city,lat,lon,geom,
         living_area,rooms,build_year,condition,energy_class,price,price_per_sqm,offer_date)
       VALUES ('csv_import',$1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($6,$5),4326),
         $7,$8,$9,$10,$11,$12,$13,$14)`,
      [o.listing_type, o.property_type || null, o.postcode || null, o.city || null,
       o.lat, o.lon, o.living_area || null, o.rooms || null, o.build_year || null,
       o.condition || null, o.energy_class || null, o.price || null, pps, o.offer_date || null]
    );
    n++;
  }
  res.json({ imported: n });
});

// POST /import/dealpilot — DealPilot-Objekte als Vergleichsdaten importieren
// Body: { objects: [ {kp,nkm,wfl,plz,ort,str,hnr,baujahr,objart,...} ] }
//   ODER Backend-Form: { objects: [ {id, data:{...}} ] }
//   ODER direkt ein Array im Body.
router.post('/import/dealpilot', async (req, res) => {
  let objects = req.body && req.body.objects;
  if (!objects && Array.isArray(req.body)) objects = req.body;
  if (!Array.isArray(objects) || !objects.length) {
    return res.status(400).json({ error: 'objects[] erforderlich (DealPilot-Objekte)' });
  }
  console.log(`[import] dealpilot: ${objects.length} Objekte`);
  try {
    const out = await DealPilotImportService.importObjects(objects);
    console.log(`[import] dealpilot fertig: ${out.imported} importiert, ${out.offers_created} Angebote, ${out.skipped} übersprungen`);
    res.json(out);
  } catch (e) {
    console.error('[import] dealpilot FEHLER:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /stats/offers — Übersicht für Sanity-Check
router.get('/stats/offers', async (req, res) => {
  const rows = await q(
    `SELECT city, listing_type, COUNT(*)::int AS n, ROUND(AVG(price_per_sqm)::numeric,2) AS avg_sqm
     FROM mb.offers GROUP BY city, listing_type ORDER BY city, listing_type`
  );
  res.json(rows);
});
