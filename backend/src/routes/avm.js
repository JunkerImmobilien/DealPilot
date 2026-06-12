'use strict';
/**
 * V326: AVM-Integration — PriceHubble + Sprengnetter.
 *
 * Endpoints:
 *   GET  /api/v1/avm/health                 — public; { available, mode, providers }
 *                                              Frontend nutzt das, um die Buttons
 *                                              zu aktivieren / auszugrauen.
 *   POST /api/v1/avm/quote                   — auth; Credit-Kosten VOR dem Call
 *                                              (verbraucht NICHTS).
 *   POST /api/v1/avm/sprengnetter            — auth; Bewertung + Credit-Abzug (live)
 *   POST /api/v1/avm/pricehubble             — auth; Bewertung + Credit-Abzug (live)
 *
 * SCHALTER (ENV):
 *   AVM_ENABLED = 'true' | 'false'  (Master; false → Buttons ausgegraut)
 *   AVM_MODE    = 'stub' | 'live'   (stub = Demo-Daten ohne Kosten/Credits)
 *
 * CREDIT-VERHALTEN (analog ai.js):
 *   - Pre-Check via aiCreditsService.getStatus(); 402 wenn zu wenig.
 *   - consume() NUR im Live-Modus NACH erfolgreichem Call.
 *   - Stub-Modus verbraucht KEINE Credits (gefahrloses Testen).
 */

const express = require('express');
const crypto = require('crypto'); // v480: Cache-Key-Hash
const { authenticate } = require('../middleware/auth');
const aiCreditsService = require('../services/aiCreditsService');
const avmCreditsService = require('../services/avmCreditsService');
const { query } = require('../db/pool');  // v387 Per-Plan-Modus
const stub = require('../services/avm-stub');
const sprengnetter = require('../services/sprengnetter-client');
const pricehubble = require('../services/pricehubble-client');

const router = express.Router();

// ── Konfiguration ─────────────────────────────────────────────────────────
function avmEnabled() { return String(process.env.AVM_ENABLED || '').toLowerCase() === 'true'; }
function avmMode() { return String(process.env.AVM_MODE || 'stub').toLowerCase() === 'live' ? 'live' : 'stub'; }

// v644: Per-Provider Live-Allowlist + Client-Readiness.
// AVM_LIVE_PROVIDERS=sprengnetter (CSV) -> nur gelistete Provider duerfen live gehen.
// AVM_CLIENT_READY: pricehubble-client.js ist derzeit nur ein Stub-Wrapper und NICHT
// live-faehig (wuerde sonst 40 L abziehen und Demo-Daten als echt labeln). Bei echtem
// PH-Client einfach pricehubble:true setzen.
var AVM_CLIENT_READY = { sprengnetter: true, pricehubble: false };
function avmLiveProviders() {
  return String(process.env.AVM_LIVE_PROVIDERS || '').toLowerCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}
function providerEnabled(provider) {
  var p = String(provider || '').toLowerCase();
  if (!AVM_CLIENT_READY[p]) return false;            // Client noch nicht echt -> coming soon
  var list = avmLiveProviders();
  if (!list.length) return true;                      // keine Allowlist -> Legacy (alle ready-Clients an)
  return list.indexOf(p) !== -1;
}
// v387: Plan des Users (Spiegel aiCreditsService).
async function getPlanId(userId) {
  try {
    const r = await query("SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1", [userId]);
    return r.rowCount ? r.rows[0].plan_id : 'free';
  } catch (e) { return 'free'; }
}
// Free -> immer Demo (stub). Bezahlt -> live nur wenn global AVM_MODE=live, sonst stub.
async function modeForUser(userId) {
  if (avmMode() !== 'live') return 'stub';
  const plan = await getPlanId(userId);
  return (plan && plan !== 'free') ? 'live' : 'stub';
}

// Credit-Kosten je Provider. Sprengnetter: seit v480 immer 2 echte API-Calls
// (Marktwert + Marktmiete); das Fair-Price-Label (3. Call) ist deaktiviert.
// PriceHubble: 1 Call. (Credit-Preis je Abruf hier = 1, unabhaengig vom Kaufpreis.)
// v491-kerosin-avm: Verbrauch in LITERN aus dem einen Kerosin-Tank.
// PriceHubble 40 L (Kosten 6 EUR), Sprengnetter 20 L (Kosten 3 EUR, 2 API-Calls).
const COST = { pricehubble: 40, sprengnetter_full: 20, sprengnetter_nokp: 20 };

function num(v) { return stub.num(v); }
function hasKp(inputs) { return !!num((inputs || {}).kp); }

function costFor(provider, inputs) {
  if (provider === 'pricehubble') return COST.pricehubble;
  if (provider === 'sprengnetter') return hasKp(inputs) ? COST.sprengnetter_full : COST.sprengnetter_nokp;
  return 0;
}

// Pflichtfelder je Provider (Backend-Spiegel der Frontend-Validierung).
function missingFields(provider, inputs) {
  inputs = inputs || {};
  const need = provider === 'pricehubble'
    ? [['plz', 'PLZ'], ['ort', 'Ort'], ['str', 'Straße'], ['hnr', 'Hausnummer'], ['objektart', 'Objektart'], ['wfl', 'Wohnfläche']]
    : [['plz', 'PLZ'], ['ort', 'Ort'], ['objektart', 'Objektart'], ['wfl', 'Wohnfläche']];
  const miss = [];
  need.forEach(function (f) {
    const val = inputs[f[0]];
    if (val == null || String(val).trim() === '') miss.push(f[1]);
  });
  return miss;
}

// ── GET /health — public ────────────────────────────────────────────────────
router.get('/health', function (req, res) {
  const enabled = avmEnabled();
  res.json({
    available: enabled,
    mode: avmMode(),
    providers: {
      pricehubble: { enabled: enabled && providerEnabled('pricehubble'), configured: pricehubble.isConfigured(), coming_soon: !providerEnabled('pricehubble') },
      sprengnetter: { enabled: enabled && providerEnabled('sprengnetter'), configured: sprengnetter.isConfigured(), coming_soon: !providerEnabled('sprengnetter') }
    }
  });
});

// ── POST /quote — Credit-Kosten vorab (verbraucht nichts) ────────────────────
router.post('/quote', authenticate, async function (req, res, next) {
  try {
    if (!avmEnabled()) {
      return res.status(503).json({ error: 'avm_disabled', disabled: true, message: 'AVM-Abruf ist derzeit deaktiviert.' });
    }
    const provider = String((req.body || {}).provider || '').toLowerCase();
    if (provider !== 'pricehubble' && provider !== 'sprengnetter') {
      return res.status(400).json({ error: 'invalid_provider', message: 'provider muss "pricehubble" oder "sprengnetter" sein.' });
    }
    const inputs = (req.body || {}).inputs || {};
    const miss = missingFields(provider, inputs);
    const cost = costFor(provider, inputs);
    const status = await aiCreditsService.getStatus(req.user.id);
    const mode = await modeForUser(req.user.id);
    res.json({
      provider: provider,
      mode: mode,
      cost: cost,
      free_in_stub: mode === 'stub',
      missing_fields: miss,
      ready: miss.length === 0,
      credits: status,
      enough_credits: mode === 'stub' ? true : (status.total_remaining >= cost)
    });
  } catch (e) { next(e); }
});

// ── In-Memory AVM-Result-Cache (v480) ───────────────────────────────────────
// Spart echte API-Kosten UND Credits, wenn dasselbe Objekt (gleicher User, gleicher
// Anbieter, gleiche Eckdaten) erneut bewertet wird. NUR im Live-Modus aktiv.
// HINWEIS: In-Memory → wird bei Backend-Neustart/Rebuild geleert. Fuer dauerhaftes
// Caching ueber Neustarts hinweg braeuchte es eine DB-Tabelle (Migration).
// TTL via ENV AVM_CACHE_TTL_DAYS (Default 90 Tage).
const AVM_CACHE = new Map(); // key -> { result, ts }
const AVM_CACHE_TTL_MS = (parseInt(process.env.AVM_CACHE_TTL_DAYS || '90', 10) || 90) * 24 * 60 * 60 * 1000;
const AVM_CACHE_MAX = 2000;

function _cacheKey(userId, provider, inputs) {
  inputs = inputs || {};
  const norm = [
    provider,
    String(userId || ''),
    String(inputs.plz || '').trim().toLowerCase(),
    String(inputs.ort || '').trim().toLowerCase(),
    String(inputs.str || '').trim().toLowerCase(),
    String(inputs.hnr || '').trim().toLowerCase(),
    String(inputs.objektart || '').trim().toLowerCase(),
    String(num(inputs.wfl) || ''),
    String(num(inputs.baujahr) || ''),
    String(num(inputs.zimmer) || ''),
    String(num(inputs.etage) || ''),
    hasKp(inputs) ? '1' : '0'
  ].join('|');
  return crypto.createHash('sha256').update(norm).digest('hex');
}
function _cacheGet(key) {
  const e = AVM_CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > AVM_CACHE_TTL_MS) { AVM_CACHE.delete(key); return null; }
  return e.result;
}
function _cacheSet(key, result) {
  if (AVM_CACHE.size >= AVM_CACHE_MAX) {
    const oldest = AVM_CACHE.keys().next().value; // Map bewahrt Insertion-Order
    if (oldest !== undefined) AVM_CACHE.delete(oldest);
  }
  AVM_CACHE.set(key, { result: result, ts: Date.now() });
}

// ── gemeinsamer Handler ──────────────────────────────────────────────────────
async function runProvider(provider, req, res, next) {
  if (!providerEnabled(provider)) return res.status(409).json({ error: 'provider_coming_soon', coming_soon: true, provider: provider, message: 'Dieser Anbieter ist derzeit noch nicht verfügbar (demnächst).' });
  try {
    if (!avmEnabled()) {
      return res.status(503).json({ error: 'avm_disabled', disabled: true, message: 'AVM-Abruf ist derzeit deaktiviert.' });
    }
    const inputs = (req.body || {}).inputs || (req.body || {});
    const miss = missingFields(provider, inputs);
    if (miss.length) {
      return res.status(400).json({ error: 'missing_fields', missing_fields: miss, message: 'Es fehlen Pflichtfelder: ' + miss.join(', ') });
    }

    const mode = await modeForUser(req.user.id);
    const cost = costFor(provider, inputs);

    // v480: Cache-Treffer im Live-Modus -> kostenlos, kein API-Call, kein Credit-Abzug.
    let cacheKey = null;
    if (mode === 'live') {
      cacheKey = _cacheKey(req.user.id, provider, inputs);
      const hit = _cacheGet(cacheKey);
      if (hit) {
        return res.json({ ok: true, mode: mode, cost: 0, cached: true, result: hit });
      }
    }

    // Credit-Pre-Check NUR im Live-Modus (Stub ist kostenlos).
    if (mode === 'live') {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < cost) {
        return res.status(402).json({
          error: 'Nicht genug Kerosin im Tank.',
          needs_credits: true,
          required: cost,
          credits: status
        });
      }
    }

    // Abruf
    let result;
    if (mode === 'stub') {
      result = provider === 'pricehubble' ? stub.pricehubbleStub(inputs) : stub.sprengnetterStub(inputs);
    } else {
      const client = provider === 'pricehubble' ? pricehubble : sprengnetter;
      result = await client.valuate(inputs);
      if (cacheKey) _cacheSet(cacheKey, result); // v480: Ergebnis cachen
    }

    // Credits abziehen NUR im Live-Modus nach Erfolg.
    if (mode === 'live') {
      try {
        await aiCreditsService.consume(req.user.id, cost, 'avm:' + provider, { cost: cost, mode: mode });
      } catch (e) {
        console.warn('[avm/' + provider + '] credits consume failed:', e.message);
      }
    }

    res.json({ ok: true, mode: mode, cost: (mode === 'stub' ? 0 : cost), cached: false, result: result });
  } catch (err) {
    if (err.code === 'AVM_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'avm_not_configured', message: err.message });
    }
    if (err.status === 401) {
      return res.status(502).json({ error: 'avm_auth_failed', message: 'AVM-Anbieter-Authentifizierung fehlgeschlagen.' });
    }
    if (err.status) {
      return res.status(502).json({ error: 'avm_provider_error', message: err.message });
    }
    next(err);
  }
}

// ── POST /sprengnetter ────────────────────────────────────────────────────────
router.post('/sprengnetter', authenticate, function (req, res, next) { return runProvider('sprengnetter', req, res, next); });

// ── POST /pricehubble ─────────────────────────────────────────────────────────
router.post('/pricehubble', authenticate, function (req, res, next) { return runProvider('pricehubble', req, res, next); });

module.exports = router;
