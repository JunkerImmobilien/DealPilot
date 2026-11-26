#!/usr/bin/env node
/* tools/nebenkosten-trinkwasser-holen.mjs · pp6 (26.11.2026) — Trinkwasserentgelt je Gemeinde für den Haus-Check
   Läuft IM mb-Container (braucht DESTATIS_TOKEN der Regionaldatenbank), schreibt JSON nach stdout:
     docker cp tools/nebenkosten-trinkwasser-holen.mjs dealpilot-mb-backend:/app/nth.mjs
     docker exec dealpilot-mb-backend node /app/nth.mjs > trinkwasser-roh.json
   Quelle (Regionaldatenbank, dl-de/by-2-0, Statistische Ämter des Bundes und der Länder):
     32271-01-01-5  Entgelt für die Trinkwasserversorgung privater Haushalte, Stichtag 01.01., Gemeinden
                    Spalten: verbrauchsabhängiges Entgelt EUR/m³ · haushaltsübliches verbrauchsunabhängiges Entgelt EUR/Jahr
   Je Land EIN Abruf (regionalkey "LL*", Regionalvariable GEMEIN). Kreiszeilen (fünfstellig) werden als
   Kreiswert mitgenommen (Rückfall für Gemeinden ohne eigene Zeile).
   Abwasser führt die Regionaldatenbank NICHT regional (gemessen 26.11.2026, Katalog 3227 und 3228). */
import { DestatisConnector as D } from '/app/src/connectors/stubConnectors.js';
const JAHR = Number(process.env.JAHR || 2025);
const LAENDER = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16'];
const zahl = (s) => { s = String(s || '').trim(); if (!/^-?[\d.]+(,\d+)?$/.test(s)) return null; return parseFloat(s.replace(/\./g, '').replace(',', '.')); };
async function tabelle(land) {
  for (let v = 0; v < 3; v++) {
    try {
      const raw = await D._fetchTableFfcsv('32271-01-01-5', null, JAHR, land + '*', { regionalvariable: 'GEMEIN', startyear: JAHR, endyear: JAHR, timeoutMs: 240000 });
      const csv = D._extractCsv(raw);
      if (csv) return csv.split(/\r?\n/);
    } catch (e) { process.stderr.write(land + ' Versuch ' + (v + 1) + ': ' + e.message + '\n'); }
  }
  return [];
}
const gemeinden = {}, kreise = {};
for (const l of LAENDER) {
  const z = await tabelle(l);
  let n = 0;
  for (const zeile of z) {
    const c = zeile.split(';');
    if (!/^01\.01\.\d{4}$/.test(c[0])) continue;
    const k = String(c[1] || '').trim(), preis = zahl(c[3]), grund = zahl(c[4]);
    if (!(preis > 0)) continue;
    const satz = { name: String(c[2] || '').trim(), eur_m3: preis, grund_jahr: grund != null ? grund : null };
    if (/^\d{8}$/.test(k)) { gemeinden[k] = satz; n++; }
    else if (/^\d{5}$/.test(k)) { kreise[k] = satz; gemeinden[k + '000'] = gemeinden[k + '000'] || satz; }   /* kreisfreie Stadt fünfstellig */
    else if (k === '11' || k === '02') gemeinden[k + '000000'] = satz;                                     /* Stadtstaaten */
  }
  process.stderr.write('Land ' + l + ': ' + n + ' Gemeinden\n');
}
process.stdout.write(JSON.stringify({ jahr: JAHR, stichtag: JAHR + '-01-01', abgerufen: new Date().toISOString().slice(0, 10), gemeinden, kreise }));
