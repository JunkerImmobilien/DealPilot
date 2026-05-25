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
      const res = await fetch('/api/v1/tax-snapshots', {
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
      // V278: Mapping snapshots[] -> objects[] fuer Backwards-Compat
      if (_cache && Array.isArray(_cache.snapshots)) {
        _cache.objects = _cache.snapshots.map(function(s){
          return { id: s.object_id, address: s.address, purchase_date: s.purchase_date, status: 'won', wk_per_year: s.wk_per_year || {} };
        });
        _cache.totals_per_year = {};
        _cache.snapshots.forEach(function(s){
          Object.keys(s.wk_per_year || {}).forEach(function(y){
            var v = Number(s.wk_per_year[y]) || 0;
            _cache.totals_per_year[y] = (_cache.totals_per_year[y] || 0) + v;
          });
        });
      }
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
