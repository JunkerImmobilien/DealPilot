/* landing-neu-3 · gemeinsam.js
   Inhalt und Helfer fuer die fuenf Startseiten-Entwuerfe. Nur Vorlage, nicht eingebaut.

   SCORE-ZAHLEN: mit den ECHTEN Kernen gerechnet (frontend/js/score-tiers.js, dscr-engine.js,
   deal-kpis.js, dealscore2.js per vm, Profil "Ausgewogen", Harness wie tools/zwei-scores-pruefen.mjs).
   Gewichte: dealscore2.js Z.47-53 (Hauptgewichte 35/25/20/10/10), Z.55-90 (Untergewichte),
   Z.840-852 (ZWEI_SCHWELLE, ZWEI_ZUORDNUNG), Z.854 _zweiTeil, Z.909 _zweiScores.
   Grenze: score-tiers.js Z.101 dscrDeckel.

   Beispiel "Hero" (ergibt exakt die Balken der Hero-Karte 98/96/88/60/53 und 87):
     ETW 100 m2, Kaufpreis 180.000 EUR, Kaltmiete 1.300 EUR/Monat, Nebenkosten 10,5 %,
     Eigenkapital 30.000 EUR, Zins 3,6 %, Tilgung 2 %, nicht umlagefaehig 1.500 EUR/Jahr,
     Zustand gut, Energie D, Mietausfall mittel, Vergleichsmiete 12 EUR/m2, Mietwachstum 1,5 %,
     Bevoelkerung stabil, Nachfrage stark, Mikrolage mittel, Marktwert 200.000 EUR,
     Leerstand 2,5 %, Instandhaltung 8,5 %, Wertsteigerung hoch, Entwicklung begrenzt, Qualitaet 5.
     -> Gesamt 87 Sehr gut, Investment 81 Gut, Finanzierung 97 Sehr gut, Empfehlung Kaufen, 24/24 KPIs.
   Gegenbeispiel: dasselbe Objekt, Eigenkapital 5.000 EUR, Zins 4,6 %, Tilgung 2,5 %
     -> Gesamt 65 Solide, Investment 81 Gut, Finanzierung 43 Schwach,
        Empfehlung "Objekt passt, Finanzierung umbauen", DSCR 1,02 (Grenze 84 greift nicht). */
(function () {
  'use strict';
  var LANDING = '../../../frontend/landing/';
  var D = window.DPN = {};
  D.LANDING = LANDING;
  D.MEDIEN = 'https://staging.dealpilot.immo/medien/videothek/';
  D.BILD = LANDING + 'assets/videothek/';
  D.STRECKE = LANDING + 'assets/dp-strecke/';
  D.HEROVIDEO = LANDING + 'assets/video/dp-hero-flug.mp4';
  D.HEROPOSTER = LANDING + 'assets/bild/hero.jpg';
  D.LOGO = LANDING + 'assets/dealpilot-logo.png';
  D.APP = 'https://app.dealpilot.immo/';

  /* Hero-Karte, wie frontend/landing/dp2.js Z.64-70 */
  D.KATEGORIEN = [
    { name: 'Rendite', gewicht: 35, score: 98, kpis: '4/4' },
    { name: 'Finanzierung', gewicht: 25, score: 96, kpis: '5/5' },
    { name: 'Risiko', gewicht: 20, score: 88, kpis: '6/6' },
    { name: 'Lage & Markt', gewicht: 10, score: 60, kpis: '5/5' },
    { name: 'Potenzial', gewicht: 10, score: 53, kpis: '4/4' }
  ];

  /* Ausgabe von DealScore2.compute(), gerundet wie im Kern */
  D.FAELLE = {
    gut: {
      titel: 'Dein Deal',
      gesamt: 87, stufe: 'Sehr gut', empfehlung: 'Kaufen', art: 'ja',
      inv: { score: 81, stufe: 'Gut', anteil: 59.3, gruppen: [
        { name: 'Objektrendite', score: 98, anteil: 32.5 },
        { name: 'Risiko & Zustand', score: 88, anteil: 33.8 },
        { name: 'Lage & Markt', score: 60, anteil: 16.9 },
        { name: 'Potenzial & Preis', score: 53, anteil: 16.9 }] },
      fin: { score: 97, stufe: 'Sehr gut', anteil: 40.8, gruppen: [
        { name: 'Kapitaldienst & Beleihung', score: 96, anteil: 61.3 },
        { name: 'Cashflow & EK-Rendite', score: 97, anteil: 38.7 }] },
      kpi: { ek: '30.000 €', zins: '3,6 %', tilgung: '2 %', darlehen: '168.900 €', ltv: '93,8 %', dscr: '1,49', cf: '+387 €', ekr: '15,5 %' }
    },
    schwach: {
      titel: 'Gleiches Objekt, andere Finanzierung',
      gesamt: 65, stufe: 'Solide', empfehlung: 'Objekt passt, Finanzierung umbauen', art: 'halb',
      inv: { score: 81, stufe: 'Gut', anteil: 59.3, gruppen: [
        { name: 'Objektrendite', score: 98, anteil: 32.5 },
        { name: 'Risiko & Zustand', score: 88, anteil: 33.8 },
        { name: 'Lage & Markt', score: 60, anteil: 16.9 },
        { name: 'Potenzial & Preis', score: 53, anteil: 16.9 }] },
      fin: { score: 43, stufe: 'Schwach', anteil: 40.8, gruppen: [
        { name: 'Kapitaldienst & Beleihung', score: 27, anteil: 61.3 },
        { name: 'Cashflow & EK-Rendite', score: 69, anteil: 38.7 }] },
      kpi: { ek: '5.000 €', zins: '4,6 %', tilgung: '2,5 %', darlehen: '193.900 €', ltv: '107,7 %', dscr: '1,02', cf: '+28 €', ekr: '6,7 %' }
    }
  };
  D.OBJEKT = { art: 'ETW', flaeche: '100 m²', kaufpreis: '180.000 €', miete: '1.300 €', bmr: '8,67 %', nmr: '7,09 %', faktor: '11,5' };

  D.stufe = function (s) { return s >= 85 ? 'Sehr gut' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch'; };
  D.farbe = function (s) { return s >= 70 ? '#3FA56C' : s >= 50 ? '#C9A84C' : '#B8625C'; };

  /* Die neun Etappen, Texte aus frontend/landing/index.html (landing-strecke) */
  D.ETAPPEN = [
    { nr: '01', phase: 'Quick-Check', titel: 'Erst prüfen, dann erfassen', bild: D.BILD + 'dealpilot-ueberblick-1-quick-boarding.webp',
      text: 'Alle Exposés und Dateien auf einmal hineinziehen. DealPilot liest sie aus, holt Marktwert und Miete dazu und zeigt in etwa einer halben Minute Score, Rendite, Cashflow und ein klares Urteil gegen dein eigenes Ziel.',
      chips: ['Alle Dateien auf einmal', 'Urteil gegen dein Ziel', 'Zielkaufpreis'], video: 'ueberblick-1-quick-boarding' },
    { nr: '02', phase: 'Erfassen', titel: 'Objekt erfassen', bild: D.STRECKE + '01-objekt-erfassen.webp',
      text: 'Exposé hineinziehen, frei erzählen, ein Inserat aus ImmoMetrica übernehmen oder Frage für Frage eingeben. Wie tief du gehst, wählst du selbst: Einsteiger, Fortgeschritten oder Experte.',
      chips: ['Exposé und Dokumente', 'Sprache', 'Geführte Eingabe'], video: 'modul-03-datenaufnahme-vier-wege' },
    { nr: '03', phase: 'Prüfen', titel: 'Rendite und Investor Deal Score', bild: D.STRECKE + '02-score.webp',
      text: '24 Kennzahlen in fünf Bereichen. Getrennt nach Investment und Finanzierung steht am Ende eine Zahl von 0 bis 100 mit Stufe und Empfehlung, und du siehst, welche Kennzahl trägt und welche drückt.',
      chips: ['Investment-Score', 'Finanzierungs-Score', 'Empfehlung'], video: 'modul-12-bewertung-und-kpis' },
    { nr: '04', phase: 'Prüfen', titel: 'Unterlagen lesen', bild: D.STRECKE + '03-unterlagen.webp',
      text: 'Mietaufstellung, Grundbuch, WEG-Protokolle und Energieausweis auf einmal. DealPilot erkennt jedes Dokument, schwärzt Personendaten und zeigt mit Fundstelle, was absehbar Geld kostet.',
      chips: ['Mehrere PDFs auf einmal', 'Personendaten geschwärzt', 'Risiken mit Fundstelle'], video: 'modul-28-unterlagen-einlesen' },
    { nr: '05', phase: 'Rechnen', titel: 'Finanzierung und Cashflow', bild: D.STRECKE + '04-finanzierung.webp',
      text: 'Den indikativen Zins gibt es täglich aktuell je Zinsbindung und Beleihung. Ob die Finanzierung trägt, prüft der DSCR, die Beleihung der LTV. Darunter steht der Cashflow im Monat.',
      chips: ['Zins je Zinsbindung', 'Cashflow', 'DSCR und LTV'], video: 'modul-08-finanzierung' },
    { nr: '06', phase: 'Rechnen', titel: 'Steuer, AfA und Restnutzungsdauer', bild: D.STRECKE + '05-steuer.webp',
      text: 'Den Gebäudeanteil teilt DealPilot nach der Arbeitshilfe des Bundesfinanzministeriums auf, die Restnutzungsdauer folgt Anlage 2 ImmoWertV. Der Steuerverlauf zeigt den Wendepunkt.',
      chips: ['Kaufpreisaufteilung', 'AfA', 'Wendepunkt'], video: 'modul-27-steuerverlauf-mit-wendepunkt' },
    { nr: '07', phase: 'Bewerten', titel: 'Wertermittlung nach ImmoWertV', bild: D.STRECKE + '06-wertermittlung.webp',
      text: 'Lage, Bodenrichtwert, Zensus und Vergleichspreise, begründet mit Liegenschaftszinssätzen und Sachwertfaktoren der Gutachterausschüsse. Fehlt eine amtliche Zahl, wird keine erfunden.',
      chips: ['Bodenrichtwert', 'Ertrags- und Sachwert', 'Quellennachweis'], video: 'modul-24-bodenrichtwert-und-unterlagen' },
    { nr: '08', phase: 'Planen', titel: 'Mieterhöhung und Zielbild', bild: D.STRECKE + '07-zielbild.webp',
      text: 'Wohnung für Wohnung: was der Vertrag hergibt, was nach Mietspiegel und Kappungsgrenze verlangbar ist und was erst nach Umbau geht. Bis zum Wertzuwachs nach Kosten.',
      chips: ['Ankauf', 'Heute', 'Zielbild'], video: 'modul-26-mieterhoehung-und-zielbild' },
    { nr: '09', phase: 'Halten', titel: 'Vom Ankauf in den Bestand', bild: D.STRECKE + '08-bestand.webp',
      text: 'Gewonnen heißt eingefroren. Im Bestand vergleicht DealPilot Plan gegen heute. Für die Bank entstehen Investment-Case als PDF, Track-Record und Bankexport mit 25 Spalten je Objekt.',
      chips: ['Soll gegen Ist', 'Bank-PDF', 'Bankexport'], video: 'modul-14-ankauf-in-den-bestand' }
  ];

  /* Videos aus frontend/landing/assets/videothek/videos.json (Datei, Poster, Dauer in s) */
  D.VIDEOS = {
    'spot-das-haus-hab-ich': { nr: 'Spot', titel: 'Das Haus hab ich.', unter: 'Vom Exposé bis zum Kauf. Ein Objekt, ein Weg, in 90 Sekunden.', datei: 'dealpilot-spot-das-haus-hab-ich-v3730.mp4', poster: 'dealpilot-spot-das-haus-hab-ich.webp', dauer: 91 },
    'ueberblick-1-quick-boarding': { nr: 'Ü1', titel: 'Quick-Check', unter: 'Vom Exposé zum ersten Urteil in wenigen Minuten.', datei: 'dealpilot-ueberblick-1-quick-boarding-v3730.mp4', poster: 'dealpilot-ueberblick-1-quick-boarding.webp', dauer: 224 },
    'ueberblick-2-objekt-bis-investment-pdf': { nr: 'Ü2', titel: 'Vom neuen Objekt zum Investment-PDF', unter: 'Der ganze Weg am Stück, in fünf Minuten.', datei: 'dealpilot-ueberblick-2-objekt-bis-investment-pdf-v3730.mp4', poster: 'dealpilot-ueberblick-2-objekt-bis-investment-pdf.webp', dauer: 305 },
    'modul-12-bewertung-und-kpis': { nr: '12', titel: 'Bewertung und KPIs', unter: 'Das Gesamturteil, Investment und Finanzierung und jede Kennzahl dahinter.', datei: 'dealpilot-modul-12-bewertung-und-kpis.mp4', poster: 'dealpilot-modul-12-bewertung-und-kpis.webp', dauer: 262 },
    'modul-03-datenaufnahme-vier-wege': { nr: '03', titel: 'Datenaufnahme: vier Wege', datei: 'dealpilot-modul-03-datenaufnahme-vier-wege.mp4', poster: 'dealpilot-modul-03-datenaufnahme-vier-wege.webp', dauer: 212 },
    'modul-28-unterlagen-einlesen': { nr: '28', titel: 'Alle Unterlagen reinladen', datei: 'dealpilot-modul-28-alle-unterlagen-reinladen-v3730.mp4', poster: 'dealpilot-modul-28-alle-unterlagen-reinladen.webp', dauer: 307 },
    'modul-08-finanzierung': { nr: '08', titel: 'Finanzierung', datei: 'dealpilot-modul-08-finanzierung-v3730.mp4', poster: 'dealpilot-modul-08-finanzierung.webp', dauer: 353 },
    'modul-27-steuerverlauf-mit-wendepunkt': { nr: '27', titel: 'Steuerverlauf mit Wendepunkt', datei: 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.mp4', poster: 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.webp', dauer: 436 },
    'modul-24-bodenrichtwert-und-unterlagen': { nr: '24', titel: 'Bodenrichtwert und Unterlagen', datei: 'dealpilot-modul-24-bodenrichtwert-und-unterlagen.mp4', poster: 'dealpilot-modul-24-bodenrichtwert-und-unterlagen.webp', dauer: 195 },
    'modul-26-mieterhoehung-und-zielbild': { nr: '26', titel: 'Mieterhöhung und Zielbild', datei: 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.mp4', poster: 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.webp', dauer: 746 },
    'modul-14-ankauf-in-den-bestand': { nr: '14', titel: 'Vom Ankauf in den Bestand', datei: 'dealpilot-modul-14-ankauf-in-den-bestand-v3502.mp4', poster: 'dealpilot-modul-14-ankauf-in-den-bestand-v3502.webp', dauer: 178 },
    'modul-19-das-bank-pdf': { nr: '19', titel: 'Das Bank-PDF', datei: 'dealpilot-modul-19-das-bank-pdf-v3730.mp4', poster: 'dealpilot-modul-19-das-bank-pdf.webp', dauer: 254 }
  };
  D.VIDEOTHEK = ['spot-das-haus-hab-ich', 'ueberblick-1-quick-boarding', 'ueberblick-2-objekt-bis-investment-pdf', 'modul-12-bewertung-und-kpis'];
  D.dauer = function (s) { var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; };

  /* Gemessene Zahlen: datenumfang.js (18.11.2026) und register-stand.js (11.11.2026), wie im HTML der Landing */
  D.ZAHLEN = [
    { wert: 1100360, text: 'amtliche Datenpunkte in eigenen Datenbanken' },
    { wert: 6187, text: 'Kennzahlen von 201 Gutachterausschüssen' },
    { wert: 18318, text: 'Sätze im Register der Gutachterausschüsse' },
    { wert: 894880, text: 'Werte aus dem Zensus 2022 für 11.186 Gebiete' },
    { wert: 36, text: 'amtliche Dienste und Tabellen angebunden' },
    { wert: 109, text: 'Veröffentlichungsseiten, automatisch auf neue Berichte geprüft' },
    { wert: 1376, text: 'Tageswerte der Bundesbank für den Bauzins' },
    { wert: 84, text: 'automatische Prüfwerkzeuge für Rechnung und Daten' }
  ];
  D.HARD = [ ['30 s', 'vom Exposé zur Bewertung'], ['24', 'Kennzahlen hinter jedem Score'], ['19', 'Module an Bord'], ['> 870', 'registrierte Nutzer'] ];

  D.PREISE = [
    { name: 'Free', klasse: 'Economy', preis: '0', jahr: '4 Wochen Pro, keine Kreditkarte', punkte: ['1 Objekt', '4 Wochen voller Pro-Umfang', 'Co-Pilot: 10 Fragen am Tag'], knopf: 'Kostenlos starten' },
    { name: 'Starter', klasse: 'Premium Economy', preis: '19,99', jahr: 'oder 219 € im Jahr', punkte: ['5 Objekte', '5 Bewertungen im Monat', 'Investment-PDF ohne Wasserzeichen'], knopf: 'Starter wählen' },
    { name: 'Investor', klasse: 'Business', preis: '34,99', jahr: 'oder 384 € im Jahr', punkte: ['25 Objekte', 'Investor Deal Score (24 KPIs)', 'Track-Record-PDF und Bankexport'], knopf: 'Investor wählen', top: true },
    { name: 'Pro', klasse: 'First', preis: '49,99', jahr: 'oder 549 € im Jahr', punkte: ['Unbegrenzte Objekte', '15 Bewertungen im Monat', 'API-Zugang'], knopf: 'Pro wählen' }
  ];
  D.PARTNER = [
    ['Einladen', 'Per E-Mail oder Verbindungscode, mit Partnerplatz oder eigenem Abo.'],
    ['Freigeben lassen', 'Dein Kunde schickt dir Objekte oder seinen Bestand als Kopie.'],
    ['Anmerken', 'Feld markieren, Hinweis schreiben, Wert vorschlagen.'],
    ['Zurückgeben', 'Eine Rückmeldung mit Begleittext, auf Wunsch per E-Mail in deiner Marke.']
  ];

  /* ── Helfer ─────────────────────────────────────────────── */
  D.ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  D.de = function (n, nk) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: nk || 0, maximumFractionDigits: nk || 0 }); };
  D.zaehl = function (el, ziel, dauer, nk) {
    nk = nk || 0;
    if (D.ruhig || !dauer) { el.textContent = D.de(ziel, nk); return; }
    var start = performance.now(), von = parseFloat(el.dataset.von || 0);
    var lauf = el._lauf = {};
    (function schritt(t) {
      if (el._lauf !== lauf) return;
      var p = Math.min(1, (t - start) / dauer), e = 1 - Math.pow(1 - p, 3);
      el.textContent = D.de(von + (ziel - von) * e, nk);
      if (p < 1) requestAnimationFrame(schritt); else el.dataset.von = ziel;
    })(start);
  };
  D.sichtbar = function (sel, fn, opt) {
    var els = typeof sel === 'string' ? document.querySelectorAll(sel) : sel;
    if (!('IntersectionObserver' in window)) { Array.prototype.forEach.call(els, fn); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } });
    }, opt || { threshold: 0.25 });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  };
  D.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* Video-Fenster: ein <dialog>, das jede Seite selbst gestaltet (Klasse .dpn-dlg) */
  D.videoFenster = function () {
    var dlg = document.createElement('dialog');
    dlg.className = 'dpn-dlg';
    dlg.innerHTML = '<div class="dpn-dlg-kopf"><span class="dpn-dlg-t"></span><button type="button" class="dpn-dlg-x" aria-label="Schließen">×</button></div>'
      + '<video controls playsinline preload="none"></video>';
    document.body.appendChild(dlg);
    var v = dlg.querySelector('video');
    function zu() { try { v.pause(); } catch (e) {} v.removeAttribute('src'); v.load(); if (dlg.open) dlg.close(); }
    dlg.querySelector('.dpn-dlg-x').addEventListener('click', zu);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) zu(); });
    dlg.addEventListener('close', function () { try { v.pause(); } catch (e) {} });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-video]');
      if (!a) return;
      var x = D.VIDEOS[a.getAttribute('data-video')];
      if (!x) return;
      e.preventDefault();
      dlg.querySelector('.dpn-dlg-t').textContent = x.nr + ' · ' + x.titel;
      v.poster = D.BILD + x.poster;
      v.src = D.MEDIEN + x.datei;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
  };

  /* Maus-Neigung mit Glanzpunkt: setzt --rx --ry --gx --gy am Element */
  D.neigung = function (el, staerke) {
    if (D.ruhig || !el) return;
    staerke = staerke || 12;
    var ziel = { rx: 0, ry: 0, gx: 50, gy: 30 }, ist = { rx: 0, ry: 0, gx: 50, gy: 30 }, laeuft = false;
    function tick() {
      var fertig = true;
      ['rx', 'ry', 'gx', 'gy'].forEach(function (k) { ist[k] += (ziel[k] - ist[k]) * 0.12; if (Math.abs(ziel[k] - ist[k]) > 0.05) fertig = false; });
      el.style.setProperty('--rx', ist.rx.toFixed(2) + 'deg'); el.style.setProperty('--ry', ist.ry.toFixed(2) + 'deg');
      el.style.setProperty('--gx', ist.gx.toFixed(1) + '%'); el.style.setProperty('--gy', ist.gy.toFixed(1) + '%');
      if (!fertig) requestAnimationFrame(tick); else laeuft = false;
    }
    function los() { if (!laeuft) { laeuft = true; requestAnimationFrame(tick); } }
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ziel.ry = (x - 0.5) * staerke * 2; ziel.rx = -(y - 0.5) * staerke * 2; ziel.gx = x * 100; ziel.gy = y * 100; los();
    });
    el.addEventListener('pointerleave', function () { ziel.rx = 0; ziel.ry = 0; ziel.gx = 50; ziel.gy = 30; los(); });
  };
})();
