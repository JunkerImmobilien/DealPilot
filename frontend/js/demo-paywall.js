'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT – demo-paywall.js
   - Demo-Modus mit Beispiel-Objekt (sofort sichtbar)
   - Free-Plan-Paywall: Limits anzeigen, blurred features
═══════════════════════════════════════════════════ */

var DemoMode = (function() {

  // Beispiel-Objekt für Demo
  var DEMO_OBJECT = {
    _name: 'DEMO – Musterstraße 12, Musterstadt',
    plz: '12345',
    ort: 'Musterstadt',
    str: 'Musterstraße',
    hnr: '12',
    objart: 'ETW',
    wfl: '96',
    baujahr: '1995',
    kaufdat: new Date().toISOString().slice(0, 10),
    // Investition
    kp: '200000',
    nk_proz: '1.5',
    grerw_proz: '6.5',
    makler_proz: '3.57',
    san: '0',
    bankval: '250000',
    svwert: '250000',
    // Miete
    nkm: '800',
    ze: '50',
    umlagef: '150',
    // BWK
    hg_total: '2000',
    hg_nul: '1500',
    weg_r: '800',
    eigen_r: '0',
    mietausfall: '50',
    nul_sonst: '0',
    // Steuer
    zve: '50000',
    grenz: '40.45',
    afa_satz: '2.0',
    geb_ant: '80',
    // Finanzierung
    bank_inst: 'Beispiel-Bank',
    d1_vertrag: 'KD-2025-DEMO',
    ek: '20000',
    d1: '200000',
    d1z: '3.50',
    d1t: '1.00',
    d1_bindj: '10',
    zsatz_an: '5.0',
    // Prognosen
    mietstg: '1.5',
    wertstg: '2.0'
  };

  function isDemoActive() {
    return localStorage.getItem('dp_demo_active') === '1';
  }

  function activate() {
    localStorage.setItem('dp_demo_active', '1');
    if (typeof loadData === 'function') {
      loadData(DEMO_OBJECT);
      setTimeout(function() {
        if (typeof calc === 'function') calc();
        if (typeof toast === 'function') toast('✓ Demo-Modus aktiviert – Beispiel-Objekt geladen');
      }, 100);
    }
  }

  function deactivate() {
    localStorage.removeItem('dp_demo_active');
    if (typeof newObj === 'function') newObj();
  }

  /**
   * Show a banner offering demo mode if user hasn't entered any data yet.
   */
  function maybeShowDemoBanner() {
    // V42: Demo-Banner komplett deaktiviert
    var bannerExists = document.getElementById('demo-banner');
    if (bannerExists) bannerExists.remove();
    return;
  }

  function _renderDemoBanner() {
    var sec = document.querySelector('.sec.active');
    if (!sec) return;
    var banner = document.createElement('div');
    banner.id = 'demo-banner';
    banner.className = 'demo-banner';
    banner.innerHTML =
      '<div class="demo-banner-icon">🚀</div>' +
      '<div class="demo-banner-content">' +
        '<div class="demo-banner-title">Direkt loslegen mit einem Beispiel-Objekt</div>' +
        '<div class="demo-banner-sub">Lade unser Demo-Objekt (ETW Beispiel, 200k €) und sieh sofort wie Dealpilot funktioniert.</div>' +
      '</div>' +
      '<button class="btn btn-gold" onclick="DemoMode.activate()">Demo laden</button>' +
      '<button class="demo-banner-close" onclick="document.getElementById(\'demo-banner\').remove()" title="Schließen">×</button>';
    sec.insertBefore(banner, sec.firstChild);
  }

  return {
    activate: activate,
    deactivate: deactivate,
    isDemoActive: isDemoActive,
    maybeShowDemoBanner: maybeShowDemoBanner,
    DEMO_OBJECT: DEMO_OBJECT
  };
})();

// Auto-show demo banner on first load if no data
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof DemoMode !== 'undefined') DemoMode.maybeShowDemoBanner();
  }, 1500);
});

// ═══════════════════════════════════════════════════
// PAYWALL UX – Limits sichtbar + Upgrade-Hinweise
// ═══════════════════════════════════════════════════

var Paywall = (function() {

  // Free Plan Limits
  // FREE_LIMITS jetzt dynamisch aus DealPilotConfig (Plan-aware)
  function _getLimits() {
    if (window.DealPilotConfig && DealPilotConfig.pricing) {
      var plan = DealPilotConfig.pricing.current();
      var l = plan.limits || {};
      // Map config keys to legacy metric keys used in Paywall code
      return {
        objects:     l.objects,
        calculations: l.calc_per_mo,
        ai_calls:    l.ai_per_mo,
        exports:     l.exports_per_mo,
        watermark:   !!l.watermark
      };
    }
    return { objects: 1, calculations: 3, ai_calls: 1, exports: 3, watermark: true };
  }
  // legacy alias
  var FREE_LIMITS = new Proxy({}, {
    get: function(_, key) { return _getLimits()[key]; }
  });

  /**
   * Render the usage badge in the sidebar (above the user-section).
   */
  async function renderUsageBadge() {
    // V27: Wenn der User einen bezahlten Plan hat (kein "free"), zeigen wir den Banner gar nicht.
    var planKey = 'free';
    if (typeof Sub !== 'undefined' && Sub.isApiMode && Sub.isApiMode()) {
      try {
        var s = await Sub.getCurrent();
        if (s && s.plan_id) planKey = s.plan_id;
      } catch (e) {}
    } else if (typeof DealPilotConfig !== 'undefined' && DealPilotConfig.pricing) {
      planKey = DealPilotConfig.pricing.currentKey() || 'free';
    }
    var existingBadge = document.getElementById('paywall-usage');
    if (planKey !== 'free') {
      // Bezahlter Plan → Banner muss weg
      if (existingBadge) existingBadge.remove();
      return;
    }

    var container = existingBadge;
    if (!container) {
      // V27: An User-Box im Footer einhängen (statt oben in der Sidebar).
      var sbUser = document.getElementById('sb-user');
      if (!sbUser) {
        setTimeout(renderUsageBadge, 800);
        return;
      }
      container = document.createElement('div');
      container.id = 'paywall-usage';
      sbUser.parentNode.insertBefore(container, sbUser);
    }

    // Get usage (try API, fall back to localStorage simulation)
    var usage = { objects: 0, calculations: 0, ai_calls: 0, exports: 0 };
    try {
      if (typeof Auth !== 'undefined' && Auth.isApiMode()) {
        // Backend usage
        try {
          var resp = await Auth.apiCall('/users/me/usage');
          usage = Object.assign(usage, resp || {});
        } catch (e) {}
      }
    } catch (e) {}

    // Local fallback
    var localCalcs = parseInt(localStorage.getItem('dp_local_calc_count') || '0');
    if (localCalcs > usage.calculations) usage.calculations = localCalcs;

    var calcRem = Math.max(0, FREE_LIMITS.calculations - usage.calculations);
    var aiRem = Math.max(0, FREE_LIMITS.ai_calls - usage.ai_calls);
    var expRem = Math.max(0, FREE_LIMITS.exports - usage.exports);

    var allUsed = (calcRem === 0 && aiRem === 0 && expRem === 0);

    var allUsed_class = allUsed ? ' pw-compact-warn' : '';
    container.innerHTML =
      '<div class="pw-compact' + allUsed_class + '" onclick="Paywall.showUpgradeModal()" title="Free Plan – Klick für Details">' +
        '<span class="pw-compact-label">FREE</span>' +
        '<span class="pw-compact-counter">' + usage.calculations + '/' + FREE_LIMITS.calculations + ' · ' +
          usage.ai_calls + '/' + FREE_LIMITS.ai_calls + ' · ' +
          usage.exports + '/' + FREE_LIMITS.exports +
        '</span>' +
        '<span class="pw-compact-arrow">⬆</span>' +
        // Hover popover with full info
        '<div class="pw-popover">' +
          '<div class="pw-pop-title">Free Plan · diesen Monat</div>' +
          '<div class="pw-row"><span>Berechnungen</span><span class="' + (calcRem === 0 ? "pw-empty" : "") + '">' + usage.calculations + ' / ' + FREE_LIMITS.calculations + '</span></div>' +
          '<div class="pw-row"><span>KI-Analysen</span><span class="' + (aiRem === 0 ? "pw-empty" : "") + '">' + usage.ai_calls + ' / ' + FREE_LIMITS.ai_calls + '</span></div>' +
          '<div class="pw-row"><span>Exporte</span><span class="' + (expRem === 0 ? "pw-empty" : "") + '">' + usage.exports + ' / ' + FREE_LIMITS.exports + '</span></div>' +
          (allUsed ? "<div class=\"pw-limit-msg\">Limit erreicht</div>" : "") +
          '<div class="pw-pop-cta">Klick für Upgrade ⬆</div>' +
        '</div>' +
      '</div>';
  }

  /**
   * Track a usage event (calculation, ai_call, export).
   * Backend is authoritative if available, but we also track locally.
   */
  async function trackUsage(metric) {
    // Local
    var key = 'dp_local_' + metric + '_count';
    var current = parseInt(localStorage.getItem(key) || '0');
    localStorage.setItem(key, current + 1);

    // Backend
    try {
      if (typeof Auth !== 'undefined' && Auth.isApiMode()) {
        await Auth.apiCall('/users/me/usage', {
          method: 'POST',
          body: { metric: metric, increment: 1 }
        });
      }
    } catch (e) {
      // Backend may not have endpoint yet, OK
    }

    setTimeout(renderUsageBadge, 200);
  }

  /**
   * Check if a feature is locked (limit reached).
   */
  function isLocked(metric) {
    // Dev-Flags: KI / Exporte können freigegeben sein
    if (window.DealPilotConfig && DealPilotConfig.dev && DealPilotConfig.dev.isDev()) {
      var f = DealPilotConfig.dev.flags || {};
      if (metric === 'ai_calls' && f.ALLOW_AI_ANALYSIS_IN_DEV) return false;
      if (metric === 'exports'  && f.ALLOW_EXPORTS_IN_DEV)    return false;
    }
    var limit = _getLimits()[metric];
    if (limit == null) return false;
    if (limit === -1) return false;  // unlimited
    var local = parseInt(localStorage.getItem('dp_local_' + metric + '_count') || '0');
    return local >= limit;
  }

  /**
   * Wrap an action with paywall check.
   */
  function gate(metric, action) {
    if (isLocked(metric)) {
      showLimitReachedModal(metric);
      return false;
    }
    trackUsage(metric);
    if (typeof action === 'function') action();
    return true;
  }

  function showLimitReachedModal(metric) {
    var existing = document.getElementById('limit-modal');
    if (existing) existing.remove();
    var labels = {
      calculations: 'Berechnungs-Limit',
      ai_calls: 'KI-Analyse-Limit',
      exports: 'Export-Limit'
    };
    var modal = document.createElement('div');
    modal.id = 'limit-modal';
    modal.className = 'global-view-overlay';
    modal.innerHTML =
      '<div class="global-view-modal" style="max-width:480px;text-align:center">' +
        '<button class="pricing-close" onclick="document.getElementById(\'limit-modal\').remove()">×</button>' +
        '<div style="font-size:64px;margin-bottom:12px">🔒</div>' +
        '<h2 style="margin-bottom:6px">' + (labels[metric] || 'Limit') + ' erreicht</h2>' +
        '<p style="color:var(--muted);font-size:13px;margin-bottom:18px">' +
          'Im Free Plan sind ' + FREE_LIMITS[metric] + ' ' + (labels[metric] || metric) + ' pro Monat enthalten.<br>' +
          'Mit einem Upgrade nutzt du Dealpilot ohne Limits.' +
        '</p>' +
        '<button class="btn btn-gold" style="font-size:14px;padding:12px 24px" onclick="document.getElementById(\'limit-modal\').remove();showUpgradeModal()">⬆ Jetzt upgraden</button>' +
      '</div>';
    document.body.appendChild(modal);
  }

  function showUpgradeModal() {
    var existing = document.getElementById('upgrade-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.className = 'global-view-overlay';
    modal.innerHTML =
      '<div class="global-view-modal" style="max-width:560px">' +
        '<button class="pricing-close" onclick="document.getElementById(\'upgrade-modal\').remove()">×</button>' +
        '<h2>⬆ Dealpilot Premium</h2>' +
        '<p style="color:var(--muted);font-size:13px;margin-bottom:18px">' +
          'Bezahl-Pläne werden in Kürze freigeschaltet. Trag dich gerne unverbindlich vor:' +
        '</p>' +
        '<div class="upgrade-features">' +
          '<div class="up-feat">✓ Unbegrenzte Objekte</div>' +
          '<div class="up-feat">✓ Unbegrenzte Berechnungen</div>' +
          '<div class="up-feat">✓ Unbegrenzte KI-Analysen</div>' +
          '<div class="up-feat">✓ Exporte ohne Wasserzeichen</div>' +
          '<div class="up-feat">✓ Portfolio-Tracking</div>' +
          '<div class="up-feat">✓ Bank-PDFs in Premium-Layout</div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:18px">' +
          '<a class="btn btn-gold" href="mailto:info@junker-immobilien.io?subject=Dealpilot Premium Interesse" style="text-decoration:none">📧 Interesse bekunden</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  return {
    renderUsageBadge: renderUsageBadge,
    trackUsage: trackUsage,
    isLocked: isLocked,
    gate: gate,
    showLimitReachedModal: showLimitReachedModal,
    showUpgradeModal: showUpgradeModal,
    FREE_LIMITS: FREE_LIMITS
  };
})();

// Expose globally
window.DemoMode = DemoMode;
window.Paywall = Paywall;
window.showUpgradeModal = Paywall.showUpgradeModal;

// Render usage badge on load + after login
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() { Paywall.renderUsageBadge(); }, 1500);
});
