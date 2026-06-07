'use strict';
/**
 * V197: Credit-Pack-Käufe via Stripe Checkout
 *
 * Endpoints:
 *   POST /api/v1/credits/checkout    — Stripe-Session erstellen
 *   GET  /api/v1/credits/packs        — Verfügbare Packs (für Frontend-Anzeige)
 *   GET  /api/v1/credits/purchases    — Eigene Kauf-Historie
 *   GET  /api/v1/credits/balance      — Aktueller Credit-Stand
 *
 * Wichtig:
 *   - Free-User können NICHT kaufen → 403 mit upgrade_required
 *   - Webhook (in /api/v1/webhooks/stripe) verbucht die Credits asynchron
 */

const express = require('express');
const Stripe = require('stripe');
const { CREDIT_PACKS, getPack, listPacks } = require('../services/creditPacks');
const avmPacks = require('../services/avmPacks');

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// User-Auth-Middleware
function requireUser(req, res, next) {
  // Wir nutzen die existierende User-Auth — JWT im Authorization-Header
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'auth_required' });
  }
  next();
}

/** Lädt die User-Auth-Middleware aus der app — flexibel je nach Projekt-Setup */
let userAuthMW;
try {
  // Standard-Pfad
  const auth = require('../middleware/auth');
  userAuthMW = auth.requireAuth || auth.authenticate || auth.default || null;
} catch (e) {
  console.warn('[credits] User-Auth-Middleware nicht gefunden:', e.message);
}

/** Wrapper: nutzt projekt-eigene Auth wenn vorhanden, sonst fallback */
function userAuth(req, res, next) {
  if (userAuthMW) return userAuthMW(req, res, next);
  return requireUser(req, res, next);
}

// ──────────────────────────────────────────────────────────
// GET /api/v1/credits/packs — Liste aller Packs
// ──────────────────────────────────────────────────────────

router.get('/packs', (req, res) => {
  // v491-kerosin-route: Kerosin-Packs in Litern (Tacho-Karten lesen liter/flight/reach/gauge)
  res.json({
    unit: 'liter',
    packs: listPacks().map(p => ({
      id: p.id,
      label: p.label,
      liter: p.liter,
      credits: p.credits,
      amount_cents: p.amount_cents,
      currency: p.currency,
      per_liter_cents: p.per_liter_cents,
      flight: p.flight,
      reach: p.reach,
      gauge: p.gauge,
      popular: p.popular
    }))
  });
});

// ──────────────────────────────────────────────────────────
// GET /api/v1/credits/balance
// ──────────────────────────────────────────────────────────

router.get('/avm-packs', (req, res) => {
  res.json({
    packs: avmPacks.listPacks().map(function (p) {
      return {
        id: p.id, kind: 'avm', label: p.label, credits: p.credits,
        amount_cents: p.amount_cents, currency: p.currency,
        price_per_call_cents: Math.round(p.amount_cents / p.credits),
        popular: p.popular
      };
    })
  });
});

router.get('/balance', userAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const r = await db.query(
      'SELECT current_period_used, bonus_credits, avm_bonus_credits FROM ai_credits_user WHERE user_id = $1',
      [req.user.id]
    );
    const row = r.rows[0] || { current_period_used: 0, bonus_credits: 0 };

    // Anfragen-Einheiten in der DB → Marketing-Credits umrechnen
    const bonus_marketing_credits = Math.floor((row.bonus_credits || 0) / 2);
    const bonus_requests_left = row.bonus_credits || 0;

    res.json({
      current_period_used: row.current_period_used || 0,
      bonus_credits: bonus_marketing_credits,   // wie auf Marketing-Seite (1=2 Anfragen)
      bonus_requests_left: bonus_requests_left,
      avm_credits: (row.avm_bonus_credits || 0)  // tatsächliche Anfragen die übrig sind
    });
  } catch (err) {
    console.error('[credits/balance] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/v1/credits/checkout
// ──────────────────────────────────────────────────────────

router.post('/checkout', userAuth, async (req, res) => {
  const db = req.app.get('db');
  const { pack_id } = req.body || {};

  if (!stripe) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }

  let pack = getPack(pack_id);
  let packKind = 'ki';
  if (!pack) { pack = avmPacks.getPack(pack_id); if (pack) packKind = 'avm'; }
  if (!pack) {
    return res.status(400).json({ error: 'invalid_pack', valid_packs: Object.keys(CREDIT_PACKS).concat(avmPacks.listPacks().map(function (p) { return p.id; })) });
  }
  // v491: bis die Kerosin-Produkte in Stripe angelegt sind (E3), sauber ablehnen
  if (!pack.stripe_price_id) {
    return res.status(503).json({
      error: 'stripe_price_missing',
      message: 'Kerosin-Kauf ist noch nicht freigeschaltet. (Stripe-Produkt fehlt — ENV STRIPE_PRICE_' + pack.id.toUpperCase() + ' setzen.)'
    });
  }

  try {
    // 1) Plan-Check: muss zahlender Plan sein (nicht Free)
    //    stripe_customer_id liegt in der separaten stripe_customers-Tabelle (nicht subscriptions)
    const planCheck = await db.query(`
      SELECT COALESCE(p.id, 'free') AS plan_id, COALESCE(p.name, 'Free') AS plan_name,
             sc.stripe_customer_id
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN stripe_customers sc ON sc.user_id = u.id
      WHERE u.id = $1
    `, [req.user.id]);
    const userPlan = planCheck.rows[0];

    if (!userPlan || userPlan.plan_id === 'free') {
      return res.status(403).json({
        error: 'upgrade_required',
        message: 'Kerosin kann nur ab dem Starter-Plan getankt werden. Bitte upgrade dein Abo.',
        upgrade_to: 'starter'
      });
    }

    // 2) User-Details für Stripe holen
    const userResult = await db.query(`
      SELECT id, email, name FROM users WHERE id = $1 AND deleted_at IS NULL
    `, [req.user.id]);
    if (!userResult.rowCount) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    const user = userResult.rows[0];

    // 3) Stripe-Checkout-Session erstellen
    const successBase = process.env.APP_URL || process.env.FRONTEND_URL || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price: pack.stripe_price_id,
        quantity: 1
      }],
      customer_email: !userPlan.stripe_customer_id ? user.email : undefined,
      customer: userPlan.stripe_customer_id || undefined,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        credits_granted: String(pack.credits),
        bonus_credits_units: String(pack.bonus_credits_units || pack.credits),
        kind: packKind,
        type: 'credit_pack'
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack_id: pack.id,
          credits_granted: String(pack.credits),
          type: 'credit_pack'
        }
      },
      success_url: `${successBase}/?credit_purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${successBase}/?credit_purchase=canceled`,
      locale: 'de'
    });

    // 4) Purchase-Eintrag (pending)
    await db.query(`
      INSERT INTO credit_purchases
        (user_id, pack_id, credits_granted, amount_cents, currency, stripe_session_id, status, kind)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
    `, [user.id, pack.id, pack.credits, pack.amount_cents, pack.currency, session.id, packKind]);

    res.json({
      url: session.url,
      session_id: session.id,
      pack: { id: pack.id, credits: pack.credits, amount_cents: pack.amount_cents }
    });
  } catch (err) {
    console.error('[credits/checkout] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/v1/credits/purchases — Eigene History
// ──────────────────────────────────────────────────────────

router.get('/purchases', userAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const r = await db.query(`
      SELECT id, pack_id, credits_granted, amount_cents, currency,
             status, created_at, completed_at
      FROM credit_purchases
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json({ purchases: r.rows });
  } catch (err) {
    console.error('[credits/purchases] error:', err);
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

module.exports = router;
