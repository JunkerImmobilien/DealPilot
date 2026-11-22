'use strict';
/**
 * routes/vivi.js — v3950 · ViVi-Anbindung (Pakete V1 bis V3)
 * Mount: /api/v1/vivi  · Vorschau-Funktion 'vivi' (services/vorschau-funktionen.json): nur Admin und Freigabeliste.
 *
 *   GET    /verbindung                  { exists, hint, updatedAt }   (nie der Token)
 *   PUT    /verbindung      {token}     Token verschluesselt speichern (providerCredentialsService, Anbieter 'vivi')
 *   DELETE /verbindung                  Token in DealPilot loeschen
 *   POST   /verbindung/probe            Probeabruf GET /accounts bei ViVi
 *   GET    /projekte?account_id=        ViVi-Objekte zum Zuordnen (nur lesen)
 *   GET    /objekte                     verknuepfte DealPilot-Objekte des Nutzers
 *   POST   /objekt/:id/vorschau         welche Felder an ViVi gehen wuerden (schickt nichts)
 *   POST   /objekt/:id/anlegen          EINMAL anlegen (409, wenn schon verknuepft)
 *   POST   /objekt/:id/zuordnen         vorhandenes ViVi-Objekt verknuepfen (schickt nichts an ViVi)
 *   GET    /objekt/:id/werte            zuletzt gelesene ViVi-Werte (schickt nichts an ViVi)
 *   POST   /objekt/:id/abrufen          „Jetzt abgleichen": nur GET bei ViVi
 *   DELETE /objekt/:id/verknuepfung     Verknuepfung in DealPilot loesen, ViVi bleibt unberuehrt
 *
 * Die Methoden hier sind die von DealPilot. An ViVi geht nur, was services/vivi/viviClient.js erlaubt:
 * GET und POST an die Anlege-Pfade. tools/vivi-pruefen.mjs prueft das.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const vorschau = require('../services/vorschau');
const dienst = require('../services/vivi/viviDienst');

const router = express.Router();
router.use(authenticate);
router.use(vorschau.sperre('vivi'));

const bremse = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uid(req) { return (req.user && (req.user.id || req.user.userId)) || null; }
function oid(req, res) {
  const id = String(req.params.id || '');
  if (!UUID.test(id)) { res.status(400).json({ error: 'Objekt-ID ungültig' }); return null; }
  return id;
}
function antwort(res, next) {
  return function (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message, code: e.code || null, fehlt: e.fehlt || undefined, details: e.details || undefined, fortsetzbar: e.fortsetzbar || undefined });
    next(e);
  };
}

router.get('/verbindung', function (req, res, next) {
  dienst.verbindungMeta(uid(req)).then(function (m) { res.json({ vivi: m }); }).catch(antwort(res, next));
});
router.put('/verbindung', function (req, res, next) {
  dienst.verbindungSpeichern(uid(req), req.body && req.body.token).then(function (m) { res.json({ vivi: m }); }).catch(antwort(res, next));
});
router.delete('/verbindung', function (req, res, next) {
  dienst.verbindungLoeschen(uid(req)).then(function (m) { res.json({ vivi: m }); }).catch(antwort(res, next));
});
router.post('/verbindung/probe', bremse, function (req, res, next) {
  dienst.probe(uid(req)).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.get('/projekte', bremse, function (req, res, next) {
  dienst.projekte(uid(req), req.query.account_id ? String(req.query.account_id) : null).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.get('/objekte', function (req, res, next) {
  require('../services/vivi/viviSpeicher').verknuepfteObjekte(uid(req)).then(function (r) { res.json({ objekte: r }); }).catch(antwort(res, next));
});

router.post('/objekt/:id/vorschau', function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.vorschau(uid(req), id, req.body || {}).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.post('/objekt/:id/anlegen', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  const b = req.body || {};
  if (b.bestaetigt !== true) return res.status(400).json({ error: 'Bitte die Vorschau bestätigen.' });
  dienst.anlegen(uid(req), id, { account_id: b.account_id ? String(b.account_id) : null, platzhalter_namen: !!b.platzhalter_namen, faellig_tag: b.faellig_tag })
    .then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.post('/objekt/:id/zuordnen', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  const b = req.body || {};
  dienst.zuordnen(uid(req), id, b.vivi_objekt_id, b.account_id ? String(b.account_id) : null).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.get('/objekt/:id/werte', function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.werte(uid(req), id).then(function (r) { res.set('Cache-Control', 'no-store'); res.json(r); }).catch(antwort(res, next));
});
router.post('/objekt/:id/abrufen', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.abrufen(uid(req), id).then(function () { return dienst.werte(uid(req), id); }).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.delete('/objekt/:id/verknuepfung', function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.loesen(uid(req), id).then(function (r) { res.json(r); }).catch(antwort(res, next));
});

module.exports = router;
