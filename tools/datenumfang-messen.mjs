#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   datenumfang-messen.mjs · landing-kern-1, umgebaut v3930 (landing-zahlen-live-1)
   — DATENUMFANG DER LANDING, STATISCHER RÜCKFALL

   Marcel 11.11.2026: „Wir haben noch eine Million amtliche Daten … wie viele
   Schnittstellen, wie viele Werte insgesamt, wie oft wir was abrufen."
   Marcel 20.11.2026: die Zahlen sollen sich nach der Datenbank aktualisieren.

   SEIT v3930 setzt die Landing ihre Zahlen im Browser selbst nach
   (frontend/landing/landing-zahlen.js ← GET /api/v1/public/datenumfang, der
   auf den Datenbanken des Servers zählt, auf dem er läuft). Dieses Werkzeug
   schreibt nur noch den RÜCKFALL: die Zahlen statisch ins HTML (für
   Suchmaschinen, Vorschauen und wenn der Endpunkt nicht antwortet) und
   frontend/landing/datenumfang.js (window.DPS_UMFANG, Protokoll der Messung).

   GEMESSEN, NICHT GESCHÄTZT. Die Rechnung steht an EINER Stelle:
     SQL_MB, mbTakteRoh(), borisDienste(), registerStandBerechnen()
                         marktbericht/backend/src/lib/datenumfang.js
     SQL_HAUPT, bauzinsUhr(), takteAus(), zusammensetzen()
                         backend/src/services/datenumfang.js
   Endpunkt und Werkzeug rufen dieselben Funktionen.

   Woher die Zahlen kommen (Entscheidung v3930):
     Standard  der öffentliche Endpunkt der PRODUKTION (nur lesend, ohne
               Anmeldung) — die Landing zeigt Produktion, also misst der
               Rückfall Produktion. Kein ssh nötig.
     --url=…   anderer Endpunkt (z. B. https://app.staging.dealpilot.immo/api/v1/public/datenumfang)
     --ssh[=root@…]  wie bis v3929: psql per ssh, nur lesend (Standard
               Staging). Antwortet der Endpunkt nicht (z. B. vor dem
               Prod-Rollout von v3930), fällt das Werkzeug von selbst
               hierauf zurück und sagt es.
     --ohne-db nimmt die DB-Zahlen aus der letzten datenumfang.js
   Aus dem REPO (stehen nicht in einem Image): API-Endpunkte, Prüfwerkzeuge,
   Videos (videos.json).

   „Amtlich" zählt nur, was von einer Behörde stammt: Zensus 2022 und
   Regionaldatenbank, Bautätigkeit/Baulandpreise, AK OGA, Register der
   Gutachterausschüsse, amtliche Kennzahlen in mb.wert_parameter (A–C, ohne
   § 256), Preisindizes des Statistischen Bundesamts, Zinsreihen der
   Bundesbank. Angebots- und Bewertungspartner-Daten zählen NIE mit.

   Rückgabe 0 · 1 bei Messfehler oder wenn „1 Million" im HTML steht, aber
   die Messung darunter liegt.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = join(WURZEL, 'frontend/landing');
const ZIEL = join(LANDING, 'datenumfang.js');
const require = createRequire(import.meta.url);
const arg = (n) => { const a = process.argv.find((x) => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const OHNE_DB = !!arg('ohne-db');
const SSH = arg('ssh');
const HOST = typeof SSH === 'string' ? SSH : (arg('host') || 'root@116.203.214.11');
const URL_END = arg('url') || 'https://app.dealpilot.immo/api/v1/public/datenumfang';
let fehler = 0;
const fmt = (n) => Number(n).toLocaleString('de-DE');

const H = require(join(WURZEL, 'backend/src/services/datenumfang.js'));
const M = await import(pathToFileURL(join(WURZEL, 'marktbericht/backend/src/lib/datenumfang.js')).href);

function ladeSkript(datei, name) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(datei, 'utf8'), ctx);
  return ctx.window[name];
}
const altU = fs.existsSync(ZIEL) ? (() => { try { return ladeSkript(ZIEL, 'DPS_UMFANG'); } catch (e) { return null; } })() : null;

/* ── 1 · Messung: Endpunkt, ssh oder letzte Datei ───────────────────── */
let DB, REG, BORIS, TAKTE, NUTZER = null, quelle, endKopf = null;

async function ausEndpunkt() {
  const r = await fetch(URL_END, { signal: AbortSignal.timeout(60000), headers: { Origin: 'https://dealpilot.immo' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || !j.ok || !j.db || !j.register) throw new Error('Antwort ohne db/register');
  return j;
}
function psql(container, user, db, sql) {
  const cmd = `docker exec -i ${container} psql -U ${user} -d ${db} -At -F'|' -v ON_ERROR_STOP=1`;
  const out = execFileSync('ssh', ['-o', 'ConnectTimeout=15', HOST, cmd], { input: sql, encoding: 'utf8' });
  return M.zeilenZuObjekt(M.psqlZuZeilen(out));
}
async function perSsh() {
  DB = Object.assign(psql('dealpilot-mb-db', 'mb', 'marktbericht', M.SQL_MB), psql('dealpilot-postgres', 'dealpilot', 'dealpilot_db', H.SQL_HAUPT));
  const RS = await M.registerStandBerechnen();
  REG = { stand: new Date().toISOString().slice(0, 10), dateien: RS.dateien, saetze: RS.saetze, kopf: RS.kopf };
  BORIS = await M.borisDienste();
  TAKTE = H.takteAus(M.mbTakteRoh(), H.bauzinsUhr());
  quelle = 'ssh/psql nur lesend (SELECT count) · Register und Takte aus dem Repo';
  /* Nutzer: dieselbe öffentliche Route, die die Landing fragt (Prod, nur lesend) */
  try {
    const r = await fetch(arg('nutzer-url') || 'https://app.dealpilot.immo/api/v1/public/stats', { signal: AbortSignal.timeout(15000), headers: { Origin: 'https://dealpilot.immo' } });
    const j = r.ok ? await r.json() : null;
    if (j && Number.isFinite(j.registrierte_nutzer)) NUTZER = j.registrierte_nutzer;
  } catch (e) { /* unten */ }
}

if (OHNE_DB) {
  if (!altU || !altU.db) { console.error('--ohne-db: keine frühere Messung in datenumfang.js'); process.exit(1); }
  DB = Object.assign({}, altU.db); delete DB.host; delete DB.gemessen;
  const RS = await M.registerStandBerechnen();
  REG = { stand: new Date().toISOString().slice(0, 10), dateien: RS.dateien, saetze: RS.saetze, kopf: RS.kopf };
  BORIS = await M.borisDienste();
  TAKTE = H.takteAus(M.mbTakteRoh(), H.bauzinsUhr());
  quelle = 'DB-Zahlen aus der Messung vom ' + (altU.db_gemessen || '?') + ' · Register und Takte aus dem Repo';
  console.log('DB-Zahlen aus der letzten Messung vom ' + altU.db_gemessen);
} else if (!SSH) {
  try {
    const j = await ausEndpunkt();
    DB = j.db; REG = j.register; BORIS = j.boris_dienste || []; TAKTE = j.takte; endKopf = j.kopf;
    NUTZER = Number.isFinite(j.kopf && j.kopf.nutzer) ? j.kopf.nutzer : null;
    quelle = 'Endpunkt /api/v1/public/datenumfang ' + (j.version || '') + ', gemessen ' + j.gemessen;
    console.log('Messung vom Endpunkt ' + URL_END.replace(/^https?:\/\/([^/]+).*$/, '$1') + ' (' + j.gemessen + ')');
  } catch (e) {
    console.log('Endpunkt ' + URL_END + ' antwortet nicht (' + e.message + ') — Rückfall: ssh ' + HOST);
  }
}
if (!DB) {
  try { await perSsh(); } catch (e) { console.error('Messung per ssh auf ' + HOST + ' fehlgeschlagen: ' + e.message); process.exit(1); }
}
if (NUTZER == null) {
  if (altU && altU.kopf && Number.isFinite(altU.kopf.nutzer)) { NUTZER = altU.kopf.nutzer; console.log('Nutzer nicht messbar, letzte Messung ' + NUTZER); }
  else { console.error('Nutzer nicht messbar, keine frühere Messung'); fehler++; }
}
for (const [k, v] of Object.entries(TAKTE || {})) if (v == null) { console.error('Takt nicht gefunden: ' + k); fehler++; }

/* ── 2 · Harte Zahlen aus dem Repo (landing-strecke-3) ──────────────── */
/* API-Endpunkte: jede Route (Methode + Pfad je Datei) in Haupt-App und Marktbericht-Backend */
function jsDateien(d, o = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const q = join(d, f.name);
    if (f.isDirectory()) { if (!/^(node_modules|generated|test|tests|__tests__)$/.test(f.name)) jsDateien(q, o); }
    else if (/\.(m?js)$/.test(f.name)) o.push(q);
  }
  return o;
}
function endpunkte(basis) {
  const s = new Set();
  const re = /^\s*(?:router|app)\.(get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]*)\2\s*,/;
  for (const f of jsDateien(join(WURZEL, basis))) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((z) => { const m = z.match(re); if (m) s.add(f + '|' + m[1] + '|' + m[3]); });
  }
  return s.size;
}
const api_haupt = endpunkte('backend/src'), api_mb = endpunkte('marktbericht/backend/src');
const pruefDateien = [];
for (const d of ['tools', ...fs.readdirSync(join(WURZEL, 'tools'), { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => 'tools/' + x.name)]) {
  for (const f of fs.readdirSync(join(WURZEL, d))) if (/(-pruefen|-test)\.(mjs|js|py)$/.test(f)) pruefDateien.push(d + '/' + f);
}
const VJ = JSON.parse(fs.readFileSync(join(LANDING, 'assets/videothek/videos.json'), 'utf8'));
const videos = (VJ.videos || []).length;
const videoSek = (VJ.videos || []).reduce((s, v) => s + (Number(v.dauer) || 0), 0);
const FAKTEN = {
  nutzer: NUTZER,
  api_endpunkte: api_haupt + api_mb, api_haupt, api_mb,
  pruefstrecken: pruefDateien.length,
  /* dieselbe Regel wie landing-zahlen.js im Browser: Stunden auf eine Stelle */
  videos, video_stunden: Math.round(videoSek / 360) / 10,
};

/* ── 3 · Rechnen — dieselbe Funktion wie der Endpunkt ───────────────── */
const Z = H.zusammensetzen({ db: DB, reg: REG, boris: BORIS, takte: TAKTE, fakten: FAKTEN });
for (const k of Z.fehlend) { console.error('fehlt: ' + k); fehler++; }
if (endKopf) {
  /* Selbstprobe: rechnet der Endpunkt mit derselben Rechnung wie dieses Repo? */
  const ab = Object.keys(endKopf).filter((k) => JSON.stringify(endKopf[k]) !== JSON.stringify(Z.kopf[k]));
  if (ab.length) { console.error('Endpunkt rechnet anders als das Repo bei: ' + ab.join(', ') + ' — anderer Stand ausgerollt?'); fehler++; }
}
const amtlich = Z.amtlich, rund = Z.rund;

const jetzt = new Date().toISOString();
const U = {
  stand: jetzt.slice(0, 10),
  db_gemessen: OHNE_DB ? altU.db_gemessen || null : jetzt,
  quelle: 'tools/datenumfang-messen.mjs · ' + quelle,
  db: Object.assign({}, DB, { gemessen: OHNE_DB ? altU.db_gemessen || null : jetzt }),
  teile: Z.teile, takte: TAKTE,
  boris_dienste: BORIS,
  kopf: Z.kopf,
  fakten: FAKTEN,
};
delete U.db.host;   /* v3930: keine Hostnamen oder Adressen in einer öffentlichen Datei */

const kopfText = '/* datenumfang-messen.mjs · erzeugt ' + jetzt + ' — NICHT von Hand ändern.\n'
  + '   Neu erzeugen: node tools/datenumfang-messen.mjs (statischer Rückfall; live: landing-zahlen.js) */\n';
fs.writeFileSync(ZIEL, kopfText + 'window.DPS_UMFANG = ' + JSON.stringify(U, null, 1) + ';\n');

/* ── 4 · Zahlen statisch ins HTML (Rückfall) ────────────────────────── */
const TEXT = (k, q) => { const v = q[k]; return v == null ? null : (typeof v === 'number' ? fmt(v) : String(v)); };
const regKopf = Object.assign({}, REG.kopf, { stand: String(REG.stand).split('-').reverse().join('.') });
let geaendert = 0;
for (const f of fs.readdirSync(LANDING).filter((x) => x.endsWith('.html'))) {
  const p = join(LANDING, f);
  let t = fs.readFileSync(p, 'utf8'); const vor = t;
  for (const [attr, q] of [['data-umfang', U.kopf], ['data-reg', REG.kopf], ['data-k', regKopf]]) {
    t = t.replace(new RegExp('(<[a-z]+[^>]*\\s' + attr + '="([a-z_]+)"[^>]*>)([^<]*)(<)', 'g'), (m, auf, k, alt, zu) => {
      const neu = TEXT(k, q); return neu == null ? m : auf + neu + zu;
    });
  }
  if (amtlich < 1e6 && /1 Million/.test(t)) { console.error(f + ': nennt „1 Million", gemessen sind ' + fmt(amtlich)); fehler++; }
  if (t !== vor) { fs.writeFileSync(p, t); geaendert++; console.log('  HTML nachgezogen: ' + f); }
}

console.log('amtliche Datenpunkte: ' + fmt(amtlich) + ' (' + rund + ')');
console.log('  ' + Object.entries(Z.teile).map(([k, v]) => k + ' ' + fmt(v)).join(' · '));
console.log('Schnittstellen: ' + Z.schnitt_gesamt + ' (' + Object.entries(Z.schnitt).map(([k, v]) => k + ' ' + v).join(', ') + ') · Portale ' + DB.portale + ' in ' + DB.portale_laender + ' Ländern');
console.log('Harte Zahlen: Nutzer ' + FAKTEN.nutzer + ' (Anzeige > ' + Z.kopf.nutzer_rund + ') · API-Endpunkte ' + FAKTEN.api_endpunkte + ' (Haupt-App ' + api_haupt + ', Marktbericht ' + api_mb + ') · Register-Sätze ' + fmt(REG.saetze) + ' · Länder mit Wert ' + REG.kopf.laender_mit_wert + ' · Prüfwerkzeuge ' + FAKTEN.pruefstrecken + ' · Videos ' + videos + ' (' + fmt(FAKTEN.video_stunden) + ' h)');
console.log('Takte: ' + JSON.stringify(TAKTE));
console.log('geschrieben: frontend/landing/datenumfang.js · ' + geaendert + ' HTML-Datei(en) nachgezogen');
process.exit(fehler ? 1 : 0);
