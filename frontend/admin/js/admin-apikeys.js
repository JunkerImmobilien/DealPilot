/* admin-apikeys.js — DealPilot Admin: API-Key-Verwaltung (mand v807)
 * Eigenstaendig: erzeugt selbst Nav-Link "API & Pro-Test" + #view-apikeys (Muster wie admin-stats.js).
 * v811: zusaetzlich Pro-Testzeitraum pro Nutzer (start-pro-trial).
 * Nutzersuche (zeigt Plan) -> pro Nutzer Keys anlegen / verlaengern / widerrufen.
 * Nutzt das globale API (admin-api.js): API.call('METHOD','/path', body) + API.listUsers(). */
(function () {
  'use strict';
  var _curUser = null;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function _fmt(ts) { if (!ts) return '\u2014'; try { return new Date(ts).toLocaleDateString('de-DE'); } catch (e) { return '\u2014'; } }
  function _toast(m) {
    if (typeof window.toast === 'function') return window.toast(m);
    try { var c = document.getElementById('toast-container'); if (c) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = m; c.appendChild(d); setTimeout(function () { d.remove(); }, 3500); return; } } catch (e) {}
    console.log('[apikeys]', m);
  }
  function _call(method, path, body) {
    if (!(typeof API !== 'undefined' && API && API.call)) return Promise.reject(new Error('API fehlt'));  /* v816-apicheck: API ist freie globale const, nicht window.API */
    return API.call(method, path, body);
  }

  function _hook() {
    try {
      var first = document.querySelector('.nav-link');
      if (!first || document.querySelector('.nav-link[data-view="apikeys"]')) return;
      var nav = first.parentNode;
      var link = first.cloneNode(true);
      link.setAttribute('data-view', 'apikeys');
      if (link.dataset) link.dataset.view = 'apikeys';
      link.classList.remove('active');
      // Text setzen (letzten Textknoten ersetzen, Icon ggf. behalten)
      var label = link.querySelector('span:last-child') || link;
      if (label === link) link.textContent = 'API & Pro-Test'; else label.textContent = 'API & Pro-Test';
      link.addEventListener('click', function (e) { e.preventDefault(); _activate(); });
      nav.appendChild(link);

      // View-Container anlegen (neben bestehenden #view-*)
      var anyView = document.querySelector('[id^="view-"]');
      if (anyView) {
        var v = document.createElement('div');
        v.id = 'view-apikeys';
        v.className = anyView.className;
        v.style.display = 'none';
        anyView.parentNode.appendChild(v);
      }
      // Andere Nav-Klicks blenden unsere View aus
      var links = document.querySelectorAll('.nav-link');
      for (var i = 0; i < links.length; i++) {
        if (links[i] === link) continue;
        links[i].addEventListener('click', function () {
          var vv = document.getElementById('view-apikeys');
          if (vv) vv.style.display = 'none';
          link.classList.remove('active');
        });
      }
    } catch (e) { console.warn('[apikeys] hook', e); }
  }

  function _activate() {
    var v = document.getElementById('view-apikeys');
    if (!v) return;
    var all = document.querySelectorAll('[id^="view-"]');
    for (var i = 0; i < all.length; i++) all[i].style.display = (all[i].id === 'view-apikeys') ? 'block' : 'none';
    var links = document.querySelectorAll('.nav-link');
    for (var j = 0; j < links.length; j++) links[j].classList.remove('active');
    var me = document.querySelector('.nav-link[data-view="apikeys"]');
    if (me) me.classList.add('active');
    _renderSearch(v);
  }

  function _renderSearch(v) {
    v.innerHTML =
      '<h1 style="margin:0 0 4px">API &amp; Pro-Test</h1>' +
      '<p style="color:#64748b;margin:0 0 18px">Nutzer suchen, Plan einsehen, API-Keys verwalten und Pro-Testzeitraum vergeben.</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px">' +
        '<input id="apk-q" type="text" placeholder="E-Mail oder Name\u2026" style="flex:1;max-width:360px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px">' +
        '<button id="apk-search" class="btn">Suchen</button>' +
      '</div>' +
      '<div id="apk-results"></div>' +
      '<div id="apk-detail" style="margin-top:20px"></div>';
    var go = function () { _search(); };
    document.getElementById('apk-search').addEventListener('click', go);
    document.getElementById('apk-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  async function _search() {
    var q = (document.getElementById('apk-q').value || '').trim();
    var box = document.getElementById('apk-results');
    box.innerHTML = '<div style="color:#64748b">Suche\u2026</div>';
    try {
      var r = await API.listUsers({ q: q, limit: 50, offset: 0 });
      var users = (r && (r.users || r.items)) || [];
      if (!users.length) { box.innerHTML = '<div style="color:#64748b">Keine Treffer.</div>'; return; }
      var html = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#64748b">' +
        '<th style="padding:6px">E-Mail</th><th>Name</th><th>Plan</th><th></th></tr></thead><tbody>';
      users.forEach(function (u) {
        var paid = u.plan_id && u.plan_id !== 'free';
        html += '<tr style="border-top:1px solid #e2e8f0">' +
          '<td style="padding:8px 6px">' + _esc(u.email) + '</td>' +
          '<td>' + _esc(u.name || '\u2014') + '</td>' +
          '<td><span class="pill ' + (paid ? 'pill-plan-paid' : 'pill-plan') + '">' + _esc(u.plan_name || u.plan_id || 'Free') + '</span></td>' +
          '<td style="text-align:right;white-space:nowrap">' +
            '<button class="btn btn-sm btn-ghost" data-trial="' + _esc(u.id) + '" data-uem="' + _esc(u.email) + '">Pro-Test</button> ' +
            '<button class="btn btn-sm" data-uid="' + _esc(u.id) + '" data-uem="' + _esc(u.email) + '">Keys verwalten</button>' +
          '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
      box.querySelectorAll('button[data-uid]').forEach(function (btn) {
        btn.addEventListener('click', function () { _openUser(btn.getAttribute('data-uid'), btn.getAttribute('data-uem')); });
      });
      box.querySelectorAll('button[data-trial]').forEach(function (btn) {
        btn.addEventListener('click', function () { _startProTrial(btn.getAttribute('data-trial'), btn.getAttribute('data-uem')); });
      });
    } catch (e) { box.innerHTML = '<div style="color:#b91c1c">Fehler: ' + _esc(e && e.message || e) + '</div>'; }
  }

  async function _openUser(id, email) {
    _curUser = { id: id, email: email };
    var d = document.getElementById('apk-detail');
    d.innerHTML = '<div style="color:#64748b">Lade Keys\u2026</div>';
    try {
      var r = await _call('GET', '/users/' + encodeURIComponent(id) + '/api-keys');
      var keys = (r && r.keys) || [];
      var html = '<h2 style="margin:0 0 10px">Keys von ' + _esc(email) + '</h2>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="text-align:left;color:#64748b">' +
        '<th style="padding:6px">Key</th><th>Erstellt</th><th>Zuletzt</th><th>Ablauf</th><th></th></tr></thead><tbody>';
      if (!keys.length) html += '<tr><td colspan="5" style="padding:8px;color:#64748b">Noch keine Keys.</td></tr>';
      keys.forEach(function (k) {
        var rev = !!k.revoked_at;
        html += '<tr style="border-top:1px solid #e2e8f0' + (rev ? ';opacity:.5' : '') + '">' +
          '<td style="padding:6px"><code>' + _esc(k.key_prefix) + '\u2026</code>' + (rev ? ' <span style="color:#b91c1c">(widerrufen)</span>' : '') + '</td>' +
          '<td>' + _fmt(k.created_at) + '</td><td>' + _fmt(k.last_used_at) + '</td><td>' + (k.expires_at ? _fmt(k.expires_at) : 'unbegrenzt') + '</td>' +
          '<td style="text-align:right">' +
            (rev ? '' :
              '<button class="btn btn-sm btn-ghost" data-ext="' + _esc(k.id) + '">+90 Tage</button> ' +
              '<button class="btn btn-sm btn-ghost" data-rev="' + _esc(k.id) + '">Widerrufen</button>') +
          '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div style="margin-top:12px"><button class="btn btn-sm" id="apk-new">Neuen Key erzeugen</button></div>';
      html += '<div id="apk-newkey"></div>';
      d.innerHTML = html;
      d.querySelector('#apk-new').addEventListener('click', function () { _createKey(id); });
      d.querySelectorAll('button[data-ext]').forEach(function (b) { b.addEventListener('click', function () { _extend(b.getAttribute('data-ext')); }); });
      d.querySelectorAll('button[data-rev]').forEach(function (b) { b.addEventListener('click', function () { _revoke(b.getAttribute('data-rev')); }); });
    } catch (e) { d.innerHTML = '<div style="color:#b91c1c">Fehler: ' + _esc(e && e.message || e) + '</div>'; }
  }

  async function _createKey(id) {
    try {
      var r = await _call('POST', '/users/' + encodeURIComponent(id) + '/api-keys', { name: 'Admin-Key' });
      var plain = r && r.key && r.key.plain;
      await _openUser(id, _curUser ? _curUser.email : '');
      if (plain) {
        var nk = document.getElementById('apk-newkey');
        if (nk) nk.innerHTML = '<div style="margin-top:12px;padding:12px 14px;border:1px solid #c9a042;border-radius:10px;background:#fffbeb">' +
          '<b>Neuer Key \u2014 nur jetzt sichtbar:</b><br><code style="display:block;word-break:break-all;margin-top:6px">' + _esc(plain) + '</code></div>';
      }
      _toast('Key erstellt');
    } catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }
  async function _extend(keyId) {
    try { await _call('POST', '/api-keys/' + encodeURIComponent(keyId) + '/extend', { days: 90 }); _toast('Um 90 Tage verl\u00e4ngert'); if (_curUser) _openUser(_curUser.id, _curUser.email); }
    catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }
  async function _revoke(keyId) {
    if (!window.confirm('Diesen Key widerrufen?')) return;
    try { await _call('DELETE', '/api-keys/' + encodeURIComponent(keyId)); _toast('Widerrufen'); if (_curUser) _openUser(_curUser.id, _curUser.email); }
    catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_hook, 450); });
  } else { setTimeout(_hook, 450); }
  async function _startProTrial(id, email) {
    var inp = window.prompt('Pro-Testzeitraum f\u00fcr ' + (email || 'diesen Nutzer') + ' \u2014 wie viele Tage? (1\u201390)', '14');
    if (inp === null) return;
    var days = parseInt(inp, 10);
    if (!days || days < 1 || days > 90) { _toast('Bitte 1\u201390 Tage angeben'); return; }
    try {
      await _call('POST', '/users/' + encodeURIComponent(id) + '/start-pro-trial', { days: days });
      _toast('Pro-Test \u00fcber ' + days + ' Tage aktiviert');
      _search();
    } catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }

  window._dpApiKeysOpen = _activate;
})();
