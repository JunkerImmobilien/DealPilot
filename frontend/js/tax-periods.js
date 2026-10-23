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
    // V314-token-check: Vor Login KEIN Fetch (spart Console-401-Noise)
    if (!window.Auth || typeof window.Auth.isLoggedIn !== 'function' || !window.Auth.isLoggedIn()) {
      STATE.periods = [];
      return [];
    }
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
        /* v2892: der Zeitraum-Zwischenspeicher in tax.js (_zveCache, 5 s)
           hielt nach einer Aenderung die ALTEN Zeitraum-Objekte - gemessen:
           2027 rechnete schon mit Splitting, 2028 (Rueckfall auf denselben
           Zeitraum) noch nicht. Nach jedem Laden verwerfen. */
        try { if (window._zveCache) window._zveCache.ts = 0; } catch (e) {}
        /* v2892: Hinweis unter den Steuerangaben nachziehen */
        try { if (window.DpSteuerAngaben && DpSteuerAngaben.zeigen) setTimeout(DpSteuerAngaben.zeigen, 0); } catch (e) {}
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

  /* ═══ v2892 · VERANLAGUNG UND KIRCHENSTEUER JE ZEITRAUM ═════════════
     Marcel 23.10.2026: die Angaben stehen seit v2891 im Investmentprofil
     und gelten fuer alle Jahre. Wer heiratet oder austritt, hat je Jahr
     eine andere Veranlagung - dafuer sind die Zeitraeume da. Jeder
     Zeitraum kann beides ueberstimmen; "wie Profil" (null) ist die
     Vorgabe, damit ein bestehender Zeitraum nichts aendert. */
  const SEL_STIL = 'height:36px;padding:0 8px;border:1.5px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);border-radius:8px;font-size:13px;width:100%;background:#fff';
  function _opt(wert, text, akt) {
    return '<option value="' + wert + '"' + (String(akt) === String(wert) ? ' selected' : '') + '>' + text + '</option>';
  }
  function splittingOptionen(akt) {
    const a = (akt === true) ? '1' : (akt === false) ? '0' : '';
    return _opt('', 'wie Profil', a) + _opt('0', 'Einzelveranlagung', a) + _opt('1', 'Zusammenveranlagung (Splitting)', a);
  }
  function kistOptionen(akt) {
    const a = (akt === 0 || akt === 8 || akt === 9) ? String(akt) : '';
    return _opt('', 'wie Profil', a) + _opt('0', 'keine', a) + _opt('8', '8 % (BY, BW)', a) + _opt('9', '9 % (übrige Länder)', a);
  }
  function veranlagungFelder() {
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
      + '<div><label for="tp-splitting" style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Veranlagung in diesem Zeitraum</label>'
      + '<select id="tp-splitting" style="' + SEL_STIL + '">' + splittingOptionen(null) + '</select></div>'
      + '<div><label for="tp-kist" style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Kirchensteuer in diesem Zeitraum</label>'
      + '<select id="tp-kist" style="' + SEL_STIL + '">' + kistOptionen(null) + '</select></div>'
      + '</div>';
  }
  function _ausSelect(id, art) {
    const el = document.getElementById(id);
    if (!el || el.value === '') return null;
    if (art === 'splitting') return el.value === '1';
    const k = parseInt(el.value, 10);
    return (k === 0 || k === 8 || k === 9) ? k : null;
  }
  function _formLeeren() {
    ['tp-from', 'tp-to', 'tp-zve', 'tp-reason', 'tp-note', 'tp-splitting', 'tp-kist'].forEach(function (id) {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  function _nachRechnen() {
    try { if (window.DpSteuerAngaben && DpSteuerAngaben.zeigen) DpSteuerAngaben.zeigen(); } catch (e) {}
    try { if (typeof calcNow === 'function') calcNow(); else if (typeof calc === 'function') calc(); } catch (e) {}
  }
  /* In der Liste direkt umstellbar - ohne prompt(), das in eingebetteten
     Ansichten nicht erscheint. */
  async function setVeranlagung(id, art, wert) {
    const p = STATE.periods.find(x => x.id === id);
    if (!p) return;
    const body = { valid_from: p.valid_from, valid_to: p.valid_to, zve: p.zve, reason: p.reason, note: p.note };
    if (art === 'splitting') body.splitting = (wert === '') ? null : (wert === '1');
    else body.kirchensteuer = (wert === '') ? null : parseInt(wert, 10);
    try {
      await update(id, body);
      refreshList();
      _nachRechnen();
      if (typeof toast === 'function') toast('Aktualisiert');
    } catch (e) {
      alert('Fehler: ' + e.message);
    }
  }
  function getAllSync() { return STATE.loaded ? STATE.periods.slice() : []; }

  // ─── Modal-UI ──────────────────────────────────────────────────
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
          ${veranlagungFelder()}
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
  }

  /* v841-render-inline: Steuerzeitraeume-Verwaltung INLINE (ohne Modal) in einen Host rendern.
     Gleiche IDs wie das Modal (tp-list-host/tp-from/tp-to/tp-zve/tp-reason/tp-note/tp-conflict-host)
     -> refreshList/submitNew/editPeriod/removePeriod funktionieren unveraendert. DB-Logik 1:1. */
  function renderInline(host) {
    if (typeof host === 'string') host = document.getElementById(host);
    if (!host) return;
    host.innerHTML = `
      <div style="background:#fff;border:1px solid rgba(201,168,76,0.20);border-radius:12px;padding:18px 20px">
        <div style="margin-bottom:14px">
          <div style="font-size:15px;font-weight:600;color:var(--ch,#2A2727);display:flex;align-items:center;gap:7px">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Steuerzeitr\u00e4ume verwalten
          </div>
          <div style="font-size:12.5px;color:var(--muted,#7A7370);margin-top:3px">Zu versteuerndes Einkommen (zvE) verlaufsbasiert pflegen \u2014 gilt f\u00fcr alle privaten Objekte. Wird automatisch je nach Kaufdatum/wirtschaftlichem \u00dcbergang zugeordnet.</div>
        </div>

        <div id="tp-list-host" style="margin-bottom:18px"></div>

        <div style="border-top:1px solid rgba(201,168,76,0.20);padding-top:14px;margin-top:8px">
          <div style="font-weight:600;font-size:14px;color:var(--ch,#2A2727);margin-bottom:8px">Neuen Zeitraum hinzuf\u00fcgen</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">G\u00fcltig von</label>
              <input id="tp-from" type="date" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">G\u00fcltig bis (leer = laufend)</label>
              <input id="tp-to" type="date" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">zvE / Jahr (\u20ac)</label>
              <input id="tp-zve" type="text" inputmode="decimal" placeholder="65000" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
          </div>
          ${veranlagungFelder()}
          <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:end">
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Grund</label>
              <input id="tp-reason" type="text" placeholder="z.B. Lohnerh\u00f6hung" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <div>
              <label style="font-size:11px;color:var(--muted,#7A7370);display:block;margin-bottom:3px">Notiz (optional)</label>
              <input id="tp-note" type="text" style="height:36px;padding:0 10px;border:1.5px solid rgba(201,168,76,0.30);border-radius:8px;font-size:13px;width:100%" />
            </div>
            <button onclick="DealPilotTaxPeriods.submitNew()" style="padding:9px 16px;background:var(--gold,#C9A84C);color:#fff;border:1.5px solid var(--gold,#C9A84C);border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">Hinzuf\u00fcgen</button>
          </div>
        </div>

        <div id="tp-conflict-host" style="margin-top:12px"></div>
      </div>
    `;
    refreshList();
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
    
    let html = '<div style="border:1px solid rgba(201,168,76,0.20);border-radius:10px;overflow-x:auto;--dpm-schiene:1"><div style="min-width:720px">';
    html += '<div style="display:grid;grid-template-columns:0.9fr 0.9fr 0.9fr 1.4fr 1fr 1.2fr 90px;gap:10px;padding:10px 12px;background:rgba(201,168,76,0.06);font-size:11.5px;font-weight:600;color:var(--ch,#2A2727);text-transform:uppercase;letter-spacing:0.04em">';
    html += '<div>Von</div><div>Bis</div><div>zvE</div><div>Veranlagung</div><div>Kirchenst.</div><div>Grund</div><div></div></div>';
    
    periods.forEach((p, i) => {
      const rowBg = i % 2 === 0 ? '#fff' : 'rgba(201,168,76,0.03)';
      html += '<div style="display:grid;grid-template-columns:0.9fr 0.9fr 0.9fr 1.4fr 1fr 1.2fr 90px;gap:10px;padding:10px 12px;background:' + rowBg + ';border-top:1px solid rgba(201,168,76,0.10);align-items:center;font-size:13px">';
      html += '<div>' + fmtDate(p.valid_from) + '</div>';
      html += '<div>' + (p.valid_to ? fmtDate(p.valid_to) : '<span style="color:var(--muted,#7A7370);font-style:italic">laufend</span>') + '</div>';
      html += '<div style="font-weight:600">' + fmtEUR(p.zve) + '</div>';
      /* v2892: je Zeitraum umstellbar */
      html += '<div><select aria-label="Veranlagung ' + fmtDate(p.valid_from) + '" onchange="DealPilotTaxPeriods.setVeranlagung(\'' + p.id + '\',\'splitting\',this.value)" style="' + SEL_STIL + ';height:30px;font-size:12px">' + splittingOptionen(p.splitting) + '</select></div>';
      html += '<div><select aria-label="Kirchensteuer ' + fmtDate(p.valid_from) + '" onchange="DealPilotTaxPeriods.setVeranlagung(\'' + p.id + '\',\'kirchensteuer\',this.value)" style="' + SEL_STIL + ';height:30px;font-size:12px">' + kistOptionen(p.kirchensteuer) + '</select></div>';
      html += '<div style="font-size:12px;color:var(--muted,#7A7370)">' + (p.reason || '–') + (p.note ? ' <span title="' + p.note.replace(/"/g, '&quot;') + '" style="cursor:help">ℹ</span>' : '') + '</div>';
      html += '<div style="display:flex;gap:4px;justify-content:flex-end">';
      html += '<button onclick="DealPilotTaxPeriods.editPeriod(\'' + p.id + '\')" style="padding:5px 9px;background:#fff;color:var(--ch,#2A2727);border:1.5px solid rgba(201,168,76,0.30);border-radius:6px;font-size:11px;cursor:pointer">Bearb.</button>';
      html += '<button onclick="DealPilotTaxPeriods.removePeriod(\'' + p.id + '\')" style="padding:5px 9px;background:#fff;color:var(--red,#B8625C);border:1.5px solid rgba(184,98,92,0.30);border-radius:6px;font-size:11px;cursor:pointer">×</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div></div>';   /* v2892: innerer Rahmen min-width */
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
    const splitting = _ausSelect('tp-splitting', 'splitting');      /* v2892 */
    const kirchensteuer = _ausSelect('tp-kist', 'kirchensteuer');
    
    if (!from) return alert('Bitte gültig-von eintragen');
    if (zve <= 0) return alert('Bitte gültigen zvE eintragen');
    if (to && to < from) return alert('Bis-Datum muss nach Von-Datum liegen');
    
    // Konflikt-Check
    const overlap = await checkOverlap(from, to, null);
    if (overlap.overlapping && overlap.overlapping.length > 0) {
      showConflictDialog(overlap.overlapping, { valid_from: from, valid_to: to || null, zve, reason, note, splitting, kirchensteuer }, null);
      return;
    }
    
    try {
      await create({ valid_from: from, valid_to: to || null, zve, reason, note, splitting, kirchensteuer });
      _formLeeren();
      refreshList();
      _nachRechnen();
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
      _formLeeren();
      refreshList();
      _nachRechnen();
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
      _nachRechnen();
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
      _nachRechnen();
      if (typeof toast === 'function') toast('Gelöscht');
    } catch(e) {
      alert('Fehler: ' + e.message);
    }
  }

  window.DealPilotTaxPeriods = {
    loadAll, getForDate, getForDateSync, checkOverlap,
    create, update, remove,
    openModal, closeModal, renderInline, refreshList, submitNew, /* v841-render-inline */
    forceCreate, cancelConflict, editPeriod, removePeriod,
    setVeranlagung, getAllSync,   /* v2892 */
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
