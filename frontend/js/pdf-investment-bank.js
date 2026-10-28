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
  /* v1630 · HIESS BIS HIERHER `zahl` - GENAU WIE DER ZAHLENPARSER
     weiter unten (Z. ~254). Bei gleichnamigen Funktionsdeklarationen im
     selben Bereich gewinnt die SPAETERE: dieser Formatierer war tot,
     jeder Aufruf landete beim Parser, und das zweite Argument wurde
     verschluckt.

     Der Export starb daran mit "Type of text must be string or Array.
     17.915702160493826" - und weil er starb, wurde doc.save() nie
     erreicht. Marcel konnte das PDF nicht herunterladen, weil es gar
     nicht entstand.

     Wo das Ergebnis mit einer Zeichenkette verkettet wurde, fiel
     nichts auf; dort stand die Zahl nur unformatiert. Zwei Stellen
     gaben sie direkt an doc.text weiter, und die stuerzten ab. */
  function fmt(v, dec) {
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
      .replace(/[\u2212\u2011\u2012\u2013\u2014]/g, '-')
      /* v2461 · das Euro-Zeichen bleibt (die Standardschrift kennt es) - gemessen:
         in „Kennzahlen je Phase" stand „+1.968" statt „1.968 €", weil der
         Filter es mit allem ausserhalb Latin-1 entfernte. */
      .replace(/[^\x00-\xFF\u20AC]/g, '')
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
        return (DealPilotConfig.branding.fuerPdf ? DealPilotConfig.branding.fuerPdf() : DealPilotConfig.branding.get()) || {};   /* v3018c · Absender ab Investor */
      }
    } catch (e) {}
    return {};
  }
  function absender() {
    var b = marke();
    /* v1632 · Hier stand `|| 'DealPilot'`. Ein Absenderblock ist eine
       BEHAUPTUNG darueber, wer das Dokument verschickt - wer nichts
       hinterlegt hat, behauptet nichts. Die Zeilen darunter werden
       ohnehin nur aufgenommen, wenn sie Inhalt tragen. */
    var firma = String(b.company || '').trim();
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
    GEW: 'Gewerbe', GAR: 'Garage / Stellplatz', GRST: 'Unbebautes Grundstück' /* v2241 */ };

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
      /* v2830 · senkrecht nicht mittig, sondern bei 40 %: auf Objektfotos steht das
         Haus oben, unten liegen Hof und Garagen (gemessen Westerfeldstr.: der
         mittige Schnitt zeigte nur die Garagen). */
      ctx.drawImage(i, (zw - iw) / 2, (zh - ih) * 0.4, iw, ih);
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
    if (!(bestF > 2000)) return null;
    /* v1733 · DIE FLÄCHE ALLEIN SAGT NICHT, DASS ES EINE ZEICHNUNG IST.
       Gemessen an `bc-cockpit`: das grösste SVG im Behälter war 255x100 mit
       viewBox 540x100 und NULL Texten - ein Fortschrittsbalken, kein
       Diagramm. Es kam durch die Flächenschwelle und landete als drittes
       „Diagramm" im Dokument.

       > Eine Zeichnung ohne jede Beschriftung gehört in keine
       > Bankunterlage. Sie behauptet etwas, das niemand nachlesen kann.

       Verlangt wird deshalb beides: mindestens eine Beschriftung UND
       genug Formen, um überhaupt etwas darzustellen. */
    var texte = best.querySelectorAll('text').length;
    var formen = best.querySelectorAll('path,rect,circle,line,polyline,polygon').length;
    if (texte < 1 || formen < 4) return null;
    return best;
  }
  /* v2830 · IMMER frisch zeichnen, nie das SVG aus der Bankansicht nehmen.
     Gemessen 22.10.2026: nach einem Objektwechsel stand in der Bankansicht
     noch die Zeichnung des VORIGEN Objekts - die Bankfassung von Hüllhorst
     zeigte „Aus 120.000 € werden 581.205 €" (Westerfeldstr. 140). Das
     Investment-PDF war nicht betroffen, weil es vorher renderAll(State) ruft. */
  function svgQuelle(id) {
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
  /* ══ v1733 · WARUM DIE DIAGRAMME IM PDF ANDERS AUSSAHEN ALS AM BILDSCHIRM ══
     Marcel am 30.09.2026: „Und bei dieser Bankfassung, was mir gar nicht
     gefällt, sind die Diagramme. Die sind gar nicht gut angegeben."

     GEMESSEN an `renderEquityBuild`, Objekt 2026-1042:

       Texte im SVG                      21
       davon MIT font-size-Attribut       8
       davon ohne - aus dem Stylesheet   13
       <style>-Block im SVG            keiner

     Ein serialisiertes SVG in einer data-URI ist ein EIGENES DOKUMENT. Es
     sieht das Stylesheet der App nicht. Die dreizehn Texte ohne eigenes
     Attribut fallen darin auf die SVG-Vorgabe zurück: 16px statt 10,5px,
     und SCHWARZ statt Grau, weil auch `fill` aus dem CSS kam.

     > Das Layout war für 10,5px gerechnet. Mit 16px stehen die
     > Beschriftungen übereinander - und am Bildschirm sieht alles richtig
     > aus, weil dort das Stylesheet noch greift.

     Dieselbe Falle wie beim iframe, zum wiederholten Mal: das eigene
     Dokument erbt nichts.

     DAZU ZWEI GRÖSSENFEHLER:
     · Die viewBox ist 1200x380 (Verhältnis 3,16), gesetzt wurde ein Rahmen
       640x340 (1,88). `xMidYMid meet` verzerrt dabei nicht - es passt die
       Zeichnung ein und lässt rund 40 % der Bildhöhe LEER. Die Zeichnung
       wird dadurch kleiner, nicht schiefer.
     · Gedruckt wurde zweispaltig auf 87 mm. Eine 10,5er Beschriftung auf
       viewBox-Breite 1200 ergibt dort 1,5 pt. Das ist nicht klein, das ist
       unsichtbar.

     Behoben wird alles drei: Darstellung einbacken, Zielgrösse aus der
     viewBox, und im Dokument volle Breite statt zwei Spalten.
     ════════════════════════════════════════════════════════════════════ */
  var EINBACKEN = ['font-size', 'font-weight', 'font-style', 'fill', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap',
    'stroke-linejoin', 'text-anchor', 'dominant-baseline', 'opacity'];

  /* ── DIE SCHRIFT WIRD AUF EINE MINDESTGRÖSSE GEHOBEN, NICHT SKALIERT ──
     Erster Anlauf war ein fester Faktor 1,55 auf jeden Text. Am erzeugten
     PDF nachgesehen: die Achsen wurden lesbar, aber „+120k €" und
     „192k €" ragten über ihre goldene Unterlegung hinaus - die Rechtecke
     dahinter sind für die kleinere Schrift bemessen und wachsen nicht mit.

     > Ein Faktor vergrössert auch das, was schon gross genug war. Was hier
     > fehlt, ist keine Vergrösserung, sondern eine Untergrenze.

     Gerechnet wird deshalb in DRUCKGRÖSSE: ein Text soll auf dem Papier
     mindestens MIN_MM hoch sein. Bei Druckbreite 174 mm entspricht eine
     viewBox-Einheit 174/vbBreite Millimetern, die Untergrenze also
     MIN_MM * vbBreite / 174 Einheiten. Alles darunter wird angehoben,
     alles darüber bleibt unberührt - die Labels behalten ihre Grösse,
     die Achsen werden lesbar.

       vbB 1200 -> Untergrenze 15,9   (9px und 10,5px werden angehoben)
       vbB 1100 -> Untergrenze 14,6
       vbB  540 -> Untergrenze  7,1   (Cockpit, schmalere viewBox)  */
  var MIN_MM = 2.3;        /* rund 6,5 pt */
  var DRUCK_MM = 174;      /* CW bei A4 mit 18 mm Rändern */

  /* Webfonts gibt es in einer data-URI nicht - `Inter` wäre dort eine
     Zusage, die der Renderer nicht halten kann. Deshalb eine Familie, die
     überall vorhanden ist und den Metriken des PDF-Fonts nahekommt. */
  var SVG_FONT = 'Arial, Helvetica, sans-serif';

  function darstellungEinbacken(orig, klon, vbBreite) {
    /* Untergrenze in viewBox-Einheiten, damit MIN_MM auf dem Papier steht.
       Ohne bekannte viewBox wird nichts angehoben - lieber zu klein als
       nach einer geratenen Bezugsgrösse verzerrt. */
    var minFs = (vbBreite > 0) ? (MIN_MM * vbBreite / DRUCK_MM) : 0;
    var a = orig.querySelectorAll('*'), b = klon.querySelectorAll('*');
    /* Der Klon muss Knoten für Knoten dieselbe Reihenfolge haben. Stimmt die
       Zahl nicht, ist die Zuordnung geraten - dann lieber gar nichts tun,
       als die Werte auf die falschen Elemente zu schreiben. */
    if (a.length !== b.length) return { knoten: 0, angehoben: 0, minFs: 0, abbruch: 'Knotenzahl ungleich' };
    var n = 0, n2 = 0;
    for (var i = 0; i < a.length; i++) {
      var cs, tag = b[i].tagName ? String(b[i].tagName).toLowerCase() : '';
      try { cs = getComputedStyle(a[i]); } catch (e) { continue; }
      if (!cs) continue;
      for (var j = 0; j < EINBACKEN.length; j++) {
        var name = EINBACKEN[j], wert = cs.getPropertyValue(name);
        if (!wert) continue;
        /* `fill:none` MUSS gesetzt werden - die SVG-Vorgabe ist schwarz, ein
           nicht gesetztes fill füllt also jeden offenen Pfad aus. Bei stroke
           ist `none` die Vorgabe und darf wegbleiben. */
        if (wert === 'none' && name !== 'fill') continue;
        if (name === 'font-size' && tag === 'text') {
          var px = parseFloat(wert);
          if (!isFinite(px) || px <= 0) continue;
          /* nur anheben, nie verkleinern */
          if (minFs > px) { px = minFs; n2++; }
          wert = (Math.round(px * 10) / 10) + 'px';
        }
        b[i].setAttribute(name, wert);
      }
      if (tag === 'text' || tag === 'tspan') b[i].setAttribute('font-family', SVG_FONT);
      n++;
    }
    klon.setAttribute('font-family', SVG_FONT);
    return { knoten: n, angehoben: n2, minFs: Math.round(minFs * 10) / 10 };
  }

  function svgBild(id) {
    return new Promise(function (fertig) {
      try {
        var q = svgQuelle(id);
        if (!q) return fertig(null);
        var svg = q.svg, weg = q.aufraeumen;
        var k = svg.cloneNode(true);

        /* Zielgrösse aus der viewBox statt aus dem Behälter - sonst legt
           `xMidYMid meet` die Zeichnung in einen Rahmen mit fremdem
           Verhältnis und der Rest des Bildes bleibt weiss.
           Sie wird ZUERST gelesen, weil das Einbacken die Untergrenze der
           Schrift daraus ableitet. */
        var vb = (k.getAttribute('viewBox') || '').split(/[\s,]+/).filter(function (s) { return s !== ''; });
        var br, ho;
        if (vb.length === 4 && +vb[2] > 0 && +vb[3] > 0) { br = +vb[2]; ho = +vb[3]; }
        else {
          br = Math.max(320, q.breite); ho = Math.max(200, q.hoehe);
          k.setAttribute('viewBox', '0 0 ' + br + ' ' + ho);
        }

        /* VOR dem Aufräumen: getComputedStyle braucht das Original noch im
           Dokument. Eine Zeile später wäre jeder Wert leer. */
        var eingebacken = darstellungEinbacken(svg, k, br);
        if (weg) weg.remove();

        k.setAttribute('width', br); k.setAttribute('height', ho);
        k.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        var txt = new XMLSerializer().serializeToString(k);
        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt);
        var i = new Image();
        i.onload = function () {
          try {
            /* v1463d: PNG blies das Dokument auf 13,7 MB. JPEG mit weissem
               Grund bringt dieselbe Zeichnung bei rund einem Fuenfzigstel.
               v1733: Faktor 1,6 -> 1,8. Bei viewBox-Breite 1200 auf 174 mm
               sind das rund 305 dpi statt 271 - die Beschriftung braucht
               den Rand an Schärfe, die Flächen kosten nichts. */
            var c = document.createElement('canvas');
            c.width = Math.round(br * 1.8); c.height = Math.round(ho * 1.8);
            var ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(i, 0, 0, c.width, c.height);
            fertig({ src: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height, id: id, stile: eingebacken });
          } catch (e) { fertig(null); }
        };
        i.onerror = function () { fertig(null); };
        i.src = url;
      } catch (e) { fertig(null); }
    });
  }

/* v1505 · Marcel 21.09.2026: "zu dem Investment-PDF da muss geschaut werden,
   ob ueberhaupt alle Zahlen vorliegen, dass das Sinn macht. Ansonsten
   sperren."
   Gemessen an Rinteln (Anfrage, noch ohne Finanzierung): `exportPDFBank`
   prueft heute NUR, ob jsPDF geladen ist, und rechnet dann mit
   `State.kpis || {}`. Ergebnis waren Zins/Jahr 0, Tilgung 0, LTV 0, DSCR 0,
   Eigenkapitalrendite 0, Multiplikator 0 - und kein IRR. Das PDF entstand
   trotzdem, 20 Seiten lang, und sah aus wie eine Analyse. Eine Null ist aber
   keine Aussage: sie behauptet eine Finanzierung, die es nicht gibt.

   Die Pruefung trennt zwei Sorten:
     · SPERREN, wo das Dokument ohne die Zahl seinen Zweck verliert -
       Kaufpreis, Mieteinnahme und eine Finanzierung (Darlehen ODER
       ausdruecklich Eigenkapital). Ohne sie ist die halbe Bankfassung leer.
     · WARNEN, wo das Dokument stimmt, aber schoengerechnet ist -
       Bewirtschaftungskosten von null etwa ueberzeichnen jeden Cashflow.
   Die Pruefung liegt hier und wird nach aussen gegeben, damit die alte
   Fassung dieselbe benutzt statt einer zweiten Liste. */
  /* v1630 · DIESER HIER IST DER ZAHLENPARSER und heisst `zahl`. Der
     FORMATIERER weiter oben heisst `fmt` - er hiess einmal auch
     `zahl` und wurde davon ueberschrieben. Wer hier umbenennt, muss
     dort nachsehen. */
  function zahl(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function feldZahl(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    if (typeof window.parseDe === 'function') return zahl(window.parseDe(e.value));
    return zahl(String(e.value || '').replace(/\./g, '').replace(',', '.'));
  }

  window.pruefeInvestmentDaten = function () {
    var S = window.State || {}, K = S.kpis || {}, rows = S.cfRows || [];
    var sperren = [], warnen = [];

    if (!(zahl(K.gi) > 0)) sperren.push({ was: 'Kaufpreis', wo: 'Reiter Investition' });
    if (!(zahl(K.nkm_j) > 0)) sperren.push({ was: 'Mieteinnahme', wo: 'Reiter Objekt' });

    var darlehen = feldZahl('d1_betrag') + feldZahl('d2_betrag');
    var ek = feldZahl('ek');
    if (!(darlehen > 0) && !(ek > 0)) {
      sperren.push({
        was: 'Finanzierung',
        wo: 'Reiter Finanzierung',
        warum: 'Ohne Darlehen oder Eigenkapital bleiben DSCR, Beleihung, Eigenkapitalrendite und Multiplikator bei null - das sind sechs Kennzahlen der Bankfassung.',
      });
    }
    if (!rows.length) sperren.push({ was: 'Cashflow-Jahre', wo: 'Reiter Finanzierung', warum: 'Ohne sie gibt es keine Jahresuebersicht und keinen Vermoegensaufbau.' });

    if (darlehen > 0 && !(zahl(K.dscr) > 0)) warnen.push('Der Kapitaldienstdeckungsgrad steht auf null, obwohl ein Darlehen hinterlegt ist.');
    if (!(zahl(K.bwk) > 0) && !(zahl(K.bwk_cf) > 0)) warnen.push('Keine Bewirtschaftungskosten hinterlegt - der Cashflow fällt dadurch zu hoch aus.');
    if (!isFinite(Number(K.irr))) warnen.push('Kein interner Zinsfuss (IRR) - dafür fehlen die Angaben zum Verkauf.');
    if (!(zahl(K.steuer) !== 0)) warnen.push('Keine Steuerwirkung gerechnet - Grenzsteuersatz und Abschreibung prüfen.');

    /* v1511 · Marcel 22.09.2026: "es gibt doch die Standardfelder, die wir
       ausfuellen muessen. Da haben wir doch einen Counter fuer, ob wir
       vielleicht daran koppeln koennen."
       Nachgesehen: es gibt FUENF Vollstaendigkeitszaehler nebeneinander -
       DS2-KPIs (24), ReadyCheck-Grundfelder (15), Workflow-Bereiche (6) und
       zweimal Quick-Check. Gekoppelt wird an den ReadyCheck: er heisst schon
       'Bereit fuer die Bank?', fuehrt genau die Grundfelder, die eine Bank
       sehen will, und dient bereits als Sperre fuer die Partner-Anfrage.
       Eine SECHSTE Liste waere genau der Fehler, der hier schon fuenfmal
       gemacht wurde.
       Er sperrt nicht - fehlende Lage- oder Zustandsangaben machen das
       Dokument nicht falsch, nur duenner. Gesperrt wird weiter nur, was das
       Dokument seinen Zweck kostet. */
    try {
      if (window.DealPilotReadyCheck && typeof window.DealPilotReadyCheck.getData === 'function') {
        var rc = window.DealPilotReadyCheck.getData();
        if (rc && rc.total && rc.missing && rc.missing.length) {
          warnen.push('Grundfelder für die Bank: ' + rc.filled + ' von ' + rc.total +
            ' ausgefüllt. Es fehlen ' + rc.missing.map(function (m) { return m.name; }).join(', ') + '.');
        }
      }
    } catch (e) {}

    return { ok: sperren.length === 0, sperren: sperren, warnen: warnen };
  };

  /* Der Hinweis im Haus-Stil - kein window.confirm, das haelt die Seite an. */
  function zeigeLuecken(befund) {
    var alt = document.getElementById('dp-pdf-luecken');
    if (alt) alt.remove();
    var ov = document.createElement('div');
    ov.id = 'dp-pdf-luecken';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,5,5,.55);display:flex;align-items:center;justify-content:center;padding:20px';
    var liste = befund.sperren.map(function (s) {
      return '<li style="margin-bottom:8px"><b>' + s.was + '</b> <span style="color:#8A8272">· ' + s.wo + '</span>' +
        (s.warum ? '<div style="font-size:12px;color:#6B6356;line-height:1.5;margin-top:2px">' + s.warum + '</div>' : '') + '</li>';
    }).join('');
    ov.innerHTML =
      '<div style="background:#FDFCFA;border-radius:14px;max-width:520px;width:100%;padding:24px 26px;box-shadow:0 18px 50px rgba(0,0,0,.35)">' +
        '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin-bottom:8px">Investment-PDF</div>' +
        '<h3 style="margin:0 0 10px;font:600 19px/1.3 \'Space Grotesk\',sans-serif;color:#1a1a1a">Dafür fehlen noch Angaben</h3>' +
        '<p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#6B6356">Das Dokument entsteht sonst mit Nullen an Stellen, an denen eine Bank eine Aussage erwartet.</p>' +
        '<ul style="margin:0 0 18px;padding-left:18px;font-size:13.5px;line-height:1.5;color:#2A2727">' + liste + '</ul>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end">' +
          '<button type="button" id="dp-pdf-luecken-zu" class="btn btn-sm" style="background:#2A2727;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer">Verstanden</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    function zu() { ov.remove(); }
    ov.querySelector('#dp-pdf-luecken-zu').onclick = zu;
    ov.addEventListener('click', function (e) { if (e.target === ov) zu(); });
  }

  /* v2900 · opt.kurz: die Kurzfassung (Marcel 23.10.2026: „ja PDF-Paket").
     Dieselben Bausteine, dieselben Kerne, weisses Papier - nur weniger davon:
     S. 1 Objekt, Investition, Finanzierung, Kennzahlen · S. 2 Cashflow-Weg,
     Steuer, DSCR- und LTV-Verlauf · S. 3 Wert & Zielbild · S. 4 Pilot-Analyse
     kurz und Annahmen. Gerechnet wird nichts zusaetzlich; was die Kurzfassung
     weglaesst, steht in der Bankfassung. */
  window.exportPDFBank = async function (opt) {
    opt = opt || {};
    var KURZ = !!opt.kurz;
    var _std = {};   /* v3018 · welche Standardteile diese Fassung druckt */
    if (typeof window.jspdf === 'undefined') { alert('PDF-Bibliothek noch nicht geladen - bitte kurz warten und erneut versuchen.'); return; }
    try { if (typeof window.calcNow === 'function') window.calcNow(); } catch (e) {}

    /* v1505: erst pruefen, dann drucken. */
    /* v3018d · dasselbe Tor wie das Investment-PDF (pdf-pruefung.js, mit Sprung zum Feld) */
    if (window.DpPdfPruefung) { if (!window.DpPdfPruefung.tor('investment', KURZ ? 'Kurzfassung' : 'Bankfassung')) return; }
    else {
      var befund = window.pruefeInvestmentDaten();
      if (!befund.ok) { zeigeLuecken(befund); return; }
      if (befund.warnen.length && typeof window.toast === 'function') {
        window.toast('Hinweis: ' + befund.warnen[0]);
      }
    }

    var S = window.State || {}, K = S.kpis || {}, rows = S.cfRows || [];

    var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, L = 18, R = 18, CW = W - L - R, y = 22;
    var G = gold(), GD = [Math.round(G[0] * 0.82), Math.round(G[1] * 0.82), Math.round(G[2] * 0.82)];
    var ab = absender();

    /* v1634 · Das Logo VOR dem Bauen holen - `kopf()` laeuft synchron
       und auf jeder Seite; ein Nachladen mittendrin kaeme zu spaet.
       Rangfolge steckt in `fuerMarke`: Whitelabel vor DealPilot. */
    var _logo = null;
    try { _logo = await window.DealPilotPdfLogo.fuerMarke(ab.b); } catch (e) { _logo = null; }

    /* ── Bausteine ───────────────────────────────────────────── */
    function kopf(titel, unter) {
      y = 22;
      /* Eigenes Logo, wenn der Plan es hergibt - sonst der Firmenname. */
      var logoOk = false;
      if (_logo && _logo.b64) {
        try {
          /* v1634 · Nicht mehr auf 34x10 mm gequetscht - das verzerrt
             jedes Logo, dessen Seitenverhaeltnis nicht zufaellig 3,4
             ist. Die Plakette misst 512x160 (3,2), ein Partnerlogo
             irgendetwas. `masse` rechnet proportional in den Rahmen. */
          var _K = window.DealPilotPdfLogo.kopf;
          var m = window.DealPilotPdfLogo.masse(_logo, _K.b, _K.h);
          doc.addImage(_logo.b64, L, y + _K.dy, m.w, m.h, undefined, 'FAST');
          logoOk = true;
        } catch (e) { logoOk = false; }
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(26, 26, 26);
      /* v1633 · kein Logo UND keine Firma heisst: hier steht nichts. */
      if (!logoOk && ab.firma) doc.text(ab.firma, L, y);
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
      /* v2461 · lange Anschrift: der Untertitel lief bis 100 mm über den Rand */
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
      var _u = String(unter || '');
      if (doc.getTextWidth(_u) > CW) { while (_u.length > 1 && doc.getTextWidth(_u + '...') > CW) _u = _u.slice(0, -1); _u = _u.replace(/[\s,;·-]+$/, '') + '...'; }
      doc.text(_u, L, y);
      y += 10;
    }
    function abschnitt(t) {
      if (y > H - 34) { doc.addPage(); kopf(_titel, _unter); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(GD[0], GD[1], GD[2]);
      doc.text(t.toUpperCase(), L, y);
      doc.setDrawColor(226, 221, 210); doc.line(L, y + 1.8, W - R, y + 1.8);
      y += 7.5;
    }
    /* v2530 · Fließtext seitensicher. Gemessen (Video-Strang 20.10.2026): die
       Fußnote der Seite Wertpotenzial lief ohne Prüfung über die Fußlinie
       (H - 16) und den Seitenfuß bis an den Papierrand. Jeder Textblock geht
       jetzt hier durch: Umbruch per splitTextToSize, vor JEDER Zeile die
       Prüfung gegen TEXT_UNTEN, bei Platzmangel Fortsetzung auf neuer Seite
       mit Kopf (der Fuß kommt am Ende über fuss()) und derselben Schrift -
       kopf() stellt die Schrift um, deshalb wird sie danach neu gesetzt. */
    var TEXT_UNTEN = H - 20;
    /* v2830 · Blocksatz (Marcel 22.10.2026: „Die Texte sind nicht im Blocksatz").
       Jede Zeile ausser der letzten eines Absatzes auf volle Breite, Absatz-
       wechsel an \n (DpPdfBlocksatz). Zeilenabstand einheitlich aus der
       Schriftgroesse (0,52 mm je pt), wenn der Aufrufer keinen nennt.
       o.links = true setzt linksbuendig (Fussnoten unter Tabellen). */
    function absatz(t, o) {
      o = o || {};
      var gr = o.groesse || 8, lh = o.zeile || Math.round(gr * 0.52 * 10) / 10, x = o.x == null ? L : o.x, br = o.breite || (W - R - x);
      var stil = function () {
        doc.setFont('helvetica', o.fett ? 'bold' : 'normal'); doc.setFontSize(gr);
        doc.setTextColor(o.farbe == null ? 120 : o.farbe);
      };
      if (window.DpPdfBlocksatz) {
        y = window.DpPdfBlocksatz.absatz(doc, String(t == null ? '' : t), { x: x, y: y, breite: br, zeile: lh, unten: TEXT_UNTEN,
          blocksatz: !o.links, stil: stil, neueSeite: function () { doc.addPage(); kopf(_titel, _unter || 'Fortsetzung'); return y; } });
        return;
      }
      stil();
      doc.splitTextToSize(String(t == null ? '' : t), br).forEach(function (z) {
        if (y > TEXT_UNTEN) { doc.addPage(); kopf(_titel, _unter || 'Fortsetzung'); stil(); }
        doc.text(z, x, y); y += lh;
      });
    }
    /* v2830 · Aufzaehlung mit haengendem Einzug: der Punkt steht links, jede
       Folgezeile beginnt unter dem Text, nicht unter dem Punkt. */
    function punkt(t, o) {
      o = o || {};
      var gr = o.groesse || 8.4, x0 = o.x == null ? L : o.x;
      if (y > TEXT_UNTEN) { doc.addPage(); kopf(_titel, _unter || 'Fortsetzung'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(gr); doc.setTextColor(o.farbe == null ? 60 : o.farbe);
      doc.text('·', x0 + 0.6, y);
      absatz(t, { x: x0 + 3.6, breite: (o.breite || (W - R - x0)) - 3.6, groesse: gr, farbe: o.farbe == null ? 60 : o.farbe, zeile: o.zeile || 4.4 });
      y += 1.2;
    }
    function einleitung(t) {
      absatz(t, { groesse: 8, farbe: 120, zeile: 4.2 });
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
      /* v2461 · ein langer Wert (Anschrift) lief nach links über das Etikett und
         aus der Seite (gemessen: x = -10,9 mm). Er bricht jetzt rechtsbündig um. */
      var _wMax = CW - doc.getTextWidth(label) - (o.einzug ? 4 : 0) - 6;
      var _wz = doc.getTextWidth(String(wert)) > _wMax ? doc.splitTextToSize(String(wert), Math.max(40, _wMax)) : [String(wert)];
      _wz.forEach(function (t, j) { doc.text(t, W - R, y + j * 4.2, { align: 'right' }); });
      y += (_wz.length - 1) * 4.2;
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
    /* v2900 · Seitenwechsel der Kurzfassung: jede ihrer vier Seiten beginnt oben */
    function neueSeite(t, u) { _titel = t; _unter = u || ''; doc.addPage(); kopf(_titel, _unter); }
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
      /* v2461 · gemessen: eine linksbündige Spalte rechts neben einer
         rechtsbündigen klebte an ihr („950 vermietet", „1.121 € Bad, …"), und zu
         lange Texte liefen in die Nachbarspalte oder wurden mitten im Wort
         abgeschnitten. Jetzt: 3 mm Abstand, jede Zelle passt in ihre Spalte
         (sonst „..."), Spalten mit Kennung 'u' brechen in bis zu drei Zeilen um. */
      function passt(t, breite) {
        t = String(t); if (doc.getTextWidth(t) <= breite) return t;
        while (t.length > 1 && doc.getTextWidth(t + '...') > breite) t = t.slice(0, -1);
        return t.replace(/[\s,;·-]+$/, '') + '...';
      }
      function tz(werte, kopfzeile, fett) {
        var x = L, zeilen = 1;
        doc.setFont('helvetica', (kopfzeile || fett) ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.4 : 8.4);
        doc.setTextColor(kopfzeile ? 110 : (fett ? 26 : 45));
        var inhalt = werte.map(function (w, i) {
          var bw = spalten[i][1] * fak, links = i === 0 || spalten[i][2] === 'l' || spalten[i][2] === 'u';
          var platzB = bw - (links && i > 0 ? 3 : 0) - 1.5;
          if ((spalten[i][2] === 'u' || spalten[i][2] === 'w') && !kopfzeile) {   /* v3028: 'w' bricht um, bleibt rechtsbündig */
            var l = doc.splitTextToSize(String(w), platzB);
            if (l.length > 3) { l = l.slice(0, 3); l[2] = passt(l[2] + ' ...', platzB); }
            zeilen = Math.max(zeilen, l.length); return l;
          }
          return [passt(w, platzB)];
        });
        if (zeilen > 1 && y + (zeilen - 1) * 3.7 > H - 26) { doc.addPage(); kopf(o.titel || 'Investment Case', 'Fortsetzung'); }
        inhalt.forEach(function (l, i) {
          var bw = spalten[i][1] * fak, links = i === 0 || spalten[i][2] === 'l' || spalten[i][2] === 'u';
          l.forEach(function (t, j) {
            if (links) doc.text(t, x + (i > 0 ? 3 : 0), y + j * 3.7);
            else doc.text(t, x + bw - 1, y + j * 3.7, { align: 'right' });
          });
          x += bw;
        });
        var unten = y + (zeilen - 1) * 3.7;
        doc.setDrawColor(kopfzeile ? G[0] : 236, kopfzeile ? G[1] : 232, kopfzeile ? G[2] : 223);
        doc.setLineWidth(kopfzeile ? 0.5 : 0.15); doc.line(L, unten + 2.2, W - R, unten + 2.2); doc.setLineWidth(0.2);
        y = unten + (kopfzeile ? 7 : 6.2);
      }
      tz(spalten.map(function (s) { return s[0]; }), true);
      zeilen.forEach(function (z) {
        if (y > H - 28) { doc.addPage(); kopf(o.titel || 'Investment Case', 'Fortsetzung'); tz(spalten.map(function (s) { return s[0]; }), true); }
        tz(z.werte || z, false, !!z.fett);
      });
      if (o.hinweis) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130); doc.text(o.hinweis, L, y + 1); y += 5; }
      y += 4;
    }

    /* v2830 · Kachelreihe [label, wert, unter] - die Fusskennzahlen der
       Bank-Karten, im Stil des Kennzahlenrasters (Haarlinie, keine Flaeche). */
    function kachelReihe(items) {
      items = items.filter(function (it) { return it && it[1]; }).slice(0, 5);
      if (!items.length) return;
      var n = items.length, sp = 2.5, bw = (CW - (n - 1) * sp) / n, bh = 15;
      if (y + bh > H - 24) { doc.addPage(); kopf(_titel, _unter); }
      items.forEach(function (it, i) {
        var x = L + i * (bw + sp);
        doc.setDrawColor(226, 221, 210); doc.setLineWidth(0.25); doc.rect(x, y, bw, bh);
        doc.setFillColor(G[0], G[1], G[2]); doc.rect(x, y, bw, 0.7, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(n >= 5 ? 6 : 6.6); doc.setTextColor(120);
        var lb = sauber(it[0]); while (lb.length > 3 && doc.getTextWidth(lb) > bw - 4) lb = lb.slice(0, -1);
        doc.text(lb, x + 2.2, y + 4.6);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(n >= 5 ? 9 : 10.5); doc.setTextColor(26, 26, 26);
        doc.text(sauber(it[1]), x + 2.2, y + 9.8);
        if (it[2]) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(140);
          var u = sauber(it[2]); while (u.length > 3 && doc.getTextWidth(u) > bw - 4) u = u.slice(0, -1);
          doc.text(u, x + 2.2, y + 13.2);
        }
      });
      doc.setLineWidth(0.2);
      y += bh + 3;
    }
    /* v2830 · Kopfsatz und Fusskacheln einer Bank-Karte (bc-equity, bc-waterfall)
       lesen - dieselbe Quelle wie pdf.js _readCardDataFromDom. Gezeichnet wird
       bei Bedarf unsichtbar in eine eigene Flaeche; gerechnet wird nichts. */
    function karte(id) {
      var host = null, tmp = null;   /* v2830: frisch, siehe svgQuelle */
      {
        var fn = BC_FN[id];
        if (!fn || !window.BankCharts || typeof window.BankCharts[fn] !== 'function') return null;
        tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:640px;height:340px';
        document.body.appendChild(tmp);
        try { window.BankCharts[fn](tmp, window.State); } catch (e) { tmp.remove(); return null; }
        host = tmp;
      }
      var c = host.querySelector('.bc-card');
      var t = function (sel, w) { var e = (w || c).querySelector(sel); return e ? sauber(e.textContent) : ''; };
      var r = c ? { titel: t('.bc-head-title'), fuss: [].slice.call(c.querySelectorAll('.bc-footer-cell')).map(function (z) {
        return [t('.bc-footer-label', z), t('.bc-footer-value', z), t('.bc-footer-sub', z)]; }) } : null;
      if (tmp) tmp.remove();
      return r;
    }

    /* Kurve: Vermoegensaufbau. Bewusst ohne Farbflaechen - zwei Linien,
       Gold fuer den Wert, Tinte fuer die Restschuld, Raster in Grau. */
    function kurve(reihen, jahre, o) {
      o = o || {};
      var hoehe = o.hoehe || 52, bx = L + 20, bw = CW - 32, by = y, bh = hoehe;
      var alle = reihen.reduce(function (a, r) { return a.concat(r.werte); }, []).filter(function (n) { return isFinite(n); });
      if (!alle.length || jahre.length < 2) return;
      var max = Math.max.apply(null, alle), min = Math.min(0, Math.min.apply(null, alle));
      if (o.min != null) min = Math.min(o.min, Math.min.apply(null, alle));
      if (o.schwellen) o.schwellen.forEach(function (s) { if (s.wert > max) max = s.wert; if (s.wert < min) min = s.wert; });
      var sp = max - min || 1;
      function px(i) { return bx + (bw * i) / (jahre.length - 1); }
      function py(v) { return by + bh - ((v - min) / sp) * bh; }
      /* Raster und Achsenbeschriftung */
      doc.setDrawColor(236, 232, 223); doc.setLineWidth(0.15);
      for (var t = 0; t <= 4; t++) {
        var wert = min + (sp * t) / 4, yy = py(wert);
        doc.line(bx, yy, bx + bw, yy);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(140);
        doc.text(o.fmt ? o.fmt(wert) : fmt(Math.round(wert / 1000)) + ' T€', bx - 2, yy + 1.6, { align: 'right' });   /* v2461: deutsch statt „k" · v2830: o.fmt */
      }
      /* MARKER_V1469 · gemessen: liegen zwei Linien am Ende aufeinander (ohne
         Darlehen sind Objektwert und Eigenkapital gleich), druckten sich die
         beiden Endwerte uebereinander. Belegte Hoehen merken und ausweichen. */
      /* v2830 · Schwellen (DSCR 1,2 / 1,0, LTV-Grenzen) als feine Strichlinien */
      (o.schwellen || []).forEach(function (s) {
        var c = s.farbe || [150, 145, 135], sy = py(s.wert);
        doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(0.25);
        try { doc.setLineDashPattern([0.8, 0.8], 0); } catch (e) {}
        doc.line(bx, sy, bx + bw, sy);
        try { doc.setLineDashPattern([], 0); } catch (e) {}
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(c[0], c[1], c[2]);
        doc.text(s.text, bx + 1, sy - 0.8);
      });
      doc.setLineWidth(0.2);
      var belegt = [];
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
          var ly = py(letzte) + 1.6;
          while (belegt.some(function (v) { return Math.abs(v - ly) < 3.2; })) ly += 3.4;
          belegt.push(ly);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(f[0], f[1], f[2]);
          doc.text(o.fmt ? o.fmt(letzte) : fmt(Math.round(letzte / 1000)) + ' T€', bx + bw + 1.5, ly);
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
        /* v1633 · Ohne Firma stand hier ' · Investment Case · ...' - ein
           Trennpunkt ohne etwas davor. Der Trenner gehoert zur Firma,
           nicht zum Dokumenttitel. */
        doc.text((ab.firma ? ab.firma + ' · ' : '') + 'Investment Case · erstellt am ' + heute(), L, H - 11.5);
        doc.text('Seite ' + p + ' von ' + n, W - R, H - 11.5, { align: 'right' });
      }
    }

    /* ── Daten (nur gelesen) ─────────────────────────────────── */
    var adr = [[txt('str'), txt('hnr')].filter(Boolean).join(' '), [txt('plz'), txt('ort')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var kp = num('kp'), san = num('san'), moebl = num('moebl'), gi = da(S.gi);
    /* v2273 · seit v2261 ist das Inventar Teil des Kaufpreises (gi = kp + nk + san). Hier wurde es
       noch einmal abgezogen: Westerfeldstr. 140 zeigte Erwerbsnebenkosten 40.415 EUR unter den
       Einzelzeilen 9.265 + 2.725 + 35.425 = 47.415 EUR, und das Inventar stand als Summand darunter. */
    var nk = (gi !== null && kp !== null) ? Math.max(0, gi - kp - (san || 0)) : null;
    var ek = num('ek'), d1 = num('d1');
    var fotos = await bilderLaden(5);
    var d2an = el('d2_enable') && el('d2_enable').checked, d2 = d2an ? num('d2') : null;
    /* v2461 · gemessen (Hüllhorst): Haken an, aber kein Betrag - im PDF stand
       „Darlehen II -" mit Zins, Rate 0,00 € und „Mischzins". Ohne Betrag kein Block. */
    if (d2an && !(d2 > 0)) { d2an = false; d2 = null; }

    /* ── Seite 1 ─────────────────────────────────────────────── */
    kopf(KURZ ? 'Investment Case · Kurzfassung' : 'Investment Case', (adr || 'Objekt ohne Anschrift') + ' · Finanzierungsunterlage · Stand ' + heute());

    /* v2830 · Titelbild: Zuschnitt nur so weit, wie das Foto es traegt -
       ein Hochformat wurde auf 2,5 : 1 geschnitten und zeigte einen Streifen.
       Abgeschnitten wird hoechstens ein Drittel der Hoehe (Ziel 2,5 : 1),
       Hoehe hoechstens 74 mm, mittig - wie das Deckblatt des Investment-PDFs. */
    if (fotos.length && !KURZ) {   /* v2900a · Kurzfassung ohne Titelbild, sonst rutschen die Kennzahlen auf S. 2 */
      var _r0 = fotos[0].w / fotos[0].h, _fr = _r0 < 2.5 ? Math.min(2.5, _r0 / 0.65) : 2.5, _fh = Math.min(KURZ ? 46 : 74, CW / _fr), _fw = _fh * _fr;
      bild(fotos[0], L + (CW - _fw) / 2, y, _fw, _fh, true); y += _fh + 6;
    }

    abschnitt('Objekt');
    zeile('Anschrift', adr || '-');
    zeile('Objektart', OBJART[txt('objart')] || txt('objart') || '-');
    zeile('Wohnfläche', num('wfl') !== null ? fmt(num('wfl'), 0) + ' m²' : '-');
    zeile('Baujahr', txt('baujahr') || '-');     /* Jahreszahl nie durch Intl (CLAUDE.md) */
    if (txt('kaufdat')) zeile('Kaufdatum', /^\d{4}-\d{2}-\d{2}$/.test(txt('kaufdat')) ? txt('kaufdat').split('-').reverse().join('.') : txt('kaufdat'));   /* v2273: stand als 2025-01-01 */
    y += 3;

    if (!KURZ) ansprechpartner();

    abschnitt('Investition');
    zeile('Kaufpreis', eur(kp));
    if (moebl && !KURZ) zeile('davon Möblierung / Inventar', eur(moebl), { einzug: true, klein: true });
    /* Nebenkosten einzeln wie im alten PDF - eine Summe allein beantwortet
       der Bank die Frage nach der Zusammensetzung nicht. */
    function nkZeile(feld, name) {
      var pz = num(feld);
      if (pz === null || !kp) return 0;
      /* v3006c · die Grunderwerbsteuer auf den Kaufpreis ohne Inventar (wie das Formular) */
      var betrag = ((feld === 'gest_p' && window.DealKpis && DealKpis.grestBasis) ? DealKpis.grestBasis(kp, Math.max(moebl || 0, num('inv_kueche') || 0)) : kp) * pz / 100;
      if (!betrag) return 0;
      if (KURZ) return betrag;   /* Kurzfassung: nur die Summe */
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
    zeile('Gesamtinvestition', eur(gi), { summe: true });
    y += 1;

    abschnitt('Finanzierung');
    var aussetzung = (txt('d1_type') === 'tilgungsaussetzung');
    zeile('Eigenkapital' + (gi && ek !== null ? ' (' + pct(ek / gi * 100, 1) + ' der Gesamtinvestition)' : ''), eur(ek));
    zeile('Darlehen I' + (aussetzung ? ' · Tilgungsaussetzung' : ' · Annuitätendarlehen'), eur(d1));
    zeile('Sollzins / Tilgung / Zinsbindung', [pct(num('d1z'), 2), aussetzung ? 'über Bausparvertrag' : pct(num('d1t'), 2), num('d1_bindj') !== null ? fmt(num('d1_bindj')) + ' Jahre' : '-'].join('  ·  '), { einzug: true, klein: true });
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
    /* v2830 · aus dem Investment-PDF: Finanzierungsstruktur in einem Satz und der
       Wertpuffer gegen einen angegebenen Verkehrswert (dieselben Felder wie pdf.js). */
    var _strukt = aussetzung ? (d2an ? 'Tilgungsaussetzung + Bausparvertrag + Zusatzdarlehen' : 'Tilgungsaussetzung mit Bausparvertrag')
      : (d2an ? 'Annuitätendarlehen + Zusatzdarlehen' : 'Annuitätendarlehen (Zins und Tilgung)');
    zeile('Finanzierungsstruktur', _strukt, { klein: true });   /* v2940 · auch in der Kurzfassung */
    var _svw = num('svwert');
    if (_svw) {   /* v2940 · auch in der Kurzfassung */
      zeile((window.State && State.svw_label) || 'Wertangabe (Reiter Objekt)', eur(_svw));   /* v2996: Herkunft statt immer § 194 */
      if (da(K.wp_kpi) !== null && K.wp_kpi !== 0) zeile('Sofortiger Wertpuffer gegenüber dem Kaufpreis', (da(K.wp_kpi) !== null && K.wp_kpi > 0 ? '+ ' : '') + eur(K.wp_kpi), { fett: true });
    }
    y += 1;

    /* Bausparvertrag - nur beim Tilgungsaussetzungsdarlehen. */
    if (aussetzung) {   /* v2940 · Bausparvertrag auch in der Kurzfassung: ohne ihn sieht die Bank ein Darlehen ohne Tilgung */
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
        if (da(bs.eingezahlt) !== null) zeile('Eingezahlt bis Ende der Zinsbindung' + (bs.jahre ? ' (' + fmt(bs.jahre) + ' Jahre)' : ''), eur(bs.eingezahlt));
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
    /* v2992 · die ZAHL der Kachel ist der Score der Objektkarte (Investor-Score), wie im
       Investment-PDF - Parkstr. 9 zeigte hier 99, auf der Karte 76. Die Deutung darunter
       bleibt die des Kennzahlen-Scores und steht nur, wenn er auch die Zahl liefert. */
    var SCK = null; try { SCK = window._dpPdfScore ? window._dpPdfScore(K) : null; } catch (e) {}
    if (SCK && SC && SCK.quelle !== 'kennzahlen') SC = { score: SCK.score, label: SCK.label };
    else if (SCK && !SC) SC = { score: SCK.score, label: SCK.label };
    /* v2900b · Kurzfassung: acht Kacheln (zwei Reihen) - mit zwoelf rutschte das Raster auf S. 2 */
    raster([
      ['Bruttomietrendite', pct(K.bmy, 2), 'auf Kaufpreis'],
      ['Nettomietrendite', pct(K.nmy, 2), 'auf Gesamtinvest.'],
      ['Kaufpreisfaktor', fmt(K.fak, 1), 'fach'],
      ['Cashflow vor Steuern', eur(K.cf_m), 'je Monat'],
      ['DSCR', fmt(K.dscr, 2), ''],
      ['LTV', pct(K.ltv, 1), S.ltv_basis_label ? 'auf ' + S.ltv_basis_label : ''],
      ['EK-Rendite', pct(K.ekr, 2), 'p. a., vor Steuern'],
      ['Interner Zinsfuß (IRR)', da(K.irr) === null ? 'nicht bestimmbar' : pct(K.irr, 2), ''],
      /* v2992 · bis hier rows[0].nkm_y - im Rumpfjahr (Kauf 23.12.2024) die Miete EINES Monats „im ersten Jahr" */
      ['Kaltmiete', da(K.wm_j) !== null ? eur(K.wm_j) : (rows[1] ? eur(rows[1].nkm_y) : '-'), 'pro Jahr, inkl. Zusatzeinnahmen'],
      ['Equity Multiple', da(K.em) === null ? '-' : fmt(K.em, 1) + 'x', 'über die Haltedauer'],
      ['Wertpuffer / Equity', eur(K.wp_kpi), 'heute'],
      ['Deal Score', (SC && SC.score) ? fmt(SC.score, 0) + ' / 100' : '-', (SC && SC.label) ? SC.label : '']
    ], { titel: 'Kennzahlen' });   /* v2940 · Kurzfassung mit allen zwölf Kennzahlen (Marcel: bis sechs Seiten) */
    if (SC && SC.interpretation && !KURZ) {
      platz(16);
      absatz('Einordnung: ' + String(SC.interpretation).replace(/\s+/g, ' '), { groesse: 8.4, farbe: 70, zeile: 4.4 });
      y += 4;
    }

    /* Galerie: die uebrigen Fotos, ruhig im Raster, ohne Balken. */
    if (fotos.length > 1 && !KURZ) {
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
      if (!halter || halter === 'privat' || KURZ) return;
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
    if (KURZ) neueSeite('Ertrag und Cashflow', (adr || 'Objekt') + ' · Kurzfassung');
    platz(46, 'Ertrag und Cashflow', (adr || 'Objekt') + ' · laufendes Jahr');
    abschnitt('Von der Warmmiete zum Cashflow');
    /* v2484 · EINE Warmmiete in beiden PDFs und der App: Nettokaltmiete +
       Nebenkostenvorauszahlungen der Mieter (calc.js warm_j). Zusatzeinnahmen
       (Stellplatz, Garage) stehen getrennt. Hier stand K.wm_j = NKM + ZE + Umlagen
       (Westerfeld 41.147 €), im Investment-PDF NKM + ZE + umlagefaehige Kosten
       (39.756 €). Die Kette endet unveraendert bei der Kaltmiete inkl. Zuschlaege. */
    var _warm = da(K.warm_j) !== null ? K.warm_j : null;
    zeile('Warmmiete / Jahr (NKM + NK-Vorauszahlungen)', eur(_warm));
    /* v2273 · hier stand „abzüglich umlagefähiger Bewirtschaftung“ (K.bwk_ul) - die Kette ging
       nicht auf: Westerfeldstr. 140 Warmmiete 41.147 − 336 ≠ Kaltmiete 39.420. Die Warmmiete
       enthält die Umlagen der Mieter (calc.js wm_m = nkm + ze + uf), abgezogen werden also
       diese; die umlagefähigen Kosten stehen weiter unten im Block Bewirtschaftung. */
    zeile('abzüglich NK-Vorauszahlungen der Mieter', da(K.nk_vz_j) === null ? '-' : '- ' + eur(K.nk_vz_j), { einzug: true });
    zeile('Nettokaltmiete / Jahr', eur(K.nkm_netto_j));
    if (da(K.ze_j) && K.ze_j > 0) zeile('zuzüglich Zusatzeinnahmen (Stellplatz, Garage)', '+ ' + eur(K.ze_j), { einzug: true });
    zeile('Kaltmiete inkl. Zusatzeinnahmen / Jahr', eur(K.nkm_j), { fett: true });
    zeile('abzüglich nicht umlagefähiger Bewirtschaftung', da(K.bwk_cf) === null ? '-' : '- ' + eur(K.bwk_cf), { einzug: true });
    zeile('Betriebsergebnis (NOI)', da(K.nkm_j) === null ? '-' : eur(K.nkm_j - (K.bwk_cf || 0)), { fett: true });
    zeile('abzüglich Zinsen', da(K.zins_j) === null ? '-' : '- ' + eur(K.zins_j), { einzug: true });
    if (da(K.bspar_j) && K.bspar_j > 0) zeile('abzüglich Bausparrate', '- ' + eur(K.bspar_j), { einzug: true });
    zeile('abzüglich Tilgung', da(K.tilg_j) === null ? '-' : '- ' + eur(K.tilg_j), { einzug: true });
    zeile('Cashflow vor Steuern / Jahr', eur(K.cf_op), { summe: true });
    /* v2461 · Steuer als Differenz der beiden Cashflows (wie die App, calc.js
       V352): K.steuer ist das anteilige erste Jahr, die Cashflows sind Volljahre -
       gemessen stand „+ 771 €" zwischen zwei gleichen Cashflows von 8.119 €. */
    var _stH = (da(K.cf_op) === null || da(K.cf_ns) === null) ? null : K.cf_ns - K.cf_op;
    zeile('Steuern (Belastung -, Erstattung +)', _stH === null ? '-' : (_stH > 0.5 ? '+ ' : (_stH < -0.5 ? '- ' : '')) + eur(Math.abs(_stH)), { einzug: true });
    zeile('Cashflow nach Steuern / Jahr', eur(K.cf_ns), { summe: true });
    zeile('Cashflow nach Steuern / Monat', da(K.cf_ns) === null ? '-' : eur(K.cf_ns / 12, 2), { fett: true });
    y += 2;

    if (!KURZ) {   /* v2900 · Kurzfassung ohne Bewirtschaftung im Einzelnen */
    platz(34);
    abschnitt('Bewirtschaftung');
    /* ═══ v1895 · Jede geschaetzte Zahl sagt es im PDF selbst ══════════
       Ein Bankexposé, das eine angesetzte Pauschale wie eine vorgelegte
       Zahl ausweist, behauptet eine Herkunft. Die Herkunft liegt in
       `_dp_herkunft` (der Sprechlauf schreibt sie, ui.js:783 liest sie
       fuer die Pilot-Analyse). `(geschätzt)` haengt am LABEL, damit die
       Zahlenspalte rechts ausgerichtet bleibt — und die Fussnote darunter
       sagt einmal in ganzen Worten, was das heisst.

       Marke: jsPDF kennt kein `var()`, hier wird deshalb auch keine
       Farbe gesetzt — der Hinweis traegt sich ueber den Text. */
    var _hk1895 = (function () {
      try {
        var e = document.getElementById('_dp_herkunft');
        if (!e || !e.value) return {};
        var o = JSON.parse(e.value);
        return (o && typeof o === 'object') ? o : {};
      } catch (e2) { return {}; }
    })();
    var _gs1895 = [];
    function _lbl1895(id, label) {
      var t = _hk1895[id];
      if (t == null || String(t).trim() === '') return label;
      if (!/geschätzt|geschaetzt|angesetzt|pauschal|Einstellungen|angenommen/i.test(String(t))) return label;
      if (_gs1895.indexOf(label) < 0) _gs1895.push(label);
      return label + '  (geschätzt)';
    }
    zeile(_lbl1895('hg_ul', 'Hausgeld umlagefähig / Jahr'), eur(num('hg_ul')));
    zeile(_lbl1895('grundsteuer', 'Grundsteuer / Jahr'), eur(num('grundsteuer')));
    if (num('ul_sonst')) zeile(_lbl1895('ul_sonst', 'Sonstiges umlagefähig'), eur(num('ul_sonst')));
    zeile('Summe umlagefähig (durchlaufend)', eur(K.bwk_ul), { fett: true });
    zeile(_lbl1895('hg_nul', 'Hausgeld nicht umlagefähig / Jahr'), eur(num('hg_nul')));
    if (num('weg_r')) zeile('WEG-Rücklage / Jahr (nachrichtlich)', eur(num('weg_r')), { klein: true });
    if (num('eigen_r')) zeile(_lbl1895('eigen_r', 'Eigene Instandhaltungsrücklage'), eur(num('eigen_r')));
    if (num('mietausfall')) zeile(_lbl1895('mietausfall', 'Kalkulatorischer Mietausfall'), eur(num('mietausfall')));
    if (num('nul_sonst')) zeile(_lbl1895('nul_sonst', 'Sonderverwaltung'), eur(num('nul_sonst')));
    zeile('Summe nicht umlagefähig (im Cashflow)', eur(K.bwk_cf), { summe: true });
    zeile('Bewirtschaftungskosten gesamt / Jahr', eur(K.bwk));
    zeile('davon Anteil an der Kaltmiete', (da(K.nkm_j) && K.nkm_j > 0) ? pct(K.bwk / K.nkm_j * 100, 1) : '-', { klein: true });
    if (_gs1895.length) {
      einleitung('Die mit (geschätzt) bezeichneten Posten hat DealPilot angesetzt, weil dazu keine '
        + 'Angabe vorlag — als Anteil der Jahresmiete nach den hinterlegten Standardwerten. '
        + 'Das kalkulatorische Mietausfallwagnis steckt in keiner Hausgeldabrechnung und wird '
        + 'deshalb immer angesetzt. Alle übrigen Zahlen dieses Abschnitts sind vorgelegte Werte.');
    }
    y += 2;
    }   /* !KURZ Bewirtschaftung */

    platz(30);
    abschnitt('Steuerliche Wirkung');
    zeile('Abschreibung (AfA) / Jahr', eur(K.afa));
    zeile('Zu versteuerndes Ergebnis', eur(K.zve_immo));
    zeile('Persönlicher Grenzsteuersatz', num('grenz') !== null ? pct(num('grenz'), 2) : '-');

    if (KURZ) { y += 3; cockpitVerlauf(true); }
    if (!KURZ) {   /* v2900 · Phasen, Cashflow je Jahr, Vermoegen, Mieterliste: nur Bankfassung */
    /* ── Drei Phasen ─────────────────────────────────────────── */
    var bindj = num('d1_bindj');
    var hatPhasen = da(K.cf_ns_ezb) !== null || da(K.cf_ns_an) !== null;
    if (hatPhasen) {
      _std.phasen = true;   /* v3018 · Anschlussfinanzierung steht hier gerechnet (pdf.js _dpPdfGedeckt) */
      /* v2832 · die erste Spalte ist das erste VOLLE Jahr (beim Bestand das Kaufjahr) */
      var _j1 = typeof window._dpPdfJahr1 === 'function' ? window._dpPdfJahr1(false) : 'Heute';
      platz(62, 'Drei Phasen', _j1 + ' · Ende der Zinsbindung' + (bindj ? ' (nach ' + fmt(bindj) + ' Jahren)' : '') + ' · Anschlussfinanzierung');
      abschnitt('Cashflow je Phase');
      einleitung(_j1 + ' · Ende der Zinsbindung' + (bindj ? ' (nach ' + fmt(bindj) + ' Jahren)' : '') + ' · Anschlussfinanzierung mit dem angenommenen Zins.');
      function ph(label, a, b, c) { return { werte: [label, a, b, c] }; }
      function stD(vor, nach) { if (da(vor) === null || da(nach) === null) return '-'; var d = nach - vor; return (d > 0.5 ? '+ ' : (d < -0.5 ? '- ' : '')) + eur(Math.abs(d)); }
      tabelle(
        [['', 46], [_j1, 26], ['Ende Zinsbindung', 30], ['Anschluss', 26]],
        [
          /* v2461 · Kaltmiete statt Warmmiete: nur so geht die Spalte bis zum
             Cashflow auf (die Umlagen laufen durch). */
          ph('Kaltmiete / Jahr', eur(K.nkm_j), eur(K.nkm_ezb), eur(K.nkm_an)),
          ph('Bewirtschaftung (nicht umlagef.)', eur(K.bwk_cf), eur(K.bwk_cf_ezb), eur(K.bwk_cf_an)),
          ph('Zinsen', eur(K.zins_j), eur(K.zins_ezb), eur(K.zins_an)),
          ph('Tilgung', eur(K.tilg_j), eur(K.tilg_ezb), eur(K.tilg_an)),
          { werte: ['Cashflow vor Steuern', eur(K.cf_op), eur(K.cf_op_ezb), eur(K.cf_op_an)], fett: true },
          ph('Steuern (Belastung -, Erstattung +)', stD(K.cf_op, K.cf_ns), stD(K.cf_op_ezb, K.cf_ns_ezb), stD(K.cf_op_an, K.cf_ns_an)),
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
          [['', 46], [_j1, 26], ['Ende Zinsbindung', 30], ['Anschluss', 26]],
          [
            { werte: ['Sollzins', zT('zaer-zins-now'), zT('zaer-zins-ezb'), zT('zaer-zins-an')] },
            { werte: ['Rate / Monat', zT('zaer-rate-now').replace(/^\+/, ''), zT('zaer-rate-ezb').replace(/^\+/, ''), zT('zaer-rate-an').replace(/^\+/, '')] },
            { werte: ['Cashflow / Monat vor Steuern', zT('zaer-cfvst-now'), zT('zaer-cfvst-ezb'), zT('zaer-cfvst-an')] },
            { werte: ['Cashflow / Monat nach Steuern', zT('zaer-cf-now'), zT('zaer-cf-ezb'), zT('zaer-cf-an')] },
            { werte: ['DSCR', zT('zaer-dscr-now'), zT('zaer-dscr-ezb'), zT('zaer-dscr-an')] },
            { werte: ['Veränderung der Rate gegenüber heute', '-', zT('zaer-drate-ezb'), zT('zaer-drate-an')], fett: true }
          ],
          { titel: 'Kennzahlen je Phase' });
      }

      /* v2830 · Rendite und Vermögen je Phase - im Investment-PDF Teil des
         Kennzahlen-Vergleichs (State.phaseTable, calc.js), hier fehlten sie. */
      var PT = S.phaseTable;
      if (PT && PT.now && PT.ezb && PT.an) {
        platz(50);
        abschnitt('Rendite und Vermögen je Phase');
        var ptz = function (f, g) { return [PT.now, PT.ezb, PT.an].map(function (p) { return g(p[f]); }); };
        tabelle(
          [['', 46], [_j1, 26], ['Ende Zinsbindung', 30], ['Anschluss', 26]],
          [
            { werte: ['Bruttomietrendite'].concat(ptz('bmy', function (v) { return pct(v, 2); })) },
            { werte: ['Nettomietrendite'].concat(ptz('nmy', function (v) { return pct(v, 2); })) },
            { werte: ['Beleihungsauslauf (LTV)'].concat(ptz('ltv', function (v) { return pct(v, 1); })) },
            { werte: ['Restschuld'].concat(ptz('rs', function (v) { return eur(v); })) },
            { werte: ['Immobilienwert (angenommen)'].concat(ptz('wert', function (v) { return eur(v); })) },
            { werte: ['Eigenkapital im Objekt'].concat(ptz('eq', function (v) { return eur(v); })), fett: true }
          ],
          { titel: 'Rendite und Vermögen je Phase', hinweis: 'Immobilienwert: fortgeschrieben mit der angenommenen Wertsteigerung, keine Bewertung.' });
      }

      platz(44, 'Zinsänderungsrisiko', 'Was passiert, wenn die Zinsbindung endet');
      abschnitt('Zinsänderungsrisiko');
      zeile('Zinsbindung', bindj !== null ? fmt(bindj) + ' Jahre' : '-');
      zeile('Restschuld am Ende der Zinsbindung', eur(S.rs));
      zeile('Angenommener Anschlusszins / Tilgung', [pct(num('anschl_z'), 2), pct(num('anschl_t'), 2)].join('  ·  '));
      zeile('Rate nach Anschluss / Monat', eur(K.rate_an_m, 2));
      /* v2461 · K.zaer_m ist der MEHRZINS auf die Restschuld (calc.js: rs x
         Zinsdifferenz / 12), nicht die Veränderung der Rate - die steht oben in
         „Kennzahlen je Phase". Gemessen: „Mehrbelastung 346,41 €" neben „+110 €". */
      zeile('Mehrzins auf die Restschuld / Monat (Zinsänderungsrisiko)', eur(K.zaer_m, 2), { summe: true });
      if (da(K.zaer_pct) !== null) zeile('Zinsanstieg gegenüber heute', fmt(K.zaer_pct, 2) + ' Prozentpunkte', { klein: true });
    }

    /* ── Cashflow-Jahre ──────────────────────────────────────── */
    /* v2830 · ALLE Jahre (das Investment-PDF zeigt den ganzen Betrachtungs-
       zeitraum, hier standen nur zehn) und dazu Steuer und Cashflow nach
       Steuern je Jahr - dieselben Felder wie die Projektion in pdf.js. */
    var _bsvJ = rows.some(function (r) { return (r.bspar_y || 0) > 0; });
    platz(52, 'Cashflow-Entwicklung', (adr || 'Objekt') + ' · ' + (rows.length || 0) + ' Jahre');
    abschnitt('Cashflow je Jahr');
    var sp = [['Jahr', 13], ['Kaltmiete', 20], ['Bewirtsch.', 19], ['Zins', 19], [_bsvJ ? 'Bausparr.' : 'Tilgung', 19], ['CF v. St.', 19], ['Steuer', 17], ['CF n. St.', 19], ['Restschuld', 22], ['LTV', 13]];
    var fak = CW / sp.reduce(function (a, s) { return a + s[1]; }, 0);
    function tabZeile(werte, fett, kopfzeile) {
      var x = L;
      doc.setFont('helvetica', (fett || kopfzeile) ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.2 : 7.8);
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
      rows.forEach(function (r) {
        if (y > H - 30) { doc.addPage(); kopf('Cashflow-Entwicklung', 'Fortsetzung'); tabZeile(sp.map(function (s) { return s[0]; }), false, true); }
        /* Steuer: tax_y > 0 ist eine Belastung - gezeigt mit Vorzeichen der Kasse (wie pdf.js) */
        var st = da(r.tax_y) === null ? null : -r.tax_y;
        tabZeile([r.cal || r.y, fmt(r.nkm_y), fmt(r.bwk_cf_y != null ? r.bwk_cf_y : r.bwk_y), fmt(r.zy), fmt(_bsvJ ? r.bspar_y : r.ty), fmt(r.cfop_y),
          st === null ? '-' : (st > 0.5 ? '+' : '') + fmt(st), fmt(r.cfns_y), fmt(r.rs), pct(r.ltv_y, 0)]);
      });
      y += 1;
      absatz('Beträge in Euro je Jahr. CF v. St. = Kaltmiete - Bewirtschaftung - Zins - ' + (_bsvJ ? 'Bausparrate' : 'Tilgung') + '. Steuer: + Erstattung, - Belastung. CF n. St. = CF v. St. + Steuer.', { groesse: 7, farbe: 130, zeile: 3.5, links: true });
      y += 5;
    }

    /* ── Vermögensaufbau ─────────────────────────────────────── */
    /* v2900 · Vermoegensaufbau, Exit und Vermoegenszuwachs im Detail standen an drei
       Stellen (dazu das Diagramm Eigenkapital und Restschuld, dieselbe Kurve). Jetzt
       EIN Abschnitt hier: Kurve, Jahrestabelle, Bausteine, Wertsteigerung, Exit.
       Eigenkapital heute / nach n Jahren stehen als erste und letzte Zeile der
       Tabelle; Wert-Anker und Wertsteigerung p. a. einmal unter Wertsteigerung. */
    if (rows.length > 2) {
      platz(84, 'Vermögensaufbau', (adr || 'Objekt') + ' · Wert, Restschuld und Eigenkapital');
      abschnitt('Vermögensaufbau');
      var jahre = rows.map(function (r) { return r.cal || r.y; });
      kurve([
        { name: 'Objektwert (angenommen)', werte: rows.map(function (r) { return Number(r.wert_y); }), gold: true },
        { name: 'Restschuld', werte: rows.map(function (r) { return Number(r.rs); }) },
        { name: 'Eigenkapital im Objekt', werte: rows.map(function (r) { return Number(r.eq_y); }), grau: true }
      ], jahre, { hoehe: 44 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Der Objektwert ist eine Annahme aus der hinterlegten Wertsteigerung, keine Bewertung nach § 194 BauGB.', L, y - 1);
      y += 6;
      vermoegenDetail();
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
      var spM = [['Nr.', 14], ['Lage', 30], ['m²', 16], ['Ist €/M', 20], ['Soll €/M', 20], ['Status', 20], ['Anlage 2', 22]];   /* v2483: keine RND je Einheit - eine fuer das Haus, unten */
      var fakM = CW / spM.reduce(function (a, s) { return a + s[1]; }, 0);
      function mZeile(werte, kopfzeile) {
        var x = L;
        doc.setFont('helvetica', kopfzeile ? 'bold' : 'normal'); doc.setFontSize(kopfzeile ? 7.4 : 8.4);
        doc.setTextColor(kopfzeile ? 110 : 40);
        /* v2461 · gemessen: „1.134 leer" (Status klebte an der Soll-Miete) und die
           Lage hart nach 18 Zeichen abgeschnitten („EG / OG — Hauptwoh"). */
        werte.forEach(function (w, i) {
          var bw = spM[i][1] * fakM, t = String(w), platzB = bw - (i === 5 ? 4 : 2);
          if (doc.getTextWidth(t) > platzB) { while (t.length > 1 && doc.getTextWidth(t + '...') > platzB) t = t.slice(0, -1); t = t.replace(/[\s,;·-]+$/, '') + '...'; }
          if (i <= 1) doc.text(t, x, y); else if (i === 5) doc.text(t, x + 3, y); else doc.text(t, x + bw - 1, y, { align: 'right' });
          x += bw;
        });
        doc.setDrawColor(kopfzeile ? G[0] : 236, kopfzeile ? G[1] : 232, kopfzeile ? G[2] : 223);
        doc.setLineWidth(kopfzeile ? 0.5 : 0.15); doc.line(L, y + 2.2, W - R, y + 2.2); doc.setLineWidth(0.2);
        y += kopfzeile ? 7 : 6.2;
      }
      mZeile(spM.map(function (s) { return s[0]; }), true);
      MFH.zeilen.forEach(function (z) {
        if (y > H - 30) { doc.addPage(); kopf('Einheiten und Zustand', 'Fortsetzung'); mZeile(spM.map(function (s) { return s[0]; }), true); }
        mZeile([z.e.nr || '', sauber(z.e.lage || ''), z.fl ? fmt(z.fl, 0) : '-',
          (z.e.ist && Number(String(z.e.ist).replace(',', '.')) > 0) ? fmt(Number(String(z.e.ist).replace(',', '.')), 0) : '-',
          z.e.soll ? fmt(Number(String(z.e.soll).replace(',', '.')), 0) : '-',
          z.e.status === 'leer' ? 'leer' : 'vermietet',
          z.punkte + ' P.' + (z.geerbt === 4 ? '*' : '')]);
      });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130);
      doc.text('Anlage 2 ImmoWertV: Modernisierungspunkte je Einheit; * = Zustand vollständig vom Gebäude übernommen. '
        + 'RND: eine für das Gebäude (unten).', L, y + 1);
      y += 10;

      /* v2988 · Block zusammenhalten: gemessen (Parkstr., Bankfassung) wanderte nur der Schlusssatz auf Seite 8,
         die Seite blieb leer. ~9 Zeilen + Satz = 70 mm. */
      platz(70, 'Einheiten und Zustand', 'Fortsetzung');
      abschnitt('Ist gegen Soll');
      var istJ = (K.nkm_j || 0), sollJ = MFH.s.soll * 12;
      zeile('Kaltmiete p. a. - Ist', eur(istJ));
      zeile('Kaltmiete p. a. - Soll (nach Maßnahmen)', eur(sollJ));
      zeile('Bruttomietrendite Ist (auf Kaufpreis)', pct(K.bmy, 2));
      zeile('Bruttomietrendite Soll (auf Gesamtinvestition)', da(K.gi) && K.gi > 0 ? pct(sollJ / K.gi * 100, 2) : '-');
      zeile('Rechtliche Einheit', MFH.aufgeteilt ? 'in Wohnungseigentum aufgeteilt (WEG)' : 'ungeteiltes Gebäude');
      if (MFH.s.leer) zeile('Leerstand', MFH.s.leer + ' Einheiten / ' + fmt(MFH.s.leerFl, 0) + ' m²');
      if (MFH.s.kosten) zeile('Geplante Maßnahmen', eur(MFH.s.kosten));
      /* v2483 · eine RND fuer das Haus: aus den ganzen Punkten des Hauses, dieselbe Zahl wie
         Wertpotenzial, Ertragswert und Marktbericht (DpMfhEinheiten.berichtDaten -> hausRnd) */
      zeile('Modernisierungsgrad (flächengewichtet)', fmt(MFH.punkteGew, 1) + ' von 20 Punkten, angesetzt ' + MFH.hausPunkte + ' Punkte');
      if (MFH.rndGew > 0) zeile('Restnutzungsdauer des Gebäudes (Anlage 2, indikativ)', Math.round(MFH.rndGew) + ' Jahre'
        + (MFH.rndInfo && MFH.rndInfo.gnd ? ' (GND ' + MFH.rndInfo.gnd + ')' : ''), { summe: true });
      var hin = MFH.sollAbJahr
        ? 'Die Cashflow-Rechnung setzt die Soll-Miete ab Jahr ' + MFH.sollAbJahr + ' an; davor und danach gilt die hinterlegte Mietentwicklung.'
        : 'Die Cashflow-Rechnung rechnet durchgehend mit der Ist-Miete - die Soll-Miete ist hier nur nachrichtlich.';
      absatz(hin, { groesse: 7.6, farbe: 130, zeile: 4.2 });
      y += 6;
    }

    }   /* !KURZ Phasen bis Ist/Soll */

    /* ── v2430 · Wertpotenzial (Mieterhöhung und Zielbild) ──────────
       Marcel 19.10.2026: „Der Investor zeigt der Bank das versteckte
       Kapital im Haus." Gerechnet wird NICHT hier: Mieten und Kosten
       stellt DpPotenzial zusammen, die Ertragswerte kommen aus dem
       Marktbericht-Dienst (derselbe Kern wie Stufe 3). Ohne Soll-Miete
       und Zielbild entfällt die Seite. */
    /* Wie sauber(), aber das Euro-Zeichen bleibt (jsPDF-Standardschrift kennt es). */
    function sauberE(t) { return String(t == null ? '' : t).replace(/[\u2013\u2014\u2212\u2011]/g, '-').replace(/[\u00a0\u202f]/g, ' ').replace(/[^\x00-\xFF\u20AC]/g, '').replace(/\s+/g, ' ').trim(); }
    var PZ = window.DpPotenzial || null, PD = null;
    try {
      if (PZ && PZ.modell && PZ.modell().aktiv) {
        await Promise.race([PZ.rechnen(), new Promise(function (f) { setTimeout(f, 40000); })]);
        PD = PZ.pdfDaten();
      }
    } catch (e) { PD = null; }
    /* v2900 · gezeichnet im Abschnitt Wert & Zielbild (unten), zwischen den Werten je
       Verfahren und den Erklaerungen; anschluss=true heisst im Fluss weiter. */
    var pdZeichnen = !PD ? null : function (anschluss) {
      if (anschluss) { platz(60); }
      else { _titel = 'Wertpotenzial'; _unter = (adr || 'Objekt') + ' · Mieterhöhung' + (PD.hat_ziel === false ? '' : ' und Zielbild'); doc.addPage(); kopf(_titel, _unter); }   /* v2530: Fortsetzung trägt denselben Kopf */
      abschnitt('Wertpotenzial');
      einleitung(sauberE(PD.satz_bank));
      if (PD.art === 'mfh' && PD.wohnungen.length) {
        /* v3018d · ohne Zielbild keine Spalten Ziel und Maßnahmen (nur Striche) */
        if (PD.hat_ziel === false) tabelle([['WE', 60, 'l'], ['m²', 14], ['Ist €/M', 28], ['Mieterhöhung', 52, 'w']],
          PD.wohnungen.map(function (w) { return [sauberE(w.we), fmt(w.wfl, 0), sauberE(w.ist), sauberE(w.soll)]; }), { titel: 'Wertpotenzial' });
        else tabelle([['WE', 26, 'l'], ['m²', 10], ['Ist €/M', 16], ['Mieterhöhung', 28, 'w'], ['Ziel €/M', 17], ['Maßnahmen', 57, 'u']],
          PD.wohnungen.map(function (w) {
            return [sauberE(w.we), fmt(w.wfl, 0), sauberE(w.ist), sauberE(w.soll), sauberE(w.ziel), sauberE(w.massnahmen)];
          }), { titel: 'Wertpotenzial' });
      }
      /* v2543 · WERTÜBERLEITUNG statt Wertbrücke (Marcel 20.10.2026: Variante B, Farben der
         Marke) - dieselben Zeilen wie im Tab Bewertung (DpPotenzial.ueberleitungZeilen). Stände als
         Zeilen mit Summenstrich, Veränderungen als Balken um null; keine gekürzte Achse mehr. */
      if (PD.bruecke && PZ.ueberleitungZeilen) {
        var UZ = PZ.ueberleitungZeilen(PD.bruecke), uRh = 7.6;
        platz(14 + UZ.length * uRh + 10, 'Wertpotenzial', (adr || 'Objekt') + ' · Mieterhöhung' + (PD.hat_ziel === false ? '' : ' und Zielbild'));
        abschnitt('Wertüberleitung · Ertragswert je Stufe');
        var uF = { bestand: [42, 39, 39], kosten: [201, 138, 132],
          soll: [Math.round(G[0] + (255 - G[0]) * 0.45), Math.round(G[1] + (255 - G[1]) * 0.45), Math.round(G[2] + (255 - G[2]) * 0.45)],
          ziel: [GD[0], GD[1], GD[2]] };
        var uM = Math.max.apply(null, UZ.filter(function (z) { return z.schritt; }).map(function (z) { return Math.abs(z.w); }).concat([1])) * 1.08;
        var uBx = L + CW * 0.42, uBw = CW * 0.34, uMx = uBx + uBw / 2;
        var uE = function (n, vz) { return (n < 0 ? '- ' : (vz && n > 0 ? '+ ' : '')) + fmt(Math.abs(n), 0) + ' \u20ac'; };
        UZ.forEach(function (z) {
          var y0 = y, f = z.netto ? (z.w >= 0 ? [47, 125, 85] : [184, 98, 92]) : uF[z.art];
          if (z.netto) { doc.setFillColor(251, 246, 233); doc.rect(L, y0 - 1.4, CW, uRh, 'F'); doc.setDrawColor(G[0], G[1], G[2]); doc.setLineWidth(0.5); doc.line(L, y0 - 1.4, W - R, y0 - 1.4); doc.setLineWidth(0.2); }
          else if (z.summe) { doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.35); doc.line(L, y0 - 1.4, W - R, y0 - 1.4); doc.setLineWidth(0.2); }
          if (!z.netto) { doc.setFillColor(f[0], f[1], f[2]); doc.rect(L, y0 + 0.9, 2.2, 2.2, 'F'); }
          var lx = z.netto ? L + 1 : L + 4;
          doc.setFont('helvetica', (z.summe || z.netto) ? 'bold' : 'normal'); doc.setFontSize(8.6); doc.setTextColor(26, 26, 26);
          doc.text(sauberE(z.t), lx, y0 + 2.9);
          if (z.klein) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(120); doc.text(sauberE(z.klein), lx, y0 + 5.6); }
          if (z.schritt) {
            doc.setDrawColor(226, 221, 210); doc.setLineWidth(0.15); doc.line(uMx, y0, uMx, y0 + 4.6); doc.setLineWidth(0.2);
            if (Math.abs(z.w) < 500) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(140); doc.text('unverändert', uMx + 1.5, y0 + 3.2); }
            else { var bw0 = Math.abs(z.w) / uM * (uBw / 2 - 1), bx0 = z.w >= 0 ? uMx : uMx - bw0; doc.setFillColor(f[0], f[1], f[2]); doc.rect(bx0, y0 + 0.6, bw0, 3.4, 'F'); }
          }
          doc.setFont('helvetica', (z.summe || z.netto) ? 'bold' : 'normal'); doc.setFontSize(z.netto ? 9.6 : 8.8);
          if (z.netto) doc.setTextColor(f[0], f[1], f[2]); else doc.setTextColor(26, 26, 26);
          doc.text(uE(z.w, z.schritt), W - R, y0 + 2.9, { align: 'right' });
          if (!z.summe && !z.netto) { doc.setDrawColor(236, 232, 223); doc.setLineWidth(0.15); doc.line(L, y0 + uRh - 1.4, W - R, y0 + uRh - 1.4); doc.setLineWidth(0.2); }
          y += uRh;
        });
        y += 1.5;
        absatz(sauberE('Balken: Veränderung gegen die Zeile darüber, gemeinsame Skala um null. Potenzial netto = Ertragswert ' + (PD.bruecke.zielbild != null ? 'Zielbild' : 'nach Mieterhöhung') + ' minus Bestand minus Maßnahmenkosten.'), { groesse: 7, farbe: 130, zeile: 3.6 });
        y += 2.4;
      }
      var spP = [['Kennzahl', 52, 'l']].concat(PD.spalten.map(function (k) { return [PD.titel[k], 30]; }));
      /* v2530 · Fußnote: lief über den Seitenfuß bis an den Papierrand. Jetzt in
         zwei Absätzen (Aufteilung, dann Kennzeichnung und Grundlagen) über absatz(). */
      var _fu = String(PD.fuss || ''), _au = PD.aufteilung_hinweis ? 'Aufteilung: ' + PD.aufteilung_hinweis + ' ' : '';
      /* v2540 · Tabelle, Kaufpreis und Fußnote bleiben ZUSAMMEN (Marcel 20.10.2026:
         „ja bitte"). Seit v2530 stand die Fortsetzung der Fußnote allein oben auf
         der Folgeseite, getrennt von der Tabelle, die sie erklärt. Passt der Block
         nicht mehr, beginnt er geschlossen auf der nächsten Seite - wie das
         Kennzahlenraster (v1462c). Höhen wie in tabelle()/zeile()/absatz(). */
      (function () {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
        var _zl = function (t) { return t ? doc.splitTextToSize(sauberE(t), CW).length : 0; };
        var _teile = (_au && _fu.indexOf(_au) === 0) ? [_au, _fu.slice(_au.length)] : [_fu];
        var bedarf = 7 + PD.kennzahlen.length * 6.2 + 4 + 6.1 + 1
          + _teile.reduce(function (a, t) { return a + _zl(t) * 3.5; }, 0) + (_teile.length > 1 ? 1.5 : 0);
        if (y + bedarf > TEXT_UNTEN && bedarf < H - 60) { doc.addPage(); kopf(_titel, _unter); }
      })();
      tabelle(spP, PD.kennzahlen.map(function (z, n) { return { werte: z.map(function (x) { return sauberE(String(x)); }), fett: /^Ertragswert|^nach Aufteilung/.test(z[0]) }; }), { titel: 'Wertpotenzial' });
      zeile('Kaufpreis', eur(K.kp));
      y += 1;
      if (_au && _fu.indexOf(_au) === 0) {
        absatz(sauberE(_au), { groesse: 7.2, farbe: 120, zeile: 3.5 }); y += 1.5;
        _fu = _fu.slice(_au.length);
      }
      absatz(sauberE(_fu), { groesse: 7.2, farbe: 120, zeile: 3.5 });
      y += 6;
    };

    /* ── v2830 · Wert & Zielbild ─────────────────────────────────
       Werte je Verfahren aus dem letzten Marktbericht (wie die Pilot-Analyse,
       wertvergleich.js) und Ist / Soll / Zielbild. Ohne Daten entfaellt der
       Abschnitt still (DpPdfWertZielbild). */
    var WZ = null;
    try { if (window.DpPdfWertZielbild) WZ = await window.DpPdfWertZielbild.daten({ potenzial: PD }); } catch (e) { WZ = null; }
    if (WZ) {
      /* v3018d · ohne angelegtes Zielbild heisst die Seite nicht „Wert & Zielbild" */
      var _wzZ = !WZ.ohneZiel;
      _titel = _wzZ ? 'Wert & Zielbild' : (PD ? 'Wert & Potenzial' : 'Wert je Verfahren'); _unter = (adr || 'Objekt') + ' · Werte je Verfahren';
      doc.addPage(); kopf(_titel, _unter);
      einleitung('Was das Objekt nach den Verfahren der Immobilienwertermittlung wert ist, im Vergleich zum Kaufpreis - ' + (_wzZ ? 'und wohin sich der Ertragswert mit Mieterhöhung und Zielbild entwickelt.' : (PD ? 'und wohin sich der Ertragswert mit der Mieterhöhung entwickelt.' : 'auf Basis der Miete im Bestand.')));
      /* v2900 · EIN Abschnitt (wie pdf.js): Werte je Verfahren, Wertlandschaft, dann das
         Wertpotenzial, dann Ausblick, Kernaussagen, Erklaerung. Die Tafel Ist/Soll/Zielbild
         entfaellt dort - die Kennzahlen je Stufe fuehren dieselben Werte; die Indikation
         ohne Abschlag kommt als Satz (mpiZeile). Kurzfassung: Tafel statt Wertpotenzial,
         ohne Wertlandschaft und Erklaertexte. */
      var wzO = function (teile) { return {
        teile: teile,
        x: L, y: y, breite: CW, unten: TEXT_UNTEN, stil: 'bank',
        neueSeite: function () { doc.addPage(); kopf(_titel, 'Fortsetzung'); return y; },
        ueberschrift: function (t, yy) { y = yy; abschnitt(t); return y; },
        f: { gold: G, goldD: GD, goldL: [Math.round(G[0] + (255 - G[0]) * 0.62), Math.round(G[1] + (255 - G[1]) * 0.62), Math.round(G[2] + (255 - G[2]) * 0.62)],
          tinte: [26, 26, 26], text: [60, 60, 60], grau: [130, 130, 130], linie: [236, 232, 223] }
      }; };
      if (KURZ) y = window.DpPdfWertZielbild.zeichne(doc, WZ, wzO(['verfahren', 'stufen', 'stufenText', 'kern', 'hinweis']));
      else if (pdZeichnen) {
        y = window.DpPdfWertZielbild.zeichne(doc, WZ, wzO(['verfahren', 'landschaft']));
        pdZeichnen(true);
        WZ.hinweis = 'Marktpreisindikation, Ertrags- und Sachwert sind indikativ nach ImmoWertV-Logik, kein Gutachten nach § 194 BauGB.';
        y = window.DpPdfWertZielbild.zeichne(doc, WZ, wzO(['mpiZeile', 'stufenText', 'kern', 'texte', 'hinweis']));
      } else y = window.DpPdfWertZielbild.zeichne(doc, WZ, wzO(null));
      y += 4;
    } else if (pdZeichnen && !KURZ) pdZeichnen(false);
    /* v2900b · Kurzfassung: Annahmen und Hinweise unter Wert & Zielbild (dort ist Platz), die Pilot-Analyse folgt auf eigener Seite */
    if (KURZ) annahmenHinweise();

    /* ── Exit und Vermögenszuwachs ───────────────────────────── */
    var letzteZeile = rows.length ? rows[rows.length - 1] : null;
    if (!KURZ && rows.length <= 2 && (da(K.exit_vkp) !== null || da(S.wert_basis) !== null)) {
      platz(52, 'Exit und Vermögenszuwachs', (adr || 'Objekt'));
      abschnitt('Exit und Vermögenszuwachs');
      zeile('Objektwert heute (Anker der Wertsteigerung)', eur(S.wert_basis));
      zeile('Angenommene Wertsteigerung p. a.', num('wertstg') !== null ? pct(num('wertstg'), 1) : '-');
      zeile('Angenommener Verkaufspreis' + (S.btj ? ' nach ' + fmt(S.btj) + ' Jahren' : ''), eur(K.exit_vkp));
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
    /* v2900 · die Eigenkapital-Kurve zeigt der Abschnitt Vermoegensaufbau schon */
    if (rows.length > 2) DIA = DIA.filter(function (d) { return d[0] !== 'bc-equity'; });
    if (KURZ) DIA = [];
    var diagramme = [];
    for (var di = 0; di < DIA.length; di++) {
      var bd = await svgBild(DIA[di][0]);
      if (bd) diagramme.push({ bild: bd, titel: DIA[di][1] });
    }
    if (diagramme.length) {
      platz(64, 'Diagramme', (adr || 'Objekt') + ' · aus der Bankansicht');
      abschnitt('Diagramme');
      /* v1733 · VOLLE BREITE STATT ZWEI SPALTEN.
         Zwei Spalten ergaben 87 mm je Diagramm - eine 10,5er Beschriftung
         auf viewBox-Breite 1200 landete damit bei 1,5 pt. Über die ganzen
         174 mm sind es 4,3 pt, und mit dem Schriftfaktor aus `svgBild`
         rund 6,7 pt. Erst damit ist die Zeichnung eine Aussage und nicht
         nur ein Muster.

         Hier standen ausserdem zwei Zeilen, die nichts taten:
           if (i % 2 === 0 && i > 0) y += 0;        // addiert null
           var yy = y + (sp === 0 ? 0 : 0);         // beide Zweige null
         Sie sind mit dem Spaltenlayout weggefallen. */
      var dw = CW;
      diagramme.forEach(function (d) {
        var dh = dw * d.bild.h / d.bild.w, dbw = dw;
        /* Deckel, damit vier Diagramme nicht vier Seiten fuellen. `bild()`
           setzt proportional ein, also wird die BREITE mitgezogen - sonst
           bliebe im Rahmen wieder Luft. */
        if (dh > 74) { dbw = dw * 74 / dh; dh = 74; }
        /* v2830 · Aussage und Kennzahlen der Karte (wie im Investment-PDF):
           die Ueberschrift der Karte als Satz, darunter ihre Fusskacheln. */
        var K2 = karte(d.bild.id);
        platz(dh + 15 + (K2 && K2.fuss.length ? 22 : 0) + (K2 && K2.titel ? 5 : 0));
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(110);
        doc.text(d.titel, L, y + 3.8);
        var _dy = 0;
        if (K2 && K2.titel) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(40); doc.text(doc.splitTextToSize(K2.titel, CW)[0], L, y + 8.2); _dy = 4.6; }
        bild(d.bild, L + (dw - dbw) / 2, y + 5.8 + _dy, dbw, dh);
        y += dh + 9 + _dy;
        if (K2 && K2.fuss.length) kachelReihe(K2.fuss);
        y += 4;
      });
      y += 2;
    }

    /* v2830 · Bank-Cockpit: DSCR und LTV im Verlauf. Das Investment-PDF zeichnet
       es nativ aus BankCharts._lastCockpitData (die SVG-Fassung ist nur ein
       Balken ohne Beschriftung, v1733) - hier dieselben Reihen als Kurven. */
    if (!KURZ) cockpitVerlauf(false);
    function cockpitVerlauf(kurz) {
      /* immer frisch rechnen lassen - _lastCockpitData kann vom vorigen Objekt stammen */
      var CD = null;
      if (window.BankCharts && typeof window.BankCharts.renderBankCockpit === 'function') {
        var tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:640px;height:340px';
        document.body.appendChild(tmp);
        try { window.BankCharts.renderBankCockpit(tmp, window.State); } catch (e) {}
        tmp.remove();
        CD = window.BankCharts._lastCockpitData;
      }
      if (!CD || !CD.dscrArr || !CD.ltvArr || CD.dscrArr.length < 2) return;
      var jj = CD.years || rows.map(function (r) { return r.cal || r.y; });
      var sw = window.DealPilotSchwellen ? DealPilotSchwellen.get() : { dscrGruen: 1.2, dscrGelb: 1.0 };
      var dez = function (v, n) { return Number(v).toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n }); };
      var kh = kurz ? 18 : 34;
      platz(kurz ? 80 : 150, 'Bank-Cockpit', (adr || 'Objekt') + ' · DSCR und LTV im Verlauf');
      abschnitt(kurz ? 'DSCR und LTV im Verlauf' : 'Schuldendienstdeckung (DSCR) im Verlauf');
      /* v2900 · CD.dscrToday = State.kpis.dscr, das erste volle Jahr */
      if (!kurz) kachelReihe([['DSCR Jahr 1', dez(CD.dscrToday, 2), 'erstes volles Jahr'], ['DSCR Ende Zinsbindung', dez(CD.dscrEzb, 2), CD.bindj ? 'Jahr ' + CD.bindj : ''], ['DSCR Ende', dez(CD.dscrEnd, 2), 'Betrachtungsende']]);
      y += 3;
      kurve([{ name: 'DSCR', werte: CD.dscrArr.map(Number), gold: true }], jj,
        { hoehe: kh, min: 0, fmt: function (v) { return dez(v, 2); }, schwellen: [
          { wert: sw.dscrGruen, text: 'solide ab ' + dez(sw.dscrGruen, 2), farbe: [63, 165, 108] },
          { wert: sw.dscrGelb, text: 'Deckung ' + dez(sw.dscrGelb, 2), farbe: [184, 98, 92] }] });
      platz(kurz ? 36 : 70);
      if (!kurz) abschnitt('Beleihungsauslauf (LTV) im Verlauf');
      if (!kurz) kachelReihe([['LTV heute', pct(CD.ltvToday, 1), ''], ['LTV Ende Zinsbindung', pct(CD.ltvEzb, 1), CD.bindj ? 'Jahr ' + CD.bindj : ''], ['LTV Ende', pct(CD.ltvEnd, 1), 'Betrachtungsende']]);
      if (!kurz) y += 3;
      kurve([{ name: 'LTV in %', werte: CD.ltvArr.map(Number) }], jj,
        { hoehe: kh, min: 0, fmt: function (v) { return dez(v, 0) + ' %'; } });
    }

    /* ── KI-Analyse, wenn vorhanden ──────────────────────────── */
    var ai = window._aiAnalysis || null, aiText = window._aiText || '';
    /* v2900 · der Haken „Pilot-Analyse im PDF-Export einschließen" gilt fuer ALLE
       Fassungen (bis v2892 las ihn nur das Investment-PDF). Vorgabe aus den
       Einstellungen (pdf-wahl.js, user_settings pdf_vorgabe). */
    var pilotAn = true;
    try { if (window.DealPilotPdfWahl && typeof window.DealPilotPdfWahl.pilotAn === 'function') pilotAn = window.DealPilotPdfWahl.pilotAn(); } catch (e) { pilotAn = true; }
    if ((ai || aiText) && pilotAn) {
      /* v2900c · nicht immer neue Seite: gemessen standen die Annahmen sonst allein auf S. 4 */
      if (KURZ) platz(120, 'Pilot-Analyse', (adr || 'Objekt') + ' · Kurzfassung');
      platz(60, 'Pilot-Analyse', (adr || 'Objekt'));
      abschnitt('Pilot-Analyse');   /* v2555a: Produktname statt KI-Investment-Analyse */
      /* v2830 · die Abschnitte der Pilot-Analyse wie im Investment-PDF
         (pdf.js _renderAiJsonInPdf), mit denselben Haken „Bausteine im PDF"
         (_dpPdfSectionOn). Bisher standen hier nur Empfehlung, Offerte,
         Stärken und Risiken - Gesamtbewertung und Bankargumente fehlten in
         der Fassung, die an die Bank geht. */
      var an = function (t) { try { return typeof window._dpPdfSectionOn !== 'function' || window._dpPdfSectionOn(t); } catch (e) { return true; } };
      var klar = function (t) {
        var s = String(t == null ? '' : t);
        try { if (typeof window._dpOhnePortal === 'function') s = window._dpOhnePortal(s); } catch (e) {}   /* v2947 (N78.3) · kein Portalname im PDF */
        return sauber(s.replace(/\*+/g, ''));
      };
      function kopfzeile(t) {
        if (y > TEXT_UNTEN - 14) { doc.addPage(); kopf(_titel, _unter || 'Fortsetzung'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8); doc.setTextColor(26, 26, 26);
        doc.text(t, L, y); y += 5;
      }
      function block(titel, text) {
        if (!text || !an(titel)) return;
        kopfzeile(titel);
        String(text).split(/\n+/).forEach(function (p) { p = klar(p); if (p) { absatz(p, { groesse: 8.4, farbe: 60, zeile: 4.4 }); y += 1.6; } });
        y += 2;
      }
      function liste(titel, arr) {
        if (!arr || !arr.length || !an(titel)) return;
        kopfzeile(titel);
        /* v2930 · Kurzfassung je zwei Punkte: gemessen an Westerfeld rutschten mit drei
           Punkten je Liste vier Zeilen und der Modellhinweis auf eine fuenfte Seite */
        arr.slice(0, KURZ ? 3 : 8).forEach(function (t) { punkt(klar(t), { groesse: 8.4, farbe: 60, zeile: 4.4 }); });
        y += 2;
      }
      if (ai) {
        /* v3018a · das Gesamturteil steht EINMAL - hier als Zeile „Urteil" am Kopf, am Haken der
           Gesamtbewertung (wie im Investment-PDF, pdf.js); die Begruendung unten ohne Urteilssatz. */
        var _urteilB = ai.empfehlung || ai.recommendation || '';
        if (_urteilB && an('Gesamtbewertung')) zeile('Urteil', sauber(_urteilB).slice(0, 60), { summe: true });
        var offerte = ai.kaufpreis_offerte || ai.offerte || ai.kaufpreisempfehlung, offBeg = null;
        /* v2461 · die KI liefert die Offerte als Objekt {empfohlen, begruendung,
           argumente} - gemessen stand im PDF „[object Object]". */
        if (offerte && typeof offerte === 'object') { offBeg = offerte.begruendung || null; offerte = offerte.empfohlen || offerte.betrag || offerte.wert || null; }
        if (offerte && an('Kaufpreis-Offerte')) zeile('Vorgeschlagene Kaufpreis-Offerte', typeof offerte === 'number' ? eur(offerte) : sauber(offerte).slice(0, 60));
        y += 2;
        if (!KURZ) block('Gesamtbewertung', ai.gesamtbewertung || ai.fazit_kurz);
        liste('Stärken', ai.staerken || ai.strengths);
        liste('Risiken', ai.risiken || ai.schwaechen || ai.risks);
        if (!KURZ && ai.risikoanalyse && typeof ai.risikoanalyse === 'object') {
          var ra = ai.risikoanalyse;
          liste('Risikoanalyse', [ra.finanzierungsrisiko ? 'Finanzierungsrisiko: ' + ra.finanzierungsrisiko : null,
            ra.cashflow_stabilitaet ? 'Cashflow-Stabilität: ' + ra.cashflow_stabilitaet : null,
            ra.annahmen_abhaengigkeit ? 'Abhängigkeit von Annahmen: ' + ra.annahmen_abhaengigkeit : null,
            /* v2900 · die Zahlen stehen in der Belastungsprobe, nicht hier ein zweites Mal */
            'Gerechnete Schuldendeckung je Zins- und Mietszenario: siehe Belastungsprobe.'].filter(Boolean));
        }
        /* v3018 · im Bestand stehen die Bankargumente unter der Anschlussfinanzierung -
           wie im Investment-PDF (pdf.js v2985); die Kurzfassung druckt die Anschluss-
           finanzierung nicht, dort bleiben sie als eigene Liste. */
        var _bestB = false;
        try { _bestB = !!(window.DpBestand && window.DpBestand.istBestand()); } catch (e) { _bestB = false; }
        if (!_bestB || KURZ) liste('Bankargumente', ai.bankargumente);
        /* v2988 · seit v2985 sind anschlussfinanzierung/exit_strategien im Bestand Listen aus {frage, antwort} -
           gemessen stand im Bank-PDF der Parkstr. „[object Object],[object Object],…“ (Seite 15). */
        var _qa = function (v) { if (!Array.isArray(v)) return v; return v.map(function (e) { return e && typeof e === 'object' ? (e.frage ? e.frage + '\n' : '') + (e.antwort || '') : String(e || ''); }).filter(Boolean).join('\n\n'); };
        /* v3018 · im Ankauf steht die Anschlussfinanzierung gerechnet unter „Cashflow je Phase" und
           „Zinsänderungsrisiko" - der KI-Text nannte dazu eigene, abweichende Zahlen. Im Bestand bleibt er. */
        var _gedecktB = !_bestB && typeof window._dpPdfGedeckt === 'function' && window._dpPdfGedeckt('Anschlussfinanzierung (Ankauf)', _std);
        if (!KURZ && !_gedecktB) block('Anschlussfinanzierung', [_qa(ai.anschlussfinanzierung),
          _bestB && ai.bankargumente && ai.bankargumente.length ? 'Argumente für die Bank:\n' + ai.bankargumente.map(function (x) { return '- ' + x; }).join('\n') : ''].filter(Boolean).join('\n'));
        if (!KURZ && ai.exit_strategien) block('Exit-Strategien', _qa(ai.exit_strategien));
        if (!KURZ) (function () {
          var t = [];
          if (ai.makrolage_recherche) t.push('Makrolage: ' + ai.makrolage_recherche);
          if (ai.mikrolage_recherche) t.push('Mikrolage: ' + ai.mikrolage_recherche);
          if (ai.kaufpreisniveau) t.push('Kaufpreisniveau: ' + ai.kaufpreisniveau);
          block('Lage & Markt', t.join('\n'));
        })();
        if (offBeg && !KURZ) block('Kaufpreis-Offerte', offBeg);
        if (ai.empfehlung_begruendung && !KURZ) block('Begründung des Urteils', typeof window._dpOhneUrteil === 'function' ? window._dpOhneUrteil(ai.empfehlung_begruendung, _urteilB) : ai.empfehlung_begruendung);   /* v3018a */
        if (ai.fazit || ai.summary) {
          var _fz = klar(ai.fazit || ai.summary);
          if (KURZ && _fz.length > 600) { var _ende = _fz.slice(0, 600).lastIndexOf('. '); _fz = _ende > 200 ? _fz.slice(0, _ende + 1) : _fz.slice(0, 600) + ' ...'; }
          absatz(_fz, { groesse: 8.4, farbe: 60, zeile: 4.4 });   /* v2530 */
        }
      } else {
        absatz(String(aiText).replace(/\s+/g, ' ').slice(0, KURZ ? 900 : 2400), { groesse: 8.4, farbe: 60, zeile: 4.4 });   /* v2530 */
      }
      y += 1;
      absatz('Erzeugt von einem Sprachmodell aus den erfassten Angaben - eine Einschätzung, keine Beratung.', { groesse: 7, farbe: 130, zeile: 6 });   /* v2530 */
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
    var SM = KURZ ? null : stressDaten();
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
      /* v1470b: die Matrix rechnet seit v1465 auf dem ersten VOLLEN Jahr -
         der Ausgangswert kann daher leicht vom DSCR von heute abweichen
         (gemessen 0,85 gegen 0,84). Das steht jetzt dabei. */
      /* v2240 · die Legende nennt die eingestellten Schwellen (DealPilotSchwellen) */
      var _swL = window.DealPilotSchwellen ? DealPilotSchwellen.get() : { dscrGruen: 1.2, dscrGelb: 1.0 };
      var _gT = _swL.dscrGruen.toFixed(2).replace(/0$/, '').replace('.', ','), _yT = _swL.dscrGelb.toFixed(2).replace(/0$/, '').replace('.', ',');
      doc.text('Grün ab ' + _gT + ' · Gelb ' + _yT + ' bis ' + _gT + ' · Rot unter ' + _yT + '. Der golden umrandete Wert ist der Ausgangsfall, gerechnet auf dem ersten vollen Jahr.', L, y + 2);
      y += 8;
    }

    /* ── Vermögenszuwachs im Detail ──────────────────────────── */
    /* v2900 · gerufen aus dem Abschnitt Vermoegensaufbau (eine Stelle statt drei) */
    function vermoegenDetail() {
      platz(60, 'Vermögenszuwachs im Detail', (adr || 'Objekt'));
      abschnitt('Vermögenszuwachs im Detail');
      var ekStart = da(rows[0].eq_y) !== null ? rows[0].eq_y : 0;
      tabelle(
        [['Jahr', 18], ['Immobilienwert', 30], ['Restschuld', 28], ['Eigenkapital im Objekt', 34], ['Zuwachs gegenüber heute', 34]],
        rows.filter(function (r, i) { return rows.length <= 12 || i % 2 === 0 || i === rows.length - 1; }).map(function (r) {
          return { werte: [r.cal || r.y, eur(r.wert_y), eur(r.rs), eur(r.eq_y), eur((r.eq_y || 0) - ekStart)] };
        }),
        { titel: 'Vermögenszuwachs im Detail', hinweis: 'Eigenkapital im Objekt = angenommener Wert minus Restschuld. Der Wert ist eine Annahme, keine Bewertung.' });

      /* v2830 · woraus der Zuwachs besteht - dieselben vier Bausteine wie im
         Investment-PDF (State._vz, calc.js) und die kumulierten Jahreswerte
         (Summen der Zeilen oben, nichts neu gerechnet). */
      var VZ = S._vz || {};
      if (da(VZ.verm_zuwachs) !== null) {
        var nJ = rows.length;
        platz(46, 'Vermögenszuwachs im Detail', (adr || 'Objekt'));
        abschnitt('Woraus der Vermögenszuwachs besteht (' + nJ + ' Jahre)');
        zeile('Tilgung aus den Mieteinnahmen (Schuldenabbau)', eur(VZ.tilg_durch_einnahmen));
        zeile('Cashflow-Überschuss nach Tilgung, vor Steuern', eur(VZ.cf_ueberschuss_konto));   /* v2832 */
        zeile((VZ.steuervorteil || 0) < 0 ? 'Steuerlast (kumuliert)' : 'Steuervorteil (kumuliert)', eur(VZ.steuervorteil));
        zeile('Wertsteigerung (Annahme ' + (num('wertstg') !== null ? pct(num('wertstg'), 1) : '-') + ' p. a.)', eur(VZ.wertsteig_kum));
        zeile('Vermögenszuwachs gesamt', eur(VZ.verm_zuwachs), { summe: true });
        var sm = function (f) { return rows.reduce(function (a, r) { return a + (Number(r[f]) || 0); }, 0); };
        platz(52);
        abschnitt('Wie der Cashflow-Überschuss entsteht');
        zeile('Kumulierte Mieteinnahmen (Kaltmiete)', eur(sm('nkm_y')));
        zeile('abzüglich Bewirtschaftung (nicht umlagefähig)', '- ' + eur(sm('bwk_cf_y')), { einzug: true });
        zeile('abzüglich Zinsen', '- ' + eur(sm('zy')), { einzug: true });
        zeile('abzüglich Tilgung', '- ' + eur(sm('ty')), { einzug: true });
        if (sm('bspar_y') > 0) zeile('abzüglich Bausparraten', '- ' + eur(sm('bspar_y')), { einzug: true });
        /* v2832 · vor Steuern - die Steuer ist der eigene Baustein darueber */
        zeile('Cashflow-Überschuss nach Tilgung, vor Steuern', eur(VZ.cf_ueberschuss_konto), { summe: true });
        if (da(S.wert_basis) !== null && rows.length) {
          platz(34);
          abschnitt('Wie die Wertsteigerung angesetzt ist');
          zeile('Wert-Anker heute', eur(S.wert_basis));
          zeile('Angenommene Wertsteigerung p. a.', num('wertstg') !== null ? pct(num('wertstg'), 1) : '-');
          /* Wert-Anker + kumulierte Wertsteigerung (State._vz) - wie pdf.js; die letzte
             Jahreszeile traegt den Wert am ANFANG des letzten Jahres (gemessen 826.012
             gegen 842.532 €) und passte deshalb nicht zur Summe darunter. */
          zeile('Angenommener Wert nach ' + nJ + ' Jahren', eur(da(VZ.wertsteig_kum) !== null ? S.wert_basis + VZ.wertsteig_kum : null));
          zeile('Wertsteigerung', eur(VZ.wertsteig_kum), { summe: true });
        }
      }
      /* v2900 · Exit (stand als eigener Abschnitt vor den Diagrammen) */
      if (da(K.exit_vkp) !== null) {
        var lz = rows[rows.length - 1];
        platz(34);
        abschnitt('Exit');
        zeile('Angenommener Verkaufspreis' + (S.btj ? ' nach ' + fmt(S.btj) + ' Jahren' : ''), eur(K.exit_vkp));
        if (lz) zeile('Restschuld zum Verkaufszeitpunkt', eur(lz.rs));
        if (lz) zeile('Möglicher Erlös nach Ablösung', eur(K.exit_vkp - Math.max(0, lz.rs || 0)), { summe: true });
        if (num('exit_bmy') !== null) zeile('Unterstellte Exit-Rendite (Verkaufsszenario)', pct(num('exit_bmy'), 1), { klein: true });
        y += 1;
      }
    }

    /* MARKER_V1468 · Fehlen Diagramme, Vermoegensaufbau und Belastungsprobe,
       steht hier WARUM. Gemessen am 20.09.2026 an Objekt 2026-1004: dort ist
       ein Privat-Ende zum 01.01.2026 gesetzt, calc.js kappt den Betrachtungs-
       zeitraum auf ein Jahr (v816-CUT) - die Bankdiagramme brauchen aber
       mindestens zwei Jahresreihen. Ohne Hinweis sieht das aus wie ein Fehler. */
    if (!KURZ && (rows.length < 2 || (!diagramme.length && !SM))) {
      platz(26);
      abschnitt('Was in dieser Fassung fehlt');
      var gruende = [];
      if (rows.length < 2) gruende.push('Die Projektion endet nach ' + (rows.length || 0) + ' Jahr' + (rows.length === 1 ? '' : 'en') + '. Vermögensaufbau, Diagramme und Belastungsprobe brauchen mindestens zwei Jahresreihen.');
      if (rows.length < 2 && txt('ueberf_ende') && txt('obj_herkunft') !== 'ueberfuehrung') gruende.push('Grund ist das gesetzte Privat-Ende zum ' + sauber(txt('ueberf_ende')) + ' - ab dann rechnet die Gesellschaft weiter.');
      if (rows.length >= 2 && !diagramme.length) gruende.push('Die Diagramme der Bankansicht ließen sich nicht erzeugen.');
      if (rows.length >= 2 && !SM) gruende.push('Die Belastungsprobe ließ sich nicht erzeugen.');
      gruende.forEach(function (t) {
        absatz(t, { groesse: 8.4, farbe: 70, zeile: 4.4 });   /* v2530 */
        y += 1.5;
      });
      y += 3;
    }

    /* v1470: gemessen - mit 48 mm blieb EINE Annahmen-Zeile allein auf der
       letzten Seite stehen. Der Block braucht rund 70 mm; passt er nicht,
       beginnt er geschlossen auf der naechsten Seite. */
    if (!KURZ) annahmenHinweise();
    function annahmenHinweise() {
    platz(KURZ ? 70 : 70, 'Annahmen und Hinweise', (adr || 'Objekt'));
    abschnitt('Annahmen');
    zeile('Mietentwicklung', typeof window._dpPdfMiete === 'function' ? window._dpPdfMiete().text : (num('mietstg') !== null ? pct(num('mietstg'), 1) : '-'));   /* v2832: der Modus, der rechnet */
    zeile('Kostensteigerung p. a.', num('kostenstg') !== null ? pct(num('kostenstg'), 1) : '-');
    zeile('Wertsteigerung p. a.', num('wertstg') !== null ? pct(num('wertstg'), 1) : '-');
    zeile('Betrachtungszeitraum', S.btj ? fmt(S.btj) + ' Jahre' : '-');
    if (num('leerstand') !== null) zeile('Kalkulierter Leerstand p. a.', pct(num('leerstand'), 1));
    zeile('Anschlusszins / Anschlusstilgung (Annahme)', [pct(num('anschl_z'), 2), pct(num('anschl_t'), 2)].join('  ·  '));
    zeile('Persönlicher Grenzsteuersatz', num('grenz') !== null ? pct(num('grenz'), 2) : '-');
    zeile('Gebäudeanteil am Kaufpreis', num('geb_ant') !== null ? pct(num('geb_ant'), 0) : '-');
    zeile('AfA-Satz Gebäude', num('afa_satz') !== null ? pct(num('afa_satz'), 2) : (txt('afa_satz') || '-'));
    zeile('Grunderwerbsteuer (Land)', num('gest_p') !== null ? pct(num('gest_p'), 2) : '-');
    if (num('exit_bmy') !== null) zeile('Exit-Rendite (Verkaufsszenario)', pct(num('exit_bmy'), 1));
    if (da(S.wert_basis) !== null && S.wert_basis !== kp) zeile('Wert-Anker der Wertsteigerung', (S.wert_basis_text || (num('svwert') ? 'Verkehrswert' : 'Bankbewertung')) + '  ·  ' + eur(S.wert_basis));   /* v2830 */
    if (K.d1IsAussetzung) zeile('Darlehenstyp', 'Tilgungsaussetzung mit Bausparvertrag');
    if (num('bspar_rate')) zeile('Bausparrate / Monat', eur(num('bspar_rate')));
    y += 2;

    if (!KURZ) abschnitt('Grundlagen und Hinweise');
    var hinweis = 'Alle Werte beruhen auf den im Objekt erfassten Angaben und den dort hinterlegten Annahmen '
      + '(Mietentwicklung, Bewirtschaftungskosten, Zins und Tilgung). Sie sind eine Kalkulation, kein '
      + 'Wertgutachten nach § 194 BauGB und keine Anlage- oder Finanzierungsberatung. Der LTV bezieht sich auf '
      + (S.ltv_basis_label || 'die angegebene Bezugsgröße') + '.';
    if (KURZ) hinweis += ' Kurzfassung: die Bankfassung enthält zusätzlich die Bewirtschaftung im Einzelnen, die drei Finanzierungsphasen, den Cashflow je Jahr, die Mieterliste, das Wertpotenzial je Wohnung, die Diagramme, die Belastungsprobe und den Vermögenszuwachs im Detail. Finanzierung, Kennzahlen und Annahmen stehen hier vollständig.';   /* v2940 */
    absatz(hinweis, KURZ ? { groesse: 7.4, farbe: 90, zeile: 3.7 } : { groesse: 8.4, farbe: 60, zeile: 4.4 });   /* v2530 */
    }

    fuss();
    var slug = (adr || 'Objekt').replace(/[^A-Za-z0-9äöüÄÖÜß]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    doc.save((KURZ ? 'Investment_Case_Kurz_' : 'Investment_Case_Bank_') + slug + '_' + heute().split('.').reverse().join('') + '.pdf');
  };
})();
