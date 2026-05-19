/**
 * DealPilot V238 — First-Start-Tour Engine
 *
 * Modernes Glassmorphism-Overlay mit Spotlight-Highlight.
 * 12 Schritte führen Neukunden durch alle wichtigen Bereiche der App.
 *
 * Public API:
 *   window.DpTour.start()        — startet Tour (auch wieder bei nochmal-Aufruf)
 *   window.DpTour.next()         — nächster Schritt
 *   window.DpTour.prev()         — voriger Schritt
 *   window.DpTour.skip()         — alle weiteren Schritte überspringen (markiert als completed)
 *   window.DpTour.exit()         — Tour schließen (markiert NICHT als completed → kommt nächstes Mal wieder)
 *   window.DpTour.complete()     — Tour als abgeschlossen markieren
 *   window.DpTour.isComplete()   — checkt ob User Tour schon gemacht hat
 *   window.DpTour.reset()        — löscht Completed-Marker (für "Tour nochmal starten")
 *
 * Tour-Steps werden via window.DpTourSteps (tour-content.js) geladen.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'dp_tour_completed_v1';

  // ─── State ────────────────────────────────────────────────────────────
  var state = {
    steps: [],
    idx: 0,
    active: false,
    overlay: null,
    spotlight: null,
    bubble: null,
    onResize: null,
    onKeydown: null
  };

  // ─── Utility-Funktionen ───────────────────────────────────────────────

  function _wait(ms) {
    return new Promise(function(r) { setTimeout(r, ms); });
  }

  function _findElementWithRetry(selector, retries, intervalMs) {
    return new Promise(function(resolve) {
      var attempts = 0;
      function tryFind() {
        var el = document.querySelector(selector);
        if (el && _isVisible(el)) return resolve(el);
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
    // V236-Lesson: scrollen muss via .main-col, nicht window
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
    // Quick-Check ist Standalone-View
    if (targetSec === 's-quick') {
      if (typeof window.showQuickCheck === 'function') {
        window.showQuickCheck();
        return true;
      }
      return false;
    }
    // Sidebar/Header sind keine Tabs
    if (targetSec === 'sidebar' || targetSec === 'header') {
      return true;
    }
    // Standard-Tabs s0-s8
    var tab = document.querySelector('.tab[data-target-sec="' + targetSec + '"]');
    if (tab) {
      tab.click();
      return true;
    }
    return false;
  }

  // ─── Glassmorphism-Overlay-Erstellung ─────────────────────────────────

  function _createOverlay() {
    if (state.overlay) return;
    var o = document.createElement('div');
    o.className = 'dp-tour-overlay';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', 'DealPilot Einführungstour');
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

    // Sofort body-Klasse für UI-Sperren (kein Scroll der Hauptseite)
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

  // ─── Spotlight-Positionierung ─────────────────────────────────────────

  function _positionSpotlight(el) {
    if (!state.spotlight || !el) return;
    var rect = el.getBoundingClientRect();
    var pad = 8;
    state.spotlight.style.top    = (rect.top - pad) + 'px';
    state.spotlight.style.left   = (rect.left - pad) + 'px';
    state.spotlight.style.width  = (rect.width + pad * 2) + 'px';
    state.spotlight.style.height = (rect.height + pad * 2) + 'px';
    state.spotlight.style.display = 'block';
  }

  function _hideSpotlight() {
    if (state.spotlight) state.spotlight.style.display = 'none';
  }

  // ─── Bubble-Positionierung (smart placement) ──────────────────────────

  function _positionBubble(el, preferredPlacement) {
    if (!state.bubble) return;

    // Falls kein Element: Bubble zentriert anzeigen
    if (!el || preferredPlacement === 'center') {
      state.bubble.style.top = '50%';
      state.bubble.style.left = '50%';
      state.bubble.style.transform = 'translate(-50%, -50%)';
      state.bubble.classList.remove('dp-tour-bubble-top', 'dp-tour-bubble-bottom', 'dp-tour-bubble-left', 'dp-tour-bubble-right');
      state.bubble.classList.add('dp-tour-bubble-center');
      return;
    }

    state.bubble.classList.remove('dp-tour-bubble-center');

    var rect = el.getBoundingClientRect();
    var bw = state.bubble.offsetWidth || 360;
    var bh = state.bubble.offsetHeight || 200;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 20;

    var placement = preferredPlacement || 'auto';

    // Auto-Erkennung wenn nichts vorgegeben
    if (placement === 'auto') {
      if (rect.bottom + bh + margin < vh)      placement = 'bottom';
      else if (rect.top - bh - margin > 0)     placement = 'top';
      else if (rect.right + bw + margin < vw)  placement = 'right';
      else if (rect.left - bw - margin > 0)    placement = 'left';
      else                                     placement = 'center';
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
      default: // center
        state.bubble.classList.add('dp-tour-bubble-center');
        return _positionBubble(null, 'center');
    }

    state.bubble.style.top  = top  + 'px';
    state.bubble.style.left = left + 'px';
    state.bubble.classList.remove('dp-tour-bubble-top', 'dp-tour-bubble-bottom', 'dp-tour-bubble-left', 'dp-tour-bubble-right');
    state.bubble.classList.add('dp-tour-bubble-' + placement);
  }

  // ─── Bubble-Content-Rendering ─────────────────────────────────────────

  function _renderBubbleContent(step) {
    if (!state.bubble) return;
    var total = state.steps.length;
    var stepNo = state.idx + 1;
    var progressPct = Math.round((stepNo / total) * 100);

    var isFirst = state.idx === 0;
    var isLast = state.idx === total - 1;

    var html = '';
    html += '<div class="dp-tour-bubble-header">';
    html += '  <div class="dp-tour-step-counter">Schritt ' + stepNo + ' von ' + total + '</div>';
    html += '  <button class="dp-tour-close" type="button" aria-label="Tour schließen">×</button>';
    html += '</div>';
    html += '<div class="dp-tour-bubble-body">';
    html += '  <div class="dp-tour-title">' + _escapeHtml(step.title || '') + '</div>';
    html += '  <div class="dp-tour-text">' + _renderMarkdown(step.body || '') + '</div>';
    html += '</div>';
    html += '<div class="dp-tour-progress">';
    html += '  <div class="dp-tour-progress-bar"><div class="dp-tour-progress-fill" style="width:' + progressPct + '%"></div></div>';
    html += '</div>';
    html += '<div class="dp-tour-bubble-footer">';
    html += '  <button type="button" class="dp-tour-btn dp-tour-btn-ghost" data-action="skip">Tour überspringen</button>';
    html += '  <div class="dp-tour-nav">';
    if (!isFirst) {
      html += '    <button type="button" class="dp-tour-btn dp-tour-btn-secondary" data-action="prev">← Zurück</button>';
    }
    if (isLast) {
      html += '    <button type="button" class="dp-tour-btn dp-tour-btn-primary" data-action="complete">Fertig ✓</button>';
    } else {
      html += '    <button type="button" class="dp-tour-btn dp-tour-btn-primary" data-action="next">Weiter →</button>';
    }
    html += '  </div>';
    html += '</div>';

    state.bubble.innerHTML = html;

    // Event-Handlers
    state.bubble.querySelector('.dp-tour-close').addEventListener('click', function() { Tour.exit(); });
    var btnNext = state.bubble.querySelector('[data-action="next"]');
    if (btnNext) btnNext.addEventListener('click', function() { Tour.next(); });
    var btnPrev = state.bubble.querySelector('[data-action="prev"]');
    if (btnPrev) btnPrev.addEventListener('click', function() { Tour.prev(); });
    var btnSkip = state.bubble.querySelector('[data-action="skip"]');
    if (btnSkip) btnSkip.addEventListener('click', function() { Tour.skip(); });
    var btnDone = state.bubble.querySelector('[data-action="complete"]');
    if (btnDone) btnDone.addEventListener('click', function() { Tour.complete(); });
  }

  function _escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _renderMarkdown(s) {
    // Whitelist-Approach: bestehender HTML im Body wird durchgereicht, aber nur
    // sichere Tags. Plus Markdown-mini: *fett* und ||Sektion||
    s = String(s);
    // Erlaubt: <b>, <strong>, <i>, <em>, <br>
    // Alles andere: escape
    var allowed = /<\/?(?:b|strong|i|em|br)\s*\/?>/gi;
    var placeholders = [];
    s = s.replace(allowed, function(m) {
      placeholders.push(m);
      return '\u0001' + (placeholders.length - 1) + '\u0001';
    });
    s = _escapeHtml(s);
    s = s.replace(/\u0001(\d+)\u0001/g, function(m, i) { return placeholders[+i]; });
    // Mini-Markdown
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n\n/g, '<br><br>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  // ─── Tour-Step ausführen ──────────────────────────────────────────────

  function _renderStep() {
    var step = state.steps[state.idx];
    if (!step) return;

    _ensureCorrectTab(step, function() {
      // Element finden mit Retries (Tab-Wechsel braucht Zeit)
      _findElementWithRetry(step.selector, 8, 150).then(function(el) {
        if (!el) {
          // Element nicht gefunden — Schritt überspringen
          console.warn('[DpTour] Element nicht gefunden für Step ' + (state.idx + 1) + ': ' + step.selector);
          // Falls placement='center' war, ist das gewollt (Step ohne Spotlight)
          if (step.placement === 'center') {
            _createOverlay();
            _hideSpotlight();
            _positionBubble(null, 'center');
            _renderBubbleContent(step);
            return;
          }
          // Sonst: Auto-Skip zum nächsten Step
          state.idx++;
          if (state.idx >= state.steps.length) {
            Tour.complete();
            return;
          }
          return _renderStep();
        }

        _scrollIntoView(el);

        // Kurz warten bis Scroll fertig, dann Spotlight setzen
        setTimeout(function() {
          _createOverlay();
          _positionSpotlight(el);
          _renderBubbleContent(step);
          // Bubble nach Render positionieren (braucht offsetWidth/Height)
          setTimeout(function() {
            _positionBubble(el, step.placement);
          }, 10);
        }, 400);
      });
    });
  }

  function _ensureCorrectTab(step, callback) {
    if (!step.tab) return callback();
    var current = _currentSection();
    // Sidebar/Header sind keine Tabs
    if (step.tab === 'sidebar' || step.tab === 'header') return callback();
    if (current === step.tab) return callback();
    var ok = _switchToTab(step.tab);
    if (!ok) {
      console.warn('[DpTour] Tab-Switch fehlgeschlagen: ' + step.tab);
    }
    // Tab-Wechsel-Animation abwarten
    setTimeout(callback, 350);
  }

  // ─── Public API ───────────────────────────────────────────────────────

  var Tour = {
    start: function() {
      var steps = window.DpTourSteps;
      if (!Array.isArray(steps) || steps.length === 0) {
        console.warn('[DpTour] Keine Steps geladen (window.DpTourSteps fehlt)');
        return false;
      }
      state.steps = steps;
      state.idx = 0;
      state.active = true;

      // Resize-Handler für Re-Positionierung
      state.onResize = function() {
        var step = state.steps[state.idx];
        if (!step) return;
        var el = document.querySelector(step.selector);
        if (el) {
          _positionSpotlight(el);
          _positionBubble(el, step.placement);
        }
      };
      window.addEventListener('resize', state.onResize);
      window.addEventListener('scroll', state.onResize, true);

      // Keyboard-Nav: ESC=exit, Enter/→=next, ←=prev
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
      // Schließen ohne als completed zu markieren — Tour kommt nächstes Mal wieder
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

  // ─── Auto-Start nach Login (falls noch nicht abgeschlossen) ───────────
  function _maybeAutoStart() {
    try {
      var token = localStorage.getItem('ji_token');
      if (!token) return; // Nicht eingeloggt
      if (Tour.isComplete()) return; // Schon gemacht
      // Tour-Content muss geladen sein
      if (!Array.isArray(window.DpTourSteps) || !window.DpTourSteps.length) return;
      // Verzögerung: warten bis App fertig gerendert ist
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
    // Doppel-Schutz: kurz warten falls andere Skripte noch laufen
    setTimeout(_maybeAutoStart, 2500);
  }

  // Auch nach Login-Reload: location.reload() in auth.js Z. 411 → DOM neu, Trigger feuert
})();
