'use strict';
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');

const subscriptionService = require('../services/subscriptionService');
const planService = require('../services/planService');
const usageService = require('../services/usageService');
const stripeService = require('../services/stripeService');

const router = express.Router();

router.use(authenticate);

// ── Schemas ──────────────────────────────────────────
const checkoutSchema = z.object({
  planId: z.string().min(1),
  billingInterval: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

const portalSchema = z.object({
  returnUrl: z.string().url().optional()
});

// ── Routes ───────────────────────────────────────────

/**
 * GET /subscription - current user's subscription status & plan limits
 */
router.get('/', async (req, res, next) => {
  try {
    const sub = await subscriptionService.getEffectivePlan(req.user.id);
    const usage = await usageService.getCurrentMonthUsage(req.user.id);
    res.json({
      subscription: {
        plan_id: sub.plan_id,
        plan_name: sub.plan_name,
        plan_features: sub.plan_features,
        billing_interval: sub.billing_interval,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        trial_end: sub.trial_end,
        is_active: subscriptionService.isActive(sub),
        synthetic: sub.synthetic || false,
        downgraded: sub.downgraded || false,
        limits: {
          max_objects: sub.max_objects,
          max_users: sub.max_users,
          max_ai_analyses_monthly: sub.max_ai_analyses_monthly,
          max_pdf_exports_monthly: sub.max_pdf_exports_monthly,
          max_photo_uploads_per_object: sub.max_photo_uploads_per_object
        },
        usage: usage
      }
    });
  } catch (err) { next(err); }
});

/**
 * POST /subscription/checkout
 * Creates a Stripe Checkout session for upgrading.
 * Body: { planId, billingInterval, successUrl?, cancelUrl? }
 * Returns: { url }
 */
router.post('/checkout', validate({ body: checkoutSchema }), async (req, res, next) => {
  try {
    if (!stripeService.isConfigured()) {
      throw new HttpError(503, 'Payment system is not configured. Please contact support.');
    }

    const plan = await planService.getPlan(req.body.planId);
    if (!plan) throw new HttpError(404, 'Plan not found');
    if (plan.id === 'free') throw new HttpError(400, 'Cannot subscribe to free plan');

    const priceId = req.body.billingInterval === 'yearly'
      ? plan.stripe_price_yearly_id
      : plan.stripe_price_monthly_id;
    if (!priceId) {
      throw new HttpError(503, `${plan.name} (${req.body.billingInterval}) is not yet available for purchase`);
    }

    const successUrl = req.body.successUrl || `${getFrontendBase(req)}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = req.body.cancelUrl || `${getFrontendBase(req)}/subscription/cancel`;

    const session = await stripeService.createCheckoutSession({
      userId: req.user.id,
      email: req.user.email,
      name: req.user.name,
      priceId,
      successUrl,
      cancelUrl
    });

    res.json({ url: session.url, sessionId: session.sessionId });
  } catch (err) { next(err); }
});

/**
 * POST /subscription/portal
 * Creates a Stripe Customer Portal session for managing subscription.
 */
router.post('/portal', validate({ body: portalSchema }), async (req, res, next) => {
  try {
    if (!stripeService.isConfigured()) {
      throw new HttpError(503, 'Payment system is not configured');
    }
    const returnUrl = req.body.returnUrl || `${getFrontendBase(req)}/account`;
    const session = await stripeService.createPortalSession({
      userId: req.user.id,
      returnUrl
    });
    res.json({ url: session.url });
  } catch (err) { next(err); }
});

function getFrontendBase(req) {
  // Best-effort guess. In production set FRONTEND_BASE_URL in config.
  return process.env.FRONTEND_BASE_URL ||
         req.headers.origin ||
         'http://localhost:8080';
}

/**
 * V63.92: POST /subscription/demo-change-plan
 *
 * V204 SECURITY-FIX (C1): Endpoint wird in Production deaktiviert.
 * Vorher konnte jeder eingeloggte User sich selbst auf jeden Plan
 * setzen (z.B. Pro statt Free) — kein Stripe-Check.
 *
 * Aktivierung jetzt nur wenn:
 *   - ENABLE_DEMO_PLAN_SWITCH=1 in .env (für Demo/Test-Modus)
 *   - ODER req.user.role === 'admin' (Marcel kann's für sich nutzen)
 *
 * Nach Stripe-Aktivierung (V205) sollte ENABLE_DEMO_PLAN_SWITCH=0 sein
 * und der echte /subscription/checkout-Pfad genutzt werden.
 *
 * Demo-Plan-Wechsel ohne Stripe. Schreibt direkt in die subscriptions-Tabelle
 * UND setzt die KI-Credits auf das neue Limit (current_period_used = 0,
 * Bonus-Credits bleiben erhalten — die hat der User bezahlt).
 *
 * Body: { planId: 'free'|'starter'|'investor'|'pro' }
 * Returns: { ok: true, demo: true, plan_id, credits: <neuer Credit-Status> }
 */
router.post('/demo-change-plan', async (req, res, next) => {
  try {
    // V204 SECURITY-FIX (C1): Plan-Switch nur erlauben wenn explizit aktiviert
    // oder Admin-Role. Sonst 403.
    const enableDemo = process.env.ENABLE_DEMO_PLAN_SWITCH === '1';
    const isAdmin    = req.user && req.user.role === 'admin';
    if (!enableDemo && !isAdmin) {
      return res.status(403).json({
        error: 'Plan-Wechsel über diesen Endpoint nicht erlaubt. Bitte den regulären Upgrade-Pfad nutzen.',
        code: 'DEMO_SWITCH_DISABLED'
      });
    }
    const { query } = require('../db/pool');
    const aiCreditsService = require('../services/aiCreditsService');
    const planId = String((req.body || {}).planId || '').toLowerCase();
    const VALID_PLANS = ['free', 'starter', 'investor', 'pro', 'business'];
    if (!VALID_PLANS.includes(planId)) {
      return res.status(400).json({ error: 'Ungültige planId. Erlaubt: ' + VALID_PLANS.join(', ') });
    }

    // Plan-Existenz prüfen
    const planExists = await query(`SELECT id FROM plans WHERE id = $1`, [planId]);
    if (!planExists.rowCount) {
      return res.status(404).json({ error: 'Plan "' + planId + '" existiert nicht in der Datenbank.' });
    }

    // Subscription upserten — Demo: status='active', stripe_-Felder bleiben NULL
    const userId = req.user.id;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (planId === 'free') {
      // Free → Subscription-Row löschen oder auf 'canceled' setzen
      await query(`
        UPDATE subscriptions
        SET plan_id = 'free', status = 'active', updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);
      // Falls keine Row existiert: das ist ok — kein INSERT nötig (synthetic-Free greift)
    } else {
      const upsert = await query(`
        UPDATE subscriptions
        SET plan_id = $2, status = 'active', billing_interval = 'monthly',
            current_period_start = $3, current_period_end = $4, updated_at = NOW()
        WHERE user_id = $1
      `, [userId, planId, now, periodEnd]);
      if (upsert.rowCount === 0) {
        await query(`
          INSERT INTO subscriptions (user_id, plan_id, status, billing_interval, current_period_start, current_period_end)
          VALUES ($1, $2, 'active', 'monthly', $3, $4)
        `, [userId, planId, now, periodEnd]);
      }
    }

    // Credits zurücksetzen — neuer Plan = neue Periode (current_period_used = 0)
    // Bonus-Credits bleiben erhalten (gekauft = bezahlt). Period-Start auf jetzt.
    await query(`
      INSERT INTO ai_credits_user (user_id) VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [userId]);
    await query(`
      UPDATE ai_credits_user
      SET current_period_used  = 0,
          current_period_start = date_trunc('month', NOW())::date,
          updated_at = NOW()
      WHERE user_id = $1
    `, [userId]);

    // Log-Eintrag damit nachvollziehbar bleibt
    try {
      await query(`
        INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta)
        VALUES ($1, 'demo_plan_change', 0, 'demo', $2)
      `, [userId, JSON.stringify({ new_plan: planId })]);
    } catch (e) { /* nicht kritisch */ }

    const credits = await aiCreditsService.getStatus(userId);
    res.json({ ok: true, demo: true, plan_id: planId, credits: credits });
  } catch (err) { next(err); }
});

module.exports = router;
