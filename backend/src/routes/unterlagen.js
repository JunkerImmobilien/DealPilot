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
    /* v2470 · Der Vorgang liegt im Dienst (entwurfAnlegen) — derselbe Weg
       wie im Telegram-Bot. Die Eigentumsprüfung am Objekt steht dort. */
    const r = await unterlagen.entwurfAnlegen(req.user.id, {
      art: art, objekt_id: b.objekt_id, amt_id: b.amt_id,
      objekt: b.objekt || {}, absender: b.absender || {}
    });
    res.json(r);
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
    if (!unterlagen.ANFRAGE_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Unbekannter Status.' });
    }
    /* v2470 · über den Dienst, derselbe Weg wie „verschickt" im Bot */
    const a = await unterlagen.anfrageStatus(req.user.id, req.params.id, status);
    if (!a) return res.status(404).json({ error: 'Vorgang nicht gefunden.' });
    res.json({ anfrage: a });
  } catch (e) { next(e); }
});

/* ─── GET /aemter?plz=&ort= ─────────────────────────────────────────────
 *
 * v1844 · Was die Ernte für diese Gemeinde schon hält. Das Modal fragt
 * das beim Öffnen, damit „Alle abrufen" nur holt, was fehlt — und die
 * Zahl daneben stimmt. Kein Kontingent, keine Recherche: nur lesen.
 */
router.get('/aemter', async (req, res, next) => {
  try {
    const plz = String(req.query.plz || '').trim();
    const ort = String(req.query.ort || '').trim();
    if (!plz && !ort) return res.json({ aemter: [] });
    res.json({ aemter: await unterlagen.aemterFuer(plz, ort) });
  } catch (e) { next(e); }
});

/* ─── PUT /amt/:id/kopie ────────────────────────────────────────────────
 *
 * v2152 · Wer geht in Kopie? Marcel am 12.10.2026: „ja mach die
 * ansprechpartner gleich mit." Vorlage v6 (`server.js:1236-1241`).
 *
 * WARUM DAS EINEN EIGENEN ENDPUNKT BRAUCHT: `kopie` beginnt bei false,
 * und ohne eine Stelle, die es setzen kann, bleibt es das für immer.
 * Dann wäre das Feld gebaut und tot — dasselbe Muster wie die `skala`,
 * die heute Morgen erzeugt wurde und keinen Leser hatte.
 *
 * Gesetzt wird NUR das Häkchen, nie Name, Adresse oder Beleg. Ein
 * Endpunkt, über den sich die Adresse einer Ansprechperson ändern
 * lässt, hebt den Beleg auf: `bestaetigt` würde weiter true sagen,
 * obwohl die Adresse nicht mehr die ist, die auf der Seite stand.
 *
 *   > Ein Beleg gilt für den Wert, mit dem er erhoben wurde.
 *
 * Die Ämter-Tabelle ist gemeindeweit und hat kein `user_id` — sie ist
 * eine gemeinsame Ernte (`erstellt_von` sagt nur, wer sie angelegt
 * hat). Das Häkchen ist damit ausdrücklich eine Angabe am AMT, nicht
 * am Nutzer. Für einen zweiten Mandanten wäre das zu trennen; heute
 * gibt es genau ein Partner-Abo, und eine Trennung ohne Bedarf baut
 * eine Tabelle, die niemand füllt.
 */
router.put('/amt/:id/kopie', async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    if (!id) return res.status(400).json({ error: 'Kein Amt angegeben.' });
    const b = req.body || {};
    const nr = Number(b.nr);
    /* `Number(null)` ist 0 und besteht isFinite — erst auf Abwesenheit
       prüfen, dann rechnen (CLAUDE.md). */
    if (b.nr === undefined || b.nr === null || !Number.isInteger(nr) || nr < 0 || nr > 1) {
      return res.status(400).json({ error: 'nr muss 0 oder 1 sein.' });
    }
    if (typeof b.kopie !== 'boolean') {
      return res.status(400).json({ error: 'kopie muss true oder false sein.' });
    }
    const vor = await query(
      'SELECT ansprechpartner FROM unterlagen_aemter WHERE id = $1', [id]);
    if (!vor.rows.length) return res.status(404).json({ error: 'Amt nicht gefunden.' });
    const liste = Array.isArray(vor.rows[0].ansprechpartner) ? vor.rows[0].ansprechpartner : [];
    if (!liste[nr]) return res.status(404).json({ error: 'Diese Ansprechperson gibt es nicht.' });
    /* Ohne Adresse kann niemand in Kopie gehen — ein Häkchen an einem
       Namen ohne Postfach wäre ein Versprechen, das der Versand nicht
       halten kann. */
    if (b.kopie && !liste[nr].email) {
      return res.status(400).json({ error: 'Diese Person hat keine E-Mail-Adresse.' });
    }
    liste[nr] = Object.assign({}, liste[nr], { kopie: b.kopie });
    const r = await query(
      'UPDATE unterlagen_aemter SET ansprechpartner = $2 WHERE id = $1 RETURNING *',
      [id, JSON.stringify(liste)]);
    res.json({ amt: r.rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
