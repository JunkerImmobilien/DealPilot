/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/ankauf-abweichung-pruefen.mjs · v2098
   Backlog N60.16

   Prueft `DealPilotAnkauf.abweichungFuer(daten)` am ECHTEN Modul.

   Die eigentliche Frage ist die RICHTUNG: `KENNZAHLEN` fuehrt
   `besser: 'kleiner'` beim Kaufpreis und beim LTV, `'groesser'` bei den
   anderen sieben. Wer die Rechnung nachbaut, verdreht genau diese zwei -
   ein hoeherer Kaufpreis wuerde dann als Verbesserung gelten.

   Deshalb wird jede der neun Kennzahlen EINZELN in beide Richtungen
   geprueft: 18 Faelle, plus die Sonderfaelle.

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

/* ── Das echte Modul laden. Ersetzt wird nur, was nach aussen geht. ── */
const quelle = fs.readFileSync('frontend/js/ankauf.js', 'utf8');
const sandbox = {
  window: {}, console,
  document: { getElementById: () => null, querySelector: () => null,
              querySelectorAll: () => [], addEventListener: () => {},
              createElement: () => ({ style: {}, classList: { add() {}, remove() {} },
                                      appendChild() {}, setAttribute() {} }) },
  collectData: () => ({}),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  setTimeout: (f) => { try { f(); } catch (e) {} return 0; },
  parseDe: null
};
sandbox.globalThis = sandbox;
sandbox.window.document = sandbox.document;
sandbox.window.collectData = sandbox.collectData;
sandbox.window.localStorage = sandbox.localStorage;
/* Das Modul haengt sich am Ende an `dp:object-ready`. Ohne diese zwei
   Methoden bricht es beim Laden ab - gefunden beim ersten Lauf, und das
   ist der Unterschied zwischen `node --check` und einem echten Lauf. */
sandbox.window.addEventListener = () => {};
sandbox.window.removeEventListener = () => {};
sandbox.document.addEventListener = () => {};
vm.createContext(sandbox);
vm.runInContext(quelle, sandbox, { filename: 'ankauf.js' });

const A = sandbox.window.DealPilotAnkauf;
if (!A || typeof A.abweichungFuer !== 'function') {
  console.error('DealPilotAnkauf.abweichungFuer fehlt');
  process.exit(1);
}
console.log('Modul geladen: ' + Object.keys(A).length + ' Exporte');
melde(typeof A.abweichung === 'function', 'abweichung() gibt es weiterhin');
melde(Array.isArray(A.KENNZAHLEN) && A.KENNZAHLEN.length === 9,
  'KENNZAHLEN hat 9 Eintraege (ist: ' + (A.KENNZAHLEN || []).length + ')');

/* ── 1 · Kein Ankauf-Stand heisst null, nicht Absturz ─────────────── */
console.log('\n=== 1 · Objekte ohne Ankauf-Stand ===');
for (const [n, d] of [['null', null], ['leeres Objekt', {}],
                      ['_ankauf fehlt', { kp: 100000 }],
                      ['_ankauf ohne kurz', { kp: 1, _ankauf: {} }],
                      ['_ankauf.kurz ist Text', { kp: 1, _ankauf: { kurz: 'x' } }]]) {
  let r, krach = null;
  try { r = A.abweichungFuer(d); } catch (e) { krach = e.message; }
  melde(!krach && r === null, n + ' -> null' + (krach ? ' (ABSTURZ: ' + krach + ')' : ''));
}

/* ── 2 · Die RICHTUNG je Kennzahl, in beide Richtungen ───────────── */
console.log('\n=== 2 · Richtung je Kennzahl (18 Faelle) ===');
console.log('    Kennzahl                  besser bei   erhoeht->   gesenkt->');
for (const k of A.KENNZAHLEN) {
  const basis = {};
  const kurz = {};
  /* Alle anderen gleich halten, damit nur EINE Kennzahl sich bewegt */
  for (const kk of A.KENNZAHLEN) { basis[kk.schluessel] = 50; kurz[kk.schluessel] = 50; }
  const hoch = Object.assign({}, basis, { [k.schluessel]: 60, _ankauf: { kurz: Object.assign({}, kurz), stichtag: '2024-01-01' } });
  const tief = Object.assign({}, basis, { [k.schluessel]: 40, _ankauf: { kurz: Object.assign({}, kurz), stichtag: '2024-01-01' } });
  const rH = A.abweichungFuer(hoch), rT = A.abweichungFuer(tief);
  const zH = (rH.zeilen || []).find((z) => z.wort === k.wort);
  const zT = (rT.zeilen || []).find((z) => z.wort === k.wort);
  const erwartetHoch = (k.besser === 'groesser') ? 'besser' : 'schlechter';
  const erwartetTief = (k.besser === 'groesser') ? 'schlechter' : 'besser';
  console.log('    ' + k.wort.padEnd(26) + k.besser.padEnd(13)
    + String(zH && zH.richtung).padEnd(12) + String(zT && zT.richtung));
  melde(zH && zH.richtung === erwartetHoch,
    k.wort + ' erhoeht -> ' + erwartetHoch);
  melde(zT && zT.richtung === erwartetTief,
    k.wort + ' gesenkt -> ' + erwartetTief);
}

/* ── 3 · Die zwei umgekehrten ausdruecklich ──────────────────────── */
console.log('\n=== 3 · Die zwei UMGEKEHRTEN, einzeln benannt ===');
const umgekehrt = A.KENNZAHLEN.filter((k) => k.besser === 'kleiner').map((k) => k.wort);
console.log('    ' + umgekehrt.join(', '));
melde(umgekehrt.length === 2, 'genau zwei Kennzahlen sind "kleiner ist besser" (ist: ' + umgekehrt.length + ')');
melde(umgekehrt.includes('Kaufpreis'), 'Kaufpreis ist dabei');
melde(umgekehrt.includes('LTV'), 'LTV ist dabei');

/* ── 4 · Das Urteil haengt am DealScore, nicht an einer Mehrheit ─── */
console.log('\n=== 4 · urteil kommt aus dem DealScore ===');
const mitScore = (ankaufScore, jetztScore) => {
  const kurz = {}, jetzt = {};
  for (const kk of A.KENNZAHLEN) { kurz[kk.schluessel] = 50; jetzt[kk.schluessel] = 50; }
  kurz._ds2_score = ankaufScore; jetzt._ds2_score = jetztScore;
  return A.abweichungFuer(Object.assign({}, jetzt, { _ankauf: { kurz: kurz, stichtag: '2024-01-01' } }));
};
for (const [a, j, erw] of [[60, 72, 'besser'], [72, 60, 'schlechter'], [65, 65, 'gleich']]) {
  const r = mitScore(a, j);
  melde(r.urteil === erw, 'Score ' + a + ' -> ' + j + ' ergibt urteil "' + erw + '" (ist: ' + r.urteil + ')');
  melde(r.urteilQuelle === 'DealScore', '  und urteilQuelle sagt DealScore');
  melde(r.scoreAnkauf === a && r.scoreJetzt === j, '  die beiden Scores reisen mit');
}
/* Gegenprobe: ein VERSCHLECHTERTER Kaufpreis darf das Urteil nicht drehen */
{
  const kurz = {}, jetzt = {};
  for (const kk of A.KENNZAHLEN) { kurz[kk.schluessel] = 50; jetzt[kk.schluessel] = 50; }
  kurz._ds2_score = 60; jetzt._ds2_score = 72;      /* Score besser */
  jetzt.kp = 90;                                     /* Kaufpreis schlechter */
  const r = A.abweichungFuer(Object.assign({}, jetzt, { _ankauf: { kurz: kurz, stichtag: '2024-01-01' } }));
  const kpZeile = r.zeilen.find((z) => z.wort === 'Kaufpreis');
  melde(kpZeile && kpZeile.richtung === 'schlechter', 'hoeherer Kaufpreis gilt als schlechter');
  melde(r.urteil === 'besser', 'das Urteil folgt trotzdem dem Score, nicht einer Mehrheit');
}

/* ── 5 · Deckung ─────────────────────────────────────────────────── */
console.log('\n=== 5 · Deckung ===');
console.log('  Pruefpunkte          : ' + geprueft);
console.log('  Kennzahlen x Richtung: ' + (A.KENNZAHLEN.length * 2));
console.log('  geladen              : frontend/js/ankauf.js (echt)');
console.log('  ersetzt              : document, collectData, localStorage');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft));
process.exit(fehler === 0 ? 0 : 1);
