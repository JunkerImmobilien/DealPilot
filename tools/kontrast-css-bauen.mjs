/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/kontrast-css-bauen.mjs · v2101
   Backlog N60.17 / N60.29

   Erzeugt den CSS-Block fuer den Kontrast-Vorschlag — aus DERSELBEN
   Quelle wie die Demo (`kontrast-demo-bauen.mjs`).

   WARUM GENERIERT: Marcel hat den Vorschlag so freigegeben, wie die Demo
   ihn zeigt („bitte kontrast vorschlag so umsetzen"). Wenn die Demo die
   Toene rechnet und das CSS sie noch einmal von Hand traegt, laufen
   beide auseinander — und dann zeigt die Demo etwas anderes als die App
   tut. Dasselbe Muster, das `score-tiers.js` vier Kopien gekostet hat.

   SCOPE: `#dashboard-main`. Gemessen am 11.10.2026 im laufenden Cockpit:
   370 von 384 Traegern der elf Toene liegen darin. Die 14 ausserhalb
   sind `button.dk-seg`, `span.sb-neu-lbl`, `button.sb-add-new`,
   `div.sbc-ds2-hint` und `div.sb-lage-kopf` — alle in der SEITENLEISTE
   auf Obsidian, wo dasselbe Gold RICHTIG ist. Ein globaler Tokenwechsel
   haette die mitgefaerbt.

   Aufruf: node tools/kontrast-css-bauen.mjs            (zeigt den Block)
           node tools/kontrast-css-bauen.mjs --schreiben (haengt ihn an)
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import { rechne, GRUENDE, SCHWELLE } from './kontrast-demo-bauen.mjs';

/* ── Welcher Ton sitzt auf welchen Traegern ────────────────────────────
   GEMESSEN im laufenden Cockpit (1280 px), nicht aus dem Quelltext
   geraten: fuer jeden der elf Toene wurde jedes Element gesucht, dessen
   `color` genau diesen Wert hat. Die Selektoren hier sind die daraus
   gewonnenen Traeger.

   `badge` steht NICHT in dieser Liste — Abzeichen bekommen Weg (c),
   dunklen Grund mit unveraendertem Ton, wie `.ds2-tag` in v2089. */
const TRAEGER = {
  'Rot hell':      { n: 54,  sel: ['td.neg', '.v', '.ov-v', '.scl'] },
  'Grau':          { n: 117, sel: ['.hp-sub', '.kk', '.sk-k-l', '.sk-u-btn',
                                   'td.sk-grau', 'td.sk-dat', 'th.r'] },
  'Gruen hell':    { n: 27,  sel: ['td.pos'] },
  'Gold dunkel':   { n: 49,  sel: ['.ov-card-title', '.ov-toggle-hint', '.cd', '.cta'] },
  'Gruen (Marke)': { n: 53,  sel: ['.ov-v', '.scl', '.kv'] },
  'Rot (Marke)':   { n: 24,  sel: ['.ov-v', '.v', '.scl', 'button.r'] },
  'Gold (Marke)':  { n: 17,  sel: ['.gt', '.ov-v', '.kpi-hint', '.v', '.sk-k-v', '.sk-art'] },
  'Rot (Token)':   { n: 8,   sel: ['td.r.sk-rot', 'td.r'] },
  'Gold hell':     { n: 18,  sel: ['span.e', '.cls', '.hp-lab', 'button.active'] },
  'Grau warm':     { n: 1,   sel: ['.gempty'] },
  'Grau kuehl':    { n: 2,   sel: ['.dp-pp-s', '.dp-pp-hint'] }
};

const zeilen = rechne();
const fehlend = zeilen.filter((z) => !TRAEGER[z.name]);
if (fehlend.length) {
  console.error('Fuer diese Toene fehlen die Traeger: ' + fehlend.map((z) => z.name).join(', '));
  process.exit(1);
}

const aus = [];
aus.push('');
aus.push('/* ══════════════════════════════════════════════════════════════════════');
aus.push('   v2101 · DER KONTRAST-VORSCHLAG, UMGESETZT (Backlog N60.17/N60.29)');
aus.push('');
aus.push('   Marcel am 11.10.2026: „und bitte kontrast vorschlag so umsetzen."');
aus.push('   Gemeint ist der Vorschlag aus `frontend/kontrast-cockpit.html`:');
aus.push('   Weg (a) fuer Zahlen und Tabellen, Weg (c) fuer Abzeichen.');
aus.push('');
aus.push('   DIESER BLOCK IST ERZEUGT von `tools/kontrast-css-bauen.mjs` aus');
aus.push('   derselben Quelle wie die Demo. Wer einen Ton von Hand aendert,');
aus.push('   laesst Demo und App auseinanderlaufen — dann zeigt die Demo etwas');
aus.push('   anderes, als die App tut.');
aus.push('');
aus.push('   WARUM `#dashboard-main` UND KEIN TOKENWECHSEL: gemessen liegen');
aus.push('   370 von 384 Traegern der elf Toene im Cockpit. Die 14 ausserhalb');
aus.push('   (`button.dk-seg`, `span.sb-neu-lbl`, `button.sb-add-new`,');
aus.push('   `div.sbc-ds2-hint`, `div.sb-lage-kopf`) sitzen in der');
aus.push('   SEITENLEISTE auf Obsidian — dort ist dasselbe Gold RICHTIG. Ein');
aus.push('   Wechsel an `--gold` haette sie mitgefaerbt.');
aus.push('');
aus.push('   JEDER TON WIRD AUF SEINER EIGENEN ACHSE ABGEDUNKELT: der');
aus.push('   Farbwinkel bleibt, Gruen bleibt Gruen und Gold bleibt Gold.');
aus.push('   Genommen ist die KLEINSTE Abdunklung, die auf allen ' + GRUENDE.length + ' hellen');
aus.push('   Flaechen die Schwelle ' + SCHWELLE + ' haelt (die dunkelste entscheidet,');
aus.push('   nicht die haeufigste — Lektion aus v2090/.hint).');
aus.push('');
aus.push('   | Ton | war | ist | Stellen |');
aus.push('   |---|---|---|---|');
for (const z of zeilen) {
  aus.push('   | ' + z.name.padEnd(14) + ' | ' + z.farbe + ' ' + z.kHeute.toFixed(2).padStart(5)
    + ' | ' + z.v.hex + ' ' + z.kNeu.toFixed(2).padStart(5)
    + ' | ' + String(TRAEGER[z.name].n).padStart(3) + ' |');
}
aus.push('   ══════════════════════════════════════════════════════════════════════ */');
aus.push('');

for (const z of zeilen) {
  const t = TRAEGER[z.name];
  /* Die Selektoren kommen als EIGENE Zeilen in `aus`, nicht als ein
     String mit `\n` darin. Der erste Entwurf fuegte sie mit `\n`
     zusammen, waehrend `aus` am Ende mit `\r\n` verbunden wird — das
     ergab 27 nackte LF-Zeilen in einer CRLF-Datei. Gefunden vom
     Zeilenenden-Pruefer, zurueckgenommen, Ursache behoben. */
  const selZeilen = t.sel.map((s, i) =>
    '#dashboard-main ' + s + (i < t.sel.length - 1 ? ',' : ' {'));
  aus.push('/* ' + z.name + ': ' + z.farbe + ' -> ' + z.v.hex
    + '  (k ' + z.kHeute.toFixed(2) + ' -> ' + z.kNeu.toFixed(2)
    + ', schlechtester Grund ' + z.schlechtester.g + ' = ' + z.schlechtester.k.toFixed(2) + ')');
  aus.push('   ' + t.n + ' Traeger gemessen, Abdunklung -' + z.v.prozent + ' %. */');
  for (const zz of selZeilen) aus.push(zz);
  aus.push('  color: ' + z.v.hex + ' !important;');
  aus.push('}');
  aus.push('');
}

/* ── Weg (c) fuer Abzeichen ────────────────────────────────────────── */
aus.push('/* ── Weg (c) fuer ABZEICHEN: Ton bleibt, der Grund wird dunkel ───────');
aus.push('   Genau wie `.ds2-tag` in v2089. Ein Abzeichen ist eine Pille, keine');
aus.push('   Zahl in einer Tabelle — dort traegt der dunkle Grund die Marke');
aus.push('   weiter, statt den Ton zu verlieren. Gold auf Tinte #1A1714 = 7,81. */');
aus.push('#dashboard-main .badge,');
aus.push('#dashboard-main .shr-stub-la {');
aus.push('  background: #1A1714 !important;');
aus.push('  color: var(--wl-c9a84c, #C9A84C) !important;');
aus.push('  border-color: color-mix(in srgb, var(--gold) 38%, transparent) !important;');
aus.push('}');
aus.push('');

const block = aus.join('\r\n');

if (process.argv.includes('--schreiben')) {
  const p = 'frontend/css/style.css';
  let s = fs.readFileSync(p, 'latin1');
  if (s.indexOf('v2101 · DER KONTRAST-VORSCHLAG') >= 0) {
    console.error('Der Block steht schon in style.css — nicht zweimal anhaengen.');
    process.exit(1);
  }
  if (!s.endsWith('\r\n')) s += '\r\n';
  fs.writeFileSync(p, Buffer.from(s + block, 'latin1'));
  console.log('Angehaengt an ' + p + ': ' + block.split('\r\n').length + ' Zeilen');
  console.log('Regeln: ' + zeilen.length + ' Toene + 1 Abzeichen-Block');
} else {
  console.log(block.replace(/\r\n/g, '\n'));
  console.log('\n--- nicht geschrieben. Mit --schreiben anhaengen. ---');
}
