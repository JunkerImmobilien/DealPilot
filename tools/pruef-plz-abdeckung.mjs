#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   v1837 · DECKT DIE PLZ-TABELLE DEUTSCHLAND AB?
   ═══════════════════════════════════════════════════════════════════════

   GEMESSEN am 04.10.2026: `_plzToBundesland` in bodenrichtwert.js hatte
   vier Lücken mit zusammen 11.000 Postleitzahlen — darunter Köln, Bonn,
   Aachen, Siegen, Hamm, Ulm und Würzburg. Für jede davon war der
   BORIS-Abruf gesperrt, weil die Funktion `null` gab und null hier
   „nicht verfügbar" heißt.

     > Eine Tabelle, die Bereiche aufzählt, hat ihre Lücken dort, wo
     > niemand hingesehen hat. Sie fallen nicht auf, weil jede einzelne
     > Zeile richtig ist — erst das Durchzählen zeigt sie.

   Dieser Prüfer liest die ECHTE Funktion aus der echten Datei, zählt
   alle Postleitzahlen von 01000 bis 99999 durch und meldet jede Lücke
   ab 100 zusammenhängenden Nummern.

   Aufruf:  node tools/pruef-plz-abdeckung.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATEI = join(HIER, '..', 'frontend', 'js', 'bodenrichtwert.js');
const quelle = readFileSync(DATEI, 'utf8');

/* Die Funktion wird AUS DER DATEI geholt und ausgeführt, nicht nachgebaut.
   Ein Nachbau prüft den Nachbau — das ist hier schon schiefgegangen. */
const von = quelle.indexOf('function _plzToBundesland');
if (von < 0) { console.log('ABBRUCH: _plzToBundesland nicht gefunden.'); process.exit(2); }
let tiefe = 0, bis = -1;
for (let i = quelle.indexOf('{', von); i < quelle.length; i++) {
  if (quelle[i] === '{') tiefe++;
  else if (quelle[i] === '}') { tiefe--; if (tiefe === 0) { bis = i + 1; break; } }
}
if (bis < 0) { console.log('ABBRUCH: Funktionsende nicht gefunden.'); process.exit(2); }
const fnQuelle = quelle.slice(von, bis);
const _plzToBundesland = new Function('return (' + fnQuelle + ')')();

console.log('═══ PLZ-ABDECKUNG (v1837) ═══');
console.log('Quelle: ' + DATEI);
console.log('Funktion gelesen: ' + fnQuelle.split('\n').length + ' Zeilen');

/* Deckung ansagen, bevor der Befund kommt. */
const regeln = (fnQuelle.match(/p >= \d+ && p <= \d+/g) || []).length;
console.log('Regeln in der Funktion: ' + regeln);
if (regeln < 10) {
  console.log('ABBRUCH: unter 10 Regeln gelesen — das Werkzeug hat die Funktion nicht erreicht.');
  process.exit(2);
}

/* Echte deutsche Postleitzahlen beginnen bei 01067. Alles unter 01000
   gibt es nicht; die Funktion lehnt das selbst ab, und das ist richtig. */
const luecken = [];
let start = null, zugeordnet = 0;
for (let p = 1000; p <= 99999; p++) {
  const bl = _plzToBundesland(String(p).padStart(5, '0'));
  if (!bl) { if (start === null) start = p; }
  else { zugeordnet++; if (start !== null) { luecken.push([start, p - 1]); start = null; } }
}
if (start !== null) luecken.push([start, 99999]);

/* ── NICHT JEDE LÜCKE IST EIN FEHLER ────────────────────────────────────
 *
 * Die Leitzone 05 ist in Deutschland NICHT VERGEBEN. Es gibt keine
 * Postleitzahl, die mit 05 beginnt — das steht so auch im Kommentar zu
 * `grest-plz-lookup.js` (v1823).
 *
 * Der erste Entwurf dieses Prüfers meldete sie als Lücke, und sie sah aus
 * wie die vier echten. Ein Prüfer, der Richtiges anmahnt, wird genauso
 * schnell ignoriert wie einer, der Falsches durchlässt.
 *
 *   > Ein bekannter Leerraum gehört benannt, nicht gemeldet. Sonst
 *   > gewöhnt man sich an sein Rot.
 */
const NICHT_VERGEBEN = [[5000, 5999]];
const istBekannt = (a, b) => NICHT_VERGEBEN.some(([x, y]) => a >= x && b <= y);

const gross = luecken.filter(([a, b]) => b - a + 1 >= 100 && !istBekannt(a, b));
const bekannt = luecken.filter(([a, b]) => istBekannt(a, b));
const summe = luecken.reduce((s, [a, b]) => s + (b - a + 1), 0);
const summeEcht = summe - bekannt.reduce((s, [a, b]) => s + (b - a + 1), 0);

console.log('');
console.log('Zugeordnet : ' + zugeordnet.toLocaleString('de-DE') + ' von 99.000 Nummern');
console.log('Ohne Land  : ' + summeEcht.toLocaleString('de-DE')
  + (bekannt.length ? '   (dazu ' + bekannt.map(([a,b])=>String(a).padStart(5,'0')+'–'+String(b).padStart(5,'0')).join(', ')
      + ' — in Deutschland nicht vergeben)' : ''));

/* Bekannte Städte als Stichprobe — sie machen aus einer Zahl einen Befund. */
const STICHPROBEN = [
  ['01067', 'Dresden'], ['04109', 'Leipzig'],
  /* v1837 · Die drei Faelle aus v1823 (Grunderwerbsteuer) - dort gemessen,
     hier gegengeprueft. Die Leitzone 0 ist die Stelle, an der zwei
     Tabellen in diesem Haus schon einmal auseinandergelaufen sind. */
  ['06184', 'Kabelsketal'], ['07743', 'Jena'], ['03046', 'Cottbus'],
  ['04916', 'Herzberg/Elster'], ['08056', 'Zwickau'], ['02826', 'Goerlitz'],
  ['10115', 'Berlin'], ['14467', 'Potsdam'], ['18055', 'Rostock'],
  ['20095', 'Hamburg'], ['24103', 'Kiel'], ['26122', 'Oldenburg'],
  ['28195', 'Bremen'], ['30159', 'Hannover'], ['32609', 'Hüllhorst'],
  ['34117', 'Kassel'], ['39104', 'Magdeburg'], ['40210', 'Düsseldorf'],
  ['44577', 'Castrop-Rauxel'], ['48143', 'Münster'], ['49477', 'Ibbenbüren'],
  ['50667', 'Köln'], ['52062', 'Aachen'], ['53111', 'Bonn'],
  ['55116', 'Mainz'], ['57072', 'Siegen'], ['59065', 'Hamm'],
  ['60311', 'Frankfurt'], ['66111', 'Saarbrücken'], ['70173', 'Stuttgart'],
  ['80331', 'München'], ['88045', 'Friedrichshafen'], ['89073', 'Ulm'],
  ['90402', 'Nürnberg'], ['97070', 'Würzburg'], ['99084', 'Erfurt']
];
const SOLL = { '06184':'ST', '07743':'TH', '03046':'BB', '04916':'BB',
               '08056':'SN', '02826':'SN', '04109':'SN', '50667':'NRW' };
let fehlend = 0, falsch = 0;
const zeilen = [];
for (const [plz, stadt] of STICHPROBEN) {
  const bl = _plzToBundesland(plz);
  if (!bl) { fehlend++; zeilen.push('  [NEIN] ' + plz + '  ' + stadt + ' — keine Zuordnung'); }
  else if (SOLL[plz] && SOLL[plz] !== bl) {
    falsch++;
    zeilen.push('  [NEIN] ' + plz + '  ' + stadt.padEnd(18) + bl + '  — soll ' + SOLL[plz]);
  }
  else zeilen.push('  [ok]   ' + plz + '  ' + stadt.padEnd(18) + bl
    + (SOLL[plz] ? '  (Soll getroffen)' : ''));
}
console.log('');
console.log('── Stichproben (' + STICHPROBEN.length + ' Städte) ──');
console.log(zeilen.join('\n'));

if (gross.length) {
  console.log('');
  console.log('✗ LÜCKEN ab 100 zusammenhängenden Nummern:');
  for (const [a, b] of gross) {
    console.log('    ' + String(a).padStart(5, '0') + ' – ' + String(b).padStart(5, '0')
      + '   (' + (b - a + 1).toLocaleString('de-DE') + ' Nummern)');
  }
}

console.log('');
if (fehlend === 0 && falsch === 0 && !gross.length) {
  console.log('✓ sauber: keine Stadt ohne Zuordnung, kein Soll verfehlt, keine Lücke ab 100 Nummern.');
  process.exit(0);
}
console.log('✗ ' + fehlend + ' ohne Zuordnung, ' + falsch + ' falsch zugeordnet, ' + gross.length + ' größere Lücke(n).');
process.exit(1);
