#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1854 · N4 · Die weiteren Objektdetails werden eigene Karten
   ═══════════════════════════════════════════════════════════════════════
   Marcel, 04.10.2026: „weitere Objektdetails, Bauteile und Grundstück,
   Lage und Einschätzung, das können wir ja auch in so einzelne Karten
   machen … je nachdem, ob man die braucht, dann mit auswählt. Natürlich
   muss immer alles drauf sein, was wir für den Dealscore 2 brauchen."

   Also: drei Karten statt eines Akkordeons.
     · „Gewerke & Ausstattung"   zuschaltbar (data-oe-detail)
     · „Bauteile & Grundstück"   zuschaltbar (data-oe-detail)
     · „Lage & Einschätzung"     IMMER — die Lage-Felder gehen in den
                                 Investor Deal Score (DS2); Wertanker dazu.
   Der Haken „weitere Objektdetails angeben" sitzt in der Kopf-Leiste; die
   Eingabetiefe Mittel/Ausgiebig setzt ihn von selbst (objekt-reiter.js).
   Das alte Akkordeon (obj-extra-toggle/-wrap) fällt — object-actions.js
   prüft `if (tg && wrap)` und läuft ohne beide weiter (gemessen Z. 2066).

   Wie die Vorgänger: Anker genau einmal, keine FELD-ID ändert sich,
   Wächter, Doppellauf = skip (Marker oe-karte-gewerke).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
const PFAD = path.resolve('frontend/index.html');
let h = fs.readFileSync(PFAD, 'utf8');
const NL = h.includes('\r\n') ? '\r\n' : '\n';
if (h.includes('id="oe-karte-gewerke"')) { console.log('skip: oe-karte-gewerke ist schon drin.'); process.exit(0); }
function idZaehler(s) { const m = {}; for (const x of s.matchAll(/\sid="([^"]+)"/g)) m[x[1]] = (m[x[1]] || 0) + 1; return m; }
const idsVorher = idZaehler(h);
const divVorher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
function abbruch(m) { console.error('ABBRUCH: ' + m); process.exit(1); }
function einmal(n, from = 0) { const i = h.indexOf(n, from); if (i < 0) abbruch('fehlt: ' + n.slice(0, 70)); if (h.indexOf(n, i + 1) >= 0) abbruch('mehrfach: ' + n.slice(0, 70)); return i; }
function divEnde(start) { const re = /<div\b|<\/div>/g; re.lastIndex = start + 1; let t = 1, m; while ((m = re.exec(h))) { t += m[0] === '</div>' ? -1 : 1; if (t === 0) return m.index + 6; } abbruch('div ohne Ende'); }
function replaceOnce(a, b) { einmal(a); h = h.replace(a, b); }

/* 1 · Die ganze Karte oe-details herausschneiden und in Segmente teilen */
const cs = einmal('<div class="card" id="oe-details"');
const ce = divEnde(cs);
const karte = h.slice(cs, ce);
h = h.slice(0, cs) + '@@OE-KARTEN@@' + h.slice(ce);
const ws = karte.indexOf('<div id="obj-extra-wrap" class="obj-extra-wrap">');
const weMarker = '</div><!-- /obj-extra-wrap -->';
const we = karte.indexOf(weMarker);
if (ws < 0 || we < 0) abbruch('obj-extra-wrap in der Karte nicht gefunden');
const innen = karte.slice(ws + '<div id="obj-extra-wrap" class="obj-extra-wrap">'.length, we);
const tG = innen.indexOf('<div class="card-title">Gewerke');
const tB = innen.indexOf('<div class="card-title">Bauteile');
const tL = innen.indexOf('<div class="card-title">Lage');
const tW = innen.indexOf('<div class="card-title">Wertanker');
if ([tG, tB, tL, tW].some((i) => i < 0) || !(tG < tB && tB < tL && tL < tW)) abbruch('Segmentgrenzen nicht in Reihenfolge');
const ohneTitel = (seg) => seg.replace(/^\s*<div class="card-title">[^<]*(<span[^>]*>[^<]*<\/span>)?<\/div>/, '');
const segG = ohneTitel(innen.slice(tG, tB));
const segB = ohneTitel(innen.slice(tB, tL));
const segL = ohneTitel(innen.slice(tL, tW));
const segW = innen.slice(tW);   /* behält seinen Untertitel „Wertanker" */

const ct = (ico, titel, hint) => '<div class="ct ct-pro"><span class="ct-ico"><svg width="14" height="14"><use href="#' + ico + '"/></svg></span>' + titel + (hint ? ' <span class="oe-ct-hint">' + hint + '</span>' : '') + '</div>';
const karten = [
  '<!-- ═══ v1854 · N4 · drei Karten statt eines Akkordeons (tools/n4d-karten.mjs) ═══ -->',
  '<div class="card oe-karte" id="oe-karte-gewerke" data-oe-detail="1">' + ct('i-home', 'Gewerke &amp; Ausstattung', 'Art · modernisiert · Standardstufe — die Stufe wird vorgeschlagen'),
  segG.trim(),
  '</div>',
  '<div class="card oe-karte" id="oe-karte-bauteile" data-oe-detail="1">' + ct('i-land', 'Bauteile &amp; Grundstück', 'verfeinert den Marktbericht'),
  '  <div class="g3">' + segB.trim().replace(/^<div class="g3">/, '').replace(/<\/div>\s*$/, '') + '</div>',
  '</div>',
  '<div class="card oe-karte" id="oe-karte-lage">' + ct('i-pin', 'Lage &amp; Einschätzung', 'geht in den Investor Deal Score — immer sichtbar') ,
  segL.trim(),
  segW.trim(),
  '</div>'
].join(NL);
h = h.replace('@@OE-KARTEN@@', karten);

/* 2 · Haken in der Kopf-Leiste, Knöpfe heißen Einfach / Mittel / Ausgiebig */
replaceOnce('<button type="button" class="oe-ziel-btn" data-oe-ziel="1">Stufe 1 · Marktpreis</button>',
  '<button type="button" class="oe-ziel-btn" data-oe-ziel="1"><b>Einfach</b><small>Marktpreisindikation · Stufe 1</small></button>');
replaceOnce('<button type="button" class="oe-ziel-btn" data-oe-ziel="2">Stufe 2 · erweitert</button>',
  '<button type="button" class="oe-ziel-btn" data-oe-ziel="2"><b>Mittel</b><small>erweiterte Indikation · Stufe 2</small></button>');
replaceOnce('<button type="button" class="oe-ziel-btn" data-oe-ziel="3">Stufe 3 · Sach- &amp; Ertragswert</button>',
  '<button type="button" class="oe-ziel-btn" data-oe-ziel="3"><b>Ausgiebig</b><small>Sach- &amp; Ertragswert · Stufe 3</small></button>');
replaceOnce('<p class="hint oe-ziel-hint" id="oe-ziel-hint"></p>',
  '<label class="oe-kopf-cb"><input type="checkbox" id="oe-details-cb"> weitere Objektdetails angeben</label><p class="hint oe-ziel-hint" id="oe-ziel-hint"></p>');

/* Wächter */
const idsNachher = idZaehler(h); const f = [];
const WEG = new Set(['oe-details', 'obj-extra-toggle', 'obj-extra-wrap']);
for (const id of Object.keys(idsVorher)) if (!WEG.has(id) && idsVorher[id] !== (idsNachher[id] || 0)) f.push(id + ': ' + idsVorher[id] + ' → ' + (idsNachher[id] || 0));
for (const id of WEG) if (idsNachher[id]) f.push(id + ' sollte weg sein');
const NEU = new Set(['oe-karte-gewerke', 'oe-karte-bauteile', 'oe-karte-lage', 'oe-details-cb']);
for (const id of Object.keys(idsNachher)) if (!(id in idsVorher) && !NEU.has(id)) f.push('unbekannte id ' + id);
const divNachher = (h.match(/<div\b/g) || []).length - (h.match(/<\/div>/g) || []).length;
if (divNachher !== divVorher) f.push('div-Bilanz ' + divVorher + ' → ' + divNachher);
for (const must of ['id="oe-gewerke"', 'id="eq_bath"', 'id="erbpacht_body"', 'id="ki-lage-box"', 'id="bankval"', 'id="oe-vw"']) if (!h.includes(must)) f.push(must + ' verloren');
if (f.length) { console.error('WÄCHTER ROT:\n  ' + f.join('\n  ')); process.exit(1); }
fs.writeFileSync(PFAD, h, 'utf8');
console.log('GESCHRIEBEN · ids ' + Object.keys(idsVorher).length + ' → ' + Object.keys(idsNachher).length + ' (−3 Akkordeon, +4) · div-Bilanz ' + divNachher);
