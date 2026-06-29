'use strict';
/* routes/apiKeys.js — DealPilot API-Key-Selbstverwaltung (mand v807)
 * Mount: /api/v1/api-keys. Nur per echtem Login (JWT), nur Pro. */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const subscriptionService = require('../services/subscriptionService');
const apiKeyService = require('../services/apiKeyService');

router.use(authenticate);

/* Verwaltung NIE per API-Key selbst (kein Key, der Keys verwaltet) */
function requireJwt(req, res, next) {
  if (req.apiKey) return res.status(403).json({ error: 'Key-Verwaltung nur nach Login moeglich' });
  next();
}
async function requirePro(req, res, next) {
  try {
    const plan = await subscriptionService.getEffectivePlan(req.user.id);
    if (((plan && plan.plan_id) || '').toLowerCase() !== 'pro') {
      return res.status(403).json({ error: 'API-Keys erfordern einen aktiven Pro-Plan', plan_id: plan && plan.plan_id });
    }
    next();
  } catch (e) { next(e); }
}

router.get('/', requireJwt, requirePro, async (req, res, next) => {
  try { res.json({ keys: await apiKeyService.listForUser(req.user.id) }); }
  catch (e) { next(e); }
});

/* Auto-Bereitstellung: legt bei Pro genau dann einen Key an, wenn noch keiner existiert */
router.post('/ensure', requireJwt, requirePro, async (req, res, next) => {
  try {
    const n = await apiKeyService.countActive(req.user.id);
    if (n > 0) return res.json({ created: false, keys: await apiKeyService.listForUser(req.user.id) });
    const created = await apiKeyService.createForUser(req.user.id, { name: 'DealPilot API' });
    res.json({ created: true, key: created, keys: await apiKeyService.listForUser(req.user.id) });
  } catch (e) { next(e); }
});

router.post('/', requireJwt, requirePro, async (req, res, next) => {
  try {
    const n = await apiKeyService.countActive(req.user.id);
    if (n >= 5) return res.status(400).json({ error: 'Maximal 5 aktive Keys' });
    const created = await apiKeyService.createForUser(req.user.id, {
      name: (req.body && req.body.name) || 'DealPilot API',
      expiresInDays: req.body && req.body.expiresInDays
    });
    res.json({ key: created });
  } catch (e) { next(e); }
});

router.delete('/:id', requireJwt, requirePro, async (req, res, next) => {
  try { res.json(await apiKeyService.revoke(req.user.id, req.params.id)); }
  catch (e) { next(e); }
});

module.exports = router;
