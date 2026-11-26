#!/usr/bin/env node
/* tools/nebenkosten-grundsteuer-bauen.mjs · nn6 — aus dem Rohabruf (nebenkosten-grundsteuer-holen.mjs) die
   Datei marktbericht/backend/src/lib/nebenkosten/grundsteuer-gemeinden.json bauen.
   Aufruf: node tools/nebenkosten-grundsteuer-bauen.mjs <grundsteuer-roh.json>
   Rechnung je Gemeinde: Aufkommen B (EUR) / Wohnfläche (m²) / 12 × K.
   K bringt den Bundesschnitt (Σ Aufkommen B / Σ Wohnfläche) auf den Bundesschnitt der Grundsteuer der
   Wohnung (BUND.grundsteuer in lib/nebenkosten/nebenkosten.js): das Aufkommen B enthält Nichtwohngrundstücke.
   Gemeinden ohne beide Werte fallen weg (dann Bundesschnitt). Werte außerhalb 0,05–0,80 €/m² werden gekappt
   und markiert (kleine Gemeinden mit großem Gewerbe). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUND } from '../marktbericht/backend/src/lib/nebenkosten/nebenkosten.js';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roh = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));
const G0 = roh.gemeinden || {};
/* Fünfstellige Zeilen kommen als KKKKK000 an. Kreisfreie Städte haben keine weitere Gemeinde mit diesem
   Kreisschlüssel, Landkreise schon: deren Summenzeile fällt weg (sonst zählte die Kalibrierung doppelt). */
const praefix = new Set(Object.keys(G0).filter((k) => !k.endsWith('000')).map((k) => k.slice(0, 5)));
const G = {}; let kreissummen = 0;
for (const [k, g] of Object.entries(G0)) { if (k.endsWith('000') && praefix.has(k.slice(0, 5))) { kreissummen++; continue; } G[k] = g; }
let sGs = 0, sWf = 0, n = 0;
for (const g of Object.values(G)) if (g.gs_b_eur > 0 && g.wfl_tsd_m2 > 0) { sGs += g.gs_b_eur; sWf += g.wfl_tsd_m2 * 1000; n++; }
const roh_qm = sGs / sWf / 12, K = BUND.grundsteuer / roh_qm;
const out = {}; let gekappt = 0;
for (const [ags, g] of Object.entries(G)) {
  if (!(g.gs_b_eur > 0 && g.wfl_tsd_m2 > 0)) continue;
  let q = g.gs_b_eur / (g.wfl_tsd_m2 * 1000) / 12 * K, kap = false;
  if (q < 0.05) { q = 0.05; kap = true; } if (q > 0.8) { q = 0.8; kap = true; } if (kap) gekappt++;
  out[ags] = { name: g.name, gs_qm_monat: Math.round(q * 1000) / 1000, hebesatz_b: g.hebesatz_b ?? null, ...(kap ? { gekappt: true } : {}) };
}
const datei = {
  version: 'nn6', jahr: roh.jahr, abgerufen: roh.abgerufen,
  quelle_intern: 'Regionaldatenbank 71231-01-03-5 (Grundsteuer B IST-Aufkommen, Hebesatz B) und 31231-02-01-5 (Wohnfläche), dl-de/by-2-0; Kalibrierung auf den Bundesschnitt der Grundsteuer der Wohnung (Betriebskostenspiegel, Abrechnungsjahr 2024)',
  lizenz: 'dl-de/by-2-0', lizenz_url: 'https://www.govdata.de/dl-de/by-2-0',
  faktor_k: Math.round(K * 10000) / 10000, bund_roh_qm_monat: Math.round(roh_qm * 1000) / 1000,
  anzahl: Object.keys(out).length, gekappt, gemeinden: out,
};
const ziel = path.join(W, 'marktbericht/backend/src/lib/nebenkosten/grundsteuer-gemeinden.json');
fs.writeFileSync(ziel, JSON.stringify(datei));
console.log('Kreissummen verworfen', kreissummen, '·', 'Gemeinden', datei.anzahl, 'von', Object.keys(G).length, '· K', datei.faktor_k, '· Bund roh', datei.bund_roh_qm_monat, '€/m²·M · gekappt', gekappt);
