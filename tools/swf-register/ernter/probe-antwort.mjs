/* ═══════════════════════════════════════════════════════════════════════
   probe-antwort.mjs · Wo steckt der Sachwertfaktor in der Antwort?

   DIE EINE UNBEKANNTE VOR DEM BAU. Tableau rendert die Kacheln als
   webp-Bilder; im DOM stehen nur die Beschriftungen ("Sachwertfaktor:"),
   nicht die Zahl. Gemessen am 25.09.2026 im Browser.

   Ein Ernter kann den Wert also nicht ablesen - er muss ihn aus der
   ANTWORT des vizql-Befehls holen. Dieses Skript findet heraus, wo genau
   er dort liegt. Es erntet nichts, es schaut nur nach.

   Aufruf:  node probe-antwort.mjs [workbook]
   ═══════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

const WB = process.argv[2] || '2026_sw_efh_nomgs';
const UA = 'Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)';

/* Den View-Namen LESEN, nicht annehmen: er heisst je Region mal `Dash`,
   mal `dash`. Das steht so schon in ni-kopfdaten.sh und hat dort vier
   Gebiete gekostet. */
async function viewName(wb) {
  const r = await fetch(`https://public.tableau.com/profile/api/workbook/${wb}`,
                        { headers: { 'User-Agent': UA } });
  const t = await r.text();
  const m = t.match(/"defaultViewName":"([^"]*)"/);
  if (!m) throw new Error('kein View-Name fuer ' + wb);
  return m[1];
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const seite = await browser.newPage({
  userAgent: UA,
  viewport: { width: 1400, height: 1000 },
  /* OHNE DIESE ZWEI ZEILEN KOMMT DIE VIZ NIE HOCH. Der kopflose
     Container hat keine Gebietseinstellung; Tableaus JavaScript stirbt
     an `RangeError: Incorrect locale information provided` und zeigt
     einen tabErrorDialog. Gemessen am 26.09.2026. */
  locale: "de-DE",
  timezoneId: "Europe/Berlin",
});

/* Jede Antwort eines tabdoc-Befehls mitschneiden. */
const antworten = [];
seite.on('response', async (r) => {
  if (!r.url().includes('/commands/tabdoc/')) return;
  try {
    antworten.push({ befehl: r.url().split('/').pop().split('?')[0],
                     status: r.status(), text: await r.text() });
  } catch { /* Antwort schon verworfen - kein Grund abzubrechen */ }
});

const V = await viewName(WB);
console.log(`Workbook ${WB}, View ${V}`);
await seite.goto(`https://public.tableau.com/views/${WB}/${V}?:showVizHome=no&:embed=true`,
                 { waitUntil: 'networkidle', timeout: 90000 });

/* Warten, bis die Parametersteuerungen wirklich da sind - nicht auf die
   Uhr, sondern auf das Element. */
await seite.waitForSelector('[class*="ParameterControlBox"]', { timeout: 60000 });
const stand = await seite.evaluate(() =>
  [...document.querySelectorAll('[class*="ParameterControlBox"]')]
    .map((e) => (e.textContent || '').trim().slice(0, 30)));
console.log('Steuerungen:', JSON.stringify(stand));

antworten.length = 0;   /* alles vom Laden verwerfen */

/* EINE Aenderung ausloesen: die Lage umstellen. Ueber den BEDIENWEG,
   nicht per setAttribute - sonst laeuft die Logik des Dashboards nicht
   mit und wir messen etwas, das es so nie tut. */
const kasten = seite.locator('[class*="ParameterControlBox"]')
  .filter({ hasText: /^GS\s*\d/ }).first();
await kasten.click();
await seite.waitForSelector('.tabMenuItemName', { timeout: 20000 });
const werte = await seite.evaluate(() =>
  [...document.querySelectorAll('.tabMenuItemName')].map((e) => (e.textContent || '').trim()));
console.log('Lage-Werte:', JSON.stringify(werte));
await seite.locator('.tabMenuItemName').nth(werte.length - 1).click();
await seite.waitForTimeout(3500);

console.log(`\nAntworten mitgeschnitten: ${antworten.length}`);
for (const a of antworten) {
  console.log(`\n── ${a.befehl}  HTTP ${a.status}  ${a.text.length} Zeichen`);
  /* Tableau schickt manchmal mehrteilige Antworten mit Laengenpraefix.
     Erst den JSON-Anfang suchen. */
  const i = a.text.indexOf('{');
  let d = null;
  try { d = JSON.parse(a.text.slice(i)); } catch (e) {
    console.log('   kein reines JSON:', a.text.slice(0, 120).replace(/\s+/g, ' '));
  }
  if (d) {
    console.log('   Schluessel:', Object.keys(d).join(', '));
    const cmd = d.vqlCmdResponse || d;
    if (cmd.layoutStatus) console.log('   layoutStatus:', Object.keys(cmd.layoutStatus).join(', '));
    if (cmd.cmdResultList) console.log('   cmdResultList:', cmd.cmdResultList.length);
  }
  /* Wo steht eine Zahl, die wie ein Sachwertfaktor aussieht? Deutsche
     Schreibweise, zwischen 0,20 und 2,99 - das ist der Wertebereich,
     den alle bisher geernteten Gitter einhalten. */
  const treffer = [...a.text.matchAll(/"([0-2],\d{2})"/g)].map((m) => m[1]);
  const einmalig = [...new Set(treffer)];
  console.log('   Faktor-Kandidaten:', einmalig.slice(0, 12).join(' ') || '(keine)');
  if (einmalig.length) {
    const p = a.text.indexOf('"' + einmalig[0] + '"');
    console.log('   Umfeld:', a.text.slice(Math.max(0, p - 220), p + 60).replace(/\s+/g, ' '));
  }
}

await browser.close();
