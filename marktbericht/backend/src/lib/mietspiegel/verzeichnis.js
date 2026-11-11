/* ═══════════════════════════════════════════════════════════════════════
   lib/mietspiegel/verzeichnis.js · v3250 — Mietspiegel-Verzeichnis lesen

   Liest verzeichnis.json (daneben, Aufbau im README) und gibt den Satz
   einer Gemeinde zurück. Phase 1: nur ob/welcher Art/wie lange/wo — keine
   Mietwerte. Route: GET /mietspiegel?ags=<8-stellig> (routes/api.js), in der
   Haupt-App über den Proxy /marktbericht/mietspiegel (frontend potenzial.js).
   Keine Datenbank: die Datei liegt im Image (COPY backend/).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERZEICHNIS_DATEI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verzeichnis.json');

/* Weg, wenn das Verzeichnis die Gemeinde nicht führt (§ 558c Abs. 4 Satz 2 BGB: Pflicht erst ab
   50.000 Einwohnern - das Verzeichnis führt alle Pflichtgemeinden). Ohne Portal- oder Quellennamen. */
export const HINWEIS_OHNE_SATZ = 'Für diese Gemeinde ist uns kein Mietspiegel bekannt. '
  + 'Pflicht ist ein Mietspiegel erst ab 50.000 Einwohnern (§ 558c Abs. 4 BGB); kleinere Gemeinden haben oft keinen. '
  + 'Ob es einen gibt, weiß die Stadt- oder Gemeindeverwaltung. Ohne Mietspiegel belegen drei Vergleichswohnungen '
  + 'oder ein Gutachten die Vergleichsmiete (§ 558a Abs. 2 BGB), auch der Mietspiegel einer vergleichbaren Gemeinde (§ 558a Abs. 4 BGB).';

let _cache = null;
export function verzeichnisLaden(datei = VERZEICHNIS_DATEI) {
  if (_cache && _cache.datei === datei) return _cache;
  const roh = JSON.parse(fs.readFileSync(datei, 'utf8'));
  const saetze = Array.isArray(roh) ? roh : (roh.saetze || []);
  const jeAgs = new Map();
  for (const s of saetze) if (s && s.ags) jeAgs.set(String(s.ags), s);
  _cache = { datei, stand: roh.stand || null, jeAgs, anzahl: saetze.length };
  return _cache;
}

/** AGS normalisieren: nur Ziffern, 8 Stellen (führende Null ergänzt, wenn 7 kamen). Sonst null. */
export function agsNorm(a) {
  const d = String(a == null ? '' : a).replace(/\D/g, '');
  if (d.length === 8) return d;
  if (d.length === 7) return '0' + d;
  return null;
}

/**
 * Satz der Gemeinde oder { art: null, gefunden: false, hinweis }.
 * Gefunden: alle Felder des Satzes plus { gefunden: true, verzeichnis_stand }.
 */
export function mietspiegelFuer(ags, datei) {
  const a = agsNorm(ags);
  if (!a) return null;
  const v = verzeichnisLaden(datei);
  const s = v.jeAgs.get(a);
  if (!s) return { ags: a, art: null, gefunden: false, hinweis: HINWEIS_OHNE_SATZ, verzeichnis_stand: v.stand };
  return Object.assign({}, s, { gefunden: true, verzeichnis_stand: v.stand });
}
