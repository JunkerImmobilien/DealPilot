#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   sperren-anfrageliste.mjs · v3020 — ANFRAGELISTE AN DIE ÄMTER

   Marcel 28.10.2026: „bitte alle Sperren immer vermerken und pflege eine
   Liste dazu mit E-Mail, damit ich das irgendwann mal abfragen kann und
   dann Anfrage bei den Ämtern."

   Liest alle aktiven Registerdateien (SAATDATEIEN, ohne Datenbank), sammelt
   jede Sperre, bündelt je Gutachterausschuss und verbindet mit
   marktbericht/backend/src/lib/ausschuss_kontakte.json (E-Mail der
   Geschäftsstelle). Die Rechnung steht in lib/sperren_anfragen.js — dieselbe
   Funktion speist den Admin-Abschnitt „Anfragen an Ämter".

   Ausgabe:
     Dateien/Register/Sperren-Anfrageliste.csv  (Semikolon, UTF-8 mit BOM)
     Dateien/Register/Sperren-Anfrageliste.md   (nach Land, dann Sperren)

   Aufruf (Repo-Wurzel):  node tools/sperren-anfrageliste.mjs [--land=BW]
   Nach jeder Ernte laufen lassen. Rückgabe 0 · 1 bei Lesefehler oder
   wenn die Kontaktdatei einen Befund hat (E-Mail ohne Beleg, persönlich
   aussehendes Postfach, doppelter Schlüssel, unbekanntes Land).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(WURZEL, 'marktbericht/backend/src/lib');
const ZIEL = join(WURZEL, 'Dateien/Register');

const arg = (n) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : null; };
const land = arg('land');
if (land && !/^[A-Za-z]{2}$/.test(land)) { console.error('--land=XX (zwei Buchstaben)'); process.exit(1); }

let R, GRUND_NAME, KZ, KFEHLER;
try {
  const M = await import(pathToFileURL(join(LIB, 'sperren_anfragen.js')).href);
  const D = await import(pathToFileURL(join(LIB, 'register_deckung.js')).href);
  GRUND_NAME = M.GRUND_NAME; KZ = D.KZ_NAME;
  R = M.sperrenAnfrageliste({ land });
  KFEHLER = M.pruefeKontakte();
} catch (e) { console.error('ROT: ' + e.message); process.exit(1); }

const kzListe = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => (KZ[k] || k) + ' ' + n).join(', ');
const grListe = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([g, n]) => (GRUND_NAME[g] || g) + ' ' + n).join(', ');

/* ── CSV ─────────────────────────────────────────────────────────────── */
const zelle = (v) => { const s = v == null ? '' : String(v).replace(/\r?\n/g, ' '); return /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const kopf = ['Land', 'Ausschuss', 'Sperren', 'Kennzahlen', 'Hauptgrund', 'Gründe', 'Preis', 'Jahrgang',
  'E-Mail', 'E-Mail obere Stelle', 'E-Mail Landkreis', 'Telefon', 'Kontaktformular', 'Kontakt-Quelle', 'Kontakt gelesen am',
  'Bestell-Link', 'Quelle', 'Grund (Wortlaut)', 'Betreff', 'Schlüssel', 'weitere Schreibweisen', 'Hinweis Kontakt'];
const zeilen = R.ausschuesse.map((a) => [a.land, a.ausschuss, a.sperren, kzListe(a.kennzahlen),
  GRUND_NAME[a.hauptgrund] || a.hauptgrund, grListe(a.gruende), a.preise.join(' | '), a.jahrgang,
  a.email, a.kontakt && a.kontakt.email_obere_stelle, a.kontakt && a.kontakt.email_landkreis, a.kontakt && a.kontakt.telefon,
  a.kontakt && a.kontakt.kontaktformular_url, a.kontakt && a.kontakt.quelle_url,
  a.kontakt && a.kontakt.gelesen_am, a.bestell_urls.join(' | '), a.quelle_urls.join(' | '),
  a.grund_text, a.anfrage.betreff, a.schluessel, a.namen.join(' | '), a.kontakt && a.kontakt.hinweis]);
const csv = '﻿' + [kopf, ...zeilen].map((z) => z.map(zelle).join(';')).join('\r\n') + '\r\n';

/* ── Markdown ────────────────────────────────────────────────────────── */
const Z = R.zusammenfassung;
const md = [];
md.push('# Sperren — Anfrageliste an die Gutachterausschüsse', '');
md.push('Stand ' + R.stand + (R.land ? ' · nur ' + R.land : '') + ' · erzeugt mit `node tools/sperren-anfrageliste.mjs`'
  + ' aus den aktiven Registerdateien und `ausschuss_kontakte.json` (Stand ' + (R.kontakte_stand || '–') + ').', '');
md.push('## Zusammenfassung', '');
md.push('| | |', '|---|---:|');
md.push('| Ausschüsse mit Sperren | ' + Z.ausschuesse + ' |');
md.push('| Sperren | ' + Z.sperren + ' |');
md.push('| davon Ausschüsse mit belegter E-Mail der Geschäftsstelle | ' + Z.mit_email + ' |');
md.push('| nur E-Mail der oberen Stelle | ' + Z.nur_obere_stelle + ' |');
md.push('| nur Kontaktformular | ' + Z.mit_kontaktformular + ' |');
md.push('| ohne Kontakt | ' + (Z.ausschuesse - Z.mit_email - Z.nur_obere_stelle - Z.mit_kontaktformular) + ' |', '');
md.push('**Sperren je Grund** (Feld `zugang`)', '', '| Grund | Sperren |', '|---|---:|');
for (const [g, n] of Object.entries(Z.je_grund).sort((a, b) => b[1] - a[1])) md.push('| ' + (GRUND_NAME[g] || g) + ' | ' + n + ' |');
md.push('', '**Je Land**', '', '| Land | Ausschüsse | Sperren | mit E-Mail |', '|---|---:|---:|---:|');
for (const [l, v] of Object.entries(Z.je_land).sort()) md.push('| ' + l + ' | ' + v.ausschuesse + ' | ' + v.sperren + ' | ' + v.mit_email + ' |');
md.push('');
let aktLand = null;
for (const a of R.ausschuesse) {
  if (a.land !== aktLand) { aktLand = a.land; md.push('## ' + a.land, '', '| Ausschuss | Sperren | Kennzahlen | Grund | Preis | Jg. | E-Mail | Link |', '|---|---:|---|---|---|---|---|---|'); }
  const mail = a.email || (a.kontakt && a.kontakt.email_obere_stelle ? '(obere Stelle: ' + a.kontakt.email_obere_stelle + ')' : '')
    || (a.kontakt && a.kontakt.kontaktformular_url ? '[Formular](' + a.kontakt.kontaktformular_url + ')' : '–');
  const link = a.bestell_urls[0] || a.quelle_urls[0];
  md.push('| ' + [a.ausschuss.replace(/\|/g, '/'), a.sperren, kzListe(a.kennzahlen), grListe(a.gruende),
    (a.preise[0] || '').replace(/\|/g, '/'), a.jahrgang || '', mail, link ? '[Quelle](' + link + ')' : ''].join(' | ') + ' |');
  const naechste = R.ausschuesse[R.ausschuesse.indexOf(a) + 1];
  if (!naechste || naechste.land !== a.land) md.push('');
}

fs.mkdirSync(ZIEL, { recursive: true });
const suffix = R.land ? '-' + R.land : '';
fs.writeFileSync(join(ZIEL, 'Sperren-Anfrageliste' + suffix + '.csv'), csv);
fs.writeFileSync(join(ZIEL, 'Sperren-Anfrageliste' + suffix + '.md'), md.join('\n'));
console.log('Sperren ' + Z.sperren + ' · Ausschüsse ' + Z.ausschuesse + ' · mit E-Mail ' + Z.mit_email
  + ' · nur obere Stelle ' + Z.nur_obere_stelle + ' · Formular ' + Z.mit_kontaktformular);
console.log('→ Dateien/Register/Sperren-Anfrageliste' + suffix + '.csv / .md');
if (KFEHLER.length) {
  console.error('ROT: ausschuss_kontakte.json – ' + KFEHLER.length + ' Befund(e):');
  KFEHLER.slice(0, 20).forEach((f) => console.error('  · ' + f));
  process.exit(1);
}
console.log('Kontaktdatei sauber (' + Object.keys(JSON.parse(fs.readFileSync(join(LIB, 'ausschuss_kontakte.json'), 'utf8')).ausschuesse || {}).length + ' Einträge).');
