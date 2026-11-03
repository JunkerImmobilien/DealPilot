'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v3095 · Online-Dauer je Nutzer und Tag (Tabelle nutzer_aktivitaet, 093)

   POST /api/v1/aktivitaet/puls  — die App ruft das einmal pro Minute, solange
   das Fenster sichtbar ist und in den letzten 5 Minuten bedient wurde
   (frontend/js/aktivitaet.js).

   Gezählt wird der Abstand zum vorigen Puls, höchstens 90 s. Über 150 s Pause
   beginnt eine neue Sitzung, der Abstand zählt nicht. Der vorige Puls ist der
   letzte des Tages — über Mitternacht beginnt also eine neue Sitzung; das
   kostet höchstens eine Minute.
   ══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');

let letzteBereinigung = 0;

router.post('/puls', authenticate, async (req, res) => {
  try {
    await query(
      `INSERT INTO nutzer_aktivitaet (user_id, tag, sekunden, sitzungen, erster_puls, letzter_puls)
       VALUES ($1, (NOW() AT TIME ZONE 'Europe/Berlin')::date, 0, 1, NOW(), NOW())
       ON CONFLICT (user_id, tag) DO UPDATE SET
         sekunden = nutzer_aktivitaet.sekunden + CASE
           WHEN NOW() - nutzer_aktivitaet.letzter_puls <= INTERVAL '150 seconds'
           THEN LEAST(GREATEST(EXTRACT(EPOCH FROM NOW() - nutzer_aktivitaet.letzter_puls), 0), 90)::int
           ELSE 0 END,
         sitzungen = nutzer_aktivitaet.sitzungen + CASE
           WHEN NOW() - nutzer_aktivitaet.letzter_puls > INTERVAL '150 seconds' THEN 1 ELSE 0 END,
         letzter_puls = NOW()`,
      [req.user.id]
    );
    /* Aufbewahrung 400 Tage — höchstens einmal je Stunde und Prozess */
    if (Date.now() - letzteBereinigung > 3600 * 1000) {
      letzteBereinigung = Date.now();
      query(`DELETE FROM nutzer_aktivitaet WHERE tag < CURRENT_DATE - 400`).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[aktivitaet/puls]', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
