'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V63.35 — Zentrale KPI-Berechnung (Excel-Logik strikt)

   Reine Funktion (kein DOM-Zugriff). Wird sowohl von Tab Kennzahlen
   (calc.js) als auch vom Quick Check (quick-check.js) genutzt, damit
   beide GARANTIERT identische Werte liefern.

   ─── V63.35 BUGFIX: Cashflow-Definition (Excel-konform) ───
   Vorher (V63.34) wurde die Warmmiete (NKM + ZE + UF) als Einnahme
   genommen und davon die GESAMT-BWK (UL+NUL) abgezogen. Wenn der User
   das Feld "Umlagefähige Kosten / Monat" (uf) leer ließ, aber bei
   Bewirtschaftung die UL-Position eintrug, fehlten die UL-Einnahmen,
   während die UL-Kosten abgezogen wurden — Cashflow wurde künstlich
   negativ.

   Excel-Logik (sauber, marktüblich):
     CF = NKM + ZE − NICHT_UMLAGEF_BEWIRT − Zinsen [ − Tilgung ] [ ± Steuer ]

   Die umlagefähigen Kosten sind ein durchlaufender Posten:
   Mieter zahlt sie 1:1 an Hausverwaltung, sie tauchen weder als
   Einnahme noch als Kosten im Eigentümer-Cashflow auf. Das deckt
   sich exakt mit der vom User vorgelegten Excel-Kalkulation.

   Inputs: Plain-Object mit den Roh-Eingaben
   Outputs: Plain-Object mit den berechneten KPIs
   ═══════════════════════════════════════════════════════════════ */

window.DealKpis = (function() {

  /**
   * Berechnet die Kern-KPIs aus den Roh-Eingaben.
   *
   * @param {Object} i — Inputs:
   *   kp          (€)        Kaufpreis
   *   nk          (€)        Erwerbsnebenkosten absolut
   *   san         (€)        Sanierung (default 0)
   *   moebl       (€)        Möblierung (default 0)
   *   nkm         (€/Mon)    Nettokaltmiete monatlich (Grundmiete)
   *   ze          (€/Mon)    Zusatzeinnahmen monatlich (Stp/Garage/Küche/Sonst)
   *   uf          (€/Mon)    Umlagen monatlich (default 0; nur für Warmmiete-Anzeige)
   *   bwk_ul      (€/Jahr)   Umlagefähige Bewirtschaftungskosten (Jahr) — durchlaufend
   *   bwk_nul     (€/Jahr)   Nicht umlagefähige Bewirtschaftungskosten (Jahr) — Eigentümer-Kosten
   *   d1, d1z, d1t           Darlehen 1 (€, Zins %, Tilgung %)
   *   d2, d2z, d2t           Darlehen 2 (€, Zins %, Tilgung %, default 0)
   *   ek          (€)        Eigenkapital
   *   afa         (€/Jahr)   AfA-Betrag (default 0)
   *   grenz       (Prozent)  Grenzsteuersatz in % (default 0)
   *
   * @returns {Object} KPIs (siehe Return-Objekt unten)
   */
  function compute(i) {
    var kp     = +i.kp     || 0;
    var nk     = +i.nk     || 0;
    var san    = +i.san    || 0;
    var moebl  = +i.moebl  || 0;
    var nkm    = +i.nkm    || 0;
    var ze     = +i.ze     || 0;
    var uf     = +i.uf     || 0;
    var bwk_ul  = +i.bwk_ul  || 0;
    var bwk_nul = +i.bwk_nul || 0;
    var d1     = +i.d1     || 0;
    var d1z    = (+i.d1z   || 0) / 100;
    var d1t    = (+i.d1t   || 0) / 100;
    var d2     = +i.d2     || 0;
    var d2z    = (+i.d2z   || 0) / 100;
    var d2t    = (+i.d2t   || 0) / 100;
    var ek     = +i.ek     || 0;
    var afa    = +i.afa    || 0;
    var grenz  = (+i.grenz || 0) / 100;

    // ═════ Investition ═════
    var gi = kp + nk + san + moebl;

    // ═════ Mietaufstellung ═════
    var wm_m  = nkm + ze + uf;          // Warmmiete für UI-Anzeige
    var wm_j  = wm_m * 12;
    var nkm_j = (nkm + ze) * 12;        // Nettokaltmiete + Zusatzeinnahmen p.a.

    // ═════ Bewirtschaftung ═════
    // V63.35: Cashflow-relevant ist NUR der nicht-umlagefähige Teil.
    // bwk_total bleibt als Brutto-Kennzahl erhalten (für NMR und Anzeige).
    var bwk_cf = bwk_nul;                // Cashflow-relevante BWK = nicht umlagef.
    var bwk = bwk_ul + bwk_nul;          // Gesamt-BWK (für Anzeige, NMR, Bewirt-Quote)

    // ═════ Darlehen-Rate ═════
    var d1_rate_m = (d1 * (d1z + d1t)) / 12;
    var d1_zm     = (d1 * d1z) / 12;
    var d1_tm     = d1_rate_m - d1_zm;

    var d2_rate_m = (d2 * (d2z + d2t)) / 12;
    var d2_zm     = (d2 * d2z) / 12;
    var d2_tm     = d2_rate_m - d2_zm;

    var d_total = d1 + d2;
    // V63.36: 3-stufige LTV-Logik
    //   Wenn ekInklNkLtv = true → LTV/GI (konservativ)
    //   Sonst wenn svw > 0       → LTV/SVW (Bankenpraxis, Beleihungswert)
    //   Sonst                    → LTV/KP  (Fallback)
    var _ekInklNkLtv = !!i.ekInklNkLtv;
    var svw          = +i.svw || 0;
    var ltv_basis;
    if (_ekInklNkLtv) ltv_basis = gi;
    else if (svw > 0) ltv_basis = svw;
    else ltv_basis = kp;
    var ltv = ltv_basis > 0 ? (d_total / ltv_basis * 100) : 0;

    var zins_j = (d1_zm + d2_zm) * 12;
    var tilg_j = (d1_tm + d2_tm) * 12;
    var rate_j = zins_j + tilg_j;

    // ═════ Cashflow — V63.40: User-Wunsch "CF v.St. = IMMER nach Tilgung" ═════
    // CF v.St. = Banker-Cashflow (nach Tilgung, vor Steuer) — was aus eigener Tasche zuzuschießen
    // CF n.St. = CF v.St. − Steuer (Banker-Cashflow nach Steuereffekt)
    // Steuerberechnung läuft auf den OPERATIVEN CF (vor Tilgung), weil Tilgung steuerlich
    // nicht abziehbar ist — Standard-Logik.
    var cf_operativ = nkm_j - bwk_cf - zins_j;        // intern: vor Tilg, für Steuer-Bemessung
    var zve_immo    = cf_operativ - afa;
    var steuer      = zve_immo * grenz;               // negativ = Erstattung
    // Öffentliche CF-Werte (in der App immer nach Tilgung)
    var cf_op    = cf_operativ - tilg_j;              // = Banker-CF v.St., NACH Tilgung
    var cf_ns    = cf_op - steuer;                    // = Banker-CF n.St., NACH Tilgung
    var cf_m     = cf_op / 12;                        // /Mon vor Steuer
    var cf_ns_m  = cf_ns / 12;                        // /Mon nach Steuer
    // Banker-Cashflow (legacy, identisch zu cf_op)
    var cf_banker_j = cf_op;
    var cf_banker_m = cf_m;
    // Operativer CF nach Steuer (vor Tilgung) — für interne Berechnungen / kompatibel
    var cf_ns_operativ = cf_operativ - steuer;
    // Vollständiger Eigentümer-CF (= cf_ns)
    var cf_full_j = cf_ns;
    var cf_full_m = cf_ns_m;

    // ═════ DSCR (brutto + netto) ═════
    var kd_dscr     = zins_j + tilg_j;
    var dscr        = kd_dscr > 0 ? (nkm_j / kd_dscr) : 0;
    var dscr_netto  = kd_dscr > 0 ? ((nkm_j - bwk_cf) / kd_dscr) : 0;
    var noi_dscr    = nkm_j;

    // ═════ Renditen ═════
    var bmy = kp > 0 ? (nkm_j / kp * 100) : 0;
    // NMR auf Eigentümer-Sicht: NKM minus nicht-umlagef. (umlagef. ist neutral)
    var nmy = gi > 0 ? ((nkm_j - bwk_nul) / gi * 100) : 0;
    var fak = nkm_j > 0 ? (kp / nkm_j) : 0;

    // EK-Rendite auf Banker-Cashflow
    var ekr = ek > 0 ? (cf_banker_j / ek * 100) : 0;

    return {
      // Investition
      gi: gi,
      // Mieten
      wm_m: wm_m, wm_j: wm_j, nkm_j: nkm_j,
      // BWK
      bwk: bwk, bwk_cf: bwk_cf, bwk_ul: bwk_ul, bwk_nul: bwk_nul,
      // Finanzierung
      d_total: d_total, ltv: ltv,
      zins_j: zins_j, tilg_j: tilg_j, rate_j: rate_j,
      // Cashflow
      cf_op: cf_op, zve_immo: zve_immo, steuer: steuer,
      cf_ns: cf_ns, cf_m: cf_m, cf_ns_m: cf_ns_m,
      cf_banker_j: cf_banker_j, cf_banker_m: cf_banker_m,
      cf_full_j: cf_full_j, cf_full_m: cf_full_m,
      // Renditen
      bmy: bmy, nmy: nmy, fak: fak,
      // DSCR
      dscr: dscr, dscr_netto: dscr_netto, noi_dscr: noi_dscr, kd_dscr: kd_dscr,
      // EK-Rendite
      ekr: ekr
    };
  }

  return { compute: compute };
})();
