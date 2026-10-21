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

const { registerDeckung, LC, LAENDER, istSperre, maskiere } =
  await import(pathToFileURL(join(LIB, 'register_deckung.js')).href);
const { SAATDATEIEN, leseSaatdateien } =
  await import(pathToFileURL(join(LIB, 'ausschuss_register.js')).href);

const git = (...a) => { try { return execFileSync('git', a, { cwd: WURZEL, encoding: 'utf8' }).trim(); } catch (e) { return null; } };

/* ── 1 · Deckung wie im Admin ─────────────────────────────────────────── */
const D = await registerDeckung({ q: async () => { throw new Error('ohne Datenbank'); }, schreibeSchnappschuss: false });
if (D.dateien.vermisst) { console.error('ROT: ' + D.dateien.vermisst + ' Registerdatei(en) nicht lesbar'); process.exit(1); }

/* ── 2 · Herkunft je Wert und Ausschüsse mit Wert ─────────────────────── */
const { alle } = leseSaatdateien(SAATDATEIEN);
const landVon = (s) => LC[String((s && s.ags) || '').replace(/\D/g, '').slice(0, 2)]
  || (s && s.land_code && LAENDER.includes(String(s.land_code).toUpperCase()) ? String(s.land_code).toUpperCase() : null);
/* Jahrgang wie jahrVon() in register_deckung.js */
const jahrVon = (s) => {
  const b = Number(s.berichtsjahr ?? s.jahrgang);
  if (Number.isFinite(b) && b > 1900) return b;
  const t = /^(\d{4})/.exec(String(s.stichtag || ''));
  return t ? Number(t[1]) : null;
};
/* Name normiert wie normName() in register_deckung.js (dort nicht exportiert) —
   „Gutachterausschuss der Stadt Ansbach" und „… für Grundstückswerte Ansbach"
   sind EIN Ausschuss. */
const normName = (n) => String(n || '').toLowerCase()
  .replace(/gutachterausschuss(es)?|f(ü|ue)r|grundst(ü|ue)ckswerte|immobilienwerte|die ermittlung von|im bereich|des|der|den|die|in|gemeinsame[rn]?|obere[rn]?/g, ' ')
  .replace(/[^a-zäöüß0-9]+/g, '');
const ausschuss = (s) => s.gaa_name || s.ausschuss || s.gebiet_name || null;

let werte = 0, mitAusschuss = 0, mitJahr = 0, mitQuelle = 0;
const aus = new Set(), irwAus = new Set();
let irw = 0;
for (const s of alle) {
  if (!s || !s.kennzahl || istSperre(s)) continue;
  const L = landVon(s); if (!L) continue;
  werte++;
  const a = ausschuss(s);
  if (a) { mitAusschuss++; aus.add(L + '|' + normName(maskiere(a))); }
  if (jahrVon(s)) mitJahr++;
  if (s.quelle_url || s.quelle || (s.belege && s.belege.length)) mitQuelle++;
  if (s.kennzahl === 'umrechnung_irw') { irw++; irwAus.add(L + '|' + normName(a)); }
}
let ohneSeite = 0, jmin = null, jmax = null;
for (const L of D.laender) for (const z of Object.values(D.zellen[L])) {
  ohneSeite += z.ohne_seite || 0;
  if (z.jahr_min) jmin = jmin == null ? z.jahr_min : Math.min(jmin, z.jahr_min);
  if (z.jahr_max) jmax = jmax == null ? z.jahr_max : Math.max(jmax, z.jahr_max);
}
const summeWerte = Object.values(D.summe).reduce((n, z) => n + z.werte, 0);
if (summeWerte !== werte) { console.error('ROT: Werte gesamt ' + werte + ' ≠ Deckung ' + summeWerte); process.exit(1); }

/* ── 3 · Länder-Raster: je Land und Kennzahl Werte und Anteil ─────────── */
const KZ4 = ['lzs', 'swf', 'uk_flaeche', 'uk_wgfz'];
const laender = {};
for (const L of D.laender) {
  const r = { name: D.land_name[L] || L, werte: 0 };
  let w = 0, n = 0;
  for (const k of KZ4) {
    const z = D.zellen[L][k] || { werte: 0, sperren: 0 };
    r[k] = { w: z.werte, anteil: z.werte + z.sperren ? Math.round(100 * z.werte / (z.werte + z.sperren)) / 100 : 0 };
    w += z.werte; n += z.werte + z.sperren;
  }
  for (const z of Object.values(D.zellen[L])) r.werte += z.werte;
  r.anteil4 = n ? Math.round(100 * w / n) / 100 : 0;
  r.erfasst = Object.values(D.zellen[L]).some((z) => z.werte + z.sperren > 0);
  laender[L] = r;
}

const heute = new Date();
const stand = heute.toISOString().slice(0, 10);
const regPfad = 'marktbericht/backend/src/lib/register';
const R = {
  stand,
  erzeugt: heute.toISOString(),
  register_commit: git('log', '-1', '--format=%h', '--', regPfad, 'marktbericht/backend/src/lib/ausschuss_register.js'),
  register_lokal_geaendert: !!git('diff', '--name-only', 'HEAD', '--', regPfad, 'marktbericht/backend/src/lib/ausschuss_register.js'),
  quelle: 'registerDeckung() · lib/register_deckung.js, ohne Datenbank (wie Admin „Register & Ernte")',
  dateien: D.dateien.gelesen,
  saetze: D.saetze,
  kopf: {
    werte_gesamt: werte,
    lzs: D.summe.lzs ? D.summe.lzs.werte : 0,
    swf: D.summe.swf ? D.summe.swf.werte : 0,
    uk_flaeche: D.summe.uk_flaeche ? D.summe.uk_flaeche.werte : 0,
    uk_wgfz: D.summe.uk_wgfz ? D.summe.uk_wgfz.werte : 0,
    uk: (D.summe.uk_flaeche ? D.summe.uk_flaeche.werte : 0) + (D.summe.uk_wgfz ? D.summe.uk_wgfz.werte : 0),
    irw_tabellen: irw,
    irw_ausschuesse: irwAus.size,
    ausschuesse: aus.size,
    laender_erfasst: Object.values(laender).filter((l) => l.erfasst).length,
    laender_gesamt: LAENDER.length,
  },
  herkunft: { werte, mit_ausschuss: mitAusschuss, mit_jahrgang: mitJahr, mit_quelle: mitQuelle, mit_seite: werte - ohneSeite },
  jahrgaenge: [jmin, jmax],
  laender,
};

const kopfText = '/* messe-schleife-daten.mjs · erzeugt ' + R.erzeugt + ' — NICHT von Hand ändern.\n'
  + '   Neu erzeugen: node tools/messe-schleife-daten.mjs */\n';
fs.writeFileSync(join(ZIEL, 'register-stand.js'), kopfText + 'window.DPS_REGISTER = ' + JSON.stringify(R, null, 1) + ';\n');

/* ── 4 · Videothek-Liste aus videos.json ──────────────────────────────── */
const V = JSON.parse(fs.readFileSync(join(WURZEL, 'frontend/landing/assets/videothek/videos.json'), 'utf8'));
const kat = Object.fromEntries((V.kategorien || []).map((k) => [k.id, k.name]));
const liste = V.videos.map((v) => ({ id: v.id, nr: v.nr, kategorie: kat[v.kategorie] || v.kategorie, titel: v.titel,
  unterzeile: v.unterzeile, datei: v.datei, dauer: v.dauer }));
fs.writeFileSync(join(ZIEL, 'videothek-liste.js'), kopfText
  + 'window.DPS_VIDEOTHEK = ' + JSON.stringify({ stand: V.stand, videos: liste }, null, 1) + ';\n');

const k = R.kopf;
console.log('Register ' + stand + ' (' + R.register_commit + (R.register_lokal_geaendert ? ', LOKAL GEÄNDERT' : '') + '): '
  + R.dateien + ' Dateien, ' + R.saetze + ' Sätze, ' + k.werte_gesamt + ' Werte · LZS ' + k.lzs + ' · SWF ' + k.swf
  + ' · UK ' + k.uk + ' · IRW-Tabellen ' + k.irw_tabellen + ' (' + k.irw_ausschuesse + ' Ausschüsse) · Ausschüsse ' + k.ausschuesse
  + ' · Länder ' + k.laender_erfasst + '/' + k.laender_gesamt);
console.log('Herkunft: Ausschuss ' + R.herkunft.mit_ausschuss + ', Jahrgang ' + R.herkunft.mit_jahrgang + ', Quelle ' + R.herkunft.mit_quelle
  + ', Seite ' + R.herkunft.mit_seite + ' von ' + werte + ' · Jahrgänge ' + jmin + '–' + jmax);
console.log('Videothek ' + V.stand + ': ' + liste.length + ' Videos, ' + liste.reduce((s, v) => s + v.dauer, 0) + ' s');
