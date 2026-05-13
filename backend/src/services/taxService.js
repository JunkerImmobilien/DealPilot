'use strict';
const { query } = require('../db/pool');
const { HttpError } = require('../middleware/errors');

function safeNumeric(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  if (isNaN(n) || !isFinite(n)) return null;
  return n;
}

/**
 * Upsert a tax record for a specific year of an object.
 */
async function upsert({ userId, objectId, year, data }) {
  const r = await query(
    `INSERT INTO tax_records (
       user_id, object_id, year,
       base_income, marginal_tax_rate,
       einnahmen_vv, schuldzinsen, bewirtschaftung, afa,
       sanierung_erhaltungsaufwand, sonstige_werbungskosten,
       immo_result, tax_before, tax_after, tax_delta, refund, notes,
       kontofuehrung, bereitstellung, notar_grundschuld, vermittlung, finanz_sonst,
       nk_umlf, nk_n_umlf, betr_sonst,
       hausverwaltung, steuerber, porto, verw_sonst,
       fahrtkosten, verpflegung, hotel, inserat, gericht, telefon, sonst_kosten,
       sonst_bewegl_wg, anschaffungsnah, erhaltungsaufwand,
       einnahmen_km, einnahmen_nk
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
       $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
       $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
     )
     ON CONFLICT (user_id, object_id, year) DO UPDATE SET
       base_income = EXCLUDED.base_income,
       marginal_tax_rate = EXCLUDED.marginal_tax_rate,
       einnahmen_vv = EXCLUDED.einnahmen_vv,
       schuldzinsen = EXCLUDED.schuldzinsen,
       bewirtschaftung = EXCLUDED.bewirtschaftung,
       afa = EXCLUDED.afa,
       sanierung_erhaltungsaufwand = EXCLUDED.sanierung_erhaltungsaufwand,
       sonstige_werbungskosten = EXCLUDED.sonstige_werbungskosten,
       immo_result = EXCLUDED.immo_result,
       tax_before = EXCLUDED.tax_before,
       tax_after = EXCLUDED.tax_after,
       tax_delta = EXCLUDED.tax_delta,
       refund = EXCLUDED.refund,
       notes = EXCLUDED.notes,
       kontofuehrung = EXCLUDED.kontofuehrung,
       bereitstellung = EXCLUDED.bereitstellung,
       notar_grundschuld = EXCLUDED.notar_grundschuld,
       vermittlung = EXCLUDED.vermittlung,
       finanz_sonst = EXCLUDED.finanz_sonst,
       nk_umlf = EXCLUDED.nk_umlf,
       nk_n_umlf = EXCLUDED.nk_n_umlf,
       betr_sonst = EXCLUDED.betr_sonst,
       hausverwaltung = EXCLUDED.hausverwaltung,
       steuerber = EXCLUDED.steuerber,
       porto = EXCLUDED.porto,
       verw_sonst = EXCLUDED.verw_sonst,
       fahrtkosten = EXCLUDED.fahrtkosten,
       verpflegung = EXCLUDED.verpflegung,
       hotel = EXCLUDED.hotel,
       inserat = EXCLUDED.inserat,
       gericht = EXCLUDED.gericht,
       telefon = EXCLUDED.telefon,
       sonst_kosten = EXCLUDED.sonst_kosten,
       sonst_bewegl_wg = EXCLUDED.sonst_bewegl_wg,
       anschaffungsnah = EXCLUDED.anschaffungsnah,
       erhaltungsaufwand = EXCLUDED.erhaltungsaufwand,
       einnahmen_km = EXCLUDED.einnahmen_km,
       einnahmen_nk = EXCLUDED.einnahmen_nk
     RETURNING id, year, refund`,
    [
      userId, objectId, year,
      safeNumeric(data.base_income),
      safeNumeric(data.marginal_tax_rate),
      safeNumeric(data.einnahmen_vv) || 0,
      safeNumeric(data.schuldzinsen) || 0,
      safeNumeric(data.bewirtschaftung) || 0,
      safeNumeric(data.afa) || 0,
      safeNumeric(data.sanierung_erhaltungsaufwand) || 0,
      safeNumeric(data.sonstige_werbungskosten) || 0,
      safeNumeric(data.immo_result) || 0,
      safeNumeric(data.tax_before),
      safeNumeric(data.tax_after),
      safeNumeric(data.tax_delta),
      safeNumeric(data.refund),
      data.notes || null,
      // Detailed fields:
      safeNumeric(data.kontofuehrung) || 0,
      safeNumeric(data.bereitstellung) || 0,
      safeNumeric(data.notar_grundschuld) || 0,
      safeNumeric(data.vermittlung) || 0,
      safeNumeric(data.finanz_sonst) || 0,
      safeNumeric(data.nk_umlf) || 0,
      safeNumeric(data.nk_n_umlf) || 0,
      safeNumeric(data.betr_sonst) || 0,
      safeNumeric(data.hausverwaltung) || 0,
      safeNumeric(data.steuerber) || 0,
      safeNumeric(data.porto) || 0,
      safeNumeric(data.verw_sonst) || 0,
      safeNumeric(data.fahrtkosten) || 0,
      safeNumeric(data.verpflegung) || 0,
      safeNumeric(data.hotel) || 0,
      safeNumeric(data.inserat) || 0,
      safeNumeric(data.gericht) || 0,
      safeNumeric(data.telefon) || 0,
      safeNumeric(data.sonst_kosten) || 0,
      safeNumeric(data.sonst_bewegl_wg) || 0,
      safeNumeric(data.anschaffungsnah) || 0,
      safeNumeric(data.erhaltungsaufwand) || 0,
      safeNumeric(data.einnahmen_km) || 0,
      safeNumeric(data.einnahmen_nk) || 0
    ]
  );
  return r.rows[0];
}
/**
 * Get tax records for an object (optionally for a specific year).
 */
async function listForObject(userId, objectId, year) {
  let sql = `SELECT * FROM tax_records WHERE user_id = $1 AND object_id = $2`;
  const params = [userId, objectId];
  if (year != null) {
    sql += ' AND year = $3';
    params.push(year);
  }
  sql += ' ORDER BY year ASC';
  const r = await query(sql, params);
  return r.rows;
}

/**
 * Get all tax records for a user (across all objects).
 */
async function listForUser(userId, fromYear, toYear) {
  let sql = `
    SELECT tr.*, o.name AS object_name
    FROM tax_records tr
    JOIN objects o ON o.id = tr.object_id
    WHERE tr.user_id = $1`;
  const params = [userId];
  if (fromYear != null) { sql += ' AND tr.year >= $' + (params.length + 1); params.push(fromYear); }
  if (toYear != null) { sql += ' AND tr.year <= $' + (params.length + 1); params.push(toYear); }
  sql += ' ORDER BY tr.year ASC, o.name ASC';
  const r = await query(sql, params);
  return r.rows;
}

/**
 * Bulk upsert: replace ALL tax records for an object with the given timeline.
 */
async function replaceTimelineForObject({ userId, objectId, timeline }) {
  // Delete existing
  await query('DELETE FROM tax_records WHERE user_id = $1 AND object_id = $2', [userId, objectId]);
  // Insert new
  const inserted = [];
  for (const entry of timeline) {
    const r = await upsert({ userId, objectId, year: entry.year, data: entry });
    inserted.push(r);
  }
  return inserted;
}

async function deleteRecord(userId, recordId) {
  const r = await query(
    'DELETE FROM tax_records WHERE id = $1 AND user_id = $2 RETURNING id',
    [recordId, userId]
  );
  if (r.rowCount === 0) throw new HttpError(404, 'Record not found');
}



// ═══════════════════════════════════════════════════
// BEMERKUNGEN (Migration 006) - per field per year
// ═══════════════════════════════════════════════════
async function upsertBemerkung({ userId, objectId, year, field, bemerkung }) {
  const r = await query(
    `INSERT INTO tax_bemerkungen (user_id, object_id, year, field, bemerkung)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, object_id, year, field)
       DO UPDATE SET bemerkung = EXCLUDED.bemerkung
     RETURNING id, field, bemerkung`,
    [userId, objectId, year, field, bemerkung || null]
  );
  return r.rows[0];
}

async function listBemerkungenForObject(userId, objectId) {
  const r = await query(
    `SELECT year, field, bemerkung FROM tax_bemerkungen
     WHERE user_id = $1 AND object_id = $2
     ORDER BY year ASC, field ASC`,
    [userId, objectId]
  );
  return r.rows;
}

async function replaceBemerkungenForObject({ userId, objectId, bemerkungen }) {
  await query('DELETE FROM tax_bemerkungen WHERE user_id = $1 AND object_id = $2', [userId, objectId]);
  const inserted = [];
  for (const b of bemerkungen) {
    if (b.bemerkung && b.bemerkung.trim()) {
      const r = await upsertBemerkung({
        userId, objectId, year: b.year, field: b.field, bemerkung: b.bemerkung
      });
      inserted.push(r);
    }
  }
  return inserted;
}

module.exports = {
  upsert,
  listForObject,
  listForUser,
  replaceTimelineForObject,
  deleteRecord,
  upsertBemerkung,
  listBemerkungenForObject,
  replaceBemerkungenForObject
};
