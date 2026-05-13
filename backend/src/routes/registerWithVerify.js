'use strict';
/**
 * V169 — Registrierung mit E-Mail-Bestätigung
 *
 * Routes:
 *   POST /auth/register-with-verify  — Public, anonyme Anmeldung
 *   GET  /auth/verify-email?token=X  — Public, Token einlösen → Auto-Login
 *
 * Flow:
 *  1. User schickt {name, email, password} → User wird mit is_active=false angelegt
 *  2. Verify-Token wird generiert, in email_tokens gespeichert
 *  3. Mail an User mit Verify-Link
 *  4. Notification-Mail an Admin (dealpilot@junker-immobilien.io)
 *  5. User klickt Link → User auf is_active=true → JWT-Cookie/Token, Redirect zur App
 *
 * Schutz:
 *   - Rate-Limit: 5 Registrierungen pro IP/Stunde
 *   - Honeypot-Feld 'hp'
 *   - Bestehende E-Mail-Adressen → still 200 zurück (keine User-Enumeration)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db/pool');
const userService = require('../services/userService');
const emailVerifyService = require('../services/emailVerifyService');
const mailerService = require('../services/mailerService');
const objectService = require('../services/objectService');
const jwtUtil = require('../utils/jwt');
const password = require('../utils/password');

const router = express.Router();

// Rate-Limit (strenger als /auth/register weil das ja "Coming Soon" public ist)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Registrierungs-Versuche. Bitte versuche es später erneut.' }
});

const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Name zu kurz').max(100, 'Name zu lang'),
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse').max(200),
  password: z.string().min(10, 'Passwort muss mindestens 10 Zeichen haben').max(128),
  hp: z.string().optional()  // Honeypot
});

router.post('/register-with-verify', registerLimiter, async (req, res) => {
  // Honeypot
  if (req.body && req.body.hp && String(req.body.hp).trim().length > 0) {
    return res.json({ success: true, message: 'Registrierung läuft. Bitte E-Mail-Postfach prüfen.' });
  }

  let parsed;
  try {
    parsed = RegisterSchema.parse(req.body || {});
  } catch (err) {
    const msg = err.errors && err.errors[0] ? err.errors[0].message : 'Ungültige Eingabe';
    return res.status(400).json({ error: msg });
  }

  const { name, email, password: plainPassword } = parsed;
  const baseUrl = process.env.FRONTEND_BASE_URL || 'https://dealpilot.junker-immobilien.io';

  try {
    // Existiert User schon?
    const existing = await userService.findByEmail(email);
    if (existing) {
      // Aus Sicherheit immer "ok" — verhindert User-Enumeration
      console.log('[register-verify] Bereits registrierte E-Mail:', email);
      return res.json({
        success: true,
        message: 'Falls die E-Mail noch nicht registriert ist, erhältst du eine Bestätigungs-Mail.'
      });
    }

    // Neuen User anlegen — DIREKT in DB damit wir is_active=false setzen können
    // (userService.createUser setzt is_active=true per Default)
    const hash = await password.hash(plainPassword);
    const countResult = await query('SELECT COUNT(*) AS cnt FROM users');
    const isFirstUser = parseInt(countResult.rows[0].cnt, 10) === 0;
    const role = isFirstUser ? 'admin' : 'user';

    const r = await query(
      `INSERT INTO users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, email, name, role, created_at`,
      [email, hash, name, role]
    );
    const user = r.rows[0];

    // Verify-Token generieren
    const token = await emailVerifyService.createVerifyToken(user.id);
    const verifyUrl = `${baseUrl}/api/v1/auth/verify-email?token=${token}`;

    // Audit
    try {
      await objectService.logAudit({
        userId: user.id,
        action: 'register_with_verify',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (e) { /* nicht kritisch */ }

    // Mail an User
    try {
      await mailerService.sendMail({
        to: user.email,
        subject: 'DealPilot — Bitte bestätige deine E-Mail',
        text:
          `Hallo ${user.name},\n\n` +
          `Vielen Dank für deine Anmeldung bei DealPilot.\n\n` +
          `Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:\n` +
          `${verifyUrl}\n\n` +
          `Der Link ist 24 Stunden gültig.\n\n` +
          `Falls du dich nicht angemeldet hast, ignoriere diese Mail einfach.\n\n` +
          `Gruß\nDealPilot Team\n` +
          `https://dealpilot.junker-immobilien.io`,
        html:
          `<div style="font-family:-apple-system,sans-serif;max-width:560px;color:#2A2727">` +
            `<h2 style="color:#C9A84C;margin-bottom:8px">Willkommen bei DealPilot, ${_esc(user.name)}!</h2>` +
            `<p>Vielen Dank für deine Anmeldung. Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.</p>` +
            `<p style="margin:24px 0">` +
              `<a href="${verifyUrl}" style="background:#C9A84C;color:#1A1818;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">` +
                `E-Mail bestätigen` +
              `</a>` +
            `</p>` +
            `<p style="color:#666;font-size:12px">Oder kopiere diesen Link in deinen Browser:<br>` +
              `<a href="${verifyUrl}" style="color:#888;word-break:break-all">${verifyUrl}</a>` +
            `</p>` +
            `<hr style="border:none;border-top:1px solid #eee;margin:24px 0">` +
            `<p style="color:#888;font-size:12px">` +
              `Der Link ist 24 Stunden gültig. Falls du dich nicht angemeldet hast, kannst du diese Mail ignorieren.` +
            `</p>` +
          `</div>`
      });
      console.log('[register-verify] Verify-Mail gesendet an:', email);
    } catch (e) {
      console.error('[register-verify] Verify-Mail fehlgeschlagen:', e.message);
    }

    // Admin-Notification (Marcel bekommt Bescheid bei jeder Anmeldung)
    try {
      const adminMail = process.env.BETA_MAIL_TO || 'dealpilot@junker-immobilien.io';
      await mailerService.sendMail({
        to: adminMail,
        subject: '[DealPilot] Neue Registrierung: ' + name,
        text:
          `Neue Registrierung über das DealPilot-Anmeldeformular:\n\n` +
          `Name:    ${name}\n` +
          `E-Mail:  ${email}\n` +
          `Zeit:    ${new Date().toISOString()}\n` +
          `IP:      ${req.ip || '–'}\n\n` +
          `User wartet auf E-Mail-Bestätigung (Token gültig 24h).\n` +
          `Wenn der User klickt: Konto wird automatisch aktiviert + Free-Plan zugewiesen.\n\n` +
          `Admin-Aktionen falls nötig:\n` +
          `- Plan ändern: /api/v1/plans/admin/users/${user.id}/plan`,
        html:
          `<div style="font-family:-apple-system,sans-serif">` +
            `<h3 style="color:#C9A84C">Neue Registrierung</h3>` +
            `<table style="border-collapse:collapse">` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>Name</strong></td><td>${_esc(name)}</td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>E-Mail</strong></td><td><a href="mailto:${_esc(email)}">${_esc(email)}</a></td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>Zeit</strong></td><td>${new Date().toLocaleString('de-DE')}</td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>IP</strong></td><td>${_esc(req.ip || '–')}</td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>User-ID</strong></td><td><code>${user.id}</code></td></tr>` +
            `</table>` +
            `<p style="color:#666;font-size:13px;margin-top:16px">` +
              `User wartet auf E-Mail-Bestätigung. Nach Klick auf Verify-Link wird das Konto automatisch aktiviert + Free-Plan zugewiesen.` +
            `</p>` +
          `</div>`
      });
    } catch (e) {
      console.error('[register-verify] Admin-Notification fehlgeschlagen:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Anmeldung erfolgreich. Bitte E-Mail-Postfach prüfen und Bestätigungs-Link klicken.'
    });
  } catch (err) {
    console.error('[register-verify] Fehler:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen. Bitte später erneut versuchen.' });
  }
});

/**
 * GET /auth/verify-email?token=XXX
 *
 * Antwort: Redirect zur App mit ?welcome=1 (User automatisch eingeloggt via Token in URL)
 *          oder ?verify_error=expired bzw. invalid
 */
router.get('/verify-email', async (req, res) => {
  const token = req.query.token || '';
  const baseUrl = process.env.FRONTEND_BASE_URL || 'https://dealpilot.junker-immobilien.io';

  try {
    const userId = await emailVerifyService.consumeVerifyToken(token);
    if (!userId) {
      return res.redirect(`${baseUrl}/?verify_error=invalid`);
    }

    // User aktivieren
    await query('UPDATE users SET is_active = TRUE WHERE id = $1', [userId]);

    // Free-Plan zuweisen falls nicht schon zugewiesen
    // (Subscriptions-Tabelle: insert wenn nicht existiert)
    try {
      const subCheck = await query(
        'SELECT id FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      if (subCheck.rowCount === 0) {
        const freePlan = await query(`SELECT id FROM plans WHERE id = 'free'`);
        if (freePlan.rowCount > 0) {
          await query(
            `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
             VALUES ($1, 'free', 'active', NOW(), NOW() + INTERVAL '100 years')`,
            [userId]
          );
        }
      }
    } catch (e) {
      console.warn('[verify-email] Free-Plan-Zuweisung fehlgeschlagen (nicht kritisch):', e.message);
    }

    // User-Daten holen + JWT erstellen
    const user = await userService.getById(userId);
    if (!user) {
      return res.redirect(`${baseUrl}/?verify_error=user_not_found`);
    }

    const jwtToken = jwtUtil.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    // Audit
    try {
      await objectService.logAudit({
        userId: user.id,
        action: 'email_verified',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (e) {}

    // V204 SECURITY-FIX (C2): JWT via Hash-Fragment statt Query-Param.
    // Hash-Fragments (#...) werden NICHT an den Server gesendet, landen nicht
    // in Access-Logs, Browser-History bleibt, aber Referrer-Header leaken sie nicht.
    // Vorher: ${baseUrl}/?welcome=1&t=JWT → Token in Caddy-Logs + Browser-History sichtbar
    // Frontend muss window.location.hash statt .search lesen (siehe auth.js).
    return res.redirect(`${baseUrl}/#welcome=1&t=${encodeURIComponent(jwtToken)}`);
  } catch (err) {
    console.error('[verify-email] Fehler:', err);
    return res.redirect(`${baseUrl}/?verify_error=server`);
  }
});

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
