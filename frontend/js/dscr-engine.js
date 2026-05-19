'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DealPilot V231 — DSCR-Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single Source of Truth für DSCR-Berechnungen (Debt Service Coverage Ratio).
 *
 * Vorher: drei verschiedene Stellen mit jeweils leicht abweichenden Formeln:
 *   - calc.js Z. 1107 (UI-Hauptberechnung, mit BSV)
 *   - calc.js Z. 2440 (Cashflow-Box, phase-aware mit BSV)
 *   - deal-kpis.js Z. 135 (DealScore, OHNE BSV → divergent!)
 *
 * Folge: bei Tilgungsaussetzung mit Bausparvertrag zeigte der DealScore
 * einen anderen DSCR-Wert als das UI.
 *
 * Lösung: alle 3 Stellen rufen Dscr.compute() auf — identische Formel.
 *
 * Verwendung:
 *   var r = Dscr.compute({
 *     nkm_j: 12000,        // NKM × 12 (Netto-Kaltmiete p.a.)
 *     ze_j:    600,        // Zuschläge p.a. (z.B. Stellplatz, Garage)
 *     zins_j: 6500,        // Zinszahlungen p.a.
 *     tilg_j: 3500,        // Tilgungszahlungen p.a.
 *     bsv_j:  1200,        // Bausparvertrag-Sparrate p.a. (0 wenn keine Aussetzung)
 *     bwk_cf: 1800         // Bewirtschaftungskosten nicht umlagef. p.a.
 *   });
 *   // r = {
 *   //   brutto:     1.14,   // (NKM+ZE)/Schuldendienst
 *   //   netto:      0.94,   // (NKM+ZE-BWK_NUL)/Schuldendienst
 *   //   noi_brutto: 12600,  // Zähler Brutto
 *   //   noi_netto:  10800,  // Zähler Netto
 *   //   kd:        11200,   // Schuldendienst (Zins+Tilg+BSV)
 *   //   schwelle:  'warn'   // 'good' (≥1.2), 'warn' (1.0-1.2), 'bad' (<1.0)
 *   // }
 *
 * Reine Compute-Funktion — keine DOM-Manipulation, keine Side-Effects.
 * Damit unit-testbar und vorhersehbar.
 * ═══════════════════════════════════════════════════════════════════════════ */

window.Dscr = (function () {

  /**
   * Klassifizierung des DSCR nach DealPilot-Bewertungsskala.
   * - good:  DSCR ≥ 1.2 (Standard, ausreichender Puffer)
   * - warn:  DSCR 1.0–1.2 (knapp, kleinerer Puffer)
   * - bad:   DSCR < 1.0 (kritisch, Mieten decken Kapitaldienst nicht)
   */
  function classify(dscr) {
    if (!isFinite(dscr) || dscr <= 0) return 'bad';
    if (dscr >= 1.2) return 'good';
    if (dscr >= 1.0) return 'warn';
    return 'bad';
  }

  /**
   * Sicheres Number-Cast — fängt undefined, null, NaN, Strings.
   */
  function num(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  /**
   * Hauptfunktion: berechnet Brutto- und Netto-DSCR.
   *
   * @param {Object} input
   * @param {number} input.nkm_j  NKM × 12 (Netto-Kaltmiete p.a.)
   * @param {number} input.ze_j   Zuschläge p.a. (Stellplatz etc.)
   * @param {number} input.zins_j Zinszahlungen p.a.
   * @param {number} input.tilg_j Tilgungszahlungen p.a.
   * @param {number} input.bsv_j  Bausparvertrag-Sparrate p.a. (Default 0)
   * @param {number} input.bwk_cf Nicht-umlagef. Bewirtschaftungskosten p.a.
   * @returns {{brutto, netto, noi_brutto, noi_netto, kd, schwelle, hat_bsv}}
   */
  function compute(input) {
    input = input || {};
    var nkm_j  = num(input.nkm_j);
    var ze_j   = num(input.ze_j);
    var zins_j = num(input.zins_j);
    var tilg_j = num(input.tilg_j);
    var bsv_j  = num(input.bsv_j);
    var bwk_cf = num(input.bwk_cf);

    // Schuldendienst inkl. BSV-Sparrate (wirtschaftlicher Tilgungsersatz
    // bei Tilgungsaussetzungsdarlehen). Banken handhaben das in der Praxis
    // auch so — die Sparrate fließt nicht in Cash zum Tilgen, ist aber
    // verpflichtende Belastung wie ein Tilgungsanteil.
    var kd = zins_j + tilg_j + bsv_j;

    // NOI = Net Operating Income
    // Brutto: alle Einnahmen vor Abzug nicht-umlagefähiger Kosten
    // Netto: nach Abzug nicht-umlagefähiger Bewirtschaftungskosten
    var noi_brutto = nkm_j + ze_j;
    var noi_netto  = noi_brutto - bwk_cf;

    var brutto = kd > 0 ? noi_brutto / kd : 0;
    var netto  = kd > 0 ? noi_netto  / kd : 0;

    return {
      brutto:      brutto,
      netto:       netto,
      noi_brutto:  noi_brutto,
      noi_netto:   noi_netto,
      kd:          kd,
      schwelle:    classify(brutto),
      hat_bsv:     bsv_j > 0
    };
  }

  /**
   * Convenience: liefert label-Text für eine DSCR-Stufe.
   */
  function label(dscr) {
    var c = classify(dscr);
    if (c === 'good') return '✓ Standard (≥1,2)';
    if (c === 'warn') return '⚠ Ausreichend (1,0–1,2)';
    return '✗ Kritisch (<1,0)';
  }

  /**
   * Convenience: bank-item CSS-Class für DSCR.
   */
  function bankItemCls(dscr) {
    var c = classify(dscr);
    if (c === 'good') return 'ok';
    if (c === 'warn') return 'warn';
    return 'bad';
  }

  /**
   * Convenience: kpi-val color CSS-Class.
   */
  function kpiCls(dscr) {
    var c = classify(dscr);
    if (c === 'good') return 'dscr-good';
    if (c === 'warn') return 'dscr-warn';
    return 'dscr-bad';
  }

  return {
    compute:     compute,
    classify:    classify,
    label:       label,
    bankItemCls: bankItemCls,
    kpiCls:      kpiCls,
    // Für Tests
    _num:        num
  };
})();
