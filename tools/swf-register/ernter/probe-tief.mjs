/* Steckt der Sachwertfaktor in der ANTWORT - oder nur im Bild?

   Das entscheidet die Bauform des Ernters:
     in der Antwort -> ein Abruf je Gitterpunkt, schnell
     nur im Bild    -> PDF je Gitterpunkt, langsam aber sicher

   Geraten wird hier nichts. */
import fs from 'fs';
import * as T from './tableau.mjs';

const WB = process.argv[2] || '2026_sw_efh_nomgs';

const browser = await T.browserAuf();
const seite = await T.seiteAuf(browser);

const mit = [];
seite.on('response', async (r) => {
  if (!/\/commands\//.test(r.url())) return;
  try { mit.push({ u: r.url().split('/').pop().split('?')[0], t: await r.text() }); } catch {}
});

const V = await T.viewName(WB);
await T.dashboardAuf(seite, WB, V);
const st = await T.steuerungen(seite);
st.forEach((s) => console.log(`  [${s.i}] ${s.art.padEnd(8)} ${String(s.wert).padEnd(10)} <- ${s.beschriftung}`));

const brw = T.finde(st, /Bodenrichtwert/i);
if (!brw) { console.log('keine Bodenrichtwert-Steuerung'); await browser.close(); process.exit(1); }

mit.length = 0;
await T.setzeZahl(seite, brw.i, 80);
await seite.waitForTimeout(4500);

let gesamt = '';
console.log('\nAntworten:', mit.length);
for (const m of mit) { gesamt += m.t; console.log('  ' + m.u + '  ' + m.t.length + ' Zeichen'); }
fs.writeFileSync('/arb/antwort.json', gesamt);

const suchen = {
  'Wort "Sachwertfaktor"': /Sachwertfaktor/,
  'deutsche Zahl x,xx': /\b[0-2],\d{2}\b/g,
  'englische Zahl x.xx': /\b[0-2]\.\d{2}\b/g,
  'formattedValue': /formattedValue/,
  'dataValues': /dataValues/,
  'presModelMap': /presModelMap/,
  'vizData': /vizData/,
  'Bildkacheln': /tileInfo|\.webp/,
};
console.log('\nWas steckt drin:');
for (const [was, re] of Object.entries(suchen)) {
  const t = gesamt.match(re);
  console.log('  ' + was.padEnd(22)
    + (t ? (re.global ? t.length + ' Treffer: ' + [...new Set(t)].slice(0, 10).join(' ') : 'JA') : 'nein'));
}
const p = gesamt.indexOf('Sachwertfaktor');
if (p >= 0) console.log('\nUmfeld:', gesamt.slice(Math.max(0, p - 150), p + 350).replace(/\s+/g, ' '));

await browser.close();
