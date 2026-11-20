#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/landing-zahlen-pruefen.mjs · v3930 (landing-zahlen-live-1)
   — ZAHLEN DER LANDING LIVE AUS DER DATENBANK

   node tools/landing-zahlen-pruefen.mjs           A–C ohne Netz und Datenbank
   node tools/landing-zahlen-pruefen.mjs --live    zusätzlich D gegen Staging:
        GET https://app.staging.dealpilot.immo/api/v1/public/datenumfang
        gegen dieselbe SQL per ssh/psql (nur lesend)
   --url=…  --ssh=root@…   anderer Endpunkt / Server für D (nur lesend)

   A  Gemeinsames Modul: Werkzeug, Endpunkt und messe-schleife-daten.mjs
      rechnen mit DENSELBEN Funktionen (keine zweite SQL, keine zweite Summe);
      Route öffentlich, mit Bremse, interner mb-Weg nicht im Proxy; Einbindung
      in jede Seite mit data-umfang/data-reg/data-k.
   B  Endpunkt-Rechnung an den echten Modulen (echtes Register, echte BORIS-
      Liste, echte Takte; Datenbank nachgebaut): Antwort = Werkzeug-Rechnung =
      unabhängige Nachrechnung; psql- und pg-Lesart gleich; keine Hostnamen,
      Adressen oder Fremdfelder in der Antwort; Zwischenspeicher, Fehler-Rückfall;
      „1 Million"-Regel.
   C  landing-zahlen.js an den ECHTEN Seiten (index.html, methodik.html) in
      einem nachgebauten DOM: setzt die Werte, lässt data-nutzer stehen,
      Videos aus videos.json, Rückfall bei Fehler/503/Unsinn, Million-Regel,
      Zielhost je Landing-Domain.
   RC=0 sauber.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = join(WURZEL, 'frontend/landing');
const require = createRequire(import.meta.url);
const arg = (n) => { const a = process.argv.find((x) => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.split('=')[1] ?? true) : null; };
let fehler = 0;
const ok = (t) => console.log('  ok   ' + t);
const rot = (t) => { fehler++; console.log('  ROT  ' + t); };
const pruef = (b, t) => (b ? ok(t) : rot(t));
const lies = (p) => fs.readFileSync(join(WURZEL, p), 'utf8');
const fmt = (n) => Number(n).toLocaleString('de-DE');
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const H = require(join(WURZEL, 'backend/src/services/datenumfang.js'));
const M = await import(pathToFileURL(join(WURZEL, 'marktbericht/backend/src/lib/datenumfang.js')).href);

/* Hostnamen, Adressen, interne Namen: nichts davon darf in eine öffentliche Antwort */
const VERBOTEN = [
  [/\b\d{1,3}(\.\d{1,3}){3}\b/, 'IP-Adresse'],
  [/\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(immo|de|io|com|net|org|local|internal|nrw)\b/i, 'Hostname'],
  [/https?:\/\//i, 'URL'],
  [/mb-backend|mb-db|postgres|localhost|root@/i, 'interner Name'],
  [/@/, 'E-Mail/Anmeldung'],
];
function verboten(text) { return VERBOTEN.filter(([re]) => re.test(text)).map(([, n]) => n); }

/* ── A · Gemeinsames Modul und Verdrahtung ─────────────────────────────── */
console.log('A · Gemeinsames Modul und Verdrahtung');
const werkzeug = lies('tools/datenumfang-messen.mjs');
pruef(!/from mb\.|from markt_zins_tag|count\(\*\)/.test(werkzeug), 'datenumfang-messen.mjs führt keine eigene SQL (SQL_MB/SQL_HAUPT aus den Modulen)');
pruef(/H\.zusammensetzen\(/.test(werkzeug) && /M\.SQL_MB/.test(werkzeug) && /H\.SQL_HAUPT/.test(werkzeug), 'Werkzeug rechnet mit zusammensetzen(), SQL_MB, SQL_HAUPT');
pruef(!/Math\.floor\(amtlich \/ 1e5\)/.test(werkzeug), 'Werkzeug rundet nicht selbst (amtlichRund im Modul)');
const msd = lies('tools/messe-schleife-daten.mjs');
pruef(/registerStandBerechnen/.test(msd) && !/await registerDeckung\(/.test(msd), 'messe-schleife-daten.mjs nimmt registerStandBerechnen() aus lib/datenumfang.js');
const svc = lies('backend/src/services/datenumfang.js');
pruef(/zusammensetzen\(\{ db: DB/.test(svc), 'Endpunkt rechnet mit derselben zusammensetzen()');
const idx = lies('backend/src/index.js');
pruef(/app\.use\('\/api\/v1\/public\/datenumfang', rateLimit\(\{ windowMs: 60000, max: 60 \}\), require\('\.\/routes\/publicDatenumfang'\)\)/.test(idx), 'Route /api/v1/public/datenumfang öffentlich, Bremse 60/min wie /public/stats');
pruef(/require\('\.\/services\/datenumfang'\)\.starteTakt\(/.test(idx), 'täglicher Takt wird gestartet');
pruef(/_ts\.takt\('landingZahlen'/.test(svc) && /landingZahlen: \d+/.test(lies('backend/src/utils/taktSperre.js')), 'Takt unter takt(\'landingZahlen\') mit festem Schlüssel');
const route = lies('backend/src/routes/publicDatenumfang.js');
pruef(!/auth|requireAuth|authenticate/.test(route.replace(/\/\*[\s\S]*?\*\//g, '')), 'Route ohne Anmeldung');
pruef(/status\(503\)/.test(route), 'nicht messbar → 503, die Landing behält das HTML');
const api = lies('marktbericht/backend/src/routes/api.js');
pruef(/router\.get\('\/intern\/datenumfang'/.test(api), 'mb-Backend: interne Route /intern/datenumfang');
pruef(!/intern\/datenumfang/.test(lies('backend/src/routes/marktbericht.js')), 'interner mb-Weg steht NICHT im Proxy des Haupt-Backends');
pruef(/as k, count\(\*\)::text as v/.test(M.SQL_MB) && /as k, count\(\*\)::text as v/.test(H.SQL_HAUPT), 'SQL mit Spalten k/v (pg und psql lesen dieselbe Abfrage)');
pruef(!/insert|update|delete|drop|alter|truncate/i.test(M.SQL_MB + H.SQL_HAUPT), 'SQL nur lesend');
/* Einbindung */
const seiten = fs.readdirSync(LANDING).filter((f) => f.endsWith('.html'));
let ohne = [], reihenfolge = [];
for (const f of seiten) {
  const t = fs.readFileSync(join(LANDING, f), 'utf8');
  if (!/\sdata-(umfang|reg|k)="/.test(t)) continue;
  const i = t.indexOf('landing-zahlen.js?v='), j = t.indexOf('dp2.js?v=');
  if (i < 0) ohne.push(f); else if (j >= 0 && j > i) reihenfolge.push(f);
}
pruef(!ohne.length, 'jede Seite mit data-umfang/data-reg/data-k lädt landing-zahlen.js' + (ohne.length ? ' — fehlt: ' + ohne.join(', ') : ''));
pruef(!reihenfolge.length, 'landing-zahlen.js nach dp2.js' + (reihenfolge.length ? ' — falsch: ' + reihenfolge.join(', ') : ''));
const dp2 = fs.readFileSync(join(LANDING, 'dp2.js'), 'utf8');
pruef(/window\.DP2_setzeZahl = setzeZahl/.test(dp2) && /hasAttribute\('data-live'\)\) return; var v = R\.kopf/.test(dp2), 'dp2.js: Zähler freigegeben, register-stand.js überschreibt live gesetzte Zahlen nicht');
pruef(/if\(el\.hasAttribute\('data-live'\)\)return;/.test(fs.readFileSync(join(LANDING, 'methodik.html'), 'utf8')), 'methodik.html: Kacheln-Nachzug überschreibt live gesetzte Zahlen nicht');

/* ── B · Endpunkt-Rechnung an den echten Modulen ───────────────────────── */
console.log('B · Endpunkt-Rechnung');
/* Rohzählungen: die der letzten Messung (datenumfang.js), sonst feste Beispielzahlen */
let roh;
try {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(join(LANDING, 'datenumfang.js'), 'utf8'), ctx);
  roh = Object.assign({}, ctx.window.DPS_UMFANG.db); delete roh.host; delete roh.gemessen;
} catch (e) { roh = {}; }
const BEISPIEL = { zensus: 894880, zensus_tabellen: 10, zensus_gebiete: 11186, regional: 108676, regional_tabellen: 6, regional_gebiete: 11644, bau: 56128, bau_tabellen: 5, akoga: 28827, register_db: 6187, kennzahlen_gaa: 2557, indizes: 301, indizes_reihen: 3, portale: 109, portale_erreichbar: 109, portale_laender: 13, zins_tage: 1376, zins_werte: 2748, zins_monat_werte: 56, zins_seit: '2025-07-14' };
roh = Object.assign({}, BEISPIEL, roh);
const MB_KEYS = [...M.SQL_MB.matchAll(/select '([a-z_]+)'/g)].map((m) => m[1]);
const HAUPT_KEYS = [...H.SQL_HAUPT.matchAll(/select '([a-z_]+)'/g)].map((m) => m[1]);
pruef(MB_KEYS.length === 16 && HAUPT_KEYS.length === 4, 'SQL_MB 16, SQL_HAUPT 4 Kennzahlen');
const zeilen = (keys, extra) => keys.map((k) => ({ k, v: String((extra && k in extra) ? extra[k] : roh[k]) }));
let qAufrufe = 0;
const fakeQ = async (sql) => { qAufrufe++; if (sql !== M.SQL_MB) throw new Error('fremde SQL'); return zeilen(MB_KEYS); };
let hauptAufrufe = 0;
const fakeDb = { query: async (sql) => { hauptAufrufe++; if (sql !== H.SQL_HAUPT) throw new Error('fremde SQL'); return { rows: zeilen(HAUPT_KEYS) }; } };
/* psql-Lesart (Werkzeug --ssh) gegen pg-Lesart (Endpunkt) */
const psqlText = zeilen(MB_KEYS).map((z) => z.k + '|' + z.v).join('\n') + '\n';
pruef(gleich(M.zeilenZuObjekt(M.psqlZuZeilen(psqlText)), H.zeilenZuObjekt(zeilen(MB_KEYS))), 'psql -At und pg lesen dieselben Zahlen');

const MBR = await M.mbDatenumfang(fakeQ, { frisch: true });
const RS = await M.registerStandBerechnen();
pruef(gleich(MBR.register.kopf, RS.kopf) && MBR.register.saetze === RS.saetze, 'mb-Teil: Register = registerStandBerechnen() (' + fmt(RS.kopf.werte_gesamt) + ' Werte, ' + fmt(RS.saetze) + ' Sätze)');
try {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(join(LANDING, 'register-stand.js'), 'utf8'), ctx);
  const st = ctx.window.DPS_REGISTER;
  if (gleich(st.kopf, RS.kopf)) ok('register-stand.js entspricht dem Register im Repo');
  else console.log('  Hinweis  register-stand.js weicht vom Register im Repo ab (Ernte seit dem letzten Lauf) — node tools/messe-schleife-daten.mjs');
} catch (e) { rot('register-stand.js unlesbar'); }
await M.mbDatenumfang(fakeQ);
pruef(qAufrufe === 1, 'mb-Teil: zweiter Aufruf aus dem Zwischenspeicher');

/* Fremdfeld im mb-Teil: ein Hostname darf nicht durchrutschen */
const mbMitHost = JSON.parse(JSON.stringify(MBR)); mbMitHost.db.host = '116.203.214.11'; mbMitHost.db.notiz = 'mb-db.intern';
const NUTZER = 879;
const nutzerZahl = async () => ({ registrierte_nutzer: NUTZER, herkunft: { sockel: 865, gezaehlt: 14, summe: 879 } });
const jetzt = () => new Date('2026-11-20T08:00:00Z');
const A = await H.messen({ db: fakeDb, mbHolen: async () => mbMitHost, nutzerZahl, jetzt });
const text = JSON.stringify(A);
const v = verboten(text);
pruef(!v.length, 'Antwort ohne Hostnamen, Adressen, URLs, interne Namen' + (v.length ? ' — gefunden: ' + v.join(', ') : ''));
pruef(!('host' in A.db) && !('notiz' in A.db), 'Fremdfelder aus dem mb-Teil fallen heraus (nur Zahlen und Tage)');
pruef(!/user_id|email|e_mail|vorname|nachname|passwort|token/i.test(text), 'keine personenbezogenen Felder');
pruef(Object.values(A.db).every((x) => typeof x === 'number' || /^\d{4}-\d\d-\d\d$/.test(x)), 'db: nur Zählungen und Tage');
/* Werkzeug-Rechnung mit denselben Rohdaten */
const DBw = Object.assign(M.zeilenZuObjekt(zeilen(MB_KEYS)), H.zeilenZuObjekt(zeilen(HAUPT_KEYS)));
const W = H.zusammensetzen({ db: DBw, reg: { saetze: RS.saetze, kopf: RS.kopf }, boris: await M.borisDienste(), takte: H.takteAus(M.mbTakteRoh(), H.bauzinsUhr()), fakten: { nutzer: NUTZER } });
pruef(gleich(A.kopf, W.kopf), 'Endpunkt-Kopf = Werkzeug-Kopf (' + Object.keys(A.kopf).length + ' Kennzahlen)');
pruef(gleich(A.teile, W.teile) && gleich(A.schnittstellen, W.schnitt), 'Teile und Schnittstellen gleich');
/* unabhängige Nachrechnung (Formel von landing-kern-1, nicht aus dem Modul) */
const summe = DBw.zensus + DBw.regional + DBw.bau + DBw.akoga + RS.kopf.werte_gesamt + DBw.kennzahlen_gaa + DBw.indizes + DBw.zins_werte + DBw.zins_monat_werte;
pruef(A.kopf.amtlich_gesamt === summe, 'amtliche Datenpunkte nachgerechnet: ' + fmt(summe));
pruef(A.kopf.schnittstellen === A.boris_dienste.length + DBw.zensus_tabellen + DBw.regional_tabellen + DBw.bau_tabellen + DBw.indizes_reihen + 1 + (DBw.akoga > 0 ? 1 : 0), 'Schnittstellen nachgerechnet: ' + A.kopf.schnittstellen);
pruef(A.kopf.nutzer === NUTZER && A.kopf.nutzer_rund === 870, 'Nutzer wie dp2.js: 879 → „> 870"');
pruef(A.register.stand === '2026-11-20' && A.stand === '2026-11-20', 'Stand = Tag der Messung');
pruef(Object.values(A.takte).every((x) => x != null), 'alle Abruftakte im Code gefunden: ' + Object.entries(A.takte).map(([k, x]) => k + '=' + x).join(', '));
pruef(!('api_endpunkte' in A.kopf) && !('videos' in A.kopf), 'Repo-Zahlen (API, Prüfwerkzeuge, Videos) nicht im Endpunkt — die stehen in keinem Image');
/* Million-Regel */
pruef(H.amtlichRund(999999) === 'über 990.000' && H.amtlichRund(1e6) === 'über 1 Million' && H.amtlichRund(1100360) === 'über 1,1 Millionen' && H.amtlichRund(2050000) === 'über 2 Millionen', '„1 Million" nur ab einer Million (999.999 → über 990.000)');
/* fehlender Teil → keine halbe Summe */
H._cacheLeeren();
const ohneZensus = JSON.parse(JSON.stringify(MBR)); delete ohneZensus.db.zensus;
let warf = false; try { await H.messen({ db: fakeDb, mbHolen: async () => ohneZensus, nutzerZahl, jetzt }); } catch (e) { warf = /zensus/.test(e.message); }
pruef(warf, 'fehlender Teil → Messung wirft (keine halbe Summe)');
/* Zwischenspeicher und Fehler-Rückfall */
H._cacheLeeren();
let mbAufrufe = 0, mbKaputt = false;
const mbHolen = async () => { mbAufrufe++; if (mbKaputt) throw new Error('weg'); return MBR; };
const warn = console.warn; console.warn = () => {};
const e1 = await H.holen({ db: fakeDb, mbHolen, nutzerZahl });
const e2 = await H.holen({ db: fakeDb, mbHolen, nutzerZahl });
pruef(e1 && e2 === e1 && mbAufrufe === 1, 'zweiter Aufruf aus dem Zwischenspeicher (' + Math.round(H.CACHE_MS / 3600000) + ' h)');
const [p1, p2] = [H.holen({ db: fakeDb, mbHolen, nutzerZahl, frisch: true }), H.holen({ db: fakeDb, mbHolen, nutzerZahl, frisch: true })];
await Promise.all([p1, p2]);
pruef(mbAufrufe === 2, 'gleichzeitige Neumessungen laufen einmal');
mbKaputt = true;
const e3 = await H.holen({ db: fakeDb, mbHolen, nutzerZahl, frisch: true });
pruef(e3 === e1 || gleich(e3.kopf, e1.kopf), 'mb-Teil weg → letzter guter Stand bleibt');
H._cacheLeeren();
const e4 = await H.holen({ db: fakeDb, mbHolen, nutzerZahl });
const n4 = mbAufrufe;
const e5 = await H.holen({ db: fakeDb, mbHolen, nutzerZahl });
pruef(e4 === null && e5 === null && mbAufrufe === n4, 'ohne guten Stand → null (503), 5 Minuten keine neue Messung');
console.warn = warn;
H._cacheLeeren();

/* ── C · landing-zahlen.js an den echten Seiten ────────────────────────── */
console.log('C · landing-zahlen.js im nachgebauten DOM');
const SKRIPT = fs.readFileSync(join(LANDING, 'landing-zahlen.js'), 'utf8');
const VIDEOS = JSON.parse(fs.readFileSync(join(LANDING, 'assets/videothek/videos.json'), 'utf8'));

/* Mini-DOM aus dem echten HTML: Elemente mit Attributen und reinem Textinhalt, alle Textknoten im body, Metas */
function seiteBauen(datei) {
  const html = fs.readFileSync(join(LANDING, datei), 'utf8');
  const body = html.slice(html.indexOf('<body'));
  const elemente = [], texte = [];
  const attrs = (s) => { const a = {}; for (const m of s.matchAll(/\s([a-z][a-z0-9-]*)(?:="([^"]*)")?/gi)) a[m[1].toLowerCase()] = m[2] ?? ''; return a; };
  for (const m of body.matchAll(/<([a-z][a-z0-9]*)(\s[^>]*)?>([^<]*)(?=<)/gi)) {
    const a = attrs(m[2] || '');
    if ('data-umfang' in a || 'data-reg' in a || 'data-k' in a) {
      const el = { tag: m[1].toLowerCase(), a, textContent: m[3], dataset: {},
        getAttribute(n) { return n in this.a ? this.a[n] : null; }, hasAttribute(n) { return n in this.a; }, setAttribute(n, w) { this.a[n] = String(w); } };
      elemente.push(el);
    }
  }
  /* Textknoten ohne die Datenelemente (deren Text steckt im Element) */
  for (const m of body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').matchAll(/>([^<]+)</g)) if (m[1].trim()) texte.push({ nodeValue: m[1] });
  const metas = [...html.matchAll(/<meta\s([^>]*)>/gi)].map((m) => { const a = attrs(' ' + m[1]); return { a, getAttribute(n) { return n in this.a ? this.a[n] : null; }, setAttribute(n, w) { this.a[n] = w; } }; });
  const passt = (el, teil) => {
    const m = /^([a-z]*)\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(teil.trim());
    if (!m) throw new Error('Selektor im Mini-DOM unbekannt: ' + teil);
    if (m[1] && el.tag !== m[1]) return false;
    return m[3] == null ? m[2] in el.a : el.a[m[2]] === m[3];
  };
  const document = {
    body: {},
    querySelectorAll(sel) {
      const teile = sel.split(',');
      const pool = /^\s*meta/.test(teile[0]) ? metas.map((x) => Object.assign(x, { tag: 'meta' })) : elemente;
      return pool.filter((el) => teile.some((t) => passt(el, t)));
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    createTreeWalker() { let i = 0; return { nextNode: () => texte[i++] || null }; },
  };
  return { document, elemente, texte, metas, html };
}
function antwort(body, status) { return { ok: (status || 200) < 300, status: status || 200, json: async () => JSON.parse(JSON.stringify(body)) }; }
async function lauf(datei, { host = 'dealpilot.immo', api, apiStatus, apiFehler } = {}) {
  const S = seiteBauen(datei);
  const geholt = [];
  const fetch = async (url) => {
    geholt.push(url);
    if (/videos\.json$/.test(url)) return antwort(VIDEOS);
    if (apiFehler) throw new Error('Netz weg');
    return antwort(api, apiStatus);
  };
  const ctx = { window: {}, document: S.document, location: { hostname: host, protocol: 'https:' }, fetch, setTimeout, clearTimeout, AbortController, Promise, Math, Number, String, isFinite, console };
  ctx.window = ctx;
  vm.runInNewContext(SKRIPT, ctx);
  await ctx.DPS_ZAHLEN_FERTIG;
  return Object.assign(S, { geholt, ctx });
}
const vorher = (S) => S.elemente.map((e) => e.textContent);

/* C1 · Werte gesetzt */
for (const datei of ['index.html', 'methodik.html']) {
  const S = await lauf(datei, { api: A });
  const falsch = [];
  for (const el of S.elemente) {
    let soll;
    if ('data-nutzer' in el.a) { if ('data-live' in el.a) falsch.push('nutzer überschrieben'); continue; }
    if ('data-umfang' in el.a) {
      const k = el.a['data-umfang'];
      if (k === 'videos') soll = String(VIDEOS.videos.length);
      else if (k === 'video_stunden') soll = fmt(Math.round(VIDEOS.videos.reduce((s, x) => s + (Number(x.dauer) || 0), 0) / 360) / 10);
      else if (k in A.kopf) soll = typeof A.kopf[k] === 'number' ? fmt(A.kopf[k]) : A.kopf[k];
      else continue;   /* nur im Werkzeug (API, Prüfwerkzeuge): statisch */
    } else if ('data-reg' in el.a) soll = fmt(A.register.kopf[el.a['data-reg']]);
    else if ('data-k' in el.a) soll = el.a['data-k'] === 'stand' ? '20.11.2026' : fmt(A.register.kopf[el.a['data-k']]);
    if (el.textContent !== soll) falsch.push((el.a['data-umfang'] || el.a['data-reg'] || el.a['data-k']) + ': „' + el.textContent + '" statt „' + soll + '"');
    else if (!('data-live' in el.a)) falsch.push('ohne data-live');
  }
  const n = S.elemente.filter((e) => 'data-live' in e.a).length;
  pruef(!falsch.length && n > 5, datei + ': ' + n + ' Zahlen live gesetzt' + (falsch.length ? ' — ' + falsch.slice(0, 4).join('; ') : ''));
  if (datei === 'index.html') pruef(S.geholt[0] === 'https://app.dealpilot.immo/api/v1/public/datenumfang', 'Landing dealpilot.immo fragt app.dealpilot.immo (CORS wie /public/stats)');
}
/* C2 · Zielhosts */
for (const [host, soll] of [['www.dealpilot.immo', 'https://app.dealpilot.immo/api/v1/public/datenumfang'],
  ['staging.dealpilot.immo', 'https://app.staging.dealpilot.immo/api/v1/public/datenumfang'],
  ['app.dealpilot.immo', 'https://app.dealpilot.immo/api/v1/public/datenumfang'],
  ['localhost', '/api/v1/public/datenumfang']]) {
  const S = await lauf('methodik.html', { host, api: A });
  pruef(S.geholt[0] === soll, host + ' → ' + soll);
}
/* C3 · Rückfall */
for (const [name, o] of [['Netzfehler', { apiFehler: true }], ['503', { api: { ok: false }, apiStatus: 503 }], ['Antwort ohne Kopf', { api: { ok: true } }],
  ['amtlich_gesamt kein Wert', { api: Object.assign({}, A, { kopf: Object.assign({}, A.kopf, { amtlich_gesamt: null }) }) }]]) {
  const S0 = seiteBauen('index.html'), S = await lauf('index.html', o);
  const geaendert = S.elemente.filter((e, i) => e.textContent !== S0.elemente[i].textContent && !['videos', 'video_stunden'].includes(e.a['data-umfang']));
  pruef(!geaendert.length && !S.elemente.some((e) => 'data-live' in e.a && !['videos', 'video_stunden'].includes(e.a['data-umfang'])), 'Rückfall bei ' + name + ': statische Zahlen bleiben stehen');
}
/* C4 · Million-Regel */
const S0 = seiteBauen('index.html');
pruef(S0.texte.some((t) => /Million/.test(t.nodeValue)) || S0.elemente.some((e) => /Million/.test(e.textContent)), 'index.html nennt heute eine Million (Testvoraussetzung)');
{
  const klein = JSON.parse(JSON.stringify(A));
  klein.kopf.amtlich_gesamt = 990500; klein.kopf.amtlich_rund = H.amtlichRund(990500); klein.kopf.amtlich_rund_gross = 'Ü' + klein.kopf.amtlich_rund.slice(1);
  const S = await lauf('index.html', { api: klein });
  const rest = [...S.texte.map((t) => t.nodeValue), ...S.elemente.map((e) => e.textContent), ...S.metas.map((m) => m.a.content || '')].filter((t) => /Million/.test(t));
  pruef(!rest.length, 'unter einer Million: kein „Million" mehr in Text, Zahlen und Meta' + (rest.length ? ' — ' + rest[0].slice(0, 80) : ''));
  pruef(S.elemente.some((e) => e.a['data-umfang'] === 'amtlich_rund_gross' && e.textContent === 'Über 990.000'), 'Überschrift zeigt „Über 990.000"');
  const widersprich = JSON.parse(JSON.stringify(A)); widersprich.kopf.amtlich_gesamt = 990500;   /* Rundung sagt noch Million */
  const S2 = await lauf('index.html', { api: widersprich });
  pruef(!S2.elemente.some((e) => /^amtlich_rund/.test(e.a['data-umfang'] || '') && 'data-live' in e.a), 'Rundung „Million" bei Summe darunter wird nicht gezeigt');
}
{
  const S = await lauf('index.html', { api: A });
  pruef(S.texte.filter((t) => /Million/.test(t.nodeValue)).length === S0.texte.filter((t) => /Million/.test(t.nodeValue)).length, 'über einer Million: Fließtext bleibt unberührt');
}

/* ── D · Live gegen Staging ─────────────────────────────────────────────── */
if (arg('live')) {
  console.log('D · Live gegen Staging (nur lesend)');
  const URL_END = arg('url') || 'https://app.staging.dealpilot.immo/api/v1/public/datenumfang';
  const HOST = typeof arg('ssh') === 'string' ? arg('ssh') : 'root@116.203.214.11';
  const ORIGIN = URL_END.replace(/^https:\/\/app\./, 'https://').replace(/\/api\/.*$/, '');
  let j = null, r = null;
  try { r = await fetch(URL_END, { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(90000) }); j = r.ok ? await r.json() : null; }
  catch (e) { rot('Endpunkt nicht erreichbar: ' + e.message); }
  if (r && !r.ok) rot('Endpunkt HTTP ' + r.status + ' (ausgerollt? Rebuild backend UND mb-backend)');
  if (j) {
    pruef(j.ok === true && j.version === H.VERSION, 'Endpunkt antwortet ohne Anmeldung, Version ' + j.version);
    pruef(r.headers.get('access-control-allow-origin') === ORIGIN, 'CORS für ' + ORIGIN + ': ' + r.headers.get('access-control-allow-origin'));
    const vv = verboten(JSON.stringify(j));
    pruef(!vv.length, 'echte Antwort ohne Hostnamen/Adressen' + (vv.length ? ' — ' + vv.join(', ') : ''));
    let ssh = null;
    try {
      const ps = (c, u, d, sql) => M.zeilenZuObjekt(M.psqlZuZeilen(execFileSync('ssh', ['-o', 'ConnectTimeout=15', HOST, `docker exec -i ${c} psql -U ${u} -d ${d} -At -F'|' -v ON_ERROR_STOP=1`], { input: sql, encoding: 'utf8' })));
      ssh = Object.assign(ps('dealpilot-mb-db', 'mb', 'marktbericht', M.SQL_MB), ps('dealpilot-postgres', 'dealpilot', 'dealpilot_db', H.SQL_HAUPT));
    } catch (e) { rot('ssh-Messung fehlgeschlagen: ' + e.message.split('\n')[0]); }
    if (ssh) {
      const ab = Object.keys(ssh).filter((k) => ssh[k] !== j.db[k]);
      if (!ab.length) ok('Endpunkt-Zählungen = Werkzeug-Zählungen per ssh (' + Object.keys(ssh).length + ' Kennzahlen)');
      else {
        const alt = Date.now() - new Date(j.gemessen).getTime();
        const t = 'abweichend: ' + ab.map((k) => k + ' ' + j.db[k] + '/' + ssh[k]).join(', ') + ' · Endpunkt gemessen vor ' + Math.round(alt / 60000) + ' min';
        if (alt > 10 * 60000) console.log('  Hinweis  ' + t + ' (Zwischenspeicher; neu messen: Backend neu starten oder 6 h warten)');
        else rot(t);
      }
    }
    const W2 = H.zusammensetzen({ db: j.db, reg: j.register, boris: j.boris_dienste, takte: j.takte, fakten: { nutzer: j.kopf.nutzer } });
    pruef(gleich(W2.kopf, j.kopf), 'Kopf des Endpunkts = Werkzeug-Rechnung aus seinen Rohzahlen');
    const RS2 = await M.registerStandBerechnen();
    if (gleich(RS2.kopf, j.register.kopf)) ok('Register im Image = Register im Repo (' + fmt(j.register.kopf.werte_gesamt) + ' Werte)');
    else console.log('  Hinweis  Register im Image (' + j.register.kopf.werte_gesamt + ') ≠ Repo (' + RS2.kopf.werte_gesamt + ') — mb-backend neu bauen, wenn das Register ausgerollt werden soll');
    pruef(j.kopf.amtlich_gesamt >= 1e6 === /Million/.test(j.kopf.amtlich_rund), '„1 Million"-Regel an der echten Antwort: ' + fmt(j.kopf.amtlich_gesamt) + ' → ' + j.kopf.amtlich_rund);
  }
}

console.log(fehler ? 'ROT: ' + fehler + ' Befund(e)' : 'sauber');
process.exit(fehler ? 1 : 0);
