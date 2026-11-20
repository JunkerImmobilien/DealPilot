/* ═══════════════════════════════════════════════════════════════════════
   landing-neu-6 · gemeinsam.js · Vorlage, NICHT eingebaut (20.11.2026)

   Grundlage: landing-neu-5 Variante 5 (heutige Landing, Streifen direkt
   unter dem Hero). In ALLEN sechs Varianten stecken:
     1 Streifen mit Absprung: jedes Bild springt in die Videothek, zu dem
       Kapitel und der Sekunde aus frontend/messe-schleife/videothek-liste.js
       (Zuordnung unten in D.streifen, geprüft vom Vorlagen-Prüfer).
     2 Videothek als Slider mit Abspielfläche, von überall anspringbar:
       N6.vt.oeffne(id, sekunde). Jeder Verweis videothek.html?v=…&t=… auf
       der Seite landet dort.
     3 Riss und Aufklappen der Hero-Karte in Investment- und Finanzierungs-
       Score (Bewegung aus score-animation-2/1-riss-aufklappen.html, über
       landing-neu-4/gemeinsam.js zweiBuehne). Zahlen 81 / 97, Anteile
       59,3 / 40,8 aus landing-neu-4 (mit den echten Kernen gerechnet).
     4 Startbahn: viele Unterlagen, nacheinander eingelesen, am Ende hebt
       der Score ab. Nur Arten, die DealPilot nachweislich ausliest
       (Fundstellen in D.unterlagen).

   Videos: die MP4 liegen nicht im Git. Auf dealpilot.immo lädt die
   Abspielfläche medien/videothek/<datei> und startet an der Sekunde, in der
   Vorlage steht dort das Vorschaubild mit Kapitel und Sprungmarke.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (ruhig) document.documentElement.classList.add('n6-ruhig', 'n5-ruhig');
  var LIVE = /(^|\.)dealpilot\.immo$/.test(location.hostname);

  /* ── Vorlage ohne Netz (wie landing-neu-5) ───────────────────────── */
  var _fetch = window.fetch;
  window.fetch = function (u, o) {
    var s = typeof u === 'string' ? u : (u && u.url) || '';
    if (/\/api\/v1\//.test(s) && !LIVE) return Promise.resolve(new Response('null', { status: 503, headers: { 'Content-Type': 'application/json' } }));
    return _fetch.call(this, u, o);
  };
  var md = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true, get: md.get,
    set: function (v) { if (!LIVE && /(^|\/)medien\//.test(String(v))) return; md.set.call(this, v); }
  });

  /* ── Hilfen ───────────────────────────────────────────────────────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ein3(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(n) { return Number(n).toLocaleString('de-DE'); }
  function mmss(s) { s = Math.max(0, Math.round(s || 0)); return s >= 3600 ? Math.floor(s / 3600) + ':' + ('0' + Math.floor(s % 3600 / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2) : Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  /* Kundentext: nur Punkt und Komma */
  function sauber(t) { return String(t || '').replace(/\s*[—–]\s*/g, ', ').replace(/;/g, ','); }
  function anim(el, kf, o) {
    if (!el || ruhig) return Promise.resolve();
    o = Object.assign({ duration: 600, easing: 'cubic-bezier(.2,.72,.2,1)', fill: 'both' }, o || {});
    return el.animate(kf, o).finished.catch(function () {});
  }
  function sichtbar(el, fn, schwelle) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, { threshold: schwelle == null ? .3 : schwelle });
    io.observe(el);
  }
  function zaehle(el, ziel, ms, opt) {
    opt = opt || {};
    var von = opt.von || 0, t0 = null, nach = opt.nach || '';
    if (ruhig || !ms) { el.textContent = fmt(ziel) + nach; return Promise.resolve(); }
    return new Promise(function (ok) {
      function s(t) {
        if (t0 == null) t0 = t;
        var x = Math.min(1, (t - t0) / ms);
        el.textContent = fmt(Math.round(von + (ziel - von) * ein3(x))) + nach;
        if (x < 1) requestAnimationFrame(s); else ok();
      }
      requestAnimationFrame(s);
    });
  }
  function rel(el, bezug) { var a = el.getBoundingClientRect(), b = bezug.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; }

  /* ══ Daten ═══════════════════════════════════════════════════════════ */
  var GRN = '#3FA56C', GOLD = '#C9A84C';
  var D = {
    balken: [ /* dp2.js CATS */
      ['Rendite', 35, 98, '4/4', 4], ['Finanzierung', 25, 96, '5/5', 5], ['Risiko', 20, 88, '5/6', 5],
      ['Lage & Markt', 10, 60, '5/5', 5], ['Upside / Potenzial', 10, 53, '4/4', 4]
    ],
    /* Zwei Scores, landing-neu-4/gemeinsam.js Z.54-69 (echte Kerne am Beispielobjekt der Hero-Karte) */
    inv: { key: 'inv', titel: 'Investment-Score', score: 81, anteil: '59,3', gruppen: [['Objektrendite', '32,5', 98], ['Risiko & Zustand', '33,8', 88], ['Lage & Markt', '16,9', 60], ['Potenzial & Preis', '16,9', 53]] },
    fin: { key: 'fin', titel: 'Finanzierungs-Score', score: 97, anteil: '40,8', gruppen: [['Kapitaldienst & Beleihung', '61,3', 96], ['Cashflow & EK-Rendite', '38,7', 97]] },

    /* 1 · Streifen: Bild → Video → Kapitel → Sekunde (Kapitel und Zeit wörtlich aus videothek-liste.js).
       [Bild, Ausschnitt (Größe, x, y) oder null, Etikett, Titel, Video-ID, Kapitel, Sekunde] */
    streifen: [
      ['01-objekt-erfassen.webp', null, 'Etappe 02 · Erfassen', 'Objekt erfassen', 'modul-03-datenaufnahme-vier-wege', 'Anhaken, dann Abrufen', 26],
      ['02-score.webp', null, 'Etappe 03 · Prüfen', 'Rendite und Investor Deal Score', 'modul-12-bewertung-und-kpis', 'Das Gesamturteil', 27],
      ['02-score.webp', [205, 0, 62], 'Auszug · Etappe 03', 'Investment-Score', 'modul-12-bewertung-und-kpis', 'Investment', 69],
      ['02-score.webp', [205, 100, 50], 'Auszug · Etappe 03', 'Finanzierungs-Score', 'modul-12-bewertung-und-kpis', 'Finanzierung', 91],
      ['03-unterlagen.webp', null, 'Etappe 04 · Prüfen', 'Unterlagen lesen', 'modul-28-unterlagen-einlesen', 'Die Auswertung', 189],
      ['04-finanzierung.webp', null, 'Etappe 05 · Rechnen', 'Finanzierung und Cashflow', 'modul-08-finanzierung', 'Der indikative Zins', 31],
      ['04-finanzierung.webp', [190, 100, 10], 'Auszug · Etappe 05', 'Zins je Zinsbindung und Beleihung', 'modul-08-finanzierung', 'Zuschlag nach Beleihung', 53],
      ['05-steuer.webp', null, 'Etappe 06 · Rechnen', 'Steuer, AfA und Restnutzungsdauer', 'modul-27-steuerverlauf-mit-wendepunkt', 'Steuerverlauf', 50],
      ['05-steuer.webp', [200, 0, 14], 'Auszug · Etappe 06', 'Der Zeitpunkt fürs nächste Investment', 'modul-27-steuerverlauf-mit-wendepunkt', 'Der Zeitpunkt fürs nächste Investment', 213],
      ['06-wertermittlung.webp', null, 'Etappe 07 · Bewerten', 'Wertermittlung nach ImmoWertV', 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', 'Kapitel 7 · Marktbericht und Wertermittlung', 1250],
      ['06-wertermittlung.webp', [200, 50, 8], 'Auszug · Etappe 07', 'Ertragswert mit Liegenschaftszins', 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', 'Der Liegenschaftszins', 1419],
      ['06-wertermittlung.webp', [200, 0, 100], 'Auszug · Etappe 07', 'Bodenrichtwert', 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', 'Bodenrichtwert und Modernisierung', 318],
      ['07-zielbild.webp', null, 'Etappe 08 · Planen', 'Mieterhöhung und Zielbild', 'modul-26-mieterhoehung-und-zielbild', 'Tab Bewertung', 649],
      ['08-bestand.webp', null, 'Etappe 09 · Halten', 'Vom Ankauf in den Bestand', 'modul-14-ankauf-in-den-bestand', 'Was sich bewegt hat', 119]
    ],
    /* Etappe 01 der Strecke (HTML-Karte, kein Bild): Urteil gegen das eigene Ziel */
    etappeQc: ['ueberblick-1-quick-boarding', 'Gegen deine Lage', 141],

    /* 4 · Unterlagen, die DealPilot nachweislich ausliest (Fundstelle im Code).
       ziel: Balken der Karte (Index in balken) oder 'kp'. Werte nur beim Exposé (Beispieldaten aus landing-neu-4). */
    unterlagen: [
      { id: 'expose', art: 'Exposé', titel: 'Ruhige Lage, solide vermietet', unter: 'Angebot · Beispieldaten', foto: 'assets/bild/haus.jpg',
        quelle: 'backend/src/routes/ai.js:889 POST /ai/extract-expose',
        felder: [['Kaufpreis', '180.000 €', 'kp'], ['Wohnfläche', '100 m²', 0], ['Kaltmiete', '1.300 € / Monat', 0], ['Energieklasse', 'D', 0], ['Zustand', 'gut', 0]], anteil: [0, 1] },
      { id: 'darlehen', art: 'Darlehensvertrag', titel: 'Darlehensvertrag der Bank', unter: 'PDF der Bank · Beispiel',
        quelle: 'frontend/js/financing-pdf.js (Sollzins, Darlehen, Tilgung, Bindung) · darlehen-weitere-ui.js:131 „Daten aus Bank-PDF importieren“',
        felder: [['Darlehenssumme', '', 1], ['Sollzins', '', 1], ['Tilgung', '', 1], ['Zinsbindung', '', 1]], anteil: [1, 1] },
      { id: 'marktbericht', art: 'Marktbericht', titel: 'Grundstücksmarktbericht', unter: 'des Gutachterausschusses',
        quelle: 'backend/src/services/dokumentSchemas.js:138 und :569 (Typ marktbericht)',
        felder: [['Liegenschaftszinssatz', '', 3], ['Sachwertfaktor', '', 3], ['Bodenrichtwert', '', 3], ['Durchschnittsmiete', '', 3]], anteil: [3, 1] },
      { id: 'grundbuch', art: 'Grundbuch', titel: 'Grundbuchauszug', unter: 'Personendaten geschwärzt', text: 1,
        quelle: 'dokumentSchemas.js:44 und :228 (Typ grundbuch, Namen vorher geschwärzt)',
        felder: [['Abteilung II, Lasten', '', 2], ['Abteilung III, Grundschulden', '', 2], ['Miteigentumsanteil', '', 2]], anteil: [2, .25] },
      { id: 'weg', art: 'WEG-Protokoll', titel: 'Protokoll der Eigentümerversammlung', unter: 'Beschlüsse und Rücklage',
        quelle: 'dokumentSchemas.js:64 und :293 (Typ weg_protokoll)',
        felder: [['Erhaltungsrücklage', '', 2], ['Hausgeld', '', 2], ['Sonderumlagen', '', 2], ['Geplante Sanierungen', '', 2]], anteil: [2, .5] },
      { id: 'mieter', art: 'Mieterliste', titel: 'Mietaufstellung', unter: 'jede Einheit, ohne Mieternamen',
        quelle: 'dokumentSchemas.js:114 und :519 (Typ mietaufstellung)',
        felder: [['Einheiten', '', 4], ['Kaltmiete je Einheit', '', 4], ['Wohnfläche', '', 4], ['Stichtag', '', 4]], anteil: [4, 1] },
      { id: 'energie', art: 'Energieausweis', titel: 'Energieausweis nach GEG', unter: 'Bedarf oder Verbrauch',
        quelle: 'dokumentSchemas.js:99 und :449 (Typ energieausweis)',
        felder: [['Effizienzklasse', '', 2], ['Endenergie', '', 2], ['Modernisierungsempfehlungen', '', 2]], anteil: [2, .75] },
      { id: 'fotos', art: 'Objektfotos', titel: 'Zustand je Gewerk', unter: 'aus bis zu acht Fotos', fotos: ['assets/bild/haus.jpg', 'assets/bild/mfh-gerberstrasse.webp', 'assets/bild/mfh-gerberstrasse-alt.webp', 'assets/bild/hero.jpg'],
        quelle: 'backend/src/routes/ai.js:919-929 POST /ai/extract-zustand-bilder (openaiService.zustandAusBildern)',
        felder: [['Dach und Fenster', '', 2], ['Heizung und Leitungen', '', 2], ['Bäder und Innenausbau', '', 2]], anteil: [2, 1] }
    ]
  };

  /* ══ Score-Karte (Markup wie index.html Z.190-217) ══════════════════ */
  function qrSvg() {
    var n = 11, cell = 3, svg = '<svg width="33" height="33" viewBox="0 0 33 33" aria-hidden="true">', seed = 7;
    function fp(x, y) { return '<rect x="' + x + '" y="' + y + '" width="21" height="21" fill="#0c0b09"/><rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="15" height="15" fill="#fff"/><rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="9" height="9" fill="#0c0b09"/>'; }
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if ((x < 7 && y < 7) || (x > 3 && y < 7 && x >= n - 7)) continue;
      if (rnd() > 0.55) svg += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="3" height="3" fill="#0c0b09"/>';
    }
    return '<div style="background:#fff;padding:3px">' + svg + fp(0, 0) + fp(12, 0) + '</svg></div>';
  }
  function karteHtml() {
    var bars = D.balken.map(function (c, i) {
      var f = c[2] >= 70 ? GRN : GOLD;
      return '<div class="ids-bar"><div class="top"><span class="nm">' + c[0].replace('&', '&amp;') + '<span class="wt">' + c[1] + '%</span></span>'
        + '<span class="sc" style="color:' + f + '"><span data-sc>' + c[2] + '</span><small>/100</small></span></div>'
        + '<span class="track"><i style="background:' + f + ';width:' + c[2] + '%"></i></span><div class="kp">' + c[3] + ' KPIs</div></div>';
    }).join('');
    return '<span class="abflug">Cleared for take-off</span><div class="idscard" role="img" aria-label="Investor Deal Score 87 von 100, Sehr gut">'
      + '<div class="ids-band"><span class="l"><i class="dot"></i>Pre-Flight · Investor Deal Score</span><span class="cleared">Cleared</span></div>'
      + '<div class="ids-head"><span class="ids-title">Investor <b>Deal Score</b></span><span class="ids-allkpi">☰ Alle KPIs</span></div>'
      + '<div class="ids-body"><div class="ids-left"><div class="ids-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tr" cx="60" cy="60" r="53"></circle>'
      + '<circle class="pg" cx="60" cy="60" r="53" style="stroke-dashoffset:43.3"></circle></svg><div class="ids-dv"><b data-ring>87</b><small>/&thinsp;100</small></div></div>'
      + '<div class="ids-badge">◆ Sehr gut</div>'
      + '<div class="ids-stats"><div><b data-stat="kp">180.000&nbsp;€</b><span>Kaufpreis</span></div><div><b data-stat="kpi">23/24</b><span>KPIs</span></div><div><b data-stat="tiefe">96&thinsp;%</b><span>Tiefe</span></div></div>'
      + '</div><div class="ids-right"><div class="ids-h">So setzt sich der Score zusammen</div><div>' + bars + '</div></div></div>'
      + '<div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
      + '<div class="ids-foot"><div class="lab">PASSENGER<b>DealPilot Co-Pilot</b></div><div class="lab" style="text-align:center">FLIGHT<b>DP · BOARDING</b></div><div class="ids-qr">' + qrSvg() + '</div></div></div><span class="spur"></span>';
  }
  var VOLL = 333, ZIEL = 333 * (1 - .87);
  function karte(host) {
    host.classList.add('n6-karte');
    host.innerHTML = karteHtml();
    var el = $('.idscard', host), pg = $('.ids-dial .pg', el), zahl = $('[data-ring]', el), kpiN = 0, stand = [0, 0, 0, 0, 0];
    function tiefe(n) { $('[data-stat="tiefe"]', el).innerHTML = Math.round(n / 24 * 100) + '&thinsp;%'; }
    var c = {
      el: el, host: host,
      leer: function () {
        stand = [0, 0, 0, 0, 0]; kpiN = 0; host.classList.remove('fertig', 'hebt');
        pg.style.strokeDashoffset = VOLL; zahl.textContent = '0';
        $$('.ids-bar', el).forEach(function (b) { $('.track i', b).style.width = '0%'; $('[data-sc]', b).textContent = '0'; });
        $('[data-stat="kp"]', el).innerHTML = '<span style="color:#cfc6b2">0&nbsp;€</span>';
        $('[data-stat="kpi"]', el).textContent = '0/24'; tiefe(0);
        $('.ids-badge', el).classList.add('weg');
        var cl = $('.cleared', el); cl.textContent = 'Wartet'; cl.classList.add('wartet');
      },
      kp: function () { var b = $('[data-stat="kp"]', el); b.innerHTML = '180.000&nbsp;€'; anim(b, [{ transform: 'scale(1.3)', color: '#b8932f' }, { transform: 'none', color: '#16130d' }]); },
      /* Balken i auf Anteil f (0..1) des Zielwerts ausfahren */
      teil: function (i, f, ms) {
        var b = $$('.ids-bar', el)[i], z = D.balken[i][2], tr = $('.track i', b), alt = stand[i], neu = Math.min(1, f);
        stand[i] = neu;
        var kAlt = kpiN; kpiN = Math.round(D.balken.reduce(function (s, x, j) { return s + x[4] * stand[j]; }, 0));
        zaehle($('[data-stat="kpi"]', el), kpiN, (ms || 800) * .6, { nach: '/24', von: kAlt }); tiefe(kpiN);
        b.classList.add('trifft'); setTimeout(function () { b.classList.remove('trifft'); }, (ms || 800) + 200);
        zaehle($('[data-sc]', b), Math.round(z * neu), ms || 800, { von: Math.round(z * alt) });
        tr.style.width = (z * neu) + '%';
        return anim(tr, [{ width: (z * alt) + '%' }, { width: (z * neu) + '%' }], { duration: ms || 800 });
      },
      ring: function (ms) {
        var cl = $('.cleared', el);
        zaehle(zahl, 87, ms - 100); pg.style.strokeDashoffset = ZIEL;
        return anim(pg, [{ strokeDashoffset: VOLL }, { strokeDashoffset: ZIEL }], { duration: ms }).then(function () {
          $('.ids-badge', el).classList.remove('weg'); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
        });
      },
      /* Abheben: Karte steigt, Kondensstreifen, Etikett */
      abheben: function () {
        host.classList.add('fertig');
        if (ruhig) return Promise.resolve();
        host.classList.remove('hebt'); void host.offsetWidth; host.classList.add('hebt');
        return anim(el, [{ transform: 'none' }, { transform: 'translateY(-26px) rotate(-1.6deg)', offset: .45 }, { transform: 'translateY(-14px) rotate(-.6deg)', offset: .75 }, { transform: 'none' }],
          { duration: 2000, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'none' });
      },
      fertig: function () {
        stand = [1, 1, 1, 1, 1]; kpiN = 23; host.classList.add('fertig');
        pg.style.strokeDashoffset = ZIEL; zahl.textContent = '87';
        $$('.ids-bar', el).forEach(function (b, i) { $('.track i', b).style.width = D.balken[i][2] + '%'; $('[data-sc]', b).textContent = D.balken[i][2]; });
        $('[data-stat="kp"]', el).innerHTML = '180.000&nbsp;€'; $('[data-stat="kpi"]', el).textContent = '23/24'; tiefe(23);
        $('.ids-badge', el).classList.remove('weg'); var cl = $('.cleared', el); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
      },
      ziel: function (k) { return k === 'kp' ? $('[data-stat="kp"]', el) : $('.track', $$('.ids-bar', el)[k]); }
    };
    return c;
  }

  /* ══ 1 · Streifen mit Absprung ══════════════════════════════════════ */
  function streifenHtml(liste) {
    return liste.map(function (x, i) {
      var bild = x[1]
        ? '<span class="bild" style="background-image:url(assets/dp-strecke/' + x[0] + ');background-size:' + x[1][0] + '% auto;background-position:' + x[1][1] + '% ' + x[1][2] + '%"><span class="lupe">Auszug</span>'
        : '<span class="bild"><img src="assets/dp-strecke/' + x[0] + '" alt="" loading="lazy" width="1600" height="900">';
      return '<a class="st" href="videothek.html?v=' + x[4] + '&amp;t=' + x[6] + '" data-v="' + x[4] + '" data-t="' + x[6] + '" data-i="' + i + '" aria-label="' + x[3] + ': Video ab ' + mmss(x[6]) + ', Kapitel ' + x[5] + '">'
        + bild + '<span class="sprung"><i></i><span>' + mmss(x[6]) + ' · ' + x[5] + '</span></span></span>'
        + '<figcaption>' + x[2] + '<b>' + x[3] + '</b></figcaption></a>';
    }).join('');
  }
  function streifen(el, opt) {
    opt = opt || {};
    var liste = D.streifen.slice();
    if (opt.nur === 'ansicht') liste = liste.filter(function (x) { return !x[1]; });
    if (opt.nur === 'auszug') liste = liste.filter(function (x) { return x[1]; });
    var halb = streifenHtml(liste);
    el.classList.add('n6-streifen');
    el.innerHTML = '<div class="zug">' + halb + halb + '</div>';
    $$('.st', el).forEach(function (a, i) { if (i >= liste.length) { a.setAttribute('tabindex', '-1'); a.setAttribute('aria-hidden', 'true'); } });
    var zug = $('.zug', el);
    if (ruhig) return { zug: zug };
    var x = 0, t0 = null, sicht = true, tempo = opt.tempo || 26, r = opt.richtung || -1, k = opt.scroll == null ? .35 : opt.scroll, sy0 = scrollY, halt = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { sicht = es[0].isIntersecting; }).observe(el);
    el.addEventListener('mouseenter', function () { halt = true; });
    el.addEventListener('mouseleave', function () { halt = false; });
    el.addEventListener('focusin', function () { halt = true; });
    el.addEventListener('focusout', function () { halt = false; });
    (function lauf(t) {
      if (t0 == null) t0 = t;
      var dt = Math.min(64, t - t0); t0 = t;
      if (sicht) {
        var w = zug.scrollWidth / 2 || 1;
        x += (halt ? tempo * .12 : tempo) * dt / 1000 + Math.abs(scrollY - sy0) * k; sy0 = scrollY;
        var v = (x % w + w) % w;
        zug.style.transform = 'translate3d(' + (r < 0 ? -v : v - w).toFixed(1) + 'px,0,0)';
      } else sy0 = scrollY;
      requestAnimationFrame(lauf);
    })(performance.now());
    return { zug: zug };
  }

  /* ══ 2 · Videothek als Slider ═══════════════════════════════════════ */
  var vt = (function () {
    var host, V = [], bilder = {}, cur = -1, filter = 'alle', bau = 'flow', vid, schirm, bahn, kapListe, info, warteschlange = null, bereit = false, auto = null;
    function liste() { return filter === 'alle' ? V : V.filter(function (v) { return v.kategorie === filter; }); }
    function laden() {
      var L = window.DPS_VIDEOTHEK && window.DPS_VIDEOTHEK.videos || [];
      return fetch('assets/videothek/videos.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) {
        var geplant = {};
        if (j && j.videos) j.videos.forEach(function (v) { bilder[v.id] = (j.basis_bilder || 'assets/videothek/') + v.poster; if (v.geplant) geplant[v.id] = 1; });
        V = L.filter(function (v) { return v.dauer && !geplant[v.id] && bilder[v.id]; });
      });
    }
    function bild(v) { return bilder[v.id]; }
    function kapitelBei(v, t) { var k = null; (v.kapitel || []).forEach(function (x) { if (x.t <= t) k = x; }); return k; }
    function baueSlider() {
      var L = liste(), box = $('.n6-vt-slider', host);
      var it = L.map(function (v, i) {
        return '<button class="it" type="button" data-id="' + v.id + '" data-i="' + i + '"><span class="b"><img src="' + bild(v) + '" alt="" loading="lazy" width="480" height="270"><span class="d">' + mmss(v.dauer) + '</span></span>'
          + '<span class="t"><small>' + (v.nr === 'Spot' ? 'SPOT' : 'VIDEO ' + v.nr) + ' · ' + sauber(v.kategorie).toUpperCase() + '</small><b>' + sauber(v.titel) + '</b></span></button>';
      }).join('');
      box.innerHTML = bau === 'flow' ? '<div class="n6-flow" tabindex="0" aria-roledescription="Karussell" aria-label="Videos der Videothek">' + it + '</div>' : '<div class="n6-reihe" aria-label="Videos der Videothek">' + it + '</div>';
      box.insertAdjacentHTML('beforeend', '<div class="n6-steuer"><button type="button" data-zur aria-label="Vorheriges Video">←</button><span data-pos></span><button type="button" data-vor aria-label="Nächstes Video">→</button></div>');
      $('[data-zur]', box).onclick = function () { stopp(); waehle(pos() - 1); };
      $('[data-vor]', box).onclick = function () { stopp(); waehle(pos() + 1); };
      $$('.it', box).forEach(function (b) {
        b.addEventListener('click', function () { stopp(); var L2 = liste(), i = +b.dataset.i; if (L2[i] && L2[i].id === aktuellId()) starte(0, true); else waehle(i, true); });
      });
      var fl = $('.n6-flow', box);
      if (fl) {
        var x0 = null;
        fl.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
        fl.addEventListener('pointerup', function (e) { if (x0 == null) return; var d = e.clientX - x0; x0 = null; if (Math.abs(d) > 40) { stopp(); waehle(pos() + (d < 0 ? 1 : -1)); } });
        fl.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { stopp(); waehle(pos() + 1); } if (e.key === 'ArrowLeft') { stopp(); waehle(pos() - 1); } });
      }
    }
    function aktuellId() { return cur >= 0 && V[cur] ? V[cur].id : null; }
    function pos() { var L = liste(), id = aktuellId(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return i; return 0; }
    function zeigeSlider(i) {
      var L = liste(), n = L.length, box = $('.n6-vt-slider', host), its = $$('.it', box);
      its.forEach(function (it, j) {
        var o = j - i; if (o > n / 2) o -= n; if (o < -n / 2) o += n;
        it.classList.toggle('mitte', o === 0);
        if (bau === 'flow') {
          var a = Math.abs(o), sg = Math.sign(o), abst = innerWidth < 700 ? 120 : 250;
          it.style.transform = o === 0 ? 'translateZ(50px)' : 'translateX(' + (sg * (abst + (a - 1) * abst * .55)) + 'px) translateZ(' + (-120 - a * 90) + 'px) rotateY(' + (-sg * 48) + 'deg)';
          it.style.zIndex = 50 - a; it.style.opacity = a > 3 ? 0 : 1; it.style.filter = o ? 'saturate(.55) brightness(' + (.9 - a * .08) + ')' : 'none';
          it.tabIndex = o === 0 ? 0 : -1;
        }
      });
      if (bau === 'reihe' && its[i]) { var r = $('.n6-reihe', box); r.scrollTo({ left: its[i].offsetLeft - 2, behavior: ruhig ? 'auto' : 'smooth' }); }
      var p = $('[data-pos]', box); if (p) p.textContent = (i + 1) + ' / ' + n;
    }
    /* Video wählen (ohne Start), Abspielfläche vorbereiten */
    function waehle(i, mitStart) {
      var L = liste(); if (!L.length) return;
      i = (i + L.length) % L.length;
      var v = L[i]; cur = V.indexOf(v);
      zeigeSlider(i); fuelle(v, 0);
      if (mitStart) starte(0, true);
    }
    function fuelle(v, t) {
      $('.n6-vt-spiel', host).classList.remove('laeuft');
      $('img', schirm).src = bild(v);
      if (vid) { try { vid.pause(); } catch (e) {} vid.removeAttribute('src'); vid.style.display = 'none'; }
      info.querySelector('small').textContent = (v.nr === 'Spot' ? 'Spot' : 'Video ' + v.nr) + ' · ' + sauber(v.kategorie) + ' · ' + mmss(v.dauer);
      info.querySelector('h3').textContent = sauber(v.titel);
      kapListe.innerHTML = (v.kapitel || []).map(function (k, j) { return '<li data-t="' + k.t + '"><button type="button"><span>' + mmss(k.t) + '</span>' + sauber(k.titel) + '</button></li>'; }).join('');
      $$('li', kapListe).forEach(function (li) { $('button', li).onclick = function () { starte(+li.dataset.t, true); }; });
      $('.n6-vt-bahn', host).innerHTML = '<span class="lauf"></span>' + (v.kapitel || []).map(function (k) { return '<span class="mk" style="left:' + (k.t / v.dauer * 100).toFixed(2) + '%"></span>'; }).join('') + '<span class="kopf"></span>';
      setzeKopf(v, t || 0, false);
      $('.absprung', info).innerHTML = '';
    }
    function setzeKopf(v, t, weich) {
      var p = clamp(t / (v.dauer || 1), 0, 1) * 100, k = kapitelBei(v, t);
      var lauf = $('.n6-vt-bahn .lauf', host), kopf = $('.n6-vt-bahn .kopf', host);
      if (weich && !ruhig) { anim(lauf, [{ width: lauf.style.width || '0%' }, { width: p + '%' }], { duration: 900 }); anim(kopf, [{ left: kopf.style.left || '0%' }, { left: p + '%' }], { duration: 900 }); }
      lauf.style.width = p + '%'; kopf.style.left = p + '%';
      $('.n6-vt-zeit', host).innerHTML = '<span>' + mmss(t) + '</span><span>' + mmss(v.dauer) + '</span>';
      $('.kap', schirm).innerHTML = (k ? 'Kapitel · ' + mmss(k.t) : 'Anfang') + '<b>' + sauber(k ? k.titel : v.titel) + '</b>';
      $$('li', kapListe).forEach(function (li) { li.classList.toggle('an', !!k && +li.dataset.t === k.t); });
      var an = $('li.an', kapListe); if (an) kapListe.scrollTop = an.offsetTop - kapListe.offsetTop - 40;
    }
    /* Start an Sekunde t: auf dealpilot.immo echt, in der Vorlage mit Sprungmarke */
    function starte(t, vonNutzer) {
      var v = V[cur]; if (!v) return;
      setzeKopf(v, t, true);
      var k = kapitelBei(v, t);
      $('.absprung', info).innerHTML = 'Start bei <b>' + mmss(t) + '</b>' + (k ? ', ' + (/^Kapitel/.test(k.titel) ? '' : 'Kapitel ') + '<b>' + sauber(k.titel) + '</b>' : '');
      $('.n6-vt-spiel', host).classList.add('laeuft');
      if (LIVE && v.datei) {
        vid.style.display = 'block'; vid.src = 'medien/videothek/' + v.datei; vid.poster = bild(v);
        vid.addEventListener('loadedmetadata', function f() { vid.removeEventListener('loadedmetadata', f); try { vid.currentTime = t; } catch (e) {} var p = vid.play(); if (p && p.catch) p.catch(function () {}); });
      }
    }
    /* von überall: Video id ab Sekunde t */
    function oeffne(id, t) {
      if (!bereit) { warteschlange = [id, t]; return; }
      stopp();
      var L = liste(), i = -1;
      for (var j = 0; j < L.length; j++) if (L[j].id === id) i = j;
      if (i < 0) { filter = 'alle'; markiereReiter(); baueSlider(); L = liste(); for (j = 0; j < L.length; j++) if (L[j].id === id) i = j; }
      if (i < 0) return false;
      host.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
      waehle(i, false);
      setTimeout(function () { starte(+t || 0, true); }, ruhig ? 0 : 650);
      return true;
    }
    function markiereReiter() { $$('.n6-vt-reiter button', host).forEach(function (b) { b.classList.toggle('an', b.dataset.k === filter); }); }
    function stopp() { if (auto) { clearInterval(auto); auto = null; } }
    function baue(el, opt) {
      opt = opt || {}; host = el; bau = opt.bau || 'flow';
      el.classList.add('n6-vt');
      el.innerHTML = '<div class="n6-vt-kopf"><div><div class="eye">' + (opt.eye || 'Videothek · Kapitel für Kapitel') + '</div><h2>' + (opt.h2 || 'Sieh zu, bevor du <span class="ac">einsteigst.</span>') + '</h2></div><div class="n6-vt-reiter" role="tablist"></div></div>'
        + '<div class="n6-vt-spiel"><div class="n6-vt-schirm"><img alt="" width="1280" height="720"><video playsinline preload="none" style="display:none"></video>'
        + '<button class="n6-vt-start" type="button" aria-label="Video starten"></button>'
        + '<div class="ueber"><div class="kap"></div><div class="n6-vt-bahn" role="slider" aria-label="Stelle im Video"></div><div class="n6-vt-zeit"></div></div></div>'
        + '<div class="n6-vt-info"><div class="innen"><small></small><h3></h3><p class="absprung" aria-live="polite"></p><ol class="n6-vt-kapitel"></ol>'
        + (LIVE ? '' : '<p class="n6-vt-hinweis">Vorlage: Die Videodateien liegen nicht im Git. Auf dealpilot.immo startet das Video genau an dieser Stelle.</p>') + '</div></div></div>'
        + '<div class="n6-vt-slider"></div>'
        + '<p class="n6-vt-alle"><a class="btn-l" href="videothek.html">Zur ganzen Videothek · <span data-umfang="videos">40</span> Videos, <span data-umfang="video_stunden">3,7</span> Stunden</a></p>';
      schirm = $('.n6-vt-schirm', el); vid = $('video', schirm); info = $('.n6-vt-info', el); kapListe = $('.n6-vt-kapitel', el);
      $('.n6-vt-start', el).onclick = function () { var v = V[cur]; if (!v) return; var k = $('li.an', kapListe); starte(k ? +k.dataset.t : 0, true); };
      $('.n6-vt-bahn', el).addEventListener('click', function (e) { var v = V[cur]; if (!v) return; var r = this.getBoundingClientRect(); starte(Math.round((e.clientX - r.left) / r.width * v.dauer), true); });
      return laden().then(function () {
        var kat = []; V.forEach(function (v) { if (kat.indexOf(v.kategorie) < 0) kat.push(v.kategorie); });
        $('.n6-vt-reiter', el).innerHTML = '<button type="button" data-k="alle" class="an">Alle<small>' + V.length + '</small></button>' + kat.map(function (k) {
          return '<button type="button" data-k="' + k + '">' + sauber(k) + '<small>' + V.filter(function (v) { return v.kategorie === k; }).length + '</small></button>';
        }).join('');
        $$('.n6-vt-reiter button', el).forEach(function (b) { b.onclick = function () { stopp(); filter = b.dataset.k; markiereReiter(); baueSlider(); waehle(0); }; });
        baueSlider(); waehle(0);
        addEventListener('resize', function () { zeigeSlider(pos()); });
        bereit = true;
        if (warteschlange) { var w = warteschlange; warteschlange = null; oeffne(w[0], w[1]); }
        else if (!ruhig && opt.auto !== false) sichtbar($('.n6-vt-slider', el), function () { auto = setInterval(function () { waehle(pos() + 1); }, 4200); }, .5);
      });
    }
    return { baue: baue, oeffne: oeffne, kapitelBei: kapitelBei };
  })();

  /* Jeder Verweis in die Videothek auf dieser Seite landet im Slider */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="videothek.html?v="]');
    if (!a || !$('.n6-vt')) return;
    var u = new URL(a.getAttribute('href'), location.href), id = u.searchParams.get('v'), t = +u.searchParams.get('t') || 0;
    /* Etappen-Verweise der Strecke ohne Sekunde: die Stelle aus der Streifen-Zuordnung derselben Ansicht */
    var li = a.closest('.pt-s');
    if (li && !u.searchParams.get('t')) {
      var b = li.getAttribute('data-bild');
      if (b === 'qc') { id = D.etappeQc[0]; t = D.etappeQc[2]; }
      else { var nr = ('0' + b).slice(-2), m = D.streifen.filter(function (x) { return !x[1] && x[0].indexOf(nr + '-') === 0; })[0]; if (m) { id = m[4]; t = m[6]; } }
    }
    e.preventDefault();
    if (vt.oeffne(id, t) === false) location.href = a.href;
  }, true);

  /* ── Sprungmarken trotz <base> auf dieser Seite halten ───────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1), ziel = id ? document.getElementById(id) : document.body;
    e.preventDefault();
    if (ziel) ziel.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
    try { history.replaceState(null, '', location.pathname + location.search + (id ? '#' + id : '')); } catch (x) {}
  });

  /* ══ 3 · Riss und Aufklappen der Hero-Karte ═════════════════════════ */
  var RU = 276.5;
  function zKarte(t) {
    var grp = t.gruppen.map(function (g) {
      var f = g[2] >= 70 ? GRN : GOLD;
      return '<div class="zs-kz"><span class="zs-t">' + g[0].replace('&', '&amp;') + ' <span class="zs-anteil">' + g[1] + '&nbsp;%</span></span>'
        + '<span class="zs-p"><b data-zahl="' + g[2] + '">' + g[2] + '</b> / 100</span><span class="zs-bar"><i data-n6breit="' + g[2] + '" style="background:' + f + ';width:' + g[2] + '%"></i></span></div>';
    }).join('');
    return '<div class="zs-karte" data-karte="' + t.key + '"><div class="zs-band"></div><div class="zs-pad">'
      + '<div class="zs-score"><div class="zs-ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="tr" cx="52" cy="52" r="44"/>'
      + '<circle class="pg" cx="52" cy="52" r="44" data-ring="' + t.score + '" style="stroke:' + GRN + ';stroke-dashoffset:' + (RU * (1 - t.score / 100)).toFixed(1) + '"/></svg>'
      + '<div class="zs-n" data-zahl="' + t.score + '">' + t.score + '</div></div>'
      + '<div><h3 class="zs-h3">' + t.titel + '</h3><span class="zs-pill g">' + (t.score >= 85 ? 'SEHR GUT' : 'GUT') + '</span></div></div>'
      + '<div class="zs-kat">' + grp + '</div><div class="zs-summe">Zählt ' + t.anteil + '&nbsp;% zum Gesamtscore 87.</div></div></div>';
  }
  function zweiHtml() {
    return '<div class="zs" aria-label="Gesamturteil 87, Sehr gut. Investment-Score 81, Finanzierungs-Score 97. Empfehlung Kaufen."><div class="zs-kopf"><div class="zs-siegel"><span data-zahl="87">87</span><small>/ 100</small></div>'
      + '<div><div class="zs-lbl">Gesamturteil · Investor Deal Score</div><div class="zs-wort">Sehr gut</div></div><span class="zs-empf">Empfehlung · Kaufen</span>'
      + '<div class="zs-warum"><span class="zs-teil" data-t>Investment <b>81</b> zählt 59,3&nbsp;%</span><span class="zs-teil" data-t>Finanzierung <b>97</b> zählt 40,8&nbsp;%</span></div></div>'
      + '<div class="zs-zwei">' + zKarte(D.inv) + zKarte(D.fin) + '</div></div>';
  }
  function zielNull(root) {
    $$('[data-zahl]', root).forEach(function (e) { e.textContent = '0'; });
    $$('[data-n6breit]', root).forEach(function (e) { e.style.width = '0%'; });
    $$('[data-ring]', root).forEach(function (e) { e.style.strokeDashoffset = RU; });
  }
  function zielFertig(root) {
    $$('[data-zahl]', root).forEach(function (e) { e.textContent = e.dataset.zahl; });
    $$('[data-n6breit]', root).forEach(function (e) { e.style.width = e.dataset.n6breit + '%'; });
    $$('[data-ring]', root).forEach(function (e) { e.style.strokeDashoffset = (RU * (1 - e.dataset.ring / 100)).toFixed(1); });
  }
  function fuelleZwei(root, ms) {
    var p = [];
    $$('[data-ring]', root).forEach(function (r) { var z = (RU * (1 - r.dataset.ring / 100)).toFixed(1); r.style.strokeDashoffset = z; p.push(anim(r, [{ strokeDashoffset: RU }, { strokeDashoffset: z }], { duration: ms + 300 })); });
    $$('[data-zahl]', root).forEach(function (z) { p.push(zaehle(z, +z.dataset.zahl, ms + 200)); });
    $$('[data-n6breit]', root).forEach(function (b, i) { b.style.width = b.dataset.n6breit + '%'; p.push(anim(b, [{ width: '0%' }, { width: b.dataset.n6breit + '%' }], { duration: ms, delay: i * 110 })); });
    return Promise.all(p);
  }
  function zickzack(n, mitte, aus, seed) {
    var s = seed || 3, pts = [[mitte, 0]];
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 1; i < n; i++) pts.push([mitte + (rnd() - .5) * 2 * aus, i / n]);
    pts.push([mitte + (rnd() - .5) * aus, 1]);
    return pts;
  }
  function spalte(card, bezug, punkte) {
    var r = rel(card, bezug);
    var P = punkte.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',');
    function klon(clip) {
      var h = document.createElement('div'); h.className = 'haelfte';
      h.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;clip-path:' + clip;
      var k = card.cloneNode(true); k.style.width = r.w + 'px'; k.style.height = r.h + 'px'; k.style.margin = '0'; k.removeAttribute('role');
      [k].concat($$('[id]', k)).forEach(function (x) { x.removeAttribute('id'); });
      h.appendChild(k); h.setAttribute('aria-hidden', 'true'); bezug.appendChild(h); return h;
    }
    var Lh = klon('polygon(0 0,' + P + ',0 100%)'), Rh = klon('polygon(100% 0,' + P + ',100% 100%)');
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'riss-svg'); svg.setAttribute('width', r.w); svg.setAttribute('height', r.h);
    svg.style.left = r.x + 'px'; svg.style.top = r.y + 'px';
    var d = punkte.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] * r.w).toFixed(1) + ' ' + (p[1] * r.h).toFixed(1); }).join(' ');
    svg.innerHTML = '<defs><filter id="n6glut" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<path d="' + d + '" fill="none" stroke="#E8CC7A" stroke-width="8" opacity=".7" filter="url(#n6glut)"/><path d="' + d + '" fill="none" stroke="#b8932f" stroke-width="2.2"/>';
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
    for (var i = 0; i < n; i++) {
      var f = document.createElement('i'); f.className = 'funke'; f.style.left = x + 'px'; f.style.top = y + 'px'; b.appendChild(f);
      var w = Math.random() * Math.PI * 2, rr = (weite || 140) * (.35 + Math.random() * .8);
      anim(f, [{ transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + (Math.cos(w) * rr).toFixed(0) + 'px),calc(-50% + ' + (Math.sin(w) * rr + 30).toFixed(0) + 'px)) scale(0)', opacity: 0 }],
        { duration: 600 + Math.random() * 600, easing: 'cubic-bezier(.1,.7,.3,1)' }).then((function (el) { return function () { el.remove(); }; })(f));
    }
  }
  /* opt.verzug: ms nach dem Laden bis zum Riss */
  function heroRiss(opt) {
    opt = opt || {};
    var card = $('.hero .idscard'); if (!card) return;
    var hk = document.createElement('div'); hk.className = 'n6-hk';
    card.parentNode.insertBefore(hk, card); hk.appendChild(card);
    hk.insertAdjacentHTML('beforeend', '<div class="n6-hk-zwei" style="display:none">' + zweiHtml() + '</div><div class="n6-hk-fuss"><button class="n6-knopf" type="button">' + (ruhig ? 'In zwei Scores aufklappen' : '↻ Nochmal reißen') + '</button></div>');
    var zw = $('.n6-hk-zwei', hk), zs = $('.zs', zw), knopf = $('.n6-hk-fuss button', hk), lauf = 0;
    function zurueck() {
      lauf++; $$('.haelfte,.riss-svg,.lichtspalt,.welle,.funke', hk).forEach(function (x) { x.remove(); });
      zw.style.display = 'none'; card.style.display = ''; card.style.visibility = '';
    }
    function reiss() {
      var nr = ++lauf; function lebt() { return nr === lauf; }
      if (ruhig) { card.style.display = 'none'; zw.style.display = ''; zielFertig(zs); return Promise.resolve(); }
      return anim(card, [{ transform: 'none' }, { transform: 'translateY(-8px) rotate(-.6deg)' }, { transform: 'translateY(-4px) rotate(.4deg)' }, { transform: 'none' }], { duration: 1200, easing: 'ease-in-out', fill: 'none' }).then(function () {
        if (!lebt()) return;
        var sp = spalte(card, hk, zickzack(10, .5, .04, 11)), r = sp.rect; card.style.visibility = 'hidden';
        var zit = [sp.L, sp.R].map(function (h) { return anim(h, [{ transform: 'none' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(2px,-1px)' }, { transform: 'none' }], { duration: 240, delay: 480, easing: 'linear', fill: 'none' }); });
        return Promise.all(sp.pfade.map(function (p) { return anim(p, [{ strokeDashoffset: sp.len }, { strokeDashoffset: 0 }], { duration: 720, easing: 'cubic-bezier(.6,0,.3,1)' }); }).concat(zit)).then(function () {
          if (!lebt()) return;
          var mx = r.x + r.w / 2;
          welle(hk, mx, r.y + r.h / 2, Math.max(r.w, r.h) * 1.2); funken(hk, mx, r.y + r.h * .45, 22, 160);
          var spalt = document.createElement('div'); spalt.className = 'lichtspalt';
          spalt.style.cssText = 'left:' + (mx - 40) + 'px;top:' + (r.y - 20) + 'px;width:80px;height:' + (r.h + 40) + 'px'; hk.appendChild(spalt);
          var auf = Math.min(60, r.w * .08);
          return Promise.all([
            anim(spalt, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1.5)' }], { duration: 650 }),
            anim(sp.svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }),
            anim(sp.L, [{ transform: 'none' }, { transform: 'translateX(' + (-auf) + 'px) rotate(-2.5deg)' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' }),
            anim(sp.R, [{ transform: 'none' }, { transform: 'translateX(' + auf + 'px) rotate(2.5deg)' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' })
          ]).then(function () { return warte(500); }).then(function () {
            if (!lebt()) return;
            card.style.display = 'none'; zw.style.display = ''; zielNull(zs);
            var kopf = $('.zs-kopf', zs), ki = $('[data-karte="inv"]', zs), kf = $('[data-karte="fin"]', zs), teile = $$('[data-t]', zs);
            kopf.style.opacity = 0; teile.forEach(function (t) { t.style.opacity = 0; });
            var Ti = rel(ki, hk), Tf = rel(kf, hk);
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
              warte(320).then(function () { return fuelleZwei($('.zs-zwei', zs), 1300); })
            ]).then(function () {
              sp.L.remove(); sp.R.remove(); sp.svg.remove(); spalt.remove();
              if (!lebt()) return;
              kopf.style.opacity = '';
              return Promise.all([
                anim(kopf, [{ opacity: 0, transform: 'translateY(26px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)' }),
                zaehle($('.zs-siegel [data-zahl]', kopf), 87, 1100),
                Promise.all(teile.map(function (t, i) { return anim(t, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 420 + i * 180 }).then(function () { t.style.opacity = ''; }); }))
              ]);
            });
          });
        });
      });
    }
    knopf.addEventListener('click', function () {
      if (ruhig) { var offen = zw.style.display !== 'none'; if (offen) zurueck(); else reiss(); knopf.textContent = offen ? 'In zwei Scores aufklappen' : 'Wieder eine Karte'; return; }
      zurueck(); setTimeout(reiss, 300);
    });
    if (!ruhig) {
      var los = function () { setTimeout(function () { sichtbar(hk, reiss, .5); }, opt.verzug || 4200); };
      if (document.readyState === 'complete') los(); else addEventListener('load', los);
    }
  }

  /* ══ 4 · Startbahn mit vielen Unterlagen ════════════════════════════ */
  function docHtml(u, i) {
    var mitte = '';
    if (u.foto) mitte = '<div class="foto" style="background-image:url(' + u.foto + ')"></div>';
    if (u.fotos) mitte = '<div class="fotos">' + u.fotos.map(function (f) { return '<i style="background-image:url(' + f + ')"></i>'; }).join('') + '</div>';
    if (u.text) mitte = '<div class="text" aria-hidden="true"><i></i><i class="schwarz"></i><i></i><i class="schwarz"></i><i></i></div>';
    return '<div class="n6-doc" data-doc="' + i + '" aria-label="' + u.art + '"><span class="strahl" aria-hidden="true"></span>'
      + '<div class="kopf"><span>' + u.art + '</span><em>' + (i + 1) + ' / ' + D.unterlagen.length + '</em></div>'
      + '<h4>' + u.titel + '</h4><div class="unter">' + u.unter + '</div>' + mitte
      + u.felder.map(function (f) { return '<div class="f" data-ziel="' + f[2] + '"><span>' + f[0] + '</span><b data-wert="' + (f[1] || 'erkannt ✓') + '">' + (f[1] || 'erkannt ✓') + '</b></div>'; }).join('')
      + '<div class="rest" aria-hidden="true"></div><div class="stempel">GELESEN</div></div>';
  }
  function fliege(von, nach, html, ms, hub) {
    if (!von || !nach || ruhig) return Promise.resolve();
    var a = von.getBoundingClientRect(), b = nach.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    var chip = document.createElement('div'); chip.className = 'n6-chip'; chip.innerHTML = html; document.body.appendChild(chip);
    var w = chip.offsetWidth, h = chip.offsetHeight, rand = document.documentElement.clientWidth - w - 8;
    var x0 = clamp(a.left + scrollX + a.width / 2 - w / 2, 8, rand), y0 = a.top + scrollY + a.height / 2 - h / 2;
    var x1 = clamp(b.left + scrollX + Math.min(b.width / 2, 60) - w / 2, 8, rand), y1 = b.top + scrollY + b.height / 2 - h / 2;
    chip.style.left = x0 + 'px'; chip.style.top = y0 + 'px';
    var dx = x1 - x0, dy = y1 - y0, hb = hub == null ? -70 : hub;
    return anim(chip, [
      { transform: 'translate(0,0) scale(.7)', opacity: 0 }, { transform: 'translate(0,-10px) scale(1.06)', opacity: 1, offset: .12 },
      { transform: 'translate(' + (dx * .5) + 'px,' + (dy * .5 + hb) + 'px) scale(1) rotate(' + (dx > 0 ? 4 : -4) + 'deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.55)', opacity: 0 }
    ], { duration: ms || 780, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).then(function () { chip.remove(); });
  }
  /* Wechsel-Stile: wie die nächste Unterlage auftritt und die gelesene abgeht */
  var WECHSEL = {
    drehen: {
      auf: function (st) { st.docs.forEach(function (d) { d.style.opacity = 0; }); },
      rein: function (d) { d.style.opacity = 1; return anim(d, [{ transform: 'translateY(-50%) perspective(1200px) rotateY(-95deg)', opacity: 0 }, { transform: 'translateY(-50%) perspective(1200px) rotateY(0)', opacity: 1 }], { duration: 750, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'none' }); },
      raus: function (d) { return anim(d, [{ transform: 'translateY(-50%) perspective(1200px) rotateY(0)', opacity: 1 }, { transform: 'translateY(-50%) perspective(1200px) rotateY(95deg)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.6,0,.8,.4)' }).then(function () { d.style.opacity = 0; }); }
    },
    stapel: {
      auf: function (st) { st.docs.forEach(function (d, i) { d.style.zIndex = 50 - i; d.style.transform = 'translateY(-50%) translate(' + (i * 7) + 'px,' + (i * 7) + 'px) rotate(' + ((i % 2 ? 1 : -1) * (1 + i * .6)) + 'deg)'; d.style.opacity = i < 3 ? 1 : 0; }); },
      rein: function (d, st, i) {
        st.docs.forEach(function (x, j) { if (j < i) return; var k = j - i; x.style.transition = 'transform .6s cubic-bezier(.2,.8,.3,1),opacity .4s'; x.style.transform = 'translateY(-50%) translate(' + (k * 7) + 'px,' + (k * 7) + 'px) rotate(' + (k ? (j % 2 ? 1 : -1) * (1 + k * .6) : 0) + 'deg)'; x.style.opacity = k < 3 ? 1 : 0; });
        return warte(600);
      },
      raus: function (d) { d.style.transition = ''; return anim(d, [{ transform: 'translateY(-50%)', opacity: 1 }, { transform: 'translateY(-50%) translate(140%,-30%) rotate(24deg)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.6,0,.4,1)' }).then(function () { d.style.opacity = 0; }); }
    },
    karussell: {
      auf: function (st) {
        var n = st.docs.length, R = innerWidth < 620 ? 150 : 440; st.R = R; st.trommel.style.transformStyle = 'preserve-3d';
        st.docs.forEach(function (d, i) { d.style.transform = 'translateY(-50%) rotateY(' + (i * 360 / n) + 'deg) translateZ(' + R + 'px)'; d.style.opacity = 1; });
        st.trommel.style.transform = 'translateZ(-' + R + 'px) rotateY(0deg)';
      },
      rein: function (d, st, i) {
        var n = st.docs.length;
        st.docs.forEach(function (x, j) { var o = Math.abs(((j - i) % n + n) % n); o = Math.min(o, n - o); x.style.transition = 'filter .6s,opacity .6s'; x.style.filter = o ? 'brightness(.55) saturate(.4)' : 'none'; x.style.opacity = o > 1 ? .08 : o ? .7 : 1; });
        st.trommel.style.transition = ruhig ? 'none' : 'transform .9s cubic-bezier(.3,.8,.3,1)';
        st.trommel.style.transform = 'translateZ(-' + st.R + 'px) rotateY(' + (-i * 360 / n) + 'deg)';
        return warte(ruhig ? 0 : 900);
      },
      raus: function () { return Promise.resolve(); }
    },
    faecher: {
      auf: function (st) {
        var n = st.docs.length; st.docs.forEach(function (d, i) {
          var w = (i - (n - 1) / 2) * 7; d.style.transformOrigin = '50% 115%'; d.style.zIndex = i;
          d.dataset.ruhe = 'translateY(-62%) rotate(' + w + 'deg) scale(.78)'; d.style.transform = d.dataset.ruhe; d.style.opacity = 1;
        });
      },
      rein: function (d) {
        d.style.zIndex = 100;
        return anim(d, [{ transform: d.dataset.ruhe }, { transform: 'translateY(-50%) rotate(0) scale(1)' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }).then(function () { d.style.transform = 'translateY(-50%)'; });
      },
      raus: function (d) {
        return anim(d, [{ transform: 'translateY(-50%) perspective(1200px) rotateY(0)' }, { transform: 'translateY(-50%) perspective(1200px) rotateY(180deg) scale(.9)', offset: .5 }, { transform: d.dataset.ruhe + ' perspective(1200px) rotateY(360deg)' }], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' })
          .then(function () { d.style.transform = d.dataset.ruhe; d.style.zIndex = 1; d.style.filter = 'grayscale(.7) brightness(.8)'; });
      }
    },
    tafel: {
      auf: function (st) { st.docs.forEach(function (d) { d.style.opacity = 0; }); },
      rein: function (d) { d.style.opacity = 1; return anim(d, [{ transform: 'translateY(-50%) perspective(900px) rotateX(-90deg)', transformOrigin: '50% 0', opacity: 0 }, { transform: 'translateY(-50%) perspective(900px) rotateX(0)', transformOrigin: '50% 0', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.3,1.2,.5,1)', fill: 'none' }); },
      raus: function (d) { return anim(d, [{ transform: 'translateY(-50%) perspective(900px) rotateX(0)', transformOrigin: '50% 100%', opacity: 1 }, { transform: 'translateY(-50%) perspective(900px) rotateX(90deg)', transformOrigin: '50% 100%', opacity: 0 }], { duration: 450, easing: 'cubic-bezier(.6,0,.8,.4)' }).then(function () { d.style.opacity = 0; }); }
    }
  };
  /* host enthält .n6-ablage, .n6-karte, optional .n6-zaehler und .n6-tafel. opt.stil, opt.start: 'sicht' | 'hand' */
  function startbahn(host, opt) {
    opt = opt || {};
    var ablage = $('.n6-ablage', host), stil = WECHSEL[opt.stil || 'drehen'];
    ablage.innerHTML = '<div class="n6-trommel" style="position:absolute;inset:0">' + D.unterlagen.map(docHtml).join('') + '</div>';
    var st = { docs: $$('.n6-doc', ablage), trommel: $('.n6-trommel', ablage) };
    /* gleiche Höhe für alle Blätter, damit Stapel, Fächer und Trommel sauber liegen */
    function hoehe() {
      st.docs.forEach(function (d) { d.style.minHeight = ''; });
      var h = Math.max.apply(null, st.docs.map(function (d) { return d.offsetHeight; }));
      st.docs.forEach(function (d) { d.style.minHeight = h + 'px'; });
    }
    hoehe(); addEventListener('resize', hoehe);
    var k = karte($('.n6-karte', host)), zl = $('.n6-zaehler', host), tafel = $('.n6-tafel', host), lauf = 0;
    if (zl) zl.innerHTML = D.unterlagen.map(function (u) { return '<span>' + u.art + '</span>'; }).join('');
    function markiere(i, ok) {
      if (zl) $$('span', zl).forEach(function (s, j) { s.classList.toggle('an', j === i && !ok); if (ok && j === i) s.classList.add('ok'); });
      if (tafel) { var z = $$('.zeile', tafel)[i]; if (z) { z.classList.toggle('an', !ok); if (!ok) $('.status', z).textContent = 'LIEST'; if (ok) { z.classList.add('ok'); var s = $('.status', z); s.textContent = 'GELESEN'; anim(s, [{ transform: 'perspective(300px) rotateX(-90deg)' }, { transform: 'none' }], { duration: 380 }); } } }
    }
    function lies(i, nr) {
      var d = st.docs[i], u = D.unterlagen[i], felder = $$('.f', d), stp = $('.stempel', d);
      function lebt() { return nr === lauf; }
      markiere(i, false);
      felder.forEach(function (f) { var b = $('b', f); b.classList.add('leer'); b.classList.remove('ok'); });
      stp.classList.remove('an');
      return stil.rein(d, st, i).then(function () {
        if (!lebt()) return;
        d.classList.add('liest');
        return felder.reduce(function (p, f, j) {
          return p.then(function () { if (!lebt()) return; var b = $('b', f); b.classList.remove('leer'); if (!u.felder[j][1]) b.classList.add('ok'); return warte(170); });
        }, Promise.resolve());
      }).then(function () {
        if (!lebt()) return;
        d.classList.remove('liest'); stp.classList.add('an');
        return warte(250).then(function () {
          return Promise.all(felder.map(function (f, j) {
            var z = f.dataset.ziel; f.classList.add('quelle');
            return warte(j * 90).then(function () { return fliege($('b', f), k.ziel(z === 'kp' ? 'kp' : +z), '<small>' + u.art + '</small>' + $('span', f).textContent, 760); }).then(function () { f.classList.remove('quelle'); });
          }));
        });
      }).then(function () {
        if (!lebt()) return;
        if (u.felder.some(function (f) { return f[2] === 'kp'; })) k.kp();
        markiere(i, true);
        return Promise.all([k.teil(u.anteil[0], u.anteil[1], 700), warte(350).then(function () { return stil.raus(d, st, i); })]);
      });
    }
    function abflug(nr) {
      var kette = Promise.resolve();
      D.unterlagen.forEach(function (u, i) { kette = kette.then(function () { if (nr === lauf) return lies(i, nr); }); });
      return kette.then(function () { if (nr !== lauf) return; return k.ring(1300); }).then(function () { if (nr === lauf) return k.abheben(); });
    }
    function neu() {
      var nr = ++lauf;
      k.leer(); stil.auf(st);
      st.docs.forEach(function (d) { d.style.filter = ''; $('.stempel', d).classList.remove('an'); });
      if (zl) $$('span', zl).forEach(function (s) { s.className = ''; });
      if (tafel) $$('.zeile', tafel).forEach(function (z) { z.classList.remove('an', 'ok'); $('.status', z).textContent = 'WARTET'; });
      if (ruhig) { k.fertig(); D.unterlagen.forEach(function (u, i) { markiere(i, true); }); st.docs.forEach(function (d) { $$('.f b', d).forEach(function (b) { if (b.dataset.wert.indexOf('erkannt') === 0) b.classList.add('ok'); }); }); stil.rein(st.docs[0], st, 0); return Promise.resolve(); }
      return abflug(nr);
    }
    var b = $('.n6-nochmal', host); if (b) b.addEventListener('click', neu);
    k.leer(); stil.auf(st);
    if (ruhig) neu();
    else if (opt.start !== 'hand') sichtbar(host, function () { setTimeout(neu, 200); }, opt.schwelle || .35);
    return { neu: neu, karte: k, st: st, lies: lies, lauf: function () { return ++lauf; } };
  }
  function tafelHtml() {
    return '<div class="n6-tafel" aria-label="Unterlagen und ihr Stand">' + D.unterlagen.map(function (u, i) {
      return '<div class="zeile"><span class="nr">' + ('0' + (i + 1)).slice(-2) + '</span><span class="art">' + u.art + '</span><span class="status">WARTET</span></div>';
    }).join('') + '</div>';
  }

  /* ── Hinweis „Vorlage“ ────────────────────────────────────────────── */
  function hinweis(nr, titel) {
    var d = document.createElement('div'); d.className = 'n6-vk';
    d.innerHTML = 'Vorlage · <b>' + nr + '</b> · ' + titel + ' <a href="../../design/Vorschläge/landing-neu-6/index.html">Übersicht</a>';
    document.body.appendChild(d);
  }

  window.N6 = { ruhig: ruhig, LIVE: LIVE, $: $, $$: $$, warte: warte, anim: anim, sichtbar: sichtbar, clamp: clamp, D: D,
    streifen: streifen, vt: vt, heroRiss: heroRiss, startbahn: startbahn, tafelHtml: tafelHtml, karte: karte, hinweis: hinweis, mmss: mmss };
})();
