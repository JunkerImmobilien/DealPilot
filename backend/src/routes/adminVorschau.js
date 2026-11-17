'use strict';
/* routes/adminVorschau.js — v3600
   Admin › Vorschau: die Liste der Vorschau-Funktionen (services/vorschau-funktionen.json), je Funktion
   der Schalter „für alle“, und die Freigabeliste (Konten mit Zusatz 'vorschau') sowie die Konten, die
   ueber ihre Gruppe frei sind (Admin, Entwicklungspartner).
     GET  /api/v1/admin-vorschau
     POST /api/v1/admin-vorschau/:schluessel/fuer-alle   { an }
     POST /api/v1/admin-vorschau/konten                  { email, aktiv } */
const express = require('express');
const { query } = require('../db/pool');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');
const vorschau = require('../services/vorschau');
const zusatzService = require('../services/zusatzService');

const router = express.Router();
router.use(requireAdmin);

async function audit(req, action, targetType, targetId, payload) {
  try {
    await query('INSERT INTO admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, payload, ip, user_agent, success) '
      + 'VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,true)',
      [req.adminUser.id, req.adminUser.email, action, targetType, targetId, JSON.stringify(payload || {}), req.ip, req.headers['user-agent'] || null]);
  } catch (e) { console.warn('[admin-vorschau] audit:', e.message); }
}

router.get('/', async (req, res, next) => {
  try {
    let schalter = [];
    try { schalter = (await query('SELECT schluessel, fuer_alle, geaendert_von, geaendert_am FROM vorschau_freigaben')).rows; } catch (e) { schalter = []; }
    const sw = {}; schalter.forEach((s) => { sw[s.schluessel] = s; });
    const konten = (await query("SELECT u.id, u.email, u.name, z.zusatz, z.updated_at, z.geaendert_von FROM user_zusaetze z JOIN users u ON u.id = z.user_id "
      + "WHERE z.aktiv = true ORDER BY u.email")).rows;
    const admins = (await query("SELECT email FROM users WHERE role = 'admin' ORDER BY email")).rows.map((r) => r.email);
    const funktionen = vorschau.LISTE.map((e) => {
      const s = sw[e.schluessel] || null;
      const gruppen = (e.frei_fuer || []).map((g) => {
        if (g === 'admin') return { gruppe: 'admin', text: 'Admin-Konten', konten: admins };
        if (g === 'vorschau') return { gruppe: 'vorschau', text: 'Freigabeliste Vorschau', konten: konten.filter((k) => k.zusatz === vorschau.ZUSATZ).map((k) => k.email) };
        if (g.indexOf('zusatz:') === 0) return { gruppe: g, text: 'Zusatz „' + g.slice(7) + '“', konten: konten.filter((k) => k.zusatz === g.slice(7)).map((k) => k.email) };
        return { gruppe: g, text: g, konten: [] };
      });
      return { schluessel: e.schluessel, bezeichnung: e.bezeichnung, seit: e.seit, beschreibung: e.beschreibung, routen: e.routen || [],
        fuer_alle: !!(s && s.fuer_alle), geaendert_von: s ? s.geaendert_von : null, geaendert_am: s ? s.geaendert_am : null, gruppen };
    });
    res.json({ funktionen, freigabeliste: konten.filter((k) => k.zusatz === vorschau.ZUSATZ) });
  } catch (e) { next(e); }
});

router.post('/:schluessel/fuer-alle', requireRole('owner'), async (req, res) => {
  try {
    const an = !!(req.body && req.body.an);
    await vorschau.fuerAlleSetzen(req.params.schluessel, an, req.adminUser.email);
    await audit(req, an ? 'vorschau.fuer_alle_an' : 'vorschau.fuer_alle_aus', 'vorschau', null, { schluessel: req.params.schluessel });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/konten', requireRole('owner', 'support'), async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'E-Mail fehlt' });
    const u = (await query('SELECT id FROM users WHERE lower(email) = $1', [email])).rows[0];
    if (!u) return res.status(404).json({ error: 'Kein Konto mit dieser E-Mail.' });
    const aktiv = !(req.body && req.body.aktiv === false);
    await zusatzService.setzen(u.id, zusatzService.VORSCHAU, { aktiv }, req.adminUser.email);
    await audit(req, aktiv ? 'user.zusatz_vorschau_an' : 'user.zusatz_vorschau_aus', 'user', u.id, { email });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
