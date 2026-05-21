/* V265-01: Zentrale Steuer-Engine
 * Single Source of Truth fuer alle Steuer-Berechnungen.
 * Nutzt tax_periods + WK-Aggregator + EStG-Tarif 2026.
 */
(function() {
  'use strict';

  /** EStG §32a 2026 Grundtabelle (Single-Veranlagung) */
  function estG2026(zve) {
    zve = Math.max(0, Math.round(zve));
    if (zve <= 12096) return 0;
    if (zve <= 17443) {
      const y = (zve - 12096) / 10000;
      return Math.round((932.30 * y + 1400) * y);
    }
    if (zve <= 68480) {
      const z = (zve - 17443) / 10000;
      return Math.round((176.64 * z + 2397) * z + 1015.13);
    }
    if (zve <= 277825) {
      return Math.round(0.42 * zve - 10911.92);
    }
    return Math.round(0.45 * zve - 19246.67);
  }

  /** Grenzsteuersatz an einem Punkt (Ableitung +1€) */
  function grenzsteuersatz(zve) {
    if (zve <= 0) return 0;
    const t1 = estG2026(zve);
    const t2 = estG2026(zve + 100);
    return ((t2 - t1) / 100) * 100;
  }

  function durchschnittssteuersatz(zve) {
    if (zve <= 0) return 0;
    return (estG2026(zve) / zve) * 100;
  }

  /** zvE fuer ein Jahr (anteilig wenn mehrere Steuerzeitraeume) */
  function zveForYear(year, taxPeriods) {
    const yearStr = String(year);
    const yearStart = yearStr + '-01-01';
    const yearEnd = yearStr + '-12-31';
    
    if (!Array.isArray(taxPeriods)) taxPeriods = [];
    
    const relevant = taxPeriods.filter(p => {
      if (!p.valid_from) return false;
      if (p.valid_from > yearEnd) return false;
      if (p.valid_to && p.valid_to < yearStart) return false;
      return true;
    });
    
    if (relevant.length === 0) return 0;
    if (relevant.length === 1) return relevant[0].zve;
    
    // Anteilig: gewichteter Durchschnitt nach Tagen
    let weighted = 0;
    let totalDays = 0;
    relevant.forEach(p => {
      const pStart = p.valid_from > yearStart ? p.valid_from : yearStart;
      const pEnd = (p.valid_to && p.valid_to < yearEnd) ? p.valid_to : yearEnd;
      const days = Math.max(1, Math.round((new Date(pEnd) - new Date(pStart)) / 86400000) + 1);
      weighted += p.zve * days;
      totalDays += days;
    });
    return totalDays > 0 ? Math.round(weighted / totalDays) : relevant[0].zve;
  }

  /** Haupt-Compute-Funktion fuer ein Jahr */
  function computeForYear(year, opts) {
    opts = opts || {};
    const taxPeriods = opts.taxPeriods || [];
    const wkSelfThisYear = opts.wkSelf || 0;      // V+V Ergebnis aktuelles Objekt (negativ = Verlust)
    const wkOthersThisYear = opts.wkOthers || 0;  // Summe WK anderer Won-Objekte
    
    const zveYear = zveForYear(year, taxPeriods);
    const wkTotal = wkSelfThisYear + wkOthersThisYear;
    
    // zvE mit Immobilien: zvE + WK (WK negativ bei Verlust = Steuervorteil)
    const zveMitImmo = Math.max(0, zveYear + wkTotal);
    
    const steuerOhne = estG2026(zveYear);
    const steuerMit = estG2026(zveMitImmo);
    const erstattung = steuerOhne - steuerMit;
    
    return {
      year: year,
      zve_year: zveYear,
      wk_self: wkSelfThisYear,
      wk_others: wkOthersThisYear,
      wk_total: wkTotal,
      zve_mit_immo: zveMitImmo,
      steuer_ohne: steuerOhne,
      steuer_mit: steuerMit,
      erstattung: erstattung,
      grenzsteuer: grenzsteuersatz(zveYear),
      durchschnittssteuer: durchschnittssteuersatz(zveYear)
    };
  }

  /** Compute fuer mehrere Jahre */
  async function computeMultiYear(startYear, numYears, currentObjId) {
    let taxPeriods = [];
    if (window.DealPilotTaxPeriods) {
      try { taxPeriods = await DealPilotTaxPeriods.loadAll(); } catch(e) {}
    }
    if (window.DealPilotWKAggregator) {
      try { await DealPilotWKAggregator.loadAll(true); } catch(e) {}
    }
    
    const K = window.State && window.State.kpis;
    const wkSelfBase = (K && typeof K.cf_op === 'number' && typeof K.afa === 'number')
      ? (K.cf_op - K.afa)
      : 0;
    
    const rows = [];
    for (let i = 0; i < numYears; i++) {
      const year = startYear + i;
      
      // WK self pro Jahr: Vereinfacht: gleicher Wert ueber alle Jahre
      // (TODO: spaeter pro-Jahres-Berechnung mit Tilgungsplan + Mietsteigerung)
      const wkSelf = wkSelfBase;
      
      // WK others fuer dieses Jahr
      const wkOthers = window.DealPilotWKAggregator
        ? (DealPilotWKAggregator.getWKForOtherObjects(currentObjId, year) || 0)
        : 0;
      
      const r = computeForYear(year, {
        taxPeriods,
        wkSelf,
        wkOthers
      });
      rows.push(r);
    }
    return rows;
  }

  window.DealPilotSteuer = {
    estG2026,
    grenzsteuersatz,
    durchschnittssteuersatz,
    zveForYear,
    computeForYear,
    computeMultiYear,
    _meta: 'V265-01'
  };
})();
