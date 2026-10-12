/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/kontrast-demo-pruefen.mjs · v2091
   Prueft frontend/kontrast-cockpit.html

   DER PRUEFER RECHNET SELBST und liest die Zahlen aus der FERTIGEN
   HTML-Datei zurueck. Er glaubt dem Generator nichts.

   Warum das noetig ist: der Generator hatte beim ersten Lauf genau den
   Fehler, den dieser Pruefer findet - er prueft die Schwelle am
   UNGERUNDETEN Ton und veroeffentlicht den gerundeten Hexwert. Drei Toene
   landeten dadurch auf 4,49 / 4,50 / 4,51, einer unter der Schwelle, die
   das Skript durchzusetzen behauptete.

   Geprueft wird:
     1 · Tag- und Klammerbilanz, Kommentartiefe
     2 · jede Hexfarbe in der Tabelle gegen ihren ausgewiesenen Kontrast
     3 · jeder Vorschlag auf ALLEN Gruenden (die dunkelste entscheidet)
     4 · die Summen im Fliesstext gegen die Einzelzeilen
     5 · abgeschaffte Begriffe und die Rechtsform
     6 · die Deckung: wie viele Zeilen wurden wirklich geprueft

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import { GEMESSEN, GRUENDE, SCHWELLE, rechne } from './kontrast-demo-bauen.mjs';

const DATEI = 'frontend/kontrast-cockpit.html';
const roh = fs.readFileSync(DATEI, 'utf8');
/* Der Pruefer darf sein EIGENES Zitat nicht finden: die Begruendung steht
   im Kommentar der Datei. (Memory: pruefer-findet-eigenes-zitat) */
const s = roh.replace(/<!--[\s\S]*?-->/g, '')
             .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
             .replace(/&minus;/g, '-').replace(/&thinsp;/g, '');

let fehler = 0;
let geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
const kon = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* ── 1 · Bilanzen ──────────────────────────────────────────────────── */
console.log('\n=== 1 · Struktur ===');
for (const t of ['html', 'head', 'body', 'div', 'table', 'thead', 'tbody',
                 'tr', 'td', 'th', 'p', 'ul', 'li', 'span', 'code', 'header',
                 'footer', 'h1', 'h2', 'h3', 'blockquote', 'style', 'strong', 'em']) {
  const auf = (roh.match(new RegExp('<' + t + '[ >]', 'g')) || []).length;
  const zu = (roh.match(new RegExp('</' + t + '>', 'g')) || []).length;
  if (auf !== zu) melde(false, t + ': ' + auf + ' auf, ' + zu + ' zu');
}
melde((roh.match(/<!--/g) || []).length === (roh.match(/-->/g) || []).length,
  'Kommentare paarig');
/* Klammern per TIEFE, nicht per Bilanz (Memory: css-klammertiefe-statt-bilanz) */
{
  const css = (roh.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  let tiefe = 0, min = 0, inK = false;
  for (let i = 0; i < css.length; i++) {
    if (!inK && css[i] === '/' && css[i + 1] === '*') { inK = true; i++; continue; }
    if (inK && css[i] === '*' && css[i + 1] === '/') { inK = false; i++; continue; }
    if (inK) continue;
    if (css[i] === '{') tiefe++;
    if (css[i] === '}') { tiefe--; if (tiefe < min) min = tiefe; }
  }
  melde(tiefe === 0 && min === 0 && !inK,
    'CSS-Klammertiefe endet auf 0, unterschreitet nie (Endtiefe ' + tiefe + ', tiefste ' + min + ')');
}

/* ── 2+3 · Jede Tabellenzeile gegen die eigene Rechnung ───────────── */
console.log('\n=== 2 · Jede Zeile gegen ihren ausgewiesenen Kontrast ===');
const zeilen = rechne();
/* Die Tabellenzeilen aus der HTML zurueckholen */
const htmlZeilen = [...s.matchAll(/<tr>\s*<td class="nm">([^<]+)<\/td>\s*<td class="num">(\d+)<\/td>[\s\S]*?<code>(#[0-9a-fA-F]{6})<\/code><\/td>\s*<td class="num [a-z]+">([\d.]+)<\/td>[\s\S]*?<code>(#[0-9a-fA-F]{6})<\/code><\/td>\s*<td class="num good">([\d.]+)<\/td>\s*<td class="num dim">-(\d+)\s*%<\/td>/g)]
  .map((m) => ({ name: m[1], n: +m[2], alt: m[3], kAlt: +m[4], neu: m[5], kNeu: +m[6], proz: +m[7] }));

melde(htmlZeilen.length === GEMESSEN.length,
  'Tabelle hat ' + htmlZeilen.length + ' Zeilen, erwartet ' + GEMESSEN.length);

for (const hz of htmlZeilen) {
  const z = zeilen.find((x) => x.name === hz.name);
  if (!z) { melde(false, 'Zeile "' + hz.name + '" kennt der Generator nicht'); continue; }
  melde(hz.alt.toLowerCase() === z.farbe.toLowerCase(),
    hz.name + ': alte Farbe ' + hz.alt + ' == ' + z.farbe);
  melde(hz.neu.toLowerCase() === z.v.hex.toLowerCase(),
    hz.name + ': Vorschlag ' + hz.neu + ' == ' + z.v.hex);
  melde(hz.n === z.n, hz.name + ': ' + hz.n + ' Stellen == ' + z.n);
  /* Jetzt SELBST rechnen, nicht den Generator fragen */
  const kAltSelbst = kon(parse(hz.alt), parse(z.grund));
  const kNeuSelbst = kon(parse(hz.neu), parse(z.grund));
  melde(Math.abs(kAltSelbst - hz.kAlt) < 0.01,
    hz.name + ': k heute ' + hz.kAlt + ' == selbst gerechnet ' + kAltSelbst.toFixed(2));
  melde(Math.abs(kNeuSelbst - hz.kNeu) < 0.01,
    hz.name + ': k neu ' + hz.kNeu + ' == selbst gerechnet ' + kNeuSelbst.toFixed(2));
  melde(hz.kAlt < SCHWELLE,
    hz.name + ': der alte Wert ' + hz.kAlt + ' liegt wirklich unter ' + SCHWELLE);
}

console.log('\n=== 3 · Jeder Vorschlag auf ALLEN Gruenden ===');
console.log('    (die dunkelste Flaeche entscheidet, nicht die haeufigste)');
for (const hz of htmlZeilen) {
  const werte = GRUENDE.map((g) => ({ g, k: kon(parse(hz.neu), parse(g)) }));
  const schlecht = werte.sort((a, b) => a.k - b.k)[0];
  melde(schlecht.k >= SCHWELLE,
    hz.name + ' ' + hz.neu + ': schlechtester Grund ' + schlecht.g
    + ' = ' + schlecht.k.toFixed(2) + ' (Schwelle ' + SCHWELLE + ')');
}

/* ── 4 · Die Summen im Fliesstext ─────────────────────────────────── */
console.log('\n=== 4 · Summen im Fliesstext gegen die Einzelzeilen ===');
const summe = zeilen.reduce((a, z) => a + z.n, 0);
const nStatus = zeilen.filter((z) => /Gruen|Rot/.test(z.name)).reduce((a, z) => a + z.n, 0);
const nGold = zeilen.filter((z) => /Gold/.test(z.name)).reduce((a, z) => a + z.n, 0);
const summeHtml = htmlZeilen.reduce((a, z) => a + z.n, 0);
melde(summe === summeHtml, 'Spaltensumme der Tabelle: ' + summeHtml + ' == ' + summe);
melde(s.includes(String(summe) + ' Textstellen'),
  'Die Einleitung nennt ' + summe + ' Textstellen');
melde(new RegExp('<strong>' + nStatus + '</strong>').test(s),
  'Statusfarben-Zahl ' + nStatus + ' steht im Text');
melde(new RegExp('<strong>' + nGold + '</strong>').test(s),
  'Gold-Zahl ' + nGold + ' steht im Text');
melde(nStatus + nGold <= summe,
  'Status (' + nStatus + ') + Gold (' + nGold + ') uebersteigt die Summe nicht');
melde(nStatus > nGold,
  'Die Aussage "Status ist der groessere Block" stimmt: ' + nStatus + ' > ' + nGold);
melde(s.includes('<strong>' + zeilen.length + '</strong>'),
  'Die Zahl der Ursachen (' + zeilen.length + ') steht im Text');
melde(new RegExp(GRUENDE.length + ' Fl').test(s),
  'Die Zahl der Gruende (' + GRUENDE.length + ') steht im Text');

/* ── 5 · Begriffe und Rechtsform ──────────────────────────────────── */
console.log('\n=== 5 · Abgeschaffte Begriffe und Rechtsform ===');
for (const b of ['Kerosin', 'TOP', 'STARK', 'Sprengnetter', 'PriceHubble']) {
  const n = (s.match(new RegExp(b, 'g')) || []).length;
  melde(n === 0, b + ' kommt ' + n + 'x vor (muss 0 sein)');
}
melde(!/\bUG\b/.test(s), 'Keine UG genannt (Junker Solution ist Einzelunternehmen)');
melde(/Junker Solution/.test(s), 'Junker Solution ist genannt');

/* ── 6 · Deckung ──────────────────────────────────────────────────── */
console.log('\n=== 6 · Deckung ===');
console.log('  Pruefpunkte gelaufen      : ' + geprueft);
console.log('  Tabellenzeilen geprueft   : ' + htmlZeilen.length + ' von ' + GEMESSEN.length);
console.log('  Gruende je Vorschlag      : ' + GRUENDE.length);
console.log('  Farbrechnungen selbst     : ' + (htmlZeilen.length * (2 + GRUENDE.length)));
const deckung = GEMESSEN.length ? htmlZeilen.length / GEMESSEN.length : 0;
if (deckung < 0.9) {
  console.log('\n  ABBRUCH: nur ' + Math.round(deckung * 100) + ' % der Zeilen gelesen.');
  console.log('  Ein Pruefer, der die Datei nicht liest, wird gruen ohne zu pruefen.');
  process.exit(1);
}
console.log('  Deckung                   : ' + Math.round(deckung * 100) + ' %');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft + ' Punkten'));
process.exit(fehler === 0 ? 0 : 1);
