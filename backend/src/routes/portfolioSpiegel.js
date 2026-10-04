'use strict';
/* routes/portfolioSpiegel.js — der Portfolio-Spiegel (v1793)
 *
 * Mount: /api/v1/portfolio-spiegel
 *
 *   PUT  /          der Browser legt sein Rechenergebnis ab
 *   GET  /          lesen (fuer Werkzeuge; der Bot liest direkt aus der DB)
 *
 * ── DIE EINE REGEL ───────────────────────────────────────────────────────
 *
 * DIESE DATEI RECHNET NICHTS. Sie nimmt entgegen, prueft die Form und legt
 * ab. Jede Zeile, die hier eine Kennzahl ableitet, waere der Anfang einer
 * zweiten Wahrheit.
 *
 *   > Ein Spiegel, der selbst rechnet, ist kein Spiegel mehr. Zwei Quellen
 *   > derselben Zahl weichen irgendwann voneinander ab, ohne dass jemand es
 *   > merkt — `projectAll` rechnete jahrelang in Cent, und aufgefallen ist
 *   > es erst, als eine zweite Quelle danebenstand.
 *
 * Die zwei Spalten `anzahl_objekte` und `gesamtinvestition_eur` sind KOPIEN
 * aus dem payload, keine Berechnung: sie werden ausgelesen, nicht gebildet.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');

router.use(authenticate);

/* Grenze gegen einen payload, der die Zeile sprengt. portfolioPayload()
 * deckelt sich selbst bei 60 Objekten und 22 Feldern; das sind grob 200 KB.
 * 2 MB laesst Luft und faengt trotzdem ab, was offensichtlich falsch ist. */
const MAX_BYTES = 2 * 1024 * 1024;

router.put('/', async (req, res, next) => {
  try {
    const p = req.body && req.body.payload;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      return res.status(400).json({ error: 'payload fehlt oder ist kein Objekt' });
    }

    const roh = JSON.stringify(p);
    if (roh.length > MAX_BYTES) {
      return res.status(413).json({ error: 'payload zu gross', bytes: roh.length });
    }

    /* AUSGELESEN, NICHT GERECHNET. Fehlt der Wert, bleibt die Spalte leer —
       ein selbst gebildeter Ersatz waere genau die zweite Wahrheit, die
       diese Datei nicht haben darf. */
    const n = Number.isFinite(p.anzahl_objekte) ? p.anzahl_objekte : null;
    const gi = p.vermoegensbilanz
            && Number.isFinite(p.vermoegensbilanz.gesamtinvestition_eur)
      ? p.vermoegensbilanz.gesamtinvestition_eur : null;

    await query(
      `INSERT INTO portfolio_spiegel
         (user_id, payload, erfasst_am, app_version, anzahl_objekte, gesamtinvestition_eur)
       VALUES ($1, $2::jsonb, now(), $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         erfasst_am = now(),
         app_version = EXCLUDED.app_version,
         anzahl_objekte = EXCLUDED.anzahl_objekte,
         gesamtinvestition_eur = EXCLUDED.gesamtinvestition_eur`,
      [req.user.id, roh, String((req.body && req.body.app_version) || '').slice(0, 40) || null, n, gi]
    );

    res.json({ gespeichert: true, bytes: roh.length, anzahl_objekte: n });
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT payload, erfasst_am, app_version, anzahl_objekte
         FROM portfolio_spiegel WHERE user_id = $1`,
      [req.user.id]
    );
    if (!r.rows.length) return res.json({ vorhanden: false });
    const z = r.rows[0];
    res.json({
      vorhanden: true,
      erfasst_am: z.erfasst_am,
      app_version: z.app_version,
      anzahl_objekte: z.anzahl_objekte,
      payload: z.payload
    });
  } catch (e) { next(e); }
});

module.exports = router;
