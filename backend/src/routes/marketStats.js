'use strict';
/* routes/marketStats.js — v3172 · N121 Marktstatistik je Kreis (Portfolio-Modul, 04.11.2026)
 * Mount: /api/v1/market-stats. Oeffentlich wie /market-rates/bauzins (amtliche Daten unter dl-de/by-2-0).
 * Liest beim Marktbericht-Dienst, der die Werte in mb.baustatistik vorhaelt (monatlicher Abgleich) -
 * kein Live-Abruf bei der Regionaldatenbank je Anfrage. */
const express = require('express');
const router = express.Router();
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

async function weiter(pfad, res) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(MB_BASE + pfad, { signal: ctrl.signal });
    const text = await r.text();
    res.status(r.status).type('application/json').set('Cache-Control', 'public, max-age=3600').send(text);
  } catch (e) {
    res.status(502).json({ error: 'Marktstatistik nicht erreichbar', detail: String(e.message).slice(0, 120) });
  } finally { clearTimeout(t); }
}
router.get('/baukosten', (req, res) => {
  const ags = req.query.ags ? String(req.query.ags).replace(/[^0-9]/g, '') : '';
  weiter('/market-stats/baukosten' + (ags ? '?ags=' + encodeURIComponent(ags) : ''), res);
});
router.get('/index', (req, res) => weiter('/market-stats/index', res));

module.exports = router;
