'use strict';
/* apiKeyService.js — DealPilot API-Keys (mand v807)
 * Klartext-Key nur EINMAL bei Erstellung sichtbar. Gespeichert wird nur der sha256-Hash. */
const crypto = require('crypto');
const { query } = require('../db/pool');

function _gen() {
  // dpk_live_ + 48 Hex-Zeichen
  return 'dpk_live_' + crypto.randomBytes(24).toString('hex');
}
function _hash(plain) {
  return crypto.createHash('sha256').update(String(plain)).digest('hex');
}
function _prefix(plain) {
  return String(plain).slice(0, 16); // "dpk_live_" + 7 Zeichen
}

async function createForUser(userId, opts) {
  opts = opts || {};
  const plain = _gen();
  const hash = _hash(plain);
  const prefix = _prefix(plain);
  const name = String(opts.name || 'DealPilot API').slice(0, 80);
  let r;
  if (opts.expiresInDays) {
    r = await query(
      "INSERT INTO api_keys (user_id, name, key_prefix, key_hash, expires_at) " +
      "VALUES ($1,$2,$3,$4, NOW() + ($5 || ' days')::interval) " +
      "RETURNING id, name, key_prefix, scopes, created_at, expires_at",
      [userId, name, prefix, hash, String(opts.expiresInDays)]
    );
  } else {
    r = await query(
      "INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES ($1,$2,$3,$4) " +
      "RETURNING id, name, key_prefix, scopes, created_at, expires_at",
      [userId, name, prefix, hash]
    );
  }
  return Object.assign({ plain: plain }, r.rows[0]);
}

async function listForUser(userId) {
  const r = await query(
    "SELECT id, name, key_prefix, scopes, created_at, last_used_at, expires_at, revoked_at " +
    "FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC",
    [userId]
  );
  return r.rows;
}

async function countActive(userId) {
  const r = await query(
    "SELECT COUNT(*)::int AS n FROM api_keys " +
    "WHERE user_id=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())",
    [userId]
  );
  return r.rows[0].n;
}

async function revoke(userId, id) {
  const r = await query(
    "UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id",
    [id, userId]
  );
  return { ok: r.rowCount > 0 };
}

async function findValidByPlaintext(plain) {
  if (!plain || typeof plain !== 'string') return null;
  const hash = _hash(plain);
  const r = await query(
    "SELECT id, user_id, scopes FROM api_keys " +
    "WHERE key_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1",
    [hash]
  );
  return r.rowCount ? r.rows[0] : null;
}

async function touchLastUsed(id) {
  await query("UPDATE api_keys SET last_used_at=NOW() WHERE id=$1", [id]);
}

/* ===== Admin ===== */
async function adminList(userId) { return listForUser(userId); }
async function adminCreate(userId, opts) { return createForUser(userId, opts); }
async function adminRevoke(id) {
  const r = await query("UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL RETURNING id", [id]);
  return { ok: r.rowCount > 0 };
}
async function adminExtend(id, days) {
  const r = await query(
    "UPDATE api_keys SET expires_at = GREATEST(COALESCE(expires_at, NOW()), NOW()) + ($2 || ' days')::interval, " +
    "revoked_at = NULL WHERE id=$1 RETURNING id, expires_at",
    [id, String(days)]
  );
  return r.rowCount ? { ok: true, expires_at: r.rows[0].expires_at } : { ok: false };
}

module.exports = {
  createForUser, listForUser, countActive, revoke,
  findValidByPlaintext, touchLastUsed,
  adminList, adminCreate, adminRevoke, adminExtend
};
