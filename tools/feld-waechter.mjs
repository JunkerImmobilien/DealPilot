#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1828 · FELDER, DIE BEIM SPEICHERN VERLORENGEHEN
   ═══════════════════════════════════════════════════════════════════════

   GEMESSEN am 04.10.2026: `d2_vertrag`, `d2_bspar` und `ek_inkl_nk`
   standen im HTML, wurden an vier Stellen GELESEN und nie gespeichert —
   weil sie nicht in `FIELDS` stehen. `collectData()` sammelt
   ausschliesslich, was dort steht; alles andere faellt lautlos weg.

     > Ein Feld, das gelesen und nie geschrieben wird, sieht im Code aus
     > wie eine Funktion. Es ist eine Leitung ohne Zufluss.

   Dieser Waechter vergleicht beide Seiten:

     A · jedes <input>/<select>/<textarea> mit id in index.html
     B · die Liste FIELDS in storage.js
     C · die Felder mit EIGENER Behandlung (`_`-Schluessel, z. B.
         `_ek_ist_nk`) — die sind gespeichert, nur anders

   Was in A steht und weder in B noch in C vorkommt, geht verloren.

   ── WARUM EINE BASISLINIE ───────────────────────────────────────────────

   Die App hat Hunderte Felder, von denen viele mit Absicht nicht
   gespeichert werden: Anzeigefelder, Filter, Suchzeilen, Schalter der
   Oberflaeche. Ein Waechter, der die alle meldet, wird nicht gelesen —
   dieselbe Lehre wie beim Gold-Audit (468 Fundstellen, jahrelang rot,
   jahrelang ignoriert).

   Deshalb: der Altbestand steht in `tools/feld-waechter-basislinie.txt`.
   MEHR als dort = rot. Weniger = gruen mit dem Hinweis, die Basislinie
   zu senken. Der Deckel darf sinken, nie steigen.

   Und er nennt seine DECKUNG: wie viele Felder er gelesen hat. "0
   Treffer" aus einem Werkzeug, das nichts gelesen hat, ist kein Befund.

   Aufruf:
     node tools/feld-waechter.mjs
     node tools/feld-waechter.mjs --basislinie-schreiben
   ═══════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..');
const HTML = join(WURZEL, 'frontend', 'index.html');
const STORE = join(WURZEL, 'frontend', 'js', 'storage.js');
const BASIS = join(HIER, 'feld-waechter-basislinie.txt');
const SCHREIBEN = process.argv.includes('--basislinie-schreiben');

const html = readFileSync(HTML, 'utf8');
const store = readFileSync(STORE, 'utf8');

/* ── A · Eingabefelder im HTML ──────────────────────────────────────────
   Nur echte Eingaben. `type="hidden"` zaehlt mit: `zaer` ist versteckt
   und traegt trotzdem einen Wert. Knoepfe nicht. */
const felder = new Map();          /* id -> {tag, typ} */
const re = /<(input|select|textarea)\b([^>]*)>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  const tag = m[1].toLowerCase();
  const attr = m[2];
  const idm = attr.match(/\bid\s*=\s*"([^"]+)"/);
  if (!idm) continue;
  const typm = attr.match(/\btype\s*=\s*"([^"]+)"/);
  const typ = typm ? typm[1].toLowerCase() : (tag === 'input' ? 'text' : tag);
  if (['button', 'submit', 'reset', 'image', 'file'].includes(typ)) continue;
  felder.set(idm[1], { tag, typ });
}

/* ── B · Die Feldlisten ────────────────────────────────────────────────
   Aus der echten Datei gelesen, nicht nachgebaut.

   ACHTUNG, HIER STAND DER ERSTE ENTWURF FALSCH: er las nur `var FIELDS =
   [` bis zur ersten `];` und meldete daraufhin 87 angeblich verlorene
   Felder — darunter die ganze Wertermittlung. In Wahrheit steht die in
   einer ZWEITEN Liste `WM_FIELDS`, die mit `.concat(WM_FIELDS)` an FIELDS
   gehaengt wird (storage.js:147).

     > Ein Waechter, der die halbe Quelle liest, meldet die andere Haelfte
     > als Fehler. Er ist dann lauter als ein kaputter, aber genauso
     > unbrauchbar.

   Deshalb werden ALLE `var X = [ … ];`-Bloecke der Datei eingelesen, die
   wie eine Feldliste aussehen (ueberwiegend kurze Zeichenketten). */
const inFields = new Set();
let listen = 0;
/* Das Blockende per KLAMMERTIEFE, nicht per `];`. FIELDS endet mit
   `].concat(WM_FIELDS);` — wer nach `];` sucht, laeuft darueber hinweg bis
   zur naechsten fremden Liste und verwirft dann alles. Genau das hat der
   zweite Entwurf getan: 108 statt 227 Eintraege, und `baujahr` galt als
   nicht gespeichert. */
function blockEnde(s, auf) {
  let tiefe = 0;
  for (let i = auf; i < s.length; i++) {
    const c = s[i];
    if (c === '[') tiefe++;
    else if (c === ']') { tiefe--; if (tiefe === 0) return i; }
    else if (c === "'" || c === '"') {           /* Zeichenketten ueberspringen */
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
    }
  }
  return -1;
}
for (const bm of store.matchAll(/var\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\[/g)) {
  const von = bm.index + bm[0].length - 1;
  const bis = blockEnde(store, von);
  if (bis < 0) continue;
  const block = store.slice(von, bis);
  const werte = [...block.matchAll(/'([^']{1,40})'/g)].map((x) => x[1]);
  if (werte.length < 5) continue;
  /* Eine Feldliste besteht aus Bezeichnern. Ein einzelner Fremdwert darf
     sie nicht kippen — sonst verwirft ein Tippfehler die ganze Liste. */
  const brauchbar = werte.filter((w) => /^[a-z0-9_-]+$/i.test(w));
  if (brauchbar.length < werte.length * 0.8) continue;
  listen++;
  for (const w of brauchbar) inFields.add(w);
}
if (!listen) { console.log('ABBRUCH: keine Feldliste in storage.js gefunden.'); process.exit(2); }

/* ── C · Felder mit eigenem Speicherweg ────────────────────────────────
   Nicht alles laeuft ueber die Listen. Erfasst wird jede id, die in
   IRGENDEINER Frontend-Datei neben einem Schreibzugriff auf den
   Datensatz steht — also `d['_x'] = …getElementById('x')`, aber auch die
   Module, die ihren Teil selbst speichern (afa-ui.js, tax.js, …).

   Der erste Entwurf suchte nur in storage.js und nur in DERSELBEN Zeile.
   Er fand null. Dass ein Werkzeug null findet, ist zuerst ein Verdacht
   gegen das Werkzeug. */
const eigen = new Set();
const quellen = [store];
for (const f of ['afa-ui.js', 'tax.js', 'calc.js', 'wertermittlung-ui.js',
                 'quick-check.js', 'sanierung.js', 'dealscore2.js']) {
  const p = join(WURZEL, 'frontend', 'js', f);
  if (existsSync(p)) quellen.push(readFileSync(p, 'utf8'));
}
for (const q of quellen) {
  /* id aus getElementById/$ , wenn im Umkreis von 200 Zeichen ein
     Schreibzugriff auf einen Datensatz steht. */
  for (const t of q.matchAll(/(?:getElementById|\$)\(\s*'([^']+)'\s*\)/g)) {
    const um = q.slice(Math.max(0, t.index - 200), t.index + 200);
    if (/\b(d|data|out|obj|deal|State\.\w+)\s*\[\s*['"]/.test(um)
        || /\bsave\w*\(|\bcollect\w*\(|_speicher/i.test(um)) eigen.add(t[1]);
  }
}

/* ── Der Abgleich ─────────────────────────────────────────────────────── */
const verloren = [];
for (const [id, info] of felder) {
  if (inFields.has(id)) continue;
  if (eigen.has(id)) continue;
  verloren.push(id + '\t' + info.tag + '/' + info.typ);
}
verloren.sort();

/* ── Deckung nennen, bevor irgendein Befund kommt ─────────────────────── */
console.log('═══ FELD-WAECHTER (v1828) ═══');
console.log('Deckung: ' + felder.size + ' Eingabefelder in index.html gelesen · '
  + inFields.size + ' Eintraege in FIELDS · ' + eigen.size + ' mit eigener Behandlung');
if (felder.size < 100) {
  console.log('ABBRUCH: unter 100 Felder gelesen — das Werkzeug hat die Datei nicht erreicht.');
  process.exit(2);
}

if (SCHREIBEN) {
  writeFileSync(BASIS, verloren.join('\n') + '\n', 'utf8');
  console.log('Basislinie geschrieben: ' + verloren.length + ' Felder.');
  process.exit(0);
}

if (!existsSync(BASIS)) {
  console.log('Keine Basislinie. ' + verloren.length + ' Felder ohne Speicherweg:');
  console.log(verloren.map((z) => '  ' + z).join('\n'));
  console.log('\nMit --basislinie-schreiben einfrieren.');
  process.exit(1);
}

const alt = new Set(readFileSync(BASIS, 'utf8').split(/\r?\n/).filter(Boolean));
const neu = verloren.filter((z) => !alt.has(z));
const weg = [...alt].filter((z) => !verloren.includes(z));

if (neu.length) {
  console.log('\n✗ NEU ohne Speicherweg (' + neu.length + '):');
  console.log(neu.map((z) => '  ' + z.replace('\t', '  ')).join('\n'));
  console.log('\nDiese Felder nimmt der Nutzer auf und verliert sie beim naechsten Laden.');
  console.log('Entweder in FIELDS eintragen oder — wenn sie nicht gespeichert');
  console.log('werden sollen — mit --basislinie-schreiben eintragen.');
  process.exit(1);
}

console.log('\n✓ sauber: ' + verloren.length + ' Felder ohne Speicherweg, alle in der Basislinie.');
if (weg.length) {
  console.log('  ' + weg.length + ' Feld(er) haben jetzt einen Weg — Basislinie darf sinken:');
  console.log(weg.map((z) => '    ' + z.replace('\t', '  ')).join('\n'));
  console.log('  node tools/feld-waechter.mjs --basislinie-schreiben');
}
process.exit(0);
