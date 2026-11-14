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

// Branding des Resellers fuer den eingeloggten User.
// v3301 (Marcel 11.11.2026: "Er stellt sich das ein fuer seine Firma und sieht
// das selber auch. Das muss auf beiden Seiten so sein."): nicht mehr nur fuer
// den MANDANTEN, sondern auch fuer den Partner selbst (Owner und Teammitglieder
// aus reseller_members) - der dreht den Bildschirm zum Kunden.
// Hier stand bis v3299 "nicht für den Owner — dessen eigene App soll sich
// nicht umfärben". Admins bleiben ausgenommen (info@ fuehrt einen Test-Reseller).
// rolle: 'mandant' | 'partner' - das Frontend wendet beim Partner nur die
// MARKE an, nicht die Darstellungs-Vorgabe fuer Mandanten (brand_display).
const BRANDING_SPALTEN = `rs.whitelabel_enabled, rs.brand_name, rs.brand_logo_b64,
              rs.brand_accent, rs.brand_accent_hi, rs.brand_accent_lo, rs.brand_obsidian,
              rs.brand_company, rs.brand_address, rs.brand_plz, rs.brand_city,
              rs.brand_phone, rs.brand_email, rs.brand_website, rs.brand_tagline,
              rs.brand_pdf_light, rs.brand_display,
              rs.brand_logo_dark_b64, rs.brand_logo_auf_dunkel, rs.brand_logo_auf_hell`;
router.get('/my-branding', authenticate, async (req, res, next) => {
  try {
    const { query } = require('../db/pool');
    /* W1a-contact: Kontaktdaten mitliefern, sonst faellt der PDF-Footer auf JUNKER_DEFAULTS zurueck;
       W12-pdflight, W20-display, v3299 Logo-Kontrast - alles in BRANDING_SPALTEN. */
    const r = await query(
      'SELECT ' + BRANDING_SPALTEN +
      ' FROM reseller_clients rc JOIN resellers rs ON rs.id = rc.reseller_id' +
      /* v3357 · Marke je Kunde (rc.marke) und nur bei aktiver Verbindung */
      " WHERE rc.user_id = $1 AND rc.getrennt_am IS NULL AND rc.marke = 'partner' LIMIT 1", [req.user.id]);
    let b = r.rows[0];
    if (b) {
      if (!b.whitelabel_enabled) return res.json({ branding: null });
      return res.json({ branding: Object.assign({}, b, { rolle: 'mandant' }) });
    }
    /* v3301 · Partner selbst: Owner oder Mitglied, gleiche Rangfolge wie
       resellerService.getResellerForUser (Owner zuerst, dann der mit dem Pool). */
    const p = await query(
      'SELECT ' + BRANDING_SPALTEN +
      ' FROM resellers rs JOIN users u ON u.id = $1' +
      " WHERE u.role IS DISTINCT FROM 'admin'" +
      '   AND (rs.owner_user_id = $1' +
      '        OR rs.id IN (SELECT reseller_id FROM reseller_members WHERE user_id = $1))' +
      ' ORDER BY (rs.owner_user_id = $1) DESC,' +
      '          (SELECT COUNT(*) FROM licenses l WHERE l.reseller_id = rs.id) DESC,' +
      '          rs.created_at ASC' +
      ' LIMIT 1', [req.user.id]);
    b = p.rows[0];
    if (!b || !b.whitelabel_enabled) return res.json({ branding: null });
    res.json({ branding: Object.assign({}, b, { rolle: 'partner' }) });
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
