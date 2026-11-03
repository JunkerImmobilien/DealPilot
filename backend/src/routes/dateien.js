'use strict';
/* routes/dateien.js — v3162 · Unterlagen-Ablage (services/dateiAblage.js)
 *
 *   GET    /dateien/speicher             belegt / Grenze / Plan
 *   GET    /dateien?objekt=<id>|ohne     Liste (Ordner, Name, Größe …), ohne Inhalt
 *   POST   /dateien                      hochladen (multipart: datei, objekt, ordner, quelle)
 *   GET    /dateien/:id                  herunterladen (entschlüsselt)
 *   PATCH  /dateien/:id                  { ordner, name, objekt } verschieben/umbenennen
 *   DELETE /dateien/:id                  löschen (auch vom Laufwerk)
 *
 * Auch mit API-Schlüssel nutzbar (Rechte read/write/delete wie die übrigen Aufrufe). */
const express = require('express');
const multer = require('multer');
const ablage = require('../services/dateiAblage');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ablage.MAX_DATEI, files: 1, fields: 10 } }).single('datei');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/speicher', async (req, res, next) => {
  try { res.json(await ablage.stand(req.user.id)); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const o = req.query.objekt;
    const obj = o === 'ohne' ? null : (o && UUID.test(String(o)) ? String(o) : undefined);
    const liste = await ablage.liste(req.user.id, obj);
    res.json({ anzahl: liste.length, dateien: liste.map((d) => Object.assign({}, d, { download: '/api/v1/dateien/' + d.id })) });
  } catch (e) { next(e); }
});

router.post('/', (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Datei größer als 25 MB.' : err.message });
    try {
      if (!req.file) return res.status(400).json({ error: 'Keine Datei (Feld „datei“).' });
      const b = req.body || {};
      const objekt = b.objekt && UUID.test(String(b.objekt)) ? String(b.objekt) : null;
      let meta = {};
      try { meta = b.meta ? JSON.parse(String(b.meta)) : {}; } catch (e) { meta = {}; }
      /* der Dateiname kommt bei multer als latin1 - für Umlaute zurück nach UTF-8 */
      let name = b.name || req.file.originalname || 'Datei';
      try { if (!b.name) name = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); } catch (e) {}
      const z = await ablage.ablegen(req.user.id, { puffer: req.file.buffer, name, mime: req.file.mimetype, objectId: objekt,
        ordner: b.ordner || '', quelle: b.quelle || (req.apiKey ? 'api' : 'upload'), meta });
      res.status(z.doppelt ? 200 : 201).json(Object.assign({}, z, { download: '/api/v1/dateien/' + z.id }));
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Ungültige Kennung' });
    const d = await ablage.holen(req.user.id, req.params.id);
    if (!d) return res.status(404).json({ error: 'Datei nicht gefunden' });
    res.setHeader('Content-Type', d.zeile.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(d.zeile.name));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(d.puffer);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Ungültige Kennung' });
    const b = req.body || {};
    const opts = {};
    if (b.ordner !== undefined) opts.ordner = b.ordner;
    if (b.name !== undefined) opts.name = b.name;
    if (b.objekt !== undefined) opts.objectId = b.objekt && UUID.test(String(b.objekt)) ? String(b.objekt) : null;
    const z = await ablage.aendern(req.user.id, req.params.id, opts);
    if (!z) return res.status(404).json({ error: 'Datei nicht gefunden oder nichts geändert' });
    res.json(z);
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Ungültige Kennung' });
    const ok = await ablage.loeschen(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Datei nicht gefunden' });
    res.json({ geloescht: true });
  } catch (e) { next(e); }
});

module.exports = router;
