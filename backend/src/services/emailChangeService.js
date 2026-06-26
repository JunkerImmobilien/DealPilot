'use strict';
/*
 * emailChangeService.js — E-Mail-Wechsel (verify-before-active)
 * - requestChange({userId, newEmail, plainPassword}): prüft Passwort + Verfügbarkeit,
 *   legt Token in email_change_requests an, gibt Token + Daten zurück (Mailversand macht die Route).
 * - confirmChange(token): setzt users.email auf die neue Adresse, markiert Token verbraucht,
 *   gibt alte Adresse + Name für die Benachrichtigungs-Mail zurück.
 * Nutzt Migration 037 (email_change_requests).
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const password = require('../utils/password');
const { HttpError } = require('../middleware/errors');

const TOKEN_LIFETIME_HOURS = 24;

function _hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function requestChange({ userId, newEmail, plainPassword }) {
  const emailLower = String(newEmail || '').toLowerCase().trim();
  if (!emailLower || emailLower.indexOf('@') < 1) {
    throw new HttpError(400, 'Ungültige E-Mail-Adresse');
  }

  const u = await query('SELECT password_hash, email, name FROM users WHERE id = $1', [userId]);
  if (u.rowCount === 0) throw new HttpError(404, 'User nicht gefunden');
  const row = u.rows[0];

  const ok = await password.verify(plainPassword, row.password_hash);
  if (!ok) throw new HttpError(403, 'Passwort falsch');

  if (emailLower === String(row.email).toLowerCase()) {
    throw new HttpError(400, 'Das ist bereits deine aktuelle E-Mail-Adresse');
  }

  const taken = await query('SELECT id FROM users WHERE LOWER(email) = $1', [emailLower]);
  if (taken.rowCount > 0) throw new HttpError(409, 'Diese E-Mail ist bereits vergeben');

  // alte offene Anfragen dieses Users verwerfen
  await query('DELETE FROM email_change_requests WHERE user_id = $1 AND used_at IS NULL', [userId]);

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = _hashToken(token);
  const expires = new Date(Date.now() + TOKEN_LIFETIME_HOURS * 3600 * 1000);
  await query(
    `INSERT INTO email_change_requests (user_id, new_email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, emailLower, tokenHash, expires]
  );

  return { token: token, newEmail: emailLower, currentEmail: row.email, userName: row.name };
}

async function confirmChange(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  const tokenHash = _hashToken(token);

  const r = await query(
    `SELECT id, user_id, new_email FROM email_change_requests
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  if (r.rowCount === 0) return null;
  const reqRow = r.rows[0];

  const u = await query('SELECT email, name FROM users WHERE id = $1', [reqRow.user_id]);
  if (u.rowCount === 0) return null;
  const oldEmail = u.rows[0].email;
  const userName = u.rows[0].name;

  // neue Adresse zwischenzeitlich anderweitig vergeben?
  const taken = await query(
    'SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2',
    [String(reqRow.new_email).toLowerCase(), reqRow.user_id]
  );
  if (taken.rowCount > 0) {
    await query('UPDATE email_change_requests SET used_at = NOW() WHERE id = $1', [reqRow.id]);
    return { error: 'taken' };
  }

  await query('UPDATE users SET email = $1 WHERE id = $2', [reqRow.new_email, reqRow.user_id]);
  await query('UPDATE email_change_requests SET used_at = NOW() WHERE id = $1', [reqRow.id]);

  return { userId: reqRow.user_id, newEmail: reqRow.new_email, oldEmail: oldEmail, userName: userName };
}

module.exports = { requestChange, confirmChange, TOKEN_LIFETIME_HOURS };
