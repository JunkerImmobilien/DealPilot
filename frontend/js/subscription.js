'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – subscription.js V10
   Frontend subscription state & UI

   Provides:
   - Sub.getCurrent()       → current user's subscription + limits + usage
   - Sub.listPlans()        → public plans (for pricing page)
   - Sub.startCheckout()    → redirect to Stripe Checkout
   - Sub.openPortal()       → redirect to Stripe Customer Portal
   - Sub.trackUsage()       → call before AI/PDF actions
   - Sub.canDo()            → quick check if action is within limits
   - showPricingModal()     → opens pricing UI

   Works in both API and local mode (local = always Free plan, no purchase).
═══════════════════════════════════════════════════ */

var Sub = (function() {
  var _cache = null;
  var _cacheTime = 0;
  var CACHE_TTL_MS = 30 * 1000;  // 30 seconds

  function isApiMode() {
    return typeof Auth !== 'undefined' && Auth.isApiMode();
  }

  /**
   * Get current subscription from backend.
   * In local mode: always returns synthetic Free plan.
   */
  async function getCurrent(forceFresh) {
    // V63.2: Im Dev-Mode (oder wenn Plan-Override gesetzt) → direkt aus DealPilotConfig.pricing lesen
    // (sonst zeigt die Sidebar-Pill den DB-Plan, nicht den lokal überschriebenen)
    if (window.DealPilotConfig && window.DealPilotConfig.pricing) {
      var override = null;
      try { override = localStorage.getItem('dp_plan_override'); } catch(e) {}
      if (override || !isApiMode()) {
        var currentKey = window.DealPilotConfig.pricing.currentKey();
        var currentPlan = window.DealPilotConfig.pricing.get(currentKey);
        if (currentPlan) {
          return {
            plan_id: currentKey,
            plan_name: currentPlan.label,
            plan_features: currentPlan.features || {},
            billing_interval: 'monthly',
            status: 'active',
            is_active: true,
            synthetic: true,
            local_mode: !isApiMode(),
            override: !!override,
            limits: currentPlan.limits || {},
            usage: {}
          };
        }
      }
    }

    if (!isApiMode()) {
      return {
        plan_id: 'free',
        plan_name: 'Free',
        plan_features: { ai_analysis: true, pdf_export: true, watermark: false, export_csv: true },
        billing_interval: null,
        status: 'active',
        is_active: true,
        synthetic: true,
        local_mode: true,
        limits: {},
        usage: {}
      };
    }

    if (!forceFresh && _cache && (Date.now() - _cacheTime) < CACHE_TTL_MS) {
      return _cache;
    }

    try {
      var resp = await Auth.apiCall('/subscription');
      _cache = resp.subscription;
      _cacheTime = Date.now();
      return _cache;
    } catch (e) {
      console.warn('Subscription endpoint not available:', e.message);
      return {
        plan_id: 'free', plan_name: 'Free',
        is_active: true, synthetic: true,
        limits: {}, usage: {}
      };
    }
  }

  function clearCache() { _cache = null; _cacheTime = 0; }
  function invalidateCache() { clearCache(); }

  async function listPlans() {
    if (!isApiMode()) return [];
    try {
      var resp = await Auth.apiCall('/plans');
      return resp.plans || [];
    } catch (e) { return []; }
  }

  /**
   * Start Stripe Checkout flow.
   * Redirects browser to Stripe.
   */
  async function startCheckout(planId, billingInterval) {
    if (!isApiMode()) {
      throw new Error('Abo-Buchung erfordert eine Backend-Verbindung');
    }
    var resp = await Auth.apiCall('/subscription/checkout', {
      method: 'POST',
      body: {
        planId: planId,
        billingInterval: billingInterval,
        successUrl: location.origin + location.pathname + '?subscription=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl:  location.origin + location.pathname + '?subscription=cancel'
      }
    });
    location.href = resp.url;
  }

  /**
   * Open Stripe Customer Portal (manage subscription, invoices, etc.)
   */
  async function openPortal() {
    if (!isApiMode()) throw new Error('Backend erforderlich');
    var resp = await Auth.apiCall('/subscription/portal', {
      method: 'POST',
      body: { returnUrl: location.href }
    });
    location.href = resp.url;
  }

  /**
   * Track usage of a metered action.
   * Returns { ok: true } on success, throws if limit reached (caller should show upgrade prompt).
   */
  async function trackUsage(metric) {
    if (!isApiMode()) return { ok: true };  // no enforcement in local mode
    try {
      var resp = await Auth.apiCall('/objects/track-usage', {
        method: 'POST',
        body: { metric: metric }
      });
      clearCache();
      return resp;
    } catch (e) {
      if (e.status === 403 && e.data && e.data.upgrade_required) {
        showUpgradePrompt(metric, e.data);
      }
      throw e;
    }
  }

  /**
   * Quick check: can the user perform this action without hitting a limit?
   * Returns { allowed, current, limit, plan_id, message }.
   */
  async function canDo(metric) {
    var sub = await getCurrent();
    var limitField, currentField;
    if (metric === 'ai_analysis') {
      limitField = 'max_ai_analyses_monthly';
      currentField = 'ai_analysis';
    } else if (metric === 'pdf_export') {
      limitField = 'max_pdf_exports_monthly';
      currentField = 'pdf_export';
    } else if (metric === 'object') {
      limitField = 'max_objects';
    } else {
      return { allowed: true };
    }
    var limit = sub.limits[limitField];
    if (limit == null) return { allowed: true, plan_id: sub.plan_id };

    var current;
    if (metric === 'object') {
      // Need to count current objects from sidebar (or call list endpoint)
      var sbItems = document.querySelectorAll('.sb-item').length;
      current = sbItems;
    } else {
      current = sub.usage[currentField] || 0;
    }
    var allowed = current < limit;
    return {
      allowed: allowed,
      current: current,
      limit: limit,
      plan_id: sub.plan_id,
      message: allowed ? null : `Limit erreicht: ${current}/${limit} pro Monat (${sub.plan_name}-Plan)`
    };
  }

  /**
   * Has feature flag X?
   */
  async function hasFeature(featureKey) {
    var sub = await getCurrent();
    return Boolean(sub.plan_features && sub.plan_features[featureKey]);
  }

  return {
    getCurrent: getCurrent,
    /**
     * V96: Synchroner Cache-Read für UI-Komponenten die nicht awaiten können
     * (Sidebar-Pill, Plan-Anzeige in Settings, getCurrentPlanKey() in config.js).
     * Liefert plan_id-String wenn ein Cache vorhanden ist, sonst null.
     * Muss VORHER mindestens einmal getCurrent() awaited haben damit Cache gefüllt ist.
     */
    getCurrentSync: function() {
      if (_cache && _cache.plan_id) return _cache.plan_id;
      return null;
    },
    clearCache: clearCache,
    invalidateCache: invalidateCache,
    listPlans: listPlans,
    startCheckout: startCheckout,
    openPortal: openPortal,
    trackUsage: trackUsage,
    canDo: canDo,
    hasFeature: hasFeature,
    isApiMode: isApiMode
  };
})();

// ═══════════════════════════════════════════════════
// PRICING / UPGRADE UI
// ═══════════════════════════════════════════════════

async function showPricingModal() {
  var existing = document.getElementById('pricing-modal');
  if (existing) existing.remove();

  if (!Sub.isApiMode()) {
    if (typeof toast === 'function') toast('Abos sind nur im Backend-Modus verfügbar');
    return;
  }

  var [plans, current] = await Promise.all([Sub.listPlans(), Sub.getCurrent()]);
  if (!plans.length) {
    if (typeof toast === 'function') toast('⚠ Pläne konnten nicht geladen werden');
    return;
  }

  // V24: Toggle-Anzeige aus Config (parametrierbar)
  var payCfg = (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.payment)
               ? DealPilotConfig.pricing.payment() : {};
  var saveBadge = payCfg.yearly_discount_label || '~17% gespart';
  var showYearly = payCfg.show_yearly_toggle !== false;

  var modal = document.createElement('div');
  modal.id = 'pricing-modal';
  modal.className = 'pricing-overlay';
  modal.innerHTML =
    '<div class="pricing-modal">' +
      '<div class="pricing-header">' +
        '<h2>Wähle deinen Plan</h2>' +
        (showYearly ?
          '<div class="pricing-toggle">' +
            '<button class="active" data-int="monthly" onclick="togglePricingInterval(\'monthly\')">Monatlich</button>' +
            '<button data-int="yearly" onclick="togglePricingInterval(\'yearly\')">Jährlich <span class="save-badge">' + saveBadge + '</span></button>' +
          '</div>'
          : ''
        ) +
        '<button class="pricing-close" onclick="document.getElementById(\'pricing-modal\').remove()">×</button>' +
      '</div>' +
      '<div class="pricing-grid" id="pricing-grid">' +
        plans.map(function(p) { return renderPlanCard(p, current, 'monthly'); }).join('') +
      '</div>' +
      (current.plan_id !== 'free' ?
        '<div class="pricing-portal"><a href="#" onclick="Sub.openPortal();return false">Abo verwalten →</a></div>' :
        ''
      ) +
    '</div>';
  document.body.appendChild(modal);
  window._pricingPlans = plans;
  window._pricingCurrent = current;
}

function togglePricingInterval(interval) {
  document.querySelectorAll('.pricing-toggle button').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-int') === interval);
  });
  var grid = document.getElementById('pricing-grid');
  if (grid && window._pricingPlans) {
    grid.innerHTML = window._pricingPlans.map(function(p) {
      return renderPlanCard(p, window._pricingCurrent, interval);
    }).join('');
  }
}

function renderPlanCard(plan, current, interval) {
  var price = interval === 'yearly' ? plan.price_yearly_cents : plan.price_monthly_cents;
  var priceFmt = price === 0 ? 'Kostenlos' : (price / 100).toFixed(0) + ' €';
  var priceUnit = price === 0 ? '' : (interval === 'yearly' ? ' / Jahr' : ' / Monat');
  var monthly = interval === 'yearly' && price > 0
    ? '<div class="plan-monthly">~ ' + (price / 100 / 12).toFixed(0) + ' € / Monat</div>'
    : '';

  // V24: Im "manual"-Provider-Modus zeigen wir alle bezahlten Pläne als
  // "Kontakt aufnehmen" — kein Stripe-Click. Im "stripe"-Modus prüfen wir
  // ob Stripe-IDs existieren.
  var payCfg = (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.payment)
               ? DealPilotConfig.pricing.payment() : { provider: 'manual' };
  var canBuy = (interval === 'monthly' ? plan.has_stripe_monthly : plan.has_stripe_yearly);
  var isCurrent = current && current.plan_id === plan.id && current.is_active;
  var isFree = plan.id === 'free';
  var manualMode = (payCfg.provider === 'manual');

  var btn;
  if (isCurrent) {
    btn = '<button class="plan-btn current" disabled>Dein aktueller Plan</button>';
  } else if (isFree) {
    // V198: Free-Plan ist immer erreichbar (Downgrade) — nicht mehr "Standard/disabled"
    if (current && current.plan_id !== 'free' && current.is_active) {
      btn = '<button class="plan-btn secondary" onclick="handleDowngradeToFree()">Downgrade auf Free</button>';
    } else {
      btn = '<button class="plan-btn free" disabled>Standard</button>';
    }
  } else if (manualMode) {
    // V198: Manual-Upgrade-Button — verhindert mailto-Hang durch sauberes Try/Catch
    btn = '<button class="plan-btn primary" onclick="handleManualUpgradeSafe(\'' + plan.id + '\', \'' + interval + '\')">Anfragen per E-Mail</button>';
  } else if (!canBuy) {
    btn = '<button class="plan-btn unavailable" disabled>Bald verfügbar</button>';
  } else {
    btn = '<button class="plan-btn primary" onclick="handlePlanPurchase(\'' + plan.id + '\', \'' + interval + '\')">Auswählen</button>';
  }

  var features = plan.features || {};
  var limits = [];
  limits.push('<li>' + (plan.max_objects == null ? '∞' : plan.max_objects) + ' Kalkulationsobjekte</li>');
  if (plan.max_users != null) limits.push('<li>' + plan.max_users + ' Benutzer</li>');
  limits.push('<li>' + (plan.max_ai_analyses_monthly == null ? '∞' : plan.max_ai_analyses_monthly) + ' KI-Analysen / Monat</li>');
  limits.push('<li>' + (plan.max_pdf_exports_monthly == null ? '∞' : plan.max_pdf_exports_monthly) + ' PDF-Exporte / Monat</li>');
  limits.push('<li>' + (plan.max_photo_uploads_per_object == null ? '∞' : plan.max_photo_uploads_per_object) + ' Fotos pro Objekt</li>');
  if (features.watermark === false) limits.push('<li>Ohne Wasserzeichen im PDF</li>');
  if (features.advanced_charts) limits.push('<li>Erweiterte Charts</li>');
  if (features.investment_thesis_ai) limits.push('<li>KI-Investment-These</li>');
  if (features.live_market_rates) limits.push('<li>Live-Marktdaten</li>');
  if (features.team_collaboration) limits.push('<li>Team-Zusammenarbeit</li>');
  if (features.custom_branding) limits.push('<li>Eigenes Branding</li>');
  if (features.api_access) limits.push('<li>API-Zugang</li>');
  if (features.whitelabel) limits.push('<li>White-Label</li>');
  if (features.support) limits.push('<li>Support: ' + features.support + '</li>');

  // V24: Highlight aus DB-Feld 'highlight' (Backend) bzw. plan.highlight
  var highlight = plan.highlight ? ' plan-highlight' : '';
  var ribbon = plan.highlight ? '<div class="plan-ribbon">Beliebt</div>' : '';
  var subtitle = plan.tagline || plan.description || '';

  return '<div class="plan-card' + highlight + (isCurrent ? ' plan-current' : '') + '">' +
    ribbon +
    '<div class="plan-name">' + plan.name + '</div>' +
    (subtitle ? '<div class="plan-desc">' + subtitle + '</div>' : '') +
    '<div class="plan-price">' + priceFmt + '<span>' + priceUnit + '</span></div>' +
    monthly +
    '<ul class="plan-features">' + limits.join('') + '</ul>' +
    btn +
    '</div>';
}

/**
 * V24: Manueller Upgrade-Flow (Provider 'manual') — öffnet einen mailto-Link
 * an den Admin, weil keine echte Bezahlung stattfindet.
 */
function handleManualUpgrade(planId, interval) {
  var b = (window.DealPilotConfig && DealPilotConfig.branding) ? DealPilotConfig.branding.get() : {};
  var to = b.email || 'admin@dealpilot.local';
  var subject = encodeURIComponent('Plan-Upgrade-Anfrage: ' + planId + ' (' + interval + ')');
  var body = encodeURIComponent(
    'Hallo,\n\n' +
    'ich möchte gerne auf den Plan "' + planId + '" (' + interval + ') wechseln.\n\n' +
    'Mein Account:  ' + (Auth && Auth.getUser ? (Auth.getUser() || {}).email : '') + '\n\n' +
    'Bitte einmal manuell aktivieren.\n\nDanke!'
  );
  window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
  if (typeof toast === 'function') toast('✓ Email-Anfrage geöffnet — der Admin schaltet deinen Plan frei');
}

/**
 * V198: Sichere Variante von handleManualUpgrade. Zeigt zuerst ein Modal
 * mit der Email-Adresse + Copy-Button. Verhindert mailto-Hang wenn kein
 * Mail-Client gesetzt ist. User kann manuell den Inhalt copy-pasten.
 */
function handleManualUpgradeSafe(planId, interval) {
  try {
    var b = (window.DealPilotConfig && DealPilotConfig.branding) ? DealPilotConfig.branding.get() : {};
    var to = b.email || 'dealpilot@junker-immobilien.io';
    var user = (Auth && Auth.getUser) ? (Auth.getUser() || {}) : {};
    var planLabel = planId.charAt(0).toUpperCase() + planId.slice(1);
    var intervalLabel = (interval === 'yearly') ? 'Jahresabo' : 'Monatsabo';
    var subject = 'Plan-Upgrade-Anfrage: ' + planLabel + ' (' + intervalLabel + ')';
    var body =
      'Hallo,\n\n' +
      'ich möchte gerne auf den Plan "' + planLabel + '" (' + intervalLabel + ') wechseln.\n\n' +
      'Mein Account:  ' + (user.email || '–') + '\n' +
      'Account-Name: ' + (user.name || '–') + '\n\n' +
      'Bitte einmal manuell aktivieren.\n\nDanke!';

    var mailto = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) +
                 '&body=' + encodeURIComponent(body);

    // Modal mit Copy-Button (verhindert mailto-Hang)
    var existing = document.getElementById('v198-plan-mail-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'v198-plan-mail-modal';
    modal.innerHTML =
      '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:#fff;border-radius:12px;max-width:560px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.4)">' +
          '<h3 style="margin:0 0 16px;color:#2A2727;font-size:18px">Plan-Wechsel zu ' + _escAttr(planLabel) + '</h3>' +
          '<p style="margin:0 0 14px;color:#7A7370;font-size:13.5px;line-height:1.5">Plan-Wechsel läuft aktuell manuell per Email. Bitte sende uns folgende Nachricht — wir schalten dich umgehend frei.</p>' +
          '<div style="background:#F8F6F1;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;color:#2A2727;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;max-height:200px;overflow-y:auto">' +
            'An: <strong>' + _escAttr(to) + '</strong>\nBetreff: <strong>' + _escAttr(subject) + '</strong>\n\n' + _escAttr(body) +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button onclick="v198CopyMailBody(this)" data-mail-body="' + _escAttr(body) + '" data-mail-to="' + _escAttr(to) + '" data-mail-subject="' + _escAttr(subject) + '" class="btn btn-gold" style="flex:1;min-width:140px">📋 Inhalt kopieren</button>' +
            '<a href="' + _escAttr(mailto) + '" class="btn btn-outline" style="flex:1;min-width:140px;text-align:center;text-decoration:none" onclick="setTimeout(function(){var m=document.getElementById(\'v198-plan-mail-modal\');if(m)m.remove();},500)">📧 Mail-App öffnen</a>' +
            '<button onclick="document.getElementById(\'v198-plan-mail-modal\').remove()" class="btn btn-ghost" style="flex:0;min-width:80px">Schließen</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  } catch (e) {
    console.error('[v198 plan-upgrade-safe]', e);
    if (typeof toast === 'function') toast('⚠ Fehler beim Öffnen: ' + e.message);
  }
}

// V198: Copy-to-Clipboard für Mail-Inhalt
function v198CopyMailBody(btn) {
  try {
    var to = btn.dataset.mailTo;
    var subj = btn.dataset.mailSubject;
    var body = btn.dataset.mailBody;
    var fullText = 'An: ' + to + '\nBetreff: ' + subj + '\n\n' + body;
    navigator.clipboard.writeText(fullText).then(function() {
      btn.textContent = '✓ Kopiert!';
      setTimeout(function() { btn.textContent = '📋 Inhalt kopieren'; }, 2000);
    }, function() {
      // Fallback: textarea select
      var ta = document.createElement('textarea');
      ta.value = fullText;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); btn.textContent = '✓ Kopiert!'; } catch(e) {}
      document.body.removeChild(ta);
      setTimeout(function() { btn.textContent = '📋 Inhalt kopieren'; }, 2000);
    });
  } catch (e) { console.error('[copy-mail]', e); }
}

// V198: Helper Escape (lokal — vermeidet Konflikt mit anderen escape-Helpers)
function _escAttr(s) {
  return ('' + (s == null ? '' : s)).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * V198: Downgrade auf Free — frühere Versionen hatten keinen Pfad zurück.
 * Bei Stripe-Mode: würde Stripe-Subscription canceln. Im Manual-Mode:
 * sendet E-Mail-Anfrage an Admin zum manuellen Downgrade.
 */
function handleDowngradeToFree() {
  var b = (window.DealPilotConfig && DealPilotConfig.branding) ? DealPilotConfig.branding.get() : {};
  var to = b.email || 'dealpilot@junker-immobilien.io';
  var user = (Auth && Auth.getUser) ? (Auth.getUser() || {}) : {};
  var subject = 'Plan-Downgrade auf Free';
  var body =
    'Hallo,\n\n' +
    'ich möchte gerne meinen Plan zurück auf Free downgraden.\n\n' +
    'Mein Account:  ' + (user.email || '–') + '\n' +
    'Account-Name: ' + (user.name || '–') + '\n\n' +
    'Bitte einmal manuell umstellen — Premium-Features sollen zum Ende des aktuellen Abrechnungszeitraums enden.\n\nDanke!';

  var mailto = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) +
               '&body=' + encodeURIComponent(body);

  var existing = document.getElementById('v198-plan-mail-modal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'v198-plan-mail-modal';
  modal.innerHTML =
    '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#fff;border-radius:12px;max-width:560px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.4)">' +
        '<h3 style="margin:0 0 16px;color:#2A2727;font-size:18px">Downgrade auf Free-Plan</h3>' +
        '<p style="margin:0 0 14px;color:#7A7370;font-size:13.5px;line-height:1.5">Schade dass du downgraden möchtest. Bitte sende uns kurz die Nachricht — wir stellen dich zum Ende des Abrechnungszeitraums um.</p>' +
        '<div style="background:#F8F6F1;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;color:#2A2727;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;max-height:200px;overflow-y:auto">' +
          'An: <strong>' + _escAttr(to) + '</strong>\nBetreff: <strong>' + _escAttr(subject) + '</strong>\n\n' + _escAttr(body) +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button onclick="v198CopyMailBody(this)" data-mail-body="' + _escAttr(body) + '" data-mail-to="' + _escAttr(to) + '" data-mail-subject="' + _escAttr(subject) + '" class="btn btn-gold" style="flex:1;min-width:140px">📋 Inhalt kopieren</button>' +
          '<a href="' + _escAttr(mailto) + '" class="btn btn-outline" style="flex:1;min-width:140px;text-align:center;text-decoration:none" onclick="setTimeout(function(){var m=document.getElementById(\'v198-plan-mail-modal\');if(m)m.remove();},500)">📧 Mail-App öffnen</a>' +
          '<button onclick="document.getElementById(\'v198-plan-mail-modal\').remove()" class="btn btn-ghost" style="flex:0;min-width:80px">Schließen</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

async function handlePlanPurchase(planId, interval) {
  try {
    var btn = event.target;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Weiterleitung...'; }
    await Sub.startCheckout(planId, interval);
  } catch (e) {
    if (typeof toast === 'function') toast('⚠ ' + e.message);
    if (event.target) { event.target.disabled = false; event.target.textContent = 'Auswählen'; }
  }
}

/**
 * Show small upgrade prompt when a user hits a limit.
 */
function showUpgradePrompt(metric, info) {
  var msg = 'Du hast dein monatliches Limit erreicht (' + info.current + '/' + info.limit + ').';
  var existing = document.getElementById('upgrade-toast');
  if (existing) existing.remove();
  var t = document.createElement('div');
  t.id = 'upgrade-toast';
  t.className = 'upgrade-toast';
  t.innerHTML =
    '<div class="upgrade-icon">⬆</div>' +
    '<div class="upgrade-msg">' +
      '<strong>Limit erreicht</strong>' +
      '<div>' + msg + '</div>' +
    '</div>' +
    '<button class="upgrade-cta" onclick="document.getElementById(\'upgrade-toast\').remove();showPricingModal()">Plan upgraden</button>' +
    '<button class="upgrade-close" onclick="document.getElementById(\'upgrade-toast\').remove()">×</button>';
  document.body.appendChild(t);
  setTimeout(function() { var el = document.getElementById('upgrade-toast'); if (el) el.remove(); }, 12000);
}

/**
 * V27: Plan als Inline-Pill innerhalb der User-Box (neben dem Namen),
 * KEIN eigener Footer-Badge mehr ("Business + Zahnrad" → weg).
 * Click auf die Pill: Free → Pricing-Modal, sonst → Settings (Tab Plan).
 */
async function renderSubscriptionBadge() {
  // V63.6: Auch im Local-Mode rendern — die Pill soll IMMER den aktuellen Plan zeigen
  // V63.9: Plan IMMER aus DealPilotConfig holen (auch im API-Mode), damit Legacy-business
  // niemals durchsickern kann. DealPilotConfig hat Legacy-Cleanup eingebaut.
  // Alten Footer-Badge (V25-Style) entfernen falls noch da
  var oldBadge = document.getElementById('sb-sub-badge');
  if (oldBadge) oldBadge.remove();

  try {
    var sub;
    if (window.DealPilotConfig && DealPilotConfig.pricing) {
      var key = DealPilotConfig.pricing.currentKey() || 'free';
      // Legacy-Schutz: business/enterprise → free
      if (key === 'business' || key === 'enterprise') key = 'free';
      var plan = DealPilotConfig.pricing.get(key) || { label: 'Free' };
      sub = {
        plan_id:   key,
        plan_name: plan.label || 'Free',
        cancel_at_period_end: false
      };
    } else {
      // Fallback wenn DealPilotConfig nicht da ist
      sub = { plan_id: 'free', plan_name: 'Free', cancel_at_period_end: false };
    }
    var sbUser = document.getElementById('sb-user');
    if (!sbUser) return;

    // Plan-Pill in den User-Text-Bereich einfügen
    var userText = sbUser.querySelector('.sb-user-text');
    if (!userText) return;

    var existingPill = sbUser.querySelector('.sb-user-plan-pill');
    if (existingPill) existingPill.remove();

    var label = sub.plan_name + (sub.cancel_at_period_end ? ' · kündigt' : '');
    // V63.6: Klick auf Pill öffnet IMMER das Pricing-Modal (egal welcher Plan)
    var clickHandler = 'event.stopPropagation();openPricingModal()';
    var pill = document.createElement('span');
    pill.className = 'sb-user-plan-pill plan-' + sub.plan_id;
    pill.setAttribute('onclick', clickHandler);
    pill.title = 'Aktueller Plan — Klick für Details';
    pill.textContent = label;
    userText.appendChild(pill);
  } catch (e) {
    console.warn('Could not render subscription badge:', e.message);
  }
}

// Handle return from Stripe checkout
(function handleStripeReturn() {
  var params = new URLSearchParams(location.search);
  if (params.get('subscription') === 'success') {
    if (typeof toast === 'function') {
      setTimeout(function(){ toast('✓ Abo erfolgreich aktiviert!'); }, 500);
    }
    Sub.clearCache();
    // Clean URL
    history.replaceState({}, '', location.pathname);
    // Refresh the badge
    setTimeout(function() {
      if (typeof renderSubscriptionBadge === 'function') renderSubscriptionBadge();
    }, 1000);
  } else if (params.get('subscription') === 'cancel') {
    if (typeof toast === 'function') {
      setTimeout(function(){ toast('Abo-Buchung abgebrochen'); }, 500);
    }
    history.replaceState({}, '', location.pathname);
  }
})();

// V63.2: window-Export für externe Aufrufer
window.renderSubscriptionBadge = renderSubscriptionBadge;

// ═══════════════════════════════════════════════════════════════
// V63.2: Feature-Gate Engine — wendet Plan-Limits aufs UI an
// ═══════════════════════════════════════════════════════════════

/**
 * V63.2: Wendet Feature-Gating auf alle UI-Elemente an.
 * Wird beim Login + nach jedem Plan-Wechsel aufgerufen.
 *
 * V63.87: RIGOROS. Features die nicht im Plan sind werden komplett
 * ausgeblendet (display:none), nicht nur ausgegraut. Marcels Wunsch:
 * "User sollen nichts sehen was sie nicht haben dürfen".
 */
async function applyFeatureGates() {
  if (!window.DealPilotConfig || !DealPilotConfig.pricing) return;
  var has = DealPilotConfig.pricing.hasFeature;
  var getLimit = DealPilotConfig.pricing.getLimit;
  var planKey = DealPilotConfig.pricing.currentKey();

  // body-Klasse für CSS-basiertes Gating
  document.body.classList.remove('plan-free', 'plan-starter', 'plan-investor', 'plan-pro', 'plan-business', 'plan-enterprise');
  document.body.classList.add('plan-' + planKey);

  // V63.7: Nach Plan-Wechsel die Header-Höhe neu messen
  if (typeof window._updateHdrHeight === 'function') {
    setTimeout(window._updateHdrHeight, 100);
    setTimeout(window._updateHdrHeight, 400);
  }

  // V63.87 Helper: hide-or-show basierend auf Feature-Check
  function _gate(selector, featureKey, opts) {
    opts = opts || {};
    var els = document.querySelectorAll(selector);
    els.forEach(function(el) {
      var allowed = has(featureKey);
      if (!allowed) {
        el.classList.add('feature-hidden');
        // Bei Sidebar-Items komplett ausblenden, sonst stört es das Layout
        el.style.display = 'none';
      } else {
        el.classList.remove('feature-hidden', 'feature-locked');
        el.style.display = '';
        el.removeAttribute('title');
      }
    });
  }

  // 1) DS2-Card (Investor Deal Score) — nur sichtbar wenn deal_score_v2 erlaubt
  // V119: Marcels Bug-Report — DS2 wurde gerade nicht angezeigt obwohl Plan Pro.
  //   Mögliche Ursachen: alte feature-hidden-Klasse vom vorherigen Plan-Wechsel
  //   sticky, oder render läuft nicht direkt nach Visibility-Toggle.
  //   Fix: explizit alle Sticky-Klassen entfernen + renderDealScore2() nachtriggern.
  var ds2Card = document.getElementById('dealscore2-card');
  if (ds2Card) {
    if (has('deal_score_v2')) {
      ds2Card.style.display = '';
      ds2Card.style.visibility = 'visible';
      ds2Card.classList.remove('feature-hidden', 'feature-locked', 'ds2-card-collapsed');
      ds2Card.removeAttribute('data-locked');
      ds2Card.removeAttribute('aria-hidden');
      // V119: Render forcieren — falls Plan-Wechsel läuft und das Render
      // vor der Sichtbarkeits-Anwendung war (Race-Condition).
      setTimeout(function(){
        if (typeof window.renderDealScore2 === 'function') {
          try { window.renderDealScore2(); } catch(e) {}
        }
      }, 100);
    } else {
      ds2Card.style.display = 'none';
      ds2Card.classList.add('feature-hidden');
    }
  }

  // 2) DS2-Readonly-Card (Tab Kennzahlen)
  var ds2RO = document.getElementById('ds2-readonly-card');
  if (ds2RO) {
    if (has('deal_score_v2')) {
      ds2RO.style.display = '';
      ds2RO.classList.remove('feature-hidden');
    } else {
      ds2RO.style.display = 'none';
      ds2RO.classList.add('feature-hidden');
    }
  }

  // 3) Track-Record-PDF (Sidebar + Header-Buttons)
  _gate('[onclick*="trackRecord"], [onclick*="exportTrackRecord"], #sb-track-record-btn, [data-feature="track_record_pdf"]',
    'track_record_pdf');

  // 4) Bankexport / BMF-Rechner — Investor/Pro
  _gate('[onclick*="bankExport"], [onclick*="exportBank"], #sb-bank-btn, [data-feature="bank_pdf_a3"], [data-feature="bmf_calc_export"]',
    'bank_pdf_a3');

  // 5) Live-Marktzinsen (Tab Finanzierung)
  _gate('[data-feature="live_market_rates"]', 'live_market_rates');

  // 6) Custom Logo (Settings → Kontakt&Logo)
  // V63.87: Hier statt komplett ausblenden den existierenden feature-locked-logo-Hint nutzen
  // (Settings-Tab soll erreichbar bleiben — nur das Logo-Feld ist gegated)
  var logoSection = document.getElementById('st-pane-contact');
  if (logoSection) {
    if (!has('custom_logo')) {
      logoSection.classList.add('feature-locked-logo');
    } else {
      logoSection.classList.remove('feature-locked-logo');
    }
  }

  // 7) KI-Marktanalyse / Lagebewertung — Investor/Pro
  _gate('[data-feature="ai_market_analysis"], [data-feature="ai_lage"], #ki-lage-btn, [onclick*="runKiLage"]',
    'ai_market_analysis');

  // 8) Marktdatenfelder (Tab Objekt) — Investor/Pro
  _gate('[data-feature="market_data_fields"]', 'market_data_fields');

  // 9) Personalisierte Zinsmodelle — Pro only (= custom_finance_models in config.js)
  _gate('[data-feature="personalized_rates"], [data-feature="custom_finance_models"]', 'custom_finance_models');

  // 10) Premium-PDF-Layouts — Pro only
  _gate('[data-feature="premium_pdf_layouts"]', 'premium_pdf_layouts');

  // 11) Custom Track-Record-Cover — Pro only (= track_record_custom_cover)
  _gate('[data-feature="custom_track_record_cover"], [data-feature="track_record_custom_cover"]', 'track_record_custom_cover');

  // 12) Bauspar-/Tilgungsaussetzungs-Optionen — Pro only.
  // Achtung: Feature-Key existiert ggf. nicht in config.js → fallback "custom_finance_models"
  _gate('[data-feature="bauspar"], [data-feature="tilgungsaussetzung"]', 'custom_finance_models');

  // V63.87: Tilgungsaussetzungs-OPTION im d1_type-Select kann nicht via CSS gegated werden
  // → JS-Lösung: option.disabled + visuell hidden setzen wenn nicht erlaubt
  var d1Sel = document.getElementById('d1_type');
  if (d1Sel) {
    Array.prototype.forEach.call(d1Sel.options, function(opt) {
      if (opt.value === 'tilgungsaussetzung') {
        if (!has('custom_finance_models')) {
          opt.disabled = true;
          opt.hidden = true;
          opt.style.display = 'none';
          // Falls aktuell ausgewählt → auf annuitaet zurückfallen
          if (d1Sel.value === 'tilgungsaussetzung') {
            d1Sel.value = 'annuitaet';
            if (typeof onD1TypeChange === 'function') {
              try { onD1TypeChange(); } catch(e) {}
            }
          }
        } else {
          opt.disabled = false;
          opt.hidden = false;
          opt.style.display = '';
        }
      }
    });
  }

  // 13) BMF-Rechner-Tab (eigener Reiter, nur Investor/Pro)
  _gate('[data-feature="bmf_calc_export"], #bmf-tab-btn', 'bmf_calc_export');

  // V63.87: Generic Selector — alle Elemente mit data-feature werden automatisch gegated
  document.querySelectorAll('[data-feature]').forEach(function(el) {
    var feat = el.getAttribute('data-feature');
    // Skip wenn schon oben behandelt mit explizitem Selector
    if (el.classList.contains('feature-locked-logo')) return;
    if (feat && !has(feat)) {
      el.classList.add('feature-hidden');
      el.style.display = 'none';
    } else {
      el.classList.remove('feature-hidden', 'feature-locked');
      el.style.display = '';
    }
  });

  // 14) KI-Credits-Indikator + KI-Button-Status (Tooltips)
  var aiCreditsLeft = getLimit('ai_credits');
  var kiButtons = document.querySelectorAll('.btn-gold[onclick*="qcAi"], #qc-ai-fill-all, .ai-btn');
  kiButtons.forEach(function(btn) {
    if (aiCreditsLeft === 0 || aiCreditsLeft === null) {
      btn.setAttribute('title', 'KI nicht im aktuellen Plan verfügbar — Credit-Paket dazubuchen');
    } else if (aiCreditsLeft > 0 && aiCreditsLeft !== -1) {
      btn.setAttribute('title', aiCreditsLeft + ' KI-Credits verfügbar');
    }
  });

  console.log('[Feature-Gate V63.87] Plan:', planKey,
    '— DS2:', has('deal_score_v2'),
    '· Logo:', has('custom_logo'),
    '· LiveRates:', has('live_market_rates'),
    '· TrackRecord:', has('track_record_pdf'),
    '· BMF:', has('bmf_calc_export'),
    '· KI-Markt:', has('ai_market_analysis'),
    '· Bauspar:', has('bauspar'));
}

window.applyFeatureGates = applyFeatureGates;

// V63.2: Beim Login + Plan-Wechsel das Gating anwenden
// V63.9: Auch das Plan-Pill IMMER beim DOMContentLoaded rendern (auch ohne Login → zeigt 'Free')
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof applyFeatureGates === 'function') applyFeatureGates();
    if (typeof renderSubscriptionBadge === 'function') renderSubscriptionBadge();
  }, 200);
  // Doppelt nach 800ms damit auch nach späterer User-Box-Erstellung das Pill da ist
  setTimeout(function() {
    if (typeof renderSubscriptionBadge === 'function') renderSubscriptionBadge();
  }, 800);
});
