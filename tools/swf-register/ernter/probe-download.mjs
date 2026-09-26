/* Kurzhinweise sind abgeschaltet, der Faktor steht nur im Bild.
   Bleibt das Herunterladen-Menue. Was bietet es an?

   "Gekreuzte Tabelle" oder "Daten" waeren TEXT - dann braucht der Ernter
   je Gitterpunkt einen kleinen Abruf statt eines PDF. */
import * as T from './tableau.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);
const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);

/* Der Knopf traegt eine Testkennung - die ist stabiler als eine Klasse. */
const knopf = seite.locator('[data-tb-test-id="viz-viewer-toolbar-button-download"]');
const da = await knopf.count();
console.log('Herunterladen-Knopf gefunden:', da);
if (!da) {
  const kn = await seite.evaluate(() =>
    [...document.querySelectorAll('[data-tb-test-id]')]
      .map((e) => e.getAttribute('data-tb-test-id')).filter((t) => /toolbar|download/i.test(t)));
  console.log('vorhandene Knoepfe:', kn.join(' '));
  await browser.close(); process.exit(1);
}

await knopf.click();
await seite.waitForTimeout(1500);

const auswahl = await seite.evaluate(() => {
  const aus = [];
  document.querySelectorAll('[role="menuitem"], [class*="MenuItem"], [class*="menuItem"], li, button')
    .forEach((e) => {
      if (e.offsetParent === null) return;
      const t = (e.innerText || '').trim();
      if (t && t.length < 40) aus.push({ t, id: e.getAttribute('data-tb-test-id') || '' });
    });
  return aus;
});
console.log('\nMenuepunkte:');
[...new Map(auswahl.map((a) => [a.t, a])).values()].slice(0, 20)
  .forEach((a) => console.log(`   "${a.t}"   ${a.id}`));

await browser.close();
