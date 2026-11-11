'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   partnerLogo.js · v3299 — oeffentliche Auslieferung der Partner-Logos

   WARUM: Die Einladungs-Mail trug das Logo als data:-Bild im HTML. Gmail
   und Outlook zeigen solche Bilder in der Regel nicht an (Befund
   Partner-Demo 2g, L7). Eine Mail braucht eine abrufbare Adresse.

     GET /api/v1/public/partner-logo/:id/:art.png
         art = dunkel | hell | original

   Ausgeliefert wird NUR ein Partner-Logo, nur bei aktivem Whitelabel und nur
   als Bild (Inhaltstyp aus der Data-URL, kein Durchreichen von Text). Die
   Kennung ist die UUID des Partners - sie steht ohnehin in jeder Mail, und
   das Logo ist zum Zeigen gemacht. Kein Token, keine Personendaten.

   dunkel/hell sind die Varianten aus logo-kontrast.js (PNG). Fehlen sie
   (Branding vor v3299, Partner hat sein Portal seither nicht geoeffnet),
   kommt das Original - ausser es ist ein SVG: das zeigt kaum ein
   Mailprogramm, dann 404 und die Mail setzt den Namen als Schriftzug.
   ═══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

const SPALTE = { dunkel: 'brand_logo_auf_dunkel', hell: 'brand_logo_auf_hell' };

router.get('/:id/:art', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const art = String(req.params.art || '').replace(/\.png$/i, '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^(dunkel|hell|original)$/.test(art)) return res.status(404).end();
    const r = await query(
      `SELECT brand_logo_b64, brand_logo_auf_dunkel, brand_logo_auf_hell
         FROM resellers WHERE id = $1 AND whitelabel_enabled = true`, [id]);
    const z = r.rows[0];
    if (!z) return res.status(404).end();
    const quelle = (SPALTE[art] && z[SPALTE[art]]) || z.brand_logo_b64 || '';
    const m = /^data:(image\/(png|jpeg|gif|webp));base64,(.+)$/.exec(quelle);
    if (!m) return res.status(404).end();                    /* SVG oder Unsinn -> kein Bild */
    const buf = Buffer.from(m[3], 'base64');
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.end(buf);
  } catch (e) {
    return res.status(404).end();
  }
});

/** Die Adresse fuer eine Mail. `basis` ohne Schraegstrich am Ende, `v` haelt Mail-Caches frisch. */
function logoUrl(basis, id, art, v) {
  if (!basis || !id) return null;
  return String(basis).replace(/\/+$/, '') + '/api/v1/public/partner-logo/' + id + '/' + art + '.png' + (v ? '?v=' + encodeURIComponent(v) : '');
}

module.exports = router;
module.exports.logoUrl = logoUrl;
