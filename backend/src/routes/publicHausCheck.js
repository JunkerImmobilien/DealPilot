'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * routes/publicHausCheck.js · v5130 KK6 · /api/v1/public/hauscheck/…  (OHNE Anmeldung)
 *
 *   GET  /preis     Preis aus Stripe (lookup_key dp_hauscheck_999), Frist
 *   POST /kaufen    { grund, widerruf_verzicht, rueckweg } -> Stripe Checkout (mode payment) · 10 je Stunde
 *   POST /status    { token } -> bezahlt?, Frist · 240 je Stunde
 *   POST /bericht   { token, adresse, darlehen } -> Wert (Stufe 3), Beleihungswert (§ 4 Abs. 2), Umfeld · 6 je Stunde
 *   POST /pdf       { token, html, titel } -> PDF vom PDF-Dienst · 12 je Stunde
 *
 * Schalter wie der Einzel-Check (ec.aktiv(): nur Staging, bis Marcel abnimmt). Logik in services/hausCheck.js.
 * Das Netto-Einkommen kommt hier nie an, die Haushaltsrechnung macht der Browser.
 * ═══════════════════════════════════════════════════════════════════════════ */
const express = require('express');
const rateLimit = require('express-rate-limit');
const ec = require('../services/einzelcheck');
const hc = require('../services/hausCheck');

const router = express.Router();
function ipSchluessel(req) {
  const roh = String(req.ip || 'unbekannt');
  if (roh.indexOf(':') < 0) return roh;
  const v4 = roh.replace(/^::ffff:/i, '');
  if (v4.indexOf(':') < 0) return v4;
  return v4.split(':').slice(0, 4).join(':') + '::/64';
}
function bremse(fensterMs, max, meldung) {
  return rateLimit({ windowMs: fensterMs, max: max, standardHeaders: true, legacyHeaders: false, validate: { ip: false },
    keyGenerator: function (req) { return 'hc:' + ipSchluessel(req); }, message: { error: meldung, code: 'bremse' } });
}
const STUNDE = 60 * 60 * 1000;
const bremseKaufen = bremse(STUNDE, 10, 'Zu viele Kaufversuche. Bitte in einer Stunde noch einmal.');
const bremseStatus = bremse(STUNDE, 240, 'Zu viele Abfragen. Bitte einen Moment warten.');
const bremseBericht = bremse(STUNDE, 6, 'Zu viele Berichte in kurzer Zeit. Bitte später noch einmal.');
const bremsePdf = bremse(STUNDE, 12, 'Zu viele PDFs in kurzer Zeit. Bitte später noch einmal.');

router.use(function (req, res, next) {
  if (!ec.aktiv()) return res.status(404).json({ error: 'Der Haus-Check ist hier noch nicht verfügbar.', code: 'nicht_verfuegbar' });
  res.set('Cache-Control', 'no-store');
  next();
});
function fehler(res, e, fallback) {
  if (e && e.code === 'preis_fehlt') return res.status(503).json({ error: 'Der Haus-Check ist gerade nicht kaufbar.', code: 'preis_fehlt' });
  if (e && e.status && e.status < 500) return res.status(e.status).json({ error: e.message, code: e.code || 'eingabe', fehlt: e.fehlt });
  console.error('[hauscheck]', fallback, e && e.message);
  return res.status(500).json({ error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.', code: fallback });
}

router.get('/preis', async function (req, res) {
  try { const p = await hc.preis(false); res.json({ amount_cents: p.amount_cents, currency: p.currency, frist_tage: ec.FRIST_TAGE }); }
  catch (e) { fehler(res, e, 'preis'); }
});

router.post('/kaufen', bremseKaufen, express.json({ limit: '16kb' }), async function (req, res) {
  try {
    const b = req.body || {};
    if (b.widerruf_verzicht !== true) return res.status(400).json({ error: 'Bitte bestätige vor dem Kauf, dass der Bericht sofort entstehen soll (Widerrufsrecht).', code: 'widerruf_verzicht_fehlt' });
    const k = await hc.kaufAnlegen({ grund: b.grund, rueckweg: b.rueckweg });
    try { await require('../services/consentService').widerrufVerzichtPruefen(req, { kauf: 'hauscheck', kauf_id: String(k.kauf_id) }); }
    catch (e) { console.warn('[hauscheck] Widerrufsverzicht nicht protokolliert:', e.message); }
    res.json({ url: k.url, token: k.token, gueltig_bis: k.gueltig_bis, amount_cents: k.amount_cents, currency: k.currency });
  } catch (e) { fehler(res, e, 'kaufen'); }
});

router.post('/status', bremseStatus, express.json({ limit: '4kb' }), async function (req, res) {
  try {
    const t = (req.body && req.body.token) || '';
    if (!ec.tokenForm(t)) return res.status(400).json({ error: 'Kein gültiger Kaufbeleg.', code: 'token' });
    const z = await hc.kaufLesen(t);
    if (!z) return res.status(404).json({ status: 'unbekannt', code: 'kauf_unbekannt' });
    res.json(hc.statusAus(z));
  } catch (e) { fehler(res, e, 'status'); }
});

router.post('/bericht', bremseBericht, express.json({ limit: '8kb' }), async function (req, res) {
  try {
    const b = req.body || {};
    const z = await hc.kaufLesen(String(b.token || ''));
    res.json(await hc.bericht(z, b.adresse, b.darlehen, b.nhk));
  } catch (e) { fehler(res, e, 'bericht'); }
});

router.post('/pdf', bremsePdf, express.json({ limit: '13mb' }), async function (req, res) {
  try {
    const b = req.body || {};
    const z = await hc.kaufLesen(String(b.token || ''));
    const erg = await ec.berichtPdf(z, b.html, b.titel || 'Haus-Check');
    const name = ('DealPilot Haus-Check ' + erg.titel).replace(/[^\wäöüÄÖÜß .,-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name.replace(/[^\x20-\x7e]/g, '_') + '"; filename*=UTF-8\'\'' + encodeURIComponent(name));
    res.send(erg.pdf);
  } catch (e) { fehler(res, e, 'pdf'); }
});

module.exports = router;
