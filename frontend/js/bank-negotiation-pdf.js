'use strict';
/* ═══════════════════════════════════════════════════════════════════
   DEALPILOT – bank-negotiation-pdf.js                       (V132)

   Bank-Verhandlungs-PDF: Pro Objekt mit Beleihungs-Reserve
   ein One-Pager im Geschäftsbrief-Stil.

   Inhalt pro Seite:
     – Header: Eigentümer + Objekt-Adresse
     – Objekt-Steckbrief (Bj, Wfl, Verkehrswert, KP, Bestand-Halten)
     – Aktuelle Finanzierung (Restschuld, Zinssatz, Restlaufzeit)
     – Beleihungs-Bewertung (90% von Verkehrswert × 80% Bank-Limit)
     – Verfügbare Reserve (= Aufstockungs-Vorschlag)
     – Mietsteigerungs-Argument (wenn Mietlücke erkannt)
     – Werterhalt-/Wertsteigerungs-Argumente
     – Verwendungs­zweck (Klartext)
     – Footer-Disclaimer

   Aufruf:
     window.exportBankNegotiationPDF()
═══════════════════════════════════════════════════════════════════ */

(function() {

  var GOLD  = [201, 168, 76];
  var CH    = [42, 39, 39];
  var MUTED = [122, 115, 112];
  var GREEN = [42, 154, 90];
  var RED   = [201, 76, 76];
  var BG    = [248, 246, 241];
  var BORDER= [220, 215, 200];

  var W = 210, H = 297, M = 16;

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
    var safe = String(text || '')
      .replace(/­/g, '')
      .replace(/\u00A0/g, ' ');
    doc.text(safe, x, y, opts);
  }

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

  // ── HEADER (Briefkopf-Stil) ─────────────────────────────────────
  function _drawLetterHead(doc, branding, row) {
    // Goldener Akzent-Streifen
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(0, 0, W, 4, 'F');

    // Eigentümer-Block (oben rechts, wie Geschäftsbrief)
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, branding.company || 'Junker Immobilien', W - M, 14, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, MUTED);
    if (branding.contact) {
      _safeText(doc, branding.contact, W - M, 18, { align: 'right' });
    }
    if (branding.email) {
      _safeText(doc, branding.email, W - M, 22, { align: 'right' });
    }

    // Datum
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    _safeText(doc, _now(), W - M, 30, { align: 'right' });

    // Title-Block
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'BANK-VERHANDLUNGS-PROFIL', M, 40);

    doc.setFontSize(16);
    doc.setTextColor.apply(doc, CH);
    _safeText(doc, row.adresse || row.kuerzel || 'Objekt', M, 48);

    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.4);
    doc.line(M, 51, M + 32, 51);
  }

  // ── KEY-VALUE-Tabelle (zwei Spalten je Block) ──────────────────
  function _kvTable(doc, x, y, w, rows) {
    // Hintergrund
    var rowH = 6;
    var totalH = rows.length * rowH + 4;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor.apply(doc, BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, totalH, 1.5, 1.5, 'FD');
    var yi = y + 5;
    rows.forEach(function(r) {
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'normal');
      _safeText(doc, r[0], x + 3, yi);
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, r[1] || '–', x + w - 3, yi, { align: 'right' });
      yi += rowH;
    });
    return y + totalH;
  }

  // ── ARGUMENTE-BOX ──────────────────────────────────────────────
  function _argumentBox(doc, x, y, w, title, items, color) {
    var lineCount = 0;
    items.forEach(function(t) {
      var lines = doc.splitTextToSize(t.replace(/­/g, ''), w - 14);
      lineCount += lines.length;
    });
    var boxH = 12 + lineCount * 4 + items.length * 1.5;

    doc.setFillColor.apply(doc, BG);
    doc.setDrawColor.apply(doc, color || GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, boxH, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setTextColor.apply(doc, color || GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, title, x + 4, y + 6);

    var yi = y + 12;
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'normal');
    items.forEach(function(t) {
      doc.setTextColor.apply(doc, color || GOLD);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, '·', x + 4, yi);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      yi = _wrappedText(doc, t, x + 8, yi, w - 12, 4) + 1.5;
    });
    return y + boxH + 4;
  }

  // ── PAGE PER OBJECT ────────────────────────────────────────────
  function _renderObjectPage(doc, row, branding) {
    _drawLetterHead(doc, branding, row);

    var y = 60;

    // ─── 1. Objekt-Steckbrief ────────────────────────────────────
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, '1. Objekt-Steckbrief', M, y);
    y += 5;

    var halteJahre = row.halte_dauer || 0;
    y = _kvTable(doc, M, y, W - 2*M, [
      ['Adresse', row.adresse || row.kuerzel || '–'],
      ['Baujahr / Wohnfläche', (row.baujahr ? row.baujahr : '–') + (row.wfl ? '   ·   ' + row.wfl + ' m²' : '')],
      ['Kaufpreis (damals)', _fE(row.kp)],
      ['Halte­dauer', halteJahre + ' Jahr(e)'],
      ['Bestands­miete (kalt p.a.)', _fE(row.nkm_y)],
      ['Aktueller Verkehrs­wert', _fE(row.verkehrswert)]
    ]) + 6;

    // ─── 2. Aktuelle Finanzierung ────────────────────────────────
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, '2. Aktuelle Finanzierung', M, y);
    y += 5;

    var r = row._raw || {};
    y = _kvTable(doc, M, y, W - 2*M, [
      ['Restschuld', _fE(row.d_total)],
      ['Zinssatz', (r.d1z || r.zins || '–') + ' %'],
      ['Tilgung', (r.d1t || r.tilgung || '–') + ' %'],
      ['Annuität (Zins + Tilgung) p.a.', _fE(row.zins_y + row.tilg_y)],
      ['LTV (Verkehrswert-Basis)', Math.round((row.ltv_aktuell || row.ltv) * 100) + ' %']
    ]) + 6;

    // ─── 3. Beleihungs-Bewertung ─────────────────────────────────
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, '3. Beleihungs-Bewertung & Reserve', M, y);
    y += 5;

    var beleihungswert = row.verkehrswert * 0.90;
    var bankMax = beleihungswert * 0.80;
    y = _kvTable(doc, M, y, W - 2*M, [
      ['Verkehrswert', _fE(row.verkehrswert)],
      ['Beleihungs­wert (90 % vom VW)', _fE(beleihungswert)],
      ['Bank-Beleihungs­limit (80 %)', _fE(bankMax)],
      ['Restschuld aktuell', _fE(row.d_total)],
      ['Verfügbare Reserve', _fE(row.beleihungs_reserve)]
    ]) + 6;

    // Highlight-Box für Aufstockungs-Vorschlag
    if (row.beleihungs_reserve > 30000) {
      doc.setFillColor(232, 245, 238);
      doc.setDrawColor.apply(doc, GREEN);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, y, W - 2*M, 14, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, GREEN);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, 'AUFSTOCKUNGS-VORSCHLAG', M + 4, y + 6);
      doc.setFontSize(13);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, _fE(row.beleihungs_reserve) + ' zusätzliche Grundschuld', M + 4, y + 12);
      y += 18;
    }

    // ─── 4. Argumente: Werterhalt / Mietpotenzial ───────────────
    var werterhalt = [];
    if (row.miete_luecke_y > 1000) {
      werterhalt.push('Mietsteigerungs­potenzial: Ist-Miete ' +
        (row.ist_miete_qm ? row.ist_miete_qm.toFixed(2).replace('.', ',') + ' €/m²' : '–') +
        ' vs. Marktmiete ' + (row.marktmiete_qm ? row.marktmiete_qm.toFixed(2).replace('.', ',') + ' €/m²' : '–') +
        ' (Lücke ~' + _fE(row.miete_luecke_y) + '/Jahr). Bei §558 BGB-konformer Anpassung steigt der Verkehrs­wert proportional zur höheren NKM.');
    }
    if (row.mikrolage === 'gut' || row.mikrolage === 'sehr_gut') {
      werterhalt.push('Mikrolage: "' + row.mikrolage.replace('_', ' ') + '" — wertsichernd, gute Nachvermietbarkeit.');
    }
    if (row.bevoelkerung === 'wachsend' || row.bevoelkerung === 'stark_wachsend') {
      werterhalt.push('Bevölkerungs­entwicklung: ' + row.bevoelkerung.replace('_', ' ') + ' — strukturell positive Nachfrage.');
    }
    if (row.wertsteigerung === 'hoch' || row.wertsteigerung === 'sehr_hoch') {
      werterhalt.push('Wertsteigerungs­erwartung: ' + row.wertsteigerung.replace('_', ' ') + '.');
    }
    if (halteJahre >= 5) {
      werterhalt.push('Eigentümer hält das Objekt seit ' + halteJahre + ' Jahren — laufende Tilgung reduziert das LTV jährlich.');
    }
    if (werterhalt.length > 0) {
      y = _argumentBox(doc, M, y, W - 2*M, 'WERTERHALT & WACHSTUMS-ARGUMENTE', werterhalt, GREEN);
    }

    // ─── 5. Verwendungszweck (für Investitions­kreditrahmen) ────
    if (row.beleihungs_reserve > 30000 && y < H - 60) {
      var zweck = [];
      zweck.push('Erweiterung des Immobilien­bestandes durch Erwerb weiterer vermieteter Wohn­einheiten (Investitions­kreditrahmen).');
      zweck.push('Sanierungs- und Modernisierungs­maßnahmen am Objekt zur Werterhaltung und Mieterhöhung (§558 BGB).');
      zweck.push('Liquiditäts­reserve für Anschluss­finanzierungen / Sondertilgungen anderer Bestands­objekte.');
      y = _argumentBox(doc, M, y, W - 2*M, 'VERWENDUNGSZWECK', zweck, GOLD);
    }

    // ─── Footer ─────────────────────────────────────────────────
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _safeText(doc,
      'Modellrechnung · keine verbindliche Bewertung · Verkehrs­wert basiert auf Eigentümer-Eingaben · ' + _now(),
      M, H - 12, { maxWidth: W - 2*M });
  }

  // ── COVER (Portfolio-Übersicht) ────────────────────────────────
  function _renderCover(doc, candidates, branding) {
    // Goldener Strich
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(0, 0, W, 4, 'F');

    // Charcoal Hero
    doc.setFillColor.apply(doc, CH);
    doc.rect(0, 4, W, 80, 'F');

    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, (branding.company || 'DealPilot').toUpperCase(), M, 22);

    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.6);
    doc.line(M, 26, M + 36, 26);

    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Bank-Verhandlung', M, 46);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, GOLD);
    _safeText(doc, 'Beleihungs-Reserve im Bestand', M, 56);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    _safeText(doc, 'Stand: ' + _now(), M, 72);

    // Portfolio-Summe
    var y = 100;
    var totalReserve = candidates.reduce(function(s, r) { return s + (r.beleihungs_reserve || 0); }, 0);
    var totalVw = candidates.reduce(function(s, r) { return s + (r.verkehrswert || 0); }, 0);

    doc.setFillColor(232, 245, 238);
    doc.setDrawColor.apply(doc, GREEN);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - 2*M, 30, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, GREEN);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'GESAMT-BELEIHUNGS-RESERVE', M + 6, y + 8);
    doc.setFontSize(22);
    doc.setTextColor.apply(doc, CH);
    _safeText(doc, _fE(totalReserve), M + 6, y + 20);
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'normal');
    _safeText(doc, 'aus ' + candidates.length + ' Objekt(en) · Verkehrswert-Basis ' + _fE(totalVw),
      M + 6, y + 26);
    y += 38;

    // Kandidaten-Liste
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, CH);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'Verhandlungs-Kandidaten', M, y);
    y += 6;

    // Tabellenkopf
    doc.setFillColor.apply(doc, BG);
    doc.rect(M, y, W - 2*M, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, GOLD);
    doc.setFont('helvetica', 'bold');
    _safeText(doc, 'OBJEKT', M + 3, y + 5);
    _safeText(doc, 'VERKEHRSWERT', M + 70, y + 5, { align: 'right' });
    _safeText(doc, 'RESTSCHULD', M + 110, y + 5, { align: 'right' });
    _safeText(doc, 'LTV', M + 130, y + 5, { align: 'right' });
    _safeText(doc, 'RESERVE', W - M - 3, y + 5, { align: 'right' });
    y += 7;

    candidates.forEach(function(row) {
      doc.setDrawColor.apply(doc, BORDER);
      doc.setLineWidth(0.1);
      doc.line(M, y + 6, W - M, y + 6);
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, CH);
      doc.setFont('helvetica', 'normal');
      _safeText(doc, row.kuerzel || '–', M + 3, y + 4);
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, MUTED);
      _safeText(doc, (row.adresse || '').substring(0, 38), M + 3, y + 8);

      doc.setFontSize(9);
      doc.setTextColor.apply(doc, CH);
      _safeText(doc, _fE(row.verkehrswert), M + 70, y + 4, { align: 'right' });
      _safeText(doc, _fE(row.d_total), M + 110, y + 4, { align: 'right' });
      _safeText(doc, Math.round((row.ltv_aktuell || row.ltv) * 100) + ' %', M + 130, y + 4, { align: 'right' });
      doc.setTextColor.apply(doc, GREEN);
      doc.setFont('helvetica', 'bold');
      _safeText(doc, _fE(row.beleihungs_reserve), W - M - 3, y + 4, { align: 'right' });
      y += 10;
    });

    // Footer
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, MUTED);
    doc.setFont('helvetica', 'italic');
    _safeText(doc,
      'Beleihungs-Reserve = (Verkehrswert × 0,90) × 0,80 − Restschuld. Werte basieren auf Eigentümer-Eingaben. Endgültige Bewertung erfolgt durch die Bank.',
      M, H - 16, { maxWidth: W - 2*M });
    _safeText(doc, 'Modellrechnung · keine verbindliche Bewertung · ' + _now(),
      M, H - 8, { maxWidth: W - 2*M });
  }

  // ── MAIN EXPORT ─────────────────────────────────────────────────
  async function exportBankNegotiationPDF() {
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
      if (typeof toast === 'function') toast('Berechne Portfolio…');
      try { res = await window.PortfolioStrategy.loadAndAnalyze(); }
      catch (e) {
        if (typeof toast === 'function') toast('Berechnung fehlgeschlagen');
        return;
      }
    }
    if (!res || !res.rows || res.rows.length === 0) {
      if (typeof toast === 'function') toast('Keine Objekte im Portfolio');
      return;
    }

    // Kandidaten: Objekte mit Beleihungs-Reserve > 30k €
    var candidates = res.rows
      .filter(function(r) { return r.beleihungs_reserve > 30000; })
      .sort(function(a, b) { return b.beleihungs_reserve - a.beleihungs_reserve; });

    if (candidates.length === 0) {
      if (typeof toast === 'function') toast('Keine Objekte mit nennenswerter Beleihungs-Reserve gefunden');
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var branding = _branding();

    // Cover
    _renderCover(doc, candidates, branding);

    // Eine Seite pro Objekt
    candidates.forEach(function(row) {
      doc.addPage();
      _renderObjectPage(doc, row, branding);
    });

    // Seitenzahlen ergänzen (Cover ohne, Folgeseiten mit)
    var totalPages = doc.internal.getNumberOfPages();
    for (var pg = 2; pg <= totalPages; pg++) {
      doc.setPage(pg);
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, MUTED);
      doc.setFont('helvetica', 'italic');
      _safeText(doc, 'Seite ' + (pg - 1) + ' / ' + (totalPages - 1), W - M, H - 8, { align: 'right' });
    }

    // Save
    var co = (branding.company || 'DealPilot').replace(/[^a-zA-Z0-9]/g, '_');
    var name = co + '_Bank_Verhandlung_' + _now().replace(/\./g, '-') + '.pdf';
    doc.save(name);
    if (typeof toast === 'function') toast('✓ Bank-Verhandlungs-PDF erstellt');
  }

  window.exportBankNegotiationPDF = exportBankNegotiationPDF;

})();
