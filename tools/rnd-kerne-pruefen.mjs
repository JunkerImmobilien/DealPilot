#!/usr/bin/env node
/**
 * tools/rnd-kerne-pruefen.mjs — v1966
 * ═══════════════════════════════════════════════════════════════════════
 * HAELT DIE ANLAGE-2-KERNE ZUSAMMEN.
 *
 * Es gibt im Haus zwei Umsetzungen der Anlage 2 ImmoWertV, und sie muessen
 * es bleiben: das Backend-Image kopiert `frontend/` nicht.
 *
 *   frontend/js/rnd-calc.js                      DealPilotRND  (Anzeige, Gutachten)
 *   marktbericht/backend/src/lib/anlage2.js      restnutzungsdauer (rechnet den Sachwert)
 *
 * Optional als DRITTER Vergleich das gelieferte Standalone-Modul
 * (`--modul <pfad/zu/calc-rnd.js>`), damit ein neuer Stand von dort
 * gegengerechnet werden kann, bevor er uebernommen wird.
 *
 * WARUM DIESER PRUEFER EXISTIERT
 * ------------------------------
 * Am 08.10.2026 fand sich in `rnd-calc.js` ein Tippfehler: bei 12
 * Modernisierungspunkten stand `b: 0.8810` statt `b: 0.8080` — die Zahl der
 * Zeile darueber, ein zweites Mal. Die Restnutzungsdauer fiel dadurch bei
 * genau dieser einen Punktzahl um bis zu 4,5 Jahre zu niedrig aus.
 *
 * Der vorhandene Pruefer (tools/rnd-pruefung/, 22 Faelle gegen drei
 * unterschriebene Gutachten) hat ihn nicht gefunden: unter den 22 Faellen
 * war kein Objekt mit 12 Modernisierungspunkten. Er war gruen und hat seine
 * LUECKE nicht genannt.
 *
 *   > Ein Pruefer, der seine Deckung nicht nennt, beweist nichts.
 *
 * Dieser hier faehrt deshalb ALLE 21 Punktzahlen ab und sagt am Ende, wie
 * viele Faelle er geprueft hat.
 *
 * WAS GEPRUEFT WIRD
 * -----------------
 *  1. Die Koeffizienten-Tabelle Zeile fuer Zeile (21 x 4 Werte).
 *  2. Die STRUKTUR der Reihen a, b, c — sie bestehen aus arithmetischen
 *     Abschnitten. Ein verdoppelter oder verschluckter Wert zerstoert die
 *     Schrittweite und fallt hier auf, ohne dass jemand den
 *     Verordnungstext gegenliest. Genau so wurde der Fehler oben gefunden.
 *  3. Das Ergebnis je Fall ueber ein Raster aus Baujahren x Punktzahlen x
 *     Gesamtnutzungsdauern.
 *  4. MONOTONIE: bei gleicher Punktzahl darf ein AELTERES Gebaeude nie mehr
 *     Restnutzungsdauer bekommen. Daran ist die Extrapolation hinter dem
 *     Scheitel der Parabel aufgefallen (28 Faelle).
 *
 * RC=0 ist sauber. Jede Abweichung ist rot.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const holArg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const modulPfad = holArg('--modul');
const leise = argv.includes('--leise');

const P_FRONT = path.join(WURZEL, 'frontend/js/rnd-calc.js');
const P_BACK = path.join(WURZEL, 'marktbericht/backend/src/lib/anlage2.js');

let fehler = 0;
const rot = (s) => { fehler++; console.log('  ROT  ' + s); };

/* ── Die Browser-Module sind IIFEs auf `global`. In einem eigenen
      Sandkasten laden, damit sie sich nicht gegenseitig ueberschreiben. ── */
function ladeGlobal(pfad, name) {
  const quelle = fs.readFileSync(pfad, 'utf8');
  const g = {};
  new Function('window', 'globalThis', 'global', 'self', quelle)(g, g, g, g);
  if (!g[name]) {
    throw new Error(pfad + ': ' + name + ' nicht gesetzt (geladen: '
      + Object.keys(g).join(', ') + ')');
  }
  return g[name];
}

const FRONT = ladeGlobal(P_FRONT, 'DealPilotRND');
const { restnutzungsdauer: BACK } = await import('file://' + P_BACK.replace(/\\/g, '/'));
const MODUL = modulPfad ? ladeGlobal(path.resolve(modulPfad), 'VW_CALC_RND') : null;

console.log('rnd-kerne-pruefen v1966');
console.log('  frontend/js/rnd-calc.js                  V' + FRONT.VERSION);
console.log('  marktbericht/.../lib/anlage2.js           geladen');
console.log('  ' + (MODUL ? 'Modul ' + modulPfad : 'kein --modul angegeben (nur zwei Kerne)'));
console.log('');

/* ═══ 1 · Koeffizienten Zeile fuer Zeile ═══════════════════════════════ */
const tabFront = FRONT.PUNKTRASTER_KOEFF;
if (!Array.isArray(tabFront) || tabFront.length !== 21) {
  rot('rnd-calc.js: PUNKTRASTER_KOEFF hat ' + (tabFront ? tabFront.length : '?') + ' Zeilen, nicht 21');
}
/* Die Tabelle des Backends steht nicht als Export bereit — sie wird aus der
   Datei gelesen. Das ist Absicht: so prueft dieser Lauf die ECHTE Datei und
   nicht eine Kopie, die ich hier hinschreibe. */
const backQuelle = fs.readFileSync(P_BACK, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tabBack = [...backQuelle.matchAll(
  /\{ a: ([\d.]+), b: ([\d.]+), c: ([\d.]+), abRelAlter: (\d+) \}/g)]
  .map((m) => ({ a: +m[1], b: +m[2], c: +m[3], rel: +m[4] }));
if (tabBack.length !== 21) rot('anlage2.js: ' + tabBack.length + ' Koeffizienten-Zeilen gelesen, nicht 21');

let koefAbw = 0;
for (let p = 0; p < Math.min(21, tabFront.length, tabBack.length); p++) {
  const f = tabFront[p], b = tabBack[p];
  if (f.a !== b.a || f.b !== b.b || f.c !== b.c || f.rel !== b.rel) {
    koefAbw++;
    rot('Koeffizient P' + p + ': rnd-calc a=' + f.a + ' b=' + f.b + ' c=' + f.c + ' rel=' + f.rel
      + '  |  anlage2 a=' + b.a + ' b=' + b.b + ' c=' + b.c + ' rel=' + b.rel);
  }
  if (MODUL && MODUL.KOEF && MODUL.KOEF[p]) {
    const m = MODUL.KOEF[p];
    if (f.a !== m.a || f.b !== m.b || f.c !== m.c || f.rel !== m.minRelAlter) {
      koefAbw++;
      rot('Koeffizient P' + p + ' gegen das Modul: rnd-calc b=' + f.b + '  |  Modul b=' + m.b);
    }
  }
}
console.log('1 · Koeffizienten-Tabelle (21 Zeilen x 4 Werte): '
  + (koefAbw ? koefAbw + ' Abweichungen' : 'identisch'));

/* ═══ 2 · Struktur der Reihen ══════════════════════════════════════════
   Jede der drei Reihen besteht aus arithmetischen Abschnitten. Geprueft
   wird nicht ein erwarteter Wert, sondern dass die Schrittweite innerhalb
   eines Abschnitts KONSTANT bleibt. Eine verdoppelte Zahl erzeugt einen
   Schritt 0 und danach einen doppelten — genau das Muster des Fehlers
   vom 08.10.2026:

     P10->P11 0.0730   P11->P12 0.0000   P12->P13 0.1460

   Ein Abschnittswechsel ist erlaubt (die Reihe b wechselt bei P4, P8 und
   P13), ein Schritt 0 mitten in der Reihe nicht. */
let strukturAbw = 0;
for (const reihe of ['a', 'b', 'c']) {
  const w = tabFront.map((x) => x[reihe]);
  for (let i = 1; i < 20; i++) {
    const vor = Math.round((w[i - 1] - w[i]) * 100000) / 100000;
    const nach = Math.round((w[i] - w[i + 1]) * 100000) / 100000;
    /* Ein Schritt 0 ist nur am ANFANG (P0/P1 sind in der Verordnung gleich)
       und am ENDE (P18..P20 sind gleich) vorgesehen. */
    if (vor === 0 && i > 1 && i < 18) {
      strukturAbw++;
      rot('Reihe ' + reihe + ': kein Schritt zwischen P' + (i - 1) + ' und P' + i
        + ' (' + w[i - 1] + ' steht zweimal) — danach Schritt ' + nach);
    }
    if (vor !== 0 && nach !== 0 && i > 1 && i < 18) {
      const q = nach / vor;
      /* Ein Abschnittswechsel aendert die Schrittweite; ein VERSCHLUCKTER
         Wert verdoppelt sie bei gleichbleibendem Abschnitt. Gemeldet wird
         deshalb nur das exakte Doppelte. */
      if (Math.abs(q - 2) < 1e-9) {
        strukturAbw++;
        rot('Reihe ' + reihe + ': Schritt P' + i + '->P' + (i + 1) + ' ist genau das '
          + 'Doppelte des vorigen (' + vor + ' -> ' + nach + ') — ein Wert fehlt');
      }
    }
  }
}
console.log('2 · Struktur der Reihen a, b, c (Schrittweiten): '
  + (strukturAbw ? strukturAbw + ' Auffaelligkeiten' : 'sauber'));

/* ═══ 3 · Ergebnisraster ═══════════════════════════════════════════════ */
const JAHR = 2026;
const BAUJAHRE = [2024, 2020, 2015, 2010, 2005, 2000, 1995, 1990, 1985, 1980,
                  1975, 1970, 1964, 1960, 1955, 1950, 1945, 1935, 1925, 1905, 1890];
const GNDS = [80, 70, 60, 50];
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

let faelle = 0, abwErgebnis = 0, verweigertBeide = 0, verweigertEiner = 0;
const zeigen = [];

for (const gnd of GNDS) {
  for (const bj of BAUJAHRE) {
    const alter = JAHR - bj;
    for (let p = 0; p <= 20; p++) {
      faelle++;
      const f = FRONT.calcPunktraster(alter, gnd, p, false);
      const b = BACK({ gnd, alter, punkte: p, kernsaniert: false });

      /* Beide Kerne verweigern jenseits der GND. Nur `ueber_gnd` ist eine
         echte Verweigerung — `unter_schwelle` liefert GND minus Alter und
         ist ein gueltiges Ergebnis. */
      const fVerweigert = f.grenze === 'ueber_gnd';
      const bVerweigert = !b || b.rnd == null;

      if (fVerweigert && bVerweigert) { verweigertBeide++; continue; }
      if (fVerweigert !== bVerweigert) {
        verweigertEiner++;
        if (zeigen.length < 12) zeigen.push('  GND ' + gnd + ' Bj ' + bj + ' Alter ' + alter + ' P' + p
          + ': rnd-calc ' + (fVerweigert ? 'verweigert' : r2(f.restnutzungsdauer))
          + '  |  anlage2 ' + (bVerweigert ? 'verweigert' : r2(b.rnd)));
        continue;
      }
      /* anlage2.js rundet INTERN auf eine Dezimale, rnd-calc auf zwei.
         Eine Differenz von einem Zehntel ist deshalb kein Befund, sondern
         die Rundung — 32,2 gegen 32,1 ist derselbe Wert.

         Die Schwelle traegt ein Epsilon: `Math.abs(32.2 - 32.1)` ergibt in
         Gleitkomma 0.10000000000000142 und ist damit groesser als 0.1. Ohne
         das Epsilon meldete dieser Lauf 9 Abweichungen, die keine waren —
         der Pruefer hatte seine eigene Rundung nicht eingerechnet. */
      const fW = Math.round(f.restnutzungsdauer * 10) / 10;
      const bW = Math.round(b.rnd * 10) / 10;
      if (Math.abs(fW - bW) > 0.1 + 1e-9) {
        abwErgebnis++;
        if (zeigen.length < 12) zeigen.push('  GND ' + gnd + ' Bj ' + bj + ' Alter ' + alter + ' P' + p
          + ': rnd-calc ' + fW + '  |  anlage2 ' + bW);
      }
    }
  }
}
if (verweigertEiner) rot(verweigertEiner + ' Faelle, in denen nur EIN Kern verweigert');
if (abwErgebnis) rot(abwErgebnis + ' Faelle mit abweichendem Ergebnis');
zeigen.forEach((z) => console.log(z));
console.log('3 · Ergebnisraster: ' + faelle + ' Faelle (' + BAUJAHRE.length + ' Baujahre x 21 Punktzahlen x '
  + GNDS.length + ' GND), davon ' + verweigertBeide + ' von beiden verweigert');

/* ═══ 4 · Monotonie ════════════════════════════════════════════════════
   Bei gleicher Punktzahl und gleicher GND darf ein AELTERES Gebaeude nie
   mehr Restnutzungsdauer bekommen. Hieran ist die Extrapolation hinter
   dem Scheitel aufgefallen. Geprueft werden BEIDE Kerne. */
let nichtMonoton = 0;
for (const [name, ruf] of [
  ['rnd-calc.js', (alter, gnd, p) => {
    const x = FRONT.calcPunktraster(alter, gnd, p, false);
    return x.grenze === 'ueber_gnd' ? null : x.restnutzungsdauer;
  }],
  ['anlage2.js', (alter, gnd, p) => {
    const x = BACK({ gnd, alter, punkte: p, kernsaniert: false });
    return x && x.rnd != null ? x.rnd : null;
  }],
  ...(MODUL ? [['Modul calc-rnd.js', (alter, gnd, p) => {
    const x = MODUL.verfahrenPunktraster(alter, gnd, p, false);
    return x ? x.rnd : null;
  }]] : []),
]) {
  for (const gnd of GNDS) {
    for (let p = 0; p <= 20; p++) {
      let vorAlter = null, vorWert = null;
      for (const bj of [...BAUJAHRE].sort((x, y) => y - x)) {   /* jung -> alt */
        const alter = JAHR - bj;
        const w = ruf(alter, gnd, p);
        if (w == null) { vorAlter = null; vorWert = null; continue; }
        if (vorWert != null && w > vorWert + 1e-9) {
          nichtMonoton++;
          if (nichtMonoton <= 8) {
            rot(name + ': GND ' + gnd + ' P' + p + ' — Alter ' + vorAlter + ' -> '
              + r2(vorWert) + ' Jahre, aber Alter ' + alter + ' -> ' + r2(w)
              + ' Jahre. Das aeltere Gebaeude bekommt MEHR.');
          }
        }
        vorAlter = alter; vorWert = w;
      }
    }
  }
}
if (nichtMonoton > 8) console.log('  ... und ' + (nichtMonoton - 8) + ' weitere');
console.log('4 · Monotonie (aelter darf nie mehr RND geben): '
  + (nichtMonoton ? nichtMonoton + ' Verstoesse' : 'eingehalten'));

/* ═══ Ergebnis ═════════════════════════════════════════════════════════ */
console.log('');
console.log('DECKUNG: ' + faelle + ' Faelle, ' + (MODUL ? 3 : 2) + ' Kerne, '
  + 'alle 21 Punktzahlen, ' + GNDS.length + ' Gesamtnutzungsdauern.');
if (fehler) {
  console.log('ERGEBNIS: ' + fehler + ' Befund(e) — ROT');
  process.exit(1);
}
console.log('ERGEBNIS: sauber');
if (!leise) {
  console.log('');
  console.log('Hinweis: dieser Lauf prueft die UEBEREINSTIMMUNG und die Plausibilitaet,');
  console.log('nicht die Richtigkeit gegen den Verordnungstext. Dafuer sind die');
  console.log('Gutachten-Faelle in tools/rnd-pruefung/ da — beide zusammen, nicht');
  console.log('eines statt des anderen.');
}
