'use strict';
const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const planService = require('../services/planService');

const router = express.Router();

/* ── promo-erstflug ────────────────────────────────────────────────────
 * GET /plans/promo  — OEFFENTLICH (Landing + App, kein Token noetig).
 * Die Wahrheit ueber den Founding-Rabatt steht in STRIPE, nicht bei uns.
 * Kein aktiver Code / kein Stripe / Plaetze aufgebraucht -> active:false,
 * und das Frontend zeigt dann GAR NICHTS an (fail closed). Lieber keine
 * Werbung als ein Code, den es im aktuellen Stripe-Modus nicht gibt.
 * In-Memory-Cache 5 min, damit die Landing Stripe nicht flutet.
 * ------------------------------------------------------------------ */
const PROMO_CODE = process.env.PROMO_CODE || 'ERSTFLUG';
const PROMO_TTL_MS = 5 * 60 * 1000;
let _promoCache = null;
let _promoAt = 0;

async function _readPromoFromStripe() {
  const off = { active: false, code: PROMO_CODE };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return off;
  let stripe;
  try { stripe = require('stripe')(key); } catch (e) { return off; }

  const list = await stripe.promotionCodes.list({ code: PROMO_CODE, active: true, limit: 1 });
  const pc = list && list.data && list.data[0];
  if (!pc) return off;

  /* promo-coupon-resolve: Der Coupon haengt je nach Stripe-API-Version an einer
   * von drei Stellen. Frueher pc.coupon (Objekt), heute pc.promotion.coupon —
   * und zwar meist nur als ID-String. Alle Faelle abdecken, sonst faellt die
   * Funktion still auf active:false zurueck (genau das ist passiert). */
  let c = null;
  if (pc.coupon && typeof pc.coupon === 'object') {
    c = pc.coupon;
  } else if (pc.promotion && typeof pc.promotion.coupon === 'object' && pc.promotion.coupon) {
    c = pc.promotion.coupon;
  } else {
    const cid = (pc.promotion && typeof pc.promotion.coupon === 'string')
      ? pc.promotion.coupon
      : (typeof pc.coupon === 'string' ? pc.coupon : null);
    if (cid) {
      try { c = await stripe.coupons.retrieve(cid); }
      catch (e) { console.warn('[promo] coupon retrieve failed:', e.message); }
    }
  }
  if (!c || c.valid === false) return off;
  const percent = c.percent_off || 0;
  if (!percent) return off;                       // nur prozentuale Codes

  // Schranke kann am Promotion-Code ODER am Coupon haengen
  const hasPcMax = (pc.max_redemptions !== null && pc.max_redemptions !== undefined);
  const max  = hasPcMax ? pc.max_redemptions : (c.max_redemptions != null ? c.max_redemptions : null);
  const used = (hasPcMax ? pc.times_redeemed : c.times_redeemed) || 0;
  const left = (max != null) ? Math.max(0, max - used) : null;
  if (left !== null && left <= 0) return off;     // Plaetze weg -> Banner weg

  return {
    active: true,
    code: pc.code || PROMO_CODE,
    percent: percent,
    duration: c.duration || null,
    max: max,
    used: used,
    left: left
  };
}

router.get('/promo', async (req, res) => {
  try {
    if (_promoCache && (Date.now() - _promoAt) < PROMO_TTL_MS) {
      return res.json({ promo: _promoCache });
    }
    const p = await _readPromoFromStripe();
    _promoCache = p;
    _promoAt = Date.now();
    res.json({ promo: p });
  } catch (e) {
    console.warn('[promo] Stripe-Abfrage fehlgeschlagen:', e.message);
    res.json({ promo: { active: false, code: PROMO_CODE } });
  }
});
/* ── promo-erstflug ENDE ─────────────────────────────────────────── */

/**
 * GET /plans - public list of plans (for pricing page)
 */
router.get('/', async (req, res, next) => {
  try {
    const plans = await planService.listPublicPlans();
    res.json({ plans: plans.map(formatPlan) });
  } catch (err) { next(err); }
});

/**
 * GET /plans/all - all plans including inactive (admin)
 */
router.get('/all', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const plans = await planService.listAllPlans();
    res.json({ plans: plans.map(formatPlan) });
  } catch (err) { next(err); }
});

/**
 * V24: POST /plans/admin/users/:userId/plan
 * Admin setzt manuell einen Plan für einen User (ohne Stripe).
 * Body: { planId: 'pro', interval: 'yearly', durationDays?: 365 }
 */
router.post('/admin/users/:userId/plan', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { planId, interval, durationDays } = req.body || {};
    const result = await planService.setUserPlanManual(userId, planId, interval, durationDays);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

/**
 * V24: GET /plans/admin/users/:userId/plan — Aktueller Plan eines Users
 */
router.get('/admin/users/:userId/plan', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const cur = await planService.getUserCurrentPlan(req.params.userId);
    res.json(cur);
  } catch (err) { next(err); }
});

/**
 * Public-safe plan format. We don't expose Stripe ids on the public plan list.
 */
function formatPlan(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tagline: p.tagline,
    highlight: p.highlight,
    is_active: p.is_active,
    is_public: p.is_public,
    is_listed: p.is_listed !== false,
    price_monthly_cents: p.price_monthly_cents,
    price_yearly_cents: p.price_yearly_cents,
    has_stripe_monthly: Boolean(p.stripe_price_id_monthly || p.stripe_price_monthly_id),
    has_stripe_yearly: Boolean(p.stripe_price_id_yearly || p.stripe_price_yearly_id),
    max_objects: p.max_objects,
    max_users: p.max_users,
    max_ai_analyses_monthly: p.max_ai_analyses_monthly,
    max_pdf_exports_monthly: p.max_pdf_exports_monthly,
    max_photo_uploads_per_object: p.max_photo_uploads_per_object,
    features: p.features,
    sort_order: p.sort_order
  };
}

module.exports = router;
