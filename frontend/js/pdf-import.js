'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V38 — PDF-Import von Exposés
   
   Workflow:
   1. User wählt PDF-Datei
   2. pdf.js extrahiert Text aus allen Seiten
   3. Text wird ans Backend geschickt → POST /api/v1/ai/extract-expose
   4. OpenAI extrahiert strukturierte Daten (Kaufpreis, Wohnfläche, ...)
   5. UI zeigt Ergebnis mit "Übernehmen" pro Feld
   
   pdf.js wird per CDN bei Bedarf nachgeladen.
═══════════════════════════════════════════════════════════════════════════ */

(function() {

  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var _pdfjsLoaded = false;
  var _onDoneCallback = null;
  var _isMarketMode = false;  // V63.91: Market-Bericht-Modus für Endpoint-Switch

  function _loadPdfJs() {
    if (_pdfjsLoaded) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS_URL;
      s.onload = function() {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
          _pdfjsLoaded = true;
          resolve();
        } else {
          reject(new Error('pdf.js nicht verfügbar nach Load'));
        }
      };
      s.onerror = function() { reject(new Error('pdf.js konnte nicht geladen werden (Internet?)')); };
      document.head.appendChild(s);
    });
  }

  /**
   * Öffentliche API: Modal anzeigen.
   * @param onDone optional callback(extractedData) — wird gerufen wenn User "Übernehmen" klickt.
   *               Falls nicht angegeben, schreibt der Modal direkt in die Haupt-FIELDS.
   */
  function showPdfImport(onDone) {
    _onDoneCallback = onDone || null;
    var existing = document.getElementById('pdfimport-modal');
    if (existing) existing.remove();

    var ov = document.createElement('div');
    ov.id = 'pdfimport-modal';
    ov.className = 'pdfi-overlay';
    ov.innerHTML =
      '<div class="pdfi-modal">' +
        '<div class="pdfi-header">' +
          '<div class="pdfi-icon">📄</div>' +
          '<div class="pdfi-title-block">' +
            '<h3>PDF-Exposé importieren</h3>' +
            '<div class="pdfi-sub">ImmoScout, Kleinanzeigen, Maklerexposés — die KI extrahiert die wichtigen Werte automatisch.</div>' +
          '</div>' +
          '<button class="bmf-close" type="button" onclick="closePdfImport()">×</button>' +
        '</div>' +
        '<div class="pdfi-body" id="pdfi-body">' +
          '<div class="pdfi-drop" id="pdfi-drop">' +
            '<div class="pdfi-drop-icon">📁</div>' +
            '<div class="pdfi-drop-title">Datei auswählen oder hierher ziehen</div>' +
            '<div class="pdfi-drop-sub">PDF-Datei, max 10 MB</div>' +
            '<input type="file" id="pdfi-file" accept="application/pdf,.pdf" style="display:none">' +
            '<button type="button" class="btn btn-gold" onclick="document.getElementById(\'pdfi-file\').click()">Datei wählen</button>' +
          '</div>' +
        '</div>' +
        '<div class="pdfi-footer">' +
          '<button type="button" class="btn btn-ghost" onclick="closePdfImport()">Schließen</button>' +
        '</div>' +
      '</div>';

    ov.addEventListener('click', function(e) { if (e.target === ov) closePdfImport(); });
    document.body.appendChild(ov);

    var fileInput = document.getElementById('pdfi-file');
    fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) _handleFile(e.target.files[0]);
    });

    // Drag & Drop
    var drop = document.getElementById('pdfi-drop');
    drop.addEventListener('dragover', function(e) { e.preventDefault(); drop.classList.add('pdfi-drag'); });
    drop.addEventListener('dragleave', function() { drop.classList.remove('pdfi-drag'); });
    drop.addEventListener('drop', function(e) {
      e.preventDefault();
      drop.classList.remove('pdfi-drag');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) _handleFile(e.dataTransfer.files[0]);
    });
  }

  function closePdfImport() {
    var m = document.getElementById('pdfimport-modal');
    if (m) m.remove();
    // V63.91: Market-Mode bei Abbruch zurücksetzen — sonst würde der nächste
    // PDF-Import-Klick fälschlicherweise den Market-Endpoint aufrufen.
    _isMarketMode = false;
  }

  async function _handleFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      _showError('Datei zu groß (max 10 MB).');
      return;
    }
    if (!/\.pdf$/i.test(file.name)) {
      _showError('Nur PDF-Dateien werden unterstützt.');
      return;
    }

    _showLoading('PDF wird gelesen…');

    try {
      // 1. pdf.js laden falls noch nicht da
      await _loadPdfJs();

      // 2. PDF parsen — Text-Extraktion (schneller Pfad)
      _showLoading('Text aus PDF extrahieren…');
      var text = await _extractPdfText(file);

      // V196: OCR-Fallback wenn Text-Extraktion zu wenig liefert.
      // Typisch: PDFs aus "STRG+P" auf Immoscout sind Vektor-Layouts ohne
      // selectable Text — pdf.js gibt nur Whitespace / Layout-Garbage.
      // tesseract.js (Frontend-OCR, ~3 MB Library) liest die Seiten als Bild.
      if (!text || text.replace(/\s/g, '').length < 50) {
        _showLoading('PDF enthält keinen lesbaren Text — starte OCR (kann ~30 Sek dauern)…');
        try {
          text = await _extractPdfTextViaOCR(file, _showLoading);
        } catch (ocrErr) {
          console.error('[pdf-import] OCR fail:', ocrErr);
          throw new Error('Weder Text-Extraktion noch OCR erfolgreich. Bitte das PDF prüfen — eventuell verschlüsselt oder leer.');
        }
        if (!text || text.replace(/\s/g, '').length < 50) {
          throw new Error('OCR konnte keinen Text aus dem PDF lesen. Eventuell ein leeres oder verschlüsseltes PDF.');
        }
      }

      // Truncate auf 12.000 Zeichen — Exposés sind selten größer, OpenAI-Token-Sparen
      text = text.slice(0, 12000);

      // V42: Bilder parallel extrahieren (nimmt 2-5 Sekunden, läuft während KI rechnet)
      _showLoading('Bilder aus PDF extrahieren…');
      var imagePromise = _extractPdfImages(file);

      // 3. An Backend schicken
      _showLoading('KI extrahiert Daten…');
      var extracted = await _callExtractEndpoint(text);

      // V42: Bilder anhängen (warten falls noch nicht fertig)
      var images = await imagePromise;
      if (images && images.length > 0) {
        extracted._photos = images;
      }

      // 4. Ergebnis anzeigen
      _showResult(extracted);
    } catch (err) {
      _showError(err.message || 'Unbekannter Fehler beim PDF-Import.');
    }
  }

  async function _extractPdfText(file) {
    var ab = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    var textParts = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      var pageText = content.items.map(function(it) { return it.str; }).join(' ');
      textParts.push(pageText);
    }
    return textParts.join('\n\n');
  }

  // V196: tesseract.js Loader (CDN, ~3 MB) — wird nur bei OCR-Bedarf geholt
  var TESSERACT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js';
  function _loadTesseract() {
    return new Promise(function(resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.onload = function() {
        if (window.Tesseract) resolve();
        else reject(new Error('Tesseract nicht verfügbar nach Load'));
      };
      s.onerror = function() {
        reject(new Error('tesseract.js konnte nicht geladen werden (Internet?)'));
      };
      document.head.appendChild(s);
    });
  }

  // V196: OCR-Fallback — rendert PDF-Seiten als Canvas und schickt sie durch tesseract.
  // Max 6 Seiten (Exposés sind selten länger, OCR ist langsam).
  // progressCb({step, page, totalPages, percent}) für UI-Feedback.
  async function _extractPdfTextViaOCR(file, statusFn) {
    await _loadTesseract();
    var ab = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    var maxPages = Math.min(pdf.numPages, 6);

    // Tesseract-Worker erstellen (deutsche Sprache)
    if (statusFn) statusFn('OCR-Engine wird initialisiert (~3 MB)…');
    var worker = await window.Tesseract.createWorker('deu', 1, {
      logger: function(m) {
        // m.status: 'recognizing text', m.progress: 0..1
        if (m && m.status === 'recognizing text' && statusFn) {
          var pct = Math.round((m.progress || 0) * 100);
          statusFn('OCR läuft… ' + pct + ' %');
        }
      }
    });

    var allText = [];
    try {
      for (var i = 1; i <= maxPages; i++) {
        if (statusFn) statusFn('OCR: Seite ' + i + ' von ' + maxPages + '…');
        var page = await pdf.getPage(i);
        // Höhere Auflösung für bessere OCR-Genauigkeit
        var viewport = page.getViewport({ scale: 2.0 });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        var result = await worker.recognize(canvas);
        if (result && result.data && result.data.text) {
          allText.push(result.data.text);
        }
      }
    } finally {
      try { await worker.terminate(); } catch(e) {}
    }
    return allText.join('\n\n');
  }

  /**
   * V53/V60: Bilder aus PDF extrahieren.
   *
   * V60-Strategie (zwei Pfade, in dieser Reihenfolge):
   *  1. PRIMÄR: Echte eingebettete Bilder via PDF.js OperatorList API holen
   *     — das funktioniert bei jedem PDF mit eingebetteten JPEGs zuverlässig.
   *  2. FALLBACK: Wenn (1) <2 Bilder liefert, Heuristik-Splitting auf
   *     gerenderten Seiten (für PDFs mit Vektor-/synthetisch erzeugten Fotos).
   *
   * Liefert max 6 Bilder.
   */
  async function _extractPdfImages(file) {
    try {
      var ab = await file.arrayBuffer();
      var pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
      var images = [];

      // ───── Pfad 1: Echte eingebettete Bilder ─────
      try {
        images = await _extractEmbeddedImages(pdf);
        console.log('[PDF-Splitter] Embedded-Pfad lieferte', images.length, 'Bilder');
      } catch(eEmbed) {
        console.warn('[PDF-Splitter] Embedded-Pfad fehlgeschlagen:', eEmbed.message);
      }

      // ───── Pfad 2: Heuristik-Splitting (Fallback wenn <2 Bilder) ─────
      if (images.length < 2) {
        console.log('[PDF-Splitter] Wenig embedded → Heuristik-Splitting starten');
        var heuristicImages = await _extractByHeuristic(pdf);
        // Wenn Heuristik mehr Bilder findet als Embedded, bevorzugen
        if (heuristicImages.length > images.length) {
          images = heuristicImages;
        }
      }

      // ───── V61 Pfad 3: Notfall — wenn beide Pfade 0 lieferten, ganze Seiten rendern
      if (images.length === 0) {
        console.log('[PDF-Splitter] Notfall: ganze Seiten als Bilder rendern');
        images = await _renderWholePages(pdf);
      }

      // Auf max 6 begrenzen
      console.log('[PDF-Splitter] Final:', images.length, 'Bilder');
      return images.slice(0, 6);
    } catch(err) {
      console.warn('[pdf-import] Bild-Extraktion fehlgeschlagen:', err.message);
      return [];
    }
  }

  /**
   * V61: Notfall-Renderer — rendert die ersten Seiten des PDFs als ganze Bilder.
   * Wird nur genutzt wenn Pfad 1 (Embedded) und Pfad 2 (Heuristik) beide 0 liefern.
   * Skippt Seite 1 wenn sie überwiegend Text ist (typischerweise Titelseite).
   */
  async function _renderWholePages(pdf) {
    var images = [];
    var maxPages = Math.min(pdf.numPages, 8);
    for (var i = 1; i <= maxPages; i++) {
      if (images.length >= 6) break;
      try {
        var page = await pdf.getPage(i);
        // Text-Anteil prüfen — wenn extrem textlastig, skippen (Beschreibungs-Seite)
        var content = await page.getTextContent();
        var wordCount = content.items.reduce(function(sum, it) {
          return sum + (it.str || '').split(/\s+/).filter(Boolean).length;
        }, 0);
        if (wordCount > 250) continue;     // sehr textlastig → skippen

        var vp = page.getViewport({ scale: 1.5 });
        var canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        var ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!_isMostlyBlank(canvas)) {
          images.push(canvas.toDataURL('image/jpeg', 0.85));
        }
      } catch(e) {
        console.warn('[PDF-Splitter] Notfall-Render Seite', i, 'failed:', e.message);
      }
    }
    return images;
  }


  /**
   * V60: Holt eingebettete Bilder aus dem PDF via OperatorList.
   *
   * PDF.js stellt `page.getOperatorList()` bereit — das ist die Liste der
   * Render-Operatoren der Seite. Bei `OPS.paintImageXObject` finden wir die
   * Namen der Bild-Resourcen, die mit `page.objs.get(name)` aufgelöst werden.
   *
   * Das gibt uns ImageData-Objekte (mit width/height/data), die wir auf ein
   * Canvas zeichnen und als JPEG exportieren.
   */
  async function _extractEmbeddedImages(pdf) {
    var images = [];
    var seen = {};   // Duplikate vermeiden (Logos auf jeder Seite etc.)
    var maxPages = Math.min(pdf.numPages, 14);

    var OPS = window.pdfjsLib.OPS || {};
    var PAINT_OP = OPS.paintImageXObject || 85;     // bei pdfjs ~3.x

    for (var i = 1; i <= maxPages; i++) {
      if (images.length >= 6) break;
      var page = await pdf.getPage(i);
      var ops;
      try {
        ops = await page.getOperatorList();
      } catch(e) { continue; }

      for (var k = 0; k < ops.fnArray.length; k++) {
        if (ops.fnArray[k] !== PAINT_OP) continue;
        var args = ops.argsArray[k];
        if (!args || !args[0]) continue;
        var imgName = args[0];
        if (seen[imgName]) continue;

        // Bild-Objekt laden (manchmal async, manchmal sync)
        var imgObj = null;
        try {
          if (page.objs.has(imgName)) {
            imgObj = page.objs.get(imgName);
          } else {
            // commonObjs als Fallback
            if (page.commonObjs && page.commonObjs.has && page.commonObjs.has(imgName)) {
              imgObj = page.commonObjs.get(imgName);
            }
          }
        } catch(e) { continue; }

        if (!imgObj || !imgObj.width || !imgObj.height) continue;

        // Filter: zu kleine Bilder (Logos, Icons) skippen
        if (imgObj.width < 200 || imgObj.height < 200) continue;
        // Filter: extreme Seitenverhältnisse (Linien)
        var ratio = imgObj.width / imgObj.height;
        if (ratio < 0.3 || ratio > 4.0) continue;

        // Auf Canvas rendern und als JPEG exportieren
        var dataUrl = _imageObjToDataUrl(imgObj);
        if (dataUrl) {
          images.push(dataUrl);
          seen[imgName] = true;
        }
        if (images.length >= 6) break;
      }
    }
    return images;
  }

  /**
   * Wandelt ein PDF.js-Bild-Objekt (mit data, width, height, kind)
   * in eine JPEG-DataURL um.
   */
  function _imageObjToDataUrl(imgObj) {
    try {
      var w = imgObj.width, h = imgObj.height;
      // Max-Größe für Storage: skaliere runter wenn >1400px
      var maxW = 1400;
      var scale = w > maxW ? maxW / w : 1;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var ctx = canvas.getContext('2d');

      // Falls imgObj.bitmap ein ImageBitmap ist (PDF.js neu)
      if (imgObj.bitmap && typeof imgObj.bitmap.width === 'number') {
        ctx.drawImage(imgObj.bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
      }

      // Klassischer Pfad: ImageData mit RGBA pixels
      if (imgObj.data && imgObj.data.length) {
        var pixCanvas = document.createElement('canvas');
        pixCanvas.width = w;
        pixCanvas.height = h;
        var pixCtx = pixCanvas.getContext('2d');

        var src = imgObj.data;
        var imgData;

        // Heuristik: kind 1 = grayscale, 2 = RGB, 3 = RGBA
        if (src.length === w * h * 4) {
          // RGBA
          imgData = new ImageData(new Uint8ClampedArray(src), w, h);
        } else if (src.length === w * h * 3) {
          // RGB → RGBA
          var rgba = new Uint8ClampedArray(w * h * 4);
          for (var p = 0, q = 0; p < src.length; p += 3, q += 4) {
            rgba[q] = src[p];
            rgba[q + 1] = src[p + 1];
            rgba[q + 2] = src[p + 2];
            rgba[q + 3] = 255;
          }
          imgData = new ImageData(rgba, w, h);
        } else if (src.length === w * h) {
          // Graustufen → RGBA
          var rgba2 = new Uint8ClampedArray(w * h * 4);
          for (var p2 = 0; p2 < src.length; p2++) {
            rgba2[p2 * 4] = src[p2];
            rgba2[p2 * 4 + 1] = src[p2];
            rgba2[p2 * 4 + 2] = src[p2];
            rgba2[p2 * 4 + 3] = 255;
          }
          imgData = new ImageData(rgba2, w, h);
        } else {
          return null;
        }
        pixCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(pixCanvas, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch(e) {
      console.warn('[PDF-Splitter] image-conversion fail:', e.message);
    }
    return null;
  }

  /**
   * V53-Heuristik (Fallback): Seite als Canvas rendern und nach weißen Streifen
   * splitten. Wird nur genutzt wenn der Embedded-Pfad <2 Bilder lieferte.
   */
  async function _extractByHeuristic(pdf) {
    var images = [];
    var maxPages = Math.min(pdf.numPages, 12);
    for (var i = 1; i <= maxPages; i++) {
      if (images.length >= 6) break;
      var page = await pdf.getPage(i);

      // Word-Count-Heuristik — V60: lockerer (war 80, jetzt 150)
      var content = await page.getTextContent();
      var wordCount = content.items.reduce(function(sum, it) {
        return sum + (it.str || '').split(/\s+/).filter(Boolean).length;
      }, 0);
      if (wordCount > 150) continue;     // textlastige Seite skippen

      var viewport = page.getViewport({ scale: 1.0 });
      var maxW = 1400;
      var scale = Math.min(2.0, maxW / viewport.width);
      var vp = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      var ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      try {
        if (_isMostlyBlank(canvas)) continue;
        var subImages = _splitPageIntoPhotos(canvas);
        for (var s = 0; s < subImages.length && images.length < 6; s++) {
          images.push(subImages[s]);
        }
      } catch(e) {
        try {
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          images.push(dataUrl);
        } catch(e2) {}
      }
    }
    return images;
  }

  /**
   * V53: Zerlegt eine Canvas-Seite in einzelne Foto-Bilder.
   *
   * Algorithmus:
   *  1. Erkenne horizontale weiße Streifen (Zeilen wo fast alle Pixel hell sind)
   *     → Seite vertikal in Streifen splitten
   *  2. Für jedes Sub-Bild: Erkenne vertikale weiße Streifen
   *     → Sub-Bild horizontal splitten
   *  3. Jedes resultierende Rechteck wird als JPEG-DataURL exportiert.
   *
   * Min-Größe: 150×150 px (sonst zu klein, vermutlich Artefakt)
   * Min-Verhältnis: 0.4-3.0 (nicht zu schmal, nicht zu lang)
   */
  function _splitPageIntoPhotos(canvas) {
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d');
    var imgData;
    try {
      imgData = ctx.getImageData(0, 0, W, H);
    } catch(e) {
      // CORS o.ä. — Fallback ganze Seite
      return [canvas.toDataURL('image/jpeg', 0.85)];
    }
    var px = imgData.data;

    // Pro Zeile: durchschnittliche Helligkeit + Anteil heller Pixel
    var WHITE_THRESHOLD = 235;        // Pixel >= 235 gilt als "hell/weiß"
    var ROW_WHITE_RATIO = 0.97;       // Zeile mit ≥97% hellen Pixeln = weiße Trennlinie
    var rowIsWhite = new Uint8Array(H);
    for (var y = 0; y < H; y++) {
      var lightCount = 0;
      var rowOff = y * W * 4;
      // Sample jeden 4. Pixel für Speed
      for (var x = 0; x < W; x += 4) {
        var pi = rowOff + x * 4;
        var r = px[pi], g = px[pi + 1], b = px[pi + 2];
        var brightness = (r + g + b) / 3;
        if (brightness >= WHITE_THRESHOLD) lightCount++;
      }
      var totalSampled = Math.ceil(W / 4);
      rowIsWhite[y] = (lightCount / totalSampled) >= ROW_WHITE_RATIO ? 1 : 0;
    }

    // Horizontale Streifen finden: zusammenhängende Bereiche von "nicht-weißen" Zeilen
    var MIN_GAP = 20;                // weniger als 20 weiße Zeilen → kein Trenner
    var stripes = _findContiguousNonWhite(rowIsWhite, MIN_GAP);

    if (stripes.length <= 1) {
      // Keine sinnvolle horizontale Trennung — ganze Seite als ein Bild
      return [canvas.toDataURL('image/jpeg', 0.85)];
    }

    // Pro Streifen: prüfe ob horizontaler Split möglich (vertikale weiße Spalten)
    var output = [];
    stripes.forEach(function(stripe) {
      var sH = stripe.end - stripe.start + 1;
      if (sH < 100) return;  // zu klein

      // Spalten-Helligkeitsanalyse innerhalb dieses Streifens
      var colIsWhite = new Uint8Array(W);
      var COL_WHITE_RATIO = 0.97;
      for (var x = 0; x < W; x++) {
        var lightCnt = 0;
        for (var y2 = stripe.start; y2 <= stripe.end; y2 += 4) {
          var pi2 = (y2 * W + x) * 4;
          var brightness2 = (px[pi2] + px[pi2 + 1] + px[pi2 + 2]) / 3;
          if (brightness2 >= WHITE_THRESHOLD) lightCnt++;
        }
        var totalSampled2 = Math.ceil(sH / 4);
        colIsWhite[x] = (lightCnt / totalSampled2) >= COL_WHITE_RATIO ? 1 : 0;
      }
      var subStripes = _findContiguousNonWhite(colIsWhite, MIN_GAP);

      if (subStripes.length <= 1) {
        // Keine vertikale Trennung — ganzer horizontaler Streifen
        var img = _cropCanvasToDataURL(canvas, 0, stripe.start, W, sH);
        if (img) output.push(img);
      } else {
        // Mehrere Sub-Bilder
        subStripes.forEach(function(sub) {
          var sw = sub.end - sub.start + 1;
          if (sw < 100) return;
          // Min-Größe-Filter: 150×150
          if (sw < 150 || sH < 150) return;
          // Verhältnis-Filter (extreme Linien sind keine Fotos)
          var ratio = sw / sH;
          if (ratio < 0.3 || ratio > 4.0) return;
          var img2 = _cropCanvasToDataURL(canvas, sub.start, stripe.start, sw, sH);
          if (img2) output.push(img2);
        });
      }
    });

    // Wenn Splitting nichts brauchbares geliefert hat → Fallback ganze Seite
    if (output.length === 0) {
      return [canvas.toDataURL('image/jpeg', 0.85)];
    }
    return output;
  }

  /**
   * Findet zusammenhängende Bereiche von Nicht-Weißen Zeilen/Spalten.
   * `whiteFlags` ist ein Uint8Array (1=weiß, 0=non-weiß).
   * `minGap`: Mindestlänge eines weißen Trenners zwischen Streifen.
   */
  function _findContiguousNonWhite(whiteFlags, minGap) {
    var stripes = [];
    var inStripe = false;
    var stripeStart = 0;
    var whiteRun = 0;
    var pendingEnd = -1;
    for (var i = 0; i < whiteFlags.length; i++) {
      if (whiteFlags[i]) {
        // weiße Zeile/Spalte
        whiteRun++;
        if (inStripe && pendingEnd === -1) {
          // gerade aus Streifen rausgegangen → vorläufiges Ende merken
          pendingEnd = i - 1;
        }
        if (inStripe && whiteRun >= minGap) {
          // Trenner lang genug → Streifen finalisieren
          stripes.push({ start: stripeStart, end: pendingEnd });
          inStripe = false;
          pendingEnd = -1;
        }
      } else {
        // non-weiß
        whiteRun = 0;
        if (!inStripe) {
          inStripe = true;
          stripeStart = i;
        }
        pendingEnd = -1;
      }
    }
    if (inStripe) {
      stripes.push({ start: stripeStart, end: whiteFlags.length - 1 });
    }
    return stripes;
  }

  /**
   * Crop einen Bereich aus dem Canvas und gibt ein JPEG-DataURL zurück.
   * Padding: 10 px rundherum für sauberere Ränder.
   */
  function _cropCanvasToDataURL(srcCanvas, x, y, w, h) {
    var pad = 10;
    var cx = Math.max(0, x - pad);
    var cy = Math.max(0, y - pad);
    var cw = Math.min(srcCanvas.width - cx, w + pad * 2);
    var ch = Math.min(srcCanvas.height - cy, h + pad * 2);
    var c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    var ctx = c.getContext('2d');
    ctx.drawImage(srcCanvas, cx, cy, cw, ch, 0, 0, cw, ch);
    try {
      return c.toDataURL('image/jpeg', 0.88);
    } catch(e) {
      return null;
    }
  }

  /**
   * V42: Heuristik ob ein Canvas hauptsächlich weiß ist (= leere Seite).
   */
  function _isMostlyBlank(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      // 100x100 sample in der Mitte
      var w = Math.min(100, canvas.width), h = Math.min(100, canvas.height);
      var x = Math.floor((canvas.width - w) / 2), y = Math.floor((canvas.height - h) / 2);
      var img = ctx.getImageData(x, y, w, h);
      var bright = 0, total = 0;
      for (var i = 0; i < img.data.length; i += 4) {
        var avg = (img.data[i] + img.data[i+1] + img.data[i+2]) / 3;
        if (avg > 235) bright++;
        total++;
      }
      return (bright / total) > 0.92;     // >92% sehr hell = wahrscheinlich leer
    } catch(e) { return false; }
  }

  function _getToken() { return localStorage.getItem('ji_token') || ''; }
  function _getUserApiKey() {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      return s.openaiApiKey || '';
    } catch(e) { return ''; }
  }

  async function _callExtractEndpoint(text) {
    var res = await fetch('/api/v1/ai/extract-expose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _getToken()
      },
      body: JSON.stringify({ text: text, userApiKey: _getUserApiKey() })
    });
    var data;
    try { data = await res.json(); } catch(e) { data = {}; }
    if (!res.ok) {
      // V63.91: Spezifische Fehlerklassen für besseres User-Feedback
      var msg = data.error || ('HTTP ' + res.status);
      if (data.needs_user_key) {
        msg = 'Backend hat keinen OpenAI-API-Key konfiguriert. ' +
              'Bitte in Einstellungen → KI → "Eigener OpenAI-API-Key" einen Key eintragen.';
      } else if (res.status === 401) {
        msg = 'Nicht eingeloggt. Bitte erneut anmelden und nochmal versuchen.';
      } else if (res.status === 403) {
        msg = data.error || 'Plan-Limit erreicht.';
      } else if (res.status === 502) {
        msg = 'OpenAI nicht erreichbar oder hat einen Fehler gemeldet: ' + (data.error || 'unbekannt');
      }
      var err = new Error(msg);
      err.status = res.status;
      err.needs_user_key = !!data.needs_user_key;
      throw err;
    }
    return data.extracted || {};
  }

  function _showLoading(msg) {
    var body = document.getElementById('pdfi-body');
    if (!body) return;
    body.innerHTML =
      '<div class="pdfi-loading">' +
        '<div class="pdfi-spinner"></div>' +
        '<div class="pdfi-loading-msg">' + _escHtml(msg) + '</div>' +
      '</div>';
  }

  function _showError(msg) {
    var body = document.getElementById('pdfi-body');
    if (!body) return;
    body.innerHTML =
      '<div class="pdfi-error">' +
        '<div class="pdfi-error-icon">⚠</div>' +
        '<div class="pdfi-error-msg">' + _escHtml(msg) + '</div>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="showPdfImport()">Nochmal versuchen</button>' +
      '</div>';
  }

  function _showResult(data) {
    var body = document.getElementById('pdfi-body');
    if (!body) return;

    var FIELDS = [
      { id: 'adresse',        label: 'Adresse',          unit: '' },
      { id: 'plz',            label: 'PLZ',              unit: '' },
      { id: 'ort',            label: 'Ort',              unit: '' },
      { id: 'kaufpreis',      label: 'Kaufpreis',        unit: '€', format: 'eur' },
      { id: 'wohnflaeche',    label: 'Wohnfläche',       unit: 'm²' },
      { id: 'baujahr',        label: 'Baujahr',          unit: '' },
      { id: 'objektart',      label: 'Objektart',        unit: '' },
      { id: 'zimmer',         label: 'Zimmer',           unit: '' },
      { id: 'nettokaltmiete', label: 'Nettokaltmiete',   unit: '€/Mon', format: 'eur' },
      { id: 'nebenkosten',    label: 'Nebenkosten',      unit: '€/Mon', format: 'eur' },
      { id: 'energieklasse',  label: 'Energieklasse',    unit: '' },
      { id: 'hausgeld',       label: 'Hausgeld',         unit: '€/Mon', format: 'eur' },
      // V42: Erweiterte Felder
      { id: 'instandhaltung', label: 'Instandhaltungsrücklage', unit: '€/Mon', format: 'eur' },
      { id: 'eigenkapital',   label: 'Eigenkapital-Anteil', unit: '€', format: 'eur' },
      { id: 'verwaltung',     label: 'Verwaltungskosten', unit: '€/Mon', format: 'eur' },
      { id: 'kaufnebenkosten',label: 'Kaufnebenkosten %', unit: '%' },
      { id: 'stellplatz',     label: 'Stellplatz',       unit: '' },
      { id: 'balkon',         label: 'Balkon/Terrasse',  unit: '' }
    ];

    var rows = '';
    var anyValue = false;
    FIELDS.forEach(function(f) {
      var raw = data[f.id];
      var has = raw != null && raw !== '';
      if (has) anyValue = true;
      var display = '–';
      if (has) {
        if (f.format === 'eur' && typeof raw === 'number') display = raw.toLocaleString('de-DE') + ' €';
        else display = raw + (f.unit ? ' ' + f.unit : '');
      }
      rows += '<tr class="pdfi-result-row' + (has ? '' : ' pdfi-result-empty') + '">' +
        '<td class="pdfi-result-cb">' +
          (has ? '<input type="checkbox" data-fid="' + f.id + '" data-val="' + _escAttr(String(raw)) + '" checked>' : '') +
        '</td>' +
        '<td class="pdfi-result-label">' + _escHtml(f.label) + '</td>' +
        '<td class="pdfi-result-value">' + (has ? _escHtml(display) : '<em class="muted">nicht gefunden</em>') + '</td>' +
      '</tr>';
    });

    var photos = Array.isArray(data._photos) ? data._photos : [];
    var photosHtml = '';
    if (photos.length > 0) {
      photosHtml = '<div class="pdfi-photos-section">' +
        '<div class="pdfi-photos-head">' +
          '<input type="checkbox" id="pdfi-photos-cb" checked> ' +
          '<label for="pdfi-photos-cb"><strong>📷 ' + photos.length + ' Bild' + (photos.length === 1 ? '' : 'er') + '</strong> aus PDF — werden mit übernommen</label>' +
        '</div>' +
        '<div class="pdfi-photos-grid">' +
          photos.map(function(src, i) {
            return '<div class="pdfi-photo-thumb"><img src="' + src + '" alt="Foto ' + (i+1) + '"></div>';
          }).join('') +
        '</div>' +
      '</div>';
    } else {
      // V62: Auch bei 0 Bildern eine Sektion zeigen — als Status-Info für den User
      photosHtml = '<div class="pdfi-photos-section">' +
        '<div class="pdfi-photos-head" style="opacity:0.6">' +
          '<span>📷 Keine Bilder im PDF gefunden — du kannst sie nach dem Übernehmen direkt im Quick-Check hochladen.</span>' +
        '</div>' +
      '</div>';
    }

    body.innerHTML =
      '<div class="pdfi-result-head">' +
        '<div class="pdfi-result-icon">✓</div>' +
        '<div>' +
          '<h4>Daten erkannt</h4>' +
          '<div class="pdfi-result-sub">Wähle aus, welche Werte übernommen werden sollen.</div>' +
        '</div>' +
      '</div>' +
      (!anyValue ? '<div class="pdfi-result-warn">Die KI konnte aus dem PDF keine relevanten Daten extrahieren. Vielleicht ist es ein Bild-PDF oder ein Format das wir noch nicht unterstützen.</div>' : '') +
      '<table class="pdfi-result-table"><tbody>' + rows + '</tbody></table>' +
      photosHtml +
      '<div class="pdfi-result-actions">' +
        '<button type="button" class="btn btn-gold" onclick="pdfImportApply()">Ausgewählte übernehmen</button>' +
      '</div>';
    // data global merken für apply
    window._pdfImportData = data;
  }

  /**
   * "Übernehmen": entweder via Callback (Quick Check) oder direkt in FIELDS schreiben.
   */
  function pdfImportApply() {
    var modal = document.getElementById('pdfimport-modal');
    if (!modal) return;
    var checked = modal.querySelectorAll('input[type="checkbox"][data-fid]:checked');
    var picked = {};
    checked.forEach(function(cb) {
      picked[cb.getAttribute('data-fid')] = cb.getAttribute('data-val');
    });

    // V42/V62: Bilder mit übernehmen — immer wenn Bilder da sind
    // Die Checkbox kann fehlen wenn die Foto-Sektion nicht gerendert wurde
    var photoCb = document.getElementById('pdfi-photos-cb');
    var photos = (window._pdfImportData && window._pdfImportData._photos) || [];
    // Wenn Checkbox da: nur übernehmen wenn checked
    // Wenn Checkbox NICHT da (Sektion nicht gerendert): trotzdem übernehmen falls Bilder existieren
    var takePhotos = photoCb ? photoCb.checked : true;
    if (takePhotos && photos.length > 0) {
      picked._photos = photos;
    }

    // V57/V62: Debug-Log — zeigt was wirklich passiert
    var photoCount = (picked._photos && picked._photos.length) || 0;
    console.log('[PDF-Import] pickedKeys=', Object.keys(picked), 'photos=', photoCount,
                'callbackMode=', !!_onDoneCallback,
                'cbExists=', !!photoCb,
                'cbChecked=', photoCb ? photoCb.checked : 'n/a',
                'rawPhotos=', photos.length);

    // V57: Failsafe — Fotos IMMER direkt ans Tab Objekt geben (egal ob Callback-Modus)
    // damit beim "Als Objekt speichern" die Fotos da sind
    if (Array.isArray(picked._photos) && picked._photos.length > 0 && typeof window.dpSetImgs === 'function') {
      console.log('[PDF-Import] Setze', picked._photos.length, 'Fotos via dpSetImgs');
      window.dpSetImgs(picked._photos.map(function(src, i) {
        return { src: src, name: 'expose_seite_' + (i+1) + '.jpg' };
      }));
    }

    if (_onDoneCallback) {
      // Callback-Modus (Quick Check): einfach durchreichen
      try { _onDoneCallback(picked); } catch(e) { console.error('[PDF-Import] callback err:', e); }
      closePdfImport();
      return;
    }

    // Direkt-Modus: in DealPilot-FIELDS schreiben
    function set(id, val) { var e = document.getElementById(id); if (e && val) e.value = val; }
    if (picked.adresse) {
      // Adresse parsen
      var parts = picked.adresse.split(',');
      if (parts.length >= 1) {
        var s = parts[0].trim();
        var m = s.match(/^(.+?)\s+(\d+\w*)$/);
        if (m) { set('str', m[1]); set('hnr', m[2]); }
        else set('str', s);
      }
    }
    if (picked.plz) set('plz', picked.plz);
    if (picked.ort) set('ort', picked.ort);
    if (picked.kaufpreis) set('kp', picked.kaufpreis);
    if (picked.wohnflaeche) set('wfl', picked.wohnflaeche);
    if (picked.baujahr) set('baujahr', picked.baujahr);
    if (picked.nettokaltmiete) set('nkm', picked.nettokaltmiete);
    if (picked.objektart) {
      var sel = document.getElementById('objart');
      if (sel) {
        // Best-effort matching
        var raw = String(picked.objektart).toLowerCase();
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].text.toLowerCase().indexOf(raw) >= 0 || raw.indexOf(sel.options[i].text.toLowerCase()) >= 0) {
            sel.selectedIndex = i; break;
          }
        }
      }
    }
    if (picked.energieklasse) set('ds2_energie', picked.energieklasse.toUpperCase());
    if (picked.hausgeld) set('hg_ul', picked.hausgeld);
    // V42: Neue Felder
    if (picked.instandhaltung) set('inst', picked.instandhaltung);
    if (picked.eigenkapital) set('ek', picked.eigenkapital);
    if (picked.verwaltung) set('verwaltung', picked.verwaltung);
    if (picked.kaufnebenkosten) {
      // Wenn als Prozent kommt (z.B. "10.5") → in nk-Feld
      var nkInp = document.getElementById('nk_pct');
      if (nkInp) nkInp.value = picked.kaufnebenkosten;
    }

    if (typeof calc === 'function') calc();
    if (typeof updHeader === 'function') updHeader();

    // V42: Bilder aus PDF in window.imgs übernehmen + rendern
    if (Array.isArray(picked._photos) && picked._photos.length > 0 && typeof window.dpSetImgs === 'function') {
      window.dpSetImgs(picked._photos.map(function(src, i) {
        return { src: src, name: 'expose_seite_' + (i+1) + '.jpg' };
      }));
    }

    closePdfImport();
    if (typeof toast === 'function') {
      var n = picked._photos ? picked._photos.length : 0;
      toast('✓ Daten' + (n ? ' + ' + n + ' Bild' + (n===1?'':'er') : '') + ' aus PDF übernommen.');
    }
  }

  function _escHtml(s) {
    return ('' + (s == null ? '' : s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function _escAttr(s) { return _escHtml(s).replace(/"/g, '&quot;'); }

  // V63.91: Market-Data-Import — wiederverwendet die PDF-Modal-UI,
  // ruft aber /ai/extract-market-data und nutzt ein anderes Field-Mapping.
  // Aktiviert wird das via showMarketDataImport(); im Tab Objekt.
  // (_isMarketMode oben deklariert — Mode-Switch zwischen den beiden Endpoints)

  // Wir wrappen _callExtractEndpoint dynamisch je nach Modus.
  var _origCallExtract = _callExtractEndpoint;
  _callExtractEndpoint = async function(text) {
    if (!_isMarketMode) return await _origCallExtract(text);
    // Market-Mode: anderer Endpoint
    var res = await fetch('/api/v1/ai/extract-market-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _getToken()
      },
      body: JSON.stringify({ text: text, userApiKey: _getUserApiKey() })
    });
    var data;
    try { data = await res.json(); } catch(e) { data = {}; }
    if (!res.ok) {
      var msg = data.error || ('HTTP ' + res.status);
      if (data.needs_user_key) {
        msg = 'Backend hat keinen OpenAI-API-Key konfiguriert. ' +
              'Bitte in Einstellungen → KI → "Eigener OpenAI-API-Key" einen Key eintragen.';
      }
      var err = new Error(msg);
      err.status = res.status;
      err.needs_user_key = !!data.needs_user_key;
      throw err;
    }
    return data.extracted || {};
  };

  function showMarketDataImport() {
    _isMarketMode = true;
    showPdfImport(function(picked) {
      // picked enthält Felder aus extractMarketData (verkehrswert, lage_*, ...)
      function set(id, val) {
        var el = document.getElementById(id);
        if (!el || val == null || val === '') return;
        el.value = val;
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
      }
      function setSel(id, val) {
        var el = document.getElementById(id);
        if (!el || val == null) return;
        var raw = String(val).trim().toLowerCase();
        for (var i = 0; i < el.options.length; i++) {
          var t = (el.options[i].text || '').toLowerCase();
          var vv = (el.options[i].value || '').toLowerCase();
          if (t === raw || vv === raw || (raw && t.indexOf(raw) >= 0)) {
            el.selectedIndex = i;
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
            return;
          }
        }
      }
      if (picked.adresse) set('addr', picked.adresse);
      if (picked.plz) set('plz', picked.plz);
      if (picked.ort) set('ort', picked.ort);
      if (picked.wohnflaeche) set('wfl', picked.wohnflaeche);
      if (picked.baujahr) set('baujahr', picked.baujahr);
      if (picked.zimmer) set('zimmer', picked.zimmer);
      if (picked.objektart) setSel('objart', picked.objektart);

      // Kernfelder Lage- & Markt
      if (picked.verkehrswert) set('svwert', picked.verkehrswert);
      // bankval nur wenn nicht schon befüllt
      var bv = document.getElementById('bankval');
      if (bv && !bv.value && picked.verkehrswert_min) set('bankval', picked.verkehrswert_min);

      // Energie
      if (picked.energie_label) set('ds2_energie', String(picked.energie_label).toUpperCase());

      // V63.91: Lage-Scores → falls die Mikrolage noch leer ist, mappen wir
      // den Durchschnitt der PriceHubble-Scores (0-5) auf die DealPilot-Skala.
      var avgLage = 0, cnt = 0;
      ['lage_einkaufen','lage_bildung','lage_gastronomie','lage_gesundheit','lage_freizeit'].forEach(function(k){
        if (typeof picked[k] === 'number') { avgLage += picked[k]; cnt++; }
      });
      if (cnt >= 3) {
        var avg = avgLage / cnt;
        var mapVal = '';
        if (avg >= 4.5) mapVal = 'sehr_gut';
        else if (avg >= 3.5) mapVal = 'gut';
        else if (avg >= 2.5) mapVal = 'durchschnittlich';
        else if (avg >= 1.5) mapVal = 'schwach';
        else mapVal = 'sehr_schwach';
        var mikEl = document.getElementById('mikrolage');
        if (mikEl && !mikEl.value) {
          mikEl.value = mapVal;
          try { mikEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
        }
      }

      if (typeof calc === 'function') calc();
      if (typeof toast === 'function') {
        var bits = [];
        if (picked.verkehrswert) bits.push('Verkehrswert ' + Math.round(picked.verkehrswert/1000) + 'k €');
        if (picked.preis_pro_qm) bits.push(Math.round(picked.preis_pro_qm) + ' €/m²');
        toast('✓ Marktbericht übernommen' + (bits.length ? ': ' + bits.join(' · ') : ''));
      }
      _isMarketMode = false;  // Reset für nächsten Aufruf
    });
    // Modal-Header anpassen damit klar ist welcher Modus
    setTimeout(function(){
      var titleEl = document.querySelector('#pdfimport-modal .pdfi-title-block h3');
      var subEl = document.querySelector('#pdfimport-modal .pdfi-title-block .pdfi-sub');
      var iconEl = document.querySelector('#pdfimport-modal .pdfi-icon');
      if (titleEl) titleEl.textContent = 'Marktbericht-PDF importieren';
      if (subEl) subEl.textContent = 'PriceHubble, Sprengnetter, Maklergutachten — die KI extrahiert Verkehrswert, Lage-Scores und Wertentwicklung.';
      if (iconEl) iconEl.textContent = '📊';
    }, 50);
  }

  // Globale Exports
  window.showPdfImport         = showPdfImport;
  window.closePdfImport        = closePdfImport;
  window.pdfImportApply        = pdfImportApply;
  window.showMarketDataImport  = showMarketDataImport;
})();
