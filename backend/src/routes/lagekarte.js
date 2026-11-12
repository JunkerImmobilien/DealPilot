'use strict';
/* lagekarte.js · v3336 — GET /api/v1/lagekarte/kachel/:z/:x/:y.png
   Eine OpenStreetMap-Kachel aus der serverseitigen Ablage (services/osmKacheln.js).
   Nur angemeldet; die Lagekarte im PDF setzt die Kacheln im Browser zusammen. */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const osm = require('../services/osmKacheln');

const router = express.Router();

router.get('/kachel/:z/:x/:y.png', authenticate, async (req, res) => {
  try {
    const r = await osm.kachel(req.params.z, req.params.x, req.params.y);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, max-age=604800');   /* 7 Tage im Browser */
    res.set('X-Kachel-Herkunft', r.herkunft);
    res.send(r.buf);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'kachel_fehler' });
  }
});

module.exports = router;
