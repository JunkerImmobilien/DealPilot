/* Der Faktor steht nur im Bild. Aber Tableau kennt einen Weg, der TEXT
   liefert: den Kurzhinweis (Tooltip). Er wird serverseitig gerendert und
   kommt als JSON zurueck - `render-tooltip-server`.

   Wenn das traegt, braucht der Ernter je Gitterpunkt einen Mausueberflug
   statt eines PDF-Abrufs. Das ist der Unterschied zwischen Minuten und
   Stunden. */
import fs from 'fs';
import * as T from './tableau.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';

const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);

const mit = [];
seite.on('response', async (r) => {
  if (!/tooltip|commands\//.test(r.url())) return;
  try { mit.push({ u: r.url().split('/').pop().split('?')[0], t: await r.text() }); } catch {}
});

const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);
const st = await T.steuerungen(seite);

/* Die Kachel mit dem Faktor finden: die Beschriftung "Sachwertfaktor:"
   steht als Textzone da, der Wert rechts daneben im Bild. Wir fahren
   also rechts NEBEN die Beschriftung. */
const ziel = await seite.evaluate(() => {
  const alle = [...document.querySelectorAll('span,div')].filter((e) => e.children.length === 0);
  const b = alle.find((e) => /Sachwertfaktor\s*:/.test((e.textContent || '').trim()));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: Math.round(r.right + 120), y: Math.round(r.y + r.height / 2),
           text: b.textContent.trim(), bx: Math.round(r.right) };
});
console.log('Beschriftung gefunden:', JSON.stringify(ziel));
if (!ziel) { await browser.close(); process.exit(1); }

mit.length = 0;
/* Langsam hinfahren - ein Sprung loest keinen Hinweis aus. */
await seite.mouse.move(ziel.x - 60, ziel.y);
await seite.waitForTimeout(400);
await seite.mouse.move(ziel.x, ziel.y);
await seite.waitForTimeout(3000);

console.log('\nAntworten:', mit.length);
let g = '';
for (const m of mit) { g += m.t; console.log('  ' + m.u + '  ' + m.t.length + ' Zeichen'); }
fs.writeFileSync('/arb/tooltip.json', g);

const zahlen = [...new Set((g.match(/\b[0-2],\d{2}\b/g) || []))];
console.log('deutsche Zahlen in der Antwort:', zahlen.slice(0, 10).join(' ') || '(keine)');
console.log('Wort "Sachwertfaktor":', /Sachwertfaktor/.test(g) ? 'JA' : 'nein');

/* Und was steht im DOM als Hinweis? */
const hinweis = await seite.evaluate(() => {
  const t = document.querySelector('.tab-tooltip, [class*="Tooltip"], [class*="tooltip"]');
  return t ? (t.innerText || '').trim().slice(0, 300) : null;
});
console.log('Hinweis im DOM:', hinweis ? JSON.stringify(hinweis) : '(keiner)');

await browser.close();
