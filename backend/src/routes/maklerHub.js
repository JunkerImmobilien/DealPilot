'use strict';
/* routes/maklerHub.js · v3190 — Makler-Hub × DealPilot, Mount /api/v1/hub
   Vertrag: Dateien/Makler-Hub/Anmeldung-Schnittstelle.md. Logik in services/maklerHubService.js.

     GET    /pruefen?client_id&redirect_uri   öffentlich - darf die Verbinden-Seite weiterleiten?
     GET    /status                           angemeldet - Konto, Paket, Kontingent, verbunden?
     POST   /code                             angemeldet (nur Sitzung, kein API-Schlüssel) - Einmal-Code
     POST   /token                            Hub-Server, Basic client_id:client_secret - Code gegen Token
     GET    /konto                            Hub-Server, Bearer hub_token
     DELETE /verbindung                       Hub-Server, Bearer hub_token - trennen
     DELETE /meine-verbindung                 angemeldet - in DealPilot trennen (Webhook an den Hub) */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const hub = require('../services/maklerHubService');

function keinCache(res) { res.set('Cache-Control', 'no-store'); res.set('Pragma', 'no-cache'); }
function nurSitzung(req, res, next) {
  if (req.apiKey) return res.status(403).json({ error: 'Nur mit Anmeldung, nicht per API-Schlüssel.' });
  next();
}

router.get('/pruefen', (req, res) => {
  const p = hub.clientPruefen(String(req.query.client_id || ''), String(req.query.redirect_uri || ''));
  res.json(p);
});

router.get('/status', authenticate, nurSitzung, async (req, res, next) => {
  try {
    const k = await hub.konto(req.user.id);
    const v = await hub.verbunden(req.user.id);
    res.json(Object.assign({}, k, { verbunden: !!v, verbunden_seit: v ? v.created_at : null }));
  } catch (e) { next(e); }
});

router.post('/code', authenticate, nurSitzung, async (req, res) => {
  keinCache(res);
  try {
    const b = req.body || {};
    const code = await hub.codeAusstellen(req.user.id, String(b.client_id || ''), String(b.redirect_uri || ''), String(b.code_challenge || ''), req.ip);
    if (Math.random() < 0.05) hub.aufraeumen();
    res.json({ code: code });
  } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Code konnte nicht erzeugt werden.' }); }
});

/* Bremse auf den Token-Tausch: etwa 30 je Minute je IP (Vertrag „Sicherheit") */
const tokenBremse = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'too_many_requests' } });

router.post('/token', tokenBremse, express.urlencoded({ extended: false }), async (req, res) => {
  keinCache(res);
  if (!hub.clientAuth(req.headers.authorization)) return res.status(401).json({ error: 'invalid_client' });
  try {
    const r = await hub.tokenTauschen(req.body, req.ip);
    if (r.fehler) return res.status(400).json({ error: r.fehler });
    res.json(r.antwort);
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

router.get('/konto', async (req, res) => {
  keinCache(res);
  try {
    const v = await hub.verbindungZumToken(req.headers.authorization);
    if (!v) return res.status(401).json({ error: 'verbindung_getrennt' });
    const k = await hub.konto(v.user_id);
    if (!k) return res.status(401).json({ error: 'verbindung_getrennt' });
    res.json(k);
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

router.delete('/verbindung', async (req, res) => {
  try {
    const v = await hub.verbindungZumToken(req.headers.authorization);
    if (!v) return res.status(401).json({ error: 'verbindung_getrennt' });
    await hub.trennen(v, req.ip, 'hub');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

router.delete('/meine-verbindung', authenticate, nurSitzung, async (req, res, next) => {
  try { res.json({ ok: true, getrennt: await hub.trennenFuerNutzer(req.user.id, req.ip) }); }
  catch (e) { next(e); }
});

module.exports = router;
