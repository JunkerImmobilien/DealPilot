// DealPilot Admin v799 — Kundenbindung (Retention)
// Eigenstaendiges additives Modul. Rendert den Kundenbindung-Tab komplett selbst:
//   - Auto-Versand-Schalter + Schwellen (Auslauf-Tage / Inaktiv-Tage)
//   - Mail-Editor (Subject + Body) mit "Standard wiederherstellen"
//   - "Jetzt senden" (force) + "Vorschau" (dry-run)
//   - Auslauf-Liste (Kunden + Tage bis Ablauf)
//   - Inaktiv-Liste (Kunden + Tage ohne Login)
'use strict';
(function () {
  var BASE = '/api/v1/admin';
  function _token() { return localStorage.getItem('dp_admin_token') || ''; }
  async function _call(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var t = _token(); if (t) headers['X-Admin-Token'] = t;
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var r = await fetch(BASE + path, opts);
    var data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
    return data;
  }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _toast(msg, type) {
    try { var c = document.getElementById('toast-container'); if (c) { var d = document.createElement('div'); d.className = 'toast toast-' + (type || 'info'); d.textContent = msg; c.appendChild(d); setTimeout(function () { d.remove(); }, 4000); return; } } catch (e) {}
    alert(msg);
  }

  // ── Container finden/erzeugen ───────────────────────────────────
  // Sucht die Kundenbindung-View. Bevorzugt #view-retention; sonst per Nav-Link-Text.
  function _findHost() {
    var v = document.getElementById('view-retention');
    if (v) return v;
    // Fallback: Nav-Link "Kundenbindung" -> data-view
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      if (/kundenbindung/i.test(links[i].textContent || '')) {
        var view = links[i].getAttribute('data-view');
        if (view) { var el = document.getElementById('view-' + view); if (el) return el; }
      }
    }
    return null;
  }

  var _settings = null;
  var _DEFAULTS = null; // {expiry:{subject,body}, inactive:{subject,body}}

  function _render(host) {
    if (!host) return;
    var s = _settings || {};
    host.innerHTML =
      '<div class="view-header"><h2>Kundenbindung</h2></div>' +
      // ── Einstellungen ──
      '<div class="card" style="margin-bottom:18px;padding:18px;">' +
        '<h3 style="margin:0 0 14px;">Automatischer Versand</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">' +
          // Auslauf
          '<div style="border:1px solid #eee;border-radius:10px;padding:14px;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-weight:600;">' +
              '<input type="checkbox" id="ret-expiry-enabled"' + (s.expiry_enabled ? ' checked' : '') + '> Auslauf-Erinnerung automatisch senden</label>' +
            '<div style="margin-top:10px;font-size:13px;color:#666;">Senden, wenn Abo in <input type="number" id="ret-expiry-days" value="' + (s.expiry_days_before != null ? s.expiry_days_before : 14) + '" min="1" max="365" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px;"> Tagen ausl\u00e4uft</div>' +
          '</div>' +
          // Inaktiv
          '<div style="border:1px solid #eee;border-radius:10px;padding:14px;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-weight:600;">' +
              '<input type="checkbox" id="ret-inactive-enabled"' + (s.inactive_enabled ? ' checked' : '') + '> Inaktivit\u00e4ts-Mail automatisch senden</label>' +
            '<div style="margin-top:10px;font-size:13px;color:#666;">Senden, wenn Kunde seit <input type="number" id="ret-inactive-days" value="' + (s.inactive_days != null ? s.inactive_days : 30) + '" min="1" max="3650" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px;"> Tagen nicht eingeloggt war</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-primary" id="ret-save">Einstellungen speichern</button>' +
          '<button class="btn" id="ret-preview">Vorschau (z\u00e4hlt nur)</button>' +
          '<button class="btn" id="ret-run" style="background:#3FA56C;color:#fff;border-color:#3FA56C;">Jetzt senden</button>' +
          '<span id="ret-run-msg" style="align-self:center;font-size:13px;color:#666;"></span>' +
        '</div>' +
      '</div>' +
      // ── Mail-Editoren ──
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">' +
        _editorBlock('expiry', 'Auslauf-Erinnerung', s.expiry_subject, s.expiry_body) +
        _editorBlock('inactive', 'Inaktivit\u00e4ts-Mail', s.inactive_subject, s.inactive_body) +
      '</div>' +
      '<div style="font-size:12px;color:#888;margin-bottom:18px;">Platzhalter: <code>{{name}}</code> \u00b7 <code>{{days}}</code> (Tage) \u00b7 <code>{{date}}</code> (Ablaufdatum, nur Auslauf)</div>' +
      // ── Listen ──
      '<div class="card" style="margin-bottom:18px;padding:18px;">' +
        '<h3 style="margin:0 0 4px;">L\u00e4uft demn\u00e4chst aus</h3>' +
        '<div style="font-size:13px;color:#888;margin-bottom:10px;">Kunden mit aktivem Abo, das im eingestellten Fenster ausl\u00e4uft.</div>' +
        '<table class="data-table"><thead><tr><th>E-Mail</th><th>Name</th><th>Plan</th><th>Ablauf</th><th style="text-align:right;">Tage</th></tr></thead><tbody id="ret-expiring-tbody"><tr><td colspan="5">L\u00e4dt\u2026</td></tr></tbody></table>' +
      '</div>' +
      '<div class="card" style="padding:18px;">' +
        '<h3 style="margin:0 0 4px;">L\u00e4nger inaktiv</h3>' +
        '<div style="font-size:13px;color:#888;margin-bottom:10px;">Aktive Kunden ohne Login im eingestellten Fenster.</div>' +
        '<table class="data-table"><thead><tr><th>E-Mail</th><th>Name</th><th>Letzter Login</th><th style="text-align:right;">Tage inaktiv</th></tr></thead><tbody id="ret-inactive-tbody"><tr><td colspan="4">L\u00e4dt\u2026</td></tr></tbody></table>' +
      '</div>';

    _wire(host);
    _loadLists();
  }

  function _editorBlock(kind, title, subject, body) {
    return '<div class="card" style="padding:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<h3 style="margin:0;">' + _esc(title) + '</h3>' +
        '<button class="btn" data-ret-reset="' + kind + '" style="font-size:12px;">Standard wiederherstellen</button>' +
      '</div>' +
      '<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Betreff</label>' +
      '<input type="text" id="ret-' + kind + '-subject" value="' + _esc(subject) + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;margin-bottom:10px;">' +
      '<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Text</label>' +
      '<textarea id="ret-' + kind + '-body" rows="10" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-family:inherit;font-size:13px;">' + _esc(body) + '</textarea>' +
    '</div>';
  }

  function _collect() {
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function chk(id) { var e = document.getElementById(id); return !!(e && e.checked); }
    return {
      expiry_enabled: chk('ret-expiry-enabled'),
      expiry_days_before: parseInt(val('ret-expiry-days'), 10) || 14,
      expiry_subject: val('ret-expiry-subject'),
      expiry_body: val('ret-expiry-body'),
      inactive_enabled: chk('ret-inactive-enabled'),
      inactive_days: parseInt(val('ret-inactive-days'), 10) || 30,
      inactive_subject: val('ret-inactive-subject'),
      inactive_body: val('ret-inactive-body')
    };
  }

  function _wire(host) {
    var saveBtn = document.getElementById('ret-save');
    if (saveBtn) saveBtn.onclick = async function () {
      saveBtn.disabled = true;
      try { var r = await _call('POST', '/retention/settings', _collect()); _settings = r.settings; _toast('\u2713 Gespeichert', 'success'); _loadLists(); }
      catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
      saveBtn.disabled = false;
    };
    var prevBtn = document.getElementById('ret-preview');
    if (prevBtn) prevBtn.onclick = async function () { await _run(true); };
    var runBtn = document.getElementById('ret-run');
    if (runBtn) runBtn.onclick = async function () {
      if (!window.confirm('Jetzt wirklich an alle passenden Kunden senden? (Bereits benachrichtigte werden \u00fcbersprungen)')) return;
      await _run(false);
    };
    // Schwellen aendern -> Listen neu laden
    ['ret-expiry-days', 'ret-inactive-days'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.onchange = _loadLists;
    });
    // Standard wiederherstellen
    host.querySelectorAll('[data-ret-reset]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-ret-reset');
        var def = _DEFAULTS && _DEFAULTS[k];
        if (!def) return;
        var sub = document.getElementById('ret-' + k + '-subject');
        var bod = document.getElementById('ret-' + k + '-body');
        if (sub) sub.value = def.subject; if (bod) bod.value = def.body;
        _toast('Standard-Vorlage eingesetzt (noch nicht gespeichert)', 'info');
      };
    });
  }

  async function _run(dry) {
    var msg = document.getElementById('ret-run-msg');
    if (msg) { msg.style.color = '#666'; msg.textContent = dry ? 'Vorschau l\u00e4uft\u2026' : 'Senden\u2026'; }
    try {
      // Erst speichern, damit der Lauf die aktuellen Templates/Schwellen nutzt
      var sv = await _call('POST', '/retention/settings', _collect()); _settings = sv.settings;
      var r = await _call('POST', '/retention/run?dry=' + (dry ? '1' : '0'));
      var res = r.result || {};
      var txt = (dry ? 'Vorschau: ' : 'Gesendet: ') +
        'Auslauf ' + (res.expiry ? res.expiry.sent : 0) + '/' + (res.expiry ? res.expiry.candidates : 0) +
        ' \u00b7 Inaktiv ' + (res.inactive ? res.inactive.sent : 0) + '/' + (res.inactive ? res.inactive.candidates : 0);
      if (msg) { msg.style.color = '#3FA56C'; msg.textContent = '\u2713 ' + txt; }
      if (!dry) _loadLists();
    } catch (e) {
      if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Fehler: ' + (e.message || ''); }
    }
  }

  async function _loadLists() {
    var ed = parseInt((document.getElementById('ret-expiry-days') || {}).value, 10);
    var idd = parseInt((document.getElementById('ret-inactive-days') || {}).value, 10);
    // Auslauf
    var et = document.getElementById('ret-expiring-tbody');
    if (et) {
      et.innerHTML = '<tr><td colspan="5">L\u00e4dt\u2026</td></tr>';
      try {
        var r1 = await _call('GET', '/retention/expiring' + (ed ? ('?days=' + ed) : ''));
        var rows1 = (r1 && r1.rows) || [];
        et.innerHTML = rows1.length ? rows1.map(function (u) {
          var dl = u.days_left;
          var col = dl <= 3 ? '#B86250' : (dl <= 7 ? '#C9A84C' : '#3FA56C');
          var dt = u.current_period_end ? new Date(u.current_period_end).toLocaleDateString('de-DE') : '\u2013';
          return '<tr><td>' + _esc(u.email) + '</td><td>' + _esc(u.name || '\u2013') + '</td><td>' + _esc(u.plan_id || '\u2013') + '</td><td>' + dt + '</td>' +
            '<td style="text-align:right;font-weight:700;color:' + col + ';">' + dl + '</td></tr>';
        }).join('') : '<tr><td colspan="5" style="color:#999;">Niemand l\u00e4uft im Fenster aus.</td></tr>';
      } catch (e) { et.innerHTML = '<tr><td colspan="5" style="color:#B86250;">' + _esc(e.message || 'Fehler') + '</td></tr>'; }
    }
    // Inaktiv
    var it = document.getElementById('ret-inactive-tbody');
    if (it) {
      it.innerHTML = '<tr><td colspan="4">L\u00e4dt\u2026</td></tr>';
      try {
        var r2 = await _call('GET', '/retention/inactive' + (idd ? ('?days=' + idd) : ''));
        var rows2 = (r2 && r2.rows) || [];
        it.innerHTML = rows2.length ? rows2.map(function (u) {
          var dt = u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('de-DE') : '\u2013';
          return '<tr><td>' + _esc(u.email) + '</td><td>' + _esc(u.name || '\u2013') + '</td><td>' + dt + '</td>' +
            '<td style="text-align:right;font-weight:700;color:#B86250;">' + u.days_inactive + '</td></tr>';
        }).join('') : '<tr><td colspan="4" style="color:#999;">Keine inaktiven Kunden im Fenster.</td></tr>';
      } catch (e) { it.innerHTML = '<tr><td colspan="4" style="color:#B86250;">' + _esc(e.message || 'Fehler') + '</td></tr>'; }
    }
  }

  async function _open() {
    var host = _findHost();
    if (!host) { return; }
    if (!_settings) {
      host.innerHTML = '<div style="padding:30px;color:#888;">L\u00e4dt Kundenbindung\u2026</div>';
      try {
        var r = await _call('GET', '/retention/settings');
        _settings = r.settings;
        // Defaults merken (fuer "Standard wiederherstellen") = aktuelle Server-Defaults,
        // die getSettings() bei leeren Feldern liefert. Wir holen sie separat einmal.
        _DEFAULTS = {
          expiry: { subject: _settings.expiry_subject, body: _settings.expiry_body },
          inactive: { subject: _settings.inactive_subject, body: _settings.inactive_body }
        };
      } catch (e) { host.innerHTML = '<div style="padding:30px;color:#B86250;">Fehler: ' + _esc(e.message || '') + '</div>'; return; }
    }
    _render(host);
  }

  // ── Einhaengen: Klick auf Kundenbindung-Nav-Link ────────────────
  function _hook() {
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        if (/kundenbindung/i.test(link.textContent || '')) {
          link.addEventListener('click', function () { setTimeout(_open, 30); });
        }
      })(links[i]);
    }
    // Falls die View beim Laden schon aktiv ist
    var host = _findHost();
    if (host && host.style.display !== 'none' && host.offsetParent !== null) {
      // nur wenn sichtbar
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_hook, 400); });
  } else {
    setTimeout(_hook, 400);
  }
  // Re-Hook nach App-Mount (Nav-Links entstehen evtl. erst nach Login)
  setTimeout(_hook, 1500);
  setTimeout(_hook, 3000);

  window._dpRetentionOpen = _open; // manueller Aufruf moeglich
})();
