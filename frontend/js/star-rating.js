'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V37 — Qualität & Zustand: 5-Sterne-Bewertung
   
   Vier Bereiche: Küche, Badezimmer, Fußboden, Fenster.
   Werte landen in versteckten Inputs rate_kueche/rate_bad/rate_boden/rate_fenster
   (Werte 0-5; 0 = nicht bewertet). Storage-Persistenz erfolgt über die
   FIELDS-Liste in storage.js.
═══════════════════════════════════════════════════════════════════════════ */

window.StarRating = (function() {

  // Label-Texte je Stern-Anzahl
  var LABELS = {
    0: '– keine Bewertung –',
    1: 'Stark sanierungsbedürftig',
    2: 'Renovierungsbedürftig',
    3: 'Gut in Stand gehalten',
    4: 'Gehobenes Niveau',
    5: 'Neu / kürzlich modernisiert'
  };

  // Lucide-style SVG-Icons für die 4 Bereiche (24x24)
  var ICONS = {
    kueche:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z"/>' +
      '<path d="M7 11V6a5 5 0 0 1 10 0v5"/>' +
      '<line x1="7" y1="15" x2="7" y2="17"/>' +
      '<line x1="17" y1="15" x2="17" y2="17"/>' +
      '</svg>',
    bad:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-2.121 0L3 5"/>' +
      '<line x1="3" y1="12" x2="21" y2="12"/>' +
      '<path d="M5 12V5a2 2 0 0 1 2-2h.5"/>' +
      '<line x1="4" y1="21" x2="4" y2="18"/>' +
      '<line x1="20" y1="21" x2="20" y2="18"/>' +
      '<path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4H3v4z"/>' +
      '</svg>',
    boden:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="3" width="18" height="18" rx="1"/>' +
      '<line x1="9" y1="3" x2="9" y2="21"/>' +
      '<line x1="15" y1="3" x2="15" y2="21"/>' +
      '<line x1="3" y1="9" x2="21" y2="9"/>' +
      '<line x1="3" y1="15" x2="21" y2="15"/>' +
      '</svg>',
    fenster:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<line x1="3" y1="12" x2="21" y2="12"/>' +
      '<line x1="12" y1="3" x2="12" y2="21"/>' +
      '</svg>'
  };

  // Stern-SVG: gefüllt vs. leer
  function _starSvg(filled) {
    return '<svg viewBox="0 0 24 24" width="28" height="28" ' +
      'fill="' + (filled ? '#FFC83D' : 'none') + '" ' +
      'stroke="' + (filled ? '#E5AC22' : '#C9A84C') + '" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
      '</svg>';
  }

  /**
   * Rendert einen Stern-Container (5 Sterne).
   * @param container HTMLElement mit data-qz-target="rate_xxx"
   * @param rating aktuelle Bewertung 0-5
   */
  function _renderStars(container, rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      var filled = i <= rating;
      // V38: <span role="button"> statt <button> — verhindert Form-Submit
      // im umgebenden <form id="dp-noform"> beim Klick
      html += '<span class="qz-star' + (filled ? ' qz-star-filled' : '') + '" ' +
        'data-star="' + i + '" role="button" tabindex="0" ' +
        'aria-label="' + i + ' Sterne">' + _starSvg(filled) + '</span>';
    }
    container.innerHTML = html;
  }

  /**
   * Setzt eine Bewertung in einen versteckten Input und re-rendert die Sterne + Label.
   */
  function setRating(targetId, rating) {
    rating = Math.max(0, Math.min(5, parseInt(rating) || 0));
    var inp = document.getElementById(targetId);
    if (inp) inp.value = rating;
    var stars = document.querySelector('[data-qz-target="' + targetId + '"]');
    if (stars) _renderStars(stars, rating);
    var label = document.querySelector('[data-qz-label="' + targetId + '"]');
    if (label) {
      label.textContent = LABELS[rating];
      label.classList.toggle('qz-label-empty', rating === 0);
    }
    _updateAverage();
    // DealScore 2.0 nach Sterne-Klick refreshen
    if (typeof renderDealScore2 === 'function') {
      try { renderDealScore2(); } catch(e) {}
    }
    // Auch calc() triggern, falls in der Pipeline noch was hängt
    if (typeof calc === 'function') {
      try { calc(); } catch(e) {}
    }
  }

  function getRating(targetId) {
    var inp = document.getElementById(targetId);
    return inp ? (parseInt(inp.value) || 0) : 0;
  }

  /**
   * Durchschnitt aus allen befüllten Sterne-Werten + Footer aktualisieren.
   * Returns null wenn keine Bewertungen vorhanden.
   */
  function getAverage() {
    var keys = ['rate_kueche', 'rate_bad', 'rate_boden', 'rate_fenster'];
    var sum = 0, count = 0;
    keys.forEach(function(k) {
      var r = getRating(k);
      if (r > 0) { sum += r; count++; }
    });
    return count > 0 ? { avg: sum / count, count: count } : null;
  }

  function _updateAverage() {
    var avgInfo = getAverage();
    var starsEl = document.getElementById('qz_avg_stars');
    var labelEl = document.getElementById('qz_avg_label');
    if (!starsEl || !labelEl) return;

    if (!avgInfo) {
      starsEl.innerHTML = '<span class="qz-avg-empty">– – – – –</span>';
      labelEl.textContent = 'noch keine Bewertung';
      labelEl.classList.add('qz-label-empty');
      return;
    }
    // Visualisiere Avg gerundet auf halbe Sterne
    var avgRounded = Math.round(avgInfo.avg * 2) / 2;
    var html = '';
    for (var i = 1; i <= 5; i++) {
      var filled = avgRounded >= i;
      var half = !filled && (avgRounded >= i - 0.5);
      html += '<svg viewBox="0 0 24 24" width="16" height="16" ' +
        'fill="' + (filled ? '#FFC83D' : (half ? 'url(#half-grad)' : 'none')) + '" ' +
        'stroke="#E5AC22" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
        '</svg>';
    }
    starsEl.innerHTML =
      '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="half-grad">' +
      '<stop offset="50%" stop-color="#FFC83D"/><stop offset="50%" stop-color="transparent"/>' +
      '</linearGradient></defs></svg>' + html;
    labelEl.textContent = avgInfo.avg.toFixed(1).replace('.', ',') + ' / 5,0 (' + avgInfo.count + ' bewertet)';
    labelEl.classList.remove('qz-label-empty');
  }

  /**
   * Initialisiert alle Sterne-Widgets in der Q&Z-Card.
   */
  function init() {
    // Icons setzen
    document.querySelectorAll('[data-qz-icon]').forEach(function(el) {
      var key = el.getAttribute('data-qz-icon');
      el.innerHTML = ICONS[key] || '';
    });

    // Sterne rendern (Initial = 0 oder vorhandener Wert aus Hidden-Input)
    document.querySelectorAll('[data-qz-target]').forEach(function(container) {
      var targetId = container.getAttribute('data-qz-target');
      var current = getRating(targetId);
      _renderStars(container, current);
      var labelEl = document.querySelector('[data-qz-label="' + targetId + '"]');
      if (labelEl) {
        labelEl.textContent = LABELS[current];
        labelEl.classList.toggle('qz-label-empty', current === 0);
      }

      // Click-Handler (Event-Delegation auf Container)
      container.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-star]');
        if (!btn) return;
        var n = parseInt(btn.getAttribute('data-star'));
        // Toggle: Klick auf bereits aktiven Stern n bei rating==n → zurücksetzen auf n-1
        var cur = getRating(targetId);
        if (cur === n && n === 1) setRating(targetId, 0);     // 1★ erneut → 0
        else setRating(targetId, n);
      });

      // Hover-Preview
      container.addEventListener('mouseover', function(e) {
        var btn = e.target.closest('[data-star]');
        if (!btn) return;
        var n = parseInt(btn.getAttribute('data-star'));
        _hoverPreview(container, n);
      });
      container.addEventListener('mouseleave', function() {
        _renderStars(container, getRating(targetId));
      });
    });

    _updateAverage();
  }

  function _hoverPreview(container, n) {
    var stars = container.querySelectorAll('.qz-star');
    stars.forEach(function(s, i) {
      var filled = (i + 1) <= n;
      s.classList.toggle('qz-star-hover', filled);
      s.innerHTML = _starSvg(filled);
    });
  }

  /**
   * Re-init nach dem Laden eines gespeicherten Objekts:
   * Werte werden aus den Hidden-Inputs gelesen und die Sterne neu gerendert.
   */
  function refresh() {
    document.querySelectorAll('[data-qz-target]').forEach(function(container) {
      var targetId = container.getAttribute('data-qz-target');
      var current = getRating(targetId);
      _renderStars(container, current);
      var labelEl = document.querySelector('[data-qz-label="' + targetId + '"]');
      if (labelEl) {
        labelEl.textContent = LABELS[current];
        labelEl.classList.toggle('qz-label-empty', current === 0);
      }
    });
    _updateAverage();
  }

  /**
   * Auto-Init mit Retry: wenn Container noch nicht im DOM ist (z.B. Tab nicht aktiv),
   * versuchen wir es kurz später nochmal. Auch nach 'load' Event nochmal probieren.
   */
  var _initDone = false;
  function _autoInit() {
    if (_initDone) return;
    var hasContainers = document.querySelectorAll('[data-qz-target]').length > 0;
    if (!hasContainers) return;     // noch nicht im DOM → später nochmal
    init();
    _initDone = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    setTimeout(_autoInit, 0);
  }
  window.addEventListener('load', _autoInit);
  // Sicherheits-Retry nach 500ms (für den Fall dass irgendwas die Container später injiziert)
  setTimeout(_autoInit, 500);

  return {
    init: init,
    refresh: refresh,
    setRating: setRating,
    getRating: getRating,
    getAverage: getAverage,
    LABELS: LABELS
  };
})();
