'use strict';
const { query } = require('../db/pool');
const { HttpError } = require('../middleware/errors');

/**
 * Extract summary fields from data for indexing
 */
function extractSummary(data) {
  const d = data || {};
  return {
    name: d._name || [d.str, d.hnr, d.ort].filter(Boolean).join(' ') || 'Unbenannt',
    kuerzel: d.kuerzel || null,
    ort: d.ort || null,
    kaufpreis: d.kp ? parseFloat(d.kp) : null,
    bmy: d._kpis_bmy != null ? parseFloat(d._kpis_bmy) : null,
    cf_ns: d._kpis_cf_ns != null ? parseFloat(d._kpis_cf_ns) : null,
    dscr: d._kpis_dscr != null ? parseFloat(d._kpis_dscr) : null,
    seq_no: d._obj_seq || null
  };
}

/**
 * Sanitize numeric value for SQL (NUMERIC accepts NaN as error)
 */
function safeNumeric(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  if (isNaN(n) || !isFinite(n)) return null;
  return n;
}

async function listForUser(userId, { limit = 100, offset = 0 } = {}) {
  // V29: Erstes Photo als thumbnail mit liefern, damit die Sidebar-Cards
  // im API-Mode auch Bilder zeigen (vorher photoSrc immer null).
  // photos ist eine JSON-Array-Spalte mit base64-Strings — wir nehmen photos[0].
  // V63.25: _ds2_computed aus dem data-Blob mit ausliefern, damit das Investor-Sternchen
  // nur erscheint wenn der echte DS2-Score berechnet wurde (DS2-Felder ausgefüllt).
  // V63.26: Plus die persistierten Score-Werte (_dealpilot_score, _ds2_score) damit
  // die Sidebar-Karte exakt den gleichen Score zeigt wie Tab Kennzahlen.
  const r = await query(
    `SELECT id, name, kuerzel, ort, kaufpreis, bmy, cf_ns, dscr, seq_no,
            version, created_at, updated_at,
            CASE WHEN ai_analysis IS NULL OR ai_analysis = '' THEN false ELSE true END AS has_ai,
            COALESCE((data::jsonb->>'_ds2_computed')::boolean, false) AS ds2_computed,
            (data::jsonb->>'_dealpilot_score')::int AS dealpilot_score,
            (data::jsonb->>'_ds2_score')::int AS ds2_score_persist,
            -- V104: Deal-Status "Zuschlag bekommen" — Filter für Track-Record/Bankexport
            COALESCE((data::jsonb->>'_deal_won')::boolean, false) AS deal_won,
            data::jsonb->>'_deal_won_at' AS deal_won_at,
            -- V110: LTV mitliefern damit die Sidebar-DSCR-Card per Klick zu LTV toggeln kann
            (data::jsonb->>'_kpis_ltv')::numeric AS ltv,
            CASE
              WHEN photos IS NOT NULL AND jsonb_typeof(photos::jsonb) = 'array' AND jsonb_array_length(photos::jsonb) > 0
              THEN photos::jsonb->>0
              ELSE NULL
            END AS thumbnail
     FROM objects
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return r.rows;
}

async function getById(userId, objectId) {
  const r = await query(
    `SELECT id, user_id, name, kuerzel, ort, kaufpreis, bmy, cf_ns, dscr,
            data, ai_analysis, photos, version, created_at, updated_at
     FROM objects
     WHERE id = $1 AND user_id = $2`,
    [objectId, userId]
  );
  return r.rows[0] || null;
}

async function create(userId, { data, aiAnalysis, photos }) {
  const summary = extractSummary(data);
  // V23: Wenn der Client noch keine Sequenznummer hat, vergibt der Server eine
  // (atomar — verhindert Doppel-Nummern bei parallelen Saves).
  let seq = summary.seq_no;
  if (!seq) {
    const year = new Date().getFullYear();
    const seqResult = await query('SELECT get_next_obj_seq($1, $2) AS seq', [userId, year]);
    seq = seqResult.rows[0].seq;
    // Auch im data-Blob hinterlegen, damit Client beim nächsten GET die Nummer bekommt
    if (data && typeof data === 'object') data._obj_seq = seq;
  }
  const r = await query(
    `INSERT INTO objects
       (user_id, name, kuerzel, ort, kaufpreis, bmy, cf_ns, dscr, seq_no, data, ai_analysis, photos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, name, seq_no, version, created_at, updated_at`,
    [
      userId,
      summary.name,
      summary.kuerzel,
      summary.ort,
      safeNumeric(summary.kaufpreis),
      safeNumeric(summary.bmy),
      safeNumeric(summary.cf_ns),
      safeNumeric(summary.dscr),
      seq,
      JSON.stringify(data || {}),
      aiAnalysis || null,
      JSON.stringify(photos || [])
    ]
  );
  return r.rows[0];
}

async function update(userId, objectId, { data, aiAnalysis, photos, expectedVersion }) {
  // Check ownership and version
  const existing = await query(
    'SELECT user_id, version FROM objects WHERE id = $1',
    [objectId]
  );
  if (existing.rowCount === 0) throw new HttpError(404, 'Object not found');
  if (existing.rows[0].user_id !== userId) throw new HttpError(403, 'Not authorized');

  if (expectedVersion != null && existing.rows[0].version !== expectedVersion) {
    throw new HttpError(409, `Version conflict (expected ${expectedVersion}, got ${existing.rows[0].version})`);
  }

  const summary = extractSummary(data);
  // V63.25: seq_no MUSS auch im UPDATE gesetzt werden — sonst wird die ID-Änderung
  // im Frontend zwar in data._obj_seq gespeichert, aber die seq_no-Spalte (die der
  // Listen-Endpoint zurückgibt) bleibt auf der alten Nummer → Sidebar zeigt alte ID
  // bis zum nächsten Reload.
  const r = await query(
    `UPDATE objects SET
       name = $1, kuerzel = $2, ort = $3, kaufpreis = $4, bmy = $5, cf_ns = $6, dscr = $7,
       seq_no = COALESCE($8, seq_no),
       data = $9, ai_analysis = $10, photos = $11, version = version + 1
     WHERE id = $12 AND user_id = $13
     RETURNING id, name, seq_no, version, updated_at`,
    [
      summary.name,
      summary.kuerzel,
      summary.ort,
      safeNumeric(summary.kaufpreis),
      safeNumeric(summary.bmy),
      safeNumeric(summary.cf_ns),
      safeNumeric(summary.dscr),
      summary.seq_no,
      JSON.stringify(data || {}),
      aiAnalysis || null,
      JSON.stringify(photos || []),
      objectId,
      userId
    ]
  );
  return r.rows[0];
}

async function deleteObject(userId, objectId) {
  const r = await query(
    'DELETE FROM objects WHERE id = $1 AND user_id = $2 RETURNING id',
    [objectId, userId]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'Object not found');
}

async function logAudit({ userId, action, resourceType, resourceId, ipAddress, userAgent, metadata }) {
  await query(
    `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, action, resourceType || null, resourceId || null, ipAddress || null, userAgent || null,
     metadata ? JSON.stringify(metadata) : null]
  );
}

module.exports = {
  listForUser,
  getById,
  create,
  update,
  deleteObject,
  logAudit
};
