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

// Credit-Kosten je Provider. Sprengnetter: 3 mit Kaufpreis (inkl. Fair-Price-Label),
// 2 ohne. PriceHubble: 1 (bündelt alles in einem Call).
const COST = { pricehubble: 1, sprengnetter_full: 1, sprengnetter_nokp: 1 };

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
      pricehubble: { enabled: enabled, configured: pricehubble.isConfigured() },
      sprengnetter: { enabled: enabled, configured: sprengnetter.isConfigured() }
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
    const status = await avmCreditsService.getStatus(req.user.id);
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

// ── gemeinsamer Handler ──────────────────────────────────────────────────────
async function runProvider(provider, req, res, next) {
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

    // Credit-Pre-Check NUR im Live-Modus (Stub ist kostenlos).
    if (mode === 'live') {
      const status = await avmCreditsService.getStatus(req.user.id);
      if (status.total_remaining < cost) {
        return res.status(402).json({
          error: 'Keine ausreichenden Credits.',
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
    }

    // Credits abziehen NUR im Live-Modus nach Erfolg.
    if (mode === 'live') {
      try {
        await avmCreditsService.consume(req.user.id, cost, 'avm:' + provider, { cost: cost, mode: mode });
      } catch (e) {
        console.warn('[avm/' + provider + '] credits consume failed:', e.message);
      }
    }

    res.json({ ok: true, mode: mode, cost: (mode === 'stub' ? 0 : cost), result: result });
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
