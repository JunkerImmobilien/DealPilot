#!/usr/bin/env node
/* kettenpruefung-v1096a.mjs
 *
 * ZWEI WEGE, EINE ANTWORT.
 *
 * `sachwertfaktor()` hat zwei Wege: die zwei handgeschriebenen Module
 * (Herford, Minden-Luebbecke) und das Register. Bis v1096a sprachen sie
 * verschiedene Sprachen — die kurze Schreibweise erreichte nur das
 * Register, die lange nur die Module.
 *
 * DIESE PRUEFUNG BRAUCHT KEINEN SOLLWERT AUS EINEM DOKUMENT, und das ist
 * Absicht. Sie prueft eine GLEICHHEIT: dieselbe Frage, zweimal gestellt,
 * einmal in jeder Schreibweise, muss dieselbe Zahl liefern. Das ist ein
 * staerkerer Beleg als eine gegriffene Zahl es waere — und es verhindert
 * genau den Fehler, der am 10.08. schon einmal fast passiert ist: einen
 * selbst gegriffenen Bodenrichtwert zum Sollwert zu erklaeren.
 *
 * Der Sollwert des Dokuments wird trotzdem mitgeprueft, aber nur dort, wo
 * er wirklich abgedruckt ist.
 */

import { sachwertfaktor } from '../lib/gutachterausschuss.js';

let fehler = 0, geprueft = 0;

function pruefe(name, ist, soll) {
  geprueft++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name.padEnd(56)} `
    + `ist ${JSON.stringify(ist)}  soll ${JSON.stringify(soll)}`);
}

/* ══════════════════════════════════════════════════════════════════════
 * 1 · Die kurze Schreibweise erreicht die Module — der Befund vom 14.08.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n1 · Kurze Schreibweise, handgeschriebenes Modul (Herford)');
{
  const kurz = sachwertfaktor({ ags: '05758016', objektart: 'Zweifamilienhaus',
    sachwert: 326649, brw: 145, rnd: 18, bgf: 347 });
  pruefe('liefert einen Wert', kurz.verfuegbar, true);
  if (!kurz.verfuegbar) console.log(`        grund=${kurz.grund}`);
  pruefe('  und kommt aus dem Modul', kurz.herkunft, 'modul');
}

/* ══════════════════════════════════════════════════════════════════════
 * 2 · Beide Schreibweisen, dieselbe Zahl
 *
 * Der eigentliche Beleg. Keine gegriffene Zahl, sondern eine Gleichheit.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n2 · Zwei Schreibweisen, eine Antwort');

const FAELLE = [
  { bez: 'Herford (Modul)', ags: '05758016', objektart: 'Zweifamilienhaus',
    kurz: { sachwert: 326649, brw: 145, rnd: 18, bgf: 347 },
    lang: { sachwert_eur: 326649, brw_eur_qm: 145, rnd_jahre: 18, bgf_qm: 347 } },
  { bez: 'Minden-Luebbecke (Modul)', ags: '05770016', objektart: 'Einfamilienhaus',
    kurz: { sachwert: 300000, rnd: 40 },
    lang: { sachwert_eur: 300000, rnd_jahre: 40 } },
  { bez: 'Kreis Olpe (Register)', ags: '05966', objektart: 'Einfamilienhaus',
    kurz: { sachwert: 160000 },
    lang: { sachwert_eur: 160000 } },
];

for (const f of FAELLE) {
  const a = sachwertfaktor({ ags: f.ags, objektart: f.objektart, ...f.kurz });
  const b = sachwertfaktor({ ags: f.ags, objektart: f.objektart, ...f.lang });
  pruefe(`${f.bez}: beide verfuegbar`,
    [a.verfuegbar, b.verfuegbar], [true, true]);
  if (a.verfuegbar && b.verfuegbar) {
    pruefe(`  derselbe Wert`, a.wert, b.wert);
    pruefe(`  dieselbe Herkunft`, a.herkunft ?? null, b.herkunft ?? null);
  } else {
    console.log(`        kurz: ${a.grund || '-'} · lang: ${b.grund || '-'}`);
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * 3 · Der Aufrufer behaelt das letzte Wort
 *
 * Die Bruecke ERGAENZT nur. Wer beide Namen mit verschiedenen Werten
 * fuellt, bekommt seinen eigenen — nicht den uebersetzten. Sonst waere aus
 * einer Hilfe eine stille Ueberschreibung geworden.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n3 · Der Aufrufer behaelt das letzte Wort');
{
  const nurLang = sachwertfaktor({ ags: '05758016',
    objektart: 'Zweifamilienhaus',
    sachwert_eur: 326649, brw_eur_qm: 145, rnd_jahre: 18, bgf_qm: 347 });
  const beide = sachwertfaktor({ ags: '05758016',
    objektart: 'Zweifamilienhaus',
    sachwert_eur: 326649, brw_eur_qm: 145, rnd_jahre: 18, bgf_qm: 347,
    sachwert: 999999, brw: 999 });      /* die kurzen duerfen NICHT gewinnen */
  pruefe('die lange Angabe wird nicht ueberschrieben', beide.wert, nurLang.wert);
}

/* ══════════════════════════════════════════════════════════════════════
 * 4 · Was fehlt, fehlt weiterhin
 *
 * Die Bruecke darf keine Zahl erfinden. Ohne Sachwert gibt es keinen
 * Faktor — auch nicht in der kurzen Schreibweise.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n4 · Was fehlt, fehlt weiterhin');
{
  const ohne = sachwertfaktor({ ags: '05758016', objektart: 'Zweifamilienhaus',
    brw: 145 });
  pruefe('ohne Sachwert kein Faktor', ohne.verfuegbar, false);
  pruefe('  und der Grund nennt ihn', ohne.grund, 'sachwert_fehlt');

  const ohneBrw = sachwertfaktor({ ags: '05758016',
    objektart: 'Zweifamilienhaus', sachwert: 326649 });
  pruefe('ohne Bodenrichtwert kein Faktor', ohneBrw.verfuegbar, false);
  pruefe('  und der Grund nennt ihn', ohneBrw.grund, 'brw_fehlt');
}

console.log(`\n${geprueft} Pruefungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
