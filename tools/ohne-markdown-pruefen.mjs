#!/usr/bin/env node
/* tools/ohne-markdown-pruefen.mjs — v4230 · keine ** in KI-Texten (Marcel 23.11.2026)
   Prüft die ECHTEN Dateien:
     A  backend/src/utils/ohneMarkdown.js   rein / tief / antwort (Feldblock bleibt wörtlich)
     B  frontend/js/ki-text.js              DpKiText.html (escapen, <b>, <ul>/<ol>) und .rein
     C  Verdrahtung: extractJson säubert, copilotChat säubert, Prompt verbietet Markdown,
        copilot.js und portfolio-pilot.js zeigen über DpKiText, index.html lädt ki-text.js
     G  Gegenprobe: der Erkenner findet ** in ungesäubertem Text (sonst wäre A/B wertlos)
   RC=0 sauber. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require(path.join(ROOT, 'backend/src/utils/ohneMarkdown.js'));
const ctx = { window: {}, globalThis: {} }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'frontend/js/ki-text.js'), 'utf8'), ctx);
const K = ctx.DpKiText;

let ok = 0, rot = 0;
const p = (name, bed) => { if (bed) ok++; else { rot++; console.log('  ROT  ' + name); } };
const hatMd = (s) => /\*\*|__[^_]+__|^\s*#{1,6}\s|```/m.test(String(s));

/* A */
p('A1 fett weg', M.rein('**Fazit:** solide Lage') === 'Fazit: solide Lage');
p('A2 fett kursiv weg', M.rein('***Achtung*** hoch') === 'Achtung hoch');
p('A3 Überschrift weg', M.rein('## Risiken\nZins') === 'Risiken\nZins');
p('A4 * -Liste zu -', M.rein('* eins\n* zwei') === '- eins\n- zwei');
p('A5 nummerierte Liste bleibt', M.rein('1. eins\n2. zwei') === '1. eins\n2. zwei');
p('A6 snake_case und 5 * 3 bleiben', M.rein('nkm_qm und 5 * 3') === 'nkm_qm und 5 * 3');
p('A7 Codezaun weg', !hatMd(M.rein('```json\n{"a":1}\n```')));
const t = M.tief({ a: ['**x**', { b: '### Kopf\n* Punkt **fett**' }], n: 3, z: null });
p('A8 tief säubert jeden String', t.a[0] === 'x' && t.a[1].b === 'Kopf\n- Punkt fett' && t.n === 3 && t.z === null);
const blk = '<<<FELDER\n{"nkm": "**620**"}\nFELDER>>>';
const an = M.antwort('**Gern.** Ich trage ein:\n' + blk + '\n**Fertig**');
p('A9 Feldblock bleibt wörtlich', an.indexOf(blk) >= 0 && an.startsWith('Gern. Ich') && an.endsWith('Fertig'));
p('A10 leere/Nicht-Strings unverändert', M.rein('') === '' && M.rein(null) === null && M.tief(5) === 5);

/* B */
const h1 = K.html('**Fazit:** gut\n1. eins\n2. **zwei**\n- a\n- b\n## Kopf\nText');
p('B1 <b> statt **', h1.indexOf('<b>Fazit:</b>') === 0 && h1.indexOf('**') < 0);
p('B2 echte <ol>', /<ol class="dp-ki-liste"><li>eins<\/li><li><b>zwei<\/b><\/li><\/ol>/.test(h1));
p('B3 echte <ul>', /<ul class="dp-ki-liste"><li>a<\/li><li>b<\/li><\/ul>/.test(h1));
p('B4 Überschrift fett ohne #', h1.indexOf('<b>Kopf</b>') >= 0 && h1.indexOf('#') < 0);
const h2 = K.html('<script>alert(1)</script> **x** "y"');
p('B5 escaped vor <b>', h2.indexOf('<script>') < 0 && h2.indexOf('&lt;script&gt;') >= 0 && h2.indexOf('<b>x</b>') >= 0 && h2.indexOf('&quot;y&quot;') >= 0);
p('B6 rein()', K.rein('**a** __b__ # c') === 'a b # c' && K.rein('# Kopf') === 'Kopf');
p('B7 Absätze', K.html('a\nb\n\nc') === 'a<br>b<br>c');

/* C */
const os = readFileSync(path.join(ROOT, 'backend/src/services/openaiService.js'), 'utf8');
p('C1 extractJson säubert', /function extractJson\(text\) \{ return ohneMd\.tief\(_extractJsonRoh\(text\)\); \}/.test(os));
p('C2 copilotChat säubert', /reply: ohneMd\.antwort\(/.test(os));
p('C3 Prompt verbietet Markdown', /Kein Markdown: keine Sternchen/.test(os));
const cp = readFileSync(path.join(ROOT, 'frontend/js/copilot.js'), 'utf8');
p('C4 copilot.js zeigt über DpKiText', /role === 'assistant' && window\.DpKiText\) \? window\.DpKiText\.html\(text\)/.test(cp));
const pp = readFileSync(path.join(ROOT, 'frontend/js/portfolio-pilot.js'), 'utf8');
p('C5 portfolio-pilot.js zeigt über DpKiText', /window\.DpKiText \? window\.DpKiText\.html\(text\)/.test(pp));
const ix = readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8');
p('C6 index.html lädt ki-text.js', /<script src="js\/ki-text\.js\?v=[a-z0-9]+"><\/script>/.test(ix));

/* G */
p('G1 Erkenner findet ** im Rohtext', hatMd('Das ist **wichtig**') && hatMd('## Kopf'));
p('G2 Erkenner bleibt still bei sauberem Text', !hatMd(M.rein('Das ist **wichtig**')) && !hatMd(K.rein('## Kopf')));

console.log(rot ? 'ohne-markdown-pruefen: ' + ok + ' gruen, ' + rot + ' rot' : 'SAUBER · ' + ok + ' Prüfpunkte grün');
process.exit(rot ? 1 : 0);
