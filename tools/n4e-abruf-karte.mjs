#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1855 · N4 · Abruf-Karte unten, Quellen im Anfragen-Block
   ═══════════════════════════════════════════════════════════════════════
   Marcel: „Marktbericht abrufen, das könnten wir dann unten runtersetzen,
   diese drei Berichte … auch einfach den Absprung … direkt im Marktbericht"
   und „für die Sachwertfaktoren und Liegenschaftszinsen … auch dort diese
   Unterlagenanfrage … dann geben wir dann auch die Quelle an".

   Wie die Vorgänger: Anker genau einmal, keine Feld-ID ändert sich,
   Wächter, Doppellauf = skip (Marker oe-abruf-karte).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
const PFAD = path.resolve('frontend/index.html');
let h = fs.readFileSync(PFAD, 'utf8');
const NL = h.includes('\r\n') ? '\r\n' : '\n';
if (h.includes('id="oe-abruf-karte"')) { console.log('skip: oe-abruf-karte ist schon drin.'); process.exit(0); }
function idZaehler(s) { const m = {}; for (const x of s.matchAll(/\sid="([^"]+)"/g)) m[x[1]] = (m[x[1]] || 0) + 1; return m; }
const idsVorher = idZaehler(h);
const divVorher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
function abbruch(m) { console.error('ABBRUCH: ' + m); process.exit(1); }
function einmal(n) { const i = h.indexOf(n); if (i < 0) abbruch('fehlt: ' + n.slice(0, 70)); if (h.indexOf(n, i + 1) >= 0) abbruch('mehrfach: ' + n.slice(0, 70)); return i; }
function divEnde(start) { const re = /<div\b|<\/div>/g; re.lastIndex = start + 1; let t = 1, m; while ((m = re.exec(h))) { t += m[0] === '</div>' ? -1 : 1; if (t === 0) return m.index + 6; } abbruch('div ohne Ende'); }
function cutDivAt(anker) { const s = einmal(anker); const e = divEnde(s); const html = h.slice(s, e); h = h.slice(0, s) + h.slice(e); return html; }
function replaceOnce(a, b) { einmal(a); h = h.replace(a, b); }

/* 1 · Stufen und Fehlliste aus der Leiste lösen */
cutDivAt('<div id="oe-stufen" class="oe-stufen">');
cutDivAt('<div id="oe-fehlt" class="oe-fehlt"');

/* 2 · Anfragen-Block: Kopfzeile + Quellenliste */
const anf = cutDivAt('<div id="oe-anfragen" class="oe-anfragen">');
const innen = anf.replace(/^<div id="oe-anfragen" class="oe-anfragen">/, '').replace(/<\/div>$/, '');
replaceOnce('<div class="f" data-v363-ausst style="display:none">',
  '<div id="oe-anfragen" class="oe-anfragen"><div class="oe-anfragen-kopf">' + innen + '<span class="oe-q" id="oe-anfragen-hint"></span></div><div id="oe-quellen" class="oe-quellen"></div></div>'
  + NL + '        <div class="f" data-v363-ausst style="display:none">');

/* 3 · Abruf-Karte vor dem Reiter-Fuß */
/* Der Reiter-Fuß kommt in jedem Reiter vor — der von s0 ist der, dessen
   Knopf _v235GoToNextTab('s0') ruft; davor liegt genau ein Fuß-Div. */
const s0Fuss = (() => { const k = einmal("_v235GoToNextTab('s0')"); const i = h.lastIndexOf('<div class="v235-tab-nav-footer">', k); if (i < 0) abbruch('Fuß von s0 nicht gefunden'); return i; })();
h = h.slice(0, s0Fuss) + '@@OE-ABRUF@@' + h.slice(s0Fuss + '<div class="v235-tab-nav-footer">'.length);
replaceOnce('@@OE-ABRUF@@',
  '<!-- ═══ v1855 · N4 · Marktbericht abrufen — drei Stufen als Kacheln, Absprung in den Marktbericht (tools/n4e-abruf-karte.mjs) ═══ -->' + NL
  + '  <div class="card" id="oe-abruf-karte"><div class="ct ct-pro"><span class="ct-ico"><svg width="14" height="14"><use href="#i-calculator"/></svg></span>Marktbericht abrufen <span class="oe-ct-hint">drei Stufen — die gewählte Eingabetiefe ist vorgemerkt</span></div>' + NL
  + '    <div id="oe-stufen" class="oe-abruf"></div>' + NL
  + '    <div id="oe-fehlt" class="oe-fehlt" style="display:none"></div>' + NL
  + '    <div class="oe-abruf-foot"><span>Jeder Abruf landet im Verlauf dieses Objekts — und steht oben am Verkehrswert zur Übernahme.</span><button type="button" class="oe-btn" id="oe-mb-oeffnen">Im Marktbericht öffnen →</button></div>' + NL
  + '  </div>' + NL
  + '  <div class="v235-tab-nav-footer">');

const idsNachher = idZaehler(h); const f = [];
for (const id of Object.keys(idsVorher)) if (idsVorher[id] !== (idsNachher[id] || 0)) f.push(id + ': ' + idsVorher[id] + ' → ' + (idsNachher[id] || 0));
const NEU = new Set(['oe-abruf-karte', 'oe-quellen', 'oe-anfragen-hint', 'oe-mb-oeffnen']);
for (const id of Object.keys(idsNachher)) if (!(id in idsVorher) && !NEU.has(id)) f.push('unbekannte id ' + id);
const divNachher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
if (divNachher !== divVorher) f.push('div-Bilanz ' + divVorher + ' → ' + divNachher);
if (!h.includes('DealPilotUnterlagen.oeffnen()')) f.push('Unterlagen-Aufruf verloren');
if (f.length) { console.error('WÄCHTER ROT:\n  ' + f.join('\n  ')); process.exit(1); }
fs.writeFileSync(PFAD, h, 'utf8');
console.log('GESCHRIEBEN · ids ' + Object.keys(idsVorher).length + ' → ' + Object.keys(idsNachher).length + ' · div-Bilanz ' + divNachher);
