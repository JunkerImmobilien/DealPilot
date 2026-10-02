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
const markt = require('../services/telegramMarktService');
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
  const sagtJa = /^(ja|jo|jep|ok|okay|mach|los|gern|bitte|passt|einverstanden|hol|zieh)\b/i
    .test(String(text || '').trim());
  const letzteBotzeile = (((z && z.verlauf) || []).filter((e) => e.rolle !== 'user').slice(-1)[0] || {}).text || '';
  const standPreis = /kostet|Kontingent|Abruf|Guthaben|Soll ich/i.test(letzteBotzeile);
  const darfKosten = sagtJa && standPreis;

  const protokoll = [];
  const ctx = {
    userId: userId,
    letzteListe: (z && z.letzte_liste) || null,
    letztesObjekt: bezugObjektId || (z && z.letztes_objekt) || null,
    entwurf: (z && z.modus === 'anlegen' && z.entwurf) ? _ohneMarker(z.entwurf) : null,
    protokoll: protokoll,
    merkeObjekt: function (id) { this.letztesObjekt = id; },
    merkeListe: function (ids) { this.letzteListe = ids; }
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

  try {
    console.debug('[agent] ' + protokoll.length + ' Werkzeuge in ' + r.runden
      + ' Runden: ' + protokoll.map((p) => p.werkzeug).join(', '));
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
  if (/^(wie|was|wo|wann|warum|wieso|welche[rsn]?|wieviel|wie viel|kannst du|zeig|gib mir|sag mir|liste)\b/i.test(t)
      && t.length > 12) return true;
  if (/\b(portfolio|verm(ö|oe)gensbilanz|verbindlichkeit|gesamttilgung|deal ?score|marktpreis)\b/i.test(t)) return true;
  return false;
}

/* Die Anlage abschliessen — aus `weiterFragen` herausgezogen, damit auch
   "fertig" sie auslösen kann. */
async function anlageAbschliessen(token, chatId, userId, entwurf) {
  const sauber = {};
  Object.keys(entwurf || {}).forEach((k) => { if (k.indexOf('__') !== 0) sauber[k] = entwurf[k]; });
  if (!Object.keys(sauber).length) {
    await senden(token, chatId, 'Ich habe noch nichts, was ich anlegen könnte.');
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
  await senden(token, chatId,
    '✓ *Objekt angelegt.*\n\n'
    + (sauber.str ? sauber.str + ' ' + (sauber.hnr || '') + '\n' : '')
    + [sauber.plz, sauber.ort].filter(Boolean).join(' ')
    + '\n\n' + fo.fertig + ' von ' + fo.bloecke + ' Angabenblöcken gefüllt.'
    + (fo.offen ? ' Den Rest kannst du in DealPilot ergänzen — oder mich später fragen.' : '')
    );
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
    await senden(token, chatId, '*Neues Objekt* — das hast du mir schon gesagt:');
    await aufnehmenFelder(token, chatId, userId, schonDa, {});
    return;
  }

  await senden(token, chatId,
    '*Neues Objekt.* Erzähl mir davon — am liebsten als Sprachnachricht: '
    + 'Adresse, Art, Größe, Baujahr, Kaufpreis, Miete. Was du gerade weißt.\n\n'
    + 'Du kannst auch ein *Foto* vom Exposé schicken oder einfach tippen. '
    + 'Was fehlt, frage ich danach Schritt für Schritt nach.\n\n'
    + '_/abbrechen beendet jederzeit._');
}

/* ── DealScore und Investor Deal Score ───────────────────────────────────
 *
 * Beide werden im Browser gerechnet und am Objekt PERSISTIERT. Der Bot
 * liest sie, er rechnet sie nicht nach — dieselbe Regel wie beim
 * Portfolio-Spiegel.
 *
 *   > Ein zweiter Score waere eine zweite Meinung ueber denselben Deal.
 *   > Davon darf es keine geben, sonst steht im Chat eine andere Zahl als
 *   > auf der Karte.
 */
async function scoreAuskunft(token, chatId, userId, text, bezugObjektId, z) {
  let objektId = bezugObjektId;
  if (!objektId) {
    const liste = await dialog.objekteListe(userId, 60);
    const t = dialog.objektRaten(text, liste);
    if (t.art === 'mehrdeutig') {
      await listeMerken(chatId, userId, t.kandidaten.map((o) => o.id), 'kandidaten');
      await senden(token, chatId, 'Für welches Objekt?\n\n'
        + t.kandidaten.map((o, i) => (i + 1) + '. ' + o.adresse).join('\n'));
      return;
    }
    if (t.art === 'eindeutig') objektId = t.objekt.id;
    else if (z && z.letztes_objekt) objektId = z.letztes_objekt;
    else if (liste.length === 1) objektId = liste[0].id;
  }
  if (!objektId) {
    await senden(token, chatId,
      'Für welches Objekt? Nenn mir die Adresse oder die Nummer aus der Liste.');
    return;
  }

  const o = await dialog.objektKontext(userId, objektId);
  if (!o) { await senden(token, chatId, 'Das Objekt finde ich nicht.'); return; }
  await objektMerken(chatId, userId, objektId);

  const s = dialog.scoreLesen(o.daten);
  const adr = [o.daten.str, o.daten.hnr].filter(Boolean).join(' ')
            + (o.daten.ort ? ', ' + o.daten.ort : '');

  if (!s.dealscore && !s.investor) {
    /* Nicht raten, nicht rechnen — den Weg nennen. */
    await senden(token, chatId,
      'Für *' + (adr || 'dieses Objekt') + '* liegt mir noch kein Score vor.\n\n'
      + 'Er entsteht in DealPilot, sobald die Grundfelder stehen — Kaufpreis, '
      + 'Miete, Finanzierung. Öffne das Objekt dort einmal, dann kann ich ihn '
      + 'dir hier nennen.');
    return;
  }

  let txt = '*' + (adr || 'Objekt') + '*\n';
  if (s.dealscore != null) {
    txt += '\nDealScore: *' + s.dealscore + '* von 100'
         + (s.stufe ? ' · ' + s.stufe : '');
  }
  if (s.investor != null) {
    txt += '\nInvestor Deal Score: *' + s.investor + '*'
         + (s.investorStufe ? ' · ' + s.investorStufe : '');
  }
  if (s.weitere && s.weitere.length) {
    txt += '\n\n' + s.weitere.map((w) => '• ' + w.name + ': *' + w.wert + '*').join('\n');
  }
  txt += '\n\n_Gerechnet in DealPilot — ich lese den gespeicherten Wert._';
  await senden(token, chatId, txt);
}

/* ── Marktpreisindikation ────────────────────────────────────────────────
 *
 * Zwei Schritte, immer in dieser Reihenfolge: ansagen, dann abrufen. Der
 * Voranschlag kostet nichts und nennt Modus, Preis, Bestand und fehlende
 * Pflichtangaben.
 */
async function marktpreisAnbieten(token, chatId, userId, text, bezugObjektId) {
  let objekt = null;
  if (bezugObjektId) {
    objekt = await dialog.objektKontext(userId, bezugObjektId);
  } else {
    const liste = await dialog.objekteListe(userId, 60);
    const t = dialog.objektRaten(text, liste);
    if (t.art === 'mehrdeutig') {
      await listeMerken(chatId, userId, t.kandidaten.map((o) => o.id), 'kandidaten');
      await senden(token, chatId, 'Für welches Objekt?\n\n'
        + t.kandidaten.map((o, i) => (i + 1) + '. ' + o.adresse).join('\n')
        + '\n\n_Nenn mir die Adresse oder einfach die Nummer._');
      return;
    }
    if (t.art === 'eindeutig') objekt = await dialog.objektKontext(userId, t.objekt.id);
    else if (liste.length === 1) objekt = await dialog.objektKontext(userId, liste[0].id);
  }
  if (!objekt) {
    await senden(token, chatId,
      'Für welches Objekt? Nenn mir die Adresse oder die Nummer — /objekte zeigt die Liste.');
    return;
  }
  await objektMerken(chatId, userId, objekt.objekt_id);

  const d = objekt.daten || {};
  /* v1795c · HIER STANDEN ENGLISCHE FELDNAMEN (postCode, city, livingArea).
     GEMESSEN an `missingFields` in avm.js:122: der Abruf erwartet DEUTSCHE
     Namen, und zwar fast dieselben, die das Objekt ohnehin traegt —
     plz, ort, str, hnr, objektart, wfl.

     Folge der Annahme: der Voranschlag meldete "fehlende Felder: PLZ, Ort,
     Objektart, Wohnflaeche" fuer ein Objekt, dessen Adresse vollstaendig
     dasteht ("Musterstrasse 12, 04109 Leipzig"). Kein Fehler, keine
     Warnung — nur vier Felder, die es zu kennen glaubte und nicht fand.

     > Feldnamen werden nie angenommen, sondern an der Gegenstelle
     > ausgelesen. Eine Zuordnung, die daneben greift, meldet nichts: sie
     > findet einfach nichts.

     Einzige echte Abweichung: das Objekt fuehrt `objart`, der Abruf will
     `objektart`. */
  const inputs = {
    plz: d.plz || '', ort: d.ort || '', str: d.str || '', hnr: d.hnr || '',
    objektart: d.objektart || d.objart || '', wfl: d.wfl || '',
    baujahr: d.baujahr || '', zimmer: d.zimmer || ''
  };

  /* ── v1798 · WELCHE STUFE? ────────────────────────────────────────────
   *
   * Marcel: "ich kann auch eine marktpreisindikation oder eine erweiterte
   * Marktpreisindikation abrufen".
   *
   *   1  mpi       Lage und Preisspanne
   *   2  mpi_plus  zusaetzlich Zustand und Qualitaet
   *
   * Hier stand bis v1798 der AVM-Fremdabruf (sprengnetter). Der ist etwas
   * ANDERES und als Produkt stillgelegt: `config.js:474` nahm `avm_a` und
   * `avm_b` am 11.09.2026 aus der Preisliste, der Kaufweg ist zu, und
   * gemessen stehen beide Baenke bei 0. Der Bot haette also zuverlaessig
   * "Guthaben aufgebraucht" gemeldet.
   *
   *   > Ein Abrufweg, den es als Produkt nicht mehr gibt, ist kein
   *   > Fallback. Er ist eine Sackgasse mit freundlicher Fehlermeldung. */
  const willErweitert = /\b(erweitert|ausf(ü|ue)hrlich|gross|gro(ß|ss)|plus|genauer|detailliert)\b/i.test(text || '');
  const stufe = willErweitert ? 2 : 1;

  /* Pflichtangaben prueft der Marktbericht selbst — aber was ihm fehlt,
     soll der Nutzer vorher wissen, nicht erst nach dem Abruf. */
  const fehlt = [];
  if (!d.plz && !d.ort) fehlt.push('PLZ oder Ort');
  if (!d.objektart && !d.objart) fehlt.push('Objektart');
  if (!d.wfl) fehlt.push('Wohnfläche');
  if (fehlt.length) {
    await senden(token, chatId,
      'Für eine Indikation fehlen mir noch Angaben:\n'
      + fehlt.map((f) => '• ' + f).join('\n')
      + '\n\nSag sie mir einfach, dann hole ich sie ab.');
    return;
  }

  let v;
  try {
    v = await markt.voranschlag(userId, objekt.objekt_id, stufe);
  } catch (e) {
    await senden(token, chatId, 'Der Voranschlag ging nicht: ' + (e.message || e));
    return;
  }
  if (!v.moeglich) { await senden(token, chatId, v.grund); return; }

  await zustandSetzen(chatId, userId, {
    modus: 'marktpreis_bestaetigen',
    entwurf: { __stufe: v.stufe },
    objekt_id: objekt.objekt_id
  });

  await senden(token, chatId,
    '*' + v.name + '* für ' + [d.str, d.hnr].filter(Boolean).join(' ')
    + ', ' + [d.plz, d.ort].filter(Boolean).join(' ') + '\n\n'
    + (v.kostet
        ? 'Das kostet *eine ' + v.name + '*'
          + (v.bestand != null ? ' (noch ' + v.bestand + ' in deinem Kontingent)' : '') + '.'
          + (v.schon_bezahlt ? '\n_Die Stufe darunter ist schon bezahlt — es wird nur die Differenz fällig._' : '')
        : '_Diese Tiefe hast du für dieses Objekt bereits bezahlt — kostet nichts._')
    + '\n\nSoll ich? (ja / nein)'
    + (stufe === 1 ? '\n\n_Sag „erweitert", wenn du zusätzlich Zustand und Qualität willst._' : ''));
}

async function marktpreisAbrufen(token, chatId, userId, objektId, stufe) {
  await zustandLoeschen(chatId, userId);
  const objekt = await dialog.objektKontext(userId, objektId);
  if (!objekt) { await senden(token, chatId, 'Das Objekt finde ich nicht mehr.'); return; }

  await senden(token, chatId, 'Ich rechne — das dauert einen Moment …');
  let r;
  try {
    r = await markt.abrufen(userId, objekt, stufe || 1);
  } catch (e) {
    await senden(token, chatId,
      (e.fachlich ? '' : 'Da ging etwas schief: ') + (e.message || e)
      + (e.upgradeTo ? '\n\n_Ab dem ' + e.upgradeTo + '-Plan ist diese Tiefe enthalten._' : ''));
    return;
  }

  const z = (x) => (x == null ? null : Number(x).toLocaleString('de-DE'));
  const w = r.wert || r.ergebnis || r.result || r;
  const wert = w.marktwert || w.wert || w.value;
  const von = w.spanne_von || w.low || (w.spanne && w.spanne.von);
  const bis = w.spanne_bis || w.high || (w.spanne && w.spanne.bis);
  const qm = w.eur_pro_qm || w.eur_per_sqm;

  let txt = '*' + (markt.STUFEN[stufe || 1] || markt.STUFEN[1]).name + '*\n';
  if (wert) txt += '\nWert: *' + z(wert) + ' €*';
  if (von && bis) txt += '\nSpanne: ' + z(von) + ' – ' + z(bis) + ' €';
  if (qm) txt += '\n' + z(qm) + ' €/m²';
  if (!wert && !von) {
    txt += '\n\nDer Bericht ist erstellt, eine Zahl kann ich hier aber nicht '
         + 'herauslesen. Schau ihn dir in DealPilot an.';
  }
  txt += '\n\n_Indikation aus den Daten des zuständigen Gutachterausschusses — '
       + 'kein Verkehrswert und kein Gutachten._';
  await sendenLang(token, chatId, txt);
}

/* ── Eine Aenderung anbieten, nie still ausfuehren ───────────────────────
 *
 * Dieselbe Regel wie im Browser (`anwenden()` in copilot-aenderungen.js):
 * steht in einem Feld schon ein Wert, wird er GENANNT und die Aenderung
 * bestaetigt. Ein leeres Feld wird ohne Rueckfrage gefuellt — da gibt es
 * nichts zu verlieren.
 */
async function aenderungAnbieten(token, chatId, userId, kontext, felder, antwortText) {
  const daten = kontext.daten || {};
  const sofort = {}, nachfragen = [];

  for (const [id, wert] of Object.entries(felder)) {
    if (!fuehrung.feld(id)) continue;                 /* unbekanntes Feld: still verwerfen waere falsch */
    if (fuehrung.gefuellt(daten, id) && String(daten[id]) !== String(wert)) {
      nachfragen.push({ id, alt: daten[id], neu: wert });
    } else {
      sofort[id] = wert;
    }
  }

  const unbekannt = Object.keys(felder).filter((id) => !fuehrung.feld(id));

  if (!Object.keys(sofort).length && !nachfragen.length) {
    await senden(token, chatId,
      unbekannt.length
        ? 'Die genannten Angaben passen zu keinem Feld, das ich kenne ('
          + unbekannt.join(', ') + ').'
        : 'Da war nichts zu ändern — die Werte stehen schon so drin.');
    return;
  }

  function name(id) { const f = fuehrung.feld(id); return (f && f.label) || id; }

  if (nachfragen.length) {
    /* Die Rueckfrage nennt BEIDE Werte. "Soll ich das aendern?" allein
       waere eine Frage, die der Nutzer nicht beantworten kann. */
    await zustandSetzen(chatId, userId, {
      modus: 'aenderung_bestaetigen',
      entwurf: { __felder: Object.assign({}, sofort,
        Object.fromEntries(nachfragen.map((n) => [n.id, n.neu]))) },
      objekt_id: kontext.objekt_id,
      letzte_frage: 'aenderung'
    });
    await senden(token, chatId,
      nachfragen.map((n) => '• *' + name(n.id) + '* steht auf *' + n.alt
        + '*, du willst *' + n.neu + '*').join('\n')
      + (Object.keys(sofort).length
          ? '\n\nDazu neu: ' + Object.keys(sofort).map((id) => name(id) + ' = ' + sofort[id]).join(', ')
          : '')
      + '\n\nÄndern? (ja / nein)');
    return;
  }

  await objektAendern(token, chatId, userId, kontext.objekt_id, sofort);
}

async function objektAendern(token, chatId, userId, objektId, felder) {
  const r = await query(`SELECT data FROM objects WHERE id = $1 AND user_id = $2`,
    [objektId, userId]);
  if (!r.rows.length) { await senden(token, chatId, 'Das Objekt finde ich nicht mehr.'); return; }
  const daten = Object.assign({}, r.rows[0].data || {}, felder);
  await query(`UPDATE objects SET data = $3::jsonb, updated_at = now()
                WHERE id = $1 AND user_id = $2`,
    [objektId, userId, JSON.stringify(daten)]);
  await zustandLoeschen(chatId, userId);

  function name(id) { const f = fuehrung.feld(id); return (f && f.label) || id; }
  await senden(token, chatId,
    '✓ Geändert:\n'
    + Object.keys(felder).map((id) => '• ' + name(id) + ': *' + felder[id] + '*').join('\n')
    + '\n\n_Die Kennzahlen rechnet DealPilot beim nächsten Öffnen neu._');
}

/* ── Der Gespraechszustand ───────────────────────────────────────────── */
async function zustand(chatId, userId) {
  const r = await query(
    `SELECT modus, entwurf, offene_ids, letzte_frage, objekt_id,
            letzte_liste, letzte_liste_art, letztes_objekt, verlauf
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

  await senden(token, chatId,
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

  /* ── Marktpreisindikation: erst ansagen, dann abrufen ─────────────────
   *
   * Marcel: "man koennte daraus jetzt auch einfach eine
   * Marktpreisindikation holen, wenn man die Sachen angibt."
   *
   * Der Abruf kostet Guthaben. Deshalb geht hier NIE etwas raus, bevor der
   * Preis im Chat stand und jemand "ja" gesagt hat.
   *
   *   > Bei Geld gibt es kein "im Zweifel ausfuehren". Ein Abruf, den
   *   > niemand bestaetigt hat, ist eine Abbuchung ohne Auftrag. */
  if (z && z.modus === 'marktpreis_bestaetigen') {
    if (/^(ja|hol|mach|ok|okay|j)\b/i.test(text.trim())) {
      await marktpreisAbrufen(token, chatId, userId, z.objekt_id, (z.entwurf || {}).__stufe || 1);
      return;
    }
    await zustandLoeschen(chatId, userId);
    await senden(token, chatId, 'Gut, ich hole nichts ab.');
    return;
  }

  if (/^\/marktpreis/i.test(text) || /marktpreis|markt\s?wert|wertindikation|was ist (es|das objekt) wert/i.test(text)) {
    await marktpreisAnbieten(token, chatId, userId, text);
    return;
  }

  if (z && z.modus === 'aenderung_bestaetigen') {
    if (/^(ja|mach|ok|okay|passt|j)\b/i.test(text.trim())) {
      await objektAendern(token, chatId, userId, z.objekt_id, (z.entwurf || {}).__felder || {});
      return;
    }
    if (/^(nein|nicht|stop|n)\b/i.test(text.trim())) {
      await zustandLoeschen(chatId, userId);
      await senden(token, chatId, 'Gut, ich lasse es.');
      return;
    }
    /* Alles andere ist keine Antwort auf die Frage — lieber nachfassen als
       eine Aenderung ausfuehren, die niemand bestaetigt hat. */
    await senden(token, chatId, 'Soll ich das ändern? Bitte *ja* oder *nein*.');
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

  /* ── v1800 · DER ANLEGE-MODUS HATTE KEINEN AUSGANG ───────────────────
   *
   * Hier stand ein unbedingtes `aufnehmen(...)` mit `return`. Jede
   * Nachricht im Anlege-Modus ging in die Feldextraktion — und wenn die
   * nichts verstand, kam "Daraus konnte ich kein Feld lesen", bei der
   * naechsten Nachricht wieder, und wieder.
   *
   * Marcel am 02.10.2026: "dann ist er in diesem Schritt haengen
   * geblieben und hat nicht weitergemacht."
   *
   *   > Ein Zustand, aus dem nur ein Befehl herausfuehrt, den der Nutzer
   *   > nicht kennt, ist kein Dialog, sondern ein Formular mit
   *   > Sprechblasen.
   *
   * Drei Auswege, und der Entwurf bleibt bei allen dreien stehen:
   *   1. eine ECHTE FRAGE geht an den Agenten, nicht in die Extraktion
   *   2. "weiter"/"ueberspringen" ueberspringt den aktuellen Block
   *   3. "fertig" legt an, was da ist
   *
   * Der Fortschritt ist damit zustandsbehaftet UND unterbrechbar — genau
   * das, was die Spezifikation unter Punkt 5 verlangt. */
  if (z && z.modus === 'anlegen') {
    if (/^(weiter|n(ä|ae)chste|ueberspringen|überspringen|skip|wei(ss|ß) ich nicht|keine ahnung|sp(ä|ae)ter)\b/i.test(text.trim())) {
      /* Den Block ueberspringen: die offenen Ids als "bewusst leer"
         merken, damit `luecken` sie nicht sofort wieder anbietet. */
      const e = Object.assign({}, z.entwurf || {});
      (z.offene_ids || []).forEach((id) => { if (e[id] == null) e['__uebersprungen_' + id] = true; });
      await zustandSetzen(chatId, userId, { modus: 'anlegen', entwurf: e });
      await weiterFragen(token, chatId, userId, e, (z.offene_ids || []));
      return;
    }
    if (/^(fertig|speichern|anlegen|das war'?s|das wars|reicht)\b/i.test(text.trim())) {
      await anlageAbschliessen(token, chatId, userId, z.entwurf || {});
      return;
    }
    /* Eine Frage ist keine Antwort. Wer mitten in der Anlage wissen will,
       wie sein Portfolio steht, bekommt die Auskunft — und danach geht es
       weiter, wo es war. */
    if (istFrage(text)) {
      await senden(token, chatId, '_(Die Anlage läuft weiter — ich merke sie mir.)_');
      /* NICHT return: faellt durch zur normalen Auskunft weiter unten. */
    } else {
      await aufnehmen(token, chatId, userId, text, z.entwurf);
      return;
    }
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

  /* ── v1801 · DIE MUSTER SIND NUR NOCH EIN SCHNELLPFAD ────────────────
   *
   * Bis v1800 entschied die Musterliste, was eine Nachricht will. Marcel
   * hat gemessen, wo das endet: von seinen fuenf Portfolio-Fragen traf
   * sie eine. Erweitern haette nichts geholfen —
   *
   *   > Das Problem ist nicht die Liste, sondern dass es eine Liste ist.
   *
   * Jetzt faengt sie nur noch ab, was EINDEUTIG und HAEUFIG ist: die
   * Objektliste, die Hilfe, die Befehle. Alles andere geht an den
   * Agenten, der sich seine Daten selbst holt.
   *
   * `portfolio` und `score` sind bewusst NICHT mehr dabei: dort beginnen
   * die Rueckfragen, und genau die konnte die Weiche nicht. */
  const SCHNELL = ['liste', 'hilfe', 'anlegen', 'abbrechen', 'stop'];
  if (SCHNELL.indexOf(was.art) < 0) {
    await agentAntwort(token, chatId, userId, text, z, bezugObjektId);
    return;
  }

  /* ── Liste ────────────────────────────────────────────────────────── */
  if (was.art === 'liste') {
    const liste = await dialog.objekteListe(userId, 40);
    if (!liste.length) {
      await senden(token, chatId, 'Ich sehe noch keine Objekte in deinem Konto.');
      return;
    }
    /* Die Reihenfolge wird GEMERKT — sie ist die Grundlage für "Objekt 17". */
    await listeMerken(chatId, userId, liste.map((o) => o.id), 'objekte');
    const zeilen = liste.map((o, i) => (i + 1) + '. *' + (o.adresse || 'ohne Adresse') + '*'
      + (o.kp ? ' · ' + Number(o.kp).toLocaleString('de-DE') + ' €' : ''));
    const txt = '*Deine Objekte* (' + liste.length + ')\n\n' + zeilen.join('\n')
      + '\n\n_Frag mich zu einem davon — Adresse oder einfach die Nummer._';
    await sendenLang(token, chatId, txt);
    await verlaufMerken(chatId, userId, 'assistant', 'Liste mit ' + liste.length + ' Objekten gezeigt');
    return;
  }

  if (was.art === 'hilfe') { await senden(token, chatId, HILFE); return; }

  if (was.art === 'anlegen') { await anlegenStarten(token, chatId, userId, text); return; }

  if (was.art === 'marktpreis') {
    await marktpreisAnbieten(token, chatId, userId, text, bezugObjektId);
    return;
  }

  if (was.art === 'score') {
    await scoreAuskunft(token, chatId, userId, text, bezugObjektId, z);
    return;
  }

  /* Portfolio: Spiegel oder ehrliche Fehlanzeige. */
  const willPortfolio = was.art === 'portfolio';
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
    stand = dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem);
    if (/^\/portfolio\s*$/i.test(text)) {
      text = 'Gib mir einen kurzen Ueberblick ueber mein Portfolio: '
           + 'Anzahl Objekte, Gesamtinvestition, Eigenkapital, Restschuld, '
           + 'Cashflow und wo ich in zehn Jahren stehe.';
    }
  } else {
    /* ── Welches Objekt ist gemeint? VIER Wege, in dieser Reihenfolge ───
     *
     *   1. Bezug auf die Liste   "Objekt 17"      — eindeutig, schlaegt alles
     *   2. Adresse im Satz        "Parkstr. 9"    — die Zuordnung fragt bei Gleichstand
     *   3. Anknuepfung            "und die Miete?" — das zuletzt besprochene
     *   4. genau ein Objekt vorhanden
     *
     * Die Reihenfolge ist nicht beliebig: wer zuerst nach einer Adresse
     * sucht, findet in "Objekt 17" keine und faellt auf die Anknuepfung
     * zurueck — und antwortet dann zum vorigen Objekt. */
    if (bezugObjektId) {
      kontext = await dialog.objektKontext(userId, bezugObjektId);
      if (!kontext) {
        await senden(token, chatId, 'Das Objekt aus der Liste finde ich nicht mehr.');
        return;
      }
    } else {
      const liste = await dialog.objekteListe(userId, 60);
      const t = dialog.objektRaten(text, liste);
      if (t.art === 'mehrdeutig') {
        /* Auch diese Liste wird gemerkt — "die zweite" muss danach gehen. */
        await listeMerken(chatId, userId, t.kandidaten.map((o) => o.id), 'kandidaten');
        await senden(token, chatId,
          'Welches Objekt meinst du?\n\n'
          + t.kandidaten.map((o, i) => (i + 1) + '. ' + o.adresse).join('\n')
          + '\n\n_Nenn mir die Hausnummer, den Ort — oder einfach die Nummer._');
        return;
      }
      if (t.art === 'eindeutig') {
        kontext = await dialog.objektKontext(userId, t.objekt.id);
      } else if (z && z.letztes_objekt && absicht.knuepftAn(text)) {
        kontext = await dialog.objektKontext(userId, z.letztes_objekt);
      } else if (liste.length === 1) {
        kontext = await dialog.objektKontext(userId, liste[0].id);
      } else {
        await senden(token, chatId,
          'Zu welchem Objekt? Nenn mir die Adresse oder die Nummer aus der Liste '
          + '— /objekte zeigt sie dir.\n\n'
          + 'Oder frag mich etwas über dein *Portfolio* als Ganzes.');
        return;
      }
    }
    if (kontext) await objektMerken(chatId, userId, kontext.objekt_id);
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
    /* DER KATALOG GEHT MIT — sonst kann das Modell gar nicht erkennen,
       dass ein Satz eine Anweisung ist, und antwortet freundlich statt zu
       aendern. Im Browser gilt seit v1767 dieselbe Regel, und dort steht
       auch die Begruendung: die Feld-Ids sind bei jedem Objekt dieselben,
       verschieden sind nur die Werte. */
    /* v1798 · DER VERLAUF GEHT MIT. Ohne ihn beantwortet das Modell
       "und die Miete?" aus dem Nichts — es weiss nicht, wovon eben die
       Rede war, und fragt zurueck oder rät.

       Die Form ist dieselbe wie im Browser-Co-Piloten:
       [{ role, content }], die letzten zwölf. */
    const verlauf = ((z && z.verlauf) || [])
      .slice(-12)
      .map((e) => ({ role: e.rolle === 'user' ? 'user' : 'assistant', content: e.text }));

    r = await dialog.antwort({
      message: text, context: kontext, kontextArt: kontextArt,
      history: verlauf,
      felder: kontextArt === 'portfolio' ? null : fuehrung.katalog()
    });
  } catch (e) {
    await senden(token, chatId, 'Da ist mir gerade etwas dazwischengekommen: ' + (e.message || e));
    return;
  }

  /* Das Feld heisst `reply` — gemessen an openaiService.js:2275, nicht
     geraten. Mein erster Versuch las `message || text || answer` und haette
     bei JEDER Antwort "keine Antwort bekommen" gemeldet. */
  let out = (r && r.reply) || '';
  if (!out) { await senden(token, chatId, 'Dazu habe ich keine Antwort bekommen.'); return; }

  /* ── Will das Modell etwas AENDERN? ───────────────────────────────────
   *
   * `copilotChat` antwortet mit einem Block `<<<FELDER {"id":"wert"} FELDER>>>`,
   * wenn der Satz eine Anweisung war ("aender die Zimmerzahl auf fuenf").
   * Im Browser wertet `copilot-aenderungen.js` ihn aus; hier dasselbe —
   * mit derselben Regel, die es dort gekostet hat:
   *
   *   > Eine Aenderung an einem belegten Feld wird NIE still gemacht.
   *   > Gefragt wird mit beiden Werten im Satz, und ohne Antwort passiert
   *   > nichts.
   *
   * Das Objekt steht hier bereits fest: `kontext.objekt_id` kommt aus der
   * Zuordnung weiter oben, und die fragt bei Gleichstand nach. */
  const fblock = /<<<FELDER\s*([\s\S]*?)\s*FELDER>>>/.exec(out);
  if (fblock && kontext && kontext.objekt_id) {
    let felder = null;
    try { felder = JSON.parse(fblock[1]); } catch (e) { felder = null; }
    if (felder && typeof felder === 'object' && !Array.isArray(felder)) {
      await aenderungAnbieten(token, chatId, userId, kontext, felder, out);
      return;
    }
  }

  /* Steueranweisungen des Modells gehoeren nicht in den Chat — sie sind
     fuer die Oberflaeche gedacht, nicht fuer den Leser. */
  out = out.replace(/<<<FELDER[\s\S]*?FELDER>>>/g, '').replace(/<<<ABRUF[\s\S]*?ABRUF>>>/g, '').trim();
  if (!out) {
    await senden(token, chatId,
      'Das habe ich als Anweisung gelesen, aber ich konnte kein Objekt dazu '
      + 'finden. Nenn mir die Adresse — /objekte zeigt die Liste.');
    return;
  }

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
