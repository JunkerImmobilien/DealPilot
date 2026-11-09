#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * detailgrad-pruefen.mjs — v3073
 *
 * DER DETAILGRAD EINSTEIGER · FORTGESCHRITTEN · EXPERTE GEGEN index.html
 *
 * Marcel 02.11.2026: der Schalter ersetzt die Eingabetiefe 1/2/3 und ist
 * an die Stufe des Marktberichts gekoppelt. Welche Karte und welches Feld
 * in welcher Stufe erscheint, steht in EINER Datei:
 *
 *   design/Vorschläge/arbeitsbereich-detailgrad-zuordnung.json   (Quelle)
 *   frontend/js/data/detailgrad-zuordnung.js                     (erzeugt)
 *
 * Geprüft wird:
 *   1. jede Feld-id ist ein Eingabefeld in index.html, im genannten Reiter,
 *      genau einmal, und steht in genau einer Stufe;
 *   2. jeder Karten-/Block-Selektor trifft in index.html genau sein Ziel
 *      (art karte: eine .card; kind: liegt in einer .card desselben
 *      Reiters; block: existiert) — oder, mit `js`, steht als id im
 *      genannten Modul (die Karte entsteht erst zur Laufzeit);
 *   3. die erzeugte Datei entspricht der JSON (sonst: --schreiben);
 *   4. die alte Mechanik ist ausgebaut: kein dp_zielstufe, kein
 *      oe-details-cb, kein data-oe-stufe-min / data-oe-detail /
 *      data-oe-ziel, kein zielSetzen/zielstufe an DealPilotObjektReiter
 *      (Ausnahme: die einmalige Übernahme in detailgrad.js);
 *   5. index.html lädt Daten VOR dem Modul und das Modul VOR objekt-reiter.js.
 *
 * Ausgabe: Feldzahl je Reiter und Stufe. Soll 45 / 154 / 287.
 *   Die Bestandsaufnahme nannte 288 für Experte — mit dem Haken
 *   #oe-details-cb, der im Schalter aufgeht und deshalb ausgebaut ist
 *   (die Demo zählte schon 287).
 *
 * Gezählt wird an einem eigenen Baum aus index.html (tools/lib-html-baum.mjs),
 * nicht im Browser: Karten, die erst ein Modul einhängt, haben hier keine
 * Felder. Das sind heute nur Karten ohne Eingabe (Mietrecht, Wert & Zielbild,
 * Deal-Aktion) und die Mietleiter #zb-leiter, deren Felder in index.html stehen.
 *
 *   node tools/detailgrad-pruefen.mjs              prüfen, RC=0 sauber
 *   node tools/detailgrad-pruefen.mjs --schreiben  erzeugte Datei neu schreiben
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baum, alle, vorfahr, istKarte, istFeld } from './lib-html-baum.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FE = path.join(WURZEL, 'frontend');
const JSON_PFAD = path.join(WURZEL, 'design', 'Vorschläge', 'arbeitsbereich-detailgrad-zuordnung.json');
const DATEN_PFAD = path.join(FE, 'js', 'data', 'detailgrad-zuordnung.js');
const SOLL = { 1: 47, 2: 153, 3: 287 };   /* v3213 · W-16: ek_inkl_nk entfernt (Fortgeschritten 154 -> 153) · v3236: san (Sanierungskosten) ab Einsteiger (45 -> 46) · v3243: Haken san_tax_active von Fortgeschritten nach Einsteiger (46 -> 47; Fortgeschritten kumuliert bleibt 153). Halter & Eigentum zogen von s0 nach s3-tax, beide Experte - die Summe Experte bleibt gleich */
const STUFEN = [['einsteiger', 1], ['fortgeschritten', 2], ['experte', 3]];
const NAMEN = { 1: 'Einsteiger', 2: 'Fortgeschritten', 3: 'Experte' };

const fehler = [];
const F = (m) => fehler.push(m);
const z = JSON.parse(fs.readFileSync(JSON_PFAD, 'utf8'));
const html = fs.readFileSync(path.join(FE, 'index.html'), 'utf8');
const root = baum(html);

/* ── erzeugte Datei ─────────────────────────────────────────────── */
function erzeugen() {
  const r = {};
  for (const [reiter, v] of Object.entries(z.reiter)) {
    r[reiter] = {};
    for (const [name, n] of STUFEN) {
      const t = v[name]; if (!t) continue;
      r[reiter][n] = {
        karten: (t.karten || []).map((k) => {
          const o = { s: k.selektor, art: k.art };
          if (k.nr != null) o.nr = k.nr;
          if (k.js) o.js = k.js;
          o.titel = k.titel;
          return o;
        }),
        felder: (t.felder || []).slice(),
      };
    }
  }
  return '/* frontend/js/data/detailgrad-zuordnung.js — ERZEUGT, nicht von Hand ändern.\n'
    + '   Quelle: design/Vorschläge/arbeitsbereich-detailgrad-zuordnung.json (Stand ' + z.stand + ')\n'
    + '   Neu erzeugen: node tools/detailgrad-pruefen.mjs --schreiben\n'
    + '   Je Reiter und Stufe (1 Einsteiger · 2 Fortgeschritten · 3 Experte): Karten/Bereiche und Feld-ids,\n'
    + '   die AB dieser Stufe erscheinen. Was nicht gelistet ist, ist Experte. Leser: js/detailgrad.js. */\n'
    + 'window.DpDetailgradZuordnung = ' + JSON.stringify({ stand: z.stand, reiter: r }, null, 1) + ';\n';
}
const soll = erzeugen();
if (process.argv.includes('--schreiben')) {
  fs.writeFileSync(DATEN_PFAD, soll, 'utf8');
  console.log('geschrieben: ' + path.relative(WURZEL, DATEN_PFAD));
}
const ist = fs.existsSync(DATEN_PFAD) ? fs.readFileSync(DATEN_PFAD, 'utf8').replace(/\r\n/g, '\n') : '';
if (ist !== soll) F('frontend/js/data/detailgrad-zuordnung.js weicht von der JSON ab → node tools/detailgrad-pruefen.mjs --schreiben');

/* ── 1 + 2 · Felder und Selektoren ───────────────────────────────── */
const byId = new Map();
for (const e of alle(root, (e) => !!e.attrs.id)) {
  if (!byId.has(e.attrs.id)) byId.set(e.attrs.id, []);
  byId.get(e.attrs.id).push(e);
}
const reiterEl = (id) => (byId.get(id) || [])[0];
const gesehen = new Map();
const tabelle = [];
let summe = { 1: 0, 2: 0, 3: 0 };

function treffer(sec, sel) {
  if (/^#[\w-]+$/.test(sel)) return (byId.get(sel.slice(1)) || []).filter((e) => !sec || vorfahr(e, (x) => x === sec) || e === sec);
  if (/^\.[\w-]+$/.test(sel)) { const k = sel.slice(1); return alle(sec || root, (e) => e.klassen.includes(k)); }
  return null;
}

for (const [reiter, v] of Object.entries(z.reiter)) {
  const sec = reiterEl(reiter);
  if (!sec) { F(reiter + ': Reiter fehlt in index.html'); continue; }
  const zeile = { reiter, 1: 0, 2: 0, 3: 0, alle: alle(sec, istFeld).length };
  for (const [name, n] of STUFEN) {
    const t = v[name]; if (!t) continue;
    for (const id of t.felder || []) {
      if (gesehen.has(id)) F(reiter + '/' + name + ': Feld ' + id + ' steht schon in ' + gesehen.get(id));
      gesehen.set(id, reiter + '/' + name);
      const els = byId.get(id) || [];
      if (els.length !== 1) { F(reiter + '/' + name + ': Feld #' + id + ' ' + els.length + '× in index.html'); continue; }
      const e = els[0];
      if (!istFeld(e)) F(reiter + '/' + name + ': #' + id + ' ist kein Eingabefeld (' + e.tag + ', Z. ' + e.zeile + ')');
      if (!vorfahr(e, (x) => x === sec)) F(reiter + '/' + name + ': #' + id + ' liegt nicht im Reiter (Z. ' + e.zeile + ')');
      zeile[n]++;
    }
    for (const k of t.karten || []) {
      const wo = reiter + '/' + name + ' „' + k.titel + '" ' + k.selektor;
      const tr = treffer(sec, k.selektor);
      if (tr === null) { F(wo + ': Selektor-Form nicht unterstützt (nur #id oder .klasse)'); continue; }
      const nr = k.nr || 0;
      if (!tr.length) {
        if (!k.js) { F(wo + ': kein Treffer in index.html'); continue; }
        const modul = path.join(FE, 'js', k.js);
        if (!fs.existsSync(modul)) { F(wo + ': Modul ' + k.js + ' fehlt'); continue; }
        const q = fs.readFileSync(modul, 'utf8');
        const id = k.selektor.slice(1);
        const re = new RegExp('id=\\\\?["\']' + id + '\\\\?["\']|\\.id\\s*=\\s*["\']' + id + '["\']|class=\\\\?["\'][^"\']*\\b' + id + '\\b');
        if (!re.test(q)) F(wo + ': weder in index.html noch in ' + k.js);
        continue;
      }
      if (tr.length > 1 && k.nr == null) F(wo + ': ' + tr.length + ' Treffer, aber keine nr');
      const e = tr[nr];
      if (!e) { F(wo + ': Treffer ' + nr + ' fehlt'); continue; }
      if (k.art === 'karte' && !istKarte(e)) F(wo + ': ist keine .card (Z. ' + e.zeile + ')');
      if (k.art === 'kind') {
        const karte = vorfahr(e, istKarte);
        if (!karte) F(wo + ': liegt in keiner .card (Z. ' + e.zeile + ')');
        else if (!vorfahr(karte, (x) => x === sec)) F(wo + ': Karte liegt nicht im Reiter');
      }
    }
  }
  zeile[2] += zeile[1];
  zeile[3] = zeile.alle;
  for (const n of [1, 2, 3]) summe[n] += zeile[n];
  tabelle.push(zeile);
}

/* ── 4 · alte Mechanik ausgebaut ───────────────────────────────────── */
const ALT = [/dp_zielstufe/, /oe-details-cb/, /data-oe-stufe-min/, /data-oe-detail\b/, /data-oe-ziel\b/, /data-oe-pillen/,
  /ObjektReiter\.zielSetzen|R\.zielSetzen|OR\.zielstufe|R\.zielstufe|_R\.zielstufe|\.zielstufe\(\)/];
function dateien(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) { if (!/^(patchesold|node_modules|vendor|lib)$/.test(n.name)) dateien(p, out); }
    else if (/\.(js|html|css)$/.test(n.name) && !/\.pre-/.test(n.name)) out.push(p);
  }
  return out;
}
const AUSNAHME = new Set(['js/detailgrad.js', 'handbuch/handbuch-daten.js']);
for (const p of dateien(FE)) {
  const rel = path.relative(FE, p).replace(/\\/g, '/');
  if (AUSNAHME.has(rel)) continue;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((l, i) => {
    for (const re of ALT) if (re.test(l)) F('Altlast ' + rel + ':' + (i + 1) + ' ' + re.source + ' → ' + l.trim().slice(0, 100));
  });
}
/* objekt-reiter darf zielstufe/zielSetzen nicht mehr exportieren */
const or = fs.readFileSync(path.join(FE, 'js', 'objekt-reiter.js'), 'utf8');
if (/zielSetzen\s*:|zielstufe\s*:/.test(or)) F('objekt-reiter.js exportiert noch zielstufe/zielSetzen');

/* ── 5 · Ladereihenfolge ───────────────────────────────────────────── */
const iD = html.indexOf('src="js/data/detailgrad-zuordnung.js'), iM = html.indexOf('src="js/detailgrad.js'), iO = html.indexOf('src="js/objekt-reiter.js');
if (iD < 0 || iM < 0) F('index.html lädt detailgrad-zuordnung.js / detailgrad.js nicht');
else if (!(iD < iM && iM < iO)) F('Ladereihenfolge: Daten → detailgrad.js → objekt-reiter.js');
if (!/id="dp_stufe"/.test(html)) F('index.html: Feld #dp_stufe fehlt');
const st = fs.readFileSync(path.join(FE, 'js', 'storage.js'), 'utf8');
if (!/'dp_stufe'/.test(st)) F('storage.js: dp_stufe steht nicht in FIELDS');

/* ── Ausgabe ───────────────────────────────────────────────────────── */
console.log('── detailgrad-pruefen · Felder je Reiter (Stufe kumuliert) ─────');
console.log('Reiter    Einst.  Fortg.  Experte');
for (const t of tabelle) console.log(t.reiter.padEnd(8) + String(t[1]).padStart(7) + String(t[2]).padStart(8) + String(t[3]).padStart(9));
console.log('Summe   ' + String(summe[1]).padStart(7) + String(summe[2]).padStart(8) + String(summe[3]).padStart(9) + '   (Soll ' + SOLL[1] + ' / ' + SOLL[2] + ' / ' + SOLL[3] + ')');
for (const n of [1, 2, 3]) if (summe[n] !== SOLL[n]) F(NAMEN[n] + ': ' + summe[n] + ' Felder, Soll ' + SOLL[n]);
if (fehler.length) {
  console.log('\nROT · ' + fehler.length + ' Befund(e):');
  fehler.slice(0, 40).forEach((m) => console.log('  ' + m));
  if (fehler.length > 40) console.log('  … und ' + (fehler.length - 40) + ' weitere');
  process.exit(1);
}
console.log('\nsauber: ' + gesehen.size + ' Feld-ids und alle Karten-Selektoren gefunden, Datei aktuell, alte Mechanik ausgebaut.');
