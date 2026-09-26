/* Welche Steuerung gehoert zu welcher Beschriftung?

   Die Beschriftungen ("Bodenrichtwert [EUR/m2]:") sind EIGENE Textzonen
   des Dashboards, nicht Teil der Steuerung - `.ParamTitle` ist leer.
   Gemessen am 26.09.2026.

   Also wird gepaart, wie ein Mensch liest: die Beschriftung steht LINKS
   von ihrer Steuerung, auf gleicher Hoehe. Das ist robuster als die
   Reihenfolge im DOM, die je Ausschuss anders ist. */
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
  const mitte = (e) => { const r = e.getBoundingClientRect();
                         return { x: r.x, y: r.y + r.height / 2, r: r.right, h: r.height }; };

  const steuer = [...document.querySelectorAll('[class*="ParameterControlBox"]')].map((b, i) => ({
    i, ...mitte(b),
    wert: (b.querySelector('textarea.QueryBox') || {}).value
          || ((b.querySelector('.tabComboBoxName') || {}).textContent || '').trim(),
    art: b.querySelector('textarea.QueryBox') ? 'eingabe' : 'auswahl',
  }));

  /* Alle kurzen Textschnipsel des Dashboards als Beschriftungskandidaten.
     Nur Blaetter nehmen, sonst erwischt man Container mit dem Text aller
     Kinder. */
  const zettel = [...document.querySelectorAll('[class*="tab-textRegion"] *, span, div')]
    .filter((e) => e.children.length === 0)
    .map((e) => ({ t: (e.textContent || '').trim(), ...mitte(e) }))
    .filter((z) => z.t.length > 3 && z.t.length < 60 && /[A-Za-zÄÖÜäöü]/.test(z.t));

  return steuer.map((s) => {
    /* Der naechste Zettel LINKS auf gleicher Hoehe. */
    const nah = zettel
      .filter((z) => z.r <= s.x + 12 && Math.abs(z.y - s.y) < Math.max(18, s.h))
      .sort((a, b) => (s.x - a.r) - (s.x - b.r))[0];
    return { i: s.i, art: s.art, wert: s.wert,
             beschriftung: nah ? nah.t : null,
             abstand: nah ? Math.round(s.x - nah.r) : null };
  });
});

console.log('Workbook', WB);
befund.forEach((b) => console.log(
  `  [${b.i}] ${b.art.padEnd(8)} ${String(b.wert).padEnd(10)} <- "${b.beschriftung}"  (${b.abstand} px)`));

await browser.close();
