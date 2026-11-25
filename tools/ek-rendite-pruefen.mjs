#!/usr/bin/env node
/* v4620 · Prüfer EK-Rendite und Hebeleffekt (frontend/js/ek-rendite.js, die ECHTE Datei).
 * Prüft die Leverage-Formel EKR = GKR + (GKR - FKZ) x FK/EK (gilt exakt, wenn Gesamtinvest = EK + Darlehen),
 * die Richtung in beide Fälle, die Sensitivitäten über rechne() und die Kundentexte.
 * Fälle mit erfundenen, gerundeten Zahlen in der Größenordnung der Staging-Objekte. RC 0 = sauber. */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const hier = path.dirname(fileURLToPath(import.meta.url));
const K = require(path.join(hier, '..', 'frontend', 'js', 'ek-rendite.js'));

let fehler = 0, n = 0;
const ok = (b, t) => { n++; if (!b) { fehler++; console.log('ROT  ' + t); } };
const nah = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

const faelle = [
  { name: 'MFH positiv (wie Westerfeld)', p: { cf_op: 6500, steuer: -800, tilg: 2600, bspar: 0, ek: 74592, wert: 740000, darlehen0: 470000, stichtag: null, wstg: 0.02 }, h: { zins_j: 16450, darlehen: 470000, zins_anschluss: 4.5 }, richtung: 'positiv' },
  { name: 'ETW positiv (wie Demostraße)', p: { cf_op: -690, steuer: -525, tilg: 2200, bspar: 0, ek: 35000, wert: 130000, darlehen0: 105000, stichtag: null, wstg: 0.015 }, h: { zins_j: 3700, darlehen: 105000 }, richtung: 'positiv' },
  { name: 'Ankauf (wie Hauptstr.)', p: { cf_op: 1800, steuer: -4900, tilg: 11000, bspar: 0, ek: 491403, wert: 1418000, darlehen0: 1000000, stichtag: null, wstg: 0.02 }, h: { zins_j: 38000, darlehen: 1000000 }, richtung: 'positiv' },
  { name: 'Negativer Hebel (Zins über Objektrendite)', p: { cf_op: -9000, steuer: -1500, tilg: 3000, bspar: 0, ek: 50000, wert: 300000, darlehen0: 270000, stichtag: null, wstg: 0 }, h: { zins_j: 14850, darlehen: 270000, zins_anschluss: 7 }, richtung: 'negativ' },
];

for (const f of faelle) {
  const r = K.rechne(f.p);
  ok(!!r, f.name + ': rechne liefert Ergebnis');
  const gi = f.p.ek + f.h.darlehen;
  const hb = K.hebel(r, Object.assign({ gi }, f.h));
  ok(!!hb, f.name + ': hebel liefert Ergebnis');
  ok(hb.richtung === f.richtung, f.name + ': Richtung ' + hb.richtung + ' erwartet ' + f.richtung);
  /* Leverage-Formel gegen Stufe 3 (vor Steuer mit Delta) */
  const formel = hb.gkr + (hb.gkr - hb.fk_zins) * f.h.darlehen / f.p.ek;
  ok(nah(formel, r.k3), f.name + ': EKR = GKR + (GKR-FKZ)*FK/EK, ' + formel.toFixed(3) + ' gegen k3 ' + r.k3.toFixed(3));
  ok(f.richtung === 'positiv' ? r.k3 >= hb.gkr : r.k3 < hb.gkr, f.name + ': Hebel hebt bzw. drückt die EK-Rendite');
  /* Sensitivität Wert -2 % aus rechne() */
  const s = K.rechne(Object.assign({}, f.p, { stichtag: null, wstg: -0.02 }));
  ok(nah(hb.wert_minus2, s.k4), f.name + ': Wert -2 % gleich rechne()');
  ok(hb.wert_minus2 < r.k4 || f.p.wstg < -0.02, f.name + ': Wertverlust senkt die EK-Rendite');
  /* Kipp-Wert: bei dieser Wertänderung ist Stufe 4 null */
  const kw = K.rechne(Object.assign({}, f.p, { stichtag: null, wstg: hb.kipp_wert / 100 }));
  ok(nah(kw.k4, 0, 0.001), f.name + ': bei Kipp-Wert ' + hb.kipp_wert.toFixed(2) + ' % ist Stufe 4 null');
  /* Anschlusszins */
  if (f.h.zins_anschluss) {
    ok(hb.ekr_anschluss != null && hb.ekr_anschluss < r.k4, f.name + ': höherer Anschlusszins senkt die EK-Rendite');
    ok(nah(hb.mehrzins, f.h.darlehen * (f.h.zins_anschluss - hb.fk_zins) / 100, 0.5), f.name + ': Mehrzins');
  }
  /* Kundentext */
  const t = K.tooltip(Object.assign({}, r, { hebel: hb }));
  ok(/Hebel (positiv|negativ)/.test(t), f.name + ': Tooltip nennt den Hebel');
  ok(/Fällt der Wert 2 % im Jahr/.test(t), f.name + ': Tooltip nennt den Wertverlust');
  ok(!/[–—;]/.test(t), f.name + ': Tooltip ohne Gedankenstrich und Semikolon');
}
/* Schnittstelle unverändert: rechne() ohne hebel, tooltip() ohne hebel */
const r0 = K.rechne(faelle[0].p);
ok(r0.hebel === undefined, 'rechne() setzt kein hebel-Feld (Schnittstelle für Demos unverändert)');
ok(K.tooltip(r0).split('\n').length === 6, 'tooltip() ohne hebel wie bisher sechs Zeilen');
ok(K.hebel(r0, { gi: 0, zins_j: 1, darlehen: 1 }) === null, 'hebel() ohne Gesamtinvest = null');

console.log((fehler ? 'ROT' : 'GRÜN') + ' · ek-rendite-pruefen · ' + (n - fehler) + '/' + n);
process.exit(fehler ? 1 : 0);
