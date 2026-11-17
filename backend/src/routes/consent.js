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
    if (art === 'avv') return res.status(400).json({ error: 'nur_ueber_consent_avv' });   /* v3620 · Version wird dort geprueft */
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

/* v3620 · Auftragsverarbeitungsvertrag (services/avvService.js)
   GET  /api/v1/consent/avv   { version, stand, link, text, zugestimmt: { version, am } | null, aktuell }
   POST /api/v1/consent/avv   { zugestimmt: true, version, weg? }  -> 400 ohne Haekchen, 409 bei alter Version */
const avv = require('../services/avvService');
router.get('/avv', async (req, res) => {
  try { res.json(Object.assign({ ok: true }, await avv.stand(req.user.id))); }
  catch (e) { res.status(500).json({ error: 'server_error' }); }
});
router.post('/avv', async (req, res) => {
  try {
    const b = req.body || {};
    await avv.pruefen({ body: { avv_zustimmung: b.zugestimmt === true, avv_version: b.version }, user: req.user, headers: req.headers },
      { weg: (b.weg === 'cockpit' || b.weg === 'einstellungen') ? b.weg : 'direkt' });
    res.json(Object.assign({ ok: true }, await avv.stand(req.user.id)));
  } catch (e) {
    res.status(e.status || 400).json({ error: e.code || 'consent_fehler', message: e.message });
  }
});

module.exports = router;
