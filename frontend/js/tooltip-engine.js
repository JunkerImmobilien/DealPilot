'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DealPilot V228 — Tooltip-Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Rendert Popup-Tooltips und InfoBoxen auf Basis der zentralen
 * tooltip-content.js Library.
 *
 * Drei Modi (User-Setting, gespeichert in localStorage):
 *   - 'off'      → alle Tooltips komplett versteckt
 *   - 'pro'      → nur 'pro' und 'critical' (kein beginner-Krimskrams)
 *   - 'beginner' → alle Tooltips sichtbar (Default)
 *
 * Format pro Tooltip:
 *   - tooltip:  ⓘ-Icon → Popup beim Klick/Hover
 *   - infobox:  permanente InfoBox unter dem Feld
 *
 * Wer Engine konsumiert:
 *   - HTML-Patches: <label>Feld <button class="dp-tip" data-tip-id="tab2.kp"></button></label>
 *   - InfoBoxen: <div class="dp-tip-infobox" data-tip-id="tab2.15prozent_grenze"></div>
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_KEY = 'dp_tooltip_mode';
  var DEFAULT_MODE = 'beginner';
  var VALID_MODES = ['off', 'pro', 'beginner'];

  // ───── Storage ─────────────────────────────────────────────────────────
  function getMode() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (VALID_MODES.indexOf(v) >= 0) return v;
    } catch (e) {}
    return DEFAULT_MODE;
  }

  function setMode(mode) {
    if (VALID_MODES.indexOf(mode) < 0) return false;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      applyMode();
      return true;
    } catch (e) {
      console.warn('Tooltip-Mode konnte nicht gespeichert werden:', e);
      return false;
    }
  }

  // ───── Severity-Filter ─────────────────────────────────────────────────
  /**
   * Soll ein Tooltip mit gegebenem Severity im aktuellen Mode sichtbar sein?
   */
  function shouldShow(severity, mode) {
    mode = mode || getMode();
    if (mode === 'off') return false;
    if (mode === 'pro') {
      return severity === 'pro' || severity === 'critical';
    }
    // beginner: alles
    return true;
  }

  // ───── DOM-Helpers ─────────────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ───── Mode anwenden — Tooltips anzeigen/verstecken ────────────────────
  /**
   * Wird aufgerufen bei Mode-Wechsel und bei DOMContentLoaded.
   * Geht alle dp-tip Buttons und dp-tip-infobox durch und entscheidet pro Element
   * ob sichtbar oder nicht.
   */
  function applyMode() {
    var mode = getMode();
    var content = (window.DpTooltips && window.DpTooltips.content) || {};

    // ⓘ-Icons
    var tips = document.querySelectorAll('.dp-tip[data-tip-id]');
    tips.forEach(function (el) {
      var id = el.getAttribute('data-tip-id');
      var t = content[id];
      if (!t) {
        el.style.display = 'none';
        return;
      }
      el.style.display = shouldShow(t.severity, mode) ? '' : 'none';
    });

    // InfoBoxen — werden befüllt + sichtbar/unsichtbar geschaltet
    var boxes = document.querySelectorAll('.dp-tip-infobox[data-tip-id]');
    boxes.forEach(function (el) {
      var id = el.getAttribute('data-tip-id');
      var t = content[id];
      if (!t) {
        el.style.display = 'none';
        return;
      }
      if (!shouldShow(t.severity, mode)) {
        el.style.display = 'none';
        return;
      }
      // Inhalt nur einmal befüllen
      if (!el.dataset.dpFilled) {
        el.innerHTML = renderInfoBoxHtml(t);
        el.dataset.dpFilled = '1';
      }
      el.style.display = '';
    });
  }

  /**
   * Body-Class setzen damit CSS reagieren kann (z.B. komplette UI-Sektionen ausblenden)
   */
  function applyBodyClass() {
    var mode = getMode();
    document.body.classList.remove('dp-tt-off', 'dp-tt-pro', 'dp-tt-beginner');
    document.body.classList.add('dp-tt-' + mode);
  }

  // ───── Popup-Rendering ─────────────────────────────────────────────────
  var _activePopup = null;

  function closePopup() {
    if (_activePopup) {
      _activePopup.remove();
      _activePopup = null;
    }
    document.removeEventListener('click', _onDocClick, true);
    document.removeEventListener('keydown', _onDocKey, true);
  }

  function _onDocClick(e) {
    if (!_activePopup) return;
    if (_activePopup.contains(e.target)) return;
    closePopup();
  }

  function _onDocKey(e) {
    if (e.key === 'Escape') closePopup();
  }

  function renderPopupHtml(t) {
    var html = '<div class="dp-tip-popup-header">' +
               '<span class="dp-tip-popup-title">' + esc(t.title) + '</span>' +
               '<button type="button" class="dp-tip-popup-close" aria-label="Schließen" onclick="DpTip.close()">✕</button>' +
               '</div>' +
               '<div class="dp-tip-popup-body">' + esc(t.body) + '</div>';
    if (t.example) {
      html += '<div class="dp-tip-popup-example">' + esc(t.example) + '</div>';
    }
    if (t.paragraph) {
      html += '<div class="dp-tip-popup-paragraph">' + esc(t.paragraph) + '</div>';
    }
    return html;
  }

  function renderInfoBoxHtml(t) {
    var html = '<div class="dp-infobox-header">' +
               '<span class="dp-infobox-icon">ⓘ</span>' +
               '<span class="dp-infobox-title">' + esc(t.title) + '</span>' +
               '</div>' +
               '<div class="dp-infobox-body">' + esc(t.body) + '</div>';
    if (t.example) {
      html += '<div class="dp-infobox-example">' + esc(t.example) + '</div>';
    }
    if (t.paragraph) {
      html += '<div class="dp-infobox-paragraph">' + esc(t.paragraph) + '</div>';
    }
    return html;
  }

  /**
   * Zeigt Popup neben Anker-Element. Bei Klick außerhalb schließt es.
   */
  function showPopup(id, anchor) {
    closePopup();
    var t = window.DpTooltips && window.DpTooltips.content[id];
    if (!t) return;

    var popup = document.createElement('div');
    popup.className = 'dp-tip-popup';
    popup.innerHTML = renderPopupHtml(t);
    document.body.appendChild(popup);
    _activePopup = popup;

    // Positionierung
    var rect = anchor.getBoundingClientRect();
    var popRect = popup.getBoundingClientRect();
    var top = rect.bottom + window.scrollY + 6;
    var left = rect.left + window.scrollX;

    // Nicht über rechten Rand hinaus
    var maxLeft = window.innerWidth + window.scrollX - popRect.width - 16;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;

    // Wenn nicht genug Platz nach unten → oberhalb anzeigen
    if (rect.bottom + popRect.height + 20 > window.innerHeight) {
      top = rect.top + window.scrollY - popRect.height - 6;
    }

    popup.style.top = top + 'px';
    popup.style.left = left + 'px';

    // Listener fürs Schließen
    setTimeout(function () {
      document.addEventListener('click', _onDocClick, true);
      document.addEventListener('keydown', _onDocKey, true);
    }, 10);
  }

  // ───── Global Click-Delegation für ⓘ-Buttons ───────────────────────────
  function onTipButtonClick(e) {
    var btn = e.target.closest('.dp-tip');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var id = btn.getAttribute('data-tip-id');
    if (!id) return;
    showPopup(id, btn);
  }

  // ───── Init ────────────────────────────────────────────────────────────
  function init() {
    applyBodyClass();
    applyMode();
    document.addEventListener('click', onTipButtonClick, false);

    // MutationObserver für dynamisch eingefügte ⓘ-Icons (z.B. nach Tab-Wechsel)
    if (window.MutationObserver) {
      var obs = new MutationObserver(function () {
        applyMode();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ───── Export ──────────────────────────────────────────────────────────
  window.DpTip = {
    getMode: getMode,
    setMode: function (mode) {
      var ok = setMode(mode);
      if (ok) applyBodyClass();
      return ok;
    },
    show: showPopup,
    close: closePopup,
    applyMode: applyMode,
    VERSION: 'V228'
  };

  // Auto-Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
