'use strict';
/**
 * routes/resellerPortal.js — Partner-Portal-API (Paket 3)
 * Mount: /api/v1/reseller   (distinkt von V200 resellerRoutes an /api/v1)
 * Gate:  authenticate + requireFeature('reseller')  -> nur Partner-Plan
 *
 * Pool-Kauf via Stripe-Checkout (Seat-Preis + quantity, metadata.kind=partner_seats).
 * Direkter Stripe-SDK-Call wie in credits.js — kein stripeService-Umbau nötig.
 */

const express = require('express');
const Stripe = require('stripe');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planLimits');
const reseller = require('../services/resellerService');
const inviteMail = require('../services/resellerInviteMail');
const { query } = require('../db/pool');

const router = express.Router();

function inviteBase(req) {
  return process.env.FRONTEND_BASE_URL || process.env.APP_URL || process.env.FRONTEND_URL || ('https://' + req.headers.host);
}

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
const SEAT_PRICE = {
  monthly: process.env.STRIPE_PRICE_MANDANT_SEAT_MONTHLY,
  yearly:  process.env.STRIPE_PRICE_MANDANT_SEAT_YEARLY
};

router.use(authenticate);
router.use(requireFeature('reseller'));

// Reseller-Kontext auto-provisionieren (erste Portal-Nutzung legt die Zeile an)
router.use(async (req, res, next) => {
  try {
    req.reseller = await reseller.ensureReseller(req.user.id, { name: req.user.name });
    next();
  } catch (e) { next(e); }
});

function appBase(req) {
  return process.env.APP_URL || process.env.FRONTEND_URL || ('https://' + req.headers.host);
}

// GET /reseller/pool[?refresh=1]  — Pool-Status (optional frisch aus Stripe)
router.get('/pool', async (req, res, next) => {
  try {
    if (req.query.refresh && req.reseller.stripe_subscription_id && stripe) {
      try {
        const sub = await stripe.subscriptions.retrieve(req.reseller.stripe_subscription_id, {
          expand: ['items.data.price']
        });
        const item = sub.items && sub.items.data && sub.items.data[0];
        await reseller.syncPoolQuantity(req.reseller.id, item ? item.quantity : 0, {
          interval: item && item.price && item.price.recurring && item.price.recurring.interval === 'year' ? 'yearly' : 'monthly',
          stripeSubscriptionId: sub.id,
          stripeSubscriptionItemId: item && item.id,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null
        });
      } catch (e) { console.error('[reseller/pool] stripe-sync:', e.message); }
    }
    res.json({
      reseller: {
        id: req.reseller.id, name: req.reseller.name, role: req.reseller.role,
        whitelabel_enabled: req.reseller.whitelabel_enabled
      },
      pool: await reseller.getPool(req.reseller.id)
    });
  } catch (e) { next(e); }
});

// POST /reseller/seats/checkout  { quantity, interval }
router.post('/seats/checkout', async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'stripe_not_configured' });
    const quantity = Math.max(1, parseInt(req.body && req.body.quantity, 10) || 0);
    const interval = (req.body && req.body.interval) === 'yearly' ? 'yearly' : 'monthly';
    const price = SEAT_PRICE[interval];
    if (!price) return res.status(503).json({ error: 'seat_price_not_configured', message: 'STRIPE_PRICE_MANDANT_SEAT_* fehlt in der .env' });

    const base = appBase(req);
    const meta = { kind: 'partner_seats', reseller_id: req.reseller.id, userId: req.user.id };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity }],
      metadata: meta,
      subscription_data: { metadata: meta },
      client_reference_id: req.user.id,
      success_url: base + '/?reseller_pool=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  base + '/?reseller_pool=cancel',
      locale: 'de'
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (e) { next(e); }
});

// POST /reseller/pool/confirm  { sessionId }  — nach Checkout-Return
router.post('/pool/confirm', async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'stripe_not_configured' });
    const sessionId = req.body && req.body.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId_required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session.metadata || session.metadata.kind !== 'partner_seats') {
      return res.status(400).json({ error: 'not_a_seat_session' });
    }
    const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription && session.subscription.id);
    if (!subId) return res.status(400).json({ error: 'no_subscription_yet' });
    // Subscription EXPLIZIT holen -> items/quantity sind zuverlässig vorhanden
    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
    const item = sub.items && sub.items.data && sub.items.data[0];
    const pool = await reseller.syncPoolQuantity(req.reseller.id, item ? item.quantity : 0, {
      interval: item && item.price && item.price.recurring && item.price.recurring.interval === 'year' ? 'yearly' : 'monthly',
      stripeSubscriptionId: sub && sub.id,
      stripeSubscriptionItemId: item && item.id,
      currentPeriodEnd: sub && sub.current_period_end ? new Date(sub.current_period_end * 1000) : null
    });
    res.json({ ok: true, pool });
  } catch (e) { next(e); }
});

// ── Clients / Mandanten ─────────────────────────────────────────
router.get('/clients', async (req, res, next) => {
  try {
    res.json({
      clients: await reseller.listClients(req.reseller.id),
      invites: await reseller.listInvites(req.reseller.id)
    });
  } catch (e) { next(e); }
});

// Mandant per E-Mail einladen (Self-Signup-Link)
router.post('/clients', async (req, res, next) => {
  try {
    const { email, displayName } = req.body || {};
    if (!email || !displayName) return res.status(400).json({ error: 'email_and_displayName_required' });
    const invite = await reseller.createInvite(req.reseller.id, { email, displayName, invitedBy: req.user.id });

    // Reseller-Branding für die Mail laden
    let brand = {};
    try {
      const r = await query(
        `SELECT name, brand_name, brand_logo_b64, brand_accent, whitelabel_enabled FROM resellers WHERE id=$1`,
        [req.reseller.id]
      );
      brand = r.rows[0] || {};
    } catch (e) {}

    const link = inviteBase(req) + '/?rp_invite=' + encodeURIComponent(invite.token);
    let mail = { skipped: true };
    try { mail = await inviteMail.sendInvite({ email, displayName, link, reseller: brand }); }
    catch (e) { console.error('[reseller] invite-mail:', e.message); }

    res.json({ ok: true, invite: { id: invite.id, email: invite.email, display_name: invite.display_name }, mail_sent: !mail.skipped });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

router.post('/invites/:id/revoke', async (req, res, next) => {
  try { res.json({ ok: await reseller.revokeInvite(req.reseller.id, req.params.id) }); }
  catch (e) { next(e); }
});

router.post('/clients/:id/assign', async (req, res, next) => {
  try { res.json({ license: await reseller.assignSeat(req.reseller.id, req.params.id) }); }
  catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

router.post('/clients/:id/unassign', async (req, res, next) => {
  try { res.json({ license: await reseller.unassignSeat(req.reseller.id, req.params.id) }); }
  catch (e) { next(e); }
});

router.get('/mandanten', async (req, res, next) => {
  try { res.json({ mandanten: await reseller.listMandanten(req.reseller.id) }); }
  catch (e) { next(e); }
});

// ── Freigaben (Reseller-Sicht) ──────────────────────────────────
router.get('/shares', async (req, res, next) => {
  try { res.json({ shares: await reseller.listSharesForReseller(req.reseller.id) }); }
  catch (e) { next(e); }
});
router.get('/shares/:id/object', async (req, res, next) => {
  try { res.json({ object: await reseller.getSharedObject(req.reseller.id, req.params.id) }); }
  catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});
router.post('/shares/:id/review', async (req, res, next) => {
  try {
    const decision = (req.body && req.body.decision) === 'bestaetigt' ? 'bestaetigt' : 'zurueckgegeben';
    res.json({ share: await reseller.reviewShare(req.reseller.id, req.params.id, { decision, actorUserId: req.user.id }) });
  } catch (e) { next(e); }
});

router.post('/shares/:id/revoke', async (req, res, next) => {
  try { res.json({ share: await reseller.revokeShare(req.reseller.id, req.params.id, req.user.id) }); }
  catch (e) { next(e); }
});

router.post('/clients/:id/remove', async (req, res, next) => {
  try { res.json(await reseller.deleteClient(req.reseller.id, req.params.id)); }
  catch (e) { next(e); }
});

// ── Whitelabel-Branding ─────────────────────────────────────
router.get('/branding', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT brand_name, whitelabel_enabled, brand_logo_b64, brand_accent, brand_accent_hi, brand_accent_lo, brand_obsidian
         FROM resellers WHERE id=$1`, [req.reseller.id]);
    res.json({ branding: r.rows[0] || {} });
  } catch (e) { next(e); }
});

router.put('/branding', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = String(b.brand_name || '').slice(0, 120);
    const wl = !!b.whitelabel_enabled;
    const accent = /^#[0-9a-fA-F]{6}$/.test(b.brand_accent || '') ? b.brand_accent : null;
    const accentHi = /^#[0-9a-fA-F]{6}$/.test(b.brand_accent_hi || '') ? b.brand_accent_hi : null;
    const accentLo = /^#[0-9a-fA-F]{6}$/.test(b.brand_accent_lo || '') ? b.brand_accent_lo : null;
    const obsidian = /^#[0-9a-fA-F]{6}$/.test(b.brand_obsidian || '') ? b.brand_obsidian : null;
    let logo = b.brand_logo_b64;
    if (logo === '' || logo === null) { logo = ''; }               // explizit entfernen
    else if (typeof logo === 'string') {
      if (logo.length > 400000) return res.status(413).json({ error: 'logo_too_large', message: 'Logo zu groß (max ~300 KB).' });
      if (!/^data:image\//.test(logo)) return res.status(400).json({ error: 'logo_invalid', message: 'Ungültiges Bildformat.' });
    } else { logo = undefined; }                                    // nicht geändert

    await query(
      `UPDATE resellers SET
         brand_name = $2,
         whitelabel_enabled = $3,
         brand_accent    = COALESCE($4, brand_accent),
         brand_accent_hi = COALESCE($5, brand_accent_hi),
         brand_accent_lo = COALESCE($6, brand_accent_lo),
         brand_obsidian  = COALESCE($8, brand_obsidian),
         brand_logo_b64  = CASE WHEN $7::text IS NULL THEN brand_logo_b64
                                WHEN $7 = '' THEN NULL ELSE $7 END,
         updated_at = now()
       WHERE id = $1`,
      [req.reseller.id, name, wl, accent, accentHi, accentLo, (logo === undefined ? null : logo), obsidian]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
