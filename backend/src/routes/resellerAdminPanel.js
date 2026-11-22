'use strict';
/**
 * routes/resellerAdminPanel.js — Reseller-Verwaltung fürs /admin-Panel (Paket 7)
 * Mount: /api/v1/admin-reseller  ·  Gate: requireAdmin (adminAuth, X-Admin-Token)
 */
const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const { query } = require('../db/pool');
const userService = require('../services/userService');
const planService = require('../services/planService');

const router = express.Router();
router.use(requireAdmin);

router.get('/resellers', async (req, res) => {
  try {
    const r = await query(
      `SELECT r.id, r.name, r.role, r.status, r.is_master, r.whitelabel_enabled, r.team_plaetze, r.team_plaetze_bezahlt,   /* v3830 A · v3947 bezahlt */
              (SELECT count(*)::int FROM reseller_members m WHERE m.reseller_id = r.id AND m.role = 'berater') AS team_berater,
              u.email AS owner_email,
              COUNT(l.id) FILTER (WHERE l.kind='client')                          AS pool_gekauft,
              COUNT(l.id) FILTER (WHERE l.kind='client' AND l.status='zugewiesen') AS pool_zugewiesen,
              avv.version AS avv_version, avv.accepted_at AS avv_am   /* v3620 · letzte AVV-Zustimmung des Inhabers */
         FROM resellers r
         LEFT JOIN users u    ON u.id = r.owner_user_id
         LEFT JOIN licenses l ON l.reseller_id = r.id
         LEFT JOIN LATERAL (SELECT c.version, c.accepted_at FROM consent_log c
                             WHERE c.user_id = r.owner_user_id AND c.art = 'avv'
                             ORDER BY c.accepted_at DESC LIMIT 1) avv ON true
        GROUP BY r.id, u.email, avv.version, avv.accepted_at
        ORDER BY r.is_master DESC, r.created_at ASC`
    );
    res.json({ resellers: r.rows, avv_version_aktuell: require('../services/avvService').AVV_VERSION });
  } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
});

router.get('/inquiries', async (req, res) => {
  try {
    let rows = [];
    try { const r = await query(`SELECT * FROM reseller_inquiries ORDER BY created_at DESC LIMIT 100`); rows = r.rows; } catch (e) {}
    res.json({ inquiries: rows });
  } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
});

router.post('/resellers', async (req, res) => {
  try {
    const { name, ownerEmail, role } = req.body || {};
    if (!name || !ownerEmail) return res.status(400).json({ error: 'name_and_ownerEmail_required' });
    const user = await userService.findByEmail(String(ownerEmail).toLowerCase().trim());
    if (!user) return res.status(404).json({ error: 'user_not_found', message: 'Kein Konto mit dieser E-Mail — der Partner muss sich zuerst registrieren.' });

    const ex = await query(`SELECT id FROM resellers WHERE owner_user_id=$1 LIMIT 1`, [user.id]);
    let resellerId;
    if (ex.rowCount) {
      resellerId = ex.rows[0].id;
      await query(`UPDATE resellers SET name=$2, role=$3, status='aktiv', updated_at=now() WHERE id=$1`, [resellerId, name, role || 'sonstige']);
    } else {
      const ins = await query(`INSERT INTO resellers (name, role, owner_user_id) VALUES ($1,$2,$3) RETURNING id`, [name, role || 'sonstige', user.id]);
      resellerId = ins.rows[0].id;
      await query(`INSERT INTO reseller_members (reseller_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT (reseller_id, user_id) DO NOTHING`, [resellerId, user.id]);
    }
    await planService.setUserPlanManual(user.id, 'partner', 'yearly', 365);
    res.json({ ok: true, reseller_id: resellerId });
  } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
});

/* v3830 A · Mitgliedsplaetze (Team) je Partnerkonto: { anzahl } 0 bis 100.
   v3947 · das sind jetzt die KOSTENLOSEN Teamplaetze (Bestand oder von Hand), die bezahlten (team_plaetze_bezahlt) setzt nur der Stripe-Abgleich */
router.post('/resellers/:id/team-plaetze', async (req, res) => {
  try {
    const n = parseInt(req.body && req.body.anzahl, 10);
    if (!Number.isFinite(n) || n < 0 || n > 100) return res.status(400).json({ error: 'anzahl_ungueltig' });
    const r = await query('UPDATE resellers SET team_plaetze = $2, updated_at = now() WHERE id = $1 RETURNING id, team_plaetze', [req.params.id, n]);
    if (!r.rowCount) return res.status(404).json({ error: 'reseller_not_found' });
    res.json({ ok: true, team_plaetze: r.rows[0].team_plaetze });
  } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
});

router.post('/resellers/:id/status', async (req, res) => {
  try {
    const status = (req.body && req.body.status) === 'gesperrt' ? 'gesperrt' : 'aktiv';
    await query(`UPDATE resellers SET status=$2, updated_at=now() WHERE id=$1`, [req.params.id, status]);
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
});

router.post('/inquiries/:id/status', async (req, res) => {
  try {
    const status = String((req.body && req.body.status) || 'bearbeitet');
    try { await query(`UPDATE reseller_inquiries SET status=$2 WHERE id=$1`, [req.params.id, status]); } catch (e) {}
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: 'server_error', message: e.message }); }
});

module.exports = router;
