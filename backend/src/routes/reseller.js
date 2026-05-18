'use strict';
/**
 * V200: Reseller-Anfragen
 *
 * Public-Endpoint zum Einsenden, Admin-Endpoints zum Verwalten.
 *
 * Endpoints:
 *   POST /api/v1/reseller-inquiries           - public (mit Rate-Limit)
 *   GET  /api/v1/admin/reseller-inquiries     - admin: liste
 *   GET  /api/v1/admin/reseller-inquiries/:id - admin: detail
 *   PATCH /api/v1/admin/reseller-inquiries/:id - admin: status/notes ändern
 */

const express = require('express');
const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────

function validEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function cleanField(v, maxLen = 500) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// ─── Rate-Limit: max. 3 pro IP pro Stunde ─────────────────────

const _rateMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const entries = _rateMap.get(ip) || [];
  const recent = entries.filter(t => now - t < HOUR);
  if (recent.length >= 3) return false;
  recent.push(now);
  _rateMap.set(ip, recent);
  // Cleanup
  if (Math.random() < 0.01) {
    for (const [k, v] of _rateMap) {
      if (v.every(t => now - t > HOUR)) _rateMap.delete(k);
    }
  }
  return true;
}

// ─── POST /api/v1/reseller-inquiries (public) ─────────────────

router.post('/reseller-inquiries', async (req, res) => {
  const db = req.app.get('db');
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || '';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'rate_limit',
      message: 'Du hast zu viele Anfragen gesendet. Bitte versuche es in einer Stunde erneut.'
    });
  }

  const data = req.body || {};
  const contact_name = cleanField(data.contact_name, 200);
  const company = cleanField(data.company, 200);
  const email = cleanField(data.email, 200);
  const phone = cleanField(data.phone, 50);
  const website = cleanField(data.website, 300);
  const team_size = cleanField(data.team_size, 50);
  const target_market = cleanField(data.target_market, 200);
  const current_volume = cleanField(data.current_volume, 100);
  const goals = cleanField(data.goals, 2000);
  const message = cleanField(data.message, 2000);
  const source = cleanField(data.source, 100) || 'unknown';

  if (!contact_name) return res.status(400).json({ error: 'missing_name', message: 'Bitte gib deinen Namen ein.' });
  if (!email || !validEmail(email)) return res.status(400).json({ error: 'invalid_email', message: 'Bitte gib eine gültige E-Mail-Adresse ein.' });

  // Honeypot — wenn das Feld 'website_url' gefüllt ist (im Frontend versteckt), ist es Bot
  if (data.website_url) {
    console.warn('[reseller] honeypot hit', ip);
    // Antworte aber 200 damit der Bot denkt es war erfolgreich
    return res.json({ ok: true });
  }

  try {
    const result = await db.query(`
      INSERT INTO reseller_inquiries
        (contact_name, company, email, phone, website, team_size, target_market,
         current_volume, goals, message, source, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, created_at
    `, [contact_name, company, email, phone, website, team_size, target_market,
        current_volume, goals, message, source, ip, userAgent]);

    const inquiry = result.rows[0];

    // Optional: Bestätigungs-Mail an Anfrager + Admin-Notification
    setImmediate(async () => {
      try {
        const { notifyAdminAboutReseller, sendResellerAcknowledgement } = require('../services/resellerNotify');
        if (notifyAdminAboutReseller) {
          await notifyAdminAboutReseller(db, { id: inquiry.id, contact_name, email, company, message, goals });
        }
        if (sendResellerAcknowledgement) {
          await sendResellerAcknowledgement(db, { contact_name, email });
        }
      } catch (err) {
        console.error('[reseller] notify failed (non-fatal):', err.message);
      }
    });

    res.json({
      ok: true,
      id: inquiry.id,
      message: 'Vielen Dank! Wir melden uns innerhalb von 2 Werktagen bei dir.'
    });
  } catch (err) {
    console.error('[reseller-inquiry] error:', err);
    res.status(500).json({ error: 'server_error', message: 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.' });
  }
});

module.exports = router;
