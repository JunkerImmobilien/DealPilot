// DealPilot Admin v802 — Kundenbindung (Retention) mit Rich-Editor, Vorschau, Vorlagen
// Auslauf/Inaktiv per Toggle (umswitchen). Nutzt window.DpRichEditor (generisch).
// Eigene Vorlagen-Bibliothek + Hintergrund-Upload (getrennt von Massenmail).
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

  function _findHost() {
    var v = document.getElementById('view-retention');
    if (v) return v;
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
  var _DEFAULTS = null;
  var _active = 'expiry';      // aktiver Tab
  var _editors = {};           // kind -> DpRichEditor-Instanz
  var _prevT = null;

  function _render(host) {
    if (!host) return;
    var s = _settings || {};
    host.innerHTML =
      '<div class="view-header"><h2>Kundenbindung</h2></div>' +

      // ── Auto-Versand-Einstellungen ──
      '<div class="card" style="margin-bottom:18px;padding:18px;">' +
        '<h3 style="margin:0 0 14px;">Automatischer Versand</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">' +
          '<div style="border:1px solid #eee;border-radius:10px;padding:14px;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-weight:600;">' +
              '<input type="checkbox" id="ret-expiry-enabled"' + (s.expiry_enabled ? ' checked' : '') + '> Auslauf-Erinnerung automatisch senden</label>' +
            '<div style="margin-top:10px;font-size:13px;color:#666;">Senden, wenn Abo in <input type="number" id="ret-expiry-days" value="' + (s.expiry_days_before != null ? s.expiry_days_before : 14) + '" min="1" max="365" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px;"> Tagen ausl\u00e4uft</div>' +
          '</div>' +
          '<div style="border:1px solid #eee;border-radius:10px;padding:14px;">' +
            '<label style="display:flex;align-items:center;gap:8px;font-weight:600;">' +
              '<input type="checkbox" id="ret-inactive-enabled"' + (s.inactive_enabled ? ' checked' : '') + '> Inaktivit\u00e4ts-Mail automatisch senden</label>' +
            '<div style="margin-top:10px;font-size:13px;color:#666;">Senden, wenn Kunde seit <input type="number" id="ret-inactive-days" value="' + (s.inactive_days != null ? s.inactive_days : 30) + '" min="1" max="3650" style="width:60px;padding:4px;border:1px solid #ddd;border-radius:6px;"> Tagen nicht eingeloggt war</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-primary" id="ret-save">Einstellungen speichern</button>' +
          '<button class="btn" id="ret-preview-run">Vorschau (z\u00e4hlt nur)</button>' +
          '<button class="btn" id="ret-run" style="background:#3FA56C;color:#fff;border-color:#3FA56C;">Jetzt senden</button>' +
          '<span id="ret-run-msg" style="align-self:center;font-size:13px;color:#666;"></span>' +
        '</div>' +
      '</div>' +

      // ── Editor mit Toggle ──
      '<div class="card" style="margin-bottom:18px;padding:18px;">' +
        '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">' +
          '<button class="btn ret-switch" data-ret-kind="expiry">Auslauf-Erinnerung</button>' +
          '<button class="btn ret-switch" data-ret-kind="inactive">Inaktivit\u00e4ts-Mail</button>' +
          '<span style="flex:1;"></span>' +
          '<select id="ret-tpl-select" style="height:32px;border:1px solid #ddd;border-radius:6px;padding:0 8px;max-width:200px;"><option value="">\u2014 Vorlage laden \u2014</option></select>' +
          '<button class="btn" id="ret-tpl-save" title="Aktuellen Editor als Vorlage speichern">Als Vorlage speichern</button>' +
          '<button class="btn" id="ret-tpl-del" title="Gew\u00e4hlte Vorlage l\u00f6schen" style="color:#B86250;">L\u00f6schen</button>' +
          '<button class="btn" id="ret-reset" title="Standard-Vorlage wiederherstellen">Standard</button>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">' +
          // Editor-Spalte
          '<div>' +
            '<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Betreff</label>' +
            '<input type="text" id="ret-subject" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;margin-bottom:10px;">' +
            '<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Text</label>' +
            '<div id="ret-editor-host"></div>' +
            '<textarea id="ret-body" style="display:none;"></textarea>' +
          '</div>' +
          // Vorschau-Spalte
          '<div>' +
            '<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Live-Vorschau</label>' +
            '<iframe id="ret-preview-frame" style="width:100%;height:420px;border:1px solid #e7e1d4;border-radius:8px;background:#fff;"></iframe>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#888;margin-top:10px;">Platzhalter: <code>{{name}}</code> \u00b7 <code>{{days}}</code> (Tage) \u00b7 <code>{{date}}</code> (Ablaufdatum, nur Auslauf)</div>' +

        // Hintergrund-Vorlage
        '<div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
          '<span style="font-size:13px;color:#666;">Hintergrund-Vorlage (HTML mit <code>{{BODY}}</code>):</span>' +
          '<span id="ret-bg-name" style="font-size:13px;color:#3FA56C;"></span>' +
          '<button class="btn" id="ret-bg-upload">Hochladen</button>' +
          '<button class="btn" id="ret-bg-clear" style="color:#B86250;">Entfernen</button>' +
          '<input type="file" id="ret-bg-file" accept=".html,.htm,.txt" style="display:none;">' +
        '</div>' +
      '</div>' +

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

    _mountEditor(host);
    _wire(host);
    _switchTo('expiry');
    _loadTemplates();
    _loadBackground();
    _loadLists();
  }

  // Body je Kind im Speicher halten (damit Umschalten nichts verliert)
  var _bodies = { expiry: '', inactive: '' };
  var _subjects = { expiry: '', inactive: '' };

  function _mountEditor(host) {
    var hostEl = document.getElementById('ret-editor-host');
    if (!hostEl || !window.DpRichEditor) return;
    var inst = window.DpRichEditor.mount(hostEl, {
      textarea: 'ret-body',
      placeholder: 'Mailtext \u2026',
      onChange: function () { _bodies[_active] = document.getElementById('ret-body').value; _previewSoon(); }
    });
    _editors.single = inst;
  }

  function _switchTo(kind) {
    // aktuellen Stand sichern
    var subEl = document.getElementById('ret-subject');
    if (subEl) _subjects[_active] = subEl.value;
    var bodyEl = document.getElementById('ret-body');
    if (bodyEl) _bodies[_active] = bodyEl.value;

    _active = kind;
    // Buttons markieren
    var btns = document.querySelectorAll('.ret-switch');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('btn-primary', btns[i].getAttribute('data-ret-kind') === kind);
    // Inhalte laden
    var s = _settings || {};
    if (!_subjects[kind]) _subjects[kind] = (kind === 'expiry') ? s.expiry_subject : s.inactive_subject;
    if (!_bodies[kind]) _bodies[kind] = (kind === 'expiry') ? s.expiry_body : s.inactive_body;
    if (subEl) subEl.value = _subjects[kind] || '';
    if (_editors.single) _editors.single.setHtml(_bodies[kind] || '');
    _previewSoon();
    _loadTemplates();
  }

  function _wire(host) {
    // Tab-Switch
    host.querySelectorAll('.ret-switch').forEach(function (b) {
      b.onclick = function () { _switchTo(b.getAttribute('data-ret-kind')); };
    });
    var subEl = document.getElementById('ret-subject');
    if (subEl) subEl.addEventListener('input', function () { _subjects[_active] = subEl.value; _previewSoon(); });

    var saveBtn = document.getElementById('ret-save');
    if (saveBtn) saveBtn.onclick = async function () {
      saveBtn.disabled = true;
      try { var r = await _call('POST', '/retention/settings', _collect()); _settings = r.settings; _toast('\u2713 Gespeichert', 'success'); _loadLists(); }
      catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
      saveBtn.disabled = false;
    };
    var prevBtn = document.getElementById('ret-preview-run');
    if (prevBtn) prevBtn.onclick = function () { _run(true); };
    var runBtn = document.getElementById('ret-run');
    if (runBtn) runBtn.onclick = function () {
      if (!window.confirm('Jetzt wirklich an alle passenden Kunden senden? (Bereits benachrichtigte werden \u00fcbersprungen)')) return;
      _run(false);
    };
    ['ret-expiry-days', 'ret-inactive-days'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.onchange = _loadLists;
    });
    var resetBtn = document.getElementById('ret-reset');
    if (resetBtn) resetBtn.onclick = function () {
      var def = _DEFAULTS && _DEFAULTS[_active];
      if (!def) return;
      var se = document.getElementById('ret-subject'); if (se) { se.value = def.subject; _subjects[_active] = def.subject; }
      if (_editors.single) _editors.single.setHtml(def.body);
      _bodies[_active] = def.body;
      _previewSoon();
      _toast('Standard-Vorlage eingesetzt (noch nicht gespeichert)', 'info');
    };

    // Vorlagen
    var tplSel = document.getElementById('ret-tpl-select');
    if (tplSel) tplSel.onchange = function () {
      var id = tplSel.value; if (!id) return;
      var t = (_tplCache || []).filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      var se = document.getElementById('ret-subject'); if (se && t.subject != null) { se.value = t.subject; _subjects[_active] = t.subject; }
      if (_editors.single) _editors.single.setHtml(t.body_html || '');
      _bodies[_active] = t.body_html || '';
      _previewSoon();
    };
    var tplSave = document.getElementById('ret-tpl-save');
    if (tplSave) tplSave.onclick = async function () {
      var name = window.prompt('Name f\u00fcr die Vorlage:', '');
      if (name == null) return;
      try {
        await _call('POST', '/retention/templates', {
          name: name, kind: _active,
          subject: (document.getElementById('ret-subject') || {}).value || '',
          body_html: (document.getElementById('ret-body') || {}).value || ''
        });
        _toast('\u2713 Vorlage gespeichert', 'success'); _loadTemplates();
      } catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
    };
    var tplDel = document.getElementById('ret-tpl-del');
    if (tplDel) tplDel.onclick = async function () {
      var sel = document.getElementById('ret-tpl-select'); var id = sel ? sel.value : '';
      if (!id) { _toast('Erst eine Vorlage w\u00e4hlen', 'info'); return; }
      if (!window.confirm('Diese Vorlage l\u00f6schen?')) return;
      try { await _call('DELETE', '/retention/templates/' + id); _toast('\u2713 Gel\u00f6scht', 'success'); _loadTemplates(); }
      catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
    };

    // Hintergrund
    var bgUp = document.getElementById('ret-bg-upload');
    var bgFile = document.getElementById('ret-bg-file');
    if (bgUp && bgFile) {
      bgUp.onclick = function () { bgFile.click(); };
      bgFile.onchange = function () {
        var f = bgFile.files && bgFile.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = async function () {
          try {
            await _call('POST', '/retention/background', { html: String(rd.result || ''), name: f.name });
            _toast('\u2713 Hintergrund gespeichert', 'success'); _loadBackground(); _previewSoon();
          } catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
        };
        rd.readAsText(f); bgFile.value = '';
      };
    }
    var bgClear = document.getElementById('ret-bg-clear');
    if (bgClear) bgClear.onclick = async function () {
      if (!window.confirm('Hintergrund-Vorlage entfernen?')) return;
      try { await _call('POST', '/retention/background', { html: '', name: '' }); _toast('\u2713 Entfernt', 'success'); _loadBackground(); _previewSoon(); }
      catch (e) { _toast('Fehler: ' + (e.message || ''), 'error'); }
    };
  }

  function _collect() {
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function chk(id) { var e = document.getElementById(id); return !!(e && e.checked); }
    // aktuellen Editor-Stand in die Speicher schreiben
    var subEl = document.getElementById('ret-subject'); if (subEl) _subjects[_active] = subEl.value;
    var bodyEl = document.getElementById('ret-body'); if (bodyEl) _bodies[_active] = bodyEl.value;
    return {
      expiry_enabled: chk('ret-expiry-enabled'),
      expiry_days_before: parseInt(val('ret-expiry-days'), 10) || 14,
      expiry_subject: _subjects.expiry || '',
      expiry_body: _bodies.expiry || '',
      inactive_enabled: chk('ret-inactive-enabled'),
      inactive_days: parseInt(val('ret-inactive-days'), 10) || 30,
      inactive_subject: _subjects.inactive || '',
      inactive_body: _bodies.inactive || ''
    };
  }

  function _previewSoon() { clearTimeout(_prevT); _prevT = setTimeout(_renderPreview, 350); }
  async function _renderPreview() {
    var fr = document.getElementById('ret-preview-frame'); if (!fr) return;
    var subj = (document.getElementById('ret-subject') || {}).value || '';
    var body = (document.getElementById('ret-body') || {}).value || '';
    try { var r = await _call('POST', '/retention/preview', { subject: subj, body_html: body }); fr.srcdoc = (r && r.html) || ''; }
    catch (e) { /* still lassen */ }
  }

  async function _run(dry) {
    var msg = document.getElementById('ret-run-msg');
    if (msg) { msg.style.color = '#666'; msg.textContent = dry ? 'Vorschau l\u00e4uft\u2026' : 'Senden\u2026'; }
    try {
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

  var _tplCache = [];
  async function _loadTemplates() {
    var sel = document.getElementById('ret-tpl-select'); if (!sel) return;
    try {
      var r = await _call('GET', '/retention/templates?kind=' + _active);
      _tplCache = (r && r.templates) || [];
      sel.innerHTML = '<option value="">\u2014 Vorlage laden \u2014</option>' +
        _tplCache.map(function (t) { return '<option value="' + _esc(t.id) + '">' + _esc(t.name) + ' (' + _esc(t.kind) + ')</option>'; }).join('');
    } catch (e) { /* still */ }
  }

  async function _loadBackground() {
    var el = document.getElementById('ret-bg-name'); if (!el) return;
    try {
      var r = await _call('GET', '/retention/background');
      var bg = (r && r.background) || {};
      el.textContent = bg.name ? ('\u2713 ' + bg.name) : '(keine \u2014 Standard-Rahmen)';
    } catch (e) { el.textContent = ''; }
  }

  async function _loadLists() {
    var ed = parseInt((document.getElementById('ret-expiry-days') || {}).value, 10);
    var idd = parseInt((document.getElementById('ret-inactive-days') || {}).value, 10);
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
    if (!host) return;
    if (!_settings) {
      host.innerHTML = '<div style="padding:30px;color:#888;">L\u00e4dt Kundenbindung\u2026</div>';
      try {
        var r = await _call('GET', '/retention/settings');
        _settings = r.settings;
        _DEFAULTS = {
          expiry: { subject: _settings.expiry_subject, body: _settings.expiry_body },
          inactive: { subject: _settings.inactive_subject, body: _settings.inactive_body }
        };
        _bodies = { expiry: _settings.expiry_body || '', inactive: _settings.inactive_body || '' };
        _subjects = { expiry: _settings.expiry_subject || '', inactive: _settings.inactive_subject || '' };
      } catch (e) { host.innerHTML = '<div style="padding:30px;color:#B86250;">Fehler: ' + _esc(e.message || '') + '</div>'; return; }
    }
    _render(host);
  }

  function _hook() {
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        if (/kundenbindung/i.test(link.textContent || '')) {
          link.addEventListener('click', function () { setTimeout(_open, 30); });
        }
      })(links[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_hook, 400); });
  } else { setTimeout(_hook, 400); }
  setTimeout(_hook, 1500);
  setTimeout(_hook, 3000);

  window._dpRetentionOpen = _open;
})();
