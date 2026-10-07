/* ══════════════════════════════════════════════════════════════════════
   score-ketten-pruefen.mjs   (v1950)

   WOZU: CLAUDE.md sagt „Die Kette steht an EINER Stelle: js/score-tiers.js".
   Tatsaechlich gibt es drei Kopien, und zwei davon MUESSEN es bleiben:

     frontend/js/score-tiers.js            die Quelle (Haupt-App, Quick-Check)
     frontend/marktbericht-app/app.js      eigenes Dokument, Rueckfall fuers PDF
     backend/src/services/
       telegramDialogService.js            eigenes Image ohne frontend/

   Das Backend-Image kopiert `frontend/` NICHT (backend/Dockerfile holt nur
   src, templates, migrations, seed-data, scripts). Ein gemeinsames Modul zur
   Laufzeit gibt es ohne Bauschritt also nicht. **Zwei Kopien sind erlaubt,
   solange sie nachweisbar gleich sind** - und das ist der Zweck hier.

   WIE: jede Kette wird aus ihrer ECHTEN Datei geholt, nicht nachgebaut.
   - score-tiers.js wird geladen (es exportiert seit v1950 auch nach node)
   - die beiden anderen Funktionen werden als QUELLTEXT ausgeschnitten und
     ausgefuehrt; der Schnitt wird gezaehlt, ein Fehlschnitt bricht ab.

   Der Lauf nennt seine DECKUNG. Ein Pruefer, der nicht sagt, wie viel er
   gemessen hat, kann gruen werden, ohne etwas angesehen zu haben - so hat
   der Gold-Audit einmal 6 statt 181 Dateien gelesen.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const rot = (t) => '\x1b[31m' + t + '\x1b[0m';
const gruen = (t) => '\x1b[32m' + t + '\x1b[0m';

/* ── Quelle 1 · score-tiers.js, echt geladen ─────────────────────────── */
const ScoreTier = require('../frontend/js/score-tiers.js');
if (typeof ScoreTier.stufe !== 'function') {
  console.error(rot('ABBRUCH: score-tiers.js exportiert kein stufe().'));
  process.exit(1);
}

/* ── Quelle 2 · _scoreTier aus der Marktbericht-App ──────────────────── */
/* Ausgeschnitten statt nachgebaut. Gemessen wird der RUECKFALL (ohne
   window.ScoreTier) - der Pfad MIT der Kette ist trivial richtig, der ohne
   sie ist der, der im PDF auch ohne das Blatt drucken muss. */
const mbQuelle = fs.readFileSync(new URL('../frontend/marktbericht-app/app.js', import.meta.url), 'utf8');
const mbTreffer = mbQuelle.match(/function _scoreTier\(s\)\s*\{[\s\S]*?\n\}/g) || [];
if (mbTreffer.length !== 1) {
  console.error(rot('ABBRUCH: _scoreTier ' + mbTreffer.length + 'x gefunden, erwartet 1x.'));
  process.exit(1);
}
const mbCtx = { window: {} };              /* kein ScoreTier -> Rueckfall */
vm.createContext(mbCtx);
vm.runInContext(mbTreffer[0] + '; this.__f = _scoreTier;', mbCtx);
const mbStufe = mbCtx.__f;

/* ── Quelle 3 · stufeZu aus dem Telegram-Dienst ──────────────────────── */
/* Die Datei verlangt ../db/pool und ./openaiService - ein require wuerde
   eine Datenbankverbindung aufbauen. Deshalb nur die Funktion, ebenfalls
   ausgeschnitten und gezaehlt. */
const botQuelle = fs.readFileSync(new URL('../backend/src/services/telegramDialogService.js', import.meta.url), 'utf8');
const botTreffer = botQuelle.match(/function stufeZu\(score\)\s*\{[\s\S]*?\n\}/g) || [];
if (botTreffer.length !== 1) {
  console.error(rot('ABBRUCH: stufeZu ' + botTreffer.length + 'x gefunden, erwartet 1x.'));
  process.exit(1);
}
const botCtx = {};
vm.createContext(botCtx);
vm.runInContext(botTreffer[0] + '; this.__f = stufeZu;', botCtx);
const botStufe = botCtx.__f;

/* ── Vergleich ───────────────────────────────────────────────────────── */
let gemessen = 0, fehler = 0;
const abw = [];

for (let s = 0; s <= 100; s++) {
  const soll = ScoreTier.stufe(s);
  const mb = mbStufe(s);
  const bot = botStufe(s);
  gemessen++;
  if (mb !== soll.wort) { fehler++; abw.push('  Score ' + s + ': Marktbericht "' + mb + '" statt "' + soll.wort + '"'); }
  if (bot !== soll.versal) { fehler++; abw.push('  Score ' + s + ': Bot "' + bot + '" statt "' + soll.versal + '"'); }
}

/* Die Grenzen ausdruecklich, beide Seiten - ein Vergleich ueber 0..100 in
   Einerschritten trifft 85 und 84, aber nicht 84.9 */
const grenzen = [-1, 0, 34, 34.9, 35, 49.9, 50, 69.9, 70, 84.9, 85, 100, 101];
for (const s of grenzen) {
  const soll = ScoreTier.stufe(s);
  const mb = mbStufe(s), bot = botStufe(s);
  gemessen++;
  if (s >= 0 && mb !== soll.wort) { fehler++; abw.push('  Grenze ' + s + ': Marktbericht "' + mb + '" statt "' + soll.wort + '"'); }
  if (s >= 0 && bot !== soll.versal) { fehler++; abw.push('  Grenze ' + s + ': Bot "' + bot + '" statt "' + soll.versal + '"'); }
}

/* Abwesenheit: null/undefined darf nicht als 0 durchrutschen */
const leerSoll = ScoreTier.stufe(null).wort;
gemessen++;
if (leerSoll !== '–') { fehler++; abw.push('  score-tiers.js: stufe(null) ergibt "' + leerSoll + '", erwartet einen Gedankenstrich'); }
if (botStufe(null) !== null) { fehler++; abw.push('  Bot: stufeZu(null) ergibt "' + botStufe(null) + '", erwartet null'); }

console.log('');
console.log('Quellen: 3 (score-tiers.js, marktbericht-app/app.js, telegramDialogService.js)');
console.log('DECKUNG: ' + gemessen + ' Vergleichspunkte (0..100 plus 13 Grenzen plus Abwesenheit)');
console.log('');
console.log('Die Kette aus score-tiers.js:');
for (const s of [92, 78, 60, 40, 12]) {
  const t = ScoreTier.stufe(s);
  console.log('  ' + String(s).padStart(3) + '  ' + t.wort.padEnd(10) + t.versal.padEnd(10) + t.farbe);
}
console.log('');

if (fehler) {
  console.log(rot(fehler + ' ABWEICHUNGEN:'));
  console.log(abw.slice(0, 20).join('\n'));
  if (abw.length > 20) console.log('  … und ' + (abw.length - 20) + ' weitere');
  process.exit(1);
}
console.log(gruen('ALLE DREI KETTEN GLEICH (' + gemessen + ' Punkte)'));
