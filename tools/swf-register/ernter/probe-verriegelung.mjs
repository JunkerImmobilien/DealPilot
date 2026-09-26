/* Die Verriegelung lehnt ab - aber WAS lehnt sie ab? Erst den Befund,
   dann die Massnahme. Laengere Wartezeiten haben kaum geholfen (13 auf
   11 Loecher), also ist Zeit nicht die Ursache. */
import fs from 'fs';
import * as T from './tableau.mjs';
import { faktorAus, zustandAus } from './svg-lesen.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);
const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);
const st = await T.steuerungen(seite);
const brw = T.finde(st, /Bodenrichtwert/i);
const sw = T.finde(st, /Sachwert/i);
const lage = st.find((s) => s.art === 'auswahl');

async function bild(tag) {
  const [dl] = await Promise.all([
    seite.waitForEvent('download', { timeout: 45000 }),
    (async () => {
      await seite.keyboard.press('Escape');
      await seite.waitForTimeout(200);
      await seite.locator('[data-tb-test-id="viz-viewer-toolbar-button-download"]').click();
      await seite.waitForSelector('[data-tb-test-id="download-flyout-download-svg-MenuItem"]', { timeout: 20000 });
      await seite.locator('[data-tb-test-id="download-flyout-download-svg-MenuItem"]').click();
    })(),
  ]);
  const p = `/arb/v-${tag}.svg`;
  await dl.saveAs(p);
  return fs.readFileSync(p, 'utf8');
}

/* Genau die Punkte nachstellen, die Loecher hatten. */
const faelle = [
  { lage: 0, brw: 15, sach: 60000 },
  { lage: 0, brw: 120, sach: 230000 },
  { lage: 3, brw: 65, sach: 570000 },
];
for (const [n, f] of faelle.entries()) {
  await T.setzeAuswahl(seite, lage.i, f.lage);
  await seite.waitForTimeout(3000);
  await T.setzeZahl(seite, brw.i, f.brw);
  await seite.waitForTimeout(1500);
  await T.setzeZahl(seite, sw.i, f.sach);
  await seite.waitForTimeout(2000);
  console.log(`\n=== gewollt: Lage[${f.lage}] BRW ${f.brw} SW ${f.sach}`);
  for (let i = 1; i <= 3; i++) {
    const b = await bild(`${n}-${i}`);
    const z = zustandAus(b);
    const r = faktorAus(b);
    console.log(`  Abruf ${i}: gezeigt BRW=${z.brw} SW=${z.sachwert} Lage="${z.lage}"`
      + `  Faktor=${r.faktor ?? '(' + r.faktor_grund + ')'}`);
    await seite.waitForTimeout(1200);
  }
}
await browser.close();
