'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V28 – marketRatesService.js

   Holt aktuelle deutsche Wohnungsbau-Zinsen mit drei Stufen:

   1. Bundesbank-Statistik-API (primär, deutsche MFI-Zinsstatistik)
        https://api.statistiken.bundesbank.de/rest/data/BBIM1/{key}?format=sdmx-csv

   2. ECB-Data-Portal-API (Fallback bei Bundesbank-Ausfall)
        https://data-api.ecb.europa.eu/service/data/MIR/{key}?format=csvdata
      Beide Quellen verwenden EXAKT die gleichen Series-Keys, da Bundesbank
      die nationalen MIR-Daten an die ECB liefert. Wenn die Bundesbank-API
      nicht erreichbar ist (Netzwerk, Firewall, oder Service down), liefert
      die ECB die identischen Werte.

   3. Statische Werte aus der ECB-Pressemitteilung Feb 2026
      (https://www.ecb.europa.eu/press/stats/mfi/) — letztes Sicherheitsnetz,
      damit das UI nie komplett leer bleibt.

   Series-Key-Schema:
     {Flow}.M.DE.B.A2C.{ZB}.R.A.2250.EUR.N
     ZB = Zinsbindungs-Code:
       F → variabel oder bis 1 Jahr
       I → über 1 Jahr bis 5 Jahre
       O → über 5 Jahre bis 10 Jahre
       P → über 10 Jahre

   In-Memory Cache: 6 Stunden (beide APIs aktualisieren monatlich).
═══════════════════════════════════════════════════ */

const BUNDESBANK_BASE = 'https://api.statistiken.bundesbank.de/rest/data/BBIM1';
const ECB_BASE        = 'https://data-api.ecb.europa.eu/service/data/MIR';

// Series-Key-Suffixe (identisch für Bundesbank + ECB)
const SERIES_SUFFIX = {
  'var':    'M.DE.B.A2C.F.R.A.2250.EUR.N',
  '1_5':    'M.DE.B.A2C.I.R.A.2250.EUR.N',
  '5_10':   'M.DE.B.A2C.O.R.A.2250.EUR.N',
  'over10': 'M.DE.B.A2C.P.R.A.2250.EUR.N'
};

const LABELS = {
  'var':    'variabel / bis 1 Jahr',
  '1_5':    '1 bis 5 Jahre',
  '5_10':   '5 bis 10 Jahre',
  'over10': 'über 10 Jahre'
};

// V28: Statische Fallback-Werte aus ECB-Pressemitteilung Februar 2026
// https://www.ecb.europa.eu/press/stats/mfi/html/ecb.mir2604~a265e5863d.en.html
const STATIC_FALLBACK = {
  'var':    3.48,
  '1_5':    3.37,
  '5_10':   3.55,
  'over10': 3.26
};
const STATIC_FALLBACK_AS_OF = '2026-02';

const SOURCE_BUNDESBANK = {
  name: 'Deutsche Bundesbank',
  url: 'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/wohnungsbaukredite-an-private-haushalte-hypothekarkredite-auf-wohngrundstuecke-615036',
  description: 'MFI-Zinsstatistik · Effektivzinssätze · Wohnungsbaukredite · Neugeschäft'
};
const SOURCE_ECB = {
  name: 'Europäische Zentralbank (ECB)',
  url: 'https://data.ecb.europa.eu/data/datasets/MIR',
  description: 'MFI Interest Rate Statistics (MIR) · DE · Lending for house purchase'
};
const SOURCE_STATIC = {
  name: 'Statischer Fallback (ECB-Pressemitteilung 02/2026)',
  url: 'https://www.ecb.europa.eu/press/stats/mfi/html/ecb.mir2604~a265e5863d.en.html',
  description: 'Hinterlegte Werte — APIs aktuell nicht erreichbar'
};

let _cache = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// CSV-Parser (Bundesbank: SDMX-CSV; ECB: csvdata — beide Format-kompatibel)
// V212: Separator-tolerant (Komma, Semikolon, Tab) + BOM-tolerant
// ─────────────────────────────────────────────────────────────
function _detectSeparator(headerLine) {
  // BBSIS liefert ; separation (SDMX-CSV 2.1 standard)
  // BBK01 / ECB liefern , separation
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas     = (headerLine.match(/,/g) || []).length;
  const tabs       = (headerLine.match(/\t/g) || []).length;
  // Wenn ; > , dann Semikolon. Wenn Tab dominiert, Tab. Sonst Komma.
  if (semicolons > commas && semicolons > tabs) return ';';
  if (tabs > commas) return '\t';
  return ',';
}

function _splitCsvLine(line, sep) {
  sep = sep || ',';
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === sep && !inQuote) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function parseLatestFromCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return null;
  // V212: UTF-8 BOM entfernen (Bundesbank liefert oft \ufeff am Anfang)
  let text = csvText.replace(/^\uFEFF/, '').trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return null;

  const sep = _detectSeparator(lines[0]);
  const header = _splitCsvLine(lines[0], sep);
  const idxTime  = header.indexOf('TIME_PERIOD');
  const idxValue = header.indexOf('OBS_VALUE');
  if (idxTime < 0 || idxValue < 0) return null;

  for (let i = lines.length - 1; i >= 1; i--) {
    const cells = _splitCsvLine(lines[i], sep);
    const period = cells[idxTime];
    const valStr = cells[idxValue];
    if (!period || !valStr) continue;
    const val = parseFloat(valStr.replace(',', '.'));
    if (isFinite(val) && val > 0 && val < 50) {
      return { period, value: val };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Fetch eine Series — versucht: Bundesbank, dann ECB
// Gibt zurück: { value, period, source: 'bundesbank' | 'ecb' | null }
// ─────────────────────────────────────────────────────────────
async function _fetchOneSeries(seriesSuffix) {
  // 1. Bundesbank
  try {
    const url = BUNDESBANK_BASE + '/' + seriesSuffix +
                '?format=sdmx-csv&detail=dataonly&lastNObservations=12';
    const res = await fetch(url, {
      headers: { 'Accept': 'text/csv', 'User-Agent': 'DealPilot/1.0' },
      // 8s Timeout — wir wollen nicht ewig warten, ECB als Fallback ist da
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const txt = await res.text();
      const parsed = parseLatestFromCsv(txt);
      if (parsed && parsed.value > 0) {
        return { value: parsed.value, period: parsed.period, source: 'bundesbank' };
      }
    } else {
      console.warn('[marketRates] Bundesbank ' + res.status + ' für ' + seriesSuffix);
    }
  } catch (e) {
    console.warn('[marketRates] Bundesbank fetch error für ' + seriesSuffix + ': ' + e.message);
  }

  // 2. ECB
  try {
    const url = ECB_BASE + '/' + seriesSuffix +
                '?format=csvdata&lastNObservations=12';
    const res = await fetch(url, {
      headers: { 'Accept': 'text/csv', 'User-Agent': 'DealPilot/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const txt = await res.text();
      const parsed = parseLatestFromCsv(txt);
      if (parsed && parsed.value > 0) {
        return { value: parsed.value, period: parsed.period, source: 'ecb' };
      }
    } else {
      console.warn('[marketRates] ECB ' + res.status + ' für ' + seriesSuffix);
    }
  } catch (e) {
    console.warn('[marketRates] ECB fetch error für ' + seriesSuffix + ': ' + e.message);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Aggregierte Abfrage über alle 4 Buckets
// ─────────────────────────────────────────────────────────────
async function refreshFromApis() {
  const result = {
    rates: {},
    labels: { ...LABELS },
    asOf: null,
    source: null,             // wird gesetzt: 'bundesbank' / 'ecb' / 'static' / 'mixed'
    sourceInfo: null,         // SOURCE_*
    fallback_used: []         // Liste der Buckets die statischen Fallback genutzt haben
  };

  const buckets = Object.keys(SERIES_SUFFIX);
  const settled = await Promise.all(buckets.map(async (b) => {
    const r = await _fetchOneSeries(SERIES_SUFFIX[b]);
    return { bucket: b, result: r };
  }));

  let latestPeriod = null;
  const sourcesUsed = new Set();
  for (const { bucket, result: r } of settled) {
    if (r && r.value != null) {
      result.rates[bucket] = parseFloat(r.value.toFixed(2));
      sourcesUsed.add(r.source);
      if (!latestPeriod || (r.period && r.period > latestPeriod)) {
        latestPeriod = r.period;
      }
    } else {
      result.rates[bucket] = STATIC_FALLBACK[bucket];
      result.fallback_used.push(bucket);
      sourcesUsed.add('static');
    }
  }

  // Quellen-Info zusammenstellen
  if (sourcesUsed.size === 1) {
    const only = Array.from(sourcesUsed)[0];
    if (only === 'bundesbank') result.sourceInfo = SOURCE_BUNDESBANK;
    else if (only === 'ecb')   result.sourceInfo = SOURCE_ECB;
    else                       result.sourceInfo = SOURCE_STATIC;
    result.source = only;
  } else {
    // Mix: Bundesbank + ECB, oder mit static
    const primary = sourcesUsed.has('bundesbank') ? SOURCE_BUNDESBANK :
                    sourcesUsed.has('ecb')        ? SOURCE_ECB        : SOURCE_STATIC;
    result.sourceInfo = {
      name: primary.name + ' (gemischt)',
      url: primary.url,
      description: 'Quellen kombiniert: ' + Array.from(sourcesUsed).join(', ')
    };
    result.source = 'mixed';
  }

  if (latestPeriod) {
    result.asOf = new Date(latestPeriod + '-01T00:00:00Z');
  } else {
    // Alle Live-Quellen down → static-Datum verwenden
    result.asOf = new Date(STATIC_FALLBACK_AS_OF + '-01T00:00:00Z');
  }
  result.fetchedAt = new Date();
  return result;
}

async function getCurrentRates() {
  if (_cache && (Date.now() - _cache.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return _cache;
  }
  try {
    _cache = await refreshFromApis();
  } catch (e) {
    console.error('[marketRates] full refresh failed:', e.message);
    _cache = {
      rates: { ...STATIC_FALLBACK },
      labels: { ...LABELS },
      asOf: new Date(STATIC_FALLBACK_AS_OF + '-01T00:00:00Z'),
      fetchedAt: new Date(),
      source: 'static',
      sourceInfo: SOURCE_STATIC,
      fallback_used: Object.keys(STATIC_FALLBACK)
    };
  }
  return _cache;
}

// ─────────────────────────────────────────────────────────────
// V209: Historische Reihe — alle 4 Buckets über N Monate
// Echte Bundesbank-Zeitreihe statt Mock-Random.
// Cache 24h (Bundesbank publiziert monatlich → reicht).
// ─────────────────────────────────────────────────────────────
const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let _historyCache = null;

async function _fetchSeriesHistory(seriesSuffix, months) {
  // Liefert Array von { period: 'YYYY-MM', value: 3.55 } chronologisch aufsteigend
  // Versucht Bundesbank → ECB → leer
  const lastN = Math.max(months, 1);
  const tryEndpoint = async (base, format) => {
    const url = base + '/' + seriesSuffix +
                '?format=' + format + '&detail=dataonly&lastNObservations=' + lastN;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'text/csv', 'User-Agent': 'DealPilot/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const txt = await res.text();
      return _parseAllFromCsv(txt);
    } catch (e) {
      console.warn('[marketRates V209] history fetch error ' + base + ': ' + e.message);
      return null;
    }
  };

  let data = await tryEndpoint(BUNDESBANK_BASE, 'sdmx-csv');
  if (!data || data.length === 0) {
    data = await tryEndpoint(ECB_BASE, 'csvdata');
  }
  return data || [];
}

// Parser: extrahiert ALLE Observations aus CSV (vs. nur die letzte)
function _parseAllFromCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = _splitCsvLine(lines[0]);
  const idxTime  = header.indexOf('TIME_PERIOD');
  const idxValue = header.indexOf('OBS_VALUE');
  if (idxTime < 0 || idxValue < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = _splitCsvLine(lines[i]);
    const period = cells[idxTime];
    const valStr = cells[idxValue];
    if (!period || !valStr) continue;
    const val = parseFloat(valStr.replace(',', '.'));
    if (isFinite(val) && val > 0 && val < 50) {
      out.push({ period, value: val });
    }
  }
  // Chronologisch aufsteigend sortieren (CSV kommt manchmal absteigend)
  out.sort((a, b) => a.period.localeCompare(b.period));
  return out;
}

async function getHistoricalRates({ months } = {}) {
  months = Math.min(Math.max(parseInt(months) || 12, 1), 60);

  if (_historyCache && _historyCache.months === months &&
      (Date.now() - _historyCache.fetchedAt.getTime()) < HISTORY_CACHE_TTL_MS) {
    return _historyCache;
  }

  const buckets = Object.keys(SERIES_SUFFIX);
  const result = {
    months: months,
    series: {},      // { bucketKey: [{period, value}, ...] }
    labels: { ...LABELS },
    source: null,
    fetchedAt: new Date(),
    fallback_used: []
  };

  // Parallel alle 4 Buckets holen
  const promises = buckets.map(b =>
    _fetchSeriesHistory(SERIES_SUFFIX[b], months).then(data => ({ bucket: b, data }))
  );
  const results = await Promise.all(promises);

  let anyLive = false;
  results.forEach(({ bucket, data }) => {
    if (data && data.length > 0) {
      result.series[bucket] = data;
      anyLive = true;
    } else {
      // Keine echten Daten → leer lassen, NICHT mocken.
      result.series[bucket] = [];
      result.fallback_used.push(bucket);
    }
  });

  result.source = anyLive ? 'bundesbank' : 'unavailable';
  result.sourceInfo = anyLive ? SOURCE_BUNDESBANK : null;

  _historyCache = result;
  return result;
}

function clearCache() {
  _cache = null;
  _historyCache = null;
  _pfandbriefCache = null;
  _marketContextCache = null;
}

// ═════════════════════════════════════════════════════════════
// V210: Pfandbrief-Renditen + Marge-Modell für 5/10/15/20J
// ─────────────────────────────────────────────────────────────
// Hintergrund: Banken refinanzieren Wohnungsbaukredite über Pfandbriefe.
// Pfandbrief-Rendite + Marge ≈ marktüblicher Bauzins.
//
// Bundesbank-API: BBSIS-Flow mit Key-Schema
//   D.I.ZAR.ZI.EUR.S1311.B.A604.R{NN}XX.R.A.A._Z._Z.A
// wobei {NN} die Restlaufzeit in Jahren ist (R05XX, R10XX, R15XX, R20XX).
//
// Marge-Modell: 3 Stufen (Premium/Standard/Schwach) → User wählt im UI.
// Fallback: STATIC_PFANDBRIEF wenn API nicht erreichbar/falsche Series.
// ═════════════════════════════════════════════════════════════

const BBSIS_BASE = 'https://api.statistiken.bundesbank.de/rest/data/BBSIS';

// V212: Series-Key-Schema bestätigt durch curl-Test 12.05.2026:
// "R{NN}XX" (mit "XX"-Suffix) liefert HTTP 200 + Daten.
// Andere Schreibweisen (R{NN}10, R{NN}00) liefern HTTP 404.
const PFANDBRIEF_SERIES_VARIANTS = {
  '5':  ['D.I.ZAR.ZI.EUR.S1311.B.A604.R05XX.R.A.A._Z._Z.A'],
  '10': ['D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A'],
  '15': ['D.I.ZAR.ZI.EUR.S1311.B.A604.R15XX.R.A.A._Z._Z.A'],
  '20': ['D.I.ZAR.ZI.EUR.S1311.B.A604.R20XX.R.A.A._Z._Z.A']
};

// Legacy-Map für die Rückwärts-Kompatibilität (export)
const PFANDBRIEF_SERIES = {
  '5':  PFANDBRIEF_SERIES_VARIANTS['5'][0],
  '10': PFANDBRIEF_SERIES_VARIANTS['10'][0],
  '15': PFANDBRIEF_SERIES_VARIANTS['15'][0],
  '20': PFANDBRIEF_SERIES_VARIANTS['20'][0]
};

// V210: Statischer Fallback für Pfandbrief-Renditen (Stand 05/2026)
// Quelle: Bundesbank Kapitalmarktstatistik Mai 2026 + FMH-Approximation
// Marcel pflegt diese monatlich falls API nicht greift.
const STATIC_PFANDBRIEF = {
  '5':  2.85,
  '10': 3.05,
  '15': 3.18,
  '20': 3.28
};
const STATIC_PFANDBRIEF_AS_OF = '2026-05';

// Marge-Modell — wird im Frontend wählbar gemacht
const MARGINS = {
  premium:  0.60,  // LTV ≤ 60%, Top-Bonität
  standard: 1.00,  // LTV 60-80%, normale Bonität
  schwach:  1.60   // LTV > 90% oder Bonität mittel
};

const SOURCE_PFANDBRIEF_LIVE = {
  name: 'Deutsche Bundesbank',
  url: 'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/taegliche-zinsstruktur-fuer-pfandbriefe-650734',
  description: 'Tägliche Zinsstruktur Pfandbriefe (BBSIS) + indikative Bank-Marge'
};
const SOURCE_PFANDBRIEF_STATIC = {
  name: 'Hinterlegte Pfandbrief-Renditen',
  url: 'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/taegliche-zinsstruktur-fuer-pfandbriefe-650734',
  description: 'Bundesbank Kapitalmarktstatistik (manuell gepflegt) + indikative Bank-Marge'
};

let _pfandbriefCache = null;
const PFANDBRIEF_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// V211: Versucht eine einzelne Series-Variante zu holen.
// HTTP 200 → Daten zurück. 404/406 → null.
async function _fetchSinglePfandbriefVariant(seriesSuffix) {
  // KORREKTE Format-Spec: sdmx_csv (Unterstrich!) + vendor MIME-Type im Accept-Header.
  // Bundesbank-Doku: https://www.bundesbank.de/.../web-service-interface-data
  const url = BBSIS_BASE + '/' + seriesSuffix +
              '?format=sdmx_csv&detail=dataonly&lastNObservations=1';
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.sdmx.data+csv;version=1.0.0, text/csv',
      'User-Agent': 'DealPilot/1.0'
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  const txt = await res.text();
  const parsed = parseLatestFromCsv(txt);
  if (parsed && parsed.value > 0 && parsed.value < 15) {
    return { ok: true, value: parsed.value, period: parsed.period, key: seriesSuffix };
  }
  return { ok: false, status: 'parse-empty' };
}

// V211: Probiert alle Varianten für eine Laufzeit, gibt die erste passende zurück.
async function _fetchPfandbriefSeries(maturity) {
  const variants = PFANDBRIEF_SERIES_VARIANTS[maturity];
  if (!variants || !variants.length) return null;

  for (let i = 0; i < variants.length; i++) {
    try {
      const result = await _fetchSinglePfandbriefVariant(variants[i]);
      if (result.ok) {
        return { value: result.value, period: result.period, keyUsed: result.key };
      } else {
        console.warn('[V212 pfandbrief] ' + maturity + 'J Variant ' + (i+1) + ' ' + result.status + ' für ' + variants[i]);
      }
    } catch (e) {
      console.warn('[V212 pfandbrief] ' + maturity + 'J Variant ' + (i+1) + ' fetch error: ' + e.message);
    }
  }
  console.warn('[V212 pfandbrief] ' + maturity + 'J — alle Varianten fehlgeschlagen, fallback auf static');
  return null;
}

/**
 * V210: Liefert Pfandbrief-Renditen für gewünschte Laufzeiten,
 * dazu drei Marge-Stufen + indikativer Bauzins pro Stufe.
 *
 * @param {Object} opts
 * @param {string[]} [opts.maturities=['5','10','15','20']]
 * @returns {Object} mit yields, indicativeRates, source, asOf, ...
 */
async function getPfandbriefRates(opts) {
  opts = opts || {};
  const maturities = Array.isArray(opts.maturities) && opts.maturities.length
    ? opts.maturities.map(String)
    : ['5', '10', '15', '20'];

  // Cache-Hit
  const cacheKey = maturities.sort().join(',');
  if (_pfandbriefCache && _pfandbriefCache.cacheKey === cacheKey &&
      (Date.now() - _pfandbriefCache.fetchedAt.getTime()) < PFANDBRIEF_CACHE_TTL_MS) {
    return _pfandbriefCache;
  }

  // Parallel alle Series versuchen
  const promises = maturities.map(m => {
    if (!PFANDBRIEF_SERIES_VARIANTS[m]) return Promise.resolve({ m, data: null });
    return _fetchPfandbriefSeries(m).then(data => ({ m, data }));
  });
  const results = await Promise.all(promises);

  // Yields zusammenstellen, mit Fallback auf Static wo nötig
  const yields = {};      // Reine Pfandbrief-Rendite pro Laufzeit
  const sources = {};     // 'live' | 'static' pro Laufzeit
  const periods = {};     // YYYY-MM pro Laufzeit
  let anyLive = false, anyStatic = false;

  results.forEach(({ m, data }) => {
    if (data && typeof data.value === 'number') {
      yields[m] = Math.round(data.value * 100) / 100;
      sources[m] = 'live';
      periods[m] = data.period || null;
      anyLive = true;
    } else if (STATIC_PFANDBRIEF[m] != null) {
      yields[m] = STATIC_PFANDBRIEF[m];
      sources[m] = 'static';
      periods[m] = STATIC_PFANDBRIEF_AS_OF;
      anyStatic = true;
    } else {
      yields[m] = null;
      sources[m] = 'unavailable';
      periods[m] = null;
    }
  });

  // Indikative Bauzinsen = Yield + Marge pro Stufe
  const indicativeRates = {};
  maturities.forEach(m => {
    if (yields[m] == null) {
      indicativeRates[m] = null;
      return;
    }
    indicativeRates[m] = {
      premium:  Math.round((yields[m] + MARGINS.premium)  * 100) / 100,
      standard: Math.round((yields[m] + MARGINS.standard) * 100) / 100,
      schwach:  Math.round((yields[m] + MARGINS.schwach)  * 100) / 100
    };
  });

  // Source-Aggregation
  let overallSource;
  if (anyLive && !anyStatic)       overallSource = 'live';
  else if (!anyLive && anyStatic)  overallSource = 'static';
  else if (anyLive && anyStatic)   overallSource = 'mixed';
  else                              overallSource = 'unavailable';

  const result = {
    maturities: maturities,
    yields: yields,
    margins: { ...MARGINS },
    indicativeRates: indicativeRates,
    sources: sources,           // pro Laufzeit
    periods: periods,           // pro Laufzeit
    source: overallSource,      // gesamt
    sourceInfo: overallSource === 'live' ? SOURCE_PFANDBRIEF_LIVE : SOURCE_PFANDBRIEF_STATIC,
    asOf: anyLive ? new Date() : new Date(STATIC_PFANDBRIEF_AS_OF + '-01T00:00:00Z'),
    fetchedAt: new Date(),
    cacheKey: cacheKey
  };

  _pfandbriefCache = result;
  return result;
}

// ═════════════════════════════════════════════════════════════
// V211: Markt-Kontext — EZB-Leitzins + EURIBOR 3M
// ─────────────────────────────────────────────────────────────
// EZB Data Portal API (public, kostenfrei, gut dokumentiert):
//   https://data-api.ecb.europa.eu/service/data/{flow}/{key}
//
// Leitzins (Hauptrefinanzierungssatz, fix):
//   FM/D.U2.EUR.4F.KR.MRR_FR.LEV
//
// EURIBOR 3M (Geldmarkt-Referenzzins):
//   FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA   (monatlich, stabiler als daily)
// ═════════════════════════════════════════════════════════════

const ECB_FM_BASE = 'https://data-api.ecb.europa.eu/service/data/FM';

// Statische Fallback-Werte (Stand 05/2026) — wenn ECB-API nicht erreichbar
const STATIC_MARKET_CONTEXT = {
  ecb_mrr: 2.15,       // ECB Hauptrefinanzierungssatz (laut Statista Q1 2026)
  euribor_3m: 2.32,    // 3M-EURIBOR ca. Niveau Mai 2026
  asOf: '2026-05'
};

let _marketContextCache = null;
const MARKET_CONTEXT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function _fetchEcbSeries(seriesKey) {
  try {
    // Auch hier: korrekte Format-Spec für ECB (akzeptiert verschiedene Werte)
    const url = ECB_FM_BASE + '/' + seriesKey + '?lastNObservations=2&format=csvdata';
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+csv;version=1.0.0, text/csv',
        'User-Agent': 'DealPilot/1.0'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      console.warn('[V211 ecb-fm] HTTP ' + res.status + ' für ' + seriesKey);
      return null;
    }
    const txt = await res.text();
    // V212: BOM entfernen + Separator detektieren
    const cleanTxt = txt.replace(/^\uFEFF/, '');
    const lines = cleanTxt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;
    const sep = _detectSeparator(lines[0]);
    const headers = _splitCsvLine(lines[0], sep).map(h => h.replace(/^"|"$/g, ''));
    const periodIdx = headers.findIndex(h => /^TIME_PERIOD$/i.test(h));
    const valueIdx  = headers.findIndex(h => /^OBS_VALUE$/i.test(h));
    if (periodIdx < 0 || valueIdx < 0) return null;

    const obs = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = _splitCsvLine(lines[i], sep).map(c => c.replace(/^"|"$/g, ''));
      const period = cols[periodIdx];
      const value = parseFloat((cols[valueIdx] || '').replace(',', '.'));
      if (period && !isNaN(value)) obs.push({ period, value });
    }
    if (!obs.length) return null;
    obs.sort((a, b) => a.period.localeCompare(b.period));
    const latest = obs[obs.length - 1];
    const previous = obs.length > 1 ? obs[obs.length - 2] : null;
    return {
      value: Math.round(latest.value * 100) / 100,
      period: latest.period,
      previousValue: previous ? Math.round(previous.value * 100) / 100 : null,
      trend: previous
        ? (latest.value > previous.value ? 'up'
          : latest.value < previous.value ? 'down' : 'flat')
        : 'flat'
    };
  } catch (e) {
    console.warn('[V211 ecb-fm] fetch error ' + seriesKey + ': ' + e.message);
    return null;
  }
}

/**
 * V211: EZB-Leitzins + EURIBOR 3M für die "Markt-Kontext"-Card.
 * Static-Fallback wenn ECB nicht erreichbar.
 */
async function getMarketContext() {
  if (_marketContextCache &&
      (Date.now() - _marketContextCache.fetchedAt.getTime()) < MARKET_CONTEXT_CACHE_TTL_MS) {
    return _marketContextCache;
  }

  const [ecbMrr, euribor3m] = await Promise.all([
    _fetchEcbSeries('D.U2.EUR.4F.KR.MRR_FR.LEV'),       // Hauptrefinanzierungssatz, daily
    _fetchEcbSeries('M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA')  // EURIBOR 3M, monatlich
  ]);

  const result = {
    ecb_mrr: ecbMrr || {
      value: STATIC_MARKET_CONTEXT.ecb_mrr,
      period: STATIC_MARKET_CONTEXT.asOf,
      previousValue: null,
      trend: 'flat',
      source: 'static'
    },
    euribor_3m: euribor3m || {
      value: STATIC_MARKET_CONTEXT.euribor_3m,
      period: STATIC_MARKET_CONTEXT.asOf,
      previousValue: null,
      trend: 'flat',
      source: 'static'
    },
    source: (ecbMrr && euribor3m) ? 'live' : (!ecbMrr && !euribor3m) ? 'static' : 'mixed',
    sourceInfo: {
      name: 'Europäische Zentralbank (Data Portal)',
      url: 'https://data.ecb.europa.eu/'
    },
    fetchedAt: new Date()
  };
  if (ecbMrr)     result.ecb_mrr.source     = 'live';
  if (euribor3m)  result.euribor_3m.source  = 'live';

  _marketContextCache = result;
  return result;
}

module.exports = {
  getCurrentRates,
  getHistoricalRates,
  getPfandbriefRates,         // V210
  getMarketContext,           // V211
  clearCache,
  parseLatestFromCsv,
  STATIC_FALLBACK,
  STATIC_PFANDBRIEF,          // V210
  MARGINS,                    // V210
  LABELS,
  SOURCE_BUNDESBANK,
  SOURCE_ECB,
  SOURCE_STATIC,
  SOURCE_PFANDBRIEF_LIVE,     // V210
  SOURCE_PFANDBRIEF_STATIC,   // V210
  SERIES_SUFFIX,
  PFANDBRIEF_SERIES,          // V210
  PFANDBRIEF_SERIES_VARIANTS  // V211
};
