'use strict';
/**
 * landing-mobile.js — einklappbare Leistungsliste in den Preistickets
 *
 * Laeuft NACH landing-motion.js und promo-erstflug.js (Reihenfolge in
 * index.html). Beide fassen .tk-price / .tk-note / .tk-rip an, keiner baut die
 * <ul class="tk-feat"> neu — dieses Modul kann also einmal laufen und liegen
 * bleiben.
 *
 * Aufteilung mit Absicht:
 *   JS setzt nur die Klasse .tkf-collapsed und haengt den Knopf an.
 *   Das AUSBLENDEN macht CSS in einer @media-Regel.
 * Dadurch verhaelt sich Drehen oder Fenstergroesse-Aendern von allein richtig,
 * ohne resize-Listener und ohne dass hier Breiten gemessen werden.
 */
(function () {

  var KEEP = 2;                 /* so viele Punkte bleiben sichtbar */
  var MARK = 'data-tkf';        /* Idempotenz: zweimaliges Laufen tut nichts */

  function label(n, open) {
    return open
      ? 'Weniger anzeigen<span class="chev">\u25be</span>'
      : 'Alle ' + n + ' Leistungen<span class="chev">\u25be</span>';
  }

  function build(ul) {
    if (!ul || ul.getAttribute(MARK)) return;

    var items = Array.prototype.filter.call(ul.children, function (n) {
      return n.tagName === 'LI';
    });
    if (items.length <= KEEP) return;          /* nichts zu verbergen */

    ul.setAttribute(MARK, '1');
    ul.classList.add('tkf-collapsed');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tkf-more';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = label(items.length, false);

    /* Der Knopf gehoert direkt hinter die Liste — vor die CTA, damit die
       Reihenfolge Preis -> Leistungen -> Aktion erhalten bleibt. */
    if (ul.parentNode) ul.parentNode.insertBefore(btn, ul.nextSibling);

    btn.addEventListener('click', function () {
      var open = ul.classList.toggle('tkf-collapsed') === false;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML = label(items.length, open);
    });
  }

  function run() {
    try {
      var host = document.getElementById('pricing');
      if (!host) return;
      Array.prototype.forEach.call(host.querySelectorAll('ul.tk-feat'), build);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
