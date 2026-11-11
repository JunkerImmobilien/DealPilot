#!/usr/bin/env node
/* faq-schema.mjs · landing-kern-1 — schreibt das FAQPage-JSON-LD in frontend/landing/fragen.html
   aus den sichtbaren <details class="fq"><summary>Frage</summary><div class="ant">Antwort</div></details>.
   Suchmaschinen verlangen, dass das Schema genau den sichtbaren Text wiedergibt - deshalb erzeugt,
   nie von Hand. Nach jeder Textänderung in fragen.html laufen lassen.
   Aufruf: node tools/faq-schema.mjs   (RC 0 · 1 wenn keine Fragen gefunden) */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DATEI = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend/landing/fragen.html');
let t = fs.readFileSync(DATEI, 'utf8');
const ent = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&thinsp;/g, ' ').replace(/&shy;/g, '').replace(/&[a-z]+;/g, ' ');
const text = (h) => ent(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<(br|\/p|\/li)\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').trim();
const fragen = [];
const re = /<details class="fq"[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="ant">([\s\S]*?)<\/div>\s*<\/details>/g;
let m;
while ((m = re.exec(t))) fragen.push({ '@type': 'Question', name: text(m[1]),
  acceptedAnswer: { '@type': 'Answer', text: text(m[2]) } });
if (!fragen.length) { console.error('keine Fragen gefunden'); process.exit(1); }
const block = '<!-- faq-schema:anfang · erzeugt von tools/faq-schema.mjs, nicht von Hand ändern -->\n'
  + '<script type="application/ld+json">\n'
  + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: fragen })
    .replace(/</g, '\\u003c') + '\n</script>\n<!-- faq-schema:ende -->';
if (/<!-- faq-schema:anfang[\s\S]*?faq-schema:ende -->/.test(t)) t = t.replace(/<!-- faq-schema:anfang[\s\S]*?faq-schema:ende -->/, () => block);
else t = t.replace('</head>', () => block + '\n</head>');
fs.writeFileSync(DATEI, t);
console.log('FAQPage: ' + fragen.length + ' Fragen nach fragen.html geschrieben');
