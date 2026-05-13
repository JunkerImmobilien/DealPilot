/**
 * V158 — Adress-Autocomplete via Nominatim (OpenStreetMap)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Erweitert die Adress-Felder (str, hnr, plz, ort) um eine Auto-Suggest-Funktion.
 *
 * Funktionsweise:
 * - Beim Tippen in "Straße" werden Vorschläge gefetcht (DE + AT + CH, debounced)
 * - Dropdown unter dem Feld zeigt Adressen mit Stadt
 * - Klick auf Vorschlag füllt alle vier Felder automatisch (str, hnr, plz, ort)
 *
 * Datenquelle: Nominatim (openstreetmap.org) — free, openSource, kein API-Key.
 * Rate-Limit: 1 Request pro Sekunde (offizielle Policy). Wir debouncen 350ms.
 *
 * Nutzungsbedingungen:
 *   https://operations.osmfoundation.org/policies/nominatim/
 *   - User-Agent muss aussagekräftig sein (DealPilot/V158)
 *   - Keine Bulk-Queries
 *
 * Vorteile gegenüber Google Places:
 *   - Gratis
 *   - Kein Tracking, keine Cookies
 *   - DSGVO-konform
 *   - Funktioniert für DE/AT/CH gut
 */
(function () {
  'use strict';

  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  var USER_AGENT_NOTE = 'DealPilot/V158 (Immobilien-Analyse-Tool, Marcel Junker, dealpilot@junker-immobilien.io)';
  var DEBOUNCE_MS = 350;
  var MIN_QUERY_LENGTH = 3;
  var MAX_RESULTS = 6;
  var CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 Min Cache pro Query

  // In-Memory Cache
  var queryCache = {};

  function init() {
    // Auf die Adress-Felder im Objekt-Tab hooken
    attachToField('str', 'auto-strasse', { type: 'street' });

    // Mark als initialisiert
    if (window._v158_autocomplete_active) return;
    window._v158_autocomplete_active = true;
    console.log('[autocomplete-v158] Adress-Autocomplete aktiv für Feld "str"');
  }

  function attachToField(fieldId, dropdownId, opts) {
    var input = document.getElementById(fieldId);
    if (!input) {
      // Tab vielleicht noch nicht geladen — später nochmal versuchen
      setTimeout(function () { attachToField(fieldId, dropdownId, opts); }, 1000);
      return;
    }
    if (input._v158_attached) return;
    input._v158_attached = true;

    var dropdown = createDropdown(input, dropdownId);
    var debounceTimer = null;

    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      if (q.length < MIN_QUERY_LENGTH) {
        hideDropdown(dropdown);
        return;
      }
      debounceTimer = setTimeout(function () {
        fetchSuggestions(q).then(function (results) {
          renderDropdown(dropdown, results, input);
        }).catch(function (err) {
          console.warn('[autocomplete-v158] Nominatim-Fehler:', err);
          hideDropdown(dropdown);
        });
      }, DEBOUNCE_MS);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= MIN_QUERY_LENGTH && dropdown.children.length > 0) {
        showDropdown(dropdown);
      }
    });

    input.addEventListener('blur', function () {
      // Etwas verzögert, damit Click auf Dropdown noch funktioniert
      setTimeout(function () { hideDropdown(dropdown); }, 200);
    });

    // ESC schließt Dropdown
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideDropdown(dropdown);
    });
  }

  function createDropdown(input, id) {
    var existing = document.getElementById(id);
    if (existing) return existing;
    var dd = document.createElement('div');
    dd.id = id;
    dd.style.cssText =
      'position:absolute;background:#fff;border:1px solid #C9A84C;' +
      'border-radius:0 0 6px 6px;box-shadow:0 4px 14px rgba(0,0,0,0.12);' +
      'z-index:1000;max-height:280px;overflow-y:auto;font-size:13px;' +
      'display:none;min-width:300px';
    // Position unter dem Input
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(dd);
    positionDropdown(dd, input);

    // Window resize → reposition
    window.addEventListener('resize', function () { positionDropdown(dd, input); });
    return dd;
  }

  function positionDropdown(dd, input) {
    var rect = input.getBoundingClientRect();
    var parentRect = input.parentNode.getBoundingClientRect();
    dd.style.left = (rect.left - parentRect.left) + 'px';
    dd.style.top = (rect.bottom - parentRect.top + 2) + 'px';
    dd.style.width = rect.width + 'px';
  }

  function fetchSuggestions(query) {
    // Cache-Check
    var cached = queryCache[query];
    if (cached && (Date.now() - cached.timestamp) < CACHE_MAX_AGE_MS) {
      return Promise.resolve(cached.results);
    }

    var params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(MAX_RESULTS),
      countrycodes: 'de,at,ch',
      'accept-language': 'de'
    });

    var url = NOMINATIM_URL + '?' + params.toString();
    return fetch(url, {
      headers: { 'Accept': 'application/json' },
      credentials: 'omit'
    }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (data) {
      var results = (data || []).map(function (item) {
        var a = item.address || {};
        return {
          str: a.road || a.pedestrian || a.path || '',
          hnr: a.house_number || '',
          plz: a.postcode || '',
          ort: a.city || a.town || a.village || a.municipality || a.county || '',
          display: item.display_name || ''
        };
      }).filter(function (r) {
        // Nur Ergebnisse mit Straße + Ort
        return r.str && r.ort;
      });
      queryCache[query] = { timestamp: Date.now(), results: results };
      return results;
    });
  }

  function renderDropdown(dd, results, sourceInput) {
    dd.innerHTML = '';
    if (results.length === 0) {
      hideDropdown(dd);
      return;
    }
    results.forEach(function (r) {
      var row = document.createElement('div');
      row.style.cssText =
        'padding:8px 12px;cursor:pointer;border-bottom:1px solid #F8F6F1;' +
        'transition:background 0.15s';
      row.innerHTML =
        '<div style="font-weight:500;color:#2A2727">' +
          _esc(r.str) + (r.hnr ? ' ' + _esc(r.hnr) : '') +
        '</div>' +
        '<div style="font-size:11px;color:#7A7370;margin-top:1px">' +
          _esc(r.plz) + ' ' + _esc(r.ort) +
        '</div>';
      row.addEventListener('mouseenter', function () { row.style.background = '#FAF6E8'; });
      row.addEventListener('mouseleave', function () { row.style.background = '#fff'; });
      row.addEventListener('mousedown', function (e) {
        // mousedown statt click, damit es vor blur greift
        e.preventDefault();
        applySelection(r);
        hideDropdown(dd);
      });
      dd.appendChild(row);
    });
    positionDropdown(dd, sourceInput);
    showDropdown(dd);
  }

  function applySelection(r) {
    setFieldValue('str', r.str);
    setFieldValue('hnr', r.hnr);
    setFieldValue('plz', r.plz);
    setFieldValue('ort', r.ort);

    // calc()/dpUpdateAll triggern damit DealScore und Co aktualisieren
    if (typeof window.calc === 'function') window.calc();
    if (typeof window.dpUpdateAll === 'function') window.dpUpdateAll();

    if (typeof window.toast === 'function') {
      window.toast('Adresse übernommen: ' + r.str + ' ' + r.hnr + ', ' + r.plz + ' ' + r.ort);
    }
  }

  function setFieldValue(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = val || '';
    el.classList.remove('dp-example-placeholder');
    // Native input event triggern damit Listener reagieren
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function showDropdown(dd) { dd.style.display = 'block'; }
  function hideDropdown(dd) { dd.style.display = 'none'; }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Auto-Init nach DOM-Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose für späteren Bedarf (z.B. wenn neue Objekte gerendert werden)
  window.DealPilotAutocomplete = {
    init: init,
    attachToField: attachToField
  };
})();
