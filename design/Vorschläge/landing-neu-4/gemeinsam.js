/* ═══════════════════════════════════════════════════════════════════════
   landing-neu-4 · gemeinsam.js · Daten und Bausteine der sechs Varianten
   Vorlage, NICHT eingebaut (20.11.2026). Nichts davon geht ins Netz ausser
   den Verweisen (App, Videothek). Bilder und Videos per relativem Pfad aus
   frontend/landing/assets.

   HERKUNFT DER ZAHLEN
   Hero-Karte        frontend/landing/index.html Z.190-217 (Markup), dp2.js Z.64-70 (Balken
                     98/96/88/60/53, Gewichte 35/25/20/10/10), Ring 87 „Sehr gut“, 180.000 €.
   Zwei Scores       mit den ECHTEN Kernen gerechnet (frontend/js score-tiers.js, dscr-engine.js,
                     deal-kpis.js, dealscore2.js per vm, Profil „Ausgewogen“), am Beispielobjekt aus
                     design/Vorschläge/landing-neu-3/gemeinsam.js Z.10-16:
                       ETW 100 m², Kaufpreis 180.000 €, Kaltmiete 1.300 €/Monat, Nebenkosten 10,5 %,
                       Eigenkapital 30.000 €, Zins 3,6 %, Tilgung 2 %, nicht umlagefähig 1.500 €/Jahr,
                       Zustand gut, Energie D, Mietausfall mittel, Vergleichsmiete 12 €/m²,
                       Marktwert 200.000 €, Leerstand 2,5 %, Instandhaltung 8,5 %, Qualität 5 …
                     Ergebnis DealScore2.compute(): Kategorien 97,75 / 96,28 / 88,06 / 60,29 / 52,50
                     (gerundet 98 / 96 / 88 / 60 / 53 = die Hero-Balken), 24 von 24 Kennzahlen,
                     Score 87 „Sehr gut“, Investment 81 „Gut“ (Anteil 59,3 %), Finanzierung 97
                     „Sehr gut“ (Anteil 40,8 %), Gesamturteil 87 „Sehr gut“, keine DSCR-Grenze
                     (DSCR 1,49), Empfehlung „Kaufen“.
                     Gruppen: Objektrendite 98 · Risiko & Zustand 88 · Lage & Markt 60 ·
                     Potenzial & Preis 53 | Kapitaldienst & Beleihung 96 · Cashflow & EK-Rendite 97.
                     Die 96 aus score-animation-2/rechnung.mjs kam von ERFUNDENEN Unterpunkten
                     (100/98/100/93), der echte Kern liefert 94,34 Cashflow und 100 Cash-on-Cash.
   Datenbasis        frontend/landing/datenumfang.js (gemessen 18.11.2026) und register-stand.js.
   Preise            frontend/landing/index.html #pricing.
   Videos            frontend/landing/assets/videothek (Poster), Titel wie videos.json. Die MP4 liegen
                     nicht im Git, der Knopf führt in die Videothek der Landing.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var L = '../../../frontend/landing/';
  var GRN = '#3FA56C', GOLD = 'var(--wl-c9a84c, #C9A84C)', ROT = '#B8625C';
  var ruhig = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var APP = 'https://app.dealpilot.immo/?register=1';
  function farbe(s) { return s >= 70 ? GRN : s >= 50 ? GOLD : ROT; }
  function stufe(s) { return s >= 85 ? 'Sehr gut' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch'; }
  function fmt(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function ein3(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  var D = {
    L: L, APP: APP,
    karte: { score: 87, stufe: 'Sehr gut', kaufpreis: '180.000 €', kpis: 24, von: 24, tiefe: 100 },
    /* [Name, Gewicht, Punkte, KPIs, Anzahl] wie dp2.js CATS, Risiko 6/6 (echter Kern) */
    balken: [
      ['Rendite', 35, 98, '4/4', 4], ['Finanzierung', 25, 96, '5/5', 5], ['Risiko', 20, 88, '6/6', 6],
      ['Lage & Markt', 10, 60, '5/5', 5], ['Upside / Potenzial', 10, 53, '4/4', 4]
    ],
    inv: {
      key: 'inv', titel: 'Investment-Score', frage: 'Wie gut ist die Immobilie, egal wie sie finanziert wird?', score: 81, anteil: '59,3',
      gruppen: [
        { name: 'Objektrendite', anteil: '32,5', score: 98, n: '2/2', kpis: 'Bruttorendite · Nettorendite' },
        { name: 'Risiko & Zustand', anteil: '33,8', score: 88, n: '6/6', kpis: 'Leerstand · Instandhaltung · Bausubstanz · Energieklasse · Mietausfall-Risiko · Ausstattungsqualität' },
        { name: 'Lage & Markt', anteil: '16,9', score: 60, n: '5/5', kpis: 'Ist-/Marktmiete · Mietwachstum p.a. · Bevölkerung · Nachfrage · Mikrolage' },
        { name: 'Potenzial & Preis', anteil: '16,9', score: 53, n: '4/4', kpis: 'Mietsteigerung-Potenzial · Faktor vs. Markt · Wertsteigerung · Entwicklungsmöglichkeiten' }
      ]
    },
    fin: {
      key: 'fin', titel: 'Finanzierungs-Score', frage: 'Trägt die geplante Finanzierung dieses Objekt?', score: 97, anteil: '40,8',
      gruppen: [
        { name: 'Kapitaldienst & Beleihung', anteil: '61,3', score: 96, n: '5/5', kpis: 'DSCR · LTV · Zinssatz · Tilgung · EK-Bedarf' },
        { name: 'Cashflow & EK-Rendite', anteil: '38,7', score: 97, n: '2/2', kpis: 'Cashflow / Mon. · Cash-on-Cash' }
      ]
    },
    /* Kennzahlen des Beispiels aus DealKpis.compute() */
    kpi: { brutto: '8,67 %', netto: '7,09 %', cashflow: '+387 €', dscr: '1,49', ekr: '15,5 %' },
    /* Exposé: Feld, Wert, Ziel in der Karte (stat oder Balken-Index) */
    expose: {
      titel: 'Ruhige Lage, solide vermietet', art: 'Eigentumswohnung · Beispieldaten', foto: L + 'assets/bild/haus.jpg',
      felder: [
        ['Kaufpreis', '180.000 €', 'kp'], ['Wohnfläche', '100 m²', 3], ['Kaltmiete', '1.300 € / Monat', 0],
        ['Nicht umlagefähig', '1.500 € / Jahr', 0], ['Energieklasse', 'D', 2], ['Zustand', 'gut', 2]
      ],
      eigen: [['Eigenkapital', '30.000 €', 1], ['Zins', '3,6 %', 1], ['Tilgung', '2 %', 1]],
      markt: [['Marktwert', '200.000 €', 4], ['Vergleichsmiete', '12,00 € / m²', 3]]
    },
    etappen: [
      { nr: '01', wer: 'Quick-Check', t: 'Erst prüfen, dann erfassen', bild: 'qc', v: 'ueberblick-1-quick-boarding',
        x: 'Alle Exposés und Dateien auf einmal hineinziehen. DealPilot liest sie aus, holt Marktwert und Miete dazu und zeigt in etwa einer halben Minute die Auswertung: Score, Rendite, Cashflow und ein klares Urteil gegen dein eigenes Ziel, mit dem Kaufpreis, ab dem es passt. Gefällt dir das Objekt, übernimmst du es mit einem Klick.',
        c: ['Alle Dateien auf einmal', 'Urteil gegen dein Ziel', 'Zielkaufpreis', 'Mit einem Klick übernehmen'] },
      { nr: '02', wer: 'Erfassen', t: 'Objekt erfassen', bild: '01-objekt-erfassen.webp', v: 'modul-03-datenaufnahme-vier-wege',
        x: 'Exposé hineinziehen, frei erzählen, ein Inserat übernehmen oder Frage für Frage eingeben. Mehrere Wege lassen sich anhaken und laufen nacheinander. Aus dem Quick-Check übernommen, ist alles schon da, und du ergänzt nur, was fehlt. Wie tief du gehst, wählst du selbst: Einsteiger, Fortgeschritten oder Experte.',
        c: ['Exposé und Dokumente', 'Sprache', 'Inserat übernehmen', 'Geführte Eingabe'] },
      { nr: '03', wer: 'Prüfen', t: 'Rendite und Investor Deal Score', bild: '02-score.webp', v: 'modul-12-bewertung-und-kpis',
        x: 'Bruttomietrendite, Nettomietrendite, Eigenkapitalrendite und Kaufpreisfaktor stehen nach wenigen Angaben fest. Der Score fasst 24 Kennzahlen in fünf Bereichen zusammen: Rendite, Finanzierung, Risiko, Lage und Potenzial. Getrennt nach Investment und Finanzierung steht am Ende eine Zahl von 0 bis 100 mit Stufe und Empfehlung, und du siehst, welche Kennzahl ihn trägt und welche ihn drückt.',
        c: ['Rendite', 'Investment-Score', 'Finanzierungs-Score', 'Empfehlung'] },
      { nr: '04', wer: 'Prüfen', t: 'Unterlagen lesen', bild: '03-unterlagen.webp', v: 'modul-28-unterlagen-einlesen',
        x: 'Mietaufstellung, Grundbuch, WEG-Protokolle und Energieausweis auf einmal hineinziehen. DealPilot erkennt die Art jedes Dokuments, schwärzt Personendaten, wertet alles gemeinsam aus und zeigt mit Fundstelle, was absehbar Geld kostet. Bevor du ein Angebot machst.',
        c: ['Mehrere PDFs auf einmal', 'Personendaten geschwärzt', 'Risiken mit Fundstelle'] },
      { nr: '05', wer: 'Rechnen', t: 'Finanzierung und Cashflow', bild: '04-finanzierung.webp', v: 'modul-08-finanzierung',
        x: 'Den indikativen Zins gibt es täglich aktuell je Zinsbindung und Beleihung. DealPilot zieht von der Miete die Bewirtschaftung, die Zinsen und die Tilgung ab und zeigt den Cashflow im Monat. Ob die Finanzierung trägt, prüft der DSCR, die Beleihung der LTV.',
        c: ['Zins je Zinsbindung', 'Cashflow', 'DSCR', 'LTV'] },
      { nr: '06', wer: 'Rechnen', t: 'Steuer, AfA und Restnutzungsdauer', bild: '05-steuer.webp', v: 'modul-27-steuerverlauf-mit-wendepunkt',
        x: 'Den Gebäudeanteil teilt DealPilot nach der Arbeitshilfe des Bundesfinanzministeriums auf, die Restnutzungsdauer folgt Anlage 2 ImmoWertV. Mit deinem Grenzsteuersatz folgt der Cashflow nach Steuer, und der Steuerverlauf zeigt, wie lange das Objekt Steuern erstattet und ab welchem Jahr es Steuern kostet.',
        c: ['Kaufpreisaufteilung', 'AfA', 'Cashflow nach Steuer', 'Wendepunkt'] },
      { nr: '07', wer: 'Bewerten', t: 'Wertermittlung nach ImmoWertV', bild: '06-wertermittlung.webp', v: 'modul-30-marktbewertung-im-reiter-objekt',
        x: 'Der Marktbericht zeigt Lage, Bodenrichtwert, Zensus und Vergleichspreise und begründet den Wert mit Liegenschaftszinssätzen und Sachwertfaktoren der Gutachterausschüsse. Jede Zahl nennt ihre Herkunft. Fehlt eine amtliche Zahl, wird keine erfunden.',
        c: ['Lage', 'Bodenrichtwert', 'Ertrags- und Sachwert', 'Quellennachweis'] },
      { nr: '08', wer: 'Planen', t: 'Mieterhöhung und Zielbild', bild: '07-zielbild.webp', v: 'modul-26-mieterhoehung-und-zielbild',
        x: 'Wohnung für Wohnung: was der laufende Vertrag hergibt, was nach Mietspiegel und Kappungsgrenze verlangbar ist und was erst nach Umbau oder Mieterwechsel geht. Ankauf, heute, nach Mieterhöhung und Zielbild stehen in einer Tabelle nebeneinander, bis zum Wertzuwachs nach Kosten.',
        c: ['Ankauf', 'Heute', 'Nach Mieterhöhung', 'Zielbild'] },
      { nr: '09', wer: 'Halten', t: 'Vom Ankauf in den Bestand', bild: '08-bestand.webp', v: 'modul-14-ankauf-in-den-bestand',
        x: 'Stellst du ein Objekt auf gewonnen, friert DealPilot den Ankauf ein und vergleicht im Bestand Plan gegen heute, Kennzahl für Kennzahl. Für die Bank entstehen der Investment-Case als PDF, der Track-Record über deinen Bestand und der Bankexport mit 25 Spalten je Objekt.',
        c: ['Ankauf eingefroren', 'Soll gegen Ist', 'Bank-PDF', 'Bankexport'] }
    ],
    videos: [
      { id: 'spot-das-haus-hab-ich', nr: 'Spot', dauer: 91, titel: 'Das Haus hab ich.', satz: 'Vom Exposé bis zum Kauf. Ein Objekt, ein Weg, in 90 Sekunden.', poster: 'dealpilot-spot-das-haus-hab-ich.webp' },
      { id: 'ueberblick-1-quick-boarding', nr: 'Ü1', dauer: 224, titel: 'Quick-Check', satz: 'Vom Exposé zum ersten Urteil in wenigen Minuten.', poster: 'dealpilot-ueberblick-1-quick-boarding.webp' },
      { id: 'ueberblick-2-objekt-bis-investment-pdf', nr: 'Ü2', dauer: 305, titel: 'Vom neuen Objekt zum Investment-PDF', satz: 'Der ganze Weg am Stück, in fünf Minuten.', poster: 'dealpilot-ueberblick-2-objekt-bis-investment-pdf.webp' },
      { id: 'modul-12-bewertung-und-kpis', nr: '12', dauer: 262, titel: 'Bewertung und KPIs', satz: 'Das Gesamturteil, Investment und Finanzierung und jede Kennzahl dahinter.', poster: 'dealpilot-modul-12-bewertung-und-kpis.webp' },
      { id: 'modul-28-unterlagen-einlesen', nr: '28', dauer: 307, titel: 'Alle Unterlagen reinladen', satz: 'Dreizehn PDFs, eine Übernahme. Jeder Wert mit Quelle.', poster: 'dealpilot-modul-28-alle-unterlagen-reinladen.webp' },
      { id: 'modul-08-finanzierung', nr: '08', dauer: 353, titel: 'Finanzierung', satz: 'Wie der Zins entsteht und wo du die Standardwerte setzt.', poster: 'dealpilot-modul-08-finanzierung.webp' },
      { id: 'modul-27-steuerverlauf-mit-wendepunkt', nr: '27', dauer: 436, titel: 'Steuerverlauf mit Wendepunkt', satz: 'Ab wann ein Objekt Steuern kostet. Keine Steuerberatung.', poster: 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.webp' },
      { id: 'modul-26-mieterhoehung-und-zielbild', nr: '26', dauer: 746, titel: 'Mieterhöhung und Zielbild', satz: 'Wohnung für Wohnung, Ist, Soll und Zielbild bis zum Wertpotenzial.', poster: 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.webp' },
      { id: 'modul-14-ankauf-in-den-bestand', nr: '14', dauer: 178, titel: 'Vom Ankauf in den Bestand', satz: 'Gewonnen, eingefroren, verglichen. Plan gegen heute.', poster: 'dealpilot-modul-14-ankauf-in-den-bestand-v3502.webp' },
      { id: 'modul-19-das-bank-pdf', nr: '19', dauer: 254, titel: 'Das Bank-PDF', satz: 'Ein Investment Case, den die Bank nicht erst übersetzen muss.', poster: 'dealpilot-modul-19-das-bank-pdf.webp' },
      { id: 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', nr: 'Ü3', dauer: 2637, titel: 'Komplettbeispiel Mehrfamilienhaus', satz: 'Ein Haus, zehn Kapitel, vom leeren Objekt bis zum PDF für die Bank.', poster: 'dealpilot-ueberblick-3-komplettbeispiel-mehrfamilienhaus.webp' }
    ],
    /* datenumfang.js · kopf, gemessen 18.11.2026 */
    umfang: { gesamt: 1100360, schnittstellen: 36, register: 6187, ausschuesse: 201, portale: 109, saetze: 18318, pruef: 84, videos: 40, stunden: '3,7' },
    /* [Titel, Takt, live?, Zahl, Einheit, Erklärung] · datenumfang.js teile/kopf/takte */
    quellen: [
      ['Je Bericht abgefragt', 'live je Bericht', 1, 10, 'Bodenrichtwert-Dienste', 'Für jeden Bericht holt DealPilot den Bodenrichtwert und die Zone frisch aus den amtlichen Diensten der Länder und des Bundes, für alle 16 Länder.'],
      ['Gutachterausschüsse', 'Jan. bis Juni wöchentlich', 0, 6187, 'Werte', 'Liegenschaftszinssätze, Sachwertfaktoren, Vergleichsfaktoren und Umrechnungskoeffizienten von 201 Ausschüssen. Jeder Wert mit Jahrgang und Fundstelle.'],
      ['Zensus 2022', 'Stichtag 15.05.2022', 0, 894880, 'Werte', 'Wohnungen, Gebäude, Leerstand und Mieten bis auf die Gemeinde, in 11.186 Gebieten.'],
      ['Regionaldatenbank', 'monatlich', 0, 108676, 'Werte', 'Bevölkerung, Einkommen, Arbeitsmarkt und Wanderung je Kreis und Gemeinde. Die Grundlage der Lageeinschätzung.'],
      ['Bautätigkeit und Bauland', 'monatlich', 0, 56128, 'Werte', 'Baugenehmigungen, Fertigstellungen und Kaufwerte für Bauland aus der amtlichen Statistik.'],
      ['Obere Gutachterausschüsse', 'bundesweit', 0, 28827, 'Werte', 'Preis- und Mietspannen zur Einordnung jedes Objekts.'],
      ['Bauzinsen', 'täglich', 1, 1376, 'Tageswerte', 'Zinsstruktur und Zinsstatistik der Deutschen Bundesbank. Daraus der indikative Zins in jeder Finanzierung.'],
      ['Preisindizes', 'wöchentlich geprüft', 0, 301, 'Indexwerte', 'Verbraucherpreise, Nettokaltmieten und Baupreisindex des Statistischen Bundesamts, damit jede Zahl zum Stichtag passt.']
    ],
    preise: [
      { name: 'Free', klasse: 'Economy', tag: 'Einstieg · Testflug', st: '★', m: '0', j: null, notiz: '4 Wochen Pro, keine Kreditkarte', kont: '4 Wochen Pro, dann 1 / Monat', punkte: ['1 Objekt', '4 Wochen voller Pro-Umfang', 'Co-Pilot: 10 Fragen am Tag'], knopf: 'Kostenlos starten', pass: 'DP-01' },
      { name: 'Starter', klasse: 'Premium Economy', tag: 'Privat-Investor', st: '★★', m: '19,99', j: '219', kont: '5 Bewertungen / Monat', punkte: ['5 Objekte', 'Investment-PDF ohne Wasserzeichen', 'Co-Pilot: 20 Fragen am Tag'], knopf: 'Starter wählen', pass: 'DP-02' },
      { name: 'Investor', klasse: 'Business', tag: 'Aktiver Investor', st: '★★★', m: '34,99', j: '384', kont: '10 Bewertungen / Monat', punkte: ['25 Objekte', 'Investor Deal Score (24 KPIs)', 'Track-Record-PDF · Bankexport'], knopf: 'Investor wählen', pass: 'DP-03', top: 'Bestseller' },
      { name: 'Pro', klasse: 'First', tag: 'Profi', st: '★★★★', m: '49,99', j: '549', kont: '15 Bewertungen / Monat', punkte: ['Unbegrenzte Objekte', 'Alle Investor-Funktionen', 'API-Zugang'], knopf: 'Pro wählen', pass: 'DP-04' }
    ]
  };

  /* ── Hilfen ─────────────────────────────────────────────────────── */
  function sichtbar(el, fn, schwelle) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, { threshold: schwelle == null ? .2 : schwelle });
    io.observe(el);
  }
  function einblenden(root) {
    $$('[data-rv]', root).forEach(function (el) {
      if (ruhig) { el.classList.add('da'); return; }
      sichtbar(el, function () { setTimeout(function () { el.classList.add('da'); }, +(el.dataset.rvv || 0)); }, .12);
    });
  }
  /* Zahl hochzählen, deutsch formatiert */
  function zaehle(el, ziel, ms, opt) {
    opt = opt || {};
    var von = opt.von || 0, d = opt.d || 0, t0 = null, vor = opt.vor || '', nach = opt.nach || '';
    if (ruhig || !ms) { el.textContent = vor + fmt(ziel, d) + nach; return Promise.resolve(); }
    return new Promise(function (ok) {
      function s(t) {
        if (t0 == null) t0 = t;
        var x = Math.min(1, (t - t0) / ms), v = von + (ziel - von) * ein3(x);
        el.textContent = vor + fmt(d ? v : Math.round(v), d) + nach;
        if (x < 1) requestAnimationFrame(s); else ok();
      }
      requestAnimationFrame(s);
    });
  }
  function anim(el, kf, o) {
    if (!el || ruhig) return Promise.resolve();
    o = Object.assign({ duration: 600, easing: 'cubic-bezier(.2,.72,.2,1)', fill: 'both' }, o || {});
    var a = el.animate(kf, o);
    return a.finished.catch(function () {});
  }
  function scrollFort(el, fn) {
    var tick = false;
    function lauf() {
      tick = false;
      var r = el.getBoundingClientRect(), weg = Math.max(1, r.height - innerHeight);
      fn(clamp(-r.top / weg, 0, 1), r);
    }
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(lauf); } }, { passive: true });
    addEventListener('resize', lauf);
    lauf();
  }

  /* ── QR wie dp2.js (fester Startwert) ───────────────────────────── */
  function qrSvg() {
    var n = 11, cell = 3, svg = '<svg width="33" height="33" viewBox="0 0 33 33" aria-hidden="true">';
    function fp(x, y) {
      return '<rect x="' + x + '" y="' + y + '" width="21" height="21" fill="#0c0b09"/><rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="15" height="15" fill="#fff"/><rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="9" height="9" fill="#0c0b09"/>';
    }
    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if ((x < 7 && y < 7) || (x > 3 && y < 7 && x >= n - 7)) continue;
      if (rnd() > 0.55) svg += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="3" height="3" fill="#0c0b09"/>';
    }
    return svg + fp(0, 0) + fp(12, 0) + '</svg>';
  }

  /* ══ Hero-Karte ═══════════════════════════════════════════════════ */
  function karteHtml() {
    var bars = D.balken.map(function (c, i) {
      var f = farbe(c[2]);
      return '<div class="ids-bar" data-bar="' + i + '"><div class="top"><span class="nm">' + c[0] + '<span class="wt">' + c[1] + '%</span></span>'
        + '<span class="sc" style="color:' + f + '"><span data-sc>' + c[2] + '</span><small>/100</small></span></div>'
        + '<span class="track"><i style="background:' + f + ';width:' + c[2] + '%"></i></span><div class="kp">' + c[3] + ' KPIs</div></div>';
    }).join('');
    return '<div class="idscard" role="img" aria-label="Investor Deal Score 87 von 100, Sehr gut, Kaufpreis 180.000 Euro, 24 von 24 Kennzahlen">'
      + '<div class="ids-band"><span class="l"><i class="dot"></i>Pre-Flight · Investor Deal Score</span><span class="cleared">Cleared</span></div>'
      + '<div class="ids-head"><span class="ids-title">Investor <b>Deal Score</b></span><span class="ids-allkpi">☰ Alle KPIs</span></div>'
      + '<div class="ids-body"><div class="ids-left"><div class="ids-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tr" cx="60" cy="60" r="53"></circle>'
      + '<circle class="pg" cx="60" cy="60" r="53" style="stroke-dashoffset:43.3"></circle></svg><div class="ids-dv"><b data-ring>87</b><small>/&thinsp;100</small></div></div>'
      + '<div class="ids-badge">◆ Sehr gut</div>'
      + '<div class="ids-stats"><div><b data-stat="kp">180.000&nbsp;€</b><span>Kaufpreis</span></div><div><b data-stat="kpi">24/24</b><span>KPIs</span></div><div><b data-stat="tiefe">100&thinsp;%</b><span>Tiefe</span></div></div>'
      + '</div><div class="ids-right"><div class="ids-h">So setzt sich der Score zusammen</div><div>' + bars + '</div></div></div>'
      + '<div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
      + '<div class="ids-foot"><div class="lab">PASSENGER<b>DealPilot Co-Pilot</b></div><div class="lab" style="text-align:center">FLIGHT<b>DP · BOARDING</b></div><div class="ids-qr">' + qrSvg() + '</div></div></div>';
  }
  /* Steuerung einer Karte: leer, einzelne Balken, Ring, alles */
  function karte(host) {
    host.innerHTML = karteHtml();
    var el = host.querySelector('.idscard'), pg = $('.ids-dial .pg', el), zahl = $('[data-ring]', el), kpiN = 0;
    var c = {
      el: el,
      leer: function () {
        pg.style.strokeDashoffset = 333; zahl.textContent = '0'; kpiN = 0;
        $$('.ids-bar', el).forEach(function (b) { $('.track i', b).style.width = '0%'; $('[data-sc]', b).textContent = '0'; });
        $('[data-stat="kp"]', el).innerHTML = '<span style="color:#cfc6b2">0&nbsp;€</span>';
        $('[data-stat="kpi"]', el).textContent = '0/24'; $('[data-stat="tiefe"]', el).innerHTML = '0&thinsp;%';
        $('.ids-badge', el).classList.add('weg');
        var cl = $('.cleared', el); cl.textContent = 'Wartet'; cl.classList.add('wartet');
      },
      stat: function (k) {
        if (k === 'kp') { var b = $('[data-stat="kp"]', el); b.innerHTML = '180.000&nbsp;€'; anim(b, [{ transform: 'scale(1.3)', color: '#b8932f' }, { transform: 'none', color: '#16130d' }], { duration: 600 }); }
      },
      balken: function (i, ms) {
        ms = ms == null ? 900 : ms;
        var b = $$('.ids-bar', el)[i], ziel = D.balken[i][2], tr = $('.track i', b);
        kpiN += D.balken[i][4];
        zaehle($('[data-stat="kpi"]', el), kpiN, ms * .6, { nach: '/24', von: kpiN - D.balken[i][4] });
        var tf = $('[data-stat="tiefe"]', el); tf.innerHTML = Math.round(kpiN / 24 * 100) + '&thinsp;%';
        b.classList.add('trifft'); setTimeout(function () { b.classList.remove('trifft'); }, ms + 200);
        if (ruhig) { tr.style.width = ziel + '%'; $('[data-sc]', b).textContent = ziel; return Promise.resolve(); }
        zaehle($('[data-sc]', b), ziel, ms);
        return anim(tr, [{ width: '0%' }, { width: ziel + '%' }], { duration: ms }).then(function () { tr.style.width = ziel + '%'; });
      },
      ring: function (ms) {
        ms = ms == null ? 1500 : ms;
        var cl = $('.cleared', el);
        var p = anim(pg, [{ strokeDashoffset: 333 }, { strokeDashoffset: 43.3 }], { duration: ms }).then(function () { pg.style.strokeDashoffset = 43.3; });
        zaehle(zahl, 87, ms - 100);
        return p.then(function () {
          $('.ids-badge', el).classList.remove('weg'); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
          anim(cl, [{ transform: 'scale(1.4)' }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        });
      },
      /* wie die Landing: Ring 1,5 s, Balken gestaffelt */
      alles: function () {
        c.leer(); $('[data-stat="kp"]', el).innerHTML = '180.000&nbsp;€';
        var p = [c.ring(1600)];
        D.balken.forEach(function (x, i) { p.push(warte(200 + i * 130).then(function () { return c.balken(i, 1000); })); });
        return Promise.all(p);
      },
      fertig: function () {
        pg.style.strokeDashoffset = 43.3; zahl.textContent = '87';
        $$('.ids-bar', el).forEach(function (b, i) { $('.track i', b).style.width = D.balken[i][2] + '%'; $('[data-sc]', b).textContent = D.balken[i][2]; });
        $('[data-stat="kp"]', el).innerHTML = '180.000&nbsp;€'; $('[data-stat="kpi"]', el).textContent = '24/24'; $('[data-stat="tiefe"]', el).innerHTML = '100&thinsp;%';
        $('.ids-badge', el).classList.remove('weg'); var cl = $('.cleared', el); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
      },
      ziel: function (k) { return k === 'kp' ? $('[data-stat="kp"]', el) : k === 'ring' ? $('.ids-dial', el) : $('.track', $$('.ids-bar', el)[k]); }
    };
    return c;
  }

  /* ══ Exposé, dessen Werte in die Karte fliegen (Idee 09) ═══════════ */
  function exposeHtml(opt) {
    opt = opt || {};
    var E = D.expose;
    function f(x, gruppe) { return '<div class="f" data-ziel="' + x[2] + '" data-g="' + gruppe + '"><span>' + x[0] + '</span><b data-wert="' + x[1] + '">' + x[1] + '</b></div>'; }
    return '<div class="expose" aria-label="Beispiel-Exposé: Kaufpreis 180.000 Euro, 100 Quadratmeter, Kaltmiete 1.300 Euro im Monat">'
      + '<div class="ex-k"><span>EXPOSÉ</span><span>ANGEBOT</span></div>'
      + '<div class="foto" style="background-image:url(' + E.foto + ')"></div>'
      + '<h4>' + E.titel + '</h4><div class="ort">' + E.art + '</div>'
      + '<div class="tab">' + E.felder.map(function (x) { return f(x, 'expose'); }).join('') + '</div>'
      + (opt.ohneEigen ? '' : '<div class="eigen"><div class="ek">DEINE FINANZIERUNG</div><div class="tab">' + E.eigen.map(function (x) { return f(x, 'eigen'); }).join('') + '</div></div>')
      + '<div class="eigen"><div class="ek">HOLT DEALPILOT DAZU</div><div class="tab">' + E.markt.map(function (x) { return f(x, 'markt'); }).join('') + '</div></div>'
      + '<div class="stempel">GELESEN</div></div>';
  }
  function fliege(von, nach, html, ms, hub) {
    if (!von || !nach || ruhig) return Promise.resolve();
    var a = von.getBoundingClientRect(), b = nach.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    var chip = document.createElement('div'); chip.className = 'flugchip'; chip.innerHTML = html;
    document.body.appendChild(chip);
    var w = chip.offsetWidth, h = chip.offsetHeight;
    var x0 = a.left + scrollX + a.width / 2 - w / 2, y0 = a.top + scrollY + a.height / 2 - h / 2;
    var x1 = b.left + scrollX + Math.min(b.width / 2, 60) - w / 2, y1 = b.top + scrollY + b.height / 2 - h / 2;
    var rand = document.documentElement.clientWidth - w - 8;
    x0 = clamp(x0, 8, rand); x1 = clamp(x1, 8, rand);
    chip.style.left = x0 + 'px'; chip.style.top = y0 + 'px';
    var dx = x1 - x0, dy = y1 - y0, hb = hub == null ? -80 : hub;
    return anim(chip, [
      { transform: 'translate(0,0) scale(.7)', opacity: 0 },
      { transform: 'translate(0,-10px) scale(1.08)', opacity: 1, offset: .12 },
      { transform: 'translate(' + (dx * .5) + 'px,' + (dy * .5 + hb) + 'px) scale(1) rotate(' + (dx > 0 ? 4 : -4) + 'deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.55)', opacity: 0 }
    ], { duration: ms || 950, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).then(function () { chip.remove(); });
  }
  /* Ablauf: Felder tippen sich ein, Stempel, Werte fliegen gruppenweise in die Karte, Ring.
     Gibt eine Promise zurück. lauf() verwirft einen laufenden Durchgang. */
  function exposeFlug(exEl, k, opt) {
    opt = opt || {};
    var nr = (exEl._lauf = (exEl._lauf || 0) + 1);
    function lebt() { return exEl._lauf === nr; }
    var felder = $$('.f', exEl), st = $('.stempel', exEl);
    if (ruhig) { k.fertig(); st.classList.add('an'); return Promise.resolve(); }
    k.leer(); st.classList.remove('an');
    felder.forEach(function (f) { var b = $('b', f); b.textContent = b.dataset.wert; b.classList.add('leer'); f.classList.remove('quelle'); });
    /* Felder tippen sich überlappend ein, jedes 110 ms nach dem vorigen */
    var tippen = Promise.all(felder.map(function (f, i) {
      return warte(i * (opt.abstand || 110)).then(function () {
        if (!lebt()) return;
        var b = $('b', f), t = b.dataset.wert; b.classList.remove('leer'); b.classList.add('tippt'); b.textContent = '';
        return new Promise(function (ok) {
          var n = 0, iv = setInterval(function () {
            n++; b.textContent = t.slice(0, n);
            if (n >= t.length || !lebt()) { clearInterval(iv); b.textContent = t; b.classList.remove('tippt'); ok(); }
          }, opt.tippen || 26);
        });
      });
    }));
    var reihen = [['kp'], [0], [1], [2], [3], [4]];
    return tippen.then(function () { if (!lebt()) return; st.classList.add('an'); return warte(350); }).then(function () {
      var kette = Promise.resolve();
      reihen.forEach(function (r, ri) {
        kette = kette.then(function () {
          if (!lebt()) return;
          var ziel = r[0], quellen = felder.filter(function (f) { return f.dataset.ziel === String(ziel); });
          quellen.forEach(function (f) { f.classList.add('quelle'); });
          var flug = quellen.map(function (f, i) {
            return warte(i * 110).then(function () {
              return fliege($('b', f), k.ziel(ziel), '<small>' + $('span', f).textContent + '</small>' + $('b', f).textContent, opt.flug || 820, opt.hub);
            });
          });
          return Promise.all(flug).then(function () {
            quellen.forEach(function (f) { f.classList.remove('quelle'); });
            if (ziel === 'kp') { k.stat('kp'); return warte(120); }
            k.balken(ziel, 800); return warte(opt.pause || 90);
          });
        });
      });
      return kette;
    }).then(function () { if (lebt()) return k.ring(1400); });
  }

  /* ══ Zwei Scores · Gesamturteil und die zwei Karten der App ════════ */
  var RU = 276.5;
  function zKarte(t) {
    var kl = t.score >= 70 ? 'g' : 'o';
    var grp = t.gruppen.map(function (g) {
      return '<div class="zs-kz"><span class="zs-t">' + g.name + ' <span class="zs-anteil">' + g.anteil + '&nbsp;%</span></span>'
        + '<span class="zs-p"><b data-zahl="' + g.score + '">' + g.score + '</b> / 100</span>'
        + '<span class="zs-bar"><i data-breit="' + g.score + '" style="background:' + farbe(g.score) + ';width:' + g.score + '%"></i></span>'
        + '<span class="zs-m">' + g.kpis + ' · ' + g.n + ' KPIs</span></div>';
    }).join('');
    return '<div class="zs-karte" data-karte="' + t.key + '"><div class="zs-band"></div><div class="zs-pad">'
      + '<div class="zs-score"><div class="zs-ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="tr" cx="52" cy="52" r="44"/>'
      + '<circle class="pg" cx="52" cy="52" r="44" data-ring="' + t.score + '" style="stroke:' + farbe(t.score) + ';stroke-dashoffset:' + (RU * (1 - t.score / 100)).toFixed(1) + '"/></svg>'
      + '<div class="zs-n" data-zahl="' + t.score + '">' + t.score + '</div></div>'
      + '<div><h3 class="zs-h3">' + t.titel + '</h3><span class="zs-pill ' + kl + '">' + stufe(t.score).toUpperCase() + '</span>'
      + '<div class="zs-was">' + t.frage + '</div></div></div>'
      + '<div class="zs-kat">' + grp + '</div>'
      + '<div class="zs-summe">Zählt ' + t.anteil + '&nbsp;% zum Gesamtscore 87.</div></div></div>';
  }
  /* Gesamturteil wie in der App (dpsh-score-hero.js zweiAnsichtHtml): Stufe des Gesamtscores, Empfehlung
     aus den zwei Schwellen (dealscore2.js _zweiScores). Ohne Formelzeile. */
  function urteilHtml() {
    return '<div class="zs-kopf" data-teil="kopf"><div class="zs-siegel"><span data-zahl="87">87</span><small>/ 100</small></div>'
      + '<div><div class="zs-lbl">Gesamturteil · Investor Deal Score</div><div class="zs-wort">Sehr gut</div></div>'
      + '<span class="zs-empf">Empfehlung · Kaufen</span>'
      + '<div class="zs-warum"><span class="zs-teil" data-t>Investment <b>81</b> zählt 59,3&nbsp;%</span><span class="zs-teil" data-t>Finanzierung <b>97</b> zählt 40,8&nbsp;%</span>'
      + '<span class="zs-teil ges" data-t>Gesamtscore <b>87</b> von 100</span></div>'
      + '<p class="zs-satz" data-t>Das Objekt erreicht im Investment die Schwelle von 70, die Finanzierung die Schwelle von 50. '
      + 'Die Miete deckt den Kapitaldienst <b>1,49-fach</b>, deshalb greift keine Grenze. Daraus folgt die Empfehlung <b>Kaufen</b>.</p></div>';
  }
  function zweiHtml() {
    return '<div class="zs">' + urteilHtml() + '<div class="zs-zwei">' + zKarte(D.inv) + zKarte(D.fin) + '</div></div>';
  }
  function zielNull(root) {
    $$('[data-zahl]', root).forEach(function (e) { e.textContent = '0'; });
    $$('[data-breit]', root).forEach(function (e) { e.style.width = '0%'; });
    $$('[data-ring]', root).forEach(function (e) { e.style.strokeDashoffset = RU; });
  }
  function zielFertig(root) {
    $$('[data-zahl]', root).forEach(function (e) { e.textContent = e.dataset.zahl; });
    $$('[data-breit]', root).forEach(function (e) { e.style.width = e.dataset.breit + '%'; });
    $$('[data-ring]', root).forEach(function (e) { e.style.strokeDashoffset = (RU * (1 - e.dataset.ring / 100)).toFixed(1); });
    $$('[data-t]', root).forEach(function (e) { e.style.opacity = ''; e.style.transform = ''; });
  }
  function fuelle(root, ms) {
    ms = ms || 1300; var p = [];
    $$('[data-ring]', root).forEach(function (r) {
      var z = (RU * (1 - r.dataset.ring / 100)).toFixed(1);
      p.push(anim(r, [{ strokeDashoffset: RU }, { strokeDashoffset: z }], { duration: ms + 300 }).then(function () { r.style.strokeDashoffset = z; }));
    });
    $$('[data-zahl]', root).forEach(function (z) { p.push(zaehle(z, +z.dataset.zahl, ms + 200)); });
    $$('[data-breit]', root).forEach(function (b, i) {
      p.push(anim(b, [{ width: '0%' }, { width: b.dataset.breit + '%' }], { duration: ms, delay: i * 110 }).then(function () { b.style.width = b.dataset.breit + '%'; }));
    });
    return Promise.all(p);
  }

  /* Botschaft: „Einer reicht nicht. Zwei Scores.“ Wort für Wort, mit Strich und Markern */
  function botHtml() {
    var teile = ['Dein', 'Objekt', 'kann', '<span class="mk gut">gut sein</span>,', 'aber', 'deine', 'Finanzierung', '<span class="mk nicht">nicht.</span>']
      .map(function (w) { return '<span class="wo">' + w + '</span>'; }).join(' ');
    return '<div class="bot" data-bot><div class="b1"><span class="w einer"><span>Einer</span></span><span class="w r1"><span>reicht</span></span><span class="w r2"><span>nicht.</span></span>'
      + '<span class="w zw"><span class="zwei">Zwei</span></span><span class="w sc"><span class="zwei">Scores.</span></span></div>'
      + '<div class="b2">' + teile + '</div>'
      + '<div class="pfeile" aria-hidden="true"><span class="pi"><i style="background:#3FA56C"></i>Investment</span><span class="pf"><i style="background:var(--wl-c9a84c,#C9A84C)"></i>Finanzierung</span></div></div>';
  }
  function botLauf(bot) {
    var ws = $$('.b1 .w > span', bot), wo = $$('.b2 .wo', bot);
    bot.classList.remove('s2', 's3', 's4');
    if (ruhig) { bot.classList.add('s2', 's3', 's4'); return Promise.resolve(); }
    ws.forEach(function (w) { w.style.opacity = 0; });
    var p = ws.slice(0, 3).map(function (w, i) {
      return anim(w, [{ opacity: 0, transform: 'translateY(.6em) rotate(4deg)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, delay: i * 140, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
    return Promise.all(p).then(function () { return warte(250); }).then(function () {
      bot.classList.add('s2');
      return Promise.all([
        anim(ws[3], [{ opacity: 0, transform: 'scale(1.8) translateX(-.4em)', filter: 'blur(12px)', letterSpacing: '.2em' }, { opacity: 1, transform: 'none', filter: 'blur(0)', letterSpacing: '-.04em' }], { duration: 750, delay: 250, easing: 'cubic-bezier(.16,1,.3,1)' }),
        anim(ws[4], [{ opacity: 0, transform: 'scale(1.8) translateX(.4em)', filter: 'blur(12px)', letterSpacing: '.2em' }, { opacity: 1, transform: 'none', filter: 'blur(0)', letterSpacing: '-.04em' }], { duration: 750, delay: 380, easing: 'cubic-bezier(.16,1,.3,1)' })
      ]);
    }).then(function () {
      bot.classList.add('s3');
      wo.forEach(function (w, i) { w.style.transitionDelay = (i * 60) + 'ms'; });
      return warte(wo.length * 60 + 500);
    }).then(function () { bot.classList.add('s4'); return warte(700); });
  }

  /* Riss in zwei Hälften (score-animation-2/basis.js spalte, zickzack) */
  function rel(el, bezug) { var a = el.getBoundingClientRect(), b = bezug.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; }
  function zickzack(n, mitte, ausschlag, seed) {
    var s = seed || 3, pts = [[mitte, 0]];
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 1; i < n; i++) pts.push([mitte + (rnd() - .5) * 2 * ausschlag, i / n]);
    pts.push([mitte + (rnd() - .5) * ausschlag, 1]);
    return pts;
  }
  function spalte(card, bezug, punkte) {
    var r = rel(card, bezug);
    var P = punkte.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',');
    function klon(clip) {
      var h = document.createElement('div'); h.className = 'haelfte';
      h.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;clip-path:' + clip;
      var k = card.cloneNode(true); k.style.width = r.w + 'px'; k.style.height = r.h + 'px'; k.style.margin = '0'; k.removeAttribute('role'); h.appendChild(k);
      h.setAttribute('aria-hidden', 'true'); bezug.appendChild(h); return h;
    }
    var Lh = klon('polygon(0 0,' + P + ',0 100%)'), Rh = klon('polygon(100% 0,' + P + ',100% 100%)');
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'riss-svg'); svg.setAttribute('width', r.w); svg.setAttribute('height', r.h);
    svg.style.left = r.x + 'px'; svg.style.top = r.y + 'px';
    var d = punkte.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] * r.w).toFixed(1) + ' ' + (p[1] * r.h).toFixed(1); }).join(' ');
    svg.innerHTML = '<defs><filter id="glut' + r.w.toFixed(0) + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<path d="' + d + '" fill="none" stroke="#E8CC7A" stroke-width="8" opacity=".7" filter="url(#glut' + r.w.toFixed(0) + ')"/>'
      + '<path d="' + d + '" fill="none" stroke="#b8932f" stroke-width="2.2"/>';
    bezug.appendChild(svg);
    var pfade = $$('path', svg), len = pfade[1].getTotalLength();
    pfade.forEach(function (p) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
    return { L: Lh, R: Rh, svg: svg, pfade: pfade, len: len, rect: r };
  }
  function welle(b, x, y, d) {
    var r = document.createElement('i'); r.className = 'welle';
    r.style.cssText = 'left:' + (x - d / 2) + 'px;top:' + (y - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px';
    b.appendChild(r);
    return anim(r, [{ transform: 'scale(.05)', opacity: 1, borderWidth: '10px' }, { transform: 'scale(1)', opacity: 0, borderWidth: '1px' }], { duration: 900, easing: 'cubic-bezier(.1,.7,.3,1)' }).then(function () { r.remove(); });
  }
  function funken(b, x, y, n, weite) {
    var p = [];
    for (var i = 0; i < n; i++) {
      var f = document.createElement('i'); f.className = 'funke'; f.style.left = x + 'px'; f.style.top = y + 'px'; b.appendChild(f);
      var w = Math.random() * Math.PI * 2, rr = (weite || 140) * (.35 + Math.random() * .8);
      p.push(anim(f, [{ transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + (Math.cos(w) * rr).toFixed(0) + 'px),calc(-50% + ' + (Math.sin(w) * rr + 30).toFixed(0) + 'px)) scale(0)', opacity: 0 }],
        { duration: 600 + Math.random() * 600, easing: 'cubic-bezier(.1,.7,.3,1)' }).then((function (el) { return function () { el.remove(); }; })(f)));
    }
    return Promise.all(p);
  }

  /* Die Bühne: Hero-Karte reißt, zwei Scores entstehen.
     art 'riss'   · senkrechter Zickzack-Riss, Lichtspalt, Hälften klappen auf und pumpen sich zu den Karten auf
     art 'abriss' · Abriss an der Perforation im Verhältnis 59,3 zu 40,8, die Karte legt sich hin, die
                    zwei Scores stehen aus ihr auf (landing-neu-3/seite-3) */
  function zweiBuehne(host, opt) {
    opt = opt || {};
    host.innerHTML = (opt.ohneBot ? '' : botHtml()) + '<div class="buehne"><div class="zs-ort">' + zweiHtml() + '</div><div class="platz"></div></div>'
      + '<p style="text-align:center;margin:26px 0 0"><button class="nochmal" type="button">↻ Nochmal reißen</button></p>';
    var b = $('.buehne', host), platz = $('.platz', host), zs = $('.zs', host), bot = $('[data-bot]', host);
    var lauf = 0;
    platz.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:4;max-width:760px;margin:0 auto';
    function neu() {
      var nr = ++lauf; function lebt() { return nr === lauf; }
      $$('.haelfte,.riss-svg,.lichtspalt,.welle,.funke', b).forEach(function (x) { x.remove(); });
      var k = karte(platz); k.fertig(); platz.style.visibility = '';
      zielNull(zs); zs.classList.add('verdeckt');
      var kopf = $('.zs-kopf', zs), karten = $$('.zs-karte', zs), teile = $$('[data-t]', zs);
      if (ruhig) { platz.style.visibility = 'hidden'; zs.classList.remove('verdeckt'); zielFertig(zs); if (bot) bot.classList.add('s2', 's3', 's4'); return; }
      var botP = bot ? botLauf(bot) : Promise.resolve();
      var card = k.el;
      return warte(opt.verz || 900).then(function () {
        if (!lebt()) return;
        /* Karte schwebt kurz, dann der Riss */
        return anim(card, [{ transform: 'none' }, { transform: 'translateY(-8px) rotate(-.6deg)' }, { transform: 'translateY(-4px) rotate(.4deg)' }, { transform: 'none' }], { duration: 1300, easing: 'ease-in-out', fill: 'none' });
      }).then(function () {
        if (!lebt()) return;
        var anteil = .593, pts = opt.art === 'abriss' ? zickzack(46, anteil, .012, 5) : zickzack(10, .5, .04, 11);
        var sp = spalte(card, b, pts), r = sp.rect; platz.style.visibility = 'hidden';
        var zittern = [sp.L, sp.R].map(function (h) {
          return anim(h, [{ transform: 'none' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(2px,-1px)' }, { transform: 'none' }], { duration: 240, delay: 480, easing: 'linear', fill: 'none' });
        });
        return Promise.all(sp.pfade.map(function (p) {
          return anim(p, [{ strokeDashoffset: sp.len }, { strokeDashoffset: 0 }], { duration: opt.art === 'abriss' ? 650 : 720, easing: 'cubic-bezier(.6,0,.3,1)' });
        }).concat(zittern)).then(function () {
          if (!lebt()) return;
          var mx = r.x + r.w * (opt.art === 'abriss' ? anteil : .5);
          welle(b, mx, r.y + r.h / 2, Math.max(r.w, r.h) * 1.3);
          funken(b, mx, r.y + r.h * .45, 22, 160);
          var spalt = document.createElement('div'); spalt.className = 'lichtspalt';
          spalt.style.cssText = 'left:' + (mx - 40) + 'px;top:' + (r.y - 20) + 'px;width:80px;height:' + (r.h + 40) + 'px';
          b.appendChild(spalt);
          var auf = Math.min(64, r.w * .09);
          var schritt1 = Promise.all([
            anim(spalt, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1.5)' }], { duration: 650 }),
            anim(sp.svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }),
            anim(sp.L, [{ transform: 'none' }, { transform: 'translateX(' + (-auf) + 'px) rotate(-2.5deg)' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' }),
            anim(sp.R, [{ transform: 'none' }, { transform: 'translateX(' + auf + 'px) rotate(2.5deg)' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' })
          ]);
          return schritt1.then(function () { return warte(700); }).then(function () {
            if (!lebt()) return;
            zs.classList.remove('verdeckt');
            kopf.style.opacity = 0; teile.forEach(function (t) { t.style.opacity = 0; });
            var ki = karten[0], kf = karten[1], Ti = rel(ki, b), Tf = rel(kf, b);
            if (opt.art === 'abriss') {
              /* Die Hälften legen sich hin, aus ihnen stehen die Karten auf */
              [sp.L, sp.R].forEach(function (h) { h.style.transformOrigin = '50% 100%'; });
              return Promise.all([
                anim(sp.L, [{ transform: 'translateX(' + (-auf) + 'px) rotate(-2.5deg)', opacity: 1 }, { transform: 'translate(' + (-auf * 1.4) + 'px,' + (r.h * .35) + 'px) perspective(900px) rotateX(78deg) rotate(-4deg) scale(.92)', opacity: .0 }], { duration: 1100, easing: 'cubic-bezier(.5,0,.2,1)' }),
                anim(sp.R, [{ transform: 'translateX(' + auf + 'px) rotate(2.5deg)', opacity: 1 }, { transform: 'translate(' + (auf * 1.4) + 'px,' + (r.h * .35) + 'px) perspective(900px) rotateX(78deg) rotate(4deg) scale(.92)', opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.5,0,.2,1)' }),
                anim(spalt, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 }),
                anim(ki, [{ transform: 'perspective(1000px) translateY(120px) rotateX(-70deg)', opacity: 0, transformOrigin: '50% 100%' }, { transform: 'none', opacity: 1, transformOrigin: '50% 100%' }], { duration: 1100, delay: 650, easing: 'cubic-bezier(.3,1.25,.45,1)' }),
                anim(kf, [{ transform: 'perspective(1000px) translateY(120px) rotateX(-70deg)', opacity: 0, transformOrigin: '50% 100%' }, { transform: 'none', opacity: 1, transformOrigin: '50% 100%' }], { duration: 1100, delay: 820, easing: 'cubic-bezier(.3,1.25,.45,1)' }),
                warte(900).then(function () { return fuelle($('.zs-zwei', zs), 1300); })
              ]).then(function () { sp.L.remove(); sp.R.remove(); sp.svg.remove(); spalt.remove(); });
            }
            /* riss: FLIP von der Hälfte zur Karte */
            var Hi = { x: r.x - auf, y: r.y, w: r.w / 2, h: r.h }, Hf = { x: r.x + r.w / 2 + auf, y: r.y, w: r.w / 2, h: r.h };
            function von(H, T, rot) { return 'translate(' + (H.x - T.x).toFixed(1) + 'px,' + (H.y - T.y).toFixed(1) + 'px) scale(' + (H.w / T.w).toFixed(3) + ',' + (H.h / T.h).toFixed(3) + ') rotate(' + rot + 'deg)'; }
            [ki, kf].forEach(function (x) { x.style.transformOrigin = '0 0'; });
            sp.L.style.transformOrigin = '0 0'; sp.R.style.transformOrigin = '100% 0';
            var feder = 'cubic-bezier(.3,1.32,.45,1)';
            return Promise.all([
              anim(ki, [{ transform: von(Hi, Ti, -2.5) }, { transform: 'none' }], { duration: 1000, easing: feder }),
              anim($('.zs-pad', ki), [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, delay: 520 }),
              anim(kf, [{ transform: von(Hf, Tf, 2.5) }, { transform: 'none' }], { duration: 1000, easing: feder }),
              anim($('.zs-pad', kf), [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, delay: 520 }),
              anim(sp.L, [{ transform: 'translateX(' + (-auf) + 'px) rotate(-2.5deg)', opacity: 1 }, { transform: 'translate(' + (Ti.x - r.x) + 'px,' + (Ti.y - r.y) + 'px) scale(' + (Ti.w / (r.w / 2)).toFixed(3) + ',' + (Ti.h / r.h).toFixed(3) + ')', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.5,0,.3,1)' }),
              anim(sp.R, [{ transform: 'translateX(' + auf + 'px) rotate(2.5deg)', opacity: 1 }, { transform: 'translate(' + (Tf.x + Tf.w - r.x - r.w) + 'px,' + (Tf.y - r.y) + 'px) scale(' + (Tf.w / (r.w / 2)).toFixed(3) + ',' + (Tf.h / r.h).toFixed(3) + ')', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.5,0,.3,1)' }),
              anim(spalt, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 }),
              warte(320).then(function () { return fuelle($('.zs-zwei', zs), 1300); })
            ]).then(function () { sp.L.remove(); sp.R.remove(); sp.svg.remove(); spalt.remove(); });
          });
        });
      }).then(function () {
        if (!lebt()) return;
        /* Gesamturteil steigt grün auf, dann seine Teile */
        kopf.style.opacity = '';
        return Promise.all([
          anim(kopf, [{ opacity: 0, transform: 'translateY(30px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)' }),
          zaehle($('.zs-siegel [data-zahl]', kopf), 87, 1100),
          anim($('.zs-siegel', kopf), [{ transform: 'scale(.4) rotate(-90deg)' }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.3,1.4,.5,1)' }),
          Promise.all(teile.map(function (t, i) {
            return anim(t, [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 520, delay: 450 + i * 200 })
              .then(function () { t.style.opacity = ''; });
          }))
        ]);
      }).then(function () { return botP; });
    }
    $('.nochmal', host).addEventListener('click', function () { neu(); });
    /* erst starten, wenn die Bühne wirklich im Bild ist */
    platz.innerHTML = ''; var k0 = karte(platz); k0.fertig(); zielNull(zs); zs.classList.add('verdeckt');
    if (ruhig) { neu(); return; }
    sichtbar(b, function () { neu(); }, opt.schwelle || .35);
    var breite = innerWidth, rt;
    addEventListener('resize', function () { if (innerWidth === breite) return; breite = innerWidth; clearTimeout(rt); rt = setTimeout(function () { lauf++; $$('.haelfte,.riss-svg,.lichtspalt', b).forEach(function (x) { x.remove(); }); platz.style.visibility = 'hidden'; zs.classList.remove('verdeckt'); zielFertig(zs); $$('.zs-karte', zs).forEach(function (x) { x.getAnimations().forEach(function (a) { a.cancel(); }); }); }, 200); });
  }

  /* ══ App-Wand (Idee 03) ═══════════════════════════════════════════ */
  function appWand(el, opt) {
    opt = opt || {};
    var bilder = D.etappen.filter(function (e) { return e.bild !== 'qc'; }).map(function (e) { return L + 'assets/dp-strecke/' + e.bild; })
      .concat(['09-finanzierung.webp', '11-deal-score-pilot-analyse.webp', '14-portfolio-cockpit.webp', '16-steuerverlauf.webp'].map(function (b) { return L + 'assets/app-bilder/' + b; }))
      .concat(D.videos.slice(0, 8).map(function (v) { return L + 'assets/videothek/' + v.poster; }));
    var sp = opt.spalten || 4, h = '';
    for (var s = 0; s < sp; s++) {
      var k = '';
      for (var j = 0; j < 5; j++) k += '<div class="wand-k"><img src="' + bilder[(s * 5 + j * 3) % bilder.length] + '" alt="" loading="' + (s < 2 ? 'eager' : 'lazy') + '" width="400" height="250"></div>';
      h += '<div class="wand-sp" style="--d:' + ((opt.dauer || 70) + s * 9) + 's">' + k + k + '</div>';
    }
    el.innerHTML = h;
    return el;
  }

  /* ══ Datenstrom (Idee 04), helle Fassung ══════════════════════════ */
  function strom(cv, host, opt) {
    opt = opt || {};
    var cx = cv.getContext('2d'), W, H, dpr, P = [], N, phase = 0, ziel = null, sicht = true, laufend = false;
    var fx = opt.fx == null ? .64 : opt.fx, fy = opt.fy == null ? .42 : opt.fy;
    var pal = opt.farben || ['#C9A84C', '#b8932f', '#E8CC7A', '#8a6c1e'];
    function messen() { dpr = Math.min(2, devicePixelRatio || 1); W = host.clientWidth; H = host.clientHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    var SP = [-1.1, -.55, 0, .55, 1.1];
    function neu(p, frisch) {
      p.boden = Math.random() < .6;
      p.x = p.boden ? SP[Math.floor(Math.random() * 5)] + (Math.random() - .5) * .06 : (Math.random() - .5) * 3.2;
      p.y = p.boden ? 1 : -1.3 + Math.random() * 2;
      p.z = frisch ? Math.random() + .02 : 1; p.v = .0035 + Math.random() * .006; p.ziel = null; p.f = 0; p.aus = 0;
    }
    function proj(p) { var f = 1 / p.z; return [W * fx + p.x * W * .045 * f, H * fy + p.y * H * .03 * f, Math.min(3.4, .5 + f * .1)]; }
    function zeichne(statisch) {
      cx.clearRect(0, 0, W, H);
      cx.lineCap = 'round';
      for (var i = 0; i < P.length; i++) {
        var p = P[i], alt = proj(p);
        if (!statisch) { p.z -= p.v * (1 + (1 - p.z) * 1.5); if (p.z < .035) { neu(p); continue; } }
        var q = proj(p), x = q[0], y = q[1], g = q[2], a = Math.min(1, (1 - p.z) * 1.3) * (opt.deck || .75), x0 = alt[0], y0 = alt[1];
        if (p.ziel && phase >= 1) {
          p.f = Math.min(1, p.f + .018 + (i % 7) * .002); var e = p.f < .5 ? 4 * p.f * p.f * p.f : 1 - Math.pow(-2 * p.f + 2, 3) / 2;
          x += (p.ziel[0] - x) * e; y += (p.ziel[1] - y) * e; x0 += (p.ziel[0] - x0) * e; y0 += (p.ziel[1] - y0) * e; g += (1.8 - g) * e; a = Math.max(a, e * .9);
          if (phase === 2) { p.aus = Math.min(1, p.aus + .025); a *= 1 - p.aus; if (p.aus >= 1) p.ziel = null; }
        } else if (phase === 2) a *= .55;
        if (x < -20 || x > W + 20 || y > H + 20 || y < -20 || a <= .01) continue;
        cx.globalAlpha = a; cx.strokeStyle = pal[i & 3]; cx.lineWidth = g;
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x + .01, y + .01); cx.stroke();
      }
      cx.globalAlpha = 1;
    }
    function schleife() { if (sicht && laufend) zeichne(); requestAnimationFrame(schleife); }
    var api = {
      start: function () {
        if (laufend) return; messen(); N = opt.n || (innerWidth < 700 ? 700 : 1900);
        for (var i = 0; i < N; i++) { var p = {}; neu(p, true); P.push(p); }
        if (ruhig) { zeichne(true); return; }
        laufend = true; requestAnimationFrame(schleife);
      },
      /* Teilchen sammeln sich als Ring um (x, y) mit Radius r (Seitenkoordinaten des Hosts) */
      sammle: function (x, y, r, anteil) {
        if (ruhig) return Promise.resolve();
        anteil = anteil || .87; var n = Math.round(P.length * .6), pts = [];
        for (var i = 0; i < n; i++) { var w = i / n * Math.PI * 2 * anteil - Math.PI / 2, rr = r + (Math.random() - .5) * 8; pts.push([x + Math.cos(w) * rr, y + Math.sin(w) * rr]); }
        P.forEach(function (p, i) { p.ziel = pts[i] || null; p.f = 0; p.aus = 0; });
        phase = 1; return warte(1400);
      },
      los: function () { phase = 2; setTimeout(function () { phase = 0; }, 1600); },
      messen: messen
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { sicht = es[0].isIntersecting; }).observe(host);
    addEventListener('resize', function () { if (laufend) messen(); });
    return api;
  }

  /* ══ Zahlen fliegen herein (Idee 05) ══════════════════════════════ */
  function zahlenFlug(el, items) {
    items = items || [
      [87, 'Investor Deal Score dieses Beispiels'], [24, 'Kennzahlen hinter jedem Score'], [1100360, 'amtliche Datenpunkte'],
      [81, 'Investment-Score'], [97, 'Finanzierungs-Score'], [201, 'Gutachterausschüsse mit Werten']
    ];
    el.classList.add('zf');
    el.innerHTML = items.map(function (z, i) {
      var fx = ((i % 3) - 1) * 140 + 'px', fy = (i < 3 ? -90 : 90) + 'px';
      return '<div><b class="flieg num" style="--fx:' + fx + ';--fy:' + fy + '" data-z="' + z[0] + '">0</b><span>' + z[1] + '</span></div>';
    }).join('');
    $$('div', el).forEach(function (d, i) {
      var b = $('b', d);
      if (ruhig) { d.classList.add('da'); b.textContent = fmt(+b.dataset.z); return; }
      sichtbar(d, function () {
        setTimeout(function () { d.classList.add('da'); zaehle(b, +b.dataset.z, 1500); }, (i % 3) * 140 + (i > 2 ? 220 : 0));
      }, .3);
    });
  }

  /* ══ So fliegt ein Deal (Konzept A, Inhalt der Landing) ══════════ */
  function qcHtml() {
    return '<div class="qc" role="img" aria-label="Quick-Check mit Beispieldaten: Score 81, Gut, Starker Kauf">'
      + '<div class="qc-kopf"><div class="qc-ring"><span>81</span></div><div><b>Ersteinschätzung · Gut</b><small>Starker Kauf · empfehlenswert</small></div></div>'
      + '<div class="qc-z"><span>Preis unter der Marktspanne<small>DealPilot-Marktbewertung 185.000 € bis 236.000 €</small></span><b class="g">179.000 €<br><small>−14 % zur Mitte</small></b></div>'
      + '<div class="qc-z"><span>Zustand und Modernisierung<small>Zustand „gut“, Anlage 2 ImmoWertV</small></span><b>14 Pkt.</b></div>'
      + '<div class="qc-z"><span>Rendite erfüllt das Ziel der B-Lage<small>Kaufpreisfaktor 14,9 · Ziel 5 %</small></span><b class="g">6,7 %</b></div>'
      + '<div class="qc-z"><span>Finanzierung trägt sich<small>80 % finanziert · 4,22 % Zins · DSCR 1,22</small></span><b class="g">+147 €<br><small>pro Monat</small></b></div>'
      + '</div><div class="qc-bu">Quick-Check · Beispieldaten</div>';
  }
  function etappen(el) {
    el.innerHTML = '<div class="runway"><div class="achse" aria-hidden="true"><i></i></div>' + D.etappen.map(function (e) {
      var bild = e.bild === 'qc' ? qcHtml() : '<img src="' + L + 'assets/dp-strecke/' + e.bild + '" alt="DealPilot: ' + e.t + '" loading="lazy" width="1600" height="900">';
      return '<article class="etappe"><div class="punkt" aria-hidden="true">' + e.nr + '</div>'
        + '<div class="text"><div class="nr">Etappe ' + e.nr + ' · ' + e.wer + '</div><h3>' + e.t + '</h3><p>' + e.x + '</p>'
        + '<div class="chips">' + e.c.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '<a href="' + L + 'videothek.html?v=' + e.v + '">Video ansehen →</a></div></div>'
        + '<div class="schirm"><div class="rahmen" aria-hidden="true"><i></i><i></i><i></i></div>' + bild + '</div></article>';
    }).join('') + '</div><p style="text-align:center;margin:40px 0 0;font:500 12px var(--mono);color:var(--mut)">Ansichten aus DealPilot. Beispieldaten.</p>';
    var rw = $('.runway', el), achse = $('.achse i', rw), et = $$('.etappe', rw);
    if (ruhig) { achse.style.setProperty('--fort', 1); et.forEach(function (e) { e.classList.add('drin'); }); return; }
    scrollFort(rw, function () {
      var r = rw.getBoundingClientRect(), mitte = innerHeight * .55;
      achse.style.setProperty('--fort', clamp((mitte - r.top) / r.height, 0, 1).toFixed(4));
      et.forEach(function (e) { var b = e.getBoundingClientRect(); e.classList.toggle('drin', b.top + b.height * .35 < mitte); });
    });
  }

  /* ══ Amtliche Daten ═══════════════════════════════════════════════ */
  /* Zählwerk: jede Ziffer rollt auf ihren Wert, landet immer auf der gemessenen Zahl */
  function rolle(el, zahl) {
    var t = fmt(zahl);
    el.innerHTML = t.split('').map(function (c) {
      if (!/\d/.test(c)) return '<span>' + c + '</span>';
      return '<span class="rolle" data-d="' + c + '"><span>' + '0123456789012345678901'.split('').join('<br>') + '</span></span>';
    }).join('');
    el.setAttribute('aria-label', t);
    function dreh(sofort) {
      $$('.rolle', el).forEach(function (r, i) {
        var s = $('span', r), d = +r.dataset.d;
        s.style.transition = sofort ? 'none' : 'transform ' + (1.1 + i * .12) + 's cubic-bezier(.2,.72,.2,1)';
        s.style.transform = 'translateY(-' + (sofort ? d : d + 10) + 'em)';
      });
    }
    function null_() { $$('.rolle span', el).forEach(function (s) { s.style.transition = 'none'; s.style.transform = 'translateY(0)'; }); }
    return { dreh: dreh, null_: null_ };
  }
  function daten(el, opt) {
    opt = opt || {};
    var Q = opt.auswahl ? opt.auswahl.map(function (i) { return D.quellen[i]; }) : D.quellen;
    el.innerHTML = '<div class="mio" data-rv><div class="gross">Über <em>1&nbsp;Million</em><small>amtliche Datenpunkte.</small></div>'
      + '<div><div class="eye">Datenbasis · gemessen am 18.11.2026</div><div class="exakt num" style="margin-top:18px" data-gesamt>1.100.360</div>'
      + '<p>Gezählt in unseren eigenen Datenbanken, ' + D.umfang.schnittstellen + ' amtliche Dienste und Tabellen angebunden. DealPilot rechnet nicht mit Schätzwerten aus dem Netz, sondern mit den Daten der Behörden, regelmäßig abgeglichen und mit Herkunft je Wert.</p></div></div>'
      + '<div class="kacheln">' + Q.map(function (q, i) {
        return '<div class="kachel" data-rv data-rvv="' + (i * 70) + '"><div class="takt' + (q[2] ? ' live' : '') + '"><i></i>' + q[1] + '</div>'
          + '<b class="z num"><span data-roll="' + q[3] + '">' + fmt(q[3]) + '</span><small>' + q[4] + '</small></b><h4>' + q[0] + '</h4><p>' + q[5] + '</p></div>';
      }).join('') + '</div>'
      + '<div class="daten-fuss"><span>Marktdaten aus Angeboten kommen hinzu. Sie zählen hier nicht mit und heißen im Bericht nie amtlich.</span>'
      + '<a href="unterseite-daten.html">Alle Zahlen im Flugbuch der Daten →</a></div>';
    var g = $('[data-gesamt]', el);
    var rollen = $$('[data-roll]', el).map(function (s) { return rolle(s, +s.dataset.roll); });
    if (ruhig) { rollen.forEach(function (r) { r.dreh(true); }); return; }
    rollen.forEach(function (r) { r.null_(); });
    sichtbar($('.mio', el), function () { zaehle(g, D.umfang.gesamt, 2600); }, .3);
    $$('.kachel', el).forEach(function (k, i) {
      sichtbar(k, function () { k.classList.add('da'); setTimeout(function () { rollen[i].dreh(); }, 200 + i * 90); }, .3);
    });
    /* ruhig in Bewegung: alle paar Sekunden rollt eine Kachel neu auf denselben Wert */
    var n = 0;
    setInterval(function () {
      if (document.hidden) return;
      var r = rollen[n++ % rollen.length]; r.null_(); setTimeout(function () { r.dreh(); }, 60);
    }, 3200);
  }

  /* ══ Videothek ════════════════════════════════════════════════════ */
  function dauer(s) { return s >= 3600 ? Math.floor(s / 3600) + ':' + ('0' + Math.floor(s % 3600 / 60)).slice(-2) + ' h' : Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function videothek(el, opt) {
    opt = opt || {};
    var V = D.videos;
    if (opt.art === 'raster') {
      el.innerHTML = '<div class="vraster">' + V.slice(0, opt.anzahl || 6).map(function (v, i) {
        return '<a class="vk-karte" data-rv data-rvv="' + (i * 80) + '" href="' + L + 'videothek.html?v=' + v.id + '"><span class="bild"><img src="' + L + 'assets/videothek/' + v.poster + '" alt="" loading="lazy" width="480" height="270"></span>'
          + '<span class="tx"><small>' + (v.nr === 'Spot' ? 'SPOT' : 'VIDEO ' + v.nr) + ' · ' + dauer(v.dauer) + '</small><b>' + v.titel + '</b><p>' + v.satz + '</p></span></a>';
      }).join('') + '</div>';
      return;
    }
    el.innerHTML = '<div class="flow" tabindex="0" aria-roledescription="Karussell" aria-label="Videos der Videothek">' + V.map(function (v, i) {
      return '<button class="flow-item" type="button" data-i="' + i + '" tabindex="-1"><span class="b"><img src="' + L + 'assets/videothek/' + v.poster + '" alt="" ' + (i < 4 ? '' : 'loading="lazy" ') + 'width="480" height="270">'
        + '<span class="spiel"></span><span class="dauer">' + dauer(v.dauer) + '</span></span>'
        + '<span class="t"><small>' + (v.nr === 'Spot' ? 'SPOT' : 'VIDEO ' + v.nr) + '</small><b>' + v.titel + '</b></span></button>';
    }).join('') + '</div><p class="flow-satz" aria-live="polite"></p>'
      + '<div class="flow-steuer"><button type="button" data-zur aria-label="Vorheriges Video">←</button><div class="pkt">' + V.map(function () { return '<i></i>'; }).join('') + '</div><button type="button" data-vor aria-label="Nächstes Video">→</button></div>'
      + '<p style="text-align:center;margin:26px 0 0"><a class="btn-l" href="' + L + 'videothek.html">Zur ganzen Videothek · ' + D.umfang.videos + ' Videos, ' + D.umfang.stunden + ' Stunden</a></p>';
    var flow = $('.flow', el), items = $$('.flow-item', el), pkt = $$('.pkt i', el), satz = $('.flow-satz', el), mitte = 0, auto = null;
    function setze(n) {
      mitte = (n + V.length) % V.length;
      var abst = innerWidth < 700 ? 110 : 230;
      items.forEach(function (it, i) {
        var o = i - mitte; if (o > V.length / 2) o -= V.length; if (o < -V.length / 2) o += V.length;
        var a = Math.abs(o), sg = Math.sign(o);
        it.style.transform = o === 0 ? 'translateZ(60px)' : 'translateX(' + (sg * (abst + (a - 1) * abst * .55)) + 'px) translateZ(' + (-120 - a * 90) + 'px) rotateY(' + (-sg * 50) + 'deg)';
        it.style.zIndex = 50 - a; it.style.opacity = a > 3 ? 0 : 1; it.style.filter = o ? 'saturate(.6) brightness(' + (1.02 - a * .06) + ')' : 'none';
        it.classList.toggle('mitte', o === 0); it.tabIndex = o === 0 ? 0 : -1; it.setAttribute('aria-hidden', a > 3);
      });
      pkt.forEach(function (p, i) { p.classList.toggle('an', i === mitte); });
      satz.textContent = V[mitte].satz;
    }
    function halt() { clearInterval(auto); auto = null; }
    flow.addEventListener('click', function (e) {
      var it = e.target.closest('.flow-item'); if (!it) return; halt();
      if (+it.dataset.i === mitte) location.href = L + 'videothek.html?v=' + V[mitte].id; else setze(+it.dataset.i);
    });
    $('[data-vor]', el).onclick = function () { halt(); setze(mitte + 1); };
    $('[data-zur]', el).onclick = function () { halt(); setze(mitte - 1); };
    flow.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { halt(); setze(mitte + 1); } if (e.key === 'ArrowLeft') { halt(); setze(mitte - 1); } });
    var x0 = null;
    flow.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    flow.addEventListener('pointerup', function (e) { if (x0 == null) return; var d = e.clientX - x0; x0 = null; if (Math.abs(d) > 40) { halt(); setze(mitte + (d < 0 ? 1 : -1)); } });
    setze(0);
    addEventListener('resize', function () { setze(mitte); });
    if (!ruhig) sichtbar(flow, function () { auto = setInterval(function () { setze(mitte + 1); }, 3800); }, .4);
  }

  /* ══ Preise ═══════════════════════════════════════════════════════ */
  function preise(el) {
    el.innerHTML = '<div style="text-align:center"><div class="seg" role="tablist"><button type="button" class="an" data-z="m">Monatlich</button><button type="button" data-z="j">Jährlich<small>−17 %</small></button></div></div>'
      + '<div class="tks">' + D.preise.map(function (p, i) {
        var notizM = p.notiz || ('oder ' + p.j + ' €/Jahr'), notizJ = p.j ? 'statt ' + fmt(Math.round(parseFloat(p.m.replace(',', '.')) * 12 * 100) / 100, 2) + ' € monatlich' : p.notiz;
        return '<article class="tk tk-flug' + (p.top ? ' top' : '') + '" style="transition-delay:' + (i * 110) + 'ms">' + (p.top ? '<span class="tk-top">★ ' + p.top.toUpperCase() + '</span>' : '')
          + '<div class="tk-kopf"><span class="st">' + p.st + '</span><small>' + p.tag + '</small><h3>' + p.name + '</h3><em>' + p.klasse + '</em></div>'
          + '<div class="tk-leib"><div class="tk-preis"><b data-m="' + p.m + '" data-j="' + (p.j || p.m) + '">' + p.m + '</b><span>€ <span class="per">/ Monat</span></span></div>'
          + '<div class="tk-notiz" data-m="' + notizM + '" data-j="' + notizJ + '">' + notizM + '</div>'
          + '<div class="tk-kont">◗ ' + p.kont + '</div><ul>' + p.punkte.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'
          + '<a class="tk-knopf" href="' + APP + '">' + p.knopf + '</a><div class="tk-perf"></div><div class="tk-pass"><span>✈ BOARDING PASS</span><span>' + p.pass + '</span></div></div></article>';
      }).join('') + '</div><ul class="haken" style="justify-content:center;margin-top:26px"><li>Keine Zahlungsdaten</li><li>4 Wochen voller Pro-Umfang</li><li>Danach automatisch Free, ohne Kündigung</li><li>Monatlich kündbar</li></ul>';
    $$('.seg button', el).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.seg button', el).forEach(function (x) { x.classList.toggle('an', x === b); });
        var z = b.dataset.z;
        $$('.tk-preis b', el).forEach(function (p) { p.textContent = p.dataset[z]; anim(p, [{ transform: 'translateY(-10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 400 }); });
        $$('.tk-notiz', el).forEach(function (p) { p.textContent = p.dataset[z]; });
        $$('.tk-preis .per', el).forEach(function (p) { p.textContent = z === 'j' ? '/ Jahr' : '/ Monat'; });
      });
    });
    var tks = $('.tks', el);
    if (ruhig) { tks.classList.add('da'); return; }
    sichtbar(tks, function () { tks.classList.add('da'); setTimeout(function () { $$('.tk', tks).forEach(function (t) { t.style.transitionDelay = ''; }); }, 1500); }, .2);
  }

  /* ══ Seitenrahmen ═════════════════════════════════════════════════ */
  function rahmen(cfg) {
    var nav = '<div class="tb"><div class="wrap"><span class="pkt"><i></i>4 WOCHEN PRO, OHNE ZAHLUNGSDATEN</span><span class="pkt"><i></i>MONATLICH KÜNDBAR</span>'
      + '<span class="pkt hidemid"><i></i>KEINE BEWERTUNG VERFÄLLT</span><div class="rechts"><span>&gt; <b>870</b> NUTZER</span><a href="mailto:info@dealpilot.immo">INFO@DEALPILOT.IMMO</a></div></div></div>'
      + '<nav class="nav"><div class="wrap"><a class="mark" href="index.html">Deal<b>Pilot</b></a><ul>'
      + '<li><a href="#etappen">So fliegt ein Deal</a></li><li><a href="#score">Deal Score</a></li><li><a href="#videothek">Videothek</a></li><li><a href="#daten">Datenbasis</a></li><li><a href="#preise">Preise</a></li></ul>'
      + '<a class="b-log" href="https://app.dealpilot.immo/">Anmelden</a><a class="b-cta" href="' + APP + '">Kostenlos starten</a></div></nav>';
    var kopf = $('#kopf'); if (kopf) kopf.innerHTML = nav;
    var fuss = $('#fuss');
    if (fuss) fuss.innerHTML = '<section class="schluss" id="start"><div class="wrap"><div class="eye ctr">Pre-Flight abgeschlossen</div><h2>Bereit für den <em>Take-off?</em></h2>'
      + '<p>Vier Wochen voller Pro-Umfang, ohne Zahlungsdaten. Danach automatisch Free, ohne Kündigung.</p>'
      + '<a class="btn-p" href="' + APP + '">Vier Wochen als Pro, kostenlos</a></div></section>'
      + '<footer class="fuss"><div class="wrap"><div><span class="mark">Deal<b>Pilot</b></span><br>DealPilot ist eine Marke von Junker Solution.<br>Keine Steuer- oder Finanzberatung. Analyse-Werkzeug für eigene Kalkulationen.</div>'
      + '<div><a href="' + L + 'leistungsumfang.html">Leistungsumfang</a><a href="' + L + 'videothek.html">Videothek</a><a href="' + L + 'methodik.html">Methodik</a><a href="unterseite-daten.html">Datenbasis</a><a href="' + L + 'sicherheit.html">Sicherheit</a><br><br>© 2026 Junker Solution · DealPilot</div></div></footer>';
    if (cfg && cfg.nr) document.body.insertAdjacentHTML('beforeend', '<div class="vk">Vorlage · ' + cfg.nr + (cfg.titel ? '<span class="t"> · ' + cfg.titel + '</span>' : '') + '<a href="index.html">Übersicht</a></div>');
  }
  function start(cfg) {
    rahmen(cfg);
    einblenden(document);
  }

  window.DPV = {
    D: D, ruhig: ruhig, $: $, $$: $$, fmt: fmt, farbe: farbe, stufe: stufe, warte: warte, anim: anim, zaehle: zaehle, sichtbar: sichtbar, einblenden: einblenden,
    scrollFort: scrollFort, clamp: clamp, karte: karte, karteHtml: karteHtml, exposeHtml: exposeHtml, exposeFlug: exposeFlug, fliege: fliege,
    zweiBuehne: zweiBuehne, zweiHtml: zweiHtml, botHtml: botHtml, botLauf: botLauf, zielNull: zielNull, zielFertig: zielFertig, fuelle: fuelle,
    appWand: appWand, strom: strom, zahlenFlug: zahlenFlug, etappen: etappen, daten: daten, videothek: videothek, preise: preise, start: start, rel: rel
  };
})();
