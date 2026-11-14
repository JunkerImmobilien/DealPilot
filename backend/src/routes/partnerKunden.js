'use strict';
/**
 * routes/partnerKunden.js · v3357 — Partner-Cockpit und „Mein Partner“ (services/partnerKunden.js)
 *
 *   /api/v1/partner/...       Partnerseite (authenticate + requireFeature('reseller'), wie das Partner-Portal)
 *   /api/v1/mein-partner/...  Kundenseite (authenticate, jeder Nutzer)
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planLimits');
const reseller = require('../services/resellerService');
const pk = require('../services/partnerKunden');

function antwort(res, next) {
  return function (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message, detail: e.detail || null });
    next(e);
  };
}
const fn = (f) => (req, res, next) => Promise.resolve(f(req, res)).then((r) => { if (!res.headersSent) res.json(r); }).catch(antwort(res, next));

// ── Partnerseite ───────────────────────────────────────────────────────────
const partner = express.Router();
partner.use(authenticate);
partner.use(requireFeature('reseller'));
partner.use(async (req, res, next) => {
  try { req.reseller = await reseller.ensureReseller(req.user.id, { name: req.user.name }); next(); } catch (e) { next(e); }
});
partner.get('/cockpit', fn((req) => pk.cockpit(req.reseller)));
partner.put('/kunden/:id', fn((req) => pk.kundeEinstellen(req.reseller, req.params.id, req.body)));
partner.post('/kunden/:id/platz', fn(async (req) => {
  const c = await pk.kundeEinstellen(req.reseller, req.params.id, {});
  if (c.platz_art === 'eigen') { const e = new Error('eigener_plan'); e.status = 409; e.detail = 'Der Kunde hat einen eigenen Plan.'; throw e; }
  return { ok: true, lizenz: await reseller.assignSeat(req.reseller.id, req.params.id) };
}));
partner.post('/kunden/:id/entzug', fn((req) => pk.platzEntziehen(req.reseller, req.user.id, req.params.id, req.body)));
partner.post('/kunden/:id/trennen', fn((req) => pk.trennen(req.reseller.id, req.params.id, 'partner')));
partner.post('/einladen', fn((req) => pk.einladen(req.reseller, req.user.id, req.body)));
partner.post('/code', fn((req) => pk.codeEinloesen(req.reseller, req.user.id, req.body)));
partner.post('/anfragen/:id/zurueckziehen', fn((req) => pk.anfrageZurueckziehen(req.reseller, req.params.id)));
partner.get('/kundenstaende', fn(async (req) => ({ kundenstaende: await pk.kundenstaende(req.reseller) })));
partner.post('/kundenstaende/:id/geoeffnet', fn((req) => pk.kundenstandGeoeffnet(req.reseller, req.user.id, req.params.id)));
partner.post('/kundenstaende/:id/uebernehmen', fn((req) => pk.kundenstandUebernehmen(req.reseller, req.user.id, req.params.id)));
partner.get('/aufgaben', fn(async (req) => ({ aufgaben: await pk.aufgabenListe(req.reseller) })));
partner.post('/aufgaben', fn((req) => pk.aufgabeAnlegen(req.reseller, req.user.id, req.body)));
partner.post('/aufgaben/:id/erinnern', fn((req) => pk.aufgabeErinnern(req.reseller, req.params.id, req.body && req.body.client_id)));
partner.post('/aufgaben/:id/abschliessen', fn((req) => pk.aufgabeAbschliessen(req.reseller, req.params.id)));
partner.get('/meldungen', fn(async (req) => ({ meldungen: await pk.meldungen(req.reseller, req.query.limit) })));
partner.post('/meldungen/gelesen', fn((req) => pk.meldungenGelesen(req.reseller)));

// ── Kundenseite ────────────────────────────────────────────────────────────
const kunde = express.Router();
kunde.use(authenticate);
kunde.get('/', fn((req) => pk.meinPartner(req.user.id)));
kunde.post('/anfragen/:id', fn((req) => pk.anfrageBeantworten(req.user, req.params.id, !!(req.body && req.body.annehmen))));
kunde.post('/code', fn((req) => pk.codeErzeugen(req.user.id)));
kunde.delete('/code', fn((req) => pk.codeWiderrufen(req.user.id)));
kunde.post('/senden', fn((req) => pk.senden(req.user, req.body)));
kunde.post('/sendungen/:id/zurueckziehen', fn((req) => pk.zurueckziehen(req.user, req.params.id)));
kunde.post('/aufgaben/:id', fn((req) => pk.aufgabeKunde(req.user, req.params.id, req.body && req.body.status, req.body && req.body.grund)));
kunde.post('/trennen', fn((req) => pk.kundeTrennt(req.user)));
kunde.put('/marke', fn((req) => pk.markeWaehlen(req.user, req.body && req.body.marke)));

module.exports = { partner, kunde };
