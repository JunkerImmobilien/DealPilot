'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V1.0 – v10.js

   Steuert die NEUE kompakte Zinsannahme-Card + Markt-Daten-Modal:
   - Modal öffnet/schließt mit Cards drin
   - Kompakt-Card zeigt 4 Werte (Variabel/10J/15J/20J) + Empfehlungstext
   - Verbindet mit existierender zinsannahme.js-Logik (lädt dieselben Daten)
   ═══════════════════════════════════════════════════ */

window.V10 = (function() {

  var _pfandbrief = null;
  var _context = null;
  var _activeMargin = 'standard';
  var _modalOpen = false;
  var _escHandler = null;

  function _apiBase() {
    return (typeof Auth !== 'undefined' && Auth.getApiBase) ? Auth.getApiBase() : '/api/v1';
  }
  function _authHeaders() {
    var h = { 'Accept': 'application/json' };
    var tok = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null;
    if (tok) h['Authorization'] = 'Bearer ' + tok;
    return h;
  }

  async function _fetchPfandbrief() {
    try {
      var r = await fetch(_apiBase() + '/market-rates/pfandbrief?maturities=5,10,15,20', { headers: _authHeaders() });
      if (!r.ok) return null;
      return await r.json();
    } catch(e) { return null; }
  }
  async function _fetchContext() {
    try {
      var r = await fetch(_apiBase() + '/market-rates/market-context', { headers: _authHeaders() });
      if (!r.ok) return null;
      return await r.json();
    } catch(e) { return null; }
  }

  function _fmtPct(v) {
    if (v == null || isNaN(v)) return '–';
    return v.toFixed(2).replace('.', ',') + ' %';
  }

  function _computeRates() {
    if (!_pfandbrief || !_context) return null;
    var m = (_pfandbrief.margins && _pfandbrief.margins[_activeMargin]) || 1.20;
    var euribor = (_context.euribor_3m && _context.euribor_3m.value) || null;
    return {
      'var': (euribor != null) ? Math.round((euribor + m) * 100) / 100 : null,
      '10':  (_pfandbrief.yields['10'] != null) ? Math.round((_pfandbrief.yields['10'] + m) * 100) / 100 : null,
      '15':  (_pfandbrief.yields['15'] != null) ? Math.round((_pfandbrief.yields['15'] + m) * 100) / 100 : null,
      '20':  (_pfandbrief.yields['20'] != null) ? Math.round((_pfandbrief.yields['20'] + m) * 100) / 100 : null
    };
  }

  /**
   * Heuristik — gibt die empfohlenen Laufzeiten zurück + einen Kompakt-Text.
   */
  function _computeRecommendation() {
    if (!_pfandbrief || !_context) {
      return { mats: ['10'], compactText: 'Lade aktuelle Marktdaten…' };
    }
    var y10 = _pfandbrief.yields['10'];
    var y15 = _pfandbrief.yields['15'];
    if (y10 == null || y15 == null) {
      return { mats: ['10'], compactText: '<strong>10 Jahre Zinsbindung</strong> als Standard' };
    }

    var slope = y15 - y10;
    var mrrTrend = _context.ecb_mrr && _context.ecb_mrr.trend;
    var mats, text;

    if (slope < 0.30) {
      mats = ['10', '15'];
      text = '<strong>10–15 Jahre Zinsbindung</strong> · flache Zinsstruktur — lange Bindung kaum teurer';
    } else if (slope < 0.60) {
      mats = ['10'];
      text = '<strong>10 Jahre Zinsbindung</strong> · normaler Marktstandard';
    } else {
      mats = ['10'];
      text = '<strong>10 Jahre Zinsbindung</strong> · steile Zinsstruktur — kurzes Optimum';
    }

    if (mrrTrend === 'up' && !mats.includes('15') && slope < 0.50) {
      mats.push('15');
      text = '<strong>10–15 Jahre Zinsbindung</strong> · EZB-Trend steigend, längere Bindung sichert ab';
    }
    return { mats: mats, compactText: text };
  }

  function _renderCompact() {
    var rates = _computeRates();
    var rec = _computeRecommendation();

    var textEl = document.getElementById('v10-zc-text');
    if (textEl) textEl.innerHTML = rec.compactText;

    if (!rates) return;

    ['var', '10', '15', '20'].forEach(function(mat) {
      var rateEl = document.getElementById('v10-rate-' + mat);
      if (rateEl) rateEl.textContent = _fmtPct(rates[mat]);

      // Empfehlung-Hervorhebung
      var span = document.querySelector('.v10-zc-rate[data-mat="' + mat + '"]');
      if (span) span.classList.toggle('is-recommended', rec.mats.indexOf(mat) >= 0);
    });

    // Stand-Info rechts
    var standEl = document.getElementById('v10-zc-stand');
    if (standEl) {
      var srcKey = _pfandbrief.source || 'static';
      var when = '';
      if (_pfandbrief.asOf) {
        try {
          var dt = new Date(_pfandbrief.asOf);
          when = dt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch(e){}
      }
      var sourceLabel = srcKey === 'live' ? 'Live · Bundesbank'
                      : srcKey === 'mixed' ? 'Live + Hinterlegt'
                      : 'Hinterlegt';
      standEl.textContent = sourceLabel + (when ? ' · ' + when : '');
    }
  }

  async function _load() {
    var results = await Promise.all([_fetchPfandbrief(), _fetchContext()]);
    _pfandbrief = results[0];
    _context    = results[1];

    // Fallback aus config wenn API nichts liefert
    if (!_pfandbrief) {
      try {
        var cfg = window.DealPilotConfig && DealPilotConfig.marketRates && DealPilotConfig.marketRates.pfandbrief;
        if (cfg) _pfandbrief = { yields: cfg.yields, margins: cfg.margins, source: 'static', asOf: cfg.asOf };
      } catch(e) {}
    }
    if (!_context) {
      try {
        var mc = window.DealPilotConfig && DealPilotConfig.marketRates && DealPilotConfig.marketRates.marketContext;
        if (mc) _context = { ecb_mrr: { value: mc.ecb_mrr, trend: 'flat' }, euribor_3m: { value: mc.euribor_3m, trend: 'flat' } };
      } catch(e) {}
    }
    _renderCompact();
  }

  /**
   * Öffnet das Markt-Daten-Modal.
   * Strategie: die 3 Markt-Cards leben im hidden Container <#v10-cards-source>.
   * Beim Öffnen werden sie in <#v10-modal-body> verschoben — beim Schließen zurück.
   * Das bedeutet: die existierenden JS-Module (market-context.js, market-rates.js,
   * market-rates-pf.js) operieren weiter auf den gleichen DOM-Elementen, ohne dass
   * sie umgeschrieben werden müssen.
   */
  function openMarketModal() {
    var modal  = document.getElementById('v10-market-modal');
    var body   = document.getElementById('v10-modal-body');
    var source = document.getElementById('v10-cards-source');
    if (!modal || !body || !source) return;

    // Cards verschieben (live, behalten ihre Daten!)
    while (source.firstChild) {
      body.appendChild(source.firstChild);
    }
    // Alle Cards im Modal aufgeklappt zeigen (Modal überschreibt collapse-state visuell,
    // aber wir setzen die Klasse trotzdem hier raus damit's klar ist)
    body.querySelectorAll('.card[data-collapsible]').forEach(function(c) {
      c.classList.remove('v212-collapsed');
    });

    modal.style.display = 'flex';
    _modalOpen = true;

    // ESC-Handler
    _escHandler = function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) closeMarketModal();
    };
    document.addEventListener('keydown', _escHandler);

    // Charts neu rendern (Chart.js braucht das wenn das Canvas vorher hidden war)
    setTimeout(function() {
      try { if (typeof refreshMarketContext === 'function') refreshMarketContext(); } catch(e){}
      try { if (window._ratesChartInstance && window._ratesChartInstance.resize) window._ratesChartInstance.resize(); } catch(e){}
      try { if (window._ratesBarChartInstance && window._ratesBarChartInstance.resize) window._ratesBarChartInstance.resize(); } catch(e){}
      try { if (window._mrPfChartInstance && window._mrPfChartInstance.resize) window._mrPfChartInstance.resize(); } catch(e){}
    }, 100);
  }

  function closeMarketModal() {
    var modal  = document.getElementById('v10-market-modal');
    var body   = document.getElementById('v10-modal-body');
    var source = document.getElementById('v10-cards-source');
    if (!modal || !body || !source) return;

    // Cards zurück in den hidden Container
    while (body.firstChild) {
      source.appendChild(body.firstChild);
    }
    modal.style.display = 'none';
    _modalOpen = false;

    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }
  }

  function handleOverlayClick(e) {
    var modal = document.getElementById('v10-market-modal');
    if (e.target === modal) closeMarketModal();
  }

  // Auto-Init
  function _schedule() { setTimeout(_load, 700); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _schedule);
  } else {
    _schedule();
  }

  return {
    openMarketModal: openMarketModal,
    closeMarketModal: closeMarketModal,
    handleOverlayClick: handleOverlayClick,
    refresh: _load
  };
})();

/* ═══════════════════════════════════════════════════
   V1.0-Cleanup: User-Box wieder schlank + Easter-Egg nach Login weg

   - User-Box bleibt bei den Original-2-Reihen (Avatar+Email+Icons, nichts extra)
   - Versions-Foot wird entfernt falls noch da
   - Easter-Egg-Punkt wird nach Login zuverlässig versteckt (Polling, dezent)
   ═══════════════════════════════════════════════════ */
(function() {
  // Reste vorheriger V10-Polish-Patches aus dem DOM räumen
  function _cleanupOldV10Elements() {
    var userBox = document.getElementById('sb-user');
    if (!userBox) return;

    // Alte Status-Foot / Version-Foot / Version-Pill entfernen
    var oldFoot = userBox.querySelector('.v10-status-foot, .v10-version-foot');
    if (oldFoot) {
      // Wenn da eine Plan-Pille drin gelandet ist, zurück in .sb-user-text schieben
      var planPill = oldFoot.querySelector('.sb-user-plan-pill');
      if (planPill) {
        var userText = userBox.querySelector('.sb-user-text');
        if (userText) userText.appendChild(planPill);
      }
      oldFoot.remove();
    }

    // Alte Pille innerhalb von .sb-user-text die wir mal injectiert haben
    var oldPill = userBox.querySelector('.v10-version-pill');
    if (oldPill) oldPill.remove();
  }

  // Easter-Egg-Punkt nach Login zuverlässig verstecken
  function _hideEasterEggIfLoggedIn() {
    var dot = document.getElementById('dp-register-easter-egg');
    if (!dot) return;
    var authModal     = document.getElementById('auth-modal');
    var registerModal = document.getElementById('dp-register-modal');
    var shouldShow = !!authModal || !!registerModal;
    if (!shouldShow && dot.style.display !== 'none') {
      dot.style.display = 'none';
    }
  }

  function _schedule() {
    _cleanupOldV10Elements();
    _hideEasterEggIfLoggedIn();

    // Periodisch — Cleanup hartnäckig (falls noch ein Modul die alten Klassen
    // wieder hinzufügt), Easter-Egg-Hide reagiert auf Login-State-Change.
    setInterval(function() {
      _cleanupOldV10Elements();
      _hideEasterEggIfLoggedIn();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _schedule);
  } else {
    _schedule();
  }
})();
