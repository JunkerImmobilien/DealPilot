'use strict';
/* v406-bridge-contract ===========================================================
   ROLLE (QC-Integration Etappe C): qc-bridge.js ist die EINZIGE Integrationsschicht
   zwischen dem iframe-QuickCheck (frontend/quickcheck-app.html / QcApp) und der
   Haupt-App. Sonst spricht NICHTS direkt mit dem iframe.

   NACHRICHTEN VOM IFRAME (nur diese 2 werden verarbeitet, siehe message-Listener):
     'qc-save'        -> _handleSave(inputs, avm, photos) -> window.qcSaveAsObject()
     'qc-import-pdf'  -> _handleImportPdf()                -> window.qcImportPdfTrigger()

   RUECKKANAL AN DEN IFRAME (_postToFrame):
     'qc-import-result'  Werte (Verkehrswert/Lage/etc.) zurueck in die iframe-Felder
     'qc-import-photos'  aus dem Exposé extrahierte Fotos zurueck in den iframe

   ABHAENGIGKEITEN (aus quick-check.js = Bridge-Backing, siehe dortigen v405-Block):
     window.qcSaveAsObject, window.qcImportPdfTrigger.
     Aendert sich dort etwas an diesen beiden Funktionen, hier mitdenken.
   ============================================================================== */
/**
 * V333: Brücke iframe ⇄ DealPilot-App.
 *  - iframe = Viewport-Höhe, intern scrollend (Modale/Karte korrekt).
 *  - (5) Beim Speichern wird die geladene Objekt-Kennung still zurückgesetzt
 *        (_currentObjSeq=null) → neues Objekt statt Überschreiben. KEIN newObj()
 *        beim Öffnen (das fragte nach + wechselte den Tab).
 *  - (qc-save) qcSaveAsObject() ZUERST (legt neues Objekt aus qc_-Snapshot an),
 *        DANACH Verkehrswert/Lage in die Felder + persistieren.
 *  - (2) Exposé-Import: iframe fordert echten Import an → Brücke ruft
 *        window.qcImportPdfTrigger() → Werte zurück in die iframe-Felder.
 */
(function () {
  var IFRAME_SRC = 'quickcheck-app.html?v=953';
  // qb-buffer: Zwischenspeicher-Pass. Score erreichbar -> Snapshot -> EIN Pass (debounced),
  //   ohne echtes Objekt (object_id NULL). 'Als Objekt speichern' legt erst dann ein Portfolio-Objekt an.
  var _bufState = { code:null, timer:0, lastSig:'', busy:false };
  function _bufReset(){ _bufState.code=null; _bufState.lastSig=''; if(_bufState.timer){clearTimeout(_bufState.timer);_bufState.timer=0;} _bufState.busy=false; }
  function _bufShareUrl(code){ try{ return window.location.origin+'/pass.html?c='+encodeURIComponent(code); }catch(e){ return '/pass.html?c='+code; } }
  function _bufPostCode(){ if(_bufState.code) _postToFrame({source:'dp-app',type:'qc-autopass-code',code:_bufState.code,url:_bufShareUrl(_bufState.code)}); }
  function _handleAutopass(inputs, photos){   /* qb-buffer-photos */
    inputs = inputs || {}; photos = photos || [];
    var _ds2k=''; try { var _pp=(window.ObjectActions&&window.ObjectActions.getQcPending)?window.ObjectActions.getQcPending():null; if(_pp) _ds2k=Object.keys(_pp).sort().join(','); } catch(e){}
    var sig; try { sig = JSON.stringify(inputs) + '|ph:' + photos.length + ':' + photos.map(function(p){return (p||'').slice(0,24);}).join(',') + '|ds2:' + _ds2k; } catch (e) { sig = ''; }
    if (sig && sig === _bufState.lastSig) return;
    _bufState.lastSig = sig; _bufState.photos = photos;
    if (_bufState.timer) clearTimeout(_bufState.timer);
    _bufState.timer = setTimeout(function(){ _bufState.timer=0; _bufSave(inputs); }, 1500);
  }
  function _bufSave(inputs){
    if (!(window.Auth && typeof window.Auth.apiCall==='function')) return;
    if (_bufState.busy) { _bufState.timer = setTimeout(function(){ _bufState.timer=0; _bufSave(inputs); }, 600); return; }
    _bufState.busy = true;
    var title=''; if(inputs.str) title=inputs.str+(inputs.hnr?' '+inputs.hnr:''); if(inputs.ort) title=(title?title+', ':'')+inputs.ort;
    var body={ data: inputs, days: 30 }; if(title) body.title=title; if(_bufState.code) body.code=_bufState.code;
    try { var _pend=(window.ObjectActions&&window.ObjectActions.getQcPending)?window.ObjectActions.getQcPending():null; if(_pend&&Object.keys(_pend).length){ body.data=Object.assign({},inputs,{__ds2pending:_pend}); } } catch(e){}   /* v711-ds2 */
    if(_bufState.photos && _bufState.photos.length) body.photos=_bufState.photos;   /* qb-buffer-photos */
    window.Auth.apiCall('/passes/from-snapshot',{method:'POST',body:body})
      .then(function(r){ if(r&&r.code){ _bufState.code=r.code; _bufPostCode(); } _bufState.busy=false; })
      .catch(function(e){ console.warn('[qc-buffer] from-snapshot:',e); _bufState.busy=false; });
  }

  // v345: doppelte weiße "⚡ Quick-Check"-Überschrift entfernen.
  // Sie ist ein CSS-Pseudo-Element (body.qc-standalone-active #s-quick::before)
  // in style.css — der iframe hat bereits eine eigene Überschrift. Hier neutralisieren,
  // ohne die große style.css anzufassen.
  (function () {
    try {
      if (document.getElementById('qc-bridge-style')) return;
      var st = document.createElement('style');
      st.id = 'qc-bridge-style';
      st.textContent = 'body.qc-standalone-active #s-quick::before{content:none !important;display:none !important;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  })();
  var _frame = null;

  var CARRIERS = [
    ['qc_str', ''], ['qc_hnr', ''], ['qc_plz', ''], ['qc_ort', ''], ['qc_adresse', ''],
    ['qc_wfl', ''], ['qc_bj', ''], ['qc_zimmer', ''], ['qc_objektart', ''],
    ['qc_energieklasse', ''], ['qc_stellplatz', ''],
    ['qc_kp', ''], ['qc_knk', '10,5'],
    ['qc_nkm_grund', ''], ['qc_nkm_stp', ''], ['qc_nkm_kueche', ''], ['qc_nkm_sonst', ''],
    ['qc_nkm_garage', '0'], ['qc_nkm', ''],
    ['qc_bewirt_mode', 'hg'], ['qc_hg', ''], ['qc_hg_split', '22'],
    ['qc_ek', ''], ['qc_zins', ''], ['qc_tilg', '']
  ];
  // Felder, die der Exposé-Import (_qcApplyImported) füllt → zurück an die iframe-Seite
  var IMPORT_KEYS = ['qc_str','qc_hnr','qc_plz','qc_ort','qc_adresse','qc_wfl','qc_bj','qc_zimmer','qc_kp','qc_nkm','qc_hg'];

  function _carrierHtml() {
    var h = '<div id="qc-carrier" style="display:none" aria-hidden="true">';
    CARRIERS.forEach(function (c) {
      h += '<input type="hidden" id="' + c[0] + '" value="' + c[1].replace(/"/g, '&quot;') + '">';
    });
    h += '</div>';
    return h;
  }

  window.__qcMountIframe = function (host) {
    if (!host) return;
    try { _bufReset(); } catch (e) {}   /* qb-buffer: neue Sitzung */

    // Beim ÖFFNEN keine Objekt-/Ansicht-Manipulation (sonst blutet der Objekt-Tab durch).
    // Der Überschreib-Schutz läuft beim SPEICHERN via newObj() — siehe _handleSave.
    // Nur evtl. veraltete Exposé-Fotos der vorigen Session verwerfen.
    try { window._qcExposePhotos = []; } catch (e) {}

    if (host.dataset.qcIframe === '1') {
      // Erneutes Öffnen: Quick-Check zurücksetzen → frische, leere Seite.
      try { if (_frame) _frame.src = IFRAME_SRC + '&_t=' + Date.now(); } catch (e) {}
      return;
    }
    host.style.overflow = 'hidden';
    host.innerHTML =
      '<iframe id="qc-v17-frame" src="' + IFRAME_SRC + '" ' +
      'style="width:100%;border:0;display:block;height:600px;background:transparent" ' +
      'title="Quick-Check"></iframe>' +
      _carrierHtml();
    host.dataset.qcIframe = '1';
    _frame = document.getElementById('qc-v17-frame');

    function sizeFrame() {  // qb-szf: Hysterese, kein +4 (kein Aufaddieren)
      try {
        var doc = _frame.contentDocument || (_frame.contentWindow && _frame.contentWindow.document);
        var ch = doc && doc.documentElement ? doc.documentElement.scrollHeight : 0;
        if (ch && ch > 0) {
          var cur = parseInt(_frame.style.height, 10) || 0;
          if (Math.abs(ch - cur) > 8) { _frame.style.height = ch + 'px'; }
          return;
        }
        var top = _frame.getBoundingClientRect().top;
        var h = Math.max(480, Math.floor(window.innerHeight - top - 8));
        var cur2 = parseInt(_frame.style.height, 10) || 0;
        if (Math.abs(h - cur2) > 8) { _frame.style.height = h + 'px'; }
      } catch (e) {}
    }
    function _attachContentObserver() {
      try {
        var doc = _frame.contentDocument || (_frame.contentWindow && _frame.contentWindow.document);
        if (doc && window.ResizeObserver && doc.documentElement && !_frame._qcRO) {
          _frame._qcRO = new ResizeObserver(function () { if (_frame._qcRaf) return; _frame._qcRaf = requestAnimationFrame(function(){ _frame._qcRaf = 0; sizeFrame(); }); });
          _frame._qcRO.observe(doc.documentElement);
        }
      } catch (e) {}
    }
    _frame.addEventListener('load', function () { sizeFrame(); _attachContentObserver(); });
    sizeFrame();
    window.addEventListener('resize', sizeFrame);
    [120, 400, 900, 1500].forEach(function (ms) { setTimeout(sizeFrame, ms); }); // v630-autoheight
  };

  function _postToFrame(msg) {
    try { if (_frame && _frame.contentWindow) _frame.contentWindow.postMessage(msg, '*'); } catch (e) {}
  }

  // ── Werte-Helfer ──
  function _set(id, val, evt) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.value = (val == null ? '' : String(val));
    try { el.dispatchEvent(new Event(evt || 'input', { bubbles: true })); } catch (e) {}
    return true;
  }
  function _lageOpt(score) {
    if (score == null) return '';
    if (score >= 8) return 'sehr_gut';
    if (score >= 6) return 'gut';
    if (score >= 4) return 'durchschnittlich';
    if (score >= 2) return 'schwach';
    return 'sehr_schwach';
  }

  // ── (qc-save) Übernahme ──
  function _handleSave(inputs, avm, photos, pendingTargets) {
    /* v893f-guard: Doppel-/Dreifach-Anlage verhindern (iframe schickt qc-save teils mehrfach) */
    if (_handleSave._busy) { try { console.warn('[qc-bridge] Speichern laeuft bereits \u2014 Doppelauftrag ignoriert (v893f)'); } catch (e) {} return; }
    _handleSave._busy = true;
    try { setTimeout(function () { _handleSave._busy = false; }, 6000); } catch (e) { _handleSave._busy = false; }
    inputs = inputs || {};

    // (1) ÜBERSCHREIB-SCHUTZ: echtes newObj() STILL aufrufen. Nur newObj() setzt die
    // storage.js-interne Variable _currentObjKey auf null (Closure — nicht über window
    // erreichbar). null ⇒ saveObj macht POST (neues Objekt) statt PUT (überschreiben).
    // newObj() wechselt in den Objekt-Tab — beim Übernehmen ohnehin erwünscht.
    try {
      if (typeof window.newObj === 'function') {
        var _oc = window.confirm;
        window.confirm = function () { return true; };
        try { window.newObj(); } finally { window.confirm = _oc; }
      }
    } catch (e) { console.warn('[qc-bridge] newObj:', e); }

    // (2) qc_-Carrier aus den iframe-Werten füllen (NACH newObj, das die qc_-Felder leert)
    Object.keys(inputs).forEach(function (k) { _set('qc_' + k, inputs[k], 'input'); });
    var adr = [];
    if (inputs.str) adr.push(inputs.str + (inputs.hnr ? ' ' + inputs.hnr : ''));
    if (inputs.plz || inputs.ort) adr.push(((inputs.plz || '') + ' ' + (inputs.ort || '')).trim());
    _set('qc_adresse', adr.join(', '), 'input');

    // (3) Deal-Flags zurücksetzen (neue Kopie startet "In Prüfung")
    try {
      ['_deal_won_state','_deal_lost_state','_deal_won_at_state']
        .forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
    } catch (e) {}

    // (4) qcSaveAsObject: qc_-Snapshot → Hauptfelder
    var fn = window.qcSaveAsObject || (typeof qcSaveAsObject === 'function' ? qcSaveAsObject : null);
    if (typeof fn === 'function') {
      try { fn(); } catch (e) { console.error('[qc-bridge] qcSaveAsObject error:', e); return; }
    } else {
      console.warn('[qc-bridge] qcSaveAsObject nicht gefunden.'); return;
    }

    // (5) Objektfotos: die im iframe-Grid sichtbaren Fotos (iframe-Uploads + ins Grid
    // übernommene Exposé-Fotos) ins Objekt setzen. newObj hat imgs geleert → neu setzen.
    // Fallback: falls das iframe keine Fotos lieferte, aber Exposé-Fotos gestasht sind,
    // diese verwenden (pdf-import schreibt sie auch ins Parent-imgs, das newObj aber leert).
    try {
      var _save = (photos || []).map(function (p) { return { src: p.data || p.src, name: p.name || 'foto.jpg' }; });
      if (_save.length === 0 && window._qcExposePhotos && window._qcExposePhotos.length) {
        _save = window._qcExposePhotos.map(function (src, i) { return { src: src, name: 'expose_' + (i + 1) + '.jpg' }; });
      }
      if (_save.length && typeof window.dpSetImgs === 'function') window.dpSetImgs(_save);
    } catch (e) { console.warn('[qc-bridge] dpSetImgs:', e); }

    // (6) AVM-Extras → DS2-Felder, mit Ableitung. Werte respektieren die Unten/Ø/Oben-Wahl
    // (marktwert/marktmiete kommen bereits als gewählter Spannen-Wert). Nur angehakte Targets.
    if (avm) {
      var _ct = avm.checkedTargets;
      var _on = function (t) { return !_ct || _ct[t]; };   // ohne Auswahl-Info: alles übernehmen
      var _wertCat = function (p) { if (p == null) return ''; if (p >= 3) return 'sehr_hoch'; if (p >= 2) return 'hoch'; if (p >= 1) return 'mittel'; if (p > 0) return 'niedrig'; return 'keines'; };
      var _demandCat = function (sc) { return ['', 'sehr_schwach', 'schwach', 'mittel', 'stark', 'sehr_stark'][sc] || ''; };
      var _riskCat   = function (sc) { return ['', 'sehr_niedrig', 'niedrig', 'mittel', 'erhoeht', 'hoch'][sc] || ''; };
      var _marked = [];
      var _setM = function (id, val, evt) { if (_set(id, val, evt)) _marked.push(id); };

      // Verkehrswert (€)
      if (avm.marktwert && _on('verkehrswert')) _setM('svwert', Math.round(avm.marktwert), 'input');
      // Makro-/Mikrolage (Score 0–10 → Kategorie)
      if (avm.scoreMacro != null && (_on('lage_macro') || _on('makrolage'))) _setM('makrolage', _lageOpt(avm.scoreMacro), 'change');
      if (avm.scoreMicro != null && (_on('lage_micro') || _on('mikrolage'))) _setM('mikrolage', _lageOpt(avm.scoreMicro), 'change');
      // Marktmiete €/Mo → €/m² (÷ Wohnfläche)
      if (avm.marktmiete && avm.wfl && (_on('mietspanne') || _on('nkm_grund'))) {
        _setM('ds2_marktmiete', (avm.marktmiete / avm.wfl).toFixed(2).replace('.', ','), 'input');
      }
      // Wertsteigerungs-Potenzial (% p.a. → Kategorie)
      if (avm.wertentwicklung != null && _on('wertsteigerung_pa')) { var _wc = _wertCat(avm.wertentwicklung); if (_wc) _setM('ds2_wertsteigerung', _wc, 'change'); }
      // Nachfrage-Indikator (Score 1–5 → Kategorie)
      if (avm.demandScore && _on('nachfrage_indikator')) { var _dc = _demandCat(avm.demandScore); if (_dc) _setM('ds2_nachfrage', _dc, 'change'); }
      // Mietausfall-Risiko (Score 1–5 → Kategorie)
      if (avm.riskScore && _on('mietausfall_risk')) { var _rc = _riskCat(avm.riskScore); if (_rc) _setM('ds2_mietausfall', _rc, 'change'); }

      // V350: übernommene Felder golden markieren (wie PLZ/Ort) — NACH dem Setzen,
      // damit das set-input-Event den Auto-Clear nicht sofort auslöst.
      try { if (typeof window._v236MarkQcLoaded === 'function' && _marked.length) window._v236MarkQcLoaded(_marked); } catch (e) {}
    }

    // (7) Persistieren → POST (neues Objekt), weil _currentObjKey=null
    // v419: Bucket B+C (PDF-Import, kein qc_-Feld) ins frisch angelegte Objekt schreiben
    try {
      if (window.ObjectActions && typeof window.ObjectActions.applyQcPending === 'function') {
        window.ObjectActions.applyQcPending(pendingTargets || null);
      }
    } catch (e) { console.warn('[qc-bridge] applyQcPending:', e); }

    if (typeof window.saveObj === 'function') {
      try { window.saveObj(true); } catch (e) { console.warn('[qc-bridge] saveObj:', e); }
    }
  }

  // ── (2) Exposé-Import: echten Import auslösen, Ergebnis an iframe zurück ──
  // qb-claim: Pass-Snapshot ueber die KANONISCHE Kette (_handleSave) zu einem korrekten Objekt.
  //           Kein Mapping-Duplikat: _handleSave ruft newObj -> qcSaveAsObject -> saveObj.
  function _ensureClaimCarriers() {
    if (document.getElementById('qc-carrier')) return null;   // QC war schon offen -> nicht anfassen
    var wrap = document.createElement('div');
    wrap.innerHTML = _carrierHtml();
    var node = wrap.firstChild;
    if (node) { node.setAttribute('data-qb-temp', '1'); document.body.appendChild(node); }
    return node;
  }
  window.__qbClaimFromSnapshot = function (data, photos) {
    data = data || {};
    var _pend711=null, _clean={};
    try { if(data.__ds2pending&&typeof data.__ds2pending==='object') _pend711=data.__ds2pending; } catch(e){}
    Object.keys(data).forEach(function(k){ if(k!=='__ds2pending') _clean[k]=data[k]; });
    try { if(_pend711 && window.ObjectActions && typeof window.ObjectActions.setQcPending==='function') window.ObjectActions.setQcPending(_pend711); } catch(e){}
    var ph = (photos || []).filter(Boolean).map(function (s, i) {
      return (typeof s === 'string') ? { src: s, name: 'foto_' + (i + 1) + '.jpg' } : s;
    });
    var temp = null;
    try { temp = _ensureClaimCarriers(); } catch (e) { console.warn('[qb-claim] carriers:', e); }
    try { _handleSave(_clean, null, ph, null); }
    catch (e) { console.error('[qb-claim] handleSave:', e); }
    finally { if (temp && temp.parentNode) temp.parentNode.removeChild(temp); }
  };

  function _snapImport() {
    var o = {};
    IMPORT_KEYS.forEach(function (k) { var e = document.getElementById(k); o[k] = e ? e.value : ''; });
    return o;
  }
  function _handleImportPdf() {
    // v419: echtes Objekt-Tab-Kombi-Modal (Exposé + Marktbericht) im QC-Modus oeffnen.
    // Bucket A (qc_-Felder) -> data; Bucket B+C -> pending (Anzeige im Save-Modal);
    // die Rohwerte bleiben in object-actions (_qcPendingMerged) bis zum qc-save.
    try { window._qcExposePhotos = []; } catch (e) {}
    if (!(window.ObjectActions && typeof window.ObjectActions.openImport === 'function')) {
      console.warn('[qc-bridge] ObjectActions.openImport fehlt — Import nicht moeglich.');
      _postToFrame({ source: 'dp-app', type: 'qc-import-result', data: {}, pending: [] });
      return;
    }
    window.ObjectActions.openImport(function (applied) {
      var qcData  = (applied && applied.qcData)      ? applied.qcData      : {};
      var pending = (applied && applied.pendingList) ? applied.pendingList : [];
      var photos  = (applied && applied.photos)      ? applied.photos      : [];
      try { if (photos && photos.length) window._qcExposePhotos = photos.slice(); } catch (e) {}
      _postToFrame({ source: 'dp-app', type: 'qc-import-result', data: qcData, pending: pending });
      if (window._qcExposePhotos && window._qcExposePhotos.length) {
        _postToFrame({ source: 'dp-app', type: 'qc-import-photos', photos: window._qcExposePhotos.slice() });
      }
    }, { target: 'qc' });
  }

  /* v505-voice: Sprachaufzeichnung im Quick Check. Modal + Mikrofon laufen im
     Parent (im iframe kein getUserMedia). Uebernehmen geht durch applyMergedQc
     (v418): qcData -> qc_*-Felder im iframe, Rest -> pendingList (Save-Transfer). */
  function _handleVoice() {
    if (!(window.VoiceImport && typeof window.VoiceImport.open === 'function')) {
      console.warn('[qc-bridge] VoiceImport.open fehlt — Sprachaufzeichnung nicht moeglich.');
      _postToFrame({ source: 'dp-app', type: 'qc-import-result', data: {}, pending: [] });
      return;
    }
    window.VoiceImport.open(function (applied) {
      var qcData  = (applied && applied.qcData)      ? applied.qcData      : {};
      var pending = (applied && applied.pendingList) ? applied.pendingList : [];
      _postToFrame({ source: 'dp-app', type: 'qc-import-result', data: qcData, pending: pending });
    }, { target: 'qc' });
  }

  // qcpm-final2 v696: Save-Bestaetigung komplett im Parent (immer mittig), Original-Look.
  // QcApp ist im iframe ein const (NICHT window.QcApp) -> Bestaetigung NUR per postMessage.
  function _qcpmEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function _qcpmStyle(){
    if (document.getElementById('qcpm-style')) return;
    var s=document.createElement('style'); s.id='qcpm-style';
    s.textContent=[
      '#qcpm-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:22px;overflow:auto;background:rgba(8,7,6,.62);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font-family:"Inter",system-ui,sans-serif}',
      '#qcpm-ov .qcpm-box{background:#FDFCFA;border:1px solid rgba(201,168,76,.35);border-radius:16px;width:min(760px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 28px 70px rgba(0,0,0,.5);animation:qcpmIn .22s cubic-bezier(.2,.7,.2,1)}',
      '@keyframes qcpmIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}',
      '#qcpm-ov .qcpm-head{background:#0a0a0a}',
      '#qcpm-ov .qcpm-hbar{display:flex;align-items:center;justify-content:space-between;padding:13px 20px}',
      '#qcpm-ov .qcpm-brand{font-family:"Space Grotesk",sans-serif;font-weight:700;color:#fff;font-size:15px}#qcpm-ov .qcpm-brand b{color:#C9A84C}',
      '#qcpm-ov .qcpm-x{width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#cfc8bd;font-size:15px;cursor:pointer;line-height:1}#qcpm-ov .qcpm-x:hover{border-color:#C9A84C;color:#C9A84C}',
      '#qcpm-ov .qcpm-band{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);padding:15px 20px 13px}',
      '#qcpm-ov .qcpm-band h3{margin:0;font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:24px;color:#161310}',
      '#qcpm-ov .qcpm-band p{margin:3px 0 0;font-size:12.5px;color:#3a3020;line-height:1.5;max-width:600px}',
      '#qcpm-ov .qcpm-tabs{display:flex;background:#161310;padding:0 20px}',
      '#qcpm-ov .qcpm-tab{border:0;background:transparent;color:#b7ad9c;font:inherit;font-size:13px;font-weight:600;padding:12px 16px;cursor:pointer;border-bottom:2px solid transparent}',
      '#qcpm-ov .qcpm-tab.active{color:#E8CC7A;border-bottom-color:#C9A84C}',
      '#qcpm-ov .qcpm-tab .cnt{display:inline-block;margin-left:6px;font-size:10.5px;background:rgba(201,168,76,.18);color:#E8CC7A;border-radius:20px;padding:1px 7px}',
      '#qcpm-ov .qcpm-body{padding:16px 20px 8px;overflow:auto;background:#FDFCFA}',
      '#qcpm-ov .qcpm-pane{display:none}#qcpm-ov .qcpm-pane.active{display:block}',
      '#qcpm-ov .qcpm-ctrls{display:flex;align-items:center;gap:14px 18px;flex-wrap:wrap;margin:0 0 13px}',
      '#qcpm-ov .qcpm-cl{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#7A7370}',
      '#qcpm-ov .qcpm-srcs{display:flex;flex-wrap:wrap;gap:7px}',
      '#qcpm-ov .qcpm-src{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(201,168,76,.3);border-radius:9px;padding:6px 11px;font-size:12.5px;color:#2A2727;cursor:pointer;background:#fff;font-weight:500}',
      '#qcpm-ov .qcpm-src input{display:none}',
      '#qcpm-ov .qcpm-src.on{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);border-color:transparent;color:#161310;font-weight:700}',
      '#qcpm-ov .qcpm-seg{display:inline-flex;border:1px solid rgba(201,168,76,.28);border-radius:9px;overflow:hidden;background:#fff}',
      '#qcpm-ov .qcpm-seg button{border:0;background:transparent;padding:6px 13px;font:inherit;font-size:12.5px;color:#2A2727;cursor:pointer;font-weight:500}',
      '#qcpm-ov .qcpm-seg button+button{border-left:1px solid rgba(201,168,76,.28)}',
      '#qcpm-ov .qcpm-seg button.on{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#161310;font-weight:700}',
      '#qcpm-ov .qcpm-all{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:13px;font-weight:600;color:#2A2727;cursor:pointer}#qcpm-ov .qcpm-all input{width:16px;height:16px;accent-color:#b8932f}',
      '#qcpm-ov .qcpm-sec{margin-bottom:15px}',
      '#qcpm-ov .qcpm-sec-h{display:flex;align-items:center;gap:9px;margin:0 0 8px}',
      '#qcpm-ov .qcpm-logo{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex-shrink:0}',
      '#qcpm-ov .qcpm-l-dp{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#161310}#qcpm-ov .qcpm-l-sn{background:#3557a6}#qcpm-ov .qcpm-l-ph{background:#1f9d8b}#qcpm-ov .qcpm-l-x{background:#161310;color:#E8CC7A}',
      '#qcpm-ov .qcpm-sec-t{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b8932f;font-weight:700}',
      '#qcpm-ov .qcpm-win{margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.06em;color:#161310;background:linear-gradient(110deg,#E8CC7A,#C9A84C);border-radius:20px;padding:2px 9px;display:none}',
      '#qcpm-ov .qcpm-sec.winner .qcpm-win{display:inline-block}',
      '#qcpm-ov .qcpm-item{display:flex;align-items:center;gap:12px;padding:10px 13px;border:1px solid #ececE4;border-radius:10px;background:#fff;margin-bottom:7px}#qcpm-ov .qcpm-item:hover{border-color:rgba(201,168,76,.4)}',
      '#qcpm-ov .qcpm-item.dpband{border-left:3px solid #C9A84C}',
      '#qcpm-ov .qcpm-item input{width:17px;height:17px;accent-color:#b8932f;flex-shrink:0}',
      '#qcpm-ov .qcpm-item .l{flex:1;min-width:0}#qcpm-ov .qcpm-item .l .nm{display:block;font-size:13.5px;color:#2A2727;font-weight:500}#qcpm-ov .qcpm-item .l .t{display:block;font-size:11px;color:#b8932f;font-family:"JetBrains Mono",monospace;margin-top:1px}',
      '#qcpm-ov .qcpm-item .v{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:14px;color:#2A2727;white-space:nowrap;text-align:right}',
      '#qcpm-ov .qcpm-empty{text-align:center;font-style:italic;color:#7A7370;font-size:13px;padding:14px 0}',
      '#qcpm-ov .qcpm-setb{font-size:10px;font-weight:700;letter-spacing:.03em;padding:2px 9px;border-radius:20px;background:rgba(63,165,108,.14);color:#2c7a4e;white-space:nowrap}',
      '#qcpm-ov .qcpm-foot{display:flex;justify-content:flex-end;gap:10px;align-items:center;padding:13px 20px;background:#F6F2E9;border-top:1px solid rgba(201,168,76,.28)}',
      '#qcpm-ov .qcpm-fh{margin-right:auto;font-size:11px;color:#7A7370}',
      '#qcpm-ov .qcpm-btn{padding:10px 20px;border-radius:10px;font:600 13.5px "Inter",system-ui,sans-serif;cursor:pointer;border:1px solid rgba(201,168,76,.28);background:#fff;color:#2A2727}#qcpm-ov .qcpm-btn:hover{border-color:#b8932f}',
      '#qcpm-ov .qcpm-btn.primary{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#161310;border:0;box-shadow:0 3px 12px rgba(201,168,76,.4);font-weight:700}'
    ].join('');
    document.head.appendChild(s);
  }
  function _closeSaveOverlay(){ var ov=document.getElementById('qcpm-ov'); if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); }
  function _showSaveOverlay(items, avmRaw, avmDefault, qcSet){
    _qcpmStyle(); _closeSaveOverlay();
    /* v893j-modal2: Restyle + Tabs + Quelle-/Spannen-Wahl. */
    var AVM={ 'DealPilot':{cls:'qcpm-l-dp',logo:'DP',prio:0}, 'Sprengnetter':{cls:'qcpm-l-sn',logo:'SN',prio:1}, 'PriceHubble':{cls:'qcpm-l-ph',logo:'PH',prio:2} };
    items = items || []; avmRaw = avmRaw || {};
    var state = { src: (avmDefault||'konsens'), span: 'mid' };
    function fmt(n,unit){ if(n==null||!isFinite(n)) return '\u2013'; return Math.round(n).toLocaleString('de-DE')+(unit?(' '+unit):''); }
    function kindOf(t){ return (t==='verkehrswert')?'mw':(t==='nkm_grund'||t==='mietspanne')?'mm':''; }
    function val(prov,kind){ var r=avmRaw[prov]; if(!r||!r[kind]) return null; return r[kind][state.span]; }
    function konsens(kind){ var vs=[]; Object.keys(avmRaw).forEach(function(p){ var v=val(p,kind); if(v!=null&&isFinite(v)) vs.push(v); }); if(!vs.length) return null; return Math.round(vs.reduce(function(a,b){return a+b;},0)/vs.length); }
    // Provider mit Daten (aus items oder avmRaw), DealPilot zuerst
    var provs=[]; items.forEach(function(it){ if(AVM[it.source]&&provs.indexOf(it.source)<0) provs.push(it.source); });
    Object.keys(avmRaw).forEach(function(p){ if(AVM[p]&&provs.indexOf(p)<0) provs.push(p); });
    provs.sort(function(a,b){ return AVM[a].prio-AVM[b].prio; });
    var srcItems=items.filter(function(it){ return !AVM[it.source]; });

    function secHtml(){ var h=''; provs.forEach(function(p){ var m=AVM[p], dp=(p==='DealPilot');
      h+='<div class="qcpm-sec" data-prov="'+p+'"><div class="qcpm-sec-h"><span class="qcpm-logo '+m.cls+'">'+m.logo+'</span><span class="qcpm-sec-t">'+_qcpmEsc(p)+'</span><span class="qcpm-win">\u2713 gew\u00e4hlt</span></div>';
      // Marktwert/Marktmiete aus avmRaw (recompute) + zugehoerige items als Checkbox
      var mwIt=items.filter(function(it){ return it.source===p && kindOf(it.target)==='mw'; })[0];
      var mmIt=items.filter(function(it){ return it.source===p && kindOf(it.target)==='mm'; })[0];
      if(mwIt||avmRaw[p]&&avmRaw[p].mw){ h+='<label class="qcpm-item'+(dp?' dpband':'')+'"><input type="checkbox" class="qcpm-cb" data-key="'+_qcpmEsc(mwIt?mwIt.key:(p+'_mw'))+'" checked><span class="l"><span class="nm">Marktwert</span><span class="t">\u2192 verkehrswert</span></span><span class="v" data-p="'+p+'" data-k="mw">'+fmt(val(p,'mw'),'\u20ac')+'</span></label>'; }
      if(mmIt||avmRaw[p]&&avmRaw[p].mm){ h+='<label class="qcpm-item'+(dp?' dpband':'')+'"><input type="checkbox" class="qcpm-cb" data-key="'+_qcpmEsc(mmIt?mmIt.key:(p+'_mm'))+'" checked><span class="l"><span class="nm">Marktmiete</span><span class="t">\u2192 nkm_grund</span></span><span class="v" data-p="'+p+'" data-k="mm">'+fmt(val(p,'mm'),'\u20ac/Mo')+'</span></label>'; }
      // uebrige items dieses Providers (Lage/Rendite/Konfidenz ...)
      items.filter(function(it){ return it.source===p && kindOf(it.target)===''; }).forEach(function(it){
        h+='<label class="qcpm-item'+(dp?' dpband':'')+'"><input type="checkbox" class="qcpm-cb" data-key="'+_qcpmEsc(it.key)+'" checked><span class="l"><span class="nm">'+_qcpmEsc(it.label||'')+'</span><span class="t">\u2192 '+_qcpmEsc(it.target||'')+'</span></span><span class="v">'+_qcpmEsc(it.value==null?'':String(it.value))+'</span></label>'; });
      h+='</div>'; }); return h||'<p class="qcpm-empty">Keine AVM-Daten.</p>'; }

    function srcHtml(){ var qh=''; /* v893k-overview */
      if(qcSet&&qcSet.length){ qh='<div class="qcpm-sec"><div class="qcpm-sec-h"><span class="qcpm-logo qcpm-l-x">\u2713</span><span class="qcpm-sec-t">Bereits im Quickboarding gesetzt</span></div>';
        qcSet.forEach(function(it){ qh+='<div class="qcpm-item" style="cursor:default"><span class="qcpm-setb">gesetzt</span><span class="l"><span class="nm">'+_qcpmEsc(it.label)+'</span></span><span class="v">'+_qcpmEsc(it.value)+'</span></div>'; });
        qh+='</div>'; }
      if(!srcItems.length) return qh || '<p class="qcpm-empty">Keine weiteren ausgelesenen Daten.</p>';
      var g={},o=[]; srcItems.forEach(function(it){ var s=it.source||''; if(!g[s]){g[s]=[];o.push(s);} g[s].push(it); });
      var h=''; o.forEach(function(src){ h+='<div class="qcpm-sec"><div class="qcpm-sec-h"><span class="qcpm-logo qcpm-l-x">'+(src?src.charAt(0).toUpperCase():'?')+'</span><span class="qcpm-sec-t">'+_qcpmEsc(src||'Daten')+'</span></div>';
        g[src].forEach(function(it){ h+='<label class="qcpm-item"><input type="checkbox" class="qcpm-cb" data-key="'+_qcpmEsc(it.key)+'" checked><span class="l"><span class="nm">'+_qcpmEsc(it.label||'')+'</span><span class="t">\u2192 '+_qcpmEsc(it.target||'')+'</span></span><span class="v">'+_qcpmEsc(it.value==null?'':String(it.value))+'</span></label>'; });
        h+='</div>'; }); return qh+h; }

    var srcChips='<label class="qcpm-src'+(state.src==='konsens'?' on':'')+'" data-src="konsens"><input type="radio" name="qcpm-src" '+(state.src==='konsens'?'checked':'')+'>Konsens (\u00d8)</label>';
    provs.forEach(function(p){ srcChips+='<label class="qcpm-src'+(state.src===p?' on':'')+'" data-src="'+p+'"><input type="radio" name="qcpm-src" '+(state.src===p?'checked':'')+'>'+_qcpmEsc(p)+'</label>'; });

    var ov=document.createElement('div'); ov.id='qcpm-ov';
    ov.innerHTML='<div class="qcpm-box">'
      +'<div class="qcpm-head"><div class="qcpm-hbar"><span class="qcpm-brand">Deal<b>Pilot</b></span><button class="qcpm-x" id="qcpm-x">\u2715</button></div>'
      +'<div class="qcpm-band"><h3>Welche Daten \u00fcbernehmen?</h3><p>W\u00e4hle Quelle &amp; Spanne \u2014 Marktwert/Marktmiete richten sich danach. Lage &amp; Wertentwicklung liefert nur DealPilot.</p></div>'
      +'<div class="qcpm-tabs"><button class="qcpm-tab active" data-tab="avm">\u00dcbernahme</button><button class="qcpm-tab" data-tab="src">Ausgelesene Daten <span class="cnt">'+(srcItems.length+((qcSet&&qcSet.length)||0))+'</span></button></div></div>'
      +'<div class="qcpm-body">'
      +'<div class="qcpm-pane active" data-pane="avm">'
      +'<div class="qcpm-ctrls"><span class="qcpm-cl">Quelle</span><div class="qcpm-srcs">'+srcChips+'</div>'
      +'<span class="qcpm-cl">Spanne</span><div class="qcpm-seg" id="qcpm-span"><button data-span="low">Unten</button><button data-span="mid" class="on">\u00d8</button><button data-span="high">Oben</button></div></div>'
      +'<label class="qcpm-all"><input type="checkbox" id="qcpm-all" checked> Alle \u00fcbernehmen</label>'
      +'<div id="qcpm-secs">'+secHtml()+'</div></div>'
      +'<div class="qcpm-pane" data-pane="src">'+srcHtml()+'</div>'
      +'</div>'
      +'<div class="qcpm-foot"><span class="qcpm-fh" id="qcpm-fh"></span><button class="qcpm-btn" id="qcpm-cancel">Abbrechen</button><button class="qcpm-btn primary" id="qcpm-ok">Speichern &amp; \u00fcbernehmen</button></div></div>';
    document.body.appendChild(ov);

    function recompute(){
      [].forEach.call(ov.querySelectorAll('.qcpm-v,[data-k]'),function(){});
      [].forEach.call(ov.querySelectorAll('span.v[data-k]'),function(el){ var p=el.getAttribute('data-p'), k=el.getAttribute('data-k'); el.textContent=fmt(val(p,k), k==='mw'?'\u20ac':'\u20ac/Mo'); });
      [].forEach.call(ov.querySelectorAll('.qcpm-sec[data-prov]'),function(sec){ sec.classList.toggle('winner', state.src!=='konsens' && sec.getAttribute('data-prov')===state.src); });
      var lbl={low:'Unten',mid:'\u00d8',high:'Oben'}[state.span];
      var sn=(state.src==='konsens')?'Konsens (\u00d8)':state.src;
      var fh=ov.querySelector('#qcpm-fh'); if(fh) fh.textContent=sn+' \u00b7 '+lbl;
    }
    recompute();

    function cancel(){ _postToFrame({source:'dp-qc-parent',type:'qc-save-cancel'}); _closeSaveOverlay(); }
    ov.addEventListener('click', function(e){ if(e.target===ov) cancel(); });
    ov.querySelector('#qcpm-x').onclick=cancel; ov.querySelector('#qcpm-cancel').onclick=cancel;
    [].forEach.call(ov.querySelectorAll('.qcpm-tab'),function(t){ t.onclick=function(){ [].forEach.call(ov.querySelectorAll('.qcpm-tab'),function(x){x.classList.remove('active');}); t.classList.add('active'); var p=t.getAttribute('data-tab'); [].forEach.call(ov.querySelectorAll('.qcpm-pane'),function(x){ x.classList.toggle('active', x.getAttribute('data-pane')===p); }); }; });
    [].forEach.call(ov.querySelectorAll('.qcpm-src'),function(c){ c.onclick=function(){ state.src=c.getAttribute('data-src'); [].forEach.call(ov.querySelectorAll('.qcpm-src'),function(x){x.classList.remove('on');}); c.classList.add('on'); var ip=c.querySelector('input'); if(ip) ip.checked=true; recompute(); }; });
    [].forEach.call(ov.querySelectorAll('#qcpm-span button'),function(b){ b.onclick=function(){ state.span=b.getAttribute('data-span'); [].forEach.call(ov.querySelectorAll('#qcpm-span button'),function(x){x.classList.remove('on');}); b.classList.add('on'); recompute(); }; });
    var all=ov.querySelector('#qcpm-all'); if(all) all.onchange=function(){ var on=all.checked; [].forEach.call(ov.querySelectorAll('.qcpm-cb'),function(cb){cb.checked=on;}); };
    ov.querySelector('#qcpm-ok').onclick=function(){
      var keys=[]; [].forEach.call(ov.querySelectorAll('.qcpm-cb'),function(cb){ if(cb.checked) keys.push(cb.getAttribute('data-key')); });
      _postToFrame({source:'dp-qc-parent',type:'qc-save-confirm',checkedKeys:keys,avmSource:state.src,avmSpan:state.span});
      _closeSaveOverlay();
    };
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'dp-qc') return;
    if (d.type === 'qc-save') _handleSave(d.inputs, d.avm, d.photos, d.pendingTargets);
    else if (d.type === 'qc-reset-buffer') {   /* qb-reset: Neuer Vorgang -> Buffer-Pass loeschen */
      try { if(window.ObjectActions&&window.ObjectActions.clearQcPending) window.ObjectActions.clearQcPending(); } catch(e){}
      try { var _c=_bufState.code; _bufReset(); if(_c && window.Auth && typeof window.Auth.apiCall==='function') window.Auth.apiCall('/passes/'+encodeURIComponent(_c),{method:'DELETE'}).catch(function(){}); } catch(e){}
      try { if(_frame) _frame.src = IFRAME_SRC + '&_t=' + Date.now(); } catch(e){}   /* v712: frische QC-Seite -> Profil-Defaults (Hausgeld/Zins/Tilgung) greifen wieder */
    }
    else if (d.type === 'qc-import-pdf') _handleImportPdf();
    else if (d.type === 'qc-voice') _handleVoice();  /* v505-voice */
    else if (d.type === 'qc-save-open') _showSaveOverlay(d.items || [], d.avmRaw || {}, d.avmDefault || 'konsens', d.qcSet || []); /* v893k-overview */
    else if (d.type === 'qc-autopass') _handleAutopass(d.inputs, d.photos);   /* qb-buffer-photos */
  });
})();
