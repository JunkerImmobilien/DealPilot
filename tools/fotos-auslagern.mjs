#!/usr/bin/env node
/* tools/fotos-auslagern.mjs — v3310 · base64-Fotos des Altbestands in die Dateiablage (Aufruf von außen)
 *
 *   node tools/fotos-auslagern.mjs                         Trockenlauf auf Staging (Standard)
 *   node tools/fotos-auslagern.mjs --ausfuehren [--vacuum] umziehen auf Staging
 *   node tools/fotos-auslagern.mjs --prod                  Trockenlauf auf Produktion (nur lesend)
 *
 * --ausfuehren zusammen mit --prod wird verweigert: der Umzug auf Produktion braucht Marcels Freigabe
 * und vorher eine angesehene Sicherung (CLAUDE.md, Server). Die Arbeit macht backend/scripts/fotos-auslagern.js
 * im Container — dort liegen DATEI_SCHLUESSEL und das Laufwerk.
 */
import { spawnSync } from 'node:child_process';

const arg = process.argv.slice(2);
const prod = arg.includes('--prod');
const ausfuehren = arg.includes('--ausfuehren');
if (prod && ausfuehren) {
  console.error('Verweigert: --ausfuehren nur auf Staging. Auf Produktion erst Freigabe, pg_dump, Sicherung ansehen.');
  process.exit(2);
}
const server = prod ? 'root@157.90.117.167' : 'root@116.203.214.11';
const extra = [ausfuehren ? '--ausfuehren' : '', arg.includes('--vacuum') && ausfuehren ? '--vacuum' : ''].filter(Boolean).join(' ');
const befehl = 'docker exec dealpilot-backend node scripts/fotos-auslagern.js ' + extra;
console.log('[' + (prod ? 'PROD' : 'STAGING') + '] ' + befehl);
const r = spawnSync('ssh', [server, befehl], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
