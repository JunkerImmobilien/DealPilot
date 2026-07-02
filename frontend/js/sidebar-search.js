/* ============================================================================
   DealPilot v447 – sidebar-search.js (v7)
   Suchfeld in der Portfolio-Zeile, filtert .sb-card nach ID / Strasse / Ort.
   v447-FIX (Wurzel gefunden): card.style.display='none' wurde von einer CSS-Regel
   mit !important auf .sb-card ueberschrieben -> Karten blieben sichtbar, obwohl
   der Filter lief. Loesung: setProperty('display','none','important') zum Ausblenden
   und removeProperty('display') zum Einblenden.
   Watcher (250ms) + Event-Listener bleiben (Events werden teils geblockt).
   Idempotent. Frontend-only.
   ============================================================================ */
(function () {
  'use strict';
  var INPUT_ID = 'sb-search-input';
  var _lastVal = null;
  function norm(s) { return (s || '').toString().toLowerCase().trim(); }

  function hideCard(c)  { c.style.setProperty('display', 'none', 'important'); }
  function showCard(c)  { c.style.removeProperty('display'); }

  function applyFilter() {
    var inp = document.getElementById(INPUT_ID);
    var list = document.getElementById('sb-list');
    if (!list) return;
    var q = norm(inp ? inp.value : '');
    var cards = list.querySelectorAll('.sb-card');
    var shown = 0;
    cards.forEach(function (card) {
      if (!q) { showCard(card); shown++; return; }
      if (norm(card.textContent).indexOf(q) !== -1) { showCard(card); shown++; }
      else { hideCard(card); }
    });
    var empty = document.getElementById('sb-search-empty');
    if (q && shown === 0 && cards.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'sb-search-empty';
        empty.className = 'sb-empty';
        empty.style.cssText = 'padding:14px;text-align:center;color:var(--muted,#7A7370);font-size:12.5px';
        list.appendChild(empty);
      }
      empty.textContent = 'Keine Treffer';
      empty.style.display = '';
    } else if (empty) {
      empty.style.display = 'none';
    }
  }
  window._sbApplySearchFilter = applyFilter;

  function startWatcher() {
    if (window._sbSearchWatcher) return;
    window._sbSearchWatcher = setInterval(function () {
      var inp = document.getElementById(INPUT_ID);
      if (!inp) return;
      if (inp.value !== _lastVal) { _lastVal = inp.value; applyFilter(); }
    }, 250);
  }

  function ensureField() {
    if (document.getElementById(INPUT_ID)) return true;
    var row = document.querySelector('.sb-section-title-with-sort');
    if (!row) return false;
    var oldWrap = document.querySelector('.sb-search-wrap');
    if (oldWrap) { try { oldWrap.remove(); } catch (e) {} }
    var box = document.createElement('div');
    box.className = 'sb-search-box';
    box.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold,#C9A84C)" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">' +
        '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="' + INPUT_ID + '" type="text" autocomplete="off" ' +
        'placeholder="Suche\u2026" aria-label="Objekte suchen nach ID, Stra\u00dfe oder Ort" ' +
        'style="color:#F2EFE9" />';
    /* v846-insertfix: robustes Einfuegen. .sb-sort-toggle steckt in .sb-tools-group und ist NICHT
       direktes Kind von row -> row.insertBefore(box, toggle) warf NotFoundError und brach den
       ganzen IIFE ab (kein Watcher, keine Suche). Jetzt: vor die tools-group, sonst vor toggle in
       dessen echtem Parent, sonst ans row-Ende. */
    try {
      var toolsGroup = row.querySelector('.sb-tools-group');
      var toggle = row.querySelector('.sb-sort-toggle');
      if (toolsGroup && toolsGroup.parentNode === row) {
        row.insertBefore(box, toolsGroup);
      } else if (toggle && toggle.parentNode) {
        toggle.parentNode.insertBefore(box, toggle);
      } else {
        row.appendChild(box);
      }
    } catch (e) {
      try { row.appendChild(box); } catch (e2) {}
    }
    var inp = document.getElementById(INPUT_ID);
    if (inp) {
      ['keyup', 'input', 'change', 'search'].forEach(function (ev) { inp.addEventListener(ev, applyFilter); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } });
    }
    return true;
  }

  function wrapRenderSaved() {
    if (typeof window.renderSaved !== 'function') return;
    if (window.renderSaved._v440Wrapped || window.renderSaved._v442Wrapped ||
        window.renderSaved._v443Wrapped || window.renderSaved._v447Wrapped) return;
    var orig = window.renderSaved;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      try {
        if (r && typeof r.then === 'function') r.then(function () { setTimeout(function(){ ensureField(); _lastVal = null; applyFilter(); }, 0); });
        else setTimeout(function(){ ensureField(); _lastVal = null; applyFilter(); }, 0);
      } catch (e) { setTimeout(function(){ ensureField(); _lastVal = null; applyFilter(); }, 0); }
      return r;
    };
    wrapped._v447Wrapped = true;
    window.renderSaved = wrapped;
  }

  var tries = 0;
  (function boot() {
    var ok = ensureField();
    wrapRenderSaved();
    startWatcher();
    if (ok) { applyFilter(); return; }
    if (tries++ < 80) setTimeout(boot, 200);
  })();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function(){ ensureField(); startWatcher(); }, 300); });
  }
})();
