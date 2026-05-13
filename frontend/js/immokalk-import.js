'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V63.36 — ImmoKalk Excel-Import

   Importiert Eingaben aus einer ImmoKalk-Excel-Datei (.xlsx/.xlsm).
   Erkennt das Sheet "Immobilienkalkulation" und mappt die festen
   Zellen auf die DealPilot-Hauptfelder.

   Excel-Struktur (validiert mit ImmoKalk_Beispiel V3.2):

   Spaltenblock A-D (Objekt + Investition):
     B9, D9            PLZ, Ort
     B10, D10          Straße, Hausnummer
     B11, D11          Kaufdatum, Kürzel
     B12               Objektart (z.B. ETW)
     B13, D13          Wohnfläche, Bezeichnung
     C16               Kaufpreis
     C18, C19, C20     Makler %, Notar %, GBA % (Ausgangswerte)
     C21, C22          GrESt %, Junker %
     A29 (D29)         Bewertung Bank
     A30 (D30)         Bewertung Immoscout
     A31 (D31)         SVW Sachwert/Ertragswert
     B32-D32           Geschätzte Kaltmiete
     D34, F34, F35     Ausstattung, Grundstücksfläche, MEA-Anteil

   Spaltenblock F-J (Miete, Steuern, BWK):
     G9                NKM/Jahr
     G10               Zus. Einnahmen / Jahr
     G11               Umlagefähige Kosten / Jahr (UF)
     G12               Warmmiete / Jahr (= NKM+ZE+UF)
     G15               AfA-Satz (z.B. 0.02)
     G18               zvE
     G19               EinkommensSt. Vorjahr
     F22               Eigene Instandhaltungs-Rückl. €/m²
     F27, F28, F29     Kostensteig., Wertsteig., Leerstand p.a.
     J9                BWK umlagefähig / Jahr
     J10               BWK nicht umlagefähig / Jahr
     J18               Hausgeld umlagef. (Detail)
     J19               Grundsteuer
     J24               Hausgeld nicht umlagef.
     J25               davon WEG-Rücklage

   Spaltenblock L-M (Finanzierung):
     M9                Darlehenssumme (gesamt — Info)
     M10               Eigenkapital
     M18               Anfängliche Darlehenssumme D1
     M20 (L20)         Zinssatz nominal D1 (z.B. 0.035)
     M21 (L21)         Anfängliche Tilgung D1 (z.B. 0.01)
     M26 (L26)         Zinsbindung in Jahren
   ═══════════════════════════════════════════════════════════════ */

window.ImmoKalkImport = (function() {

  function _readCellValue(ws, addr) {
    if (!ws || !ws[addr]) return null;
    var c = ws[addr];
    return (c.v !== undefined) ? c.v : null;
  }

  function _toNum(v, fallback) {
    if (v === null || v === undefined || v === '') return fallback || 0;
    var n = parseFloat(v);
    return isNaN(n) ? (fallback || 0) : n;
  }

  function _toStr(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function _excelDateToDate(serial) {
    // Excel speichert Datum als Tage seit 1900-01-00 (mit dem berühmten 1900-Bug)
    if (!serial || isNaN(serial)) return null;
    if (typeof serial === 'string') return new Date(serial);
    if (serial instanceof Date) return serial;
    var ms = (serial - 25569) * 86400 * 1000;
    return new Date(ms);
  }

  function _formatDateDe(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.split('T')[0];
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  }

  /**
   * Liest ImmoKalk-Excel und gibt ein DealPilot-konformes Daten-Objekt zurück.
   * @param {ArrayBuffer} arrayBuffer - Inhalt der Excel-Datei
   * @returns {Object} mit fields (Map) und issues (Array)
   */
  function parse(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) ist nicht geladen.');
    }

    var wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // V63.43: Format-Detection — entweder ImmoKalk oder immocation "Roter Faden"
    var hasCockpit = wb.SheetNames.some(function(n) { return n === 'Cockpit'; });
    var hasImmokalk = wb.SheetNames.some(function(n) {
      return n === 'Immobilienkalkulation' || n.toLowerCase().indexOf('immobilien') === 0;
    });

    if (hasCockpit && !hasImmokalk) {
      return _parseImmocation(wb);
    }
    return _parseImmoKalk(wb);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // immocation "Roter Faden" / "Cockpit"-Layout
  // ═══════════════════════════════════════════════════════════════════════
  function _parseImmocation(wb) {
    var ws = wb.Sheets['Cockpit'];
    if (!ws) throw new Error('Cockpit-Sheet nicht gefunden.');
    var R = function(addr) { return _readCellValue(ws, addr); };
    var issues = [];

    // ═════ Objekt-Stammdaten — Adresse ist eine Sammelzelle (C9) ═════
    var addrRaw = _toStr(R('C9'));    // "Musterstraße 123, 45678 Musterstadt"
    var plz = '', ort = '', strasse = '', hausnr = '';
    var addrMatch = addrRaw.match(/^(.+?)\s+(\d+\w*)\s*,\s*(\d{4,5})\s+(.+)$/);
    if (addrMatch) {
      strasse = addrMatch[1].trim();
      hausnr  = addrMatch[2].trim();
      plz     = addrMatch[3].trim();
      ort     = addrMatch[4].trim();
    } else {
      // Fallback: irgendwie sinnvoll auseinander nehmen
      strasse = addrRaw;
    }
    var kaufdatumRaw = R('C10');
    var kuerzel   = _toStr(R('E10'));
    var wfl       = _toNum(R('C11'));
    var objektart = 'ETW';   // Default — immocation hat keinen Typ-Selector im Cockpit

    var kaufdatum = '';
    if (kaufdatumRaw) {
      var d = (kaufdatumRaw instanceof Date) ? kaufdatumRaw : _excelDateToDate(kaufdatumRaw);
      kaufdatum = _formatDateDe(d);
    }

    // ═════ Kaufpreis und Erwerbsnebenkosten ═════
    var kp        = _toNum(R('D14'));
    var makler_p  = _toNum(R('D16')) * 100;
    var notar_p   = _toNum(R('D17')) * 100;
    var gba_p     = _toNum(R('D18')) * 100;
    var gest_p    = _toNum(R('D19')) * 100;
    var ji_p      = _toNum(R('D20')) * 100;

    // immocation hat keinen Verkehrswert/SVW im Cockpit
    var svw = 0;

    // ═════ Mieten — V63.44: Beide Varianten (Roter Faden + Pro) abdecken ═════
    // Roter Faden: H9 = NKM/Mon (Pauschal). Pro: H9 = NKM/qm, H10 = NKM × Wfl insgesamt.
    // Detection: ist H10 deutlich größer als H9? Dann ist H10 die gesamte NKM,
    // sonst H9. Stellplätze (H11) und Sonstiges (H12) addieren wir wenn vorhanden.
    var h9  = _toNum(R('H9'));
    var h10 = _toNum(R('H10'));
    var h11 = _toNum(R('H11'));
    var h12 = _toNum(R('H12'));
    var h13 = _toNum(R('H13'));      // "= Nettokaltmiete" gesamt im Pro-Layout
    var h15 = _toNum(R('H15'));      // "= NKM (effektiv)" im Pro-Layout
    var h16 = _toNum(R('H16'));      // umlagefähige Kosten/Mon
    var nkm, uf, ze;
    var labelH9 = _toStr(R('G9')) || '';
    var isProFormat = labelH9.toLowerCase().indexOf('pro qm') !== -1 || labelH9.toLowerCase().indexOf('pro m²') !== -1;
    if (isProFormat || (h13 > h9 * 5 && h10 > h9 * 5)) {
      // Pro-Layout: H13 oder H15 ist die effektive NKM
      nkm = h15 || h13 || h10;
      // Stellplätze + Sonstiges = zE
      ze = h11 + h12;
      uf = h16 || _toNum(R('H10'));   // umlagefähig kann verschieden stehen
    } else {
      // Roter Faden: H9 = NKM, H10 = umlagefähig
      nkm = h9;
      ze = 0;
      uf = h10;
    }

    // ═════ Steuern — beide Varianten (AfA-Satz Position unterschiedlich) ═════
    var afa_satz = _toNum(R('H15'));   // Roter Faden
    if (afa_satz < 0.005 || afa_satz > 0.05) {
      afa_satz = _toNum(R('H20'));     // Pro: AfA-Satz in H20
    }
    var afa_pct  = afa_satz * 100;
    var wsEkst = wb.Sheets['ekst_rf'];
    var zvE = wsEkst ? _toNum(_readCellValue(wsEkst, 'C9')) : 0;
    var grenz = _toNum(R('Q33'));
    if (!grenz && wsEkst) grenz = _toNum(_readCellValue(wsEkst, 'C35'));

    // ═════ Bewirtschaftung — Cockpit Detail-Layout ═════
    // Roter Faden: K18-K28. Pro: J19/K19 = Hausgeld, K20 = Grundsteuer, K25 = HG nul, K26 = WEG
    var hg_ul       = _toNum(R('K19')) || _toNum(R('K18'));    // Pro: K19, RF: K18
    var grundsteuer = _toNum(R('K20')) || _toNum(R('K19'));    // Pro: K20, RF: K19
    var ul_sonst    = _toNum(R('K21')) || _toNum(R('K20'));
    var hg_nul      = _toNum(R('K25')) || _toNum(R('K24'));    // Pro: K25, RF: K24
    var weg_r       = _toNum(R('K26')) || _toNum(R('K25'));
    var eigen_r_qm  = _toNum(R('H26')) || _toNum(R('H21'));    // Pro: H26, RF: H21
    var eigen_r     = eigen_r_qm * wfl;
    var mietausfall_pct = _toNum(R('H25')) || _toNum(R('H20'));   // Pro: H25, RF: H20
    var mietausfall = mietausfall_pct > 0 ? Math.round(nkm * 12 * mietausfall_pct) : 0;
    // Wenn Hausgeld umlagef. leer ist, fallback: Cockpit zeigt H/K Spalten Monatswerte ×12
    if (hg_ul === 0 && hg_nul === 0) {
      // Fallback: nur "Hausgeld insgesamt" K15 verwenden, splitten 50/50
      var hg_ges_m = _toNum(R('K15'));
      if (hg_ges_m > 0) {
        hg_ul = Math.round(hg_ges_m * 12 * 0.5);
        hg_nul = Math.round(hg_ges_m * 12 * 0.5);
      }
    } else {
      // Werte aus immocation sind monatlich → auf Jahr umrechnen
      hg_ul       = hg_ul * 12;
      grundsteuer = grundsteuer * 12;
      ul_sonst    = ul_sonst * 12;
      hg_nul      = hg_nul * 12;
      weg_r       = weg_r * 12;
    }

    // ═════ Finanzierung ═════
    var d1     = _toNum(R('N17')) || _toNum(R('N9'));
    var ek     = _toNum(R('N10'));
    var d1z    = _toNum(R('N18')) * 100;
    var d1t    = _toNum(R('N19')) * 100;
    // immocation hat keine Zinsbindung → Default 10 J, oder Volltilgung-Jahre wenn passend
    var volltilg_jahr = _toNum(R('N21'));
    var heute_jahr    = new Date().getFullYear();
    var d1bind = 10;        // Default
    if (volltilg_jahr > heute_jahr && volltilg_jahr - heute_jahr <= 30) {
      d1bind = volltilg_jahr - heute_jahr;
    }
    issues.push('Hinweis immocation-Format: Zinsbindung wurde auf ' + d1bind + ' Jahre gesetzt (immocation kennt keine Bindung). Bitte ggf. anpassen.');

    // ═════ Annahmen — Pro: H30/H31/H32, Roter Faden: H25/H26/H27 ═════
    var kostenstg = (_toNum(R('H30')) || _toNum(R('H25'))) * 100;
    var mietstg   = (_toNum(R('H31')) || _toNum(R('H26'))) * 100;
    var wertstg   = (_toNum(R('H32')) || _toNum(R('H27'))) * 100;

    // ═════ Plausibility-Checks ═════
    if (kp <= 0) issues.push('Kaufpreis (D14) konnte nicht gelesen werden.');
    if (nkm <= 0) issues.push('Nettokaltmiete (H9) konnte nicht gelesen werden.');
    if (d1 <= 0) issues.push('Darlehenssumme (N17/N9) konnte nicht gelesen werden.');
    if (wfl <= 0) issues.push('Wohnfläche (C11) konnte nicht gelesen werden.');
    if (!strasse) issues.push('Adresse (C9) konnte nicht geparst werden.');

    var fields = {
      plz: plz, ort: ort, str: strasse, hnr: hausnr,
      kaufdat: kaufdatum, kuerzel: kuerzel, objart: objektart, wfl: wfl,
      baujahr: '',     // V63.44: immocation hat kein Baujahr — leer lassen
      kp: kp, makler_p: makler_p, notar_p: notar_p, gba_p: gba_p, gest_p: gest_p, ji_p: ji_p,
      svwert: svw,
      nkm: nkm, ze: ze, umlagef: uf,
      hg_ul: hg_ul, grundsteuer: grundsteuer, ul_sonst: ul_sonst,
      hg_nul: hg_nul, weg_r: weg_r, eigen_r: eigen_r, mietausfall: mietausfall,
      d1: d1, ek: ek, d1z: d1z, d1t: d1t, d1_bindj: d1bind,
      grenz: grenz > 0 ? (grenz < 1 ? grenz * 100 : grenz) : 42,
      zve: zvE,
      mietstg: mietstg || 1.5,
      kostenstg: kostenstg || 1,
      wertstg: wertstg || 1.5,
      btj: 20,
      _format: 'immocation'
    };
    var afa_dropdown = '2.0';
    if (afa_pct >= 2.95) afa_dropdown = '3.0';
    else if (afa_pct >= 2.45) afa_dropdown = '2.5';
    fields.afa_satz = afa_dropdown;

    return { fields: fields, issues: issues };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ImmoKalk-Layout (bestehende Logik)
  // ═══════════════════════════════════════════════════════════════════════
  function _parseImmoKalk(wb) {
    var sheetName = wb.SheetNames.find(function(n) {
      return n.toLowerCase().indexOf('immobilien') === 0 || n === 'Immobilienkalkulation';
    });
    if (!sheetName) sheetName = wb.SheetNames[0];

    var ws = wb.Sheets[sheetName];
    if (!ws) throw new Error('Kein passendes Arbeitsblatt gefunden.');

    var R = function(addr) { return _readCellValue(ws, addr); };
    var issues = [];

    // V63.40: Label-basierter Lookup — robuster gegen verschobenes Excel-Layout.
    // Sucht in einer Spalte (labelCol) nach einem Label-Text (case-insensitive,
    // partial match) und gibt den Wert in der Spalte mit Offset zurück.
    function findByLabel(labelText, labelCol, valueColOffset, rowMin, rowMax) {
      var minR = rowMin || 1, maxR = rowMax || 50;
      var search = labelText.toLowerCase();
      for (var r = minR; r <= maxR; r++) {
        var lv = _readCellValue(ws, labelCol + r);
        if (typeof lv === 'string' && lv.toLowerCase().indexOf(search) !== -1) {
          var valCol = String.fromCharCode(labelCol.charCodeAt(0) + (valueColOffset || 1));
          var v = _readCellValue(ws, valCol + r);
          if (v !== null && v !== undefined && v !== '') return v;
        }
      }
      return null;
    }

    // ═════ Objekt-Stammdaten ═════
    var plz       = _toStr(R('B9'));
    var ort       = _toStr(R('D9'));
    var strasse   = _toStr(R('B10'));
    var hausnr    = _toStr(R('D10'));
    var kaufdatumRaw = R('B11');
    var kuerzel   = _toStr(R('D11'));
    var objektart = _toStr(R('B12')) || 'ETW';
    var baujahr   = _toNum(R('D12'));   // V63.44: Baujahr aus D12
    var wfl       = _toNum(R('B13'));
    var bezeichn  = _toStr(R('D13')) || objektart;

    var kaufdatum = '';
    if (kaufdatumRaw) {
      var d = (kaufdatumRaw instanceof Date) ? kaufdatumRaw : _excelDateToDate(kaufdatumRaw);
      kaufdatum = _formatDateDe(d);
    }

    // ═════ Kaufpreis und Erwerbsnebenkosten ═════
    var kp        = _toNum(R('C16'));
    var makler_p  = _toNum(R('C18')) * 100;
    var notar_p   = _toNum(R('C19')) * 100;
    var gba_p     = _toNum(R('C20')) * 100;
    var gest_p    = _toNum(R('C21')) * 100;
    var ji_p      = _toNum(R('C22')) * 100;

    // ═════ Bewertung ═════
    var bewertBank   = _toNum(R('D29'));
    var bewertScout  = _toNum(R('D30'));
    var svw          = _toNum(R('D31'));
    if (svw === 0 && (bewertBank > 0 || bewertScout > 0)) {
      svw = (bewertBank + bewertScout) / 2;
    }

    // ═════ Mieten (Excel-Werte sind Jahres-Werte) ═════
    var nkmJahr  = _toNum(R('G9'));
    var zeJahr   = _toNum(R('G10'));
    var ufJahr   = _toNum(R('G11'));
    var nkm = Math.round(nkmJahr / 12 * 100) / 100;
    var ze  = Math.round(zeJahr  / 12 * 100) / 100;
    var uf  = Math.round(ufJahr  / 12 * 100) / 100;

    // ═════ Steuern ═════
    var afa_satz = _toNum(R('G15'));
    var afa_pct = afa_satz * 100;       // Excel speichert 0.02 → DealPilot 2.0
    var zvE      = _toNum(R('G18'));
    var grenz    = _toNum(R('V39')); // Persönlicher Grenzsteuersatz aus Kennzahlen

    // ═════ Bewirtschaftung — Detail-Aufschlüsselung wie in DealPilot Tab Bewirtschaftung ═════
    var hg_ul       = _toNum(R('J18')); // Hausgeld umlagefähiger Teil (z.B. 1391)
    var grundsteuer = _toNum(R('J19')); // Grundsteuer (z.B. 336)
    var ul_sonst    = _toNum(R('J20')); // Sonstiges umlagefähig
    var hg_nul      = _toNum(R('J24')); // Hausgeld nicht-umlagefähig (z.B. 1599.46)
    var weg_r       = _toNum(R('J25')); // WEG-Rücklage (Info, z.B. 798)
    var eigen_r_qm  = _toNum(R('F22')); // Eigene Instandhaltungs-Rücklage €/m² p.a.
    var eigen_r     = eigen_r_qm * wfl;
    var mietausfall = 0;                // Excel hat das im Detail nicht gesondert
    // Fallback: Wenn die Detail-Aufschlüsselung leer ist, nimm die Summen
    if (hg_ul + grundsteuer + ul_sonst === 0) {
      hg_ul = _toNum(R('J9'));         // Summe umlagefähig fallback
    }
    if (hg_nul === 0) {
      hg_nul = _toNum(R('J10'));        // Summe nicht-umlagef. fallback
    }

    // ═════ Finanzierung — V63.40: Label-basiert (robuster gegen Layout-Versionen) ═════
    var d1_label = findByLabel('Darlehenssumme', 'L', 1, 14, 30);
    var d1       = _toNum(d1_label !== null ? d1_label : R('M18')) || _toNum(R('M9'));
    var ek       = _toNum(findByLabel('Eigenkapital', 'L', 1, 8, 14)) || _toNum(R('M10'));
    // Zinssatz: nimm das ERSTE "Zinssatz"-Feld (gewichtet ist später, ist gleicher Wert für 1 Darlehen)
    var d1z_raw  = findByLabel('Zinssatz', 'L', 1, 14, 30);
    if (d1z_raw === null) d1z_raw = R('M19');  // Fallback Bad-Oe
    if (d1z_raw === null) d1z_raw = R('M20');  // Fallback ImmoKalk-Beispiel
    var d1z      = _toNum(d1z_raw) * 100;
    // Tilgung: "Anfängliche Tilgung"
    var d1t_raw  = findByLabel('Anfängliche Tilgung', 'L', 1, 14, 30);
    if (d1t_raw === null) d1t_raw = R('M20');
    if (d1t_raw === null) d1t_raw = R('M21');
    var d1t      = _toNum(d1t_raw) * 100;
    // Zinsbindung
    var d1bind_raw = findByLabel('Zinsbindung', 'L', 1, 14, 30);
    if (d1bind_raw === null) d1bind_raw = R('M24');
    if (d1bind_raw === null) d1bind_raw = R('M26');
    var d1bind   = _toNum(d1bind_raw);

    // ═════ Entwicklung / Annahmen ═════
    var kostenstg = _toNum(R('G27')) * 100;
    var wertstg   = _toNum(R('G28')) * 100;
    var leerstand = _toNum(R('G29')) * 100;
    var btj_excel = _toNum(R('Y10'));   // Hochrechnungsjahre

    // ═════ Zusammenstellen — IDs müssen exakt zu DealPilot-HTML passen ═════
    var fields = {
      // Adresse / Objekt — KORRIGIERT V63.38
      plz: plz,
      ort: ort,
      str: strasse,           // war: strasse
      hnr: hausnr,            // war: hausnr
      kaufdat: kaufdatum,     // war: kaufdatum
      kuerzel: kuerzel,
      objart: objektart,      // war: objektart
      // bezeichnung gibt es nicht als eigenes Feld
      baujahr: baujahr || '',
      wfl: wfl,
      // Investition (% wird auto in € synchronisiert)
      kp: kp,
      makler_p: makler_p,
      notar_p: notar_p,
      gba_p: gba_p,
      gest_p: gest_p,
      ji_p: ji_p,
      svwert: svw,
      // Mieten
      nkm: nkm,
      ze: ze,
      umlagef: uf,
      // Bewirtschaftung — Detail-Felder direkt befüllen
      hg_ul: hg_ul,
      grundsteuer: grundsteuer,
      ul_sonst: ul_sonst,
      hg_nul: hg_nul,
      weg_r: weg_r,
      eigen_r: eigen_r,
      mietausfall: mietausfall,
      // Finanzierung
      d1: d1,
      ek: ek,
      d1z: d1z,
      d1t: d1t,
      d1_bindj: d1bind,
      // Steuern
      grenz: grenz > 0 ? grenz * 100 : 42, // Excel speichert als Bruchteil → in %
      zve: zvE,                            // zvE-Feld in DealPilot (Steuer-Tab)
      // Annahmen
      mietstg: 1.5,                       // Default
      kostenstg: kostenstg || 1,
      wertstg: wertstg || 1.5,
      leerstand: leerstand,
      btj: btj_excel || 20
    };

    // Spezial: AfA-Satz als Dropdown-Wert (DealPilot hat Dropdown 2/2.5/3)
    var afa_dropdown = '2.0';
    if (afa_pct >= 2.95) afa_dropdown = '3.0';
    else if (afa_pct >= 2.45) afa_dropdown = '2.5';
    fields.afa_satz = afa_dropdown;

    // ═════ Plausibility-Checks ═════
    if (kp <= 0) issues.push('Kaufpreis (C16) konnte nicht gelesen werden.');
    if (nkmJahr <= 0) issues.push('Nettokaltmiete (G9) konnte nicht gelesen werden.');
    if (d1 <= 0) issues.push('Darlehenssumme (M18 oder M9) konnte nicht gelesen werden.');
    if (wfl <= 0) issues.push('Wohnfläche (B13) konnte nicht gelesen werden.');
    if (!strasse) issues.push('Straße (B10) konnte nicht gelesen werden.');
    if (!ort) issues.push('Ort (D9) konnte nicht gelesen werden.');
    if (hg_ul + grundsteuer + hg_nul === 0) {
      issues.push('Bewirtschaftungskosten (J18, J19, J24) konnten nicht gelesen werden.');
    }

    return {
      fields: fields,
      issues: issues,
      meta: {
        sheetName: sheetName,
        kuerzel: kuerzel,
        kaufdatum: kaufdatum
      }
    };
  }

  /**
   * Wendet die importierten Werte auf die Hauptfelder an.
   * Ruft anschließend calc() auf, damit alle Kennzahlen neu berechnet werden.
   */
  function applyToForm(fields) {
    var setVal = function(id, val) {
      var e = document.getElementById(id);
      if (!e) return;
      if (val === null || val === undefined || val === '') return;
      // Select-Felder: option matchen
      if (e.tagName === 'SELECT') {
        var found = false;
        for (var i = 0; i < e.options.length; i++) {
          if (e.options[i].value == val) {  // == für locker (string vs number)
            e.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) {
          // Fallback: den am nächsten passenden Eintrag wählen
          var lower = String(val).toLowerCase();
          for (var j = 0; j < e.options.length; j++) {
            if (e.options[j].value.toLowerCase().indexOf(lower) >= 0 ||
                e.options[j].text.toLowerCase().indexOf(lower) >= 0) {
              e.selectedIndex = j;
              break;
            }
          }
        }
        return;
      }
      // Checkbox
      if (e.type === 'checkbox') {
        e.checked = !!val;
        return;
      }
      // Number/Text-Inputs
      if (typeof val === 'number') {
        var rounded = Math.round(val * 100) / 100;
        e.value = rounded.toString().replace('.', ',');
      } else {
        e.value = val;
      }
      // V63.48: input-Event triggern damit andere Listener (Workflow-Bar etc.) reagieren
      try {
        e.dispatchEvent(new Event('input', { bubbles: true }));
      } catch(_) {}
    };

    Object.keys(fields).forEach(function(key) {
      // V63.43: Meta-Felder beginnen mit "_", die nicht ins Form gehören
      if (key.charAt(0) === '_') return;
      setVal(key, fields[key]);
    });

    // V63.38: Nach Setzen der Prozent-Felder die Euro-Beträge aktualisieren.
    // Diese Felder sind verlinkt (% ↔ €) — calc() liest die %-Werte und berechnet
    // die €-Werte. Damit auch die "Sync"-Optik stimmt, syncCostPct nochmal triggern.
    ['makler','notar','gba','gest','ji'].forEach(function(prefix) {
      try {
        if (typeof syncCostPct === 'function') syncCostPct(prefix);
      } catch(e) {}
    });

    // Berechnung neu triggern
    if (typeof calc === 'function') calc();

    // V63.48: Workflow-Bar explizit refreshen — die hat bei applyToForm
    // ggf. nicht alle Felder mit Events erfasst (insbesondere Selects).
    if (window.DealPilotWorkflow && typeof DealPilotWorkflow.renderProgressBar === 'function') {
      setTimeout(DealPilotWorkflow.renderProgressBar, 100);
      setTimeout(DealPilotWorkflow.renderProgressBar, 400);
    }
  }

  return {
    parse: parse,
    applyToForm: applyToForm
  };
})();

/**
 * Globaler Onclick-Handler für den Import-Button.
 * Liest Datei, parst, zeigt Bestätigungsdialog, übernimmt Werte.
 */
window.importImmoKalkExcel = function(input) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();

  reader.onload = function(e) {
    try {
      var result = window.ImmoKalkImport.parse(e.target.result);

      // Issues-Hinweis
      var issuesText = '';
      if (result.issues.length > 0) {
        issuesText = '\n\n⚠ Hinweise:\n• ' + result.issues.join('\n• ');
      }

      var f = result.fields;
      var formatLabel = f._format === 'immocation' ? 'immocation "Roter Faden"' : 'ImmoKalk';

      // V63.47: BUG-FIX — wenn gerade ein Objekt geladen ist, würde der Import
      // dessen Felder überschreiben. Stattdessen: ein neues Objekt anlegen.
      var hasLoadedObject = !!window._currentObjKey;
      var contextHint = hasLoadedObject
        ? '\n\nℹ Aktuell ist ein Objekt geladen. Der Import wird ein NEUES Objekt anlegen — das geladene Objekt bleibt unverändert.'
        : '\n\nDie Werte werden in das aktuelle (leere) Formular übernommen.';

      var summary =
        'Excel-Import erkannt (' + formatLabel + '):\n\n' +
        '• Objekt:    ' + (f.kuerzel || '—') + '  (' + (f.objart || 'ETW') + ')\n' +
        '• Adresse:   ' + (f.str || '—') + ' ' + (f.hnr || '') +
                      ', ' + (f.plz || '—') + ' ' + (f.ort || '') + '\n' +
        '• Kaufpreis: ' + Math.round(f.kp).toLocaleString('de-DE') + ' €\n' +
        '• Wohnfl.:   ' + f.wfl + ' m²\n' +
        '• NKM/Mon:   ' + f.nkm.toLocaleString('de-DE') + ' €\n' +
        '• zE/Mon:    ' + (f.ze || 0).toLocaleString('de-DE') + ' €\n' +
        '• Darlehen:  ' + Math.round(f.d1).toLocaleString('de-DE') + ' €\n' +
        '• Eigenkap.: ' + Math.round(f.ek).toLocaleString('de-DE') + ' €\n' +
        '• Zins/Tilg: ' + f.d1z.toFixed(2) + '% / ' + f.d1t.toFixed(2) + '%\n' +
        '• Bindung:   ' + (f.d1_bindj || 10) + ' Jahre\n' +
        '• Hausgeld umlf.:    ' + Math.round(f.hg_ul || 0).toLocaleString('de-DE') + ' €/J\n' +
        '• Grundsteuer:       ' + Math.round(f.grundsteuer || 0).toLocaleString('de-DE') + ' €/J\n' +
        '• Hausgeld n.umlf.:  ' + Math.round(f.hg_nul || 0).toLocaleString('de-DE') + ' €/J' +
        issuesText +
        contextHint +
        '\n\nFortfahren?';

      if (!confirm(summary)) {
        input.value = '';
        return;
      }

      // V63.47: Bei geladenem Objekt → Form leeren, neue ID, dann importieren
      if (hasLoadedObject && typeof window._clearFormForNewObject === 'function') {
        window._clearFormForNewObject();
      }

      window.ImmoKalkImport.applyToForm(f);

      // Settings-Modal schließen damit User die Werte sieht
      if (typeof closeSettings === 'function') closeSettings();

      // V63.47: Auf Tab Objekt wechseln, damit User die Daten sieht
      if (typeof switchTab === 'function') {
        setTimeout(function() { switchTab(0); }, 100);
      }

      // Erfolgsmeldung
      if (typeof toast === 'function') {
        toast(hasLoadedObject
          ? '✓ Excel-Daten in NEUES Objekt importiert. Bitte speichern, um es zu sichern.'
          : '✓ Excel-Daten importiert. Bitte Tab "Kennzahlen" prüfen.');
      } else {
        alert('✓ Excel-Daten importiert.');
      }

    } catch (err) {
      console.error('ImmoKalk-Import-Fehler:', err);
      alert('Fehler beim Lesen der Excel-Datei:\n\n' + err.message +
            '\n\nStelle sicher dass es eine ImmoKalk-Datei ist und das Sheet "Immobilienkalkulation" existiert.');
    }

    input.value = ''; // Input zurücksetzen für erneuten Import
  };

  reader.onerror = function() {
    alert('Datei konnte nicht gelesen werden.');
    input.value = '';
  };

  reader.readAsArrayBuffer(file);
};
