'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT – dealscore.js
   Deal Score 0-100 mit gewichteten Faktoren

   Faktoren (Default-Gewichtung in Settings änderbar):
   - Cashflow:       30%   (CF n.St./Mon. > 200€ = 100pt, < -100 = 0pt)
   - Rendite (NMR):  25%   (NMR > 4.5% = 100, < 2% = 0)
   - LTV:            15%   (LTV < 80% = 100, > 110% = 0)
   - Risiko:         15%   (DSCR > 1.3 = 100, < 0.9 = 0)
   - Potenzial:      15%   (Wertpuffer + Mietpotenzial)

   Output: { score 0-100, color, label, breakdown[], interpretation }
═══════════════════════════════════════════════════ */

var DealScore = (function() {
  // Default weights (sum to 100%) — entspricht "balanced"-Profil
  var DEFAULT_WEIGHTS = {
    cashflow: 30,
    rendite: 25,
    ltv: 15,
    risiko: 15,
    potenzial: 15
  };

  // V108: Preset-basierte Gewichtungen — gekoppelt an DS2-Profile
  // Damit beide Score-Engines (DS1 + DS2) sich in dieselbe Richtung bewegen
  var PRESET_WEIGHTS = {
    balanced: {
      cashflow: 30, rendite: 25, ltv: 15, risiko: 15, potenzial: 15
    },
    conservative: {
      // Mehr auf Cashflow-Sicherheit + LTV + Risiko
      cashflow: 35, rendite: 15, ltv: 20, risiko: 20, potenzial: 10
    },
    optimistic: {
      // Mehr auf Rendite + Upside-Potenzial
      cashflow: 25, rendite: 35, ltv: 10, risiko: 10, potenzial: 20
    }
  };

  function _getActivePreset() {
    try {
      var p = localStorage.getItem('dp_dealscore2_preset');
      if (p && (PRESET_WEIGHTS[p] || p === 'custom')) return p;
    } catch (e) {}
    return 'balanced';
  }

  function _getWeights() {
    var preset = _getActivePreset();
    // V108: Wenn ein Preset aktiv ist (nicht "custom"), nutze die Preset-Gewichtungen
    if (preset !== 'custom' && PRESET_WEIGHTS[preset]) {
      return PRESET_WEIGHTS[preset];
    }
    // Sonst: gespeicherte User-Gewichte (oder Default)
    try {
      var saved = localStorage.getItem('dp_dealscore_weights');
      if (saved) {
        var w = JSON.parse(saved);
        // Validate sum ~100
        var sum = w.cashflow + w.rendite + w.ltv + w.risiko + w.potenzial;
        if (Math.abs(sum - 100) < 1) return w;
      }
    } catch (e) {}
    return DEFAULT_WEIGHTS;
  }

  function _saveWeights(w) {
    localStorage.setItem('dp_dealscore_weights', JSON.stringify(w));
  }

  // Score components return 0-100
  function _scoreCashflow(cf_ns_monthly) {
    // -200 €/Mon → 0, 0 €/Mon → 50, +200 €/Mon → 100
    if (cf_ns_monthly == null || isNaN(cf_ns_monthly)) return 50;
    var s = 50 + (cf_ns_monthly / 4);
    return Math.max(0, Math.min(100, s));
  }

  function _scoreRendite(nmr_pct) {
    // 2% NMR → 0, 3.5% → 50, 5% → 100
    if (!nmr_pct || isNaN(nmr_pct)) return 50;
    var s = (nmr_pct - 2) * 33.33;
    return Math.max(0, Math.min(100, s));
  }

  function _scoreLtv(ltv_pct) {
    // 70% → 100, 90% → 50, 110% → 0
    if (!ltv_pct || isNaN(ltv_pct)) return 50;
    var s = (110 - ltv_pct) * 2.5;
    return Math.max(0, Math.min(100, s));
  }

  function _scoreRisiko(dscr) {
    // V24: Kalibrierung an globale DSCR-Schwellen (Custom Instructions):
    //   < 1.0 = rot, 1.0–1.2 = gelb, ≥ 1.2 = grün
    // Score-Kurve so, dass die Bar-Farben (>=80 grün, >=60 gelb, sonst rot) matchen:
    //   DSCR ≤ 0.9 → 0
    //   DSCR  1.0  → 60 (gelb-Anfang)
    //   DSCR  1.2  → 80 (grün-Schwelle)
    //   DSCR  1.5+ → 100
    if (!dscr || isNaN(dscr)) return 50;
    if (dscr <= 0.9) return 0;
    if (dscr >= 1.5) return 100;
    if (dscr <= 1.2) {
      // 0.9 → 0, 1.0 → 60, 1.2 → 80
      if (dscr <= 1.0) return ((dscr - 0.9) / 0.1) * 60;
      return 60 + ((dscr - 1.0) / 0.2) * 20;
    }
    // 1.2 → 80, 1.5 → 100
    return 80 + ((dscr - 1.2) / 0.3) * 20;
  }

  function _scorePotenzial(wertpuffer, kp, mietsteig_pct) {
    // Wertpuffer relativ zu KP: 0% → 30, 10% → 60, 20%+ → 90
    // Mietsteigerung > 1.5% → +10
    if (!kp) return 50;
    var puffer_pct = (wertpuffer / kp) * 100;
    var s = 30 + Math.min(60, puffer_pct * 3);
    if (mietsteig_pct > 1.5) s += 10;
    return Math.max(0, Math.min(100, s));
  }

  /**
   * Compute Deal Score from State.kpis.
   * V63.32: QC-Heuristik-Pfad ENTFERNT.
   * Der hatte qcNmrPct = qcBmrPct * 0.7 und qcCfM = nkm - annuitaet — beides
   * stark vereinfacht und nicht konsistent mit der echten DealKpis-Pipeline.
   * Folge: Tab Kennzahlen zeigte 79 statt 56, weil compute() die kaputten QC-Werte
   * statt State.kpis (echte Werte aus calc.js) genommen hat.
   * Seit V63.30 nutzt qcCalc selbst DealKpis.compute() → Score-Konsistenz ist
   * über die identische Formel-Pipeline gesichert, kein Heuristik-Pfad nötig.
   */
  function compute() {
    if (!State || !State.kpis || !State.kpis.kp) {
      return { score: 0, color: 'gray', label: 'Keine Daten', interpretation: 'Bitte Werte eingeben.', breakdown: [] };
    }
    var K = State.kpis;
    var mstg = parseDe((document.getElementById('mietstg') || {}).value) || 1.5;
    return computeFromKpis({
      kp: K.kp || 1,
      cf_m: K.cf_m || 0,
      nmy: K.nmy || 0,
      ltv: K.ltv || 0,
      dscr: K.dscr || 0,
      wp_kpi: K.wp_kpi || 0,
      mstg: mstg
    });
  }

  /**
   * V62: Score-Berechnung mit eigenen KPI-Werten (für Quick-Check).
   * Gleiche Logik wie compute(), aber liest nicht aus State.kpis.
   */
  function computeFromKpis(kpis) {
    var K = kpis || {};
    if (!K.kp) {
      return { score: 0, color: 'gray', label: 'Keine Daten', interpretation: 'Bitte Werte eingeben.', breakdown: [] };
    }
    var weights = _getWeights();
    var cf_m = K.cf_m || 0;
    var nmr = K.nmy || 0;
    var ltv = K.ltv || 0;
    var dscr = K.dscr || 0;
    var wp = K.wp_kpi || 0;
    var kp = K.kp || 1;
    var mstg = K.mstg || 1.5;

    var components = [
      { key: 'cashflow', label: 'Cashflow', weight: weights.cashflow, score: _scoreCashflow(cf_m), input: cf_m.toFixed(0) + ' €/Mon' },
      { key: 'rendite', label: 'Rendite (NMR)', weight: weights.rendite, score: _scoreRendite(nmr), input: nmr.toFixed(2) + ' %' },
      { key: 'ltv', label: 'LTV', weight: weights.ltv, score: _scoreLtv(ltv), input: ltv.toFixed(1) + ' %' },
      { key: 'risiko', label: 'Risiko (DSCR)', weight: weights.risiko, score: _scoreRisiko(dscr), input: 'DSCR ' + dscr.toFixed(2) },
      { key: 'potenzial', label: 'Potenzial (Wertpuffer + Miete)', weight: weights.potenzial, score: _scorePotenzial(wp, kp, mstg), input: 'Puffer ' + Math.round(wp).toLocaleString('de-DE') + ' €' }
    ];

    var total = 0;
    components.forEach(function(c) { total += (c.score * c.weight) / 100; });
    var score = Math.round(total);

    var color, label;
    // V63.32: Score-Schwellen identisch zum Quick-Check (gleiche Farbskala für gleiche Werte)
    //   ≥80 → grün-strong "Top Deal"
    //   ≥65 → grün "Gut"
    //   ≥50 → gold "Solide"
    //   <50 → rot "Schwach"
    if (score >= 80)      { color = 'green'; label = 'Top Deal'; }
    else if (score >= 65) { color = 'green'; label = 'Gut'; }
    else if (score >= 50) { color = 'gold';  label = 'Solide'; }
    else                  { color = 'red';   label = 'Schwach'; }

    return {
      score: score,
      color: color,
      label: label,
      breakdown: components,
      interpretation: _interpret(score, components, K),
      weights: weights
    };
  }

  function _interpret(score, components, K) {
    var parts = [];
    var cf_m = K.cf_m || 0;

    // V63.32: Schwellen identisch zu QC (Sehr gut/Gut/Solide/Schwach)
    if (score >= 80) {
      parts.push('Sehr attraktiver Deal');
      if (cf_m > 100) parts.push('mit positivem Cashflow von ' + cf_m.toFixed(0) + ' €/Mon');
      if ((K.nmy || 0) > 4) parts.push('und überdurchschnittlicher Nettomietrendite');
    } else if (score >= 65) {
      parts.push('Guter Deal mit attraktiven Eckdaten');
      if (cf_m < 0) parts.push('Cashflow ist allerdings negativ');
    } else if (score >= 50) {
      parts.push('Solider Deal mit moderatem Risiko');
      if (cf_m < 0) parts.push('Cashflow ist negativ');
      if ((K.ltv || 0) > 95) parts.push('LTV ist hoch');
    } else {
      parts.push('Schwacher Deal');
      if (cf_m < -100) parts.push('mit deutlich negativem Cashflow von ' + cf_m.toFixed(0) + ' €/Mon');
      if ((K.dscr || 99) < 1) parts.push('DSCR unter 1 — operative Einnahmen decken den Schuldendienst nicht');
      if ((K.ltv || 0) > 105) parts.push('LTV über 105% deutet auf Vollfinanzierung hin');
    }

    return parts.join(' ') + '.';
  }

  function setWeights(newWeights) {
    var sum = newWeights.cashflow + newWeights.rendite + newWeights.ltv + newWeights.risiko + newWeights.potenzial;
    if (Math.abs(sum - 100) > 0.5) {
      throw new Error('Summe muss 100% ergeben (aktuell: ' + sum + '%)');
    }
    _saveWeights(newWeights);
  }

  /**
   * V25: Snapshot fürs AI-Prompt — liefert Total + Sub-Scores in dem Format
   * das der neue 7-Abschnitte-Prompt erwartet.
   */
  function snapshot() {
    var K = (typeof State !== 'undefined' && State.kpis) ? State.kpis : {};
    var result = compute(K);
    var snap = {
      total: result.score,
      label: result.label,
      color: result.color
    };
    if (Array.isArray(result.breakdown)) {
      result.breakdown.forEach(function(b) {
        if (b.key === 'cashflow')  snap.cf_score = Math.round(b.score);
        if (b.key === 'rendite')   snap.rendite_score = Math.round(b.score);
        if (b.key === 'ltv')       snap.ltv_score = Math.round(b.score);
        if (b.key === 'risiko')    snap.dscr_score = Math.round(b.score);
        if (b.key === 'potenzial') snap.potenzial_score = Math.round(b.score);
      });
    }
    // Potenzial-Beschreibung aus Inputs
    var w = parseDe((document.getElementById('wertstg') || {}).value) || 0;
    var m = parseDe((document.getElementById('mietstg') || {}).value) || 0;
    snap.potenzial_desc = 'Wertsteigerung ' + w.toFixed(1) + ' % p.a., Mietsteigerung ' + m.toFixed(1) + ' % p.a.';
    return snap;
  }

  return {
    compute: compute,
    computeFromKpis: computeFromKpis,
    setWeights: setWeights,
    getWeights: _getWeights,
    getDefaults: function() { return Object.assign({}, DEFAULT_WEIGHTS); },
    snapshot: snapshot
  };
})();

// ═══════════════════════════════════════════════════
// UI: Deal Score Card (top of object view)
// ═══════════════════════════════════════════════════
// V33: Lucide-style SVG-Icons für DealScore-Karte (inline, keine externen Deps)
var _DS_ICONS = {
  trendingUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
  home:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  coins:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
  pieChart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
  trophy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  scale:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
  alert:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  thumbsDown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>'
};

// Kategorie-Key → Icon-Mapping (matcht zu DealScore.compute() breakdown.label)
function _dsIconFor(label) {
  var l = (label || '').toLowerCase();
  if (l.indexOf('cashflow') >= 0) return _DS_ICONS.trendingUp;
  if (l.indexOf('ltv') >= 0)      return _DS_ICONS.home;
  if (l.indexOf('potenzial') >= 0 || l.indexOf('puffer') >= 0) return _DS_ICONS.coins;
  if (l.indexOf('rendite') >= 0 || l.indexOf('nmr') >= 0) return _DS_ICONS.pieChart;
  if (l.indexOf('risiko') >= 0 || l.indexOf('dscr') >= 0) return _DS_ICONS.shield;
  return _DS_ICONS.trendingUp;
}

// Top-Deal-Badge je nach Score-Stufe
function _dsBadgeFor(label, color) {
  if (label === 'Top Deal' || label === 'TOP DEAL') {
    return { icon: _DS_ICONS.trophy, label: 'TOP DEAL', class: 'ds-badge-top' };
  }
  if (color === 'green') return { icon: _DS_ICONS.trendingUp, label: label.toUpperCase(), class: 'ds-badge-green' };
  if (color === 'gold')  return { icon: _DS_ICONS.scale,      label: label.toUpperCase(), class: 'ds-badge-gold' };
  return { icon: _DS_ICONS.thumbsDown, label: label.toUpperCase(), class: 'ds-badge-red' };
}

function renderDealScore() {
  var box = document.getElementById('dealscore-box');
  if (!box) return;

  // V63.1: WICHTIG — der klassische DealPilot Score (Cashflow/Rendite/LTV/Risiko/Potenzial)
  // wird IMMER angezeigt, nicht erst ab 70%. Die 70%-Sperre gilt NUR für den
  // Investor Deal Score (DS2, 24 KPIs) — siehe renderDealScore2().
  // (V63 hatte das fälschlich umgekehrt.)

  var result = DealScore.compute();

  var ringColor = result.color === 'green' ? '#2FBE6E' :
                  result.color === 'gold' ? '#E5BD53' :
                  result.color === 'red' ? '#D55B5B' : '#999';

  // Donut: 2π·52 ≈ 327
  var circ = 327;
  var dashOffset = circ - (result.score / 100) * circ;

  // Top-Deal-Badge oben rechts
  var badge = _dsBadgeFor(result.label, result.color);

  // V33: Modernes Mockup-Design — dunkler Hintergrund mit goldenem Outline,
  //      großer Donut links, Top-Deal-Card rechts oben, Metriken im Grid darunter.
  box.innerHTML =
    '<div class="ds-mockup">' +

      // Top-Bar: Title links + Top-Deal-Box rechts
      '<div class="ds-top">' +
        '<div class="ds-brand">' +
          '<div class="ds-brand-name">DealPilot <span class="ds-brand-accent">Score</span></div>' +
        '</div>' +
        '<div class="ds-top-deal ' + badge.class + '">' +
          '<div class="ds-top-deal-icon">' + badge.icon + '</div>' +
          '<div class="ds-top-deal-text">' +
            '<div class="ds-top-deal-label">' + badge.label + '</div>' +
            '<div class="ds-top-deal-desc">' + _escClean(result.interpretation) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Mittlerer Bereich: Donut links + Metrik-Grid rechts
      '<div class="ds-middle">' +

        // Donut links
        '<div class="ds-donut-wrap">' +
          '<svg class="ds-donut" viewBox="0 0 120 120">' +
            '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
            '<circle cx="60" cy="60" r="52" fill="none" stroke="' + ringColor + '" stroke-width="8" ' +
              'stroke-dasharray="' + circ + '" stroke-dashoffset="' + dashOffset + '" stroke-linecap="round" ' +
              'transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)"/>' +
          '</svg>' +
          '<div class="ds-donut-text">' +
            '<div class="ds-donut-score">' + Math.round(result.score) + '</div>' +
            '<div class="ds-donut-max">/ 100</div>' +
          '</div>' +
          '<div class="ds-donut-pill ds-donut-pill-' + result.color + '">' +
            '<span class="ds-pill-icon">' + (result.color === 'green' ? _DS_ICONS.trendingUp : result.color === 'gold' ? _DS_ICONS.scale : _DS_ICONS.alert) + '</span>' +
            result.label +
          '</div>' +
        '</div>' +

        // Metriken-Grid rechts
        '<div class="ds-metrics">' +
          result.breakdown.map(function(c) {
            var icon = _dsIconFor(c.label);
            var iconColor = c.score >= 80 ? '#2FBE6E' : c.score >= 60 ? '#E5BD53' : '#D55B5B';
            var barColor  = iconColor;
            return '<div class="ds-metric">' +
              '<div class="ds-metric-icon" style="color:' + iconColor + ';border-color:' + iconColor + '40">' + icon + '</div>' +
              '<div class="ds-metric-body">' +
                '<div class="ds-metric-head">' +
                  '<span class="ds-metric-label">' + _escClean(c.label) +
                    ' <span class="ds-metric-weight">(' + c.weight + '%)</span></span>' +
                  '<span class="ds-metric-score">' + Math.round(c.score) + ' / 100</span>' +
                '</div>' +
                '<div class="ds-metric-bar"><div class="ds-metric-bar-fill" style="width:' + c.score + '%;background:' + barColor + '"></div></div>' +
                '<div class="ds-metric-input">' + _escClean(c.input || '') + '</div>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      // Footer-Button
      '<button class="ds-settings-btn" onclick="showDealScoreSettings()">' +
        '<span class="ds-settings-icon">' + _DS_ICONS.scale + '</span>' +
        'Gewichtung anpassen' +
      '</button>' +

    '</div>';

  // V28: Lokale Kennzahlen-Bewertung mit rendern
  if (typeof renderKpiEval === 'function') renderKpiEval();
  // V36: DealScore 2.0 (Investor Deal Score) direkt darunter rendern
  if (typeof renderDealScore2 === 'function') renderDealScore2();
}

// HTML-Escape für die Render-Funktion (falls noch nicht global definiert)
function _escClean(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*/g, '').replace(/\*/g, '');
}

/**
 * V28: Lokale strukturierte Kennzahlen-Bewertung — kein KI-Aufruf.
 * Nutzt die DealScore-Komponenten und übersetzt sie in eine
 * Tabelle mit Ampel + Schwellen-Erläuterung.
 */
function renderKpiEval() {
  var body = document.getElementById('kpi-eval-body');
  if (!body) return;

  // Wenn keine sinnvollen State-Werte da sind → Empty-State
  if (!State || !State.kpis || !State.kpis.kp) {
    body.innerHTML = '<div class="kpi-eval-empty">Sobald Werte eingegeben sind, erscheint hier eine Ampel-Bewertung der wichtigsten Kennzahlen.</div>';
    return;
  }

  var k = State.kpis;

  // V63.61: Erweiterte Kennzahlen-Bewertung
  // V63.62 BUGFIX: cf_ns_monthly existiert nicht in State.kpis → vorher kam Jahreswert raus
  //               und wurde als Monatswert beschriftet. Jetzt explizit /12 für Monatswerte.
  // V63.62: Zusätzliche Zeile "Cashflow vor Steuer (nach Tilgung)" — Banker-Sicht.
  var cf_vst_monthly = (k.cf_op != null) ? k.cf_op / 12 : null;   // CF v.St. nach Tilgung pro Monat
  var cf_nst_monthly = (k.cf_ns != null) ? k.cf_ns / 12 : null;   // CF n.St. pro Monat
  var rows = [
    _evalDscr(k.dscr),
    _evalCashflowVst(cf_vst_monthly),
    _evalCashflow(cf_nst_monthly),
    _evalBruttomietrendite(k.bmy),
    _evalNettomietrendite(k.nmy),
    _evalEkRendite(k.ekr, k.ek),
    _evalEquityMultiple(k.em, k.ek),
    _evalRisikoLtv(k.ltv)
  ];

  body.innerHTML =
    '<table class="kpi-eval-table">' +
      '<thead><tr>' +
        '<th>Kennzahl</th>' +
        '<th>Wert</th>' +
        '<th>Bewertung</th>' +
        '<th class="kpi-eval-comment">Hinweis</th>' +
      '</tr></thead>' +
      '<tbody>' +
        rows.map(function(r) {
          return '<tr>' +
            '<td class="kpi-eval-name">' + r.name + '</td>' +
            '<td class="kpi-eval-val">' + r.valueStr + '</td>' +
            '<td><span class="kpi-eval-light kpi-eval-' + r.color + '">' + r.label + '</span></td>' +
            '<td class="kpi-eval-comment">' + r.comment + '</td>' +
          '</tr>';
        }).join('') +
      '</tbody>' +
    '</table>' +
    '<div class="kpi-eval-footer-hint">Schwellen: <strong>DSCR</strong> &lt;1.0 rot · 1.0–1.2 gelb · ≥1.2 grün &nbsp; · &nbsp; <strong>LTV</strong> &lt;85% grün · 85–100% gelb · &gt;100% rot</div>';
}

function _evalDscr(d) {
  var r = { name: 'DSCR (Schuldendienstdeckung)' };
  if (d == null || isNaN(d) || d <= 0) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Finanzierung erfasst.' });
  }
  var v = parseFloat(d);
  r.valueStr = v.toFixed(2).replace('.', ',');
  if (v >= 1.2) {
    r.color = 'green'; r.label = 'Gut';
    r.comment = 'Deutlich über 1,2 — Mieten decken Schuldendienst mit Puffer.';
  } else if (v >= 1.0) {
    r.color = 'gold'; r.label = 'Knapp';
    r.comment = 'Gerade kostendeckend — wenig Spielraum bei Mietausfall oder Zinsanstieg.';
  } else {
    r.color = 'red'; r.label = 'Kritisch';
    r.comment = 'Mieten decken Annuität nicht — Eigenkapital wird laufend nachgeschossen.';
  }
  return r;
}

function _evalCashflow(cf) {
  var r = { name: 'Cashflow nach Steuern (€/Mon)' };
  if (cf == null || isNaN(cf)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Berechnung.' });
  }
  var v = parseFloat(cf);
  r.valueStr = (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('de-DE') + ' €';
  if (v >= 100) {
    r.color = 'green'; r.label = 'Positiv';
    r.comment = 'Nach Steuern bleibt monatlich Geld — solides Fundament.';
  } else if (v >= 0) {
    r.color = 'gold'; r.label = 'Neutral';
    r.comment = 'Knapp positiv — kleiner Puffer für Reparaturen oder Leerstand.';
  } else if (v >= -200) {
    r.color = 'gold'; r.label = 'Leicht negativ';
    r.comment = 'Monatliche Zuzahlung nötig — bei Wertsteigerung evtl. trotzdem sinnvoll.';
  } else {
    r.color = 'red'; r.label = 'Negativ';
    r.comment = 'Hoher monatlicher Zuschuss — Risiko bei Mietausfall sehr hoch.';
  }
  return r;
}

function _evalCashflowVst(cf) {
  // V63.62: Banker-Cashflow — was nach Bedienung der Bank am Konto bleibt (vor Steuer)
  var r = { name: 'Cashflow vor Steuern (€/Mon)' };
  if (cf == null || isNaN(cf)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Berechnung.' });
  }
  var v = parseFloat(cf);
  r.valueStr = (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('de-DE') + ' €';
  if (v >= 100) {
    r.color = 'green'; r.label = 'Positiv';
    r.comment = 'Bank-CF deutlich positiv — Mieten decken Annuität mit komfortablem Puffer.';
  } else if (v >= 0) {
    r.color = 'gold'; r.label = 'Knapp positiv';
    r.comment = 'Mieten decken die Annuität gerade so — wenig Spielraum für Mietausfall.';
  } else if (v >= -100) {
    r.color = 'gold'; r.label = 'Leicht negativ';
    r.comment = 'Kleine monatliche Zuzahlung — typisch bei hoher Finanzierung mit Wertsteigerungs-Strategie.';
  } else {
    r.color = 'red'; r.label = 'Stark negativ';
    r.comment = 'Hohe Zuzahlung nötig — Bank-Cashflow deckt Annuität nicht.';
  }
  return r;
}

function _evalRendite(p) {
  // V63.61: Behalten als Legacy-Fallback (noch von alten Stellen referenziert)
  return _evalBruttomietrendite(p);
}

function _evalBruttomietrendite(p) {
  var r = { name: 'Bruttomietrendite (BMR)' };
  if (p == null || isNaN(p)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Werte.' });
  }
  var v = parseFloat(p);
  if (Math.abs(v) <= 1) v = v * 100;
  r.valueStr = v.toFixed(2).replace('.', ',') + ' %';
  if (v >= 6) {
    r.color = 'green'; r.label = 'Gut';
    r.comment = 'Über 6 % — solide Brutto-Rendite, gute Ausgangsbasis.';
  } else if (v >= 4.5) {
    r.color = 'gold'; r.label = 'Durchschnittlich';
    r.comment = 'Marktüblich — A-/B-Lagen liegen oft hier, Wertsteigerung wichtig.';
  } else if (v >= 3) {
    r.color = 'gold'; r.label = 'Gering';
    r.comment = 'Niedrige Brutto-Rendite — Investment-Case hängt an Wertsteigerung.';
  } else {
    r.color = 'red'; r.label = 'Sehr gering';
    r.comment = 'Unter 3 % — riskant ohne signifikante Wertentwicklung.';
  }
  return r;
}

function _evalNettomietrendite(p) {
  var r = { name: 'Nettomietrendite (NMR)' };
  if (p == null || isNaN(p)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Werte.' });
  }
  var v = parseFloat(p);
  if (Math.abs(v) <= 1) v = v * 100;
  r.valueStr = v.toFixed(2).replace('.', ',') + ' %';
  if (v >= 4.5) {
    r.color = 'green'; r.label = 'Gut';
    r.comment = 'Über 4,5 % nach Bewirtschaftung — operativ rentabel.';
  } else if (v >= 3.5) {
    r.color = 'gold'; r.label = 'Durchschnittlich';
    r.comment = 'Marktüblich — Wertsteigerung wichtig für Gesamtrendite.';
  } else if (v >= 2.5) {
    r.color = 'gold'; r.label = 'Gering';
    r.comment = 'Niedrige Netto-Rendite — Bewirtschaftung frisst viel auf.';
  } else {
    r.color = 'red'; r.label = 'Sehr gering';
    r.comment = 'Unter 2,5 % — operativ wenig attraktiv.';
  }
  return r;
}

function _evalEkRendite(p, ek) {
  var r = { name: 'EK-Rendite p.a.' };
  // V63.62: Wenn kein Eigenkapital eingesetzt wurde (Vollfinanzierung inkl. Nebenkosten),
  //         ist EK-Rendite mathematisch unendlich. Das ist KEIN Fehler — es ist der
  //         maximale Hebel-Effekt. Wir zeigen "∞" und erklären den Hintergrund.
  if (ek != null && ek <= 100) {  // Toleranz: <100 € EK ≈ "kein EK"
    return Object.assign(r, {
      valueStr: '∞',
      color: 'green',
      label: 'Maximaler Hebel',
      comment: 'Du hast (nahezu) kein Eigenkapital eingesetzt — alle Erträge ohne EK-Bindung. ' +
               'Maximaler Hebel-Effekt. Achtung: Volle Fremdfinanzierung erhöht das Risiko bei Wertkorrekturen.'
    });
  }
  if (p == null || isNaN(p) || !isFinite(p)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Werte.' });
  }
  var v = parseFloat(p);
  r.valueStr = v.toFixed(2).replace('.', ',') + ' %';
  if (v >= 8) {
    r.color = 'green'; r.label = 'Sehr gut';
    r.comment = 'Hebel-Effekt wirkt stark — gute Verzinsung des eingesetzten Eigenkapitals.';
  } else if (v >= 4) {
    r.color = 'green'; r.label = 'Gut';
    r.comment = 'Solide EK-Rendite — Hebel arbeitet für dich.';
  } else if (v >= 0) {
    r.color = 'gold'; r.label = 'Niedrig';
    r.comment = 'Eigenkapital arbeitet wenig — Hebel-Effekt schwach.';
  } else {
    r.color = 'red'; r.label = 'Negativ';
    r.comment = 'CF deckt das eingesetzte EK nicht — Investment-Case nur über Wertsteigerung.';
  }
  return r;
}

function _evalEquityMultiple(p, ek) {
  var r = { name: 'Equity Multiple' };
  // V63.62: gleiche Logik wie EK-Rendite — bei EK ≈ 0 ist Multiple unendlich
  if (ek != null && ek <= 100) {
    return Object.assign(r, {
      valueStr: '∞',
      color: 'green',
      label: 'Maximaler Hebel',
      comment: 'Vermögenszuwachs ohne eingesetztes EK — unendliches Vielfaches. ' +
               'Der Deal rechnet sich extrem, weil du das Geld nicht besessen hast. ' +
               'Achtung: Risiko bei Marktrückgang trägst du allein.'
    });
  }
  if (p == null || isNaN(p) || !isFinite(p)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Werte.' });
  }
  var v = parseFloat(p);
  r.valueStr = v.toFixed(1).replace('.', ',') + ' x';
  if (v >= 3.0) {
    r.color = 'green'; r.label = 'Sehr gut';
    r.comment = 'EK vervielfacht sich über die Haltedauer — starke Vermögensbildung.';
  } else if (v >= 2.0) {
    r.color = 'green'; r.label = 'Gut';
    r.comment = 'EK verdoppelt sich — solide Vermögensbildung.';
  } else if (v >= 1.0) {
    r.color = 'gold'; r.label = 'Mäßig';
    r.comment = 'Geringer Vermögensaufbau im Verhältnis zum Eigenkapital.';
  } else {
    r.color = 'red'; r.label = 'Schwach';
    r.comment = 'Vermögenszuwachs bleibt hinter dem eingesetzten EK zurück.';
  }
  return r;
}

function _evalRisikoLtv(ltv) {
  var r = { name: 'LTV (Beleihungsauslauf)' };
  if (ltv == null || isNaN(ltv)) {
    return Object.assign(r, { valueStr: '—', color: 'gray', label: 'k.A.', comment: 'Noch keine Finanzierung.' });
  }
  var v = parseFloat(ltv);
  r.valueStr = v.toFixed(1).replace('.', ',') + ' %';
  if (v <= 60) {
    r.color = 'green'; r.label = 'Sehr sicher';
    r.comment = 'Hoher Eigenkapital-Anteil — günstige Konditionen, niedriges Risiko.';
  } else if (v <= 85) {
    r.color = 'green'; r.label = 'Solide';
    r.comment = 'Klassische Bank-Finanzierung — verhandelbare Zinsen.';
  } else if (v <= 100) {
    r.color = 'gold'; r.label = 'Erhöht';
    r.comment = 'Knapp 100% finanziert — höhere Zinsen, weniger Verhandlungsspielraum.';
  } else {
    r.color = 'red'; r.label = 'Kritisch';
    r.comment = 'Mehr als 100% finanziert — hohes Risiko bei Wertkorrekturen.';
  }
  return r;
}

window.renderKpiEval = renderKpiEval;

function showDealScoreSettings() {
  var existing = document.getElementById('ds-settings-modal');
  if (existing) existing.remove();
  var w = DealScore.getWeights();
  var modal = document.createElement('div');
  modal.id = 'ds-settings-modal';
  modal.className = 'global-view-overlay';
  modal.innerHTML =
    '<div class="global-view-modal" style="max-width:520px">' +
      '<button class="pricing-close" onclick="document.getElementById(\'ds-settings-modal\').remove()">×</button>' +
      '<h2>⚙ Deal Score Gewichtung</h2>' +
      '<p style="color:var(--muted);font-size:12.5px;margin-bottom:14px">' +
        'Passe an wie wichtig dir die einzelnen Faktoren sind. Summe muss 100% ergeben.' +
      '</p>' +
      '<div class="ds-settings-grid">' +
        ['cashflow','rendite','ltv','risiko','potenzial'].map(function(k) {
          var labels = { cashflow: 'Cashflow', rendite: 'Rendite (NMR)', ltv: 'LTV', risiko: 'Risiko (DSCR)', potenzial: 'Potenzial' };
          return '<div class="ds-setting-row">' +
            '<label>' + labels[k] + '</label>' +
            '<div class="ds-setting-input">' +
              '<input id="ds-w-' + k + '" type="range" min="0" max="60" value="' + w[k] + '" oninput="_updateDsSliderLabel(this)">' +
              '<span class="ds-w-val" id="ds-w-' + k + '-val">' + w[k] + '%</span>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="ds-sum-row">' +
        '<span>Summe:</span>' +
        '<span id="ds-sum-val">100%</span>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
        '<button class="btn btn-outline" onclick="resetDealScoreWeights()">↺ Standard</button>' +
        '<button class="btn btn-gold" onclick="saveDealScoreWeights()">Speichern</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  _updateDsSum();
}

function _updateDsSliderLabel(input) {
  var id = input.id;
  var lbl = document.getElementById(id + '-val');
  if (lbl) lbl.textContent = input.value + '%';
  _updateDsSum();
}

function _updateDsSum() {
  var sum = 0;
  ['cashflow','rendite','ltv','risiko','potenzial'].forEach(function(k) {
    var inp = document.getElementById('ds-w-' + k);
    if (inp) sum += parseInt(inp.value) || 0;
  });
  var sumEl = document.getElementById('ds-sum-val');
  if (sumEl) {
    sumEl.textContent = sum + '%';
    sumEl.style.color = Math.abs(sum - 100) < 0.5 ? 'var(--green)' : 'var(--red)';
  }
}

function resetDealScoreWeights() {
  var d = DealScore.getDefaults();
  ['cashflow','rendite','ltv','risiko','potenzial'].forEach(function(k) {
    var inp = document.getElementById('ds-w-' + k);
    if (inp) {
      inp.value = d[k];
      _updateDsSliderLabel(inp);
    }
  });
}

function saveDealScoreWeights() {
  var w = {};
  ['cashflow','rendite','ltv','risiko','potenzial'].forEach(function(k) {
    var inp = document.getElementById('ds-w-' + k);
    w[k] = parseInt(inp.value) || 0;
  });
  try {
    DealScore.setWeights(w);
    document.getElementById('ds-settings-modal').remove();
    if (typeof renderDealScore === 'function') renderDealScore();
    if (typeof toast === 'function') toast('✓ Gewichtung gespeichert');
  } catch (e) {
    alert(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   V46: DealScore Card kollabierbar (war früher DS2 — nun DS oben)
   Standard: minimiert
═══════════════════════════════════════════════════════════════ */
function toggleDsCollapse() {
  var card = document.getElementById('dealscore-card');
  if (!card) return;
  var collapsed = card.classList.toggle('dealscore-card-v46-collapsed');
  var btn = card.querySelector('.ds-collapse-toggle');
  if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  try { localStorage.setItem('dp_ds_collapsed', collapsed ? '1' : '0'); } catch(e) {}
}

function _updateDsCollapseSummary(score, label) {
  var el = document.getElementById('ds-collapse-summary');
  if (!el) return;
  if (score == null) {
    el.textContent = 'Klicken zum Anzeigen';
    el.className = 'ds-collapse-summary';
    return;
  }
  var cls = score >= 75 ? 'ds-coll-green' :
            score >= 50 ? 'ds-coll-gold' : 'ds-coll-red';
  el.className = 'ds-collapse-summary ' + cls;
  el.innerHTML = '<strong>' + score + '/100</strong> · ' + (label || '');
}
window.toggleDsCollapse = toggleDsCollapse;
window._updateDsCollapseSummary = _updateDsCollapseSummary;

// V46: Wrap renderDealScore um Summary mit zu updaten
(function() {
  if (typeof window.renderDealScore !== 'function') return;
  var orig = window.renderDealScore;
  window.renderDealScore = function() {
    var r = orig.apply(this, arguments);
    try {
      if (window.DealScore && typeof window.DealScore.compute === 'function') {
        var res = window.DealScore.compute();
        _updateDsCollapseSummary(res.score, res.label);
      }
    } catch(e) {}
    return r;
  };
})();

// V46: Init Collapse-State (Default = minimiert wenn DS2 verfügbar, sonst offen)
(function() {
  function applyCollapse(shouldCollapse) {
    var card = document.getElementById('dealscore-card');
    if (!card) return;
    card.classList.toggle('dealscore-card-v46-collapsed', shouldCollapse);
    var btn = card.querySelector('.ds-collapse-toggle');
    if (btn) btn.setAttribute('aria-expanded', shouldCollapse ? 'false' : 'true');
  }

  async function init() {
    if (!document.getElementById('dealscore-card')) return;
    // V112: Plan zuerst prüfen — Plan hat Vorrang vor localStorage.
    //   - Plan hat deal_score_v2 (Investor/Pro/Business + Free-Demo) → DS1 default eingeklappt
    //     (DS2 ist primär), aber localStorage darf User-Wahl überschreiben
    //   - Plan hat KEINEN DS2 (Starter)                              → DS1 IMMER ausgeklappt,
    //     localStorage-Override ignorieren (sonst kann es kleben bleiben nach Plan-Wechsel)
    var hasDs2 = false;
    try {
      if (window.DealPilotConfig && DealPilotConfig.pricing &&
          typeof DealPilotConfig.pricing.hasFeature === 'function') {
        hasDs2 = DealPilotConfig.pricing.hasFeature('deal_score_v2');
      }
    } catch(e) {}

    if (!hasDs2) {
      // Starter o.ä. — DS1 immer offen, localStorage egal
      applyCollapse(false);
      return;
    }

    // V119: Marcels Wunsch — auch bei Plänen mit DS2 ist DS1 standardmäßig OFFEN.
    //   User-Wahl aus localStorage hat weiter Vorrang (kann bewusst einklappen),
    //   aber der Default ist jetzt "ausgeklappt".
    var stored = null;
    try { stored = localStorage.getItem('dp_ds_collapsed'); } catch(e) {}
    if (stored !== null) {
      applyCollapse(stored === '1');
      return;
    }
    applyCollapse(false);  // V119 Default: DS1 ausgeklappt
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }
})();
