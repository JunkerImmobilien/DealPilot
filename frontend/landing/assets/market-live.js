/* ============================================================================
   DealPilot v445 – market-live.js (Landing)
   Fuellt die 4 Marktzins-Tiles der Landingpage live aus dem Pfandbrief-Endpoint
   (5/10/15/20 Jahre, Marge "schwach" = LTV > 90 %) — konsistent zum Finanz-Tab.
   Faellt bei jedem Fehler still auf die statischen Werte zurueck.
   ============================================================================ */
(function () {
  'use strict';
  function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' %'; }

  function apiUrl() {
    try {
      if (window.DealPilotEnv && typeof DealPilotEnv.appUrl === 'function') {
        return DealPilotEnv.appUrl('api/v1/market-rates/pfandbrief?maturities=5,10,15,20');
      }
    } catch (e) {}
    return null;
  }

  function pickSchwach(d, m) {
    // bevorzugt indicativeRates[m].schwach; sonst yields[m] + margins.schwach
    try {
      if (d.indicativeRates && d.indicativeRates[m] && d.indicativeRates[m].schwach != null)
        return d.indicativeRates[m].schwach;
      if (d.yields && d.margins && d.yields[m] != null && d.margins.schwach != null)
        return d.yields[m] + d.margins.schwach;
    } catch (e) {}
    return null;
  }

  function fill() {
    var url = apiUrl();
    if (!url) return;
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var tiles = document.querySelectorAll('.rates-grid .rate-tile .rate-val');
        var mats = ['5', '10', '15', '20'];
        mats.forEach(function (m, i) {
          var v = pickSchwach(d, m);
          if (v != null && tiles[i]) tiles[i].textContent = fmt(v);
        });
      })
      .catch(function () { /* still: statische Werte bleiben stehen */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(fill, 400); });
  } else {
    setTimeout(fill, 400);
  }
})();
