'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V212 – collapsible-cards.js

   Macht alle Cards mit data-collapsible="<id>" einklappbar.
   - Default-State: aus dp_user_settings.collapseMarketCards (default true = zugeklappt)
   - Toggle-Button wird automatisch in die .ct-row injiziert
   - User-Klick auf Toggle persistiert pro Card via localStorage
   - Bei Settings-Änderung: alle re-syncen
   ═══════════════════════════════════════════════════ */

var CollapsibleCards = (function() {

  var LS_PER_CARD = 'dp_card_collapse_state'; // {cardId: boolean}
  var DEFAULT_FROM_SETTINGS_KEY = 'collapseMarketCards';

  function _getDefaultCollapsed() {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      // V213: Default explizit TRUE (zugeklappt) wenn nichts gesetzt ist
      if (typeof s[DEFAULT_FROM_SETTINGS_KEY] === 'boolean') {
        return s[DEFAULT_FROM_SETTINGS_KEY];
      }
    } catch(e) {}
    return true; // Default: zugeklappt
  }

  /**
   * V213: Setze ein Sublabel für eine Card.
   * Wird neben den Titel gerendert und nur bei zugeklappter Card sichtbar.
   */
  function setSublabel(cardId, text) {
    var card = document.querySelector('[data-collapsible="' + cardId + '"]');
    if (!card) return;
    var titleEl = card.querySelector(':scope > .ct-row .ct');
    if (!titleEl) return;
    var subEl = titleEl.querySelector('.v213-card-sub');
    if (!subEl) {
      subEl = document.createElement('span');
      subEl.className = 'v213-card-sub';
      titleEl.appendChild(subEl);
    }
    subEl.textContent = text || '';
  }

  function _getPerCardState() {
    try {
      return JSON.parse(localStorage.getItem(LS_PER_CARD) || '{}');
    } catch(e) {
      return {};
    }
  }

  function _setPerCardState(cardId, collapsed) {
    try {
      var s = _getPerCardState();
      s[cardId] = collapsed;
      localStorage.setItem(LS_PER_CARD, JSON.stringify(s));
    } catch(e) {}
  }

  function _shouldBeCollapsed(cardId) {
    var perCard = _getPerCardState();
    if (typeof perCard[cardId] === 'boolean') return perCard[cardId];
    return _getDefaultCollapsed();
  }

  function _toggle(card) {
    var cardId = card.getAttribute('data-collapsible');
    if (!cardId) return;
    var nowCollapsed = !card.classList.contains('v212-collapsed');
    card.classList.toggle('v212-collapsed', nowCollapsed);
    _setPerCardState(cardId, nowCollapsed);
  }

  function _wrapCard(card) {
    if (card.hasAttribute('data-v212-init')) return;
    card.setAttribute('data-v212-init', '1');

    var cardId = card.getAttribute('data-collapsible');
    var title = card.getAttribute('data-collapse-title') || '';

    // Body wrappen — alles AUSSER der .ct-row in einen Wrapper packen
    var ctRow = card.querySelector(':scope > .ct-row');
    if (!ctRow) {
      // Kein Header → Card-Struktur nicht passend, skip
      return;
    }

    // Toggle-Button bauen
    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'v212-collapse-toggle';
    toggleBtn.setAttribute('aria-label', 'Ein-/Ausklappen');
    toggleBtn.setAttribute('title', 'Ein-/Ausklappen');
    toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      _toggle(card);
    });

    // V215: Action-Group — gruppiert vorhandene Buttons (Refresh) + Chevron rechts zusammen
    // Ohne Gruppierung würde Flex-space-between den Chevron weit weg vom Refresh schieben.
    var actionGroup = ctRow.querySelector(':scope > .v215-actions');
    if (!actionGroup) {
      actionGroup = document.createElement('div');
      actionGroup.className = 'v215-actions';
      // Verschiebe alle existierenden Buttons (Refresh etc.) in die Group
      var existingBtns = Array.from(ctRow.querySelectorAll(':scope > button'));
      existingBtns.forEach(function(btn) { actionGroup.appendChild(btn); });
      ctRow.appendChild(actionGroup);
    }
    actionGroup.appendChild(toggleBtn);

    // Body wrappen: alle Geschwister von ctRow nach ctRow in einen Wrapper packen
    var body = document.createElement('div');
    body.className = 'v212-collapse-body';
    var next = ctRow.nextSibling;
    while (next) {
      var following = next.nextSibling;
      body.appendChild(next);
      next = following;
    }
    card.appendChild(body);

    // Initial-State setzen
    if (_shouldBeCollapsed(cardId)) {
      card.classList.add('v212-collapsed');
    }
  }

  function init() {
    var cards = document.querySelectorAll('[data-collapsible]');
    cards.forEach(function(c) { _wrapCard(c); });
  }

  function applyDefaultFromSettings(defaultCollapsed) {
    // Wird vom Settings-Modal aufgerufen wenn Toggle umgeschaltet wurde.
    // ABER: nur die Cards umstellen die KEIN per-Card-Override haben.
    var perCard = _getPerCardState();
    var cards = document.querySelectorAll('[data-collapsible]');
    cards.forEach(function(card) {
      var cardId = card.getAttribute('data-collapsible');
      if (perCard.hasOwnProperty(cardId)) return; // User hat manuell gesetzt
      card.classList.toggle('v212-collapsed', !!defaultCollapsed);
    });
  }

  function resetAllOverrides() {
    // "Alle Cards auf Default zurücksetzen" — verwirft per-Card-State
    try { localStorage.removeItem(LS_PER_CARD); } catch(e) {}
    var defaultCollapsed = _getDefaultCollapsed();
    var cards = document.querySelectorAll('[data-collapsible]');
    cards.forEach(function(card) {
      card.classList.toggle('v212-collapsed', defaultCollapsed);
    });
  }

  // Auto-Init nach DOM-Ready, mit kleinem Delay damit Cards in DOM sind
  function _schedule() {
    setTimeout(init, 100);
    // Nochmal später für Cards die dynamisch geladen werden
    setTimeout(init, 1500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _schedule);
  } else {
    _schedule();
  }

  return {
    init: init,
    applyDefaultFromSettings: applyDefaultFromSettings,
    resetAllOverrides: resetAllOverrides,
    setSublabel: setSublabel
  };
})();

// Global verfügbar für Settings-Modal
window.CollapsibleCards = CollapsibleCards;
