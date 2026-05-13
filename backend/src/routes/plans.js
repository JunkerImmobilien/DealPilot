'use strict';
const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const planService = require('../services/planService');

const router = express.Router();

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
