#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/rnd-strecke-pruefen.mjs · v2974 (27.10.2026)

   Marcel: „prüf die rnd strecke überall genau und sag mir mit testdaten und
   objekten ob wir immer valide anzeigen" — Anlass: Auftrag 26B0025 der
   Homepage (ETW Bj. 1920, 6 Punkte, GND 80) bekam dort KEINE Zahl
   (Dateien/rnd-26B0025-uebergabe/UEBERGABE.md).

   Geprueft werden die ECHTEN Kerne, nicht Nachbauten:
     App            frontend/js/rnd-calc.js  DealPilotRND.calcAll
                    (RND-Wizard, Steuer/AfA, Deal-Aktion, MFH-Einheiten,
                     BMF-Bodenabschlag, Telegram-Bot ueber rechenkerne.js)
     Wertermittlung marktbericht/backend/src/lib/rnd-einheitlich.js
                    (Sach-, Ertrags-, Beleihungswert, Potenzial)
     Homepage       Dateien/rnd-26B0025-uebergabe/dateien/rnd-calc.js
                    (nur zum Vergleich, wenn vorhanden)

   Teil A  Testobjekte mit Sollwerten bzw. Vergleichsspannen
   Teil B  Raster: Baujahr 1850-2026 x Punkte 0-20 x GND 60/70/80 x drei
           Gewerke-Profile. Invarianten:
             B1 immer eine Zahl > 0 (nie verfahren "keines")
             B2 aelter nie mehr RND (Punkte fest)
             B3 mehr Punkte nie weniger RND (Alter fest)
             B4 kein Sprung > 2 Jahre von einem Baujahr zum naechsten
             B5 Deckel 70 % GND (ohne Kernsanierung)
             B6 App = Wertermittlung (ohne Gewerke; Wertermittlung mit
                Untergrenze 10 J.)
   RC=0 sauber, RC=1 Befund. Jede Zeile nennt ihre Deckung.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function ladeGlobal(pfad, name) {
  const g = {};
  new Function('window', 'globalThis', 'global', 'self', fs.readFileSync(pfad, 'utf8'))(g, g, g, g);
  if (!g[name]) throw new Error(pfad + ': ' + name + ' nicht gesetzt');
  return g[name];
}
const APP = ladeGlobal(path.join(WURZEL, 'frontend/js/rnd-calc.js'), 'DealPilotRND');
const { restnutzungsdauerEinheitlich: WERT } =
  await import('file://' + path.join(WURZEL, 'marktbericht/backend/src/lib/rnd-einheitlich.js').replace(/\\/g, '/'));
const P_HP = path.join(WURZEL, 'Dateien/rnd-26B0025-uebergabe/dateien/rnd-calc.js');
let HP = null;
try { HP = fs.existsSync(P_HP) ? ladeGlobal(P_HP, 'DealPilotRND') : null; } catch (e) { HP = null; }

const JAHR = new Date().getFullYear();          /* die Wertermittlung rechnet mit dem laufenden Jahr */
const STICHTAG = JAHR + '-10-15';
const GEWERKE = ['dach', 'fenster', 'leitungen', 'heizung', 'aussenwand', 'baeder', 'decken', 'technik', 'grundriss'];   /* v2975a: die neun Kennungen aus rnd-calc.js GEWERKE - vorher 'innenausbau' statt decken/grundriss */
const profil = (grad) => grad ? Object.fromEntries(GEWERKE.map((g) => [g, grad])) : {};
const app = (bj, p, gnd, grad, kern) => APP.calcAll({ baujahr: bj, stichtag: STICHTAG, gnd, modPoints: p,
  gewerkeBewertung: profil(grad), kernsaniert: !!kern });
const wert = (bj, p, gnd) => WERT({ build_year: bj, mod_punkte: p, mod_angaben: 8 }, gnd);
const r1 = (x) => x == null ? '–' : (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');

let fehler = 0;
const zeile = (ok, text) => { if (!ok) fehler++; console.log((ok ? '  ok    ' : '  FEHLER') + ' ' + text); };

/* ── Teil A · Testobjekte ─────────────────────────────────────────────── */
console.log('\nTEIL A · Testobjekte (GND 80 wenn nicht anders, Stichtag ' + STICHTAG + ')\n');
console.log('  Objekt                                Bj    P  App          Wertermittl.  Homepage      Vergleich');
const OBJ = [
  { n: '26B0025 ETW (Homepage-Auftrag)', bj: 1920, p: 6, vgl: [24, 29], q: 'gutachten.org 24–27, Praxis Alter=GND 26,7' },
  { n: 'Hüllhorst Hermannstr. 9 ETW', bj: 1968, p: 7, vgl: null, q: '' },
  { n: 'Hüllhorst (Übergabe, 7 P.)', bj: 1965, p: 7, vgl: [21, 25], q: 'gutachten.org 21–25' },
  { n: 'Rinteln (Übergabe, 2 P.)', bj: 1972, p: 2, vgl: [14, 18], q: 'gutachten.org 14–18' },
  { n: 'Löhner Str. 278 ZFH', bj: 1964, p: 0, vgl: null, q: '' },
  { n: 'Altbau 1955, 5 P.', bj: 1955, p: 5, vgl: null, q: 'Homepage-Spanne 7–11' },
  { n: 'Altbau 1947, 5 P.', bj: 1947, p: 5, vgl: null, q: 'Homepage-Spanne 3–7' },
  { n: 'Altbau 1946, 5 P.', bj: 1946, p: 5, vgl: null, q: 'Homepage: keine Zahl' },
  { n: 'Gründerzeit 1900, 0 P.', bj: 1900, p: 0, vgl: null, q: '' },
  { n: 'Gründerzeit 1900, 13 P.', bj: 1900, p: 13, vgl: null, q: '' },
  { n: 'Neubau 2018, 0 P.', bj: 2018, p: 0, vgl: null, q: '' },
];
for (const o of OBJ) {
  const a = app(o.bj, o.p, o.gnd || 80);
  const w = wert(o.bj, o.p, o.gnd || 80);
  let h = null;
  if (HP) { try { const x = HP.calcAll({ baujahr: o.bj, stichtag: STICHTAG, gnd: o.gnd || 80, modPoints: o.p, gewerkeBewertung: {} }); h = x; } catch (e) { h = null; } }
  console.log('  ' + o.n.padEnd(38) + String(o.bj).padEnd(6) + String(o.p).padStart(2) + ' '
    + (r1(a.final_rnd) + ' ' + a.verfahren).padEnd(13) + ' ' + r1(w.rnd).padEnd(13) + ' '
    + (h ? (r1(h.final_rnd) + ' ' + h.verfahren) : '–').padEnd(13) + ' ' + o.q);
  zeile(a.final_rnd > 0 && a.verfahren !== 'keines', o.n + ': App zeigt eine Zahl');
  /* gutachten.org ist kein amtlicher Massstab - Abweichung ist ein HINWEIS, kein Fehler */
  if (o.vgl) console.log((a.final_rnd >= o.vgl[0] - 0.5 && a.final_rnd <= o.vgl[1] + 0.5 ? '  ok    ' : '  HINWEIS') + ' ' + o.n + ': App ' + r1(a.final_rnd) + ' J., Vergleichsspanne ' + o.vgl.join('–'));
}

/* ── Teil B · Raster ──────────────────────────────────────────────────── */
console.log('\nTEIL B · Raster Baujahr 1850–' + JAHR + ' × Punkte 0–20 × GND 60/70/80 × Gewerke (keine / alle erneuert / alle veraltet)\n');
/* TOL: an der Schwelle liegt die Formel der Anlage 2 bis 0,14 J. unter GND - Alter (gemessen
   27.10.2026, GND 80, 3 P., Bj 1982/83: 37,14 / 37,00) - Eigenschaft der Verordnungstabelle.
   Seit v2975 gelten alle Invarianten auch MIT Gewerken (Verfahrenswahl: ab 1 Punkt
   Anlage 2, bei 0 Punkten das Niedrigere aus Technik [Basis Anlage 2 mit 0 Punkten] und
   Modell). Vorher sprang die RND mit Gewerken an der Schwelle um bis zu 28 J. */
const TOL = 0.15;
const N = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, h: 0, faelle: 0 };
const BEISP = { b1: [], b2: [], b3: [], b4: [], b5: [], b6: [], b7: [], h: [] };
const merk = (k, t) => { N[k]++; if (BEISP[k].length < 4) BEISP[k].push(t); };
let maxSprung = 0, maxSprungWo = '';
for (const gnd of [60, 70, 80]) for (const grad of [null, 'erneuert', 'veraltet']) {
  const tab = {};
  for (let p = 0; p <= 20; p++) for (let bj = 1850; bj <= JAHR; bj++) {
    const a = app(bj, p, gnd, grad); N.faelle++;
    tab[p + '|' + bj] = a.final_rnd;
    const wo = 'GND ' + gnd + ', ' + (grad || 'ohne Gewerke') + ', Bj ' + bj + ', ' + p + ' P.';
    if (!(a.final_rnd > 0) || a.verfahren === 'keines') merk('b1', wo + ': ' + a.verfahren);
    /* der Deckel gilt fuer die STRECKUNG - GND minus Alter darf darueber liegen */
    if (a.final_rnd > Math.max(0.70 * gnd, gnd - (JAHR - bj)) + 0.01) merk('b5', wo + ': ' + r1(a.final_rnd) + ' > ' + r1(Math.max(0.7 * gnd, gnd - (JAHR - bj))));
    if (!grad) {
      const w = wert(bj, p, gnd).rnd;
      const soll = Math.min(gnd - 10, Math.max(a.final_rnd, 10));
      if (Math.abs(w - soll) > 0.15) merk('b6', wo + ': App ' + r1(a.final_rnd) + ' / Wert ' + r1(w));
    }
  }
  for (let p = 0; p <= 20; p++) for (let bj = 1851; bj <= JAHR; bj++) {
    const alt = tab[p + '|' + (bj - 1)], neu = tab[p + '|' + bj];   /* bj-1 ist das AELTERE Haus */
    const wo = 'GND ' + gnd + ', ' + (grad || 'ohne Gewerke') + ', ' + p + ' P., Bj ' + (bj - 1) + '→' + bj;
    if (alt > neu + TOL) merk('b2', wo + ': älter mehr ' + r1(alt) + ' > ' + r1(neu));
    const s = Math.abs(neu - alt);
    if (s > maxSprung) { maxSprung = s; maxSprungWo = wo + ': ' + r1(alt) + ' → ' + r1(neu); }
    if (s > 2) merk('b4', wo + ': Sprung ' + r1(alt) + ' → ' + r1(neu));
  }
  for (let bj = 1850; bj <= JAHR; bj++) for (let p = 1; p <= 20; p++) {
    if (tab[(p - 1) + '|' + bj] > tab[p + '|' + bj] + TOL)
      merk('b3', 'GND ' + gnd + ', ' + (grad || 'ohne Gewerke') + ', Bj ' + bj + ': ' + (p - 1) + ' P. ' + r1(tab[(p - 1) + '|' + bj]) + ' > ' + p + ' P. ' + r1(tab[p + '|' + bj]));
    /* v2975a · B7: EIN Punkt darf die RND nicht verdoppeln. Gefunden am Gutachten WE03
       (25DG06644): erneuerte Heizung = 1 Punkt -> v2975 sprang von 22 auf 44 J., weil ab
       1 Punkt das Modell fuehrte. B3 sah das nicht - es prueft nur „nie weniger".
       Schranke 4 J.: die Tabelle der Anlage 2 selbst steigt je Punkt um hoechstens 3,1 J. */
    const dp = tab[p + '|' + bj] - tab[(p - 1) + '|' + bj];
    if (dp > 4) merk('b7', 'GND ' + gnd + ', ' + (grad || 'ohne Gewerke') + ', Bj ' + bj + ': ' + (p - 1) + '→' + p + ' P. ' + r1(tab[(p - 1) + '|' + bj]) + ' → ' + r1(tab[p + '|' + bj]));
  }
}
const T = { b1: 'B1 immer eine Zahl > 0', b2: 'B2 älter nie mehr RND (Tol. 0,15 J.)', b3: 'B3 mehr Punkte nie weniger (Tol. 0,15 J.)',
  b4: 'B4 kein Sprung > 2 J. je Baujahr', b5: 'B5 Deckel 70 % GND oder GND − Alter', b6: 'B6 App = Wertermittlung (ohne Gewerke)',
  b7: 'B7 ein Punkt mehr hebt höchstens um 4 J.' };
for (const k of Object.keys(T)) {
  zeile(N[k] === 0, T[k] + ' — ' + N[k] + ' Verstöße');
  BEISP[k].forEach((t) => console.log('           z. B. ' + t));
}
console.log('\n  Deckung: ' + N.faelle + ' Fälle; größter Sprung je Baujahr ' + r1(maxSprung) + ' J. (' + maxSprungWo + ')');
console.log('\n' + (fehler ? 'ERGEBNIS: ' + fehler + ' Befund(e)' : 'ERGEBNIS: sauber'));
process.exit(fehler ? 1 : 0);
