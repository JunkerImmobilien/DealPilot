'use strict';
const { query } = require('../db/pool');
const { HttpError } = require('../middleware/errors');

// In-memory cache (plans rarely change). Refresh on demand or every N minutes.
let _planCache = null;
let _planCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function refreshCache() {
  // V24: Holt alle aktiven Pläne (auch nicht-listbare wie 'enterprise' für
  // existing Subscriptions). Für die Pricing-Page wird zusätzlich is_listed gefiltert.
  const r = await query(
    'SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC'
  );
  _planCache = {};
  for (const row of r.rows) _planCache[row.id] = row;
  _planCacheTime = Date.now();
}

async function getPlanCache() {
  if (!_planCache || (Date.now() - _planCacheTime) > CACHE_TTL_MS) {
    await refreshCache();
  }
  return _planCache;
}

/**
 * Get a plan by id. Returns null if not found.
 */
async function getPlan(planId) {
  const cache = await getPlanCache();
  return cache[planId] || null;
}

/**
 * List all active public plans (for pricing page).
 * V24: zusätzlich is_listed = true (Enterprise wird nicht mehr im UI gezeigt).
 */
async function listPublicPlans() {
  const cache = await getPlanCache();
  return Object.values(cache).filter(p => p.is_public && (p.is_listed !== false));
}

/**
 * List all plans (admin only).
 */
async function listAllPlans() {
  const r = await query('SELECT * FROM plans ORDER BY sort_order ASC');
  return r.rows;
}

/**
 * Update a plan (admin). Use sparingly - this affects pricing for everyone.
 */
async function updatePlan(planId, fields) {
  const allowedFields = [
    'name', 'description', 'is_active', 'is_public',
    'price_monthly_cents', 'price_yearly_cents',
    'stripe_product_id', 'stripe_price_monthly_id', 'stripe_price_yearly_id',
    'max_objects', 'max_users', 'max_ai_analyses_monthly',
    'max_pdf_exports_monthly', 'max_photo_uploads_per_object',
    'features', 'sort_order'
  ];
  const updates = [];
  const values = [];
  let i = 1;
  for (const k of allowedFields) {
    if (fields[k] !== undefined) {
      updates.push(`${k} = $${i++}`);
      values.push(k === 'features' ? JSON.stringify(fields[k]) : fields[k]);
    }
  }
  if (updates.length === 0) throw new HttpError(400, 'No fields to update');
  values.push(planId);
  await query(
    `UPDATE plans SET ${updates.join(', ')} WHERE id = $${i}`,
    values
  );
  _planCache = null; // invalidate cache
}

/**
 * Admin-Funktion: Plan eines Users manuell setzen (ohne Stripe).
 * Wird von POST /api/v1/admin/users/:id/plan aufgerufen.
 *
 * @param {string} userId
 * @param {string} planId  z.B. 'pro', 'business'
 * @param {string} interval  'monthly' | 'yearly'
 * @param {number} durationDays  z.B. 30 oder 365 (Default: 30 für monthly, 365 für yearly)
 */
async function setUserPlanManual(userId, planId, interval, durationDays) {
  if (!planId) throw new HttpError(400, 'planId required');
  const plan = await getPlan(planId);
  if (!plan) throw new HttpError(404, 'Plan not found');
  interval = interval === 'yearly' ? 'yearly' : 'monthly';
  const days = durationDays || (interval === 'yearly' ? 365 : 30);
  await query(
    `INSERT INTO subscriptions
       (user_id, plan_id, billing_interval, status,
        current_period_start, current_period_end)
     VALUES ($1, $2, $3, 'active', NOW(), NOW() + ($4 || ' days')::interval)
     ON CONFLICT (user_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       billing_interval = EXCLUDED.billing_interval,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       canceled_at = NULL,
       ended_at = NULL`,
    [userId, planId, interval, String(days)]
  );
  return { userId, planId, interval, durationDays: days };
}

/**
 * Liefert den aktiven Plan eines Users (oder 'free' wenn keine Subscription).
 * V63.28: Legacy-Plan-IDs ('business', 'enterprise') werden auf 'free' gemappt
 *         — diese Pläne existieren nicht mehr im aktuellen Pricing-Schema.
 */
async function getUserCurrentPlan(userId) {
  const r = await query(
    `SELECT s.plan_id, s.billing_interval, s.status, s.current_period_end
       FROM subscriptions s
      WHERE s.user_id = $1
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
      LIMIT 1`,
    [userId]
  );
  if (r.rowCount === 0) return { planId: 'free', interval: 'monthly', status: 'active' };
  let planId = r.rows[0].plan_id;
  // V63.28: Legacy-Schutz
  if (planId === 'business' || planId === 'enterprise') {
    planId = 'free';
  }
  return {
    planId: planId,
    interval: r.rows[0].billing_interval,
    status: r.rows[0].status,
    expiresAt: r.rows[0].current_period_end
  };
}

module.exports = {
  getPlan,
  listPublicPlans,
  listAllPlans,
  updatePlan,
  refreshCache,
  setUserPlanManual,
  getUserCurrentPlan
};
