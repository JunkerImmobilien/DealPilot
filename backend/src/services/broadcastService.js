'use strict';
/*
 * broadcastService.js (v778) — Massenmail.
 * Modi:
 *  - 'newsletter'   : nur Nutzer mit newsletter_consent = true (Opt-in).
 *  - 'operational'  : alle aktiven Nutzer (nur Betrieb/Wartung — KEINE Werbung).
 * Versand läuft im Hintergrund (nicht-blockierend), ~50 Mails/Minute, best-effort pro Empfänger.
 */
const { query } = require('../db/pool');
const mailLayout = require('./mailLayout');
const mailer = require('./mailerService');

function _whereFor(mode) {
  if (mode === 'newsletter') {
    return 'WHERE newsletter_consent = true AND is_active = true AND deleted_at IS NULL AND email IS NOT NULL';
  }
  return 'WHERE is_active = true AND deleted_at IS NULL AND email IS NOT NULL';
}

async function countRecipients(mode) {
  const r = await query('SELECT COUNT(*)::int AS n FROM users ' + _whereFor(mode));
  return (r.rows[0] && r.rows[0].n) || 0;
}

async function listRecipients(mode) {
  const r = await query('SELECT id, email, name FROM users ' + _whereFor(mode));
  return r.rows;
}

function _sanitizeMailHtml(html) {
  let h = String(html || '');
  // Skripte/Styles/iframes/objects komplett raus (inkl. Inhalt)
  h = h.replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)\b[^>]*>/gi, '');
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  // on*-Eventhandler-Attribute entfernen
  h = h.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '').replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  h = h.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  // gefaehrliche URL-Schemata in href/src neutralisieren
  h = h.replace(/(href|src)\s*=\s*"\s*(javascript|data(?!:image\/)|vbscript):[^"]*"/gi, '$1="#"');
  h = h.replace(/(href|src)\s*=\s*'\s*(javascript|data(?!:image\/)|vbscript):[^']*'/gi, "$1='#'");
  return h;
}
function _buildHtml(subject, bodyText, mode, asHtml) {
  const inner = asHtml
    ? _sanitizeMailHtml(bodyText)
    : mailLayout._esc(String(bodyText || '')).replace(/\n/g, '<br>');
  const safe = inner;
  return mailLayout.wrap({
    brandTag: (mode === 'newsletter') ? 'NEWSLETTER' : 'SERVICE-INFO',
    heroKicker: (mode === 'newsletter') ? 'DEALPILOT NEWSLETTER' : 'WICHTIGE BETRIEBS-INFO',
    heroTitle: subject || '',
    bodyHtml: '<div style="font-size:14px;line-height:1.6;color:#3a2e08;">' + safe + '</div>',
    footerNote: (mode === 'newsletter')
      ? 'Du erh\u00e4ltst diese E-Mail, weil du dem DealPilot-Newsletter zugestimmt hast.'
      : 'Diese E-Mail betrifft den Betrieb deines DealPilot-Kontos.'
  });
}

async function sendTest(opts) {
  opts = opts || {};
  if (!opts.toEmail) return { error: 'keine Test-Adresse' };
  await mailer.sendMail({
    to: opts.toEmail,
    subject: '[TEST] ' + (opts.subject || ''),
    text: opts.bodyText || '',
    html: _buildHtml(opts.subject || '', opts.bodyText || '', opts.mode, opts.asHtml)
  });
  return { ok: true };
}

function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function _runSend(broadcastId, recipients, html, subject, bodyText) {
  let sent = 0;
  for (let i = 0; i < recipients.length; i++) {
    const u = recipients[i];
    try {
      await mailer.sendMail({ to: u.email, subject: subject || '', text: bodyText || '', html: html });
      sent++;
    } catch (e) {
      console.error('[broadcast] mail to', u.email, 'failed:', e && e.message);
    }
    // ~50/min: nach je 50 Mails 60s pausieren, sonst kleiner Abstand
    if ((i + 1) % 50 === 0) await _sleep(60000);
    else await _sleep(300);
  }
  try {
    await query("UPDATE broadcasts SET sent_count = $1, status = 'done', finished_at = NOW() WHERE id = $2", [sent, broadcastId]);
  } catch (e) { console.error('[broadcast] finalize failed:', e && e.message); }
  return sent;
}

async function createAndSend(opts) {
  opts = opts || {};
  const mode = (opts.mode === 'newsletter') ? 'newsletter' : 'operational';
  const recipients = await listRecipients(mode);
  const html = _buildHtml(opts.subject || '', opts.bodyText || '', mode, opts.asHtml);
  const b = await query(
    `INSERT INTO broadcasts (admin_label, mode, subject, body_html, recipient_count, status)
     VALUES ($1,$2,$3,$4,$5,'sending') RETURNING id`,
    [opts.adminLabel || null, mode, (opts.subject || '').slice(0, 255), html, recipients.length]
  );
  const broadcastId = b.rows[0].id;
  // Hintergrund-Versand (NICHT awaiten -> Request antwortet sofort)
  _runSend(broadcastId, recipients, html, opts.subject || '', opts.bodyText || '')
    .catch(function (e) { console.error('[broadcast] run failed:', e && e.message); });
  return { broadcastId: broadcastId, recipientCount: recipients.length };
}

async function listBroadcasts() {
  const r = await query(
    `SELECT id, admin_label, mode, subject, recipient_count, sent_count, status, created_at, finished_at
       FROM broadcasts ORDER BY created_at DESC LIMIT 100`
  );
  return r.rows;
}

module.exports = { countRecipients, listRecipients, sendTest, createAndSend, listBroadcasts, buildHtml: _buildHtml };
