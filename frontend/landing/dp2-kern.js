/* ═══════════════════════════════════════════════════════════════════════
   dp2-kern.js · landing-kern-1 (11.11.2026)
   Hero-Video verzögert laden. Vorher lud jeder Aufruf 3,6 MB (autoplay,
   preload=metadata, src gesetzt) - auch auf dem Handy, wo es nur hinter dem
   Text liegt. Jetzt steht zuerst das Poster; das Video kommt erst nach dem
   Laden der Seite und nur, wenn es sich lohnt:
     - Fenster ab 900 px breit
     - kein Datensparmodus (navigator.connection.saveData)
     - keine Einstellung „weniger Bewegung"
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var v = document.querySelector('.hero-bg[data-src]');
  if (!v) return;
  /* landing-hero-handy-1 · Marcel 23.11.2026: am Handy auch das Video, aber die kleine Fassung (0,34 MB statt 3,7 MB) */
  var handy = window.innerWidth < 760;
  if (handy) { v.setAttribute('poster', 'assets/bild/hero-handy.jpg'); v.setAttribute('data-src', 'assets/video/dp-hero-flug-handy.mp4'); }
  function lohnt() {
    if (!handy && window.innerWidth < 900) return false;
    try { if (navigator.connection && navigator.connection.saveData) return false; } catch (e) {}
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return true;
  }
  function los() {
    if (!lohnt() || v.getAttribute('src')) return;
    v.setAttribute('src', v.getAttribute('data-src'));
    v.setAttribute('autoplay', '');
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () {});
  }
  if (document.readyState === 'complete') setTimeout(los, 600);
  else window.addEventListener('load', function () { setTimeout(los, 600); });
})();
