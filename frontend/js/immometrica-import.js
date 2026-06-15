'use strict';
/* ImmoMetricaImport – Objekt-Picker gegen /api/v1/immometrica (v655-Backend).
   v665: heller oabi-Look wie Exposé/Sprache (oabi-head/sub/body/foot/btn), zweispaltig
   (Quellen+Objektliste links, Felder+Mapping rechts). open(onConfirm, opts) — opts.target
   'qc'|'obj' steuert die Mapping-Beschriftung. onConfirm(dpFields, rawItem). isReady(cb). */
(function () {
  var API = '/api/v1/immometrica';
  function tok() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function hdr() { return { 'Authorization': 'Bearer ' + tok() }; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmt(n) { return n == null ? '\u2014' : new Intl.NumberFormat('de-DE').format(n); }

  var IMO_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h11M4 12h11M4 18h7"/><circle cx="19" cy="6" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';

  var FIELD_LABEL = {
    kuerzel: 'K\u00fcrzel', objart: 'Objektart', plz: 'PLZ', ort: 'Ort', str: 'Stra\u00dfe', hnr: 'Nr.',
    wfl: 'Wohnfl\u00e4che', gsfl: 'Grundst\u00fcck', baujahr: 'Baujahr', kp: 'Kaufpreis', nkm: 'Kaltmiete',
    zimmer: 'Zimmer', bad_anz: 'B\u00e4der', etage: 'Etage', etagen_ges: 'Etagen ges.',
    einheiten: 'Einheiten', vermstand: 'Vermietung', erwerbsart: 'Erwerbsart',
    anbietertyp: 'Anbietertyp', notizen: 'Sonstige Bemerkungen',
  };
  var FIELD_ORDER = ['kuerzel', 'objart', 'plz', 'ort', 'str', 'hnr', 'wfl', 'gsfl', 'baujahr',
    'kp', 'nkm', 'zimmer', 'bad_anz', 'etage', 'etagen_ges', 'einheiten', 'vermstand',
    'erwerbsart', 'anbietertyp', 'notizen'];

  function augmentDp(dp, raw) {
    if (!dp || !raw) return;
    if (raw.foreclosure) dp.erwerbsart = 'Zwangsversteigerung';
    else if (raw.auction) dp.erwerbsart = 'Bieterverfahren';
    if (raw.is_private === true) dp.anbietertyp = 'privat';
    else if (raw.is_private === false) dp.anbietertyp = 'gewerblich';
  }

  var state = { onConfirm: null, source: null, sources: [], items: [], active: null, target: 'obj', onClose: null, confirmed: false };
  function targetLabel() { return state.target === 'qc' ? 'Quick-Check' : 'Objekt'; }

  function isReady(cb) {
    fetch(API + '/credentials', { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (d) { cb(!!(d && d.immometrica && d.immometrica.exists)); })
      .catch(function () { cb(false); });
  }

  /* Picker-spezifisches CSS (oabi-* kommt aus object-actions oab-style). Nur die
     Teile, die oabi nicht hat: 2-Spalten-Grid, Quellen-Pills, Objektliste, Mapping. */
  function injectStyle() {
    if (document.getElementById('imo-style')) return;
    var css = [
      '.oabi-ov.imo-mode .oabi-modal{width:min(980px,100%);max-height:92vh;overflow:hidden;display:flex;flex-direction:column}',
      '.oabi-ov.imo-mode .oabi-head{position:relative}',
      '.oabi-ov.imo-mode .oabi-body{flex:1 1 auto;min-height:0;overflow:hidden;padding:8px 0 0;display:grid;grid-template-columns:1fr 372px}',
      '.oabi-ov.imo-mode .oabi-foot{flex:none}',
      '#imo-x{position:absolute;top:-2px;right:18px;background:none;border:0;color:var(--muted,#7A7370);font-size:24px;line-height:1;cursor:pointer}',
      '#imo-x:hover{color:var(--ch,#2A2727)}',
      '.imo-left{border-right:1px solid var(--border,#E0DBD3);display:flex;flex-direction:column;min-height:0}',
      '.imo-right{display:flex;flex-direction:column;min-height:0;overflow:auto}',
      '.imo-src{display:flex;gap:8px;padding:12px 18px;flex-wrap:wrap;border-bottom:1px solid var(--border,#E0DBD3);background:var(--surface2,#F0ECE4)}',
      ".imo-pill{font:600 12px 'DM Sans',system-ui,sans-serif;padding:7px 13px;border-radius:999px;cursor:pointer;background:#fff;border:1px solid var(--border,#E0DBD3);color:var(--ch2,#3D3A3A)}",
      '.imo-pill:hover{border-color:var(--gold,#C9A84C)}',
      '.imo-pill.on{border-color:var(--gold,#C9A84C);color:var(--ch,#2A2727);box-shadow:0 0 0 2px rgba(201,168,76,.18)}',
      '.imo-list{overflow:auto;padding:14px 18px;background:var(--surface,#F8F6F1)}',
      '.imo-note{font:11px ui-monospace,monospace;color:var(--muted,#7A7370);margin-bottom:9px}',
      '.imo-o{border:1px solid var(--border,#E0DBD3);border-radius:12px;padding:12px 13px;margin-bottom:10px;cursor:pointer;background:#fff;transition:border-color .12s,box-shadow .12s}',
      '.imo-o:hover{border-color:var(--gold,#C9A84C)}',
      '.imo-o.on{border-color:var(--gold,#C9A84C);box-shadow:0 0 0 2px rgba(201,168,76,.18)}',
      ".imo-o .t{font:600 13.5px 'DM Sans',system-ui,sans-serif;color:var(--ch,#2A2727);line-height:1.3}",
      '.imo-o .a{font-size:12px;color:var(--muted,#7A7370);margin:3px 0 8px}',
      '.imo-o .meta{display:flex;gap:13px;flex-wrap:wrap;font:500 12px ui-monospace,monospace;color:var(--ch2,#3D3A3A)}',
      '.imo-o .meta b{color:var(--gold-3,#9a7f33)}',
      '.imo-detail{overflow:auto;padding:14px 18px;flex:1}',
      '.imo-empty{color:var(--muted,#7A7370);text-align:center;padding:54px 14px;font-size:13px}',
      '.imo-dl{font:700 10px ui-monospace,monospace;letter-spacing:.12em;color:var(--gold-3,#9a7f33);text-transform:uppercase;margin-bottom:10px}',
      '.imo-f{display:grid;grid-template-columns:auto 100px 1fr;align-items:start;gap:9px;padding:7px 0;border-bottom:1px solid rgba(42,39,39,.06);font-size:13px}',
      '.imo-f input{margin-top:2px;accent-color:var(--gold,#C9A84C);width:15px;height:15px}',
      '.imo-f .lbl{color:var(--gold-3,#9a7f33);font:600 12px ui-monospace,monospace}',
      '.imo-f .val{color:var(--ch,#2A2727)}',
      '.imo-f .map{grid-column:2 / -1;font:11px ui-monospace,monospace;color:var(--muted,#7A7370);margin-top:1px}',
      '.imo-f .map b{color:var(--green,#3FA56C);font-weight:600}',
      '.imo-sum{margin-top:10px;background:var(--surface,#F8F6F1);border:1px solid var(--border,#E0DBD3);border-radius:10px;padding:11px;font-size:12px;color:var(--ch2,#3D3A3A);white-space:pre-wrap;max-height:150px;overflow:auto;line-height:1.5}',
      '@media(max-width:680px){.oabi-ov.imo-mode .oabi-body{grid-template-columns:1fr}.imo-left{border-right:0;border-bottom:1px solid var(--border,#E0DBD3);max-height:44vh}.imo-right{max-height:42vh}}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'imo-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  function ensureOverlay() {
    injectStyle();
    var ov = document.getElementById('imo-ov');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'imo-ov';
    ov.className = 'oabi-ov imo-mode';
    ov.innerHTML =
      '<div class="oabi-modal">' +
        '<div class="oabi-head"><span style="color:var(--gold,#C9A84C)">' + IMO_ICON + '</span><h3>ImmoMetrica \u00b7 Objekt w\u00e4hlen</h3>' +
          '<button id="imo-x" type="button">\u00d7</button></div>' +
        '<div class="oabi-sub">Quelle w\u00e4hlen, Objekt antippen \u2014 Felder pr\u00fcfen und \u00fcbernehmen.</div>' +
        '<div class="oabi-body">' +
          '<div class="imo-left"><div id="imo-src" class="imo-src"></div><div id="imo-list" class="imo-list"></div></div>' +
          '<div class="imo-right"><div id="imo-detail" class="imo-detail"><div class="imo-empty">Objekt links w\u00e4hlen.</div></div></div>' +
        '</div>' +
        '<div class="oabi-foot">' +
          '<button type="button" class="oabi-btn" id="imo-cancel">Abbrechen</button>' +
          '<button type="button" class="oabi-btn primary" id="imo-confirm" disabled><span style="display:inline-flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span> Ausgew\u00e4hlte \u00fcbernehmen</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#imo-x').onclick = close;
    ov.querySelector('#imo-cancel').onclick = close;
    ov.querySelector('#imo-confirm').onclick = confirmPick;
    return ov;
  }
  function close() { var ov = document.getElementById('imo-ov'); if (ov) ov.remove(); if (state.onClose && !state.confirmed) { var f = state.onClose; state.onClose = null; try { f(); } catch (e) {} } }

  function loadSources() {
    var host = document.getElementById('imo-src');
    host.innerHTML = '<span style="font:12px ui-monospace,monospace;color:var(--muted,#7A7370)">Lade Quellen\u2026</span>';
    fetch(API + '/searches', { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (searches) {
        state.sources = [];
        (Array.isArray(searches) ? searches : []).forEach(function (s) {
          state.sources.push({ key: 's' + s.id, label: 'Suche \u00b7 ' + (s.name || s.id), count: s.count, kind: 'search', id: s.id });
        });
        state.sources.push({ key: 'favde', label: 'Favoriten \u00b7 DE', kind: 'fav', cc: 'de' });
        renderSources();
        if (state.sources[0]) selectSource(state.sources[0]);
      })
      .catch(function () { host.innerHTML = '<span style="color:var(--red,#B8625C);font-size:12px">Konnte Quellen nicht laden (Zugang gespeichert?).</span>'; });
  }
  function renderSources() {
    var host = document.getElementById('imo-src');
    host.innerHTML = state.sources.map(function (s) {
      var on = state.source && state.source.key === s.key;
      return '<div class="imo-pill' + (on ? ' on' : '') + '" data-k="' + s.key + '">' + esc(s.label) + (s.count != null ? ' \u00b7 ' + s.count : '') + '</div>';
    }).join('');
    host.querySelectorAll('.imo-pill').forEach(function (el) {
      el.onclick = function () { var s = state.sources.find(function (x) { return x.key === el.dataset.k; }); if (s) selectSource(s); };
    });
  }
  function selectSource(s) {
    state.source = s; state.active = null; renderSources(); renderDetail();
    var list = document.getElementById('imo-list');
    list.innerHTML = '<div style="color:var(--muted,#7A7370);font-size:13px;padding:20px 0">Lade Objekte\u2026</div>';
    var url = s.kind === 'search' ? API + '/searches/' + s.id + '/results' : API + '/favorites/' + s.cc;
    fetch(url, { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (d) { state.items = (d && d.items) || []; state.items.forEach(function (it) { augmentDp(it.dp, it.raw); }); renderList(d && d.count); })
      .catch(function () { list.innerHTML = '<div style="color:var(--red,#B8625C);font-size:13px">Konnte Objekte nicht laden.</div>'; });
  }
  function renderList(total) {
    var list = document.getElementById('imo-list');
    if (!state.items.length) { list.innerHTML = '<div style="color:var(--muted,#7A7370);font-size:13px;padding:20px 0">Keine Objekte.</div>'; return; }
    var note = (total != null && total > state.items.length)
      ? '<div class="imo-note">' + total + ' Treffer \u2013 Seite 1.</div>' : '';
    list.innerHTML = note + state.items.map(function (it, i) {
      var r = it.raw, dp = it.dp;
      var on = state.active === i;
      return '<div class="imo-o' + (on ? ' on' : '') + '" data-i="' + i + '">' +
        '<div class="t">' + esc(r.title || dp.kuerzel || ('Objekt ' + r.id)) + '</div>' +
        '<div class="a">' + esc(r.address_raw || '') + '</div>' +
        '<div class="meta">' +
          '<span>KP <b>' + fmt(dp.kp) + ' \u20ac</b></span>' +
          '<span>Wfl <b>' + fmt(dp.wfl) + '</b> m\u00b2</span>' +
          '<span>' + esc(dp.objart || '') + '</span>' +
          '<span>Bj ' + fmt(dp.baujahr) + '</span></div></div>';
    }).join('');
    list.querySelectorAll('.imo-o').forEach(function (el) {
      el.onclick = function () { state.active = parseInt(el.dataset.i, 10); renderList(total); renderDetail(); };
    });
  }
  function renderDetail() {
    var host = document.getElementById('imo-detail');
    var confirm = document.getElementById('imo-confirm');
    if (state.active == null || !state.items[state.active]) {
      host.innerHTML = '<div class="imo-empty">Objekt links w\u00e4hlen.</div>';
      if (confirm) confirm.disabled = true; return;
    }
    var dp = state.items[state.active].dp;
    var map = 'ImmoMetrica <span style="color:var(--muted,#7A7370)">\u2192</span> <b>' + targetLabel() + '</b>';
    var rows = FIELD_ORDER.filter(function (k) { return dp[k] != null && dp[k] !== ''; }).map(function (k) {
      var v = dp[k];
      var disp = (k === 'notizen') ? '<span style="color:var(--muted,#7A7370)">Zusammenfassung</span>' : (typeof v === 'number' ? fmt(v) : esc(v));
      return '<label class="imo-f">' +
        '<input type="checkbox" class="imo-cb" data-k="' + k + '" checked>' +
        '<span class="lbl">' + (FIELD_LABEL[k] || k) + '</span>' +
        '<span class="val">' + disp + '</span>' +
        '<span class="map">' + map + '</span>' +
        '</label>';
    }).join('');
    var summary = dp.notizen ? '<div class="imo-sum">' + esc(dp.notizen) + '</div>' : '';
    host.innerHTML = '<div class="imo-dl">In ' + esc(targetLabel()) + ' \u00fcbernehmen</div>' + rows + summary;
    if (confirm) confirm.disabled = false;
  }
  function confirmPick() {
    var it = state.items[state.active]; if (!it) return;
    var picked = {};
    document.querySelectorAll('#imo-ov .imo-cb').forEach(function (cb) { if (cb.checked) picked[cb.dataset.k] = it.dp[cb.dataset.k]; });
    ['_immometrica_id', '_quelle', '_expose', '_immometrica_online_since', '_immometrica_portals'].forEach(function (k) {
      if (it.dp[k] != null) picked[k] = it.dp[k];
    });
    state.confirmed = true;
    close();
    if (typeof state.onConfirm === 'function') state.onConfirm(picked, it.raw);
  }

  window.ImmoMetricaImport = {
    isReady: isReady,
    open: function (onConfirm, opts) {
      state.onConfirm = onConfirm || function () {};
      state.target = (opts && opts.target) || 'obj';
      state.onClose = (opts && opts.onClose) || null; state.confirmed = false;
      state.source = null; state.active = null; state.items = [];
      ensureOverlay(); loadSources();
    },
    close: close,
  };
})();
