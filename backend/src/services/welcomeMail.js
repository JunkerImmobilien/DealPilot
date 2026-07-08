// v565-mail-kerosin
'use strict';
/**
 * V198: Welcome-Mails nach Stripe-Checkout
 *
 * Nutzt den bestehenden mailerService (BETA_SMTP_* Variablen).
 * Idempotent über welcome_mails-Tabelle.
 *
 * Exports:
 *   sendSubscriptionWelcome(db, { userId, planName, planId, amountCents, billingInterval, sessionId })
 *   sendCreditPackConfirmation(db, { userId, packLabel, creditsGranted, requestsGranted, amountCents, sessionId })
 */

const path = require('path');
const fs = require('fs');
const { sendMail } = require('./mailerService');
const mailLayout = require('./mailLayout'); // v893q-kerosin

// ─── Mail-Settings ─────────────────────────────────────────

function getMailFrom() {
  const name = process.env.MAIL_FROM_NAME || 'DealPilot';
  const addr = process.env.MAIL_FROM_ADDRESS || process.env.BETA_SMTP_USER || 'dealpilot@junker-immobilien.io';
  return `"${name}" <${addr}>`;
}

// ─── Template-Helpers ──────────────────────────────────────

function loadTemplate(name) {
  const tmplPath = path.join(__dirname, '../../templates', name + '.html');
  try {
    return fs.readFileSync(tmplPath, 'utf-8');
  } catch (err) {
    console.error('[welcome-mail] Template fehlt:', tmplPath);
    return null;
  }
}

function fillTemplate(tmpl, vars) {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    vars[key] != null ? String(vars[key]) : ''
  );
}

function fmtMoney(cents, currency = 'EUR') {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency
  });
}

// ─── DB: Idempotenz-Log ────────────────────────────────────

async function ensureLogTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS welcome_mails (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mail_type text NOT NULL,
      reference_id text,
      sent_at timestamptz NOT NULL DEFAULT now(),
      message_id text,
      error text
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_welcome_mails_user ON welcome_mails(user_id, mail_type)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_welcome_mails_ref ON welcome_mails(reference_id) WHERE reference_id IS NOT NULL`);
}

async function hasBeenSent(db, userId, mailType, referenceId) {
  if (referenceId) {
    const r = await db.query(
      'SELECT 1 FROM welcome_mails WHERE reference_id = $1 LIMIT 1',
      [referenceId]
    );
    return r.rowCount > 0;
  }
  const r = await db.query(
    'SELECT 1 FROM welcome_mails WHERE user_id = $1 AND mail_type = $2 LIMIT 1',
    [userId, mailType]
  );
  return r.rowCount > 0;
}

async function logSent(db, userId, mailType, referenceId, messageId, error) {
  try {
    await db.query(`
      INSERT INTO welcome_mails (user_id, mail_type, reference_id, message_id, error)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, mailType, referenceId, messageId, error]);
  } catch (e) {
    console.warn('[welcome-mail-log] failed:', e.message);
  }
}

// ─── 1) Subscription-Welcome ──────────────────────────────────

async function sendSubscriptionWelcome(db, { userId, planName, planId, amountCents, billingInterval, sessionId }) {
  await ensureLogTable(db);

  if (await hasBeenSent(db, userId, 'subscription_welcome', sessionId)) {
    console.log('[welcome-mail] sub-welcome bereits gesendet:', sessionId);
    return { ok: true, reason: 'already_sent' };
  }

  const u = await db.query('SELECT email, name FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
  if (!u.rowCount) return { ok: false, reason: 'user_not_found' };
  const user = u.rows[0];

  const tmpl = loadTemplate('subscription-welcome');
  if (!tmpl) return { ok: false, reason: 'template_missing' };

  const appUrl = process.env.APP_URL || 'https://dealpilot.junker-immobilien.io';
  const intervalLabel = billingInterval === 'yearly' ? 'jährlich' : 'monatlich';

  const html = fillTemplate(tmpl, {
    user_name: user.name || user.email.split('@')[0],
    plan_name: planName,
    plan_price: fmtMoney(amountCents),
    billing_interval: intervalLabel,
    app_url: appUrl,
    support_email: process.env.SUPPORT_MAIL_TO || 'support@junker-immobilien.io',
    current_year: new Date().getFullYear()
  });

  try {
    const result = await sendMail({
      from: getMailFrom(),
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      to: user.email,
      subject: `Willkommen an Bord bei DealPilot ${planName}`,
      html,
      text: `Willkommen an Bord bei DealPilot ${planName}! Dein Abo ist aktiv. App: ${appUrl}`
    });
    await logSent(db, userId, 'subscription_welcome', sessionId, result.messageId);
    console.log('[welcome-mail] ✓ Subscription-Welcome an', user.email);
    return { ok: true, messageId: result.messageId };
  } catch (err) {
    console.error('[welcome-mail] sub-welcome failed:', err.message);
    await logSent(db, userId, 'subscription_welcome', sessionId, null, err.message);
    return { ok: false, reason: 'send_failed', error: err.message };
  }
}

// ─── 2) Credit-Pack-Confirmation ──────────────────────────────

async function sendCreditPackConfirmation(db, { userId, packLabel, creditsGranted, requestsGranted, amountCents, sessionId }) {
  await ensureLogTable(db);

  if (await hasBeenSent(db, userId, 'credit_pack_confirmation', sessionId)) {
    console.log('[welcome-mail] credit-pack bereits gesendet:', sessionId);
    return { ok: true, reason: 'already_sent' };
  }

  const u = await db.query('SELECT email, name FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
  if (!u.rowCount) return { ok: false, reason: 'user_not_found' };
  const user = u.rows[0];

  /* v893q-kerosin: On-Brand-Template (mailLayout) statt loadTemplate-File; Kerosin-Text */
  const appUrl = process.env.APP_URL || 'https://dealpilot.junker-immobilien.io';
  const _name = user.name || user.email.split('@')[0];
  const _liters = creditsGranted;
  const _packTxt = packLabel ? (' (' + mailLayout._esc(packLabel) + ')') : '';
  const html = mailLayout.wrap({
    brandTag: 'KEROSIN',
    heroKicker: 'TANK AUFGEF\u00dcLLT',
    heroTitle: _liters + ' Liter Kerosin sind im Tank',
    heroSubtitle: 'Hallo ' + mailLayout._esc(_name) + ',',
    bodyHtml:
      '<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3a2e08;">danke f\u00fcr deinen Kauf \u2014 wir haben deinem Konto <strong>' + _liters + ' Liter Kerosin</strong>' + _packTxt + ' gutgeschrieben. Dein Tank ist aufgef\u00fcllt und startklar.</p>' +
      '<div style="background:#FAF6EC;border-left:3px solid #C9A84C;padding:14px 18px;margin:0 0 16px;border-radius:6px;">' +
        '<strong style="color:#b8932f;font-size:12px;letter-spacing:.5px;text-transform:uppercase;">Deine Buchung</strong>' +
        '<table role="presentation" style="margin-top:8px;font-size:13.5px;color:#4a4536;line-height:1.7;">' +
          '<tr><td style="padding-right:18px;">Kerosin</td><td><strong>' + _liters + ' L</strong></td></tr>' +
          (amountCents ? ('<tr><td style="padding-right:18px;">Betrag</td><td><strong>' + fmtMoney(amountCents) + '</strong></td></tr>') : '') +
        '</table></div>' +
      '<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3a2e08;">Kerosin ist dein Treibstoff f\u00fcr Marktbewertungen und den Co-Pilot im Cockpit \u2014 einfach weiterfliegen.</p>' +
      mailLayout.button('Zum Cockpit', appUrl) +
      '<p style="margin:18px 0 0;font-size:14px;color:#3a2e08;">Gute Fl\u00fcge!<br><strong>Marcel Junker \u00b7 Junker Immobilien</strong></p>',
    footerNote: 'DealPilot \u00b7 Kerosin-Kaufbest\u00e4tigung \u00b7 <a href="https://www.junker-immobilien.io" style="color:#b8932f;text-decoration:none;">junker-immobilien.io</a>'
  });

  try {
    const result = await sendMail({
      from: getMailFrom(),
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      to: user.email,
      subject: `Deine ${creditsGranted} Liter Kerosin sind im Tank`,
      html,
      text: `Deine ${creditsGranted} Liter Kerosin wurden deinem Tank gutgeschrieben. App: ${appUrl}`
    });
    await logSent(db, userId, 'credit_pack_confirmation', sessionId, result.messageId);
    console.log('[welcome-mail] ✓ Credit-Pack-Confirmation an', user.email);
    return { ok: true, messageId: result.messageId };
  } catch (err) {
    console.error('[welcome-mail] credit-pack failed:', err.message);
    await logSent(db, userId, 'credit_pack_confirmation', sessionId, null, err.message);
    return { ok: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = {
  sendSubscriptionWelcome,
  sendCreditPackConfirmation,
  ensureLogTable
};
