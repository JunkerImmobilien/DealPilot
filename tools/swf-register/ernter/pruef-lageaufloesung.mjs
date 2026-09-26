/* Prueft die Lage-Aufloesung aus v1624.
 *
 * DER PRUEFMASZSTAB IST NICHT, dass etwas getroffen wird - sondern dass
 * das FALSCHE nicht getroffen wird. Eine Zuordnung, die im Zweifel
 * zugreift, ist genau der Fehler, den sie verhindern soll. */
import * as R from '/app/src/lib/ausschuss_register.js';
import * as G from '/app/src/lib/gutachterausschuss.js';

const GITTER = (hoch) => ({
  form: 'matrix_interp',
  achse_x_feld: 'sachwert', achse_x_bez: 'vorläufiger Sachwert in Euro',
  achse_x: [100000, 300000],
  achse_y_feld: 'brw', achse_y_bez: 'Bodenrichtwert in €/m²',
  achse_y: [50, 150],
  zellen: hoch ? { 50: [1.30, 0.90], 150: [1.50, 1.05] }
               : { 50: [1.00, 0.70], 150: [1.15, 0.80] },
  rundung_stellen: 2, liefert: 'faktor',
});

function satz(ags, lage, hoch, zuordnung) {
  return {
    land_code: 'NI', ags, ebene: 'kreis',
    gebiet_name: 'Prüfkreis', gaa_name: 'Gutachterausschuss Prüfkreis',
    kennzahl: 'sachwertfaktor', zweig: 'ezfh',
    formel: GITTER(hoch), korrekturen: [], modellansaetze: {},
    geltungsbereich: { lage, zuordnung },
    belege: [], stufe: 'B', fallzahl: 100, streuung: 0.1,
    stichtag: '2026-01-01', berichtsjahr: 2026,
    quelle_url: 'https://beispiel.invalid', quellenvermerk: 'Prüffall',
    lizenz: 'dl-de/by-2-0',
  };
}

/* A · ueber die Gemarkungstabelle (wie Goslar) */
const ZU_GEMARKUNG = { art: 'gemarkung', tabelle: [
  { gemarkung: 'Goslar', lageklasse: 'GS 01', gemarkungsnr: '6271' },
  { gemarkung: 'Bad Harzburg', lageklasse: 'GS 06', gemarkungsnr: '6295' },
] };
/* B · ueber die Lagenamen (wie Helmstedt) */
const ZU_GEMEINDE = { art: 'gemeinde', tabelle: null };

const faelle = [
  ['A · Gemarkungsnummer 036271 (BORIS-Form)',
   [satz('03901', 'GS 01', true, ZU_GEMARKUNG), satz('03901', 'GS 06', false, ZU_GEMARKUNG)],
   { ags: '03901', gemarkungsnr: '036271' }, 1.19],
  ['A · Gemarkungsname "Bad Harzburg"',
   [satz('03901', 'GS 01', true, ZU_GEMARKUNG), satz('03901', 'GS 06', false, ZU_GEMARKUNG)],
   { ags: '03901', gemarkung: 'Bad Harzburg' }, 0.91],
  ['A · fremde Gemarkung -> KEIN Wert',
   [satz('03901', 'GS 01', true, ZU_GEMARKUNG), satz('03901', 'GS 06', false, ZU_GEMARKUNG)],
   { ags: '03901', gemarkung: 'Anderswo', gemarkungsnr: '039999' }, null],
  ['B · Gemeinde "Königslutter" in der Lagebezeichnung',
   [satz('03902', 'Helmstedt, Königslutter [1,00]', true, ZU_GEMEINDE),
    satz('03902', 'Lehre, Velpke [1,08]', false, ZU_GEMEINDE)],
   { ags: '03902', ort: 'Königslutter' }, 1.19],
  ['B · "Lehrte" darf NICHT auf "Lehre" passen',
   [satz('03902', 'Helmstedt, Königslutter [1,00]', true, ZU_GEMEINDE),
    satz('03902', 'Lehre, Velpke [1,08]', false, ZU_GEMEINDE)],
   { ags: '03902', ort: 'Lehrte' }, null],
  ['C · Ortsteil "Beddingen" (Salzgitter staffelt nach Ortsteilen)',
   [satz('03903', 'Barum, Beddingen, Beinum und Watenstedt', true, ZU_GEMEINDE),
    satz('03903', 'Gebhardshagen, Lebenstedt und Thiede', false, ZU_GEMEINDE)],
   { ags: '03903', gemeinde: 'Salzgitter', ortsteil: 'Beddingen' }, 1.19],
  ['C · Ortsteil "Thiede" -> andere Lage',
   [satz('03903', 'Barum, Beddingen, Beinum und Watenstedt', true, ZU_GEMEINDE),
    satz('03903', 'Gebhardshagen, Lebenstedt und Thiede', false, ZU_GEMEINDE)],
   { ags: '03903', gemeinde: 'Salzgitter', ortsteil: 'Thiede' }, 0.91],
  ['C · fremder Ortsteil -> KEIN Wert',
   [satz('03903', 'Barum, Beddingen, Beinum und Watenstedt', true, ZU_GEMEINDE),
    satz('03903', 'Gebhardshagen, Lebenstedt und Thiede', false, ZU_GEMEINDE)],
   { ags: '03903', gemeinde: 'Salzgitter', ortsteil: 'Irgendwo' }, null],
];

let fehler = [];
for (const [was, saetze, obj, erwartet] of faelle) {
  R._setzeRegister(saetze);
  const r = G.sachwertfaktor({ ...obj, zweig: 'ezfh', sachwert: 200000, brw: 100 });
  const w = r && r.verfuegbar ? r.wert : null;
  const gut = (erwartet === null) ? (w === null) : (w === erwartet);
  console.log(`  ${gut ? 'OK  ' : 'FALSCH'} ${was.padEnd(46)} -> `
    + (w !== null ? 'Faktor ' + w : 'kein Wert (' + (r && r.grund) + ')')
    + (gut ? '' : `   ERWARTET: ${erwartet === null ? 'kein Wert' : erwartet}`));
  if (!gut) fehler.push(was);
}
console.log('\n' + (fehler.length
  ? 'BEFUND:\n  ' + fehler.join('\n  ')
  : 'sauber: beide Zuordnungswege treffen, Fremdes wird abgewiesen, kein Teiltreffer'));
process.exit(fehler.length ? 1 : 0);
