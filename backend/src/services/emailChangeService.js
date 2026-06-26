'use strict';
/**
 * v796 — Email-Change-Service
 *
 * Token-basierter E-Mail-Wechsel:
 *  - requestChange(userId, newEmail): erzeugt Token (type='change_email'),
 *    speichert die neue Adresse im Token-Payload, gibt Token + neue Adresse zurueck.
 *  - consumeChange(token): validiert, setzt die neue Adresse beim User, markiert Token verbraucht.
 *
 * Nutzt die bestehende email_tokens-Tabelle (Migration 004). Die neue Adresse wird
 * in der Spalte `payload` (falls vorhanden) ODER in einem zweiten Token-Feld gehalten.
 * Da email_tokens evtl. keine payload-Spalte hat, speichern wir die neue Adresse
 * in der Spalte `new_value` falls vorhanden — sonst legen wir sie via separater
 * Tabelle email_change_pending an (idempotent erstellt).
 *
 * Tokens 1h gueltig.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');

const TOKEN_LIFETIME_HOURS = 1;

function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Eigene kleine Pending-Tabelle — robust, unabhaengig vom email_tokens-Schema.
async function _ensurePendingTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS email_change_pending (
      id          BIGSERIAL PRIMARY KEY,
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      new_email   VARCHAR(255) NOT NULL,
      token_hash  VARCHAR(64) NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ecp_token ON email_change_pending(token_hash)`);
}

async function requestChange(userId, newEmail) {
  await _ensurePendingTable();
  const email = String(newEmail || '').trim().toLowerCase();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    const e = new Error('Ungültige E-Mail-Adresse.'); e.code = 'INVALID_EMAIL'; throw e;
  }

  // Schon vergeben?
  const dup = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2', [email, userId]);
  if (dup.rowCount > 0) {
    const e = new Error('Diese E-Mail-Adresse wird bereits verwendet.'); e.code = 'EMAIL_EXISTS'; throw e;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = _hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_HOURS * 60 * 60 * 1000);

  // Alte offene Anfragen dieses Users entfernen
  await query('DELETE FROM email_change_pending WHERE user_id = $1 AND used_at IS NULL', [userId]);
  await query(
    'INSERT INTO email_change_pending (user_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, email, tokenHash, expiresAt]
  );

  return { token, newEmail: email };
}

async function consumeChange(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  await _ensurePendingTable();
  const tokenHash = _hashToken(token);

  const r = await query(
    'SELECT id, user_id, new_email, expires_at, used_at FROM email_change_pending WHERE token_hash = $1',
    [tokenHash]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  // Nochmal pruefen, dass die Adresse noch frei ist
  const dup = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2', [row.new_email, row.user_id]);
  if (dup.rowCount > 0) {
    const e = new Error('Diese E-Mail-Adresse wird inzwischen bereits verwendet.'); e.code = 'EMAIL_EXISTS'; throw e;
  }

  await query('UPDATE users SET email = $1 WHERE id = $2', [row.new_email, row.user_id]);
  await query('UPDATE email_change_pending SET used_at = NOW() WHERE id = $1', [row.id]);

  return { userId: row.user_id, newEmail: row.new_email };
}

module.exports = { requestChange, consumeChange, TOKEN_LIFETIME_HOURS };
