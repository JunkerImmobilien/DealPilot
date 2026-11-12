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

/* ════════════════════════════════════════════════════════════════════════
   v1423 · Der Seat-Preis kommt aus dem lookup_key, nicht mehr aus der .env

   WAS AM 16.09.2026 GEMESSEN WURDE — in beiden Umgebungen falsch, auf je
   eigene Weise:
     Produktion zeigte auf price_1TtM0D… und buchte damit die ALTE Staffel
       35 / 29 / 24 EUR je Seat. Der gueltige Preis fuehrt 19 / 15 / 12.
       Die Landing verspricht seit Langem „ab 12 EUR je Mandant" — Prod
       hat also fast das Doppelte des beworbenen Preises abgerechnet.
     Staging zeigte auf einen ARCHIVIERTEN Preis. Stripe nimmt archivierte
       Preise im Checkout nicht an; ein Seat-Kauf konnte dort gar nicht
       gelingen.

   WARUM ES BEIDE MALE UNBEMERKT BLIEB: der Seat steht als einziger Preis
   NICHT in der Tabelle `plans`, sondern in der `.env`. Wer config.js,
   `plans` und die Portal-Konfiguration prueft, haelt alles fuer sauber und
   sieht ihn nie. Eine ID in einer Umgebungsvariablen altert still.

   DIE LOESUNG IST DIESELBE WIE BEI DEN BEWERTUNGSPAKETEN: der lookup_key
   ist umgebungsblind. Derselbe Name liefert mit dem Sandbox-Schluessel den
   Sandbox-Preis und mit dem Live-Schluessel den Live-Preis — und immer den
   AKTIVEN. Wird ein Preis geaendert, legt Stripe einen neuen an und der
   Name wandert mit; hier muss dann nichts nachgezogen werden.

   Die .env bleibt als Rueckfall stehen, damit ein Ausfall der Aufloesung
   nicht den ganzen Seat-Kauf blockiert. Sie ist ab jetzt aber die zweite
   Wahrheit, nicht die erste.
   ════════════════════════════════════════════════════════════════════ */
const SEAT_PRICE = {
  monthly: process.env.STRIPE_PRICE_MANDANT_SEAT_MONTHLY,
  yearly:  process.env.STRIPE_PRICE_MANDANT_SEAT_YEARLY
};
const SEAT_LOOKUP = { monthly: 'dp_seat_monthly', yearly: 'dp_seat_yearly' };
const seatCache = { monthly: null, yearly: null, bis: 0 };

async function seatPreisId(interval) {
  const jetzt = Date.now();
  if (seatCache[interval] && seatCache.bis > jetzt) return seatCache[interval];
  try {
    const r = await stripe.prices.list({
      lookup_keys: [SEAT_LOOKUP[interval]], active: true, limit: 1
    });
    if (r.data[0]) {
      seatCache[interval] = r.data[0].id;
      seatCache.bis = jetzt + 10 * 60 * 1000;   /* 10 Minuten */
      return r.data[0].id;
    }
  } catch (e) { /* Rueckfall unten */ }
  return SEAT_PRICE[interval] || null;
}

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
    const price = await seatPreisId(interval);
    if (!price) return res.status(503).json({ error: 'seat_price_not_configured', message: 'Kein Seat-Preis gefunden — weder unter dem lookup_key dp_seat_* noch in der .env' });

    const base = appBase(req);
    const meta = { kind: 'partner_seats', reseller_id: req.reseller.id, userId: req.user.id };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity }],
      metadata: meta,
      subscription_data: { metadata: meta },
      client_reference_id: req.user.id,
      /* v2248 · Anschrift fuer die Rechnung (Pflichtangabe) */
      billing_address_collection: 'required',
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
      /* v3299 · brand_mail_accent fehlte im SELECT (Befund 2g) - die eigene
         Mail-Farbe griff nie. Dazu Kontakt (Reply-To), Website (Fuss) und die
         Varianten-Spalte, damit die Mail eine gehostete Logo-Adresse bekommt. */
      const r = await query(
        `SELECT id, name, brand_name, brand_logo_b64, brand_accent, brand_mail_accent, whitelabel_enabled,
                brand_email, brand_website, brand_company,
                (brand_logo_auf_dunkel IS NOT NULL) AS hat_variante,
                extract(epoch from updated_at)::bigint AS stand
           FROM resellers WHERE id=$1`,
        [req.reseller.id]
      );
      brand = r.rows[0] || {};
      brand.basis = inviteBase(req);
    } catch (e) {}

    const link = inviteBase(req) + '/?rp_invite=' + encodeURIComponent(invite.token);
    let mail = { skipped: true };
    try { mail = await inviteMail.sendInvite({ email, displayName, link, reseller: brand }); }
    catch (e) { console.error('[reseller] invite-mail:', e.message); }

    res.json({ ok: true, invite: { id: invite.id, email: invite.email, display_name: invite.display_name }, mail_sent: !mail.skipped });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

// ── v3317 · Objekt an Kunden uebergeben (Partnerseite, services/objektUebergabe.js) ──
const uebergabe = require('../services/objektUebergabe');
router.get('/uebergaben', async (req, res, next) => {
  try { res.json({ uebergaben: await uebergabe.liste(req.reseller.id), pool: await reseller.getPool(req.reseller.id) }); }
  catch (e) { next(e); }
});
/* Vor dem Senden: bestehender Mandant? freier Platz? - der Dialog sagt es, bevor etwas rausgeht */
router.get('/uebergaben/vorpruefung', async (req, res, next) => {
  try {
    const email = String((req.query && req.query.email) || '').trim();
    if (!email) return res.status(400).json({ error: 'email_required' });
    res.json(await uebergabe.vorpruefung(req.reseller.id, email));
  } catch (e) { next(e); }
});
router.post('/uebergaben', async (req, res, next) => {
  try {
    const b = req.body || {};
    const r = await uebergabe.anlegen({
      resellerId: req.reseller.id, userId: req.user.id, objectId: b.objectId, email: b.email,
      anzeigeName: b.anzeigeName, nachricht: b.nachricht, basis: inviteBase(req),
      platzMitschicken: b.platzMitschicken === true   /* v3317b */
    });
    /* Das Token geht NICHT an den Browser zurueck - es steht nur in der Mail. */
    res.json({ ok: true, uebergabe: r.uebergabe, mail: r.mail });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});
router.post('/uebergaben/:id/widerrufen', async (req, res, next) => {
  try { res.json({ ok: await uebergabe.widerrufen(req.reseller.id, req.params.id) }); }
  catch (e) { next(e); }
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
/* W1a-contact: eigene Route fuer Kontaktdaten - bewusst getrennt von PUT /branding,
   damit die bestehende Logo-/Accent-Logik unangetastet bleibt. */
router.put('/branding-contact', async (req, res, next) => {
  try {
    const b = req.body || {};
    const t = (v, n) => { const x = String(v == null ? '' : v).trim().slice(0, n); return x === '' ? null : x; };
    const mail = t(b.brand_email, 160);
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      return res.status(400).json({ error: 'email_invalid', message: 'E-Mail-Adresse ist ungueltig.' });
    }
    /* W8-mailaccent: Mail-Farbe ist vom App-Akzent entkoppelt. NULL = nicht
       gepflegt -> der Mail-Code faellt auf brand_accent zurueck. */
    const macc = /^#[0-9a-fA-F]{6}$/.test(b.brand_mail_accent || '') ? b.brand_mail_accent : null;
    await query(
      `UPDATE resellers SET
         brand_company = $2, brand_address = $3, brand_plz = $4, brand_city = $5,
         brand_phone = $6, brand_email = $7, brand_website = $8, brand_tagline = $9,
         brand_mail_accent = COALESCE($10, brand_mail_accent),
         brand_pdf_light = COALESCE($11, brand_pdf_light),   /*W12-pdflight*/
         brand_display   = COALESCE($12, brand_display),     /*W20-display*/
         updated_at = now()
       WHERE id = $1`,
      [req.reseller.id, t(b.brand_company,120), t(b.brand_address,160), t(b.brand_plz,12),
       t(b.brand_city,80), t(b.brand_phone,60), mail, t(b.brand_website,160), t(b.brand_tagline,120),
       macc, (typeof b.brand_pdf_light === 'boolean' ? b.brand_pdf_light : null),
       /* W20-display: nur ein echtes Objekt akzeptieren — kein Array, kein String.
          Sonst schriebe ein Tippfehler im Frontend Muell in die jsonb-Spalte. */
       (b.brand_display && typeof b.brand_display === 'object' && !Array.isArray(b.brand_display)
          ? JSON.stringify(b.brand_display) : null)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/branding', async (req, res, next) => {
  try {
    const r = await query(
      /* W1a-contact */
      `SELECT brand_name, whitelabel_enabled, brand_logo_b64, brand_accent, brand_accent_hi, brand_accent_lo, brand_obsidian,
              brand_company, brand_address, brand_plz, brand_city, brand_phone, brand_email, brand_website, brand_tagline,
              brand_mail_accent, brand_pdf_light, brand_display /*W8 W12 W20-display*/,
              brand_logo_dark_b64, brand_logo_auf_dunkel, brand_logo_auf_hell, brand_logo_messung /*v3299*/
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

    /* v3299 · zweites Logo "fuer dunklen Grund" - dieselben Regeln wie oben */
    let logoDark = b.brand_logo_dark_b64;
    if (logoDark === '' || logoDark === null) { logoDark = ''; }
    else if (typeof logoDark === 'string') {
      if (logoDark.length > 400000) return res.status(413).json({ error: 'logo_too_large', message: 'Logo zu groß (max ~300 KB).' });
      if (!/^data:image\//.test(logoDark)) return res.status(400).json({ error: 'logo_invalid', message: 'Ungültiges Bildformat.' });
    } else { logoDark = undefined; }
    /* v3299 · Varianten je Grund (PNG, im Browser gerechnet). null = mit dem Logo entfernen. */
    let vari;
    try { vari = _varianten(b.brand_logo_varianten); }
    catch (e) { return res.status(e.status || 400).json({ error: 'varianten_invalid', message: e.message }); }

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
    /* v3299 */
    if (logoDark !== undefined) {
      await query(`UPDATE resellers SET brand_logo_dark_b64 = $2, updated_at = now() WHERE id = $1`,
        [req.reseller.id, logoDark === '' ? null : logoDark]);
    }
    /* Neues oder entferntes Logo ohne frische Varianten: die alten passen nicht mehr -> leeren
       (die Kundenseite rechnet dann selbst, das Portal traegt sie beim naechsten Oeffnen nach). */
    if (vari !== undefined || logo !== undefined || logoDark !== undefined) {
      await _variantenSchreiben(req.reseller.id, (logo === '' || vari === undefined) ? null : vari);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* v3299 · Varianten nachtragen, ohne das Logo anzufassen - das Portal ruft
   das einmal fuer Branding auf, das vor v3299 gespeichert wurde. */
router.put('/branding-logo-varianten', async (req, res, next) => {
  try {
    let vari;
    try { vari = _varianten(req.body); }
    catch (e) { return res.status(e.status || 400).json({ error: 'varianten_invalid', message: e.message }); }
    if (!vari) return res.status(400).json({ error: 'varianten_invalid' });
    await _variantenSchreiben(req.reseller.id, vari);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* v3299 · undefined = nicht mitgeschickt, null = entfernen, sonst gepruefte Werte. */
function _varianten(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw Object.assign(new Error('Varianten fehlen.'), { status: 400 });
  const png = (x) => {
    if (typeof x !== 'string' || !/^data:image\/png;base64,/.test(x)) throw Object.assign(new Error('Variante ist kein PNG.'), { status: 400 });
    if (x.length > 600000) throw Object.assign(new Error('Variante zu groß.'), { status: 413 });
    return x;
  };
  const m = (v.messung && typeof v.messung === 'object' && !Array.isArray(v.messung)) ? JSON.stringify(v.messung) : null;
  if (m && m.length > 4000) throw Object.assign(new Error('Messung zu groß.'), { status: 413 });
  return { auf_dunkel: png(v.auf_dunkel), auf_hell: png(v.auf_hell), messung: m };
}
async function _variantenSchreiben(id, v) {
  await query(
    `UPDATE resellers SET brand_logo_auf_dunkel = $2, brand_logo_auf_hell = $3, brand_logo_messung = $4::jsonb, updated_at = now()
      WHERE id = $1`,
    [id, v ? v.auf_dunkel : null, v ? v.auf_hell : null, v ? v.messung : null]);
}

module.exports = router;
