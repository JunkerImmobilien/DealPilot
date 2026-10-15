#!/usr/bin/env node
/* tools/bauzins-pruefen.mjs — v2245
 *
 * Laesst den ECHTEN Dienst (backend/src/services/bauzinsService.js)
 * gegen die ECHTE Bundesbank-API laufen, ohne Datenbank, und gibt die
 * Bausteine und Ergebnisse aus. Prueft dazu die Formel an den Stuetzstellen.
 *
 *   node tools/bauzins-pruefen.mjs           Abruf + Ausgabe, RC=0 wenn plausibel
 *   node tools/bauzins-pruefen.mjs --offline nur Formel/Stuetzstellen + statischer Stand
 *
 * Plausibel heisst: alle vier Laufzeiten haben Bund + Aufschlag, 10 J / 80 %
 * liegt zwischen 2 und 7 %, und der Zins steigt mit der Beleihung.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bz = require(path.join(WURZEL, 'backend', 'src', 'services', 'bauzinsService.js'));

let fehler = 0;
function pruef(ok, text) { console.log((ok ? '  ok   ' : '  FEHL ') + text); if (!ok) fehler++; }
const pz = (x) => (x == null ? '–' : x.toFixed(2).replace('.', ','));

console.log('Formel: Zuschlag Z(LTV) an den Stuetzstellen und dazwischen');
[[50, -0.20], [60, -0.20], [65, -0.15], [70, -0.10], [80, 0], [85, 0.11], [90, 0.22], [95, 0.335], [100, 0.45], [105, 0.70], [110, 0.95], [130, 0.95]]
  .forEach(([l, soll]) => pruef(Math.abs(bz.zuschlagLtv(l) - soll) < 1e-9, 'Z(' + l + ' %) = ' + bz.zuschlagLtv(l) + ' (soll ' + soll + ')'));
pruef(bz.zinsFuer(3.51, 0.56, 80) === 4.34, 'Kalibrierpunkt 3,51 + 0,56 + K(0,27) bei 80 % = 4,34');

function ausgeben(e, titel) {
  console.log('\n' + titel + ' (quelle ' + e.quelle + ')');
  console.log('  K = ' + e.formel.k + ' (Stand ' + e.formel.k_stand + '), Aufschlag-Monat ' + e.formel.aufschlag_monat);
  for (const b of e.maturities) {
    const f = e.formel;
    const ir = e.indicativeRates[b];
    const z = (l) => bz.zinsFuer(f.bund[b], f.aufschlag[b], l);
    console.log('  ' + b.padStart(2) + ' J  Bund ' + pz(f.bund[b]) + ' (' + (f.bund_datum[b] || '–') + ')  MFI ' + pz(f.mfi[b]) +
      '  A ' + pz(f.aufschlag[b]) + '  |  60 % ' + pz(z(60)) + '  70 % ' + pz(z(70)) + '  80 % ' + pz(z(80)) +
      '  90 % ' + pz(z(90)) + '  100 % ' + pz(z(100)) + '  110 % ' + pz(z(110)));
    pruef(ir && ir.standard === z(80) && ir.premium === z(60) && ir.schwach === z(90), b + ' J: Stufen = 60/80/90 %');
    pruef(z(60) < z(80) && z(80) < z(90) && z(90) < z(100), b + ' J: steigt mit der Beleihung');
  }
}

ausgeben(bz.berechnen((() => {
  const s = bz.STATISCHER_STAND, tage = {}, monate = {};
  for (const b of bz.LAUFZEITEN) {
    tage[b] = [{ datum: s.datum, bund: s.bund[b], pfandbrief: null }];
    monate[b] = [{ monat: s.aufschlag_monat, mfi: null, bund_avg: null, aufschlag: s.aufschlag[b] }];
  }
  return { tage, monate, quelle: 'static' };
})()), 'Statischer Stand');

if (!process.argv.includes('--offline')) {
  const t0 = Date.now();
  const daten = await bz.abrufenLive({});
  const e = bz.berechnen(daten);
  console.log('\nAbruf ' + (Date.now() - t0) + ' ms, Tage je Laufzeit: ' + bz.LAUFZEITEN.map((b) => b + 'J ' + daten.tage[b].length).join(', ') +
    ', Monate: ' + bz.LAUFZEITEN.map((b) => b + 'J ' + daten.monate[b].length).join(', '));
  ausgeben(e, 'Live Bundesbank');
  pruef(e.fehlt.length === 0, 'alle Laufzeiten vollstaendig');
  const s10 = e.indicativeRates['10'] && e.indicativeRates['10'].standard;
  pruef(s10 > 2 && s10 < 7, '10 J / 80 % = ' + pz(s10) + ' im plausiblen Band');
  console.log('\n  Monatsaufschlag 10 J (MFI O - Schnitt Bund 10):');
  e.verlauf.monate.forEach((m) => console.log('    ' + m.monat + '  MFI ' + pz(m.mfi) + '  Bund ' + pz(m.bund_avg) + '  A ' + pz(m.aufschlag)));
  console.log('  Wochen (Modell 10 J/80 % minus Wochenschnitt Bund 10):');
  e.verlauf.wochen.forEach((w) => console.log('    ' + w.woche + '  Bund ' + pz(w.bund10) + '  Modell ' + pz(w.bauzins10) + '  Aufschlag ' + pz(w.aufschlag) +
    ' (' + w.aufschlag_monat + ')  Pfandbrief-Abstand ' + pz(w.pfandbrief_spread)));
  const A = e.verlauf.monate.map((m) => m.aufschlag);
  if (A.length) console.log('  Spanne Aufschlag 10 J: ' + pz(Math.min(...A)) + ' bis ' + pz(Math.max(...A)) + ' ueber ' + A.length + ' Monate');
}

console.log('\n' + (fehler ? 'ROT: ' + fehler + ' Befund(e)' : 'SAUBER'));
process.exit(fehler ? 1 : 0);
