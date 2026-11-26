#!/usr/bin/env node
/* faq-schema.mjs · landing-kern-1 — schreibt das FAQPage-JSON-LD in frontend/landing/fragen.html
   aus den sichtbaren <details class="fq"><summary>Frage</summary><div class="ant">Antwort</div></details>.
   Suchmaschinen verlangen, dass das Schema genau den sichtbaren Text wiedergibt - deshalb erzeugt,
   nie von Hand. Nach jeder Textänderung in fragen.html laufen lassen.
   landing-seo-2 · auch die Rechner-Seiten (immobilien-rendite-berechnen, cashflow-immobilie-berechnen,
   kaufpreisfaktor-berechnen) tragen <details class="fq"> - sie werden mitgeschrieben, sofern vorhanden.
   landing-seo-6 (22.11.2026) · dazu immobilien-investment-rechner und renditeobjekt-pruefen.
   Aufruf: node tools/faq-schema.mjs   (RC 0 · 1 wenn eine Seite keine Fragen hat) */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LANDING = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend/landing');
const SEITEN = ['fragen.html', 'immobilien-rendite-berechnen.html', 'cashflow-immobilie-berechnen.html', 'kaufpreisfaktor-berechnen.html',
  'immobilien-investment-rechner.html', 'renditeobjekt-pruefen.html',
  'immobilienbewertung-immowertv.html', 'immobilien-ankauf-checkliste.html']
  .filter((s, i) => i === 0 || fs.existsSync(join(LANDING, s)));
const ent = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&thinsp;/g, ' ').replace(/&shy;/g, '').replace(/&[a-z]+;/g, ' ');
const text = (h) => ent(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<(br|\/p|\/li)\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').trim();
let rc = 0;
for (const SEITE of SEITEN) {
  const DATEI = join(LANDING, SEITE);
  let t = fs.readFileSync(DATEI, 'utf8');
  const fragen = [];
  const re = /<details class="fq"[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="ant">([\s\S]*?)<\/div>\s*<\/details>/g;
  let m;
  while ((m = re.exec(t))) fragen.push({ '@type': 'Question', name: text(m[1]),
    acceptedAnswer: { '@type': 'Answer', text: text(m[2]) } });
  if (!fragen.length) { console.error(SEITE + ': keine Fragen gefunden'); rc = 1; continue; }
  const block = '<!-- faq-schema:anfang · erzeugt von tools/faq-schema.mjs, nicht von Hand ändern -->\n'
    + '<script type="application/ld+json">\n'
    + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: fragen })
      .replace(/</g, '\\u003c') + '\n</script>\n<!-- faq-schema:ende -->';
  if (/<!-- faq-schema:anfang[\s\S]*?faq-schema:ende -->/.test(t)) t = t.replace(/<!-- faq-schema:anfang[\s\S]*?faq-schema:ende -->/, () => block);
  else t = t.replace('</head>', () => block + '\n</head>');
  fs.writeFileSync(DATEI, t);
  console.log('FAQPage: ' + fragen.length + ' Fragen nach ' + SEITE + ' geschrieben');
}
process.exit(rc);
