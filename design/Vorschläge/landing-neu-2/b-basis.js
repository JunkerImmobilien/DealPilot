/* landing-neu-2 · gemeinsame Daten und Bausteine der Ideen 06 bis 10 (Präfix b-)
   Zahlen: register-stand.js (DPS_REGISTER) und datenumfang.js (DPS_UMFANG) aus frontend/landing,
   Score der heutigen Hero-Karte (dp2.js CATS), Aufteilung Investment/Finanzierung nach
   dealscore2.js ZWEI_ZUORDNUNG (Profil Ausgewogen). Nur Vorlage, nicht eingebaut. */
(function () {
  'use strict';
  var L = '../../../frontend/landing/';
  var ruhig = false;
  try { ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── Score: dieselben fünf Bereiche wie die Hero-Karte (dp2.js) ──
     35×98 + 25×96 + 20×88 + 10×60 + 10×53 = 8.720 → 87,2 → 87
     Zwei Scores (dealscore2.js): Investment = Objektrendite 19,25 (Brutto/Netto, 55 % von Rendite)
     + Risiko 20 + Lage 10 + Potenzial 10. Finanzierung = Kapitaldienst & Beleihung 25 + Cashflow &
     EK-Rendite 15,75. Kennzahl-Punkte wie design/Vorschläge/score-animation-2/rechnung.mjs (Brutto 100,
     Netto 98, Cashflow 100, Cash-on-Cash 93, ergibt Rendite 98), gerechnet mit _zweiTeil():
     Objektrendite 99, Cashflow & EK-Rendite 97. Investment 80,911 → 81 · Finanzierung 96,344 → 96 · Mittel 87,2 → 87.
     Dieselben Zahlen wie idee-01 bis 05 (a-daten.js). */
  var SCORE = {
    gesamt: 87, kaufpreis: '180.000 €', kpis: '23/24', tiefe: '96 %',
    cats: [
      { n: 'Rendite', w: 35, s: 98, k: '4/4' },
      { n: 'Finanzierung', w: 25, s: 96, k: '5/5' },
      { n: 'Risiko', w: 20, s: 88, k: '5/6' },
      { n: 'Lage & Markt', w: 10, s: 60, k: '5/5' },
      { n: 'Potenzial', w: 10, s: 53, k: '4/4' }
    ],
    inv: { s: 81, frage: 'Wie gut ist die Immobilie, egal wie sie finanziert wird?',
      teile: [{ n: 'Objektrendite', s: 99, a: 32.5 }, { n: 'Risiko & Zustand', s: 88, a: 33.8 }, { n: 'Lage & Markt', s: 60, a: 16.9 }, { n: 'Potenzial & Preis', s: 53, a: 16.9 }] },
    fin: { s: 96, frage: 'Trägt die geplante Finanzierung dieses Objekt?',
      teile: [{ n: 'Kapitaldienst & Beleihung', s: 96, a: 61.3 }, { n: 'Cashflow & EK-Rendite', s: 97, a: 38.7 }] },
    anteilInv: 59.25, anteilFin: 40.75
  };
  function stufe(s) {
    if (s >= 85) return { w: 'Sehr gut', v: 'SEHR GUT', c: 'st-sg', f: '#E8CC7A' };
    if (s >= 70) return { w: 'Gut', v: 'GUT', c: 'st-g', f: '#3FA56C' };
    if (s >= 50) return { w: 'Solide', v: 'SOLIDE', c: 'st-s', f: '#C9A84C' };
    if (s >= 35) return { w: 'Schwach', v: 'SCHWACH', c: 'st-w', f: '#B8625C' };
    return { w: 'Kritisch', v: 'KRITISCH', c: 'st-k', f: '#B8625C' };
  }
  function farbe(s) { return s >= 70 ? '#3FA56C' : s >= 50 ? '#C9A84C' : '#B8625C'; }

  /* ── Etappen (Texte aus index.html, Strecke) ── */
  var B_ = L + 'assets/dp-strecke/';
  var ETAPPEN = [
    { nr: '01', wer: 'Quick-Check', t: 'Erst prüfen, dann erfassen', b: B_ + '00-quick-check.webp', v: 'ueberblick-1-quick-boarding',
      x: 'Alle Exposés und Dateien auf einmal hineinziehen. DealPilot liest sie aus, holt Marktwert und Miete dazu und zeigt in etwa einer halben Minute die Auswertung: Score, Rendite, Cashflow und ein klares Urteil gegen dein eigenes Ziel.' },
    { nr: '02', wer: 'Erfassen', t: 'Objekt erfassen', b: B_ + '01-objekt-erfassen.webp', v: 'modul-03-datenaufnahme-vier-wege',
      x: 'Exposé hineinziehen, frei erzählen, ein Inserat aus ImmoMetrica übernehmen oder Frage für Frage eingeben. Wie tief du gehst, wählst du selbst: Einsteiger, Fortgeschritten oder Experte.' },
    { nr: '03', wer: 'Prüfen', t: 'Rendite und Investor Deal Score', b: B_ + '02-score.webp', v: 'modul-12-bewertung-und-kpis',
      x: 'Der Score fasst 24 Kennzahlen in fünf Bereichen zusammen: Rendite, Finanzierung, Risiko, Lage und Potenzial. Getrennt nach Investment und Finanzierung steht am Ende eine Zahl von 0 bis 100 mit Stufe und Empfehlung.' },
    { nr: '04', wer: 'Prüfen', t: 'Unterlagen lesen', b: B_ + '03-unterlagen.webp', v: 'modul-28-unterlagen-einlesen',
      x: 'Mietaufstellung, Grundbuch, WEG-Protokolle und Energieausweis auf einmal hineinziehen. DealPilot erkennt jedes Dokument, schwärzt Personendaten und zeigt mit Fundstelle, was absehbar Geld kostet.' },
    { nr: '05', wer: 'Rechnen', t: 'Finanzierung und Cashflow', b: B_ + '04-finanzierung.webp', v: 'modul-08-finanzierung',
      x: 'Den indikativen Zins gibt es täglich aktuell je Zinsbindung und Beleihung. DealPilot zieht Bewirtschaftung, Zinsen und Tilgung ab und zeigt den Cashflow im Monat. Ob es trägt, prüft der DSCR.' },
    { nr: '06', wer: 'Rechnen', t: 'Steuer, AfA und Restnutzungsdauer', b: B_ + '05-steuer.webp', v: 'modul-27-steuerverlauf-mit-wendepunkt',
      x: 'Den Gebäudeanteil teilt DealPilot nach der Arbeitshilfe des Bundesfinanzministeriums auf, die Restnutzungsdauer folgt Anlage 2 ImmoWertV. Der Steuerverlauf zeigt, ab welchem Jahr das Objekt Steuern kostet.' },
    { nr: '07', wer: 'Bewerten', t: 'Wertermittlung nach ImmoWertV', b: B_ + '06-wertermittlung.webp', v: 'ueberblick-3-komplettbeispiel-mehrfamilienhaus',
      x: 'Lage, Bodenrichtwert, Zensus und Vergleichspreise, begründet mit Liegenschaftszinssätzen und Sachwertfaktoren der Gutachterausschüsse. Jede Zahl nennt ihre Herkunft. Fehlt eine amtliche Zahl, wird keine erfunden.' },
    { nr: '08', wer: 'Planen', t: 'Mieterhöhung und Zielbild', b: B_ + '07-zielbild.webp', v: 'modul-26-mieterhoehung-und-zielbild',
      x: 'Wohnung für Wohnung: was der Vertrag hergibt, was nach Mietspiegel und Kappungsgrenze verlangbar ist. Ankauf, heute, nach Mieterhöhung und Zielbild stehen nebeneinander, bis zum Wertzuwachs nach Kosten.' },
    { nr: '09', wer: 'Halten', t: 'Vom Ankauf in den Bestand', b: B_ + '08-bestand.webp', v: 'modul-14-ankauf-in-den-bestand',
      x: 'Gewonnen, eingefroren, verglichen: Plan gegen heute, Kennzahl für Kennzahl. Für die Bank entstehen Investment-Case als PDF, Track-Record und Bankexport mit 25 Spalten je Objekt.' }
  ];

  /* ── Videothek (Auswahl aus assets/videothek/videos.json, Unterzeilen ohne Gedankenstrich) ── */
  var MED = 'https://dealpilot.immo/medien/videothek/';
  var POS = L + 'assets/videothek/';
  function vd(id, nr, t, u, d, f, p) { return { id: id, nr: nr, t: t, u: u, d: d, src: MED + f, poster: POS + p, link: 'https://dealpilot.immo/videothek.html?v=' + id }; }
  var VIDEOS = [
    vd('spot-das-haus-hab-ich', 'Spot', 'Das Haus hab ich.', 'Vom Exposé bis zum Kauf. Ein Objekt, ein Weg, in 90 Sekunden.', 91, 'dealpilot-spot-das-haus-hab-ich-v3730.mp4', 'dealpilot-spot-das-haus-hab-ich.webp'),
    vd('ueberblick-1-quick-boarding', 'Ü1', 'Quick-Check', 'Vom Exposé zum ersten Urteil, in wenigen Minuten.', 224, 'dealpilot-ueberblick-1-quick-boarding-v3730.mp4', 'dealpilot-ueberblick-1-quick-boarding.webp'),
    vd('ueberblick-2-objekt-bis-investment-pdf', 'Ü2', 'Vom neuen Objekt zum Investment-PDF', 'Der ganze Weg am Stück, in fünf Minuten.', 305, 'dealpilot-ueberblick-2-objekt-bis-investment-pdf-v3730.mp4', 'dealpilot-ueberblick-2-objekt-bis-investment-pdf.webp'),
    vd('modul-12-bewertung-und-kpis', '12', 'Bewertung und KPIs', 'Das Gesamturteil, Investment und Finanzierung und jede Kennzahl dahinter.', 262, 'dealpilot-modul-12-bewertung-und-kpis.mp4', 'dealpilot-modul-12-bewertung-und-kpis.webp'),
    vd('modul-28-unterlagen-einlesen', '28', 'Alle Unterlagen reinladen', 'Dreizehn PDFs, eine Übernahme und was der Detailgrad damit macht.', 307, 'dealpilot-modul-28-alle-unterlagen-reinladen-v3730.mp4', 'dealpilot-modul-28-alle-unterlagen-reinladen.webp'),
    vd('modul-08-finanzierung', '08', 'Finanzierung', 'Wie der Zins entsteht und wo du die Standardwerte setzt.', 353, 'dealpilot-modul-08-finanzierung-v3730.mp4', 'dealpilot-modul-08-finanzierung.webp'),
    vd('modul-27-steuerverlauf-mit-wendepunkt', '27', 'Steuerverlauf mit Wendepunkt', 'Wann ein Objekt steuerlich positiv wird und warum das der Zeitpunkt fürs nächste Investment ist.', 436, 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.mp4', 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.webp'),
    vd('modul-26-mieterhoehung-und-zielbild', '26', 'Mieterhöhung und Zielbild', 'Wohnung für Wohnung. Ist, Soll und Zielbild bis zum Wertpotenzial.', 746, 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.mp4', 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.webp'),
    vd('modul-10b-bmf-kaufpreisaufteilung', '10b', 'BMF-Kaufpreisaufteilung', 'Gebäude und Boden, Bodenabschlag, Notarklausel, 15-%-Grenze.', 293, 'dealpilot-modul-10b-bmf-kaufpreisaufteilung-v3730.mp4', 'dealpilot-modul-10b-bmf-kaufpreisaufteilung.webp'),
    vd('modul-19-das-bank-pdf', '19', 'Das Bank-PDF', 'Deine Marke, die Bankfassung und was die Bank als Investment Case bekommt.', 254, 'dealpilot-modul-19-das-bank-pdf-v3730.mp4', 'dealpilot-modul-19-das-bank-pdf.webp'),
    vd('modul-21-portfolio-cockpit-und-pilot', '21', 'Portfolio-Cockpit und Pilot', 'Alle Objekte auf einer Seite und ein Pilot, der sie kennt.', 170, 'dealpilot-modul-21-portfolio-cockpit-und-pilot-v3730.mp4', 'dealpilot-modul-21-portfolio-cockpit-und-pilot.webp'),
    vd('modul-29-drei-objekte-drei-urteile', '29', 'Drei Objekte, drei Urteile', 'Ein gutes, ein mittleres und ein schwaches Objekt: was der Pilot jeweils sagt.', 263, 'dealpilot-modul-29-drei-objekte-drei-urteile-v3502.mp4', 'dealpilot-modul-29-drei-objekte-drei-urteile-v3502.webp')
  ];
  function dauer(s) { var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }

  /* ── Preise (index.html, Stand heute) ── */
  var APP = 'https://app.dealpilot.immo/?register=1';
  var PREISE = [
    { n: 'Free', kl: 'Economy', wer: 'Einstieg · Testflug', m: '0', j: null, no: '4 Wochen Pro, keine Kreditkarte', f: ['1 Objekt', '4 Wochen voller Pro-Umfang', 'Co-Pilot: 10 Fragen am Tag'], cta: 'Kostenlos starten', plan: 'free' },
    { n: 'Starter', kl: 'Premium Economy', wer: 'Privat-Investor', m: '19,99', j: '219', f: ['5 Objekte', '5 Bewertungen im Monat', 'Investment-PDF ohne Wasserzeichen', 'Co-Pilot: 20 Fragen am Tag'], cta: 'Starter wählen', plan: 'starter' },
    { n: 'Investor', kl: 'Business', wer: 'Aktiver Investor', m: '34,99', j: '384', best: true, f: ['25 Objekte', '10 Bewertungen im Monat', 'Investor Deal Score (24 KPIs)', 'Track-Record-PDF und Bankexport'], cta: 'Investor wählen', plan: 'investor' },
    { n: 'Pro', kl: 'First', wer: 'Profi', m: '49,99', j: '549', f: ['Unbegrenzte Objekte', '15 Bewertungen im Monat', 'Alle Investor-Funktionen', 'API-Zugang'], cta: 'Pro wählen', plan: 'pro' }
  ];

  /* ── Fragen (inhaltlich aus fragen.html, gekürzt) ── */
  var FRAGEN = [
    ['Was kostet der Einstieg?', 'Nichts. Das Free-Paket ist dauerhaft kostenlos, und die ersten vier Wochen läuft jedes neue Konto mit dem vollen Pro-Umfang. Ohne Zahlungsdaten und ohne Kündigung, danach wird daraus automatisch Free.'],
    ['Muss ich alles eintippen?', 'Nein. Du lädst das Exposé hoch, diktierst das Objekt, liest Belege ein oder übernimmst ein Inserat aus ImmoMetrica. Die Wege lassen sich mischen.'],
    ['Wie schnell sehe ich eine belastbare Zahl?', 'Der Quick-Check braucht sechs Angaben und etwa eine Minute. Ein vollständig gerechnetes Objekt mit Finanzierung, Steuerwirkung und Deal Score steht nach zehn bis zwanzig Minuten.'],
    ['Sind die Werte amtlich oder geschätzt?', 'Jede Zahl trägt ihre Herkunft mit Quelle, Jahrgang und Stichtag. Bodenrichtwerte kommen aus den amtlichen Portalen der Länder, Liegenschaftszinssätze und Sachwertfaktoren von den Gutachterausschüssen. Fehlt eine amtliche Zahl, wird keine erfunden.'],
    ['Sind die Marktzinsen wirklich aktuell?', 'Ja. Sie werden arbeitstäglich aus der Zinsstruktur nachgezogen, je Zinsbindung. Jede Kachel nennt die Rendite und die Marge getrennt, so siehst du, woraus der Satz entsteht.'],
    ['Kann ich monatlich kündigen?', 'Ja, alle Pakete sind monatlich kündbar. Beim Jahrestarif zahlst du zwölf Monate im Voraus und sparst rund 17 Prozent.']
  ];

  /* ── Zahlen aus den gemessenen Dateien ── */
  function kopf() { return (window.DPS_UMFANG && window.DPS_UMFANG.kopf) || {}; }
  function reg() { return (window.DPS_REGISTER && window.DPS_REGISTER.kopf) || {}; }
  function fmt(n, st) {
    if (n == null || !isFinite(n)) return '–';
    return Number(n).toLocaleString('de-DE', { minimumFractionDigits: st || 0, maximumFractionDigits: st || 0 });
  }
  function ZAHLEN() {
    var k = kopf(), r = reg();
    return [
      { z: k.amtlich_gesamt, t: 'amtliche Datenpunkte in unseren Datenbanken' },
      { z: k.schnittstellen, t: 'amtliche Dienste und Tabellen angebunden' },
      { z: r.werte_gesamt || k.register_werte, t: 'Kennzahlen von ' + fmt(r.ausschuesse || k.ausschuesse) + ' Gutachterausschüssen' },
      { z: k.portale, t: 'Veröffentlichungsseiten der Ausschüsse, automatisch geprüft' },
      { z: k.zensus, t: 'Zensuswerte bis auf die Gemeinde' },
      { z: k.register_saetze, t: 'Sätze im Register der Gutachterausschüsse' },
      { z: k.pruefstrecken, t: 'automatische Prüfwerkzeuge für Rechnung und Daten' },
      { z: k.videos, t: 'Videos in der Videothek, ' + fmt(k.video_stunden, 1) + ' Stunden' }
    ];
  }
  function HERO() {
    var k = kopf(), r = reg();
    return [
      { z: 30, e: ' s', t: 'vom Exposé zur Bewertung' },
      { z: 24, t: 'KPIs hinter jedem Score' },
      { z: 19, t: 'Module an Bord' },
      { z: k.nutzer_rund || 870, v: '> ', t: 'registrierte Nutzer' },
      { z: r.werte_gesamt || 6187, t: 'amtliche Werte im Register' },
      { z: r.ausschuesse || 201, t: 'Gutachterausschüsse mit Werten' }
    ];
  }

  /* ── Helfer ── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function sichtbar(el, cb, opt) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { cb(e.target); if (!(opt && opt.immer)) io.unobserve(e.target); } });
    }, { threshold: (opt && opt.schwelle) || 0.2, rootMargin: (opt && opt.rand) || '0px' });
    io.observe(el);
  }
  function zaehle(el, ziel, ms, st) {
    if (!el) return;
    st = st || 0;
    if (ruhig) { el.textContent = fmt(ziel, st); return; }
    var t0 = null; ms = ms || 1600;
    function f(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(ziel * e, st);
      if (p < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }
  function zaehlerAn(root) {
    $$('[data-b-zaehl]', root).forEach(function (el) {
      if (el._bz) return; el._bz = 1;
      if (ruhig) { el.textContent = fmt(Number(el.getAttribute('data-b-zaehl')), Number(el.getAttribute('data-st')) || 0); return; }
      sichtbar(el, function () { zaehle(el, Number(el.getAttribute('data-b-zaehl')), Number(el.getAttribute('data-ms')) || 1600, Number(el.getAttribute('data-st')) || 0); }, { schwelle: 0.4 });
    });
  }
  function aufdecken() { $$('.rv').forEach(function (el) { sichtbar(el, function () { el.classList.add('an'); }, { schwelle: 0.12 }); }); }
  function navFest() {
    var n = $('.b-nav'); if (!n) return;
    function f() { n.classList.toggle('fest', scrollY > 30); }
    addEventListener('scroll', f, { passive: true }); f();
  }

  /* Lichtkasten für die Videothek */
  var kasten;
  function spielen(v) {
    if (!kasten) {
      kasten = document.createElement('div');
      kasten.className = 'b-kasten'; kasten.setAttribute('role', 'dialog'); kasten.setAttribute('aria-modal', 'true'); kasten.setAttribute('aria-label', 'Video');
      kasten.innerHTML = '<button class="b-zu" aria-label="Schließen">×</button><figure><video controls playsinline preload="metadata"></video><figcaption><span><b></b> <span class="u"></span></span><a target="_blank" rel="noopener">In der Videothek öffnen →</a></figcaption></figure>';
      document.body.appendChild(kasten);
      function zu() { var vi = $('video', kasten); vi.pause(); kasten.classList.remove('auf'); }
      $('.b-zu', kasten).addEventListener('click', zu);
      kasten.addEventListener('click', function (e) { if (e.target === kasten) zu(); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && kasten.classList.contains('auf')) zu(); });
    }
    var vi = $('video', kasten);
    vi.poster = v.poster; vi.src = v.src;
    $('figcaption b', kasten).textContent = v.nr + ' · ' + v.t;
    $('figcaption .u', kasten).textContent = v.u;
    $('figcaption a', kasten).href = v.link;
    kasten.classList.add('auf'); $('.b-zu', kasten).focus();
    var p = vi.play(); if (p && p.catch) p.catch(function () {});
  }
  /* Vorschau stumm beim Überfahren (nur mit Maus und ohne „weniger Bewegung") */
  function vorschauBeiHover(box, v) {
    if (ruhig || !matchMedia('(hover:hover)').matches) return;
    var vid = $('video', box); if (!vid) return;
    box.addEventListener('mouseenter', function () { if (!vid.src) vid.src = v.src; var p = vid.play(); if (p && p.catch) p.catch(function () {}); });
    box.addEventListener('mouseleave', function () { vid.pause(); });
  }

  function bauePreise(host) {
    if (!host) return;
    host.innerHTML = '<div class="b-seg" role="group" aria-label="Abrechnung"><button class="on" data-z="m">Monatlich</button><button data-z="j">Jährlich<small>−17 %</small></button></div>'
      + '<div class="b-tarife">' + PREISE.map(function (p, i) {
        return '<article class="b-tarif' + (p.best ? ' best' : '') + ' rv" style="transition-delay:' + (i * 90) + 'ms">'
          + (p.best ? '<span class="bs">★ Bestseller</span>' : '')
          + '<div class="kl">' + p.kl + ' · DP-0' + (i + 1) + '</div><h3>' + p.n + '</h3><div class="wer">' + p.wer + '</div>'
          + '<div class="pr" data-m="' + p.m + '" data-j="' + (p.j || '') + '">' + p.m + ' €<small>/ Monat</small></div>'
          + '<div class="no" data-no-m="' + (p.no || (p.j ? 'oder ' + p.j + ' € im Jahr' : '')) + '">' + (p.no || (p.j ? 'oder ' + p.j + ' € im Jahr' : '')) + '</div>'
          + '<ul>' + p.f.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>'
          + '<a class="b-btn ' + (p.best ? 'b-btn-p' : 'b-btn-l') + '" href="https://app.dealpilot.immo/?register=1&plan=' + p.plan + '">' + p.cta + '</a></article>';
      }).join('') + '</div>'
      + '<p class="b-tarif-mehr">Keine Zahlungsdaten · 4 Wochen voller Pro-Umfang · danach automatisch Free, ohne Kündigung. <a href="' + L + 'preise.html">Alle Leistungen der Pakete</a></p>';
    $$('.b-seg button', host).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.b-seg button', host).forEach(function (x) { x.classList.toggle('on', x === b); });
        var j = b.getAttribute('data-z') === 'j';
        $$('.pr', host).forEach(function (pr) {
          var jv = pr.getAttribute('data-j');
          pr.innerHTML = (j && jv ? jv + ' €<small>/ Jahr</small>' : pr.getAttribute('data-m') + ' €<small>/ Monat</small>');
          pr.animate && !ruhig && pr.animate([{ transform: 'rotateX(90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        });
      });
    });
  }
  /* Einer reicht nicht. Zwei Scores. (Marcel 19.11.2026) */
  function baueZwei(host, opt) {
    if (!host) return;
    opt = opt || {};
    function karte(seite, name, t) {
      var st = stufe(t.s), off = 289 * (1 - t.s / 100);
      return '<article class="b-zk ' + seite + '"><div class="k"><div class="ring"><svg viewBox="0 0 110 110" aria-hidden="true"><circle class="tr" cx="55" cy="55" r="46"/><circle class="pg" cx="55" cy="55" r="46" style="stroke:' + st.f + '" data-off="' + off + '"/></svg><b data-b-zaehl="' + t.s + '">0</b></div>'
        + '<div><span class="st ' + st.c + '">' + st.v + '</span><h3>' + name + '</h3><p class="fr">' + t.frage + '</p></div></div>'
        + '<ul>' + t.teile.map(function (x, i) { return '<li><div><span>' + x.n + ' <small>' + fmt(x.a, 1) + ' %</small></span><b>' + x.s + '</b></div><i style="--w:' + x.s + '%;--c:' + farbe(x.s) + ';--d:' + (0.6 + i * 0.15) + 's"></i></li>'; }).join('') + '</ul></article>';
    }
    host.innerHTML = '<div class="b-ctr"><div class="b-eye">' + (opt.eye || 'Zwei Scores') + '</div><h2 class="b-h2">Einer reicht nicht. <span class="ac">Zwei Scores.</span></h2>'
      + '<p class="b-lead">Dein Objekt kann gut sein und deine Finanzierung nicht. Oder umgekehrt. Darum trennt DealPilot den Investment-Score für die Immobilie vom Finanzierungs-Score für das Darlehen und führt beide zum Investor Deal Score zusammen.</p></div>'
      + '<div class="b-zwei-g">' + karte('l', 'Investment-Score', SCORE.inv)
      + '<div class="b-zmitte"><span class="op">' + fmt(SCORE.anteilInv, 0) + ' % OBJEKT</span><span class="lin"></span><div class="ges"><div><b data-b-zaehl="' + SCORE.gesamt + '">0</b><br><small>' + stufe(SCORE.gesamt).v + '</small></div></div><span class="lin" style="transform:rotate(180deg)"></span><span class="op">' + fmt(SCORE.anteilFin, 0) + ' % DARLEHEN</span></div>'
      + karte('r', 'Finanzierungs-Score', SCORE.fin) + '</div>'
      + '<p class="b-zfuss">Beispieldaten. Die Kennzahlen behalten ihr Gewicht aus dem Bewertungsprofil, die zwei Scores teilen sie nur auf.</p>';
    sichtbar(host, function () {
      host.classList.add('an');
      $$('.pg', host).forEach(function (c) { c.style.strokeDashoffset = c.getAttribute('data-off'); });
    }, { schwelle: 0.25 });
  }
  function baueFragen(host) {
    if (!host) return;
    host.innerHTML = FRAGEN.map(function (f) { return '<details class="rv"><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>'; }).join('')
      + '<p class="b-hinweis" style="margin-top:22px">Mehr Antworten: <a href="' + L + 'fragen.html" style="color:var(--gh)">Häufige Fragen</a></p>';
  }
  function baueZahlen(host) {
    if (!host) return;
    host.innerHTML = ZAHLEN().map(function (z) { return '<div><b data-b-zaehl="' + z.z + '">0</b><span>' + z.t + '</span></div>'; }).join('');
    zaehlerAn(host);
  }
  function baueFuss(host, idee) {
    if (!host) return;
    host.innerHTML = '<div class="b-wrap"><a class="b-logo" href="index.html"><img src="' + L + 'assets/dealpilot-logo.png" alt="" width="32" height="32">Deal<b>Pilot</b></a>'
      + '<nav><a href="' + L + 'preise.html">Preise</a><a href="' + L + 'videothek.html">Videothek</a><a href="' + L + 'methodik.html">Methodik</a><a href="' + L + 'fragen.html">Häufige Fragen</a><a href="' + L + 'partner.html">Für Partner</a></nav>'
      + '<span class="b-hinweis">Vorschlag ' + idee + ' · Ansichten und Score mit Beispieldaten · Junker Solution</span></div>';
  }
  function baueNav(host, idee) {
    if (!host) return;
    host.innerHTML = '<div class="b-wrap"><a class="b-logo" href="index.html"><img src="' + L + 'assets/dealpilot-logo.png" alt="" width="32" height="32">Deal<b>Pilot</b></a>'
      + '<span class="b-idee">IDEE ' + idee + '</span>'
      + '<ul><li><a href="#etappen">So fliegt ein Deal</a></li><li><a href="#videothek">Videothek</a></li><li><a href="#daten">Datenbasis</a></li><li><a href="#preise">Preise</a></li></ul>'
      + '<a class="b-btn b-btn-p" href="' + APP + '">Kostenlos starten</a></div>';
  }

  window.B = {
    L: L, APP: APP, ruhig: ruhig, SCORE: SCORE, ETAPPEN: ETAPPEN, VIDEOS: VIDEOS, PREISE: PREISE, FRAGEN: FRAGEN,
    ZAHLEN: ZAHLEN, HERO: HERO, stufe: stufe, farbe: farbe, fmt: fmt, dauer: dauer,
    $: $, $$: $$, sichtbar: sichtbar, zaehle: zaehle, zaehlerAn: zaehlerAn, aufdecken: aufdecken,
    spielen: spielen, vorschauBeiHover: vorschauBeiHover,
    bauePreise: bauePreise, baueZwei: baueZwei, baueFragen: baueFragen, baueZahlen: baueZahlen, baueFuss: baueFuss, baueNav: baueNav,
    start: function (idee) {
      baueNav($('.b-nav'), idee); navFest();
      baueZwei($('#b-zwei')); bauePreise($('#b-preise')); baueFragen($('#b-fragen')); baueZahlen($('#b-zahlen')); baueFuss($('.b-fuss'), idee);
      aufdecken(); zaehlerAn(document);
    }
  };
})();
