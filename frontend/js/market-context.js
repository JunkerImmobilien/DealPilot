'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V211 – market-context.js

   EZB-Leitzins + EURIBOR 3M (mit Trend zu Vorperiode).
   Quelle: ECB Data Portal (public API).
   Static-Fallback wenn Backend nicht erreichbar.
   ═══════════════════════════════════════════════════ */

var MarketContext = (function() {

  var _data = null;

  async function _fetchFromBackend() {
    var apiBase = (typeof Auth !== 'undefined' && Auth.getApiBase) ? Auth.getApiBase() : '/api/v1';
    try {
      var headers = { 'Accept': 'application/json' };
      var tok = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null;
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      var res = await fetch(apiBase + '/market-rates/market-context', { headers: headers });
      if (!res.ok) {
        console.warn('[V211 market-context] HTTP ' + res.status);
        return null;
      }
      return await res.json();
    } catch (e) {
      console.warn('[V211 market-context] fetch error:', e.message);
      return null;
    }
  }

  function _frontendFallback() {
    return {
      ecb_mrr:    { value: 2.15, period: '2026-05', trend: 'flat', source: 'static' },
      euribor_3m: { value: 2.32, period: '2026-05', trend: 'flat', source: 'static' },
      source: 'static',
      sourceInfo: { name: 'Frontend-Fallback', url: '' }
    };
  }

  async function _refresh() {
    var d = await _fetchFromBackend();
    if (!d) d = _frontendFallback();
    _data = d;
    _renderUI();
  }

  function refreshMarketContext() {
    return _refresh();
  }
  window.refreshMarketContext = refreshMarketContext;

  function _formatPct(v) {
    if (v == null) return '–';
    return v.toFixed(2).replace('.', ',') + ' %';
  }
  function _formatPeriod(p) {
    if (!p) return '–';
    // YYYY-MM oder YYYY-MM-DD
    var parts = String(p).split('-');
    var monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    if (parts.length >= 2) {
      var monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return monthNames[monthIdx] + ' ' + parts[0];
      }
    }
    return p;
  }
  function _trendSymbol(trend) {
    if (trend === 'up')   return '↑';
    if (trend === 'down') return '↓';
    return '→';
  }
  function _trendText(trend, prev, cur) {
    if (trend === 'flat' || prev == null) return 'unverändert';
    var delta = (cur - prev).toFixed(2).replace('.', ',');
    var sign = (cur > prev) ? '+' : '';
    return sign + delta + ' %p ggü. Vormonat';
  }

  function _renderTile(prefix, data) {
    var rateEl   = document.getElementById('mr-ctx-rate-' + prefix);
    var srcEl    = document.getElementById('mr-ctx-src-' + prefix);
    var trendEl  = document.getElementById('mr-ctx-trend-' + prefix);
    var periodEl = document.getElementById('mr-ctx-period-' + prefix);
    if (!rateEl) return;

    rateEl.textContent = _formatPct(data.value);

    if (srcEl) {
      srcEl.textContent = data.source === 'live' ? 'Live' : 'Hinterlegt';
      srcEl.className = 'mr-ctx-tile-src ' + (data.source || 'static');
      srcEl.setAttribute('title', data.source === 'live'
        ? 'Live aus ECB Data Portal'
        : 'Hinterlegter Wert · Stand ' + _formatPeriod(data.period));
    }

    if (trendEl) {
      trendEl.textContent = _trendSymbol(data.trend);
      trendEl.className = 'mr-ctx-trend ' + (data.trend || 'flat');
    }
    if (periodEl) {
      var t = _trendText(data.trend, data.previousValue, data.value);
      periodEl.textContent = _formatPeriod(data.period) + ' · ' + t;
    }
  }

  function _renderUI() {
    if (!_data) return;
    _renderTile('mrr', _data.ecb_mrr);
    _renderTile('eu',  _data.euribor_3m);

    // Header-Badge
    var headerBadge = document.getElementById('mr-ctx-source-badge');
    if (headerBadge) {
      if (_data.source === 'live')        headerBadge.textContent = 'Live · ECB';
      else if (_data.source === 'mixed')  headerBadge.textContent = 'Mixed (Live + Hinterlegt)';
      else                                 headerBadge.textContent = 'Hinterlegt';
    }

    // Source-Box
    var srcBox = document.getElementById('mr-ctx-source');
    if (srcBox) {
      var srcName = (_data.sourceInfo && _data.sourceInfo.name) || 'ECB Data Portal';
      var srcUrl  = (_data.sourceInfo && _data.sourceInfo.url)  || '';
      srcBox.innerHTML = 'Quelle: ' +
        (srcUrl ? '<a href="' + srcUrl + '" target="_blank" rel="noopener">' + srcName + '</a>' : srcName);
    }

    // V213: Sublabel für zugeklappte Card
    if (window.CollapsibleCards && window.CollapsibleCards.setSublabel) {
      var mrrVal = _data.ecb_mrr && _data.ecb_mrr.value;
      var euVal  = _data.euribor_3m && _data.euribor_3m.value;
      var bits = [];
      if (mrrVal != null) bits.push('EZB ' + _formatPct(mrrVal));
      if (euVal != null)  bits.push('EURIBOR 3M ' + _formatPct(euVal));
      window.CollapsibleCards.setSublabel('mr-ctx', bits.join(' · '));
    }
  }

  // Auto-Load
  function _schedule() { setTimeout(_refresh, 900); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _schedule);
  } else {
    _schedule();
  }

  return {
    refresh: _refresh
  };
})();
