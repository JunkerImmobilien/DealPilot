'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – track-record.js V12
   Generates professional 1-page Track Record PDFs per object
   (Bank-/Investor-tauglich)
═══════════════════════════════════════════════════ */

async function exportTrackRecordPDF(objects) {
  // V63.82: Plan-Gate — Track-Record-PDF ist Investor+ (Free hat es mit Wasserzeichen, Starter gar nicht)
  if (typeof Plan !== 'undefined') {
    var k = Plan.key();
    if (k === 'starter') {
      if (typeof toast === 'function') toast('🔒 Track-Record-PDF ist im Investor-Plan enthalten');
      if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 600);
      return;
    }
    // Free: erlaubt aber mit Wasserzeichen (Plan.limit('watermark'))
  }
  if (typeof window.jspdf === 'undefined') {
    if (typeof toast === 'function') toast('PDF-Bibliothek lädt noch...');
    return;
  }
  if (!objects || !objects.length) return;

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var GOLD = [201, 168, 76];
  var CH = [42, 39, 39];
  var MUTED = [122, 115, 112];
  var GREEN = [42, 154, 90];
  var RED = [201, 76, 76];

  // Render cover page first
  renderCoverPage(doc, objects, W, H, { GOLD: GOLD, CH: CH, MUTED: MUTED, GREEN: GREEN, RED: RED });

  // Render track record per object
  for (var idx = 0; idx < objects.length; idx++) {
    doc.addPage();
    await renderTrackRecordPage(doc, objects[idx], idx + 1, objects.length, W, H, { GOLD: GOLD, CH: CH, MUTED: MUTED, GREEN: GREEN, RED: RED });
  }

  // V24: Filename neutral, mit Branding-Company aus den Settings
  var _b = (typeof _getBranding === 'function') ? _getBranding() : { company: 'DealPilot' };
  var _co = (_b.company || 'DealPilot').replace(/[^a-zA-Z0-9]/g, '_');
  var name = objects.length === 1
    ? _co + '_TrackRecord_' + (objects[0].name || 'Objekt').replace(/[^a-zA-Z0-9]/g, '_')
    : _co + '_TrackRecord_Portfolio_' + objects.length + '_Objekte';
  doc.save(name + '.pdf');
  if (typeof toast === 'function') toast('✓ Track Record PDF erstellt');
}


function renderCoverPage(doc, objects, W, H, C) {
  var M = 14;
  var CW = W - 2 * M;

  // Full-page charcoal background top half
  doc.setFillColor.apply(doc, C.CH);
  doc.rect(0, 0, W, H * 0.55, 'F');

  // Diagonal gold accent
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(0, H * 0.55 - 2, W, 2, 'F');

  // V24: DealPilot-Logo statt JUNKER-Hardcoding
  var _coverLogo = (typeof _getBrandingLogo === 'function') ? _getBrandingLogo() : null;
  if (_coverLogo) {
    var _sz = (typeof _getLogoSize === 'function') ? _getLogoSize(_coverLogo, 50, 22) : { w: 40, h: 16 };
    try { doc.addImage(_coverLogo, 'PNG', M, 12, _sz.w, _sz.h); } catch(e) {}
  } else {
    // Fallback: Branding-Name aus den Settings (kein Junker-Hardcoding)
    var _b = (typeof _getBranding === 'function') ? _getBranding() : { company: 'DealPilot' };
    doc.setTextColor.apply(doc, C.GOLD);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((_b.company || 'DealPilot').toUpperCase(), M, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('Investment Documentation', M, 28);
  }

  // Big TRACK RECORD title (centered vertically in top section)
  doc.setTextColor.apply(doc, C.GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(48);
  doc.text('TRACK', W / 2, 80, { align: 'center' });
  doc.text('RECORD', W / 2, 100, { align: 'center' });

  // Subtitle / Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(220, 220, 220);
  doc.text('Portfolio-Übersicht & Performance-Analyse', W / 2, 115, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(160, 150, 130);
  doc.setFont('helvetica', 'italic');
  doc.text('„Immobilienentscheidungen sind zu groß für ein Bauchgefühl."', W / 2, 125, { align: 'center' });

  // Bottom-half: Portfolio Summary
  var sy = H * 0.55 + 18;

  // Section title
  doc.setTextColor.apply(doc, C.CH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Portfolio im Überblick', M, sy);

  doc.setDrawColor.apply(doc, C.GOLD);
  doc.setLineWidth(0.5);
  doc.line(M, sy + 3, M + 50, sy + 3);

  sy += 12;

  // Calculate aggregates
  var totals = { count: objects.length, kp: 0, marktw: 0, darl: 0, cf_jahr: 0 };
  objects.forEach(function(o) {
    var d = o.data || {};
    var k = o.kpis || {};
    totals.kp += parseFloat(d.kp) || 0;
    totals.marktw += parseFloat(d.bankval) || parseFloat(d.svwert) || (parseFloat(d.kp) || 0);
    totals.darl += (parseFloat(d.d1) || 0) + (parseFloat(d.d2) || 0);
    totals.cf_jahr += k.cf_ns_yearly || 0;
  });

  // 4 KPI tiles
  var tileW = (CW - 12) / 4;
  var tiles = [
    { label: 'Anzahl Objekte', val: totals.count + '', color: C.CH },
    { label: 'Investment-Volumen', val: _fmtKEU(totals.kp), color: C.CH },
    { label: 'Marktwert gesamt', val: _fmtKEU(totals.marktw), color: C.GREEN },
    { label: 'Cashflow / Jahr', val: (totals.cf_jahr >= 0 ? '+' : '') + _fmtKEU(totals.cf_jahr), color: totals.cf_jahr >= 0 ? C.GREEN : C.RED }
  ];

  tiles.forEach(function(t, i) {
    var tx = M + i * (tileW + 4);
    doc.setFillColor(248, 246, 240);
    doc.roundedRect(tx, sy, tileW, 32, 2, 2, 'F');
    doc.setFillColor.apply(doc, t.color);
    doc.rect(tx, sy, 3, 32, 'F');

    doc.setTextColor(122, 115, 112);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(t.label.toUpperCase(), tx + 6, sy + 8);

    doc.setTextColor.apply(doc, t.color);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(t.val, tx + 6, sy + 22);
  });

  sy += 42;

  // Object list
  doc.setTextColor.apply(doc, C.CH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Enthaltene Objekte:', M, sy);

  sy += 6;

  var objRows = objects.map(function(o, i) {
    var d = o.data || {};
    var addr = (d.str || '–') + ' ' + (d.hnr || '');
    return [
      (i + 1) + '.',
      o.name || 'Objekt',
      addr,
      d.ort || '–',
      _fmtKEU(parseFloat(d.kp) || 0)
    ];
  });

  doc.autoTable({
    startY: sy,
    head: [['Nr', 'Bezeichnung', 'Adresse', 'Ort', 'Kaufpreis']],
    body: objRows,
    theme: 'striped',
    headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 2.2 },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      4: { halign: 'right' }
    },
    margin: { left: M, right: M }
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'DealPilot'),
    W / 2, H - 12, { align: 'center' });
  doc.text('Erstellt am ' + new Date().toLocaleDateString('de-DE') +
    ' · Vertraulich · Nur für interne Verwendung',
    W / 2, H - 7, { align: 'center' });
}

function _fmtKEU(v) {
  if (v == null || isNaN(v)) return '–';
  return Math.round(v).toLocaleString('de-DE') + ' €';
}

async function renderTrackRecordPage(doc, obj, pageNum, totalPages, W, H, C) {
  var d = obj.data || {};
  var k = obj.kpis || {};
  var M = 14;
  var CW = W - 2 * M;

  // ── HEADER ─────────────────────────────────────
  doc.setFillColor.apply(doc, C.CH);
  doc.rect(0, 0, W, 28, 'F');

  // Gold strip
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(0, 28, W, 1.2, 'F');

  // Title
  doc.setTextColor.apply(doc, C.GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TRACK RECORD', M, 14);

  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  // V24: Company aus Branding-Settings, kein Hardcoding
  var _bH = (typeof _getBranding === 'function') ? _getBranding() : { company: 'DealPilot' };
  doc.text((_bH.company || 'DealPilot') + ' \u00b7 Investment Documentation', M, 21);

  // Right side: page number
  if (totalPages > 1) {
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(8);
    doc.text(pageNum + ' / ' + totalPages, W - M, 21, { align: 'right' });
  }

  var cy = 42;

  // ── OBJEKTNAME + ADRESSE ───────────────────────
  doc.setTextColor.apply(doc, C.CH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  var name = obj.name || 'Objekt';
  doc.text(name, M, cy);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor.apply(doc, C.MUTED);
  var addr = (d.str || '–') + ' ' + (d.hnr || '') + ', ' + (d.plz || '') + ' ' + (d.ort || '–');
  doc.text(addr, M, cy + 6);

  cy += 16;

  // ── PHOTO + KEY FACTS ──────────────────────────
  // Photo on left (or placeholder), facts on right
  var photoH = 60;
  var photoW = 80;

  if (d._photos && d._photos.length > 0) {
    try {
      doc.addImage(d._photos[0], 'JPEG', M, cy, photoW, photoH);
    } catch (e) {
      _photoPlaceholder(doc, M, cy, photoW, photoH, C);
    }
  } else {
    _photoPlaceholder(doc, M, cy, photoW, photoH, C);
  }

  // Key facts on right
  var fx = M + photoW + 8;
  var fy = cy;
  var fw = CW - photoW - 8;

  doc.setFillColor(248, 246, 240);
  doc.roundedRect(fx, fy, fw, photoH, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor.apply(doc, C.GOLD);
  doc.text('KEY FACTS', fx + 4, fy + 6);

  var facts = [
    ['Objektart', d.objart || '–'],
    ['Wohnfläche', (d.wfl || '–') + ' m²'],
    ['Baujahr', d.baujahr || '–'],
    ['Kaufdatum', d.kaufdat ? new Date(d.kaufdat).toLocaleDateString('de-DE') : '–'],
    ['Kaufpreis', _euro(d.kp)],
    ['Marktwert (Bank)', _euro(d.bankval) || _euro(d.svwert) || '–'],
    ['Eigenkapital', _euro(d.ek)],
    ['Finanzierung', _euro(d.d1) + (parseFloat(d.d2) > 0 ? ' + ' + _euro(d.d2) : '')]
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  var fly = fy + 12;
  facts.forEach(function(f) {
    doc.setTextColor.apply(doc, C.MUTED);
    doc.text(f[0] + ':', fx + 4, fly);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, C.CH);
    doc.text(f[1], fx + fw - 4, fly, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    fly += 5.5;
  });

  cy += photoH + 8;

  // ── PERFORMANCE-KENNZAHLEN ─────────────────────
  doc.setFillColor.apply(doc, C.CH);
  doc.rect(M, cy, CW, 7, 'F');
  doc.setTextColor.apply(doc, C.GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PERFORMANCE-KENNZAHLEN', M + 3, cy + 4.8);

  cy += 11;

  var bmy = (k.bmy || 0).toFixed(2).replace('.', ',') + ' %';
  var cfNs = k.cf_ns_yearly || 0;
  var cfNsM = cfNs / 12;
  var dscr = k.dscr || 0;
  var darl = (parseFloat(d.d1) || 0) + (parseFloat(d.d2) || 0);
  var marktw = parseFloat(d.bankval) || parseFloat(d.svwert) || parseFloat(d.kp) || 0;
  var ltv = marktw > 0 ? (darl / marktw * 100) : 0;

  var kpiCards = [
    { label: 'Bruttomietrendite', val: bmy, color: C.GREEN },
    { label: 'Cashflow n.St. p.a.', val: (cfNs >= 0 ? '+' : '') + _euro(cfNs), color: cfNs >= 0 ? C.GREEN : C.RED },
    { label: 'Cashflow / Monat', val: (cfNsM >= 0 ? '+' : '') + _euro(cfNsM), color: cfNsM >= 0 ? C.GREEN : C.RED },
    { label: 'DSCR', val: dscr.toFixed(2).replace('.', ','), color: C.CH },
    { label: 'LTV', val: ltv.toFixed(1).replace('.', ',') + ' %', color: C.CH }
  ];

  var kpW = (CW - 4 * 4) / 5;
  kpiCards.forEach(function(kc, i) {
    var kx = M + i * (kpW + 4);
    doc.setFillColor(248, 246, 240);
    doc.roundedRect(kx, cy, kpW, 22, 2, 2, 'F');
    doc.setFillColor.apply(doc, kc.color);
    doc.rect(kx, cy, 2, 22, 'F');

    doc.setTextColor.apply(doc, C.MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(kc.label.toUpperCase(), kx + 4, cy + 6);

    doc.setTextColor.apply(doc, kc.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(kc.val, kx + 4, cy + 17);
  });

  cy += 30;

  // ── ENTWICKLUNG / TIMELINE ─────────────────────
  doc.setFillColor.apply(doc, C.CH);
  doc.rect(M, cy, CW, 7, 'F');
  doc.setTextColor.apply(doc, C.GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ENTWICKLUNG (Prognose)', M + 3, cy + 4.8);

  cy += 11;

  // Generate 5-row projection table
  var bindj = parseInt(d.d1_bindj || 10);
  var mstg = (parseFloat(d.mietstg) || 1.5) / 100;
  var wstg = (parseFloat(d.wertstg) || 2) / 100;
  var nkmM = parseFloat(d.nkm) || 0;
  var kp = parseFloat(d.kp) || 0;

  var rows = [];
  var jahre = [1, 3, 5, bindj, bindj + 5];
  jahre.forEach(function(j) {
    var miete = nkmM * Math.pow(1 + mstg, j - 1);
    var wert = kp * Math.pow(1 + wstg, j);
    var rs = darl * Math.max(0, 1 - j * 0.025); // grobe Schätzung
    var equity = wert - rs;
    rows.push([
      'Jahr ' + j,
      Math.round(miete).toLocaleString('de-DE') + ' €',
      Math.round(wert).toLocaleString('de-DE') + ' €',
      Math.round(rs).toLocaleString('de-DE') + ' €',
      Math.round(equity).toLocaleString('de-DE') + ' €'
    ]);
  });

  doc.autoTable({
    startY: cy,
    head: [['Jahr', 'Miete/Monat', 'Immobilienwert', 'Restschuld', 'Eigenkapital']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: M, right: M }
  });

  cy = doc.lastAutoTable.finalY + 8;

  // ── INVESTMENTTHESE (wenn vorhanden) ───────────
  if (d.thesis) {
    if (cy < 250) {
      doc.setFillColor(245, 247, 252);
      var thesisLines = doc.splitTextToSize(d.thesis, CW - 8);
      var thesisH = Math.min(30, thesisLines.length * 4 + 8);
      doc.roundedRect(M, cy, CW, thesisH, 2, 2, 'F');
      doc.setFillColor.apply(doc, C.GOLD);
      doc.rect(M, cy, 2, thesisH, 'F');
      doc.setTextColor.apply(doc, C.GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('INVESTMENTTHESE', M + 5, cy + 5);
      doc.setTextColor.apply(doc, C.CH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      var ty = cy + 11;
      thesisLines.slice(0, 4).forEach(function(line) {
        doc.text(line, M + 5, ty);
        ty += 4;
      });
    }
  }

  // ── FOOTER ─────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'DealPilot'),
    W / 2, H - 8, { align: 'center' });
  doc.text('Erstellt am ' + new Date().toLocaleDateString('de-DE') + ' · Track Record',
    W / 2, H - 4, { align: 'center' });
}

function _photoPlaceholder(doc, x, y, w, h, C) {
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  doc.setTextColor(180, 180, 180);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Kein Foto', x + w / 2, y + h / 2, { align: 'center' });
}

function _euro(v) {
  if (v == null || v === '' || isNaN(parseFloat(v))) return '–';
  return Math.round(parseFloat(v)).toLocaleString('de-DE') + ' €';
}
