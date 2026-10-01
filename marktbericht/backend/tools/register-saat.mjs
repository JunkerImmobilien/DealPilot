#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1751 · SAATLAUF ÜBER DAS GANZE REGISTER
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 01.10.2026: „Kannst du die ganzen Werte jetzt auch in der
   Datenbank übernehmen?"

   Hier stand bis heute EINE hartverdrahtete Datei:

       const DATEI = new URL('../src/lib/register/lzs-nrw.json', …);

   Deshalb lagen 2.515 geerntete Datensätze im Repo und 493 in der
   Datenbank. Gemessen am 01.10.2026:

       Dateiregister   2.515 Sätze · 24 Dateien · 16 Kennzahlen
                       409 Sachwertfaktoren in 14 von 16 Ländern
                       1.078 Liegenschaftszinssätze in 6 von 16 Ländern
       Datenbank         493 Sätze · nur NW · nur Liegenschaftszins

   > Eine Ernte, die das Repo nicht verlässt, ist keine Ernte. Sie sieht
   > aus wie Fortschritt und wirkt nirgends.

   Der Lauf ist WIEDERHOLBAR: `schreibeModelle()` schreibt mit
   `ON CONFLICT … DO UPDATE` auf (land_code, ags, kennzahl, zweig,
   berichtsjahr, quelle_url). Ein zweiter Lauf erzeugt keine Dubletten,
   er frischt auf.

   Aufruf im Container:
     docker exec dealpilot-mb-backend node /app/tools/register-saat.mjs --trocken
     docker exec dealpilot-mb-backend node /app/tools/register-saat.mjs
     docker exec dealpilot-mb-backend node /app/tools/register-saat.mjs --nur=HE
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const TROCKEN = process.argv.includes('--trocken');
const NUR = (process.argv.find((a) => a.startsWith('--nur=')) || '').slice(6).toUpperCase();

const DIR = fileURLToPath(new URL('../src/lib/register/', import.meta.url));

/* ── 1 · Einlesen. Das Werkzeug nennt seine DECKUNG: wie viele Dateien
   gelesen, wie viele übersprungen und WARUM. Eine kleine Zahl ohne diese
   Angabe ist kein Befund, sondern möglicherweise ein Ausfall. ────────── */
const alleDateien = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
let gelesen = 0;
const uebersprungen = [];
let saetze = [];

for (const f of alleDateien) {
  let j;
  try {
    j = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  } catch (e) {
    uebersprungen.push(`${f} — unlesbar: ${e.message}`);
    continue;
  }
  if (!Array.isArray(j)) {
    uebersprungen.push(`${f} — kein Array (${typeof j})`);
    continue;
  }
  const mit = j.filter((r) => r && r.kennzahl && r.land_code);
  if (mit.length !== j.length) {
    uebersprungen.push(`${f} — ${j.length - mit.length} Zeile(n) ohne kennzahl/land_code`);
  }
  gelesen++;
  saetze = saetze.concat(mit.map((r) => ({ ...r, _datei: f })));
}

if (NUR) saetze = saetze.filter((m) => String(m.land_code).toUpperCase() === NUR);

console.log('═══ DECKUNG ═══');
console.log(`Dateien im Register : ${alleDateien.length}`);
console.log(`davon gelesen       : ${gelesen}`);
if (uebersprungen.length) {
  console.log(`Hinweise            : ${uebersprungen.length}`);
  uebersprungen.forEach((z) => console.log(`   · ${z}`));
}
if (NUR) console.log(`Filter --nur=${NUR}`);
console.log(`Datensätze          : ${saetze.length}`);

if (!saetze.length) { console.error('ABBRUCH: keine Datensätze.'); process.exit(1); }

/* Unter 90 % Dateideckung ist der Lauf nicht aussagekräftig — dann hat das
   Werkzeug ein Problem, nicht das Register. Dieselbe Schwelle wie beim
   Gold-Audit, und aus demselben Grund: ein Prüfer, der grün wird, ohne
   gelesen zu haben, ist schlimmer als keiner. */
if (gelesen / alleDateien.length < 0.9) {
  console.error(`ABBRUCH: nur ${gelesen} von ${alleDateien.length} Dateien lesbar (< 90 %).`);
  process.exit(1);
}

/* ── 2 · Vorprüfung. Dieselben Pflichtfelder, die schreibeModelle()
   verlangt. Sätze, die sie nicht erfüllen, werden dort ohnehin verworfen —
   hier stehen sie VORHER im Protokoll, mit Datei und Gebiet, damit man sie
   nachtragen kann statt sie nur zu zählen. ──────────────────────────── */
const pflicht = ['quelle_url', 'kennzahl', 'ags', 'land_code', 'formel', 'belege'];
const schlecht = saetze.filter((m) => !pflicht.every((f) => m[f])
                                   || !Array.isArray(m.belege) || !m.belege.length);

console.log('');
console.log('═══ VORPRÜFUNG ═══');
if (schlecht.length) {
  console.log(`${schlecht.length} von ${saetze.length} Sätzen unvollständig — sie werden NICHT geschrieben:`);
  const jeDatei = {};
  schlecht.forEach((m) => { jeDatei[m._datei] = (jeDatei[m._datei] || 0) + 1; });
  Object.keys(jeDatei).sort().forEach((d) => console.log(`   · ${d}: ${jeDatei[d]}`));
  const fehltWas = {};
  schlecht.forEach((m) => pflicht.forEach((f) => {
    const leer = !m[f] || (f === 'belege' && (!Array.isArray(m.belege) || !m.belege.length));
    if (leer) fehltWas[f] = (fehltWas[f] || 0) + 1;
  }));
  console.log('   fehlende Felder:', JSON.stringify(fehltWas));
} else {
  console.log(`alle ${saetze.length} Sätze vollständig (inkl. Belege).`);
}

/* Herkunft ist Pflicht, nicht Kür: ohne Link und Vermerk lässt sich später
   nicht sagen, woher eine Zahl kommt — und genau das ist der Zweck des
   Registers. */
const ohneLink = saetze.filter((m) => !m.quelle_url).length;
const ohneVermerk = saetze.filter((m) => !m.quellenvermerk).length;
const ohneLizenz = saetze.filter((m) => !m.lizenz).length;
console.log('');
console.log('═══ HERKUNFT ═══');
console.log(`Link (quelle_url)      : ${saetze.length - ohneLink} / ${saetze.length}`
          + (ohneLink ? `   FEHLT bei ${ohneLink}` : ''));
console.log(`Quellenvermerk         : ${saetze.length - ohneVermerk} / ${saetze.length}`
          + (ohneVermerk ? `   fehlt bei ${ohneVermerk}` : ''));
console.log(`Lizenz                 : ${saetze.length - ohneLizenz} / ${saetze.length}`
          + (ohneLizenz ? `   fehlt bei ${ohneLizenz}` : ''));

/* ── 3 · Was kommt, nach Land und Kennzahl ─────────────────────────── */
const nachLand = {};
const nachKennzahl = {};
saetze.forEach((m) => {
  nachLand[m.land_code] = (nachLand[m.land_code] || 0) + 1;
  nachKennzahl[m.kennzahl] = (nachKennzahl[m.kennzahl] || 0) + 1;
});
console.log('');
console.log('═══ VERTEILUNG ═══');
console.log('Länder   :', Object.keys(nachLand).sort()
  .map((l) => `${l} ${nachLand[l]}`).join(' · '));
console.log('Kennzahlen:', Object.keys(nachKennzahl).sort()
  .map((k) => `${k} ${nachKennzahl[k]}`).join(' · '));

if (TROCKEN) {
  console.log('');
  console.log('Trockenlauf — es wird nichts geschrieben.');
  process.exit(0);
}

/* ── 4 · Schreiben ─────────────────────────────────────────────────── */
const { q } = await import('../src/lib/db.js');
const { machRepository } = await import('../src/connectors/opendata/param-repository.js');
const repo = machRepository(q);

const laender = Object.keys(nachLand).sort();
const lauf = await repo.laufStart('v1751-register-saat-voll', laender);
console.log('');
console.log(`═══ SCHREIBEN ═══   param_lauf id=${lauf}`);

/* Das `_datei`-Feld ist meine Zutat fuer das Protokoll und gehoert nicht in
   die Tabelle — hier faellt es wieder weg. */
const rein = saetze.map(({ _datei, ...rest }) => rest);
const r = await repo.schreibeModelle(rein);
console.log(`übernommen ${r.uebernommen} · verworfen ${r.verworfen}`);

await repo.laufEnde(lauf,
  { gefunden: saetze.length, uebernommen: r.uebernommen, verworfen: r.verworfen, fehler: 0 },
  { quelle: 'Dateiregister src/lib/register/ (24 Dateien)',
    parser: 'v1751-register-saat-voll',
    lizenz: 'je Satz, siehe Spalte lizenz',
    dateien: gelesen, laender: laender.join(',') });

/* ── 5 · Gegenprobe am geschriebenen Stand, nicht am Rueckgabewert.
   „uebernommen 2500" ist eine Behauptung des Schreibers; was wirklich
   drinsteht, sagt nur ein SELECT. ──────────────────────────────────── */
const n = await q(`SELECT count(*)::int AS n,
                          count(DISTINCT land_code)::int AS laender,
                          count(DISTINCT kennzahl)::int AS kennzahlen
                     FROM mb.param_modell`);
const fehlt = await q(`SELECT
     count(*) FILTER (WHERE quelle_url IS NULL OR quelle_url = '')::int      AS ohne_link,
     count(*) FILTER (WHERE quellenvermerk IS NULL OR quellenvermerk = '')::int AS ohne_vermerk,
     count(*) FILTER (WHERE lizenz IS NULL OR lizenz = '')::int              AS ohne_lizenz
   FROM mb.param_modell`);
console.log('');
console.log('═══ GEGENPROBE (gelesen aus der Tabelle) ═══');
console.log(`mb.param_modell : ${n[0].n} Zeilen · ${n[0].laender} Länder · ${n[0].kennzahlen} Kennzahlen`);
console.log(`ohne Link ${fehlt[0].ohne_link} · ohne Quellenvermerk ${fehlt[0].ohne_vermerk} · ohne Lizenz ${fehlt[0].ohne_lizenz}`);

process.exit(r.uebernommen > 0 ? 0 : 1);
