/* ════════════════════════════════════════════════════════════════
   env.js                                                (V270.4)
   ──────────────────────────────────────────────────────────────
   Environment-Detection für DealPilot Marketing-Landing-Pages.

   ZWECK
     Marketing-Page wird sowohl auf Production (dealpilot.junker-...)
     als auch auf Staging (staging.dealpilot.junker-...) ausgeliefert.
     Login/Register-Links müssen je nach Umgebung auf die richtige
     App-Subdomain zeigen:

       Production-Marketing → app.dealpilot.junker-immobilien.io
       Staging-Marketing    → app.staging.dealpilot.junker-immobilien.io

   STRATEGIE
     1. Bei Page-Load: alle href-Attribute auf app.dealpilot.* scannen
     2. Wenn aktuelle Hostname mit "staging." beginnt: Domain umschreiben
     3. Pricing-Plugin & andere dynamisch generierte Links nutzen
        DealPilotEnv.appUrl(path) Helper

   STAND
     V270.4 (24.05.2026) — Initial Setup
   ════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  // ─── Detection: Production vs. Staging ────────────────────────
  function isStaging() {
    var host = (location.hostname || '').toLowerCase();
    return host.indexOf('staging.') === 0 || host.indexOf('staging-') === 0;
  }

  // ─── App-URL für aktuelles Environment ─────────────────────────
  // path: optionaler Pfad oder Query, z.B. "?register=1"
  function appUrl(path) {
    var base = isStaging()
      ? 'https://app.staging.dealpilot.junker-immobilien.io/'
      : 'https://app.dealpilot.junker-immobilien.io/';

    if (!path) return base;

    // Falls path mit "/" beginnt: redundantes "/" entfernen
    if (path.charAt(0) === '/') path = path.substring(1);

    return base + path;
  }

  // ─── Marketing-URL (für Cross-Linking innerhalb Marketing) ─────
  function marketingUrl(path) {
    var base = isStaging()
      ? 'https://staging.dealpilot.junker-immobilien.io/'
      : 'https://dealpilot.junker-immobilien.io/';

    if (!path) return base;
    if (path.charAt(0) === '/') path = path.substring(1);
    return base + path;
  }

  // ─── Auto-Rewrite aller Static-Hrefs auf der Page ──────────────
  function rewriteStaticLinks() {
    var prodAppHost = 'app.dealpilot.junker-immobilien.io';
    var stagingMode = isStaging();

    // Nur umschreiben wenn wir auf Staging sind
    if (!stagingMode) return;

    var links = document.querySelectorAll('a[href*="' + prodAppHost + '"]');
    var count = 0;
    links.forEach(function(a) {
      var oldHref = a.getAttribute('href');
      // Match Prod-Domain mit oder ohne Trailing-Slash
      var newHref = oldHref.replace(
        /https?:\/\/app\.dealpilot\.junker-immobilien\.io/i,
        'https://app.staging.dealpilot.junker-immobilien.io'
      );
      if (newHref !== oldHref) {
        a.setAttribute('href', newHref);
        a.setAttribute('data-env-rewritten', 'staging');
        count++;
      }
    });

    if (count > 0 && console && console.info) {
      console.info('[DealPilotEnv] Staging-Mode: ' + count + ' Links umgeschrieben');
    }
  }

  // ─── Watcher für dynamisch erzeugte Links (z.B. Pricing-Plugin) ───
  // MutationObserver auf body — schreibt neu hinzugefügte Hrefs sofort um
  function initMutationWatcher() {
    if (!isStaging() || typeof MutationObserver === 'undefined') return;

    var prodAppHost = 'app.dealpilot.junker-immobilien.io';

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        // Direkte hinzugefügte Nodes durchscannen
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return; // Element-Nodes only

          // Selber ein <a>?
          if (node.tagName === 'A' && node.getAttribute('href') &&
              node.getAttribute('href').indexOf(prodAppHost) !== -1) {
            rewriteOne(node);
          }

          // Kinder durchsuchen
          if (node.querySelectorAll) {
            node.querySelectorAll('a[href*="' + prodAppHost + '"]').forEach(rewriteOne);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    function rewriteOne(a) {
      if (a.getAttribute('data-env-rewritten')) return; // schon umgeschrieben
      var oldHref = a.getAttribute('href');
      var newHref = oldHref.replace(
        /https?:\/\/app\.dealpilot\.junker-immobilien\.io/i,
        'https://app.staging.dealpilot.junker-immobilien.io'
      );
      if (newHref !== oldHref) {
        a.setAttribute('href', newHref);
        a.setAttribute('data-env-rewritten', 'staging');
      }
    }
  }

  // ─── Init ─────────────────────────────────────────────────────
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        rewriteStaticLinks();
        initMutationWatcher();
      });
    } else {
      rewriteStaticLinks();
      initMutationWatcher();
    }
  }

  // Public API
  global.DealPilotEnv = {
    isStaging:     isStaging,
    appUrl:        appUrl,
    marketingUrl:  marketingUrl,
    rewriteStaticLinks: rewriteStaticLinks
  };

  init();

})(window);
