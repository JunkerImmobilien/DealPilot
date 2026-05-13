'use strict';
/* ═══════════════════════════════════════════════════════════════════
   DEALPILOT – portfolio-strategy-pdf.js                       (V132)

   Strategie-PDF Export: bündelt das komplette Beratungs-Ergebnis
   des Portfolio-Strategie-Moduls in eine PDF-Datei.

   Aufbau:
     Seite 1: Cover (Branding, Datum, Portfolio-Snapshot-Zusammenfassung)
     Seite 2: Strategische Empfehlung (Headline, Situation, Roadmap)
     Seite 3: Nächste Schritte (priorisierte Liste)
     Seite 4-X: Pro Strategie eine eigene Seite (1-2 je Strategie)
     Seite X+1: Peer-Vergleich
     Seite letzte: §-Disclaimer + Datum

   Aufruf:
     window.exportPortfolioStrategyPDF()

   Voraussetzung: window.PortfolioStrategy.getState().results muss
   vorliegen (sonst wird vorher loadAndAnalyze ausgeführt).
═══════════════════════════════════════════════════════════════════ */

(function() {

  // Farben (synchron mit anderen DealPilot-PDFs)
  var GOLD  = [201, 168, 76];
  var CH    = [42, 39, 39];
  var MUTED = [122, 115, 112];
  var GREEN = [42, 154, 90];
  var RED   = [201, 76, 76];
  var BLUE  = [60, 105, 160];
  var BG    = [248, 246, 241];
  var BORDER= [220, 215, 200];

  var W = 210, H = 297, M = 14;  // A4 portrait, Margins 14mm

  // ── HELPER ──────────────────────────────────────────────────────
  function _branding() {
    return (typeof _getBranding === 'function')
      ? _getBranding()
      : { company: 'DealPilot' };
  }

  function _now() {
    var d = new Date();
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
  }

  function _fE(n) {
    if (n == null || isNaN(n)) return '–';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  function _safeText(doc, text, x, y, opts) {
    // jsPDF kann mit Spezialzeichen Probleme haben — Soft-Hyphens entfernen
    var safe = String(text || '')
      .replace(/­/g, '')             // Soft hyphen
      .replace(/\u00A0/g, ' ');      // Non-breaking space
    doc.text(safe, x, y, opts);
  }

  // Mehrzeiliger Text mit automatischem Umbruch
  function _wrappedText(doc, text, x, y, maxW, lineH) {
    if (!text) return y;
    var lines = doc.splitTextToSize(String(text)
      .replace(/­/g, '')
      .replace(/\u00A0/g, ' '), maxW);
    for (var i = 0; i < lines.length; i++) {
      doc.text(lines[i], x, y);
      y += lineH;
    }
    return y;
  }

  // Seiten-Header (auf jeder Folge-Seite)
  function _drawPageHeader(doc, pageNum, totalPages, branding) {
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(0, 0, W, 6, 'F');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, branding.company || 'DealPilot', M, 12);
    _safeText(doc, 'Portfolio-Strategie · ' + _now(), W - M, 12, { align: 'right' });
    // Trennlinie
    doc.setDrawColor.apply(doc, BORDER);
    doc.setLineWidth(0.2);
    doc.line(M, 14.5, W - M, 14.5);
  }

  // Footer (Seitenzahl + Disclaimer-Hinweis)
  function _drawPageFooter(doc, pageNum, totalPages) {
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _safeText(doc, 'Modellrechnung · keine Steuer- oder Rechtsberatung iSv §6 StBerG / §3 RDG', M, H - 8);
    _safeText(doc, 'Seite ' + pageNum + ' / ' + totalPages, W - M, H - 8, { align: 'right' });
  }

  // Section heading
  function _drawSectionHeading(doc, text, y) {
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, text, M, y);
    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.5);
    doc.line(M, y + 1.5, M + 24, y + 1.5);
    return y + 8;
  }

  // ── COVER PAGE ──────────────────────────────────────────────────
  function _renderCover(doc, res, branding) {
    // Goldener Strich oben
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(0, 0, W, 4, 'F');

    // Hero-Block: Charcoal Hintergrund
    doc.setFillColor.apply(doc, CH);
    doc.rect(0, 4, W, 90, 'F');

    // Branding-Company
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, (branding.company || 'DealPilot').toUpperCase(), M, 22);

    // Goldener Akzent-Strich
    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.6);
    doc.line(M, 26, M + 36, 26);

    // Großer Titel
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Portfolio-Strategie', M, 46);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, GOLD);
    _safeText(doc, 'Beratungs-Analyse', M, 56);

    // Datum + Bestand
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    var p = res.portfolio;
    _safeText(doc, 'Stand: ' + _now(), M, 76);
    _safeText(doc, p.count + ' Objekte · Gesamt-Investition ' + _fE(p.gi), M, 84);

    // Headline-Box (außerhalb Hero)
    var y = 110;
    if (res.narrative && res.narrative.headline) {
      doc.setFillColor(248, 244, 230);  // Gold-bg
      doc.setDrawColor.apply(doc, GOLD);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, y, W - 2*M, 28, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'KERNERKENNTNIS', M + 6, y + 7);
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      _wrappedText(doc, res.narrative.headline, M + 6, y + 14, W - 2*M - 12, 5);
      y += 36;
    }

    // KPI-Block: 4 Kacheln
    y = 158;
    _drawSectionHeading(doc, 'Portfolio auf einen Blick', y);
    y += 4;

    var kpiW = (W - 2*M - 9) / 4;
    var kpiH = 22;

    function _kpi(x, yy, label, val, sub) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor.apply(doc, BORDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, yy, kpiW, kpiH, 1.5, 1.5, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'normal');
      _safeText(doc, label, x + 3, yy + 5);
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, val, x + 3, yy + 12);
      if (sub) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor.apply(doc, MUTED);
        _safeText(doc, sub, x + 3, yy + 18);
      }
    }
    _kpi(M, y, 'Objekte', String(p.count), 'Bestand');
    _kpi(M + kpiW + 3, y, 'V+V-Überschuss/J', _fE(p.vuv_y), 'vor Steuer');
    _kpi(M + 2*(kpiW + 3), y, 'Beleihungs-Reserve', _fE(p.beleihungs_reserve), 'aktivierbar');
    _kpi(M + 3*(kpiW + 3), y, 'LTV (aktuell)', Math.round((p.ltv_aktuell || p.ltv) * 100) + ' %', 'Verkehrswert-Basis');
    y += kpiH + 8;

    // Lage/Upside-Block (V131)
    if (p.lageAvg != null || p.upsideAvg != null) {
      doc.setFillColor.apply(doc, BG);
      doc.setDrawColor.apply(doc, BORDER);
      doc.roundedRect(M, y, W - 2*M, 22, 1.5, 1.5, 'FD');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'LAGE-QUALITÄT (DealScore 2)', M + 4, y + 6);
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      var lageTxt = '';
      if (p.lageAvg != null) lageTxt += 'Ø Lage: ' + p.lageAvg + '/100   ';
      if (p.upsideAvg != null) lageTxt += '·   Ø Upside: ' + p.upsideAvg + '/100';
      _safeText(doc, lageTxt, M + 4, y + 13);
      if (p.topLageObjects && p.topLageObjects.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor.apply(doc, MUTED);
        var top = p.topLageObjects.slice(0, 3).map(function(o) { return o.kuerzel; }).join(', ');
        _safeText(doc, 'Top-Lagen: ' + top, M + 4, y + 19);
      }
      y += 28;
    }

    // Footer auf Cover
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _safeText(doc, 'Modellrechnung. Keine Steuer- oder Rechtsberatung iSv §6 StBerG / §3 RDG. Steuerberater-Letzt-Check zwingend.',
      M, H - 12, { maxWidth: W - 2*M });
  }

  // ── NARRATIVE PAGE ──────────────────────────────────────────────
  function _renderNarrative(doc, res, branding) {
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'Strategische Empfehlung', y);

    if (!res.narrative) {
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, MUTED);
      _safeText(doc, 'Keine Narrative-Daten verfügbar.', M, y);
      return;
    }
    var nr = res.narrative;

    // Situation
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Situation', M, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = _wrappedText(doc, nr.situation, M, y, W - 2*M, 4.6) + 4;

    // Roadmap (3-Spalten)
    if (nr.struktur_empfehlung) {
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'Struktur-Roadmap', M, y);
      y += 6;
      var colW = (W - 2*M - 6) / 3;
      var colH = 50;
      var titles = ['JETZT', 'IN 2-3 JAHREN', 'LANGFRISTIG'];
      var bodies = [nr.struktur_empfehlung.jetzt, nr.struktur_empfehlung.in_2_3_jahren, nr.struktur_empfehlung.langfristig];
      for (var i = 0; i < 3; i++) {
        var x = M + i * (colW + 3);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor.apply(doc, BORDER);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, colW, colH, 1.5, 1.5, 'FD');
        // Top-Streifen gold
        doc.setFillColor.apply(doc, GOLD);
        doc.rect(x, y, colW, 1, 'F');
        doc.setFontSize(7.5);
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, titles[i], x + 3, y + 6);
        doc.setFontSize(8);
        doc.setTextColor.apply(doc, CH);
        doc.setFont('helvetica', 'normal');
        _wrappedText(doc, bodies[i] || '–', x + 3, y + 11, colW - 6, 3.8);
      }
      y += colH + 8;
    }

    // Nächste Schritte
    if (nr.naechste_schritte && nr.naechste_schritte.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'Priorisierte nächste Schritte', M, y);
      y += 6;
      for (var s = 0; s < nr.naechste_schritte.length; s++) {
        var step = nr.naechste_schritte[s];
        // Seitenwechsel wenn wenig Platz
        if (y > H - 50) {
          _drawPageFooter(doc, 0, 0);
          doc.addPage();
          _drawPageHeader(doc, 0, 0, branding);
          y = 24;
          doc.setFontSize(10);
          doc.setTextColor.apply(doc, CH);
          doc.setFont('helvetica', 'bold');
          _safeText(doc, 'Priorisierte nächste Schritte (Forts.)', M, y);
          y += 6;
        }
        // Nummer-Kreis
        doc.setFillColor.apply(doc, CH);
        doc.circle(M + 3, y + 2, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, String(s + 1), M + 3, y + 3, { align: 'center' });
        // Titel
        doc.setFontSize(9.5);
        doc.setTextColor.apply(doc, CH);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, step.titel || '', M + 9, y + 1);
        // Kategorie + Impact
        var meta = '';
        if (step.kategorie) meta += '[' + step.kategorie + ']';
        if (step.impact_eur) meta += (meta ? '   ·   ' : '') + 'Impact: ~' + _fE(step.impact_eur);
        if (meta) {
          doc.setFontSize(7.5);
          doc.setTextColor.apply(doc, MUTED);
          doc.setFont('helvetica', 'normal');
          _safeText(doc, meta, M + 9, y + 5);
        }
        // Detail
        doc.setFontSize(8.5);
        doc.setTextColor.apply(doc, CH);
        doc.setFont('helvetica', 'normal');
        y = _wrappedText(doc, step.detail || '', M + 9, y + 10, W - 2*M - 11, 4) + 3;
      }
    }
  }

  // ── V135: ZUKAUF-PLAN-SEITE ─────────────────────────────────────
  function _renderZukaufPlan(doc, res, branding) {
    var p = res.portfolio;
    if (!p || !p.zukaufPlan) return;
    var zp = p.zukaufPlan;
    // Nur rendern, wenn Zukauf-Plan nicht trivial leer ist
    if (!zp.zielenheiten_pa && !zp.kp_avg) return;

    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'Zukauf-Plan \u2014 was kostet dich das wirklich?', y);

    // Header-Info
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    var headerLine = 'Plan: ' + zp.zielenheiten_pa + ' Einheit(en)/J. KP-Korridor ' + _fE(zp.kp_korridor[0]) + '\u2013' + _fE(zp.kp_korridor[1]) + '. Marktzins ' + zp.marktzins_pct.toFixed(1).replace('.', ',') + ' % (Stand ' + zp.marktzins_stand + ', Quelle: Interhyp/Dr. Klein/baufi24).';
    y = _wrappedText(doc, headerLine, M, y, W - 2*M, 4) + 6;

    // Spalten: links EK-Bedarf, rechts Annuit\u00E4t
    var colW = (W - 2*M - 8) / 2;
    var colHeight = 70;

    // SPALTE 1: EK-Bedarf
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor.apply(doc, BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, y, colW, colHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'EK-BEDARF PRO ZUKAUF', M + 5, y + 6);
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, 'Bei \u00D8 KP ' + _fE(zp.kp_avg), M + 5, y + 12);

    var lineH = 4.5;
    var ly = y + 19;
    function _kvLine(x, label, val, bold) {
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      _safeText(doc, label, x, ly);
      _safeText(doc, val, x + colW - 8, ly, { align: 'right' });
    }
    _kvLine(M + 5, 'Nebenkosten gesamt (' + zp.nebenkosten_pct.toFixed(1).replace('.', ',') + ' %)', _fE(zp.nebenkosten_eur));
    ly += lineH;
    _kvLine(M + 5, '  davon GrESt (' + zp.bundesland + ')', _fE(zp.kp_avg * zp.grest_pct / 100));
    ly += lineH;
    _kvLine(M + 5, '  Notar+Grundbuch', _fE(zp.kp_avg * 0.015));
    ly += lineH;
    _kvLine(M + 5, '  Makler', _fE(zp.kp_avg * 0.0357));
    ly += lineH + 2;
    _kvLine(M + 5, 'Min EK (NK ohne Makler)', _fE(zp.ek_bedarf_min));
    ly += lineH;
    _kvLine(M + 5, 'Solider EK-Anteil (NK + 10 %)', _fE(zp.ek_bedarf_solid), true);
    ly += lineH;
    _kvLine(M + 5, 'Sicher (NK + 20 %)', _fE(zp.ek_bedarf_sicher));

    // SPALTE 2: Annuit\u00E4t + Sparquote
    var col2X = M + colW + 8;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor.apply(doc, BORDER);
    doc.roundedRect(col2X, y, colW, colHeight, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'ANNUIT\u00C4T + SPARQUOTE', col2X + 5, y + 6);
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, 'Bei Marktzins ' + zp.marktzins_pct.toFixed(1).replace('.', ',') + ' % + 2 % Tilgung', col2X + 5, y + 12);

    ly = y + 19;
    function _kvLine2(label, val, bold) {
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      _safeText(doc, label, col2X + 5, ly);
      _safeText(doc, val, col2X + colW - 8, ly, { align: 'right' });
    }
    _kvLine2('Darlehen 80 % LTV', _fE(zp.darlehen_solid));
    ly += lineH;
    _kvLine2('  Annuit\u00E4t/J', _fE(zp.annuitaet_solid));
    ly += lineH;
    _kvLine2('Darlehen 100 % LTV', _fE(zp.darlehen_aggressiv));
    ly += lineH;
    _kvLine2('  Annuit\u00E4t/J', _fE(zp.annuitaet_aggressiv));
    ly += lineH + 2;
    _kvLine2('Sparquote (' + (res.profile ? '' : '') + Math.round((zp.sparquote_abs / Math.max(1, zp.sparquote_abs / 0.15) || 15)) + ' %)', _fE(zp.sparquote_abs));
    ly += lineH;
    _kvLine2('+ Beleihungs-Reserve / 5J', _fE(zp.beleihreserve_pa));
    ly += lineH;
    _kvLine2('= EK-Zufluss/Jahr', _fE(zp.ek_zufluss_y), true);

    y += colHeight + 8;

    // Diagnose-Box
    var diagBoxH = 50;
    doc.setFillColor(248, 246, 241);
    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - 2*M, diagBoxH, 1.5, 1.5, 'FD');
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(M, y, 3, diagBoxH, 'F');

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'DIAGNOSE', M + 8, y + 7);

    var dy = y + 13;
    // Sparquote-Status
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    var statusColor = zp.sparquote_status === 'ausreichend' ? GREEN : zp.sparquote_status === 'knapp' ? GOLD : RED;
    doc.setTextColor.apply(doc, statusColor);
    _safeText(doc, 'Sparquote: ' + zp.sparquote_status.toUpperCase(), M + 8, dy);
    dy += 4;
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    var sparText = '';
    if (zp.sparquote_status === 'ausreichend') {
      sparText = 'EK-Zufluss ' + _fE(zp.ek_zufluss_y) + '/J deckt den Bedarf von ' + _fE(zp.ek_bedarf_pa) + '/J f\u00FCr ' + zp.zielenheiten_pa + ' Einheit(en)/J.';
    } else {
      sparText = 'Aktuell ' + Math.round(zp.deckungsquote * 100) + ' % gedeckt. Empfehlung: Sparquote auf ~' + zp.sparquote_empfohlen + ' % anheben oder Plan auf ' + Math.round(zp.zielenheiten_pa * zp.deckungsquote * 10) / 10 + ' Einheit(en)/J reduzieren.';
    }
    dy = _wrappedText(doc, sparText, M + 8, dy, W - 2*M - 16, 4) + 3;

    // Belastungsquote
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    var belColor = zp.belastung_status === 'gut' ? GREEN : zp.belastung_status === 'akzeptabel' ? GOLD : RED;
    doc.setTextColor.apply(doc, belColor);
    _safeText(doc, 'Annuit\u00E4ten-Belastung: ' + (zp.belastung_status || 'unklar').toUpperCase(), M + 8, dy);
    dy += 4;
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    var belPct = zp.belastungsquote != null ? Math.round(zp.belastungsquote * 100) : null;
    var belText = belPct != null
      ? 'Inkl. neuer Annuit\u00E4ten ' + belPct + ' % vom Netto. ' +
        (zp.belastung_status === 'kritisch' ? '\u26A0 \u00DCber Banken-Faustregel von 35 % \u2014 weitere Finanzierungen unwahrscheinlich.' : '')
      : 'Belastungs-Daten unvollst\u00E4ndig.';
    _wrappedText(doc, belText, M + 8, dy, W - 2*M - 16, 4);

    y += diagBoxH + 6;

    // Zinssatz-Hinweis
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _wrappedText(doc,
      'Zinssatz-Anker: 10-J-Sollzins liegt aktuell bei 3,5\u20134 %. Eine 20-j\u00E4hrige Zinsbindung kostet 0,3\u20130,5 Pp Aufschlag, sichert aber gegen Zinserh\u00F6hungs-Risiken ab. Quellen: Interhyp 05/2026, Dr. Klein, baufi24, Statista (Bundesbank-Daten).',
      M, y, W - 2*M, 4);
  }

  // ── V134: LAGE- & MARKT-DIAGNOSE-SEITE ──
  // ── V136: MODELLVERGLEICHS-SEITE ────────────────────────────────
  function _renderModelle(doc, res, branding) {
    var p = res.portfolio;
    if (!p || !p.zukaufPlan || !p.zukaufPlan.modelle || !p.zukaufPlan.ziel_objekte_pa) return;
    var zp = p.zukaufPlan;
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'Modellrechnung — wie finanzierst du den Zukauf?', y);

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    var headerLine = 'Drei Finanzierungs-Modelle fuer typischen Zukauf bei ' + _fE(zp.kp_avg) + ' Kaufpreis. Goldenes Modell passt zum Ziel "' + ((p.ziel || {}).label || '') + '".';
    y = _wrappedText(doc, headerLine, M, y, W - 2*M, 4) + 6;

    // 3 Modell-Karten
    var nM = zp.modelle.length;
    var spacing = 4;
    var mW = (W - 2*M - (nM - 1) * spacing) / nM;
    var mH = 90;
    zp.modelle.forEach(function(m, i) {
      var x = M + i * (mW + spacing);
      var aktiv = m.empfohlen_fuer_aktives_ziel;
      if (aktiv) {
        doc.setFillColor(248, 244, 230);
        doc.setDrawColor.apply(doc, GOLD);
        doc.setLineWidth(0.7);
      } else {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor.apply(doc, BORDER);
        doc.setLineWidth(0.2);
      }
      doc.roundedRect(x, y, mW, mH, 2, 2, 'FD');
      if (aktiv) {
        doc.setFontSize(7);
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, '\u25BC FUER DEIN ZIEL', x + mW / 2, y - 1.5, { align: 'center' });
      }
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _wrappedText(doc, m.label, x + 5, y + 7, mW - 10, 4);
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'normal');
      _wrappedText(doc, m.kurz, x + 5, y + 17, mW - 10, 3.5);

      // Tabelle der Werte
      var ly = y + 32;
      function _row(label, val) {
        doc.setFontSize(8);
        doc.setTextColor.apply(doc, CH);
        doc.setFont('helvetica', 'normal');
        _safeText(doc, label, x + 5, ly);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, val, x + mW - 5, ly, { align: 'right' });
        ly += 4.5;
      }
      _row('EK-Einsatz', _fE(m.ek_eur));
      _row('Darlehen', _fE(m.darlehen));
      _row('Zins / Bindung', (m.zinssatz * 100).toFixed(2).replace('.', ',') + ' % / ' + m.zinsbindung_jahre + ' J.');
      _row('Annuitaet/J', _fE(m.annuitaet_y));
      _row('Restschuld 10 J.', _fE(m.restschuld_10j));

      // Beschreibung
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'italic');
      _wrappedText(doc, m.beschreibung, x + 5, ly + 2, mW - 10, 3);
    });
    y += mH + 10;

    // 5-Jahres-Prognose
    var p5 = zp.prognose5j;
    var prognoseH = 50;
    doc.setFillColor.apply(doc, CH);
    doc.roundedRect(M, y, W - 2*M, prognoseH, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'DEIN PORTFOLIO IN 5 JAHREN (wenn der Plan durchlaeuft)', M + 6, y + 8);

    var ce = [
      { label: 'OBJEKTE GESAMT', val: String(p5.bestand_neu_count), meta: 'heute ' + (p.count || 0) + ' + ' + p5.neue_objekte + ' neu' },
      { label: 'WOHNEINHEITEN', val: String(p5.bestand_neu_einheiten), meta: '+' + p5.neue_einheiten + ' neu' },
      { label: 'INVESTITIONS-VOLUMEN', val: _fE(p5.gesamt_kp_zukauf), meta: 'Kaufpreis-Summe' },
      { label: 'EK-EINSATZ', val: _fE(p5.gesamt_ek_einsatz_solid), meta: 'solides Modell' },
      { label: 'NEUE MIETEN/J', val: _fE(p5.neue_mieten_y), meta: 'Schaetzung Faktor 22' },
      { label: 'NEUE ANNUITAET/J', val: _fE(p5.gesamt_neue_annuitaet), meta: 'Bestand-Modell' }
    ];
    var cellW = (W - 2*M - 12) / 3;
    var cellH = 16;
    ce.forEach(function(c, i) {
      var col = i % 3;
      var row = Math.floor(i / 3);
      var cx = M + 6 + col * cellW;
      var cy = y + 13 + row * cellH;
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, c.label, cx, cy + 3);
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      _safeText(doc, c.val, cx, cy + 9);
      doc.setFontSize(7);
      doc.setTextColor(180, 175, 170);
      doc.setFont('helvetica', 'normal');
      _safeText(doc, c.meta, cx, cy + 13);
    });
  }

  // ── V136: STEUERHEBEL-SEITE ─────────────────────────────────────
  function _renderSteuerhebel(doc, res, branding) {
    var p = res.portfolio;
    if (!p || !p.zukaufPlan || !p.zukaufPlan.steuerhebel || !p.zukaufPlan.ziel_objekte_pa) return;
    var sh = p.zukaufPlan.steuerhebel;
    var zp = p.zukaufPlan;
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'Steuer-Hebel — was die Zukaeufe an Steuern sparen', y);

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    y = _wrappedText(doc, 'Pro Zukauf reduziert die AfA das zu versteuernde Einkommen. Bei deinem Grenzsteuersatz ' + Math.round(sh.grenzsteuersatz * 100) + ' % wird das zu konkretem Cash.', M, y, W - 2*M, 4) + 6;

    // 2 Spalten: Standard vs. RND
    var col2W = (W - 2*M - 6) / 2;
    var col2H = 50;

    // Standard-Spalte
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor.apply(doc, BORDER);
    doc.roundedRect(M, y, col2W, col2H, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'STANDARD-AfA (2 %)', M + 5, y + 6);
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, '§7 Abs. 4 EStG. Geb.-Anteil 75 % vom KP.', M + 5, y + 12);
    var ly = y + 19;
    function _stdRow(label, val) {
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      _safeText(doc, label, M + 5, ly);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, val, M + col2W - 5, ly, { align: 'right' });
      ly += 5;
    }
    _stdRow('AfA pro Objekt/J', _fE(sh.afa_pa_pro_obj));
    _stdRow('Steuer-Ersparnis pro Objekt/J', _fE(sh.steuer_ersparnis_pa_pro_obj));
    ly += 1;
    _stdRow('Ueber 5 J. mit ' + zp.ziel_objekte_pa + '/J', _fE(sh.steuer_ersparnis_5j_solid));

    // RND-Spalte
    var col2X = M + col2W + 6;
    doc.setFillColor(248, 244, 230);
    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.5);
    doc.roundedRect(col2X, y, col2W, col2H, 1.5, 1.5, 'FD');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'MIT RND-GUTACHTEN (~3,5 %)', col2X + 5, y + 6);
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, '§7 Abs. 4 Satz 2 EStG. Bei Bestand >40 J.', col2X + 5, y + 12);
    var rly = y + 19;
    function _rndRow(label, val) {
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      _safeText(doc, label, col2X + 5, rly);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, val, col2X + col2W - 5, rly, { align: 'right' });
      rly += 5;
    }
    _rndRow('AfA pro Objekt/J', _fE(sh.afa_pa_pro_obj_rnd));
    _rndRow('Steuer-Ersparnis pro Objekt/J', _fE(sh.steuer_ersparnis_pa_pro_obj_rnd));
    rly += 1;
    _rndRow('Ueber 5 J. mit ' + zp.ziel_objekte_pa + '/J', _fE(sh.steuer_ersparnis_5j_rnd));
    rly += 1;
    doc.setTextColor.apply(doc, GREEN);
    _rndRow('Mehrwert RND vs. Standard', '+' + _fE(sh.steuer_ersparnis_5j_rnd - sh.steuer_ersparnis_5j_solid));

    y += col2H + 8;

    // Weitere Hebel-Liste
    doc.setFillColor(248, 246, 241);
    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.4);
    var hebelH = 75;
    doc.roundedRect(M, y, W - 2*M, hebelH, 1.5, 1.5, 'FD');
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(M, y, 3, hebelH, 'F');

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'WEITERE HEBEL JE NACH OBJEKT', M + 8, y + 7);

    var hebel = [
      { p: '§35c EStG (Energetisch)', t: '20 % der Sanierungs-Kosten als Steuer-Ermaessigung ueber 3 J. 50k Sanierung -> 10k direkt von der Steuerschuld abziehbar.' },
      { p: '§82b EStDV (3-Jahres-Verteilung)', t: 'Erhaltungs-Aufwand >10k auf 2-5 J. verteilbar. Glaettet hohe Steuerspitzen.' },
      { p: '§6 Abs. 1 Nr. 1a EStG (15-%-Regel)', t: 'Sanierungen >15 % vom KP innerhalb 3 J. werden ZWANG in AfA-BMG eingerechnet — strategisch unter- oder ueberschreiten.' },
      { p: '§7h/§7i EStG (Sanierung/Denkmal)', t: '9 % AfA ueber 8 J. + 7 % ueber weitere 4 J. = 100 % der Kosten in 12 J. abgeschrieben.' },
      { p: '§23 EStG (Spekulationsfrist)', t: 'Verkauf nach 10 J. einkommen-steuerfrei.' },
      { p: '§6b EStG (Reinvestitions-Ruecklage)', t: 'Bei Verkauf -> Stille Reserve in neues Objekt uebertragen. 100 % Steuer-Stundung in der GmbH.' }
    ];
    var hy = y + 13;
    hebel.forEach(function(h) {
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, h.p + ':', M + 8, hy);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      var titleW = doc.getTextWidth(h.p + ': ');
      hy = _wrappedText(doc, h.t, M + 8 + titleW + 1, hy, W - 2*M - 16 - titleW - 1, 3.5) + 1;
    });

    y += hebelH + 4;

    // Disclaimer
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _wrappedText(doc, 'Modellrechnung. Bei Splitting-Tarif (Verheiratete) verschieben sich Grenzsteuersaetze. Bei zvE >278k schlaegt Reichensteuersatz 45 % an. Steuerberater-Letzt-Check zwingend.', M, y, W - 2*M, 4);
  }

  function _renderMarketDiagnosis(doc, res, branding) {
    var p = res.portfolio;
    if (!p) return;
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'Lage- & Markt-Diagnose', y);

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    y = _wrappedText(doc,
      'Aggregierte KPIs aus dem DealScore-Modul. Diese treiben die Strategie-Empfehlungen — Mietkonvergenz wird bei großer Mietlücke priorisiert, Diversifikation bei Klumpen-Risiko, Faktor-Arbitrage bei ungünstiger Faktor-Lage-Kombination.',
      M, y, W - 2*M, 4) + 6;

    // 6er-Grid mit KPI-Kacheln
    var cols = 3;
    var gap = 4;
    var tileW = (W - 2*M - (cols - 1) * gap) / cols;
    var tileH = 24;

    function _kpiTile(idx, label, value, unit, meta, color) {
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      var x = M + col * (tileW + gap);
      var ty = y + row * (tileH + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor.apply(doc, BORDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, ty, tileW, tileH, 1.5, 1.5, 'FD');
      // Linker Akzent-Streifen
      var accent = color === 'green' ? GREEN : color === 'red' ? RED : GOLD;
      doc.setFillColor.apply(doc, accent);
      doc.rect(x, ty, 1, tileH, 'F');
      // Label
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, label, x + 4, ty + 5);
      // Value
      doc.setFontSize(13);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, value, x + 4, ty + 13);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor.apply(doc, MUTED);
      _safeText(doc, unit || '', x + 4 + doc.getTextWidth(value), ty + 13);
      // Meta
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, MUTED);
      _safeText(doc, meta || '', x + 4, ty + 20);
    }

    var tiles = [];
    if (p.lageAvg != null) {
      tiles.push({
        label: 'Ø LAGE-SCORE',
        value: Math.round(p.lageAvg),
        unit: '/100',
        meta: p.topLageObjects && p.topLageObjects.length > 0 ? 'Top: ' + p.topLageObjects.slice(0, 2).map(function(o) { return o.kuerzel; }).join(', ') : '–',
        color: p.lageAvg >= 70 ? 'green' : p.lageAvg >= 50 ? 'gold' : 'red'
      });
    }
    if (p.upsideAvg != null) {
      tiles.push({
        label: 'Ø UPSIDE-POTENZIAL',
        value: Math.round(p.upsideAvg),
        unit: '/100',
        meta: 'Wachstum, Mietsteig., Faktor',
        color: p.upsideAvg >= 70 ? 'green' : p.upsideAvg >= 50 ? 'gold' : 'red'
      });
    }
    tiles.push({
      label: 'MIETLÜCKE GES.',
      value: _fE(p.mietluecke_total_y || 0).replace(' €', ''),
      unit: ' €/J',
      meta: ((p.mietluecke_objects || []).length) + ' Obj. mit Lücke >1k',
      color: (p.mietluecke_total_y || 0) > 5000 ? 'red' : (p.mietluecke_total_y || 0) > 1500 ? 'gold' : 'green'
    });
    tiles.push({
      label: 'KLUMPEN-RISIKO',
      value: String(p.klumpen_max || 1),
      unit: ' Obj.',
      meta: p.klumpen_orte && p.klumpen_orte[0] ? 'Max in: ' + p.klumpen_orte[0].ort : 'Gut gestreut',
      color: (p.klumpen_max || 0) >= 4 ? 'red' : (p.klumpen_max || 0) >= 3 ? 'gold' : 'green'
    });
    tiles.push({
      label: 'WACHSTUMS-HOTSPOTS',
      value: String((p.hotspot_objects || []).length),
      unit: ' Obj.',
      meta: 'Bevölk.+Nachfrage stark',
      color: (p.hotspot_objects || []).length > 0 ? 'green' : 'gold'
    });
    tiles.push({
      label: 'ENERGIE-RISIKO',
      value: String((p.energie_risiko_objects || []).length),
      unit: ' Obj.',
      meta: 'Klassen F/G/H',
      color: (p.energie_risiko_objects || []).length > 0 ? 'red' : 'green'
    });

    tiles.forEach(function(t, i) {
      _kpiTile(i, t.label, String(t.value), t.unit, t.meta, t.color);
    });
    var rows = Math.ceil(tiles.length / cols);
    y += rows * (tileH + gap) + 4;

    // Insights-Box
    var insights = [];
    if ((p.mietluecke_total_y || 0) > 5000) {
      insights.push('Größter Hebel: Mietkonvergenz. §558/§559 BGB-Anpassungen heben über 5 J. ~' + _fE(p.mietluecke_total_y * 0.6 * 5) + ' zusätzlichen Cashflow.');
    }
    if ((p.klumpen_max || 0) >= 3) {
      insights.push('Strukturelles Risiko: Klumpen. ' + p.klumpen_max + ' Objekte in ' + p.klumpen_orte[0].ort + ' — beim nächsten Zukauf andere Region wählen.');
    }
    if ((p.energie_risiko_objects || []).length > 0) {
      insights.push('Regulatorisches Risiko: GEG. ' + p.energie_risiko_objects.length + ' Objekt(e) Klasse F/G/H — Sanierung mit §35c+BEG-Förderung priorisieren.');
    }
    if ((p.ueberteuert_count || 0) > 0) {
      insights.push('Faktor-Arbitrage-Chance: ' + p.ueberteuert_count + ' Objekt(e) hoher Faktor in schwacher Lage — Verkauf nach §23-Frist erwägen.');
    }
    if (insights.length > 0) {
      var iH = 14 + insights.length * 8;
      doc.setFillColor(248, 244, 230);
      doc.setDrawColor.apply(doc, GOLD);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, W - 2*M, iH, 1.5, 1.5, 'FD');
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(M, y, 3, iH, 'F');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'WAS DIE KPIs SAGEN', M + 7, y + 7);
      var iY = y + 13;
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      insights.forEach(function(t) {
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, '·', M + 7, iY);
        doc.setTextColor.apply(doc, CH);
        doc.setFont('helvetica', 'normal');
        iY = _wrappedText(doc, t, M + 11, iY, W - 2*M - 15, 4) + 1;
      });
    }
  }

  // ── V133: TIER-SCHEMA-SEITE ─────────────────────────────────────
  // Rendert die GmbH-Tier-Tabelle als eigene Seite mit "DU BIST HIER"-Markierung.
  function _renderTierSchema(doc, res, branding) {
    var gmbhStrat = (res.strategien || []).filter(function(s) { return s.key === 'gmbh_aufbau'; })[0];
    if (!gmbhStrat || !gmbhStrat.gmbh_tier) return;
    var tiers = (window.PortfolioStrategy && window.PortfolioStrategy.GMBH_TIERS) || [];
    if (tiers.length === 0) return;
    var tierInfo = gmbhStrat.gmbh_tier;
    var aktKey = tierInfo.aktuell;

    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);

    var y = 24;
    y = _drawSectionHeading(doc, 'GmbH-Stufenmodell — wo stehst du, wo geht es hin?', y);

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    y = _wrappedText(doc,
      'Die Frage „lohnt sich eine VV-GmbH" hat keine pauschale Antwort. Das Stufenmodell ordnet fünf Bereiche basierend auf laufendem V+V-Überschuss pro Jahr — und liefert eine Empfehlung. Quellen: qonto.com, ride.capital, immoprentice.de, meine-renditeimmobilie.de (Recherche-Stand 02/2026).',
      M, y, W - 2*M, 4) + 4;

    // Aktuelle-Position-Box
    doc.setFillColor.apply(doc, CH);
    doc.roundedRect(M, y, W - 2*M, 24, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'DEINE AKTUELLE POSITION', M + 6, y + 7);
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    _safeText(doc, _fE(tierInfo.vuv_y) + ' V+V-Überschuss/Jahr', M + 6, y + 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 220, 215);
    _safeText(doc,
      'Grenzsteuersatz ' + Math.round(tierInfo.grenzsteuersatz * 100) + ' %  ·  Brutto-Vorteil GmbH ' + _fE(tierInfo.vorteil_brutto_y) + '/J  ·  Netto nach Strukturkosten ' + _fE(tierInfo.vorteil_netto_y) + '/J',
      M + 6, y + 20);
    y += 32;

    // Tier-Tabelle: 5 Karten in einer Reihe
    var nT = tiers.length;
    var spacing = 3;
    var tW = (W - 2*M - (nT - 1) * spacing) / nT;
    var tH = 70;
    tiers.forEach(function(t, i) {
      var x = M + i * (tW + spacing);
      var isActive = (t.key === aktKey);

      if (isActive) {
        doc.setFillColor(248, 244, 230);
        doc.setDrawColor.apply(doc, GOLD);
        doc.setLineWidth(0.8);
      } else {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor.apply(doc, BORDER);
        doc.setLineWidth(0.2);
      }
      doc.roundedRect(x, y, tW, tH, 2, 2, 'FD');

      if (isActive) {
        doc.setFontSize(7);
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, '▼ DU BIST HIER', x + tW / 2, y - 1.5, { align: 'center' });
      }

      var circleX = x + 5;
      var circleY = y + 6;
      if (isActive) doc.setFillColor.apply(doc, CH);
      else doc.setFillColor.apply(doc, GOLD);
      doc.circle(circleX, circleY, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, String(i), circleX, circleY + 1, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      var shortName = (t.name || '').replace(/Tier \d+ — /, '');
      _wrappedText(doc, shortName, x + 11, y + 7, tW - 14, 3.4);

      doc.setFontSize(8);
      doc.setTextColor.apply(doc, GOLD);
      _safeText(doc, t.vuv_label || '', x + 4, y + 22);

      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      var hY = _wrappedText(doc, t.headline || '', x + 4, y + 28, tW - 8, 3.2);

      doc.setFontSize(7);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'normal');
      _wrappedText(doc, t.kurz || '', x + 4, hY + 2, tW - 8, 3);
    });
    y += tH + 8;

    // Detail des aktuellen Tiers
    var aktTier = tiers.filter(function(t) { return t.key === aktKey; })[0];
    if (aktTier && y < H - 70) {
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(M, y, 1, 50, 'F');

      doc.setFontSize(11);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, aktTier.name + ' — was bedeutet das?', M + 5, y + 5);

      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      var detailY = _wrappedText(doc, aktTier.detail || aktTier.empfehlung || '', M + 5, y + 11, W - 2*M - 8, 4) + 3;

      if (aktTier.braucht && aktTier.braucht.length > 0 && detailY < H - 30) {
        doc.setFontSize(8.5);
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, 'Was du dafür brauchst:', M + 5, detailY);
        detailY += 5;
        doc.setTextColor.apply(doc, CH);
        doc.setFont('helvetica', 'normal');
        aktTier.braucht.forEach(function(b) {
          if (detailY < H - 20) {
            doc.setTextColor.apply(doc, GOLD);
            _safeText(doc, '→', M + 5, detailY);
            doc.setTextColor.apply(doc, CH);
            detailY = _wrappedText(doc, b, M + 10, detailY, W - 2*M - 13, 3.8) + 1;
          }
        });
      }
    }
  }

  // ── STRATEGIE-SEITE ─────────────────────────────────────────────
  // Eine Seite pro Strategie. Bei Überlauf zweite Seite.
  function _renderStrategy(doc, strat, profileKey, branding) {
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;

    // Header der Strategie
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'STRATEGIE', M, y);
    y += 6;
    doc.setFontSize(18);
    doc.setTextColor.apply(doc, CH);
    _safeText(doc, strat.name || '', M, y);
    y += 7;
    // Passt-zu-Badge
    var passt = (strat.passt_zu || []).indexOf(profileKey) >= 0;
    if (passt) {
      doc.setFillColor.apply(doc, GOLD);
      doc.roundedRect(M, y, 60, 5.5, 0.8, 0.8, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'PASST ZU DEINEM PROFIL', M + 30, y + 4, { align: 'center' });
      y += 9;
    } else {
      y += 2;
    }

    // Ziel + Ansatz
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Ziel', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = _wrappedText(doc, strat.ziel || '', M, y, W - 2*M, 4.6) + 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    _safeText(doc, 'Ansatz', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = _wrappedText(doc, strat.ansatz || '', M, y, W - 2*M, 4.6) + 4;

    // 5-Jahres-Effekt-Badge
    if (strat.impact_5j > 0) {
      doc.setFillColor(232, 245, 238);  // green-bg
      doc.setDrawColor.apply(doc, GREEN);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, 90, 8, 1, 1, 'FD');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, GREEN);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, '5-JAHRES-EFFEKT  ~' + _fE(strat.impact_5j), M + 4, y + 5.5);
      y += 12;
    }

    // Konkrete Schritte
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Konkrete Schritte', M, y);
    y += 6;
    if (strat.konkrete_schritte) {
      for (var i = 0; i < strat.konkrete_schritte.length; i++) {
        var k = strat.konkrete_schritte[i];
        // Seitenwechsel wenn knapp
        if (y > H - 50) {
          _drawPageFooter(doc, 0, 0);
          doc.addPage();
          _drawPageHeader(doc, 0, 0, branding);
          y = 24;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor.apply(doc, CH);
          _safeText(doc, strat.name + ' (Forts.)', M, y);
          y += 8;
        }
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, GOLD);
        doc.setFont('helvetica', 'bold');
        _safeText(doc, String(i + 1) + '.', M, y + 1);
        doc.setTextColor.apply(doc, CH);
        var titelTxt = k.titel + (k.zeitrahmen ? '  [' + k.zeitrahmen + ']' : '');
        _safeText(doc, titelTxt, M + 5, y + 1);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        y = _wrappedText(doc, k.detail || '', M + 5, y + 5, W - 2*M - 5, 3.8) + 2;
        if (k.impact) {
          doc.setFontSize(7.5);
          doc.setTextColor.apply(doc, GREEN);
          doc.setFont('helvetica', 'bold');
          _safeText(doc, '~' + _fE(k.impact) + ' Impact', M + 5, y);
          y += 4;
        }
        y += 1;
      }
    }

    // Pros / Cons (zweispaltig)
    if ((strat.pros && strat.pros.length) || (strat.cons && strat.cons.length)) {
      if (y > H - 60) {
        _drawPageFooter(doc, 0, 0);
        doc.addPage();
        _drawPageHeader(doc, 0, 0, branding);
        y = 24;
      }
      var col1X = M;
      var col2X = M + (W - 2*M) / 2 + 2;
      var colWi = (W - 2*M) / 2 - 2;
      var startY = y;
      // Pros
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, GREEN);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'VORTEILE', col1X, y);
      var yPros = y + 5;
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      (strat.pros || []).forEach(function(p) {
        doc.setTextColor.apply(doc, GREEN);
        _safeText(doc, '+', col1X, yPros);
        doc.setTextColor.apply(doc, CH);
        yPros = _wrappedText(doc, p, col1X + 4, yPros, colWi - 5, 3.8) + 1;
      });
      // Cons
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, RED);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'NACHTEILE', col2X, y);
      var yCons = y + 5;
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      (strat.cons || []).forEach(function(c) {
        doc.setTextColor.apply(doc, RED);
        _safeText(doc, '−', col2X, yCons);
        doc.setTextColor.apply(doc, CH);
        yCons = _wrappedText(doc, c, col2X + 4, yCons, colWi - 5, 3.8) + 1;
      });
      y = Math.max(yPros, yCons) + 2;
    }

    // Was musst du einbringen?
    if (strat.braucht && strat.braucht.length > 0) {
      if (y > H - 50) {
        _drawPageFooter(doc, 0, 0);
        doc.addPage();
        _drawPageHeader(doc, 0, 0, branding);
        y = 24;
      }
      doc.setFillColor.apply(doc, BG);
      var braucheH = 8 + strat.braucht.length * 5;
      doc.setDrawColor.apply(doc, GOLD);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, W - 2*M, braucheH, 1.5, 1.5, 'FD');
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'WAS DU DAFÜR EINBRINGEN MUSST', M + 4, y + 6);
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      var by = y + 12;
      strat.braucht.forEach(function(b) {
        _safeText(doc, '→', M + 4, by);
        by = _wrappedText(doc, b, M + 9, by, W - 2*M - 13, 3.8) + 1;
      });
      y = y + braucheH + 4;
    }

    // §-Referenzen
    if (strat.paragraphs && strat.paragraphs.length > 0
        && window.PortfolioStrategy && window.PortfolioStrategy.GLOSSARY) {
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'italic');
      var paraTitles = strat.paragraphs.map(function(pk) {
        var entry = window.PortfolioStrategy.GLOSSARY[pk];
        return entry ? entry.titel.split('—')[0].trim() : pk;
      }).join(' · ');
      _safeText(doc, 'Relevante §: ' + paraTitles, M, H - 14, { maxWidth: W - 2*M });
    }
  }

  function _renderPeers(doc, res, branding) {
    if (!res.peers || res.peers.length === 0) return;
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'So machen es andere Investoren', y);
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    y = _wrappedText(doc, 'Drei archetypische Investoren-Profile zur Inspiration für eine bewusste eigene Entscheidung.',
      M, y, W - 2*M, 4) + 4;

    res.peers.forEach(function(peer) {
      if (y > H - 60) {
        _drawPageFooter(doc, 0, 0);
        doc.addPage();
        _drawPageHeader(doc, 0, 0, branding);
        y = 24;
      }
      // Card
      var cardH = 0;
      var cardStart = y;
      doc.setFillColor.apply(doc, BG);
      doc.setDrawColor.apply(doc, BORDER);
      doc.setLineWidth(0.2);
      // Erst Inhalt rendern in Schattenkopie um Höhe zu bestimmen — aber zur Vereinfachung:
      // Vorab schätzen ~50mm pro Card
      cardH = 50;
      doc.roundedRect(M, cardStart, W - 2*M, cardH, 1.5, 1.5, 'FD');

      doc.setFontSize(11);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, peer.typ, M + 4, y + 7);
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'italic');
      var ny = _wrappedText(doc, peer.kontext || '', M + 4, y + 12, W - 2*M - 8, 3.8);

      doc.setFontSize(8);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'VORGEHEN', M + 4, ny + 2);
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      ny = _wrappedText(doc, peer.vorgehen || '', M + 4, ny + 6, W - 2*M - 8, 3.8) + 2;

      doc.setFontSize(8);
      doc.setTextColor.apply(doc, GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'ANDERS ALS DU', M + 4, ny + 2);
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      ny = _wrappedText(doc, peer.andersAlsDu || '', M + 4, ny + 6, W - 2*M - 8, 3.8) + 2;
      // Card-Höhe nachträglich anpassen, falls überlaufend nicht ideal — wir nehmen einfach max
      y = Math.max(y + cardH + 4, ny + 4);
    });
  }

  // ── DISCLAIMER ──────────────────────────────────────────────────
  function _renderDisclaimer(doc, branding) {
    doc.addPage();
    _drawPageHeader(doc, 0, 0, branding);
    var y = 24;
    y = _drawSectionHeading(doc, 'Wichtiger Hinweis', y);

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    var d1 = 'Diese Analyse ist eine Modellrechnung und keine Steuer- oder Rechtsberatung im Sinne des §6 StBerG / §3 RDG. Sämtliche Berechnungen basieren auf vereinfachten Annahmen und auf den Daten, die Sie im Modul hinterlegt haben.';
    y = _wrappedText(doc, d1, M, y, W - 2*M, 4.5) + 3;

    var d2 = 'Bei §-Verweisen handelt es sich um Hinweise auf bekannte legale Gestaltungs­möglichkeiten — die Anwendbarkeit hängt von Einzelfall­umständen ab, die ein Steuerberater prüfen muss. Vor jeder Strukturentscheidung (VV-GmbH-Einbringung, Holding-Aufbau, RND-Gutachten-Antrag, Sanierungs­gebiets-/Denkmal-AfA, §6b-Rücklage, Reinvestitions­modelle) ist der Steuerberater­-Letzt-Check zwingend.';
    y = _wrappedText(doc, d2, M, y, W - 2*M, 4.5) + 3;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Was nicht modelliert ist:', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    var d3 = '§6a UmwStG, §3 UmwStG, Sperrfristen §6 Abs. 5 EStG, konkrete Tilgungs­verläufe (Annuität), Sondertilgungen, Anschluss­finanzierung, Umsatzsteuer-Optionen (§9 UStG), gewerblicher Grundstücks­handel (3-Objekt-Grenze §15 EStG), Schenkungs-/Erbschafts­steuer-Folgen (§13a/§13b ErbStG).';
    y = _wrappedText(doc, d3, M, y, W - 2*M, 4.5) + 5;

    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _safeText(doc, 'Stand: ' + _now() + ' · DealPilot Portfolio-Strategie · Gesetzes­änderungen können Empfehlungen entkräften — bei Unsicherheit aktuelle Rechtslage prüfen.', M, y, { maxWidth: W - 2*M });
  }

  // ── MAIN EXPORT ─────────────────────────────────────────────────
  async function exportPortfolioStrategyPDF() {
    if (typeof window.jspdf === 'undefined') {
      if (typeof toast === 'function') toast('PDF-Bibliothek lädt noch…');
      return;
    }
    if (!window.PortfolioStrategy || !window.PortfolioStrategy.getState) {
      if (typeof toast === 'function') toast('Portfolio-Strategie-Modul nicht aktiv');
      return;
    }
    var st = window.PortfolioStrategy.getState();
    var res = st.results;
    if (!res) {
      // Versuche zu rechnen
      if (typeof toast === 'function') toast('Berechne Strategie…');
      try { res = await window.PortfolioStrategy.loadAndAnalyze(); }
      catch (e) {
        if (typeof toast === 'function') toast('Berechnung fehlgeschlagen');
        return;
      }
    }
    if (!res || !res.portfolio || res.portfolio.count === 0) {
      if (typeof toast === 'function') toast('Keine Objekte im Portfolio');
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var branding = _branding();

    // 1. Cover
    _renderCover(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    // 2. Narrative
    _renderNarrative(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    // 3. V135: Zukauf-Plan
    _renderZukaufPlan(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    // V136: Modellvergleich + 5J-Prognose
    _renderModelle(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    // V136: Steuerhebel
    _renderSteuerhebel(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    _renderMarketDiagnosis(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    _renderTierSchema(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    // 6. Strategien (eine Seite pro Strategie)
    var profileKey = (res.profile && res.profile.key) || 'cashflow';
    if (res.strategien) {
      res.strategien.forEach(function(s) {
        _renderStrategy(doc, s, profileKey, branding);
        _drawPageFooter(doc, 0, 0);
      });
    }

    // 6. Peer-Vergleich
    _renderPeers(doc, res, branding);
    _drawPageFooter(doc, 0, 0);

    // 5. Disclaimer
    _renderDisclaimer(doc, branding);
    _drawPageFooter(doc, 0, 0);

    // Seitenzahlen nachträglich setzen
    var totalPages = doc.internal.getNumberOfPages();
    for (var pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'italic');
      // Footer rechts: "Seite X / Y"
      // Wir haben in _drawPageFooter schon einen Dummy gerendert — überschreiben rechte Seite mit korrekter Zahl
      doc.setFillColor(255, 255, 255);
      doc.rect(W - M - 20, H - 11, 20, 5, 'F');  // Weißer Wisch über alten Text
      _safeText(doc, 'Seite ' + pg + ' / ' + totalPages, W - M, H - 8, { align: 'right' });
    }

    // Save
    var co = (branding.company || 'DealPilot').replace(/[^a-zA-Z0-9]/g, '_');
    var name = co + '_Portfolio_Strategie_' + _now().replace(/\./g, '-') + '.pdf';
    doc.save(name);
    if (typeof toast === 'function') toast('✓ Strategie-PDF erstellt');
  }

  window.exportPortfolioStrategyPDF = exportPortfolioStrategyPDF;

})();
