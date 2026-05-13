'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT V22 – mietentwicklung.js
   Mietentwicklung: Prognose-Modus (linear %) ODER
   Detail-Modus (diskrete Erhöhungs-Treppe).

   Public API:
     window.MietEntwicklung.getMode()    → 'prog' | 'detail'
     window.MietEntwicklung.factor(y)    → Multiplikator für Jahr y (y=0..N)
     window.MietEntwicklung.snapshot()   → {mode, schedule:[{year,factor,nkm}], opp_pct}
     window.setMietModus(mode)           → UI-Toggle (HTML onclick)
═══════════════════════════════════════════════════ */

window.MietEntwicklung = (function() {

  // Modus + zE-Toggle werden PRO OBJEKT gespeichert.
  // Sie liegen als versteckte Form-Felder im DOM (#me_modus, #me_inc_ze) damit
  // sie automatisch über loadData()/saveObj() mit dem Objekt persistiert werden.
  // localStorage wird nur als kurzfristiger Fallback genutzt, falls die Felder
  // (z.B. beim Initial-Render) noch nicht da sind.

  function _g(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').toString() : '';
  }
  function _v(id, fallback) {
    var s = _g(id).replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : (fallback != null ? fallback : 0);
  }

  function getMode() {
    var el = document.getElementById('me_modus');
    if (el && el.value) return el.value === 'detail' ? 'detail' : 'prog';
    var m = localStorage.getItem('dp_miet_modus');
    return m === 'detail' ? 'detail' : 'prog';
  }

  function setMode(m) {
    if (m !== 'detail' && m !== 'prog') m = 'prog';
    var el = document.getElementById('me_modus');
    if (el) el.value = m;
    localStorage.setItem('dp_miet_modus', m);
    _renderUI();
    if (typeof calc === 'function') calc();
  }

  /**
   * Toggle: Wirkt die Mieterhöhung auch auf zusätzliche Einnahmen (Stellplatz, Garage)?
   * Default: false (nur NKM wächst).
   */
  function appliesToZE() {
    var el = document.getElementById('me_inc_ze');
    if (el) return !!el.checked;
    return false;
  }

  function setAppliesToZE(b) {
    var el = document.getElementById('me_inc_ze');
    if (el) el.checked = !!b;
    if (typeof calc === 'function') calc();
  }

  /**
   * Liefert den Mietfaktor für Jahr y (y=0..N).
   * y=0 → 1.0 (Heutige Miete = Basis)
   * y=1 → Nach Jahr 1 wirksamer Faktor
   * Im Detail-Modus: Treppen-Faktor, nach jeder Erhöhung springt der Wert.
   * Im Prognose-Modus: (1+mstg)^y.
   */
  function factor(y) {
    if (y <= 0) return 1.0;
    var mode = getMode();
    if (mode === 'prog') {
      var mstg = _v('mietstg') / 100;
      return Math.pow(1 + mstg, y);
    }
    // Detail-Modus
    var anz = Math.max(0, Math.round(_v('me_anz', 0)));
    var intv = Math.max(1, Math.round(_v('me_int', 1)));
    var pct = _v('me_pct', 0) / 100;
    if (anz === 0 || pct === 0) return 1.0;
    // Step-Faktor pro Erhöhung — geometrisch verteilt, damit Gesamtsumme exakt pct ergibt
    var step = Math.pow(1 + pct, 1 / anz);
    // Wie viele Erhöhungen sind in Jahr y bereits passiert?
    // Erhöhungen geschehen in Jahr intv, 2*intv, 3*intv, ..., anz*intv
    var hikes = Math.min(anz, Math.floor(y / intv));
    return Math.pow(step, hikes);
  }

  /**
   * Liefert eine Tabelle (für UI) und Meta-Infos zur Mietentwicklung.
   */
  function snapshot() {
    var mode = getMode();
    var includesZE = appliesToZE();
    var nkm_m = _v('nkm', 0);
    var ze_m = _v('ze', 0);
    var wfl = _v('wfl', 0);
    var soll = _v('me_soll', 0);
    // Aktuelle Miete pro qm/Monat (inkl. zE)
    var ist_qm = wfl > 0 ? (nkm_m + ze_m) / wfl : 0;
    var opp_pct = (soll > 0 && ist_qm > 0) ? (ist_qm / soll - 1) : 0;

    var rows = [];
    var btj = Math.max(1, Math.round(_v('btj', 15)));
    var anz = Math.max(0, Math.round(_v('me_anz', 0)));
    var intv = Math.max(1, Math.round(_v('me_int', 1)));

    for (var y = 1; y <= btj; y++) {
      var f = factor(y);
      // V24: Toggle-respektierende Berechnung
      // - NKM wächst immer mit Faktor
      // - zE wächst NUR wenn Toggle aktiv, sonst bleibt zE konstant
      var nkm_grown = nkm_m * 12 * f;
      var ze_grown = ze_m * 12 * (includesZE ? f : 1.0);
      var nkm_y = nkm_grown + ze_grown;
      var qm = wfl > 0 ? (nkm_y / 12) / wfl : 0;
      var isHike = (mode === 'detail') &&
                   (y % intv === 0) &&
                   (y / intv <= anz);
      rows.push({ year: y, factor: f, nkm: nkm_y, qm: qm, isHike: isHike });
    }

    return { mode: mode, schedule: rows, opp_pct: opp_pct, ist_qm: ist_qm, soll: soll, includesZE: includesZE };
  }

  // ─────────────────────────────────────────────
  // UI-Rendering
  // ─────────────────────────────────────────────
  function _renderUI() {
    var mode = getMode();
    var btnP = document.getElementById('me-mode-prog');
    var btnD = document.getElementById('me-mode-detail');
    var blkP = document.getElementById('me-block-prog');
    var blkD = document.getElementById('me-block-detail');
    if (btnP && btnD) {
      btnP.classList.toggle('active', mode === 'prog');
      btnD.classList.toggle('active', mode === 'detail');
    }
    if (blkP && blkD) {
      blkP.style.display = mode === 'prog' ? '' : 'none';
      blkD.style.display = mode === 'detail' ? '' : 'none';
    }
    if (mode === 'detail') {
      _renderTable();
      _renderOpp();
    }
  }

  function _renderTable() {
    var wrap = document.getElementById('me_table_wrap');
    if (!wrap) return;
    var snap = snapshot();
    var fmtE = function(n) {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0
      }).format(n || 0);
    };
    var fmtQm = function(n) {
      return (n || 0).toFixed(2).replace('.', ',') + ' €/m²';
    };
    var html = '<table><thead><tr>' +
               '<th>Jahr</th><th>Kaltmiete p.a.</th><th>€/m² (Monat)</th><th>Faktor</th>' +
               '</tr></thead><tbody>';
    snap.schedule.forEach(function(r) {
      html += '<tr' + (r.isHike ? ' class="me-row-hike"' : '') + '>' +
              '<td>Jahr ' + r.year + (r.isHike ? ' ⬆' : '') + '</td>' +
              '<td>' + fmtE(r.nkm) + '</td>' +
              '<td>' + fmtQm(r.qm) + '</td>' +
              '<td>' + r.factor.toFixed(3).replace('.', ',') + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function _renderOpp() {
    var el = document.getElementById('me_opp');
    if (!el) return;
    var snap = snapshot();
    if (snap.soll <= 0 || snap.ist_qm <= 0) {
      el.textContent = '—';
      el.className = 'cf';
      return;
    }
    var p = snap.opp_pct * 100;
    el.textContent = (p >= 0 ? '+' : '') + p.toFixed(1).replace('.', ',') + ' %';
    el.className = 'cf ' + (p < -5 ? 'pos' : (p > 5 ? 'neg' : ''));
  }

  // Re-render Tabelle bei jeder calc()-Aktualisierung
  function refresh() { _renderUI(); }

  // Initial-Setup nach DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_renderUI, 0);
  });

  return {
    getMode: getMode,
    setMode: setMode,
    appliesToZE: appliesToZE,
    setAppliesToZE: setAppliesToZE,
    factor: factor,
    snapshot: snapshot,
    refresh: refresh
  };
})();

// HTML-onclick-Handler
window.setMietModus = function(mode) {
  window.MietEntwicklung.setMode(mode);
};
window.setMietInclZE = function(checked) {
  window.MietEntwicklung.setAppliesToZE(checked);
};
