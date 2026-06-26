'use strict';
/**
 * v539: Marktbericht-Proxy
 * ────────────────────────────────────────────────────────────────────────────
 * Leitet /api/v1/marktbericht/* an den internen Microservice mb-backend:4000
 * weiter (Geschwister-Container im selben dealpilot-net). Von aussen unsichtbar:
 * Caddy routet /api/* -> Haupt-Backend, dieses spricht mb-backend intern.
 *
 * KEROSIN (Muster avm.js runProvider):
 *   - Abruf-Endpoints (Bericht erzeugen): Pre-Check via aiCreditsService.getStatus()
 *     -> 402 needs_credits wenn Tank zu klein; consume() NACH Erfolg (best effort).
 *     Tarif: fast=2 L (schlanker Karten-Abruf, nur Quartile), full=4 L (voller Bericht).
 *   - Read-Endpoints (replay/objects/history/fixtures): nur durchgereicht, 0 L.
 *   - health: public (Frontend nutzt es zum Aktivieren der UI).
 *
 * HISTORIE (2a): external_ref wird durchgereicht -> mb schreibt object_key='dp:<id>'
 *   in mb.object_snapshots (= Source of Truth fuer den Verlauf). Der schlanke
 *   Letzt-Snapshot fuer Objekt-JSONB/Pilot-Analyse folgt im Frontend (M3).
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const aiCreditsService = require('../services/aiCreditsService');
const creditAlert = require('../services/creditAlert'); // v554

const router = express.Router();

// Interner mb-backend (Service-Name im dealpilot-net). Per ENV ueberschreibbar.
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

// Kerosin-Tarife in Litern.
const COST = { fast: 2, full: 5 }; // v554: Vollbericht 4->5 L

// Generischer Forward an den mb-backend. Nutzt globalen fetch (Node >=18).
async function forward(method, path, opts) {
  opts = opts || {};
  const url = MB_BASE + path + (opts.query ? ('?' + opts.query) : '');
  const init = { method: method, headers: {} };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const r = await fetch(url, init);
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  return { status: r.status, data: data };
}

function qstr(req) {
  const s = new URLSearchParams(req.query || {}).toString();
  return s || null;
}

// ── Health (public, 0 L) ─────────────────────────────────────────────────────
router.get('/health', async function (req, res) {
  try {
    const out = await forward('GET', '/health');
    res.status(out.status).json(out.data);
  } catch (e) {
    res.status(502).json({ error: 'mb_unreachable', available: false, message: e.message });
  }
});

// ── Read-Endpoints (auth, 0 L) ───────────────────────────────────────────────
function readGet(path) {
  return async function (req, res) {
    try {
      const out = await forward('GET', path, { query: qstr(req) });
      res.status(out.status).json(out.data);
    } catch (e) {
      res.status(502).json({ error: 'mb_unreachable', message: e.message });
    }
  };
}
router.get('/reports/replay', authenticate, readGet('/reports/replay'));
router.get('/reports/fixtures', authenticate, readGet('/reports/fixtures'));
router.get('/objects', authenticate, readGet('/objects'));
router.get('/objects/history', authenticate, readGet('/objects/history'));

// ── Abruf-Endpoints (auth + Kerosin) ─────────────────────────────────────────
async function runReport(req, res) {
  try {
    const body = req.body || {};
    const fast = !!(body.fast || body.schnell);
    const cost = fast ? COST.fast : COST.full;

    // Kerosin-Vorabpruefung (Muster avm.js)
    const status = await aiCreditsService.getStatus(req.user.id);
    if (status.total_remaining < cost) {
      return res.status(402).json({
        error: 'Nicht genug Kerosin im Tank.',
        needs_credits: true,
        required: cost,
        credits: status
      });
    }

    // v557-rich-body: zwei Eingabeformen.
    // (1) Rich-Body (eingebettetes Marktbericht-Frontend): {address, living_area, ...} -> mb /reports/generate
    // (2) DealPilot-Objekt (Karten/QC): {object|dealpilot} -> mb /reports/from-dealpilot
    const isRich = (body.address != null || body.living_area != null || body.property_type != null) && !body.object && !body.dealpilot;
    const obj = body.object || body.dealpilot || body;
    const externalRef = body.external_ref || body.objId ||
                        (obj && (obj.id || obj.objId)) || null;
    let out;
    if (isRich) {
      out = await forward('POST', '/reports/generate', { body: body });
    } else {
      out = await forward('POST', '/reports/from-dealpilot', {
        body: {
          object: obj,
          overrides: Object.assign({}, body.overrides || {}, {
            external_ref: externalRef,
            fast: fast
          })
        }
      });
    }

    if (out.status >= 400) {
      return res.status(out.status).json(out.data);
    }

    // v554: no-data-Gate -> wenn GeoMap keine Bewertung lieferte (z.B. Guthaben 0),
    // KEIN Kerosin abbuchen und dem Frontend no_data signalisieren.
    var _d = out.data || {};
    var _dd = _d.data || _d;
    var _val = _dd.valuation && _dd.valuation.market_value;
    var _hasValue = !!(_val && (_val.estimated || _val.estimated === 0) && _val.estimated > 0);
    var _c = _d.cost || {};
    var _bal = (typeof _c.geomap_balance_eur === 'number') ? _c.geomap_balance_eur : null;

    if (!_hasValue) {
      // Kosten-Log (ohne Kerosin), ok=false
      try {
        const db = req.app.get('db');
        if (db) await db.query(
          'INSERT INTO marktbericht_cost_log (user_id, kind, liters, geomap_eur, geomap_balance_eur, address, ok) VALUES ($1,$2,$3,$4,$5,$6,false)',
          [req.user.id, (fast ? 'qc' : 'voll'), 0,
           (typeof _c.geomap_eur === 'number' ? _c.geomap_eur : null), _bal,
           ((obj && ((obj.plz || '') + ' ' + (obj.ort || ''))) || body.address || '').trim() || null]
        );
      } catch (e) { console.warn('[marktbericht] cost-log no-data failed:', e.message); }
      return res.status(200).json(Object.assign({}, out.data, { no_data: true, _kerosin: { charged: 0, mode: (fast ? 'fast' : 'full') } }));
    }

    // Erfolg -> Kerosin abziehen (best effort; blockt Bericht nicht).
    try {
      await aiCreditsService.consume(
        req.user.id, cost,
        'marktbericht:' + (fast ? 'fast' : 'full'),
        { cost: cost, fast: fast, external_ref: externalRef }
      );
    } catch (e) {
      console.warn('[marktbericht] credits consume failed:', e.message);
    }

    // v554-cost-log: Kostentracking + Schwellen-Check
    try {
      const db = req.app.get('db');
      if (db) {
        await db.query(
          'INSERT INTO marktbericht_cost_log (user_id, kind, liters, geomap_eur, geomap_balance_eur, address, ok) VALUES ($1,$2,$3,$4,$5,$6,true)',
          [req.user.id, (fast ? 'qc' : 'voll'), cost,
           (typeof _c.geomap_eur === 'number' ? _c.geomap_eur : null), _bal,
           ((obj && ((obj.plz || '') + ' ' + (obj.ort || ''))) || body.address || '').trim() || null]
        );
        // Schwellen-Mail bei niedrigem GeoMap-Guthaben (best effort)
        if (_bal != null) { try { await creditAlert.checkAndAlert(db, _bal); } catch (e) {} }
      }
    } catch (e) { console.warn('[marktbericht] cost-log failed:', e.message); }

    // v559: mb-Antwort UNVERAENDERT durchreichen, Kerosin als Zusatzfeld.
    var _resp = Object.assign({}, out.data, { _kerosin: { charged: cost, mode: (fast ? 'fast' : 'full') } });
    res.status(200).json(_resp);
  } catch (e) {
    res.status(502).json({ error: 'mb_unreachable', message: e.message });
  }
}
// v557: Read-Hilfen fuer das eingebettete Marktbericht-Frontend (auth, 0 L)
router.get('/static-map', authenticate, readGet('/static-map'));
router.get('/streetview', authenticate, readGet('/streetview'));
router.get('/isoline', authenticate, readGet('/isoline'));
router.get('/geocode/autocomplete', authenticate, readGet('/geocode/autocomplete'));
router.get('/location-finder/meta', authenticate, readGet('/location-finder/meta'));
router.get('/geomap/balance', authenticate, readGet('/geomap/balance'));
router.get('/geomap/timeseries', authenticate, readGet('/geomap/timeseries'));
// v785-boris-proxy: Bodenrichtwert (Open Data, 0 Kerosin) + Geocoding fuer das Objekt-Tab.
router.get('/boris', authenticate, readGet('/boris'));
router.get('/boris/coverage', authenticate, readGet('/boris/coverage'));
router.get('/geocode', authenticate, readGet('/geocode'));
router.post('/location-finder', authenticate, async function (req, res) {
  try { const out = await forward('POST', '/location-finder', { body: req.body || {} }); res.status(out.status).json(out.data); }
  catch (e) { res.status(502).json({ error: 'mb_unreachable', message: e.message }); }
});
// v560-stream: echtes NDJSON-Streaming durch den Proxy (Auth + 5L), Lade-Fortschritt bleibt erhalten.
router.post('/reports/generate-stream', authenticate, async function (req, res) {
  const body = req.body || {};
  const fast = !!(body.fast || body.schnell);
  const cost = fast ? COST.fast : COST.full;
  // Vorab-Check Kerosin
  let status;
  try {
    status = await aiCreditsService.getStatus(req.user.id);
    if (status.total_remaining < cost) {
      return res.status(402).json({ error: 'Nicht genug Kerosin im Tank.', needs_credits: true, required: cost, credits: status });
    }
  } catch (e) { /* fail-open auf Status, aber weiter */ }

  const isRich = (body.address != null || body.living_area != null || body.property_type != null) && !body.object && !body.dealpilot;
  const obj = body.object || body.dealpilot || body;
  const externalRef = body.external_ref || body.objId || (obj && (obj.id || obj.objId)) || null;
  const mbBody = isRich ? body : { dealpilot: obj, external_ref: externalRef, fast: fast };
  const mbPath = isRich ? '/reports/generate-stream' : '/reports/generate-stream';

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive'
  });

  let upstream;
  try {
    upstream = await fetch(MB_BASE + mbPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mbBody)
    });
  } catch (e) {
    try { res.write(JSON.stringify({ type: 'error', error: 'mb_unreachable: ' + e.message }) + '\n'); } catch (x) {}
    return res.end();
  }
  if (!upstream.ok || !upstream.body) {
    try { res.write(JSON.stringify({ type: 'error', error: 'mb_stream_status_' + upstream.status }) + '\n'); } catch (x) {}
    return res.end();
  }

  // Stream durchpipen + 'done'-Zeile mitlesen (fuer Abrechnung)
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = '', doneResult = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      res.write(chunk); // 1:1 an Client
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try { const ev = JSON.parse(line); if (ev.type === 'done') doneResult = ev.result; } catch (e) {}
      }
    }
  } catch (e) {
    try { res.write(JSON.stringify({ type: 'error', error: 'stream_relay: ' + e.message }) + '\n'); } catch (x) {}
    return res.end();
  }
  res.end();

  // Nach dem Stream: Abrechnung anhand doneResult (best effort, blockt nichts)
  try {
    const _dd = doneResult ? (doneResult.data || doneResult) : null;
    const _val = _dd && _dd.valuation && _dd.valuation.market_value;
    const _hasValue = !!(_val && _val.estimated > 0);
    const _c = (doneResult && doneResult.cost) || {};
    const _bal = (typeof _c.geomap_balance_eur === 'number') ? _c.geomap_balance_eur : null;
    const _addr = ((obj && ((obj.plz || '') + ' ' + (obj.ort || ''))) || body.address || '').trim() || null;
    const db = req.app.get('db');
    if (!_hasValue) {
      if (db) await db.query(
        'INSERT INTO marktbericht_cost_log (user_id, kind, liters, geomap_eur, geomap_balance_eur, address, ok) VALUES ($1,$2,$3,$4,$5,$6,false)',
        [req.user.id, (fast ? 'qc' : 'voll'), 0, (typeof _c.geomap_eur === 'number' ? _c.geomap_eur : null), _bal, _addr]
      );
    } else {
      try { await aiCreditsService.consume(req.user.id, cost, 'marktbericht:' + (fast ? 'fast' : 'full'), { cost: cost, fast: fast, external_ref: externalRef, stream: true }); } catch (e) {}
      if (db) {
        await db.query(
          'INSERT INTO marktbericht_cost_log (user_id, kind, liters, geomap_eur, geomap_balance_eur, address, ok) VALUES ($1,$2,$3,$4,$5,$6,true)',
          [req.user.id, (fast ? 'qc' : 'voll'), cost, (typeof _c.geomap_eur === 'number' ? _c.geomap_eur : null), _bal, _addr]
        );
        if (_bal != null) { try { await creditAlert.checkAndAlert(db, _bal); } catch (e) {} }
      }
    }
  } catch (e) { console.warn('[marktbericht] stream-Abrechnung failed:', e.message); }
});

router.post('/reports/from-dealpilot', authenticate, runReport);
router.post('/reports/generate', authenticate, runReport);

module.exports = router;
