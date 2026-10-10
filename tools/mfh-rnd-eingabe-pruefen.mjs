/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/mfh-rnd-eingabe-pruefen.mjs · v2095
   Backlog N60.10

   Prueft, was die Einheiten-RND im MFH-Assistenten dem Kern uebergibt.

   ER LAEDT DEN ECHTEN KERN (frontend/js/rnd-calc.js) und ruft die ECHTE
   calcAll(). Keine zweite Rechnung, kein Nachbau - sonst messe ich mich
   selbst (Memory: pruefer-der-sich-selbst-misst).

   Zwei Fragen:
     1 · Macht `kernsaniert` einen Unterschied? (Wie teuer war der Mangel?)
     2 · Macht der `stichtag` einen Unterschied?
     3 · Nennt mfh-einheiten.js die Felder jetzt wirklich?

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'vm';

let fehler = 0, geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

/* ── Den echten Kern laden ─────────────────────────────────────────── */
const quelle = fs.readFileSync('frontend/js/rnd-calc.js', 'utf8');
const sandbox = { window: {}, document: undefined, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(quelle, sandbox, { filename: 'rnd-calc.js' });
const RND = sandbox.window.DealPilotRND;
if (!RND || typeof RND.calcAll !== 'function') {
  console.error('rnd-calc.js hat DealPilotRND.calcAll nicht bereitgestellt');
  process.exit(1);
}
console.log('Kern geladen: ' + Object.keys(RND).length + ' Exporte');

const rnd = (inp) => {
  const r = RND.calcAll(inp);
  return (r && r.methods && r.methods.punktraster)
    ? r.methods.punktraster.restnutzungsdauer
    : (r ? r.final_rnd : null);
};

/* ── 1 · Wie teuer war das fehlende `kernsaniert`? ─────────────────── */
console.log('\n=== 1 · kernsaniert: die Kappe 0,70 gegen 0,90 ===');
const faelle = [
  { name: 'Bj 1960, GND 80, 12 Punkte', baujahr: 1960, gnd: 80, modPoints: 12 },
  { name: 'Bj 1975, GND 80, 18 Punkte', baujahr: 1975, gnd: 80, modPoints: 18 },
  { name: 'Bj 1950, GND 80, 20 Punkte', baujahr: 1950, gnd: 80, modPoints: 20 },
  { name: 'Bj 1990, GND 70, 10 Punkte', baujahr: 1990, gnd: 70, modPoints: 10 }
];
let wirktIrgendwo = 0;
console.log('  Fall                           ohne    mit     Unterschied');
for (const f of faelle) {
  const basis = { baujahr: f.baujahr, stichtag: '2026-01-01', gnd: f.gnd, modPoints: f.modPoints };
  const ohne = rnd(basis);
  const mit = rnd(Object.assign({}, basis, { kernsaniert: true }));
  const diff = (mit != null && ohne != null) ? (mit - ohne) : null;
  if (diff) wirktIrgendwo++;
  console.log('  ' + f.name.padEnd(30)
    + String(ohne).padEnd(8) + String(mit).padEnd(8)
    + (diff ? (diff > 0 ? '+' : '') + diff.toFixed(1) + ' Jahre' : 'kein'));
}
melde(wirktIrgendwo > 0,
  '`kernsaniert` aendert das Ergebnis in ' + wirktIrgendwo + ' von ' + faelle.length
  + ' Faellen — der Mangel war also echt');

/* Die Kappe selbst nachrechnen: 0,70 bzw. 0,90 der GND */
console.log('\n  Die Kappe, an einem Neubau gemessen (Alter 0, 20 Punkte):');
for (const gnd of [70, 80]) {
  const basis = { baujahr: 2026, stichtag: '2026-01-01', gnd: gnd, modPoints: 20 };
  const ohne = rnd(basis), mit = rnd(Object.assign({}, basis, { kernsaniert: true }));
  console.log('    GND ' + gnd + ': ohne ' + ohne + ' (' + (ohne / gnd * 100).toFixed(0) + ' %)'
    + ', mit ' + mit + ' (' + (mit / gnd * 100).toFixed(0) + ' %)');
  melde(mit >= ohne, 'GND ' + gnd + ': mit Kernsanierung nicht kleiner als ohne');
}

/* ── 2 · Macht der Stichtag einen Unterschied? ─────────────────────── */
console.log('\n=== 2 · stichtag: heute gegen einen Stichtag in der Vergangenheit ===');
const b2 = { baujahr: 1960, gnd: 80, modPoints: 12 };
const heute = rnd(Object.assign({}, b2, { stichtag: '2026-10-10' }));
const frueher = rnd(Object.assign({}, b2, { stichtag: '2019-01-01' }));
console.log('  Stichtag 2026-10-10: ' + heute + ' Jahre');
console.log('  Stichtag 2019-01-01: ' + frueher + ' Jahre');
melde(heute !== frueher,
  'Der Stichtag aendert das Ergebnis (' + (frueher - heute).toFixed(1)
  + ' Jahre) — ihn auf heute festzunageln war also ein echter Fehler');

/* ── 3 · Nennt mfh-einheiten.js die Felder jetzt? ─────────────────── */
console.log('\n=== 3 · Der Aufrufer, am kommentarfreien Text geprueft ===');
const mfhRoh = fs.readFileSync('frontend/js/mfh-einheiten.js', 'utf8');
/* Der Pruefer darf sein eigenes Zitat nicht finden: die Begruendung steht
   im Kommentar (Memory: pruefer-findet-eigenes-zitat). */
const mfh = mfhRoh.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

melde(!/stichtag: new Date\(\)\.toISOString\(\)\.slice\(0, 10\), gnd: gnd\(\)/.test(mfh),
  'Der alte Vierzeiler-Aufruf steht nicht mehr im Code');
melde(/mapDealPilotObject\(window\.collectData\(\)\)/.test(mfh),
  'Die Rangfolge wird GEHOLT (mapDealPilotObject(collectData()))');
melde(/function rndBasis/.test(mfh), 'rndBasis() existiert');
/* Die DEFINITION nicht mitzaehlen: `function rndBasis()` enthaelt
   `rndBasis()` ebenfalls. Der erste Entwurf zaehlte 2 und meldete einen
   Fehler, den es nicht gab — ein Pruefer, der sein eigenes Vorkommen
   mitzaehlt, macht aus richtigem Code einen Mangel. */
const rufe = (mfh.match(/(?<!function\s)\brndBasis\(\)/g) || []).length;
melde(rufe === 1,
  'rndBasis() wird genau EINMAL gerufen, nicht je Einheit (Aufrufe: ' + rufe
  + ', Definition nicht gezaehlt)');
melde(/rndFuer\(p\.punkte, basis\)/.test(mfh), 'rndFuer bekommt die Basis uebergeben');
melde(/rnd: r \? r\.jahre : null/.test(mfh),
  '`rnd` bleibt eine Zahl — die zwei Verbraucher (Z. 567/589) rechnen damit');
melde(/rndInfo/.test(mfh), 'Die Herkunft reist als rndInfo daneben mit');
melde(/Notweg/.test(mfhRoh),
  'Der Notweg ohne collectData() ist als solcher BENANNT, nicht stillschweigend');

/* Die Vererbungsliste, die N60.10 verlangt - steht sie im Code? */
console.log('\n=== 4 · Die Vererbungsliste (N60.10 Kernfrage) ===');
const geb = (mfh.match(/GEB_IDS = \[([^\]]+)\]/) || [, ''])[1];
const we = (mfh.match(/WE_IDS = \[([^\]]+)\]/) || [, ''])[1];
const gebL = geb.split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean);
const weL = we.split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean);
console.log('  nur Gebaeude      : ' + gebL.join(', '));
console.log('  Einheit, sonst Geb: ' + weL.join(', '));
melde(gebL.length === 4 && weL.length === 4,
  'Vier Gewerke je Seite (' + gebL.length + '/' + weL.length + ')');
melde(gebL.every((x) => !weL.includes(x)),
  'Keine Ueberschneidung — ein Gewerk gehoert einer Seite');
const alle = (RND.MOD_ELEMENTS || []).map((x) => x.id);
melde(alle.length > 0, 'MOD_ELEMENTS ist erreichbar (' + alle.length + ' Gewerke)');
const fehlend = alle.filter((x) => !gebL.includes(x) && !weL.includes(x));
melde(fehlend.length === 0,
  'Jedes Gewerk des Kerns ist einer Seite zugeordnet'
  + (fehlend.length ? ' — FEHLT: ' + fehlend.join(', ') : ''));

/* ── 5 · Deckung ──────────────────────────────────────────────────── */
console.log('\n=== 5 · Deckung ===');
console.log('  Pruefpunkte          : ' + geprueft);
console.log('  echte calcAll-Laeufe : ' + (faelle.length * 2 + 4 + 2));
console.log('  geladen              : frontend/js/rnd-calc.js (echt)');
console.log('  gelesen              : frontend/js/mfh-einheiten.js (kommentarfrei)');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft));
process.exit(fehler === 0 ? 0 : 1);
