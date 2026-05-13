'use strict';
/**
 * Plan-limit enforcement middleware
 *
 * Use these to gate endpoints based on subscription plan:
 *
 *   // Block if user can't create another object
 *   router.post('/objects', authenticate, requireUnderLimit('objects'), ...);
 *
 *   // Block if user has used up their AI quota this month
 *   router.post('/ai-analysis', authenticate, requireUnderLimit('ai_analyses_monthly'), ...);
 *
 *   // Require a specific feature flag
 *   router.post('/api-key', authenticate, requireFeature('api_access'), ...);
 */

const subscriptionService = require('../services/subscriptionService');
const usageService = require('../services/usageService');
const { query } = require('../db/pool');
const { HttpError } = require('./errors');

/**
 * Block request if user is over their plan's limit for `metric`.
 *
 * Supported metrics:
 *   - 'objects'              → limit on total objects (counted from DB)
 *   - 'ai_analyses_monthly'  → counts usage_counters this month
 *   - 'pdf_exports_monthly'  → counts usage_counters this month
 *
 * For monthly metrics, this middleware does NOT increment the counter -
 * the route handler must call usageService.incrementUsage() after a successful action.
 */
function requireUnderLimit(metric) {
  return async (req, res, next) => {
    try {
      const plan = await subscriptionService.getEffectivePlan(req.user.id);

      let limit, current;
      if (metric === 'objects') {
        limit = plan.max_objects;
        if (limit == null) return next(); // unlimited
        const r = await query('SELECT COUNT(*) AS cnt FROM objects WHERE user_id = $1', [req.user.id]);
        current = parseInt(r.rows[0].cnt, 10);
      } else if (metric === 'ai_analyses_monthly') {
        limit = plan.max_ai_analyses_monthly;
        if (limit == null) return next();
        const usage = await usageService.getCurrentMonthUsage(req.user.id);
        current = usage.ai_analysis || 0;
      } else if (metric === 'pdf_exports_monthly') {
        limit = plan.max_pdf_exports_monthly;
        if (limit == null) return next();
        const usage = await usageService.getCurrentMonthUsage(req.user.id);
        current = usage.pdf_export || 0;
      } else {
        return next(); // unknown metric → don't block
      }

      if (current >= limit) {
        return res.status(403).json({
          error: 'Plan limit reached',
          metric,
          current,
          limit,
          plan_id: plan.plan_id,
          upgrade_required: true
        });
      }
      next();
    } catch (err) { next(err); }
  };
}

/**
 * Block request unless the user's plan has the given feature enabled.
 * Features are defined in the plans.features JSONB column.
 */
function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const plan = await subscriptionService.getEffectivePlan(req.user.id);
      if (!plan.plan_features || !plan.plan_features[featureKey]) {
        return res.status(403).json({
          error: `Feature '${featureKey}' is not available on your plan`,
          plan_id: plan.plan_id,
          upgrade_required: true
        });
      }
      next();
    } catch (err) { next(err); }
  };
}

/**
 * Block request unless user has an active paid subscription.
 * (Free users get blocked.)
 */
function requirePaidPlan(req, res, next) {
  subscriptionService.getEffectivePlan(req.user.id)
    .then(plan => {
      if (plan.plan_id === 'free') {
        return res.status(403).json({
          error: 'This feature requires a paid subscription',
          plan_id: plan.plan_id,
          upgrade_required: true
        });
      }
      next();
    })
    .catch(next);
}

module.exports = {
  requireUnderLimit,
  requireFeature,
  requirePaidPlan
};
