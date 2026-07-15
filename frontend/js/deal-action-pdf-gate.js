'use strict';
/**
 * deal-action-pdf-gate.js (v940)
 * Markiert im Deal-Aktion-Tab die PDF-Zeilen, die im aktuellen Plan NICHT
 * verfuegbar sind, sichtbar als gesperrt (Badge + Schloss, Klick -> Pricing).
 * Additiv: schreibt deal-action-boarding.js NICHT um, sondern gated die
 * gerenderten .dab-doc-row-Buttons nach Feature-Key.
 *   invest -> immer verfuegbar (Free = Wasserzeichen)
 *   bmf    -> werbungskosten_pdf (Investor+)
 *   track  -> track_record_pdf   (Free=Demo, Starter gesperrt, Investor+)
 */
(function () {
  function locked(featureKey) {
    return (typeof Plan !== 'undefined' && Plan.can && !Plan.can(featureKey));
  }
  function gate() {
    var rows;
    try { rows = document.querySelectorAll('.dab-doc-row'); } catch (e) { return; }
    Array.prototype.forEach.call(rows, function (row) {
      var btn = row.querySelector('button[onclick*="exportDoc"]');
      if (!btn || btn.getAttribute('data-pg')) return;
      var m = (btn.getAttribute('onclick') || '').match(/exportDoc\('(\w+)'\)/);
      if (!m) return;
      var which = m[1];
      var fk = which === 'bmf' ? 'werbungskosten_pdf' : (which === 'track' ? 'track_record_pdf' : null);
      btn.setAttribute('data-pg', '1');
      if (!fk || !locked(fk)) return;   // invest oder verfuegbar -> nichts tun
      // Sperr-Optik
      btn.removeAttribute('onclick');
      btn.style.opacity = '0.55';
      btn.style.cursor = 'pointer';
      btn.innerHTML = '\ud83d\udd12 Investor';
      btn.title = 'Im Investor-Plan enthalten';
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (typeof openPricingModal === 'function') openPricingModal();
        else if (typeof toast === 'function') toast('Im Investor-Plan enthalten');
      });
      var nm = row.querySelector('.dab-doc-n');
      if (nm && !nm.querySelector('.dab-pg-badge')) {
        nm.insertAdjacentHTML('beforeend', ' <span class="dab-pg-badge" style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#b8932f;background:#fbf1dc;padding:2px 7px;border-radius:20px;vertical-align:middle;margin-left:6px">INVESTOR</span>');
      }
    });
  }
  var _mo = new MutationObserver(function () { try { gate(); } catch (e) {} });
  function boot() {
    try { _mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    gate();
    [800, 2000].forEach(function (ms) { setTimeout(gate, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
