/**
 * V174 — Legal-Links Injektor
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fügt Links zu Impressum/Datenschutz in:
 *  - Login-Modal (auth-footer-v39)
 *  - Register-Modal (V169)
 *  - Sidebar-Footer (falls vorhanden)
 *
 * Damit ist die rechtlich vorgeschriebene Erreichbarkeit gesichert
 * (max. 2 Klicks von jeder App-Seite).
 */
(function () {
  'use strict';

  var LINK_HTML =
    '<div class="dp-legal-links" style="font-size:11px;color:#888;margin-top:12px;text-align:center;letter-spacing:0.2px">' +
      '<a href="/impressum.html" target="_blank" style="color:#888;text-decoration:none;margin:0 6px">Impressum</a>' +
      '<span style="color:#ccc">·</span>' +
      '<a href="/datenschutz.html" target="_blank" style="color:#888;text-decoration:none;margin:0 6px">Datenschutz</a>' +
    '</div>';

  function _injectIntoModals() {
    // Login-Modal Footer
    var authFooter = document.querySelector('#auth-modal .auth-footer-v39');
    if (authFooter && !authFooter._v174_legal) {
      authFooter._v174_legal = true;
      authFooter.insertAdjacentHTML('afterend', LINK_HTML);
    }

    // Register-Modal
    var regModal = document.getElementById('dp-register-modal');
    if (regModal && !regModal._v174_legal) {
      regModal._v174_legal = true;
      var card = regModal.querySelector('.auth-card-v39');
      if (card) {
        card.insertAdjacentHTML('beforeend', LINK_HTML);
      }
    }
  }

  function _injectFooterLink() {
    // Sidebar oder App-Footer — falls Element vorhanden
    if (document.getElementById('dp-app-legal-footer')) return;
    var sidebar = document.querySelector('.sb-bottom, .sidebar-footer, .dp-sidebar-bottom');
    if (!sidebar) {
      // Fallback: minimal footer unten an die Seite hängen
      var foot = document.createElement('div');
      foot.id = 'dp-app-legal-footer';
      foot.style.cssText =
        'position:fixed;bottom:8px;right:16px;font-size:10px;color:#aaa;z-index:100;letter-spacing:0.3px';
      foot.innerHTML =
        '<a href="/impressum.html" target="_blank" style="color:#aaa;text-decoration:none;margin:0 4px">Impressum</a>' +
        '<span style="color:#ddd">·</span>' +
        '<a href="/datenschutz.html" target="_blank" style="color:#aaa;text-decoration:none;margin:0 4px">Datenschutz</a>';
      document.body.appendChild(foot);
    }
  }

  function init() {
    _injectIntoModals();
    _injectFooterLink();
    // Observer für nachträglich auftauchende Modals
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(_injectIntoModals);
      mo.observe(document.body, { childList: true, subtree: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[legal-links V174] aktiv');
})();
