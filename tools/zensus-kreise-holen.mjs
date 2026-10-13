#!/usr/bin/env node
// zensus-kreise-holen.mjs — erzeugt marktbericht/backend/data/zensus2022_kreise.csv
// aus der amtlichen Zensus-Datenbank (ergebnisse.zensus2022.de, GENESIS-REST).
//
// v2161 · N62.4. Bis hierher trug die Datei nur eine Beispielzeile: 0 von 162
// Berichten auf Staging hatten Zensus-Werte, gemeldet als "kreis_nicht_in_datei"
// — das klang nach EINEM fehlenden Kreis und hiess: alle.
//
// Quelle (gemessen 13.10.2026):
//   4000W-0001  Leerstandsquote (WHG009) und Eigentumsquote (WHG007)
//   4000W-0004  Durchschnittliche Nettokaltmiete (WHG012), EUR/m²
//   Regionalebene GEOLK4 = Landkreise und kreisfreie Staedte, Stand 15.05.2022
// Lizenz: Datenlizenz Deutschland – Namensnennung – 2.0;
//   © Statistische Ämter des Bundes und der Länder, Zensus 2022.
//
// Aufruf (auf dem Server, die Zugangsdaten stehen in /opt/dealpilot/.env):
//   ZENSUS_USER=... ZENSUS_PASSWORD=... node tools/zensus-kreise-holen.mjs <ziel.csv>
// Die Zugangsdaten gehen NUR als Header an die Zensus-Datenbank (Form-Daten
// werden dort als GAST behandelt — gemessen).
//
// Kein Treffer heisst kein Wert: gesperrte oder fehlende Zellen ("-", "/", ".")
// bleiben leer. Nichts wird geschaetzt.

import fs from 'node:fs';
import zlib from 'node:zlib';

const BASE = 'https://ergebnisse.zensus2022.de/api/rest/2020';
const USER = process.env.ZENSUS_USER, PASS = process.env.ZENSUS_PASSWORD;
const ZIEL = process.argv[2];
if (!USER || !PASS || !ZIEL) {
  console.error('Aufruf: ZENSUS_USER=… ZENSUS_PASSWORD=… node tools/zensus-kreise-holen.mjs <ziel.csv>');
  process.exit(2);
}

// Kleinster ZIP-Leser: die Antwort ist ein ZIP mit genau einer CSV.
function ersteDateiAusZip(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) return buf.toString('utf8'); // kein ZIP
  const methode = buf.readUInt16LE(8);
  let groesse = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26), extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  // Bit 3: Groessen stehen im Data Descriptor -> ueber das Zentralverzeichnis lesen
  if (buf.readUInt16LE(6) & 0x08) {
    const cd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    groesse = buf.readUInt32LE(cd + 20);
  }
  const roh = buf.subarray(start, start + groesse);
  const daten = methode === 8 ? zlib.inflateRawSync(roh) : roh;
  return daten.toString('utf8').replace(/^﻿/, '');
}

async function tabelle(name) {
  const body = new URLSearchParams({
    name, area: 'all', format: 'ffcsv', compress: 'false',
    regionalvariable: 'GEOLK4', regionalkey: '*', language: 'de'
  });
  const r = await fetch(BASE + '/data/tablefile', {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', username: USER, password: PASS }
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const text = ersteDateiAusZip(buf);
  if (text.trim().startsWith('{')) throw new Error(name + ': ' + text.slice(0, 300));
  const zeilen = text.split(/\r?\n/).filter(Boolean);
  const kopf = zeilen[0].split(';');
  const i = (k) => { const x = kopf.indexOf(k); if (x < 0) throw new Error(name + ': Spalte ' + k + ' fehlt'); return x; };
  const iAgs = i('1_variable_attribute_code'), iName = i('1_variable_attribute_label'),
        iWert = i('value'), iMerk = i('value_variable_code');
  return zeilen.slice(1).map((z) => {
    const s = z.split(';');
    return { ags: s[iAgs], name: s[iName], merkmal: s[iMerk], wert: s[iWert] };
  });
}

const zahl = (w) => (/^-?\d+(,\d+)?$/.test(String(w || '').trim()) ? String(w).trim() : '');

const kreise = new Map();
function setze(ags, name, feld, wert) {
  if (!/^\d{5}$/.test(ags)) return;
  if (!kreise.has(ags)) kreise.set(ags, { name });
  kreise.get(ags)[feld] = zahl(wert);
}

for (const z of await tabelle('4000W-0001')) {
  if (z.merkmal === 'WHG009') setze(z.ags, z.name, 'leerstandsquote', z.wert);
  if (z.merkmal === 'WHG007') setze(z.ags, z.name, 'eigentuemerquote', z.wert);
}
for (const z of await tabelle('4000W-0004')) {
  if (z.merkmal === 'WHG012') setze(z.ags, z.name, 'nettokaltmiete_qm', z.wert);
}

const aus = ['ags;name;leerstandsquote;eigentuemerquote;nettokaltmiete_qm;anteil_18_30'];
for (const ags of [...kreise.keys()].sort()) {
  const k = kreise.get(ags);
  aus.push([ags, k.name.replace(/;/g, ','), k.leerstandsquote || '', k.eigentuemerquote || '',
            k.nettokaltmiete_qm || '', ''].join(';'));
}
fs.writeFileSync(ZIEL, aus.join('\n') + '\n', 'utf8');

const n = kreise.size;
const voll = [...kreise.values()].filter((k) => k.leerstandsquote && k.eigentuemerquote && k.nettokaltmiete_qm).length;
console.log(`${n} Kreise geschrieben, ${voll} mit allen drei Werten -> ${ZIEL}`);
// Deckung nennen, nicht nur Erfolg (Lehre gold-audit): unter 380 Kreisen ist etwas falsch.
if (n < 380) { console.error('ZU WENIGE KREISE — Abruf pruefen'); process.exit(1); }
