/* admin-apikeys.js — DealPilot Admin: API-Keys + Pro-Testzeitraum (mand v807, v811)
 * v856: EIGENER REITER ENTFERNT. Die Funktionen haengen sich jetzt als
 * Action-Sektion "API & Pro-Test" in die NUTZER-DETAILANSICHT (#user-detail-content,
 * Bereich .user-actions) — MutationObserver erkennt jeden Detail-Render.
 * Backend-Routen unveraendert: /users/:id/api-keys, /api-keys/:id/extend|DELETE,
 * /users/:id/start-pro-trial. Nutzt das globale API (admin-api.js). */
(function () {
  'use strict';

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
    if (!(typeof API !== 'undefined' && API && API.call)) return Promise.reject(new Error('API fehlt'));
    return API.call(method, path, body);
  }

  /* User-ID + E-Mail aus der gerenderten Detailansicht lesen */
  function _extractUser(content) {
    var uid = null, email = '';
    try {
      var rows = content.querySelectorAll('.user-info-row');
      for (var i = 0; i < rows.length; i++) {
        var lbl = rows[i].querySelector('.user-info-label');
        var val = rows[i].querySelector('.user-info-value');
        if (!lbl || !val) continue;
        var l = (lbl.textContent || '').trim();
        if (l === 'User-ID') uid = (val.textContent || '').trim();
        if (l === 'E-Mail') email = (val.textContent || '').replace(/\ud83e\uddea/g, '').trim();
      }
    } catch (e) {}
    return { id: uid, email: email };
  }

  function _mount() {
    var content = document.getElementById('user-detail-content');
    if (!content) return;
    var actions = content.querySelector('.user-actions');
    if (!actions || content.querySelector('#apk-section')) return;
    var u = _extractUser(content);
    if (!u.id) return;

    var sec = document.createElement('div');
    sec.className = 'action-section';
    sec.id = 'apk-section';
    sec.innerHTML =
      '<h4>API &amp; Pro-Test</h4>' +
      '<div class="action-row" style="align-items:center">' +
        '<input type="number" id="apk-days" min="1" max="90" value="14" style="width:80px" title="Tage">' +
        '<button class="btn btn-sm" id="apk-trial">Pro-Test starten</button>' +
      '</div>' +
      '<div id="apk-keys" style="margin-top:10px;font-size:12.5px;color:#64748b">Lade API-Keys \u2026</div>' +
      '<div class="action-row" style="margin-top:8px"><button class="btn btn-sm btn-ghost" id="apk-new">Neuen API-Key erzeugen</button></div>' +
      '<div id="apk-newkey"></div>';
    actions.appendChild(sec);

    sec.querySelector('#apk-trial').addEventListener('click', function () { _startProTrial(u.id, u.email); });
    sec.querySelector('#apk-new').addEventListener('click', function () { _createKey(u.id); });
    _loadKeys(u.id);
  }

  async function _loadKeys(id) {
    var box = document.getElementById('apk-keys');
    if (!box) return;
    try {
      var r = await _call('GET', '/users/' + encodeURIComponent(id) + '/api-keys');
      var keys = (r && r.keys) || [];
      if (!keys.length) { box.innerHTML = '<span style="color:#64748b">Noch keine API-Keys.</span>'; return; }
      var html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;color:#64748b">' +
        '<th style="padding:4px">Key</th><th>Erstellt</th><th>Zuletzt</th><th>Ablauf</th><th></th></tr></thead><tbody>';
      keys.forEach(function (k) {
        var rev = !!k.revoked_at;
        html += '<tr style="border-top:1px solid #e2e8f0' + (rev ? ';opacity:.5' : '') + '">' +
          '<td style="padding:5px 4px"><code>' + _esc(k.key_prefix) + '\u2026</code>' + (rev ? ' <span style="color:#b91c1c">(widerrufen)</span>' : '') + '</td>' +
          '<td>' + _fmt(k.created_at) + '</td><td>' + _fmt(k.last_used_at) + '</td><td>' + (k.expires_at ? _fmt(k.expires_at) : 'unbegrenzt') + '</td>' +
          '<td style="text-align:right;white-space:nowrap">' +
            (rev ? '' :
              '<button class="btn btn-sm btn-ghost" data-ext="' + _esc(k.id) + '">+90 T</button> ' +
              '<button class="btn btn-sm btn-ghost" data-rev="' + _esc(k.id) + '">Widerrufen</button>') +
          '</td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
      box.querySelectorAll('button[data-ext]').forEach(function (b) { b.addEventListener('click', function () { _extend(b.getAttribute('data-ext'), id); }); });
      box.querySelectorAll('button[data-rev]').forEach(function (b) { b.addEventListener('click', function () { _revoke(b.getAttribute('data-rev'), id); }); });
    } catch (e) { box.innerHTML = '<span style="color:#b91c1c">Fehler: ' + _esc(e && e.message || e) + '</span>'; }
  }

  async function _createKey(id) {
    try {
      var r = await _call('POST', '/users/' + encodeURIComponent(id) + '/api-keys', { name: 'Admin-Key' });
      var plain = r && r.key && r.key.plain;
      await _loadKeys(id);
      if (plain) {
        var nk = document.getElementById('apk-newkey');
        if (nk) nk.innerHTML = '<div style="margin-top:10px;padding:10px 12px;border:1px solid #c9a042;border-radius:10px;background:#fffbeb;font-size:12px">' +
          '<b>Neuer Key \u2014 nur jetzt sichtbar:</b><br><code style="display:block;word-break:break-all;margin-top:5px">' + _esc(plain) + '</code></div>';
      }
      _toast('Key erstellt');
    } catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }
  async function _extend(keyId, uid) {
    try { await _call('POST', '/api-keys/' + encodeURIComponent(keyId) + '/extend', { days: 90 }); _toast('Um 90 Tage verl\u00e4ngert'); _loadKeys(uid); }
    catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }
  async function _revoke(keyId, uid) {
    if (!window.confirm('Diesen Key widerrufen?')) return;
    try { await _call('DELETE', '/api-keys/' + encodeURIComponent(keyId)); _toast('Widerrufen'); _loadKeys(uid); }
    catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }
  async function _startProTrial(id, email) {
    var el = document.getElementById('apk-days');
    var days = el ? parseInt(el.value, 10) : 14;
    if (!days || days < 1 || days > 90) { _toast('Bitte 1\u201390 Tage angeben'); return; }
    if (!window.confirm('Pro-Testzeitraum \u00fcber ' + days + ' Tage f\u00fcr ' + (email || 'diesen Nutzer') + ' aktivieren?')) return;
    try {
      await _call('POST', '/users/' + encodeURIComponent(id) + '/start-pro-trial', { days: days });
      _toast('Pro-Test \u00fcber ' + days + ' Tage aktiviert');
    } catch (e) { _toast('\u26a0 ' + (e && e.message || e)); }
  }

  function _boot() {
    var content = document.getElementById('user-detail-content');
    if (!content) { setTimeout(_boot, 700); return; }
    try {
      var mo = new MutationObserver(function () { try { _mount(); } catch (e) {} });
      mo.observe(content, { childList: true });
      _mount();
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_boot, 450); });
  else setTimeout(_boot, 450);

  /* Alt-Einstieg bleibt funktional: springt zur Nutzer-Ansicht */
  window._dpApiKeysOpen = function () {
    try { var l = document.querySelector('.nav-link[data-view="users"]'); if (l) l.click(); } catch (e) {}
  };
})();
