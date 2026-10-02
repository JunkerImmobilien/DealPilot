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
const fuehrung = require('../services/fuehrungService');
const voiceExtract = require('../services/voiceExtractService');
const config = require('../config');
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
  + '• *Neues Objekt anlegen* — /neu führt dich Schritt für Schritt durch. '
  + 'Du kannst auch mehrere Angaben in einem Satz schicken, ich sortiere sie zu.\n\n'
  + '*Befehle*\n'
  + '/neu · /objekte · /portfolio · /abbrechen · /hilfe · /stop';

/* Portfolio-Fragen erkennt man am Wortfeld, nicht an einer Absicht —
   ein Modell dafuer zu fragen waere ein Aufruf fuer eine Weiche. */
const PORTFOLIO_WORTE = /(portfolio|vermögen|vermoegen|bilanz|gesamt|insgesamt|alle objekte|wie viele objekte|in (fünf|zehn|5|10) jahren|zukunft|prognose|entwicklung|eigenkapital|restschuld|gesamtinvestition)/i;

/* Eine lesende Telegram-Abfrage (getFile). Eigene Funktion, weil `senden`
   bewusst jeden Fehler schluckt — hier muss ein Fehler ankommen, sonst
   laedt der Bot eine Datei von `undefined`. */
async function tgGet(token, methode, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(TG + token + '/' + methode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.description || ('HTTP ' + r.status));
    return j.result;
  } finally { clearTimeout(t); }
}

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

/* ── Der Gespraechszustand ───────────────────────────────────────────── */
async function zustand(chatId, userId) {
  const r = await query(
    `SELECT modus, entwurf, offene_ids, letzte_frage, objekt_id
       FROM telegram_dialog WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId]);
  return r.rows[0] || null;
}
async function zustandSetzen(chatId, userId, z) {
  await query(
    `INSERT INTO telegram_dialog
       (chat_id, bot_user_id, modus, entwurf, offene_ids, letzte_frage, objekt_id, aktualisiert)
     VALUES ($1::bigint,$2,$3,$4::jsonb,$5,$6,$7,now())
     ON CONFLICT (chat_id, bot_user_id) DO UPDATE SET
       modus = EXCLUDED.modus, entwurf = EXCLUDED.entwurf,
       offene_ids = EXCLUDED.offene_ids, letzte_frage = EXCLUDED.letzte_frage,
       objekt_id = EXCLUDED.objekt_id, aktualisiert = now()`,
    [String(chatId), userId, z.modus || null, JSON.stringify(z.entwurf || {}),
     z.offene_ids || null, z.letzte_frage || null, z.objekt_id || null]);
}
async function zustandLoeschen(chatId, userId) {
  await query(`DELETE FROM telegram_dialog WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId]);
}

function euro(n) { return Number(n).toLocaleString('de-DE'); }

/* ── Eine Antwort aufnehmen ──────────────────────────────────────────────
 *
 * Der Text geht an `extractFromText` — DENSELBEN Dienst, den der Sprechlauf
 * im Browser nutzt. Der Feldkatalog kommt aus den extrahierten
 * Frontend-Konstanten, nicht aus einer Liste in dieser Datei.
 */
async function aufnehmen(token, chatId, userId, text, entwurf) {
  let neu = {};
  try {
    const r = await voiceExtract.extractFromText(text, fuehrung.katalog(), {
      apiKey: config.openai.apiKey,
      modus: 'antwort',
      kontext: entwurf
    });
    neu = (r && r.fields) || {};
  } catch (e) {
    await senden(token, chatId, 'Das konnte ich nicht zuordnen: ' + (e.message || e)
      + '\n\nVersuch es nochmal — oder /abbrechen.');
    return;
  }

  if (!Object.keys(neu).length) {
    await senden(token, chatId,
      'Daraus konnte ich kein Feld lesen. Sag es gern anders — oder '
      + '/abbrechen, wenn du aufhören willst.');
    return;
  }
  await aufnehmenFelder(token, chatId, userId, neu, entwurf);
}

/* Der Teil ab den fertigen Feldern — gemeinsam fuer Text UND Sprache.
   Haette ich ihn zweimal geschrieben, waere die Adress-Rueckbestaetigung
   beim zweiten Weg irgendwann anders ausgefallen als beim ersten. */
async function aufnehmenFelder(token, chatId, userId, neu, entwurf) {
  const zusammen = Object.assign({}, entwurf, neu);

  /* ── DIE ADRESSE WIRD IMMER RUECKBESTAETIGT ───────────────────────────
   *
   * Marcel am 02.10.2026: "Die Adresse, da sollte er auf jeden Fall immer
   * nach einer Bestaetigung fragen, weil das kann ja auch sein, dass sie
   * durch die Sprachaufzeichnung manchmal nicht richtig uebermittelt wird."
   *
   * Dieselbe Regel gilt im Sprechlauf (`_rfAdresseBestaetigen`), und aus
   * demselben Grund:
   *
   *   > An der Adresse haengt alles Weitere — Bodenrichtwert,
   *   > Marktpreisindikation, Lage, Grunderwerbsteuer. Eine falsch
   *   > verstandene Strasse macht aus vier richtigen Abrufen vier falsche,
   *   > und keiner davon meldet einen Fehler: die Nachbarstadt hat auch
   *   > Marktdaten.
   *
   * Gefragt wird genau EINMAL — wenn die Adresse frisch dazugekommen ist. */
  const adresseNeu = ['str', 'hnr', 'plz', 'ort'].some((id) => neu[id] != null);
  const adresseDa = zusammen.plz || zusammen.ort;
  if (adresseNeu && adresseDa && !entwurf.__adr_ok) {
    zusammen.__adr_ok = true;
    await zustandSetzen(chatId, userId, { modus: 'adresse_bestaetigen', entwurf: zusammen });
    await senden(token, chatId,
      'Ich habe verstanden:\n\n*'
      + [zusammen.str, zusammen.hnr].filter(Boolean).join(' ')
      + (zusammen.str ? '\n' : '')
      + [zusammen.plz, zusammen.ort].filter(Boolean).join(' ')
      + '*\n\nStimmt das so? (ja / nein)');
    return;
  }

  /* Kurz sagen, was angekommen ist — sonst weiss der Nutzer nie, ob der Bot
     ihn verstanden hat. */
  const erkannt = Object.keys(neu).filter((id) => id.indexOf('__') !== 0).map((id) => {
    const f = fuehrung.feld(id);
    return '• ' + (f && f.label ? f.label : id) + ': *' + neu[id] + '*';
  });
  if (erkannt.length) await senden(token, chatId, 'Notiert:\n' + erkannt.join('\n'));

  await weiterFragen(token, chatId, userId, zusammen);
}

/* ── Die naechste Frage stellen ───────────────────────────────────────── */
async function weiterFragen(token, chatId, userId, entwurf) {
  const naechste = fuehrung.naechsteFrage(entwurf, { modus: 'anlegen' });
  const fo = fuehrung.fortschritt(entwurf);

  if (!naechste) {
    /* Nichts mehr offen: anlegen. */
    const r = await query(
      `INSERT INTO objects (user_id, data) VALUES ($1, $2::jsonb) RETURNING id`,
      [userId, JSON.stringify(entwurf)]);
    await zustandLoeschen(chatId, userId);
    await senden(token, chatId,
      '✓ *Objekt angelegt.*\n\n'
      + (entwurf.str ? entwurf.str + ' ' + (entwurf.hnr || '') + ', ' : '')
      + (entwurf.plz || '') + ' ' + (entwurf.ort || '')
      + '\n\nDu findest es ab sofort in DealPilot. Dort kannst du es '
      + 'weiter ausfüllen und rechnen lassen.');
    return r.rows[0].id;
  }

  await zustandSetzen(chatId, userId, {
    modus: 'anlegen', entwurf: entwurf,
    offene_ids: naechste.ids.filter((id) => !fuehrung.gefuellt(entwurf, id)),
    letzte_frage: naechste.frage
  });

  const et = fuehrung.etappe(naechste.et);
  await senden(token, chatId,
    (et ? '_Etappe ' + et.nr + ' von 6 · ' + et.name + '_\n\n' : '')
    + naechste.frage
    + '\n\n_' + fo.fertig + ' von ' + fo.bloecke + ' erledigt · /abbrechen beendet_');
  return null;
}

/* ── Die Auskunft ────────────────────────────────────────────────────────
 *
 * Drei Wege, und keiner davon rechnet: Objektliste aus `objects`, Portfolio
 * aus dem Spiegel, und fuer alles Uebrige derselbe `copilotChat`, den auch
 * der Browser ruft.
 */
async function beantworten(token, chatId, userId, text, msg) {
  /* ── Laeuft gerade eine gefuehrte Anlage? ──────────────────────────── */
  const z = await zustand(chatId, userId);

  if (/^\/abbrechen/i.test(text)) {
    if (z) { await zustandLoeschen(chatId, userId); await senden(token, chatId, 'Abgebrochen. Der Entwurf ist verworfen.'); }
    else await senden(token, chatId, 'Es läuft gerade nichts, was ich abbrechen könnte.');
    return;
  }

  if (/^\/neu/i.test(text)) {
    await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: {} });
    await senden(token, chatId,
      '*Neues Objekt.* Ich frage dich Schritt für Schritt durch — '
      + 'du kannst aber auch gleich mehrere Angaben in einem Satz schicken, '
      + 'ich sortiere sie zu.\n\n_/abbrechen beendet jederzeit._');
    await weiterFragen(token, chatId, userId, {});
    return;
  }

  if (z && z.modus === 'adresse_bestaetigen') {
    if (/^(ja|passt|stimmt|korrekt|richtig|j)\b/i.test(text.trim())) {
      await weiterFragen(token, chatId, userId, z.entwurf);
      return;
    }
    if (/^(nein|falsch|n)\b/i.test(text.trim())) {
      const e = Object.assign({}, z.entwurf);
      ['str', 'hnr', 'plz', 'ort'].forEach((id) => { delete e[id]; });
      await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: e });
      await senden(token, chatId, 'Gut — dann nochmal: Straße, Hausnummer, PLZ und Ort?');
      return;
    }
    /* Keine klare Antwort: als Korrektur der Adresse lesen. */
    await aufnehmen(token, chatId, userId, text, z.entwurf);
    return;
  }

  if (z && z.modus === 'anlegen') {
    await aufnehmen(token, chatId, userId, text, z.entwurf);
    return;
  }

  /* ── Sprachnachricht ──────────────────────────────────────────────────
   *
   * Marcel: "ich wuerde einfach eine Audio aufnehmen und dort reinsenden
   * mit Adresse und allen moeglichen Daten und er wertet aus, ob er alles
   * dafuer zur Verfuegung hat."
   *
   * Telegram liefert OGG/Opus. `extractFromAudio` nimmt den mime-Typ als
   * Parameter — es ist DERSELBE Dienst, den der Sprechlauf im Browser
   * nutzt, nur mit einem anderen Behaelter. Nichts daran ist neu gebaut. */
  if (msg && (msg.voice || msg.audio)) {
    const a = msg.voice || msg.audio;
    await senden(token, chatId, 'Ich höre rein …');
    let b64, mime;
    try {
      const f = await tgGet(token, 'getFile', { file_id: a.file_id });
      const r = await fetch('https://api.telegram.org/file/bot' + token + '/' + f.file_path);
      if (!r.ok) throw new Error('Download fehlgeschlagen (HTTP ' + r.status + ')');
      b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
      mime = a.mime_type || 'audio/ogg';
    } catch (e) {
      await senden(token, chatId, 'Die Aufnahme kam nicht durch: ' + (e.message || e));
      return;
    }

    const z0 = await zustand(chatId, userId);
    const entwurf = (z0 && z0.modus && z0.entwurf) || {};
    try {
      const r = await voiceExtract.extractFromAudio(b64, mime, fuehrung.katalog(), {
        apiKey: config.openai.apiKey, kontext: entwurf
      });
      const felder = (r && r.fields) || {};
      const gehoert = (r && r.transcript) || '';

      if (!Object.keys(felder).length) {
        await senden(token, chatId,
          (gehoert ? 'Verstanden habe ich: _' + gehoert.slice(0, 300) + '_\n\n' : '')
          + 'Daraus konnte ich kein Feld lesen. Sag gern Adresse, Fläche, '
          + 'Baujahr und Kaufpreis dazu.');
        return;
      }

      /* Laeuft keine Anlage, wird eine angefangen: eine Sprachnachricht mit
         Objektdaten IST der Wunsch, eines anzulegen. */
      if (!z0 || !z0.modus) {
        await senden(token, chatId,
          (gehoert ? 'Verstanden: _' + gehoert.slice(0, 400) + '_\n\n' : '')
          + '*Ich lege daraus ein Objekt an.*');
        await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: {} });
      } else if (gehoert) {
        await senden(token, chatId, 'Verstanden: _' + gehoert.slice(0, 400) + '_');
      }
      await aufnehmenFelder(token, chatId, userId, felder, entwurf);
    } catch (e) {
      await senden(token, chatId, 'Beim Auswerten ist etwas schiefgegangen: ' + (e.message || e));
    }
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
