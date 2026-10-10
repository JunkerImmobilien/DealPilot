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
 *
 * v1426 · Kern 3.1.0 aus dem Gutachten-Paket 1.0.0 (17.09.2026) uebernommen:
 *   Anwendungsgrenzen der Anlage 2 (Schwelle, 70/90-%-Streckung, kein
 *   Extrapolieren ab Alter >= GND), kein stiller 5-Jahres-Boden mehr,
 *   Plausibilitaetsanker 30 % GND. Gegen drei unterschriebene Gutachten
 *   geprueft (tools/rnd-pruefung/rnd-gutachten-test.mjs, 22/22).
 *   DealPilot-eigene Staende bleiben: v1364 Steuertarif, V193 999 EUR.
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
    /* ══ v1966 · HIER STAND b: 0.8810 — EIN TIPPFEHLER ══════════════════
       Die 0.8810 der Zeile DARUEBER (11 Punkte) stand ein zweites Mal
       hier bei 12 Punkten. Die b-Reihe der Tabelle 3 faellt ab 9 Punkten
       um genau 0,0730 je Schritt:

         P9 1.0270 · P10 0.9540 · P11 0.8810 · P12 0.8080 · P13 0.7350

       BELEGT am Verordnungstext (gesetze-im-internet.de, Anlage 2
       ImmoWertV, Tabelle 3): bei 12 Punkten gilt a=0,3640 b=0,8080
       c=0,9622, relatives Alter 16 %. Beide anderen Kerne im Haus
       (marktbericht anlage2.js und das Modul v4.2.2) fuehren 0.8080 —
       nur diese Datei nicht.

       WIRKUNG, am echten Kern gemessen (GND 80, 12 Punkte):

         Baujahr 1995  54,04 statt 56,00 Jahre
         Baujahr 1990  51,16 statt 53,78
         Baujahr 1980  46,08 statt 49,44
         Baujahr 1970  41,91 statt 46,00
         Baujahr 1964  39,84 statt 44,37
         Baujahr 1955  37,36 statt 42,54

       Die Restnutzungsdauer fiel also bei genau EINER Punktzahl um bis zu
       4,5 Jahre zu niedrig aus. Betroffen war nur P12 — P11 und P13 sind
       richtig, deshalb sah die Tabelle beim Drueberlesen stimmig aus.

       > Der Pruefer dieser Datei (tools/rnd-pruefung/, 22 Faelle gegen
       > drei unterschriebene Gutachten) hat es nicht gefunden: unter den
       > 22 Faellen war kein Objekt mit 12 Modernisierungspunkten. Ein
       > Pruefer, der seine DECKUNG nicht nennt, wird gruen, ohne die
       > Luecke zu zeigen. Deshalb gibt es jetzt
       > tools/rnd-kerne-pruefen.mjs, der alle 21 Punktzahlen abfaehrt. */
    { a: 0.3640, b: 0.8080, c: 0.9622, rel: 16 },
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
  function calcPunktraster(alter, gnd, modPoints, kernsaniert) {
    /* v3.1.0-GRENZ — Anlage 2 zu Paragraf 12 Abs. 5 Satz 1 ImmoWertV kennt drei
       Grenzen, die V3.0.0 nicht geprueft hat:
         1. Die Formel ist erst ab einem relativen Alter anwendbar, das die
            Tabelle je Punktzahl nennt. Darunter gilt RND = GND - Alter.
         2. Die RND wird auf hoechstens 70 % der GND gestreckt, bei
            nachgewiesener Kernsanierung auf bis zu 90 %.
         3. Die Parabel hat ihren Scheitel bei Alter = b*GND/(2a) und steigt
            danach wieder. Ab Alter >= GND wird deshalb nicht extrapoliert.
       Ohne 1. lieferte die Methode bei jungen Gebaeuden mehr RND als linear,
       ohne 3. bekam ein Haus von 1900 mehr RND als eines von 1964.          */
    const punkte = clampInt(modPoints, 0, 20);
    const k = PUNKTRASTER_KOEFF[punkte];
    const relAlter = gnd > 0 ? (alter / gnd) * 100 : 0;
    const quote = kernsaniert ? 0.90 : 0.70;
    const kappe = gnd * quote;

    let rnd, rohwert = null, anwendbar = true, grenze = null, hinweis = null;

    if (gnd <= 0) {
      rnd = 0; anwendbar = false; grenze = 'keine_gnd';
      hinweis = 'Ohne Gesamtnutzungsdauer keine Rechnung.';
    } else if (alter >= gnd) {
      rnd = 0; anwendbar = false; grenze = 'ueber_gnd';
      hinweis = 'Das Alter erreicht oder ueberschreitet die Gesamtnutzungsdauer. '
              + 'Die Kurve der Anlage 2 liegt hier hinter ihrem Scheitel (Alter '
              + round2(k.b * gnd / (2 * k.a)) + ' Jahre) und wuerde wieder steigen. '
              + 'Es wird nicht extrapoliert.';
    } else if (relAlter < k.rel) {
      rnd = Math.max(0, gnd - alter); anwendbar = false; grenze = 'unter_schwelle';
      hinweis = 'Relatives Alter ' + round2(relAlter) + ' % liegt unter der Schwelle von '
              + k.rel + ' % fuer ' + punkte + ' Modernisierungspunkte. '
              + 'Modernisierungen wirken sich erst ab dieser Schwelle aus; '
              + 'bis dahin gilt RND = GND - Alter.';
    } else {
      rohwert = (k.a * alter * alter / gnd) - (k.b * alter) + (k.c * gnd);
      rnd = Math.max(0, rohwert);
      if (rnd > kappe) {
        grenze = 'gestreckt';
        hinweis = 'Rohwert ' + round2(rohwert) + ' Jahre auf ' + round2(kappe)
                + ' Jahre gekappt (' + Math.round(quote * 100) + ' % der Gesamtnutzungsdauer'
                + (kernsaniert ? ', Kernsanierung nachgewiesen' : '') + ').';
        rnd = kappe;
      }
    }

    const awm = gnd > 0 ? ((gnd - rnd) / gnd) * 100 : 0;

    // Formatiere wie im Original-Gutachten:
    // "1,2500 x 30 Jahre² / 70 Jahre - 2,6250 x 30 Jahre + 1,5250 * 70 Jahre = 44,07 Jahre"
    const formula = anwendbar
      ? (fmtNum4(k.a) + ' × ' + alter + ' Jahre² / ' + gnd + ' Jahre - '
         + fmtNum4(k.b) + ' × ' + alter + ' Jahre + '
         + fmtNum4(k.c) + ' × ' + gnd + ' Jahre = '
         + fmtNum2(rohwert === null ? rnd : rohwert) + ' Jahre')
      : (grenze === 'unter_schwelle'
          ? (gnd + ' Jahre - ' + alter + ' Jahre = ' + fmtNum2(rnd) + ' Jahre (linear, Formel noch nicht anwendbar)')
          : 'Formel nicht anwendbar');

    return {
      method: 'punktraster',
      label: 'Punktrastermethode (ImmoWertV Anl. 2)',
      modernisierungspunkte: punkte,
      modernisierungsgrad_text: punkteToGrad(punkte),
      relatives_alter_pct: round2(relAlter),
      koeffizienten: { a: k.a, b: k.b, c: k.c, schwelle_rel: k.rel },
      /* v3.1.0-GRENZ */
      anwendbar: anwendbar,
      grenze: grenze,
      hinweis: hinweis,
      rohwert: rohwert === null ? null : round2(rohwert),
      streckungsgrenze: round2(kappe),
      streckungsquote_pct: Math.round(quote * 100),
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
   * Technische Restnutzungsdauer aus dem Zustand der Gewerke.
   *
   *   veraltet:  RND-Basis × Anteil/100 / 2  → ABZUG
   *   zeitgemaess (standard): NEUTRAL        → siehe unten
   *   gehoben:   RND-Basis × Anteil/100 / 2  → maessiger AUFSCHLAG
   *
   * ── v2074 · ZEITGEMAESSHEIT IST KEIN AUFSCHLAG ──────────────────────
   *
   * HIER STAND "Aktueller Standard: AUFSCHLAG (NICHT neutral!)" mit
   * halber und fuer `gehoben` mit VOLLER Gewichtung. Am 10.10.2026
   * nachgemessen, was das bedeutet (GND 80, alle Gewerke zeitgemaess):
   *
   *     Alter 10 -> 80 Jahre von 80   =  0,00 % Alterswertminderung
   *     Alter 28 -> 78 Jahre          =  2,50 %
   *     Alter 48 -> 48 Jahre          = 40,00 %
   *
   * Ein zehn Jahre genutztes Gebaeude ohne jede Abnutzung ist kein
   * Bewertungsergebnis. Und mit `gehoben` erreichte schon ein Alter von
   * 10 die volle Gesamtnutzungsdauer.
   *
   * Marcels Festlegung 1 vom 10.10.2026 ordnet das richtig zu:
   * "Ursprüngliche, aber nachweislich zeitgemäße Bauteile dürfen
   * Modernisierungspunkte erhalten." Zeitgemaessheit wirkt also ueber
   * die PUNKTE in Anlage 2 - dort ist sie ausdruecklich vorgesehen und
   * modellkonform gedeckelt. Ein zweites Mal als Aufschlag auf die
   * technische RND gerechnet, zaehlt sie doppelt.
   *
   * Deshalb: zeitgemaess = Normalfall = Basis (GND - Alter). Nur
   * nachweislich gehobene, also erneuerte Gewerke geben einen
   * Aufschlag, und zwar den halben statt den vollen.
   *
   * ── DER DECKEL ──────────────────────────────────────────────────────
   * Zusaetzlich 0,90 × GND als Obergrenze. Begruendung: Anlage 2 streckt
   * selbst bei vollstaendiger Kernsanierung nur auf 90 Prozent der GND -
   * es bleibt ein Abschlag fuer die verbliebene Altsubstanz. Was nach
   * einer Kernsanierung nicht erreichbar ist, kann ein Gebaeude ohne
   * eine solche nicht ueberschreiten.
   *
   * > Die Zahlenwerte dieser Formel (halbe Gewichtung, 0,90-Deckel) sind
   * > ein MODELLANSATZ und gehoeren sachverstaendig bestaetigt. Der
   * > Befund, den sie behebt, ist dagegen gemessen: 0,00 Prozent
   * > Alterswertminderung bei zehn Jahren Alter.
   *
   * ── FEHLENDE ANGABE IST NICHT "ZEITGEMAESS" ─────────────────────────
   * HIER STAND `|| 'standard'`: ein Gewerk ohne Bewertung galt als
   * zeitgemaess und bekam den Aufschlag. `calcTechnisch(28, 80, {})`
   * ergab deshalb 78 statt 52 Jahre - ohne eine einzige Angabe. Nicht
   * bewertete Gewerke werden jetzt gezaehlt und in `unbewertet_pct`
   * ausgewiesen; sie wirken neutral, behaupten aber nichts.
   */
  function calcTechnisch(alter, gnd, gewerkeBewertung, gewerkeWeights, gewerkeRestlebensdauer) {
    const weights = gewerkeWeights || {};
    let pctVeraltet = 0, pctStandard = 0, pctGehoben = 0, pctUnbewertet = 0, totalWeight = 0;

    // Gewerke mit ihren prozentualen Anteilen aufaddieren (wie im Original-Gutachten Kap. 5.3.2)
    GEWERKE.forEach(function (g) {
      const w = (weights[g.id] != null) ? Number(weights[g.id]) : g.weight;
      totalWeight += w;
      const grad = (gewerkeBewertung && gewerkeBewertung[g.id]) || null;
      if (grad === 'veraltet') pctVeraltet += w;
      else if (grad === 'gehoben') pctGehoben += w;
      else if (grad === 'standard') pctStandard += w;
      else pctUnbewertet += w;   /* v2074: nicht bewertet, nicht "zeitgemaess" */
    });

    // Auf 100% normieren falls Gewichte abweichen
    if (totalWeight > 0 && totalWeight !== 100) {
      pctVeraltet   = (pctVeraltet   / totalWeight) * 100;
      pctStandard   = (pctStandard   / totalWeight) * 100;
      pctGehoben    = (pctGehoben    / totalWeight) * 100;
      pctUnbewertet = (pctUnbewertet / totalWeight) * 100;
    }

    // Lineare Basis (= Regelfallformel: GND - Alter)
    const rndBasis = Math.max(0, gnd - alter);

    /* v2074: zeitgemaess wirkt neutral (siehe Kopf), gehoben mit halber
       Gewichtung, veraltet zieht ab. */
    const abzugVeraltet     = rndBasis * pctVeraltet / 100 / 2;
    const aufschlagStandard = 0;
    const aufschlagGehoben  = rndBasis * pctGehoben  / 100 / 2;

    let rnd = rndBasis - abzugVeraltet + aufschlagStandard + aufschlagGehoben;
    /* v2074: Obergrenze 0,90 x GND - was eine Kernsanierung nach
       Anlage 2 nicht erreicht, erreicht ein Gebaeude ohne sie nicht. */
    const technischMax = gnd * 0.90;
    const gedeckelt = rnd > technischMax;
    rnd = Math.max(0, Math.min(rnd, technischMax, gnd));

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
                  + fmtNum2(aufschlagGehoben) + ' Jahre = ' + fmtNum2(rnd) + ' Jahre'
                  + (gedeckelt ? ' (gedeckelt auf 0,90 x GND = ' + fmtNum2(technischMax) + ')' : '');

    return {
      method: 'technisch',
      label: 'Technische Restnutzungsdauer',
      /* v2074 - Deckung der Bewertung: ohne sie sieht ein Ergebnis aus
         Annahmen genauso aus wie eines aus Angaben. */
      anteil_unbewertet_pct: round2(pctUnbewertet),
      gedeckelt_auf_90_prozent: gedeckelt,
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
    const applySchadensAbschlag = input.applySchadensAbschlag === true;

    const linear = calcLinear(alter, gnd);
    const vogels = calcVogels(alter, gnd);
    const ross = calcRoss(alter, gnd);
    const parabel = calcParabel(alter, gnd);
    const kernsaniert = input.kernsaniert === true;
    const punktraster = calcPunktraster(alter, gnd, modPoints, kernsaniert);
    const technisch = calcTechnisch(alter, gnd, gewerke, weights, gewerkeRLD);

    const schadensInfo = processSchaeden(schaeden);

    let recommended = technisch.restnutzungsdauer;
    let recommendedNachSchaden = recommended;
    if (applySchadensAbschlag && schadensInfo.gesamtAbschlag_pct > 0) {
      recommendedNachSchaden = recommended * (1 - schadensInfo.gesamtAbschlag_pct / 100);
      recommendedNachSchaden = Math.max(0, recommendedNachSchaden);
    }

    /* v3.1.0-GRENZ — Verfahrenswahl mit Herkunft statt stillem Rueckfall.
       Die technische Alterswertminderung fuehrt, solange sie eine Basis hat
       (GND > Alter). Hat sie keine, tritt das Punktraster an ihre Stelle,
       aber nur wenn es nach Anlage 2 ueberhaupt anwendbar ist. Sonst gibt es
       KEINEN Wert - eine Zahl ohne Verfahren waere schlimmer als keine.     */
    const grenzen = [];
    const basisTechnisch = Math.max(0, gnd - alter);

    /* ══ v2074 · DIE BERECHNUNGSREIHENFOLGE ════════════════════════════
       Marcels verbindliche Festlegung vom 10.10.2026, Schritt 3 bis 6:

         3. Modernisierungspunkte nach Anlage 2 ImmoWertV
         4. Berechnung der modellhaften wirtschaftlichen Restnutzungsdauer
         5. Sachverstaendige Plausibilitaetspruefung anhand des
            tatsaechlichen technischen Zustands
         6. Festlegung der endgueltigen wirtschaftlichen RND

       und Regel 3: "Die technische Restlebensdauer eines einzelnen
       Bauteils darf die wirtschaftliche Gebaeude-RND nicht automatisch
       begrenzen" sowie "Das rechnerische Modellergebnis darf nicht
       ungeprueft als endgueltige wirtschaftliche Restnutzungsdauer
       uebernommen werden."

       HIER STAND DIE UMGEKEHRTE REIHENFOLGE: die technische
       Alterswertminderung war "vorrangig" und wurde Endwert, das
       Punktraster lief als Beiwerk mit. Das hat drei unplausible
       Ergebnisse erzeugt, am 10.10.2026 am echten Portfolio gemessen:

         Objekt    Bj    Alter  Basis  Punktraster  technisch  Endwert
         2026-1002 1998  28     52     52,00        78         78
         2026-1007 1998  28     52     52,00        78         78
         2026-999  1998  28     52     52,00        78         78

       78 Jahre bei einem 28 Jahre alten Gebaeude sind 2,5 Prozent
       Alterswertminderung - praktisch ein Neubau. Bei Alter 10 kommt
       dieselbe Formel auf 80 von 80 Jahren, also NULL Abnutzung.

       Die Ursache liegt in calcTechnisch: ein als zeitgemaess
       bewertetes Gewerk gibt dort einen AUFSCHLAG von 50 Prozent auf
       die Basis-RND, ein fehlendes gilt als zeitgemaess und bekommt ihn
       ebenfalls. Zeitgemaessheit gehoert nach Marcels Festlegung 1 aber
       in die MODERNISIERUNGSPUNKTE nach Anlage 2 - dort darf ein nie
       modernisiertes, aber zeitgemaesses Bauteil Punkte erhalten - und
       nicht in einen Aufschlag auf die technische Restnutzungsdauer.

       > Das Modell rechnet. Die Technik prueft. Der Sachverstaendige
       > entscheidet. In dieser Reihenfolge.

       Die technische RND bleibt vollstaendig in `methods.technisch`
       erhalten und wird als Plausibilitaetspruefung ausgewiesen - sie
       verschwindet nicht, sie urteilt nur nicht mehr allein.         */
    let final, finalSource, verfahren;
    if (punktraster.anwendbar && punktraster.restnutzungsdauer > 0) {
      final = punktraster.restnutzungsdauer;
      verfahren = 'punktraster';
      finalSource = 'Punktrastermethode (Anlage 2 ImmoWertV) - Modellergebnis';
      /* Schritt 5: die Technik prueft das Modell, ersetzt es nicht. */
      if (basisTechnisch > 0 && recommendedNachSchaden != null) {
        const abw = recommendedNachSchaden - final;
        const abwPct = final > 0 ? Math.abs(abw / final) * 100 : 0;
        if (abwPct >= 20) {
          grenzen.push({
            greift: true, art: 'technik_weicht_ab',
            text: 'Die technische Alterswertminderung ergibt '
                + round2(recommendedNachSchaden) + ' Jahre und weicht damit um '
                + round2(abw) + ' Jahre (' + round2(abwPct) + ' %) vom Modellergebnis ab. '
                + (abw < 0
                   ? 'Der bauliche Zustand ist schlechter, als das Modell unterstellt - '
                   + 'Erneuerungsbedarf und Instandhaltungsrueckstand pruefen.'
                   : 'Der bauliche Zustand ist besser, als das Modell unterstellt - '
                   + 'pruefen, ob zeitgemaesse Bauteile als Modernisierungspunkte '
                   + 'anzusetzen sind (Anlage 2 laesst das zu).')
                + ' Eine Abweichung wird sachverstaendig gewuerdigt und begruendet, '
                + 'nicht automatisch uebernommen.',
            quelle: 'Fachliche Festlegung 10.10.2026, Schritt 5 - Plausibilitaetspruefung'
          });
        }
      }
    } else if (basisTechnisch > 0) {
      /* Kein Modellergebnis (relatives Alter unter der Schwelle der
         Anlage 2, oder keine Punkte) - dann traegt die technische
         Ermittlung, und das wird benannt. */
      final = recommendedNachSchaden;
      verfahren = 'technisch';
      finalSource = applySchadensAbschlag && schadensInfo.gesamtAbschlag_pct > 0
        ? 'technische Alterswertminderung + Schadensabschlag (-' + schadensInfo.gesamtAbschlag_pct + '%)'
        : 'technische Alterswertminderung - kein Modellergebnis nach Anlage 2';
    } else if (punktraster.anwendbar && punktraster.restnutzungsdauer > 0) {
      final = punktraster.restnutzungsdauer;
      verfahren = 'punktraster';
      finalSource = 'Punktrastermethode - technisch nicht mehr ableitbar (Alter >= GND)';
    } else {
      /* ── v2073 · ALTER >= GND: BASIS NULL, ABER KEIN URTEIL ───────────
         Marcels fachliche Festlegung vom 10.10.2026:

           „Die rechnerische Basis-RND beträgt 0 Jahre. Daraus darf jedoch
            nicht automatisch die tatsächliche wirtschaftliche
            Restnutzungsdauer mit 0 Jahren abgeleitet werden. Eine
            unkontrollierte Extrapolation der quadratischen
            Modernisierungsformel über ihren fachlich plausiblen Bereich
            ist ebenfalls nicht zulässig."

         HIER STAND: „kein Verfahren liefert einen Wert (Alter >= GND,
         Anlage 2 nicht anwendbar)". Das ist genau die Aussage, die
         Marcel untersagt — Anlage 2 ist bei Alter >= GND nicht
         GESETZLICH ausgeschlossen; was dort endet, ist der fachlich
         plausible Bereich ihrer Formel. Der Unterschied ist nicht
         akademisch: ein Gutachten, das sich auf einen Ausschluss beruft,
         den die Verordnung nicht hergibt, ist angreifbar.

         Was die Gegenprobe am Gutachten-Modul V4.2 zeigt, warum hier
         NICHT extrapoliert wird (am echten `verfahrenPunktraster`
         gerechnet, GND 80, 8 Punkte):

             Alter  56 ->  38,0 Jahre
             Alter  88 ->  31,6   (Scheitel)
             Alter 130 ->  42,6
             Alter 160 ->  56,0   = Kappe 0,7 * GND

         Hinter dem Scheitel STEIGT die Parabel wieder. Ein 160 Jahre
         altes Gebaeude bekaeme dort 56 Jahre Restnutzungsdauer - mehr
         als ein 56 Jahre altes mit 38. Die Formel rechnet weiter, aber
         sie bedeutet dort nichts mehr.

         Deshalb: Basis 0 ausweisen, die Pruefung VERLANGEN, und einen
         positiven Wert nur ueber `input.reelleRND` annehmen - also erst
         nach dokumentierter fachlicher Beurteilung.                    */
      final = 0;
      verfahren = 'keines';
      finalSource = 'rechnerische Basis 0 Jahre - tatsaechliche Restnutzungsdauer '
                  + 'sachverstaendig zu beurteilen';
      grenzen.push({
        greift: true, art: 'pruefung_erforderlich',
        text: 'Das Alter (' + alter + ' J.) erreicht die Gesamtnutzungsdauer (' + gnd + ' J.). '
            + 'Die rechnerische Basis betraegt damit 0 Jahre. Daraus folgt NICHT, dass die '
            + 'wirtschaftliche Restnutzungsdauer 0 ist: ein genutztes Gebaeude hat eine. '
            + 'Die Formel der Anlage 2 wird hier NICHT fortgerechnet - sie liegt hinter '
            + 'ihrem Scheitelpunkt und steigt dort wieder an, was fachlich nicht tragfaehig ist. '
            + 'Zu beurteilen sind Modernisierung, Sanierung, baulicher Zustand und '
            + 'wirtschaftliche Nutzbarkeit; bei Kernsanierung ist ein fiktives Baujahr zu '
            + 'pruefen. Ein positiver Wert wird erst nach dokumentierter Beurteilung '
            + 'uebernommen (reelle Restnutzungsdauer).',
        quelle: 'Fachliche Festlegung 10.10.2026 - Grenze des Modellbereichs der Anlage 2, '
              + 'kein gesetzlicher Ausschluss'
      });
    }

    if (punktraster.grenze) {
      grenzen.push({
        greift: true, art: punktraster.grenze, text: punktraster.hinweis,
        quelle: punktraster.grenze === 'unter_schwelle'
          ? 'Anlage 2 ImmoWertV, Spalte "ab einem relativen Alter von"'
          : 'Anlage 2 ImmoWertV - Modellansatz'
      });
    }

    /* Plausibilitaetsanker 30 % der GND. Paragraf 185 Abs. 3 Satz 5 BewG:
       "Die Restnutzungsdauer eines noch nutzbaren Gebaeudes betraegt regelmaessig
       mindestens 30 Prozent der wirtschaftlichen Gesamtnutzungsdauer."
       Das gilt fuer die steuerliche Grundbesitzbewertung. Fuer ein Gutachten nach
       Paragraf 7 Abs. 4 Satz 2 EStG ist es KEIN bindender Grenzwert - deshalb
       wird gemeldet und nicht gekappt.                                        */
    const mindest30 = round2(gnd * 0.30);
    const unter30 = final > 0 && final < mindest30;
    if (unter30) {
      grenzen.push({
        greift: true, art: 'unter_30_prozent',
        text: 'Ergebnis ' + round2(final) + ' Jahre liegt unter 30 % der Gesamtnutzungsdauer ('
            + mindest30 + ' Jahre) und entspraeche einem AfA-Satz von '
            + round2(100 / final) + ' % gegenueber 2 % im gesetzlichen Normalfall. '
            + 'Sachverstaendig wuerdigen, bevor der Wert uebernommen wird.',
        quelle: 'Paragraf 185 Abs. 3 Satz 5 BewG - dort bindend, hier Plausibilitaetsanker'
      });
    }

    let reell = null;
    if (input.reelleRND != null && input.reelleRND > 0) {
      reell = round2(Number(input.reelleRND));
      final = Number(input.reelleRND);
      verfahren = 'reell';
      finalSource = 'reelle Restnutzungsdauer - sachverstaendige Korrektur';
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
      final_source: finalSource,
      /* v3.1.0-GRENZ */
      verfahren: verfahren,
      reelle_rnd: reell,
      grenzen: grenzen,
      plausibilitaet: {
        mindest_30_prozent: mindest30,
        unterschritten: unter30,
        afa_satz_pct: final > 0 ? round2(100 / final) : null
      },
      /* ── v2073 · DIE PRUEFPFLICHT ALS FLAGGE, NICHT ALS FLIESSTEXT ────
         Marcel am 10.10.2026: „Bei überschrittener GND soll die Software
         eine sachverständige Prüfung verlangen … Ein endgültiger
         positiver RND-Wert wird erst nach dokumentierter fachlicher
         Beurteilung übernommen."

         Ein Hinweis, der nur in `grenzen[].text` steht, kann eine
         Oberflaeche nicht abfragen - sie muesste Text durchsuchen. Also
         gibt es die Pflicht als EIN Feld, das jeder Aufrufer prueft,
         bevor er einen Wert uebernimmt. Die beiden Faelle sind
         absichtlich getrennt: die 30-%-Marke ist ein Anker, der gemeldet
         und nicht gekappt wird; die ueberschrittene GND ist eine Sperre. */
      pruefung: {
        erforderlich: basisTechnisch <= 0 || unter30,
        grund: basisTechnisch <= 0
          ? 'alter_erreicht_gnd'
          : (unter30 ? 'unter_30_prozent_der_gnd' : null),
        /* Darf das Ergebnis ohne Beurteilung uebernommen werden? */
        uebernahme_gesperrt: basisTechnisch <= 0 && reell == null,
        /* Was die Sperre loest: eine dokumentierte reelle RND. */
        loest_die_sperre: 'input.reelleRND (sachverstaendig, mit Begruendung)',
        basis_rnd_jahre: round2(Math.max(0, gnd - alter)),
        hinweis: basisTechnisch <= 0
          ? 'Rechnerische Basis 0 Jahre. Das ist KEINE Aussage, dass die wirtschaftliche '
          + 'Restnutzungsdauer 0 ist - sie ist sachverstaendig zu beurteilen.'
          : null
      }
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

  /* ═══ v1364 · DIE ZONENGRENZEN KOMMEN AUS DEM TARIF ══════════════════
     Hier stand eine dritte Steuerstaffel mit eigenen Grenzen (12.096 /
     17.443 / 68.480) - der Jahrgang 2025. Zusammen mit tax.js (11.604)
     und dashboard.js (11.784) waren das DREI verschiedene
     Grundfreibetraege im selben Programm, keiner davon 2026.

     Marcels Vorgabe: „das darf ja nicht an 3 stellen unterschiedlich
     sein." Der Satz kommt jetzt aus `Tax.calcGrenzsteuersatz()`, also aus
     demselben Tarif wie jede andere Steuerzahl der App.

     WAS BLEIBT: der Solidaritaetszuschlag ab 96.000 EUR und der Deckel
     bei 47,5 %. Beides gehoert nicht in den §-32a-Tarif, sondern ist die
     Naeherung DIESER Stelle - sie zu entfernen waere eine Aenderung am
     Ergebnis, und genau die soll es nicht geben.

     Der Rueckfall rechnet wie bisher, falls tax.js einmal fehlt. Er
     traegt bewusst KEINE eigenen Jahreszahlen mehr, sondern die lineare
     Naeherung - eine zweite Staffel waere wieder eine dritte Wahrheit. */

  function estimateGrenzsteuersatz(zve) {
    const z = Number(zve) || 0;
    let satz;
    if (typeof Tax !== 'undefined' && Tax && typeof Tax.calcGrenzsteuersatz === 'function') {
      satz = Tax.calcGrenzsteuersatz(z);
    } else {
      /* grobe Naeherung ohne Jahresbezug - nur, wenn tax.js fehlt */
      satz = z <= 12000 ? 0 : (z <= 70000 ? 0.14 + (z - 12000) / 58000 * 0.28 : 0.42);
    }
    const soli = (z > 96000) ? satz * 0.055 : 0;
    return Math.min(0.475, satz + soli);
  }

  /* ============================================================
     v2073 · DREI ABLEITUNGEN, DIE IM WIZARD LAGEN

     Marcel am 10.10.2026, nach einem Abgleich mit seinem
     Gutachten-Modul: „schauen das die felder aus tab objekt für rnd
     wichtig sind auch tatsächlich reingehen".

     GEMESSEN: sie gingen nicht rein. `calcAll` liest `input.modPoints`,
     `input.gnd` und `input.kernsaniert` — `mapDealPilotObject` hat
     keines davon gesetzt. Die Folge war still und teuer:

       modPoints  -> clampInt(undefined,0,20) = 0   schlechteste Koeffizienten
       gnd        -> (Number(undefined) || 70) = 70  statt 80 (Anlage 1)
       kernsaniert-> false                           Kappe 0,70 statt 0,90

     Ein Objekt mit `mod_punkte = 11` rechnete also mit NULL Punkten,
     und ein ETW-Baujahr 1962 gegen eine Gesamtnutzungsdauer von 70
     statt 80 Jahren. Am Objekt 2026-001 gemessen: 10,5 Jahre statt
     einer plausiblen Zahl — und weil Anlage 2 mit 0 Punkten nichts
     hergab, gewann das technische Verfahren.

     > **Die Ableitungen FEHLTEN nicht — sie lagen im Wizard**
     > (`rnd-wizard.js`: `computeModPoints` 645, `istKernsaniert` 1282,
     > `gndFromObjektTyp` 673). Wer den Wizard bedient, bekam richtige
     > Zahlen; wer den Kern direkt rief, bekam die Defaults. Genau das
     > trennt die App von der Schnittstelle — und deshalb stehen sie
     > jetzt HIER, am Kern, und werden nicht ein zweites Mal
     > geschrieben.

     Die Zahlen sind aus dem Wizard übernommen, nicht neu erfunden:
     dieselben Höchstpunkte je Bauteil, dieselbe Staffel, dieselbe
     GND-Liste (Wohngebäude 80 seit v1439, Anlage 1 ImmoWertV).
     ============================================================ */

  /* Höchstpunkte je Bauteil nach Anlage 2 ImmoWertV, Summe 20.
     ABGELEITET aus MOD_ELEMENTS, nicht daneben geschrieben.

     v2075: In v2073 stand hier eine eigene Liste mit denselben acht
     Zahlen. Gemessen waren sie identisch - also eine Doppelung, und
     zwar genau die, die zwei Absaetze weiter unten kritisiert wird
     ("vier Ableitungen derselben Zahl laufen auseinander"). Sie wurde
     im selben Zug eingebaut, in dem der Kern die Punktevergabe
     uebernahm. Eine zweite Liste ist nicht falsch, solange sie stimmt -
     sie ist falsch, SOBALD jemand eine der beiden aendert. */
  var MOD_MAX = (function () {
    var m = {};
    MOD_ELEMENTS.forEach(function (e) { m[e.id] = e.max; });
    return m;
  })();

  /**
   * Modernisierungspunkte aus den acht Bauteil-Angaben.
   * Erwartet die Klartext-Stufen des Reiters Objekt
   * ("Keine/Nie", "> 20 Jahre", "10 - 20 Jahre", "5 - 10 Jahre",
   *  "< 5 Jahre", "Kernsanierung").
   */
  function punkteAusMod(mod) {
    if (!mod) return { total: 0, elemente: {} };
    var elemente = {}, total = 0;
    Object.keys(MOD_MAX).forEach(function (key) {
      var z = String(mod[key] || 'Keine/Nie');
      var p = 0;
      if (z.indexOf('< 5') >= 0 || /kernsanier/i.test(z)) p = MOD_MAX[key];
      else if (z.indexOf('5 - 10') >= 0 || z.indexOf('5-10') >= 0) p = Math.round(MOD_MAX[key] * 0.7);
      else if (z.indexOf('10 - 20') >= 0 || z.indexOf('10-20') >= 0) p = Math.round(MOD_MAX[key] * 0.4);
      elemente[key] = p;
      total += p;
    });
    return { total: Math.min(20, total), elemente: elemente };
  }

  /**
   * Modernisierungspunkte aus einer ja/teilweise/nein-Angabe je Bauteil.
   *
   * Dieselben Hoechstpunkte wie `punkteAusMod`, nur ein anderes
   * Eingabeformat: der BMF-Rechner und die Wohnungsliste fragen nicht
   * nach Zeitstufen, sondern nach "modernisiert ja / teilweise / nein".
   *
   * ── v2075 · WARUM DAS HIER STEHT UND NICHT DORT ─────────────────────
   * `bmf-bodenabschlag.js` hat die Punkte selbst vergeben, mit PAUSCHAL
   * 2 je Bauteil. Anlage 2 gibt Dach und Aussenwand aber je 4 - die
   * Summe ist 20, nicht 16. Am 10.10.2026 gemessen:
   *
   *     Fall                 BMF alt   Anlage 2
   *     alles modernisiert        16         20
   *     nur Dach                   2          4
   *     Dach + Aussenwand          4          8
   *
   * Wirkung auf die Restnutzungsdauer bei GND 80: bei Alter 64 sind das
   * 3,11 Jahre. Dasselbe Objekt bekam im BMF-Rechner also eine andere
   * Restnutzungsdauer als im Wizard, und zwar lautlos.
   *
   * Es war die VIERTE Stelle, die Punkte vergibt (Wizard, Kern,
   * BMF-Rechner, deal-action aus `sanstand`). Vier Ableitungen derselben
   * Zahl laufen auseinander - das hat `score-tiers.js` schon einmal
   * gezeigt. Deshalb steht sie jetzt am Kern.
   *
   * Erkannt werden: ja / voll / v / true  -> volle Punkte
   *                 teil / teilweise / h  -> halbe, aufgerundet
   *                 alles andere          -> 0
   */
  function punkteAusJaTeilNein(werte) {
    if (!werte) return { total: 0, elemente: {}, bewertet: 0 };
    var elemente = {}, total = 0, bewertet = 0;
    Object.keys(MOD_MAX).forEach(function (id) {
      var v = String(werte[id] == null ? '' : werte[id]).toLowerCase().trim();
      var p = 0;
      if (v === 'ja' || v === 'voll' || v === 'v' || v === 'true') { p = MOD_MAX[id]; bewertet++; }
      else if (v === 'teil' || v === 'teilweise' || v === 'h') { p = Math.round(MOD_MAX[id] * 0.5); bewertet++; }
      elemente[id] = p;
      total += p;
    });
    return { total: Math.min(20, total), elemente: elemente, bewertet: bewertet };
  }

  /** Kernsanierung an irgendeinem Bauteil? Dann gilt die Streckung auf 0,90·GND. */
  function istKernsaniert(mod) {
    if (!mod) return false;
    return Object.keys(mod).some(function (k) { return /kernsanier/i.test(String(mod[k] || '')); });
  }

  /**
   * Gesamtnutzungsdauer aus der Objektart, Anlage 1 ImmoWertV 2021.
   *
   * Marcels fachliche Festlegung vom 10.10.2026: „Für Eigentumswohnungen
   * in Mehrfamilienhäusern gilt standardmäßig eine GND von 80 Jahren
   * gemäß Anlage 1 ImmoWertV. Abweichende Modellvorgaben oder
   * sachverständig begründete Ansätze müssen gesondert auswählbar und
   * dokumentierbar sein."
   *
   * Das Auswählbare ist `input.gnd`: wer eine andere GND führt, setzt
   * sie und übersteuert diese Ableitung. Woher sie dann kommt, gehört
   * in den Modellvermerk — nicht hierher.
   *
   * Die Werte stimmen mit `rnd-wizard.js:673` überein. Die zentrale
   * Tabelle (`rnd-gnd-table.js`) direkt zu fragen geht NICHT: dort
   * landen unbekannte Bezeichnungen bei mfh = 80 statt bei 60 (v1439).
   */
  function gndAusObjektTyp(typ) {
    if (!typ) return 80;
    var t = String(typ).toLowerCase();
    if (t.indexOf('hotel') >= 0 || t.indexOf('budget') >= 0) return 40;
    if (t.indexOf('büro') >= 0 || t.indexOf('buero') >= 0 || t.indexOf('geschäft') >= 0
        || t.indexOf('geschaeft') >= 0) return 60;
    if (t.indexOf('industrie') >= 0 || t.indexOf('lager') >= 0 || t.indexOf('werk') >= 0) return 40;
    if (t.indexOf('garage') >= 0) return 60;
    return 80;  /* ETW, MFH, EFH, DHH, RH - Anlage 1 ImmoWertV */
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
   *
   * Zweiter Parameter `opt` (v2073), alles optional:
   *   opt.stichtag  — der Wertermittlungsstichtag. OHNE Angabe gilt
   *                   HEUTE, nicht das Kaufdatum (siehe unten).
   *   opt.zweck     — 'verkehrswert' (Vorgabe) oder 'afa'
   *   opt.gnd       — übersteuert die Ableitung aus der Objektart
   */
  function mapDealPilotObject(d, opt) {
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

    /* v1851 · N4: Gewerke-Stufen (ausst_*, Anlage 4, 1-5) ersetzen die
       Sterne - dieselbe Schwelle (<=2 veraltet, 3 standard, >=4 gehoben),
       nur die Quelle ist jetzt die Gewerke-Tabelle. Altobjekte ohne
       Gewerke-Stufen fallen auf die Sterne zurueck, bis sie einmal
       gespeichert wurden. Kueche bleibt bei den Baedern (kein Gewerk). */
    const gradBaeder   = rateToGrad(d.ausst_sanitaer)   || rateToGrad(d.rate_bad)     || fallbackGrad;
    const gradFenster  = rateToGrad(d.ausst_fenster)    || rateToGrad(d.rate_fenster) || fallbackGrad;
    const gradBoden    = rateToGrad(d.ausst_fussboeden) || rateToGrad(d.rate_boden);  // boden mappt auf "innenausbau"
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
    /* v1856 · Marcel: „Bedachung, Fenster, Heizungsart, das haben wir ja
       alles. Das können wir ja alles schon angeben." Die Gewerke-Stufen aus
       dem Reiter Objekt (ausst_*, Anlage 4) gehen jetzt je Gewerk vor den
       Energie-Rückschluss — dieselbe Schwelle wie bei Bad/Fenster/Boden. */
    const gradDach    = rateToGrad(d.ausst_dach);
    const gradHeizung = rateToGrad(d.ausst_heizung);
    const gradWand    = rateToGrad(d.ausst_aussenwaende);
    const gradTechnik = rateToGrad(d.ausst_technik);
    const gradDecken  = rateToGrad(d.ausst_decken);
    const gradInnen   = rateToGrad(d.ausst_innenwaende);
    const gewerkeBewertung = {
      dach:       gradDach || energieGrad || mehrheit,    // Wärmedämmung Dach
      fenster:    gradFenster || energieGrad || mehrheit,
      leitungen:  gradTechnik || mehrheit,
      heizung:    gradHeizung || energieGrad || mehrheit,    // Heizung wird stark vom Energiekennwert geprägt
      aussenwand: gradWand || energieGrad || mehrheit,    // Wärmedämmung Außenwand
      baeder:     gradBaeder || mehrheit,
      decken:     gradDecken || gradInnen || mehrheit,
      technik:    gradTechnik || gradKueche || mehrheit,
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

    /* ── v2073 · Die acht Bauteil-Angaben aus dem Reiter Objekt ──────────
       Sie heissen dort `mod_<bauteil>` und tragen Klartext-Stufen.
       `mod_punkte` ist die im Objekt GESPEICHERTE Punktzahl (geschrieben
       von objekt-reiter.js) und hat Vorrang - sie ist das, was der
       Nutzer in der App sieht. Fehlt sie, wird aus den acht Feldern
       gerechnet: gemessen am 10.10.2026 hatten 10 von 21 Objekten
       gefuellte `mod_*` und ein LEERES `mod_punkte`. Wer nur auf
       `mod_punkte` baut, verliert bei knapp der Haelfte die Angaben. */
    var mod = {
      dach: d.mod_dach, fenster: d.mod_fenster, leitungen: d.mod_leitungen,
      heizung: d.mod_heizung, aussenwand: d.mod_aussenwand, baeder: d.mod_baeder,
      innenausbau: d.mod_innenausbau, grundriss: d.mod_grundriss
    };
    var modHatAngaben = Object.keys(mod).some(function (k) {
      var v = String(mod[k] || '').trim();
      return v !== '' && v !== 'Keine/Nie';
    });
    var gespeichertePunkte = parseInt(d.mod_punkte, 10);
    var punkteObj = punkteAusMod(mod);
    var modPoints = (!isNaN(gespeichertePunkte) && gespeichertePunkte > 0)
      ? Math.min(20, gespeichertePunkte)
      : (modHatAngaben ? punkteObj.total : 0);

    /* ── v2073 · Der Stichtag ist eine FESTLEGUNG, keine Nebenwirkung ───
       Marcel am 10.10.2026: „Maßgeblich ist der explizit festgelegte
       Wertermittlungs- beziehungsweise steuerlich relevante Stichtag.
       Für aktuelle Verkehrswertgutachten ist nicht automatisch das
       Kaufdatum maßgeblich. Für AfA-Gutachten ist der steuerlich
       relevante Betrachtungsbeginn zu berücksichtigen."

       HIER STAND `stichtag: d.kaufdat || d._at || null`. Das hat jedes
       Objekt stillschweigend zu seinem Kaufdatum gerechnet - bei einem
       2019 gekauften Haus also sieben Jahre zu jung. Am Objekt
       2026-001 gemessen: Stichtag 2026-07-01 statt heute.

       Drei Wege, in dieser Rangfolge:
         1. `opt.stichtag` - ausdruecklich gesetzt, gilt immer
         2. zweck 'afa'   - wirtschaftlicher Uebergang (Nutzen-/Lasten-
                            wechsel), sonst Kaufdatum
         3. Vorgabe       - HEUTE, denn ein Verkehrswert wird auf einen
                            aktuellen Stichtag ermittelt
       Welcher Weg gegriffen hat, steht in `stichtag_herkunft` - eine
       Herkunftsangabe gehoert an den Wert, nicht in ein Protokoll. */
    var zweck = (opt && opt.zweck) || 'verkehrswert';
    var stichtag, stichtagHerkunft;
    if (opt && opt.stichtag) {
      stichtag = opt.stichtag;
      stichtagHerkunft = 'ausdruecklich gesetzt';
    } else if (zweck === 'afa') {
      stichtag = d.wirtschaftlicher_uebergang || d.kaufdat || d._at || null;
      stichtagHerkunft = d.wirtschaftlicher_uebergang
        ? 'wirtschaftlicher Uebergang (steuerlicher Betrachtungsbeginn)'
        : (d.kaufdat ? 'Kaufdatum - wirtschaftlicher Uebergang fehlt' : 'nicht bestimmbar');
    } else {
      stichtag = new Date().toISOString().slice(0, 10);
      stichtagHerkunft = 'heute (Verkehrswert-Stichtag)';
    }

    var gndGesetzt = opt && opt.gnd != null && Number(opt.gnd) > 0;
    var gnd = gndGesetzt ? Number(opt.gnd) : gndAusObjektTyp(d.objart);

    return {
      baujahr: parseInt(d.baujahr, 10) || null,
      stichtag: stichtag,
      stichtag_herkunft: stichtagHerkunft,
      zweck: zweck,
      objektTyp: mapObjektTyp(d.objart),
      /* v2073 - vorher fehlten diese drei und liefen in die Defaults */
      gnd: gnd,
      gnd_herkunft: gndGesetzt
        ? 'ausdruecklich gesetzt'
        : 'Anlage 1 ImmoWertV, abgeleitet aus der Objektart "' + (d.objart || 'unbekannt') + '"',
      modPoints: modPoints,
      modPoints_herkunft: (!isNaN(gespeichertePunkte) && gespeichertePunkte > 0)
        ? 'Feld mod_punkte im Objekt'
        : (modHatAngaben ? 'gerechnet aus den acht mod_*-Angaben' : 'keine Modernisierungsangaben'),
      modPoints_elemente: punkteObj.elemente,
      kernsaniert: istKernsaniert(mod),
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
    VERSION: '3.1.0',   /* v3.1.0-GRENZ */
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
    /* v2073 - die drei Ableitungen, die bis dahin nur im Wizard lagen.
       Sie stehen hier, damit der Wizard sie von HIER nimmt und keine
       zweite Fassung entsteht: `score-tiers.js` hat gezeigt, was eine
       erlaubte Doppelung kostet (vier Kopien, drei davon abweichend). */
    MOD_MAX: MOD_MAX,
    punkteAusMod: punkteAusMod,
    punkteAusJaTeilNein: punkteAusJaTeilNein,
    istKernsaniert: istKernsaniert,
    gndAusObjektTyp: gndAusObjektTyp,
    punkteToGrad: punkteToGrad,
    parseStichtagYear: parseStichtagYear,
    fmtNum2: fmtNum2,
    fmtNum4: fmtNum4
  };
})(typeof window !== 'undefined' ? window : globalThis);
