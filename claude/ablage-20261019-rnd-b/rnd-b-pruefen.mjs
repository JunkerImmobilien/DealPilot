// Prueft Variante B: die Website (assets/rnd) rechnet dieselbe RND wie das
// Gutachten-Modul V4.2.6 (vw/js/calc-rnd.js), stetig und im Alter monoton fallend.
// Aufruf: node rnd-b-pruefen.mjs <website-root> [<vergleich-root-alt>]
import fs from 'node:fs'; import vm from 'node:vm';
const ROOT = (process.argv[2] || '.').replace(/\\/g, '/') + '/';
const ALT = process.argv[3] ? process.argv[3].replace(/\\/g, '/') + '/' : null;
function lade(root, modul) {
  const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(root + 'assets/rnd/rnd-calc.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(root + 'assets/rnd/rnd-spanne.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(modul + 'vw/js/calc-rnd.js', 'utf8'), ctx);
  return { W: ctx.DealPilotRND, SP: ctx.JunkerRND_Spanne, M: ctx.VW_CALC_RND };
}
const MODUL = ALT || ROOT;
const neu = lade(ROOT, ROOT);
const alt = ALT ? lade(ALT, ALT) : null;
const J = 2026;
function web(k, alter, gnd, p) {
  let r = k.W.calcAll({ baujahr: J - alter, stichtag: J, gnd, modPoints: p, gewerkeBewertung: {} });
  r = k.SP.leitwertAn(r, false);
  return { rnd: r.final_rnd, v: r.verfahren, s: k.SP.spanneAus(r) };
}
const modul = (alter, gnd, p) => neu.M.berechneAlles({ alter, gnd, modErfassungsArt: 'grad', modPunkteManuell: p }).finalRnd;

let faelle = 0, abweichung = [], steigt = [], fehlt = 0, ausserhalb = [];
for (const gnd of [50, 60, 70, 80, 100]) for (let p = 0; p <= 20; p++) {
  let prev = null, prevM = null;
  for (let a = 1; a <= gnd + 40; a++) {
    faelle++;
    const w = web(neu, a, gnd, p), m = modul(a, gnd, p);
    if (!(w.rnd > 0)) fehlt++;
    if (Math.abs(w.rnd - m) > 0.011) abweichung.push({ gnd, p, a, web: w.rnd, modul: +m.toFixed(2), v: w.v });
    if (prev != null && w.rnd > prev + 0.01 && !(m > prevM + 0.01)) steigt.push({ gnd, p, a, vorher: prev, jetzt: w.rnd });
    const m2 = Math.round(m * 100) / 100; if (w.s.ok && !(w.s.von <= m2 && m2 <= w.s.bis)) ausserhalb.push({ gnd, p, a, modul: +m.toFixed(2), spanne: w.s.von + '-' + w.s.bis });
    prev = w.rnd; prevM = m;
  }
}
console.log('Faelle', faelle, '| Web != Modul:', abweichung.length, '| ohne Wert:', fehlt, '| Web steigt, Modul nicht:', steigt.length, '| Gutachtenwert ausserhalb der Spanne:', ausserhalb.length);
if (ausserhalb.length) console.log('  erste ausserhalb', ausserhalb.slice(0, 6));
if (abweichung.length) console.log('  erste Abweichungen', abweichung.slice(0, 6));
if (steigt.length) console.log('  erste Anstiege', steigt.slice(0, 6));

console.log('\nTabelle GND 80 (Leitwert / Spanne Website) neben Modul' + (alt ? ' und Website ALT' : ''));
for (const p of [0, 5, 13]) for (const a of [40, 50, 60, 72, 76, 79, 80, 85, 100]) {
  const w = web(neu, a, 80, p), m = modul(a, 80, p);
  const o = alt ? web(alt, a, 80, p) : null;
  console.log(`  P ${String(p).padStart(2)} Alter ${String(a).padStart(3)}: neu ${String(w.rnd).padStart(6)} (${w.s.ok ? w.s.von + '–' + w.s.bis : w.s.grund}, ${w.v})  Modul ${m.toFixed(2).padStart(6)}`
    + (o ? `  alt ${String(o.rnd).padStart(6)} (${o.s.ok ? o.s.von + '–' + o.s.bis : o.s.grund}, ${o.v})` : ''));
}
const ok = abweichung.length === 0 && steigt.length === 0 && fehlt === 0 && ausserhalb.length === 0;
console.log('\n' + (ok ? 'SAUBER - Website = Modul, stetig, monoton' : 'ROT'));
process.exit(ok ? 0 : 1);
