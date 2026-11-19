/* landing-neu-2 · gemeinsame Bausteine fuer idee-01 bis idee-05 (Vorschlag, nicht eingebaut).
   Keine Bibliothek. Alles, was sich bewegt, laeuft ueber transform/opacity oder SVG-Strichlaenge.
   prefers-reduced-motion: jede Animation springt sofort ins Endbild, Videos spielen nicht von selbst. */
(function () {
  var D = window.A_DATEN;
  var A = window.A = {};
  A.rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  A.feinZeiger = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var NF = new Intl.NumberFormat('de-DE');
  A.fmt = function (n, dez) { return dez ? n.toLocaleString('de-DE', { minimumFractionDigits: dez, maximumFractionDigits: dez }) : NF.format(Math.round(n)); };
  A.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  A.dauer = function (s) { if (!s) return ''; var m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? h + ':' + String(m % 60).padStart(2, '0') + ' h' : m + ':' + String(s % 60).padStart(2, '0'); };
  A.ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  A.easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* Zahl hochzaehlen, rAF, endet exakt auf dem Zielwert */
  A.zaehl = function (el, ziel, ms, dez) {
    if (!el) return;
    if (A.rm || !ms) { el.textContent = A.fmt(ziel, dez); return; }
    var t0 = performance.now();
    (function f(t) { var p = Math.min(1, (t - t0) / ms); el.textContent = A.fmt(ziel * A.ease(p), dez); if (p < 1) requestAnimationFrame(f); })(t0);
  };

  /* einmal sichtbar -> cb */
  A.einmal = function (el, cb, schwelle) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } }); }, { threshold: schwelle == null ? .25 : schwelle });
    io.observe(el);
  };
  A.reveal = function (root) {
    (root || document).querySelectorAll('[data-rv]').forEach(function (el) {
      if (A.rm) { el.classList.add('in'); return; }
      A.einmal(el, function () { setTimeout(function () { el.classList.add('in'); }, +(el.dataset.rv || 0)); }, .15);
    });
    (root || document).querySelectorAll('[data-zaehl]').forEach(function (el) {
      A.einmal(el, function () { A.zaehl(el, +el.dataset.zaehl, 1600); }, .4);
    });
  };

  /* Videos: laden und spielen erst im Bild, pausieren ausserhalb. Nie bei reduzierter Bewegung. */
  A.videos = function (root) {
    var vs = (root || document).querySelectorAll('video[data-src]');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (A.rm) return;
          if (!v.src) { v.src = v.dataset.src; }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (!v.paused) v.pause();
      });
    }, { threshold: .05 });
    vs.forEach(function (v) { v.muted = true; v.playsInline = true; io.observe(v); });
  };

  /* Navigation + Fortschrittsleiste */
  A.nav = function () {
    var nav = document.querySelector('.a-nav'), fort = document.querySelector('.a-fort');
    var tick = false;
    function f() {
      tick = false;
      var y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
      if (nav) nav.classList.toggle('zu', y > 40);
      if (fort) fort.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
    }
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(f); } }, { passive: true });
    f();
  };

  /* Hover-Neigung mit Glanzpunkt (nur feiner Zeiger, nie bei reduzierter Bewegung) */
  A.tilt = function (el, max) {
    if (!el || A.rm || !A.feinZeiger) return;
    max = max || 9;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', ((x - .5) * max * 2).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (-(y - .5) * max * 1.6).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  };

  /* ═══ Investor-Deal-Score-Karte ═══ */
  function farbe(v) { return v >= 70 ? '#3FA56C' : v >= 50 ? '#C9A84C' : '#B8625C'; }
  function bar(name, wert, anteil, kpi) {
    return '<div class="sk-bar" data-v="' + wert + '"><div class="z"><span>' + A.esc(name) + '<small>' + anteil + '</small></span><b><span class="n">0</span> / 100</b></div>' +
      '<span class="sp"><i style="background:' + farbe(wert) + '"></i></span></div>';
  }
  function mini(t) {
    return '<span class="sk-mini"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" stroke="#ece4d2"/><circle class="mp" cx="23" cy="23" r="19" stroke="' + farbe(t.wert) + '" stroke-dasharray="0 200"/></svg><b data-mini="' + t.wert + '">0</b></span>';
  }
  function code() { var s = '', w = [3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2]; w.forEach(function (x, i) { s += '<i style="width:' + x + 'px;opacity:' + (i % 2 ? .35 : 1) + '"></i>'; }); return s; }

  A.scoreKarteHTML = function () {
    var S = D.score, I = S.investment, F = S.finanzierung;
    var teil = function (t, name) {
      return '<div class="sk-teil"><h4>' + mini(t) + '<span>' + name + '<span class="sk-anteil">' + t.stufe + ' · zählt ' + t.anteil + ' %</span></span></h4>' +
        t.gruppen.map(function (g) { return bar(g[0], g[1], g[2] + ' %', g[3]); }).join('') + '</div>';
    };
    return '<div class="sk vor" role="img" aria-label="Investor Deal Score 87 von 100, Sehr gut. Investment 81, Finanzierung 96.">' +
      '<div class="sk-glanz"></div><div class="sk-wisch"></div>' +
      '<div class="sk-band"><span><i class="dot"></i>Pre-Flight · Investor Deal Score</span><span class="sk-cleared">Cleared</span></div>' +
      '<div class="sk-kopf"><div class="sk-dial"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="tr" cx="80" cy="80" r="68"/><circle class="s1" cx="80" cy="80" r="68" stroke-dasharray="0 999"/><circle class="s2" cx="80" cy="80" r="68" stroke-dasharray="0 999"/><circle class="kopfpunkt" cx="148" cy="80" r="6" opacity="0"/></svg>' +
      '<div class="sk-zahl"><b class="sk-gesamt">0</b><small>/ 100</small></div></div>' +
      '<div><div class="sk-titel">Investor <b>Deal Score</b></div><span class="sk-stempel">' + S.stufe.toUpperCase() + '</span>' +
      '<div class="sk-formel"><i style="background:#b8932f"></i>Investment ' + I.wert + ' × ' + I.anteil + ' %<br><i style="background:#E8CC7A"></i>Finanzierung ' + F.wert + ' × ' + F.anteil + ' %</div></div></div>' +
      '<div class="sk-stats"><div><b>' + S.kaufpreis + '</b><span>Kaufpreis</span></div><div><b>' + S.kpis + '</b><span>KPIs</span></div><div><b>' + S.tiefe + '</b><span>Tiefe</span></div></div>' +
      '<div class="sk-umschalter" role="tablist"><button class="an" data-ansicht="zwei" role="tab" aria-selected="true">Investment · Finanzierung</button><button data-ansicht="fuenf" role="tab" aria-selected="false">Fünf Bereiche</button></div>' +
      '<div class="sk-teile">' + teil(I, 'Investment') + teil(F, 'Finanzierung') + '</div>' +
      '<div class="sk-bereiche">' + S.bereiche.map(function (b) { return bar(b[0], b[2], b[1] + ' %', b[3]); }).join('') + '</div>' +
      '<div class="sk-tear"><i></i></div>' +
      '<div class="sk-fuss"><div>Passenger<b>DealPilot Co-Pilot</b></div><div>Flight<b>DP · Boarding</b></div><div class="sk-code">' + code() + '</div></div>' +
      '</div>';
  };

  /* Balken einer Ansicht laufen lassen */
  function balken(root, verz) {
    root.querySelectorAll('.sk-bar').forEach(function (b, i) {
      var v = +b.dataset.v, i_ = b.querySelector('.sp i'), n = b.querySelector('.n');
      if (A.rm) { i_.style.transform = 'scaleX(' + v / 100 + ')'; n.textContent = v; return; }
      i_.style.transition = 'none'; i_.style.transform = 'scaleX(0)'; n.textContent = '0';
      void i_.offsetWidth;
      setTimeout(function () { i_.style.transition = ''; i_.style.transform = 'scaleX(' + v / 100 + ')'; A.zaehl(n, v, 1100); }, (verz || 0) + i * 110);
    });
  }

  /* Ring zeichnen: Anteil Investment und Finanzierung nacheinander */
  function ring(karte, p1, p2) {
    var C = 2 * Math.PI * 68, s1 = karte.querySelector('.s1'), s2 = karte.querySelector('.s2'), kp = karte.querySelector('.kopfpunkt');
    s1.setAttribute('stroke-dasharray', (C * p1).toFixed(2) + ' ' + C.toFixed(2));
    s2.setAttribute('stroke-dasharray', (C * p2).toFixed(2) + ' ' + C.toFixed(2));
    s2.setAttribute('stroke-dashoffset', (-C * p1).toFixed(2));
    var w = (p1 + p2) * 2 * Math.PI;
    kp.setAttribute('cx', (80 + 68 * Math.cos(w)).toFixed(2)); kp.setAttribute('cy', (80 + 68 * Math.sin(w)).toFixed(2));
    kp.setAttribute('opacity', p1 + p2 > .01 ? 1 : 0);
  }

  A.scoreKarte = function (host, opt) {
    opt = opt || {};
    host.innerHTML = A.scoreKarteHTML();
    var k = host.querySelector('.sk'), S = D.score;
    var a1 = S.investment.roh * S.investment.gewicht / 1e4, a2 = S.finanzierung.roh * S.finanzierung.gewicht / 1e4; /* 0,4794 + 0,3926 = 0,872 */
    var gesamt = k.querySelector('.sk-gesamt');
    k.querySelectorAll('.sk-umschalter button').forEach(function (b) {
      b.addEventListener('click', function () {
        k.querySelectorAll('.sk-umschalter button').forEach(function (x) { x.classList.toggle('an', x === b); x.setAttribute('aria-selected', x === b); });
        k.classList.toggle('fuenf', b.dataset.ansicht === 'fuenf');
        balken(b.dataset.ansicht === 'fuenf' ? k.querySelector('.sk-bereiche') : k.querySelector('.sk-teile'), 0);
      });
    });
    function minis(ms) {
      k.querySelectorAll('.sk-mini').forEach(function (m) {
        var c = m.querySelector('.mp'), b = m.querySelector('b'), v = +b.dataset.mini, U = 2 * Math.PI * 19;
        if (A.rm || !ms) { c.setAttribute('stroke-dasharray', (U * v / 100) + ' 200'); b.textContent = v; return; }
        var t0 = performance.now();
        (function f(t) { var p = A.ease(Math.min(1, (t - t0) / ms)); c.setAttribute('stroke-dasharray', (U * v / 100 * p).toFixed(2) + ' 200'); b.textContent = Math.round(v * p); if (p < 1) requestAnimationFrame(f); })(t0);
      });
    }
    var gespielt = false;
    function spiel() {
      if (gespielt) return; gespielt = true;
      if (A.rm) {
        k.classList.remove('vor'); ring(k, a1, a2); gesamt.textContent = S.gesamt; minis(0); balken(k.querySelector('.sk-teile')); k.classList.add('fertig'); return;
      }
      k.classList.remove('vor'); k.classList.add('auf');
      setTimeout(function () { k.classList.remove('auf'); }, 1300);
      balken(k.querySelector('.sk-teile'), 350);
      setTimeout(function () { minis(1200); }, 450);
      var t0 = performance.now() + 1400, d1 = 750, d2 = 650;
      (function f(t) {
        var e = t - t0;
        if (e < 0) { requestAnimationFrame(f); return; }
        var p1 = A.easeIO(Math.min(1, e / d1)), p2 = A.easeIO(Math.max(0, Math.min(1, (e - d1) / d2)));
        ring(k, a1 * p1, a2 * p2);
        gesamt.textContent = Math.round((a1 * p1 + a2 * p2) * 100);
        if (e < d1 + d2) requestAnimationFrame(f);
        else { gesamt.textContent = S.gesamt; k.classList.add('fertig', 'glanz'); if (opt.fertig) opt.fertig(k); }
      })(performance.now());
    }
    A.tilt(k, opt.tilt || 7);
    if (opt.auto !== false) A.einmal(host, function () { setTimeout(spiel, opt.verz || 0); }, .3);
    return { karte: k, spiel: spiel };
  };

  /* ═══ Videospieler ═══ */
  var sp;
  A.spiele = function (id) {
    var v = D.videos.filter(function (x) { return x.id === id; })[0]; if (!v) return;
    if (!sp) {
      sp = document.createElement('div'); sp.className = 'a-spieler'; sp.setAttribute('role', 'dialog'); sp.setAttribute('aria-modal', 'true');
      sp.innerHTML = '<div class="a-spieler-box"><div class="a-spieler-kopf"><div><div class="a-eye"></div><div class="t" style="font-size:22px;font-weight:600"></div></div><button aria-label="Schließen">×</button></div><video controls playsinline preload="metadata"></video></div>';
      document.body.appendChild(sp);
      var zu = function () { sp.classList.remove('offen'); var vv = sp.querySelector('video'); vv.pause(); vv.removeAttribute('src'); vv.load(); };
      sp.addEventListener('click', function (e) { if (e.target === sp || e.target.closest('button')) zu(); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape' && sp.classList.contains('offen')) zu(); });
    }
    sp.querySelector('.a-eye').textContent = (v.nr === 'Spot' ? 'Spot' : 'Video ' + v.nr) + ' · ' + A.dauer(v.dauer);
    sp.querySelector('.t').textContent = v.titel;
    var vid = sp.querySelector('video'); vid.poster = D.poster + v.poster; vid.src = D.medien + v.datei;
    sp.classList.add('offen'); sp.querySelector('button').focus();
    var p = vid.play(); if (p && p.catch) p.catch(function () {});
  };
  document.addEventListener('click', function (e) { var t = e.target.closest('[data-video]'); if (t) { e.preventDefault(); A.spiele(t.dataset.video); } });

  /* ═══ Gemeinsame Abschnitte ═══ */
  A.daten = function (el) {
    el.innerHTML = '<div class="a-zahlen">' + D.zahlen.map(function (z, i) { return '<div data-rv="' + i * 80 + '"><b data-zaehl="' + z[0] + '">0</b><span>' + z[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="a-quellen">' + D.quellen.map(function (q, i) { return '<div class="a-quelle" data-rv="' + i * 70 + '"><h4>' + q[0] + '</h4><p>' + q[1] + '</p><small><span>' + q[2] + '</span><span>' + q[3] + '</span></small></div>'; }).join('') + '</div>';
  };
  A.preise = function (el) {
    el.innerHTML = '<div class="a-ctr"><div class="a-seg" role="tablist"><button class="an" data-z="m">Monatlich</button><button data-z="j">Jährlich<small>−17 %</small></button></div></div>' +
      '<div class="a-tks">' + D.preise.map(function (p, i) {
        return '<article class="a-tk' + (p.top ? ' top' : '') + '" data-rv="' + i * 90 + '"><div class="a-tk-kopf">' + (p.top ? '<span class="a-tk-top">★ ' + p.top + '</span>' : '') +
          '<small>' + p.tag + '</small><h3>' + p.name + '</h3><em>' + p.klasse + '</em></div><div class="a-tk-perf"></div>' +
          '<div class="a-tk-leib"><div class="a-tk-preis"><b data-m="' + p.m + '" data-j="' + (p.j || p.m) + '">' + p.m + '</b><span>€ <span class="per">/ Monat</span></span></div>' +
          '<div class="a-tk-notiz" data-m="' + (p.notiz || (p.j ? 'oder ' + p.j + ' €/Jahr' : '')) + '" data-j="' + (p.j ? 'statt ' + (Math.round(parseFloat(p.m.replace(',', '.')) * 12 * 100) / 100).toLocaleString('de-DE') + ' € monatlich' : (p.notiz || '')) + '">' + (p.notiz || (p.j ? 'oder ' + p.j + ' €/Jahr' : '')) + '</div>' +
          '<div class="a-tk-kont">◗ ' + p.kontingent + '</div><ul>' + p.punkte.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
          '<a class="a-btn' + (p.top ? '' : ' dunkel') + '" href="' + D.app + '">' + p.knopf + '</a><div class="a-tk-pass">✈ BOARDING PASS ' + p.pass + '</div></div></article>';
      }).join('') + '</div><ul class="a-haken" style="justify-content:center"><li>Keine Zahlungsdaten</li><li>4 Wochen voller Pro-Umfang</li><li>Danach automatisch Free, ohne Kündigung</li></ul>';
    el.querySelectorAll('.a-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        el.querySelectorAll('.a-seg button').forEach(function (x) { x.classList.toggle('an', x === b); });
        var z = b.dataset.z;
        el.querySelectorAll('.a-tk-preis b').forEach(function (p) { p.textContent = p.dataset[z]; });
        el.querySelectorAll('.a-tk-notiz').forEach(function (p) { p.textContent = p.dataset[z]; });
        el.querySelectorAll('.a-tk-preis .per').forEach(function (p) { p.textContent = z === 'j' ? '/ Jahr' : '/ Monat'; });
      });
    });
  };
  A.fragen = function (el) {
    el.innerHTML = '<div class="a-fragen">' + D.fragen.map(function (f, i) { return '<details' + (i ? '' : ' open') + ' data-rv="' + i * 60 + '"><summary>' + f[0] + '<i aria-hidden="true"></i></summary><p>' + f[1] + '</p></details>'; }).join('') + '</div>';
  };
  A.fuss = function (el) {
    el.innerHTML = '<div class="a-wrap"><div><span class="a-logo">Deal<b>Pilot</b></span><br>DealPilot ist eine Marke von Junker Solution.<br>Keine Steuer- oder Finanzberatung. Analyse-Werkzeug für eigene Kalkulationen.</div>' +
      '<div><a href="' + D.L + 'leistungsumfang.html">Leistungsumfang</a><a href="' + D.L + 'videothek.html">Videothek</a><a href="' + D.L + 'methodik.html">Methodik</a><a href="' + D.L + 'sicherheit.html">Sicherheit</a><br><br>© 2026 Junker Solution · DealPilot</div></div>';
  };
  A.navHTML = function () {
    return '<div class="a-fort"></div><nav class="a-nav"><div class="a-wrap"><a class="a-logo" href="#">Deal<b>Pilot</b></a><ul><li><a href="#etappen">So fliegt ein Deal</a></li><li><a href="#score">Deal Score</a></li><li><a href="#videothek">Videothek</a></li><li><a href="#preise">Preise</a></li><li><a href="#fragen">Fragen</a></li></ul><a class="a-btn" href="' + D.app + '">Kostenlos starten</a></div></nav>';
  };

  A.start = function () {
    var n = document.getElementById('a-nav'); if (n) n.outerHTML = A.navHTML();
    var x;
    if ((x = document.getElementById('a-daten'))) A.daten(x);
    if ((x = document.getElementById('a-preise'))) A.preise(x);
    if ((x = document.getElementById('a-fragen'))) A.fragen(x);
    if ((x = document.getElementById('a-fuss'))) A.fuss(x);
    A.nav(); A.reveal(); A.videos();
  };
})();
