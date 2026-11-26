#!/usr/bin/env node
/* tools/nebenkosten-trinkwasser-aufbereiten.mjs · pp6 (26.11.2026)
   Rohdaten aus nebenkosten-trinkwasser-holen.mjs → marktbericht/backend/src/lib/nebenkosten/trinkwasser-gemeinden.json
     node tools/nebenkosten-trinkwasser-aufbereiten.mjs <roh.json>
   Ergänzt: Median über alle Gemeinden (Bezug „mittlere Gemeinde“ = Bundesdurchschnitt Wasser und Abwasser),
   Landesmittel (Median je Land, Rückfall für Gemeinden ohne Zeile), Herkunft und Lizenz (nur intern). */
import fs from 'node:fs';
const roh = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const med = (a) => { a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : null; };
const r2 = (x) => Math.round(x * 100) / 100;
const G = roh.gemeinden || {};
const werte = Object.values(G);
const laender = {};
for (const [k, s] of Object.entries(G)) (laender[k.slice(0, 2)] = laender[k.slice(0, 2)] || []).push(s);
const lm = {};
for (const [l, a] of Object.entries(laender)) lm[l] = { name: 'Landesmittel', n: a.length, eur_m3: r2(med(a.map((s) => s.eur_m3))), grund_jahr: r2(med(a.map((s) => s.grund_jahr || 0))) };
const aus = {
  jahr: roh.jahr, stichtag: roh.stichtag, abgerufen: roh.abgerufen,
  quelle_intern: 'Regionaldatenbank 32271-01-01-5, Entgelt für die Trinkwasserversorgung privater Haushalte, Stichtag 01.01.',
  lizenz: 'dl-de/by-2-0', vermerk_intern: 'Statistische Ämter des Bundes und der Länder, Deutschland, ' + (roh.jahr + 1),
  verbrauch_m3_je_m2: 0.93,
  median: { n: werte.length, eur_m3: r2(med(werte.map((s) => s.eur_m3))), grund_jahr: r2(med(werte.map((s) => s.grund_jahr || 0))) },
  laender: lm, kreise: roh.kreise || {}, gemeinden: G,
};
const ziel = new URL('../marktbericht/backend/src/lib/nebenkosten/trinkwasser-gemeinden.json', import.meta.url);
fs.writeFileSync(ziel, JSON.stringify(aus));
console.log('Gemeinden', werte.length, 'Kreise', Object.keys(aus.kreise).length, 'Länder', Object.keys(lm).length, 'Median', JSON.stringify(aus.median));
for (const [l, v] of Object.entries(lm).sort()) console.log('  ' + l, v.n, v.eur_m3, v.grund_jahr);
