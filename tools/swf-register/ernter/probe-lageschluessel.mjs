/* DIE FRAGE VOR DEM BAU: koennen wir eine Anschrift ueberhaupt einer
   Lagegruppe zuordnen?

   Im Register steht fuer Rostock und die Region Hannover ausdruecklich,
   dass das NICHT geht - "welcher Bereich gilt, ist eine Frage des
   ORTSTEILS, und die Anschrift eines Objekts sagt uns das nicht". Bei
   einer Spannweite von 2,68 gegen 1,77 ist eine geratene Lage teurer als
   gar kein Wert.

   Waere es hier genauso, brauchte niemand die Ernte: sie erzeugte Zahlen,
   die wir nicht verwenden duerfen. Das Dashboard hat einen Knopf
   "Lage einblenden" - der koennte den Schluessel zeigen. */
import fs from 'fs';
import * as T from './tableau.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);
const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);

/* Alle anklickbaren Beschriftungen zeigen - vielleicht gibt es mehr als
   "Lage einblenden". */
const knoepfe = await seite.evaluate(() =>
  [...document.querySelectorAll('span,div,a,button')]
    .filter((e) => e.children.length === 0)
    .map((e) => (e.textContent || '').trim())
    .filter((t) => t.length > 3 && t.length < 40
                && /einblenden|anzeigen|Lage|Modell|Karte|Zuordnung|Gemeinde|Info/i.test(t)));
console.log('Kandidaten:', [...new Set(knoepfe)].join(' | '));

const ziel = seite.locator('text=Lage einblenden').first();
if (await ziel.count()) {
  await ziel.click();
  await seite.waitForTimeout(4000);

  /* Danach ein Vektorbild holen und nachsehen, was dazugekommen ist. */
  const [dl] = await Promise.all([
    seite.waitForEvent('download', { timeout: 60000 }),
    (async () => {
      await seite.locator('[data-tb-test-id="viz-viewer-toolbar-button-download"]').click();
      await seite.waitForSelector('[data-tb-test-id="download-flyout-download-svg-MenuItem"]', { timeout: 20000 });
      await seite.locator('[data-tb-test-id="download-flyout-download-svg-MenuItem"]').click();
    })(),
  ]);
  await dl.saveAs('/arb/lage-eingeblendet.svg');
  const M = await import('./svg-lesen.mjs');
  const texte = M.texteMitLage(fs.readFileSync('/arb/lage-eingeblendet.svg', 'utf8'));
  console.log('\nTextstuecke nach dem Einblenden:', texte.length);

  /* Was nennt Gemeinden, Ortsteile oder Zonen? */
  const verdaechtig = texte.map((t) => t.t)
    .filter((t) => t.length > 2 && !/^[\d.,€%\s±-]+$/.test(t));
  console.log('\nAlle Nicht-Zahlen-Texte:');
  [...new Set(verdaechtig)].forEach((t) => console.log('   ' + t.slice(0, 90)));
} else {
  console.log('Knopf "Lage einblenden" nicht gefunden.');
}
await browser.close();
