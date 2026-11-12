'use strict';
/**
 * routes/objektUebergabe.js — v3317 · Objekt an Kunden uebergeben (Kundenseite)
 * Mount: /api/v1/objekt-uebergabe        (NICHT hinter requireFeature - der Kunde hat keinen Partner-Plan)
 *        /api/v1/public/objekt-uebergabe (nur das Titelfoto der Mail)
 *
 *   GET  /info?token=…     oeffentlich: wer uebergibt was, setzt "geoeffnet"
 *   POST /uebernehmen      angemeldet, {token}: Kopie ins eigene Konto, Mandant + Platz
 *   GET  /bild/:schluessel.jpg   oeffentlich (eigener Schluessel, nicht das Token)
 *
 * Die Partner-Seite (anlegen, Liste, Widerruf, Vorpruefung) liegt in routes/resellerPortal.js
 * unter /reseller/uebergaben - dort gilt das Partner-Gate.
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const uebergabe = require('../services/objektUebergabe');

const router = express.Router();

router.get('/info', async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'token_required' });
    const i = await uebergabe.info(String(token));
    if (!i) return res.status(404).json({ error: 'uebergabe_nicht_gefunden' });
    res.set('Cache-Control', 'no-store');
    res.json(i);
  } catch (e) { next(e); }
});

router.post('/uebernehmen', authenticate, async (req, res, next) => {
  try {
    const token = req.body && req.body.token;
    if (!token) return res.status(400).json({ error: 'token_required' });
    res.json(await uebergabe.uebernehmen(String(token), req.user));
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

const bildRouter = express.Router();
bildRouter.get('/bild/:schluessel', async (req, res) => {
  try {
    const b = await uebergabe.bild(String(req.params.schluessel || '').replace(/\.(jpe?g|png|webp|gif)$/i, ''));
    if (!b) return res.status(404).end();
    res.set('Content-Type', b.mime);
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.end(b.puffer);
  } catch (e) { return res.status(404).end(); }
});

module.exports = router;
module.exports.bildRouter = bildRouter;
