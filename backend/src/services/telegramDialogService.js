'use strict';
/* services/telegramDialogService.js — die Auskunft des Bots (v1793)
 *
 * ── DIE REGEL DIESER DATEI ───────────────────────────────────────────────
 *
 * HIER WIRD NICHTS GERECHNET. Keine Rendite, keine Restschuld, kein DSCR.
 * Diese Datei holt Daten, die woanders entstanden sind, und reicht sie an
 * `openaiService.copilotChat` weiter — denselben Dienst, den der Browser
 * ruft.
 *
 *   > "Rechenkerne — nie duplizieren" (CLAUDE.md). `projectAll` rechnete
 *   > jahrelang in Cent, und aufgefallen ist es erst, als eine zweite
 *   > Quelle danebenstand. Eine zweite Vermoegensbilanz im Bot waere
 *   > derselbe Fehler noch einmal.
 *
 * Zwei Quellen, beide fremd:
 *   Portfolio  -> `portfolio_spiegel` (vom Browser abgelegt, v1793)
 *   Objekt     -> `objects.data` (die App schreibt es, wir lesen es)
 */
const { query } = require('../db/pool');
const openaiService = require('./openaiService');

/* ── Portfolio ───────────────────────────────────────────────────────────
 *
 * Der Spiegel ist nur so frisch wie der letzte Besuch im Browser. Deshalb
 * kommt der Stand IMMER mit — nicht als Fussnote, sondern als Teil der
 * Auskunft.
 *
 *   > Eine Zahl ohne Stand behauptet, aktuell zu sein.
 */
async function portfolioKontext(userId) {
  const r = await query(
    `SELECT payload, erfasst_am FROM portfolio_spiegel WHERE user_id = $1`,
    [userId]
  );
  if (!r.rows.length) return null;
  const alterMin = Math.round((Date.now() - new Date(r.rows[0].erfasst_am).getTime()) / 60000);

  /* ── v1796 · WIE ALT IST ALT? ─────────────────────────────────────────
   *
   * Bis hierher nannte der Bot nur das Datum des Spiegels. Das ist
   * richtig, aber es beantwortet die falsche Frage. Entscheidend ist
   * nicht, wie alt der Stand IST, sondern ob sich seitdem etwas GEAENDERT
   * hat.
   *
   *   > Ein drei Wochen alter Stand, an dem sich nichts geaendert hat, ist
   *   > aktuell. Ein zwei Stunden alter, hinter dem zwei Objekte
   *   > bearbeitet wurden, ist es nicht.
   *
   * `objects.updated_at` weiss das, und die Abfrage kostet nichts. Damit
   * kann der Bot statt einer Altersangabe eine Aussage machen. */
  const g = await query(
    `SELECT count(*)::int AS n FROM objects
      WHERE user_id = $1 AND updated_at > $2`,
    [userId, r.rows[0].erfasst_am]
  );

  return {
    payload: r.rows[0].payload,
    erfasst_am: r.rows[0].erfasst_am,
    alter_minuten: alterMin,
    geaendert_seitdem: (g.rows[0] && g.rows[0].n) || 0
  };
}

function standSatz(erfasstAm, alterMin, geaendertSeitdem) {
  const d = new Date(erfasstAm);
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const tag = d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  const wann = alterMin < 60 * 24 ? 'heute ' + uhr + ' Uhr' : tag + ', ' + uhr + ' Uhr';

  /* v1796 · Die Aenderung schlaegt das Alter. Sie ist die eigentliche
     Aussage: ein alter Stand ohne Aenderung stimmt noch, ein frischer mit
     Aenderung nicht mehr. */
  if (geaendertSeitdem > 0) {
    return 'Stand: ' + wann + ' — seitdem '
      + (geaendertSeitdem === 1 ? 'hast du ein Objekt' : 'hast du ' + geaendertSeitdem + ' Objekte')
      + ' bearbeitet. Öffne DealPilot einmal kurz, dann stimmen die Summen wieder.';
  }
  if (alterMin < 60 * 24 * 7) return 'Stand: ' + wann + '.';
  return 'Stand: ' + wann + ' — unverändert seitdem.';
}

/* ── Objekte ─────────────────────────────────────────────────────────────
 *
 * Die Liste ist bewusst schmal: Kennung, Adresse, Stand. Alles Weitere holt
 * `objektKontext` erst, wenn ein Objekt wirklich gemeint ist.
 */
async function objekteListe(userId, limit) {
  const r = await query(
    `SELECT id, data, updated_at FROM objects
      WHERE user_id = $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $2`,
    [userId, limit || 60]
  );
  return r.rows.map((z) => {
    const d = z.data || {};
    return {
      id: z.id,
      adresse: [d.str, d.hnr].filter(Boolean).join(' ')
             + (d.plz || d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : ''),
      seq: d.seq || d.objektnummer || null,
      kp: d.kp || null,
      geaendert: z.updated_at
    };
  });
}

async function objektKontext(userId, objektId) {
  const r = await query(
    `SELECT id, data, ai_analysis, updated_at FROM objects WHERE user_id = $1 AND id = $2`,
    [userId, objektId]
  );
  if (!r.rows.length) return null;
  const z = r.rows[0];
  return {
    objekt_id: z.id,
    daten: z.data || {},
    ki_lagebewertung: z.ai_analysis || null,
    geaendert: z.updated_at
  };
}

/* ── Objektzuordnung aus einem Satz ──────────────────────────────────────
 *
 * Dasselbe Verfahren wie im Browser (`copilot-aenderungen.js objektZuordnen`),
 * und mit denselben zwei Lehren, die es dort gekostet hat:
 *
 *   1. `indexOf` findet TEILWOERTER: "str" steckt in "Musterstrasse".
 *      Deshalb Wortgrenzen.
 *   2. Ein Laengenfilter wirft die HAUSNUMMER weg — und genau die
 *      unterscheidet zwei Objekte in derselben Strasse. Zahlen zaehlen ab
 *      einer Stelle und wiegen schwerer.
 *
 * Und die wichtigste: BEI GLEICHSTAND WIRD GEFRAGT, nicht geraten. Ein
 * falsch zugeordnetes Objekt aendert Daten am falschen Haus.
 */
const STRASSENWOERTER = new Set(['strasse', 'straße', 'str', 'weg', 'allee', 'platz',
  'gasse', 'ring', 'damm', 'ufer', 'chaussee', 'hof', 'park']);

function _woerter(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-zäöüß0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function objektRaten(satz, liste) {
  const w = _woerter(satz);
  const treffer = liste.map((o) => {
    const ow = new Set(_woerter(o.adresse));
    let p = 0;
    for (const t of w) {
      if (!ow.has(t)) continue;
      if (/^\d+$/.test(t)) p += 3;                 /* Hausnummer/PLZ wiegen schwer */
      else if (STRASSENWOERTER.has(t)) continue;   /* "strasse" sagt nichts */
      else if (t.length > 2) p += 2;
    }
    return { o: o, p: p };
  }).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);

  if (!treffer.length) return { art: 'keiner' };
  if (treffer.length > 1 && treffer[0].p === treffer[1].p) {
    return { art: 'mehrdeutig', kandidaten: treffer.filter((x) => x.p === treffer[0].p).map((x) => x.o) };
  }
  return { art: 'eindeutig', objekt: treffer[0].o, punkte: treffer[0].p };
}

/* ── Die Antwort ─────────────────────────────────────────────────────────
 *
 * `copilotChat` ist derselbe Dienst, den der Browser ruft. `kontextArt`
 * entscheidet, wie das Modell den Kontext beschriftet — ohne ihn stuende
 * "AKTUELLES OBJEKT" ueber einer Vermoegensbilanz (v1704).
 */
async function antwort(opts) {
  const nutzlast = {
    message: opts.message,
    history: (opts.history || []).slice(-12),
    context: opts.context,
    allowWeb: false
  };
  if (opts.kontextArt) nutzlast.kontextArt = opts.kontextArt;
  if (opts.felder) nutzlast.felder = opts.felder;

  const r = await openaiService.copilotChat(nutzlast, {});
  return r;
}

module.exports = {
  portfolioKontext, standSatz, objekteListe, objektKontext, objektRaten, antwort
};
