/* avsec-karte-neu.js · v2760 / v2780 · Schalter fuer die Marktbewertungskarte

   Marcel 22.10.2026: „bei kleineren Displays und Handy sowie Tablets könnten wir die
   Markteinschätzungskarte schöner rendern ..." (v2760, Demo hinter ?mwkarte=neu) und
   „eine Schwelle finden, wann wir umschalten" (v2780).

   SEIT v2780 ist die Kartenfassung (css/avsec-karte-neu.css) STANDARD unter 1.100 px
   Kartenbreite - das regelt allein die @container-Abfrage, kein Skript. Diese Datei setzt
   nur noch den Vergleichsschalter: ?mwkarte=alt setzt html[data-dp-mwkarte="alt"] und
   zeigt die Fassung vor v2760 (avsec-streifen.css). ?mwkarte=neu ist ohne Wirkung (war der
   Demo-Schalter). Kein Merker, kein localStorage.

   Warum nicht ?karte=: den Parameter `karte` liest bereits js/karten-stil.js (Objektkarten-
   Stil) und schreibt ihn in einen Merker. Und data-dp-karte ist von hell-varianten.js
   belegt (Memory attributname-vorher-grepen).

   Im Quick-Check-iframe (eigenes Dokument, quickcheck-app.html) liest dieselbe Datei die
   Eltern-Seite mit (gleiche Origin) - qc-bridge.js muss den Parameter nicht durchreichen. */
(function () {
  'use strict';
  function wert(loc) {
    try { return new URLSearchParams(loc.search).get('mwkarte'); } catch (e) { return null; }
  }
  var w = wert(location);
  if (w !== 'alt' && window.parent && window.parent !== window) {
    try {
      w = wert(window.parent.location) === 'alt' ||
        window.parent.document.documentElement.getAttribute('data-dp-mwkarte') === 'alt' ? 'alt' : w;
    } catch (e) { /* fremde Origin: nichts */ }
  }
  if (w === 'alt') document.documentElement.setAttribute('data-dp-mwkarte', 'alt');
})();
