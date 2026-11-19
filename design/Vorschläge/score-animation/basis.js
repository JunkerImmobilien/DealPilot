/* score-animation · gemeinsamer Ablauf der Entwürfe (19.11.2026)
   Jede Seite ruft Demo.start(ablauf, endzustand):
     ablauf(T)      spielt die Animation; T bietet nach(ms, fn), tween(ms, fn(t), ease), zaehle(el, von, bis, ms)
     endzustand(T)  setzt sofort das Ende (bei prefers-reduced-motion und als Rückfall)
   „Wiederholen“ stellt die Szene aus dem gemerkten HTML wieder her und spielt neu. */
(function () {
  'use strict';
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uhren = [], laeufe = 0;
  var EASE = {
    raus: function (t) { return 1 - Math.pow(1 - t, 3); },
    rein: function (t) { return t * t * t; },
    weich: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    feder: function (t) { var c = 1.70158 * 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  };
  function T(lauf) {
    var lebt = function () { return lauf === laeufe; };
    return {
      ruhig: ruhig, ease: EASE,
      nach: function (ms, fn) { uhren.push(setTimeout(function () { if (lebt()) fn(); }, ms)); },
      tween: function (ms, fn, ease) {
        var e = EASE[ease] || ease || EASE.raus, t0 = null;
        return new Promise(function (fertig) {
          function schritt(t) {
            if (!lebt()) return;
            if (t0 == null) t0 = t;
            var x = Math.min(1, (t - t0) / ms);
            fn(e(x), x);
            if (x < 1) requestAnimationFrame(schritt); else fertig();
          }
          requestAnimationFrame(schritt);
        });
      },
      zaehle: function (el, von, bis, ms) {
        return this.tween(ms, function (t) { el.textContent = String(Math.round(von + (bis - von) * t)); });
      }
    };
  }
  window.Demo = {
    ring: function (svgKreis, score) { svgKreis.style.strokeDashoffset = String(333 * (1 - Math.max(0, Math.min(100, score)) / 100)); },
    start: function (ablauf, endzustand) {
      var szene = document.getElementById('szene'), satz = document.getElementById('satz');
      var html = szene.innerHTML;
      function los(sofort) {
        uhren.forEach(clearTimeout); uhren = [];
        var lauf = ++laeufe;
        szene.innerHTML = html;
        if (satz) satz.classList.remove('an');
        var t = T(lauf);
        if (sofort || ruhig) { endzustand(t); if (satz) satz.classList.add('an'); return; }
        void szene.offsetWidth;
        ablauf(t);
      }
      var w = document.getElementById('wieder'), e = document.getElementById('ende');
      if (w) w.addEventListener('click', function () { los(false); });
      if (e) e.addEventListener('click', function () { los(true); });
      if (ruhig) { var h = document.getElementById('hinweis'); if (h) h.textContent = 'Bewegung reduziert (Systemeinstellung): es steht nur das Endbild.'; }
      /* in der Übersicht startet die Seite neu, wenn sie gezeigt wird */
      window.addEventListener('message', function (m) { if (m.data === 'demo-neu') los(false); });
      los(false);
    }
  };
})();
