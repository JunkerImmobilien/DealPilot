'use strict';
/**
 * darstellung-reseller.js (W20) — Darstellungs-Panel im Reseller-Modus
 *
 * ZIEL (Marcel, 15.07.): Das Panel aus Einstellungen -> Profil & Anzeige soll AUCH
 * das Reseller-Branding bedienen — aber NICHT dort verschwinden. Es sind zwei
 * verschiedene Dinge, die nur gleich aussehen:
 *   "für mich"           -> localStorage, nur dieser Browser, ALLE Plaene
 *   "für meine Mandanten" -> resellers.brand_display, gilt fuer alle Mandanten
 *
 * WARUM KEIN REFACTOR: settings.js hat 31x window._dpDisp*, _dpDispHeader ist
 * FUENFMAL definiert, LS() dreimal, _dpOpenFromSettings doppelt — drei
 * Generationen uebereinander. Die Handler umzuschreiben hiesse, gegen alle drei
 * zu kaempfen und dabei die persoenlichen Einstellungen JEDES Nutzers zu riskieren.
 * Stattdessen: die Handler bleiben unangetastet. Beim Wechsel in den Reseller-
 * Modus wird der persoenliche Stand FOTOGRAFIERT, das Reseller-Set eingespielt
 * (Live-Vorschau in der echten App), und beim Zurueckschalten das Foto wieder
 * hergestellt. Der Anbau erfolgt ueber dasselbe Muster, das v927 fuer den
 * Logo-Block schon nutzt (window._dpLogoBlock).
 */
(function () {
  var TARGET = 'me';          // 'me' | 'mandanten'
  var _snap = null;           // Foto der persoenlichen Werte
  var _busy = false;

  /* Schluessel -> Handler + Default. Reihenfolge zaehlt: Skin zuerst, weil
     _dpDispSkin() ein _dpDispRefresh() ausloest. */
  var MAP = [
    ['dp_chrome_hell', function (v) { call('_dpDispSkin', v === '1' ? 'hell' : 'obsidian'); }, '0'],
    ['dp_hdr_compact', function (v) { call('_dpDispHdr', v === '1' ? 'compact' : 'normal'); }, '0'],
    ['dp_hdr_ui',      function (v) { call('_dpDispHeader', v); }, '#EAE4D6'],
    ['dp_side_ui',     function (v) { call('_dpDispSide', v); },   '#EAE4D6'],
    ['dp_text_ui',     function (v) { call('_dpDispText', v); },   '#1A1A1A'],
    ['dp_hero_ui',     function (v) { call('_dpDispHero', v); },   '#C9A84C'],
    ['dp_kpi_ui',      function (v) { call('_dpDispKpi', v); },    '#F6F2E9'],
    ['dp_obj_ui',      function (v) { call('_dpDispObj', v); },    '#F6F2E9'],
    ['dp_objtext_ui',  function (v) { call('_dpDispObjText', v); }, ''],
    ['dp_tabtext_ui',  function (v) { call('_dpDispTabText', v); }, ''],
    ['dp_card_ui',     function (v) { call('_dpDispCard', v); },   ''],
    ['dp_accent_ui',   function (v) { call('_dpDispAccent', v); }, '#C9A84C'],
    ['dp_font_ui',     function (v) { call('_dpDispFont', v); },   'inter'],
    ['dp_zoom_ui',     function (v) { call('_dpDispSize', v); },   '1']
  ];

  function call(fn, v) { try { if (typeof window[fn] === 'function' && v) window[fn](v); } catch (e) {} }
  function LSget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function isPartner() {
    try { return !!(window.Plan && Plan.can && Plan.can('reseller')); } catch (e) { return false; }
  }

  function snapshot() {
    var o = {};
    MAP.forEach(function (m) { o[m[0]] = LSget(m[0]); });
    return o;
  }
  function applySet(o, sweep) {
    if (!o) return;
    MAP.forEach(function (m) {
      var v = o[m[0]];
      if (v === null || v === undefined || v === '') v = m[2];
      if (v) m[1](v);
    });
    try { if (window._dpDispRefresh) _dpDispRefresh(); } catch (e) {}
    /* W22-sweep: Die _dpDisp*-Handler setzen nur CSS-Variablen. Module mit hart
       verdrahtetem Gold (dpsh-score-hero 37x, Quick-Boarding, object-actions 54x ...)
       ignorieren die — dafuer gibt es den Sweeper. Im Vorschau-Modus lief er nie,
       deshalb blieben Portfolio-Cockpit und Quick-Boarding gold. */
    try {
      if (!window.DealPilotWhitelabel) return;
      if (sweep === false) { window.DealPilotWhitelabel.reset(); return; }
      var acc = (o.dp_accent_ui && /^#[0-9a-fA-F]{6}$/.test(o.dp_accent_ui)) ? o.dp_accent_ui : null;
      if (acc) window.DealPilotWhitelabel.apply({ accent: acc, obsidian: o.dp_hdr_ui });
      else window.DealPilotWhitelabel.reset();
    } catch (e) {}
  }
  function currentSet() {
    var o = {};
    MAP.forEach(function (m) { var v = LSget(m[0]); if (v) o[m[0]] = v; });
    return o;
  }

  /* ── Panel-Anbau (Muster wie window._dpLogoBlock aus v927) ── */
  window._dpResBlock = function () {
    if (!isPartner()) return '';        // nur Partner sehen den Umschalter
    return '<div class="dp-tb-sec" id="dp-res-sec"><b>Einstellen f\u00fcr</b>' +
      '<div class="dp-tt-mode-toggle">' +
        '<button class="dp-tt-mode-btn' + (TARGET === 'me' ? ' active' : '') + '" data-rt="me" onclick="_dpDispTarget(\'me\')">Mich</button>' +
        '<button class="dp-tt-mode-btn' + (TARGET === 'mandanten' ? ' active' : '') + '" data-rt="mandanten" onclick="_dpDispTarget(\'mandanten\')">Meine Mandanten</button>' +
      '</div>' +
      '<div id="dp-res-hint" style="font-size:10.5px;line-height:1.5;color:#8a8473;margin-top:6px">' +
        _hint() + '</div></div>';
  };
  window._dpResSave = function () {
    if (!isPartner() || TARGET !== 'mandanten') return '';
    return '<div class="dp-tb-sec" id="dp-res-save">' +
      '<button class="btn btn-sm" style="width:100%;background:var(--gold,#C9A84C);color:#1a1407;font-weight:700" ' +
        'onclick="_dpResCommit()">F\u00fcr meine Mandanten speichern</button>' +
      '<div style="font-size:10.5px;color:#8a8473;margin-top:6px;line-height:1.5">' +
        'Gilt danach f\u00fcr <b>alle</b> deine Mandanten. Zur\u00fcck auf „Mich" stellt deine ' +
        'pers\u00f6nliche Ansicht wieder her — ohne zu speichern.</div></div>';
  };
  function _hint() {
    return TARGET === 'me'
      ? 'Nur f\u00fcr dich, nur dieser Browser. \u00c4ndert nichts f\u00fcr deine Mandanten.'
      : '<b style="color:var(--gold,#C9A84C)">Mandanten-Ansicht.</b> Du siehst live, was deine Mandanten sehen. Erst „Speichern" macht es f\u00fcr sie g\u00fcltig.';
  }
  function repaint() {
    try {
      var b = document.querySelector('#dp-tb-panel .dp-tb-b');
      if (b && window.panelHtmlRebuild) return window.panelHtmlRebuild();
      /* panelHtml() ist modul-lokal -> nur die zwei eigenen Bloecke neu zeichnen */
      var sec = document.getElementById('dp-res-sec');
      if (sec) {
        var t = sec.parentNode; sec.outerHTML = window._dpResBlock();
      }
      var sv = document.getElementById('dp-res-save');
      var html = window._dpResSave();
      if (sv) { if (html) sv.outerHTML = html; else sv.remove(); }
      else if (html) {
        var host = document.querySelector('#dp-tb-panel .dp-tb-b');
        if (host) host.insertAdjacentHTML('beforeend', html);
      }
    } catch (e) {}
  }

  /* ── Umschalten ───────────────────────────────────────────── */
  window._dpDispTarget = function (t) {
    if (_busy || t === TARGET) return;
    if (t === 'mandanten') {
      _busy = true;
      _snap = snapshot();                       // persoenlichen Stand fotografieren
      loadReseller().then(function (set) {
        TARGET = 'mandanten';
        applySet(set || {});
        repaint(); _busy = false;
        toastSafe('Mandanten-Ansicht \u2014 so sehen es deine Mandanten');
      }).catch(function () { _busy = false; });
    } else {
      TARGET = 'me';
      applySet(_snap, false);                   // Foto zurueckspielen + Sweeper zurueck
      _snap = null;
      repaint();
      toastSafe('Zur\u00fcck auf deine pers\u00f6nliche Ansicht');
    }
  };

  function toastSafe(m) { try { if (typeof toast === 'function') toast(m); } catch (e) {} }
  function api(path, opts) {
    if (window.Auth && Auth.apiCall) return Auth.apiCall('/reseller' + path, opts);
    var tok = null; try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    var o = opts || {};
    return fetch((window.JI_API_BASE || '/api/v1') + '/reseller' + path, {
      method: o.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(function (r) { return r.json(); });
  }

  function loadReseller() {
    return api('/branding').then(function (r) {
      var b = r && r.branding; if (!b) return null;
      var d = b.brand_display;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      /* Noch nichts gepflegt? Dann wenigstens Akzent/Header aus dem Branding —
         damit der Partner nicht vor einem leeren Blatt sitzt. */
      if (!d || !Object.keys(d).length) {
        d = {};
        if (b.brand_accent)   d.dp_accent_ui = b.brand_accent;
        if (b.brand_obsidian) d.dp_hdr_ui = b.brand_obsidian;
      }
      return d;
    });
  }

  window._dpResCommit = function () {
    if (TARGET !== 'mandanten' || _busy) return;
    _busy = true;
    var set = currentSet();
    api('/branding-contact', { method: 'PUT', body: { brand_display: set } })
      .then(function () { toastSafe('\u2713 Darstellung f\u00fcr deine Mandanten gespeichert'); })
      .catch(function () { toastSafe('Speichern fehlgeschlagen'); })
      .then(function () { _busy = false; });
  };

  window._dpResTarget = function () { return TARGET; };
})();
