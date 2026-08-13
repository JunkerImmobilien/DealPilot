// pruefung-merge.mjs  (v1084a-WPRF)
//
// Bildet den Serverstart nach: ladeSaat(), dann ladeAusDb(q) mit einer
// Tabelle, die NUR Liegenschaftszinssaetze fuehrt — genau der Zustand auf
// Produktion am 13.08.
//
// Vor v1084a war das Ergebnis: 0 Sachwertfaktoren.

import { readFileSync } from 'node:fs';
import { ladeSaat, ladeAusDb, finde, registerStand } from '../lib/ausschuss_register.js';

let ok = 0, fehler = 0;
const p = (t, b, z = '') => {
  if (b) { ok++; console.log(`  ok      ${t}${z ? ' — ' + z : ''}`); }
  else { fehler++; console.log(`  FEHLER  ${t}${z ? ' — ' + z : ''}`); }
};

const st0 = ladeSaat();
p('Saat traegt beide Kennzahlen',
  st0.je_kennzahl && st0.je_kennzahl.liegenschaftszinssatz > 400
    && st0.je_kennzahl.sachwertfaktor > 20,
  JSON.stringify(st0.je_kennzahl));

// Die Tabelle, wie sie auf Prod aussieht: nur Liegenschaftszinssaetze.
const nurLzs = JSON.parse(readFileSync(
  new URL('../lib/register/lzs-nrw.json', import.meta.url), 'utf8'));
const r = await ladeAusDb(async () => nurLzs);

const st = registerStand();
p('DB-Lauf meldet die Zusammenfuehrung',
  r.herkunft === 'param_modell+saatdatei' && r.aus_saat > 0,
  `${r.herkunft} · ${r.geladen} aus DB, ${r.aus_saat} aus der Saat`);
p('Sachwertfaktoren UEBERLEBEN den DB-Lauf',
  finde('sachwertfaktor', '05762020').length > 0,
  `${(st.je_kennzahl || {}).sachwertfaktor} Saetze`);
p('Liegenschaftszinssaetze kommen aus der DB',
  finde('liegenschaftszinssatz', '05762020').length > 0,
  `${(st.je_kennzahl || {}).liegenschaftszinssatz} Saetze`);
p('Der Stand weist je Kennzahl aus (fuer das Startlog)',
  st.je_kennzahl && Object.keys(st.je_kennzahl).length === 2,
  JSON.stringify(st.je_kennzahl));

// Gegenprobe: fuehrt die Tabelle BEIDE Kennzahlen, gewinnt sie ueberall.
const beide = [...nurLzs.slice(0, 5).map((x) => ({ ...x })),
               { kennzahl: 'sachwertfaktor', ags: '05762', zweig: 'ezfh',
                 gaa_name: 'AUS DER DATENBANK', formel: { form: 'konstante', wert: 0.5 },
                 belege: [{}], berichtsjahr: 2026 }];
await ladeAusDb(async () => beide);
const t = finde('sachwertfaktor', '05762020');
p('Fuehrt die Tabelle die Kennzahl, gewinnt sie',
  t.length === 1 && t[0].gaa_name === 'AUS DER DATENBANK',
  t.length ? t[0].gaa_name : 'nichts');

console.log('');
console.log(`Merge-Pruefung: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
