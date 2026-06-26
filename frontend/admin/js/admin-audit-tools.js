// DealPilot Admin v802 — Audit-Log Werkzeuge: Zeitraum-Filter + Alle loeschen
// Eigenstaendig. Haengt eine Steuerleiste oben in die Audit-View und ruft die
// Audit-Liste mit from/to-Parametern neu. Einzeln-Loeschen existiert bereits.
'use strict';
(function () {
  var BASE = '/api/v1/admin';
  function _token() { return localStorage.getItem('dp_admin_token') || ''; }
  async function _call(method, path) {
    var headers = {}; var t = _token(); if (t) headers['X-Admin-Token'] = t;
    var r = await fetch(BASE + path, { method: method, headers: headers });
    var data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
    return data;
  }
  function _toast(msg, type) {
    try { var c = document.getElementById('toast-container'); if (c) { var d = document.createElement('div'); d.className = 'toast toast-' + (type || 'info'); d.textContent = msg; c.appendChild(d); setTimeout(function () { d.remove(); }, 4000); return; } } catch (e) {}
    alert(msg);
  }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _fmt(d) { try { return new Date(d).toLocaleString('de-DE'); } catch (e) { return '\u2013'; } }

  var _from = '', _to = '';

  function _auditView() { return document.getElementById('view-audit'); }

  function _ensureBar() {
    var v = _auditView();
    if (!v) return null;
    if (document.getElementById('audx-bar')) return document.getElementById('audx-bar');
    var bar = document.createElement('div');
    bar.id = 'audx-bar';
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0;padding:12px;background:#faf9f6;border:1px solid #eee;border-radius:8px;';
    bar.innerHTML =
      '<span style="font-size:13px;color:#666;">Zeitraum:</span>' +
      '<input type="date" id="audx-from" style="padding:6px;border:1px solid #ddd;border-radius:6px;">' +
      '<span style="color:#888;font-size:13px;">bis</span>' +
      '<input type="date" id="audx-to" style="padding:6px;border:1px solid #ddd;border-radius:6px;">' +
      '<button class="btn btn-primary" id="audx-filter">Filtern</button>' +
      '<button class="btn" id="audx-clear">Zur\u00fccksetzen</button>' +
      '<span style="flex:1;"></span>' +
      '<button class="btn" id="audx-purge" style="background:#B86250;color:#fff;border-color:#B86250;">Alle l\u00f6schen</button>';
    // Moeglichst weit oben in der View einsetzen (nach evtl. vorhandenem Header)
    var header = v.querySelector('.view-header');
    if (header && header.nextSibling) v.insertBefore(bar, header.nextSibling);
    else v.insertBefore(bar, v.firstChild);

    document.getElementById('audx-filter').onclick = function () {
      _from = (document.getElementById('audx-from') || {}).value || '';
      _to = (document.getElementById('audx-to') || {}).value || '';
      _reload();
    };
    document.getElementById('audx-clear').onclick = function () {
      _from = ''; _to = '';
      var f = document.getElementById('audx-from'); if (f) f.value = '';
      var t = document.getElementById('audx-to'); if (t) t.value = '';
      _reload();
    };
    document.getElementById('audx-purge').onclick = _purge;
    return bar;
  }

  async function _purge() {
    var before = (document.getElementById('audx-to') || {}).value || '';
    var scope = before ? ('alle Eintraege bis ' + before) : 'das GESAMTE Audit-Log';
    if (!window.confirm('Wirklich ' + scope + ' unwiderruflich l\u00f6schen?\n\nDas Sicherheits-Protokoll ist danach nicht mehr l\u00fcckenlos.')) return;
    var typed = window.prompt('Zur Best\u00e4tigung "DELETE" eingeben:', '');
    if (typed !== 'DELETE') { _toast('Abgebrochen', 'info'); return; }
    try {
      var path = '/audit-log?confirm=DELETE' + (before ? ('&before=' + encodeURIComponent(before)) : '');
      var r = await _call('DELETE', path);
      _toast('\u2713 ' + ((r && r.deleted) || 0) + ' Eintr\u00e4ge gel\u00f6scht', 'success');
      _reload();
    } catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
  }

  // Liste neu laden: bevorzugt die App-eigene loadAudit (falls global), sonst eigener Render.
  function _reload() {
    if (typeof window._loadAudit === 'function' && (!_from && !_to)) {
      try { window._loadAudit(); return; } catch (e) {}
    }
    _renderOwn();
  }

  async function _renderOwn() {
    var v = _auditView(); if (!v) return;
    // Eigene Tabelle unter der Bar (falls App-Tabelle den Filter nicht kennt)
    var host = document.getElementById('audx-table-host');
    if (!host) {
      host = document.createElement('div'); host.id = 'audx-table-host'; host.style.marginTop = '10px';
      var bar = document.getElementById('audx-bar');
      if (bar && bar.nextSibling) v.insertBefore(host, bar.nextSibling); else v.appendChild(host);
    }
    host.innerHTML = '<div style="padding:16px;color:#888;">L\u00e4dt\u2026</div>';
    try {
      var qs = '/audit-log?limit=200' + (_from ? ('&from=' + _from) : '') + (_to ? ('&to=' + _to) : '');
      var r = await _call('GET', qs);
      var rows = (r && r.entries) || [];
      if (!rows.length) { host.innerHTML = '<div style="padding:16px;color:#999;">Keine Eintr\u00e4ge im Zeitraum.</div>'; return; }
      host.innerHTML =
        '<table class="data-table"><thead><tr><th>Zeit</th><th>Admin</th><th>Aktion</th><th>Ziel</th><th>IP</th></tr></thead><tbody>' +
        rows.map(function (a) {
          return '<tr><td style="white-space:nowrap;">' + _fmt(a.created_at) + '</td>' +
            '<td>' + _esc(a.admin_email || '\u2013') + '</td>' +
            '<td><code>' + _esc(a.action || '') + '</code></td>' +
            '<td>' + _esc(a.target_user_email || a.target_id || '\u2013') + '</td>' +
            '<td style="font-size:.85em;color:#888;">' + _esc(a.ip || '\u2013') + '</td></tr>';
        }).join('') + '</tbody></table>';
    } catch (e) {
      host.innerHTML = '<div style="padding:16px;color:#B86250;">Fehler: ' + _esc(e.message || '') + '</div>';
    }
  }

  function _hook() {
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        if ((link.getAttribute('data-view') || '') === 'audit' || /audit/i.test(link.textContent || '')) {
          link.addEventListener('click', function () { setTimeout(function () { _ensureBar(); }, 60); });
        }
      })(links[i]);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_hook, 400); });
  else setTimeout(_hook, 400);
  setTimeout(_hook, 1500);
  setTimeout(_hook, 3000);
})();
