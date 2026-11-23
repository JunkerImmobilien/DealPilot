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
 *   GET    /importierbar?account_id=    v4050 · ViVi-Objekte ohne Verknuepfung, mit Kurzvorschau (nur lesen)
 *   POST   /importieren     {vivi_id}   v4050 · EIN ViVi-Objekt als gewonnenes DealPilot-Objekt anlegen (ViVi nur lesen)
 *   POST   /objekt/:id/vorschau         welche Felder an ViVi gehen wuerden (schickt nichts)
 *   POST   /objekt/:id/anlegen          EINMAL anlegen (409, wenn schon verknuepft)
 *   POST   /objekt/:id/zuordnen         vorhandenes ViVi-Objekt verknuepfen (schickt nichts an ViVi)
 *   GET    /objekt/:id/werte            zuletzt gelesene ViVi-Werte (schickt nichts an ViVi)
 *   POST   /objekt/:id/abrufen          „Jetzt abgleichen": nur GET bei ViVi
 *   DELETE /objekt/:id/verknuepfung     Verknuepfung in DealPilot loesen, ViVi bleibt unberuehrt
 *   POST   /objekt/:id/frage   {text, einheit?, verlauf?}   v4130 · Co-Pilot mit ViVi-Werkzeugen, nur lesen, Mieter abgekuerzt
 *   GET    /steuer-einstellung          v4020 · Steuerjahre aus ViVi: { einstellung: {modus, kategorien}, kategorien: [...] }
 *   PUT    /steuer-einstellung          v4020 · { modus: aus|vorschlag|automatisch, kategorien: {id: bool} } (user_settings 'vivi_steuer')
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
/* v4050 · Objekte aus ViVi uebernehmen: Liste der noch nicht verknuepften ViVi-Objekte (nur GET bei ViVi) und Import EINES
   Objekts je Aufruf (der Browser zaehlt den Fortschritt). Kein Schreibzugriff auf ViVi. */
router.get('/importierbar', bremse, function (req, res, next) {
  dienst.importierbar(uid(req), req.query.account_id ? String(req.query.account_id) : null).then(function (r) { res.set('Cache-Control', 'no-store'); res.json(r); }).catch(antwort(res, next));
});
router.post('/importieren', bremse, function (req, res, next) {
  const b = req.body || {};
  const vid = b.vivi_id != null ? b.vivi_id : (Array.isArray(b.ids) && b.ids.length === 1 ? b.ids[0] : null);
  if (vid == null || !/^[A-Za-z0-9_-]{1,64}$/.test(String(vid))) return res.status(400).json({ error: 'Bitte genau ein ViVi-Objekt angeben.', code: 'vivi_id_ungueltig' });
  dienst.importieren(uid(req), String(vid), b.account_id ? String(b.account_id) : null).then(function (r) { res.json(r); }).catch(antwort(res, next));
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
  dienst.anlegen(uid(req), id, { account_id: b.account_id ? String(b.account_id) : null, platzhalter_namen: typeof b.platzhalter_namen === 'boolean' ? b.platzhalter_namen : undefined,
    muster_anschrift: typeof b.muster_anschrift === 'boolean' ? b.muster_anschrift : undefined, faellig_tag: b.faellig_tag })
    .then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.post('/objekt/:id/zuordnen', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  const b = req.body || {};
  dienst.zuordnen(uid(req), id, b.vivi_objekt_id, b.account_id ? String(b.account_id) : null, { muster_anschrift: typeof b.muster_anschrift === 'boolean' ? b.muster_anschrift : undefined }).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
router.get('/objekt/:id/werte', function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.werte(uid(req), id).then(function (r) { res.set('Cache-Control', 'no-store'); res.json(r); }).catch(antwort(res, next));
});
router.post('/objekt/:id/abrufen', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.abrufen(uid(req), id).then(function () { return dienst.werte(uid(req), id); }).then(function (r) { res.json(r); }).catch(antwort(res, next));
});
/* v4037 · Mieterhoehung aus DealPilot in ViVi (Marcel 23.11.2026). vorschau=true rechnet nur, sonst bestaetigt === true Pflicht. */
router.post('/objekt/:id/mieterhoehung', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  const b = req.body || {};
  const vorschau = b.vorschau === true;
  if (!vorschau && b.bestaetigt !== true) return res.status(400).json({ error: 'Bitte die Mieterhöhung bestätigen.' });
  dienst.mieterhoehung(uid(req), id, { einheit: b.einheit == null || b.einheit === '' ? null : String(b.einheit), datum: b.datum, neue_miete: b.neue_miete,
    art: b.art, grund: b.grund, vorschau: vorschau, bestaetigt: b.bestaetigt === true })
    .then(function (r) { return vorschau ? r : dienst.werte(uid(req), id).then(function (w) { r.stand = w; return r; }); })
    .then(function (r) { res.json(r); }).catch(antwort(res, next));
});
/* v4042 · Nebenkosten-Vorauszahlung in ViVi anpassen (§ 560 Abs. 4 BGB). Derselbe Dienst wie die Mieterhoehung (Art 'nk'),
   vorschau=true rechnet nur, sonst bestaetigt === true Pflicht. */
router.post('/objekt/:id/nk-anpassung', bremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  const b = req.body || {};
  const vorschau = b.vorschau === true;
  if (!vorschau && b.bestaetigt !== true) return res.status(400).json({ error: 'Bitte die Anpassung der Vorauszahlung bestätigen.' });
  dienst.mieterhoehung(uid(req), id, { einheit: b.einheit == null || b.einheit === '' ? null : String(b.einheit), datum: b.datum, neue_nk: b.neue_nk,
    art: 'nk', grund: b.grund, vorschau: vorschau, bestaetigt: b.bestaetigt === true })
    .then(function (r) { return vorschau ? r : dienst.werte(uid(req), id).then(function (w) { r.stand = w; return r; }); })
    .then(function (r) { res.json(r); }).catch(antwort(res, next));
});
/* v4020 · Paket V4: Einstellung „Steuerjahre aus ViVi“ (Einstellungen › Konto › Externe Anbieter › ViVi) */
router.get('/steuer-einstellung', function (req, res, next) {
  const st = require('../services/vivi/viviSteuer');
  dienst.steuerEinstellung(uid(req)).then(function (e) { res.set('Cache-Control', 'no-store'); res.json({ einstellung: e, kategorien: st.KATEGORIEN }); }).catch(antwort(res, next));
});
router.put('/steuer-einstellung', function (req, res, next) {
  dienst.steuerEinstellungSpeichern(uid(req), req.body || null).then(function (e) { res.json({ einstellung: e }); }).catch(antwort(res, next));
});
/* v4130 · Marcel 23.11.2026: Fragen an den Co-Piloten zum verknuepften Objekt (services/vivi/viviAuskunft.js frage).
   ViVi wird dabei nur gelesen, Mieter kommen abgekuerzt beim Modell an. */
const frageBremse = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
router.post('/objekt/:id/frage', frageBremse, function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  require('../services/vivi/viviAuskunft').frage(uid(req), id, req.body || {})
    .then(function (r) { res.set('Cache-Control', 'no-store'); res.json(r); })
    .catch(function (e) {
      if (e && e.code === 'NO_API_KEY') return res.status(503).json({ error: 'Der Co-Pilot ist gerade nicht verfügbar.', code: 'NO_API_KEY' });
      if (e && e.status) return res.status(e.status).json({ error: e.message, code: e.code || null });
      next(e);
    });
});
router.delete('/objekt/:id/verknuepfung', function (req, res, next) {
  const id = oid(req, res); if (!id) return;
  dienst.loesen(uid(req), id).then(function (r) { res.json(r); }).catch(antwort(res, next));
});

module.exports = router;
