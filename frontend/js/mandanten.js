/* mandanten.js — DealPilot Mandanten / Halter (v809)
 * Eigenstaendiges Modul: window.DealPilotMandanten
 *  v803b: Steuerregime + Buchhaltung nur fuer GmbH/UG. Privat = nur Name (+ Hinweis).
 *  v804 : effRate() liefert den Halter-Steuersatz fuer den calc.js-Fork (Stufe 2a).
 *  v806 : PRO-GATE — Mandanten nur fuer Plan 'pro'.
 *  v809 : Feld-Erklaerungen (Steuerregime + Buchhaltung) als kurze Hinweis-Texte.
 *  - Mandanten-Liste (localStorage 'dp_mandanten'), CRUD im Settings-Reiter
 *  - Halter-Dropdown am Objekt (#halter), Cockpit-Filter-Chips (#dp-halter-filter)
 *  - Regime/Buchhaltung werden GESPEICHERT, aber erst Stufe 2/3 aktiv.
 *  - Privat ist Default und nicht loeschbar. Objekte ohne Halter = Privat.
 * Marker-Namespace: mand-*
 */
(function () {
  var LS_KEY = 'dp_mandanten';

  var RF = [
    { v: 'privat', t: 'Privat (nat\u00fcrliche Person)' },
    { v: 'gmbh',   t: 'GmbH' },
    { v: 'ug',     t: 'UG (haftungsbeschr\u00e4nkt)' },
    { v: 'gbr',    t: 'GbR / Personengesellschaft' }
  ];
  var RF_NEW = ['gmbh', 'ug', 'gbr']; /* fuer neue Mandanten: kein zweites "Privat" */
  var KR = ['SKR04', 'SKR03'];

  function isCorp(rf) { return rf === 'gmbh' || rf === 'ug'; } /* eigene KSt-Rechnung + Buchhaltung */

  /* ===== PRO-GATE (v806) — Mandanten nur fuer Plan 'pro' ===== */
  var PRO_PLANS = ['pro']; /* bei neuer Top-Stufe hier ergaenzen */
  function _isPro() {
    try {
      var cfg = window.DealPilotConfig;
      if (cfg && cfg.pricing && typeof cfg.pricing.currentKey === 'function') {
        return PRO_PLANS.indexOf((cfg.pricing.currentKey() || '').toLowerCase()) >= 0;
      }
    } catch (e) {}
    return false;
  }
  /* Halter-/Ueberfuehrungs-Felder am Objekt ein-/ausblenden je nach Plan */
  function _applyGate() {
    var pro = _isPro();
    var nodes = document.querySelectorAll('[data-mand]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].classList && nodes[i].classList.contains('mand-ueberf')) continue; /* die steuert _syncUeberf */
      if (nodes[i].getAttribute && nodes[i].getAttribute('data-halter-hide')) continue; /* v816e-applygate-skip: Halter bleibt aus */
      nodes[i].style.display = pro ? '' : 'none';
    }
    if (!pro) { var hsel = document.getElementById('halter'); if (hsel) { try { hsel.value = 'privat'; } catch (e) {} } }
  }

  function _privat() {
    return {
      id: 'privat', name: 'Privat', rechtsform: 'privat',
      regime: {}, bh: {}, _locked: true
    };
  }
  function _defaults() { return { list: [_privat()] }; }

  function _load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.list && o.list.length) {
          if (!o.list.some(function (m) { return m.id === 'privat'; })) o.list.unshift(_privat());
          return o;
        }
      }
    } catch (e) {}
    return _defaults();
  }
  var _state = _load();
  function _save() { try { localStorage.setItem(LS_KEY, JSON.stringify(_state)); } catch (e) {} }

  function getList() { return _state.list.slice(); }
  function get(id) {
    for (var i = 0; i < _state.list.length; i++) { if (_state.list[i].id === id) return _state.list[i]; }
    return _state.list[0];
  }
  function _genId() { return 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }
  function rfLabel(v) { for (var i = 0; i < RF.length; i++) { if (RF[i].v === v) return RF[i].t; } return v; }

  function upsert(m) {
    if (!m.id) { m.id = _genId(); _state.list.push(m); }
    else {
      var found = false;
      for (var i = 0; i < _state.list.length; i++) { if (_state.list[i].id === m.id) { _state.list[i] = m; found = true; break; } }
      if (!found) _state.list.push(m);
    }
    _save(); renderHalterOptions(); renderHalterChips();
  }
  function remove(id) {
    if (id === 'privat') return;
    _state.list = _state.list.filter(function (m) { return m.id !== id; });
    _save(); renderHalterOptions(); renderHalterChips();
  }

  function esc(s) {
    return ('' + (s == null ? '' : s)).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _num(id) {
    var el = document.getElementById(id); if (!el) return 0;
    var v = ('' + el.value).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(v); return isNaN(n) ? 0 : n;
  }

  /* ===== Halter-Dropdown am Objekt (#halter) ===== */
  function renderHalterOptions() {
    var sel = document.getElementById('halter'); if (!sel) return;
    if (!_isPro()) { sel.innerHTML = '<option value="privat">Privat</option>'; sel.value = 'privat'; return; }
    /* v816i-halter-persist: Wert aus geladenen Objektdaten holen, da loadData den select.value
       setzt BEVOR die <option>s existieren -> Wert ginge sonst verloren. */
    var cur = sel.value;
    if (!cur || cur === 'privat') {
      try { var _od = window._currentObjData; if (_od && _od.halter) cur = _od.halter; } catch (e) {}
    }
    sel.innerHTML = _state.list.map(function (m) {
      return '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>';
    }).join('');
    if (cur) { sel.value = cur; if (sel.value !== cur) sel.value = 'privat'; }
  }

  /* ===== Cockpit-Filter-Chips (#dp-halter-filter) ===== */
  function renderHalterChips() {
    var host = document.getElementById('dp-halter-filter'); if (!host) return;
    if (!_isPro()) { host.innerHTML = ''; return; }
    var active = window._dpHalterFilter || '__all__';
    var chips = [{ id: '__all__', name: 'Alle' }].concat(_state.list);
    host.innerHTML = chips.map(function (c) {
      var on = (c.id === active) ? ' mand-chip-on' : '';
      return '<button type="button" class="mand-chip' + on + '" onclick="DealPilotMandanten.setFilter(\'' + c.id + '\')">' + esc(c.name) + '</button>';
    }).join('');
  }
  /* v815-sbchips: Mandanten-Switch in der Sidebar-Objektliste (#sb-mand-filter) */
  /* v816f-filter-dropdown: Mandanten-Filter als Icon-Button + Dropdown (DealPilot-Stil). */
  function _mandIco(c) {
    if (c.id === '__all__') return 'i-layers';
    if (c.id === 'privat' || c.rechtsform === 'privat') return 'i-user';
    if (isCorp(c.rechtsform)) return 'i-building';
    return 'i-user';
  }
  function renderSidebarChips() {
    var host = document.getElementById('sb-mand-filter'); if (!host) return;
    if (!_isPro() || !_state.list || _state.list.length <= 1) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    var active = window._dpHalterFilter || '__all__';
    var items = [{ id: '__all__', name: 'Alle', rechtsform: '__all__' }].concat(_state.list);
    var filtered = (active !== '__all__');
    var rows = items.map(function (c) {
      var on = (c.id === active) ? ' active' : '';
      return '<button type="button" class="sb-mand-item' + on + '" onclick="DealPilotMandanten.setFilter(\'' + c.id + '\')">' +
               '<svg class="ic" width="15" height="15"><use href="#' + _mandIco(c) + '"/></svg>' + esc(c.name) +
               '<svg class="chk" width="13" height="13"><use href="#i-check"/></svg></button>';
    }).join('');
    /* Separator nach 'Alle' */
    rows = rows.replace('</button>', '</button><div class="sb-mand-sep"></div>');
    /* v816j: verwaiste body-Menues vor Neu-Aufbau entfernen */
    try { var _orph = document.querySelectorAll('body > #sb-mand-menu, body > .sb-mand-menu'); for (var _o = 0; _o < _orph.length; _o++) { _orph[_o].parentNode.removeChild(_orph[_o]); } } catch (e) {}
    host.innerHTML =
      '<div class="sb-sort-toggle sb-mand-wrap">' +
        '<button type="button" class="sb-sort-btn sb-mand-btn' + (filtered ? ' filtered' : '') + '" title="Nach Mandant filtern" onclick="DealPilotMandanten._toggleMandMenu(event)">' +
          '<svg width="12" height="12"><use href="#i-building"/></svg><span class="sb-mand-dot"></span>' +
        '</button>' +
        '<div class="sb-mand-menu" id="sb-mand-menu">' +
          '<div class="sb-mand-mhead">Mandant / Halter</div>' + rows +
        '</div>' +
      '</div>';
  }
  function _positionMandMenu(m, btn) {
    /* v816i-dropdown-body: Menue ans <body> haengen -> kein Vorfahre kann clippen/transparent machen. */
    try {
      if (m.parentElement !== document.body) { document.body.appendChild(m); }
      var r = btn.getBoundingClientRect();
      m.style.position = 'fixed';
      m.style.top = (r.bottom + 6) + 'px';
      var mw = m.offsetWidth || 172;
      var left = r.right - mw;            /* rechtsbuendig zum Button */
      if (left < 8) left = 8;
      m.style.left = left + 'px';
      m.style.right = 'auto';
      m.style.zIndex = '99999';
      m.style.background = '#100f0d';
    } catch (_pe) {}
  }
  /* v816j-dropdown-close: alle (auch ans body gehaengte) Mandanten-Menues schliessen/entfernen. */
  function _closeMandMenu() {
    try {
      var all = document.querySelectorAll('#sb-mand-menu, .sb-mand-menu');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        el.classList.remove('open');
        /* am body verwaiste Menues ganz entfernen (renderSidebarChips baut frisch) */
        if (el.parentElement === document.body) { try { el.parentNode.removeChild(el); } catch (e) {} }
      }
    } catch (e) {}
  }
  function _toggleMandMenu(e) {
    if (e) { e.stopPropagation(); }
    var m = document.getElementById('sb-mand-menu'); if (!m) return;
    var btn = e && e.currentTarget ? e.currentTarget : document.querySelector('.sb-mand-btn');
    var open = m.classList.toggle('open');
    if (open && btn) { _positionMandMenu(m, btn); }
    if (open && !_mandMenuDocBound) {
      _mandMenuDocBound = true;
      document.addEventListener('click', function _close() {
        var mm = document.getElementById('sb-mand-menu'); if (mm) mm.classList.remove('open');
      });
      window.addEventListener('scroll', function () {
        var mm = document.getElementById('sb-mand-menu'); if (mm) mm.classList.remove('open');
      }, true);
    }
  }
  var _mandMenuDocBound = false;
  /* v815-toggle: Checkbox 'Aus Privatbestand ueberfuehrt' treibt das versteckte obj_herkunft */
  function onUeberfToggle(checked) {
    /* v816c-mandanten toggle-lock: Ueberfuehrung NUR ueber Wizard. */
    var h = document.getElementById('obj_herkunft');
    var alreadyU = !!(h && h.value === 'ueberfuehrung');
    var _cb = document.getElementById('mand_ueberf_cb');
    if (checked && !alreadyU) {
      if (_cb) _cb.checked = false;
      if (typeof toast === 'function') toast('\u00dcberf\u00fchrung bitte \u00fcber \u201eDeal-Aktion \u2192 \u00dcberf\u00fchrung starten\u201c (oder Rechtsklick auf die Objektkarte).');
      return;
    }
    if (!checked && alreadyU) {
      if (_cb) _cb.checked = true;
      if (typeof toast === 'function') toast('Eine bestehende \u00dcberf\u00fchrung hebst du \u00fcber \u201e\u00dcberf\u00fchrung aufheben\u201c auf.');
      return;
    }
  }
  function setFilter(id) {  /* v815-setfilter v816j */
    try { _closeMandMenu(); } catch (e) {}   /* v816j: Menue schliessen bevor neu gerendert wird */
    window._dpHalterFilter = id;
    if (window.DealPilotDashboard && DealPilotDashboard.applyHalterFilter) { DealPilotDashboard.applyHalterFilter(id); }
    renderHalterChips();
    try { renderSidebarChips(); } catch (e) {}
    try { if (typeof renderSaved === 'function') renderSaved({_immediate:true}); } catch (e) {}
  }
  function filterByHalter(arr) {
    var f = window._dpHalterFilter;
    if (!f || f === '__all__') return arr;
    return (arr || []).filter(function (o) { var h = (o && o.halter) ? o.halter : 'privat'; return h === f; });
  }

  /* ===== Steuersatz des Halters fuer den calc.js-Fork (Stufe 2a) =====
   * Privat / GbR -> null  => calc.js rechnet 1:1 mit grenz (ESt, wie heute).
   * GmbH / UG    -> Dezimalsatz = KSt(+Soli)/100 + GewSt-Effekt.
   *   GewSt-Effekt = 0 bei erweiterter Kuerzung, sonst Messzahl 3,5 % x (Hebesatz/100).
   * id optional; ohne id wird das aktuelle #halter-Feld gelesen. */
  function effRate(id) {
    if (!_isPro()) return null; /* v806: ohne Pro keine GmbH-Rechnung */
    if (id == null) { var sel = document.getElementById('halter'); id = sel ? sel.value : 'privat'; }
    var m = get(id || 'privat');
    if (!m || !isCorp(m.rechtsform)) return null;
    var reg = m.regime || {};
    var kst = (reg.kst != null ? reg.kst : 15.825) / 100;
    var heb = (reg.gewst != null ? reg.gewst : 0);
    var gewst = reg.erw_kuerzung ? 0 : (0.035 * (heb / 100));
    var r = kst + gewst;
    return (isFinite(r) && r > 0) ? r : null;
  }

  /* ===== Objekt-Felder: Ueberfuehrung ein/aus + %-Anzeige ===== */
  function wireObjectFields() {
    var herk = document.getElementById('obj_herkunft');
    if (herk && !herk._mandWired) { herk._mandWired = true; herk.addEventListener('change', function(){ _syncUeberf(); try{ if(typeof calc==='function') calc(); }catch(e){} try{ if(typeof renderTaxModule==='function') renderTaxModule(); }catch(e){} }); }  /* v813-3d */
    ['ueberf_preis', 'verkehrswert_ueberf'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el._mandWired) { el._mandWired = true; el.addEventListener('input', _calcPct); }
    });
    /* v813-3d: Felder, die die Berechnung beeinflussen, loesen calc()+Steuer-Render aus */
    ['verkehrswert_ueberf', 'ueberf_restschuld', 'ueberf_rest_zins'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el._mandCalcWired) { el._mandCalcWired = true; el.addEventListener('input', function(){ try{ if(typeof calc==='function') calc(); }catch(e){} try{ if(typeof renderTaxModule==='function') renderTaxModule(); }catch(e){} }); }
    });
    var hsel = document.getElementById('halter');
    if (hsel && !hsel._mandWired) {
      hsel._mandWired = true;
      hsel.addEventListener('change', function () {
        try { if (typeof calc === 'function') calc(); } catch (e) {}
        try { if (typeof renderTaxModule === 'function') renderTaxModule(); } catch (e) {}
      });
    }
    _syncUeberf();
  }
  /* v813-3d: Auto-Vorbelegung der uebernommenen Restschuld (A-Vorbelegung, ueberschreibbar). */
  function _prefillRest() {
    try {
      var el = document.getElementById('ueberf_restschuld');
      if (!el || el._mandPrefilled) return;
      var cur = (el.value || '').trim();
      if (cur !== '' && cur !== '0') return;  /* User hat schon was eingetragen */
      var rs = 0;
      try { if (window.State && typeof State.rs1 === 'number' && State.rs1 > 0) rs = State.rs1; } catch (_e) {}
      if (!rs) { var d1el = document.getElementById('d1'); if (d1el) { var n = parseFloat(String(d1el.value).replace(/\./g, '').replace(',', '.')); if (isFinite(n) && n > 0) rs = n; } }
      if (rs > 0) {
        el.value = Math.round(rs).toLocaleString('de-DE');
        el._mandPrefilled = true;
        var h = document.getElementById('mand-rest-hint');
        if (h) h.textContent = 'Vorschlag aus deiner Finanzierung, anpassbar';
      }
    } catch (_e) {}
  }

  function _syncUeberf() {
    var herk = document.getElementById('obj_herkunft');
    var show = !!(herk && herk.value === 'ueberfuehrung');
    var _cb = document.getElementById('mand_ueberf_cb'); if (_cb) _cb.checked = show;  /* v815-cbsync */
    var nodes = document.querySelectorAll('.mand-ueberf');
    for (var i = 0; i < nodes.length; i++) { nodes[i].style.display = show ? '' : 'none'; }
    /* v816c-mandanten readonly + v816g-field-polish: Felder nur ueber Wizard, dezent gesperrt */
    var _roIds = ['verkehrswert_ueberf','ueberf_preis','halter_seit','gesellschafterdarlehen','ueberf_restschuld','ueberf_rest_zins','ueberf_ende'];
    for (var _r = 0; _r < _roIds.length; _r++) {
      var _el = document.getElementById(_roIds[_r]);
      if (_el) {
        /* v816i-readonly-normal: normale Schrift (schwarz, normal), nur nicht editierbar. */
        if (show) { _el.setAttribute('readonly','readonly'); _el.style.background=''; _el.style.color=''; _el.style.opacity=''; _el.style.fontWeight=''; _el.style.cursor='not-allowed'; }
        else { _el.removeAttribute('readonly'); _el.style.background=''; _el.style.color=''; _el.style.opacity=''; _el.style.fontWeight=''; _el.style.cursor=''; }
      }
    }
    /* v816g-field-polish (b): Halter-select bei Ueberfuehrung sperren (zeigt Mandant-Namen). */
    try {
      var _hsel = document.getElementById('halter');
      if (_hsel) {
        var _endeEl2 = document.getElementById('ueberf_ende');
        var _frozen = show || !!(_endeEl2 && (_endeEl2.value || '').trim());  /* GmbH ODER eingefrorenes Privat */
        _hsel.disabled = _frozen;
        _hsel.style.opacity = _frozen ? '0.72' : '';
        _hsel.style.cursor = _frozen ? 'not-allowed' : '';
      }
    } catch (_he) {}
    try { _renderUeberfBadge(); } catch (_e) {}
    if (show) _prefillRest();  /* v813-3d */
    _calcPct();
  }
  /* v816c-mandanten: beidseitige Kennung + Rueckgaengig (GmbH + Privat). */
  function _fmtDe(d){ if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ''; var p=d.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; }
  function _renderUeberfBadge() {
    /* v816e-hide-cb-privat: Checkbox-Block je nach Objekt-Typ steuern. */
    try {
      var _herk = document.getElementById('obj_herkunft');
      var _isG = !!(_herk && _herk.value === 'ueberfuehrung');
      var _endeEl = document.getElementById('ueberf_ende');
      var _hasEnde = !!(_endeEl && (_endeEl.value || '').trim());
      var _cb = document.getElementById('mand_ueberf_cb');
      var _cbBox = _cb ? _cb.closest('.f') : null;
      if (_cbBox) {
        /* v816h-cb-only-ueberf: Checkbox NUR bei echter Ueberfuehrung (obj_herkunft=ueberfuehrung). */
        if (_isG) { _cbBox.style.display = ''; if (_cb) { _cb.checked = true; _cb.disabled = true; } }      /* GmbH-ueberfuehrt: gesetzt+gesperrt */
        else { _cbBox.style.display = 'none'; }                                                              /* alles andere (Privat, manuelle GmbH, normal): WEG */
      }
    } catch (_ce) {}
    var host = document.getElementById('mand-ueberf-badge');
    if (!host) {
      var anchor = document.getElementById('mand_ueberf_cb');
      var box = anchor ? anchor.closest('.f') : null;
      if (box && box.parentNode) {
        host = document.createElement('div'); host.id = 'mand-ueberf-badge';
        host.setAttribute('data-mand',''); host.style.cssText = 'grid-column:1/-1;display:none';
        box.parentNode.insertBefore(host, box.nextSibling);
      }
    }
    if (!host) return;
    var herk = document.getElementById('obj_herkunft');
    var isGmbh = !!(herk && herk.value === 'ueberfuehrung');
    var endeEl = document.getElementById('ueberf_ende');
    var ende = endeEl ? _fmtDe(endeEl.value) : '';
    var hasEnde = !!(endeEl && (endeEl.value || '').trim());
    var BX = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(184,98,80,.08);border:1px solid rgba(184,98,80,.35);border-radius:10px;padding:10px 13px;margin:2px 0 4px';
    var BTN = 'margin-left:auto;background:transparent;border:1px solid #B86250;color:#B86250;padding:5px 12px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit';
    if (isGmbh) {
      host.style.display = '';
      host.innerHTML = '<div style="'+BX+'"><span style="font-weight:700;color:#B86250;font-size:13px">\u2713 Aus Privatbestand \u00fcbernommen' + (ende ? ' \u00b7 l\u00e4uft bis ' + ende : '') + '</span><button type="button" onclick="if(window.DealPilotMandanten)DealPilotMandanten.undoUeberfuehrung()" style="'+BTN+'">\u00dcberf\u00fchrung aufheben</button></div>';
      return;
    }
    if (hasEnde) {
      host.style.display = '';
      host.innerHTML = '<div style="'+BX+'"><span style="font-weight:700;color:#B86250;font-size:13px">\u2708 \u00dcberf\u00fchrt in Gesellschaft' + (ende ? ' \u00b7 eingefroren am ' + ende : '') + '</span><button type="button" onclick="if(window.DealPilotMandanten)DealPilotMandanten.undoUeberfuehrungFromPrivat()" style="'+BTN+'">\u00dcberf\u00fchrung aufheben</button></div>';
      return;
    }
    host.style.display = 'none'; host.innerHTML = '';
  }
  /* Aufheben vom GmbH-Objekt aus: GmbH loeschen + Privat (via _ueberf_link) auftauen. */
  async function undoUeberfuehrung() {
    try {
      var herk = document.getElementById('obj_herkunft');
      if (!(herk && herk.value === 'ueberfuehrung')) { if (typeof toast === 'function') toast('Dieses Objekt ist keine Ueberfuehrung.'); return; }
      var gmbhKey = (typeof _currentObjKey !== 'undefined') ? _currentObjKey : window._currentObjKey;
      var linkEl = document.getElementById('_ueberf_link');
      var privatKey = linkEl ? linkEl.value : '';
      if (!window.confirm('\u00dcberf\u00fchrung aufheben?\n\nDieses GESELLSCHAFTS-Objekt wird GELOESCHT und das Privat-Objekt aufgetaut (Einfrier-Datum entfernt). Das kann nicht rueckgaengig gemacht werden.')) return;
      if (!window.Auth || !Auth.apiCall) { if (typeof toast === 'function') toast('Nicht eingeloggt.'); return; }
      if (privatKey) {
        try {
          var pObj = await Auth.apiCall('/objects/' + privatKey);
          var pData = pObj.data || {}; delete pData.ueberf_ende; delete pData._ueberf_link;
          await Auth.apiCall('/objects/' + privatKey, { method: 'PUT', body: { data: pData, aiAnalysis: pObj.ai_analysis || null, photos: pObj.photos || [] } });
        } catch (e) {}
      }
      if (gmbhKey) { await Auth.apiCall('/objects/' + gmbhKey, { method: 'DELETE' }); }
      if (typeof toast === 'function') toast('\u2713 \u00dcberf\u00fchrung aufgehoben \u2014 Gesellschafts-Objekt geloescht, Privat-Objekt aufgetaut.');
      if (privatKey && typeof loadSaved === 'function') { try { await loadSaved(privatKey); } catch (e) {} }
      try { if (typeof renderSaved === 'function') renderSaved({ _immediate: true }); } catch (e) {}
      try { if (typeof updateSidebarPortfolio === 'function') updateSidebarPortfolio(); } catch (e) {}
    } catch (err) { if (typeof toast === 'function') toast('Aufheben fehlgeschlagen: ' + (err && err.message || err)); }
  }
  /* Aufheben vom Privat-Objekt aus: GmbH (via _ueberf_link) loeschen + dieses Privat auftauen. */
  async function undoUeberfuehrungFromPrivat() {
    try {
      var privatKey = (typeof _currentObjKey !== 'undefined') ? _currentObjKey : window._currentObjKey;
      var linkEl = document.getElementById('_ueberf_link');
      var gmbhKey = linkEl ? linkEl.value : '';
      if (!window.confirm('\u00dcberf\u00fchrung aufheben?\n\nDas GESELLSCHAFTS-Objekt wird GELOESCHT und dieses Privat-Objekt aufgetaut (Einfrier-Datum entfernt). Das kann nicht rueckgaengig gemacht werden.')) return;
      if (!window.Auth || !Auth.apiCall) { if (typeof toast === 'function') toast('Nicht eingeloggt.'); return; }
      if (gmbhKey) { try { await Auth.apiCall('/objects/' + gmbhKey, { method: 'DELETE' }); } catch (e) {} }
      var ueEl = document.getElementById('ueberf_ende'); if (ueEl) ueEl.value = '';
      if (linkEl) linkEl.value = '';
      if (typeof saveObj === 'function') await saveObj({ silent: true });
      if (typeof toast === 'function') toast('\u2713 \u00dcberf\u00fchrung aufgehoben \u2014 Gesellschafts-Objekt geloescht, Privat-Objekt aufgetaut.');
      try { _renderUeberfBadge(); } catch (e) {}
      try { if (typeof renderSaved === 'function') renderSaved({ _immediate: true }); } catch (e) {}
      try { if (typeof updateSidebarPortfolio === 'function') updateSidebarPortfolio(); } catch (e) {}
      try { if (typeof calc === 'function') calc(); } catch (e) {}
    } catch (err) { if (typeof toast === 'function') toast('Aufheben fehlgeschlagen: ' + (err && err.message || err)); }
  }
  function _calcPct() {
    var out = document.getElementById('mand-ueberf-pct'); if (!out) return;
    var p = _num('ueberf_preis'), vw = _num('verkehrswert_ueberf');
    out.textContent = (vw > 0) ? ((Math.round(p / vw * 1000) / 10).toString().replace('.', ',') + ' % vom Verkehrswert') : '\u2014';
  }

  /* ===== Settings-Reiter ===== */
  var _editing = null;
  function _rerender() {
    var host = document.getElementById('mand-settings-host');
    if (host) host.innerHTML = renderSettingsTab();
    /* v841b-rerender-hook: nach dem Render die INLINE-Steuerzeitraeume-Verwaltung befuellen,
       falls der Privat-Host da ist (nur im Bearbeiten-Modus des privaten Mandanten). */
    try {
      var _tph = document.getElementById('mand-tax-periods-host');
      if (_tph && window.DealPilotTaxPeriods && typeof window.DealPilotTaxPeriods.renderInline === 'function') {
        window.DealPilotTaxPeriods.renderInline(_tph);
      }
    } catch (e) { console.warn('[v841b-rerender-hook] renderInline:', e.message); }
  }
  function renderSettingsTab() {
    if (!_isPro()) {
      /* v865-privat-frei: Der PRIVATE Halter (inkl. Steuerzeitraeume) bleibt fuer
         ALLE Plaene bearbeitbar — nur Gesellschaften (GmbH/UG) sind Pro. */
      if (_editing === 'privat') {
        return '<h2 class="set-section-h2">Mandanten</h2>' + _renderForm();
      }
      var _priv = get('privat') || { id: 'privat', name: 'Privat', rechtsform: 'privat', regime: {} };
      return ''
        + '<h2 class="set-section-h2">Mandanten</h2>'
        + '<p class="hint">Dein privater Halter — inklusive <b>Steuerzeitr\u00e4umen</b> — ist in allen Pl\u00e4nen verf\u00fcgbar. Weitere Gesellschaften (GmbH/UG) mit eigenem Steuerregime sind Teil des <b>Pro</b>-Plans.</p>'
        + '<div style="border:1px solid #ece7df;border-radius:12px;padding:13px 15px;display:flex;align-items:center;gap:12px;background:#fff;margin:14px 0">'
        +   '<div style="flex:1;min-width:0">'
        +   '<div style="display:flex;align-items:center;gap:9px;margin-bottom:3px"><strong style="font:600 15px/1.2 \'Space Grotesk\',sans-serif">' + esc(_priv.name || 'Privat') + '</strong>' + _badge('privat') + '</div>'
        +   '<div style="font-size:12px;color:#7A7370">Einkommensteuer \u00b7 \u00fcber zvE (Tab Steuer) \u00b7 Steuerzeitr\u00e4ume verwalten</div>'
        +   '</div>'
        +   '<button type="button" class="btn btn-outline btn-sm" onclick="DealPilotMandanten.uiEdit(\'privat\')">Bearbeiten</button>'
        + '</div>'
        + '<div style="margin-top:14px;padding:20px 22px;border:1px solid var(--gold,#C9A84C);border-radius:14px;background:#FAF9F4">'
        +   '<div style="font:700 13px/1 \'DM Sans\',sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#b8932f;margin-bottom:8px">Pro-Funktion</div>'
        +   '<p style="margin:0 0 14px;color:#2A2727;font-size:14px;line-height:1.55">Mit <b>Mandanten</b> h\u00e4ltst du Objekte privat <i>oder</i> in einer GmbH/UG \u2014 mit eigener K\u00f6rperschaftsteuer-Rechnung, Cockpit-Filter pro Halter und (in Vorbereitung) GuV/Bilanz-Export. Verf\u00fcgbar im <b>Pro</b>-Plan.</p>'
        +   '<button type="button" class="btn btn-gold" onclick="(function(){var b=document.querySelector(\'.st-tab[data-tab=&quot;plan&quot;]\');if(b)b.click();})()"><span class="ic"><svg width="12" height="12"><use href="#i-star"/></svg></span>Pro freischalten</button>'
        + '</div>';
    }
    return _editing ? _renderForm() : _renderList();
  }

  function _badge(rf) {
    var col = rf === 'privat' ? '#3FA56C' : (rf === 'gmbh' ? '#C9A84C' : (rf === 'ug' ? '#B86250' : '#7A7370'));
    return '<span style="font:600 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.8px;text-transform:uppercase;'
      + 'padding:3px 8px;border-radius:999px;border:1px solid ' + col + ';color:' + col + '">' + esc(rf) + '</span>';
  }

  function _renderList() {
    var cards = _state.list.map(function (m) {
      var canDel = m.id !== 'privat';
      var reg = m.regime || {};
      var sub = isCorp(m.rechtsform)
        ? ('K\u00f6rperschaftsteuer ' + (reg.kst != null ? reg.kst : 15.825).toString().replace('.', ',') + ' %'
           + (reg.erw_kuerzung ? ' \u00b7 erw. K\u00fcrzung' : (reg.gewst ? ' \u00b7 GewSt ' + reg.gewst + ' %' : '')))
        : (m.rechtsform === 'gbr' ? 'Personengesellschaft \u00b7 transparent (ESt der Gesellschafter)'
                                  : 'Einkommensteuer \u00b7 \u00fcber zvE (Tab Steuer)');
      return '<div style="border:1px solid #ece7df;border-radius:12px;padding:13px 15px;display:flex;align-items:center;gap:12px;background:#fff">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:9px;margin-bottom:3px"><strong style="font:600 15px/1.2 \'Space Grotesk\',sans-serif">' + esc(m.name) + '</strong>' + _badge(m.rechtsform) + '</div>'
        + '<div style="font-size:12px;color:#7A7370">' + sub + '</div>'
        + '</div>'
        + '<button type="button" class="btn btn-outline btn-sm" onclick="DealPilotMandanten.uiEdit(\'' + m.id + '\')">Bearbeiten</button>'
        + (canDel ? '<button type="button" class="btn btn-outline btn-sm" style="color:#B86250;border-color:#e6cbc5" onclick="DealPilotMandanten.uiDelete(\'' + m.id + '\')">L\u00f6schen</button>' : '')
        + '</div>';
    }).join('');

    return ''
      + '<h2 class="set-section-h2">Mandanten</h2>'
      + '<p class="hint">Lege fest, wer ein Objekt h\u00e4lt \u2014 Privat oder eine Gesellschaft (GmbH/UG). Jedes Objekt bekommt im Tab "Objektdaten" einen <b>Halter</b>. '
      + 'Privat l\u00e4uft \u00fcber dein zu versteuerndes Einkommen (Tab Steuer). Bei GmbH/UG gibst du das Steuerregime + Buchhaltungs-Stammwerte an \u2014 die werden in einer n\u00e4chsten Ausbaustufe aktiv (eigene Steuerrechnung + GuV/Bilanz-Export). '
      + 'Privat bleibt der Standard.</p>'
      + '<div style="display:grid;gap:11px;margin:16px 0">' + cards + '</div>'
      + '<button type="button" class="btn btn-gold" onclick="DealPilotMandanten.uiNew()"><span class="ic">+</span> Neuer Mandant</button>'
      /* v856-uew: Ueberfuehrung direkt aus den Mandanten heraus (mit Objekt-Auswahl) */
      + '<hr class="dvd"><h3 class="set-section-h">In Gesellschaft \u00fcberf\u00fchren</h3>'
      + '<p class="hint">Privat-Objekt einfrieren + neues GmbH-Objekt anlegen (Werte, Fotos, KI \u00fcbernommen). W\u00e4hle zuerst das Objekt.</p>'
      + '<button type="button" class="btn btn-gold" onclick="DealPilotMandanten.openUeberfuehrung()">\u2708 \u00dcberf\u00fchrung starten</button>'
      + '<div id="mand-uew-picker" style="margin-top:12px"></div>';
  }

  function _fGrid() { return 'display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin:14px 0'; }

  function _renderForm() {
    var isNew = _editing === 'NEW';
    var m = isNew ? { rechtsform: 'gmbh', regime: {}, bh: {} } : (get(_editing) || { regime: {}, bh: {} });
    var reg = m.regime || {}, bh = m.bh || {};
    var locked = !!m._locked;
    var rf = m.rechtsform || 'gmbh';
    var corp = isCorp(rf);

    function rfOpts() {
      var src = locked ? RF : RF.filter(function (r) { return RF_NEW.indexOf(r.v) >= 0; });
      return src.map(function (r) { return '<option value="' + r.v + '"' + (rf === r.v ? ' selected' : '') + '>' + r.t + '</option>'; }).join('');
    }
    function krOpts() { return KR.map(function (k) { return '<option value="' + k + '"' + ((bh.kontenrahmen || 'SKR04') === k ? ' selected' : '') + '>' + k + '</option>'; }).join(''); }
    function fld(label, inner) { return '<div class="f"><label>' + label + '</label>' + inner + '</div>'; }
    function fldH(label, inner, hint) { return '<div class="f"><label>' + label + '</label>' + inner + (hint ? '<div class="mand-fhint" style="margin-top:5px;font-size:11.5px;color:#7A7370;line-height:1.45">' + hint + '</div>' : '') + '</div>'; }
    function inp(id, val, ph) { return '<input id="' + id + '" type="text" value="' + esc(val == null ? '' : val) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '>'; }
    function chk(id, on, lbl) { return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + lbl + '</label>'; }

    var corpBlock =
        '<div id="mand-corp-only" style="display:' + (corp ? 'block' : 'none') + '">'
      +   '<hr class="dvd" style="margin:18px 0 6px">'
      +   '<h3 class="set-section-h">Steuerregime <span style="font-weight:400;color:#7A7370;font-size:12px">\u00b7 wird in Stufe 2 aktiv</span></h3>'
      +   '<div style="' + _fGrid() + '">'
      +     fldH('K\u00f6rperschaftsteuer + Soli (%)', inp('mand-f-kst', reg.kst != null ? reg.kst : 15.825), 'Satz, mit dem der Gewinn der Gesellschaft besteuert wird: 15 % K\u00f6rperschaftsteuer + 5,5 % Solidarit\u00e4tszuschlag darauf = 15,825 %.')
      +     fldH('Gewerbesteuer-Hebesatz (%)', inp('mand-f-gewst', reg.gewst != null ? reg.gewst : 0), 'Hebesatz deiner Gemeinde (z.B. 400). Nur relevant, wenn die erweiterte K\u00fcrzung NICHT greift. Bei reiner Vermietung mit K\u00fcrzung 0 lassen.')
      +   '</div>'
      +   '<div style="margin:6px 0 0">'
      +     chk('mand-f-kuerz', reg.erw_kuerzung !== false, 'Erweiterte Gewerbesteuer-K\u00fcrzung (\u00a7 9 GewStG) \u2014 GewSt = 0')
      +     '<div class="mand-fhint" style="margin-top:5px;font-size:11.5px;color:#7A7370;line-height:1.45">Reine Grundst\u00fccksverwaltung (nur Vermietung, kein gewerblicher Handel) kann die Gewerbesteuer auf 0 k\u00fcrzen. Aktiv lassen, wenn die Gesellschaft ausschlie\u00dflich vermietet.</div>'
      +   '</div>'
      +   '<hr class="dvd" style="margin:18px 0 6px">'
      +   '<h3 class="set-section-h">Buchhaltung <span style="font-weight:400;color:#7A7370;font-size:12px">\u00b7 f\u00fcr GuV/Bilanz-Export (Stufe 3)</span></h3>'
      +   '<div class="mand-fhint" style="margin:2px 0 12px;font-size:12px;color:#7A7370;line-height:1.5">Diese Werte bilden die <b>Er\u00f6ffnungsbilanz</b> der Gesellschaft und sind sp\u00e4ter Basis f\u00fcr GuV-/Bilanz- und DATEV-Export. F\u00fcr die laufende Rendite- und Steuerrechnung sind sie nicht n\u00f6tig \u2014 nur f\u00fcrs Reporting. Im Zweifel mit dem Steuerberater abstimmen.</div>'
      +   '<div style="' + _fGrid() + '">'
      +     fldH('Kontenrahmen', '<select id="mand-f-kr">' + krOpts() + '</select>', 'Buchhaltungs-Kontenrahmen f\u00fcr GuV/Bilanz. SKR04 ist der Standard f\u00fcr Kapitalgesellschaften (DATEV).')
      +     fldH('Wirtschaftsjahr-Beginn (MM-TT)', inp('mand-f-wj', bh.wj_start || '01-01', '01-01'), 'Beginn des Gesch\u00e4ftsjahres. Meist 01-01 (Kalenderjahr). Abweichend nur, wenn im Gesellschaftsvertrag so festgelegt.')
      +     fldH('Stammkapital (\u20ac)', inp('mand-f-sk', bh.stammkapital || 0), 'Gezeichnetes Kapital laut Gesellschaftsvertrag \u2014 GmbH mind. 25.000 \u20ac, UG ab 1 \u20ac. Steht als Eigenkapital in der Er\u00f6ffnungsbilanz.')
      +     fldH('Er\u00f6ffnung Bank (\u20ac)', inp('mand-f-bank', bh.eb_bank || 0), 'Bankguthaben der Gesellschaft zum Start des Wirtschaftsjahres (Anfangsbestand des Bankkontos).')
      +     fldH('Er\u00f6ffnung Gesellschafterdarlehen (\u20ac)', inp('mand-f-gesdar', bh.eb_gesdar || 0), 'Stand der Darlehen, die du der Gesellschaft als Gesellschafter gegeben hast \u2014 Fremdkapital der GmbH (deine Forderung). Tilgung mindert den Gewinn nicht, nur die Zinsen.')
      +     fldH('Gewinnvortrag (\u20ac)', inp('mand-f-gv', bh.eb_gewinnvortrag || 0), 'Aufgelaufener, noch nicht ausgesch\u00fctteter Gewinn aus Vorjahren (Anfangsbestand). Bei einer neu gegr\u00fcndeten Gesellschaft 0.')
      +   '</div>'
      + '</div>';

    /* v841-zve-host: Privat -> echte INLINE-Steuerzeitraeume-Verwaltung (DB-gebunden). */
    var transHint =
        '<div id="mand-transparent-hint" style="display:' + (corp ? 'none' : 'block') + '">'
      +   '<div style="margin-top:16px;padding:13px 15px;background:#FAF9F4;border:1px solid rgba(201,168,76,.25);border-radius:10px;font-size:12.5px;color:#2A2727;line-height:1.5;margin-bottom:14px">'
      +     '<b>Privatverm\u00f6gen</b> wird \u00fcber dein <b>zu versteuerndes Einkommen (zvE)</b> besteuert \u2014 gilt f\u00fcr alle privaten Objekte. Pflege die Zeitr\u00e4ume hier:'
      +   '</div>'
      +   '<div id="mand-tax-periods-host"></div>'
      + '</div>';

    return ''
      + '<h2 class="set-section-h2">' + (isNew ? 'Neuer Mandant' : 'Mandant bearbeiten') + '</h2>'
      + '<input type="hidden" id="mand-f-id" value="' + esc(m.id || '') + '">'
      + '<div style="' + _fGrid() + '">'
      +   fld('Name', inp('mand-f-name', m.name, 'z.B. Junker VV GmbH'))
      +   fld('Rechtsform', '<select id="mand-f-rf"' + (locked ? ' disabled' : ' onchange="DealPilotMandanten.uiToggleRf()"') + '>' + rfOpts() + '</select>' + (locked ? '<span class="hint">Privat ist fix.</span>' : ''))
      + '</div>'
      + transHint
      + corpBlock
      /* v827-back-btn: Zurueck-Button (uiCancel) - Rueckkehr zur Uebersicht. Speichern via unterem Global-Button. */
      + '<div style="margin-top:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
      +   '<button type="button" class="btn btn-outline btn-sm" onclick="DealPilotMandanten.uiCancel()"><span class="ic">\u2190</span> Zur\u00fcck zur \u00dcbersicht</button>'
      +   '<span style="font-size:12px;color:#7A7370">\u00c4nderungen werden mit \u201eSpeichern\u201c unten \u00fcbernommen.</span>'
      + '</div>';
  }

  function uiToggleRf() {
    var sel = document.getElementById('mand-f-rf'); if (!sel) return;
    var corp = isCorp(sel.value);
    var c = document.getElementById('mand-corp-only'); if (c) c.style.display = corp ? 'block' : 'none';
    var h = document.getElementById('mand-transparent-hint'); if (h) h.style.display = corp ? 'none' : 'block';
  }

  function uiNew() { _editing = 'NEW'; _rerender(); }
  function uiEdit(id) { _editing = id; _rerender(); }
  function uiCancel() { _editing = null; _rerender(); }
  function uiDelete(id) {
    var m = get(id);
    if (window.confirm('Mandant "' + (m ? m.name : id) + '" l\u00f6schen? Objekte mit diesem Halter fallen auf "Privat" zur\u00fcck.')) {
      remove(id); _editing = null; _rerender();
    }
  }
  function _val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function _chk(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  function _toN(s) { var n = parseFloat(('' + s).replace(',', '.').replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }

  function uiSave() {
    var id = _val('mand-f-id');
    var locked = id === 'privat';
    var rf = locked ? 'privat' : (_val('mand-f-rf') || 'gmbh');
    var m = { id: id || null, name: _val('mand-f-name').trim() || 'Mandant', rechtsform: rf };
    if (isCorp(rf)) {
      m.regime = { kst: _toN(_val('mand-f-kst')), gewst: _toN(_val('mand-f-gewst')), erw_kuerzung: _chk('mand-f-kuerz') };
      m.bh = {
        kontenrahmen: _val('mand-f-kr') || 'SKR04',
        wj_start: _val('mand-f-wj') || '01-01',
        stammkapital: _toN(_val('mand-f-sk')),
        eb_bank: _toN(_val('mand-f-bank')),
        eb_gesdar: _toN(_val('mand-f-gesdar')),
        eb_gewinnvortrag: _toN(_val('mand-f-gv'))
      };
    } else {
      m.regime = {}; m.bh = {};
    }
    if (locked) m._locked = true;
    upsert(m); _editing = null; _rerender();
  }
  /* v826-mand-dedup: EINE uiSaveIfOpen (v818+v819-Doppelung entfernt). Speichert nur, wenn
     der Editor offen ist UND es sich NICHT um einen leeren neuen Mandant handelt
     (verhindert versehentliches Anlegen leerer Mandanten + Editor-Verlust). */
  function uiSaveIfOpen() {
    try {
      if (!document.getElementById('mand-f-id')) return false;
      /* Bei NEU (mand-f-id leer): nur speichern, wenn wirklich ein Name eingegeben wurde. */
      var _idEl = document.getElementById('mand-f-id');
      var _isNew = !_idEl || !String(_idEl.value || '').trim();
      if (_isNew) {
        var _nmEl = document.getElementById('mand-f-name');
        var _nm = _nmEl ? String(_nmEl.value || '').trim() : '';
        if (!_nm) return false;   /* leerer neuer Mandant -> NICHT anlegen */
      }
      uiSave(); return true;
    } catch (e) {}
    return false;
  }

  /* ===== Init ===== */
  function init() {
    renderHalterOptions();
    wireObjectFields();
    _applyGate();
    if (window.loadSaved && !window._mandLoadWrapped) {
      window._mandLoadWrapped = true;
      var _ol = window.loadSaved;
      window.loadSaved = function () {
        var r = _ol.apply(this, arguments);
        try { setTimeout(function () { renderHalterOptions(); _syncUeberf(); _applyGate(); }, 60); } catch (e) {}
        return r;
      };
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

  /* v816d-sync-after-load: nach Objekt-Laden Haken + Kennung synchronisieren. */
  function syncAfterLoad() {
    try { wireObjectFields(); } catch (e) {}   /* idempotent (mandWired-Guards) -> registriert Events + ruft _syncUeberf */
    try { _syncUeberf(); } catch (e) {}        /* sicherstellen: Haken/Kennung/read-only aktuell */
  }
  /* v856-uew-picker: Objekt waehlen -> laden -> Ueberfuehrungs-Wizard oeffnen */
  function openUeberfuehrung() {
    var host = document.getElementById('mand-uew-picker');
    if (!host) return;
    if (!window.Auth || typeof window.Auth.apiCall !== 'function') { host.innerHTML = '<div style="color:#B86250;font-size:13px">Bitte neu einloggen.</div>'; return; }
    host.innerHTML = '<div style="color:#7A7370;font-size:13px">Objekte laden \u2026</div>';
    window.Auth.apiCall('/objects', { method: 'GET' }).then(function (r) {
      var items = (r && (r.objects || r.items)) || [];
      if (!items.length) { host.innerHTML = '<div style="color:#7A7370;font-size:13px">Keine Objekte vorhanden.</div>'; return; }
      /* v857-uew-liste: DealPilot-Stil (Monogramm, Adresse, Ort, Kaufpreis) — INLINE-Styles */
      host.innerHTML = '<div style="display:grid;gap:8px;max-height:320px;overflow:auto;padding-right:2px">' + items.map(function (o) {
        var d = o.data || {};
        var label = [d.str, d.hnr].filter(Boolean).join(' ') || o.name || ('Objekt ' + o.id);
        var ort = [d.plz, d.ort].filter(Boolean).join(' ');
        var kp = d.kp ? (String(d.kp) + ' \u20ac') : '';
        var subline = [ort, kp].filter(Boolean).join(' \u00b7 ');
        var kz = (d.kuerzel || '').toString().toUpperCase() || label.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'OB';
        return '<button type="button" onclick="DealPilotMandanten._uewPick(\'' + String(o.id).replace(/'/g, '') + '\', this)" '
          + 'style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:11px 13px;border:1px solid #ece7df;border-radius:12px;background:#fff;cursor:pointer;font-family:inherit;transition:border-color .15s">'
          + '<span style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#E8CC7A,#b8932f);color:#1a1508;display:inline-flex;align-items:center;justify-content:center;font:700 12px \'Space Grotesk\',sans-serif;flex-shrink:0;letter-spacing:.5px">' + esc(kz) + '</span>'
          + '<span style="flex:1;min-width:0"><b style="display:block;font:600 14px/1.25 \'Space Grotesk\',sans-serif;color:#2A2727;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(label) + '</b>'
          + (subline ? '<span style="font-size:12px;color:#7A7370">' + esc(subline) + '</span>' : '')
          + '</span>'
          + '<span style="color:#b8932f;font:700 15px sans-serif;flex-shrink:0">\u2192</span></button>';
      }).join('') + '</div>';
    }).catch(function () { host.innerHTML = '<div style="color:#B86250;font-size:13px">Objekte konnten nicht geladen werden.</div>'; });
  }
  function _uewPick(objId, btn) {
    if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
    var open = function () {
      try { if (typeof closeSettings === 'function') closeSettings(); } catch (e) {}
      setTimeout(function () {
        if (window.DealPilotUeberfuehrung && typeof DealPilotUeberfuehrung.open === 'function') DealPilotUeberfuehrung.open();
      }, 350);
    };
    if (window._currentObjKey === objId) { open(); return; }
    /* Objekt via Sidebar-Karte laden (gleicher Weg wie ein Klick des Nutzers) */
    var clicked = false;
    try {
      var cards = document.querySelectorAll('#sb-list .sb-card');
      for (var i = 0; i < cards.length; i++) {
        var k = cards[i].getAttribute('data-key') || cards[i].getAttribute('data-id') || '';
        if (k === objId) { cards[i].click(); clicked = true; break; }
      }
    } catch (e) {}
    if (!clicked) {
      if (typeof toast === 'function') toast('Bitte das Objekt links in der Sidebar \u00f6ffnen \u2014 der Wizard startet dann.');
    }
    /* v953-objready
     * ────────────────────────────────────────────────────────────────────────
     * Bis v952 stand hier setInterval alle 250 ms, nach 16 Versuchen Aufgabe.
     * Bei einem langsamen Objekt (grosses Portfolio, schwache Leitung) war nach
     * 4 s Schluss und der Wizard startete nicht — ohne dass jemand erfuhr warum.
     * Genau das Muster, gegen das v946 den Vertrag gebaut hat:
     *   storage.js feuert dp:object-ready, sobald _currentObjKey wirklich steht.
     * "Timer und Retry-Schleifen gewinnt man nie zuverlaessig."
     *
     * Die Notbremse bleibt, aber grosszuegig und mit Ansage: sie faengt den Fall,
     * dass das Objekt gar nicht laedt (Klick ging ins Leere) — nicht ein Rennen.
     */
    var _fertig = false;
    function _onReady(e) {
      if (_fertig) return;
      if (!e || !e.detail || e.detail.key !== objId) return;
      _fertig = true;
      window.removeEventListener('dp:object-ready', _onReady);
      clearTimeout(_bremse);
      open();
    }
    window.addEventListener('dp:object-ready', _onReady);
    /* Schon da? Dann feuert kein Event mehr. */
    if (window._currentObjKey === objId) { _fertig = true; window.removeEventListener('dp:object-ready', _onReady); open(); }
    var _bremse = setTimeout(function () {
      if (_fertig) return;
      _fertig = true;
      window.removeEventListener('dp:object-ready', _onReady);
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      if (typeof toast === 'function') toast('\u26a0 Objekt konnte nicht geladen werden \u2014 bitte links in der Sidebar \u00f6ffnen.');
    }, 20000);
  }

  window.DealPilotMandanten = {
    openUeberfuehrung: openUeberfuehrung, _uewPick: _uewPick,  /* v856-uew */
    getList: getList, get: get, upsert: upsert, remove: remove, rfLabel: rfLabel, isCorp: isCorp,
    renderHalterOptions: renderHalterOptions, renderHalterChips: renderHalterChips,
    setFilter: setFilter, filterByHalter: filterByHalter, effRate: effRate, wireObjectFields: wireObjectFields,
    renderSidebarChips: renderSidebarChips, _toggleMandMenu: _toggleMandMenu, onUeberfToggle: onUeberfToggle, undoUeberfuehrung: undoUeberfuehrung, undoUeberfuehrungFromPrivat: undoUeberfuehrungFromPrivat,  syncAfterLoad: syncAfterLoad,  /* v816d-export */
    renderSettingsTab: renderSettingsTab,
    uiSaveIfOpen: uiSaveIfOpen,   /* v826 (dedup) */
    uiNew: uiNew, uiEdit: uiEdit, uiCancel: uiCancel, uiSave: uiSave, uiDelete: uiDelete, uiToggleRf: uiToggleRf
  };
})();
