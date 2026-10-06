import { sachwertfaktor, liegenschaftszinssatz } from '../src/lib/gutachterausschuss.js';
console.log('=== KETTENPRUEFUNG: erreicht die Rostock-Sperre den Rechenweg? ===\n');
let ok = 0, fehl = 0;
const faelle = [
  ['sachwertfaktor', 'ezfh'], ['sachwertfaktor', 'rhdhh'],
  ['liegenschaftszinssatz', 'ezfh'], ['liegenschaftszinssatz', 'mfh'],
  ['liegenschaftszinssatz', 'we_v'], ['liegenschaftszinssatz', 'ggg'],
];
for (const [kz, zweig] of faelle) {
  const f = kz === 'sachwertfaktor' ? sachwertfaktor : liegenschaftszinssatz;
  const r = f({ ags: '13072', zweig, sachwert: 300000 });
  const traegtWeg = JSON.stringify(r || {}).includes('gaa@lkros.de');
  const nennt = JSON.stringify(r || {}).includes('Landkreis Rostock');
  const gut = r && r.verfuegbar === false && traegtWeg && nennt;
  console.log((gut ? 'OK  ' : 'FEHL') + '  ' + kz + '/' + zweig
    + ' | verfuegbar=' + (r && r.verfuegbar)
    + ' | grund=' + (r && r.grund)
    + ' | Weg zum Wert=' + traegtWeg + ' | Ausschuss genannt=' + nennt);
  gut ? ok++ : fehl++;
}
console.log('\nGegenprobe: Nachbarkreis 13071 darf NICHT antworten wie 13072');
const nb = sachwertfaktor({ ags: '13071', zweig: 'ezfh', sachwert: 300000 });
console.log('  13071 traegt Rostock-Text?', JSON.stringify(nb || {}).includes('gaa@lkros.de'), '(muss false sein)');
console.log('\n=== DECKUNG: ' + (ok + fehl) + ' von 6 Saetzen geprueft (= 100 %), OK=' + ok + ' FEHL=' + fehl + ' ===');
process.exit(fehl ? 1 : 0);
