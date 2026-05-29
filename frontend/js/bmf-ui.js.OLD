'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V35 — BMF-UI (Modal, Recalc, Apply)
═══════════════════════════════════════════════════════════════ */

var _bmfLastResult = null;

function openBMFRechner() {
  // V63.82: Plan-Gate — BMF-Rechner ist Investor+
  if (typeof Plan !== 'undefined' && !Plan.can('bmf_calc_export')) {
    if (typeof toast === 'function') toast('🔒 BMF-Rechner ist Teil des Investor-Plans');
    if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 600);
    return;
  }
  if (!window.BMFData || !window.BMFAfA) {
    if (typeof toast === 'function') toast('⚠ BMF-Datentabellen nicht geladen.');
    return;
  }
  // Dropdown füllen (nur einmal)
  var sel = document.getElementById('bmf_art');
  if (sel && sel.options.length <= 1) {
    var arten = window.BMFData.arten;
    arten.forEach(function(a, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = a.name;
      sel.appendChild(opt);
    });
    // V36: Grundstücksart aus Objekt-Auswahl (Wohnung/Haus/MFH) raten
    var objArt = (document.getElementById('objart') || {}).value || '';
    var weIdx = arten.findIndex(function(a) {
      if (/wohnung/i.test(objArt) && /Wohnungseigentum/i.test(a.name)) return true;
      if (/mehrfamilien/i.test(objArt) && /Mietwohngrundstücke/i.test(a.name)) return true;
      if (/efh|einfamilien/i.test(objArt) && /\[EFH\] freistehend, KG, EG, OG, DG voll/i.test(a.name)) return true;
      return false;
    });
    if (weIdx === -1) {
      // Default fallback
      weIdx = arten.findIndex(function(a) { return /Wohnungseigentum/i.test(a.name); });
    }
    if (weIdx >= 0) sel.value = weIdx;
  }

  // V36: Erweitertes Auto-Prefill aus Objektdaten
  // Quellen: Tab Objekt&Fotos, Investition, Steuer-Details
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function num(id) { return parseDe(val(id)); }

  var kp           = num('kp');
  var bj           = parseInt(val('baujahr')) || 0;
  var wfl          = num('wfl');
  // V53-FIX: korrektes Field-Mapping aus Tab Objekt
  //   - 'gsfl' (Grundstücksfläche m²)  statt nicht-existentes 'grundst'
  //   - 'brw'  (Bodenrichtwert €/m²)   bleibt, war OK
  //   - 'mea'  ist Prozent (z.B. 7,06%) → in Bruch konvertieren (Z=7060, N=100000)
  var grundstueck  = num('gsfl');           // V53: war 'grundst' — Bug
  var brw          = num('brw');
  var meaPct       = num('mea');            // V53: war 'mea_z'+'mea_n' — Bug
  var meaZ = '', meaN = '';
  if (meaPct > 0) {
    meaZ = Math.round(meaPct * 1000);       // 7,06 → 7060
    meaN = 100000;                          // /100000
  }
  var kaufdat      = val('kaufdat');
  var anschJ       = kaufdat ? parseInt(kaufdat.slice(0, 4)) : new Date().getFullYear();

  // V36: setIfNotTouched — nur überschreiben wenn:
  //   - das Feld leer ist ODER
  //   - der User es noch nicht selbst editiert hat
  function setIfNotTouched(id, value) {
    var e = document.getElementById(id);
    if (!e) return;
    var touched = e.dataset.bmfTouched === '1';
    if (touched) return;       // User hat manuell gesetzt → nicht überschreiben
    if (value !== null && value !== undefined && value !== '' && value !== 0) {
      e.value = value;
    }
  }

  // Listener einmal registrieren — bei Input das Feld als "touched" markieren
  ['bmf_kp','bmf_bj','bmf_wfl','bmf_anschj','bmf_gst','bmf_brw','bmf_mea_z','bmf_mea_n']
    .forEach(function(id) {
      var e = document.getElementById(id);
      if (e && !e.dataset.bmfListener) {
        e.dataset.bmfListener = '1';
        e.addEventListener('input', function() { e.dataset.bmfTouched = '1'; });
      }
    });

  setIfNotTouched('bmf_kp',     kp);
  setIfNotTouched('bmf_bj',     bj);
  setIfNotTouched('bmf_wfl',    wfl);
  setIfNotTouched('bmf_anschj', anschJ);
  setIfNotTouched('bmf_gst',    grundstueck);
  setIfNotTouched('bmf_brw',    brw);
  setIfNotTouched('bmf_mea_z',  meaZ);
  setIfNotTouched('bmf_mea_n',  meaN);

  // Modal anzeigen
  var ov = document.getElementById('bmf-overlay');
  if (ov) ov.style.display = 'flex';
  bmfRecalc();
}

function closeBMFRechner() {
  var ov = document.getElementById('bmf-overlay');
  if (ov) ov.style.display = 'none';
}

function bmfRecalc() {
  // Modernisierungs-Punkte aufsummieren
  var modSum = 0;
  for (var i = 1; i <= 8; i++) {
    var s = document.getElementById('bmf_mod_' + i);
    if (s) modSum += parseDe(s.value) || 0;
  }
  var modGradLabel =
    modSum >= 18 ? 'umfassend modernisiert' :
    modSum >= 13 ? 'überwiegend modernisiert' :
    modSum >= 8  ? 'mittlerer Modernisierungsgrad' :
    modSum >= 4  ? 'kleine Modernisierungen' : 'keine Modernisierung';
  var modSumEl = document.getElementById('bmf_mod_sum');
  if (modSumEl) modSumEl.textContent = 'Summe: ' + modSum + ' / 20 Punkte · ' + modGradLabel;

  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function num(id) { return parseFloat(val(id)) || 0; }
  function int(id) { return parseInt(val(id)) || 0; }

  var artIdx = parseInt(val('bmf_art'));
  if (isNaN(artIdx) || artIdx < 0) {
    _showResult({ error: 'Bitte Grundstücksart wählen.' });
    return;
  }

  var anschJ = int('bmf_anschj') || new Date().getFullYear();
  var bj = int('bmf_bj');
  var artGnd = window.BMFData.arten[artIdx].gnd;

  // Fiktives Baujahr berechnen
  var fbj = bj;
  var fbjInfo = null;
  if (modSum > 0 && bj > 0) {
    var fbjResult = window.BMFAfA.calcFiktivesBaujahr({
      baujahr: bj,
      anschaffungsjahr: anschJ,
      punkte: modSum,
      gnd: artGnd
    });
    fbj = fbjResult.fiktiv;
    fbjInfo = fbjResult;
  }

  var result = window.BMFAfA.berechne({
    artIdx: artIdx,
    standardStufe: int('bmf_stufe') || 3,
    kaufpreis: num('bmf_kp'),
    baujahr: fbj,                        // ggf. fiktives Baujahr
    anschaffungsjahr: anschJ,
    wohnflaeche: num('bmf_wfl'),
    grundstueckSize: num('bmf_gst'),
    bodenrichtwert: num('bmf_brw'),
    mea_zaehler: num('bmf_mea_z'),
    mea_nenner: num('bmf_mea_n')
  });

  result._fbjInfo = fbjInfo;
  result._urspr_baujahr = bj;
  _showResult(result);
}

function _showResult(r) {
  var box = document.getElementById('bmf_result');
  var btn = document.getElementById('bmf_apply_btn');
  if (!box) return;

  if (r.error) {
    box.innerHTML = '<div class="bmf-err">' + r.error + '</div>';
    if (btn) btn.disabled = true;
    _bmfLastResult = null;
    return;
  }

  _bmfLastResult = r;
  if (btn) btn.disabled = false;

  function fE(n) {
    if (isNaN(n) || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }
  function fP(n, d) { d = d == null ? 1 : d; return n.toFixed(d).replace('.', ',') + ' %'; }

  var fbjBlock = '';
  if (r._fbjInfo && r._fbjInfo.fiktiv !== r._urspr_baujahr) {
    fbjBlock =
      '<div class="bmf-fbj">' +
        '<strong>Fiktives Baujahr:</strong> ' + r._fbjInfo.fiktiv + ' ' +
        '(ursprünglich ' + r._urspr_baujahr + ', Verjüngung ' + r._fbjInfo.verjüngungJahre + ' J · ' + r._fbjInfo.modernisierungsGrad + ')' +
      '</div>';
  }

  box.innerHTML =
    '<div class="bmf-result-section">' +
      '<h4>Aufteilung Bodenwert ↔ Gebäudewert</h4>' +
      fbjBlock +
      '<div class="bmf-kv"><span>Bodenwert</span><span class="kv-v">' + fE(r.bodenwert) + '</span></div>' +
      '<div class="bmf-kv"><span>Gebäudesachwert</span><span class="kv-v">' + fE(r.gebaeudeSachwert) + '</span></div>' +
      '<div class="bmf-kv bmf-kv-strong"><span>Anteil Boden / Gebäude</span><span class="kv-v">' + fP(r.anteilBoden*100) + ' / ' + fP(r.anteilGebaeude*100) + '</span></div>' +
    '</div>' +
    '<div class="bmf-result-section">' +
      '<h4>Aufteilung Kaufpreis (' + fE(r.kaufpreis) + ')</h4>' +
      '<div class="bmf-kv"><span>davon Boden</span><span class="kv-v">' + fE(r.bodenAnteilAmKp) + '</span></div>' +
      '<div class="bmf-kv bmf-kv-highlight"><span>davon <strong>Gebäude (AfA-Basis)</strong></span><span class="kv-v">' + fE(r.gebaeudeAnteilAmKp) + '</span></div>' +
    '</div>' +
    '<div class="bmf-result-section">' +
      '<h4>AfA-Empfehlung nach §7 EStG</h4>' +
      '<div class="bmf-kv bmf-kv-highlight"><span>AfA-Satz</span><span class="kv-v">' + fP(r.afaSatz) + '</span></div>' +
      '<div class="bmf-kv"><span>AfA pro Jahr</span><span class="kv-v">' + fE(r.afaJaehrlich) + '</span></div>' +
      '<div class="bmf-note">' + r.afaSatzBegruendung + '</div>' +
    '</div>' +
    '<details class="bmf-zwischen">' +
      '<summary>Zwischenwerte (Sachwertverfahren)</summary>' +
      '<div class="bmf-kv"><span>BGF-Kostenkennwert (Stufe ' + r.standardStufe + ')</span><span>' + fE(r.bgfKennwert) + '/m²</span></div>' +
      '<div class="bmf-kv"><span>Wfl-Kennwert × Faktor</span><span>' + fE(r.wflKennwert1) + '/m²</span></div>' +
      '<div class="bmf-kv"><span>Wfl-Anpassung × ' + fP(r.wflFaktor*100, 0) + '</span><span>' + fE(r.wflKennwert2) + '/m²</span></div>' +
      '<div class="bmf-kv"><span>+ 3% Außenanlagen</span><span>' + fE(r.wflKennwert3) + '/m²</span></div>' +
      '<div class="bmf-kv"><span>Bauindex ' + r.anschaffungsjahr + ' (' + r.idxAnschJahr + '%)</span><span>' + fE(r.wflKennwert4_indiziert) + '/m²</span></div>' +
      '<div class="bmf-kv"><span>Restwert nach Alterswertminderung (' + fP(r.restwertAnteil*100, 1) + ')</span><span>' + fE(r.wflKennwertFinal) + '/m²</span></div>' +
      '<div class="bmf-kv"><span>× ' + r.wohnflaeche + ' m² Wohnfläche</span><span><strong>' + fE(r.gebaeudeSachwert) + '</strong></span></div>' +
    '</details>';
}

function applyBMFResult() {
  if (!_bmfLastResult || _bmfLastResult.error) return;
  var r = _bmfLastResult;

  // AfA-Satz: passenden Select-Wert wählen
  var afaSel = document.getElementById('afa_satz');
  if (afaSel) {
    // Wert als String mit einer Nachkommastelle
    var target = r.afaSatz.toFixed(1);
    var found = false;
    for (var i = 0; i < afaSel.options.length; i++) {
      if (parseDe(afaSel.options[i].value).toFixed(1) === target) {
        afaSel.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) {
      // Custom Option ergänzen
      var opt = document.createElement('option');
      opt.value = target;
      opt.textContent = target.replace('.', ',') + ' % (BMF-empfohlen)';
      afaSel.appendChild(opt);
      afaSel.value = target;
    }
  }

  // Gebäudeanteil (%)
  var gebInp = document.getElementById('geb_ant');
  if (gebInp) {
    gebInp.value = (r.anteilGebaeude * 100).toFixed(1);
  }

  closeBMFRechner();
  if (typeof calc === 'function') calc();
  if (typeof toast === 'function') {
    toast('✓ BMF-Werte übernommen: AfA ' + r.afaSatz.toFixed(1) + '%, Gebäudeanteil ' + (r.anteilGebaeude*100).toFixed(1) + '%');
  }
}

// Globale Exports
window.openBMFRechner = openBMFRechner;
window.closeBMFRechner = closeBMFRechner;
window.bmfRecalc = bmfRecalc;
window.applyBMFResult = applyBMFResult;

/* ═══════════════════════════════════════════════════════════════
   V36: BMF-Excel-Export
   User wählt eigene BMF-Excel-Vorlage (oder die offizielle BMF-Datei).
   Werte werden in passende Zellen geschrieben, Datei als Download.
═══════════════════════════════════════════════════════════════ */

// Zentrales Mapping — Sheet "KPA" der BMF-Datei (Fassung Juni 2023)
var BMF_CELL_MAP = {
  'E7':   { source: 'art',         desc: 'Grundstücksart' },
  'G9':   { source: 'kaufdatum',   desc: 'Datum Kaufvertrag' },
  'K9':   { source: 'kaufpreis',   desc: 'Kaufpreis €' },
  'G11':  { source: 'baujahr',     desc: 'Baujahr' },
  'K11':  { source: 'wohnflaeche', desc: 'Wohnfläche m²' },
  'G15':  { source: 'mea_z',       desc: 'MEA Zähler' },
  'K15':  { source: 'mea_n',       desc: 'MEA Nenner' },
  'G17':  { source: 'grundst',     desc: 'Grundstück m²' },
  'K17':  { source: 'bodenrichtwert', desc: 'Bodenrichtwert €/m²' }
};

function exportBMFExcel() {
  var inp = document.getElementById('bmf-xlsx-upload');
  if (inp) inp.click();
}

/**
 * V53: Komplett neue BMF-Excel-Verarbeitung.
 *
 * Probleme der alten Version (V38-V52):
 *  - SheetJS Community Build droppt Styles inkonsistent beim Write
 *    → Resultat war eine 6.7 MB Datei mit nur 10% der Daten.
 *  - Felder wurden nur aus 'bmf_*'-Inputs gelesen; Auto-Prefill aus Tab Objekt
 *    nutzte falsche Feld-IDs ('grundst' statt 'gsfl', 'mea_z'+'mea_n' statt 'mea').
 *
 * Neue Strategie:
 *  - JSZip öffnet die .xlsx als ZIP-Archiv (XLSX = ZIP-of-XML)
 *  - sheet1.xml wird per Regex gepatcht — nur die Zielzellen werden ersetzt,
 *    alle anderen Daten/Styles/Formeln bleiben zu 100% erhalten
 *  - Resultat: ~170 KB große Datei (= Vorlage + minimale Änderungen)
 *
 * Zusätzlich Auto-Prefill mit korrektem Field-Mapping aus Tab Objekt.
 */
function _bmfHandleFile(file) {
  if (!file) return;
  if (typeof JSZip === 'undefined') {
    if (typeof toast === 'function') toast('⚠ JSZip-Library nicht geladen.');
    return;
  }

  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var ab = e.target.result;
      var zip = await JSZip.loadAsync(ab);

      // Sheet1 = "KPA" finden (über workbook.xml)
      var workbookXml = await zip.file('xl/workbook.xml').async('string');
      var sheetMatch = workbookXml.match(/<sheet[^>]+name="([^"]*KPA[^"]*)"[^>]+sheetId="(\d+)"[^>]+r:id="(rId\d+)"/i);
      if (!sheetMatch) {
        // Fallback: erstes Sheet nehmen
        sheetMatch = workbookXml.match(/<sheet[^>]+name="([^"]+)"[^>]+sheetId="(\d+)"[^>]+r:id="(rId\d+)"/);
      }
      if (!sheetMatch) {
        if (typeof toast === 'function') toast('⚠ Sheet-Definition in workbook.xml nicht gefunden.');
        return;
      }
      var sheetName = sheetMatch[1];

      // Welches sheet1.xml gehört zu KPA? Über _rels finden
      var relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
      var rId = sheetMatch[3];
      var sheetTargetMatch = relsXml.match(new RegExp('<Relationship[^>]+Id="' + rId + '"[^>]+Target="([^"]+)"'));
      var sheetPath;
      if (sheetTargetMatch) {
        sheetPath = 'xl/' + sheetTargetMatch[1].replace(/^\//, '').replace(/^xl\//, '');
      } else {
        sheetPath = 'xl/worksheets/sheet1.xml';
      }

      var sheetXml = await zip.file(sheetPath).async('string');

      // Quelldaten zusammenstellen — KORREKTES Field-Mapping (V53-Fix)
      function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
      function num(id) { return parseDe(val(id)); }
      var artIdx = parseInt(val('bmf_art'));
      var artName = (window.BMFData && !isNaN(artIdx) && window.BMFData.arten[artIdx])
        ? window.BMFData.arten[artIdx].name : '';

      // V53: MEA aus Tab Objekt ist Prozent (z.B. 7.06%) — in Bruch konvertieren
      // Zähler/Nenner-Heuristik: Prozent × 1000 = Zähler, Nenner = 100000
      var bmfMeaZ = parseInt(val('bmf_mea_z'));
      var bmfMeaN = parseInt(val('bmf_mea_n'));
      var meaZ, meaN;
      if (bmfMeaZ && bmfMeaN) {
        // Wenn der User in der BMF-Maske Z/N selbst eingegeben hat → benutzen
        meaZ = bmfMeaZ;
        meaN = bmfMeaN;
      } else {
        // Aus Tab Objekt: 'mea' ist Prozent (z.B. 7,06)
        var meaPct = num('mea');
        if (meaPct > 0) {
          // 7.06% → 7060/100000
          meaZ = Math.round(meaPct * 1000);
          meaN = 100000;
        } else {
          meaZ = '';
          meaN = '';
        }
      }

      var sources = {
        art:           artName,
        kaufdatum:     val('kaufdat') || '',
        kaufpreis:     num('bmf_kp') || num('kp') || '',
        baujahr:       parseInt(val('bmf_bj')) || parseInt(val('baujahr')) || '',
        wohnflaeche:   num('bmf_wfl') || num('wfl') || '',
        mea_z:         meaZ,
        mea_n:         meaN,
        // V53-FIX: 'grundst' aus BMF-Maske ODER 'gsfl' aus Tab Objekt
        grundst:       num('bmf_gst') || num('gsfl') || '',
        // V53-FIX: bodenrichtwert ebenfalls aus brw fallback
        bodenrichtwert: num('bmf_brw') || num('brw') || ''
      };

      // Cells patchen — nur die Zellen aus BMF_CELL_MAP werden ersetzt
      var written = 0, skipped = 0;
      var patchedXml = sheetXml;

      Object.keys(BMF_CELL_MAP).forEach(function(cell) {
        var spec = BMF_CELL_MAP[cell];
        var v = sources[spec.source];
        if (v === '' || v === null || v === undefined || v === 0) { skipped++; return; }

        // Datum konvertieren zu Excel-Serial
        var cellType = 'str';
        var cellValue;
        var inlineStr = false;

        if (spec.source === 'kaufdatum' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          var d = new Date(v);
          if (!isNaN(d.getTime())) {
            var epoch = Date.UTC(1899, 11, 30);
            var days = (d.getTime() - epoch) / 86400000;
            cellValue = String(days);
            cellType = '';   // numerisch (kein t-Attribut bei Numbers in xlsx)
          } else {
            cellValue = String(v);
            inlineStr = true;
          }
        } else if (typeof v === 'number') {
          cellValue = String(v);
          cellType = '';
        } else {
          cellValue = String(v);
          inlineStr = true;
        }

        // Bestehende Zelle finden und ersetzen
        // Pattern matchet sowohl <c r="E7" .../> (selfclosing) als auch <c r="E7" ...>...</c>
        var cellRegex = new RegExp(
          '<c\\s+r="' + cell + '"([^/>]*)(?:/>|>([\\s\\S]*?)</c>)',
          'g'
        );

        var matched = false;
        patchedXml = patchedXml.replace(cellRegex, function(match, attrs) {
          matched = true;
          // Style-Attribut (s="N") aus den existierenden Attributen extrahieren
          var sAttr = '';
          var styleMatch = attrs.match(/\s+s="(\d+)"/);
          if (styleMatch) sAttr = ' s="' + styleMatch[1] + '"';

          // t-Attribut basteln
          var tAttr = '';
          var inner;
          if (inlineStr) {
            tAttr = ' t="inlineStr"';
            inner = '<is><t>' + _xmlEscape(cellValue) + '</t></is>';
          } else {
            // Numerisch
            inner = '<v>' + cellValue + '</v>';
          }

          return '<c r="' + cell + '"' + sAttr + tAttr + '>' + inner + '</c>';
        });

        if (matched) {
          written++;
        } else {
          // Zelle existierte nicht — wir müssen sie in die richtige Zeile einfügen
          // Pragmatisch: skippen (sollte nicht passieren wenn die Vorlage stimmt)
          skipped++;
        }
      });

      // Geänderte sheet.xml zurück ins ZIP
      zip.file(sheetPath, patchedXml);

      // Datei generieren
      var blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var ts = new Date().toISOString().slice(0, 10);
      a.download = 'BMF_KPA_DealPilot_' + ts + '.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        URL.revokeObjectURL(url);
        a.remove();
      }, 100);

      if (typeof toast === 'function') {
        toast('✓ ' + written + ' Werte eingetragen · Datei: ' + Math.round(blob.size / 1024) + ' KB');
      }
    } catch (err) {
      console.error('BMF-Excel-Export Fehler:', err);
      if (typeof toast === 'function') {
        toast('⚠ Datei konnte nicht verarbeitet werden: ' + err.message);
      }
    }
  };
  reader.onerror = function() {
    if (typeof toast === 'function') toast('⚠ Datei konnte nicht gelesen werden.');
  };
  reader.readAsArrayBuffer(file);
}

function _xmlEscape(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

window.exportBMFExcel = exportBMFExcel;
window._bmfHandleFile = _bmfHandleFile;
