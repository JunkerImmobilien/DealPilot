/* Sucht "Kerosin" und "Liter" nur dort, wo es ANZEIGETEXT ist.
   Mein erster Zaehler hat Funktionsnamen und IDs mitgezaehlt
   (_kerosinStripHtml, pm-kerosin-strip) - das sieht niemand. */
import fs from 'fs';
import { execSync } from 'child_process';

const dateien = execSync('git ls-files', { encoding: 'utf8' }).split('\n')
  .filter(f => /\.(js|html)$/.test(f))
  .filter(f => !/node_modules|entwurf|alt-original|patchesold|^design\//i.test(f));

/* Ein Treffer gilt als Anzeigetext, wenn das Wort in einem String steht
   und NICHT Teil eines Bezeichners ist. Bezeichner erkennt man daran,
   dass direkt davor/danach ein Wortzeichen, _ oder - steht. */
const WORT = /(^|[^A-Za-z0-9_\-])([Kk]erosin|Liter)([^A-Za-z0-9_\-]|$)/;

const ergebnis = [];
for (const f of dateien) {
  let s; try { s = fs.readFileSync(f, 'latin1'); } catch (e) { continue; }
  if (!/kerosin|liter/i.test(s)) continue;
  /* Kommentare raus */
  const ohne = s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
                .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
                .replace(/^([ \t]*)\/\/.*$/gm, (m, a) => a);
  const zeilen = ohne.split('\n');
  const funde = [];
  zeilen.forEach((z, i) => {
    if (!WORT.test(z)) return;
    /* Bezeichner-Zeilen aussortieren: function _kerosinX, id="pm-kerosin-strip",
       var kerosin_10, getElementById('...kerosin...') */
    const nurBezeichner = /function\s+_?\w*[Kk]erosin|[Kk]erosin\w*\s*[:=]\s*function|['"][\w\-]*kerosin[\w\-]*['"]|kerosin_\d+/.test(z)
      && !/>[^<]*[Kk]erosin|[Kk]erosin[^<]*</.test(z);
    if (nurBezeichner) return;
    funde.push({ zeile: i + 1, text: z.trim().slice(0, 110) });
  });
  if (funde.length) ergebnis.push({ datei: f, anzahl: funde.length, funde: funde });
}

ergebnis.sort((a, b) => b.anzahl - a.anzahl);
let summe = 0;
for (const e of ergebnis) {
  summe += e.anzahl;
  console.log('\n' + e.datei + '  (' + e.anzahl + ')');
  e.funde.slice(0, 4).forEach(f => console.log('   Z.' + f.zeile + ': ' + f.text));
  if (e.funde.length > 4) console.log('   ... und ' + (e.funde.length - 4) + ' weitere');
}
console.log('\n=== ' + ergebnis.length + ' Dateien, ' + summe + ' Stellen Anzeigetext ===');
console.log('(zum Vergleich: der grobe Zaehler meldete 77 in 24 Dateien -');
console.log(' er hat Funktionsnamen und IDs mitgezaehlt)');
