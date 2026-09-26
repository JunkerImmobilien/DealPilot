/* Wie sieht eine Parametersteuerung wirklich aus? Struktur wird
   ausgelesen, nie angenommen. */
import { chromium } from 'playwright';
const UA = 'Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)';
const WB = process.argv[2] || '2026_sw_efh_nomgs';

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const seite = await browser.newPage({
  userAgent: UA, viewport: { width: 1400, height: 1000 },
  locale: 'de-DE', timezoneId: 'Europe/Berlin',
});
await seite.goto(`https://public.tableau.com/views/${WB}/Dash?:showVizHome=no&:embed=true`,
                 { waitUntil: 'networkidle', timeout: 90000 });
await seite.waitForSelector('[class*="ParameterControlBox"]', { timeout: 60000 });

const befund = await seite.evaluate(() => {
  const aus = [];
  document.querySelectorAll('[class*="ParameterControlBox"]').forEach((box, i) => {
    /* Die Beschriftung steht NICHT in der Box, sondern als Nachbar davor
       (Titel-Zone). Beides mitnehmen. */
    const zone = box.closest('[class*="tab-parameter"]') || box.parentElement;
    const titel = zone ? (zone.querySelector('[class*="Title"]') || {}).textContent : null;
    const eingaben = [...box.querySelectorAll('input,textarea,[contenteditable="true"],[role="textbox"]')]
      .map((e) => ({ tag: e.tagName, typ: e.getAttribute('type'), wert: e.value,
                     kl: String(e.className || '').slice(0, 40),
                     ro: e.readOnly, sicht: e.offsetParent !== null }));
    aus.push({
      i, titel: (titel || '').trim().slice(0, 40),
      text: (box.textContent || '').trim().slice(0, 26),
      kinderKlassen: [...box.querySelectorAll('*')]
        .map((e) => String(e.className || '').split(' ')[0]).filter(Boolean).slice(0, 8),
      eingaben,
    });
  });
  return aus;
});
befund.forEach((b) => {
  console.log(`\n[${b.i}] Titel="${b.titel}"  Text="${b.text}"`);
  console.log('    Kinder :', b.kinderKlassen.join(' '));
  console.log('    Eingabe:', b.eingaben.length ? JSON.stringify(b.eingaben) : '(KEINE)');
});
await browser.close();
