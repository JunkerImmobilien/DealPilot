/**
 * DealPilot — Restnutzungsdauer-Rechner V3
 * ============================================
 * KORRIGIERTE Technische RND-Formel basierend auf beiden Original-Gutachten:
 *   - 25DG06644 (Großkugel WE 03): 100% veraltet → 22 J. ✓
 *   - 25DG02661 (Großkugel WE 18): 85% veraltet, 15% standard, 0% gehoben → 26 J. ✓
 *
 * Korrekte Formel (aus beiden Gutachten Kap. 5.3.3 abgeleitet):
 *   RND-Basis      = GND - Alter
 *   Abzug          = RND-Basis × veraltet% / 2
 *   Aufschlag Std. = RND-Basis × standard% / 2
 *   Aufschlag Geh. = RND-Basis × gehoben%
 *   RND            = RND-Basis − Abzug + Aufschlag_Std + Aufschlag_Geh
 *
 * Die GUTACHTER-LOGIK behandelt Standard NICHT neutral, sondern als positive
 * Halbierung. "Gehoben" wirkt mit voller Gewichtung.
 *
 * Punktrastermethode: identisch geblieben, war korrekt.
 */
(function (global) {
  'use strict';

  // PUNKTRASTER-KOEFFIZIENTEN (Anlage 2 ImmoWertV) — unverändert
  const PUNKTRASTER_KOEFF = [
    { a: 1.2500, b: 2.6250, c: 1.5250, rel: 60 },
    { a: 1.2500, b: 2.6250, c: 1.5250, rel: 60 },
    { a: 1.0767, b: 2.2757, c: 1.3878, rel: 55 },
    { a: 0.9033, b: 1.9263, c: 1.2505, rel: 55 },
    { a: 0.7300, b: 1.5770, c: 1.1133, rel: 40 },
    { a: 0.6725, b: 1.4578, c: 1.0850, rel: 35 },
    { a: 0.6150, b: 1.3385, c: 1.0567, rel: 30 },
    { a: 0.5575, b: 1.2193, c: 1.0283, rel: 25 },
    { a: 0.5000, b: 1.1000, c: 1.0000, rel: 20 },
    { a: 0.4660, b: 1.0270, c: 0.9906, rel: 19 },
    { a: 0.4320, b: 0.9540, c: 0.9811, rel: 18 },
    { a: 0.3980, b: 0.8810, c: 0.9717, rel: 17 },
    { a: 0.3640, b: 0.8810, c: 0.9622, rel: 16 },
    { a: 0.3300, b: 0.7350, c: 0.9528, rel: 15 },
    { a: 0.3040, b: 0.6760, c: 0.9506, rel: 14 },
    { a: 0.2780, b: 0.6170, c: 0.9485, rel: 13 },
    { a: 0.2520, b: 0.5580, c: 0.9463, rel: 12 },
    { a: 0.2260, b: 0.4990, c: 0.9442, rel: 11 },
    { a: 0.2000, b: 0.4400, c: 0.9420, rel: 10 },
    { a: 0.2000, b: 0.4400, c: 0.9420, rel: 10 },
    { a: 0.2000, b: 0.4400, c: 0.9420, rel: 10 }
  ];

  const MOD_ELEMENTS = [
    { id: 'dach',         label: 'Dacherneuerung inkl. Wärmedämmung',          max: 4 },
    { id: 'fenster',      label: 'Modernisierung Fenster und Außentüren',      max: 2 },
    { id: 'leitungen',    label: 'Leitungssysteme (Strom/Gas/Wasser/Abwasser)', max: 2 },
    { id: 'heizung',      label: 'Modernisierung Heizungsanlage',              max: 2 },
    { id: 'aussenwand',   label: 'Wärmedämmung Außenwände',                    max: 4 },
    { id: 'baeder',       label: 'Modernisierung Bäder',                       max: 2 },
    { id: 'innenausbau',  label: 'Innenausbau (Decken/Fußböden/Treppen)',      max: 2 },
    { id: 'grundriss',    label: 'Verbesserung Grundrissgestaltung',           max: 2 }
  ];

  // 9 Gewerke mit Standard-Gewichtung lt. Original-Gutachten
  const GEWERKE = [
    { id: 'dach',         label: 'Dachkonstruktion inkl. Wärmedämmung',  weight: 15 },
    { id: 'fenster',      label: 'Fenster / Außentüren',                 weight: 15 },
    { id: 'leitungen',    label: 'Leitungssysteme',                      weight:  5 },
    { id: 'heizung',      label: 'Heizungsanlage',                       weight: 15 },
    { id: 'aussenwand',   label: 'Außenwände inkl. Wärmedämmung',        weight: 10 },
    { id: 'baeder',       label: 'Ausbau Bäder',                         weight:  5 },
    { id: 'decken',       label: 'Deckenkonstruktion inkl. Wärmedämmung',weight:  5 },
    { id: 'technik',      label: 'Technische Ausstattung',               weight: 15 },
    { id: 'grundriss',    label: 'Wesentliche Veränderung Grundriss',    weight: 15 }
  ];

  const GRADE = {
    veraltet: { id: 'veraltet', label: 'niedrig / veraltet' },
    standard: { id: 'standard', label: 'aktueller Standard' },
    gehoben:  { id: 'gehoben',  label: 'zukunftsorientiert / gehoben' }
  };

  // Schadens-Katalog mit orientierenden RND-Abschlägen (BFH IX R 7/12)
  const SCHADEN_KATALOG = [
    { id: 'feuchte_keller',     label: 'Aufsteigende Feuchtigkeit im Keller',      abschlag: 5 },
    { id: 'feuchte_wand',       label: 'Feuchteschäden in Wohnräumen',             abschlag: 8 },
    { id: 'schimmel',           label: 'Schimmelbefall',                           abschlag: 10 },
    { id: 'rohrleitung_defekt', label: 'Rohrleitungen häufig verstopft/defekt',    abschlag: 5 },
    { id: 'schaedling',         label: 'Schädlingsbefall (Mäuse, Holzwurm etc.)',  abschlag: 5 },
    { id: 'rissbildung_innen',  label: 'Rissbildung Innenwände (nicht statisch)',  abschlag: 3 },
    { id: 'rissbildung_aussen', label: 'Rissbildung Fassade (nicht statisch)',     abschlag: 5 },
    { id: 'standsicherheit',    label: 'Standsicherheits-/Tragwerksmängel',        abschlag: 25 },
    { id: 'dach_undicht',       label: 'Dach undicht / Wassereintritt',            abschlag: 10 },
    { id: 'heizung_defekt',     label: 'Heizung dauerhaft defekt/unterdimensioniert', abschlag: 8 },
    { id: 'asbest',             label: 'Asbestbelastung',                          abschlag: 15 },
    { id: 'schadstoff_andere',  label: 'Andere Schadstoffe (PCB, KMF etc.)',       abschlag: 10 },
    { id: 'energetisch_kritisch', label: 'Energieausweis F/G/H',                   abschlag: 5 }
  ];

  // ============================================================
  // VERFAHREN 1: Linear
  // ============================================================
  function calcLinear(alter, gnd) {
    const rnd = Math.max(0, gnd - alter);
    const awm = gnd > 0 ? (alter / gnd) * 100 : 0;
    return {
      method: 'linear',
      label: 'Lineare Alterswertminderung',
      alterswertminderung_pct: round2(awm),
      restnutzungsdauer: round2(rnd),
      formula: alter + ' Jahre / ' + gnd + ' Jahre × 100 = ' + round2(awm) + ' %',
      formula_short: 'w = A/G × 100',
      result_text: 'Lineare RND: ' + round2(rnd) + ' Jahre (' + round2(awm) + '% AWM)'
    };
  }

  // ============================================================
  // VERFAHREN 2: Vogels
  // ============================================================
  function calcVogels(alter, gnd) {
    if (gnd <= 0) return null;
    const ratio = alter / gnd;
    const awm = (-0.4 * ratio * ratio + 1.2 * ratio) * 100;
    const awmClamped = Math.max(0, Math.min(100, awm));
    const rnd = Math.max(0, gnd * (1 - awmClamped / 100));
    return {
      method: 'vogels',
      label: 'Alterswertminderung nach Vogels',
      alterswertminderung_pct: round2(awmClamped),
      restnutzungsdauer: round2(rnd),
      formula: '(-0,4 × (' + alter + '/' + gnd + ')² + 1,2 × (' + alter + '/' + gnd + ')) × 100 = '
             + round2(awmClamped) + ' %',
      formula_short: 'w = (-0,4·(A/G)² + 1,2·(A/G)) × 100',
      result_text: 'Vogels-RND: ' + round2(rnd) + ' Jahre (' + round2(awmClamped) + '% AWM)'
    };
  }

  // ============================================================
  // VERFAHREN 3: Ross
  // ============================================================
  function calcRoss(alter, gnd) {
    if (gnd <= 0) return null;
    const ratio = alter / gnd;
    const awm = 0.5 * (ratio * ratio + ratio) * 100;
    const awmClamped = Math.max(0, Math.min(100, awm));
    const rnd = Math.max(0, gnd * (1 - awmClamped / 100));
    return {
      method: 'ross',
      label: 'Alterswertminderung nach Ross',
      alterswertminderung_pct: round2(awmClamped),
      restnutzungsdauer: round2(rnd),
      formula: '½ × ((' + alter + '/' + gnd + ')² + (' + alter + '/' + gnd + ')) × 100 = '
             + round2(awmClamped) + ' %',
      formula_short: 'w = ½ · ((A/G)² + (A/G)) × 100',
      result_text: 'Ross-RND: ' + round2(rnd) + ' Jahre (' + round2(awmClamped) + '% AWM)',
      note: 'Historisches Verfahren — in ImmoWertV nicht mehr aufgenommen.'
    };
  }

  // ============================================================
  // VERFAHREN 4: Parabel
  // ============================================================
  function calcParabel(alter, gnd) {
    if (gnd <= 0) return null;
    const ratio = alter / gnd;
    const awm = ratio * ratio * 100;
    const awmClamped = Math.max(0, Math.min(100, awm));
    const rnd = Math.max(0, gnd * (1 - awmClamped / 100));
    return {
      method: 'parabel',
      label: 'Parabelförmige Wertminderung',
      alterswertminderung_pct: round2(awmClamped),
      restnutzungsdauer: round2(rnd),
      formula: '(' + alter + '/' + gnd + ')² × 100 = ' + round2(awmClamped) + ' %',
      formula_short: 'w = (A/G)² × 100',
      result_text: 'Parabel-RND: ' + round2(rnd) + ' Jahre (' + round2(awmClamped) + '% AWM)'
    };
  }

  // ============================================================
  // VERFAHREN 5: Punktrastermethode (unverändert — war korrekt)
  // ============================================================
  function calcPunktraster(alter, gnd, modPoints) {
    const punkte = clampInt(modPoints, 0, 20);
    const k = PUNKTRASTER_KOEFF[punkte];
    const relAlter = gnd > 0 ? (alter / gnd) * 100 : 0;

    let rnd = (k.a * alter * alter / gnd) - (k.b * alter) + (k.c * gnd);
    rnd = Math.max(0, rnd);
    if (rnd > gnd) rnd = gnd;

    const awm = gnd > 0 ? ((gnd - rnd) / gnd) * 100 : 0;

    // Formatiere wie im Original-Gutachten:
    // "1,2500 x 30 Jahre² / 70 Jahre - 2,6250 x 30 Jahre + 1,5250 * 70 Jahre = 44,07 Jahre"
    const formula = fmtNum4(k.a) + ' × ' + alter + ' Jahre² / ' + gnd + ' Jahre - '
                  + fmtNum4(k.b) + ' × ' + alter + ' Jahre + '
                  + fmtNum4(k.c) + ' × ' + gnd + ' Jahre = ' + fmtNum2(rnd) + ' Jahre';

    return {
      method: 'punktraster',
      label: 'Punktrastermethode (ImmoWertV Anl. 2)',
      modernisierungspunkte: punkte,
      modernisierungsgrad_text: punkteToGrad(punkte),
      relatives_alter_pct: round2(relAlter),
      koeffizienten: { a: k.a, b: k.b, c: k.c, schwelle_rel: k.rel },
      alterswertminderung_pct: round2(awm),
      restnutzungsdauer: round2(rnd),
      formula: formula,
      formula_short: 'RND = a·A²/G - b·A + c·G',
      result_text: 'Punktraster-RND: ' + round2(rnd) + ' Jahre (' + round2(awm) + '% AWM, '
                 + punkte + ' Mod.-Punkte)'
    };
  }

  // ============================================================
  // VERFAHREN 6: Technische Restnutzungsdauer — KORRIGIERT V3
  // ============================================================
  /**
   * Korrigierte Formel basierend auf beiden Original-Gutachten:
   *   Niedrig/veraltet:    RND-Basis × Anteil/100 / 2  → ABZUG
   *   Aktueller Standard:  RND-Basis × Anteil/100 / 2  → AUFSCHLAG (NICHT neutral!)
   *   Zukunftsorientiert:  RND-Basis × Anteil/100      → AUFSCHLAG (volle Gewichtung)
   */
  function calcTechnisch(alter, gnd, gewerkeBewertung, gewerkeWeights, gewerkeRestlebensdauer) {
    const weights = gewerkeWeights || {};
    let pctVeraltet = 0, pctStandard = 0, pctGehoben = 0, totalWeight = 0;

    // Gewerke mit ihren prozentualen Anteilen aufaddieren (wie im Original-Gutachten Kap. 5.3.2)
    GEWERKE.forEach(function (g) {
      const w = (weights[g.id] != null) ? Number(weights[g.id]) : g.weight;
      totalWeight += w;
      const grad = (gewerkeBewertung && gewerkeBewertung[g.id]) || 'standard';
      if (grad === 'veraltet') pctVeraltet += w;
      else if (grad === 'gehoben') pctGehoben += w;
      else pctStandard += w;
    });

    // Auf 100% normieren falls Gewichte abweichen
    if (totalWeight > 0 && totalWeight !== 100) {
      pctVeraltet = (pctVeraltet / totalWeight) * 100;
      pctStandard = (pctStandard / totalWeight) * 100;
      pctGehoben  = (pctGehoben  / totalWeight) * 100;
    }

    // Lineare Basis (= Regelfallformel: GND - Alter)
    const rndBasis = Math.max(0, gnd - alter);

    // Korrigierte Gutachter-Formel:
    const abzugVeraltet    = rndBasis * pctVeraltet / 100 / 2;
    const aufschlagStandard = rndBasis * pctStandard / 100 / 2;
    const aufschlagGehoben  = rndBasis * pctGehoben  / 100;

    let rnd = rndBasis - abzugVeraltet + aufschlagStandard + aufschlagGehoben;
    rnd = Math.max(0, Math.min(rnd, gnd));

    const awm = gnd > 0 ? ((gnd - rnd) / gnd) * 100 : 0;

    // Optional: BTE-basierter Plausibilitätscheck
    let btePlausibilitaet = null;
    if (gewerkeRestlebensdauer && Object.keys(gewerkeRestlebensdauer).length > 0) {
      let rldGewichtet = 0, w_sum = 0;
      GEWERKE.forEach(function (g) {
        if (gewerkeRestlebensdauer[g.id] != null) {
          const rld = Number(gewerkeRestlebensdauer[g.id]);
          const w = (weights[g.id] != null) ? Number(weights[g.id]) : g.weight;
          rldGewichtet += rld * w;
          w_sum += w;
        }
      });
      if (w_sum > 0) btePlausibilitaet = round2(rldGewichtet / w_sum);
    }

    // Formel im Gutachter-Format (1:1 wie im Original):
    const formula = fmtNum2(rndBasis) + ' Jahre - ' + fmtNum2(abzugVeraltet) + ' Jahre + '
                  + fmtNum2(aufschlagStandard) + ' Jahre + ' + fmtNum2(aufschlagGehoben)
                  + ' Jahre = ' + fmtNum2(rnd) + ' Jahre';

    return {
      method: 'technisch',
      label: 'Technische Restnutzungsdauer',
      anteil_veraltet_pct: round2(pctVeraltet),
      anteil_standard_pct: round2(pctStandard),
      anteil_gehoben_pct: round2(pctGehoben),
      rnd_basis_linear: round2(rndBasis),
      abzug_veraltet: round2(abzugVeraltet),
      aufschlag_standard: round2(aufschlagStandard),
      aufschlag_gehoben: round2(aufschlagGehoben),
      alterswertminderung_pct: round2(awm),
      restnutzungsdauer: round2(rnd),
      bte_plausibilitaet: btePlausibilitaet,
      formula: formula,
      formula_short: 'RND = (G-A) - V/2 + S/2 + G',
      result_text: 'Technische RND: ' + round2(rnd) + ' Jahre (' + round2(awm) + '% AWM)'
    };
  }

  // ============================================================
  // SCHADENS-VERARBEITUNG
  // ============================================================
  function processSchaeden(schaeden) {
    if (!Array.isArray(schaeden) || schaeden.length === 0) {
      return {
        schaeden: [],
        gesamtAbschlag_pct: 0,
        beschreibung: 'Keine wesentlichen Mängel erfasst.'
      };
    }
    let gesamt = 0;
    const enriched = schaeden.map(function (s) {
      let id, abschlag, label;
      if (typeof s === 'string') { id = s; }
      else if (s && typeof s === 'object') {
        id = s.id; abschlag = s.abschlag; label = s.label;
      }
      const def = SCHADEN_KATALOG.find(function (k) { return k.id === id; });
      const finalAbschlag = (typeof abschlag === 'number') ? abschlag
                           : def ? def.abschlag : 0;
      const finalLabel = label || (def ? def.label : id);
      gesamt += finalAbschlag;
      return { id: id, label: finalLabel, abschlag: finalAbschlag };
    });
    const capped = Math.min(50, gesamt);
    const beschreibung = enriched.map(function (s) {
      return s.label + ' (-' + s.abschlag + '%)';
    }).join('; ');
    return {
      schaeden: enriched,
      gesamtAbschlag_pct: capped,
      gesamtAbschlag_pct_uncapped: gesamt,
      beschreibung: beschreibung,
      capped: gesamt > 50
    };
  }

  // ============================================================
  // GESAMTBERECHNUNG
  // ============================================================
  function calcAll(input) {
    const baujahr = Number(input.baujahr);
    const stichtagJahr = parseStichtagYear(input.stichtag);
    const alter = Math.max(0, stichtagJahr - baujahr);
    const gnd = Number(input.gnd) || 70;
    const modPoints = clampInt(input.modPoints, 0, 20);
    const gewerke = input.gewerkeBewertung || {};
    const weights = input.gewerkeWeights || null;
    const gewerkeRLD = input.gewerkeRestlebensdauer || null;
    const schaeden = input.schaeden || [];
    // V187: Schäden gehen nicht mehr automatisch in die RND-Berechnung ein.
    // Sie werden weiterhin im Gutachten dokumentiert, aber der Sachverständige
    // bewertet eventuelle Abschläge manuell.
    const applySchadensAbschlag = false;

    const linear = calcLinear(alter, gnd);
    const vogels = calcVogels(alter, gnd);
    const ross = calcRoss(alter, gnd);
    const parabel = calcParabel(alter, gnd);
    const punktraster = calcPunktraster(alter, gnd, modPoints);
    const technisch = calcTechnisch(alter, gnd, gewerke, weights, gewerkeRLD);

    const schadensInfo = processSchaeden(schaeden);

    let recommended = technisch.restnutzungsdauer;
    let recommendedNachSchaden = recommended;
    if (applySchadensAbschlag && schadensInfo.gesamtAbschlag_pct > 0) {
      recommendedNachSchaden = recommended * (1 - schadensInfo.gesamtAbschlag_pct / 100);
      recommendedNachSchaden = Math.max(0, recommendedNachSchaden);
    }

    let final = recommendedNachSchaden;
    let finalSource = applySchadensAbschlag && schadensInfo.gesamtAbschlag_pct > 0
      ? 'technisch + Schadensabschlag (-' + schadensInfo.gesamtAbschlag_pct + '%)'
      : 'technisch (vorrangig)';

    // V195 FIX: Wenn technische RND ≤ 0 (sehr alte Häuser mit AWM > 100%),
    // fallback auf Punktraster oder Linear — der nächstbesten Methode > 0.
    if (final <= 0) {
      if (punktraster.restnutzungsdauer > 0) {
        final = punktraster.restnutzungsdauer;
        finalSource = 'Punktraster (technisch ergab 0)';
      } else if (linear.restnutzungsdauer > 0) {
        final = linear.restnutzungsdauer;
        finalSource = 'Linear (technisch+Punktraster ergaben 0)';
      } else {
        // Notfall — mindestens 5 Jahre als realistischer Floor
        final = 5;
        finalSource = 'Floor 5 J. (alle Methoden ergaben 0)';
      }
    }

    if (input.reelleRND != null && input.reelleRND > 0) {
      final = Number(input.reelleRND);
      finalSource = 'Sachverständigen-Override (reelle RND)';
    }

    return {
      input: {
        baujahr: baujahr,
        stichtag_jahr: stichtagJahr,
        alter: alter,
        gnd: gnd,
        modPoints: modPoints
      },
      methods: {
        linear: linear,
        vogels: vogels,
        ross: ross,
        parabel: parabel,
        punktraster: punktraster,
        technisch: technisch
      },
      schaeden: schadensInfo,
      recommended_rnd: round2(recommended),
      recommended_rnd_nach_schaden: round2(recommendedNachSchaden),
      final_rnd: round2(final),
      final_source: finalSource
    };
  }

  // ============================================================
  // AfA-VERGLEICH
  // ============================================================
  function calcAfaVergleich(input) {
    const gebAnteil = Number(input.gebaeudeanteil) || 0;
    const rnd = Number(input.rnd) || 0;
    const grenz = Number(input.grenzsteuersatz) || 0.42;
    const standardSatz = Number(input.standardAfaSatz) || 0.02;
    // V193: Default 1000 → 999 (Marcels Wunsch: "999 Euro ohne Außenbesichtigung")
    const gutachterkosten = Number(input.gutachterkosten) || 999;
    const i = Number(input.abzinsung) || 0;

    if (gebAnteil <= 0 || rnd <= 0) {
      return { valid: false, reason: 'Gebäudeanteil und RND müssen > 0 sein' };
    }

    const kurzSatz = 1 / rnd;
    const afaStandardJahr = gebAnteil * standardSatz;
    const afaKurzJahr = gebAnteil * kurzSatz;
    const mehrAfaJahr = afaKurzJahr - afaStandardJahr;
    const steuerErsparnisJahr = mehrAfaJahr * grenz;

    let barwert;
    if (i > 0) {
      barwert = steuerErsparnisJahr * (1 - Math.pow(1 + i, -rnd)) / i;
    } else {
      barwert = steuerErsparnisJahr * rnd;
    }

    const netto = barwert - gutachterkosten;
    const roi = gutachterkosten > 0 ? (netto / gutachterkosten) : 0;

    let ampel, empfehlung;
    if (netto >= 5000) {
      ampel = 'gruen';
      empfehlung = 'Gutachten lohnt sich klar — hohe Steuerersparnis erwartbar';
    } else if (netto >= 1000) {
      ampel = 'gelb';
      empfehlung = 'Gutachten könnte sich lohnen — Einzelfallabwägung';
    } else if (netto >= 0) {
      ampel = 'gelb';
      empfehlung = 'Grenzfall — ROI nur knapp positiv';
    } else {
      ampel = 'rot';
      empfehlung = 'Gutachten lohnt sich nicht — Standard-AfA bleibt wirtschaftlicher';
    }

    return {
      valid: true,
      input: {
        gebaeudeanteil: gebAnteil, rnd: rnd,
        grenzsteuersatz_pct: round2(grenz * 100),
        standardAfaSatz_pct: round2(standardSatz * 100),
        gutachterkosten: gutachterkosten,
        abzinsung_pct: round2(i * 100)
      },
      afa_standard: {
        satz_pct: round2(standardSatz * 100),
        jahresbetrag: round2(afaStandardJahr),
        steuerersparnis_jahr: round2(afaStandardJahr * grenz)
      },
      afa_kurz: {
        satz_pct: round2(kurzSatz * 100),
        jahresbetrag: round2(afaKurzJahr),
        steuerersparnis_jahr: round2(afaKurzJahr * grenz)
      },
      mehr_afa_jahr: round2(mehrAfaJahr),
      steuerersparnis_jahr: round2(steuerErsparnisJahr),
      steuerersparnis_barwert: round2(barwert),
      gutachterkosten: gutachterkosten,
      netto_vorteil: round2(netto),
      roi_factor: round2(roi),
      ampel: ampel,
      empfehlung: empfehlung
    };
  }

  function estimateGrenzsteuersatz(zve) {
    const z = Number(zve) || 0;
    let satz;
    if (z <= 12096) satz = 0;
    else if (z <= 17443) satz = 0.14 + ((z - 12096) / (17443 - 12096)) * 0.10;
    else if (z <= 68480) satz = 0.24 + ((z - 17443) / (68480 - 17443)) * 0.18;
    else if (z <= 277825) satz = 0.42;
    else satz = 0.45;
    const soli = (z > 96000) ? satz * 0.055 : 0;
    return Math.min(0.475, satz + soli);
  }

  // ============================================================
  // DEALPILOT-OBJEKT IMPORT (NEU V3)
  // ============================================================
  /**
   * Mappt ein DealPilot-JSON-Objekt auf RND-Eingaben.
   * Nutzt die rate_*-Felder zur automatischen Gewerke-Bewertung.
   *
   * Mapping:
   *   rate_X = 1-2 → 'veraltet'
   *   rate_X = 3   → 'standard'
   *   rate_X = 4-5 → 'gehoben'
   *   ds2_zustand = 'gut' / 'mittel' / 'schlecht' beeinflusst nicht-gerateten Gewerke
   *   ds2_energie F/G/H → Schaden 'energetisch_kritisch'
   */
  function mapDealPilotObject(d) {
    if (!d) return {};
    if (d.data) d = d.data;  // ggf. wrapper auspacken

    function rateToGrad(rate) {
      const n = parseInt(rate, 10);
      if (isNaN(n) || n === 0) return null;
      if (n <= 2) return 'veraltet';
      if (n === 3) return 'standard';
      return 'gehoben';
    }

    function zustandFallback(zustand) {
      if (!zustand) return 'standard';
      const z = String(zustand).toLowerCase();
      if (z.indexOf('schlecht') >= 0 || z.indexOf('veraltet') >= 0) return 'veraltet';
      if (z.indexOf('sehr gut') >= 0 || z.indexOf('hochwertig') >= 0
          || z.indexOf('gehoben') >= 0) return 'gehoben';
      return 'standard';
    }

    // Energieklassen-Mapping (konservativ):
    //   A/A+ → 'gehoben' (energetisch top, Heizung/Dämmung modern)
    //   B/C/D → 'standard' (zeitgemäß)
    //   E → 'standard' (durchschnittlich, kein Veraltetheitssignal)
    //   F/G/H → 'veraltet' + Schaden-Eintrag
    function energieToGrad(energie) {
      const e = String(energie || '').toUpperCase().trim();
      if (e === 'A' || e === 'A+') return 'gehoben';
      if (e === 'B' || e === 'C' || e === 'D' || e === 'E') return null; // neutral
      if (e === 'F' || e === 'G' || e === 'H') return 'veraltet';
      return null;
    }

    const fallbackGrad = zustandFallback(d.ds2_zustand);
    const energieGrad = energieToGrad(d.ds2_energie);

    // 4 explizite rates aus DealPilot
    const gradBaeder   = rateToGrad(d.rate_bad)     || fallbackGrad;
    const gradFenster  = rateToGrad(d.rate_fenster) || fallbackGrad;
    const gradBoden    = rateToGrad(d.rate_boden);  // boden mappt auf "innenausbau"
    const gradKueche   = rateToGrad(d.rate_kueche); // küche kein direktes Gewerk — mit Bädern
    
    // Mehrheits-Heuristik für unbewertete Gewerke
    const counter = { veraltet: 0, standard: 0, gehoben: 0 };
    [gradBaeder, gradFenster, gradBoden, gradKueche].forEach(function (g) {
      if (g) counter[g]++;
    });
    let mehrheit = fallbackGrad;
    let max = -1;
    Object.keys(counter).forEach(function (k) {
      if (counter[k] > max) { max = counter[k]; mehrheit = k; }
    });

    // Gewerke-Bewertung: explizite rates wo verfügbar, sonst Mehrheit/fallback
    // Energieklasse beeinflusst Heizung und Außenwand (Wärmedämmung)
    const gewerkeBewertung = {
      dach:       energieGrad || mehrheit,    // Wärmedämmung Dach
      fenster:    gradFenster || energieGrad || mehrheit,
      leitungen:  mehrheit,
      heizung:    energieGrad || mehrheit,    // Heizung wird stark vom Energiekennwert geprägt
      aussenwand: energieGrad || mehrheit,    // Wärmedämmung Außenwand
      baeder:     gradBaeder || mehrheit,
      decken:     mehrheit,
      technik:    gradKueche || mehrheit,
      grundriss:  fallbackGrad
    };

    // Energetisch kritisch?
    const schaeden = [];
    const energie = String(d.ds2_energie || '').toUpperCase();
    if (energie === 'F' || energie === 'G' || energie === 'H') {
      schaeden.push('energetisch_kritisch');
    }

    // Gebäudeanteil = Kaufpreis × geb_ant%
    let gebAnteil = 0;
    const kp = Number(d.kp || d.kaufpreis || 0);
    const ga_pct = Number((d.geb_ant != null ? d.geb_ant : 80));
    if (kp > 0) gebAnteil = kp * ga_pct / 100;

    // Grenzsteuersatz
    const grenz = parseGermanNum(d.grenz);
    const afaSatz = parseGermanNum(d.afa_satz);

    return {
      baujahr: parseInt(d.baujahr, 10) || null,
      stichtag: d.kaufdat || d._at || null,
      objektTyp: mapObjektTyp(d.objart),
      gewerkeBewertung: gewerkeBewertung,
      schaeden: schaeden,
      // Gutachten-Metadaten
      objekt_adresse: ((d.str || '') + ' ' + (d.hnr || '')).trim()
                    + (d.plz || d.ort
                       ? ', ' + (d.plz || '').trim() + ' ' + (d.ort || '').trim()
                       : ''),
      objekt_einheit: d._name || '',
      wohnflaeche: parseGermanNum(d.wfl),
      // AfA
      gebaeudeanteil: gebAnteil,
      grenzsteuerMode: grenz > 0 ? 'manual' : 'manual',
      grenzsteuerManual: grenz > 0 ? grenz / 100 : 0.42,
      standardAfaSatz: afaSatz > 0 ? afaSatz / 100 : 0.02,
      zveAuto: parseGermanNum(d.zve) || 60000,
      // Energie-Info zur Anzeige
      energieklasse: d.ds2_energie || '',
      // Audit-Trail
      _imported_from: 'DealPilot',
      _import_kuerzel: d.kuerzel || d._name
    };
  }

  function mapObjektTyp(objart) {
    if (!objart) return 'mfh';
    const o = String(objart).toLowerCase();
    if (o === 'etw' || o.indexOf('eigentum') >= 0) return 'etw';
    if (o === 'mfh' || o.indexOf('mehrfamilien') >= 0) return 'mfh';
    if (o === 'efh' || o.indexOf('einfamilien') >= 0) return 'efh';
    if (o.indexOf('büro') >= 0 || o.indexOf('buero') >= 0) return 'buero';
    if (o.indexOf('hotel') >= 0) return 'hotel';
    return 'etw';
  }

  function parseGermanNum(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function round2(n) {
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }
  function clampInt(n, min, max) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }
  function parseStichtagYear(stichtag) {
    if (stichtag == null) return new Date().getFullYear();
    if (typeof stichtag === 'number') return stichtag;
    if (stichtag instanceof Date) return stichtag.getFullYear();
    const s = String(stichtag).trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return parseInt(m1[1], 10);
    const m2 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (m2) return parseInt(m2[3], 10);
    const m3 = s.match(/^(\d{4})$/);
    if (m3) return parseInt(m3[1], 10);
    return new Date().getFullYear();
  }
  function punkteToGrad(p) {
    if (p <= 1) return 'nicht modernisiert';
    if (p <= 5) return 'kleine Modernisierungen im Rahmen der Instandhaltung';
    if (p <= 10) return 'mittlerer Modernisierungsgrad';
    if (p <= 17) return 'überwiegend modernisiert';
    return 'umfassend modernisiert';
  }

  // Zahlen formatieren wie im Original-Gutachten (deutsches Komma)
  function fmtNum2(n) {
    return Number(n).toFixed(2).replace('.', ',');
  }
  function fmtNum4(n) {
    return Number(n).toFixed(4).replace('.', ',');
  }

  // EXPORT
  global.DealPilotRND = {
    MOD_ELEMENTS: MOD_ELEMENTS,
    GEWERKE: GEWERKE,
    GRADE: GRADE,
    PUNKTRASTER_KOEFF: PUNKTRASTER_KOEFF,
    SCHADEN_KATALOG: SCHADEN_KATALOG,
    calcLinear: calcLinear,
    calcVogels: calcVogels,
    calcRoss: calcRoss,
    calcParabel: calcParabel,
    calcPunktraster: calcPunktraster,
    calcTechnisch: calcTechnisch,
    processSchaeden: processSchaeden,
    calcAll: calcAll,
    calcAfaVergleich: calcAfaVergleich,
    estimateGrenzsteuersatz: estimateGrenzsteuersatz,
    mapDealPilotObject: mapDealPilotObject,
    punkteToGrad: punkteToGrad,
    parseStichtagYear: parseStichtagYear,
    fmtNum2: fmtNum2,
    fmtNum4: fmtNum4
  };
})(typeof window !== 'undefined' ? window : globalThis);
