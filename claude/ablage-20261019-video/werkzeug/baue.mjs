// node baue.mjs <kurz> : liest <kurz>/zeilen.txt (idx|text, idx=i fuer Intro) + ab.txt + DUR aus log -> texte.json, Budgetpruefung
import fs from 'node:fs';
const k = process.argv[2];
const st = fs.readFileSync(k + '/ab.txt', 'utf8').trim().split(/\s+/).map(Number);
const log = fs.existsSync(k + '.log') ? fs.readFileSync(k + '.log', 'utf8') : fs.readFileSync(k + '/dur.txt', 'utf8');
const dur = Number(/DUR ([\d.]+)/.exec(log)[1]);
const z = fs.readFileSync(k + '/zeilen.txt', 'utf8').split(/\r?\n/).filter(l => l.includes('|')).map(l => { const p = l.indexOf('|'); return { idx: l.slice(0, p).trim(), text: l.slice(p + 1).trim() }; });
const beg = x => x === 'i' ? 0.3 : st[Number(x)];
const out = z.map((e, j) => {
  const ab = +(beg(e.idx) + 0.3).toFixed(2);
  const bis = +(j + 1 < z.length ? beg(z[j + 1].idx) : dur - 0.4).toFixed(2);
  return { ab, bis, text: e.text };
});
let warn = 0;
out.forEach((o, j) => { const w = o.text.length, b = (o.bis - o.ab - 0.4) * 10.5; if (w > b) { warn++; console.log('ZU LANG', j, z[j].idx, w, 'Zeichen, Budget', b.toFixed(1)); } });
fs.writeFileSync(k + '/texte.json', '[\n' + out.map(o => '  ' + JSON.stringify(o)).join(',\n') + '\n]\n');
console.log(k, out.length, 'Abschnitte, Warnungen', warn);
