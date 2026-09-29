/* V270-tour-sidebar-disabled: Tour starten aus Aktionen-Sidebar entfernt
 * Tour-Engine bleibt aktiv über Hilfe-Modal Button.
 * Original-Datei archiviert via Git-History.
 */
(function() {
  'use strict';

  /* ── v1696 · DER KNOPF WAR SEIT V270 TOT ──────────────────────────
     Marcel: „im Menue links im Tower unter System ‚Rundgang starten'
     geht nicht."

     Er geht nirgends — auch nicht bei „Heute". Der Kopf dieser Datei
     sagt seit V270 „Tour starten aus Aktionen-Sidebar entfernt", und
     die Funktion suchte danach `window.startTour`. **Das gibt es
     nicht** (gemessen: `undefined`), und den Ersatzknopf
     `[data-action="start-tour"]` auch nicht. Der Eintrag in der
     Aktionsliste (`index.html:779`) ist aber stehengeblieben.

     > Wer eine Funktion abschaltet, muss ihren Knopf mitnehmen. Sonst
     > bleibt eine Schaltflaeche zurueck, die nichts tut — und das sieht
     > wie ein Fehler aus, weil es einer ist.

     Die Engine LAEUFT weiter: `tour-engine.js` haengt sie als
     `window.DpTour` mit `start()`, `reset()`, `isComplete()` ein
     (gemessen). Der Knopf zeigt jetzt dorthin.

     `reset()` vor `start()`, weil ein einmal abgeschlossener Rundgang
     sonst still nichts tut — wer ihn ausdruecklich startet, will ihn
     sehen, auch zum zweiten Mal. */
  function startTourFromSidebar() {
    try {
      if (window.DpTour && typeof window.DpTour.start === 'function') {
        try {
          if (typeof window.DpTour.isComplete === 'function'
              && window.DpTour.isComplete()
              && typeof window.DpTour.reset === 'function') {
            window.DpTour.reset();
          }
        } catch (e) {}
        return window.DpTour.start();
      }
      if (typeof window.startTour === 'function') return window.startTour();
      var btn = document.querySelector('[data-action="start-tour"], .tour-start-btn');
      if (btn) return btn.click();
      if (typeof window.toast === 'function') window.toast('Rundgang ist gerade nicht verfügbar.');
    } catch (e) {
      try { console.error('[Rundgang] Start fehlgeschlagen:', e); } catch (e2) {}
      if (typeof window.toast === 'function') window.toast('Rundgang konnte nicht starten.');
    }
  }

  // Exports beibehalten für andere Module die das evtl. aufrufen
  window.startTourFromSidebar = startTourFromSidebar;
})();
