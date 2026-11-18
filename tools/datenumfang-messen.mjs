#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   datenumfang-messen.mjs · landing-kern-1 — DATENUMFANG DER LANDING

   Marcel 11.11.2026: „Wir haben noch eine Million amtliche Daten … nicht nur
   6.187, sondern auch Schnittstellen angeben, was wir anbinden und was wir
   alles abrufen … wie viele Schnittstellen, wie viele Werte insgesamt, wie
   oft wir was abrufen."

   GEMESSEN, NICHT GESCHÄTZT. Drei Quellen:
     1. Datenbanken auf STAGING, nur lesend (SELECT count), per ssh:
          dealpilot-mb-db   (mb.zensus_werte, mb.makro_werte, mb.baustatistik,
                             mb.param_werte, mb.param_modell, mb.wert_parameter,
                             mb.jahreswerte_abruf, mb.gaa_sources)
          dealpilot-postgres (markt_zins_tag, markt_bauzins_monat)
     2. Code: BORIS-Dienste aus BorisRegistry.status() (enabled), Abruftakte
        aus den Konstanten der Taktgeber (MakroImport, Baustatistik,
        Jahreswerte, harvestScheduler, bauzinsService).
     3. Register: frontend/landing/register-stand.js (tools/messe-schleife-daten.mjs).

   „Amtlich" zählt nur, was von einer Behörde stammt: Zensus 2022 und
   Regionaldatenbank (Statistische Ämter des Bundes und der Länder),
   Bautätigkeit/Baulandpreise (dieselben), Bundesweite Marktdaten der Oberen
   Gutachterausschüsse (AK OGA), Register der Gutachterausschüsse, amtliche
   Kennzahlen der Ausschüsse in mb.wert_parameter (Qualität A–C, ohne § 256),
   Preisindizes des Statistischen Bundesamts, Zinsreihen der Bundesbank.
   Angebots- und Bewertungspartner-Daten zählen NIE mit und werden nie genannt.

   Schreibt:
     frontend/landing/datenumfang.js   window.DPS_UMFANG
     und die Zahlen STATISCH ins HTML der Landing (Elemente mit
     data-umfang="schluessel", data-reg="schluessel", data-k="schluessel"),
     damit Suchmaschinen und Vorschauen die richtige Zahl sehen.

   Aufruf (Repo-Wurzel):
     node tools/datenumfang-messen.mjs                 misst Staging und schreibt
     node tools/datenumfang-messen.mjs --ohne-db       nimmt die DB-Zahlen aus der
                                                       letzten datenumfang.js
     node tools/datenumfang-messen.mjs --host=root@…   anderer Server (nur lesend)
   Nach jeder Ernte und nach jedem Import laufen lassen (nach messe-schleife-daten.mjs),
   Buster nicht nötig für das HTML; datenumfang.js wird mit Datums-Buster geladen.
   Rückgabe 0 · 1 bei Messfehler oder wenn „1 Million" im HTML steht, aber
   die Messung darunter liegt.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = join(WURZEL, 'frontend/landing');
const ZIEL = join(LANDING, 'datenumfang.js');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n)); return a ? (a.split('=')[1] ?? true) : null; };
const HOST = arg('host') || 'root@116.203.214.11';
const OHNE_DB = !!arg('ohne-db');
let fehler = 0;
const fmt = (n) => Number(n).toLocaleString('de-DE');

/* ── 1 · Register ───────────────────────────────────────────────────── */
function ladeSkript(datei, name) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(datei, 'utf8'), ctx);
  return ctx.window[name];
}
const REG = ladeSkript(join(LANDING, 'register-stand.js'), 'DPS_REGISTER');
if (!REG || !REG.kopf) { console.error('register-stand.js unlesbar'); process.exit(1); }

/* ── 2 · Datenbanken (nur lesend) ───────────────────────────────────── */
const SQL_MB = `
select 'zensus', count(*)::text from mb.zensus_werte
union all select 'zensus_tabellen', count(distinct tabelle)::text from mb.zensus_werte
union all select 'zensus_gebiete', count(distinct ags)::text from mb.zensus_werte
union all select 'regional', count(*)::text from mb.makro_werte
union all select 'regional_tabellen', count(distinct tabelle)::text from mb.makro_werte
union all select 'regional_gebiete', count(distinct ags)::text from mb.makro_werte
union all select 'bau', count(*)::text from mb.baustatistik
union all select 'bau_tabellen', count(distinct tabelle)::text from mb.baustatistik
union all select 'akoga', count(*)::text from mb.param_werte
union all select 'register_db', count(*)::text from mb.param_modell
union all select 'kennzahlen_gaa', count(*)::text from mb.wert_parameter where qualitaet in ('A','B','C')
union all select 'indizes', count(*)::text from mb.jahreswerte_abruf
union all select 'indizes_reihen', count(distinct reihe)::text from mb.jahreswerte_abruf
union all select 'portale', count(*)::text from mb.gaa_sources where status = 'aktiv'
union all select 'portale_erreichbar', count(*)::text from mb.gaa_sources where status = 'aktiv' and coalesce(fehler_anzahl,0) < 3
union all select 'portale_laender', count(distinct bundesland)::text from mb.gaa_sources where status = 'aktiv'`;
const SQL_HAUPT = `
select 'zins_tage', count(*)::text from markt_zins_tag
union all select 'zins_werte', (count(bund) + count(pfandbrief))::text from markt_zins_tag
union all select 'zins_monat_werte', count(mfi)::text from markt_bauzins_monat
union all select 'zins_seit', min(datum)::text from markt_zins_tag`;

function psql(container, user, db, sql) {
  const cmd = `docker exec -i ${container} psql -U ${user} -d ${db} -At -F'|' -v ON_ERROR_STOP=1`;
  const out = execFileSync('ssh', ['-o', 'ConnectTimeout=15', HOST, cmd], { input: sql, encoding: 'utf8' });
  const r = {};
  out.trim().split(/\r?\n/).forEach((z) => { const [k, v] = z.split('|'); r[k] = /^\d+$/.test(v) ? Number(v) : v; });
  return r;
}

let DB;
if (OHNE_DB) {
  const alt = fs.existsSync(ZIEL) ? ladeSkript(ZIEL, 'DPS_UMFANG') : null;
  if (!alt || !alt.db) { console.error('--ohne-db: keine frühere Messung in datenumfang.js'); process.exit(1); }
  DB = alt.db; console.log('DB-Zahlen aus der letzten Messung vom ' + alt.db_gemessen);
} else {
  try {
    DB = Object.assign(psql('dealpilot-mb-db', 'mb', 'marktbericht', SQL_MB),
                       psql('dealpilot-postgres', 'dealpilot', 'dealpilot_db', SQL_HAUPT));
    DB.host = HOST.replace(/^.*@/, '');
  } catch (e) { console.error('Messung auf ' + HOST + ' fehlgeschlagen: ' + e.message); process.exit(1); }
}

/* ── 3 · Code: BORIS-Dienste und Abruftakte ─────────────────────────── */
const borisMod = await import(pathToFileURL(join(WURZEL, 'marktbericht/backend/src/connectors/boris/registry.js')).href);
const bstat = await borisMod.BorisRegistry.status();
const boris = (Array.isArray(bstat) ? bstat : []).filter((a) => a.enabled);

function konst(datei, re, name) {
  const t = fs.readFileSync(join(WURZEL, datei), 'utf8');
  const m = t.match(re);
  if (!m) { console.error('Takt nicht gefunden: ' + name + ' in ' + datei); fehler++; return null; }
  return m;
}
const mk = konst('marktbericht/backend/src/services/MakroImportService.js', /const ALTER_TAGE = (\d+)/, 'Makro');
const bs = konst('marktbericht/backend/src/services/BaustatistikService.js', /ALTER_TAGE = (\d+)/, 'Baustatistik');
const jw = konst('marktbericht/backend/src/services/JahreswerteService.js', /const ABRUF_ALTER_TAGE = (\d+)/, 'Jahreswerte');
const hv = konst('marktbericht/backend/src/lib/harvestScheduler.js', /Januar bis Juni\s+(\S+) je Quelle[\s\S]*?Juli bis Dezember\s+(\S+)/, 'Harvest');
const bz = konst('backend/src/services/bauzinsService.js', /ziel\.setHours\((\d+), 0, 0, 0\)[\s\S]*?setInterval\(_taeglich, 24 \* 60 \* 60 \* 1000\)/, 'Bauzins');
const takt = (tage) => tage == null ? null : (tage <= 1 ? 'täglich' : tage <= 7 ? 'wöchentlich' : tage <= 31 ? 'monatlich' : 'alle ' + tage + ' Tage');
const TAKTE = {
  zinsen: bz ? 'täglich' : null,
  zinsen_uhr: bz ? Number(bz[1]) : null,
  statistik: mk ? takt(Number(mk[1])) : null,
  bau: bs ? takt(Number(bs[1])) : null,
  indizes: jw ? takt(Number(jw[1])) : null,
  portale_halbjahr1: hv ? hv[1].replace('woechentlich', 'wöchentlich') : null,
  portale_halbjahr2: hv ? hv[2] : null,
  bodenrichtwerte: 'live je Bericht',
};

/* ── 3b · Harte Zahlen (landing-strecke-3, Marcel 18.11.2026: „Schnittstellen … Hard Facts könnten wir
   noch ein paar mehr angeben“). Jede aus EINER Quelle, gezählt, nie geschätzt. ──────────────────── */
/* Nutzer: dieselbe öffentliche Route, die die Landing im Browser fragt (Prod, nur lesend, kein Token).
   Regel wie dp2.js: auf Zehner abgerundet, davor steht „>“. */
const NUTZER_URL = arg('nutzer-url') || 'https://app.dealpilot.immo/api/v1/public/stats';
let nutzer = null, nutzerHerkunft = null;
try {
  const r = await fetch(NUTZER_URL, { signal: AbortSignal.timeout(15000), headers: { Origin: 'https://dealpilot.immo' } });
  const j = r.ok ? await r.json() : null;
  if (j && Number.isFinite(j.registrierte_nutzer)) { nutzer = j.registrierte_nutzer; nutzerHerkunft = j.herkunft || null; }
} catch (e) { /* unten */ }
if (nutzer == null) {
  const alt = fs.existsSync(ZIEL) ? ladeSkript(ZIEL, 'DPS_UMFANG') : null;
  if (alt && alt.kopf && Number.isFinite(alt.kopf.nutzer)) { nutzer = alt.kopf.nutzer; console.log('Nutzer: ' + NUTZER_URL + ' nicht erreichbar, letzte Messung ' + nutzer); }
  else { console.error('Nutzer: ' + NUTZER_URL + ' nicht erreichbar, keine frühere Messung'); fehler++; }
}
/* API-Endpunkte: jede Route (Methode + Pfad je Datei) in Haupt-App und Marktbericht-Backend,
   Kommentarzeilen nicht. Gemessen 18.11.2026: 443 + 74. */
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
/* Prüfstrecken: jedes Prüfwerkzeug unter tools/ (…-pruefen, …-test), auch in Unterordnern eine Ebene tief */
const pruefDateien = [];
for (const d of ['tools', ...fs.readdirSync(join(WURZEL, 'tools'), { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => 'tools/' + x.name)]) {
  for (const f of fs.readdirSync(join(WURZEL, d))) if (/(-pruefen|-test)\.(mjs|js|py)$/.test(f)) pruefDateien.push(d + '/' + f);
}
/* Videothek: assets/videothek/videos.json */
const VJ = JSON.parse(fs.readFileSync(join(LANDING, 'assets/videothek/videos.json'), 'utf8'));
const videos = (VJ.videos || []).length;
const videoSek = (VJ.videos || []).reduce((s, v) => s + (Number(v.dauer) || 0), 0);
const FAKTEN = {
  nutzer, nutzer_rund: nutzer == null ? null : Math.floor(nutzer / 10) * 10, nutzer_url: NUTZER_URL, nutzer_herkunft: nutzerHerkunft,
  api_endpunkte: api_haupt + api_mb, api_haupt, api_mb,
  register_saetze: REG.saetze, laender_mit_wert: REG.kopf.laender_mit_wert,
  pruefstrecken: pruefDateien.length,
  videos, video_stunden: Math.round(videoSek / 360) / 10,
};

/* ── 4 · Rechnen ────────────────────────────────────────────────────── */
const register = REG.kopf.werte_gesamt;
const teile = {
  zensus: DB.zensus, regional: DB.regional, bau: DB.bau, akoga: DB.akoga,
  register, kennzahlen_gaa: DB.kennzahlen_gaa, indizes: DB.indizes,
  zinsen: (DB.zins_werte || 0) + (DB.zins_monat_werte || 0),
};
for (const [k, v] of Object.entries(teile)) if (!Number.isFinite(v)) { console.error('fehlt: ' + k); fehler++; }
const amtlich = Object.values(teile).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
const rund = amtlich >= 1e6
  ? (function () { const m = Math.floor(amtlich / 1e5) / 10; return 'über ' + m.toLocaleString('de-DE') + (m === 1 ? ' Million' : ' Millionen'); })()
  : 'über ' + fmt(Math.floor(amtlich / 1e4) * 1e4);
/* Schnittstellen: jeder angebundene amtliche Dienst bzw. jede abgerufene Tabelle/Reihe einzeln */
const schnitt = {
  boris: boris.length,
  statistik_tabellen: (DB.zensus_tabellen || 0) + (DB.regional_tabellen || 0) + (DB.bau_tabellen || 0) + (DB.indizes_reihen || 0),
  bundesbank: 1, akoga: DB.akoga > 0 ? 1 : 0,
};
const schnitt_gesamt = Object.values(schnitt).reduce((s, v) => s + v, 0);

const U = {
  stand: new Date().toISOString().slice(0, 10),
  db_gemessen: OHNE_DB ? DB.gemessen || null : new Date().toISOString(),
  quelle: 'tools/datenumfang-messen.mjs · Staging nur lesend (SELECT count) · BorisRegistry.status() · Takt-Konstanten im Code · register-stand.js',
  db: Object.assign({}, DB, { gemessen: OHNE_DB ? DB.gemessen : new Date().toISOString() }),
  teile, takte: TAKTE,
  boris_dienste: boris.map((a) => a.name),
  kopf: {
    amtlich_gesamt: amtlich,
    amtlich_rund: rund,
    amtlich_rund_gross: rund.charAt(0).toUpperCase() + rund.slice(1),
    register_werte: register,
    ausschuesse: REG.kopf.ausschuesse,
    zensus: DB.zensus, zensus_tabellen: DB.zensus_tabellen, zensus_gebiete: DB.zensus_gebiete,
    regional: DB.regional, regional_tabellen: DB.regional_tabellen, regional_gebiete: DB.regional_gebiete,
    bau: DB.bau, bau_tabellen: DB.bau_tabellen,
    akoga: DB.akoga, kennzahlen_gaa: DB.kennzahlen_gaa,
    indizes: DB.indizes, indizes_reihen: DB.indizes_reihen,
    zins_tage: DB.zins_tage,
    portale: DB.portale, portale_laender: DB.portale_laender,
    boris_dienste: boris.length,
    schnittstellen: schnitt_gesamt,
    statistik_tabellen: schnitt.statistik_tabellen,
    /* landing-strecke-3 · harte Zahlen */
    nutzer: FAKTEN.nutzer, nutzer_rund: FAKTEN.nutzer_rund,
    api_endpunkte: FAKTEN.api_endpunkte, register_saetze: FAKTEN.register_saetze,
    laender_mit_wert: FAKTEN.laender_mit_wert, pruefstrecken: FAKTEN.pruefstrecken,
    videos: FAKTEN.videos, video_stunden: FAKTEN.video_stunden,
  },
  fakten: FAKTEN,
};

const kopfText = '/* datenumfang-messen.mjs · erzeugt ' + new Date().toISOString() + ' — NICHT von Hand ändern.\n'
  + '   Neu erzeugen: node tools/datenumfang-messen.mjs */\n';
fs.writeFileSync(ZIEL, kopfText + 'window.DPS_UMFANG = ' + JSON.stringify(U, null, 1) + ';\n');

/* ── 5 · Zahlen statisch ins HTML ───────────────────────────────────── */
const TEXT = (k, quelle) => { const v = quelle[k]; return v == null ? null : (typeof v === 'number' ? fmt(v) : String(v)); };
const regKopf = Object.assign({}, REG.kopf, { stand: REG.stand.split('-').reverse().join('.') });
let geaendert = 0;
for (const f of fs.readdirSync(LANDING).filter((x) => x.endsWith('.html'))) {
  const p = join(LANDING, f);
  let t = fs.readFileSync(p, 'utf8'); const vor = t;
  for (const [attr, quelle] of [['data-umfang', U.kopf], ['data-reg', REG.kopf], ['data-k', regKopf]]) {
    t = t.replace(new RegExp('(<[a-z]+[^>]*\\s' + attr + '="([a-z_]+)"[^>]*>)([^<]*)(<)', 'g'), (m, auf, k, alt, zu) => {
      const neu = TEXT(k, quelle); return neu == null ? m : auf + neu + zu;
    });
  }
  if (amtlich < 1e6 && /1 Million/.test(t)) { console.error(f + ': nennt „1 Million", gemessen sind ' + fmt(amtlich)); fehler++; }
  if (t !== vor) { fs.writeFileSync(p, t); geaendert++; console.log('  HTML nachgezogen: ' + f); }
}

console.log('amtliche Datenpunkte: ' + fmt(amtlich) + ' (' + rund + ')');
console.log('  ' + Object.entries(teile).map(([k, v]) => k + ' ' + fmt(v)).join(' · '));
console.log('Schnittstellen: ' + schnitt_gesamt + ' (' + Object.entries(schnitt).map(([k, v]) => k + ' ' + v).join(', ') + ') · Portale ' + DB.portale + ' in ' + DB.portale_laender + ' Ländern');
console.log('Harte Zahlen: Nutzer ' + FAKTEN.nutzer + ' (Anzeige > ' + FAKTEN.nutzer_rund + ', ' + FAKTEN.nutzer_url + ') · API-Endpunkte ' + FAKTEN.api_endpunkte + ' (Haupt-App ' + FAKTEN.api_haupt + ', Marktbericht ' + FAKTEN.api_mb + ') · Register-Sätze ' + fmt(FAKTEN.register_saetze) + ' · Länder mit Wert ' + FAKTEN.laender_mit_wert + ' · Prüfwerkzeuge ' + FAKTEN.pruefstrecken + ' · Videos ' + FAKTEN.videos + ' (' + fmt(FAKTEN.video_stunden) + ' h)');
console.log('Takte: ' + JSON.stringify(TAKTE));
console.log('geschrieben: frontend/landing/datenumfang.js · ' + geaendert + ' HTML-Datei(en) nachgezogen');
process.exit(fehler ? 1 : 0);
