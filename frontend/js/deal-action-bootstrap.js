/**
 * V165 — Deal-Aktion Bootstrap (extern, NICHT in IIFE)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Hintergrund: V160-V164 hatten alle Probleme mit dem Auto-Init
 * innerhalb der deal-action.js-IIFE. Timing-Probleme mit
 * document.readyState=complete, setTimeout(0) Race-Conditions etc.
 *
 * Lösung: separates Bootstrap-File das als letztes geladen wird
 * und init() einfach periodisch versucht bis es klappt — robust
 * gegen jedes Timing.
 *
 * Wird via <script src="js/deal-action-bootstrap.js"></script>
 * am Ende der index.html eingebunden (NACH deal-action.js).
 */
(function () {
  'use strict';

  var MAX_ATTEMPTS = 50;       // 5 Sekunden lang versuchen
  var INTERVAL_MS = 100;
  var attempts = 0;

  function tryInit() {
    attempts++;
    if (attempts > MAX_ATTEMPTS) {
      console.warn('[bootstrap V165] DealPilotDealAction.init() nach 5s nicht möglich — gebe auf');
      return;
    }

    // Alle Voraussetzungen?
    if (!window.DealPilotDealAction || typeof window.DealPilotDealAction.init !== 'function') {
      return setTimeout(tryInit, INTERVAL_MS);
    }
    if (!document.getElementById('s8')) {
      return setTimeout(tryInit, INTERVAL_MS);
    }

    // Alle da. Jetzt init()
    try {
      window.DealPilotDealAction.init();
      console.log('[bootstrap V165] DealPilotDealAction.init() erfolgreich (Versuch ' + attempts + ')');
    } catch (e) {
      console.error('[bootstrap V165] init() Exception:', e);
    }
  }

  // Starte sofort. Wenn Doc noch nicht ready, wartet tryInit() via Retry.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

  // Zusätzlich: bei JEDEM Klick auf einen Tab nochmal init() versuchen
  // (idempotent durch internes initDone-Flag in V161+)
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.tab');
    if (!t) return;
    setTimeout(function () {
      var s8 = document.getElementById('s8');
      if (s8 && s8.innerHTML.length < 1000 && window.DealPilotDealAction) {
        try { window.DealPilotDealAction.init(); } catch (e) {}
        try { window.DealPilotDealAction.ensureRendered && window.DealPilotDealAction.ensureRendered(); } catch (e) {}
      }
    }, 80);
  }, true);
})();
