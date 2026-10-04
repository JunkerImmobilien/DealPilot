#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1852 · N4 · Zielstufe, Fehlliste, Anfragen — Nachtrag zum Umbau
   ═══════════════════════════════════════════════════════════════════════
   Marcel, 04.10.2026 nach dem Blick auf Staging: „wichtig ist dass wir
   wählen können wie detailreich die eingabe wird" — Stufe 1/2/3 steuert,
   was sichtbar ist. Dazu: Stufen-Knöpfe ausgrauen, solange Felder fehlen,
   und beim Klick die fehlenden Felder zeigen; der Unterlagen-Knopf nach
   oben zu den Abrufen; „Gutachten" heißt nicht mehr Gutachten.

   Wie tools/n4-umbau-index.mjs: Anker genau einmal, keine Feld-ID ändert
   sich, Wächter am Ende, Doppellauf = skip (Marker oe-ziel).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
const PFAD = path.resolve('frontend/index.html');
let h = fs.readFileSync(PFAD, 'utf8');
const NL = h.includes('\r\n') ? '\r\n' : '\n';
if (h.includes('id="oe-ziel"')) { console.log('skip: oe-ziel ist schon drin.'); process.exit(0); }
function idZaehler(s) { const m = {}; for (const x of s.matchAll(/\sid="([^"]+)"/g)) m[x[1]] = (m[x[1]] || 0) + 1; return m; }
const idsVorher = idZaehler(h);
const divVorher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
function abbruch(m) { console.error('ABBRUCH: ' + m); process.exit(1); }
function einmal(n) { const i = h.indexOf(n); if (i < 0) abbruch('fehlt: ' + n.slice(0, 70)); if (h.indexOf(n, i + 1) >= 0) abbruch('mehrfach: ' + n.slice(0, 70)); return i; }
function divEnde(start) { const re = /<div\b|<\/div>/g; re.lastIndex = start + 1; let t = 1, m; while ((m = re.exec(h))) { t += m[0] === '</div>' ? -1 : 1; if (t === 0) return m.index + 6; } abbruch('div ohne Ende'); }
function cutDivAt(anker) { const s = einmal(anker); const e = divEnde(s); const html = h.slice(s, e); h = h.slice(0, s) + h.slice(e); return html; }
function replaceOnce(a, b) { einmal(a); h = h.replace(a, b); }

/* 1 · Unterlagen-Knopf aus Ebene 2 herauslösen */
const unterlagen = cutDivAt('<div class="f s2" style="display:flex;align-items:flex-end">');
const knopf = (unterlagen.match(/<button[\s\S]*?<\/button>/) || [''])[0];
if (!knopf) abbruch('Unterlagen-Knopf nicht gefunden');

/* 2 · Zielstufe vor der Leiste, Fehlliste und Anfragen nach den Stufen-Knöpfen */
replaceOnce('<div class="f s2" id="oe-auto-wrap"><div id="oe-auto" class="oe-auto"></div><div id="oe-stufen" class="oe-stufen"></div></div>',
  '<div class="f s2" id="oe-auto-wrap">'
  + '<div id="oe-ziel" class="oe-ziel" role="group" aria-label="Eingabetiefe"><span class="oe-ziel-lbl">Eingabetiefe</span>'
  + '<button type="button" class="oe-ziel-btn" data-oe-ziel="1">Stufe 1 · Marktpreis</button>'
  + '<button type="button" class="oe-ziel-btn" data-oe-ziel="2">Stufe 2 · erweitert</button>'
  + '<button type="button" class="oe-ziel-btn" data-oe-ziel="3">Stufe 3 · Sach- &amp; Ertragswert</button></div>'
  + '<p class="hint oe-ziel-hint" id="oe-ziel-hint"></p>'
  + '<div id="oe-auto" class="oe-auto"></div>'
  + '<div id="oe-stufen" class="oe-stufen"></div>'
  + '<div id="oe-fehlt" class="oe-fehlt" style="display:none"></div>'
  + '<div id="oe-anfragen" class="oe-anfragen"><span class="oe-anfragen-lbl">Anfragen</span>' + knopf.replace('class="btn btn-ghost"', 'class="oe-btn"') + '</div>'
  + '</div>');

/* 3 · Ebene 3 heißt nicht mehr Gutachten */
replaceOnce('data-collapse-title="Für das Gutachten · Stufe 3"', 'data-collapse-title="Sach- und Ertragswert · Stufe 3" data-oe-stufe-min="3"');
replaceOnce('</span>Für das Gutachten · Stufe 3 (Sach- und Ertragswert)</div>', '</span>Sach- und Ertragswert · Stufe 3</div>');
replaceOnce('Nur für die Wertermittlung nach ImmoWertV (Stufe 3). Die Marktpreisindikation braucht nichts davon.',
  'Nur wenn Sach- und Ertragswert gerechnet werden sollen (Stufe 3, Wertermittlung nach ImmoWertV). Stufe 1 und 2 brauchen nichts davon — die Eingabetiefe oben blendet diesen Block ein.');
replaceOnce('<div class="card" id="oe-details">', '<div class="card" id="oe-details" data-oe-stufe-min="1">');

/* Wächter */
const idsNachher = idZaehler(h); const f = [];
for (const id of Object.keys(idsVorher)) if (idsVorher[id] !== (idsNachher[id] || 0)) f.push(id + ': ' + idsVorher[id] + ' → ' + (idsNachher[id] || 0));
const NEU = new Set(['oe-ziel', 'oe-ziel-hint', 'oe-fehlt', 'oe-anfragen']);
for (const id of Object.keys(idsNachher)) if (!(id in idsVorher) && !NEU.has(id)) f.push('unbekannte id ' + id);
const divNachher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
if (divNachher !== divVorher) f.push('div-Bilanz ' + divVorher + ' → ' + divNachher);
if (!h.includes('DealPilotUnterlagen.oeffnen()')) f.push('Unterlagen-Aufruf verloren');
if (f.length) { console.error('WÄCHTER ROT:\n  ' + f.join('\n  ')); process.exit(1); }
fs.writeFileSync(PFAD, h, 'utf8');
console.log('GESCHRIEBEN · ids ' + Object.keys(idsVorher).length + ' → ' + Object.keys(idsNachher).length + ' · div-Bilanz ' + divNachher + ' · ' + (NL === '\r\n' ? 'CRLF' : 'LF'));
