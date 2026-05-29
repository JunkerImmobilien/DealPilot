'use strict';
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const taxService = require('../services/taxService');
const { HttpError } = require('../middleware/errors');

const router = express.Router();
router.use(authenticate);

// ── Schemas ──────────────────────────────────────────
// V312-schema-nullable: Felder duerfen auch null sein (Frontend sendet null fuer unberechnete Werte)
const taxRecordSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  base_income: z.number().nullable().optional(),
  marginal_tax_rate: z.number().nullable().optional(),
  einnahmen_vv: z.number().nullable().optional(),
  schuldzinsen: z.number().nullable().optional(),
  bewirtschaftung: z.number().nullable().optional(),
  afa: z.number().nullable().optional(),
  sanierung_erhaltungsaufwand: z.number().nullable().optional(),
  sonstige_werbungskosten: z.number().nullable().optional(),
  immo_result: z.number().nullable().optional(),
  tax_before: z.number().nullable().optional(),
  tax_after: z.number().nullable().optional(),
  tax_delta: z.number().nullable().optional(),
  refund: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Detailed Werbungskosten (Migration 006)
  kontofuehrung: z.number().nullable().optional(),
  bereitstellung: z.number().nullable().optional(),
  notar_grundschuld: z.number().nullable().optional(),
  vermittlung: z.number().nullable().optional(),
  finanz_sonst: z.number().nullable().optional(),
  nk_umlf: z.number().nullable().optional(),
  nk_n_umlf: z.number().nullable().optional(),
  betr_sonst: z.number().nullable().optional(),
  hausverwaltung: z.number().nullable().optional(),
  steuerber: z.number().nullable().optional(),
  porto: z.number().nullable().optional(),
  verw_sonst: z.number().nullable().optional(),
  fahrtkosten: z.number().nullable().optional(),
  verpflegung: z.number().nullable().optional(),
  hotel: z.number().nullable().optional(),
  inserat: z.number().nullable().optional(),
  gericht: z.number().nullable().optional(),
  telefon: z.number().nullable().optional(),
  sonst_kosten: z.number().nullable().optional(),
  sonst_bewegl_wg: z.number().nullable().optional(),
  anschaffungsnah: z.number().nullable().optional(),
  erhaltungsaufwand: z.number().nullable().optional(),
  einnahmen_km: z.number().nullable().optional(),
  einnahmen_nk: z.number().nullable().optional()
});

const bemerkungSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  field: z.string().max(64),
  bemerkung: z.string().nullable().optional()
});

const idParam = z.object({ id: z.string().uuid() });
const objectParam = z.object({ object_id: z.string().uuid() });

// ── Routes ───────────────────────────────────────────

/**
 * GET /tax-records?from=2024&to=2030
 * List all tax records for current user across all objects
 */
router.get('/', async (req, res, next) => {
  try {
    const fromYear = req.query.from ? parseInt(req.query.from, 10) : undefined;
    const toYear = req.query.to ? parseInt(req.query.to, 10) : undefined;
    const records = await taxService.listForUser(req.user.id, fromYear, toYear);
    res.json({ records });
  } catch (err) { next(err); }
});

/**
 * GET /tax-records/object/:object_id
 * List tax records for one specific object
 */
router.get('/object/:object_id', validate({ params: objectParam }), async (req, res, next) => {
  try {
    const records = await taxService.listForObject(req.user.id, req.params.object_id);
    res.json({ records });
  } catch (err) { next(err); }
});

/**
 * POST /tax-records/object/:object_id
 * Upsert one tax record for an object
 */
router.post('/object/:object_id',
  validate({ params: objectParam, body: taxRecordSchema }),
  async (req, res, next) => {
    try {
      const result = await taxService.upsert({
        userId: req.user.id,
        objectId: req.params.object_id,
        year: req.body.year,
        data: req.body
      });
      res.json(result);
    } catch (err) { next(err); }
  });

/**
 * PUT /tax-records/object/:object_id/timeline
 * Replace ALL tax records for an object with a complete timeline
 */
router.put('/object/:object_id/timeline',
  validate({
    params: objectParam,
    body: z.object({ timeline: z.array(taxRecordSchema) })
  }),
  async (req, res, next) => {
    try {
      const result = await taxService.replaceTimelineForObject({
        userId: req.user.id,
        objectId: req.params.object_id,
        timeline: req.body.timeline
      });
      res.json({ inserted: result.length, records: result });
    } catch (err) { next(err); }
  });

/**
 * DELETE /tax-records/:id
 */
router.delete('/:id', validate({ params: idParam }), async (req, res, next) => {
  try {
    await taxService.deleteRecord(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});


// ═══════════════════════════════════════════════════
// BEMERKUNGEN routes
// ═══════════════════════════════════════════════════

router.get('/object/:object_id/bemerkungen',
  validate({ params: objectParam }),
  async (req, res, next) => {
    try {
      const items = await taxService.listBemerkungenForObject(req.user.id, req.params.object_id);
      res.json({ items });
    } catch (err) { next(err); }
  });

router.post('/object/:object_id/bemerkung',
  validate({ params: objectParam, body: bemerkungSchema }),
  async (req, res, next) => {
    try {
      const r = await taxService.upsertBemerkung({
        userId: req.user.id,
        objectId: req.params.object_id,
        year: req.body.year,
        field: req.body.field,
        bemerkung: req.body.bemerkung
      });
      res.json(r);
    } catch (err) { next(err); }
  });

router.put('/object/:object_id/bemerkungen',
  validate({ params: objectParam, body: z.object({ bemerkungen: z.array(bemerkungSchema) }) }),
  async (req, res, next) => {
    try {
      const r = await taxService.replaceBemerkungenForObject({
        userId: req.user.id,
        objectId: req.params.object_id,
        bemerkungen: req.body.bemerkungen
      });
      res.json({ inserted: r.length, items: r });
    } catch (err) { next(err); }
  });


module.exports = router;
