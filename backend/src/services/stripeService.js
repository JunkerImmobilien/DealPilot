'use strict';
/**
 * Stripe Service
 *
 * Handles all Stripe API interactions: customer creation, checkout sessions,
 * customer portal, and webhook signature verification.
 *
 * Designed to fail gracefully if Stripe is not configured - in that case
 * paid plans simply aren't available, but the rest of the app works.
 */

const config = require('../config');
const { HttpError } = require('../middleware/errors');

let _stripe = null;

function getStripe() {
  if (_stripe) return _stripe;
  if (!config.stripe.secretKey) {
    throw new HttpError(503, 'Stripe is not configured on this server');
  }
  // Lazy-load only if needed (so backend starts without stripe key)
  const Stripe = require('stripe');
  _stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'Junker Immobilien Backend',
      version: '1.0.0'
    }
  });
  return _stripe;
}

function isConfigured() {
  return Boolean(config.stripe.secretKey);
}

/**
 * Create or retrieve a Stripe customer for a user.
 * Idempotent - if customer exists, returns it.
 */
async function getOrCreateCustomer({ userId, email, name }) {
  const stripe = getStripe();
  const subscriptionService = require('./subscriptionService');

  const existing = await subscriptionService.getStripeCustomerId(userId);
  if (existing) {
    try {
      const c = await stripe.customers.retrieve(existing);
      if (!c.deleted) return c;
    } catch (e) {
      // Customer was deleted in Stripe - create a new one
    }
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId }
  });

  await subscriptionService.linkStripeCustomer({
    userId,
    stripeCustomerId: customer.id,
    email
  });

  return customer;
}

/**
 * Create a Stripe Checkout Session for subscribing to a plan.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.email
 * @param {string} params.name
 * @param {string} params.priceId - Stripe price id (from plans table)
 * @param {string} params.successUrl
 * @param {string} params.cancelUrl
 * @returns {Promise<{url: string, sessionId: string}>}
 */
async function createCheckoutSession({ userId, email, name, priceId, successUrl, cancelUrl }) {
  const stripe = getStripe();
  const customer = await getOrCreateCustomer({ userId, email, name });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    automatic_tax: { enabled: false }, // Enable when Stripe Tax is configured
    subscription_data: {
      metadata: { userId }
    },
    metadata: { userId }
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Create a customer portal session (for managing subscription, invoices, etc.).
 */
async function createPortalSession({ userId, returnUrl }) {
  const stripe = getStripe();
  const subscriptionService = require('./subscriptionService');
  const customerId = await subscriptionService.getStripeCustomerId(userId);
  if (!customerId) {
    throw new HttpError(400, 'No Stripe customer linked to this account');
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });
  return { url: session.url };
}

/**
 * Verify a webhook signature and parse the event.
 * Throws if signature is invalid.
 */
function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  if (!config.stripe.webhookSecret) {
    throw new HttpError(503, 'Stripe webhook secret not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}

/**
 * Retrieve a Stripe subscription by id.
 */
async function getSubscription(stripeSubscriptionId) {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['items.data.price']
  });
}

/**
 * Find which plan_id and billing_interval matches a Stripe price.
 * Looks up our plans table to find the match.
 */
async function resolvePlanFromPriceId(stripePriceId) {
  const { query } = require('../db/pool');
  const r = await query(
    `SELECT id AS plan_id,
       CASE
         WHEN stripe_price_monthly_id = $1 THEN 'monthly'
         WHEN stripe_price_yearly_id = $1 THEN 'yearly'
       END AS billing_interval
     FROM plans
     WHERE stripe_price_monthly_id = $1 OR stripe_price_yearly_id = $1
     LIMIT 1`,
    [stripePriceId]
  );
  return r.rows[0] || null;
}

module.exports = {
  isConfigured,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  getSubscription,
  resolvePlanFromPriceId
};
