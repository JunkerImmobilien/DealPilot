// node setze.mjs <kurz> < ersatz (idx|text) : ersetzt Zeilen, gibt die texte-Indizes (j) aus
import fs from 'node:fs';
const k = process.argv[2]; const f = k + '/zeilen.txt';
const z = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(l => l.includes('|'));
const neu = fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(l => l.includes('|'));
const js = [];
for (const n of neu) { const id = n.slice(0, n.indexOf('|')); const j = z.findIndex(l => l.slice(0, l.indexOf('|')) === id); if (j < 0) throw new Error('fehlt ' + id); z[j] = n; js.push(j); }
fs.writeFileSync(f, z.join('\n') + '\n'); console.log(js.join(','));
