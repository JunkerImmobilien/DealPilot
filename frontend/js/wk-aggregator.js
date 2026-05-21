/* V258-05: WK-Aggregator
 * Sammelt Werbungskosten (Ueberschuss/Verlust V+V) aller Won-Objekte
 * vom Backend und stellt sie fuer Steuer-Berechnung bereit.
 */
(function() {
  'use strict';

  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 30000; // 30 Sekunden

  function getApi() {
    if (window.Api && typeof window.Api.get === 'function') return window.Api;
    return null;
  }

  function getToken() {
    try { return localStorage.getItem('ji_token') || ''; } catch(e) { return ''; }
  }

  /** Laedt WK-Daten aller Won-Objekte */
  async function loadAll(force) {
    if (!force && _cache && (Date.now() - _cacheTime) < CACHE_TTL) {
      return _cache;
    }
    try {
      const token = getToken();
      if (!token) {
        console.log('[V258-05] Kein Token — keine WK-Aggregation');
        return null;
      }
      const res = await fetch('/api/v1/objects/wk-aggregate', {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        console.warn('[V258-05] wk-aggregate HTTP', res.status);
        return null;
      }
      _cache = await res.json();
      _cacheTime = Date.now();
      console.log('[V258-05] WK-Aggregation geladen:', _cache.count, 'Objekte');
      return _cache;
    } catch(e) {
      console.warn('[V258-05] loadAll fehlgeschlagen:', e.message);
      return null;
    }
  }

  /** WK-Summe der anderen Won-Objekte fuer ein bestimmtes Jahr */
  function getWKForOtherObjects(currentObjectId, year) {
    if (!_cache || !Array.isArray(_cache.objects)) return 0;
    let sum = 0;
    _cache.objects.forEach(obj => {
      if (obj.id === currentObjectId) return; // Sich selbst ausschliessen
      const wk = obj.wk_per_year && obj.wk_per_year[String(year)];
      if (typeof wk === 'number') sum += wk;
    });
    return sum;
  }

  /** Summe WK ueber alle Objekte (auch das aktuelle) — fuer Dashboard */
  function getTotalWK(year) {
    if (!_cache || !_cache.totals_per_year) return 0;
    return _cache.totals_per_year[String(year)] || 0;
  }

  function getAllObjectsWithWK() {
    if (!_cache || !Array.isArray(_cache.objects)) return [];
    return _cache.objects.slice();
  }

  /** Snapshot des aktuellen Objekts in dessen data persistieren.
   *  Wird vom Steuer-Tab nach jedem calc() aufgerufen.
   *  Aktualisiert ausserdem den lokalen Cache.
   */
  function saveSnapshot(objectId, snapshot) {
    if (!objectId || !snapshot) return;
    // Cache live updaten
    if (_cache && Array.isArray(_cache.objects)) {
      const obj = _cache.objects.find(o => o.id === objectId);
      if (obj) {
        obj.wk_per_year = snapshot.wk_per_year || {};
        // totals neu berechnen
        const totals = {};
        _cache.objects.forEach(o => {
          if (!o.wk_per_year) return;
          Object.entries(o.wk_per_year).forEach(([y, v]) => {
            totals[y] = (totals[y] || 0) + (Number(v) || 0);
          });
        });
        _cache.totals_per_year = totals;
      }
    }
    // Lokales Datenmodell aktualisieren (wird beim Save persistiert)
    if (window._currentObjData) {
      window._currentObjData.steuer_snapshot = snapshot;
    }
  }

  function clearCache() {
    _cache = null;
    _cacheTime = 0;
  }

  window.DealPilotWKAggregator = {
    loadAll: loadAll,
    getWKForOtherObjects: getWKForOtherObjects,
    getTotalWK: getTotalWK,
    getAllObjectsWithWK: getAllObjectsWithWK,
    saveSnapshot: saveSnapshot,
    clearCache: clearCache,
    _meta: 'V258-05'
  };

  // Beim Login/App-Start initial laden
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(loadAll, 500);
    });
  } else {
    setTimeout(loadAll, 500);
  }
})();


/* BlockB4: kaufdat-Filter fuer getWKForOtherObjects */
(function() {
  if (!window.DealPilotWKAggregator) return;
  var orig = window.DealPilotWKAggregator.getWKForOtherObjects;
  window.DealPilotWKAggregator.getWKForOtherObjects = function(currentObjectId, year) {
    var cache = window.DealPilotWKAggregator._cache;
    // Fallback: wenn _cache nicht zugaenglich, original-Funktion aufrufen
    if (!cache || !Array.isArray(cache.objects)) {
      return orig.call(this, currentObjectId, year);
    }
    var yearEnd = String(year) + '-12-31';
    var sum = 0;
    cache.objects.forEach(function(obj) {
      if (obj.id === currentObjectId) return;
      // BlockB4: kaufdat-Filter — nur Objekte die vor/im Zieljahr gekauft wurden
      var kaufdat = obj.kaufdat || (obj.snapshot && obj.snapshot.kaufdat);
      if (!kaufdat) return; // ohne kaufdat: skip (sicherer Default)
      if (kaufdat > yearEnd) return; // spaeter gekauft -> ignorieren
      var wk = obj.wk_per_year && obj.wk_per_year[String(year)];
      if (typeof wk === 'number') sum += wk;
    });
    return sum;
  };
  console.log('[BlockB4] WKAggregator.getWKForOtherObjects mit kaufdat-Filter');
})();
