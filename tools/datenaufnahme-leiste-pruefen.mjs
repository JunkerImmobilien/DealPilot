#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   datenaufnahme-leiste-pruefen.mjs · v2121 (11.10.2026)

   Haelt zwei Befunde fest, die beide dadurch entstanden sind, dass
   mehrere Versionen dieselbe Flaeche umgebaut haben:

   1 · v2119 — DIE LEISTE KNAUTSCHTE STATT UMZUBRECHEN
       `#oab-bar` stand auf `flex-wrap:nowrap`, und jedes Kind durfte
       schrumpfen (`flex-shrink:1` plus `min-width:0`). Gemessen bei
       1180 px: Summe der Kinder = Innenbreite, also KEIN Ueberlauf —
       und trotzdem vier gekappte Beschriftungen und ein auf 39 px
       gequetschter QR-Kasten mit einem 54 px SVG darin.

   2 · v2120 — DER ABRUF-KNOPF WAR GOLD AUF GOLD
       `#oab-bar` traegt den Runway-Verlauf. `#oab-run` trug seit v599
       denselben Verlauf. Kontrast k = 1,07. Sichtbar blieb der Knopf
       nur durch 1 px Rest des weissen Stubs.

   ── WARUM EIN PRUEFER UND NICHT NUR EIN KOMMENTAR ──────────────────
   Der Gold-Knopf ist DREIMAL gesetzt worden (v597 weiss, v599 gold,
   v601 gold mit ID). Jede dieser Regeln war zu ihrer Zeit richtig.
   Ein Kommentar haelt das nicht auf; eine vierte Runde wuerde die
   dritte wieder herstellen. Deshalb rechnet dieser Pruefer die
   SPEZIFITAET aus und sagt, welche Regel am Ende gewinnt.

   ── WAS ER NICHT KANN (ausdruecklich) ──────────────────────────────
   Er liest Stylesheets, nicht den Browser. Er sieht keine
   Inline-Stile, keine per JS gesetzten Eigenschaften und keine
   Reihenfolge ueber Dateigrenzen hinweg, die erst das `<link>` in
   `index.html` festlegt. Die Reihenfolge der BLAETTER nimmt er aus
   `index.html` — mehr Deckung geht ohne Browser nicht, und das steht
   unten in der Deckungszeile.

   RC = 0 sauber, RC = 1 Befund.
   ══════════════════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';

const WURZEL = process.argv[2] || '.';
const INDEX  = path.join(WURZEL, 'frontend', 'index.html');

/* ── Kommentare weg, Zeilennummern behalten ─────────────────────────
   CSS-Kommentare schachteln NICHT: `/*` laeuft bis zum ersten `*​/`.
   Ersetzt wird zeichenweise durch Leerzeichen bzw. Zeilenumbruch,
   damit jede spaetere Position noch dieselbe Zeile trifft. */
function ohneKommentare(t) {
  let out = '', i = 0;
  while (i < t.length) {
    if (t[i] === '/' && t[i + 1] === '*') {
      const e = t.indexOf('*/', i + 2);
      const bis = e < 0 ? t.length : e + 2;
      for (let k = i; k < bis; k++) out += (t[k] === '\n' ? '\n' : ' ');
      i = bis;
    } else { out += t[i]; i++; }
  }
  return out;
}

/* ── Spezifitaet (a,b,c) ────────────────────────────────────────────
   :is()/:not()/:has() erben die Spezifitaet ihres STAERKSTEN
   Arguments, :where() zaehlt null. Das ist genau die Falle, an der
   v1992 schon einmal haengengeblieben ist. */
function spez(sel) {
  let a = 0, b = 0, c = 0;
  let s = ' ' + sel.trim();
  /* innerste Funktionen zuerst aufloesen */
  let vorher;
  do {
    vorher = s;
    s = s.replace(/:(is|not|has|matches|where)\(([^()]*)\)/gi, (m, f, inner) => {
      if (f.toLowerCase() === 'where') return ' ';
      let best = [0, 0, 0];
      for (const teil of teileOben(inner)) {
        const q = spez(teil);
        if (q[0] > best[0] || (q[0] === best[0] && (q[1] > best[1] || (q[1] === best[1] && q[2] > best[2])))) best = q;
      }
      a += best[0]; b += best[1]; c += best[2];
      return ' ';
    });
  } while (s !== vorher);
  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+/g) || []).length;
  b += (s.match(/\[[^\]]+\]/g) || []).length;
  b += (s.match(/:(?!:)[\w-]+/g) || []).length;
  c += (s.match(/::[\w-]+/g) || []).length;
  c += (s.match(/(^|[\s>+~(])([a-zA-Z][\w-]*)(?![\w-]*\()/g) || []).length;
  return [a, b, c];
}
const groesser = (x, y) => {
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/* ── Regeln einsammeln, @media-Bedingung mitfuehren ───────────────── */
function regeln(css, datei) {
  const t = ohneKommentare(css);
  const out = [];
  const stapel = [];
  let i = 0, start = 0;
  const zeileVon = (p) => t.slice(0, p).split('\n').length;
  while (i < t.length) {
    const ch = t[i];
    if (ch === '{') {
      const kopf = t.slice(start, i).trim();
      if (kopf.startsWith('@')) {
        stapel.push(kopf);
        const e = bisZu(t, i);
        /* Inhalt rekursiv, Bedingung angehaengt */
        const inner = t.slice(i + 1, e);
        for (const r of regeln(inner, datei)) {
          r.medien = [kopf].concat(r.medien || []);
          r.zeile += zeileVon(i + 1) - 1;
          out.push(r);
        }
        stapel.pop();
        i = e + 1; start = i; continue;
      }
      const e = bisZu(t, i);
      const koerper = t.slice(i + 1, e);
      const z = zeileVon(start);
      for (const sel of teileOben(kopf)) {
        const s = sel.trim(); if (!s) continue;
        out.push({ sel: s, spez: spez(s), koerper, datei, zeile: z, medien: [] });
      }
      i = e + 1; start = i; continue;
    }
    if (ch === '}') { i++; start = i; continue; }
    i++;
  }
  return out;
}
/* ── Selektorliste auf OBERSTER Ebene trennen ──────────────────────
   `:is(#oab-bar,#qc7-sources)` enthaelt ein Komma. Ein nackter
   `split(',')` zerlegt genau die Selektoren, auf die es hier
   ankommt - und meldet dann Spezifitaeten, die es nicht gibt.
   (Erster Lauf dieses Pruefers hat sich daran selbst erwischt:
   Sieger war `#qc7-sources).dp-pfbar #oab-run…`.) */
function teileOben(kopf) {
  const out = []; let tief = 0, akt = '';
  for (const ch of kopf) {
    if (ch === '(' || ch === '[') tief++;
    else if (ch === ')' || ch === ']') tief--;
    if (ch === ',' && tief === 0) { out.push(akt); akt = ''; continue; }
    akt += ch;
  }
  if (akt.trim()) out.push(akt);
  return out;
}

function bisZu(t, offen) {
  let tief = 0;
  for (let i = offen; i < t.length; i++) {
    if (t[i] === '{') tief++;
    else if (t[i] === '}') { tief--; if (tief === 0) return i; }
  }
  return t.length;
}
function eig(koerper, name) {
  const re = new RegExp('(^|;)\\s*' + name + '\\s*:([^;}]*)', 'i');
  const m = koerper.match(re);
  if (!m) return null;
  const roh = m[2].trim();
  return { wert: roh.replace(/!important/i, '').trim(), wichtig: /!important/i.test(roh) };
}

/* ── Blaetter in der Reihenfolge, die index.html vorgibt ──────────── */
const html = fs.readFileSync(INDEX, 'utf8');
const blaetter = [];
for (const m of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"'?]+)/gi)) {
  const rel = m[1];
  if (/^https?:/.test(rel)) continue;
  const p = path.join(WURZEL, 'frontend', rel);
  if (fs.existsSync(p)) blaetter.push({ rel, p });
}
if (!blaetter.length) { console.error('ABBRUCH: kein lokales Stylesheet in index.html gefunden.'); process.exit(1); }

let alle = [];
let zeichen = 0;
for (const b of blaetter) {
  const css = fs.readFileSync(b.p, 'utf8');
  zeichen += css.length;
  const r = regeln(css, b.rel);
  r.forEach((x, k) => { x.blattNr = blaetter.indexOf(b); x.pos = k; });
  alle = alle.concat(r);
}

/* ── Treffer-Entscheid: welche Regel gewinnt fuer eine Eigenschaft ──
   Nur Selektoren, die ohne Browser sicher auf das Ziel passen —
   deshalb per Textprobe gegen eine Liste bekannter Formen, nicht per
   matches(). Was nicht sicher passt, wird NICHT gezaehlt und unten in
   der Deckung genannt. */
function passtAufAbrufKnopf(sel) {
  /* der Knopf ist: button#oab-run.dp-pf-launch.oab-act in
     .dp-pf-rz in #oab-bar.dp-pfbar in .dp-pf-scroll in #obj-action-bar */
  const kette = ['#oab-run', '.dp-pf-launch', '.oab-act', 'button',
                 '.dp-pf-rz', '#oab-bar', '.dp-pfbar', '.dp-pf-scroll',
                 '#obj-action-bar', ':is(#oab-bar,#qc7-sources)', '.sec', '#s0'];
  /* jeder Bestandteil des Selektors muss in der Kette vorkommen */
  const teile = sel.split(/[\s>+~]+/).filter(Boolean);
  for (const t of teile) {
    const bits = t.match(/(::?[\w-]+(\([^)]*\))?|#[\w-]+|\.[\w-]+|\[[^\]]+\]|^[a-zA-Z][\w-]*)/g) || [];
    for (const b of bits) {
      if (/^:(hover|focus|active|focus-within|disabled|not|is|has|where)/.test(b)) continue;
      if (b === '*') continue;
      const norm = b.replace(/\s/g, '');
      if (!kette.some(k => k.replace(/\s/g, '').includes(norm))) return false;
    }
  }
  return true;
}

function gewinner(prop, filter) {
  const kand = alle.filter(r => filter(r.sel) && eig(r.koerper, prop));
  /* Medien: nur Baender, die Desktop/Handy wirklich betreffen, werden
     getrennt ausgewertet. Ohne Browser gilt: alles ohne @media. */
  const ohneMedien = kand.filter(r => !r.medien.length);
  ohneMedien.sort((x, y) => {
    const ex = eig(x.koerper, prop), ey = eig(y.koerper, prop);
    if (ex.wichtig !== ey.wichtig) return ex.wichtig ? 1 : -1;
    if (groesser(x.spez, y.spez)) return 1;
    if (groesser(y.spez, x.spez)) return -1;
    if (x.blattNr !== y.blattNr) return x.blattNr - y.blattNr;
    return x.pos - y.pos;
  });
  return { alle: kand, ohneMedien, sieger: ohneMedien[ohneMedien.length - 1] || null };
}

const befunde = [];
const notiz = [];

/* ══ PRUEFPUNKT 1 · der Abruf-Knopf ist nicht gold ═════════════════ */
/* Nur der RUHEZUSTAND. :hover/:focus/:active tragen eine Pseudoklasse
   mehr und gewinnen deshalb immer - der erste Lauf dieses Pruefers hat
   genau das als "Sieger" gemeldet und damit die Frage nicht beantwortet,
   die gestellt war. */
const ruhend = (sel) => passtAufAbrufKnopf(sel) && !/:(hover|focus|active|focus-within)/.test(sel);
const gBg = gewinner('background', ruhend);
const sieger = gBg.sieger;
notiz.push(`Abruf-Knopf · background: ${gBg.ohneMedien.length} Regeln ohne @media, ${gBg.alle.length} insgesamt`);
if (!sieger) {
  befunde.push('Keine einzige background-Regel fuer #oab-run gefunden - der Pruefer misst sich selbst.');
} else {
  notiz.push(`   Sieger (${sieger.spez.join(',')})${eig(sieger.koerper, 'background').wichtig ? ' !' : '  '} ${sieger.sel}`);
  notiz.push(`   -> ${eig(sieger.koerper, 'background').wert.slice(0, 70)}   [${sieger.datei}:${sieger.zeile}]`);
  const w = eig(sieger.koerper, 'background').wert.toLowerCase();
  const istGold = /gold|c9a84c|e8cc7a|b8932f|d5bb73/.test(w);
  if (istGold) befunde.push(
    `Der Abruf-Knopf gewinnt mit einer GOLDENEN Flaeche: ${sieger.sel} -> ${w.slice(0, 60)}\n` +
    `    (${sieger.datei}:${sieger.zeile}). #oab-bar traegt selbst den Runway-Verlauf;\n` +
    `    gemessen war der Kontrast k=1,07. Siehe v2120.`);
}

/* ══ PRUEFPUNKT 2 · die Regeln aus v2119 stehen und tragen ID ══════ */
const band901 = alle.filter(r => r.medien.some(m => /min-width:\s*901px/.test(m.replace(/\s+/g, ' '))));
notiz.push(`Band @media (min-width:901px): ${band901.length} Regeln`);
const pflicht = [
  ['flex-wrap',  /\.dp-pfbar$/,                   'die Leiste darf umbrechen'],
  ['flex-wrap',  /\.dp-pfbar \.dp-pf-row$/,       'die Kachelreihe darf umbrechen'],
  ['flex',       /\.dp-pfbar \.dp-pf-tile$/,      'Kacheln schrumpfen nicht'],
  ['flex',       /\.dp-pfbar > \.dp-pf-qr$/,      'der QR schrumpft nicht'],
  ['flex',       /\.dp-pfbar > \.dp-pf-rz$/,      'der Stub schrumpft nicht'],
];
for (const [prop, re, was] of pflicht) {
  const t = band901.filter(r => re.test(r.sel.replace(/\s+/g, ' ')) && eig(r.koerper, prop));
  if (!t.length) befunde.push(`v2119 fehlt: keine Regel "${prop}" fuer ${re} im Band 901+ (${was}).`);
  else {
    const mitId = t.filter(r => r.spez[0] > 0);
    notiz.push(`   ${was}: ${t.length} Regel(n), davon ${mitId.length} mit ID-Spezifitaet`);
    if (!mitId.length) befunde.push(
      `v2119 ohne ID: "${prop}" fuer ${re} traegt keine ID-Spezifitaet (${t[0].datei}:${t[0].zeile}).\n` +
      `    In dieser Leiste stehen Gegenregeln mit :is(#oab-bar,...) - eine Regel ohne ID\n` +
      `    kann dort nie gewinnen. Genau daran ist v1989 gescheitert.`);
  }
}

/* ══ PRUEFPUNKT 3 · min-width:0 darf den Schutz nicht aushebeln ════ */
const nullBreite = band901.filter(r => {
  const e = eig(r.koerper, 'min-width');
  return e && /^0(px)?$/.test(e.wert) && /dp-pf-(tile|qr|rz)/.test(r.sel);
});
if (nullBreite.length) befunde.push(
  `${nullBreite.length} Regel(n) im Band 901+ setzen min-width:0 auf Kachel/QR/Stub und heben\n` +
  `    den Schutz aus v2119 wieder auf: ` +
  nullBreite.map(r => `${r.datei}:${r.zeile}`).join(', '));

/* ══ Deckung ══════════════════════════════════════════════════════ */
console.log('── datenaufnahme-leiste-pruefen · Deckung ──────────────────');
console.log(`   Blaetter aus index.html : ${blaetter.length}  (${blaetter.map(b => b.rel.split('/').pop()).join(', ')})`);
console.log(`   Zeichen gelesen        : ${zeichen.toLocaleString('de-DE')}`);
console.log(`   Regeln geparst         : ${alle.length.toLocaleString('de-DE')}`);
console.log(`   Pruefpunkte            : ${2 + pflicht.length + 1}`);
console.log('   NICHT abgedeckt        : Inline-Stile, per JS gesetzte Eigenschaften,');
console.log('                            @media-Baender ausser 901+, der echte Browser.');
console.log('── Befunde ─────────────────────────────────────────────────');
notiz.forEach(n => console.log('   ' + n));
console.log('');
if (!befunde.length) { console.log('   SAUBER - kein Befund.'); process.exit(0); }
befunde.forEach((b, i) => console.log(`   ${i + 1}) ${b}`));
console.log(`\n   ${befunde.length} Befund(e).`);
process.exit(1);
