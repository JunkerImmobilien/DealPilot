/* V259-03+04+05: DealPilotTaxPeriods Module + Modal + Konflikt-Dialog */
(function() {
  'use strict';

  const STATE = {
    periods: [],
    loaded: false,
    loading: null
  };

  function token() {
    try { return localStorage.getItem('ji_token') || ''; } catch(e) { return ''; }
  }

  function authHeaders() {
    return {
      'Authorization': 'Bearer ' + token(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  function fmtEUR(n) {
    if (typeof n !== 'number') return '0 €';
    return n.toLocaleString('de-DE') + ' €';
  }

  function fmtDate(s) {
    if (!s) return '–';
    const parts = s.split('-');
    if (parts.length === 3) return parts[2] + '.' + parts[1] + '.' + parts[0];
    return s;
  }

  async function loadAll(force) {
    if (!force && STATE.loaded) return STATE.periods;
    if (STATE.loading) return STATE.loading;
    STATE.loading = (async () => {
      try {
        const res = await fetch('/api/v1/tax-periods', { headers: authHeaders() });
        if (!res.ok) {
          console.warn('[V259-03] load HTTP', res.status);
          STATE.periods = [];
          return [];
        }
        const data = await res.json();
        STATE.periods = data.periods || [];
        STATE.loaded = true;
        console.log('[V259-03] Tax-Periods geladen:', STATE.periods.length);
        return STATE.periods;
      } catch(e) {
        console.warn('[V259-03] loadAll:', e.message);
        return [];
      } finally {
        STATE.loading = null;
      }
    })();
    return STATE.loading;
  }

  async function getForDate(date) {
    if (!date) return null;
    if (!STATE.loaded) await loadAll();
    return STATE.periods.find(p => {
      if (!p.valid_from || p.valid_from > date) return false;
      if (p.valid_to && p.valid_to < date) return false;
      return true;
    }) || null;
  }

  function getForDateSync(date) {
    if (!date || !STATE.loaded) return null;
    return STATE.periods.find(p => {
      if (!p.valid_from || p.valid_from > date) return false;
      if (p.valid_to && p.valid_to < date) return false;
      return true;
    }) || null;
  }

  async function checkOverlap(from, to, excludeId) {
    const params = new URLSearchParams({ from });
    if (to) params.append('to', to);
    if (excludeId) params.append('exclude_id', excludeId);
    try {
      const res = await fetch('/api/v1/tax-periods/check-overlap?' + params.toString(), {
        headers: authHeaders()
      });
      if (!res.ok) return { overlapping: [] };
      return await res.json();
    } catch(e) {
      console.warn('[V259-03] check-overlap:', e.message);
      return { overlapping: [] };
    }
  }

  async function create(period) {
    const res = await fetch('/api/v1/tax-periods', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(period)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ('HTTP ' + res.status));
    }
    STATE.loaded = false;
    await loadAll(true);
    return (await res.json()).period;
  }

  async function update(id, period) {
    const res = await fetch('/api/v1/tax-periods/' + id, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(period)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ('HTTP ' + res.status));
    }
    STATE.loaded = false;
    await loadAll(true);
    return (await res.json()).period;
  }

  async function remove(id) {
    const res = await fetch('/api/v1/tax-periods/' + id, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    STATE.loaded = false;
    await loadAll(true);
    return true;
  }

  // ─── Modal-UI ──────────────────────────────────────────────────
  function getDefaultYearDate() {
    // V261-07: Jahr aus Kaufdatum/wirtschaftlicher Uebergang
    const wuEl = document.getElementById('wirtschaftlicher_uebergang');
    const kdEl = document.getElementById('kaufdat') || document.getElementById('purchase_date') || document.getElementById('kaufdatum');
    const ref = (wuEl && wuEl.value) || (kdEl && kdEl.value) || null;
    let year;
    if (ref) {
      year = ref.split('-')[0];
    } else {
      year = String(new Date().getFullYear());
    }
    return { from: year + '-01-01', to: year + '-12-31' };
  }
  
  function openModal() {
    let modal = document.getElementById('tax-periods-modal');
    if (modal) modal.remove();
    
    modal = document.createElement('div');
    modal.id = 'tax-periods-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;font-family:var(--font-main,\'IBM Plex Sans\',sans-serif)';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:920px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.25);max-height:calc(100vh - 80px);overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <div>
            <div style="font-size:18px;font-weight:600;color:var(--ch,#2A2727)">📅 Steuerzeiträume verwalten</div>
            <div style="font-size:12.5px;color:var(--muted,#7A7370);margin-top:3px">Zu versteuerndes Einkommen (zvE) verlaufsbasiert pflegen. Wird automatisch je nach Kaufdatum/wirtschaftlichem Übergang einem Objekt zugeordnet.</div>
          </div>
          <button onclick="DealPilotTaxPeriods.closeModal()" style="padding:8px 12px;background:transparent;border:none;color:var(--muted,#7A7370);font-size:20px;cursor:pointer">✕</button>
        </div>
        
        <div id="tp-list-host" style="margin-bottom:18px"></div>
        
        <div style="border-top:1px solid rgba(201,168,76,0.20);padding-top:14px;margin-top:8px">
          <div style="font-weight:600;font-size:14px;color:var(--ch,#2A2727);margin-bottom:8px">Neuen Zeitraum hinzufügen</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Gültig von</label>
              <input id="tp-from" type="date" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Gültig bis (leer = laufend)</label>
              <input id="tp-to" type="date" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">zvE / Jahr (€)</label>
              <input id="tp-zve" type="text" inputmode="decimal" placeholder="65000" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:end">
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Grund</label>
              <input id="tp-reason" type="text" placeholder="z.B. Lohnerhöhung" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Notiz (optional)</label>
              <input id="tp-note" type="text" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <button onclick="DealPilotTaxPeriods.submitNew()" style="padding:9px 16px;background:var(--gold,#C9A84C);color:#fff;border:1.5px solid var(--gold,#C9A84C);border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">Hinzufügen</button>
          </div>
        </div>
        
        <div id="tp-conflict-host" style="margin-top:12px"></div>
      </div>
    `;
    document.body.appendChild(modal);
    refreshList();
    // V261-07: Default-Jahr aus Kaufdatum
    try {
      const def = getDefaultYearDate();
      const fromEl = document.getElementById('tp-from');
      const toEl = document.getElementById('tp-to');
      if (fromEl && !fromEl.value) fromEl.value = def.from;
      if (toEl && !toEl.value) toEl.value = def.to;
    } catch(e) {}
  }

  function closeModal() {
    const m = document.getElementById('tax-periods-modal');
    if (m) m.remove();
  }

  async function refreshList() {
    const host = document.getElementById('tp-list-host');
    if (!host) return;
    const periods = await loadAll(true);
    
    if (periods.length === 0) {
      host.innerHTML = '<div style="font-size:13px;color:var(--muted,#7A7370);font-style:italic;padding:12px 0">Keine Zeiträume hinterlegt. Füge unten den ersten hinzu.</div>';
      return;
    }
    
    let html = '<div style="border:1px solid rgba(201,168,76,0.20);border-radius:10px;overflow:hidden">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.5fr 100px;gap:10px;padding:10px 12px;background:rgba(201,168,76,0.06);font-size:11.5px;font-weight:600;color:var(--ch,#2A2727);text-transform:uppercase;letter-spacing:0.04em">';
    html += '<div>Von</div><div>Bis</div><div>zvE</div><div>Grund</div><div></div></div>';
    
    periods.forEach((p, i) => {
      const rowBg = i % 2 === 0 ? '#fff' : 'rgba(201,168,76,0.03)';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.5fr 100px;gap:10px;padding:10px 12px;background:' + rowBg + ';border-top:1px solid rgba(201,168,76,0.10);align-items:center;font-size:13px">';
      html += '<div>' + fmtDate(p.valid_from) + '</div>';
      html += '<div>' + (p.valid_to ? fmtDate(p.valid_to) : '<span style="color:var(--muted,#7A7370);font-style:italic">laufend</span>') + '</div>';
      html += '<div style="font-weight:600">' + fmtEUR(p.zve) + '</div>';
      html += '<div style="font-size:12px;color:var(--muted,#7A7370)">' + (p.reason || '–') + (p.note ? ' <span title="' + p.note.replace(/"/g, '&quot;') + '" style="cursor:help">ℹ</span>' : '') + '</div>';
      html += '<div style="display:flex;gap:4px;justify-content:flex-end">';
      html += '<button onclick="DealPilotTaxPeriods.editPeriod(\'' + p.id + '\')" style="padding:5px 9px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:6px;font-size:11px;cursor:pointer">Bearb.</button>';
      html += '<button onclick="DealPilotTaxPeriods.removePeriod(\'' + p.id + '\')" style="padding:5px 9px;background:#fff;color:var(--red,#B8625C);border:1.5px solid rgba(184,98,92,0.30);border-radius:6px;font-size:11px;cursor:pointer">×</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function parseDe(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    s = String(s).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  async function submitNew() {
    const from = document.getElementById('tp-from').value;
    const to = document.getElementById('tp-to').value;
    const zve = parseDe(document.getElementById('tp-zve').value);
    const reason = document.getElementById('tp-reason').value;
    const note = document.getElementById('tp-note').value;
    
    if (!from) return alert('Bitte gültig-von eintragen');
    if (zve <= 0) return alert('Bitte gültigen zvE eintragen');
    if (to && to < from) return alert('Bis-Datum muss nach Von-Datum liegen');
    
    // Konflikt-Check
    const overlap = await checkOverlap(from, to, null);
    if (overlap.overlapping && overlap.overlapping.length > 0) {
      showConflictDialog(overlap.overlapping, { valid_from: from, valid_to: to || null, zve, reason, note }, null);
      return;
    }
    
    try {
      await create({ valid_from: from, valid_to: to || null, zve, reason, note });
      document.getElementById('tp-from').value = '';
      document.getElementById('tp-to').value = '';
      document.getElementById('tp-zve').value = '';
      document.getElementById('tp-reason').value = '';
      document.getElementById('tp-note').value = '';
      refreshList();
      if (typeof toast === 'function') toast('Zeitraum hinzugefügt');
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
  }

  function showConflictDialog(overlapping, newData, editId) {
    const host = document.getElementById('tp-conflict-host');
    if (!host) return;
    let html = '<div style="background:rgba(184,98,92,0.06);border:1.5px solid rgba(184,98,92,0.30);border-radius:10px;padding:14px 16px;margin-top:10px">';
    html += '<div style="font-weight:600;font-size:13px;color:var(--red,#B8625C);margin-bottom:6px">⚠ Konflikt — überschneidende Zeiträume:</div>';
    html += '<ul style="font-size:12px;color:var(--ch,#2A2727);margin:6px 0 12px;padding-left:18px">';
    overlapping.forEach(o => {
      html += '<li>' + fmtDate(o.valid_from) + ' – ' + (o.valid_to ? fmtDate(o.valid_to) : 'laufend') + ' · ' + fmtEUR(o.zve) + (o.reason ? ' (' + o.reason + ')' : '') + '</li>';
    });
    html += '</ul>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button onclick="DealPilotTaxPeriods.forceCreate(' + JSON.stringify(JSON.stringify(newData)) + ')" style="padding:8px 14px;background:var(--gold,#C9A84C);color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">Trotzdem als neuen Zeitraum anlegen</button>';
    html += '<button onclick="DealPilotTaxPeriods.cancelConflict()" style="padding:8px 14px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:7px;font-size:12px;cursor:pointer">Abbrechen</button>';
    html += '</div>';
    html += '</div>';
    host.innerHTML = html;
  }

  async function forceCreate(dataJson) {
    try {
      const data = JSON.parse(dataJson);
      await create(data);
      cancelConflict();
      document.getElementById('tp-from').value = '';
      document.getElementById('tp-to').value = '';
      document.getElementById('tp-zve').value = '';
      document.getElementById('tp-reason').value = '';
      document.getElementById('tp-note').value = '';
      refreshList();
      if (typeof toast === 'function') toast('Zeitraum hinzugefügt');
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
  }

  function cancelConflict() {
    const host = document.getElementById('tp-conflict-host');
    if (host) host.innerHTML = '';
  }

  async function editPeriod(id) {
    const p = STATE.periods.find(x => x.id === id);
    if (!p) return;
    const newZve = prompt('Neues zvE für ' + fmtDate(p.valid_from) + ' – ' + (p.valid_to ? fmtDate(p.valid_to) : 'laufend') + ':', String(p.zve));
    if (newZve === null) return;
    const zve = parseDe(newZve);
    if (zve <= 0) return alert('Ungültiger Wert');
    try {
      await update(id, { valid_from: p.valid_from, valid_to: p.valid_to, zve, reason: p.reason, note: p.note });
      refreshList();
      if (typeof toast === 'function') toast('Aktualisiert');
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
  }

  async function removePeriod(id) {
    if (!confirm('Diesen Zeitraum wirklich löschen?')) return;
    try {
      await remove(id);
      refreshList();
      if (typeof toast === 'function') toast('Gelöscht');
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
  }

  window.DealPilotTaxPeriods = {
    loadAll, getForDate, getForDateSync, checkOverlap,
    create, update, remove,
    openModal, closeModal, refreshList, submitNew,
    forceCreate, cancelConflict, editPeriod, removePeriod,
    _meta: 'V259-03'
  };

  // Initial Load nach Login
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => loadAll(), 600);
    });
  } else {
    setTimeout(() => loadAll(), 600);
  }
})();
