'use strict';
/**
 * V37: SMTP-Mailer-Service
 *
 * Liest SMTP-Konfig aus Env:
 *   BETA_SMTP_HOST       z.B. smtp.strato.de
 *   BETA_SMTP_PORT       587 (STARTTLS) oder 465 (SSL)
 *   BETA_SMTP_SECURE     "true" für 465, sonst false (default)
 *   BETA_SMTP_USER       Benutzername
 *   BETA_SMTP_PASS       Passwort
 *   BETA_MAIL_FROM       Absender, z.B. "DealPilot <info@dealpilot.immo>"
 *   BETA_MAIL_TO         Empfänger, default "info@dealpilot.immo"
 *
 * Wenn HOST/USER/PASS nicht gesetzt sind, läuft der Mailer im DRY-RUN-Modus:
 * loggt die Mail in die Konsole und antwortet mit success:true (für Smoke-Tests).
 * Im Production-Mode (NODE_ENV=production) ist DRY-RUN deaktiviert — fehlende
 * Konfig führt dort zu einem klaren 503-Fehler.
 */

const mailLayout = require('./mailLayout'); // v775-mail-layout
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer noch nicht installiert — wird beim ersten Mail-Versuch nochmal versucht
  nodemailer = null;
}

let _transporter = null;
let _transporterChecked = false;

function _getTransporter() {
  if (_transporterChecked) return _transporter;
  _transporterChecked = true;

  const host = process.env.BETA_SMTP_HOST;
  const user = process.env.BETA_SMTP_USER;
  const pass = process.env.BETA_SMTP_PASS;
  if (!host || !user || !pass) {
    return null;   // → DRY-RUN
  }
  if (!nodemailer) {
    try { nodemailer = require('nodemailer'); }
    catch (e) {
      console.error('[mailer] nodemailer nicht installiert — bitte `npm install` im backend ausführen');
      return null;
    }
  }

  const port   = parseInt(process.env.BETA_SMTP_PORT || '587', 10);
  const secure = process.env.BETA_SMTP_SECURE === 'true' || port === 465;

  _transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    auth: { user: user, pass: pass },
    // 10s Timeout — sonst hängen Requests bei SMTP-Problemen
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
  return _transporter;
}

/**
 * Status — für Health-Endpoint nutzbar.
 */
function getStatus() {
  const host = process.env.BETA_SMTP_HOST;
  const user = process.env.BETA_SMTP_USER;
  const pass = process.env.BETA_SMTP_PASS;
  return {
    configured: Boolean(host && user && pass),
    host: host ? host : null,
    from: process.env.BETA_MAIL_FROM || null,
    to:   process.env.BETA_MAIL_TO   || 'info@dealpilot.immo'
  };
}

/**
 * Sendet eine Mail. Bei fehlender Konfig läuft DRY-RUN (Konsolen-Log).
 * Wirft bei SMTP-Fehlern, Caller muss try/catch.
 */
async function sendMail(opts) {
  const t = _getTransporter();
  const from = process.env.BETA_MAIL_FROM || (opts.from || 'noreply@example.com');
  const to   = opts.to || process.env.BETA_MAIL_TO || 'info@dealpilot.immo';

  if (!t) {
    if (process.env.NODE_ENV === 'production' && process.env.MAIL_DRY_RUN_ALLOW !== 'true') {
      const err = new Error('SMTP nicht konfiguriert — bitte BETA_SMTP_HOST/USER/PASS in .env setzen.');
      err.code = 'NO_SMTP';
      throw err;
    }
    // Dev/Smoke: nur loggen
    console.log('[mailer · DRY-RUN] To:', to);
    console.log('[mailer · DRY-RUN] Subject:', opts.subject);
    console.log('[mailer · DRY-RUN] Text:\n' + (opts.text || '(no text)'));
    return { dryRun: true, to: to };
  }

  const info = await t.sendMail({
    from: from,
    to: to,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject || '(kein Betreff)',
    text: opts.text || '',
    html: opts.html || undefined,
    attachments: Array.isArray(opts.attachments) ? opts.attachments : undefined
  });
  return { dryRun: false, messageId: info.messageId, to: to };
}

/**
 * V63.77: Bestätigungs-E-Mail an den Absender einer Anfrage.
 * Schickt nur wenn process.env.SEND_CONFIRMATION_EMAILS === 'true' UND
 * eine Empfänger-E-Mail vorliegt.
 *
 * @param {string} recipientEmail  E-Mail des Absenders
 * @param {object} ctx             { kind: 'bank'|'fb'|'expert'|'consult'|'rnd'|'feedback'|'support'|'beta',
 *                                   subject: string,           // Original-Betreff
 *                                   userName?: string,
 *                                   summary?: string }         // optionaler Zusatztext
 */
async function sendConfirmation(recipientEmail, ctx) {
  if (!recipientEmail) return { skipped: true, reason: 'no recipient' };
  if (process.env.SEND_CONFIRMATION_EMAILS !== 'true') {
    return { skipped: true, reason: 'disabled by env' };
  }

  const KIND_LABELS = {
    bank:     'Bankanfrage',
    fb:       'Finanzierungsbestätigung',
    expert:   'Gutachten-Anfrage',
    consult:  'Beratungs-Anfrage',
    rnd:      'Restnutzungsdauer-Gutachten',
    feedback: 'Feedback',
    support:  'Support-Anfrage',
    beta:     'Beta-Tester-Anmeldung'
  };
  const label = KIND_LABELS[ctx.kind] || 'Anfrage';

  const greeting = ctx.userName ? `Hallo ${ctx.userName},` : 'Hallo,';

  // Plain-Text-Body
  const text = [
    greeting,
    '',
    `vielen Dank — wir haben deine ${label} erhalten und kümmern uns zeitnah darum.`,
    '',
    'Was passiert jetzt?',
    `  • Wir prüfen die Unterlagen / dein Anliegen.`,
    `  • Du bekommst innerhalb von 1–3 Werktagen eine persönliche Antwort.`,
    `  • Solltest du Rückfragen haben, antworte einfach auf diese E-Mail.`,
    '',
    ctx.summary ? '── Deine Anfrage ──\n' + ctx.summary + '\n' : '',
    'Beste Grüße',
    'Marcel Junker · Junker Immobilien',
    'www.junker-immobilien.io',
    '',
    '— DealPilot · automatische Bestätigung'
  ].join('\n');

  // HTML-Body (etwas hübscher)
  const html = mailLayout.wrap({
    brandTag: 'BEST\u00c4TIGUNG',
    heroKicker: 'ANFRAGE EINGEGANGEN',
    heroTitle: 'Wir haben deine ' + label + ' erhalten',
    heroSubtitle: greeting,
    bodyHtml:
      '<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3a2e08;">vielen Dank \u2014 wir haben deine <strong>' + label + '</strong> erhalten und k\u00fcmmern uns zeitnah darum.</p>' +
      '<div style="background:#FAF6EC;border-left:3px solid #C9A84C;padding:14px 18px;margin:0 0 16px;border-radius:6px;">' +
        '<strong style="color:#b8932f;font-size:12px;letter-spacing:.5px;text-transform:uppercase;">Was passiert jetzt?</strong>' +
        '<ul style="margin:8px 0 0 18px;padding:0;font-size:13.5px;color:#4a4536;line-height:1.6;">' +
          '<li>Wir pr\u00fcfen dein Anliegen.</li>' +
          '<li>Du bekommst innerhalb von <strong>1\u20133 Werktagen</strong> eine pers\u00f6nliche Antwort.</li>' +
          '<li>R\u00fcckfragen? Antworte einfach auf diese E-Mail.</li>' +
        '</ul></div>' +
      (ctx.summary ? '<div style="background:#fafafa;border:1px solid #eee;border-radius:6px;padding:14px;margin:0 0 16px;font-size:13px;color:#555;"><strong style="color:#1a1407;">Deine Anfrage:</strong><br><br>' + String(ctx.summary).replace(/\n/g, '<br>') + '</div>' : '') +
      '<p style="margin:0;font-size:14px;color:#3a2e08;">Beste Gr\u00fc\u00dfe<br><strong>Marcel Junker \u00b7 Junker Immobilien</strong></p>',
    footerNote: 'DealPilot \u00b7 automatische Best\u00e4tigung \u00b7 <a href="https://www.junker-immobilien.io" style="color:#b8932f;text-decoration:none;">junker-immobilien.io</a>'
  });

  try {
    return await sendMail({
      to: recipientEmail,
      subject: 'Bestätigung: ' + label + ' erhalten — Junker Immobilien',
      text: text,
      html: html
    });
  } catch (err) {
    // Bestätigungs-Mails dürfen NIEMALS die Original-Anfrage scheitern lassen.
    console.error('[mailer] confirmation send failed (ignored):', err.message);
    return { skipped: true, reason: 'error', error: err.message };
  }
}

module.exports = {
  sendMail,
  sendConfirmation,
  getStatus
};
