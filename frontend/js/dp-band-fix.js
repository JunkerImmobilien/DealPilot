/* ============================================================================
   DealPilot v863 – dp-band-fix.js
   MISST das schwarze Brand-Band (Settings- + Hilfe-Modal) live aus und setzt
   das Schliessen-X per JS EXAKT in dessen vertikale Mitte; der Schriftzug
   (EINSTELLUNGEN/HILFE) sitzt mit festem Abstand links daneben auf derselben
   Mittellinie. Unabhaengig von jeder CSS-Regel (setProperty '!important').
   Laeuft bei jedem Modal-Aufbau (MutationObserver) + bei Resize.
   ============================================================================ */
(function () {
  'use strict';
  var X_SIZE = 28, X_RIGHT = 16, GAP = 18;

  function fixOne(tb) {
    var brand = tb.querySelector('.dp-mtb-brand');
    var x = tb.querySelector('.dp-band-close');
    if (!brand || !x) return;
    var tag = tb.querySelector('.dp-mtb-tag');
    var tbr = tb.getBoundingClientRect();
    var br = brand.getBoundingClientRect();
    if (!br.height || !tbr.height) return;
    var midY = (br.top - tbr.top) + br.height / 2;   // Mitte des SCHWARZEN Bands, relativ zum Topband

    if (getComputedStyle(tb).position === 'static') tb.style.setProperty('position', 'relative', 'important');

    function imp(el, prop, val) { el.style.setProperty(prop, val, 'important'); }
    imp(x, 'position', 'absolute');
    imp(x, 'left', 'auto');
    imp(x, 'right', X_RIGHT + 'px');
    imp(x, 'top', (midY - X_SIZE / 2) + 'px');
    imp(x, 'bottom', 'auto');
    imp(x, 'transform', 'none');
    imp(x, 'margin', '0');
    imp(x, 'width', X_SIZE + 'px');
    imp(x, 'height', X_SIZE + 'px');
    imp(x, 'display', 'flex');
    imp(x, 'align-items', 'center');
    imp(x, 'justify-content', 'center');
    imp(x, 'padding', '0');
    imp(x, 'z-index', '30');
    var svg = x.querySelector('svg');
    if (svg) { imp(svg, 'width', '13px'); imp(svg, 'height', '13px'); }

    if (tag) {
      imp(tag, 'position', 'absolute');
      imp(tag, 'left', 'auto');
      imp(tag, 'right', (X_RIGHT + X_SIZE + GAP) + 'px');  // fester Abstand links vom X
      imp(tag, 'top', midY + 'px');
      imp(tag, 'transform', 'translateY(-50%)');
      imp(tag, 'margin', '0');
      imp(tag, 'white-space', 'nowrap');
    }
    tb.dataset.dpBandFixed = '1';
  }

  function fixAll() {
    try {
      document.querySelectorAll('.dp-modal-topband').forEach(function (tb) { fixOne(tb); });
    } catch (e) {}
  }

  function boot() {
    fixAll();
    try {
      new MutationObserver(function () {
        // rAF: erst nach Layout messen
        requestAnimationFrame(fixAll);
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    window.addEventListener('resize', function () { requestAnimationFrame(fixAll); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window._dpBandFix = fixAll;
})();
