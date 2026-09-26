/* Wo genau steht der Faktor? Die Zeile abtasten, statt eine Stelle zu
   raten - und die Antwort wirklich ansehen. */
import fs from 'fs';
import * as T from './tableau.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);

let letzte = '';
seite.on('response', async (r) => {
  if (!/render-tooltip-server/.test(r.url())) return;
  try { letzte = await r.text(); } catch {}
});

const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);

const anker = await seite.evaluate(() => {
  const alle = [...document.querySelectorAll('span,div')].filter((e) => e.children.length === 0);
  const b = alle.find((e) => /Sachwertfaktor\s*:/.test((e.textContent || '').trim()));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  /* Die KACHEL, in der der Wert gerendert wird - sie ist der Vorfahr mit
     tab-tiledViewer oder tab-zone. Ihre Breite sagt, wie weit rechts der
     Wert stehen kann. */
  const kachel = b.closest('[class*="tab-zone"]');
  const kr = kachel ? kachel.getBoundingClientRect() : null;
  return { x: Math.round(r.right), y: Math.round(r.y + r.height / 2),
           zoneRechts: kr ? Math.round(kr.right) : null,
           zoneOben: kr ? Math.round(kr.y) : null,
           zoneHoehe: kr ? Math.round(kr.height) : null };
});
console.log('Anker:', JSON.stringify(anker));
if (!anker) { await browser.close(); process.exit(1); }

const bis = anker.zoneRechts || (anker.x + 500);
const treffer = [];
for (let x = anker.x + 20; x <= bis - 10; x += 45) {
  letzte = '';
  await seite.mouse.move(x - 30, anker.y);
  await seite.waitForTimeout(250);
  await seite.mouse.move(x, anker.y);
  await seite.waitForTimeout(1600);
  if (!letzte) continue;
  const z = [...new Set((letzte.match(/[0-2],\d{2}/g) || []))];
  const w = /Sachwertfaktor/.test(letzte);
  if (z.length || w) treffer.push({ x, zahlen: z.slice(0, 5), wort: w, laenge: letzte.length });
  if (z.length) { fs.writeFileSync('/arb/tooltip-treffer.json', letzte); break; }
}
console.log('Treffer:', JSON.stringify(treffer, null, 1));

if (!treffer.length) {
  console.log('\nKein Hinweis mit Zahl. Letzte Antwort (Anfang):');
  console.log(letzte.slice(0, 500).replace(/\s+/g, ' '));
}
await browser.close();
