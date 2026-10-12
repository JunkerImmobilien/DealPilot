/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/deckkraft-klickbarkeit-pruefen.mjs · v2110a

   DIE REGEL: wo `opacity` gesetzt wird, gehoert `pointer-events` daneben.

   WARUM ES DEN PRUEFER GIBT: `v2110` hat `pointer-events:none` an die
   Grundregel von `.sbc-actions` gehaengt, damit ein unsichtbarer Knopf
   nicht die Klicks auf dem Score-Ring abfaengt. Richtig gedacht - aber
   es gibt vier weitere Regeln auf denselben Selektor, darunter

     @media (max-width:900px) aside.sidebar .sb-card .sbc-actions
       { opacity: 1 !important }

   Auf Touch gibt es kein Hover, deshalb stehen die Knoepfe dort IMMER
   sichtbar. GEMESSEN bei 390 px nach v2110: opacity 1,
   pointer-events none - Duplizieren und Loeschen waren SICHTBAR UND TOT.

   > Eine Haelfte eines Paares zu aendern ist schlimmer, als beide zu
   > lassen: der sichtbare Zustand sagt dann etwas anderes als der
   > bedienbare.

   Geprueft werden die Klassen, bei denen Sichtbarkeit und Bedienbarkeit
   dasselbe bedeuten MUESSEN. RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';

let fehler = 0, geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

/* Welche Klassen? Die, die ein- und ausgeblendet werden UND bedient
   werden. Eine reine Zierflaeche braucht die Paarung nicht. */
const KLASSEN = ['sbc-actions'];

const DATEIEN = ['frontend/css/style.css', 'frontend/css/layout-varianten.css',
                 'frontend/css/ui-varianten.css'];

/* Kommentare ausblenden, Laenge erhalten - sonst findet der Pruefer die
   Begruendungen, die er selbst hineingeschrieben hat. */
const nutz = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

console.log('=== Regeln, die Deckkraft setzen, ohne die Klickbarkeit mitzunehmen ===');
let gesamt = 0;
for (const klasse of KLASSEN) {
  for (const datei of DATEIEN) {
    let roh;
    try { roh = fs.readFileSync(datei, 'utf8'); } catch (e) { continue; }
    const s = nutz(roh);
    /* Jeden Regelblock einzeln ansehen: Selektor { ... } ohne `}` darin.
       Der Suchausdruck muss am BLOCKENDE halten, sonst liest er in die
       naechste Regel hinein (dieselbe Falle wie beim Vorlagen-Pruefer). */
    const re = /([^{}]*\.KLASSE\b[^{}]*)\{([^{}]*)\}/g.source.replace('KLASSE', klasse);
    const rx = new RegExp(re, 'g');
    let m;
    while ((m = rx.exec(s)) !== null) {
      const sel = m[1].replace(/\s+/g, ' ').trim();
      const body = m[2];
      const op = body.match(/(^|[\s;])opacity\s*:\s*([0-9.]+)/);
      if (!op) continue;                       /* setzt keine Deckkraft */
      const pe = /(^|[\s;])pointer-events\s*:/.test(body);
      const zeile = s.slice(0, m.index).split('\n').length;
      gesamt++;
      if (!pe) {
        console.log('    ' + datei + ':' + zeile);
        console.log('      ' + sel.slice(0, 92));
        console.log('      opacity:' + op[2] + '  —  pointer-events FEHLT');
      }
      melde(pe, datei.split('/').pop() + ':' + zeile + '  opacity:' + op[2]
        + ' hat pointer-events daneben');
    }
  }
}

console.log('\n=== Deckung ===');
console.log('  Klassen        : ' + KLASSEN.join(', '));
console.log('  Blaetter       : ' + DATEIEN.length);
console.log('  Regeln mit opacity gefunden: ' + gesamt);
if (gesamt === 0) {
  console.log('');
  console.log('  KEINE Regel gefunden - das ist KEIN gruenes Ergebnis, sondern');
  console.log('  ein Hinweis, dass der Suchausdruck nicht mehr trifft.');
  process.exit(1);
}

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, jede Deckkraft hat ihre Klickbarkeit'
  : 'RC=1 - ' + fehler + ' von ' + geprueft + ' Regeln setzen opacity ohne pointer-events'));
process.exit(fehler === 0 ? 0 : 1);
