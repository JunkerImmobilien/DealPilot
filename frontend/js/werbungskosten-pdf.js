'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – werbungskosten-pdf.js
   Punkt 7: Aufschlüsselung der Werbungskosten als PDF
   für das Finanzamt
   - pro Jahr OR Gesamtübersicht über alle Jahre
   - Pro Position: Betrag, Jahr, Kategorie, Bemerkung
═══════════════════════════════════════════════════ */

async function exportWerbungskostenPDF(mode) {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  // mode: 'single-year' (aktuelles Jahr) oder 'all-years'
  if (typeof window.jspdf === 'undefined') {
    if (typeof toast === 'function') toast('PDF-Bibliothek lädt noch...');
    return;
  }
  if (!State.cfRows || !State.cfRows.length) {
    if (typeof toast === 'function') toast('Bitte erst Werte eingeben');
    return;
  }

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var M = 16;
  var CW = W - 2 * M;

  var startYear = new Date().getFullYear();
  var nYears = mode === 'all-years' ? Math.min(15, State.cfRows.length) : 1;

  for (var yi = 0; yi < nYears; yi++) {
    if (yi > 0) doc.addPage();
    _renderWerbungskostenPage(doc, startYear + yi, yi, W, H, M, CW);
  }

  // Wenn all-years: Add Summary page at end
  if (mode === 'all-years' && nYears > 1) {
    doc.addPage();
    _renderWerbungskostenSummaryPage(doc, startYear, nYears, W, H, M, CW);
  }

  var name = mode === 'all-years'
    ? 'Werbungskosten_Uebersicht_' + startYear + '-' + (startYear + nYears - 1)
    : 'Werbungskosten_' + startYear;
  doc.save(name + '.pdf');
  if (typeof toast === 'function') toast('✓ Werbungskosten-PDF erstellt');
}

function _renderWerbungskostenPage(doc, year, yearIdx, W, H, M, CW) {
  // ── HEADER ─────────────────────────────────────
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor(201, 168, 76);
  doc.rect(0, 26, W, 1, 'F');

  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('AUFSTELLUNG WERBUNGSKOSTEN', M, 13);

  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Vermietung & Verpachtung · Anlage V · § 21 EStG', M, 19);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Veranlagungsjahr ' + year, W - M, 13, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE'), W - M, 19, { align: 'right' });

  var cy = 36;

  // ── OBJEKT-ANGABEN ─────────────────────────────
  var name = (typeof getCurrentObjectName === 'function' ? getCurrentObjectName() : '') ||
             (document.getElementById('hdr-obj') ? document.getElementById('hdr-obj').textContent : 'Objekt');
  var addr = (g('str') || '') + ' ' + (g('hnr') || '') + ', ' + (g('plz') || '') + ' ' + (g('ort') || '');
  var qm = g('wfl');
  var bezeichnung = g('objart') || 'ETW';

  doc.setFillColor(248, 246, 240);
  doc.roundedRect(M, cy, CW, 22, 2, 2, 'F');
  doc.setFillColor(201, 168, 76);
  doc.rect(M, cy, 2, 22, 'F');

  doc.setTextColor(122, 115, 112);
  doc.setFontSize(7.5);
  doc.text('OBJEKT', M + 5, cy + 5);
  doc.setTextColor(42, 39, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(name, M + 5, cy + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(addr, M + 5, cy + 16);
  doc.setFontSize(8);
  doc.setTextColor(122, 115, 112);
  doc.text(bezeichnung + ' · ' + qm + ' m²', M + 5, cy + 20);

  cy += 28;

  // ── WERBUNGSKOSTEN-TABELLE ────────────────────
  // Compute totals for this year using yearly tax form data
  var totals = (typeof _computeYearTotal === 'function') ? _computeYearTotal(year, yearIdx) : null;
  if (!totals) return;
  var v = totals.values;
  var bem = (window._taxYearlyBemerkungen && window._taxYearlyBemerkungen['y' + year]) || {};

  // Section 1: Finanzierungskosten
  cy = _renderWkSection(doc, cy, M, CW, '1. Finanzierungskosten', [
    ['Schuldzinsen', v.schuldzinsen, bem.schuldzinsen],
    ['Kontoführungsgebühren', v.kontofuehrung, bem.kontofuehrung],
    ['Bereitstellungszinsen', v.bereitstellung, bem.bereitstellung],
    ['Notar/Grundschuld (anteilig)', v.notar_grundschuld, bem.notar_grundschuld],
    ['Vermittlungsprovision Darlehen', v.vermittlung, bem.vermittlung],
    ['Sonstiges', v.finanz_sonst, bem.finanz_sonst]
  ]);

  // Section 2: Betriebskosten
  cy = _renderWkSection(doc, cy, M, CW, '2. Betriebskosten', [
    ['Nicht-umlagefähige Nebenkosten', v.nk_n_umlf, bem.nk_n_umlf],
    ['Sonstige Betriebskosten', v.betr_sonst, bem.betr_sonst]
  ]);

  // Section 3: Verwaltungskosten
  cy = _renderWkSection(doc, cy, M, CW, '3. Verwaltungskosten', [
    ['Hausverwaltung / Mietsonderverwaltung', v.hausverwaltung, bem.hausverwaltung],
    ['Steuerberatung', v.steuerber, bem.steuerber],
    ['Porto, Büromaterial', v.porto, bem.porto],
    ['Sonstiges', v.verw_sonst, bem.verw_sonst]
  ]);

  // Section 4: Sonstige Kosten
  cy = _renderWkSection(doc, cy, M, CW, '4. Sonstige Kosten', [
    ['Fahrtkosten zur Immobilie', v.fahrtkosten, bem.fahrtkosten],
    ['Verpflegungsmehraufwand', v.verpflegung, bem.verpflegung],
    ['Übernachtungskosten', v.hotel, bem.hotel],
    ['Inseratskosten', v.inserat, bem.inserat],
    ['Gerichts-/Anwaltskosten', v.gericht, bem.gericht],
    ['Telefon/Internet', v.telefon, bem.telefon],
    ['Sonstiges (Leerstand, etc.)', v.sonst_kosten, bem.sonst_kosten]
  ]);

  // Section 5: AfA
  cy = _renderWkSection(doc, cy, M, CW, '5. Absetzungen für Abnutzung (AfA)', [
    ['AfA Gebäude (linear)', v.afa, bem.afa],
    ['AfA bewegliche Wirtschaftsgüter', v.sonst_bewegl_wg, bem.sonst_bewegl_wg]
  ]);

  // Page break check
  if (cy > 230) { doc.addPage(); cy = 20; }

  // Section 6: Anschaffungsnah / Erhaltungsaufwand
  cy = _renderWkSection(doc, cy, M, CW, '6. Anschaffungsnahe Herstellkosten / Erhaltungsaufwand', [
    ['Anschaffungsnah (§6 Abs.1 Nr.1a EStG)', v.anschaffungsnah || 0, bem.anschaffungsnah],
    ['Erhaltungsaufwand (nach 3 Jahren)', v.erhaltungsaufwand || 0, bem.erhaltungsaufwand]
  ]);

  // ── SUMMARY ────────────────────────────────────
  if (cy > 245) { doc.addPage(); cy = 20; }

  doc.setFillColor(42, 39, 39);
  doc.roundedRect(M, cy, CW, 26, 2, 2, 'F');
  doc.setFillColor(201, 168, 76);
  doc.rect(M, cy, 2, 26, 'F');

  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SUMME WERBUNGSKOSTEN ' + year, M + 6, cy + 8);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(Math.round(totals.werbungskosten).toLocaleString('de-DE') + ' €', W - M - 6, cy + 14, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  doc.text('Einnahmen V+V: ' + Math.round(totals.einnahmen).toLocaleString('de-DE') + ' €', M + 6, cy + 20);
  var ergebnisColor = totals.ergebnis >= 0 ? 'Überschuss' : 'Verlust';
  doc.text(ergebnisColor + ': ' + (totals.ergebnis >= 0 ? '+' : '') +
    Math.round(totals.ergebnis).toLocaleString('de-DE') + ' €', M + 6, cy + 24);

  // ── FOOTER ─────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'DealPilot'),
    W / 2, H - 8, { align: 'center' });
  doc.text('Diese Aufstellung dient der Vorbereitung der Anlage V zur Einkommensteuererklärung. Keine Steuerberatung.',
    W / 2, H - 4, { align: 'center' });
}

function _renderWkSection(doc, cy, M, CW, title, items) {
  // Page break check
  if (cy > 250) { doc.addPage(); cy = 20; }

  // Section header bar
  doc.setFillColor(42, 39, 39);
  doc.rect(M, cy, CW, 6, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), M + 3, cy + 4.2);

  cy += 6;

  // Items
  var sectionTotal = 0;
  items.forEach(function(item, i) {
    var label = item[0], val = item[1] || 0, note = item[2] || '';
    sectionTotal += val;

    var rowH = note ? 11 : 7;
    if (cy + rowH > 280) { doc.addPage(); cy = 20; }

    doc.setFillColor(i % 2 === 0 ? 252 : 248, i % 2 === 0 ? 250 : 246, i % 2 === 0 ? 244 : 238);
    doc.rect(M, cy, CW, rowH, 'F');

    doc.setTextColor(60, 55, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(label, M + 3, cy + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(42, 39, 39);
    doc.text(Math.round(val).toLocaleString('de-DE') + ' €', M + CW - 3, cy + 4.5, { align: 'right' });

    if (note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 110, 100);
      var maxNoteW = CW - 6;
      var noteLines = doc.splitTextToSize('Bemerkung: ' + note, maxNoteW);
      doc.text(noteLines[0], M + 3, cy + 9);
    }

    cy += rowH;
  });

  // Section subtotal
  doc.setFillColor(245, 241, 230);
  doc.rect(M, cy, CW, 6, 'F');
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.4);
  doc.line(M, cy, M + CW, cy);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(122, 100, 30);
  doc.text('Zwischensumme', M + 3, cy + 4.2);
  doc.text(Math.round(sectionTotal).toLocaleString('de-DE') + ' €', M + CW - 3, cy + 4.2, { align: 'right' });

  cy += 8;
  return cy;
}

function _renderWerbungskostenSummaryPage(doc, startYear, nYears, W, H, M, CW) {
  // Header
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor(201, 168, 76);
  doc.rect(0, 26, W, 1, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GESAMTÜBERSICHT WERBUNGSKOSTEN', M, 13);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(startYear + ' bis ' + (startYear + nYears - 1) + ' · Alle Jahre auf einen Blick', M, 19);

  var cy = 36;

  // Build year-by-year matrix
  var rows = [];
  var sumRow = ['SUMME', 0, 0, 0, 0, 0];
  for (var i = 0; i < nYears; i++) {
    var year = startYear + i;
    var totals = _computeYearTotal(year, i);
    var v = totals.values;
    var fkz = v.schuldzinsen + v.kontofuehrung + v.bereitstellung + v.notar_grundschuld + v.vermittlung + v.finanz_sonst;
    var btr = v.nk_n_umlf + v.betr_sonst;
    var vrw = v.hausverwaltung + v.steuerber + v.porto + v.verw_sonst;
    var sst = v.fahrtkosten + v.verpflegung + v.hotel + v.inserat + v.gericht + v.telefon + v.sonst_kosten;
    var afa_total = v.afa + v.sonst_bewegl_wg + (v.anschaffungsnah || 0) + (v.erhaltungsaufwand || 0);

    rows.push([
      year,
      Math.round(fkz).toLocaleString('de-DE'),
      Math.round(btr).toLocaleString('de-DE'),
      Math.round(vrw).toLocaleString('de-DE'),
      Math.round(sst).toLocaleString('de-DE'),
      Math.round(afa_total).toLocaleString('de-DE'),
      Math.round(totals.werbungskosten).toLocaleString('de-DE'),
      Math.round(totals.einnahmen).toLocaleString('de-DE'),
      (totals.ergebnis >= 0 ? '+' : '') + Math.round(totals.ergebnis).toLocaleString('de-DE')
    ]);

    sumRow[1] = (parseFloat((sumRow[1] + '').replace(/\./g, '')) + fkz);
    sumRow[2] = (parseFloat((sumRow[2] + '').replace(/\./g, '')) + btr);
    sumRow[3] = (parseFloat((sumRow[3] + '').replace(/\./g, '')) + vrw);
    sumRow[4] = (parseFloat((sumRow[4] + '').replace(/\./g, '')) + sst);
    sumRow[5] = (parseFloat((sumRow[5] + '').replace(/\./g, '')) + afa_total);
  }

  doc.autoTable({
    startY: cy,
    head: [['Jahr', '1. Finanz.', '2. Betr.', '3. Verw.', '4. Sonst.', '5./6. AfA', 'Summe WK', 'Einnahmen', '= Ergebnis']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    margin: { left: M, right: M },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right' },
      8: { halign: 'right', fontStyle: 'bold' }
    }
  });

  // Footer
  var pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'DealPilot'),
    W / 2, pageH - 8, { align: 'center' });
}

// Helper g() if not already global
if (typeof g === 'undefined') {
  window.g = function(id) {
    var e = document.getElementById(id);
    return e ? (e.value || '') : '';
  };
}
