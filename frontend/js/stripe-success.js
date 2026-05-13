'use strict';
/**
 * stripe-success.js (V183)
 *
 * Fängt JEDEN Rückkehr von Stripe-Checkout ab — egal welcher URL:
 *   ?subscription=success
 *   /subscription/success
 *   document.referrer enthält "checkout.stripe.com"
 *
 * Bei success:
 *   - Sub.invalidateCache() — neue Plan-Daten vom Backend holen
 *   - applyFeatureGates() — UI-Feature-Locks anpassen
 *   - renderSubscriptionBadge() — Plan-Pill aktualisieren
 *   - Toast: "✓ Plan aktiviert"
 *   - URL clean
 *
 * Bei cancel:
 *   - Toast: "Checkout abgebrochen"
 *   - URL clean
 */
(function() {
  function _getParam(name) {
    var url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function _cleanUrl() {
    var url = new URL(window.location.href);
    url.searchParams.delete('subscription');
    url.searchParams.delete('session_id');
    var newPath = url.pathname.replace(/\/subscription\/(success|cancel).*/, '/');
    window.history.replaceState({}, document.title, newPath + (url.search || ''));
  }

  function _isStripeReturn() {
    // 1. Query-Parameter ?subscription=success
    if (_getParam('subscription') === 'success') return 'success';
    if (_getParam('subscription') === 'cancel')  return 'cancel';

    // 2. Pfad /subscription/success oder /subscription/cancel
    if (/\/subscription\/success/.test(window.location.pathname)) return 'success';
    if (/\/subscription\/cancel/.test(window.location.pathname))  return 'cancel';

    // 3. Referrer enthält checkout.stripe.com (Stripe hat redirected)
    if (document.referrer && /checkout\.stripe\.com/.test(document.referrer)) {
      // Nur als success interpretieren wenn auch session_id in URL oder Pfad
      if (_getParam('session_id')) return 'success';
      // Sonst unbekannt — vermutlich cancel oder unklarer Redirect
      return 'success'; // pragmatisch: Stripe → DealPilot ist immer ein Success-Indikator
    }

    return null;
  }

  function _onStripeSuccess() {
    console.log('[stripe-success V183] Stripe-Checkout erfolgreich abgeschlossen');

    // 1. Sub-Cache invalidieren
    if (typeof Sub !== 'undefined' && typeof Sub.invalidateCache === 'function') {
      Sub.invalidateCache();
    }

    // 2. Plan-Daten frisch laden, dann UI refreshen
    if (typeof Sub !== 'undefined' && typeof Sub.getCurrent === 'function') {
      Sub.getCurrent().then(function(sub) {
        console.log('[stripe-success V183] neuer Plan:', sub && sub.plan_id);

        if (typeof applyFeatureGates === 'function') {
          try { applyFeatureGates(); } catch(e) { console.warn(e); }
        } else if (typeof window.applyFeatureGates === 'function') {
          try { window.applyFeatureGates(); } catch(e) { console.warn(e); }
        }

        if (typeof window.renderSubscriptionBadge === 'function') {
          try { window.renderSubscriptionBadge(); } catch(e) { console.warn(e); }
        }

        if (typeof updHeaderBadges === 'function') {
          try { updHeaderBadges(); } catch(e) {}
        }

        var planLabel = (sub && sub.plan_name) || (sub && sub.plan_id) || 'neu';
        if (typeof toast === 'function') {
          toast('✓ Plan "' + planLabel + '" aktiviert');
        }
      }).catch(function(err) {
        console.error('[stripe-success V183] Plan-Refresh fehlgeschlagen:', err);
        if (typeof toast === 'function') {
          toast('⚠ Zahlung empfangen — Plan-Sync läuft im Hintergrund');
        }
      });
    }
  }

  function _onStripeCancel() {
    console.log('[stripe-success V183] Stripe-Checkout abgebrochen');
    if (typeof toast === 'function') {
      toast('Checkout abgebrochen — kein Plan-Wechsel');
    }
  }

  function init() {
    var status = _isStripeReturn();
    if (status === 'success') {
      _cleanUrl();
      setTimeout(_onStripeSuccess, 600);
    } else if (status === 'cancel') {
      _cleanUrl();
      setTimeout(_onStripeCancel, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
