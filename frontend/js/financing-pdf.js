'use strict';

/* ═══════════════════════════════════════════════════════════════════
   DealPilot - financing-pdf.js V63.50

   PDF-Parser für Finanzierungs-Dokumente (Bankvertrag / Bausparvertrag)
   mit OCR-Fallback für gescannte PDFs (iPhone-Foto, etc.).

   Strategie:
   1. Erst Text-Extraktion via pdf.js
   2. Wenn Text < 200 Zeichen -> vermutlich Scan -> OCR via Tesseract.js
   3. Pattern-Matching auf den Text (Standard-Banken: BBBank,
      Sparkasse, Volksbank, Wüstenrot, Schwäbisch Hall etc.)
   4. Bestätigungs-Dialog mit erkannten Werten - User kann anpassen
═══════════════════════════════════════════════════════════════════ */

(function() {

  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
  var _pdfjsLoaded = false;
  var _tesseractLoaded = false;

  function _loadScript(url) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function() { resolve(); };
      s.onerror = function() { reject(new Error('Script Download fehlgeschlagen: ' + url)); };
      document.head.appendChild(s);
    });
  }

  function _loadPdfJs() {
    if (_pdfjsLoaded || window.pdfjsLib) {
      _pdfjsLoaded = true;
      if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      }
      return Promise.resolve();
    }
    return _loadScript(PDFJS_URL).then(function() {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        _pdfjsLoaded = true;
      } else throw new Error('pdf.js nicht verfügbar');
    });
  }

  function _loadTesseract() {
    if (_tesseractLoaded || window.Tesseract) { _tesseractLoaded = true; return Promise.resolve(); }
    return _loadScript(TESSERACT_URL).then(function() {
      if (window.Tesseract) _tesseractLoaded = true;
      else throw new Error('Tesseract.js nicht verfügbar');
    });
  }

  // ── Text-Extraktion via pdf.js ──────────────────────────────────
  async function _extractText(file) {
    var ab = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    var parts = [];
    for (var i = 1; i <= Math.min(pdf.numPages, 25); i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      parts.push(content.items.map(function(it) { return it.str; }).join(' '));
    }
    return { text: parts.join('\n\n'), pdf: pdf };
  }

  // ── OCR-Fallback für gescannte PDFs ─────────────────────────────
  async function _ocrFallback(pdf, statusFn) {
    statusFn = statusFn || function() {};
    statusFn('Lade Texterkennung (OCR) - beim ersten Mal kann das ~30 Sekunden dauern…');
    await _loadTesseract();

    var totalPages = Math.min(pdf.numPages, 25);
    var allText = [];
    var worker = await window.Tesseract.createWorker('deu', 1);

    try {
      for (var i = 1; i <= totalPages; i++) {
        statusFn('OCR Seite ' + i + ' von ' + totalPages + '…');
        var page = await pdf.getPage(i);
        var viewport = page.getViewport({ scale: 2.0 });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        var dataUrl = canvas.toDataURL('image/png');
        var result = await worker.recognize(dataUrl);
        allText.push(result.data.text || '');
        canvas.width = 0; canvas.height = 0;
      }
    } finally {
      try { await worker.terminate(); } catch(_) {}
    }
    return allText.join('\n\n');
  }

  // ── Helper ──────────────────────────────────────────────────────
  function _parseNum(s) {
    if (!s) return null;
    s = String(s).trim().replace(/€|EUR|Euro/gi, '').trim();
    if (!/,\d/.test(s) && /\.\d{3}/.test(s) && !/\.\d{2}$/.test(s)) {
      s = s.replace(/\./g, '');
    } else if (/,\d/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function _findFirst(text, regexes) {
    for (var i = 0; i < regexes.length; i++) {
      var m = text.match(regexes[i]);
      if (m) return m;
    }
    return null;
  }

  // ── Parser ──────────────────────────────────────────────────────
  function _parseFinancingPdf(text, target) {
    var lower = text.toLowerCase();
    var result = { _target: target, _detectedType: null, fields: {}, _meta: {} };

    if (target === 'auto') {
      if (/bauspar/.test(lower)) result._detectedType = 'bspar';
      else if (/kfw|kreditanstalt/.test(lower)) result._detectedType = 'd2';
      else result._detectedType = 'd1';
      target = result._detectedType;
      result._target = target;
    } else {
      result._detectedType = target;
    }

    if (target === 'd1' || target === 'd2') {
      // Darlehensbetrag - viele Schreibweisen
      var dMatch = _findFirst(text, [
        /Darlehen\s+in\s+H[öo]he\s+von\s+EUR\s*([\d\.\,]+)/i,
        /Kreditbetrag\s+und\s+W[äa]hrung[:\s]+([\d\.\,]+)\s*EUR/i,
        /(?:Darlehens|Kredit)(?:betrag|summe|nennbetrag|h[öo]he)\s*[:\s]+(?:EUR\s*)?([\d\.\,]+)\s*(?:€|EUR)?/i,
        /H[öo]he\s+des\s+Darlehens[\s\S]{0,80}?(?:EUR\s+)?([\d\.\,]{6,15})/i,
        /Nettokredit\w*\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i,
        /stellt\s+dem\s+Darlehens?nehmer[\s\S]{0,150}?H[öo]he\s+von[\s\S]{0,30}?([\d\.\,]{6,15})/i
      ]);
      if (dMatch) {
        var dVal = _parseNum(dMatch[1]);
        if (dVal && dVal > 1000) {
          result.fields[target] = dVal;
          result._meta.darlehen_snippet = dMatch[0].slice(0, 80);
        }
      }

      // Sollzinssatz
      var zMatch = _findFirst(text, [
        /Sollzinssatz\s+betr[äa]gt\s+bei\s+Vertragsschluss\s+([\d\,\.]+)\s*%/i,
        /Sollzinssatz\s+von\s+([\d\,\.]+)\s*%/i,
        /(?:Sollzins|Nominalzins|Zinssatz nominal|nominaler? Zinssatz)\s*[:\s]+([\d\,\.]+)\s*%/i,
        /Zinssatz\s*[:\s]+([\d\,\.]+)\s*%\s*j[äa]hrlich/i,
        /([\d\,\.]+)\s*%\s*(?:p\.\s*a\.|j[äa]hrlich|nominal|Sollzins)/i
      ]);
      if (zMatch) {
        var zVal = _parseNum(zMatch[1]);
        if (zVal && zVal > 0 && zVal < 20) {
          result.fields[target + 'z'] = zVal;
          result._meta.zins_snippet = zMatch[0].slice(0, 80);
        }
      }

      // Tilgungssatz
      var tMatch = _findFirst(text, [
        /Tilgungssatz[\s\S]{0,80}?H[öo]he\s+von\s+([\d\,\.]+)\s*%/i,
        /(?:anf[äa]ngliche?r?\s+)?Tilgungssatz\s*[:\s]+([\d\,\.]+)\s*%/i,
        /(?:anf[äa]ngliche\s+)?Tilgung\s*[:\s]+([\d\,\.]+)\s*%/i,
        /Tilgung[\s\S]{0,30}?([\d\,\.]+)\s*%\s*j[äa]hrlich/i
      ]);
      if (tMatch) {
        var tVal = _parseNum(tMatch[1]);
        if (tVal != null && tVal >= 0 && tVal < 15) {
          result.fields[target + 't'] = tVal;
          result._meta.tilg_snippet = tMatch[0].slice(0, 80);
        }
      }

      // Zinsbindung
      var bMatch = _findFirst(text, [
        /(?:Sollzins|Zins)bindung(?:sfrist)?\s*[:\s]+(\d+)\s*(?:Jahr|J)/i,
        /(\d+)\s*Jahre?\s*(?:Zinsbindung|Zinsfestschreibung)/i,
        /(?:gebunden|fest)(?:e?r? Zins)?\s*(?:für|bis|über)\s*(\d+)\s*Jahre?/i,
        /Festzinsphase[\s\S]{0,30}?(\d+)\s*(?:Jahr|J)/i
      ]);
      if (bMatch) {
        var bVal = parseInt(bMatch[1]);
        if (bVal > 0 && bVal < 50) result.fields[target + '_bindj'] = bVal;
      }

      // Zinsbindung-Enddatum
      var bindEndMatch = text.match(/gebunden\s+bis\s+zum\s+(\d{2})\.(\d{2})\.(\d{4})/i);
      if (bindEndMatch) result._meta.bind_end_date = bindEndMatch[3] + '-' + bindEndMatch[2] + '-' + bindEndMatch[1];

      // Tilgungsaussetzung
      if (/tilgungsaussetz|endf[äa]ll|Festdarlehen|Bauspar(darlehen|kombination)/i.test(text)) {
        if (target === 'd1') result.fields.d1_type = 'tilgungsaussetzung';
        else result.fields.d2_type = 'tilgungsaussetzung';
      }

      // Bank
      var iMatch = _findFirst(text, [
        /\b(BBBank\s+eG)\b/i,
        /\b(Sparkasse [A-ZÄÖÜ][^\n,;\.]{1,40})/,
        /\b(Volksbank [A-ZÄÖÜ][^\n,;\.]{1,40})/,
        /\b(Raiffeisenbank [A-ZÄÖÜ][^\n,;\.]{1,40})/,
        /\b(KfW(?:bank(?:engruppe)?)?)\b/,
        /\b(Deutsche Bank|Commerzbank|HypoVereinsbank|ING(?:-DiBa)?|DKB|Postbank|N26|Targobank)\b/,
        /(?:Bank|Kreditinstitut|Darlehensgeber|Gl[äa]ubigerin?)\s*[:\s]+([A-ZÄÖÜ][^\n,;]{2,60})/i
      ]);
      if (iMatch) {
        var instKey = (target === 'd1') ? 'bank_inst' : 'd2_inst';
        result.fields[instKey] = iMatch[1].trim();
      }

      // Vertragsnummer
      var vnMatch = _findFirst(text, [
        /Konto(?:nummer)?\s*[:\s]+([\w\-]+)/i,
        /Vertrags(?:nummer|nr)\.?\s*[:\s]+([\w\-\/]+)/i,
        /Darlehens?nr\.?\s*[:\s]+([\w\-]+)/i
      ]);
      if (vnMatch && target === 'd1') result.fields.d1_vertrag = vnMatch[1].trim();

      // Auszahlungsdatum
      if (target === 'd1') {
        var aMatch = _findFirst(text, [
          /Auszahlung\s*(?:zum|am)?\s*[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
          /Valuta\s*[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
          /ausgezahlt\s+(?:am|zum)\s+(\d{2}\.\d{2}\.\d{4})/i
        ]);
        if (aMatch) {
          var parts = aMatch[1].split('.');
          result.fields.d1_auszahl = parts[1] + '.' + parts[2];
        }
      }

      // Ableitung Bindungs-Jahre wenn nur Enddatum + Auszahlung
      if (!result.fields[target + '_bindj'] && result._meta.bind_end_date && result.fields.d1_auszahl) {
        try {
          var endParts = result._meta.bind_end_date.split('-');
          var startParts = result.fields.d1_auszahl.split('.');
          var monthsDiff = (parseInt(endParts[0]) - parseInt(startParts[1])) * 12 +
                           (parseInt(endParts[1]) - parseInt(startParts[0]));
          var yrs = Math.round(monthsDiff / 12);
          if (yrs > 0 && yrs < 50) result.fields[target + '_bindj'] = yrs;
        } catch(_) {}
      }
    }

    if (target === 'bspar') {
      var bsMatch = _findFirst(text, [
        /Bauspar(?:vertrags)?summe\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i,
        /Vertragssumme\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i,
        /Zielsumme\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i
      ]);
      if (bsMatch) result.fields.bspar_sum = _parseNum(bsMatch[1]);

      var srMatch = _findFirst(text, [
        /(?:Regel)?Sparbeitrag\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i,
        /Sparrate\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i,
        /monatliche?(?:r)? (?:Spar)?Beitrag\s*[:\s]+([\d\.\,]+)\s*(?:€|EUR)/i
      ]);
      if (srMatch) result.fields.bspar_rate = _parseNum(srMatch[1]);

      var zdMatch = _findFirst(text, [
        /(?:voraussichtliche?s?\s+)?Zuteilung(?:sdatum|stermin|szeitpunkt)?\s*[:\s]+(\d{1,2}[\.\/]\d{4})/i,
        /Zuteilung\s*[:\s]+(\d{4})/i
      ]);
      if (zdMatch) {
        var z = zdMatch[1];
        if (/^\d{4}$/.test(z)) z = '01.' + z;
        if (z.indexOf('/') !== -1) z = z.replace('/', '.');
        result.fields.bspar_zuteil = z;
      }

      var bkMatch = _findFirst(text, [
        /(W[üu]stenrot|Schw[äa]bisch Hall|LBS|BHW|Debeka|Bausparkasse [^\n,;]{2,40})/i
      ]);
      if (bkMatch) result.fields.bspar_inst = bkMatch[1].trim();

      var vnMatch2 = _findFirst(text, [
        /Vertrags(?:nummer|nr)\.?\s*[:\s]+([\w\-\/]+)/i
      ]);
      if (vnMatch2) result.fields.bspar_vertrag = vnMatch2[1].trim();

      var gzMatch = _findFirst(text, [
        /Guthaben(?:s)?zins(?:satz)?\s*[:\s]+([\d\,\.]+)\s*%/i
      ]);
      if (gzMatch) result.fields.bspar_zins = _parseNum(gzMatch[1]);
    }

    return result;
  }

  // ── Confirm-Dialog ───────────────────────────────────────────────
  function _showResultDialog(result) {
    var existing = document.getElementById('finpdf-modal'); if (existing) existing.remove();
    var target = result._target;
    var labelMap = { d1: 'Darlehen 1', d2: 'Darlehen 2', bspar: 'Bausparvertrag' };
    var typeName = labelMap[target] || target;

    var fieldLabels = {
      d1: 'Darlehenssumme (€)', d1z: 'Zinssatz nominal (%)', d1t: 'Tilgung (%)',
      d1_bindj: 'Zinsbindung (Jahre)', d1_auszahl: 'Auszahlung (MM.YYYY)',
      d1_type: 'Darlehenstyp', bank_inst: 'Bank', d1_vertrag: 'Vertragsnummer',
      d2: 'Darlehenssumme (€)', d2z: 'Zinssatz nominal (%)', d2t: 'Tilgung (%)',
      d2_bindj: 'Zinsbindung (Jahre)', d2_inst: 'Bank', d2_type: 'Darlehenstyp',
      bspar_sum: 'Bausparsumme (€)', bspar_rate: 'Sparrate / Monat (€)',
      bspar_zuteil: 'Zuteilungsdatum', bspar_inst: 'Bausparkasse',
      bspar_vertrag: 'Vertragsnummer', bspar_zins: 'Guthabenzins (%)'
    };

    var fields = result.fields || {};
    var keys = Object.keys(fields);

    var ov = document.createElement('div');
    ov.id = 'finpdf-modal';
    ov.className = 'iexp-overlay';
    ov.innerHTML =
      '<div class="iexp-modal" style="max-width:600px">' +
        '<div class="iexp-header">' +
          '<div class="iexp-h-text">' +
            '<h2>📄 PDF-Werte gefunden - ' + typeName + '</h2>' +
            '<p>' + keys.length + ' Wert' + (keys.length !== 1 ? 'e' : '') + ' erkannt. Prüfe und übernimm.</p>' +
          '</div>' +
          '<button class="iexp-close" onclick="closeFinPdfModal()" type="button" aria-label="Schließen">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="iexp-body" id="finpdf-body">' +
          (!keys.length ?
            '<div style="padding:20px; text-align:center; color:#7A7370">' +
            '⚠ Keine Werte erkannt. Bitte manuell eingeben.</div>' :
            keys.map(function(k) {
              var lbl = fieldLabels[k] || k;
              var val = fields[k];
              var inputId = 'finpdf-f-' + k;
              return '<div style="display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid rgba(42,39,39,0.06)">' +
                '<label for="' + inputId + '" style="flex:1; font-size:13px; color:#2A2727">' + lbl + '</label>' +
                '<input id="' + inputId + '" type="text" data-field="' + k + '" value="' + String(val).replace(/"/g, '&quot;') + '" ' +
                'style="flex:0 0 220px; padding:6px 10px; border:1px solid rgba(42,39,39,0.18); border-radius:6px; font-size:13px">' +
              '</div>';
            }).join('') +
            '<div style="margin-top:18px; display:flex; gap:10px; justify-content:flex-end">' +
              '<button type="button" onclick="closeFinPdfModal()" class="btn-ghost btn-sm">Abbrechen</button>' +
              '<button type="button" onclick="applyFinPdfValues()" class="btn-primary btn-sm">Werte übernehmen</button>' +
            '</div>'
          ) +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) closeFinPdfModal(); });
  }

  window.closeFinPdfModal = function() {
    var m = document.getElementById('finpdf-modal'); if (m) m.remove();
  };

  window.applyFinPdfValues = function() {
    var inputs = document.querySelectorAll('#finpdf-body input[data-field]');
    inputs.forEach(function(inp) {
      var fieldId = inp.dataset.field;
      var val = inp.value;
      var el = document.getElementById(fieldId);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        for (var i = 0; i < el.options.length; i++) {
          if (el.options[i].value == val) { el.selectedIndex = i; break; }
        }
      } else {
        el.value = val;
      }
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(_) {}
    });
    if (typeof window.onD1TypeChange === 'function') window.onD1TypeChange();
    if (typeof window.calc === 'function') window.calc();
    if (typeof window.dpFinancingRefresh === 'function') window.dpFinancingRefresh();
    closeFinPdfModal();
    if (typeof toast === 'function') toast('✓ Werte übernommen');
  };

  // ── Progress-Toast ───────────────────────────────────────────────
  var _progressToast = null;
  function _showProgress(msg) {
    if (!_progressToast) {
      _progressToast = document.createElement('div');
      _progressToast.style.cssText =
        'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); ' +
        'background:#2A2727; color:#fff; padding:12px 22px; border-radius:8px; ' +
        'box-shadow:0 6px 20px rgba(0,0,0,0.25); z-index:2000; font-size:13px; ' +
        'border:1px solid rgba(201,168,76,0.4); display:flex; gap:10px; align-items:center; max-width:90vw';
      _progressToast.innerHTML =
        '<span style="width:14px; height:14px; border:2px solid rgba(201,168,76,0.3); ' +
        'border-top-color:#C9A84C; border-radius:50%; animation:finpdfSpin 0.8s linear infinite; display:inline-block"></span>' +
        '<span id="finpdf-progress-text"></span>';
      if (!document.getElementById('finpdf-spinner-style')) {
        var st = document.createElement('style');
        st.id = 'finpdf-spinner-style';
        st.textContent = '@keyframes finpdfSpin { to { transform:rotate(360deg) } }';
        document.head.appendChild(st);
      }
      document.body.appendChild(_progressToast);
    }
    _progressToast.querySelector('#finpdf-progress-text').textContent = msg;
  }
  function _hideProgress() {
    if (_progressToast) { _progressToast.remove(); _progressToast = null; }
  }

  // ── Public API ───────────────────────────────────────────────────
  window.dpParsePdfFinanzierung = async function(file, target) {
    _showProgress('PDF wird gelesen…');
    try {
      await _loadPdfJs();
      var ext = await _extractText(file);
      var text = ext.text;
      var trimmed = text.replace(/\s+/g, ' ').trim();

      // V63.50: OCR-Fallback bei zu wenig Text
      if (trimmed.length < 200) {
        _hideProgress();
        var ocrConfirm = confirm(
          'Diese PDF scheint gescannt oder fotografiert zu sein (kein durchsuchbarer Text gefunden).\n\n' +
          'Soll DealPilot eine Texterkennung (OCR) durchführen?\n\n' +
          'Dauer: 30 Sek. - 2 Min. je nach Seitenzahl.\n' +
          'Läuft komplett lokal in deinem Browser.\n\n' +
          'OK = OCR starten\nAbbrechen = Werte manuell eingeben'
        );
        if (!ocrConfirm) return;
        _showProgress('Lade Texterkennung…');
        text = await _ocrFallback(ext.pdf, _showProgress);
      }

      _hideProgress();
      var result = _parseFinancingPdf(text, target);
      _showResultDialog(result);
    } catch (err) {
      _hideProgress();
      console.error('Fin-PDF-Import fehlgeschlagen:', err);
      alert('PDF-Import fehlgeschlagen:\n\n' + err.message + '\n\nBitte Werte manuell eingeben.');
    }
  };

})();
