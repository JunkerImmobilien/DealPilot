'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DealPilot V227 — AfA-Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Liefert jahresgenaue AfA-Werte für alle deutschen Methoden:
 *
 *   linear         — § 7 Abs. 4 EStG: konstanter Prozentsatz auf AHK
 *   degressiv      — § 7 Abs. 5a EStG: 5% vom Restbuchwert (Neubau 10/2023–09/2029)
 *   degressiv_wechsel — Degressiv mit automatischem Wechsel zu linear sobald günstiger
 *   sonder_7b      — § 7b EStG: ZUSÄTZLICH +5% in den ersten 4 Jahren (Bedingungen!)
 *
 * Bedingungen § 7 Abs. 5a EStG (degressiv):
 *   - Wohngebäude
 *   - Bauantrag/Kaufvertrag zwischen 01.10.2023 und 30.09.2029
 *
 * Bedingungen § 7b EStG (Sonder-AfA, sehr streng):
 *   - Mietwohnung (nicht eigengenutzt)
 *   - Neubau, Bauantrag/Kaufvertrag 01.01.2023 – 30.09.2029
 *   - Effizienzhaus 40 mit Nachhaltigkeitsklasse (QNG-Siegel)
 *   - Baukosten max. 5.200 €/m² Wohnfläche (förderfähig nur 4.000 €/m²)
 *   - Pflicht: 10 Jahre Vermietung
 *
 * Diese Datei macht KEINE Berechnung selbst, sie liefert nur Reihen.
 * Wer die Reihen konsumiert: calc.js (Anzeige Tab 4) und tax.js (15J-Verlauf).
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /**
   * Linear AfA: konstanter Betrag jedes Jahr.
   * @param {number} ahk - Anschaffungs-/Herstellungskosten (Gebäude-Anteil)
   * @param {number} satzPct - z.B. 2.0, 2.5, 3.0
   * @param {number} jahre - wie viele Jahre vorausrechnen
   * @returns {number[]} Array mit Werten pro Jahr
   */
  function linearSeries(ahk, satzPct, jahre) {
    var jahresBetrag = ahk * (satzPct / 100);
    var out = [];
    var restbuch = ahk;
    for (var i = 0; i < jahre; i++) {
      // Im letzten Jahr ggf. nur Restbuchwert (kann nicht mehr abschreiben als noch da ist)
      var abschreibung = Math.min(jahresBetrag, restbuch);
      out.push(abschreibung);
      restbuch -= abschreibung;
      if (restbuch < 0.01) restbuch = 0;
    }
    return out;
  }

  /**
   * Degressive AfA § 7 Abs. 5a EStG: 5% vom Restbuchwert.
   * Optional mit automatischem Wechsel zu linear sobald der lineare
   * Wert höher ist (klassische Optimierung).
   *
   * @param {number} ahk
   * @param {number} satzPct - typisch 5.0
   * @param {number} jahre
   * @param {object} opts - { wechsel: true|false, linearFallback: 2.0|3.0 }
   * @returns {{series: number[], wechselJahr: number|null, restbuchAmEnde: number}}
   */
  function degressivSeries(ahk, satzPct, jahre, opts) {
    opts = opts || {};
    var wechsel = opts.wechsel !== false; // default: ja
    var linearFallback = opts.linearFallback || 3.0;
    var rateDeg = satzPct / 100;

    var out = [];
    var restbuch = ahk;
    var inLinearPhase = false;
    var wechselJahr = null;

    for (var i = 0; i < jahre; i++) {
      var degBetrag = restbuch * rateDeg;
      var linBetrag = ahk * (linearFallback / 100);

      // Wechsel-Logik: wenn linearer Betrag (auf URSPRÜNGLICHE AHK!) höher
      // als degressiver auf Restbuch → wechseln. Klassische Steuerregel.
      // Alternativ: linear auf Restbuch über Restlaufzeit — aber das ist
      // bei Wohngebäuden untypisch.
      var betrag;
      if (wechsel && !inLinearPhase && linBetrag > degBetrag) {
        inLinearPhase = true;
        wechselJahr = i + 1;
      }

      if (inLinearPhase) {
        // Linear weiter ab hier — Restbuch / Restjahre wäre korrekter
        // Wir nehmen den linearen Standardbetrag
        betrag = Math.min(linBetrag, restbuch);
      } else {
        betrag = Math.min(degBetrag, restbuch);
      }

      out.push(betrag);
      restbuch -= betrag;
      if (restbuch < 0.01) restbuch = 0;
    }

    return {
      series: out,
      wechselJahr: wechselJahr,
      restbuchAmEnde: restbuch
    };
  }

  /**
   * Sonder-AfA § 7b EStG: liefert +5% in den ersten 4 Jahren.
   * Wird ZUSÄTZLICH zur normalen AfA gezahlt. Bemessungsgrundlage:
   * max. 4.000 €/m² förderfähig (NICHT die volle AHK!).
   *
   * @param {number} foerderfaehigBasis - typisch min(AHK_Gebäude, 4000 × Wohnfläche)
   * @param {number} jahre
   * @returns {number[]} Array — erste 4 Jahre je 5%, danach 0
   */
  function sonder7bSeries(foerderfaehigBasis, jahre) {
    var rate = 0.05; // 5% p.a. für 4 Jahre
    var dauer = 4;
    var jahresBetrag = foerderfaehigBasis * rate;
    var out = [];
    for (var i = 0; i < jahre; i++) {
      out.push(i < dauer ? jahresBetrag : 0);
    }
    return out;
  }

  /**
   * Zwei AfA-Reihen addieren (z.B. degressiv + §7b).
   */
  function combineSeries(a, b) {
    var out = [];
    var len = Math.max(a.length, b.length);
    for (var i = 0; i < len; i++) {
      out.push((a[i] || 0) + (b[i] || 0));
    }
    return out;
  }

  /**
   * Haupt-Funktion: berechnet die AfA-Reihe gemäß User-Konfiguration.
   *
   * @param {object} params
   *   @param {string} params.methode - 'linear' | 'degressiv' | 'degressiv_wechsel'
   *   @param {number} params.satzPct - z.B. 2.0, 3.0, 5.0
   *   @param {number} params.ahk - Gebäude-Anschaffungskosten
   *   @param {number} params.jahre - typisch 30 (für lange Sicht)
   *   @param {boolean} params.sonder7bAktiv - § 7b ja/nein
   *   @param {number} params.sonder7bBasis - Bemessungsgrundlage (typisch min(AHK, 4000 × Wfl))
   *   @param {number} params.linearFallback - Fallback-Satz für Wechsel (typisch 3.0)
   * @returns {{
   *   series: number[],     // Gesamt-AfA pro Jahr
   *   normal: number[],     // Nur Normal-AfA (ohne § 7b)
   *   sonder: number[],     // Nur § 7b-AfA
   *   methode: string,
   *   wechselJahr: number|null,
   *   restbuch: number,
   *   summe: number         // Kumuliert über jahre
   * }}
   */
  function computeSeries(params) {
    var methode = params.methode || 'linear';
    var satz = params.satzPct || 2.0;
    var ahk = params.ahk || 0;
    var jahre = params.jahre || 30;
    var sonderAktiv = params.sonder7bAktiv === true;
    var sonderBasis = params.sonder7bBasis || 0;
    var linearFallback = params.linearFallback || 3.0;

    var normal;
    var wechselJahr = null;
    var restbuch = ahk;

    if (methode === 'degressiv' || methode === 'degressiv_wechsel') {
      var deg = degressivSeries(ahk, satz, jahre, {
        wechsel: methode === 'degressiv_wechsel',
        linearFallback: linearFallback
      });
      normal = deg.series;
      wechselJahr = deg.wechselJahr;
      restbuch = deg.restbuchAmEnde;
    } else {
      normal = linearSeries(ahk, satz, jahre);
      restbuch = ahk - normal.reduce(function (s, x) { return s + x; }, 0);
    }

    var sonder = sonderAktiv ? sonder7bSeries(sonderBasis, jahre) : new Array(jahre).fill(0);
    var gesamt = combineSeries(normal, sonder);
    var summe = gesamt.reduce(function (s, x) { return s + x; }, 0);

    return {
      series: gesamt,
      normal: normal,
      sonder: sonder,
      methode: methode,
      wechselJahr: wechselJahr,
      restbuch: restbuch,
      summe: summe
    };
  }

  /**
   * Eligibility-Check für Auto-Hinweis bei Neubau:
   *
   * Wenn:
   *   - ds2_zustand === 'neubau' UND
   *   - baujahr >= 2023 UND
   *   - aktueller AfA-Satz === '2.0' oder '3.0' (also linear, nicht schon degressiv)
   *
   * → Hinweis-Banner anzeigen
   *
   * @param {object} state - { ds2_zustand, baujahr, afaSatz }
   * @returns {{eligible: boolean, reason: string}}
   */
  function checkDegressivEligibility(state) {
    var zustand = (state.ds2_zustand || '').toLowerCase();
    var baujahr = parseInt(state.baujahr, 10);
    var afaSatz = String(state.afaSatz || '');

    // Nur "neubau"-Zustand qualifiziert. Erkennt Schreibweisen:
    var isNeubau = /neubau|kernsaniert/i.test(zustand);
    if (!isNeubau) return { eligible: false, reason: 'Kein Neubau' };

    if (!baujahr || baujahr < 2023) return { eligible: false, reason: 'Baujahr < 2023' };

    if (baujahr > 2029) return { eligible: false, reason: 'Baujahr > 2029 (Förderung ausgelaufen)' };

    // Schon degressiv gewählt? Dann nicht nochmal vorschlagen.
    if (afaSatz === '5.0_deg' || afaSatz === '5.0_deg_wechsel') {
      return { eligible: false, reason: 'Degressiv bereits gewählt' };
    }

    return { eligible: true, reason: 'Neubau ab 2023 — § 7 Abs. 5a EStG anwendbar' };
  }

  /**
   * Mapping von Select-Value zu computeSeries-Methode.
   */
  function parseAfaSelectValue(val) {
    val = String(val || '');
    if (val === '5.0_deg' || val === '5.0_deg_wechsel') {
      return { methode: val === '5.0_deg_wechsel' ? 'degressiv_wechsel' : 'degressiv', satzPct: 5.0 };
    }
    var n = parseFloat(val.replace(',', '.'));
    if (isNaN(n) || !isFinite(n)) n = 2.0;
    return { methode: 'linear', satzPct: n };
  }

  /**
   * Föderfähige Basis für § 7b (max. 4.000 €/m² Wohnfläche).
   */
  function sonder7bBasis(ahkGebaeude, wohnflaeche) {
    var cap = (parseFloat(wohnflaeche) || 0) * 4000;
    if (cap <= 0) return 0; // keine Wfl → keine Förderung
    return Math.min(ahkGebaeude || 0, cap);
  }

  // ════════════ Export ═══════════════════════════════════════════════════
  window.Afa = {
    computeSeries: computeSeries,
    linear: linearSeries,
    degressiv: degressivSeries,
    sonder7b: sonder7bSeries,
    combine: combineSeries,
    checkDegressivEligibility: checkDegressivEligibility,
    parseSelectValue: parseAfaSelectValue,
    sonder7bBasis: sonder7bBasis,
    VERSION: 'V227'
  };
})();
