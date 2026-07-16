'use strict';
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const objectService = require('../services/objectService');
const { HttpError } = require('../middleware/errors');
const { requireUnderLimit } = require('../middleware/planLimits');
const usageService = require('../services/usageService');

const router = express.Router();

// All object routes require authentication
router.use(authenticate);

// ── Schemas ──────────────────────────────────────────
const objectBodySchema = z.object({
  data: z.record(z.any()).optional().default({}),
  aiAnalysis: z.string().nullable().optional(),
  photos: z.array(z.string()).optional().default([]),
  expectedVersion: z.number().int().positive().optional()
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid object id')
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

// ── Routes ───────────────────────────────────────────

/**
 * GET /objects - list user's objects (summaries only)
 */
router.get('/', validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    // V30: Browser darf die Liste nicht cachen — sonst stale thumbnails nach Photo-Update
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const items = await objectService.listForUser(req.user.id, req.query);
    res.json({ items, count: items.length });
  } catch (err) { next(err); }
});

/**
 * GET /objects/:id - get full object data
 */
router.get('/:id', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    let obj = await objectService.getById(req.user.id, req.params.id);
    /* W27-sharedget: Kein eigenes Objekt? Dann pruefen, ob es dem Anfragenden ueber
       eine AKTIVE Reseller-Freigabe zusteht. Dieselbe Regel wie getSharedObject
       (widerrufen/zurueckgegeben = kein Zugriff) — nur an zweiter Stelle angewandt.
       Damit kann die Rechen-Engine im Frontend das Objekt normal laden und der
       Partner die echten PDFs ziehen. Ohne Freigabe bleibt es bei 404. */
    if (!obj) {
      try {
        const reseller = require('../services/resellerService');
        const ownerId = await reseller.sharedObjectOwner(req.user.id, req.params.id);
        if (ownerId) obj = await objectService.getById(ownerId, req.params.id);
      } catch (e) { /* Freigabe-Pfad ist Zusatz, nie blockierend */ }
    }
    if (!obj) throw new HttpError(404, 'Object not found');
    res.json(obj);
  } catch (err) { next(err); }
});

/**
 * POST /objects - create new object
 */
router.post('/', validate({ body: objectBodySchema }), requireUnderLimit('objects'), async (req, res, next) => {
  try {
    const created = await objectService.create(req.user.id, req.body);
    await objectService.logAudit({
      userId: req.user.id,
      action: 'object.create',
      resourceType: 'object',
      resourceId: created.id,
      ipAddress: req.ip
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

/**
 * PUT /objects/:id - update object
 */
router.put('/:id',
  validate({ params: idParamSchema, body: objectBodySchema }),
  async (req, res, next) => {
    try {
      const updated = await objectService.update(req.user.id, req.params.id, req.body);
      await objectService.logAudit({
        userId: req.user.id,
        action: 'object.update',
        resourceType: 'object',
        resourceId: req.params.id,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /objects/:id
 */
router.delete('/:id', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    await objectService.deleteObject(req.user.id, req.params.id);
    await objectService.logAudit({
      userId: req.user.id,
      action: 'object.delete',
      resourceType: 'object',
      resourceId: req.params.id,
      ipAddress: req.ip
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});


/**
 * POST /objects/track-usage
 * Frontend calls this when user runs an AI analysis or PDF export.
 * Body: { metric: 'ai_analysis' | 'pdf_export' }
 * Enforces plan limits.
 */
const trackUsageSchema = z.object({
  metric: z.enum(['ai_analysis', 'pdf_export'])
});

router.post('/track-usage', validate({ body: trackUsageSchema }), async (req, res, next) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const plan = await subscriptionService.getEffectivePlan(req.user.id);

    const planLimitField = req.body.metric === 'ai_analysis'
      ? 'max_ai_analyses_monthly'
      : 'max_pdf_exports_monthly';
    const limit = plan[planLimitField];

    const usage = await usageService.getCurrentMonthUsage(req.user.id);
    const current = usage[req.body.metric] || 0;

    if (limit != null && limit >= 0 && current >= limit) { // V225: -1 = unlimited
      return res.status(403).json({
        error: 'Plan limit reached',
        metric: req.body.metric,
        current,
        limit,
        plan_id: plan.plan_id,
        upgrade_required: true
      });
    }

    const newCount = await usageService.incrementUsage(req.user.id, req.body.metric, 1);
    res.json({
      ok: true,
      metric: req.body.metric,
      count: newCount,
      limit: limit
    });
  } catch (err) { next(err); }
});



// V277-steuer-snapshot: Dedizierter Endpoint zum Persistieren des Steuer-Snapshots
// Nutzt JSONB-Merge damit andere Felder in data unberuehrt bleiben.
router.post('/:id/steuer-snapshot',
  validate({ params: idParamSchema, body: z.object({
    wk_per_year: z.record(z.union([z.number(), z.string()]))
  }).strict() }),
  async (req, res, next) => {
    try {
      const { query } = require('../db/pool');
      const snapshot = { steuer_snapshot: { wk_per_year: req.body.wk_per_year, updated_at: new Date().toISOString() } };
      const r = await query(
        `UPDATE objects
           SET data = data || $1::jsonb, version = version + 1
         WHERE id = $2 AND user_id = $3
         RETURNING id, version, updated_at`,
        [JSON.stringify(snapshot), req.params.id, req.user.id]
      );
      if (r.rowCount === 0) {
        return res.status(404).json({ error: 'Object not found or not authorized' });
      }
      res.json({ ok: true, id: r.rows[0].id, version: r.rows[0].version });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
