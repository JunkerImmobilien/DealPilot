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

  /* ── v2084a · DIE STATUSFELDER LIEGEN FLACH, NICHT IN `data` ──────────
   *
   * HIER STAND NUR `obj.data._deal_won`. Gemessen am 10.10.2026 an der
   * echten Antwort von `GET /objects?limit=500`: die 23 Einträge tragen
   * **kein `data`-Feld** (0 von 23). Der Status steht flach und ohne
   * Unterstrich:
   *
   *     deal_won: true/false      deal_lost: true/false
   *     ankauf_kurz, ankauf_stichtag, lageklasse, dealpilot_score, …
   *
   * `obj.data || {}` ergab also immer `{}`, und damit war jedes Objekt
   * **'open'** — alle 23, auch die acht gewonnenen.
   *
   * > Zusammen mit dem `items`-Fehler in `loadObjects()` war die Ansicht
   * > doppelt kaputt: erst kam nichts an, und wäre etwas angekommen,
   * > hätte alles in einer Spalte gelegen. Beides ohne Fehlermeldung.
   *
   * Beide Formen werden jetzt gelesen — flach zuerst, weil der Server
   * so antwortet. Die `data`-Form bleibt, weil andere Aufrufer
   * (`storage.js`-Spiegel, Einzelobjekt-Abruf) sie liefern. */
  function getStatus(obj) {
    const d = obj.data || {};
    const won  = (obj.deal_won  !== undefined) ? obj.deal_won  : d._deal_won;
    const lost = (obj.deal_lost !== undefined) ? obj.deal_lost : d._deal_lost;
    if (won === true || won === 'true') return 'won';
    if (lost === true || lost === 'true') return 'lost';
    return 'open';
  }

  /* ── v2084 · DIE KANBAN-SPALTE „BESTAND" (Backlog N60.16) ─────────────
   *
   * Marcel, 09.10.2026: „Ein gewonnenes Objekt gehört in eine Spalte
   * Bestand, nicht weiter in die Akquise-Strecke."
   *
   * Bestand heißt: gewonnen UND der Ankauf-Stand ist festgeschrieben —
   * also der Lastenwechsel vollzogen und der Stand eingefroren
   * (`_ankauf`, seit v2030). Ein gewonnener Deal ohne diesen Stand ist
   * noch nicht im Bestand; da fehlt der Stichtag.
   *
   * `ankauf_stichtag` ist eine LISTENSPALTE (`objectService.js:51`) und
   * liegt auf der oberen Ebene, nicht in `data`. `loadObjects()` liest
   * die rohe Serverantwort, also steht sie hier so zur Verfügung.
   *
   * ── WARUM getStatus() UNBERÜHRT BLEIBT ──────────────────────────────
   * `getStatus()` speist auch `filterObjects()` und `getKPIs()`. Würde
   * dort aus 'won' plötzlich 'bestand', sänke die angezeigte Gewinnquote,
   * ohne dass ein Deal verloren ging — eine Kennzahl, die sich durch eine
   * Ansichtsänderung bewegt, ist keine. Die Kanban-Ansicht bekommt
   * deshalb ihre EIGENE Einteilung, und die Zählung bleibt, wie sie war.
   *
   * GEMESSEN am 10.10.2026 am echten Portfolio (23 Objekte):
   *   gewonnen und Ankauf-Stand   3   -> Bestand
   *   gewonnen ohne Ankauf-Stand  5   -> bleibt Gewonnen
   *   Ankauf-Stand ohne gewonnen  0
   *
   * > Marcels Befund aus N60.19 („Objekte, die im Bestand stehen, aber
   * > gar nicht auf Gewonnen gesetzt sind") trifft auf diesen Datenstand
   * > NICHT zu — es gibt null davon. Die Richtung ist umgekehrt: fünf
   * > gewonnene Deals ohne eingefrorenen Ankauf-Stand. Das ist auch ein
   * > unvollständiger Zustand, aber ein anderer.
   */
  function istBestand(obj) {
    if (getStatus(obj) !== 'won') return false;
    /* Der Stichtag kann als Listenspalte oder im Datensatz stehen. */
    if (obj.ankauf_stichtag) return true;
    const a = (obj.data || {})._ankauf;
    return !!(a && (a.stichtag || a.kurz));
  }

  function getKanbanSpalte(obj) {
    const s = getStatus(obj);
    if (s === 'won') return istBestand(obj) ? 'bestand' : 'won';
    return s;
  }

  function statusLabel(s) {
    return s === 'won' ? 'Gewonnen' : s === 'lost' ? 'Verloren' : 'Offen';
  }

  let _objects = [];
  let _loading = false;

  async function loadObjects(force) {
    if (_loading) return _objects;
    if (!force && _objects.length > 0) return _objects;
    // V314-token-check: Vor Login KEIN Fetch (spart Console-401-Noise)
    if (!window.Auth || typeof window.Auth.isLoggedIn !== 'function' || !window.Auth.isLoggedIn()) {
      return [];
    }
    _loading = true;
    try {
      const res = await fetch('/api/v1/objects?limit=500', { headers: authHeaders() });
      if (!res.ok) {
        console.warn('[V260-01] load HTTP', res.status);
        return [];
      }
      const data = await res.json();
      /* ── v2084a · DIE ANTWORT HEISST `items`, NICHT `objects` ─────────
       *
       * HIER STAND `data.objects` mit `data` als Rückfall. Gemessen am
       * 10.10.2026 an der echten Antwort von `GET /objects?limit=500`:
       *
       *     { "items": [ … 23 Objekte … ], "count": 23 }
       *
       * `data.objects` ist dort `undefined`, und `data` selbst ist kein
       * Array — beide Zweige greifen nicht, `_objects` blieb **leer**.
       *
       * > Die ganze Ansicht „Alle Objekte" zeigte nichts: Karten, Liste
       * > und Kanban. Und zwar ohne Fehler — `res.ok` war wahr, der
       * > Rückfall lieferte ein gültiges leeres Array, und eine leere
       * > Liste sieht aus wie ein leeres Portfolio. Aufgefallen beim
       * > Nachmessen der neuen Kanban-Spalte: vier Spalten, alle mit
       * > Anzahl 0, während die Seitenliste 23 Karten zeigte.
       *
       * Gesucht wird jetzt in dieser Reihenfolge, und `items` zuerst,
       * weil der Server es so nennt. Die anderen Namen bleiben als
       * Rückfall stehen — eine Antwortform, die sich einmal geändert
       * hat, kann sich wieder ändern. */
      _objects = Array.isArray(data.items) ? data.items
        : Array.isArray(data.objects) ? data.objects
        : Array.isArray(data.data) ? data.data
        : Array.isArray(data) ? data : [];
      if (!_objects.length && data && typeof data.count === 'number' && data.count > 0) {
        /* Der Server zaehlt mehr, als hier ankommt — das ist ein Formfehler
           und keine leere Liste. Sichtbar machen, nicht verschweigen. */
        console.warn('[V260-01] Antwort trägt count=' + data.count
          + ', aber keine erkannte Liste. Schlüssel: ' + Object.keys(data).join(','));
      }
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
    /* ── v2084a · DER KAUFPREIS LIEGT AUCH FLACH ──────────────────────
       HIER STAND NUR `o.data.kaufpreis`. Dieselbe Ursache wie beim
       Status: die Listenantwort traegt kein `data`. Gemessen steht dort
       `kaufpreis: "1680000.00"` auf der oberen Ebene — und im
       Objekt-Datensatz heisst dasselbe Feld `kp`.

       Folge, im Browser gesehen: „Investitionsvolumen (gewonnen) 0 EUR"
       und „Oe Kaufpreis (gewonnen) 0 EUR" bei acht gewonnenen Objekten.
       Eine Null sieht aus wie ein Ergebnis.

       Alle drei Namen werden gelesen. Der Wert ist ein String in EURO,
       nicht in Cent (nachgesehen, nicht angenommen). */
    let totalKp = 0, wonKp = 0;
    objs.forEach(o => {
      const d = o.data || {};
      const roh = (o.kaufpreis !== undefined && o.kaufpreis !== null) ? o.kaufpreis
        : (d.kaufpreis !== undefined && d.kaufpreis !== null) ? d.kaufpreis
        : d.kp;
      const kp = parseFloat(String(roh == null ? '' : roh).replace(',', '.')) || 0;
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
    /* v2084: vier Spalten. „Bestand" ist das Ende der Strecke, nicht
       „Gewonnen" — ein gewonnener Deal ohne eingefrorenen Ankauf-Stand
       steht noch dazwischen und wird genau dort sichtbar. */
    const cols = {
      open:    { label: 'Offen',     cls: 'open',    icon: '⏳', items: [] },
      won:     { label: 'Gewonnen',  cls: 'won',     icon: '✓', items: [] },
      bestand: { label: 'Bestand',   cls: 'bestand', icon: '🏠', items: [] },
      lost:    { label: 'Verloren',  cls: 'lost',    icon: '✗', items: [] }
    };
    objs.forEach(o => {
      const s = getKanbanSpalte(o);
      if (cols[s]) cols[s].items.push(o);
    });

    let html = '<div class="ao-kanban">';
    ['open', 'won', 'bestand', 'lost'].forEach(key => {
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
