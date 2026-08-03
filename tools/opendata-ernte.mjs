#!/usr/bin/env node
// opendata-ernte.mjs  (OD-02)
//
// Holt die bundesweite AK-OGA-CSV, parst sie und schreibt sie nach
// mb.param_werte. Optional uebernimmt es die Probe-Ergebnisse aus OD-01,
// damit die Landkarte im Admin sichtbar wird.
//
// Eigene pg-Verbindung aus den PG*-Variablen — bewusst KEIN Import eines
// Backend-Moduls, damit das Skript unabhaengig vom laufenden Container ist
// und ein Fehlgriff hier nichts im Betrieb umwirft.
//
// Aufruf (im Backend-Container oder auf dem Host mit gesetzten PG*-Vars):
//   node tools/opendata-ernte.mjs --imbde
//   node tools/opendata-ernte.mjs --imbde --trocken      # nichts schreiben
//   node tools/opendata-ernte.mjs --probe /tmp/probe.json
//
// --trocken zeigt genau, was geschrieben WUERDE. Immer zuerst trocken laufen.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { BUND } from '../marktbericht/backend/src/connectors/opendata/laender-registry.js';
import * as P1 from '../marktbericht/backend/src/connectors/opendata/parser-p1-imbde.js';
import { machRepository } from '../marktbericht/backend/src/connectors/opendata/param-repository.js';
/* v1066-WP2-2 · P2 liest TEXT, nicht PDF. Die Umwandlung macht pdftotext
 * auf dem Server; damit bleibt das mb-Backend bei cors, express und pg. */
import * as P2 from '../marktbericht/backend/src/connectors/opendata/parser-p2-gmb.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const LEGENDE = process.env.IMBDE_LEGENDE
  || path.join(HIER, '..', 'marktbericht', 'backend', 'data', 'imbde_legende.csv');

const args = process.argv.slice(2);
const trocken = args.includes('--trocken');
const willImbde = args.includes('--imbde');
const probeIdx = args.indexOf('--probe');
const probeDatei = probeIdx >= 0 ? args[probeIdx + 1] : null;
/* v1066-WP2-3 */
const textIdx = args.indexOf('--pdf-text');
const textDatei = textIdx >= 0 ? args[textIdx + 1] : null;
const profilIdx = args.indexOf('--profil');
const profilId = profilIdx >= 0 ? args[profilIdx + 1] : null;
const quelleIdx = args.indexOf('--quelle');
const quelleUrl = quelleIdx >= 0 ? args[quelleIdx + 1] : null;
const UA = process.env.OPENDATA_USER_AGENT || '';

if (args.includes('--profile')) {   /* v1066-WP2-4 */
  console.log('Verfuegbare P2-Profile:');
  for (const p of P2.profilListe()) {
    console.log('  ' + p.id.padEnd(14) + p.land + '  ' + p.ags + '  ' + p.kennzahl);
  }
  process.exit(0);
}

if (!willImbde && !probeDatei && !textDatei) {
  console.log('Aufruf: node tools/opendata-ernte.mjs --imbde [--trocken]');
  console.log('        node tools/opendata-ernte.mjs --probe /tmp/probe.json');
  console.log('        node tools/opendata-ernte.mjs --pdf-text /tmp/be.txt --profil be-lzs \\');
  console.log('               --quelle https://... [--trocken]');
  console.log('        node tools/opendata-ernte.mjs --profile      (Liste)');
  console.log('');
  console.log('Die Textdatei entsteht mit:  pdftotext -layout bericht.pdf bericht.txt');
  process.exit(0);
}

async function verbinde() {
  const pool = new pg.Pool({
    host: process.env.PGHOST || 'dealpilot-mb-db',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'mb',
    password: process.env.PGPASSWORD || 'mb',
    database: process.env.PGDATABASE || 'marktbericht',
    max: 4,
  });
  // Schnittstelle exakt wie im mb-Backend: liefert rows DIREKT, nicht {rows}
  const q = async (sql, params) => (await pool.query(sql, params)).rows;
  const vorhanden = await q(
    `SELECT to_regclass('mb.param_werte') IS NOT NULL AS da`
  );
  if (!vorhanden[0] || !vorhanden[0].da) {
    /* v1062-WOD-1 · stand auf 007; das Paket wurde auf 013 umnummeriert. */
    throw new Error('mb.param_werte fehlt — Migration 013 ist noch nicht gelaufen (Backend neu bauen).');
  }
  return { pool, q };
}

async function ernteImbde(repo) {
  if (!UA) throw new Error('OPENDATA_USER_AGENT fehlt. Ohne eigene Kennung wird nicht abgerufen.');
  const url = BUND.quellen.csv_2025;
  console.log('hole', url);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  const text = await res.text();
  console.log(`  ${Math.round(text.length / 1024)} kB gelesen`);

  let legendeText = null;
  if (fs.existsSync(LEGENDE)) {
    legendeText = fs.readFileSync(LEGENDE, 'utf8');
    console.log('  Legende:', LEGENDE);
  } else {
    console.log('  Legende fehlt:', LEGENDE, '(alle Spalten bleiben semantisch offen)');
  }

  const r = P1.parse(text, { quelleUrl: url, legendeText, berichtsausgabe: 2025 });
  for (const w of r.warnungen) console.log('  HINWEIS:', w);
  console.log(`  ${r.saetze.length} Saetze aus ${r.spalten.length} Spalten`);

  const mitNamen = r.saetze.filter((s) => !s.semantik_offen).length;
  console.log(`  davon benannt: ${mitNamen} | semantisch offen: ${r.saetze.length - mitNamen}`);

  if (trocken) {
    console.log('  TROCKENLAUF — nichts geschrieben. Beispielsatz:');
    console.log('  ' + JSON.stringify(r.saetze[0], null, 2).split('\n').join('\n  '));
    return { gefunden: r.saetze.length, uebernommen: 0, verworfen: 0, fehler: 0 };
  }

  const laufId = await repo.laufStart('cli:imbde', ['de']);
  const w = await repo.schreibe(r.saetze, laufId);
  const zahlen = { gefunden: r.saetze.length, uebernommen: w.uebernommen, verworfen: w.verworfen, fehler: 0 };
  await repo.laufEnde(laufId, zahlen, { warnungen: r.warnungen, offeneSpalten: r.offeneSpalten });
  return zahlen;
}

/* v1066-WP2-5 · Ein Profil-Lauf. Kein Modell ohne Beleg: der Parser
 * verwirft, was seine eigenen Stuetzstellen nicht nachrechnet, und sagt es. */
async function ernteProfil(repo) {
  if (!profilId) throw new Error('--profil fehlt. Liste: --profile');
  const text = fs.readFileSync(textDatei, 'utf8');
  console.log('lese', textDatei, `(${Math.round(text.length / 1024)} kB)`, '· Profil', profilId);
  const r = P2.parse(profilId, text, { quelleUrl: quelleUrl || textDatei });
  for (const w of r.warnungen) console.log('  HINWEIS:', w);
  console.log(`  ${r.modelle.length} Modell(e) belegt, ${r.verworfen.length} verworfen, ${r.saetze.length} Spannen`);
  for (const m of r.modelle) {
    console.log(`    ${m.zweig}: ${m.belege_geprueft} Stuetzstellen getroffen`);
  }
  if (trocken) {
    console.log('  TROCKENLAUF — nichts geschrieben');
    if (r.modelle[0]) console.log(JSON.stringify(r.modelle[0], null, 2));
    return { gefunden: r.modelle.length, uebernommen: 0, verworfen: 0 };
  }
  const laufId = await repo.laufStart('cli-p2', [P2.PROFILE[profilId].LAND]);
  const wm = await repo.schreibeModelle(r.modelle);
  const ws = await repo.schreibe(r.saetze, laufId);
  const zahlen = { gefunden: r.modelle.length + r.saetze.length,
    uebernommen: wm.uebernommen + ws.uebernommen,
    verworfen: wm.verworfen + ws.verworfen + r.verworfen.length, fehler: 0 };
  await repo.laufEnde(laufId, zahlen, { profil: profilId, warnungen: r.warnungen,
    verworfen: r.verworfen });
  return zahlen;
}

async function uebernimmProbe(repo, datei) {
  const roh = JSON.parse(fs.readFileSync(datei, 'utf8'));
  const eintraege = [];
  for (const b of roh) {
    for (const t of (b.treffer || [])) {
      eintraege.push({
        land_code: b.code, schluessel: t.schluessel, url: t.url,
        http_status: t.status, content_type: t.typ, bytes: t.bytes,
        urteil: t.urteil, dauer_ms: t.ms, fehler: t.fehler || null,
      });
    }
  }
  if (trocken) { console.log(`  TROCKENLAUF — ${eintraege.length} Probe-Eintraege wuerden geschrieben`); return eintraege.length; }
  const n = await repo.probeSchreiben(eintraege);
  console.log(`  ${n} Probe-Eintraege uebernommen`);
  return n;
}

(async () => {
  let pool;
  try {
    const v = await verbinde();
    pool = v.pool;
    const repo = machRepository(v.q);

    if (willImbde) {
      const z = await ernteImbde(repo);
      console.log('');
      console.log(`IMB-DE: gefunden ${z.gefunden} | uebernommen ${z.uebernommen} | verworfen ${z.verworfen}`);
    }
    if (textDatei) {   /* v1066-WP2-6 */
      const z = await ernteProfil(repo);
      console.log('');
      console.log(`P2 ${profilId}: gefunden ${z.gefunden} | uebernommen ${z.uebernommen} | verworfen ${z.verworfen}`);
    }
    if (probeDatei) {
      console.log('uebernehme Probe aus', probeDatei);
      await uebernimmProbe(repo, probeDatei);
    }
  } catch (e) {
    console.error('FEHLER:', e.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
})();
