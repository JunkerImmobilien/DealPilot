'use strict';
/* routes/flow.js — v3290 · DealPilot Flow (Makler-Hub), Punkt 3: GET/PUT /api/v1/flow/profil
   Richtwerte und Ziele als festes Profil. Gespeichert in browser_vorgaben (Investmentprofil) und
   lage_profil - dieselben Einstellungen, die App und Telegram-Bot lesen (services/flowProfil.js).
   Linie „investor“ noetig (wie /objects/:id/berechnen). */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFlowLinie } = require('../middleware/flow');
const flowProfil = require('../services/flowProfil');
const rechenkerne = require('../services/rechenkerne');

const router = express.Router();
router.use(authenticate);

function gewichte(p) { try { return rechenkerne.scoreGewichte(p.ds); } catch (e) { return null; } }

router.get('/profil', requireFlowLinie('investor'), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const p = await flowProfil.lesen(req.user.id);
    res.json(flowProfil.ansicht(p, gewichte(p)));
  } catch (e) { next(e); }
});

router.put('/profil', requireFlowLinie('investor'), async (req, res, next) => {
  try {
    const von = req.apiKey ? 'api:' + req.apiKey.id : 'sitzung';
    const r = await flowProfil.setzen(req.user.id, req.body || {}, von);
    if (!r.ok) return res.status(400).json({ error: 'Profil nicht gespeichert', code: 'FLOW_PROFIL_UNGUELTIG', fehler: r.fehler });
    const p = await flowProfil.lesen(req.user.id);
    res.set('Cache-Control', 'no-store');
    res.json(Object.assign({ ok: true }, flowProfil.ansicht(p, gewichte(p))));
  } catch (e) { next(e); }
});

module.exports = router;
