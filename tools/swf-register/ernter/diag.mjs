/* Warum kommt die Vizualisierung im kopflosen Browser nicht hoch?
   Erst hinsehen, dann die Wartezeit hochdrehen. */
import { chromium } from 'playwright';
import * as T from './tableau.mjs';
const UA = 'Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)';
const WB = process.argv[2] || '2026_sw_efh_nomgs';

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

const fehler = [];
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text().slice(0, 140)); });
seite.on('pageerror', (e) => fehler.push('PAGEERROR ' + String(e).slice(0, 140)));
const abgewiesen = [];
seite.on('response', (r) => { if (r.status() >= 400) abgewiesen.push(r.status() + ' ' + r.url().slice(0, 110)); });

await seite.goto(`https://public.tableau.com/views/${WB}/${await T.viewName(WB)}?:showVizHome=no&:embed=true`,
                 { waitUntil: 'domcontentloaded', timeout: 60000 });
await seite.waitForTimeout(15000);

const befund = await seite.evaluate(() => ({
  titel: document.title,
  koerperZeichen: document.body ? document.body.innerText.trim().length : 0,
  textAnfang: document.body ? document.body.innerText.trim().slice(0, 300) : '',
  klassen: [...new Set([...document.querySelectorAll('div')]
    .map((e) => String(e.className || '').split(' ')[0]).filter(Boolean))].slice(0, 25),
  canvasse: document.querySelectorAll('canvas').length,
  iframes: document.querySelectorAll('iframe').length,
}));
console.log('Titel        :', befund.titel);
console.log('Textzeichen  :', befund.koerperZeichen);
console.log('Canvas       :', befund.canvasse, ' iframes:', befund.iframes);
console.log('Klassen      :', befund.klassen.join(' '));
console.log('Text         :', befund.textAnfang.replace(/\s+/g, ' ').slice(0, 260));
console.log('\nKonsolenfehler:', fehler.length);
fehler.slice(0, 6).forEach((f) => console.log('   ' + f));
console.log('Abgewiesene Abrufe:', abgewiesen.length);
abgewiesen.slice(0, 6).forEach((a) => console.log('   ' + a));

await seite.screenshot({ path: '/arb/diag.png', fullPage: false });
console.log('\nBild: /arb/diag.png');
await browser.close();
