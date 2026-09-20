/* ════════════════════════════════════════════════════════════════════
   v1436 · INVESTMENT CASE - BANKFASSUNG (hell)
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
   Fehlt ein Wert, steht ein Strich - nie eine Null, die wie eine Messung
   aussieht (CLAUDE.md: Number(null) ist 0 und besteht isFinite).

   Das alte Investment-PDF (pdf.js, exportPDF) bleibt unverändert. Diese
   Fassung läuft daneben: window.exportPDFBank().

   v1460 (Marcel 20.09.2026: „die anderen Sachen aus dem jetzigen PDF müssen
   auch drauf, nur in diesem Design"): die Bankfassung trägt jetzt ALLE
   Blöcke des alten Investment-PDFs -
     Deal Score · Ertragsrechnung (Warmmiete bis Cashflow nach Steuern) ·
     Bewirtschaftung umlagefähig / nicht umlagefähig · drei Phasen (Heute,
     Ende Zinsbindung, Anschluss) · Zinsänderungsrisiko · Cashflow-Jahre ·
     Vermögensaufbau als Kurve (Wert, Restschuld, Eigenkapital) ·
     Einheiten beim Mehrfamilienhaus · Annahmen und Hinweise.
   v1461: die Abschnitte FLIESSEN - eine neue Seite entsteht nur, wenn der
   Block nicht mehr passt (vorher begann jeder Block auf einer neuen Seite,
   die Seiten endeten nach der Haelfte). Dazu Objektfotos (Titelbild und
   Galerie) und ein Kurzfazit aus dem Score.

   v1463 (MARKER_V1463): Abgleich Zeile fuer Zeile gegen js/pdf.js -
   54 Positionen des alten Investment-PDFs fehlten hier. Ergaenzt:
     · Erwerbsnebenkosten EINZELN (Makler, Notar, Grundbuch, GrESt, Beratung)
     · Darlehen im Detail, Mischzins, Gesamtrate, Zinsbindung, Restschuld
     · Bausparvertrag komplett (State.bsvSummary: Guthaben bei EZB, Deckung)
     · Kennzahlen je Phase (Zinssatz, Rate, CF/Monat, DSCR, Differenz)
     · Exit und Vermoegenszuwachs
     · die vier Bank-Diagramme (SVG aus dem Cockpit)
     · KI-Investment-Analyse, wenn eine vorliegt
   Gelesen wird auch hier nur: State, State.kpis, die Felder und die
   fertigen Zellen aus dem Zinsaenderungs-Block.

   v1464 (MARKER_V1464): der Rest aus dem alten PDF - Stress-Matrix (5x5
   DSCR-Szenarien), Vermoegenszuwachs als Jahrestabelle, Bewirtschaftungs-
   kosten gesamt und in Prozent der Kaltmiete, Leerstand in den Annahmen,
   effektive Restschuld am Bindungsende, Kaufpreis-Offerte der KI.
   Die Matrix wird NICHT nachgerechnet: BankCharts.renderStressMatrix()
   zeichnet sie unsichtbar als HTML, hier werden die Zellen ausgelesen.

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
    v = da(v); if (v === null) return '-';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(v) + ' €';
  }
  function pct(v, dec) {
    v = da(v); if (v === null) return '-';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec }).format(v) + ' %';
  }
  function zahl(v, dec) {
    v = da(v); if (v === null) return '-';
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(v);
  }
  function gold() {
    try { if (typeof window._pdfGold === 'function') return window._pdfGold(); } catch (e) {}
    return [201, 168, 76];
  }
  /* v1463e · Text aus der Oberflaeche kann Zeichen tragen, die WinAnsi nicht
     kennt (gemessen: das Haekchen U+2713 im Zuteilungsstatus). jsPDF schaltet
     dann still auf Doppelbyte um, und im Dokument steht Kauderwelsch. */
  function sauber(t) {
    return String(t == null ? '' : t)
      .replace(/[\u2713\u2714]/g, '+')
      .replace(/[\u2717\u2718\u26A0\uFE0F]/g, '!')
      .replace(/[\u2212\u2011\u2012]/g, '-')
      .replace(/[^\x00-\xFF]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function heute() {
    var t = new Date();
    return ('0' + t.getDate()).slice(-2) + '.' + ('0' + (t.getMonth() + 1)).slice(-2) + '.' + t.getFullYear();
  }

  /* MARKER_V1466 · Absender und Ansprechpartner kommen aus den Einstellungen.
     Die Plan-Sperre steckt BEREITS in DealPilotConfig.branding.get(): unter
     Pro liefert sie die Vorgabewerte, ab Pro die eigenen Daten (config.js,
     V192). Die Bankfassung hatte darueber eine ZWEITE Sperre gelegt
     (custom_logo UND Firma ungleich "Junker Immobilien") - dadurch stand auf
     jedem Dokument "DealPilot", auch fuer den eingeloggten Pro-Nutzer.
     Gemessen am 20.09.2026 an den drei abgelegten PDFs. */
  function marke() {
    try {
      if (window.DealPilotConfig && DealPilotConfig.branding && typeof DealPilotConfig.branding.get === 'function') {
        return DealPilotConfig.branding.get() || {};
      }
    } catch (e) {}
    return {};
  }
  function absender() {
    var b = marke();
    var firma = String(b.company || '').trim() || 'DealPilot';
    var z = [firma];
    var person = String(b.name || '').trim();
    if (person && person !== firma) z.push(person + (b.role ? ' · ' + b.role : ''));
    var l2 = [String(b.address || '').trim(), ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(' · ');
    if (l2) z.push(l2);
    var kontakt = [b.phone ? 'Tel ' + b.phone : '', b.email || ''].filter(Boolean).join(' · ');
    if (kontakt) z.push(kontakt); else if (b.website) z.push(String(b.website).replace(/^https?:\/\//, ''));
    return { firma: firma, zeilen: z.slice(0, 4), b: b };
  }

  var OBJART = { ETW: 'Eigentumswohnung', EFH: 'Einfamilienhaus', ZFH: 'Zweifamilienhaus', MFH: 'Mehrfamilienhaus',
    DHH: 'Doppelhaushälfte', RH: 'Reihenhaus', BUERO: 'Bürogebäude', GESCH: 'Geschäftshaus', HOTEL: 'Hotel',
    GEW: 'Gewerbe', GAR: 'Garage / Stellplatz' };

  /* Objektfotos: Groesse muss bekannt sein, sonst verzerrt addImage.
     Deshalb laedt diese Funktion sie vorher - der Export ist async. */
  /* MARKER_V1462 · Zuschnitt mittig auf ein Zielverhaeltnis. jsPDF kann
     nicht beschneiden - deshalb vorher auf einer Leinwand schneiden. */
  function zuschneiden(b, verhaeltnis, breitePx) {
    try {
      var zw = breitePx || 1400, zh = Math.round(zw / verhaeltnis);
      var c = document.createElement('canvas'); c.width = zw; c.height = zh;
      var ctx = c.getContext('2d');
      var s = Math.max(zw / b.w, zh / b.h), iw = b.w * s, ih = b.h * s;
      /* Das BEREITS geladene Element nehmen - ein frisch erzeugtes Image
         ist beim Zeichnen womoeglich noch nicht dekodiert und bliebe leer. */
      var i = b.el; if (!i || !i.naturalWidth) return b;
      ctx.drawImage(i, (zw - iw) / 2, (zh - ih) / 2, iw, ih);
      return { src: c.toDataURL('image/jpeg', 0.82), w: zw, h: zh };
    } catch (e) { return b; }
  }
  function bilderLaden(max) {
    var quelle = (window.imgs && window.imgs.length) ? window.imgs : [];
    var liste = quelle.slice(0, max).map(function (o) { return (o && o.src) ? o.src : o; }).filter(Boolean);
    return Promise.all(liste.map(function (src) {
      return new Promise(function (fertig) {
        try {
          var i = new Image();
          i.onload = function () { fertig({ src: src, w: i.naturalWidth || 4, h: i.naturalHeight || 3, el: i }); };
          i.onerror = function () { fertig(null); };
          i.src = src;
          if (i.complete && i.naturalWidth) fertig({ src: src, w: i.naturalWidth, h: i.naturalHeight, el: i });
        } catch (e) { fertig(null); }
      });
    })).then(function (a) { return a.filter(Boolean); });
  }

  /* Die vier Bank-Diagramme stehen als SVG im Cockpit. jsPDF kann kein SVG -
     also serialisieren, auf eine Leinwand zeichnen, als Bild einsetzen. */
  /* MARKER_V1463C · gemessen: solange die Bankansicht nie offen war, sind die
     Diagramm-Flaechen 0 px breit und bleiben leer - buildCharts() zeichnet
     dann nichts. Deshalb wird hier bei Bedarf in eine EIGENE Flaeche
     gezeichnet (BankCharts.renderX(host, State), 640x340). Der Wasserfall
     braucht eine Variable aus der Bankansicht und faellt dann aus. */
  var BC_FN = { 'bc-equity': 'renderEquityBuild', 'bc-cockpit': 'renderBankCockpit',
    'bc-waterfall': 'renderWaterfall', 'bc-stress': 'renderStressMatrix' };
  /* v1463f · gemessen: querySelector('svg') greift das ERSTE SVG - und das
     ist in zwei der vier Diagramme ein Symbol in der Ueberschrift. Im PDF
     stand dann ein Pfeil bzw. ein Haken statt der Zeichnung. Genommen wird
     jetzt das GROESSTE SVG im Behaelter. */
  function groesstesSvg(wurzel) {
    if (!wurzel) return null;
    var alle = wurzel.querySelectorAll('svg'), best = null, bestF = 0;
    for (var i = 0; i < alle.length; i++) {
      var s = alle[i], r = s.getBoundingClientRect(), f = r.width * r.height;
      if (!f) { var vb = (s.getAttribute('viewBox') || '').split(/[ ,]+/); f = (+vb[2] || 0) * (+vb[3] || 0); }
      if (f > bestF) { bestF = f; best = s; }
    }
    return bestF > 2000 ? best : null;
  }
  function svgQuelle(id) {
    var host = document.getElementById(id), svg = groesstesSvg(host);
    if (svg && (svg.getBoundingClientRect().width > 120)) return { svg: svg, breite: Math.round(host.getBoundingClientRect().width) || 640, hoehe: Math.round(host.getBoundingClientRect().height) || 340 };
    var fn = BC_FN[id];
    if (!fn || !window.BankCharts || typeof window.BankCharts[fn] !== 'function') return null;
    var tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:640px;height:340px;background:#FFFFFF';
    document.body.appendChild(tmp);
    try { window.BankCharts[fn](tmp, window.State); } catch (e) { tmp.remove(); return null; }
    var s2 = groesstesSvg(tmp);
    if (!s2) { tmp.remove(); return null; }
    return { svg: s2, breite: 640, hoehe: 340, aufraeumen: tmp };
  }
  function svgBild(id) {
    return new Promise(function (fertig) {
      try {
        var q = svgQuelle(id);
        if (!q) return fertig(null);
        var svg = q.svg, weg = q.aufraeumen;
        var k = svg.cloneNode(true);
        if (weg) weg.remove();
        var br = Math.max(320, q.breite), ho = Math.max(200, q.hoehe);
        k.setAttribute('width', br); k.setAttribute('height', ho);
        if (!k.getAttribute('viewBox')) k.setAttribute('viewBox', '0 0 ' + br + ' ' + ho);
        k.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        var txt = new XMLSerializer().serializeToString(k);
        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt);
        var i = new Image();
        i.onload = function () {
          try {
            /* v1463d: PNG blies das Dokument auf 13,7 MB. JPEG mit weissem
               Grund bringt dieselbe Zeichnung bei rund einem Fuenfzigstel. */
            var c = document.createElement('canvas'); c.width = Math.round(br * 1.6); c.height = Math.round(ho * 1.6);
            var ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(i, 0, 0, c.width, c.height);
            fertig({ src: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height, id: id });
          } catch (e) { fertig(null); }
        };
        i.onerror = function () { fertig(null); };
        i.src = url;
      } catch (e) { fertig(null); }
    });
  }

  window.exportPDFBank = async function () {
    if (typeof window.jspdf === 'undefined') { alert('PDF-Bibliothek noch nicht geladen - bitte kurz warten und erneut versuchen.'); return; }
    try { if (typeof window.calcNow === 'function') window.calcNow(); } catch (e) {}
    var S = window.State || {}, K = S.kpis || {}, rows = S.cfRows || [];

    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, L = 18, R = 18, CW = W - L - R, y = 22;
    var G = gold(), GD = [Math.round(G[0] * 0.82), Math.round(G[1] * 0.82), Math.round(G[2] * 0.82)];
    var ab = absender();

    /* ── Bausteine ───────────────────────────────────────────── */
    function kopf(titel, unter) {
      y = 22;
      /* Eigenes Logo, wenn der Plan es hergibt - sonst der Firmenname. */
      var logoOk = false;
      if (ab.b && ab.b.logo_b64) {
        try {
          var lw = 34, lh = 10;
          doc.addImage(String(ab.b.logo_b64), L, y - 6.5, lw, lh, undefined, 'FAST');
          logoOk = true;
        } catch (e) { logoOk = false; }
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(26, 26, 26);
      if (!logoOk) doc.text(ab.firma, L, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(120);
      doc.text('I M M O B I L I E N - I N V E S T I T I O N S A N A L Y S E', L, y + 4.6);
      doc.setFontSize(8); doc.setTextColor(110);
      /* MARKER_V1467 · gemessen: mit vier Absenderzeilen lag die letzte auf der
         Goldlinie (Linie bei y+8.5). Der Block wird jetzt so gesetzt, dass die
         letzte Zeile 2 mm darueber endet. */
      var zl = ab.zeilen.slice(0, 4), schritt = 3.6;
      var by = (y + 6.5) - (zl.length - 1) * schritt;
      zl.forEach(function (t) { doc.text(t, W - R, by, { align: 'right' }); by += schritt; });
      y += 8.5;
      doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.8); doc.line(L, y, W - R, y); doc.setLineWidth(0.2);
      y += 10;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 26, 26); doc.text(titel, L, y); y += 5.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110); doc.text(unter, L, y);
      y += 10;
    }
    function abschnitt(t) {
      if (y > H - 34) { doc.addPage(); kopf(_titel, _unter); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(GD[0], GD[1], GD[2]);
      doc.text(t.toUpperCase(), L, y);
      doc.setDrawColor(226, 221, 210); doc.line(L, y + 1.8, W - R, y + 1.8);
      y += 7.5;
    }
    function einleitung(t) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.splitTextToSize(t, CW).forEach(function (z) { doc.text(z, L, y); y += 4.2; });
      y += 2.5;
    }
    function zeile(label, wert, o) {
      o = o || {};
      /* v1461b: Umbruch in der Zeile selbst. Vorher sprang ein ganzer Block
         auf die naechste Seite, sobald er nicht mehr komplett passte -
         die Seiten endeten dadurch nach der Haelfte. */
      if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
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
    function raster(items, o) {
      o = o || {};
      var sp = 3, bw = (CW - 2 * sp) / 3, bh = 17;
      /* v1462: gemessen - zwoelf Kacheln liefen am Objekt mit Foto in die
         Fusszeile. Das Raster bricht jetzt selbst um. */
      /* v1462c: Das Raster bleibt ZUSAMMEN. Passt es nicht mehr, beginnt es
         geschlossen auf der naechsten Seite - ein zerrissener Kennzahlenblock
         liest sich schlechter als eine halbe Seite Luft davor. */
      /* v1462d: die Ueberschrift gehoert ZUM Raster - sonst blieb sie als
         Waise auf der Seite davor stehen. */
      var reihen = Math.ceil(items.length / 3), bedarf = reihen * (bh + sp) + 4 + (o.titel ? 7.5 : 0);
      if (y + bedarf > H - 24) {
        if (bedarf < H - 60) { doc.addPage(); kopf(_titel, _unter); }
        else {
          var proSeite = Math.max(1, Math.floor((H - 24 - y) / (bh + sp)));
          raster(items.slice(0, proSeite * 3), o);
          doc.addPage(); kopf(_titel, _unter);
          raster(items.slice(proSeite * 3));
          return;
        }
      }
      if (o.titel) abschnitt(o.titel);
      items.forEach(function (it, i) {
        var c = i % 3, r = Math.floor(i / 3), x = L + c * (bw + sp), yy = y + r * (bh + sp);
        doc.setDrawColor(226, 221, 210); doc.setLineWidth(0.25); doc.rect(x, yy, bw, bh);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(120); doc.text(it[0], x + 3.5, yy + 5.5);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(26, 26, 26); doc.text(it[1], x + 3.5, yy + 12.6);
        if (it[2]) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(140); doc.text(it[2], x + bw - 3, yy + 12.6, { align: 'right' }); }
      });
      y += Math.ceil(items.length / 3) * (bh + sp) + 4;
    }
    /* Neue Seite NUR, wenn der naechste Block nicht mehr passt.
       Ohne das beginnt jeder Block auf einer halbleeren Seite. */
    var _titel = 'Investment Case', _unter = '';
    function platz(bedarf, titel, unter) {
      if (titel) { _titel = titel; _unter = unter || ''; }
      if (y + bedarf > H - 24) { doc.addPage(); kopf(_titel, _unter); return true; }
      return false;
    }
    /* Bild proportional in einen Rahmen setzen (nie verzerren). */
    function bild(b, x, yy, bw, bh, schneiden) {
      if (!b) return;
      var q = schneiden ? zuschneiden(b, bw / bh, Math.round(bw * 12)) : b;
      var s = Math.min(bw / q.w, bh / q.h), iw = q.w * s, ih = q.h * s;
      try { doc.addImage(q.src, x + (bw - iw) / 2, yy + (bh - ih) / 2, iw, ih); } catch (e) { return; }
      doc.setDrawColor(226, 221, 210); doc.setLineWidth(0.25);
      doc.rect(x + (bw - iw) / 2, yy + (bh - ih) / 2, iw, ih); doc.setLineWidth(0.2);
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

    /* Kurve: Vermoegensaufbau. Bewusst ohne Farbflaechen - zwei Linien,
       Gold fuer den Wert, Tinte fuer die Restschuld, Raster in Grau. */
    function kurve(reihen, jahre, o) {
      o = o || {};
      var hoehe = o.hoehe || 52, bx = L + 20, bw = CW - 32, by = y, bh = hoehe;
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
        /* gestrichelt fuer die dritte Linie - sonst liegen zwei Linien
           deckungsgleich, sobald kein Darlehen im Spiel ist. */
        try { if (r.grau) doc.setLineDashPattern([1.2, 1.2], 0); } catch (e) {}
        for (var i = 1; i < r.werte.length; i++) {
          if (!isFinite(r.werte[i - 1]) || !isFinite(r.werte[i])) continue;
          doc.line(px(i - 1), py(r.werte[i - 1]), px(i), py(r.werte[i]));
        }
        try { doc.setLineDashPattern([], 0); } catch (e) {}
        var letzte = r.werte[r.werte.length - 1];
        if (isFinite(letzte)) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(f[0], f[1], f[2]);
          doc.text(zahl(Math.round(letzte / 1000)) + 'k', bx + bw + 1.5, py(letzte) + 1.6);
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
    var fotos = await bilderLaden(5);
    var d2an = el('d2_enable') && el('d2_enable').checked, d2 = d2an ? num('d2') : null;

    /* ── Seite 1 ─────────────────────────────────────────────── */
    kopf('Investment Case', (adr || 'Objekt ohne Anschrift') + ' · Finanzierungsunterlage · Stand ' + heute());

    if (fotos.length) { bild(fotos[0], L, y, CW, CW / 2.5, true); y += CW / 2.5 + 6; }

    abschnitt('Objekt');
    zeile('Anschrift', adr || '-');
    zeile('Objektart', OBJART[txt('objart')] || txt('objart') || '-');
    zeile('Wohnfläche', num('wfl') !== null ? zahl(num('wfl'), 0) + ' m²' : '-');
    zeile('Baujahr', txt('baujahr') || '-');     /* Jahreszahl nie durch Intl (CLAUDE.md) */
    if (txt('kaufdat')) zeile('Kaufdatum', txt('kaufdat'));
    y += 3;

    ansprechpartner();

    abschnitt('Investition');
    zeile('Kaufpreis', eur(kp));
    /* Nebenkosten einzeln wie im alten PDF - eine Summe allein beantwortet
       der Bank die Frage nach der Zusammensetzung nicht. */
    function nkZeile(feld, name) {
      var pz = num(feld);
      if (pz === null || !kp) return 0;
      var betrag = kp * pz / 100;
      if (!betrag) return 0;
      zeile(name + ' (' + pct(pz, 2) + ')', eur(betrag), { einzug: true, klein: true });
      return betrag;
    }
    var summeNk = 0;
    summeNk += nkZeile('makler_p', 'Maklercourtage');
    summeNk += nkZeile('notar_p', 'Notar');
    summeNk += nkZeile('gba_p', 'Grundbuchamt');
    summeNk += nkZeile('gest_p', 'Grunderwerbsteuer');
    summeNk += nkZeile('ji_p', 'Vermittlung / Beratung');
    zeile('Erwerbsnebenkosten' + (kp && nk !== null ? ' (' + pct(nk / kp * 100, 1) + ' vom Kaufpreis)' : ''), eur(nk), { fett: true });
    if (san) zeile('Sanierung / Modernisierung', eur(san));
    if (moebl) zeile('Möblierung / Inventar', eur(moebl));
    zeile('Gesamtinvestition', eur(gi), { summe: true });
    y += 1;

    abschnitt('Finanzierung');
    var aussetzung = (txt('d1_type') === 'tilgungsaussetzung');
    zeile('Eigenkapital' + (gi && ek !== null ? ' (' + pct(ek / gi * 100, 1) + ' der Gesamtinvestition)' : ''), eur(ek));
    zeile('Darlehen I' + (aussetzung ? ' · Tilgungsaussetzung' : ' · Annuitätendarlehen'), eur(d1));
    zeile('Sollzins / Tilgung / Zinsbindung', [pct(num('d1z'), 2), aussetzung ? 'über Bausparvertrag' : pct(num('d1t'), 2), num('d1_bindj') !== null ? zahl(num('d1_bindj')) + ' Jahre' : '-'].join('  ·  '), { einzug: true, klein: true });
    if (da(S.d1_rate_monthly)) zeile('Rate Darlehen I / Monat', eur(S.d1_rate_monthly, 2), { einzug: true, klein: true });
    if (d2an) {
      zeile('Darlehen II', eur(d2));
      zeile('Sollzins / Tilgung', [pct(num('d2z'), 2), pct(num('d2t'), 2)].join('  ·  '), { einzug: true, klein: true });
      var r2 = (d2 || 0) * ((num('d2z') || 0) + (num('d2t') || 0)) / 100 / 12;
      zeile('Rate Darlehen II / Monat', eur(r2, 2), { einzug: true, klein: true });
      var sum = (d1 || 0) + (d2 || 0);
      if (sum > 0) zeile('Mischzins (gewichtet)', pct(((d1 || 0) * (num('d1z') || 0) + (d2 || 0) * (num('d2z') || 0)) / sum, 2), { einzug: true, klein: true });
      zeile('Gesamtrate / Monat', eur((S.d1_rate_monthly || 0) + r2, 2), { einzug: true, klein: true });
    }
    zeile('Finanzierung gesamt', eur((d1 || 0) + (d2 || 0)), { summe: true });
    zeile('Beleihungsauslauf (LTV)', pct(K.ltv, 1) + (S.ltv_basis_label ? '  ·  auf ' + S.ltv_basis_label : ''));
    var bindEl = el('r-bindend');
    if (bindEl && bindEl.textContent.trim() && bindEl.textContent.trim() !== '-') zeile('Zinsbindung bis', bindEl.textContent.trim());
    zeile('Restschuld am Ende der Zinsbindung', eur(S.rs));
    y += 1;

    /* Bausparvertrag - nur beim Tilgungsaussetzungsdarlehen. */
    if (aussetzung) {
      platz(46);
      abschnitt('Bausparvertrag (Tilgungsersatz)');
      if (txt('bspar_inst')) zeile('Bausparkasse', txt('bspar_inst'));
      if (txt('bspar_vertrag')) zeile('Vertragsnummer', txt('bspar_vertrag'));
      zeile('Bausparsumme', eur(num('bspar_sum')));
      zeile('Sparrate / Monat', eur(num('bspar_rate'), 2));
      zeile('Sparrate / Jahr (fließt aus dem Cashflow ab)', eur((num('bspar_rate') || 0) * 12));
      if (num('bspar_zins') !== null) zeile('Guthabenzins', pct(num('bspar_zins'), 2));
      /* Zuteilung, Status und Bauspardarlehen stehen als fertige Zellen in der
         Finanzierung (DIV, kein Eingabefeld) - hier nur uebernommen. */
      function zellText(id) { var e = el(id); var t = e ? sauber(e.textContent) : ''; return (t && t !== '-' && t !== '-') ? t : null; }
      var zut = zellText('bspar_zuteil_detail') || zellText('bspar_zuteil_auto');
      if (zut) zeile('Zuteilung', zut);
      var zStatus = zellText('bspar_zuteil_status');
      if (zStatus) zeile('Zuteilungsstatus', zStatus, { klein: true });
      if (num('bspar_dar_z') !== null) zeile('Bauspardarlehen · Zins', pct(num('bspar_dar_z'), 2));
      if (num('bspar_dar_t') !== null) zeile('Bauspardarlehen · Tilgung', pct(num('bspar_dar_t'), 2));
      var darRate = zellText('bspar_dar_rate');
      if (darRate) zeile('Bauspardarlehen · Rate', darRate);
      if (num('bspar_quote_min') !== null) zeile('Mindest-Sparquote für die Zuteilung', pct(num('bspar_quote_min'), 0));
      var bs = S.bsvSummary;
      if (bs) {
        if (da(bs.eingezahlt) !== null) zeile('Eingezahlt bis Ende der Zinsbindung' + (bs.jahre ? ' (' + zahl(bs.jahre) + ' Jahre)' : ''), eur(bs.eingezahlt));
        if (da(bs.guthaben) !== null) zeile('Guthaben inkl. Zinsen bei Bindungsende', eur(bs.guthaben));
        if (da(bs.restschuld) !== null) zeile('Restschuld Hauptdarlehen dann', eur(bs.restschuld));
        var effZ = rows.filter(function (r) { return da(r.eff_rs) !== null; });
        if (effZ.length && bs.jahre) {
          var tr = rows[Math.min(rows.length - 1, Math.max(0, Math.round(bs.jahre) - 1))];
          if (tr && da(tr.eff_rs) !== null) zeile('Effektive Restschuld am Bindungsende (nach Verrechnung)', eur(tr.eff_rs));
        }
        if (da(bs.restschuld) && bs.restschuld > 0) {
          var deck = Math.min(100, ((bs.guthaben || 0) + (bs.bauspardarlehen || 0)) / bs.restschuld * 100);
          zeile('Deckung durch Bausparguthaben und -darlehen', pct(deck, 1), { summe: true });
        }
      }
      y += 1;
    }

    /* Score aus dem Rechenkern - nicht aus der Oberflaeche gelesen. */
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
      ['Kaltmiete', rows[0] ? eur(rows[0].nkm_y) : '-', 'im ersten Jahr'],
      ['Equity Multiple', da(K.em) === null ? '-' : zahl(K.em, 1) + 'x', 'über die Haltedauer'],
      ['Wertpuffer / Equity', eur(K.wp_kpi), 'heute'],
      ['Deal Score', (SC && SC.score) ? zahl(SC.score, 0) + ' / 100' : '-', (SC && SC.label) ? SC.label : '']
    ], { titel: 'Kennzahlen' });
    if (SC && SC.interpretation) {
      platz(16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(70);
      doc.splitTextToSize('Einordnung: ' + String(SC.interpretation).replace(/\s+/g, ' '), CW).forEach(function (t) { doc.text(t, L, y); y += 4.4; });
      y += 4;
    }

    /* Galerie: die uebrigen Fotos, ruhig im Raster, ohne Balken. */
    if (fotos.length > 1) {
      platz(96, 'Objektfotos', (adr || 'Objekt'));
      abschnitt('Objektfotos');
      var gal = fotos.slice(1, 5), sp2 = 4, bw2 = (CW - sp2) / 2, bh2 = (CW - sp2) / 2 * 0.72;
      gal.forEach(function (f, i) {
        var c = i % 2, r = Math.floor(i / 2);
        bild(f, L + c * (bw2 + sp2), y + r * (bh2 + sp2), bw2, bh2, true);
      });
      y += Math.ceil(gal.length / 2) * (bh2 + sp2) + 4;
    }

    /* Ansprechpartner - dieselben Daten wie im alten PDF (Deckblattfuss).
       v1467: steht jetzt auf Seite 1 unter dem Objekt, nicht erst hinter den
       Kennzahlen - die Bank will wissen, wer das Papier verschickt hat. */
    function ansprechpartner() {
      var b = ab.b || {};
      var hatEtwas = b.company || b.name || b.address || b.email || b.phone || b.website;
      if (!hatEtwas) return;
      platz(34);
      abschnitt('Ansprechpartner');
      if (b.company) zeile('Unternehmen', sauber(b.company));
      if (b.name && b.name !== b.company) zeile(b.role ? sauber(b.role) : 'Ansprechpartner', sauber(b.name));
      var anschrift = [String(b.address || '').trim(), ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(', ');
      if (anschrift) zeile('Anschrift', sauber(anschrift));
      if (b.phone) zeile('Telefon', sauber(b.phone));
      if (b.email) zeile('E-Mail', sauber(b.email));
      if (b.website) zeile('Web', sauber(String(b.website).replace(/^https?:\/\//, '')));
      y += 2;
    }

    /* ── Erwerb ueber eine Gesellschaft ───────────────────────── */
    (function () {
      var halterSel = el('halter');
      var halter = halterSel ? String(halterSel.value || '') : '';
      if (!halter || halter === 'privat') return;
      var M = window.DealPilotMandanten || {};
      var name = halter;
      try { var h = M.get ? M.get(halter) : null; if (h && h.name) name = h.name; } catch (e) {}
      var korp = false;
      try { korp = !!(M.isCorp && M.isCorp(halter)); } catch (e) {}
      var satz = null;
      try { satz = (M.effRate && M.effRate()); } catch (e) {}
      platz(44);
      abschnitt('Erwerb über eine Gesellschaft');
      zeile('Halter des Objekts', sauber(name));
      zeile('Besteuerung', korp ? 'Körperschaft- und Gewerbesteuer (Kapitalgesellschaft)' : 'Einkommensteuer der Gesellschafter (Personengesellschaft)');
      if (satz != null && isFinite(satz)) zeile('Angesetzter effektiver Steuersatz', pct(satz * 100, 2));
      if (korp) zeile('Verluste', 'werden nicht erstattet - sie mindern nur künftige Gewinne', { klein: true });
      if (txt('obj_herkunft') === 'ueberfuehrung' || num('ueberf_preis') !== null) {
        zeile('Überführung aus dem Privatbestand', txt('halter_seit') || 'Stichtag offen');
        if (num('verkehrswert_ueberf') !== null) zeile('Verkehrswert (AfA-Basis der Gesellschaft)', eur(num('verkehrswert_ueberf')));
        if (num('ueberf_preis') !== null) zeile('Überführungspreis (Basis Grunderwerbsteuer)', eur(num('ueberf_preis')));
        if (num('ueberf_restschuld') !== null) zeile('Übernommene Restschuld', eur(num('ueberf_restschuld')));
      }
      if (num('gesellschafterdarlehen') !== null) zeile('Gesellschafterdarlehen', eur(num('gesellschafterdarlehen')));
      y += 2;
    })();

    /* ── Ertragsrechnung ─────────────────────────────────────── */
    platz(46, 'Ertrag und Cashflow', (adr || 'Objekt') + ' · laufendes Jahr');
    abschnitt('Von der Warmmiete zum Cashflow');
    zeile('Warmmiete / Jahr (Kaltmiete und Umlagen)', eur(K.wm_j));
    zeile('abzüglich umlagefähiger Bewirtschaftung', da(K.bwk_ul) === null ? '-' : '- ' + eur(K.bwk_ul), { einzug: true });
    zeile('Kaltmiete / Jahr (netto, inkl. Zuschläge)', eur(K.nkm_j), { fett: true });
    zeile('abzüglich nicht umlagefähiger Bewirtschaftung', da(K.bwk_cf) === null ? '-' : '- ' + eur(K.bwk_cf), { einzug: true });
    zeile('Betriebsergebnis (NOI)', da(K.nkm_j) === null ? '-' : eur(K.nkm_j - (K.bwk_cf || 0)), { fett: true });
    zeile('abzüglich Zinsen', da(K.zins_j) === null ? '-' : '- ' + eur(K.zins_j), { einzug: true });
    if (da(K.bspar_j) && K.bspar_j > 0) zeile('abzüglich Bausparrate', '- ' + eur(K.bspar_j), { einzug: true });
    zeile('abzüglich Tilgung', da(K.tilg_j) === null ? '-' : '- ' + eur(K.tilg_j), { einzug: true });
    zeile('Cashflow vor Steuern / Jahr', eur(K.cf_op), { summe: true });
    zeile('Steuern (Belastung -, Erstattung +)', da(K.steuer) === null ? '-' : (K.steuer < 0 ? '+ ' : '- ') + eur(Math.abs(K.steuer)), { einzug: true });
    zeile('Cashflow nach Steuern / Jahr', eur(K.cf_ns), { summe: true });
    zeile('Cashflow nach Steuern / Monat', da(K.cf_ns) === null ? '-' : eur(K.cf_ns / 12, 2), { fett: true });
    y += 2;

    platz(34);
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
    zeile('Bewirtschaftungskosten gesamt / Jahr', eur(K.bwk));
    zeile('davon Anteil an der Kaltmiete', (da(K.nkm_j) && K.nkm_j > 0) ? pct(K.bwk / K.nkm_j * 100, 1) : '-', { klein: true });
    y += 2;

    platz(30);
    abschnitt('Steuerliche Wirkung');
    zeile('Abschreibung (AfA) / Jahr', eur(K.afa));
    zeile('Zu versteuerndes Ergebnis', eur(K.zve_immo));
    zeile('Persönlicher Grenzsteuersatz', num('grenz') !== null ? pct(num('grenz'), 2) : '-');

    /* ── Drei Phasen ─────────────────────────────────────────── */
    var bindj = num('d1_bindj');
    var hatPhasen = da(K.cf_ns_ezb) !== null || da(K.cf_ns_an) !== null;
    if (hatPhasen) {
      platz(62, 'Drei Phasen', 'Heute · Ende der Zinsbindung' + (bindj ? ' (nach ' + zahl(bindj) + ' Jahren)' : '') + ' · Anschlussfinanzierung');
      abschnitt('Cashflow je Phase');
      einleitung('Heute · Ende der Zinsbindung' + (bindj ? ' (nach ' + zahl(bindj) + ' Jahren)' : '') + ' · Anschlussfinanzierung mit dem angenommenen Zins.');
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

      /* Kennzahlen je Phase - die Zellen hat calc bereits gefuellt
         (Zinsaenderungs-Block). Hier wird nur uebernommen, nicht gerechnet. */
      function zT(id) { var e = el(id); var t = e ? sauber(e.textContent) : ''; return t || '-'; }
      if (el('zaer-zins-now')) {
        platz(56);
        abschnitt('Kennzahlen je Phase');
        tabelle(
          [['', 46], ['Heute', 26], ['Ende Zinsbindung', 30], ['Anschluss', 26]],
          [
            { werte: ['Sollzins', zT('zaer-zins-now'), zT('zaer-zins-ezb'), zT('zaer-zins-an')] },
            { werte: ['Rate / Monat', zT('zaer-rate-now'), zT('zaer-rate-ezb'), zT('zaer-rate-an')] },
            { werte: ['Cashflow / Monat vor Steuern', zT('zaer-cfvst-now'), zT('zaer-cfvst-ezb'), zT('zaer-cfvst-an')] },
            { werte: ['Cashflow / Monat nach Steuern', zT('zaer-cf-now'), zT('zaer-cf-ezb'), zT('zaer-cf-an')] },
            { werte: ['DSCR', zT('zaer-dscr-now'), zT('zaer-dscr-ezb'), zT('zaer-dscr-an')] },
            { werte: ['Veränderung der Rate gegenüber heute', '-', zT('zaer-drate-ezb'), zT('zaer-drate-an')], fett: true }
          ],
          { titel: 'Kennzahlen je Phase' });
      }

      platz(44, 'Zinsänderungsrisiko', 'Was passiert, wenn die Zinsbindung endet');
      abschnitt('Zinsänderungsrisiko');
      zeile('Zinsbindung', bindj !== null ? zahl(bindj) + ' Jahre' : '-');
      zeile('Restschuld am Ende der Zinsbindung', eur(S.rs));
      zeile('Angenommener Anschlusszins / Tilgung', [pct(num('anschl_z'), 2), pct(num('anschl_t'), 2)].join('  ·  '));
      zeile('Rate nach Anschluss / Monat', eur(K.rate_an_m, 2));
      zeile('Mehrbelastung gegenüber heute / Monat', eur(K.zaer_m, 2), { summe: true });
      if (da(K.zaer_pct) !== null) zeile('Das entspricht einer Veränderung von', pct(K.zaer_pct, 1), { klein: true });
    }

    /* ── Cashflow-Jahre ──────────────────────────────────────── */
    platz(52, 'Cashflow-Entwicklung', (adr || 'Objekt') + ' · die ersten ' + Math.min(10, rows.length || 0) + ' Jahre');
    abschnitt('Cashflow je Jahr');
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
      doc.text('Keine Jahreswerte vorhanden - bitte Objekt vollständig erfassen.', L, y); y += 8;
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
      platz(84, 'Vermögensaufbau', (adr || 'Objekt') + ' · Wert, Restschuld und Eigenkapital');
      abschnitt('Vermögensaufbau');
      var jahre = rows.map(function (r) { return r.cal || r.y; });
      kurve([
        { name: 'Objektwert (angenommen)', werte: rows.map(function (r) { return Number(r.wert_y); }), gold: true },
        { name: 'Restschuld', werte: rows.map(function (r) { return Number(r.rs); }) },
        { name: 'Eigenkapital im Objekt', werte: rows.map(function (r) { return Number(r.eq_y); }), grau: true }
      ], jahre, { hoehe: 44 });
      var l = rows[rows.length - 1];
      zeile('Eigenkapital heute', eur(rows[0] ? rows[0].eq_y : null));
      zeile('Eigenkapital nach ' + jahre.length + ' Jahren', eur(l ? l.eq_y : null), { summe: true });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Der Objektwert ist eine Annahme aus der hinterlegten Wertsteigerung, keine Bewertung nach § 194 BauGB.', L, y - 1);
      y += 6;
    }

    /* ── v1458 · Mieterliste und Ist/Soll (nur wenn Einheiten erfasst sind) ──
       Backlog v22 Punkt 6: die Bank will die Einheiten sehen, nicht nur die
       Summe. Gerechnet wird NICHT hier - die Zahlen kommen aus
       DpMfhEinheiten.berichtDaten() (Anlage-2-Punkte und RND aus dem
       RND-Kern) und aus State.kpis. */
    var MFH = (window.DpMfhEinheiten && typeof window.DpMfhEinheiten.berichtDaten === 'function')
      ? window.DpMfhEinheiten.berichtDaten() : null;
    if (MFH && MFH.zeilen.length) {
      platz(56, 'Einheiten und Zustand', (adr || 'Objekt') + ' · ' + MFH.zeilen.length + ' Einheiten');
      abschnitt('Mieterliste');
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
        mZeile([z.e.nr || '', (z.e.lage || '').slice(0, 18), z.fl ? zahl(z.fl, 0) : '-',
          z.e.ist ? zahl(Number(String(z.e.ist).replace(',', '.')), 0) : '-',
          z.e.soll ? zahl(Number(String(z.e.soll).replace(',', '.')), 0) : '-',
          z.e.status === 'leer' ? 'leer' : 'vermietet',
          z.punkte + ' P.' + (z.geerbt === 4 ? '*' : ''), z.rnd != null ? Math.round(z.rnd) + ' J.' : '-']);
      });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Anlage 2 ImmoWertV: Modernisierungspunkte je Einheit; * = Zustand vollständig vom Gebäude übernommen. '
        + 'RND = Restnutzungsdauer (indikativ, kein Gutachten).', L, y + 1);
      y += 10;

      abschnitt('Ist gegen Soll');
      var istJ = (K.nkm_j || 0), sollJ = MFH.s.soll * 12;
      zeile('Kaltmiete p. a. - Ist', eur(istJ));
      zeile('Kaltmiete p. a. - Soll (nach Maßnahmen)', eur(sollJ));
      zeile('Bruttomietrendite Ist (auf Kaufpreis)', pct(K.bmy, 2));
      zeile('Bruttomietrendite Soll (auf Gesamtinvestition)', da(K.gi) && K.gi > 0 ? pct(sollJ / K.gi * 100, 2) : '-');
      zeile('Rechtliche Einheit', MFH.aufgeteilt ? 'in Wohnungseigentum aufgeteilt (WEG)' : 'ungeteiltes Gebäude');
      if (MFH.s.leer) zeile('Leerstand', MFH.s.leer + ' Einheiten / ' + zahl(MFH.s.leerFl, 0) + ' m²');
      if (MFH.s.kosten) zeile('Geplante Maßnahmen', eur(MFH.s.kosten));
      zeile('Modernisierungsgrad (flächengewichtet)', zahl(MFH.punkteGew, 1) + ' von 20 Punkten');
      if (MFH.rndGew > 0) zeile('Restnutzungsdauer (flächengewichtet)', Math.round(MFH.rndGew) + ' Jahre', { summe: true });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(130);
      var hin = MFH.sollAbJahr
        ? 'Die Cashflow-Rechnung setzt die Soll-Miete ab Jahr ' + MFH.sollAbJahr + ' an; davor und danach gilt die hinterlegte Mietentwicklung.'
        : 'Die Cashflow-Rechnung rechnet durchgehend mit der Ist-Miete - die Soll-Miete ist hier nur nachrichtlich.';
      doc.splitTextToSize(hin, CW).forEach(function (t) { doc.text(t, L, y); y += 4.2; });
      y += 6;
    }

    /* ── Exit und Vermögenszuwachs ───────────────────────────── */
    var letzteZeile = rows.length ? rows[rows.length - 1] : null;
    if (da(K.exit_vkp) !== null || da(S.wert_basis) !== null) {
      platz(52, 'Exit und Vermögenszuwachs', (adr || 'Objekt'));
      abschnitt('Exit und Vermögenszuwachs');
      zeile('Objektwert heute (Anker der Wertsteigerung)', eur(S.wert_basis));
      zeile('Angenommene Wertsteigerung p. a.', num('wertstg') !== null ? pct(num('wertstg'), 1) : '-');
      zeile('Angenommener Verkaufspreis' + (S.btj ? ' nach ' + zahl(S.btj) + ' Jahren' : ''), eur(K.exit_vkp));
      if (letzteZeile) zeile('Restschuld zum Verkaufszeitpunkt', eur(letzteZeile.rs));
      if (letzteZeile && da(K.exit_vkp) !== null) zeile('Möglicher Erlös nach Ablösung', eur(K.exit_vkp - Math.max(0, letzteZeile.rs || 0)), { summe: true });
      if (num('exit_bmy') !== null) zeile('Unterstellte Exit-Rendite (Verkaufsszenario)', pct(num('exit_bmy'), 1), { klein: true });
      y += 1;
    }

    /* ── Diagramme aus dem Cockpit ───────────────────────────── */
    /* MARKER_V1463B */
    try { if (typeof window.buildCharts === 'function') window.buildCharts(); } catch (e) {}
    await new Promise(function (f) { setTimeout(f, 450); });
    var DIA = [['bc-equity', 'Eigenkapital und Restschuld'], ['bc-cockpit', 'Cockpit'],
      ['bc-waterfall', 'Vom Mietertrag zum Cashflow'], ['bc-stress', 'Belastungsprobe']];
    var diagramme = [];
    for (var di = 0; di < DIA.length; di++) {
      var bd = await svgBild(DIA[di][0]);
      if (bd) diagramme.push({ bild: bd, titel: DIA[di][1] });
    }
    if (diagramme.length) {
      platz(60, 'Diagramme', (adr || 'Objekt') + ' · aus der Bankansicht');
      abschnitt('Diagramme');
      var dw = (CW - 6) / 2;
      diagramme.forEach(function (d, i) {
        var dh = Math.min(62, dw * d.bild.h / d.bild.w);
        if (i % 2 === 0 && i > 0) y += 0;
        var sp = i % 2, rr = Math.floor(i / 2);
        if (sp === 0 && platz(dh + 12)) { /* Seitenwechsel vor der Reihe */ }
        var xx = L + sp * (dw + 6), yy = y + (sp === 0 ? 0 : 0);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(120);
        doc.text(d.titel, xx, yy + 3.4);
        bild(d.bild, xx, yy + 5, dw, dh);
        if (sp === 1 || i === diagramme.length - 1) y += dh + 12;
      });
      y += 2;
    }

    /* ── KI-Analyse, wenn vorhanden ──────────────────────────── */
    var ai = window._aiAnalysis || null, aiText = window._aiText || '';
    if (ai || aiText) {
      platz(60, 'KI-Investment-Analyse', (adr || 'Objekt'));
      abschnitt('KI-Investment-Analyse');
      function liste(titel, arr) {
        if (!arr || !arr.length) return;
        zeile(titel, '', { fett: true });
        arr.slice(0, 6).forEach(function (t) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(60);
          doc.splitTextToSize('· ' + String(t).replace(/\s+/g, ' '), CW - 4).forEach(function (z) {
            if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
            doc.text(z, L + 3, y); y += 4.4;
          });
        });
        y += 2;
      }
      if (ai) {
        if (ai.empfehlung || ai.recommendation) zeile('Empfehlung', sauber(ai.empfehlung || ai.recommendation).slice(0, 60), { summe: true });
        var offerte = ai.kaufpreis_offerte || ai.offerte || ai.kaufpreisempfehlung;
        if (offerte) zeile('Vorgeschlagene Kaufpreis-Offerte', typeof offerte === 'number' ? eur(offerte) : sauber(offerte).slice(0, 60));
        liste('Stärken', ai.staerken || ai.strengths);
        liste('Risiken', ai.risiken || ai.schwaechen || ai.risks);
        if (ai.fazit || ai.summary) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(60);
          doc.splitTextToSize(String(ai.fazit || ai.summary).replace(/\s+/g, ' '), CW).forEach(function (z) {
            if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
            doc.text(z, L, y); y += 4.4;
          });
        }
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(60);
        doc.splitTextToSize(String(aiText).replace(/\s+/g, ' ').slice(0, 2400), CW).forEach(function (z) {
          if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
          doc.text(z, L, y); y += 4.4;
        });
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Erzeugt von einem Sprachmodell aus den erfassten Angaben - eine Einschätzung, keine Beratung.', L, y + 1);
      y += 7;
    }

    /* ── Belastungsprobe (Stress-Matrix) ─────────────────────── */
    /* Sie ist kein Diagramm, sondern HTML - deshalb unsichtbar rendern
       lassen und die 25 Zellen auslesen. Gerechnet wird dort, nicht hier. */
    function stressDaten() {
      if (!window.BankCharts || typeof window.BankCharts.renderStressMatrix !== 'function') return null;
      var tmp = document.createElement('div');
      tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:700px;height:420px';
      document.body.appendChild(tmp);
      try { window.BankCharts.renderStressMatrix(tmp, window.State); } catch (e) { tmp.remove(); return null; }
      var zellen = [].slice.call(tmp.querySelectorAll('.bc-matrix-cell')).map(function (c) {
        var v = c.querySelector('.bc-matrix-cell-val');
        return { wert: v ? sauber(v.textContent) : '', titel: sauber(c.getAttribute('title') || ''),
          stufe: /critical/.test(c.className) ? 'rot' : (/warn/.test(c.className) ? 'gelb' : (/good|ok/.test(c.className) ? 'gruen' : '')),
          basis: /is-base/.test(c.className) };
      });
      var yr = [].slice.call(tmp.querySelectorAll('.bc-matrix-axis-y-row')).map(function (e) { return sauber(e.textContent); });
      tmp.remove();
      if (zellen.length !== 25 || yr.length !== 5) return null;
      return { zellen: zellen, y: yr };
    }
    var SM = stressDaten();
    if (SM) {
      platz(72, 'Belastungsprobe', (adr || 'Objekt') + ' · Schuldendeckung unter Druck');
      abschnitt('Belastungsprobe · DSCR je Szenario');
      einleitung('Jede Zelle ist der DSCR, wenn sich Zins und Miete gleichzeitig ändern. Zeilen: Zinsänderung. Spalten: Mietausfall bzw. Aufwertung. Werte unter 1,0 bedeuten, dass die Miete den Kapitaldienst nicht mehr deckt.');
      var spalten = [['Zinsänderung', 40], ['Miete -20 %', 27], ['-10 %', 27], ['±0 %', 27], ['+10 %', 27], ['+20 %', 27]];
      var faktorS = CW / spalten.reduce(function (a, s) { return a + s[1]; }, 0);
      /* Kopf */
      (function () {
        var x = L;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(110);
        spalten.forEach(function (s, i) {
          var bw = s[1] * faktorS;
          if (i === 0) doc.text(s[0], x, y); else doc.text(s[0], x + bw / 2, y, { align: 'center' });
          x += bw;
        });
        doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.5); doc.line(L, y + 2.2, W - R, y + 2.2); doc.setLineWidth(0.2);
        y += 7;
      })();
      SM.y.forEach(function (zeileName, r) {
        var x = L, hoehe = 9;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); doc.setTextColor(45);
        doc.text(zeileName.replace(/\s*(Krise|Stress|Mittel|Heute|Erholung)\s*/, ' · $1'), x, y + 3);
        x += spalten[0][1] * faktorS;
        for (var c = 0; c < 5; c++) {
          var z = SM.zellen[r * 5 + c], bw = spalten[c + 1][1] * faktorS;
          var f = z.stufe === 'rot' ? [246, 231, 230] : (z.stufe === 'gelb' ? [247, 240, 220] : [230, 241, 234]);
          doc.setFillColor(f[0], f[1], f[2]);
          doc.rect(x + 1, y - 2.5, bw - 2, hoehe - 1.5, 'F');
          if (z.basis) { doc.setDrawColor(GD[0], GD[1], GD[2]); doc.setLineWidth(0.5); doc.rect(x + 1, y - 2.5, bw - 2, hoehe - 1.5); doc.setLineWidth(0.2); }
          doc.setFont('helvetica', z.basis ? 'bold' : 'normal'); doc.setFontSize(8.6); doc.setTextColor(26, 26, 26);
          doc.text(z.wert || '-', x + bw / 2, y + 3, { align: 'center' });
          x += bw;
        }
        y += hoehe;
      });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Grün ab 1,2 · Gelb 1,0 bis 1,2 · Rot unter 1,0. Der golden umrandete Wert ist der heutige Stand.', L, y + 2);
      y += 8;
    }

    /* ── Vermögenszuwachs im Detail ──────────────────────────── */
    if (rows.length > 2) {
      platz(60, 'Vermögenszuwachs im Detail', (adr || 'Objekt'));
      abschnitt('Vermögenszuwachs im Detail');
      var ekStart = da(rows[0].eq_y) !== null ? rows[0].eq_y : 0;
      tabelle(
        [['Jahr', 18], ['Immobilienwert', 30], ['Restschuld', 28], ['Eigenkapital im Objekt', 34], ['Zuwachs gegenüber heute', 34]],
        rows.filter(function (r, i) { return rows.length <= 12 || i % 2 === 0 || i === rows.length - 1; }).map(function (r) {
          return { werte: [r.cal || r.y, eur(r.wert_y), eur(r.rs), eur(r.eq_y), eur((r.eq_y || 0) - ekStart)] };
        }),
        { titel: 'Vermögenszuwachs im Detail', hinweis: 'Eigenkapital im Objekt = angenommener Wert minus Restschuld. Der Wert ist eine Annahme, keine Bewertung.' });
    }

    /* MARKER_V1468 · Fehlen Diagramme, Vermoegensaufbau und Belastungsprobe,
       steht hier WARUM. Gemessen am 20.09.2026 an Objekt 2026-1004: dort ist
       ein Privat-Ende zum 01.01.2026 gesetzt, calc.js kappt den Betrachtungs-
       zeitraum auf ein Jahr (v816-CUT) - die Bankdiagramme brauchen aber
       mindestens zwei Jahresreihen. Ohne Hinweis sieht das aus wie ein Fehler. */
    if (rows.length < 2 || (!diagramme.length && !SM)) {
      platz(26);
      abschnitt('Was in dieser Fassung fehlt');
      var gruende = [];
      if (rows.length < 2) gruende.push('Die Projektion endet nach ' + (rows.length || 0) + ' Jahr' + (rows.length === 1 ? '' : 'en') + '. Vermögensaufbau, Diagramme und Belastungsprobe brauchen mindestens zwei Jahresreihen.');
      if (rows.length < 2 && txt('ueberf_ende')) gruende.push('Grund ist das gesetzte Privat-Ende zum ' + sauber(txt('ueberf_ende')) + ' - ab dann rechnet die Gesellschaft weiter.');
      if (rows.length >= 2 && !diagramme.length) gruende.push('Die Diagramme der Bankansicht ließen sich nicht erzeugen.');
      if (rows.length >= 2 && !SM) gruende.push('Die Belastungsprobe ließ sich nicht erzeugen.');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(70);
      gruende.forEach(function (t) {
        doc.splitTextToSize(t, CW).forEach(function (z) {
          if (y > H - 22) { doc.addPage(); kopf(_titel, _unter); }
          doc.text(z, L, y); y += 4.4;
        });
        y += 1.5;
      });
      y += 3;
    }

    platz(48, 'Annahmen und Hinweise', (adr || 'Objekt'));
    abschnitt('Annahmen');
    zeile('Mietsteigerung p. a.', num('mietstg') !== null ? pct(num('mietstg'), 1) : '-');
    zeile('Kostensteigerung p. a.', num('kostenstg') !== null ? pct(num('kostenstg'), 1) : '-');
    zeile('Wertsteigerung p. a.', num('wertstg') !== null ? pct(num('wertstg'), 1) : '-');
    zeile('Betrachtungszeitraum', S.btj ? zahl(S.btj) + ' Jahre' : '-');
    if (num('leerstand') !== null) zeile('Kalkulierter Leerstand p. a.', pct(num('leerstand'), 1));
    zeile('Anschlusszins / Anschlusstilgung (Annahme)', [pct(num('anschl_z'), 2), pct(num('anschl_t'), 2)].join('  ·  '));
    zeile('Persönlicher Grenzsteuersatz', num('grenz') !== null ? pct(num('grenz'), 2) : '-');
    zeile('Gebäudeanteil am Kaufpreis', num('geb_ant') !== null ? pct(num('geb_ant'), 0) : '-');
    zeile('AfA-Satz Gebäude', num('afa_satz') !== null ? pct(num('afa_satz'), 2) : (txt('afa_satz') || '-'));
    zeile('Grunderwerbsteuer (Land)', num('gest_p') !== null ? pct(num('gest_p'), 2) : '-');
    if (num('exit_bmy') !== null) zeile('Exit-Rendite (Verkaufsszenario)', pct(num('exit_bmy'), 1));
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
