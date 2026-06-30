/* indicative-zins.js — v816c: definiert window.dpGetIndicativeZins(binding, margin).
 * WURZEL-FIX: Die Funktion wurde in investment-profile.js (getZins Z.77, Z.299) + im
 * Quickboarding-iframe (qc_zins-Retry) aufgerufen, war aber NIE definiert -> getZins() lieferte
 * immer null -> qc_zins blieb leer. Quelle: DealPilotConfig...pfandbrief (yields + margins),
 * identisch zu market-rates-pf.js STATIC_FALLBACK_PF. Indikativ = yield(Bindung) + Marge(Stufe).
 */
(function () {
  'use strict';
  if (typeof window.dpGetIndicativeZins === 'function') return;  /* nicht ueberschreiben */

  /* Greift defensiv auf die Pfandbrief-Tabelle in der Config zu (verschiedene moegliche Pfade). */
  function _pf() {
    try {
      var C = window.DealPilotConfig;
      if (!C) return null;
      /* moegliche Pfade: C.pricing.pfandbrief, C.pfandbrief, C.market.pfandbrief, C.data.pfandbrief */
      var cand = [];
      try { if (C.pricing && C.pricing.pfandbrief) cand.push(C.pricing.pfandbrief); } catch (e) {}
      try { if (C.pfandbrief) cand.push(C.pfandbrief); } catch (e) {}
      try { if (C.market && C.market.pfandbrief) cand.push(C.market.pfandbrief); } catch (e) {}
      try { if (C.data && C.data.pfandbrief) cand.push(C.data.pfandbrief); } catch (e) {}
      /* v816c: pfandbrief liegt unter marketRates (config.js Z.688/713) */
      try { if (C.pricing && C.pricing.marketRates && C.pricing.marketRates.pfandbrief) cand.push(C.pricing.marketRates.pfandbrief); } catch (e) {}
      try { if (C.marketRates && C.marketRates.pfandbrief) cand.push(C.marketRates.pfandbrief); } catch (e) {}
      try { if (C.data && C.data.marketRates && C.data.marketRates.pfandbrief) cand.push(C.data.marketRates.pfandbrief); } catch (e) {}
      /* getMarket()-Stil */
      try { if (typeof C.getMarket === 'function') { var m = C.getMarket(); if (m && m.pfandbrief) cand.push(m.pfandbrief); } } catch (e) {}
      for (var i = 0; i < cand.length; i++) {
        if (cand[i] && cand[i].yields && cand[i].margins) return cand[i];
      }
    } catch (e) {}
    return null;
  }

  /* Harter Fallback, falls die Config-Tabelle nicht erreichbar ist (gleiche Werte wie config.js/asOf 2026-05) */
  var STATIC = {
    yields:  { '5': 2.85, '10': 3.05, '15': 3.18, '20': 3.28 },
    margins: { premium: 0.40, standard: 0.70, schwach: 1.00 }
  };

  function _nearestBinding(yields, binding) {
    var keys = Object.keys(yields).map(function (k) { return parseInt(k, 10); }).filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; });
    if (!keys.length) return null;
    var b = parseInt(binding, 10); if (!isFinite(b) || b <= 0) b = 10;
    /* exakter Treffer? */
    if (yields[String(b)] != null) return String(b);
    /* sonst naechstgelegene Stuetzstelle */
    var best = keys[0], bestD = Math.abs(keys[0] - b);
    for (var i = 1; i < keys.length; i++) { var d = Math.abs(keys[i] - b); if (d < bestD) { bestD = d; best = keys[i]; } }
    return String(best);
  }

  window.dpGetIndicativeZins = function (binding, margin) {
    try {
      var pf = _pf() || STATIC;
      var yields = pf.yields || STATIC.yields;
      var margins = pf.margins || STATIC.margins;
      var bKey = _nearestBinding(yields, binding == null ? 10 : binding);
      if (bKey == null) return null;
      var y = yields[bKey];
      var mKey = (margin && margins[margin] != null) ? margin : 'standard';
      var marge = (margins[mKey] != null) ? margins[mKey] : 0.70;
      if (typeof y !== 'number' || !isFinite(y)) return null;
      return Math.round((y + marge) * 100) / 100;
    } catch (e) { return null; }
  };
})();
