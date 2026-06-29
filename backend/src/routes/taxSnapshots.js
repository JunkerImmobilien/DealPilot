// V278-tax-snapshots: Dedizierte Tabelle fuer Steuer-Snapshots
'use strict';
const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

const idParam = z.object({ id: z.string().uuid() });
const upsertBody = z.object({
  wk_per_year: z.record(z.union([z.number(), z.string()]))
}).strict();

// GET /api/v1/tax-snapshots
// Liefert alle Snapshots des Users mit zugehoeriger Objekt-Adresse
router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT
         ts.object_id,
         ts.wk_per_year,
         ts.updated_at,
         o.name AS address,
         o.data->>'kaufdat' AS kaufdat,
         o.data->>'wirtschaftlicher_uebergang' AS wirtschaftlicher_uebergang,
         o.data->>'halter' AS halter  /* v813-3c-be */
       FROM tax_snapshots ts
       JOIN objects o ON o.id = ts.object_id
       WHERE ts.user_id = $1
         AND COALESCE((o.data->>'_deal_won')::boolean, false) = true  -- V281-won-filter: nur Bestandsobjekte
       ORDER BY o.created_at ASC`,
      [req.user.id]
    );
    res.json({
      snapshots: r.rows.map(row => ({
        object_id: row.object_id,
        address: row.address || '(ohne Adresse)',
        purchase_date: row.kaufdat || row.wirtschaftlicher_uebergang || null,
        halter: row.halter || 'privat',  /* v813-3c-be */
        wk_per_year: row.wk_per_year || {},
        updated_at: row.updated_at
      })),
      count: r.rowCount
    });
  } catch (err) { next(err); }
});

// POST /api/v1/tax-snapshots/:id  -> upsert
router.post('/:id',
  validate({ params: idParam, body: upsertBody }),
  async (req, res, next) => {
    try {
      // Ownership-Check: object_id muss dem User gehoeren
      const own = await query(
        'SELECT user_id FROM objects WHERE id = $1',
        [req.params.id]
      );
      if (own.rowCount === 0) {
        return res.status(404).json({ error: 'Object not found' });
      }
      if (own.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const r = await query(
        `INSERT INTO tax_snapshots (object_id, user_id, wk_per_year, source)
         VALUES ($1, $2, $3::jsonb, 'tax_timeline_render')
         ON CONFLICT (object_id) DO UPDATE SET
           wk_per_year = EXCLUDED.wk_per_year,
           source = EXCLUDED.source
         RETURNING object_id, updated_at`,
        [req.params.id, req.user.id, JSON.stringify(req.body.wk_per_year)]
      );
      res.json({ ok: true, object_id: r.rows[0].object_id, updated_at: r.rows[0].updated_at });
    } catch (err) { next(err); }
  }
);

module.exports = router;
