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
    const obj = await objectService.getById(req.user.id, req.params.id);
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

    if (limit != null && current >= limit) {
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


module.exports = router;
