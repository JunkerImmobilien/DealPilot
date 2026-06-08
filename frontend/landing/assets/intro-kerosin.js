/* ============================================================
   DealPilot Landing — Kerosin-Intro v499
   Ablauf: Anzeigen (Tier-Farben, erster Ausschlag startet Runway)
           -> Runway-POV (V1/ROTATE, Abheben, Wolken, Sterne)
           -> Kreuz-Flyby (2 Jets, Flash + Shockwave)
           -> Logo-PNG skaliert aus dem Blitz
           -> Odometer rollt auf 100 L
   Nutzt vorhandenes Overlay #dp-intro-overlay (+ .dp-intro-skip,
   .dp-intro-done-Fadeout, reduced-motion display:none aus index.html).
   Laeuft 1x pro Session (sessionStorage dp_intro_shown).
   ============================================================ */
(function() {
  'use strict';

  var overlay = document.getElementById('dp-intro-overlay');
  if (!overlay) return;

  /* ── Guards: Session + reduced motion ── */
  try {
    if (sessionStorage.getItem('dp_intro_shown') === '1') {
      overlay.style.display = 'none';
      return;
    }
  } catch (e) {}
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.style.display = 'none';
    return;
  }

  /* ── CSS injizieren (dpk-Praefix, kollidiert nicht mit Alt-CSS) ── */
  var CSS = '' +
'#dp-intro-overlay.dpk-rumble{animation:dpk-rumble .4s linear}' +
'#dp-intro-overlay.dpk-rumble2{animation:dpk-rumble .65s linear}' +
'@keyframes dpk-rumble{0%,100%{transform:translate(0,0)}20%{transform:translate(-5px,3px)}40%{transform:translate(4px,-4px)}60%{transform:translate(-4px,-3px)}80%{transform:translate(5px,3px)}}' +
'.dpk-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}' +
'.dpk-pod{perspective:900px;display:flex;gap:42px;align-items:flex-end;z-index:8;transition:opacity .5s ease,filter .5s ease}' +
'.dpk-gauge{display:inline-block;position:relative;width:200px;transform:rotateX(18deg);animation:dpk-float 3.4s ease-in-out infinite}' +
'.dpk-gauge::after{content:"";position:absolute;left:10%;right:10%;bottom:-22px;height:16px;border-radius:50%;background:radial-gradient(ellipse,rgba(201,168,76,.35),transparent 70%);filter:blur(4px)}' +
'@keyframes dpk-float{0%,100%{transform:translateY(0) rotateX(18deg)}50%{transform:translateY(-8px) rotateX(18deg)}}' +
'.dpk-g-track{stroke:rgba(255,255,255,.10)}' +
'.dpk-g-needle{stroke:#F4ECD8;stroke-width:2.6;stroke-linecap:round;filter:drop-shadow(0 0 4px rgba(244,236,216,.6))}' +
'.dpk-g-hub{fill:#F4ECD8}' +
'.dpk-g-ef{font-family:"JetBrains Mono",monospace;font-size:10px;fill:rgba(255,255,255,.4)}' +
'.dpk-g-val{font-family:"JetBrains Mono",monospace;font-weight:700;fill:#E8CC7A;text-anchor:middle}' +
'.dpk-g-title{margin-top:12px;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:3px;color:rgba(255,255,255,.5);text-transform:uppercase;text-align:center}' +
'.dpk-g-check{position:absolute;top:2px;right:-6px;width:26px;height:26px;border-radius:50%;background:#3FA56C;display:flex;align-items:center;justify-content:center;font-size:15px;color:#fff;opacity:0;transform:scale(2);box-shadow:0 0 18px rgba(63,165,108,.7)}' +
'.dpk-g-sheen{mix-blend-mode:screen;pointer-events:none}' +
'.dpk-gauge.dpk-lit .dpk-g-fill{animation:dpk-glowpulse 2.1s ease-in-out infinite}' +
'.dpk-gauge.dpk-lit .dpk-g-sheen{animation:dpk-sheenrun 1.9s linear infinite}' +
'@keyframes dpk-glowpulse{0%,100%{filter:drop-shadow(0 0 4px var(--dpk-glow,#C9A84C))}50%{filter:drop-shadow(0 0 12px var(--dpk-glow,#C9A84C)) drop-shadow(0 0 22px var(--dpk-glow,#C9A84C))}}' +
'@keyframes dpk-sheenrun{0%{stroke-dashoffset:239;opacity:0}18%{opacity:.65}82%{opacity:.65}100%{stroke-dashoffset:-20;opacity:0}}' +
'.dpk-rw{position:absolute;inset:0;perspective:520px;overflow:hidden;pointer-events:none}' +
'.dpk-rw-ground{position:absolute;left:50%;bottom:-12%;width:200vw;height:120vh;transform:translateX(-50%) rotateX(76deg);transform-origin:bottom center}' +
'.dpk-rw-line{position:absolute;left:50%;width:14px;margin-left:-7px;height:90px;background:#E8CC7A;border-radius:6px;opacity:.85;box-shadow:0 0 14px rgba(201,168,76,.5)}' +
'.dpk-rw-edge{position:absolute;width:10px;height:10px;border-radius:50%;background:#C9A84C;box-shadow:0 0 12px #C9A84C}' +
'.dpk-rw-horizon{position:absolute;left:0;right:0;top:36%;height:160px;background:radial-gradient(ellipse at 50% 100%,rgba(201,168,76,.28),transparent 70%);filter:blur(6px)}' +
'.dpk-hud-spd{position:absolute;bottom:16%;left:50%;transform:translateX(-50%);font-family:"JetBrains Mono",monospace;font-size:15px;letter-spacing:3px;color:#E8CC7A;text-shadow:0 0 12px rgba(201,168,76,.6);z-index:8}' +
'.dpk-cloud{position:absolute;width:340px;height:110px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.16),transparent 70%);filter:blur(14px);pointer-events:none}' +
'.dpk-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:0;pointer-events:none}' +
'.dpk-jet{position:absolute;width:150px;pointer-events:none;filter:drop-shadow(0 0 16px rgba(201,168,76,.55));z-index:6}' +
'.dpk-jet svg{display:block;width:100%}' +
'.dpk-contrail{position:absolute;height:3px;border-radius:2px;transform-origin:left center;pointer-events:none;z-index:5;background:linear-gradient(90deg,rgba(232,204,122,0),rgba(232,204,122,.85));filter:blur(.5px)}' +
'.dpk-shockwave{position:absolute;top:50%;left:50%;width:100px;height:100px;border:4px solid #C9A84C;border-radius:50%;transform:translate(-50%,-50%) scale(0);box-shadow:0 0 40px #C9A84C,inset 0 0 30px #C9A84C;opacity:0;pointer-events:none}' +
'.dpk-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#fff 0%,#E8CC7A 30%,transparent 70%);opacity:0;pointer-events:none}' +
'.dpk-spark{position:absolute;width:5px;height:5px;border-radius:50%;background:#E8CC7A;box-shadow:0 0 8px #E8CC7A;pointer-events:none}' +
'.dpk-logo{display:inline-block;position:relative;padding:30px;border:1.5px solid rgba(201,168,76,.22);border-radius:18px;background:linear-gradient(135deg,#0d0a04 0%,#1a1408 100%);box-shadow:0 0 80px rgba(201,168,76,.25)}' +
'.dpk-logo img{height:180px;width:auto;max-width:90vw;display:block}' +
'.dpk-pumpmini{display:inline-flex;align-items:center;gap:14px;margin-top:24px;border:1px solid rgba(201,168,76,.4);border-radius:14px;padding:12px 18px;background:rgba(10,8,4,.95);opacity:0;transform:translateY(12px) scale(.85);box-shadow:0 0 30px rgba(201,168,76,.22)}' +
'.dpk-pumpmini .dpk-nz{width:26px;height:26px;color:#E8CC7A}' +
'.dpk-odo{display:flex;gap:4px;background:#060503;border:1px solid rgba(201,168,76,.25);border-radius:8px;padding:7px 9px;box-shadow:inset 0 3px 12px rgba(0,0,0,.85)}' +
'.dpk-odo-col{width:26px;height:40px;overflow:hidden;border-radius:5px;background:linear-gradient(180deg,#0e0b06,#171208 50%,#0e0b06);position:relative}' +
'.dpk-odo-col::after{content:"";position:absolute;inset:0;box-shadow:inset 0 6px 7px rgba(0,0,0,.8),inset 0 -6px 7px rgba(0,0,0,.8);pointer-events:none}' +
'.dpk-odo-strip{position:absolute;left:0;right:0;top:0}' +
'.dpk-odo-strip span{display:flex;align-items:center;justify-content:center;height:40px;font-family:"JetBrains Mono",monospace;font-size:24px;font-weight:700;color:#E8CC7A;text-shadow:0 0 12px rgba(201,168,76,.6)}' +
'.dpk-odo-unit{font-family:"Space Grotesk",sans-serif;font-size:19px;color:#C9A84C;font-weight:700}' +
'@media (max-width:680px){' +
  '.dpk-pod{gap:14px}' +
  '.dpk-gauge{width:104px}' +
  '.dpk-g-title{font-size:8px;letter-spacing:2px;margin-top:8px}' +
  '.dpk-g-check{width:20px;height:20px;font-size:12px}' +
  '.dpk-logo{padding:18px}' +
  '.dpk-logo img{height:110px}' +
  '.dpk-jet{width:96px}' +
  '.dpk-rw-line{width:10px;height:64px}' +
  '.dpk-rw-edge{left:50%}' +
'}';
  var styleEl = document.createElement('style');
  styleEl.id = 'dpk-intro-css';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ── Stage-Inhalt ── */
  var content = document.createElement('div');
  content.style.cssText = 'position:absolute;inset:0';
  overlay.insertBefore(content, overlay.firstChild);

  /* ── Lifecycle / Skip ── */
  var timers = [], rafs = [], doneFlag = false;
  function T(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function R(fn) { rafs.push(requestAnimationFrame(fn)); }
  function clearAll() {
    timers.forEach(clearTimeout); timers = [];
    rafs.forEach(cancelAnimationFrame); rafs = [];
  }
  function ended() {
    if (doneFlag) return;
    doneFlag = true;
    clearAll();
    overlay.classList.add('dp-intro-done');
    try { sessionStorage.setItem('dp_intro_shown', '1'); } catch (e) {}
    setTimeout(function() { overlay.style.display = 'none'; }, 1100);
  }
  window.dpIntroSkip = ended;
  overlay.addEventListener('click', function(e) {
    if (e.target.classList.contains('dp-intro-skip')) return;
    ended();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') ended();
  });

  function rumble(big) {
    var c = big ? 'dpk-rumble2' : 'dpk-rumble';
    overlay.classList.add(c);
    T(function() { overlay.classList.remove(c); }, big ? 660 : 420);
  }

  /* ── SVG-Bausteine ── */
  var JET = '<svg viewBox="0 0 150 52" fill="none">' +
    '<defs><linearGradient id="dpkjetg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9A84C"/><stop offset="1" stop-color="#E8CC7A"/></linearGradient></defs>' +
    '<path fill="url(#dpkjetg)" d="M8 30 C 26 22, 60 18, 96 18 L 118 18 C 132 18, 142 22, 146 27 C 142 31, 132 34, 118 34 L 30 34 C 18 34, 10 32, 8 30 Z"/>' +
    '<path fill="url(#dpkjetg)" opacity=".92" d="M58 33 L 38 48 L 56 48 L 78 33 Z"/>' +
    '<path fill="url(#dpkjetg)" opacity=".92" d="M18 31 L 4 14 L 16 14 L 34 28 Z"/>' +
    '<path fill="#0a0803" opacity=".85" d="M118 21 C 126 21, 132 23, 136 26 C 132 29, 126 31, 118 31 Z"/>' +
    '<ellipse cx="44" cy="34" rx="9" ry="4.5" fill="#0a0803" stroke="#E8CC7A" stroke-width="1.4"/></svg>';
  var NOZZLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/>' +
    '<path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/>' +
    '<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>';

  /* ── Gauges (Tier-Farben wie score-tiers.js: <50 rot, <70 gold, >=70 gruen) ── */
  function tierColor(p) { return p < .5 ? '#B86250' : (p < .7 ? '#C9A84C' : '#3FA56C'); }
  function tierGlow(p)  { return p < .5 ? '#D9685F' : (p < .7 ? '#E8CC7A' : '#5ED894'); }
  function gaugeHTML(id, label) {
    return '<div class="dpk-gauge" id="' + id + '">' +
      '<svg viewBox="0 0 184 110" style="overflow:visible;display:block;width:100%">' +
      '<defs><linearGradient id="dpkgg' + id + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9A84C"/><stop offset="1" stop-color="#E8CC7A"/></linearGradient></defs>' +
      '<path class="dpk-g-track" d="M 16 92 A 76 76 0 0 1 168 92" fill="none" stroke-width="9" stroke-linecap="round"/>' +
      '<path class="dpk-g-fill" id="' + id + '-fill" d="M 16 92 A 76 76 0 0 1 168 92" fill="none" stroke="url(#dpkgg' + id + ')" stroke-width="9" stroke-linecap="round" stroke-dasharray="239" stroke-dashoffset="239"/>' +
      '<path class="dpk-g-sheen" id="' + id + '-sheen" d="M 16 92 A 76 76 0 0 1 168 92" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" stroke-dasharray="16 223" stroke-dashoffset="239" opacity="0"/>' +
      '<text class="dpk-g-ef" x="10" y="106">E</text><text class="dpk-g-ef" x="166" y="106">F</text>' +
      '<line class="dpk-g-needle" id="' + id + '-needle" x1="92" y1="92" x2="92" y2="30" transform="rotate(-78 92 92)"/>' +
      '<circle class="dpk-g-hub" cx="92" cy="92" r="5"/>' +
      '<text class="dpk-g-val" id="' + id + '-val" x="92" y="76" font-size="19">\u2014</text>' +
      '</svg><div class="dpk-g-check" id="' + id + '-check">\u2713</div><div class="dpk-g-title">' + label + '</div></div>';
  }
  function animGauge(id, targetPct, ms, fmt, done, colorMode) {
    colorMode = colorMode || 'tier';
    var box = document.getElementById(id), v = document.getElementById(id + '-val');
    var n = document.getElementById(id + '-needle'), f = document.getElementById(id + '-fill');
    if (!n) { if (done) done(); return; }
    var t0 = performance.now();
    function frame(t) {
      var p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3), pct = targetPct * e;
      n.setAttribute('transform', 'rotate(' + (-78 + 156 * pct) + ' 92 92)');
      f.setAttribute('stroke-dashoffset', String(239 * (1 - pct)));
      if (colorMode === 'tier') f.setAttribute('stroke', tierColor(pct));
      v.textContent = fmt(e);
      if (p < 1) R(frame);
      else {
        var endCol = colorMode === 'gold' ? ('url(#dpkgg' + id + ')') : tierColor(targetPct);
        var endGlow = colorMode === 'gold' ? '#E8CC7A' : tierGlow(targetPct);
        f.setAttribute('stroke', endCol);
        v.style.fill = endGlow;
        if (box) { box.style.setProperty('--dpk-glow', endGlow); box.classList.add('dpk-lit'); }
        var c = document.getElementById(id + '-check');
        if (c) c.animate([{opacity:0, transform:'scale(2.2)'},{opacity:1, transform:'scale(1)'}],
          {duration:280, easing:'cubic-bezier(.2,1.6,.4,1)', fill:'forwards'});
        if (done) done();
      }
    }
    R(frame);
  }
  var fmtLiter = function(e) { return Math.round(100 * e) + ' L'; };
  var fmtScore = function(e) { return String(Math.round(87 * e)); };
  var fmtMW = function(e) { return Math.round(318 * e) + ' T\u20ac'; };

  function sparks(x, y, n) {
    for (var i = 0; i < (n || 16); i++) {
      var s = document.createElement('div'); s.className = 'dpk-spark';
      s.style.left = x + 'px'; s.style.top = y + 'px';
      overlay.appendChild(s);
      var ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 200, dur = 600 + Math.random() * 500;
      s.animate([
        {transform:'translate(0,0) scale(1)', opacity:1},
        {transform:'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(.2)', opacity:0}
      ], {duration:dur, easing:'cubic-bezier(.2,.7,.3,1)'});
      (function(el, d) { T(function() { el.remove(); }, d); })(s, dur);
    }
  }

  /* ── Jet-Flug entlang einer Linie mit Kondensstreifen ── */
  function jetFly(opts) {
    var jet = document.createElement('div'); jet.className = 'dpk-jet';
    if (opts.scale && opts.scale !== 1) jet.style.width = (150 * opts.scale) + 'px';
    jet.innerHTML = JET;
    overlay.appendChild(jet);
    var W = window.innerWidth, H = window.innerHeight;
    var x0 = opts.mirror ? W + 200 : -250, x1 = opts.mirror ? -250 : W + 200;
    var y0 = H * opts.y0, y1 = H * opts.y1;
    var ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    var t0 = performance.now(), lastTrail = 0;
    var jw = 150 * (opts.scale || 1);
    function frame(t) {
      var p = Math.min(1, (t - t0) / opts.dur);
      var x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p;
      jet.style.left = x + 'px'; jet.style.top = y + 'px';
      jet.style.transform = (opts.mirror ? 'scaleX(-1) ' : '') + 'rotate(' + (opts.mirror ? -ang : ang) + 'deg)';
      if (t - lastTrail > 26) {
        lastTrail = t;
        var c = document.createElement('div'); c.className = 'dpk-contrail';
        c.style.width = (40 + Math.random() * 40) + 'px';
        c.style.left = (x + (opts.mirror ? jw * 0.8 : 0)) + 'px';
        c.style.top = (y + jw * 0.09) + 'px';
        c.style.transform = 'rotate(' + ang + 'deg)' + (opts.mirror ? ' scaleX(-1)' : '');
        overlay.appendChild(c);
        c.animate([{opacity:.85},{opacity:0}], {duration:900, easing:'ease-out'});
        (function(q) { T(function() { q.remove(); }, 920); })(c);
      }
      if (p < 1) R(frame);
      else jet.remove();
    }
    R(frame);
  }

  /* ── PHASE 1: Anzeigen — erster Ausschlag startet die Runway ── */
  function displaysPhase(onFirstSwing) {
    var c = document.createElement('div');
    c.className = 'dpk-center dpk-pod';
    c.innerHTML = gaugeHTML('dpkq1', 'KEROSIN') + gaugeHTML('dpkq2', 'DEAL SCORE') + gaugeHTML('dpkq3', 'MARKTWERT');
    content.appendChild(c);
    [0, 1, 2].forEach(function(i) {
      var g = c.children[i];
      g.style.opacity = '0';
      g.style.animationDelay = (i * .5) + 's';
      T(function() {
        g.animate([
          {opacity:0, transform:'rotateX(60deg) translateY(60px) scale(.8)'},
          {opacity:1, transform:'rotateX(18deg) translateY(0) scale(1)'}
        ], {duration:460, easing:'cubic-bezier(.2,1.3,.4,1)', fill:'forwards'});
        g.style.opacity = '1';
      }, 130 + i * 210);
    });
    T(function() {
      onFirstSwing();
      animGauge('dpkq1', 1.0, 620, fmtLiter, null, 'gold');
    }, 760);
    T(function() { animGauge('dpkq2', .87, 620, fmtScore, null, 'tier'); }, 1260);
    T(function() { animGauge('dpkq3', .72, 620, fmtMW, null, 'tier'); }, 1760);
    T(function() {
      c.style.opacity = '0'; c.style.filter = 'blur(9px)';
      T(function() { if (c.parentNode) c.remove(); }, 520);
    }, 2500);
  }

  /* ── PHASE 2: Runway-POV ── */
  function runwayPhase(done) {
    var rw = document.createElement('div'); rw.className = 'dpk-rw';
    rw.innerHTML = '<div class="dpk-rw-horizon"></div><div class="dpk-rw-ground"></div><div class="dpk-hud-spd">V \u00b7 000</div>';
    content.insertBefore(rw, content.firstChild);
    var g = rw.querySelector('.dpk-rw-ground'), spd = rw.querySelector('.dpk-hud-spd');
    for (var i = 0; i < 14; i++) {
      var l = document.createElement('div'); l.className = 'dpk-rw-line';
      l.style.top = (i * 180) + 'px'; l.dataset.base = i * 180;
      g.appendChild(l);
      [-260, 260].forEach(function(off) {
        var e = document.createElement('div'); e.className = 'dpk-rw-edge';
        e.style.left = 'calc(50% + ' + off + 'px)';
        e.style.top = (i * 180 + 60) + 'px'; e.dataset.base = i * 180 + 60;
        g.appendChild(e);
      });
    }
    var ACC = 3000, t0 = performance.now(), lifted = false;
    function frame(t) {
      var el = t - t0, v = Math.min(1, el / ACC), speedF = 1.2 + v * 16;
      Array.prototype.forEach.call(g.children, function(ch) {
        if (ch.dataset.base === undefined) return;
        ch.style.top = ((parseFloat(ch.dataset.base) + el * speedF * .22) % 2520) + 'px';
      });
      var kts = Math.round(v * 152);
      spd.textContent = kts < 132 ? ('V \u00b7 ' + String(kts).padStart(3, '0')) : (kts < 148 ? 'V1 \u00b7 ROTATE' : 'AIRBORNE');
      if (v >= 1 && !lifted) {
        lifted = true;
        rumble();
        g.animate([
          {transform:'translateX(-50%) rotateX(76deg)'},
          {transform:'translateX(-50%) rotateX(86deg) translateY(60vh)', opacity:0}
        ], {duration:1200, easing:'ease-in', fill:'forwards'});
        spd.animate([{opacity:1},{opacity:0}], {duration:650, fill:'forwards'});
        for (var k = 0; k < 7; k++) {
          (function(j) {
            T(function() {
              var cl = document.createElement('div'); cl.className = 'dpk-cloud';
              cl.style.left = (Math.random() * 80) + '%'; cl.style.top = '-160px';
              overlay.appendChild(cl);
              cl.animate([
                {transform:'translateY(0) scale(.8)', opacity:0},
                {opacity:.85, offset:.25},
                {transform:'translateY(130vh) scale(1.25)', opacity:0}
              ], {duration:900, easing:'cubic-bezier(.4,0,.9,.5)'});
              T(function() { cl.remove(); }, 950);
            }, j * 140);
          })(k);
        }
        T(function() {
          for (var m = 0; m < 22; m++) {
            var st = document.createElement('div'); st.className = 'dpk-star';
            st.style.left = Math.random() * 100 + '%'; st.style.top = Math.random() * 100 + '%';
            overlay.appendChild(st);
            st.animate([{opacity:0},{opacity:.25 + Math.random() * .5}], {duration:600 + Math.random() * 600, fill:'forwards'});
            (function(q) {
              T(function() {
                q.animate([{opacity:.4},{opacity:0}], {duration:800, fill:'forwards'});
                T(function() { q.remove(); }, 850);
              }, 4000);
            })(st);
          }
          rw.remove();
          done();
        }, 1250);
        return;
      }
      if (!lifted) R(frame);
    }
    R(frame);
  }

  /* ── PHASE 3: Kreuz-Flyby + Logo-Arrival ── */
  function crossFlybyDelivery(after) {
    var W = window.innerWidth, H = window.innerHeight;
    jetFly({y0:.18, y1:.78, scale:1.05, dur:1400});
    jetFly({y0:.78, y1:.18, scale:1.05, dur:1400, mirror:true});
    T(function() {
      var fl = document.createElement('div'); fl.className = 'dpk-flash';
      overlay.appendChild(fl);
      fl.animate([{opacity:0},{opacity:1, offset:.4},{opacity:0}], {duration:560, easing:'ease-out'});
      T(function() { fl.remove(); }, 600);
      var sw = document.createElement('div'); sw.className = 'dpk-shockwave';
      content.appendChild(sw);
      sw.animate([
        {transform:'translate(-50%,-50%) scale(0)', opacity:1, borderWidth:'6px'},
        {transform:'translate(-50%,-50%) scale(8)', opacity:0, borderWidth:'1px'}
      ], {duration:1900, easing:'ease-out'});
      rumble(true);
      sparks(W / 2, H / 2, 22);
      T(function() {
        var lw = document.createElement('div');
        lw.className = 'dpk-center';
        lw.style.zIndex = '9';
        lw.innerHTML = '<div class="dpk-logo"><img src="assets/dealpilot-logo.png" alt="DealPilot"></div>';
        content.appendChild(lw);
        lw.animate([
          {transform:'translate(-50%,-50%) scale(.3)', filter:'blur(12px)', opacity:0},
          {transform:'translate(-50%,-50%) scale(1)', filter:'blur(0)', opacity:1}
        ], {duration:520, easing:'cubic-bezier(.2,1.4,.4,1)', fill:'forwards'});
        T(function() { after(lw); }, 540);
      }, 280);
    }, 700);
  }

  /* ── FINALE: Odometer rollt auf 100 L ── */
  function odoFinale(lw) {
    var cols = '';
    for (var i = 0; i < 3; i++) {
      var strip = '';
      for (var d = 0; d <= 10; d++) strip += '<span>' + (d % 10) + '</span>';
      cols += '<div class="dpk-odo-col"><div class="dpk-odo-strip" id="dpkof-c' + i + '">' + strip + '</div></div>';
    }
    var pm = document.createElement('div'); pm.className = 'dpk-pumpmini';
    pm.innerHTML = '<span class="dpk-nz">' + NOZZLE + '</span><div class="dpk-odo">' + cols + '</div><span class="dpk-odo-unit">L</span>';
    lw.appendChild(pm);
    pm.animate([
      {opacity:0, transform:'translateY(12px) scale(.85)'},
      {opacity:1, transform:'translateY(0) scale(1)'}
    ], {duration:380, easing:'cubic-bezier(.2,1.6,.4,1)', fill:'forwards'});
    T(function() {
      var t0 = performance.now(), MS = 1450, TARGET = 100;
      function frame(t) {
        var p = Math.min(1, (t - t0) / MS), e = 1 - Math.pow(1 - p, 2.4), val = TARGET * e;
        var whole = Math.floor(val), str = String(whole).padStart(3, '0');
        for (var i = 0; i < 3; i++) {
          var col = document.getElementById('dpkof-c' + i);
          if (!col) continue;
          var digit = parseInt(str[i], 10);
          var frac = (i === 2) ? (val - whole) : 0;
          col.style.transform = 'translateY(' + (-(digit + frac) * 40) + 'px)';
        }
        if (p < 1) R(frame);
        else {
          sparks(window.innerWidth / 2, window.innerHeight / 2 + 100, 10);
          T(ended, 1000);
        }
      }
      R(frame);
    }, 420);
  }

  /* ── Ablauf starten ── */
  var runwayStarted = false;
  displaysPhase(function() {
    if (runwayStarted) return;
    runwayStarted = true;
    runwayPhase(function() {
      crossFlybyDelivery(function(lw) {
        odoFinale(lw);
      });
    });
  });
})();
