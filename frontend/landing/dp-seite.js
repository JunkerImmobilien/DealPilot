/* ═══════════════════════════════════════════════════════════════════════
   dp-seite.js · v1533 · Bewegung auf den DealPilot-Unterseiten
   ───────────────────────────────────────────────────────────────────────
   Zwei Regeln, beide teuer gelernt:
   · Eine Animation darf NIE Bedingung dafuer sein, dass etwas sichtbar
     wird. Im Hintergrund-Tab feuert requestAnimationFrame nie und der
     IntersectionObserver oft auch nicht - ohne Sicherheitsnetz bliebe die
     halbe Seite auf opacity 0 stehen.
   · Wer weniger Bewegung eingestellt hat, bekommt sie sofort und ohne.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var kopf = document.getElementById('kopf');
  if (kopf) {
    addEventListener('scroll', function () {
      kopf.classList.toggle('fest', scrollY > 12);
    }, { passive: true });
  }

  function alleZeigen() {
    document.querySelectorAll('.rv:not(.da)').forEach(function (el) { el.classList.add('da'); });
  }
  if (ruhig) { alleZeigen(); return; }

  var beob = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('da');
      beob.unobserve(e.target);
    });
  }, { threshold: 0.14 });

  var i = 0;
  document.querySelectorAll('.rv').forEach(function (el) {
    el.style.transitionDelay = ((i++ % 4) * 85) + 'ms';
    beob.observe(el);
  });

  /* Sicherheitsnetz: nach knapp zwei Sekunden steht alles, komme was wolle. */
  setTimeout(alleZeigen, 1900);
})();
