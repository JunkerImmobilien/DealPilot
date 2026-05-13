/**
 * V173 — Plan-basierte UI-Visibility (erweitert)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Versteckt UI-Elemente abhängig vom aktiven Plan.
 *
 * Free-Plan:
 *   - Investor DealScore Ribbon (sbc-investor-ribbon)
 *   - Investor-Badge OHNE Demo-Marker
 *
 * Starter-Plan:
 *   - Investor-Ribbon und -Badge
 *   - Score-Overlays
 *
 * Aktiver Plan wird als data-Attribut auf <body> gesetzt.
 */
(function () {
  'use strict';

  function getCurrentPlanKey() {
    try {
      var cur = window.DealPilotConfig && DealPilotConfig.pricing.current();
      return cur && cur.key ? cur.key : 'free';
    } catch (e) { return 'free'; }
  }

  function applyPlanVisibility() {
    var plan = getCurrentPlanKey();
    document.body.setAttribute('data-dp-plan', plan);
    _injectHideStyles();
  }

  function _injectHideStyles() {
    if (document.getElementById('dp-plan-hide-style')) return;
    var style = document.createElement('style');
    style.id = 'dp-plan-hide-style';
    style.textContent = [
      // FREE
      'body[data-dp-plan="free"] .sbc-investor-ribbon { display: none !important; }',
      'body[data-dp-plan="free"] .sc-investor-badge:not(.sc-demo-badge) { display: none !important; }',
      // STARTER
      'body[data-dp-plan="starter"] .sbc-investor-ribbon { display: none !important; }',
      'body[data-dp-plan="starter"] .sc-investor-badge { display: none !important; }',
      'body[data-dp-plan="starter"] .sbc-score-overlay { display: none !important; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function init() {
    applyPlanVisibility();
    setTimeout(applyPlanVisibility, 1500);
    setTimeout(applyPlanVisibility, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DealPilotPlanVisibility = {
    apply: applyPlanVisibility
  };

  console.log('[plan-visibility V173] aktiv');
})();
