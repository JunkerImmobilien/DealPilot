'use strict';
/* ═══════════════════════════════════════════════════════════════
   V187 — Gebäudeanteil-Banner mit Status-Anzeige
   
   - Listener auf #geb_ant
   - Bei Änderung weg vom Default (80%): Banner anzeigen
   - Status grün/gelb/rot abhängig von Sanierungskosten:
     • < 90% der 15%-Grenze:  grün
     • 90-100% der Grenze:    gelb
     • > 100% der Grenze:     rot
     • Bei 80% Default ohne Sanierung: gold (Info)
   - Button "→ Tab Investition" springt zum Tab
═══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  var DEFAULT_PCT = 80;
  var WARN_THRESHOLD = 0.9;  // 90% der Grenze

  function _el(id) { return document.getElementById(id); }

  function _parseDe(s) {
    if (s == null) return 0;
    s = String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    return parseFloat(s) || 0;
  }

  function _formatEur(n) {
    if (n === 0) return '0 €';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  function _formatPct(n) {
    return n.toFixed(1).replace('.', ',') + '%';
  }

  // Sanierungskosten aus Tab Investition aufsummieren
  // Felder: san_pos_X-Felder, kueche_betrag (V63.99), ...
  // Wir lesen #ahk_basis (Gebäude-AHK) und #san_limit_actual aus dem 15%-Block
  function _getSanCurrent() {
    // Aus #san_limit_actual (Anzeige-Wert)
    var sanEl = _el('san_limit_actual');
    if (sanEl) {
      var txt = (sanEl.textContent || '').trim();
      if (txt && txt !== '—') {
        return _parseDe(txt);
      }
    }
    return 0;
  }

  function _getMaxLimit() {
    // Aus #ahk_15pct oder #san_limit_max
    var els = [_el('ahk_15pct'), _el('san_limit_max')];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el) {
        var txt = (el.textContent || '').trim();
        if (txt && txt !== '—') return _parseDe(txt);
      }
    }
    // Fallback: selbst berechnen
    var kp = _parseDe(_el('kp') ? _el('kp').value : '0');
    var pct = _parseDe(_el('geb_ant') ? _el('geb_ant').value : '80') / 100;
    return kp * pct * 0.15;
  }

  // Status bestimmen
  function _classifyStatus(sanCurrent, maxLimit) {
    if (maxLimit <= 0) return { cls: 'gold', label: '—', icon: 'ℹ️' };
    
    if (sanCurrent === 0) {
      return {
        cls: 'gold',
        label: 'Noch keine Sanierungskosten erfasst',
        icon: 'ℹ️'
      };
    }
    
    var ratio = sanCurrent / maxLimit;
    
    if (ratio > 1.0) {
      return {
        cls: 'red',
        label: 'Grenze überschritten! Anschaffungsnahe HK',
        icon: '🚨'
      };
    } else if (ratio >= WARN_THRESHOLD) {
      return {
        cls: 'yellow',
        label: 'Knapp unter Grenze (' + _formatPct(ratio * 100) + ')',
        icon: '⚠️'
      };
    } else {
      return {
        cls: 'green',
        label: 'Unter Grenze (' + _formatPct(ratio * 100) + ')',
        icon: '✓'
      };
    }
  }

  function _renderBanner(pct) {
    var banner = _el('geb-ant-banner');
    if (!banner) return;

    var sanCurrent = _getSanCurrent();
    var maxLimit = _getMaxLimit();
    var status = _classifyStatus(sanCurrent, maxLimit);

    // Status-Klasse setzen (alte entfernen)
    banner.className = 'geb-ant-banner status-' + status.cls;

    // HTML zusammenbauen
    banner.innerHTML =
      '<div class="geb-ant-banner-header">' +
        '<span class="geb-ant-banner-icon">' + status.icon + '</span>' +
        '<span class="geb-ant-banner-title">Gebäudeanteil geändert auf ' + _formatPct(pct) + '</span>' +
      '</div>' +
      '<div class="geb-ant-banner-grid">' +
        '<span class="gab-label">15%-Grenze (anschaffungsnahe Aufw.)</span>' +
        '<span class="gab-value highlight">' + _formatEur(maxLimit) + '</span>' +
        '<span class="gab-label">Aktuelle Sanierungskosten</span>' +
        '<span class="gab-value">' + _formatEur(sanCurrent) + '</span>' +
        '<span class="gab-label">Status</span>' +
        '<span class="gab-value status-text">' + status.label + '</span>' +
      '</div>' +
      '<div class="geb-ant-banner-footer">' +
        '<span class="geb-ant-banner-hint">' +
          'Bei Überschreitung der 15%-Grenze in 3 Jahren werden alle Sanierungskosten ' +
          'als anschaffungsnahe Herstellkosten umgeklassifiziert (§ 6 Abs. 1 Nr. 1a EStG).' +
        '</span>' +
        '<button type="button" class="btn-jump" onclick="DealPilotGebAnt.gotoInvestition()">' +
          '→ Sanierungskosten anpassen' +
        '</button>' +
      '</div>';

    banner.style.display = 'block';
  }

  function _hideBanner() {
    var banner = _el('geb-ant-banner');
    if (banner) banner.style.display = 'none';
  }

  function _onChange() {
    var gebEl = _el('geb_ant');
    if (!gebEl) return;
    var pct = _parseDe(gebEl.value);
    if (isNaN(pct) || pct === DEFAULT_PCT) {
      _hideBanner();
    } else {
      // Nach calc() einen Moment warten damit ahk_15pct aktualisiert ist
      setTimeout(function() { _renderBanner(pct); }, 80);
    }
  }

  // Public: Sprung zum Investitionen-Tab
  function gotoInvestition() {
    var btn = document.querySelector('button.tab[data-wf-key="investition"]');
    if (btn) {
      btn.click();
      setTimeout(function() {
        var target = _el('san_options') || _el('san_block') || _el('kp');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    } else if (typeof switchTab === 'function') {
      switchTab(1);
    }
  }

  function init() {
    var gebEl = _el('geb_ant');
    if (gebEl) {
      gebEl.addEventListener('input', _onChange);
      gebEl.addEventListener('change', _onChange);
      console.log('[geb-ant-banner V187] Initialisiert');
    }
    // Auch reagieren wenn Sanierungskosten sich ändern (Re-Render bei eingeblendetem Banner)
    var sanEls = ['san_limit_actual', 'ahk_15pct'];
    sanEls.forEach(function(id) {
      var el = _el(id);
      if (el) {
        new MutationObserver(function() {
          var banner = _el('geb-ant-banner');
          if (banner && banner.style.display === 'block') {
            var pct = _parseDe(gebEl ? gebEl.value : '80');
            if (pct !== DEFAULT_PCT) _renderBanner(pct);
          }
        }).observe(el, { childList: true, characterData: true, subtree: true });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  window.DealPilotGebAnt = {
    gotoInvestition: gotoInvestition,
    refresh: _onChange
  };
})();
