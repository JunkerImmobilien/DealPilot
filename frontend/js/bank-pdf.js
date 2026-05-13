'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V25 - bank-pdf.js
   "Bank-Präsentation" Export: 4 SVG-Charts als hochwertiges PDF

   Workflow:
   1. SVG-Charts aus DOM clonen
   2. SVG -> PNG (per Canvas) konvertieren
   3. jsPDF: Cover-Seite + 4 Chart-Seiten + Footer

   Aufruf: window.exportBankPdf()
═══════════════════════════════════════════════════════════════ */

(function() {

  function _qs(sel) { return document.querySelector(sel); }
  function _esc(s) { return String(s == null ? '' : s); }

  // ───────────── SVG -> PNG (via Canvas) ─────────────
  function _svgToPng(svgEl, scale) {
    return new Promise(function(resolve, reject) {
      try {
        scale = scale || 2;
        var clone = svgEl.cloneNode(true);
        if (!clone.getAttribute('viewBox')) {
          clone.setAttribute('viewBox', '0 0 ' + (svgEl.clientWidth || 1200) + ' ' + (svgEl.clientHeight || 380));
        }
        var vb = clone.getAttribute('viewBox').split(/\s+/);
        var w = parseFloat(vb[2]);
        var h = parseFloat(vb[3]);
        clone.setAttribute('width', w);
        clone.setAttribute('height', h);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // V63.69: filter-Defs und filter-Attribute entfernen - können SVG->Image brechen
        var filters = clone.querySelectorAll('filter');
        for (var fi = 0; fi < filters.length; fi++) {
          if (filters[fi].parentNode) filters[fi].parentNode.removeChild(filters[fi]);
        }
        var filtered = clone.querySelectorAll('[filter]');
        for (var ei = 0; ei < filtered.length; ei++) {
          filtered[ei].removeAttribute('filter');
        }
        var fos = clone.querySelectorAll('foreignObject');
        for (var fj = 0; fj < fos.length; fj++) {
          if (fos[fj].parentNode) fos[fj].parentNode.removeChild(fos[fj]);
        }

        // Externe Fonts ersetzen
        var allTexts = clone.querySelectorAll('text, tspan');
        for (var ti = 0; ti < allTexts.length; ti++) {
          var t = allTexts[ti];
          var ff = t.getAttribute('font-family') || '';
          if (/Cormorant/i.test(ff)) {
            t.setAttribute('font-family', 'Georgia, "Times New Roman", serif');
          } else if (/DM Sans/i.test(ff)) {
            t.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
          }
        }

        var serializer = new XMLSerializer();
        var svgString = serializer.serializeToString(clone);
        if (svgString.indexOf('<?xml') !== 0) {
          svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
        }

        // V63.71: Blob-URL als robusterer Pfad
        var url, isBlob = false;
        try {
          var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          url = URL.createObjectURL(blob);
          isBlob = true;
        } catch(blobErr) {
          url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        }

        var img = new Image();
        img.onload = function() {
          try {
            // V63.71: Validierung - naturalWidth > 0
            if (!img.naturalWidth || !img.naturalHeight) {
              if (isBlob) try { URL.revokeObjectURL(url); } catch(_) {}
              return reject(new Error('SVG-Image hat naturalWidth=0 (Decode fehlgeschlagen)'));
            }
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FAFAF7';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (isBlob) try { URL.revokeObjectURL(url); } catch(_) {}
            try {
              var pngUrl = canvas.toDataURL('image/png');
              if (!pngUrl || pngUrl.length < 1500) {
                return reject(new Error('PNG-DataURL zu kurz (' + (pngUrl||'').length + ' bytes) - leeres Render?'));
              }
              resolve({ dataUrl: pngUrl, width: w, height: h });
            } catch (taintErr) {
              reject(new Error('Canvas tainted: ' + taintErr.message));
            }
          } catch(e) { reject(e); }
        };
        img.onerror = function(e) {
          if (isBlob) try { URL.revokeObjectURL(url); } catch(_) {}
          reject(new Error('SVG -> Image konnte nicht geladen werden'));
        };
        img.src = url;
      } catch(e) { reject(e); }
    });
  }

  // ───────────── Card-Container -> PNG ─────────────
  // Wir rendern die ganze Card (Header + Chart + Footer) auf eine Canvas
  // Dazu ziehen wir den ganzen .bc-card als HTML-Snapshot.
  // Trick: Da kein html2canvas -> wir bauen ein "schön strukturiertes" PNG nur
  // aus dem SVG-Bereich und rendern Header/Footer als eigene PDF-Sektion.

  function _cardSvgFromHost(hostId) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    // V63.71: Cockpit/Stress haben mehrere SVGs (kleine Trend-Pfeile, Häkchen-Icons,
    // Bank-Tag-Icon). querySelector('svg') würde nur das erste (= ein winziges Icon)
    // zurückliefern. Wir holen das GRÖSSTE SVG nach viewBox-Fläche.
    var allSvgs = host.querySelectorAll('svg');
    if (!allSvgs || !allSvgs.length) return null;
    var best = allSvgs[0];
    var bestArea = 0;
    for (var i = 0; i < allSvgs.length; i++) {
      var c = allSvgs[i];
      var vb = c.getAttribute('viewBox');
      var w = 0, h = 0;
      if (vb) {
        var p = vb.split(/\s+/);
        w = parseFloat(p[2]) || 0;
        h = parseFloat(p[3]) || 0;
      } else {
        w = c.clientWidth || 0;
        h = c.clientHeight || 0;
      }
      var area = w * h;
      if (area > bestArea) { bestArea = area; best = c; }
    }
    console.log('[bank-pdf-svg] ' + hostId + ': ' + allSvgs.length + ' SVGs, gewählt area=' + bestArea);
    return best;
  }

  // ───────────── Texthelfer (Daten ausm DOM lesen) ─────────────
  function _readCardData(hostId) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    var card = host.querySelector('.bc-card');
    if (!card) return null;
    var eyebrow = (card.querySelector('.bc-head-eyebrow') || {}).textContent || '';
    var title = (card.querySelector('.bc-head-title') || {}).textContent || '';
    var sub = (card.querySelector('.bc-head-sub') || {}).textContent || '';
    var headlineKpi = (card.querySelector('.bc-headline-kpi') || {}).textContent || '';
    var headlineKpiLabel = (card.querySelector('.bc-headline-kpi-label') || {}).textContent || '';
    // Footer KPIs
    var footerCells = Array.prototype.slice.call(card.querySelectorAll('.bc-footer-cell'));
    var footer = footerCells.map(function(cell) {
      return {
        label: ((cell.querySelector('.bc-footer-label') || {}).textContent || '').trim(),
        value: ((cell.querySelector('.bc-footer-value') || {}).textContent || '').trim(),
        sub: ((cell.querySelector('.bc-footer-sub') || {}).textContent || '').trim()
      };
    });
    // Bank-Tag(s)
    var bankTags = Array.prototype.slice.call(card.querySelectorAll('.bc-bank-tag span:not(svg)'));
    var bankTagsArr = bankTags.map(function(s) { return s.textContent.trim(); });

    return {
      eyebrow: eyebrow.trim(),
      title: title.trim(),
      sub: sub.trim(),
      headlineKpi: headlineKpi.trim(),
      headlineKpiLabel: headlineKpiLabel.trim(),
      footer: footer,
      bankTags: bankTagsArr
    };
  }

  // ───────────── Hauptfunktion: PDF erstellen ─────────────
  async function exportBankPdf() {
    var btn = document.getElementById('bc-pdf-btn');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('span:last-child').textContent = 'PDF wird erstellt…';
    }

    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF nicht geladen');
      }
      if (!window.BankCharts) {
        throw new Error('BankCharts nicht verfügbar');
      }
      if (!window.State || !window.State.cfRows || window.State.cfRows.length === 0) {
        if (typeof toast === 'function') toast('Bitte zuerst Werte eingeben - keine Daten zum Exportieren.');
        throw new Error('Keine Daten');
      }

      // Sicherstellen dass alle 4 Charts gerendert sind (auch wenn Tab nicht offen war)
      window.BankCharts.renderAll(window.State);
      // V63.68: 2 RAFs + 600ms warten - robust gegen Browser-Render-Latency
      await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });
      await new Promise(function(r) { setTimeout(r, 600); });

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var pageW = doc.internal.pageSize.getWidth();   // 297
      var pageH = doc.internal.pageSize.getHeight();  // 210

      // Branding
      var branding = (window.DealPilotConfig && window.DealPilotConfig.branding && window.DealPilotConfig.branding.get())
        || { name: 'DealPilot', subtitle: 'by Junker Immobilien', primary: '#C9A84C', dark: '#2A2727' };

      // Objekt-Adresse
      var objAddr = '';
      try {
        var ortEl = document.getElementById('ort');
        var strEl = document.getElementById('str');
        var hnrEl = document.getElementById('hnr');
        var plzEl = document.getElementById('plz');
        var parts = [];
        if (strEl && strEl.value) parts.push(strEl.value + (hnrEl && hnrEl.value ? ' ' + hnrEl.value : ''));
        if (plzEl && plzEl.value) parts.push(plzEl.value);
        if (ortEl && ortEl.value) parts.push(ortEl.value);
        objAddr = parts.join(', ');
      } catch(e) {}
      if (!objAddr) objAddr = 'Immobilien-Investment';

      var today = new Date();
      var dateStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

      // ═══ COVER-SEITE ═══
      _drawCover(doc, pageW, pageH, branding, objAddr, dateStr);

      // ═══ SEITEN 2-5: jeweils ein Chart ═══
      var chartConfigs = [
        { hostId: 'bc-equity',    pageTitle: 'Vermögensaufbau',                     stress: false },
        { hostId: 'bc-cockpit',   pageTitle: 'Bank-Cockpit · Risiko-Kennzahlen',    stress: false },
        { hostId: 'bc-waterfall', pageTitle: 'Vermögenszuwachs',                    stress: false },
        { hostId: 'bc-stress',    pageTitle: 'Stress-Test · DSCR-Resilienz',        stress: true }
      ];

      for (var i = 0; i < chartConfigs.length; i++) {
        var cfg = chartConfigs[i];
        doc.addPage();
        // V63.71: Stress-Test programmatisch (HTML-Grid lässt sich nicht via SVG capturen)
        if (cfg.stress) {
          await _drawStressMatrixPage(doc, pageW, pageH, branding, cfg, i + 2);
        } else {
          await _drawChartPage(doc, pageW, pageH, branding, cfg, i + 2);
        }
      }

      // ═══ FOOTER auf jeder Seite (außer Cover) ═══
      // Schon in _drawChartPage gemacht

      // Save
      var safeAddr = objAddr.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      var filename = 'DealPilot_Bank-Präsentation_' + safeAddr + '_' + today.toISOString().slice(0, 10) + '.pdf';

      // V63.76: Wenn der Aufrufer einen Blob will (Anhang an Deal-Aktion), nicht speichern.
      if (typeof window._exportBankPdfReturnMode === 'object' && window._exportBankPdfReturnMode.returnBlob) {
        window._exportBankPdfReturnMode.blob = doc.output('blob');
        window._exportBankPdfReturnMode.filename = filename;
        return;
      }

      doc.save(filename);

      if (typeof toast === 'function') toast('✓ Bank-Präsentation gespeichert');

    } catch(err) {
      console.error('[bank-pdf] export failed:', err);
      if (typeof toast === 'function') toast('✗ PDF-Erstellung fehlgeschlagen: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.querySelector('span:last-child').textContent = 'Bank-Präsentation als PDF';
      }
    }
  }

  // ───────────── COVER-SEITE ─────────────
  function _drawCover(doc, pageW, pageH, branding, objAddr, dateStr) {
    // Hintergrund: Charcoal mit Gold-Akzent rechts oben
    doc.setFillColor(42, 39, 39);
    doc.rect(0, 0, pageW, pageH, 'F');
    // Top-Streifen Gold
    doc.setFillColor(201, 168, 76);
    doc.rect(0, 0, pageW, 1.5, 'F');

    // Logo/Marke oben links
    doc.setTextColor(201, 168, 76);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('DealPilot', 18, 30);
    doc.setTextColor(148, 147, 147);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('by Junker Immobilien', 18, 36);

    // Eyebrow
    doc.setTextColor(201, 168, 76);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('- BANK-PRÄSENTATION', 18, 88);

    // Titel
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'normal');
    doc.setFontSize(36);
    doc.text(objAddr, 18, 105);

    // Subtitle
    doc.setTextColor(201, 168, 76);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('Investment-Analyse für die Finanzierungsentscheidung', 18, 116);

    // Description
    doc.setTextColor(180, 179, 179);
    doc.setFontSize(10);
    var descLines = [
      'Diese Präsentation zeigt die wichtigsten Kennzahlen für eine fundierte Bank-Diskussion.',
      'Vermögensaufbau, DSCR/LTV-Trends, Vermögenszuwachs und Stress-Test-Resilienz auf einen Blick.'
    ];
    doc.text(descLines, 18, 128);

    // Inhaltsverzeichnis
    doc.setTextColor(201, 168, 76);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('- INHALT', 18, 152);
    var toc = [
      ['1', 'Vermögensaufbau (Equity-Build)'],
      ['2', 'Bank-Cockpit (DSCR · LTV im Verlauf)'],
      ['3', 'Vermögenszuwachs (Multiple-Analyse)'],
      ['4', 'Stress-Test (Mietausfall · Zinssteigerung)']
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    toc.forEach(function(item, i) {
      var y = 162 + i * 7;
      doc.setTextColor(201, 168, 76);
      doc.text(item[0], 18, y);
      doc.setTextColor(223, 222, 222);
      doc.text(item[1], 28, y);
    });

    // Datum + Footer
    doc.setTextColor(137, 136, 136);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Stand: ' + dateStr, 18, pageH - 12);
    doc.setTextColor(201, 168, 76);
    doc.text('DealPilot · Premium-Investment-Analyse', pageW - 18, pageH - 12, { align: 'right' });
  }

  // ───────────── CHART-SEITE ─────────────
  async function _drawChartPage(doc, pageW, pageH, branding, cfg, pageNum) {
    var data = _readCardData(cfg.hostId);
    var svg = _cardSvgFromHost(cfg.hostId);

    // Header-Bereich oben (15mm hoch)
    // Top-Streifen Gold
    doc.setFillColor(201, 168, 76);
    doc.rect(0, 0, pageW, 1.5, 'F');

    // Eyebrow
    doc.setTextColor(166, 138, 54);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text((data && data.eyebrow ? data.eyebrow.toUpperCase() : cfg.pageTitle.toUpperCase()), 18, 14);

    // Title (reine Title aus DOM, oder Fallback)
    doc.setTextColor(42, 39, 39);
    doc.setFont('times', 'normal');
    doc.setFontSize(22);
    var title = (data && data.title) || cfg.pageTitle;
    doc.text(title, 18, 24);

    // Sub
    if (data && data.sub) {
      doc.setTextColor(120, 115, 110);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      var subLines = doc.splitTextToSize(data.sub, pageW - 36);
      doc.text(subLines, 18, 31);
    }

    // Trennlinie
    doc.setDrawColor(220, 200, 130);
    doc.setLineWidth(0.3);
    doc.line(18, 39, pageW - 18, 39);

    // Chart-SVG einfügen (max 200mm breit, höhe proportional)
    if (svg) {
      try {
        var pngResult = await _svgToPng(svg, 2);
        var imgRatio = pngResult.width / pngResult.height;
        var maxW = pageW - 36;
        var maxH = pageH - 75;
        var imgW = maxW;
        var imgH = imgW / imgRatio;
        if (imgH > maxH) {
          imgH = maxH;
          imgW = imgH * imgRatio;
        }
        var imgX = (pageW - imgW) / 2;
        var imgY = 44;
        doc.addImage(pngResult.dataUrl, 'PNG', imgX, imgY, imgW, imgH);
      } catch(e) {
        console.warn('[bank-pdf] SVG render failed for ' + cfg.hostId + ':', e);
        // V63.71: Hinweis-Box statt einzeiliger Fehlertext
        doc.setFillColor(255, 248, 230);
        doc.roundedRect(18, 50, pageW - 36, 30, 2, 2, 'F');
        doc.setDrawColor(201, 168, 76);
        doc.setLineWidth(0.4);
        doc.roundedRect(18, 50, pageW - 36, 30, 2, 2, 'D');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.setTextColor(166, 138, 54);
        doc.text('Chart konnte nicht gerendert werden', 22, 60);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.setTextColor(80, 75, 70);
        doc.text('Tipp: Tab "Kennzahlen" einmal öffnen, kurz warten bis die Charts sichtbar sind, dann erneut den PDF-Export starten.', 22, 67);
        doc.setFontSize(8);
        doc.setTextColor(120, 115, 110);
        doc.text('Technischer Hinweis (für Support): ' + (e && e.message || 'unbekannter Fehler'), 22, 75);
      }
    } else {
      // V63.71: SVG nicht im DOM -> Tab nicht geöffnet
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(18, 50, pageW - 36, 24, 2, 2, 'F');
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.4);
      doc.roundedRect(18, 50, pageW - 36, 24, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.setTextColor(166, 138, 54);
      doc.text('Chart-Container leer', 22, 60);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      doc.text('Bitte Tab "Kennzahlen" einmal öffnen, dann erneut exportieren.', 22, 67);
    }

    // Footer-KPIs (bis zu 4) als Boxen unten
    if (data && data.footer && data.footer.length > 0) {
      var fY = pageH - 28;
      var fH = 16;
      var nF = Math.min(data.footer.length, 4);
      var fW = (pageW - 36) / nF;
      data.footer.slice(0, nF).forEach(function(cell, i) {
        var fX = 18 + i * fW;
        doc.setDrawColor(220, 200, 130);
        doc.setFillColor(248, 246, 241);
        doc.rect(fX + 1, fY, fW - 2, fH, 'FD');
        doc.setTextColor(166, 138, 54);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(cell.label, fX + 4, fY + 5);
        doc.setTextColor(42, 39, 39);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(cell.value, fX + 4, fY + 11);
        if (cell.sub) {
          doc.setTextColor(120, 115, 110);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          var subS = doc.splitTextToSize(cell.sub, fW - 8);
          doc.text(subS[0] || '', fX + 4, fY + 14.5);
        }
      });
    }

    // Page-Footer
    doc.setDrawColor(220, 218, 215);
    doc.setLineWidth(0.2);
    doc.line(18, pageH - 8, pageW - 18, pageH - 8);
    doc.setTextColor(120, 115, 110);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('DealPilot · Bank-Präsentation', 18, pageH - 4);
    doc.text('Seite ' + pageNum + ' von 5', pageW - 18, pageH - 4, { align: 'right' });
  }

  // V63.71: Stress-Test-Page programmatisch zeichnen (Querformat)
  async function _drawStressMatrixPage(doc, pageW, pageH, branding, cfg, pageNum) {
    var data = _readCardData(cfg.hostId);

    // Top-Streifen Gold
    doc.setFillColor(201, 168, 76);
    doc.rect(0, 0, pageW, 1.5, 'F');

    // Eyebrow + Title
    doc.setTextColor(166, 138, 54);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text((data && data.eyebrow ? data.eyebrow.toUpperCase() : cfg.pageTitle.toUpperCase()), 18, 14);

    doc.setTextColor(42, 39, 39);
    doc.setFont('times', 'normal');
    doc.setFontSize(22);
    var title = (data && data.title) || cfg.pageTitle;
    doc.text(title, 18, 24);

    if (data && data.sub) {
      doc.setTextColor(120, 115, 110);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(data.sub, pageW - 36), 18, 31);
    }

    doc.setDrawColor(220, 200, 130);
    doc.setLineWidth(0.3);
    doc.line(18, 39, pageW - 18, 39);

    // Matrix-Daten
    var sd = window.BankCharts && window.BankCharts._lastStressData;
    if (!sd || !sd.matrix) {
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(18, 50, pageW - 36, 30, 2, 2, 'F');
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.4);
      doc.roundedRect(18, 50, pageW - 36, 30, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.setTextColor(166, 138, 54);
      doc.text('Stress-Test-Daten nicht verfügbar', 22, 60);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      doc.text('Bitte Tab "Kennzahlen" einmal öffnen, dann erneut exportieren.', 22, 67);
    } else {
      // Layout: Querformat A4 = 297×210mm. Matrix zentriert.
      var cellW = 38, cellH = 22;
      var matW = 5 * cellW;
      var matH = 5 * cellH;
      var matX = (pageW - matW) / 2 + 12; // +12 für Y-Achsen-Labels
      var matY = 56;

      // X-Achse-Header (Mietausfall)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      doc.text('Mietausfall / -veränderung ->', matX + matW / 2, matY - 8, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(120, 115, 110);
      sd.mietSzen.forEach(function(m, i) {
        var label = (m > 0 ? '+' : '') + m + ' %';
        doc.text(label, matX + i * cellW + cellW / 2, matY - 2, { align: 'center' });
      });

      // Y-Achse-Header (Zinsänderung)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      doc.text('Zinsänderung v', matX - 14, matY + matH / 2, { align: 'center', angle: 90 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(120, 115, 110);
      sd.zinsSzen.forEach(function(z, i) {
        var label = (z > 0 ? '+' : '') + z.toFixed(1) + ' pp';
        doc.text(label, matX - 2, matY + i * cellH + cellH / 2 + 1, { align: 'right' });
      });

      // Matrix-Zellen
      sd.matrix.forEach(function(row, rIdx) {
        row.forEach(function(d, cIdx) {
          var x = matX + cIdx * cellW;
          var y = matY + rIdx * cellH;
          var fill, border;
          if (d >= 1.2)      { fill = [232, 246, 237]; border = [63, 165, 108]; }
          else if (d >= 1.0) { fill = [248, 240, 210]; border = [201, 168, 76]; }
          else if (d >= 0.8) { fill = [248, 220, 185]; border = [220, 130, 80]; }
          else               { fill = [248, 220, 215]; border = [184, 98, 92]; }

          doc.setFillColor(fill[0], fill[1], fill[2]);
          doc.setDrawColor(border[0], border[1], border[2]);
          doc.setLineWidth(0.4);
          doc.rect(x, y, cellW - 0.5, cellH - 0.5, 'FD');

          // Base-Case-Marker
          if (rIdx === sd.baseRow && cIdx === sd.baseCol) {
            doc.setLineWidth(1.4);
            doc.setDrawColor(26, 20, 20);
            doc.rect(x, y, cellW - 0.5, cellH - 0.5, 'D');
            doc.setLineWidth(0.4);
          }

          // DSCR
          doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
          doc.setTextColor(40, 35, 35);
          doc.text(d.toFixed(2).replace('.', ','), x + cellW / 2, y + cellH / 2 + 1, { align: 'center' });
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
          doc.setTextColor(120, 115, 110);
          doc.text('DSCR', x + cellW / 2, y + cellH - 3, { align: 'center' });
        });
      });

      // Legende unter Matrix
      var legY = matY + matH + 10;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(80, 75, 70);
      var legSpacing = 50;
      var legends = [
        { color: [63, 165, 108],  bg: [232, 246, 237], label: 'DSCR >= 1,2 (gut)' },
        { color: [201, 168, 76],  bg: [248, 240, 210], label: 'DSCR 1,0-1,2 (knapp)' },
        { color: [220, 130, 80],  bg: [248, 220, 185], label: 'DSCR 0,8-1,0 (warn)' },
        { color: [184, 98, 92],   bg: [248, 220, 215], label: 'DSCR < 0,8 (Stress)' }
      ];
      var legStartX = (pageW - 4 * legSpacing) / 2;
      legends.forEach(function(l, i) {
        doc.setFillColor(l.bg[0], l.bg[1], l.bg[2]);
        doc.setDrawColor(l.color[0], l.color[1], l.color[2]);
        doc.setLineWidth(0.4);
        doc.rect(legStartX + i * legSpacing, legY, 5, 5, 'FD');
        doc.setTextColor(80, 75, 70);
        doc.text(l.label, legStartX + i * legSpacing + 6.5, legY + 4);
      });

      // Hinweis
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
      doc.setTextColor(120, 115, 110);
      doc.text('Schwarz umrandete Zelle = Base-Case (heute, volle Vermietung).',
        pageW / 2, legY + 12, { align: 'center' });
    }

    // Footer
    doc.setDrawColor(220, 218, 215);
    doc.setLineWidth(0.2);
    doc.line(18, pageH - 8, pageW - 18, pageH - 8);
    doc.setTextColor(120, 115, 110);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('DealPilot · Bank-Präsentation', 18, pageH - 4);
    doc.text('Seite ' + pageNum + ' von 5', pageW - 18, pageH - 4, { align: 'right' });
  }

  // Export
  window.exportBankPdf = exportBankPdf;

  // V63.76: Wrapper - generiert Bank-PDF und gibt {blob, filename} zurück,
  // ohne Download. Wird von deal-action.js verwendet, um den Bankexport
  // an Bankanfrage/FB-E-Mails anzuhängen.
  async function exportBankPdfBlob() {
    window._exportBankPdfReturnMode = { returnBlob: true };
    try {
      await exportBankPdf();
      var result = {
        blob: window._exportBankPdfReturnMode.blob,
        filename: window._exportBankPdfReturnMode.filename
      };
      return result.blob ? result : null;
    } finally {
      window._exportBankPdfReturnMode = null;
    }
  }
  window.exportBankPdfBlob = exportBankPdfBlob;

})();
