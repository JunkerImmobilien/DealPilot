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
  /* v975-branding: eigenes Branding nur bei custom_logo (Investor+) UND gesetzt — sonst neutral DealPilot */
  var brand = (function(){
    var b = (window.DealPilotConfig && DealPilotConfig.branding && typeof DealPilotConfig.branding.get === 'function')
      ? (DealPilotConfig.branding.get() || {}) : {};
    var canBrand = false;
    try { canBrand = !!(window.DealPilotConfig && DealPilotConfig.pricing
      && typeof DealPilotConfig.pricing.hasFeature === 'function'
      && DealPilotConfig.pricing.hasFeature('custom_logo')); } catch(e){}
    var comp = String(b.company || '').trim();
    var isDefaultOrEmpty = !comp || comp === 'Junker Immobilien';
    if(!canBrand || isDefaultOrEmpty){
      return { company: 'DealPilot', name: '', role: '', address: '', plz: '', city: '',
               phone: '', email: '', website: 'dealpilot.junker-immobilien.io', theme: b.theme, _dpNeutral: true };
    }
    return b;
  })();

  // ── v983-pdf-demo2: KOPF im Demo-Layout (Brand links · Absender rechts · Gold-Linie) ──
  var _g0 = window._pdfGold();
  var _gd = [Math.round(_g0[0]*0.82), Math.round(_g0[1]*0.82), Math.round(_g0[2]*0.82)];
  doc.setFontSize(15); doc.setFont('helvetica','bold'); doc.setTextColor(26,26,26);
  doc.text(String(brand.company || 'DealPilot'), marginL, y);
  doc.setFontSize(6.6); doc.setFont('helvetica','normal'); doc.setTextColor(120);
  doc.text('I M M O B I L I E N - I N V E S T I T I O N S A N A L Y S E', marginL, y + 4.6);
  (function(){
    var bx = pageW - marginR, by = y - 2.5;
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(110);
    var lines = [];
    if(brand._dpNeutral){ lines = ['DealPilot', 'dealpilot.junker-immobilien.io']; }
    else {
      if(brand.company) lines.push(String(brand.company));
      var l2 = [String(brand.address || '').trim(), ((brand.plz || '') + ' ' + (brand.city || '')).trim()].filter(Boolean).join(' \u00b7 ');
      if(l2) lines.push(l2);
      if(brand.email) lines.push(String(brand.email));
      else if(brand.website) lines.push(String(brand.website));
    }
    lines.forEach(function(t){ doc.text(t, bx, by, { align: 'right' }); by += 3.8; });
  })();
  y += 8.5;
  doc.setDrawColor(_g0[0],_g0[1],_g0[2]); doc.setLineWidth(0.8);
  doc.line(marginL, y, pageW - marginR, y);
  doc.setLineWidth(0.2); y += 10;
  doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(26,26,26);
  doc.text('Anlage zur Steuererkl\u00e4rung: Kaufpreisaufteilung', marginL, y); y += 5.5;
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(110);
  var _t = new Date();
  doc.text('nach BMF-Arbeitshilfe \u00b7 Fassung Juni 2023 \u00b7 erstellt am ' + ('0'+_t.getDate()).slice(-2) + '.' + ('0'+(_t.getMonth()+1)).slice(-2) + '.' + _t.getFullYear(), marginL, y);
  doc.setTextColor(0); y += 10;

  // Demo-Helfer: Sektions-Header + Key/Value-Zeilen
  function _secHead(txt){
    if(y > 252){ doc.addPage(); y = marginT; }
    doc.setFontSize(8.6); doc.setFont('helvetica','bold'); doc.setTextColor(_gd[0],_gd[1],_gd[2]);
    doc.text(String(txt).toUpperCase(), marginL, y);
    doc.setDrawColor(226,221,210); doc.setLineWidth(0.2);
    doc.line(marginL, y + 1.8, pageW - marginR, y + 1.8);
    doc.setTextColor(0); y += 7.5;
  }
  function _hair(x1, x2, ly){ doc.setDrawColor(231,227,217); doc.setLineWidth(0.15); doc.line(x1, ly, x2, ly); doc.setLineWidth(0.2); }
  function _kvRow(label, val, opts){
    opts = opts || {};
    if(y > 270){ doc.addPage(); y = marginT; }
    if(opts.total){
      doc.setDrawColor(_g0[0],_g0[1],_g0[2]); doc.setLineWidth(0.6);
      doc.line(marginL, y - 0.8, pageW - marginR, y - 0.8); doc.setLineWidth(0.2); y += 3.4;
    }
    doc.setFontSize(opts.total ? 10 : 9);
    doc.setFont('helvetica', (opts.total || opts.bold) ? 'bold' : 'normal');
    doc.setTextColor(opts.total ? 26 : (opts.sub ? 110 : 50));
    doc.text(String(label), marginL + (opts.sub ? 5 : 0), y);
    if(opts.total || opts.goldVal){ doc.setTextColor(_gd[0],_gd[1],_gd[2]); }
    else if(opts.bold){ doc.setTextColor(26,26,26); }
    doc.text(String(val), pageW - marginR, y, { align: 'right' });
    if(!opts.total) _hair(marginL, pageW - marginR, y + 1.7);
    doc.setTextColor(0); y += opts.total ? 8 : 6.1;
  }

  // ── 1 · Objekt & Kaufvertrag (2-spaltiges Raster wie Demo) ──
  _secHead('1 \u00b7 Objekt & Kaufvertrag');
  (function(){
    var lage = String(inputs.lage || '').replace(/^[\s,]+|[\s,]+$/g, '').trim() || '\u2014';
    var gsbrw = (inputs.grundstuecksgroesse ? inputs.grundstuecksgroesse + ' m\u00b2' : '\u2014') + ' \u00b7 ' + (inputs.bodenrichtwert ? inputs.bodenrichtwert + ' \u20ac/m\u00b2' : '\u2014');
    var pairs = [
      ['Lage', lage],
      ['Grundst\u00fccksart', String(inputs.grundstuecksart || '\u2014')],
      ['Kaufdatum', (function(d){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(d || '\u2014'); })(inputs.kaufdatum)],  /* v984-pdf-fix */
      ['Baujahr', String(inputs.baujahr || '\u2014')],
      ['Wohn-/Nutzfl\u00e4che', inputs.wohnflaeche ? inputs.wohnflaeche + ' m\u00b2' : '\u2014'],
      ['Grundst\u00fcck / BRW', gsbrw],
      ['Kaufpreis (gesamt)', fmtEur(inputs.kaufpreis, 2)]
    ];
    var gutW = 10, colW = (contentW - gutW) / 2, rowH = 6.6;
    pairs.forEach(function(p, i){
      var col = i % 2, row = Math.floor(i / 2);
      var x = marginL + col * (colW + gutW), ry = y + row * rowH;
      doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(110);
      doc.text(String(p[0]), x, ry);
      doc.setFont('helvetica','bold'); doc.setTextColor(26,26,26);
      var v = String(p[1]); if(v.length > 42) v = v.slice(0, 41) + '\u2026';
      doc.text(v, x + colW, ry, { align: 'right' });
      _hair(x, x + colW, ry + 1.7);
    });
    y += Math.ceil(pairs.length / 2) * rowH + 5;
    doc.setTextColor(0);
  })();

  // ── 2 · Anschaffungskosten (Demo-Liste, inkl. Herstellungskosten) ──  [ersetzt V306]
  var ak = inputs.anschaffung || {};
  if(y > 198){ doc.addPage(); y = marginT; }
  _secHead('2 \u00b7 Anschaffungskosten (Bemessungsgrundlage)');
  _kvRow('Kaufpreis (laut Notarvertrag)', fmtEur(ak.kp, 2));
  if(ak.hk && ak.hk > 0) _kvRow('Herstellungskosten Geb\u00e4ude (\u00a7 255 Abs. 2 HGB) \u00b7 100 % Geb\u00e4ude', fmtEur(ak.hk, 2), { sub: true, goldVal: true });  /* v992-pdf */
  _kvRow('Grunderwerbsteuer', fmtEur(ak.grest, 2), { sub: true });
  _kvRow('Notar- und Gerichtskosten', fmtEur(ak.notar, 2), { sub: true });
  _kvRow('Grundbuchamt', fmtEur(ak.gba, 2), { sub: true });
  _kvRow('Maklergeb\u00fchr', fmtEur(ak.makler, 2), { sub: true });
  if(ak.ji && ak.ji > 0) _kvRow('Sonstige Erwerbsnebenkosten', fmtEur(ak.ji, 2), { sub: true });
  if(ak.fahrt && ak.fahrt > 0) _kvRow('Fahrtkosten', fmtEur(ak.fahrt, 2), { sub: true });
  if(ak.verpfl && ak.verpfl > 0) _kvRow('Verpflegungsmehraufwand', fmtEur(ak.verpfl, 2), { sub: true });
  if(ak.hotel && ak.hotel > 0) _kvRow('Unterkunft', fmtEur(ak.hotel, 2), { sub: true });
  if(ak.gutachten && ak.gutachten > 0) _kvRow('Wertgutachten / Sachverst\u00e4ndige', fmtEur(ak.gutachten, 2), { sub: true });
  if(ak.anwalt && ak.anwalt > 0) _kvRow('Anwaltskosten (Kaufvorgang)', fmtEur(ak.anwalt, 2), { sub: true });
  if(ak.sonst && ak.sonst > 0) _kvRow('Sonstiges (Vermessung, Energieausweis)', fmtEur(ak.sonst, 2), { sub: true });
  if(ak.ahk && ak.ahk > 0) _kvRow('Anschaffungsnahe Herstellkosten (\u00a7 6 Abs. 1 Nr. 1a EStG)', fmtEur(ak.ahk, 2), { sub: true });
  /* v990-pdf-sum: Summe = gedruckte Positionen (ak.total aus textContent war fragil/veraltet) */
  var _sum990 = (ak.kp||0)+(ak.grest||0)+(ak.notar||0)+(ak.gba||0)+(ak.makler||0)+(ak.ji||0)
              +(ak.fahrt||0)+(ak.verpfl||0)+(ak.hotel||0)+(ak.gutachten||0)+(ak.anwalt||0)
              +(ak.sonst||0)+(ak.ahk||0);
  var _tot992 = _sum990 + ((ak.hk && ak.hk > 0) ? ak.hk : 0);
  _kvRow((ak.hk && ak.hk > 0) ? 'Anschaffungs- & Herstellungskosten gesamt' : 'Anschaffungskosten gesamt', fmtEur(_tot992, 2), { total: true });
  /* v985-pdf-hk: HK-Zeile nach der Summe entfernt — steht jetzt unter dem Kaufpreis (nur > 0) */
  y += 2;

  // ── 3 · Kaufpreisaufteilung (Demo: Resultbox mit Split-Balken + EIN AfA-Kasten) ──
  if(y > 185){ doc.addPage(); y = marginT; }
  _secHead('3 \u00b7 Kaufpreisaufteilung');

  function _val(k){ var r = results[k]; var v = r && r.value; if(v && typeof v === 'object') v = null;
    return (typeof v === 'number' && isFinite(v)) ? v : null; }
  var afaBasisSplit = _val('kaufpreisanteil_gebaeude');
  var grundAnteil   = _val('kaufpreisanteil_grund');
  var gebanteil     = _val('gebaeudeanteil_prozent');
  var vw            = _val('massgebender_verkehrswert');
  var sw            = _val('sachwert_marktangepasst'); if(sw === null) sw = _val('sachwert_vorlaeufig');
  var ew            = _val('ertragswert');
  var vgw           = _val('vergleichswert');   // defensiv: {formula}-Objekt -> null
  var boden         = _val('bodenwert');
  var hk            = (ak.hk && ak.hk > 0) ? ak.hk : 0;   // Herstellungskosten 100% Gebäude
  var afaBasis      = (afaBasisSplit || 0) + hk;          // AfA-Basis inkl. HK

  function _near(a,b){ return a != null && b != null && Math.abs(a - b) < 1; }
  var verfahren = _near(vw, ew) ? 'Ertragswertverfahren'
                : _near(vw, vgw) ? 'Vergleichswertverfahren'
                : _near(vw, sw) ? 'Sachwertverfahren' : 'BMF-Automatik';
  var verfGrund = verfahren === 'Ertragswertverfahren' ? ' (Miete bekannt)'
                : verfahren === 'Vergleichswertverfahren' ? ' (Vergleichsfaktor)' : '';

  // Resultbox: Kopfteil + Split-Balken in EINEM Rahmen (Demo)
  var topH = 15, barH = 9, rbH = topH + barH;
  doc.setDrawColor(226,221,210); doc.setFillColor(250,247,240);
  doc.roundedRect(marginL, y, contentW, rbH, 2, 2, 'FD');
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(110);
  doc.text('MASSGEBENDER VERKEHRSWERT', marginL + 5, y + 5.4);
  doc.setFontSize(8);
  doc.text('gew\u00e4hlt: ' + verfahren + verfGrund, marginL + 5, y + 10.8);
  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(_gd[0],_gd[1],_gd[2]);
  doc.text(fmtEur(vw, 0), pageW - marginR - 5, y + 10.2, { align: 'right' });
  doc.setTextColor(0);
  if(gebanteil != null){
    var gp = Math.max(0, Math.min(100, gebanteil)) / 100;
    var by2 = y + topH;
    doc.setFillColor(_g0[0],_g0[1],_g0[2]); doc.rect(marginL + 0.3, by2, (contentW - 0.6) * gp, barH - 0.4, 'F');
    doc.setFillColor(239,233,220); doc.rect(marginL + 0.3 + (contentW - 0.6) * gp, by2, (contentW - 0.6) * (1 - gp), barH - 0.4, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold');
    if(gp > 0.18){ doc.setTextColor(26,21,8); doc.text('Geb\u00e4ude ' + fmtPct(gebanteil, 2), marginL + 4, by2 + 5.9); }
    if((1 - gp) > 0.14){ doc.setTextColor(95); doc.text('Grund ' + fmtPct(100 - gebanteil, 2), marginL + 4 + contentW * gp, by2 + 5.9); }
    doc.setTextColor(0);
  }
  y += rbH + 5;

  // AfA-Kasten: EIN Rahmen, 3 Zellen (Demo-afabox), erste Zelle gruen hervorgehoben
  if(hk > 0){
    doc.setFontSize(7.8); doc.setFont('helvetica','normal'); doc.setTextColor(110);
    doc.text('AfA-Bemessungsgrundlage = Geb\u00e4udeanteil der AK ' + fmtEur(afaBasisSplit, 0) + ' + Herstellungskosten ' + fmtEur(hk, 0) + ' (100 % Geb\u00e4ude)', marginL, y);
    doc.setTextColor(0); y += 4.5;
  }
  var abH = 18, cellW = contentW / 3;
  doc.setDrawColor(226,221,210); doc.setFillColor(255,255,255);
  doc.roundedRect(marginL, y, contentW, abH, 2, 2, 'FD');
  doc.setFillColor(238,247,240);
  doc.rect(marginL + 0.3, y + 0.3, cellW - 0.6, abH - 0.6, 'F');
  doc.setDrawColor(226,221,210);
  doc.line(marginL + cellW, y, marginL + cellW, y + abH);
  doc.line(marginL + 2 * cellW, y, marginL + 2 * cellW, y + abH);
  var _cells = [
    ['GEB\u00c4UDEANTEIL DER AK \u00b7 AFA-BEMESSUNGSGRUNDLAGE', fmtEur(afaBasis, 0), [47,143,92]],
    ['ANTEIL GRUND & BODEN', fmtEur(grundAnteil, 0), [35,35,35]],
    ['BODENWERT (GRUNDST\u00dcCK)', fmtEur(boden, 0), [35,35,35]]
  ];
  _cells.forEach(function(c, i){
    var cx = marginL + i * cellW;
    doc.setFontSize(6.6); doc.setFont('helvetica','normal'); doc.setTextColor(110);
    doc.text(doc.splitTextToSize(c[0], cellW - 8), cx + 4, y + 5.2);
    doc.setFontSize(12.5); doc.setFont('helvetica','bold'); doc.setTextColor(c[2][0], c[2][1], c[2][2]);
    doc.text(String(c[1]), cx + 4, y + 14.6);
  });
  doc.setTextColor(0);
  y += abH + 8;

  // ── 4 · Bewertungsverfahren (Verprobung, Demo-Zeilen) ──
  if(y > 232){ doc.addPage(); y = marginT; }
  _secHead('4 \u00b7 Bewertungsverfahren (Verprobung)');
  _kvRow('Ertragswertverfahren' + (verfahren === 'Ertragswertverfahren' ? ' \u00b7 ma\u00dfgebend' : ''), fmtEur(ew, 2), { bold: verfahren === 'Ertragswertverfahren' });
  _kvRow('Sachwertverfahren (marktangepasst)' + (verfahren === 'Sachwertverfahren' ? ' \u00b7 ma\u00dfgebend' : ''), fmtEur(sw, 2), { bold: verfahren === 'Sachwertverfahren' });
  _kvRow('Vergleichswertverfahren' + (verfahren === 'Vergleichswertverfahren' ? ' \u00b7 ma\u00dfgebend' : ''), (vgw != null ? fmtEur(vgw, 2) : 'nicht angewandt (kein Vergleichsfaktor)'), { bold: verfahren === 'Vergleichswertverfahren' });
  y += 3;

  // Hinweis-Kasten (Demo-note: heller Kasten mit Gold-Balken links)
  if(y > 238){ doc.addPage(); y = marginT; }
  var noteTxt = 'Die Aufteilung folgt der amtlichen Arbeitshilfe des Bundesministeriums der Finanzen (Fassung Juni 2023). Die Anschaffungskosten (Bemessungsgrundlage) werden mit dem Geb\u00e4udeanteil multipliziert und ergeben die AfA-Bemessungsgrundlage' + (hk > 0 ? ' \u2014 zuz\u00fcglich Herstellungskosten (\u00a7 255 Abs. 2 HGB), die zu 100 % dem Geb\u00e4ude zugerechnet werden' : '') + '. Alle drei Verfahren werden berechnet; ma\u00dfgebend ist das nach BMF-Logik gew\u00e4hlte (bekannte Miete -> Ertragswert, Vergleichsfaktor -> Vergleichswert, sonst Sachwert). Diese Anlage dient der Nachvollziehbarkeit gegen\u00fcber dem Finanzamt und ersetzt keine steuerliche Beratung.';
  var noteLines = doc.splitTextToSize(noteTxt, contentW - 12);
  var nH = noteLines.length * 3.5 + 6;
  doc.setFillColor(250,247,240); doc.rect(marginL, y, contentW, nH, 'F');
  doc.setFillColor(_g0[0],_g0[1],_g0[2]); doc.rect(marginL, y, 1.4, nH, 'F');
  doc.setFontSize(7.4); doc.setFont('helvetica','normal'); doc.setTextColor(110);
  doc.text(noteLines, marginL + 5.5, y + 4.6);
  doc.setTextColor(0); y += nH + 8;

  // ──────────────────────────────────────────────────────────
  // SEITE 2: AfA-VORSCHAU + KLAUSEL
  // ──────────────────────────────────────────────────────────
  if(y > 230){ doc.addPage(); y = marginT; }

  _secHead('5 \u00b7 Lineare AfA (\u00a7 7 Abs. 4 EStG)');
  var afaSatz = (inputs.baujahr && inputs.baujahr > 2022) ? 3.0 : 2.0;
  var afaSatzText = (inputs.baujahr && inputs.baujahr > 2022)
    ? 'Neubau ab 2023 (3,0 % nach \u00a7 7 Abs. 4 Nr. 2a EStG)'
    : 'Bestand (2,0 % nach \u00a7 7 Abs. 4 Nr. 2a EStG)';
  var afaJahr = afaBasis ? (afaBasis * afaSatz / 100) : null;
  _kvRow('AfA-Basis (Geb\u00e4ude)' + (hk > 0 ? ' \u2014 inkl. Herstellungskosten' : ''), fmtEur(afaBasis, 2), { bold: true });
  _kvRow('AfA-Satz', afaSatzText);
  _kvRow('J\u00e4hrliche AfA', fmtEur(afaJahr, 2), { bold: true, goldVal: true });
  _kvRow('AfA-Zeitraum', (afaSatz === 3.0 ? '33,33 Jahre' : '50 Jahre'));
  y += 4;

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
      : (brand.company || 'DealPilot');
    doc.setDrawColor(226,221,210); doc.setLineWidth(0.2);
    doc.line(marginL, footerY - 4, pageW - marginR, footerY - 4);
    doc.text(_footTxt + ' \u00b7 Kaufpreisaufteilung nach BMF-Arbeitshilfe Juni 2023', marginL, footerY);
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
