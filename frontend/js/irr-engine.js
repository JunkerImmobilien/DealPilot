'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * irr-engine.js — v1260: der interne Zinsfuß, den DealPilot bisher versprach
 *
 * WARUM ES DIESE DATEI GIBT: Die Landingpage bewirbt IRR
 * (landing/index.html:847 — „Cashflow, DSCR, LTV, IRR, Rendite & Faktor"),
 * das Hilfe-Glossar erklärt ihn (help.js:364), und ui.js:572 schrieb ihn in
 * den KI-Prompt. Gerechnet wurde er NIE. Am 08.09.2026 im Browser gemessen:
 * State.kpis führt 59 Schlüssel, `irr` ist keiner davon; `fP(undefined)`
 * ergibt „—", die KI bekam also „IRR: —" geliefert.
 *
 * WAS DER IRR IST: der Zinssatz, bei dem der Barwert aller Zahlungen null
 * wird. Anders als die EK-Rendite (eine Momentaufnahme) verrechnet er den
 * ZEITPUNKT jeder Zahlung — ein Euro im Jahr 1 wiegt mehr als einer im
 * Jahr 15. Deshalb ist er die Kennzahl, mit der sich zwei Objekte mit
 * unterschiedlichem Verlauf überhaupt vergleichen lassen.
 *
 * WARUM BISEKTION UND NICHT NEWTON: Newton ist schneller, aber er springt
 * bei Immobilien-Zahlungsreihen gern weg. Die Reihe hat oft mehrere Jahre
 * negativen Cashflow und am Ende einen großen Verkaufserlös — die Ableitung
 * ist dort flach, und Newton landet bei -300 % oder divergiert. Bisektion
 * braucht ein paar Schritte mehr und findet die Wurzel immer, sofern es
 * im Suchbereich einen Vorzeichenwechsel gibt.
 *
 * WANN ES KEINEN IRR GIBT — und das ist kein Fehler: Ist der Barwert im
 * ganzen Suchbereich negativ (jede Zahlung ein Verlust), existiert keine
 * Lösung. Dann kommt `null` zurück, NICHT 0. Eine 0 hieße „null Prozent
 * Rendite" und wäre eine Aussage; null heißt „nicht bestimmbar".
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var UNTEN = -0.9999;   /* -99,99 % — darunter ist (1+r) null oder negativ */
  var OBEN = 10;         /* +1000 % — darüber ist es keine Immobilie mehr */
  var SCHRITTE = 200;    /* Bisektion: 200 Halbierungen sind weit mehr als nötig */

  /**
   * Barwert einer Zahlungsreihe bei Zinssatz r.
   * zahlungen[0] ist der Zeitpunkt 0 (wird nicht abgezinst).
   */
  function barwert(zahlungen, r) {
    var s = 0;
    for (var t = 0; t < zahlungen.length; t++) {
      var z = Number(zahlungen[t]) || 0;
      s += (t === 0) ? z : z / Math.pow(1 + r, t);
    }
    return s;
  }

  /**
   * Interner Zinsfuß einer Zahlungsreihe.
   *
   * @param {number[]} zahlungen - [t0, t1, t2, …]; t0 üblicherweise negativ
   *                               (Eigenkapital-Einsatz).
   * @returns {number|null} Zinssatz in PROZENT, oder null wenn nicht
   *                        bestimmbar. Prozent, weil jede andere Kennzahl in
   *                        DealPilot auch in Prozent geführt wird — ein
   *                        Faktor 100 an der falschen Stelle ist eine der
   *                        teuersten Verwechslungen in diesem Code.
   */
  function compute(zahlungen) {
    if (!Array.isArray(zahlungen) || zahlungen.length < 2) return null;

    /* Ohne Vorzeichenwechsel gibt es keine Wurzel. Wer nur einzahlt oder nur
       kassiert, hat keine Rendite, sondern einen Verlust bzw. ein Geschenk. */
    var hatPlus = false, hatMinus = false, alleEndlich = true;
    for (var i = 0; i < zahlungen.length; i++) {
      var z = Number(zahlungen[i]);
      if (!isFinite(z)) { alleEndlich = false; break; }
      if (z > 0) hatPlus = true;
      if (z < 0) hatMinus = true;
    }
    if (!alleEndlich || !hatPlus || !hatMinus) return null;

    var lo = UNTEN, hi = OBEN;
    var flo = barwert(zahlungen, lo), fhi = barwert(zahlungen, hi);
    if (!isFinite(flo) || !isFinite(fhi)) return null;
    /* Gleiches Vorzeichen an beiden Rändern: im Suchbereich liegt keine
       Wurzel. Kommt bei Reihen vor, die auch bei 1000 % noch positiv sind. */
    if (flo * fhi > 0) return null;

    for (var k = 0; k < SCHRITTE; k++) {
      var mid = (lo + hi) / 2;
      var fm = barwert(zahlungen, mid);
      if (!isFinite(fm)) return null;
      if (fm === 0) { lo = hi = mid; break; }
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
      if (hi - lo < 1e-10) break;
    }
    var r = (lo + hi) / 2;
    if (!isFinite(r)) return null;
    return r * 100;
  }

  /**
   * Break-Even-Zeitpunkte aus einer Reihe von JAHRES-Cashflows.
   *
   * immocation weist drei Zeitpunkte aus, DealPilot bisher keinen — dabei
   * liegen die Zahlen in der 15-Jahres-Projektion längst vor. Gefragt wird
   * in der Praxis: „ab wann trägt sich das Ding?"
   *
   * @param {number[]} cfJahre - Cashflow nach Steuern je Jahr, Index 0 = Jahr 1
   * @param {number} ekEinsatz - eingesetztes Eigenkapital (positiv)
   * @returns {{cf:number|null, kum:number|null, kumEk:number|null}}
   *          Jahreszahlen (1-basiert) oder null, wenn es im
   *          Betrachtungszeitraum nicht dazu kommt. Auch hier ist null eine
   *          Aussage: „innerhalb von N Jahren nicht" — und nicht 0.
   */
  function breakEven(cfJahre, ekEinsatz) {
    var out = { cf: null, kum: null, kumEk: null };
    if (!Array.isArray(cfJahre) || !cfJahre.length) return out;
    var ek = Math.max(0, Number(ekEinsatz) || 0);
    var kum = 0;
    for (var i = 0; i < cfJahre.length; i++) {
      var c = Number(cfJahre[i]) || 0;
      kum += c;
      if (out.cf === null && c > 0) out.cf = i + 1;
      if (out.kum === null && kum > 0) out.kum = i + 1;
      if (out.kumEk === null && (kum - ek) > 0) out.kumEk = i + 1;
    }
    return out;
  }

  window.IrrEngine = {
    compute: compute,
    barwert: barwert,
    breakEven: breakEven
  };
})();
