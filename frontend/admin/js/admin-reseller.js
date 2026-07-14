// DealPilot Admin — Reseller-Verwaltung (Paket 7)
// Eigenständiges Modul im Muster von admin-stats.js/admin-network.js:
// erzeugt einen Nav-Link "Reseller" + eine View, verdrahtet an /api/v1/admin-reseller.
'use strict';
(function () {
  var BASE = '/api/v1/admin-reseller';
  function _token() { return localStorage.getItem('dp_admin_token') || ''; }
  async function _call(method, path, body) {
    var headers = {}; var t = _token(); if (t) headers['X-Admin-Token'] = t;
    if (body) headers['Content-Type'] = 'application/json';
    var r = await fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    var data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
    return data;
  }
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _toast(m, kind) {
    try {
      var c = document.querySelector('.toast-container'); if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
      var t = document.createElement('div'); t.className = 'toast toast-' + (kind || 'info'); t.textContent = m; c.appendChild(t);
      setTimeout(function () { t.remove(); }, 3000);
    } catch (e) {}
  }

  var _view = null;

  function _kpi(label, value, color) {
    return '<div style="flex:1;min-width:120px;background:#faf9f6;border-left:3px solid ' + (color || '#C9A84C') + ';border-radius:8px;padding:14px 16px;">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#888;font-weight:600;">' + _esc(label) + '</div>' +
      '<div style="font-size:1.9em;font-weight:700;line-height:1.1;color:#1b1815;margin-top:4px;">' + value + '</div></div>';
  }

  async function _render() {
    var v = _view; if (!v) return;
    v.innerHTML = '<div class="view-header"><h2>Reseller-Verwaltung</h2><p>Partner, Lizenz-Pools und Anfragen verwalten.</p></div><div id="rav-body">Lade…</div>';
    var body = document.getElementById('rav-body');
    try {
      var rr = await _call('GET', '/resellers'); var list = rr.resellers || [];
      var iq = { inquiries: [] }; try { iq = await _call('GET', '/inquiries'); } catch (e) {}
      var inqs = (iq.inquiries || []).filter(function (i) { var s = i.status || 'neu'; return s !== 'bearbeitet' && s !== 'abgelehnt'; });

      var totGek = 0, totZug = 0;
      list.forEach(function (x) { totGek += (x.pool_gekauft | 0); totZug += (x.pool_zugewiesen | 0); });

      var rows = list.map(function (x) {
        var badge = x.is_master ? '<span class="badge" style="background:#fbeed8;color:#c8791f;">MASTER</span>'
          : (x.status === 'gesperrt' ? '<span class="badge" style="background:rgba(184,98,80,.12);color:#B86250;">gesperrt</span>'
            : '<span class="badge" style="background:rgba(63,165,108,.12);color:#3FA56C;">aktiv</span>');
        var wl = x.whitelabel_enabled ? ' <span class="badge" style="background:#ede9fe;color:#7a5aa8;">WL</span>' : '';
        var pool = x.is_master ? '∞ intern' : ((x.pool_gekauft | 0) + ' · ' + (x.pool_zugewiesen | 0) + ' zug.');
        var act = x.is_master ? '' :
          (x.status === 'gesperrt'
            ? '<button class="btn btn-sm" data-act="aktiv" data-id="' + x.id + '">Entsperren</button>'
            : '<button class="btn btn-sm" data-act="gesperrt" data-id="' + x.id + '" style="color:#B86250;">Sperren</button>');
        return '<tr><td><strong>' + _esc(x.name) + '</strong>' + wl + '</td><td>' + _esc(x.role) + '</td><td>' + _esc(x.owner_email || '\u2013') + '</td>' +
          '<td style="font-family:monospace;">' + pool + '</td><td>' + badge + '</td><td style="text-align:right;">' + act + '</td></tr>';
      }).join('');

      var inqHtml = inqs.length ? inqs.map(function (i) {
        var pre = _esc(JSON.stringify({ name: i.company || i.contact_name || '', email: i.email || '' }));
        return '<div class="card" style="padding:16px;margin-bottom:10px;"><div style="display:flex;align-items:center;gap:10px;">' +
          '<div><strong>' + _esc(i.contact_name || i.name || '\u2013') + '</strong><div style="font-size:.88em;color:#888;">' + _esc(i.company || '') + (i.company ? ' · ' : '') + _esc(i.email || '') + '</div></div></div>' +
          (i.goals ? '<div style="font-size:.92em;color:#3a352c;margin-top:8px;">' + _esc(i.goals) + '</div>' : '') +
          '<div style="margin-top:12px;display:flex;gap:8px;">' +
          '<button class="btn btn-primary btn-sm" data-fs=\'' + pre + '\'>Freischalten</button>' +
          '<button class="btn btn-sm" data-no="' + _esc(i.id) + '" style="color:#B86250;">Ablehnen</button></div></div>';
      }).join('') : '<div style="padding:14px;color:#999;">Keine offenen Anfragen.</div>';

      body.innerHTML =
        '<div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;">' +
          _kpi('Reseller', list.length) + _kpi('Seats gekauft', totGek, '#b8932f') + _kpi('Zugewiesen', totZug, '#3FA56C') + _kpi('Frei', (totGek - totZug)) +
        '</div>' +
        '<div class="card" style="padding:18px;margin-bottom:16px;"><h3 style="margin:0 0 12px;">Reseller anlegen</h3>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 180px;gap:10px;align-items:end;">' +
            '<div><label style="font-size:.8em;color:#888;">Name / Kanzlei</label><input id="rav-name" class="input" style="width:100%;"></div>' +
            '<div><label style="font-size:.8em;color:#888;">Owner-E-Mail (bestehendes Konto)</label><input id="rav-email" class="input" style="width:100%;"></div>' +
            '<div><label style="font-size:.8em;color:#888;">Rolle</label><select id="rav-role" class="input" style="width:100%;">' +
              ['steuerberater', 'makler', 'finanzierer', 'hausverwalter', 'sonstige'].map(function (o) { return '<option>' + o + '</option>'; }).join('') +
            '</select></div></div>' +
            '<button class="btn btn-primary" id="rav-create" style="margin-top:12px;">Anlegen &amp; Partner-Plan zuweisen</button>' +
        '</div>' +
        '<div class="card" style="padding:18px;margin-bottom:16px;"><h3 style="margin:0 0 12px;">Partner</h3>' +
          '<table class="data-table"><thead><tr><th>Name</th><th>Rolle</th><th>Owner</th><th>Pool</th><th>Status</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="6" style="color:#999;">Noch keine Reseller.</td></tr>') + '</tbody></table></div>' +
        '<div class="card" style="padding:18px;"><h3 style="margin:0 0 12px;">Offene Partner-Anfragen</h3>' + inqHtml + '</div>';

      var cb = document.getElementById('rav-create'); if (cb) cb.addEventListener('click', _create);
      body.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { _setStatus(b.getAttribute('data-id'), b.getAttribute('data-act')); }); });
      body.querySelectorAll('[data-fs]').forEach(function (b) { b.addEventListener('click', function () { var p = {}; try { p = JSON.parse(b.getAttribute('data-fs')); } catch (e) {} _prefill(p); }); });
      body.querySelectorAll('[data-no]').forEach(function (b) { b.addEventListener('click', function () { _reject(b.getAttribute('data-no')); }); });
    } catch (e) {
      body.innerHTML = '<div style="padding:16px;color:#B86250;">Fehler: ' + _esc(e.message || '') + '</div>';
    }
  }

  function _prefill(p) {
    var n = document.getElementById('rav-name'), em = document.getElementById('rav-email');
    if (n) n.value = p.name || ''; if (em) em.value = p.email || '';
    if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  async function _create() {
    var name = (document.getElementById('rav-name') || {}).value, email = (document.getElementById('rav-email') || {}).value, role = (document.getElementById('rav-role') || {}).value;
    if (!name || !email) { _toast('Name + Owner-E-Mail nötig', 'error'); return; }
    try { await _call('POST', '/resellers', { name: name, ownerEmail: email, role: role }); _toast('✓ Reseller angelegt + Partner-Plan zugewiesen', 'success'); _render(); }
    catch (e) { _toast(e && e.status === 404 ? 'Kein Konto mit dieser E-Mail' : 'Anlegen fehlgeschlagen', 'error'); }
  }
  async function _setStatus(id, status) {
    try { await _call('POST', '/resellers/' + id + '/status', { status: status }); _render(); _toast(status === 'gesperrt' ? 'Gesperrt' : 'Entsperrt', 'success'); }
    catch (e) { _toast('Fehlgeschlagen', 'error'); }
  }
  async function _reject(id) {
    try { await _call('POST', '/inquiries/' + id + '/status', { status: 'abgelehnt' }); _render(); _toast('Abgelehnt', 'info'); }
    catch (e) { _toast('Fehlgeschlagen', 'error'); }
  }

  // ── Nav-Link + View selbst erzeugen ──
  function _ensureNav() {
    if (document.getElementById('view-reseller')) return true;
    var anyLink = document.querySelector('.nav-link');
    var anyView = document.querySelector('.view');
    if (!anyLink || !anyView) return false;
    var link = document.createElement('a');
    link.href = '#'; link.className = 'nav-link'; link.setAttribute('data-view', 'reseller'); link.textContent = 'Reseller';
    anyLink.parentNode.appendChild(link);
    var view = document.createElement('div');
    view.id = 'view-reseller'; view.className = 'view'; view.style.display = 'none';
    anyView.parentNode.appendChild(view);
    _view = view;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(function (l) { l.classList.toggle('active', l === link); });
      document.querySelectorAll('.view').forEach(function (x) { x.style.display = 'none'; });
      view.style.display = 'block';
      _render();
    });
    return true;
  }
  function _boot() { if (!_ensureNav()) setTimeout(_boot, 600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_boot, 500); });
  else setTimeout(_boot, 500);
  setTimeout(_boot, 1800);
})();
