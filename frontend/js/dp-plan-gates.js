/* ============================================================================
   DealPilot v874 – dp-plan-gates.js
   Plan-Gates fuer UI-Elemente, die (noch) zentral gerendert werden:
   - "Export" im Aktionen-Menue ist NUR im Pro-Plan verfuegbar -> fuer
     Free/Starter/Investor ausgeblendet (Datenexport ist Pro-Feature).
   ============================================================================ */
(function () {
  'use strict';
  function planKey() {
    try {
      if (window.DealPilotConfig && window.DealPilotConfig.pricing &&
          typeof window.DealPilotConfig.pricing.currentKey === 'function') {
        return window.DealPilotConfig.pricing.currentKey() || 'free';
      }
    } catch (e) {}
    return 'free';
  }
  function apply() {
    try {
      if (planKey() === 'pro') return;
      var acc = document.getElementById('sb-actions-accordion');
      var root = acc || document.body;
      var els = root.querySelectorAll('button, a, .sb-act-item, [onclick], span, div');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.children.length > 1) continue;
        if ((el.textContent || '').trim() !== 'Export') continue;
        if (!el.closest || !el.closest('#sb-actions-accordion')) continue;
        var row = el.closest('button, a, .sb-act-item, [onclick]') || el;
        row.style.setProperty('display', 'none', 'important');
      }
    } catch (e) {}
  }
  function boot() {
    apply();
    try {
      new MutationObserver(function () { apply(); })
        .observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
