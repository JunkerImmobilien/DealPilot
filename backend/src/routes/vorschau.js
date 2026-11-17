'use strict';
/* routes/vorschau.js — v3600
   GET /api/v1/vorschau  { funktionen: { <schluessel>: true|false } }
   Welche Vorschau-Funktionen dieses Konto sieht (services/vorschau.js). js/vorschau.js blendet danach
   ein; ohne Antwort bleibt alles aus. Gesperrt ist die Funktion zusaetzlich an ihrer Route. */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const vorschau = require('../services/vorschau');

const router = express.Router();
router.get('/', authenticate, async (req, res) => {
  try { res.json({ funktionen: await vorschau.fuerKonto(req.user) }); }
  catch (e) { res.json({ funktionen: {} }); }
});
module.exports = router;
