/* ═══════════════════════════════════════════════════════════════════════
   DealPilot v1008 — KI-Beleg-Import  (Workstream A)
   -----------------------------------------------------------------------
   Flow:  Ordner/Dateien wählen  ->  pdf.js rendert PDF-Seiten zu JPEG
          (gespiegelt aus pdf-import.js), Fotos direkt  ->  Vision-Batch an
          POST /api/v1/ai/extract-beleg (1 Import-Lauf = 1 L Kerosin)  ->
          Review-Liste (Nutzer bestätigt JEDE Zeile, Steuer!)  ->  Übernahme
          in die BMF-AK/HK-Felder + calcAk().
   White-Label:  alle Gold-Literale als var(--wl-<hex>, #<hex>).
   Plan-Gate:    beleg_import (Investor+/Pro). Backend gated zusätzlich (403).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PDFJS_URL    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var MAX_BELEGE   = 40;   // je Lauf; darüber -> zweiter Lauf (1 weiteres L)
  var MAX_PAGES    = 30;   // Seiten pro PDF (jede Seite = 1 Vision-Call, backend-seitig aggregiert)
  var _pdfjsLoaded = false;
  var _rows        = [];   // [{name, datum, netto, ust, brutto, aussteller, kategorie, konfidenz, keep}]

  var KAT = ['Notar & Grundbuch', 'Maklergebühr', 'Grunderwerbsteuer', 'Fahrtkosten',
             'Verpflegung', 'Unterkunft', 'Gutachten', 'Anwalt',
             'Handwerker / Sanierung', 'Material / Sanierung',
             'Herstellungskosten (Erweiterung)', 'Sonstiges'];

  /* Kategorie -> BMF-Feld-ID (Übernahme addiert den Brutto-Betrag auf das Feld).
     Handwerker/Material fließen NICHT in ein AK-Feld -> nur 15-%-Ampel.
     Fahrtkosten: ak_fahrt ist km-basiert -> Betrag geht nach ak_sonst.        */
  var FIELD_MAP = {
    'Notar & Grundbuch':                'ak_notar',
    'Maklergebühr':                     'ak_makler',
    'Grunderwerbsteuer':                'ak_grest',
    'Fahrtkosten':                      'ak_fahrt',
    'Verpflegung':                      'ak_verpfl',
    'Unterkunft':                       'ak_hotel',
    'Gutachten':                        'ak_gutachten',
    'Anwalt':                           'ak_anwalt',
    'Handwerker / Sanierung':           'bmf_hk',
    'Material / Sanierung':             'bmf_hk',
    'Herstellungskosten (Erweiterung)': 'bmf_hk',
    'Sonstiges':                        'ak_sonst'
  };
  var SANIERUNG = { 'Handwerker / Sanierung': 1, 'Material / Sanierung': 1 };
  var LABELS = {
    ak_notar: 'Notar & Grundbuch', ak_makler: 'Maklergebühr', ak_grest: 'Grunderwerbsteuer',
    ak_fahrt: 'Fahrtkosten', ak_verpfl: 'Verpflegung', ak_hotel: 'Unterkunft',
    ak_gutachten: 'Wertgutachten', ak_anwalt: 'Anwaltskosten',
    ak_sonst: 'Sonstiges', bmf_hk: 'Herstellungskosten Gebäude (§255 II)'
  };

  /* ---------- Token / Headers (gleiches Muster wie bmf-modal.js) ---------- */
  function _tok() {
    if (window.Sub && typeof window.Sub.getToken === 'function') return window.Sub.getToken();
    return localStorage.getItem('ji_token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
  }
  function _hdrs() {
    var h = { 'Content-Type': 'application/json' };
    var t = _tok();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }
  function _hasFeature() {
    try {
      if (window.DealPilotConfig && typeof window.DealPilotConfig.hasFeature === 'function') {
        return window.DealPilotConfig.hasFeature('beleg_import');
      }
    } catch (e) {}
    return true; // im Zweifel entscheidet das Backend (403)
  }

  /* ---------- Zahlen ---------- */
  function _parseDe(s) {
    if (s == null) return 0;
    if (typeof s === 'number') return isFinite(s) ? s : 0;
    s = String(s).replace(/[^0-9,.-]/g, '').trim();
    if (s === '' || s === '-') return 0;
    // deutsches Format: 1.234,56  -> 1234.56
    if (s.indexOf(',') >= 0) { s = s.replace(/\./g, '').replace(',', '.'); }
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }
  function _fmtEur(n) {
    n = (typeof n === 'number' && isFinite(n)) ? n : 0;
    return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- pdf.js laden (CDN, wie pdf-import.js) ---------- */
  function _loadPdfJs() {
    if (_pdfjsLoaded && window.pdfjsLib) return Promise.resolve();
    return new Promise(function (res, rej) {
      if (window.pdfjsLib) { _pdfjsLoaded = true; return res(); }
      var s = document.createElement('script');
      s.src = PDFJS_URL;
      s.onload = function () {
        if (window.pdfjsLib) {
          try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch (e) {}
          _pdfjsLoaded = true; res();
        } else { rej(new Error('pdf.js nicht verfügbar')); }
      };
      s.onerror = function () { rej(new Error('pdf.js Ladefehler')); };
      document.head.appendChild(s);
    });
  }

  function _readAs(file, how) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('Lesefehler')); };
      if (how === 'buffer') r.readAsArrayBuffer(file);
      else if (how === 'text') r.readAsText(file, 'utf-8');
      else r.readAsDataURL(file);
    });
  }

  /* PDF -> JPEG-dataURLs (gespiegelt aus pdf-import.js _renderWholePages) */
  async function _pdfToImages(file) {
    await _loadPdfJs();
    var ab = await _readAs(file, 'buffer');
    var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    var out = [];
    var max = Math.min(pdf.numPages, MAX_PAGES);
    for (var i = 1; i <= max; i++) {
      try {
        var page = await pdf.getPage(i);
        var vp = page.getViewport({ scale: 2 });
        var canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        out.push(canvas.toDataURL('image/jpeg', 0.82));
      } catch (e) { /* einzelne Seite ueberspringen, Rest weiterlesen */ }
    }
    return out;
  }

  async function _fileToImages(file) {
    var t = (file.type || '').toLowerCase();
    var n = (file.name || '').toLowerCase();
    if (t.indexOf('pdf') >= 0 || n.slice(-4) === '.pdf') return await _pdfToImages(file);
    if (t.indexOf('image') >= 0 || /\.(jpe?g|png|webp|gif|bmp|heic)$/.test(n)) {
      return [await _readAs(file, 'data')];
    }
    return [];
  }

  /* ---------- Modal ---------- */
  function _css() {
    if (document.getElementById('beleg-import-css')) return;
    var GOLD  = 'var(--wl-c9a84c, #C9A84C)';
    var GOLD3 = 'var(--wl-b8932f, #b8932f)';
    var GRAD  = 'linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f))';
    var st = document.createElement('style');
    st.id = 'beleg-import-css';
    st.textContent =
      '#beleg-import-ov{position:fixed;inset:0;z-index:100000;background:rgba(5,5,5,.66);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif}' +
      '#beleg-import-ov .bi-card{background:#FDFCFA;width:min(920px,96vw);max-height:92vh;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.5)}' +
      '#beleg-import-ov .bi-bar{background:#141414;color:#fff;display:flex;align-items:center;gap:10px;padding:14px 18px}' +
      '#beleg-import-ov .bi-bar .bi-t{font-weight:700;font-size:15px;letter-spacing:.2px}' +
      '#beleg-import-ov .bi-bar .bi-x{margin-left:auto;background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;opacity:.75}' +
      '#beleg-import-ov .bi-bar .bi-x:hover{opacity:1}' +
      '#beleg-import-ov .bi-hero{background:' + GRAD + ';color:#2c2410;padding:10px 18px;font-size:12.5px;font-weight:600}' +
      '#beleg-import-ov .bi-body{padding:18px;overflow:auto}' +
      '#beleg-import-ov .bi-drop{border:2px dashed ' + GOLD + ';border-radius:10px;padding:34px 18px;text-align:center;color:#555}' +
      '#beleg-import-ov .bi-drop .bi-big{font-size:15px;color:#141414;font-weight:600;margin-bottom:6px}' +
      '#beleg-import-ov .bi-btn{background:' + GRAD + ';color:#2c2410;border:1px solid ' + GOLD3 + ';padding:9px 18px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}' +
      '#beleg-import-ov .bi-btn:disabled{opacity:.4;pointer-events:none}' +
      '#beleg-import-ov .bi-ghost{background:transparent;border:1px solid #ccc;color:#333;padding:9px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit}' +
      '#beleg-import-ov .bi-scan{display:none;text-align:center;padding:34px 12px;color:#444}' +
      '#beleg-import-ov .bi-scan.on{display:block}' +
      '#beleg-import-ov .bi-spin{width:34px;height:34px;border:3px solid rgba(201,168,76,.25);border-top-color:' + GOLD + ';border-radius:50%;margin:0 auto 14px;animation:biSpin 1s linear infinite}' +
      '@keyframes biSpin{to{transform:rotate(360deg)}}' +
      '#beleg-import-ov table{width:100%;border-collapse:collapse;font-size:12.5px}' +
      '#beleg-import-ov th{text-align:left;color:#8a7a45;font-size:11px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #eee;padding:6px 8px}' +
      '#beleg-import-ov td{border-bottom:1px solid #f2f2f2;padding:6px 8px;vertical-align:middle}' +
      '#beleg-import-ov td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}' +
      '#beleg-import-ov tr.off{opacity:.4}' +
      '#beleg-import-ov select{font-family:inherit;font-size:12px;padding:3px 4px;max-width:180px}' +
      '#beleg-import-ov .bi-conf{display:inline-block;padding:1px 8px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(63,165,108,.15);color:#2e7d4f}' +
      '#beleg-import-ov .bi-conf.mid{background:rgba(201,168,76,.18);color:#8a6d18}' +
      '#beleg-import-ov .bi-conf.low{background:rgba(184,98,92,.16);color:#a4443d}' +
      '#beleg-import-ov .bi-sums{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;font-size:12.5px}' +
      '#beleg-import-ov .bi-sums .k{color:#666}#beleg-import-ov .bi-sums .v{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}' +
      '#beleg-import-ov .bi-ampel{margin-top:14px;padding:12px 14px;border-radius:8px;font-size:12.5px;line-height:1.5}' +
      '#beleg-import-ov .bi-ampel.g{background:rgba(63,165,108,.12);border:1px solid rgba(63,165,108,.4)}' +
      '#beleg-import-ov .bi-ampel.r{background:rgba(184,98,92,.12);border:1px solid rgba(184,98,92,.45)}' +
      '#beleg-import-ov .bi-ampel.n{background:#f6f4ee;border:1px solid #e6e0d2;color:#666}' +
      '#beleg-import-ov .bi-ft{display:flex;gap:10px;justify-content:flex-end;padding:14px 18px;border-top:1px solid #eee;background:#faf9f6}' +
      '#beleg-import-ov .bi-note{font-size:11px;color:#888;padding:10px 18px 0}';
    document.head.appendChild(st);
  }

  function open() {
    if (!_hasFeature()) {
      alert('Der KI-Beleg-Import ist ab dem Investor-Plan verfügbar.');
      return;
    }
    close();
    _css();
    _rows = [];
    var ov = document.createElement('div');
    ov.id = 'beleg-import-ov';
    ov.innerHTML =
      '<div class="bi-card">' +
        '<div class="bi-bar"><span class="bi-t">📎 Belege importieren</span>' +
          '<button class="bi-x" type="button" onclick="DealPilotBelegImport.close()" aria-label="Schließen">×</button></div>' +
        '<div class="bi-hero">KI liest Datum · Betrag · USt · Aussteller · Kategorie — du bestätigst jede Zeile, bevor sie in die Anschaffungskosten fließt.</div>' +
        '<div class="bi-body">' +
          '<div class="bi-drop" id="bi-drop">' +
            '<div class="bi-big">Ordner mit Belegen wählen</div>' +
            '<div style="margin-bottom:14px">PDFs, Fotos (JPG/PNG), CSV oder Excel. 1 Import-Lauf = 1 L Kerosin — CSV/Excel kosten nichts.</div>' +
            '<button class="bi-btn" type="button" onclick="document.getElementById(\'bi-folder\').click()">Ordner auswählen</button> ' +
            '<button class="bi-ghost" type="button" onclick="document.getElementById(\'bi-files\').click()">Einzelne Dateien</button>' +
            '<input type="file" id="bi-folder" webkitdirectory directory multiple style="display:none">' +
            '<input type="file" id="bi-files" accept="image/*,application/pdf,.csv,.xlsx,.xls,text/csv" multiple style="display:none">' +
          '</div>' +
          '<div class="bi-scan" id="bi-scan"><div class="bi-spin"></div><div id="bi-scan-t">Belege werden gelesen …</div></div>' +
          '<div id="bi-review"></div>' +
        '</div>' +
        '<div class="bi-note" id="bi-note"></div>' +
        '<div class="bi-ft"><button class="bi-ghost" type="button" onclick="DealPilotBelegImport.close()">Abbrechen</button>' +
          '<button class="bi-ghost" id="bi-csv" type="button" disabled onclick="DealPilotBelegImport.csv()">📥 CSV-Auswertung</button>' +
          '<button class="bi-btn" id="bi-take" type="button" disabled onclick="DealPilotBelegImport.apply()">In die Anschaffungskosten übernehmen</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.getElementById('bi-folder').addEventListener('change', function (e) { _onPick(e.target.files); });
    document.getElementById('bi-files').addEventListener('change', function (e) { _onPick(e.target.files); });
  }

  function close() {
    var ov = document.getElementById('beleg-import-ov');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function _onPick(fileList) {
    var ai = [], tbl = [];
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      var n = (f.name || '').toLowerCase();
      var t = (f.type || '').toLowerCase();
      if (/\.(csv|xlsx|xls)$/.test(n) || t.indexOf('csv') >= 0 || t.indexOf('spreadsheet') >= 0 || t.indexOf('excel') >= 0) tbl.push(f);
      else if (t.indexOf('pdf') >= 0 || t.indexOf('image') >= 0 || /\.(pdf|jpe?g|png|webp|gif|bmp|heic)$/.test(n)) ai.push(f);
    }
    if (!ai.length && !tbl.length) { alert('Keine PDF-, Bild-, CSV- oder Excel-Dateien gefunden.'); return; }
    if (ai.length > MAX_BELEGE) ai = ai.slice(0, MAX_BELEGE);
    _run(ai, tbl);
  }

  /* Eine Zeile aus KI-Ergebnis ODER Tabellenzeile in _rows uebernehmen. */
  function _pushPositions(name, poss) {
    poss.forEach(function (d, idx) {
      var netto  = _parseDe(d.betrag_netto != null ? d.betrag_netto : d.netto);
      var ust    = _parseDe(d.ust_betrag  != null ? d.ust_betrag  : d.ust);
      var brutto = d.betrag_brutto != null ? _parseDe(d.betrag_brutto)
                 : (d.brutto != null ? _parseDe(d.brutto) : (netto + ust));
      if (!netto && brutto) netto = brutto - ust;
      var kat = KAT.indexOf(d.kategorie) >= 0 ? d.kategorie : 'Sonstiges';
      _rows.push({
        name: name, teil: poss.length > 1 ? (idx + 1) : 0, teilvon: poss.length,
        datum: d.datum || '—', aussteller: d.aussteller || '—', beschreibung: d.beschreibung || '',
        netto: netto, ust: ust, brutto: brutto, kategorie: kat,
        konfidenz: (d.konfidenz || '—'), keep: true
      });
    });
  }

  async function _run(aiFiles, tableFiles) {
    var drop = document.getElementById('bi-drop');
    var scan = document.getElementById('bi-scan');
    if (drop) drop.style.display = 'none';
    if (scan) scan.classList.add('on');
    var setT = function (s) { var e = document.getElementById('bi-scan-t'); if (e) e.textContent = s; };

    _rows = []; var docCount = 0; var leer = []; var skipped = [];

    // 1) CSV/Excel lokal parsen — KEINE KI, KEIN Kerosin
    for (var i = 0; i < tableFiles.length; i++) {
      setT('Tabelle wird gelesen … (' + (i + 1) + '/' + tableFiles.length + ')');
      try {
        var pos = await _parseTableFile(tableFiles[i]);
        if (pos.length) { docCount++; _pushPositions(tableFiles[i].name, pos); }
        else leer.push(tableFiles[i].name + ' (keine Zeilen erkannt)');
      } catch (e) { leer.push(tableFiles[i].name + ' (Tabelle nicht lesbar)'); }
    }

    // 2) PDFs/Bilder -> KI (nur wenn vorhanden -> nur dann Kerosin)
    if (aiFiles.length) {
      var belege = [];
      for (var j = 0; j < aiFiles.length; j++) {
        setT('Belege werden vorbereitet … (' + (j + 1) + '/' + aiFiles.length + ')');
        try {
          var imgs = await _fileToImages(aiFiles[j]);
          if (imgs.length) belege.push({ name: aiFiles[j].name, images: imgs });
          else skipped.push(aiFiles[j].name);
        } catch (e) { skipped.push(aiFiles[j].name); }
      }
      if (belege.length) {
        setT('KI liest ' + belege.length + ' Beleg(e) …');
        try {
          var resp = await fetch('/api/v1/ai/extract-beleg', { method: 'POST', headers: _hdrs(), body: JSON.stringify({ belege: belege }) });
          if (resp.status === 402) { belege.forEach(function (b) { leer.push(b.name + ' (nicht genug Kerosin)'); }); }
          else if (resp.status === 403) { belege.forEach(function (b) { leer.push(b.name + ' (ab Investor)'); }); }
          else if (!resp.ok) { belege.forEach(function (b) { leer.push(b.name + ' (Fehler ' + resp.status + ')'); }); }
          else {
            var res = await resp.json();
            (res && res.results || []).forEach(function (r) {
              var poss = Array.isArray(r.positionen) ? r.positionen : (r.data ? [r.data] : []);
              if (poss.length) { docCount++; _pushPositions(r.name, poss); }
              else leer.push(r.name + (r.diag ? ' (' + r.diag + ')' : (r.error ? ' (' + r.error + ')' : '')));
            });
          }
        } catch (e) { belege.forEach(function (b) { leer.push(b.name + ' (Netzwerkfehler)'); }); }
      }
    }

    _flagRows();
    var ohne = skipped.map(function (n) { return n + ' (nicht renderbar)'; }).concat(leer);
    var nDup = _rows.filter(function (r) { return r.dup; }).length;
    var nJunk = _rows.filter(function (r) { return r.junk; }).length;
    var note = document.getElementById('bi-note');
    if (note) {
      var t = docCount + ' Datei(en) gelesen · ' + _rows.length + ' Position(en) erkannt. Prüfe jede Zeile, bevor du übernimmst.';
      if (nDup || nJunk) t += ' ' + nDup + ' doppelt und ' + nJunk + ' ohne Wert automatisch abgewählt.';
      if (ohne.length) t += ' Ohne Ergebnis: ' + ohne.join(', ') + '.';
      note.textContent = t;
    }
    if (!_rows.length && scan) { setT('Nichts erkannt.'); }
    if (scan) scan.classList.remove('on');
    _render();
  }

  /* ---------- CSV / Excel ---------- */
  function _norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[äöüß]/g, function (m) { return { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[m]; })
      .replace(/[^a-z0-9]/g, '');
  }
  function _loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = function () { window.XLSX ? res() : rej(new Error('xlsx')); };
      s.onerror = function () { rej(new Error('xlsx Ladefehler')); };
      document.head.appendChild(s);
    });
  }
  function _parseCsvText(txt) {
    txt = String(txt || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var first = txt.split('\n')[0] || '';
    var delim = first.indexOf(';') >= 0 ? ';' : (first.indexOf('\t') >= 0 ? '\t' : ',');
    var rows = [], row = [], field = '', inQ = false, i = 0;
    while (i < txt.length) {
      var c = txt[i];
      if (inQ) {
        if (c === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === delim) { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += c;
      }
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }
  async function _parseTableFile(file) {
    var n = (file.name || '').toLowerCase();
    var rows;
    if (/\.(xlsx|xls)$/.test(n)) {
      await _loadXlsx();
      var buf = await _readAs(file, 'buffer');
      var wb = window.XLSX.read(buf, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    } else {
      rows = _parseCsvText(await _readAs(file, 'text'));
    }
    return _mapTableRows(rows);
  }
  function _mapTableRows(rows) {
    if (!rows || rows.length < 2) return [];
    var header = (rows[0] || []).map(_norm);
    function col(res) { for (var i = 0; i < header.length; i++) { for (var k = 0; k < res.length; k++) { if (res[k].test(header[i])) return i; } } return -1; }
    var iDatum  = col([/^jahr$/, /datum/, /rechnungsdatum/, /belegdatum/, /^date$/]);
    var iBrutto = col([/brutto/, /gesamt/, /endbetrag/, /zahlbetrag/, /jvzsoll/, /^soll$/, /^summe$/, /^betrag$/, /^total$/]);
    var iNetto  = col([/netto/]);
    var iUst    = col([/^ust$/, /mwst/, /umsatzsteuer/, /vat/]);
    var iAus    = col([/aussteller/, /firma/, /lieferant/, /haendler/, /verkaeufer/, /empfaenger/, /kunde/, /konto/, /name/]);
    var iKat    = col([/kategorie/, /^art$/, /^typ$/]);
    var iBesch  = col([/beschreibung/, /zweck/, /bezeichnung/, /verwendung/, /rechnungsnummer/, /belegnr/, /^nr$/, /text/]);
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var brutto = iBrutto >= 0 ? _parseDe(row[iBrutto]) : 0;
      var netto  = iNetto  >= 0 ? _parseDe(row[iNetto])  : 0;
      var ust    = iUst    >= 0 ? _parseDe(row[iUst])    : 0;
      if (!brutto && (netto || ust)) brutto = netto + ust;
      if (!brutto && !netto) continue;
      var kat = iKat >= 0 ? String(row[iKat] || '').trim() : '';
      if (KAT.indexOf(kat) < 0) kat = 'Sonstiges';
      out.push({
        datum: iDatum >= 0 ? String(row[iDatum] || '').trim() : '',
        aussteller: iAus >= 0 ? String(row[iAus] || '').trim() : '',
        betrag_netto: netto, ust_betrag: ust, betrag_brutto: brutto,
        kategorie: kat, konfidenz: 'Tabelle',
        beschreibung: iBesch >= 0 ? String(row[iBesch] || '').trim() : ''
      });
    }
    return out;
  }

  function _confClass(c) { c = String(c || '').toLowerCase(); if (c.indexOf('hoch') >= 0) return ''; if (c.indexOf('nied') >= 0 || c.indexOf('low') >= 0) return 'low'; return 'mid'; }


  function _render() {
    var box = document.getElementById('bi-review');
    if (!box) return;
    if (!_rows.length) { box.innerHTML = '<p style="color:#a4443d">Keine Belege gelesen.</p>'; return; }
    var opts = function (sel) { return KAT.map(function (k) { return '<option' + (k === sel ? ' selected' : '') + '>' + _esc(k) + '</option>'; }).join(''); };
    var body = _rows.map(function (r, i) {
      return '<tr' + (r.keep ? '' : ' class="off"') + ' data-i="' + i + '">' +
        '<td><input type="checkbox"' + (r.keep ? ' checked' : '') + ' onchange="DealPilotBelegImport._keep(' + i + ',this.checked)"></td>' +
        '<td>' + _esc(r.name) + (r.teil ? ' <span style="color:#b39a4e">#' + r.teil + '/' + r.teilvon + '</span>' : '') +
          (r.dup ? ' <span style="background:#B8625C;color:#fff;padding:0 6px;border-radius:10px;font-size:10px;font-weight:600">doppelt</span>' : '') +
          (r.junk ? ' <span style="background:#9a9a9a;color:#fff;padding:0 6px;border-radius:10px;font-size:10px;font-weight:600">ignoriert</span>' : '') +
          (r.beschreibung ? '<div style="font-size:11px;color:#999">' + _esc(r.beschreibung) + '</div>' : '') + '</td>' +
        '<td>' + _esc(r.datum) + '</td>' +
        '<td class="num">' + _fmtEur(r.netto) + ' €</td>' +
        '<td class="num">' + _fmtEur(r.ust) + ' €</td>' +
        '<td class="num" style="font-weight:600">' + _fmtEur(r.brutto) + ' €</td>' +
        '<td>' + _esc(r.aussteller) + '</td>' +
        '<td><select onchange="DealPilotBelegImport._kat(' + i + ',this.value)">' + opts(r.kategorie) + '</select></td>' +
        '<td><span class="bi-conf ' + _confClass(r.konfidenz) + '">' + _esc(r.konfidenz) + '</span></td>' +
      '</tr>';
    }).join('');
    box.innerHTML =
      '<table><thead><tr><th></th><th>Datei</th><th>Datum</th><th>Netto</th><th>USt</th><th>Brutto</th><th>Aussteller</th><th>Kategorie</th><th>Konfidenz</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>' +
      '<div class="bi-sums" id="bi-sums"></div>' +
      '<div id="bi-ampel"></div>';
    var take = document.getElementById('bi-take');
    if (take) take.disabled = false;
    var csvb = document.getElementById('bi-csv');
    if (csvb) csvb.disabled = false;
    _sums();
  }

  function _keep(i, v) { if (_rows[i]) { _rows[i].keep = !!v; var tr = document.querySelector('#bi-review tr[data-i="' + i + '"]'); if (tr) tr.classList.toggle('off', !v); _sums(); } }
  function _kat(i, v)  { if (_rows[i]) { _rows[i].kategorie = v; _sums(); } }

  /* Dubletten (gleiches Datum + Brutto) und Muell/0-/Summenzeilen automatisch
     markieren und abwaehlen (keep=false). Nutzer kann jederzeit wieder anhaken. */
  function _flagRows() {
    var seen = {};
    _rows.forEach(function (r) {
      var b = String(r.beschreibung || '').toLowerCase();
      var isJunk = (!(r.brutto > 0)) || /summe|offene posten|nicht lesbar|unleserlich|unlesbar/.test(b);
      r.junk = isJunk; r.dup = false;
      if (isJunk) { r.keep = false; return; }
      var d = String(r.datum || '').trim();
      var dok = d && d.toLowerCase() !== 'null' && d.indexOf('TT.MM') < 0 && /\d/.test(d);
      if (dok) {
        var key = d + '|' + r.brutto.toFixed(2);
        if (seen[key]) { r.dup = true; r.keep = false; } else { seen[key] = true; }
      }
    });
  }

  /* Zentrale Auswertung — genutzt von Anzeige (_sums) UND CSV-Export (csv).
     15-%-Ampel: §6 Abs. 1 Nr. 1a EStG (anschaffungsnahe HK). Basis =
     Gebäudeanteil (window._lastBmf.geb_pct) der Netto-AK (#ak_total dataset.raw).
     Orientierungswert — die taggenaue 3-Jahres-Frist folgt als eigener Ausbau. */
  function _aggregate() {
    var byField = {}, sanierung = 0, total = 0, count = 0;
    _rows.forEach(function (r) {
      if (!r.keep) return;
      count++; total += r.brutto;
      if (SANIERUNG[r.kategorie]) sanierung += r.brutto;   // fuer die 15%-Ampel
      var f = FIELD_MAP[r.kategorie];                       // Sanierung -> bmf_hk (Herstellungskosten Gebaeude)
      if (f) byField[f] = (byField[f] || 0) + r.brutto;
    });
    var uebernahme = 0;
    Object.keys(byField).forEach(function (f) { uebernahme += byField[f]; });

    var el = document.getElementById('ak_total');
    var akRaw = el && el.dataset && el.dataset.raw ? parseFloat(el.dataset.raw) : NaN;
    var gebPct = (window._lastBmf && window._lastBmf.geb_pct != null) ? window._lastBmf.geb_pct : null;
    var ampel = { cls: 'n', html: '', text: '' };
    if (!isFinite(akRaw) || akRaw <= 0 || gebPct == null) {
      ampel.html = 'Für die 15-%-Prüfung zuerst die Kaufpreisaufteilung im BMF-Rechner berechnen.';
      ampel.text = '15-Prozent-Pruefung: Aufteilung noch nicht berechnet';
    } else {
      var gebAk = akRaw * gebPct / 100, grenze = gebAk * 0.15;
      if (sanierung <= 0) {
        ampel.html = 'Keine Instandsetzungs-/Modernisierungsbelege — 15-%-Grenze nicht berührt. Grenze: ' + _fmtEur(grenze) + ' € (15 % der Gebäude-AK ' + _fmtEur(gebAk) + ' €).';
        ampel.text = 'keine Sanierung; Grenze ' + _fmtEur(grenze) + ' EUR';
      } else if (sanierung <= grenze) {
        ampel.cls = 'g';
        ampel.html = '<strong>Grün:</strong> Instandsetzung ' + _fmtEur(sanierung) + ' € liegt unter der Grenze von ' + _fmtEur(grenze) + ' € (15 % der Gebäude-AK). Fällt i.d.R. als Erhaltungsaufwand sofort abziehbar an.';
        ampel.text = 'GRUEN: Erhaltungsaufwand (' + _fmtEur(sanierung) + ' <= Grenze ' + _fmtEur(grenze) + ' EUR)';
      } else {
        ampel.cls = 'r';
        ampel.html = '<strong>Rot:</strong> Instandsetzung ' + _fmtEur(sanierung) + ' € überschreitet die Grenze von ' + _fmtEur(grenze) + ' € (15 % der Gebäude-AK) — dann anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) → über die AfA statt Sofortabzug. Bitte steuerlich prüfen.';
        ampel.text = 'ROT: anschaffungsnahe HK (' + _fmtEur(sanierung) + ' > Grenze ' + _fmtEur(grenze) + ' EUR)';
      }
    }
    return { byField: byField, sanierung: sanierung, uebernahme: uebernahme, total: total, count: count, ampel: ampel };
  }

  function _sums() {
    var a = _aggregate();
    var rowsHtml = Object.keys(a.byField).map(function (f) {
      return '<div class="k">' + _esc(LABELS[f] || f) + '</div><div class="v">' + _fmtEur(a.byField[f]) + ' €</div>';
    }).join('');
    if (a.sanierung > 0) rowsHtml += '<div class="k">Instandsetzung/Modernisierung</div><div class="v">' + _fmtEur(a.sanierung) + ' €</div>';
    rowsHtml += '<div class="k" style="border-top:1px solid #e6e0d2;padding-top:6px;font-weight:600">Übernahme gesamt</div>' +
                '<div class="v" style="border-top:1px solid #e6e0d2;padding-top:6px">' + _fmtEur(a.uebernahme) + ' €</div>';
    rowsHtml += '<div class="k">Belege ausgewählt</div><div class="v">' + a.count + '</div>';
    var sums = document.getElementById('bi-sums');
    if (sums) sums.innerHTML = rowsHtml || '<div class="k" style="grid-column:1/-1;color:#999">Keine Zeilen ausgewählt.</div>';
    var box = document.getElementById('bi-ampel');
    if (box) { box.className = 'bi-ampel ' + a.ampel.cls; box.innerHTML = a.ampel.html; }
  }

  /* ---------- CSV-Auswertung (Excel-freundlich: ; + Komma-Dezimal + BOM) ---------- */
  function _csvCell(s) {
    s = String(s == null ? '' : s);
    if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function _csvNum(n) {
    n = (typeof n === 'number' && isFinite(n)) ? n : 0;
    return n.toFixed(2).replace('.', ',');
  }
  function _stamp() {
    var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }
  function _download(name, text) {
    var blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }
  function csv() {
    if (!_rows.length) return;
    var D = ';', L = [];
    L.push(['Datei', 'Position', 'Datum', 'Netto', 'USt', 'Brutto', 'Aussteller', 'Beschreibung', 'Kategorie', 'Konfidenz', 'Uebernommen'].join(D));
    _rows.forEach(function (r) {
      var status = r.junk ? 'ignoriert' : (r.dup ? 'doppelt' : (!r.keep ? 'nein' : 'ja'));
      L.push([_csvCell(r.name), (r.teil ? (r.teil + '/' + r.teilvon) : ''), _csvCell(r.datum), _csvNum(r.netto), _csvNum(r.ust), _csvNum(r.brutto),
              _csvCell(r.aussteller), _csvCell(r.beschreibung), _csvCell(r.kategorie), _csvCell(r.konfidenz), status].join(D));
    });
    var a = _aggregate();
    L.push('');
    L.push(_csvCell('Zusammenfassung'));
    Object.keys(a.byField).forEach(function (f) { L.push([_csvCell(LABELS[f] || f), _csvNum(a.byField[f])].join(D)); });
    if (a.sanierung > 0) L.push([_csvCell('Instandsetzung/Modernisierung'), _csvNum(a.sanierung)].join(D));
    L.push([_csvCell('Uebernahme gesamt (ohne Sanierung)'), _csvNum(a.uebernahme)].join(D));
    L.push([_csvCell('Belege ausgewaehlt'), a.count].join(D));
    L.push([_csvCell('15-Prozent-Ampel'), _csvCell(a.ampel.text)].join(D));
    _download('dealpilot-belege-' + _stamp() + '.csv', L.join('\r\n'));
  }

  /* ---------- Übernahme ---------- */
  function _setOrAddField(id, amount, mode) {
    var el = document.getElementById(id);
    if (!el) return false;
    var nv = (mode === 'replace') ? amount : (_parseDe(el.value) + amount);
    el.value = nv.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    return true;
  }

  function apply() {
    var byField = {};
    _rows.forEach(function (r) {
      if (!r.keep) return;
      var f = FIELD_MAP[r.kategorie];
      if (f && r.brutto > 0) byField[f] = (byField[f] || 0) + r.brutto;
    });
    var targets = Object.keys(byField);
    if (!targets.length) { try { if (window.toast) window.toast('Nichts zu übernehmen.'); } catch (e) {} close(); return; }
    // Felder mit bereits vorhandenen Werten -> fragen: ersetzen oder addieren?
    var occupied = targets.filter(function (f) { var el = document.getElementById(f); return el && _parseDe(el.value) > 0; });
    var mode = 'add';
    if (occupied.length) {
      var names = occupied.map(function (f) { return LABELS[f] || f; }).join(', ');
      mode = window.confirm('Diese Felder haben bereits Werte:\n' + names + '\n\nOK = ERSETZEN (überschreiben)\nAbbrechen = zu bestehenden Werten ADDIEREN') ? 'replace' : 'add';
    }
    var n = 0;
    targets.forEach(function (f) { if (_setOrAddField(f, byField[f], mode)) n++; });
    try { if (typeof window.calcAk === 'function') window.calcAk(); } catch (e) {}
    try { if (typeof window.toast === 'function') window.toast(n + ' Feld(er) ' + (mode === 'replace' ? 'ersetzt' : 'aktualisiert') + '.'); } catch (e) {}
    close();
  }

  window.DealPilotBelegImport = {
    open: open, close: close, apply: apply, csv: csv,
    _keep: _keep, _kat: _kat
  };
})();
