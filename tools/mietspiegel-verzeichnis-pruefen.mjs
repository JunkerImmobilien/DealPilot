#!/usr/bin/env node
// Prüft das Mietspiegel-Verzeichnis (Phase 1, nur Verzeichnis, keine Tabellenwerte):
//   marktbericht/backend/src/lib/mietspiegel/verzeichnis.json
// - Pflichtfelder je Satz, AGS 8-stellig und eindeutig, Landeskürzel passt zum AGS
// - gültige Werte für art / zugang / form, Datumsformate
// - URL vorhanden außer bei art 'keiner' (bei 'unklar' nur Hinweis)
// - vermutung_bis abgelaufen -> "veraltet" (gezählt und ausgegeben)
// - einfacher Mietspiegel, Stand älter als 2 Jahre -> "Anpassung überfällig" (§ 558c Abs. 3, Soll)
// RC=0 sauber, RC=1 Formfehler. Veraltete Sätze sind KEIN Formfehler (die Welt altert), nur Ausgabe.
// Aufruf: node tools/mietspiegel-verzeichnis-pruefen.mjs [--heute=JJJJ-MM-TT] [--liste]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATEI = path.join(WURZEL, 'marktbericht/backend/src/lib/mietspiegel/verzeichnis.json');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
const HEUTE = arg('heute') || new Date().toISOString().slice(0, 10);
const LISTE = process.argv.includes('--liste');

const ART = ['qualifiziert', 'einfach', 'keiner', 'unklar'];
const ZUGANG = ['frei', 'kostenpflichtig', 'online_rechner', 'auf_anfrage', null];
const FORM = ['tabelle', 'punkte', 'regression', 'online_rechner', 'unbekannt'];
const HERLEITUNG = ['angegeben', 'abgeleitet_gueltig_ab_plus_2', 'abgeleitet_stand_plus_2', null];
const LAND = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
const PFLICHT = ['ags', 'gemeinde', 'land', 'einwohner_ca', 'art', 'stand', 'gueltig_ab', 'gueltig_bis',
  'naechste_anpassung', 'vermutung_bis', 'vermutung_bis_herleitung', 'ersteller', 'url', 'zugang', 'preis',
  'form', 'quelle_geprueft_am', 'beleg', 'hinweis'];
const DATUM = /^\d{4}(-\d{2}(-\d{2})?)?$/; // JJJJ, JJJJ-MM oder JJJJ-MM-TT

const roh = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
const saetze = Array.isArray(roh) ? roh : roh.saetze;
if (!Array.isArray(saetze)) { console.error('verzeichnis.json: kein Feld "saetze"'); process.exit(1); }

const fehler = [];
const veraltet = [];
const anpassungFaellig = [];
const agsGesehen = new Set();
const jeArt = {};
const jeZugang = {};
let pflicht50 = 0;

for (const [i, s] of saetze.entries()) {
  const id = `#${i} ${s.ags || '?'} ${s.gemeinde || '?'}`;
  for (const f of PFLICHT) if (!(f in s)) fehler.push(`${id}: Feld fehlt: ${f}`);
  if (!/^\d{8}$/.test(String(s.ags))) fehler.push(`${id}: AGS nicht 8-stellig`);
  else {
    if (agsGesehen.has(s.ags)) fehler.push(`${id}: AGS doppelt`);
    agsGesehen.add(s.ags);
    if (LAND[s.ags.slice(0, 2)] !== s.land) fehler.push(`${id}: Land ${s.land} passt nicht zum AGS`);
  }
  if (!s.gemeinde) fehler.push(`${id}: gemeinde leer`);
  if (!Number.isFinite(s.einwohner_ca) || s.einwohner_ca <= 0) fehler.push(`${id}: einwohner_ca keine Zahl`);
  if (!ART.includes(s.art)) fehler.push(`${id}: art ungültig: ${s.art}`);
  if (!ZUGANG.includes(s.zugang)) fehler.push(`${id}: zugang ungültig: ${s.zugang}`);
  if (!FORM.includes(s.form)) fehler.push(`${id}: form ungültig: ${s.form}`);
  if (!HERLEITUNG.includes(s.vermutung_bis_herleitung)) fehler.push(`${id}: vermutung_bis_herleitung ungültig`);
  for (const f of ['stand', 'gueltig_ab', 'gueltig_bis', 'naechste_anpassung', 'vermutung_bis', 'erhebungsstichtag']) {
    if (s[f] != null && !DATUM.test(String(s[f]))) fehler.push(`${id}: ${f} kein Datum: ${s[f]}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.quelle_geprueft_am))) fehler.push(`${id}: quelle_geprueft_am fehlt`);
  if (!s.beleg) fehler.push(`${id}: beleg leer`);
  if (s.art !== 'keiner' && s.art !== 'unklar' && !s.url) fehler.push(`${id}: url fehlt (art ${s.art})`);
  if (s.url && !/^https?:\/\//.test(s.url)) fehler.push(`${id}: url kein Link`);
  if (s.zugang === 'kostenpflichtig' && !s.preis) fehler.push(`${id}: kostenpflichtig ohne preis`);
  if (s.art === 'qualifiziert' && !s.vermutung_bis) fehler.push(`${id}: qualifiziert ohne vermutung_bis`);
  if (s.art !== 'qualifiziert' && s.vermutung_bis) fehler.push(`${id}: vermutung_bis nur bei qualifiziert`);
  if (s.art === 'unklar' && !s.hinweis) fehler.push(`${id}: unklar ohne hinweis`);

  jeArt[s.art] = (jeArt[s.art] || 0) + 1;
  if (s.art === 'qualifiziert' || s.art === 'einfach') jeZugang[s.zugang] = (jeZugang[s.zugang] || 0) + 1;
  if (s.einwohner_ca >= 50000) pflicht50++;

  // Datum für Vergleiche auf den letzten Tag auffüllen (JJJJ -> 31.12., JJJJ-MM -> Monatsende)
  const bisTag = (d) => {
    const t = String(d).split('-');
    if (t.length === 3) return d;
    if (t.length === 2) return new Date(Date.UTC(+t[0], +t[1], 0)).toISOString().slice(0, 10);
    return `${t[0]}-12-31`;
  };
  if (s.vermutung_bis && bisTag(s.vermutung_bis) < HEUTE) veraltet.push(s);
  if (s.art === 'einfach' && s.stand) {
    const t = String(s.stand).split('-');
    const plus2 = bisTag([+t[0] + 2, ...t.slice(1)].join('-'));
    if (plus2 < HEUTE) anpassungFaellig.push({ ...s, faellig: plus2 });
  }
}

const n = saetze.length;
console.log(`Mietspiegel-Verzeichnis: ${n} Sätze, davon ${pflicht50} Gemeinden ab 50.000 EW (Stichtag Prüfung ${HEUTE})`);
console.log('je art:   ' + ART.map((a) => `${a} ${jeArt[a] || 0}`).join(' · '));
console.log('Zugang (qualifiziert+einfach): ' + Object.entries(jeZugang).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`veraltet (vermutung_bis abgelaufen): ${veraltet.length}`);
for (const s of veraltet) console.log(`  ${s.ags} ${s.gemeinde} (${s.land}) vermutung_bis ${s.vermutung_bis} [${s.vermutung_bis_herleitung}]`);
console.log(`einfach, Anpassung überfällig (Stand + 2 J., § 558c Abs. 3 Soll): ${anpassungFaellig.length}`);
for (const s of anpassungFaellig) console.log(`  ${s.ags} ${s.gemeinde} (${s.land}) Stand ${s.stand} -> ${s.faellig}`);
if (LISTE) {
  const u = saetze.filter((s) => s.art === 'unklar');
  console.log(`unklar: ${u.length}`);
  for (const s of u) console.log(`  ${s.ags} ${s.gemeinde} (${s.land}) — ${String(s.hinweis).slice(0, 110)}`);
}
if (fehler.length) {
  console.log(`\nFORMFEHLER: ${fehler.length}`);
  for (const f of fehler.slice(0, 40)) console.log('  ' + f);
  if (fehler.length > 40) console.log(`  … und ${fehler.length - 40} weitere`);
  process.exit(1);
}
console.log('\nRC=0 — Form sauber.');
