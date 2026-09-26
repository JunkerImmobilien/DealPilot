/* Das Herunterladen-Menue bietet Bild, VEKTORBILD, PDF, PowerPoint -
   keinen Datenexport. Das Vektorbild ist die beste Wahl: es traegt den
   Text als TEXT, nicht als Pixel, und kennt die Ligaturfalle des PDF
   nicht ("Sachwer aktor" statt "Sachwertfaktor").

   Dieses Skript prueft: kommt der Faktor sauber heraus? */
import fs from 'fs';
import * as T from './tableau.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);
const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);

const st = await T.steuerungen(seite);
const brw = T.finde(st, /Bodenrichtwert/i);
const sw = T.finde(st, /Sachwert/i);
console.log('BRW-Steuerung:', brw && brw.i, ' Sachwert-Steuerung:', sw && sw.i);

/* Auf die Vorgabestellung, fuer die wir den Wert kennen: BRW 60,
   Sachwert 250.000 -> 1,03 (am 25.09. am PDF gemessen). */
await T.setzeZahl(seite, brw.i, 60);
await seite.waitForTimeout(1200);
await T.setzeZahl(seite, sw.i, 250000);
await seite.waitForTimeout(2500);

const t0 = Date.now();
const [download] = await Promise.all([
  seite.waitForEvent('download', { timeout: 60000 }),
  (async () => {
    await seite.locator('[data-tb-test-id="viz-viewer-toolbar-button-download"]').click();
    await seite.waitForSelector('[data-tb-test-id="download-flyout-download-svg-MenuItem"]', { timeout: 20000 });
    await seite.locator('[data-tb-test-id="download-flyout-download-svg-MenuItem"]').click();
  })(),
]);
const ziel = '/arb/probe.svg';
await download.saveAs(ziel);
const ms = Date.now() - t0;
const roh = fs.readFileSync(ziel, 'utf8');
console.log(`Vektorbild: ${roh.length} Zeichen in ${ms} ms`);

/* Alle Textstuecke herausziehen. */
const stuecke = [...roh.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
console.log('Textstuecke:', stuecke.length);

const i = stuecke.findIndex((s) => /Sachwertfaktor/i.test(s));
console.log('Beschriftung "Sachwertfaktor" gefunden:', i >= 0 ? `ja (Position ${i})` : 'NEIN');
if (i >= 0) console.log('   Umfeld:', JSON.stringify(stuecke.slice(Math.max(0, i - 2), i + 4)));

const kandidaten = [...new Set(stuecke.filter((s) => /^[0-2],\d{2}$/.test(s)))];
console.log('Faktor-Kandidaten:', kandidaten.join(' ') || '(keine)');
console.log('ERWARTET war 1,03 ->', kandidaten.includes('1,03') ? 'TREFFER' : 'nicht dabei');

fs.writeFileSync('/arb/probe-texte.json', JSON.stringify(stuecke, null, 1));
await browser.close();
