'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   publicDatenumfang.js · v3930 (landing-zahlen-live-1)
   GET /api/v1/public/datenumfang — Datenumfang der Landing, ohne Anmeldung

   Zählt auf den Datenbanken dieses Servers (services/datenumfang.js):
   amtliche Datenpunkte, Registerstand, Schnittstellen, Abruftakte, Nutzer.
   Nur Summen, nur lesend, keine Inhalte, keine Hostnamen. 6 h im Speicher.
   Gelesen von frontend/landing/landing-zahlen.js (über CORS vom
   Landing-Host) und tools/datenumfang-messen.mjs.
   503 { ok:false }, solange nicht messbar — die Landing behält dann die
   statischen Zahlen im HTML.
   ═══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const datenumfang = require('../services/datenumfang');

router.get('/', async (req, res) => {
  const wert = await datenumfang.holen({ db: req.app.get('db') || require('../db/pool').pool });
  if (!wert) {
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, fehler: 'Datenumfang gerade nicht messbar' });
  }
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(wert);
});

module.exports = router;
