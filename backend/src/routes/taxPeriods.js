/**
 * V259-02: Tax-Periods CRUD
 * Verlaufsbasierte zvE-Verwaltung mit Zeitraeumen.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');

// Helper: Periode normalisieren (von DB-Row zu JSON)
function rowToPeriod(row) {
  return {
    id: row.id,
    valid_from: row.valid_from ? row.valid_from.toISOString().split('T')[0] : null,
    valid_to:   row.valid_to   ? row.valid_to.toISOString().split('T')[0]   : null,
    zve: Number(row.zve),
    reason: row.reason || '',
    note: row.note || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// GET /api/v1/tax-periods — alle Perioden
router.get('/', authenticate, async (req, res) => {
  try {
    const r = await query(
      `SELECT id, valid_from, valid_to, zve, reason, note, created_at, updated_at
       FROM tax_periods
       WHERE user_id = $1
       ORDER BY valid_from DESC`,
      [req.user.id]
    );
    res.json({ periods: r.rows.map(rowToPeriod), count: r.rows.length });
  } catch(e) {
    console.error('[V259-02] GET tax-periods error:', e);
    res.status(500).json({ error: 'list-failed', message: e.message });
  }
});

// GET /api/v1/tax-periods/by-date?date=YYYY-MM-DD
router.get('/by-date', authenticate, async (req, res) => {
  try {
    const date = req.query.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'invalid-date' });
    }
    const r = await query(
      `SELECT id, valid_from, valid_to, zve, reason, note
       FROM tax_periods
       WHERE user_id = $1
         AND valid_from <= $2
         AND (valid_to IS NULL OR valid_to >= $2)
       ORDER BY valid_from DESC
       LIMIT 1`,
      [req.user.id, date]
    );
    if (r.rows.length === 0) {
      return res.json({ period: null });
    }
    res.json({ period: rowToPeriod(r.rows[0]) });
  } catch(e) {
    console.error('[V259-02] by-date error:', e);
    res.status(500).json({ error: 'lookup-failed', message: e.message });
  }
});

// GET /api/v1/tax-periods/check-overlap?from=...&to=...&exclude_id=...
router.get('/check-overlap', authenticate, async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to || null;
    const excludeId = req.query.exclude_id || null;
    if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({ error: 'invalid-from' });
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'invalid-to' });
    }
    // Find overlapping periods
    // Overlap: (a.from <= b.to OR b.to IS NULL) AND (a.to >= b.from OR a.to IS NULL)
    const params = [req.user.id, from];
    let where = 'user_id = $1';
    if (to) {
      where += ' AND valid_from <= $2 AND (valid_to IS NULL OR valid_to >= $3)';
      params.push(to, from);
    } else {
      // Open-ended new period: jede Periode die >= from oder open-ended ist
      where += ' AND (valid_to IS NULL OR valid_to >= $2)';
    }
    if (excludeId) {
      params.push(excludeId);
      where += ` AND id <> $${params.length}`;
    }
    const r = await query(
      `SELECT id, valid_from, valid_to, zve, reason
       FROM tax_periods
       WHERE ${where}
       ORDER BY valid_from DESC`,
      params
    );
    res.json({ overlapping: r.rows.map(rowToPeriod), count: r.rows.length });
  } catch(e) {
    console.error('[V259-02] check-overlap error:', e);
    res.status(500).json({ error: 'check-failed', message: e.message });
  }
});

// POST /api/v1/tax-periods
router.post('/', authenticate, async (req, res) => {
  try {
    const { valid_from, valid_to, zve, reason, note } = req.body || {};
    if (!valid_from || !/^\d{4}-\d{2}-\d{2}$/.test(valid_from)) {
      return res.status(400).json({ error: 'invalid-valid_from' });
    }
    if (valid_to && !/^\d{4}-\d{2}-\d{2}$/.test(valid_to)) {
      return res.status(400).json({ error: 'invalid-valid_to' });
    }
    const zveNum = Number(zve);
    if (!Number.isFinite(zveNum) || zveNum < 0) {
      return res.status(400).json({ error: 'invalid-zve' });
    }
    const r = await query(
      `INSERT INTO tax_periods (user_id, valid_from, valid_to, zve, reason, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, valid_from, valid_to, zve, reason, note, created_at, updated_at`,
      [req.user.id, valid_from, valid_to || null, Math.round(zveNum), reason || null, note || null]
    );
    res.status(201).json({ period: rowToPeriod(r.rows[0]) });
  } catch(e) {
    console.error('[V259-02] POST tax-periods error:', e);
    res.status(500).json({ error: 'create-failed', message: e.message });
  }
});

// PUT /api/v1/tax-periods/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { valid_from, valid_to, zve, reason, note } = req.body || {};
    const id = req.params.id;
    
    // Verify ownership
    const own = await query(`SELECT id FROM tax_periods WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
    if (own.rows.length === 0) {
      return res.status(404).json({ error: 'not-found' });
    }
    
    if (!valid_from || !/^\d{4}-\d{2}-\d{2}$/.test(valid_from)) {
      return res.status(400).json({ error: 'invalid-valid_from' });
    }
    if (valid_to && !/^\d{4}-\d{2}-\d{2}$/.test(valid_to)) {
      return res.status(400).json({ error: 'invalid-valid_to' });
    }
    const zveNum = Number(zve);
    if (!Number.isFinite(zveNum) || zveNum < 0) {
      return res.status(400).json({ error: 'invalid-zve' });
    }
    
    const r = await query(
      `UPDATE tax_periods
       SET valid_from = $1, valid_to = $2, zve = $3, reason = $4, note = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, valid_from, valid_to, zve, reason, note, created_at, updated_at`,
      [valid_from, valid_to || null, Math.round(zveNum), reason || null, note || null, id, req.user.id]
    );
    res.json({ period: rowToPeriod(r.rows[0]) });
  } catch(e) {
    console.error('[V259-02] PUT tax-periods error:', e);
    res.status(500).json({ error: 'update-failed', message: e.message });
  }
});

// DELETE /api/v1/tax-periods/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const r = await query(
      `DELETE FROM tax_periods WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'not-found' });
    }
    res.json({ deleted: true, id: r.rows[0].id });
  } catch(e) {
    console.error('[V259-02] DELETE tax-periods error:', e);
    res.status(500).json({ error: 'delete-failed', message: e.message });
  }
});

module.exports = router;
