'use strict';
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const userService = require('../services/userService');
const objectService = require('../services/objectService');
const twoFactorService = require('../services/twoFactorService');
const jwtUtil = require('../utils/jwt');

const router = express.Router();

// ── Schemas ──────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(10, 'Password must be at least 10 characters').max(128),
  name: z.string().min(1, 'Name is required').max(255).trim()
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10, 'Password must be at least 10 characters').max(128)
});

// ── Helpers ──────────────────────────────────────────
function sessionFromUser(user) {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

// ── Routes ───────────────────────────────────────────

/**
 * POST /auth/register
 * Public: register a new user. First user becomes admin.
 */
router.post('/register', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const user = await userService.createUser({
      email,
      plainPassword: password,
      name
    });

    const token = jwtUtil.sign(sessionFromUser(user));
    await objectService.logAudit({
      userId: user.id,
      action: 'register',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (err) { next(err); }
});

/**
 * POST /auth/login
 */
router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userService.authenticate({ email, plainPassword: password, ipAddress: req.ip });

    // V63.80: Wenn 2FA aktiv → kein JWT, sondern Pre-Auth-Token zurück
    const has2fa = await twoFactorService.isEnabled(user.id);
    if (has2fa) {
      const preAuthToken = await twoFactorService.createPreAuthToken(user.id);
      await objectService.logAudit({
        userId: user.id,
        action: 'login_step1_password_ok',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.json({
        requires2fa: true,
        preAuthToken: preAuthToken,
        // Wir geben ABSICHTLICH keine User-Daten preis vor 2FA-Verifikation
      });
    }

    // Standard-Login (kein 2FA)
    const token = jwtUtil.sign(sessionFromUser(user));

    await objectService.logAudit({
      userId: user.id,
      action: 'login',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (err) { next(err); }
});

/**
 * V63.80: POST /auth/2fa/verify-login
 * Tausch: preAuthToken + 6-stelliger Code → echtes JWT
 */
const verifyLoginSchema = z.object({
  preAuthToken: z.string().min(8).max(200),
  code: z.string().min(4).max(20)        // 6 für TOTP, ~9 für Recovery (XXXX-XXXX)
});
router.post('/2fa/verify-login', validate({ body: verifyLoginSchema }), async (req, res, next) => {
  try {
    const { preAuthToken, code } = req.body;
    const cleanCode = String(code).replace(/\s/g, '');

    // Recovery-Codes haben Bindestrich → erkennbar; sonst TOTP
    let userId;
    if (cleanCode.includes('-') || cleanCode.length > 7) {
      userId = await twoFactorService.verifyRecoveryCode(preAuthToken, cleanCode);
    } else {
      userId = await twoFactorService.verifyTotpForLogin(preAuthToken, cleanCode);
    }

    if (!userId) {
      return res.status(401).json({ error: 'Code ungültig oder Token abgelaufen.' });
    }

    const user = await userService.getById(userId);
    if (!user) return res.status(401).json({ error: 'User nicht gefunden.' });

    const token = jwtUtil.sign(sessionFromUser(user));

    await objectService.logAudit({
      userId: user.id,
      action: 'login_2fa_ok',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (err) { next(err); }
});

/**
 * GET /auth/me - return current user info
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /auth/change-password
 */
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), async (req, res, next) => {
  try {
    await userService.changePassword({
      userId: req.user.id,
      oldPassword: req.body.oldPassword,
      newPassword: req.body.newPassword
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * POST /auth/logout
 * Note: JWT-based logout is client-side (drop the token).
 * This endpoint just logs the action for audit purposes.
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await objectService.logAudit({
      userId: req.user.id,
      action: 'logout',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * V42: Password-Reset-Request
 * - Antwortet IMMER ok (egal ob User existiert) gegen User-Enumeration
 * - Sendet via betaMailService eine Mail mit Reset-Link
 * - Token gültig 1h, in DB gespeichert
 */
const passwordResetRequestSchema = z.object({
  email: z.string().email().max(255)
});

router.post('/password-reset-request', validate({ body: passwordResetRequestSchema }), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await userService.findByEmail(email);

    // Aus Sicherheitsgründen IMMER selbe Antwort
    res.json({ ok: true });

    // Wenn User nicht existiert: still no-op
    if (!user) {
      console.log('[pw-reset] Request für unbekannte E-Mail:', email);
      return;
    }

    // Token generieren — 32 random hex
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    // In DB speichern (nutzt password_reset_tokens-Tabelle)
    try {
      await userService.createPasswordResetToken(user.id, token, expiresAt);
    } catch (e) {
      console.error('[pw-reset] DB-Fehler:', e.message);
      return;
    }

    // Reset-Link bauen
    const baseUrl = process.env.FRONTEND_BASE_URL || 'https://dealpilot.junker-immobilien.io';
    const resetUrl = `${baseUrl}/?reset=${token}`;

    // Mail senden via mailerService (existierender SMTP-Transporter)
    try {
      const mailer = require('../services/mailerService');
      await mailer.sendMail({
        to: user.email,
        subject: 'DealPilot — Passwort zurücksetzen',
        text: `Hallo ${user.name || ''},\n\n` +
          `du hast eine Passwort-Zurücksetzung angefordert.\n\n` +
          `Klicke auf den folgenden Link, um ein neues Passwort zu setzen:\n` +
          `${resetUrl}\n\n` +
          `Der Link ist 1 Stunde gültig.\n\n` +
          `Falls du das nicht angefordert hast, ignoriere diese Mail einfach.\n\n` +
          `Gruß\nDealPilot Team`,
        html: `<p>Hallo ${user.name || ''},</p>` +
          `<p>du hast eine Passwort-Zurücksetzung angefordert.</p>` +
          `<p><a href="${resetUrl}" style="background:#C9A84C;color:#1A1818;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600">Passwort zurücksetzen</a></p>` +
          `<p style="color:#666;font-size:12px">Oder kopiere diesen Link: ${resetUrl}</p>` +
          `<p style="color:#666;font-size:12px">Der Link ist 1 Stunde gültig. Falls du das nicht angefordert hast, ignoriere diese Mail einfach.</p>`
      });
      console.log('[pw-reset] Reset-Link gesendet an:', email);
    } catch (e) {
      console.error('[pw-reset] Mail-Fehler:', e.message);
    }
  } catch (err) { next(err); }
});

/**
 * V42: Password-Reset durchführen
 */
const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(128),
  newPassword: z.string().min(10, 'Passwort muss mindestens 10 Zeichen haben').max(128)
});

router.post('/password-reset-confirm', validate({ body: passwordResetConfirmSchema }), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const userId = await userService.consumePasswordResetToken(token);
    if (!userId) {
      return res.status(400).json({ error: 'Token ungültig oder abgelaufen.' });
    }
    await userService.updatePasswordById(userId, newPassword);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * V63.76: DELETE /me - User löscht den eigenen Account.
 * Cascade-Delete via FK: users → objects → tax_records, subscriptions etc.
 * Body: { confirm: 'DELETE_MY_ACCOUNT' } – verhindert versehentliche Calls.
 */
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.user_id;
    if (!userId) return res.status(401).json({ error: 'Nicht angemeldet' });

    const confirm = (req.body && req.body.confirm) || '';
    if (confirm !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: 'Bestätigung fehlt. Body muss { "confirm": "DELETE_MY_ACCOUNT" } enthalten.'
      });
    }

    // Letzter Check: Admin-Account nicht löschbar (Schutz vor System-Lockout)
    const me = await userService.getById(userId);
    if (me && me.role === 'admin') {
      return res.status(403).json({
        error: 'Admin-Accounts können nur über die Datenbank gelöscht werden.'
      });
    }

    await userService.deleteUser(userId);
    res.json({ ok: true, deleted: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────
// V63.80: 2FA-Management-Endpunkte (alle authenticated)
// ─────────────────────────────────────────────────────────────────

/**
 * GET /auth/2fa/status — Status für eingeloggten User
 */
router.get('/2fa/status', authenticate, async (req, res, next) => {
  try {
    const status = await twoFactorService.getStatus(req.user.id);
    res.json(status);
  } catch (err) { next(err); }
});

/**
 * POST /auth/2fa/setup — Startet Setup, gibt QR-Code + Secret zurück
 */
router.post('/2fa/setup', authenticate, async (req, res, next) => {
  try {
    const me = await userService.getById(req.user.id);
    if (!me) return res.status(404).json({ error: 'User nicht gefunden.' });

    // Wenn bereits aktiv → erst disablen
    const status = await twoFactorService.getStatus(req.user.id);
    if (status.enabled) {
      return res.status(400).json({ error: '2FA ist bereits aktiv. Bitte zuerst deaktivieren.' });
    }

    const result = await twoFactorService.setupTotp(req.user.id, me.email);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * POST /auth/2fa/confirm — Bestätigt Setup mit erstem Code
 *   body: { code: "123456" }
 *   returns: { success, recoveryCodes: [...] }
 */
const confirmSchema = z.object({ code: z.string().min(4).max(10) });
router.post('/2fa/confirm', authenticate, validate({ body: confirmSchema }), async (req, res, next) => {
  try {
    const result = await twoFactorService.confirmTotpSetup(req.user.id, req.body.code);
    await objectService.logAudit({
      userId: req.user.id,
      action: '2fa_enabled',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || '2FA-Setup konnte nicht bestätigt werden.' });
  }
});

/**
 * POST /auth/2fa/disable — Deaktiviert 2FA, verlangt aktuellen Code
 *   body: { code: "123456" }
 */
const disableSchema = z.object({ code: z.string().min(4).max(10) });
router.post('/2fa/disable', authenticate, validate({ body: disableSchema }), async (req, res, next) => {
  try {
    const result = await twoFactorService.disableTotp(req.user.id, req.body.code);
    await objectService.logAudit({
      userId: req.user.id,
      action: '2fa_disabled',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || '2FA-Deaktivierung fehlgeschlagen.' });
  }
});

/**
 * POST /auth/2fa/regenerate-codes — neue Recovery-Codes (verlangt aktuellen TOTP-Code)
 */
router.post('/2fa/regenerate-codes', authenticate, validate({ body: confirmSchema }), async (req, res, next) => {
  try {
    // Erst Code verifizieren — Anti-Hijack
    const speakeasy = require('speakeasy');
    const { query } = require('../db/pool');
    const r = await query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows.length || !r.rows[0].totp_enabled) {
      return res.status(400).json({ error: '2FA ist nicht aktiv.' });
    }
    const verified = speakeasy.totp.verify({
      secret: r.rows[0].totp_secret,
      encoding: 'base32',
      token: String(req.body.code).replace(/\s/g, ''),
      window: 1
    });
    if (!verified) {
      return res.status(400).json({ error: 'Code ungültig — bitte aktuellen Code eingeben.' });
    }

    const codes = await twoFactorService._regenerateRecoveryCodes(req.user.id);
    await objectService.logAudit({
      userId: req.user.id,
      action: '2fa_recovery_codes_regenerated',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json({ recoveryCodes: codes });
  } catch (err) { next(err); }
});

module.exports = router;
