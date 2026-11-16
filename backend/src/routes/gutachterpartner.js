'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   routes/gutachterpartner.js — v3540
   RESTNUTZUNGSDAUER BEIM UNABHAENGIGEN GUTACHTERPARTNER (Partner Form API)

   Marcel 16.11.2026. Zwei Wege aus dem Reiter Steuer (frontend/js/gutachterpartner.js):
     lite  = Ersteinschaetzung (remaining-useful-life-lite), Ergebnis beim Absenden sofort
     voll  = Gutachtenanfrage (remaining-useful-life), geht beim Partner in regulaere Bearbeitung

   GET    /gutachterpartner/status                  { freigeschaltet, konfiguriert, umgebung }
   GET    /gutachterpartner/formular/:art           Formulardefinition (lite|voll), 1 h im Speicher, ETag/304
   GET    /gutachterpartner/anfragen?objekt=<uuid>  Anfragen dieses Kontos (zum Objekt)
   POST   /gutachterpartner/anfragen                { art, objekt_id, data, absenden, kostenpflichtig_bestaetigt }
   GET    /gutachterpartner/anfragen/:rid           Stand beim Partner abrufen (Status, Ergebnis, Dateien)
   PATCH  /gutachterpartner/anfragen/:rid           { data }   JSON Merge Patch, If-Match aus der letzten Antwort
   POST   /gutachterpartner/anfragen/:rid/dateien   { datei_id, fieldId, documentCategory } | multipart „datei“
   DELETE /gutachterpartner/anfragen/:rid/dateien/:fileId
   POST   /gutachterpartner/anfragen/:rid/absenden  { kostenpflichtig_bestaetigt }

   Freigabe: users.role = 'admin' ODER Zusatz 'gutachterpartner' (Admin-Portal), bis Marcel
   Preis und Freigabe entscheidet. Ohne EVALION_* in der Umgebung: 503 „nicht eingerichtet“.
   Jeder Aufruf beim Partner landet in gutachter_aufrufe (Aktion, Konto, Dauer, ok).
   Fehler des Partners kommen FELDGENAU zurueck ({ felder: [{path, message}] }), ohne Anbieternamen.
   ═══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const zusatzService = require('../services/zusatzService');
const ev = require('../services/evalionClient');

const router = express.Router();
router.use(authenticate);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DATEI = 20 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DATEI, files: 1, fields: 10 } }).single('datei');

const bremse = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? 'gp:' + req.user.id : req.ip),
  message: { error: 'Zu viele Anfragen an den Gutachterpartner. Bitte kurz warten.' } });

async function freigeschaltet(user) {
  if (!user || !user.id) return false;
  if (user.role === 'admin') return true;
  try { const z = await zusatzService.holen(user.id, zusatzService.GUTACHTER); return !!(z && z.aktiv); } catch (e) { return false; }
}

async function protokoll(userId, aktion, r, requestId) {
  try {
    await query('INSERT INTO gutachter_aufrufe (user_id, aktion, ok, http_status, ms, request_id, code) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId || null, aktion, !!(r && r.ok), (r && r.status) || null, (r && r.ms) || null, requestId ? String(requestId).slice(0, 80) : null,
       r && !r.ok && r.body && r.body.code ? String(r.body.code).slice(0, 80) : null]);
  } catch (e) { /* ein Protokollfehler bricht den Aufruf nicht */ }
  try { console.log('[gutachterpartner] ' + aktion + ' ' + ((r && r.status) || '-') + ' ' + ((r && r.ms) || 0) + 'ms'); } catch (e) {}
}

function fehler(res, r, requestId) {
  const f = ev.fehlerText(r);
  if (requestId) f.request_id = requestId;   /* Entwurf besteht schon: der naechste Versuch aendert ihn, statt neu anzulegen */
  const st = r.status === 0 ? 502 : (r.status === 401 || r.status >= 500 ? 502 : r.status);
  return res.status(st).json(f);
}

/* Partner-Anfrage in DealPilot-Form (nur was die Oberflaeche braucht) */
function sicht(d, zeile) {
  d = d || {};
  return {
    request_id: d.requestId || (zeile && zeile.request_id) || null,
    request_number: d.requestNumber || (zeile && zeile.request_number) || null,
    formular: (d.form && d.form.type) || (zeile && zeile.formular) || null,
    form_version: (d.form && d.form.version) || null,
    status: d.status || (zeile && zeile.status) || null,
    allowed_actions: d.allowedActions || [],
    data: d.data || null,
    attachments: (d.attachments || []).map((a) => ({ fileId: a.fileId, filename: a.filename, fieldId: a.fieldId, uploadStatus: a.uploadStatus, sizeBytes: a.sizeBytes })),
    result: d.result || (zeile && zeile.ergebnis) || null,
    objekt_id: zeile ? zeile.objekt_id : null,
    umgebung: zeile ? zeile.umgebung : null,
    created_at: d.createdAt || (zeile && zeile.created_at) || null,
    updated_at: d.updatedAt || (zeile && zeile.updated_at) || null
  };
}

async function zeileHolen(userId, rid) {
  const r = await query('SELECT * FROM gutachter_anfragen WHERE user_id=$1 AND request_id=$2', [userId, rid]);
  return r.rows[0] || null;
}
async function zeileFortschreiben(rid, r) {
  const d = (r.body && r.body.data) || {};
  await query('UPDATE gutachter_anfragen SET status=COALESCE($2,status), etag=COALESCE($3,etag), request_number=COALESCE($4,request_number), '
    + 'ergebnis=COALESCE($5::jsonb,ergebnis), updated_at=NOW() WHERE request_id=$1',
    [rid, d.status || null, r.etag || null, d.requestNumber || null, d.result ? JSON.stringify(d.result) : null]);
}

/* Bei veraltetem ETag (409) einmal frisch lesen und wiederholen — der Nutzer hat nichts falsch gemacht. */
async function mitFrischemEtag(userId, zeile, aktion, fn) {
  let r = await fn(zeile.etag);
  await protokoll(userId, aktion, r, zeile.request_id);
  if (r.status === 409 && r.body && r.body.code === 'concurrency_conflict') {
    const l = await ev.api.lesen(zeile.request_id);
    await protokoll(userId, 'lesen', l, zeile.request_id);
    if (l.ok) { await zeileFortschreiben(zeile.request_id, l); r = await fn(l.etag); await protokoll(userId, aktion, r, zeile.request_id); }
  }
  if (r.ok) await zeileFortschreiben(zeile.request_id, r);
  return r;
}

/* Status: wer die Knoepfe sieht. Ohne Freigabe keine Auskunft ueber die Konfiguration. */
router.get('/status', async (req, res) => {
  const frei = await freigeschaltet(req.user);
  const k = frei ? ev.konfig() : null;
  res.json({ freigeschaltet: frei, konfiguriert: !!k, umgebung: k ? k.umgebung : null });
});

/* ab hier: freigeschaltet + konfiguriert */
router.use(async (req, res, next) => {
  if (!(await freigeschaltet(req.user))) {
    return res.status(403).json({ error: 'Die Anfrage beim Gutachterpartner ist für dieses Konto nicht freigeschaltet.', code: 'nicht_freigeschaltet' });
  }
  if (!ev.konfig()) {
    return res.status(503).json({ error: 'Die Anbindung an den Gutachterpartner ist noch nicht eingerichtet.', code: 'nicht_konfiguriert' });
  }
  next();
});
router.use(bremse);

const _cache = {};   /* formType -> { zeit, etag, body } */
router.get('/formular/:art', async (req, res) => {
  const formType = ev.FORMULARE[req.params.art];
  if (!formType) return res.status(400).json({ error: 'Formular lite oder voll' });
  const c = _cache[formType];
  if (c && Date.now() - c.zeit < 3600 * 1000) return res.json(c.body);
  const r = await ev.api.formular(formType, c && c.etag);
  await protokoll(req.user.id, 'formular', r);
  if (r.status === 304 && c) { c.zeit = Date.now(); return res.json(c.body); }
  if (!r.ok) return fehler(res, r);
  _cache[formType] = { zeit: Date.now(), etag: r.etag, body: r.body };
  res.json(r.body);
});

router.get('/anfragen', async (req, res, next) => {
  try {
    const o = req.query.objekt && UUID.test(String(req.query.objekt)) ? String(req.query.objekt) : null;
    const r = await query('SELECT request_id, request_number, formular, umgebung, status, ergebnis, objekt_id, created_at, updated_at '
      + 'FROM gutachter_anfragen WHERE user_id=$1' + (o ? ' AND objekt_id=$2' : '') + ' ORDER BY created_at DESC LIMIT 50',
      o ? [req.user.id, o] : [req.user.id]);
    res.json({ anfragen: r.rows.map((z) => ({ request_id: z.request_id, request_number: z.request_number,
      art: z.formular === ev.FORMULARE.lite ? 'lite' : 'voll', umgebung: z.umgebung, status: z.status, result: z.ergebnis,
      objekt_id: z.objekt_id, created_at: z.created_at, updated_at: z.updated_at })) });
  } catch (e) { next(e); }
});

async function absenden(req, res, zeile) {
  const voll = zeile.formular === ev.FORMULARE.voll;
  const b = req.body || {};
  /* Die vollstaendige Anfrage wird beim Partner ein kostenpflichtiger Auftrag - nur mit Bestaetigung. */
  if (voll && b.kostenpflichtig_bestaetigt !== true) {
    return res.status(400).json({ error: 'Bitte bestätigen, dass mit dem Absenden ein kostenpflichtiger Auftrag entsteht.', code: 'bestaetigung_fehlt', request_id: zeile.request_id });
  }
  if (voll) await query('UPDATE gutachter_anfragen SET kostenpflichtig_bestaetigt_at=NOW() WHERE request_id=$1', [zeile.request_id]);
  const r = await mitFrischemEtag(req.user.id, zeile, 'absenden', (etag) => ev.api.absenden(zeile.request_id, etag, zeile.idem_submit));
  if (!r.ok) return fehler(res, r, zeile.request_id);
  const neu = await zeileHolen(req.user.id, zeile.request_id);
  return res.json({ anfrage: sicht(r.body && r.body.data, neu) });
}

/* v3570 · Ersteinschaetzung ueber die Direct-RUL-IA-API: Ergebnis sofort (siehe services/evalionClient.js).
   Die Datenschutz-Zustimmung des Lite-Formulars traegt die Direct-API nicht - sie wird hier verlangt. */
async function liteDirekt(req, res, objekt, data) {
  const rq = data.requester || {};
  if (rq.acceptPrivacy !== true) {
    return res.status(400).json({ error: 'Bitte den Datenschutz akzeptieren.', code: 'validation_failed',
      felder: [{ path: 'requester.acceptPrivacy', message: 'Bitte den Datenschutz akzeptieren.' }] });
  }
  const idem = ev.idemSchluessel('dp-lite');
  const r = await ev.api.direkt(ev.liteZuDirekt(data, idem));
  const d = (r.body && r.body.data) || {};
  await protokoll(req.user.id, 'direkt', r, d.evalionRequestId);
  if (!r.ok) {
    if (r.body && Array.isArray(r.body.errors)) r.body.errors = r.body.errors.map((e) => Object.assign({}, e, { path: ev.pfadVonDirekt(e.path) }));
    return fehler(res, r);
  }
  const k = ev.konfig();
  const ergebnis = Object.assign({}, d.result || {}, { weg: 'direkt', ms: r.ms });
  await query('INSERT INTO gutachter_anfragen (user_id, objekt_id, formular, umgebung, request_id, request_number, status, etag, idem_submit, ergebnis) '
    + 'VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9::jsonb) ON CONFLICT (request_id) DO NOTHING',
    [req.user.id, objekt, ev.FORMULARE.lite, k.umgebung, d.evalionRequestId, d.evalionRequestNumber || null,
     d.result ? 'initialAssessment' : 'received', idem, JSON.stringify(ergebnis)]);
  const zeile = await zeileHolen(req.user.id, d.evalionRequestId);
  return res.status(201).json({ anfrage: Object.assign(sicht({ requestId: d.evalionRequestId, requestNumber: d.evalionRequestNumber,
    form: { type: ev.FORMULARE.lite }, status: zeile && zeile.status, result: ergebnis }, zeile), { dauer_ms: r.ms }) });
}

router.post('/anfragen', async (req, res, next) => {
  try {
    const b = req.body || {};
    const formType = ev.FORMULARE[b.art];
    if (!formType) return res.status(400).json({ error: 'art lite oder voll' });
    let objekt = b.objekt_id && UUID.test(String(b.objekt_id)) ? String(b.objekt_id) : null;
    if (objekt) {
      const o = await query('SELECT 1 FROM objects WHERE id=$1 AND user_id=$2', [objekt, req.user.id]);
      if (!o.rowCount) objekt = null;
    }
    const data = b.data && typeof b.data === 'object' && !Array.isArray(b.data) ? b.data : {};
    if (b.art === 'lite' && b.absenden === true && ev.liteWegDirekt()) return liteDirekt(req, res, objekt, data);
    const r = await ev.api.anlegen(formType, data, ev.idemSchluessel('dp-anlegen'));
    await protokoll(req.user.id, 'anlegen', r, r.body && r.body.data && r.body.data.requestId);
    if (!r.ok) return fehler(res, r);
    const d = r.body.data;
    const k = ev.konfig();
    await query('INSERT INTO gutachter_anfragen (user_id, objekt_id, formular, umgebung, request_id, request_number, status, etag, idem_submit) '
      + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (request_id) DO NOTHING',
      [req.user.id, objekt, formType, k.umgebung, d.requestId, d.requestNumber || null, d.status || 'draft', r.etag || null, ev.idemSchluessel('dp-absenden')]);
    const zeile = await zeileHolen(req.user.id, d.requestId);
    if (b.absenden === true) return absenden(req, res, zeile);
    res.status(201).json({ anfrage: sicht(d, zeile) });
  } catch (e) { next(e); }
});

router.get('/anfragen/:rid', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    const r = await ev.api.lesen(zeile.request_id);
    await protokoll(req.user.id, 'lesen', r, zeile.request_id);
    if (!r.ok) return fehler(res, r);
    await zeileFortschreiben(zeile.request_id, r);
    res.json({ anfrage: sicht(r.body.data, await zeileHolen(req.user.id, zeile.request_id)) });
  } catch (e) { next(e); }
});

router.patch('/anfragen/:rid', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    const data = (req.body && req.body.data && typeof req.body.data === 'object') ? req.body.data : {};
    const r = await mitFrischemEtag(req.user.id, zeile, 'aendern', (etag) => ev.api.aendern(zeile.request_id, data, etag));
    if (!r.ok) return fehler(res, r, zeile.request_id);
    res.json({ anfrage: sicht(r.body.data, await zeileHolen(req.user.id, zeile.request_id)) });
  } catch (e) { next(e); }
});

router.post('/anfragen/:rid/absenden', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    return absenden(req, res, zeile);
  } catch (e) { next(e); }
});

router.post('/anfragen/:rid/dateien', (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Datei größer als 20 MB.' : err.message });
    try {
      const zeile = await zeileHolen(req.user.id, req.params.rid);
      if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
      const b = req.body || {};
      const fieldId = String(b.fieldId || '').trim();
      if (!fieldId) return res.status(400).json({ error: 'fieldId fehlt (Feld aus der Formulardefinition).' });
      let datei = null;
      if (req.file) {
        let name = req.file.originalname || 'Datei';
        try { name = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); } catch (e) {}
        datei = { puffer: req.file.buffer, name, mime: req.file.mimetype };
      } else if (b.datei_id && UUID.test(String(b.datei_id))) {
        /* aus den Objektunterlagen (services/dateiAblage.js), nur eigene Dateien */
        const ablage = require('../services/dateiAblage');
        const d = await ablage.holen(req.user.id, String(b.datei_id));
        if (!d) return res.status(404).json({ error: 'Unterlage nicht gefunden' });
        if (d.puffer.length > MAX_DATEI) return res.status(413).json({ error: 'Datei größer als 20 MB.' });
        datei = { puffer: d.puffer, name: d.zeile.name, mime: d.zeile.mime };
      }
      if (!datei) return res.status(400).json({ error: 'Keine Datei (Feld „datei“ oder datei_id).' });
      const felder = { fieldId, documentCategory: b.documentCategory || '' };
      const idem = ev.idemSchluessel('dp-datei');
      const r = await mitFrischemEtag(req.user.id, zeile, 'datei', (etag) => ev.api.dateiHochladen(zeile.request_id, etag, felder, datei, idem));
      if (!r.ok) return fehler(res, r);
      res.status(201).json({ datei: r.body && r.body.data });
    } catch (e) { next(e); }
  });
});

router.delete('/anfragen/:rid/dateien/:fileId', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    const r = await mitFrischemEtag(req.user.id, zeile, 'datei_loeschen', (etag) => ev.api.dateiLoeschen(zeile.request_id, req.params.fileId, etag));
    if (!r.ok) return fehler(res, r);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports._intern = { freigeschaltet, sicht };
