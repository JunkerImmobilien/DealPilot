'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * routes/publicEinzelcheck.js · v3940 · /api/v1/public/einzelcheck/…  (OHNE Anmeldung)
 *
 *   GET  /preis       Preis aus Stripe (lookup_key dp_einzelcheck_399), Frist, Grenzen
 *   POST /auslesen    bis zu 4 PDFs (multipart „unterlagen“), kostenlos gelesen werden 2 · Bremse 3 je Tag und IP
 *   POST /kaufen      { zahlen, siegel, widerruf_verzicht } -> Stripe Checkout (mode payment) · Bremse 10 je Stunde
 *   POST /status      { token } -> bezahlt?, Frist, Anrechnungs-Code, Zahlenstand · Bremse 240 je Stunde
 *   POST /bericht     Feld „token“ + bis zu 4 PDFs -> voller Bericht (Daten, das PDF baut der Browser)
 *                     nur mit bezahltem, gueltigem Kauf · Bremse 6 je Stunde
 *
 * Alle Logik steht in services/einzelcheck.js. Hier: Schalter (nur Staging bis zur Abnahme), Bremsen
 * (express-rate-limit wie index.js), multer NUR mit memoryStorage, Groessen- und Typgrenzen.
 * Der Webhook laeuft ueber routes/stripeWebhook.js (metadata.type = 'einzelcheck').
 * ═══════════════════════════════════════════════════════════════════════════ */
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const ec = require('../services/einzelcheck');

const router = express.Router();

/* IPv6: ein Anschluss bekommt ein /64 - gekuerzt wie _ipSchluessel() in index.js */
function ipSchluessel(req) {
  const roh = String(req.ip || 'unbekannt');
  if (roh.indexOf(':') < 0) return roh;
  const v4 = roh.replace(/^::ffff:/i, '');
  if (v4.indexOf(':') < 0) return v4;
  return v4.split(':').slice(0, 4).join(':') + '::/64';
}
function bremse(fensterMs, max, meldung) {
  return rateLimit({ windowMs: fensterMs, max: max, standardHeaders: true, legacyHeaders: false, validate: { ip: false },
    keyGenerator: function (req) { return 'ec:' + ipSchluessel(req); },
    message: { error: meldung, code: 'bremse' } });
}
const TAG = 24 * 60 * 60 * 1000, STUNDE = 60 * 60 * 1000;
const bremseAuslesen = bremse(TAG, 3, 'Du hast heute schon dreimal kostenlos ausgelesen. Morgen geht es wieder, oder du kaufst den Bericht.');
const bremseKaufen = bremse(STUNDE, 10, 'Zu viele Kaufversuche. Bitte in einer Stunde noch einmal.');
const bremseStatus = bremse(STUNDE, 240, 'Zu viele Abfragen. Bitte einen Moment warten.');
const bremseBericht = bremse(STUNDE, 6, 'Zu viele Berichte in kurzer Zeit. Bitte später noch einmal.');

/* NUR im Arbeitsspeicher: memoryStorage, nie dest/diskStorage. Hoechstens 4 Dateien zu je 10 MB, nur PDF. */
const hochladen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ec.MAX_DATEI_BYTES, files: ec.VOLL_MAX_UNTERLAGEN, fields: 4, fieldSize: 16 * 1024, parts: 12 },
  fileFilter: function (req, file, cb) { cb(null, ec.ERLAUBTE_MIME.indexOf(file.mimetype) >= 0); }
}).array('unterlagen', ec.VOLL_MAX_UNTERLAGEN);
function mitDateien(req, res, next) {
  hochladen(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Eine Unterlage ist größer als 10 MB.' : (err.code === 'LIMIT_FILE_COUNT' ? 'Höchstens vier Unterlagen.' : 'Die Unterlagen konnten nicht angenommen werden.'), code: err.code || 'upload' });
    next();
  });
}
/* Nach der Antwort die Puffer freigeben - nichts bleibt am Request haengen. */
function aufraeumen(req) { try { (req.files || []).forEach(function (f) { f.buffer = null; }); req.files = null; } catch (e) {} }

/* Schalter: bis Marcel abnimmt nur Staging (EINZELCHECK_AKTIV=1 schaltet ausdruecklich frei, =0 ab) */
router.use(function (req, res, next) {
  if (!ec.aktiv()) return res.status(404).json({ error: 'Der Einzel-Check ist hier noch nicht verfügbar.', code: 'nicht_verfuegbar' });
  res.set('Cache-Control', 'no-store');
  next();
});

function kiKontext(endpunkt, fn) {
  /* multer liest den Strom ueber Ereignisse - der AsyncLocalStorage des Vorgangs (kiVerbrauch.middleware)
     ist danach nicht verlaesslich da. Deshalb ein eigener Vorgang je Aufruf: Weg und Erfassung stimmen. */
  return require('../services/kiVerbrauch').mitKontext({ endpunkt: endpunkt }, fn);
}
function fehler(res, e, fallback) {
  if (e && e.code === 'NO_API_KEY') return res.status(503).json({ error: 'Das Auslesen ist gerade nicht verfügbar.', code: 'ki_fehlt' });
  if (e && e.code === 'preis_fehlt') return res.status(503).json({ error: 'Der Einzel-Check ist gerade nicht kaufbar.', code: 'preis_fehlt' });
  if (e && e.status === 400) return res.status(400).json({ error: e.message, code: e.code || 'eingabe' });
  console.error('[einzelcheck]', fallback, e && e.message);
  return res.status(500).json({ error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.', code: fallback });
}

router.get('/preis', async function (req, res) {
  try {
    const p = await ec.preis(false);
    res.json({ amount_cents: p.amount_cents, currency: p.currency, frist_tage: ec.FRIST_TAGE,
      frei_max: ec.FREI_MAX_UNTERLAGEN, voll_max: ec.VOLL_MAX_UNTERLAGEN, max_mb: Math.round(ec.MAX_DATEI_BYTES / 1048576) });
  } catch (e) { fehler(res, e, 'preis'); }
});

router.post('/auslesen', bremseAuslesen, mitDateien, async function (req, res) {
  try {
    const dateien = req.files || [];
    if (!dateien.length) return res.status(400).json({ error: 'Bitte mindestens ein PDF hochladen.', code: 'keine_datei' });
    const deckel = await ec.freiMoeglich();
    if (!deckel.ok) return res.status(503).json({ error: 'Der kostenlose Teil ist für heute ausgelastet. Morgen geht es wieder, der Bericht ist weiter kaufbar.', code: 'tagesdeckel' });
    const r = await kiKontext('public/einzelcheck/auslesen', function () { return ec.auslesen(dateien, 'frei'); });
    res.json(Object.assign(r, { siegel: ec.siegel(r.zahlen), frei_max: ec.FREI_MAX_UNTERLAGEN }));
  } catch (e) { fehler(res, e, 'auslesen'); }
  finally { aufraeumen(req); }
});

router.post('/kaufen', bremseKaufen, express.json({ limit: '32kb' }), async function (req, res) {
  try {
    const b = req.body || {};
    /* Widerrufsverzicht wie beim Abo (§ 356 Abs. 5 BGB): Pflicht, mit Fassung protokolliert */
    const cs = require('../services/consentService');
    if (b.widerruf_verzicht !== true) return res.status(400).json({ error: 'Bitte bestätige vor dem Kauf, dass der Bericht sofort entstehen soll (Widerrufsrecht).', code: 'widerruf_verzicht_fehlt' });
    const k = await ec.kaufAnlegen({ zahlen: b.zahlen, siegelWert: b.siegel });
    try { await cs.widerrufVerzichtPruefen(req, { kauf: 'einzelcheck', kauf_id: String(k.kauf_id) }); } catch (e) { console.warn('[einzelcheck] Widerrufsverzicht nicht protokolliert:', e.message); }
    res.json({ url: k.url, token: k.token, gueltig_bis: k.gueltig_bis, amount_cents: k.amount_cents, currency: k.currency });
  } catch (e) { fehler(res, e, 'kaufen'); }
});

router.post('/status', bremseStatus, express.json({ limit: '4kb' }), async function (req, res) {
  try {
    const t = (req.body && req.body.token) || '';
    if (!ec.tokenForm(t)) return res.status(400).json({ error: 'Kein gültiger Kaufbeleg.', code: 'token' });
    const z = await ec.kaufLesen(t);
    if (!z) return res.status(404).json({ status: 'unbekannt', code: 'kauf_unbekannt' });
    res.json(ec.statusAus(z));
  } catch (e) { fehler(res, e, 'status'); }
});

router.post('/bericht', bremseBericht, mitDateien, async function (req, res) {
  try {
    /* Token als Formularfeld (ein eigener Kopf braeuchte eine CORS-Freigabe in index.js) */
    const t = String((req.body && req.body.token) || '');
    const z = await ec.kaufLesen(t);
    const darf = ec.berichtErlaubt(z);
    if (!darf.ok) return res.status(darf.code === 'nicht_bezahlt' ? 402 : 403).json({ error: 'Der Bericht braucht einen bezahlten, gültigen Kauf.', code: darf.code });
    const dateien = req.files || [];
    let r = null;
    if (dateien.length) r = await kiKontext('public/einzelcheck/bericht', function () { return ec.auslesen(dateien, 'voll'); });
    /* Ohne neue Dateien (Tab verloren): der gespeicherte Zahlenstand traegt den Bericht - ehrlich gekennzeichnet */
    const zahlen = r ? Object.assign({}, ec.zahlenSauber(z.zahlen), r.zahlen) : ec.zahlenSauber(z.zahlen);
    const markt = await ec.markt(zahlen, r ? r._adresse : null);
    await ec.berichtGezaehlt(z.id, zahlen);
    res.json({ zahlen: zahlen, unterlagen: r ? r.unterlagen : [], modell: r ? r.modell : null, aus_zahlenstand: !r,
      markt: markt, status: ec.statusAus(Object.assign({}, z, { berichte: (Number(z.berichte) || 0) + 1, zahlen: zahlen })) });
  } catch (e) { fehler(res, e, 'bericht'); }
  finally { aufraeumen(req); }
});

module.exports = router;
module.exports._bremsen = { bremseAuslesen, bremseKaufen, bremseStatus, bremseBericht };
