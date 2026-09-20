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

   v1460 (Marcel 20.09.2026: „die anderen Sachen aus dem jetzigen PDF müssen
   auch drauf, nur in diesem Design"): die Bankfassung trägt jetzt ALLE
   Blöcke des alten Investment-PDFs —
     Deal Score · Ertragsrechnung (Warmmiete bis Cashflow nach Steuern) ·
     Bewirtschaftung umlagefähig / nicht umlagefähig · drei Phasen (Heute,
     Ende Zinsbindung, Anschluss) · Zinsänderungsrisiko · Cashflow-Jahre ·
     Vermögensaufbau als Kurve (Wert, Restschuld, Eigenkapital) ·
     Einheiten beim Mehrfamilienhaus · Annahmen und Hinweise.
   Weiter gilt: DIESE DATEI RECHNET NICHTS. Der Score kommt aus dem
   Rechenkern DealScore.computeFromKpis(), die Phasen aus State.kpis
   (…_ezb, …_an), die Jahre aus State.cfRows.
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
    /* Tabelle im selben Strich wie die Zeilen: Haarlinien, Kopf in Gold. */
    function tabelle(spalten, zeilen, o) {
      o = o || {};
      var fak = CW / spalten.reduce(function (a, s) { return a + s[1]; }, 0);
      function tz(werte, kopfzeile, fett) {
        var x = L;
        doc.setFont('helvetica', (kopfzeile || fett) ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.4 : 8.4);
        doc.setTextColor(kopfzeile ? 110 : (fett ? 26 : 45));
        werte.forEach(function (w, i) {
          var bw = spalten[i][1] * fak;
          if (i === 0 || spalten[i][2] === 'l') doc.text(String(w), x, y);
          else doc.text(String(w), x + bw - 1, y, { align: 'right' });
          x += bw;
        });
        doc.setDrawColor(kopfzeile ? G[0] : 236, kopfzeile ? G[1] : 232, kopfzeile ? G[2] : 223);
        doc.setLineWidth(kopfzeile ? 0.5 : 0.15); doc.line(L, y + 2.2, W - R, y + 2.2); doc.setLineWidth(0.2);
        y += kopfzeile ? 7 : 6.2;
      }
      tz(spalten.map(function (s) { return s[0]; }), true);
      zeilen.forEach(function (z) {
        if (y > H - 28) { doc.addPage(); kopf(o.titel || 'Investment Case', 'Fortsetzung'); tz(spalten.map(function (s) { return s[0]; }), true); }
        tz(z.werte || z, false, !!z.fett);
      });
      if (o.hinweis) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130); doc.text(o.hinweis, L, y + 1); y += 5; }
      y += 4;
    }

    /* Kurve: Vermoegensaufbau. Bewusst ohne Farbflaechen — zwei Linien,
       Gold fuer den Wert, Tinte fuer die Restschuld, Raster in Grau. */
    function kurve(reihen, jahre, o) {
      o = o || {};
      var hoehe = o.hoehe || 52, bx = L + 20, bw = CW - 20, by = y, bh = hoehe;
      var alle = reihen.reduce(function (a, r) { return a.concat(r.werte); }, []).filter(function (n) { return isFinite(n); });
      if (!alle.length || jahre.length < 2) return;
      var max = Math.max.apply(null, alle), min = Math.min(0, Math.min.apply(null, alle));
      var sp = max - min || 1;
      function px(i) { return bx + (bw * i) / (jahre.length - 1); }
      function py(v) { return by + bh - ((v - min) / sp) * bh; }
      /* Raster und Achsenbeschriftung */
      doc.setDrawColor(236, 232, 223); doc.setLineWidth(0.15);
      for (var t = 0; t <= 4; t++) {
        var wert = min + (sp * t) / 4, yy = py(wert);
        doc.line(bx, yy, bx + bw, yy);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(140);
        doc.text(zahl(Math.round(wert / 1000)) + 'k', bx - 2, yy + 1.6, { align: 'right' });
      }
      reihen.forEach(function (r) {
        var f = r.gold ? GD : (r.grau ? [150, 145, 135] : [40, 40, 40]);
        doc.setDrawColor(f[0], f[1], f[2]); doc.setLineWidth(r.gold ? 0.7 : 0.5);
        for (var i = 1; i < r.werte.length; i++) {
          if (!isFinite(r.werte[i - 1]) || !isFinite(r.werte[i])) continue;
          doc.line(px(i - 1), py(r.werte[i - 1]), px(i), py(r.werte[i]));
        }
      });
      doc.setLineWidth(0.2);
      /* Jahreszahlen: nie durch Intl (CLAUDE.md) */
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(140);
      jahre.forEach(function (j, i) {
        if (jahre.length > 12 && i % 2) return;
        doc.text(String(j), px(i), by + bh + 4, { align: 'center' });
      });
      y = by + bh + 8;
      /* Legende */
      var lx = bx;
      reihen.forEach(function (r) {
        var f = r.gold ? GD : (r.grau ? [150, 145, 135] : [40, 40, 40]);
        doc.setDrawColor(f[0], f[1], f[2]); doc.setLineWidth(r.gold ? 0.7 : 0.5);
        doc.line(lx, y - 1.2, lx + 6, y - 1.2); doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(90);
        doc.text(r.name, lx + 8, y);
        lx += 8 + doc.getTextWidth(r.name) + 10;
      });
      y += 8;
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
    /* Score aus dem Rechenkern — nicht aus der Oberflaeche gelesen. */
    var SC = null;
    try { if (window.DealScore && typeof window.DealScore.computeFromKpis === 'function') SC = window.DealScore.computeFromKpis(K); } catch (e) {}
    raster([
      ['Bruttomietrendite', pct(K.bmy, 2), 'auf Kaufpreis'],
      ['Nettomietrendite', pct(K.nmy, 2), 'auf Gesamtinvest.'],
      ['Kaufpreisfaktor', zahl(K.fak, 1), 'fach'],
      ['Cashflow vor Steuern', eur(K.cf_m), 'je Monat'],
      ['DSCR', zahl(K.dscr, 2), ''],
      ['LTV', pct(K.ltv, 1), S.ltv_basis_label ? 'auf ' + S.ltv_basis_label : ''],
      ['EK-Rendite', pct(K.ekr, 2), 'p. a., vor Steuern'],
      ['Interner Zinsfuß (IRR)', da(K.irr) === null ? 'nicht bestimmbar' : pct(K.irr, 2), ''],
      ['Kaltmiete', rows[0] ? eur(rows[0].nkm_y) : '—', 'im ersten Jahr'],
      ['Equity Multiple', da(K.em) === null ? '—' : zahl(K.em, 1) + 'x', 'über die Haltedauer'],
      ['Wertpuffer / Equity', eur(K.wp_kpi), 'heute'],
      ['Deal Score', (SC && SC.score) ? zahl(SC.score, 0) + ' / 100' : '—', (SC && SC.label) ? SC.label : '']
    ]);

    /* ── Ertragsrechnung ─────────────────────────────────────── */
    doc.addPage();
    kopf('Ertrag und Cashflow', (adr || 'Objekt') + ' · laufendes Jahr');

    abschnitt('Von der Warmmiete zum Cashflow');
    zeile('Warmmiete / Jahr (Kaltmiete und Umlagen)', eur(K.wm_j));
    zeile('abzüglich umlagefähiger Bewirtschaftung', da(K.bwk_ul) === null ? '—' : '- ' + eur(K.bwk_ul), { einzug: true });
    zeile('Kaltmiete / Jahr (netto, inkl. Zuschläge)', eur(K.nkm_j), { fett: true });
    zeile('abzüglich nicht umlagefähiger Bewirtschaftung', da(K.bwk_cf) === null ? '—' : '- ' + eur(K.bwk_cf), { einzug: true });
    zeile('Betriebsergebnis (NOI)', da(K.nkm_j) === null ? '—' : eur(K.nkm_j - (K.bwk_cf || 0)), { fett: true });
    zeile('abzüglich Zinsen', da(K.zins_j) === null ? '—' : '- ' + eur(K.zins_j), { einzug: true });
    if (da(K.bspar_j) && K.bspar_j > 0) zeile('abzüglich Bausparrate', '- ' + eur(K.bspar_j), { einzug: true });
    zeile('abzüglich Tilgung', da(K.tilg_j) === null ? '—' : '- ' + eur(K.tilg_j), { einzug: true });
    zeile('Cashflow vor Steuern / Jahr', eur(K.cf_op), { summe: true });
    zeile('Steuern (Belastung -, Erstattung +)', da(K.steuer) === null ? '—' : (K.steuer < 0 ? '+ ' : '- ') + eur(Math.abs(K.steuer)), { einzug: true });
    zeile('Cashflow nach Steuern / Jahr', eur(K.cf_ns), { summe: true });
    zeile('Cashflow nach Steuern / Monat', da(K.cf_ns) === null ? '—' : eur(K.cf_ns / 12, 2), { fett: true });
    y += 2;

    abschnitt('Bewirtschaftung');
    zeile('Hausgeld umlagefähig / Jahr', eur(num('hg_ul')));
    zeile('Grundsteuer / Jahr', eur(num('grundsteuer')));
    if (num('ul_sonst')) zeile('Sonstiges umlagefähig', eur(num('ul_sonst')));
    zeile('Summe umlagefähig (durchlaufend)', eur(K.bwk_ul), { fett: true });
    zeile('Hausgeld nicht umlagefähig / Jahr', eur(num('hg_nul')));
    if (num('weg_r')) zeile('WEG-Rücklage / Jahr (nachrichtlich)', eur(num('weg_r')), { klein: true });
    if (num('eigen_r')) zeile('Eigene Instandhaltungsrücklage', eur(num('eigen_r')));
    if (num('mietausfall')) zeile('Kalkulatorischer Mietausfall', eur(num('mietausfall')));
    zeile('Summe nicht umlagefähig (im Cashflow)', eur(K.bwk_cf), { summe: true });
    y += 2;

    abschnitt('Steuerliche Wirkung');
    zeile('Abschreibung (AfA) / Jahr', eur(K.afa));
    zeile('Zu versteuerndes Ergebnis', eur(K.zve_immo));
    zeile('Persönlicher Grenzsteuersatz', num('grenz') !== null ? pct(num('grenz'), 2) : '—');

    /* ── Drei Phasen ─────────────────────────────────────────── */
    var bindj = num('d1_bindj');
    var hatPhasen = da(K.cf_ns_ezb) !== null || da(K.cf_ns_an) !== null;
    if (hatPhasen) {
      doc.addPage();
      kopf('Drei Phasen', 'Heute · Ende der Zinsbindung' + (bindj ? ' (nach ' + zahl(bindj) + ' Jahren)' : '') + ' · Anschlussfinanzierung');

      abschnitt('Cashflow je Phase');
      function ph(label, a, b, c) { return { werte: [label, a, b, c] }; }
      tabelle(
        [['', 46], ['Heute', 26], ['Ende Zinsbindung', 30], ['Anschluss', 26]],
        [
          ph('Warmmiete / Jahr', eur(K.wm_j), eur(K.wm_ezb), eur(K.wm_an)),
          ph('Bewirtschaftung (nicht umlagef.)', eur(K.bwk_cf), eur(K.bwk_cf_ezb), eur(K.bwk_cf_an)),
          ph('Zinsen', eur(K.zins_j), eur(K.zins_ezb), eur(K.zins_an)),
          ph('Tilgung', eur(K.tilg_j), eur(K.tilg_ezb), eur(K.tilg_an)),
          ph('Steuern', eur(K.steuer), eur(K.ster_ezb), eur(K.ster_an)),
          { werte: ['Cashflow vor Steuern', eur(K.cf_op), eur(K.cf_op_ezb), eur(K.cf_op_an)], fett: true },
          { werte: ['Cashflow nach Steuern', eur(K.cf_ns), eur(K.cf_ns_ezb), eur(K.cf_ns_an)], fett: true },
          { werte: ['Cashflow nach Steuern / Monat', eur((K.cf_ns || 0) / 12, 2), eur((K.cf_ns_ezb || 0) / 12, 2), eur((K.cf_ns_an || 0) / 12, 2)], fett: true }
        ],
        { titel: 'Drei Phasen', hinweis: 'Ende Zinsbindung: mit fortgeschriebener Miete und dem dann erreichten Tilgungsstand. Anschluss: mit dem angenommenen Anschlusszins.' });

      abschnitt('Zinsänderungsrisiko');
      zeile('Zinsbindung', bindj !== null ? zahl(bindj) + ' Jahre' : '—');
      zeile('Restschuld am Ende der Zinsbindung', eur(S.rs));
      zeile('Angenommener Anschlusszins / Tilgung', [pct(num('anschl_z'), 2), pct(num('anschl_t'), 2)].join('  ·  '));
      zeile('Rate nach Anschluss / Monat', eur(K.rate_an_m, 2));
      zeile('Mehrbelastung gegenüber heute / Monat', eur(K.zaer_m, 2), { summe: true });
      if (da(K.zaer_pct) !== null) zeile('Das entspricht einer Veränderung von', pct(K.zaer_pct, 1), { klein: true });
    }

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

    /* ── Vermögensaufbau ─────────────────────────────────────── */
    if (rows.length > 2) {
      if (y > H - 110) { doc.addPage(); kopf('Vermögensaufbau', (adr || 'Objekt') + ' · Wert, Restschuld und Eigenkapital'); }
      else { abschnitt('Vermögensaufbau'); }
      var jahre = rows.map(function (r) { return r.cal || r.y; });
      kurve([
        { name: 'Objektwert (angenommen)', werte: rows.map(function (r) { return Number(r.wert_y); }), gold: true },
        { name: 'Restschuld', werte: rows.map(function (r) { return Number(r.rs); }) },
        { name: 'Eigenkapital im Objekt', werte: rows.map(function (r) { return Number(r.eq_y); }), grau: true }
      ], jahre, { hoehe: 52 });
      var l = rows[rows.length - 1];
      zeile('Eigenkapital heute', eur(rows[0] ? rows[0].eq_y : null));
      zeile('Eigenkapital nach ' + jahre.length + ' Jahren', eur(l ? l.eq_y : null), { summe: true });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Der Objektwert ist eine Annahme aus der hinterlegten Wertsteigerung, keine Bewertung nach § 194 BauGB.', L, y - 1);
      y += 6;
    }

    /* ── v1458 · Mieterliste und Ist/Soll (nur wenn Einheiten erfasst sind) ──
       Backlog v22 Punkt 6: die Bank will die Einheiten sehen, nicht nur die
       Summe. Gerechnet wird NICHT hier — die Zahlen kommen aus
       DpMfhEinheiten.berichtDaten() (Anlage-2-Punkte und RND aus dem
       RND-Kern) und aus State.kpis. */
    var MFH = (window.DpMfhEinheiten && typeof window.DpMfhEinheiten.berichtDaten === 'function')
      ? window.DpMfhEinheiten.berichtDaten() : null;
    if (MFH && MFH.zeilen.length) {
      doc.addPage();
      kopf('Einheiten und Zustand', (adr || 'Objekt') + ' · ' + MFH.zeilen.length + ' Einheiten');
      var spM = [['Nr.', 14], ['Lage', 30], ['m²', 16], ['Ist €/M', 20], ['Soll €/M', 20], ['Status', 20], ['Anlage 2', 20], ['RND', 16]];
      var fakM = CW / spM.reduce(function (a, s) { return a + s[1]; }, 0);
      function mZeile(werte, kopfzeile) {
        var x = L;
        doc.setFont('helvetica', kopfzeile ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.4 : 8.4);
        doc.setTextColor(kopfzeile ? 110 : 40);
        werte.forEach(function (w, i) {
          var bw = spM[i][1] * fakM;
          if (i <= 1 || i === 5) doc.text(String(w), x, y); else doc.text(String(w), x + bw - 1, y, { align: 'right' });
          x += bw;
        });
        doc.setDrawColor(kopfzeile ? G[0] : 236, kopfzeile ? G[1] : 232, kopfzeile ? G[2] : 223);
        doc.setLineWidth(kopfzeile ? 0.5 : 0.15); doc.line(L, y + 2.2, W - R, y + 2.2); doc.setLineWidth(0.2);
        y += kopfzeile ? 7 : 6.2;
      }
      mZeile(spM.map(function (s) { return s[0]; }), true);
      MFH.zeilen.forEach(function (z) {
        if (y > H - 30) { doc.addPage(); kopf('Einheiten und Zustand', 'Fortsetzung'); mZeile(spM.map(function (s) { return s[0]; }), true); }
        mZeile([z.e.nr || '', (z.e.lage || '').slice(0, 18), z.fl ? zahl(z.fl, 0) : '—',
          z.e.ist ? zahl(Number(String(z.e.ist).replace(',', '.')), 0) : '—',
          z.e.soll ? zahl(Number(String(z.e.soll).replace(',', '.')), 0) : '—',
          z.e.status === 'leer' ? 'leer' : 'vermietet',
          z.punkte + ' P.' + (z.geerbt === 4 ? '*' : ''), z.rnd != null ? Math.round(z.rnd) + ' J.' : '—']);
      });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Anlage 2 ImmoWertV: Modernisierungspunkte je Einheit; * = Zustand vollständig vom Gebäude übernommen. '
        + 'RND = Restnutzungsdauer (indikativ, kein Gutachten).', L, y + 1);
      y += 10;

      abschnitt('Ist gegen Soll');
      var istJ = (K.nkm_j || 0), sollJ = MFH.s.soll * 12;
      zeile('Kaltmiete p. a. — Ist', eur(istJ));
      zeile('Kaltmiete p. a. — Soll (nach Maßnahmen)', eur(sollJ));
      zeile('Bruttomietrendite Ist (auf Kaufpreis)', pct(K.bmy, 2));
      zeile('Bruttomietrendite Soll (auf Gesamtinvestition)', da(K.gi) && K.gi > 0 ? pct(sollJ / K.gi * 100, 2) : '—');
      zeile('Rechtliche Einheit', MFH.aufgeteilt ? 'in Wohnungseigentum aufgeteilt (WEG)' : 'ungeteiltes Gebäude');
      if (MFH.s.leer) zeile('Leerstand', MFH.s.leer + ' Einheiten / ' + zahl(MFH.s.leerFl, 0) + ' m²');
      if (MFH.s.kosten) zeile('Geplante Maßnahmen', eur(MFH.s.kosten));
      zeile('Modernisierungsgrad (flächengewichtet)', zahl(MFH.punkteGew, 1) + ' von 20 Punkten');
      if (MFH.rndGew > 0) zeile('Restnutzungsdauer (flächengewichtet)', Math.round(MFH.rndGew) + ' Jahre', { summe: true });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(130);
      var hin = MFH.sollAbJahr
        ? 'Die Cashflow-Rechnung setzt die Soll-Miete ab Jahr ' + MFH.sollAbJahr + ' an; davor und danach gilt die hinterlegte Mietentwicklung.'
        : 'Die Cashflow-Rechnung rechnet durchgehend mit der Ist-Miete — die Soll-Miete ist hier nur nachrichtlich.';
      doc.splitTextToSize(hin, CW).forEach(function (t) { doc.text(t, L, y); y += 4.2; });
      y += 6;
    }

    if (y > H - 80) { doc.addPage(); kopf('Annahmen und Hinweise', (adr || 'Objekt')); }
    abschnitt('Annahmen');
    zeile('Mietsteigerung p. a.', num('mietstg') !== null ? pct(num('mietstg'), 1) : '—');
    zeile('Kostensteigerung p. a.', num('kostenstg') !== null ? pct(num('kostenstg'), 1) : '—');
    zeile('Wertsteigerung p. a.', num('wertstg') !== null ? pct(num('wertstg'), 1) : '—');
    zeile('Betrachtungszeitraum', S.btj ? zahl(S.btj) + ' Jahre' : '—');
    zeile('Anschlusszins / Anschlusstilgung (Annahme)', [pct(num('anschl_z'), 2), pct(num('anschl_t'), 2)].join('  ·  '));
    zeile('Persönlicher Grenzsteuersatz', num('grenz') !== null ? pct(num('grenz'), 2) : '—');
    if (K.d1IsAussetzung) zeile('Darlehenstyp', 'Tilgungsaussetzung mit Bausparvertrag');
    if (num('bspar_rate')) zeile('Bausparrate / Monat', eur(num('bspar_rate')));
    y += 2;

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
