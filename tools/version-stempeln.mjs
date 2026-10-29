#!/usr/bin/env node
/* v3035 · Versionspflege — stempelt frontend/version.json.
   Aufruf (laeuft in tools/rollout-prod.ps1 vor dem Merge):
     node tools/version-stempeln.mjs            patch +1, Datum und Paket neu
     node tools/version-stempeln.mjs --minor    minor +1, patch 0  (Marcel kuendigt eine Version an)
     node tools/version-stempeln.mjs --major    major +1, minor 0, patch 0
     node tools/version-stempeln.mjs --zeigen   nur anzeigen
   Paket = die hoechste vNNNN-Nummer in den letzten 200 Commit-Betreffs. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DATEI = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'version.json');
const v = JSON.parse(readFileSync(DATEI, 'utf8'));
const arg = process.argv.slice(2);
if (arg.includes('--zeigen')) { console.log(`Version ${v.major}.${v.minor}.${v.patch} - ${v.stand} - ${v.paket}`); process.exit(0); }

if (arg.includes('--major')) { v.major += 1; v.minor = 0; v.patch = 0; }
else if (arg.includes('--minor')) { v.minor += 1; v.patch = 0; }
else v.patch += 1;

const d = new Date();
v.stand = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
try {
  const log = execSync('git log -200 --format=%s', { encoding: 'utf8' });
  const nr = [...log.matchAll(/\bv(\d{3,5})[a-z]?\b/g)].map((m) => +m[1]);
  if (nr.length) v.paket = 'v' + Math.max(...nr);
} catch (e) { /* ohne git bleibt das Paket */ }

writeFileSync(DATEI, JSON.stringify(v, null, 2) + '\n', 'utf8');
console.log(`Version ${v.major}.${v.minor}.${v.patch} - ${v.stand} - ${v.paket}`);
