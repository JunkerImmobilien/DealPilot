'use strict';
/**
 * V200: Reseller-Anfrage Notification-Service
 *
 * - Mail an Marcel: "[Reseller] Neue Anfrage von ..." → support@
 * - Mail an Anfrager: "Danke für deine DealPilot-Partneranfrage"
 *
 * Nutzt den bestehenden mailerService.
 */

const { sendMail } = require('./mailerService');

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getMailFrom() {
  const name = process.env.MAIL_FROM_NAME || 'DealPilot';
  const addr = process.env.MAIL_FROM_ADDRESS || process.env.BETA_SMTP_USER || 'dealpilot@junker-immobilien.io';
  return `"${name}" <${addr}>`;
}

async function notifyAdminAboutReseller(db, { id, contact_name, email, company, message, goals }) {
  const adminEmail = process.env.RESELLER_NOTIFY_EMAIL ||
                     process.env.SUPPORT_MAIL_TO ||
                     'support@junker-immobilien.io';
  const appUrl = process.env.APP_URL || 'https://dealpilot.junker-immobilien.io';

  const html = `
    <h2 style="color:#c9a042;font-family:Georgia,serif;">Neue Reseller-Anfrage</h2>
    <p>Es ist eine neue Reseller-Anfrage eingegangen:</p>
    <table style="border-collapse:collapse;width:100%;max-width:600px;font-family:Helvetica,sans-serif;">
      <tr><td style="padding:8px;color:#888;width:140px;">Name</td><td style="padding:8px;">${escapeHtml(contact_name)}</td></tr>
      <tr><td style="padding:8px;color:#888;">Firma</td><td style="padding:8px;">${escapeHtml(company || '–')}</td></tr>
      <tr><td style="padding:8px;color:#888;">E-Mail</td><td style="padding:8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td style="padding:8px;color:#888;">Ziele</td><td style="padding:8px;">${escapeHtml(goals || '–')}</td></tr>
      <tr><td style="padding:8px;color:#888;">Nachricht</td><td style="padding:8px;">${escapeHtml(message || '–')}</td></tr>
    </table>
    <p style="margin-top:20px;"><a href="${appUrl}/admin" style="background:#c9a042;color:#1a1a1a;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">→ Im Admin öffnen</a></p>
    <p style="color:#888;font-size:12px;margin-top:20px;">Anfrage-ID: ${id}</p>
  `;

  try {
    await sendMail({
      from: getMailFrom(),
      replyTo: email,
      to: adminEmail,
      subject: `[Reseller] Neue Anfrage von ${contact_name}${company ? ' / ' + company : ''}`,
      html,
      text: `Neue Reseller-Anfrage von ${contact_name} (${email}). Ziele: ${goals || '-'}. Nachricht: ${message || '-'}. Im Admin: ${appUrl}/admin`
    });
    console.log('[reseller-notify] ✓ Admin-Mail gesendet an', adminEmail);
  } catch (err) {
    console.error('[reseller-notify] admin-mail error:', err.message);
  }
}

async function sendResellerAcknowledgement(db, { contact_name, email }) {
  const appUrl = process.env.APP_URL || 'https://dealpilot.junker-immobilien.io';
  const supportEmail = process.env.SUPPORT_MAIL_TO || 'support@junker-immobilien.io';

  const html = `
<!DOCTYPE html>
<html><body style="font-family:Helvetica,sans-serif;color:#1a1a1a;background:#f8f4ed;margin:0;padding:40px 20px;">
<table cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td align="center">
<table cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#c9a042;height:6px;"></td></tr>
<tr><td style="padding:40px 40px 20px;">
<h1 style="font-family:Georgia,serif;font-size:28px;color:#1a1a1a;margin:0 0 8px;">Danke für deine Anfrage</h1>
<p style="color:#444;font-size:16px;line-height:1.6;">
Hallo ${escapeHtml(contact_name)},<br><br>
deine Anfrage zur DealPilot-Partnerschaft ist bei uns angekommen. Wir melden uns
typischerweise <strong>innerhalb von 2 Werktagen</strong> bei dir mit einer ersten Einschätzung
und einem Vorschlag für einen kurzen Call.
</p>
<p style="color:#444;font-size:16px;line-height:1.6;">
In der Zwischenzeit findest du DealPilot direkt hier:
</p>
<p style="text-align:center;margin:24px 0;">
<a href="${appUrl}" style="background:#c9a042;color:#1a1a1a;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">→ DealPilot ansehen</a>
</p>
<p style="color:#444;font-size:16px;line-height:1.6;">
Bei Rückfragen einfach auf diese E-Mail antworten oder uns direkt anschreiben an
<a href="mailto:${supportEmail}" style="color:#c9a042;">${supportEmail}</a>.
</p>
<p style="color:#444;font-size:16px;line-height:1.6;">
Beste Grüße<br>
<strong>Marcel Junker</strong><br>
Junker Immobilien
</p>
</td></tr>
<tr><td style="padding:20px 40px;background:#fafafa;text-align:center;color:#888;font-size:12px;">
Junker Immobilien · © ${new Date().getFullYear()}
</td></tr>
</table></td></tr></table></body></html>
  `;

  try {
    await sendMail({
      from: getMailFrom(),
      replyTo: supportEmail,
      to: email,
      subject: 'Danke für deine DealPilot-Partneranfrage',
      html,
      text: `Hallo ${contact_name}, deine Anfrage ist eingegangen. Wir melden uns innerhalb von 2 Werktagen. Beste Grüße, Marcel Junker.`
    });
    console.log('[reseller-notify] ✓ Acknowledgement an', email);
  } catch (err) {
    console.error('[reseller-notify] ack-mail error:', err.message);
  }
}

module.exports = {
  notifyAdminAboutReseller,
  sendResellerAcknowledgement
};
