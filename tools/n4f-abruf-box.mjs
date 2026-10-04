#!/usr/bin/env node
/* v1857 · N4 · Die Abruf-Kacheln wandern als Kästchen unter die Anfragen
   (rechte Karte „Automatisch ermittelt") — Marcel: „seitlich packen unter
   Anfrage … ein neues Kästchen machen". Anker genau einmal, keine Feld-ID
   ändert sich, Wächter, Doppellauf = skip (Marker oe-abruf-box). */
import fs from 'node:fs';
import path from 'node:path';
const PFAD = path.resolve('frontend/index.html');
let h = fs.readFileSync(PFAD, 'utf8');
const NL = h.includes('\r\n') ? '\r\n' : '\n';
if (h.includes('id="oe-abruf-box"')) { console.log('skip: oe-abruf-box ist schon drin.'); process.exit(0); }
function idZaehler(s) { const m = {}; for (const x of s.matchAll(/\sid="([^"]+)"/g)) m[x[1]] = (m[x[1]] || 0) + 1; return m; }
const idsVorher = idZaehler(h);
const divVorher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
function abbruch(m) { console.error('ABBRUCH: ' + m); process.exit(1); }
function einmal(n) { const i = h.indexOf(n); if (i < 0) abbruch('fehlt: ' + n.slice(0, 70)); if (h.indexOf(n, i + 1) >= 0) abbruch('mehrfach: ' + n.slice(0, 70)); return i; }
function divEnde(start) { const re = /<div\b|<\/div>/g; re.lastIndex = start + 1; let t = 1, m; while ((m = re.exec(h))) { t += m[0] === '</div>' ? -1 : 1; if (t === 0) return m.index + 6; } abbruch('div ohne Ende'); }
function cutDivAt(anker) { const s = einmal(anker); const e = divEnde(s); const html = h.slice(s, e); h = h.slice(0, s) + h.slice(e); return html; }

/* 1 · Karte unten herausschneiden, Innenleben behalten */
const karte = cutDivAt('<div class="card" id="oe-abruf-karte">');
h = h.replace(/<!-- ═══ v1855 · N4 · Marktbericht abrufen[^\n]*\n?/, '');
const stufen = (karte.match(/<div id="oe-stufen"[\s\S]*?<\/div>/) || [])[0];
const fehlt = (karte.match(/<div id="oe-fehlt"[\s\S]*?<\/div>/) || [])[0];
const knopf = (karte.match(/<button type="button" class="oe-btn" id="oe-mb-oeffnen">[\s\S]*?<\/button>/) || [])[0];
if (!stufen || !fehlt || !knopf) abbruch('Innenleben der Abruf-Karte nicht gefunden');

/* 2 · Als Kästchen hinter den Anfragen-Block in der rechten Karte */
const anf = einmal('<div id="oe-anfragen" class="oe-anfragen">');
const anfEnde = divEnde(anf);
const box = NL + '        <div id="oe-abruf-box" class="oe-abruf-box"><div class="card-title">Marktbericht abrufen <span class="oe-ct-hint">die gewählte Eingabetiefe ist vorgemerkt</span></div>'
  + stufen + fehlt
  + '<div class="oe-abruf-foot"><span>Jeder Abruf landet im Verlauf und steht am Verkehrswert zur Übernahme.</span>' + knopf + '</div></div>';
h = h.slice(0, anfEnde) + box + h.slice(anfEnde);

const idsNachher = idZaehler(h); const f = [];
const WEG = new Set(['oe-abruf-karte']);
for (const id of Object.keys(idsVorher)) if (!WEG.has(id) && idsVorher[id] !== (idsNachher[id] || 0)) f.push(id + ': ' + idsVorher[id] + ' → ' + (idsNachher[id] || 0));
if (idsNachher['oe-abruf-karte']) f.push('oe-abruf-karte sollte weg sein');
for (const id of Object.keys(idsNachher)) if (!(id in idsVorher) && id !== 'oe-abruf-box') f.push('unbekannte id ' + id);
const divNachher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
if (divNachher !== divVorher) f.push('div-Bilanz ' + divVorher + ' → ' + divNachher);
if (f.length) { console.error('WÄCHTER ROT:\n  ' + f.join('\n  ')); process.exit(1); }
fs.writeFileSync(PFAD, h, 'utf8');
console.log('GESCHRIEBEN · ids ' + Object.keys(idsVorher).length + ' → ' + Object.keys(idsNachher).length + ' · div-Bilanz ' + divNachher);
