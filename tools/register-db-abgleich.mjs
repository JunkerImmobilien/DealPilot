#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   register-db-abgleich.mjs · v2396 — REGISTER-DATEIEN GEGEN mb.param_modell
   ═══════════════════════════════════════════════════════════════════════

   Gefunden am 19.10.2026 (Pruefung zu 6dde1282): die Verknuepfung zwischen
   den Registerdateien und der Datenbank lief an vier Stellen auseinander,
   und keiner der bestehenden Pruefer sah es — saat-pruefen liest nur die
   Dateien, register-saat nur seinen eigenen Lauf.

     · Muenchen 09162000 Sachwertfaktor: die Datei fuehrt eine SPERRE, die
       Tabelle den Wert 1,15 / 1,38 — und die Tabelle gewann.
     · Essen 05113000 (Prod): zwei Zeilen je Zweig mit alter und neuer
       quelle_url; waehleAusGruppe gab bei gleichem Jahrgang null.
     · 204 Sperren meldeten kein_wert statt datensatz_unvollstaendig, weil
       die DB-Zeile die Felder der Datei nicht traegt.

   ROT bei
     1  DB-Wert ueber einer Datei-Sperre (gleicher Mischschluessel)
     2  DB-Zeile ohne Gegenstueck in den Dateien (voller Tabellenschluessel)
     3  zwei URLs je Mischschluessel in der Tabelle, wo die Datei eine fuehrt
     4  Abweichung von formel oder geltungsbereich zwischen Datei und Zeile
     5  Datei-Wert ohne DB-Zeile, soweit ladeAusDb() die Kennzahl liest
     6  der ECHTE Mischweg (ladeSaat + ladeAusDb) laesst einen DB-Wert ueber
        einer Sperre oder zwei Zeilen desselben Schluessels durch

   Nur SELECT, in einer READ-ONLY-Sitzung. Aufruf (vom Repo-Wurzelverzeichnis):
     node tools/register-db-abgleich.mjs --ssh=root@116.203.214.11   (Staging)
     node tools/register-db-abgleich.mjs --ssh=root@157.90.117.167   (Prod, lesend)
     node tools/register-db-abgleich.mjs --json=<export.json>        (Datei)
   Optionen: --liste (alle Befunde statt je 5 Beispiele)
   Rueckgabe: 0 sauber · 1 rot · 2 Datenbank nicht erreichbar
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const REG = join(WURZEL, 'marktbericht/backend/src/lib/register');
const MODUL = join(WURZEL, 'marktbericht/backend/src/lib/ausschuss_register.js');
const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').slice(n.length + 3);
const SSH = arg('ssh');
const JSONDATEI = arg('json');
const BEHAELTER = arg('container') || 'dealpilot-mb-db';
const LISTE = process.argv.includes('--liste');

/* ── 1 · Die Tabelle lesen ─────────────────────────────────────────── */
const SQL = "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY; "
  + "SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT id, land_code, ags, ebene, gebiet_name,"
  + " gaa_name, kennzahl, zweig, formel, korrekturen, modellansaetze, geltungsbereich, belege, stufe,"
  + " fallzahl, to_char(stichtag, 'YYYY-MM-DD') AS stichtag, berichtsjahr, modellversion, quelle_url,"
  + " quellenvermerk, lizenz FROM mb.param_modell) t";

let rows;
try {
  if (JSONDATEI) {
    rows = JSON.parse(fs.readFileSync(JSONDATEI, 'utf8'));
  } else if (SSH) {
    const aus = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', SSH,
      `docker exec ${BEHAELTER} psql -U mb marktbericht -v ON_ERROR_STOP=1 -At -c "${SQL}"`],
      { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    /* json_agg bricht zwischen den Elementen um: ab der ersten Zeile, die mit [ beginnt */
    const ab = aus.search(/^\[/m);
    rows = JSON.parse(ab >= 0 ? aus.slice(ab) : aus);
  } else {
    console.error('Aufruf: --ssh=<user@host> oder --json=<datei>');
    process.exit(2);
  }
  if (!Array.isArray(rows)) throw new Error('Antwort ist keine Liste');
} catch (e) {
  console.error('DATENBANK NICHT ERREICHBAR: ' + String(e.message || e).split('\n')[0]);
  process.exit(2);
}

/* ── 2 · Die Dateien lesen ─────────────────────────────────────────── */
const reg = await import(pathToFileURL(MODUL).href);
/* Die Kennzahlen, die der laufende Server aus der Tabelle holt. Seit v2396
   exportiert; davor stand die Liste nur als Vorgabewert von ladeAusDb(). */
const DBK = new Set(reg.DB_KENNZAHLEN || ['liegenschaftszinssatz', 'sachwertfaktor', 'bodenpreisniveau',
  'durchschnittspreis', 'preisentwicklung', 'erbbauzinssatz', 'vergleichsfaktor',
  'umrechnungskoeffizient_flaeche', 'bodenpreisindex']);
const dateien = fs.readdirSync(REG).filter((f) => f.endsWith('.json') && !/^verfuegbarkeit-/.test(f)).sort();
const datei = [];
let dateienGelesen = 0;
for (const f of dateien) {
  let a; try { a = JSON.parse(fs.readFileSync(join(REG, f), 'utf8')); } catch (e) { continue; }
  if (!Array.isArray(a)) continue;
  dateienGelesen++;
  a.forEach((s) => { if (s && s.kennzahl && s.land_code) datei.push({ ...s, _datei: f }); });
}
const istSperre = (s) => s.vollstaendig === false || !!s.warum_kein_wert;
const jahr = (s) => (s.berichtsjahr == null ? '' : String(s.berichtsjahr));
const misch = (s) => [s.ags, s.kennzahl, s.zweig || 'standard', jahr(s)].join('|');
const voll = (s) => [s.land_code, s.ags, s.kennzahl, s.zweig || 'standard', jahr(s), s.quelle_url].join('|');
const kanon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x));
const leer = (v) => v == null || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

const imBlick = rows.filter((r) => DBK.has(r.kennzahl));
const dateiImBlick = datei.filter((s) => DBK.has(s.kennzahl));
const dNachVoll = new Map(); const dNachMisch = new Map();
for (const s of dateiImBlick) {
  if (!dNachVoll.has(voll(s))) dNachVoll.set(voll(s), []); dNachVoll.get(voll(s)).push(s);
  if (!dNachMisch.has(misch(s))) dNachMisch.set(misch(s), []); dNachMisch.get(misch(s)).push(s);
}
const rNachVoll = new Map(); const rNachMisch = new Map();
for (const r of imBlick) {
  rNachVoll.set(voll(r), r);
  if (!rNachMisch.has(misch(r))) rNachMisch.set(misch(r), []); rNachMisch.get(misch(r)).push(r);
}

const befund = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
const TITEL = {
  1: 'DB-Wert ueber Datei-Sperre',
  2: 'DB-Zeile ohne Datei',
  3: 'zwei URLs je Schluessel (Datei fuehrt weniger)',
  4: 'Abweichung formel/geltungsbereich',
  5: 'Datei-Wert ohne DB-Zeile',
  6: 'Mischweg (echte Funktion) laesst durch',
};
const zeig = (r) => `${r.land_code}/${r.ags} ${r.kennzahl}/${r.zweig} ${jahr(r) || '-'}`
  + (r.id ? ` id=${r.id}` : '') + (r._datei ? ` ${r._datei}` : '');
let abgeglichen = 0;
let nichtEinspielbar = 0;

for (const r of imBlick) {
  const gl = dNachMisch.get(misch(r)) || [];
  /* Massgeblich ist der VOLLE Schluessel: fuehrt die Datei unter derselben
     URL einen Wert, ist die Zeile dieser Wert — auch wenn daneben eine
     Sperre denselben Mischschluessel traegt (Umrechnungskoeffizienten:
     Kreis-Sperre plus Werte je Tabellenkennung der Zone). */
  const d = (dNachVoll.get(voll(r)) || []).find((s) => !istSperre(s));
  if (!d && gl.some(istSperre)) { befund[1].push(zeig(r) + ' — Datei: Sperre'); continue; }
  if (!d) {
    befund[2].push(zeig(r) + (gl.length ? ' — Datei fuehrt den Schluessel mit anderer URL: ' + gl[0].quelle_url : ' — Schluessel fehlt in allen Dateien')
      + ' · ' + String(r.quelle_url).slice(-60));
    continue;
  }
  abgeglichen++;
  const fehlt = [];
  if (kanon(d.formel) !== kanon(r.formel)) fehlt.push('formel');
  if (!(leer(d.geltungsbereich) && leer(r.geltungsbereich)) && kanon(d.geltungsbereich || {}) !== kanon(r.geltungsbereich || {})) fehlt.push('geltungsbereich');
  if (fehlt.length) befund[4].push(zeig(r) + ' — ' + fehlt.join(', ') + ' · ' + d._datei);
}
for (const [k, liste] of rNachMisch) {
  const urls = [...new Set(liste.map((r) => r.quelle_url))];
  if (urls.length < 2) continue;
  const dUrls = new Set((dNachMisch.get(k) || []).map((s) => s.quelle_url));
  if (urls.every((u) => dUrls.has(u))) continue;
  befund[3].push(`${k} — ${urls.length} URLs in der Tabelle, ${dUrls.size} in der Datei (ids ${liste.map((r) => r.id).join(',')})`);
}
for (const s of dateiImBlick) {
  if (istSperre(s) || !s.formel) continue;
  if (!s.quelle_url || !Array.isArray(s.belege) || !s.belege.length || !s.ags) { nichtEinspielbar++; continue; }
  if (!rNachVoll.has(voll(s))) befund[5].push(zeig(s));
}

/* ── 3 · Der echte Mischweg ────────────────────────────────────────── */
let mischStand = null;
try {
  reg.ladeSaat();
  const zeilen = imBlick.map((r) => ({ ...r }));
  mischStand = await reg.ladeAusDb(async () => zeilen);
  /* Jede Zeile, die aus der Tabelle in den Rechenweg kommt, muss unter
     ihrem Schluessel einem WERT der Datei mit derselben URL entsprechen —
     sonst steht sie ueber einer Sperre oder neben ihrem Nachfolger. */
  for (const [k, gl] of dNachMisch) {
    const s = gl[0];
    const wertUrls = new Set(gl.filter((x) => !istSperre(x)).map((x) => x.quelle_url));
    const imIndex = reg.finde(s.kennzahl, s.ags).filter((x) => x.ags === s.ags
      && String(x.zweig || 'standard') === String(s.zweig || 'standard') && jahr(x) === jahr(s));
    for (const x of imIndex.filter((y) => y.id != null && !wertUrls.has(y.quelle_url))) {
      befund[6].push(`${k} id=${x.id} — ${gl.some(istSperre) ? 'DB-Wert ueber Sperre' : 'DB-Zeile mit fremder URL'} im Rechenweg`);
    }
  }
} catch (e) {
  befund[6].push('Mischweg nicht pruefbar: ' + e.message);
}

/* ── 4 · Ausgabe ───────────────────────────────────────────────────── */
console.log('═══ REGISTER ⇄ mb.param_modell ═══ ' + (SSH ? 'ssh ' + SSH : 'Datei ' + JSONDATEI));
console.log(`DECKUNG: ${dateienGelesen} Dateien · ${datei.length} Saetze (${dateiImBlick.length} in den ${DBK.size} DB-Kennzahlen)`
  + ` · ${rows.length} DB-Zeilen (${imBlick.length} im Blick) · ${abgeglichen} Zeilen Satz fuer Satz abgeglichen`
  + ` (${imBlick.length ? Math.round(100 * abgeglichen / imBlick.length) : 0} %)`);
if (rows.length - imBlick.length) console.log(`   ${rows.length - imBlick.length} DB-Zeilen anderer Kennzahlen (liest ladeAusDb nicht) — nicht geprueft`);
if (nichtEinspielbar) console.log(`   ${nichtEinspielbar} Datei-Werte ohne quelle_url/belege/ags — nicht einspielbar, siehe saat-pruefen`);
if (mischStand) console.log(`   Mischweg: ${JSON.stringify({ geladen: mischStand.geladen, aus_saat: mischStand.aus_saat, verworfen: mischStand.verworfen || null })}`);
let rot = 0;
for (const n of [1, 2, 3, 4, 5, 6]) {
  const b = befund[n];
  console.log(`${b.length ? 'ROT ' : 'ok  '} ${n} ${TITEL[n]}: ${b.length}`);
  if (b.length) {
    rot++;
    const nachKz = {};
    b.forEach((z) => { const m = / (\w+)\//.exec(z) || /\|(\w+)\|/.exec(z); const k = m ? m[1] : '?'; nachKz[k] = (nachKz[k] || 0) + 1; });
    console.log('       je Kennzahl: ' + Object.entries(nachKz).map(([k, v]) => k + ' ' + v).join(' · '));
    (LISTE ? b : b.slice(0, 5)).forEach((z) => console.log('       · ' + z));
    if (!LISTE && b.length > 5) console.log(`       … ${b.length - 5} weitere (--liste)`);
  }
}
console.log(rot ? `ERGEBNIS: ROT (${rot} Regel(n))` : 'ERGEBNIS: sauber');
process.exit(rot ? 1 : 0);
