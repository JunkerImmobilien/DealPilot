/* ════════════════════════════════════════════════════════════════
   DealPilot V289 — PDF-Anlage BMF-Kaufpreisaufteilung (fürs Finanzamt)
   ════════════════════════════════════════════════════════════════
   Generiert eine 2-seitige PDF-Anlage mit:
   - Adresse, Eckdaten, AK-Aufstellung
   - BMF-Berechnungs-Ergebnisse (3 Verfahren)
   - Empfohlene Notarvertrag-Klausel zur Aufteilung
   ════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

function fmtEur(v, dec){
  if(v == null || !isFinite(v)) return '—';
  dec = dec == null ? 2 : dec;
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v) + ' €';
}
function fmtPct(v, dec){
  if(v == null || !isFinite(v)) return '—';
  dec = dec == null ? 2 : dec;
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v) + ' %';
}

window.generateBmfPdfAnlage = function(state){
  if(typeof window.jspdf === 'undefined'){
    alert('PDF-Bibliothek noch nicht geladen — bitte kurz warten und erneut versuchen.');
    return;
  }
  state = state || {};
  var inputs = state.inputs || {};
  var results = state.results || {};
  var gaa = state.gaa || {};

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Seitendimensionen
  var pageW = 210, pageH = 297;
  var marginL = 18, marginR = 18, marginT = 22;
  var contentW = pageW - marginL - marginR;
  var y = marginT;

  // Branding (falls vorhanden)
  var brand = (window.DealPilotConfig && DealPilotConfig.branding && typeof DealPilotConfig.branding.get === 'function')
    ? DealPilotConfig.branding.get()
    : { name: 'DealPilot', firma: 'Junker Immobilien' };

  // ──────────────────────────────────────────────────────────
  // KOPF
  // ──────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Anlage zur Steuererklärung: Kaufpreisaufteilung', marginL, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('nach BMF-Arbeitshilfe (Fassung Juni 2023)', marginL, y);
  y += 10;

  // ──────────────────────────────────────────────────────────
  // OBJEKTDATEN
  // ──────────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Objektdaten', marginL, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  var rows1 = [
    ['Lage:', inputs.lage || '—'],
    ['Grundstücksart:', inputs.grundstuecksart || '—'],
    ['Baujahr:', String(inputs.baujahr || '—')],
    ['Wohnfläche:', inputs.wohnflaeche ? inputs.wohnflaeche + ' m²' : '—'],
    ['Grundstücksgröße:', inputs.grundstuecksgroesse ? inputs.grundstuecksgroesse + ' m²' : '—'],
    ['Bodenrichtwert:', inputs.bodenrichtwert ? inputs.bodenrichtwert + ' €/m²' : '—'],
    ['Kaufdatum:', inputs.kaufdatum || '—'],
    ['Kaufpreis (gesamt):', fmtEur(inputs.kaufpreis, 2)]
  ];
  doc.autoTable({
    startY: y,
    head: [['Feld', 'Wert']],
    body: rows1,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9.5, cellPadding: 1.5 },
    headStyles: { fillColor: [201, 168, 76], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: contentW - 50 } }
  });
  y = doc.lastAutoTable.finalY + 8;

  // ──────────────────────────────────────────────────────────
  // BERECHNUNGSERGEBNIS
  // ──────────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Ergebnis der Kaufpreisaufteilung', marginL, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  var afaBasis = results.kaufpreisanteil_gebaeude && results.kaufpreisanteil_gebaeude.value;
  var grundAnteil = results.kaufpreisanteil_grund && results.kaufpreisanteil_grund.value;
  var gebanteil = results.gebaeudeanteil_prozent && results.gebaeudeanteil_prozent.value;

  var rows2 = [
    ['Kaufpreisanteil Gebäude (AfA-Basis):', fmtEur(afaBasis, 2)],
    ['Kaufpreisanteil Grund & Boden:', fmtEur(grundAnteil, 2)],
    ['Gebäudeanteil prozentual:', fmtPct(gebanteil, 2)],
    ['Bodenwert:', fmtEur(results.bodenwert && results.bodenwert.value, 2)],
    ['Sachwert (vorläufig):', fmtEur(results.sachwert_vorlaeufig && results.sachwert_vorlaeufig.value, 2)],
    ['Ertragswert:', fmtEur(results.ertragswert && results.ertragswert.value, 2)],
    ['Maßgebender Verkehrswert:', fmtEur(results.massgebender_verkehrswert && results.massgebender_verkehrswert.value, 2)]
  ];
  doc.autoTable({
    startY: y,
    head: [['Position', 'Wert']],
    body: rows2,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9.5, cellPadding: 1.5 },
    headStyles: { fillColor: [201, 168, 76], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 75, fontStyle: 'bold' }, 1: { cellWidth: contentW - 75, halign: 'right' } }
  });
  y = doc.lastAutoTable.finalY + 8;

  // ──────────────────────────────────────────────────────────
  // SEITE 2: AfA-VORSCHAU + KLAUSEL
  // ──────────────────────────────────────────────────────────
  if(y > 230){ doc.addPage(); y = marginT; }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Lineare AfA (§ 7 Abs. 4 EStG)', marginL, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  var afaSatz = (inputs.baujahr && inputs.baujahr > 2022) ? 3.0 : 2.0;
  var afaSatzText = (inputs.baujahr && inputs.baujahr > 2022)
    ? 'Neubau ab 2023 (3,0 % nach § 7 Abs. 4 Nr. 2a EStG)'
    : 'Bestand (2,0 % nach § 7 Abs. 4 Nr. 2a EStG)';
  var afaJahr = afaBasis ? (afaBasis * afaSatz / 100) : null;

  var rows3 = [
    ['AfA-Basis (Gebäude):', fmtEur(afaBasis, 2)],
    ['AfA-Satz:', afaSatzText],
    ['Jährliche AfA:', fmtEur(afaJahr, 2)],
    ['AfA-Zeitraum:', (afaSatz === 3.0 ? '33,33 Jahre' : '50 Jahre')]
  ];
  doc.autoTable({
    startY: y,
    head: [['Position', 'Wert']],
    body: rows3,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9.5, cellPadding: 1.5 },
    headStyles: { fillColor: [201, 168, 76], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' }, 1: { cellWidth: contentW - 65, halign: 'right' } }
  });
  y = doc.lastAutoTable.finalY + 10;

  // ──────────────────────────────────────────────────────────
  // KLAUSEL
  // ──────────────────────────────────────────────────────────
  if(y > 240){ doc.addPage(); y = marginT; }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Empfohlene Notarvertrag-Klausel', marginL, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('times', 'italic');

  var klauselText =
    'Die Vertragsparteien teilen den Gesamtkaufpreis in Höhe von ' + fmtEur(inputs.kaufpreis, 2) + ' wie folgt auf:\n\n' +
    '• Auf den Grund und Boden entfallen ' + fmtEur(grundAnteil, 2) + '\n' +
    '• Auf das Gebäude entfallen ' + fmtEur(afaBasis, 2) + ' (' + fmtPct(gebanteil, 2) + ' des Kaufpreises)\n\n' +
    'Die Aufteilung wurde nach der BMF-Arbeitshilfe (Fassung Juni 2023) ermittelt und ist sowohl bei der Bewertung ' +
    'der gesonderten Steuerbilanz als auch zur Berechnung der jährlichen Absetzung für Abnutzung (AfA) heranzuziehen.';

  var splitText = doc.splitTextToSize(klauselText, contentW - 4);
  doc.text(splitText, marginL + 2, y);
  y += splitText.length * 4.3;

  // ──────────────────────────────────────────────────────────
  // FOOTER auf jeder Seite
  // ──────────────────────────────────────────────────────────
  var pageCount = doc.internal.getNumberOfPages();
  for(var i = 1; i <= pageCount; i++){
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    var footerY = pageH - 12;
    doc.text(
      'Erstellt mit DealPilot · BMF-Arbeitshilfe Juni 2023 · ' + (brand.firma || 'Junker Immobilien'),
      marginL,
      footerY
    );
    doc.text('Seite ' + i + ' / ' + pageCount, pageW - marginR, footerY, { align: 'right' });
    doc.setTextColor(0);
  }

  // ──────────────────────────────────────────────────────────
  // DOWNLOAD
  // ──────────────────────────────────────────────────────────
  var ts = new Date().toISOString().slice(0, 10);
  var addressSlug = ((inputs.lage || 'objekt').replace(/[^a-z0-9]/gi, '_')).substring(0, 30);
  doc.save('BMF_Anlage_Finanzamt_' + addressSlug + '_' + ts + '.pdf');
};

})();
