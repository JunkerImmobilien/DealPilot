'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot v2240 — schwellen.js
   EINE Quelle fuer die Ampel-Schwellen von DSCR, LTV und Cashflow.

   Marcels Entscheidung „Alle Ampeln": die persoenlichen Mindest-
   Schwellen aus den Einstellungen (min_dscr, max_ltv,
   min_cashflow_vor_st in dp_investment_profile) steuern JEDE Ampel —
   nicht nur „Deine Kaufgrenzen" (dealscore2-ui.js).

   Ableitung:
     DSCR      gruen ab min_dscr · gelb ab min(1,0; min_dscr) · sonst rot
     LTV       gruen bis max_ltv · gelb bis 100 % · darueber rot
     Cashflow  gruen ab min_cashflow · gelb ab min(0; min_cashflow) · sonst rot

   Ohne Einstellung gelten die Vorgaben aus
   DealPilotConfig.investmentProfileDefaults (1,20 / 90 / 0).

   Die Rechenkerne (dscr-engine.js, qc-heuristik.js) lesen dieses Modul
   NIE — sie bekommen das Ergebnis von get() als Parameter. Ein Kern
   laeuft im Backend ohne Browser und ohne Einstellungen.

   Im Quick-Check-iframe (eigenes Dokument, gleiche Herkunft) liest das
   Modul das Profil der Haupt-App ueber window.parent.
═══════════════════════════════════════════════════════════════ */

window.DealPilotSchwellen = (function () {

  /* Letzter Rueckfall, falls weder Profil noch Config erreichbar sind.
     Dieselben Zahlen wie config.js investmentProfileDefaults. */
  var NOTFALL = { min_dscr: 1.2, max_ltv: 90, min_cashflow_vor_st: 0 };

  function _ausFenster(name) {
    try { if (window[name]) return window[name]; } catch (e) {}
    try { if (window.parent && window.parent !== window && window.parent[name]) return window.parent[name]; } catch (e) {}
    return null;
  }

  function _zahl(v) {
    if (v == null || v === '') return null;
    var n = (typeof v === 'number') ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function _wert(key) {
    var IP = _ausFenster('DealPilotInvestmentProfile');
    var n = null;
    try { if (IP && typeof IP.get === 'function') n = _zahl(IP.get(key)); } catch (e) { n = null; }
    if (n == null) {
      var C = _ausFenster('DealPilotConfig');
      var D = (C && C.investmentProfileDefaults) || {};
      n = _zahl(D[key]);
    }
    if (n == null) n = NOTFALL[key];
    return n;
  }

  function get() {
    var minD = _wert('min_dscr');
    if (!(minD > 0)) minD = NOTFALL.min_dscr;
    var maxL = _wert('max_ltv');
    if (!(maxL > 0)) maxL = NOTFALL.max_ltv;
    var cf = _wert('min_cashflow_vor_st');
    return {
      dscrGruen: minD,
      dscrGelb:  Math.min(1.0, minD),
      ltvGruen:  maxL,
      ltvRot:    Math.max(100, maxL),   /* ueber diesem Wert rot */
      cfMin:     cf,
      cfGruen:   cf,
      cfGelb:    Math.min(0, cf)
    };
  }

  /* Stufe je Kennzahl: 'gruen' | 'gelb' | 'rot' | null (kein Wert) */
  function dscr(v, s) {
    var n = _zahl(v); if (n == null) return null;
    s = s || get();
    return n >= s.dscrGruen ? 'gruen' : n >= s.dscrGelb ? 'gelb' : 'rot';
  }
  function ltv(v, s) {
    var n = _zahl(v); if (n == null) return null;
    s = s || get();
    return n <= s.ltvGruen ? 'gruen' : n <= s.ltvRot ? 'gelb' : 'rot';
  }
  function cashflow(v, s) {
    var n = _zahl(v); if (n == null) return null;
    s = s || get();
    return n >= s.cfGruen ? 'gruen' : n >= s.cfGelb ? 'gelb' : 'rot';
  }

  /* Anzeige der Schwellen fuer Beschriftungen und Legenden */
  function fmtDscr(n) { return Number(n).toFixed(2).replace('.', ','); }
  function fmtPct(n)  { var r = Math.round(Number(n) * 10) / 10; return String(r).replace('.', ','); }
  function fmtEuro(n) { return Math.round(Number(n)).toLocaleString('de-DE'); }

  return {
    get: get,
    dscr: dscr,
    ltv: ltv,
    cashflow: cashflow,
    fmtDscr: fmtDscr,
    fmtPct: fmtPct,
    fmtEuro: fmtEuro
  };
})();
