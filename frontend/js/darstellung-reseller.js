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

  /* v1111: MUSS vor der MAP stehen — die MAP wird beim Laden ausgewertet,
     und ein spaeter zugewiesenes var waere dort noch undefined. */
  var UV_LEER = '-';

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
    ['dp_zoom_ui',     function (v) { call('_dpDispSize', v); },   '1'],

    /* ── v1111 · Die vier Werte des neuen Darstellungs-Panels ────────────
       Bis hierher reichte der Partner seinen Mandanten 14 Werte durch —
       Farben, Schrift, Logo. Die Vorlage, den Kartenmodus, die
       Kartenflaeche und die Form NICHT, obwohl genau die den Gesamteindruck
       am staerksten praegen. Gemessen: weder dieses Modul noch
       mandant-branding.js enthielt ui_theme, ui_cards, ui_surface oder
       ui_form.

       Sie liegen nicht als Einzelschluessel, sondern zusammen in einem JSON
       unter dp_user_settings. Deshalb ein VIRTUELLER Schluessel mit dem
       Praefix "uv:" — LSget() und der Handler unten uebersetzen ihn, das
       Muster der MAP bleibt unangetastet.

       UV_LEER ist noetig, weil bei diesen vier "leer" ein GUELTIGER Wert
       ist: kein Attribut heisst "DealPilot" bzw. "Standard". applySet()
       ueberspringt aber leere Werte (if (v) …), sonst wuerde ein Partner,
       der bewusst DealPilot vorgibt, gar nichts uebertragen. */
    ['uv:ui_theme',   function (v) { uvSetzen('ui_theme',   v); }, UV_LEER],
    ['uv:ui_cards',   function (v) { uvSetzen('ui_cards',   v); }, UV_LEER],
    ['uv:ui_surface', function (v) { uvSetzen('ui_surface', v); }, UV_LEER],
    ['uv:ui_form',    function (v) { uvSetzen('ui_form',    v); }, UV_LEER]
  ];

  function call(fn, v) { try { if (typeof window[fn] === 'function' && v) window[fn](v); } catch (e) {} }

  /* v1111: virtuelle Schluessel auf das JSON abbilden. */
  function uvLesen(feld) {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}') || {};
      var v = s[feld];
      return (v === undefined || v === null || v === '') ? UV_LEER : String(v);
    } catch (e) { return UV_LEER; }
  }
  function uvSetzen(feld, v) {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}') || {};
      s[feld] = (v === UV_LEER || v === undefined || v === null) ? '' : String(v);
      localStorage.setItem('dp_user_settings', JSON.stringify(s));
      if (window.DealPilotUiVarianten && DealPilotUiVarianten.apply) DealPilotUiVarianten.apply();
    } catch (e) {}
  }

  function LSget(k) {
    try {
      if (k.indexOf('uv:') === 0) return uvLesen(k.slice(3));
      return localStorage.getItem(k);
    } catch (e) { return null; }
  }
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
    o.wl_freiheit = _frei;   /* v1122 · reist im vorhandenen jsonb mit */
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
  /* ═══════════════════════════════════════════════════════════════════════
     v1122 · Weg B aus design/Vorschlaege/partner-flow-darstellung.md

     Der Partner bestimmt selbst, wie viel Freiheit seine Mandanten haben.
     Drei Stufen, EIN Schluessel: wl_freiheit.

       keine    Marke UND Komfort gelten bei jedem Laden. Der Mandant
                aendert nichts.
       komfort  Marke gilt immer, Komfort ist nach dem ersten Mal frei.
                = Weg A = das Verhalten seit v1111 = VOREINSTELLUNG.
       alles    Marke ist nur Voreinstellung, danach gehoert alles dem
                Mandanten.

     EINE ANNAHME DES VORSCHLAGS IST WIDERLEGT: er veranschlagte
     "ein Feld mehr im Branding-Datensatz, also Backend-Migration".
     Gemessen — resellers.brand_display ist jsonb, und die Migration
     062_reseller_display.sql sagt das ausdruecklich dazu: "jsonb, weil das
     Panel waechst: neue Regler brauchen dann keine Migration."
     wl_freiheit reist also im vorhandenen JSON mit. Keine Migration,
     kein Backend-Eingriff, keine Produktionsberuehrung.

     wl_freiheit steht bewusst NICHT in der MAP: die MAP bildet
     Darstellungswerte auf _dpDisp*-Handler ab. Eine Freigaberegel ist
     kein Darstellungswert — sie wuerde dort nur einen Handler brauchen,
     den es nicht gibt. */
  var FREI_STD = 'komfort';
  var _frei = FREI_STD;
  var FREI_TXT = {
    keine:   ['Nichts', 'Meine Marke und meine Darstellung gelten unverändert.'],
    komfort: ['Vorlage und Karten', 'Farben und Logo bleiben meine. Voreinstellung.'],
    alles:   ['Alles', 'Meine Marke ist nur die Voreinstellung.']
  };
  window._dpResFreiheit = function (v) {
    if (!FREI_TXT[v]) return;
    _frei = v;
    repaint();
  };
  window._dpResFreiheitBlock = function () {
    if (!isPartner() || TARGET !== 'mandanten') return '';
    var opt = Object.keys(FREI_TXT).map(function (k) {
      var an = (_frei === k);
      return '<label class="dp-frei-opt' + (an ? ' an' : '') + '" ' +
        'onclick="_dpResFreiheit(\'' + k + '\')">' +
        '<span class="dp-frei-dot">' + (an ? '●' : '○') + '</span>' +
        '<span><b>' + FREI_TXT[k][0] + '</b><small>' + FREI_TXT[k][1] + '</small></span></label>';
    }).join('');
    return '<div class="dp-tb-sec" id="dp-res-frei">' +
      '<b>Was dürfen deine Mandanten selbst ändern?</b>' +
      '<style>#dp-res-frei .dp-frei-opt{display:flex;gap:8px;align-items:flex-start;' +
      'padding:7px 8px;margin:4px 0;border-radius:6px;cursor:pointer;font-size:11.5px;line-height:1.45}' +
      '#dp-res-frei .dp-frei-opt:hover{background:rgba(201,168,76,.08)}' +
      '#dp-res-frei .dp-frei-opt.an{background:rgba(201,168,76,.14);' +
      'border-left:2px solid var(--wl-c9a84c, #C9A84C)}' +
      '#dp-res-frei .dp-frei-dot{color:var(--wl-c9a84c, #C9A84C);flex:0 0 auto}' +
      '#dp-res-frei .dp-frei-opt small{display:block;color:#8a8473;font-size:10.5px;margin-top:1px}' +
      '</style>' + opt +
      '<div style="font-size:10.5px;color:#8a8473;margin-top:6px;line-height:1.5">' +
      'Wird zusammen mit der Darstellung gespeichert.</div></div>';
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
      /* v1122 · Der Freiheits-Block folgt derselben Mechanik wie der
         Speichern-Block: er existiert nur in der Mandanten-Ansicht. */
      var fr = document.getElementById('dp-res-frei');
      var frHtml = window._dpResFreiheitBlock();
      if (fr) { if (frHtml) fr.outerHTML = frHtml; else fr.remove(); }
      else if (frHtml) {
        var fhost = document.querySelector('#dp-tb-panel .dp-tb-b');
        if (fhost) fhost.insertAdjacentHTML('beforeend', frHtml);
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
      /* v1122 · Die gespeicherte Freiheitsstufe in den Regler zuruecklesen.
         Fehlt sie — jeder Partner von vor v1122 —, gilt die Voreinstellung
         'komfort', also genau das Verhalten seit v1111. Niemand merkt
         etwas, bis er die Stufe bewusst aendert. */
      _frei = FREI_TXT[d.wl_freiheit] ? d.wl_freiheit : FREI_STD;
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
