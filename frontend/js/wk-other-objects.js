/* V266-03: WK aus anderen Won-Objekten — Inline-Display
 * Nur sichtbar wenn andere gewonnene Objekte existieren UND deren WK != 0.
 */
(function() {
  'use strict';

  function fmtEUR(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    var sign = n > 0 ? '+' : '';
    return sign + n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
  }

  function getCurrentYear() {
    var wuEl = document.getElementById('wirtschaftlicher_uebergang');
    var kdEl = document.getElementById('kaufdat') || document.getElementById('purchase_date') || document.getElementById('kaufdatum');
    var dateStr = (wuEl && wuEl.value) || (kdEl && kdEl.value);
    if (dateStr) return parseInt(dateStr.split('-')[0], 10);
    return new Date().getFullYear();
  }

  function getCurrentObjectId() {
    if (window._currentObjData && (window._currentObjData.id || window._currentObjData._id)) {
      return window._currentObjData.id || window._currentObjData._id;
    }
    return null;
  }

  function findAnchorRow() {
    // Suche "Ueberschuss / Verlust V+V"-Zeile in Steuer-Card
    var candidates = [
      '#cr-cfns', '#cr-zve', '#cr-zve-mit', '#cr-zve-ohne'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = document.querySelector(candidates[i]);
      if (el) {
        var anchor = el.closest('.kv-result') || el.closest('.kv');
        if (anchor) return anchor;
      }
    }
    // Fallback: per Text
    var allKv = document.querySelectorAll('.tax-module-card .kv');
    for (var j = 0; j < allKv.length; j++) {
      var kv = allKv[j];
      var t = (kv.textContent || '').toLowerCase();
      if (t.indexOf('überschuss') !== -1 || t.indexOf('ueberschuss') !== -1 || t.indexOf('verlust v+v') !== -1) {
        return kv;
      }
    }
    return null;
  }

  async function updateDisplay() {
    var existing = document.getElementById('cr-wk-other-row');
    
    if (!window.DealPilotWKAggregator) {
      if (existing) existing.remove();
      return;
    }
    
    await DealPilotWKAggregator.loadAll();
    
    var year = getCurrentYear();
    var objId = getCurrentObjectId();
    var otherWK = DealPilotWKAggregator.getWKForOtherObjects(objId, year) || 0;
    
    // BEDINGUNG: Nur anzeigen wenn andere Won-Objekte existieren UND WK != 0
    var allObjects = (typeof DealPilotWKAggregator.getAllSnapshots === 'function')
      ? DealPilotWKAggregator.getAllSnapshots()
      : null;
    
    var hasOthersWithWK = (Math.abs(otherWK) > 0.5);  // Toleranz fuer Rundungsfehler
    
    if (!hasOthersWithWK) {
      // Zeile entfernen falls vorhanden
      if (existing) existing.remove();
      window._otherWKThisYear = 0;
      return;
    }
    
    // Zeile einfügen (oder updaten)
    var row = existing;
    if (!row) {
      var anchor = findAnchorRow();
      if (!anchor) return;
      
      row = document.createElement('div');
      row.className = 'kv kv-wk-other';
      row.id = 'cr-wk-other-row';
      row.style.cssText = 'background:rgba(201,168,76,0.05);border-left:3px solid var(--gold,#C9A84C);padding:6px 12px';
      
      anchor.parentNode.insertBefore(row, anchor.nextSibling);
    }
    
    var sign = otherWK < 0 ? 'green' : (otherWK > 0 ? 'red' : 'muted');
    var color = sign === 'green' ? 'var(--green,#3FA56C)' : (sign === 'red' ? 'var(--red,#B8625C)' : 'var(--muted,#7A7370)');
    
    row.innerHTML = 
      '<span style="display:inline-flex;align-items:center;gap:6px">' +
        'WK andere Objekte aus V+V ' +
        '<span style="font-size:10px;color:var(--muted,#7A7370);font-weight:400">(' + year + ', nur gewonnene)</span>' +
      '</span>' +
      '<span class="kv-v" id="cr-wk-other" style="color:' + color + ';font-weight:600">' + fmtEUR(otherWK) + '</span>';
    
    window._otherWKThisYear = otherWK;
  }

  function wrapCalc() {
    if (typeof window.calc !== 'function') return;
    if (window.calc._v266Wrapped) return;
    var orig = window.calc;
    window.calc = function() {
      var r = orig.apply(this, arguments);
      setTimeout(updateDisplay, 80);
      return r;
    };
    window.calc._v266Wrapped = true;
  }

  function attach() {
    wrapCalc();
    document.addEventListener('click', function(e) {
      var target = e.target.closest && e.target.closest('[data-tab="s4"], [data-target="s4"], button[onclick*="s4"]');
      if (target) {
        setTimeout(updateDisplay, 350);
      }
    });
    setTimeout(updateDisplay, 1500);
    setTimeout(updateDisplay, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
  
  window.DealPilotWKOtherInline = {
    updateDisplay: updateDisplay,
    _meta: 'V266-03'
  };
})();
