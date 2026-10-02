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
const creds = require('../services/providerCredentialsService');

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
const PROVIDER = 'telegram';

/* ── v1792 · HIER STAND EIN BOT FUER ALLE ────────────────────────────────
 *
 * Bis v1791 las diese Datei TELEGRAM_BOT_TOKEN aus der Umgebung: EIN
 * DealPilot-Bot, fuer jeden Kunden derselbe. Marcel am 02.10.2026:
 *
 *   "aber ich moechte dass der kunde fuer sein objekt einen anlegen kann
 *    also selber. jeder kunde kann fuer sich und sein portfolio einen
 *    eigenen bot anlegen."
 *
 * Der Token kommt damit vom KUNDEN und ist ein fremdes Passwort. Er liegt
 * verschluesselt in `user_provider_credentials` (AES-256-GCM), nie in
 * einer Spalte dieser Anwendung und nie in einer Antwort dieser API —
 * `getMeta()` gibt nur die letzten vier Zeichen.
 */

const TG = 'https://api.telegram.org/bot';

/* Jeder Aufruf an Telegram geht hier durch. Eine Stelle, eine Frist.
 * Ohne Frist haengt ein Einrichtungsklick am offenen Netz. */
async function tgCall(token, methode, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(TG + token + '/' + methode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) {
      /* Telegrams eigene Begruendung durchreichen — sie ist fast immer
         praeziser als alles, was wir daraus machen wuerden
         ("Unauthorized", "bot was blocked by the user"). */
      const e = new Error(j.description || ('Telegram antwortete mit HTTP ' + r.status));
      e.tg = true;
      throw e;
    }
    return j.result;
  } finally { clearTimeout(t); }
}

/* Die oeffentliche Adresse dieser Anwendung — Telegram muss sie erreichen.
 * Ohne sie kann kein Webhook gesetzt werden, und das muss die Oberflaeche
 * sagen duerfen, statt es beim Speichern zu entdecken. */
function basisUrl() {
  /* GEMESSEN am 02.10.2026 statt geraten: die API laeuft auf DERSELBEN
     Domain wie die App unter /api/v1 (Auth.getApiBase() gibt "/api/v1",
     das meta-Tag ji-api-base ebenso). Die richtige Basis ist also genau
     die, die es im Container schon gibt:

       APP_URL=https://app.staging.dealpilot.immo

     PUBLIC_API_URL und APP_BASE_URL stehen zuerst, damit eine
     Installation mit getrennter API-Domain sie setzen kann, ohne diese
     Datei anzufassen. */
  const u = (process.env.PUBLIC_API_URL
          || process.env.APP_BASE_URL
          || process.env.APP_URL
          || process.env.FRONTEND_BASE_URL
          || '').trim();
  return u ? u.replace(/\/+$/, '') : null;
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

    const b = await query(
      `SELECT bot_username, bot_name, webhook_gesetzt, letzter_fehler, aktiv
         FROM telegram_bots WHERE user_id = $1`,
      [req.user.id]
    );
    const bot = b.rows[0] || null;
    const meta = await creds.getMeta(req.user.id, PROVIDER);

    res.json({
      /* `bot_bereit` heisst seit v1792: DIESER Kunde hat SEINEN Bot
         hinterlegt — nicht mehr: der Betreiber hat einen. */
      bot_bereit: Boolean(bot && meta.exists),
      bot: bot ? {
        username: bot.bot_username,
        name: bot.bot_name,
        webhook_gesetzt: bot.webhook_gesetzt,
        letzter_fehler: bot.letzter_fehler,
        aktiv: bot.aktiv,
        token_endet_auf: meta.hint || null   /* nie der Token selbst */
      } : null,
      webhook_moeglich: Boolean(basisUrl()),
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

/* ─── PUT /bot ────────────────────────────────────────────────────────────
 *
 * Der Kunde traegt den Token seines eigenen Bots ein. Drei Dinge passieren,
 * und zwar IN DIESER REIHENFOLGE:
 *
 *   1. getMe  — ist der Token echt, und wie heisst der Bot?
 *   2. speichern (verschluesselt) + Pfad und Secret erzeugen
 *   3. setWebhook — ab jetzt schickt Telegram an uns
 *
 * Erst pruefen, dann speichern: ein falsch abgetippter Token darf nicht als
 * "eingerichtet" in der Datenbank stehen. getMe kostet nichts und ist die
 * einzige Art, die Frage zu beantworten.
 */
router.put('/bot', requireJwt, async (req, res, next) => {
  try {
    const token = String((req.body && req.body.token) || '').trim();
    if (!token) return res.status(400).json({ error: 'Bot-Token fehlt' });

    /* Grobform vorab, damit ein offensichtlicher Vertipper nicht erst
       ueber das Netz auffaellt: <zahlen>:<35 Zeichen>. */
    if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
      return res.status(400).json({
        error: 'Das sieht nicht wie ein Bot-Token aus. BotFather gibt etwas der Form '
             + '123456789:AA… heraus — bitte die ganze Zeile einfuegen.'
      });
    }

    const basis = basisUrl();
    if (!basis) {
      return res.status(503).json({
        error: 'Diese Installation hat keine oeffentliche Adresse hinterlegt '
             + '(PUBLIC_API_URL). Ohne sie kann Telegram uns nicht erreichen.'
      });
    }

    /* 1 · echt? */
    let me;
    try {
      me = await tgCall(token, 'getMe');
    } catch (e) {
      return res.status(400).json({
        error: e.tg ? ('Telegram lehnt diesen Token ab: ' + e.message)
                    : ('Telegram war nicht erreichbar: ' + e.message)
      });
    }

    /* 2 · speichern. Der Token geht in den verschluesselten Tresor, alles
       Uebrige in die eigene Tabelle. */
    await creds.setCredential(req.user.id, PROVIDER, token);

    const pfad = crypto.randomBytes(24).toString('base64url');
    const secret = crypto.randomBytes(24).toString('base64url');
    await query(
      `INSERT INTO telegram_bots
         (user_id, bot_username, bot_name, bot_id, webhook_pfad, webhook_secret, aktiv)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT (user_id) DO UPDATE SET
         bot_username = EXCLUDED.bot_username,
         bot_name     = EXCLUDED.bot_name,
         bot_id       = EXCLUDED.bot_id,
         webhook_pfad = EXCLUDED.webhook_pfad,
         webhook_secret = EXCLUDED.webhook_secret,
         webhook_gesetzt = NULL,
         letzter_fehler = NULL,
         aktiv = TRUE`,
      [req.user.id, me.username || null, me.first_name || null, me.id || null, pfad, secret]
    );

    /* 3 · Webhook. Schlaegt er fehl, ist der Bot gespeichert, aber stumm —
       und genau das muss die Oberflaeche anzeigen koennen, statt "fertig"
       zu melden. */
    let webhookOk = true, webhookFehler = null;
    try {
      await tgCall(token, 'setWebhook', {
        url: basis + '/api/v1/telegram/webhook/' + pfad,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      });
      await query(`UPDATE telegram_bots SET webhook_gesetzt = now() WHERE user_id = $1`,
        [req.user.id]);
    } catch (e) {
      webhookOk = false;
      webhookFehler = e.message;
      await query(`UPDATE telegram_bots SET letzter_fehler = $2 WHERE user_id = $1`,
        [req.user.id, String(e.message).slice(0, 400)]);
    }

    res.json({
      gespeichert: true,
      bot: { username: me.username, name: me.first_name },
      webhook_gesetzt: webhookOk,
      webhook_fehler: webhookFehler
    });
  } catch (e) { next(e); }
});

/* ─── DELETE /bot ─────────────────────────────────────────────────────── */
router.delete('/bot', requireJwt, async (req, res, next) => {
  try {
    /* Erst bei Telegram abmelden, dann vergessen. Andersherum haetten wir
       einen Bot, der weiter an eine Adresse sendet, die wir nicht mehr
       zuordnen koennen. */
    const token = await creds.getSecret(req.user.id, PROVIDER);
    if (token) { try { await tgCall(token, 'deleteWebhook', {}); } catch (e) {} }
    await creds.remove(req.user.id, PROVIDER);
    await query(`DELETE FROM telegram_links WHERE bot_user_id = $1 OR user_id = $1`, [req.user.id]);
    await query(`DELETE FROM telegram_bots WHERE user_id = $1`, [req.user.id]);
    res.json({ geloescht: true });
  } catch (e) { next(e); }
});

/* ─── POST /code ──────────────────────────────────────────────────────── */
router.post('/code', requireJwt, async (req, res, next) => {
  try {
    /* Keinen Code ausgeben, den niemand einloesen kann. */
    const b = await query(`SELECT 1 FROM telegram_bots WHERE user_id = $1`, [req.user.id]);
    if (!b.rows.length) {
      return res.status(503).json({
        error: 'Du hast noch keinen eigenen Bot hinterlegt.',
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
      `INSERT INTO telegram_links (user_id, bot_user_id, code, code_ablauf)
       VALUES ($1, $1, $2, now() + ($3 || ' minutes')::interval)
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
