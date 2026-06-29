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
    var cur = sel.value;
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
  function setFilter(id) {
    window._dpHalterFilter = id;
    if (window.DealPilotDashboard && DealPilotDashboard.applyHalterFilter) { DealPilotDashboard.applyHalterFilter(id); }
    renderHalterChips();
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
    if (herk && !herk._mandWired) { herk._mandWired = true; herk.addEventListener('change', _syncUeberf); }
    ['ueberf_preis', 'verkehrswert_ueberf'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el._mandWired) { el._mandWired = true; el.addEventListener('input', _calcPct); }
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
  function _syncUeberf() {
    var herk = document.getElementById('obj_herkunft');
    var show = !!(herk && herk.value === 'ueberfuehrung');
    var nodes = document.querySelectorAll('.mand-ueberf');
    for (var i = 0; i < nodes.length; i++) { nodes[i].style.display = show ? '' : 'none'; }
    _calcPct();
  }
  function _calcPct() {
    var out = document.getElementById('mand-ueberf-pct'); if (!out) return;
    var p = _num('ueberf_preis'), vw = _num('verkehrswert_ueberf');
    out.textContent = (vw > 0) ? ((Math.round(p / vw * 1000) / 10).toString().replace('.', ',') + ' % vom Verkehrswert') : '\u2014';
  }

  /* ===== Settings-Reiter ===== */
  var _editing = null;
  function _rerender() { var host = document.getElementById('mand-settings-host'); if (host) host.innerHTML = renderSettingsTab(); }
  function renderSettingsTab() {
    if (!_isPro()) {
      return ''
        + '<h2 class="set-section-h2">Mandanten</h2>'
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
      + '<button type="button" class="btn btn-gold" onclick="DealPilotMandanten.uiNew()"><span class="ic">+</span> Neuer Mandant</button>';
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

    var transHint =
        '<div id="mand-transparent-hint" style="display:' + (corp ? 'none' : 'block') + '">'
      +   '<div style="margin-top:16px;padding:13px 15px;background:#FAF9F4;border:1px solid rgba(201,168,76,.25);border-radius:10px;font-size:13px;color:#2A2727;line-height:1.5">'
      +     '<b>Keine separaten Steuerangaben n\u00f6tig.</b> Privatverm\u00f6gen wird \u00fcber dein <b>zu versteuerndes Einkommen</b> besteuert \u2014 zvE / Grenzsteuersatz pflegst du im Tab <b>Steuer</b> beim Objekt. '
      +     'Kein Kontenrahmen, keine Er\u00f6ffnungsbilanz.'
      +   '</div>'
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
      + '<div style="display:flex;gap:10px;margin-top:20px">'
      +   '<button type="button" class="btn btn-gold" onclick="DealPilotMandanten.uiSave()"><span class="ic">\u2713</span> Speichern</button>'
      +   '<button type="button" class="btn btn-outline" onclick="DealPilotMandanten.uiCancel()">Abbrechen</button>'
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

  window.DealPilotMandanten = {
    getList: getList, get: get, upsert: upsert, remove: remove, rfLabel: rfLabel, isCorp: isCorp,
    renderHalterOptions: renderHalterOptions, renderHalterChips: renderHalterChips,
    setFilter: setFilter, filterByHalter: filterByHalter, effRate: effRate, wireObjectFields: wireObjectFields,
    renderSettingsTab: renderSettingsTab,
    uiNew: uiNew, uiEdit: uiEdit, uiCancel: uiCancel, uiSave: uiSave, uiDelete: uiDelete, uiToggleRf: uiToggleRf
  };
})();
