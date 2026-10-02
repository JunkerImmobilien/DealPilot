'use strict';
/* routes/telegramWebhook.js — der Eingang von Telegram (v1792)
 *
 * Mount: /api/v1/telegram/webhook/:pfad
 *
 * ── WARUM DAS EINE EIGENE DATEI IST ──────────────────────────────────────
 *
 * `routes/telegram.js` traegt ganz oben `router.use(authenticate)` — jede
 * Zeile darin gehoert einem angemeldeten Nutzer. HIER IST DAS GENAU
 * UMGEKEHRT: die Anfrage kommt von Telegram, es gibt keinen Anmeldenamen
 * und kein Token des Nutzers.
 *
 *   > Zwei Berechtigungslagen in einer Datei sind eine Einladung, die
 *   > falsche zu erwischen. Eine vergessene Zeile `authenticate` faellt
 *   > niemandem auf, solange der eigene Test angemeldet laeuft.
 *
 * Deshalb zwei Dateien, und diese hier nennt ihre Regel im ersten Absatz:
 * NICHTS aus dem Nachrichteninhalt darf entscheiden, WESSEN Daten gelesen
 * werden. Das entscheiden ausschliesslich Pfad und Secret.
 *
 * ── DIE DREI MERKMALE, IN DIESER REIHENFOLGE ─────────────────────────────
 *
 *   1. `:pfad`     — 24 Zufallsbytes, je Bot verschieden. Findet den Bot.
 *   2. Secret-Kopf — X-Telegram-Bot-Api-Secret-Token, von Telegram gesetzt.
 *                    Wer den Pfad erraet, hat damit noch nichts.
 *   3. `chat.id`   — findet die VERKNUEPFUNG, nie den Nutzer direkt.
 *
 * `chat.id` ist ein BIGINT und `users.id` eine UUID. Sie werden nirgends
 * ineinander gewandelt.
 */
const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const creds = require('../services/providerCredentialsService');

const TG = 'https://api.telegram.org/bot';
const PROVIDER = 'telegram';

async function senden(token, chatId, text, extra) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      await fetch(TG + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({
          chat_id: chatId, text: text, parse_mode: 'Markdown'
        }, extra || {})),
        signal: ctrl.signal
      });
    } finally { clearTimeout(t); }
  } catch (e) { /* ein stummer Bot ist besser als ein haengender Webhook */ }
}

router.post('/:pfad', async (req, res) => {
  /* Telegram wiederholt alles, was nicht mit 200 beantwortet wird — bis zu
     24 Stunden lang. Deshalb wird HIER IMMER 200 geantwortet, sofort, und
     die Arbeit passiert danach. Ein Fehler in unserer Logik darf keine
     Wiederholungsschleife ausloesen. */
  res.status(200).json({ ok: true });

  try {
    const pfad = req.params.pfad || '';
    const secret = req.get('X-Telegram-Bot-Api-Secret-Token') || '';

    const b = await query(
      `SELECT user_id, bot_username, webhook_secret, aktiv
         FROM telegram_bots WHERE webhook_pfad = $1`,
      [pfad]
    );
    if (!b.rows.length) return;                      /* unbekannter Pfad */
    const bot = b.rows[0];
    if (!bot.aktiv) return;

    /* Zeitkonstanter Vergleich waere hier Zierde — der Pfad ist bereits
       geheim und der Vergleich findet nach einer Datenbankabfrage statt.
       Wichtig ist, DASS verglichen wird. */
    if (!secret || secret !== bot.webhook_secret) return;

    const upd = req.body || {};
    const msg = upd.message || null;
    if (!msg || !msg.chat) return;

    const chatId = msg.chat.id;                      /* BIGINT. Nie als user_id. */
    const text = String(msg.text || '').trim();

    const token = await creds.getSecret(bot.user_id, PROVIDER);
    if (!token) return;

    /* ── Ist dieser Chat schon verknuepft? ──────────────────────────── */
    const l = await query(
      `SELECT user_id FROM telegram_links
        WHERE chat_id = $1::bigint AND bot_user_id = $2
          AND bestaetigt_am IS NOT NULL AND aktiv = TRUE`,
      [String(chatId), bot.user_id]
    );

    if (!l.rows.length) {
      /* ── Noch nicht verknuepft: nur der Code zaehlt ───────────────── */
      const kandidat = text.replace(/\s+/g, '').toUpperCase();

      if (/^\/start/i.test(text)) {
        await senden(token, chatId,
          'Willkommen bei *DealPilot*.\n\n'
          + 'Damit ich weiss, wessen Objekte ich zeigen darf, brauche ich einmal '
          + 'deinen Verbindungscode. Du findest ihn in DealPilot unter '
          + '*Einstellungen → Account & Sicherheit → Telegram-Bot*.\n\n'
          + 'Schick ihn mir einfach als naechste Nachricht.');
        return;
      }

      if (/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(kandidat)) {
        const code = kandidat.length === 8 ? kandidat.slice(0, 4) + '-' + kandidat.slice(4) : kandidat;
        const r = await query(
          `UPDATE telegram_links
              SET chat_id = $1::bigint, bestaetigt_am = now(), code = NULL,
                  tg_username = $4, tg_vorname = $5
            WHERE bot_user_id = $2 AND code = $3
              AND bestaetigt_am IS NULL
              AND code_ablauf > now()
            RETURNING user_id`,
          [String(chatId), bot.user_id, code,
           (msg.from && msg.from.username) || null, (msg.from && msg.from.first_name) || null]
        );
        if (r.rows.length) {
          await senden(token, chatId,
            '✓ *Verbunden.*\n\nAb jetzt kannst du mich nach deinen Objekten und '
            + 'deinem Portfolio fragen, Felder aendern oder ein neues Objekt anlegen — '
            + 'auch per Sprachnachricht.');
        } else {
          /* Kein Hinweis darauf, OB es den Code gab — sonst waere das hier
             ein Ratewerkzeug. */
          await senden(token, chatId,
            'Der Code stimmt nicht oder ist abgelaufen (er gilt 15 Minuten). '
            + 'Hol dir in DealPilot einen neuen unter *Einstellungen → '
            + 'Account & Sicherheit → Telegram-Bot*.');
        }
        return;
      }

      await senden(token, chatId,
        'Wir sind noch nicht verbunden. Schick mir bitte zuerst deinen '
        + 'Verbindungscode aus DealPilot (*Einstellungen → Account & Sicherheit '
        + '→ Telegram-Bot*).');
      return;
    }

    /* ── Verknuepft ──────────────────────────────────────────────────── */
    await query(`UPDATE telegram_links SET letzte_nutzung = now()
                  WHERE chat_id = $1::bigint AND bot_user_id = $2`,
      [String(chatId), bot.user_id]);

    if (/^\/start/i.test(text)) {
      await senden(token, chatId,
        'Wir sind bereits verbunden. Frag mich nach deinen Objekten oder deinem '
        + 'Portfolio — oder schick mir eine Sprachnachricht fuer ein neues Objekt.');
      return;
    }
    if (/^\/stop/i.test(text)) {
      await query(`UPDATE telegram_links SET aktiv = FALSE
                    WHERE chat_id = $1::bigint AND bot_user_id = $2`,
        [String(chatId), bot.user_id]);
      await senden(token, chatId,
        'Verbindung stillgelegt. In DealPilot kannst du sie unter *Einstellungen* '
        + 'wieder anschalten.');
      return;
    }

    /* ── Ab hier gehoert die Antwort dem Co-Piloten ───────────────────
       NOCH NICHT GEBAUT, und das wird hier gesagt statt verschwiegen.
       Es fehlen die drei Posten aus BACKLOG T-B6: Feldkatalog, Portfolio-
       Zahlen und Fuehrungslogik liegen heute im Frontend-JS.

         > Ein Bot, der auf eine Frage schweigt, sieht aus wie ein
         > kaputter Bot. Einer, der sagt "das kann ich noch nicht", ist
         > ein ehrlicher. */
    await senden(token, chatId,
      'Verbunden — aber ich kann noch nicht antworten.\n\n'
      + 'Die Verknuepfung steht, der Rest wird gerade gebaut: Fragen zu Objekten, '
      + 'Portfolio-Zahlen, Felder aendern und das Anlegen per Sprachnachricht.');
  } catch (e) {
    /* Nie werfen: die Antwort ist raus, ein Fehler hier wuerde nur den
       Prozess belasten. */
    try { console.error('[telegram-webhook]', e && e.message); } catch (e2) {}
  }
});

module.exports = router;
