'use strict';
/* routes/unterlagen.js — v1833
 *
 * Mount: /api/v1/unterlagen
 *
 *   GET    /arten                 die fünf Unterlagen mit Regel und Text
 *   POST   /amt                   Zuständigkeit ermitteln (ernten)
 *   POST   /entwurf               Anschreiben erzeugen
 *   GET    /objekt/:id            was für dieses Objekt schon läuft
 *   PUT    /anfrage/:id           Status setzen (gesendet / erledigt)
 *
 * ── WAS HIER BEWUSST FEHLT ──────────────────────────────────────────────
 *
 * Ein Versandweg. DealPilot erzeugt Entwürfe und kopiert sie dem Nutzer in
 * die Zwischenablage — es verschickt nichts in seinem Namen.
 *
 *   > Eine Mail, die die App von selbst schickt, steht unter dem Namen des
 *   > Nutzers und ist nicht mehr zurückzuholen. Der Knopf dafür gehört in
 *   > sein Mailprogramm, nicht hierher.
 *
 * Marcels eigenständige App kann versenden, mit SMTP-Daten, die er selbst
 * einträgt. Das ist dort richtig und wäre hier eine andere Entscheidung —
 * sie gehört ihm, nicht mir.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');
const unterlagen = require('../services/unterlagenService');

router.use(authenticate);

/* ─── GET /arten ──────────────────────────────────────────────────────── */
router.get('/arten', (req, res) => {
  res.json({
    arten: unterlagen.ARTEN.map((a) => ({
      id: a.id, name: a.name, regel: a.regel, betreff: a.betreff
    }))
  });
});

/* ─── POST /amt ───────────────────────────────────────────────────────────
 *
 * Body: { art, plz, ort, strasse?, erzwingen? }
 *
 * Die Recherche kostet eine KI-Anfrage mit Websuche. Deshalb liefert der
 * Dienst einen hinterlegten Satz, solange keiner `erzwingen` sagt — und
 * sagt dazu, woher er kommt.
 */
router.post('/amt', async (req, res, next) => {
  try {
    const b = req.body || {};
    const art = String(b.art || '').trim();
    if (!unterlagen.ARTEN_MAP[art]) {
      return res.status(400).json({
        error: 'Unbekannte Unterlagenart.',
        erlaubt: unterlagen.ARTEN.map((a) => a.id)
      });
    }
    const plz = String(b.plz || '').trim();
    const ort = String(b.ort || '').trim();
    if (!plz && !ort) {
      return res.status(400).json({
        error: 'Ohne Postleitzahl und Ort lässt sich keine Zuständigkeit bestimmen.'
      });
    }
    const r = await unterlagen.amtHolen(req.user.id, art,
      { plz: plz, ort: ort, strasse: String(b.strasse || '').trim() },
      { erzwingen: Boolean(b.erzwingen) });
    res.json(r);
  } catch (e) { next(e); }
});

/* ─── POST /entwurf ───────────────────────────────────────────────────────
 *
 * Body: { art, objekt_id?, objekt:{strasse,plz,ort,gemarkung,flur,flurstueck,
 *         eigentuemer}, absender:{name,firma,anschrift,telefon,email,
 *         vollmacht_liegt_bei} }
 *
 * Legt den Vorgang als Entwurf ab, wenn ein Objekt mitkommt — damit der
 * Nutzer später sieht, was er schon angefordert hat.
 */
router.post('/entwurf', async (req, res, next) => {
  try {
    const b = req.body || {};
    const art = String(b.art || '').trim();
    if (!unterlagen.ARTEN_MAP[art]) {
      return res.status(400).json({ error: 'Unbekannte Unterlagenart.' });
    }
    const brief = unterlagen.anschreiben(art, b.objekt || {}, b.absender || {});

    let anfrage = null;
    const objektId = String(b.objekt_id || '').trim();
    if (objektId && /^[0-9a-f-]{36}$/i.test(objektId)) {
      /* Das Objekt muss ihm gehören. Ein Vorgang an einem fremden Objekt
         wäre ein Leck, auch wenn nur ein Briefentwurf daran hängt. */
      const o = await query(
        `SELECT id FROM objects WHERE id = $1 AND user_id = $2`,
        [objektId, req.user.id]);
      if (o.rows.length) {
        const amtId = Number(b.amt_id) || null;
        const r = await query(
          `INSERT INTO unterlagen_anfragen
             (user_id, objekt_id, art, amt_id, betreff, anschreiben, status)
           VALUES ($1,$2,$3,$4,$5,$6,'entwurf') RETURNING *`,
          [req.user.id, objektId, art, amtId, brief.betreff, brief.text]);
        anfrage = r.rows[0];
      }
    }
    res.json({ betreff: brief.betreff, text: brief.text, anfrage: anfrage });
  } catch (e) { next(e); }
});

/* ─── GET /objekt/:id ─────────────────────────────────────────────────── */
router.get('/objekt/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Ungültige Objektkennung.' });
    const r = await query(
      `SELECT a.*, m.behoerde, m.email, m.kanal, m.beleg_ok, m.antrag_url
         FROM unterlagen_anfragen a
         LEFT JOIN unterlagen_aemter m ON m.id = a.amt_id
        WHERE a.user_id = $1 AND a.objekt_id = $2
        ORDER BY a.erstellt_am DESC`,
      [req.user.id, id]);
    res.json({ anfragen: r.rows });
  } catch (e) { next(e); }
});

/* ─── PUT /anfrage/:id ────────────────────────────────────────────────── */
router.put('/anfrage/:id', async (req, res, next) => {
  try {
    const status = String((req.body || {}).status || '').trim();
    if (!['entwurf', 'gesendet', 'erledigt', 'abgebrochen'].includes(status)) {
      return res.status(400).json({ error: 'Unbekannter Status.' });
    }
    const r = await query(
      `UPDATE unterlagen_anfragen
          SET status = $3,
              gesendet_am = CASE WHEN $3 = 'gesendet' THEN now() ELSE gesendet_am END
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [Number(req.params.id) || 0, req.user.id, status]);
    if (!r.rows.length) return res.status(404).json({ error: 'Vorgang nicht gefunden.' });
    res.json({ anfrage: r.rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
