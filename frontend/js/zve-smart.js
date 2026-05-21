/* V260-02: ZVE-Feld Smart-Logik mit Focus-Vorschlag + 4-Optionen Sync-Dialog */
(function() {
  'use strict';

  let _lastZveValueBeforeEdit = null;

  function parseDe(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    s = String(s).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function fmtEUR(n) {
    if (typeof n !== 'number') return '0 €';
    return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function getRelevantDate() {
    const wuEl = document.getElementById('wirtschaftlicher_uebergang');
    const kdEl = document.getElementById('purchase_date') || document.getElementById('kaufdatum');
    if (wuEl && wuEl.value) return wuEl.value;
    if (kdEl && kdEl.value) return kdEl.value;
    return todayISO();
  }

  function getYearDefault(date) {
    const year = (date || todayISO()).split('-')[0];
    return {
      from: year + '-01-01',
      to: year + '-12-31'
    };
  }

  // ─── Focus-Handler: Vorschlag-Tooltip ──────────────────────────
  async function onFocus() {
    const zveEl = document.getElementById('zve');
    if (!zveEl) return;
    _lastZveValueBeforeEdit = zveEl.value;
    
    if (zveEl.value && zveEl.value.trim() !== '') return; // Feld nicht leer → kein Vorschlag
    if (!window.DealPilotTaxPeriods) return;
    
    const date = getRelevantDate();
    const period = await DealPilotTaxPeriods.getForDate(date);
    if (!period || !period.zve) return;
    
    // Tooltip-Banner unter dem Feld
    showSuggestionBanner(period, zveEl);
  }
  
  function showSuggestionBanner(period, zveEl) {
    removeSuggestionBanner();
    
    const banner = document.createElement('div');
    banner.id = 'zve-suggestion-banner';
    banner.style.cssText = 'position:absolute;background:#fff;border:1.5px solid var(--gold,#C9A84C);border-radius:10px;padding:10px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.10);font-family:var(--font-main,\'IBM Plex Sans\',sans-serif);font-size:12.5px;color:var(--ch,#2A2727);z-index:5000;max-width:380px;line-height:1.45';
    banner.innerHTML = 
      '<div style="margin-bottom:8px"><strong>Existierender Steuerzeitraum gefunden</strong></div>' +
      '<div style="margin-bottom:8px;color:var(--muted,#7A7370)">' +
        period.valid_from + ' – ' + (period.valid_to || 'laufend') + ': <strong style="color:var(--gold,#C9A84C)">' + fmtEUR(period.zve) + '</strong>' +
      '</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button onclick="DealPilotZveSmart.applySuggestion(' + period.zve + ')" style="padding:6px 12px;background:var(--gold,#C9A84C);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Übernehmen</button>' +
        '<button onclick="DealPilotZveSmart.dismissSuggestion()" style="padding:6px 12px;background:#fff;color:var(--muted,#7A7370);border:1.5px solid rgba(201,168,76,0.20);border-radius:6px;font-size:12px;cursor:pointer">Ignorieren</button>' +
      '</div>';
    
    document.body.appendChild(banner);
    
    // Position
    const rect = zveEl.getBoundingClientRect();
    banner.style.left = rect.left + 'px';
    banner.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    
    // Auto-Close beim Klick ausserhalb
    setTimeout(() => {
      document.addEventListener('click', closeOnOutside, { capture: true });
    }, 100);
  }
  
  function closeOnOutside(e) {
    const banner = document.getElementById('zve-suggestion-banner');
    if (!banner) {
      document.removeEventListener('click', closeOnOutside, { capture: true });
      return;
    }
    if (e.target.closest('#zve-suggestion-banner') || e.target.closest('#zve')) return;
    removeSuggestionBanner();
    document.removeEventListener('click', closeOnOutside, { capture: true });
  }

  function removeSuggestionBanner() {
    const b = document.getElementById('zve-suggestion-banner');
    if (b) b.remove();
  }

  function applySuggestion(amount) {
    const el = document.getElementById('zve');
    if (el) {
      el.value = Number(amount).toLocaleString('de-DE');
      if (typeof calc === 'function') try { calc(); } catch(e) {}
    }
    removeSuggestionBanner();
  }

  function dismissSuggestion() {
    removeSuggestionBanner();
  }

  // ─── Sync-Dialog bei Aenderung ─────────────────────────────────
  async function onChange() {
    removeSuggestionBanner();
    const zveEl = document.getElementById('zve');
    if (!zveEl) return;
    const newZve = parseDe(zveEl.value);
    if (newZve <= 0) return;
    if (!window.DealPilotTaxPeriods) return;
    
    const date = getRelevantDate();
    const period = await DealPilotTaxPeriods.getForDate(date);
    
    if (!period) {
      // Kein Zeitraum existiert → Default-Vorschlag
      showSyncDialog({
        mode: 'new',
        newZve: newZve,
        date: date,
        existingPeriod: null
      });
      return;
    }
    
    if (period.zve === newZve) return; // identisch → nichts zu tun
    
    // Konflikt: Sync-Dialog mit 4 Optionen
    showSyncDialog({
      mode: 'conflict',
      newZve: newZve,
      date: date,
      existingPeriod: period
    });
  }
  
  function showSyncDialog(opts) {
    closeSyncDialog();
    
    const overlay = document.createElement('div');
    overlay.id = 'zve-sync-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif)';
    
    let html = '<div style="background:#fff;border-radius:14px;max-width:540px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.30)">';
    
    if (opts.mode === 'new') {
      html += '<div style="font-size:17px;font-weight:600;color:var(--ch,#2A2727);margin-bottom:6px">Neuen Steuerzeitraum anlegen?</div>';
      html += '<div style="font-size:13px;color:var(--muted,#7A7370);margin-bottom:18px">Du hast <strong>' + fmtEUR(opts.newZve) + '</strong> als zvE eingetragen. Für diesen Zeitraum existiert noch kein Steuerzeitraum.</div>';
      
      const def = getYearDefault(opts.date);
      html += '<div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.22);border-radius:8px;padding:12px;margin-bottom:18px">';
      html += '<div style="font-size:12px;color:var(--muted,#7A7370);margin-bottom:8px">Vorgeschlagener Zeitraum:</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
      html += '<div><label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Von</label><input type="date" id="zve-sync-from" value="' + def.from + '" style="height:34px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:7px;font-size:13px;width:100%" /></div>';
      html += '<div><label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Bis</label><input type="date" id="zve-sync-to" value="' + def.to + '" style="height:34px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:7px;font-size:13px;width:100%" /></div>';
      html += '</div></div>';
      
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      html += '<button onclick="DealPilotZveSmart.optCreateNew(' + opts.newZve + ')" style="padding:11px 16px;background:var(--gold,#C9A84C);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer">Steuerzeitraum anlegen</button>';
      html += '<button onclick="DealPilotZveSmart.optLocalOnly()" style="padding:10px 16px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">Nur für diese Berechnung verwenden</button>';
      html += '<button onclick="DealPilotZveSmart.optCancel()" style="padding:8px 16px;background:transparent;color:var(--muted,#7A7370);border:none;font-family:inherit;font-size:12px;cursor:pointer">Abbrechen</button>';
      html += '</div>';
    } else {
      // Conflict
      html += '<div style="font-size:17px;font-weight:600;color:var(--ch,#2A2727);margin-bottom:6px">zvE weicht ab</div>';
      html += '<div style="font-size:13px;color:var(--muted,#7A7370);margin-bottom:16px">Für den Zeitraum <strong>' + opts.existingPeriod.valid_from + ' – ' + (opts.existingPeriod.valid_to || 'laufend') + '</strong> ist aktuell ein zvE von <strong>' + fmtEUR(opts.existingPeriod.zve) + '</strong> hinterlegt. Du hast <strong>' + fmtEUR(opts.newZve) + '</strong> eingetragen.</div>';
      
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      html += '<button onclick="DealPilotZveSmart.optUpdate(\'' + opts.existingPeriod.id + '\',' + opts.newZve + ')" style="padding:11px 16px;background:var(--gold,#C9A84C);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13.5px;font-weight:600;cursor:pointer">Bestehenden Steuerzeitraum aktualisieren</button>';
      html += '<button onclick="DealPilotZveSmart.optNewPeriod(' + opts.newZve + ')" style="padding:10px 16px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">Neuen Zeitraum anlegen (z. B. nach Lohnerhöhung)</button>';
      html += '<button onclick="DealPilotZveSmart.optLocalOnly()" style="padding:10px 16px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">Nur für diese Berechnung verwenden</button>';
      html += '<button onclick="DealPilotZveSmart.optCancel()" style="padding:8px 16px;background:transparent;color:var(--muted,#7A7370);border:none;font-family:inherit;font-size:12px;cursor:pointer">Abbrechen</button>';
      html += '</div>';
    }
    
    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
  }
  
  function closeSyncDialog() {
    const o = document.getElementById('zve-sync-overlay');
    if (o) o.remove();
  }

  async function optUpdate(id, newZve) {
    try {
      const existing = (await DealPilotTaxPeriods.loadAll()).find(p => p.id === id);
      if (!existing) throw new Error('Periode nicht gefunden');
      await DealPilotTaxPeriods.update(id, {
        valid_from: existing.valid_from,
        valid_to: existing.valid_to,
        zve: newZve,
        reason: existing.reason,
        note: existing.note
      });
      if (typeof toast === 'function') toast('Steuerzeitraum aktualisiert');
      if (typeof calc === 'function') calc();
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
    closeSyncDialog();
  }

  async function optCreateNew(newZve) {
    const fromEl = document.getElementById('zve-sync-from');
    const toEl = document.getElementById('zve-sync-to');
    const from = (fromEl && fromEl.value) || getYearDefault().from;
    const to = (toEl && toEl.value) || getYearDefault().to;
    try {
      await DealPilotTaxPeriods.create({
        valid_from: from, valid_to: to,
        zve: newZve, reason: '', note: 'Aus Steuer-Tab angelegt'
      });
      if (typeof toast === 'function') toast('Steuerzeitraum angelegt');
      if (typeof calc === 'function') calc();
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
    closeSyncDialog();
  }

  async function optNewPeriod(newZve) {
    // Modal mit Zeitraum-Eingabe → wie optCreateNew, aber Default = jetzt-bis-Jahresende
    closeSyncDialog();
    const date = todayISO();
    const def = getYearDefault(date);
    // Default: heute bis Jahresende
    showSyncDialog({
      mode: 'new',
      newZve: newZve,
      date: date,
      existingPeriod: null
    });
    // Override: from = heute, to = Jahresende
    setTimeout(() => {
      const fromEl = document.getElementById('zve-sync-from');
      const toEl = document.getElementById('zve-sync-to');
      if (fromEl) fromEl.value = date;
      if (toEl) toEl.value = def.to;
    }, 50);
  }

  function optLocalOnly() {
    if (typeof toast === 'function') toast('Wert nur für diese Berechnung übernommen');
    if (typeof calc === 'function') calc();
    closeSyncDialog();
  }

  function optCancel() {
    const el = document.getElementById('zve');
    if (el && _lastZveValueBeforeEdit !== null) {
      el.value = _lastZveValueBeforeEdit;
      if (typeof calc === 'function') calc();
    }
    closeSyncDialog();
  }

  function attachListeners() {
    const zveEl = document.getElementById('zve');
    if (!zveEl) return;
    if (zveEl.dataset.smartAttached) return;
    zveEl.dataset.smartAttached = '1';
    zveEl.addEventListener('focus', onFocus);
    zveEl.addEventListener('change', onChange);
  }

  window.DealPilotZveSmart = {
    applySuggestion, dismissSuggestion,
    optUpdate, optCreateNew, optNewPeriod, optLocalOnly, optCancel,
    attach: attachListeners,
    _meta: 'V260-02'
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachListeners);
  } else {
    setTimeout(attachListeners, 300);
  }
  
  // Re-attach wenn Steuer-Tab gerendert wird (Tab-Wechsel)
  document.addEventListener('click', function(e) {
    if (e.target.closest('[data-tab="s4"], [data-target="s4"], button[onclick*="s4"]')) {
      setTimeout(attachListeners, 200);
    }
  });
})();
