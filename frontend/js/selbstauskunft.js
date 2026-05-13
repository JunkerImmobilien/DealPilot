'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V63.75 - selbstauskunft.js
   Generiert eine ausfüllbare Selbstauskunft als PDF.

   - Felder werden teilweise mit User-Daten aus den Settings vorgefüllt
     (Name, Adresse, Telefon, E-Mail, Beruf, Firma).
   - Restliche Felder sind als beschriftete Linien zum Ausfüllen.
   - Single-Page A4, jsPDF, neutrale Optik.

   API:  window.SelbstauskunftPDF.generate()  -> triggert Download
         window.SelbstauskunftPDF.blob()      -> gibt {blob, filename}
═══════════════════════════════════════════════════════════════ */

window.SelbstauskunftPDF = (function() {

  function _userSettings() {
    try {
      var raw = localStorage.getItem('dp_user_settings');
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function _build() {
    if (typeof window.jspdf === 'undefined') {
      alert('PDF-Bibliothek noch nicht geladen - bitte kurz warten und erneut versuchen.');
      return null;
    }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    var s = _userSettings();
    var GOLD    = [201, 168, 76];
    var TEXT    = [42, 39, 39];
    var MUTED   = [120, 120, 120];

    var pageW = 210;
    var marginX = 18;
    var y = 20;

    // ─── Header ───
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(0, 0, pageW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.setFontSize(20);
    y = 22;
    doc.text('Selbstauskunft', marginX, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('zur Vorlage bei der finanzierenden Bank', marginX, y + 6);

    doc.setFontSize(9);
    doc.text('Ausgestellt am: ' + new Date().toLocaleDateString('de-DE'), pageW - marginX, y + 6, { align: 'right' });
    y += 14;

    // ─── Helper ───
    function section(title) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text(title.toUpperCase(), marginX, y);
      y += 1;
      doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.setLineWidth(0.4);
      doc.line(marginX, y, pageW - marginX, y);
      y += 5;
    }
    function field(label, value, opts) {
      opts = opts || {};
      var w = opts.w || (pageW - 2 * marginX);
      var x = opts.x || marginX;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(label, x, y);

      // Linie
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(x, y + 5, x + w, y + 5);

      // Vorausgefüllter Wert
      if (value) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(String(value), x + 1, y + 4);
      }
      if (!opts.inline) y += 9;
    }

    function twoCol(labelL, valueL, labelR, valueR) {
      var halfW = (pageW - 2 * marginX - 6) / 2;
      field(labelL, valueL, { w: halfW, x: marginX, inline: true });
      field(labelR, valueR, { w: halfW, x: marginX + halfW + 6, inline: true });
      y += 9;
    }

    // ─── Persönliche Daten ───
    section('1. Persönliche Daten');
    twoCol('Vorname',      s.user_name ? s.user_name.split(' ')[0] : '',
           'Nachname',     s.user_name ? s.user_name.split(' ').slice(1).join(' ') : '');
    twoCol('Geburtsdatum', '',  'Geburtsort', '');
    twoCol('Familienstand', '', 'Staatsangehörigkeit', 'Deutsch');
    twoCol('Straße / Nr.', s.user_address || '',
           'PLZ / Ort',    [s.user_plz, s.user_city].filter(Boolean).join(' '));
    twoCol('Telefon',      s.user_phone || '',  'E-Mail', s.user_email || '');

    // ─── Berufliche Verhältnisse ───
    section('2. Berufliche Verhältnisse');
    twoCol('Beruf',                s.user_role || '',  'Arbeitgeber',  s.user_company || '');
    twoCol('Beschäftigt seit',     '',                  'Befristet?',   '');
    twoCol('Mtl. Nettoeinkommen', '',                   '13./14. Monatsgehalt', '');
    twoCol('Sonstige Einkünfte',   '',                  'Bonus/Provisionen p.a.', '');

    // ─── Vermögen ───
    section('3. Vermögensverhältnisse');
    twoCol('Bankguthaben (€)',    '', 'Wertpapiere/Fonds (€)', '');
    twoCol('Bausparguthaben (€)', '', 'LV/Rentenversicherung Rückkaufswert (€)', '');
    twoCol('Eigenkapital für Finanzierung (€)', '', 'davon nachweisbar binnen 14 Tagen (€)', '');
    field('Sonstiges Vermögen (Immobilien, Beteiligungen, …)', '');

    // ─── Verbindlichkeiten ───
    section('4. Bestehende Verbindlichkeiten');
    twoCol('Bestehende Kredite (Restschuld €)', '',  'Mtl. Rate (€)', '');
    twoCol('Kreditkartenkredite (€)',           '',  'Sonstige Verpflichtungen (€)', '');
    field('Bürgschaften, Unterhaltsverpflichtungen, …', '');

    // ─── Erklärungen ───
    section('5. Erklärungen');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    var declTxt = doc.splitTextToSize(
      'Ich versichere die Richtigkeit und Vollständigkeit meiner Angaben. ' +
      'Mir ist bekannt, dass falsche Angaben zur Ablehnung der Finanzierung sowie zu rechtlichen ' +
      'Konsequenzen führen können. Die Bank ist berechtigt, eine Bonitätsprüfung (z.B. SCHUFA) ' +
      'durchzuführen. Diese Selbstauskunft wurde mit DealPilot generiert und dient ausschließlich ' +
      'als Vorbereitungs-Dokument für ein konkretes Finanzierungsgespräch.',
      pageW - 2 * marginX
    );
    doc.text(declTxt, marginX, y);
    y += declTxt.length * 4 + 6;

    // ─── Unterschrift ───
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + 8, marginX + 60, y + 8);
    doc.line(pageW - marginX - 60, y + 8, pageW - marginX, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Ort, Datum', marginX, y + 12);
    doc.text('Unterschrift', pageW - marginX - 60, y + 12);

    // ─── Footer ───
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Generiert mit DealPilot · Junker Immobilien · www.junker-immobilien.io',
             pageW / 2, 290, { align: 'center' });

    return doc;
  }

  function generate() {
    var doc = _build();
    if (!doc) return;
    var s = _userSettings();
    var name = (s.user_name || 'Bewerber').replace(/\s/g, '_');
    var fn = 'Selbstauskunft_' + name + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    doc.save(fn);
  }

  function blob() {
    var doc = _build();
    if (!doc) return null;
    var s = _userSettings();
    var name = (s.user_name || 'Bewerber').replace(/\s/g, '_');
    var fn = 'Selbstauskunft_' + name + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    return { blob: doc.output('blob'), filename: fn };
  }

  return { generate: generate, blob: blob };
})();
