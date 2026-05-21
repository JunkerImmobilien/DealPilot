/* V261-04: V260-02 zvE-Smart-Modal deaktiviert.
 * zvE-Logik laeuft jetzt nur noch ueber tax_periods (read-only Feld).
 * Diese Datei bleibt fuer Backwards-Compat aber macht nichts mehr.
 */
(function(){
  window.DealPilotZveSmart = {
    applySuggestion: function() {},
    dismissSuggestion: function() {},
    optUpdate: function() {},
    optCreateNew: function() {},
    optNewPeriod: function() {},
    optLocalOnly: function() {},
    optCancel: function() {},
    attach: function() {},
    _meta: 'V261-04-disabled'
  };
})();
