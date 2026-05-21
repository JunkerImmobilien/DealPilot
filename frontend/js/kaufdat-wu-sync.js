/* V264-04: Bidirektionaler Sync kaufdat <-> wirtschaftlicher_uebergang */
(function() {
  'use strict';

  function attach() {
    const kdEl = document.getElementById('kaufdat');
    const wuEl = document.getElementById('wirtschaftlicher_uebergang');
    if (!kdEl || !wuEl) {
      // Felder noch nicht im DOM - spaeter retry
      return false;
    }
    
    if (kdEl.dataset.kduSync) return true; // bereits angehaengt
    kdEl.dataset.kduSync = '1';
    wuEl.dataset.kduSync = '1';
    
    kdEl.addEventListener('change', function() {
      // Wenn WU leer ist: mit kaufdat befuellen
      if (!wuEl.value && kdEl.value) {
        wuEl.value = kdEl.value;
        // Trigger calc/save
        try { wuEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
        if (typeof toast === 'function') {
          toast('Wirtschaftlicher Übergang automatisch auf Kaufdatum gesetzt');
        }
      }
    });
    
    console.log('[V264-04] Kaufdatum <-> Übergang Sync aktiv');
    return true;
  }

  // Retry-Loop bis Felder da sind
  let tries = 0;
  function tryAttach() {
    if (attach()) return;
    if (++tries < 20) setTimeout(tryAttach, 500);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAttach);
  } else {
    tryAttach();
  }
  
  window.DealPilotKaufdatSync = { attach, _meta: 'V264-04' };
})();
