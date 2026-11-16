#!/usr/bin/env node
/* tools/partner-videos-eintragen.mjs · landing-partner-1 (16.11.2026)
 *
 * Traegt die fertigen Partner-Videos in die Videothek ein. Quelle ist die Liste, die der Video-Agent
 * anlegt: Dateien/Messe/Videos/Partner/videos.json (Titel, Datei, Dauer, Beschreibung, Vorschaubild).
 * Ziel ist frontend/landing/assets/videothek/videos.json, Reihe "partner".
 *
 *   node tools/partner-videos-eintragen.mjs              Trockenlauf: zeigt, was eingetragen wuerde
 *   node tools/partner-videos-eintragen.mjs --schreiben  schreibt videos.json und kopiert die Vorschaubilder
 *   --quelle=<pfad>                                      andere Quelldatei
 *
 * Was passiert:
 *   - Die Eintraege der Reihe "partner" werden ERSETZT (Platzhalter mit "geplant": true fallen weg,
 *     sobald es fertige Videos gibt). Fehlt einem Eintrag die Datei, bleibt er Platzhalter.
 *   - Vorschaubilder kommen nach frontend/landing/assets/videothek/ (png/jpg werden mit ffmpeg zu webp).
 *   - Die MP4s liegen NICHT im Git (frontend/landing/medien/ ist ignoriert). Der Lauf druckt die
 *     scp-Zeilen fuer Staging; Prod erst nach Marcels Okay.
 *   - Danach: Buster in dp2-live.js (QUELLE und datei()/bildUrl()) hochziehen.
 *
 * Akzeptierte Felder je Eintrag (deutsch oder englisch): titel|title, datei|file|mp4, datei_ton|file_voice,
 * dauer|duration (Sekunden oder "m:ss"), beschreibung|description, unterzeile|subtitle,
 * vorschaubild|poster|thumbnail, kapitel|chapters ([{t, titel, stichworte}]), id, nr.
 * Kundentexte: keine Gedankenstriche, kein Semikolon, keine Anbieternamen (wird geprueft und gemeldet).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');
const SCHREIBEN = process.argv.includes('--schreiben');
const QUELLE = arg('quelle') || path.join(WURZEL, 'Dateien/Messe/Videos/Partner/videos.json');
const ZIEL = path.join(WURZEL, 'frontend/landing/assets/videothek/videos.json');
const BILDER = path.join(WURZEL, 'frontend/landing/assets/videothek');

if (!fs.existsSync(QUELLE)) { console.log('Noch keine Liste: ' + QUELLE + '\nDie Videothek zeigt bis dahin die Platzhalter („Video folgt“).'); process.exit(0); }
const roh = JSON.parse(fs.readFileSync(QUELLE, 'utf8'));
const liste = Array.isArray(roh) ? roh : (roh.videos || []);
if (!liste.length) { console.log('Liste ist leer: ' + QUELLE); process.exit(0); }

const nimm = (o, ...k) => { for (const x of k) if (o[x] != null && o[x] !== '') return o[x]; return null; };
const sek = (d) => { if (d == null) return null; if (typeof d === 'number') return Math.round(d); const m = String(d).match(/^(\d+):(\d{1,2})$/); return m ? (+m[1]) * 60 + (+m[2]) : (Number(d) || null); };
const slug = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const VERBOTEN = [/[–—;]/, /Reseller/i, /Sprengnetter/i, /PriceHubble/i, /ImmobilienScout/i];

const quellOrdner = path.dirname(QUELLE);
const meldungen = [], kopien = [], scp = [];
const neu = liste.map((v, i) => {
  const titel = nimm(v, 'titel', 'title') || ('Partner-Video ' + (i + 1));
  const datei = nimm(v, 'datei', 'file', 'mp4');
  const bild = nimm(v, 'vorschaubild', 'poster', 'thumbnail');
  const beschr = nimm(v, 'beschreibung', 'description') || '';
  const e = { id: nimm(v, 'id') || ('partner-' + (i + 1) + '-' + slug(titel)), kategorie: 'partner', nr: nimm(v, 'nr') || ('P' + (i + 1)) };
  if (!datei) e.geplant = true;
  e.dauer = sek(nimm(v, 'dauer', 'duration')) || undefined;
  e.titel = titel;
  e.unterzeile = nimm(v, 'unterzeile', 'subtitle') || (beschr.split(/(?<=\.)\s/)[0] || '');
  if (beschr) e.story = beschr;
  if (datei) e.datei = path.basename(datei);
  const ton = nimm(v, 'datei_ton', 'file_voice'); if (ton) e.datei_ton = path.basename(ton);
  if (bild) {
    const b = path.isAbsolute(bild) ? bild : path.join(quellOrdner, bild);
    const zielName = path.basename(bild).replace(/\.(png|jpe?g)$/i, '.webp');
    e.poster = zielName;
    kopien.push([b, path.join(BILDER, zielName)]);
  } else if (datei) meldungen.push(titel + ': kein Vorschaubild, die Karte bliebe leer');
  const kap = nimm(v, 'kapitel', 'chapters'); if (Array.isArray(kap)) e.kapitel = kap;
  for (const t of [e.titel, e.unterzeile, e.story || '']) for (const r of VERBOTEN) if (r.test(t)) meldungen.push(titel + ': Text enthält ' + r);
  for (const f of [datei, ton].filter(Boolean)) {
    const lokal = path.isAbsolute(f) ? f : path.join(quellOrdner, f);
    scp.push('scp "' + lokal + '" root@116.203.214.11:/opt/dealpilot/frontend/landing/medien/videothek/' + path.basename(f));
    if (!fs.existsSync(lokal)) meldungen.push(titel + ': Videodatei fehlt lokal: ' + lokal);
  }
  if (!e.dauer) delete e.dauer;
  return e;
});

/* Ziel: Reihe "partner" ersetzen, Format der Datei erhalten (Eintraege 4 Leerzeichen, Felder 5) */
let s = fs.readFileSync(ZIEL, 'utf8');
const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const D = JSON.parse(s);
if (!(D.kategorien || []).some((k) => k.id === 'partner')) { console.error('In videos.json fehlt die Kategorie "partner".'); process.exit(1); }
const alt = D.videos.filter((v) => v.kategorie === 'partner').length;
/* Die uebrigen Eintraege bleiben Zeichen fuer Zeichen stehen: Objekte im Array per Klammerzaehlung
   (Zeichenketten uebersprungen) herausloesen, nur die der Reihe "partner" austauschen. */
const block = (o) => '    ' + JSON.stringify(o, null, 1).split('\n').map((z, j) => (j ? '    ' + z : z)).join('\n');
const aStart = s.indexOf('"videos": [') + '"videos": ['.length;
const teile = [];
let tiefe = 0, inStr = false, esc = false, von = -1;
for (let i = aStart; i < s.length; i++) {
  const c = s[i];
  if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
  if (c === '"') { inStr = true; continue; }
  if (c === '{') { if (tiefe === 0) von = i; tiefe++; }
  else if (c === '}') { tiefe--; if (tiefe === 0) teile.push(s.slice(von, i + 1)); }
  else if (c === ']' && tiefe === 0) break;
}
if (teile.length !== D.videos.length) { console.error('Zerlegung passt nicht: ' + teile.length + ' gegen ' + D.videos.length); process.exit(1); }
const ohne = teile.filter((t) => JSON.parse(t).kategorie !== 'partner').map((t) => '    ' + t);
const text = s.slice(0, aStart) + '\n' + ohne.concat(neu.map(block)).join(',\n') + '\n  ]\n}\n';
JSON.parse(text);   /* bricht ab, wenn etwas schiefging */

console.log('Quelle: ' + QUELLE + ' (' + liste.length + ' Einträge)');
console.log('Reihe partner: ' + alt + ' alt → ' + neu.length + ' neu, davon ' + neu.filter((v) => v.geplant).length + ' weiter Platzhalter');
neu.forEach((v) => console.log('  ' + v.nr + '  ' + v.titel + (v.geplant ? '  (Platzhalter)' : '  ' + v.datei + (v.dauer ? ' · ' + v.dauer + ' s' : ''))));
if (meldungen.length) { console.log('\nBitte ansehen:'); meldungen.forEach((m) => console.log('  ! ' + m)); }
if (!SCHREIBEN) { console.log('\nTrockenlauf. Mit --schreiben eintragen.'); process.exit(meldungen.some((m) => /Text enthält/.test(m)) ? 1 : 0); }

fs.writeFileSync(ZIEL, crlf ? text.replace(/\n/g, '\r\n') : text);
for (const [von, nach] of kopien) {
  if (!fs.existsSync(von)) { console.log('  ! Vorschaubild fehlt: ' + von); continue; }
  if (/\.webp$/i.test(von)) fs.copyFileSync(von, nach);
  else execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', von, '-vf', 'scale=960:-2', '-quality', '82', nach]);
  console.log('  Bild: ' + path.basename(nach));
}
console.log('\nGeschrieben: ' + path.relative(WURZEL, ZIEL));
console.log('Videos auf Staging hochladen (nicht im Git):');
scp.forEach((z) => console.log('  ' + z));
console.log('Danach Buster in frontend/landing/dp2-live.js (QUELLE, datei(), bildUrl()) hochziehen, committen, Staging ziehen.');
