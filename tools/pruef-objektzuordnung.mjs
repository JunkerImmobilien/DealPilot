/* Prüfstrecke für die Objektzuordnung des Co-Pilot-Änderungsmoduls.
   WICHTIG: lädt die ECHTE Datei, nicht eine Kopie der Funktionen.
   Ein Prüfer, der die Logik nachbaut, misst sich selbst. */
import fs from 'fs';

const QUELLE = new URL('../frontend/js/copilot-aenderungen.js', import.meta.url);
const code = fs.readFileSync(QUELLE, 'utf8');

const TIPS = [
  '2026-999 · Musterstraße 12 Leipzig',
  '2026-1056 · Parkstr. 9 Bad Oeynhausen',
  '2026-1055 · Hauptstr. 51 Ibbenbüren',
  '2026-1054 · Bismarckstr. 27 Detmold',
  '2026-1053 · Ravensberger Weg 38 Bielefeld',
  '2026-1052 · Gohliser Str. 42 Leipzig',
  '2026-1051 · Lindenhof 14 Castrop-Rauxel',
  '2026-1042 · Alexanderstraße 11 Bielefeld',
  '2026-1006 · Löhner Str. 278 Hiddenhausen'
];

/* Ein DOM, das nur das kann, was die Zuordnung braucht. */
const karten = TIPS.map((tip, i) => ({
  getAttribute: (a) => (a === 'data-key' ? 'key-' + i : a === 'data-tip' ? tip : null)
}));
karten.forEach = Array.prototype.forEach.bind(karten);

const felder = {};   /* für heileSchablone: el(id) muss existierende Felder kennen */
['zimmer', 'mod_innenausbau', 'nkm', 'bj'].forEach((id) => {
  felder[id] = { id, tagName: 'INPUT', type: 'text', value: '' };
});

const docStub = {
  getElementById: (id) => felder[id] || null,
  querySelector: () => null,
  querySelectorAll: (sel) => (/sb-card/.test(sel) ? karten : []),
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} }
};

const win = { FIELDS: [], _currentObjKey: null, Auth: { apiCall: () => Promise.resolve({}) } };
win.document = docStub;
win.setTimeout = () => 0;

class MO { observe() {} disconnect() {} }
const fn = new Function('window', 'document', 'setTimeout', 'Promise', 'RegExp',
  'MutationObserver', 'addEventListener', code);
fn(win, docStub, () => 0, Promise, RegExp, MO, () => {});

const M = win.DealPilotCopilotAenderungen;
if (!M || !M._pruef) { console.error('AUSFALL: Modul oder _pruef fehlt'); process.exit(1); }
const { treffer, objektFinden, heileSchablone, objekte } = M._pruef;

console.log('Deckung: ' + objekte().length + ' von ' + TIPS.length + ' Objekten gelesen');
if (objekte().length !== TIPS.length) { console.error('AUSFALL: DOM-Stub greift nicht'); process.exit(1); }

const FAELLE = [
  ['Kannst du in der Musterstraße 12 in Leipzig den Innenausbau auf über 20 Jahren setzen?', 'key-0'],
  ['Dann änder bei der Musterstraße 12 mal die Zimmeranzahl auf fünf.', 'key-0'],
  ['Bei der Gohliser Str. 42 ist die Miete jetzt 1450', 'key-5'],
  ['Setz bei Alexanderstr. 11 das Baujahr auf 1968', 'key-7'],
  ['Parkstraße 9 Bad Oeynhausen: Zustand saniert', 'key-1'],
  ['Objekt 2026-1054, Miete 980', 'key-3'],
  ['Bismarckstr. 27 in Detmold, Tilgung 2,5 Prozent', 'key-3'],
  ['Löhner Str. 278, Wohnfläche 233', 'key-8'],
  ['Lindenhof 14, Zimmer 4', 'key-6'],
  ['Ravensberger Weg 38 Bielefeld, Kaufpreis 420000', 'key-4'],
  ['Hauptstr. 51 in Ibbenbüren, Hausgeld 180', 'key-2'],
  /* Kein eindeutiges Objekt — hier MUSS gefragt werden */
  ['Wie sieht die Mietentwicklung in Leipzig aus?', null],
  ['Ändere die Miete auf 850', null],
  ['In Bielefeld die Miete auf 900', null]
];

let gut = 0, schlecht = 0;
for (const [satz, soll] of FAELLE) {
  const f = objektFinden(satz);
  const wer = f.art === 'eins' ? f.objekt.key : '';
  const ok = soll ? (f.art === 'eins' && wer === soll) : (f.art !== 'eins');
  ok ? gut++ : schlecht++;
  const punkte = TIPS.map((t, i) => [i, treffer(satz, t)]).filter((x) => x[1] > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => 'key-' + x[0] + ':' + x[1]).join(' ');
  console.log((ok ? 'OK  ' : 'FEHL') + ' ' + f.art.padEnd(8) + (wer || '-').padEnd(8)
    + ' soll=' + String(soll || 'gefragt').padEnd(8) + ' [' + punkte + ']  ' + satz.slice(0, 44));
}

/* Der Schablonen-Heiler, gegen die gemessene Fehlform */
const H = [
  [{ feld_id: 'zimmer', anderes_feld: '5' }, { zimmer: '5' }],
  [{ feld_id: 'zimmer', wert: '5' }, { zimmer: '5' }],
  [{ id: 'nkm', value: '850' }, { nkm: '850' }],
  [[{ feld_id: 'zimmer', wert: '5' }, { feld_id: 'nkm', wert: '850' }], { zimmer: '5', nkm: '850' }],
  [{ zimmer: '5' }, { zimmer: '5' }],                        /* richtige Form bleibt */
  [{ zimmer: '5', nkm: '850' }, { zimmer: '5', nkm: '850' }],
  [{ feld_id: 'gibtsnicht', wert: '5' }, { feld_id: 'gibtsnicht', wert: '5' }]  /* kein Feld -> nicht heilen */
];
console.log('\n-- heileSchablone --');
for (const [ein, soll] of H) {
  const raus = heileSchablone(JSON.parse(JSON.stringify(ein)));
  const ok = JSON.stringify(raus) === JSON.stringify(soll);
  ok ? gut++ : schlecht++;
  console.log((ok ? 'OK  ' : 'FEHL') + ' ' + JSON.stringify(ein).slice(0, 48)
    + ' -> ' + JSON.stringify(raus));
}

console.log('\n' + gut + ' von ' + (gut + schlecht) + ' richtig');
process.exit(schlecht ? 1 : 0);
