'use strict';
/* /api/v1/immometrica – per-User-Zugang, KEIN Kerosin (Datenabruf). */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const creds = require('../services/providerCredentialsService');
const imo = require('../services/immometricaService');

const router = express.Router();
const PROVIDER = 'immometrica';
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// JWT-Payload kann userId ODER id heissen -> beide abdecken
function uid(req) { return (req.user && (req.user.id || req.user.userId)) || null; }

/* ---- Credentials ---- */
/* ══ v1993 · IMMOMETRICA SAGT SELBST, IN WELCHEM MODUS ES LAEUFT ══════

   Marcel am 08.10.2026: „kannst du mir auf staging immometrica einmal
   wieder von demo auf live umschalten?"

   GEMESSEN auf Staging: `IMMOMETRICA_MODE` steht weder in compose noch
   in der .env noch im Container. Das Backend lief fuer ImmoMetrica also
   laengst live. Die Demo-Inserate kamen aus dem FRONTEND — es fragte
   `/api/v1/avm/health` und las daraus `mode`.

   Das ist eine Kopplung, kein Schalter: `AVM_MODE=live` gibt daneben
   Sprengnetter und PriceHubble frei (AVM_LIVE_PROVIDERS), beide
   kostenpflichtig je Abruf. Wer ImmoMetrica live will, schaltet damit
   zwei bezahlte Bewertungsanbieter mit ein.

     > Ein Schalter, der zwei unabhaengige Schnittstellen steuert, ist
     > kein Schalter, sondern eine Kopplung. Und Geld wird nicht
     > nebenbei eingeschaltet.

   Diese Auskunft ist OEFFENTLICH wie `/avm/health` — sie verraet nichts
   ausser dem Betriebsmodus, keinen Token, keine Zugangsdaten. */
router.get('/health', (req, res) => {
  const stub = String(process.env.IMMOMETRICA_MODE || '').toLowerCase() === 'stub';
  res.json({
    mode: stub ? 'stub' : 'live',
    base: (process.env.IMMOMETRICA_BASE || 'https://www.immometrica.com/searchapi/v1/'),
  });
});

router.get('/credentials', authenticate, async (req, res, next) => {
  try { res.json({ immometrica: await creds.getMeta(uid(req), PROVIDER) }); } catch (e) { next(e); }
});

router.put('/credentials', authenticate, async (req, res, next) => {
  try {
    const token = ((req.body && req.body.token) || '').trim();
    if (!token) return res.status(400).json({ error: 'Token fehlt' });
    res.json(await creds.setCredential(uid(req), PROVIDER, token));
  } catch (e) { next(e); }
});

router.delete('/credentials', authenticate, async (req, res, next) => {
  try { res.json(await creds.remove(uid(req), PROVIDER)); } catch (e) { next(e); }
});

router.post('/credentials/reveal', authenticate, async (req, res, next) => {
  try {
    const pw = (req.body && req.body.password) || '';
    if (!(await creds.verifyPassword(uid(req), pw))) return res.status(401).json({ error: 'Passwort falsch' });
    const secret = await creds.getSecret(uid(req), PROVIDER);
    if (secret == null) return res.status(404).json({ error: 'Kein Zugang gespeichert' });
    res.json({ token: secret });
  } catch (e) { next(e); }
});

/* ---- Daten (nutzt gespeicherten Token) ---- */
async function tokenOr428(req, res) {
  if (String(process.env.IMMOMETRICA_MODE || '').toLowerCase() === 'stub') return 'stub-token'; /* v893c-stub */
  const t = await creds.getSecret(uid(req), PROVIDER);
  if (t == null) { res.status(428).json({ error: 'Kein ImmoMetrica-Zugang gespeichert' }); return null; }
  return t;
}

router.get('/searches', authenticate, limiter, async (req, res) => {
  try { const t = await tokenOr428(req, res); if (!t) return; res.json(await imo.getSearches(t)); }
  catch (e) { res.status(e.status || 502).json({ error: 'ImmoMetrica-Fehler', detail: String(e.message) }); }
});

router.get('/searches/:id/results', authenticate, limiter, async (req, res) => {
  try { const t = await tokenOr428(req, res); if (!t) return; res.json(await imo.getResults(t, req.params.id, req.query.page)); }
  catch (e) { res.status(e.status || 502).json({ error: 'ImmoMetrica-Fehler', detail: String(e.message) }); }
});

router.get('/favorites/:cc', authenticate, limiter, async (req, res) => {
  try { const t = await tokenOr428(req, res); if (!t) return; res.json(await imo.getFavorites(t, req.params.cc)); }
  catch (e) { res.status(e.status || 502).json({ error: 'ImmoMetrica-Fehler', detail: String(e.message) }); }
});

module.exports = router;
