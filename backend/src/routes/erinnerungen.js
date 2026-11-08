'use strict';
/**
 * v3218 · W-12b · /api/v1/erinnerungen - Einwilligung „Erinnerung vor Mieterhöhung"
 *
 *   GET  /api/v1/erinnerungen            -> { mieterhoehung: bool, seit }
 *   PUT  /api/v1/erinnerungen            { mieterhoehung: bool }
 *
 * Standard ist AUS. Der Stand liegt in user_settings ('erinnerungen'), den Nachweis
 * (an UND aus, mit Wortlaut-Version) schreibt consent_log. Der Schlüssel steht bewusst
 * NICHT in der ERLAUBT-Liste von routes/userSettings.js: geschrieben wird er nur hier,
 * damit keine Einschaltung ohne Nachweis entsteht.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const consent = require('../services/consentService');
const erinnerung = require('../services/mieterhoehungErinnerung');

/* Wortlaut der Einstellung (frontend/js/erinnerung-mieterhoehung.js). Ändert er sich, steigt die Version. */
const VERSION = '2026-11-08';

router.use(authenticate);

router.get('/', async (req, res) => {
  try { res.json(Object.assign({ ok: true }, await erinnerung.stand(req.user.id))); }
  catch (e) { res.status(500).json({ error: 'server_error' }); }
});

router.put('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (typeof b.mieterhoehung !== 'boolean') return res.status(400).json({ error: 'mieterhoehung_fehlt' });
    const s = await erinnerung.setzen(req.user.id, b.mieterhoehung);
    try {
      await consent.protokollieren({
        userId: req.user.id, art: 'erinnerung_mieterhoehung', version: VERSION,
        userAgent: req.headers['user-agent'], kontext: { an: b.mieterhoehung }
      });
    } catch (e) { console.error('[erinnerungen] Nachweis:', e && e.message); }
    res.json(Object.assign({ ok: true }, s));
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

module.exports = router;
