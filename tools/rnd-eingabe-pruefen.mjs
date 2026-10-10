/* v2073 · Prueft die ECHTE rnd-calc.js mit den ECHTEN Objekten aus dem
   Portfolio-Export. Kein Nachbau, keine Fixture - sonst messe ich mich
   selbst (Memory: pruefer-der-sich-selbst-misst). */
import fs from 'fs';
import vm from 'vm';

const KERN = './frontend/js/rnd-calc.js';
const TAB = './frontend/js/rnd-gnd-table.js';
const EXPORT = (process.argv[2] || './Dateien/API-Export/portfolio-20261010-1045.json');

const ctx = { window: {}, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(TAB, 'utf8'), ctx);
vm.runInContext(fs.readFileSync(KERN, 'utf8'), ctx);
const RND = ctx.window.DealPilotRND;
if (!RND) { console.error('FEHLER: Kern nicht geladen'); process.exit(1); }

let fehler = 0;
const pruef = (name, ist, soll, cmp) => {
  const ok = cmp ? cmp(ist, soll) : ist === soll;
  if (!ok) { fehler++; console.log('  FEHLT  ' + name + ': ist ' + JSON.stringify(ist) + ', soll ' + JSON.stringify(soll)); }
  else console.log('  ok     ' + name + ' = ' + JSON.stringify(ist));
  return ok;
};

console.log('Kern geladen, VERSION ' + RND.VERSION);
console.log('Neue Exporte vorhanden: ' +
  ['punkteAusMod', 'istKernsaniert', 'gndAusObjektTyp', 'MOD_MAX']
    .map(k => k + '=' + (typeof RND[k])).join(', '));

/* ═══ 1 · Die drei Ableitungen einzeln ═══ */
console.log('\n=== 1 · gndAusObjektTyp (Marcels Festlegung: ETW/MFH = 80) ===');
pruef('ETW', RND.gndAusObjektTyp('ETW'), 80);
pruef('Eigentumswohnung', RND.gndAusObjektTyp('Eigentumswohnung'), 80);
pruef('MFH', RND.gndAusObjektTyp('MFH'), 80);
pruef('EFH', RND.gndAusObjektTyp('EFH'), 80);
pruef('Buerogebaeude', RND.gndAusObjektTyp('Bürogebäude'), 60);
pruef('Hotel', RND.gndAusObjektTyp('Hotel'), 40);
pruef('leer -> 80', RND.gndAusObjektTyp(''), 80);

console.log('\n=== 2 · punkteAusMod ===');
const modVoll = { dach: '< 5 Jahre', fenster: '< 5 Jahre', leitungen: '< 5 Jahre',
  heizung: '< 5 Jahre', aussenwand: '< 5 Jahre', baeder: '< 5 Jahre',
  innenausbau: '< 5 Jahre', grundriss: '< 5 Jahre' };
pruef('alles frisch = 20', RND.punkteAusMod(modVoll).total, 20);
pruef('leer = 0', RND.punkteAusMod({}).total, 0);
pruef('nur Dach frisch = 4', RND.punkteAusMod({ dach: '< 5 Jahre' }).total, 4);
pruef('Dach 5-10 J = 3', RND.punkteAusMod({ dach: '5 - 10 Jahre' }).total, 3);
pruef('Dach 10-20 J = 2', RND.punkteAusMod({ dach: '10 - 20 Jahre' }).total, 2);
pruef('Dach >20 J = 0', RND.punkteAusMod({ dach: '> 20 Jahre' }).total, 0);
pruef('Kernsanierung erkannt', RND.istKernsaniert({ dach: 'Kernsanierung' }), true);
pruef('keine Kernsanierung', RND.istKernsaniert({ dach: '< 5 Jahre' }), false);

/* Gegenprobe: identisch mit der Wizard-Fassung? */
const wz = fs.readFileSync('./frontend/js/rnd-wizard.js', 'utf8');
const mWz = wz.match(/const max = \{[^}]+\}/);
console.log('\n  Wizard-Hoechstpunkte: ' + (mWz ? mWz[0].replace(/\s+/g, ' ') : 'nicht gefunden'));
console.log('  Kern-Hoechstpunkte:   ' + JSON.stringify(RND.MOD_MAX));

/* ═══ 3 · Das echte Objekt 2026-001 ═══ */
console.log('\n=== 3 · Objekt 2026-001 (ETW, Bj 1962, mod_punkte 11) ===');
const exp = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
const o = exp.objekte.find(x => x.nummer === '2026-001');
if (!o) { console.error('Objekt nicht im Export'); process.exit(1); }
console.log('  Rohdaten: baujahr=' + o.daten.baujahr + ' objart=' + o.daten.objart
  + ' mod_punkte=' + o.daten.mod_punkte + ' kaufdat=' + o.daten.kaufdat);

const vorher = { gnd: 70, modPoints: 0, stichtag: o.daten.kaufdat };
const m = RND.mapDealPilotObject(o.daten);
console.log('\n  Abbildung JETZT:');
pruef('gnd', m.gnd, 80);
pruef('modPoints', m.modPoints, 11);
pruef('kernsaniert gesetzt', typeof m.kernsaniert, 'boolean');
pruef('stichtag != Kaufdatum', m.stichtag !== o.daten.kaufdat, true);
console.log('  stichtag        = ' + m.stichtag + '   (' + m.stichtag_herkunft + ')');
console.log('  gnd_herkunft    = ' + m.gnd_herkunft);
console.log('  modPoints_herk. = ' + m.modPoints_herkunft);
console.log('  vorher waere es gewesen: gnd=' + vorher.gnd + ' modPoints=' + vorher.modPoints
  + ' stichtag=' + vorher.stichtag);

console.log('\n  Ergebnis mit der reparierten Eingabe:');
const r = RND.calcAll(m);
console.log('  final_rnd    = ' + r.final_rnd + '   (' + r.final_source + ')');
console.log('  verfahren    = ' + r.verfahren);
console.log('  Punktraster  = ' + (r.methods.punktraster ? r.methods.punktraster.restnutzungsdauer : '-'));
console.log('  pruefung     = ' + JSON.stringify(r.pruefung));

/* Gegenprobe: mit den ALTEN Defaults */
const rAlt = RND.calcAll(Object.assign({}, m, { gnd: 70, modPoints: 0, stichtag: o.daten.kaufdat }));
console.log('  >> mit den alten Defaults waere es: ' + rAlt.final_rnd
  + ' (' + rAlt.verfahren + ')  --  Unterschied ' + (r.final_rnd - rAlt.final_rnd).toFixed(1) + ' Jahre');

/* ═══ 4 · AfA-Zweck: Stichtag = wirtschaftlicher Uebergang ═══ */
console.log('\n=== 4 · zweck "afa" nimmt den wirtschaftlichen Uebergang ===');
const mAfa = RND.mapDealPilotObject(o.daten, { zweck: 'afa' });
console.log('  stichtag = ' + mAfa.stichtag + '  (' + mAfa.stichtag_herkunft + ')');
const mFest = RND.mapDealPilotObject(o.daten, { stichtag: '2024-01-01' });
pruef('ausdruecklicher Stichtag gewinnt', mFest.stichtag, '2024-01-01');
const mGnd = RND.mapDealPilotObject(o.daten, { gnd: 70 });
pruef('ausdrueckliche GND gewinnt', mGnd.gnd, 70);

/* ═══ 5 · Alter >= GND: Basis 0, Pruefung erzwungen, KEINE Extrapolation ═══ */
console.log('\n=== 5 · Alter >= GND (Marcels Punkte 3 und 4) ===');
for (const bj of [1930, 1900]) {
  const rr = RND.calcAll({ baujahr: bj, stichtag: '2026-10-10', gnd: 80, modPoints: 11,
    gewerkeBewertung: {}, schaeden: [] });
  console.log('  Bj ' + bj + ' (Alter ' + (2026 - bj) + '): final=' + rr.final_rnd
    + ' | gesperrt=' + rr.pruefung.uebernahme_gesperrt
    + ' | grund=' + rr.pruefung.grund);
  if (rr.final_rnd !== 0) { fehler++; console.log('    FEHLT: sollte 0 sein (keine Extrapolation)'); }
  if (!rr.pruefung.erforderlich) { fehler++; console.log('    FEHLT: Pruefung muss erforderlich sein'); }
  if (!rr.pruefung.uebernahme_gesperrt) { fehler++; console.log('    FEHLT: Uebernahme muss gesperrt sein'); }
}
/* Die Sperre loest sich mit einer dokumentierten reellen RND */
const rReell = RND.calcAll({ baujahr: 1900, stichtag: '2026-10-10', gnd: 80, modPoints: 11,
  gewerkeBewertung: {}, schaeden: [], reelleRND: 25 });
pruef('reelle RND loest die Sperre', rReell.pruefung.uebernahme_gesperrt, false);
pruef('reelle RND wird uebernommen', rReell.final_rnd, 25);

/* ═══ 6 · Punkt 5: die beiden verbotenen Behauptungen ═══ */
console.log('\n=== 6 · Verbotene Formulierungen (Marcels Punkt 5) ===');
const quell = fs.readFileSync(KERN, 'utf8');
const ohneKomm = quell.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
pruef('"Anlage 2 nicht anwendbar" raus (Nutztext)', /Anlage 2 nicht anwendbar/.test(ohneKomm), false);
pruef('"nicht anwendbar" als finalSource raus', /finalSource = [^;]*nicht anwendbar/.test(ohneKomm), false);
pruef('30-%-Anker bleibt', /unter_30_prozent/.test(ohneKomm), true);
pruef('185 BewG bleibt', /185 Abs\. 3/.test(quell), true);

/* ═══ 7 · Alle Objekte: wie viele aendern sich? ═══ */
console.log('\n=== 7 · Alle 23 Objekte: Wirkung der Reparatur ===');
let geaendert = 0, gleich = 0, punkteJetzt = 0, gnd80 = 0;
const zeilen = [];
for (const ob of exp.objekte) {
  if (!ob.daten || !ob.daten.baujahr) continue;
  const mm = RND.mapDealPilotObject(ob.daten);
  const neu = RND.calcAll(mm);
  const alt = RND.calcAll(Object.assign({}, mm, { gnd: 70, modPoints: 0, stichtag: ob.daten.kaufdat }));
  if (mm.modPoints > 0) punkteJetzt++;
  if (mm.gnd === 80) gnd80++;
  if (Math.abs(neu.final_rnd - alt.final_rnd) > 0.05) {
    geaendert++;
    zeilen.push([ob.nummer, ob.daten.baujahr, mm.modPoints, mm.gnd,
      alt.final_rnd.toFixed(1), neu.final_rnd.toFixed(1),
      (neu.final_rnd - alt.final_rnd).toFixed(1), neu.pruefung.erforderlich ? 'Pruefung' : '']);
  } else gleich++;
}
console.log('Nr        | Bj   | Pkt | GND | alt    | neu    | Diff   | Hinweis');
for (const z of zeilen) console.log(
  String(z[0]).padEnd(9) + ' | ' + String(z[1]).padEnd(4) + ' | ' + String(z[2]).padStart(3)
  + ' | ' + String(z[3]).padStart(3) + ' | ' + String(z[4]).padStart(6) + ' | '
  + String(z[5]).padStart(6) + ' | ' + String(z[6]).padStart(6) + ' | ' + z[7]);
console.log('\nObjekte mit Punkten > 0: ' + punkteJetzt + ' | mit GND 80: ' + gnd80
  + ' | Ergebnis geaendert: ' + geaendert + ' | unveraendert: ' + gleich);

console.log('\n' + (fehler === 0 ? 'RC=0 - alle Pruefungen bestanden' : 'RC=1 - ' + fehler + ' Pruefung(en) gescheitert'));
process.exit(fehler === 0 ? 0 : 1);
