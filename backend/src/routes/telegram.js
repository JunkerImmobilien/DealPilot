'use strict';
/* routes/telegram.js — Verknuepfung Telegram-Chat <-> DealPilot-Konto (v1791)
 *
 * Mount: /api/v1/telegram. Nur per echtem Login (JWT).
 *
 * Marcel am 02.10.2026: der Bot "muss ueber einstellungen vernuenftig
 * einzurichten sein". Das ist die Server-Seite davon — vier Endpunkte, mehr
 * braucht die Einrichtung nicht:
 *
 *   GET    /status    was die Einstellungen anzeigen (verbunden? mit wem?)
 *   POST   /code      Einmal-Code erzeugen (15 Minuten gueltig)
 *   PUT    /aktiv     stilllegen / wieder anschalten, ohne zu loeschen
 *   DELETE /link      Verbindung trennen
 *
 * DER WEBHOOK IST HIER BEWUSST NICHT DRIN. Er braucht einen Bot-Token, den
 * es noch nicht gibt, und er hat eine voellig andere Berechtigungslage: er
 * kommt von Telegram, nicht vom angemeldeten Nutzer. Beides in einer Datei
 * waere eine Einladung, `authenticate` einmal zu vergessen.
 *
 * ── DIE REGEL, DIE HIER UEBERALL GILT ────────────────────────────────────
 *
 * `chat_id` ist ein BIGINT, `user_id` eine UUID. Sie werden nie ineinander
 * gewandelt, nie verglichen, nie vertauscht. Seit v942 scheitern die
 * nutzerbezogenen Marktbericht-Wege genau daran still — `parseInt()` auf
 * eine UUID gibt keine Fehlermeldung, sondern eine falsche Zahl.
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');

router.use(authenticate);

/* Verwaltung NIE per API-Key — sonst koennte ein Key sich selbst einen
 * zweiten Zugang in Telegram einrichten. Gleiches Muster wie apiKeys.js. */
function requireJwt(req, res, next) {
  if (req.apiKey) {
    return res.status(403).json({ error: 'Telegram-Einrichtung nur nach Login moeglich' });
  }
  next();
}

const CODE_MINUTEN = 15;

/* Der Bot-Name steht in der Umgebung, nicht in der Datenbank: er ist fuer
 * alle Kunden derselbe. Fehlt er, GIBT ES DEN BOT NOCH NICHT — und dann
 * muss die Oberflaeche das sagen, statt einen Code auszugeben, den niemand
 * einloesen kann.
 *
 *   > Ein Einrichtungsweg, der am Ende ins Leere fuehrt, ist schlimmer als
 *   > einer, der fehlt. Der fehlende kostet eine Frage, der leere eine
 *   > Viertelstunde und das Vertrauen.
 *
 * Gesetzt wird TELEGRAM_BOT_NAME (ohne @) zusammen mit TELEGRAM_BOT_TOKEN,
 * wenn der Bot bei BotFather angelegt ist. */
function botName() {
  const n = (process.env.TELEGRAM_BOT_NAME || '').trim().replace(/^@/, '');
  return n || null;
}
function botBereit() {
  return Boolean(botName() && (process.env.TELEGRAM_BOT_TOKEN || '').trim());
}

/* Code-Alphabet ohne 0/O und 1/I/L: er wird vom Bildschirm ABGETIPPT oder
 * vorgelesen. Ein Code, bei dem man raten muss, ob da eine Null oder ein O
 * steht, erzeugt genau einen Support-Fall je Kunde. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function codeErzeugen() {
  const b = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s.slice(0, 4) + '-' + s.slice(4);   /* ABCD-EFGH, leichter vorzulesen */
}

/* ─── GET /status ─────────────────────────────────────────────────────── */
router.get('/status', requireJwt, async (req, res, next) => {
  try {
    const r = await query(
      `SELECT chat_id, tg_username, tg_vorname, code, code_ablauf,
              bestaetigt_am, letzte_nutzung, aktiv
         FROM telegram_links
        WHERE user_id = $1
        ORDER BY bestaetigt_am NULLS LAST, erstellt_am DESC`,
      [req.user.id]
    );
    const bestaetigt = r.rows.filter((z) => z.bestaetigt_am);
    const offen = r.rows.find((z) => !z.bestaetigt_am);

    res.json({
      bot_bereit: botBereit(),
      bot_name: botName(),
      verbunden: bestaetigt.length > 0,
      verbindungen: bestaetigt.map((z) => ({
        /* chat_id als ZEICHENKETTE nach aussen: ein BIGINT ueberschreitet
           Number.MAX_SAFE_INTEGER nicht, aber JSON.parse im Browser macht
           daraus eine Gleitkommazahl, und die ist nicht mehr dieselbe Zahl. */
        chat_id: z.chat_id == null ? null : String(z.chat_id),
        username: z.tg_username,
        vorname: z.tg_vorname,
        seit: z.bestaetigt_am,
        letzte_nutzung: z.letzte_nutzung,
        aktiv: z.aktiv
      })),
      offener_code: offen && offen.code_ablauf && new Date(offen.code_ablauf) > new Date()
        ? { code: offen.code, laeuft_ab: offen.code_ablauf }
        : null
    });
  } catch (e) { next(e); }
});

/* ─── POST /code ──────────────────────────────────────────────────────── */
router.post('/code', requireJwt, async (req, res, next) => {
  try {
    /* Keinen Code ausgeben, den niemand einloesen kann. */
    if (!botBereit()) {
      return res.status(503).json({
        error: 'Der DealPilot-Bot ist noch nicht eingerichtet.',
        bot_bereit: false
      });
    }
    /* Einen alten offenen Code ersetzen, nicht danebenlegen: der
       Teil-Index telegram_links_offener_code_uniq laesst nur einen zu,
       und zwei gueltige Codes gleichzeitig waeren zwei offene Tueren. */
    await query(
      `DELETE FROM telegram_links WHERE user_id = $1 AND bestaetigt_am IS NULL`,
      [req.user.id]
    );

    const code = codeErzeugen();
    const r = await query(
      `INSERT INTO telegram_links (user_id, code, code_ablauf)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
       RETURNING code, code_ablauf`,
      [req.user.id, code, String(CODE_MINUTEN)]
    );
    res.json({
      code: r.rows[0].code,
      laeuft_ab: r.rows[0].code_ablauf,
      gueltig_minuten: CODE_MINUTEN
    });
  } catch (e) { next(e); }
});

/* ─── PUT /aktiv ──────────────────────────────────────────────────────── */
router.put('/aktiv', requireJwt, async (req, res, next) => {
  try {
    const an = req.body && req.body.aktiv === true;
    const r = await query(
      `UPDATE telegram_links SET aktiv = $2
        WHERE user_id = $1 AND bestaetigt_am IS NOT NULL
        RETURNING 1`,
      [req.user.id, an]
    );
    /* query() gibt rows, nicht rowCount — deshalb RETURNING und zaehlen.
       Dieselbe Falle wie beim UID-Zuordner im Marktbericht-Strang. */
    res.json({ aktiv: an, betroffen: r.rows.length });
  } catch (e) { next(e); }
});

/* ─── DELETE /link ────────────────────────────────────────────────────── */
router.delete('/link', requireJwt, async (req, res, next) => {
  try {
    const chatId = req.body && req.body.chat_id;
    let r;
    if (chatId) {
      /* Als Zeichenkette hereingereicht, als BIGINT verglichen. Postgres
         wandelt den Text selbst — in JavaScript duerfte die Zahl das nicht
         ueberleben. */
      r = await query(
        `DELETE FROM telegram_links
          WHERE user_id = $1 AND chat_id = $2::bigint RETURNING 1`,
        [req.user.id, String(chatId)]
      );
    } else {
      r = await query(
        `DELETE FROM telegram_links WHERE user_id = $1 RETURNING 1`,
        [req.user.id]
      );
    }
    res.json({ geloescht: r.rows.length });
  } catch (e) { next(e); }
});

module.exports = router;
