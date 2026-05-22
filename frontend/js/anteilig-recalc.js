/* V268-07: Auto-Recalc + Default-Belegung für kaufdat/WU.
 *
 * Funktionen:
 *  1) Bei Änderung von #kaufdat oder #wirtschaftlicher_uebergang → calc() neu
 *  2) Default-Belegung von #wirtschaftlicher_uebergang nach loadData:
 *     - Bestand (kaufdat gesetzt, WU leer) → WU = kaufdat
 *     - Neu (beides leer) → WU = heute
 *  3) Wenn kaufdat geändert wird UND WU "noch nie manuell gesetzt" → WU folgt
 *
 * Marker dataset.v268UserSet = '1' merkt sich, ob User WU selbst angefasst hat.
 */
(function() {
  'use strict';

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  function applyDefaults(opts) {
    opts = opts || {};
    if (typeof window.DealPilotAnteilig !== 'object') return;
    var wu = document.getElementById('wirtschaftlicher_uebergang');
    if (!wu) return;
    if (wu.value) return; // schon gesetzt
    var fillToday = !!opts.fillToday;
    DealPilotAnteilig.ensureDefault({fillToday: fillToday});
  }

  function attach() {
    var kdEl = document.getElementById('kaufdat');
    var wuEl = document.getElementById('wirtschaftlicher_uebergang');

    if (kdEl && !kdEl.dataset.v268Recalc) {
      kdEl.dataset.v268Recalc = '1';
      kdEl.addEventListener('change', function() {
        // Wenn WU "noch nie manuell gesetzt" → WU folgt kaufdat
        if (wuEl && !wuEl.dataset.v268UserSet && kdEl.value) {
          wuEl.value = kdEl.value;
        }
        recalc();
      });
    }

    if (wuEl && !wuEl.dataset.v268Recalc) {
      wuEl.dataset.v268Recalc = '1';
      wuEl.addEventListener('change', function() {
        // User hat WU manuell angefasst → ab jetzt nicht mehr autom. folgen
        wuEl.dataset.v268UserSet = '1';
        recalc();
      });
      wuEl.addEventListener('input', function() {
        wuEl.dataset.v268UserSet = '1';
      });
    }
  }

  function recalc() {
    setTimeout(function() {
      if (typeof window.calc === 'function') {
        try { window.calc(); }
        catch(e) { console.warn('[V268-07] calc() Fehler:', e.message); }
      }
    }, 80);
  }

  /** Wird nach loadData aufgerufen. Setzt Default + attached Listener. */
  function postLoadHook() {
    var wuEl = document.getElementById('wirtschaftlicher_uebergang');
    if (!wuEl) return;
    // Markiere als "noch nicht user-gesetzt" — wird beim nächsten User-Input gesetzt
    delete wuEl.dataset.v268UserSet;
    // Default belegen (kaufdat oder heute)
    applyDefaults({fillToday: true});
    attach();
  }

  /** Wenn loadData verfügbar, hook reinpatchen */
  function hookLoadData() {
    if (typeof window.loadData !== 'function' || window._v268LoadHooked) return;
    var orig = window.loadData;
    window.loadData = function(d) {
      var ret = orig.apply(this, arguments);
      try { postLoadHook(); } catch(e) { console.warn('[V268-07] postLoadHook:', e.message); }
      return ret;
    };
    window._v268LoadHooked = true;
  }

  // Retry-Init: warte bis DOM + loadData ready
  var tries = 0;
  function init() {
    attach();
    hookLoadData();
    // Initial defaults (für neue Objekte / direkt nach Page-Load)
    applyDefaults({fillToday: true});
    var wuEl = document.getElementById('wirtschaftlicher_uebergang');
    if ((!wuEl || !wuEl.dataset.v268Recalc) && ++tries < 40) {
      setTimeout(init, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DealPilotAnteiligRecalc = {
    attach: attach,
    applyDefaults: applyDefaults,
    postLoadHook: postLoadHook,
    _meta: 'V268-07'
  };
})();
