/* gnotkg-pruefen.mjs — v3088 · prüft frontend/js/gnotkg.js (die ECHTE Datei) gegen
   GNotKG Anlage 2, Tabelle B (gesetze-im-internet.de, gelesen 02.11.2026), und die
   daraus gerechneten Anteile am Kaufpreis. RC=0 sauber.
   Ändert der Gesetzgeber die Tabelle (Entwurf: Anpassung zum 01.01.2027), wird dieser
   Prüfer rot - dann STUFEN in gnotkg.js und die Sollwerte hier neu aus Anlage 2. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const G = require('../frontend/js/gnotkg.js');
const SOLL = { 500: 15, 2000: 27, 10000: 75, 50000: 165, 100000: 273, 200000: 435, 300000: 635, 500000: 935, 1000000: 1735 };
let rot = 0;
for (const [w, s] of Object.entries(SOLL)) {
  const ist = G.tabelleB(Number(w));
  if (ist !== s) { rot++; console.log(`ROT Tabelle B ${w} €: ${ist} statt ${s}`); }
}
const ANTEIL = [[150000, 1.17, 0.59], [300000, 1.03, 0.53], [500000, 0.90, 0.47]];
for (const [kp, n, g] of ANTEIL) {
  const a = G.notar(kp, kp).pct, b = G.grundbuch(kp, kp).pct;
  if (a !== n || b !== g) { rot++; console.log(`ROT ${kp} €: Notar ${a} (Soll ${n}), Grundbuch ${b} (Soll ${g})`); }
}
if (G.notar(0, 0) !== null || G.notar(300000, 0).pct >= G.notar(300000, 300000).pct) { rot++; console.log('ROT Randfälle (kein Kaufpreis / Barkauf)'); }
console.log(rot ? `ROT — ${rot} Abweichung(en)` : `GRÜN — Tabelle B (${Object.keys(SOLL).length} Werte) und Anteile (${ANTEIL.length} Kaufpreise) stimmen.`);
process.exit(rot ? 1 : 0);
