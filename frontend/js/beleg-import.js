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

  var PDFJS_URL    = '/vendor/cdn/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = '/vendor/cdn/pdf.js/3.11.174/pdf.worker.min.js';
  var MAX_BELEGE   = 40;   // je Lauf; darüber -> zweiter Lauf (1 weiteres L)
  var MAX_PAGES    = 30;   // Seiten pro PDF (jede Seite = 1 Vision-Call, backend-seitig aggregiert)
  var _pdfjsLoaded = false;
  var _rows        = [];   // [{name, datum, netto, ust, brutto, aussteller, kategorie, konfidenz, keep}]
  /* v3154 · Prüfansicht: die gerenderten Seiten je Datei (nur im Browser, nur für dieses Fenster) und die
     Dateien, aus denen nichts kam - die stehen jetzt als rote Zeile in der Liste statt in einem Nebensatz. */
  var _bilder      = {};
  var _leer        = [];   // [{name, grund}]

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


  /* ═══════════════════════════════════════════════════════════════════════
     v1406 · ZWEITER MODUS: LAUFENDE WERBUNGSKOSTEN
     ═══════════════════════════════════════════════════════════════════════
     Bis hierher las dieses Modul nur ANSCHAFFUNGSKOSTEN — Notar, Makler,
     Grunderwerbsteuer, aufgerufen aus dem BMF-Modal. Das ist der Kauf.

     Marcels Wunsch ist das LAUFENDE Jahr: Hausgeld, Nebenkostenabrechnung,
     Grundsteuer, Handwerkerrechnung — und die Aufteilung, die eine
     Hausgeldabrechnung braucht.

     DREI UNTERSCHIEDE ZUM AK-MODUS:
       1. andere Kategorien und andere Zielfelder (Anlage V statt BMF)
       2. das JAHR zaehlt — eine Abrechnung fuer 2025 gehoert ins
          Veranlagungsjahr 2025, auch wenn sie im Mai 2026 kommt
       3. eine Kategorie fliesst ABSICHTLICH in KEIN Feld: die Zufuehrung
          zur Erhaltungsruecklage ist beim Eigentuemer nicht sofort
          abziehbar. Sie wird trotzdem angezeigt — damit der Nutzer sieht,
          dass sie erkannt und bewusst nicht uebernommen wurde.          */
  var _modus = 'ak';   /* 'ak' = Anschaffungskosten · 'wk' = Werbungskosten */

  var KAT_WK = [
    'Nebenkosten umlagefähig', 'Nebenkosten nicht umlagefähig',
    'Erhaltungsrücklage (nicht absetzbar)', 'Hausverwaltung',
    'Erhaltungsaufwand / Reparatur', 'Grundsteuer', 'Versicherung',
    'Schuldzinsen', 'Kontoführung', 'Steuerberatung',
    'Fahrtkosten', 'Inserat / Vermietung', 'Porto & Telefon',
    'Gericht & Rechtsanwalt', 'Sonstiges',
    /* v3154 · Reisekosten: der Reiter Steuer führt hotel und verpflegung - gemessen landete eine
       Hotelrechnung ohne diese Kategorien unter „Inserat / Vermietung". Verpflegung ist steuerlich nur
       als Pauschale (Verpflegungsmehraufwand) absetzbar, nicht nach Beleg: deshalb kein Feld (null). */
    'Übernachtung / Hotel', 'Verpflegung (nur Pauschale)'
  ];

  /* Kategorie -> Feld der Anlage-V-Jahrestabelle (tax.js, _taxYearlyOverrides).
     `null` heisst ausdruecklich: wird NICHT uebernommen. */
  var FIELD_MAP_WK = {
    'Nebenkosten umlagefähig':               'nk_umlf',
    'Nebenkosten nicht umlagefähig':         'nk_n_umlf',
    'Erhaltungsrücklage (nicht absetzbar)':  null,
    'Hausverwaltung':                        'hausverwaltung',
    'Erhaltungsaufwand / Reparatur':         'betr_sonst',
    'Grundsteuer':                           'betr_sonst',
    'Versicherung':                          'betr_sonst',
    'Schuldzinsen':                          'schuldzinsen',
    'Kontoführung':                          'kontofuehrung',
    'Steuerberatung':                        'steuerber',
    'Fahrtkosten':                           'fahrtkosten',
    'Inserat / Vermietung':                  'inserat',
    'Porto & Telefon':                       'porto',
    'Gericht & Rechtsanwalt':                'gericht',
    'Sonstiges':                             'sonst_kosten',
    'Übernachtung / Hotel':                  'hotel',
    'Verpflegung (nur Pauschale)':           null
  };

  var LABELS_WK = {
    nk_umlf: 'Umlagefähige Nebenkosten', nk_n_umlf: 'Nicht umlagefähige Nebenkosten',
    hausverwaltung: 'Hausverwaltung', betr_sonst: 'Sonstige Bewirtschaftung',
    schuldzinsen: 'Schuldzinsen', kontofuehrung: 'Kontoführung',
    steuerber: 'Steuerberatung', fahrtkosten: 'Fahrtkosten',
    inserat: 'Inserate / Vermietung', porto: 'Porto & Telefon',
    gericht: 'Gericht & Rechtsanwalt', sonst_kosten: 'Sonstige Kosten',
    hotel: 'Übernachtung / Hotel'
  };

  /* Die im aktuellen Modus geltenden Tabellen — damit der restliche Code
     nicht an zwanzig Stellen verzweigen muss. */
  function _katListe()  { return _modus === 'wk' ? KAT_WK : KAT; }
  function _feldKarte() { return _modus === 'wk' ? FIELD_MAP_WK : FIELD_MAP; }
  function _beschrift() { return _modus === 'wk' ? LABELS_WK : LABELS; }

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
        /* v3089 · ~2200 px breit für die Texterkennung auf dem Server (ocr.js), statt Faktor 2 (~1190 px) */
        var _vp0 = page.getViewport({ scale: 1 });
        var vp = page.getViewport({ scale: Math.min(3.8, 2200 / _vp0.width) });
        var canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        out.push(canvas.toDataURL('image/jpeg', 0.85));
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
      /* v1116-x: war ein nacktes Text-x (22px, #fff, opacity .75).
         Fassung B, gewaehlt am 08.08.2026. margin-left:auto bleibt —
         das schiebt den Knopf nach rechts und ist Layout, nicht Optik. */
      '#beleg-import-ov .bi-bar .bi-x{margin-left:auto;width:32px;height:32px;border-radius:9px;background:#17130d;border:1.5px solid var(--wl-e8cc7a, rgba(232,204,122,.8));color:var(--wl-e8cc7a, #E8CC7A);box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;position:relative;flex:0 0 auto;transition:background .16s,border-color .16s,color .16s,transform .16s}' +
      '#beleg-import-ov .bi-bar .bi-x svg{width:15px;height:15px;pointer-events:none}' +
      '#beleg-import-ov .bi-bar .bi-x::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max(100%,44px);height:max(100%,44px);background:transparent}' +
      '#beleg-import-ov .bi-bar .bi-x:hover{background:var(--wl-c9a84c, #C9A84C);border-color:var(--wl-e8cc7a, #E8CC7A);color:#1a1508}' +
      '#beleg-import-ov .bi-bar .bi-x:active{transform:scale(.94)}' +
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

  /* v1406: der Modus waehlt, WAS gelesen wird — 'wk' fuer laufende
     Werbungskosten, sonst Anschaffungskosten wie bisher. Ohne Argument
     bleibt alles, wie es war: der Aufruf aus dem BMF-Modal aendert sich
     nicht. */
  function open(modus) {
    _modus = (modus === 'wk') ? 'wk' : 'ak';
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
        '<div class="bi-bar"><span class="bi-t">📎 ' + (_modus === 'wk' ? 'Belege & Abrechnungen einlesen' : 'Belege importieren') + '</span>' +
          '<button class="bi-x" type="button" onclick="DealPilotBelegImport.close()" aria-label="Schließen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' + /* v1116-x */
        '<div class="bi-hero">KI liest Datum · Betrag · USt · Aussteller · Kategorie — du bestätigst jede Zeile, bevor sie in die ' + (_modus === 'wk' ? 'Werbungskosten' : 'Anschaffungskosten') + ' fließt.</div>' +   /* v2273: im WK-Modus stand hier „Anschaffungskosten“ */
        '<div class="bi-body">' +
          '<div class="bi-drop" id="bi-drop">' +
            '<div class="bi-big">Ordner mit Belegen wählen</div>' +
            /* v1187: stand hier als "1 Import-Lauf = 1 L Kerosin". Die Waehrung
               gibt es seit v1183 nicht, und der Import kostet seit v1183 gar
               nichts mehr — GEMESSEN in routes/ai.js:1058, dort steht nur noch
               logExtract(). Ein Kostenhinweis vor einer kostenlosen Funktion
               haelt Nutzer davon ab, sie zu benutzen. */
            '<div style="margin-bottom:14px">PDFs, Fotos (JPG/PNG), CSV oder Excel. In deinem Plan enthalten.</div>' +
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
          '<button class="bi-btn" id="bi-take" type="button" disabled onclick="DealPilotBelegImport.apply()">' + (_modus === 'wk' ? 'In die Werbungskosten übernehmen' : 'In die Anschaffungskosten übernehmen') + '</button></div>' +
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

  /* v1406 · Das Abrechnungsjahr eines Belegs.
     Reihenfolge mit Absicht: das ausdrueckliche `jahr` der KI zuerst, dann
     das Datum. Eine Hausgeldabrechnung traegt als Datum ihren Erstellungstag
     — das Jahr, um das es geht, steht woanders. Wer nur das Datum liest,
     bucht die Abrechnung 2025 ins Jahr 2026. */
  function _jahrAus(d) {
    var j = parseInt(d && d.jahr, 10);
    if (j >= 1990 && j <= 2200) return j;
    var s = String((d && d.datum) || '');
    var m = s.match(/(19|20)\d{2}/);
    if (m) {
      var j2 = parseInt(m[0], 10);
      if (j2 >= 1990 && j2 <= 2200) return j2;
    }
    return null;
  }

  /* Eine Zeile aus KI-Ergebnis ODER Tabellenzeile in _rows uebernehmen. */
  function _pushPositions(name, poss) {
    poss.forEach(function (d, idx) {
      var netto  = _parseDe(d.betrag_netto != null ? d.betrag_netto : d.netto);
      var ust    = _parseDe(d.ust_betrag  != null ? d.ust_betrag  : d.ust);
      var brutto = d.betrag_brutto != null ? _parseDe(d.betrag_brutto)
                 : (d.brutto != null ? _parseDe(d.brutto) : (netto + ust));
      if (!netto && brutto) netto = brutto - ust;
      var kat = _katListe().indexOf(d.kategorie) >= 0 ? d.kategorie : 'Sonstiges';
      _rows.push({
        name: name, teil: poss.length > 1 ? (idx + 1) : 0, teilvon: poss.length,
        datum: d.datum || '—', aussteller: d.aussteller || '—', beschreibung: d.beschreibung || '',
        /* v1406: das Abrechnungsjahr. Die KI liefert es im WK-Modus als
           eigenes Feld; sonst wird es aus dem Datum gelesen. Eine
           Hausgeldabrechnung fuer 2025, die im Mai 2026 kommt, gehoert
           ins Veranlagungsjahr 2025 — deshalb hat 'jahr' Vorrang. */
        jahr: _jahrAus(d),
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

    _rows = []; _bilder = {}; _leer = []; var docCount = 0; var leer = []; var skipped = [];

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
          if (imgs.length) { belege.push({ name: aiFiles[j].name, images: imgs }); _bilder[aiFiles[j].name] = imgs; }
          else skipped.push(aiFiles[j].name);
        } catch (e) { skipped.push(aiFiles[j].name); }
      }
      if (belege.length) {
        setT('KI liest ' + belege.length + ' Beleg(e) …');
        try {
          var resp = await fetch('/api/v1/ai/extract-beleg', { method: 'POST', headers: _hdrs(), body: JSON.stringify({ belege: belege, modus: _modus }) });
          /* v1187: seit v1183 gibt es hier keine 402 mehr — der Beleg-Import
             ist im Plan enthalten. Der Zweig bleibt als Riegel stehen, falls
             das je zurueckgedreht wird, aber ohne die alte Waehrung. */
          if (resp.status === 402) { belege.forEach(function (b) { leer.push(b.name + ' (Kontingent aufgebraucht)'); }); }
          else if (resp.status === 403) { belege.forEach(function (b) { leer.push(b.name + ' (ab Investor)'); }); }
          else if (!resp.ok) { belege.forEach(function (b) { leer.push(b.name + ' (Fehler ' + resp.status + ')'); }); }
          else {
            var res = await resp.json();
            var nochmal = [];
            (res && res.results || []).forEach(function (r) {
              var poss = Array.isArray(r.positionen) ? r.positionen : (r.data ? [r.data] : []);
              if (poss.length) { docCount++; _pushPositions(r.name, poss); }
              else nochmal.push(r);
            });
            /* v3154 · SICHERHEITSSCHLEIFE: was im Sammellauf nichts ergab, wird einmal EINZELN neu gelesen
               (eigener Abruf, volle Aufmerksamkeit für diese eine Datei). Erst danach gilt es als unlesbar. */
            for (var q = 0; q < nochmal.length; q++) {
              var r0 = nochmal[q], b0 = q < 5 ? belege.filter(function (b) { return b.name === r0.name; })[0] : null;   /* höchstens 5 Zweitversuche je Lauf (Grenze 30 Abrufe je Stunde) */
              var poss2 = [];
              if (b0) {
                setT('Zweiter Leseversuch: ' + r0.name + ' (' + (q + 1) + '/' + nochmal.length + ')');
                try {
                  var resp2 = await fetch('/api/v1/ai/extract-beleg', { method: 'POST', headers: _hdrs(), body: JSON.stringify({ belege: [b0], modus: _modus, einzeln: true }) });
                  if (resp2.ok) {
                    var res2 = await resp2.json(), x2 = res2 && res2.results && res2.results[0];
                    if (x2) poss2 = Array.isArray(x2.positionen) ? x2.positionen : (x2.data ? [x2.data] : []);
                    if (!poss2.length && x2) r0 = x2;
                  }
                } catch (e2) {}
              }
              if (poss2.length) {
                docCount++; var vorher = _rows.length; _pushPositions(r0.name, poss2);
                for (var z = vorher; z < _rows.length; z++) _rows[z].zweiter = true;
              } else leer.push(r0.name + (r0.diag ? ' (' + r0.diag + ')' : (r0.error ? ' (' + r0.error + ')' : '')));
            }
          }
        } catch (e) { belege.forEach(function (b) { leer.push(b.name + ' (Netzwerkfehler)'); }); }
      }
    }

    _flagRows();
    _pruefen();
    var ohne = skipped.map(function (n) { return n + ' (nicht renderbar)'; }).concat(leer);
    _leer = ohne.map(function (t) { var m = t.match(/^(.*?) \((.*)\)$/); return m ? { name: m[1], grund: m[2] } : { name: t, grund: '' }; });
    var nDup = _rows.filter(function (r) { return r.dup; }).length;
    var nJunk = _rows.filter(function (r) { return r.junk; }).length;
    var note = document.getElementById('bi-note');
    if (note) {
      var t = docCount + ' Datei(en) gelesen · ' + _rows.length + ' Position(en) erkannt. Prüfe jede Zeile, bevor du übernimmst.';
      if (nDup || nJunk) t += ' ' + nDup + ' doppelt und ' + nJunk + ' ohne Wert automatisch abgewählt.';
      if (ohne.length) t += ' ' + ohne.length + ' Datei(en) ohne Ergebnis – rot markiert, sie werden NICHT übernommen.';
      var nPr = _rows.filter(function (r) { return r.pruefen && r.pruefen.length; }).length;
      if (nPr) t += ' ' + nPr + ' Zeile(n) mit „prüfen" – Bild und Werte über das Vorschaubild vergleichen.';
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
      s.src = '/vendor/cdn/xlsx/0.18.5/xlsx.full.min.js';
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
      if (_katListe().indexOf(kat) < 0) kat = 'Sonstiges';
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
    var leerZeilen = _leer.map(function (x, k) {
      return '<tr class="bi-leer" style="background:rgba(184,98,92,.10)"><td></td><td>' + _mini(x.name, 'DealPilotBelegImport._ansehenLeer(' + k + ')') + '</td>'
        + '<td colspan="8" style="color:#B8625C;font-weight:600">⚠ ' + _esc(x.name) + ' – nichts gelesen' + (x.grund ? ' (' + _esc(x.grund) + ')' : '')
        + '<div style="font-weight:400;font-size:11.5px">Auch der zweite Leseversuch ergab keinen Betrag. Diese Datei wird nicht übernommen – bitte ansehen und von Hand eintragen.</div></td></tr>';
    }).join('');
    var leerBanner = _leer.length ? '<div style="margin:0 0 10px;padding:10px 12px;border-radius:8px;background:rgba(184,98,92,.10);border:1px solid rgba(184,98,92,.5);color:#B8625C;font-weight:600">⚠ '
      + _leer.length + ' Datei(en) konnten nicht gelesen werden und werden nicht übernommen. Sie stehen rot unten in der Liste.</div>' : '';
    if (!_rows.length) {
      box.innerHTML = leerBanner + (leerZeilen ? '<table><tbody>' + leerZeilen + '</tbody></table>' : '<p style="color:#a4443d">Keine Belege gelesen.</p>');
      return;
    }
    var opts = function (sel) { return _katListe().map(function (k) { return '<option' + (k === sel ? ' selected' : '') + '>' + _esc(k) + '</option>'; }).join(''); };
    var body = _rows.map(function (r, i) {
      return '<tr' + (r.keep ? '' : ' class="off"') + ' data-i="' + i + '">' +
        '<td><input type="checkbox"' + (r.keep ? ' checked' : '') + ' onchange="DealPilotBelegImport._keep(' + i + ',this.checked)"></td>' +
        '<td>' + _mini(r.name, 'DealPilotBelegImport._ansehen(' + i + ')') + '</td>' +
        '<td>' + _esc(r.name) +
          (r.pruefen && r.pruefen.length ? ' <span title="' + _esc(r.pruefen.join(' · ')) + '" style="background:var(--wl-c9a84c,#C9A84C);color:#2A2727;padding:0 6px;border-radius:10px;font-size:10px;font-weight:700;cursor:help">prüfen</span>' : '') + (r.teil ? ' <span style="color:#b39a4e">#' + r.teil + '/' + r.teilvon + '</span>' : '') +
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
    box.innerHTML = leerBanner +
      '<table><thead><tr><th></th><th>Bild</th><th>Datei</th><th>Datum</th><th>Netto</th><th>USt</th><th>Brutto</th><th>Aussteller</th><th>Kategorie</th><th>Konfidenz</th></tr></thead>' +
      '<tbody>' + body + leerZeilen + '</tbody></table>' +
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
  /* v3154 · PRÜFSCHLEIFE je Zeile: was nicht zusammenpasst, wird benannt (Pille „prüfen"); ohne Betrag oder
     ohne Jahr wird die Zeile abgewählt, weil sie nicht richtig landen kann. Nichts wird still korrigiert. */
  function _pruefen() {
    _rows.forEach(function (r) {
      var g = [];
      if (!(r.brutto > 0)) g.push('kein Betrag erkannt');
      if (r.netto > 0 && r.ust >= 0 && r.brutto > 0 && Math.abs(r.netto + r.ust - r.brutto) > Math.max(1, r.brutto * 0.01)) g.push('Netto + USt ergibt nicht den Bruttobetrag');
      var d = String(r.datum || '').trim();
      if (!d || d === '—' || !/\d/.test(d)) g.push('kein Rechnungsdatum erkannt');
      if (!r.jahr) g.push('kein Jahr erkannt – bitte Datum prüfen');
      if (!r.aussteller || r.aussteller === '—') g.push('kein Aussteller erkannt');
      if (/nied|low/i.test(String(r.konfidenz || ''))) g.push('die Lesung war unsicher');
      if (r.brutto > 25000) g.push('ungewöhnlich hoher Betrag');
      if (r.zweiter) g.push('erst im zweiten Leseversuch erkannt');
      r.pruefen = g;
      if (!r.jahr && _modus === 'wk') r.keep = false;
    });
    /* v3154c · PRÜFUNG JE DATEI. Gemessen an einer Hotelrechnung (zwei Läufe, zwei Ergebnisse): die KI meldete
       einmal die Gesamtzeile als eigene Position und die Kurtaxe von Seite 2 ein zweites Mal - übernommen wäre
       die Übernachtung doppelt gezählt. Summen-, Gesamt- und Doppelzeilen werden deshalb benannt und abgewählt. */
    var jeDatei = {};
    _rows.forEach(function (r) { if (!r.junk) (jeDatei[r.name] = jeDatei[r.name] || []).push(r); });
    Object.keys(jeDatei).forEach(function (nm) {
      var g = jeDatei[nm];
      if (g.length < 2) return;
      g.forEach(function (r, k) {
        var andere = g.filter(function (x) { return x !== r && !x.summe; });
        var summe = andere.reduce(function (a, x) { return a + (x.brutto || 0); }, 0);
        if (andere.length >= 2 && r.brutto > 0 && Math.abs(r.brutto - summe) <= Math.max(0.5, r.brutto * 0.01)) {
          r.summe = true; r.keep = false; r.pruefen.push('ist die Summe der übrigen Positionen – nicht zusätzlich übernommen'); return;
        }
        if (/gesamt|summe|\btotal\b|endbetrag|rechnungsbetrag/i.test(String(r.beschreibung || ''))) {
          r.keep = false; r.pruefen.push('sieht nach dem Gesamtbetrag aus – nicht zusätzlich zu den Einzelpositionen übernehmen');
        }
        var vorher = g.slice(0, k).filter(function (x) { return x.kategorie === r.kategorie && Math.abs((x.brutto || 0) - (r.brutto || 0)) < 0.01; });
        if (vorher.length) { r.keep = false; r.pruefen.push('möglicherweise doppelt (gleicher Betrag und gleiche Kategorie, oft von Seite 2)'); }
      });
    });
  }
  function _werteZeile(r) {
    return [['Datum', r.datum], ['Jahr', r.jahr || '–'], ['Aussteller', r.aussteller], ['Beschreibung', r.beschreibung],
      ['Netto', _fmtEur(r.netto) + ' €'], ['USt', _fmtEur(r.ust) + ' €'], ['Brutto', _fmtEur(r.brutto) + ' €'], ['Kategorie', r.kategorie], ['Sicherheit der Lesung', r.konfidenz]];
  }
  function _ansehen(i) {
    var r = _rows[i]; if (!r || !window.DpEingang || !window.DpEingang.vorschau) return;
    var alle = _rows.filter(function (x) { return x.name === r.name; }), werte = [];
    alle.forEach(function (x, k) {
      if (alle.length > 1) werte.push(['— Position ' + (k + 1) + ' von ' + alle.length + (x.keep ? '' : ' (abgewählt)'), ' ']);
      werte = werte.concat(_werteZeile(x));
    });
    var h = []; alle.forEach(function (x) { (x.pruefen || []).forEach(function (g) { if (h.indexOf(g) < 0) h.push(g); }); });
    var gew = alle.filter(function (x) { return x.keep; }).reduce(function (a, x) { return a + (x.brutto || 0); }, 0);
    h.push('Ausgewählt aus dieser Datei: ' + _fmtEur(gew) + ' € brutto – bitte mit dem Rechnungsbetrag auf dem Bild vergleichen.');   /* v3154c */
    window.DpEingang.vorschau({ titel: r.name, bilder: _bilder[r.name] || null, werte: werte, hinweise: h });
  }
  function _ansehenLeer(k) {
    var x = _leer[k]; if (!x || !window.DpEingang || !window.DpEingang.vorschau) return;
    window.DpEingang.vorschau({ titel: x.name, bilder: _bilder[x.name] || null, werte: [],
      warnung: 'Aus dieser Datei konnte auch im zweiten Versuch nichts gelesen werden' + (x.grund ? ' (' + x.grund + ')' : '') + '. Sie wird nicht übernommen – bitte die Beträge von Hand im Reiter Steuer eintragen.' });
  }
  function _mini(name, onclick) {
    var b = _bilder[name];
    return b && b[0] ? '<img src="' + b[0] + '" alt="" title="Ansehen: Bild und gelesene Werte" onclick="' + onclick + '" style="width:38px;height:50px;object-fit:cover;object-position:top;border-radius:3px;border:1px solid #ddd;cursor:zoom-in;background:#fff;display:block">'
      : '<button type="button" onclick="' + onclick + '" style="font-size:11px;padding:3px 6px;cursor:pointer">Ansehen</button>';
  }

  function _flagRows() {
    var seen = {};
    _rows.forEach(function (r) {
      var b = String(r.beschreibung || '').toLowerCase();
      var isJunk = (!(r.brutto > 0)) || /^\s*(summe|gesamtsumme|zwischensumme)\b|offene posten|nicht lesbar|unleserlich|unlesbar/.test(b);   /* v3154c */
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
     Gebaeude-Anschaffungskosten aus State._ahk.sanLimit (v3029-rechnen, netto verglichen).
     Orientierungswert — die taggenaue 3-Jahres-Frist folgt als eigener Ausbau. */
  function _aggregate() {
    var byField = {}, sanierung = 0, sanNetto = 0, total = 0, count = 0;
    _rows.forEach(function (r) {
      if (!r.keep) return;
      count++; total += r.brutto;
      if (SANIERUNG[r.kategorie]) {
        sanierung += r.brutto;   // Anzeige und Uebernahme: brutto (Werbungskosten des Privatvermieters)
        /* v3029-rechnen: die 15-%-Grenze misst OHNE Umsatzsteuer (§ 6 Abs. 1 Nr. 1a EStG).
           Netto vom Beleg, wenn er eine USt ausweist; sonst brutto / 1,19 wie calc.js. */
        sanNetto += (r.ust > 0 && r.netto > 0) ? r.netto : (r.brutto / 1.19);
      }
      var f = _feldKarte()[r.kategorie];                       // Sanierung -> bmf_hk (Herstellungskosten Gebaeude)
      if (f) byField[f] = (byField[f] || 0) + r.brutto;
    });
    var uebernahme = 0;
    Object.keys(byField).forEach(function (f) { uebernahme += byField[f]; });

    /* v3029-rechnen · DIE GRENZE AUS DERSELBEN RECHNUNG WIE STEUER UND INVESTITION.
       Bis v3028: Grenze = ak_total x Gebaeudeanteil x 15 %, verglichen mit dem
       BRUTTO-Betrag der Belege. ak_total enthaelt aber ak_ahk - die geplante
       Sanierung selbst (bmf-modal.js v2260) - und weder Inventar noch Grundschuld
       waren herausgerechnet. Gemessen: Kaufpreis 300.000, NK 30.000, Gebaeude 60 %,
       Sanierung 35.000 brutto: richtig Grenze 29.700, netto 29.412 -> gruen; die
       Ampel zeigte Grenze 32.850 gegen 35.000 brutto -> rot.
       Jetzt: State._ahk.sanLimit (calc.js, dieselbe Zahl, mit der tax.js die
       Sanierung einordnet), Ersatz ueber window._dpBmfAhk (Gebaeude-AHK der
       BMF-Variante); verglichen wird netto. */
    var grenze = null, gebAk = null;
    if (window.State && State._ahk && isFinite(State._ahk.sanLimit) && State._ahk.sanLimit > 0) {
      grenze = State._ahk.sanLimit; gebAk = isFinite(State._ahk.gebAhk) ? State._ahk.gebAhk : grenze / 0.15;
    } else {
      var gebPct = (window._lastBmf && window._lastBmf.geb_pct != null) ? window._lastBmf.geb_pct : null;
      if (gebPct != null && typeof window._dpBmfAhk === 'function') {
        try { var _ahk = window._dpBmfAhk(gebPct); if (_ahk && _ahk.gebAhk > 0) { gebAk = _ahk.gebAhk; grenze = gebAk * 0.15; } } catch (e) {}
      }
    }
    var ampel = { cls: 'n', html: '', text: '' };
    var _nt = ' netto (' + _fmtEur(sanierung) + ' € brutto)';
    if (grenze == null) {
      ampel.html = 'Für die 15-%-Prüfung zuerst Kaufpreis und Gebäudeanteil eintragen oder die Kaufpreisaufteilung im BMF-Rechner berechnen.';
      ampel.text = '15-Prozent-Pruefung: Gebaeude-Anschaffungskosten noch nicht berechnet';
    } else {
      if (sanierung <= 0) {
        ampel.html = 'Keine Instandsetzungs-/Modernisierungsbelege — 15-%-Grenze nicht berührt. Grenze: ' + _fmtEur(grenze) + ' € netto (15 % der Gebäude-Anschaffungskosten ' + _fmtEur(gebAk) + ' €).';
        ampel.text = 'keine Sanierung; Grenze ' + _fmtEur(grenze) + ' EUR netto';
      } else if (sanNetto <= grenze) {
        ampel.cls = 'g';
        ampel.html = '<strong>Grün:</strong> Instandsetzung ' + _fmtEur(sanNetto) + ' €' + _nt + ' liegt unter der Grenze von ' + _fmtEur(grenze) + ' € netto (15 % der Gebäude-Anschaffungskosten). Fällt i.d.R. als Erhaltungsaufwand sofort abziehbar an — Erweiterungen und Standardhebungen ausgenommen.';
        ampel.text = 'GRUEN: Erhaltungsaufwand (' + _fmtEur(sanNetto) + ' netto <= Grenze ' + _fmtEur(grenze) + ' EUR)';
      } else {
        ampel.cls = 'r';
        ampel.html = '<strong>Rot:</strong> Instandsetzung ' + _fmtEur(sanNetto) + ' €' + _nt + ' überschreitet die Grenze von ' + _fmtEur(grenze) + ' € netto (15 % der Gebäude-Anschaffungskosten) — dann sind ALLE diese Aufwendungen anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) → über die AfA statt Sofortabzug. Bitte steuerlich prüfen.';
        ampel.text = 'ROT: anschaffungsnahe HK (' + _fmtEur(sanNetto) + ' netto > Grenze ' + _fmtEur(grenze) + ' EUR)';
      }
    }
    return { byField: byField, sanierung: sanierung, uebernahme: uebernahme, total: total, count: count, ampel: ampel };
  }

  function _sums() {
    var a = _aggregate();
    var rowsHtml = Object.keys(a.byField).map(function (f) {
      return '<div class="k">' + _esc(_beschrift()[f] || f) + '</div><div class="v">' + _fmtEur(a.byField[f]) + ' €</div>';
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
    Object.keys(a.byField).forEach(function (f) { L.push([_csvCell(_beschrift()[f] || f), _csvNum(a.byField[f])].join(D)); });
    if (a.sanierung > 0) L.push([_csvCell('Instandsetzung/Modernisierung'), _csvNum(a.sanierung)].join(D));
    L.push([_csvCell('Übernahme gesamt (ohne Sanierung)'), _csvNum(a.uebernahme)].join(D));
    L.push([_csvCell('Belege ausgewählt'), a.count].join(D));
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

  /* ═══ v1406 · ÜBERNAHME IM WK-MODUS ══════════════════════════════════════
     Anders als bei den Anschaffungskosten gibt es hier kein einzelnes
     Zielfeld je Kategorie, sondern ein Zielfeld JE JAHR. Deshalb wird
     zuerst nach Jahr gruppiert und dann je Jahr übergeben.

     Was hier absichtlich NICHT passiert: raten, in welches Jahr ein Beleg
     ohne Jahresangabe gehört. Solche Zeilen werden benannt und übersprungen
     — der Nutzer kann das Jahr in der Liste nachtragen. Ein falsch
     gebuchtes Jahr fällt später niemandem auf, und dann steht die
     Abrechnung im falschen Veranlagungszeitraum.                        */
  function _applyWk() {
    var jeJahr = {}, ohneJahr = 0, nichtAbsetzbar = 0, nichtAbsetzbarEur = 0, nichtJeKat = {};
    _rows.forEach(function (r) {
      if (!r.keep) return;
      if (!(r.brutto > 0)) return;
      var f = FIELD_MAP_WK[r.kategorie];
      /* `null` ist eine ANTWORT, kein fehlender Eintrag: die Zuführung zur
         Erhaltungsrücklage ist beim Eigentümer nicht sofort abziehbar. */
      if (f === null) { nichtAbsetzbar++; nichtAbsetzbarEur += r.brutto; nichtJeKat[r.kategorie] = (nichtJeKat[r.kategorie] || 0) + r.brutto; return; }
      if (!f) return;
      if (!r.jahr) { ohneJahr++; return; }
      var k = String(r.jahr);
      (jeJahr[k] = jeJahr[k] || {});
      jeJahr[k][f] = (jeJahr[k][f] || 0) + r.brutto;
    });

    var jahre = Object.keys(jeJahr);
    if (!jahre.length) {
      var m = 'Nichts zu übernehmen.';
      if (ohneJahr) m = ohneJahr + ' Position(en) ohne erkennbares Jahr — bitte das Jahr in der Liste ergänzen.';
      else if (nichtAbsetzbar) m = 'Nur nicht absetzbare Posten erkannt (' + Object.keys(nichtJeKat).join(', ') + ') — Rücklagenzuführung erst bei Verwendung, Verpflegung nur als Pauschale.';
      try { if (window.toast) window.toast(m); } catch (e) {}
      return;
    }
    if (typeof window.dpWkUebernehmen !== 'function') {
      try { if (window.toast) window.toast('✗ Steuer-Modul nicht geladen — Seite neu laden.'); } catch (e) {}
      return;
    }

    /* Vorhandene Jahre, die der Tab Steuern gar nicht führt, benennen —
       sonst landet ein Beleg in einem Jahr, das niemand sieht. */
    var gefuehrt = [];
    try { gefuehrt = (typeof window.dpWkJahre === 'function') ? (window.dpWkJahre() || []) : []; } catch (e) {}
    var fremd = gefuehrt.length
      ? jahre.filter(function (j) { return gefuehrt.indexOf(parseInt(j, 10)) < 0; })
      : [];

    var text = 'Diese Beträge werden zu den Werten der Jahre ADDIERT:\n\n'
      + jahre.sort().map(function (j) {
          var f = jeJahr[j];
          return j + ':  ' + Object.keys(f).map(function (k) {
            return (LABELS_WK[k] || k) + ' ' + _fmtEur(f[k]) + ' €';
          }).join(' · ');
        }).join('\n')
      + (fremd.length ? '\n\nACHTUNG: Für ' + fremd.join(', ') + ' führt dieser Objekt-Tab kein Jahr. '
                        + 'Der Wert wird trotzdem hinterlegt, ist aber erst sichtbar, wenn der '
                        + 'Betrachtungszeitraum so weit reicht.' : '')
      + (_leer.length ? '\n\nNICHT gelesen und nicht übernommen: ' + _leer.map(function (x) { return x.name; }).join(', ') : '')
      + (function () { var p = _rows.filter(function (r) { return r.keep && r.pruefen && r.pruefen.length; }).length; return p ? '\n\n' + p + ' ausgewählte Zeile(n) tragen den Hinweis „prüfen".' : ''; })()
      + '\n\nOK = übernehmen (addieren)\nAbbrechen = nichts tun';
    if (!window.confirm(text)) return;

    var n = 0, jahreOk = [];
    var _E = window.DpEingang && window.DpEingang.txStart ? window.DpEingang : null;   /* v3154 · für „Zurücknehmen" */
    if (_E) _E.txStart();
    jahre.forEach(function (j) {
      var r = window.dpWkUebernehmen(parseInt(j, 10), jeJahr[j], 'add');
      if (r && r.ok) { n += r.anzahl; jahreOk.push(j); }
    });
    try {
      var _aend = _E ? _E.txEnde() : [];
      var _gen = {}; _rows.forEach(function (r) { if (r.keep && r.brutto > 0 && r.jahr) _gen[r.name] = true; });
      if (_E) _E.protokoll({ quelle: 'Belege', aenderungen: _aend,
        dokumente: Object.keys(_gen).map(function (nm) { return { name: nm, typ: 'Beleg' }; }),
        uebernommen: jahreOk.sort().map(function (j) { var f = jeJahr[j]; return 'Steuer ' + j + ': ' + Object.keys(f).map(function (k) { return (LABELS_WK[k] || k) + ' +' + _fmtEur(f[k]) + ' €'; }).join(' · '); }),
        nicht_gelesen: _leer.map(function (x) { return x.name; }) });
    } catch (e) {}

    var meld = n + ' Position(en) in ' + jahreOk.length + ' Jahr(en) übernommen.';
    if (nichtAbsetzbar) {
      meld += ' Bewusst NICHT übernommen: ' + Object.keys(nichtJeKat).map(function (k) { return k + ' ' + _fmtEur(nichtJeKat[k]) + ' €'; }).join(', ')
        + ' (Rücklagenzuführung erst bei Verwendung absetzbar, Verpflegung nur als Pauschale).';
    }
    if (ohneJahr) meld += ' ' + ohneJahr + ' ohne Jahr übersprungen.';
    try { if (window.toast) window.toast(meld); } catch (e) {}
    close();
  }

  function apply() {
    if (_modus === 'wk') { _applyWk(); return; }
    var byField = {};
    _rows.forEach(function (r) {
      if (!r.keep) return;
      var f = _feldKarte()[r.kategorie];
      if (f && r.brutto > 0) byField[f] = (byField[f] || 0) + r.brutto;
    });
    var targets = Object.keys(byField);
    if (!targets.length) { try { if (window.toast) window.toast('Nichts zu übernehmen.'); } catch (e) {} close(); return; }
    // Felder mit bereits vorhandenen Werten -> fragen: ersetzen oder addieren?
    var occupied = targets.filter(function (f) { var el = document.getElementById(f); return el && _parseDe(el.value) > 0; });
    var mode = 'add';
    if (occupied.length) {
      var names = occupied.map(function (f) { return _beschrift()[f] || f; }).join(', ');
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
    /* v3120 · der gemeinsame Eingang (unterlagen-eingang.js) übergibt erkannte Rechnungen direkt */
    oeffnenMit: function (files, modus) { open(modus || 'wk'); if (files && files.length) setTimeout(function () { _onPick(files); }, 50); },
    _keep: _keep, _kat: _kat,
    /* v3154 */ bilder: _fileToImages, _ansehen: _ansehen, _ansehenLeer: _ansehenLeer
  };
})();
