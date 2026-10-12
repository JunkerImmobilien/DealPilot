/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/halter-export-pruefen.mjs · v2103
   Backlog N60.33 (4)

   Prueft `portfolioExport.halterFuer(daten)` — die ECHTE Funktion aus
   dem ECHTEN Modul.

   Marcel am 11.10.2026: „Die Rechtsform der Gesellschaft."

   WAS HIER DIE EIGENTLICHE PRUEFUNG IST:

     Nicht ob ein Wert herauskommt, sondern ob **keiner** herauskommt, wo
     der Server nichts weiss. Eine erfundene Steuersphaere ist hier
     teurer als eine fehlende: `sphaere()` in `mandanten.js` ist seit
     v1404 der ausdrueckliche EINZIGE Schiedsrichter, nachdem eine
     zweite Fassung 9,6 % zu viel ausgewiesene Entlastung erzeugt hatte.

   Deshalb wird GEGEN die Doppelung geprueft (Abschnitt 3): das Backend
   darf `sphaere()` nicht nachbauen.

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import Module from 'module';
import { createRequire } from 'module';

const require_ = createRequire(path.join(process.cwd(), 'backend', 'src', 'x.js'));

let fehler = 0, geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

/* Nur was nach aussen geht wird ersetzt - das Modul selbst bleibt echt. */
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

if (typeof PE.halterFuer !== 'function') {
  console.error('halterFuer ist nicht exportiert');
  process.exit(1);
}
const h = PE.halterFuer;
console.log('Modul geladen, Exporte: ' + Object.keys(PE).join(', '));

/* ── 1 · Die drei Faelle ──────────────────────────────────────────── */
console.log('\n=== 1 · Die drei Faelle ===');

const PRIVAT = [
  ['halter fehlt',      {}],
  ['halter leer',       { halter: '' }],
  ['halter null',       { halter: null }],
  ['halter Leerzeichen',{ halter: '   ' }],
  ['halter privat',     { halter: 'privat' }]
];
for (const [n, d] of PRIVAT) {
  const r = h(d);
  console.log('    ' + n.padEnd(21) + 'sphaere=' + String(r.steuersphaere).padEnd(6)
    + 'rf=' + String(r.rechtsform).padEnd(9) + String(r.herkunft).slice(0, 40));
  melde(r.steuersphaere === 'est', n + ' -> Sphaere "est"');
  melde(r.rechtsform === 'privat', n + ' -> Rechtsform "privat"');
  melde(!!r.herkunft, n + ' -> sagt WARUM');
}

/* ── 2 · Eine Mandanten-ID: KEINE Sphaere, KEINE Rechtsform ───────── */
console.log('\n=== 2 · Mandanten-ID -> der Server weiss es NICHT ===');
const FREMD = ['m_1728', 'gmbh-nord', 'ug42', 'abc-def-123'];
for (const id of FREMD) {
  const r = h({ halter: id });
  melde(r.id === id, id + ': die ID geht mit');
  melde(r.steuersphaere === null, id + ': Sphaere ist null, nicht geraten');
  melde(r.rechtsform === null, id + ': Rechtsform ist null, nicht geraten');
  melde(/dp_mandanten/.test(String(r.herkunft)), id + ': nennt die Ablage');
  melde(/N60\.28/.test(String(r.herkunft)), id + ': nennt den Backlog-Punkt');
}
/* Lange IDs duerfen den Hinweis nicht sprengen */
const lang = h({ halter: 'x'.repeat(400) });
melde(String(lang.herkunft).length < 260, 'lange Halter-ID wird gekappt ('
  + String(lang.herkunft).length + ' Zeichen)');
melde(lang.id.length === 400, 'das Feld `halter` selbst bleibt ungekappt');

/* ── 3 · GEGEN DIE DOPPELUNG ─────────────────────────────────────────
   Das Backend darf `sphaere()` aus `mandanten.js` nicht nachbauen.
   Geprueft wird am KOMMENTARFREIEN Text, sonst findet der Pruefer die
   Begruendung, die genau diese Doppelung verbietet (dreimal passiert). */
console.log('\n=== 3 · Keine zweite Fassung von sphaere() ===');
const roh = fs.readFileSync('backend/src/services/portfolioExport.js', 'utf8');
/* Kommentare austauschweise durch Leerzeichen ersetzen, damit die
   Zeilennummern stimmen. */
const nutz = roh
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '));
const anteil = Math.round(100 * nutz.replace(/\s/g, '').length
  / roh.replace(/\s/g, '').length);
console.log('    Nutztext: ' + anteil + ' % der Zeichen (Rest ist Kommentar)');

const VERBOTEN = [
  ['isCorp',          /\bisCorp\b/],
  ['erw_kuerzung',    /erw_kuerzung/],
  ['Hebesatz-Formel', /0\.035\s*\*/],
  ['KSt-Satz 15,825', /15\.825/],
  ['regime.kst',      /regime\s*\.\s*kst|\breg\s*\.\s*kst/],
  ['gbr-Vergleich',   /['"]gbr['"]/]
];
for (const [n, re] of VERBOTEN) {
  const tref = nutz.match(re);
  melde(!tref, 'kein `' + n + '` im Nutztext' + (tref ? ' — GEFUNDEN: ' + tref[0] : ''));
}
melde(/\bhalterFuer\b/.test(nutz), 'halterFuer existiert im Nutztext (Gegenprobe)');

/* ── 4 · Die Felder kommen am Objekt an ──────────────────────────── */
console.log('\n=== 4 · Die fuenf Felder stehen in der Objektzeile ===');
for (const f of ['halter:', 'halter_seit:', 'halter_rechtsform:',
                 'steuersphaere:', 'halter_herkunft:']) {
  melde(nutz.indexOf('      ' + f) >= 0 || new RegExp('\\n\\s+' + f.replace(':', ':')).test(nutz),
    'Feld `' + f.replace(':', '') + '` wird gesetzt');
}

/* ── 5 · halter_seit geht mit, aber erfindet nichts ──────────────── */
console.log('\n=== 5 · halter_seit ===');
melde(h({ halter: 'privat', halter_seit: '2024-05-01' }).seit === '2024-05-01',
  'ein Datum geht durch');
melde(h({ halter: 'privat', halter_seit: '' }).seit === null,
  'leer wird null, nicht ""');
melde(h({ halter: 'privat' }).seit === null, 'fehlend wird null');

/* ── 6 · Der HINWEIS warnt vor dem teuren Fehler ─────────────────── */
console.log('\n=== 6 · Der Export warnt den Empfaenger ===');
const hin = (PE.HINWEISE || []).join(' ');
melde(/steuersphaere/.test(hin), 'HINWEISE nennen `steuersphaere`');
melde(/halter_herkunft/.test(hin), 'HINWEISE nennen `halter_herkunft`');
melde(/NICHT als "est" gerechnet/.test(hin),
  'HINWEISE verbieten ausdruecklich, null als "est" zu rechnen');

/* ── 7 · Deckung ─────────────────────────────────────────────────── */
console.log('\n=== 7 · Deckung ===');
console.log('  Pruefpunkte     : ' + geprueft);
console.log('  Privat-Faelle   : ' + PRIVAT.length);
console.log('  Fremd-IDs       : ' + FREMD.length);
console.log('  Doppelungs-Netz : ' + VERBOTEN.length + ' verbotene Muster');
console.log('  geladen         : backend/src/services/portfolioExport.js (echt)');
console.log('  Nutztext-Anteil : ' + anteil + ' %');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft));
process.exit(fehler === 0 ? 0 : 1);
