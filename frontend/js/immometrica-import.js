'use strict';
/* ImmoMetricaImport – Objekt-Picker gegen /api/v1/immometrica (v655-Backend).
   v665: heller oabi-Look wie Exposé/Sprache (oabi-head/sub/body/foot/btn), zweispaltig
   (Quellen+Objektliste links, Felder+Mapping rechts). open(onConfirm, opts) — opts.target
   'qc'|'obj' steuert die Mapping-Beschriftung. onConfirm(dpFields, rawItem). isReady(cb). */
(function () {
  var API = '/api/v1/immometrica';
  function tok() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function hdr() { return { 'Authorization': 'Bearer ' + tok() }; }

  /* ══ v1993 · DIE DEMO-SCHRANKE HING AM AVM-SCHALTER ════════════════

     Hier stand `/api/v1/avm/health`, und daraus wurde `mode` gelesen.
     Das ist der Schalter der BEWERTUNGSanbieter: `AVM_MODE=live` gibt
     Sprengnetter und PriceHubble frei, beide kostenpflichtig je Abruf.

     GEMESSEN auf Staging am 08.10.2026:
       IMMOMETRICA_MODE   nirgends gesetzt  -> Backend laeuft live
       AVM_MODE=stub      in der .env       -> Frontend zeigte Demo

     Marcel hatte einen Schluessel hinterlegt und sah trotzdem die drei
     erfundenen Objekte (Leipzig, Dresden, Chemnitz) - weil die Schranke
     eine ANDERE Schnittstelle fragte als die, um die es geht.

     Jetzt fragt sie `/api/v1/immometrica/health`. ImmoMetrica geht
     damit live, ohne dass ein bezahlter Anbieter angefasst wird.

     v769-imo-stub bleibt als Demo-Weg erhalten - er greift jetzt bei
     IMMOMETRICA_MODE=stub. */
  var _imoHealthCache=null,_imoHealthTs=0;
  function _imoHealth(cb){
    var now=Date.now();
    if(_imoHealthCache!==null && (now-_imoHealthTs)<60000){ cb(_imoHealthCache); return; }
    fetch('/api/v1/immometrica/health',{headers:hdr()}).then(function(r){return r.json();})   /* v1993 */
      .then(function(h){ _imoHealthCache=h||{}; _imoHealthTs=Date.now(); cb(_imoHealthCache); })
      .catch(function(){ _imoHealthCache={}; _imoHealthTs=Date.now(); cb(_imoHealthCache); });
  }
  function _imoStubSync(){ return !!(_imoHealthCache && _imoHealthCache.mode==='stub'); }
  function _imoStubData(){
    function mk(id,title,addr,dp){ return { raw:{ id:id, title:title, address_raw:addr, _demo:true, _immometrica_id:id }, dp:dp }; }
    var items=[
      mk('demo-1','ETW Leipzig Zentrum-S\u00fcd','Musterstra\u00dfe 12, 04109 Leipzig',
        { kuerzel:'DEMO-LE1', objart:'Eigentumswohnung', plz:'04109', ort:'Leipzig', str:'Musterstra\u00dfe', hnr:'12',
          wfl:68, baujahr:1998, kp:189000, nkm:690, zimmer:3, bad_anz:1, etage:2, etagen_ges:4,
          notizen:'Demo-Objekt (ImmoMetrica-Simulation)' }),
      mk('demo-2','ETW Dresden Neustadt','Beispielweg 7, 01097 Dresden',
        { kuerzel:'DEMO-DD2', objart:'Eigentumswohnung', plz:'01097', ort:'Dresden', str:'Beispielweg', hnr:'7',
          wfl:82, baujahr:2012, kp:245000, nkm:880, zimmer:3, bad_anz:1, etage:3, etagen_ges:5,
          notizen:'Demo-Objekt (ImmoMetrica-Simulation)' }),
      mk('demo-3','MFH Chemnitz','Demoallee 30, 09111 Chemnitz',
        { kuerzel:'DEMO-C3', objart:'Mehrfamilienhaus', plz:'09111', ort:'Chemnitz', str:'Demoallee', hnr:'30',
          wfl:240, gsfl:420, baujahr:1965, kp:420000, nkm:1850, zimmer:9, etagen_ges:3, einheiten:4,
          notizen:'Demo-Objekt (ImmoMetrica-Simulation)' })
    ];
    return { sources:[{ key:'sdemo', label:'Demo-Suche', count:items.length, kind:'search', id:'demo' }], items:items };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmt(n) { return n == null ? '\u2014' : new Intl.NumberFormat('de-DE').format(n); }
  function fmtY(n) { return (n == null || n === '') ? '\u2014' : String(n).replace(/\D/g, ''); }

  var IMO_ICON = '<img src="img/immometrica.png" alt="ImmoMetrica" style="height:22px;vertical-align:middle;display:inline-block">'; /* v839-immo-logo */

  var FIELD_LABEL = {
    kuerzel: 'K\u00fcrzel', objart: 'Objektart', plz: 'PLZ', ort: 'Ort', str: 'Stra\u00dfe', hnr: 'Nr.',
    wfl: 'Wohnfl\u00e4che', gsfl: 'Grundst\u00fcck', baujahr: 'Baujahr', kp: 'Kaufpreis', nkm: 'Kaltmiete',
    zimmer: 'Zimmer', bad_anz: 'B\u00e4der', etage: 'Etage', etagen_ges: 'Etagen ges.',
    einheiten: 'Einheiten', vermstand: 'Vermietung',   /* v1998: erwerbsart raus */
    notizen: 'Sonstige Bemerkungen',   /* v1998: anbietertyp raus */
  };
  var FIELD_ORDER = ['kuerzel', 'objart', 'plz', 'ort', 'str', 'hnr', 'wfl', 'gsfl', 'baujahr',
    'kp', 'nkm', 'zimmer', 'bad_anz', 'etage', 'etagen_ges', 'einheiten', 'vermstand',
    'notizen'];

  /* ══ v1998 · ZWEI FELDER, DIE ES NIE GAB ═══════════════════════════

     Hier standen `erwerbsart` und `anbietertyp` in der Liste und wurden
     von `augmentDp()` gesetzt. Das Fenster zeigte sie als angehakte
     Zeile „ImmoMetrica -> Objekt".

     GEMESSEN: es gibt KEIN Eingabeelement mit diesen Kennungen in
     index.html (0 Treffer). `applyImmometrica` endet bei
     `var el = $(id); if (!el) return;`, und `collectData()` ueberspringt
     jede Kennung ohne DOM-Element. Der Haken versprach eine Uebernahme,
     die nie stattfand und auch nie haette gespeichert werden koennen.

     Marcel am 08.10.2026: „brauchen wir die Erwerbsart? Ich glaube
     nicht, weil das fuer uns unerheblich ist, genauso wie der
     Anbietertyp."

     Die Information geht NICHT verloren: Zwangsversteigerung,
     Bieterverfahren und „Anbieter privat/gewerblich" stehen weiter im
     Notiztext (`buildSummary`). Nur der Haken verschwindet.

       > Ein Haken, der nichts tut, ist schlimmer als ein fehlendes
       > Feld. Das fehlende Feld sieht man. */

  var state = { onConfirm: null, source: null, sources: [], items: [], active: null, target: 'obj', onClose: null, confirmed: false };
  function targetLabel() { return state.target === 'qc' ? 'Quick-Check' : 'Objekt'; }

  function isReady(cb) {
    _imoHealth(function(h){
      if (_imoStubSync()) { cb(true); return; }  /* v769-imo-stub */
      fetch(API + '/credentials', { headers: hdr() })
        .then(function (r) { return r.json(); })
        .then(function (d) { cb(!!(d && d.immometrica && d.immometrica.exists)); })
        .catch(function () { cb(false); });
    });
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
      /* v2003 · der Knopf sitzt IM Hinweis, damit "50 von 1727 geladen" und
         der Ausweg eine Zeile bleiben. Gold als Rahmen, nicht als Flaeche:
         er ist ein Angebot, keine Hauptaktion. */
      '.imo-mehr{font:11px ui-monospace,monospace;margin-left:6px;padding:3px 9px;cursor:pointer;'
        + 'border:1px solid var(--gold,var(--wl-C9A84C,#C9A84C));border-radius:999px;'
        + 'background:transparent;color:var(--ch2,#5B5550)}',
      '.imo-mehr:hover{background:var(--gold-bg,rgba(201,168,76,.12))}',
      '.imo-mehr[disabled]{opacity:.55;cursor:default}',
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
    if (_imoStubSync()) { var _d=_imoStubData(); state.sources=_d.sources; renderSources(); if(state.sources[0]) selectSource(state.sources[0]); return; }  /* v769-imo-stub */
    host.innerHTML = '<span style="font:12px ui-monospace,monospace;color:var(--muted,#7A7370)">Lade Quellen\u2026</span>';
    fetch(API + '/searches', { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (searches) {
        /* v2003 · Die Favoriten standen hier als LETZTE, und vorgewaehlt
           wird `state.sources[0]` - also immer ein Suchauftrag. Marcels
           Suchauftrag hat tausende Treffer; als Einstieg ist das die
           schlechteste der vorhandenen Quellen. Jetzt stehen die
           Favoriten vorn. Kein zusaetzlicher Abruf, um zu entscheiden,
           ob es welche gibt - die Reihenfolge allein genuegt, und eine
           leere Favoritenliste sagt das selbst. */
        state.sources = [];
        state.sources.push({ key: 'favde', label: 'Favoriten \u00b7 DE', kind: 'fav', cc: 'de' });
        (Array.isArray(searches) ? searches : []).forEach(function (s) {
          state.sources.push({ key: 's' + s.id, label: 'Suche \u00b7 ' + (s.name || s.id), count: s.count, kind: 'search', id: s.id });
        });
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
    state.source = s; state.active = null; state.seite = 1; state.next = null; renderSources(); renderDetail();
    var list = document.getElementById('imo-list');
    list.innerHTML = '<div style="color:var(--muted,#7A7370);font-size:13px;padding:20px 0">Lade Objekte\u2026</div>';
    if (_imoStubSync()) { state.items=_imoStubData().items; state.items.forEach(function(it){ /* v1998: augmentDp ist entfallen */ }); renderList(state.items.length); return; }  /* v769-imo-stub */
    var url = s.kind === 'search' ? API + '/searches/' + s.id + '/results' : API + '/favorites/' + s.cc;
    fetch(url, { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.items = (d && d.items) || [];
        state.next = (d && d.next) || null;
        state.gesamt = (d && d.count != null) ? d.count : state.items.length;
        renderList(state.gesamt);
      })
      .catch(function () { list.innerHTML = '<div style="color:var(--red,#B8625C);font-size:13px">Konnte Objekte nicht laden.</div>'; });
  }
  function renderList(total) {
    var list = document.getElementById('imo-list');
    if (!state.items.length) { list.innerHTML = '<div style="color:var(--muted,#7A7370);font-size:13px;padding:20px 0">Keine Objekte.</div>'; return; }
    /* v2003 · Hier stand "N Treffer - Seite 1." und sonst nichts: eine
       Feststellung ohne Ausweg. Die Seitenzahl geht im Backend schon
       durch (immometrica.js, `req.query.page`), und der Dienst liefert
       `next` mit - es fehlte nur der Knopf. */
    var mehr = state.next && state.source && state.source.kind === 'search';
    var note = (total != null && total > state.items.length)
      ? '<div class="imo-note">' + state.items.length + ' von ' + total + ' geladen.' + (mehr ? ' <button type="button" id="imo-mehr" class="imo-mehr">weitere laden</button>' : ' Mehr liefert die Schnittstelle nicht.') + '</div>' : '';
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
    /* v2003 · ANHAENGEN, nicht ersetzen: wer auf Seite 3 etwas gesehen
       hat, soll Seite 1 und 2 nicht verlieren. `state.active` zeigt auf
       einen Index in `state.items` - deshalb darf nur hinten angebaut
       werden, sonst springt die Auswahl auf ein anderes Objekt. */
    var mb = document.getElementById('imo-mehr');
    if (mb) mb.onclick = function () {
      if (mb.disabled) return;
      mb.disabled = true; mb.textContent = 'l\u00e4dt \u2026';
      var s = state.source;
      state.seite = (state.seite || 1) + 1;
      fetch(API + '/searches/' + s.id + '/results?page=' + state.seite, { headers: hdr() })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (state.source !== s) return;   /* zwischendurch umgeschaltet */
          var neue = (d && d.items) || [];
          state.items = state.items.concat(neue);
          state.next = (d && d.next) || null;
          if (d && d.count != null) state.gesamt = d.count;
          renderList(state.gesamt);
        })
        .catch(function () {
          state.seite = Math.max(1, (state.seite || 2) - 1);
          mb.disabled = false; mb.textContent = 'nochmal versuchen';
        });
    };
  }
  /* v1999 · Die Zeile sagt, was sonst niemand sagt: dass dieses
     Inserat keine Anschrift fuehrt und der Bodenrichtwert deshalb vom
     Ortsmittelpunkt kommt. Keine Rueckfrage, kein Schalter - Marcels
     Entscheidung ist, den Ortskern zu nehmen. Es muss nur dastehen. */
  function _ortskernZeile(dp) {
    var ort = String(dp.ort || '').trim();
    var plz = String(dp.plz || '').trim();
    var wo = (plz + ' ' + ort).trim() || 'dem Ort';
    return '<div class="imo-ortskern">'
      + '<b>Adresse nicht ver\u00f6ffentlicht</b>'
      + '<span>Das Inserat f\u00fchrt keine Stra\u00dfe. F\u00fcr Bodenrichtwert und '
      + 'Marktpreis wird der <b>Ortskern von ' + esc(wo) + '</b> verwendet '
      + '\u2014 das ist eine Einsch\u00e4tzung, keine Messung am Objekt. '
      + 'Tr\u00e4gst du die Anschrift sp\u00e4ter nach, rechnet alles neu.</span>'
      + '</div>';
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
    /* ══ v1999 · WENN DAS INSERAT KEINE STRASSE FUEHRT ═══════════════

       Marcel: „da koennte man die fehlende Strasse etc anklicken,
       dann wird das Zentrum genommen oder der Ortskern."

       Der Ortskern wird ohnehin schon genommen - `bodenrichtwert.js`
       faellt bei fehlender Strasse still auf „PLZ Ort" zurueck, und
       die Geokodierung liefert dafuer den Ortsmittelpunkt. Was fehlte,
       ist nicht die Rechnung, sondern die ANGABE.

       Deshalb steht es hier, wo man das Inserat auswaehlt - nicht
       erst hinterher am Bodenrichtwert. */
    var _ohneStrasse = !dp.str && (dp.plz || dp.ort);
    var rows = FIELD_ORDER.filter(function (k) { return dp[k] != null && dp[k] !== ''; }).map(function (k) {
      var v = dp[k];
      var disp = (k === 'notizen') ? '<span style="color:var(--muted,#7A7370)">Zusammenfassung</span>' : (k === 'baujahr' ? fmtY(v) : (typeof v === 'number' ? fmt(v) : esc(v)));
      return '<label class="imo-f">' +
        '<input type="checkbox" class="imo-cb" data-k="' + k + '" checked>' +
        '<span class="lbl">' + (FIELD_LABEL[k] || k) + '</span>' +
        '<span class="val">' + disp + '</span>' +
        '<span class="map">' + map + '</span>' +
        '</label>';
    }).join('');
    var summary = dp.notizen ? '<div class="imo-sum">' + esc(dp.notizen) + '</div>' : '';
    host.innerHTML = '<div class="imo-dl">In ' + esc(targetLabel()) + ' \u00fcbernehmen</div>' + rows + (_ohneStrasse ? _ortskernZeile(dp) : '') + summary;
    if (confirm) confirm.disabled = false;
  }
  /* ══ v2000 · DER ABGLEICH ══════════════════════════════════════════

     Marcel: „Wir muessen aber abgleichen, ob das mit ImmoMetrica auch
     passt. Also passt dieses Objekt ueberhaupt dazu? Ist es die
     richtige Adresse? … Gegebenenfalls muss das dann ueber eine
     Bestaetigung laufen."

     Verglichen wird gegen das FORMULAR, nicht gegen die geladenen
     Dateien - `addressWarning()` in object-actions.js tut Letzteres
     und kennt ImmoMetrica gar nicht.

     Normalisiert wird so weit, dass die Schreibweise keinen Fehlalarm
     erzeugt: „Musterstr. 12" und „Musterstrasse 12" sind dasselbe
     Haus. Ein Vergleich, der an der Schreibweise scheitert, ist so
     teuer wie keiner - man lernt, ihn wegzuklicken. */
  function _formWert(id) {
    var e = document.getElementById(id);
    return e ? String(e.value || '').trim() : '';
  }
  function _normOrt(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/\u00df/g, 'ss').replace(/\u00e4/g, 'ae').replace(/\u00f6/g, 'oe').replace(/\u00fc/g, 'ue')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function _normStr(s) {
    /* str. / strasse / strassen -> ein Wort, damit die Abkuerzung
       nicht zum Widerspruch wird. Die Endung sitzt IM Wort
       ("musterstrasse"), deshalb keine Wortgrenze davor - mein erster
       Anlauf nahm /\bstrasse\b/ und liess "musterstr" gegen
       "musterstrasse" auflaufen. Die eigene Regelpruefung hat es
       gefangen, bevor etwas geschrieben war. */
    return _normOrt(s).replace(/([a-z]*?)(strassen|strasse|str)\b/g, '$1str')
      .replace(/\s+/g, ' ').trim();
  }
  function _abgleich(dp) {
    var oPlz = _formWert('plz'), oOrt = _formWert('ort');
    var oStr = _formWert('str'), oHnr = _formWert('hnr');
    if (!oPlz && !oOrt && !oStr) return { art: 'leer' };
    var iPlz = String(dp.plz || '').trim(), iOrt = String(dp.ort || '').trim();
    var iStr = String(dp.str || '').trim(), iHnr = String(dp.hnr || '').trim();
    var weg = [];
    if (oPlz && iPlz && oPlz !== iPlz) weg.push('PLZ');
    if (oOrt && iOrt && _normOrt(oOrt) !== _normOrt(iOrt)) weg.push('Ort');
    if (oStr && iStr && _normStr(oStr) !== _normStr(iStr)) weg.push('Stra\u00dfe');
    if (oHnr && iHnr && _normOrt(oHnr) !== _normOrt(iHnr)) weg.push('Hausnummer');
    if (weg.length) {
      return { art: 'widerspruch', worin: weg,
               objekt: [oStr, oHnr].filter(Boolean).join(' ') + (oStr || oHnr ? ', ' : '') + (oPlz + ' ' + oOrt).trim(),
               inserat: [iStr, iHnr].filter(Boolean).join(' ') + (iStr || iHnr ? ', ' : '') + (iPlz + ' ' + iOrt).trim() };
    }
    /* Das Inserat weiss WENIGER (keine Strasse), aber nichts anderes.
       Das ist kein Widerspruch und darf nicht fragen. */
    if (!iStr && oStr) return { art: 'grober' };
    return { art: 'passt' };
  }

  /* Die Rueckfrage steht IM Fenster, nicht als Browser-Dialog: ein
     `confirm()` blockiert alles und sagt nichts ueber den Unterschied. */
  function _abgleichFragen(erg, weiter) {
    var ov = document.getElementById('imo-ov'); if (!ov) { weiter(); return; }
    var alt = document.getElementById('imo-abgleich'); if (alt) alt.remove();
    var d = document.createElement('div');
    d.id = 'imo-abgleich';
    d.className = 'imo-abgleich';
    d.innerHTML = '<b>\u26A0 Andere Adresse als im Objekt</b>'
      + '<span>Unterschied in: ' + esc(erg.worin.join(', ')) + '</span>'
      + '<div class="imo-ab-paar"><span>Objekt</span><b>' + esc(erg.objekt || '\u2014') + '</b></div>'
      + '<div class="imo-ab-paar"><span>Inserat</span><b>' + esc(erg.inserat || '\u2014') + '</b></div>'
      + '<span class="imo-ab-frage">Geh\u00f6rt das Inserat zu diesem Objekt?</span>'
      + '<div class="imo-ab-knoepfe">'
      + '<button type="button" class="oabi-btn" id="imo-ab-nein">Nein, abbrechen</button>'
      + '<button type="button" class="oabi-btn primary" id="imo-ab-ja">Ja, trotzdem \u00fcbernehmen</button>'
      + '</div>';
    var fuss = ov.querySelector('.oabi-foot');
    if (fuss && fuss.parentNode) fuss.parentNode.insertBefore(d, fuss); else ov.appendChild(d);
    d.querySelector('#imo-ab-nein').onclick = function () { d.remove(); };
    d.querySelector('#imo-ab-ja').onclick = function () { d.remove(); weiter(); };
    try { d.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  function confirmPick() {
    var it = state.items[state.active]; if (!it) return;
    /* v2000: erst abgleichen. Nur ein echter Widerspruch fragt. */
    var _erg = _abgleich(it.dp || {});
    if (_erg.art === 'widerspruch' && !confirmPick._durch) {
      _abgleichFragen(_erg, function () { confirmPick._durch = true; confirmPick(); });
      return;
    }
    confirmPick._durch = false;
    var picked = {};
    document.querySelectorAll('#imo-ov .imo-cb').forEach(function (cb) { if (cb.checked) picked[cb.dataset.k] = it.dp[cb.dataset.k]; });
    /* v1999 · Diese Liste ist HANDGEFUEHRT - wer im Mapping ein neues
       Meta-Feld anlegt und sie vergisst, baut ein Feld, das nie ankommt.
       Genau das waere mir mit _immometrica_reaktiviert aus v1998
       passiert: im Mapping gesetzt, hier nicht weitergereicht, also im
       Objekt nie vorhanden. Aufgefallen beim Lesen, nicht beim Testen. */
    ['_immometrica_id', '_quelle', '_expose', '_immometrica_online_since',
     '_immometrica_portals', '_immometrica_reaktiviert'].forEach(function (k) {
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
