/**
 * DealPilot V239 — Tour Engine mit Conditional Logic
 *
 * V239 Aenderungen:
 * - Tour erkennt automatisch ob User Objekte hat
 * - Bei Objekten: Variante "withObjects" (24 Steps)
 * - Ohne Objekte: Variante "empty" (Onboarding-Variante)
 * - Quick-Check Steps mit laengeren Retries und mehr Fallbacks
 * - Bug 1 GEFIXT: Tour startet immer bei Step 1
 * - prev()-Bug GEFIXT (state.direction)
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'dp_tour_completed_v1';

  var state = {
    steps: [],
    idx: 0,
    active: false,
    expanded: false,
    direction: 'next',
    variant: null,  // 'withObjects' | 'empty'
    overlay: null,
    spotlight: null,
    bubble: null,
    onResize: null,
    onKeydown: null
  };

  // ─── Helpers ─────────────────────────────────────────────────────────

  function _findElementWithRetry(selector, retries, intervalMs) {
    return new Promise(function(resolve) {
      var attempts = 0;
      function tryFind() {
        var selectors = selector.split(',').map(function(s) { return s.trim(); });
        for (var i = 0; i < selectors.length; i++) {
          try {
            var el = document.querySelector(selectors[i]);
            if (el && _isVisible(el)) return resolve(el);
          } catch(e) {}
        }
        attempts++;
        if (attempts >= retries) return resolve(null);
        setTimeout(tryFind, intervalMs);
      }
      tryFind();
    });
  }

  function _isVisible(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    var s = window.getComputedStyle(el);
    // V239.4: gated/disabled-Elemente (typisch opacity 0.4-0.5) trotzdem akzeptieren
    return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) >= 0.25;
  }

  function _scrollIntoView(el) {
    try {
      var mainCol = document.querySelector('.main-col');
      if (mainCol) {
        var rect = el.getBoundingClientRect();
        var mcRect = mainCol.getBoundingClientRect();
        var offset = rect.top - mcRect.top - 100;
        mainCol.scrollBy({ top: offset, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch(e) {}
  }

  function _currentSection() {
    var active = document.querySelector('.sec.active');
    return active ? active.id : null;
  }

  // V239: Robuste Quick-Check-Oeffnung mit Multi-Strategy
  // V239.2: PRIORITY auf echten Sidebar-Btn-Click — enterQuickCheckMode statt showQuickCheck
  // V239.3: QC-Modus verlassen wenn von s-quick weg zu regulaeren Tabs
  function _switchToTab(targetSec) {
    // V239.3: Wenn wir vom QC-Standalone-Modus weggehen (Body-Klasse aktiv)
    //   UND Ziel kein QC und keine Sidebar ist -> erst QC verlassen
    if (document.body.classList.contains('qc-standalone-active') &&
        targetSec !== 's-quick' &&
        targetSec !== 'sidebar') {
      console.log('[DpTour V239.3] Exit QC-Standalone-Mode for', targetSec);
      if (typeof window.exitQuickCheckMode === 'function') {
        try { window.exitQuickCheckMode(); } catch(e) {
          document.body.classList.remove('qc-standalone-active');
        }
      } else {
        document.body.classList.remove('qc-standalone-active');
      }
      // Nach exit: Standard-Tab aktivieren (sonst sieht User nichts)
      // Bei targetSec='s0' bis 's8' wird das gleich passieren
      // Bei header/settings: aktiviere s0 als Default
      if (targetSec === 'header' || targetSec === 'settings') {
        var s0Tab = document.querySelector('.tab[data-target-sec="s0"]');
        if (s0Tab) s0Tab.click();
      }
    }

    if (targetSec === 's-quick') {
      // 1) Schon offen?
      if (document.querySelector('#qc-score-circle, #qc-tab-host .ds-donut')) {
        return true;
      }
      // 2) PRIORITY V239.2: echten Sidebar-Button klicken (simuliert User)
      var sidebarBtn = document.querySelector(
        '.sb-act-accent[onclick*="quickcheck"], ' +
        'button[onclick*="sbActionsAction(\'quickcheck\')"]'
      );
      if (sidebarBtn) {
        try { sidebarBtn.click(); return true; } catch(e) {
          console.warn('[DpTour V239.2] sidebarBtn.click failed:', e);
        }
      }
      // 3) enterQuickCheckMode direkt
      if (typeof window.enterQuickCheckMode === 'function') {
        try { window.enterQuickCheckMode(); return true; } catch(e) {}
      }
      // 4) sbActionsAction Fallback
      if (typeof window.sbActionsAction === 'function') {
        try { window.sbActionsAction('quickcheck'); return true; } catch(e) {}
      }
      // 5) Letzter Notfall
      if (typeof window.showQuickCheck === 'function') {
        try { window.showQuickCheck(); return true; } catch(e) {}
      }
      console.warn('[DpTour V239.2] Quick-Check konnte nicht geoeffnet werden');
      return false;
    }
    if (targetSec === 'sidebar' || targetSec === 'header' || targetSec === 'settings') {
      return true;
    }
    var tab = document.querySelector('.tab[data-target-sec="' + targetSec + '"]');
    if (tab) {
      tab.click();
      return true;
    }
    return false;
  }

  // V239: Conditional Logic - hat User Objekte?
  function _hasUserObjects() {
    var sbList = document.querySelector('#sb-list');
    if (!sbList) return false;
    var cards = sbList.querySelectorAll('button, a, .sb-card, [data-obj-id], .sidebar-obj-card');
    if (cards.length > 0) return true;
    var children = sbList.children;
    return children && children.length > 0;
  }

  // V239.1: Stelle sicher, dass ein Objekt geladen ist (sonst leere Donuts)
  // V239.7: MouseEvent statt .click() weil Sidebar-Cards Event-Delegation nutzen
  function _ensureObjectLoaded() {
    return new Promise(function(resolve) {
      // Schon ein Objekt aktiv?
      var hdrObj = document.querySelector('#hdr-obj');
      if (hdrObj && hdrObj.textContent && hdrObj.textContent.trim() !== 'Neues Objekt') {
        return resolve(true);
      }
      var kp = document.querySelector('#kp');
      if (kp && kp.value && kp.value.length > 0) {
        return resolve(true);
      }
      // Erstes Sidebar-Element klicken via MouseEvent
      var firstItem = document.querySelector('#sb-list > .sb-card, #sb-list > *:first-child');
      if (firstItem) {
        try {
          firstItem.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window
          }));
        } catch(e) {
          try { firstItem.click(); } catch(e2) {
            console.warn('[DpTour V239.7] click failed:', e2);
          }
        }
        setTimeout(function() { resolve(true); }, 1800);
      } else {
        resolve(false);
      }
    });
  }

  // V239: Plan-Check
  function _getCurrentPlan() {
    try {
      if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.currentKey === 'function') {
        return DealPilotConfig.pricing.currentKey() || 'free';
      }
    } catch(e) {}
    return 'free';
  }

  // V239.4/.5: Sidebar-Aktionen-Accordion aufklappen wenn collapsed
  // V239.5: CSS-Override per !important auf OUTER-Accordion-Element
  //         (CSS macht .sb-actions-accordion { max-height: 0; overflow: hidden })
  function _expandSidebarActionsIfCollapsed() {
    try {
      var accordion = document.getElementById('sb-actions-accordion');
      if (!accordion) return;
      if (accordion.offsetHeight >= 100) return;  // schon offen
      
      console.log('[DpTour V239.5] Brute-force expand accordion (was:', accordion.offsetHeight + 'px)');
      
      // Brute-Force CSS-Override per !important (CSS hat max-height: 0)
      accordion.style.cssText += 
        '; height: auto !important' +
        '; min-height: 400px !important' +
        '; max-height: none !important' +
        '; overflow: visible !important' +
        '; display: block !important';
      
      // Inner auch
      var inner = accordion.querySelector('.sb-actions-accordion-inner');
      if (inner) {
        inner.style.cssText += 
          '; height: auto !important' +
          '; max-height: none !important' +
          '; overflow: visible !important' +
          '; display: block !important';
      }
      
      // Scroll Sidebar zur Accordion damit User es sieht
      var sidebar = document.querySelector('aside.sidebar');
      if (sidebar) {
        var accTop = accordion.offsetTop;
        sidebar.scrollTop = Math.max(0, accTop - 50);
      }
      
      // Markiere fuer cleanup
      accordion.setAttribute('data-tour-expanded', '1');
      if (inner) inner.setAttribute('data-tour-expanded', '1');
    } catch(e) {
      console.warn('[DpTour V239.5] _expandSidebar error:', e);
    }
  }

  // V239.5: Cleanup nach Tour - Style-Overrides entfernen
  function _restoreSidebarAccordion() {
    try {
      document.querySelectorAll('[data-tour-expanded="1"]').forEach(function(el) {
        el.style.cssText = '';
        el.removeAttribute('data-tour-expanded');
      });
    } catch(e) {}
  }

  // ─── Overlay ─────────────────────────────────────────────────────────

  function _createOverlay() {
    if (state.overlay) return;
    var o = document.createElement('div');
    o.className = 'dp-tour-overlay';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    document.body.appendChild(o);
    state.overlay = o;

    var s = document.createElement('div');
    s.className = 'dp-tour-spotlight';
    document.body.appendChild(s);
    state.spotlight = s;

    var b = document.createElement('div');
    b.className = 'dp-tour-bubble';
    document.body.appendChild(b);
    state.bubble = b;

    document.body.classList.add('dp-tour-active');
  }

  function _destroyOverlay() {
    [state.overlay, state.spotlight, state.bubble].forEach(function(el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    state.overlay = null;
    state.spotlight = null;
    state.bubble = null;
    document.body.classList.remove('dp-tour-active');
  }

  function _positionSpotlight(el) {
    if (!state.spotlight || !el) return;
    var rect = el.getBoundingClientRect();
    var pad = 8;
    var x = rect.left - pad;
    var y = rect.top - pad;
    var w = rect.width + pad * 2;
    var h = rect.height + pad * 2;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    state.spotlight.style.top    = y + 'px';
    state.spotlight.style.left   = x + 'px';
    state.spotlight.style.width  = w + 'px';
    state.spotlight.style.height = h + 'px';
    state.spotlight.style.display = 'block';

    if (state.overlay) {
      var path = 'polygon(' +
        '0 0, ' +
        vw + 'px 0, ' +
        vw + 'px ' + vh + 'px, ' +
        '0 ' + vh + 'px, ' +
        '0 0, ' +
        x + 'px ' + y + 'px, ' +
        x + 'px ' + (y + h) + 'px, ' +
        (x + w) + 'px ' + (y + h) + 'px, ' +
        (x + w) + 'px ' + y + 'px, ' +
        x + 'px ' + y + 'px, ' +
        '0 0' +
        ')';
      state.overlay.style.clipPath = path;
      state.overlay.style.webkitClipPath = path;
    }
  }

  function _hideSpotlight() {
    if (state.spotlight) state.spotlight.style.display = 'none';
    if (state.overlay) {
      state.overlay.style.clipPath = '';
      state.overlay.style.webkitClipPath = '';
    }
  }

  // ─── Placement ───────────────────────────────────────────────────────

  function _hasSpaceForPlacement(rect, bw, bh, placement, margin) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    switch (placement) {
      case 'bottom': return (rect.bottom + bh + margin) <= vh;
      case 'top':    return (rect.top - bh - margin) >= 0;
      case 'right':  return (rect.right + bw + margin) <= vw;
      case 'left':   return (rect.left - bw - margin) >= 0;
      default:       return false;
    }
  }

  function _autoPickPlacement(rect, bw, bh, margin) {
    var candidates = ['bottom', 'top', 'right', 'left'];
    for (var i = 0; i < candidates.length; i++) {
      if (_hasSpaceForPlacement(rect, bw, bh, candidates[i], margin)) {
        return candidates[i];
      }
    }
    return 'center';
  }

  function _positionBubble(el, preferredPlacement) {
    if (!state.bubble) return;

    if (!el || preferredPlacement === 'center') {
      _setBubbleCenter();
      return;
    }

    state.bubble.classList.remove('dp-tour-bubble-center');

    var rect = el.getBoundingClientRect();
    var bw = state.bubble.offsetWidth || 460;
    var bh = state.bubble.offsetHeight || 280;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 24;

    var placement = preferredPlacement || 'auto';

    if (placement !== 'auto' && !_hasSpaceForPlacement(rect, bw, bh, placement, margin)) {
      placement = 'auto';
    }

    if (placement === 'auto') {
      placement = _autoPickPlacement(rect, bw, bh, margin);
    }

    if (placement === 'center') {
      _setBubbleCenter();
      return;
    }

    var top, left;
    state.bubble.style.transform = '';

    switch (placement) {
      case 'bottom':
        top  = rect.bottom + 16;
        left = Math.max(margin, Math.min(vw - bw - margin, rect.left + rect.width / 2 - bw / 2));
        break;
      case 'top':
        top  = rect.top - bh - 16;
        left = Math.max(margin, Math.min(vw - bw - margin, rect.left + rect.width / 2 - bw / 2));
        break;
      case 'right':
        top  = Math.max(margin, Math.min(vh - bh - margin, rect.top + rect.height / 2 - bh / 2));
        left = rect.right + 16;
        break;
      case 'left':
        top  = Math.max(margin, Math.min(vh - bh - margin, rect.top + rect.height / 2 - bh / 2));
        left = rect.left - bw - 16;
        break;
    }

    state.bubble.style.top  = top  + 'px';
    state.bubble.style.left = left + 'px';
    state.bubble.classList.remove('dp-tour-bubble-top', 'dp-tour-bubble-bottom', 'dp-tour-bubble-left', 'dp-tour-bubble-right');
    state.bubble.classList.add('dp-tour-bubble-' + placement);
  }

  function _setBubbleCenter() {
    if (!state.bubble) return;
    state.bubble.style.top = '50%';
    state.bubble.style.left = '50%';
    state.bubble.style.transform = 'translate(-50%, -50%)';
    state.bubble.classList.remove('dp-tour-bubble-top', 'dp-tour-bubble-bottom', 'dp-tour-bubble-left', 'dp-tour-bubble-right');
    state.bubble.classList.add('dp-tour-bubble-center');
  }

  // ─── Content rendern ─────────────────────────────────────────────────

  function _renderBubbleContent(step) {
    if (!state.bubble) return;
    var total = state.steps.length;
    var stepNo = state.idx + 1;
    var progressPct = Math.round((stepNo / total) * 100);

    var isFirst = state.idx === 0;
    var isLast = state.idx === total - 1;

    var iconId = step.icon || 'i-bulb';
    var hasMore = !!step.bodyMore;

    var html = '';
    html += '<div class="dp-tour-close-wrap">';
    html += '  <button class="dp-tour-close" type="button" aria-label="Tour schliessen">';
    html += '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '  </button>';
    html += '</div>';

    html += '<div class="dp-tour-head">';
    html += '  <div class="dp-tour-eyebrow">';
    html += '    <span class="dp-tour-eyebrow-ic"><svg><use href="#' + iconId + '"/></svg></span>';
    html += '    Schritt ' + stepNo + ' von ' + total;
    html += '  </div>';
    html += '  <h2 class="dp-tour-title">' + _escapeHtml(step.title || '') + '</h2>';
    html += '</div>';

    html += '<div class="dp-tour-body">';
    html += '  <div class="dp-tour-text dp-tour-text-short">' + _renderMarkdown(step.body || '') + '</div>';

    // V239.6: Custom-Action — Tool-Tip-Mode Toggle direkt in der Bubble
    if (step.customAction === 'tooltip-mode') {
      var currentMode = 'beginner';
      try {
        if (window.DpTip && typeof window.DpTip.getMode === 'function') {
          currentMode = window.DpTip.getMode() || 'beginner';
        }
      } catch(e) {}
      html += '  <div class="dp-tour-toggle-row">';
      html += '    <button class="dp-tour-toggle-btn ' + (currentMode === 'off' ? 'active' : '') + '" data-tt-mode="off">Aus</button>';
      html += '    <button class="dp-tour-toggle-btn ' + (currentMode === 'pro' ? 'active' : '') + '" data-tt-mode="pro">Profi</button>';
      html += '    <button class="dp-tour-toggle-btn ' + (currentMode === 'beginner' ? 'active' : '') + '" data-tt-mode="beginner">Anfaenger</button>';
      html += '  </div>';
      html += '  <div class="dp-tour-toggle-status" id="dp-tour-tt-status">Aktueller Modus: <strong>' + (currentMode === 'off' ? 'Aus' : currentMode === 'pro' ? 'Profi' : 'Anfaenger') + '</strong></div>';
    }

    if (hasMore) {
      var expandedClass = state.expanded ? 'dp-tour-expanded' : '';
      html += '  <button class="dp-tour-more-toggle ' + expandedClass + '" type="button" data-action="toggle-more">';
      html += '    <span class="dp-tour-more-text">' + (state.expanded ? 'Weniger anzeigen' : 'Mehr erfahren') + '</span>';
      html += '    <svg class="dp-tour-more-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      html += '  </button>';
      if (state.expanded) {
        html += '  <div class="dp-tour-text dp-tour-text-more">' + _renderMarkdown(step.bodyMore) + '</div>';
      }
    }
    html += '</div>';

    html += '<div class="dp-tour-progress">';
    html += '  <div class="dp-tour-progress-bar"><div class="dp-tour-progress-fill" style="width:' + progressPct + '%"></div></div>';
    html += '</div>';

    html += '<div class="dp-tour-foot">';
    html += '  <button type="button" class="dp-tour-btn dp-tour-btn-ghost" data-action="skip">Tour ueberspringen</button>';
    html += '  <div class="dp-tour-nav">';
    if (!isFirst) {
      html += '    <button type="button" class="dp-tour-btn dp-tour-btn-secondary" data-action="prev">';
      html += '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
      html += '      Zurueck';
      html += '    </button>';
    }
    if (isLast) {
      html += '    <button type="button" class="dp-tour-btn dp-tour-btn-primary" data-action="complete">';
      html += '      Fertig';
      html += '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      html += '    </button>';
    } else {
      html += '    <button type="button" class="dp-tour-btn dp-tour-btn-primary" data-action="next">';
      html += '      Weiter';
      html += '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
      html += '    </button>';
    }
    html += '  </div>';
    html += '</div>';

    state.bubble.innerHTML = html;

    var closeBtn = state.bubble.querySelector('.dp-tour-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { Tour.exit(); });
    var btnNext = state.bubble.querySelector('[data-action="next"]');
    if (btnNext) btnNext.addEventListener('click', function() { Tour.next(); });
    var btnPrev = state.bubble.querySelector('[data-action="prev"]');
    if (btnPrev) btnPrev.addEventListener('click', function() { Tour.prev(); });
    var btnSkip = state.bubble.querySelector('[data-action="skip"]');
    if (btnSkip) btnSkip.addEventListener('click', function() { Tour.skip(); });
    var btnDone = state.bubble.querySelector('[data-action="complete"]');
    if (btnDone) btnDone.addEventListener('click', function() { Tour.complete(); });
    var btnMore = state.bubble.querySelector('[data-action="toggle-more"]');
    if (btnMore) btnMore.addEventListener('click', function() { Tour.toggleMore(); });
    
    // V239.6: Tool-Tip-Mode Toggle-Buttons
    var ttBtns = state.bubble.querySelectorAll('.dp-tour-toggle-btn[data-tt-mode]');
    ttBtns.forEach(function(b) {
      b.addEventListener('click', function() {
        var mode = b.getAttribute('data-tt-mode');
        try {
          if (window.DpTip && typeof window.DpTip.setMode === 'function') {
            window.DpTip.setMode(mode);
          }
        } catch(e) { console.warn('[DpTour V239.6] DpTip.setMode error:', e); }
        // UI: active-Klasse umsetzen
        ttBtns.forEach(function(o) { o.classList.remove('active'); });
        b.classList.add('active');
        // Status-Text updaten
        var status = state.bubble.querySelector('#dp-tour-tt-status');
        if (status) {
          var label = mode === 'off' ? 'Aus' : mode === 'pro' ? 'Profi' : 'Anfaenger';
          status.innerHTML = 'Aktueller Modus: <strong>' + label + '</strong> ✓';
        }
      });
    });
  }

  function _escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _renderMarkdown(s) {
    s = String(s);
    var allowed = /<\/?(?:b|strong|i|em|br|u)\s*\/?>/gi;
    var placeholders = [];
    s = s.replace(allowed, function(m) {
      placeholders.push(m);
      return '\u0001' + (placeholders.length - 1) + '\u0001';
    });
    s = _escapeHtml(s);
    s = s.replace(/\u0001(\d+)\u0001/g, function(m, i) { return placeholders[+i]; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n\n/g, '<br><br>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  // ─── Step rendern (mit V239 robusten Retries) ────────────────────────

  function _renderStep() {
    if (!state.active) return;  // V239.1: kein Render wenn cleanup laeuft
    var step = state.steps[state.idx];
    if (!step) return;

    state.expanded = false;

    _ensureCorrectTab(step, function() {
      // V239: Laengere Retries fuer s-quick und s8 (dynamisch gerendert)
      // V239.2: s-quick auf 20x300ms = 6s erhoeht
      var retries = 10;
      var interval = 200;
      if (step.tab === 's-quick') {
        retries = 20;
        interval = 300;
      } else if (step.tab === 's8') {
        retries = 15;
        interval = 300;
      }

      _findElementWithRetry(step.selector, retries, interval).then(function(el) {
        if (!el) {
          console.warn('[DpTour V239] Element nicht gefunden: ' + step.selector + ' (Step ' + (state.idx + 1) + ')');
          if (step.placement === 'center') {
            _createOverlay();
            _hideSpotlight();
            _setBubbleCenter();
            _renderBubbleContent(step);
            return;
          }
          // V238.4: Auto-Skip respektiert Richtung
          if (state.direction === 'prev') {
            if (state.idx <= 0) {
              state.idx = 0;
              _createOverlay();
              _hideSpotlight();
              _setBubbleCenter();
              _renderBubbleContent(step);
              return;
            }
            state.idx--;
          } else {
            state.idx++;
            if (state.idx >= state.steps.length) {
              Tour.complete();
              return;
            }
          }
          return _renderStep();
        }

        _scrollIntoView(el);

        setTimeout(function() {
          _createOverlay();
          _positionSpotlight(el);
          _renderBubbleContent(step);
          setTimeout(function() {
            _positionBubble(el, step.placement);
          }, 30);
        }, 450);
      });
    });
  }

  function _ensureCorrectTab(step, callback) {
    if (!step.tab) return callback();
    var current = _currentSection();
    
    // V239.7: Bei Sidebar-Steps: Accordion aufklappen + WARTEN bis Render
    if (step.tab === 'sidebar') {
      _expandSidebarActionsIfCollapsed();
      // Doppel-Expand: einmal sofort, einmal nach 200ms (CSS-Animation)
      setTimeout(function() {
        _expandSidebarActionsIfCollapsed();
        callback();
      }, 300);
      return;
    }
    
    if (step.tab === 'header' || step.tab === 'settings') {
      return callback();
    }
    
    // V239.7: Vor Tab-Steps (s0-s8, ausser s-quick): Stelle sicher dass ein
    //   Objekt aktiv ist. User kann nach Step 6 (QC-Save) ein neues Objekt
    //   angelegt haben, aber das Original-Demo-Objekt sollte fuer die
    //   Tab-Tour wieder aktiv sein.
    if (step.tab && step.tab.indexOf('s') === 0 && step.tab !== 's-quick') {
      var hdrObj = document.querySelector('#hdr-obj');
      var noObject = !hdrObj || !hdrObj.textContent || hdrObj.textContent.trim() === 'Neues Objekt';
      if (noObject) {
        console.log('[DpTour V239.7] Kein Objekt aktiv -> erstes Sidebar-Item klicken');
        var firstCard = document.querySelector('#sb-list > .sb-card, #sb-list > *:first-child');
        if (firstCard) {
          try {
            firstCard.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, view: window
            }));
          } catch(e) {
            try { firstCard.click(); } catch(e2) {}
          }
          // Warten bis Objekt geladen, DANN Tab-Switch
          setTimeout(function() {
            if (current !== step.tab) _switchToTab(step.tab);
            setTimeout(callback, 600);
          }, 1500);
          return;
        }
      }
    }
    
    if (current === step.tab) return callback();
    var ok = _switchToTab(step.tab);
    if (!ok) {
      console.warn('[DpTour V239] Tab-Switch fehlgeschlagen: ' + step.tab);
    }
    // V239: Laengere Pause fuer s-quick/s8 die dynamisch rendern
    var pause = 400;
    if (step.tab === 's-quick') pause = 1500;
    if (step.tab === 's8') pause = 1500;
    // V239.3: Wenn vorheriger Step in QC war und jetzt rauswechseln -> mehr Zeit
    if (document.body.classList.contains('qc-standalone-active') === false &&
        step.tab && step.tab.indexOf('s') === 0 && step.tab !== 's-quick' &&
        state.idx > 0 &&
        state.steps[state.idx - 1] && state.steps[state.idx - 1].tab === 's-quick') {
      pause = 900;
    }
    setTimeout(callback, pause);
  }

  // ─── Public API ──────────────────────────────────────────────────────

  var Tour = {
    start: function() {
      // V239: Variant Selector
      var variants = window.DpTourVariants;
      if (!variants || (!variants.withObjects && !variants.empty)) {
        console.warn('[DpTour V239] Keine Varianten geladen');
        return false;
      }

      var hasObjects = _hasUserObjects();
      state.variant = hasObjects ? 'withObjects' : 'empty';
      state.steps = variants[state.variant] || variants.withObjects || variants.empty;

      console.log('[DpTour V239.1] Variante:', state.variant, '|', state.steps.length, 'Steps');

      if (!Array.isArray(state.steps) || state.steps.length === 0) {
        console.warn('[DpTour V239] Steps leer');
        return false;
      }

      state.idx = 0;
      state.expanded = false;
      state.direction = 'next';
      state.active = true;

      state.onResize = function() {
        var step = state.steps[state.idx];
        if (!step) return;
        var el = document.querySelector(step.selector.split(',')[0].trim());
        if (el) {
          _positionSpotlight(el);
          _positionBubble(el, step.placement);
        }
      };
      window.addEventListener('resize', state.onResize);
      window.addEventListener('scroll', state.onResize, true);

      state.onKeydown = function(e) {
        if (!state.active) return;
        if (e.key === 'Escape') { e.preventDefault(); Tour.exit(); }
        else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); Tour.next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); Tour.prev(); }
      };
      document.addEventListener('keydown', state.onKeydown);

      // V239.1: Erst Objekt laden, dann Tour starten
      if (hasObjects) {
        _ensureObjectLoaded().then(function() {
          console.log('[DpTour V239.1] Object load attempt finished, rendering Step 1');
          _renderStep();
        });
      } else {
        _renderStep();
      }
      return true;
    },

    next: function() {
      if (!state.active) return;
      // V239.1: Bei letztem Step direkt komplettieren, kein weiterer Render
      if (state.idx >= state.steps.length - 1) {
        Tour.complete();
        return;
      }
      state.direction = 'next';
      state.idx++;
      _renderStep();
    },

    prev: function() {
      if (!state.active || state.idx <= 0) return;
      state.direction = 'prev';
      state.idx--;
      _renderStep();
    },

    skip: function() {
      Tour.complete();
    },

    exit: function() {
      _cleanup();
    },

    complete: function() {
      if (!state.active) return;  // V239.1: doppel-Aufrufe schlucken
      state.active = false;  // V239.1: SOFORT deaktivieren
      try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch(e) {}
      _cleanup();
    },

    isComplete: function() {
      try { return !!localStorage.getItem(STORAGE_KEY); } catch(e) { return false; }
    },

    reset: function() {
      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    },

    toggleMore: function() {
      state.expanded = !state.expanded;
      var step = state.steps[state.idx];
      if (!step) return;
      _renderBubbleContent(step);
      setTimeout(function() {
        var el = document.querySelector(step.selector.split(',')[0].trim());
        if (el) _positionBubble(el, step.placement);
      }, 30);
    },

    // V239: Plan-Check fuer Tour-Inhalte
    getPlan: function() { return _getCurrentPlan(); },
    hasUserObjects: function() { return _hasUserObjects(); }
  };

  function _cleanup() {
    state.active = false;
    if (state.onResize) {
      window.removeEventListener('resize', state.onResize);
      window.removeEventListener('scroll', state.onResize, true);
      state.onResize = null;
    }
    if (state.onKeydown) {
      document.removeEventListener('keydown', state.onKeydown);
      state.onKeydown = null;
    }
    _destroyOverlay();
    // V239.5: Sidebar-Accordion Style-Overrides entfernen
    _restoreSidebarAccordion();
  }

  window.DpTour = Tour;

  function _maybeAutoStart() {
    try {
      var token = localStorage.getItem('ji_token');
      if (!token) return;
      if (Tour.isComplete()) return;
      if (!window.DpTourVariants) return;
      // V239: Laengere Wartezeit damit Sidebar fertig rendert
      setTimeout(function() {
        if (!Tour.isComplete()) Tour.start();
      }, 2500);
    } catch(e) {
      console.warn('[DpTour V239] Auto-Start fehlgeschlagen:', e.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _maybeAutoStart);
  } else {
    setTimeout(_maybeAutoStart, 3000);
  }
})();
