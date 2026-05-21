/* V260-01: Alle Objekte — 3 Ansichten (Liste / Karten / Kanban)
 * inspired by deal-tracker-mockup.html (Gold/Creme angepasst)
 */
(function() {
  'use strict';

  const STORAGE_VIEW_KEY = 'dp_allobjects_view';
  const STORAGE_FILTER_KEY = 'dp_allobjects_filter';
  
  function getView() {
    try {
      return localStorage.getItem(STORAGE_VIEW_KEY) || 'cards';
    } catch(e) { return 'cards'; }
  }
  
  function setView(v) {
    try { localStorage.setItem(STORAGE_VIEW_KEY, v); } catch(e) {}
  }
  
  function getFilter() {
    try {
      return localStorage.getItem(STORAGE_FILTER_KEY) || 'all';
    } catch(e) { return 'all'; }
  }
  
  function setFilter(f) {
    try { localStorage.setItem(STORAGE_FILTER_KEY, f); } catch(e) {}
  }

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
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    return n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
  }

  function fmtDate(s) {
    if (!s) return '–';
    const parts = String(s).split('T')[0].split('-');
    if (parts.length === 3) return parts[2] + '.' + parts[1] + '.' + parts[0];
    return s;
  }

  function getStatus(obj) {
    const d = obj.data || {};
    if (d._deal_won === true || d._deal_won === 'true') return 'won';
    if (d._deal_lost === true || d._deal_lost === 'true') return 'lost';
    return 'open';
  }

  function statusLabel(s) {
    return s === 'won' ? 'Gewonnen' : s === 'lost' ? 'Verloren' : 'Offen';
  }

  let _objects = [];
  let _loading = false;

  async function loadObjects(force) {
    if (_loading) return _objects;
    if (!force && _objects.length > 0) return _objects;
    _loading = true;
    try {
      const res = await fetch('/api/v1/objects?limit=500', { headers: authHeaders() });
      if (!res.ok) {
        console.warn('[V260-01] load HTTP', res.status);
        return [];
      }
      const data = await res.json();
      _objects = Array.isArray(data.objects) ? data.objects : (Array.isArray(data) ? data : []);
      return _objects;
    } catch(e) {
      console.warn('[V260-01] loadObjects:', e.message);
      return [];
    } finally {
      _loading = false;
    }
  }

  function filterObjects(objs, filter) {
    if (filter === 'all') return objs.slice();
    return objs.filter(o => getStatus(o) === filter);
  }

  function getKPIs(objs) {
    const total = objs.length;
    const won = objs.filter(o => getStatus(o) === 'won').length;
    const lost = objs.filter(o => getStatus(o) === 'lost').length;
    const open = total - won - lost;
    const decided = won + lost;
    const hitRate = decided > 0 ? Math.round((won / decided) * 100) : 0;
    let totalKp = 0, wonKp = 0;
    objs.forEach(o => {
      const kp = parseFloat((o.data && o.data.kaufpreis) || 0) || 0;
      totalKp += kp;
      if (getStatus(o) === 'won') wonKp += kp;
    });
    return { total, won, lost, open, decided, hitRate, totalKp, wonKp };
  }

  // ─── KPI-Card ──────────────────────────────────────────────────
  function renderKPIs(objs) {
    const kpi = getKPIs(objs);
    return '<div class="ao-kpi-grid">' +
      '<div class="ao-kpi">' +
        '<div class="ao-kpi-label">Objekte gesamt</div>' +
        '<div class="ao-kpi-value">' + kpi.total + '</div>' +
        '<div class="ao-kpi-sub">' + kpi.open + ' offen · ' + kpi.won + ' gewonnen · ' + kpi.lost + ' verloren</div>' +
      '</div>' +
      '<div class="ao-kpi">' +
        '<div class="ao-kpi-label">Hit-Rate</div>' +
        '<div class="ao-kpi-value ao-kpi-gold">' + kpi.hitRate + ' %</div>' +
        '<div class="ao-kpi-sub">' + kpi.won + ' von ' + kpi.decided + ' entschiedenen</div>' +
      '</div>' +
      '<div class="ao-kpi">' +
        '<div class="ao-kpi-label">Investitionsvolumen (gewonnen)</div>' +
        '<div class="ao-kpi-value ao-kpi-gold">' + fmtEUR(kpi.wonKp) + '</div>' +
        '<div class="ao-kpi-sub">' + fmtEUR(kpi.totalKp) + ' alle Objekte</div>' +
      '</div>' +
      '<div class="ao-kpi">' +
        '<div class="ao-kpi-label">Ø Kaufpreis (gewonnen)</div>' +
        '<div class="ao-kpi-value">' + (kpi.won > 0 ? fmtEUR(kpi.wonKp / kpi.won) : '0 €') + '</div>' +
        '<div class="ao-kpi-sub">über ' + kpi.won + ' Objekte</div>' +
      '</div>' +
    '</div>';
  }

  // ─── View-Switcher + Filter ────────────────────────────────────
  function renderControls() {
    const v = getView();
    const f = getFilter();
    return '<div class="ao-controls">' +
      '<div class="ao-view-switch">' +
        '<button class="ao-view-btn' + (v === 'cards' ? ' active' : '') + '" onclick="DealPilotAllObjects.setViewAndRender(\'cards\')"><span style="margin-right:6px">▦</span>Karten</button>' +
        '<button class="ao-view-btn' + (v === 'list' ? ' active' : '') + '" onclick="DealPilotAllObjects.setViewAndRender(\'list\')"><span style="margin-right:6px">≡</span>Liste</button>' +
        '<button class="ao-view-btn' + (v === 'kanban' ? ' active' : '') + '" onclick="DealPilotAllObjects.setViewAndRender(\'kanban\')"><span style="margin-right:6px">⊞</span>Kanban</button>' +
      '</div>' +
      (v !== 'kanban' ? (
        '<div class="ao-filter-pills">' +
          '<button class="ao-filter-pill' + (f === 'all' ? ' active' : '') + '" onclick="DealPilotAllObjects.setFilterAndRender(\'all\')">Alle</button>' +
          '<button class="ao-filter-pill' + (f === 'open' ? ' active' : '') + '" onclick="DealPilotAllObjects.setFilterAndRender(\'open\')">Offen</button>' +
          '<button class="ao-filter-pill' + (f === 'won' ? ' active' : '') + '" onclick="DealPilotAllObjects.setFilterAndRender(\'won\')">Gewonnen</button>' +
          '<button class="ao-filter-pill' + (f === 'lost' ? ' active' : '') + '" onclick="DealPilotAllObjects.setFilterAndRender(\'lost\')">Verloren</button>' +
        '</div>'
      ) : '') +
    '</div>';
  }

  // ─── Karten-Ansicht ────────────────────────────────────────────
  function renderCard(obj) {
    const d = obj.data || {};
    const status = getStatus(obj);
    const adresse = d.adresse || d.adresse_text || '(ohne Adresse)';
    const objektname = d.objekt_name || d.name || adresse.split(',')[0] || 'Objekt';
    const kp = parseFloat(d.kaufpreis || 0) || 0;
    const wohnflaeche = d.wohnflaeche || d.wfl || '–';
    const baujahr = d.baujahr || '–';
    
    return '<div class="ao-card ao-status-' + status + '" onclick="DealPilotAllObjects.openObject(\'' + obj.id + '\')">' +
      '<div class="ao-card-status-strip"></div>' +
      '<div class="ao-card-body">' +
        '<div class="ao-card-status-badge">' + statusLabel(status) + '</div>' +
        '<div class="ao-card-title">' + objektname + '</div>' +
        '<div class="ao-card-addr">' + adresse + '</div>' +
        '<div class="ao-card-meta">' +
          '<span>📐 ' + wohnflaeche + ' m²</span>' +
          '<span>🗓 BJ ' + baujahr + '</span>' +
        '</div>' +
        '<div class="ao-card-price">' + fmtEUR(kp) + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderCardsView(objs) {
    if (objs.length === 0) {
      return '<div class="ao-empty">Keine Objekte mit dem gewählten Filter.</div>';
    }
    return '<div class="ao-cards-grid">' + objs.map(renderCard).join('') + '</div>';
  }

  // ─── Listen-Ansicht ────────────────────────────────────────────
  function renderListView(objs) {
    if (objs.length === 0) {
      return '<div class="ao-empty">Keine Objekte mit dem gewählten Filter.</div>';
    }
    let html = '<div class="ao-list">';
    html += '<div class="ao-list-head">';
    html += '<div>Status</div><div>Objekt</div><div>Adresse</div><div>Wohnfl.</div><div>Baujahr</div><div style="text-align:right">Kaufpreis</div><div></div>';
    html += '</div>';
    objs.forEach(o => {
      const d = o.data || {};
      const status = getStatus(o);
      const name = d.objekt_name || d.name || (d.adresse || '').split(',')[0] || 'Objekt';
      const adresse = d.adresse || d.adresse_text || '–';
      const wfl = d.wohnflaeche || d.wfl || '–';
      const bj = d.baujahr || '–';
      const kp = parseFloat(d.kaufpreis || 0) || 0;
      html += '<div class="ao-list-row" onclick="DealPilotAllObjects.openObject(\'' + o.id + '\')">' +
        '<div><span class="ao-status-pill ao-status-' + status + '">' + statusLabel(status) + '</span></div>' +
        '<div class="ao-list-name">' + name + '</div>' +
        '<div class="ao-list-addr">' + adresse + '</div>' +
        '<div>' + wfl + ' m²</div>' +
        '<div>' + bj + '</div>' +
        '<div class="ao-list-price">' + fmtEUR(kp) + '</div>' +
        '<div class="ao-list-arrow">›</div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  // ─── Kanban-Ansicht ────────────────────────────────────────────
  function renderKanbanCard(obj) {
    const d = obj.data || {};
    const status = getStatus(obj);
    const name = d.objekt_name || d.name || (d.adresse || '').split(',')[0] || 'Objekt';
    const adresse = d.adresse || d.adresse_text || '';
    const kp = parseFloat(d.kaufpreis || 0) || 0;
    const updatedAt = obj.updated_at ? fmtDate(obj.updated_at) : '';
    
    return '<div class="ao-kanban-card ao-kanban-status-' + status + '" onclick="DealPilotAllObjects.openObject(\'' + obj.id + '\')">' +
      '<div class="ao-kanban-card-title">' + name + '</div>' +
      '<div class="ao-kanban-card-addr">' + adresse + '</div>' +
      '<div class="ao-kanban-card-row">' +
        '<span class="ao-kanban-card-price">' + fmtEUR(kp) + '</span>' +
        (updatedAt ? '<span class="ao-kanban-card-meta">' + updatedAt + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  function renderKanbanView(objs) {
    const cols = {
      open: { label: 'Offen', cls: 'open', icon: '⏳', items: [] },
      won: { label: 'Gewonnen', cls: 'won', icon: '✓', items: [] },
      lost: { label: 'Verloren', cls: 'lost', icon: '✗', items: [] }
    };
    objs.forEach(o => {
      const s = getStatus(o);
      if (cols[s]) cols[s].items.push(o);
    });
    
    let html = '<div class="ao-kanban">';
    ['open', 'won', 'lost'].forEach(key => {
      const col = cols[key];
      html += '<div class="ao-kanban-col ao-kanban-col-' + col.cls + '">';
      html += '<div class="ao-kanban-col-header">';
      html += '<div class="ao-kanban-col-title">' + col.icon + ' ' + col.label + '</div>';
      html += '<div class="ao-kanban-count">' + col.items.length + '</div>';
      html += '</div>';
      html += '<div class="ao-kanban-col-body">';
      if (col.items.length === 0) {
        html += '<div class="ao-kanban-empty">Keine Objekte</div>';
      } else {
        html += col.items.map(renderKanbanCard).join('');
      }
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  // ─── Haupt-Render ─────────────────────────────────────────────
  async function render() {
    const host = document.getElementById('all-objects-main') || document.getElementById('s-all-objects') || document.querySelector('.all-objects-view');
    if (!host) {
      // Eigenen Host erstellen — am Ende von main-col
      const mainCol = document.querySelector('.main-col');
      if (!mainCol) return;
      let host2 = document.getElementById('dp-allobjects-v260-host');
      if (!host2) {
        host2 = document.createElement('div');
        host2.id = 'dp-allobjects-v260-host';
        host2.className = 'sec';
        host2.style.display = 'none';
        mainCol.appendChild(host2);
      }
      return _renderInto(host2);
    }
    
    // Vorhandenen Host erweitern: V260-Container vor den existierenden Inhalt
    let v260Host = host.querySelector('.dp-v260-allobjects');
    if (!v260Host) {
      v260Host = document.createElement('div');
      v260Host.className = 'dp-v260-allobjects';
      host.insertBefore(v260Host, host.firstChild);
    }
    _renderInto(v260Host);
  }

  async function _renderInto(host) {
    host.innerHTML = '<div class="ao-loading">Lade Objekte…</div>';
    const objs = await loadObjects(true);
    const filter = getFilter();
    const view = getView();
    const filtered = filterObjects(objs, filter);
    
    let html = '';
    html += renderKPIs(objs); // KPIs immer über alle Objekte
    html += renderControls();
    
    if (view === 'cards')      html += renderCardsView(filtered);
    else if (view === 'list')  html += renderListView(filtered);
    else if (view === 'kanban') html += renderKanbanView(objs); // Kanban ignoriert Filter
    
    host.innerHTML = html;
  }

  function setViewAndRender(v) {
    setView(v);
    render();
  }
  
  function setFilterAndRender(f) {
    setFilter(f);
    render();
  }

  function openObject(id) {
    // Bestehende Object-Open-Funktion verwenden
    if (window.openObject) {
      window.openObject(id);
    } else if (window.loadObject) {
      window.loadObject(id);
    } else {
      window.location.hash = '#object/' + id;
    }
  }

  window.DealPilotAllObjects = {
    render: render,
    refresh: () => render(),
    setViewAndRender: setViewAndRender,
    setFilterAndRender: setFilterAndRender,
    openObject: openObject,
    _meta: 'V260-01'
  };

  // Auto-Render wenn "Alle Objekte"-View geöffnet wird
  document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-view="all-objects"], [onclick*="all-objects"], [data-target="all-objects"]');
    if (target) setTimeout(render, 100);
  });
})();
