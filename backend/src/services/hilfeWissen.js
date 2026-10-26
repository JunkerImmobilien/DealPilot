'use strict';
/* services/hilfeWissen.js — die Hilfe der App fuer den Bot (v2960)
 *
 * Marcel am 26.10.2026: „Kann der Telegram Bot auch Fragen beantworten in
 * Bezug auf die Hilfe?"
 *
 * GEMESSEN vorher: nein. Der Bot kannte `bot-wissen.md` (Begriffe, Scores,
 * Leitlinien), aber nicht das Hilfe-Fenster der App — 18 Themen, 161
 * Abschnitte, darunter FAQ und Glossar. Und schlimmer: „wie funktioniert
 * der Quick-Check?" traf das Schnellmuster `hilfe` und bekam die feste
 * Befehlsliste des Bots, nicht die Antwort.
 *
 * DIE HILFE WIRD NICHT ABGESCHRIEBEN. `tools/frontend-konstanten.mjs`
 * fuehrt `help.js` aus und legt `DealPilotHilfe.themen()` als Text in
 * `generated/frontend-konstanten.json` ab; `--pruefen` (im Deploy) schlaegt
 * an, sobald sich der Hilfeinhalt aendert und der Spiegel nicht nachzog.
 *
 *   > Eine Antwort ueber die App, die nicht aus der App stammt, beschreibt
 *   > eine App, die es so nicht gibt — und klingt dabei genauso sicher.
 *
 * Die Suche ist bewusst schlicht: Woerter normalisieren, Fuellwoerter weg,
 * Treffer in Ueberschrift zaehlen mehr als im Text. Das Modell bekommt die
 * besten Abschnitte WOERTLICH und antwortet nur daraus.
 */
const path = require('path');

let _themen = null;
function themen() {
  if (_themen) return _themen;
  try {
    const k = require(path.join(__dirname, '..', 'generated', 'frontend-konstanten.json'));
    _themen = (k && k.daten && Array.isArray(k.daten.hilfe)) ? k.daten.hilfe : [];
  } catch (e) {
    _themen = [];
  }
  return _themen;
}

const FUELL = new Set(('der die das den dem des ein eine einen einem einer und oder aber '
  + 'wie was wo wer wann warum welche welcher welches ist sind wird werden kann kannst '
  + 'koennen können ich du mir mich mein meine dein deine man es im in an auf zu zum zur '
  + 'mit von vom für fuer bei aus nach über ueber unter auch noch nur nicht kein keine '
  + 'bitte mal denn dann da hier dort gibt geht machen mache funktioniert funktionieren '
  + 'erklär erklaer erklaere erkläre bedeutet heisst heißt dealpilot app')
  .split(/\s+/));

function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Grobe Stammform: deutsche Endungen ab, aber nie unter vier Zeichen. */
function stamm(w) {
  let s = w;
  for (const e of ['ungen', 'ung', 'en', 'er', 'es', 'e', 'n', 's']) {
    if (s.length - e.length >= 4 && s.endsWith(e)) { s = s.slice(0, -e.length); break; }
  }
  return s;
}

function woerter(s) {
  return norm(s).split(' ').filter((w) => w && w.length >= 3 && !FUELL.has(w)).map(stamm);
}

/** Die passendsten Abschnitte zur Frage. Leere Liste, wenn nichts passt. */
function suchen(frage, anzahl) {
  const q = [...new Set(woerter(frage))];
  if (!q.length) return [];
  const treffer = [];
  for (const t of themen()) {
    const tw = new Set(woerter(t.titel + ' ' + t.beschreibung));
    for (const a of t.abschnitte || []) {
      const hw = new Set(woerter(a.h));
      const bw = woerter(a.text);
      let p = 0, gedeckt = 0;
      for (const w of q) {
        let x = 0;
        if (hw.has(w)) x += 4;
        else if ([...hw].some((h) => h.length >= 5 && w.length >= 5 && (h.startsWith(w) || w.startsWith(h)))) x += 3;
        if (tw.has(w)) x += 1;
        const n = bw.filter((b) => b === w || (w.length >= 5 && b.startsWith(w))).length;
        if (n) x += Math.min(3, n);
        if (x) gedeckt++;
        p += x;
      }
      /* Abschnitte, die mehrere Fragewoerter tragen, vor solchen, die eines
         oft nennen. */
      if (p > 0) treffer.push({ thema: t.titel, thema_id: t.id, ueberschrift: a.h,
        text: a.text, punkte: p + gedeckt * 2 });
    }
  }
  treffer.sort((a, b) => b.punkte - a.punkte);
  return treffer.slice(0, anzahl || 4);
}

function anzahlAbschnitte() {
  return themen().reduce((s, t) => s + (t.abschnitte || []).length, 0);
}

module.exports = { suchen, themen, anzahlAbschnitte, _woerter: woerter };
