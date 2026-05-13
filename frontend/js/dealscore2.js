'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V36 — DealScore 2.0 / Investor Deal Score
   
   Bewertet einen Deal von 0-100 in 5 Hauptkategorien mit Sub-KPIs.
   Vollständige Implementierung des Konzepts vom 29.04.2026.
   
   Public API (window.DealScore2):
     compute(deal, config?)  → { score, label, color, categories, factors, explanation }
     getDefaults()           → DEFAULT_CONFIG (Hauptgewichtungen, Sub-Gewichtungen, Schwellen)
     loadConfig()            → liest aus localStorage oder Defaults
     saveConfig(config)      → persistiert in localStorage
     resetConfig()           → löscht User-Override, fällt auf Defaults zurück
     interpolate(value, points) → Helper für lineare Interpolation
   
   Datenmodell `deal`:
     {
       kaufpreis, gesamtkosten, eigenkapital, jahreskaltmiete, monatlicheNkm,
       monatlicheEinnahmen, monatlicheAusgaben, monatlicheKreditrate, jahresCashflow,
       dscr, ltv, zinsSatz, tilgung, eigenkapitalQuote,
       leerstandPct, instandhaltungPctNkm,
       zustand,             // "neubau"|"gut"|"normal"|"renovierungsbeduerftig"|"stark_sanierungsbeduerftig"
       energieKlasse,       // "A+"|"A"|"B"|"C"|"D"|"E"|"F"|"G"|"H" oder ""
       mietausfallRisiko,   // "sehr_niedrig"|"niedrig"|"mittel"|"erhoeht"|"hoch"
       istMieteEurQm, marktmieteEurQm, mietwachstumPct,
       bevoelkerung,        // "stark_wachsend"|"wachsend"|"stabil"|"leicht_fallend"|"stark_fallend"
       nachfrage,           // "sehr_stark"|"stark"|"mittel"|"schwach"|"sehr_schwach"
       mikrolage,           // "sehr_gut"|"gut"|"mittel"|"einfach"|"problematisch"
       wertsteigerung, entwicklungsmoeglichkeiten,
       eigenerFaktor, marktFaktor
     }
═══════════════════════════════════════════════════════════════════════════ */

window.DealScore2 = (function() {

  var STORAGE_KEY = 'dp_dealscore2_config';
  // V107: Preset-Schlüssel — gespeichert wird der Name des aktiven Presets,
  //       die eigentliche Config wird beim load aus dem Preset gelesen
  //       (außer der User hat manuell editiert → preset='custom').
  var PRESET_KEY  = 'dp_dealscore2_preset';

  /* ─────────────────────────────────────────────────────────────
     DEFAULTS — entsprechen 1:1 dem Konzeptdokument
  ───────────────────────────────────────────────────────────── */
  var DEFAULTS = {
    // Hauptgewichtungen (müssen 100 ergeben — werden bei Berechnung normalisiert)
    weights: {
      rendite:      35,
      finanzierung: 25,
      risiko:       20,
      lage:         10,
      upside:       10
    },
    // Sub-Gewichtungen je Kategorie
    subWeights: {
      rendite: {
        bruttorendite: 25,
        nettorendite:  30,
        cashflow:      25,
        cashOnCash:    20
      },
      finanzierung: {
        dscr:                35,
        ltv:                 30,
        zins:                15,
        tilgung:             10,
        eigenkapitalbedarf:  10
      },
      risiko: {
        leerstand:     20,
        instandhaltung:20,
        baujahr:       15,
        energie:       15,
        mietausfall:   10,
        qualitaet:     20    // V42: Q&Z-Sterne-Bewertung
      },
      lage: {
        marktVsIst:        25,
        mietwachstum:      25,
        bevoelkerung:      20,
        nachfrage:         15,
        mikrolage:         15
      },
      upside: {
        mietsteigerung:        35,
        kaufpreisFaktor:       30,
        wertsteigerung:        20,
        entwicklungs:          15
      }
    },
    // Schwellen (Punkt-Definitionen für lineare Interpolation)
    // Format: array of [value, points] - sortiert aufsteigend nach value
    thresholds: {
      bruttorendite:    [[4, 20], [5, 50], [7, 80], [9, 100]],
      nettorendite:     [[2.5, 20], [3.5, 50], [5, 80], [6.5, 100]],
      cashflow:         [[-300, 0], [-100, 30], [0, 60], [200, 85], [500, 100]],
      cashOnCash:       [[0, 0], [3, 40], [6, 70], [10, 100]],
      dscr:             [[0.9, 0], [1.0, 40], [1.1, 60], [1.2, 80], [1.3, 100]],
      // LTV: investorfreundlich — Range-Buckets
      ltvBuckets: [
        { min: 0,    max: 70,   points: 85 },
        { min: 70,   max: 85,   points: 95 },
        { min: 85,   max: 95,   points: 100 },
        { min: 95,   max: 105,  points: 75 },
        { min: 105,  max: 999,  points: 30 }
      ],
      zins:    [[3.0, 100], [3.5, 85], [4.0, 70], [4.5, 50], [5.5, 20]],  // niedrig=besser
      tilgung: [
        { min: 0,    max: 1,    points: 40 },
        { min: 1,    max: 2,    points: 80 },
        { min: 2,    max: 3,    points: 100 },
        { min: 3,    max: 4,    points: 90 },
        { min: 4,    max: 999,  points: 60 }
      ],
      eigenkapitalbedarf: [[10, 100], [20, 80], [30, 60], [40, 30]],   // niedriger=besser
      leerstand:          [[3, 100], [5, 80], [8, 50], [12, 20]],      // niedriger=besser
      instandhaltung:     [[8, 100], [12.5, 80], [20, 50], [30, 20]],  // niedriger=besser, 10-15% mittig auf 12.5
      // Energieklassen-Mapping
      energieKlassen: {
        'A+': 100, 'A': 100, 'B': 90, 'C': 80, 'D': 65, 'E': 50, 'F': 35, 'G': 20, 'H': 10
      },
      // Marktmiete vs Ist-Miete: Quotient Ist/Markt × 100
      marktVsIst:    [[80, 100], [90, 85], [100, 70], [110, 45], [120, 20]],
      mietwachstum:  [[0, 20], [1, 50], [2, 70], [3, 85], [4, 100]],
      // Mietsteigerungspotenzial: (Markt - Ist) / Ist × 100
      mietsteigerung: [[-1, 10], [0, 40], [10, 70], [20, 85], [30, 100]],
      kaufpreisFaktor: [[0.8, 100], [0.9, 85], [1.0, 65], [1.1, 40], [1.2, 15]]
    },
    // Kategoriale Mappings (Strings → Punkte)
    categorical: {
      zustand: {
        'neubau':                       100,
        'gut':                          85,
        'normal':                       65,
        'renovierungsbeduerftig':       40,
        'stark_sanierungsbeduerftig':   15
      },
      mietausfall: {
        'sehr_niedrig': 100, 'niedrig': 80, 'mittel': 60, 'erhoeht': 35, 'hoch': 15
      },
      bevoelkerung: {
        'stark_wachsend': 100, 'wachsend': 80, 'stabil': 60, 'leicht_fallend': 35, 'stark_fallend': 10
      },
      nachfrage: {
        'sehr_stark': 100, 'stark': 80, 'mittel': 60, 'schwach': 35, 'sehr_schwach': 10
      },
      mikrolage: {
        'sehr_gut': 100, 'gut': 80, 'mittel': 60, 'einfach': 35, 'problematisch': 10
      },
      wertsteigerung: {
        'sehr_hoch': 100, 'hoch': 80, 'mittel': 60, 'niedrig': 35, 'keines': 10
      },
      entwicklungs: {
        'mehrere':   100, 'eine_starke': 80, 'begrenzt': 50, 'kaum': 25, 'keine': 10
      }
    },
    // LTV+DSCR Interaktion: Anpassung auf den Finanzierungs-Score
    ltvDscrInteraction: {
      bonusHighLtvHighDscr:        +5,   // LTV ≥ 95 + DSCR ≥ 1.20
      maluHighLtvLowDscr:          -20,  // LTV ≥ 95 + DSCR < 1.00
      maluVeryHighLtvLowDscr:      -25   // LTV > 105 + DSCR < 1.10
    },
    // Default-Punkte bei fehlenden Werten (neutral)
    neutralFallback: 60
  };

  /* ─────────────────────────────────────────────────────────────
     V107 — PRESETS (Bewertungsprofile)
     Drei vorkonfigurierte Profile + "custom" wenn der User editiert.
     Gleiche Struktur wie DEFAULTS, nur abweichende Werte überschreiben.
  ───────────────────────────────────────────────────────────── */
  var PRESETS = {
    /**
     * BALANCED = der bisherige Default. Ausgewogen, breit anwendbar.
     */
    balanced: {
      key: 'balanced',
      label: 'Ausgewogen',
      description: 'Standard-Bewertung — mittlere Anforderungen, breit einsetzbar für Buy & Hold und Trade-Deals.',
      icon: '⚖️',
      // Keine Overrides nötig — nimmt 1:1 die DEFAULTS
      overrides: {}
    },

    /**
     * CONSERVATIVE = strenger. Mehr Gewicht auf Risiko + Finanzierung,
     * höhere Schwellen für gute Punkte. Geeignet für Anleger die Substanz
     * + Cashflow-Sicherheit über Renditejagd stellen.
     */
    conservative: {
      key: 'conservative',
      label: 'Konservativ',
      description: 'Strengere Bewertung mit Fokus auf Substanz + Cashflow-Sicherheit. Höhere Renditen + niedrigerer LTV nötig für gute Punkte.',
      icon: '🛡️',
      overrides: {
        // Hauptgewichtungen: Risiko + Finanzierung wichtiger, Upside weniger
        weights: {
          rendite:      30,   // war 35
          finanzierung: 30,   // war 25
          risiko:       25,   // war 20
          lage:         10,
          upside:        5    // war 10
        },
        // Strengere Renditen-Schwellen — gute Punkte erst ab höherer Brutto/Nettomietrendite
        thresholds: {
          bruttorendite:  [[5, 20], [6, 50], [8, 80], [10, 100]],   // war [4,20][5,50][7,80][9,100]
          nettorendite:   [[3.5, 20], [4.5, 50], [6, 80], [7.5, 100]],
          // Cashflow strenger — negativer CF bestraft härter
          cashflow:       [[-200, 0], [0, 30], [150, 60], [400, 85], [700, 100]],
          cashOnCash:     [[0, 0], [4, 40], [8, 70], [12, 100]],
          // DSCR strenger — 1.2 erst 70 Punkte (war 80), 1.3 nur 90
          dscr:           [[1.0, 0], [1.1, 30], [1.2, 60], [1.3, 85], [1.4, 100]],
          // LTV strenger — schon ab 80% volle Punkte verlieren
          ltvBuckets: [
            { min: 0,    max: 60,   points: 100 },
            { min: 60,   max: 75,   points: 90 },
            { min: 75,   max: 85,   points: 70 },
            { min: 85,   max: 95,   points: 45 },
            { min: 95,   max: 999,  points: 15 }
          ],
          // Tilgung strenger — mind. 2% für gute Punkte
          tilgung: [
            { min: 0,    max: 1.5,  points: 30 },
            { min: 1.5,  max: 2.5,  points: 70 },
            { min: 2.5,  max: 4,    points: 100 },
            { min: 4,    max: 999,  points: 80 }
          ]
        }
      }
    },

    /**
     * OPTIMISTIC = lockerer. Schon mittlere Werte werden positiv bewertet.
     * Gewichtung schiebt Rendite + Upside nach vorn — passt für aggressivere
     * Wachstumsstrategien.
     */
    optimistic: {
      key: 'optimistic',
      label: 'Optimistisch',
      description: 'Wachstumsorientierte Bewertung — Rendite + Upside-Potenzial dominieren, höhere LTV-Toleranz.',
      icon: '🚀',
      overrides: {
        // Hauptgewichtungen: Rendite + Upside wichtiger
        weights: {
          rendite:      40,   // war 35
          finanzierung: 20,   // war 25
          risiko:       15,   // war 20
          lage:         10,
          upside:       15    // war 10
        },
        // Niedrigere Schwellen — schon mittlere Werte sind "gut"
        thresholds: {
          bruttorendite:  [[3, 30], [4, 60], [6, 85], [8, 100]],     // war [4,20][5,50][7,80][9,100]
          nettorendite:   [[2, 30], [3, 60], [4.5, 85], [6, 100]],
          cashflow:       [[-400, 0], [-150, 40], [0, 70], [150, 90], [400, 100]],
          cashOnCash:     [[-2, 0], [2, 50], [5, 80], [9, 100]],
          dscr:           [[0.85, 0], [0.95, 40], [1.05, 65], [1.15, 85], [1.25, 100]],
          // LTV lockerer — auch hohe LTV bekommt noch ordentliche Punkte (Hebel-Strategie)
          ltvBuckets: [
            { min: 0,    max: 75,   points: 80 },
            { min: 75,   max: 90,   points: 95 },
            { min: 90,   max: 100,  points: 100 },
            { min: 100,  max: 110,  points: 80 },
            { min: 110,  max: 999,  points: 50 }
          ],
          // Tilgung lockerer — auch 1% reicht für ordentliche Punkte
          tilgung: [
            { min: 0,    max: 0.5,  points: 50 },
            { min: 0.5,  max: 1.5,  points: 80 },
            { min: 1.5,  max: 3,    points: 100 },
            { min: 3,    max: 999,  points: 75 }
          ]
        }
      }
    }
  };
  // Default-Preset (Fallback wenn nichts gespeichert)
  var DEFAULT_PRESET_KEY = 'balanced';


  /* ─────────────────────────────────────────────────────────────
     HELPER: lineare Interpolation
     points: [[v1, p1], [v2, p2], ...] sortiert aufsteigend nach v
     - value < v1     → p1
     - value >= vN    → pN
     - dazwischen: lineare Interpolation
  ───────────────────────────────────────────────────────────── */
  function interpolate(value, points) {
    if (value === null || value === undefined || isNaN(value)) return null;
    if (!points || points.length === 0) return null;
    if (value <= points[0][0]) return points[0][1];
    if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (var i = 1; i < points.length; i++) {
      var p1 = points[i - 1], p2 = points[i];
      if (value < p2[0]) {
        var ratio = (value - p1[0]) / (p2[0] - p1[0]);
        return p1[1] + ratio * (p2[1] - p1[1]);
      }
    }
    return points[points.length - 1][1];
  }
  function bucketLookup(value, buckets) {
    if (value === null || value === undefined || isNaN(value)) return null;
    for (var i = 0; i < buckets.length; i++) {
      var b = buckets[i];
      // Bucket-Match: untere Grenze inklusiv, obere exklusiv (außer letzter)
      var isLast = (i === buckets.length - 1);
      if (value >= b.min && (isLast ? value <= b.max : value < b.max)) {
        return b.points;
      }
    }
    return null;
  }
  function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }
  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = (typeof x === 'number') ? x : parseFloat(x);
    return (isNaN(n) || !isFinite(n)) ? null : n;
  }

  /* ─────────────────────────────────────────────────────────────
     KATEGORIEN-BERECHNUNGEN
     Jede Funktion gibt ein Objekt mit { score, breakdown[] }
     breakdown[i] = { name, value, points, weight, applied }
   ─────────────────────────────────────────────────────────────*/

  function scoreRendite(deal, cfg) {
    var t = cfg.thresholds, w = cfg.subWeights.rendite;
    var bd = [];

    var bmr = num(deal.bruttorendite);
    bd.push({
      key: 'bruttorendite', name: 'Bruttorendite',
      value: bmr, unit: '%',
      points: bmr !== null ? interpolate(bmr, t.bruttorendite) : null,
      weight: w.bruttorendite
    });

    var nmr = num(deal.nettorendite);
    bd.push({
      key: 'nettorendite', name: 'Nettorendite',
      value: nmr, unit: '%',
      points: nmr !== null ? interpolate(nmr, t.nettorendite) : null,
      weight: w.nettorendite
    });

    var cf = num(deal.cashflowMonatlich);
    bd.push({
      key: 'cashflow', name: 'Cashflow / Mon.',
      value: cf, unit: '€',
      points: cf !== null ? interpolate(cf, t.cashflow) : null,
      weight: w.cashflow
    });

    var coc = num(deal.cashOnCash);
    bd.push({
      key: 'cashOnCash', name: 'Cash-on-Cash',
      value: coc, unit: '%',
      points: coc !== null ? interpolate(coc, t.cashOnCash) : null,
      weight: w.cashOnCash
    });

    return _aggregate(bd, cfg);
  }

  function scoreFinanzierung(deal, cfg) {
    var t = cfg.thresholds, w = cfg.subWeights.finanzierung;
    var bd = [];

    var dscr = num(deal.dscr);
    bd.push({
      key: 'dscr', name: 'DSCR', value: dscr, unit: '',
      points: dscr !== null ? interpolate(dscr, t.dscr) : null,
      weight: w.dscr
    });

    var ltv = num(deal.ltv);
    bd.push({
      key: 'ltv', name: 'LTV', value: ltv, unit: '%',
      points: ltv !== null ? bucketLookup(ltv, t.ltvBuckets) : null,
      weight: w.ltv
    });

    var zins = num(deal.zinsSatz);
    bd.push({
      key: 'zins', name: 'Zinssatz', value: zins, unit: '%',
      points: zins !== null ? interpolate(zins, t.zins) : null,
      weight: w.zins
    });

    var til = num(deal.tilgung);
    bd.push({
      key: 'tilgung', name: 'Tilgung', value: til, unit: '%',
      points: til !== null ? bucketLookup(til, t.tilgung) : null,
      weight: w.tilgung
    });

    var ekq = num(deal.eigenkapitalQuote);
    bd.push({
      key: 'eigenkapitalbedarf', name: 'EK-Bedarf', value: ekq, unit: '%',
      points: ekq !== null ? interpolate(ekq, t.eigenkapitalbedarf) : null,
      weight: w.eigenkapitalbedarf
    });

    var agg = _aggregate(bd, cfg);

    // LTV+DSCR Interaktion
    if (ltv !== null && dscr !== null) {
      var inter = cfg.ltvDscrInteraction;
      var adj = 0;
      var note = null;
      if (ltv >= 95 && dscr >= 1.20) {
        adj = inter.bonusHighLtvHighDscr;
        note = 'Hohe Finanzierung mit starkem DSCR (Bonus +' + adj + ')';
      } else if (ltv >= 95 && dscr < 1.00) {
        adj = inter.maluHighLtvLowDscr;
        note = 'Hohe Finanzierung mit schwachem DSCR (Malus ' + adj + ')';
      } else if (ltv > 105 && dscr < 1.10) {
        adj = inter.maluVeryHighLtvLowDscr;
        note = 'Sehr hohe Finanzierung + niedriger DSCR (Malus ' + adj + ')';
      }
      if (adj !== 0) {
        agg.score = clamp(agg.score + adj, 0, 100);
        agg.interactionAdjustment = adj;
        agg.interactionNote = note;
      }
    }
    return agg;
  }

  function scoreRisiko(deal, cfg) {
    var t = cfg.thresholds, w = cfg.subWeights.risiko, c = cfg.categorical;
    var bd = [];

    var ls = num(deal.leerstandPct);
    bd.push({
      key: 'leerstand', name: 'Leerstand', value: ls, unit: '%',
      points: ls !== null ? interpolate(ls, t.leerstand) : null,
      weight: w.leerstand
    });

    var ih = num(deal.instandhaltungPctNkm);
    bd.push({
      key: 'instandhaltung', name: 'Instandhaltung', value: ih, unit: '%',
      points: ih !== null ? interpolate(ih, t.instandhaltung) : null,
      weight: w.instandhaltung
    });

    var z = deal.zustand || null;
    bd.push({
      key: 'baujahr', name: 'Baujahr / Zustand', value: z, unit: '',
      points: z && c.zustand[z] !== undefined ? c.zustand[z] : null,
      weight: w.baujahr
    });

    var en = deal.energieKlasse || null;
    var enPoints = null;
    if (en && t.energieKlassen[en] !== undefined) enPoints = t.energieKlassen[en];
    bd.push({
      key: 'energie', name: 'Energieklasse', value: en, unit: '',
      points: enPoints,                      // null wenn nicht vorhanden → Fallback unten greift
      weight: w.energie
    });

    var ma = deal.mietausfallRisiko || null;
    bd.push({
      key: 'mietausfall', name: 'Mietausfall-Risiko', value: ma, unit: '',
      points: ma && c.mietausfall[ma] !== undefined ? c.mietausfall[ma] : null,
      weight: w.mietausfall
    });

    // V42: Qualität & Zustand (Sternebewertung) — 1-5 Sterne → 0-100 Punkte
    var qz = num(deal.qualitaetSterne);
    var qzPts = null;
    if (qz !== null && qz > 0) {
      // 0-5 Skala → 0-100 (linear, mit Bonus für Top-Bewertung)
      qzPts = Math.min(100, Math.max(0, (qz - 1) / 4 * 100));
    }
    bd.push({
      key: 'qualitaet', name: 'Qualität & Zustand', value: qz, unit: '★',
      points: qzPts,
      weight: w.qualitaet
    });

    return _aggregate(bd, cfg);
  }

  function scoreLage(deal, cfg) {
    var t = cfg.thresholds, w = cfg.subWeights.lage, c = cfg.categorical;
    var bd = [];

    var istMiete = num(deal.istMieteEurQm);
    var marktMiete = num(deal.marktmieteEurQm);
    var quot = (istMiete !== null && marktMiete !== null && marktMiete > 0)
      ? (istMiete / marktMiete * 100) : null;
    bd.push({
      key: 'marktVsIst', name: 'Ist-/Marktmiete',
      value: quot, unit: '%',
      points: quot !== null ? interpolate(quot, t.marktVsIst) : null,
      weight: w.marktVsIst
    });

    var mw = num(deal.mietwachstumPct);
    bd.push({
      key: 'mietwachstum', name: 'Mietwachstum p.a.',
      value: mw, unit: '%',
      points: mw !== null ? interpolate(mw, t.mietwachstum) : null,
      weight: w.mietwachstum
    });

    var bv = deal.bevoelkerung || null;
    bd.push({
      key: 'bevoelkerung', name: 'Bevölkerung', value: bv, unit: '',
      points: bv && c.bevoelkerung[bv] !== undefined ? c.bevoelkerung[bv] : null,
      weight: w.bevoelkerung
    });

    var nf = deal.nachfrage || null;
    bd.push({
      key: 'nachfrage', name: 'Nachfrage', value: nf, unit: '',
      points: nf && c.nachfrage[nf] !== undefined ? c.nachfrage[nf] : null,
      weight: w.nachfrage
    });

    var ml = deal.mikrolage || null;
    bd.push({
      key: 'mikrolage', name: 'Mikrolage', value: ml, unit: '',
      points: ml && c.mikrolage[ml] !== undefined ? c.mikrolage[ml] : null,
      weight: w.mikrolage
    });

    return _aggregate(bd, cfg);
  }

  function scoreUpside(deal, cfg) {
    var t = cfg.thresholds, w = cfg.subWeights.upside, c = cfg.categorical;
    var bd = [];

    var istMiete = num(deal.istMieteEurQm);
    var marktMiete = num(deal.marktmieteEurQm);
    var msPot = (istMiete !== null && marktMiete !== null && istMiete > 0)
      ? ((marktMiete - istMiete) / istMiete * 100) : null;
    bd.push({
      key: 'mietsteigerung', name: 'Mietsteigerung-Potenzial',
      value: msPot, unit: '%',
      points: msPot !== null ? interpolate(msPot, t.mietsteigerung) : null,
      weight: w.mietsteigerung
    });

    var ef = num(deal.eigenerFaktor);
    var mf = num(deal.marktFaktor);
    var fq = (ef !== null && mf !== null && mf > 0) ? (ef / mf) : null;
    bd.push({
      key: 'kaufpreisFaktor', name: 'Faktor vs. Markt',
      value: fq, unit: '',
      points: fq !== null ? interpolate(fq, t.kaufpreisFaktor) : null,
      weight: w.kaufpreisFaktor
    });

    var ws = deal.wertsteigerung || null;
    bd.push({
      key: 'wertsteigerung', name: 'Wertsteigerung',
      value: ws, unit: '',
      points: ws && c.wertsteigerung[ws] !== undefined ? c.wertsteigerung[ws] : null,
      weight: w.wertsteigerung
    });

    var ev = deal.entwicklungsmoeglichkeiten || null;
    bd.push({
      key: 'entwicklungs', name: 'Entwicklungsmöglichkeiten',
      value: ev, unit: '',
      points: ev && c.entwicklungs[ev] !== undefined ? c.entwicklungs[ev] : null,
      weight: w.entwicklungs
    });

    return _aggregate(bd, cfg);
  }

  /* ─────────────────────────────────────────────────────────────
     AGGREGATION mit Fallback-Logik
     Strategie: wenn ein Sub-KPI fehlt, wird er aus der Gewichtung
     herausgerechnet (= bessere Variante laut Konzept). Falls ALLE
     KPIs fehlen, fällt die Kategorie auf neutralFallback (60).
   ─────────────────────────────────────────────────────────────*/
  function _aggregate(breakdown, cfg) {
    var totalWeight = 0;
    var weightedSum = 0;
    var available = 0;
    breakdown.forEach(function(b) {
      if (b.points !== null && b.points !== undefined) {
        b.points = clamp(b.points, 0, 100);
        weightedSum += b.points * b.weight;
        totalWeight += b.weight;
        b.applied = true;
        available++;
      } else {
        b.applied = false;
      }
    });
    var score;
    if (available === 0) {
      score = cfg.neutralFallback;
    } else {
      score = totalWeight > 0 ? weightedSum / totalWeight : cfg.neutralFallback;
    }
    return {
      score: clamp(score, 0, 100),
      breakdown: breakdown,
      availableKpis: available,
      totalKpis: breakdown.length
    };
  }

  /* ─────────────────────────────────────────────────────────────
     GESAMT-COMPUTE
   ─────────────────────────────────────────────────────────────*/
  function compute(deal, cfg) {
    cfg = cfg || loadConfig();
    deal = deal || {};

    var cats = {
      rendite:      scoreRendite(deal, cfg),
      finanzierung: scoreFinanzierung(deal, cfg),
      risiko:       scoreRisiko(deal, cfg),
      lage:         scoreLage(deal, cfg),
      upside:       scoreUpside(deal, cfg)
    };

    // Gewichteten Gesamtscore berechnen
    var keys = ['rendite', 'finanzierung', 'risiko', 'lage', 'upside'];
    var totalW = 0, weightedSum = 0;
    keys.forEach(function(k) {
      var w = cfg.weights[k] || 0;
      totalW += w;
      weightedSum += cats[k].score * w;
    });
    var totalScore = totalW > 0 ? weightedSum / totalW : 0;
    totalScore = clamp(totalScore, 0, 100);

    // Ampel-Logik
    var label, color;
    if (totalScore < 50) { label = 'Schwach'; color = 'red'; }
    else if (totalScore < 70) { label = 'Okay'; color = 'gold'; }
    else if (totalScore < 85) { label = 'Gut'; color = 'green'; }
    else { label = 'Sehr gut'; color = 'green-strong'; }

    // Top 3 positive + top 3 negative Sub-KPIs (über alle Kategorien) sammeln
    var allKpis = [];
    keys.forEach(function(k) {
      cats[k].breakdown.forEach(function(b) {
        if (b.applied) {
          allKpis.push({
            kategorie: k, name: b.name, points: b.points,
            value: b.value, unit: b.unit, weight: b.weight
          });
        }
      });
    });
    var sorted = allKpis.slice().sort(function(a, b) { return b.points - a.points; });
    var positives = sorted.filter(function(k) { return k.points >= 75; }).slice(0, 4);
    var negatives = sorted.slice().reverse().filter(function(k) { return k.points <= 50; }).slice(0, 4);

    // Erklärungs-Text
    var explanation = _buildExplanation(totalScore, label, cats, positives, negatives);

    // V59: Datenvollständigkeit über alle Kategorien zusammenrechnen
    // (= wieviele KPIs haben echte Werte vs. wieviele insgesamt)
    var totalAvailable = 0, totalKpis = 0;
    keys.forEach(function(k) {
      totalAvailable += cats[k].availableKpis || 0;
      totalKpis += cats[k].totalKpis || 0;
    });
    var completeness = totalKpis > 0 ? totalAvailable / totalKpis : 0;

    return {
      score: Math.round(totalScore),
      label: label,
      color: color,
      categories: cats,
      positives: positives,
      negatives: negatives,
      explanation: explanation,
      configUsed: cfg,
      // V59: Vollständigkeit ausweisen — Konsumenten (UI) können Score "ausgrauen" wenn zu wenig Daten
      dataCompleteness: completeness,
      availableKpis: totalAvailable,
      totalKpis: totalKpis
    };
  }

  function _buildExplanation(score, label, cats, positives, negatives) {
    var parts = [];
    parts.push('Score ' + Math.round(score) + '/100 (' + label + ')');
    if (positives.length > 0) {
      var posText = positives.slice(0, 3).map(function(p) { return p.name; }).join(', ');
      parts.push('Stärken: ' + posText);
    }
    if (negatives.length > 0) {
      var negText = negatives.slice(0, 3).map(function(p) { return p.name; }).join(', ');
      parts.push('Abzüge wegen: ' + negText);
    }
    return parts.join(' · ');
  }

  /* ─────────────────────────────────────────────────────────────
     CONFIG-PERSISTENZ (localStorage)
   ─────────────────────────────────────────────────────────────*/
  function getDefaults() {
    // Deep-Copy damit Außenwelt das Original nicht verändert
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  /* V107 — Preset-API */
  function getPresets() {
    return Object.keys(PRESETS).map(function(k) {
      return {
        key: k,
        label: PRESETS[k].label,
        description: PRESETS[k].description,
        icon: PRESETS[k].icon
      };
    });
  }
  function getActivePreset() {
    try {
      var p = localStorage.getItem(PRESET_KEY);
      if (p && (PRESETS[p] || p === 'custom')) return p;
    } catch (e) {}
    return DEFAULT_PRESET_KEY;
  }
  function setActivePreset(presetKey) {
    if (presetKey !== 'custom' && !PRESETS[presetKey]) {
      console.warn('[DS2] Unbekanntes Preset:', presetKey);
      return false;
    }
    try {
      localStorage.setItem(PRESET_KEY, presetKey);
      // Bei Preset-Wechsel (NICHT custom): Custom-Override löschen damit beim nächsten
      // load die reine Preset-Config gezogen wird
      if (presetKey !== 'custom') {
        localStorage.removeItem(STORAGE_KEY);
      }
      return true;
    } catch (e) { return false; }
  }
  function getPresetConfig(presetKey) {
    var p = PRESETS[presetKey] || PRESETS[DEFAULT_PRESET_KEY];
    var base = getDefaults();
    if (p && p.overrides) {
      return _mergeDeep(base, JSON.parse(JSON.stringify(p.overrides)));
    }
    return base;
  }

  function loadConfig() {
    var activePreset = getActivePreset();

    // Wenn ein Preset aktiv ist (nicht "custom") → reine Preset-Config zurückgeben
    if (activePreset !== 'custom' && PRESETS[activePreset]) {
      return getPresetConfig(activePreset);
    }

    // Custom-Modus: gespeicherte User-Config + Defaults mergen
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return _mergeDeep(getDefaults(), parsed);
      }
    } catch (e) { /* fallthrough */ }
    return getDefaults();
  }
  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      // V107: Wenn der User die Config manuell speichert, ist's "custom"
      localStorage.setItem(PRESET_KEY, 'custom');
      return true;
    } catch (e) { return false; }
  }
  function resetConfig() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      // V107: Bei Reset auf Default-Preset zurücksetzen
      localStorage.setItem(PRESET_KEY, DEFAULT_PRESET_KEY);
    } catch(e) {}
    return getPresetConfig(DEFAULT_PRESET_KEY);
  }
  function _mergeDeep(target, source) {
    if (!source || typeof source !== 'object') return target;
    Object.keys(source).forEach(function(k) {
      if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        target[k] = _mergeDeep(target[k] || {}, source[k]);
      } else {
        target[k] = source[k];
      }
    });
    return target;
  }

  /**
   * V63: KPI-Vollständigkeit pro Kategorie zählen.
   * Liefert {totalByCategory, filledByCategory, total, filled, percent}.
   * Ein Feld gilt als "ausgefüllt" wenn der Wert nicht null/undefined/"" ist.
   */
  /**
   * V63.2: KPI-Vollständigkeit über das echte DS2-Compute-Result zählen.
   * Single Source of Truth = b.applied (das Engine-Flag aus _aggregate).
   * Damit ist garantiert dass Häkchen + Counter konsistent sind.
   */
  function getKpiCompleteness(deal) {
    var result;
    try {
      result = compute(deal);
    } catch(e) {
      return { byCategory: {}, total: 24, filled: 0, percent: 0 };
    }
    var cats = (result && result.categories) || {};
    var byCat = {};
    var totalAll = 0, filledAll = 0;

    Object.keys(cats).forEach(function(catKey) {
      var bd = cats[catKey].breakdown || [];
      var total = bd.length;
      var filled = bd.filter(function(b) { return b.applied; }).length;
      byCat[catKey] = { total: total, filled: filled, percent: total ? Math.round(filled/total*100) : 0 };
      totalAll += total;
      filledAll += filled;
    });

    return {
      byCategory: byCat,
      total: totalAll,
      filled: filledAll,
      percent: totalAll ? Math.round(filledAll/totalAll*100) : 0
    };
  }

  return {
    compute: compute,
    getKpiCompleteness: getKpiCompleteness,
    getDefaults: getDefaults,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    resetConfig: resetConfig,
    // V107: Preset-API
    getPresets: getPresets,
    getActivePreset: getActivePreset,
    setActivePreset: setActivePreset,
    getPresetConfig: getPresetConfig,
    interpolate: interpolate,
    bucketLookup: bucketLookup,
    clamp: clamp,
    // Test-Hooks (intern, aber nutzbar)
    _scoreRendite: scoreRendite,
    _scoreFinanzierung: scoreFinanzierung,
    _scoreRisiko: scoreRisiko,
    _scoreLage: scoreLage,
    _scoreUpside: scoreUpside
  };
})();
