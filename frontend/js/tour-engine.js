/**
 * DealPilot V238.3 — Tour Engine
 *
 * V238.3 Fixes:
 * - SVG-Mask via clip-path: Overlay hat ECHTES LOCH an Spotlight-Position
 *   -> markiertes Element ist gestochen scharf, kein Blur drüber
 * - Hard-Fallback Smart-Placement (V238.2)
 * - Komma-Selektor-Split (V238.2)
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'dp_tour_completed_v1';

  var state = {
    steps: [],
    idx: 0,
    active: false,
    expanded: false,
    overlay: null,
    spotlight: null,
    bubble: null,
    onResize: null,
    onKeydown: null
  };

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
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
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

  function _switchToTab(targetSec) {
    if (targetSec === 's-quick') {
      if (typeof window.showQuickCheck === 'function') {
        window.showQuickCheck();
        return true;
      }
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

  // ─── V238.3: Echtes Loch im Overlay via clip-path ────────────────────

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

    // Spotlight = Gold-Border um das Loch
    state.spotlight.style.top    = y + 'px';
    state.spotlight.style.left   = x + 'px';
    state.spotlight.style.width  = w + 'px';
    state.spotlight.style.height = h + 'px';
    state.spotlight.style.display = 'block';

    // V238.3: Overlay bekommt clip-path mit Loch an Spotlight-Position
    // Polygon: außen rechteck, dann hineingehen, Loch rechteck, wieder raus
    if (state.overlay) {
      var path = 'polygon(' +
        '0 0, ' +
        vw + 'px 0, ' +
        vw + 'px ' + vh + 'px, ' +
        '0 ' + vh + 'px, ' +
        '0 0, ' +
        // Brücke zum Loch
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
    // Overlay-Loch entfernen (full coverage)
    if (state.overlay) {
      state.overlay.style.clipPath = '';
      state.overlay.style.webkitClipPath = '';
    }
  }

  // ─── Smart-Placement mit Hard-Fallback ───────────────────────────────

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

  // ─── Bubble-Content (Premium) ────────────────────────────────────────

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

  function _renderStep() {
    var step = state.steps[state.idx];
    if (!step) return;

    state.expanded = false;

    _ensureCorrectTab(step, function() {
      _findElementWithRetry(step.selector, 10, 200).then(function(el) {
        if (!el) {
          console.warn('[DpTour] Element nicht gefunden: ' + step.selector);
          if (step.placement === 'center') {
            _createOverlay();
            _hideSpotlight();
            _setBubbleCenter();
            _renderBubbleContent(step);
            return;
          }
          state.idx++;
          if (state.idx >= state.steps.length) {
            Tour.complete();
            return;
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
    if (step.tab === 'sidebar' || step.tab === 'header' || step.tab === 'settings') return callback();
    if (current === step.tab) return callback();
    var ok = _switchToTab(step.tab);
    if (!ok) {
      console.warn('[DpTour] Tab-Switch fehlgeschlagen: ' + step.tab);
    }
    setTimeout(callback, 400);
  }

  var Tour = {
    start: function() {
      var steps = window.DpTourSteps;
      if (!Array.isArray(steps) || steps.length === 0) {
        console.warn('[DpTour] Keine Steps geladen');
        return false;
      }
      state.steps = steps;
      state.idx = 0;
      state.expanded = false;
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

      _renderStep();
      return true;
    },

    next: function() {
      if (!state.active) return;
      if (state.idx >= state.steps.length - 1) {
        Tour.complete();
        return;
      }
      state.idx++;
      _renderStep();
    },

    prev: function() {
      if (!state.active || state.idx <= 0) return;
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
    }
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
  }

  window.DpTour = Tour;

  function _maybeAutoStart() {
    try {
      var token = localStorage.getItem('ji_token');
      if (!token) return;
      if (Tour.isComplete()) return;
      if (!Array.isArray(window.DpTourSteps) || !window.DpTourSteps.length) return;
      setTimeout(function() {
        if (!Tour.isComplete()) Tour.start();
      }, 1800);
    } catch(e) {
      console.warn('[DpTour] Auto-Start fehlgeschlagen:', e.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _maybeAutoStart);
  } else {
    setTimeout(_maybeAutoStart, 2500);
  }
})();
