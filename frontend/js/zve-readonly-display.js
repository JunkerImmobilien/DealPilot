/* V262-03: kaufdat als primaeres Kaufdatum-Feld */
/* V261-04: zvE-Feld read-only — Wert kommt aus tax_periods + Inline-Hinweis */
(function() {
  'use strict';

  function fmtEUR(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    return n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  }
  function fmtDate(s) {
    if (!s) return '–';
    const parts = String(s).split('T')[0].split('-');
    if (parts.length === 3) return parts[2] + '.' + parts[1] + '.' + parts[0];
    return s;
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function getRelevantDate() {
    const wuEl = document.getElementById('wirtschaftlicher_uebergang');
    const kdEl = document.getElementById('kaufdat') || document.getElementById('purchase_date') || document.getElementById('kaufdatum');
    if (wuEl && wuEl.value) return wuEl.value;
    if (kdEl && kdEl.value) return kdEl.value;
    return todayISO();
  }

  async function updateZveFromPeriods() {
    if (!window.DealPilotTaxPeriods) return;
    const zveEl = document.getElementById('zve');
    if (!zveEl) return;
    
    const date = getRelevantDate();
    const period = await DealPilotTaxPeriods.getForDate(date);
    
    if (!period) {
      zveEl.value = '';
      injectHint(null, date);
      return;
    }
    
    zveEl.value = fmtEUR(period.zve);
    injectHint(period, date);
    // Trigger calc
    if (typeof calc === 'function') try { calc(); } catch(e) {}
  }
  
  function injectHint(period, refDate) {
    const zveEl = document.getElementById('zve');
    if (!zveEl) return;
    const container = zveEl.closest('.f') || zveEl.parentElement;
    if (!container) return;
    
    // Vorhandenen Hint entfernen
    const existing = container.querySelector('.dp-zve-period-hint');
    if (existing) existing.remove();
    
    const hint = document.createElement('div');
    hint.className = 'dp-zve-period-hint';
    hint.style.cssText = 'margin-top:6px;font-size:11.5px;color:var(--muted,#7A7370);font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap';
    
    if (period) {
      hint.innerHTML = 
        '<span>Aus Steuerzeitraum <strong style="color:var(--ch,#2A2727)">' + fmtDate(period.valid_from) + ' – ' + (period.valid_to ? fmtDate(period.valid_to) : 'laufend') + '</strong> (' + (period.reason || 'ohne Grund') + ')</span>' +
        '<a href="#" onclick="event.preventDefault();if(window.DealPilotTaxPeriods)DealPilotTaxPeriods.openModal()" style="color:var(--gold,#C9A84C);font-weight:600;text-decoration:underline">Steuerzeiträume bearbeiten</a>';
    } else {
      const yr = (refDate || todayISO()).split('-')[0];
      hint.innerHTML = 
        '<span style="color:var(--red,#B8625C)">⚠ Kein Steuerzeitraum für ' + fmtDate(refDate) + '. Bitte einen anlegen.</span>' +
        '<a href="#" onclick="event.preventDefault();if(window.DealPilotTaxPeriods)DealPilotTaxPeriods.openModal()" style="color:var(--gold,#C9A84C);font-weight:600;text-decoration:underline">Anlegen →</a>';
    }
    
    container.appendChild(hint);
  }

  // Beim Steuer-Tab-Wechsel + bei Aenderung von wirtschaftlicher_uebergang oder purchase_date
  function attachWatchers() {
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-tab="s4"], [data-target="s4"], button[onclick*="s4"]')) {
        setTimeout(updateZveFromPeriods, 300);
      }
    });
    
    const wuEl = document.getElementById('wirtschaftlicher_uebergang');
    const kdEl = document.getElementById('kaufdat') || document.getElementById('purchase_date') || document.getElementById('kaufdatum');
    [wuEl, kdEl].forEach(el => {
      if (el && !el.dataset.zveWatched) {
        el.dataset.zveWatched = '1';
        el.addEventListener('change', () => setTimeout(updateZveFromPeriods, 100));
      }
    });
    
    // Initial
    setTimeout(updateZveFromPeriods, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachWatchers);
  } else {
    attachWatchers();
  }
  
  window.DealPilotZveReadOnly = {
    updateZveFromPeriods,
    injectHint,
    _meta: 'V261-04'
  };
})();
