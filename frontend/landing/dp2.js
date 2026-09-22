/* ═══════════════════════════════════════════════════════════════════════
   dp2.js · v1540 · Bewegung der neuen DealPilot-Seite
   ───────────────────────────────────────────────────────────────────────
   Zwei Regeln, beide teuer gelernt:
   · Eine Animation darf NIE Bedingung dafuer sein, dass etwas sichtbar
     wird. Im Hintergrund-Tab feuert requestAnimationFrame nie, Timer
     werden auf ~1 s gedrosselt und CSS-Uebergaenge starten nicht. Jede
     Zahl steht deshalb fertig im HTML und wird nur ERSETZT, nie gesetzt.
   · Wer weniger Bewegung eingestellt hat, bekommt alles sofort und ohne.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Kopf wird fest beim Rollen ─────────────────────────────────── */
  var nav = document.querySelector('.nav');
  if (nav) {
    addEventListener('scroll', function () {
      nav.classList.toggle('fest', scrollY > 14);
    }, { passive: true });
  }

  /* ── Menue am Handy ─────────────────────────────────────────────── */
  var burger = document.querySelector('.burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var ul = document.querySelector('.nav ul');
      if (!ul) return;
      var auf = ul.style.display === 'flex';
      ul.style.display = auf ? '' : 'flex';
      ul.style.position = auf ? '' : 'absolute';
      ul.style.top = auf ? '' : '100%';
      ul.style.left = auf ? '' : '0';
      ul.style.right = auf ? '' : '0';
      ul.style.background = auf ? '' : '#fff';
      ul.style.flexDirection = auf ? '' : 'column';
      ul.style.alignItems = auf ? '' : 'stretch';
      ul.style.padding = auf ? '' : '10px 20px 18px';
      ul.style.borderBottom = auf ? '' : '1px solid rgba(20,18,15,.10)';
    });
  }

  /* ── Laufbaender verdoppeln, damit der Ruecksprung unsichtbar ist ─ */
  document.querySelectorAll('.tk-t, .pmarq-track').forEach(function (t) {
    if (!t.dataset.doppelt) { t.innerHTML += t.innerHTML; t.dataset.doppelt = '1'; }
  });

  /* ── Score-Balken aus einer Liste, damit Zahl und Balken nie
        auseinanderlaufen. Gewichte und KPI-Angaben sind die der
        laufenden Seite (frontend/landing/index.html Z.1500). ───────── */
  var CATS = [
    ['Rendite',            35, 98, '4/4', '#3FA56C'],
    ['Finanzierung',       25, 96, '5/5', '#3FA56C'],
    ['Risiko',             20, 88, '5/6', '#3FA56C'],
    ['Lage & Markt',       10, 60, '5/5', '#C9A84C'],
    ['Upside / Potenzial', 10, 53, '4/4', '#C9A84C'],
  ];
  var bars = document.getElementById('idsBars');
  if (bars) {
    bars.innerHTML = CATS.map(function (c) {
      return '<div class="ids-bar"><div class="top">'
        + '<span class="nm">' + c[0] + '<span class="wt">' + c[1] + '%</span></span>'
        + '<span class="sc" style="color:' + c[4] + '">' + c[2] + '<small>/100</small></span>'
        + '</div><span class="track"><i data-breit="' + c[2] + '" style="background:' + c[4] + '"></i></span>'
        + '<div class="kp">' + c[3] + ' KPIs</div></div>';
    }).join('');
  }

  /* ── QR im Stub (dekorativ, fester Startwert = immer dasselbe Bild) ─ */
  (function () {
    var host = document.getElementById('idsQr'); if (!host) return;
    var n = 11, cell = 3, svg = '<svg width="' + (n * cell) + '" height="' + (n * cell)
      + '" viewBox="0 0 ' + (n * cell) + ' ' + (n * cell) + '" aria-hidden="true">';
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
    host.innerHTML = svg + fp(0, 0) + fp((n - 7) * cell, 0) + '</svg>';
  })();

  /* ── Der Ring und die Balken fahren aus ─────────────────────────── */
  var UMFANG = 333;           /* 2 * PI * 53, siehe stroke-dasharray im CSS */
  function ringSetzen(sofort) {
    var pg = document.querySelector('.ids-dial .pg');
    if (pg) {
      var ziel = parseInt(pg.dataset.score || '87', 10);
      if (sofort) pg.style.transition = 'none';
      pg.style.strokeDashoffset = (UMFANG * (1 - ziel / 100)).toFixed(1);
    }
    document.querySelectorAll('[data-breit]').forEach(function (i) {
      if (sofort) i.style.transition = 'none';
      i.style.width = i.dataset.breit + '%';
    });
  }

  function alleZeigen() {
    document.querySelectorAll('.rv:not(.in)').forEach(function (e) { e.classList.add('in'); });
  }

  if (ruhig) { alleZeigen(); ringSetzen(true); }
  else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.rv').forEach(function (e) { io.observe(e); });
    setTimeout(function () { ringSetzen(false); }, 700);
    /* Sicherheitsnetz: nach zwei Sekunden steht alles, komme was wolle. */
    setTimeout(function () { alleZeigen(); ringSetzen(true); }, 2100);
  }

  /* ── Zaehler: die Zahl steht fertig im HTML und wird nur ersetzt ─── */
  function hoch(el, ziel) {
    if (ruhig || document.visibilityState !== 'visible') return;
    var start = null;
    requestAnimationFrame(function lauf(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / 1100), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(ziel * e).toLocaleString('de-DE');
      if (p < 1) requestAnimationFrame(lauf);
      else el.textContent = ziel.toLocaleString('de-DE');
    });
  }
  var zio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var z = parseInt(String(e.target.textContent).replace(/\D/g, ''), 10);
      if (isFinite(z)) hoch(e.target, z);
      zio.unobserve(e.target);
    });
  }, { threshold: 0.35 });
  document.querySelectorAll('[data-zaehl]').forEach(function (e) { zio.observe(e); });

  /* ── Nutzerzahl vom eigenen Host ─────────────────────────────────── */
  fetch('/api/v1/public/stats')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.registrierte_nutzer) return;
      document.querySelectorAll('[data-nutzer]').forEach(function (e) {
        e.textContent = d.registrierte_nutzer.toLocaleString('de-DE');
      });
    })
    .catch(function () {});
})();
