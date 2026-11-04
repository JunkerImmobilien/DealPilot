/* apikeys.js — DealPilot API-Key-Panel in den Einstellungen (mand v807 / v810)
 * Self-contained. v810: nutzt bevorzugt den von settings.js gesetzten #dp-apikey-host
 * (an der Stelle der entfernten Plan-Box), sonst Fallback nach .account-plan-box / Pane-Ende.
 * Pro: Auto-Bereitstellung via POST /api-keys/ensure + Verwaltung. Sonst: Pro-Hinweis. */
(function () {
  'use strict';
  var HOST_ID = 'dp-apikey-host';

  function _isPro() {
    try {
      /* v1081-planfamilie: war === 'pro'. Der Partner hat api_access in der DB,
         wurde hier aber trotzdem ausgesperrt. */
      var p = window.DealPilotConfig && window.DealPilotConfig.pricing;
      if (p && typeof p.isProOrAbove === 'function') return p.isProOrAbove();
      if (p && p.currentKey) { var k = p.currentKey(); return (k === 'pro' || k === 'partner'); }
      return false;
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

  /* v3167 · Marcel 04.11.2026: Keys benennen (wofür), kopieren, widerrufen und widerrufene entfernen.
     Ein bestehender Key lässt sich NICHT erneut anzeigen - gespeichert ist nur sein Fingerabdruck (sha256). */
  var _scharf = null;   /* { art, id, bis } - zwei Klicks statt Bestätigungsfenster */
  function _renderBody(host, res) {
    var b = host.querySelector('#dp-apikey-body');
    if (!b) return;
    var html = '';
    if (res && res.created && res.key && res.key.plain) html += _newKeyBanner(res.key.plain, res.key.name);
    var keys = (res && res.keys) || [];
    var aktiv = keys.filter(function (k) { return !k.revoked_at; }), weg = keys.filter(function (k) { return !!k.revoked_at; });
    var zeile = function (k) {
      var rev = !!k.revoked_at, s = _scharf && _scharf.id === k.id && _scharf.bis > Date.now() ? _scharf.art : null;
      return '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:8px 0;border-top:1px solid rgba(0,0,0,.08)' + (rev ? ';opacity:.55' : '') + '">'
        + '<div style="flex:1 1 200px;min-width:0"><b>' + _esc(k.name || 'DealPilot API') + '</b>' + (rev ? ' <span style="color:var(--red)">(widerrufen)</span>' : '')
        + '<div><code>' + _esc(k.key_prefix) + '…</code></div></div>'
        + '<div style="font-size:11.5px;color:var(--muted);flex:1 1 220px">erstellt ' + _fmt(k.created_at) + ' · zuletzt genutzt ' + _fmt(k.last_used_at) + ' · ' + (k.expires_at ? 'läuft ab ' + _fmt(k.expires_at) : 'unbegrenzt') + '</div>'
        + '<div>' + (rev
          ? '<button type="button" class="btn btn-sm btn-ghost" onclick="DealPilotApiKeys.entfernen(\'' + _esc(k.id) + '\')">' + (s === 'entfernen' ? 'Wirklich entfernen?' : 'Entfernen') + '</button>'
          : '<button type="button" class="btn btn-sm btn-ghost" onclick="DealPilotApiKeys.revoke(\'' + _esc(k.id) + '\')">' + (s === 'widerrufen' ? 'Wirklich widerrufen? Zugriff endet sofort' : 'Widerrufen') + '</button>') + '</div></div>';
    };
    html += aktiv.length ? aktiv.map(zeile).join('') : '<div style="padding:8px 0">Kein aktiver Key.</div>';
    if (weg.length) html += '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:12px;color:var(--muted)">Widerrufene Keys (' + weg.length + ')</summary>' + weg.map(zeile).join('') + '</details>';
    html += '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<input id="dp-apikey-name" type="text" maxlength="80" placeholder="Wofür? z. B. Makler-Hub" style="flex:1 1 200px;min-width:0">'
      + '<button type="button" class="btn btn-sm btn-outline" onclick="DealPilotApiKeys.create()">Neuen Key erzeugen</button></div>'
      + '<div style="margin-top:8px;font-size:11.5px;color:var(--muted);line-height:1.5">Ein Key wird nur beim Erzeugen einmal vollständig angezeigt – danach speichert DealPilot nur noch seinen Fingerabdruck, auch wir können ihn nicht mehr auslesen. '
      + 'Verloren? Neuen erzeugen und den alten widerrufen. Höchstens 5 aktive Keys.</div>'
      + '<div style="margin-top:6px;font-size:11.5px;color:var(--muted)">Header <code>X-API-Key</code> · Basis-URL <code>/api/v1</code> · voller CRUD · '
      /* v2977 · Rechenkerne (RND, Verkehrswert) als Zusatz - Doku fuer die Anbindung */
      + '<a href="/api-doku.html" target="_blank" rel="noopener">Dokumentation</a></div>';
    b.innerHTML = html;
  }

  function _newKeyBanner(plain, name) {
    return '<div style="padding:12px 14px;border:1px solid var(--gold,#C9A84C);border-radius:10px;background:#FAF9F4;margin-bottom:12px">' +
      '<div style="font-weight:700;margin-bottom:6px">' + (name ? 'Neuer Key „' + _esc(name) + '“' : 'Dein API-Key') + ' – nur jetzt sichtbar, bitte gleich kopieren:</div>' +
      '<code style="display:block;word-break:break-all;font-size:12px;background:#050505;color:var(--wl-e8cc7a, #E8CC7A);padding:8px 10px;border-radius:6px">' + _esc(plain) + '</code>' +
      '<button type="button" class="btn btn-sm btn-gold" style="margin-top:8px" onclick="DealPilotApiKeys.copy(this.getAttribute(\'data-k\'))" data-k="' + _esc(plain) + '">Kopieren</button>' +
      '</div>';
  }

  async function _neuLaden(extra) {
    var list = await _api('/', {});
    var host = document.getElementById(HOST_ID);
    if (host) _renderBody(host, Object.assign({ keys: list.keys }, extra || {}));
  }
  async function create() {
    try {
      var nEl = document.getElementById('dp-apikey-name'), name = nEl && nEl.value.trim();
      var r = await _api('/', { method: 'POST', body: { name: name || 'DealPilot API' } });
      await _neuLaden({ created: true, key: r.key });
    } catch (e) {
      if (window.toast) window.toast('⚠ ' + (e && e.message || e));
    }
  }
  async function _zweiKlicks(art, id, pfad) {
    if (!(_scharf && _scharf.art === art && _scharf.id === id && _scharf.bis > Date.now())) {
      _scharf = { art: art, id: id, bis: Date.now() + 8000 };
      await _neuLaden(); setTimeout(function () { if (_scharf && _scharf.id === id && _scharf.bis <= Date.now()) { _scharf = null; _neuLaden(); } }, 8100);
      return;
    }
    _scharf = null;
    try { await _api(pfad, { method: 'DELETE' }); await _neuLaden(); }
    catch (e) { if (window.toast) window.toast('⚠ ' + (e && e.message || e)); }
  }
  function revoke(id) { return _zweiKlicks('widerrufen', id, '/' + encodeURIComponent(id)); }
  function entfernen(id) { return _zweiKlicks('entfernen', id, '/' + encodeURIComponent(id) + '?entfernen=1'); }
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

  window.DealPilotApiKeys = { create: create, revoke: revoke, entfernen: entfernen, copy: copy, _mount: _mount };
})();
