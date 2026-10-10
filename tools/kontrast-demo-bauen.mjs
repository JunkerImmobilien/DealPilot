/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/kontrast-demo-bauen.mjs · v2091
   Backlog N60.17 / N60.29

   Baut frontend/kontrast-cockpit.html aus den MESSWERTEN.

   WARUM EIN GENERATOR UND KEINE HANDGESCHRIEBENE SEITE:
   Eine Demo, die Kontrastwerte behauptet, ist das Gegenteil dessen,
   was sie zeigen soll. Jede Zahl auf der Seite kommt aus kon() hier
   drunter, und tools/kontrast-demo-pruefen.mjs rechnet sie unabhaengig
   nach. Wer eine Zahl in der HTML von Hand aendert, faellt beim Pruefer
   durch.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';

const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
const kon = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const hx = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* ── GEMESSEN am 10.10.2026, Messkabine, 1180 px, Ansicht Cockpit ──────
   42 Mangelgruppen / 234 Elemente, nach Farbpaar gebuendelt auf 20, und
   nach Textfarbe weiter auf diese elf Ursachen. Je Zeile: Textfarbe,
   HELLSTER Grund auf dem sie vorkommt, Zahl der Elemente, Beispiele.   */
export const GEMESSEN = [
  ['#D98579', '#ffffff', 54, 'td.neg · div.v',             'Rot hell'],
  ['#9A948A', '#fdfcfa', 47, 'td.sk-grau · th.r',          'Grau'],
  ['#5CC187', '#ffffff', 27, 'td.pos',                     'Gruen hell'],
  ['#A98D40', '#ffffff', 29, 'div.ov-card-title · span.cd', 'Gold dunkel'],
  ['#3FA56C', '#ffffff', 26, 'div.ov-v · div.scl',         'Gruen (Marke)'],
  ['#B86250', '#ffffff', 16, 'div.ov-v · button.r',        'Rot (Marke)'],
  ['#C9A84C', '#fdfcfa', 14, 'div.sk-k-v · span.sk-art',   'Gold (Marke)'],
  ['#B8625C', '#fdfcfa', 8,  'td.sk-rot',                  'Rot (Token)'],
  ['#D5BB73', '#f8f4e9', 10, 'span.badge · shr-stub-la',   'Gold hell'],
  ['#A89F8C', '#fdfcfa', 1,  'div.gempty',                 'Grau warm'],
  ['#938B7F', '#ffffff', 2,  'dp-pp-hint · dp-pp-s',       'Grau kuehl']
];

/* Alle hellen Flaechen, auf denen diese Toene vorkommen. Der DUNKELSTE
   entscheidet - die Lektion aus v2090: bei `.hint` bestand 0,65 auf vier
   von fuenf Flaechen und fiel auf --surface2 durch. */
export const GRUENDE = ['#ffffff', '#fdfcfa', '#f8f4e9', '#f6f1e2',
                        '#f2edda', '#f6ecea', '#FBF6E9', '#F0ECE4'];

export const SCHWELLE = 4.5;   /* keine der Stellen ist grosse Schrift */

/* Den Ton auf SEINER EIGENEN Achse abdunkeln: Farbwinkel bleibt, Gruen
   bleibt Gruen. Gesucht ist die KLEINSTE Abdunklung, die auf allen
   Gruenden haelt. */
export function vorschlag(hexFarbe) {
  const T = parse(hexFarbe);
  for (let s = 0; s <= 80; s++) {
    /* GERUNDET pruefen, nicht ungerundet. Veroeffentlicht wird ein
       Hexwert, also gilt auch nur dessen Kontrast.

       Hier stand `const t = T.map(c => c * (1 - s/100))` und geprueft
       wurde dieser Zwischenwert. Drei Toene kamen damit auf 4,49 / 4,50 /
       4,51 heraus - einer davon UNTER der Schwelle, die das Skript
       durchzusetzen behauptete. Die Rundung auf acht Bit frisst bis zu
       einem halben Prozent Leuchtkraft, und genau das war die Luecke. */
    const t = T.map((c) => Math.round(c * (1 - s / 100)));
    if (GRUENDE.every((g) => kon(t, parse(g)) >= SCHWELLE)) {
      return { hex: hx(t), prozent: s, rgb: t };
    }
  }
  return null;
}

export function rechne() {
  return GEMESSEN.map(([farbe, grund, n, stellen, name]) => {
    const v = vorschlag(farbe);
    const kHeute = kon(parse(farbe), parse(grund));
    const kNeu = v ? kon(v.rgb, parse(grund)) : 0;
    const schlechtester = v
      ? GRUENDE.map((g) => ({ g, k: kon(v.rgb, parse(g)) })).sort((a, b) => a.k - b.k)[0]
      : null;
    return { farbe, grund, n, stellen, name, v, kHeute, kNeu, schlechtester };
  });
}

/* ── ab hier nur noch Ausgabe ───────────────────────────────────────── */
const zeilen = rechne();
const summe = zeilen.reduce((a, z) => a + z.n, 0);
const nStatus = zeilen.filter((z) => /Gruen|Rot/.test(z.name)).reduce((a, z) => a + z.n, 0);
const nGold = zeilen.filter((z) => /Gold/.test(z.name)).reduce((a, z) => a + z.n, 0);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tabelle = zeilen.map((z) => [
  '      <tr>',
  '        <td class="nm">' + esc(z.name) + '</td>',
  '        <td class="num">' + z.n + '</td>',
  '        <td><span class="sw" style="background:' + z.farbe + '"></span><code>' + z.farbe + '</code></td>',
  '        <td class="num ' + (z.kHeute < 3 ? 'bad' : 'warn') + '">' + z.kHeute.toFixed(2) + '</td>',
  '        <td><span class="sw" style="background:' + z.v.hex + '"></span><code>' + z.v.hex + '</code></td>',
  '        <td class="num good">' + z.kNeu.toFixed(2) + '</td>',
  '        <td class="num dim">&minus;' + z.v.prozent + '&thinsp;%</td>',
  '        <td class="st"><code>' + esc(z.stellen) + '</code></td>',
  '      </tr>'
].join('\n')).join('\n');

const probe = (welche) => zeilen.slice(0, 7).map((z) => {
  const farbe = welche === 'heute' ? z.farbe : z.v.hex;
  const k = welche === 'heute' ? z.kHeute : z.kNeu;
  return [
    '      <div class="row">',
    '        <span class="lbl">' + esc(z.name) + '</span>',
    '        <span class="val" style="color:' + farbe + '">1.248.500&nbsp;&euro;</span>',
    '        <span class="k ' + (k >= SCHWELLE ? 'good' : 'bad') + '">' + k.toFixed(2) + '</span>',
    '      </div>'
  ].join('\n');
}).join('\n');

const html = [
'<!DOCTYPE html>',
'<html lang="de">',
'<head>',
'<meta charset="utf-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1">',
'<title>Kontrast im Cockpit</title>',
'<!-- ═══════════════════════════════════════════════════════════════════',
'     DealPilot · Kontrast-Vorschlag fuers Cockpit · v2091',
'     Backlog N60.17 / N60.29 · Stand 10.10.2026',
'',
'     ERZEUGT von tools/kontrast-demo-bauen.mjs - nicht von Hand aendern.',
'     Jede Zahl ist gerechnet; tools/kontrast-demo-pruefen.mjs rechnet sie',
'     unabhaengig nach und wird rot, wenn eine davon abweicht.',
'     ═══════════════════════════════════════════════════════════════════ -->',
'<style>',
'  :root{',
'    --gold:#C9A84C; --gold-hi:#E8CC7A;',
'    --grund:#FDFCFA; --flaeche:#ffffff; --rand:#E0DBD3;',
'    --text:#2A2727; --leise:rgba(42,39,39,.68);',
'    --gut:#256240; --schlecht:#8E3B32; --warn:#8a6f22;',
'  }',
'  @media (prefers-color-scheme: dark){',
'    :root:not([data-theme="light"]){',
'      --grund:#0D0C0B; --flaeche:#171513; --rand:#2E2A26;',
'      --text:#F3EAD0; --leise:rgba(243,234,208,.72);',
'      --gut:#5FC48D; --schlecht:#E09086; --warn:#D9BC6A;',
'    }',
'  }',
'  :root[data-theme="dark"]{',
'    --grund:#0D0C0B; --flaeche:#171513; --rand:#2E2A26;',
'    --text:#F3EAD0; --leise:rgba(243,234,208,.72);',
'    --gut:#5FC48D; --schlecht:#E09086; --warn:#D9BC6A;',
'  }',
'  *{box-sizing:border-box}',
'  body{margin:0;background:var(--grund);color:var(--text);',
'    font:15px/1.6 Inter,system-ui,-apple-system,sans-serif;',
'    padding:0 16px 72px}',
'  .wrap{max-width:1120px;margin:0 auto}',
'  header{padding:52px 0 8px}',
'  h1{font:600 clamp(26px,5vw,38px)/1.15 "Space Grotesk",Inter,sans-serif;',
'    margin:0 0 10px;letter-spacing:-.01em}',
'  .runway{height:3px;width:120px;border-radius:2px;margin:0 0 22px;',
'    background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f)}',
'  .lead{font-size:17px;max-width:62ch;color:var(--leise);margin:0 0 6px}',
'  h2{font:600 19px/1.3 "Space Grotesk",Inter,sans-serif;margin:46px 0 6px}',
'  h2 .zahl{font-family:"JetBrains Mono",ui-monospace,monospace;',
'    font-size:13px;color:var(--gold);margin-right:9px}',
'  p{max-width:68ch}',
'  .karte{background:var(--flaeche);border:1px solid var(--rand);',
'    border-radius:12px;padding:20px;margin:18px 0;overflow-x:auto}',
'  table{width:100%;border-collapse:collapse;font-size:13px}',
'  th,td{text-align:left;padding:8px 9px;border-bottom:1px solid var(--rand);',
'    vertical-align:middle}',
'  th{font:600 10px/1.4 "JetBrains Mono",ui-monospace,monospace;',
'    text-transform:uppercase;letter-spacing:.09em;color:var(--leise);',
'    border-bottom-width:2px}',
'  td.num,th.num{text-align:right;',
'    font-family:"JetBrains Mono",ui-monospace,monospace}',
'  td.nm{font-weight:600;white-space:nowrap}',
'  td.st code{font-size:11px;color:var(--leise)}',
'  code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px}',
'  .sw{display:inline-block;width:13px;height:13px;border-radius:3px;',
'    margin-right:6px;vertical-align:-2px;border:1px solid rgba(0,0,0,.18)}',
'  .bad{color:var(--schlecht);font-weight:700}',
'  .warn{color:var(--warn);font-weight:600}',
'  .good{color:var(--gut);font-weight:700}',
'  .dim{color:var(--leise)}',
'  .zwei{display:grid;gap:18px;',
'    grid-template-columns:repeat(auto-fit,minmax(290px,1fr))}',
'  .probe{background:#fff;border:1px solid var(--rand);border-radius:12px;',
'    padding:18px}',
'  .probe h3{font:600 11px/1.3 "JetBrains Mono",ui-monospace,monospace;',
'    text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px;',
'    color:#6b645a}',
'  .row{display:flex;align-items:baseline;gap:10px;padding:7px 0;',
'    border-bottom:1px solid #eee9e0}',
'  .row:last-child{border-bottom:0}',
'  .lbl{flex:0 0 118px;font-size:11px;color:#6b645a;',
'    font-family:"JetBrains Mono",ui-monospace,monospace}',
'  .val{flex:1 1 auto;min-width:0;font-size:15px;font-weight:700;',
'    font-family:"JetBrains Mono",ui-monospace,monospace}',
'  .k{flex:0 0 46px;text-align:right;font-size:11px;font-weight:700;',
'    font-family:"JetBrains Mono",ui-monospace,monospace}',
'  .k.good{color:#256240}',
'  .k.bad{color:#8E3B32}',
'  blockquote{margin:20px 0;padding:14px 18px;',
'    border-left:3px solid var(--gold);',
'    background:color-mix(in srgb, var(--gold) 7%, transparent);',
'    border-radius:0 8px 8px 0}',
'  blockquote p{margin:0 0 8px}',
'  blockquote p:last-child{margin:0}',
'  ul{max-width:68ch}',
'  li{margin:7px 0}',
'  footer{margin-top:54px;padding-top:20px;border-top:1px solid var(--rand);',
'    font-size:12.5px;color:var(--leise)}',
'  @media(max-width:620px){',
'    td.st,th.st{display:none}',
'    header{padding-top:34px}',
'    .lbl{flex-basis:92px}',
'  }',
'</style>',
'</head>',
'<body>',
'<div class="wrap">',
'',
'<header>',
'  <h1>Kontrast im Cockpit</h1>',
'  <div class="runway"></div>',
'  <p class="lead">Im Cockpit liegen <strong>' + summe + ' Textstellen</strong>',
'  unter der Lesbarkeitsschwelle &mdash; gemessen am 10.10.2026 bei 1180&nbsp;px.',
'  Das sind nicht ' + summe + ' Entscheidungen, sondern <strong>' + zeilen.length + '</strong>:',
'  so viele Farbt&ouml;ne stecken dahinter.</p>',
'</header>',
'',
'<h2><span class="zahl">1</span>Was gemessen ist</h2>',
'<p>Die Messkabine fand 42 Gruppen. Nach Farbe geb&uuml;ndelt bleiben',
zeilen.length + ' Ursachen. N&ouml;tig sind <strong>4,5</strong> &mdash; 3,0 gilt erst',
'ab 24&nbsp;px, oder ab 18,66&nbsp;px bei Fettung, und keine dieser Stellen',
'ist so gro&szlig;.</p>',
'',
'<div class="karte">',
'<table>',
'  <thead>',
'    <tr>',
'      <th>Ton</th><th class="num">Stellen</th><th>heute</th>',
'      <th class="num">k</th><th>Vorschlag</th><th class="num">k</th>',
'      <th class="num">dunkler</th><th class="st">Beispiele</th>',
'    </tr>',
'  </thead>',
'  <tbody>',
tabelle,
'  </tbody>',
'</table>',
'</div>',
'',
'<blockquote>',
'  <p><strong>Der gr&ouml;&szlig;te Block ist nicht Gold, sondern Gr&uuml;n und Rot.</strong>',
'  Von den ' + summe + ' Stellen tragen <strong>' + nStatus + '</strong> eine',
'  Statusfarbe als <em>Textfarbe</em> auf hellem Grund, nur',
'  <strong>' + nGold + '</strong> tragen Gold. Ich war von einem Goldproblem',
'  ausgegangen &mdash; das war der kleinere Teil.</p>',
'  <p>CLAUDE.md sagt: <em>Statusfarben nie tokenisieren</em>. Das verbietet,',
'  Gr&uuml;n und Rot <strong>umf&auml;rbbar</strong> zu machen, damit sie in jeder',
'  Marke gleich bleiben &mdash; nicht, sie lesbar zu machen. Ein Gr&uuml;n, das man',
'  nicht lesen kann, sagt so wenig wie ein Rot, das immer rot ist.</p>',
'</blockquote>',
'',
'<h2><span class="zahl">2</span>Wie es aussieht</h2>',
'<p>Dieselben sieben T&ouml;ne, links wie heute, rechts der Vorschlag &mdash; beide',
'auf wei&szlig;em Grund, weil das der Grund im Cockpit ist. Die Zahl rechts ist',
'der gemessene Kontrast.</p>',
'',
'<div class="zwei">',
'  <div class="probe">',
'    <h3>Heute</h3>',
probe('heute'),
'  </div>',
'  <div class="probe">',
'    <h3>Vorschlag</h3>',
probe('neu'),
'  </div>',
'</div>',
'',
'<h2><span class="zahl">3</span>Wie der Vorschlag gerechnet ist</h2>',
'<p>Jeder Ton wird auf <em>seiner eigenen Achse</em> abgedunkelt: der',
'Farbwinkel bleibt, Gr&uuml;n bleibt Gr&uuml;n und Gold bleibt Gold. Genommen wird',
'die <strong>kleinste</strong> Abdunklung, die auf <strong>allen</strong>',
GRUENDE.length + ' Fl&auml;chen h&auml;lt, auf denen diese Farben vorkommen:</p>',
'<ul>',
'  <li>Wei&szlig; <code>#ffffff</code>, Creme <code>#FDFCFA</code>, Karte',
'      <code>#FBF6E9</code>, <code>--surface2 #F0ECE4</code> und vier weitere.</li>',
'  <li><strong>Die dunkelste Fl&auml;che entscheidet, nicht die h&auml;ufigste.</strong>',
'      Bei <code>.hint</code> in <code>v2090</code> bestand 0,65 auf vier von',
'      f&uuml;nf Fl&auml;chen und fiel auf <code>--surface2</code> durch.</li>',
'  <li>Die <code>k</code>-Spalten zeigen den Wert auf dem <em>gemessenen</em>',
'      Grund; der schlechteste Fall steht im Pr&uuml;fprotokoll von',
'      <code>tools/kontrast-demo-pruefen.mjs</code>.</li>',
'</ul>',
'',
'<h2><span class="zahl">4</span>Was zu entscheiden ist</h2>',
'<p>Die Rechnung ist eindeutig, die <strong>Gestaltung</strong> nicht. Drei Wege:</p>',
'<ul>',
'  <li><strong>(a) Die T&ouml;ne abdunkeln, wie hier gezeigt.</strong> Ein',
'      Eingriff, wirkt &uuml;berall, die Farbfamilie bleibt. Die Werte werden',
'      sichtbar satter &mdash; das ist der Preis.</li>',
'  <li><strong>(b) Nur Tabellen- und Kennzahlentexte,</strong> Pillen und',
'      Abzeichen so lassen. Weniger auff&auml;llig, erzeugt aber eine zweite',
'      Gr&uuml;n- und Rotstufe neben der vorhandenen &mdash; genau so sind die vier',
'      <code>ds2-tag</code>-Fassungen entstanden.</li>',
'  <li><strong>(c) Dunkler Grund wie beim DS2-Etikett</strong>',
'      (<code>v2089</code>): die Farbe bleibt ganz unver&auml;ndert, k liegt dann',
'      bei 7&ndash;9. Passt f&uuml;r Pillen, nicht f&uuml;r Zahlen in einer Tabelle.</li>',
'</ul>',
'<p><strong>Mein Vorschlag:</strong> <strong>(a)</strong> f&uuml;r Zahlen und',
'Tabellen, <strong>(c)</strong> f&uuml;r Abzeichen &mdash; so ist das DS2-Etikett',
'schon gel&ouml;st, und eine zweite Farbstufe entsteht nicht.</p>',
'',
'<footer>',
'  DealPilot &middot; Junker Solution &middot; Kontrast-Vorschlag <code>v2091</code>',
'  &middot; Backlog N60.17 / N60.29 &middot; gemessen 10.10.2026, 1180&nbsp;px,',
'  Cockpit &middot; ' + summe + ' Stellen, ' + zeilen.length + ' Ursachen &middot;',
'  jede Zahl gerechnet, keine geschrieben',
'</footer>',
'',
'</div>',
'</body>',
'</html>',
''
/* LF, nicht CRLF: frontend/index.html ist reines LF, und die Tabellen-
   und Probenbloecke oben fuegen mit \n zusammen. Mit \r\n hier entstand
   eine Datei mit 207 CRLF- und 177 LF-Zeilen - gemischt, weil zwei
   Ebenen unterschiedlich zusammengefuegt haben. */
].join('\n');

fs.writeFileSync('frontend/kontrast-cockpit.html', html);
console.log('Geschrieben: frontend/kontrast-cockpit.html');
console.log('  Stellen gesamt : ' + summe);
console.log('  Ursachen       : ' + zeilen.length);
console.log('  Statusfarben   : ' + nStatus);
console.log('  Gold           : ' + nGold);
console.log('');
console.log('Ton            heute     k      ->  Vorschlag        k     schlechtester Grund');
for (const z of zeilen) {
  console.log('  ' + z.name.padEnd(15) + z.farbe + '  ' + z.kHeute.toFixed(2)
    + '  ->  ' + z.v.hex + ' (-' + String(z.v.prozent).padStart(2) + '%)  '
    + z.kNeu.toFixed(2) + '   ' + z.schlechtester.g + ' = ' + z.schlechtester.k.toFixed(2));
}
