import fs from 'fs';

/* ══ v2142 · ZWEI KARTEN, EIN PRUEFER ══════════════════════════════════
 *
 * Marcel am 12.10.2026: „kann man diese prozesskarte auch noch weiter
 * ausfuehren mit netzplan? … und auch steuer etc. jaehrliche IST
 * eintragungen. kannst du auch noch darstellen wie die score sich
 * zusammensetzen und wie sie dann individualisiert werden koennen."
 *
 * Daraus wurde `prozesskarte-detail.html` mit drei Tafeln. Sie wird von
 * DIESEM Pruefer mitgeprueft und bekommt keinen eigenen:
 *
 *   > Zwei Pruefer fuer zwei Karten laufen auseinander, sobald einer
 *   > angefasst wird - und dann prueft einer von beiden gegen einen
 *   > Stand, den es nicht mehr gibt.
 *
 * Geprueft wird an der Detailkarte zusaetzlich, dass ihr erster
 * <style>-Block WOERTLICH der der Hauptkarte ist. Laufen sie
 * auseinander, stehen am Stand zwei Gestaltungen nebeneinander. */
const roh = fs.readFileSync('design/Messe/prozesskarte.html', 'utf8');
const DETAIL = 'design/Messe/prozesskarte-detail.html';
const rohD = fs.existsSync(DETAIL) ? fs.readFileSync(DETAIL, 'utf8') : null;
/* Der Pruefer darf sein EIGENES Zitat nicht finden: die Begruendung,
   warum 'Kerosin' nicht vorkommt, steht im Kommentar der Datei.
   Und HTML-Entities aufloesen, sonst findet er 'Lage & Zustand' nicht,
   weil dort 'Lage &amp; Zustand' steht. (Memory:
   pruefer-findet-eigenes-zitat) */
const s = roh.replace(/<!--[\s\S]*?-->/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
let fehler = 0;

/* 1 · Tag-Bilanz — beide Karten */
const TAGS = ['div', 'section', 'article', 'header', 'p', 'ul', 'li', 'span',
  'style', 'html', 'body', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h4'];
function tagBilanz(rohText, name) {
  /* Auf dem KOMMENTARFREIEN Text zaehlen. Der Kopf der Detailkarte nennt
     das style-Tag im Fliesstext ihrer Begruendung, und das zaehlte als
     zwei zusaetzliche Oeffnungen. Die Bilanz der Kommentare selbst
     steht unten getrennt — sie braucht den rohen Text. */
  const text = rohText.replace(/<!--[\s\S]*?-->/g, '');
  let schief = 0;
  for (const t of TAGS) {
    const auf = (text.match(new RegExp('<' + t + '[ >]', 'g')) || []).length;
    const zu = (text.match(new RegExp('</' + t + '>', 'g')) || []).length;
    if (auf !== zu) { schief++; console.log('  ' + name + ' UNBALANCIERT ' + t + ': ' + auf + ' auf, ' + zu + ' zu'); }
  }
  console.log('  ' + name.padEnd(9) + (schief ? schief + ' unbalanciert' : 'alle ' + TAGS.length + ' gleich'));
  return schief;
}
console.log('=== Tag-Bilanz ===');
const strukt = roh;
fehler += tagBilanz(roh, 'Haupt');
if (rohD) fehler += tagBilanz(rohD, 'Detail');
else { fehler++; console.log('  Detail: DATEI FEHLT (' + DETAIL + ')'); }
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

/* ══ 7 · DIE DETAILKARTE (v2142) ══════════════════════════════════════ */
if (rohD) {
  const sD = rohD.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

  console.log('\n=== Detailkarte · Gestaltung aus EINER Quelle ===');
  /* ⚠ ERST die Kommentare weg, DANN nach <style> suchen.
     Der Kopf der Detailkarte ERKLAERT, dass ihr erster Block der der
     Hauptkarte ist — und schreibt dabei das Wort style in spitzen
     Klammern hin. Auf dem rohen Text begann der erste Treffer deshalb
     mitten im Kommentar, und der Vergleich schlug fehl, obwohl die
     Bloecke gleich waren.

     > Fuenfter Fall derselben Falle: ein Pruefer, der auf dem rohen
     > Text sucht, findet die Erklaerung statt der Sache.
     (Memory: pruefer-findet-eigenes-zitat) */
  const ohneKomm = (t) => t.replace(/<!--[\s\S]*?-->/g, '');
  const cssHaupt = (ohneKomm(roh).match(/<style>[\s\S]*?<\/style>/) || [])[0] || '';
  const bloeckeD = ohneKomm(rohD).match(/<style>[\s\S]*?<\/style>/g) || [];
  const gleich = bloeckeD.length > 0 && bloeckeD[0] === cssHaupt;
  console.log('  erster <style>-Block woertlich wie die Hauptkarte: ' + (gleich ? 'ja' : 'NEIN'));
  if (!gleich) {
    fehler++;
    console.log('  FEHL die Gestaltung ist auseinandergelaufen — am Stand haengen');
    console.log('       dann zwei verschiedene Blaetter. Nachziehen, nicht abschreiben.');
  }
  console.log('  <style>-Bloecke in der Detailkarte: ' + bloeckeD.length + ' (Haupt + Ergaenzung)');

  /* Klammertiefe je Block getrennt. Paare zu zaehlen findet einen
     zitierten Kommentar-Schluss nie — nur die TIEFE verfolgt es.
     (Memory: css-klammertiefe-statt-bilanz)

     Und diese Zeile stand hier eben selbst falsch: ich hatte die
     Zeichenfolge, um die es geht, WOERTLICH in den Kommentar gesetzt
     und damit die Datei zerlegt — beim Erklaeren genau in die Falle
     getappt, die der Satz beschreibt. Deshalb steht sie jetzt in
     Worten. */
  bloeckeD.forEach(function (b, i) {
    const ohne = b.replace(/\/\*[\s\S]*?\*\//g, '');
    let tiefe = 0, min = 0;
    for (const c of ohne) {
      if (c === '{') tiefe++;
      if (c === '}') { tiefe--; if (tiefe < min) min = tiefe; }
    }
    const ok = tiefe === 0 && min === 0;
    console.log('  Block ' + (i + 1) + ': Endtiefe ' + tiefe + ', tiefste ' + min + (ok ? '  ok' : '  FEHLER'));
    if (!ok) fehler++;
  });

  console.log('\n=== Detailkarte · abgeschaffte Begriffe ===');
  for (const b of ['Kerosin', 'Liter', 'TOP', 'STARK']) {
    const n = (sD.match(new RegExp(b, 'g')) || []).length;
    if (n) { fehler++; console.log('  ' + b + ': ' + n + '  <-- DARF NICHT'); }
    else console.log('  ' + b + ': 0');
  }
  if (/\bUG\b/.test(sD)) { fehler++; console.log('  UG: genannt  <-- DARF NICHT'); }
  else console.log('  UG: 0');

  console.log('\n=== Detailkarte · die Score-Gewichte gegen dealscore.js ===');
  const ds = fs.readFileSync('frontend/js/dealscore.js', 'utf8');
  const defBlock = (ds.match(/var DEFAULT_WEIGHTS = \{([\s\S]*?)\};/) || [])[1] || '';
  const gew = {};
  for (const m of defBlock.matchAll(/(\w+):\s*(\d+)/g)) gew[m[1]] = m[2];
  const SOLL = { cashflow: '30', rendite: '25', ltv: '15', risiko: '15', potenzial: '15' };
  Object.keys(SOLL).forEach(function (k) {
    const ok = gew[k] === SOLL[k];
    console.log('  ' + k.padEnd(10) + 'Code ' + (gew[k] || '?') + ' %, Karte ' + SOLL[k] + ' %' + (ok ? '  ok' : '  FEHL'));
    if (!ok) fehler++;
    /* Steht die Zahl auch wirklich auf der Karte? */
    if (!sD.includes(SOLL[k] + ' %')) { fehler++; console.log('       Karte nennt ' + SOLL[k] + ' % NICHT'); }
  });
  /* Die Balkenbreiten muessen die Gewichte sein - eine Grafik, die
     anders zeigt als sie sagt, ist schlimmer als keine. */
  Object.keys(SOLL).forEach(function (k) {
    if (!rohD.includes('width:' + SOLL[k] + '%')) {
      fehler++;
      console.log('  FEHL kein Balken mit width:' + SOLL[k] + '% fuer ' + k);
    }
  });

  console.log('\n=== Detailkarte · DS2-Kategorien gegen dealscore2.js ===');
  const d2 = fs.readFileSync('frontend/js/dealscore2.js', 'utf8');
  const wBlock = (d2.match(/weights:\s*\{([\s\S]*?)\}/) || [])[1] || '';
  const g2 = {};
  for (const m of wBlock.matchAll(/(\w+):\s*(\d+)/g)) g2[m[1]] = m[2];
  const SOLL2 = { rendite: '35', finanzierung: '25', risiko: '20', lage: '10', upside: '10' };
  Object.keys(SOLL2).forEach(function (k) {
    const ok = g2[k] === SOLL2[k];
    console.log('  ' + k.padEnd(13) + 'Code ' + (g2[k] || '?') + ' %, Karte ' + SOLL2[k] + ' %' + (ok ? '  ok' : '  FEHL'));
    if (!ok) fehler++;
  });

  console.log('\n=== Detailkarte · Lageklassen gegen lage-profil.js ===');
  const lp = fs.readFileSync('frontend/js/lage-profil.js', 'utf8');
  const vor = (lp.match(/var VORGABE = \{([^}]+)\}/) || [])[1] || '';
  const paare = {};
  for (const m of vor.matchAll(/([ABC]):\s*([\d.]+)/g)) paare[m[1]] = m[2];
  const erwartet = { A: '3,5', B: '5,0', C: '7,0' };
  Object.keys(erwartet).forEach(function (k) {
    const code = paare[k];
    const alsText = code != null ? Number(code).toFixed(1).replace('.', ',') : '?';
    const ok = alsText === erwartet[k] && sD.includes(erwartet[k]);
    console.log('  Klasse ' + k + ': Code ' + code + ' -> "' + alsText + '", auf der Karte: '
      + (sD.includes(erwartet[k]) ? 'ja' : 'NEIN') + (ok ? '  ok' : '  FEHL'));
    if (!ok) fehler++;
  });

  console.log('\n=== Detailkarte · Pflichtfeldzahlen und Etappen ===');
  [['6 Pflichtfelder', n1 === 6], ['13 Pflichtfelder', true], ['bis 20 Pflichtfelder', true]]
    .forEach(function (p) {
      const da = sD.includes(p[0]);
      console.log('  "' + p[0] + '": ' + (da ? 'auf der Karte' : 'FEHLT'));
      if (!da) fehler++;
    });
  /* Jede Etappe, die die Karte nennt, muss es in den Konstanten geben */
  const genannt = [...sD.matchAll(/<span class="nr">E(\d)<\/span>\s*([^<]+)</g)]
    .map(function (m) { return { nr: +m[1], name: m[2].trim() }; });
  console.log('  Etappen auf der Karte: ' + genannt.length);
  genannt.forEach(function (e) {
    const q = etappen.find(function (x) { return x.nr === e.nr; });
    const ok = q && q.name === e.name;
    console.log('    E' + e.nr + ' "' + e.name + '"' + (ok ? '  ok' : '  FEHL — Konstanten sagen "'
      + (q ? q.name : 'gibt es nicht') + '"'));
    if (!ok) fehler++;
  });
  /* Etappe 6 steht absichtlich NICHT im Netz - der Kommentar sagt das,
     und der Pruefer haelt es fest, damit es nicht versehentlich
     dazukommt. */
  const e6 = genannt.some(function (e) { return e.nr === 6; });
  console.log('  E6 absichtlich nicht im Netz: ' + (e6 ? 'DOCH DA — Begruendung pruefen' : 'ja'));
  if (e6) fehler++;

  console.log('\n=== Detailkarte · die drei Tafeln sind da ===');
  [['Tafel A', 'Netzplan Boarding'], ['Tafel B', 'Das Steuerjahr im Bestand'],
   ['Tafel C', 'Woraus die Scores bestehen']].forEach(function (t) {
    const da = sD.includes(t[0]) && sD.includes(t[1]);
    console.log('  ' + t[0] + ' "' + t[1] + '": ' + (da ? 'ja' : 'FEHLT'));
    if (!da) fehler++;
  });
}

console.log('\n' + (fehler === 0
  ? 'RC=0 — beide Karten stimmen mit den Quellen'
  : 'RC=1 — ' + fehler + ' Abweichung(en)'));
process.exit(fehler === 0 ? 0 : 1);
