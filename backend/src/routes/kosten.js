'use strict';
/* routes/kosten.js — v3296 · DealPilot Flow, Punkt 6: Freigabe fuer kostenpflichtige Stufen
   (services/kostenFreigabe.js). Linie „investor“ noetig.
     POST /kosten/anfrage   { art: mpi|mpi_plus|wev | stufe: 1-3, objekt_id }
     POST /kosten/freigeben { token }   - das Ja des Nutzers (Knopf im Hub)
     POST /kosten/ablehnen  { token } */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFlowLinie } = require('../middleware/flow');
const kosten = require('../services/kostenFreigabe');

const router = express.Router();
router.use(authenticate, requireFlowLinie('investor'));

router.post('/anfrage', async (req, res, next) => {
  try {
    const b = req.body || {};
    const r = await kosten.anfrage(req.user.id, { art: b.art, stufe: b.stufe, objekt_id: b.objekt_id, kanal: 'api' });
    if (!r.ok) return res.status(r.status || 400).json({ error: r.fehler });
    res.set('Cache-Control', 'no-store');
    if (r.status === 'gesperrt') return res.status(403).json(Object.assign({ error: r.grund, code: 'KOSTEN_GESPERRT' }, r));
    if (r.status === 'kontingent_leer') return res.status(402).json(Object.assign({ error: r.grund, code: 'KEIN_KONTINGENT' }, r));
    res.json(r);
  } catch (e) { next(e); }
});
router.post('/freigeben', async (req, res, next) => {
  try {
    const r = await kosten.freigeben(req.user.id, (req.body || {}).token, req.apiKey ? 'nutzer_api' : 'nutzer');
    if (!r.ok) return res.status(404).json({ error: r.fehler, code: 'KOSTEN_TOKEN_UNGUELTIG' });
    res.json(r);
  } catch (e) { next(e); }
});
router.post('/ablehnen', async (req, res, next) => {
  try { res.json(await kosten.ablehnen(req.user.id, (req.body || {}).token)); } catch (e) { next(e); }
});

module.exports = router;
