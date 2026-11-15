/* ═══════════════════════════════════════════════════════════════════════
   geschichten.js · landing-geschichten-1 (15.11.2026)
   Lässt die Instrumente auf geschichten.html ablaufen, sobald eine Szene
   zur Hälfte im Bild ist: Problem (1) → die Zahl kippt (2) → DealPilot (3),
   Kennzahl zählt dabei hoch wie die Hero-Zahlen der Startseite (dp2.js,
   gleiche Kurve 1 − (1 − p)³).

   Der Endzustand steht im HTML (data-phase="3", Zahl fertig) - ohne JS, für
   Suchmaschinen und bei „weniger Bewegung" bleibt er einfach stehen.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var szenen = [].slice.call(document.querySelectorAll('.gs-szene[data-phase]'));
  if (ruhig || !szenen.length || !('IntersectionObserver' in window)) return;

  var PHASE = { 1: 'Problem', 2: 'Die Zahl kippt', 3: 'DealPilot' };
  function phase(sz, p) {
    sz.setAttribute('data-phase', String(p));
    var t = sz.querySelector('.gs-sz-phase b');
    if (t) t.textContent = PHASE[p];
    var z = p === 1 && sz.querySelector('[data-ziel]');
    if (z) z.textContent = (z.getAttribute('data-vor') || '') + fmt(0, +z.getAttribute('data-dez') || 0) + (z.getAttribute('data-nach') || '');
  }
  function fmt(z, dez) { return z.toLocaleString('de-DE', { minimumFractionDigits: dez, maximumFractionDigits: dez }); }
  function zaehlen(el) {
    var ziel = parseFloat(el.getAttribute('data-ziel')), dez = +el.getAttribute('data-dez') || 0;
    var vor = el.getAttribute('data-vor') || '', nach = el.getAttribute('data-nach') || '';
    if (!isFinite(ziel)) return;
    var t0 = null, d = 1300;
    el.textContent = vor + fmt(0, dez) + nach;
    requestAnimationFrame(function lauf(t) {
      if (t0 == null) t0 = t;
      var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3);
      el.textContent = vor + fmt(ziel * e, dez) + nach;
      if (p < 1) requestAnimationFrame(lauf);
    });
  }
  function ablauf(sz) {
    phase(sz, 1);
    setTimeout(function () { phase(sz, 2); }, 1100);
    setTimeout(function () {
      phase(sz, 3);
      var z = sz.querySelector('[data-ziel]');
      if (z) setTimeout(function () { zaehlen(z); }, 350);
    }, 2500);
  }

  /* Startzustand erst setzen, wenn die Szene noch nicht im Bild ist - wer mitten in die Seite springt,
     sieht oben keine leeren Instrumente. */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      ablauf(e.target);
    });
  }, { threshold: 0.5 });
  szenen.forEach(function (sz) {
    var r = sz.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) { ablauf(sz); return; }   /* schon sichtbar: gleich los */
    phase(sz, 1);
    io.observe(sz);
  });
})();
