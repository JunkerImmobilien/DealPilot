/* Liest der Leser WIRKLICH den Faktor - oder zufaellig eine
   Achsenbeschriftung, die gerade gleich aussieht?

   Der Pruefmaszstab: der Wert muss sich mit der Eingabe aendern, und er
   muss bei der Vorgabestellung 1,03 sein (am 25.09. am amtlichen PDF
   gemessen). Eine Zahl, die bei jeder Eingabe gleich bleibt, ist keine
   Messung, sondern ein Fundstueck. */
import fs from 'fs';
import * as T from './tableau.mjs';
import { faktorAus } from './svg-lesen.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);
const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);

const st = await T.steuerungen(seite);
const brw = T.finde(st, /Bodenrichtwert/i);
const sw = T.finde(st, /Sachwert/i);
const lage = st.find((s) => s.art === 'auswahl');
console.log(`Steuerungen: BRW=[${brw.i}] Sachwert=[${sw.i}] Lage=[${lage ? lage.i : '-'}]`);

async function hole(tag) {
  const [dl] = await Promise.all([
    seite.waitForEvent('download', { timeout: 60000 }),
    (async () => {
      await seite.locator('[data-tb-test-id="viz-viewer-toolbar-button-download"]').click();
      await seite.waitForSelector('[data-tb-test-id="download-flyout-download-svg-MenuItem"]', { timeout: 20000 });
      await seite.locator('[data-tb-test-id="download-flyout-download-svg-MenuItem"]').click();
    })(),
  ]);
  const p = `/arb/k-${tag}.svg`;
  await dl.saveAs(p);
  return faktorAus(fs.readFileSync(p, 'utf8'));
}

const faelle = [
  { brw: 60,  sach: 250000, erwartet: 1.03 },
  { brw: 120, sach: 250000, erwartet: null },
  { brw: 60,  sach: 450000, erwartet: null },
  { brw: 20,  sach: 100000, erwartet: null },
];

const gemessen = [];
for (const [n, f] of faelle.entries()) {
  await T.setzeZahl(seite, brw.i, f.brw);
  await seite.waitForTimeout(900);
  await T.setzeZahl(seite, sw.i, f.sach);
  await seite.waitForTimeout(2200);
  const t0 = Date.now();
  const r = await hole(n);
  gemessen.push({ ...f, ...r, ms: Date.now() - t0 });
  console.log(`  BRW ${String(f.brw).padStart(4)}  SW ${String(f.sach).padStart(7)}  ->  `
    + `Faktor ${r.faktor ?? '(null: ' + r.faktor_grund + ')'}  `
    + `Streuung ${r.streuung ?? '-'}  (${Date.now() - t0} ms)`);
}

console.log('\n── Urteil ──');
const eins = gemessen[0];
console.log('Vorgabestellung ergibt 1,03 :',
  eins.faktor === 1.03 ? 'JA' : `NEIN (${eins.faktor}) - der Leser liest das Falsche`);
const werte = gemessen.map((g) => g.faktor).filter((v) => v != null);
console.log('Werte aendern sich          :',
  new Set(werte).size > 1 ? `JA (${[...new Set(werte)].join(' ')})` : 'NEIN - das waere ein Fundstueck, keine Messung');
console.log('Mittlere Dauer je Punkt     :',
  Math.round(gemessen.reduce((a, g) => a + g.ms, 0) / gemessen.length) + ' ms');

await browser.close();
