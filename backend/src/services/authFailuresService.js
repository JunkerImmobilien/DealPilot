'use strict';
/**
 * V204 SECURITY-FIX (H6): Account-Lockout nach Fehlversuchen.
 *
 * Vor Login-Versuch:    checkLock(userId) → wirft 423 wenn gelockt
 * Nach Fehlversuch:     recordFailure(userId, ip) — erhöht count, setzt Lock
 * Nach Erfolg:          recordSuccess(userId) — reset auf 0
 *
 * Eskalations-Stufen:
 *   count 1-4:  kein Lock
 *   count 5:    5 min
 *   count 6:    15 min
 *   count 7:    1h
 *   count 8+:   24h
 */

const { query } = require('../db/pool');

function _lockDurationMinutes(count) {
  if (count < 5)  return 0;
  if (count === 5) return 5;
  if (count === 6) return 15;
  if (count === 7) return 60;
  return 24 * 60;  // 8+ = 24h
}

/**
 * Prüft ob ein User aktuell gelockt ist.
 * Liefert null wenn nicht gelockt, sonst { lockedUntil, remainingSeconds }.
 */
async function checkLock(userId) {
  const r = await query(
    `SELECT locked_until FROM auth_failures
     WHERE user_id = $1 AND locked_until > NOW()`,
    [userId]
  );
  if (!r.rowCount) return null;
  const lockedUntil = new Date(r.rows[0].locked_until);
  const remainingSeconds = Math.max(0, Math.floor((lockedUntil - new Date()) / 1000));
  return { lockedUntil, remainingSeconds };
}

/**
 * Fehlversuch verbuchen + ggf. Lock setzen.
 */
async function recordFailure(userId, ipAddress) {
  // Upsert: count++ und last_attempt_at = NOW
  const r = await query(
    `INSERT INTO auth_failures (user_id, count, last_attempt_at, last_attempt_ip)
     VALUES ($1, 1, NOW(), $2)
     ON CONFLICT (user_id) DO UPDATE
       SET count = auth_failures.count + 1,
           last_attempt_at = NOW(),
           last_attempt_ip = $2
     RETURNING count`,
    [userId, ipAddress || null]
  );
  const newCount = r.rows[0].count;
  const lockMinutes = _lockDurationMinutes(newCount);

  if (lockMinutes > 0) {
    await query(
      `UPDATE auth_failures
         SET locked_until = NOW() + ($1 || ' minutes')::interval
       WHERE user_id = $2`,
      [String(lockMinutes), userId]
    );
  }
  return { count: newCount, lockMinutes };
}

/**
 * Erfolgreicher Login → Reset.
 */
async function recordSuccess(userId) {
  await query(
    `UPDATE auth_failures
       SET count = 0, locked_until = NULL, last_attempt_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );
}

module.exports = {
  checkLock,
  recordFailure,
  recordSuccess
};
