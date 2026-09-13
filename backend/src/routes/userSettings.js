'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v1375 (A5) · Einstellungen, die den Gerätewechsel überleben

   Erster Nutzer: der Datenraum. Seine Ordner-Links lagen ausschließlich
   im `localStorage` — wer den Browser wechselt, hat sie verloren, und aus
   genau diesem Bereich gehen Bank-Anfragen raus.

   ────────────────────────────────────────────────────────────────────
   DIE REGEL FÜR DEN CLIENT: SERVER GEWINNT, ABER NIE GEGEN LEERE

   Der Client schreibt nach jeder Änderung hierher und liest beim Start.
   Kommt vom Server nichts — weil das Konto neu ist oder die Verbindung
   fehlt —, bleibt der lokale Stand stehen. Ein leerer Server darf
   niemals einen gefüllten Browser überschreiben; das wäre Datenverlust
   durch Synchronisierung, und den merkt man erst, wenn es zu spät ist.
   ══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');

/* Erlaubte Schlüssel. Eine feste Liste, damit die Tabelle nicht mit der
   Zeit zum Abstellraum wird. */
const ERLAUBT = ['datenraum'];

router.get('/:schluessel', authenticate, async (req, res, next) => {
  try {
    const k = String(req.params.schluessel || '');
    if (ERLAUBT.indexOf(k) < 0) return res.status(400).json({ error: 'unbekannter_schluessel' });

    const r = await query(
      'SELECT wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = $2',
      [req.user.id, k]
    );
    if (!r.rowCount) return res.json({ wert: null, updated_at: null });
    res.json({ wert: r.rows[0].wert, updated_at: r.rows[0].updated_at });
  } catch (e) { next(e); }
});

router.put('/:schluessel', authenticate, async (req, res, next) => {
  try {
    const k = String(req.params.schluessel || '');
    if (ERLAUBT.indexOf(k) < 0) return res.status(400).json({ error: 'unbekannter_schluessel' });

    const wert = req.body && typeof req.body.wert === 'object' ? req.body.wert : null;
    if (!wert) return res.status(400).json({ error: 'wert_fehlt' });

    /* Eine Obergrenze, damit hier keine Dokumente landen. Der Datenraum
       speichert Links, keine Inhalte - das steht so auch im Reiter. */
    const roh = JSON.stringify(wert);
    if (roh.length > 200 * 1024) return res.status(413).json({ error: 'zu_gross' });

    const r = await query(
      `INSERT INTO user_settings (user_id, schluessel, wert, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (user_id, schluessel)
       DO UPDATE SET wert = $3::jsonb, updated_at = NOW()
       RETURNING updated_at`,
      [req.user.id, k, roh]
    );
    res.json({ ok: true, updated_at: r.rows[0].updated_at });
  } catch (e) { next(e); }
});

module.exports = router;
