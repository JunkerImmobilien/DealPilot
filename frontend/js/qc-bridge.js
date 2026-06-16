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
  var IFRAME_SRC = 'quickcheck-app.html?v=686';

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

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'dp-qc') return;
    if (d.type === 'qc-save') _handleSave(d.inputs, d.avm, d.photos, d.pendingTargets);
    else if (d.type === 'qc-import-pdf') _handleImportPdf();
    else if (d.type === 'qc-voice') _handleVoice();  /* v505-voice */
  });
})();
