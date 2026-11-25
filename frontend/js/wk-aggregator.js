/* V258-05: WK-Aggregator
 * Sammelt Werbungskosten (Ueberschuss/Verlust V+V) aller Won-Objekte
 * vom Backend und stellt sie fuer Steuer-Berechnung bereit.
 */
(function() {
  'use strict';

  let _cache = null;
  let _cacheTime = 0;
  /* v3314 · N157 · Ladezustand der Snapshots: offen | laedt | geladen | fehler */
  let _status = 'offen';
  let _fehler = null;
  function _melden(st, fehler) {
    _status = (st === 'fehler' && _cache) ? 'geladen' : st;   /* alter Cache bleibt gueltig */
    _fehler = fehler || null;
    try { window.dispatchEvent(new CustomEvent('dp:steuer-snapshots', { detail: { status: _status, fehler: _fehler } })); } catch (e) {}
  }
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
        console.log('[V258-05] Kein Token, keine WK-Aggregation');
        return null;
      }
      if (!_cache) _status = 'laedt';   /* v3314 */
      const res = await fetch('/api/v1/tax-snapshots', {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) {
        /* v3314 · N157: sichtbar - ohne Snapshots fehlt der Saldo der uebrigen Objekte */
        console.error('[v3314] Steuer-Snapshots der uebrigen Objekte NICHT geladen: HTTP ' + res.status
          + (res.status === 429 ? ' (Anfragebremse)' : '') + ' - Steuer bleibt vorlaeufig, gespeicherte Steuerzahl wird nicht ueberschrieben');
        _melden('fehler', 'HTTP ' + res.status);
        return null;
      }
      _cache = await res.json();
      // V278: Mapping snapshots[] -> objects[] fuer Backwards-Compat
      if (_cache && Array.isArray(_cache.snapshots)) {
        /* v2891: `rang` = Reihenfolge der Anlage (das Backend sortiert nach
           objects.created_at). Er entscheidet bei GLEICHEM Kaufdatum, wer
           zuerst kommt - Tab Steuern und Steuerkette im Cockpit nutzen ihn
           beide, sonst schlossen sich zwei Objekte desselben Tages
           gegenseitig aus. */
        _cache.objects = _cache.snapshots.map(function(s, i){
          return { id: s.object_id, address: s.address, purchase_date: s.purchase_date, status: 'won', wk_per_year: s.wk_per_year || {}, halter: s.halter || 'privat' /* v813-3c */, rang: i };
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
      if (_status !== 'geladen') _melden('geladen');   /* v3314: nur der Uebergang meldet (v730-Schleife) */
      return _cache;
    } catch(e) {
      console.error('[v3314] Steuer-Snapshots NICHT geladen:', e.message);
      _melden('fehler', e.message);
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
    _status = 'offen';   /* v3314 */
  }

  /* v3700 · P2 Rechenkontext (steuer-kontext.js): im Kundenstand oder bei einem fuer den Kunden weitergefuehrten Objekt
     kommen die uebrigen Objekte AUS DEM STEUERPROFIL DES KUNDEN (sein Saldo), gesperrt keine. Der Cache des Partners
     (_cache) bleibt unberuehrt, ein Snapshot des Kundenobjekts aendert ihn nicht. */
  function _kontext() { try { var K = window.DpSteuerKontext; return (K && K.aktiv && K.aktiv()) ? K : null; } catch (e) { return null; } }
  function kGetAll() { var K = _kontext(); return K ? K.bestand() : getAllObjectsWithWK(); }
  function kOther(currentObjectId, year) {
    var K = _kontext(); if (!K) return getWKForOtherObjects(currentObjectId, year);
    return K.bestand(currentObjectId).reduce(function (s, o) { if (o.id === currentObjectId) return s; var w = o.wk_per_year && o.wk_per_year[String(year)]; return typeof w === 'number' ? s + w : s; }, 0);
  }
  function kTotal(year) {
    var K = _kontext(); if (!K) return getTotalWK(year);
    return K.bestand().reduce(function (s, o) { return s + (Number(o.wk_per_year && o.wk_per_year[String(year)]) || 0); }, 0);
  }
  function kSave(objectId, snapshot) {
    if (_kontext()) { if (window._currentObjData && snapshot) window._currentObjData.steuer_snapshot = snapshot; return; }
    return saveSnapshot(objectId, snapshot);
  }
  function kLoad(force) { var K = _kontext(); return K ? Promise.resolve({ objects: K.bestand(), kontext: true }) : loadAll(force); }

  window.DealPilotWKAggregator = {
    loadAll: kLoad,
    getWKForOtherObjects: kOther,
    getTotalWK: kTotal,
    getAllObjectsWithWK: kGetAll,
    saveSnapshot: kSave,
    clearCache: clearCache,
    status: function () { return _kontext() ? 'geladen' : _status; },          /* v3314 · N157 */
    fehler: function () { return _kontext() ? null : _fehler; },
    _roh: { loadAll: loadAll, getAllObjectsWithWK: getAllObjectsWithWK },   /* v3700 */
    _meta: 'V258-05'
  };

  /* ═══ v3314 · N157 · SIND DIE GRUNDLAGEN DER STEUER GELADEN? ══════════════
   *
   * Gemessen 11.11.2026 (Westerfeldstr., Staging): ein Speicherlauf rechnete, bevor
   * /tax-periods und /tax-snapshots geantwortet hatten - Rueckfall Feld-zvE ohne Saldo,
   * gespeichert wurde 10.185,16 statt 6.007,91 EUR Cashflow nach Steuern. Nichts sagte,
   * dass die Zahl auf halben Grundlagen stand.
   *
   * status():  'bereit' (beides da oder nicht angemeldet) | 'laedt' | 'fehler'
   * warten():  Promise auf das Ende des Ladens (Ereignisse, kein Polling); startet ein
   *            noch nicht begonnenes Laden selbst. Eine Frist von 20 s verhindert das
   *            Endloswarten - danach gilt 'fehler', und storage.js ueberschreibt nichts.
   * Ereignis dp:steuer-grundlagen bei jedem Wechsel des Gesamtstands (calc.js rechnet neu).
   * Leser: calc.js (State.kpis.steuer_vorlaeufig), storage.js (saveObj wartet, collectData). */
  (function () {
    function _angemeldet() {
      try {
        if (!window.Auth || typeof Auth.isLoggedIn !== 'function' || !Auth.isLoggedIn()) return false;
        if (typeof Auth.isApiMode === 'function' && !Auth.isApiMode()) return false;
        return !!getToken();
      } catch (e) { return false; }
    }
    function _teile() {
      var TP = window.DealPilotTaxPeriods;
      return { zeitraeume: (TP && typeof TP.status === 'function') ? TP.status() : 'geladen', snapshots: _kontext() ? 'geladen' : _status };   /* v3700 · Kontext: alles liegt im Objekt */
    }
    var _fristAbgelaufen = false;
    function status() {
      if (!_angemeldet()) return 'bereit';
      var t = _teile();
      if (t.zeitraeume === 'geladen' && t.snapshots === 'geladen') return 'bereit';
      if (_fristAbgelaufen) return 'fehler';
      if (t.zeitraeume === 'offen' || t.zeitraeume === 'laedt' || t.snapshots === 'offen' || t.snapshots === 'laedt') return 'laedt';
      return 'fehler';
    }
    function grund() {
      var t = _teile(), TP = window.DealPilotTaxPeriods, g = [];
      if (t.zeitraeume !== 'geladen') g.push('Steuerzeitraeume ' + t.zeitraeume + ((TP && TP.fehler && TP.fehler()) ? ' (' + TP.fehler() + ')' : ''));
      if (t.snapshots !== 'geladen') g.push('Snapshots ' + t.snapshots + (_fehler ? ' (' + _fehler + ')' : ''));
      if (_fristAbgelaufen) g.push('Frist abgelaufen');
      return g.join(', ') || 'geladen';
    }
    var _letzter = null;
    function _pruefen() {
      var s = status();
      if (s === 'laedt' || s === _letzter) return;
      _letzter = s;
      try { window.dispatchEvent(new CustomEvent('dp:steuer-grundlagen', { detail: { status: s, grund: grund() } })); } catch (e) {}
    }
    window.addEventListener('dp:steuerzeitraeume', _pruefen);
    window.addEventListener('dp:steuer-snapshots', _pruefen);
    function warten() {
      var s = status();
      if (s !== 'laedt') return Promise.resolve(s);
      try {
        var TP = window.DealPilotTaxPeriods, t = _teile();
        if (TP && t.zeitraeume === 'offen' && typeof TP.loadAll === 'function') TP.loadAll();
        if (t.snapshots === 'offen') loadAll(false);
      } catch (e) {}
      return new Promise(function (resolve) {
        var fertig = false, frist = null;
        function ende() {
          if (fertig || status() === 'laedt') return;
          fertig = true;
          if (frist) clearTimeout(frist);
          window.removeEventListener('dp:steuerzeitraeume', ende);
          window.removeEventListener('dp:steuer-snapshots', ende);
          resolve(status());
        }
        window.addEventListener('dp:steuerzeitraeume', ende);
        window.addEventListener('dp:steuer-snapshots', ende);
        frist = setTimeout(function () {
          if (fertig) return;
          _fristAbgelaufen = true;
          console.error('[v3314] Steuergrundlagen nach 20 s nicht geladen (' + grund() + ') - Speichern ohne neue Steuerzahl');
          _pruefen();
          ende();
        }, 20000);
      });
    }
    /* Kommen die Grundlagen spaeter doch noch, gilt die Frist nicht mehr */
    window.addEventListener('dp:steuer-grundlagen', function (e) {
      if (e && e.detail && e.detail.status === 'bereit') _fristAbgelaufen = false;
    });
    window.DpSteuerGrundlagen = { status: status, warten: warten, grund: grund, _meta: 'v3314' };
  })();

  // Beim Login/App-Start initial laden
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(loadAll, 500);
    });
  } else {
    setTimeout(loadAll, 500);
  }
})();
