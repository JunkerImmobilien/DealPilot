'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v3097 · Umsetzungswünsche der Entwicklungspartner (Tabelle 094)

   Nur Konten mit dem Zusatz 'entwicklungspartner' (user_zusaetze, Admin-Portal).
     GET    /api/v1/wuensche/zugang   { ok }  — die App blendet den Menüpunkt danach ein
     GET    /api/v1/wuensche          alle Wünsche, neueste zuerst
     POST   /api/v1/wuensche          { titel, beschreibung, bereich, dringlichkeit }
     PATCH  /api/v1/wuensche/:id      { status, antwort, backlog_nr }
   ══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');
const zusatz = require('../services/zusatzService');

const BEREICHE = ['quickcheck', 'objekt', 'steuer', 'finanzierung', 'marktbericht', 'unterlagen', 'admin', 'design', 'sonstiges'];
const DRINGLICH = ['spaeter', 'normal', 'dringend'];
const STATUS = ['neu', 'backlog', 'arbeit', 'erledigt', 'abgelehnt'];

async function istPartner(userId) {
  const z = await zusatz.holen(userId, zusatz.PARTNER);
  return !!(z && z.aktiv);
}

async function nurPartner(req, res, next) {
  try {
    if (await istPartner(req.user.id)) return next();
    res.status(403).json({ error: 'kein_entwicklungspartner' });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
}

const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

router.get('/zugang', authenticate, async (req, res) => {
  try { res.json({ ok: await istPartner(req.user.id) }); }
  catch (e) { res.json({ ok: false }); }
});

router.get('/', authenticate, nurPartner, async (req, res) => {
  try {
    const r = await query(
      `SELECT w.id, w.titel, w.beschreibung, w.bereich, w.dringlichkeit, w.status, w.backlog_nr,
              w.antwort, w.geaendert_von, w.created_at, w.updated_at,
              COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS von,
              (w.user_id = $1) AS eigen
         FROM umsetzungswuensche w LEFT JOIN users u ON u.id = w.user_id
        ORDER BY CASE w.status WHEN 'neu' THEN 0 WHEN 'arbeit' THEN 1 WHEN 'backlog' THEN 2 ELSE 3 END,
                 w.created_at DESC
        LIMIT 300`, [req.user.id]);
    res.json({ wuensche: r.rows });
  } catch (e) {
    console.error('[wuensche/list]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/', authenticate, nurPartner, async (req, res) => {
  const b = req.body || {};
  const titel = text(b.titel, 200);
  if (titel.length < 3) return res.status(400).json({ error: 'titel_fehlt', text: 'Bitte einen Titel mit mindestens 3 Zeichen.' });
  const bereich = BEREICHE.includes(b.bereich) ? b.bereich : 'sonstiges';
  const dringlichkeit = DRINGLICH.includes(b.dringlichkeit) ? b.dringlichkeit : 'normal';
  try {
    const r = await query(
      `INSERT INTO umsetzungswuensche (user_id, titel, beschreibung, bereich, dringlichkeit)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, titel, text(b.beschreibung, 8000), bereich, dringlichkeit]);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error('[wuensche/neu]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/:id', authenticate, nurPartner, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!(id > 0)) return res.status(400).json({ error: 'id_ungueltig' });
  const b = req.body || {};
  const sets = [], vals = [];
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return res.status(400).json({ error: 'status_ungueltig' });
    vals.push(b.status); sets.push('status = $' + vals.length);
  }
  if (b.antwort !== undefined) { vals.push(text(b.antwort, 4000) || null); sets.push('antwort = $' + vals.length); }
  if (b.backlog_nr !== undefined) { vals.push(text(b.backlog_nr, 20) || null); sets.push('backlog_nr = $' + vals.length); }
  if (!sets.length) return res.status(400).json({ error: 'nichts_zu_aendern' });
  vals.push(req.user.email || null); sets.push('geaendert_von = $' + vals.length);
  vals.push(id);
  try {
    const r = await query(`UPDATE umsetzungswuensche SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING id`, vals);
    if (!r.rowCount) return res.status(404).json({ error: 'nicht_gefunden' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[wuensche/aendern]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
