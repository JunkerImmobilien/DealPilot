/**
 * v2933 · /api/v1/consent - Zustimmungen protokollieren und einsehen.
 * legal.js rief diesen Endpunkt seit V272 auf, es gab ihn aber nicht.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const consent = require('../services/consentService');

router.use(authenticate);

// POST /api/v1/consent  { art, version, kontext? }
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const art = b.art || (b.disclaimer_version ? 'hinweise' : null);
    const version = b.version || b.disclaimer_version;
    if (consent.ARTEN.indexOf(art) < 0) return res.status(400).json({ error: 'unbekannte_art' });
    if (art === 'widerruf_verzicht') return res.status(400).json({ error: 'nur_im_checkout' });
    const z = await consent.protokollieren({
      userId: req.user.id, art, version,
      userAgent: req.headers['user-agent'],
      kontext: (b.kontext && typeof b.kontext === 'object') ? b.kontext : null
    });
    res.json({ ok: true, id: z.id, accepted_at: z.accepted_at });
  } catch (e) {
    res.status(400).json({ error: 'consent_fehler', message: e.message });
  }
});

// GET /api/v1/consent - die eigenen Zustimmungen (Auskunft Art. 15)
router.get('/', async (req, res) => {
  try { res.json({ ok: true, zustimmungen: await consent.fuerNutzer(req.user.id) }); }
  catch (e) { res.status(500).json({ error: 'server_error' }); }
});

// GET /api/v1/consent/widerruf-text - der Wortlaut fuer das Fenster vor dem Kauf
router.get('/widerruf-text', (req, res) => {
  res.json({ version: consent.WIDERRUF_VERSION, text: consent.WIDERRUF_TEXT });
});

module.exports = router;
