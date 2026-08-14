#!/usr/bin/env node
/* pruefstrecke-v1093.mjs
 *
 * DER SOLLWERT KOMMT AUS DEM DOKUMENT.
 *
 * Worms druckt kein durchgerechnetes Anwendungsbeispiel ab — aber es druckt
 * je Kategorie den Gueltigkeitsbereich der Achse UND die daraus folgende
 * Zinssatzspanne ab. Zusammen ist das ein vollwertiger Sollwert: setzt man
 * die Randwerte der Achse in die Gleichung, muessen exakt die Randwerte der
 * abgedruckten Spanne herauskommen. Acht Randwerte, acht Pruefungen.
 *
 * Das ist der staerkere Beleg als ein Anwendungsbeispiel es waere, denn er
 * prueft die Gleichung an BEIDEN Enden ihres Geltungsbereichs.
 *
 * Dazu: der Negativtest zur Einheit, die multiplikative Korrektur gegen eine
 * Handrechnung, und die Spannenform gegen ihre eigene Verweigerung.
 */

import { auswerten } from '../lib/swf_modelle.js';

let fehler = 0, geprueft = 0;

function pruefe(name, ist, soll, stellen = 2) {
  geprueft++;
  const a = typeof ist === 'number' ? Number(ist.toFixed(stellen)) : ist;
  const b = typeof soll === 'number' ? Number(soll.toFixed(stellen)) : soll;
  const ok = a === b;
  if (!ok) fehler++;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name.padEnd(58)} ist ${a}  soll ${b}`);
}

/* ══════════════════════════════════════════════════════════════════════
 * 1 · log_1d gegen die abgedruckten Spannen des GMB Worms
 *
 * Quelle: Gutachterausschuss Stadt Worms, Liegenschaftszinssaetze.
 * Je Kategorie sind Gueltigkeitsbereich der relativen Restnutzungsdauer
 * UND die resultierende Zinssatzspanne abgedruckt.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n1 · log_1d — Worms, acht abgedruckte Randwerte');

const WORMS = [
  { bez: 'efh',            a: -0.947,  b: 7.206,  von: 30, bis: 85, sVon: 3.99, sBis: 3.00 },
  { bez: 'we_v 40-128 m2', a: -0.7522, b: 6.9911, von: 35, bis: 75, sVon: 4.32, sBis: 3.74 },
];

for (const w of WORMS) {
  const m = { form: 'log_1d', liefert: 'prozent', a: w.a, b: w.b,
              eingang: 'rel_rnd_prozent', achse_feld: 'rel_rnd_prozent',
              eingang_bez: 'relative Restnutzungsdauer in Prozent',
              gueltig: [w.von, w.bis], rundung_stellen: 2,
              kennzahl: 'liegenschaftszinssatz' };

  const rVon = auswerten(m, { rel_rnd_prozent: w.von });
  const rBis = auswerten(m, { rel_rnd_prozent: w.bis });
  /* dokumentwert ist die Zahl, wie der Bericht sie druckt (Prozent).
   * wert ist der Faktor — 3,99 % werden zu 0,0399. */
  pruefe(`${w.bez}: rel. RND ${w.von} % -> Zinssatz`, rVon.dokumentwert, w.sVon);
  pruefe(`${w.bez}: rel. RND ${w.bis} % -> Zinssatz`, rBis.dokumentwert, w.sBis);
  pruefe(`${w.bez}: Umrechnung in den Faktor`, rVon.wert, w.sVon / 100, 4);

  /* Monotonie: der Zinssatz MUSS mit steigender Restnutzungsdauer fallen
   * (a ist negativ). Eine Zeile mit positivem a hat der Erntelauf genau
   * deshalb verworfen. */
  pruefe(`${w.bez}: faellt ueber die Achse`, rVon.dokumentwert > rBis.dokumentwert, true);

  /* Extrapolationssperre in beide Richtungen. */
  pruefe(`${w.bez}: unterhalb ${w.von} wird nicht gerechnet`,
    auswerten(m, { rel_rnd_prozent: w.von - 1 }).grund,
    'ausserhalb_des_gueltigkeitsbereichs');
  pruefe(`${w.bez}: oberhalb ${w.bis} wird nicht gerechnet`,
    auswerten(m, { rel_rnd_prozent: w.bis + 1 }).grund,
    'ausserhalb_des_gueltigkeitsbereichs');
}

/* ── Der Negativtest zur Einheit ────────────────────────────────────────
 * Setzt man die relative Restnutzungsdauer als Dezimalbruch statt als
 * Prozentzahl ein, kommt 8,35 % heraus statt 3,99 %. Der Wert ist
 * plausibel — und falsch. Genau diese Verwechslung hat der Erntelauf am
 * Dokument gefangen. */
console.log('\n   Negativtest Einheit (0,30 statt 30):');
{
  const m = { form: 'log_1d', liefert: 'prozent', a: -0.947, b: 7.206,
              achse_feld: 'rel_rnd_prozent', rundung_stellen: 2,
              kennzahl: 'liegenschaftszinssatz' };   /* ohne gueltig-Band */
  const r = auswerten(m, { rel_rnd_prozent: 0.30 });
  pruefe('Dezimalbruch liefert 8,35 statt 3,99', r.dokumentwert, 8.35);
  pruefe('mit Gueltigkeitsband wird er abgewiesen',
    auswerten({ ...m, gueltig: [30, 85] }, { rel_rnd_prozent: 0.30 }).grund,
    'ausserhalb_des_gueltigkeitsbereichs');
}

/* x <= 0 ist kein Rechenfall. */
pruefe('ln(0) wird nicht gerechnet',
  auswerten({ form: 'log_1d', a: -0.947, b: 7.206, achse_feld: 'x',
              kennzahl: 'liegenschaftszinssatz' }, { x: 0 }).grund,
  'achse_nicht_positiv');

/* ══════════════════════════════════════════════════════════════════════
 * 2 · Multiplikative Korrekturen
 *
 * Kiel druckt seine Zu-/Abschlaege als FAKTOREN ab. Handrechnung:
 * Tabellenwert 1,00, zwei Faktoren 0,89 und 1,16 -> 1,00 * 0,89 * 1,16
 * = 1,0324 -> auf zwei Stellen 1,03.
 * Additiv verrechnet kaeme 1,00 + 0,89 + 1,16 = 3,05 heraus — ein Wert,
 * der im Plausibilitaetsband [0,1 ; 5,0] liegt und keiner Monotonie- oder
 * Zaehlpruefung auffaellt. Das ist der Grund fuer diese Pruefung.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n2 · multiplikative Korrekturen');
{
  const mul = {
    form: 'konstante', wert: 1.00, liefert: 'faktor', rundung_stellen: 2,
    kennzahl: 'sachwertfaktor',
    korrekturen: [
      { bez: 'zwei Wohneinheiten', feld: 'we', wirkung: 'multiplikativ',
        stufen: { '1': 1.00, '2': 0.89 }, rundung_stellen: 2 },
      { bez: 'guter Gebaeudezustand', feld: 'zustand', wirkung: 'multiplikativ',
        stufen: { '2': 1.00, '3': 1.16 }, rundung_stellen: 2 },
    ],
  };
  pruefe('1,00 x 0,89 x 1,16 = 1,03',
    auswerten(mul, { we: 2, zustand: 3 }).dokumentwert, 1.03);
  pruefe('nur eine Korrektur erfasst: 1,00 x 0,89',
    auswerten(mul, { we: 2 }).dokumentwert, 0.89);
  pruefe('die offene Korrektur wird ausgewiesen',
    auswerten(mul, { we: 2 }).korrekturen_offen.length, 1);
  pruefe('beide werden als multiplikativ gezaehlt',
    auswerten(mul, { we: 2, zustand: 3 }).korrekturen_multiplikativ, 2);
  pruefe('der Rechenweg nennt das Malzeichen',
    auswerten(mul, { we: 2, zustand: 3 }).rechenweg.includes('×'), true);

  /* Ohne `wirkung` bleibt es additiv — das ist das Verhalten seit v1083
   * (Herford, Hoexter, Dortmund) und darf sich nicht aendern. */
  const add = { ...mul, korrekturen: mul.korrekturen.map(
    ({ wirkung, ...rest }) => ({ ...rest, stufen: { '1': 0, '2': 0.05 } })) };
  pruefe('ohne wirkung wird weiter addiert: 1,00 + 0,05 + 0,05',
    auswerten(add, { we: 2, zustand: 2 }).dokumentwert, 1.10);

  /* Ein Faktor <= 0 ist kein Rechenfall. */
  pruefe('Faktor 0 wird verworfen',
    auswerten({ ...mul, korrekturen: [{ bez: 'x', feld: 'we',
      wirkung: 'multiplikativ', stufen: { '2': 0 } }] }, { we: 2 }).grund,
    'korrektur_unplausibel');

  /* Auf einem Zuschlag in Prozentpunkten waere Multiplizieren eine
   * Doppelzaehlung — Dortmund fuehrt seine Zu-/Abschlaege so. */
  pruefe('multiplikativ auf zuschlag_prozent wird abgewiesen',
    auswerten({ form: 'konstante', wert: 10, liefert: 'zuschlag_prozent',
      kennzahl: 'sachwertfaktor',
      korrekturen: [{ bez: 'x', feld: 'we', wirkung: 'multiplikativ',
                      stufen: { '2': 1.1 } }] }, { we: 2 }).grund,
    'multiplikativ_auf_zuschlag');
}

/* ══════════════════════════════════════════════════════════════════════
 * 3 · spanne_kategorial — die Form, die nicht rechnet
 *
 * Saarbruecken, Eigentumswohnungen: "2,0 – 4,5". Kein Median, kein Mittel.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n3 · spanne_kategorial — Saarbruecken');
{
  const sp = { form: 'spanne_kategorial', liefert: 'prozent',
               kennzahl: 'liegenschaftszinssatz',
               spanne: [2.0, 4.5], spanne_wortlaut: '2,0 – 4,5' };
  const r = auswerten(sp, {});
  pruefe('liefert KEINEN Wert', r.wert, null);
  pruefe('nennt den Grund nur_spanne', r.grund, 'nur_spanne');
  pruefe('reicht die Spanne durch', JSON.stringify(r.spanne), '[2,4.5]');
  pruefe('der Wortlaut der Quelle reist mit', r.spanne_wortlaut, '2,0 – 4,5');
  pruefe('ohne Spanne: eigener Grund',
    auswerten({ form: 'spanne_kategorial' }, {}).grund, 'spanne_fehlt');
}

/* ══════════════════════════════════════════════════════════════════════
 * 4 · Was vorher lief, laeuft weiter — die Regression
 *
 * Herford: Tabellenwert 0,899, Korrektur -0,01, Ergebnis 0,889.
 * ZWEISTELLIG gerundete Korrektur, ERST DANN summiert. Wer erst summiert
 * und dann rundet, kommt auf 0,89 — eine andere Zahl.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n4 · Regression: additive Kette unveraendert (Herford)');
{
  const hf = { form: 'konstante', wert: 0.899, liefert: 'faktor',
               rundung_stellen: 3, kennzahl: 'sachwertfaktor',
               korrekturen: [
                 { bez: 'kRnd', feld: 'rnd', stufen: { '40': -0.01 },
                   rundung_stellen: 2 },
                 { bez: 'kBgf', feld: 'bgf', stufen: { '350': 0.00 },
                   rundung_stellen: 2 },
               ] };
  pruefe('0,899 + (−0,01) + 0,00 = 0,889',
    auswerten(hf, { rnd: 40, bgf: 350 }).dokumentwert, 0.889, 3);
  pruefe('keine multiplikative Korrektur gezaehlt',
    auswerten(hf, { rnd: 40, bgf: 350 }).korrekturen_multiplikativ, 0);
}

console.log(`\n${geprueft} Pruefungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
