/* ============================================================================
   DealPilot v855 – admin-network.js  (ersetzt v854-Stand, additiv geladen)
   Karten-Designer fuer Netzwerk-Partnerkarten:
     - KATEGORIEN frei anlegen/umbenennen/faerben/loeschen (Rails im Tab)
     - Logo per BILD-UPLOAD (client-seitig verkleinert) ODER URL,
       mit ZOOM- und POSITIONS-Reglern (X/Y)
     - HINTERGRUND: 6 Presets + eigene Farbe + BILD-UPLOAD
     - Abrisskante (4 Stile) + Kantenfarbe (oder automatisch = Akzent)
     - Website, USP, Antwortzeit, Geprueft-Badge, CTA-Text, CTA-Verhalten
       (Standard-Lead / Gutachten-Modal), Mitgabe, Anforderungen, Ziel-E-Mail
     - Karten DURCHTAUSCHEN (Pfeile in der Liste, tauscht sortierung)
     - Live-Boarding-Pass-Vorschau
   CRUD: /api/v1/admin/network-cards + /api/v1/admin/network-categories
   ============================================================================ */
(function () {
  'use strict';
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

  var BG_OPTS = [
    ['weiss', 'Weiss (Standard)'], ['creme', 'Creme'], ['obsidian', 'Obsidian (dunkel)'],
    ['goldtint', 'Gold-Tint (Featured)'], ['accgrad', 'Akzent-Verlauf'], ['muster', 'Feines Muster'],
    ['custom', 'Eigene Farbe \u2026'], ['bild', 'Eigenes Bild \u2026']
  ];
  var KANTE_OPTS = [['k1', 'Klassik (gestrichelt)'], ['k2', 'Zackenkante'], ['k3', 'Perforation'], ['k4', 'Welle']];
  var MIT_DEFS = [
    ['objekt', 'Objekt (Adresse + Referenz)'], ['eckdaten', 'Eckdaten (KP, Wfl, DSCR, LTV)'],
    ['kontakt', 'Kontakt-E-Mail des Nutzers'], ['dr_persoenlich', 'Link Datenraum pers\u00f6nlich'],
    ['dr_objekt', 'Link Datenraum Objekt']
  ];
  var ANF_DEFS = [
    ['readycheck100', 'Grundfelder-Check 100 %'], ['dr_objekt', 'Datenraum Objekt verkn\u00fcpft'],
    ['dr_persoenlich', 'Datenraum pers\u00f6nlich verkn\u00fcpft']
  ];

  var _cards = [];
  var _cats = [];
  var _editId = null;
  var _logoData = '';   // Bild-Upload (dataURL) oder ''
  var _bgData = '';     // Hintergrund-Bild (dataURL) oder ''

  /* ── Bild-Helfer: Datei -> verkleinerte dataURL ── */
  function _fileToDataUrl(file, maxPx, asJpeg, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        var f = Math.min(1, maxPx / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * f)), ch = Math.max(1, Math.round(h * f));
        var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        if (asJpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); }
        ctx.drawImage(img, 0, 0, cw, ch);
        cb(asJpeg ? cv.toDataURL('image/jpeg', 0.78) : cv.toDataURL('image/png'));
      };
      img.onerror = function () { _toast('Bild konnte nicht gelesen werden', 'error'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function _injectCss() {
    if (document.getElementById('adn-css')) return;
    var css = [
      '#view-network .adn-wrap{display:grid;grid-template-columns:1fr 460px;gap:20px;align-items:start}',
      '@media(max-width:1150px){#view-network .adn-wrap{grid-template-columns:1fr}}',
      '#view-network .adn-card{background:#fff;border:1px solid #e7e1d4;border-radius:12px;padding:18px}',
      '#view-network .adn-sec{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9a7f33;margin:16px 0 8px;padding-top:12px;border-top:1px dashed #e7e1d4}',
      '#view-network .adn-sec:first-child{margin-top:0;padding-top:0;border-top:none}',
      '#view-network .adn-field{margin-bottom:11px}',
      '#view-network .adn-field label{display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:4px}',
      '#view-network .adn-field input,#view-network .adn-field select,#view-network .adn-field textarea{width:100%;padding:8px 10px;border:1px solid #d8d2c6;border-radius:7px;font:inherit;font-size:13px;box-sizing:border-box}',
      '#view-network .adn-field input[type=range]{padding:0}',
      '#view-network .adn-field textarea{min-height:60px;resize:vertical}',
      '#view-network .adn-row2{display:grid;grid-template-columns:1fr 1fr;gap:11px}',
      '#view-network .adn-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}',
      '#view-network .adn-check{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#444;padding:4px 0}',
      '#view-network .adn-check input{width:auto}',
      '#view-network .adn-rangelbl{display:flex;justify-content:space-between;font-size:11px;color:#888}',
      '#view-network .adn-imgbtns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '#view-network .adn-actions{display:flex;gap:8px;margin-top:14px}',
      '#view-network .adn-btn{background:#C9A84C;color:#1a1508;border:none;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:13px}',
      '#view-network .adn-btn.sec{background:#f0ece2;color:#555}',
      '#view-network .adn-btn.del{background:#B86250;color:#fff;padding:6px 12px;font-size:12px}',
      '#view-network .adn-btn.min{padding:6px 12px;font-size:12px}',
      '#view-network .adn-btn.mini{padding:4px 9px;font-size:12px;line-height:1}',
      '#view-network .adn-list{margin-top:20px}',
      '#view-network .adn-litem{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #eee;border-radius:9px;margin-bottom:8px;background:#fff;flex-wrap:wrap}',
      '#view-network .adn-badge{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 8px;border-radius:5px;background:#f0ece2;color:#9a7f33}',
      '#view-network .adn-badge.off{background:#f6d9d3;color:#8a3b2c}',
      '#view-network .adn-badge.lock{background:#efe9db;color:#6f6555}',
      '#view-network .adn-leads{font-size:11px;color:#888;font-family:monospace}',
      '#view-network .adn-move{display:flex;flex-direction:column;gap:2px}',
      '#view-network .adn-move button{border:1px solid #ddd;background:#faf8f3;border-radius:5px;cursor:pointer;font-size:10px;line-height:1;padding:3px 7px;color:#9a7f33}',
      '#view-network .adn-move button:hover{background:#f0ece2}',
      '#view-network .adn-cats{margin-bottom:14px}',
      '#view-network .adn-catrow{display:flex;gap:8px;align-items:center;margin-bottom:7px;flex-wrap:wrap}',
      '#view-network .adn-catrow input[type=text]{flex:1;min-width:140px;padding:7px 9px;border:1px solid #d8d2c6;border-radius:7px;font-size:12.5px}',
      '#view-network .adn-catrow input[type=color]{width:42px;height:34px;padding:2px;border:1px solid #d8d2c6;border-radius:7px}',
      '#view-network .adn-catrow input[type=number]{width:64px;padding:7px 6px;border:1px solid #d8d2c6;border-radius:7px;font-size:12.5px}',
      '#view-network .adn-catrow .cnt{font-size:11px;color:#999;font-family:monospace;min-width:56px}',
      '#view-network .adn-prev{position:sticky;top:12px}',
      '#view-network .adn-prev-t{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9a7f33;margin-bottom:10px}',
      /* Vorschau-Karte */
      '#view-network .pv{position:relative;width:100%;max-width:470px;display:flex;background:var(--bpbg,#fff);color:#2A2727;border:1px solid rgba(201,168,76,.24);border-radius:15px;overflow:hidden;box-shadow:0 4px 16px rgba(42,39,39,.1)}',
      '#view-network .pv-l{flex:1;padding:16px;display:flex;flex-direction:column;min-width:0}',
      '#view-network .pv-top{display:flex;align-items:center;gap:11px;margin-bottom:10px}',
      '#view-network .pv-logo{width:92px;height:92px;border-radius:14px;flex-shrink:0;overflow:hidden;border:1px solid rgba(42,39,39,.1);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-family:sans-serif;font-size:30px}',
      '#view-network .pv-logo img{width:100%;height:100%;object-fit:cover;background:#fff}',
      '#view-network .pv-name{font-size:14px;font-weight:700;line-height:1.15;display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-family:sans-serif}',
      '#view-network .pv-ver{display:inline-flex;align-items:center;gap:3px;font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#3FA56C;background:rgba(63,165,108,.1);border:1px solid rgba(63,165,108,.3);border-radius:99px;padding:2px 7px}',
      '#view-network .pv-role{font-size:10.5px;color:var(--pvmut,#7A7370);margin-top:2px}',
      '#view-network .pv-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px}',
      '#view-network .pv-tag{font-family:monospace;font-size:9px;padding:2px 7px;border-radius:5px;background:var(--pvtag,#F8F6F1);color:var(--pvtagfg,#9a7f33);border:1px solid rgba(201,168,76,.22);white-space:nowrap}',
      '#view-network .pv-desc{font-size:11.5px;color:var(--pvmut,#7A7370);line-height:1.5;flex:1;margin-bottom:9px}',
      '#view-network .pv-web{display:inline-flex;align-items:center;gap:5px;font-family:monospace;font-size:9.5px;color:#9a7f33;margin-bottom:8px}',
      '#view-network .pv-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px;flex-wrap:wrap}',
      '#view-network .pv-usp{font-size:10px;font-weight:700;font-family:sans-serif}',
      '#view-network .pv-resp{display:inline-flex;align-items:center;gap:4px;font-family:monospace;font-size:9.5px;color:#3FA56C;background:rgba(63,165,108,.09);border-radius:5px;padding:2px 7px}',
      '#view-network .pv-req{background:var(--pvreq,#F8F6F1);border:1px solid rgba(201,168,76,.22);border-radius:9px;padding:9px 11px;margin-bottom:11px}',
      '#view-network .pv-req .t{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9a7f33;margin-bottom:5px}',
      '#view-network .pv-req ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}',
      '#view-network .pv-req li{font-size:10.5px;color:var(--pvmut,#7A7370);display:flex;align-items:center;gap:6px}',
      '#view-network .pv-cta{border:none;border-radius:9px;padding:9px 10px;background:linear-gradient(110deg,var(--acc),color-mix(in srgb,var(--acc) 70%,#000));color:#fff;display:flex;flex-direction:column;align-items:center;gap:1px;font-family:sans-serif;cursor:default;width:100%}',
      '#view-network .pv-cta .t{font-size:12.5px;font-weight:700}#view-network .pv-cta .s{font-size:9px;opacity:.85}',
      '#view-network .pv-edge{position:relative;width:0;flex-shrink:0}',
      '#view-network .pv-edge-k1{border-left:2px dashed var(--kante,rgba(42,39,39,.16))}',
      '#view-network .pv-edge-k2{width:9px;background:var(--kante,var(--acc));-webkit-mask:conic-gradient(from 120deg at 100% 50%,#000 0 120deg,transparent 0) 0 0/100% 9px repeat-y;mask:conic-gradient(from 120deg at 100% 50%,#000 0 120deg,transparent 0) 0 0/100% 9px repeat-y;opacity:.9}',
      '#view-network .pv-edge-k3{width:10px;background-image:radial-gradient(circle at 50% 50%,#fff 2.6px,transparent 2.7px),linear-gradient(var(--kante,rgba(42,39,39,.10)),var(--kante,rgba(42,39,39,.10)));background-size:10px 12px,1.5px 100%;background-position:0 0,center;background-repeat:repeat-y,no-repeat}',
      '#view-network .pv-edge-k4{width:9px;background:var(--kante,var(--acc));-webkit-mask:radial-gradient(circle at 0 50%,transparent 4.5px,#000 5px) 0 0/9px 13px repeat-y;mask:radial-gradient(circle at 0 50%,transparent 4.5px,#000 5px) 0 0/9px 13px repeat-y;opacity:.85}',
      '#view-network .pv-stub{width:58px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;background:var(--pvstub,#F8F6F1);color:var(--acc)}',
      '#view-network .pv-code{writing-mode:vertical-rl;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:2.5px}',
      '#view-network .pv-barcode{width:26px;height:44px;background:repeating-linear-gradient(0deg,var(--bar,#2A2727) 0 1.5px,transparent 1.5px 3px,var(--bar,#2A2727) 3px 5.5px,transparent 5.5px 7px);opacity:.55;border-radius:2px}',
      '#view-network .pv-lbl{writing-mode:vertical-rl;font-size:7.5px;letter-spacing:1.6px;color:var(--pvmut,#7A7370);text-transform:uppercase;font-family:sans-serif}',
      '#view-network .pv.pv-bg-creme{--bpbg:#FDFCFA;--pvtag:#fff}',
      '#view-network .pv.pv-bg-obsidian{--bpbg:linear-gradient(150deg,#141416,#0a0a0a);color:#f6f2e8;--pvmut:rgba(255,255,255,.55);--pvtag:rgba(255,255,255,.06);--pvtagfg:#E8CC7A;--pvreq:rgba(255,255,255,.05);--pvstub:rgba(255,255,255,.05);--bar:#E8CC7A;border-color:rgba(201,168,76,.35)}',
      '#view-network .pv.pv-bg-obsidian .pv-name,#view-network .pv.pv-bg-obsidian .pv-usp{color:#f6f2e8}',
      '#view-network .pv.pv-bg-goldtint{--bpbg:linear-gradient(160deg,#fffdf6,#f6eed6);--pvtag:#fff}',
      '#view-network .pv.pv-bg-accgrad{--bpbg:linear-gradient(155deg,color-mix(in srgb,var(--acc) 10%,#fff),#fff 55%);--pvtag:#fff}',
      '#view-network .pv.pv-bg-muster{--bpbg:#fff;background-image:repeating-linear-gradient(125deg,rgba(201,168,76,.05) 0 1px,transparent 1px 11px)}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'adn-css'; st.textContent = css; document.head.appendChild(st);
  }

  function _val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function _chk(id) { var e = document.getElementById(id); return e ? !!e.checked : false; }
  function _num(id, def) { var n = parseInt(_val(id), 10); return Number.isFinite(n) ? n : def; }
  function _tagArr(s) { return (s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function _slug(s) { return String(s || '').toLowerCase().replace(/[\u00e4]/g, 'ae').replace(/[\u00f6]/g, 'oe').replace(/[\u00fc]/g, 'ue').replace(/[\u00df]/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }

  function _formData() {
    var mit = {}, anf = {};
    MIT_DEFS.forEach(function (m) { mit[m[0]] = _chk('adn-mit-' + m[0]); });
    ANF_DEFS.forEach(function (a) { anf[a[0]] = _chk('adn-anf-' + a[0]); });
    return {
      kategorie: _val('adn-kategorie') || 'finanzierung',
      name: _val('adn-name'),
      rolle: _val('adn-rolle'),
      tags: _val('adn-tags'),
      beschreibung: _val('adn-beschreibung'),
      usp: _val('adn-usp'),
      antwortzeit: _val('adn-antwortzeit'),
      verified: _chk('adn-verified'),
      cta_label: _val('adn-cta') || 'Anfrage senden',
      cta_aktion: _val('adn-ctaakt') || 'lead',
      akzent: _val('adn-akzent') || '#C9A84C',
      hintergrund: _val('adn-bg'),
      hintergrund_farbe: _val('adn-bg') === 'custom' ? _val('adn-bgfarbe') : '',
      hintergrund_bild: _val('adn-bg') === 'bild' ? _bgData : '',
      kante_stil: _val('adn-kante'),
      kante_farbe: _chk('adn-kante-auto') ? '' : _val('adn-kantefarbe'),
      kuerzel: _val('adn-kuerzel'),
      logo_url: _val('adn-logo'),
      logo_data: _logoData,
      logo_zoom: _num('adn-lz', 100),
      logo_x: _num('adn-lx', 50),
      logo_y: _num('adn-ly', 50),
      website: _val('adn-web'),
      ziel_email: _val('adn-email'),
      mitgabe: mit,
      anforderungen: anf,
      aktiv: _chk('adn-aktiv'),
      sortierung: _num('adn-sort', 0)
    };
  }

  function _renderPreview() {
    var host = document.getElementById('adn-preview'); if (!host) return;
    var d = _formData();
    var acc = d.akzent || '#C9A84C';
    var lsrc = d.logo_data || d.logo_url;
    var logo = lsrc
      ? '<img src="' + _esc(lsrc) + '" alt="" style="object-position:' + d.logo_x + '% ' + d.logo_y + '%;transform:scale(' + (d.logo_zoom / 100) + ');transform-origin:' + d.logo_x + '% ' + d.logo_y + '%">'
      : _esc((d.kuerzel || (d.name || '?').slice(0, 2)).toUpperCase());
    var tags = _tagArr(d.tags).slice(0, 4).map(function (t) { return '<span class="pv-tag">' + _esc(t) + '</span>'; }).join('');
    var ver = d.verified ? '<span class="pv-ver">\u2713 Gepr\u00fcft</span>' : '';
    var web = d.website ? '<span class="pv-web">\ud83c\udf10 ' + _esc(String(d.website).replace(/^https?:\/\//i, '')) + '</span>' : '';
    var meta = (d.usp || d.antwortzeit)
      ? '<div class="pv-meta"><span class="pv-usp">' + _esc(d.usp || '') + '</span>' + (d.antwortzeit ? '<span class="pv-resp">\u23f1 ' + _esc(d.antwortzeit) + '</span>' : '') + '</div>' : '';
    var anfOn = ANF_DEFS.filter(function (a) { return d.anforderungen[a[0]]; });
    var req = anfOn.length
      ? '<div class="pv-req"><div class="t">\ud83d\udd12 Voraussetzungen f\u00fcr die Anfrage</div><ul>' +
        anfOn.map(function (a) { return '<li>\u2715 ' + a[1] + '</li>'; }).join('') + '</ul></div>' : '';
    var bgCls = '', bgStyle = '';
    if (d.hintergrund === 'bild' && d.hintergrund_bild) bgStyle = "background:linear-gradient(rgba(255,255,255,.87),rgba(255,255,255,.8)),url('" + d.hintergrund_bild + "') center/cover;";
    else if (d.hintergrund === 'custom' && d.hintergrund_farbe) bgStyle = 'background:' + _esc(d.hintergrund_farbe) + ';';
    else if (d.hintergrund && d.hintergrund !== 'weiss') bgCls = ' pv-bg-' + _esc(d.hintergrund);
    var kSt = d.kante_farbe ? ' style="--kante:' + _esc(d.kante_farbe) + '"' : '';
    var ctaSub = d.cta_aktion === 'gutachten_modal' ? 'Details direkt angeben' : 'kostenlos &amp; unverbindlich';
    host.innerHTML =
      '<div class="pv' + bgCls + '" style="--acc:' + _esc(acc) + ';' + bgStyle + '">' +
        '<div class="pv-l"><div class="pv-top"><div class="pv-logo" style="background:' + _esc(acc) + '">' + logo + '</div>' +
          '<div><div class="pv-name">' + _esc(d.name || 'Name') + ver + '</div><div class="pv-role">' + _esc(d.rolle || 'Rolle') + '</div></div></div>' +
        '<div class="pv-tags">' + tags + '</div>' +
        '<div class="pv-desc">' + _esc(d.beschreibung || 'Beschreibung \u2026') + '</div>' +
        web + meta + req +
        '<button class="pv-cta" type="button"><span class="t">' + _esc(d.cta_label || 'Anfrage senden') + '</span><span class="s">' + ctaSub + '</span></button>' +
        '</div>' +
        '<div class="pv-edge pv-edge-' + _esc(d.kante_stil || 'k1') + '"' + kSt + '></div>' +
        '<div class="pv-stub"><div class="pv-code">' + _esc((d.kuerzel || 'DP').toUpperCase()) + '</div><div class="pv-barcode"></div><div class="pv-lbl">BOARDING</div></div>' +
      '</div>';
  }

  /* ── Kategorien-Verwaltung ── */
  function _catLabel(key) {
    var c = _cats.filter(function (x) { return x.key === key; })[0];
    return c ? c.label : key;
  }
  function _renderCats() {
    var host = document.getElementById('adn-cats'); if (!host) return;
    host.innerHTML = _cats.map(function (c) {
      return '<div class="adn-catrow" data-key="' + _esc(c.key) + '">' +
        '<input type="text" value="' + _esc(c.label) + '" data-f="label" title="Anzeigename">' +
        '<input type="color" value="' + _esc(c.farbe || '#C9A84C') + '" data-f="farbe" title="Rail-Farbe">' +
        '<input type="number" value="' + (c.sortierung | 0) + '" data-f="sortierung" title="Sortierung">' +
        '<span class="cnt">' + (c.cards | 0) + ' Karten</span>' +
        '<button class="adn-btn sec mini" data-catsave="' + _esc(c.key) + '">Speichern</button>' +
        '<button class="adn-btn del mini" data-catdel="' + _esc(c.key) + '"' + ((c.cards | 0) > 0 ? ' disabled title="Erst Karten verschieben/l\u00f6schen"' : '') + '>L\u00f6schen</button>' +
        '</div>';
    }).join('') +
    '<div class="adn-catrow">' +
      '<input type="text" id="adn-newcat-label" placeholder="Neue Kategorie, z.B. Steuerberater">' +
      '<input type="color" id="adn-newcat-farbe" value="#C9A84C">' +
      '<input type="number" id="adn-newcat-sort" value="' + ((_cats.length + 1) * 10) + '">' +
      '<button class="adn-btn min" id="adn-newcat-add">+ Anlegen</button>' +
    '</div>';
    host.querySelectorAll('[data-catsave]').forEach(function (b) {
      b.onclick = async function () {
        var row = b.closest('.adn-catrow'); var key = b.getAttribute('data-catsave');
        var body = { label: row.querySelector('[data-f=label]').value, farbe: row.querySelector('[data-f=farbe]').value, sortierung: parseInt(row.querySelector('[data-f=sortierung]').value, 10) || 0 };
        try { await _call('PUT', '/network-categories/' + encodeURIComponent(key), body); _toast('Kategorie gespeichert', 'success'); await _loadCats(); _fillKategorieSelect(); }
        catch (e) { _toast(e.message || 'Fehler', 'error'); }
      };
    });
    host.querySelectorAll('[data-catdel]').forEach(function (b) {
      b.onclick = async function () {
        var key = b.getAttribute('data-catdel');
        if (!confirm('Kategorie "' + _catLabel(key) + '" l\u00f6schen?')) return;
        try { await _call('DELETE', '/network-categories/' + encodeURIComponent(key)); _toast('Gel\u00f6scht', 'success'); await _loadCats(); _fillKategorieSelect(); }
        catch (e) { _toast(e.message || 'Fehler (Karten vorhanden?)', 'error'); }
      };
    });
    var add = document.getElementById('adn-newcat-add');
    if (add) add.onclick = async function () {
      var label = _val('adn-newcat-label').trim();
      if (!label) { _toast('Name fehlt', 'error'); return; }
      var key = _slug(label);
      try {
        await _call('POST', '/network-categories', { key: key, label: label, farbe: _val('adn-newcat-farbe'), sortierung: parseInt(_val('adn-newcat-sort'), 10) || 0 });
        _toast('Kategorie angelegt', 'success'); await _loadCats(); _fillKategorieSelect();
        var sel = document.getElementById('adn-kategorie'); if (sel) sel.value = key;
      } catch (e) { _toast(e.message || 'Fehler', 'error'); }
    };
  }
  function _fillKategorieSelect(keep) {
    var sel = document.getElementById('adn-kategorie'); if (!sel) return;
    var cur = keep || sel.value;
    sel.innerHTML = _cats.map(function (c) { return '<option value="' + _esc(c.key) + '">' + _esc(c.label) + '</option>'; }).join('');
    if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
  }
  async function _loadCats() {
    try { var r = await _call('GET', '/network-categories'); _cats = (r && r.categories) || []; }
    catch (e) { _cats = [{ key: 'finanzierung', label: 'Finanzierung & Banken', farbe: '#5a9bc4', sortierung: 10, cards: 0 }, { key: 'gutachter', label: 'Gutachter & Sachverstaendige', farbe: '#C9A84C', sortierung: 20, cards: 0 }]; }
    _renderCats();
  }

  /* ── Karten-Liste mit Durchtauschen ── */
  function _renderList() {
    var host = document.getElementById('adn-list'); if (!host) return;
    if (!_cards.length) { host.innerHTML = '<div style="color:#999;padding:12px">Noch keine Karten. Lege oben eine an.</div>'; return; }
    host.innerHTML = _cards.map(function (c) {
      var anf = c.anforderungen || {};
      if (typeof anf === 'string') { try { anf = JSON.parse(anf); } catch (e) { anf = {}; } }
      var hasAnf = Object.keys(anf).some(function (k) { return anf[k] === true; });
      return '<div class="adn-litem">' +
        '<div class="adn-move"><button data-move="' + c.id + '" data-dir="-1" title="nach oben">\u25b2</button><button data-move="' + c.id + '" data-dir="1" title="nach unten">\u25bc</button></div>' +
        '<span class="adn-badge">' + _esc(_catLabel(c.kategorie)) + '</span>' +
        '<div style="flex:1;min-width:140px"><div style="font-weight:700;font-size:13px">' + _esc(c.name) + '</div>' +
          '<div style="font-size:11px;color:#888">' + _esc(c.rolle || '') + '</div></div>' +
        (hasAnf ? '<span class="adn-badge lock">\ud83d\udd12 Pflicht-Check</span>' : '') +
        (c.cta_aktion === 'gutachten_modal' ? '<span class="adn-badge">Modal</span>' : '') +
        '<span class="adn-leads">' + (c.leads | 0) + ' Leads</span>' +
        '<span class="adn-badge ' + (c.aktiv ? '' : 'off') + '">' + (c.aktiv ? 'aktiv' : 'aus') + '</span>' +
        '<button class="adn-btn sec min" data-edit="' + c.id + '">Bearbeiten</button>' +
        '<button class="adn-btn del" data-del="' + c.id + '">L\u00f6schen</button>' +
        '</div>';
    }).join('');
    host.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { _edit(parseInt(b.getAttribute('data-edit'), 10)); }; });
    host.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { _del(parseInt(b.getAttribute('data-del'), 10)); }; });
    host.querySelectorAll('[data-move]').forEach(function (b) { b.onclick = function () { _move(parseInt(b.getAttribute('data-move'), 10), parseInt(b.getAttribute('data-dir'), 10)); }; });
  }
  async function _move(id, dir) {
    var card = _cards.filter(function (c) { return c.id === id; })[0];
    if (!card) return;
    var same = _cards.filter(function (c) { return c.kategorie === card.kategorie; });
    var idx = same.findIndex(function (c) { return c.id === id; });
    var swapWith = same[idx + dir];
    if (!swapWith) { _toast('Schon am Rand der Kategorie', 'info'); return; }
    // Sortierungen normalisieren falls identisch, dann tauschen
    var a = card.sortierung | 0, b = swapWith.sortierung | 0;
    if (a === b) { a = (idx + 1) * 10; b = (idx + 1 + dir) * 10; }
    try {
      await _call('PUT', '/network-cards/' + card.id, Object.assign({}, card, { sortierung: b }));
      await _call('PUT', '/network-cards/' + swapWith.id, Object.assign({}, swapWith, { sortierung: a }));
      await _load();
      _toast('Reihenfolge getauscht', 'success');
    } catch (e) { _toast(e.message || 'Fehler beim Tauschen', 'error'); }
  }

  function _fill(c) {
    _editId = c ? c.id : null;
    _logoData = (c && c.logo_data) || '';
    _bgData = (c && c.hintergrund_bild) || '';
    function set(id, v) { var e = document.getElementById(id); if (e) e.value = (v == null ? '' : v); }
    function setc(id, v) { var e = document.getElementById(id); if (e) e.checked = !!v; }
    var tags = [], mit = {}, anf = {};
    try { tags = c ? (Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]')) : []; } catch (e) {}
    try { mit = c ? (typeof c.mitgabe === 'object' ? c.mitgabe : JSON.parse(c.mitgabe || '{}')) : { objekt: true, eckdaten: true, kontakt: true }; } catch (e) { mit = {}; }
    try { anf = c ? (typeof c.anforderungen === 'object' ? c.anforderungen : JSON.parse(c.anforderungen || '{}')) : {}; } catch (e) { anf = {}; }
    _fillKategorieSelect(c ? c.kategorie : null);
    set('adn-kategorie', c ? c.kategorie : (_cats[0] ? _cats[0].key : 'finanzierung'));
    set('adn-name', c ? c.name : '');
    set('adn-rolle', c ? c.rolle : '');
    set('adn-tags', tags.join(', '));
    set('adn-beschreibung', c ? c.beschreibung : '');
    set('adn-usp', c ? c.usp : '');
    set('adn-antwortzeit', c ? c.antwortzeit : '');
    setc('adn-verified', c ? c.verified !== false : true);
    set('adn-cta', c ? c.cta_label : 'Anfrage senden');
    set('adn-ctaakt', (c && c.cta_aktion) || 'lead');
    set('adn-akzent', (c && c.akzent) || '#C9A84C');
    set('adn-bg', (c && c.hintergrund) || 'weiss');
    set('adn-bgfarbe', (c && c.hintergrund_farbe) || '#ffffff');
    set('adn-kante', (c && c.kante_stil) || 'k1');
    var kf = c ? (c.kante_farbe || '') : '';
    setc('adn-kante-auto', !kf);
    set('adn-kantefarbe', kf || '#C9A84C');
    set('adn-kuerzel', c ? c.kuerzel : '');
    set('adn-logo', c ? c.logo_url : '');
    set('adn-lz', c ? (c.logo_zoom || 100) : 100);
    set('adn-lx', c ? (c.logo_x == null ? 50 : c.logo_x) : 50);
    set('adn-ly', c ? (c.logo_y == null ? 50 : c.logo_y) : 50);
    set('adn-web', c ? c.website : '');
    set('adn-email', c ? c.ziel_email : '');
    MIT_DEFS.forEach(function (m) { setc('adn-mit-' + m[0], !!mit[m[0]]); });
    ANF_DEFS.forEach(function (a) { setc('adn-anf-' + a[0], !!anf[a[0]]); });
    setc('adn-aktiv', c ? !!c.aktiv : true);
    set('adn-sort', c ? c.sortierung : 0);
    var sb = document.getElementById('adn-save'); if (sb) sb.textContent = c ? 'Karte aktualisieren' : 'Karte anlegen';
    _syncVisibility();
    _renderPreview();
  }
  function _syncVisibility() {
    var bg = _val('adn-bg');
    var bgc = document.getElementById('adn-bgfarbe-wrap');
    if (bgc) bgc.style.display = (bg === 'custom') ? '' : 'none';
    var bgi = document.getElementById('adn-bgbild-wrap');
    if (bgi) bgi.style.display = (bg === 'bild') ? '' : 'none';
    var bgstat = document.getElementById('adn-bgbild-status');
    if (bgstat) bgstat.textContent = _bgData ? '\u2713 Bild gesetzt' : 'kein Bild';
    var kf = document.getElementById('adn-kantefarbe');
    if (kf) kf.disabled = _chk('adn-kante-auto');
    var lstat = document.getElementById('adn-logo-status');
    if (lstat) lstat.textContent = _logoData ? '\u2713 Bild hochgeladen (ersetzt URL)' : 'kein Upload \u2014 URL wird genutzt';
    var lz = document.getElementById('adn-lz-val'); if (lz) lz.textContent = _num('adn-lz', 100) + ' %';
    var lx = document.getElementById('adn-lx-val'); if (lx) lx.textContent = _num('adn-lx', 50) + ' %';
    var ly = document.getElementById('adn-ly-val'); if (ly) ly.textContent = _num('adn-ly', 50) + ' %';
  }
  function _edit(id) { var c = _cards.filter(function (x) { return x.id === id; })[0]; if (c) { _fill(c); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  async function _del(id) {
    if (!confirm('Diese Karte wirklich l\u00f6schen?')) return;
    try { await _call('DELETE', '/network-cards/' + id); _toast('Gel\u00f6scht', 'success'); await _load(); if (_editId === id) _fill(null); }
    catch (e) { _toast(e.message || 'Fehler', 'error'); }
  }
  async function _save() {
    var d = _formData();
    if (!d.name) { _toast('Name fehlt', 'error'); return; }
    try {
      if (_editId) { await _call('PUT', '/network-cards/' + _editId, d); _toast('Aktualisiert', 'success'); }
      else { await _call('POST', '/network-cards', d); _toast('Angelegt', 'success'); }
      _fill(null); await _load(); await _loadCats();
    } catch (e) { _toast(e.message || 'Fehler', 'error'); }
  }
  async function _load() {
    try { var r = await _call('GET', '/network-cards'); _cards = (r && r.cards) || []; _renderList(); }
    catch (e) { var h = document.getElementById('adn-list'); if (h) h.innerHTML = '<div style="color:#B86250;padding:12px">Fehler: ' + _esc(e.message || '') + '</div>'; }
  }

  function _render(host) {
    host.innerHTML =
      '<div class="view-header"><h2>Netzwerk \u2013 Karten-Designer</h2></div>' +
      '<div class="adn-wrap">' +
        '<div class="adn-card">' +
          '<div class="adn-sec">Kategorien (Rails im Deal-Aktion-Tab)</div>' +
          '<div class="adn-cats" id="adn-cats"></div>' +
          '<div class="adn-sec">Inhalt</div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>Kategorie</label><select id="adn-kategorie"></select></div>' +
            '<div class="adn-field"><label>Sortierung</label><input id="adn-sort" type="number" value="0"></div>' +
          '</div>' +
          '<div class="adn-field"><label>Name</label><input id="adn-name" placeholder="z.B. Sperling Baufinanzierung"></div>' +
          '<div class="adn-field"><label>Rolle / Untertitel</label><input id="adn-rolle" placeholder="z.B. Baufinanzierung &amp; Peak Advisors"></div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>Tags (Komma-getrennt, max. 4 sichtbar)</label><input id="adn-tags" placeholder="450 Banken, ungebunden"></div>' +
            '<div class="adn-field"><label>Webseite</label><input id="adn-web" placeholder="partner-website.de"></div>' +
          '</div>' +
          '<div class="adn-field"><label>Beschreibung</label><textarea id="adn-beschreibung" placeholder="Kurzer Nutzen-Satz \u2026"></textarea></div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>USP-Zeile</label><input id="adn-usp" placeholder="Zusage-Quote 94 %"></div>' +
            '<div class="adn-field"><label>Antwortzeit</label><input id="adn-antwortzeit" placeholder="Antwort in 24-72 h"></div>' +
          '</div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>CTA-Text</label><input id="adn-cta" value="Anfrage senden"></div>' +
            '<div class="adn-field"><label>&nbsp;</label><label class="adn-check"><input id="adn-verified" type="checkbox" checked> Gepr\u00fcft-Badge anzeigen</label></div>' +
          '</div>' +
          '<div class="adn-sec">Logo</div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>Bild hochladen (PNG/JPG, wird auf 240 px verkleinert)</label>' +
              '<div class="adn-imgbtns"><input type="file" id="adn-logofile" accept="image/*" style="font-size:12px">' +
              '<button class="adn-btn sec mini" type="button" id="adn-logoclear">Upload entfernen</button>' +
              '<span id="adn-logo-status" style="font-size:11px;color:#888"></span></div></div>' +
            '<div class="adn-field"><label>\u2026 oder Logo-URL</label><input id="adn-logo" placeholder="https://\u2026/logo.png"></div>' +
          '</div>' +
          '<div class="adn-row3">' +
            '<div class="adn-field"><label>Zoom <span id="adn-lz-val" style="color:#9a7f33"></span></label><input id="adn-lz" type="range" min="50" max="300" step="5" value="100"><div class="adn-rangelbl"><span>50 %</span><span>300 %</span></div></div>' +
            '<div class="adn-field"><label>Position X <span id="adn-lx-val" style="color:#9a7f33"></span></label><input id="adn-lx" type="range" min="0" max="100" step="1" value="50"><div class="adn-rangelbl"><span>links</span><span>rechts</span></div></div>' +
            '<div class="adn-field"><label>Position Y <span id="adn-ly-val" style="color:#9a7f33"></span></label><input id="adn-ly" type="range" min="0" max="100" step="1" value="50"><div class="adn-rangelbl"><span>oben</span><span>unten</span></div></div>' +
          '</div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>K\u00fcrzel (Abriss / Fallback-Monogramm)</label><input id="adn-kuerzel" maxlength="4" placeholder="SPR"></div>' +
            '<div class="adn-field"><label>Akzentfarbe</label><input id="adn-akzent" type="color" value="#C9A84C" style="height:38px;padding:2px"></div>' +
          '</div>' +
          '<div class="adn-sec">Hintergrund &amp; Abrisskante</div>' +
          '<div class="adn-row3">' +
            '<div class="adn-field"><label>Hintergrund</label><select id="adn-bg">' + BG_OPTS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="adn-field" id="adn-bgfarbe-wrap" style="display:none"><label>Eigene Hintergrundfarbe</label><input id="adn-bgfarbe" type="color" value="#ffffff" style="height:38px;padding:2px"></div>' +
            '<div class="adn-field" id="adn-bgbild-wrap" style="display:none"><label>Hintergrund-Bild <span id="adn-bgbild-status" style="color:#9a7f33;font-weight:400"></span></label>' +
              '<div class="adn-imgbtns"><input type="file" id="adn-bgfile" accept="image/*" style="font-size:12px"><button class="adn-btn sec mini" type="button" id="adn-bgclear">Entfernen</button></div></div>' +
          '</div>' +
          '<div class="adn-row3">' +
            '<div class="adn-field"><label>Abrisskante</label><select id="adn-kante">' + KANTE_OPTS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="adn-field"><label>Kantenfarbe</label><input id="adn-kantefarbe" type="color" value="#C9A84C" style="height:38px;padding:2px"></div>' +
            '<div class="adn-field"><label>&nbsp;</label><label class="adn-check"><input id="adn-kante-auto" type="checkbox" checked> automatisch (Akzent)</label></div>' +
          '</div>' +
          '<div class="adn-sec">Mitgabe \u2014 das geht bei einer Anfrage mit</div>' +
          MIT_DEFS.map(function (m) { return '<label class="adn-check"><input id="adn-mit-' + m[0] + '" type="checkbox"> ' + m[1] + '</label>'; }).join('') +
          '<div class="adn-sec">Anforderungen \u2014 Pflicht vor dem Versand (sonst Anfrage gesperrt)</div>' +
          ANF_DEFS.map(function (a) { return '<label class="adn-check"><input id="adn-anf-' + a[0] + '" type="checkbox"> ' + a[1] + '</label>'; }).join('') +
          '<div class="adn-sec">Versand &amp; Status</div>' +
          '<div class="adn-field"><label>CTA-Verhalten</label><select id="adn-ctaakt"><option value="lead">Standard \u2014 Lead z\u00e4hlen + E-Mail an Ziel-Adresse</option><option value="gutachten_modal">Gutachten-Modal \u2014 \u00f6ffnet die DealPilot-Anfrage (keine Lead-Mail)</option></select></div>' +
          '<div class="adn-row2">' +
            '<div class="adn-field"><label>Ziel-E-Mail (Anfragen gehen hierhin)</label><input id="adn-email" placeholder="partner@example.de"></div>' +
            '<div class="adn-field"><label>&nbsp;</label><label class="adn-check"><input id="adn-aktiv" type="checkbox" checked> Karte aktiv (sichtbar im Tab)</label></div>' +
          '</div>' +
          '<div class="adn-actions"><button class="adn-btn" id="adn-save">Karte anlegen</button><button class="adn-btn sec" id="adn-new">Neu / Leeren</button></div>' +
          '<div class="adn-list" id="adn-list"></div>' +
        '</div>' +
        '<div class="adn-prev"><div class="adn-prev-t">Live-Vorschau</div><div id="adn-preview"></div></div>' +
      '</div>';

    // Live-Preview-Bindings
    var ids = ['adn-kategorie', 'adn-name', 'adn-rolle', 'adn-tags', 'adn-web', 'adn-beschreibung', 'adn-usp',
      'adn-antwortzeit', 'adn-verified', 'adn-cta', 'adn-ctaakt', 'adn-akzent', 'adn-bg', 'adn-bgfarbe',
      'adn-kante', 'adn-kantefarbe', 'adn-kante-auto', 'adn-kuerzel', 'adn-logo', 'adn-lz', 'adn-lx', 'adn-ly'];
    MIT_DEFS.forEach(function (m) { ids.push('adn-mit-' + m[0]); });
    ANF_DEFS.forEach(function (a) { ids.push('adn-anf-' + a[0]); });
    ids.forEach(function (id) {
      var e = document.getElementById(id);
      if (e) {
        e.addEventListener('input', function () { _syncVisibility(); _renderPreview(); });
        e.addEventListener('change', function () { _syncVisibility(); _renderPreview(); });
      }
    });
    // Bild-Uploads
    var lf = document.getElementById('adn-logofile');
    if (lf) lf.addEventListener('change', function () {
      if (!lf.files || !lf.files[0]) return;
      _fileToDataUrl(lf.files[0], 240, false, function (durl) {
        _logoData = durl; _syncVisibility(); _renderPreview(); _toast('Logo \u00fcbernommen \u2014 Zoom/Position einstellen', 'success');
      });
    });
    var lc = document.getElementById('adn-logoclear');
    if (lc) lc.onclick = function () { _logoData = ''; var f = document.getElementById('adn-logofile'); if (f) f.value = ''; _syncVisibility(); _renderPreview(); };
    var bf = document.getElementById('adn-bgfile');
    if (bf) bf.addEventListener('change', function () {
      if (!bf.files || !bf.files[0]) return;
      _fileToDataUrl(bf.files[0], 760, true, function (durl) {
        _bgData = durl; _syncVisibility(); _renderPreview(); _toast('Hintergrund-Bild \u00fcbernommen', 'success');
      });
    });
    var bc = document.getElementById('adn-bgclear');
    if (bc) bc.onclick = function () { _bgData = ''; var f = document.getElementById('adn-bgfile'); if (f) f.value = ''; _syncVisibility(); _renderPreview(); };

    var sv = document.getElementById('adn-save'); if (sv) sv.onclick = _save;
    var nw = document.getElementById('adn-new'); if (nw) nw.onclick = function () { _fill(null); };
    _loadCats().then(function () { _fill(null); _load(); });
  }

  /* ── Nav-Link + View SELBST erzeugen ── */
  function _ensureNav() {
    if (document.getElementById('view-network')) return true;
    var anyLink = document.querySelector('.nav-link');
    var anyView = document.querySelector('.view');
    if (!anyLink || !anyView) return false;
    var link = document.createElement('a');
    link.href = '#';
    link.className = 'nav-link';
    link.setAttribute('data-view', 'network');
    link.textContent = 'Netzwerk';
    anyLink.parentNode.appendChild(link);
    var view = document.createElement('div');
    view.id = 'view-network';
    view.className = 'view';
    view.style.display = 'none';
    anyView.parentNode.appendChild(view);
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(function (l) { l.classList.toggle('active', l === link); });
      document.querySelectorAll('.view').forEach(function (v) { v.style.display = 'none'; });
      view.style.display = 'block';
      _render(view);
    });
    return true;
  }

  function _boot() {
    _injectCss();
    if (!_ensureNav()) { setTimeout(_boot, 600); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(_boot, 500); });
  else setTimeout(_boot, 500);
  setTimeout(_boot, 1800);

  window._dpNetworkOpen = function () { var v = document.getElementById('view-network'); if (v) { document.querySelectorAll('.view').forEach(function (x) { x.style.display = 'none'; }); v.style.display = 'block'; _render(v); } };
})();
