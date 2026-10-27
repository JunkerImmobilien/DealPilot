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
   *   svw         (€)        Wertangabe (Verkehrs-/Marktwert, default 0)
   *   svw_herkunft (Text)    v3006: gutachten | bank | marktbericht | indikation | eigene.
   *                          Nur gutachten/bank tragen den LTV (wie calc.js seit v2996).
   *                          FEHLT das Feld, gilt svw wie bis v3005 (Telegram/Altaufrufer).
   *   bankval     (€)        v3006: Bankbewertung, LTV-Basis, wenn svw nicht traegt
   *   bspar_y     (€/Jahr)   v3006: Bausparrate bei Tilgungsaussetzung (default 0) -
   *                          Schuldendienst im DSCR und Abfluss im Cashflow wie calc.js
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
    /* ── v1898 · DER STEUERLICHE BEWIRTSCHAFTUNGSABZUG ──────────────────
     *
     * Marcel am 06.10.2026: „das Mietausfallrisiko, das darf nicht mit in
     * die Werbungskosten."
     *
     * Das Mietausfallwagnis steckt in `bwk_nul` und gehoert dort hin: fuer
     * Cashflow, DSCR und Nettomietrendite ist es ein Liquiditaetspuffer.
     * Steuerlich ist es KEIN Werbungskostenabzug — § 9 Abs. 1 Satz 1 EStG
     * verlangt eine Aufwendung, und ein kalkulatorisches Wagnis
     * (§ 19 Abs. 2 Nr. 4 ImmoWertV) wird nie gezahlt.
     *
     * `bwk_nul_st` ist deshalb OPTIONAL: wer es nicht mitgibt, rechnet wie
     * bisher (die Zahl ist dann dieselbe). Wer einen getrennt erfassten
     * Mietausfall hat, gibt `bwk_nul` MINUS Wagnis mit — und nur die
     * Steuerzeile aendert sich. `Number(null)` ist 0 und bestaende
     * `isFinite`, darum wird hier auf ABWESENHEIT geprueft, nicht auf
     * Wahrheitswert. */
    var bwk_nul_st = (i.bwk_nul_st == null || !isFinite(+i.bwk_nul_st))
      ? bwk_nul : (+i.bwk_nul_st);
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
    /* v2261 · Marcel am 15.10.2026: „Inventar ist nicht zusaetzlich." Es ist Teil des
       Kaufpreises (separates Wirtschaftsgut darin) - die Gesamtinvestition ist
       Kaufpreis + Nebenkosten + Sanierung. Bis hier kam `moebl` noch einmal oben
       drauf; BMF-Rechner und Inventar-Box zogen es dagegen vom Kaufpreis ab. */
    var gi = kp + nk + san;

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
    /* v3006 · Die Herkunft entscheidet, ob der Wert den LTV traegt (calc.js, v2996):
       nur Gutachten und Bankbewertung. Bis v3005 nahm der Kern jeden Wert > 0 -
       der Quick-Check rechnete den LTV damit auch auf eine eigene Schaetzung oder
       auf Angebotsniveau, die Haupt-App nicht. Ohne Angabe bleibt es beim alten
       Verhalten, damit Aufrufer ohne Herkunft nicht still umspringen. */
    var _herk        = (i.svw_herkunft == null) ? null : String(i.svw_herkunft);
    var _svwTraegt   = svw > 0 && (_herk === null || _herk === 'gutachten' || _herk === 'bank');
    var bankval      = +i.bankval || 0;
    var ltv_basis;
    if (_ekInklNkLtv) ltv_basis = gi;
    else if (_svwTraegt) ltv_basis = svw;
    else if (bankval > 0) ltv_basis = bankval;
    else ltv_basis = kp;
    var ltv = ltv_basis > 0 ? (d_total / ltv_basis * 100) : 0;

    var zins_j = (d1_zm + d2_zm) * 12;
    var tilg_j = (d1_tm + d2_tm) * 12;
    var rate_j = zins_j + tilg_j;
    /* v3006 · `bspar_y` war hier nie deklariert: `typeof bspar_y` ergab immer
       'undefined', die Bausparrate ging mit 0 in den DSCR - lautlos, weil typeof
       keinen ReferenceError wirft. Jetzt ein Eingabefeld wie in calc.js
       (Tilgungsaussetzung + Bausparvertrag): Schuldendienst im DSCR und Abfluss im
       Cashflow. Kein heutiger Aufrufer liefert es, die Zahlen bleiben gleich. */
    var bspar_y = +i.bspar_y || 0;

    // ═════ Cashflow — V63.40: User-Wunsch "CF v.St. = IMMER nach Tilgung" ═════
    // CF v.St. = Banker-Cashflow (nach Tilgung, vor Steuer) — was aus eigener Tasche zuzuschießen
    // CF n.St. = CF v.St. − Steuer (Banker-Cashflow nach Steuereffekt)
    // Steuerberechnung läuft auf den OPERATIVEN CF (vor Tilgung), weil Tilgung steuerlich
    // nicht abziehbar ist — Standard-Logik.
    var cf_operativ = nkm_j - bwk_cf - zins_j;        // intern: vor Tilg, für den Cashflow
    /* v1898: die Steuerbemessung laeuft gegen bwk_nul_st (ohne Wagnis),
       der Cashflow gegen bwk_cf. Ohne getrennten Mietausfall sind beide
       Zahlen identisch und das Ergebnis bitgleich zu vorher. */
    var zve_immo    = (nkm_j - bwk_nul_st - zins_j) - afa;
    var steuer      = zve_immo * grenz;               // negativ = Erstattung
    // Öffentliche CF-Werte (in der App immer nach Tilgung)
    var cf_op    = cf_operativ - tilg_j - bspar_y;    // = Banker-CF v.St., NACH Tilgung (und BSV, v3006)
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

    // ═════ DSCR (brutto + netto) ═════ V231: zentral via Dscr.compute()
    // BSV-Sparrate wird als wirtschaftlicher Tilgungsersatz mit eingerechnet
    // (konsistent mit calc.js und Cashflow-Box). bspar_y kommt aus input,
    // Fallback 0 wenn nicht geliefert (Bar-Kauf oder normaler Annuitätenkredit).
    var _dscrR = (typeof window.Dscr !== 'undefined' && window.Dscr)
      ? window.Dscr.compute({
          nkm_j:  nkm_j,
          ze_j:   0,           // ZE ist hier schon in nkm_j enthalten (Service-Layer ohne ZE-Trennung)
          zins_j: zins_j,
          tilg_j: tilg_j,
          bsv_j:  bspar_y,
          bwk_cf: bwk_cf
        })
      : (function () {
          // Fallback wenn Engine nicht geladen — alte Formel mit BSV erweitert
          var _kd = zins_j + tilg_j + bspar_y;
          return {
            brutto: _kd > 0 ? nkm_j / _kd : 0,
            netto:  _kd > 0 ? (nkm_j - bwk_cf) / _kd : 0,
            kd:     _kd,
            noi_brutto: nkm_j
          };
        })();
    var kd_dscr     = _dscrR.kd;
    var dscr        = _dscrR.brutto;
    var dscr_netto  = _dscrR.netto;
    var noi_dscr    = _dscrR.noi_brutto;

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
      bwk_nul_st: bwk_nul_st,   /* v1898: der steuerlich abziehbare Teil */
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

  /* ═══ v3006b · GEBAEUDE-ANSCHAFFUNGSKOSTEN, EINE RECHNUNG ══════════════════
     Bemessungsgrundlage der Gebaeude-AfA (§ 7 Abs. 4 EStG) sind die
     Anschaffungskosten des Gebaeudes EINSCHLIESSLICH der anteiligen
     Erwerbsnebenkosten (§ 255 Abs. 1 HGB). Bis v3006a stand die Formel dreimal:
     calc.js (mit Nebenkosten), quick-check.js (OHNE Nebenkosten: kp x geb_ant x
     Satz) und agentWerkzeuge.js (mit Nebenkosten, ohne Inventar). Jetzt hier,
     und alle drei lesen sie.

     Inventar (Kueche, Moebel), das im Kaufpreis steckt und ausgewiesen ist,
     ist ein eigenes Wirtschaftsgut: es kommt VOR der Aufteilung Gebaeude/Boden
     vom Kaufpreis ab, und die Nebenkosten verteilen sich im Verhaeltnis der
     Kaufpreisanteile auf Grundstueck und Inventar. Bis v3006a lief der Anteil
     der Nebenkosten, der auf das Inventar entfaellt, mit in Gebaeude und Boden.

     Eingabe: kp (€), nk (€, alle Erwerbsnebenkosten), gebAntPct (0-100),
       inventar (€, im Kaufpreis enthalten, default 0), nkAbzug (€, Nebenkosten,
       die keine Anschaffungskosten sind - die Grundschuld, calc.js v3006),
       nkNurImmo (€, v3006c: Nebenkosten, die NUR das Grundstueck betreffen -
       die Grunderwerbsteuer; sie geht nie anteilig aufs Inventar).
     Liest keine Einstellung und kein DOM. */
  function gebaeudeAhk(i) {
    i = i || {};
    var kp = +i.kp || 0;
    var geb = (i.gebAntPct == null || !isFinite(+i.gebAntPct)) ? 0 : (+i.gebAntPct / 100);
    var inv = Math.max(0, +i.inventar || 0);
    /* v3006d · ein Anteil ausserhalb 0-100 % ist keine Aufteilung (gemessen: Selbsttest der
       BMF-Pipeline lieferte -24,93 %); dann zaehlt der Kaufpreis als Obergrenze des Inventars */
    if (!(geb >= 0 && geb <= 1)) geb = Math.min(1, Math.max(0, geb || 0));
    /* v3006e: kein Deckel beim Gebaeudeanteil mehr (Inventar ist kein Teil des Gebaeudes), nur beim Kaufpreis */
    if (inv > kp) inv = kp;
    var nk = Math.max(0, (+i.nk || 0) - Math.max(0, +i.nkAbzug || 0));
    var nkNurImmo = Math.min(nk, Math.max(0, +i.nkNurImmo || 0));
    var nkAnteilig = nk - nkNurImmo;
    var kpOhneInv = kp - inv;
    var anteilImmo = kp > 0 ? kpOhneInv / kp : 1;
    var nkImmo = nkAnteilig * anteilImmo + nkNurImmo;
    var nkInv = nk - nkImmo;
    var gebKp = kpOhneInv * geb;
    var nkGeb = nkImmo * geb;
    return {
      kpOhneInv: kpOhneInv, inventar: inv,
      gebKp: gebKp, nkGeb: nkGeb, gebAhk: gebKp + nkGeb,
      nkImmo: nkImmo, nkInv: nkInv, invAk: inv + nkInv,
      nkQuote: kp > 0 ? nk / kp : 0,                /* Nebenkosten je Euro Kaufpreis */
      nkInvQuote: inv > 0 ? nkInv / inv : 0         /* v3006c: Nebenkosten je Euro Inventar */
    };
  }

  /* ═══ v3006c · ERWERBSNEBENKOSTEN, EINE RECHNUNG ═══════════════════════════
     Grunderwerbsteuer faellt nur auf das GRUNDSTUECK an (§ 1, § 2 GrEStG):
     bewegliches Inventar (Kueche, Moebel), das im Kaufvertrag gesondert und
     angemessen ausgewiesen ist, gehoert nicht zur Gegenleistung (§ 8, § 9
     GrEStG). Bemessung: (Kaufpreis - Inventar) x Satz. Makler, Notar,
     Grundbuch und Sonstige bleiben auf dem Gesamtpreis - so stehen sie in den
     Feldern (Prozent vom Kaufpreis), und so rechnet auch die Gebuehr.
     Bis v3006b: kp x Satz, also 650 € zu viel bei 10.000 € Inventar und 6,5 %.
     Eingabe: kp (€), inventar (€), makler_p, notar_p, gba_p, gest_p, ji_p (Prozent).
     Liest keine Einstellung und kein DOM. */
  function grestBasis(kp, inventar) {
    kp = +kp || 0;
    var inv = Math.min(kp, Math.max(0, +inventar || 0));
    return kp - inv;
  }
  function nebenkosten(i) {
    i = i || {};
    var kp = +i.kp || 0;
    var p = function (x) { var n = +x; return isFinite(n) && n > 0 ? n / 100 : 0; };
    var basisGrest = grestBasis(kp, i.inventar);
    var r = {
      makler: kp * p(i.makler_p), notar: kp * p(i.notar_p), gba: kp * p(i.gba_p),
      grest: basisGrest * p(i.gest_p), ji: kp * p(i.ji_p), grestBasis: basisGrest
    };
    r.summe = r.makler + r.notar + r.gba + r.grest + r.ji;
    return r;
  }

  return { compute: compute, gebaeudeAhk: gebaeudeAhk, nebenkosten: nebenkosten, grestBasis: grestBasis };
})();
