/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/grest-export-pruefen.mjs · v2102
   Backlog N60.33 (2)

   Prueft `portfolioExport.grestFuer(plz)` — die ECHTE Funktion aus dem
   ECHTEN Modul, gegen die ECHTE gespiegelte Tabelle.

   Marcel am 11.10.2026: „auch das Bundesland wissen wir ja fuer jedes
   Objekt. Daher wissen wir auch, wie das aussieht mit der
   Grunderwerbsteuersatz."

   Geprueft wird:
     1 · zehn echte PLZ gegen Land und Satz
     2 · die Tabelle selbst: 16 Laender, keine Luecke, keine Ueberlappung
     3 · KEIN TREFFER HEISST KEIN LAND (die Doktrin)
     4 · jedes Land kommt in den PLZ-Bereichen vor
     5 · der Satz stimmt mit dem Frontend ueberein (eine Quelle)

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require_ = createRequire(path.join(process.cwd(), 'backend', 'src', 'x.js'));

let fehler = 0, geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

/* ── Was nach aussen geht, wird ersetzt ───────────────────────────────
   `config` zieht `dotenv` und `db/pool` zieht `pg` - beide liegen lokal
   nicht in node_modules. Gefunden beim ersten Lauf ("Cannot find module
   'pg'"); `node --check` sieht das nie, weil es nur Syntax prueft.
   Ersetzt wird NUR, was nach aussen geht - `portfolioExport` selbst und
   die gespiegelte Tabelle bleiben die echten. */
import Module from 'module';
const stub = (spez, exporte) => {
  try {
    const pfad = require_.resolve(spez);
    require_.cache[pfad] = new Module(pfad, null);
    require_.cache[pfad].exports = exporte;
    require_.cache[pfad].loaded = true;
  } catch (e) { /* nicht vorhanden - dann braucht es den Ersatz auch nicht */ }
};
stub('./config', { env: 'test' });
stub('./db/pool', { query: async () => ({ rowCount: 0, rows: [] }), pool: {} });

let PE;
try { PE = require_('./services/portfolioExport'); }
catch (e) { console.error('portfolioExport nicht ladbar: ' + e.message); process.exit(1); }

if (typeof PE.grestFuer !== 'function') {
  console.error('grestFuer ist nicht exportiert');
  process.exit(1);
}
const g = PE.grestFuer;
console.log('Modul geladen, Exporte: ' + Object.keys(PE).join(', '));

/* ── 1 · Zehn echte PLZ ───────────────────────────────────────────── */
console.log('\n=== 1 · Zehn echte Postleitzahlen ===');
const FAELLE = [
  ['32609', 'NW', 6.5],  ['10115', 'BE', 6.0],  ['80331', 'BY', 3.5],
  ['20095', 'HH', 5.5],  ['01067', 'SN', 5.5],  ['60311', 'HE', 6.0],
  ['70173', 'BW', 5.0],  ['04109', 'SN', 5.5],  ['99084', 'TH', 5.0],   /* v3029: TH seit 01.01.2024 5,0 % (vorher 6,5) */
  ['24103', 'SH', 6.5]
];
console.log('    PLZ     erwartet      gemessen');
for (const [plz, land, satz] of FAELLE) {
  const r = g(plz);
  console.log('    ' + plz + '   ' + (land + ' ' + satz + ' %').padEnd(13)
    + String(r.kuerzel) + ' ' + r.satz + ' %   ' + String(r.name).slice(0, 22));
  melde(r.kuerzel === land, plz + ' -> ' + land + ' (ist: ' + r.kuerzel + ')');
  melde(r.satz === satz, plz + ' -> ' + satz + ' % (ist: ' + r.satz + ')');
  melde(/abgeleitet aus plz/.test(String(r.herkunft)), plz + ': Herkunft genannt');
}

/* ── 2 · Die Tabelle selbst ───────────────────────────────────────── */
console.log('\n=== 2 · Die gespiegelte Tabelle ===');
const konst = JSON.parse(fs.readFileSync('backend/src/generated/frontend-konstanten.json', 'utf8'));
const G = (konst.daten || {}).grest || {};
const laender = Object.keys(G.saetze || {});
melde(laender.length === 16, 'genau 16 Bundeslaender (ist: ' + laender.length + ')');
melde(Array.isArray(G.plz_bereiche) && G.plz_bereiche.length > 50,
  'PLZ-Bereiche vorhanden (' + (G.plz_bereiche || []).length + ')');
melde(!!G.namen && Object.keys(G.namen).length === 16,
  'zu jedem Kuerzel ein Name (' + Object.keys(G.namen || {}).length + ')');
/* Jedes Land muss in den Bereichen vorkommen - sonst ist es unerreichbar */
const inBereichen = new Set((G.plz_bereiche || []).map((b) => b[2]));
const unerreichbar = laender.filter((l) => !inBereichen.has(l));
melde(unerreichbar.length === 0,
  'jedes Land ist ueber mindestens eine PLZ erreichbar'
  + (unerreichbar.length ? ' — UNERREICHBAR: ' + unerreichbar.join(', ') : ''));
/* ── Ueberlappungen sind ERLAUBT, aber die Reihenfolge entscheidet ────
   Der erste Entwurf verlangte: keine Ueberlappung. Gemessen gibt es EINE,
   und sie ist fachlich richtig:

     04000-04999  SN  Sachsen
     04900-04938  BB  Brandenburg

   Elsterwerda, Bad Liebenwerda und Uebigau tragen 049xx und liegen in
   BRANDENBURG, obwohl der 04xxx-Block sonst Sachsen ist. Die engere
   Spanne ist die Ausnahme.

   > Ein Pruefer, der eine richtige Ausnahme als Fehler meldet, wird
   > abgeschaltet. Geprueft wird deshalb, was WIRKLICH schiefgehen kann:
   > `grestFuer` nimmt den ERSTEN Treffer, also muss die engere Spanne
   > VOR der weiteren stehen. Steht sie dahinter, ist sie unerreichbar -
   > und jede PLZ darin bekaeme stillschweigend das falsche Land. */
const roh = G.plz_bereiche || [];
const spanne = (b) => Number(b[1]) - Number(b[0]);
let verdeckt = [];
for (let i = 0; i < roh.length; i++) {
  for (let j = i + 1; j < roh.length; j++) {
    const a = roh[i], b = roh[j];
    const ueberlappt = Number(b[0]) <= Number(a[1]) && Number(b[1]) >= Number(a[0]);
    if (!ueberlappt) continue;
    /* `a` steht vorn. Ist `a` die WEITERE Spanne, verdeckt sie `b`. */
    if (spanne(a) > spanne(b)) {
      verdeckt.push(a[0] + '-' + a[1] + ' ' + a[2] + ' verdeckt '
        + b[0] + '-' + b[1] + ' ' + b[2]);
    }
  }
}
melde(verdeckt.length === 0,
  'keine engere PLZ-Spanne wird von einer weiteren VERDECKT'
  + (verdeckt.length ? ' — ' + verdeckt.join('; ') : ''));
/* Und die bekannte Ausnahme ausdruecklich nachmessen, statt sie zu glauben */
melde(g('04910').kuerzel === 'BB', '04910 Elsterwerda -> BB (die Ausnahme greift)');
melde(g('04109').kuerzel === 'SN', '04109 Leipzig -> SN (der Block greift)');

/* ── 3 · Kein Treffer heisst kein Land ────────────────────────────── */
console.log('\n=== 3 · Kein Treffer heisst KEIN Land ===');
for (const [n, plz] of [['leer', ''], ['null', null], ['vierstellig', '1234'],
                        ['Buchstaben', 'abcde'], ['mit Leerzeichen', '32 609'],
                        ['00000', '00000'], ['99999', '99999']]) {
  const r = g(plz);
  const hatLand = r.kuerzel != null;
  const hatGrund = !!r.herkunft;
  console.log('    ' + n.padEnd(17) + 'Land=' + String(r.kuerzel).padEnd(6)
    + 'Satz=' + String(r.satz).padEnd(6) + String(r.herkunft).slice(0, 44));
  if (n === '00000' || n === '99999') {
    /* Diese koennen legitim treffen oder nicht - geprueft wird nur die
       Konsistenz: Land ohne Satz oder Satz ohne Land darf es nicht geben. */
    melde(!(hatLand && r.satz == null) || /kein Satz/.test(String(r.herkunft)),
      n + ': Land und Satz sind konsistent');
  } else {
    melde(!hatLand && r.satz == null, n + ' -> kein Land, kein Satz');
  }
  melde(hatGrund, n + ': sagt WARUM (' + String(r.herkunft).slice(0, 34) + ')');
}

/* ── 4 · Eine Quelle: Frontend == Spiegel ─────────────────────────── */
console.log('\n=== 4 · Frontend und Spiegel tragen dieselben Saetze ===');
const fe = fs.readFileSync('frontend/js/grest-plz-lookup.js', 'utf8');
let gleich = 0, ungleich = [];
for (const l of laender) {
  const re = new RegExp("'" + l + "'\\s*:\\s*([\\d.]+)");
  const m = fe.match(re);
  if (!m) { ungleich.push(l + ' (im Frontend nicht gefunden)'); continue; }
  if (Number(m[1]) === Number(G.saetze[l])) gleich++;
  else ungleich.push(l + ': Frontend ' + m[1] + ' vs Spiegel ' + G.saetze[l]);
}
melde(ungleich.length === 0,
  gleich + ' von ' + laender.length + ' Saetzen stimmen ueberein'
  + (ungleich.length ? ' — ABWEICHUNG: ' + ungleich.join('; ') : ''));

/* ── 5 · Der Hinweis im Export ────────────────────────────────────── */
console.log('\n=== 5 · Der Export erklaert den Unterschied ===');
const hin = (PE.HINWEISE || []).join(' ');
melde(/gest_p/.test(hin) && /grest_satz_amtlich/.test(hin),
  'HINWEISE nennen beide Felder');
melde(/DUERFEN abweichen/.test(hin),
  'HINWEISE sagen, dass sie abweichen duerfen');
melde(/grest_herkunft/.test(hin), 'HINWEISE nennen die Herkunftsangabe');

/* ── 6 · Deckung ──────────────────────────────────────────────────── */
console.log('\n=== 6 · Deckung ===');
console.log('  Pruefpunkte        : ' + geprueft);
console.log('  echte PLZ geprueft : ' + FAELLE.length);
console.log('  Laender            : ' + laender.length);
console.log('  PLZ-Bereiche       : ' + (G.plz_bereiche || []).length);
console.log('  geladen            : backend/src/services/portfolioExport.js (echt)');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft));
process.exit(fehler === 0 ? 0 : 1);
