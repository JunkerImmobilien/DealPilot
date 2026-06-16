'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT – all-objects.js
   Tabellarische Übersicht aller Objekte.
   Sortier- und filterbar; vorbereitet für 50+ Objekte.
═══════════════════════════════════════════════════ */

(function() {

  async function showAllObjectsView() {
    var objects = await _loadObjects();
    _render(objects);
  }

  async function _loadObjects() {
    // Use existing API getAllObjectsData()
    if (typeof getAllObjectsData === 'function') {
      try {
        var arr = await getAllObjectsData();
        return arr || [];
      } catch(e) {
        console.warn('getAllObjectsData failed:', e.message);
      }
    }
    // Fallback: localStorage scan
    var out = [];
    try {
      var raw = localStorage.getItem('ji_objects') || localStorage.getItem('dp_objects') || '[]';
      out = JSON.parse(raw) || [];
    } catch(e) {}
    return out;
  }

  // Compute display KPIs from a stored object
  function _computeRow(obj) {
    var d = obj.data || obj;  // sometimes nested
    function num(k) { return parseFloat(d[k]) || 0; }
    var kp = num('kp');
    var nkm = num('nkm') + num('ze');
    var d1 = num('d1'), d2 = num('d2');
    var d_total = d1 + d2;
    var nebenkosten = (kp * (num('makler_p') + num('notar_p') + num('gba_p') + num('gest_p') + num('ji_p')) / 100);
    var gi = kp + nebenkosten + num('san') + num('moebl');
    var bmy = kp > 0 ? (nkm * 12 / kp) * 100 : 0;
    var ek = gi - d_total;
    var ltv = gi > 0 ? (d_total / gi) * 100 : 0;
    var schuldZins = (d1 * num('d1z') + d2 * num('d2z')) / 100;
    var schuldTilg = (d1 * num('d1t') + d2 * num('d2t')) / 100;
    var dscr = (schuldZins + schuldTilg) > 0 ? (nkm * 12) / (schuldZins + schuldTilg) : 0;
    return {
      id: obj.id || obj._id || (obj.kuerzel || ''),
      kuerzel: d.kuerzel || obj.kuerzel || '–',
      adresse: ((d.str || '') + ' ' + (d.hnr || '')).trim() + (d.ort ? ', ' + d.ort : ''),
      kp: kp,
      gi: gi,
      bmy: bmy,
      dscr: dscr,
      ltv: ltv,
      cf_m: 0,  // Quick estimate could be added if needed
      raw: obj
    };
  }

  function _fmtE(v, withSign) {
    if (!isFinite(v)) v = 0;
    var sign = withSign && v >= 0 ? '+' : '';
    return sign + Math.round(v).toLocaleString('de-DE') + ' €';
  }
  function _fmtP(v) {
    if (!isFinite(v)) v = 0;
    return v.toFixed(2).replace('.', ',') + ' %';
  }
  function _fmtN(v) {
    if (!isFinite(v)) v = 0;
    return v.toFixed(2).replace('.', ',');
  }

  function _classDscr(d) {
    if (d < 1.0) return 'c-red';
    if (d < 1.2) return 'c-warn';
    return 'c-green';
  }
  function _classLtv(l) {
    if (l > 100) return 'c-red';
    if (l > 85)  return 'c-warn';
    return 'c-green';
  }

  function _render(objects) {
    var content = document.getElementById('ao-content');
    var stats = document.getElementById('ao-stats');
    if (!content) return;  // View ist nicht aktiv

    var rows = objects.map(_computeRow);
    var sortKey = window._aoSortKey || 'kuerzel';
    var sortDir = window._aoSortDir || 'asc';
    var filter = (window._aoFilter || '').toLowerCase();

    function matches(r) {
      if (!filter) return true;
      return ((r.kuerzel || '') + ' ' + (r.adresse || '')).toLowerCase().indexOf(filter) >= 0;
    }
    var visible = rows.filter(matches).slice().sort(function(a, b) {
      var av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? (av - bv) : (bv - av);
    });

    if (stats) stats.textContent = visible.length + ' / ' + rows.length + ' Objekte sichtbar';

    if (rows.length === 0) {
      content.innerHTML =
        '<div class="ao-empty">Noch keine Objekte gespeichert.<br>' +
        '<span class="hint">Lege links oder über „📋 Einzelobjekt" → „+ Neu" dein erstes Objekt an.</span></div>';
      return;
    }

    // V27: Portfolio-Header aus den Rows berechnen
    var portfolioHeader = _renderPortfolioHeader(rows);
    setTimeout(function(){ try { _aoLoadSharedPasses(); } catch (e) {} }, 0);

    content.innerHTML =
      portfolioHeader + '<div id="ao-shared-passes" style="margin:16px 0 4px"></div>' +
      '<div class="ao-table-wrap">' +
        '<table class="ao-table">' +
          '<thead>' +
            '<tr>' +
              _th('Kürzel', 'kuerzel') +
              _th('Adresse', 'adresse') +
              _th('Kaufpreis', 'kp', true) +
              _th('Gesamt-Inv.', 'gi', true) +
              _th('Brutto-Rendite', 'bmy', true) +
              _th('DSCR', 'dscr', true) +
              _th('LTV', 'ltv', true) +
              '<th class="ao-th-act">Aktion</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            visible.map(function(r) {
              return '<tr class="ao-row">' +
                '<td class="ao-kz">' + _esc(r.kuerzel) + '</td>' +
                '<td>' + _esc(r.adresse || '–') + '</td>' +
                '<td class="num">' + _fmtE(r.kp) + '</td>' +
                '<td class="num">' + _fmtE(r.gi) + '</td>' +
                '<td class="num">' + _fmtP(r.bmy) + '</td>' +
                '<td class="num ' + _classDscr(r.dscr) + '">' + _fmtN(r.dscr) + '</td>' +
                '<td class="num ' + _classLtv(r.ltv) + '">' + _fmtP(r.ltv) + '</td>' +
                '<td><button class="ao-load-btn" onclick="_aoLoad(\'' + _esc(r.id) + '\')">Laden →</button></td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="ao-footer-info"><span class="hint">Klicke auf eine Spaltenüberschrift zum Sortieren · Tippe in die Suche für Filter</span></div>';
  }

  /**
   * V27: Portfolio-Gesamtübersicht aus allen Rows aggregieren
   * (Logik: gleiche Aggregations wie in storage.js updateSidebarPortfolio).
   * Greift wenn vorhanden auf den Live-Cache aus storage.js zurück, sonst eigene Berechnung.
   */
  function _renderPortfolioHeader(rows) {
    if (!rows || rows.length === 0) return '';

    // Eigene Aggregation aus den Tabellenwerten
    var totals = {
      count: rows.length,
      invest: 0, miete_a: 0, cf_m: 0,
      bmr_sum: 0, dscr_sum: 0, dscr_n: 0,
      ltv_sum: 0, ltv_n: 0
    };
    rows.forEach(function(r) {
      if (r.gi)   totals.invest += parseFloat(r.gi) || 0;
      if (r.kp && r.bmy) totals.miete_a += (parseFloat(r.kp) * parseFloat(r.bmy) / 100);
      if (r.bmy != null) totals.bmr_sum += parseFloat(r.bmy) || 0;
      if (r.dscr > 0) { totals.dscr_sum += parseFloat(r.dscr); totals.dscr_n++; }
      if (r.ltv != null) { totals.ltv_sum += parseFloat(r.ltv); totals.ltv_n++; }
    });

    // Cashflow aus Storage-Cache holen falls verfügbar (genauer)
    var cfM = 0;
    if (window._portfolioCache && window._portfolioCache.totals) {
      cfM = window._portfolioCache.totals.cf_m || 0;
    }

    var avgBmr = totals.bmr_sum / rows.length;
    var avgDscr = totals.dscr_n > 0 ? (totals.dscr_sum / totals.dscr_n) : 0;
    var avgLtv = totals.ltv_n > 0 ? (totals.ltv_sum / totals.ltv_n) : 0;
    var mieteM = totals.miete_a / 12;

    function fE(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
    function fP(n) { return n.toFixed(2).replace('.', ',') + ' %'; }

    return '<div class="ao-portfolio-header">' +
      '<h3>📊 Portfolio-Gesamtübersicht</h3>' +
      '<div class="ao-portfolio-grid">' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Anzahl Objekte</div><div class="ao-port-val">' + totals.count + '</div></div>' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Gesamt-Investment</div><div class="ao-port-val">' + fE(totals.invest) + '</div></div>' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Mieteinnahmen / Mon.</div><div class="ao-port-val">' + fE(mieteM) + '</div></div>' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Cashflow / Mon.</div><div class="ao-port-val ' + (cfM >= 0 ? 'pos' : 'neg') + '">' + (cfM >= 0 ? '+' : '') + fE(cfM) + '</div></div>' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Ø Bruttorendite</div><div class="ao-port-val">' + fP(avgBmr) + '</div></div>' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Ø DSCR</div><div class="ao-port-val">' + (avgDscr > 0 ? avgDscr.toFixed(2).replace('.', ',') : '—') + '</div></div>' +
        '<div class="ao-port-kpi"><div class="ao-port-label">Ø LTV</div><div class="ao-port-val">' + fP(avgLtv) + '</div></div>' +
      '</div>' +
    '</div>';
  }

  function _th(label, key, num) {
    var sortKey = window._aoSortKey || 'kuerzel';
    var sortDir = window._aoSortDir || 'asc';
    var arrow = sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    var cls = (num ? 'num ' : '') + (sortKey === key ? 'ao-sorted' : '');
    return '<th class="' + cls + '" onclick="_aoSort(\'' + key + '\')">' + label + arrow + '</th>';
  }

  /* F3/qb-shared-table: Tabelle aller aktuell geteilten Objekte (nutzt window.Auth.apiCall). */
  function _restLabel(exp) {
    var ms = new Date(exp).getTime() - Date.now();
    if (!isFinite(ms) || ms <= 0) return 'abgelaufen';
    var days = ms / 86400000;
    if (days >= 1) { var d = Math.round(days); return d + ' Tag' + (d === 1 ? '' : 'e'); }
    var h = Math.max(1, Math.round(ms / 3600000));
    return h + ' Std';
  }
  function _aoLoadSharedPasses() {
    var host = document.getElementById('ao-shared-passes');
    if (!host) return;
    if (!window.Auth || typeof window.Auth.apiCall !== 'function') { host.innerHTML = ''; return; }
    var HEAD = '<div style="font:700 13px/1.2 \'Space Grotesk\',sans-serif;color:#2A2727;margin:0 2px 8px;display:flex;align-items:center;gap:7px"><span>\uD83D\uDD17</span> Geteilte Objekte<SUFFIX></div>';
    host.innerHTML = HEAD.replace('<SUFFIX>', '') + '<div style="color:#9A9390;font-size:12px;padding:2px">l\u00e4dt \u2026</div>';
    window.Auth.apiCall('/passes', { method: 'GET' }).then(function (res) {
      var items = ((res && res.items) || []).filter(function (p) { return !p.revoked_at && new Date(p.expires_at).getTime() > Date.now(); });
      if (!items.length) {
        host.innerHTML = HEAD.replace('<SUFFIX>', '') + '<div style="color:#9A9390;font-size:12.5px;padding:8px 12px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.18);border-radius:9px">Aktuell ist kein Objekt geteilt. Teile ein Objekt \u00fcber \u201eQuick Boarding teilen\u201c.</div>';
        return;
      }
      var body = items.map(function (p) {
        var datum = new Date(p.created_at).toLocaleDateString('de-DE');
        var rest = _restLabel(p.expires_at);
        var c = _esc(p.code);
        return '<tr><td>' + _esc(p.title || '\u2014') + '</td>' +
          '<td style="font-family:\'JetBrains Mono\',monospace;font-size:12px">' + c + '</td>' +
          '<td>' + datum + '</td><td>' + rest + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button type="button" style="font:600 11px/1 \'DM Sans\',sans-serif;padding:5px 9px;border-radius:7px;border:1px solid rgba(201,168,76,.45);background:#fff;color:#7a5d18;cursor:pointer" onclick="_aoPassExtend(\'' + c + '\')">Verl\u00e4ngern</button> ' +
            '<button type="button" style="font:600 11px/1 \'DM Sans\',sans-serif;padding:5px 9px;border-radius:7px;border:1px solid rgba(184,98,92,.5);background:#fff;color:#B8625C;cursor:pointer" onclick="_aoPassRevoke(\'' + c + '\')">Beenden</button>' +
          '</td></tr>';
      }).join('');
      host.innerHTML = HEAD.replace('<SUFFIX>', ' (' + items.length + ')') +
        '<div class="ao-table-wrap"><table class="ao-table"><thead><tr>' +
        '<th>Objekt</th><th>Pass-Nr</th><th>geteilt am</th><th>Restlaufzeit</th><th>Aktionen</th>' +
        '</tr></thead><tbody>' + body + '</tbody></table></div>';
    }).catch(function () { host.innerHTML = ''; });
  }
  window._aoLoadSharedPasses = _aoLoadSharedPasses;
  window._aoPassExtend = function (code) {
    if (!window.Auth) return;
    window.Auth.apiCall('/passes/' + encodeURIComponent(code) + '/extend', { method: 'POST', body: { days: 30 } })
      .then(function () { _aoLoadSharedPasses(); }).catch(function () {});
  };
  window._aoPassRevoke = function (code) {
    if (!window.Auth) return;
    if (!window.confirm('Teilen f\u00fcr diesen Pass beenden? Der Link wird ung\u00fcltig.')) return;
    window.Auth.apiCall('/passes/' + encodeURIComponent(code), { method: 'DELETE' })
      .then(function () { _aoLoadSharedPasses(); }).catch(function () {});
  };
  function _esc(s) {
    return ('' + (s || '')).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _aoSetFilter(v) {
    window._aoFilter = v;
    _refresh();
  }
  function _aoSort(key) {
    if (window._aoSortKey === key) {
      window._aoSortDir = window._aoSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      window._aoSortKey = key;
      window._aoSortDir = 'asc';
    }
    _refresh();
  }
  function _aoLoad(id) {
    // V26: Zurück zur Einzelansicht + Objekt laden
    if (typeof setMainView === 'function') setMainView('single');
    if (typeof loadSaved === 'function') {
      try { loadSaved(id); return; } catch(e) { console.warn(e); }
    }
    if (typeof toast === 'function') toast('⚠ Laden nicht möglich');
  }

  async function _refresh() {
    // V26: Inline-Refresh ohne Suche-Reset
    var objects = await _loadObjects();
    _render(objects);
  }

  // expose globals
  window.showAllObjectsView = showAllObjectsView;
  window._aoSetFilter = _aoSetFilter;
  window._aoSort = _aoSort;
  window._aoLoad = _aoLoad;
})();
