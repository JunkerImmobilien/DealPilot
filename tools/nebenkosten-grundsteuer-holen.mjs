#!/usr/bin/env node
/* tools/nebenkosten-grundsteuer-holen.mjs · nn6 (26.11.2026) — Grundsteuer je Gemeinde für den Haus-Check
   Läuft IM mb-Container (braucht DESTATIS_TOKEN der Regionaldatenbank), schreibt JSON nach stdout:
     docker cp tools/nebenkosten-grundsteuer-holen.mjs dealpilot-mb-backend:/app/ngh.mjs
     docker exec dealpilot-mb-backend node /app/ngh.mjs > grundsteuer-roh.json
   Quellen (Regionaldatenbank, dl-de/by-2-0):
     71231-01-03-5  Realsteuervergleich, Gemeinden: Grundsteuer B IST-Aufkommen (EUR), Hebesatz B (%)
     31231-02-01-5  Bestand an Wohngebäuden und Wohnungen, Gemeinden: Wohnfläche (1000 m²)
   Je Land EIN Abruf (regionalkey "LL*", Regionalvariable GEMEIN), nur das Jahr JAHR. */
import { DestatisConnector as D } from '/app/src/connectors/stubConnectors.js';
const JAHR = Number(process.env.JAHR || 2024);
const LAENDER = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16'];
/* Schlüssel: Gemeinden achtstellig. Kreisfreie Städte führen die Tabellen fünfstellig (05711 → 05711000),
   die Stadtstaaten Berlin und Hamburg zweistellig (11 → 11000000, 02 → 02000000). Andere zweistellige
   Zeilen sind Landessummen und fallen weg. */
const schluessel = (k) => { k = String(k || '').trim();
  if (/^\d{8}$/.test(k)) return k; if (/^\d{5}$/.test(k)) return k + '000';
  if (k === '11' || k === '02') return k + '000000'; return null; };
const zahl = (s) => { s = String(s || '').trim(); if (!/^-?[\d.]+(,\d+)?$/.test(s)) return null; return parseFloat(s.replace(/\./g, '').replace(',', '.')); };
async function tabelle(code, land) {
  for (let v = 0; v < 3; v++) {
    try {
      const raw = await D._fetchTableFfcsv(code, null, JAHR, land + '*', { regionalvariable: 'GEMEIN', startyear: JAHR, endyear: JAHR, timeoutMs: 240000 });
      const csv = D._extractCsv(raw);
      if (csv) return csv.split(/\r?\n/);
    } catch (e) { process.stderr.write(code + ' ' + land + ' Versuch ' + (v + 1) + ': ' + e.message + '\n'); }
  }
  return [];
}
const out = {};
for (const l of LAENDER) {
  const gs = await tabelle('71231-01-03-5', l), wf = await tabelle('31231-02-01-5', l);
  for (const z of gs) {
    const c = z.split(';'); const ags = schluessel(c[1]); if (!/^\d{4}$/.test(c[0]) || !ags) continue; out[ags] = out[ags] || { name: c[2].trim() };
    out[ags].gs_b_eur = zahl(c[4]); out[ags].hebesatz_b = zahl(c[10]);   /* Spalten: 3 A, 4 B IST · 6–8 Grundbeträge · 9 A, 10 B, 11 Gewerbe Hebesatz */
  }
  for (const z of wf) {
    const c = z.split(';'); const ags = schluessel(c[1]); if (!/^31\.12\.\d{4}$/.test(c[0]) || !ags) continue; out[ags] = out[ags] || { name: c[2].trim() };
    out[ags].wfl_tsd_m2 = zahl(c[8]);
  }
  process.stderr.write('Land ' + l + ': ' + gs.length + '/' + wf.length + ' Zeilen\n');
}
process.stdout.write(JSON.stringify({ jahr: JAHR, abgerufen: new Date().toISOString().slice(0, 10), gemeinden: out }));
