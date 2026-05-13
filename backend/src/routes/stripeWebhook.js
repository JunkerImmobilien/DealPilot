'use strict';
/**
 * Stripe Webhook Handler
 *
 * IMPORTANT: This route uses the RAW request body (Buffer), not parsed JSON.
 * It must be mounted BEFORE express.json() in index.js.
 *
 * Stripe sends events like:
 *   - checkout.session.completed       → user finished checkout
 *   - customer.subscription.created    → subscription is live
 *   - customer.subscription.updated    → status changed (e.g., past_due, canceled)
 *   - customer.subscription.deleted    → subscription ended
 *   - invoice.payment_failed           → payment failed (status -> past_due)
 *
 * We use the stripe_webhook_events table for IDEMPOTENCY:
 * if Stripe retries an event, we won't process it twice.
 */

const express = require('express');
const { query } = require('../db/pool');
const stripeService = require('../services/stripeService');
const subscriptionService = require('../services/subscriptionService');

const router = express.Router();

// Raw body parser ONLY for this route
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature header');

  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('✗ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook signature failed: ${err.message}`);
  }

  // Idempotency: have we processed this event before?
  const existing = await query(
    'SELECT id, processed_at FROM stripe_webhook_events WHERE id = $1',
    [event.id]
  );
  if (existing.rowCount > 0 && existing.rows[0].processed_at) {
    // Already processed - return 200 so Stripe stops retrying
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Log event
  await query(
    `INSERT INTO stripe_webhook_events (id, type, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
    [event.id, event.type, event]
  );

  // Process the event
  try {
    await handleEvent(event);
    await query(
      'UPDATE stripe_webhook_events SET processed_at = NOW() WHERE id = $1',
      [event.id]
    );
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`✗ Error processing ${event.type}:`, err.message);
    await query(
      'UPDATE stripe_webhook_events SET error = $2 WHERE id = $1',
      [event.id, err.message]
    );
    // Return 500 so Stripe retries
    res.status(500).send('Internal error processing webhook');
  }
});

async function handleEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      // Customer completed checkout - subscription should now exist
      const session = event.data.object;
      if (session.mode !== 'subscription') return;

      const userId = session.metadata?.userId || session.subscription_data?.metadata?.userId;
      if (!userId) {
        console.warn('Checkout completed but no userId in metadata:', session.id);
        return;
      }

      // Fetch the full subscription from Stripe to get all details
      const sub = await stripeService.getSubscription(session.subscription);
      const priceId = sub.items.data[0]?.price?.id;
      const planMap = await stripeService.resolvePlanFromPriceId(priceId);
      if (!planMap) {
        console.warn('Could not resolve plan for price:', priceId);
        return;
      }

      // Ensure customer is linked
      await subscriptionService.linkStripeCustomer({
        userId,
        stripeCustomerId: session.customer,
        email: session.customer_email || session.customer_details?.email
      });

      await subscriptionService.upsertFromStripe({
        userId,
        stripeSubscription: sub,
        planId: planMap.plan_id,
        billingInterval: planMap.billing_interval
      });

      console.log(`✓ Subscription created for user ${userId}: ${planMap.plan_id} (${planMap.billing_interval})`);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const userId = sub.metadata?.userId
        || await subscriptionService.findUserByStripeCustomerId(sub.customer);
      if (!userId) {
        console.warn(`Subscription event without resolvable userId: ${sub.id}`);
        return;
      }

      const priceId = sub.items.data[0]?.price?.id;
      const planMap = await stripeService.resolvePlanFromPriceId(priceId);
      if (!planMap) {
        console.warn(`Could not resolve plan for price ${priceId}`);
        return;
      }

      await subscriptionService.upsertFromStripe({
        userId,
        stripeSubscription: sub,
        planId: planMap.plan_id,
        billingInterval: planMap.billing_interval
      });

      console.log(`✓ Subscription ${event.type} for user ${userId}: status=${sub.status}, plan=${planMap.plan_id}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await subscriptionService.markCanceled({
        stripeSubscriptionId: sub.id,
        endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : new Date()
      });
      console.log(`✓ Subscription deleted: ${sub.id}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      // Invoice paid - subscription remains active. Stripe sends a subscription.updated
      // event after this anyway, so usually nothing to do here.
      // We could insert a "payment_received" audit log entry.
      break;
    }

    case 'invoice.payment_failed': {
      // Payment failed - subscription will move to past_due. Stripe sends subscription.updated.
      // Could trigger an email here in a follow-up version.
      break;
    }

    default:
      // Other events we currently ignore (customer.created, payment_method.attached, etc.)
      // Log but don't fail
      break;
  }
}

module.exports = router;
