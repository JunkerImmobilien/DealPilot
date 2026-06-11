'use strict';
/* ════════════════════════════════════════════════════════════════
   DealPilot v485 — sidebar-collapse.js
   (1) Vollbild-Toggle fuer die normalen Tabs: blendet die linke Sidebar aus
       (gleiche Grid-Mechanik wie das Portfolio-Cockpit: app-wrap -> 0 1fr).
   (2) Robuster QuickCheck-Wechsel: wrappt window.enterQuickCheckMode additiv,
       sodass Cockpit-Vollbild + Tab-Collapse zuerst verlassen werden.
   Additiv, kein Build, keine Abhaengigkeit von ui.js-Version.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'dp_tabs_fullscreen';
  var btn = null;

  function isCollapsed() { return document.body.classList.contains('dp-sidebar-collapsed'); }

  function setCollapsed(on) {
    document.body.classList.toggle('dp-sidebar-collapsed', !!on);
    /* v607: keine Persistenz */ if (on) { try { _v607TagTips(); } catch (e2) {} try { if (typeof window._sbActionsRenderIcons === 'function') window._sbActionsRenderIcons(); } catch (e3) {} /* v611-paint */ }
    updateBtn();
  }
  function toggle() { setCollapsed(!isCollapsed()); }

  function updateBtn() {
    if (!btn) return;
    if (isCollapsed()) {
      btn.innerHTML = '\u2630';               // Hamburger -> Menue einblenden
      btn.title = 'Men\u00fc einblenden';
      btn.setAttribute('aria-label', 'Men\u00fc einblenden');
    } else {
      btn.innerHTML = '\u276E';               // Chevron-links -> Vollbild
      btn.title = 'Vollbild (Men\u00fc ausblenden)';
      btn.setAttribute('aria-label', 'Men\u00fc ausblenden');
    }
  }

  function ensureBtn() {
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'dp-sb-toggle';
    btn.type = 'button';
    btn.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
    document.body.appendChild(btn);
    updateBtn();
  }

  function wrapQuickCheck() {
    if (typeof window.enterQuickCheckMode !== 'function') return;
    if (window.enterQuickCheckMode._dpWrapped) return;
    var orig = window.enterQuickCheckMode;
    var wrapped = function () {
      try {
        // v486: Cockpit ist offen, sobald #dashboard-main die Klasse dp-active traegt
        // (wird in openDashboard gesetzt, in closeDashboard entfernt) — UNABHAENGIG
        // davon, ob Vollbreite/dp-dash-fullscreen aktiv ist. Bild 2 zeigt das Cockpit
        // mit sichtbarer Sidebar (also ohne dp-dash-fullscreen) -> alter Check verfehlte das.
        var dm = document.getElementById('dashboard-main');
        var dashOpen =
          (dm && (dm.classList.contains('dp-active') ||
                  (dm.style && dm.style.display && dm.style.display !== 'none'))) ||
          document.body.classList.contains('dp-dash-fullscreen');
        if (dashOpen &&
            window.DealPilotDashboard && typeof window.DealPilotDashboard.close === 'function') {
          window.DealPilotDashboard.close();
        }
      } catch (e) {}
      document.body.classList.remove('dp-sidebar-collapsed');
      return orig.apply(this, arguments);
    };
    wrapped._dpWrapped = true;
    window.enterQuickCheckMode = wrapped;
  }

  function _v607TagTips() {
    try {
      document.querySelectorAll('#sidebar .sb-act-item').forEach(function (it) {
        if (it.getAttribute('data-tip')) return;
        var l = it.querySelector('.sb-act-l');
        if (l) it.setAttribute('data-tip', (l.textContent || '').trim());
      });
      document.querySelectorAll('#sidebar .sb-card').forEach(function (cc) {
        if (cc.getAttribute('data-tip')) return;
        var a = cc.querySelector('.sbc-address');
        if (a) cc.setAttribute('data-tip', (a.getAttribute('title') || a.textContent || '').trim());
      });
    } catch (e) {}
  }

  function init() {
    ensureBtn();
    /* v607: immer ausgeklappt starten */
    wrapQuickCheck();
    // enterQuickCheckMode koennte erst nach ui.js verfuegbar sein -> kurz nachfassen
    var tries = 0;
    (function retry() {
      if (window.enterQuickCheckMode && window.enterQuickCheckMode._dpWrapped) return;
      wrapQuickCheck();
      if (tries++ < 20) setTimeout(retry, 200);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DealPilotSidebar = { toggle: toggle, collapse: function () { setCollapsed(true); }, expand: function () { setCollapsed(false); } };
})();
