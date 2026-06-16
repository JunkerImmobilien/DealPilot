'use strict';
// Quick Boarding Shared Pass  (marker: qb-shared-pass)
const crypto = require('crypto');
const { query } = require('../db/pool');
const objectService = require('./objectService');
const { HttpError } = require('../middleware/errors');

const DEFAULT_DAYS = 30;
const MAX_DAYS = 30;
// Crockford Base32 (ohne I, L, O, U) -> gut lesbar, nicht erratbar
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function genCode(len) {
  len = len || 10;
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

function clampDays(days) {
  const d = parseInt(days, 10);
  if (!Number.isFinite(d) || d < 1) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, d);
}

// Snapshot eines EIGENEN Objekts anlegen (eingefroren)
async function createForObject(userId, objectId, opts) {
  opts = opts || {};
  const obj = await objectService.getById(userId, objectId);
  if (!obj) throw new HttpError(404, 'Object not found');

  const d = clampDays(opts.days);
  const snapshot = {
    data: obj.data || {},
    ai_analysis: obj.ai_analysis || null,
    photos: Array.isArray(obj.photos) ? obj.photos : [],
    name: obj.name || null
  };
  const title =
    obj.name ||
    (obj.data && (obj.data.str || obj.data.ort)) ||
    'Quick Boarding Pass';

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode(10);
    try {
      const r = await query(
        `INSERT INTO shared_passes (code, owner_user_id, object_id, title, snapshot, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6::int))
         RETURNING code, expires_at, created_at`,
        [code, userId, objectId, title, JSON.stringify(snapshot), d]
      );
      return r.rows[0];
    } catch (err) {
      if (err && err.code === '23505') continue; // unique-violation -> neuer Code
      throw err;
    }
  }
  throw new HttpError(500, 'Could not allocate pass code');
}

// qb-snapshot: Pass aus Zwischenspeicher (kein Objekt) anlegen/aktualisieren. object_id bleibt NULL.
async function upsertSnapshotPass(userId, opts) {
  opts = opts || {};
  const d = clampDays(opts.days);
  const data = (opts.data && typeof opts.data === 'object') ? opts.data : {};
  const title = (opts.title && String(opts.title).slice(0, 255)) || data.str || data.ort || 'Quick Boarding Pass';
  const snapshot = { data: data, name: title, source: 'qc-buffer' };   /* qb-snap-photos */
  if (Array.isArray(opts.photos) && opts.photos.length) snapshot.photos = opts.photos.slice(0, 6);

  if (opts.code) {
    const u = await query(
      `UPDATE shared_passes SET snapshot = $3, title = $4
         WHERE code = $1 AND owner_user_id = $2 AND revoked_at IS NULL
         RETURNING code, expires_at, created_at`,
      [opts.code, userId, JSON.stringify(snapshot), title]
    );
    if (u.rowCount) return u.rows[0];
    // sonst faellt durch -> neuer Pass
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode(10);
    try {
      const r = await query(
        `INSERT INTO shared_passes (code, owner_user_id, object_id, title, snapshot, expires_at)
         VALUES ($1, $2, NULL, $3, $4, now() + make_interval(days => $5::int))
         RETURNING code, expires_at, created_at`,
        [code, userId, title, JSON.stringify(snapshot), d]
      );
      return r.rows[0];
    } catch (err) {
      if (err && err.code === '23505') continue;
      throw err;
    }
  }
  throw new HttpError(500, 'Could not allocate pass code');
}

// Oeffentlich lesen (kein Auth) — gibt Status zurueck statt zu werfen
async function getPublic(code) {
  const r = await query(
    `SELECT code, title, snapshot, expires_at, revoked_at, created_at
       FROM shared_passes WHERE code = $1`,
    [code]
  );
  if (r.rowCount === 0) return { status: 'not_found' };
  const p = r.rows[0];
  if (p.revoked_at) return { status: 'revoked' };
  if (new Date(p.expires_at).getTime() < Date.now()) return { status: 'expired' };
  await query('UPDATE shared_passes SET view_count = view_count + 1 WHERE code = $1', [code]);
  return {
    status: 'ok',
    pass: {
      code: p.code,
      title: p.title,
      snapshot: p.snapshot,
      expires_at: p.expires_at,
      created_at: p.created_at
    }
  };
}

// Uebernehmen -> klont als eigenes Objekt
async function claim(userId, code) {
  const r = await query('SELECT * FROM shared_passes WHERE code = $1', [code]);
  if (r.rowCount === 0) throw new HttpError(404, 'Pass not found');
  const p = r.rows[0];
  if (p.revoked_at) throw new HttpError(410, 'Pass revoked');
  if (new Date(p.expires_at).getTime() < Date.now()) throw new HttpError(410, 'Pass expired');

  const snap = p.snapshot || {};
  const created = await objectService.create(userId, {
    data: snap.data || {},
    aiAnalysis: snap.ai_analysis || null,
    photos: Array.isArray(snap.photos) ? snap.photos : []
  });
  await query('UPDATE shared_passes SET claim_count = claim_count + 1 WHERE code = $1', [code]);
  return created;
}

// Eigene Paesse auflisten (zum Verwalten/Widerrufen)
async function listForOwner(userId) {
  const r = await query(
    `SELECT code, title, view_count, claim_count, created_at, expires_at, revoked_at
       FROM shared_passes WHERE owner_user_id = $1
       ORDER BY created_at DESC LIMIT 200`,
    [userId]
  );
  return r.rows;
}

async function revoke(userId, code) {
  const r = await query(
    `UPDATE shared_passes SET revoked_at = now()
       WHERE code = $1 AND owner_user_id = $2 AND revoked_at IS NULL
       RETURNING code`,
    [code, userId]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'Pass not found');
  return { code, revoked: true };
}

async function extend(userId, code, days) {
  const d = clampDays(days);
  const r = await query(
    `UPDATE shared_passes
        SET expires_at = now() + make_interval(days => $3::int), revoked_at = NULL
      WHERE code = $1 AND owner_user_id = $2
      RETURNING code, expires_at`,
    [code, userId, d]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'Pass not found');
  return r.rows[0];
}

// Optionaler Cleanup (per Cron/manuell): laengst abgelaufene entfernen
async function purgeExpired() {
  const r = await query(`DELETE FROM shared_passes WHERE expires_at < now() - interval '7 days'`);
  return r.rowCount;
}

module.exports = {
  createForObject, upsertSnapshotPass, getPublic, claim, listForOwner, revoke, extend, purgeExpired, genCode
};
