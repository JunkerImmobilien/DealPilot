'use strict';
/* W40-pdf-svg: jsPDF kennt kein CSS — dort stehen RGB-Tripel. Im Hauptdokument
   liefert pdf.js seine Palette (W1) und _dpPdfSetAccent() mutiert C.GOLD in
   place. Im Marktbericht-iframe gibt es pdf.js nicht — dort faellt die Funktion
   auf --wl-c9a84c zurueck, das die Bruecke aus W36 setzt.
   Ohne Whitelabel: [201,168,76], also unveraendert. */
if (!window._pdfGold) {
  window._pdfGold = function () {
    try {
      var c = window._dpPdfColors;
      if (c && c.GOLD && c.GOLD.length === 3) return [c.GOLD[0], c.GOLD[1], c.GOLD[2]];
    } catch (e) {}
    try {
      var v = (getComputedStyle(document.documentElement).getPropertyValue('--wl-c9a84c') || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
      }
    } catch (e) {}
    return [201, 168, 76];
  };
}

/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – werbungskosten-pdf.js
   Punkt 7: Aufschlüsselung der Werbungskosten als PDF
   für das Finanzamt
   - pro Jahr OR Gesamtübersicht über alle Jahre
   - Pro Position: Betrag, Jahr, Kategorie, Bemerkung
═══════════════════════════════════════════════════ */

async function exportWerbungskostenPDF(mode) {
  /* v939-wk-gate: Werbungskosten-PDF ist Investor+ (config werbungskosten_pdf) */
  if (typeof Plan !== 'undefined' && Plan.can && !Plan.can('werbungskosten_pdf')) {
    if (typeof toast === 'function') toast('\ud83d\udd12 Werbungskosten-PDF ist im Investor-Plan enthalten');
    if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 600);
    return;
  }
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  if (typeof window.jspdf === 'undefined') {
    if (typeof toast === 'function') toast('PDF-Bibliothek lädt noch...');
    return;
  }
  if (!State.cfRows || !State.cfRows.length) {
    if (typeof toast === 'function') toast('Bitte erst Werte eingeben');
    return;
  }

  // v645: Jahr-Quelle = State.cfRows -> exakt dieselben (Jahr, Index)-Paare wie der Bildschirm
  // (_computeYearTotal(cfRows[yi].cal, yi)). Behebt den Versatz durch fixes new Date().getFullYear().
  var rows = State.cfRows.slice(0, 15);

  if (mode === undefined || mode === null) {
    var selEl = document.getElementById('fa-pdf-year');
    if (selEl && (!selEl.options || !selEl.options.length)) { try { _populateFaPdfYearSelect(); } catch (e) {} }
    mode = selEl ? selEl.value : '0';
  }
  if (mode === 'single-year') mode = '0';           // Legacy-Kompat
  var allYears = (mode === 'all' || mode === 'all-years');

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, H = 297;
  var M = 16;
  var CW = W - 2 * M;

  var name;
  if (allYears) {
    var nYears = rows.length;
    for (var yi = 0; yi < nYears; yi++) {
      if (yi > 0) doc.addPage();
      _renderWerbungskostenPage(doc, rows[yi].cal, yi, W, H, M, CW);
    }
    if (nYears > 1) {
      doc.addPage();
      _renderWerbungskostenSummaryPage(doc, rows[0].cal, nYears, W, H, M, CW);
    }
    name = 'Werbungskosten_Uebersicht_' + rows[0].cal + '-' + rows[nYears - 1].cal;
  } else {
    var idx = parseInt(mode, 10);
    if (isNaN(idx) || idx < 0 || idx >= rows.length) idx = 0;
    _renderWerbungskostenPage(doc, rows[idx].cal, idx, W, H, M, CW);
    name = 'Werbungskosten_' + rows[idx].cal;
  }

  doc.save(name + '.pdf');
  if (typeof toast === 'function') toast('✓ Werbungskosten-PDF erstellt');
}

/* v645: Dropdown "Steuerjahr" fuer das Finanzamt-PDF aus State.cfRows befuellen. */
function _populateFaPdfYearSelect() {
  var sel = document.getElementById('fa-pdf-year');
  if (!sel || !window.State || !State.cfRows || !State.cfRows.length) return;
  var rows = State.cfRows.slice(0, 15);
  var sig = rows.map(function (r) { return r.cal; }).join(',');
  if (sel.getAttribute('data-sig') === sig && sel.options && sel.options.length) return;
  var prev = sel.value;
  var html = '';
  for (var i = 0; i < rows.length; i++) {
    html += '<option value="' + i + '">' + rows[i].cal + '</option>';
  }
  html += '<option value="all">Alle Jahre</option>';
  sel.innerHTML = html;
  sel.setAttribute('data-sig', sig);
  if (prev && /^(all|\d+)$/.test(prev) && sel.querySelector('option[value="' + prev + '"]')) sel.value = prev;
  else sel.value = '0';
}

/* v645: Dropdown initial befuellen, sobald cfRows existieren (ohne tax.js anzufassen). */
(function () {
  var tries = 0;
  function tryPop() {
    tries++;
    try { _populateFaPdfYearSelect(); } catch (e) {}
    var sel = document.getElementById('fa-pdf-year');
    if ((!sel || !sel.options || !sel.options.length) && tries < 25) setTimeout(tryPop, 800);
  }
  if (document.readyState !== 'loading') setTimeout(tryPop, 600);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(tryPop, 600); });
})();

/* v1215-mappe · DIE SEITE KANN JETZT AUCH FREMDE OBJEKTE DRUCKEN.
 *
 * Bis hierher holte diese Funktion alles aus dem GEOEFFNETEN Objekt: Name und
 * Adresse aus dem DOM (getCurrentObjectName, g('str')...), die Zahlen aus
 * _computeYearTotal(), das an State.cfRows haengt. Fuer die Steuer-Mappe ueber
 * ALLE Objekte geht das nicht — man muesste jedes Objekt nacheinander laden und
 * dabei den Arbeitsstand des Nutzers ueberschreiben.
 *
 * Der neue letzte Parameter `q` (Quelle) bricht diese Kopplung, ohne das
 * bisherige Verhalten anzufassen: FEHLT er, laeuft alles wie vorher. Ist er da,
 * liefert er Objektangaben und Zahlen, und die Seite fragt das DOM nicht.
 *
 * Gemessen am 03.09.2026 auf Staging: GET /tax-records liefert 72 Saetze ueber
 * 7 Objekte und 12 Jahre, und ALLE 26 Felder, die diese Seite druckt, sind in
 * jedem Satz belegt — auch die gerechneten (afa, schuldzinsen). Der Satz traegt
 * sogar object_name. Was er NICHT traegt, sind Adresse, Flaeche und Objektart;
 * die kommen aus /objects.
 *
 * (Ich hatte zuerst vermutet, die Saetze truegen nur die Hand-Korrekturen, weil
 * _getEffectiveValue so aussieht. Gemessen ist das falsch — sie werden beim
 * Rechnen geschrieben. Aus dem Code geschlossen, an den Daten widerlegt.) */
function _renderWerbungskostenPage(doc, year, yearIdx, W, H, M, CW, q) {
  // ── HEADER ─────────────────────────────────────
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 26, W, 1, 'F');

  doc.setTextColor.apply(doc, window._pdfGold());
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
  /* v1215-mappe: aus `q`, sonst wie bisher aus dem geoeffneten Objekt. */
  var name = q ? (q.name || "Objekt") :
             ((typeof getCurrentObjectName === "function" ? getCurrentObjectName() : "") ||
             (document.getElementById("hdr-obj") ? document.getElementById("hdr-obj").textContent : "Objekt"));
  var addr = q ? (q.addr || "") :
             ((g("str") || "") + " " + (g("hnr") || "") + ", " + (g("plz") || "") + " " + (g("ort") || ""));
  var qm = q ? (q.qm || "") : g("wfl");
  var bezeichnung = (q ? q.art : g("objart")) || "ETW";

  doc.setFillColor(248, 246, 240);
  doc.roundedRect(M, cy, CW, 22, 2, 2, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
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
  /* v1215-mappe: `q.totals` schlaegt die Rechnung am geoeffneten Objekt.
     Ohne q bleibt es exakt beim bisherigen Weg. */
  var totals = (q && q.totals) ? q.totals
             : ((typeof _computeYearTotal === "function") ? _computeYearTotal(year, yearIdx) : null);
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

  /* ── v1131-wkumlage · Die Aufstellung ging nicht auf ──────────────────
     GEMESSEN am Beispiel-PDF (Am Markt 9, 2024): die sechs Zwischensummen
     ergeben 1.928 + 700 + 405 + 0 + 978 + 0 = 4.011 EUR. Ausgewiesen waren
     aber 5.511 EUR — 1.500 EUR mehr, die in KEINER Zeile standen.

     Ursache: `_computeYearTotal` (tax.js:1056) rechnet `nk_umlf`, die
     UMLAGEFAEHIGEN Nebenkosten, in die Summe ein — dieser Abschnitt zeigte
     aber nur `nk_n_umlf` und `betr_sonst`.

     DIE RECHNUNG IST RICHTIG, DIE DARSTELLUNG WAR ES NICHT. Umlagefaehige
     Nebenkosten gehoeren auf BEIDE Seiten: als Einnahme beim Zufluss
     (Anlage V, Zeile 14) und als Werbungskosten beim Abfluss (Zeile 33 ff.).
     Eine Saldierung ist ausdruecklich NICHT zulaessig (§ 11 EStG,
     Zufluss-/Abflussprinzip). Nachgelesen, nicht angenommen.

     Fuer den Leser war das Papier damit unpruefbar: die Summe liess sich
     aus den gezeigten Zeilen nicht nachrechnen. Ein Finanzamt, das genau
     das tut, findet eine Luecke von 1.500 EUR. Die Zeile steht jetzt da. */
  cy = _renderWkSection(doc, cy, M, CW, '2. Betriebskosten', [
    ['Umlagefähige Nebenkosten (durchlaufend)', v.nk_umlf, bem.nk_umlf],
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
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(M, cy, 2, 26, 'F');

  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SUMME WERBUNGSKOSTEN ' + year, M + 6, cy + 8);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(Math.round(totals.werbungskosten).toLocaleString('de-DE') + ' €', W - M - 6, cy + 14, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  /* v1131-wkumlage: die Einnahmenseite aufgeschluesselt. Der durchlaufende
     Posten steht damit auf BEIDEN Seiten sichtbar — sonst sieht es aus, als
     wuerden 1.500 EUR Kosten ohne Gegenwert abgezogen. */
  var _km = Math.round(v.einnahmen_km || 0);
  var _nk = Math.round(v.einnahmen_nk || 0);
  doc.text('Einnahmen V+V: ' + Math.round(totals.einnahmen).toLocaleString('de-DE') + ' €' +
    (_nk > 0 ? '  (Kaltmiete ' + _km.toLocaleString('de-DE') + ' € + Umlagen ' +
               _nk.toLocaleString('de-DE') + ' €)' : ''), M + 6, cy + 20);
  var ergebnisColor = totals.ergebnis >= 0 ? 'Überschuss' : 'Verlust';
  doc.text(ergebnisColor + ': ' + (totals.ergebnis >= 0 ? '+' : '') +
    Math.round(totals.ergebnis).toLocaleString('de-DE') + ' €', M + 6, cy + 24);

  cy += 30;
  cy = _renderSteuerwirkung(doc, cy, M, CW, totals);

  // ── FOOTER ─────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'DealPilot'),
    W / 2, H - 8, { align: 'center' });
  doc.text('Diese Aufstellung dient der Vorbereitung der Anlage V zur Einkommensteuererklärung. Keine Steuerberatung.',
    W / 2, H - 4, { align: 'center' });
}

/* ── v1132-nullzeilen · „alles was leer oder eine 0 hat wird nicht
   angezeigt" (Marcel, 2026-08-11) ────────────────────────────────────────
   Geprueft wird der ROHWERT, nicht der formatierte. Die Falle steht so im
   Backlog: `_euro(null)` liefert „–" und ist damit TRUTHY — wer auf den
   formatierten Wert prueft, blendet nichts aus. Hier kommen die Werte
   ohnehin als Zahl herein; `Number(null)` ist 0 und besteht
   `Number.isFinite`, deshalb wird zuerst auf Abwesenheit geprueft und erst
   danach gerechnet.

   Bleibt von einem Abschnitt KEINE Zeile uebrig, faellt der ganze
   Abschnitt weg — samt Ueberschrift und Zwischensumme. Eine Ueberschrift
   ueber einer leeren Flaeche mit „Zwischensumme 0 €" ist genau das
   Rauschen, das weg sollte. */
/* ── v1133-steuerwirkung · Was bringt es steuerlich? ──────────────────────
   Marcels Immokalk beantwortet genau das — „Steuer Verlust/Ueberschuss pro
   Jahr 1.380 €, pro Monat 115 €" — und ist ausdruecklich die Vorlage.
   Unser Papier hoerte bei der Werbungskosten-Summe auf.

   Gerechnet wird hier NICHTS: calcImmoTaxImpact liefert ESt vorher und
   nachher sowie beide Steuersaetze; seit v1133 reicht _computeYearTotal
   sie durch. Eine eigene Steuerformel im PDF waere eine zweite Wahrheit.

   Fehlt das zvE, faellt der Block ganz weg — lieber keine Aussage als eine
   Steuerersparnis, die auf einem geratenen Einkommen beruht. */
function _renderSteuerwirkung(doc, cy, M, CW, totals) {
  var imp = totals && totals.impact;
  var zve = totals && totals.zve;
  if (!imp || !zve || !isFinite(zve) || zve <= 0) return cy;

  if (cy > 235) { doc.addPage(); cy = 20; }

  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function pct(n) { return (Math.round(n * 100) / 100).toString().replace('.', ',') + ' %'; }

  doc.setFillColor(42, 39, 39);
  doc.rect(M, cy, CW, 6, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('STEUERWIRKUNG', M + 3, cy + 4.2);
  cy += 6;

  var zveNach = zve + totals.ergebnis;
  if (zveNach < 0) zveNach = 0;
  var zeilen = [
    ['zu versteuerndes Einkommen vor Investition', eur(zve), 'Einkommensteuer ' + eur(imp.taxBefore)],
    [(totals.ergebnis >= 0 ? 'Überschuss' : 'Verlust') + ' aus Vermietung und Verpachtung',
     (totals.ergebnis >= 0 ? '+' : '') + eur(totals.ergebnis), ''],
    ['zu versteuerndes Einkommen nach Investition', eur(zveNach), 'Einkommensteuer ' + eur(imp.taxAfter)],
    ['Grenzsteuersatz', pct(imp.grenzsteuersatzBefore * 100), 'danach ' + pct(imp.grenzsteuersatzAfter * 100)]
  ];
  zeilen.forEach(function (z, i) {
    if (cy + 7 > 280) { doc.addPage(); cy = 20; }
    doc.setFillColor(i % 2 === 0 ? 252 : 248, i % 2 === 0 ? 250 : 246, i % 2 === 0 ? 244 : 238);
    doc.rect(M, cy, CW, 7, 'F');
    doc.setTextColor(60, 55, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(z[0], M + 3, cy + 4.5);
    if (z[2]) {
      doc.setTextColor(120, 110, 100);
      doc.setFontSize(7.5);
      doc.text(z[2], M + CW - 42, cy + 4.5, { align: 'right' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(42, 39, 39);
    doc.text(z[1], M + CW - 3, cy + 4.5, { align: 'right' });
    cy += 7;
  });

  /* Die Zahl, auf die es Marcel ankommt. */
  var proJahr = imp.refund;                    /* > 0 = Erstattung */
  var proMonat = proJahr / 12;
  if (cy + 18 > 280) { doc.addPage(); cy = 20; }
  doc.setFillColor(42, 39, 39);
  doc.roundedRect(M, cy + 2, CW, 16, 2, 2, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(M, cy + 2, 2, 16, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text((proJahr >= 0 ? 'STEUERERSPARNIS' : 'STEUERNACHZAHLUNG') + ' PRO JAHR', M + 6, cy + 8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(eur(Math.abs(proJahr)), M + CW - 6, cy + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text('pro Monat ' + eur(Math.abs(proMonat)), M + CW - 6, cy + 15, { align: 'right' });
  return cy + 20;
}

function _wkHatWert(v) {
  if (v === null || v === undefined || v === '') return false;
  var n = (typeof v === 'number') ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) && Math.round(n) !== 0;
}

function _renderWkSection(doc, cy, M, CW, title, items) {
  items = (items || []).filter(function (it) { return _wkHatWert(it && it[1]); });
  if (!items.length) return cy;          /* leerer Abschnitt: gar nicht erst zeichnen */

  // Page break check
  if (cy > 250) { doc.addPage(); cy = 20; }

  // Section header bar
  doc.setFillColor(42, 39, 39);
  doc.rect(M, cy, CW, 6, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
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
  doc.setDrawColor.apply(doc, window._pdfGold());
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
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 26, W, 1, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
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
    headStyles: { fillColor: [42, 39, 39], textColor: window._pdfGold(), fontSize: 9, fontStyle: 'bold' },
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

/* ═══════════════════════════════════════════════════════════════════════════
   v1215-mappe · STEUER-MAPPE: EIN PDF UEBER ALLE OBJEKTE
   ───────────────────────────────────────────────────────────────────────────
   Marcels Auftrag vom 30.08.2026: das Finanzamt-PDF gibt es bisher nur je
   Objekt (Tab Steuer). Gewuenscht ist dieselbe Sache ueber ALLE Objekte, mit
   Jahr und Auswahl.

   Gemessen am 03.09.2026 auf Staging: GET /tax-records liefert 72 Saetze ueber
   7 Objekte und 12 Jahre. ALLE 26 Felder, die die Seite druckt, sind in jedem
   Satz belegt — auch die gerechneten (afa, schuldzinsen). Es braucht also
   weder neue Datenhaltung noch ein Nachladen der Objekte in den Editor.

   Was der Satz NICHT traegt: Adresse, Wohnflaeche, Objektart. Die kommen aus
   GET /objects und werden je object_id zugeordnet. Fehlt ein Objekt dort,
   wird es NICHT weggelassen — es bekommt seine Seite mit dem Namen aus dem
   Satz und leeren Objektangaben, und die Schlussseite nennt es. Ein fehlendes
   Objekt still zu ueberspringen waere in einer Steuerunterlage der
   schlimmste Fall: die Mappe saehe vollstaendig aus.

   Gerechnet wird hier NICHTS. _computeYearTotal(jahr, 0, satz) benutzt
   dieselbe Summenformel wie der Bildschirm, nur mit vorgegebenen Werten.
   ═══════════════════════════════════════════════════════════════════════════ */
async function exportSteuerMappePDF(jahr, opts) {
  opts = opts || {};
  if (typeof Plan !== 'undefined' && Plan.can && !Plan.can('werbungskosten_pdf')) {
    if (typeof toast === 'function') toast('🔒 Die Steuer-Mappe ist im Investor-Plan enthalten');
    if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 600);
    return;
  }
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
  if (typeof window.jspdf === 'undefined') {
    if (typeof toast === 'function') toast('PDF-Bibliothek lädt noch...');
    return;
  }
  jahr = parseInt(jahr, 10);
  if (!jahr) jahr = new Date().getFullYear() - 1;   /* Veranlagung betrifft das Vorjahr */

  var saetze, objekte;
  try {
    var r = await Auth.apiCall('/tax-records?from=' + jahr + '&to=' + jahr);
    saetze = (r && r.records) || [];
    var ro = await Auth.apiCall('/objects');
    objekte = (ro && (ro.objects || ro.items || ro)) || [];
    if (!Array.isArray(objekte)) objekte = [];
  } catch (e) {
    if (typeof toast === 'function') toast('✗ Steuerdaten nicht abrufbar: ' + (e.message || e));
    return;
  }

  if (opts.objectIds && opts.objectIds.length) {
    saetze = saetze.filter(function (s) { return opts.objectIds.indexOf(s.object_id) >= 0; });
  }
  if (!saetze.length) {
    if (typeof toast === 'function') toast('Für ' + jahr + ' sind keine Steuersätze erfasst.');
    return;
  }

  /* v1215b · GEMESSEN: GET /objects liefert nur eine ZUSAMMENFASSUNG.
     Die Liste trägt name, ort, kaufpreis, dscr … — aber KEIN `data` und damit
     weder Straße noch Hausnummer noch Wohnfläche. Im ersten Lauf stand auf
     Seite 1 deshalb ",  Kabelsketal" und "ETW ·  m²": eine Adresse ohne
     Straße und eine Fläche ohne Zahl.

     Die Details liegen in GET /objects/:id. Das ist KEIN „Nachladen der
     Objekte" im Sinne des Backlog-Eintrags — der meinte das Laden in den
     Editor, das den Arbeitsstand überschreibt. Ein reiner Abruf tut das nicht.

     Nur für die Objekte geholt, die wirklich im PDF landen, und parallel.
     Schlägt einer fehl, wird das Objekt NICHT übersprungen: es bekommt seine
     Seite mit dem Namen aus dem Satz, und die Schlussseite nennt es. */
  var stamm = {};
  var brauchtDetails = {};
  saetze.forEach(function (s) { if (s.object_id) brauchtDetails[s.object_id] = 1; });
  var ids = Object.keys(brauchtDetails);
  var details = await Promise.all(ids.map(function (id) {
    return Auth.apiCall('/objects/' + id).catch(function () { return null; });
  }));
  objekte.forEach(function (o) {
    stamm[o.id] = { name: o.name || '', addr: o.ort || '', qm: '', art: '' };
  });
  details.forEach(function (res, i) {
    if (!res) return;
    var o = res.object || res;
    var d = o.data || {};
    var id = ids[i];
    var strTeil = ((d.str || '') + ' ' + (d.hnr || '')).trim();
    var ortTeil = (d.plz || d.ort) ? ((d.plz || '') + ' ' + (d.ort || '')).trim() : '';
    stamm[id] = {
      name: o.name || (stamm[id] && stamm[id].name) || '',
      addr: [strTeil, ortTeil].filter(Boolean).join(', '),
      qm: d.wfl || '',
      art: d.objart || ''
    };
  });

  saetze.sort(function (a, b) {
    return String(a.object_name || '').localeCompare(String(b.object_name || ''), 'de');
  });

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, H = 297, M = 16, CW = W - 2 * M;

  /* v1221: Deckblatt zuerst — wem die Zahlen gehoeren, steht vor den Zahlen. */
  var halter = _mappeHalter(saetze, objekte);
  _renderMappeDeckblatt(doc, jahr, halter, saetze, stamm, W, H, M, CW);
  doc.addPage();

  var ohneStamm = [];
  var avFehlt = !_anlageVTabelle(jahr);
  saetze.forEach(function (s, i) {
    if (i > 0) doc.addPage();   /* Seite 1 ist das Deckblatt, danach je Objekt */
    var st = stamm[s.object_id];
    if (!st) ohneStamm.push(s.object_name || s.object_id);
    var totals = _computeYearTotal(jahr, 0, s);
    var q = {
      name: (st && st.name) || s.object_name || 'Objekt',
      addr: (st && st.addr) || '',
      qm: (st && st.qm) || '',
      art: (st && st.art) || '',
      totals: totals
    };
    _renderWerbungskostenPage(doc, jahr, 0, W, H, M, CW, q);
    /* v1218-anlagev: die zweite Ansicht direkt hinter der Aufstellung, damit
       beide Blätter zu einem Objekt zusammenbleiben. Gibt es für das Jahr
       keine abgeschriebene Zuordnung, erscheint sie NICHT — dann sagt die
       Schlussseite auch, warum. */
    if (opts.anlageV && !avFehlt) {
      doc.addPage();
      _renderAnlageVPage(doc, jahr, totals, q, W, H, M, CW);
    }
  });

  doc.addPage();
  _renderMappeSummaryPage(doc, jahr, saetze, stamm, ohneStamm, W, H, M, CW,
    { anlageV: !!opts.anlageV, avFehlt: avFehlt });

  doc.save('Steuermappe_' + jahr + '.pdf');
  if (typeof toast === 'function') {
    toast('✓ Steuer-Mappe ' + jahr + ' — ' + saetze.length + ' Objekt' + (saetze.length === 1 ? '' : 'e'));
  }
}

/* Die Schlussseite: eine Zeile je Objekt, darunter die Summe. Sie ist der
   Grund, warum die Mappe mehr ist als ein Stapel Einzel-PDFs. */
function _renderMappeSummaryPage(doc, jahr, saetze, stamm, ohneStamm, W, H, M, CW, av) {
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 26, W, 1, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('STEUER-MAPPE · ZUSAMMENFASSUNG', M, 13);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text('Vermietung & Verpachtung · Anlage V · § 21 EStG', M, 19);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Veranlagungsjahr ' + jahr, W - M, 13, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE'), W - M, 19, { align: 'right' });

  var cy = 38;
  var eur = function (n) {
    return (Math.round(Number(n) || 0)).toLocaleString('de-DE') + ' €';
  };

  doc.setTextColor(122, 115, 112); doc.setFontSize(7.5);
  doc.text('OBJEKT', M, cy);
  doc.text('EINNAHMEN', M + CW - 96, cy, { align: 'right' });
  doc.text('WERBUNGSKOSTEN', M + CW - 48, cy, { align: 'right' });
  doc.text('ERGEBNIS', M + CW, cy, { align: 'right' });
  cy += 2;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, cy, M + CW, cy);
  cy += 5;

  var sumE = 0, sumW = 0, sumR = 0;
  saetze.forEach(function (s) {
    var t = _computeYearTotal(jahr, 0, s);
    sumE += t.einnahmen; sumW += t.werbungskosten; sumR += t.ergebnis;
    var st = stamm[s.object_id];
    doc.setTextColor(42, 39, 39); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(String((st && st.name) || s.object_name || 'Objekt').slice(0, 44), M, cy);
    doc.text(eur(t.einnahmen), M + CW - 96, cy, { align: 'right' });
    doc.text(eur(t.werbungskosten), M + CW - 48, cy, { align: 'right' });
    doc.setTextColor.apply(doc, t.ergebnis < 0 ? [176, 90, 84] : [46, 125, 80]);
    doc.text(eur(t.ergebnis), M + CW, cy, { align: 'right' });
    cy += 6;
    if (cy > H - 40) { doc.addPage(); cy = 30; }
  });

  cy += 2;
  doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.5);
  doc.line(M, cy, M + CW, cy);
  cy += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(42, 39, 39);
  doc.text('SUMME (' + saetze.length + ' Objekt' + (saetze.length === 1 ? '' : 'e') + ')', M, cy);
  doc.text(eur(sumE), M + CW - 96, cy, { align: 'right' });
  doc.text(eur(sumW), M + CW - 48, cy, { align: 'right' });
  doc.setTextColor.apply(doc, sumR < 0 ? [176, 90, 84] : [46, 125, 80]);
  doc.text(eur(sumR), M + CW, cy, { align: 'right' });
  cy += 12;

  /* Was die Mappe NICHT leisten kann, steht drin. Eine Steuerunterlage, die
     ihre Luecken verschweigt, sieht vollstaendig aus — das ist der
     gefaehrlichste Zustand, und es ist dasselbe Prinzip wie im Marktbericht. */
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(122, 115, 112);
  var hin = [
    'Diese Mappe fasst die je Objekt gespeicherten Steuersätze des Veranlagungsjahres zusammen. '
    + 'Sie ersetzt keine Steuererklärung und keine Beratung.',
    (av && av.anlageV && !av.avFehlt)
      ? 'Zu jedem Objekt liegt eine Anlage-V-Zuordnung bei: dieselben Zahlen, sortiert nach den '
        + 'Zeilen des amtlichen Formulars. Positionen ohne gesicherte Zeile sind dort ausgewiesen '
        + 'und nicht weggelassen.'
      : ((av && av.avFehlt)
          ? 'Eine Anlage-V-Zuordnung liegt NICHT bei: für ' + jahr + ' ist keine abgeschriebene '
            + 'Zeilenzuordnung hinterlegt. Die Nummern ändern sich je Veranlagungsjahr und werden '
            + 'nicht geraten.'
          : 'Die Zuordnung zu den Zeilennummern der amtlichen Anlage V ist in dieser Mappe nicht '
            + 'enthalten — sie lässt sich beim Erstellen zuschalten.')
  ];
  if (ohneStamm.length) {
    hin.push('Zu ' + ohneStamm.length + ' Objekt' + (ohneStamm.length === 1 ? '' : 'en')
      + ' liegen keine Stammdaten vor (Adresse, Fläche, Art) — die Seiten tragen nur den Namen: '
      + ohneStamm.join(', ') + '.');
  }
  hin.forEach(function (t) {
    var z = doc.splitTextToSize(t, CW);
    doc.text(z, M, cy);
    cy += z.length * 3.4 + 2;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   v1218-anlagev · DIE ZWEITE ANSICHT: DIESELBEN ZAHLEN NACH FORMULARZEILEN
   ───────────────────────────────────────────────────────────────────────────
   Marcels Vorgabe vom 30.08.2026: „Anlage V und die, die wir jetzt haben, mit
   den Nummern der Anlage V drauf. Sollte nur vollstaendig sein."

   „Vollstaendig" ist hier die schaerfste Anforderung, nicht die weichste. Eine
   Anlage-V-Ansicht, in der eine Position fehlt, sieht aus wie eine fertige
   Erklaerung — deshalb erscheint JEDE Position, auch die ohne sichere Zeile.
   Drei Bloecke:

     1 · zugeordnet    — Zeile und Kennzahl aus dem amtlichen Formular
     2 · ohne Zeile    — der Betrag steht da, die Zuordnung waere eine
                         steuerfachliche Entscheidung. Mit Begruendung.
     3 · nicht erfasst — Formularzeilen, die DealPilot gar nicht kennt.

   Die Zuordnung kommt aus window.AnlageV2025 (v1217, aus dem amtlichen PDF
   abgeschrieben). FEHLT SIE FUER DAS JAHR, ERSCHEINT DIE SEITE NICHT — statt
   mit den Nummern eines anderen Jahres zu rechnen.
   ═══════════════════════════════════════════════════════════════════════════ */
function _anlageVTabelle(jahr) {
  var t = window['AnlageV' + jahr];
  return (t && t.zeilen && t.felder) ? t : null;
}

/* Die Bezeichnungen sind WOERTLICH die der Aufstellung — beide Ansichten
   muessen dieselbe Position gleich nennen, sonst sucht der Leser. */
var _AV_LABEL = {
  schuldzinsen: 'Schuldzinsen', kontofuehrung: 'Kontoführungsgebühren',
  bereitstellung: 'Bereitstellungszinsen', notar_grundschuld: 'Notar/Grundschuld (anteilig)',
  vermittlung: 'Vermittlungsprovision Darlehen', finanz_sonst: 'Sonstiges (Finanzierung)',
  nk_umlf: 'Umlagefähige Nebenkosten (durchlaufend)', nk_n_umlf: 'Nicht-umlagefähige Nebenkosten',
  betr_sonst: 'Sonstige Betriebskosten', hausverwaltung: 'Hausverwaltung / Mietsonderverwaltung',
  steuerber: 'Steuerberatung', porto: 'Porto, Büromaterial', verw_sonst: 'Sonstiges (Verwaltung)',
  fahrtkosten: 'Fahrtkosten zur Immobilie', verpflegung: 'Verpflegungsmehraufwand',
  hotel: 'Übernachtungskosten', inserat: 'Inseratskosten', gericht: 'Gerichts-/Anwaltskosten',
  telefon: 'Telefon/Internet', sonst_kosten: 'Sonstiges (Leerstand, etc.)',
  afa: 'AfA Gebäude (linear)', sonst_bewegl_wg: 'AfA bewegliche Wirtschaftsgüter',
  anschaffungsnah: 'Anschaffungsnah (§ 6 Abs. 1 Nr. 1a EStG)',
  erhaltungsaufwand: 'Erhaltungsaufwand (nach 3 Jahren)',
  einnahmen_km: 'Mieteinnahmen (kalt)', einnahmen_nk: 'Umlagen / Nebenkosten'
};

function _renderAnlageVPage(doc, jahr, totals, q, W, H, M, CW) {
  var T = _anlageVTabelle(jahr);
  if (!T || !totals) return false;
  var v = totals.values || {};
  var eur = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('de-DE') + ' €'; };

  /* ── Kopf ── */
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 26, W, 1, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('ANLAGE V · ZUORDNUNG', M, 13);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text('Dieselben Zahlen, sortiert nach den Zeilen des amtlichen Formulars', M, 19);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Veranlagungsjahr ' + jahr, W - M, 13, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Formular ' + T.formular, W - M, 19, { align: 'right' });

  var cy = 34;
  var name = q ? (q.name || 'Objekt')
               : ((typeof getCurrentObjectName === 'function' ? getCurrentObjectName() : '') || 'Objekt');
  doc.setTextColor(122, 115, 112); doc.setFontSize(7.5);
  doc.text('OBJEKT', M, cy);
  doc.setTextColor(42, 39, 39); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(String(name).slice(0, 60), M + 22, cy);
  doc.setFont('helvetica', 'normal');
  cy += 8;

  var _need = function (h) { if (cy + h > H - 20) { doc.addPage(); cy = 24; } };

  var kopf = function (t) {
    _need(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(42, 39, 39);
    doc.text(t, M, cy);
    cy += 2;
    doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
    doc.line(M, cy, M + CW, cy);
    cy += 5;
  };

  var zeile = function (nr, kz, text, betrag, grau) {
    _need(6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor.apply(doc, grau ? [140, 134, 128] : [42, 39, 39]);
    doc.text(nr, M, cy);
    doc.setTextColor(140, 134, 128); doc.setFontSize(7);
    if (kz) doc.text('Kz ' + kz, M + 15, cy);
    doc.setTextColor.apply(doc, grau ? [140, 134, 128] : [42, 39, 39]);
    doc.setFontSize(8);
    doc.text(String(text).slice(0, 74), M + 28, cy);
    if (betrag !== null && betrag !== undefined) {
      doc.text(eur(betrag), M + CW, cy, { align: 'right' });
    }
    cy += 5.6;
  };

  /* ── 1 · Einnahmen ── */
  kopf('EINNAHMEN');
  var eingeordnet = {}, einSumme = 0;
  ['einnahmen_km', 'einnahmen_nk'].forEach(function (f) {
    var z = T.felder[f];
    if (!z || z.zeile == null) return;
    eingeordnet[f] = 1;
    var zz = T.zeilen[z.zeile] || {};
    zeile('Zeile ' + z.zeile, zz.kz, _AV_LABEL[f] || f, v[f] || 0);
    einSumme += (v[f] || 0);
  });
  _need(7);
  doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.4);
  doc.line(M + 28, cy - 2, M + CW, cy - 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(42, 39, 39);
  doc.text('Zeile 32', M, cy + 2);
  doc.text('Summe der Einnahmen', M + 28, cy + 2);
  doc.text(eur(totals.einnahmen), M + CW, cy + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  cy += 11;

  /* ── 2 · Werbungskosten mit Zeile ── */
  kopf('WERBUNGSKOSTEN');
  /* v1219: jede Zeile sagt jetzt, WORAUF ihre Zuordnung beruht. Das ist
     wichtiger als die Zuordnung selbst — ein Leser muss unterscheiden können,
     was aus dem Formular abgeschrieben ist und was aus der Art des Aufwands
     folgt. Ohne diese Unterscheidung sieht beides gleich sicher aus. */
  var ohne = [], zugeordnetSumme = 0, sachlogik = [];
  Object.keys(T.felder).forEach(function (f) {
    if (f === 'einnahmen_km' || f === 'einnahmen_nk') return;
    var z = T.felder[f];
    var betrag = v[f] || 0;
    if (z.zeile == null) { if (betrag) ohne.push({ f: f, betrag: betrag, grund: z.grund }); return; }
    if (!betrag) return;                       /* Nullposten nicht drucken */
    var zz = T.zeilen[z.zeile] || {};
    var mark = (z.quelle === 'sachlogik') ? ' °' : ((z.quelle === 'auffang') ? ' *' : '');
    zeile('Zeile ' + z.zeile, zz.kz, (_AV_LABEL[f] || f) + mark, betrag);
    if (z.quelle === 'sachlogik' && z.grund) sachlogik.push({ f: f, zeile: z.zeile, grund: z.grund });
    zugeordnetSumme += betrag;
  });
  if (zugeordnetSumme === 0) {
    doc.setFontSize(7.5); doc.setTextColor(140, 134, 128);
    doc.text('Keine Position mit Betrag erfasst.', M + 28, cy);
    cy += 6;
  }
  cy += 3;

  /* v1219 · DIE LEGENDE IST DER KERN DIESER SEITE.
     Ohne sie sehen Abschrift und Schlussfolgerung gleich sicher aus — und
     genau das darf in einer Steuerunterlage nicht passieren. */
  if (sachlogik.length || zugeordnetSumme) {
    _need(10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    doc.setTextColor(122, 115, 112);
    var leg = doc.splitTextToSize('Ohne Zeichen: die Kostenart steht wörtlich in der '
      + 'Überschrift der Formularzeile — Abschrift.   '
      + '*  steht in keiner spezielleren Zeile; das Formular führt dafür „Sonstige Kosten".   '
      + '°  folgt aus der Art des Aufwands, nicht aus dem Formulartext — siehe Begründung unten.', CW);
    doc.text(leg, M, cy);
    cy += leg.length * 3.2 + 3;
  }

  if (sachlogik.length) {
    _need(8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.setTextColor(42, 39, 39);
    doc.text('°  ZUORDNUNG AUS DER ART DES AUFWANDS — BITTE PRÜFEN', M, cy);
    cy += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6);
    doc.setTextColor(140, 134, 128);
    sachlogik.forEach(function (s) {
      var t = doc.splitTextToSize('Zeile ' + s.zeile + ' · ' + (_AV_LABEL[s.f] || s.f)
        + ' — ' + s.grund, CW - 4);
      _need(t.length * 3.1 + 1.5);
      doc.text(t, M + 4, cy);
      cy += t.length * 3.1 + 1.4;
    });
    cy += 3;
  }

  /* ── 3 · ohne Zeile ── */
  if (ohne.length) {
    kopf('OHNE ZEILENZUORDNUNG — BITTE STEUERLICH PRÜFEN');
    doc.setFontSize(7.2); doc.setTextColor(140, 134, 128);
    var vor = doc.splitTextToSize('Diese Beträge sind erfasst und in der Summe enthalten. '
      + 'Die Zeile wäre eine steuerfachliche Entscheidung und keine Abschrift aus dem Formular — '
      + 'deshalb steht sie hier nicht.', CW);
    _need(vor.length * 3.3 + 4);
    doc.text(vor, M, cy); cy += vor.length * 3.3 + 3;
    ohne.forEach(function (o) {
      zeile('—', null, _AV_LABEL[o.f] || o.f, o.betrag, true);
      if (o.grund) {
        doc.setFontSize(6.6); doc.setTextColor(150, 143, 136);
        var g = doc.splitTextToSize(o.grund, CW - 30);
        _need(g.length * 3 + 2);
        doc.text(g, M + 28, cy - 2.5);
        cy += g.length * 3 + 0.5;
        doc.setFontSize(8);
      }
    });
    cy += 4;
  }

  /* ── 4 · Summe und Überschuss ── */
  _need(16);
  doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.5);
  doc.line(M, cy, M + CW, cy);
  cy += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(42, 39, 39);
  doc.text('Zeile 83', M, cy);
  doc.text('Summe der Werbungskosten', M + 28, cy);
  doc.text(eur(totals.werbungskosten), M + CW, cy, { align: 'right' });
  cy += 6.5;
  doc.text('Zeile 85', M, cy);
  doc.text('Überschuss (Einnahmen Zeile 32 abzüglich Werbungskosten Zeile 83)', M + 28, cy);
  doc.setTextColor.apply(doc, totals.ergebnis < 0 ? [176, 90, 84] : [46, 125, 80]);
  doc.text(eur(totals.ergebnis), M + CW, cy, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setTextColor(42, 39, 39);
  cy += 11;

  /* ── 5 · nicht erfasst ── */
  if (T.nicht_erfasst && T.nicht_erfasst.length) {
    kopf('FORMULARZEILEN, DIE DEALPILOT NICHT FÜHRT');
    doc.setFontSize(6.8); doc.setTextColor(140, 134, 128);
    T.nicht_erfasst.forEach(function (n) {
      var t = doc.splitTextToSize('Zeile ' + n.zeile + ' — ' + n.text, CW);
      _need(t.length * 3.1 + 1.5);
      doc.text(t, M, cy);
      cy += t.length * 3.1 + 1.2;
    });
    cy += 4;
  }

  /* ── Fuß ── */
  _need(14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(122, 115, 112);
  var fuss = doc.splitTextToSize('Zuordnung abgeschrieben aus dem amtlichen Formular '
    + T.formular + '. Keine Steuererklärung und keine Steuerberatung — die Zahlen sind zum '
    + 'Übertragen gedacht, die Verantwortung für den Eintrag bleibt beim Erklärenden. '
    + 'Bei verbilligter Vermietung sind die Aufwendungen laut Formular in voller Höhe '
    + 'einzutragen; die Kürzung erfolgt ausschließlich in Zeile 87 oder 88.', CW);
  doc.text(fuss, M, cy);
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   v1221-deckblatt · WEM GEHÖREN DIESE ZAHLEN?
   ───────────────────────────────────────────────────────────────────────────
   Marcel am 03.09.2026: „Alle Angaben zum Mandanten könnten wir unter
   Einstellungen Account und Sicherheit eintragen … Wenn es eine UG oder GmbH
   ist geht das unter Einstellungen Mandanten. Vlt können wir da Informationen
   mit auf die PDF geben."

   Eine Steuerunterlage ohne Angabe, WESSEN Einkünfte sie zeigt, ist beim
   Finanzamt wertlos — und beim Steuerberater eine Rückfrage. Das Deckblatt
   holt die Angaben von genau einer Stelle:

     Gesellschaft (GmbH, UG, …) -> Einstellungen → Mandanten, Block
                                   „Identifikation" (v1221)
     privat                     -> Einstellungen → Account & Sicherheit
                                   (Name, Firma, Steuernummer, USt-IdNr.)

   WAS FEHLT, WIRD BENANNT, NICHT WEGGELASSEN. Eine Zeile „Steuernummer —
   nicht hinterlegt" ist eine Aufforderung; eine fehlende Zeile ist eine
   Lücke, die niemand sieht. Dasselbe Prinzip wie im Marktbericht.
   ═══════════════════════════════════════════════════════════════════════════ */
function _mappeHalter(saetze, objekte) {
  /* Der Halter der Objekte — ist er bei allen gleich, gilt er für die Mappe.
     Sind es mehrere, sagt das Deckblatt das, statt einen davon zu behaupten. */
  var ids = {}, halterName = null;
  (objekte || []).forEach(function (o) {
    if (o && o.halter) ids[o.halter] = (ids[o.halter] || 0) + 1;
  });
  var keys = Object.keys(ids);
  var mand = null;
  try {
    var liste = (window.DealPilotMandanten && DealPilotMandanten.getList()) || [];
    if (keys.length === 1) {
      mand = liste.filter(function (m) { return m.id === keys[0]; })[0] || null;
    }
    if (!mand && liste.length === 1) mand = liste[0];   /* nur „Privat" vorhanden */
  } catch (e) {}

  var S = {};
  try { S = (window.Settings && Settings.get()) || {}; } catch (e) {}

  var istGesellschaft = !!(mand && window.DealPilotMandanten
    && DealPilotMandanten.isCorp && DealPilotMandanten.isCorp(mand.rechtsform));
  var ident = (mand && mand.ident) || {};

  return {
    mehrere: keys.length > 1,
    anzahlHalter: keys.length,
    gesellschaft: istGesellschaft,
    name: istGesellschaft ? (mand.name || '')
        : ((S.user_name || '') || (S.user_company || '')),
    rechtsform: mand ? (window.DealPilotMandanten && DealPilotMandanten.rfLabel
                        ? DealPilotMandanten.rfLabel(mand.rechtsform) : mand.rechtsform) : null,
    firma: istGesellschaft ? '' : (S.user_company || ''),
    steuernummer: ident.steuernummer || (istGesellschaft ? '' : (S.user_steuernummer || '')),
    ustid: ident.ustid || (istGesellschaft ? '' : (S.user_uid || '')),
    finanzamt: ident.finanzamt || '',
    handelsregister: ident.handelsregister || '',
    strasse: ident.strasse || (istGesellschaft ? '' : (S.pdf_address || '')),
    ort: ident.ort || (istGesellschaft ? ''
         : ((S.pdf_plz || '') + ' ' + (S.pdf_city || '')).trim())
  };
}

function _renderMappeDeckblatt(doc, jahr, h, saetze, stamm, W, H, M, CW) {
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, W, 46, 'F');
  doc.setFillColor.apply(doc, window._pdfGold());
  doc.rect(0, 46, W, 1.4, 'F');
  doc.setTextColor.apply(doc, window._pdfGold());
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
  doc.text('STEUER-MAPPE', M, 24);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Vermietung & Verpachtung · Anlage V · § 21 EStG', M, 33);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Veranlagungsjahr ' + jahr, W - M, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE'), W - M, 33, { align: 'right' });

  var cy = 62;
  var zeile = function (lab, wert, fehlt) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(122, 115, 112);
    doc.text(lab, M, cy);
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, fehlt ? [176, 140, 90] : [42, 39, 39]);
    doc.setFont('helvetica', fehlt ? 'italic' : 'bold');
    doc.text(wert, M + 46, cy);
    cy += 8;
  };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(42, 39, 39);
  doc.text('STEUERPFLICHTIGE / STEUERPFLICHTIGER', M, cy);
  cy += 3;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, cy, M + CW, cy);
  cy += 8;

  if (h.mehrere) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.setTextColor(176, 140, 90);
    var mt = doc.splitTextToSize('Die Objekte dieses Jahres gehören ' + h.anzahlHalter
      + ' verschiedenen Haltern. Eine Anlage V wird je Steuerpflichtigem abgegeben — '
      + 'diese Mappe fasst sie zusammen und ist deshalb nur als Übersicht zu verwenden. '
      + 'Für die Erklärung filtern Sie bitte je Halter.', CW);
    doc.text(mt, M, cy);
    cy += mt.length * 4.4 + 6;
    doc.setFont('helvetica', 'normal');
  }

  zeile('Name', h.name || 'nicht hinterlegt', !h.name);
  if (h.rechtsform) zeile('Rechtsform', h.rechtsform, false);
  if (h.firma) zeile('Firma', h.firma, false);
  zeile('Steuernummer', h.steuernummer || 'nicht hinterlegt', !h.steuernummer);
  zeile('Finanzamt', h.finanzamt || 'nicht hinterlegt', !h.finanzamt);
  if (h.gesellschaft || h.ustid) zeile('USt-IdNr.', h.ustid || 'nicht hinterlegt', !h.ustid);
  if (h.gesellschaft) zeile('Handelsregister', h.handelsregister || 'nicht hinterlegt', !h.handelsregister);
  var anschrift = [h.strasse, h.ort].filter(Boolean).join(', ');
  zeile('Anschrift', anschrift || 'nicht hinterlegt', !anschrift);

  cy += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(42, 39, 39);
  doc.text('ENTHALTENE OBJEKTE (' + saetze.length + ')', M, cy);
  cy += 3;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, cy, M + CW, cy);
  cy += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  saetze.forEach(function (s, i) {
    if (cy > H - 46) { doc.addPage(); cy = 26; }
    var st = stamm[s.object_id];
    doc.setTextColor(122, 115, 112); doc.setFontSize(8);
    doc.text(String(i + 1) + '.', M, cy);
    doc.setTextColor(42, 39, 39); doc.setFontSize(9);
    doc.text(String((st && st.name) || s.object_name || 'Objekt').slice(0, 52), M + 7, cy);
    if (st && st.addr) {
      doc.setTextColor(122, 115, 112); doc.setFontSize(7.5);
      doc.text(String(st.addr).slice(0, 44), M + CW, cy, { align: 'right' });
    }
    cy += 6.2;
  });

  /* Wofür die Mappe NICHT taugt, steht auf dem Deckblatt — nicht im Kleingedruckten. */
  var fy = H - 34;
  doc.setDrawColor(210, 205, 198); doc.setLineWidth(0.3);
  doc.line(M, fy - 6, M + CW, fy - 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  doc.setTextColor(122, 115, 112);
  var ft = doc.splitTextToSize('Diese Mappe fasst die je Objekt gespeicherten Steuersätze '
    + 'zusammen und ordnet sie den Zeilen der amtlichen Anlage V zu. Sie ersetzt keine '
    + 'Steuererklärung und keine Beratung. Die Angaben oben stammen aus Ihren Einstellungen — '
    + 'als „nicht hinterlegt" gekennzeichnete Felder tragen Sie dort nach '
    + '(Gesellschaften: Einstellungen → Mandanten; privat: Einstellungen → Account & Sicherheit).', CW);
  doc.text(ft, M, fy);
}
