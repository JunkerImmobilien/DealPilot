'use strict';
/* avmHistoryService — AVM-Bewertungshistorie (v742-avm-history).
   record(): schreibt eine echte Bewertung, max. 1 pro Anbieter pro Tag pro Objekt. */
const { query } = require('../db/pool');

function _num(x) {
  if (x === null || x === undefined || x === '') return null;
  var n = Number(x);
  return isFinite(n) ? Math.round(n) : null;
}

/* Schreibt eine AVM-Bewertung in die Historie.
   Dedup: existiert heute schon ein Eintrag fuer (object, provider) -> kein neuer. */
async function record(userId, objectId, result) {
  if (!objectId || !result) return null;
  var provider = String(result.provider || '').toLowerCase(); // PriceHubble -> pricehubble
  if (!provider) return null;

  // 1/Anbieter/Tag: pruefen ob heute schon ein Eintrag existiert
  const dup = await query(
    "SELECT id FROM avm_valuations WHERE object_id = $1 AND provider = $2 AND created_at::date = now()::date LIMIT 1",
    [objectId, provider]
  );
  if (dup.rows && dup.rows.length) return null; // heute schon -> skip

  const r = await query(
    `INSERT INTO avm_valuations
       (object_id, user_id, provider, marktwert, low, high, marktmiete, eur_per_sqm, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, created_at`,
    [
      objectId, userId, provider,
      _num(result.marktwert), _num(result.low), _num(result.high),
      _num(result.marktmieteCold), _num(result.eurPerSqm),
      result.conf || result.confidence || null
    ]
  );
  return r.rows[0] || null;
}

/* Manueller Eintrag (Makler, Gutachten, ...). */
async function addManual(userId, objectId, body) {
  if (!objectId) { const e = new Error('objectId fehlt'); e.status = 400; throw e; }
  const r = await query(
    `INSERT INTO avm_valuations
       (object_id, user_id, provider, source_label, marktwert, marktmiete, eur_per_sqm, note)
     VALUES ($1,$2,'manuell',$3,$4,$5,$6,$7)
     RETURNING id, created_at`,
    [
      objectId, userId,
      body.sourceLabel || null,
      _num(body.marktwert), _num(body.marktmiete), _num(body.eurPerSqm),
      body.note || null
    ]
  );
  return r.rows[0] || null;
}

/* Liste fuer ein Objekt (nur eigene). */
async function listForObject(userId, objectId) {
  const r = await query(
    `SELECT id, provider, source_label, marktwert, low, high, marktmiete, eur_per_sqm, confidence, note, created_at
       FROM avm_valuations
      WHERE object_id = $1 AND user_id = $2
      ORDER BY created_at DESC`,
    [objectId, userId]
  );
  return r.rows || [];
}

/* Eintrag loeschen (nur eigene). */
async function remove(userId, id) {
  const r = await query(
    "DELETE FROM avm_valuations WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );
  return !!(r.rows && r.rows.length);
}

module.exports = { record, addManual, listForObject, remove };
