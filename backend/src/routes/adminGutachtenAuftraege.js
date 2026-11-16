'use strict';
/* routes/adminGutachtenAuftraege.js — v3590
   Admin › Gutachtenaufträge: jeder RND-Gutachtenauftrag, den ein Kunde in DealPilot ueber
   Junker Immobilien an gutachten.org gegeben hat (Tabelle gutachten_auftraege, Migration 110).
   Nur lesend. Kundendaten liegen dort nur, weil der Kunde der Uebermittlung zugestimmt hat. */
const express = require('express');
const { query } = require('../db/pool');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const r = await query('SELECT a.id, a.created_at, a.beauftragt_at, a.status, a.umgebung, a.objekt_text, a.request_number, a.kunde, a.auswahl, '
      + 'a.preis, a.endpreis, a.benachrichtigung, u.email AS konto FROM gutachten_auftraege a LEFT JOIN users u ON u.id = a.user_id '
      + 'ORDER BY a.created_at DESC LIMIT 300');
    res.json({ auftraege: r.rows });
  } catch (e) { next(e); }
});

module.exports = router;
