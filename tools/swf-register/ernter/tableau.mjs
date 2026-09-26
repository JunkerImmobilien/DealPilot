/* ═══════════════════════════════════════════════════════════════════════
   tableau.mjs · Was man wissen muss, um einen NI-Kalkulator zu bedienen

   Alles hier ist AUSGELESEN, nicht angenommen — die Fundstellen stehen
   jeweils dabei. Wer etwas aendert, misst vorher nach.
   ═══════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';

export const UA =
  'Mozilla/5.0 (DealPilot Registerpflege; amtliche Kennzahlen nach ImmoWertV)';

/** Der View-Name heisst je Region mal `Dash`, mal `dash` — das ist nicht
 *  ratbar und wird deshalb gelesen. (Steht so schon in ni-kopfdaten.sh;
 *  mit fest verdrahtetem "Dash" kamen am 23.09. vier Gebiete ohne PDF
 *  zurueck.) */
export async function viewName(wb) {
  const r = await fetch(`https://public.tableau.com/profile/api/workbook/${wb}`,
                        { headers: { 'User-Agent': UA } });
  const m = (await r.text()).match(/"defaultViewName":"([^"]*)"/);
  if (!m) throw new Error('kein View-Name fuer ' + wb);
  return m[1];
}

/** Ein Browser, der Tableau nicht abstuerzen laesst.
 *
 *  OHNE `locale` STIRBT DIE SEITE: der kopflose Container hat keine
 *  Gebietseinstellung, Tableaus JavaScript wirft
 *  `RangeError: Incorrect locale information provided` und zeigt einen
 *  `tabErrorDialog` statt der Vizualisierung. Gemessen am 26.09.2026 —
 *  der Viz kam nie hoch, und es sah aus wie ein Zeitproblem. */
export async function browserAuf() {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

export async function seiteAuf(browser) {
  return browser.newPage({
    userAgent: UA,
    viewport: { width: 1400, height: 1000 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  });
}

/** Dashboard oeffnen und warten, bis die Steuerungen wirklich da sind —
 *  auf das ELEMENT warten, nicht auf die Uhr. */
export async function dashboardAuf(seite, wb, view) {
  await seite.goto(
    `https://public.tableau.com/views/${wb}/${view}?:showVizHome=no&:embed=true`,
    { waitUntil: 'networkidle', timeout: 90000 });
  await seite.waitForSelector('[class*="ParameterControlBox"]', { timeout: 60000 });
}

/** Welche Steuerung gehoert zu welcher Beschriftung?
 *
 *  Die Beschriftungen sind EIGENE Textzonen des Dashboards, nicht Teil
 *  der Steuerung — `.ParamTitle` ist leer (gemessen 26.09.2026). Gepaart
 *  wird deshalb, wie ein Mensch liest: die Beschriftung steht LINKS von
 *  ihrer Steuerung, auf gleicher Hoehe. Das ist robuster als die
 *  Reihenfolge im DOM, die je Ausschuss anders ist. */
export async function steuerungen(seite) {
  return seite.evaluate(() => {
    const masz = (e) => { const r = e.getBoundingClientRect();
                          return { x: r.x, y: r.y + r.height / 2, r: r.right, h: r.height }; };
    const steuer = [...document.querySelectorAll('[class*="ParameterControlBox"]')]
      .map((b, i) => ({ i, ...masz(b),
        wert: (b.querySelector('textarea.QueryBox') || {}).value
              || ((b.querySelector('.tabComboBoxName') || {}).textContent || '').trim(),
        art: b.querySelector('textarea.QueryBox') ? 'eingabe' : 'auswahl' }));
    const zettel = [...document.querySelectorAll('[class*="tab-textRegion"] *, span, div')]
      .filter((e) => e.children.length === 0)
      .map((e) => ({ t: (e.textContent || '').trim(), ...masz(e) }))
      .filter((z) => z.t.length > 3 && z.t.length < 60 && /[A-Za-zÄÖÜäöü]/.test(z.t));
    return steuer.map((s) => {
      const nah = zettel
        .filter((z) => z.r <= s.x + 12 && Math.abs(z.y - s.y) < Math.max(18, s.h))
        .sort((a, b) => (s.x - a.r) - (s.x - b.r))[0];
      return { i: s.i, art: s.art, wert: s.wert, beschriftung: nah ? nah.t : null };
    });
  });
}

/** Die Steuerung zu einem Begriff finden. Gibt null zurueck, wenn es sie
 *  nicht gibt — der Aufrufer entscheidet dann, ob das Gebiet ausfaellt.
 *  Kein Rateweg ueber die Position: lieber kein Satz als ein falscher. */
export function finde(liste, muster) {
  return liste.find((s) => s.beschriftung && muster.test(s.beschriftung)) || null;
}

/** Ein Eingabefeld setzen. Die Felder sind TEXTAREA.QueryBox, nicht
 *  input — ausgelesen am 26.09.2026. */
export async function setzeZahl(seite, index, wert) {
  const feld = seite.locator('[class*="ParameterControlBox"]').nth(index)
                    .locator('textarea.QueryBox');
  await feld.fill(String(wert));
  await feld.press('Enter');
  /* DEN FOKUS AUS DEM FELD NEHMEN. Das Dashboard sagt es selbst:
     "Nachdem Sie einen neuen Wert eingegeben haben, druecken Sie die
     Eingabetaste, um den Wert zu bestaetigen, oder die ESCAPE-TASTE, UM
     DEN WERT ZURUECKZUSETZEN."

     Der Ernter drueckte vor jedem Bildabruf Escape, um ein eventuell
     offenes Menue zu schliessen - und machte damit, solange der Fokus
     noch im Feld lag, die gerade gesetzte Zahl rueckgaengig. Das Ergebnis
     waren verstreute Loecher im Gitter, die nach Zeitproblem aussahen und
     keines waren: laengeres Warten half kaum (13 auf 11), einzeln
     nachgestellt lief jeder dieser Punkte einwandfrei. Gemessen am
     26.09.2026. */
  await feld.evaluate((e) => e.blur());
}

/** Eine Auswahl (z. B. die Lage) umstellen — ueber den BEDIENWEG, nicht
 *  per Attribut. Tableau setzt sie intern per INDEX
 *  (`set-parameter-value-from-index`, `[Parameters].[Parameter 2]`),
 *  weshalb sie ueber die URL grundsaetzlich nicht erreichbar ist. Genau
 *  deshalb gibt es diesen Ernter. */
export async function setzeAuswahl(seite, index, position) {
  /* Jeder Klick mit eigener Frist. Playwrights Vorgabe ist 30 s, das ist
     hier zu lang: bleibt einer haengen, steht das ganze Gebiet. Lieber
     frueh scheitern und den Punkt wiederholen. */
  await seite.locator('[class*="ParameterControlBox"]').nth(index)
             .click({ timeout: 15000 });
  await seite.waitForSelector('.tabMenuItemName', { timeout: 15000 });
  await seite.locator('.tabMenuItemName').nth(position).click({ timeout: 15000 });
}

/** Die Werte einer Auswahl lesen, ohne sie zu veraendern. */
export async function auswahlWerte(seite, index) {
  await seite.locator('[class*="ParameterControlBox"]').nth(index).click();
  await seite.waitForSelector('.tabMenuItemName', { timeout: 20000 });
  const w = await seite.evaluate(() =>
    [...document.querySelectorAll('.tabMenuItemName')].map((e) => (e.textContent || '').trim()));
  await seite.keyboard.press('Escape');
  return w;
}
