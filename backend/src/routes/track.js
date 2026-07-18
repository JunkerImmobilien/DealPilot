// v973: oeffentlicher Landing-Tracking-Endpoint. KEINE Auth (Landing hat keinen Login),
// rate-limited beim Mount. Nimmt NUR bekannte Event-Typen, cappt Groessen, speichert KEINE IP/PII.
const express = require('express');
const router = express.Router();

const ALLOWED = new Set(['pageview', 'scroll', 'section', 'cta', 'exit', 'heartbeat']);
const DEVICES = new Set(['desktop', 'mobile', 'tablet']);
function cap(v, max) { if (v == null) return null; v = String(v); return v.length > max ? v.slice(0, max) : v; }

router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const type = String(b.event_type || '');
    if (!ALLOWED.has(type)) return res.status(204).end();
    const db = req.app.get('db');
    if (!db) return res.status(204).end();
    const sess = cap(b.session_id, 40) || 'anon';
    const dev = DEVICES.has(b.device) ? b.device : null;
    let val = null;
    if (b.value != null && isFinite(+b.value)) val = Math.max(0, Math.min(1000000, Math.round(+b.value)));
    await db.query(
      `INSERT INTO landing_events (session_id, event_type, path, section, value, referrer, device, utm_source, utm_campaign)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [sess, type, cap(b.path, 200), cap(b.section, 60), val, cap(b.referrer, 300), dev, cap(b.utm_source, 80), cap(b.utm_campaign, 80)]
    );
    return res.status(204).end();
  } catch (e) { return res.status(204).end(); } // nie den Landing-Client stoeren
});

module.exports = router;
