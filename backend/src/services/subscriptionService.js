'use strict';
const { query, transaction } = require('../db/pool');
const { HttpError } = require('../middleware/errors');
const planService = require('./planService');

/**
 * Get the current subscription for a user.
 * Returns synthetic 'free' subscription if user has no row.
 */
async function getCurrentSubscription(userId) {
  const r = await query(
    `SELECT s.*, p.name AS plan_name, p.features AS plan_features,
            p.max_objects, p.max_users, p.max_ai_analyses_monthly,
            p.max_pdf_exports_monthly, p.max_photo_uploads_per_object
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.user_id = $1`,
    [userId]
  );
  if (r.rowCount === 0) {
    // No subscription - user is on free plan
    const freePlan = await planService.getPlan('free');
    if (!freePlan) {
      throw new HttpError(500, 'Free plan not configured');
    }
    return {
      id: null,
      user_id: userId,
      plan_id: 'free',
      plan_name: freePlan.name,
      plan_features: freePlan.features,
      billing_interval: null,
      status: 'active',                      // Free is always 'active'
      cancel_at_period_end: false,
      current_period_start: null,
      current_period_end: null,
      trial_end: null,
      max_objects: freePlan.max_objects,
      max_users: freePlan.max_users,
      max_ai_analyses_monthly: freePlan.max_ai_analyses_monthly,
      max_pdf_exports_monthly: freePlan.max_pdf_exports_monthly,
      max_photo_uploads_per_object: freePlan.max_photo_uploads_per_object,
      synthetic: true                        // marker that this is the implicit free plan
    };
  }
  return r.rows[0];
}

/**
 * Check whether a subscription is currently active (allows access to paid features).
 * Active states: 'active', 'trialing'.
 * Past_due is grace period - we still treat it as active for ~7 days, but the user is warned.
 */
function isActive(sub) {
  if (!sub) return false;
  if (['active', 'trialing'].includes(sub.status)) return true;
  if (sub.status === 'past_due') {
    // Grace period: allow access for 7 days after period end
    if (sub.current_period_end) {
      const graceUntil = new Date(sub.current_period_end);
      graceUntil.setDate(graceUntil.getDate() + 7);
      return new Date() < graceUntil;
    }
  }
  return false;
}

/**
 * Get the EFFECTIVE plan for a user. If subscription is canceled/expired, falls back to free.
 */
async function getEffectivePlan(userId) {
  const sub = await getCurrentSubscription(userId);
  if (sub.synthetic) return sub; // already free
  if (isActive(sub)) return sub;
  // Subscription not active - downgrade to free
  const freePlan = await planService.getPlan('free');
  return {
    ...sub,
    plan_id: 'free',
    plan_name: freePlan.name,
    plan_features: freePlan.features,
    max_objects: freePlan.max_objects,
    max_users: freePlan.max_users,
    max_ai_analyses_monthly: freePlan.max_ai_analyses_monthly,
    max_pdf_exports_monthly: freePlan.max_pdf_exports_monthly,
    max_photo_uploads_per_object: freePlan.max_photo_uploads_per_object,
    downgraded: true
  };
}

/**
 * Upsert subscription from Stripe webhook event.
 * `stripeSubscription` is the Stripe subscription object.
 */
async function upsertFromStripe({ userId, stripeSubscription, planId, billingInterval }) {
  const data = {
    user_id: userId,
    plan_id: planId,
    billing_interval: billingInterval,
    status: stripeSubscription.status,
    cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
    current_period_start: stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000) : null,
    current_period_end: stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000) : null,
    trial_end: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000) : null,
    canceled_at: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000) : null,
    ended_at: stripeSubscription.ended_at
      ? new Date(stripeSubscription.ended_at * 1000) : null,
    stripe_subscription_id: stripeSubscription.id,
    stripe_price_id: stripeSubscription.items?.data?.[0]?.price?.id || null
  };

  await query(
    `INSERT INTO subscriptions
       (user_id, plan_id, billing_interval, status, cancel_at_period_end,
        current_period_start, current_period_end, trial_end, canceled_at, ended_at,
        stripe_subscription_id, stripe_price_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (user_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       billing_interval = EXCLUDED.billing_interval,
       status = EXCLUDED.status,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       trial_end = EXCLUDED.trial_end,
       canceled_at = EXCLUDED.canceled_at,
       ended_at = EXCLUDED.ended_at,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id`,
    [
      data.user_id, data.plan_id, data.billing_interval, data.status,
      data.cancel_at_period_end, data.current_period_start, data.current_period_end,
      data.trial_end, data.canceled_at, data.ended_at,
      data.stripe_subscription_id, data.stripe_price_id
    ]
  );
}

/**
 * Mark subscription as canceled in our DB (after Stripe confirms).
 */
async function markCanceled({ stripeSubscriptionId, endedAt }) {
  await query(
    `UPDATE subscriptions
     SET status = 'canceled', ended_at = $2
     WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId, endedAt || new Date()]
  );
}

/**
 * Find user by Stripe customer id (for webhook handlers).
 */
async function findUserByStripeCustomerId(stripeCustomerId) {
  const r = await query(
    'SELECT user_id FROM stripe_customers WHERE stripe_customer_id = $1',
    [stripeCustomerId]
  );
  return r.rows[0]?.user_id || null;
}

/**
 * Link a user to a Stripe customer.
 */
async function linkStripeCustomer({ userId, stripeCustomerId, email }) {
  await query(
    `INSERT INTO stripe_customers (user_id, stripe_customer_id, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       email = EXCLUDED.email`,
    [userId, stripeCustomerId, email]
  );
}

/**
 * Get Stripe customer id for a user (or null).
 */
async function getStripeCustomerId(userId) {
  const r = await query(
    'SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1',
    [userId]
  );
  return r.rows[0]?.stripe_customer_id || null;
}

module.exports = {
  getCurrentSubscription,
  getEffectivePlan,
  isActive,
  upsertFromStripe,
  markCanceled,
  findUserByStripeCustomerId,
  linkStripeCustomer,
  getStripeCustomerId
};
