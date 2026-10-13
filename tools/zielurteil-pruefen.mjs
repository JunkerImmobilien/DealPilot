#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * zielurteil-pruefen.mjs — v2148
 *
 * SAGEN WORT UND AMPEL DASSELBE?
 *
 * `QcHeuristik.zielUrteil()` liefert zwei Dinge, die zusammenpassen
 * muessen: eine Ampelfarbe und ein WORT. Widersprechen sie sich, liest
 * der Investor „am Ziel" unter einem roten Punkt — und glaubt keinem
 * von beiden mehr.
 *
 * ── DIE EIGENTLICHE GEFAHR ──────────────────────────────────────────
 *
 * Die Wortgrenzen liegen bei 0,75 / 0,97 / 1,15 des Ziels, und die
 * Ampel wechselt bei Guete 0,40 / 0,75. Setzt man beide ineinander,
 * fallen zwei Grenzen AUFEINANDER:
 *
 *   q = 0,75  ->  Guete = (0,75-0,5)/0,5*0,8  =  0,4  == Gelb-Schwelle
 *
 * Genau dieser Fall hat v2143a einen Anlauf gekostet: der erste
 * Entwurf traf 0,3994 und die Ampel sprang auf Rot, weil ein
 * Tausendstel fehlte. **Eine Grenze, die auf einer anderen Grenze
 * liegt, entscheidet per Gleitkomma-Rundung.**
 *
 * Darum faehrt dieser Pruefer jede Grenze von beiden Seiten an und
 * prueft die PAARUNG, nicht die Einzelwerte.
 *
 * ── UND ER LAEDT DEN ECHTEN KERN ────────────────────────────────────
 *
 * `qc-heuristik.js` ist ein Browser-Modul (IIFE an `window`). Es wird
 * in einem `vm`-Kontext mit einem `window`-Objekt ausgefuehrt — nicht
 * nachgebaut. Ein Pruefer, der die Funktion abschreibt, misst sich
 * selbst.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const P = path.join(process.cwd(), 'frontend', 'js', 'qc-heuristik.js');
const quelle = fs.readFileSync(P, 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
try {
  new vm.Script(quelle, { filename: P }).runInContext(sandbox);
} catch (e) {
  console.error('Kern nicht ausfuehrbar: ' + e.message);
  process.exit(2);
}
const Q = sandbox.window.QcHeuristik;
if (!Q || typeof Q.zielUrteil !== 'function') {
  console.error('zielUrteil() fehlt im Kern.');
  process.exit(2);
}

/* Die Ampelschwellen stehen im Kern; hier nur zur Paarungspruefung. */
const GRUEN = 0.75, GELB = 0.40;
/* Welches Wort darf unter welcher Farbe stehen? */
const ERLAUBT = {
  'deutlich über deinem Ziel': ['gruen'],
  'am Ziel':                   ['gruen'],
  'knapp unter deinem Ziel':   ['gelb'],
  'deutlich unter deinem Ziel': ['rot', 'gelb']
};

let rot = 0, geprueft = 0;
const ZIEL = 5.0;   /* ein rundes Ziel, damit q genau einstellbar ist */

console.log('=== 1 · Jede Grenze von beiden Seiten ===');
console.log('    Ziel = ' + ZIEL.toFixed(1).replace('.', ',') + ' %');
console.log('');
console.log('      q        BMR      Guete   Ampel   Wort');
[0.4999, 0.5, 0.5001, 0.7499, 0.75, 0.7501, 0.9699, 0.97, 0.9701,
 0.9999, 1.0, 1.0001, 1.1499, 1.15, 1.1501, 1.2999, 1.3, 1.3001].forEach(function (q) {
  const bmr = Math.round(q * ZIEL * 1e8) / 1e8;
  const u = Q.zielUrteil(bmr, ZIEL, 'B');
  geprueft++;
  if (!u) { console.log('  ROT q=' + q + ' -> null, obwohl ein Ziel vorliegt'); rot++; return; }
  const ok = (ERLAUBT[u.wort] || []).includes(u.ampel);
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok ' : 'ROT')
    + ' ' + String(q).padEnd(8)
    + bmr.toFixed(4).padStart(8)
    + u.guete.toFixed(4).padStart(9)
    + '   ' + u.ampel.padEnd(7)
    + u.wort);
});

console.log('');
console.log('=== 2 · Monotonie: mehr Rendite darf nie schlechter urteilen ===');
let vorGuete = -1, verstoss = 0;
for (let q = 0.1; q <= 2.0; q += 0.005) {
  const u = Q.zielUrteil(Math.round(q * ZIEL * 1e8) / 1e8, ZIEL, 'A');
  if (!u) { console.log('  ROT bei q=' + q.toFixed(3) + ': null'); rot++; break; }
  if (u.guete < vorGuete - 1e-12) {
    if (verstoss < 3) console.log('  ROT q=' + q.toFixed(3) + ': Guete ' + u.guete.toFixed(6) + ' < vorher ' + vorGuete.toFixed(6));
    verstoss++;
  }
  vorGuete = u.guete;
  geprueft++;
}
console.log('  ' + (verstoss ? 'ROT ' + verstoss + ' Rueckschritte' : 'ok  380 Schritte monoton steigend'));
if (verstoss) rot++;

console.log('');
console.log('=== 3 · Der Riegel: ohne Ziel kein Urteil ===');
[[null, 'keine Klasse gesetzt'], ['', 'leerer Wert'], [0, 'null Prozent'],
 [-3, 'negativ'], ['abc', 'keine Zahl'], [undefined, 'fehlt ganz']].forEach(function (p) {
  const u = Q.zielUrteil(5.2, p[0], 'C');
  geprueft++;
  const ok = (u === null);
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + String(p[1]).padEnd(22)
    + (ok ? 'null -> der Aufrufer bleibt bei seiner festen Skala'
          : 'liefert ein Urteil, obwohl kein Ziel vorliegt!'));
});

console.log('');
console.log('=== 4 · Gegenprobe: erkennt der Pruefer ein falsches Paar? ===');
/* Ein Urteil mit absichtlich vertauschtem Wort MUSS auffallen. */
const echt = Q.zielUrteil(5.0, ZIEL, 'B');                /* q=1 -> am Ziel, gruen */
const gefaelscht = Object.assign({}, echt, { wort: 'deutlich unter deinem Ziel' });
const faelltAuf = !(ERLAUBT[gefaelscht.wort] || []).includes(gefaelscht.ampel);
console.log('  ' + (faelltAuf ? 'ok  ' : 'ROT ')
  + '„deutlich unter" unter gruener Ampel wird ' + (faelltAuf ? 'erkannt' : 'DURCHGELASSEN'));
if (!faelltAuf) rot++;
/* Und ein Paar, das stimmen MUSS, darf nicht als Fehler gelten. */
const sauber = (ERLAUBT[echt.wort] || []).includes(echt.ampel);
console.log('  ' + (sauber ? 'ok  ' : 'ROT ') + 'das echte Paar („' + echt.wort + '" / ' + echt.ampel + ') gilt als sauber');
if (!sauber) rot++;

console.log('');
console.log('=== 5 · Der Skalensatz nennt beide Zahlen ===');
['A', 'B', 'C', null].forEach(function (kl) {
  const u = Q.zielUrteil(4.0, 5.0, kl);
  geprueft++;
  const hatZiel = u && /5,0\s*%/.test(u.skala);
  const hatKlasse = !kl || (u && u.skala.indexOf(kl + '-Lage') >= 0);
  const ok = hatZiel && hatKlasse;
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + 'Klasse ' + String(kl || '(keine)').padEnd(8)
    + (u ? u.skala : '—'));
});

console.log('');
console.log('=== Deckung ===');
console.log('  Kern        : der ECHTE frontend/js/qc-heuristik.js im vm-Kontext');
console.log('  Faelle      : ' + geprueft);
console.log('  Geprueft    : Wort-Ampel-Paarung an jeder Grenze, Monotonie,');
console.log('                der Riegel ohne Ziel, zwei Gegenproben, der Skalensatz');
console.log('  NICHT       : ob der Satz im Browser ANKOMMT — das ist ein');
console.log('                Staging-Abnahmepunkt (composeOpinion, Kachel-title)');
console.log('');
console.log(rot === 0 ? 'SAUBER — Wort und Ampel sagen an jeder Grenze dasselbe.'
                      : 'ROT — ' + rot + ' Befund(e).');
process.exit(rot ? 1 : 0);
