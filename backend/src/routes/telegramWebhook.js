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
const absicht = require('../services/telegramAbsichtService');
const voiceExtract = require('../services/voiceExtractService');
const config = require('../config');
const openai = require('../services/openaiService');
const { copilotKontingent } = require('./ai');
const agent = require('../services/agentLauf');
const objectService = require('../services/objectService');

const TG = 'https://api.telegram.org/bot';
const PROVIDER = 'telegram';

const HILFE =
  '*Sag es einfach so, wie du es denkst.* Befehle brauchst du nicht.\n\n'
  + '*Objekte*\n'
  + '„gib mir ne Liste der Objekte"\n'
  + '„was hat Objekt 17 für Kerndaten?"\n'
  + '„wie ist der DSCR bei der Musterstr. 12?"\n'
  + '„und die Miete?" — ich bleibe beim selben Objekt\n\n'
  + '*Portfolio*\n'
  + '„wie ist meine Vermögensbilanz?"\n'
  + '„wo stehe ich in zehn Jahren?"\n\n'
  + '*Bewertung*\n'
  + '„wie ist der DealScore?" · „Investor Deal Score von Objekt 3"\n'
  + '„hol mir eine Marktpreisindikation" — oder „erweiterte"\n\n'
  + '*Anlegen und ändern*\n'
  + '„leg mir ein Objekt an" — dann sprich einfach drauf los, '
  + 'schick ein Foto vom Exposé oder tippe\n'
  + '„setz die Zimmerzahl auf 5"\n\n'
  + '_Befehle gehen auch: /neu · /objekte · /portfolio · /marktpreis · '
  + '/abbrechen · /stop_';

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


/* ── v1809 · JEDE BOTANTWORT GEHT IN DEN VERLAUF ─────────────────────────
 *
 * Vorher lief verlaufMerken nur an drei Stellen. Preisansage,
 * Etappenfragen und Adressrueckfrage standen NIE darin — und die
 * Geldsperre in agentAntwort liest genau diesen Verlauf, um zu
 * entscheiden, ob ein "ja" eine Freigabe ist.
 *
 *   > Eine Sperre, die einen halb gefuellten Verlauf liest, prueft nicht
 *   > die letzte Nachricht, sondern irgendeine aeltere. Dass sie
 *   > meistens richtig liegt, macht sie nicht sicher.
 *
 * botSagt() sendet UND merkt. Wer senden() direkt ruft, muss einen Grund
 * haben (Zwischenrufe wie "Ich hoere rein ...", die keine Antwort sind).
 */
async function botSagt(token, chatId, userId, text) {
  await sendenLang(token, chatId, text);
  await verlaufMerken(chatId, userId, 'assistant', text);
}

/* ── Der Agent antwortet ─────────────────────────────────────────────────
 *
 * Alles, was die Schnellmuster nicht abfangen, landet hier. Der Agent
 * bekommt die Frage, die Lage (letzte Liste, letztes Objekt, laufender
 * Entwurf) und den Werkzeugkasten — und holt sich selbst, was er braucht.
 *
 * Das Tageslimit ist DASSELBE wie im Browser. Ein Agentenlauf kann
 * mehrere Modellrunden kosten, zaehlt aber als EINE Antwort: gezaehlt
 * wird, was der Nutzer bekommt, nicht was intern passiert.
 */
async function agentAntwort(token, chatId, userId, text, z, bezugObjektId) {
  const k = await copilotKontingent.verbrauchen(userId);
  if (!k.ok) {
    await senden(token, chatId,
      'Dein Co-Pilot-Tageslimit ist erreicht (' + k.limit + ' Antworten). Morgen wieder.');
    return;
  }

  /* Telegram zeigt "tippt …", solange wir arbeiten. Bei mehreren
     Werkzeugrunden dauert das ein paar Sekunden — ohne Zeichen haelt der
     Nutzer den Bot fuer tot. */
  try { await tgGet(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }); } catch (e) {}

  /* ── v1805 · WANN DARF DER AGENT GELD AUSGEBEN? ──────────────────────
   *
   * Nur, wenn der Nutzer gerade JA gesagt hat UND die Nachricht davor
   * eine Preisansage des Bots war. Beides zusammen, nicht eins davon.
   *
   *   > Ein "ja" allein ist keine Freigabe — es koennte die Antwort auf
   *   > irgendetwas sein. Und eine Preisansage allein auch nicht: sie ist
   *   > die Frage, nicht die Antwort.
   *
   * Die Sperre sitzt damit AUSSERHALB des Modells. Es kann sie nicht
   * uebergehen, auch wenn es die Zustimmung missversteht. */
  /* ── v1888 · DIE ZUSTIMMUNG STAND NICHT AM SATZANFANG ────────────────
   *
   * GEMESSEN an Marcels Dialog vom 05.10.2026, 15:51. Er diktierte:
   *
   *   „Die Marge ist 3,57 Prozent und ja, ich möchte die
   *    Marktbreitindikation jetzt abrufen."
   *
   * Der Ausdruck hier war mit `^` am Satzanfang verankert. Der Satz
   * beginnt mit „Die" — `sagtJa` war FALSE, `darfKosten` damit auch, und
   * `marktbericht_abrufen` wurde gesperrt. Das Modell befolgte darauf den
   * Sperrhinweis („nenne den Preis"), rief `marktbericht_preis` ein
   * zweites Mal und listete dieselben drei Stufen erneut auf.
   *
   *   > Wer diktiert, sagt sein Ja im Nebensatz. Eine Zustimmung, die nur
   *   > als erstes Wort zählt, erkennt genau die Zustimmungen nicht, die
   *   > per Sprachnachricht kommen — und der Nutzer sieht keinen Fehler,
   *   > sondern dieselbe Frage noch einmal.
   *
   * Jetzt zählt das Zustimmungswort ÜBERALL im Satz, aber als eigenes
   * Wort — und eine Verneinung im selben Satz hebt es auf. „ja, aber
   * nicht jetzt" ist keine Freigabe.
   *
   * DIE DREI ANDEREN SCHRANKEN BLEIBEN UNVERÄNDERT: es braucht zusätzlich
   * eine Preisansage davor UND ein frisches Angebot mit Gegenstand
   * (v1821). Gelockert wird nur, WO das Ja stehen darf — nicht, wofür es
   * gilt. */
  /* ── v1888a · „abrufen" IST KEINE ZUSTIMMUNG, SONDERN DIE HANDLUNG ───
   *
   * In der Wortliste von v1888 stand `abrufen` als eigenes Ja-Wort. Damit
   * haette „was kostet das Abrufen?" als Freigabe gezaehlt: die Frage
   * nennt die Handlung, die Botzeile davor nennt einen Abruf (standPreis),
   * und ein frisches Angebot liegt nach jeder Preisansage vor. Alle drei
   * Schranken waeren offen gewesen — auf eine FRAGE hin.
   *
   *   > Ein Wort, das die Handlung benennt, sagt nichts darueber, ob sie
   *   > gewollt ist. In einer Geldsperre ist das der teure Unterschied.
   *
   * Marcels gemessener Satz braucht es nicht: „… und ja, ich möchte die
   * Marktbreitindikation jetzt abrufen." trifft bereits ueber das „ja". */
  const _t = String(text || '').trim();
  const _jaWort = /(^|\W)(ja|jo|jep|jawohl|okay|ok|klar|gern(e)?|passt|einverstanden|mach(e)?\s+das|leg\s+los|zieh(\s+durch)?|hol(e)?\s+(sie|ihn|es|mir))(\W|$)/i
    .test(_t);
  const _neinWort = /(^|\W)(nein|nicht|kein(e|en|s)?|noch\s+nicht|sp(ä|ae)ter|warte|stopp?|abbrechen|lieber\s+nicht)(\W|$)/i
    .test(_t);
  /* v1888b · EINE FRAGE IST KEINE FREIGABE.
   * Gemessen an der Wortliste: "ok, aber was kostet das?" zaehlte als Ja —
   * das Wort "ok" steht darin, eine Verneinung nicht. Wer nach dem Preis
   * fragt, hat ihn noch nicht zugesagt. Ein Satz, der mit einem Fragezeichen
   * endet, gilt deshalb nie als Zustimmung; das VERSCHAERFT die Geldsperre
   * und kann nichts aufmachen, was vorher zu war.
   * Marcels gemessener Satz endet auf einen Punkt und bleibt ein Ja. */
  const _istFrage = /\?\s*$/.test(_t);
  const sagtJa = _jaWort && !_neinWort && !_istFrage;
  const letzteBotzeile = (((z && z.verlauf) || []).filter((e) => e.rolle !== 'user').slice(-1)[0] || {}).text || '';
  const standPreis = /kostet|Kontingent|Abruf|Guthaben|Soll ich/i.test(letzteBotzeile);
  /* ── v1821 · DIE ZUSTIMMUNG BRAUCHT EINEN GEGENSTAND ────────────────
   *
   * Bis hierher genuegte "ja" plus "irgendwo stand ein Preis". GEMESSEN:
   * der Preis galt Am Markt 9, abgerufen und abgebucht wurde Gohliser
   * Strasse 42.
   *
   *   > Eine Zustimmung ohne Gegenstand ist keine Zustimmung.
   *
   * Die Spalte `angebot` traegt das Objekt, fuer das der Preis genannt
   * wurde. Nur darauf darf sich ein "ja" beziehen, und nur 30 Minuten
   * lang — danach ist eine Zustimmung kein Bezug mehr, sondern Zufall. */
  const angebot = angebotGueltig(z && z.angebot);
  const darfKosten = sagtJa && standPreis && Boolean(angebot);
  if (sagtJa && standPreis && !angebot) {
    /* Zugestimmt, aber kein frisches Angebot: NICHT abrufen. Das ist der
       Fall, in dem bisher das falsche Objekt gerechnet wurde. */
    try {
      console.warn('[telegram v1821] Zustimmung ohne gueltiges Angebot - kein Abruf. chat=' + chatId);
    } catch (_) {}
  }

  /* ── v1887 · HAT DER NUTZER UEBERHAUPT EINE NUMMER GENANNT? ──────────
   *
   * GEMESSEN am 05.10.2026: in Marcels Dialog zur Sachsenstraße 18 stand
   * in keiner der vier Nachrichten eine Listennummer — und trotzdem galt
   * die ganze Auskunft `letzte_liste[1]`, der Löhner Str. 278. Das Modell
   * hatte sich eine Nummer gedacht (Regel 7h verbietet das ausdruecklich)
   * und das Werkzeug hat sie befolgt.
   *
   *   > Bei einem Modell gewinnt das Werkzeugschema gegen den Prompt. Was
   *   > nicht erfunden werden darf, darf nicht waehlbar sein.
   *
   * `absicht.bezug()` entscheidet deterministisch, ob im Satz wirklich
   * eine Listennummer steht ("die 3", "Objekt 5", "das erste"). Nur dann
   * darf `_findeObjekt` den Parameter `nummer` ueberhaupt ansehen; der
   * aufgeloeste Bezug steht ohnehin schon in `letztesObjekt`. */
  const nutzerNannteNummer = Boolean(bezugObjektId)
    || Boolean(z && z.letzte_liste && z.letzte_liste.length
               && absicht.bezug(text, z.letzte_liste));

  const protokoll = [];
  const ctx = {
    userId: userId,
    nummerErfunden: !nutzerNannteNummer,
    letzteListe: (z && z.letzte_liste) || null,
    letztesObjekt: bezugObjektId || (z && z.letztes_objekt) || null,
    entwurf: (z && z.modus === 'anlegen' && z.entwurf) ? _ohneMarker(z.entwurf) : null,
    protokoll: protokoll,
    merkeObjekt: function (id) { this.letztesObjekt = id; },
    /* v1809 · Legt der Agent ein Objekt an, waehrend hier eine Anlage
       laeuft, wird der Entwurf aufgeraeumt - sonst steht dieselbe Sache
       am Ende zweimal in der Datenbank. */
    anlageFertig: async function () {
      if (z && z.modus === 'anlegen') await zustandLoeschen(chatId, userId);
    },
    merkeListe: function (ids) { this.letzteListe = ids; },

    /* ── v1821 · DAS ANGEBOT GEHT MIT, UND ZWAR GESCHLOSSEN ─────────────
     *
     * `angebotObjekt` ist das Objekt, für das der Preis angesagt wurde —
     * oder null. `marktbericht_abrufen` nimmt NUR das; eine Objektangabe
     * des Modells wird bei einem kostenpflichtigen Abruf ignoriert.
     *
     *   > Was Geld kostet, darf das Modell nicht adressieren. Es darf es
     *   > vorschlagen, und der Nutzer bestätigt den Vorschlag — nicht
     *   > irgendeinen.
     *
     * `merkeAngebot` ruft die Preisansage, `angebotVerbraucht` der Abruf:
     * eine zweite Zustimmung darf denselben Abruf nicht erneut auslösen. */
    angebotObjekt: (angebot && angebot.objekt_id) || null,
    merkeAngebot: async function (id, adresse) {
      try { await angebotSetzen(chatId, userId, id, adresse); } catch (e) {}
    },
    angebotVerbraucht: async function () {
      try { await angebotLoeschen(chatId, userId); } catch (e) {}
    }
  };

  let r;
  try {
    r = await agent.laufen(text, ctx, {
      verlauf: (z && z.verlauf) || [],
      darfKosten: darfKosten
    });
  } catch (e) {
    await senden(token, chatId,
      e.code === 'NO_API_KEY'
        ? 'Mir fehlt gerade der Zugang zur KI.'
        : 'Da ist mir etwas dazwischengekommen: ' + (e.message || e));
    return;
  }

  /* Hat der Agent ein Objekt angefasst, merken wir es uns fuer "und die
     Miete?" — der Agent selbst hat keinen Zugriff auf die Datenbankzeile. */
  if (ctx.letztesObjekt && ctx.letztesObjekt !== (z && z.letztes_objekt)) {
    await objektMerken(chatId, userId, ctx.letztesObjekt);
  }
  if (ctx.letzteListe && ctx.letzteListe !== (z && z.letzte_liste)) {
    await listeMerken(chatId, userId, ctx.letzteListe, 'objekte');
  }

  const out = String(r.text || '').trim();
  if (!out) { await senden(token, chatId, 'Dazu fällt mir gerade nichts ein.'); return; }
  await sendenLang(token, chatId, out);
  await verlaufMerken(chatId, userId, 'assistant', out);

  /* ── v1887 · DAS PROTOKOLL FUEHRT SCHON DIE ARGUMENTE — DER LOG NICHT ──
   *
   * `agentLauf` legt seit v1813c zu jedem Aufruf auch die Argumente in
   * `ctx.protokoll` ab, mit der Begruendung: "Ein Protokoll, das nur das
   * Werkzeug nennt, sagt nicht, was getan wurde." Diese Zeile hier hat sie
   * trotzdem weggeworfen.
   *
   * GEMESSEN am 05.10.2026: um herauszufinden, WARUM der Bot zur falschen
   * Adresse antwortete, stand im Log nur
   *
   *     [agent] 2 Werkzeuge in 2 Runden: marktbericht_preis, objekt_schnellblick
   *
   * Welches Objekt gemeint war, liess sich nur ueber `telegram_dialog`,
   * `objects` und eine Rueckrechnung der Kennzahlen rekonstruieren.
   *
   *   > Wer die Argumente erhebt und dann nicht schreibt, hat den Aufwand
   *   > bezahlt und den Nutzen verschenkt.
   *
   * Argumente koennen keine Geheimnisse tragen: es sind Objektnummern,
   * Adressen und Stufen — dieselben Angaben, die der Nutzer selbst
   * geschrieben hat. */
  try {
    console.debug('[agent] ' + protokoll.length + ' Werkzeuge in ' + r.runden
      + ' Runden: ' + protokoll.map((p) =>
          p.werkzeug + (p.args ? '(' + String(p.args).slice(0, 120) + ')' : '')).join(', '));
  } catch (e) {}
}

function _ohneMarker(d) {
  const o = {};
  Object.keys(d || {}).forEach((k) => { if (k.indexOf('__') !== 0) o[k] = d[k]; });
  return o;
}

/* Ist das eine Frage oder eine Angabe? Entscheidet, ob eine Nachricht im
 * Anlege-Modus in die Feldextraktion geht oder an die Auskunft.
 *
 * Bewusst streng: im Zweifel ist es eine ANGABE. Wer "Baujahr 1962?"
 * tippt, meint das Baujahr, nicht eine Frage. Nur was eindeutig fragt —
 * Fragewort am Anfang oder ein Wortfeld, das es im Formular nicht gibt —
 * wird durchgereicht. */
function istFrage(text) {
  const t = String(text || '').trim();
  if (!t) return false;

  /* ── v1809 · WAR ZU STRENG ───────────────────────────────────────────
   *
   * Hier stand "Fragewort am Anfang UND laenger als 12 Zeichen". Damit
   * fiel "und die Miete?" durch (14 Zeichen, aber kein Fragewort aus der
   * Liste) und landete in der Feldextraktion.
   *
   *   > Der Ausgang war da, aber nur fuer lange Fragen offen. Wer kurz
   *   > fragt, sass fest.
   *
   * Das Fragezeichen entscheidet jetzt mit. Eine Angabe traegt selten
   * eins — und wenn doch ("Baujahr 1962?"), greift die Ausnahme darunter. */
  const mitFragezeichen = /\?\s*$/.test(t);

  /* Eine Angabe, die fragend klingt: kurz, und ueberwiegend Zahlen oder
     ein Feldwort mit Wert. "Baujahr 1962?" ist eine Angabe, keine Frage. */
  if (mitFragezeichen && t.length < 30 && /\d/.test(t)
      && !/^(wie|was|wo|wann|warum|wieso|welche|wieviel|wie viel)\b/i.test(t)) return false;

  if (mitFragezeichen) return true;
  if (/^(wie|was|wo|wann|warum|wieso|welche[rsn]?|wieviel|wie viel|kannst du|zeig|gib mir|sag mir|liste)\b/i.test(t)
      && t.length > 12) return true;
  if (/\b(portfolio|verm(ö|oe)gensbilanz|verbindlichkeit|gesamttilgung|deal ?score|marktpreis|marktwert)\b/i.test(t)) return true;
  return false;
}

/* Die Anlage abschliessen — aus `weiterFragen` herausgezogen, damit auch
   "fertig" sie auslösen kann. */
async function anlageAbschliessen(token, chatId, userId, entwurf) {
  const sauber = {};
  Object.keys(entwurf || {}).forEach((k) => { if (k.indexOf('__') !== 0) sauber[k] = entwurf[k]; });
  if (!Object.keys(sauber).length) {
    await botSagt(token, chatId, userId, 'Ich habe noch nichts, was ich anlegen könnte.');
    return null;
  }
  /* v1804 · Ueber objectService.create, nicht per eigenem INSERT.
     `objects.name` ist NOT NULL und entsteht in `extractSummary` aus
     Strasse, Hausnummer und Ort; dazu vergibt `create` atomar die
     Sequenznummer und fuellt die Summenspalten. Gemessen: der eigene
     INSERT scheiterte mit "null value in column name". */
  const erstellt = await objectService.create(userId, {
    data: sauber, aiAnalysis: null, photos: []
  });
  const r = { rows: [{ id: erstellt.id }] };
  await zustandLoeschen(chatId, userId);
  await objektMerken(chatId, userId, r.rows[0].id);
  const fo = fuehrung.fortschritt(sauber);
  await botSagt(token, chatId, userId,
    '✓ *Objekt angelegt.*\n\n'
    + (sauber.str ? sauber.str + ' ' + (sauber.hnr || '') + '\n' : '')
    + [sauber.plz, sauber.ort].filter(Boolean).join(' ')
    + '\n\n' + fo.fertig + ' von ' + fo.bloecke + ' Angabenblöcken gefüllt.'
    + (fo.offen ? ' Den Rest kannst du in DealPilot ergänzen — oder mich später fragen.' : '')
    );

  /* ── v1824 · UND DANN DIE EINSCHÄTZUNG, OHNE DASS JEMAND FRAGT ────────
   *
   * Marcel am 04.10.2026: „wir wollen ja als Erstes einen Deal-Score
   * haben … dass er dann automatisch dann eine Abfrage macht über das
   * Objekt, ob das gut oder schlecht ist."
   *
   * Hier endete der Fluss mit „Objekt angelegt" — und wer eine Bewertung
   * wollte, musste danach selbst fragen.
   *
   *   > Ein Werkzeug, das am Ziel aufhört und das Ziel nicht nennt, ist
   *   > auf halbem Weg fertig.
   *
   * Der Schnellblick rechnet nichts Neues: Bruttomietrendite,
   * Kaufpreisfaktor, Kaufnebenkosten aus der Postleitzahl. Er kostet
   * keinen Abruf. Was er NICHT liefert, ist der Score — der entsteht im
   * Browser, und das sagt er auch.
   *
   * Gerufen wird über den Agenten, nicht direkt: er formatiert die Zahlen
   * und stellt die Folgefragen (Vorgaben hinterlegen? Marktpreis-
   * indikation?). Eine zweite Formatierung hier wäre eine Dublette. */
  try {
    await agentAntwort(token, chatId, userId,
      'Das Objekt ist gerade angelegt. Gib mir dazu den Schnellblick.',
      null, r.rows[0].id);
  } catch (e) {
    /* Die Einschätzung ist eine Zugabe. Fällt sie aus, bleibt das Objekt
       angelegt — das ist die Hauptsache und schon gemeldet. */
    try { console.warn('[telegram v1824] Schnellblick nach Anlage fehlgeschlagen: '
      + (e && e.message)); } catch (_) {}
  }
  return r.rows[0].id;
}

/* ── Anlegen: locker beginnen, nicht mit einem Formular ──────────────────
 *
 * Marcel: "Bitte leg mir ein Objekt an und dann gibt es eine rueckantwort
 * und die sagt sag mir welches Objekt und ich fange dann an eine
 * Sprachnachricht zu erzeugen."
 *
 * Also KEIN sofortiges "Etappe 1 von 6: Wo steht das Objekt?". Erst die
 * offene Frage — wer schon etwas erzaehlt hat, soll nicht bei null
 * anfangen muessen.
 */
async function anlegenStarten(token, chatId, userId, text) {
  /* Stand im Satz schon etwas? "leg mir die Hermannstr. 9 in Huellhorst an"
     ist bereits die halbe Antwort — die wegzuwerfen und dann danach zu
     fragen waere unhoeflich und langsam. */
  let schonDa = {};
  const roh = String(text || '').replace(/^\s*\/neu\b/i, '').trim();
  const lohnt = roh.length > 25 && /\d/.test(roh);
  if (lohnt) {
    try {
      const r = await voiceExtract.extractFromText(roh, fuehrung.katalog(), {
        /* v1800 · `inserat` statt `antwort`: wer "leg mir eine ETW in der
           Musterstr. 12 in Hannover an, 85 qm, vier Zimmer, 2. OG,
           vermietet" sagt, liefert einen Fliesstext, keine Antwort auf
           eine Frage. Siehe die Begruendung in `aufnehmen`. */
        apiKey: config.openai.apiKey, modus: 'inserat'
      });
      schonDa = (r && r.fields) || {};
    } catch (e) { schonDa = {}; }
  }

  await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: {} });

  if (Object.keys(schonDa).length) {
    await botSagt(token, chatId, userId, '*Neues Objekt* — das hast du mir schon gesagt:');
    await aufnehmenFelder(token, chatId, userId, schonDa, {});
    return;
  }

  await botSagt(token, chatId, userId,
    '*Neues Objekt.* Erzähl mir davon — am liebsten als Sprachnachricht: '
    + 'Adresse, Art, Größe, Baujahr, Kaufpreis, Miete. Was du gerade weißt.\n\n'
    + 'Du kannst auch ein *Foto* vom Exposé schicken oder einfach tippen. '
    + 'Was fehlt, frage ich danach Schritt für Schritt nach.\n\n'
    + '_/abbrechen beendet jederzeit._');
}

/* ── Der Gespraechszustand ───────────────────────────────────────────── */
async function zustand(chatId, userId) {
  const r = await query(
    `SELECT modus, entwurf, offene_ids, letzte_frage, objekt_id,
            letzte_liste, letzte_liste_art, letztes_objekt, verlauf,
            angebot            /* v1821 · wofuer der Preis angesagt wurde */
       FROM telegram_dialog WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId]);
  return r.rows[0] || null;
}

/* v1798 · `zustandSetzen` schreibt die Anlage-Felder. Das GEDAECHTNIS
   (Liste, letztes Objekt, Verlauf) wird getrennt gepflegt — sonst wuerde
   jedes `zustandSetzen` beim Anlegen die Liste loeschen, auf die sich der
   naechste Satz bezieht.

   > Zwei Dinge, die verschieden lange leben, duerfen nicht an einem
   > Schalter haengen. */
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

/* ── v1821 · DAS ANGEBOT: WOFÜR DER PREIS ANGESAGT WURDE ────────────────
 *
 * GEMESSEN am 04.10.2026 an Marcels Dialog: der Preis galt „Am Markt 9",
 * abgerufen und abgebucht wurde „Gohliser Straße 42".
 *
 *   > Die Geldsperre fragt, ob zugestimmt wurde. Sie fragt nicht, wozu.
 *   > Eine Zustimmung ohne Gegenstand ist keine Zustimmung.
 *
 * `marktbericht_preis` legt hier ab, für welches Objekt und welche Stufen
 * der Preis genannt wurde. `marktbericht_abrufen` nimmt AUSSCHLIESSLICH
 * dieses Objekt — auch wenn das Modell etwas anderes mitgibt.
 *
 * DIE FRIST: ein Angebot gilt 30 Minuten. Danach ist ein „ja" kein Bezug
 * mehr, sondern ein Zufall.
 */
const ANGEBOT_FRIST_MS = 30 * 60 * 1000;

async function angebotSetzen(chatId, userId, objektId, adresse) {
  await zeileSichern(chatId, userId);
  await query(
    `UPDATE telegram_dialog SET angebot = $3::jsonb, aktualisiert = now()
      WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId,
     JSON.stringify({ objekt_id: objektId, adresse: adresse || null,
                      zeit: new Date().toISOString() })]);
}

async function angebotLoeschen(chatId, userId) {
  await query(
    `UPDATE telegram_dialog SET angebot = NULL, aktualisiert = now()
      WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId]);
}

/** Ist das Angebot noch frisch? Gibt die Objekt-Id zurück oder null. */
function angebotGueltig(a) {
  if (!a || !a.objekt_id) return null;
  const t = Date.parse(a.zeit || '');
  if (!Number.isFinite(t)) return null;
  if (Date.now() - t > ANGEBOT_FRIST_MS) return null;
  return a;
}

/* Die Zeile muss existieren, bevor das Gedaechtnis sie fortschreibt. */
async function zeileSichern(chatId, userId) {
  await query(
    `INSERT INTO telegram_dialog (chat_id, bot_user_id) VALUES ($1::bigint, $2)
     ON CONFLICT (chat_id, bot_user_id) DO NOTHING`,
    [String(chatId), userId]);
}

async function listeMerken(chatId, userId, ids, art) {
  await zeileSichern(chatId, userId);
  await query(
    `UPDATE telegram_dialog SET letzte_liste = $3, letzte_liste_art = $4, aktualisiert = now()
      WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId, ids, art || 'objekte']);
}

async function objektMerken(chatId, userId, objektId) {
  if (!objektId) return;
  await zeileSichern(chatId, userId);
  await query(
    `UPDATE telegram_dialog SET letztes_objekt = $3, aktualisiert = now()
      WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId, objektId]);
}

/* Der Verlauf ist auf 12 Wortwechsel gedeckelt — dieselbe Zahl wie im
   Browser-Co-Piloten, damit das Modell beide Male gleich viel Faden hat. */
async function verlaufMerken(chatId, userId, rolle, text) {
  if (!text) return;
  await zeileSichern(chatId, userId);
  await query(
    `UPDATE telegram_dialog
        SET verlauf = (
              CASE WHEN jsonb_array_length(verlauf) >= 12
                   THEN verlauf - 0 ELSE verlauf END
            ) || jsonb_build_object('rolle', $3::text, 'text', $4::text),
            aktualisiert = now()
      WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId, rolle, String(text).slice(0, 1200)]);
}
async function zustandLoeschen(chatId, userId) {
  await query(`DELETE FROM telegram_dialog WHERE chat_id = $1::bigint AND bot_user_id = $2`,
    [String(chatId), userId]);
}

/* ── Eine Antwort aufnehmen ──────────────────────────────────────────────
 *
 * Der Text geht an `extractFromText` — DENSELBEN Dienst, den der Sprechlauf
 * im Browser nutzt. Der Feldkatalog kommt aus den extrahierten
 * Frontend-Konstanten, nicht aus einer Liste in dieser Datei.
 */
async function aufnehmen(token, chatId, userId, text, entwurf) {
  let neu = {};
  try {
    /* ── v1800 · DER MODUS WAR FALSCH ───────────────────────────────────
     *
     * Hier stand `modus: 'antwort'`. Der ist fuer die Antwort auf EINE
     * Frage gebaut ("Baujahr und Kaufpreis?" -> "1962, 189000") und hat
     * einen eigenen Prompt (`ZUSATZ_ANTWORT`) sowie 4.000 Zeichen Deckel.
     *
     * Marcel am 02.10.2026: "habe ihm dann auch die Groesse und schon
     * mehrere Daten genannt und dann hat er die Haelfte ignoriert."
     *
     * Genau das war die Ursache. Ein Fliesstext mit zehn Angaben gehoert
     * in `inserat` — eigener Prompt (`ZUSATZ_INSERAT`), 40.000 Zeichen.
     *
     *   > Ein Modus, der fuer eine Antwort gebaut ist, liest auch nur
     *   > eine. Er meldet dabei keinen Fehler: was er nicht erwartet,
     *   > taucht einfach nicht auf.
     *
     * Die Entscheidung faellt am Text: mehrere Angaben erkennt man an
     * Laenge und Zahlen. Eine knappe Antwort auf eine knappe Frage bleibt
     * bei `antwort`, wo dieser Modus staerker ist. */
    const vieles = String(text || '').trim().length > 60
                || (String(text || '').match(/\d+/g) || []).length >= 3;
    const r = await voiceExtract.extractFromText(text, fuehrung.katalog(), {
      apiKey: config.openai.apiKey,
      modus: vieles ? 'inserat' : 'antwort',
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
    await botSagt(token, chatId, userId,
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
  if (erkannt.length) await botSagt(token, chatId, userId, 'Notiert:\n' + erkannt.join('\n'));

  await weiterFragen(token, chatId, userId, zusammen);
}

/* ── Die naechste Frage stellen ───────────────────────────────────────── */
async function weiterFragen(token, chatId, userId, entwurf, zuletztOffen) {
  /* v1800 · Uebersprungene Bloecke nicht sofort wieder anbieten. Wer
     "weiss ich nicht" sagt, soll nicht dieselbe Frage nochmal bekommen —
     das ist der Unterschied zwischen Fuehrung und Verhoer. */
  const uebersprungen = Object.keys(entwurf || {})
    .filter((k) => k.indexOf('__uebersprungen_') === 0)
    .map((k) => k.replace('__uebersprungen_', ''));

  const alle = fuehrung.luecken(entwurf, { modus: 'anlegen' });
  const naechste = alle.find((b) => !b.ids.every((id) => uebersprungen.indexOf(id) >= 0))
                || null;
  const fo = fuehrung.fortschritt(entwurf);

  if (!naechste) {
    await anlageAbschliessen(token, chatId, userId, entwurf);
    return null;
  }

  await zustandSetzen(chatId, userId, {
    modus: 'anlegen', entwurf: entwurf,
    offene_ids: naechste.ids.filter((id) => !fuehrung.gefuellt(entwurf, id)),
    letzte_frage: naechste.frage
  });

  const et = fuehrung.etappe(naechste.et);
  /* Bei Auswahlfeldern die Moeglichkeiten gleich mitgeben — fragen und
     dann die Antwort nicht zuordnen koennen ist eine Runde zu viel. */
  const wahl = [];
  naechste.ids.forEach((id) => {
    const f = fuehrung.feld(id);
    if (f && f.kind === 'select' && f.optionen && f.optionen.length && f.optionen.length <= 12) {
      wahl.push('*' + (f.label || id) + '*: ' + f.optionen.map((o) => o.text || o.wert).join(' · '));
    }
  });

  await botSagt(token, chatId, userId,
    (et ? '_Etappe ' + et.nr + ' von 6 · ' + et.name + '_\n\n' : '')
    + naechste.frage
    + (wahl.length ? '\n\n' + wahl.join('\n') : '')
    + '\n\n_' + fo.fertig + ' von ' + fo.bloecke + ' erledigt · '
    + '„weiter" überspringt · „fertig" legt an · /abbrechen beendet_');
  return null;
}

/* ── Die Auskunft ────────────────────────────────────────────────────────
 *
 * Drei Wege, und keiner davon rechnet: Objektliste aus `objects`, Portfolio
 * aus dem Spiegel, und fuer alles Uebrige derselbe `copilotChat`, den auch
 * der Browser ruft.
 */
async function beantworten(token, chatId, userId, text, msg) {
  /* ── v1809 · EIN WEG, NICHT ZWEI ─────────────────────────────────────
   *
   * Nach dem Umbau auf den Agenten (v1801) lagen hier ZWEI Fassungen
   * nebeneinander: die alte Musterweiche und der Agent. Beim Nachmessen
   * am 02.10.2026 kam heraus, was das anrichtet:
   *
   *   - Der richtige Marktpreis-Aufruf war TOT, der kaputte lebte: er
   *     bekam die Listennummer nicht und suchte nach einer Hausnummer 17.
   *   - Ein Marktpreis-Satz waehrend einer Anlage VERNICHTETE den Entwurf.
   *   - Die Adress-Rueckbestaetigung galt nur auf einem der beiden Wege —
   *     wer anders formulierte, umging genau die Sicherung, die gegen
   *     Sprachfehler gebaut war.
   *   - Rund 200 Zeilen waren nur noch ueber die Tuer "abbrechen ohne
   *     Schraegstrich" erreichbar.
   *
   *   > Zwei Wege zu derselben Sache sind nicht doppelt sicher. Einer
   *   > davon ist der, auf dem die Fehler sitzen, und niemand weiss,
   *   > welcher.
   *
   * Jetzt gilt: der Webhook fuehrt den ZUSTAND (Anlage, Bestaetigungen)
   * und reicht alles andere an den Agenten. Was eine Entscheidung
   * braucht, entscheidet das Modell mit Werkzeugen; was einen Zustand
   * braucht, steht hier.
   */
  const z = await zustand(chatId, userId);

  /* ── Befehle, die immer gelten ───────────────────────────────────── */
  if (/^\/abbrechen|^(abbrechen|abbruch|vergiss es|lass gut sein)\b/i.test(text.trim())) {
    if (z && z.modus) {
      await zustandLoeschen(chatId, userId);
      await senden(token, chatId, 'Abgebrochen. Der Entwurf ist verworfen.');
    } else {
      await senden(token, chatId, 'Es läuft gerade nichts, was ich abbrechen könnte.');
    }
    return;
  }

  /* ── Bestaetigungen: hier haengt Geld und hier haengen Daten ──────── */
  if (z && z.modus === 'adresse_bestaetigen') {
    if (/^(ja|passt|stimmt|korrekt|richtig|j)\b/i.test(text.trim())) {
      await weiterFragen(token, chatId, userId, z.entwurf);
      return;
    }
    if (/^(nein|falsch|n)\b/i.test(text.trim())) {
      const e = Object.assign({}, z.entwurf);
      ['str', 'hnr', 'plz', 'ort'].forEach((id) => { delete e[id]; });
      delete e.__adr_ok;
      await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: e });
      await botSagt(token, chatId, userId, 'Gut — dann nochmal: Straße, Hausnummer, PLZ und Ort?');
      return;
    }
    /* Keine klare Antwort: als Korrektur der Adresse lesen. */
    await aufnehmen(token, chatId, userId, text, z.entwurf);
    return;
  }

  /* ── Die gefuehrte Anlage ─────────────────────────────────────────── */
  if (z && z.modus === 'anlegen') {
    if (/^(weiter|n(ä|ae)chste|ueberspringen|überspringen|skip|wei(ss|ß) ich nicht|keine ahnung|sp(ä|ae)ter)\b/i.test(text.trim())) {
      const e = Object.assign({}, z.entwurf || {});
      (z.offene_ids || []).forEach((id) => { if (e[id] == null) e['__uebersprungen_' + id] = true; });
      await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: e });
      await weiterFragen(token, chatId, userId, e);
      return;
    }
    if (/^(fertig|speichern|anlegen|das war'?s|das wars|reicht)\b/i.test(text.trim())) {
      await anlageAbschliessen(token, chatId, userId, z.entwurf || {});
      return;
    }
    /* Eine Frage ist keine Antwort. Sie geht an den Agenten, der Entwurf
       bleibt stehen — und danach geht es weiter, wo es war.

       v1809: istFrage war zu streng (Fragewort UND Laenge > 12), "und
       die Miete?" fiel durch. Jetzt entscheidet das Fragezeichen mit. */
    if (istFrage(text)) {
      await agentAntwort(token, chatId, userId, text, z, null);
      const offen = fuehrung.naechsteFrage(_ohneMarker(z.entwurf || {}), { modus: 'anlegen' });
      if (offen) await botSagt(token, chatId, userId, '_Zurück zur Anlage:_ ' + offen.frage);
      return;
    }
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

    /* ── v1822 · KEIN SONDERFALL MEHR ──────────────────────────────────
     *
     * Hier stand bis v1821 ein Zweig „läuft eine Anlage? dann direkt in
     * den Feld-Extraktor". Der war überflüssig UND schädlich.
     *
     * ÜBERFLÜSSIG, weil der Textweg jeden Zustand selbst behandelt:
     * `anlegen` ruft `aufnehmen()`, `adresse_bestaetigen` prüft ja/nein,
     * alles andere geht an den Agenten. Ein zweiter Verteiler daneben
     * verdoppelt die Entscheidung.
     *
     * SCHÄDLICH, weil er nur `anlegen` kannte. Während der
     * ADRESSBESTÄTIGUNG landete eine Sprachnachricht am Agenten statt in
     * der ja/nein-Prüfung — und Marcel bestätigt per Sprache. Genau das
     * hat er am 04.10.2026 beschrieben: „sagt mir ständig fehlende
     * Angaben … zeigt aber das, was ich gesagt habe und dass das noch
     * bestätigt werden muss."
     *
     *   > Ein Sonderfall, der einen Zustand kennt und die anderen nicht,
     *   > ist schlimmer als keiner. Er funktioniert in dem Fall, den sein
     *   > Autor im Kopf hatte, und bricht in allen übrigen.
     *
     * Jetzt wird AUSNAHMSLOS transkribiert und an den Textweg gegeben.
     * Ein Weg, ein Verteiler. */

    /* ── v1818 · TRANSKRIBIEREN UND WIE TEXT BEHANDELN ─────────────────
     *
     * Marcel am 04.10.2026: "Ich sage dem Bot, wie viele Objekte habe ich
     * im Portfolio und er antwortet ständig, daraus konnte ich kein Feld
     * lesen, sag gerne Adresse, Fläche, Baujahr und Kaufpreis dazu."
     *
     * Hier stand: jede Sprachnachricht geht in den Feld-Extraktor. Der
     * Kommentar daneben nannte die Fehlannahme selbst — "eine
     * Sprachnachricht mit Objektdaten IST der Wunsch, eines anzulegen".
     * Mit Objektdaten, ja. Aber das stand nicht in der Bedingung; dort
     * stand nur "ist Audio". Marcel diktiert, also traf es ihn bei JEDER
     * Frage.
     *
     *   > Der Kanal sagt nichts über die Absicht. Wer aus "das kam als
     *   > Sprachnachricht" schließt "das soll ein Objekt werden", hat die
     *   > Frage nie gelesen.
     *
     * UND DER AGENT HAT DIESE NACHRICHTEN NIE GESEHEN. Es war gleichgültig,
     * wie gut er wurde — der Pfad davor nahm sie ihm weg.
     *
     *   > Ein Schnellpfad, der vor dem Verstehen entscheidet, macht jedes
     *   > Verstehen danach wertlos.
     *
     * Jetzt wird nur TRANSKRIBIERT. Danach läuft das Transkript durch
     * dieselbe Funktion wie getippter Text: derselbe Agent, dieselben
     * Werkzeuge, dieselben Schnellpfade. Eine Frage wird beantwortet,
     * Objektdaten werden angelegt — die Absicht erkennt der Agent, nicht
     * der Kanal.
     *
     * Der rekursive Aufruf kann nicht kreisen: voice und audio sind
     * entfernt, die Nachricht ist von hier an eine Textnachricht. */
    let gehoert = '';
    try {
      gehoert = await voiceExtract.transcribe(
        Buffer.from(b64, 'base64'), mime, config.openai.apiKey);
    } catch (e) {
      await senden(token, chatId, 'Ich konnte die Aufnahme nicht verstehen: '
        + (e.message || e) + ' Schreib es mir gern.');
      return;
    }
    gehoert = String(gehoert || '').trim();
    if (!gehoert) {
      await senden(token, chatId, 'Da war nichts zu hören. Sprich gern noch einmal '
        + '— oder schreib es mir.');
      return;
    }
    await senden(token, chatId, 'Verstanden: _' + gehoert.slice(0, 400) + '_');
    return beantworten(token, chatId, userId, gehoert,
      Object.assign({}, msg, { text: gehoert, voice: null, audio: null }));
  }
  /* ── Foto ─────────────────────────────────────────────────────────────
   *
   * Ein abfotografiertes Exposé, ein Screenshot aus einem Portal. Das Bild
   * geht durch `bildZuText` und von dort in DENSELBEN `extractFromText`,
   * den auch Sprache und Tastatur durchlaufen — es gibt keinen dritten
   * Auslese-Weg.
   *
   * PDFs kann der Bot nicht: im Backend liegt kein PDF-Leser (gemessen,
   * die Umwandlung macht im Browser pdf.js). Das wird gesagt, nicht
   * verschwiegen. */
  if (msg && (msg.photo || msg.document)) {
    const istBild = Boolean(msg.photo)
      || (msg.document && /^image\//.test(msg.document.mime_type || ''));
    if (!istBild) {
      await senden(token, chatId,
        'Dokumente kann ich hier noch nicht lesen — ein *Foto* der Seite geht '
        + 'aber. In DealPilot selbst kannst du PDFs hochladen, dort werden sie '
        + 'ausgelesen.');
      return;
    }
    /* Telegram liefert mehrere Groessen; die letzte ist die groesste. */
    const bild = msg.photo ? msg.photo[msg.photo.length - 1] : msg.document;
    await senden(token, chatId, 'Ich schau mir das Bild an …');
    let datenUrl;
    try {
      const f = await tgGet(token, 'getFile', { file_id: bild.file_id });
      const r = await fetch('https://api.telegram.org/file/bot' + token + '/' + f.file_path);
      if (!r.ok) throw new Error('Download fehlgeschlagen (HTTP ' + r.status + ')');
      const buf = Buffer.from(await r.arrayBuffer());
      const mime = (msg.document && msg.document.mime_type) || 'image/jpeg';
      datenUrl = 'data:' + mime + ';base64,' + buf.toString('base64');
    } catch (e) {
      await senden(token, chatId, 'Das Bild kam nicht durch: ' + (e.message || e));
      return;
    }

    let gelesen = '';
    try {
      gelesen = await openai.bildZuText(datenUrl, {});
    } catch (e) {
      await senden(token, chatId, 'Beim Lesen ist etwas schiefgegangen: ' + (e.message || e));
      return;
    }
    if (!gelesen) {
      await senden(token, chatId,
        'Auf dem Bild finde ich nichts, was zu einem Objekt gehört.');
      return;
    }

    await senden(token, chatId, 'Gelesen:\n_' + gelesen.slice(0, 600) + '_');

    const z0 = await zustand(chatId, userId);
    const entwurf = (z0 && z0.modus && z0.entwurf) || {};
    if (!z0 || !z0.modus) {
      await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: {} });
      await senden(token, chatId, '*Ich lege daraus ein Objekt an.*');
    }
    await aufnehmen(token, chatId, userId, gelesen, entwurf);
    return;
  }

  if (!text) return;

  await verlaufMerken(chatId, userId, 'user', text);

  /* ── v1798 · ZUERST DER BEZUG, DANN DIE ABSICHT ───────────────────────
   *
   * "Objekt 17 davon" meint die 17 aus der Liste, die eine Nachricht
   * vorher kam. Das muss aufgeloest sein, BEVOR irgendetwas anderes
   * entschieden wird — sonst sucht die Objektzuordnung nach einem Haus
   * mit der Nummer 17.
   *
   *   > Eine Zahl, die sich auf eine Liste bezieht, ist keine Hausnummer.
   *   > Wer das verwechselt, antwortet zum falschen Objekt — und die
   *   > Antwort sieht dabei richtig aus. */
  let bezugObjektId = null;
  if (z && z.letzte_liste && z.letzte_liste.length) {
    const b = absicht.bezug(text, z.letzte_liste);
    if (b && b.fehler === 'ausserhalb') {
      await senden(token, chatId,
        'Die Liste hat ' + b.laenge + ' Einträge — eine ' + b.genannt
        + ' gibt es darin nicht.');
      return;
    }
    if (b && b.id) bezugObjektId = b.id;
  }

  const was = absicht.erkenne(text);

  /* ── v1809 · NUR NOCH DREI SCHNELLPFADE ──────────────────────────────
   *
   * Die Liste und die Hilfe sind haeufig, eindeutig und kosten nichts — ein
   * Modellaufruf dafuer waere nur langsamer. Das Anlegen startet einen
   * ZUSTAND, und der gehoert in den Webhook, nicht ins Modell.
   *
   * Alles andere geht an den Agenten. Auch Marktpreis, Score und
   * Portfolio: dort beginnen die Rueckfragen, und genau die konnte die
   * Musterweiche nie. */
  if (was.art === 'liste') {
    const liste = await dialog.objekteListe(userId, 40);
    if (!liste.length) {
      await botSagt(token, chatId, userId, 'Ich sehe noch keine Objekte in deinem Konto.');
      return;
    }
    await listeMerken(chatId, userId, liste.map((o) => o.id), 'objekte');
    const zeilen = liste.map((o, i) => (i + 1) + '. *' + (o.adresse || 'ohne Adresse') + '*'
      + (o.kp ? ' · ' + Number(o.kp).toLocaleString('de-DE') + ' €' : ''));
    await sendenLang(token, chatId,
      '*Deine Objekte* (' + liste.length + ')' + '\n\n' + zeilen.join('\n')
      + '\n\n_Frag mich zu einem davon — Adresse oder einfach die Nummer._');
    await verlaufMerken(chatId, userId, 'assistant',
      'Nummerierte Liste mit ' + liste.length + ' Objekten gezeigt.');
    return;
  }

  if (was.art === 'hilfe') { await botSagt(token, chatId, userId, HILFE); return; }

  if (was.art === 'anlegen') { await anlegenStarten(token, chatId, userId, text); return; }

  await agentAntwort(token, chatId, userId, text, z, bezugObjektId);
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
