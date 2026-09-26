/* Prueft die Lage-Auswahl aus v1623 an einem gebauten Fall.
 *
 * DER PRUEFMASZSTAB IST NICHT "es kommt eine Zahl heraus", sondern:
 * kommt bei ZWEI Saetzen und OHNE Lage KEINE Zahl heraus? Ein stiller
 * Griff zum ersten Satz waere genau der Fehler, den diese Aenderung
 * verhindern soll - und er sieht von aussen aus wie ein Erfolg. */
import * as R from '/app/src/lib/ausschuss_register.js';
import * as G from '/app/src/lib/gutachterausschuss.js';

const GITTER = {
  form: 'matrix_interp',
  achse_x_feld: 'sachwert', achse_x_bez: 'vorläufiger Sachwert in Euro',
  achse_x: [100000, 300000],
  achse_y_feld: 'brw', achse_y_bez: 'Bodenrichtwert in €/m²',
  achse_y: [50, 150],
  rundung_stellen: 2, liefert: 'faktor',
};

function satz(lage, hoch) {
  return {
    land_code: 'NI', ags: '03999', ebene: 'kreis',
    gebiet_name: 'Prüfkreis', gaa_name: 'Gutachterausschuss Prüfkreis',
    kennzahl: 'sachwertfaktor', zweig: 'ezfh',
    formel: { ...GITTER, zellen: hoch ? { 50: [1.30, 0.90], 150: [1.50, 1.05] }
                                      : { 50: [1.00, 0.70], 150: [1.15, 0.80] } },
    korrekturen: [], modellansaetze: {},
    geltungsbereich: { lage, zuordnung: { art: 'gemarkung' } },
    belege: [], stufe: 'B', fallzahl: 100, streuung: 0.1,
    stichtag: '2026-01-01', berichtsjahr: 2026,
    quelle_url: 'https://beispiel.invalid', quellenvermerk: 'Prüffall',
    lizenz: 'dl-de/by-2-0',
  };
}

R._setzeRegister([satz('Lage A', true), satz('Lage B', false)]);

const O = { ags: '03999', zweig: 'ezfh', sachwert: 200000, brw: 100 };
const faelle = [
  ['OHNE Lage', {}],
  ['Lage A', { lage: 'Lage A' }],
  ['Lage B', { lage: 'Lage B' }],
  ['Lage C (gibt es nicht)', { lage: 'Lage C' }],
];

let fehler = [];
for (const [was, zusatz] of faelle) {
  const r = G.sachwertfaktor({ ...O, ...zusatz });
  const w = r && r.verfuegbar ? r.wert : null;
  console.log(`  ${was.padEnd(24)} -> ${w !== null ? 'Faktor ' + w
    : 'kein Wert (' + (r && r.grund) + ')'}`);
  if (was === 'OHNE Lage' && w !== null) fehler.push('OHNE Lage kam eine Zahl - die Maschine raet noch');
  if (was === 'Lage C (gibt es nicht)' && w !== null) fehler.push('unbekannte Lage lieferte eine Zahl');
  if (was === 'Lage A' && w === null) fehler.push('Lage A lieferte nichts');
  if (was === 'Lage B' && w === null) fehler.push('Lage B lieferte nichts');
}

const a = G.sachwertfaktor({ ...O, lage: 'Lage A' });
const b = G.sachwertfaktor({ ...O, lage: 'Lage B' });
if (a.verfuegbar && b.verfuegbar && a.wert === b.wert) {
  fehler.push('beide Lagen liefern denselben Wert - es wird nicht unterschieden');
}

console.log('\n  Hinweis ohne Lage:');
const ohne = G.sachwertfaktor(O);
console.log('    ' + String(ohne.hinweis || '').slice(0, 150));
console.log('    gefuehrte Lagen: ' + JSON.stringify(ohne.lagen));
console.log('\n' + (fehler.length ? 'BEFUND:\n  ' + fehler.join('\n  ')
  : 'sauber: ohne Lage kein Wert, je Lage ein eigener, unbekannte Lage abgewiesen'));
process.exit(fehler.length ? 1 : 0);
