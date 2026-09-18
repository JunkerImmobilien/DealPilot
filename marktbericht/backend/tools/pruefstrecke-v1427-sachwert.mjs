// pruefstrecke-v1427-sachwert.mjs   (v1427-GPK)
//
// DER SACHWERT GEGEN EIN UNTERSCHRIEBENES GUTACHTEN.
//
// Sollwerte: Verkehrswertgutachten Loehner Str. 278, 32120 Hiddenhausen
// (ZFH, BGF 346,62 m2, Stichtag 01.01.2027) — dieselben Zahlen, gegen die
// der Rechenkern des Gutachten-Pakets 1.0.0 geprueft ist. Nicht aus dem
// Kopf, nicht aus diesem Skript.
//
// Geprueft wird der Rechenweg, den v1427 aus dem Paket uebernommen hat:
//   1. Korrekturfaktor Zweifamilienhaus 1,05 (NHK 2010)
//   2. Gutachterrundung: Index auf 3 Stellen, Kennwert zum Stichtag auf Cent
//   3. Aussenanlagen auf Wohnhaus UND Garage (SW-RL 2012 Nr. 4.2)
//   4. Garage mit Zwischenstufe (3,57 -> 381,80 EUR/m2)
//
// Der gewogene Kennwert 861,20 EUR/m2 wird gesetzt, weil die Gewerkestufen
// des Gutachtens hier nicht vorliegen — alles danach rechnet der echte Kern.
// Toleranz 2 EUR: der Bericht rundet jede Position auf den Euro.
//
// Aufruf lokal:      node marktbericht/backend/tools/pruefstrecke-v1427-sachwert.mjs
// Aufruf Container:  docker exec <marktbericht-backend> node tools/pruefstrecke-v1427-sachwert.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const kandidaten = [path.join(hier, '../src/lib/nhk2010.js'), path.join(hier, '../lib/nhk2010.js')];
const datei = kandidaten.find((p) => fs.existsSync(p));
if (!datei) { console.error('nhk2010.js nicht gefunden in: ' + kandidaten.join(', ')); process.exit(2); }
const nhk = await import(pathToFileURL(datei).href);
console.log('Kern: ' + datei);

let fehler = 0;
const pruef = (name, ok, ist) => { console.log((ok ? '  OK      ' : '  FEHLER  ') + name.padEnd(46) + ist); if (!ok) fehler++; };

pruef('v1427 ist im Kern', typeof nhk.zfhKorrektur === 'function', typeof nhk.zfhKorrektur);

const SOLL = { hk: 621226.23, awm: 501358.36, garage: 55241.29, aussen: 16587.51,
               baulich: 253551.90, vorl: 398391.90, markt: 362536.63 };
const alt = nhk.NHK_2010.WERTE['1.31|3'];
nhk.NHK_2010.WERTE['1.31|3'] = 861.2;
let r;
try {
  r = nhk.sachwert({ nhk_typ: '1.31', standardstufe: 3, objektart: 'zfh', bgf_direkt: 346.62,
    baupreisindex: 1.982, bauteile_hk: 95000, gnd_jahre: 80, rnd_jahre: 24, aussenanlagen_pct: 7,
    garagen_bgf_qm: 73, garagen_stufe: 3.57, garagen_gnd: 60, garagen_rnd: 24 },
  { vollstaendig: true, wert: 144840 }, { wert: 0.91 });
} finally {
  nhk.NHK_2010.WERTE['1.31|3'] = alt;
}
const eur = (v) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nah = (ist, soll) => Math.abs(ist - soll) <= 2;

pruef('Kennwert zum Stichtag = 1.792,24', r.kennwert_stichtag_eur_qm === 1792.24, eur(r.kennwert_stichtag_eur_qm));
pruef('ZFH-Faktor 1,05 angewandt', r.zfh_korrektur === 1.05, String(r.zfh_korrektur));
pruef('HK Wohnhaus', nah(r.herstellungskosten_eur - 95000, SOLL.hk), eur(r.herstellungskosten_eur - 95000) + '  Soll ' + eur(SOLL.hk));
pruef('Alterswertminderung', nah(r.alterswertminderung_eur, SOLL.awm), eur(r.alterswertminderung_eur) + '  Soll ' + eur(SOLL.awm));
pruef('Garage: Kennwert Zwischenstufe 381,80', r.garage && r.garage.kennwert_eur_qm === 381.8, r.garage && eur(r.garage.kennwert_eur_qm));
pruef('HK Garage', nah(r.garage.herstellungskosten_eur, SOLL.garage), eur(r.garage.herstellungskosten_eur) + '  Soll ' + eur(SOLL.garage));
pruef('Aussenanlagen auf Haus + Garage', nah(r.aussenanlagen_eur, SOLL.aussen), eur(r.aussenanlagen_eur) + '  Soll ' + eur(SOLL.aussen));
pruef('Sachwert der baulichen Anlagen', nah(r.gebaeude_sachwert_eur, SOLL.baulich), eur(r.gebaeude_sachwert_eur) + '  Soll ' + eur(SOLL.baulich));
pruef('vorlaeufiger Sachwert', nah(r.vorlaeufiger_sachwert_eur, SOLL.vorl), eur(r.vorlaeufiger_sachwert_eur) + '  Soll ' + eur(SOLL.vorl));
pruef('marktangepasster Sachwert (x 0,91)', nah(r.wert, SOLL.markt), eur(r.wert) + '  Soll ' + eur(SOLL.markt));

console.log('\nGegenproben — der Faktor darf NUR beim Zweifamilienhaus greifen:');
pruef('EFH 1.31 bekommt 1,0', nhk.zfhKorrektur({ nhk_typ: '1.31', objektart: 'efh' }) === 1, '');
pruef('MFH 4.1 bekommt 1,0 (auch mit zfh-Text)', nhk.zfhKorrektur({ nhk_typ: '4.1', objektart: 'zfh' }) === 1, '');
pruef('DHH 2.01 als "Zweifamilienhaus" bekommt 1,05', nhk.zfhKorrektur({ nhk_typ: '2.01', objektart: 'Zweifamilienhaus' }) === 1.05, '');

console.log(fehler ? `\nFEHLER: ${fehler}` : '\nDer Sachwert trifft das Gutachten Loehner Str. 278.');
process.exit(fehler ? 1 : 0);
