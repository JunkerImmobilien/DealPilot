/* V259-07 + V263-03: Auto-Sync — DEAKTIVIERT da zvE jetzt read-only ist.
 * 
 * V262-V263-Architektur: zvE-Feld ist read-only (kommt aus tax_periods).
 * Daher gibt es keine User-Aenderung mehr im zvE-Feld die zu syncen waere.
 * Diese Datei bleibt fuer Backwards-Compat, macht aber nichts mehr.
 */
(function() {
  'use strict';
  
  window.DealPilotTaxPeriodsSync = {
    checkAndPrompt: function() { /* no-op */ },
    getRelevantDate: function() {
      const wuEl = document.getElementById('wirtschaftlicher_uebergang');
      const kdEl = document.getElementById('kaufdat') || document.getElementById('purchase_date') || document.getElementById('kaufdatum');
      if (wuEl && wuEl.value) return wuEl.value;
      if (kdEl && kdEl.value) return kdEl.value;
      const t = new Date();
      return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
    },
    _meta: 'V263-03-disabled'
  };
})();
