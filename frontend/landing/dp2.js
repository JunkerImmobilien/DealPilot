/* ═══════════════════════════════════════════════════════════════════════
   dp2.js · v1555 · Bewegung der DealPilot-Seite
   ───────────────────────────────────────────────────────────────────────
   Zwei Regeln, beide teuer gelernt:
   · Eine Animation darf NIE Bedingung dafuer sein, dass etwas sichtbar
     wird. Im Hintergrund-Tab feuert requestAnimationFrame nie, Timer
     werden auf ~1 s gedrosselt und CSS-Uebergaenge starten nicht. Jede
     Zahl steht deshalb fertig im HTML und wird nur ERSETZT, nie gesetzt.
   · Wer weniger Bewegung eingestellt hat, bekommt alles sofort und ohne.

   v1555 · Marcel am 23.09.2026: "Im Hero bewegt sich der Score nicht und
   die Zahlen." Gemessen, und es war ein Eigentor:

      700 ms  ringSetzen(false)  startet die CSS-Transition (1,6 s)
     2100 ms  ringSetzen(true)   setzt transition:none - MITTEN DRIN

   Das Sicherheitsnetz hat die Animation zerstoert, die es absichern
   sollte. Jetzt merkt sich jeder Teil, ob er gelaufen ist, und das Netz
   greift nur bei dem, der es NICHT ist. Dazu starten Ring und Zahlen
   spaeter und laufen laenger - eine Animation, die vorbei ist, bevor
   jemand hinsieht, ist keine.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sichtbar() { return document.visibilityState === 'visible'; }

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
  document.querySelectorAll('.laufband-t, .pmarq-track').forEach(function (t) {
    if (!t.dataset.doppelt) { t.innerHTML += t.innerHTML; t.dataset.doppelt = '1'; }
  });

  /* ── Score-Balken aus einer Liste, damit Zahl und Balken nie
        auseinanderlaufen. Gewichte und KPI-Angaben sind die der
        bisherigen Landing (index.html Z.1500). ────────────────────── */
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

  /* ══ Der Score-Ring und die Balken ═══════════════════════════════════
     Jeder Teil merkt sich, ob er gelaufen ist. Das Sicherheitsnetz
     greift nur bei dem, der es NICHT ist - sonst zerreisst es die
     laufende Animation, so wie bisher. */
  var UMFANG = 333;          /* 2 * PI * 53, siehe stroke-dasharray im CSS */
  var ring = document.querySelector('.ids-dial .pg');
  var zielScore = ring ? parseInt(ring.dataset.score || '87', 10) : 0;

  function ringLos(sofort) {
    if (!ring || ring.dataset.fertig) return;
    ring.dataset.fertig = '1';
    if (sofort) ring.style.transition = 'none';
    ring.style.strokeDashoffset = (UMFANG * (1 - zielScore / 100)).toFixed(1);
  }
  function balkenLos(sofort) {
    document.querySelectorAll('[data-breit]').forEach(function (i, n) {
      if (i.dataset.fertig) return;
      i.dataset.fertig = '1';
      if (sofort) { i.style.transition = 'none'; i.style.width = i.dataset.breit + '%'; return; }
      /* gestaffelt, damit die fuenf Balken nacheinander einlaufen */
      setTimeout(function () { i.style.width = i.dataset.breit + '%'; }, n * 130);
    });
  }

  /* ══ Zaehler ═════════════════════════════════════════════════════════
     Die Zahl steht fertig im HTML. Laeuft der Zaehler, faengt er bei
     null an und ersetzt sie; laeuft er nicht, bleibt sie stehen. */
  function zahlAus(el) {
    var z = parseInt(String(el.textContent).replace(/\D/g, ''), 10);
    return isFinite(z) ? z : null;
  }
  function hoch(el, ziel, dauer) {
    if (el.dataset.fertig) return;
    el.dataset.fertig = '1';
    var ende = el.dataset.suffix || '';
    function fertig() { el.textContent = ziel.toLocaleString('de-DE') + ende; }
    if (ruhig || !sichtbar() || dauer === 0) { fertig(); return; }
    var start = null, d = dauer || 1600;
    requestAnimationFrame(function lauf(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / d), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(ziel * e).toLocaleString('de-DE') + ende;
      if (p < 1) requestAnimationFrame(lauf); else fertig();
    });
  }

  /* Die Zahlen im Hero laufen nach dem Einblenden los, gestaffelt.
     Vorher waren sie nach 1,1 s vorbei - bevor jemand hinsah. */
  var heroZahlen = [].slice.call(document.querySelectorAll('.hbeleg [data-zaehl]'));
  heroZahlen.forEach(function (e) {
    var z = zahlAus(e); if (z != null) e.dataset.ziel = z;
  });
  if (!ruhig && sichtbar()) {
    /* auf null setzen, damit das Hochlaufen ueberhaupt zu sehen ist */
    heroZahlen.forEach(function (e) { if (e.dataset.ziel) e.textContent = '0'; });
  }
  function heroLos() {
    heroZahlen.forEach(function (e, i) {
      var z = e.dataset.ziel != null ? parseInt(e.dataset.ziel, 10) : zahlAus(e);
      if (z == null) return;
      setTimeout(function () { hoch(e, z, 1500); }, i * 150);
    });
  }

  function alleZeigen() {
    document.querySelectorAll('.rv:not(.in)').forEach(function (e) { e.classList.add('in'); });
  }

  if (ruhig) {
    alleZeigen(); ringLos(true); balkenLos(true);
    heroZahlen.forEach(function (e) { var z = zahlAus(e); if (z != null) hoch(e, z, 0); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.rv').forEach(function (e) { io.observe(e); });

    /* Der Hero kommt zuletzt in Bewegung: erst faehrt die Karte hoch
       (ihre Animation laeuft bis 1,3 s), dann der Ring, dann die Zahlen. */
    setTimeout(function () { ringLos(false); balkenLos(false); }, 1050);
    setTimeout(heroLos, 1250);

    /* Sicherheitsnetz: nach vier Sekunden steht alles - aber nur das,
       was nicht ohnehin gelaufen ist. Die Marker verhindern, dass hier
       eine laufende Animation abgerissen wird. */
    setTimeout(function () {
      alleZeigen(); ringLos(true); balkenLos(true);
      heroZahlen.forEach(function (e) {
        var z = e.dataset.ziel != null ? parseInt(e.dataset.ziel, 10) : zahlAus(e);
        if (z != null) hoch(e, z, 0);
      });
    }, 4000);
  }

  /* Alle uebrigen Zahlen laufen, wenn sie ins Bild kommen. */
  var zio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var z = zahlAus(e.target);
      if (z != null) hoch(e.target, z);
      zio.unobserve(e.target);
    });
  }, { threshold: 0.35 });
  document.querySelectorAll('[data-zaehl]').forEach(function (e) {
    if (e.closest('.hbeleg')) return;      /* die laufen oben mit */
    zio.observe(e);
  });

  /* ── Nutzerzahl vom eigenen Host ─────────────────────────────────── */
  /* Die Zahl steht fertig im HTML. Kommt sie frisch herein und hat sich
     geaendert, laeuft sie noch einmal hoch - dann sieht man, dass sie lebt. */
  fetch('/api/v1/public/stats')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.registrierte_nutzer) return;
      var neu = d.registrierte_nutzer;
      document.querySelectorAll('[data-nutzer]').forEach(function (e) {
        var alt = e.dataset.ziel != null ? parseInt(e.dataset.ziel, 10) : zahlAus(e);
        e.dataset.ziel = neu;
        if (alt === neu) return;
        if (e.hasAttribute('data-zaehl') && sichtbar() && !ruhig) {
          delete e.dataset.fertig;
          hoch(e, neu, 900);
        } else {
          e.textContent = neu.toLocaleString('de-DE');
        }
      });
    })
    .catch(function () {});
})();
