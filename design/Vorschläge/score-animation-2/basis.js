/* score-animation-2 · Daten, Bausteine und Ablaufsteuerung (19.11.2026)

   DATEN — woher jede Zahl kommt:
   Hero (Startbild)  frontend/landing/index.html Z.190-217 (Markup, Ring 87, „Sehr gut“,
                     180.000 €, 23/24 KPIs, 96 %), Balken aus frontend/landing/dp2.js Z.64-70
                     (Rendite 35 % 98 · Finanzierung 25 % 96 · Risiko 20 % 88 ·
                     Lage & Markt 10 % 60 · Upside / Potenzial 10 % 53).
   Zielbild          Zuordnung und Gewichte aus frontend/js/dealscore2.js Z.840-897
                     (ZWEI_ZUORDNUNG, _zweiTeil) mit dem Profil „Ausgewogen“ (DEFAULTS Z.45-90).
                     Gerechnet mit rechnung.mjs (lädt den echten Quelltext):
                       Investment   = (19,25·98,909 + 20·88 + 10·60 + 10·53) / 59,25 = 80,91 → 81
                       Finanzierung = (25·96 + 15,75·96,889) / 40,75           = 96,34 → 96
                       Gesamt       = 59,25 % · 80,91 + 40,75 % · 96,34        = 87,20 → 87
                     Anteile wie die App sie anzeigt (Math.round auf Promille): 59,3 % / 40,8 %.
                     Die Rendite 98 teilt sich in Objektrendite 99 (Brutto 100, Netto 98) und
                     Cashflow & EK-Rendite 97 (Cashflow 100, Cash-on-Cash 93): (25·100+30·98+25·100+20·93)/100 = 98.
   Texte             frontend/js/dpsh-score-hero.js Z.410-450 (zweiAnsichtHtml): Fragen,
                     „Zählt … % zum Gesamtscore …“, Kopfsatz, Empfehlung „Kaufen“ (beide Schwellen).
                     Halbgeviertstriche der App-Zeile „— 2/2 KPIs“ hier als „· 2/2 KPIs“ (Kundentext
                     nur Punkt und Komma). */
(function () {
  'use strict';
  var GRN = '#3FA56C', GOLD = 'var(--wl-c9a84c, #C9A84C)', ROT = '#B8625C';
  function farbe(s) { return s >= 70 ? GRN : s >= 50 ? GOLD : ROT; }
  function stufe(s) { return s >= 85 ? 'Sehr gut' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch'; }

  var D = {
    hero: {
      score: 87,
      bars: [
        ['Rendite', 35, 98, '4/4', GRN], ['Finanzierung', 25, 96, '5/5', GRN], ['Risiko', 20, 88, '5/6', GRN],
        ['Lage & Markt', 10, 60, '5/5', GOLD], ['Upside / Potenzial', 10, 53, '4/4', GOLD]
      ]
    },
    inv: {
      key: 'inv', titel: 'Investment-Score', frage: 'Wie gut ist die Immobilie, egal wie sie finanziert wird?',
      score: 81, anteil: '59,3', gewicht: '59,25',
      gruppen: [
        { name: 'Objektrendite', anteil: '32,5', score: 99, n: '2/2', kpis: 'Bruttorendite · Nettorendite', von: 0 },
        { name: 'Risiko & Zustand', anteil: '33,8', score: 88, n: '5/6', kpis: 'Leerstand · Instandhaltung · Bausubstanz · Energieklasse · Mietausfall-Risiko · Ausstattungsqualität', von: 2 },
        { name: 'Lage & Markt', anteil: '16,9', score: 60, n: '5/5', kpis: 'Ist-/Marktmiete · Mietwachstum p.a. · Bevölkerung · Nachfrage · Mikrolage', von: 3 },
        { name: 'Potenzial & Preis', anteil: '16,9', score: 53, n: '4/4', kpis: 'Mietsteigerung-Potenzial · Faktor vs. Markt · Wertsteigerung · Entwicklungsmöglichkeiten', von: 4 }
      ]
    },
    fin: {
      key: 'fin', titel: 'Finanzierungs-Score', frage: 'Trägt die geplante Finanzierung dieses Objekt?',
      score: 96, anteil: '40,8', gewicht: '40,75',
      gruppen: [
        { name: 'Kapitaldienst & Beleihung', anteil: '61,3', score: 96, n: '5/5', kpis: 'DSCR · LTV · Zinssatz · Tilgung · EK-Bedarf', von: 1 },
        { name: 'Cashflow & EK-Rendite', anteil: '38,7', score: 97, n: '2/2', kpis: 'Cashflow / Mon. · Cash-on-Cash', von: 0 }
      ]
    },
    ges: { score: 87 }
  };

  /* ── Hero-Karte: Markup wie index.html Z.190-217, Balken wie dp2.js Z.73-79 ── */
  function qrSvg() { /* dp2.js Z.83-99, gleicher Startwert = gleiches Bild */
    var n = 11, cell = 3, svg = '<svg width="' + (n * cell) + '" height="' + (n * cell) + '" viewBox="0 0 ' + (n * cell) + ' ' + (n * cell) + '" aria-hidden="true">';
    function fp(x, y) {
      return '<rect x="' + x + '" y="' + y + '" width="' + (7 * cell) + '" height="' + (7 * cell) + '" fill="#0c0b09"/>'
        + '<rect x="' + (x + cell) + '" y="' + (y + cell) + '" width="' + (5 * cell) + '" height="' + (5 * cell) + '" fill="#fff"/>'
        + '<rect x="' + (x + 2 * cell) + '" y="' + (y + 2 * cell) + '" width="' + (3 * cell) + '" height="' + (3 * cell) + '" fill="#0c0b09"/>';
    }
    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if ((x < 7 && y < 7) || (x > 3 && y < 7 && x >= n - 7)) continue;
      if (rnd() > 0.55) svg += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="' + cell + '" height="' + cell + '" fill="#0c0b09"/>';
    }
    return svg + fp(0, 0) + fp((n - 7) * cell, 0) + '</svg>';
  }
  function heroHtml() {
    var bars = D.hero.bars.map(function (c, i) {
      return '<div class="ids-bar" data-hbar="' + i + '"><div class="top">'
        + '<span class="nm">' + c[0] + '<span class="wt">' + c[1] + '%</span></span>'
        + '<span class="sc" style="color:' + c[4] + '">' + c[2] + '<small>/100</small></span>'
        + '</div><span class="track"><i data-hbreit="' + c[2] + '" style="background:' + c[4] + '"></i></span>'
        + '<div class="kp">' + c[3] + ' KPIs</div></div>';
    }).join('');
    return '<div class="idscard">'
      + '<div class="ids-band"><span class="l"><i class="dot"></i>Pre-Flight · Investor Deal Score</span><span class="cleared">Cleared</span></div>'
      + '<div class="ids-head"><span class="ids-title">Investor <b>Deal Score</b></span><span class="ids-allkpi">☰ Alle KPIs</span></div>'
      + '<div class="ids-body"><div class="ids-left"><div class="ids-dial">'
      + '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tr" cx="60" cy="60" r="53"></circle><circle class="pg" cx="60" cy="60" r="53"></circle></svg>'
      + '<div class="ids-dv"><b>87</b><small>/&thinsp;100</small></div></div>'
      + '<div class="ids-badge">◆ Sehr gut</div>'
      + '<div class="ids-stats"><div><b>180.000&nbsp;€</b><span>Kaufpreis</span></div><div><b>23/24</b><span>KPIs</span></div><div><b>96&thinsp;%</b><span>Tiefe</span></div></div>'
      + '</div><div class="ids-right"><div class="ids-h">So setzt sich der Score zusammen</div><div>' + bars + '</div></div></div>'
      + '<div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
      + '<div class="ids-foot"><div class="lab">PASSENGER<b>DealPilot Co-Pilot</b></div>'
      + '<div class="lab" style="text-align:center">FLIGHT<b>DP · BOARDING</b></div><div class="ids-qr">' + qrSvg() + '</div></div>'
      + '</div>';
  }
  /* Hero im fertigen Zustand der Landing (Ring auf 87, Balken voll) */
  function heroFertig(card) {
    var pg = card.querySelector('.ids-dial .pg'); if (pg) pg.style.strokeDashoffset = (333 * (1 - 87 / 100)).toFixed(1);
    card.querySelectorAll('[data-hbreit]').forEach(function (i) { i.style.width = i.dataset.hbreit + '%'; });
  }

  /* ── Zielbild ── */
  var RU = 276.5; /* 2·π·44 */
  function karteHtml(t, opt) {
    opt = opt || {};
    var kl = t.score >= 70 ? 'g' : 'o';
    var grp = t.gruppen.map(function (g) {
      return '<div class="zs-kz" data-gruppe="' + g.von + '"><span class="zs-t">' + g.name + ' <span class="zs-anteil">' + g.anteil + ' %</span></span>'
        + '<span class="zs-p"><b data-zahl="' + g.score + '">' + g.score + '</b> / 100</span>'
        + '<span class="zs-bar"><i data-breit="' + g.score + '" style="background:' + farbe(g.score) + '"></i></span>'
        + '<span class="zs-m">' + g.kpis + ' · ' + g.n + ' KPIs</span></div>';
    }).join('');
    var band = opt.pass
      ? '<div class="zs-band ids-band"><span class="l"><i class="dot"></i>Pre-Flight · ' + t.titel + '</span><span class="cleared">' + (t.key === 'inv' ? 'ab 70' : 'ab 50') + ' erreicht</span></div>'
      : '<div class="zs-band"></div>';
    var fuss = 'Zählt ' + t.anteil + ' % zum Gesamtscore ' + D.ges.score + '.';
    var stub = opt.pass
      ? '<div class="zs-foot"><div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
        + '<div class="ids-foot"><div class="lab">Anteil<b>' + t.anteil + ' %</b></div><div class="lab" style="text-align:center">Gesamt<b>' + D.ges.score + ' · Sehr gut</b></div><div class="ids-qr">' + qrSvg() + '</div></div></div>'
      : '';
    return '<div class="zs-karte' + (opt.pass ? ' pass' : '') + '" data-karte="' + t.key + '">' + band + '<div class="zs-pad">'
      + '<div class="zs-score"><div class="zs-ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="tr" cx="52" cy="52" r="44"/>'
      + '<circle class="pg" cx="52" cy="52" r="44" data-ring="' + t.score + '" style="stroke:' + farbe(t.score) + '"/></svg>'
      + '<div class="zs-n" data-zahl="' + t.score + '">' + t.score + '</div></div>'
      + '<div><h3 class="zs-h3">' + t.titel + '</h3><span class="zs-pill ' + kl + '">' + stufe(t.score).toUpperCase() + '</span>'
      + '<div class="zs-was">' + t.frage + '</div></div></div>'
      + '<div class="zs-kat">' + grp + '</div>'
      + '<div class="zs-summe">' + fuss + '</div></div>' + stub + '</div>';
  }
  function kopfHtml() {
    return '<div class="zs-kopf" data-teil="kopf"><div><div class="zs-lbl">Gesamturteil · Investor Deal Score</div>'
      + '<div class="zs-wort">Sehr gut <span class="zs-wert"><b data-zahl="87">87</b> / 100</span></div></div>'
      + '<span class="zs-empf">Kaufen</span>'
      + '<div class="zs-warum">Gesamt aus Investment <b>81</b> (59,3 %) und Finanzierung <b>96</b> (40,8 %). '
      + 'Empfehlung nach Schwellen: Investment ab 70, Finanzierung ab 50. Beide Schwellen erreicht.</div>'
      + '<div class="zs-formel" data-teil="formel"><span class="fl">Gewichtetes Mittel</span>'
      + '<span class="ft" data-f="1">59,3 % × <b data-zahl="81">81</b></span><span class="fop" data-f="2">+</span>'
      + '<span class="ft" data-f="3">40,8 % × <b data-zahl="96">96</b></span><span class="fop" data-f="4">=</span>'
      + '<span class="ft fe" data-f="5"><b data-zahl="87">87</b></span>'
      + '<span class="fz" data-f="6">Ungerundet 59,25 % × 80,9 + 40,75 % × 96,3 = 87,2. Die Anteile sind die Gewichte des Profils Ausgewogen, aufgeteilt nach Kennzahlen.</span></div></div>';
  }
  /* Marcel 19.11.: „Einer reicht nicht. Zwei Scores.“ Kundentext nur Punkt und Komma. */
  function botschaftHtml() {
    return '<div class="zs-botschaft" data-teil="botschaft"><div class="bt1">Einer reicht nicht. <b>Zwei Scores.</b></div>'
      + '<i class="bt-strich"></i>'
      + '<div class="bt2">Dein Objekt kann gut sein, deine Finanzierung nicht. Darum rechnet DealPilot beides getrennt.</div></div>';
  }
  function zweiHtml(opt) {
    return '<div class="zs verdeckt">' + botschaftHtml() + kopfHtml() + '<div class="zs-zwei">' + karteHtml(D.inv, opt) + karteHtml(D.fin, opt) + '</div></div>';
  }
  function zielNull(root) {
    root.querySelectorAll('[data-zahl]').forEach(function (e) { e.textContent = '0'; });
    root.querySelectorAll('[data-breit]').forEach(function (e) { e.style.width = '0%'; });
    root.querySelectorAll('[data-ring]').forEach(function (e) { e.style.strokeDashoffset = RU; });
  }
  function zielFertig(root) {
    root.querySelectorAll('[data-zahl]').forEach(function (e) { e.textContent = e.dataset.zahl; });
    root.querySelectorAll('[data-breit]').forEach(function (e) { e.style.width = e.dataset.breit + '%'; });
    root.querySelectorAll('[data-ring]').forEach(function (e) { e.style.strokeDashoffset = (RU * (1 - e.dataset.ring / 100)).toFixed(1); });
  }

  /* ── Ablaufsteuerung ── */
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lauf = 0, ALT = { alt: true };
  function ctx(nr) {
    var c = {
      ruhig: ruhig,
      lebt: function () { return nr === lauf; },
      warte: function (ms) { return new Promise(function (ok, nein) { setTimeout(function () { nr === lauf ? ok() : nein(ALT); }, ms); }); },
      anim: function (el, kf, o) {
        if (!el) return Promise.resolve();
        o = Object.assign({ duration: 600, easing: 'cubic-bezier(.2,.72,.2,1)', fill: 'both' }, o || {});
        var a = el.animate(kf, o);
        return a.finished.then(function () { if (nr !== lauf) throw ALT; }, function () { throw ALT; });
      },
      /* Zahl hochzählen (Text), unabhängig vom Lauf sicher */
      zaehle: function (el, ms, von) {
        var ziel = +el.dataset.zahl, v0 = von || 0, t0 = null;
        return new Promise(function (ok) {
          function s(t) {
            if (nr !== lauf) return ok();
            if (t0 == null) t0 = t;
            var x = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - x, 3);
            el.textContent = Math.round(v0 + (ziel - v0) * e);
            if (x < 1) requestAnimationFrame(s); else ok();
          }
          requestAnimationFrame(s);
        });
      },
      /* Ringe, Zahlen, Balken einer Karte oder des ganzen Zielbilds laufen lassen */
      fuelle: function (root, o) {
        o = o || {};
        var d = o.dauer || 1300, p = [];
        root.querySelectorAll('[data-ring]').forEach(function (r) {
          p.push(c.anim(r, [{ strokeDashoffset: RU }, { strokeDashoffset: (RU * (1 - r.dataset.ring / 100)).toFixed(1) }], { duration: d + 300 })
            .then(function () { r.style.strokeDashoffset = (RU * (1 - r.dataset.ring / 100)).toFixed(1); }).catch(function () {}));
        });
        root.querySelectorAll('.zs-n[data-zahl], .zs-p [data-zahl], .zs-wert [data-zahl]').forEach(function (z) { p.push(c.zaehle(z, d + 200)); });
        root.querySelectorAll('[data-breit]').forEach(function (b, i) {
          p.push(c.anim(b, [{ width: '0%' }, { width: b.dataset.breit + '%' }], { duration: d, delay: i * (o.stufe || 110) })
            .then(function () { b.style.width = b.dataset.breit + '%'; }).catch(function () {}));
        });
        return Promise.all(p);
      },
      /* Formelzeile Glied für Glied */
      formel: function (root, abstand) {
        var p = [];
        root.querySelectorAll('[data-f]').forEach(function (f, i) {
          p.push(c.anim(f, [{ opacity: 0, transform: 'translateY(8px) scale(.9)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: 420, delay: i * (abstand || 170) }).catch(function () {}));
        });
        root.querySelectorAll('.zs-formel [data-zahl]').forEach(function (z, i) {
          var el = z; setTimeout(function () { if (nr === lauf) c.zaehle(el, 700); }, 80 + i * 2 * (abstand || 170));
        });
        return Promise.all(p);
      }
    };
    return c;
  }

  /* Rechteck eines Elements relativ zu einem Bezugselement */
  function rel(el, bezug) {
    var a = el.getBoundingClientRect(), b = bezug.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }

  /* Hero in zwei Hälften entlang eines Zickzack-Pfads (Punkte in Anteilen 0..1).
     Liefert die zwei geklonten Hälften, die Riss-Grafik und deren Pfadlänge. */
  function spalte(platz, bezug, punkte) {
    var card = platz.querySelector('.idscard'), r = rel(card, bezug);
    var links = 'polygon(0 0,' + punkte.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',') + ',0 100%)';
    var rechts = 'polygon(100% 0,' + punkte.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',') + ',100% 100%)';
    function klon(clip) {
      var h = document.createElement('div'); h.className = 'haelfte';
      h.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;clip-path:' + clip;
      var k = card.cloneNode(true); k.style.width = r.w + 'px'; k.style.height = r.h + 'px'; h.appendChild(k);
      bezug.appendChild(h); return h;
    }
    var L = klon(links), R = klon(rechts);
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'riss-svg'); svg.setAttribute('width', r.w); svg.setAttribute('height', r.h);
    svg.style.left = r.x + 'px'; svg.style.top = r.y + 'px';
    var d = punkte.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] * r.w).toFixed(1) + ' ' + (p[1] * r.h).toFixed(1); }).join(' ');
    svg.innerHTML = '<defs><filter id="glut" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<path d="' + d + '" fill="none" stroke="#E8CC7A" stroke-width="7" stroke-linejoin="miter" opacity=".55" filter="url(#glut)"/>'
      + '<path d="' + d + '" fill="none" stroke="#fff6d8" stroke-width="2.2" stroke-linejoin="miter"/>';
    bezug.appendChild(svg);
    var pfade = svg.querySelectorAll('path'), len = pfade[1].getTotalLength();
    pfade.forEach(function (p) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
    return { L: L, R: R, svg: svg, pfade: pfade, len: len, rect: r, karte: card };
  }

  function zickzack(n, mitte, ausschlag, seed) {
    var s = seed || 3, pts = [[mitte, 0]];
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 1; i < n; i++) pts.push([mitte + (rnd() - .5) * 2 * ausschlag, i / n]);
    pts.push([mitte + (rnd() - .5) * ausschlag, 1]);
    return pts;
  }

  function funken(bezug, x, y, anzahl, c, weite) {
    var p = [];
    for (var i = 0; i < anzahl; i++) {
      var f = document.createElement('i'); f.className = 'funke';
      f.style.left = x + 'px'; f.style.top = y + 'px'; bezug.appendChild(f);
      var w = Math.random() * Math.PI * 2, r = (weite || 160) * (.35 + Math.random() * .8), s = .4 + Math.random() * 1.2;
      p.push(c.anim(f, [
        { transform: 'translate(-50%,-50%) scale(' + s + ')', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + (Math.cos(w) * r).toFixed(0) + 'px),calc(-50% + ' + (Math.sin(w) * r + 40).toFixed(0) + 'px)) scale(0)', opacity: 0 }
      ], { duration: 600 + Math.random() * 700, easing: 'cubic-bezier(.1,.7,.3,1)' }).catch(function () {}).then((function (el) { return function () { el.remove(); }; })(f)));
    }
    return Promise.all(p);
  }

  /* Seite aufbauen: Kopfleiste, Navigation, Bühne, Wiederholen */
  function start(cfg) {
    var nav = [['index.html', 'Übersicht'], ['1-riss-aufklappen.html', '1 · Riss und Aufklappen'], ['2-bruch-funken.html', '2 · Bruch mit Funken'],
      ['3-boarding-pass.html', '3 · Boarding-Pass'], ['4-riss-kippen.html', '4 · Riss und Kippen']];
    var hier = location.pathname.split('/').pop();
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="kopfleiste"><div><div class="t">Score-Animation · Runde 2 · ' + cfg.nr + '</div><h1>' + cfg.titel + '</h1><p>' + cfg.text + '</p></div>'
      + '<div class="knoepfe"><button class="knopf voll" type="button" id="nochmal">↻ Wiederholen</button></div></header>'
      + '<nav class="varnav">' + nav.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === hier ? ' class="hier"' : '') + '>' + n[1] + '</a>'; }).join('') + '</nav>'
      + '<main class="buehne"><div class="buehne-innen" id="buehne"></div></main>');
    var b = document.getElementById('buehne');
    function neu() {
      lauf++;
      window.SA2_T0 = performance.now(); /* Startzeit, damit Prüfaufnahmen relativ zum Lauf messen */
      document.getAnimations().forEach(function (a) { try { a.cancel(); } catch (e) {} });
      b.innerHTML = '<div class="hero-platz">' + heroHtml() + '</div>' + zweiHtml(cfg.zielOpt);
      var c = ctx(lauf), z = b.querySelector('.zs'), h = b.querySelector('.hero-platz');
      var s = { b: b, z: z, h: h, karte: h.querySelector('.idscard') };
      if (c.ruhig) { h.remove(); z.classList.remove('verdeckt'); zielFertig(z); return; }
      Promise.resolve().then(function () { return cfg.ablauf(c, s); })
        .catch(function (e) { if (e !== ALT) { console.error(e); h.remove(); z.classList.remove('verdeckt'); zielFertig(z); } });
    }
    document.getElementById('nochmal').addEventListener('click', neu);
    var rt, breite = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === breite) return; /* Handy: Adressleiste ändert nur die Höhe */
      breite = window.innerWidth; clearTimeout(rt); rt = setTimeout(neu, 250);
    });
    /* Gemessen 19.11.: beim Kaltstart kam fonts.ready nie, die Bühne blieb leer.
       Deshalb startet die Szene spätestens nach 1,2 s, egal ob die Schriften da sind. */
    /* Nachgemessen: die eigentliche Ursache war das Google-Fonts-Stylesheet. Es blockierte das
       Rendern, und dieses Skript lief erst nach ihm. Es lädt jetzt nicht blockierend
       (media=print, onload), und hier wird auf die drei Schriften gewartet, höchstens 1,5 s,
       damit die Hälften nicht in einer Ersatzschrift ausgemessen werden. */
    var gestartet = false;
    function einmal() { if (!gestartet) { gestartet = true; neu(); } }
    var link = document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    var cssDa = new Promise(function (ok) {
      if (!link || link.media === 'all') return ok();
      link.addEventListener('load', ok); link.addEventListener('error', ok);
    });
    cssDa.then(function () {
      if (!document.fonts || !document.fonts.load) return;
      return Promise.all(['700 20px "Space Grotesk"', '500 12px "JetBrains Mono"', '400 14px "Inter"'].map(function (f) { return document.fonts.load(f); }));
    }).then(einmal, einmal);
    setTimeout(einmal, 1500);
  }

  /* ── Marcel 19.11.: die Karte ist vor dem Riss „beweglich“ ──
     Sie kippt mit Maus oder Finger, ein Glanz folgt dem Zeiger. Ohne Zeiger
     (Handy ohne Berührung, Aufnahme) schwebt sie von selbst. Ein Klick oder
     Tippen auf die Karte reißt sie sofort. Am Ende liegt sie wieder flach,
     damit die Hälften vom echten Rechteck geklont werden. */
  function schweben(c, s, ms) {
    var karte = s.karte, platz = s.h, glanz = document.createElement('i');
    glanz.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;mix-blend-mode:soft-light;opacity:0;transition:opacity .3s';
    karte.appendChild(glanz);
    platz.style.perspective = '1100px';
    karte.style.transformStyle = 'preserve-3d';
    var zx = null, zy = null, rx = 0, ry = 0, t0 = performance.now(), fertig = false, schluss;
    function zeiger(e) {
      var p = e.touches ? e.touches[0] : e, r = karte.getBoundingClientRect();
      zx = Math.max(-1, Math.min(1, (p.clientX - r.left) / r.width * 2 - 1));
      zy = Math.max(-1, Math.min(1, (p.clientY - r.top) / r.height * 2 - 1));
    }
    function los() { fertig = true; }
    window.addEventListener('pointermove', zeiger);
    window.addEventListener('touchmove', zeiger, { passive: true });
    karte.addEventListener('click', los);
    karte.style.cursor = 'pointer';
    return new Promise(function (ok) {
      function schritt(t) {
        if (!c.lebt()) return ok();
        var dt = (t - t0) / 1000;
        /* ohne Zeiger: ruhige Acht, damit die Bewegung auch ohne Maus sichtbar ist */
        var ziel = zx === null ? { x: Math.sin(dt * 1.6) * .8, y: Math.sin(dt * 3.2) * .45 } : { x: zx, y: zy };
        rx += (ziel.y * -9 - rx) * .12; ry += (ziel.x * 12 - ry) * .12;
        karte.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(18px)';
        karte.style.boxShadow = (-ry * 2).toFixed(1) + 'px ' + (40 + rx * 2).toFixed(1) + 'px 80px -30px rgba(0,0,0,.85),0 0 0 1px rgba(232,204,122,' + (.15 + Math.abs(ry) / 60).toFixed(2) + ')';
        glanz.style.opacity = 1;
        glanz.style.background = 'radial-gradient(420px circle at ' + ((ziel.x + 1) * 50).toFixed(1) + '% ' + ((ziel.y + 1) * 50).toFixed(1) + '%,rgba(255,246,216,.85),transparent 60%)';
        if (fertig || t - t0 > ms) {
          window.removeEventListener('pointermove', zeiger); window.removeEventListener('touchmove', zeiger);
          karte.removeEventListener('click', los); karte.style.cursor = '';
          /* flach zurück, dann erst reißen */
          c.anim(karte, [{ transform: karte.style.transform }, { transform: 'none' }], { duration: 260, fill: 'none' }).catch(function () {}).then(function () {
            karte.style.transform = ''; karte.style.boxShadow = ''; glanz.remove(); platz.style.perspective = ''; ok();
          });
          return;
        }
        requestAnimationFrame(schritt);
      }
      requestAnimationFrame(schritt);
    });
  }

  /* ── Marcel 19.11.: nach dem Riss die Botschaft ──
     Erscheint groß in der Bildmitte, bleibt stehen und fliegt dann an ihren
     festen Platz über dem Gesamturteil (dort steht sie auch im Endbild). */
  function botschaftAuf(c, s, x, y) {
    var ziel = s.z.querySelector('.zs-botschaft'); ziel.style.opacity = 0;
    var o = document.createElement('div'); o.className = 'botschaft-gross';
    o.innerHTML = ziel.innerHTML; s.b.appendChild(o);
    /* Handy: die Karte ist höher als der Bildschirm, die Botschaft gehört in die Bildschirmmitte */
    var vy = window.innerHeight / 2 - s.b.getBoundingClientRect().top;
    if (vy > 0) y = Math.min(y, vy);
    var w = Math.min(s.b.offsetWidth, 760);
    o.style.width = w + 'px'; o.style.left = (Math.max(0, Math.min(s.b.offsetWidth - w, x - w / 2))) + 'px';
    o.style.top = (y - o.offsetHeight / 2) + 'px';
    s.botschaft = o;
    var w1 = o.querySelector('.bt1'), w2 = o.querySelector('.bt2'), strich = o.querySelector('.bt-strich');
    return Promise.all([
      c.anim(o, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }),
      c.anim(w1, [{ opacity: 0, transform: 'scale(1.6)', filter: 'blur(14px)', letterSpacing: '.18em' }, { opacity: 1, transform: 'none', filter: 'blur(0)', letterSpacing: '-.01em' }], { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' }),
      c.anim(strich, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 520, delay: 420, easing: 'cubic-bezier(.6,0,.2,1)' }),
      c.anim(w2, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 560 })
    ]).then(function () { return c.warte(1100); });
  }
  function botschaftAb(c, s) {
    var o = s.botschaft, ziel = s.z.querySelector('.zs-botschaft');
    if (!o) return Promise.resolve();
    var A = rel(o, s.b), Z = rel(ziel, s.b);
    o.style.transformOrigin = '0 0';
    return c.anim(o, [{ transform: 'none' }, { transform: 'translate(' + (Z.x - A.x).toFixed(1) + 'px,' + (Z.y - A.y).toFixed(1) + 'px) scale(' + (Z.w / A.w).toFixed(3) + ',' + (Z.h / A.h).toFixed(3) + ')', opacity: .4 }],
      { duration: 700, easing: 'cubic-bezier(.6,0,.2,1)' }).then(function () {
      ziel.style.opacity = ''; o.remove(); s.botschaft = null;
      return c.anim(ziel, [{ opacity: .4 }, { opacity: 1 }], { duration: 250 });
    });
  }

  /* Mutigere Effekte: Druckwelle in Gold, kurzer Blitz über der ganzen Bühne */
  function druckwelle(c, b, x, y, gross) {
    var r = document.createElement('i'); r.className = 'welle';
    var d = gross || 520;
    r.style.cssText = 'left:' + (x - d / 2) + 'px;top:' + (y - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px';
    b.appendChild(r);
    return c.anim(r, [{ transform: 'scale(.05)', opacity: 1, borderWidth: '10px' }, { transform: 'scale(1)', opacity: 0, borderWidth: '1px' }], { duration: 800, easing: 'cubic-bezier(.1,.7,.3,1)' })
      .catch(function () {}).then(function () { r.remove(); });
  }

  /* Hero so einlaufen lassen wie auf der Landing (Ring 1,6 s, Balken gestaffelt) */
  function heroEinlauf(c, s) {
    var pg = s.karte.querySelector('.ids-dial .pg'), z = s.karte.querySelector('.ids-dv b');
    z.dataset.zahl = 87;
    var p = [c.anim(pg, [{ strokeDashoffset: 333 }, { strokeDashoffset: 43.3 }], { duration: 1500 }), c.zaehle(z, 1400)];
    s.karte.querySelectorAll('[data-hbreit]').forEach(function (i, n) {
      p.push(c.anim(i, [{ width: '0%' }, { width: i.dataset.hbreit + '%' }], { duration: 1000, delay: n * 130 }));
    });
    return Promise.all(p).then(function () { heroFertig(s.karte); });
  }

  window.SA2 = { D: D, farbe: farbe, start: start, heroFertig: heroFertig, heroEinlauf: heroEinlauf, zielNull: zielNull, zielFertig: zielFertig,
    rel: rel, spalte: spalte, zickzack: zickzack, funken: funken, RU: RU,
    schweben: schweben, botschaftAuf: botschaftAuf, botschaftAb: botschaftAb, druckwelle: druckwelle };
})();
