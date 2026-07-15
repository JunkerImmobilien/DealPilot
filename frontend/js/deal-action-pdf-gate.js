'use strict';
/**
 * deal-action-pdf-gate.js (W3 — ersetzt v940)
 * Markiert im Deal-Aktion-Tab PDF-Zeilen, die der Plan nicht kann.
 *
 * W3-FIX (Bug aus v940): Das Modul lief per MutationObserver, sobald der Tab
 * rendert — da ist die Subscription oft noch nicht geladen und currentKey()
 * liefert 'free'. Es sperrte, setzte data-pg='1' und wertete NIE neu aus.
 * Ergebnis: Investor sah dauerhaft "INVESTOR"-Schloesser.
 * Jetzt: (a) erst gaten, wenn die Subscription wirklich geladen ist,
 *        (b) bei Planwechsel komplett neu bewerten (Marker zuruecksetzen).
 */
(function () {
  var _lastPlan = null;

  function planReady() {
    try {
      var P = window.DealPilotConfig && DealPilotConfig.pricing;
      if (!P || typeof P.currentKey !== 'function') return null;
      /* current() liefert erst nach Sub-Load ein Objekt -> davor NICHT gaten */
      if (typeof P.current === 'function' && !P.current()) return null;
      return P.currentKey() || null;
    } catch (e) { return null; }
  }
  function locked(fk) {
    try { return !!(window.Plan && Plan.can && !Plan.can(fk)); } catch (e) { return false; }
  }

  function unlockRow(btn, row, which) {
    btn.style.opacity = ''; btn.title = '';
    if (btn.getAttribute('data-pg-orig')) {
      btn.setAttribute('onclick', btn.getAttribute('data-pg-orig'));
      btn.innerHTML = btn.getAttribute('data-pg-label') || '⬇ PDF';
      btn.removeAttribute('data-pg-orig'); btn.removeAttribute('data-pg-label');
    }
    var bd = row.querySelector('.dab-pg-badge'); if (bd) bd.remove();
  }

  function gate(force) {
    var plan = planReady();
    if (!plan) return;                      // Sub noch nicht da -> NICHT gaten (v940-Bug)
    if (plan !== _lastPlan) { force = true; _lastPlan = plan; }

    var rows; try { rows = document.querySelectorAll('.dab-doc-row'); } catch (e) { return; }
    Array.prototype.forEach.call(rows, function (row) {
      var btn = row.querySelector('button[onclick*="exportDoc"], button[data-pg]');
      if (!btn) return;
      if (btn.getAttribute('data-pg') && !force) return;

      var src = btn.getAttribute('onclick') || btn.getAttribute('data-pg-orig') || '';
      var m = src.match(/exportDoc\('(\w+)'\)/);
      if (!m) return;
      var which = m[1];
      var fk = which === 'bmf' ? 'werbungskosten_pdf' : (which === 'track' ? 'track_record_pdf' : null);
      btn.setAttribute('data-pg', '1');

      if (!fk || !locked(fk)) { unlockRow(btn, row, which); return; }

      if (!btn.getAttribute('data-pg-orig')) {
        btn.setAttribute('data-pg-orig', src);
        btn.setAttribute('data-pg-label', btn.innerHTML);
      }
      btn.removeAttribute('onclick');
      btn.style.opacity = '0.55'; btn.style.cursor = 'pointer';
      btn.innerHTML = '\ud83d\udd12 Investor';
      btn.title = 'Im Investor-Plan enthalten';
      if (!btn.getAttribute('data-pg-wired')) {
        btn.setAttribute('data-pg-wired', '1');
        btn.addEventListener('click', function (e) {
          if (btn.getAttribute('data-pg-orig')) {      // nur solange gesperrt
            e.preventDefault(); e.stopPropagation();
            if (typeof openPricingModal === 'function') openPricingModal();
          }
        });
      }
      var nm = row.querySelector('.dab-doc-n');
      if (nm && !nm.querySelector('.dab-pg-badge')) {
        nm.insertAdjacentHTML('beforeend', ' <span class="dab-pg-badge" style="font-size:9px;font-weight:700;letter-spacing:.06em;color:var(--gold-3,#b8932f);background:var(--gold-bg,#fbf1dc);padding:2px 7px;border-radius:20px;vertical-align:middle;margin-left:6px">INVESTOR</span>');
      }
    });
  }

  function boot() {
    try { new MutationObserver(function () { gate(false); })
      .observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    /* Plan kommt asynchron -> mehrfach nachfassen, bis er da ist */
    [0, 800, 2000, 4000, 7000].forEach(function (ms) { setTimeout(function () { gate(true); }, ms); });
    /* falls die App den Plan spaeter meldet */
    window.addEventListener('dp:plan-changed', function () { gate(true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
