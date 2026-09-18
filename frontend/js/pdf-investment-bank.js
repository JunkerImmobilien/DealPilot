/* ════════════════════════════════════════════════════════════════════
   v1436 · INVESTMENT CASE — BANKFASSUNG (hell)
   ════════════════════════════════════════════════════════════════════

   Backlog v22, Punkt 11: „Das bestehende Investment-PDF unbedingt
   beibehalten und nicht überschreiben. Zusätzlich eine neue Version als
   Test/Alternative … professioneller, heller und seriöser … Als
   gestalterische Referenz das vorhandene Dokument für Anschaffungskosten/
   Finanzamt heranziehen."

   Referenz ist pdf-anlage-bmf.js (Kaufpreisaufteilung fürs Finanzamt):
   weiße Seite, fast schwarzer Text, graue Beschriftung, Haarlinien,
   Summen dunkelgold, Kopf mit Absender rechts und Goldlinie. Diese Datei
   übernimmt die Handschrift, nicht den Code.

   DIESE DATEI RECHNET NICHTS. Sie liest, was calc.js bereits hat:
     State.gi, State.kpis (bmy, nmy, fak, ekr, dscr, ltv, cf_m, irr …),
     State.ltv_basis_label, State.cfRows (Jahreswerte).
   Fehlt ein Wert, steht ein Strich — nie eine Null, die wie eine Messung
   aussieht (CLAUDE.md: Number(null) ist 0 und besteht isFinite).

   Das alte Investment-PDF (pdf.js, exportPDF) bleibt unverändert. Diese
   Fassung läuft daneben: window.exportPDFBank().
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function txt(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  function num(id) {
    var s = txt(id); if (!s) return null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function da(v) { return (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v); }
  function eur(v, dec) {
    v = da(v); if (v === null) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(v) + ' €';
  }
  function pct(v, dec) {
    v = da(v); if (v === null) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec }).format(v) + ' %';
  }
  function zahl(v, dec) {
    v = da(v); if (v === null) return '—';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(v);
  }
  function gold() {
    try { if (typeof window._pdfGold === 'function') return window._pdfGold(); } catch (e) {}
    return [201, 168, 76];
  }
  function heute() {
    var t = new Date();
    return ('0' + t.getDate()).slice(-2) + '.' + ('0' + (t.getMonth() + 1)).slice(-2) + '.' + t.getFullYear();
  }

  /* Absender: dieselbe Regel wie die Finanzamt-Anlage (v975) — eigenes
     Branding nur mit custom_logo UND gesetzter Firma, sonst neutral. */
  function absender() {
    var b = (window.DealPilotConfig && DealPilotConfig.branding && typeof DealPilotConfig.branding.get === 'function')
      ? (DealPilotConfig.branding.get() || {}) : {};
    var darf = false;
    try { darf = !!(DealPilotConfig.pricing && DealPilotConfig.pricing.hasFeature && DealPilotConfig.pricing.hasFeature('custom_logo')); } catch (e) {}
    var firma = String(b.company || '').trim();
    if (!darf || !firma || firma === 'Junker Immobilien') {
      return { firma: 'DealPilot', zeilen: ['DealPilot', 'dealpilot.junker-immobilien.io'] };
    }
    var z = [firma];
    var l2 = [String(b.address || '').trim(), ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(' · ');
    if (l2) z.push(l2);
    if (b.email) z.push(String(b.email)); else if (b.website) z.push(String(b.website));
    return { firma: firma, zeilen: z };
  }

  var OBJART = { ETW: 'Eigentumswohnung', EFH: 'Einfamilienhaus', ZFH: 'Zweifamilienhaus', MFH: 'Mehrfamilienhaus',
    DHH: 'Doppelhaushälfte', RH: 'Reihenhaus', BUERO: 'Bürogebäude', GESCH: 'Geschäftshaus', HOTEL: 'Hotel',
    GEW: 'Gewerbe', GAR: 'Garage / Stellplatz' };

  window.exportPDFBank = function () {
    if (typeof window.jspdf === 'undefined') { alert('PDF-Bibliothek noch nicht geladen — bitte kurz warten und erneut versuchen.'); return; }
    try { if (typeof window.calcNow === 'function') window.calcNow(); } catch (e) {}
    var S = window.State || {}, K = S.kpis || {}, rows = S.cfRows || [];

    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, L = 18, R = 18, CW = W - L - R, y = 22;
    var G = gold(), GD = [Math.round(G[0] * 0.82), Math.round(G[1] * 0.82), Math.round(G[2] * 0.82)];
    var ab = absender();

    /* ── Bausteine ───────────────────────────────────────────── */
    function kopf(titel, unter) {
      y = 22;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(26, 26, 26);
      doc.text(ab.firma, L, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(120);
      doc.text('I M M O B I L I E N - I N V E S T I T I O N S A N A L Y S E', L, y + 4.6);
      doc.setFontSize(8); doc.setTextColor(110);
      var by = y - 2.5; ab.zeilen.forEach(function (t) { doc.text(t, W - R, by, { align: 'right' }); by += 3.8; });
      y += 8.5;
      doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.8); doc.line(L, y, W - R, y); doc.setLineWidth(0.2);
      y += 10;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 26, 26); doc.text(titel, L, y); y += 5.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text(unter, L, y);
      y += 10;
    }
    function abschnitt(t) {
      if (y > H - 40) { doc.addPage(); kopf('Investment Case', 'Fortsetzung'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(GD[0], GD[1], GD[2]);
      doc.text(t.toUpperCase(), L, y);
      doc.setDrawColor(226, 221, 210); doc.line(L, y + 1.8, W - R, y + 1.8);
      y += 7.5;
    }
    function zeile(label, wert, o) {
      o = o || {};
      if (o.summe) { doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.6); doc.line(L, y - 3.8, W - R, y - 3.8); doc.setLineWidth(0.2); }
      doc.setFont('helvetica', (o.summe || o.fett) ? 'bold' : 'normal'); doc.setFontSize(9.2);
      doc.setTextColor(o.summe ? 26 : (o.klein ? 110 : 50));
      doc.text(label, L + (o.einzug ? 4 : 0), y);
      if (o.summe) doc.setTextColor(GD[0], GD[1], GD[2]); else doc.setTextColor(26, 26, 26);
      doc.text(String(wert), W - R, y, { align: 'right' });
      if (!o.summe) { doc.setDrawColor(236, 232, 223); doc.setLineWidth(0.15); doc.line(L, y + 2, W - R, y + 2); doc.setLineWidth(0.2); }
      y += o.summe ? 8 : 6.1;
    }
    /* Kennzahlen als Raster 3 × n: ruhig, gut lesbar, ohne Farbflächen */
    function raster(items) {
      var sp = 3, bw = (CW - 2 * sp) / 3, bh = 17;
      items.forEach(function (it, i) {
        var c = i % 3, r = Math.floor(i / 3), x = L + c * (bw + sp), yy = y + r * (bh + sp);
        doc.setDrawColor(226, 221, 210); doc.setLineWidth(0.25); doc.rect(x, yy, bw, bh);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(120); doc.text(it[0], x + 3.5, yy + 5.5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(26, 26, 26); doc.text(it[1], x + 3.5, yy + 12.6);
        if (it[2]) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(140); doc.text(it[2], x + bw - 3, yy + 12.6, { align: 'right' }); }
      });
      y += Math.ceil(items.length / 3) * (bh + sp) + 4;
    }
    function fuss() {
      var n = doc.getNumberOfPages();
      for (var p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 221, 210); doc.line(L, H - 16, W - R, H - 16);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
        doc.text(ab.firma + ' · Investment Case · erstellt am ' + heute(), L, H - 11.5);
        doc.text('Seite ' + p + ' von ' + n, W - R, H - 11.5, { align: 'right' });
      }
    }

    /* ── Daten (nur gelesen) ─────────────────────────────────── */
    var adr = [[txt('str'), txt('hnr')].filter(Boolean).join(' '), [txt('plz'), txt('ort')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var kp = num('kp'), san = num('san'), moebl = num('moebl'), gi = da(S.gi);
    var nk = (gi !== null && kp !== null) ? Math.max(0, gi - kp - (san || 0) - (moebl || 0)) : null;
    var ek = num('ek'), d1 = num('d1');
    var d2an = el('d2_enable') && el('d2_enable').checked, d2 = d2an ? num('d2') : null;

    /* ── Seite 1 ─────────────────────────────────────────────── */
    kopf('Investment Case', (adr || 'Objekt ohne Anschrift') + ' · Finanzierungsunterlage · Stand ' + heute());

    abschnitt('Objekt');
    zeile('Anschrift', adr || '—');
    zeile('Objektart', OBJART[txt('objart')] || txt('objart') || '—');
    zeile('Wohnfläche', num('wfl') !== null ? zahl(num('wfl'), 0) + ' m²' : '—');
    zeile('Baujahr', txt('baujahr') || '—');     /* Jahreszahl nie durch Intl (CLAUDE.md) */
    if (txt('kaufdat')) zeile('Kaufdatum', txt('kaufdat'));
    y += 3;

    abschnitt('Investition');
    zeile('Kaufpreis', eur(kp));
    zeile('Erwerbsnebenkosten' + (kp && nk !== null ? ' (' + pct(nk / kp * 100, 1) + ')' : ''), eur(nk));
    if (san) zeile('Sanierung / Modernisierung', eur(san));
    if (moebl) zeile('Möblierung / Inventar', eur(moebl));
    zeile('Gesamtinvestition', eur(gi), { summe: true });
    y += 1;

    abschnitt('Finanzierung');
    zeile('Eigenkapital' + (gi && ek !== null ? ' (' + pct(ek / gi * 100, 1) + ' der Gesamtinvestition)' : ''), eur(ek));
    zeile('Darlehen I', eur(d1));
    zeile('Sollzins / Tilgung / Zinsbindung', [pct(num('d1z'), 2), pct(num('d1t'), 2), num('d1_bindj') !== null ? zahl(num('d1_bindj')) + ' Jahre' : '—'].join('  ·  '), { einzug: true, klein: true });
    if (d2an) zeile('Darlehen II', eur(d2));
    zeile('Finanzierung gesamt', eur((d1 || 0) + (d2 || 0)), { summe: true });
    y += 1;

    abschnitt('Kennzahlen');
    raster([
      ['Bruttomietrendite', pct(K.bmy, 2), 'auf Kaufpreis'],
      ['Nettomietrendite', pct(K.nmy, 2), 'auf Gesamtinvest.'],
      ['Kaufpreisfaktor', zahl(K.fak, 1), 'fach'],
      ['Cashflow vor Steuern', eur(K.cf_m), 'je Monat'],
      ['DSCR', zahl(K.dscr, 2), ''],
      ['LTV', pct(K.ltv, 1), S.ltv_basis_label ? 'auf ' + S.ltv_basis_label : ''],
      ['EK-Rendite', pct(K.ekr, 2), 'p. a.'],
      ['Interner Zinsfuß (IRR)', da(K.irr) === null ? 'nicht bestimmbar' : pct(K.irr, 2), ''],
      ['Kaltmiete', rows[0] ? eur(rows[0].nkm_y) : '—', 'im ersten Jahr']
    ]);

    /* ── Seite 2 ─────────────────────────────────────────────── */
    doc.addPage();
    kopf('Cashflow-Entwicklung', (adr || 'Objekt') + ' · die ersten ' + Math.min(10, rows.length || 0) + ' Jahre');
    var sp = [['Jahr', 16], ['Kaltmiete', 24], ['Bewirtsch.', 22], ['Zins', 22], ['Tilgung', 22], ['CF v. St.', 24], ['Restschuld', 26], ['LTV', 16]];
    var fak = CW / sp.reduce(function (a, s) { return a + s[1]; }, 0);
    function tabZeile(werte, fett, kopfzeile) {
      var x = L;
      doc.setFont('helvetica', (fett || kopfzeile) ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.4 : 8.4);
      doc.setTextColor(kopfzeile ? 110 : 40);
      werte.forEach(function (w, i) {
        var bw = sp[i][1] * fak;
        if (i === 0) doc.text(String(w), x, y); else doc.text(String(w), x + bw - 1, y, { align: 'right' });
        x += bw;
      });
      doc.setDrawColor(kopfzeile ? G[0] : 236, kopfzeile ? G[1] : 232, kopfzeile ? G[2] : 223);
      doc.setLineWidth(kopfzeile ? 0.5 : 0.15); doc.line(L, y + 2.2, W - R, y + 2.2); doc.setLineWidth(0.2);
      y += kopfzeile ? 7 : 6.2;
    }
    if (!rows.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
      doc.text('Keine Jahreswerte vorhanden — bitte Objekt vollständig erfassen.', L, y); y += 8;
    } else {
      tabZeile(sp.map(function (s) { return s[0]; }), false, true);
      rows.slice(0, 10).forEach(function (r) {
        tabZeile([r.cal || r.y, zahl(r.nkm_y), zahl(r.bwk_y), zahl(r.zy), zahl(r.ty), zahl(r.cfop_y), zahl(r.rs), pct(r.ltv_y, 1)]);
      });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Beträge in Euro je Jahr. CF v. St. = Cashflow vor Steuern (Kaltmiete - Bewirtschaftung - Zins - Tilgung).', L, y + 1);
      y += 10;
    }

    abschnitt('Grundlagen und Hinweise');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(60);
    var hinweis = 'Alle Werte beruhen auf den im Objekt erfassten Angaben und den dort hinterlegten Annahmen '
      + '(Mietentwicklung, Bewirtschaftungskosten, Zins und Tilgung). Sie sind eine Kalkulation, kein '
      + 'Wertgutachten nach § 194 BauGB und keine Anlage- oder Finanzierungsberatung. Der LTV bezieht sich auf '
      + (S.ltv_basis_label || 'die angegebene Bezugsgröße') + '.';
    doc.splitTextToSize(hinweis, CW).forEach(function (z) { doc.text(z, L, y); y += 4.4; });

    fuss();
    var slug = (adr || 'Objekt').replace(/[^A-Za-z0-9äöüÄÖÜß]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    doc.save('Investment_Case_Bank_' + slug + '_' + heute().split('.').reverse().join('') + '.pdf');
  };
})();
