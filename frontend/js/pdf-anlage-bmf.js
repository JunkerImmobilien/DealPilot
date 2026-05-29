/* ════════════════════════════════════════════════════════════════
   DealPilot V289 — PDF-Anlage BMF-Kaufpreisaufteilung (fürs Finanzamt)
   ════════════════════════════════════════════════════════════════
   Generiert eine 2-seitige PDF-Anlage mit:
   - Adresse, Eckdaten, AK-Aufstellung
   - BMF-Berechnungs-Ergebnisse (3 Verfahren)
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
    : { company: 'Junker Immobilien', name: '', address: '', plz: '', city: '', phone: '', email: '', website: '' };

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

  /* V310-pdf-branding: Absenderblock rechtsbuendig (wer das PDF erstellt hat) */
  (function(){
    var bx = pageW - marginR;
    var by = marginT;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    if(brand.company) { doc.text(String(brand.company), bx, by, { align: 'right' }); by += 4.2; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    if(brand.name) { doc.text(String(brand.name) + (brand.role ? ', ' + brand.role : ''), bx, by, { align: 'right' }); by += 3.8; }
    if(brand.address) { doc.text(String(brand.address), bx, by, { align: 'right' }); by += 3.8; }
    var loc = ((brand.plz || '') + ' ' + (brand.city || '')).trim();
    if(loc) { doc.text(loc, bx, by, { align: 'right' }); by += 3.8; }
    if(brand.phone) { doc.text('Tel: ' + String(brand.phone), bx, by, { align: 'right' }); by += 3.8; }
    if(brand.email) { doc.text(String(brand.email), bx, by, { align: 'right' }); by += 3.8; }
    if(brand.website) { doc.text(String(brand.website), bx, by, { align: 'right' }); by += 3.8; }
    doc.setTextColor(0, 0, 0);
  })();
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
  // V306-pdf-ak-sektion: ANSCHAFFUNGSKOSTEN (Bemessungsgrundlage)
  // ──────────────────────────────────────────────────────────
  var ak = inputs.anschaffung || {};
  if(y > 215){ doc.addPage(); y = marginT; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Anschaffungskosten (Bemessungsgrundlage)', marginL, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  var akRows = [
    ['Kaufpreis (laut Notarvertrag):', fmtEur(ak.kp, 2)],
    ['Grunderwerbsteuer:', fmtEur(ak.grest, 2)],
    ['Notar- und Gerichtskosten:', fmtEur(ak.notar, 2)],
    ['Grundbuchamt:', fmtEur(ak.gba, 2)],
    ['Maklergebühr:', fmtEur(ak.makler, 2)]
  ];
  if(ak.ji && ak.ji > 0) akRows.push(['Sonstige Erwerbsnebenkosten:', fmtEur(ak.ji, 2)]);
  if(ak.fahrt && ak.fahrt > 0) akRows.push(['Fahrtkosten:', fmtEur(ak.fahrt, 2)]);
  if(ak.verpfl && ak.verpfl > 0) akRows.push(['Verpflegungsmehraufwand:', fmtEur(ak.verpfl, 2)]);
  if(ak.hotel && ak.hotel > 0) akRows.push(['Unterkunft:', fmtEur(ak.hotel, 2)]);
  if(ak.gutachten && ak.gutachten > 0) akRows.push(['Wertgutachten / Sachverständige:', fmtEur(ak.gutachten, 2)]);
  if(ak.anwalt && ak.anwalt > 0) akRows.push(['Anwaltskosten (Kaufvorgang):', fmtEur(ak.anwalt, 2)]);
  if(ak.sonst && ak.sonst > 0) akRows.push(['Sonstiges (Vermessung, Energieausweis):', fmtEur(ak.sonst, 2)]);
  if(ak.ahk && ak.ahk > 0) akRows.push(['Anschaffungsnahe Herstellkosten:', fmtEur(ak.ahk, 2)]);
  akRows.push(['Anschaffungskosten gesamt:', fmtEur(ak.total, 2)]);

  doc.autoTable({
    startY: y,
    head: [['Position', 'Betrag']],
    body: akRows,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9.5, cellPadding: 1.5 },
    headStyles: { fillColor: [201, 168, 76], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' }, 1: { cellWidth: contentW - 90, halign: 'right' } },
    didParseCell: function(d){
      // Summenzeile hervorheben
      if(d.row.index === akRows.length - 1){
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = [245, 240, 225];
      }
    }
  });
  y = doc.lastAutoTable.finalY + 8;

  // ──────────────────────────────────────────────────────────
  // BERECHNUNGSERGEBNIS
  // ──────────────────────────────────────────────────────────
  if(y > 220){ doc.addPage(); y = marginT; }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Ergebnis der Kaufpreisaufteilung', marginL, y);
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
  doc.text('4. Lineare AfA (§ 7 Abs. 4 EStG)', marginL, y);
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

  // V307-klausel-removed: Notarvertrag-Klausel-Sektion entfernt (auf Wunsch).

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
    var _footTxt = (window.DealPilotConfig && DealPilotConfig.branding && typeof DealPilotConfig.branding.formatFooter === 'function')
      ? DealPilotConfig.branding.formatFooter(brand)
      : (brand.company || 'Junker Immobilien');
    doc.text(
      'Erstellt mit DealPilot · BMF-Arbeitshilfe Juni 2023 · ' + _footTxt,
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
