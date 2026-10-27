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
 * Bedingungen § 7 Abs. 5a EStG (degressiv), v3006 am Normtext:
 *   - Wohngebäude
 *   - Herstellung begonnen (Baubeginnsanzeige, Satz 2) ODER obligatorischer
 *     Vertrag (Kaufvertrag) nach dem 30.09.2023 und vor dem 01.10.2029
 *   - bei Anschaffung: bis zum Ende des Jahres der Fertigstellung (Satz 3)
 *   (bis v3005 stand hier „Bauantrag" - das ist § 7b, nicht § 7 Abs. 5a)
 *
 * Bedingungen § 7b EStG (Sonder-AfA, sehr streng):
 *   - Mietwohnung (nicht eigengenutzt)
 *   - Neubau, Bauantrag/Bauanzeige 01.01.2023 – 30.09.2029 (Abs. 2 Satz 1 Nr. 1)
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
  /* v2891 · ersterAnteil (0 < f <= 1): das Anschaffungsjahr zaehlt nur
     monatsanteilig (§ 7 Abs. 1 Satz 4 EStG). Der gekuerzte Teil geht nicht
     verloren - die Reihe laeuft weiter, bis der Restbuchwert null ist, das
     letzte Jahr holt ihn nach. Bis v2890 wurde Jahr 1 erst NACH der Reihe
     gezwoelftelt, und der Rest fehlte am Ende. */
  function linearSeries(ahk, satzPct, jahre, ersterAnteil) {
    var jahresBetrag = ahk * (satzPct / 100);
    var f1 = (ersterAnteil > 0 && ersterAnteil < 1) ? ersterAnteil : 1;
    var out = [];
    var restbuch = ahk;
    for (var i = 0; i < jahre; i++) {
      // Im letzten Jahr ggf. nur Restbuchwert (kann nicht mehr abschreiben als noch da ist)
      var abschreibung = Math.min(jahresBetrag * (i === 0 ? f1 : 1), restbuch);
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
    /* v1878 · Steuerfehler (d): der Wechsel rechnete mit linearFallback × URSPRUENGLICHER AHK.
       § 7 Abs. 5a S. 8 EStG: nach dem Wechsel bemisst sich die AfA vom RESTWERT und dem nach
       Abs. 4 unter Beruecksichtigung der RESTNUTZUNGSDAUER massgebenden Satz — also Restwert ÷
       Restnutzungsdauer. GND aus dem linearen Satz (3 % → 33,3 Jahre), Rest-ND = GND − Jahre.
       Beispiel AHK 400.000: alt Wechsel Jahr 11 auf 12.000/J, neu Jahr 14 auf 10.264/J. */
    var gndJahre = 100 / linearFallback;
    var linFix = 0;
    /* v2891: Anschaffungsjahr monatsanteilig, Jahr 2 dann vom RICHTIGEN
       Restwert (AHK 400.000, Kauf 01.10.: Jahr 1 5.000, Jahr 2 19.750 -
       bis v2890 19.000, weil Jahr 1 erst nachtraeglich gekuerzt wurde). */
    var f1 = (opts.ersterAnteil > 0 && opts.ersterAnteil < 1) ? opts.ersterAnteil : 1;

    for (var i = 0; i < jahre; i++) {
      var degBetrag = restbuch * rateDeg * (i === 0 ? f1 : 1);
      var restND = Math.max(1, gndJahre - (i === 0 ? 0 : (i - 1 + f1)));
      var linBetrag = restbuch / restND;

      var betrag;
      if (wechsel && !inLinearPhase && linBetrag * (i === 0 ? f1 : 1) > degBetrag && restbuch > 0) {   /* v2891: im Teiljahr beide gekuerzt vergleichen */
        inLinearPhase = true;
        wechselJahr = i + 1;
        linFix = linBetrag;          /* ab hier linear: fester Betrag bis zum Ende der Rest-ND */
      }

      if (inLinearPhase) {
        betrag = Math.min(linFix * (i === 0 ? f1 : 1), restbuch);
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
        linearFallback: linearFallback,
        ersterAnteil: params.ersterAnteil   /* v2891 */
      });
      normal = deg.series;
      wechselJahr = deg.wechselJahr;
      restbuch = deg.restbuchAmEnde;
    } else {
      normal = linearSeries(ahk, satz, jahre, params.ersterAnteil);   /* v2891 */
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
  /* v3006 · § 7 Abs. 5a EStG am Normtext. Bis v3005 hing die Eignung allein am
     Baujahr (2023 bis 2029). Das Gesetz knuepft aber an zwei Daten, die das
     Baujahr nicht kennt:
       (1) Beginn der Herstellung (Baubeginnsanzeige) ODER Abschluss des
           Kaufvertrags nach dem 30.09.2023 und vor dem 01.10.2029,
       (2) bei Anschaffung: Kauf bis zum Ende des Jahres der Fertigstellung.
     DealPilot kennt das Baujahr (= Fertigstellungsjahr) und das Kaufdatum
     (`kaufdat`, als Datum des Kaufvertrags gelesen). Daraus folgt:
       - Fertigstellung vor 2023 schliesst (1) aus: wer vor dem 01.10.2023 fertig
         war, hat auch vorher begonnen - und ein spaeterer Kauf scheitert an (2).
       - Fertigstellung NACH 2029 schliesst NICHT aus: Baubeginn 09/2029 und
         Fertigstellung 2031 ist begünstigt (bis v3005 hier ausgeschlossen).
       - Mit Kaufdatum: Datum im Fenster UND Kaufjahr <= Fertigstellungsjahr.
       - Ohne Kaufdatum (Bauherr oder noch offen): moeglich, die Bedingungen
         stehen im Hinweis.
     Der Hinweis bleibt ein Hinweis - gerechnet wird, was gewaehlt ist. */
  var DEG_AB = '2023-10-01', DEG_BIS = '2029-09-30';
  function checkDegressivEligibility(state) {
    var zustand = (state.ds2_zustand || '').toLowerCase();
    var baujahr = parseInt(state.baujahr, 10);
    var afaSatz = String(state.afaSatz || '');
    var kd = String(state.kaufdatum || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(kd)) kd = '';

    // Nur "neubau"-Zustand qualifiziert. Erkennt Schreibweisen:
    var isNeubau = /neubau|kernsaniert/i.test(zustand);
    if (!isNeubau) return { eligible: false, reason: 'Kein Neubau' };

    if (!baujahr || baujahr < 2023) return { eligible: false, reason: 'Fertigstellung vor 2023 - Baubeginn bzw. Kaufvertrag liegt vor dem 01.10.2023 oder nach dem Fertigstellungsjahr' };

    // Schon degressiv gewählt? Dann nicht nochmal vorschlagen.
    if (afaSatz === '5.0_deg' || afaSatz === '5.0_deg_wechsel') {
      return { eligible: false, reason: 'Degressiv bereits gewählt' };
    }

    if (kd) {
      if (kd < DEG_AB || kd > DEG_BIS) {
        return { eligible: false, reason: 'Kaufvertrag ' + kd + ' außerhalb 01.10.2023 bis 30.09.2029' };
      }
      if (parseInt(kd.slice(0, 4), 10) > baujahr) {
        return { eligible: false, reason: 'Kauf nach dem Ende des Fertigstellungsjahres ' + baujahr + ' (§ 7 Abs. 5a Satz 3 EStG)' };
      }
      return { eligible: true, pruefen: false,
        reason: 'Kaufvertrag im Zeitraum 01.10.2023 bis 30.09.2029 und im Fertigstellungsjahr - § 7 Abs. 5a EStG anwendbar' };
    }
    return { eligible: true, pruefen: true,
      reason: 'Neubau ohne Kaufdatum - anwendbar, wenn der Baubeginn (Baubeginnsanzeige) oder der Kaufvertrag zwischen dem 01.10.2023 und dem 30.09.2029 liegt und bei Kauf bis Ende des Fertigstellungsjahres gekauft wird' };
  }

  /* v3006 · Linearer Satz nach § 7 Abs. 4 Satz 1 Nr. 2 EStG - am FERTIGSTELLUNGSJAHR
     (DealPilot: Baujahr), nicht am Bauantrag:
       Buchst. a  fertiggestellt nach dem 31.12.2022           3 %   (33 1/3 Jahre)
       Buchst. b  fertiggestellt 01.01.1925 bis 31.12.2022     2 %   (50 Jahre)
       Buchst. c  fertiggestellt vor dem 01.01.1925            2,5 % (40 Jahre)
     Einzige Stelle fuer die Regel; voice-import.js und pdf-anlage-bmf.js lesen sie.
     (bmf-modal.js hat seit langem dieselbe Kette in defaultAfaSatzForBaujahr.) */
  function linearNachFertigstellung(baujahr) {
    var bj = parseInt(baujahr, 10);
    if (!bj || bj < 1000) return null;
    if (bj > 2022) return { satz: 3.0, buchst: 'a', jahre: '33 1/3', wert: '3.0' };
    if (bj < 1925) return { satz: 2.5, buchst: 'c', jahre: '40', wert: '2.5' };
    return { satz: 2.0, buchst: 'b', jahre: '50', wert: '2.0' };
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

  /* ═══ v1260 · Die ZWEITE Grenze — Zugang statt Höhe ═══════════════════════
     § 7b kennt zwei Zahlen, die leicht verwechselt werden:

       4.000 €/m²  BEMESSUNGSGRUNDLAGE — wie viel gefördert wird.
                   Steht seit V227.1 in sonder7bBasis() darüber.
       5.200 €/m²  BAUKOSTENOBERGRENZE — OB überhaupt gefördert wird.
                   Wird überschritten, entfällt die Sonder-AfA GANZ.

     Bis v1259 stand die zweite Zahl nur im Kopfkommentar dieser Datei und
     als Text neben einer Checkbox, die der Nutzer selbst abhakt
     („Baukosten ≤ 5.200 €/m² Wohnfläche"). Geprüft hat sie niemand —
     dabei kennt DealPilot Gebäude-AHK und Wohnfläche und kann rechnen.

     WARUM DAS HIER NUR PRÜFT UND NICHTS ABSCHALTET: Die Bestätigung ist
     eine Erklärung des Nutzers, und er kann Gründe haben, die DealPilot
     nicht kennt — bei Herstellung weichen die Baukosten vom Kaufpreis ab,
     bei gemischt genutzten Gebäuden zählt nur der Wohnteil. Wer hier hart
     abschaltet, nimmt einem Sachverständigen die Entscheidung aus der Hand
     und liefert ihm eine Zahl, die er nicht mehr erklären kann. Also:
     rechnen, den Widerspruch zeigen, entscheiden lassen.

     @returns {{proQm:number, grenze:number, ok:boolean, pruefbar:boolean}}
              `pruefbar:false` heißt „zu wenig Angaben" — das ist etwas
              anderes als „Grenze gerissen" und darf nie als Warnung
              erscheinen. */
  var SONDER_7B_BAUKOSTEN_GRENZE = 5200;

  function sonder7bBaukosten(ahkGebaeude, wohnflaeche) {
    var wfl = parseFloat(wohnflaeche) || 0;
    var ahk = parseFloat(ahkGebaeude) || 0;
    if (wfl <= 0 || ahk <= 0) {
      return { proQm: 0, grenze: SONDER_7B_BAUKOSTEN_GRENZE, ok: true, pruefbar: false };
    }
    var proQm = ahk / wfl;
    return {
      proQm: proQm,
      grenze: SONDER_7B_BAUKOSTEN_GRENZE,
      ok: proQm <= SONDER_7B_BAUKOSTEN_GRENZE,
      pruefbar: true
    };
  }

  // ════════════ Export ═══════════════════════════════════════════════════
  window.Afa = {
    computeSeries: computeSeries,
    linear: linearSeries,
    degressiv: degressivSeries,
    sonder7b: sonder7bSeries,
    combine: combineSeries,
    checkDegressivEligibility: checkDegressivEligibility,
    linearNachFertigstellung: linearNachFertigstellung,   /* v3006 */
    parseSelectValue: parseAfaSelectValue,
    sonder7bBasis: sonder7bBasis,
    sonder7bBaukosten: sonder7bBaukosten,   /* v1260 */
    VERSION: 'V227'
  };
})();
