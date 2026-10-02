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
const dialog = require('../services/telegramDialogService');
const { copilotKontingent } = require('./ai');

const TG = 'https://api.telegram.org/bot';
const PROVIDER = 'telegram';

const HILFE =
  '*Was ich kann*\n\n'
  + '• *Fragen zu einem Objekt* — nenn mir die Adresse: '
  + '"wie ist der DSCR bei der Musterstr. 12?"\n'
  + '• *Portfolio* — "wie ist meine Vermögensbilanz?", '
  + '"wo stehe ich in zehn Jahren?", "wie viele Objekte habe ich?"\n'
  + '• *Übersicht* — /objekte zeigt deine Objekte\n\n'
  + '*Befehle*\n'
  + '/objekte · /portfolio · /hilfe · /stop\n\n'
  + '_Neue Objekte anlegen und Felder ändern kommen als Nächstes._';

/* Portfolio-Fragen erkennt man am Wortfeld, nicht an einer Absicht —
   ein Modell dafuer zu fragen waere ein Aufruf fuer eine Weiche. */
const PORTFOLIO_WORTE = /(portfolio|vermögen|vermoegen|bilanz|gesamt|insgesamt|alle objekte|wie viele objekte|in (fünf|zehn|5|10) jahren|zukunft|prognose|entwicklung|eigenkapital|restschuld|gesamtinvestition)/i;

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

/* Telegram bricht bei 4096 Zeichen ab — ohne Fehlermeldung an uns. Lieber
   selbst teilen als eine abgeschnittene Zahl ausliefern. */
async function sendenLang(token, chatId, text) {
  const MAX = 3900;
  if (text.length <= MAX) return senden(token, chatId, text);
  let rest = text;
  while (rest.length) {
    let stueck = rest.slice(0, MAX);
    if (rest.length > MAX) {
      const schnitt = stueck.lastIndexOf('\n\n');
      if (schnitt > MAX / 2) stueck = stueck.slice(0, schnitt);
    }
    await senden(token, chatId, stueck);
    rest = rest.slice(stueck.length).replace(/^\n+/, '');
  }
}

/* ── Die Auskunft ────────────────────────────────────────────────────────
 *
 * Drei Wege, und keiner davon rechnet: Objektliste aus `objects`, Portfolio
 * aus dem Spiegel, und fuer alles Uebrige derselbe `copilotChat`, den auch
 * der Browser ruft.
 */
async function beantworten(token, chatId, userId, text, msg) {
  if (msg && (msg.voice || msg.audio)) {
    await senden(token, chatId,
      'Sprachnachrichten kann ich noch nicht auswerten — das kommt mit dem '
      + 'Anlegen neuer Objekte. Schreib mir solange bitte.');
    return;
  }
  if (!text) return;

  /* /objekte — reine Datenbankauskunft, kostet kein Kontingent. */
  if (/^\/objekte/i.test(text)) {
    const liste = await dialog.objekteListe(userId, 40);
    if (!liste.length) {
      await senden(token, chatId, 'Ich sehe noch keine Objekte in deinem Konto.');
      return;
    }
    const zeilen = liste.map((o, i) => (i + 1) + '. *' + (o.adresse || 'ohne Adresse') + '*'
      + (o.kp ? ' · ' + Number(o.kp).toLocaleString('de-DE') + ' €' : ''));
    await sendenLang(token, chatId,
      '*Deine Objekte* (' + liste.length + ')\n\n' + zeilen.join('\n')
      + '\n\nFrag mich zu einem davon — nenn einfach die Adresse.');
    return;
  }

  /* Portfolio: Spiegel oder ehrliche Fehlanzeige. */
  const willPortfolio = /^\/portfolio/i.test(text) || PORTFOLIO_WORTE.test(text);
  let kontext = null, kontextArt = null, stand = null;

  if (willPortfolio) {
    const sp = await dialog.portfolioKontext(userId);
    if (!sp) {
      /* KEINE ERSATZRECHNUNG. Lieber sagen, dass die Zahl fehlt, als eine
         zweite Quelle aufzumachen — genau daran ist projectAll jahrelang
         unbemerkt vorbeigerechnet. */
      await senden(token, chatId,
        'Deine Portfolio-Zahlen liegen mir hier noch nicht vor.\n\n'
        + 'Sie entstehen in DealPilot selbst — öffne die App einmal kurz, '
        + 'dann kann ich sie dir hier nennen. (Ich rechne sie bewusst nicht '
        + 'selbst nach: eine zweite Rechnung wäre irgendwann eine andere.)');
      return;
    }
    kontext = sp.payload;
    kontextArt = 'portfolio';
    stand = dialog.standSatz(sp.erfasst_am, sp.alter_minuten);
    if (/^\/portfolio\s*$/i.test(text)) {
      text = 'Gib mir einen kurzen Ueberblick ueber mein Portfolio: '
           + 'Anzahl Objekte, Gesamtinvestition, Eigenkapital, Restschuld, '
           + 'Cashflow und wo ich in zehn Jahren stehe.';
    }
  } else {
    /* Einzelobjekt: aus dem Satz zuordnen. Bei Gleichstand wird GEFRAGT. */
    const liste = await dialog.objekteListe(userId, 60);
    const t = dialog.objektRaten(text, liste);
    if (t.art === 'mehrdeutig') {
      await senden(token, chatId,
        'Welches Objekt meinst du?\n\n'
        + t.kandidaten.map((o, i) => (i + 1) + '. ' + o.adresse).join('\n')
        + '\n\nNenn mir bitte die Hausnummer oder den Ort dazu.');
      return;
    }
    if (t.art === 'eindeutig') {
      kontext = await dialog.objektKontext(userId, t.objekt.id);
    } else if (liste.length === 1) {
      kontext = await dialog.objektKontext(userId, liste[0].id);
    } else {
      await senden(token, chatId,
        'Zu welchem Objekt? Nenn mir die Adresse — /objekte zeigt dir die Liste.\n\n'
        + 'Oder frag mich etwas über dein *Portfolio* als Ganzes.');
      return;
    }
  }

  /* Das Tageslimit ist DASSELBE wie im Browser (ai.js). Zwei Zaehler waeren
     zwei Limits. */
  const k = await copilotKontingent.verbrauchen(userId);
  if (!k.ok) {
    await senden(token, chatId,
      'Dein Co-Pilot-Tageslimit ist erreicht (' + k.limit + ' Antworten). Morgen wieder.');
    return;
  }

  let r;
  try {
    r = await dialog.antwort({ message: text, context: kontext, kontextArt: kontextArt });
  } catch (e) {
    await senden(token, chatId, 'Da ist mir gerade etwas dazwischengekommen: ' + (e.message || e));
    return;
  }

  /* Das Feld heisst `reply` — gemessen an openaiService.js:2275, nicht
     geraten. Mein erster Versuch las `message || text || answer` und haette
     bei JEDER Antwort "keine Antwort bekommen" gemeldet. */
  let out = (r && r.reply) || '';
  if (!out) { await senden(token, chatId, 'Dazu habe ich keine Antwort bekommen.'); return; }

  /* Steueranweisungen des Modells gehoeren nicht in den Chat — sie sind
     fuer die Oberflaeche gedacht, nicht fuer den Leser. */
  out = out.replace(/<<<FELDER[\s\S]*?FELDER>>>/g, '').replace(/<<<ABRUF[\s\S]*?ABRUF>>>/g, '').trim();

  if (stand) out += '\n\n_' + stand + '_';
  await sendenLang(token, chatId, out);
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

    if (/^\/hilfe|^\/help/i.test(text)) {
      await senden(token, chatId, HILFE);
      return;
    }

    /* ── Die Auskunft ────────────────────────────────────────────────── */
    await beantworten(token, chatId, l.rows[0].user_id, text, msg);
  } catch (e) {
    /* Nie werfen: die Antwort ist raus, ein Fehler hier wuerde nur den
       Prozess belasten. */
    try { console.error('[telegram-webhook]', e && e.message); } catch (e2) {}
  }
});

module.exports = router;
