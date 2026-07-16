'use strict';
/**
 * routes/resellerInvite.js — Mandanten-Einladung annehmen (Paket 5)
 * Mount: /api/v1/reseller-invite  (NICHT hinter requireFeature — der
 * eingeladene Mandant hat KEINEN Partner-Plan)
 *
 *   GET  /info?token=…   öffentlich: zeigt wer einlädt (für die Landeseite)
 *   POST /accept {token} authentifiziert: verknüpft den eingeloggten User
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const reseller = require('../services/resellerService');

const router = express.Router();

// Branding des Resellers, dem der eingeloggte User als MANDANT gehört
// (nicht für den Owner — dessen eigene App soll sich nicht umfärben).
router.get('/my-branding', authenticate, async (req, res, next) => {
  try {
    const { query } = require('../db/pool');
    const r = await query(
      /* W1a-contact: Kontaktdaten mitliefern, sonst faellt der PDF-Footer auf JUNKER_DEFAULTS zurueck */
      `SELECT rs.whitelabel_enabled, rs.brand_name, rs.brand_logo_b64,
              rs.brand_accent, rs.brand_accent_hi, rs.brand_accent_lo, rs.brand_obsidian,
              rs.brand_company, rs.brand_address, rs.brand_plz, rs.brand_city,
              rs.brand_phone, rs.brand_email, rs.brand_website, rs.brand_tagline,
              rs.brand_pdf_light, rs.brand_display /*W12-pdflight W20-display*/
         FROM reseller_clients rc JOIN resellers rs ON rs.id = rc.reseller_id
        WHERE rc.user_id = $1
        LIMIT 1`, [req.user.id]);
    const b = r.rows[0];
    if (!b || !b.whitelabel_enabled) return res.json({ branding: null });
    res.json({ branding: b });
  } catch (e) { next(e); }
});

// Öffentlich — nur unkritische Anzeige-Infos, per Zufalls-Token geschützt
router.get('/info', async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'token_required' });
    const info = await reseller.getInviteInfo(token);
    if (!info) return res.status(404).json({ error: 'invite_not_found' });
    res.json(info);
  } catch (e) { next(e); }
});

// Annahme — der eingeloggte Mandant wird verknüpft
router.post('/accept', authenticate, async (req, res, next) => {
  try {
    const token = req.body && req.body.token;
    if (!token) return res.status(400).json({ error: 'token_required' });
    const r = await reseller.acceptInvite(token, req.user.id);
    res.json(r);
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

// ── Mandanten-Freigaben (eigene Objekte an den Reseller freigeben) ──
router.get('/my-reseller', authenticate, async (req, res, next) => {
  try { res.json({ reseller: await reseller.getMyReseller(req.user.id) }); }
  catch (e) { next(e); }
});
router.get('/my-shares', authenticate, async (req, res, next) => {
  try { res.json({ shares: await reseller.listMandantShares(req.user.id) }); }
  catch (e) { next(e); }
});
router.post('/my-shares', authenticate, async (req, res, next) => {
  try {
    const objectId = req.body && req.body.objectId;
    if (!objectId) return res.status(400).json({ error: 'objectId_required' });
    res.json({ share: await reseller.createMandantShare(req.user.id, objectId) });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});
router.post('/my-shares/:id/revoke', authenticate, async (req, res, next) => {
  try { res.json({ share: await reseller.revokeMandantShare(req.user.id, req.params.id) }); }
  catch (e) { next(e); }
});

module.exports = router;
