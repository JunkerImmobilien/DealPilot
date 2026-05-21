/* V261-05: V260-06 Mehrjaehriger-Steuerverlauf-Modul DEAKTIVIERT.
 * Berechnungen waren inkorrekt (Werte stimmten nicht mit Steuer-Tab ueberein).
 * Stattdessen wird die echte Logik direkt in calc.js (Steuerverlauf-Streifen) korrigiert.
 */
(function(){
  // Etwaige bereits injizierte Elemente entfernen
  function cleanup() {
    const host = document.getElementById('dp-v260-multiyear');
    if (host) host.remove();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup);
  } else {
    cleanup();
  }
  setInterval(cleanup, 3000); // Falls trotzdem injiziert wird
  
  window.DealPilotMultiYearSteuer = {
    computeMultiYear: () => Promise.resolve([]),
    computeZveForYear: () => 0,
    steuerEstG2026: () => 0,
    renderInto: () => {},
    injectIntoSteuerModul: () => {},
    _meta: 'V261-05-disabled'
  };
})();
