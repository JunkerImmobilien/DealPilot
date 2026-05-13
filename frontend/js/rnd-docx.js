/**
 * DealPilot — Restnutzungsdauer-Gutachten DOCX-Export
 * =====================================================
 * Erstellt eine echte .docx-Datei (Office Open XML, OOXML) zum
 * Bearbeiten in Word, LibreOffice etc.
 *
 * Benötigt: JSZip (https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js)
 * Wird automatisch geprüft und Fehlermeldung gezeigt, falls nicht geladen.
 *
 * Verwendung:
 *   DealPilotRND_DOCX.generateGutachten({
 *     gutachtenData: { ... },
 *     result: { ... },
 *     afa: { ... }  // optional
 *   });
 *   → triggert Download
 *
 * Inhalt: vollständiges Gutachten mit denselben Kapiteln wie das PDF,
 *   aber als bearbeitbares Word-Dokument.
 */
(function (global) {
  'use strict';

  // ============================================================
  // PUBLIC API
  // ============================================================
  function generateGutachten(opts) {
    if (typeof JSZip === 'undefined') {
      alert('JSZip ist nicht geladen. Bitte einbinden:\n'
           + 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      throw new Error('JSZip required for DOCX export');
    }
    if (!opts || !opts.result) throw new Error('opts.result is required');

    const data = mergeDefaults(opts.gutachtenData || {}, opts.result);
    const result = opts.result;
    const afa = opts.afa || null;

    const zip = new JSZip();

    // Standard-OOXML-Dateien (Container)
    zip.file('[Content_Types].xml', getContentTypes());
    zip.folder('_rels').file('.rels', getRootRels());
    zip.folder('docProps').file('core.xml', getCoreProps(data));
    zip.folder('docProps').file('app.xml', getAppProps(data));
    const wordFolder = zip.folder('word');
    wordFolder.folder('_rels').file('document.xml.rels', getDocRels());
    wordFolder.file('styles.xml', getStyles());
    wordFolder.file('settings.xml', getSettings());
    wordFolder.file('document.xml', getDocumentXml(data, result, afa));

    // Datei als Blob generieren und Download triggern
    zip.generateAsync({ type: 'blob' }).then(function (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Restnutzungsdauer-Gutachten_'
        + slugify(data.objekt_adresse || 'Objekt')
        + '_' + new Date().toISOString().slice(0, 10) + '.docx';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }

  // ============================================================
  // DEFAULTS
  // ============================================================
  function mergeDefaults(data, result) {
    const today = new Date().toLocaleDateString('de-DE');
    const inp = result.input;
    return Object.assign({
      titel: 'Ermittlung Restnutzungsdauer',
      aktenzeichen: 'DP-' + Date.now().toString().slice(-7),
      objekt_typ: 'Eigentumswohnung',
      objekt_adresse: '',
      objekt_einheit: '',
      stichtag: inp.stichtag_jahr + '-12-31',
      stichtag_str: formatDate(inp.stichtag_jahr + '-12-31'),
      besichtigungsdatum: today,
      erstellungsdatum: today,
      erstellungsort: 'Hüllhorst',
      auftraggeber_name: '',
      auftraggeber_adresse: '',
      eigentuemer_name: '',
      eigentuemer_adresse: '',
      anlass: 'Restnutzungsdauerermittlung',
      baujahr: inp.baujahr,
      wohnflaeche: '',
      bauweise: 'Massiv',
      unterkellerung: '',
      vollgeschosse: '',
      einheiten_gesamt: '',
      bedachung: '',
      fenster: '',
      heizungsart: '',
      anzahl_baeder: '1',
      besonderheiten: 'Keine',
      bel: 'Herkömmliche Fensterlüftung',
      brennstoff: '',
      warmwasser: '',
      erneuerbare: 'Keine',
      energieklasse: '',
      erschliessung: 'erschlossen',
      mod_dach: 'Keine/Nie',
      mod_fenster: 'Keine/Nie',
      mod_leitungen: 'Keine/Nie',
      mod_heizung: 'Keine/Nie',
      mod_aussenwand: 'Keine/Nie',
      mod_baeder: 'Keine/Nie',
      mod_innenausbau: 'Keine/Nie',
      mod_technik: 'Keine/Nie',
      mod_grundriss: '',
      sv_name: '— Sachverständiger —',
      sv_titel: '',
      sv_unternehmen: 'Junker Immobilien',
      sv_adresse_z1: 'Hermannstraße 9',
      sv_adresse_z2: '32609 Hüllhorst',
      sv_email: ''
    }, data);
  }

  // ============================================================
  // OOXML BAUSTEINE
  // ============================================================
  function getContentTypes() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + '</Types>';
  }
  function getRootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      + '</Relationships>';
  }
  function getDocRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
      + '</Relationships>';
  }
  function getCoreProps(data) {
    const now = new Date().toISOString();
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + '<dc:title>' + esc('Restnutzungsdauer-Gutachten ' + (data.objekt_adresse || '')) + '</dc:title>'
      + '<dc:creator>' + esc(data.sv_name || 'DealPilot') + '</dc:creator>'
      + '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>'
      + '</cp:coreProperties>';
  }
  function getAppProps(data) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
      + '<Application>DealPilot RND-Modul V3</Application>'
      + '<Company>' + esc(data.sv_unternehmen || 'Junker Immobilien') + '</Company>'
      + '</Properties>';
  }

  function getStyles() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault></w:docDefaults>'
      // Heading 1
      + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>'
      + '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="3C6E3C"/><w:sz w:val="32"/></w:rPr></w:style>'
      // Heading 2
      + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>'
      + '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="3C6E3C"/><w:sz w:val="26"/></w:rPr></w:style>'
      // Heading 3
      + '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr>'
      + '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="3C6E3C"/><w:sz w:val="22"/></w:rPr></w:style>'
      // Title
      + '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr>'
      + '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="56"/></w:rPr></w:style>'
      // Normal
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>'
      + '<w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:style>'
      // Tabellen-Standard
      + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/>'
      + '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
      + '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>'
      + '<w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B4B4B4"/><w:left w:val="single" w:sz="4" w:color="B4B4B4"/><w:bottom w:val="single" w:sz="4" w:color="B4B4B4"/><w:right w:val="single" w:sz="4" w:color="B4B4B4"/><w:insideH w:val="single" w:sz="4" w:color="B4B4B4"/><w:insideV w:val="single" w:sz="4" w:color="B4B4B4"/></w:tblBorders></w:tblPr></w:style>'
      + '</w:styles>';
  }

  function getSettings() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:defaultTabStop w:val="708"/>'
      + '</w:settings>';
  }

  // ============================================================
  // DOCUMENT.XML — HAUPTINHALT
  // ============================================================
  function getDocumentXml(data, result, afa) {
    const xml = [];
    xml.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    xml.push('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">');
    xml.push('<w:body>');

    // === TITELSEITE ===
    xml.push(emptyPara());
    xml.push(emptyPara());
    xml.push(p('Ermittlung Restnutzungsdauer', 'Title'));
    xml.push(p('einer Immobilie unter Beachtung des § 7 Absatz 4 Satz 2 EStG, '
      + 'unter Verwendung der DIN EN 15686, DIN 276-1 und unter Berücksichtigung der aktuellen '
      + 'Gesetzgebung des Gebäudeenergiegesetz (GEG).', null, { align: 'center', italic: true }));
    xml.push(emptyPara());
    xml.push(emptyPara());
    xml.push(p('[ Objektfoto — bitte hier einfügen ]', null,
      { align: 'center', italic: true, color: '999999' }));
    xml.push(emptyPara());
    xml.push(p(data.objekt_typ, null, { align: 'center', bold: true, size: 28 }));
    const adrComplete = data.objekt_adresse + (data.objekt_einheit ? ' - ' + data.objekt_einheit : '');
    xml.push(p(adrComplete, null, { align: 'center', bold: true, size: 24 }));
    xml.push(emptyPara());
    xml.push(p('Ermittelte Restnutzungsdauer:', null, { align: 'center', bold: true, size: 24 }));
    xml.push(p(result.final_rnd + ' Jahre', null,
      { align: 'center', bold: true, size: 56, color: 'B8625C' }));
    xml.push(emptyPara());
    xml.push(p('[ Stempel / Unterschrift Platzhalter ]', null,
      { align: 'center', italic: true, color: '999999' }));
    xml.push(pageBreak());

    // === KAPITEL 1: EINLEITUNG ===
    xml.push(p('1. Einleitung', 'Heading1'));
    xml.push(p('1.1 Auftrag', 'Heading2'));

    xml.push(twoColTable([
      ['Auftraggeber der Nutzungsdauerermittlung:',
        data.auftraggeber_name + (data.auftraggeber_adresse ? '\n' + data.auftraggeber_adresse : '')],
      ['Eigentümer des Objektes:',
        (data.eigentuemer_name || data.auftraggeber_name)
          + (data.eigentuemer_adresse ? '\n' + data.eigentuemer_adresse
            : data.auftraggeber_adresse ? '\n' + data.auftraggeber_adresse : '')]
    ]));

    xml.push(p('Bewertungsstichtag', 'Heading3'));
    xml.push(p('Der Bewertungsstichtag ist definiert als der Zeitpunkt, auf den sich die '
      + 'Nutzungsdauerermittlung hinsichtlich der Restnutzung bezieht. Die Restnutzungsdauer wird '
      + 'grundsätzlich aus dem Unterschied zwischen der typisierten wirtschaftlichen '
      + 'Gesamtnutzungsdauer und dem Alter des Gebäudes am Bewertungsstichtag ermittelt. Technische '
      + 'und wirtschaftliche Veränderungen am Ermittlungsobjekt, welche nach dem Bewertungsstichtag '
      + 'durchgeführt wurden, sind in dieser Ermittlung nicht berücksichtigt.'));

    xml.push(twoColTable([
      ['Anlass des Auftrages:', data.anlass],
      ['Aktenzeichen der RND-Ermittlung:', data.aktenzeichen],
      ['Datum der Besichtigung:', data.besichtigungsdatum],
      ['Bewertungsstichtag:', formatDate(data.stichtag)]
    ]));

    xml.push(p('1.2 Erläuterung zum Umfang', 'Heading2'));
    xml.push(p('Im Rahmen dieser Restnutzungsdauerermittlung werden die Umstände berücksichtigt, '
      + 'die im Rahmen einer ordnungsgemäßen und zumutbaren Erforschung der Sachverhalte für den '
      + 'Sachverständigen zu erkennen und zu bewerten waren. Der Sachverständige führt keine '
      + 'Untersuchungen durch, die eine Beschädigung oder Zerstörung von Bauteilen zur Folge hat.'));
    xml.push(p('Der Zustand von nicht sichtbaren Bauteilen wird deshalb durch Auskünfte des '
      + 'Auftraggebers, durch Unterlagen oder durch den Sachverständigen eingeschätzt.'));
    xml.push(p('Ebenso wurden haustechnische Einrichtungen keiner Funktionsprüfung unterzogen. '
      + 'So weit nicht anders angegeben, wird die Funktionstauglichkeit unterstellt.'));
    xml.push(pageBreak());

    // === KAPITEL 2: BEWERTETES OBJEKT ===
    xml.push(p('2. Bewertetes Objekt', 'Heading1'));
    xml.push(p('2.1 Erschließungssituation', 'Heading2'));
    xml.push(twoColTable([['Erschließungssituation:', data.erschliessung]]));

    xml.push(p('2.2 Gebäude und bauliche Anlagen', 'Heading2'));
    xml.push(p('a) Gebäude und Einheit', 'Heading3'));
    xml.push(twoColTable([
      ['Gebäudetyp', data.objekt_typ],
      ['Baujahr', String(data.baujahr)],
      ['Wohnfläche', data.wohnflaeche ? data.wohnflaeche + ' m²' : '—'],
      ['Bauweise', data.bauweise],
      ['Unterkellerung', data.unterkellerung || '—'],
      ['Vollgeschosse', String(data.vollgeschosse || '—')],
      ['Gesamtzahl der Einheiten', String(data.einheiten_gesamt || '—')],
      ['Bedachung', data.bedachung || '—'],
      ['Fenster', data.fenster || '—'],
      ['Heizungsart', data.heizungsart || '—'],
      ['Anzahl Bäder', String(data.anzahl_baeder || '—')],
      ['Besonderheiten des Objekts', data.besonderheiten]
    ]));

    xml.push(p('b) Gebäudetechnik', 'Heading3'));
    xml.push(twoColTable([
      ['Belüftung', data.bel],
      ['Brennstoff / Energie', data.brennstoff || '—'],
      ['Warmwasser', data.warmwasser || '—']
    ]));

    xml.push(p('c) Erneuerbare Energien', 'Heading3'));
    xml.push(p(data.erneuerbare));

    xml.push(p('d) Energieeffizienz / Energieausweis', 'Heading3'));
    xml.push(p('Bei der Berechnung nach aktuellen Gebäudeenergiegesetzvorschriften erhält das '
      + 'Objekt einen Energiekennwert von ' + (data.energieklasse || '—') + '.'));

    xml.push(p('e) Durchgeführte Modernisierungsmaßnahmen', 'Heading3'));
    xml.push(p('Eine Kernsanierung trifft auf das Bewertungsobjekt nicht zu. '
      + 'Stattdessen wurden folgende Modernisierungen durchgeführt bzw. nicht durchgeführt:'));
    xml.push(twoColTable([
      ['Modernisierungselement', 'Zeitraum und Umfang'],
      ['Dacherneuerung inkl. Wärmedämmung', data.mod_dach],
      ['Modernisierung der Fenster und Türen', data.mod_fenster],
      ['Modernisierung der Leitungssysteme', data.mod_leitungen],
      ['Modernisierung der Heizungsanlage', data.mod_heizung],
      ['Wärmedämmung der Außenwände', data.mod_aussenwand],
      ['Modernisierung der Bäder', data.mod_baeder],
      ['Modernisierung des Innenausbaus', data.mod_innenausbau],
      ['Technische Ausstattung', data.mod_technik],
      ['Wesentliche Verbesserung der Grundrissgestaltung', data.mod_grundriss || '—']
    ], true /* header */));
    xml.push(pageBreak());

    // === KAPITEL 3: DEFINITIONEN — kompakte Version ===
    xml.push(p('3. Definitionen und Berechnungsgrundlagen', 'Heading1'));
    xml.push(p('3.1 Allgemeine Definition', 'Heading2'));
    xml.push(p('Die rechtliche Grundlage für die Restnutzungsdauer bildet die '
      + 'Immobilienwertermittlungsverordnung (ImmoWertV). Die Restnutzungsdauer wird gemäß § 4 '
      + 'Abs. 3 S. 1 ImmoWertV ermittelt — ausgehend vom Baujahr und unter Berücksichtigung '
      + 'wesentlicher Modernisierungsmaßnahmen.'));

    xml.push(p('3.2 Gesamtnutzungsdauer', 'Heading2'));
    xml.push(p('Für das vorliegende Bewertungsobjekt (' + data.objekt_typ + ') wird eine '
      + 'Gesamtnutzungsdauer von ' + result.input.gnd + ' Jahren angesetzt. Diese Werte basieren '
      + 'auf Anlage 22 BewG und Anlage 3 SW-RL bzw. Anlage 2 BelWertV.'));

    xml.push(p('3.3 Anwendung der Verfahren', 'Heading2'));
    xml.push(p('Drei Hauptverfahren wurden angewandt: Lineare Alterswertminderung als '
      + 'Regelfallformel, die Punktrastermethode (ImmoWertV Anlage 2) zur Bewertung von '
      + 'Modernisierungen, sowie die technische Alterswertminderung mit Gewerke-spezifischer '
      + 'Bewertung als vorrangiges Verfahren.'));
    xml.push(pageBreak());

    // === KAPITEL 4: VERFAHRENSARTEN — kompakt ===
    xml.push(p('4. Verfahrensarten', 'Heading1'));
    xml.push(p('4.1 Lineare Alterswertminderung', 'Heading2'));
    xml.push(p('Annahme: Der Wert nimmt im Verlauf der Lebensdauer gleichmäßig ab.'));
    xml.push(formula('w = A / G × 100'));

    xml.push(p('4.2 Punktrastermethode (ImmoWertV Anlage 2)', 'Heading2'));
    xml.push(p('Modernisierungsmaßnahmen werden mit max. 20 Punkten bewertet. '
      + 'Die Koeffizienten a, b, c hängen von der erreichten Punktzahl ab.'));
    xml.push(formula('RND = (a × A² / G) - b × A + c × G'));

    xml.push(p('4.3 Technische Alterswertminderung (vorrangiges Verfahren)', 'Heading2'));
    xml.push(p('Die einzelnen Gewerke werden in drei Stufen klassifiziert '
      + '(niedrig/veraltet, aktueller Standard, zukunftsorientiert/gehoben) und nach Gewichtungs'
      + 'faktor in das Endergebnis einbezogen.'));
    xml.push(pageBreak());

    // === KAPITEL 5: BERECHNUNG ===
    const m = result.methods;
    const RND = global.DealPilotRND;
    const fmt = function (n) { return RND ? RND.fmtNum2(n) : String(n); };

    xml.push(p('5. Berechnung Restnutzungsdauer', 'Heading1'));

    xml.push(p('5.1 Lineare Restnutzungsdauer', 'Heading2'));
    xml.push(twoColTable([
      ['Baujahr:', String(data.baujahr)],
      ['Bewertungsstichtag:', formatDate(data.stichtag)],
      ['Alter der Immobilie:', result.input.alter + ' Jahre'],
      ['Gesamtnutzungsdauer:', result.input.gnd + ' Jahre']
    ]));
    xml.push(p('Berechnung: ' + result.input.alter + ' / ' + result.input.gnd + ' × 100 = '
      + fmt(m.linear.alterswertminderung_pct) + ' %', null, { bold: true }));
    xml.push(p('Lineare Restnutzungsdauer: ' + fmt(m.linear.restnutzungsdauer) + ' Jahre',
      null, { bold: true }));

    xml.push(p('5.2 Punktrastermethode', 'Heading2'));
    xml.push(twoColTable([
      ['Modernisierungspunkte (gesamt):', String(m.punktraster.modernisierungspunkte)],
      ['Modernisierungsgrad:', m.punktraster.modernisierungsgrad_text]
    ]));
    xml.push(p('Formel: ' + m.punktraster.formula));
    xml.push(p('Alterswertminderung: ' + fmt(m.punktraster.alterswertminderung_pct) + ' %',
      null, { bold: true }));
    xml.push(p('Restnutzungsdauer: ' + fmt(m.punktraster.restnutzungsdauer) + ' Jahre',
      null, { bold: true }));

    xml.push(p('5.3 Technische Restnutzungsdauer', 'Heading2'));
    xml.push(p('5.3.1 Bewertung der 9 Gewerke', 'Heading3'));

    const gw = data.__gewerkeBewertung || {};
    const GEWERKE = [
      ['dach', 'Dachkonstruktion inkl. Wärmedämmung', 15],
      ['fenster', 'Fenster / Außentüren', 15],
      ['leitungen', 'Leitungssysteme', 5],
      ['heizung', 'Heizungsanlage', 15],
      ['aussenwand', 'Außenwände inkl. Wärmedämmung', 10],
      ['baeder', 'Ausbau Bäder', 5],
      ['decken', 'Deckenkonstruktion', 5],
      ['technik', 'Technische Ausstattung', 15],
      ['grundriss', 'Wesentliche Veränderung Grundriss', 15]
    ];
    const gewerkeRows = [['Ausstattungsgruppe', 'Gewichtung', 'Bewertung']];
    GEWERKE.forEach(function (g) {
      const grad = gw[g[0]] || 'standard';
      const gradLabel = grad === 'veraltet' ? 'niedrig / veraltet'
                     : grad === 'gehoben' ? 'zukunftsorientiert / gehoben'
                     : 'aktueller Standard';
      gewerkeRows.push([g[1], g[2] + ' %', gradLabel]);
    });
    xml.push(threeColTable(gewerkeRows, true));

    xml.push(p('5.3.2 Anteile (normiert auf 100%)', 'Heading3'));
    xml.push(twoColTable([
      ['niedrig / veraltet:', m.technisch.anteil_veraltet_pct + ' %'],
      ['aktueller Standard:', m.technisch.anteil_standard_pct + ' %'],
      ['zukunftsorientiert / gehoben:', m.technisch.anteil_gehoben_pct + ' %']
    ]));

    xml.push(p('5.3.3 Restnutzungsdauer-Berechnung', 'Heading3'));
    xml.push(p('RND-Basis (GND - Alter): ' + m.technisch.rnd_basis_linear + ' Jahre'));
    xml.push(p('Abzug für veraltete Anteile: ' + fmt(m.technisch.abzug_veraltet) + ' Jahre'));
    xml.push(p('Aufschlag für Standard-Anteile: ' + fmt(m.technisch.aufschlag_standard) + ' Jahre'));
    xml.push(p('Aufschlag für gehobene Anteile: ' + fmt(m.technisch.aufschlag_gehoben) + ' Jahre'));
    xml.push(p('Formel: ' + m.technisch.formula, null, { bold: true }));
    xml.push(p('Technische Alterswertminderung: ' + fmt(m.technisch.alterswertminderung_pct) + ' %',
      null, { bold: true }));
    xml.push(p('Technische Restnutzungsdauer: ' + fmt(m.technisch.restnutzungsdauer) + ' Jahre',
      null, { bold: true }));

    xml.push(p('5.4 Technische Angaben zum Tragwerk', 'Heading2'));
    xml.push(p('Entsprechend der Ausführungen im Lebensdauerkatalog des Bundes Deutscher '
      + 'Experten (BTE) beträgt die Lebensdauer der tragenden Bauteile (Fundament, tragende Wände, '
      + 'Decken und Dachstuhl) für die Art der hier betrachteten Immobilie ca. ' + result.input.gnd
      + ' Jahre. Gemäß DIN 31051 besitzen diese Bauteile ab Herstellung einen mit zunehmender '
      + 'Lebensdauer verschleißenden Abnutzungsvorrat, welcher durch Instandsetzung / Verbesserung '
      + 'ausgedehnt bzw. verlängert werden kann.'));
    xml.push(p('Im Falle der hier betrachteten Immobilie fanden ab Herstellung im Jahre '
      + result.input.baujahr + ' keine wesentlichen Sanierungen statt. Der Verschleiß der tragenden '
      + 'Bauteile ist somit nachgewiesen. Die restliche Lebenserwartung der tragenden Teile '
      + 'spiegelt die angegebene Restnutzungsdauer der Immobilie wider.'));
    xml.push(pageBreak());

    // === KAPITEL 6: ZUSAMMENFASSUNG ===
    xml.push(p('6. Zusammenfassung', 'Heading1'));
    xml.push(p('6.1 Berechnungen', 'Heading2'));

    xml.push(p('Punktrastermethode', 'Heading3'));
    xml.push(p('Alterswertminderung: ' + fmt(m.punktraster.alterswertminderung_pct) + ' %',
      null, { bold: true }));
    xml.push(p('Restnutzungsdauer: ' + fmt(m.punktraster.restnutzungsdauer) + ' Jahre',
      null, { bold: true }));

    xml.push(p('Lineare Abschreibung', 'Heading3'));
    xml.push(p('Alterswertminderung: ' + fmt(m.linear.alterswertminderung_pct) + ' %',
      null, { bold: true }));
    xml.push(p('Restnutzungsdauer: ' + fmt(m.linear.restnutzungsdauer) + ' Jahre', null, { bold: true }));

    xml.push(p('Technische Alterswertminderung', 'Heading3'));
    xml.push(p('Alterswertminderung: ' + fmt(m.technisch.alterswertminderung_pct) + ' %',
      null, { bold: true }));
    xml.push(p('Restnutzungsdauer: ' + fmt(m.technisch.restnutzungsdauer) + ' Jahre', null, { bold: true }));

    xml.push(emptyPara());
    xml.push(p('Die reelle Restnutzungsdauer liegt bei ' + result.final_rnd + ' Jahren.',
      null, { bold: true, size: 24 }));

    xml.push(p('6.2 Ergebnis', 'Heading2'));
    xml.push(p('Immobilien mit der vorhandenen Bebauung und Nutzbarkeit werden vorrangig nach der '
      + 'technischen Alterswertminderung bewertet. Die lineare Abschreibung und die Abschreibung '
      + 'nach der Punktrastermethode wurden als stützendes Ermittlungsverfahren angewandt.'));

    xml.push(emptyPara());
    xml.push(p('Die Restnutzungsdauer für das Bewertungsobjekt', null, { align: 'center' }));
    xml.push(p(adrComplete, null, { align: 'center', bold: true }));
    xml.push(p('wird deshalb geschätzt auf:', null, { align: 'center' }));
    xml.push(p(result.final_rnd + ' Jahre', null,
      { align: 'center', bold: true, size: 56, color: 'B8625C' }));
    xml.push(emptyPara());

    xml.push(p('Die Berechnungen erfolgen stets mit allen Nachkommastellen, wovon aber im '
      + 'Gutachten aus Übersichtlichkeitsgründen jeweils nur zwei Nachkommastellen gerundet '
      + 'übernommen wurden.'));
    xml.push(p('Der Ersteller versichert, dass er diese Restnutzungsdauerermittlung aus rein '
      + 'objektiven Gesichtspunkten verfasst hat und kein subjektives Interesse am Ergebnis der '
      + 'Wertermittlung hat. Es handelt sich um eine Schätzung nach Erfahrung und bestem Wissen '
      + 'und Gewissen. Die tatsächliche Restnutzungsdauer kann in gewissem Rahmen hiervon '
      + 'abweichen.'));

    xml.push(emptyPara());
    xml.push(p(data.erstellungsort + ', den ' + data.erstellungsdatum));
    xml.push(p('(Ort, Datum)', null, { italic: true, color: '999999' }));
    xml.push(emptyPara());
    xml.push(p('___________________________________'));
    xml.push(p(data.sv_name, null, { bold: true }));
    if (data.sv_titel) xml.push(p(data.sv_titel));
    xml.push(p(data.sv_unternehmen));
    xml.push(pageBreak());

    // === ANLAGE ===
    xml.push(p('Anlage: Anerkenntnis durch Finanzverwaltung und -gerichtsbarkeit', 'Heading1'));
    xml.push(p('Die Bestimmung des § 7 Abs. 4 Satz 2 EStG räumt dem Steuerpflichtigen ein '
      + 'Wahlrecht ein, ob er sich mit dem typisierten AfA-Satz nach § 7 Abs. 4 Satz 1 EStG '
      + 'zufrieden gibt oder eine tatsächlich kürzere Nutzungsdauer geltend macht und darlegt.'));
    xml.push(p('Der Bundesfinanzhof hat mit Urteil vom 28. Juli 2021 - IX R 25/19 für Recht '
      + 'erkannt:', null, { bold: true }));
    xml.push(p('„Der Steuerpflichtige kann sich zur Darlegung der verkürzten tatsächlichen '
      + 'Nutzungsdauer eines zur Einkünfteerzielung genutzten Gebäudes (§ 7 Abs. 4 Satz 2 EStG) '
      + 'jeder Darlegungsmethode bedienen, die im Einzelfall zur Führung des erforderlichen '
      + 'Nachweises geeignet erscheint."', null, { italic: true }));
    xml.push(p('Die Vorlage eines Bausubstanzgutachtens ist nicht Voraussetzung für die '
      + 'Anerkennung einer verkürzten tatsächlichen Nutzungsdauer.'));
    xml.push(p('Dieses Gutachten ist eine sachverständige Darlegung, dessen Modellwahl eine '
      + 'sachgerechte und fundierte Ermittlung sowie die erforderliche sachverständige Würdigung '
      + 'des Einzelfalls ermöglicht. Die Berechnung ist nachvollziehbar und nachprüfbar und '
      + 'entspricht ohne methodische Mängel der ImmoWertV 2021.'));
    xml.push(p('Diese Vorgehensweise wurde weiter durch das Finanzgericht Münster mit Urteil '
      + 'vom 27.01.2022 - 1 K 1741/18 sowie durch das Finanzgericht Köln mit Urteil vom '
      + '22.03.2022 - 6 K 923/20 bestätigt.'));
    xml.push(p('Eine steuerliche Beratung durch den Sachverständigen hat nicht stattgefunden.',
      null, { italic: true }));

    // AfA-Vergleich falls vorhanden
    if (afa && afa.valid) {
      xml.push(pageBreak());
      xml.push(p('AfA-Auswirkung nach § 7 Abs. 4 Satz 2 EStG', 'Heading1'));
      xml.push(p('Die ermittelte Restnutzungsdauer von ' + result.final_rnd + ' Jahren ermöglicht '
        + 'die Anwendung einer kürzeren AfA. Nachfolgende Berechnung stellt den steuerlichen '
        + 'Vorteil dem Standardsatz gegenüber.'));
      xml.push(twoColTable([
        ['Standard-AfA (' + afa.afa_standard.satz_pct + ' %)',
          fmtEUR(afa.afa_standard.jahresbetrag) + ' / Jahr'],
        ['RND-AfA (' + afa.afa_kurz.satz_pct + ' %)',
          fmtEUR(afa.afa_kurz.jahresbetrag) + ' / Jahr'],
        ['Mehr-AfA pro Jahr', '+ ' + fmtEUR(afa.mehr_afa_jahr)],
        ['Steuerersparnis pro Jahr (Grenzsteuer ' + afa.input.grenzsteuersatz_pct + ' %)',
          fmtEUR(afa.steuerersparnis_jahr)],
        ['Barwert über ' + afa.input.rnd + ' Jahre',
          fmtEUR(afa.steuerersparnis_barwert)],
        ['− Gutachterkosten', '− ' + fmtEUR(afa.gutachterkosten)],
        ['Netto-Vorteil', fmtEUR(afa.netto_vorteil)]
      ]));
      xml.push(p(afa.empfehlung, null, { bold: true }));
      xml.push(p('§ 6 StBerG-Hinweis: Diese Berechnung dient der überschlägigen Investitions'
        + 'beurteilung und ersetzt keine steuerliche Beratung. Die tatsächliche steuerliche '
        + 'Anerkennung erfordert ein qualifiziertes Sachverständigen-Gutachten und die Würdigung '
        + 'durch das Finanzamt (BFH IX R 25/19).',
        null, { italic: true, size: 16, color: '999999' }));
    }

    // Section-Properties (Seitenformat A4)
    xml.push('<w:sectPr>'
      + '<w:pgSz w:w="11906" w:h="16838"/>'
      + '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
      + '</w:sectPr>');
    xml.push('</w:body>');
    xml.push('</w:document>');
    return xml.join('');
  }

  // ============================================================
  // OOXML HELPERS — Paragraph, Table, etc.
  // ============================================================
  function p(text, style, opts) {
    opts = opts || {};
    let pPr = '';
    if (style) pPr += '<w:pStyle w:val="' + style + '"/>';
    if (opts.align) pPr += '<w:jc w:val="' + opts.align + '"/>';
    let rPr = '';
    if (opts.bold) rPr += '<w:b/>';
    if (opts.italic) rPr += '<w:i/>';
    if (opts.size) rPr += '<w:sz w:val="' + opts.size + '"/>';
    if (opts.color) rPr += '<w:color w:val="' + opts.color + '"/>';

    return '<w:p>'
      + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '')
      + (text ? splitToRuns(text, rPr) : '<w:r><w:t></w:t></w:r>')
      + '</w:p>';
  }
  function splitToRuns(text, rPrInner) {
    const parts = String(text).split('\n');
    let out = '';
    parts.forEach(function (line, i) {
      if (i > 0) out += '<w:r><w:br/></w:r>';
      out += '<w:r>' + (rPrInner ? '<w:rPr>' + rPrInner + '</w:rPr>' : '')
           + '<w:t xml:space="preserve">' + esc(line) + '</w:t></w:r>';
    });
    return out;
  }
  function emptyPara() { return '<w:p></w:p>'; }
  function pageBreak() {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
  function formula(text) {
    return p(text, null, { align: 'center', bold: true, italic: true });
  }
  function twoColTable(rows, withHeader) {
    return tableXml(rows, [3500, 5500], withHeader);
  }
  function threeColTable(rows, withHeader) {
    return tableXml(rows, [4000, 2000, 3000], withHeader);
  }
  function tableXml(rows, widths, withHeader) {
    const xml = ['<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>'
      + '<w:tblW w:w="9000" w:type="dxa"/>'
      + '</w:tblPr>'];
    xml.push('<w:tblGrid>');
    widths.forEach(function (w) { xml.push('<w:gridCol w:w="' + w + '"/>'); });
    xml.push('</w:tblGrid>');

    rows.forEach(function (row, rowIdx) {
      const isHeader = withHeader && rowIdx === 0;
      xml.push('<w:tr>');
      row.forEach(function (cell, ci) {
        xml.push('<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>');
        if (isHeader) xml.push('<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>');
        xml.push('</w:tcPr>');
        const cellOpts = isHeader ? { bold: true } : (ci === 0 ? { bold: true } : null);
        xml.push(p(String(cell == null ? '' : cell), null, cellOpts || {}));
        xml.push('</w:tc>');
      });
      xml.push('</w:tr>');
    });
    xml.push('</w:tbl>');
    // Leere Para nach Tabelle (sonst Word-Bug)
    xml.push('<w:p></w:p>');
    return xml.join('');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
  function fmtEUR(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return n.toLocaleString('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    });
  }
  function slugify(s) {
    return String(s).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
  }

  // EXPORT
  global.DealPilotRND_DOCX = {
    generate: generateGutachten,
    generateGutachten: generateGutachten
  };
})(typeof window !== 'undefined' ? window : globalThis);
