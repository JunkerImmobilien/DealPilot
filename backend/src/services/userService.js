'use strict';
const { query } = require('../db/pool');
const password = require('../utils/password');
const { HttpError } = require('../middleware/errors');

/**
 * Create a new user. First user becomes admin.
 */
async function createUser({ email, plainPassword, name }) {
  const emailLower = email.toLowerCase().trim();

  // Check if user exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [emailLower]);
  if (existing.rowCount > 0) {
    throw new HttpError(409, 'Email address already registered');
  }

  // First user = admin
  const countResult = await query('SELECT COUNT(*) AS cnt FROM users');
  const isFirstUser = parseInt(countResult.rows[0].cnt, 10) === 0;
  const role = isFirstUser ? 'admin' : 'user';

  const hash = await password.hash(plainPassword);
  const r = await query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at`,
    [emailLower, hash, name.trim(), role]
  );
  return r.rows[0];
}

/**
 * Verify credentials and return user (without password hash)
 *
 * V204 SECURITY-FIX (H6): Brute-Force-Schutz auf Account-Ebene.
 *   - Vor Passwort-Check: wenn User gelockt → 423 mit retry-after
 *   - Nach Fehlversuch: count++, ab 5 → Lockout (eskalierend bis 24h)
 *   - Nach Erfolg: count reset
 *
 * WICHTIG für User-Enumeration-Schutz:
 *   - Wenn User nicht existiert → "Invalid email or password" wie bisher
 *   - Wenn User existiert + gelockt → "Account temporarily locked" (HTTP 423)
 *     (das ist OK weil Angreifer dafür valide Email kennen UND mehrfach
 *     falsches PW eingegeben haben müsste — Reset ist die Antwort)
 */
async function authenticate({ email, plainPassword, ipAddress }) {
  const emailLower = email.toLowerCase().trim();
  const r = await query(
    `SELECT id, email, password_hash, name, role, is_active
     FROM users WHERE email = $1`,
    [emailLower]
  );
  if (r.rowCount === 0) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const user = r.rows[0];

  // V204 H6: Lockout-Check vor Passwort-Vergleich
  const authFailuresService = require('./authFailuresService');
  const lockInfo = await authFailuresService.checkLock(user.id);
  if (lockInfo) {
    const min = Math.ceil(lockInfo.remainingSeconds / 60);
    const err = new HttpError(423,
      'Konto vorübergehend gesperrt wegen zu vieler Fehlversuche. ' +
      'Bitte in ' + min + ' Minute' + (min === 1 ? '' : 'n') + ' erneut versuchen.');
    err.retryAfter = lockInfo.remainingSeconds;
    throw err;
  }

  const ok = await password.verify(plainPassword, user.password_hash);
  if (!ok) {
    // V204 H6: Fehlversuch zählen
    try {
      await authFailuresService.recordFailure(user.id, ipAddress);
    } catch (e) { /* nicht kritisch */ }
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.is_active) {
    throw new HttpError(403, 'Account is disabled');
  }

  // V204 H6: Erfolg → Fehlversuche zurücksetzen
  try {
    await authFailuresService.recordSuccess(user.id);
  } catch (e) { /* nicht kritisch */ }

  // Update last login
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

async function getById(id) {
  const r = await query(
    `SELECT id, email, name, role, is_active, last_login_at, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function listAll({ limit = 100, offset = 0 } = {}) {
  const r = await query(
    `SELECT id, email, name, role, is_active, last_login_at, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows;
}

async function changePassword({ userId, oldPassword, newPassword }) {
  const r = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (r.rowCount === 0) throw new HttpError(404, 'User not found');

  const ok = await password.verify(oldPassword, r.rows[0].password_hash);
  if (!ok) throw new HttpError(401, 'Current password is incorrect');

  const newHash = await password.hash(newPassword);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
}

async function setActive({ userId, isActive }) {
  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId]);
}

async function setRole({ userId, role }) {
  if (!['admin', 'user'].includes(role)) {
    throw new HttpError(400, 'Invalid role');
  }
  await query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
}

async function deleteUser(userId) {
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

/**
 * V42: User per E-Mail finden (für Password-Reset)
 */
async function findByEmail(email) {
  const r = await query(
    'SELECT id, email, name FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  return r.rows[0] || null;
}

/**
 * V42: Reset-Token in DB speichern
 *
 * V204 SECURITY-FIX (H2): Token wird vor Speicherung mit SHA-256 gehasht.
 * Klartext-Token wird nur in der Mail verschickt — bei DB-Kompromittierung
 * sind aktive Reset-Tokens nicht direkt nutzbar.
 */
async function createPasswordResetToken(userId, token, expiresAt) {
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Alte Tokens dieses Users invalidieren
  await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  await query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
}

/**
 * V42: Token einlösen — gibt user_id zurück oder null wenn ungültig/abgelaufen
 *
 * V204 SECURITY-FIX (H2+H3):
 *   - Token wird gehasht verglichen (nicht Klartext)
 *   - DELETE ... RETURNING ist atomar — keine Race Condition mehr
 *     (vorher SELECT + DELETE in zwei Queries, theoretischer Double-Consume möglich)
 */
async function consumePasswordResetToken(token) {
  if (!token || typeof token !== 'string') return null;
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Atomar: nur löschen wenn noch gültig, user_id zurückgeben
  const r = await query(
    `DELETE FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return r.rows[0] ? r.rows[0].user_id : null;
}

/**
 * V42: Passwort direkt by ID setzen (ohne old-password)
 */
async function updatePasswordById(userId, newPassword) {
  const hash = await password.hash(newPassword);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
}

module.exports = {
  createUser,
  authenticate,
  getById,
  listAll,
  changePassword,
  setActive,
  setRole,
  deleteUser,
  findByEmail,
  createPasswordResetToken,
  consumePasswordResetToken,
  updatePasswordById
};
