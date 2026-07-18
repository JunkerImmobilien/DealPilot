// v973: Admin-Ansicht "Landing" - Besucher, Funnel, Zeitverlauf, CTA, Geraete/Referrer.
// Eigener fetch (BASE + X-Admin-Token, wie admin-stats.js) + Charts.renderLineChart/renderDonut.
(function () {
  'use strict';
  var loaded = false, curDays = 30;
  // Eigenstaendiger Fetch (wie admin-stats.js) - API-Wrapper exportiert kein call().
  var BASE = '/api/v1/admin';
  function _token() { return localStorage.getItem('dp_admin_token') || ''; }
  async function _call(method, path) {
    var headers = {}; var t = _token(); if (t) headers['X-Admin-Token'] = t;
    var r = await fetch(BASE + path, { method: method, headers: headers });
    var data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
    return data;
  }

  function euro(n) { return new Intl.NumberFormat('de-DE').format(Math.round(n || 0)); }
  function pct(n) { return (Math.round((n || 0) * 10) / 10).toString().replace('.', ',') + ' %'; }

  function kpi(label, val, sub) {
    return '<div class="lp-kpi"><div class="lp-kpi-v">' + val + '</div><div class="lp-kpi-l">' + label + '</div>' +
      (sub ? '<div class="lp-kpi-s">' + sub + '</div>' : '') + '</div>';
  }
  function bar(label, val, max, color) {
    var w = max > 0 ? Math.max(2, Math.round(val / max * 100)) : 0;
    return '<div class="lp-bar"><div class="lp-bar-l">' + label + '</div>' +
      '<div class="lp-bar-t"><div class="lp-bar-f" style="width:' + w + '%;background:' + (color || '#c9a042') + '"></div></div>' +
      '<div class="lp-bar-v">' + euro(val) + '</div></div>';
  }

  function render(d) {
    var host = document.getElementById('lp-body'); if (!host) return;
    var k = d.kpis || {};
    var html = '<div class="lp-kpis">' +
      kpi('Besucher', euro(k.visitors), curDays + ' Tage') +
      kpi('Seitenaufrufe', euro(k.pageviews)) +
      kpi('\u00d8 Verweildauer', (k.avg_duration != null ? Math.round(k.avg_duration) + ' s' : '\u2013')) +
      kpi('Absprungrate', (k.bounce_rate != null ? pct(k.bounce_rate) : '\u2013'), 'nur 1 Sektion gesehen') +
      '</div>';

    html += '<div class="lp-card"><h3>Besucher im Zeitverlauf</h3><div id="lp-timeline"></div></div>';

    // Funnel (Section-Reichweite)
    var fn = d.funnel || []; var fmax = fn.reduce(function (a, x) { return Math.max(a, x.sessions); }, 0);
    html += '<div class="lp-card"><h3>Funnel \u2014 wie weit kommen Besucher</h3>';
    html += fn.length ? fn.map(function (x) { return bar(x.section, x.sessions, fmax, '#c9a042'); }).join('') : '<div class="lp-empty">Noch keine Section-Daten.</div>';
    html += '</div>';

    // Absprung
    var dr = d.dropoff || []; var dmax = dr.reduce(function (a, x) { return Math.max(a, x.n); }, 0);
    html += '<div class="lp-card"><h3>Absprung-Punkt (letzte Sektion)</h3>';
    html += dr.length ? dr.map(function (x) { return bar(x.section || '(unbekannt)', x.n, dmax, '#b8625c'); }).join('') : '<div class="lp-empty">Noch keine Absprung-Daten.</div>';
    html += '</div>';

    // CTA
    var ct = d.cta || []; var cmax = ct.reduce(function (a, x) { return Math.max(a, x.n); }, 0);
    html += '<div class="lp-card"><h3>CTA-Klicks</h3>';
    html += ct.length ? ct.map(function (x) { return bar(x.section || '(CTA)', x.n, cmax, '#3fa56c'); }).join('') : '<div class="lp-empty">Noch keine CTA-Klicks.</div>';
    html += '</div>';

    // Device + Referrer als Donuts
    html += '<div class="lp-row"><div class="lp-card lp-half"><h3>Ger\u00e4te</h3><div id="lp-device"></div></div>' +
            '<div class="lp-card lp-half"><h3>Herkunft</h3><div id="lp-referrer"></div></div></div>';

    host.innerHTML = html;

    try {
      var tl = (d.timeline || []).map(function (r) { return { label: r.day, value: r.visitors }; });
      if (window.Charts && Charts.renderLineChart) Charts.renderLineChart(document.getElementById('lp-timeline'), tl, { color: '#c9a042', height: 220, valueFormat: euro });
      if (window.Charts && Charts.renderDonut) {
        Charts.renderDonut(document.getElementById('lp-device'), (d.devices || []).map(function (x) { return { label: x.device || '?', value: x.n }; }), {});
        Charts.renderDonut(document.getElementById('lp-referrer'), (d.referrers || []).map(function (x) { return { label: x.referrer || '?', value: x.n }; }), {});
      }
    } catch (e) {}
  }

  function load() {
    var host = document.getElementById('lp-body'); if (!host) return;
    host.innerHTML = '<div class="lp-empty">Lade Landing-Analytics \u2026</div>';
    _call('GET', '/landing-analytics?days=' + curDays)
      .then(function (d) { render(d || {}); loaded = true; })
      .catch(function () { host.innerHTML = '<div class="lp-empty">Konnte Analytics nicht laden.</div>'; });
  }

  function init() {
    var link = document.querySelector('.nav-link[data-view="landing"]');
    if (link) link.addEventListener('click', function () { setTimeout(load, 30); });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('#lp-days button'); if (!b) return;
      curDays = parseInt(b.getAttribute('data-d'), 10) || 30;
      document.querySelectorAll('#lp-days button').forEach(function (x) { x.classList.toggle('on', x === b); });
      load();
    });
    // CSS
    if (!document.getElementById('lp-css')) {
      var st = document.createElement('style'); st.id = 'lp-css';
      st.textContent = [
        '.lp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}',
        '.lp-kpi{background:var(--surface,#141414);border:1px solid var(--border,#2a2a2a);border-radius:12px;padding:16px}',
        '.lp-kpi-v{font-size:26px;font-weight:700;color:#F2ECDC}.lp-kpi-l{font-size:12px;color:#A89F8E;margin-top:3px}.lp-kpi-s{font-size:10.5px;color:#A89F8E;margin-top:2px;opacity:.8}',
        '.lp-card{background:var(--surface,#141414);border:1px solid var(--border,#2a2a2a);border-radius:12px;padding:16px 18px;margin-bottom:16px}',
        '.lp-card h3{font-size:14px;margin:0 0 12px;color:#F2ECDC}',
        '.lp-row{display:flex;gap:16px}.lp-half{flex:1}',
        '.lp-bar{display:flex;align-items:center;gap:12px;margin-bottom:8px}.lp-bar-l{width:140px;font-size:12.5px;color:#E8E2D4;flex:0 0 auto}',
        '.lp-bar-t{flex:1;height:14px;background:rgba(140,140,140,.14);border-radius:7px;overflow:hidden}.lp-bar-f{height:100%;border-radius:7px}',
        '.lp-bar-v{width:70px;text-align:right;font-size:12px;color:#A89F8E;font-variant-numeric:tabular-nums}',
        '.lp-empty{padding:24px;text-align:center;color:#A89F8E;font-size:13px}',
        '#lp-days{display:inline-flex;gap:6px;margin-left:12px}#lp-days button{background:transparent;border:1px solid var(--border,#2a2a2a);color:#A89F8E;border-radius:8px;padding:5px 11px;font-size:12px;cursor:pointer}#lp-days button.on{background:#c9a042;color:#1a1407;border-color:transparent}'
      ].join('');
      document.head.appendChild(st);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
