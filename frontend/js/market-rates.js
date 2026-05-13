'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V30 – market-rates.js

   STATIC-FIRST-Ansatz:
   1. Werte kommen aus DealPilotConfig.marketRates (in config.js)
      → das ist die Single Source of Truth, von Marcel manuell pflegbar
   2. Optional: Backend-API wird im Hintergrund versucht und überschreibt
      die statischen Werte NUR wenn sie gültig zurückkommt (Bonus, kein Muss)

   Vorteil: Tiles sind IMMER befüllt, egal ob Backend antwortet oder nicht.
   Marcel muss die Werte ca. monatlich in config.js updaten — die Edit-Anleitung
   steht direkt im File.
═══════════════════════════════════════════════════ */

var MarketRates = (function() {

  /**
   * Liest die statischen Werte aus DealPilotConfig.marketRates.
   * Das ist der Default — wenn das Backend nichts liefert, bleibt's dabei.
   */
  function _getStaticRates() {
    var cfg = (typeof DealPilotConfig !== 'undefined' && DealPilotConfig.marketRates) || null;
    if (!cfg) {
      // Notfall-Fallback wenn config.js nicht geladen wurde
      return {
        asOf: new Date('2026-02-01'),
        rates: { 'var': 3.48, '1_5': 3.37, '5_10': 3.55, 'over10': 3.26 },
        sourceInfo: {
          name: 'Notfall-Fallback (Frontend)',
          url:  'https://www.ecb.europa.eu/press/stats/mfi/'
        },
        sourceKey: 'static',
        sourceLabel: 'Hinterlegte Werte (config.js fehlt)',
        compareLinks: []
      };
    }

    return {
      asOf: new Date(cfg.asOf + '-01T00:00:00Z'),
      rates: Object.assign({}, cfg.values),
      sourceInfo: {
        name: cfg.sourceLabel || 'ECB / Bundesbank',
        url:  cfg.sourceUrl   || ''
      },
      sourceKey: 'static',
      sourceLabel: cfg.sourceLabel,
      compareLinks: Array.isArray(cfg.compareLinks) ? cfg.compareLinks.slice() : []
    };
  }

  /**
   * Optionaler Backend-Try. Wird einmalig im Hintergrund aufgerufen,
   * überschreibt _staticCache wenn erfolgreich.
   * Auf Fehler: stillschweigend ignorieren — wir haben ja Static.
   */
  async function _tryBackendUpdate() {
    if (typeof Auth === 'undefined' || !Auth.isApiMode || !Auth.isApiMode()) return null;
    try {
      var apiBase = Auth.getApiBase ? Auth.getApiBase() : '/api/v1';
      var ctrl = new AbortController();
      var timeout = setTimeout(function() { ctrl.abort(); }, 6000);
      var res = await fetch(apiBase + '/market-rates/current', { signal: ctrl.signal });
      clearTimeout(timeout);
      if (!res.ok) return null;
      var data = await res.json();
      if (!data || !data.rates) return null;
      var hasAllValid = ['var','1_5','5_10','over10'].every(function(k) {
        var v = data.rates[k];
        return typeof v === 'number' && v > 0 && v < 50;
      });
      if (!hasAllValid) return null;
      return {
        asOf: data.asOf ? new Date(data.asOf) : new Date(),
        rates: data.rates,
        sourceInfo: data.sourceInfo || { name: 'Backend' },
        sourceKey: typeof data.source === 'string' ? data.source : 'backend',
        sourceLabel: (data.sourceInfo && data.sourceInfo.name) || 'Backend-Live',
        compareLinks: ((typeof DealPilotConfig !== 'undefined' && DealPilotConfig.marketRates && DealPilotConfig.marketRates.compareLinks) || [])
      };
    } catch (e) {
      // Timeout / Network / CORS — egal, wir haben Static
      return null;
    }
  }

  var _cache = null;

  /**
   * Liefert Marktzinsen — IMMER direkt erfolgreich, weil Static garantiert ist.
   * Backend-Update läuft separat im Hintergrund (siehe _refreshFromBackend).
   */
  async function getCurrentRates() {
    if (_cache) return _cache;
    _cache = _getStaticRates();
    return _cache;
  }

  /**
   * Optional: Backend-Werte holen und _cache überschreiben falls erfolgreich.
   * Wird von refreshMarketRates() im Hintergrund aufgerufen.
   */
  async function _refreshFromBackend() {
    var fresh = await _tryBackendUpdate();
    if (fresh) _cache = fresh;
    return _cache;
  }

  /**
   * Mock-Trend (8 Wochen) — für die Trend-Kurve unten.
   */
  // V209: _generateMockTrend wurde entfernt — nutzt jetzt echte Backend-Historie.
  // Falls jemand das noch ruft, wirft die Funktion einen Hinweis statt zufällige Werte.

  // V209: Echte Bundesbank-Historie aus Backend statt Mock.
  // Liefert für ALLE 4 Buckets gleichzeitig die letzten N Monate.
  // Falls Backend nicht erreichbar: leeres Objekt (Frontend zeigt aktuelle Tiles trotzdem).
  async function getHistoricalRates(opts) {
    opts = opts || {};
    var months = opts.months || 12;

    var apiBase = (typeof Auth !== 'undefined' && Auth.getApiBase) ? Auth.getApiBase() : '/api/v1';
    if (!apiBase) return { months: months, series: {}, source: 'unavailable', labels: {} };

    try {
      var url = apiBase + '/market-rates/history?months=' + months;
      var headers = { 'Accept': 'application/json' };
      // Auth nicht zwingend (Endpoint ist public), aber wenn vorhanden mitsenden
      var tok = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null;
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      var res = await fetch(url, { headers: headers });
      if (!res.ok) {
        console.warn('[V209 history] HTTP ' + res.status);
        return { months: months, series: {}, source: 'unavailable', labels: {} };
      }
      var data = await res.json();
      // Period-Strings ('YYYY-MM') in Dates für Chart umwandeln
      Object.keys(data.series || {}).forEach(function(b) {
        data.series[b] = data.series[b].map(function(p) {
          return {
            period: p.period,
            value: p.value,
            date: new Date(p.period + '-01T00:00:00Z')
          };
        });
      });
      return data;
    } catch (e) {
      console.warn('[V209 history] fetch error:', e.message);
      return { months: months, series: {}, source: 'unavailable', labels: {} };
    }
  }

  // V209: Legacy-Signatur beibehalten (bucket, weeks) — gibt jetzt aber leer zurück
  // damit alter Code nicht crasht. Echter Render läuft via getHistoricalRates oben.
  async function getHistoricalRatesLegacy(bucket, weeks) {
    bucket = bucket || '5_10';
    weeks = weeks || 8;
    // Falls jemand das noch ruft: liefere leere Daten, damit kein Mock-Wackel mehr.
    return Promise.resolve({ bucket: bucket, data: [] });
  }

  return {
    getCurrentRates: getCurrentRates,
    getHistoricalRates: getHistoricalRates,
    refreshFromBackend: _refreshFromBackend
  };
})();

/**
 * Rendert die 4 Tiles + Status-Zeile. Wird beim DOM-Load aufgerufen
 * UND optional vom User über den Refresh-Button.
 */
async function refreshMarketRates() {
  // V30: Static ist sofort da — kein Loading-Spinner-Wackel mehr
  try {
    var current = await MarketRates.getCurrentRates();
    _renderRatesUI(current);

    // V63.82: Live-Backend-Refresh nur wenn Plan es erlaubt (Investor+)
    var canLive = (typeof Plan !== 'undefined') ? Plan.can('live_market_rates') : true;
    if (canLive) {
      // Im Hintergrund: Backend-Versuch. Wenn erfolgreich, neu rendern.
      MarketRates.refreshFromBackend().then(function(updated) {
        if (updated && updated.sourceKey !== 'static') {
          _renderRatesUI(updated);
        }
      }).catch(function() { /* still — Static reicht */ });
    }

  } catch (e) {
    console.error('refreshMarketRates fehlgeschlagen:', e);
  }
}

// ═════════════════════════════════════════════════════════════
// V209: Render-Routine — Multi-Line + Bar + Empfehlungs-Card
// ═════════════════════════════════════════════════════════════

// Bucket-Konfiguration für UI (Reihenfolge + Farben)
var BUCKETS_V209 = [
  { key: 'var',    label: 'variabel/1J',   labelFull: 'variabel / bis 1 Jahr', color: '#7C8EA3' },
  { key: '1_5',    label: '1–5 J',          labelFull: '1 bis 5 Jahre',         color: '#5BA89F' },
  { key: '5_10',   label: '5–10 J',         labelFull: '5 bis 10 Jahre',        color: '#C9A84C' },
  { key: 'over10', label: 'über 10 J',      labelFull: 'über 10 Jahre',         color: '#B8625C' }
];

// Sichtbarkeits-State pro Linie (initial alle an)
var _rateLineVisible = { 'var': true, '1_5': true, '5_10': true, 'over10': true };

function _renderRatesUI(current) {
  // ── 1. Tiles (aktuelle Werte) ────────────────────────────────────
  BUCKETS_V209.forEach(function(b) {
    var elt = document.getElementById('rate-' + b.key);
    if (!elt) return;
    var v = current.rates[b.key];
    if (typeof v === 'number') {
      elt.textContent = v.toFixed(2).replace('.', ',') + ' %';
    } else {
      elt.textContent = '–';
    }
  });

  // Source-Badge im Header
  var sourceBadge = document.getElementById('mr-source-badge');
  if (sourceBadge) {
    var srcKey = current.sourceKey || 'static';
    if (srcKey === 'bundesbank') sourceBadge.textContent = 'Live · Bundesbank';
    else if (srcKey === 'ecb')   sourceBadge.textContent = 'Live · ECB';
    else if (srcKey === 'mixed') sourceBadge.textContent = 'Live · Bundesbank+ECB';
    else                          sourceBadge.textContent = 'Hinterlegt';
  }

  // ── 2. Quellenangabe + Disclaimer-Box ────────────────────────────
  _renderSourceLine(current);

  // ── 3. History abrufen + alle Charts/Empfehlung rendern ──────────
  MarketRates.getHistoricalRates({ months: 12 }).then(function(hist) {
    // Tiles: Δ zum Vormonat (aus Historie)
    _renderTileDeltas(current, hist);
    // Multi-Line-Chart
    _renderMultiLineChart(current, hist);
    // Bar-Chart aktueller Vergleich
    _renderCurrentBarChart(current);
    // Empfehlung
    _renderRecommendation(current, hist);

    // V213: Sublabel
    if (window.CollapsibleCards && window.CollapsibleCards.setSublabel) {
      var v510 = current.rates && current.rates['5_10'];
      var vOv10 = current.rates && current.rates['over10'];
      var bits = [];
      if (v510 != null)  bits.push('5–10J ' + v510.toFixed(2).replace('.', ',') + '%');
      if (vOv10 != null) bits.push('>10J ' + vOv10.toFixed(2).replace('.', ',') + '%');
      window.CollapsibleCards.setSublabel('mr-v209', '12 Mt. Chart · ' + bits.join(' · '));
    }
  });
}

// Δ-Anzeige unter jeder Tile (Δ Vormonat in Basispunkten)
function _renderTileDeltas(current, hist) {
  BUCKETS_V209.forEach(function(b) {
    var deltaEl = document.getElementById('rate-' + b.key + '-delta');
    if (!deltaEl) return;
    var series = (hist && hist.series && hist.series[b.key]) || [];
    var cur = current.rates[b.key];
    var prev = series.length >= 2 ? series[series.length - 2].value : null;
    if (typeof cur !== 'number' || prev == null) {
      deltaEl.textContent = '';
      deltaEl.className = 'rate-delta';
      return;
    }
    var diff = cur - prev;
    var bp = Math.round(diff * 100); // Basispunkte
    if (Math.abs(bp) < 1) {
      deltaEl.textContent = '±0 BP zum Vormonat';
      deltaEl.className = 'rate-delta flat';
    } else if (diff > 0) {
      deltaEl.textContent = '+' + bp + ' BP zum Vormonat';
      deltaEl.className = 'rate-delta up';
    } else {
      deltaEl.textContent = bp + ' BP zum Vormonat';
      deltaEl.className = 'rate-delta down';
    }
  });
}

function _renderSourceLine(current) {
  var srcEl = document.getElementById('rates-source');
  if (!srcEl) return;
  var asOf = current.asOf instanceof Date ? current.asOf : new Date(current.asOf);
  var asOfStr = asOf.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
  var srcInfo = current.sourceInfo || {};
  var srcName = srcInfo.name || 'Bundesbank';
  var srcUrl  = srcInfo.url || '';
  var srcKey  = current.sourceKey || 'static';

  var statusBadge;
  if (srcKey === 'bundesbank')   statusBadge = '<span class="rates-src-badge rates-src-live" title="Live von der Bundesbank-API">● Live · Bundesbank</span>';
  else if (srcKey === 'ecb')     statusBadge = '<span class="rates-src-badge rates-src-live" title="Live von der ECB">● Live · ECB</span>';
  else if (srcKey === 'mixed')   statusBadge = '<span class="rates-src-badge rates-src-mixed">◐ Gemischt</span>';
  else                            statusBadge = '<span class="rates-src-badge rates-src-static" title="Hinterlegte Werte (in config.js manuell pflegbar)">📌 Hinterlegt</span>';

  var compareLinks = current.compareLinks || [];
  var compareHtml = '';
  if (compareLinks.length) {
    compareHtml = '<div class="rates-compare-line">' +
      'Konkrete Konditionen für deine Finanzierung berechnen: ' +
      compareLinks.map(function(c) {
        return '<a href="' + c.url + '" target="_blank" rel="noopener">' + c.label + ' ↗</a>';
      }).join(' · ') +
    '</div>';
  }

  srcEl.innerHTML =
    '<div class="rates-source-line">' +
      statusBadge +
      '<span class="rates-source-text">Quelle: ' +
        (srcUrl ? '<a href="' + srcUrl + '" target="_blank" rel="noopener">' + srcName + '</a>' : srcName) +
        ' · Stand ' + asOfStr +
        ' <span class="v215-hint" title="Die Bundesbank veröffentlicht die MFI-Zinsstatistik immer ca. 5 Wochen verzögert. Aktuelle April-Daten erscheinen Anfang Juni 2026.">(neueste verfügbare Bundesbank-Werte)</span>' +
      '</span>' +
    '</div>' +
    compareHtml;
}

function _renderMultiLineChart(current, hist) {
  var canvas = document.getElementById('ratesChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (window._ratesChartInstance) {
    try { window._ratesChartInstance.destroy(); } catch(e){}
  }

  // Sammle alle Period-Strings (Vereinigung über alle Buckets)
  var allPeriods = new Set();
  BUCKETS_V209.forEach(function(b) {
    var s = (hist && hist.series && hist.series[b.key]) || [];
    s.forEach(function(p) { allPeriods.add(p.period); });
  });
  var sortedPeriods = Array.from(allPeriods).sort();

  // Falls keine echten Daten verfügbar: nur den aktuellen Wert als Punkt
  // (kein Mock-Trend mehr!)
  if (sortedPeriods.length === 0) {
    var hint = document.getElementById('mr-chart-hint');
    if (hint) hint.textContent = 'Historische Daten momentan nicht verfügbar';
    // Trotzdem leeren Chart-Rahmen rendern
    sortedPeriods = [(current.asOf instanceof Date ? current.asOf : new Date()).toISOString().slice(0, 7)];
  }

  // Labels formatieren: "Mai 25", "Jun 25", ...
  var labels = sortedPeriods.map(function(p) {
    var d = new Date(p + '-01T00:00:00Z');
    return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  });

  // Datasets pro Bucket
  var datasets = BUCKETS_V209.map(function(b) {
    var series = (hist && hist.series && hist.series[b.key]) || [];
    var byPeriod = {};
    series.forEach(function(p) { byPeriod[p.period] = p.value; });
    // Wenn keine Historie: nur aktueller Punkt am Ende
    var values = sortedPeriods.map(function(p, i) {
      if (byPeriod[p] != null) return byPeriod[p];
      if (i === sortedPeriods.length - 1) return current.rates[b.key]; // aktueller Wert
      return null;
    });
    return {
      label: b.labelFull,
      data: values,
      borderColor: b.color,
      backgroundColor: b.color + '15',
      borderWidth: 2,
      tension: 0.32,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: b.color,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      fill: false,
      spanGaps: true,
      hidden: !_rateLineVisible[b.key]
    };
  });

  window._ratesChartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(42,39,39,0.96)',
          titleColor: 'rgba(255,255,255,0.85)',
          bodyColor: '#fff',
          borderColor: 'rgba(201,168,76,0.45)',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 11.5, weight: '600' },
          bodyFont: { size: 12.5, weight: '600' },
          bodySpacing: 4,
          boxPadding: 4,
          displayColors: true,
          usePointStyle: true,
          cornerRadius: 6,
          callbacks: {
            title: function(items) { return items.length ? items[0].label : ''; },
            label: function(ctx) {
              if (ctx.parsed.y == null) return ctx.dataset.label + ' · –';
              return ctx.dataset.label + ' · ' + ctx.parsed.y.toFixed(2).replace('.', ',') + ' %';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: 'rgba(42,39,39,0.55)', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: 'rgba(42,39,39,0.06)', drawBorder: false },
          ticks: {
            font: { size: 10 },
            color: 'rgba(42,39,39,0.55)',
            maxTicksLimit: 5,
            callback: function(v) { return v.toFixed(2).replace('.', ',') + '%'; }
          }
        }
      }
    }
  });
}

// Toggle einer Linie (vom Button aufgerufen)
function toggleRateLine(bucketKey) {
  _rateLineVisible[bucketKey] = !_rateLineVisible[bucketKey];
  // Toggle-Button visuell
  var btn = document.querySelector('.mr-toggle[data-bucket="' + bucketKey + '"]');
  if (btn) btn.classList.toggle('active', _rateLineVisible[bucketKey]);
  // Chart anpassen
  if (window._ratesChartInstance) {
    var idx = BUCKETS_V209.findIndex(function(b) { return b.key === bucketKey; });
    if (idx >= 0) {
      window._ratesChartInstance.setDatasetVisibility(idx, _rateLineVisible[bucketKey]);
      window._ratesChartInstance.update();
    }
  }
}
window.toggleRateLine = toggleRateLine;

function _renderCurrentBarChart(current) {
  var canvas = document.getElementById('ratesBarChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (window._ratesBarInstance) {
    try { window._ratesBarInstance.destroy(); } catch(e){}
  }

  var labels = BUCKETS_V209.map(function(b) { return b.labelFull; });
  var values = BUCKETS_V209.map(function(b) {
    var v = current.rates[b.key];
    return typeof v === 'number' ? v : null;
  });
  var colors = BUCKETS_V209.map(function(b) { return b.color; });

  window._ratesBarInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(function(c) { return c + 'CC'; }),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 4,
        barThickness: 'flex',
        maxBarThickness: 80
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(42,39,39,0.96)',
          padding: 10,
          titleFont: { size: 11, weight: '600' },
          bodyFont: { size: 13, weight: '700' },
          displayColors: false,
          cornerRadius: 6,
          callbacks: {
            label: function(ctx) {
              if (ctx.parsed.y == null) return '–';
              return ctx.parsed.y.toFixed(2).replace('.', ',') + ' %';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10.5 }, color: 'rgba(42,39,39,0.6)' }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(42,39,39,0.06)', drawBorder: false },
          ticks: {
            font: { size: 10 },
            color: 'rgba(42,39,39,0.55)',
            maxTicksLimit: 5,
            callback: function(v) { return v.toFixed(2).replace('.', ',') + '%'; }
          }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// V209: Empfehlungs-Logik
// Heuristisch — kombiniert (a) Marktzins-Niveau, (b) Trend (steigend/fallend/stabil),
// (c) Spread zwischen kurz/lang, (d) optional User-LTV.
// Liefert KEINE Beratung sondern Orientierungshilfe.
// ─────────────────────────────────────────────────────────────
function _renderRecommendation(current, hist) {
  var body = document.getElementById('mr-rec-body');
  if (!body) return;

  var rates = current.rates || {};
  var r_var = rates['var'], r_1_5 = rates['1_5'], r_5_10 = rates['5_10'], r_over10 = rates['over10'];

  // Wenn keine Daten: Empty-State bleibt
  if (typeof r_5_10 !== 'number') {
    return;
  }

  // ── Marktniveau-Einordnung ──────────────────────────────────────
  // Skala basierend auf historischer Bandbreite (2003-2026: 1,2% bis 6%, Median ~3,5%)
  var niveau, niveauTag;
  if (r_5_10 < 2.5)      { niveau = 'sehr niedrig'; niveauTag = 'günstig'; }
  else if (r_5_10 < 3.3) { niveau = 'niedrig';      niveauTag = 'attraktiv'; }
  else if (r_5_10 < 4.0) { niveau = 'mittel';       niveauTag = 'normal'; }
  else if (r_5_10 < 5.0) { niveau = 'hoch';         niveauTag = 'angespannt'; }
  else                    { niveau = 'sehr hoch';    niveauTag = 'kritisch'; }

  // ── Trend aus Historie der 5-10J-Linie ──────────────────────────
  var trend = 'stabil', trendText = 'seitwärts';
  var s_5_10 = (hist && hist.series && hist.series['5_10']) || [];
  if (s_5_10.length >= 3) {
    var n = s_5_10.length;
    var avg3recent = (s_5_10[n-1].value + s_5_10[n-2].value + s_5_10[n-3].value) / 3;
    var avg3old    = (s_5_10[0].value + s_5_10[1].value + (s_5_10[2] ? s_5_10[2].value : s_5_10[1].value)) / 3;
    var d = avg3recent - avg3old;
    if (d > 0.15)       { trend = 'steigend'; trendText = 'leicht steigend'; }
    else if (d > 0.40)  { trend = 'stark_steigend'; trendText = 'deutlich steigend'; }
    else if (d < -0.15) { trend = 'fallend';   trendText = 'leicht fallend'; }
    else if (d < -0.40) { trend = 'stark_fallend'; trendText = 'deutlich fallend'; }
  }

  // ── Spread kurz vs lang (über 10J - 5-10J) ─────────────────────
  var spread = (typeof r_over10 === 'number' && typeof r_5_10 === 'number')
    ? (r_over10 - r_5_10) : null;

  // ── User-Kontext (LTV/Eigenkapital aus aktuellem Objekt) ───────
  // Versucht aus mehreren Quellen zu lesen — Kennzahlen-Tab oder QC
  var userLtv = null;
  try {
    // 1. Aus globalem DealPilot State falls vorhanden
    if (typeof window.computeDealKpis === 'function' && typeof window._gatherInputs === 'function') {
      var ip = window._gatherInputs();
      if (ip && ip.kpis && typeof ip.kpis.ltv === 'number') userLtv = ip.kpis.ltv;
    }
    // 2. Aus direkten Inputs (KP + EK)
    if (userLtv == null) {
      var kpEl = document.getElementById('kp');
      var ekEl = document.getElementById('ek');
      if (kpEl && ekEl) {
        var kp = parseFloat((kpEl.value || '').replace(/\./g,'').replace(',','.')) || 0;
        var ek = parseFloat((ekEl.value || '').replace(/\./g,'').replace(',','.')) || 0;
        if (kp > 0) {
          var loan = Math.max(0, kp * 1.105 - ek);
          userLtv = (loan / kp) * 100;
        }
      }
    }
    // 3. Aus QC-Inputs
    if (userLtv == null) {
      var qkp = document.getElementById('qc_kp');
      var qek = document.getElementById('qc_ek');
      if (qkp && qek) {
        var qkpN = parseFloat((qkp.value || '').replace(/\./g,'').replace(',','.')) || 0;
        var qekN = parseFloat((qek.value || '').replace(/\./g,'').replace(',','.')) || 0;
        if (qkpN > 0) {
          var qloan = Math.max(0, qkpN * 1.105 - qekN);
          userLtv = (qloan / qkpN) * 100;
        }
      }
    }
  } catch (e) { /* nicht kritisch */ }

  // ── Empfehlungs-Logik ───────────────────────────────────────────
  // Drei Achsen werden gewichtet:
  //   1. Marktniveau → niedriger Zins = lange Bindung; hoher Zins = mittlere Bindung
  //   2. Trend → steigend = lange Bindung; fallend = kürzere Bindung
  //   3. LTV → hohes LTV (>90%) = lange Bindung wg. Risiko
  var empfehlung, risiko, begruendung;

  if (niveau === 'sehr niedrig' || niveau === 'niedrig') {
    // Günstige Phase: lange Bindung sinnvoll
    empfehlung = '15 Jahre';
    risiko = 'low';
    begruendung = 'Bei aktuell ' + niveau + 'em Zinsniveau lohnt sich eine längere Zinsbindung — Sie sichern sich den günstigen Satz für lange Zeit.';
    if (trend === 'steigend' || trend === 'stark_steigend') {
      empfehlung = '15–20 Jahre';
      begruendung += ' Da die Marktzinsen zudem ' + trendText + ' sind, schützt eine lange Bindung zusätzlich vor weiteren Anstiegen.';
    }
  } else if (niveau === 'mittel') {
    // Normale Phase: 10J Standard
    empfehlung = '10 Jahre';
    risiko = 'medium';
    begruendung = 'Bei aktuell ' + niveau + 'em Zinsniveau ist eine 10-jährige Bindung der bewährte Standard — Balance aus Planungssicherheit und Flexibilität.';
    if (trend === 'fallend' || trend === 'stark_fallend') {
      empfehlung = '5–10 Jahre';
      begruendung += ' Da die Marktzinsen ' + trendText + ' sind, könnte eine kürzere Bindung die spätere Anschlussfinanzierung zu besseren Konditionen ermöglichen.';
    } else if (trend === 'steigend' || trend === 'stark_steigend') {
      empfehlung = '10–15 Jahre';
      begruendung += ' Da die Zinsen ' + trendText + ' sind, ist eine etwas längere Bindung tendenziell die sicherere Wahl.';
    }
  } else if (niveau === 'hoch') {
    // Hohe Phase: kurze bis mittlere Bindung
    empfehlung = '5–10 Jahre';
    risiko = 'medium';
    begruendung = 'Bei aktuell ' + niveau + 'em Zinsniveau ist eine kürzere bis mittlere Bindung sinnvoll — falls die Zinsen wieder sinken, können Sie zur Anschlussfinanzierung umschulden.';
    if (trend === 'steigend' || trend === 'stark_steigend') {
      empfehlung = '10 Jahre';
      begruendung += ' Da die Zinsen aber ' + trendText + ' sind, bietet eine 10-jährige Bindung mehr Sicherheit.';
    }
  } else {
    // Sehr hohe Phase
    empfehlung = '5 Jahre';
    risiko = 'high';
    begruendung = 'Bei aktuell ' + niveau + 'em Zinsniveau ist eine kurze Bindung empfehlenswert, um beim erwarteten Rückgang umschulden zu können — aber kalkulieren Sie konservativ mit der Anschlussfinanzierung.';
  }

  // LTV-Override: bei sehr hohem LTV (>= 95%) immer lange Bindung empfehlen
  if (typeof userLtv === 'number' && userLtv >= 95) {
    empfehlung = '15–20 Jahre';
    risiko = 'high';
    begruendung = 'Bei einer Beleihung von ' + userLtv.toFixed(0) + '% (kaum Eigenkapital) ist eine LANGE Zinsbindung die einzig vertretbare Strategie — das Zinsänderungsrisiko bei niedrigem EK kann existenzbedrohend sein. ' + begruendung;
  } else if (typeof userLtv === 'number' && userLtv <= 60) {
    // Niedriger LTV gibt Flexibilität — eine Stufe kürzer als Default ist OK
    begruendung += ' Da Ihr LTV bei ' + userLtv.toFixed(0) + '% liegt (hoher EK-Anteil), haben Sie auch bei einer kürzeren Bindung viel Risiko-Puffer.';
  }

  // Render
  var ctxLine = '';
  if (typeof userLtv === 'number') {
    ctxLine = 'Marktlage: <strong>' + niveauTag + '</strong> (5–10 J · ' + r_5_10.toFixed(2).replace('.', ',') + '%) · ' +
              'Trend: <strong>' + trendText + '</strong>' +
              ' · Ihre Beleihung: <strong>' + userLtv.toFixed(0) + '%</strong>';
  } else {
    ctxLine = 'Marktlage: <strong>' + niveauTag + '</strong> (5–10 J · ' + r_5_10.toFixed(2).replace('.', ',') + '%) · ' +
              'Trend: <strong>' + trendText + '</strong>';
  }

  body.innerHTML =
    '<div class="mr-rec-headline">Empfehlung: <strong>' + empfehlung + '</strong> Zinsbindung ' +
      '<span class="mr-rec-risk ' + risiko + '">' +
        (risiko === 'low' ? 'geringes Risiko' : risiko === 'medium' ? 'mittleres Risiko' : 'erhöhtes Risiko') +
      '</span>' +
    '</div>' +
    '<div class="mr-rec-context-line">' + ctxLine + '</div>' +
    '<div class="mr-rec-reasoning">' + begruendung + '</div>';
}

// Auto-load — kurzer Delay damit config.js + Auth ready sind.
// V31: defensiv — auch wenn DOMContentLoaded schon gefeuert hat (Script wird am Body-Ende geladen).
function _scheduleMarketRates() {
  setTimeout(refreshMarketRates, 800);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _scheduleMarketRates);
} else {
  // DOM ist schon ready (Script kommt am Ende des Body)
  _scheduleMarketRates();
}
window.refreshMarketRates = refreshMarketRates;
