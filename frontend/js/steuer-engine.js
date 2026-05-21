/* Block B-1: Minimale Steuer-Engine fuer tax_periods Lookups
 * Single Source of Truth fuer zvE-pro-Jahr-Lookup mit Forward-Fill.
 */
(function() {
  'use strict';

  /** zvE fuer ein Jahr aus tax_periods.
   *  - Wenn eine Periode IM Jahr aktiv: nimm deren zvE
   *  - Wenn mehrere im Jahr: gewichteter Tagesdurchschnitt
   *  - Wenn KEINE im Jahr: nimm letzten Eintrag VOR diesem Jahr (Forward-Fill)
   *  - Wenn auch keine davor: return 0
   */
  function zveForYear(year, taxPeriods) {
    if (!Array.isArray(taxPeriods)) return 0;
    
    var yearStr = String(year);
    var yearStart = yearStr + '-01-01';
    var yearEnd = yearStr + '-12-31';
    
    // 1) Perioden die IM Jahr aktiv sind
    var relevant = taxPeriods.filter(function(p) {
      if (!p.valid_from) return false;
      if (p.valid_from > yearEnd) return false;
      if (p.valid_to && p.valid_to < yearStart) return false;
      return true;
    });
    
    // 2) Forward-Fill: keine Periode IM Jahr -> letzten Eintrag VOR diesem Jahr
    if (relevant.length === 0) {
      var before = taxPeriods.filter(function(p) {
        return p.valid_from && p.valid_from <= yearEnd;
      }).sort(function(a, b) {
        return (b.valid_from || '').localeCompare(a.valid_from || '');
      });
      if (before.length > 0) return before[0].zve;
      return 0;
    }
    
    // 3) Eine Periode -> direkt nehmen
    if (relevant.length === 1) return relevant[0].zve;
    
    // 4) Mehrere Perioden -> gewichteter Tagesdurchschnitt
    var weighted = 0;
    var totalDays = 0;
    relevant.forEach(function(p) {
      var pStart = p.valid_from > yearStart ? p.valid_from : yearStart;
      var pEnd = (p.valid_to && p.valid_to < yearEnd) ? p.valid_to : yearEnd;
      var days = Math.max(1, Math.round((new Date(pEnd) - new Date(pStart)) / 86400000) + 1);
      weighted += p.zve * days;
      totalDays += days;
    });
    return totalDays > 0 ? Math.round(weighted / totalDays) : relevant[0].zve;
  }

  window.DealPilotSteuer = {
    zveForYear: zveForYear,
    _meta: 'BlockB-1'
  };
})();
