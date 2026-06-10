/* v557 (M2): Vollbild-Marktbericht = eingebettetes echtes Marktbericht-Frontend (iframe).
 * - Laedt /marktbericht-app/ (Kopie des Standalone-Frontends: Karte, Charts, Score, PDF, Laden).
 * - Auth + 5 L Kerosin sitzen serverseitig im Proxy (/reports/generate). Das Embed-Bootstrap
 *   haengt das Token an und biegt generate-stream -> generate (kostenpflichtig).
 * - Schlanke Kopfleiste mit Objekt-Dropdown (Default = aktuelles Objekt) + Schliessen.
 *   Objektwahl -> iframe mit ?prefill neu laden.
 */
(function (global) {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m) { try { if (typeof global.toast === 'function') return global.toast(m); } catch (e) {} try { console.log('[mb-view]', m); } catch (e) {} }

  var _objects = [];
  var _selId = null;

  function injectCss() {
    if ($('mbv-style')) return;
    var s = document.createElement('style'); s.id = 'mbv-style';
    s.textContent = [
      'body.mb-standalone-active .tabs,body.mb-standalone-active .tabs-workflow-bar,body.mb-standalone-active .wf-tab-bar,body.mb-standalone-active .workflow-tab-bar{display:none!important}',
      'body.mb-standalone-active #dp-sb-toggle{display:none!important}',
      'body.mb-standalone-active .sec{display:none!important}',
      'body.mb-standalone-active #s-marktbericht{display:block!important;position:fixed!important;inset:0!important;z-index:9000!important;width:100vw!important;height:100vh!important;max-width:100vw!important;overflow:auto!important;background:#050505!important;margin:0!important}',
      '#s-marktbericht{padding:0;background:#050505;min-height:100vh}',
      '.mbv-bar{display:flex;align-items:center;gap:14px;max-width:1340px;margin:0 auto;padding:14px 20px 8px;flex-wrap:wrap}',
      '.mbv-bar .t{font-family:"Space Grotesk",sans-serif;font-size:18px;font-weight:700;color:#fff;flex:none}',
      '.mbv-bar .t b{color:#C9A84C}',
      '.mbv-bar select{background:#16161b;border:1px solid #2a2a30;color:#e9e6df;border-radius:8px;padding:8px 11px;font-size:13px;min-width:240px;font-family:inherit}',
      '.mbv-bar .sp{flex:1}',
      '.mbv-bar .x{border:1px solid rgba(201,168,76,.45);background:transparent;color:#C9A84C;border-radius:999px;padding:8px 16px;cursor:pointer;font-weight:700;font-size:13px}',
      '.mbv-hint{max-width:1340px;margin:0 auto;padding:0 20px 8px;font-size:12px;color:#8b8579}',
      '.mbv-frame{width:100%;border:0;display:block;height:calc(100vh - 96px);min-height:600px;background:#050505}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function currentObjAsQuery() {
    var d = global._currentObjData || {};
    function g(k) { return d[k]; }
    var addr = '';
    var str = g('str'), hnr = g('hnr'), plz = g('plz'), ort = g('ort');
    if (str || ort || plz) addr = (str ? str + (hnr ? ' ' + hnr : '') + ', ' : '') + ((plz || '') + ' ' + (ort || '')).trim();
    var q = new URLSearchParams();
    if (addr) q.set('address', addr);
    var pt = g('objart') || g('objektart'); if (pt) q.set('ptype', pt);
    if (g('wfl')) q.set('area', g('wfl'));
    if (g('baujahr')) q.set('year', g('baujahr'));
    if (g('kp')) q.set('price', g('kp'));
    return q.toString();
  }

  function frameSrc(query) {
    // Cache-Busting + Prefill
    return '/marktbericht-app/index.html?v=562' + (query ? '&' + query : '');
  }

  function render() {
    var host = $('s-marktbericht'); if (!host) return;
    var opts = '<option value="">— aktuelles Objekt / manuell im Bericht —</option>' +
      _objects.map(function (o) { return '<option value="' + esc(o.id) + '"' + (String(o.id) === String(_selId) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('');
    host.innerHTML =
      /* v569-headerout: .mbv-bar entfernt (Dropdown+Schliessen jetzt in mb-app) */
      '<div class="mbv-hint">Voller Marktbericht — 5 L Kerosin pro Erstellung. Daten aus dem gewählten Objekt vorbefüllt; im Bericht anpassbar.</div>' +
      '<iframe id="mbv-frame" class="mbv-frame" src="' + frameSrc(currentObjAsQuery()) + '" allow="clipboard-write"></iframe>';
    var c = $('mbv-close'); if (c) c.addEventListener('click', closeMarktberichtView);
    var sel = $('mbv-obj');
    if (sel) sel.addEventListener('change', async function () {
      _selId = sel.value || null;
      var q = '';
      if (!_selId) { q = currentObjAsQuery(); }
      else {
        try {
          var full = await global.Auth.apiCall('/objects/' + _selId);
          var d = (full && (full.data || full)) || {};
          var prev = global._currentObjData; global._currentObjData = d;   // temporaer fuer Query-Builder
          q = currentObjAsQuery();
          global._currentObjData = prev;
        } catch (e) { toast('Objekt konnte nicht geladen werden'); }
      }
      var fr = $('mbv-frame'); if (fr) fr.src = frameSrc(q);
    });
  }

  async function loadObjects() {
    _objects = [];
    try {
      var resp = await global.Auth.apiCall('/objects?limit=100&_t=' + Date.now());
      var items = (resp && resp.items) || [];
      _objects = items.map(function (o) {
        var d = o.data || o;
        var label = (d.str ? d.str + (d.hnr ? ' ' + d.hnr : '') + ', ' : '') + (d.ort || d.plz || ('Objekt ' + o.id));
        return { id: o.id, label: label };
      });
    } catch (e) { _objects = []; }
  }

  async function openMarktberichtView() {
    injectCss();
    if (document.body.classList.contains('dp-dash-fullscreen') && global.DealPilotDashboard && typeof global.DealPilotDashboard.close === 'function') {
      try { global.DealPilotDashboard.close(); } catch (e) {}
    }
    if (document.body.classList.contains('qc-standalone-active') && typeof global.exitQuickCheckMode === 'function') {
      try { global.exitQuickCheckMode(); } catch (e) {}
    }
    document.body.classList.add('mb-standalone-active');
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    var mb = $('s-marktbericht'); if (mb) { mb.classList.add('active'); }
    try {
      if (!document.body.classList.contains('hdr-collapsed')) {
        document.body.classList.add('hdr-collapsed'); document.body.dataset.mbHdrAuto = '1';
        if (typeof global._updateHdrHeight === 'function') global._updateHdrHeight();
      } else { document.body.dataset.mbHdrAuto = '0'; }
    } catch (e) {}
    _selId = global._currentObjKey || null;
    render();
    await loadObjects();
    var sel = $('mbv-obj');
    if (sel) sel.innerHTML = '<option value="">— aktuelles Objekt / manuell im Bericht —</option>' +
      _objects.map(function (o) { return '<option value="' + esc(o.id) + '"' + (String(o.id) === String(_selId) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('');
    window.scrollTo(0, 0);
  }

  function closeMarktberichtView() {
    document.body.classList.remove('mb-standalone-active');
    var mb = $('s-marktbericht'); if (mb) { mb.classList.remove('active'); mb.innerHTML = ''; }  // iframe entladen
    try {
      if (document.body.dataset.mbHdrAuto === '1') {
        document.body.classList.remove('hdr-collapsed'); delete document.body.dataset.mbHdrAuto;
        if (typeof global._updateHdrHeight === 'function') global._updateHdrHeight();
      }
    } catch (e) {}
    if (typeof global._updateWfTop === 'function') setTimeout(global._updateWfTop, 50);
  }

  global.openMarktberichtView = openMarktberichtView;
  // v569-headerout: Schliessen-Button aus der mb-app (iframe) empfangen
  window.addEventListener('message', function (ev) {
    try { if (ev.data && ev.data.type === 'mbv-close') closeMarktberichtView(); } catch (e) {}
  });
  global.closeMarktberichtView = closeMarktberichtView;
})(window);
