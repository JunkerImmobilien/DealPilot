#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * lageklasse-ampel-pruefen.mjs — v2143
 *
 * DIE LAGEKLASSE IST DER MASSSTAB DER BRUTTOMIETRENDITE — ABER NUR DORT
 *
 * Marcel am 12.10.2026: „kann man das nicht an den Lage Klassen koppeln?
 * … da muss aber dann ein riegel rein falls die A,B oder C-Lage nicht
 * eingegeben wurde muss ein default wert angenommen werden. nur
 * beruecksichtigen."
 *
 * Und auf die Rueckfrage brutto/netto: „man koennte ja auch die
 * Bruttomietrendite der lage klassen auf die nettomietrendite
 * runterrechnen oder? was ist besser?"
 *
 * ── WAS DIESER PRUEFER SICHERT ──────────────────────────────────────
 *
 * 1. Mit Ziel misst die bmr-Ampel am Ziel, ohne Ziel an der festen
 *    Skala. Das ist der Riegel.
 * 2. Ziel GENAU erreicht ist gruen. Eine Skala, die das Ziel mit Gelb
 *    beantwortet, waere ein Widerspruch zum Wort Ziel.
 * 3. Die ANDEREN sechs Kennzahlen bleiben unberuehrt. Die Lageklasse
 *    ist in Bruttomietrendite definiert und hat mit DSCR, LTV oder
 *    Cashflow nichts zu tun.
 * 4. Der SCORE aendert sich NICHT. Das ist die Probe, die zaehlt:
 *    dieselbe Wohnung hat fuer jeden Nutzer denselben Score, sonst sind
 *    zwei Nutzer unvergleichbar und jedes gespeicherte Urteil
 *    verschiebt sich rueckwirkend (die Regel steht seit v2140).
 * 5. Die schwaechste Groesse wird mit DERSELBEN Guete bestimmt wie die
 *    Ampel - sonst nennt der Satz eine andere Groesse als die rote
 *    Ampel darueber, und beide stehen auf demselben Bildschirm.
 *
 * ── WARUM BRUTTO ────────────────────────────────────────────────────
 *
 * Gemessen (deal-kpis.js:185-187): die beiden Renditen haben
 * VERSCHIEDENE Nenner — bmy auf den Kaufpreis, nmy auf die
 * Gesamtinvestition und nach Abzug der nicht umlagefaehigen Kosten. Das
 * Verhaeltnis nmy/bmy schwankt deshalb zwischen 0,52 und 0,91.
 *
 *   > Rechnet man OBJEKTGENAU um, geben beide Wege dieselbe Note.
 *   > Rechnet man PAUSCHAL um, verschiebt sich die Note um bis zu 57
 *   > Punkte — systematisch gegen Objekte mit hoher Bewirtschaftung.
 *
 * Also brutto: es ist die Zahl, die der Nutzer eingegeben hat, sie
 * laesst sich nicht durch eine FEHLENDE Bewirtschaftungsangabe schoenen
 * (ohne BWK sieht netto besser aus), und die Bewirtschaftung steckt im
 * Score ohnehin im Cashflow und in der eigenen BWK-Ampel.
 *
 * Gerufen wird der ECHTE, gespiegelte Kern.
 * ══════════════════════════════════════════════════════════════════════ */
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(path.join(process.cwd(), 'backend', 'src', 'x.js'));
const rk = require_('./services/rechenkerne.js');

let rot = 0;
const melde = (ok, txt) => { if (!ok) rot++; console.log('  ' + (ok ? 'ok  ' : 'ROT ') + txt); };

/* Ein Objekt mit 6,27 % brutto — dieselbe Wohnung in drei Lagen. */
const BASIS = { bmr: 6.27, nmr: 4.46, ekr: 5.1, cfMon: 740,
                dscr: 1.18, ltv: 88.4, bewirtPctNkm: 21.3 };

function ampel(ueber) {
  return rk.heuristikTeil('kennzahlenAmpel', Object.assign({}, BASIS, ueber || {}), undefined);
}
const bmrVon = (a) => a.find((x) => x.id === 'bmr');

console.log('=== 1 · Der Riegel: ohne Ziel die feste Skala ===');
const ohne = bmrVon(ampel({}));
melde(ohne.ampel === 'gelb' || ohne.ampel === 'gruen', 'ohne Ziel: Ampel ' + ohne.ampel);
melde(/3 % = 0 Pkt/.test(ohne.skala), 'und die feste Skala steht dran: "' + ohne.skala + '"');
melde(ohne.am_ziel === undefined, 'am_ziel ist NICHT gesetzt');
const leer = bmrVon(ampel({ zielBmr: null }));
melde(leer.skala === ohne.skala, 'zielBmr null wirkt wie gar kein Ziel');
const krumm = bmrVon(ampel({ zielBmr: 0 }));
melde(krumm.skala === ohne.skala, 'zielBmr 0 wird abgewiesen (nicht "Ziel 0 %")');
const text = bmrVon(ampel({ zielBmr: 'keine Zahl' }));
melde(text.skala === ohne.skala, 'unsinniger Wert wird abgewiesen');

console.log('\n=== 2 · Dieselbe Wohnung in drei Lagen ===');
const lagen = [['A', 3.5, 'gruen'], ['B', 5.0, 'gruen'], ['C', 7.0, 'gelb']];
lagen.forEach(function (l) {
  const a = bmrVon(ampel({ zielBmr: l[1], lageklasse: l[0] }));
  const quote = Math.round(BASIS.bmr / l[1] * 100);
  melde(a.ampel === l[2], l[0] + '-Lage (Ziel ' + l[1] + ' %): ' + quote + ' % des Ziels -> '
    + a.ampel + ' (erwartet ' + l[2] + ')');
  melde(a.am_ziel === true, '   am_ziel gesetzt');
  melde(a.skala.indexOf(l[0] + '-Lage') >= 0, '   die Skala nennt die Klasse: "' + a.skala + '"');
});

console.log('\n=== 3 · Ziel genau erreicht ist GRUEN ===');
/* Die Ampel wird ab Guete 0,75 gruen; die Skala gibt bei q=1,0 genau
   0,80. Eine Skala, die das Ziel mit Gelb beantwortet, waere ein
   Widerspruch zum Wort Ziel. */
const genau = bmrVon(ampel({ zielBmr: 6.27, lageklasse: 'B' }));
melde(genau.ampel === 'gruen', 'Ziel exakt getroffen (6,27 / 6,27): ' + genau.ampel);
const knapp = bmrVon(ampel({ zielBmr: 7.84, lageklasse: 'C' }));   /* 80 % des Ziels */
melde(knapp.ampel === 'gelb', '80 % des Ziels: ' + knapp.ampel);
const weit = bmrVon(ampel({ zielBmr: 11.0, lageklasse: 'C' }));    /* 57 % des Ziels */
melde(weit.ampel === 'rot', '57 % des Ziels: ' + weit.ampel);

console.log('\n=== 4 · Die anderen sechs bleiben unberuehrt ===');
const mit = ampel({ zielBmr: 3.5, lageklasse: 'A' });
const ohneA = ampel({});
['nmr', 'ekr', 'cf', 'dscr', 'ltv', 'bwk'].forEach(function (id) {
  const a = mit.find((x) => x.id === id), b = ohneA.find((x) => x.id === id);
  melde(a.ampel === b.ampel && a.skala === b.skala,
    id.padEnd(5) + ' unveraendert (' + a.ampel + ', Skala gleich)');
});

console.log('\n=== 5 · DIE PROBE, DIE ZAEHLT: der Score bleibt gleich ===');
const eingabe = { kp: 180000, cf_m: 740, nmy: 4.46, ltv: 88.4, dscr: 1.18,
                  wp_kpi: 9000, mstg: 1.5 };
const s1 = rk.score(eingabe).score;
const s2 = rk.score(Object.assign({}, eingabe, { zielBmr: 3.5, lageklasse: 'A' })).score;
const s3 = rk.score(Object.assign({}, eingabe, { zielBmr: 7.0, lageklasse: 'C' })).score;
melde(s1 === s2 && s2 === s3,
  'Score mit A-Lage, C-Lage und ohne: ' + s1 + ' / ' + s2 + ' / ' + s3 + ' — alle gleich');
console.log('       Der Score sieht die Einstellungen nie. Dieselbe Wohnung hat');
console.log('       fuer jeden Nutzer denselben Score (Regel seit v2140).');

console.log('\n=== 6 · Die schwaechste Groesse misst am selben Mass ===');
/* Ein Objekt, das in C-Lage sein Ziel deutlich verfehlt: dort muss die
   Bruttomietrendite als schwaechste Groesse auftauchen. */
const schwachD = { bmr: 3.6, nmr: 2.4, ekr: 4.0, cfMon: 180,
                   dscr: 1.30, ltv: 70, bewirtPctNkm: 20 };
const ohneZ = rk.heuristikTeil('schwaechstePunkte', schwachD, undefined, 3);
const mitZ = rk.heuristikTeil('schwaechstePunkte',
  Object.assign({}, schwachD, { zielBmr: 7.0, lageklasse: 'C' }), undefined, 3);
const drinOhne = ohneZ.some((x) => x.id === 'bmr');
const drinMit = mitZ.some((x) => x.id === 'bmr');
console.log('       ohne Ziel: ' + ohneZ.map((x) => x.id).join(', '));
console.log('       mit C-Ziel: ' + mitZ.map((x) => x.id).join(', '));
melde(drinMit, 'mit C-Ziel (3,6 von 7,0 = 51 %) ist die bmr unter den schwaechsten');
const bmrMit = mitZ.find((x) => x.id === 'bmr');
const bmrOhne = ohneZ.find((x) => x.id === 'bmr');
if (bmrMit && bmrOhne) {
  /* 3,6 von 7,0 sind 51 % des Ziels — die Skala beginnt bei 50 %, also
     ist die Guete fast null. An der FESTEN Skala (3 % = 0, 7 % = 100)
     waeren es 0,15. Das C-Ziel urteilt also schaerfer, und genau das
     ist der Zweck: in einer C-Lage erwartet man den Risikoaufschlag. */
  melde(bmrMit.guete < bmrOhne.guete,
    '   und das C-Ziel urteilt schaerfer als die feste Skala ('
    + bmrMit.guete.toFixed(3) + ' gegen ' + bmrOhne.guete.toFixed(3) + ')');
  melde(bmrMit.guete < 0.1, '   Guete ' + bmrMit.guete.toFixed(3) + ' — 51 % des Ziels');
}

console.log('\n=== 7 · Die Knickpunkte liegen NICHT auf den Ampelschwellen ===');
/* v2143a: der erste Entwurf begann bei 60 % und traf bei genau 80 % des
   Ziels die Guete 0,3994 — die Gelb-Schwelle liegt bei 0,40. Ein
   Tausendstel entschied die Farbe. Diese Probe haelt fest, dass der
   Verlauf jetzt eindeutig ist. */
const verlauf = [[60, 'rot'], [70, 'rot'], [75, 'gelb'], [80, 'gelb'],
                 [90, 'gelb'], [97, 'gruen'], [100, 'gruen'], [150, 'gruen']];
verlauf.forEach(function (v) {
  const a = bmrVon(ampel({ zielBmr: BASIS.bmr / (v[0] / 100), lageklasse: 'B' }));
  melde(a.ampel === v[1], String(v[0]).padStart(4) + ' % des Ziels -> ' + a.ampel
    + (a.ampel === v[1] ? '' : ' (erwartet ' + v[1] + ')'));
});

console.log('\n=== Deckung ===');
console.log('  Kern            : der ECHTE, gespiegelte (services/rechenkerne.js)');
console.log('  Lagen geprueft  : A 3,5 · B 5,0 · C 7,0 (die Vorgaben aus lage-profil.js)');
console.log('  Riegel          : 4 Lagen (kein Ziel, null, 0, unsinniger Wert)');
console.log('  unberuehrt      : 6 andere Kennzahlen');
console.log('  Score           : 3 Lagen, alle gleich');

console.log('\n' + (rot === 0
  ? 'SAUBER — die Lage misst die Ampel, nicht den Score.'
  : 'ROT — ' + rot + ' Probe(n).'));
process.exit(rot ? 1 : 0);
