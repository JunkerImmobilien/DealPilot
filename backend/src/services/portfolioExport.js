'use strict';
/* portfolioExport.js - v2043
 * ═════════════════════════════════════════════════════════════════════
 * DER PORTFOLIO-EXPORT: nicht nur die Daten, sondern das WISSEN.
 *
 * Marcel, 09.10.2026: „ich brauche dann ein Export ueber das gesamte
 * Portfolio. Wichtig ist, dass wir das gesamte Wissen mitgeben."
 *
 * ── WARUM DIE VORHANDENE SICHERUNG NICHT REICHT ─────────────────────
 *
 * `exportAllJSON()` im Frontend gibt es schon. Sie schreibt eine
 * `.dpkt`-Datei zum WIEDERHERSTELLEN: je Objekt der rohe Datensatz mit
 * rund 280 Schluesseln wie `kp`, `nkm`, `_kpis_dscr`, `ds2_marktfaktor`.
 *
 * Damit kann DealPilot etwas anfangen. Ein Mensch nicht, und eine
 * fremde Tabelle auch nicht.
 *
 *   > Ein Export, der nur Werte traegt, gibt Daten weiter. Wissen gibt
 *   > weiter, wer dazuschreibt, WAS die Werte bedeuten - sonst muss der
 *   > Empfaenger raten, und dann rechnet er mit `bmy` als Prozent,
 *   > obwohl dort ein Faktor steht.
 *
 * ── WAS MITGEHT ─────────────────────────────────────────────────────
 *
 *   lexikon.felder       225 Feld-Ids mit Beschriftung und Art
 *   lexikon.objektarten  welche Art welche Felder traegt
 *   lexikon.score_stufen die Schwellen und Woerter (85/70/50/35)
 *   lexikon.hinweise     die Einheiten-Fallen, die hier teuer waren
 *   wissen.projekt       `bot-wissen.md` - was die Piloten wissen
 *   wissen.eigenes       Marcels eigene Ergaenzung (einmal, nicht je Objekt)
 *   objekte[]            je Objekt: Datensatz, Analyse, Ankauf-Stand
 *
 * ── WAS NICHT MITGEHT, UND WARUM ────────────────────────────────────
 *
 * **Fotos.** Ein Objekt traegt bis zu sechs Bilder als base64; bei 21
 * Objekten waere die Datei dreistellig in Megabyte und in keiner
 * Tabelle zu oeffnen. Die Zahl steht drin, die Bilder auf Wunsch
 * (`?fotos=1`) - dann aber bewusst.
 *
 * **Nichts wird gerechnet.** Die Kennzahlen stehen als `_kpis_*` im
 * Datensatz, gerechnet von den echten Kernen zu ihrer Zeit. Sie hier
 * neu zu rechnen hiesse, alte Daten mit heutigen Regeln zu messen.
 * ═════════════════════════════════════════════════════════════════════
 */
const { query } = require('../db/pool');
const projektwissen = require('./projektwissen');

let _konst = null;
function konstanten() {
  if (_konst) return _konst;
  try {
    _konst = require('../generated/frontend-konstanten.json');
  } catch (e) {
    _konst = { daten: {} };
  }
  return _konst;
}

/* Die Score-Kette. Sie steht an EINER Stelle im Frontend
   (`score-tiers.js`); hier wird sie NICHT nachgebaut, sondern als Text
   mitgegeben - wer den Export liest, soll wissen, was "62" heisst. */
const SCORE_STUFEN = [
  { ab: 85, wort: 'Sehr gut', farbe: 'top' },
  { ab: 70, wort: 'Gut', farbe: 'green' },
  { ab: 50, wort: 'Solide', farbe: 'gold' },
  { ab: 35, wort: 'Schwach', farbe: 'red' },
  { ab: 0, wort: 'Kritisch', farbe: 'red' }
];

/* Die Fallen, die in diesem Projekt Geld gekostet haben. Sie gehoeren
   in den Export: wer damit weiterrechnet, laeuft sonst in dieselben. */
const HINWEISE = [
  'Alle Geldbetraege sind EURO, nicht Cent.',
  '`nkm` ist die NettokaltMIETE pro MONAT, nicht pro m2.',
  '`_kpis_cf_ns` ist der Cashflow nach Steuer pro JAHR, nicht pro Monat.',
  '`_kpis_bmy` / `_kpis_nmy` sind Renditen in PROZENT.',
  '`_kpis_dscr` ist ein Verhaeltnis ohne Einheit - eine Prozentangabe darauf ist irrefuehrend.',
  '`lageklasse` ist A, B, C oder D - A ist die beste.',
  '`_ankauf` ist der eingefrorene Stand beim Nutzen-/Lastenwechsel (das Soll). Der uebrige Datensatz ist der laufende Stand (das Ist).',
  'Soll-Miete und Ist-Miete sind etwas ANDERES: die beschreiben eine Miete, nicht zwei Zeitpunkte.',
  'Ein fehlender Wert ist fehlend, nicht null. `null` heisst "liegt nicht vor" und darf nicht als 0 gerechnet werden.',
  'Die Pilot-Analyse traegt in `_fuer` einen Stempel: fuer welches Objekt und welchen Datenstand sie gilt. Eine Analyse ohne passenden Abdruck ist veraltet.'
];

/**
 * Baut das Export-Paket fuer einen Nutzer.
 * @param {string} userId
 * @param {{ fotos?: boolean }} opt
 */
/* v2043c - aus der Feld-LISTE ein Nachschlagewerk machen: Schluessel
   ist die Feld-Id, Wert sind Beschriftung und Art. Die Reihenfolge
   geht getrennt mit, falls sie jemand braucht. */
function felderAlsLexikon(liste) {
  if (!Array.isArray(liste)) return liste || null;
  const aus = {};
  liste.forEach(function (f) {
    if (!f || !f.id) return;
    const e = {};
    Object.keys(f).forEach(function (n) { if (n !== 'id') e[n] = f[n]; });
    aus[f.id] = e;
  });
  return aus;
}

async function bauen(userId, opt) {
  opt = opt || {};
  const mitFotos = !!opt.fotos;

  const r = await query(
    `SELECT id, name, kuerzel, ort, seq_no, version, created_at, updated_at,
            data, ai_analysis, photos
       FROM objects
      WHERE user_id = $1
      ORDER BY seq_no NULLS LAST, created_at`,
    [userId]
  );

  const k = konstanten().daten || {};

  const objekte = r.rows.map((o) => {
    let daten = o.data;
    if (typeof daten === 'string') { try { daten = JSON.parse(daten); } catch (e) { daten = {}; } }
    daten = daten || {};

    /* Die Analyse wird AUFGELOEST mitgegeben, nicht als Zeichenkette:
       sonst muesste der Empfaenger sie selbst auseinandernehmen. */
    let analyse = null;
    if (o.ai_analysis) {
      try { analyse = JSON.parse(o.ai_analysis); }
      catch (e) { analyse = { _roh: String(o.ai_analysis).slice(0, 20000) }; }
    }

    let fotos = o.photos;
    if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
    const fotoZahl = Array.isArray(fotos) ? fotos.length : 0;

    /* `_thumb` ist ein base64-Vorschaubild im Datensatz - es blaeht die
       Datei auf und traegt nichts bei. Raus, und zwar sichtbar. */
    const schlank = {};
    Object.keys(daten).forEach((key) => {
      if (key === '_thumb') return;
      if (key === '_photos' && !mitFotos) return;
      schlank[key] = daten[key];
    });

    return {
      id: o.id,
      nummer: o.seq_no || null,
      name: o.name || null,
      kuerzel: o.kuerzel || null,
      ort: o.ort || null,
      version: o.version,
      angelegt_am: o.created_at,
      geaendert_am: o.updated_at,
      lageklasse: daten.lageklasse || null,
      gewonnen: daten._deal_won === true || daten._deal_won === 'true',
      verloren: daten._deal_lost === true || daten._deal_lost === 'true',
      ankauf_stand: (daten._ankauf && daten._ankauf.stichtag) ? daten._ankauf.stichtag : null,
      daten: schlank,
      analyse: analyse,
      fotos_anzahl: fotoZahl,
      fotos: mitFotos && Array.isArray(fotos) ? fotos : undefined
    };
  });

  let eigenes = null;
  try { eigenes = await projektwissen.zusatzFuer(userId); } catch (e) { eigenes = null; }

  return {
    dealpilot_export: 'portfolio',
    format_version: 1,
    erzeugt_am: new Date().toISOString(),
    anzahl_objekte: objekte.length,
    fotos_enthalten: mitFotos,
    /* ── Das Lexikon: was die Schluessel bedeuten ──────────────────
       Ohne diesen Block ist der Export eine Liste aus 280 Kuerzeln.
       Mit ihm kann ein Mensch - oder ein fremdes Programm - damit
       rechnen, ohne zu raten. */
    lexikon: {
      /* v2043c - als NACHSCHLAGEWERK, nicht als Liste.

         Gemessen: k.felder ist ein ARRAY - im Export kamen die
         Schluessel 0, 1, 2 an, und lexikon.felder.kp ging ins Leere.
         Damit war das Lexikon zwar vorhanden, aber nicht benutzbar:
         wer wissen will, was kp bedeutet, schlaegt unter kp nach
         und nicht unter 37.

         Ein Lexikon, das man nicht nachschlagen kann, ist ein
         Inhaltsverzeichnis. */
      felder: felderAlsLexikon(k.felder),
      felder_reihenfolge: Array.isArray(k.felder) ? k.felder.map(function (f) { return f.id; }) : null,
      objektarten: k.objektarten || null,
      etappen: k.etappen || null,
      score_stufen: SCORE_STUFEN,
      hinweise: HINWEISE
    },
    /* ── Das Wissen, das die Piloten benutzen ──────────────────────
       Einmal, nicht je Objekt: es gilt fuer alle. */
    wissen: {
      projekt: projektwissen.wissen(),
      eigenes: eigenes || null
    },
    objekte: objekte
  };
}

module.exports = { bauen, SCORE_STUFEN, HINWEISE };
