'use strict';
/* routes/agent.js — v3297 · DealPilot Flow, Punkt 5: Co-Pilot ueber die API (services/flowAgent.js).
   Linie „investor“ noetig.
     POST /agent/frage       { text, objekt_id?, darf_kosten?, kosten_token?, verlauf? }
     POST /agent/bestaetigen { token }   - fuehrt einen vorgemerkten Schreibvorschlag aus
     POST /agent/verwerfen   { token } */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFlowLinie } = require('../middleware/flow');
const flowAgent = require('../services/flowAgent');

const router = express.Router();
router.use(authenticate, requireFlowLinie('investor'));

router.post('/frage', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await flowAgent.frage(req.user.id, req.body || {}));
  } catch (e) {
    if (e && e.code === 'NO_API_KEY') return res.status(503).json({ error: e.message, code: 'NO_API_KEY' });
    if (e && !e.statusCode && e.status) return res.status(502).json({ error: 'OpenAI-Fehler: ' + e.message });
    next(e);
  }
});
router.post('/bestaetigen', async (req, res, next) => {
  try { res.json(await flowAgent.bestaetigen(req.user.id, (req.body || {}).token)); } catch (e) { next(e); }
});
router.post('/verwerfen', async (req, res, next) => {
  try { res.json(await flowAgent.verwerfen(req.user.id, (req.body || {}).token)); } catch (e) { next(e); }
});

module.exports = router;
