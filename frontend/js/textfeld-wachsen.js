/* v3990 · Marcel 23.11.2026: „Investitionsthese" und „Bekannte Risiken" im Reiter Objekt
   sollen mit dem Inhalt mitwachsen und sich leicht aufziehen lassen.
   Gemessen am Objekt 2026-1177: These 694 Zeichen, scrollHeight 427 px, sichtbar 64 px
   (css/objektdaten-raster.css `.od-strategie textarea { height: 64px }`, am Handy
   style.css `textarea { height:auto !important; min-height:60px !important }`).
   Hier: Höhe = Inhalt, zwischen MIN und MAX, beim Tippen, nach dem Laden eines Objekts
   und sobald der Reiter sichtbar wird. Über MAX scrollt das Feld, und der Griff unten
   rechts (resize: vertical) zieht es weiter auf. Inline mit Vorrang gesetzt, weil die
   Handy-Regel !important trägt. */
(function () {
  'use strict';
  var IDS = ['thesis', 'risiken'];
  var MIN = 64, MAX = 280;

  function anpassen(el) {
    if (!el || !el.isConnected) return;
    if (el.offsetParent === null) return;          /* Reiter zu: scrollHeight wäre 0 */
    if (el._dpGezogen) return;                      /* von Hand aufgezogen: nicht zurückspringen */
    el.style.setProperty('height', 'auto', 'important');
    var h = Math.max(MIN, Math.min(MAX, el.scrollHeight + 2));
    el.style.setProperty('height', h + 'px', 'important');
    el.style.setProperty('overflow-y', el.scrollHeight + 2 > MAX ? 'auto' : 'hidden', 'important');
  }
  function alle() { IDS.forEach(function (id) { anpassen(document.getElementById(id)); }); }

  function binden() {
    IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el._dpWachsen) return;
      el._dpWachsen = true;
      el.style.setProperty('resize', 'vertical', 'important');
      el.style.setProperty('min-height', MIN + 'px', 'important');
      el.addEventListener('input', function () { anpassen(el); });
      el.addEventListener('focus', function () { anpassen(el); });
      /* Griff gezogen: die eigene Höhe behalten, bis ein anderes Objekt geladen wird */
      el.addEventListener('mousedown', function (ev) {
        var r = el.getBoundingClientRect();
        if (ev.clientX > r.right - 18 && ev.clientY > r.bottom - 18) el._dpGezogen = true;
      });
      if (window.IntersectionObserver) {
        try { new IntersectionObserver(function (e) { if (e[0] && e[0].isIntersecting) anpassen(el); }).observe(el); } catch (x) {}
      }
    });
    alle();
  }
  function neu() { IDS.forEach(function (id) { var el = document.getElementById(id); if (el) el._dpGezogen = false; }); setTimeout(alle, 60); }

  window.addEventListener('dp:object-ready', neu);
  window.addEventListener('dp:newobj-ready', neu);
  window.addEventListener('resize', function () { clearTimeout(window._dpTfwT); window._dpTfwT = setTimeout(alle, 150); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', binden); else binden();
  window.DpTextfeldWachsen = { anpassen: alle };
})();
