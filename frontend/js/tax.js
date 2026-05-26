/* V279-debounced: Single debounced POST fuer tax-snapshots */
(function(){
  var _timer = null;
  var _pendingPayload = null;
  window._scheduleTaxSnapshotPost = function(wkPerYear) {
    if (!window._currentObjKey || !window.Auth || typeof window.Auth.apiCall !== 'function') return;
    if (!wkPerYear || typeof wkPerYear !== 'object') return;
    _pendingPayload = wkPerYear;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function() {
      var payload = _pendingPayload;
      _pendingPayload = null;
      _timer = null;
      if (!payload) return;
      window.Auth.apiCall('/tax-snapshots/' + window._currentObjKey, {
        method: 'POST',
        body: { wk_per_year: payload }
      }).then(function(){
        // Cache invalidieren - aber NICHT sofort loadAll triggern (verursacht Render-Loop)
        if (window.DealPilotWKAggregator) {
          window.DealPilotWKAggregator._cache = null;  // soft-invalidate
        }
      }).catch(function(err){
        if (err && err.message && err.message.indexOf('429') < 0) {
          console.warn('[V279] snapshot POST failed:', err.message);
        }
      });
    }, 500);
  };
})();

'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – tax.js V12
   Deutsche Einkommensteuer-Berechnung mit Progression
   Basierend auf §32a EStG, Tarif 2026

   Tarif-Zonen 2026 (aus dem Excel "Steuerformular"):
     0     – 11.604 €    : steuerfrei
     11.605 – 17.005 €   : 14% – 24% Eingangsbereich
     17.006 – 66.760 €   : 24% – 42% Progressionsbereich
     66.761 – 277.825 €  : 42%
     ab 277.826 €        : 45% (Reichensteuer)

   Implementiert die offiziellen Formeln für 2026.
═══════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// V269a2-helper-relocated: Helper für Steuer-Startjahr (File-Scope)
// War in V269a1 innerhalb von Tax-IIFE → ReferenceError bei renderYearlyTaxForm
// Jetzt File-Scope → für ALLE Funktionen in tax.js erreichbar
// Cascade: DealPilotAnteilig.getBaseYear() > State.cfRows[0].cal > heute
// ═══════════════════════════════════════════════════════════════
function _v269_getStartYear() {
  try {
    if (typeof window !== 'undefined' && window.DealPilotAnteilig && window.DealPilotAnteilig.getBaseYear) {
      var by = window.DealPilotAnteilig.getBaseYear();
      if (by) return by;
    }
  } catch(_) {}
  try {
    if (typeof State !== 'undefined' && State.cfRows && State.cfRows[0] && State.cfRows[0].cal) {
      return State.cfRows[0].cal;
    }
  } catch(_) {}
  return new Date().getFullYear();
}

var Tax = (function() {
  // Tarif 2026 (§32a EStG)
  function calcEStG(zvE) {
    zvE = Math.floor(zvE); // immer abrunden
    if (zvE <= 11604) return 0;

    // Zone 1: 11.605 - 17.005 (Eingangs-Progression)
    if (zvE <= 17005) {
      var y = (zvE - 11604) / 10000;
      return Math.floor((922.98 * y + 1400) * y);
    }

    // Zone 2: 17.006 - 66.760 (Progressions-Bereich)
    if (zvE <= 66760) {
      var z = (zvE - 17005) / 10000;
      return Math.floor((181.19 * z + 2397) * z + 1025.38);
    }

    // Zone 3: 66.761 - 277.825 (42% linear)
    if (zvE <= 277825) {
      return Math.floor(0.42 * zvE - 10602.13);
    }

    // Zone 4: ab 277.826 (45% Reichensteuer)
    return Math.floor(0.45 * zvE - 18936.88);
  }

  /**
   * Calculates marginal tax rate (Grenzsteuersatz) at a given zvE.
   * Useful to know what the next euro of income will be taxed at.
   */
  function calcGrenzsteuersatz(zvE) {
    // Use 1000€ increment for stable result (Math.floor in calcEStG would give 0 for 1€)
    var t1 = calcEStG(zvE);
    var t2 = calcEStG(zvE + 1000);
    return (t2 - t1) / 1000;
  }

  /**
   * Average tax rate (Durchschnittssteuersatz)
   */
  function calcDurchschnittssteuersatz(zvE) {
    if (zvE <= 0) return 0;
    return calcEStG(zvE) / zvE;
  }

  /**
   * Calculate tax difference for additional income (or loss) from real estate.
   *
   * @param {number} baseIncome - regular zvE from job (without immo)
   * @param {number} immoResult - positive = income, negative = loss (V+V Überschuss/Verlust)
   * @returns {object} { taxBefore, taxAfter, taxDelta, refund }
   *   taxDelta = positive means more tax due
   *   refund = positive means money back from Finanzamt
   */
  function calcImmoTaxImpact(baseIncome, immoResult) {
    var newZvE = baseIncome + immoResult;
    if (newZvE < 0) newZvE = 0;
    var taxBefore = calcEStG(baseIncome);
    var taxAfter = calcEStG(newZvE);
    var taxDelta = taxAfter - taxBefore;
    return {
      taxBefore: taxBefore,
      taxAfter: taxAfter,
      taxDelta: taxDelta,        // < 0 = Erstattung, > 0 = Nachzahlung
      refund: -taxDelta,         // > 0 = Erstattung
      grenzsteuersatzBefore: calcGrenzsteuersatz(baseIncome),
      grenzsteuersatzAfter: calcGrenzsteuersatz(newZvE),
      avgBefore: calcDurchschnittssteuersatz(baseIncome),
      avgAfter: calcDurchschnittssteuersatz(newZvE)
    };
  }

  /**
   * Calculate immo P&L (Vermietungs-Überschuss / -Verlust)
   * after AfA, expenses etc. - this is the input to calcImmoTaxImpact.
   *
   * @param {object} fields - object with all the relevant fields
   * @returns immoResult (Überschuss > 0 oder Verlust < 0)
   */
  function calcImmoResult(fields) {
    // Einnahmen: Nettokaltmiete (NKM) jährlich
    var nkm_j = ((parseFloat(fields.nkm) || 0) + (parseFloat(fields.ze) || 0)) * 12;

    // Werbungskosten:
    // - Schuldzinsen
    // - Bewirtschaftungskosten (nur nicht umlagefähige & ähnliches)
    // - Erhaltungsaufwendungen / Sanierungen (außer anschaffungsnah)
    // - AfA

    var d1 = parseFloat(fields.d1) || 0;
    var d1z = (parseFloat(fields.d1z) || 0) / 100;
    var d2 = parseFloat(fields.d2) || 0;
    var d2z = (parseFloat(fields.d2z) || 0) / 100;
    var schuldzinsen = (d1 * d1z) + (d2 * d2z);

    // Bewirtschaftung - nicht-umlagefähig + Verwaltung etc.
    var bwk_nul = parseFloat(fields.hg_nul || 0) +
                   parseFloat(fields.weg_r || 0) +
                   parseFloat(fields.eigen_r || 0) +
                   parseFloat(fields.mietausfall || 0) +
                   parseFloat(fields.nul_sonst || 0);

    // V227: AfA aus State._afaBreakdown (Jahr 1, inkl. § 7b wenn aktiv)
    // Fallback auf alte Logik wenn Breakdown nicht da (z.B. erste Berechnung)
    var kp = parseFloat(fields.kp) || 0;
    var geb_anteil = (parseFloat(fields.geb_ant) || 80) / 100;
    var afa;
    if (window.State && State._afaBreakdown && State._afaBreakdown.gesamt) {
      afa = State._afaBreakdown.gesamt;
    } else {
      var afa_satz = (parseFloat(fields.afa_satz) || 2) / 100;
      afa = kp * geb_anteil * afa_satz;
    }

    // Erhaltungsaufwendungen (Sanierung) - nur wenn unter 15%-Grenze
    var san = parseFloat(fields.san) || 0;
    var grenze15 = kp * 0.15;
    var sanAbsetzbar = san <= grenze15 ? san : 0;
    // Wenn über 15%-Grenze → wird auf AfA umgelegt (vereinfacht: hier nicht im laufenden Jahr)

    var werbungskosten = schuldzinsen + bwk_nul + afa + sanAbsetzbar;

    return nkm_j - werbungskosten;
  }

  /**
   * Convenience: full tax calculation for the current calc state.
   * Returns a complete tax breakdown.
   */
  function calculateForObject(fields, baseIncome) {
    var immoResult = calcImmoResult(fields);
    var impact = calcImmoTaxImpact(baseIncome, immoResult);
    return {
      immoResult: immoResult,
      isLoss: immoResult < 0,
      isProfit: immoResult > 0,
      baseIncome: baseIncome,
      newZvE: baseIncome + immoResult,
      taxBefore: impact.taxBefore,
      taxAfter: impact.taxAfter,
      taxDelta: impact.taxDelta,
      refund: impact.refund,
      grenzsteuersatzBefore: impact.grenzsteuersatzBefore,
      grenzsteuersatzAfter: impact.grenzsteuersatzAfter,
      avgBefore: impact.avgBefore,
      avgAfter: impact.avgAfter
    };
  }

  return {
    calcEStG: calcEStG,
    calcGrenzsteuersatz: calcGrenzsteuersatz,
    calcDurchschnittssteuersatz: calcDurchschnittssteuersatz,
    calcImmoResult: calcImmoResult,
    calcImmoTaxImpact: calcImmoTaxImpact,
    calculateForObject: calculateForObject
  };
})();

// ═══════════════════════════════════════════════════
// UI: Steuer-Modul anzeigen (im Tab 3 "Miete & Steuern")
// ═══════════════════════════════════════════════════
// V275.2-helper-fix: Robuster Helper ohne STATE-Zugriff
// Nutzt nur oeffentliche getForDateSync() API + cached fuer Performance
var _zveCache = { periods: null, ts: 0 };

function _collectAllPeriodsViaScan() {
  // Sammelt alle Periods via getForDateSync() Probe-Calls fuer jedes Jahr 2000-2050
  // Das funktioniert OHNE Internal-STATE Zugriff.
  if (!window.DealPilotTaxPeriods || typeof DealPilotTaxPeriods.getForDateSync !== 'function') return [];
  var found = {};  // dedupe by valid_from
  for (var y = 2000; y <= 2050; y++) {
    var d = y + '-06-15';
    try {
      var p = DealPilotTaxPeriods.getForDateSync(d);
      if (p && p.valid_from && typeof p.zve === 'number') {
        found[p.valid_from] = p;
      }
    } catch(_) {}
  }
  return Object.keys(found).map(function(k){ return found[k]; });
}

function _getZveForDateWithFallback(yearStr) {
  if (!window.DealPilotTaxPeriods) return null;
  var refDate = yearStr + '-06-15';
  try {
    // Versuch 1: exakter Match via produktive API
    if (typeof DealPilotTaxPeriods.getForDateSync === 'function') {
      var p = DealPilotTaxPeriods.getForDateSync(refDate);
      if (p && typeof p.zve === 'number' && p.zve > 0) {
        return { zve: p.zve, source: 'Steuerzeitraum ' + yearStr, exact: true, period: p };
      }
    }
    // Versuch 2: alle Periods sammeln (mit Cache, 5 Sekunden TTL)
    var now = Date.now();
    if (!_zveCache.periods || (now - _zveCache.ts) > 5000) {
      _zveCache.periods = _collectAllPeriodsViaScan();
      _zveCache.ts = now;
    }
    var allPeriods = _zveCache.periods || [];
    var match = null;
    allPeriods.forEach(function(per) {
      if (!per || !per.valid_from || typeof per.zve !== 'number') return;
      if (per.valid_from <= refDate) {
        if (!match || per.valid_from > match.valid_from) match = per;
      }
    });
    if (match && typeof match.zve === 'number' && match.zve > 0) {
      return {
        zve: match.zve,
        source: 'letzter bekannter Wert (gueltig ab ' + match.valid_from + ')',
        exact: false,
        period: match
      };
    }
  } catch(_) {}
  return null;
}


// V276-other-objects: Verluste/Ueberschuesse aus anderen Bestandsobjekten
function _getBestandLossesForYear(displayYear) {
  // Synchron, nutzt nur Cache. Returns {sum, list, loaded}
  // loaded=false bedeutet: Cache noch nicht da, sollte Re-Render triggern
  var result = { sum: 0, list: [], loaded: false };
  if (!window.DealPilotWKAggregator || !displayYear) return result;
  try {
    var all = DealPilotWKAggregator.getAllObjectsWithWK();
    if (!Array.isArray(all)) return result;
    result.loaded = true;
    // currentObjectId ermitteln (verschiedene Wege)
    var currentId = null;
    try {
      if (window._currentObjId) currentId = _currentObjId;
      else if (window.State && State.currentObjectId) currentId = State.currentObjectId;
      else if (window._currentObjKey) currentId = _currentObjKey;
    } catch(_) {}
    // V280-correct-filter: mein eigenes Kaufdatum holen (kaufdat-Feld oder WUe)
    var currentObjKaufdat = null;
    try {
      var kdEl = document.getElementById('kaufdat');
      var wuEl = document.getElementById('wirtschaftlicher_uebergang');
      var raw = (kdEl && kdEl.value) || (wuEl && wuEl.value) || '';
      if (raw && raw.length >= 10) currentObjKaufdat = raw.substring(0, 10);
    } catch(_) {}
    // Year-Key als String
    var yearKey = String(displayYear);
    all.forEach(function(obj) {
      if (!obj || !obj.id) return;
      if (currentId && obj.id === currentId) return;  // sich selbst ueberspringen
      // V280-correct-filter: Anderes Objekt nur wenn dessen Kaufdatum
      //   1) VOR meinem eigenen Kaufdatum liegt UND
      //   2) Bis zum Card-Year (displayYear) bereits existierte
      var refDate = obj.purchase_date || obj.kaufdat || obj.wirtschaftlicher_uebergang;
      if (!refDate) return;
      var refDateStr = String(refDate).substring(0, 10);
      // Bedingung 1: anderes Kaufdatum < mein Kaufdatum
      if (currentObjKaufdat && refDateStr >= currentObjKaufdat) return;
      // Bedingung 2: anderes Kaufjahr <= displayYear
      var refYear = parseInt(refDateStr.substring(0, 4), 10);
      if (!refYear || refYear > displayYear) return;
      // Wert holen
      var val = obj.wk_per_year && obj.wk_per_year[yearKey];
      if (typeof val !== 'number' || val === 0) {
        // Falls nichts da: trotzdem Objekt mit 0 anzeigen
        result.list.push({
          id: obj.id,
          name: obj.address || obj.kuerzel || obj.name || 'Objekt ' + obj.id.substring(0, 8),
          address: obj.address || '',
          kaufdat: refDateStr,
          objName: obj.name || obj.kuerzel || '',
          value: 0
        });
        return;
      }
      result.list.push({
        id: obj.id,
        name: obj.address || obj.kuerzel || obj.name || 'Objekt ' + obj.id.substring(0, 8),
        address: obj.address || '',
        kaufdat: refDateStr,
        objName: obj.name || obj.kuerzel || '',
        value: val
      });
      result.sum += val;
    });
  } catch(e) {
    console.warn('[V276-other-objects]', e.message);
  }
  return result;
}

// Trigger async WK-Aggregator-Load + Re-Render wenn fertig
function _ensureBestandDataAndRerender() {
  if (!window.DealPilotWKAggregator) return;
  var cache = DealPilotWKAggregator.getAllObjectsWithWK();
  if (Array.isArray(cache) && cache.length > 0) return;  // schon da
  DealPilotWKAggregator.loadAll(false).then(function() {
    // Nach Load: Re-Render Tax-Modul
    setTimeout(function() {
      if (typeof renderTaxModule === 'function') {
        try { renderTaxModule(); } catch(_) {}
      }
    }, 100);
  }).catch(function(){});
}

function renderTaxModule(yearOverride) { /* V270-displayYear */ /* V283-tax-applied */ /* V284-tax-applied */ /* V285-tax-applied */ /* V286-tax-applied */
  if (!State.kpis) return;
  if (typeof _computeYearTotal !== 'function') return;

  var box = document.getElementById('tax-result-box');
  if (!box) return;

  // V270: Persistiere ausgewähltes Jahr (Klick auf Steuerverlauf-Card)
  if (typeof yearOverride === 'number' && yearOverride > 1900) {
    State._taxDisplayYear = yearOverride;
  }

  // V29: Empty-Guard — wenn weder Kaufpreis noch Kaltmiete da sind,
  // zeige einen klaren Empty-State statt verwirrender "Restwerte"
  // (vorher kamen z.B. 1.728 € Werbungskosten allein aus umlagefähigen NK,
  // was wie ein Phantom-Wert wirkt, obwohl der User nichts ausgefüllt hat).
  var hasKp = State.kpis.kp && State.kpis.kp > 0;
  var hasMiete = (State.kpis.nkm_m || 0) > 0 || (State.kpis.bmy_m || 0) > 0;
  if (!hasKp && !hasMiete) {
    box.innerHTML =
      '<div class="tax-empty-state">' +
        '<div class="tax-empty-icon">📋</div>' +
        '<div class="tax-empty-title">Noch keine Daten erfasst</div>' +
        '<div class="tax-empty-text">' +
          'Sobald du Kaufpreis und Kaltmiete eingibst, berechnen wir hier ' +
          'Werbungskosten, Überschuss und Steuer-Effekt automatisch.' +
        '</div>' +
      '</div>';
    return;
  }

  // V270: Year-Resolver — Cascade State._taxDisplayYear > heute > cfRows[0]
  var displayYear, yearIdx;
  var prefYear = State._taxDisplayYear || new Date().getFullYear();
  if (State.cfRows && State.cfRows.length) {
    yearIdx = -1;
    for (var _ti = 0; _ti < State.cfRows.length; _ti++) {
      if (State.cfRows[_ti].cal === prefYear) { yearIdx = _ti; break; }
    }
    if (yearIdx === -1) yearIdx = 0;
    displayYear = State.cfRows[yearIdx].cal;
  } else {
    yearIdx = 0;
    displayYear = prefYear;
  }
  var startYear = displayYear;
  var totals = _computeYearTotal(displayYear, yearIdx);

  // V275.1-zve-gap: nutzt Helper mit Luecken-Fallback
  var baseIncome = null;
  var _zveSource = 'aktueller Wert';
  try {
    if (displayYear) {
      var _zveInfo = _getZveForDateWithFallback(String(displayYear));
      if (_zveInfo) {
        baseIncome = _zveInfo.zve;
        _zveSource = _zveInfo.source;
      }
    }
  } catch(_e2751a) {}
  if (baseIncome === null) {
    baseIncome = parseDe((document.getElementById('zve') || {}).value) || 65891;
    _zveSource = 'aktueller zvE-Wert';
  }

  // V276-other-objects: Saldo aus anderen Bestandsobjekten
  var _bestandInfo = _getBestandLossesForYear(displayYear);
  if (!_bestandInfo.loaded) {
    _ensureBestandDataAndRerender();
  }
  var _baseIncomeOrig = baseIncome;
  baseIncome = baseIncome + _bestandInfo.sum;  // Saldierung (Verluste negativ, Ueberschuesse positiv)

  // Tooltip am zvE-ohne-Wert (falls Element vorhanden)
  try {
    var _zveOhneTip = box.querySelector('[data-zve-ohne-tip]') || box.querySelector('.tax-zve-ohne');
    if (_zveOhneTip) _zveOhneTip.title = 'zvE-Quelle: ' + _zveSource;
  } catch(_) {}
  var impact = Tax.calcImmoTaxImpact(baseIncome, totals.ergebnis);

  var refundColor = impact.refund > 0 ? 'var(--green)' : 'var(--red)';
  var refundLabel = impact.refund > 0 ? 'Steuer-Erstattung' : 'Steuer-Nachzahlung';
  var refundAbs = Math.abs(impact.refund);
  var isProfit = totals.ergebnis > 0;

  // V270: Header-Label aktualisieren (falls Element existiert)
  var titleEl = document.getElementById('tax-display-year');
  if (titleEl) titleEl.textContent = displayYear;
  // Alternativ: alle h2/h3-Headers im Steuer-Tab durchsuchen
  var taxSection = document.getElementById('s3-tax');
  if (taxSection) {
    var headers = taxSection.querySelectorAll('h2, h3, .sec-title, [class*="title"], .ct, .ct-pro'); /* V283a */
    headers.forEach(function(h) {
      if (/echte\s+progression\s+\d{4}/i.test(h.textContent)) {
        h.textContent = h.textContent.replace(/(echte\s+progression\s+)\d{4}/i, '$1' + displayYear);
      }
    });
  }

  box.innerHTML =
    /* V283b: Neues Layout — LINKS=OHNE Immobilie, RECHTS=MIT Immobilie */
    '<div class="tax-grid">' +
      /* ─── LINKS: Ausgangs-zvE ─── */
      '<div class="tax-item"><div class="tax-label">Ausgangs-zvE <span class="tax-info" title="zvE-Quelle: ' + _zveSource + '">ⓘ</span></div><div class="tax-val">' + fE(_baseIncomeOrig, 0) + '</div></div>' +
      /* ─── RECHTS: Einnahmen V+V ─── */
      '<div class="tax-item"><div class="tax-label">Einnahmen V+V <span class="tax-info" title="Kaltmiete + zus. Einnahmen + umlf. NK">ⓘ</span></div><div class="tax-val">' + fE(totals.einnahmen, 0) + '</div></div>' +
      /* ─── LINKS: Überschuss/Verlust V+V (aktueller Bestand) [V286: Hybrid mit Overlay] ─── */
      (function(){
        var fmtVal = function(n) { return (n >= 0 ? '+' : '') + n.toLocaleString('de-DE') + ' €'; };
        var fmtDate = function(s) {
          if (!s || s.length < 10) return '';
          /* YYYY-MM-DD → DD.MM.YYYY */
          var parts = s.substring(0, 10).split('-');
          if (parts.length !== 3) return s;
          return parts[2] + '.' + parts[1] + '.' + parts[0];
        };
        var escHtml = function(s) {
          return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        /* Fall 1: keine anderen Bestandsobjekte */
        if (!_bestandInfo || !_bestandInfo.list || _bestandInfo.list.length === 0) {
          return '<div class="tax-item"><div class="tax-label">Überschuss/Verlust V+V (aktueller Bestand) <span class="tax-info" title="Keine anderen Bestandsobjekte mit Kaufdatum vor diesem Objekt">ⓘ</span></div><div class="tax-val" style="color:var(--muted)">—</div></div>';
        }
        var sumColor = _bestandInfo.sum < 0 ? 'c-red' : (_bestandInfo.sum > 0 ? 'c-green' : '');
        var count = _bestandInfo.list.length;
        /* Sortierung: nach Kaufdatum aufsteigend (älteste zuerst) */
        var sorted = _bestandInfo.list.slice().sort(function(a, b) {
          var aD = a.kaufdat || '';
          var bD = b.kaufdat || '';
          if (aD < bD) return -1;
          if (aD > bD) return 1;
          return 0;
        });
        /* Daten in window._taxBestandData speichern für Overlay-Renderer */
        try { window._taxBestandData = { list: sorted, sum: _bestandInfo.sum, year: displayYear }; } catch(_) {}

        var labelHtml = '<div class="tax-label">Überschuss/Verlust V+V (aktueller Bestand) '
                      + '<span style="color:var(--muted);font-size:11.5px;margin-left:2px">(' + count + ')</span> '
                      + '<span class="tax-info" title="Summe der Ueberschuesse/Verluste aller anderen Bestandsobjekte (Kaufdatum vor diesem Objekt). Berechnung fuer Jahr ' + displayYear + '. Klick fuer Detailliste.">ⓘ</span></div>';

        /* Fall 2a: ≤5 Objekte → Inline-Liste */
        if (count <= 5) {
          var inlineRows = sorted.map(function(o) {
            var vColor = o.value < 0 ? 'c-red' : (o.value > 0 ? 'c-green' : '');
            return '<div class="tax-bestand-row">'
                 + '<span class="tax-bestand-name" title="' + escHtml(o.name) + '">' + escHtml(o.name) + '</span>'
                 + '<span class="tax-bestand-date">' + escHtml(fmtDate(o.kaufdat)) + '</span>'
                 + '<span class="tax-bestand-val ' + vColor + '">' + fmtVal(o.value) + '</span>'
                 + '</div>';
          }).join('');
          return '<details class="tax-item-bestand">'
               +   '<summary class="tax-item">'
               +     labelHtml
               +     '<div class="tax-val ' + sumColor + '">' + fmtVal(_bestandInfo.sum) + '</div>'
               +   '</summary>'
               +   '<div class="tax-bestand-list tax-bestand-list-inline">' + inlineRows + '</div>'
               + '</details>';
        }

        /* Fall 2b: >5 Objekte → Overlay (Klick auf Item öffnet) */
        return '<div class="tax-item tax-item-bestand-trigger" data-tax-bestand-open="1" role="button" tabindex="0">'
             +   labelHtml
             +   '<div class="tax-val ' + sumColor + '">' + fmtVal(_bestandInfo.sum) + ' ▸</div>'
             + '</div>';
      })() +
      /* ─── RECHTS: Werbungskosten gesamt ─── */
      '<div class="tax-item"><div class="tax-label">Werbungskosten gesamt <span class="tax-info" title="Schuldzinsen + Bewirtschaftung + AfA + alle übrigen abziehbaren Kosten. Umlagefähige NK sind Werbungskosten UND Einnahme — sie heben sich auf (durchlaufender Posten) und beeinflussen den Steuer-Effekt nicht.">ⓘ</span></div><div class="tax-val c-red">' + fE(totals.werbungskosten, 0) + '</div></div>' +
      /* ─── LINKS: Leerer Platzhalter (Symmetrie) ─── */
      '<div class="tax-item" style="opacity:.4;background:transparent;border-color:rgba(201,168,76,0.08)"><div class="tax-label" style="font-style:italic">—</div><div class="tax-val">—</div></div>' +
      /* ─── RECHTS: Überschuss/Verlust V+V (dieses Objekt) ─── */
      '<div class="tax-item tax-highlight"><div class="tax-label">Überschuss / Verlust V+V (diese Immobilie)</div><div class="tax-val" style="color:' + (isProfit ? 'var(--gold-d)' : 'var(--green)') + '">' + fE(totals.ergebnis, 0, true) + '</div></div>' +
      /* ─── LINKS: zvE ohne Immobilie ─── */
      '<div class="tax-item"><div class="tax-label">zvE ohne Immobilie (mit aktuellem Bestand)</div><div class="tax-val">' + fE(baseIncome, 0) + '</div></div>' +
      /* ─── RECHTS: zvE mit Immobilie ─── */
      '<div class="tax-item"><div class="tax-label">zvE mit dieser Immobilie</div><div class="tax-val">' + fE(baseIncome + totals.ergebnis, 0) + '</div></div>' +
      /* ─── LINKS: EStG ohne ─── */
      '<div class="tax-item"><div class="tax-label">EStG ohne Immo</div><div class="tax-val">' + fE(impact.taxBefore, 0) + '</div></div>' +
      /* ─── RECHTS: EStG mit ─── */
      '<div class="tax-item"><div class="tax-label">EStG mit Immo</div><div class="tax-val">' + fE(impact.taxAfter, 0) + '</div></div>' +
      /* ─── VOLLE BREITE: Erstattung/Nachzahlung ─── */
      '<div class="tax-item tax-result" style="grid-column:1/-1"><div class="tax-label">' + refundLabel + ' (jährlich)</div><div class="tax-val" style="color:' + refundColor + ';font-size:20px">' + (impact.refund >= 0 ? '+' : '') + fE(refundAbs, 0) + '</div></div>' +
      /* ─── LINKS: Grenzsteuersatz ─── */
      '<div class="tax-item"><div class="tax-label">Grenzsteuersatz aktuell</div><div class="tax-val">' + (impact.grenzsteuersatzAfter * 100).toFixed(1).replace('.', ',') + ' %</div></div>' +
      /* ─── RECHTS: Durchschnittssteuersatz ─── */
      '<div class="tax-item"><div class="tax-label">Durchschnittssteuersatz</div><div class="tax-val">' + (impact.avgAfter * 100).toFixed(1).replace('.', ',') + ' %</div></div>' +
    '</div>';

  // V279-debounced: renderTaxModule ruft Debouncer mit aktualisierter taxTimeline
  try {
    if (window._currentObjKey && typeof displayYear === 'number' && totals && typeof totals.ergebnis === 'number'
        && typeof window._scheduleTaxSnapshotPost === 'function') {
      // taxTimeline mit UI-Wert updaten
      if (Array.isArray(State.taxTimeline)) {
        var _tlIdx = State.taxTimeline.findIndex(function(t){ return t && t.year === displayYear; });
        if (_tlIdx >= 0) State.taxTimeline[_tlIdx].immoResult = totals.ergebnis;
      }
      // Snapshot zusammenstellen
      var _newWk = {};
      if (Array.isArray(State.taxTimeline)) {
        State.taxTimeline.forEach(function(t){
          if (t && typeof t.year === 'number' && typeof t.immoResult === 'number') {
            _newWk[String(t.year)] = Math.round(t.immoResult);
          }
        });
      }
      _newWk[String(displayYear)] = Math.round(totals.ergebnis);
      window._scheduleTaxSnapshotPost(_newWk);
    }
  } catch (e) { console.warn('[V279] module snapshot error:', e); }

  // Cache for PDF export
  State.taxResult = {
    immoResult: totals.ergebnis, isProfit: isProfit,
    baseIncome: baseIncome, newZvE: baseIncome + totals.ergebnis,
    taxBefore: impact.taxBefore, taxAfter: impact.taxAfter,
    taxDelta: impact.taxDelta, refund: impact.refund,
    grenzsteuersatzAfter: impact.grenzsteuersatzAfter,
    avgAfter: impact.avgAfter
  };

  // EStG view in Persönliche Steuer card
  var estgView = document.getElementById('estg_view');
  if (estgView) estgView.textContent = fE(impact.taxBefore, 0);
}


// ═══════════════════════════════════════════════════
// STEUERVERLAUF über mehrere Jahre
// ═══════════════════════════════════════════════════
function renderTaxTimeline() {
  if (!State.cfRows || !State.cfRows.length) return;
  if (typeof Tax === 'undefined') return;

  var box = document.getElementById('tax-timeline-box');
  if (!box) return;

  // V110 BUG-FIX: Vorher rechnete der Verlauf eigene Werte (wm_y - zy - bwk_y - afa).
  //               Das war inkonsistent zum Steuerformular pro Jahr — Sanierung, Möblierung,
  //               umlagefähige NK, Verwaltungskosten etc. fehlten komplett. Folge: Erstattung
  //               im Verlauf wich teils stark von Erstattung im Detail-Formular ab.
  //               Jetzt nutzt der Verlauf _computeYearTotal() — die einzige Quelle der Wahrheit.
  if (typeof _computeYearTotal !== 'function') return;

  var years = State.cfRows.slice(0, 15);  // first 15 years

  var timeline = years.map(function(r, i) {
    var totals = _computeYearTotal(r.cal, i);
    return {
      year: r.cal,
      einnahmen: totals.einnahmen,
      werbungskosten: totals.werbungskosten,
      immoResult: totals.ergebnis,
      taxDelta: totals.taxDelta,
      refund: totals.refund
    };
  });

  // Render as visual timeline
  var html = '<div class="tax-tl-grid">';
  /* V270-cardClick: Klickbare Cards → laden Berechnung in Steuermodul oben */
  var _activeYear = State._taxDisplayYear || new Date().getFullYear();
  timeline.forEach(function(t) {
    var positive = t.refund > 0;
    var color = positive ? 'var(--green)' : 'var(--red)';
    var bgcolor = positive ? 'rgba(42,154,90,0.1)' : 'rgba(201,76,76,0.1)';
    var sign = positive ? '+' : '';
    var isActive = (t.year === _activeYear);
    var activeStyle = isActive
      ? ';outline:2px solid var(--gold,#C9A84C);outline-offset:1px;box-shadow:0 2px 8px rgba(201,168,76,0.3)'
      : '';
    html += '<div class="tax-tl-bar tax-tl-clickable" ' +
      'style="background:' + bgcolor + ';border-left-color:' + color + ';cursor:pointer;transition:all 0.15s' + activeStyle + '" ' +
      'onclick="if(typeof renderTaxModule===\'function\'){renderTaxModule(' + t.year + ');var b=document.getElementById(\'tax-result-box\');if(b)b.scrollIntoView({behavior:\'smooth\',block:\'center\'});}" ' +
      'title="Klick: Berechnung für ' + t.year + ' anzeigen">' +
      '<div class="tax-tl-year">' + t.year + '</div>' +
      '<div class="tax-tl-amount" style="color:' + color + '">' +
        sign + Math.round(Math.abs(t.refund)).toLocaleString('de-DE') + ' €' +
      '</div>' +
      '<div class="tax-tl-label">' + (positive ? 'Erstattung' : 'Nachzahlung') + '</div>' +
    '</div>';
  });
  html += '</div>';

  // Total
  var totalRefund = timeline.reduce(function(s, t) { return s + t.refund; }, 0);
  html += '<div class="tax-tl-total">' +
    '<span>Summe über ' + timeline.length + ' Jahre:</span>' +
    '<span style="color:' + (totalRefund >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;font-size:18px">' +
      (totalRefund >= 0 ? '+' : '') + Math.round(totalRefund).toLocaleString('de-DE') + ' €' +
    '</span>' +
  '</div>';

  box.innerHTML = html;

  // Cache for PDF export
  State.taxTimeline = timeline;

  // V279-debounced: renderTaxTimeline ruft jetzt nur Debouncer (statt direkt POST)
  try {
    if (window._currentObjKey && Array.isArray(timeline) && typeof window._scheduleTaxSnapshotPost === 'function') {
      var _wkSnap = {};
      timeline.forEach(function(t) {
        if (t && typeof t.year === 'number' && typeof t.immoResult === 'number') {
          _wkSnap[String(t.year)] = Math.round(t.immoResult);
        }
      });
      if (Object.keys(_wkSnap).length > 0) {
        window._scheduleTaxSnapshotPost(_wkSnap);
      }
    }
  } catch (e) { console.warn('[V279] timeline snapshot error:', e); }
}

// Hook into existing renderTaxModule
var _origRenderTax = renderTaxModule;
renderTaxModule = function(year) { /* V270.1-hook-passthrough */
  _origRenderTax(year);
  renderTaxTimeline();
};

// ═══════════════════════════════════════════════════
// YEARLY TAX FORM (Steuerformular pro Jahr)
// Quick-Modus default + Detail-Modus per Toggle
// App rechnet als Vorschlag, User kann pro Jahr überschreiben
// ═══════════════════════════════════════════════════

// State for yearly overrides: { year: { field: value, ... } }
if (typeof window._taxYearlyOverrides === 'undefined') {
  window._taxYearlyOverrides = {};
}

function _yearKey(year) { return 'y' + year; }

function _getYearOverride(year, field) {
  var key = _yearKey(year);
  var entry = window._taxYearlyOverrides[key];
  if (!entry) return undefined;
  return entry[field];
}

function _setYearOverride(year, field, value) {
  var key = _yearKey(year);
  if (!window._taxYearlyOverrides[key]) window._taxYearlyOverrides[key] = {};
  if (value === '' || value == null || isNaN(value)) {
    delete window._taxYearlyOverrides[key][field];
  } else {
    window._taxYearlyOverrides[key][field] = parseFloat(value);
  }
}

/**
 * Compute the auto-suggestion for a given year (from cfRows + AfA + base income).
 * Returns: { year, einnahmen_km, einnahmen_nk, schuldzinsen, kontofuehrung, bereitstellung,
 *   notar_grundschuld, vermittlung, finanz_sonst, nk_umlf, nk_n_umlf, betr_sonst,
 *   hausverwaltung, steuerber, porto, verw_sonst, fahrtkosten, verpflegung, hotel,
 *   inserat, gericht, telefon, sonst_kosten, afa, sonst_bewegl_wg }
 */
function _computeAutoForYear(yearIdx, year) {
  // yearIdx is 0-based index into State.cfRows (year 1 = idx 0)
  var row = (State.cfRows && State.cfRows[yearIdx]) ? State.cfRows[yearIdx] : null;

  // V112 BUG-FIX: kpis.afa enthält Gebäude-AfA + Küche-AfA. Aber im Steuerformular pro Jahr
  //   ist Feld 5 "AfA Gebäude" (sollte NUR Gebäude sein), und Feld 6 "AfA bewegliche
  //   Wirtschaftsgüter" enthält separat die Küche/Möblierung. Vorher wurde die Küche in
  //   beiden Feldern aufgeführt → doppelt steuerlich abgesetzt.
  //   Fix: afa-Feld auf reine Gebäude-AfA reduzieren, Küche-AfA in sonst_bewegl_wg aufnehmen.
  var afaBd = (State._afaBreakdown) ? State._afaBreakdown : null;
  var afaGesamt = State.kpis ? (State.kpis.afa || 0) : 0;
  var afaKueche = (afaBd && afaBd.kueche) ? afaBd.kueche : 0;
  // V227: Jahresgenaue Gebäude-AfA (degressive AfA fällt jedes Jahr, § 7b wirkt nur J. 1-4)
  // Fallback auf Jahr-1-Wert wenn Series nicht verfügbar (z.B. wenn Engine noch nicht initialisiert)
  var afaGebaeude;
  var afaSonder7bJahr = 0;
  if (State._afaSeriesNormal && State._afaSeriesNormal.length > yearIdx) {
    afaGebaeude = State._afaSeriesNormal[yearIdx];
    afaSonder7bJahr = (State._afaSeriesSonder && State._afaSeriesSonder[yearIdx]) || 0;
  } else {
    afaGebaeude = afaBd && (afaBd.gebaeude != null) ? afaBd.gebaeude : (afaGesamt - afaKueche);
  }

  // V31/V32: Sanierung + Möblierung steuerlich korrekt verteilen
  // ───────────────────────────────────────────────────────
  var kp_inp = parseDe((document.getElementById('kp') || {}).value) || 0;
  var san_inp = parseDe((document.getElementById('san') || {}).value) || 0;
  var moebl_inp = parseDe((document.getElementById('moebl') || {}).value) || 0;

  // V32: User-Toggles aus Investition-Tab
  var sanActive = (document.getElementById('san_tax_active') || {}).checked !== false;
  var moeblActive = (document.getElementById('moebl_tax_active') || {}).checked !== false;
  var sanYearsChoice = (document.getElementById('san_tax_years') || {}).value || 'auto';
  var moeblYearsChoice = parseInt((document.getElementById('moebl_tax_years') || {}).value || '10');

  // SANIERUNG
  // V227: Methode-aware AfA-Satz-Bestimmung für Sanierungs-Laufzeit.
  // Bei degressiv ist der "AfA-Satz" für die Nutzungsdauer-Logik anders:
  //   linear 2.0% → 50 Jahre Nutzungsdauer
  //   linear 2.5% → 40 J.
  //   linear 3.0% → 33 J. (Wohnzwecke ab 2023, Neubau)
  //   degressiv 5%  → effektive Nutzungsdauer ist 33 J. (Neubau, Wohnbau)
  var afa_sel_val = (document.getElementById('afa_satz') || {}).value || '2.0';
  var afa_parsed_for_san = (window.Afa && Afa.parseSelectValue) ? Afa.parseSelectValue(afa_sel_val) : { methode: 'linear', satzPct: parseDe(afa_sel_val) || 2 };
  var afa_satz_pct = afa_parsed_for_san.satzPct;
  // Effektive Nutzungsdauer für anschaffungsnahe HK:
  var afa_nutzungsdauer = (afa_parsed_for_san.methode === 'linear')
    ? Math.round(100 / afa_satz_pct)
    : 33;  // Degressiv → Wohnbau-Neubau-Nutzungsdauer
  var sanGrenze15 = kp_inp * 0.15;
  var sanAnschaffungsnah, sanLaufzeit, sanAfaJaehrlich;

  if (!sanActive) {
    sanAnschaffungsnah = false;
    sanLaufzeit = 0;
    sanAfaJaehrlich = 0;
  } else if (sanYearsChoice === 'auto') {
    // Automatik: 15%-Regel
    sanAnschaffungsnah = san_inp > sanGrenze15;
    sanLaufzeit = sanAnschaffungsnah ? afa_nutzungsdauer : 5;
    sanAfaJaehrlich = san_inp / sanLaufzeit;
  } else if (sanYearsChoice === '50') {
    // Manuell: anschaffungsnah, also Gebäude-AfA-Nutzungsdauer
    sanAnschaffungsnah = true;
    sanLaufzeit = afa_nutzungsdauer;
    sanAfaJaehrlich = san_inp / sanLaufzeit;
  } else {
    // Manuell: feste Jahresanzahl als Erhaltungsaufwand
    sanAnschaffungsnah = false;
    sanLaufzeit = parseInt(sanYearsChoice);
    sanAfaJaehrlich = san_inp / sanLaufzeit;
  }
  var sanThisYear = (sanLaufzeit > 0 && yearIdx < sanLaufzeit) ? sanAfaJaehrlich : 0;

  // MÖBLIERUNG
  var moeblLaufzeit = moeblYearsChoice;
  var moeblPerYear = moeblActive ? (moebl_inp / moeblLaufzeit) : 0;
  var moeblThisYear = (moeblActive && yearIdx < moeblLaufzeit) ? moeblPerYear : 0;

  // Einnahmen: Nettokaltmiete + zusätzliche Einnahmen (z.B. Stellplatz, Garage)
  var nkm_m = parseDe((document.getElementById('nkm') || {}).value) || 0;
  var ze_m = parseDe((document.getElementById('ze') || {}).value) || 0;
  var mstg = (parseDe((document.getElementById('mietstg') || {}).value) || 1.5) / 100;
  // V23: Detail-Modus der Mietentwicklung nutzt eine Treppen-Funktion statt Compound %.
  // Wenn das Modul nicht geladen ist (Legacy-Fallback), wird mstg compound verwendet.
  var _mFac = (window.MietEntwicklung && typeof MietEntwicklung.factor === 'function')
              ? function(y){ return MietEntwicklung.factor(y); }
              : function(y){ return Math.pow(1 + mstg, y); };
  // Toggle: Erhöhung gilt nur für Nettokaltmiete (Default) ODER auch zE.
  var meIncludeZE = (window.MietEntwicklung && typeof MietEntwicklung.appliesToZE === 'function')
                    ? MietEntwicklung.appliesToZE() : false;
  // Kaltmiete (NKM) wächst mit Faktor; zE wächst je nach Toggle mit oder ohne
  var einnahmen_nkm = nkm_m * 12 * _mFac(yearIdx);
  var einnahmen_ze  = ze_m  * 12 * (meIncludeZE ? _mFac(yearIdx) : 1.0);
  var einnahmen_km = einnahmen_nkm + einnahmen_ze;

  // Umlagefähige Nebenkosten — wachsen mit Kostensteigerung (kstg), nicht mit Mietsteigerung.
  // V23-Fix: vorher wurden hier mistg verwendet, das ist konzeptionell falsch
  // (umlagefähige NK sind keine Mieteinnahme, sondern durchlaufender Posten).
  var nk_umlf_m = parseDe((document.getElementById('umlagef') || {}).value) || 0;
  var kstg = (parseDe((document.getElementById('kostenstg') || {}).value) || 1.0) / 100;
  var einnahmen_nk = nk_umlf_m * 12 * Math.pow(1 + kstg, yearIdx);

  // ═══════════════════════════════════════════════════════════════
  // V269c1-einnahmen-y1: Einnahmen Jahr 1 anteilig nach WU
  // Konsistent zu cfRows (V269c) — gleicher wuFactor.
  // Wirkt nur bei yearIdx === 0 UND WU mitten im Jahr.
  // ═══════════════════════════════════════════════════════════════
  if (yearIdx === 0 && typeof window.DealPilotAnteilig === 'object'
      && typeof window.DealPilotAnteilig.getWuMonths === 'function') {
    try {
      var _v269c1_wuMonths = window.DealPilotAnteilig.getWuMonths(year);
      if (typeof _v269c1_wuMonths === 'number' && _v269c1_wuMonths >= 0 && _v269c1_wuMonths < 12) {
        var _v269c1_factor = _v269c1_wuMonths / 12;
        einnahmen_nkm *= _v269c1_factor;
        einnahmen_ze  *= _v269c1_factor;
        einnahmen_km  = einnahmen_nkm + einnahmen_ze;
        einnahmen_nk  *= _v269c1_factor;
      }
    } catch(_v269c1_e) {
      console.warn('[V269c.1] Einnahmen Y1-Anteil:', _v269c1_e.message);
    }
  }

  // Schuldzinsen aus cfRows
  var schuldzinsen = row ? (row.zy || 0) : 0;
  // Bewirtschaftung
  var bwk_total = row ? (row.bwk_y || 0) : 0;
  // Anteil "nicht umlagefähig" und Verwaltung schätzen wir je 30/20% von BWK
  var betriebskosten_n_umlf = bwk_total * 0.30;
  var verwaltung = bwk_total * 0.20;
  var sonst_bewirt = bwk_total * 0.05;

  return {
    year: year,
    yearIdx: yearIdx,

    // 1.0 Finanzierungskosten
    schuldzinsen: schuldzinsen,
    kontofuehrung: 8,             // typisch
    bereitstellung: 0,
    notar_grundschuld: 0,
    vermittlung: 0,
    finanz_sonst: 0,

    // 2.0 Betriebskosten
    nk_umlf: einnahmen_nk,        // wird gegen Einnahmen verrechnet
    nk_n_umlf: betriebskosten_n_umlf,
    betr_sonst: sonst_bewirt,

    // 3.0 Verwaltungskosten
    hausverwaltung: verwaltung,
    steuerber: 15,
    porto: 5,
    verw_sonst: 0,

    // 4.0 Sonstige Kosten
    fahrtkosten: 0,
    verpflegung: 0,
    hotel: 0,
    inserat: 0,
    gericht: 0,
    telefon: 10,
    sonst_kosten: 0,

    // 5.0 AfA Gebäude — V112 reine Gebäude-AfA (ohne Küche)
    // V227: + § 7b Sonder-AfA (wirkt nur in den ersten 4 Jahren)
    afa: afaGebaeude + afaSonder7bJahr,

    // 6.0 AfA bewegliche Wirtschaftsgüter
    // V31: Möblierung → 10 Jahre AfA
    // V112: + Küche-AfA (vorher fälschlich in afa-Feld → Doppelung)
    sonst_bewegl_wg: moeblThisYear + afaKueche,

    // 6.5 Anschaffungsnahe Herstellkosten / Erhaltungsaufwand
    // V31: Sanierung → je nach 15%-Grenze entweder als anschaffungsnah (AfA) oder als Erhaltungsaufwand (5 Jahre)
    anschaffungsnah:    sanAnschaffungsnah ? sanThisYear : 0,
    erhaltungsaufwand: !sanAnschaffungsnah ? sanThisYear : 0,

    // 7.0 Einnahmen
    einnahmen_km: einnahmen_km,
    einnahmen_nk: einnahmen_nk
  };
}

function _getEffectiveValue(year, field, autoVal) {
  var ov = _getYearOverride(year, field);
  return ov !== undefined ? ov : autoVal;
}

/**
 * Compute the year totals (Verlust/Überschuss + Steuer) using overrides where present.
 */
function _computeYearTotal(year, yearIdx) {
  var auto = _computeAutoForYear(yearIdx, year);
  var fields = [
    'schuldzinsen', 'kontofuehrung', 'bereitstellung', 'notar_grundschuld',
    'vermittlung', 'finanz_sonst',
    'nk_umlf', 'nk_n_umlf', 'betr_sonst',
    'hausverwaltung', 'steuerber', 'porto', 'verw_sonst',
    'fahrtkosten', 'verpflegung', 'hotel', 'inserat', 'gericht', 'telefon',
    'sonst_kosten', 'afa', 'sonst_bewegl_wg',
    'anschaffungsnah', 'erhaltungsaufwand',
    'einnahmen_km', 'einnahmen_nk'
  ];
  var values = {};
  fields.forEach(function(f) {
    values[f] = _getEffectiveValue(year, f, auto[f]);
  });

  // Werbungskosten — umlagefähige NK ist Teil davon (Excel-Logik: durchlaufender Posten)
  var werbungskosten =
    values.schuldzinsen + values.kontofuehrung + values.bereitstellung +
    values.notar_grundschuld + values.vermittlung + values.finanz_sonst +
    values.nk_umlf + values.nk_n_umlf + values.betr_sonst +
    values.hausverwaltung + values.steuerber + values.porto + values.verw_sonst +
    values.fahrtkosten + values.verpflegung + values.hotel + values.inserat +
    values.gericht + values.telefon + values.sonst_kosten +
    values.afa + values.sonst_bewegl_wg +
    (values.anschaffungsnah || 0) + (values.erhaltungsaufwand || 0);

  // Einnahmen V+V = Kaltmiete + Nebenkosten umlagefähig
  var einnahmen = values.einnahmen_km + values.einnahmen_nk;

  var ergebnis = einnahmen - werbungskosten;

  // Steuer: zvE base + ergebnis
  // V275-tax-cards-zve: Jahr-spezifisches zvE aus DealPilotTaxPeriods

  var baseIncome = null;

  try {

    if (window.DealPilotTaxPeriods && typeof DealPilotTaxPeriods.getForDateSync === 'function' && typeof year === 'number') {

      var _per_v275 = DealPilotTaxPeriods.getForDateSync(year + '-06-15');

      if (_per_v275 && typeof _per_v275.zve === 'number' && _per_v275.zve > 0) baseIncome = _per_v275.zve;

    }

  } catch(_) {}

  if (baseIncome === null) baseIncome = parseDe((document.getElementById('zve') || {}).value) || 65891;
  var impact = Tax.calcImmoTaxImpact(baseIncome, ergebnis);

  return {
    auto: auto,
    values: values,
    werbungskosten: werbungskosten,
    einnahmen: einnahmen,
    ergebnis: ergebnis,
    refund: impact.refund,
    taxDelta: impact.taxDelta
  };
}

/**
 * Render the yearly tax form.
 * Two modes: 'quick' (collapsed grid) and 'detail' (full Excel-like form per year).
 */
function renderYearlyTaxForm() {
  var box = document.getElementById('yearly-tax-form-box');
  if (!box) return;
  if (!State.cfRows || !State.cfRows.length) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px">Bitte erst Werte eingeben</div>';
    return;
  }

  var mode = window._taxFormMode || 'quick';
  var startYear = _v269_getStartYear(); // V269a1
  var years = [];
  var nYears = Math.min(15, State.cfRows.length);
  for (var i = 0; i < nYears; i++) years.push({ idx: i, year: startYear + i });

  var html =
    '<div class="ytf-toolbar">' +
      '<div class="ytf-mode-toggle">' +
        '<button class="ytf-mode-btn ' + (mode === 'quick' ? 'active' : '') + '" onclick="setTaxFormMode(\'quick\')">Quick-Modus</button>' +
        '<button class="ytf-mode-btn ' + (mode === 'detail' ? 'active' : '') + '" onclick="setTaxFormMode(\'detail\')">Detail-Modus</button>' +
      '</div>' +
      '<button class="btn btn-outline btn-sm" onclick="resetAllTaxOverrides()" title="Alle manuellen Eingaben zurücksetzen">↺ Vorschläge wiederherstellen</button>' +
    '</div>';

  if (mode === 'quick') {
    html += _renderQuickForm(years);
  } else {
    html += _renderDetailForm(years);
  }

  box.innerHTML = html;
}

function setTaxFormMode(m) {
  window._taxFormMode = m;
  renderYearlyTaxForm();
}

function resetAllTaxOverrides() {
  if (!confirm('Alle manuellen Jahres-Eingaben zurücksetzen?')) return;
  window._taxYearlyOverrides = {};
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  toast('✓ Alle Vorschläge wiederhergestellt');
}

function _renderQuickForm(years) {
  var html = '<div class="ytf-quick-wrap"><table class="ytf-table"><thead><tr>' +
    '<th>Jahr</th>' +
    '<th class="num">Einnahmen V+V</th>' +
    '<th class="num">Schuldzinsen</th>' +
    '<th class="num">AfA</th>' +
    '<th class="num">Bewirtschaftung</th>' +
    '<th class="num">Sonstige WK</th>' +
    '<th class="num ytf-result">= Verlust/Überschuss</th>' +
    '<th class="num ytf-result">Steuer-Effekt</th>' +
    '</tr></thead><tbody>';

  years.forEach(function(y) {
    var totals = _computeYearTotal(y.year, y.idx);
    var v = totals.values;
    var bewirt = v.nk_n_umlf + v.betr_sonst;
    var sonst = v.kontofuehrung + v.bereitstellung + v.notar_grundschuld +
                v.vermittlung + v.finanz_sonst + v.hausverwaltung + v.steuerber +
                v.porto + v.verw_sonst + v.fahrtkosten + v.verpflegung +
                v.hotel + v.inserat + v.gericht + v.telefon + v.sonst_kosten +
                v.sonst_bewegl_wg;

    // V63.58: Math.round().toLocaleString() liefert für negative Zahlen "-1.701", für
    // positive "1.701" → wir hängen nur bei positiven manuell ein '+' davor (Minus ist schon da).
    var refundColor = totals.refund >= 0 ? 'var(--green)' : 'var(--red)';
    var refundSign = totals.refund > 0 ? '+' : '';
    var ergSign = totals.ergebnis > 0 ? '+' : '';

    html += '<tr>' +
      '<td class="ytf-year">' + y.year + '</td>' +
      _ytfCell(y.year, 'einnahmen_km', v.einnahmen_km, totals.auto.einnahmen_km) +
      _ytfCell(y.year, 'schuldzinsen', v.schuldzinsen, totals.auto.schuldzinsen) +
      _ytfCell(y.year, 'afa', v.afa, totals.auto.afa) +
      _ytfCellComputed(bewirt) +
      _ytfCellComputed(sonst) +
      '<td class="num ytf-result" style="color:' + (totals.ergebnis >= 0 ? 'var(--gold-d)' : 'var(--green)') + '">' +
        ergSign + Math.round(totals.ergebnis).toLocaleString('de-DE') + ' €</td>' +
      '<td class="num ytf-result" style="color:' + refundColor + ';font-weight:700">' +
        refundSign + Math.round(totals.refund).toLocaleString('de-DE') + ' €</td>' +
    '</tr>';
  });

  html += '</tbody></table></div>' +
    '<p class="hint" style="margin-top:8px">' +
      '💡 Klicke ein Feld an, um den App-Vorschlag manuell zu überschreiben (z.B. tatsächliche Werbungskosten lt. Steuerbescheid). ' +
      'Der Pfeil ↺ neben einem überschriebenen Wert setzt ihn auf den Vorschlag zurück.' +
    '</p>';

  return html;
}

function _renderDetailForm(years) {
  // Show one year at a time with a year selector
  var selected = window._detailYearIdx;
  if (selected == null || selected >= years.length) selected = 0;

  var y = years[selected];
  var totals = _computeYearTotal(y.year, y.idx);
  var v = totals.values;

  var html = '<div class="ytf-detail-wrap">' +
    '<div class="ytf-year-selector">' +
      '<label>Veranlagungsjahr: </label>' +
      '<select onchange="window._detailYearIdx=parseInt(this.value);renderYearlyTaxForm()">';
  years.forEach(function(yy, i) {
    html += '<option value="' + i + '"' + (i === selected ? ' selected' : '') + '>' + yy.year + '</option>';
  });
  html += '</select></div>';

  // Hilfetexte zu jedem Feld (Punkt 8)
  var helpTexts = {
    schuldzinsen: 'Zinsen für das Immobiliendarlehen (ohne Tilgung). Werden lt. Tilgungsplan automatisch berechnet, können aber überschrieben werden.',
    kontofuehrung: 'Kosten für ein separates Konto, das nur für die Immobilie geführt wird. Pauschal i.d.R. 8-12 €/Jahr.',
    bereitstellung: 'Bereitstellungszinsen für noch nicht abgerufene Darlehen. Üblich: 3% p.a. nach 3-12 zinsfreien Monaten.',
    notar_grundschuld: 'Anteilige Notarkosten für die Bestellung der Grundschuld (NICHT die Kaufvertrag-Notarkosten - die gehören zu Anschaffungskosten).',
    vermittlung: 'Provision an einen Finanzierungsvermittler oder -berater (z.B. Interhyp, Dr. Klein).',
    finanz_sonst: 'Weitere finanzierungsbezogene Kosten (z.B. Wertgutachten für die Bank).',
    nk_n_umlf: 'Betriebskosten, die NICHT auf den Mieter umgelegt werden können (z.B. Hausverwaltung, Bankgebühren, Reparaturen).',
    betr_sonst: 'Weitere Betriebskosten, die nicht in andere Kategorien passen.',
    hausverwaltung: 'Kosten der Hausverwaltung / Mietsonderverwaltung (NICHT umlagefähige Anteile).',
    steuerber: 'Anteilige Steuerberatungskosten für die V+V-Anlage (Anlage V).',
    porto: 'Porto, Briefumschläge, Büromaterial im Zusammenhang mit der Vermietung.',
    verw_sonst: 'Sonstige Verwaltungskosten.',
    fahrtkosten: 'Fahrten zur Immobilie. Nachweispflichtig: 0,30 €/km mit eigenem PKW oder Bahn-Ticket.',
    verpflegung: 'Verpflegungsmehraufwand bei mehrtägiger Anreise (Pauschalen 14/28 € je nach Dauer).',
    hotel: 'Übernachtungskosten bei Anreise (Hotel, Pension, Camping mit Beleg).',
    inserat: 'Kosten für Vermietungsanzeigen (Immoscout24, Print, etc.).',
    gericht: 'Gerichts-, Anwalts- oder Mahnkosten (z.B. Räumungsklage, Streitigkeiten).',
    telefon: 'Telefon-/Internetkosten anteilig für die Vermietungstätigkeit.',
    sonst_kosten: 'Sonstige Kosten (Strom-/Gas-Kosten bei Leerstand, Reparaturen unter 4.000 €, etc.).',
    afa: 'Jährliche Abschreibung des Gebäudes (i.d.R. 2% linear vom Gebäudeanteil der Anschaffungskosten).',
    sonst_bewegl_wg: 'Bewegliche Wirtschaftsgüter (Einbauküche, Möbel) abschreibbar über 10 Jahre.',
    anschaffungsnah: 'Sanierungskosten in den ersten 3 Jahren NACH Anschaffung. Wenn > 15% des Gebäudewerts → werden zu Anschaffungskosten und nur über AfA abgeschrieben (NICHT direkt absetzbar). § 6 Abs. 1 Nr. 1a EStG.',
    erhaltungsaufwand: 'Reparaturen / Erhaltungsmaßnahmen NACH den ersten 3 Jahren. Direkt absetzbar im Jahr der Zahlung. Bei größeren Beträgen Verteilung über 2-5 Jahre möglich (§ 82b EStDV).',
    einnahmen_km: 'Kaltmiete (= Nettokaltmiete + zus. Einnahmen wie Stellplatz). Wird automatisch aus Tab "Miete & Steuern" übernommen.',
    einnahmen_nk: 'Umlagefähige Nebenkosten (durchlaufender Posten). Werden automatisch aus Tab "Bewirtschaftung" übernommen.'
  };

  // Group sections wie Excel-Steuerformular (Punkt 6)
  var sections = [
    {
      title: '1.0 Finanzierungskosten',
      rows: [
        { f: 'schuldzinsen', l: 'Schuldzinsen' },
        { f: 'kontofuehrung', l: 'Kontoführungsgebühren' },
        { f: 'bereitstellung', l: 'Bereitstellungszinsen' },
        { f: 'notar_grundschuld', l: 'Notar/Grundschuld (anteilig)' },
        { f: 'vermittlung', l: 'Vermittlungsprovision Darlehen' },
        { f: 'finanz_sonst', l: 'Sonstiges' }
      ]
    },
    {
      title: '2.0 Betriebskosten',
      rows: [
        { f: 'nk_n_umlf', l: 'Nicht-umlagefähige Nebenkosten' },
        { f: 'betr_sonst', l: 'Sonstige Betriebskosten' }
      ]
    },
    {
      title: '3.0 Verwaltungskosten',
      rows: [
        { f: 'hausverwaltung', l: 'Hausverwaltung / Mietsonderverwaltung' },
        { f: 'steuerber', l: 'Steuerberatung' },
        { f: 'porto', l: 'Porto, Büromaterial' },
        { f: 'verw_sonst', l: 'Sonstiges' }
      ]
    },
    {
      title: '4.0 Sonstige Kosten',
      rows: [
        { f: 'fahrtkosten', l: 'Fahrtkosten zur Immobilie' },
        { f: 'verpflegung', l: 'Verpflegungsmehraufwand' },
        { f: 'hotel', l: 'Übernachtungskosten' },
        { f: 'inserat', l: 'Inseratskosten' },
        { f: 'gericht', l: 'Gerichts-/Anwaltskosten' },
        { f: 'telefon', l: 'Telefon/Internet' },
        { f: 'sonst_kosten', l: 'Sonstiges (Leerstand etc.)' }
      ]
    },
    {
      title: '5.0 AfA Gebäude',
      rows: [
        { f: 'afa', l: 'AfA-Betrag (linear 2%)' }
      ]
    },
    {
      title: '6.0 AfA bewegliche Wirtschaftsgüter',
      rows: [
        { f: 'sonst_bewegl_wg', l: 'Bewegliche Wirtschaftsgüter (10 J.)' }
      ]
    },
    {
      title: '6.5 Anschaffungsnahe Herstellkosten / Erhaltungsaufwand (Punkt 6)',
      rows: [
        { f: 'anschaffungsnah', l: 'Anschaffungsnahe Herstellkosten (§6 EStG)' },
        { f: 'erhaltungsaufwand', l: 'Erhaltungsaufwendungen (nach 3 J.)' }
      ]
    },
    {
      title: '7.0 Einnahmen (Punkt 9, 10: read-only - übernommen)',
      rows: [
        { f: 'einnahmen_km', l: 'Kaltmiete', readonly: true },
        { f: 'einnahmen_nk', l: 'Nebenkosten (umlagefähig)', readonly: true }
      ]
    }
  ];

  sections.forEach(function(sec) {
    html += '<div class="ytf-section"><div class="ytf-section-title">' + sec.title + '</div>' +
      '<table class="ytf-section-table"><tbody>';
    sec.rows.forEach(function(r) {
      var auto = totals.auto[r.f] || 0;
      var val = v[r.f] != null ? v[r.f] : auto;
      var help = helpTexts[r.f] || '';
      var labelHtml = r.l;
      if (help) {
        labelHtml += ' <span class="ytf-help" title="' + help.replace(/"/g, '&quot;') + '">ℹ</span>';
      }
      html += '<tr><td class="ytf-section-label">' + labelHtml + '</td>' +
        '<td class="num">' +
          (r.readonly ? _ytfReadonlyValue(val) : _ytfDetailInput(y.year, r.f, val, auto)) +
        '</td>' +
        '<td class="ytf-bemerkung-cell">' +
          _ytfBemerkungInput(y.year, r.f) +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
  });

  // Summary box
  var refundColor = totals.refund >= 0 ? 'var(--green)' : 'var(--red)';
  html += '<div class="ytf-summary">' +
    '<div class="ytf-sum-row"><span>Werbungskosten gesamt:</span><span class="num">' +
      Math.round(totals.werbungskosten).toLocaleString('de-DE') + ' €</span></div>' +
    '<div class="ytf-sum-row"><span>Einnahmen V+V:</span><span class="num">' +
      Math.round(totals.einnahmen).toLocaleString('de-DE') + ' €</span></div>' +
    '<div class="ytf-sum-row ytf-sum-result"><span><b>Verlust/Überschuss V+V:</b></span><span class="num"><b>' +
      (totals.ergebnis >= 0 ? '+' : '') + Math.round(totals.ergebnis).toLocaleString('de-DE') + ' €</b></span></div>' +
    '<div class="ytf-sum-row" style="color:' + refundColor + '"><span><b>Steuer-Effekt:</b></span><span class="num"><b>' +
      (totals.refund >= 0 ? '+' : '') + Math.round(totals.refund).toLocaleString('de-DE') + ' €</b></span></div>' +
    '</div>';

  html += '</div>';
  return html;
}

function _ytfCell(year, field, val, auto) {
  var override = _getYearOverride(year, field);
  var isOverride = override !== undefined;
  return '<td class="num ytf-cell ' + (isOverride ? 'ytf-overridden' : '') + '">' +
    '<div class="ytf-input-wrap">' +
      '<input type="number" step="1" value="' + Math.round(val) + '"' +
        ' data-year="' + year + '" data-field="' + field + '"' +
        ' onchange="updateTaxOverride(this)" />' +
      (isOverride ? '<button class="ytf-reset" onclick="resetTaxOverride(\'' + year + '\',\'' + field + '\')" title="Auf Vorschlag zurücksetzen (' + Math.round(auto).toLocaleString('de-DE') + ' €)">↺</button>' : '') +
    '</div>' +
  '</td>';
}

function _ytfDetailInput(year, field, val, auto) {
  var override = _getYearOverride(year, field);
  var isOverride = override !== undefined;
  return '<div class="ytf-input-wrap">' +
    '<input type="number" step="1" value="' + Math.round(val) + '"' +
      ' data-year="' + year + '" data-field="' + field + '"' +
      ' onchange="updateTaxOverride(this)" />' +
    (isOverride ?
      '<button class="ytf-reset" onclick="resetTaxOverride(\'' + year + '\',\'' + field + '\')" title="Vorschlag: ' + Math.round(auto).toLocaleString('de-DE') + ' €">↺</button>'
      : '<span class="ytf-auto-hint" title="App-Vorschlag">●</span>') +
  '</div>';
}

function _ytfCellComputed(val) {
  return '<td class="num ytf-computed">' + Math.round(val).toLocaleString('de-DE') + ' €</td>';
}

function updateTaxOverride(input) {
  var year = parseInt(input.dataset.year);
  var field = input.dataset.field;
  var rawVal = input.value;
  var val = rawVal === '' ? undefined : parseFloat(rawVal);

  // V24-Fix: Wenn der User den Wert NICHT geändert hat (gleich dem Auto-Wert
  // oder leer), KEIN Override setzen. Verhindert, dass beim Tab-durchgehen
  // versehentlich überall "0" als sticky Override hängenbleibt.
  if (val !== undefined && State && State.cfRows) {
    try {
      // Auto-Wert für dieses Feld neu berechnen
      var yearIdx = -1;
      var startYear = _v269_getStartYear(); // V269a1 (Bug: .year war undefined)
      yearIdx = year - startYear;
      if (yearIdx >= 0 && yearIdx < State.cfRows.length) {
        var auto = _computeAutoForYear(yearIdx, year);
        var autoVal = auto[field];
        if (autoVal !== undefined && Math.round(val) === Math.round(autoVal)) {
          // Wert entspricht Auto-Vorschlag → KEIN Override, bestehenden löschen
          val = undefined;
        }
      }
    } catch (e) { /* fallback: normal speichern */ }
  }

  _setYearOverride(year, field, val);
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  if (typeof calc === 'function') setTimeout(calc, 50);
}

function resetTaxOverride(year, field) {
  _setYearOverride(parseInt(year), field, undefined);
  renderYearlyTaxForm();
  if (typeof renderTaxTimeline === 'function') renderTaxTimeline();
  if (typeof calc === 'function') setTimeout(calc, 50);
}

/**
 * V110 BUG-FIX: Doppelung entfernt — die Original renderTaxTimeline (Z. 246) nutzt jetzt
 * selbst _computeYearTotal() und ist damit konsistent zum Steuerformular pro Jahr.
 * Vorher gab's eine Override hier die fast identisch war (auch _computeYearTotal nutzte),
 * aber mit subtil anderem Aufbau (startYear=heute statt r.cal). Beide Versionen sollten
 * identische Ergebnisse liefern, aber die Doppelung war Source of Bugs — wenn jemand die
 * eine änderte, drifteten sie auseinander.
 *
 * Wichtig: Die Original-Funktion ruft am Ende NICHT renderYearlyTaxForm() auf — die
 * Override tat das. Wir machen das jetzt explizit hier, aber als kleine Brücke statt
 * Re-Implementierung.
 */
var _origRenderTaxTimeline_V110 = renderTaxTimeline;
renderTaxTimeline = function() {
  _origRenderTaxTimeline_V110();
  // Yearly-Form mit derselben Quelle nachziehen
  if (typeof renderYearlyTaxForm === 'function') {
    try { renderYearlyTaxForm(); } catch(e) { /* ok */ }
  }
};

// ═══════════════════════════════════════════════════
// Grenzsteuersatz automatisch aus zvE (Punkt 2)
// ═══════════════════════════════════════════════════
function onGrenzAutoToggle() {
  var auto = document.getElementById('grenz_auto');
  var grenzInput = document.getElementById('grenz');
  if (!auto || !grenzInput) return;
  if (auto.checked) {
    var zve = parseDe((document.getElementById('zve') || {}).value) || 0;
    if (zve > 0) {
      var gss = Tax.calcGrenzsteuersatz(zve) * 100;
      grenzInput.value = gss.toFixed(2);
      grenzInput.disabled = true;
      grenzInput.style.background = 'rgba(201,168,76,0.12)';
      if (typeof toast === 'function') toast('✓ Grenzsteuersatz aus zvE berechnet: ' + gss.toFixed(2) + ' %');
    }
  } else {
    grenzInput.disabled = false;
    grenzInput.style.background = '';
  }
  if (typeof calcNow === 'function') calcNow();
}

// Hook zvE input to update Grenz when auto is on
document.addEventListener('DOMContentLoaded', function() {
  var zveInp = document.getElementById('zve');
  if (zveInp) {
    zveInp.addEventListener('input', function() {
      var auto = document.getElementById('grenz_auto');
      if (auto && auto.checked) {
        onGrenzAutoToggle();
      }
    });
  }
});

// ═══════════════════════════════════════════════════
// Steuerprogression-Chart (vor / nach Investition)
// ═══════════════════════════════════════════════════
function showProgressionChart() {
  // V248-02: Funktion deaktiviert (Card aus HTML entfernt)
  return;

  // Remove existing if any
  var existing = document.getElementById('progression-modal');
  if (existing) existing.remove();

  var zve = parseDe((document.getElementById('zve') || {}).value) || 65891;
  // Estimate immo result for "after investment" scenario - use first year tax data
  var immoResult = 0;
  if (State.cfRows && State.cfRows.length) {
    var year1 = State.cfRows[0];
    var afa = State.kpis ? (State.kpis.afa || 0) : 0;
    immoResult = year1.wm_y - year1.bwk_y - year1.zy - afa;
  }

  // Build chart data: zvE on X, ESt on Y
  // Range: 0 to zve+50000
  var maxZve = Math.max(zve + 50000, 120000);
  var step = 1000;
  var labels = [];
  var taxBefore = [];
  var taxAfter = [];
  for (var z = 0; z <= maxZve; z += step) {
    labels.push(z);
    taxBefore.push(Tax.calcEStG(z));
    taxAfter.push(Tax.calcEStG(Math.max(0, z + immoResult)));
  }

  var modal = document.createElement('div');
  modal.id = 'progression-modal';
  modal.className = 'global-view-overlay';
  modal.innerHTML =
    '<div class="global-view-modal" style="max-width:900px">' +
      '<button class="pricing-close" onclick="document.getElementById(\'progression-modal\').remove()">×</button>' +
      '<h2>📈 Steuerprogression · vor und nach Investition</h2>' +
      '<p style="color:var(--muted);font-size:12.5px;margin-bottom:14px">' +
        'Vergleich der Einkommensteuer (EStG-Tarif 2026) ohne und mit Berücksichtigung des Vermietungsergebnisses.' +
        ' Aktueller zvE: <b>' + zve.toLocaleString('de-DE') + ' €</b>, Verlust V+V: <b>' + Math.round(immoResult).toLocaleString('de-DE') + ' €</b>' +
      '</p>' +
      '<div style="position:relative;height:380px"><canvas id="progressionCanvas"></canvas></div>' +
      '<div class="prog-legend">' +
        '<div class="prog-legend-item"><span class="prog-dot" style="background:#999"></span> ESt VOR Investition</div>' +
        '<div class="prog-legend-item"><span class="prog-dot" style="background:var(--gold)"></span> ESt NACH Investition</div>' +
        '<div class="prog-legend-item"><span class="prog-dot" style="background:var(--green);border-radius:0;width:12px;height:2px;align-self:center"></span> Aktueller zvE-Punkt</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  // Render chart
  setTimeout(function() {
    var ctx = document.getElementById('progressionCanvas');
    if (!ctx || typeof Chart === 'undefined') return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.map(function(l) { return Math.round(l/1000) + 'k'; }),
        datasets: [
          {
            label: 'ESt VOR Investition',
            data: taxBefore,
            borderColor: '#999',
            backgroundColor: 'rgba(150,150,150,0.10)',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'ESt NACH Investition',
            data: taxAfter,
            borderColor: '#C9A84C',
            backgroundColor: 'rgba(201,168,76,0.18)',
            borderWidth: 2.5,
            tension: 0.1,
            pointRadius: 0,
            fill: '-1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + Math.round(ctx.raw).toLocaleString('de-DE') + ' €';
              }
            }
          },
          annotation: {
            annotations: {
              currentZve: {
                type: 'line',
                xMin: zve / step,
                xMax: zve / step,
                borderColor: '#2A9A5A',
                borderWidth: 2,
                borderDash: [4, 4],
                label: { content: 'Dein zvE', enabled: true, position: 'start' }
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'zu versteuerndes Einkommen (€)' } },
          y: {
            title: { display: true, text: 'Einkommensteuer (€)' },
            ticks: { callback: function(v) { return Math.round(v/1000) + 'k'; } }
          }
        }
      }
    });
  }, 100);
}

function _ytfReadonlyValue(val) {
  return '<div class="ytf-readonly" title="Wird automatisch übernommen">' +
    Math.round(val).toLocaleString('de-DE') + ' €' +
  '</div>';
}

function _ytfBemerkungInput(year, field) {
  var note = '';
  try {
    var key = _yearKey(year);
    if (window._taxYearlyBemerkungen && window._taxYearlyBemerkungen[key]) {
      note = window._taxYearlyBemerkungen[key][field] || '';
    }
  } catch(e) {}
  return '<input type="text" class="ytf-bemerkung-input" placeholder="Bemerkung..." value="' +
    (note || '').replace(/"/g, '&quot;') + '" data-year="' + year + '" data-field="' + field +
    '" onchange="updateTaxBemerkung(this)" />';
}

function updateTaxBemerkung(input) {
  if (!window._taxYearlyBemerkungen) window._taxYearlyBemerkungen = {};
  var year = parseInt(input.dataset.year);
  var field = input.dataset.field;
  var key = _yearKey(year);
  if (!window._taxYearlyBemerkungen[key]) window._taxYearlyBemerkungen[key] = {};
  window._taxYearlyBemerkungen[key][field] = input.value;
}

// V277.3-expose-yt: _computeYearTotal als window-Funktion verfuegbar fuer calc.js
if (typeof _computeYearTotal === 'function' && typeof window !== 'undefined') {
  window._computeYearTotal = _computeYearTotal;
}


/* ═══════════════════════════════════════════════════════════════
   V286 — Bestand-Overlay (>5 Objekte): Suche, Sortierung, Schließen
   ═══════════════════════════════════════════════════════════════ */
(function(){
  if (window._taxBestandOverlayInit) return;
  window._taxBestandOverlayInit = true;

  var fmtVal = function(n) { return (n >= 0 ? '+' : '') + n.toLocaleString('de-DE') + ' €'; };
  var fmtDate = function(s) {
    if (!s || s.length < 10) return '';
    var parts = s.substring(0, 10).split('-');
    if (parts.length !== 3) return s;
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  };
  var escHtml = function(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var _state = { sortKey: 'kaufdat', sortDir: 'asc', query: '' };

  function renderRows() {
    var data = window._taxBestandData;
    if (!data || !data.list) return '';
    var list = data.list.slice();
    /* Filter */
    var q = _state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(function(o) {
        var hay = (o.name || '') + ' ' + (o.address || '') + ' ' + (o.objName || '') + ' ' + (o.kaufdat || '') + ' ' + (o.value || 0);
        return hay.toLowerCase().indexOf(q) >= 0;
      });
    }
    /* Sort */
    list.sort(function(a, b) {
      var av, bv;
      if (_state.sortKey === 'value') { av = a.value || 0; bv = b.value || 0; }
      else if (_state.sortKey === 'kaufdat') { av = a.kaufdat || ''; bv = b.kaufdat || ''; }
      else if (_state.sortKey === 'address') { av = (a.address || a.name || '').toLowerCase(); bv = (b.address || b.name || '').toLowerCase(); }
      else { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); }
      if (av < bv) return _state.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return _state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    if (list.length === 0) {
      return '<div class="tax-bestand-overlay-empty">Keine Treffer für “' + escHtml(_state.query) + '”</div>';
    }
    return list.map(function(o) {
      var vColor = o.value < 0 ? 'c-red' : (o.value > 0 ? 'c-green' : '');
      return '<tr>'
           + '<td class="tax-bo-name">' + escHtml(o.name) + '</td>'
           + '<td class="tax-bo-date">' + escHtml(fmtDate(o.kaufdat)) + '</td>'
           + '<td class="tax-bo-addr">' + escHtml(o.address || o.objName || '—') + '</td>'
           + '<td class="tax-bo-val ' + vColor + '">' + fmtVal(o.value) + '</td>'
           + '</tr>';
    }).join('');
  }

  function updateBody() {
    var tbody = document.getElementById('tax-bestand-overlay-tbody');
    if (tbody) tbody.innerHTML = renderRows();
    var sortArrows = document.querySelectorAll('#tax-bestand-overlay th[data-sort]');
    sortArrows.forEach(function(th) {
      var key = th.getAttribute('data-sort');
      var arrow = th.querySelector('.tax-bo-arrow');
      if (!arrow) return;
      if (key === _state.sortKey) {
        arrow.textContent = _state.sortDir === 'asc' ? ' ▴' : ' ▾';
      } else {
        arrow.textContent = '';
      }
    });
  }

  function buildOverlay() {
    var data = window._taxBestandData;
    if (!data) return null;
    var ov = document.createElement('div');
    ov.id = 'tax-bestand-overlay';
    ov.className = 'tax-bestand-overlay';
    ov.innerHTML =
      '<div class="tax-bestand-overlay-panel" role="dialog" aria-modal="true" aria-label="Liste Bestandsobjekte">'
      + '<div class="tax-bestand-overlay-head">'
      +   '<div class="tax-bestand-overlay-title">'
      +     'Bestandsobjekte <span class="tax-bo-count">' + data.list.length + '</span>'
      +     '<span class="tax-bo-year">(Berechnung für ' + data.year + ')</span>'
      +   '</div>'
      +   '<button class="tax-bestand-overlay-close" type="button" aria-label="Schließen">×</button>'
      + '</div>'
      + '<div class="tax-bestand-overlay-search">'
      +   '<input id="tax-bestand-overlay-q" type="search" placeholder="Suche (Name, Adresse, Datum, Saldo)…" autocomplete="off" />'
      + '</div>'
      + '<div class="tax-bestand-overlay-tablewrap">'
      +   '<table class="tax-bestand-overlay-table">'
      +     '<thead><tr>'
      +       '<th data-sort="name">Name<span class="tax-bo-arrow"></span></th>'
      +       '<th data-sort="kaufdat">Kaufdatum<span class="tax-bo-arrow"></span></th>'
      +       '<th data-sort="address">Adresse<span class="tax-bo-arrow"></span></th>'
      +       '<th data-sort="value" class="tax-bo-th-right">Saldo<span class="tax-bo-arrow"></span></th>'
      +     '</tr></thead>'
      +     '<tbody id="tax-bestand-overlay-tbody"></tbody>'
      +   '</table>'
      + '</div>'
      + '<div class="tax-bestand-overlay-foot">'
      +   '<span class="tax-bo-foot-label">Saldo gesamt</span>'
      +   '<span class="tax-bo-foot-val ' + (data.sum < 0 ? 'c-red' : (data.sum > 0 ? 'c-green' : '')) + '">' + fmtVal(data.sum) + '</span>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    /* Initial render */
    updateBody();
    /* Event-Wires */
    var input = ov.querySelector('#tax-bestand-overlay-q');
    if (input) {
      input.addEventListener('input', function(e) {
        _state.query = e.target.value || '';
        updateBody();
      });
      setTimeout(function(){ try { input.focus(); } catch(_) {} }, 50);
    }
    ov.querySelectorAll('th[data-sort]').forEach(function(th) {
      th.addEventListener('click', function() {
        var key = th.getAttribute('data-sort');
        if (_state.sortKey === key) {
          _state.sortDir = _state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _state.sortKey = key;
          _state.sortDir = (key === 'value') ? 'asc' : 'asc';
        }
        updateBody();
      });
    });
    var closeBtn = ov.querySelector('.tax-bestand-overlay-close');
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);
    /* Klick auf Backdrop (außerhalb Panel) schließt */
    ov.addEventListener('click', function(e) {
      if (e.target === ov) closeOverlay();
    });
    return ov;
  }

  function openOverlay() {
    closeOverlay(); /* falls schon offen */
    /* state default */
    _state = { sortKey: 'kaufdat', sortDir: 'asc', query: '' };
    buildOverlay();
    /* ESC-Listener */
    document.addEventListener('keydown', escHandler);
  }

  function closeOverlay() {
    var ov = document.getElementById('tax-bestand-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeOverlay();
  }

  /* Delegated click: Trigger-Item öffnet Overlay */
  document.addEventListener('click', function(e) {
    var trigger = e.target.closest && e.target.closest('[data-tax-bestand-open]');
    if (trigger) {
      e.preventDefault();
      openOverlay();
    }
  });
  /* Tastatur: Enter/Space auf Trigger */
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = document.activeElement;
    if (t && t.matches && t.matches('[data-tax-bestand-open]')) {
      e.preventDefault();
      openOverlay();
    }
  });

  /* Expose für Debug */
  window._taxBestandOverlay = { open: openOverlay, close: closeOverlay };
})();
