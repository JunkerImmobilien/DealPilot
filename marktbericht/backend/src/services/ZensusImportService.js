// ZensusImportService.js — fuellt mb.zensus_werte aus der Zensus-Datenbank.
//
// v2162 · N62.4. Marcel am 13.10.2026: „nicht in eine Datei schreiben,
// sondern direkt in eine Datenbank, wo wir das vielleicht jaehrlich oder alle
// zwei Jahre einmal abgleichen … ich brauche das ja fuer ganz Deutschland."
//
// Gemessen am 13.10.2026 (ergebnisse.zensus2022.de, GENESIS-REST 2020):
//   - Anmeldung NUR per Header username/password (Form-Daten -> GAST).
//   - Regionalebenen: GEOLK4 = 400 Kreise, GEOGM4 = 10.786 Gemeinden (ARS 12).
//   - Ein Abruf dauert rund 5 Sekunden, auch fuer alle Gemeinden.
//   - Antwort ist ein ZIP mit einer flachen CSV (ffcsv).
//
// Der Zensus ist eine Stichtagserhebung (15.05.2022) und wird erst mit dem
// naechsten Zensus neu erhoben. „Abgleichen" heisst hier: Korrekturen der
// Aemter nachziehen — der Import ist idempotent (UPSERT) und protokolliert
// jeden Abruf in mb.zensus_abrufe.
//
// Aufruf im Container:
//   docker exec -e ZENSUS_USER=… -e ZENSUS_PASSWORD=… dealpilot-mb-backend npm run zensus

import zlib from 'node:zlib';
import { pool, q } from '../lib/db.js';

const BASE = 'https://ergebnisse.zensus2022.de/api/rest/2020';
const LIZENZ = '© Statistische Ämter des Bundes und der Länder, Zensus 2022, '
  + 'Datenlizenz Deutschland – Namensnennung – 2.0';
const QUELLE = 'https://ergebnisse.zensus2022.de/datenbank/online/table/';

/* Die Tabellen. Gewaehlt nach dem, was die App braucht: Miete und Leerstand
   je Baujahr und Flaeche (Reiter Miete, Investitionen), die Grundquoten
   (Marktbericht) und die Dauer des Leerstands (Aufteilung des Leerstands). */
export const TABELLEN = [
  '4000W-0001', // Leerstandsquote, Eigentumsquote
  '4000W-0002', // Marktaktive Leerstandsquote (Geschosswohnungen)
  '4000W-0004', // Durchschnittliche Nettokaltmiete
  '4000W-0005', //   ... nach Baujahr (Jahrzehnte)
  '4000W-0009', //   ... nach Flaeche (20 m²)
  '4000W-0017', // Leerstandsquote nach Baujahr
  '4000W-0021', // Leerstandsquote nach Flaeche (20 m²)
  '4000W-0025', // Marktaktive Leerstandsquote nach Baujahr
  '4000W-0029', // Marktaktive Leerstandsquote nach Flaeche (20 m²)
  '4000W-1022'  // Wohnungen: Dauer des Wohnungsleerstands (Anzahl)
];
export const EBENEN = { GEOLK4: 'kreis', GEOGM4: 'gemeinde' };

const DIMENSION = { GEBBJ5: 'baujahr', WHGFL3: 'flaeche' };

function kennzahlAus(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('nettokaltmiete')) return 'nettokaltmiete_qm';
  if (l.includes('marktaktive leerstandsquote')) return 'leerstandsquote_marktaktiv';
  if (l.includes('leerstandsquote')) return 'leerstandsquote';
  if (l.includes('eigentumsquote')) return 'eigentuemerquote';
  if (l.includes('wohnungen')) return 'wohnungen_anzahl';
  return l.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'wert';
}

// "5,54" -> 5.54 · "12.345" -> 12345 · "-", "/", "." -> null
export function zahl(roh) {
  const s = String(roh == null ? '' : roh).trim().replace(/\s/g, '');
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ARS 12 -> AGS 8 (Land+RB+Kreis = 5, Gemeinde = letzte 3)
export function agsAusArs(ars) {
  const a = String(ars || '');
  return /^\d{12}$/.test(a) ? a.slice(0, 5) + a.slice(9, 12) : null;
}

function ersteDateiAusZip(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) return buf.toString('utf8');
  const methode = buf.readUInt16LE(8);
  let groesse = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26), extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  if (buf.readUInt16LE(6) & 0x08) {
    const cd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    groesse = buf.readUInt32LE(cd + 20);
  }
  const roh = buf.subarray(start, start + groesse);
  return (methode === 8 ? zlib.inflateRawSync(roh) : roh).toString('utf8').replace(/^﻿/, '');
}

export function parseFfcsv(text, tabelle, ebene) {
  const zeilen = text.split(/\r?\n/).filter(Boolean);
  const kopf = zeilen[0].split(';');
  const i = (k) => kopf.indexOf(k);
  const iCode = i('1_variable_attribute_code'), iName = i('1_variable_attribute_label');
  const i2Var = i('2_variable_code'), i2Code = i('2_variable_attribute_code'), i2Text = i('2_variable_attribute_label');
  const iWert = i('value'), iEinh = i('value_unit'), iLab = i('value_variable_label');
  if (iCode < 0 || iWert < 0 || iLab < 0) throw new Error(tabelle + ': unerwarteter Kopf ' + kopf.join(','));
  const out = [];
  for (const z of zeilen.slice(1)) {
    const s = z.split(';');
    const code = s[iCode];
    let ags, ars = null;
    if (ebene === 'kreis') { if (!/^\d{5}$/.test(code)) continue; ags = code; }
    else { ars = code; ags = agsAusArs(code); if (!ags) continue; }
    const dimCode = i2Var >= 0 ? s[i2Var] : '';
    const auspraegung = (i2Code >= 0 && s[i2Code]) ? s[i2Code] : 'INSGESAMT';
    out.push({
      ebene, ags, ars, gebiet_name: s[iName] || null, tabelle,
      kennzahl: kennzahlAus(s[iLab]),
      dimension: dimCode ? (DIMENSION[dimCode] || dimCode.toLowerCase()) : 'gesamt',
      auspraegung,
      auspraegung_text: (i2Text >= 0 && s[i2Text]) ? s[i2Text] : null,
      wert: zahl(s[iWert]), wert_roh: s[iWert], einheit: iEinh >= 0 ? (s[iEinh] || null) : null
    });
  }
  return out;
}

async function abruf(tabelle, regionalvariable, user, pass) {
  const body = new URLSearchParams({
    name: tabelle, area: 'all', format: 'ffcsv', compress: 'false',
    regionalvariable, regionalkey: '*', language: 'de'
  });
  const r = await fetch(BASE + '/data/tablefile', {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', username: user, password: pass }
  });
  const text = ersteDateiAusZip(Buffer.from(await r.arrayBuffer()));
  if (text.trim().startsWith('{')) throw new Error(tabelle + '/' + regionalvariable + ': ' + text.slice(0, 300));
  return text;
}

const SPALTEN = ['ebene', 'ags', 'ars', 'gebiet_name', 'tabelle', 'kennzahl', 'dimension',
  'auspraegung', 'auspraegung_text', 'wert', 'wert_roh', 'einheit', 'lizenz', 'quelle_url'];

async function schreiben(zeilen) {
  const BLOCK = 800;
  for (let a = 0; a < zeilen.length; a += BLOCK) {
    const teil = zeilen.slice(a, a + BLOCK);
    const werte = [], platz = [];
    teil.forEach((z, k) => {
      const reihe = SPALTEN.map((s) => (s === 'lizenz' ? LIZENZ : s === 'quelle_url' ? QUELLE + z.tabelle : z[s]));
      platz.push('(' + reihe.map((_, j) => '$' + (k * SPALTEN.length + j + 1)).join(',') + ', now())');
      werte.push(...reihe);
    });
    await pool.query(
      'INSERT INTO mb.zensus_werte (' + SPALTEN.join(',') + ', abgerufen_am) VALUES ' + platz.join(',')
      + ' ON CONFLICT (ebene, ags, tabelle, kennzahl, dimension, auspraegung) DO UPDATE SET'
      + ' ars = EXCLUDED.ars, gebiet_name = EXCLUDED.gebiet_name, auspraegung_text = EXCLUDED.auspraegung_text,'
      + ' wert = EXCLUDED.wert, wert_roh = EXCLUDED.wert_roh, einheit = EXCLUDED.einheit,'
      + ' lizenz = EXCLUDED.lizenz, quelle_url = EXCLUDED.quelle_url, abgerufen_am = now()',
      werte);
  }
}

export async function importiere({ user = process.env.ZENSUS_USER, pass = process.env.ZENSUS_PASSWORD,
  tabellen = TABELLEN, log = console.log } = {}) {
  if (!user || !pass) throw new Error('ZENSUS_USER/ZENSUS_PASSWORD fehlen');
  const bilanz = [];
  for (const tabelle of tabellen) {
    for (const [rv, ebene] of Object.entries(EBENEN)) {
      const t0 = Date.now();
      const zeilen = parseFfcsv(await abruf(tabelle, rv, user, pass), tabelle, ebene);
      await schreiben(zeilen);
      const gesperrt = zeilen.filter((z) => z.wert === null).length;
      const gebiete = new Set(zeilen.map((z) => z.ags)).size;
      const dauer = Date.now() - t0;
      await q('INSERT INTO mb.zensus_abrufe (tabelle, ebene, werte, gesperrt, gebiete, dauer_ms) VALUES ($1,$2,$3,$4,$5,$6)',
        [tabelle, ebene, zeilen.length, gesperrt, gebiete, dauer]);
      log(`${tabelle} ${ebene.padEnd(8)} ${String(zeilen.length).padStart(7)} Werte · ${String(gebiete).padStart(5)} Gebiete · ${gesperrt} gesperrt · ${dauer} ms`);
      bilanz.push({ tabelle, ebene, werte: zeilen.length, gebiete, gesperrt });
    }
  }
  return bilanz;
}

// Direktaufruf: node src/services/ZensusImportService.js
if (process.argv[1] && process.argv[1].endsWith('ZensusImportService.js')) {
  importiere()
    .then((b) => {
      const kreise = Math.max(0, ...b.filter((x) => x.ebene === 'kreis').map((x) => x.gebiete));
      const gem = Math.max(0, ...b.filter((x) => x.ebene === 'gemeinde').map((x) => x.gebiete));
      console.log(`FERTIG: ${b.reduce((s, x) => s + x.werte, 0)} Werte, ${kreise} Kreise, ${gem} Gemeinden`);
      // Deckung nennen statt nur "fertig" (Lehre gold-audit)
      if (kreise < 380 || gem < 10000) { console.error('DECKUNG ZU GERING'); process.exitCode = 1; }
    })
    .catch((e) => { console.error('FEHLER', e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
