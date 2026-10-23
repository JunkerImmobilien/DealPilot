#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   messe-app-zahlen.mjs · v2937 — „DealPilot in Zahlen" für die Messe-Schleife

   Marcel 23.10.2026: „können wir in unserer Messeschleife Eckdaten zur App
   erfassen? Wieviel Codezeilen, Klassen, Methoden, Schnittstellen, Felder,
   Werte, Gesetze …"

   Jede Zahl wird HIER aus dem Repo gemessen, keine wird getippt:
     Codezeilen / Dateien     git ls-files, nur eigener Code (js, mjs, css, html, sql),
                              ohne vendor/, Schriften, Mockups, generated/, *.min.js
     Funktionen               Vorkommen von `function` und `=>` in js/mjs (jede
                              Rückruf-Funktion zählt mit - das Wort heißt „Funktionen")
     Klassen                  `class Name` (nur wenige: DealPilot ist als Module gebaut, nicht als Klassen)
     Module                   window.X = (function / {…}), export const|function|class, module.exports
     Registerdaten            Zeilen der Register-JSON (amtliche Sätze der Gutachterausschüsse)
     Dokumentation            Zeilen aller .md im Repo
     Schnittstellen           router.get|post|put|patch|delete( in den Routen beider Backends
     Datenbank-Tabellen       verschiedene Namen aus CREATE TABLE in den Migrationen beider DBs
     Migrationen              Dateien in beiden migrations/-Ordnern
     Eingabefelder            feld_ids aus backend/src/generated/frontend-konstanten.json
     Gesetze / Paragrafen     „§ n Gesetz" und „Art. n DSGVO" im Code, je Gesetz verschiedene §§
     Prüfwerkzeuge            tools/*-pruefen.mjs
     Versionen / Commits      git log (Betreff beginnt mit vNNN) / git rev-list --count
     Entwicklungstage         erster Commit bis heute
     Videos                   frontend/landing/assets/videothek/videos.json
   Ausgabe: frontend/messe-schleife/app-zahlen.js (window.DPS_APP).
   Nach jedem Rollout neu laufen lassen (wie messe-schleife-daten.mjs).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const git = (a) => execSync('git ' + a, { cwd: WURZEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const AUS = /(^|\/)(vendor|fonts|schriften|mockups|node_modules|patchesold|generated|medien|clips|Dateien|design)\//i;
const dateien = git('ls-files').split('\n').filter(Boolean)
  .filter((f) => /\.(js|mjs|css|html|sql)$/.test(f) && !AUS.test(f) && !/\.min\.(js|css)$/.test(f) && !/\.pre-/.test(f));

const bereich = (f) => f.startsWith('frontend/') ? 'frontend' : f.startsWith('backend/') ? 'backend'
  : f.startsWith('marktbericht/') ? 'marktbericht' : f.startsWith('tools/') ? 'werkzeuge' : 'sonst';
const Z = { zeilen: 0, dateien: 0, funktionen: 0, klassen: 0, module: 0, schnittstellen: 0, je_bereich: {} };
const tabellen = new Set();
const para = {};   // Gesetz -> Set(§)
const GESETZE = 'ImmoWertV|ImmoWertA|EStG|BewG|BGB|UStG|BelWertV|GNotKG|HGB|AO|GrEStG|BauGB|WEG|BetrKV|WoFlV|BDSG|DDG|TDDDG|MStV|KStG|GewStG|ErbStG|GBO|BauNVO|GEG|ZVG|EStDV|WertR|SW-RL|EW-RL|VW-RL|ZPO';
const RE_PARA = new RegExp('§§?\\s*(\\d+[a-z]?)(?:\\s*Abs\\.\\s*\\d+[a-z]?)?(?:\\s*(?:S\\.|Satz|Nr\\.)\\s*\\d+)*\\s+(' + GESETZE + ')\\b', 'g');
const RE_ART = /Art\.\s*(\d+)(?:\s*Abs\.\s*\d+)?(?:\s*lit\.\s*[a-z])?\s+DSGVO\b/g;

for (const f of dateien) {
  let t;
  try { t = fs.readFileSync(path.join(WURZEL, f), 'utf8'); } catch (e) { continue; }
  const zeilen = t.split(/\r?\n/).filter((l) => l.trim()).length;
  const b = bereich(f);
  Z.zeilen += zeilen; Z.dateien++;
  Z.je_bereich[b] = (Z.je_bereich[b] || 0) + zeilen;
  if (/\.(js|mjs)$/.test(f)) {
    Z.funktionen += (t.match(/\bfunction\b/g) || []).length + (t.match(/=>/g) || []).length;
    Z.klassen += (t.match(/\bclass\s+[A-Z]\w*/g) || []).length;
    Z.module += (t.match(/window\.[A-Z][A-Za-z0-9_]+ *= *(\(function|\{|function)|export (const|function|class) [A-Za-z]+|module\.exports/g) || []).length;
    if (/\/routes\//.test(f) || /backend\/src\/index\.js$/.test(f)) Z.schnittstellen += (t.match(/\b(?:router|app)\.(?:get|post|put|patch|delete)\(\s*['"`]/g) || []).length;
  }
  if (/migrations\/.*\.sql$/.test(f)) {
    for (const m of t.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([\w.]+)/gi)) tabellen.add(m[1].toLowerCase().replace(/^public\./, ''));
  }
  for (const m of t.matchAll(RE_PARA)) (para[m[2]] = para[m[2]] || new Set()).add(m[1]);
  for (const m of t.matchAll(RE_ART)) (para.DSGVO = para.DSGVO || new Set()).add(m[1]);
}

const migrationen = ['backend/migrations', 'marktbericht/backend/migrations']
  .reduce((a, d) => a + (fs.existsSync(path.join(WURZEL, d)) ? fs.readdirSync(path.join(WURZEL, d)).filter((x) => /\.sql$/.test(x)).length : 0), 0);
let felder = null;
try { felder = JSON.parse(fs.readFileSync(path.join(WURZEL, 'backend/src/generated/frontend-konstanten.json'), 'utf8')).daten.feld_ids.length; } catch (e) {}
const pruefer = fs.readdirSync(path.join(WURZEL, 'tools')).filter((x) => /-pruefen\.mjs$/.test(x)).length;
const commits = parseInt(git('rev-list --count HEAD').trim(), 10);
const versionen = git('log --format=%s').split('\n').filter((s) => /^v\d{3,4}/.test(s)).length;
const erster = git('log --reverse --format=%ad --date=short').split('\n')[0].trim();
const heute = new Date().toISOString().slice(0, 10);
const tage = Math.round((new Date(heute) - new Date(erster)) / 86400000);
let videos = null;
try { videos = JSON.parse(fs.readFileSync(path.join(WURZEL, 'frontend/landing/assets/videothek/videos.json'), 'utf8')).videos.filter((v) => v.datei).length; } catch (e) {}
const kerne = fs.existsSync(path.join(WURZEL, 'backend/src/generated/rechenkerne'))
  ? fs.readdirSync(path.join(WURZEL, 'backend/src/generated/rechenkerne')).filter((x) => /\.js$/.test(x)).length : null;

const _alle = git('ls-files').split('\n').filter(Boolean);
const _zeilen = (liste) => liste.reduce((a, f) => { try { return a + fs.readFileSync(path.join(WURZEL, f), 'utf8').split('\n').length; } catch (e) { return a; } }, 0);
const registerzeilen = _zeilen(_alle.filter((f) => /\.json$/.test(f) && /register/.test(f)));
const dokuzeilen = _zeilen(_alle.filter((f) => /\.md$/.test(f)));
/* v2941 · AMTLICHE DATEN (Marcel 23.10.2026: „die Gutachter-Sachen, amtliche Daten,
   Bodenrichtwerte … alles was Zahlen sind"). Gelesen auf Staging (gleicher Stand wie Prod,
   nur SELECT); ohne Verbindung bleiben die Werte der letzten Datei stehen. */
let amtlich = null;
try {
  const sql = "select 'zensus_werte', count(*) from mb.zensus_werte union all select 'zensus_gemeinden', count(distinct ags) from mb.zensus_werte"
    + " union all select 'makro_werte', count(*) from mb.makro_werte union all select 'makro_gebiete', count(distinct ags) from mb.makro_werte"
    + " union all select 'wert_parameter', count(*) from mb.wert_parameter union all select 'register_db', count(*) from mb.param_modell"
    + " union all select 'gaa_dokumente', count(*) from mb.gaa_documents";
  const roh = execSync('ssh -o ConnectTimeout=8 root@116.203.214.11 "docker exec dealpilot-mb-db psql -U mb -d marktbericht -At -c \\"' + sql + '\\""', { encoding: 'utf8', timeout: 60000 });
  amtlich = {};
  roh.split('\n').filter(Boolean).forEach((z) => { const [k, v] = z.split('|'); amtlich[k] = Number(v); });
  const h = JSON.parse(execSync('curl -s --max-time 15 https://app.staging.dealpilot.immo/api/v1/marktbericht/health', { encoding: 'utf8' }));
  amtlich.boris_systeme = (h.boris_laender || []).filter((x) => x.code !== 'borisd_wms').length;
  amtlich.boris_laender = (h.boris_laender || []).filter((x) => !/^borisd/.test(x.code)).length;
} catch (e) {
  try { const alt = fs.readFileSync(path.join(WURZEL, 'frontend/messe-schleife/app-zahlen.js'), 'utf8'); const m = alt.match(/"amtlich": (\{[^}]*\})/); amtlich = m ? JSON.parse(m[1]) : null; } catch (x) {}
  console.log('amtliche Daten: Server nicht erreichbar, alte Werte (' + e.message.slice(0, 60) + ')');
}
try {
  const kg = JSON.parse(fs.readFileSync(path.join(WURZEL, 'frontend/js/data/kappungsgrenzen.json'), 'utf8')).laender;
  amtlich = amtlich || {};
  amtlich.mietrecht_gemeinden = Object.values(kg).reduce((a, x) => a + (Array.isArray(x.gemeinden) ? x.gemeinden.length : 0), 0);
  amtlich.mietrecht_laender = Object.values(kg).filter((x) => Array.isArray(x.gemeinden) && x.gemeinden.length).length;
} catch (e) {}
const gesetze = Object.keys(para).map((g) => ({ gesetz: g, paragrafen: para[g].size }))
  .sort((a, b) => b.paragrafen - a.paragrafen);
const out = {
  stand: heute,
  zeilen: Z.zeilen, dateien: Z.dateien, je_bereich: Z.je_bereich,
  funktionen: Z.funktionen, klassen: Z.klassen, module: Z.module, schnittstellen: Z.schnittstellen,
  registerzeilen, dokuzeilen, amtlich,
  tabellen: tabellen.size, migrationen, felder, pruefer, commits, versionen,
  erster_commit: erster, tage, videos, rechenkerne: kerne,
  gesetze, paragrafen: gesetze.reduce((a, g) => a + g.paragrafen, 0)
};
const ziel = path.join(WURZEL, 'frontend/messe-schleife/app-zahlen.js');
fs.writeFileSync(ziel, '/* app-zahlen.js · erzeugt von tools/messe-app-zahlen.mjs am ' + heute
  + ' - NICHT von Hand ändern, neu erzeugen. */\nwindow.DPS_APP = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('Codezeilen ' + out.zeilen.toLocaleString('de-DE') + ' in ' + out.dateien + ' Dateien ' + JSON.stringify(out.je_bereich));
console.log('amtlich ' + JSON.stringify(out.amtlich));
console.log('Module ' + out.module + ' · Registerdaten ' + out.registerzeilen + ' Zeilen · Doku ' + out.dokuzeilen + ' Zeilen');
console.log('Funktionen ' + out.funktionen + ' · Klassen ' + out.klassen + ' · Schnittstellen ' + out.schnittstellen + ' · Tabellen ' + out.tabellen + ' · Migrationen ' + out.migrationen);
console.log('Felder ' + out.felder + ' · Prüfwerkzeuge ' + out.pruefer + ' · Commits ' + out.commits + ' · Versionen ' + out.versionen + ' · seit ' + out.erster_commit + ' (' + out.tage + ' Tage) · Videos ' + out.videos + ' · Kerne ' + out.rechenkerne);
console.log('Gesetze ' + gesetze.length + ', Paragrafen ' + out.paragrafen + ': ' + gesetze.slice(0, 12).map((g) => g.gesetz + ' ' + g.paragrafen).join(', '));
console.log('geschrieben: ' + path.relative(WURZEL, ziel));
