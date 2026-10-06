import { sachwertfaktor } from '../src/lib/gutachterausschuss.js';
import { readFileSync, readdirSync } from 'fs';

console.log('=== PRUEFLAEUFER GND-KETTE (echte Datei, echte Funktion) ===\n');

// 1 · Oberursel SCHARF: achse_feld ist "sachwert"
const r = sachwertfaktor({ ags: '06434011', zweig: 'ezfh', sachwert: 500000 });
console.log('Oberursel 06434011 ezfh, vorl. Sachwert 500.000 EUR');
console.log('  verfuegbar        =', r && r.verfuegbar);
console.log('  faktor            =', r && (r.wert ?? r.faktor));
console.log('  modell_gnd_jahre  =', r && r.modell_gnd_jahre, '  <- MUSS 70 sein');
console.log('  grund             =', r && (r.grund || '-'));

// 2 · Gegenprobe: echter Ausschuss-Satz OHNE GND-Feld
const dir = '../src/lib/register';
let gegen = null;
for (const f of readdirSync(dir).filter(x => x.endsWith('.json'))) {
  let a; try { a = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
  if (!Array.isArray(a)) continue;
  for (const x of a) {
    if (x.kennzahl !== 'sachwertfaktor' || !x.formel) continue;
    if (!x.ags || String(x.ags).length < 5) continue;
    if (x.formel.form !== 'stufen_1d') continue;
    const m = x.modellansaetze || {};
    if (m.gnd_jahre != null || m.gesamtnutzungsdauer_jahre != null || m.gnd != null) continue;
    gegen = x; break;
  }
  if (gegen) break;
}
if (gegen) {
  const achse = gegen.formel.achse_feld;
  const stufen = Object.keys(gegen.formel.stufen || {});
  const mitte = Number(stufen[Math.floor(stufen.length / 2)]);
  const g = sachwertfaktor({ ags: gegen.ags, zweig: gegen.zweig, [achse]: mitte });
  console.log('\nGegenprobe', gegen.ags, gegen.zweig, '(' + String(gegen.gebiet_name).slice(0, 34) + ')');
  console.log('  Achse', achse, '=', mitte);
  console.log('  verfuegbar        =', g && g.verfuegbar);
  console.log('  modell_gnd_jahre  =', g && g.modell_gnd_jahre, '  <- null = Rueckfall 80 greift');
}

// 3 · Deckung
let n = 0, mit = 0, text = 0; const vt = {};
for (const f of readdirSync(dir).filter(x => x.endsWith('.json'))) {
  let a; try { a = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
  if (!Array.isArray(a)) continue;
  for (const x of a) {
    if (x.kennzahl !== 'sachwertfaktor' || !x.formel) continue;
    n++;
    const m = x.modellansaetze || {};
    const roh = (m.gnd_jahre != null) ? m.gnd_jahre
              : (m.gesamtnutzungsdauer_jahre != null) ? m.gesamtnutzungsdauer_jahre
              : (m.gnd != null) ? m.gnd : null;
    if (roh == null) continue;
    if (Number.isFinite(Number(roh)) && Number(roh) > 0) { mit++; vt[Number(roh)] = (vt[Number(roh)] || 0) + 1; } else text++;
  }
}
console.log('\n=== DECKUNG ===');
console.log('  SWF-Saetze mit Wert geprueft :', n, '(= 100 %)');
console.log('  GND als ZAHL                 :', mit, JSON.stringify(vt));
console.log('  GND-Feld als TEXT -> null    :', text);
console.log('  ohne GND-Feld     -> null    :', n - mit - text);
