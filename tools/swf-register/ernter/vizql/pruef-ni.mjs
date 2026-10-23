// Kettenprobe am echten Kern: die neuen NI-Saetze ueber sachwertfaktor() rechnen (Register aus SAATDATEIEN).
import * as PF from './pfade.mjs';
import { pathToFileURL } from 'node:url';
const L = PF.LIB;
const reg = await import(pathToFileURL(L + 'ausschuss_register.js').href);
const G = await import(pathToFileURL(L + 'gutachterausschuss.js').href);
reg.ladeSaat();
const F = [
  // [Beschreibung, Eingabe, Soll]
  ['Goslar, Gemarkung Goslar (GS01), EFH Norm', { ags: '03153017', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 60, standardstufe: 2.5, rnd_jahre: 40, gemarkungsnr: '036271', gemarkung: 'Goslar' }, 1.03],
  ['Goslar, Gemarkung Ahrendsberg (GS06), EFH Norm', { ags: '03153012', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 60, standardstufe: 2.5, rnd_jahre: 40, gemarkungsnr: '036307' }, 0.72],
  ['Goslar, ohne Gemarkung', { ags: '03153017', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 60, standardstufe: 2.5, rnd_jahre: 40 }, null],
  ['Goslar GS01, RH Norm', { ags: '03153017', objektart: 'Reihenhaus', sachwert_eur: 150000, brw_eur_qm: 60, standardstufe: 2.5, gemarkungsnr: '036271' }, 1.20],
  ['Goslar GS01, EFH Standardstufe 3 (Kurve 1,09)', { ags: '03153017', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 60, standardstufe: 3, rnd_jahre: 40, gemarkungsnr: '036271' }, 1.12],
  ['Holzminden EFH Norm', { ags: '03255023', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 60, standardstufe: 2.5, rnd_jahre: 40 }, 0.72],
  ['Stadt Göttingen EFH Norm', { ags: '03159016', objektart: 'EFH', sachwert_eur: 350000, brw_eur_qm: 260, standardstufe: 2.5, wohnflaeche_qm: 160 }, 1.51],
  ['Delmenhorst EFH Norm', { ags: '03401000', objektart: 'EFH', sachwert_eur: 350000, brw_eur_qm: 135 }, 0.92],
  ['Berne EFH Norm', { ags: '03461001', objektart: 'EFH', sachwert_eur: 350000, brw_eur_qm: 135 }, 0.89],
  ['Dötlingen EFH Norm', { ags: '03458003', objektart: 'EFH', sachwert_eur: 350000, brw_eur_qm: 135 }, 0.91],
  ['Beckeln (SG Harpstedt) EFH', { ags: '03458001', objektart: 'EFH', sachwert_eur: 350000, brw_eur_qm: 135 }, null],
  ['Essen (Oldb) EFH Norm', { ags: '03453006', objektart: 'EFH', sachwert_eur: 350000, brw_eur_qm: 115 }, 0.86],
  ['Oldenburg Stadt EFH Norm', { ags: '03403000', objektart: 'EFH', sachwert_eur: 375000, brw_eur_qm: 270, standardstufe: 2.25 }, 0.93],
  ['Helmstedt Stadt EFH Norm (Vorgabe-Lage)', { ags: '03154028', objektart: 'EFH', sachwert_eur: 200000, brw_eur_qm: 50, wohnflaeche_qm: 140, rnd_jahre: 35, standardstufe: 2.5, gemeinde: 'Helmstedt', ort: 'Helmstedt' }, 'Bestand'],
  ['Lehre EFH (Lage Lehre, Velpke)', { ags: '03154014', objektart: 'EFH', sachwert_eur: 200000, brw_eur_qm: 50, wohnflaeche_qm: 140, rnd_jahre: 35, standardstufe: 2.5, gemeinde: 'Lehre', ort: 'Lehre' }, 'Lage'],
  ['Grasleben EFH (keine Lage)', { ags: '03154008', objektart: 'EFH', sachwert_eur: 200000, brw_eur_qm: 50, wohnflaeche_qm: 140, rnd_jahre: 35, standardstufe: 2.5, gemeinde: 'Grasleben', ort: 'Grasleben' }, null],
  ['Peine Stadt EFH', { ags: '03157006', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 190, wohnflaeche_qm: 140, rnd_jahre: 40, standardstufe: 2.5, gemeinde: 'Peine', ort: 'Peine' }, 'Lage'],
  ['Salzgitter-Barum EFH', { ags: '03102000', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 150, wohnflaeche_qm: 150, rnd_jahre: 30, standardstufe: 2.5, ortsteil: 'Barum', ort: 'Salzgitter' }, 'Lage'],
  // v2888: Lage 'Hameln' nur in der Gemarkung Hameln, Ortschaften gesperrt
  ['Hameln EFH, Gemarkung Hameln', { ags: '03252006', objektart: 'EFH', sachwert_eur: 150000, brw_eur_qm: 50, standardstufe: 2.5, gemarkungsnr: '034960', gemarkung: 'Hameln' }, 1.21],
  ['Hameln EFH, Gemarkung Tündern (Sperre)', { ags: '03252006', objektart: 'EFH', sachwert_eur: 150000, brw_eur_qm: 50, standardstufe: 2.5, gemarkungsnr: '034966', gemarkung: 'Tündern' }, null],
  ['Hameln EFH ohne Gemarkung (lage_noetig)', { ags: '03252006', objektart: 'EFH', sachwert_eur: 150000, brw_eur_qm: 50, standardstufe: 2.5 }, null],
  ['Hameln RH, Gemarkung Tündern (Kreissatz)', { ags: '03252006', objektart: 'Reihenhaus', sachwert_eur: 150000, brw_eur_qm: 110, standardstufe: 2.5, rnd_jahre: 30, gemarkungsnr: '034966' }, 'Wert'],
  ['Bad Pyrmont EFH, Gemarkung Pyrmont', { ags: '03252003', objektart: 'EFH', sachwert_eur: 150000, brw_eur_qm: 50, standardstufe: 2.5, gemarkungsnr: '035803', gemarkung: 'Pyrmont' }, 'Wert'],
  ['Bad Pyrmont EFH, Gemarkung Oesdorf (Sperre)', { ags: '03252003', objektart: 'EFH', sachwert_eur: 150000, brw_eur_qm: 50, standardstufe: 2.5, gemarkungsnr: '035804', gemarkung: 'Oesdorf' }, null],
  ['Emmerthal EFH (Sperre)', { ags: '03252005', objektart: 'EFH', sachwert_eur: 150000, brw_eur_qm: 50, standardstufe: 2.5 }, null],
  ['Emmerthal RH (Kreissatz bleibt)', { ags: '03252005', objektart: 'Reihenhaus', sachwert_eur: 150000, brw_eur_qm: 110, standardstufe: 2.5, rnd_jahre: 30 }, 'Wert'],
  ['Stadt Nienburg EFH', { ags: '03256022', objektart: 'EFH', sachwert_eur: 100000, brw_eur_qm: 100, standardstufe: 2.5 }, 'Wert'],
  // v2887: Sulingen-Verden
  ['Stuhr RH (Lage Weyhe/Stuhr)', { ags: '03251037', objektart: 'Reihenhaus', sachwert_eur: 250000, standardstufe: 2.5 }, 1.17],
  ['Syke RH Norm', { ags: '03251041', objektart: 'Reihenhaus', sachwert_eur: 300000, standardstufe: 2.5 }, 0.97],
  ['Weyhe EFH Norm', { ags: '03251047', objektart: 'EFH', sachwert_eur: 400000, standardstufe: 2.5 }, 0.89],
  ['Weyhe ZFH Norm', { ags: '03251047', objektart: 'ZFH', sachwert_eur: 400000, standardstufe: 2.5 }, 0.83],
  ['Syke ZFH Norm', { ags: '03251041', objektart: 'Zweifamilienhaus', sachwert_eur: 400000, standardstufe: 2.5 }, 0.78],
  ['Syke EFH Sachwert 300.000', { ags: '03251041', objektart: 'EFH', sachwert_eur: 300000, standardstufe: 2.5 }, 0.92],
  ['Syke EFH Standardstufe 3 (Kurve 1,11)', { ags: '03251041', objektart: 'EFH', sachwert_eur: 400000, standardstufe: 3 }, 0.92],
  ['Diepholz Stadt EFH Norm', { ags: '03251012', objektart: 'EFH', sachwert_eur: 400000, brw_eur_qm: 90, standardstufe: 2.5 }, 0.8],
  ['Diepholz Stadt ZFH Norm', { ags: '03251012', objektart: 'ZFH', sachwert_eur: 400000, brw_eur_qm: 90, standardstufe: 2.5 }, 'Wert'],
  ['Diepholz Stadt RH (Bestand)', { ags: '03251012', objektart: 'Reihenhaus', sachwert_eur: 200000 }, 0.98],
  ['Steyerberg EFH (Sperre Nienburg-Land)', { ags: '03256030', objektart: 'EFH', sachwert_eur: 250000, brw_eur_qm: 50 }, null],
  ['Steyerberg RH (Kreissatz)', { ags: '03256030', objektart: 'Reihenhaus', sachwert_eur: 250000, brw_eur_qm: 150, standardstufe: 2.5 }, 'Wert'],
  ['Stadt Nienburg RH (Kopie)', { ags: '03256022', objektart: 'Reihenhaus', sachwert_eur: 250000, brw_eur_qm: 150, standardstufe: 2.5 }, 'Wert'],
  ['Soltau RH Norm', { ags: '03358021', objektart: 'Reihenhaus', sachwert_eur: 300000, brw_eur_qm: 90 }, 'Wert'],
  ['Achim RH (Sperre Bremer Umland)', { ags: '03361001', objektart: 'Reihenhaus', sachwert_eur: 300000, brw_eur_qm: 200 }, null],
  ['Achim EFH (Bestand)', { ags: '03361001', objektart: 'EFH', sachwert_eur: 400000, brw_eur_qm: 250 }, 'Wert'],
  ['Aurich EFH (Sperre)', { ags: '03452001', objektart: 'EFH', sachwert_eur: 200000, brw_eur_qm: 60 }, null],
];
let rot = 0;
for (const [b, o, soll] of F) {
  let r; try { r = G.sachwertfaktor(o); } catch (e) { r = { verfuegbar: false, grund: 'FEHLER ' + e.message }; }
  const ist = r.verfuegbar ? r.wert : null;
  let ok;
  if (soll === null) ok = !r.verfuegbar;
  else if (typeof soll === 'number') ok = r.verfuegbar && Math.abs(ist - soll) < 0.005;
  else ok = r.verfuegbar;
  if (!ok) rot++;
  console.log((ok ? 'OK  ' : 'ROT ') + b.padEnd(48) + ' ist ' + (ist ?? '—') + ' soll ' + (soll ?? 'kein Wert') + (r.verfuegbar ? '' : ' (' + r.grund + ')') + (r.ausschuss ? ' · ' + String(r.ausschuss).slice(0, 60) : ''));
}
console.log(rot ? `ROT: ${rot}` : 'alle gruen'); process.exit(rot ? 1 : 0);
