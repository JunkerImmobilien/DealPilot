#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   messe-schleife-daten.mjs · messe-schleife-5 — DATEN FÜR DIE MESSE-SCHLEIFE

   Marcel 21.10.2026: „Werbung für die Register & Ernte wie im Admin
   dargestellt, damit die Leute sehen, was wir haben" und „die normalen
   Videos auch als Schleife … einen extra Kanal".

   Die Messe-Schleife läuft auch direkt von der Platte (file://) — dort kann
   sie kein JSON abrufen. Deshalb schreibt dieses Werkzeug zwei SKRIPTE, die
   die Seite per <script> lädt:

     frontend/messe-schleife/register-stand.js   window.DPS_REGISTER
     frontend/messe-schleife/videothek-liste.js  window.DPS_VIDEOTHEK

   WOHER DIE REGISTERZAHLEN KOMMEN (keine erfunden):
     registerDeckung() aus marktbericht/backend/src/lib/register_deckung.js —
     dieselbe Rechnung wie der Admin-Reiter „Register & Ernte", ohne
     Datenbank (der DB-Abgleich fällt still aus, er steht nicht auf der
     Tafel). Sie liest die Registerdateien über leseSaatdateien(SAATDATEIEN),
     den Leseweg von ladeSaat(). Was nicht in SAATDATEIEN steht, zählt nicht.
     Dazu je Wert die Herkunftsfelder (Ausschuss, Jahrgang, Quelle) und die
     Zahl der Gutachterausschüsse MIT mindestens einem Wert.

   Auf der Tafel stehen nur Werte, nie Sperren- oder Lückenzahlen; die
   Sperren gehen nur als Anteil in die Farbe des Länder-Rasters ein.

   Aufruf (Repo-Wurzel):  node tools/messe-schleife-daten.mjs
   Nach jeder Ernte neu laufen lassen, Buster in messe-schleife.html hochziehen.
   Rückgabe 0 · 1 bei Lesefehler einer Registerdatei.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(WURZEL, 'marktbericht/backend/src/lib');
const ZIEL = join(WURZEL, 'frontend/messe-schleife');

/* v3930 · landing-zahlen-live-1: die Rechnung steht seit v3930 in lib/datenumfang.js
   (registerStandBerechnen) — derselbe Weg, den GET /api/v1/public/datenumfang auf dem Server geht.
   Wer hier zählen will, ändert sie DORT. */
const { registerStandBerechnen } = await import(pathToFileURL(join(LIB, 'datenumfang.js')).href);

const git = (...a) => { try { return execFileSync('git', a, { cwd: WURZEL, encoding: 'utf8' }).trim(); } catch (e) { return null; } };

let RS;
try { RS = await registerStandBerechnen(); }
catch (e) { console.error('ROT: ' + e.message); process.exit(1); }
const werte = RS.kopf.werte_gesamt;
const [jmin, jmax] = RS.jahrgaenge;

const heute = new Date();
const stand = heute.toISOString().slice(0, 10);
const regPfad = 'marktbericht/backend/src/lib/register';
const R = {
  stand,
  erzeugt: heute.toISOString(),
  register_commit: git('log', '-1', '--format=%h', '--', regPfad, 'marktbericht/backend/src/lib/ausschuss_register.js'),
  register_lokal_geaendert: !!git('diff', '--name-only', 'HEAD', '--', regPfad, 'marktbericht/backend/src/lib/ausschuss_register.js'),
  quelle: RS.quelle,
  dateien: RS.dateien,
  saetze: RS.saetze,
  kopf: RS.kopf,
  herkunft: RS.herkunft,
  jahrgaenge: RS.jahrgaenge,
  laender: RS.laender,
};

const kopfText = '/* messe-schleife-daten.mjs · erzeugt ' + R.erzeugt + ' — NICHT von Hand ändern.\n'
  + '   Neu erzeugen: node tools/messe-schleife-daten.mjs */\n';
fs.writeFileSync(join(ZIEL, 'register-stand.js'), kopfText + 'window.DPS_REGISTER = ' + JSON.stringify(R, null, 1) + ';\n');
/* landing-methodik-3 · Marcel 28.10.2026: „nur Zahlen groß nennen, in Karten, und immer anpassen, wenn wir
   neue Werte ernten". Die Landing liegt unter eigener Wurzel (/srv/landing) und erreicht messe-schleife/
   nicht – deshalb dieselbe Datei als Kopie dort. methodik.html zieht sie beim Aufruf nach. */
fs.writeFileSync(join(WURZEL, 'frontend/landing/register-stand.js'), kopfText + 'window.DPS_REGISTER = ' + JSON.stringify(R, null, 1) + ';\n');

/* ── 4 · Videothek-Liste aus videos.json ──────────────────────────────── */
const V = JSON.parse(fs.readFileSync(join(WURZEL, 'frontend/landing/assets/videothek/videos.json'), 'utf8'));
const kat = Object.fromEntries((V.kategorien || []).map((k) => [k.id, k.name]));
/* messe-schleife-8 · Marcel 28.10.2026: „das in der Messe-Schleife-Seite auch machen können bei den Videos" —
   die Kapitel mit Zeit (videos.json `kapitel: [{t, titel}]`) gehen mit, damit der Kanal Videothek sie
   als Marken zeigt und anspringt. Nur Kapitel MIT Zeit; Stichworte bleiben in der Landing (Suche). */
const liste = V.videos.map((v) => ({ id: v.id, nr: v.nr, kategorie: kat[v.kategorie] || v.kategorie, titel: v.titel,
  unterzeile: v.unterzeile, datei: v.datei, dauer: v.dauer,
  kapitel: (v.kapitel || []).filter((c) => c && typeof c.t === 'number' && isFinite(c.t)).map((c) => ({ t: c.t, titel: c.titel })) }));
fs.writeFileSync(join(ZIEL, 'videothek-liste.js'), kopfText
  + 'window.DPS_VIDEOTHEK = ' + JSON.stringify({ stand: V.stand, videos: liste }, null, 1) + ';\n');

const k = R.kopf;
console.log('Register ' + stand + ' (' + R.register_commit + (R.register_lokal_geaendert ? ', LOKAL GEÄNDERT' : '') + '): '
  + R.dateien + ' Dateien, ' + R.saetze + ' Sätze, ' + k.werte_gesamt + ' Werte · LZS ' + k.lzs + ' · SWF ' + k.swf
  + ' · UK ' + k.uk + ' · IRW-Tabellen ' + k.irw_tabellen + ' (' + k.irw_ausschuesse + ' Ausschüsse) · Ausschüsse ' + k.ausschuesse
  + ' · Länder mit Wert ' + k.laender_mit_wert + ' (mit Sätzen ' + k.laender_erfasst + '/' + k.laender_gesamt + ')');
console.log('Herkunft: Ausschuss ' + R.herkunft.mit_ausschuss + ', Jahrgang ' + R.herkunft.mit_jahrgang + ', Quelle ' + R.herkunft.mit_quelle
  + ', Seite ' + R.herkunft.mit_seite + ' von ' + werte + ' · Jahrgänge ' + jmin + '–' + jmax);
console.log('Videothek ' + V.stand + ': ' + liste.length + ' Videos, ' + liste.reduce((s, v) => s + v.dauer, 0) + ' s, '
  + liste.reduce((s, v) => s + v.kapitel.length, 0) + ' Kapitel mit Zeit');
