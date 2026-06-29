/* apikeys.js — DealPilot API-Key-Panel in den Einstellungen (mand v807 / v810)
 * Self-contained. v810: nutzt bevorzugt den von settings.js gesetzten #dp-apikey-host
 * (an der Stelle der entfernten Plan-Box), sonst Fallback nach .account-plan-box / Pane-Ende.
 * Pro: Auto-Bereitstellung via POST /api-keys/ensure + Verwaltung. Sonst: Pro-Hinweis. */
(function () {
  'use strict';
  var HOST_ID = 'dp-apikey-host';

  function _isPro() {
    try {
      var c = window.DealPilotConfig;
      return !!(c && c.pricing && c.pricing.currentKey && c.pricing.currentKey() === 'pro');
    } catch (e) { return false; }
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function _fmt(ts) {
    if (!ts) return '\u2014';
    try { return new Date(ts).toLocaleDateString('de-DE'); } catch (e) { return '\u2014'; }
  }
  function _api(path, opts) {
    if (!(window.Auth && window.Auth.apiCall)) return Promise.reject(new Error('Auth fehlt'));
    return window.Auth.apiCall('/api-keys' + path, opts || {});
  }

  function _mount() {
    try {
      var pane = document.querySelector('.st-pane[data-pane="account"]');
      if (!pane) return;
      var host = document.getElementById(HOST_ID);
      if (host) {
        if (host.getAttribute('data-dpk-rendered')) return; // schon gefuellt
      } else {
        // Fallback: selbst anlegen (falls settings.js nicht gepatcht ist)
        var box = pane.querySelector('.account-plan-box') || pane.querySelector('.plan-box');
        host = document.createElement('div');
        host.id = HOST_ID;
        host.style.marginTop = '18px';
        if (box) box.insertAdjacentElement('afterend', host);
        else pane.appendChild(host);
      }
      host.setAttribute('data-dpk-rendered', '1');
      _render(host);
    } catch (e) {}
  }

  async function _render(host) {
    if (!_isPro()) {
      host.innerHTML =
        '<div class="f"><label>API-Zugriff</label>' +
        '<div style="color:var(--muted);font-size:13px;line-height:1.5">Der DealPilot-API-Zugriff (volle Lese-/Schreib-/L\u00f6sch-Rechte auf deine Objekte) ist Teil des <b>Pro</b>-Plans.</div></div>';
      return;
    }
    host.innerHTML = '<div class="f"><label>DealPilot API</label><div id="dp-apikey-body" style="font-size:13px;color:var(--muted)">Lade \u2026</div></div>';
    try {
      var res = await _api('/ensure', { method: 'POST' });
      _renderBody(host, res);
    } catch (e) {
      var b = host.querySelector('#dp-apikey-body');
      if (b) b.textContent = 'Fehler: ' + (e && e.message || e);
    }
  }

  function _renderBody(host, res) {
    var b = host.querySelector('#dp-apikey-body');
    if (!b) return;
    var html = '';
    if (res && res.created && res.key && res.key.plain) {
      html += _newKeyBanner(res.key.plain);
    }
    var keys = (res && res.keys) || [];
    html += '<table style="width:100%;border-collapse:collapse;font-size:12.5px">' +
      '<thead><tr style="text-align:left;color:var(--muted)">' +
        '<th style="padding:4px 6px">Key</th><th>Erstellt</th><th>Zuletzt</th><th>Ablauf</th><th></th></tr></thead><tbody>';
    keys.forEach(function (k) {
      var rev = !!k.revoked_at;
      html += '<tr style="border-top:1px solid rgba(0,0,0,.08)' + (rev ? ';opacity:.45' : '') + '">' +
        '<td style="padding:6px"><code>' + _esc(k.key_prefix) + '\u2026</code>' + (rev ? ' <span style="color:var(--red)">(widerrufen)</span>' : '') + '</td>' +
        '<td>' + _fmt(k.created_at) + '</td>' +
        '<td>' + _fmt(k.last_used_at) + '</td>' +
        '<td>' + (k.expires_at ? _fmt(k.expires_at) : 'unbegrenzt') + '</td>' +
        '<td style="text-align:right">' + (rev ? '' : '<button type="button" class="btn btn-sm btn-ghost" onclick="DealPilotApiKeys.revoke(\'' + _esc(k.id) + '\')">Widerrufen</button>') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    html += '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<button type="button" class="btn btn-sm btn-outline" onclick="DealPilotApiKeys.create()">Neuen Key erzeugen</button>' +
      '<span style="font-size:11.5px;color:var(--muted)">Header <code>X-API-Key</code> \u00b7 Basis-URL <code>/api/v1</code> \u00b7 voller CRUD</span></div>';
    b.innerHTML = html;
  }

  function _newKeyBanner(plain) {
    return '<div style="padding:12px 14px;border:1px solid var(--gold,#C9A84C);border-radius:10px;background:#FAF9F4;margin-bottom:12px">' +
      '<div style="font-weight:700;margin-bottom:6px">Dein API-Key \u2014 nur jetzt sichtbar, danach nur noch der Anfang:</div>' +
      '<code style="display:block;word-break:break-all;font-size:12px;background:#050505;color:#E8CC7A;padding:8px 10px;border-radius:6px">' + _esc(plain) + '</code>' +
      '<button type="button" class="btn btn-sm btn-ghost" style="margin-top:8px" onclick="DealPilotApiKeys.copy(this.getAttribute(\'data-k\'))" data-k="' + _esc(plain) + '">Kopieren</button>' +
      '</div>';
  }

  async function create() {
    try {
      var r = await _api('/', { method: 'POST', body: {} });
      var list = await _api('/', {});
      var host = document.getElementById(HOST_ID);
      if (host) _renderBody(host, { created: true, key: r.key, keys: list.keys });
    } catch (e) {
      if (window.toast) window.toast('\u26a0 ' + (e && e.message || e));
    }
  }
  async function revoke(id) {
    if (!window.confirm('Diesen API-Key widerrufen? Anwendungen, die ihn nutzen, verlieren sofort den Zugriff.')) return;
    try {
      await _api('/' + encodeURIComponent(id), { method: 'DELETE' });
      var list = await _api('/', {});
      var host = document.getElementById(HOST_ID);
      if (host) _renderBody(host, { keys: list.keys });
    } catch (e) {
      if (window.toast) window.toast('\u26a0 ' + (e && e.message || e));
    }
  }
  function copy(text) {
    try {
      navigator.clipboard.writeText(text);
      if (window.toast) window.toast('\u2713 Key kopiert');
    } catch (e) {}
  }

  /* Hook: nach showSettings einmal einhaengen */
  function _wireShowSettings() {
    if (window._dpApiKeyWrapped || typeof window.showSettings !== 'function') return;
    window._dpApiKeyWrapped = true;
    var orig = window.showSettings;
    window.showSettings = function () {
      var r = orig.apply(this, arguments);
      setTimeout(_mount, 120);
      return r;
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_wireShowSettings, 300); });
  } else {
    setTimeout(_wireShowSettings, 300);
  }

  window.DealPilotApiKeys = { create: create, revoke: revoke, copy: copy, _mount: _mount };
})();
