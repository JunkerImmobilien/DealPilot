/* avsec-karte-neu.js · v2760 · DEMO-SCHALTER fuer die neue Marktbewertungskarte (kleine Breiten)

   Marcel 22.10.2026: „bei kleineren Displays und Handy sowie Tablets könnten wir die
   Markteinschätzungskarte schöner rendern ... rutscht zwar alles in die nächste Zeile,
   sieht optisch aber nicht ansprechend aus."

   Optik ohne klare Vorgabe = Demo-first (CLAUDE.md). Die neue Fassung steht in
   css/avsec-karte-neu.css und greift NUR, wenn am <html> data-dp-mwkarte="neu" steht.
   Gesetzt wird es ausschliesslich ueber den URL-Parameter ?mwkarte=neu - kein Merker,
   kein localStorage. Ohne Parameter bleibt die Karte exakt wie bisher.

   Warum nicht ?karte=neu: den Parameter `karte` liest bereits js/karten-stil.js (Z. 633,
   Objektkarten-Stil) und schreibt ihn in einen Merker. Und data-dp-karte ist von
   hell-varianten.js belegt (Memory attributname-vorher-grepen).

   Im Quick-Check-iframe (eigenes Dokument, quickcheck-app.html) liest dieselbe Datei die
   Eltern-Seite mit (gleiche Origin) - qc-bridge.js muss den Parameter nicht durchreichen.

   ZUM STANDARD MACHEN: in css/avsec-karte-neu.css das Praefix
   `html[data-dp-mwkarte="neu"] ` entfernen (eine Ersetzung) - oder hier die Bedingung auf
   `true` setzen. */
(function () {
  'use strict';
  function ausUrl(loc) {
    try { return new URLSearchParams(loc.search).get('mwkarte') === 'neu'; } catch (e) { return false; }
  }
  var neu = ausUrl(location);
  if (!neu && window.parent && window.parent !== window) {
    try {
      neu = ausUrl(window.parent.location) ||
        window.parent.document.documentElement.getAttribute('data-dp-mwkarte') === 'neu';
    } catch (e) { /* fremde Origin: nichts */ }
  }
  if (neu) document.documentElement.setAttribute('data-dp-mwkarte', 'neu');
})();
