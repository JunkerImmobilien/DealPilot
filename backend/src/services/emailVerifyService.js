'use strict';
/**
 * V169 — Email-Verification-Service
 *
 * Token-basierter Mail-Bestätigungs-Flow:
 * - createVerifyToken(userId): generiert Token, speichert in email_tokens
 * - consumeVerifyToken(token): validiert + markiert verbraucht, gibt user_id zurück
 *
 * Nutzt bestehende email_tokens-Tabelle (Migration 004) mit type='verify_email'.
 * Tokens sind 24h gültig.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');

const TOKEN_LIFETIME_HOURS = 24;

function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createVerifyToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = _hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_HOURS * 60 * 60 * 1000);

  // Alte unverbrauchte Verify-Tokens dieses Users löschen
  await query(
    `DELETE FROM email_tokens WHERE user_id = $1 AND type = 'verify_email' AND used_at IS NULL`,
    [userId]
  );

  await query(
    `INSERT INTO email_tokens (user_id, type, token_hash, expires_at)
     VALUES ($1, 'verify_email', $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return token;  // Plain-Token, wird per Mail verschickt; nur Hash wird gespeichert
}

async function consumeVerifyToken(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  const tokenHash = _hashToken(token);

  const r = await query(
    `SELECT id, user_id, expires_at, used_at
       FROM email_tokens
      WHERE token_hash = $1 AND type = 'verify_email'`,
    [tokenHash]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.used_at) return null;  // Schon verbraucht
  if (new Date(row.expires_at) < new Date()) return null;  // Abgelaufen

  // Als verbraucht markieren
  await query(
    `UPDATE email_tokens SET used_at = NOW() WHERE id = $1`,
    [row.id]
  );

  return row.user_id;
}

module.exports = {
  createVerifyToken,
  consumeVerifyToken,
  TOKEN_LIFETIME_HOURS
};
