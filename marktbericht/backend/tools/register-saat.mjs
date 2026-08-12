#!/usr/bin/env node
// v1083-WSAAT · Saatlauf: Registerdatensaetze nach mb.param_modell.
//
// Nutzt das VORHANDENE param-repository (schreibeModelle), kein eigenes SQL.
// Protokoll nach mb.param_lauf, wie fuer die Open-Data-Ernte auch.
//
// Aufruf im Container:
//   docker exec dealpilot-mb-backend node /app/tools/register-saat.mjs
//   docker exec dealpilot-mb-backend node /app/tools/register-saat.mjs --trocken

import { readFileSync } from 'node:fs';
// db.js und das Repository werden ERST NACH der Vorpruefung geladen. So laeuft
// `--trocken` ueberall, auch ohne installiertes 'pg' — die Saatdatei laesst
// sich damit vor dem Deploy pruefen, nicht erst im Container.

const TROCKEN = process.argv.includes('--trocken');
const DATEI = new URL('../src/lib/register/lzs-nrw.json', import.meta.url);

const saetze = JSON.parse(readFileSync(DATEI, 'utf8'));
console.log(`Saatdatei: ${saetze.length} Datensaetze`);

// Vorpruefung mit denselben Pflichtfeldern, die schreibeModelle() anlegt.
const pflicht = ['quelle_url', 'kennzahl', 'ags', 'land_code', 'formel', 'belege'];
const schlecht = saetze.filter((m) => !pflicht.every((f) => m[f])
                                   || !Array.isArray(m.belege) || !m.belege.length);
if (schlecht.length) {
  console.error(`ABBRUCH: ${schlecht.length} Saetze ohne Pflichtfeld — nichts geschrieben.`);
  console.error('  Beispiel:', JSON.stringify(schlecht[0]).slice(0, 240));
  process.exit(1);
}
console.log('Vorpruefung: alle Saetze vollstaendig (inkl. Belege).');

if (TROCKEN) { console.log('Trockenlauf — es wird nichts geschrieben.'); process.exit(0); }

const { q } = await import('../src/lib/db.js');
const { machRepository } = await import('../src/connectors/opendata/param-repository.js');
const repo = machRepository(q);
const lauf = await repo.laufStart('v1083-register-saat', ['NW']);
console.log(`param_lauf id=${lauf}`);
const r = await repo.schreibeModelle(saetze);
console.log(`uebernommen ${r.uebernommen} · verworfen ${r.verworfen}`);
// Signatur am Code gelesen, nicht geraten: laufEnde(id, zahlen, protokoll)
// nimmt das Protokoll als DRITTES Argument, nicht als Feld in `zahlen`.
await repo.laufEnde(lauf,
  { gefunden: saetze.length, uebernommen: r.uebernommen, verworfen: r.verworfen, fehler: 0 },
  { quelle: 'GMDNRW_CSV.zip', parser: 'v1083-WLZS', lizenz: 'dl-de/zero-2-0',
    berichtsjahr: saetze[0] && saetze[0].berichtsjahr,
    quellenvermerk: saetze[0] && saetze[0].quellenvermerk });

// Gegenprobe: steht wirklich drin, was wir geschrieben haben?
const n = await q('SELECT count(*)::int AS n FROM mb.param_modell WHERE quelle_parser = $1',
                  ['v1083-WLZS']);
console.log(`Gegenprobe: ${n[0].n} Zeilen in mb.param_modell mit quelle_parser=v1083-WLZS`);
process.exit(r.uebernommen > 0 ? 0 : 1);
