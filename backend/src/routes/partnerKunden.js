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
const anm = require('../services/partnerAnmerkungen');
const T = require('../services/partnerTeam');   /* v3830 · Team, Rechte, Loeschfristen */   /* v3450 · Anmerkungen am Kundenstand, Rueckmeldung */

function antwort(res, next) {
  return function (e) {
    if (e && e.status) return res.status(e.status).json(Object.assign({}, e.extra || {}, { error: e.message, detail: e.detail || null }));   /* v3640 · extra: z. B. fehlen[] beim gesperrten Senden */
    next(e);
  };
}
const fn = (f) => (req, res, next) => Promise.resolve(f(req, res)).then((r) => { if (!res.headersSent) res.json(r); }).catch(antwort(res, next));

// ── Partnerseite ───────────────────────────────────────────────────────────
const partner = express.Router();
partner.use(authenticate);
/* v3830 A · Zugang: eigener Partner-Plan ODER Berater im Team eines Partners mit Partner-Plan (statt nur requireFeature('reseller')) */
partner.use(T.zugang());
partner.use(async (req, res, next) => {
  try { req.reseller = await reseller.ensureReseller(req.user.id, { name: req.user.name }); req.partnerRolle = await T.rolle(req.reseller, req.user.id); next(); } catch (e) { next(e); }
});
/* v3830 A · Rechte am Kunden: Inhaber jeden, Berater nur die eigenen (berater_id). Laedt den Kunden einmal. */
const { query } = require('../db/pool');
async function kundeRecht(req, id) { const c = await pk.kundeLaden(req.reseller, id); T.pruefeKunde(req.partnerRolle, req.user.id, c); return c; }
async function shareRecht(req, shareId) {
  const r = (await query('SELECT client_id FROM object_shares WHERE id = $1 AND reseller_id = $2', [shareId, req.reseller.id]).catch(() => ({ rows: [] }))).rows[0];
  if (r && r.client_id) await kundeRecht(req, r.client_id);
}
async function anmerkungRecht(req, id) {
  const r = (await query('SELECT client_id FROM partner_anmerkungen WHERE id = $1 AND reseller_id = $2', [id, req.reseller.id]).catch(() => ({ rows: [] }))).rows[0];
  if (r && r.client_id) await kundeRecht(req, r.client_id);
}
/* v3620 · avv: Stand des Auftragsverarbeitungsvertrags des angemeldeten Partners - das Cockpit fragt einmal, wenn nicht aktuell */
partner.get('/cockpit', fn(async (req) => Object.assign(await pk.cockpit(req.reseller, req.user.id),
  /* v3830a · Auftraggeber der AVV ist das Partnerkonto, abgeschlossen vom Inhaber: ein Berater erbt dessen Stand.
     Gemessen 19.11.2026 headless: der Berater blieb ohne eigene Zustimmung vor dem AVV-Fenster haengen. */
  { avv: await require('../services/avvService').stand(req.partnerRolle === 'berater' && req.reseller.owner_user_id ? req.reseller.owner_user_id : req.user.id).catch(() => null) })));
partner.put('/kunden/:id', fn(async (req) => {
  const c = await kundeRecht(req, req.params.id);
  /* v3830 A · Kunden an einen anderen Berater geben (berater_id) */
  if (req.body && req.body.berater_id !== undefined) {
    await T.kundeZuweisen(req.reseller, req.user.id, req.partnerRolle, c, req.body.berater_id);
    const b = Object.assign({}, req.body); delete b.berater_id;
    return Object.keys(b).length ? pk.kundeEinstellen(req.reseller, c.id, b) : pk.kundeLaden(req.reseller, c.id);
  }
  return pk.kundeEinstellen(req.reseller, req.params.id, req.body);
}));
partner.post('/kunden/:id/platz', fn(async (req) => {
  await kundeRecht(req, req.params.id);
  const c = await pk.kundeEinstellen(req.reseller, req.params.id, {});
  if (c.platz_art === 'eigen') { const e = new Error('eigener_plan'); e.status = 409; e.detail = 'Der Kunde hat einen eigenen Plan.'; throw e; }
  return { ok: true, lizenz: await reseller.assignSeat(req.reseller.id, req.params.id) };
}));
partner.post('/kunden/:id/entzug', fn(async (req) => { await kundeRecht(req, req.params.id); return pk.platzEntziehen(req.reseller, req.user.id, req.params.id, req.body); }));
/* v3830 E · Kunde ganz entfernen (Name eintippen wie beim Entzug) */
partner.post('/kunden/:id/entfernen', fn(async (req) => { await kundeRecht(req, req.params.id); return pk.kundeEntfernen(req.reseller, req.user.id, req.params.id, { bestaetigung: req.body && req.body.bestaetigung, weitergefuehrt_behalten: !!(req.body && req.body.weitergefuehrt_behalten) }); }));
partner.get('/kunden/:id/freigabe', fn((req) => pk.freigabeLesen(req.reseller, req.params.id)));   /* v3690 · nur lesend */
partner.get('/kunden/:id/steuerprofil', fn((req) => pk.steuerprofilLesen(req.reseller, req.params.id)));   /* v3700 · P2 Steuerprofil des Kunden, nur lesend */
partner.get('/kunden/:id/steuerprofil/:nr', fn((req) => pk.steuerprofilLesen(req.reseller, req.params.id, req.params.nr)));
partner.post('/kunden/:id/trennen', fn(async (req) => { await kundeRecht(req, req.params.id); return pk.trennen(req.reseller.id, req.params.id, 'partner'); }));
partner.post('/einladen', fn((req) => pk.einladen(req.reseller, req.user.id, req.body, require('../services/resellerInviteMail').basisAus(req))));
partner.post('/code', fn((req) => pk.codeEinloesen(req.reseller, req.user.id, req.body)));
partner.post('/anfragen/:id/zurueckziehen', fn((req) => pk.anfrageZurueckziehen(req.reseller, req.params.id)));
partner.get('/kundenstaende', fn(async (req) => ({ kundenstaende: await pk.kundenstaende(req.reseller, req.user.id) })));
partner.post('/kundenstaende/:id/geoeffnet', fn((req) => pk.kundenstandGeoeffnet(req.reseller, req.user.id, req.params.id)));
partner.post('/kundenstaende/:id/uebernehmen', fn((req) => pk.kundenstandUebernehmen(req.reseller, req.user.id, req.params.id, req.body)));   /* v3640 · body.modus 'aktualisieren' (Vorgabe) | 'neu' · v3700 body.ziel 'kunde' | 'eigen', body.halter */
/* v3450 · Anmerkungen am Kundenstand und „Zurueck an Kunden“ */
partner.get('/kundenstaende/:id/anmerkungen', fn(async (req) => ({ anmerkungen: await anm.liste(req.reseller, req.params.id) })));
partner.post('/kundenstaende/:id/anmerkungen', fn(async (req) => { await shareRecht(req, req.params.id); return anm.anlegen(req.reseller, req.user.id, req.params.id, req.body); }));
partner.post('/kundenstaende/:id/zurueck', fn(async (req) => { await shareRecht(req, req.params.id); return anm.zurueckgeben(req.reseller, req.user.id, req.params.id, req.body, { basis: 'https://' + req.headers.host }); }));   /* v3460 · basis nur Rueckfall, die .env-Adresse geht vor */
partner.put('/anmerkungen/:id', fn(async (req) => { await anmerkungRecht(req, req.params.id); return anm.aendern(req.reseller, req.params.id, req.body); }));
partner.delete('/anmerkungen/:id', fn(async (req) => { await anmerkungRecht(req, req.params.id); return anm.loeschen(req.reseller, req.params.id); }));
partner.get('/aufgaben', fn(async (req) => ({ aufgaben: await pk.aufgabenListe(req.reseller) })));
partner.post('/aufgaben', fn((req) => pk.aufgabeAnlegen(req.reseller, req.user.id, req.body)));
partner.post('/aufgaben/:id/erinnern', fn((req) => pk.aufgabeErinnern(req.reseller, req.params.id, req.body && req.body.client_id)));
partner.post('/aufgaben/:id/abschliessen', fn((req) => pk.aufgabeAbschliessen(req.reseller, req.params.id)));
partner.delete('/aufgaben/:id', fn((req) => pk.aufgabeLoeschen(req.reseller, req.params.id)));   /* v3830 C · nur abgeschlossene */
/* v3830 B · Meldungen: ?sort=neu|alt&filter=alle|ungelesen|gelesen&kunde=<id>&seite=1&je=25 (ohne diese wie bisher: neueste, limit) */
partner.get('/meldungen', fn(async (req) => {
  const q = req.query || {};
  if (!q.seite && !q.sort && !q.filter && !q.kunde) return { meldungen: await pk.meldungen(req.reseller, q.limit) };
  return pk.meldungen(req.reseller, { sort: q.sort, filter: q.filter, kunde: q.kunde, seite: q.seite || 1, je: q.je });
}));
partner.post('/meldungen/gelesen', fn((req) => pk.meldungenGelesen(req.reseller)));
partner.post('/meldungen/gelesene-loeschen', fn((req) => pk.meldungenGeleseneLoeschen(req.reseller)));
partner.delete('/meldungen/:id', fn((req) => pk.meldungLoeschen(req.reseller, req.params.id)));
/* v3830 C · Loeschfristen (Verwaltung) */
partner.get('/loeschfristen', fn(async () => ({ fristen: T.fristenListe(), werte: T.LOESCHFRISTEN })));
/* v3830 A · Team: lesen alle, einladen/zurueckziehen/entfernen nur der Inhaber, selbst gehen jeder Berater */
partner.get('/team', fn(async (req) => Object.assign(await T.team(req.reseller), { ich: { user_id: req.user.id, rolle: req.partnerRolle } })));
partner.post('/team/einladen', fn((req) => T.einladen(req.reseller, req.user.id, req.partnerRolle, req.body, require('../services/resellerInviteMail').basisAus(req))));
partner.post('/team/einladungen/:id/zurueckziehen', fn((req) => T.einladungZurueckziehen(req.reseller, req.partnerRolle, req.params.id)));
partner.delete('/team/:userId', fn((req) => T.mitgliedEntfernen(req.reseller, req.user.id, req.partnerRolle, req.params.userId)));
/* v3947 · Teamplaetze mit Preis (Marcel 22.11.2026): Angebot mit Stufen aus Stripe, Summe heute und mit einem Platz mehr
   (lesen alle), bezahlte Menge im Partner-Plan-Abo setzen (nur Inhaber). Abrechnung wie die Kundenplaetze. */
partner.get('/team/preis', fn((req) => require('../services/partnerPlanKauf').teamAngebot(req.reseller)));
partner.post('/team/plaetze', fn(async (req) => {
  T.nurInhaber(req.partnerRolle);
  const n = parseInt(req.body && req.body.anzahl, 10);
  if (!Number.isFinite(n) || n < 0) { const e = new Error('anzahl_ungueltig'); e.status = 400; e.detail = 'Bitte eine Zahl ab 0 angeben.'; throw e; }
  return require('../services/partnerPlanKauf').teamplaetzeAendern(req.reseller, n);
}));
/* v3830 F · eigene Objekte einem Kunden zuordnen (body.client_id, null loest) */
partner.get('/zuordnungen', fn(async (req) => ({ zuordnungen: await pk.zuordnungen(req.reseller, req.user.id) })));
partner.put('/objekte/:id/kunde', fn((req) => pk.objektZuordnen(req.reseller, req.user.id, req.partnerRolle, req.params.id, req.body && req.body.client_id)));

// ── Kundenseite ────────────────────────────────────────────────────────────
const kunde = express.Router();
kunde.use(authenticate);
kunde.get('/', fn((req) => pk.meinPartner(req.user.id)));
kunde.post('/anfragen/:id', fn((req) => pk.anfrageBeantworten(req.user, req.params.id, !!(req.body && req.body.annehmen), req.body && req.body.freigabe)));   /* v3690 · body.freigabe { art, bereiche } */
/* v3690 · P1 Freigabe an den Partner: lesen, neue Fassung, widerrufen (body.staende_zurueckziehen) */
kunde.get('/freigabe', fn(async (req) => { const v = await pk.aktiveVerbindung(req.user.id); if (!v) { const e = new Error('nicht_verbunden'); e.status = 409; throw e; } return require('../services/partnerFreigaben').uebersicht(v.id); }));
kunde.put('/freigabe', fn((req) => pk.freigabeSetzen(req.user, req.body)));
kunde.post('/freigabe/widerrufen', fn((req) => pk.freigabeWiderrufen(req.user, req.body)));
kunde.post('/code', fn((req) => pk.codeErzeugen(req.user.id)));
kunde.delete('/code', fn((req) => pk.codeWiderrufen(req.user.id)));
kunde.post('/senden', fn((req) => pk.senden(req.user, req.body)));
kunde.post('/sendungen/:id/zurueckziehen', fn((req) => pk.zurueckziehen(req.user, req.params.id)));
kunde.post('/aufgaben/:id', fn((req) => pk.aufgabeKunde(req.user, req.params.id, req.body && req.body.status, req.body && req.body.grund)));
kunde.get('/aufgaben/:id/anmerkungen', fn((req) => anm.kundeListe(req.user, req.params.id)));   /* v3450 */
kunde.post('/anmerkungen/:id', fn((req) => anm.kundeSetzen(req.user, req.params.id, req.body)));   /* v3450 */
kunde.post('/trennen', fn((req) => pk.kundeTrennt(req.user)));
kunde.put('/marke', fn((req) => pk.markeWaehlen(req.user, req.body && req.body.marke)));
/* v3830 A · Einladung ins Team eines Partners (eingeladener Berater) */
kunde.post('/team/token', fn(async (req) => ({ einladung: await T.einladungPerToken(req.user, req.body && req.body.token) })));
kunde.post('/team/:id', fn((req) => T.beantworten(req.user, req.params.id, !!(req.body && req.body.annehmen))));
kunde.post('/team-verlassen', fn(async (req) => {
  const rs = await reseller.getResellerForUser(req.user.id);
  if (!rs) return { ok: true };
  return T.mitgliedEntfernen(rs, req.user.id, await T.rolle(rs, req.user.id), req.user.id);
}));

module.exports = { partner, kunde };
