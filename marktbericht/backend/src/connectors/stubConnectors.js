// stubConnectors.js
// GeoMap -> connectors/GeoMapConnector.js (echt). BORIS -> BorisConnector.js (echt).
import { httpJson, httpText } from '../lib/http.js';
import { cfg, destatisEnabled } from '../lib/config.js';

// Destatis / Regionalstatistik (GENESIS-Online, regionalstatistik.de)
// REST/JSON, POST. Auth: username (= persoenlicher Token 32 Z. ODER Kennung) + password
// (password entfaellt bei Token). Pfade/Codes aus GENESIS-Webservice-Doku v5.0 + Swagger:
//   - WICHTIG: regionalstatistik.de nutzt /genesisws/ (klein), Destatis /genesisWS/ (gross).
//   - Auth-Test:      POST /helloworld/logincheck
//   - Tabellenabruf:  POST /data/table   (name = Tabellencode)
//   - Bevoelkerung:   Statistik 12411, Tabelle 12411-0014 "Bevoelkerung: Kreise, Stichtag, Geschlecht"
//   - Regionalfilter: regionalvariable (z.B. KREISE) + regionalkey (AGS)

// Pfad-Kandidaten (gegen genesisws/genesisWS-Verwechslung robust). Konfigurierter zuerst.
function baseCandidates() {
  const list = [
    cfg.destatis.base,
    'https://www.regionalstatistik.de/genesisws/rest/2020',
    'https://www.regionalstatistik.de/genesisWS/rest/2020',
  ];
  return [...new Set(list.filter(Boolean))];
}

// GENESIS-2020-API erwartet die Zugangsdaten (auch) als HTTP-HEADER. Token wird als
// username eingesetzt, Passwort bleibt leer (Doku v5.0). Wir senden Header UND Form
// gleichzeitig -> robust gegen beide Deployment-Varianten, kein Regressionsrisiko.
function authHeaders() {
  return { username: cfg.destatis.token || '', password: cfg.destatis.password || '' };
}

async function tryLogin(base) {
  try {
    const r = await httpText(`${base}/helloworld/logincheck`, {
      method: 'POST',
      headers: authHeaders(),
      form: { username: cfg.destatis.token, password: cfg.destatis.password || '', language: 'de' },
      timeoutMs: 15000, retries: 0,
    });
    let d = null; try { d = JSON.parse(r.text); } catch { d = null; }
    const ok = !!(d && (d.Username || (typeof d.Status === 'string' && /erfolg|success|gueltig|gültig/i.test(d.Status))));
    return { ok, status: d ? d.Status : (r.text || '').slice(0, 200), username: d && d.Username, base };
  } catch (e) {
    return { ok: false, reason: e.message, base };
  }
}

// Den FUNKTIONIERENDEN Base-Pfad einmal ermitteln und cachen. Wird von logincheck UND
// vom Tabellen-Abruf genutzt -> kein 404 mehr durch genesisws/genesisWS-Verwechslung.
let _resolvedBase = null;
async function resolveBase() {
  if (_resolvedBase) return _resolvedBase;
  let last = null;
  for (const base of baseCandidates()) {
    const r = await tryLogin(base);
    last = r;
    if (r.ok) { _resolvedBase = base; return base; }
    if (r.reason && !/HTTP 404/.test(r.reason)) break; // echter Auth-Fehler -> nicht weiter raten
  }
  return (last && last.base) || cfg.destatis.base; // kein ok gefunden -> Default (Fehler wird sichtbar)
}

export const DestatisConnector = {
  code: 'destatis',
  available() { return destatisEnabled(); },

  // Auth-Test: probiert die Pfad-Kandidaten durch, meldet den funktionierenden base.
  async logincheck() {
    if (!destatisEnabled()) return { ok: false, reason: 'kein_token' };
    let last = null;
    for (const base of baseCandidates()) {
      const r = await tryLogin(base);
      last = r;
      if (r.ok) { _resolvedBase = base; return r; }   // funktionierender Pfad gefunden + gecacht
      if (r.reason && !/HTTP 404/.test(r.reason)) return r; // echter Auth-Fehler -> nicht weiter raten
    }
    return last || { ok: false, reason: 'kein_pfad' };
  },

  // {ags, city} -> { available, source, metrics:{...}, tables, reason? }
  // Ruft die regionalen GENESIS-Tabellen (Bevoelkerung, Einkommen, Arbeitslosenquote) im
  // flachen ffcsv-Format ab und leitet daraus die Metriken fuer den Makro-Score ab.
  async macro({ ags, city } = {}) {
    if (!destatisEnabled()) {
      return { available: false, source: 'destatis', reason: 'kein_token', metrics: null,
               note: 'Sozioökonomie nicht angebunden – kostenlosen Token bei regionalstatistik.de hinterlegen.' };
    }
    if (!ags) {
      return { available: false, source: 'destatis', reason: 'kein_ags', metrics: null,
               note: 'Kein Kreis-Schlüssel (AGS) zum Standort ermittelt – regionaler Abruf nicht möglich.' };
    }
    const krs = String(ags).slice(0, 5);
    const now = new Date().getFullYear();
    // Veralteten Destatis-Bundescode (Format NNNNN-NNNN, z.B. 12411-0014 aus alter .env)
    // automatisch auf den regionalstatistik-Kreis-Code mappen -> robust gegen stale .env.
    const popRaw = cfg.destatis.tablePopulation || '12411-01-01-4';
    const popCode = /^\d{5}-\d{4}$/.test(popRaw) ? '12411-01-01-4' : popRaw;
    const tables = {
      bevoelkerung: popCode,
      einkommen: cfg.destatis.tableIncome,
      arbeitslosenquote: cfg.destatis.tableUnemployment,
    };
    const series = {};
    for (const [key, name] of Object.entries(tables)) {
      if (!name) continue;
      try {
        const txt = await this._fetchTableFfcsv(name, krs, now);
        const csv = this._extractCsv(txt);                 // JSON-Envelope -> Object.Content, sonst Rohtext
        let s = this._parseDatencsvSeries(csv, krs);        // datencsv-Pivot (regionalstatistik-Default)
        if (!s || !s.length) s = this._parseFfcsvSeries(csv, krs); // Fallback: tidy ffcsv
        series[key] = s;
      } catch { series[key] = null; }
    }

    // Metriken ableiten (defensiv – fehlende Werte bleiben undefined -> Score ignoriert sie)
    const metrics = {};
    const bev = series.bevoelkerung;
    if (bev && bev.length >= 2) {
      const first = bev[0].value, last = bev[bev.length - 1].value, yrs = bev[bev.length - 1].year - bev[0].year || 1;
      if (first > 0 && last > 0) metrics.bevoelkerung_trend = ((last / first) ** (1 / yrs) - 1) * 100; // %/Jahr
    }
    const ein = series.einkommen;
    if (ein && ein.length) {
      const v = ein[ein.length - 1].value; // verfuegbares Einkommen je Einwohner (€)
      if (v > 0) metrics.kaufkraft_idx = (v / 24000) * 100; // grob: Bundesschnitt ~24.000 € = Index 100
    }
    const alq = series.arbeitslosenquote;
    if (alq && alq.length) {
      const v = alq[alq.length - 1].value;
      if (v >= 0) metrics.arbeitslosenquote = v;
    }

    const hasAny = Object.keys(metrics).length > 0;
    return {
      available: hasAny, source: 'destatis', metrics: hasAny ? metrics : null,
      kreis_ags: krs, tables_used: tables,
      reason: hasAny ? undefined : 'kein_wert_geparst',
      note: hasAny ? 'Sozioökonomie aus GENESIS-Regionalstatistik (Kreisebene).'
                   : 'GENESIS antwortete, aber es konnten keine Werte geparst werden (Format prüfen über /destatis/raw).',
    };
  },

  // 18-30-Anteil (%) aus der Destatis-Altersgruppen-Tabelle. Best-effort + defensiv.
  // Tabellencode via env DESTATIS_TABLE_AGE (Standardvermutung als Fallback).
  async ageShare18_30({ ags } = {}) {
    if (!destatisEnabled()) return { available: false, reason: 'kein_token' };
    if (!ags) return { available: false, reason: 'kein_ags' };
    const krs = String(ags).slice(0, 5);
    const table = process.env.DESTATIS_TABLE_AGE || '12411-04-02-4';
    try {
      const txt = await this._fetchTableFfcsv(table, krs, new Date().getFullYear());
      const csv = this._extractCsv(txt);
      const p = this._parseAgeShare(csv);
      if (p && p.share != null) return { available: true, source: 'destatis', table, ...p };
      return { available: false, source: 'destatis', table, reason: 'kein_wert_geparst', head: (csv || '').slice(0, 300) };
    } catch (e) { return { available: false, source: 'destatis', table, reason: e.message }; }
  },

  // Heuristischer Alters-Parser: summiert Werte mit Alters-Untergrenze 18..29, teilt durch Insgesamt.
  _parseAgeShare(csv) {
    if (!csv) return null;
    const head = csv.split(/\r?\n/)[0] || '';
    const sep = (head.match(/;/g) || []).length >= (head.match(/,/g) || []).length ? ';' : ',';
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    let total = 0, young = 0, groups = 0;
    for (const line of lines) {
      const cols = line.split(sep).map((c) => c.replace(/"/g, '').trim());
      let val = null;
      for (let i = cols.length - 1; i >= 0; i--) {
        const n = Number(cols[i].replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(n) && cols[i] !== '') { val = n; break; }
      }
      if (val == null) continue;
      const label = cols.join(' ').toLowerCase();
      if (total === 0 && /insgesamt|zusammen|gesamt/.test(label)) { total = val; continue; }
      // Untergrenze der Altersgruppe bestimmen
      let lo = null;
      const mBis = label.match(/(\d{1,3})\s*(?:bis\s*(?:unter\s*)?|[-\u2013\u2014])\s*(\d{1,3})/); // "18 bis unter 20" / "20-25"
      const mMehr = label.match(/(\d{1,3})\s*(?:jahre\s*)?(?:und\s*(?:mehr|älter|aelter)|oder\s*mehr)/); // "65 und mehr"
      if (mBis) lo = parseInt(mBis[1], 10);
      else if (mMehr) lo = parseInt(mMehr[1], 10);
      else if (/unter\s*\d{1,3}/.test(label)) lo = 0;                            // "unter 18" = Kinder
      if (lo != null && lo >= 18 && lo < 30) { young += val; groups++; }
    }
    if (young > 0 && total > 0) return { share: (young / total) * 100, young, total, groups };
    return null;
  },

  // Roh-Diagnose: gibt den ffcsv-Text einer Tabelle zurueck (zum Justieren des Parsers).
  async raw({ ags, table } = {}) {
    if (!destatisEnabled()) return { ok: false, reason: 'kein_token' };
    const name = table || cfg.destatis.tablePopulation;
    const krs = ags ? String(ags).slice(0, 5) : null;
    try {
      const txt = await this._fetchTableFfcsv(name, krs, new Date().getFullYear());
      return { ok: true, base: _resolvedBase, table: name, ags: krs, raw: txt.slice(0, 4000) };
    } catch (e) { return { ok: false, base: _resolvedBase, reason: e.message, table: name }; }
  },

  // Discovery: GENESIS-Tabellensuche -> gueltige Tabellencodes zu einem Suchbegriff finden.
  // z.B. find({term:'Arbeitslosenquote'}) -> [{code:'13211-...', content:'...'}]
  async find({ term, category = 'tables' } = {}) {
    if (!destatisEnabled()) return { ok: false, reason: 'kein_token' };
    if (!term) return { ok: false, reason: 'kein_term' };
    const base = await resolveBase();
    try {
      const r = await httpText(`${base}/find/find`, {
        method: 'POST', headers: authHeaders(),
        form: { username: cfg.destatis.token, password: cfg.destatis.password || '',
                term, category, pagelength: '40', language: 'de' },
        timeoutMs: 20000, retries: 1,
      });
      let d = null; try { d = JSON.parse(r.text); } catch { d = null; }
      if (!d) return { ok: false, base, reason: 'kein_json', raw: (r.text || '').slice(0, 400) };
      const pick = (arr) => Array.isArray(arr) ? arr.map((o) => ({ code: o.Code, content: o.Content })) : [];
      return { ok: true, base, term, category,
               tables: pick(d.Tables), statistics: pick(d.Statistics), cubes: pick(d.Cubes) };
    } catch (e) { return { ok: false, base, reason: e.message }; }
  },

  async _fetchTableFfcsv(name, krs, now) {
    // KEIN regionalvariable/regionalkey: regionalstatistik liefert sonst Code 104
    // "keine Objekte zum Selektionskriterium", weil die Tabelle die Variable "KREISE"
    // so nicht kennt. Wir holen die (Kreis-)Tabelle komplett und filtern den Ziel-Kreis
    // clientseitig per AGS in _parseFfcsvSeries(txt, krs). Robust + deterministisch.
    const body = {
      username: cfg.destatis.token, password: cfg.destatis.password || '',
      name, area: 'all', compress: 'false', language: 'de', format: 'ffcsv',
      startyear: String(now - 12), endyear: String(now),
    };
    const base = await resolveBase(); // genesisws/genesisWS-robust
    const r = await httpText(`${base}/data/table`, { method: 'POST', headers: authHeaders(), form: body, timeoutMs: 30000, retries: 1 });
    return r.text || '';
  },

  // regionalstatistik liefert die Tabelle als JSON-Envelope: { Status:{Code}, Object:{Content:"<CSV>"} }.
  // Hier die eigentliche CSV (mit echten Newlines) herausziehen. Roh-CSV (ffcsv) wird unveraendert
  // zurueckgegeben. Bei Status-Code != 0 ohne Content -> leer.
  _extractCsv(txt) {
    if (!txt) return '';
    const t = String(txt).trim();
    if (t.startsWith('{')) {
      try {
        const o = JSON.parse(t); // JSON.parse wandelt \\n im Content in echte Newlines um
        return (o && o.Object && typeof o.Object.Content === 'string') ? o.Object.Content : '';
      } catch { return ''; }
    }
    return txt;
  },

  // datencsv-PIVOT parsen: Jahre stehen in der Kopfzeile (Datums-/Jahr-Zeile), Kreise sind Zeilen,
  // pro Jahr ggf. mehrere Spalten (z.B. Insgesamt/maennlich/weiblich) -> "Insgesamt" bevorzugen.
  // -> [{year, value}] aufsteigend, nur fuer den Ziel-Kreis (AGS).
  _parseDatencsvSeries(csv, krs) {
    if (!csv || !krs) return null;
    const rows = csv.split(/\r?\n/).map((l) => l.split(';').map((c) => c.replace(/"/g, '').trim()));
    if (rows.length < 3) return null;

    // Jahr-Kopfzeile = Zeile mit den meisten Jahres-/Datumstreffern
    let yearRowIdx = -1, best = 0;
    for (let i = 0; i < rows.length; i++) {
      const yc = rows[i].filter((c) => /\b(19|20)\d{2}\b/.test(c)).length;
      if (yc > best) { best = yc; yearRowIdx = i; }
    }
    if (yearRowIdx < 0 || best < 1) return null;
    const colYear = rows[yearRowIdx].map((c) => { const m = c.match(/\b(19|20)\d{2}\b/); return m ? parseInt(m[0], 10) : null; });

    // Kategorie-Zeile (Insgesamt/maennlich/...) direkt unter der Jahr-Zeile, falls vorhanden
    let catRowIdx = -1;
    for (let i = yearRowIdx; i < Math.min(rows.length, yearRowIdx + 4); i++) {
      if (rows[i].some((c) => /^insgesamt$/i.test(c))) { catRowIdx = i; break; }
    }
    const wanted = (idx) => (catRowIdx < 0 ? true : /^insgesamt$/i.test(rows[catRowIdx][idx] || ''));

    // Datenzeile des Ziel-Kreises: erste Spalte (nur Ziffern) == AGS
    const dataRow = rows.find((r) => (r[0] || '').replace(/[^0-9]/g, '') === String(krs));
    if (!dataRow) return null;

    const byYear = new Map();
    for (let idx = 0; idx < dataRow.length; idx++) {
      const y = colYear[idx];
      if (y == null || !wanted(idx)) continue;
      const raw = String(dataRow[idx] || '').trim();
      if (!/^-?\d/.test(raw)) continue;
      const v = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(v) && !byYear.has(y)) byYear.set(y, v); // erster (=Insgesamt) Wert je Jahr
    }
    const pts = [...byYear.entries()].map(([year, value]) => ({ year, value })).sort((a, b) => a.year - b.year);
    return pts.length ? pts : null;
  },

  // ffcsv (Semikolon) defensiv parsen -> [{year, value}] (aufsteigend), nur Zeilen der Region.
  _parseFfcsvSeries(text, krs) {
    if (!text || text.length < 10) return null;
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return null;
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const rows = lines.slice(1).map((l) => l.split(sep));
    const pts = [];
    for (const cols of rows) {
      if (krs && !cols.some((c) => c.replace(/"/g, '').trim() === krs)) continue; // nur Zielkreis
      let year = null;
      for (const c of cols) { const m = c.replace(/"/g, '').match(/\b(19|20)\d{2}\b/); if (m) { year = parseInt(m[0], 10); break; } }
      let value = null;
      for (let i = cols.length - 1; i >= 0; i--) {
        const raw = cols[i].replace(/"/g, '').trim();
        if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(raw) || /^-?\d+(\.\d+)?$/.test(raw)) {
          const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(n)) { value = n; break; }
        }
      }
      if (year != null && value != null) pts.push({ year, value });
    }
    pts.sort((a, b) => a.year - b.year);
    return pts.length ? pts : null;
  },
};
