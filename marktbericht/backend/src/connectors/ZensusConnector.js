// ZensusConnector.js — amtliche Zensus-2022-Kennzahlen (Leerstand, Eigentuemerquote,
// Ø-Nettokaltmiete) je Kreis. KOSTENLOS, offline: liest eine vom Nutzer einmalig
// befuellte CSV (keine erfundenen Werte, kein laufender API-Aufruf, keine Kosten).
//
// Datei (Default): backend/data/zensus2022_kreise.csv  (per ENV ZENSUS_FILE ueberschreibbar)
// Erwartete Spalten (Trennzeichen ; , oder Tab; deutsche Dezimalkommas):
//   ags ; name ; leerstandsquote ; eigentuemerquote ; nettokaltmiete_qm
// Spalten werden tolerant per Namens-Teilstring erkannt (leerstand / eigentüm / miete).
// Quelle der Werte: Zensus 2022, ergebnisse.zensus2022.de (Thema Wohnungen).
// Lizenz: frei nutzbar mit Quellenangabe "© Statistische Aemter des Bundes und der Laender, 2024".

import fs from 'fs';
import { fileURLToPath } from 'url';

const DEFAULT_FILE = fileURLToPath(new URL('../../data/zensus2022_kreise.csv', import.meta.url));
function filePath() { return process.env.ZENSUS_FILE || DEFAULT_FILE; }

let _cache = null; // { byAgs: Map<ags5, metrics>, count, columns, mtimeMs, error? }

function parseDe(s) {
  if (s == null) return null;
  let t = String(s).replace(/"/g, '').trim();
  if (!t || /^(\.\.\.|x|–|-|n\/?a)$/i.test(t) || /^[.,\s-]*$/.test(t)) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); // deutsches Format: . = Tausender
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function detectSep(headerLine) {
  const counts = { ';': (headerLine.match(/;/g) || []).length,
                   '\t': (headerLine.match(/\t/g) || []).length,
                   ',': (headerLine.match(/,/g) || []).length };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ';';
}

function load() {
  const path = filePath();
  let stat;
  try { stat = fs.statSync(path); }
  catch { _cache = { byAgs: new Map(), count: 0, columns: [], mtimeMs: 0, error: 'datei_fehlt', path }; return _cache; }
  if (_cache && _cache.mtimeMs === stat.mtimeMs && !_cache.error) return _cache; // Cache gueltig

  try {
    const raw = fs.readFileSync(path, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { _cache = { byAgs: new Map(), count: 0, columns: [], mtimeMs: stat.mtimeMs, error: 'leer', path }; return _cache; }
    const sep = detectSep(lines[0]);
    const header = lines[0].split(sep).map((h) => h.replace(/"/g, '').trim().toLowerCase());
    const find = (...needles) => header.findIndex((h) => needles.some((n) => h.includes(n)));
    const idxAgs = find('ags', 'schlüssel', 'schluessel', 'regionalschl', 'kreis');
    const idxLeer = find('leerstand');
    const idxEig = find('eigentüm', 'eigentuem', 'eigentum');
    const idxMiete = find('miete');
    const idxName = find('name', 'bezeichnung', 'kreis');
    const idxJung = find('18_30', '18-30', 'jung', 'alter_18', '18bis30', '18_bis_30', 'anteil_18');

    const byAgs = new Map();
    for (const line of lines.slice(1)) {
      const cols = line.split(sep);
      const agsRaw = idxAgs >= 0 ? String(cols[idxAgs] || '').replace(/[^0-9]/g, '') : '';
      if (agsRaw.length < 4) continue;             // keine plausible AGS
      const ags5 = agsRaw.slice(0, 5);
      if (ags5 === '00000') continue;              // Platzhalter-Zeile der Vorlage ignorieren
      const m = {
        leerstandsquote: idxLeer >= 0 ? parseDe(cols[idxLeer]) : null,
        eigentuemerquote: idxEig >= 0 ? parseDe(cols[idxEig]) : null,
        nettokaltmiete_qm: idxMiete >= 0 ? parseDe(cols[idxMiete]) : null,
        jung_18_30: idxJung >= 0 ? parseDe(cols[idxJung]) : null,
        name: idxName >= 0 ? String(cols[idxName] || '').replace(/"/g, '').trim() : null,
      };
      if (m.leerstandsquote == null && m.eigentuemerquote == null && m.nettokaltmiete_qm == null && m.jung_18_30 == null) continue;
      byAgs.set(ags5, m);
    }
    _cache = { byAgs, count: byAgs.size, columns: header, mtimeMs: stat.mtimeMs,
               detected: { ags: idxAgs, leerstand: idxLeer, eigentuemer: idxEig, miete: idxMiete, jung: idxJung }, path };
    return _cache;
  } catch (e) {
    _cache = { byAgs: new Map(), count: 0, columns: [], mtimeMs: stat.mtimeMs, error: e.message, path };
    return _cache;
  }
}

export const ZensusConnector = {
  code: 'zensus2022',

  // ags (5- oder mehrstellig) -> { available, source, ... } | {available:false, reason}
  lookup(ags) {
    const c = load();
    if (c.error) return { available: false, source: 'zensus2022', reason: c.error };
    if (!ags) return { available: false, source: 'zensus2022', reason: 'kein_ags' };
    const m = c.byAgs.get(String(ags).slice(0, 5));
    if (!m) return { available: false, source: 'zensus2022', reason: 'kreis_nicht_in_datei' };
    return {
      available: true, source: 'zensus2022', stichtag: '2022-05-15',
      leerstandsquote: m.leerstandsquote,
      eigentuemerquote: m.eigentuemerquote,
      nettokaltmiete_qm: m.nettokaltmiete_qm,
      jung_18_30: m.jung_18_30,
      kreis_name: m.name || null,
      license: '© Statistische Ämter des Bundes und der Länder, 2024',
    };
  },

  // Diagnose: ist die Datei da, wie viele Kreise, welche Spalten erkannt, ein Beispiel.
  status() {
    const c = load();
    const sample = c.byAgs && c.byAgs.size ? Object.fromEntries([...c.byAgs.entries()].slice(0, 3)) : {};
    return { loaded: !c.error && c.count > 0, count: c.count || 0, columns: c.columns || [],
             detected: c.detected || null, error: c.error || null, path: c.path, sample };
  },
};
