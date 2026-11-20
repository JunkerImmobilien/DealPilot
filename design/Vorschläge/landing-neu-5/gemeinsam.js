/* ═══════════════════════════════════════════════════════════════════════
   landing-neu-5 · gemeinsam.js · Vorlage, NICHT eingebaut (20.11.2026)

   Die sechs Varianten SIND die heutige Landing (frontend/landing/index.html,
   Markup wörtlich übernommen, echte Stylesheets und Skripte per <base>).
   Dazu kommen zwei Bausteine aus landing-neu-4:

   (a) Exposé wird eingelesen und fließt in die Score-Karte
       Herkunft: landing-neu-4/gemeinsam.js exposeHtml/fliege/exposeFlug
       (Z.284-362), am deutlichsten inszeniert in landing-neu-4/variante-1.html
       („Exposé im Anflug“). Beispieldaten des Exposés von dort.
       ANDERS als in neu-4: die Karte zeigt die Werte der heutigen Hero-Karte
       (dp2.js CATS: 98/96/88/60/53, Risiko 5/6, 23/24 KPIs, Tiefe 96 %,
       Score 87 Sehr gut), damit auf einer Seite nie zwei Stände stehen.
   (b) durchlaufender Streifen mit App-Ansichten und Auszügen
       Herkunft: das schräge Band aus App-Ansichten in landing-neu-4/
       variante-1.html (.h1-band, Z.36-39 und 147-155) und die
       Instrumententafel mit Beschriftung in variante-6.html (.h6-tafel).
       Bilder: frontend/landing/assets/dp-strecke und assets/app-bilder,
       Auszüge sind Ausschnitte derselben Bilder (CSS, keine neuen Dateien).

   Weil die Seite <base href="../../../frontend/landing/"> trägt, laufen alle
   relativen Pfade der Landing wie dort. Drei Dinge fängt die Vorlage ab:
   Sprungmarken (#…) bleiben auf der Seite, /api/… geht nicht ins Netz
   (die Landing behält ihre Rückfallwerte aus dem HTML), und die Videothek-
   MP4 (medien/, nicht im Git) werden nicht angefragt. Die Poster bleiben.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (ruhig) document.documentElement.classList.add('n5-ruhig');

  /* ── Vorlage ohne Netz: /api und medien/ abfangen ────────────────── */
  var _fetch = window.fetch;
  window.fetch = function (u, o) {
    var s = typeof u === 'string' ? u : (u && u.url) || '';
    if (/\/api\/v1\//.test(s)) return Promise.resolve(new Response('null', { status: 503, headers: { 'Content-Type': 'application/json' } }));
    return _fetch.call(this, u, o);
  };
  var md = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true, get: md.get,
    set: function (v) { if (/(^|\/)medien\//.test(String(v))) return; md.set.call(this, v); }
  });

  /* ── Sprungmarken trotz <base> auf dieser Seite halten ───────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1), ziel = id ? document.getElementById(id) : document.body;
    e.preventDefault();
    if (ziel) ziel.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
    try { history.replaceState(null, '', location.pathname + location.search + (id ? '#' + id : '')); } catch (x) {}
  }, true);

  /* ── Hilfen ───────────────────────────────────────────────────────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ein3(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(n) { return Number(n).toLocaleString('de-DE'); }
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
  /* Fortschritt 0..1 einer hohen Szene beim Scrollen */
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
    return lauf;
  }

  /* ══ Daten ═══════════════════════════════════════════════════════════ */
  var GRN = '#3FA56C', GOLD = '#C9A84C';
  var D = {
    /* wie dp2.js CATS: [Name, Gewicht, Punkte, KPI-Text, KPI-Zahl] */
    balken: [
      ['Rendite', 35, 98, '4/4', 4], ['Finanzierung', 25, 96, '5/5', 5], ['Risiko', 20, 88, '5/6', 5],
      ['Lage & Markt', 10, 60, '5/5', 5], ['Upside / Potenzial', 10, 53, '4/4', 4]
    ],
    expose: {
      titel: 'Ruhige Lage, solide vermietet', art: 'Eigentumswohnung · Beispieldaten', foto: 'assets/bild/haus.jpg',
      felder: [['Kaufpreis', '180.000 €', 'kp'], ['Wohnfläche', '100 m²', 3], ['Kaltmiete', '1.300 € / Monat', 0],
        ['Nicht umlagefähig', '1.500 € / Jahr', 0], ['Energieklasse', 'D', 2], ['Zustand', 'gut', 2]],
      eigen: [['Eigenkapital', '30.000 €', 1], ['Zins', '3,6 %', 1], ['Tilgung', '2 %', 1]],
      markt: [['Marktwert', '200.000 €', 4], ['Vergleichsmiete', '12,00 € / m²', 3]]
    },
    /* App-Ansichten der Strecke (index.html Etappen 02-09), Texte wie dort */
    ansichten: [
      ['01-objekt-erfassen.webp', 'Etappe 02 · Erfassen', 'Objekt erfassen', 'modul-03-datenaufnahme-vier-wege'],
      ['02-score.webp', 'Etappe 03 · Prüfen', 'Rendite und Investor Deal Score', 'modul-12-bewertung-und-kpis'],
      ['03-unterlagen.webp', 'Etappe 04 · Prüfen', 'Unterlagen lesen', 'modul-28-unterlagen-einlesen'],
      ['04-finanzierung.webp', 'Etappe 05 · Rechnen', 'Finanzierung und Cashflow', 'modul-08-finanzierung'],
      ['05-steuer.webp', 'Etappe 06 · Rechnen', 'Steuer, AfA und Restnutzungsdauer', 'modul-27-steuerverlauf-mit-wendepunkt'],
      ['06-wertermittlung.webp', 'Etappe 07 · Bewerten', 'Wertermittlung nach ImmoWertV', 'modul-30-marktbewertung-im-reiter-objekt'],
      ['07-zielbild.webp', 'Etappe 08 · Planen', 'Mieterhöhung und Zielbild', 'modul-26-mieterhoehung-und-zielbild'],
      ['08-bestand.webp', 'Etappe 09 · Halten', 'Vom Ankauf in den Bestand', 'modul-14-ankauf-in-den-bestand']
    ],
    /* Auszüge: Ausschnitte derselben Aufnahmen [Bild, Größe %, x %, y %, Etikett, Titel] */
    auszuege: [
      ['02-score.webp', 205, 0, 62, 'Auszug · Etappe 03', 'Investment-Score'],
      ['02-score.webp', 205, 100, 50, 'Auszug · Etappe 03', 'Finanzierungs-Score'],
      ['04-finanzierung.webp', 190, 100, 10, 'Auszug · Etappe 05', 'Zins je Zinsbindung'],
      ['06-wertermittlung.webp', 200, 50, 8, 'Auszug · Etappe 07', 'Ertrags- und Sachwert'],
      ['05-steuer.webp', 165, 55, 72, 'Auszug · Etappe 06', 'Steuerverlauf mit Wendepunkt'],
      ['06-wertermittlung.webp', 200, 0, 100, 'Auszug · Etappe 07', 'Bodenrichtwert']
    ],
    /* weitere App-Aufnahmen aus assets/app-bilder (wie landing-neu-4 appWand) */
    appbilder: [
      ['../app-bilder/09-finanzierung.webp', 'Aus der App', 'Finanzierung'],
      ['../app-bilder/11-deal-score-pilot-analyse.webp', 'Aus der App', 'Deal Score und Analyse'],
      ['../app-bilder/14-portfolio-cockpit.webp', 'Aus der App', 'Portfolio-Cockpit'],
      ['../app-bilder/16-steuerverlauf.webp', 'Aus der App', 'Steuerverlauf']
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
      return '<div class="ids-bar" data-n5bar="' + i + '"><div class="top"><span class="nm">' + c[0].replace('&', '&amp;') + '<span class="wt">' + c[1] + '%</span></span>'
        + '<span class="sc" style="color:' + f + '"><span data-sc>' + c[2] + '</span><small>/100</small></span></div>'
        + '<span class="track"><i style="background:' + f + ';width:' + c[2] + '%"></i></span><div class="kp">' + c[3] + ' KPIs</div></div>';
    }).join('');
    return '<div class="idscard" role="img" aria-label="Investor Deal Score 87 von 100, Sehr gut, Kaufpreis 180.000 Euro, 23 von 24 Kennzahlen">'
      + '<div class="ids-band"><span class="l"><i class="dot"></i>Pre-Flight · Investor Deal Score</span><span class="cleared">Cleared</span></div>'
      + '<div class="ids-head"><span class="ids-title">Investor <b>Deal Score</b></span><span class="ids-allkpi">☰ Alle KPIs</span></div>'
      + '<div class="ids-body"><div class="ids-left"><div class="ids-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tr" cx="60" cy="60" r="53"></circle>'
      + '<circle class="pg" cx="60" cy="60" r="53" style="stroke-dashoffset:43.3"></circle></svg><div class="ids-dv"><b data-ring>87</b><small>/&thinsp;100</small></div></div>'
      + '<div class="ids-badge">◆ Sehr gut</div>'
      + '<div class="ids-stats"><div><b data-stat="kp">180.000&nbsp;€</b><span>Kaufpreis</span></div><div><b data-stat="kpi">23/24</b><span>KPIs</span></div><div><b data-stat="tiefe">96&thinsp;%</b><span>Tiefe</span></div></div>'
      + '</div><div class="ids-right"><div class="ids-h">So setzt sich der Score zusammen</div><div>' + bars + '</div></div></div>'
      + '<div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
      + '<div class="ids-foot"><div class="lab">PASSENGER<b>DealPilot Co-Pilot</b></div><div class="lab" style="text-align:center">FLIGHT<b>DP · BOARDING</b></div><div class="ids-qr">' + qrSvg() + '</div></div></div>';
  }
  var VOLL = 333, ZIEL = 333 * (1 - .87);
  function karte(host) {
    host.innerHTML = karteHtml();
    var el = $('.idscard', host), pg = $('.ids-dial .pg', el), zahl = $('[data-ring]', el), kpiN = 0;
    function tiefe(n) { $('[data-stat="tiefe"]', el).innerHTML = Math.round(n / 24 * 100) + '&thinsp;%'; }
    var c = {
      el: el,
      leer: function () {
        pg.style.strokeDashoffset = VOLL; zahl.textContent = '0'; kpiN = 0;
        $$('.ids-bar', el).forEach(function (b) { $('.track i', b).style.width = '0%'; $('[data-sc]', b).textContent = '0'; });
        $('[data-stat="kp"]', el).innerHTML = '<span style="color:#cfc6b2">0&nbsp;€</span>';
        $('[data-stat="kpi"]', el).textContent = '0/24'; tiefe(0);
        $('.ids-badge', el).classList.add('weg');
        var cl = $('.cleared', el); cl.textContent = 'Wartet'; cl.classList.add('wartet');
      },
      kp: function () { var b = $('[data-stat="kp"]', el); b.innerHTML = '180.000&nbsp;€'; anim(b, [{ transform: 'scale(1.3)', color: '#b8932f' }, { transform: 'none', color: '#16130d' }]); },
      balken: function (i, ms) {
        var b = $$('.ids-bar', el)[i], ziel = D.balken[i][2], tr = $('.track i', b), alt = kpiN;
        kpiN += D.balken[i][4];
        zaehle($('[data-stat="kpi"]', el), kpiN, ms * .6, { nach: '/24', von: alt }); tiefe(kpiN);
        b.classList.add('trifft'); setTimeout(function () { b.classList.remove('trifft'); }, ms + 200);
        zaehle($('[data-sc]', b), ziel, ms);
        tr.style.width = ziel + '%';
        return anim(tr, [{ width: '0%' }, { width: ziel + '%' }], { duration: ms });
      },
      ring: function (ms) {
        var cl = $('.cleared', el);
        zaehle(zahl, 87, ms - 100);
        pg.style.strokeDashoffset = ZIEL;
        return anim(pg, [{ strokeDashoffset: VOLL }, { strokeDashoffset: ZIEL }], { duration: ms }).then(function () {
          $('.ids-badge', el).classList.remove('weg'); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
          anim(cl, [{ transform: 'scale(1.4)' }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.3,1.4,.5,1)' });
        });
      },
      fertig: function () {
        pg.style.strokeDashoffset = ZIEL; zahl.textContent = '87'; kpiN = 23;
        $$('.ids-bar', el).forEach(function (b, i) { $('.track i', b).style.width = D.balken[i][2] + '%'; $('[data-sc]', b).textContent = D.balken[i][2]; });
        $('[data-stat="kp"]', el).innerHTML = '180.000&nbsp;€'; $('[data-stat="kpi"]', el).textContent = '23/24'; tiefe(23);
        $('.ids-badge', el).classList.remove('weg'); var cl = $('.cleared', el); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
      },
      /* gesteuert von außen (Scroll): Balken i auf Anteil f, Ring auf Anteil f */
      setzeBalken: function (i, f) {
        var b = $$('.ids-bar', el)[i], z = D.balken[i][2];
        $('.track i', b).style.width = (z * f).toFixed(1) + '%'; $('[data-sc]', b).textContent = Math.round(z * f);
      },
      setzeRing: function (f) {
        pg.style.strokeDashoffset = (VOLL - (VOLL - ZIEL) * f).toFixed(1); zahl.textContent = Math.round(87 * f);
        var fertig = f >= .999, cl = $('.cleared', el);
        $('.ids-badge', el).classList.toggle('weg', !fertig); cl.textContent = fertig ? 'Cleared' : 'Wartet'; cl.classList.toggle('wartet', !fertig);
      },
      setzeKpi: function (n, kp) {
        $('[data-stat="kpi"]', el).textContent = n + '/24'; tiefe(n);
        $('[data-stat="kp"]', el).innerHTML = kp ? '180.000&nbsp;€' : '<span style="color:#cfc6b2">0&nbsp;€</span>';
      },
      ziel: function (k) { return k === 'kp' ? $('[data-stat="kp"]', el) : $('.track', $$('.ids-bar', el)[k]); }
    };
    return c;
  }

  /* ══ (a) Exposé ══════════════════════════════════════════════════════ */
  function exposeHtml(opt) {
    opt = opt || {};
    var E = D.expose;
    function f(x) { return '<div class="f" data-ziel="' + x[2] + '"><span>' + x[0] + '</span><b data-wert="' + x[1] + '">' + x[1] + '</b></div>'; }
    return '<div class="n5-expose" aria-label="Beispiel-Exposé: Kaufpreis 180.000 Euro, 100 Quadratmeter, Kaltmiete 1.300 Euro im Monat">'
      + '<span class="strahl" aria-hidden="true"></span>'
      + '<div class="ex-k"><span>EXPOSÉ</span><span>ANGEBOT</span></div>'
      + (opt.ohneFoto ? '' : '<div class="foto" style="background-image:url(' + E.foto + ')"></div>')
      + '<h4>' + E.titel + '</h4><div class="ort">' + E.art + '</div>'
      + '<div class="tab">' + E.felder.map(f).join('') + '</div>'
      + '<div class="eigen"><div class="ek">DEINE FINANZIERUNG</div>' + E.eigen.map(f).join('') + '</div>'
      + '<div class="eigen"><div class="ek">HOLT DEALPILOT DAZU</div>' + E.markt.map(f).join('') + '</div>'
      + '<div class="stempel">GELESEN</div></div>';
  }
  function fliege(von, nach, html, ms, hub) {
    if (!von || !nach || ruhig) return Promise.resolve();
    var a = von.getBoundingClientRect(), b = nach.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    var chip = document.createElement('div'); chip.className = 'n5-chip'; chip.innerHTML = html;
    document.body.appendChild(chip);
    var w = chip.offsetWidth, h = chip.offsetHeight, rand = document.documentElement.clientWidth - w - 8;
    var x0 = clamp(a.left + scrollX + a.width / 2 - w / 2, 8, rand), y0 = a.top + scrollY + a.height / 2 - h / 2;
    var x1 = clamp(b.left + scrollX + Math.min(b.width / 2, 60) - w / 2, 8, rand), y1 = b.top + scrollY + b.height / 2 - h / 2;
    chip.style.left = x0 + 'px'; chip.style.top = y0 + 'px';
    var dx = x1 - x0, dy = y1 - y0, hb = hub == null ? -80 : hub;
    return anim(chip, [
      { transform: 'translate(0,0) scale(.7)', opacity: 0 },
      { transform: 'translate(0,-10px) scale(1.08)', opacity: 1, offset: .12 },
      { transform: 'translate(' + (dx * .5) + 'px,' + (dy * .5 + hb) + 'px) scale(1) rotate(' + (dx > 0 ? 4 : -4) + 'deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.55)', opacity: 0 }
    ], { duration: ms || 900, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).then(function () { chip.remove(); });
  }
  var REIHEN = ['kp', 0, 1, 2, 3, 4];
  /* Ablauf wie landing-neu-4: Felder tippen sich ein, Lesestrahl, Stempel, Werte fliegen gruppenweise in die Karte, Ring.
     Ein neuer Lauf verwirft den laufenden. */
  function exposeFlug(exEl, k, opt) {
    opt = opt || {};
    var nr = (exEl._lauf = (exEl._lauf || 0) + 1);
    function lebt() { return exEl._lauf === nr; }
    var felder = $$('.f', exEl), st = $('.stempel', exEl);
    if (ruhig) { k.fertig(); st.classList.add('an'); return Promise.resolve(); }
    k.leer(); st.classList.remove('an'); exEl.classList.add('liest');
    felder.forEach(function (f) { var b = $('b', f); b.textContent = b.dataset.wert; b.classList.add('leer'); f.classList.remove('quelle'); });
    var tippen = Promise.all(felder.map(function (f, i) {
      return warte(i * (opt.abstand || 110)).then(function () {
        if (!lebt()) return;
        var b = $('b', f), t = b.dataset.wert; b.classList.remove('leer'); b.classList.add('tippt'); b.textContent = '';
        return new Promise(function (ok) {
          var n = 0, iv = setInterval(function () {
            n++; b.textContent = t.slice(0, n);
            if (n >= t.length || !lebt()) { clearInterval(iv); b.textContent = t; b.classList.remove('tippt'); ok(); }
          }, opt.tippen || 28);
        });
      });
    }));
    return tippen.then(function () { if (!lebt()) return; exEl.classList.remove('liest'); st.classList.add('an'); if (opt.beiGelesen) opt.beiGelesen(); return warte(380); }).then(function () {
      var kette = Promise.resolve();
      REIHEN.forEach(function (ziel) {
        kette = kette.then(function () {
          if (!lebt()) return;
          var quellen = felder.filter(function (f) { return f.dataset.ziel === String(ziel); });
          quellen.forEach(function (f) { f.classList.add('quelle'); });
          return Promise.all(quellen.map(function (f, i) {
            return warte(i * 110).then(function () { return fliege($('b', f), k.ziel(ziel), '<small>' + $('span', f).textContent + '</small>' + $('b', f).textContent, opt.flug || 820, opt.hub); });
          })).then(function () {
            quellen.forEach(function (f) { f.classList.remove('quelle'); });
            if (ziel === 'kp') { k.kp(); return warte(120); }
            k.balken(ziel, 800); return warte(90);
          });
        });
      });
      return kette;
    }).then(function () { if (lebt()) return k.ring(1400); });
  }

  /* Dieselbe Geschichte, aber vom Scrollen gesteuert (vor und zurück).
     buehne: Bezugsrahmen (position:relative), Chips leben darin. Gibt setze(p) zurück. */
  function exposeScrub(exEl, k, buehne) {
    var felder = $$('.f', exEl), st = $('.stempel', exEl), chips = [];
    var gruppen = REIHEN.map(function (z) { return felder.filter(function (f) { return f.dataset.ziel === String(z); }); });
    gruppen.forEach(function (g) { g.forEach(function (f) {
      var c = document.createElement('div'); c.className = 'n5-chip'; c.style.opacity = 0; c.style.left = '0'; c.style.top = '0';
      c.innerHTML = '<small>' + $('span', f).textContent + '</small>' + $('b', f).dataset.wert; buehne.appendChild(c); chips.push([f, c]);
    }); });
    function rel(el) { var a = el.getBoundingClientRect(), b = buehne.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; }
    return function setze(p) {
      if (ruhig) p = 1;
      /* 0 bis .32: tippen */
      var tp = clamp(p / .32, 0, 1);
      felder.forEach(function (f, i) {
        var b = $('b', f), t = b.dataset.wert, s = clamp(tp * felder.length * 1.4 - i * 1.25, 0, 1), n = Math.round(t.length * s);
        b.textContent = n ? t.slice(0, n) : t; b.classList.toggle('leer', n === 0); b.classList.toggle('tippt', n > 0 && n < t.length);
      });
      exEl.classList.toggle('liest', p > .02 && p < .32);
      st.classList.toggle('an', p >= .34);
      /* .36 bis .86: sechs Gruppen fliegen */
      var kpi = 0;
      gruppen.forEach(function (g, gi) {
        var a = .36 + gi * .083, f = clamp((p - a) / .083, 0, 1), ziel = REIHEN[gi];
        g.forEach(function (fe) { fe.classList.toggle('quelle', f > 0 && f < 1); });
        chips.forEach(function (cc) {
          if (g.indexOf(cc[0]) < 0) return;
          var c = cc[1];
          if (f <= 0 || f >= 1) { c.style.opacity = 0; return; }
          var q = rel($('b', cc[0])), z = rel(k.ziel(ziel)), w = c.offsetWidth, h = c.offsetHeight;
          var x0 = q.x + q.w / 2 - w / 2, y0 = q.y + q.h / 2 - h / 2, x1 = z.x + Math.min(z.w / 2, 60) - w / 2, y1 = z.y + z.h / 2 - h / 2;
          var e = f < .5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2, bogen = Math.sin(f * Math.PI) * -70;
          c.style.opacity = f < .1 ? f * 10 : f > .85 ? (1 - f) / .15 : 1;
          c.style.transform = 'translate(' + (x0 + (x1 - x0) * e).toFixed(1) + 'px,' + (y0 + (y1 - y0) * e + bogen).toFixed(1) + 'px) scale(' + (1 - .4 * e).toFixed(3) + ')';
        });
        if (ziel !== 'kp') { var fb = clamp((p - a - .05) / .07, 0, 1); k.setzeBalken(ziel, ein3(fb)); if (fb > 0) kpi += D.balken[ziel][4]; }
      });
      k.setzeKpi(kpi, p >= .36 + .07);
      /* .87 bis 1: Ring */
      k.setzeRing(ein3(clamp((p - .87) / .12, 0, 1)));
    };
  }

  /* ══ (b) Streifen ════════════════════════════════════════════════════ */
  function stueck(art, x, opt) {
    var hrefV = function (v) { return 'videothek.html?v=' + v; };
    if (art === 'auszug') {
      return '<figure class="st"><div class="bild" role="img" aria-label="' + x[5] + ', Ausschnitt aus DealPilot" style="background-image:url(assets/dp-strecke/' + x[0] + ');background-size:' + x[1] + '% auto;background-position:' + x[2] + '% ' + x[3] + '%"><span class="lupe">Auszug</span></div>'
        + '<figcaption>' + x[4] + '<b>' + x[5] + '</b></figcaption></figure>';
    }
    if (art === 'app') {
      return '<figure class="st"><div class="bild"><img src="assets/dp-strecke/' + x[0] + '" alt="' + x[2] + '" loading="lazy" width="1600" height="900"></div><figcaption>' + x[1] + '<b>' + x[2] + '</b></figcaption></figure>';
    }
    var tag = opt.verlinkt ? 'a' : 'figure', ziel = opt.verlinkt ? ' href="' + (opt.verlinkt === 'video' ? hrefV(x[3]) : '#workflow') + '"' : '';
    return '<' + tag + ' class="st"' + ziel + '><div class="bild"><img src="assets/dp-strecke/' + x[0] + '" alt="DealPilot: ' + x[2] + '" loading="lazy" width="1600" height="900"></div><figcaption>' + x[1] + '<b>' + x[2] + '</b></figcaption></' + tag + '>';
  }
  /* opt: art 'mix' | 'ansicht' | 'auszug', tempo (px/s), richtung 1|-1, scroll (Kopplung), verlinkt */
  function streifen(el, opt) {
    opt = opt || {};
    var art = opt.art || 'mix', liste = [];
    if (art === 'ansicht') liste = D.ansichten.map(function (x) { return stueck('ansicht', x, opt); });
    else if (art === 'auszug') liste = D.auszuege.map(function (x) { return stueck('auszug', x, opt); });
    else if (art === 'app') liste = D.appbilder.map(function (x) { return stueck('app', x, opt); }).concat(D.ansichten.slice(0, 4).map(function (x) { return stueck('ansicht', x, opt); }));
    else D.ansichten.forEach(function (x, i) { liste.push(stueck('ansicht', x, opt)); if (D.auszuege[i]) liste.push(stueck('auszug', D.auszuege[i], opt)); });
    var halb = liste.join('');
    el.classList.add('n5-streifen');
    el.innerHTML = '<div class="zug">' + halb + halb + '</div>';
    var zug = $('.zug', el);
    if (ruhig) return { zug: zug };
    var x = 0, t0 = null, sicht = true, tempo = opt.tempo || 26, r = opt.richtung || -1, k = opt.scroll == null ? .35 : opt.scroll, sy0 = scrollY, ext = 0;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { sicht = es[0].isIntersecting; }).observe(el);
    el.addEventListener('mouseenter', function () { tempo *= .25; });
    el.addEventListener('mouseleave', function () { tempo = opt.tempo || 26; });
    (function lauf(t) {
      if (t0 == null) t0 = t;
      var dt = Math.min(64, t - t0); t0 = t;
      if (sicht) {
        var w = zug.scrollWidth / 2 || 1;
        x += tempo * dt / 1000 + Math.abs(scrollY - sy0) * k; sy0 = scrollY;
        var v = ((x + ext) % w + w) % w;
        zug.style.transform = 'translate3d(' + (r < 0 ? -v : v - w).toFixed(1) + 'px,0,0)';
      } else sy0 = scrollY;
      requestAnimationFrame(lauf);
    })(performance.now());
    return { zug: zug, schiebe: function (d) { ext = d; } };
  }

  /* ── Hinweis „Vorlage“ ────────────────────────────────────────────── */
  function hinweis(nr, titel) {
    var d = document.createElement('div'); d.className = 'n5-vk';
    d.innerHTML = 'Vorlage · <b>' + nr + '</b> · ' + titel + ' <a href="../../design/Vorschläge/landing-neu-5/index.html">Übersicht</a>';
    document.body.appendChild(d);
  }

  window.N5 = { ruhig: ruhig, $: $, $$: $$, warte: warte, clamp: clamp, anim: anim, sichtbar: sichtbar, scrollFort: scrollFort, zaehle: zaehle,
    D: D, karte: karte, exposeHtml: exposeHtml, exposeFlug: exposeFlug, exposeScrub: exposeScrub, streifen: streifen, hinweis: hinweis };
})();
