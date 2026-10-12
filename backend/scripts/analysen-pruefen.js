#!/usr/bin/env node
/* analysen-pruefen.js — welche Pilot-Analyse gehört nicht zu ihrem Objekt?
 *
 * ══ WOZU ════════════════════════════════════════════════════════════
 *
 * Marcel am 09.10.2026: „Haben wir noch falsche Werte im Zugriff?"
 * Gemessen am selben Tag: **sieben** Objekte trugen byte-identisch
 * dieselbe Pilot-Analyse (14.849 Zeichen), zwei weitere eine zweite
 * (11.187). Die siebenfache sprach von der Westerfeldstraße 140 in
 * Bielefeld — und hing u. a. an einem Objekt in Bad Oeynhausen.
 *
 * Der Telegram-Bot hat es bemerkt und gesagt. Der Reiter Pilot-Analyse,
 * das PDF und der Co-Pilot nicht — dort stand die fremde Analyse
 * kommentarlos als die eigene.
 *
 * Dieses Werkzeug zählt das aus, statt es zu vermuten.
 *
 * ══ DREI PRÜFUNGEN ══════════════════════════════════════════════════
 *
 *   1. STEMPEL   `_fuer.objekt_id` ≠ Objekt  → **sicher** fremd (seit v2015)
 *   2. DUBLETTE  dieselbe Analyse an mehreren Objekten → mindestens
 *                n−1 davon sind fremd
 *   3. ORT       die Analyse nennt den Ort des Objekts nirgends →
 *                **Verdacht** (dieselbe Heuristik wie im Bot, v1849)
 *
 * Nur (1) ist ein Beweis. (2) und (3) sind Befunde, die man ansehen
 * muss — und sie sind als solche gekennzeichnet. Ein Prüfer, der eine
 * Vermutung wie eine Feststellung ausgibt, ist schlimmer als keiner.
 *
 * ══ AUFRUF ══════════════════════════════════════════════════════════
 *
 *   docker exec dealpilot-backend node /app/scripts/analysen-pruefen.js
 *
 * (In `scripts/`, nicht in `tools/` — gemessen am Dockerfile: `scripts`
 * wird ins Image kopiert, `tools` nicht. Ein Prüfer, der dort nicht
 * laufen kann, wo die Daten liegen, ist keiner.)
 *
 * RC=0 sauber · RC=1 mindestens ein sicherer Fremdbefund · RC=2 nur
 * Verdachtsfälle. Mit `--alle` werden auch die unauffälligen gelistet.
 */
const { query } = require('../src/db/pool');

const ALLE = process.argv.includes('--alle');

function adresseVon(d) {
  d = d || {};
  const str = [d.str, d.hnr].filter(Boolean).join(' ');
  const ort = [d.plz, d.ort].filter(Boolean).join(' ');
  return [str, ort].filter(Boolean).join(', ') || '(ohne Adresse)';
}

async function lauf() {
 const r = await query(
  `SELECT id, user_id, seq_no, kuerzel, ort, data, ai_analysis, updated_at
     FROM objects
    WHERE ai_analysis IS NOT NULL AND length(ai_analysis) > 0
    ORDER BY user_id, seq_no`
);

if (!r.rowCount) {
  console.log('Keine Objekte mit Pilot-Analyse gefunden.');
  process.exit(0);
}

/* ── Dubletten über die Länge UND den Inhalt — ABER JE NUTZER ───────
 *
 * Der erste Lauf hat fünf Objekte mit der Nummer 2026-999 als Dublette
 * gemeldet. Sie sind keine: das ist das DEMO-Objekt, das jeder Nutzer
 * beim Start bekommt, samt der Analyse aus `demo-object.json`. Fünf
 * Nutzer, fünfmal dieselbe Saat — das gehört so.
 *
 * Eine Dublette ist nur dann eine, wenn sie BEIM SELBEN NUTZER an zwei
 * Objekten hängt. Sonst meldet der Prüfer die Saat als Schaden, und
 * wer ihm folgt, sucht an der falschen Stelle.
 */
const nachText = new Map();
for (const o of r.rows) {
  const k = o.user_id + '|' + o.ai_analysis.length + ':' + o.ai_analysis.slice(0, 400);
  if (!nachText.has(k)) nachText.set(k, []);
  nachText.get(k).push(o);
}

let sicher = 0, verdacht = 0, sauber = 0;
const zeilen = [];

for (const o of r.rows) {
  const d = o.data || {};
  const text = o.ai_analysis;
  const k = o.user_id + '|' + text.length + ':' + text.slice(0, 400);
  const gruppe = nachText.get(k);

  /* 1 · der Stempel (seit v2015) */
  let stempel = null;
  try {
    const j = JSON.parse(text);
    if (j && j._fuer && j._fuer.objekt_id) stempel = j._fuer;
  } catch (e) { /* ältere Analysen sind reiner Text oder anderes JSON */ }

  let befund = null, art = null;
  if (stempel && String(stempel.objekt_id) !== String(o.id)) {
    befund = 'gehört zu ' + (stempel.adresse || stempel.objekt_id);
    art = 'SICHER';
  } else if (gruppe.length > 1) {
    befund = 'dieselbe Analyse an ' + gruppe.length + ' Objekten ('
           + gruppe.map((x) => x.seq_no).join(', ') + ')';
    art = 'DUBLETTE';
  } else {
    const ort = String(d.ort || '').trim();
    if (ort && !text.toLowerCase().includes(ort.toLowerCase())) {
      befund = 'nennt den Ort ' + ort + ' nirgends';
      art = 'VERDACHT';
    }
  }

  if (art === 'SICHER') sicher++;
  else if (art) verdacht++;
  else sauber++;

  if (art || ALLE) {
    zeilen.push('  ' + (art || 'ok').padEnd(9) + (o.seq_no || '—').padEnd(11)
      + (o.kuerzel || '').padEnd(10) + adresseVon(d).slice(0, 38).padEnd(40)
      + (befund || (stempel ? 'Stempel passt' : 'ohne Stempel, unauffällig')));
  }
}

console.log('Objekte mit Pilot-Analyse: ' + r.rowCount);
console.log('  sicher fremd : ' + sicher + '   (Stempel zeigt auf ein anderes Objekt)');
console.log('  auffällig    : ' + verdacht + '   (Dublette oder Ort nicht genannt — ANSEHEN, kein Beweis)');
console.log('  unauffällig  : ' + sauber);
console.log();
if (zeilen.length) zeilen.forEach((z) => console.log(z));
else console.log('  (nichts zu melden)');

console.log();
console.log('Nur „SICHER" ist ein Beweis. „DUBLETTE" und „VERDACHT" sind Befunde,');
console.log('die man ansehen muss. Abhilfe ist immer dieselbe: die Analyse am');
console.log('betroffenen Objekt neu laufen lassen — sie traegt dann ihren Stempel.');

process.exit(sicher ? 1 : (verdacht ? 2 : 0));
}
lauf().catch(e => { console.error(String(e && e.message || e)); process.exit(3); });
