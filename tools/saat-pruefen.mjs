#!/usr/bin/env node
/* saat-pruefen.mjs · v1880 — Pflichtfelder einer Register-Saatdatei prüfen, BEVOR register-saat.mjs läuft.
 *
 * Doktrin (CLAUDE.md): jede Zahl trägt Herkunft — Quelle-URL, Berichtsjahr, Stichtag, Seite, Lizenz, Stufe.
 * Dieses Skript schreibt nichts; es nennt je Satz, was fehlt, und seine Deckung (wie viele Sätze es las).
 *
 * Aufruf:  node tools/saat-pruefen.mjs marktbericht/backend/src/lib/register/<datei>.json [...]
 * Rückgabe 1, wenn ein Satz eine Pflichtangabe nicht trägt. */
import fs from 'fs';

const PFLICHT = ['land_code', 'ags', 'ebene', 'gebiet_name', 'gaa_name', 'kennzahl', 'zweig', 'formel', 'belege', 'stufe', 'berichtsjahr', 'quelle_url', 'lizenz'];
const KENNZAHLEN = new Set(['liegenschaftszinssatz', 'sachwertfaktor', 'erbbaurechtskoeffizient', 'erbbauzinssatz', 'bodenpreisindex', 'bodenpreisniveau', 'durchschnittspreis']);
let rc = 0;
for (const f of process.argv.slice(2)) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`${f}: KEIN JSON — ${e.message}`); rc = 1; continue; }
  if (!Array.isArray(arr)) { console.log(`${f}: kein Array`); rc = 1; continue; }
  const fehler = []; const schl = new Map();
  arr.forEach((s, i) => {
    const wo = `#${i} ${s.gebiet_name || s.ags || '?'} ${s.kennzahl || ''}/${s.zweig || ''}`;
    for (const k of PFLICHT) if (s[k] == null || s[k] === '' || (Array.isArray(s[k]) && !s[k].length)) fehler.push(`${wo}: ${k} fehlt`);
    if (s.kennzahl && !KENNZAHLEN.has(s.kennzahl)) fehler.push(`${wo}: unbekannte kennzahl ${s.kennzahl}`);
    if (s.stufe && !/^[A-E]$/.test(s.stufe)) fehler.push(`${wo}: stufe ${s.stufe}`);
    if (s.formel && s.formel.form === 'konstante' && !(typeof s.formel.wert === 'number' && isFinite(s.formel.wert))) fehler.push(`${wo}: formel.wert keine Zahl`);
    if (s.formel && s.kennzahl === 'liegenschaftszinssatz' && typeof s.formel.wert === 'number' && (s.formel.wert <= 0 || s.formel.wert > 12)) fehler.push(`${wo}: Zins ${s.formel.wert} außerhalb 0–12 %`);
    (s.belege || []).forEach((b, j) => { if (!b.fundstelle || !/\d/.test(String(b.fundstelle))) fehler.push(`${wo}: beleg[${j}] ohne Seite/Fundstelle`); });
    if (s.quelle_url && !/^https?:\/\//.test(s.quelle_url)) fehler.push(`${wo}: quelle_url keine URL`);
    if (s.ags && !/^\d{5}(\d{3})?$/.test(String(s.ags))) fehler.push(`${wo}: ags ${s.ags} nicht 5- oder 8-stellig`);
    const key = [s.land_code, s.ags, s.kennzahl, s.zweig, s.berichtsjahr, s.quelle_url].join('|');
    schl.set(key, (schl.get(key) || 0) + 1);
  });
  for (const [k, n] of schl) if (n > 1) fehler.push(`Dublette (${n}×) im Upsert-Schlüssel: ${k.slice(0, 90)}`);
  const laender = [...new Set(arr.map(s => s.land_code))].join(',');
  const kz = {}; arr.forEach(s => { kz[s.kennzahl + '/' + s.zweig] = (kz[s.kennzahl + '/' + s.zweig] || 0) + 1; });
  console.log(`${f}: ${arr.length} Sätze gelesen · Länder ${laender} · Stufen ${[...new Set(arr.map(s => s.stufe))].join('')} · ${Object.entries(kz).map(([k, v]) => k + '=' + v).join(' ')}`);
  if (fehler.length) { rc = 1; console.log('  ' + fehler.slice(0, 40).join('\n  ')); if (fehler.length > 40) console.log(`  … ${fehler.length - 40} weitere`); }
  else console.log('  alle Pflichtfelder vorhanden, keine Dublette');
}
process.exit(rc);
