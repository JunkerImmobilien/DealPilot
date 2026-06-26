// DealPilot Admin v800 — Statistik / Analytics
// Eigenstaendiges Modul: erzeugt einen Nav-Link "Statistik" + eine View und
// rendert vier Auswertungen (Feature-Nutzung, Funnel, Login-Aktivitaet, Conversion/Churn).
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
  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _n(v) { return (v == null) ? '\u2013' : Number(v).toLocaleString('de-DE'); }
  function _pct(v) { return (v == null) ? '\u2013' : (v + ' %'); }

  var _days = 30;
  var _mounted = false;

  // ── Nav-Link + View erzeugen ────────────────────────────────────
  function _ensureNav() {
    if (document.getElementById('nav-stats-v800')) return true;
    // Nav-Container finden: Eltern des ersten .nav-link
    var first = document.querySelector('.nav-link');
    if (!first || !first.parentNode) return false;
    var nav = first.parentNode;

    var link = document.createElement('a');
    link.id = 'nav-stats-v800';
    link.href = '#';
    link.className = first.className; // gleiche Optik wie andere Nav-Links
    link.setAttribute('data-view', 'stats');
    link.textContent = 'Statistik';
    // Direkt nach dem Dashboard-Link einsortieren (oder ans Ende)
    var dash = null;
    var links = nav.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) { if ((links[i].getAttribute('data-view') || '') === 'dashboard') { dash = links[i]; break; } }
    if (dash && dash.nextSibling) nav.insertBefore(link, dash.nextSibling);
    else nav.appendChild(link);

    link.addEventListener('click', function (e) {
      e.preventDefault();
      _activate();
    });
    return true;
  }

  function _ensureView() {
    var v = document.getElementById('view-stats');
    if (v) return v;
    // Container der Views finden (Geschwister von .view)
    var anyView = document.querySelector('.view');
    var host = anyView ? anyView.parentNode : (document.querySelector('.main') || document.body);
    v = document.createElement('div');
    v.id = 'view-stats';
    v.className = 'view';
    v.style.display = 'none';
    host.appendChild(v);
    return v;
  }

  function _activate() {
    // Andere Views ausblenden, Nav markieren
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].style.display = 'none';
    var links = document.querySelectorAll('.nav-link');
    for (var j = 0; j < links.length; j++) links[j].classList.remove('active');
    var myLink = document.getElementById('nav-stats-v800');
    if (myLink) myLink.classList.add('active');
    var v = _ensureView();
    v.style.display = 'block';
    _load(v);
  }

  function _card(title, inner) {
    return '<div class="card" style="padding:18px;margin-bottom:16px;"><h3 style="margin:0 0 12px;">' + _esc(title) + '</h3>' + inner + '</div>';
  }
  function _kpiBox(label, value, sub, color) {
    return '<div style="flex:1;min-width:120px;background:#faf9f6;border-left:3px solid ' + (color || '#C9A84C') + ';border-radius:8px;padding:14px 16px;">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#888;font-weight:600;">' + _esc(label) + '</div>' +
      '<div style="font-size:1.9em;font-weight:700;line-height:1.1;color:#1b1815;margin-top:4px;">' + value + '</div>' +
      (sub ? '<div style="font-size:12px;color:#999;margin-top:2px;">' + _esc(sub) + '</div>' : '') +
    '</div>';
  }
  function _bar(pct, color) {
    var p = Math.max(0, Math.min(100, pct || 0));
    return '<div style="height:9px;background:#eee;border-radius:5px;overflow:hidden;"><div style="height:100%;width:' + p + '%;background:' + (color || 'linear-gradient(90deg,#E8CC7A,#C9A84C)') + ';"></div></div>';
  }

  function _render(host, data) {
    var fu = data.featureUsage || {};
    var fn = data.funnel || {};
    var la = data.loginActivity || {};
    var cc = data.conversionChurn || {};

    var html = '<div class="view-header" style="display:flex;justify-content:space-between;align-items:center;"><h2>Statistik</h2>' +
      '<div style="display:flex;gap:6px;">' +
        _rangeBtn(7) + _rangeBtn(30) + _rangeBtn(90) +
      '</div></div>';

    // ── Login-Aktivitaet ──
    var dist = la.distribution || {};
    html += _card('Login-Aktivit\u00e4t',
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' +
        _kpiBox('Heute aktiv', _n(la.dau), 'DAU', '#3FA56C') +
        _kpiBox('7 Tage', _n(la.wau), 'WAU', '#C9A84C') +
        _kpiBox('30 Tage', _n(la.mau), 'MAU', '#3b82f6') +
      '</div>' +
      '<div style="font-size:13px;color:#666;margin-bottom:6px;">Letzter Login \u2014 Verteilung</div>' +
      '<table class="data-table"><tbody>' +
        _distRow('Heute', dist.d1) + _distRow('Letzte 7 Tage', dist.d7) + _distRow('Letzte 30 Tage', dist.d30) +
        _distRow('Letzte 90 Tage', dist.d90) + _distRow('\u00c4lter als 90 Tage', dist.older) + _distRow('Noch nie', dist.never) +
      '</tbody></table>');

    // ── Engagement-Funnel ──
    html += _card('Engagement-Funnel',
      _funnelRow('Registriert', fn.registered, 100, '#3b82f6') +
      _funnelRow('E-Mail best\u00e4tigt', fn.verified, fn.verified_pct, '#3FA56C') +
      _funnelRow('Hat Objekt angelegt', fn.has_object, fn.object_pct, '#C9A84C') +
      _funnelRow('Zahlendes Abo', fn.paying, fn.paying_pct, '#b8932f'));

    // ── Conversion + Churn ──
    var ker = cc.kerosin_30d || {};
    html += _card('Umsatz \u00b7 Conversion \u00b7 Churn',
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' +
        _kpiBox('Zahlende Kunden', _n(cc.paying_users), 'von ' + _n(cc.total_users), '#3FA56C') +
        _kpiBox('Conversion', _pct(cc.conversion_pct), 'Free \u2192 Paid', '#C9A84C') +
        _kpiBox('Churn (30 T.)', _pct(cc.churn_pct), _n(cc.churned_30d) + ' gek\u00fcndigt', '#B86250') +
      '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
        _kpiBox('Kerosin verbraucht', _n(ker.verbraucht) + ' L', 'letzte 30 Tage', '#3b82f6') +
        _kpiBox('Kerosin gutgeschrieben', _n(ker.gutgeschrieben) + ' L', 'K\u00e4ufe + Gutschriften', '#888') +
      '</div>' +
      (cc.plan_distribution && cc.plan_distribution.length ?
        ('<div style="font-size:13px;color:#666;margin:14px 0 6px;">Aktive Pl\u00e4ne</div>' +
         '<table class="data-table"><tbody>' + cc.plan_distribution.map(function (p) {
           return '<tr><td>' + _esc(p.plan_id) + '</td><td style="text-align:right;font-weight:600;">' + _n(p.n) + '</td></tr>';
         }).join('') + '</tbody></table>') : ''));

    // ── Feature-Nutzung ──
    var feats = fu.features || [];
    var maxC = feats.reduce(function (m, f) { return Math.max(m, f.count); }, 0) || 1;
    html += _card('Feature-Nutzung (letzte ' + (fu.days || _days) + ' Tage)',
      feats.length ? feats.map(function (f) {
        return '<div style="margin:9px 0;">' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">' +
            '<span>' + _esc(f.feature) + '</span>' +
            '<span style="color:#888;">' + _n(f.count) + ' \u00d7 \u00b7 ' + _n(f.liters) + ' L</span></div>' +
          _bar(Math.round(f.count / maxC * 100)) +
        '</div>';
      }).join('') : '<div style="color:#999;">Noch keine Nutzung im Zeitraum.</div>');

    host.innerHTML = html;
    // Range-Buttons verdrahten
    host.querySelectorAll('[data-stats-range]').forEach(function (b) {
      b.onclick = function () { _days = parseInt(b.getAttribute('data-stats-range'), 10) || 30; _load(host); };
    });
  }

  function _rangeBtn(d) {
    var active = (_days === d);
    return '<button class="btn' + (active ? ' btn-primary' : '') + '" data-stats-range="' + d + '">' + d + ' Tage</button>';
  }
  function _distRow(label, n) {
    return '<tr><td>' + _esc(label) + '</td><td style="text-align:right;font-weight:600;">' + _n(n) + '</td></tr>';
  }
  function _funnelRow(label, n, pct, color) {
    return '<div style="margin:10px 0;">' +
      '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:4px;">' +
        '<span style="font-weight:600;">' + _esc(label) + '</span>' +
        '<span style="color:#666;">' + _n(n) + (pct != null && label !== 'Registriert' ? ' \u00b7 ' + pct + ' %' : '') + '</span></div>' +
      _bar(pct != null ? pct : 100, color) +
    '</div>';
  }

  async function _load(host) {
    host.innerHTML = '<div style="padding:30px;color:#888;">L\u00e4dt Statistik\u2026</div>';
    try {
      var data = await _call('GET', '/stats/overview?days=' + _days);
      _render(host, data);
    } catch (e) {
      host.innerHTML = '<div style="padding:30px;color:#B86250;">Fehler: ' + _esc(e.message || '') + '</div>';
    }
  }

  function _hook() {
    if (_ensureNav()) { _ensureView(); _mounted = true; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_hook, 400); });
  } else { setTimeout(_hook, 400); }
  // Re-Hook nach App-Mount (Nav entsteht evtl. erst nach Login)
  setTimeout(_hook, 1500);
  setTimeout(_hook, 3000);

  window._dpStatsOpen = _activate;
})();
