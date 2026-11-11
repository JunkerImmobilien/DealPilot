#!/usr/bin/env node
/* tools/takt-sperre-pruefen.mjs — v3311 · Sperre gegen Doppellauf der Hintergrund-Takte
 *
 *   node tools/takt-sperre-pruefen.mjs            A Bestand + B Logik (ohne Datenbank)
 *   node tools/takt-sperre-pruefen.mjs --live     zusätzlich C: zwei parallele Läufe gegen die ECHTE
 *                                                 Datenbank in beiden Containern auf Staging (nur Sperren,
 *                                                 schreibt nichts)
 *   --server=root@…                               anderer Server für --live (nur lesend, auch Prod)
 *
 * A  Jedes setInterval/setTimeout-Takt in backend/src und marktbericht/backend/src ist entweder unter
 *    taktSperre gewickelt oder steht in der Liste der reinen Speicher-Takte (räumen nur den Arbeitsspeicher
 *    DIESES Prozesses auf — eine Sperre wäre dort falsch). Ein neuer Takt ohne Sperre = rot.
 * B  Die ECHTEN Dateien (utils/taktSperre.js, lib/taktSperre.js) mit einem Pool, der Beratungssperren
 *    wie Postgres je Sitzung führt: zwei gleichzeitige Läufe → genau einer läuft; danach ist frei;
 *    ein werfender Lauf gibt frei; eine kaputte Freigabe verwirft die Verbindung; unbekannter Name wirft.
 * C  wie B, aber mit pg_try_advisory_lock der echten Datenbank.
 * RC=0 sauber.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let fehler = 0;
const ok = (t) => console.log('  ok   ' + t);
const rot = (t) => { fehler++; console.log('  ROT  ' + t); };

/* ── A · Bestand ──────────────────────────────────────────────────────── */
const SPEICHER_TAKTE = [   // Datei + Merkmal der Zeile · Begründung
  ['backend/src/index.js', '_limitGedaechtnis', 'räumt die Bremse im Arbeitsspeicher auf'],
  ['backend/src/routes/unterlagen.js', '_auftraege', 'räumt Recherche-Aufträge im Arbeitsspeicher auf'],
  ['backend/src/ws/voiceStream.js', 'commitTimer', 'je WebSocket-Verbindung, kein Takt'],
];
function dateien(dir) {
  const aus = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|generated/.test(e.name)) aus.push(...dateien(p)); }
    else if (e.name.endsWith('.js')) aus.push(p);
  }
  return aus;
}
console.log('A · Bestand der Takte');
const liste = [];
for (const basis of ['backend/src', 'marktbericht/backend/src']) {
  for (const f of dateien(path.join(WURZEL, basis))) {
    const rel = path.relative(WURZEL, f).replace(/\\/g, '/');
    const zeilen = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    const text = zeilen.join('\n');
    zeilen.forEach((z, i) => {
      if (/^\s*(\/\/|\*)/.test(z)) return;
      const m = /\bsetInterval\(\s*([A-Za-z_$][\w$]*)?/.exec(z);
      if (!m) return;
      const sp = SPEICHER_TAKTE.find(([d, merk]) => d === rel && (text.split('\n').slice(Math.max(0, i - 3), i + 4).join('\n')).includes(merk));
      if (sp) { liste.push([rel + ':' + (i + 1), 'Speicher-Takt (' + sp[2] + ')']); return; }
      const ident = m[1];
      const gewickelt = ident && new RegExp('\\b' + ident.replace('$', '\\$') + '\\s*=\\s*(require\\([^)]*taktSperre[^)]*\\)\\.takt|_ts\\.takt|_taktSperre)\\(\\s*[\'"](\\w+)').exec(text);
      if (gewickelt) liste.push([rel + ':' + (i + 1), 'Sperre „' + gewickelt[2] + '“']);
      else { liste.push([rel + ':' + (i + 1), 'OHNE SPERRE']); rot(rel + ':' + (i + 1) + ' setInterval ohne taktSperre: ' + z.trim().slice(0, 90)); }
    });
  }
}
liste.forEach(([wo, was]) => console.log('       ' + wo.padEnd(62) + was));
const gewickelt = liste.filter(([, w]) => w.startsWith('Sperre')).length;
if (gewickelt >= 10) ok(gewickelt + ' Takte unter Sperre, ' + liste.filter(([, w]) => w.startsWith('Speicher')).length + ' reine Speicher-Takte');
else rot('nur ' + gewickelt + ' Takte unter Sperre gefunden (erwartet ≥ 10)');
/* Einmal-Läufe beim Start, die ebenfalls gesperrt sind */
const idx = fs.readFileSync(path.join(WURZEL, 'backend/src/index.js'), 'utf8');
if (/takt\('plansSync'/.test(idx)) ok('plans-sync beim Start unter Sperre'); else rot('plans-sync ohne Sperre');

/* ── B · Logik an den echten Dateien ──────────────────────────────────── */
function falscherPool(opt) {
  opt = opt || {};
  const sperren = new Map(); // schluessel -> sitzung
  let sitzungen = 0;
  const p = { verworfen: 0, offen: 0,
    async connect() {
      const id = ++sitzungen; p.offen++;
      return {
        async query(sql, args) {
          const k = args.join(':');
          if (/pg_try_advisory_lock/.test(sql)) {
            await new Promise((r) => setTimeout(r, 5));
            if (sperren.has(k) && sperren.get(k) !== id) return { rows: [{ ok: false }] };
            sperren.set(k, id); return { rows: [{ ok: true }] };
          }
          if (/pg_advisory_unlock/.test(sql)) {
            if (opt.unlockWirft) throw new Error('Verbindung weg');
            if (sperren.get(k) === id) sperren.delete(k); return { rows: [{ pg_advisory_unlock: true }] };
          }
          throw new Error('unerwartet: ' + sql);
        },
        release(verwerfen) {
          p.offen--;
          if (verwerfen) { p.verworfen++; for (const [k, s] of sperren) if (s === id) sperren.delete(k); }
        }
      };
    }, sperren };
  return p;
}
async function logik(etikett, mod, name) {
  console.log('B · Logik ' + etikett);
  const leise = console.log; console.log = () => {};
  try {
    const pool = falscherPool();
    let laeufe = 0;
    const langsam = async () => { laeufe++; await new Promise((r) => setTimeout(r, 40)); return 'fertig'; };
    const [a, b] = await Promise.all([mod.mitSperre(name, langsam, { pool }), mod.mitSperre(name, langsam, { pool })]);
    console.log = leise;
    if (laeufe === 1 && [a.lief, b.lief].filter(Boolean).length === 1) ok('zwei gleichzeitige Läufe: genau einer lief, einer übersprungen');
    else rot('zwei gleichzeitige Läufe: ' + laeufe + ' liefen');
    if (pool.sperren.size === 0 && pool.offen === 0) ok('danach Sperre frei und Verbindungen zurück im Pool'); else rot('Sperre/Verbindung hängt: ' + pool.sperren.size + '/' + pool.offen);
    console.log = () => {};
    const c = await mod.mitSperre(name, async () => 7, { pool });
    let warf = false; try { await mod.mitSperre(name, async () => { throw new Error('x'); }, { pool }); } catch (e) { warf = true; }
    const nachWurf = pool.sperren.size;
    const p2 = falscherPool({ unlockWirft: true });
    await mod.mitSperre(name, async () => 1, { pool: p2 });
    let unbekannt = false; try { await mod.mitSperre('gibt-es-nicht', async () => 1, { pool }); } catch (e) { unbekannt = true; }
    /* der Wrapper für setInterval wirft nie */
    let wrapperWarf = false; try { await mod.takt(name, async () => { throw new Error('y'); }, { pool })(); } catch (e) { wrapperWarf = true; }
    console.log = leise;
    if (c.lief && c.ergebnis === 7) ok('dritter Lauf danach läuft und gibt sein Ergebnis zurück'); else rot('dritter Lauf lief nicht');
    if (warf && nachWurf === 0) ok('werfender Lauf: Fehler kommt durch, Sperre frei'); else rot('werfender Lauf: warf=' + warf + ' Sperren=' + nachWurf);
    if (p2.verworfen === 1 && p2.sperren.size === 0) ok('kaputte Freigabe: Verbindung verworfen (Sitzungsende gibt frei)'); else rot('kaputte Freigabe nicht verworfen');
    if (unbekannt) ok('unbekannter Takt-Name wirft'); else rot('unbekannter Name lief');
    if (!wrapperWarf) ok('takt()-Wrapper wirft nie (kein unbehandelter Fehler im Intervall)'); else rot('takt()-Wrapper warf');
  } finally { console.log = leise; }
}
await logik('backend/src/utils/taktSperre.js', require(path.join(WURZEL, 'backend/src/utils/taktSperre.js')), 'retention');
await logik('marktbericht/backend/src/lib/taktSperre.js', await import(pathToFileURL(path.join(WURZEL, 'marktbericht/backend/src/lib/taktSperre.js')).href), 'harvest');

/* ── C · echte Datenbank ──────────────────────────────────────────────── */
if (process.argv.includes('--live')) {
  const server = (process.argv.find((a) => a.startsWith('--server=')) || '--server=root@116.203.214.11').slice(9);
  console.log('C · echte Datenbank auf ' + server + ' (nur Beratungssperren, schreibt nichts)');
  const probe = (mod) => `
const lang = async () => { await new Promise((r) => setTimeout(r, 1500)); return 1; };
const leise = console.log; console.log = () => {};
const [a, b] = await Promise.all([M.mitSperre(N, lang), M.mitSperre(N, lang)]);
const c = await M.mitSperre(N, async () => 2);
console.log = leise;
console.log('ERGEBNIS ' + JSON.stringify({ liefen: [a.lief, b.lief].filter(Boolean).length, danach: c.lief }));
process.exit(0);`;
  const laeufe = [
    ['dealpilot-backend', 'node', `(async () => { const M = require('/app/src/utils/taktSperre.js'); const N = 'retention';` + probe() + `})();`],
    ['dealpilot-mb-backend', 'node --input-type=module', `const M = await import('/app/src/lib/taktSperre.js'); const N = 'harvest';` + probe()],
  ];
  for (const [ct, bin, code] of laeufe) {
    const r = spawnSync('ssh', [server, `docker exec -i ${ct} ${bin} -`], { input: code, encoding: 'utf8' });
    const m = /ERGEBNIS (\{.*\})/.exec(r.stdout || '');
    if (!m) { rot(ct + ': kein Ergebnis (' + String(r.stderr || r.stdout).trim().slice(0, 160) + ')'); continue; }
    const e = JSON.parse(m[1]);
    if (e.liefen === 1 && e.danach) ok(ct + ': zwei parallele Läufe gegen Postgres → einer lief, danach frei');
    else rot(ct + ': ' + m[1]);
  }
}

console.log(fehler ? '\nROT: ' + fehler + ' Befund(e)' : '\nsauber (RC=0)');
process.exit(fehler ? 1 : 0);
