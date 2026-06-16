'use strict';
// Quick Boarding Shared Pass  (marker: qb-shared-pass)
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const sharedPassService = require('../services/sharedPassService');

const router = express.Router();

const codeParam = z.object({
  code: z.string().min(4).max(16).regex(/^[0-9A-Za-z]+$/, 'Invalid code')
});
const createBody = z.object({
  objectId: z.string().uuid('Invalid object id'),
  days: z.number().int().min(1).max(30).optional()
});
const extendBody = z.object({
  days: z.number().int().min(1).max(30).optional()
});

// ── PUBLIC: geteilten Pass lesen (KEIN Auth) ───────────────
router.get('/:code', validate({ params: codeParam }), async (req, res, next) => {
  try {
    const out = await sharedPassService.getPublic(req.params.code);
    if (out.status === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (out.status === 'revoked')   return res.status(410).json({ error: 'revoked' });
    if (out.status === 'expired')   return res.status(410).json({ error: 'expired' });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(out.pass);
  } catch (err) { next(err); }
});

// ── PROTECTED ──────────────────────────────────────────────
// Pass aus eigenem Objekt anlegen
router.post('/', authenticate, validate({ body: createBody }), async (req, res, next) => {
  try {
    const r = await sharedPassService.createForObject(req.user.id, req.body.objectId, { days: req.body.days });
    res.status(201).json(r);
  } catch (err) { next(err); }
});

// Eigene Paesse auflisten
router.get('/', authenticate, async (req, res, next) => {
  try {
    res.json({ items: await sharedPassService.listForOwner(req.user.id) });
  } catch (err) { next(err); }
});

// Uebernehmen -> klont als eigenes Objekt
router.post('/:code/claim', authenticate, validate({ params: codeParam }), async (req, res, next) => {
  try {
    res.status(201).json({ object: await sharedPassService.claim(req.user.id, req.params.code) });
  } catch (err) { next(err); }
});

// Verlaengern (+Tage, max 30; reaktiviert ggf. widerrufenen Pass)
router.post('/:code/extend', authenticate, validate({ params: codeParam, body: extendBody }), async (req, res, next) => {
  try {
    res.json(await sharedPassService.extend(req.user.id, req.params.code, req.body.days));
  } catch (err) { next(err); }
});

// Widerrufen
router.delete('/:code', authenticate, validate({ params: codeParam }), async (req, res, next) => {
  try {
    res.json(await sharedPassService.revoke(req.user.id, req.params.code));
  } catch (err) { next(err); }
});

module.exports = router;
