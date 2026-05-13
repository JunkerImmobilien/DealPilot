'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V210 – market-rates-pf.js

   Pfandbrief-basierte indikative Bauzinsen für 5/10/15/20 Jahre.
   Quelle: Bundesbank-Pfandbrief-Zinsstruktur (BBSIS) + indikative Bank-Marge.

   Marge-Modell:
     premium  +0,8%  (LTV ≤ 60%, Top-Bonität)
     standard +1,2%  (LTV 60–80%, normale Bonität)
     schwach  +1,8%  (LTV > 90% oder Bonität mittel)

   Diese Werte sind INDIKATIONEN, keine Konditions-Quoten.
   ═══════════════════════════════════════════════════ */

var MarketRatesPF = (function() {

  // State
  var _currentData = null;
  var _activeMargin = 'standard';   // Default

  // Bucket-Konfiguration für UI (Farben aus V209 wiederverwendet)
  var BUCKETS_PF = [
    { key: '5',  label: '5 Jahre',  color: '#5BA89F' },
    { key: '10', label: '10 Jahre', color: '#C9A84C' },
    { key: '15', label: '15 Jahre', color: '#D89567' },
    { key: '20', label: '20 Jahre', color: '#B8625C' }
  ];

  // Sane Defaults — falls Backend nie antwortet
  var STATIC_FALLBACK_PF = {
    yields:  { '5': 2.85, '10': 3.05, '15': 3.18, '20': 3.28 },
    margins: { premium: 0.80, standard: 1.20, schwach: 1.80 }
  };

  async function _fetchFromBackend() {
    var apiBase = (typeof Auth !== 'undefined' && Auth.getApiBase) ? Auth.getApiBase() : '/api/v1';
    try {
      var headers = { 'Accept': 'application/json' };
      var tok = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null;
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      var res = await fetch(apiBase + '/market-rates/pfandbrief?maturities=5,10,15,20', { headers: headers });
      if (!res.ok) {
        console.warn('[V210 pfandbrief] HTTP ' + res.status);
        return null;
      }
      return await res.json();
    } catch (e) {
      console.warn('[V210 pfandbrief] fetch error:', e.message);
      return null;
    }
  }

  function _buildFromFallback() {
    // Wird genutzt wenn Backend gar nicht antwortet — minimal aber konsistent
    var f = STATIC_FALLBACK_PF;
    var indicative = {};
    Object.keys(f.yields).forEach(function(m) {
      indicative[m] = {
        premium:  Math.round((f.yields[m] + f.margins.premium)  * 100) / 100,
        standard: Math.round((f.yields[m] + f.margins.standard) * 100) / 100,
        schwach:  Math.round((f.yields[m] + f.margins.schwach)  * 100) / 100
      };
    });
    return {
      maturities: ['5', '10', '15', '20'],
      yields: f.yields,
      margins: f.margins,
      indicativeRates: indicative,
      sources: { '5': 'static', '10': 'static', '15': 'static', '20': 'static' },
      periods: { '5': null, '10': null, '15': null, '20': null },
      source: 'static',
      sourceInfo: { name: 'Frontend-Fallback (Backend nicht erreichbar)', url: '' },
      asOf: new Date(),
      _frontendFallback: true
    };
  }

  async function _refresh() {
    var data = await _fetchFromBackend();
    if (!data) data = _buildFromFallback();
    _currentData = data;
    _renderUI();
  }

  function setMargin(marginKey) {
    if (!['premium', 'standard', 'schwach'].includes(marginKey)) return;
    _activeMargin = marginKey;
    // Buttons visuell
    document.querySelectorAll('.mr-pf-margin-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-margin') === marginKey);
    });
    _renderUI();
  }
  window.setPfandbriefMargin = setMargin;

  function refreshPfandbriefRates() {
    return _refresh();
  }
  window.refreshPfandbriefRates = refreshPfandbriefRates;

  function _renderUI() {
    if (!_currentData) return;
    var d = _currentData;

    // ── Tiles ─────────────────────────────────────────────
    BUCKETS_PF.forEach(function(b) {
      var rateEl   = document.getElementById('mr-pf-rate-' + b.key);
      var srcEl    = document.getElementById('mr-pf-src-' + b.key);
      var detailEl = document.getElementById('mr-pf-detail-' + b.key);
      if (!rateEl) return;

      var yield_ = d.yields[b.key];
      var indic  = d.indicativeRates[b.key];
      var src    = d.sources[b.key] || 'static';

      if (typeof yield_ !== 'number' || !indic) {
        rateEl.textContent = '–';
        if (srcEl) { srcEl.textContent = '–'; srcEl.className = 'mr-pf-tile-src'; }
        if (detailEl) detailEl.textContent = 'Keine Daten';
        return;
      }

      var indicVal = indic[_activeMargin];
      rateEl.textContent = indicVal.toFixed(2).replace('.', ',') + ' %';

      if (srcEl) {
        srcEl.textContent = src === 'live' ? 'Live' : 'Hinterlegt';
        srcEl.className = 'mr-pf-tile-src ' + src;
        srcEl.setAttribute('title', src === 'live'
          ? 'Live aus Bundesbank-API'
          : 'Hinterlegter Wert · Stand ' + (d.periods[b.key] || '–'));
      }
      if (detailEl) {
        var marginVal = d.margins[_activeMargin];
        detailEl.textContent = 'Pfandbrief ' + yield_.toFixed(2).replace('.', ',') + '% + Marge ' + marginVal.toFixed(2).replace('.', ',') + '%';
      }
    });

    // ── Source-Box ──────────────────────────────────────────
    var sourceBox = document.getElementById('mr-pf-source');
    if (sourceBox) {
      var srcKey = d.source || 'static';
      var badgeText;
      if (srcKey === 'live')        badgeText = '● Live · Bundesbank';
      else if (srcKey === 'static') badgeText = '📌 Hinterlegt';
      else if (srcKey === 'mixed')  badgeText = '◐ Gemischt (Live + Hinterlegt)';
      else                           badgeText = '⚠ Nicht verfügbar';

      var srcName = (d.sourceInfo && d.sourceInfo.name) || 'Bundesbank';
      var srcUrl  = (d.sourceInfo && d.sourceInfo.url)  || '';
      var asOfStr = '';
      if (d.asOf) {
        try {
          var dt = new Date(d.asOf);
          asOfStr = ' · Stand ' + dt.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
        } catch(e){}
      }
      sourceBox.innerHTML =
        '<span class="mr-pf-source-badge ' + srcKey + '">' + badgeText + '</span>' +
        'Quelle: ' + (srcUrl ? '<a href="' + srcUrl + '" target="_blank" rel="noopener">' + srcName + '</a>' : srcName) +
        asOfStr;
    }

    // ── Header-Badge ──────────────────────────────────────
    var headerBadge = document.getElementById('mr-pf-source-badge');
    if (headerBadge) {
      var srcKey2 = d.source || 'static';
      if (srcKey2 === 'live')      headerBadge.textContent = 'Pfandbrief Live · Bundesbank';
      else if (srcKey2 === 'mixed') headerBadge.textContent = 'Pfandbrief Mixed (Live+Hinterlegt)';
      else                          headerBadge.textContent = 'Pfandbrief Hinterlegt';
    }

    // V213: Sublabel
    if (window.CollapsibleCards && window.CollapsibleCards.setSublabel) {
      var y10 = d.yields && d.yields['10'];
      var y20 = d.yields && d.yields['20'];
      var bits = [];
      if (y10 != null) bits.push('10J ' + y10.toFixed(2).replace('.', ',') + '%');
      if (y20 != null) bits.push('20J ' + y20.toFixed(2).replace('.', ',') + '%');
      window.CollapsibleCards.setSublabel('mr-pf', bits.join(' · '));
    }

    // ── Bar-Chart ─────────────────────────────────────────
    _renderBarChart(d);
  }

  function _renderBarChart(d) {
    var canvas = document.getElementById('mr-pf-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (window._mrPfChartInstance) {
      try { window._mrPfChartInstance.destroy(); } catch(e){}
    }

    var labels = BUCKETS_PF.map(function(b) { return b.label; });
    var values = BUCKETS_PF.map(function(b) {
      var ind = d.indicativeRates[b.key];
      return ind ? ind[_activeMargin] : null;
    });
    var colors = BUCKETS_PF.map(function(b) { return b.color; });

    window._mrPfChartInstance = new Chart(canvas, {
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
          maxBarThickness: 90
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
                var bk = BUCKETS_PF[ctx.dataIndex].key;
                var yld = d.yields[bk];
                var mar = d.margins[_activeMargin];
                return [
                  'Indikativ: ' + ctx.parsed.y.toFixed(2).replace('.', ',') + ' %',
                  'davon Pfandbrief: ' + (yld != null ? yld.toFixed(2).replace('.', ',') + '%' : '–'),
                  'davon Marge: ' + mar.toFixed(2).replace('.', ',') + '%'
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: 'rgba(42,39,39,0.6)' }
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

  // Auto-Load mit Verzögerung damit Auth + Chart.js bereit sind
  function _schedule() {
    setTimeout(_refresh, 900);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _schedule);
  } else {
    _schedule();
  }

  return {
    refresh: _refresh,
    setMargin: setMargin
  };
})();
