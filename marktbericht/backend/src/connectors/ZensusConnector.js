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
import { q } from '../lib/db.js';   /* v2162: mb.zensus_werte */
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


/* ══ v2162 · DIE DATENBANK ZUERST (N62.4) ═══════════════════════════════
   Marcel am 13.10.2026: „nicht in eine Datei schreiben, sondern direkt in
   eine Datenbank". mb.zensus_werte traegt Kreis UND Gemeinde, Miete und
   Leerstand nach Baujahr und Flaeche (ZensusImportService).

   Kein Treffer heisst kein Wert: fehlt die Gemeinde oder ist ihr Wert
   gesperrt, steht dort null — der KREISWERT steht daneben, als Kreiswert
   beschriftet, und wird nie als Gemeindewert ausgegeben. */

// "BAU1960B1969" / "BAU2016BXXXX" / "WFL080B099" / "WFL200BXXX" -> [von, bis]
function spanne(code, praefix) {
  const m = new RegExp('^' + praefix + '(\\d+)B(\\d+|X+)$').exec(String(code || ''));
  if (!m) return null;
  return [Number(m[1]), /^X+$/.test(m[2]) ? Infinity : Number(m[2])];
}
function klasseFuer(zeilen, dimension, praefix, wert) {
  if (wert == null || !Number.isFinite(Number(wert))) return null;
  const v = Number(wert);
  return zeilen.find((z) => z.dimension === dimension && (() => {
    const sp = spanne(z.auspraegung, praefix);
    return sp && v >= sp[0] && v <= sp[1] + (praefix === 'WFL' ? 0.999 : 0);
  })()) || null;
}
const num = (v) => (v == null ? null : Number(v));

async function ausDb({ kreisAgs, gemeindeAgs, baujahr, wohnflaeche }) {
  const k5 = String(kreisAgs || '').replace(/\D/g, '').slice(0, 5);
  const g8 = String(gemeindeAgs || '').replace(/\D/g, '').slice(0, 8);
  if (!k5 && !g8) return null;
  const rows = await q(
    'SELECT ebene, ags, gebiet_name, tabelle, kennzahl, dimension, auspraegung, auspraegung_text, wert, wert_roh, einheit'
    + ' FROM mb.zensus_werte WHERE (ebene = $1 AND ags = $2) OR (ebene = $3 AND ags = $4)',
    ['kreis', k5 || '-', 'gemeinde', g8.length === 8 ? g8 : '-']);
  if (!rows.length) return null;
  const teil = (ebene) => rows.filter((r) => r.ebene === ebene);
  function block(zs) {
    if (!zs.length) return null;
    const ges = (kz) => { const r = zs.find((z) => z.kennzahl === kz && z.dimension === 'gesamt'); return r ? num(r.wert) : null; };
    const bj = klasseFuer(zs.filter((z) => z.kennzahl === 'nettokaltmiete_qm'), 'baujahr', 'BAU', baujahr);
    const fl = klasseFuer(zs.filter((z) => z.kennzahl === 'nettokaltmiete_qm'), 'flaeche', 'WFL', wohnflaeche);
    const lbj = klasseFuer(zs.filter((z) => z.kennzahl === 'leerstandsquote'), 'baujahr', 'BAU', baujahr);
    const lfl = klasseFuer(zs.filter((z) => z.kennzahl === 'leerstandsquote'), 'flaeche', 'WFL', wohnflaeche);
    const dauer = zs.filter((z) => z.dimension === 'leerstandsdauer' && z.kennzahl === 'leerstand_anteil_pct' && z.auspraegung !== 'INSGESAMT')
      .sort((a, b) => String(a.auspraegung).localeCompare(String(b.auspraegung)))
      .map((z) => ({ text: z.auspraegung_text || z.auspraegung, anteil_pct: num(z.wert) }));
    return {
      ags: zs[0].ags, name: zs[0].gebiet_name,
      leerstandsquote: ges('leerstandsquote'),
      leerstandsquote_marktaktiv: ges('leerstandsquote_marktaktiv'),
      eigentuemerquote: ges('eigentuemerquote'),
      nettokaltmiete_qm: ges('nettokaltmiete_qm'),
      miete_baujahr: bj ? { klasse: bj.auspraegung_text, wert: num(bj.wert) } : null,
      miete_flaeche: fl ? { klasse: fl.auspraegung_text, wert: num(fl.wert) } : null,
      leerstand_baujahr: lbj ? { klasse: lbj.auspraegung_text, wert: num(lbj.wert) } : null,
      leerstand_flaeche: lfl ? { klasse: lfl.auspraegung_text, wert: num(lfl.wert) } : null,
      leerstandsdauer: dauer.length ? dauer : null
    };
  }
  const kreis = block(teil('kreis'));
  const gemeinde = block(teil('gemeinde'));
  return { kreis, gemeinde };
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
      /* v2161: Tabellen und Lizenz gehoeren zur Herkunft (Datei aus tools/zensus-kreise-holen.mjs). */
      license: '© Statistische Ämter des Bundes und der Länder, Zensus 2022 (Tabellen 4000W-0001, 4000W-0004), Datenlizenz Deutschland – Namensnennung – 2.0',
      quelle_url: 'https://ergebnisse.zensus2022.de/datenbank/online/table/4000W-0001',
    };
  },

  // Diagnose: ist die Datei da, wie viele Kreise, welche Spalten erkannt, ein Beispiel.
  status() {
    const c = load();
    const sample = c.byAgs && c.byAgs.size ? Object.fromEntries([...c.byAgs.entries()].slice(0, 3)) : {};
    return { loaded: !c.error && c.count > 0, count: c.count || 0, columns: c.columns || [],
             detected: c.detected || null, error: c.error || null, path: c.path, sample };
  },

  /* v2162 · Datenbank zuerst, Datei nur als Rueckfall (Tabelle leer oder
     nicht erreichbar). Die alten Felder (leerstandsquote, eigentuemerquote,
     nettokaltmiete_qm, kreis_name) bleiben KREISWERTE — wie bisher —, damit
     Bericht, PDF und Pilot-Prompt unveraendert weiterlesen. */
  async lookupDb({ kreisAgs, gemeindeAgs, baujahr, wohnflaeche } = {}) {
    let d = null;
    try { d = await ausDb({ kreisAgs, gemeindeAgs, baujahr, wohnflaeche }); } catch (e) { d = null; }
    if (!d || !d.kreis) {
      const alt = this.lookup(kreisAgs);
      return Object.assign({}, alt, { herkunft: 'datei' });
    }
    const k = d.kreis;
    return {
      available: true, source: 'zensus2022', herkunft: 'datenbank', stichtag: '2022-05-15',
      leerstandsquote: k.leerstandsquote,
      eigentuemerquote: k.eigentuemerquote,
      nettokaltmiete_qm: k.nettokaltmiete_qm,
      leerstandsquote_marktaktiv: k.leerstandsquote_marktaktiv,
      jung_18_30: null,
      kreis_name: k.name || null,
      kreis: k,
      gemeinde: d.gemeinde,      /* null = Gemeinde nicht in der Tabelle */
      objekt: { baujahr: baujahr || null, wohnflaeche: wohnflaeche || null },
      license: '© Statistische Ämter des Bundes und der Länder, Zensus 2022 (Tabellen 4000W-0001/-0002/-0004/-0005/-0009/-0017/-0021/-1022), Datenlizenz Deutschland – Namensnennung – 2.0',
      quelle_url: 'https://ergebnisse.zensus2022.de/datenbank/online/table/4000W-0004',
    };
  },
};
