'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V35 — BMF-AfA-Rechner (Sachwertverfahren)
   Nachbildung der Excel-Datei "Aufteilung_Grund_und_Boden.xlsx" (Fassung Juni 2023)
   
   Methodik:
     1. Bodenwert = Grundstücksfläche × Bodenrichtwert × MEA
     2. Gebäude-Sachwert per Sachwertverfahren:
        - BGF-Kostenkennwert je Standardstufe → mit Bauindex hochrechnen auf Anschaffungsjahr
        - × Wfl-Faktor (BGF→Wohnfläche-Konvertierung)
        - × Wohnfläche-Anpassung (bei Wohnungseigentum: <35m²: 1.1 / >135m²: 0.85 / sonst 1.0)
        - × 1.03 (Außenanlagen)
        - × Restwert nach Alterswertminderung (Mindestrestwert 30%)
        - × Wohnfläche
     3. Aufteilung Bodenwert/Gebäudewert proportional auf Kaufpreis
     4. AfA-Satz nach §7 EStG:
        - 2.5% wenn Baujahr <1925
        - 3.0% wenn Wohnzwecke + Bauantrag/Vertrag nach 31.12.2022
        - 2.0% sonst
═══════════════════════════════════════════════════════════════════════════ */

window.BMFAfA = (function() {

  /**
   * Berechnet das fiktive Baujahr aus Modernisierungs-Punkten
   * (gem. ImmoWertV - Modernisierungs-Tabelle aus dem Excel-Sheet "Fiktives Baujahr")
   * Punktesystem: 8 Elemente mit max. 4 oder 2 Punkten = Total 20 möglich
   * Bewertungsstufen für Restwert:
   *   18-20 P → "umfassend modernisiert"  → fiktiv max. 80% jünger
   *   13-17 P → "überwiegend modernisiert" → mittlere Verjüngung
   *    8-12 P → "mittlerer Modernisierungsgrad"
   *    4-7  P → "kleine Modernisierungen"
   *    0-3  P → keine Verjüngung
   */
  function calcFiktivesBaujahr(opts) {
    var ursprBj = parseInt(opts.baujahr) || 0;
    var anschaffJahr = parseInt(opts.anschaffungsjahr) || new Date().getFullYear();
    var punkte = parseFloat(opts.punkte) || 0;
    var gnd = parseInt(opts.gnd) || 80;

    if (!ursprBj || punkte <= 0) {
      return { fiktiv: ursprBj, modernisierungsGrad: punkte > 0 ? '–' : 'keine Modernisierung' };
    }

    // Vereinfachte Berechnung der Restnutzungsdauer-Verlängerung anhand der Punkte
    // (Excel verwendet komplexe Formeln in Zeilen 27-44 die wir hier approximieren)
    var alter = anschaffJahr - ursprBj;
    var verjüngung;
    if (punkte >= 18) verjüngung = Math.min(alter * 0.7, gnd * 0.6);
    else if (punkte >= 13) verjüngung = Math.min(alter * 0.5, gnd * 0.4);
    else if (punkte >= 8)  verjüngung = Math.min(alter * 0.3, gnd * 0.25);
    else if (punkte >= 4)  verjüngung = Math.min(alter * 0.15, gnd * 0.10);
    else verjüngung = 0;

    var fiktiv = Math.round(ursprBj + verjüngung);
    if (fiktiv > anschaffJahr) fiktiv = anschaffJahr;

    var grad =
      punkte >= 18 ? 'umfassend modernisiert' :
      punkte >= 13 ? 'überwiegend modernisiert' :
      punkte >= 8  ? 'mittlerer Modernisierungsgrad' :
      punkte >= 4  ? 'kleine Modernisierungen' : 'keine Modernisierung';

    return { fiktiv: fiktiv, modernisierungsGrad: grad, verjüngungJahre: Math.round(verjüngung) };
  }

  /**
   * Hauptberechnung Sachwertverfahren
   * @param {Object} opts
   *   - artIdx        Index in BMFData.arten
   *   - standardStufe (1-5)
   *   - kaufpreis     in € incl. Nebenkosten
   *   - baujahr       (oder fiktivesBaujahr falls Modernisierung)
   *   - anschaffungsjahr  Kalenderjahr des Kaufs
   *   - wohnflaeche   in m²
   *   - grundstueckSize  in m²
   *   - bodenrichtwert   in €/m²
   *   - mea_zaehler   bei WE/Teileigentum (z.B. 71)
   *   - mea_nenner    (z.B. 1000) — sonst 0/0 → 1
   * @returns Aufteilung mit AfA-Empfehlung
   */
  function berechne(opts) {
    if (!window.BMFData) return { error: 'BMF-Datentabellen nicht geladen' };

    var arten = window.BMFData.arten;
    var bauIdx = window.BMFData.bau_index_2010;

    var art = arten[opts.artIdx];
    if (!art) return { error: 'Grundstücksart nicht gefunden' };

    var standardStufe = parseInt(opts.standardStufe) || 3;  // Default mittlere Stufe
    if (standardStufe < 1 || standardStufe > 5) standardStufe = 3;

    var kp           = parseFloat(opts.kaufpreis) || 0;
    var baujahr      = parseInt(opts.baujahr) || 0;
    var anschJahr    = parseInt(opts.anschaffungsjahr) || new Date().getFullYear();
    var wfl          = parseFloat(opts.wohnflaeche) || 0;
    var gst          = parseFloat(opts.grundstueckSize) || 0;
    var brw          = parseFloat(opts.bodenrichtwert) || 0;
    var mea_z        = parseFloat(opts.mea_zaehler) || 0;
    var mea_n        = parseFloat(opts.mea_nenner)  || 0;

    if (!kp || !baujahr || !wfl) {
      return { error: 'Pflichtfelder fehlen: Kaufpreis, Baujahr, Wohnfläche' };
    }

    // ── BODENWERT ──
    // Bei Wohnungseigentum: Fläche × BRW × MEA
    var meaFaktor = (mea_z > 0 && mea_n > 0) ? (mea_z / mea_n) : 1;
    var istWohnungseigentum = /eigentum/i.test(art.name);
    var bodenwert;
    if (istWohnungseigentum && mea_z > 0 && mea_n > 0) {
      bodenwert = gst * brw * meaFaktor;
    } else {
      bodenwert = gst * brw;
    }

    // ── GEBÄUDESACHWERT ──
    // 1. BGF-Kostenkennwert für Standardstufe
    var bgfKennwert = art.bgf[standardStufe - 1];

    // 2. Wfl-Kostenkennwert (BGF × Wfl-Faktor)
    var wflKennwert1 = bgfKennwert * art.wfl;

    // 3. Wohnflächen-Anpassung bei Wohnungseigentum
    var wflFaktor;
    if (istWohnungseigentum || /Mietwohngrund/i.test(art.name)) {
      if (wfl <= 35) wflFaktor = 1.10;
      else if (wfl >= 135) wflFaktor = 0.85;
      else wflFaktor = 1.00;
    } else {
      wflFaktor = 1.00;
    }
    var wflKennwert2 = wflKennwert1 * wflFaktor;

    // 4. Pauschale Erhöhung um 3% (Außenanlagen)
    var wflKennwert3 = wflKennwert2 * 1.03;

    // 5. Bauindex hochrechnen auf Anschaffungsjahr (2010=100)
    var idxAnschJahr = bauIdx[anschJahr] || bauIdx[2027] || 164;
    var indexFaktor = idxAnschJahr / 100;
    var wflKennwert4_indiziert = wflKennwert3 * indexFaktor;

    // 6. Alterswertminderung (linear, Mindestrestwert 30%)
    var alter = anschJahr - baujahr;
    if (alter < 0) alter = 0;
    var restNutzung = Math.max(art.gnd - alter, art.gnd * 0.3);
    var restwertAnteil = restNutzung / art.gnd;
    if (restwertAnteil < 0.3) restwertAnteil = 0.30;  // Mindestrestwert

    var wflKennwertFinal = wflKennwert4_indiziert * restwertAnteil;

    // 7. × Wohnfläche = Gebäudesachwert
    var gebaeudeSachwert = wflKennwertFinal * wfl;

    // ── AUFTEILUNG auf Kaufpreis ──
    var summeBodenGebauede = bodenwert + gebaeudeSachwert;
    var anteilBoden = summeBodenGebauede > 0 ? bodenwert / summeBodenGebauede : 0;
    var anteilGebaeude = 1 - anteilBoden;

    var bodenAnteilAmKp = kp * anteilBoden;
    var gebaeudeAnteilAmKp = kp * anteilGebaeude;

    // ── AfA-SATZ ──
    // §7 Abs. 4 EStG
    var afaSatz;
    var afaSatzBegruendung;
    var nutzWohnzwecken = istWohnungseigentum || /wohn/i.test(art.name) || /mietwohn/i.test(art.name);

    if (baujahr < 1925) {
      afaSatz = 2.5;
      afaSatzBegruendung = 'Baujahr vor 1925 → 2,5% gem. §7 Abs. 4 Nr. 2b EStG';
    } else if (nutzWohnzwecken && anschJahr > 2022) {
      afaSatz = 3.0;
      afaSatzBegruendung = 'Wohnzwecke + Anschaffung nach 31.12.2022 → 3,0% gem. §7 Abs. 4 Nr. 2a EStG';
    } else {
      afaSatz = 2.0;
      afaSatzBegruendung = 'Standard-AfA → 2,0% gem. §7 Abs. 4 Nr. 2a EStG (Bestand)';
    }

    var afaJaehrlich = gebaeudeAnteilAmKp * afaSatz / 100;

    return {
      success: true,
      // Inputs (für Anzeige)
      art: art.name,
      standardStufe: standardStufe,
      kaufpreis: kp,
      baujahr: baujahr,
      anschaffungsjahr: anschJahr,
      wohnflaeche: wfl,
      // Bodenwert
      bodenwert: bodenwert,
      meaFaktor: meaFaktor,
      // Gebäudesachwert
      bgfKennwert: bgfKennwert,
      wflKennwert1: wflKennwert1,
      wflFaktor: wflFaktor,
      wflKennwert2: wflKennwert2,
      wflKennwert3: wflKennwert3,
      indexFaktor: indexFaktor,
      idxAnschJahr: idxAnschJahr,
      wflKennwert4_indiziert: wflKennwert4_indiziert,
      alter: alter,
      gnd: art.gnd,
      restNutzung: restNutzung,
      restwertAnteil: restwertAnteil,
      wflKennwertFinal: wflKennwertFinal,
      gebaeudeSachwert: gebaeudeSachwert,
      // Aufteilung
      anteilBoden: anteilBoden,
      anteilGebaeude: anteilGebaeude,
      bodenAnteilAmKp: bodenAnteilAmKp,
      gebaeudeAnteilAmKp: gebaeudeAnteilAmKp,
      // AfA
      afaSatz: afaSatz,
      afaSatzBegruendung: afaSatzBegruendung,
      afaJaehrlich: afaJaehrlich,
    };
  }

  return {
    berechne: berechne,
    calcFiktivesBaujahr: calcFiktivesBaujahr
  };
})();
