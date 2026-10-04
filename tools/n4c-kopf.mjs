#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1852b · N4 · Eingabetiefe in den Reiterkopf, Übernahme am Verkehrswert
   ═══════════════════════════════════════════════════════════════════════
   Marcel: „die eingabetiefe muss auf jedenfall irgendwo nach oben sichtbar
   sein. nicht mitten im feld." Und: „Wenn wir einen Verkehrswert ermittelt
   haben sollten wir am feld verkehrswert auch ein button haben mit
   übernahme. wenn es mehrere marktberichte gibt dann zum auswählen."

   Wie n4-umbau-index.mjs: Anker genau einmal, keine Feld-ID ändert sich,
   Wächter, Doppellauf = skip (Marker oe-kopf).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
const PFAD = path.resolve('frontend/index.html');
let h = fs.readFileSync(PFAD, 'utf8');
if (h.includes('id="oe-kopf"')) { console.log('skip: oe-kopf ist schon drin.'); process.exit(0); }
function idZaehler(s) { const m = {}; for (const x of s.matchAll(/\sid="([^"]+)"/g)) m[x[1]] = (m[x[1]] || 0) + 1; return m; }
const idsVorher = idZaehler(h);
const divVorher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
function abbruch(m) { console.error('ABBRUCH: ' + m); process.exit(1); }
function einmal(n) { const i = h.indexOf(n); if (i < 0) abbruch('fehlt: ' + n.slice(0, 70)); if (h.indexOf(n, i + 1) >= 0) abbruch('mehrfach: ' + n.slice(0, 70)); return i; }
function divEnde(start) { const re = /<div\b|<\/div>/g; re.lastIndex = start + 1; let t = 1, m; while ((m = re.exec(h))) { t += m[0] === '</div>' ? -1 : 1; if (t === 0) return m.index + 6; } abbruch('div ohne Ende'); }
function cutDivAt(anker) { const s = einmal(anker); const e = divEnde(s); const html = h.slice(s, e); h = h.slice(0, s) + h.slice(e); return html; }
function replaceOnce(a, b) { einmal(a); h = h.replace(a, b); }

/* 1 · Eingabetiefe aus der Karte lösen und in den Reiterkopf setzen */
const ziel = cutDivAt('<div id="oe-ziel" class="oe-ziel"');
const hintA = '<p class="hint oe-ziel-hint" id="oe-ziel-hint"></p>';
replaceOnce(hintA, '');
replaceOnce('<h2 class="sec-title">Objekt &amp; Fotos</h2><p class="sec-desc">Grunddaten, Lage und Objektfotos für den Bankexport</p>',
  '<h2 class="sec-title">Objekt &amp; Fotos</h2><p class="sec-desc">Grunddaten, Lage und Objektfotos für den Bankexport</p>'
  + '<div id="oe-kopf" class="oe-kopf">' + ziel + hintA + '</div>');

/* 2 · Übernahme-Knopf am Verkehrswert (Platzhalter, gefüllt von objekt-reiter.js) */
{
  const i = einmal('<input id="svwert"');
  const j = h.indexOf('</div></div>', i);   /* Ende von .iw und .f */
  if (j < 0) abbruch('svwert: .f-Ende nicht gefunden');
  h = h.slice(0, j + 6) + '<div id="oe-vw" class="oe-vw" style="display:none"></div>' + h.slice(j + 6);
}

const idsNachher = idZaehler(h); const f = [];
for (const id of Object.keys(idsVorher)) if (idsVorher[id] !== (idsNachher[id] || 0)) f.push(id + ': ' + idsVorher[id] + ' → ' + (idsNachher[id] || 0));
const NEU = new Set(['oe-kopf', 'oe-vw']);
for (const id of Object.keys(idsNachher)) if (!(id in idsVorher) && !NEU.has(id)) f.push('unbekannte id ' + id);
const divNachher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
if (divNachher !== divVorher) f.push('div-Bilanz ' + divVorher + ' → ' + divNachher);
if (f.length) { console.error('WÄCHTER ROT:\n  ' + f.join('\n  ')); process.exit(1); }
fs.writeFileSync(PFAD, h, 'utf8');
console.log('GESCHRIEBEN · ids ' + Object.keys(idsVorher).length + ' → ' + Object.keys(idsNachher).length + ' · div-Bilanz ' + divNachher);
