/* Welche Zone traegt den Faktor? Alle Arbeitsblatt-Zonen kartieren und
   jede einmal anfahren. Die Zone, deren Kurzhinweis eine Zahl im
   Faktorbereich liefert, ist die gesuchte. */
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

const zonen = await seite.evaluate(() => {
  const aus = [];
  document.querySelectorAll('[class*="tab-zone"]').forEach((z) => {
    const r = z.getBoundingClientRect();
    if (r.width < 40 || r.height < 18) return;
    /* Nur Blattzonen: die mit gerenderten Kacheln, nicht die reinen
       Textzonen und nicht die Parametersteuerungen. */
    const istBlatt = !!z.querySelector('[class*="tab-tiledViewer"], canvas, img');
    const istParam = !!z.querySelector('[class*="ParameterControlBox"]');
    aus.push({ x: Math.round(r.x), y: Math.round(r.y), b: Math.round(r.width),
               h: Math.round(r.height), istBlatt, istParam,
               text: (z.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) });
  });
  return aus;
});
console.log('Zonen gesamt:', zonen.length);
const blatt = zonen.filter((z) => z.istBlatt && !z.istParam);
console.log('Blattzonen  :', blatt.length);
blatt.forEach((z, i) => console.log(`  [${i}] ${z.x},${z.y} ${z.b}x${z.h}  "${z.text}"`));

const treffer = [];
for (let i = 0; i < blatt.length; i++) {
  const z = blatt[i];
  const cx = z.x + Math.round(z.b / 2), cy = z.y + Math.round(z.h / 2);
  letzte = '';
  await seite.mouse.move(cx - 40, cy);
  await seite.waitForTimeout(220);
  await seite.mouse.move(cx, cy);
  await seite.waitForTimeout(1500);
  if (!letzte) continue;
  const zahlen = [...new Set((letzte.match(/[0-9]+,\d{1,4}/g) || []))];
  if (zahlen.length) {
    treffer.push({ zone: i, bei: `${cx},${cy}`, zahlen: zahlen.slice(0, 8) });
    fs.writeFileSync(`/arb/tooltip-zone-${i}.json`, letzte);
  }
}
console.log('\nZonen mit Zahl im Kurzhinweis:');
console.log(treffer.length ? JSON.stringify(treffer, null, 1) : '  (keine)');

await browser.close();
