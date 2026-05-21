/**
 * V258-04: WK-Aggregation Endpoint
 * Liefert Werbungskosten (Ueberschuss/Verlust V+V) aller "Won"-Objekte
 * des Users pro Jahr.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');

router.get('/wk-aggregate', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Alle Objekte des Users mit Status "won" (siehe deal-action _deal_won)
    const result = await query(`
      SELECT id, data, updated_at
      FROM objects
      WHERE user_id = $1
      ORDER BY (data->>'purchase_date') ASC NULLS LAST, created_at ASC
    `, [userId]);

    const objects = [];
    const totalsPerYear = {};

    for (const row of result.rows) {
      const d = row.data || {};

      // Filter: Nur Won-Objekte
      const isWon = d._deal_won === true || d._deal_won === 'true';
      if (!isWon) continue;

      const wkPerYear = {};

      // Vereinfacht: Aus data.steuer_snapshot.wk_per_year wenn vorhanden
      if (d.steuer_snapshot && d.steuer_snapshot.wk_per_year) {
        for (const [year, val] of Object.entries(d.steuer_snapshot.wk_per_year)) {
          const numVal = Number(val) || 0;
          if (numVal !== 0) {
            wkPerYear[year] = numVal;
            totalsPerYear[year] = (totalsPerYear[year] || 0) + numVal;
          }
        }
      }

      objects.push({
        id: row.id,
        address: d.adresse || d.adresse_text || '(ohne Adresse)',
        purchase_date: d.purchase_date || null,
        status: isWon ? 'won' : 'open',
        wk_per_year: wkPerYear
      });
    }

    res.json({
      objects: objects,
      totals_per_year: totalsPerYear,
      count: objects.length
    });
  } catch (e) {
    console.error('[V258-04] wk-aggregate error:', e);
    res.status(500).json({ error: 'aggregate-failed', message: e.message });
  }
});

module.exports = router;
