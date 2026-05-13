'use strict';
/**
 * V63.80: 2FA-Service (TOTP + Recovery-Codes)
 * ────────────────────────────────────────────
 * - TOTP-Standard (RFC 6238) via speakeasy
 * - QR-Code-Generierung als Data-URL (kein File-Upload nötig)
 * - 8 Recovery-Codes pro Setup, gehasht gespeichert (bcrypt)
 * - Pre-Auth-Tokens für 2FA-Login-Schritt (5 Min Lebensdauer)
 *
 * Flow Aktivierung:
 *   1. setupTotp(userId)              → { secret, qrDataUrl, otpauthUrl }
 *   2. confirmTotpSetup(userId, code) → { success, recoveryCodes[8] }
 *
 * Flow Login mit 2FA:
 *   1. createPreAuthToken(userId)
 *   2. verifyTotpForLogin(token, code) → { userId } oder Fehler
 *   3. (alternativ) verifyRecoveryCode(token, code)
 *
 * Flow Deaktivierung:
 *   1. disableTotp(userId, currentCode) → setzt totp_enabled=false, löscht secret + recovery codes
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { query } = require('../db/pool');

const ISSUER = process.env.TOTP_ISSUER || 'DealPilot';

// ───────────────────────── Setup-Phase ─────────────────────────

/**
 * Generiert ein neues TOTP-Secret + QR-Code für einen User.
 * WICHTIG: Speichert Secret in DB, aber setzt totp_enabled=false bis confirmTotpSetup.
 */
async function setupTotp(userId, userEmail) {
  if (!userId || !userEmail) throw new Error('userId und userEmail sind Pflicht');

  // Secret erzeugen
  const secret = speakeasy.generateSecret({
    length: 20,
    name: ISSUER + ':' + userEmail,
    issuer: ISSUER
  });

  // In DB speichern (überschreibt evtl. vorherigen Setup-Versuch)
  await query(
    'UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2',
    [secret.base32, userId]
  );

  // QR-Code als Data-URL generieren (otpauth:// URL)
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 1,
    width: 220
  });

  return {
    secret: secret.base32,        // für manuelle Eingabe in der App
    qrDataUrl: qrDataUrl,
    otpauthUrl: secret.otpauth_url
  };
}

/**
 * User hat 6-stelligen Code aus seiner App eingegeben — wir verifizieren.
 * Bei Erfolg: totp_enabled = true, totp_setup_at = NOW(), generieren Recovery-Codes.
 */
async function confirmTotpSetup(userId, userInputCode) {
  if (!userId || !userInputCode) throw new Error('userId und Code sind Pflicht');

  const r = await query('SELECT totp_secret FROM users WHERE id = $1', [userId]);
  if (!r.rows.length || !r.rows[0].totp_secret) {
    throw new Error('Kein 2FA-Setup gefunden — bitte zuerst Setup starten.');
  }
  const secret = r.rows[0].totp_secret;

  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: String(userInputCode).replace(/\s/g, ''),
    window: 1     // Toleranz: ±30 Sek
  });

  if (!verified) {
    throw new Error('Code ungültig — bitte aktuellen Code aus deiner Authenticator-App eingeben.');
  }

  // Aktivieren
  await query(
    'UPDATE users SET totp_enabled = TRUE, totp_setup_at = NOW() WHERE id = $1',
    [userId]
  );

  // Recovery-Codes generieren (8 Stück, je 10 Zeichen)
  const recoveryCodes = await _regenerateRecoveryCodes(userId);

  return {
    success: true,
    recoveryCodes: recoveryCodes
  };
}

/**
 * Generiert 8 neue Recovery-Codes, löscht alte.
 * Liefert Klartext-Codes (nur einmal — danach nur noch Hash in DB).
 */
async function _regenerateRecoveryCodes(userId) {
  await query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);

  const codes = [];
  for (let i = 0; i < 8; i++) {
    // Format: XXXX-XXXX (Buchstaben + Ziffern, ohne 0/O/1/I für Lesbarkeit)
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let raw = '';
    for (let j = 0; j < 10; j++) {
      raw += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
      if (j === 4) raw += '-';
    }
    codes.push(raw);
  }

  // Hash + speichern
  for (const code of codes) {
    const hash = await bcrypt.hash(code, 10);
    await query(
      'INSERT INTO user_recovery_codes (user_id, code_hash) VALUES ($1, $2)',
      [userId, hash]
    );
  }

  return codes;
}

// ───────────────────────── Login-Phase ─────────────────────────

/**
 * Erzeugt einen kurzlebigen Pre-Auth-Token (5 Min) für die 2FA-Verifikation.
 * Wird nach erfolgreicher Passwort-Prüfung erzeugt, falls totp_enabled=true.
 */
async function createPreAuthToken(userId) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);   // 5 Minuten
  await query(
    'INSERT INTO auth_pre_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt]
  );
  return token;
}

async function _consumePreAuthToken(token) {
  // Cleanup abgelaufener Tokens (best-effort, idempotent)
  await query('DELETE FROM auth_pre_tokens WHERE expires_at < NOW()');

  const r = await query(
    'SELECT user_id, expires_at FROM auth_pre_tokens WHERE token = $1',
    [token]
  );
  if (!r.rows.length) return null;
  if (new Date(r.rows[0].expires_at) < new Date()) return null;

  // Token verbrauchen — egal ob Code stimmt oder nicht (Anti-Brute-Force)
  await query('DELETE FROM auth_pre_tokens WHERE token = $1', [token]);
  return r.rows[0].user_id;
}

/**
 * Prüft den 6-stelligen TOTP-Code beim Login.
 * Gibt userId zurück bei Erfolg, sonst null.
 */
async function verifyTotpForLogin(preAuthToken, userInputCode) {
  const userId = await _consumePreAuthToken(preAuthToken);
  if (!userId) return null;

  const r = await query(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
    [userId]
  );
  if (!r.rows.length || !r.rows[0].totp_enabled || !r.rows[0].totp_secret) return null;

  const verified = speakeasy.totp.verify({
    secret: r.rows[0].totp_secret,
    encoding: 'base32',
    token: String(userInputCode).replace(/\s/g, ''),
    window: 1
  });

  return verified ? userId : null;
}

/**
 * Prüft einen Recovery-Code beim Login (Alternative zu TOTP).
 * Code wird nach Verbrauch markiert.
 */
async function verifyRecoveryCode(preAuthToken, userInputCode) {
  const userId = await _consumePreAuthToken(preAuthToken);
  if (!userId) return null;

  const cleanCode = String(userInputCode).trim().toUpperCase();

  const r = await query(
    'SELECT id, code_hash FROM user_recovery_codes WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );
  if (!r.rows.length) return null;

  for (const row of r.rows) {
    const match = await bcrypt.compare(cleanCode, row.code_hash);
    if (match) {
      // Code als verbraucht markieren
      await query(
        'UPDATE user_recovery_codes SET used_at = NOW() WHERE id = $1',
        [row.id]
      );
      return userId;
    }
  }

  return null;
}

// ───────────────────────── Status & Disable ─────────────────────────

async function getStatus(userId) {
  const r = await query(
    'SELECT totp_enabled, totp_setup_at FROM users WHERE id = $1',
    [userId]
  );
  if (!r.rows.length) return { enabled: false };

  // Anzahl ungenutzter Recovery-Codes
  const codes = await query(
    'SELECT COUNT(*)::int AS n FROM user_recovery_codes WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );

  return {
    enabled: r.rows[0].totp_enabled === true,
    setupAt: r.rows[0].totp_setup_at,
    recoveryCodesRemaining: codes.rows[0].n
  };
}

/**
 * 2FA komplett deaktivieren — verlangt aktuellen TOTP-Code (Anti-Hijack).
 */
async function disableTotp(userId, currentCode) {
  const r = await query(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
    [userId]
  );
  if (!r.rows.length || !r.rows[0].totp_enabled) {
    throw new Error('2FA ist nicht aktiv.');
  }

  const verified = speakeasy.totp.verify({
    secret: r.rows[0].totp_secret,
    encoding: 'base32',
    token: String(currentCode).replace(/\s/g, ''),
    window: 1
  });

  if (!verified) {
    throw new Error('Code ungültig — bitte aktuellen Code zur Bestätigung eingeben.');
  }

  await query(
    'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, totp_setup_at = NULL WHERE id = $1',
    [userId]
  );
  await query('DELETE FROM user_recovery_codes WHERE user_id = $1', [userId]);

  return { success: true };
}

/**
 * Liefert ob für einen User 2FA aktiv ist (für Login-Flow).
 */
async function isEnabled(userId) {
  const r = await query('SELECT totp_enabled FROM users WHERE id = $1', [userId]);
  return r.rows.length > 0 && r.rows[0].totp_enabled === true;
}

module.exports = {
  setupTotp,
  confirmTotpSetup,
  createPreAuthToken,
  verifyTotpForLogin,
  verifyRecoveryCode,
  getStatus,
  disableTotp,
  isEnabled,
  _regenerateRecoveryCodes   // exposed für Endpoint "neue Recovery-Codes"
};
