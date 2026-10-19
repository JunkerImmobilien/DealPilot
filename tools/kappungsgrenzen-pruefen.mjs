#!/usr/bin/env node
// tools/kappungsgrenzen-pruefen.mjs
// ─────────────────────────────────────────────────────────────────────
// Prueft frontend/js/data/kappungsgrenzen.json — die Kappungsgrenzen
// (§ 558 Abs. 3 BGB) und Mietpreisbremse (§ 556d BGB) je Land und Gemeinde.
//
// Geprueft wird:
//   - Kopf: stand (ISO-Datum), quelle_hinweis, alle 16 Laender vorhanden
//   - je Land: Pflichtfelder, belege nicht leer, unsicher => unsicher_grund
//   - je Verordnung: fundstelle, url, gueltig_ab/gueltig_bis als echtes Datum,
//     und sie GILT am Stichtag (gueltig_ab <= stand <= gueltig_bis)
//   - je Gemeinde: AGS genau 8 Ziffern mit dem Laenderpraefix, keine Dublette,
//     kappung15/mietpreisbremse als Boolean, kein Flag ohne Verordnung dahinter
//   - Zaehlung je Land (Kappung 15 % / Mietpreisbremse / AGS ohne Treffer)
//
// RC 0 = sauber, RC 1 = Befund. Aufruf: node tools/kappungsgrenzen-pruefen.mjs [datei]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const DATEI = path.resolve(process.argv[2] || path.join(HIER, '..', 'frontend', 'js', 'data', 'kappungsgrenzen.json'));

const PRAEFIX = {
  SH: '01', HH: '02', NI: '03', HB: '04', NW: '05', HE: '06', RP: '07', BW: '08',
  BY: '09', SL: '10', BE: '11', BB: '12', MV: '13', SN: '14', ST: '15', TH: '16',
};

const fehler = [];
const warn = [];
const f = (m) => fehler.push(m);

function istDatum(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function pruefeVerordnung(wo, vo, stand) {
  for (const k of ['verordnung', 'fundstelle', 'url', 'gueltig_ab', 'gueltig_bis']) {
    if (vo[k] === undefined || vo[k] === null || vo[k] === '') f(`${wo}: Pflichtfeld ${k} fehlt`);
  }
  if (vo.url && !/^https?:\/\//.test(vo.url)) f(`${wo}: url ist kein Link (${vo.url})`);
  const ab = vo.gueltig_ab, bis = vo.gueltig_bis;
  if (ab != null && !istDatum(ab)) f(`${wo}: gueltig_ab kein gueltiges Datum (${ab})`);
  if (bis != null && !istDatum(bis)) f(`${wo}: gueltig_bis kein gueltiges Datum (${bis})`);
  if (istDatum(ab) && istDatum(bis) && ab > bis) f(`${wo}: gueltig_ab ${ab} nach gueltig_bis ${bis}`);
  if (istDatum(ab) && ab > stand) f(`${wo}: gilt erst ab ${ab}, Stand ist ${stand}`);
  if (istDatum(bis) && bis < stand) f(`${wo}: am ${bis} ausgelaufen, Stand ist ${stand}`);
  // Laeuft binnen 120 Tagen nach dem Stand aus -> Nachernte faellig
  if (istDatum(bis) && istDatum(stand) && bis >= stand
      && (new Date(bis) - new Date(stand)) / 86400000 <= 120) warn.push(`${wo}: laeuft am ${bis} aus — Nachfolge pruefen`);
  // Heute (Laufzeit des Pruefers) schon ausgelaufen -> die Datei ist veraltet
  const heute = new Date().toISOString().slice(0, 10);
  if (istDatum(bis) && bis < heute) f(`${wo}: heute (${heute}) ausgelaufen — neu ernten`);
}

let daten;
try {
  daten = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
} catch (e) {
  console.error(`ROT  ${DATEI} nicht lesbar: ${e.message}`);
  process.exit(1);
}

if (!istDatum(daten.stand)) f(`Kopf: stand kein gueltiges Datum (${daten.stand})`);
if (!daten.quelle_hinweis) f('Kopf: quelle_hinweis fehlt');
if (!daten.laender || typeof daten.laender !== 'object') f('Kopf: laender fehlt');
const stand = daten.stand;
const laender = daten.laender || {};

for (const k of Object.keys(laender)) if (!PRAEFIX[k]) f(`unbekanntes Land ${k}`);

const zeilen = [];
const alleAgs = new Map();
for (const [land, pre] of Object.entries(PRAEFIX)) {
  const L = laender[land];
  if (!L) { f(`${land}: fehlt`); continue; }
  for (const k of ['verordnung', 'kappung_pct_gelistet', 'mietpreisbremse_gelistet', 'gemeinden', 'belege']) {
    if (!(k in L)) f(`${land}: Feld ${k} fehlt`);
  }
  if (!Array.isArray(L.belege) || L.belege.length === 0) f(`${land}: keine belege`);
  if (L.unsicher === true && !L.unsicher_grund) f(`${land}: unsicher ohne unsicher_grund`);

  const hatKappung = L.verordnung != null;
  if (hatKappung) {
    pruefeVerordnung(`${land} Kappung`, L, stand);
    if (L.kappung_pct_gelistet !== 15) f(`${land}: kappung_pct_gelistet muss 15 sein (${L.kappung_pct_gelistet})`);
  } else if (L.kappung_pct_gelistet != null) {
    f(`${land}: kappung_pct_gelistet ohne Verordnung`);
  }
  const mpb = L.mietpreisbremse_verordnung;
  if (mpb) pruefeVerordnung(`${land} Mietpreisbremse`, mpb, stand);
  (L.weitere_verordnungen || []).forEach((w, i) => pruefeVerordnung(`${land} weitere_verordnungen[${i}]`, w, stand));
  if (typeof L.mietpreisbremse_gelistet !== 'boolean') f(`${land}: mietpreisbremse_gelistet kein Boolean`);
  if (L.mietpreisbremse_gelistet && !mpb) f(`${land}: mietpreisbremse_gelistet ohne mietpreisbremse_verordnung`);

  const gem = Array.isArray(L.gemeinden) ? L.gemeinden : [];
  let k15 = 0, mb = 0, ohne = 0;
  const gesehen = new Set();
  for (const g of gem) {
    const wo = `${land} ${g.name || '?'}`;
    if (!g.name) f(`${wo}: name fehlt`);
    if (typeof g.kappung15 !== 'boolean') f(`${wo}: kappung15 kein Boolean`);
    if (typeof g.mietpreisbremse !== 'boolean') f(`${wo}: mietpreisbremse kein Boolean`);
    if (g.kappung15 && !hatKappung) f(`${wo}: kappung15 ohne Kappungs-Verordnung`);
    if (g.mietpreisbremse && !mpb) f(`${wo}: mietpreisbremse ohne Verordnung`);
    if (!g.kappung15 && !g.mietpreisbremse) f(`${wo}: weder Kappung noch Mietpreisbremse — gehoert nicht in die Liste`);
    for (const [flag, feld] of [['kappung15', 'kappung_gueltig_bis'], ['mietpreisbremse', 'mietpreisbremse_gueltig_bis']]) {
      if (!g[flag]) continue;
      if (!istDatum(g[feld])) f(`${wo}: ${feld} kein gueltiges Datum (${g[feld]})`);
      else if (g[feld] < stand) f(`${wo}: ${feld} ${g[feld]} vor Stand ${stand}`);
    }
    if (g.kappung15) k15++;
    if (g.mietpreisbremse) mb++;
    if (g.ags === null) {
      ohne++;
      if (!g.hinweis) f(`${wo}: ags null ohne hinweis`);
      continue;
    }
    if (typeof g.ags !== 'string' || !/^\d{8}$/.test(g.ags)) { f(`${wo}: AGS nicht 8-stellig (${g.ags})`); continue; }
    if (!g.ags.startsWith(pre)) f(`${wo}: AGS ${g.ags} passt nicht zum Land (${pre})`);
    if (gesehen.has(g.ags)) f(`${wo}: AGS ${g.ags} doppelt`);
    gesehen.add(g.ags);
    if (alleAgs.has(g.ags)) f(`${wo}: AGS ${g.ags} auch in ${alleAgs.get(g.ags)}`);
    alleAgs.set(g.ags, land);
  }
  if (L.anzahl_kappung15 != null && L.anzahl_kappung15 !== k15) f(`${land}: anzahl_kappung15 ${L.anzahl_kappung15}, gezaehlt ${k15}`);
  if (L.anzahl_mietpreisbremse != null && L.anzahl_mietpreisbremse !== mb) f(`${land}: anzahl_mietpreisbremse ${L.anzahl_mietpreisbremse}, gezaehlt ${mb}`);
  if (L.unsicher) warn.push(`${land}: unsicher — ${L.unsicher_grund}`);
  zeilen.push(`${land}  ${String(k15).padStart(4)}  ${String(mb).padStart(4)}  ${String(ohne).padStart(4)}  ${hatKappung ? (L.gueltig_bis || '') : 'keine VO, 20 %'}${L.unsicher ? '  UNSICHER' : ''}`);
}

console.log(`Datei ${path.relative(process.cwd(), DATEI)} · Stand ${stand}`);
console.log('Land  K15   MPB  ohneAGS  Kappung bis');
for (const z of zeilen) console.log(z);
console.log(`Summe Gemeinden mit AGS: ${alleAgs.size}`);
for (const w of warn) console.log(`HINWEIS ${w}`);
if (fehler.length) {
  console.log(`ROT  ${fehler.length} Befund(e):`);
  for (const m of fehler.slice(0, 40)) console.log(`  - ${m}`);
  if (fehler.length > 40) console.log(`  … und ${fehler.length - 40} weitere`);
  process.exit(1);
}
console.log('GRUEN  RC 0');
