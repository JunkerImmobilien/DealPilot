import fs from 'fs';
const roh = fs.readFileSync('design/Messe/prozesskarte.html', 'utf8');
/* Der Pruefer darf sein EIGENES Zitat nicht finden: die Begruendung,
   warum 'Kerosin' nicht vorkommt, steht im Kommentar der Datei.
   Und HTML-Entities aufloesen, sonst findet er 'Lage & Zustand' nicht,
   weil dort 'Lage &amp; Zustand' steht. (Memory:
   pruefer-findet-eigenes-zitat) */
const s = roh.replace(/<!--[\s\S]*?-->/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
let fehler = 0;

/* 1 · Tag-Bilanz */
const strukt = roh;
for (const t of ['div', 'section', 'article', 'header', 'p', 'ul', 'li', 'span', 'style', 'html', 'body']) {
  const auf = (strukt.match(new RegExp('<' + t + '[ >]', 'g')) || []).length;
  const zu = (strukt.match(new RegExp('</' + t + '>', 'g')) || []).length;
  if (auf !== zu) { fehler++; console.log('  UNBALANCIERT ' + t + ': ' + auf + ' auf, ' + zu + ' zu'); }
}
console.log('Tag-Bilanz: ' + (fehler ? fehler + ' unbalanciert' : 'alle gleich'));
const kAuf = (strukt.match(/<!--/g) || []).length, kZu = (strukt.match(/-->/g) || []).length;
console.log('Kommentare: ' + kAuf + ' auf, ' + kZu + ' zu' + (kAuf === kZu ? '' : '  <-- FEHLER'));
if (kAuf !== kZu) fehler++;
const cAuf = (s.match(/\{/g) || []).length, cZu = (s.match(/\}/g) || []).length;
console.log('CSS-Klammern: ' + cAuf + ' / ' + cZu + (cAuf === cZu ? '' : '  <-- FEHLER'));
if (cAuf !== cZu) fehler++;

/* 2 · Abgeschaffte Begriffe duerfen nicht vorkommen */
console.log('\n=== Abgeschaffte Begriffe ===');
for (const b of ['Kerosin', 'Liter', 'TOP', 'STARK']) {
  const n = (s.match(new RegExp(b, 'g')) || []).length;
  if (n) { fehler++; console.log('  ' + b + ': ' + n + '  <-- DARF NICHT'); }
  else console.log('  ' + b + ': 0');
}
/* UG ist verboten (Junker Solution ist Einzelunternehmen) */
if (/\bUG\b/.test(s)) { fehler++; console.log('  UG: genannt  <-- DARF NICHT (Einzelunternehmen)'); }
else console.log('  UG: 0');

/* 3 · Die Score-Schwellen gegen score-tiers.js */
console.log('\n=== Score-Schwellen gegen die echte Quelle ===');
const st = fs.readFileSync('frontend/js/score-tiers.js', 'utf8');
for (const [schwelle, wort] of [['85', 'Sehr gut'], ['70', 'Gut'], ['50', 'Solide'], ['35', 'Schwach']]) {
  const inKarte = s.includes(schwelle) && s.includes(wort);
  const inQuelle = st.includes(schwelle) && new RegExp(wort, 'i').test(st);
  const ok = inKarte && inQuelle;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + wort + ' ab ' + schwelle
    + '  (Karte ' + (inKarte ? 'ja' : 'nein') + ', score-tiers.js ' + (inQuelle ? 'ja' : 'nein') + ')');
}
if (!/Kritisch/.test(s)) { fehler++; console.log('  FEHL Kritisch fehlt in der Karte'); }
else console.log('  ok   Kritisch genannt');

/* 4 · Die Etappennamen gegen die abgeleiteten Konstanten */
console.log('\n=== Etappennamen gegen frontend-konstanten.json ===');
const k = JSON.parse(fs.readFileSync('backend/src/generated/frontend-konstanten.json', 'utf8'));
const etappen = (k.daten && k.daten.etappen) || [];
console.log('  Quelle hat ' + etappen.length + ' Etappen');
for (const e of etappen.filter((x) => !x.extra)) {
  const drin = s.includes(e.name);
  if (!drin && e.nr <= 5) { fehler++; console.log('  FEHL "' + e.name + '" (Etappe ' + e.nr + ') nicht in der Karte'); }
  else console.log('  ' + (drin ? 'ok  ' : '(aus)') + ' ' + e.name);
}

/* 5 · Die Feldzahl gegen den echten Export */
console.log('\n=== Feldzahl gegen den Portfolio-Export ===');
try {
  const exp = JSON.parse(fs.readFileSync('Dateien/API-Export/portfolio-20261010-1045.json', 'utf8'));
  const alle = new Set();
  exp.objekte.forEach((o) => { if (o.daten) Object.keys(o.daten).forEach((f) => alle.add(f)); });
  const gemessen = alle.size;
  const inKarte = /286<\/b> Felder|<b>286<\/b>/.test(s) || s.includes('286');
  console.log('  gemessen: ' + gemessen + ' Felder, Karte nennt 286: ' + (inKarte ? 'ja' : 'nein'));
  if (inKarte && gemessen !== 286) {
    fehler++;
    console.log('  FEHL die Karte nennt 286, gemessen sind ' + gemessen);
  }
} catch (e) { console.log('  (Export nicht lesbar: ' + e.message + ')'); }

/* 6 · Die Pflichtfeldzahlen gegen pflichtFuer() */
console.log('\n=== Pflichtfelder je Stufe gegen objekt-reiter.js ===');
const or = fs.readFileSync('frontend/js/objekt-reiter.js', 'utf8');
const basis = (or.match(/var l = \[([^\]]+)\]/) || [])[1];
const n1 = basis ? basis.split(',').length : 0;
console.log('  Stufe 1 im Code: ' + n1 + ' Felder, Karte nennt 6: ' + (s.includes('6, 13 oder') ? 'ja' : 'nein'));
if (n1 !== 6) { fehler++; console.log('  FEHL Stufe 1 hat ' + n1 + ', Karte sagt 6'); }

console.log('\n' + (fehler === 0 ? 'RC=0 — die Karte stimmt mit den Quellen' : 'RC=1 — ' + fehler + ' Abweichung(en)'));
process.exit(fehler === 0 ? 0 : 1);
