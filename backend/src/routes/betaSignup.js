'use strict';
/**
 * V37: Beta-Tester-Anmeldung
 *
 * POST /api/v1/beta-signup
 *   Body: { name, email, message?, hp }
 *   Public — kein Auth.
 *
 * Schutz:
 *   - Honeypot-Feld 'hp' — wenn ausgefüllt → still erfolgreich (Bot)
 *   - Rate-Limit: 5 Anfragen pro IP pro Stunde
 *   - Validation per Zod
 *
 * Sendet Mail an info@junker-immobilien.io (oder BETA_MAIL_TO).
 * Bei fehlender SMTP-Konfig in production → 503.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const mailerService = require('../services/mailerService');

const router = express.Router();

// Eigenes Rate-Limit für Beta-Signups (strenger als allgemeines)
const betaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,    // 1 Stunde
  max: 5,                       // 5 Anfragen pro IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }
});

const BetaSchema = z.object({
  name: z.string().trim().min(2, 'Name zu kurz').max(100, 'Name zu lang'),
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse').max(200),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
  hp: z.string().optional()    // Honeypot
});

router.post('/', betaLimiter, async (req, res) => {
  // Honeypot — Bot erkannt? Still success'en, NICHT senden.
  if (req.body && req.body.hp && String(req.body.hp).trim().length > 0) {
    return res.json({ success: true });
  }

  // Validierung
  let parsed;
  try {
    parsed = BetaSchema.parse(req.body || {});
  } catch (err) {
    const msg = err.errors && err.errors[0] ? err.errors[0].message : 'Ungültige Eingabe';
    return res.status(400).json({ error: msg });
  }

  const { name, email, message } = parsed;

  // Mail bauen
  const subject = '[DealPilot] Neue Beta-Tester-Anfrage von ' + name;
  const text = [
    'Neue Beta-Tester-Anfrage über das DealPilot-Anmeldefenster:',
    '',
    'Name:    ' + name,
    'E-Mail:  ' + email,
    '',
    'Nachricht:',
    message || '(keine)',
    '',
    '---',
    'Automatisch generiert von DealPilot · ' + new Date().toISOString(),
    'IP: ' + (req.ip || '–')
  ].join('\n');

  const html =
    '<div style="font-family: -apple-system, sans-serif; max-width: 600px;">' +
      '<h2 style="color:#C9A84C;">Neue Beta-Tester-Anfrage</h2>' +
      '<p style="color:#444;">Über das DealPilot-Anmeldefenster wurde eine neue Anfrage gestellt:</p>' +
      '<table style="border-collapse: collapse; margin: 16px 0;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#888;"><strong>Name</strong></td><td style="padding:6px 0;">' + _escHtml(name) + '</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#888;"><strong>E-Mail</strong></td><td style="padding:6px 0;"><a href="mailto:' + _escAttr(email) + '">' + _escHtml(email) + '</a></td></tr>' +
      '</table>' +
      (message ? '<div style="background:#fafaf5;border-left:3px solid #C9A84C;padding:12px 16px;margin:16px 0;">' +
        '<strong style="color:#C9A84C;">Nachricht:</strong><br>' + _escHtml(message).replace(/\n/g, '<br>') +
      '</div>' : '') +
      '<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">' +
      '<p style="color:#aaa;font-size:11px;">Automatisch generiert von DealPilot · ' + new Date().toLocaleString('de-DE') + '<br>IP: ' + _escHtml(req.ip || '–') + '</p>' +
    '</div>';

  try {
    await mailerService.sendMail({
      // V63.77: Beta-Anfragen gehen explizit an dealpilot@…
      to: process.env.BETA_MAIL_TO || 'dealpilot@junker-immobilien.io',
      subject: subject,
      text: text,
      html: html,
      replyTo: email + ' (' + name.replace(/[<>]/g, '') + ')'
    });

    // V63.77: Bestätigung an den anmeldenden User
    if (email) {
      await mailerService.sendConfirmation(email, {
        kind: 'beta',
        subject: subject,
        userName: name,
        summary: 'Du hast dich für den DealPilot Beta-Test angemeldet. Wir melden uns mit deinen Zugangsdaten.'
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[beta-signup] Mail-Fehler:', err.message);
    if (err.code === 'NO_SMTP') {
      return res.status(503).json({
        error: 'Mail-Versand ist gerade nicht konfiguriert. Bitte schreibe direkt an info@junker-immobilien.io oder versuche es später erneut.'
      });
    }
    return res.status(502).json({
      error: 'Mail konnte nicht versendet werden. Bitte versuche es in ein paar Minuten erneut oder schreibe direkt an info@junker-immobilien.io.'
    });
  }
});

/**
 * GET /api/v1/beta-signup/status — für Health-Checks.
 * Public, gibt nur zurück ob Mailer konfiguriert ist (keine Credentials!).
 */
router.get('/status', (req, res) => {
  const status = mailerService.getStatus();
  res.json({
    configured: status.configured,
    to: status.to
    // Absichtlich nicht: host, from — keine Detail-Leaks an Public-Endpoint
  });
});

function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function _escAttr(s) {
  return _escHtml(s);
}

module.exports = router;
