/**
 * DealPilot — Restnutzungsdauer-Gutachten PDF V3
 * ===================================================
 * KOMPLETT NEU im Layout des Original-Gutachters (DER GUTACHTER München).
 *
 * Struktur exakt 1:1 wie Original-Gutachten 25DG02661 (37 Seiten):
 *   1. Cover-Seite mit Foto-Platzhalter
 *   2. Inhaltsverzeichnis
 *   3. Kap. 1 Einleitung (1.1 Auftrag, 1.2 Erläuterung Umfang)
 *   4. Kap. 2 Bewertetes Objekt (2.1 Erschließung, 2.2 Gebäude/Technik/Mod)
 *   5. Kap. 3 Definitionen und Berechnungsgrundlagen
 *   6. Kap. 4 Verfahrensarten (4.1-4.8)
 *   7. Kap. 5 Berechnung Restnutzungsdauer (5.1-5.4)
 *   8. Kap. 6 Zusammenfassung (6.1, 6.2)
 *   9. Anlage: Anerkenntnis durch Finanzverwaltung
 *
 * Platzhalter:
 *   - Logo-Header (oben links) — gestrichelter Rahmen, kann via logo_url ersetzt werden
 *   - Stempel im Fußbereich der Schluss-Seite — gestrichelter Kreis
 *
 * Public API:
 *   DealPilotRND_PDF.generateGutachten({ gutachtenData, result, afa? })
 *     → returns jsPDF instance, .save() für Download
 *   DealPilotRND_PDF.addChapter(doc, opts)   // Kompaktversion für Investment-Report
 */
(function (global) {
  'use strict';

  const COLORS = {
    headerGreen: [60, 110, 60],     // dezentes grün wie Original
    text:        [30, 30, 30],
    muted:       [110, 110, 110],
    surface:     [248, 246, 241],
    gold:        [201, 168, 76],
    rule:        [200, 200, 200],
    accentRed:   [180, 50, 50]
  };

  const A4_W = 210;
  const A4_H = 297;
  const ML = 22;     // Margin links
  const MR = 22;     // Margin rechts
  const MT = 30;     // Margin top (nach Header)
  const MB = 25;     // Margin bottom (über Footer)
  const HEADER_Y = 22;
  const CONTENT_W = A4_W - ML - MR;

  // ============================================================
  // PUBLIC API
  // ============================================================
  function generateGutachten(opts) {
    if (!opts || !opts.result) throw new Error('opts.result is required');
    if (typeof global.jspdf === 'undefined' || !global.jspdf.jsPDF) {
      throw new Error('jsPDF not loaded');
    }

    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const data = mergeWithDefaults(opts.gutachtenData || {}, opts.result);
    const result = opts.result;
    const afa = opts.afa || null;

    // Page 1: Cover
    renderCover(doc, data, result);

    // Page 2: TOC
    addPageWithHeader(doc, data);
    renderTOC(doc, data);

    // Kapitel 1: Einleitung
    addPageWithHeader(doc, data);
    renderKapitel1(doc, data);

    // Kapitel 2: Bewertetes Objekt
    addPageWithHeader(doc, data);
    renderKapitel2(doc, data);

    // Kapitel 3: Definitionen (mit Nutzungsdauer-Tabelle)
    addPageWithHeader(doc, data);
    renderKapitel3(doc, data, result);

    // Kapitel 4: Verfahrensarten
    addPageWithHeader(doc, data);
    renderKapitel4(doc, data, result);

    // Kapitel 5: Berechnung
    addPageWithHeader(doc, data);
    renderKapitel5(doc, data, result);

    // Kapitel 6: Zusammenfassung
    addPageWithHeader(doc, data);
    renderKapitel6(doc, data, result);

    // Optional AfA-Kapitel
    if (afa && afa.valid) {
      addPageWithHeader(doc, data);
      renderKapitelAfa(doc, data, result, afa);
    }

    // Anlage: Anerkenntnis Finanzverwaltung
    addPageWithHeader(doc, data);
    renderAnlage(doc, data);

    // Footer mit korrekter "Seite X von Y" auf allen Seiten
    finalizeFooters(doc, data);

    return doc;
  }

  // ============================================================
  // DATA MERGE
  // ============================================================
  function mergeWithDefaults(data, result) {
    const today = new Date();
    const todayStr = formatDate(today);
    const inp = result.input;
    const stichtag = data.stichtag || (inp.stichtag_jahr + '-12-31');

    return {
      titel: data.titel || 'Ermittlung\nRestnutzungsdauer',
      aktenzeichen: data.aktenzeichen || ('DP' + Date.now().toString().slice(-8)),

      objekt_typ: data.objekt_typ || 'Eigentumswohnung',
      objekt_adresse: data.objekt_adresse || '— Adresse nicht angegeben —',
      objekt_einheit: data.objekt_einheit || '',

      stichtag: stichtag,
      stichtag_str: formatDate(stichtag),
      besichtigungsdatum: data.besichtigungsdatum || todayStr,
      besichtigung_art: data.besichtigung_art || 'Außenbesichtigung',
      erstellungsdatum: data.erstellungsdatum || todayStr,
      erstellungsort: data.erstellungsort || 'Hüllhorst',

      auftraggeber_name: data.auftraggeber_name || '',
      auftraggeber_adresse: data.auftraggeber_adresse || '',
      eigentuemer_name: data.eigentuemer_name || data.auftraggeber_name || '',
      eigentuemer_adresse: data.eigentuemer_adresse || data.auftraggeber_adresse || '',
      anlass: data.anlass || 'Restnutzungsdauerermittlung',

      baujahr: inp.baujahr,
      wohnflaeche: data.wohnflaeche || '',
      bauweise: data.bauweise || 'Massiv',
      unterkellerung: data.unterkellerung || '',
      vollgeschosse: data.vollgeschosse || '',
      einheiten_gesamt: data.einheiten_gesamt || '',
      bedachung: data.bedachung || '',
      fenster: data.fenster || '',
      heizungsart: data.heizungsart || '',
      anzahl_baeder: data.anzahl_baeder || '1',
      besonderheiten: data.besonderheiten || 'Keine',
      bel: data.bel || 'Herkömmliche Fensterlüftung',
      brennstoff: data.brennstoff || '',
      warmwasser: data.warmwasser || '',
      erneuerbare: data.erneuerbare || 'Keine',
      energieklasse: data.energieklasse || '',
      erschliessung: data.erschliessung || 'erschlossen',

      mod_dach: data.mod_dach || 'Keine/Nie',
      mod_fenster: data.mod_fenster || 'Keine/Nie',
      mod_leitungen: data.mod_leitungen || 'Keine/Nie',
      mod_heizung: data.mod_heizung || 'Keine/Nie',
      mod_aussenwand: data.mod_aussenwand || 'Keine/Nie',
      mod_baeder: data.mod_baeder || 'Keine/Nie',
      mod_innenausbau: data.mod_innenausbau || 'Keine/Nie',
      mod_technik: data.mod_technik || 'Keine/Nie',
      mod_grundriss: data.mod_grundriss || '',

      sv_name: data.sv_name || '— Sachverständiger —',
      sv_titel: data.sv_titel || '',
      sv_unternehmen: data.sv_unternehmen
                      || (data.branding && data.branding.firma)
                      || 'Junker Immobilien',
      sv_adresse_z1: data.sv_adresse_z1 || 'Hermannstraße 9',
      sv_adresse_z2: data.sv_adresse_z2 || '32609 Hüllhorst',
      sv_email: data.sv_email || '',

      branding: data.branding || (global.DealPilotConfig && global.DealPilotConfig.branding
                && typeof global.DealPilotConfig.branding.get === 'function'
                ? global.DealPilotConfig.branding.get() : {}),

      logo_url: data.logo_url || null,
      foto_url: data.foto_url || null
    };
  }

  // ============================================================
  // HEADER & FOOTER (auf jeder Seite außer Cover)
  // ============================================================
  function addPageWithHeader(doc, data) {
    doc.addPage();
    renderHeader(doc, data);
  }

  function renderHeader(doc, data) {
    // Logo links
    if (data.logo_url) {
      try {
        doc.addImage(data.logo_url, 'PNG', ML, 8, 38, 12);
      } catch (e) { drawLogoPlaceholder(doc); }
    } else {
      drawLogoPlaceholder(doc);
    }

    // Sachverständigen-Adresse rechts (klein)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text(data.sv_unternehmen, A4_W - MR, 10, { align: 'right' });
    doc.text(data.sv_adresse_z1, A4_W - MR, 13, { align: 'right' });
    doc.text(data.sv_adresse_z2, A4_W - MR, 16, { align: 'right' });
    if (data.sv_email) {
      doc.text(data.sv_email, A4_W - MR, 19, { align: 'right' });
    }

    // Titel-Zeile unter der Trennung
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.line(ML, 22, A4_W - MR, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Restnutzungsdauergutachten', ML, 26);
    doc.text(data.objekt_adresse + (data.objekt_einheit ? ' - ' + data.objekt_einheit : ''),
             A4_W - MR, 26, { align: 'right' });
  }

  function drawLogoPlaceholder(doc) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.3);
    doc.rect(ML, 8, 38, 12);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text('[ LOGO PLATZHALTER ]', ML + 2, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text('DealPilot', ML + 12, 18);
  }

  function renderFooter(doc, data, pageNo, totalPages) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(ML, A4_H - 18, A4_W - MR, A4_H - 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text(data.aktenzeichen, ML, A4_H - 13);
    if (data.branding && data.branding.web) {
      doc.text(data.branding.web, A4_W / 2, A4_H - 13, { align: 'center' });
    }
    doc.text(pageNo + ' von ' + totalPages, A4_W - MR, A4_H - 13, { align: 'right' });
  }

  function finalizeFooters(doc, data) {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      // Auf Cover-Seite (1) nur centered Footer, ohne Aktenzeichen/Seitenzahl
      if (i === 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor.apply(doc, COLORS.muted);
        if (data.branding && data.branding.web) {
          doc.text(data.branding.web, A4_W / 2, A4_H - 13, { align: 'center' });
        }
      } else {
        renderFooter(doc, data, i, total);
      }
    }
  }

  // ============================================================
  // SEITE 1: COVER
  // ============================================================
  function renderCover(doc, data, result) {
    // Logo oben groß (statt Header)
    if (data.logo_url) {
      try {
        doc.addImage(data.logo_url, 'PNG', ML, 18, 65, 22);
      } catch (e) { drawCoverLogoPlaceholder(doc); }
    } else {
      drawCoverLogoPlaceholder(doc);
    }

    // Sachverständigen-Adresse oben rechts
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLORS.text);
    let svY = 22;
    doc.text(data.sv_adresse_z1, A4_W - MR, svY, { align: 'right' });
    svY += 4;
    doc.text(data.sv_adresse_z2, A4_W - MR, svY, { align: 'right' });
    if (data.sv_email) {
      svY += 4;
      doc.text(data.sv_email, A4_W - MR, svY, { align: 'right' });
    }

    // Hauptüberschrift
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Ermittlung', A4_W / 2, 60, { align: 'center' });
    doc.text('Restnutzungsdauer', A4_W / 2, 75, { align: 'center' });

    // Untertitel
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, COLORS.text);
    const subWrapped = doc.splitTextToSize(
      'einer Immobilie unter Beachtung des § 7 Absatz 4 Satz 2 Einkommenssteuergesetz (EStG) '
      + 'und unter Verwendung der DIN EN 15686, DIN 276-1 unter Berücksichtigung der aktuellen '
      + 'Gesetzgebung des Gebäudeenergiegesetz (GEG) und der für die Ermittlung erforderlichen Daten',
      CONTENT_W - 10
    );
    doc.text(subWrapped, A4_W / 2, 90, { align: 'center' });

    // Foto-Platzhalter
    const imgY = 115;
    const imgH = 80;
    const imgW = CONTENT_W - 30;
    if (data.foto_url) {
      try { doc.addImage(data.foto_url, 'JPEG', ML + 15, imgY, imgW, imgH); }
      catch (e) { drawFotoPlaceholder(doc, ML + 15, imgY, imgW, imgH); }
    } else {
      drawFotoPlaceholder(doc, ML + 15, imgY, imgW, imgH);
    }

    // Objektbezeichnung
    let y = imgY + imgH + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text(data.objekt_typ, A4_W / 2, y, { align: 'center' });
    y += 6;
    const adrLine = data.objekt_adresse + (data.objekt_einheit ? ' - ' + data.objekt_einheit : '');
    doc.text(adrLine, A4_W / 2, y, { align: 'center' });
    y += 14;

    // Ergebnis
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Ermittelte Restnutzungsdauer:', A4_W / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(28);
    doc.setTextColor.apply(doc, COLORS.accentRed);   // wie Original (lila/rot)
    doc.text(result.final_rnd + ' Jahre', A4_W / 2, y, { align: 'center' });

    // Stempel-Platzhalter unten Mitte (wie im Original)
    drawStempelPlaceholder(doc, A4_W / 2 - 18, A4_H - 60);
  }

  function drawCoverLogoPlaceholder(doc) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.3);
    doc.rect(ML, 18, 65, 22);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text('[ LOGO PLATZHALTER ]', ML + 19, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text('DealPilot', ML + 22, 36);
  }

  function drawFotoPlaceholder(doc, x, y, w, h) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text('[ Objektfoto Platzhalter ]', x + w / 2, y + h / 2, { align: 'center' });
  }

  function drawStempelPlaceholder(doc, cx, cy) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.4);
    doc.circle(cx + 18, cy + 18, 18);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text('[ Stempel /', cx + 8, cy + 16);
    doc.text('  Unterschrift ]', cx + 4, cy + 21);
  }

  // ============================================================
  // SEITE 2: INHALTSVERZEICHNIS
  // ============================================================
  function renderTOC(doc, data) {
    let y = MT;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text('Inhaltsverzeichnis', ML, y);
    y += 12;

    const items = [
      ['1.',   'Einleitung', '3'],
      ['1.1',  'Auftrag', '3'],
      ['1.2',  'Erläuterung zum Umfang', '3'],
      ['2.',   'Bewertetes Objekt', '4'],
      ['2.1',  'Erschließungssituation', '4'],
      ['2.2',  'Gebäude und bauliche Anlagen', '4'],
      ['3.',   'Definitionen und Berechnungsgrundlagen', '6'],
      ['3.1',  'Allgemeine Definition', '6'],
      ['3.2',  'Fiktives Baujahr', '6'],
      ['3.3',  'Nutzungsdauern', '7'],
      ['3.4',  'Relevanz der Ermittlung der Restnutzungsdauer', '18'],
      ['4.',   'Verfahrensarten', '19'],
      ['4.1',  'Allgemeine Erläuterung', '19'],
      ['4.2',  'Lineare Alterswertminderung', '20'],
      ['4.3',  'Alterswertminderung nach Vogels', '20'],
      ['4.4',  'Alterswertminderung nach Ross', '20'],
      ['4.5',  'Parabelförmige Wertminderung', '20'],
      ['4.6',  'Punktrastermethode', '21'],
      ['4.7',  'Technische Alterswertminderung', '24'],
      ['4.8',  'Ermittlungsverfahren und Betrachtungsweisen', '25'],
      ['5.',   'Berechnung Restnutzungsdauer', '27'],
      ['5.1',  'Lineare Restnutzungsdauer', '27'],
      ['5.2',  'Punktrastermethode', '28'],
      ['5.3',  'Technische Restnutzungsdauer', '29'],
      ['5.4',  'Technische Angaben zum Tragwerk', '34'],
      ['6.',   'Zusammenfassung', '35'],
      ['6.1',  'Berechnungen', '35'],
      ['6.2',  'Ergebnis', '36'],
      ['',     'Anlage: Anerkenntnis durch Finanzverwaltung', '37']
    ];

    doc.setFontSize(10);
    items.forEach(function (item) {
      const isMain = item[0].length <= 2 || item[0] === '';
      doc.setFont('helvetica', isMain ? 'bold' : 'normal');
      doc.setTextColor.apply(doc, isMain ? COLORS.headerGreen : COLORS.text);
      const indent = isMain ? 0 : 8;
      if (item[0]) doc.text(item[0], ML + indent, y);
      doc.text(item[1], ML + 18 + indent, y);

      // Punktelinie
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([0.5, 0.8], 0);
      const txtW = doc.getTextWidth(item[1]);
      const lineX1 = ML + 18 + indent + txtW + 2;
      const lineX2 = A4_W - MR - 8;
      if (lineX2 > lineX1) {
        doc.line(lineX1, y - 0.8, lineX2, y - 0.8);
      }
      doc.setLineDashPattern([], 0);

      doc.setTextColor.apply(doc, COLORS.text);
      doc.setFont('helvetica', 'normal');
      doc.text(item[2], A4_W - MR, y, { align: 'right' });

      y += isMain ? 7 : 5.5;
    });
  }

  // ============================================================
  // KAPITEL 1: EINLEITUNG
  // ============================================================
  function renderKapitel1(doc, data) {
    let y = MT;
    y = renderH1(doc, '1.    Einleitung', y);
    y = renderH2(doc, '1.1   Auftrag', y);

    // Auftraggeber/Eigentümer als KV-Block
    y = renderKV(doc, 'Auftraggeber der Nutzungsdauerermittlung:',
        data.auftraggeber_name + (data.auftraggeber_adresse
          ? '\n' + data.auftraggeber_adresse : ''), y);
    y = renderKV(doc, 'Eigentümer des Objektes:',
        data.eigentuemer_name + (data.eigentuemer_adresse
          ? '\n' + data.eigentuemer_adresse : ''), y);

    y += 4;
    y = renderH3sub(doc, 'Bewertungsstichtag', y);
    y = renderParagraph(doc,
      'Der Bewertungsstichtag ist definiert als der Zeitpunkt, auf den sich die '
      + 'Nutzungsdauerermittlung hinsichtlich der Restnutzung bezieht. Die Restnutzungsdauer '
      + 'wird grundsätzlich aus dem Unterschied zwischen der typisierten wirtschaftlichen '
      + 'Gesamtnutzungsdauer und dem Alter des Gebäudes am Bewertungsstichtag ermittelt. '
      + 'Technische und wirtschaftliche Veränderungen am Ermittlungsobjekt, welche nach dem '
      + 'Bewertungsstichtag durchgeführt wurden, sind in dieser Ermittlung nicht berücksichtigt.',
      y);

    y += 4;
    y = renderKVCompact(doc, 'Anlass des Auftrages:', data.anlass, y);
    y = renderKVCompact(doc, 'Aktenzeichen der Restnutzungsdauerermittlung:',
                       data.aktenzeichen, y);
    y = renderKVCompact(doc, 'Datum der Besichtigung / technischen Betrachtung des Auftragsobjektes:',
                       data.besichtigungsdatum, y);
    y = renderKVCompact(doc, 'Bewertungsstichtag:', data.stichtag_str, y);

    y += 8;
    y = renderH2(doc, '1.2   Erläuterung zum Umfang', y);
    y = renderParagraph(doc,
      'Im Rahmen dieser Restnutzungsdauerermittlung werden die Umstände berücksichtigt, die '
      + 'im Rahmen einer ordnungsgemäßen und zumutbaren Erforschung der Sachverhalte für den '
      + 'Sachverständigen zu erkennen und zu bewerten waren. Der Sachverständige führt keine '
      + 'Untersuchungen durch, die eine Beschädigung oder Zerstörung von Bauteilen zur Folge hat.',
      y);
    y = renderParagraph(doc,
      'Der Zustand von nicht sichtbaren Bauteilen wird deshalb durch Auskünfte des Auftraggebers, '
      + 'durch Unterlagen oder durch den Sachverständigen eingeschätzt.', y);
    y = renderParagraph(doc,
      'Ebenso wurden haustechnische Einrichtungen keiner Funktionsprüfung unterzogen. So weit '
      + 'nicht anders angegeben, wird die Funktionstauglichkeit unterstellt.', y);
  }

  // ============================================================
  // KAPITEL 2: BEWERTETES OBJEKT
  // ============================================================
  function renderKapitel2(doc, data) {
    let y = MT;
    y = renderH1(doc, '2.    Bewertetes Objekt', y);

    y = renderH2(doc, '2.1.  Erschließungssituation', y);
    y = renderKVCompact(doc, 'Erschließungssituation:', data.erschliessung, y);

    y += 6;
    y = renderH2(doc, '2.2.  Gebäude und bauliche Anlagen', y);
    y = renderH3sub(doc, 'a) Gebäude und Einheit', y);

    const objRows = [
      ['Gebäudetyp', data.objekt_typ],
      ['Baujahr', String(data.baujahr)],
      ['Wohnfläche', data.wohnflaeche ? data.wohnflaeche + ' m²' : '—'],
      ['Bauweise', data.bauweise],
      ['Unterkellerung', data.unterkellerung || '—'],
      ['Vollgeschosse', data.vollgeschosse ? String(data.vollgeschosse) : '—'],
      ['Gesamtzahl der Einheiten', data.einheiten_gesamt ? String(data.einheiten_gesamt) : '—'],
      ['Bedachung', data.bedachung || '—'],
      ['Fenster', data.fenster || '—'],
      ['Heizungsart', data.heizungsart || '—'],
      ['Anzahl Bäder', String(data.anzahl_baeder || '—')],
      ['Besonderheiten des Objekts', data.besonderheiten]
    ];
    y = renderKVList(doc, objRows, y);

    if (y > A4_H - MB - 50) { addPageWithHeader(doc, data); y = MT; }

    y += 4;
    y = renderH3sub(doc, 'b) Gebäudetechnik', y);
    y = renderKVList(doc, [
      ['Belüftung', data.bel],
      ['Brennstoff / Energie', data.brennstoff || '—'],
      ['Warmwasser', data.warmwasser || '—']
    ], y);

    y += 4;
    y = renderH3sub(doc, 'c) Erneuerbare Energien', y);
    y = renderKVCompact(doc, '', data.erneuerbare, y);

    if (y > A4_H - MB - 80) { addPageWithHeader(doc, data); y = MT; }

    y += 4;
    y = renderH3sub(doc, 'd) Energieeffizienz / Energieausweis', y);
    if (data.energieklasse) {
      y = renderParagraph(doc,
        'Bei der Berechnung nach aktuellen Gebäudeenergiegesetzvorschriften erhält das Objekt '
        + 'einen Energiekennwert von ', y, true /* inline-bold-end */);
      // Energieklasse fett anhängen
      // (Vereinfacht: einfach im Text)
    } else {
      y = renderParagraph(doc, 'Energiekennwert nicht erfasst.', y);
    }

    y += 4;
    y = renderH3sub(doc, 'e) Durchgeführte Modernisierungsmaßnahmen', y);
    y = renderParagraph(doc,
      'Eine Kernsanierung nach der o.g. Definition trifft auf das Bewertungsobjekt '
      + (data.objekt_adresse + (data.objekt_einheit ? ' - ' + data.objekt_einheit : ''))
      + ' nicht zu. Stattdessen wurden folgende Modernisierungen durchgeführt bzw. nicht '
      + 'durchgeführt:', y);

    y += 2;
    y = renderModTable(doc, data, y);
  }

  function renderModTable(doc, data, y) {
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y,
        head: [['Modernisierungselement', 'Zeitraum und Umfang']],
        body: [
          ['Dacherneuerung inkl. Wärmedämmung', data.mod_dach],
          ['Modernisierung der Fenster und Türen', data.mod_fenster],
          ['Modernisierung der Leitungssysteme\n(Strom, Gas, Wasser, Abwasser)', data.mod_leitungen],
          ['Modernisierung der Heizungsanlage', data.mod_heizung],
          ['Wärmedämmung der Außenwände', data.mod_aussenwand],
          ['Modernisierung der Bäder', data.mod_baeder],
          ['Modernisierung des Innenausbaus', data.mod_innenausbau],
          ['Technische Ausstattung', data.mod_technik],
          ['Wesentliche Verbesserung der Grundrissgestaltung', data.mod_grundriss]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5,
                  lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
        headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text,
                      fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 95, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
        margin: { left: ML, right: MR }
      });
      return doc.lastAutoTable.finalY + 4;
    }
    return y + 60;
  }

  // ============================================================
  // KAPITEL 3: DEFINITIONEN UND BERECHNUNGSGRUNDLAGEN
  // ============================================================
  function renderKapitel3(doc, data, result) {
    let y = MT;
    y = renderH1(doc, '3.    Definitionen und Berechnungsgrundlagen', y);

    y = renderH2(doc, '3.1   Allgemeine Definition', y);
    y = renderParagraph(doc,
      'Die rechtliche Grundlage für die Restnutzungsdauer bildet die Immobilien'
      + 'wertermittlungsverordnung, abgekürzt als ImmoWertV.', y);
    y = renderParagraph(doc,
      'Grundsätzlich wird die Restnutzungsdauer einer Immobilie in Jahren angegeben. Diese '
      + 'Kennziffer bezieht sich auf die mögliche Dauer der Nutzung der baulichen Anlagen. '
      + 'Dabei betrachtet die Restnutzungsdauer immer den Zeitraum, in dem eine ordnungsgemäße '
      + 'Nutzung der Immobilie mit dem entsprechenden Nutzungszweck möglich ist. Die '
      + 'alternative Bezeichnung „wirtschaftliche Restnutzungsdauer" konkretisiert den Begriff '
      + 'und verdeutlicht die Bedeutung des Begriffs.', y);
    y = renderParagraph(doc,
      'Grundlage der Ermittlung der Restnutzungsdauer ist § 4 Abs. 3 S. 1 der '
      + 'Immobilienwertermittlungsverordnung (ImmoWertV). Diese berücksichtigt ausgehend vom '
      + 'Baujahr bzw. Gebäudealter die Auswirkung wesentlicher Modernisierungsmaßnahmen auf die '
      + 'Restnutzungsdauer. Besonders wichtig ist dabei eine erhebliche Verbesserung der '
      + 'Nutzungsbedingungen oder wesentliche Energieeinsparungen.', y);

    if (y > A4_H - MB - 60) { addPageWithHeader(doc, data); y = MT; }

    y += 4;
    y = renderH2(doc, '3.2   Fiktives Baujahr', y);
    y = renderParagraph(doc,
      'Bei Vorliegen einer Kernsanierung ist als fiktives Baujahr das Jahr der fachgerechten '
      + 'Sanierung zugrunde zu legen. Die teilweise noch verbliebene alte Bausubstanz oder der '
      + 'von neuen Gebäuden abweichende Zustand ist durch einen Abschlag zu berücksichtigen, '
      + 'der bei einer kompletten Kernsanierung regelmäßig 10% der Gesamtnutzungsdauer beträgt.', y);
    y = renderParagraph(doc,
      'Bei einer Kernsanierung wird das Gebäude zunächst bis auf die tragende Substanz '
      + 'zurückgebaut. Decken, Außenwände, tragende Innenwände und ggf. der Dachstuhl bleiben '
      + 'dabei in der Regel erhalten; ggf. sind diese zu ertüchtigen und/oder instand zu setzen. '
      + 'Kernsanierungen können insbesondere angenommen werden bei kompletter Erneuerung der '
      + 'Dacheindeckung, der Innenwände mit Ausnahme der tragenden Wände, der nichttragenden '
      + 'Bestandteile der Außenwände bei Fachwerk, der Fassade, der Innenwandbeschichtung, der '
      + 'Fußböden, der Fenster, der Innen- und Außentüren sowie sämtlicher technischen Systeme '
      + 'wie z.B. der Heizung einschließlich aller Leitungen, des Abwassersystems einschließlich '
      + 'der Grundleitungen, der elektrischen Leitungen und der Wasserversorgungsleitungen, '
      + 'sofern die Leitungen nach Erneuerung technisch einwandfrei und als neubauähnlich und '
      + 'neuwertig zu betrachten sind.', y);

    // Neue Seite für Kap. 3.3
    addPageWithHeader(doc, data); y = MT;
    y = renderH2(doc, '3.3   Nutzungsdauern', y);
    y = renderH3sub(doc, 'a) Gesamtnutzungsdauer der Gebäude', y);
    y = renderParagraph(doc,
      'Die wirtschaftlich übliche Gesamtnutzungsdauer ist eine der Modellgrößen, die der '
      + 'Ermittlung der Restnutzungsdauer dient. Sie steht für die Anzahl der Jahre, in denen '
      + 'die baulichen Anlagen ab Fertigstellung durchschnittlich wirtschaftlich genutzt werden '
      + 'können.', y);
    y = renderParagraph(doc,
      'Diese Gesamtnutzungsdauer wurde durch den Gesetzgeber nach empirisch ermittelten '
      + 'Erfahrungssätzen bemessen und als nicht widerlegbare Annahme im Modellansatz für die '
      + 'Gesamtnutzungsdauer (Anlage 1 zu § 12 Absatz 5 Satz 1 ImmoWertV) festgelegt. Dieser '
      + 'Modellansatz räumt insoweit keinen Spielraum ein.', y);
    y = renderParagraph(doc,
      'Nachfolgende Tabelle stellt die übliche wirtschaftliche Gesamtnutzungsdauer bei '
      + 'ordnungsgemäßer Instandhaltung (ohne Modernisierung) in Anlehnung an Anlage 3 SW-RL, '
      + 'Anlage 2 BelWertV und Anlage 22 BewG gegenüber.', y);

    y = renderGndTabelleTeil1(doc, y);

    addPageWithHeader(doc, data); y = MT;
    y = renderGndTabelleTeil2(doc, y);

    addPageWithHeader(doc, data); y = MT;
    y = renderGndTabelleTeil3(doc, y);

    addPageWithHeader(doc, data); y = MT;
    y = renderGndTabelleTeil4(doc, y);

    y += 4;
    y = renderParagraph(doc,
      'Für das vorliegende Bewertungsobjekt (' + data.objekt_typ + ') wird eine '
      + 'Gesamtnutzungsdauer von ' + result.input.gnd + ' Jahren angesetzt.', y);

    // Kap. 3.3 b) BTE-Lebensdauerkatalog — eigene Seiten
    addPageWithHeader(doc, data); y = MT;
    y = renderH3sub(doc, 'b) Lebensdauer einzelner Bauteile', y);
    y = renderParagraph(doc, 'Auszug aus dem BTE-Lebensdauerkatalog', y);
    y = renderBTETabelleAlle(doc, data, y);

    // Kap. 3.4 Relevanz
    addPageWithHeader(doc, data); y = MT;
    y = renderH2(doc, '3.4   Relevanz der Ermittlung der Restnutzungsdauer von Immobilien', y);
    y = renderParagraph(doc,
      'Grund und Boden gilt grundsätzlich als unvergänglich (bzw. unzerstörbar). Die '
      + 'Restnutzungsdauer der baulichen und sonstigen Anlagen auf einem Grundstück hingegen '
      + 'ist zeitlich begrenzt. Die Ermittlung dieser Restnutzungsdauer ist für eine '
      + 'lebenszyklusorientierte Betrachtung von Immobilien in vielfacher Hinsicht relevant:', y);

    y += 2;
    y = renderH3sub(doc, 'a) Relevanz in der Wertermittlung', y);
    y = renderParagraph(doc,
      'Die Restnutzungsdauer einer Immobilie ist eine der Einflussgrößen, die Kaufpreishöhen '
      + 'und insbesondere Kaufpreisunterschiede bewirken. Sie ist deshalb sowohl im Vergleichs-, '
      + 'Ertrags- als auch im Sachwertmodell als wertbeeinflussende Größe eingeführt. Es ist '
      + 'nachgewiesen, dass sich durch die Berücksichtigung der Restnutzungsdauer die '
      + 'Kaufpreisunterschiede in allen Wertermittlungsmodellen (auch statistisch) signifikanter '
      + 'erklären lassen. Nicht zuletzt findet die statistische Signifikanz der Restnutzungsdauer '
      + 'auf den Gebäudewert auch Einzug in die Immobilienwertermittlungsverordnung (ImmoWertV).', y);

    y += 2;
    y = renderH3sub(doc, 'b) Relevanz in der Investitionsplanung', y);
    y = renderParagraph(doc,
      'Die Investitionsplanung bzw. Instandhaltungsstrategie für eine Immobilie leitet sich in '
      + 'der Regel aus dem gegenwärtigen qualitativen Zustand (dem Ist-Abnutzungsvorrat) und '
      + 'ihrem vorhergesagten Abnutzungsverlauf ab. Planungsgrundlage für Instandhaltungs'
      + 'maßnahmen sind die Durchführung eines Variantenvergleichs potenzieller Instandhaltungs'
      + 'maßnahmen, die Berücksichtigung einer vorgegebenen Nutzungsdauer sowie die Vorgabe '
      + 'eines Rest- bzw. Mindest-Abnutzungsvorrats.', y);

    y += 2;
    y = renderH3sub(doc, 'c) Steuerliche Relevanz', y);
    y = renderParagraph(doc,
      'Die gesetzlichen Sätze für Absetzungen für Abnutzung (AfA) von 2% bzw. 2,5% sind von '
      + 'einer generellen Nutzungsdauer von 50 Jahren (bzw. 40 Jahren bei Gebäude-'
      + 'Fertigstellungen vor 1925) abgeleitet und gelten als Normalfall. Die Ermittlung der '
      + 'tatsächlichen Nutzungsdauer ist wesentliche Voraussetzung zur Anwendung von § 7 Abs. 4 '
      + 'Satz 2 EStG. Die Ermittlung der tatsächlich (kürzeren) Nutzungsdauer entsprechenden '
      + '(höheren) Absetzung für Abnutzung (AfA) dienen.', y);
  }

  // ============================================================
  // GND-TABELLEN (Anlage 22 BewG / SW-RL / BelWertV)
  // ============================================================
  function _gndTabelleHeader() {
    return [
      [{ content: 'Gebäudeart', rowSpan: 2 },
       { content: 'Empfehlung', rowSpan: 2 },
       { content: 'nach SW-RL', colSpan: 2, styles: { halign: 'center' } },
       { content: 'nach BelWertV', rowSpan: 2 },
       { content: 'nach BewG (Anlage 22)', rowSpan: 2 }],
      [{ content: 'MW', styles: { halign: 'center' } },
       { content: '+/-', styles: { halign: 'center' } }]
    ];
  }
  function _gndStyles() {
    return {
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4,
                lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
      headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text, fontStyle: 'bold',
                    halign: 'center', valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' }
      },
      margin: { left: ML, right: MR }
    };
  }

  function renderGndTabelleTeil1(doc, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    doc.autoTable(Object.assign(_gndStyles(), {
      startY: y,
      head: _gndTabelleHeader(),
      body: [
        [{ content: 'Freistehende Ein- und Zweifamilienhäuser, Doppel- und Reihenhäuser',
           styles: { fontStyle: 'bold' } }, '50 – 100', '', '', '25 – 80', '70'],
        ['Standardstufe 1', '50 – 65', '60', '', '', ''],
        ['Standardstufe 2', '50 – 70', '65', '', '', ''],
        ['Standardstufe 3', '60 – 75', '70', '', '', ''],
        ['Standardstufe 4', '60 – 80', '75', '', '', ''],
        ['Standardstufe 5', '60 – 100', '80', '', '', ''],
        [{ content: 'Mehrfamilienhäuser (Mietwohngebäude)',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Mehrfamilienhäuser', '30 – 80', '70', '+/- 10', '25 – 80', '70'],
        ['Wohnhäuser mit Mischnutzung', '30 – 80', '70', '+/- 10', '', '70'],
        [{ content: 'Büro- und Verwaltungsgebäude, Geschäftshäuser',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Geschäftshäuser', '30 – 70', '60', '+/- 10', '30 – 60', '60'],
        ['Bürogebäude', '30 – 70', '60', '+/- 10', '30 – 60', '60'],
        ['Banken', '50 – 70', '60', '+/- 10', '30 – 60', '60'],
        ['Gemeindezentren', '30 – 60', '40', '+/- 10', '', '40']
      ]
    }));
    return doc.lastAutoTable.finalY + 4;
  }
  function renderGndTabelleTeil2(doc, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    doc.autoTable(Object.assign(_gndStyles(), {
      startY: y,
      head: _gndTabelleHeader(),
      body: [
        [{ content: 'Saalbauten / Veranstaltungsgebäude',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Vereinsheime', '', '', '', '', '40'],
        ['Ausstellungsgebäude', '30 – 60', '', '', '', '50'],
        ['Museen, Theater', '', '60', '', '', '70'],
        ['Kindergärten, Kindertagesstätten', '30 – 50', '50', '+/- 10', '', '50'],
        ['Schulen', '', '50', '+/- 10', '', ''],
        ['Allgemeinbildende und Berufsschulen', '40 – 60', '', '', '', '50'],
        ['Hochschulen, Universitäten', '50 – 60', '', '', '', '50'],
        ['Wohnheime, Internate, Alten- und Pflegeheime', '40 – 70', '50', '+/- 10', '', '50'],
        ['Krankenhäuser, Tageskliniken, Ärztehäuser', '', '40', '+/- 10', '15 – 40', '40'],
        ['Sanatorien, Kliniken', '40 – 50', '', '', '15 – 40', '40'],
        ['Reha-Einrichtungen', '40 – 60', '40', '+/- 10', '15 – 40', '40'],
        [{ content: 'Beherbergung / Verpflegung', styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Hotels', '40 – 50', '', '', '15 – 40', '40'],
        ['Budgethotels', '35 – 45', '', '', '', ''],
        ['Gaststätten', '20 – 40', '', '', '15 – 40', ''],
        [{ content: 'Sporthallen, Bäder', styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Sporthallen / Freizeitbäder / Heilbäder', '', '40', '+/- 10', '15 – 30', '40'],
        ['Tennishallen', '30 – 50', '', '', '15 – 30', '40'],
        ['Sporthallen (Turnhallen)', '50 – 60', '', '', '15 – 30', '40'],
        ['Funktionsgebäude für Sportanlagen', '40 – 60', '', '', '15 – 30', '40'],
        ['Hallenbäder, Kur- und Heilbäder', '40 – 60', '', '', '15 – 30', '40'],
        ['Reitsporthalle', '30', '', '', '15 – 30', '30']
      ]
    }));
    return doc.lastAutoTable.finalY + 4;
  }
  function renderGndTabelleTeil3(doc, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    doc.autoTable(Object.assign(_gndStyles(), {
      startY: y,
      head: _gndTabelleHeader(),
      body: [
        [{ content: 'Verbrauchermärkte, Kauf-, Waren- und Autohäuser',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Verbrauchermärkte, Autohäuser', '20 – 40', '30', '+/- 10', '10 – 30', '30'],
        ['Kauf- und Warenhäuser', '20 – 50', '50', '+/- 10', '15 – 50', '50'],
        ['Campingplätze (bauliche Anlagen)', '30 – 40', '', '', '', ''],
        [{ content: 'Garagen / Parkhäuser / Tiefgaragen',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Fertigteilreihengarage leichte Bauweise', '30 – 40', '', '', '', ''],
        ['Massivfertigteilreihengaragen', '60', '', '', '', ''],
        ['Einzelgarage', '50 – 60', '60', '+/- 10', '', '60'],
        ['Mehrfachgarage', '60', '', '', '', ''],
        ['Parkhäuser (offene Ausführung)', '40', '', '', '15 – 40', '40'],
        ['Parkhäuser (geschlossene Ausführung)', '40', '', '', '15 – 40', '40'],
        ['Tief- und Hochgarage, Carports', '40', '40', '+/- 10', '', '40'],
        ['Tankstelle', '10 – 20', '', '', '10 – 30', ''],
        ['Kirchen, Kapellen, Friedhofsgebäude', '50 – 150', '', '', '', '70'],
        [{ content: 'Industrie- und Lagergebäude',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Betriebs- und Werkstätten', '30 – 50', '40', '+/- 10', '15 – 40', '40'],
        ['Gewerbe- und Industriegebäude', '40 – 50', '40', '+/- 10', '15 – 40', '40'],
        ['Lager- und Versandgebäude', '', '40', '+/- 10', '15 – 40', '40'],
        ['Lager- und Logistikgebäude', '30 – 50', '', '', '15 – 40', '40'],
        ['Warm- und Kaltlager mit Büro', '20 – 30', '', '', '15 – 40', '40'],
        ['Windkraftwerke', '15 – 20', '', '', '', '']
      ]
    }));
    return doc.lastAutoTable.finalY + 4;
  }
  function renderGndTabelleTeil4(doc, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    doc.autoTable(Object.assign(_gndStyles(), {
      startY: y,
      head: _gndTabelleHeader(),
      body: [
        [{ content: 'Landwirtschaftliche Betriebsgebäude',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Landwirtschaftl. Betriebsgebäude (allg.)', '', '30', '+/- 10', '15 – 40', ''],
        ['Scheune ohne Stallteil', '40 – 50', '', '', '', ''],
        ['Mehrzweck- und Maschinenhallen', '40', '', '', '', ''],
        ['Stallgebäude (allgemein)', '15 – 25', '', '', '', ''],
        ['Pferde-, Rinder-, Schweine-, Geflügelställe', '30', '', '', '', ''],
        ['Lauben, Wochenend- und Gartenhäuser', '30 – 60', '', '', '', ''],
        [{ content: 'Außenanlagen / Außenmauern',
           styles: { fontStyle: 'bold' }, colSpan: 6 }],
        ['Außenanlagen', '40 – 60', '', '', '', ''],
        ['Außenwände, Stahlfachwerk mit Ziegelsteinen', '50 – 60', '', '', '', ''],
        ['Stahlkonstruktion mit ungeschützten Außenflächen', '30 – 40', '', '', '', ''],
        ['Außenverkleidung Trapezbleche auf Stahlstielen', '30 – 40', '', '', '', ''],
        ['Außenverkleidung verzinktes Wellblech', '25 – 30', '', '', '', '']
      ]
    }));
    let yy = doc.lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, COLORS.muted);
    const fn = doc.splitTextToSize(
      '* Bei bloßer Instandhaltung können sich auch kürzere Nutzungsdauern ergeben; vgl. BMF '
      + 'vom 16.03.1992 (BStBl I 1992, 230).\n'
      + '** Unter Berücksichtigung angemessener Modernisierungen.\n'
      + '*** Nicht mehr in KL-V (8); Fundstelle: KL-V (7), S. 863.', CONTENT_W);
    doc.text(fn, ML, yy);
    return yy + fn.length * 3.4;
  }

  // ============================================================
  // BTE-LEBENSDAUERKATALOG (vollständig — über mehrere Seiten)
  // ============================================================
  function renderBTETabelleAlle(doc, data, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    if (!global.DealPilotRND_BTE || !global.DealPilotRND_BTE.BTE) return y + 10;

    // BTE-Daten in Hauptkategorien-Reihenfolge gruppieren wie im Original
    const ORDER = [
      'Fenster', 'Abdeckungen',
      'Innenwände', 'Wandbekleidung', 'Anstriche', 'Innentüren',
      'Decken', 'Estrich', 'Böden', 'Bodenschutz', 'Deckenbekleidung',
      'Treppen', 'Balkone',
      'Flachdach', 'Dach', 'Dachdämmung', 'Dachdeckung', 'Dachöffnungen',
      'Entwässerung', 'Dachzubehör', 'Schornstein',
      'Abwasser', 'Wasserleitungen', 'Sanitär', 'Warmwasser', 'Gas',
      'Heizung', 'Heizkörper',
      'Lüftung',
      'Elektro', 'Schwachstrom', 'Photovoltaik',
      'Aufzüge',
      'Außenbelag', 'Einfriedung', 'Einbauten', 'Abwasser außen'
    ];
    const grouped = {};
    global.DealPilotRND_BTE.BTE.forEach(function (b) {
      if (!grouped[b.cat]) grouped[b.cat] = [];
      grouped[b.cat].push(b);
    });

    // Eine flache Reihen-Liste mit Section-Headern
    const allRows = [];
    ORDER.forEach(function (cat) {
      if (!grouped[cat] || grouped[cat].length === 0) return;
      allRows.push({ section: cat });
      grouped[cat].forEach(function (b) {
        allRows.push({
          code: b.code,
          label: b.label,
          mw: b.mw
        });
      });
    });

    // In ~25er Häppchen pro Seite ausgeben (Original hat 7 Tabellenseiten)
    const PER_PAGE = 25;
    let cursor = 0;
    let isFirstChunk = true;
    while (cursor < allRows.length) {
      if (!isFirstChunk) { addPageWithHeader(doc, data); y = MT; }
      const chunk = allRows.slice(cursor, cursor + PER_PAGE);
      const body = chunk.map(function (r) {
        if (r.section) {
          return [{ content: r.section,
                    styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }, colSpan: 3 }];
        }
        return [r.code, r.label, String(r.mw)];
      });
      doc.autoTable({
        startY: y,
        head: [['Code', 'Bauteil', 'MW (J.)']],
        body: body,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5,
                  lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
        headStyles: { fillColor: [60, 110, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 22, halign: 'right' }
        },
        margin: { left: ML, right: MR }
      });
      y = doc.lastAutoTable.finalY + 4;
      cursor += PER_PAGE;
      isFirstChunk = false;
    }
    return y;
  }

  // ============================================================
  // KAPITEL 4: VERFAHRENSARTEN
  // ============================================================
  function renderKapitel4(doc, data, result) {
    let y = MT;
    y = renderH1(doc, '4.    Verfahrensarten', y);

    y = renderH2(doc, '4.1   Allgemeine Erläuterung', y);
    y = renderParagraph(doc,
      'Die Alterswertminderung bezeichnet die Wertminderung einer Sache während ihrer '
      + 'Lebensdauer bzw. Gesamtnutzungsdauer aufgrund von Verschleiß, Abnutzung, Verbrauch '
      + 'oder sonstigen Alterungsvorgängen.', y);
    y = renderParagraph(doc,
      'Da die tatsächliche Alterswertminderung erst in der Retrospektive genau festgestellt '
      + 'werden kann, behilft man sich für die Zwecke einer Vorhersage verschiedener '
      + 'Näherungsverfahren. Diese Näherungsverfahren werden in Folge zunächst grafisch '
      + 'dargestellt und anschließend erläutert. Je nach angewendetem Verfahren verbleibt am '
      + 'Ende der Lebensdauer noch ein Restwert.', y);

    // Diagramm: 4 Verfahren über die Lebensdauer (säulenchartähnlich wie im Original)
    y += 2;
    y = renderVerfahrensDiagramm(doc, y);

    y = renderParagraph(doc,
      'In den Formeln der folgenden Abschnitte werden folgende Bezeichnungen verwendet:', y);
    y += 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('A = Alter', ML + 8, y); y += 5;
    doc.text('G = Gesamtnutzungsdauer', ML + 8, y); y += 7;

    addPageWithHeader(doc, data); y = MT;

    y = renderH2(doc, '4.2   Lineare Alterswertminderung', y);
    y = renderParagraph(doc,
      'Bei diesem Verfahren wird angenommen, dass der Wert einer Sache bei der Entstehung zu '
      + '100% vorhanden ist und dann im Verlauf der Lebensdauer gleichmäßig abnimmt.', y);
    y = renderFormula(doc, 'w = A / G × 100', y);
    y = renderParagraph(doc,
      'Die Restnutzungsdauer ergibt sich aus der Differenz zwischen der Gesamtnutzungsdauer '
      + 'und dem Alter der Immobilie.', y);

    y += 3;
    y = renderH2(doc, '4.3   Alterswertminderung nach Vogels', y);
    y = renderParagraph(doc,
      'Dieses Verfahren beruht auf empirischen Untersuchungen von Kaufpreisen. Zur Berechnung '
      + 'der Alterswertminderung gilt es grundsätzlich zwei gesetzliche Grundlagen: ImmoWertV '
      + '§ 38 und SW-RL Nr. 4.3. Der Alterswertminderungsfaktor entstammt dem § 38 ImmoWertV, '
      + 'wonach dieser aus dem Verhältnis der Restnutzungsdauer zu Gesamtnutzungsdauer der '
      + 'Immobilie bestimmt ist. Die Sachwertrichtlinie SW-RL Nr. 4.3 ersetzt die Bestimmung der '
      + 'WertR2006 (Nr. 3.6.1.1.7). Am Ende der Gesamtnutzungsdauer ist hier noch ein Restwert '
      + 'von 20% vorhanden.', y);
    y = renderFormula(doc, 'w = (-0,4 × (A/G)² + 1,2 × (A/G)) × 100', y);

    y += 3;
    y = renderH2(doc, '4.4   Alterswertminderung nach Ross', y);
    y = renderParagraph(doc,
      'Diesem Verfahren liegt die Überlegung zugrunde, dass der Wertverlust in den ersten '
      + 'Jahren deutlich geringer ist als in den späteren Jahren.', y);
    y = renderFormula(doc, 'w = ½ × ((A/G)² + (A/G)) × 100', y);
    y = renderParagraph(doc,
      'Diese Ross\'sche Formel fand über 100 Jahre lang Verwendung bei Wertermittlungen in der '
      + 'Immobilienwirtschaft. Da eine derart gestaltete Alterswertminderung nicht objektiv '
      + 'begründbar ist, wurde sie in der ImmoWertV nicht mehr aufgenommen.', y);

    y += 3;
    y = renderH2(doc, '4.5   Parabelförmige Wertminderung', y);
    y = renderParagraph(doc,
      'Bei diesem Verfahren hat die Alterswertminderung einen parabelförmigen Verlauf. Ähnlich '
      + 'wie der Alterswertminderung nach Ross liegt auch diesem Verfahren die Überlegung '
      + 'zugrunde, dass der Wertverlust in den ersten Jahren deutlich geringer ist als in den '
      + 'späteren Jahren – wenn auch mit unterschiedlich starker Ausprägung.', y);
    y = renderFormula(doc, 'w = (A/G)² × 100', y);

    addPageWithHeader(doc, data); y = MT;

    y = renderH2(doc, '4.6   Punktrastermethode', y);
    y = renderH3sub(doc, 'a) Bestimmung des Modernisierungsgrades', y);
    y = renderParagraph(doc,
      'Zur Bestimmung des Modernisierungsgrades, insbesondere unter Berücksichtigung von '
      + 'durchgeführten wesentlichen Modernisierungsmaßnahmen, wird ein Punktemodell in '
      + 'Anlehnung an Anlage 2 zu § 12 Absatz 5 Satz 1 ImmoWertV als Orientierung verwendet.', y);
    y = renderParagraph(doc,
      'Es wird eine maximal erreichbare Punktzahl von 20 verteilt auf einzelne '
      + 'Modernisierungselemente:', y);
    y += 1;

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y,
        head: [['Modernisierungselemente', 'Maximal zu vergebende Punkte']],
        body: [
          ['Dacherneuerung inkl. Verbesserung der Wärmedämmung', '4'],
          ['Modernisierung der Fenster und Außentüren', '2'],
          ['Modernisierung der Leitungssysteme (Strom, Gas, Wasser, Abwasser)', '2'],
          ['Modernisierung der Heizungsanlage', '2'],
          ['Wärmedämmung der Außenwände', '4'],
          ['Modernisierung von Bädern', '2'],
          ['Modernisierung des Innenausbaus, z.B. Decken, Fußböden, Treppen', '2'],
          ['Wesentliche Verbesserung der Grundrissgestaltung', '2'],
          [{ content: 'Gesamt', styles: { fontStyle: 'bold' } },
           { content: '20', styles: { fontStyle: 'bold' } }]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2,
                  lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
        headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 110 },
          1: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: ML, right: MR }
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    addPageWithHeader(doc, data); y = MT;

    y = renderH3sub(doc, 'b) Ermittlung der Gesamtpunktzahl für den Modernisierungsgrad', y);
    y = renderParagraph(doc,
      'Aus den für die einzelnen Modernisierungselemente vergebenen Punkten wird eine '
      + 'Gesamtpunktzahl für die Modernisierung (Modernisierungspunkte) gebildet:', y);
    y += 1;

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y,
        head: [['Gesamtpunktzahl', 'Modernisierungsgrad']],
        body: [
          ['0 – 1', 'nicht modernisiert'],
          ['2 – 5', 'kleine Modernisierungen im Rahmen der Instandhaltung'],
          ['6 – 10', 'mittlerer Modernisierungsgrad'],
          ['11 – 17', 'überwiegend modernisiert'],
          ['18 – 20', 'umfassend modernisiert']
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2,
                  lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
        headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 'auto' }
        },
        margin: { left: ML, right: MR }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    y = renderH3sub(doc, 'c) Berechnung der Restnutzungsdauer', y);
    y = renderParagraph(doc,
      'Der Ermittlung der Restnutzungsdauer im Fall von Modernisierungen liegt ein theoretischer '
      + 'Modellansatz zugrunde (Anlage 2, II.2 zu § 12 Abs. 5 Satz 1 ImmoWertV). Das Modell '
      + 'geht davon aus, dass die Restnutzungsdauer auf maximal 70% (bei kernsanierten Objekten '
      + 'bis zu 90%) der jeweiligen Gesamtnutzungsdauer gestreckt und nach der folgenden Formel '
      + 'berechnet wird:', y);
    y += 1;
    y = renderFormula(doc, 'RND = (a × A² / G) - b × A + c × G', y);
    y = renderParagraph(doc, 'Die entsprechenden Werte für a, b und c lauten:', y);

    addPageWithHeader(doc, data); y = MT;

    // Punktraster-Koeffiziententabelle
    y = renderH3sub(doc, 'Koeffizienten der Punktrastermethode', y);
    if (typeof doc.autoTable === 'function') {
      const KOEFF = global.DealPilotRND.PUNKTRASTER_KOEFF;
      const body = [];
      KOEFF.forEach(function (k, i) {
        body.push([
          String(i),
          k.a.toFixed(4).replace('.', ','),
          k.b.toFixed(4).replace('.', ','),
          k.c.toFixed(4).replace('.', ','),
          k.rel + ' %'
        ]);
      });
      doc.autoTable({
        startY: y,
        head: [['Modernisierungs-\npunkte', 'a', 'b', 'c', 'ab einem rel.\nAlter von']],
        body: body,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6,
                  lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
        headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text, fontStyle: 'bold',
                      halign: 'center' },
        columnStyles: {
          0: { cellWidth: 32, halign: 'center' },
          1: { cellWidth: 28, halign: 'center' },
          2: { cellWidth: 28, halign: 'center' },
          3: { cellWidth: 28, halign: 'center' },
          4: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: ML, right: MR }
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text('(Werte auf 4 Nachkommastellen gerundet)', A4_W / 2, y, { align: 'center' });
    y += 8;
    doc.setTextColor.apply(doc, COLORS.text);

    y = renderParagraph(doc,
      'Dabei ist zu beachten, dass Modernisierungen erst ab einem bestimmten Alter der baulichen '
      + 'Anlagen Auswirkungen auf die Restnutzungsdauer haben. Aus diesem Grund ist die Formel '
      + 'in Abhängigkeit von der anzusetzenden Gesamtnutzungsdauer erst ab einem bestimmten '
      + 'Alter (relatives Alter) anwendbar. Das relative Alter wird nach der folgenden Formel '
      + 'ermittelt:', y);
    y = renderFormula(doc, 'rel. Alter = Alter / GND × 100 %', y);

    addPageWithHeader(doc, data); y = MT;

    y = renderH2(doc, '4.7   Technische Alterswertminderung', y);
    y = renderParagraph(doc,
      'Die Restnutzungsdauer nach technischer Alterswertminderung wird in der Regel auf '
      + 'Grundlage des Unterschiedsbetrags zwischen der Gesamtnutzungsdauer und dem Alter der '
      + 'baulichen Anlage am maßgeblichen Stichtag unter Berücksichtigung individueller '
      + 'Gegebenheiten des Wertermittlungsobjekts ermittelt.', y);
    y = renderParagraph(doc,
      'Die technische Nutzungsdauer beschreibt die maximal mögliche Lebenszeit eines '
      + 'Investitionsguts aus technischer Sicht (nach wie vielen Jahren ist z.B. das Gebäude '
      + 'oder PKW „kaputt"?). Die technische Nutzungsdauer stellt die Höchstgrenze bei der '
      + 'Bestimmung der Nutzungsdauer für die Absetzungen für Abnutzung (AfA), umgangssprachlich '
      + '„Abschreibung", dar.', y);
    y = renderParagraph(doc,
      'Die technische Lebensdauer von Gebäuden hängt unter anderem von folgenden Einflussfaktoren '
      + 'ab:', y);
    y = renderBullet(doc, 'Baustoffqualität, Ausführungsqualität (z.B. Zusammenbau und Montage)', y);
    y = renderBullet(doc, 'Natürliche Einflussfaktoren (z.B. Wind, Niederschlag, Luftfeuchtigkeit, '
                          + 'Globalstrahlung)', y);
    y = renderBullet(doc, 'Menschliche Einflussfaktoren (z.B. Abnutzung durch Gebrauch)', y);
    y = renderBullet(doc, 'Beziehungen zwischen den Bauelementen (z.B. durch Schutzmechanismen '
                          + 'wie Anstriche auf Holz oder Kontaktkorrosion verschiedener Metalle)', y);
    y = renderBullet(doc, 'Instandhaltung (z.B. Wartungsarbeiten wie Reinigen, Konservieren, '
                          + 'Schmieren oder Instandsetzungsarbeiten)', y);
    y += 2;
    y = renderParagraph(doc,
      'Die technische Restnutzungsdauer wird z.B. über Bausubstanzgutachten oder durch Anwendung '
      + 'des Verfahrens zur Ermittlung des Abnutzungsvorrats von Baustoffen (ERAB) bestimmt. '
      + 'Dieses definiert mit Hilfe qualitäts- und schadensbezogener Merkmale sowie zugehöriger '
      + 'Merkmalsausprägungen einen baustoffspezifischen Wert – den Abnutzungsvorrat.', y);

    addPageWithHeader(doc, data); y = MT;

    y = renderH2(doc, '4.8   Ermittlungsverfahren und Betrachtungsweisen', y);
    y = renderParagraph(doc,
      'Da die voraussichtliche Nutzungsdauer die Zukunft betrifft, kann sie nur durch Schätzung '
      + 'ermittelt werden, wobei es hierzu unterschiedliche Verfahren gibt und Erfahrungswerte '
      + 'zu berücksichtigen sind. In erster Näherung wird als Restnutzungsdauer meist die '
      + 'Differenz aus „üblicher Gesamtnutzungsdauer" abzüglich „tatsächlichem Lebensalter am '
      + 'Wertermittlungsstichtag" zugrunde gelegt.', y);
    y = renderParagraph(doc, 'Die Restnutzungsdauer kann also grundsätzlich nach der Regelfallformel', y);
    y = renderFormula(doc, 'Restnutzungsdauer (RND) = Gesamtnutzungsdauer (GND) – Gebäudealter (GA)', y);
    y = renderParagraph(doc,
      'ermittelt werden. In der Detailbetrachtung wird im Wesentlichen unterschieden zwischen '
      + 'der technischen Restnutzungsdauer und der wirtschaftlichen Restnutzungsdauer:', y);

    y += 2;
    y = renderH3sub(doc, 'a) Wirtschaftliche Nutzungsdauer', y);
    y = renderParagraph(doc,
      'Die wirtschaftliche Nutzungsdauer umfasst den Zeitraum, in dem das Wirtschaftsgut rentabel '
      + 'genutzt werden kann. Sie ist daher per Definition nie höher als die technische '
      + 'Nutzungsdauer. Sie kann aber durchaus gegenüber der technischen Nutzungsdauer verkürzt '
      + 'sein. Dies ist der Fall, wenn das Wirtschaftsgut – unabhängig von seinem materiellen '
      + 'Verschleiß – erfahrungsgemäß wirtschaftlich zur Erzielung von üblichen positiven '
      + 'Einkünften nicht mehr verwendbar ist. Im Falle vermieteter Immobilien ist dies z.B. '
      + 'der Fall, wenn die Immobilie nicht mehr zur Erzielung einer ortsüblichen Miete geeignet '
      + 'ist, da sie nicht mehr den Anforderungen entsprechen, die an derartige Räumlichkeiten '
      + 'gestellt werden. Man spricht dann von „wirtschaftlicher Überalterung".', y);
    y = renderParagraph(doc,
      'Hintergrund ist die Verzinsung des im Objekt gebundenen Kapitals. Erreicht der Ertragswert '
      + 'des Objekts (aufgrund von Überalterung) keine Kapitalverzinsung mehr, die der Verzinsung '
      + '„vergleichbarer Objekte zu marktüblichen Konditionen" entspricht, so ist von einer '
      + 'Marktgängigkeit nicht mehr auszugehen – und die Grenze der wirtschaftlichen Nutzbarkeit '
      + '(Nutzungsdauer) ist erreicht.', y);
    y = renderParagraph(doc,
      'Gründe dafür können z.B. ein Wandel in den Präferenzen der Mieter, die Entwicklung der '
      + 'Kapital- und Mietmärkte, die Entwicklung neuer Wohn- und Arbeitsformen sein. '
      + 'Wirtschaftlich abgenutzt ist alles, was veraltet ist.', y);

    addPageWithHeader(doc, data); y = MT;

    y = renderParagraph(doc,
      'Die Bestimmung der wirtschaftlichen Restnutzungsdauer von Gebäuden findet meist in '
      + 'Anlehnung an § 4 Abs. 3 Satz 1 ImmoWertV statt:', y);
    y += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const zitat = doc.splitTextToSize(
      'Die Restnutzungsdauer bezeichnet die Anzahl der Jahre, in denen eine bauliche Anlage bei '
      + 'ordnungsgemäßer Bewirtschaftung voraussichtlich noch wirtschaftlich genutzt werden kann. '
      + 'Die Restnutzungsdauer wird in der Regel auf Grundlage des Unterschiedsbetrags zwischen '
      + 'der Gesamtnutzungsdauer und dem Alter der baulichen Anlage am maßgeblichen Stichtag '
      + 'unter Berücksichtigung individueller Gegebenheiten des Wertermittlungsobjekts wie '
      + 'beispielsweise durchgeführte Instandhaltungen des Wertermittlungsobjekts können die '
      + 'sich aus dem Unterschiedsbetrag nach Satz 2 ergebende Dauer verlängern oder verkürzen.',
      CONTENT_W - 6);
    doc.text(zitat, ML + 4, y);
    y += zitat.length * 4.4 + 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor.apply(doc, COLORS.text);
    y = renderParagraph(doc,
      'Die nach der Regelfallformel (RND = GND – GA) ermittelte Restnutzungsdauer wird also '
      + 'verlängert (d.h. das Gebäude fiktiv verjüngt), wenn beim Bewertungsobjekt wesentliche '
      + 'Modernisierungsmaßnahmen durchgeführt wurden oder in den Wertermittlungsansätzen '
      + 'unmittelbar erforderliche Arbeiten zur Beseitigung des Unterhaltungsstaus sowie zur '
      + 'Modernisierung als bereits durchgeführt unterstellt werden.', y);
    y = renderParagraph(doc,
      'Modernisierungen sind beispielweise Maßnahmen, die eine wesentliche Verbesserung der '
      + 'Wohn- und sonstigen Nutzungsverhältnisse oder wesentliche Einsparungen von Energie '
      + 'oder Wasser bewirken. Im Detail wird also eine Reihe von Umständen des Gebäudes '
      + 'begutachtet, die aus technischen oder wirtschaftlichen Gesichtspunkten die '
      + 'Nutzungsdauer beeinflussen.', y);

    y += 2;
    y = renderH3sub(doc, 'b) Verfahrenswahl', y);
    y = renderParagraph(doc,
      'Nach Abwägung, reiflicher Überlegung sowie in Kenntnis und Auswertung der unterschiedlichen '
      + 'Ermittlungsverfahren sowie der einschlägigen Kataloge zu den Lebensdauern von Bauteilen '
      + 'wird das „Modell zur Ermittlung der Restnutzungsdauer von Wohngebäuden bei '
      + 'Modernisierungen" gemäß Anlage 2 (zu § 12 Absatz 5 Satz 1) ImmoWertV zur Ermittlung der '
      + 'Nutzungsdauer für das geeignetste Verfahren gehalten, da dies eine sachgerechte und '
      + 'fundierte Ermittlung sowie die erforderliche sachverständige Würdigung des Einzelfalls '
      + 'ermöglicht.', y);

    y += 2;
    y = renderH3sub(doc, 'c) Grundsätze der Begutachtung', y);
    y = renderParagraph(doc,
      'Diese Beschreibung beschränkt sich auf die wesentlichen, wertbestimmenden und langlebigen '
      + 'Bauteile. Sie gibt den optisch erkennbaren Gebäudezustand wieder. Bezogen auf den '
      + 'zurückliegenden Wertermittlungsstichtag entspricht bzw. die Angaben des Auftraggebers '
      + 'zur Situation zum Wertermittlungsstichtag der Wahrheit entsprechen.', y);
    y = renderParagraph(doc,
      'Es wird darauf hingewiesen, dass weitergehende Untersuchungen bezüglich Standsicherheit, '
      + 'Schall- und Wärmeschutz, Befall durch Schädlinge und Korrosion in Rohrleitungen nicht '
      + 'vorgenommen wurden und vom Gutachter keine Bauteilöffnungen und keine Funktionsprüfungen '
      + 'der technischen Einrichtungen (Heizung, Ver- und Entsorgung, Elektro usw.) vorgenommen '
      + 'wurden.', y);
  }

  // ============================================================
  // ============================================================
  // VERFAHRENSDIAGRAMM (Kap. 4.1) — 4 Verfahren über Lebensdauer
  // ============================================================
  function renderVerfahrensDiagramm(doc, y) {
    const chartH = 70;
    const chartY = y;
    const chartX = ML + 8;
    const chartW = CONTENT_W - 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, COLORS.text);

    const legend = [
      { color: [180, 60, 60],   label: 'lineare Alterswertminderung' },
      { color: [200, 168, 76],  label: 'Alterswertminderung nach Vogels' },
      { color: [240, 220, 130], label: 'Alterswertminderung nach Ross' },
      { color: [180, 220, 180], label: 'Parabelförmige Wertminderung' }
    ];
    let legY = chartY + 2;
    legend.forEach(function (item, i) {
      const lx = chartX + (i % 2) * (chartW / 2);
      const ly = legY + Math.floor(i / 2) * 5;
      doc.setFillColor.apply(doc, item.color);
      doc.rect(lx, ly - 2.5, 3, 3, 'F');
      doc.text(item.label, lx + 5, ly);
    });
    const plotY = chartY + 14;
    const plotH = chartH - 18;

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.2);
    doc.line(chartX, plotY, chartX, plotY + plotH);
    doc.line(chartX, plotY + plotH, chartX + chartW, plotY + plotH);
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COLORS.muted);
    [0, 20, 40, 60, 80, 100].forEach(function (v) {
      const yy = plotY + plotH - (v / 100) * plotH;
      doc.text(String(v), chartX - 6, yy + 1);
      doc.setDrawColor(230, 230, 230);
      doc.line(chartX, yy, chartX + chartW, yy);
    });

    const ages = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const G = 100;
    const groupW = chartW / ages.length;
    const barW = groupW / 5;
    ages.forEach(function (A, idx) {
      const xCenter = chartX + idx * groupW + groupW / 2;
      const ratio = A / G;
      const wLin = Math.max(0, 100 - ratio * 100);
      const wVog = Math.max(0, 100 - (-0.4 * ratio * ratio + 1.2 * ratio) * 100);
      const wRoss = Math.max(0, 100 - 0.5 * (ratio * ratio + ratio) * 100);
      const wPar = Math.max(0, 100 - ratio * ratio * 100);

      const draws = [
        { v: wLin,  c: [180, 60, 60] },
        { v: wVog,  c: [200, 168, 76] },
        { v: wRoss, c: [240, 220, 130] },
        { v: wPar,  c: [180, 220, 180] }
      ];
      draws.forEach(function (d, i) {
        const bx = xCenter - 2 * barW + i * barW;
        const bh = (d.v / 100) * plotH;
        doc.setFillColor.apply(doc, d.c);
        doc.rect(bx, plotY + plotH - bh, barW * 0.8, bh, 'F');
      });
      doc.setTextColor.apply(doc, COLORS.muted);
      doc.setFontSize(7);
      doc.text(String(A), xCenter, plotY + plotH + 4, { align: 'center' });
    });
    doc.setTextColor.apply(doc, COLORS.text);
    doc.setFontSize(8);
    doc.text('Alter', chartX + chartW / 2, plotY + plotH + 9, { align: 'center' });

    return chartY + chartH + 6;
  }

  // ============================================================
  // KAPITEL 5: BERECHNUNG
  // ============================================================
  function renderKapitel5(doc, data, result) {
    let y = MT;
    y = renderH1(doc, '5.    Berechnung Restnutzungsdauer', y);
    const m = result.methods;

    y = renderH2(doc, '5.1   Lineare Restnutzungsdauer', y);
    y = renderH3sub(doc, 'Daten des Bewertungsobjektes:', y);
    y = renderKVList(doc, [
      ['Baujahr:', String(data.baujahr)],
      ['Bewertungsstichtag:', data.stichtag_str],
      ['Alter der Immobilie:', result.input.alter + ' Jahre'],
      ['Gesamtnutzungsdauer:', result.input.gnd + ' Jahre']
    ], y);

    y += 4;
    y = renderH3sub(doc, 'Berechnung lineare Abschreibung', y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text(result.input.alter + ' Jahre / ' + result.input.gnd + ' Jahre × 100 = '
      + global.DealPilotRND.fmtNum2(m.linear.alterswertminderung_pct) + ' %', ML, y);
    y += 7;

    y = renderH3sub(doc, 'Restnutzungsdauer linear', y);
    doc.setFont('helvetica', 'bold');
    doc.text(result.input.gnd + ' Jahre - ' + result.input.alter + ' Jahre = '
      + global.DealPilotRND.fmtNum2(m.linear.restnutzungsdauer) + ' Jahre', ML, y);
    y += 8;

    y = renderResultLine(doc,
      'Die lineare Alterswertminderung des Ermittlungsobjektes liegt bei '
      + global.DealPilotRND.fmtNum2(m.linear.alterswertminderung_pct) + ' %', y);
    y = renderResultLine(doc,
      'Die lineare Restnutzungsdauer beträgt: '
      + global.DealPilotRND.fmtNum2(m.linear.restnutzungsdauer) + ' Jahre', y);

    if (y > A4_H - MB - 90) { addPageWithHeader(doc, data); y = MT; }

    y += 6;
    y = renderH2(doc, '5.2   Punktrastermethode', y);
    y = renderModPunkteTable(doc, data, m.punktraster, y);

    y += 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Modernisierungsgrad des Bewertungsobjekts: ', ML, y);
    doc.setFont('helvetica', 'bold');
    doc.text(m.punktraster.modernisierungsgrad_text, ML + 78, y);
    y += 8;

    y = renderParagraph(doc,
      'Gemäß der unter Punkt 4.6 aufgeführten Tabellen ergibt sich für die Berechnung folgende Formel:',
      y);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    const formText = m.punktraster.formula;
    const lines = doc.splitTextToSize(formText, CONTENT_W);
    doc.text(lines, ML, y);
    y += lines.length * 5 + 4;

    doc.setFont('helvetica', 'normal');
    doc.text(result.input.gnd + ' Jahre - '
      + global.DealPilotRND.fmtNum2(m.punktraster.restnutzungsdauer) + ' Jahre = '
      + global.DealPilotRND.fmtNum2(result.input.gnd - m.punktraster.restnutzungsdauer) + ' Jahre',
      ML, y);
    y += 5;
    doc.text(result.input.gnd + ' Jahre / '
      + global.DealPilotRND.fmtNum2(result.input.gnd - m.punktraster.restnutzungsdauer)
      + ' Jahre × 100 = '
      + global.DealPilotRND.fmtNum2(m.punktraster.alterswertminderung_pct) + ' %', ML, y);
    y += 8;

    y = renderResultLine(doc,
      'Die vorläufige Alterswertminderung nach der Punktrastermethode liegt bei '
      + global.DealPilotRND.fmtNum2(m.punktraster.alterswertminderung_pct) + ' %', y);
    y = renderResultLine(doc,
      'Die vorläufige Restnutzungsdauer beträgt: '
      + global.DealPilotRND.fmtNum2(m.punktraster.restnutzungsdauer) + ' Jahre', y);

    addPageWithHeader(doc, data); y = MT;
    y = renderH2(doc, '5.3   Technische Restnutzungsdauer', y);

    y = renderH3sub(doc, '5.3.1 Zustand der Gewerke', y);
    y = renderZustandGewerke(doc, data, m.technisch, y);

    addPageWithHeader(doc, data); y = MT;

    y = renderH3sub(doc, '5.3.2 Bewertung der Ausstattung des Ermittlungsobjektes', y);
    y = renderGewerkeTable(doc, data, m.technisch, y);

    y += 2;
    y = renderZusammenfassungTable(doc, m.technisch, y);

    if (y > A4_H - MB - 80) { addPageWithHeader(doc, data); y = MT; }

    y += 4;
    y = renderH3sub(doc, '5.3.3 Restnutzungsdauer Objekt', y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Gewöhnliche Gesamtnutzungsdauer - Alter des Objekts = Restnutzungsdauer (RND)',
             ML, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(result.input.gnd + ' Jahre - ' + result.input.alter + ' Jahre = '
      + m.technisch.rnd_basis_linear + ' Jahre', A4_W / 2, y, { align: 'center' });
    y += 10;

    y = renderTechnDetailTable(doc, m.technisch, y);

    y += 4;
    y = renderH3sub(doc, 'Formel:', y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(m.technisch.formula, ML, y);
    y += 6;

    const altNew = result.input.gnd - m.technisch.restnutzungsdauer;
    doc.setFont('helvetica', 'normal');
    doc.text(global.DealPilotRND.fmtNum2(altNew) + ' Jahre / ' + result.input.gnd
      + ' Jahre × 100 = '
      + global.DealPilotRND.fmtNum2(m.technisch.alterswertminderung_pct) + ' %', ML, y);
    y += 7;

    y = renderH3sub(doc, 'Berechnung Restnutzungsdauer nach technischer Alterswertermittlung:', y);
    doc.setFont('helvetica', 'bold');
    doc.text(result.input.gnd + ' Jahre × '
      + global.DealPilotRND.fmtNum2(m.technisch.alterswertminderung_pct) + ' % = '
      + global.DealPilotRND.fmtNum2(altNew)
      + ' Jahre (Alter nach technischer Ermittlung)', ML, y);
    y += 5;
    doc.text(result.input.gnd + ' Jahre - ' + global.DealPilotRND.fmtNum2(altNew) + ' Jahre = '
      + global.DealPilotRND.fmtNum2(m.technisch.restnutzungsdauer) + ' Jahre Restnutzung',
      ML, y);
    y += 8;

    y = renderResultLine(doc,
      'Die vorläufige Alterswertminderung nach technischer Ermittlung liegt bei '
      + global.DealPilotRND.fmtNum2(m.technisch.alterswertminderung_pct) + ' %', y);
    y = renderResultLine(doc,
      'Die vorläufige Restnutzungsdauer beträgt: '
      + global.DealPilotRND.fmtNum2(m.technisch.restnutzungsdauer) + ' Jahre', y);

    // Schäden falls erfasst
    if (result.schaeden && result.schaeden.schaeden && result.schaeden.schaeden.length > 0) {
      if (y > A4_H - MB - 50) { addPageWithHeader(doc, data); y = MT; }
      y += 6;
      y = renderH3sub(doc, '5.3.4 Erfasste Mängel und Schäden', y);
      result.schaeden.schaeden.forEach(function (s) {
        y = renderBullet(doc, s.label + ' (orientierender Abschlag -' + s.abschlag + '%)', y);
      });
      if (result.schaeden.gesamtAbschlag_pct > 0) {
        y += 2;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor.apply(doc, COLORS.muted);
        doc.text('Gesamt-Schadensabschlag (theoretisch): -'
          + result.schaeden.gesamtAbschlag_pct + '%', ML, y);
        y += 5;
      }
    }

    // Kap. 5.4 Technische Angaben zum Tragwerk
    addPageWithHeader(doc, data); y = MT;
    y = renderH2(doc, '5.4   Technische Angaben zum Tragwerk', y);
    y = renderTragwerk(doc, data, result, y);
  }

  // ============================================================
  // KAP. 5.3.1 — Zustand der 8 Gewerke (1:1 Original-Layout)
  // ============================================================
  function renderZustandGewerke(doc, data, technisch, y) {
    const gw = (data.__gewerkeBewertung) || {};
    const sanierung = data.sanierungsumfang || {};

    function gewerkBlock(opts) {
      // opts: { titel, sanZeitraum, sanUmfang, ld, restld, energie }
      // y muss als Closure zugänglich sein → wir geben das y-Update zurück
      if (y > A4_H - MB - 35) { addPageWithHeader(doc, data); y = MT; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, COLORS.headerGreen);
      doc.text(opts.titel, ML, y);
      y += 5.5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, COLORS.text);
      doc.text('Sanierung – Modernisierung:', ML, y);
      doc.setFont('helvetica', 'normal');
      doc.text(opts.sanZeitraum, ML + 65, y);
      y += 4.5;

      doc.setFont('helvetica', 'bold');
      doc.text('Sanierungsumfang:', ML, y);
      doc.setFont('helvetica', 'normal');
      doc.text(opts.sanUmfang, ML + 65, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Durchschnittliche Lebensdauer', ML, y);
      // Unterstrichen wie im Original
      const tw = doc.getTextWidth('Durchschnittliche Lebensdauer');
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.2);
      doc.line(ML, y + 0.7, ML + tw, y + 0.7);
      y += 4.5;

      opts.ld.forEach(function (row) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(row[0] + ':', ML, y);
        doc.setFont('helvetica', 'normal');
        doc.text(row[1], ML + 65, y);
        y += 4.2;
      });

      opts.restld.forEach(function (row) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Restlebensdauer ' + row[0] + ':', ML, y);
        doc.setFont('helvetica', 'normal');
        doc.text(row[1], ML + 65, y);
        y += 4.2;
      });

      doc.setFont('helvetica', 'bold');
      doc.text('Energetische Verbesserung:', ML, y);
      doc.setFont('helvetica', 'normal');
      doc.text(opts.energie, ML + 65, y);
      y += 7;
    }

    // Mapping: Bewertung → Standard-Sanierung-Zeitraum + Umfang + Energie
    function defaultsFromGrad(grad) {
      switch (grad) {
        case 'gehoben':  return { zeit: '5-10 Jahre',   umfang: 'überwiegend', energie: 'überwiegend' };
        case 'standard': return { zeit: '10-20 Jahre',  umfang: 'mittel',       energie: 'mittel' };
        default:         return { zeit: '> 20 Jahre',   umfang: 'gering',       energie: 'gering' };
      }
    }

    // Helper zum Aufbau der einzelnen Gewerke
    function build(gewerk, titel, ld, restldKeys) {
      const grad = gw[gewerk] || 'standard';
      const def = defaultsFromGrad(grad);
      const ldArr = ld;  // [['Wärmedämmverbundsystem','35 Jahre'], ['Farbe','10 – 15 Jahre']]
      const restldArr = restldKeys.map(function (key) {
        // einfache Heuristik: bei "veraltet" < 5 Jahre, "standard" 5-15, "gehoben" 15-25
        let rl;
        if (grad === 'veraltet') rl = '< 5 Jahre';
        else if (grad === 'standard') rl = '< 15 Jahre';
        else rl = '< 25 Jahre';
        return [key, rl];
      });
      gewerkBlock({
        titel: titel,
        sanZeitraum: def.zeit,
        sanUmfang: def.umfang,
        ld: ldArr,
        restld: restldArr,
        energie: def.energie
      });
    }

    build('aussenwand', 'Außenwände inkl. Wärmedämmung',
      [['Wärmedämmverbundsystem', '35 Jahre'], ['Farbe', '10 – 15 Jahre']],
      ['Farbe']);

    build('dach', 'Dachkonstruktion inkl. Wärmedämmung',
      [['Dachbelag', '40 Jahre'], ['Dachstuhl', '80 Jahre']],
      ['Dachbelag', 'Dachstuhl']);

    build('decken', 'Deckenkonstruktionen inkl. Wärmedämmung',
      [['Geschossdecke', '100 Jahre']],
      ['Geschossdecke']);

    build('heizung', 'Heizungsanlage',
      [['Heizungsanlage', '25 Jahre']],
      ['Heizungsanlage']);

    build('leitungen', 'Leitungssysteme',
      [['Leitungen', '30 - 50 Jahre']],
      ['Leitungen']);

    build('baeder', 'Ausbau des Bades',
      [['Bad/Bäder', '30 Jahre']],
      ['Bad/Bäder']);

    build('fenster', 'Fenster und Außentüren',
      [['Fenster', '25 Jahre']],
      ['Fenster']);

    build('technik', 'Technische Ausstattung',
      [['Technische Ausstattung', '25 Jahre']],
      ['technische Ausstattung']);

    if (y > A4_H - MB - 30) { addPageWithHeader(doc, data); y = MT; }
    y += 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, COLORS.text);
    const summary = doc.splitTextToSize(
      'Die technische Abnutzung des Bewertungsobjekts ist entsprechend des Gebäudealters von '
      + 'ca. ' + (data.alter || '—') + ' Jahren. Es wurden folgende Mängel erfasst:', CONTENT_W);
    doc.text(summary, ML, y);
    y += summary.length * 4.4 + 1;

    // Mängel-Liste — entweder erfasste Schäden oder "altersgemäße Abnutzung"
    if (data.__schaeden && data.__schaeden.length > 0) {
      data.__schaeden.forEach(function (s) {
        y = renderBullet(doc, s, y);
      });
    } else {
      y = renderBullet(doc, 'altersgemäße Abnutzung', y);
    }

    y += 2;
    y = renderParagraph(doc,
      'Abgesehen davon wurde das Bewertungsobjekt laufend instandgehalten und es liegen auch '
      + 'sonst weder in der Baulichkeit noch in der Nutzungsintensität des Bewertungsobjekts '
      + 'Anhaltspunkte für weitere Anpassungen vor. Den festgestellten Mängeln kommt kein '
      + 'maßgeblicher Einfluss auf die zu ermittelnde Nutzungsdauer zu.', y);

    return y;
  }

  // ============================================================
  // KAP. 5.4 — Technische Angaben zum Tragwerk
  // ============================================================
  function renderTragwerk(doc, data, result, y) {
    const alter = result.input.alter;
    const baujahr = result.input.baujahr;
    const gnd = result.input.gnd;

    y = renderParagraph(doc,
      'Entsprechend der Ausführungen im Lebensdauerkatalog des Bundes Deutscher Experten (BTE) '
      + 'beträgt die Lebensdauer der tragenden Bauteile (Fundament, tragende Wände innen/außen, '
      + 'Decken und Dachstuhl) für die Art der hier betrachteten Immobilie ca. ' + gnd + ' Jahre. '
      + 'Gemäß DIN 31051 besitzen diese Bauteile ab Herstellung einen mit zunehmender Lebensdauer '
      + 'verschleißenden Abnutzungsvorrat, welcher durch Instandsetzung/Verbesserung ausgedehnt '
      + 'bzw. verlängert werden kann.', y);
    y = renderParagraph(doc,
      'Im Falle der hier betrachteten Immobilie fanden ab Herstellung im Jahre ' + baujahr + ' '
      + 'keine wesentlichen Sanierungen statt. Sofern es keine strukturellen Eingriffe an der '
      + 'Immobilie gab oder keine Information über Sanierungen/Modernisierungen vorliegen, '
      + 'behält sich der Sachverständige die Möglichkeit vor, ein durchschnittliches '
      + 'Sanierungsjahr mathematisch aufgrund der Begehung / technischen Betrachtung zu '
      + 'errechnen.', y);
    y = renderParagraph(doc,
      'Deutliche lebensdauer-verlängernde Maßnahmen wie beispielsweise Sanierungen/Kernsanierungen '
      + 'oder Ertüchtigungen der Tragelemente wurden jedoch nicht durchgeführt oder entsprechen '
      + 'nicht mehr den heutigen Standards und Gesetzlichkeiten (z.B. GEG 2023). Bei einem Alter '
      + 'von ' + alter + ' Jahren fanden im Laufe seiner Lebenszeit keine instandhaltenden '
      + 'Maßnahmen statt. Dadurch ist die anzunehmende restliche Lebensdauer der tragenden '
      + 'Bauteile als gering einzuschätzen.', y);
    y = renderParagraph(doc,
      'Der Verschleiß der tragenden Bauteile ist somit nachgewiesen. Die restliche '
      + 'Lebenserwartung der tragenden Teile spiegelt die angegebene Restnutzungsdauer der '
      + 'Immobilie wider.', y);
    y = renderParagraph(doc,
      'Aufgrund der Tatsache, dass die für die Restnutzungsdauer relevanten Faktoren, nämlich '
      + 'jene Faktoren, welche eine wirtschaftlich sinnvolle Weiternutzung des Gebäudes '
      + 'ermöglichen, hauptsächlich in der technischen Ausstattung begründet sind, findet die '
      + 'Lebensdauer der Tragwerke in den Berechnungen keine Betrachtung. Eine wirtschaftlich '
      + 'sinnvolle weitere Nutzung des Hauses ist lediglich bei gleichbleibenden/steigenden '
      + 'Erträgen zu erwarten. Diese Erträge sind lediglich bei Vermietung zu Wohn- oder '
      + 'Gewerbezwecken zu erzielen, welche wiederum nur bei Instandhaltung der technischen '
      + 'Ausstattung möglich ist. Bei Außerbetrachtlassen der technischen Aspekte entfällt die '
      + 'Nutzung zu solchen Zwecken mit Ablauf der angegebenen Restnutzungsdauer aufgrund des '
      + 'technischen Verfalls. Eine Weiternutzung zu anderen als den bisherigen Zwecken wäre '
      + 'möglich, jedoch wirtschaftlich nicht sinnvoll.', y);
    y = renderParagraph(doc,
      'Der Verschleiß des Tragwerks und der wirtschaftliche Nutzen sind somit nachgewiesen und '
      + 'bestätigen die zum Ergebnis der Restnutzungsdauer führenden angewandten Verfahren.', y);
    return y;
  }

  function renderModPunkteTable(doc, data, punktraster, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    doc.autoTable({
      startY: y,
      head: [['Modernisierungselemente', 'Durchgreifende\nModernisierung', 'vergebene Punkte']],
      body: [
        ['Dacherneuerung inkl. Verbesserung der Wärmedämmung', 'nein', '0'],
        ['Modernisierung der Fenster und Außentüren',           'nein', '0'],
        ['Modernisierung der Leitungssysteme\n(Strom, Gas, Wasser, Abwasser)', 'nein', '0'],
        ['Modernisierung der Heizungsanlage',                   'nein', '0'],
        ['Wärmedämmung der Außenwände',                         'nein', '0'],
        ['Modernisierung von Bädern',                           'nein', '0'],
        ['Modernisierung des Innenausbaus, z.B. Decken, Fußböden, Treppen', 'nein', '0'],
        ['Wesentliche Verbesserung der Grundrissgestaltung',    'nein', '0'],
        ['Gesamt', '', String(punktraster.modernisierungspunkte || 0)]
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2,
                lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text,
                valign: 'middle' },
      headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text, fontStyle: 'bold',
                    halign: 'center' },
      columnStyles: {
        0: { cellWidth: 95, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 35, halign: 'center' }
      },
      didParseCell: function (cellData) {
        if (cellData.row.index === 8) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = [248, 246, 241];
        }
      },
      margin: { left: ML, right: MR }
    });
    return doc.lastAutoTable.finalY + 4;
  }

  function renderGewerkeTable(doc, data, technisch, y) {
    if (typeof doc.autoTable !== 'function') return y + 80;
    const GEWERKE = global.DealPilotRND.GEWERKE;
    const body = GEWERKE.map(function (g) {
      return [g.label, g.weight + '%', '', '', ''];  // X-Markierungen werden in didParseCell gesetzt
    });
    doc.autoTable({
      startY: y,
      head: [
        [{ content: 'Ausstattungsgruppe', rowSpan: 2 },
         { content: 'Gewichtung', rowSpan: 2 },
         { content: 'Ausstattungsgrad', colSpan: 3, styles: { halign: 'center' } }],
        [{ content: 'niedrig /\nveraltet', styles: { halign: 'center' } },
         { content: 'aktueller\nStandard', styles: { halign: 'center' } },
         { content: 'zukunfts-\norientiert /\ngehoben', styles: { halign: 'center' } }]
      ],
      body: body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2,
                lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text,
                valign: 'middle' },
      headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 70, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' }
      },
      // Bei jedem body-cell bestimmen ob X gesetzt werden soll
      didParseCell: function (cellData) {
        if (cellData.section !== 'body') return;
        const rowIdx = cellData.row.index;
        const colIdx = cellData.column.index;
        if (colIdx < 2) return;  // Label und Gewichtung überspringen
        const gewerk = GEWERKE[rowIdx];
        const grad = (data.__gewerkeBewertung && data.__gewerkeBewertung[gewerk.id]) || 'standard';
        const colMap = { 2: 'veraltet', 3: 'standard', 4: 'gehoben' };
        if (colMap[colIdx] === grad) {
          cellData.cell.text = ['X'];
          cellData.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: ML, right: MR }
    });
    return doc.lastAutoTable.finalY + 4;
  }

  function renderZusammenfassungTable(doc, technisch, y) {
    if (typeof doc.autoTable !== 'function') return y + 30;
    doc.autoTable({
      startY: y,
      head: [[{ content: 'Zusammenfassung', colSpan: 2,
                styles: { halign: 'center', fontStyle: 'bold' } }]],
      body: [
        ['niedrig / veraltet:', technisch.anteil_veraltet_pct + ' %'],
        ['aktueller Standard:', technisch.anteil_standard_pct + ' %'],
        ['zukunftsorientiert / gehoben:', technisch.anteil_gehoben_pct + ' %']
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2,
                lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
      headStyles: { fillColor: [240, 240, 240], textColor: COLORS.text },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: ML, right: MR },
      tableWidth: 115
    });
    return doc.lastAutoTable.finalY + 4;
  }

  function renderTechnDetailTable(doc, technisch, y) {
    if (typeof doc.autoTable !== 'function') return y + 60;
    doc.autoTable({
      startY: y,
      body: [
        [{ content: 'Niedrig / veraltet:', styles: { fontStyle: 'bold' } },
         'RND × Gewichtung (%) / 2'],
        ['', technisch.rnd_basis_linear + ' Jahre × ' + technisch.anteil_veraltet_pct
            + ' / 2 = ' + global.DealPilotRND.fmtNum2(technisch.abzug_veraltet) + ' Jahre'],
        [{ content: 'Aktueller Standard:', styles: { fontStyle: 'bold' } },
         'RND × Gewichtung (%) / 2'],
        ['', technisch.rnd_basis_linear + ' Jahre × ' + technisch.anteil_standard_pct
            + ' / 2 = ' + global.DealPilotRND.fmtNum2(technisch.aufschlag_standard) + ' Jahre'],
        [{ content: 'Zukunftsorientiert / gehoben:', styles: { fontStyle: 'bold' } },
         'RND × Summe Gewichtung (%)'],
        ['', technisch.rnd_basis_linear + ' Jahre × ' + technisch.anteil_gehoben_pct
            + ' % = ' + global.DealPilotRND.fmtNum2(technisch.aufschlag_gehoben) + ' Jahre']
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2,
                lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: ML, right: MR }
    });
    return doc.lastAutoTable.finalY + 4;
  }

  // ============================================================
  // KAPITEL 6: ZUSAMMENFASSUNG
  // ============================================================
  function renderKapitel6(doc, data, result) {
    let y = MT;
    y = renderH1(doc, '6.    Zusammenfassung', y);
    const m = result.methods;

    y = renderH2(doc, '6.1   Berechnungen', y);

    y = renderH3sub(doc, 'Punktrastermethode', y);
    y = renderResultLine(doc,
      'Die Alterswertminderung nach der Punktrastermethode liegt bei '
      + global.DealPilotRND.fmtNum2(m.punktraster.alterswertminderung_pct) + ' %', y);
    y = renderResultLine(doc,
      'Die Restnutzungsdauer nach der Punktrastermethode beträgt: '
      + global.DealPilotRND.fmtNum2(m.punktraster.restnutzungsdauer) + ' Jahre', y);

    y += 4;
    y = renderH3sub(doc, 'Lineare Abschreibung', y);
    y = renderResultLine(doc,
      'Die lineare Alterswertminderung des Ermittlungsobjektes liegt bei '
      + global.DealPilotRND.fmtNum2(m.linear.alterswertminderung_pct) + ' %', y);
    y = renderResultLine(doc,
      'Die lineare Restnutzungsdauer beträgt: '
      + global.DealPilotRND.fmtNum2(m.linear.restnutzungsdauer) + ' Jahre', y);

    y += 4;
    y = renderH3sub(doc, 'Restnutzung bei technischer Alterswertminderung', y);
    y = renderResultLine(doc,
      'Die technische Alterswertminderung des Ermittlungsobjektes liegt bei '
      + global.DealPilotRND.fmtNum2(m.technisch.alterswertminderung_pct) + ' %', y);
    y = renderResultLine(doc,
      'Die technische Restnutzungsdauer beträgt: '
      + global.DealPilotRND.fmtNum2(m.technisch.restnutzungsdauer) + ' Jahre', y);

    if (y > A4_H - MB - 100) { addPageWithHeader(doc, data); y = MT; }

    y += 14;
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.line(ML, y, A4_W - MR, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Die reelle Restnutzungsdauer liegt bei ' + result.final_rnd + ' Jahren.', ML, y);

    if (y > A4_H - MB - 60) { addPageWithHeader(doc, data); y = MT; }

    y += 12;
    y = renderH2(doc, '6.2   Ergebnis', y);
    y = renderParagraph(doc,
      'Immobilien mit der vorhandenen Bebauung und Nutzbarkeit werden vorrangig nach der '
      + 'technischen Alterswertminderung bewertet. Die lineare Abschreibung und die Abschreibung '
      + 'nach der Punktrastermethode wurden als stützendes Ermittlungsverfahren angewandt.', y);

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Die Restnutzungsdauer für das Bewertungsobjekt', A4_W / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const adrComplete = data.objekt_adresse + (data.objekt_einheit
      ? ' - ' + data.objekt_einheit : '');
    doc.text(adrComplete, A4_W / 2, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('wird deshalb geschätzt auf:', A4_W / 2, y, { align: 'center' });
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor.apply(doc, COLORS.accentRed);
    doc.text(result.final_rnd + ' Jahre', A4_W / 2, y, { align: 'center' });
    doc.setTextColor.apply(doc, COLORS.text);
    y += 14;

    y = renderParagraph(doc,
      'Die Berechnungen erfolgen stets mit allen Nachkommastellen, wovon aber im Gutachten aus '
      + 'Übersichtlichkeitsgründen jeweils nur zwei Nachkommastellen gerundet übernommen wurden.', y);
    y = renderParagraph(doc,
      'Der Ersteller versichert, dass er diese Restnutzungsdauerermittlung aus rein objektiven '
      + 'Gesichtspunkten verfasst hat und kein subjektives Interesse am Ergebnis der '
      + 'Wertermittlung hat. Es handelt sich um eine Schätzung nach Erfahrung und bestem Wissen '
      + 'und Gewissen. Die tatsächliche Restnutzungsdauer kann in gewissem Rahmen hiervon '
      + 'abweichen.', y);

    // Unterschrift / Stempel-Block unten
    if (y > A4_H - MB - 60) { addPageWithHeader(doc, data); y = MT; }

    y = Math.max(y, A4_H - MB - 55);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text(data.erstellungsort + ', den ' + data.erstellungsdatum, ML, y);

    // Stempel-Platzhalter (Kreis, gestrichelt) rechts daneben
    drawStempelPlaceholder(doc, A4_W - MR - 50, y - 8);

    // Unterschriftslinie unter Datum
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.3);
    doc.line(ML, y + 12, ML + 70, y + 12);

    doc.setFontSize(9);
    doc.setTextColor.apply(doc, COLORS.muted);
    doc.text('(Ort, Datum)', ML, y + 16);

    // Unterschriftslinie rechts (für Sachverständigen)
    doc.line(A4_W - MR - 70, y + 12, A4_W - MR, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text(data.sv_name, A4_W - MR - 70, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (data.sv_titel) doc.text(data.sv_titel, A4_W - MR - 70, y + 21);
    doc.text(data.sv_unternehmen, A4_W - MR - 70, y + 25);
  }

  // ============================================================
  // KAPITEL AfA (optional)
  // ============================================================
  function renderKapitelAfa(doc, data, result, afa) {
    let y = MT;
    y = renderH1(doc, 'AfA-Auswirkung nach § 7 Abs. 4 Satz 2 EStG', y);
    y = renderParagraph(doc,
      'Die ermittelte Restnutzungsdauer von ' + result.final_rnd + ' Jahren ermöglicht die '
      + 'Anwendung einer kürzeren Absetzung für Abnutzung (AfA) nach § 7 Abs. 4 Satz 2 EStG. '
      + 'Nachfolgende Berechnung stellt den steuerlichen Vorteil dieser kürzeren AfA dem '
      + 'Standardsatz gegenüber.', y);

    y += 2;
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y,
        body: [
          ['Standard-AfA (' + afa.afa_standard.satz_pct + ' %)',
           fmtEUR(afa.afa_standard.jahresbetrag) + ' / Jahr'],
          ['RND-AfA (' + afa.afa_kurz.satz_pct + ' %)',
           fmtEUR(afa.afa_kurz.jahresbetrag) + ' / Jahr'],
          ['Mehr-AfA pro Jahr', '+ ' + fmtEUR(afa.mehr_afa_jahr)],
          ['Steuerersparnis pro Jahr (' + afa.input.grenzsteuersatz_pct + ' % Grenz)',
           fmtEUR(afa.steuerersparnis_jahr)],
          ['Barwert über ' + afa.input.rnd + ' Jahre (' + afa.input.abzinsung_pct + ' % Diskont)',
           fmtEUR(afa.steuerersparnis_barwert)],
          ['- Gutachterkosten', '- ' + fmtEUR(afa.gutachterkosten)],
          ['Netto-Vorteil', fmtEUR(afa.netto_vorteil)]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.5,
                  lineColor: [180, 180, 180], lineWidth: 0.2, textColor: COLORS.text },
        columnStyles: {
          0: { cellWidth: 105, fontStyle: 'bold' },
          1: { cellWidth: 'auto', halign: 'right' }
        },
        margin: { left: ML, right: MR }
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    y += 4;
    y = renderResultLine(doc, afa.empfehlung, y);

    y += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, COLORS.muted);
    const disc = doc.splitTextToSize(
      '§ 6 StBerG-Hinweis: Diese Berechnung dient der überschlägigen Investitionsbeurteilung '
      + 'und ersetzt keine steuerliche Beratung. Die tatsächliche steuerliche Anerkennung '
      + 'erfordert ein qualifiziertes Sachverständigen-Gutachten und die Würdigung durch das '
      + 'Finanzamt (BFH IX R 25/19).',
      CONTENT_W);
    doc.text(disc, ML, y);
  }

  // ============================================================
  // ANLAGE: Anerkenntnis Finanzverwaltung
  // ============================================================
  function renderAnlage(doc, data) {
    let y = MT;
    y = renderH1(doc, 'Anlage) Anerkenntnis durch Finanzverwaltung und -gerichtsbarkeit', y);

    y = renderParagraph(doc,
      'Die Bestimmung des § 7 Abs. 4 Satz 2 EStG räumt dem Steuerpflichtigen ein Wahlrecht ein, '
      + 'ob er sich mit dem typisierten AfA-Satz nach § 7 Abs. 4 Satz 1 EStG zufrieden gibt '
      + 'oder eine tatsächlich kürzere Nutzungsdauer geltend macht und darlegt. Auszugehen '
      + 'ist im Rahmen der vom Finanzamt durchzuführenden Amtsermittlung von der Schätzung des '
      + 'Steuerpflichtigen, solange dieser Erwägungen zugrunde liegen, wie sie ein vernünftig '
      + 'wirtschaftender Steuerpflichtiger üblicherweise anstellt.', y);

    y = renderParagraph(doc,
      'Da im Rahmen der Schätzung des Steuerpflichtigen nicht Gewissheit über die kürzere '
      + 'tatsächliche Nutzungsdauer, sondern allenfalls größtmögliche Wahrscheinlichkeit '
      + 'verlangt werden kann, ist sie nur dann zu verwerfen, wenn sie eindeutig außerhalb des '
      + 'angemessenen Schätzungsrahmens liegt.', y);

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Der Bundesfinanzhof hat mit Urteil vom 28. Juli 2021 - IX R 25/19 für Recht erkannt:',
             ML, y);
    y += 6;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    const bfh = doc.splitTextToSize(
      'Der Steuerpflichtige kann sich zur Darlegung der verkürzten tatsächlichen Nutzungsdauer '
      + 'eines zur Einkünfteerzielung genutzten Gebäudes (§ 7 Abs. 4 Satz 2 EStG) jeder '
      + 'Darlegungsmethode bedienen, die im Einzelfall zur Führung des erforderlichen '
      + 'Nachweises geeignet erscheint; erforderlich ist insoweit, dass aufgrund der '
      + 'Darlegungen des Steuerpflichtigen der Zeitraum, in dem das maßgebliche Gebäude '
      + 'voraussichtlich seiner Zweckbestimmung entsprechend genutzt werden kann, mit '
      + 'hinreichender Sicherheit geschätzt werden kann.',
      CONTENT_W);
    doc.text(bfh, ML, y);
    y += bfh.length * 4.5 + 4;

    if (y > A4_H - MB - 60) { addPageWithHeader(doc, data); y = MT; }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.text);
    y = renderParagraph(doc,
      'Die Vorlage eines Bausubstanzgutachtens ist nicht Voraussetzung für die Anerkennung '
      + 'einer verkürzten tatsächlichen Nutzungsdauer.', y);

    y += 2;
    y = renderBullet(doc, 'Dieses Gutachten ist eine sachverständige Darlegung,', y);
    y = renderBullet(doc, 'dessen Modellwahl eine sachgerechte und fundierte Ermittlung sowie '
      + 'die erforderliche sachverständige Würdigung des Einzelfalls ermöglicht', y);
    y = renderBullet(doc, 'dessen Berechnung nachvollziehbar und nachprüfbar ist', y);
    y = renderBullet(doc, 'die ohne methodische Mängel der ImmoWertV 2021 entspricht', y);

    y += 2;
    y = renderParagraph(doc,
      'Diese Vorgehensweise wurde weiter durch das Finanzgericht Münster mit Urteil vom '
      + '27.01.2022 - 1 K 1741/18 sowie durch das Finanzgericht Köln mit Urteil vom 22.03.2022 '
      + '- 6 K 923/20 bestätigt.', y);

    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.text('Eine steuerliche Beratung durch den Sachverständigen hat nicht stattgefunden.',
             ML, y);
  }

  // ============================================================
  // RENDER-PRIMITIVES
  // ============================================================
  function renderH1(doc, text, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text(text, ML, y);
    return y + 8;
  }
  function renderH2(doc, text, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text(text, ML, y);
    return y + 7;
  }
  function renderH3sub(doc, text, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text(text, ML, y);
    return y + 5.5;
  }
  function renderParagraph(doc, text, y) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, COLORS.text);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    doc.text(lines, ML, y);
    return y + lines.length * 4.4 + 2;
  }
  function renderFormula(doc, formula, y) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text(formula, A4_W / 2, y + 1, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    return y + 7;
  }
  function renderKV(doc, key, value, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text(key, ML, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || '—', CONTENT_W - 70);
    doc.text(lines, ML + 70, y);
    return y + Math.max(5, lines.length * 4.5 + 1);
  }
  function renderKVCompact(doc, key, value, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, COLORS.text);
    if (key) doc.text(key, ML, y);
    doc.setFont('helvetica', 'normal');
    const startX = key ? ML + 95 : ML;
    doc.text(value || '—', startX, y);
    return y + 5.5;
  }
  function renderKVList(doc, rows, y) {
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y,
        body: rows,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8,
                  lineColor: [200, 200, 200], lineWidth: 0.15, textColor: COLORS.text },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: 'bold' },
          1: { cellWidth: 'auto' }
        },
        margin: { left: ML, right: MR }
      });
      return doc.lastAutoTable.finalY + 2;
    }
    rows.forEach(function (r) { y += 5; });
    return y;
  }
  function renderResultLine(doc, text, y) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, COLORS.text);
    // Bestimmten Teil fett ("X Jahre" / "X %") — zuerst alles normal, dann letzten Wert fett
    const m = text.match(/(.*?)((?:\d+(?:[,\.]\d+)?)\s*(?:%|Jahre?|Jahren))$/);
    if (m) {
      doc.text(m[1], ML, y);
      doc.setFont('helvetica', 'bold');
      doc.text(m[2], ML + doc.getTextWidth(m[1]), y);
    } else {
      doc.text(text, ML, y);
    }
    return y + 5.5;
  }
  function renderBullet(doc, text, y) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, COLORS.text);
    const lines = doc.splitTextToSize('•  ' + text, CONTENT_W - 4);
    doc.text(lines, ML + 2, y);
    return y + lines.length * 4.4 + 1;
  }

  // ============================================================
  // ADD-CHAPTER (Kompakt — für Investment-Report-Anhang)
  // ============================================================
  function addChapter(doc, opts) {
    const o = opts || {};
    if (!o.result) throw new Error('opts.result is required');
    if (o.addPage !== false) doc.addPage();
    let y = ML + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor.apply(doc, COLORS.headerGreen);
    doc.text(o.title || 'Restnutzungsdauer-Analyse', ML, y);
    y += 8;

    const m = o.result.methods;
    const rows = [
      ['Linear', m.linear.restnutzungsdauer + ' J.', m.linear.alterswertminderung_pct + ' %'],
      ['Vogels', m.vogels.restnutzungsdauer + ' J.', m.vogels.alterswertminderung_pct + ' %'],
      ['Ross', m.ross.restnutzungsdauer + ' J.', m.ross.alterswertminderung_pct + ' %'],
      ['Parabel', m.parabel.restnutzungsdauer + ' J.', m.parabel.alterswertminderung_pct + ' %'],
      ['Punktraster', m.punktraster.restnutzungsdauer + ' J.',
       m.punktraster.alterswertminderung_pct + ' %'],
      ['Technisch (vorrangig)', m.technisch.restnutzungsdauer + ' J.',
       m.technisch.alterswertminderung_pct + ' %']
    ];

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        startY: y + 4,
        head: [['Verfahren', 'RND', 'AWM']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: COLORS.headerGreen, textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 2 },
        margin: { left: ML, right: MR }
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor.apply(doc, COLORS.text);
    doc.text('Empfohlene Restnutzungsdauer:  ' + o.result.final_rnd + ' Jahre', ML, y);

    return { lastY: y };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function fmtEUR(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return n.toLocaleString('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    });
  }
  function formatDate(d) {
    if (!d) return new Date().toLocaleDateString('de-DE');
    if (typeof d === 'string') {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[3] + '.' + m[2] + '.' + m[1];
      return d;
    }
    if (d instanceof Date) return d.toLocaleDateString('de-DE');
    return String(d);
  }

  // EXPORT
  global.DealPilotRND_PDF = {
    generateGutachten: generateGutachten,
    addChapter: addChapter,
    formatDate: formatDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
