'use strict';
/* ═══════════════════════════════════════════════════════════════════
   DEALPILOT – portfolio-strategy.js                       (V127)

   PORTFOLIO-STRATEGIE 3.0
   ───────────────────────
   – V125: Basis-Engine, 5 Szenarien, NPV/CF, §32a-Tarif
   – V126: Investorprofile, RND-Integration, Pro-Objekt-Verdikte,
           Risk-adjustiertes Score
   – V127: Konzernstrukturen (Holding + n × VV-GmbH + Op-GmbH),
           rollierendes EK, anschaffungsnahe Aufwendungen,
           Nutzen-Lasten-Verschiebung, Bank-Verhandlung,
           Hidden-Menü-Gating

   ARCHITEKTUR
   ───────────
   – Standalone-Hauptview, kein zusätzlicher Tab
   – Liest Objektdaten via getAllObjectsData() (Fallback localStorage)
   – Nutzt Tax.calcEStG() (§32a EStG Tarif 2026)
   – Nutzt DealPilotRND.calcAll() / calcAfaVergleich() pro Objekt
   – Hidden-Gate: Modul nur sichtbar bei dp_ps_unlocked='true' im
     localStorage. Aktivierung: ?ps_unlock=DPSTRAT in URL oder
     Konsole: localStorage.setItem('dp_ps_unlocked','true')

   SZENARIEN (V127: 9 statt 7)
   ───────────────────────────
   1. PRIVAT_BASIS         – Status quo
   2. PRIVAT_OPTIMIERT     – AfA-Hebel + §82b EStDV
   3. VVGMBH_NEU           – nur Neukäufe in VV-GmbH
   4. VVGMBH_SELEKTIV      – nur sinnvolle Objekte umhängen
   5. VVGMBH_KOMPLETT      – Bestand komplett umhängen
   6. HOLDING_STRUKTUR     – Holding + 1× VV-GmbH (§8b KStG)
   7. KONZERN_OPGMBH       – Holding + n× VV-GmbH + Op-GmbH (V127: neu)
   8. WACHSTUM_LTV         – EK aus Beständen freisetzen → Neukäufe
   9. ROLLIERENDES_EK      – 1 Objekt als Daueranker beleihen für Käufe
                             (V127: neu)
   10. STRETCH_SANIERUNG   – Nutzen-Lasten-Verschiebung + voll abziehbare
                              Erhaltungs­aufwendungen vor Erwerb (V127: neu)

   PRO-OBJEKT-VERDIKTE (V127: 14 statt 9)
   ──────────────────────────────────────
   Bestehend (V126): RND-Gutachten, §23-Halten, Eigennutzung,
                     Umhängen, Sanieren, LStER, EK-Refi,
                     LTV-zu-hoch, AfA-halten
   Neu V127:
     – ANSCHAFFUNGSNAH_15PCT     – §6 (1) Nr. 1a EStG-Falle vermeiden
     – BANK_VERHANDLUNG          – Beleihungswert-Reserve nutzen
     – ROLL_EK_KANDIDAT          – Objekt für rollierendes EK
     – OPGMBH_KANDIDAT           – Objekt erzeugt Op-GmbH-Bedarf
     – NUTZEN_LASTEN_VERSCHIEBEN – beim Neukauf vor Erwerb sanieren

   RECHTLICHE QUELLEN
   ──────────────────
   – §32a, §6 (1) Nr. 1a, §23, §82b EStDV
   – §8b, §23 KStG, §9 Nr. 1 S. 2 GewStG
   – §6a UmwStG (für GrESt-Vermeidung – Hinweis only)
   – BFH IX R 25/19 (Aufteilung anschaffungsnah)

   DISCLAIMER
   ──────────
   Modellrechnung, keine Steuer- oder Rechtsberatung iSv §6 StBerG /
   §3 RDG. Strukturentscheidungen ausschließlich mit Steuerberater.
═══════════════════════════════════════════════════════════════════ */

(function() {

  // ── KONSTANTEN ──────────────────────────────────────────────────
  var DEFAULTS = {
    kst_satz:           0.15,        // KStG §23
    solz_satz:          0.055,       // SolzG
    gewst_messzahl:     0.035,       // GewStG §11(2)
    gewst_hebesatz:     400,         // % - User pflegt im Setup
    kapest_satz:        0.25,        // EStG §32d
    kirchensteuer_satz: 0.0,         // optional
    grest_satz_pct:     6.5,         // % NRW Default
    notar_grundbuch_pct: 1.5,        // % Pauschale für interne Übertragungen
    horizon_years:      10,          // Standard-Betrachtungshorizont
    discount_rate:      0.05,        // 5% für NPV
    rnd_gutachten_kosten: 1000,      // € Pauschale für RND-Gutachten
    rnd_roi_schwelle:   5000,        // € Netto-Vorteil ab dem Gutachten klar lohnt
    spekfrist_jahre:    10,          // §23 EStG
    eigennutz_jahre:    3,           // §23 Abs.1 Nr.1 S.3 EStG (Eigennutzung)
    // V127
    anschaffungsnah_grenze_pct: 15,  // §6(1) Nr.1a EStG: 15% des KP innerhalb 3J
    anschaffungsnah_jahre: 3,        // 3-Jahres-Frist
    opgmbh_min_objekte: 8,           // ab wann lohnt sich Op-GmbH typischerweise
    opgmbh_min_san_volumen_y: 30000, // € jährliches Sanierungs­volumen für Op-GmbH
    bank_beleihungsgrenze: 0.80,     // 80% Beleihungs­auslauf bei normalen Banken
    bank_beleihungsgrenze_priv: 0.60,// 60% Beleihungswert-Ansatz vs Verkehrswert
    rollierendes_ek_min_value: 200000, // Mindest-Verkehrswert für Roll-EK-Anker
    nutzen_lasten_max_jahre: 1       // typische Verschiebung max 12 Monate
  };

  // ── INVESTORPROFILE ─────────────────────────────────────────────
  // V128 (Kalibrierung neu):
  //   – Sicherheit:  bis 80 % LTV ok, darüber Warnung
  //   – Cashflow:    bis 90 % LTV ok
  //   – Wachstum:    bis 100 % LTV ok (Volltilgung über Mieten)
  //   – Aggressiv:   105 %+ ok wenn Bewertung trägt (Beleihungs­auslauf
  //                  > 100 % bei Zukäufen ist gängige Praxis)
  // Score-Gewichte und Umhängen-Schwellen unverändert.
  var PROFILES = {
    sicherheit: {
      key: 'sicherheit',
      label: 'Sicherheit',
      desc: 'Stabile Einnahmen, niedrige LTVs, langfristig halten.',
      ltv_max:           0.80,    // V128: war 0.70 — realistisch für sicheren Investor
      ltv_target:        0.65,    // V128: war 0.60 — Tilgungsziel 65%
      cashflow_weight:   0.5,
      growth_weight:     0.1,
      tax_weight:        0.3,
      complexity_penalty:0.6,
      umhaengen_min_npv_gain: 50000
    },
    cashflow: {
      key: 'cashflow',
      label: 'Cashflow',
      desc: 'Maximaler monatlicher Ertrag nach Steuer.',
      ltv_max:           0.90,    // V128: war 0.85 — gängige Banken-Obergrenze
      ltv_target:        0.80,    // V128: war 0.75
      cashflow_weight:   0.6,
      growth_weight:     0.1,
      tax_weight:        0.3,
      complexity_penalty:0.4,
      umhaengen_min_npv_gain: 30000
    },
    wachstum: {
      key: 'wachstum',
      label: 'Wachstum',
      desc: 'Steueroptimierung & Reinvestition für mittelfristigen Aufbau.',
      ltv_max:           1.00,    // V128: war 0.95 — Volltilgung über Mieten möglich
      ltv_target:        0.90,    // V128: war 0.80
      cashflow_weight:   0.2,
      growth_weight:     0.5,
      tax_weight:        0.3,
      complexity_penalty:0.2,
      umhaengen_min_npv_gain: 15000
    },
    aggressiv: {
      key: 'aggressiv',
      label: 'Aufbau aggressiv',
      desc: 'Hohe LTVs, EK-Freisetzung, schnelle Skalierung über GmbH.',
      ltv_max:           1.10,    // V128: war 1.05 — 110% Beleihungs­auslauf bei guter Bonität
      ltv_target:        0.95,    // V128: war 0.90
      cashflow_weight:   0.1,
      growth_weight:     0.6,
      tax_weight:        0.3,
      complexity_penalty:0.0,
      umhaengen_min_npv_gain: 5000
    }
  };

  // ── V135: ANLAGE-ZIELE ──────────────────────────────────────────
  // Definiert WOHIN die Strategie führt (während PROFILES das WIE definiert).
  var ZIELE = {
    altersvorsorge: {
      key: 'altersvorsorge',
      label: 'Altersvorsorge',
      kurz: 'Bis Renteneintritt entschuldetes Portfolio',
      beschreibung: 'Ziel ist eine planbare passive Einkommensquelle ab Renteneintritt. Strategien priorisieren Tilgung, RND-Optimierung, langfristige Halte\u00ADdauern.',
      ltv_target_anpassung: -0.10,
      cashflow_priorisierung: 'mittel',
      empfehlungs_tags: ['entschuldung', 'rnd', 'sondertilgung', '23_estg_warten'],
      typ_praeferenz: 'mfh_oder_etw_groesser'
    },
    langfristig_halten: {
      key: 'langfristig_halten',
      label: 'Langfristig halten',
      kurz: 'Buy-and-Hold, kein Verkaufen geplant',
      beschreibung: 'Bestand wird \u00FCber 20+ Jahre gehalten. Fokus auf laufende Optimierung, Erbschafts-Planung, Energie-Sanierung als Werterhalt.',
      ltv_target_anpassung: -0.05,
      cashflow_priorisierung: 'mittel',
      empfehlungs_tags: ['erbschaft', 'energetisch', 'mietkonvergenz'],
      typ_praeferenz: 'mfh'
    },
    wachstum: {
      key: 'wachstum',
      label: 'Wachstum / Skalierung',
      kurz: 'Bestand vergr\u00F6\u00DFern, EK-Hebel maximieren',
      beschreibung: 'Bestand soll \u00FCber 5-10 Jahre auf das 2-3fache wachsen. EK rotiert \u00FCber Beleihungs-Reserve und Roll-EK. GmbH-Aufbau wird priorisiert.',
      ltv_target_anpassung: 0.05,
      cashflow_priorisierung: 'niedrig',
      empfehlungs_tags: ['gmbh', 'wachstum_ltv', 'wachstumskorridor', 'rollierendes_ek'],
      typ_praeferenz: 'gemischt'
    },
    cashflow_jetzt: {
      key: 'cashflow_jetzt',
      label: 'Cashflow jetzt',
      kurz: 'Maximaler laufender monatlicher \u00DCberschuss',
      beschreibung: 'Lebensunterhalt soll teilweise oder vollst\u00E4ndig aus den Mieten bestritten werden. Hohe Cashflow-Faktoren, niedrige Tilgung, stabile Lagen.',
      ltv_target_anpassung: 0.0,
      cashflow_priorisierung: 'hoch',
      empfehlungs_tags: ['mietkonvergenz', 'hotspot', 'kp_faktor'],
      typ_praeferenz: 'mfh'
    },
    vermoegen_aufbauen: {
      key: 'vermoegen_aufbauen',
      label: 'Verm\u00F6gen aufbauen',
      kurz: 'Wertsteigerung prim\u00E4r, Cashflow Bonus',
      beschreibung: 'Ziel ist Wert-Verm\u00F6gensaufbau \u00FCber 10-20 Jahre. Wachstums-Hotspots, Faktor-Arbitrage, energetische Aufwertung.',
      ltv_target_anpassung: 0.05,
      cashflow_priorisierung: 'niedrig',
      empfehlungs_tags: ['wachstumskorridor', 'faktor_arbitrage', 'energetisch'],
      typ_praeferenz: 'gemischt'
    },
    erbschaft: {
      key: 'erbschaft',
      label: 'Erbschafts-Planung',
      kurz: '\u00DCbertragung an die n\u00E4chste Generation',
      beschreibung: 'Verm\u00F6gen soll in den n\u00E4chsten 10-20 Jahren steuer\u00ADschonend \u00FCbertragen werden. Holding mit \u00A713a/\u00A713b ErbStG-Verschonung.',
      ltv_target_anpassung: -0.05,
      cashflow_priorisierung: 'mittel',
      empfehlungs_tags: ['gmbh', 'holding', 'erbschaft', 'schenkung_gestaffelt'],
      typ_praeferenz: 'mfh'
    }
  };

  // ── V135: OBJEKT-TYP-PR\u00C4FERENZ-LABELS ────────────────────
  var OBJEKT_TYP_LABELS = {
    'etw':       'Eigentumswohnungen (ETW)',
    'mfh':       'Mehrfamilienh\u00E4user (MFH)',
    'wgh':       'Wohn-/Gesch\u00E4ftsh\u00E4user',
    'gemischt':  'Gemischte Strategie',
    'egal':      'Egal \u2014 Hauptsache passt'
  };

  // ── STATE ───────────────────────────────────────────────────────
  // V129: Eingaben sind jetzt klar getrennt nach
  //   IST-ZUSTAND   (was du HEUTE hast)
  //   ZIEL          (was du erreichen willst)
  //   ANNAHMEN      (Markt-Erwartungen, ausklappbar)
  var _state = {
    objects: [],
    config:  Object.assign({}, DEFAULTS),
    inputs: {
      // ─── IST-ZUSTAND ─────────────────────────────────────────────
      base_income_zve:     60000,    // zvE aus Lohn/Selbstständigkeit
      free_ek:             50000,    // verfügbares freies EK heute
      notgroschen:         10000,    // Reserve, NICHT zum Investieren (V129: neu)
      married:             false,
      church_tax:          false,
      bundesland:          'NW',
      // V129: Ist-GmbH-Struktur (was hast du SCHON?)
      hat_struktur:        'keine',  // 'keine' | 'vv_gmbh' | 'holding_vv' | 'konzern'
      anzahl_bestand_vvgmbhs: 0,    // wie viele VV-GmbHs hast du heute?

      // ─── ZIEL ────────────────────────────────────────────────────
      profile:             'cashflow', // Sicherheit / Cashflow / Wachstum / Aggressiv
      ek_invest_bereit:    100000,   // wie viel willst/kannst du investieren?
      target_new_objects:  0,        // geplante Zukäufe (optional)

      // ─── V135: Anlage-Ziel ─────────────────────────────────────
      // Gibt der Beratung eine Richtung. UI rendert das als Auswahl-Block.
      // Mögliche Werte:
      //   'altersvorsorge'    – entschuldetes Portfolio bis Renteneintritt
      //   'langfristig_halten' – Buy-and-Hold, kein Verkaufen geplant
      //   'wachstum'          – Bestand vergrößern (Skalierung)
      //   'cashflow_jetzt'    – maximaler laufender Überschuss
      //   'vermoegen_aufbauen' – primär Wertsteigerung, Cashflow Bonus
      //   'erbschaft'         – nächste Generation übergeben
      ziel:                'wachstum',
      ziel_horizon_jahre:  15,        // wann soll das Ziel erreicht sein?

      // ─── V136: Zukauf-Plan (klar getrennt) ──────────────────
      // V135 hatte ein zweideutiges 'zielenheiten_pa'. V136 trennt:
      //   praeferenz_typ:      welche Art Objekt
      //   ziel_objekte_pa:     wie viele Objekte (Häuser/ETW) pro Jahr
      //   ziel_einheiten_pa:   wie viele Wohneinheiten gesamt pro Jahr
      //                        (bei MFH: Objekte × WE_pro_Objekt)
      //   we_pro_objekt:       Default-Annahme bei MFH-Käufen (4-8 typisch)
      praeferenz_typ:      'egal',   // 'etw' | 'mfh' | 'wgh' | 'gemischt' | 'egal'
      ziel_objekte_pa:     1,         // Anzahl ZUKAUF-OBJEKTE pro Jahr
      we_pro_objekt:       1,         // Wohneinheiten pro Objekt (1=ETW, 4-8 MFH)
      kp_min_geplant:      150000,   // Untergrenze KP-Korridor pro Objekt
      kp_max_geplant:      500000,   // Obergrenze KP-Korridor pro Objekt

      // V135-Kompat: 'zielenheiten_pa' wird im _calcZukaufPlan automatisch
      // aus ziel_objekte_pa * we_pro_objekt abgeleitet
      zielenheiten_pa:     1,        // DEPRECATED, ersetzt durch ziel_objekte_pa

      // ─── V135: Sparquote ─────────────────────────────────────
      // Anteil des Netto-Einkommens, der monatlich ins Portfolio fließt
      // (auch ohne aktiven Zukauf — wird zur EK-Aufbau-Empfehlung)
      sparquote_pct:       15,       // Default 15 %

      // ─── ANNAHMEN (Markt) — ausklappbar in der UI ───────────────
      growth_rent_pa:      0.015,
      growth_value_pa:     0.02,
      // V135: Marktzins-Anker (für Zukauf-Szenarien) — Stand 05/2026
      // Quellen: Interhyp, Dr. Klein, baufi24 — 10-J-Sollzins 3,5-4 %
      marktzins_pct:       3.9,
      marktzins_stand:     '05/2026',

      // ─── V137: NEUE FELDER ─────────────────────────────────
      // Objekt-Auswahl (welche Objekte werden in die Strategie einbezogen)
      // Default null = alle Objekte. Wenn gesetzt, Array von Objekt-IDs.
      ausgewaehlte_objekte: null,

      // Nachbeleihung: Wert zwischen 75-85 % je nach Bank-Praxis
      // Default Bank-Limit: Beleihungswert (90 % vom VW) × 80 % = 72 % vom VW
      // Aber: viele Banken sind strenger, oft 75-80 % vom Beleihungswert
      // V137: User kann Beleihungs-Auslauf-Limit selbst setzen (Standard 80 %)
      beleihungs_auslauf_pct: 80,    // 80 % des Beleihungswerts (= 72 % vom VW)
      beleihungswert_abschlag_pct: 10, // 10 % Abschlag vom Verkehrswert (Standard)

      // Verkauf an eigene GmbH (verdeckte Einlage / 7-%-Methode)
      // Default 7 % vom Verkehrswert (über BFH-Mindestschwelle 4-5 %)
      gmbh_verkauf_pct: 7,           // % vom Verkehrswert als KP (typisch 6-15 %)
      gmbh_verkauf_aktiv: false,     // Strategie aktivieren?

      // ─── V138: NEUE FELDER ─────────────────────────────────
      // Eigenheimschaukel
      hat_familienheim: false,        // gibt es ein selbstgenutztes Familienheim?
      familienheim_wert: 0,           // Verkehrswert des Familienheims
      familienheim_partner: false,    // Ehe / eingetragene Lebenspartnerschaft?
      // Kaufpreis-Aufteilung
      kp_aufteilung_geb_pct: 75,      // Standard 75 % Gebäude-Anteil
      kp_aufteilung_geb_pct_optimiert: 85,  // realistisches Optimum
      // Familienstiftung-Erwägung
      stiftung_erwaegung: false,      // soll Familienstiftung in Strategie aufgenommen werden?
      // Share Deal / 7-Jahres-Regel
      gmbh_holding_aktiv: false,      // Holding-Struktur bereits oder geplant?
      verkaufs_horizont_jahre: 0      // 0 = nicht geplant, sonst Horizont in Jahren
      // op_san_volumen_y, anzahl_vvgmbhs (geplant), mit_opgmbh: in V129
      // entfernt — werden aus IST + ZIEL automatisch abgeleitet
    },
    results: null
  };

  // ── DATEN-AGGREGATION ───────────────────────────────────────────
  /**
   * Nimmt ein Roh-Objekt (wie aus localStorage / getAllObjectsData)
   * und berechnet einheitliche Kennzahlen pro Objekt.
   * Verwendet exakt die gleichen Felder wie all-objects.js.
   *
   * V126: Zusätzlich
   *   – baujahr, objektTyp → RND-Heuristik
   *   – kaufdatum / kaufjahr → §23-Spekulationsfrist
   *   – sanierungsstand (1-5 Skala) → Sanierungs-Hebel-Empfehlung
   *   – verkehrswert (optional) → LTV-Refi-Empfehlung
   *   – RND via DealPilotRND.calcAll() falls Modul geladen
   *   – Gutachten-Empfehlung via DealPilotRND.calcAfaVergleich()
   */
  function _aggregateObject(obj) {
    var d = obj.data || obj;
    function n(k) { return parseFloat(d[k]) || 0; }
    function s(k) { return d[k] || ''; }

    var kp        = n('kp');
    var san       = n('san');
    var moebl     = n('moebl');
    var nkm_m     = n('nkm') + n('ze');           // Kaltmiete + Zuschläge / Monat
    var nkm_y     = nkm_m * 12;
    var nk_pct    = n('makler_p') + n('notar_p') + n('gba_p') + n('gest_p') + n('ji_p');
    var nebenk    = kp * nk_pct / 100;
    var gi        = kp + nebenk + san + moebl;     // Gesamtinvestition

    var d1        = n('d1') || n('darlehen_1') || n('darlehen1_summe') || n('hauptdarlehen');
    var d2        = n('d2') || n('darlehen_2') || n('darlehen2_summe') || n('zusatzdarlehen');
    // V143: Tilgungsaussetzungsdarlehen + Bausparer separate Position
    var d3        = n('d3') || n('tilgungsaussetzung') || n('bausparer_summe') || n('ta_darlehen');
    var d_total   = d1 + d2 + d3;
    var d1z       = n('d1z') / 100;                // Zins p.a. als Dezimal
    var d2z       = n('d2z') / 100;
    var d1t       = n('d1t') / 100;                // Tilgung p.a. als Dezimal
    var d2t       = n('d2t') / 100;

    var zins_y    = d1 * d1z + d2 * d2z;
    var tilg_y    = d1 * d1t + d2 * d2t;

    var ek        = gi - d_total;
    var ltv       = gi > 0 ? d_total / gi : 0;

    var bwk_pct   = n('bwk');                      // %
    var bwk_y     = nkm_y * bwk_pct / 100;
    var instand_y = n('instand_y') || (gi * 0.005); // 0,5% p.a. Default

    // AfA — gleicher Mechanismus wie calc.js:
    var afa_satz_pct = n('afa_satz') || 2;
    var geb_ant      = n('geb_ant') || 80;         // %, Default 80%
    var geb_anteil_eur = (kp + nebenk) * geb_ant / 100;
    var afa_y        = geb_anteil_eur * afa_satz_pct / 100;

    // Cashflow vor Steuer (vereinfacht, jährlich)
    var cf_op_y    = nkm_y - bwk_y - instand_y;            // operativ
    var cf_vor_y   = cf_op_y - zins_y - tilg_y;            // vor Steuer
    var vuv_y      = nkm_y - bwk_y - instand_y - zins_y - afa_y; // V+V-Überschuss

    // Bruttomietrendite & DSCR
    var bmy        = kp > 0 ? nkm_y / kp : 0;
    var debt_serv  = zins_y + tilg_y;
    var dscr       = debt_serv > 0 ? cf_op_y / debt_serv : 0;

    // V126: RND, Hold-Period, Sanierungsstand
    var baujahr    = parseInt(d.baujahr || d.bj, 10) || 0;
    var heute      = new Date().getFullYear();
    var alter      = baujahr > 0 ? heute - baujahr : 0;
    var kaufjahr   = _parseKaufjahr(d.kaufdatum || d.kauf_datum || d.kaufj);
    var halte_dauer= kaufjahr > 0 ? heute - kaufjahr : 0;
    var spekfrist_rest = kaufjahr > 0 ? Math.max(0, 10 - halte_dauer) : null;

    // Sanierungsstand: 1=neu/saniert, 5=stark sanierungsbedürftig
    // V128: realistischere Heuristik. Ein nicht-saniertes Haus aus
    // 1998 (28 J alt) ist meist Sanstand 4-5, nicht 3. Sanierung-Quote
    // bleibt der stärkste Indikator, danach Alter.
    var sanstand = parseInt(d.sanstand || d.sanierungsstand, 10);
    if (!sanstand || sanstand < 1 || sanstand > 5) {
      var san_quote = kp > 0 ? san / kp : 0;
      if (san_quote > 0.10) sanstand = 1;       // stark saniert (>10% des KP investiert)
      else if (san_quote > 0.05) sanstand = 2;  // teilsaniert
      else if (alter < 10) sanstand = 2;        // V128: <10 J neu = gepflegt
      else if (alter < 25) sanstand = 3;        // V128: 10-25 J = mittel
      else if (alter < 40) sanstand = 4;        // V128: 25-40 J = bedürftig (war 50)
      else sanstand = 5;                        // V128: >40 J = unsaniert (war >50)
    }

    // RND berechnen, wenn DealPilotRND-Modul vorhanden + Baujahr da
    // V128: Wir berechnen ZWEI RND-Varianten:
    //   1. nach aktuell angegebenem Sanstand (best estimate)
    //   2. "Worst-Case veraltet" (alle Gewerke veraltet) — zeigt das
    //      Maximum-RND-Potenzial bei einem Gutachten an
    // Das Diehl-Beispiel (Bj 1998, Gutachter: alle veraltet) ergibt 21J statt 47J.
    var rnd = null, rndGutachten = null, rndPotenzial = null;
    if (typeof DealPilotRND !== 'undefined' && DealPilotRND.calcAll && baujahr > 0) {
      try {
        var typ_id = (typeof DealPilotRND_GND !== 'undefined' && DealPilotRND_GND.suggestFromObjectType)
          ? DealPilotRND_GND.suggestFromObjectType(d.objektTyp || d.typ || 'mfh')
          : 'mfh';
        var gnd_default = (typeof DealPilotRND_GND !== 'undefined' && DealPilotRND_GND.getDefault)
          ? DealPilotRND_GND.getDefault(typ_id) : 70;

        // (1) Standard-Berechnung nach aktuellem Sanstand
        var gewerke = _gewerkeFromSanstand(sanstand);
        var rndRes = DealPilotRND.calcAll({
          baujahr: baujahr,
          stichtag: heute + '-01-01',
          gnd: gnd_default,
          modPoints: sanstand <= 2 ? 6 : (sanstand === 3 ? 3 : 0),
          gewerkeBewertung: gewerke
        });
        rnd = {
          alter: rndRes.input.alter,
          gnd: rndRes.input.gnd,
          rnd_jahre: rndRes.final_rnd,
          rnd_satz: rndRes.final_rnd > 0 ? 100 / rndRes.final_rnd : 0,
          source: rndRes.final_source,
          methods: rndRes.methods
        };

        // (2) Worst-Case: alle Gewerke veraltet — zeigt RND-Potenzial
        // Nur sinnvoll wenn aktueller Sanstand nicht schon "alle veraltet" ist.
        if (sanstand < 5 && alter >= 15) {
          var rndWorst = DealPilotRND.calcAll({
            baujahr: baujahr,
            stichtag: heute + '-01-01',
            gnd: gnd_default,
            modPoints: 0,
            gewerkeBewertung: _gewerkeFromSanstand(5)
          });
          rndPotenzial = {
            rnd_jahre: rndWorst.final_rnd,
            rnd_satz: rndWorst.final_rnd > 0 ? 100 / rndWorst.final_rnd : 0,
            differenz_zu_aktuell: rndRes.final_rnd - rndWorst.final_rnd
          };
        }

        // Gutachten-Empfehlung: nutze die kürzere RND als Basis
        // (Gutachter macht idR Vor-Ort-Inspektion und kann "veraltet" begründen)
        var rnd_fuer_gutachten = rndPotenzial ? Math.min(rnd.rnd_jahre, rndPotenzial.rnd_jahre) : rnd.rnd_jahre;
        if (DealPilotRND.calcAfaVergleich && geb_anteil_eur > 0 && rnd_fuer_gutachten > 0 && rnd_fuer_gutachten < 45) {
          var grenz = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
            ? Tax.calcGrenzsteuersatz(_state.inputs.base_income_zve + Math.max(0, vuv_y))
            : 0.42;
          rndGutachten = DealPilotRND.calcAfaVergleich({
            gebaeudeanteil: geb_anteil_eur,
            rnd: rnd_fuer_gutachten,
            grenzsteuersatz: grenz,
            standardAfaSatz: afa_satz_pct / 100,
            gutachterkosten: _state.config.rnd_gutachten_kosten,
            abzinsung: _state.config.discount_rate
          });
          // V137: Amortisationsdauer und Steigerungs-Prozentsatz hinzufügen
          if (rndGutachten && rndGutachten.valid && rndGutachten.steuerersparnis_jahr > 0) {
            rndGutachten.amortisation_jahre = rndGutachten.gutachterkosten / rndGutachten.steuerersparnis_jahr;
            // AfA-Steigerung in Prozent: (neu / alt) - 1
            if (rndGutachten.afa_standard && rndGutachten.afa_standard.satz_pct > 0) {
              rndGutachten.afa_steigerung_pct = ((rndGutachten.afa_kurz.satz_pct / rndGutachten.afa_standard.satz_pct) - 1) * 100;
            } else {
              rndGutachten.afa_steigerung_pct = 0;
            }
          }
        }
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('RND failed for', d.kuerzel, e);
      }
    }

    // V143/144: Verkehrswert für LTV-Refi-Strategien — mehrere Feld-Namen prüfen
    // Reihenfolge nach Vertrauenswürdigkeit: explizite ImmoWertV > Sachverständig > Marktdaten > Kaufpreis
    var verkehrswert = n('verkehrswert')          // V137-Standard (Hauptfeld)
                     || n('marktwert')             // alternative Bezeichnung
                     || n('bankbewertung')         // V144: Bank-Bewertung Eingabe (typisch bei DealPilot)
                     || n('bank_bewertung')        // alternativ
                     || n('vw_immowertv')          // ImmoWertV-Berechnung
                     || n('immowertv_wert')        // alternative ImmoWertV
                     || n('vw_sv')                 // Sachverständigen-Gutachten
                     || n('sv_verkehrswert')       // alternative SV
                     || n('immo_bewertung_bank')   // Bank-Bewertung (aus Excel)
                     || n('vw_immoscout')          // Immoscout
                     || n('vw_pricehubble')        // PriceHubble
                     || n('vw_ph')                 // alternativ
                     || (kp * Math.pow(1.02, halte_dauer)); // Fallback: 2% p.a.

    // V137: Beleihungs-Reserve mit konfigurierbaren Inputs
    // Beleihungswert = Verkehrswert × (1 − Abschlag). Standard 10 % Abschlag → 90 %.
    // Bank-Limit = Beleihungswert × Auslauf. Standard 80 %.
    // Effektive Beleihung = VW × 0,90 × 0,80 = 72 % vom VW
    // User kann beides via Inputs anpassen (15-25 % Abschlag, 75-85 % Auslauf)
    var abschlag = ((_state.inputs.beleihungswert_abschlag_pct != null)
      ? _state.inputs.beleihungswert_abschlag_pct : 10) / 100;
    var auslauf = ((_state.inputs.beleihungs_auslauf_pct != null)
      ? _state.inputs.beleihungs_auslauf_pct : 80) / 100;
    var beleihungswert = verkehrswert * (1 - abschlag);
    var bank_max = beleihungswert * auslauf;
    var beleihungs_reserve = Math.max(0, bank_max - d_total);

    // V128: Wohnfläche + Markt-Miete für Mietsteigerungs-Hebel
    var wfl = n('wfl');
    var marktmiete_qm = n('ds2_marktmiete') || n('marktmiete_qm') || n('marktmiete');
    var marktmiete_y = (wfl > 0 && marktmiete_qm > 0) ? marktmiete_qm * wfl * 12 : 0;
    var ist_miete_qm = (wfl > 0 && nkm_y > 0) ? (nkm_y / 12) / wfl : 0;
    var miete_luecke_y = marktmiete_y > 0 ? Math.max(0, marktmiete_y - nkm_y) : 0;

    // V127: Anschaffungsnahe Aufwendungen (§6 Abs.1 Nr.1a EStG)
    // Innerhalb der ersten 3 Jahre nach Anschaffung dürfen
    // Sanierungskosten 15% des Gebäude-AHK nicht überschreiten —
    // sonst werden sie zu Anschaffungs­kosten umqualifiziert (kein
    // Sofortabzug, nur AfA).
    var an15_grenze = geb_anteil_eur * (_state.config.anschaffungsnah_grenze_pct / 100);
    var an15_verbraucht = san;  // bisheriger Sanierungs­aufwand zählt mit
    var an15_rest = Math.max(0, an15_grenze - an15_verbraucht);
    var an15_aktiv = (kaufjahr > 0 && halte_dauer < _state.config.anschaffungsnah_jahre);

    return {
      id:        obj.id || obj._id || (d.kuerzel || '?'),
      kuerzel:   d.kuerzel || '–',
      adresse:   ((s('str')) + ' ' + s('hnr')).trim() + (s('ort') ? ', ' + s('ort') : ''),
      kp:        kp,
      nebenk:    nebenk,
      san:       san,
      moebl:     moebl,
      gi:        gi,
      ek:        ek,
      d_total:   d_total,
      ltv:       ltv,
      verkehrswert: verkehrswert,
      ltv_aktuell: verkehrswert > 0 ? d_total / verkehrswert : ltv,
      beleihungs_reserve: beleihungs_reserve,
      nkm_y:     nkm_y,
      bwk_y:     bwk_y,
      instand_y: instand_y,
      zins_y:    zins_y,
      tilg_y:    tilg_y,
      afa_y:     afa_y,
      geb_anteil_eur: geb_anteil_eur,
      afa_satz_pct: afa_satz_pct,
      cf_op_y:   cf_op_y,
      cf_vor_y:  cf_vor_y,
      vuv_y:     vuv_y,
      bmy:       bmy,
      dscr:      dscr,
      // V126
      baujahr:   baujahr,
      alter:     alter,
      kaufjahr:  kaufjahr,
      halte_dauer:halte_dauer,
      spekfrist_rest: spekfrist_rest,
      sanstand:  sanstand,
      rnd:       rnd,
      rndPotenzial: rndPotenzial,
      rndGutachten: rndGutachten,
      // V127
      an15_grenze: an15_grenze,
      an15_rest:   an15_rest,
      an15_aktiv:  an15_aktiv,
      // V128
      wfl:           wfl,
      marktmiete_qm: marktmiete_qm,
      marktmiete_y:  marktmiete_y,
      ist_miete_qm:  ist_miete_qm,
      miete_luecke_y: miete_luecke_y,
      // V131: Lage + Markt aus Objekt-Eingaben (DealScore2-Inputs)
      mikrolage:           s('mikrolage') || s('ds2_mikrolage') || null,
      makrolage:           s('makrolage') || null,
      bevoelkerung:        s('ds2_bevoelkerung') || null,    // 'stark_wachsend'..'stark_fallend'
      nachfrage:           s('ds2_nachfrage') || null,       // 'sehr_stark'..'sehr_schwach'
      wertsteigerung:      s('ds2_wertsteigerung') || null,
      entwicklungs_moegl:  s('ds2_entwicklung') || null,
      energieklasse:       s('ds2_energie') || null,         // 'A+'..'H'
      mietausfall_risiko:  s('ds2_mietausfall') || null,
      ds2_zustand:         s('ds2_zustand') || null,
      kaufpreisniveau:     s('kaufpreisniveau') || null,     // niedrig/mittel/hoch
      mietspiegel_qm:      n('mietspiegel_eur_qm') || marktmiete_qm,
      _raw:      d
    };
  }

  function _parseKaufjahr(v) {
    if (!v) return 0;
    var s = String(v);
    // ISO date "2018-04-12" oder "2018"
    var m = s.match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : 0;
  }

  // Mappt Sanierungsstand 1..5 auf Gewerke-Bewertung für RND-Modul.
  // 1 = saniert/neu  →  alle "gehoben"
  // 3 = mittel       →  alle "standard"
  // 5 = unsaniert    →  alle "veraltet"
  function _gewerkeFromSanstand(stand) {
    // V143: Konservativere Defaults — selbst bei alten unsanierten Objekten
    // sind selten ALLE Gewerke "veraltet". Realistisches Mischverhalten:
    //   1-2  → gehoben      (gut saniert)
    //   3    → standard     (Mix Standard)
    //   4    → veraltet für tragende+Elektrik, standard für Rest  (teilsaniert)
    //   5    → veraltet für alles außer Substanz                  (unsaniert)
    if (stand <= 2) {
      var bew = 'gehoben';
      return {
        dach: bew, fenster: bew, leitungen: bew, heizung: bew,
        aussenwand: bew, baeder: bew, decken: bew, technik: bew, grundriss: bew
      };
    }
    if (stand === 3) {
      var bew = 'standard';
      return {
        dach: bew, fenster: bew, leitungen: bew, heizung: bew,
        aussenwand: bew, baeder: bew, decken: bew, technik: bew, grundriss: bew
      };
    }
    if (stand === 4) {
      // Mix: typische "bedürftige" Bestandsobjekte
      return {
        dach: 'standard', fenster: 'veraltet', leitungen: 'veraltet',
        heizung: 'veraltet', aussenwand: 'standard', baeder: 'veraltet',
        decken: 'standard', technik: 'veraltet', grundriss: 'standard'
      };
    }
    // stand 5 — unsaniert, aber tragende Substanz/Decken/Grundriss meist OK
    return {
      dach: 'veraltet', fenster: 'veraltet', leitungen: 'veraltet',
      heizung: 'veraltet', aussenwand: 'veraltet', baeder: 'veraltet',
      decken: 'standard', technik: 'veraltet', grundriss: 'standard'
    };
  }

  // ── PORTFOLIO-AGGREGAT ──────────────────────────────────────────
  function _aggregatePortfolio(rows) {
    var sum = function(k) { return rows.reduce(function(s, r) { return s + (r[k] || 0); }, 0); };
    var p = {
      count:    rows.length,
      kp:       sum('kp'),
      gi:       sum('gi'),
      ek:       sum('ek'),
      d_total:  sum('d_total'),
      verkehrswert: sum('verkehrswert'),
      beleihungs_reserve: sum('beleihungs_reserve'),
      nkm_y:    sum('nkm_y'),
      bwk_y:    sum('bwk_y'),
      instand_y:sum('instand_y'),
      zins_y:   sum('zins_y'),
      tilg_y:   sum('tilg_y'),
      afa_y:    sum('afa_y'),
      geb_anteil_eur: sum('geb_anteil_eur'),
      cf_op_y:  sum('cf_op_y'),
      cf_vor_y: sum('cf_vor_y'),
      vuv_y:    sum('vuv_y')
    };
    p.ltv = p.gi > 0 ? p.d_total / p.gi : 0;
    p.ltv_aktuell = p.verkehrswert > 0 ? p.d_total / p.verkehrswert : p.ltv;
    p.bmy = p.kp > 0 ? p.nkm_y / p.kp : 0;
    p.dscr = (p.zins_y + p.tilg_y) > 0 ? p.cf_op_y / (p.zins_y + p.tilg_y) : 0;
    return p;
  }

  // ── PRO-OBJEKT-VERDIKTE (V126) ──────────────────────────────────
  /**
   * Liefert pro Objekt eine Liste von konkreten Empfehlungen,
   * gewichtet nach aktivem Investorprofil. Mögliche Verdikte:
   *
   *   – RND_GUTACHTEN_LOHNT     → kürzere AfA via Gutachten
   *   – PRIVAT_HALTEN           → in Privatvermögen lassen (z.B. wegen §23-Frist)
   *   – UMHAENGEN_VVGMBH        → Einbringung in VV-GmbH wirtschaftlich
   *   – UMHAENGEN_NACH_SPEKFRIST→ Erst nach Ablauf der 10-J-Frist umhängen
   *   – SANIEREN_WERBUNGSKOSTEN → Sanierung erzeugt hohe WK → ESt-Erstattung
   *   – LOHNSTEUER_ERMAESSIGUNG → bei großen Verlusten LStER-Antrag stellen
   *   – LTV_REFI_FREISETZEN     → Aufgewertetes EK aus Beleihung holen
   *   – LTV_ZU_HOCH             → Risiko reduzieren (Sondertilgung)
   *   – EIGENNUTZUNG_3J         → §23 Abs.1 Nr.1 S.3 EStG: kurz selbst bewohnen → Verkauf steuerfrei
   *   – HALTEN_WEGEN_AFA        → noch nicht voll abgeschrieben, weiter privat
   *
   * Jedes Verdikt: { code, severity: 'info'|'opportunity'|'warning',
   *                  label, detail, impact_eur (geschätzt) }
   */
  function _verdictsForObject(row, profile) {
    var v = [];
    var inp = _state.inputs;
    var p = profile || PROFILES[inp.profile] || PROFILES.cashflow;

    // ── 1. RND-Gutachten lohnt sich? ──────────────────────────
    // V128: Neue Logik — auch bei moderater Standard-Heuristik
    // ein Verdikt aussprechen, wenn das "Worst-Case-RND" deutlich
    // kürzer ist (typischer Fall: Sanstand-Heuristik unterschätzt
    // den realen Bauzustand). Das Diehl-Beispiel: Heuristik 47J →
    // tatsächlich 21J nach Vor-Ort-Inspektion.
    var rndPot = row.rndPotenzial;
    var hat_rnd_potenzial = rndPot && rndPot.differenz_zu_aktuell > 8 && rndPot.rnd_jahre > 0;

    if (row.rnd && row.rnd.rnd_jahre <= 2 && row.kp > 0) {
      // Mathematisch "abgewohntes" Gebäude
      v.push({
        code: 'RND_GUTACHTEN_DRINGEND',
        severity: 'opportunity',
        label: 'RND-Gutachten dringend prüfen',
        detail: 'Das Gebäude ist nach linearer AWM rechnerisch komplett abgewohnt (' + (row.rnd.rnd_jahre || 0) + ' J. RND). Ein qualifiziertes Gutachten kann eine deutlich höhere AfA-Quote rechtfertigen — bei einem Gebäudeanteil von ' + Math.round(row.geb_anteil_eur).toLocaleString('de-DE') + ' € entspricht jeder zusätzliche Prozent AfA-Satz ~' + Math.round(row.geb_anteil_eur * 0.01).toLocaleString('de-DE') + ' € mehr Werbungskosten p.a.',
        impact_eur: row.geb_anteil_eur * 0.02 * 0.42 * 10
      });
    } else if (row.rndGutachten && row.rndGutachten.valid && row.rndGutachten.ampel === 'gruen'
               && row.rndGutachten.afa_kurz && row.rndGutachten.afa_kurz.satz_pct > 2.0) {
      // V130: Nur empfehlen, wenn der NEUE AfA-Satz tatsächlich über
      // 2,0 % liegt (Standard für vermietete Wohngebäude). Andernfalls
      // ist das Gutachten kein Hebel — auch wenn der Netto-Vorteil
      // formal positiv wäre.
      var g = row.rndGutachten;
      var msg = 'Kürzere AfA-Restnutzungsdauer (' + g.afa_kurz.satz_pct + ' % statt ' + Math.round(100 / row.afa_satz_pct) + ' J. Standard) bringt ' + Math.round(g.steuerersparnis_jahr).toLocaleString('de-DE') + ' € Steuer­ersparnis pro Jahr. Netto-Vorteil über Restlaufzeit: ' + Math.round(g.netto_vorteil).toLocaleString('de-DE') + ' €.';
      if (hat_rnd_potenzial) {
        msg += ' Achtung: Sanstand-Heuristik schätzt RND auf ' + row.rnd.rnd_jahre + ' J. — bei Vor-Ort-Inspektion mit "alle Gewerke veraltet" wären es nur ' + rndPot.rnd_jahre + ' J. Differenz von ' + rndPot.differenz_zu_aktuell + ' J. = realistisches Gutachter-Potenzial.';
      }
      v.push({
        code: 'RND_GUTACHTEN_LOHNT',
        severity: 'opportunity',
        label: 'RND-Gutachten beauftragen',
        detail: msg,
        impact_eur: g.netto_vorteil,
        // V130: Wahrscheinlichkeits-Score (0..1) wie sicher der Vorschlag ist
        confidence: g.afa_kurz.satz_pct >= 4.0 ? 0.9 : (g.afa_kurz.satz_pct >= 3.0 ? 0.7 : 0.5),
        rnd_check: { afa_kurz_pct: g.afa_kurz.satz_pct, rnd_jahre: row.rnd ? row.rnd.rnd_jahre : null }
      });
    } else if (row.rndGutachten && row.rndGutachten.valid && row.rndGutachten.ampel === 'gelb' && p.tax_weight >= 0.3
               && row.rndGutachten.afa_kurz && row.rndGutachten.afa_kurz.satz_pct > 2.0) {
      // V130: Auch hier 2%-Filter
      v.push({
        code: 'RND_GUTACHTEN_PRUEFEN',
        severity: 'info',
        label: 'RND-Gutachten prüfen',
        detail: 'Grenzfall: AfA-Satz nach Gutachten ' + row.rndGutachten.afa_kurz.satz_pct + ' % (knapp über Standard 2 %). Netto-Vorteil ' + Math.round(row.rndGutachten.netto_vorteil).toLocaleString('de-DE') + ' €. Lohnt sich nur bei sicherer ROI-Erwartung.',
        impact_eur: row.rndGutachten.netto_vorteil,
        confidence: 0.4
      });
    } else if (hat_rnd_potenzial && row.geb_anteil_eur > 80000 && rndPot.rnd_satz > 2.0) {
      // V130: Auch hier nur, wenn der potenzielle Satz tatsächlich über 2%
      // liegt — sonst kein Hebel.
      var grenz_h = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
        ? Tax.calcGrenzsteuersatz(_state.inputs.base_income_zve) : 0.42;
      var pot_satz = rndPot.rnd_satz;
      var aktuell_satz = row.afa_satz_pct;
      var pot_ersparnis_y = row.geb_anteil_eur * (pot_satz - aktuell_satz) / 100 * grenz_h;
      v.push({
        code: 'RND_BAUZUSTAND_PRUEFEN',
        severity: 'info',
        label: 'Bauzustand prüfen — RND-Potenzial ungenutzt',
        detail: 'Bei einem Vor-Ort-Gutachten mit der Bewertung "alle Gewerke veraltet" wäre die RND ' + rndPot.rnd_jahre + ' J. statt heute angenommener ' + row.rnd.rnd_jahre + ' J. (= AfA-Satz ' + Math.round(pot_satz * 100) / 100 + ' % statt ' + aktuell_satz + ' %). Bei tatsächlich schlechtem Bauzustand: jährliche Steuer­ersparnis bis ~' + Math.round(pot_ersparnis_y).toLocaleString('de-DE') + ' €. Sanstand im Objekt manuell auf 5 setzen, falls zutreffend.',
        impact_eur: pot_ersparnis_y * 10,
        confidence: 0.5
      });
    }

    // ── 2. Spekulationsfrist-Strategie ────────────────────────
    if (row.spekfrist_rest != null && row.spekfrist_rest > 0 && row.spekfrist_rest <= 3) {
      v.push({
        code: 'PRIVAT_HALTEN_BIS_SPEKFRIST',
        severity: 'info',
        label: 'Privat halten — §23 EStG-Frist läuft in ' + row.spekfrist_rest + ' Jahr(en) ab',
        detail: 'Bei Verkauf nach Ablauf der 10-Jahres-Spekulationsfrist ist der Veräußerungsgewinn einkommensteuerfrei (§23 EStG). Vor Ablauf wird er voll mit dem persönlichen Steuersatz besteuert. Eine Einbringung in die VV-GmbH JETZT würde die Frist unterbrechen.',
        impact_eur: 0
      });
    }

    // ── 3. Eigennutzungs-Trick (3-Jahres-Ausnahme §23 EStG) ──
    if (row.spekfrist_rest != null && row.spekfrist_rest > 5 && p.tax_weight >= 0.3) {
      v.push({
        code: 'EIGENNUTZUNG_3J',
        severity: 'info',
        label: 'Eigennutzung als §23-Ausnahme prüfen',
        detail: '§23 Abs.1 Nr.1 S.3 EStG: Bei Eigennutzung im Verkaufsjahr und den beiden Vorjahren entfällt die Spekulationssteuer auch innerhalb der 10-J-Frist. Bei leerstehenden Objekten nach Erwerb relevant — Voraussetzungen sind streng (echter Lebensmittelpunkt, kein Schein-Bezug).',
        impact_eur: 0
      });
    }

    // ── 4. Umhängen in VV-GmbH (Pro-Objekt-Lohnt-sich-Check) ─
    var grenz_priv = 0.42;
    if (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz) {
      grenz_priv = Tax.calcGrenzsteuersatz(inp.base_income_zve + Math.max(0, row.vuv_y));
    }
    var st_priv_y = Math.max(0, row.vuv_y) * grenz_priv;
    var st_gmbh_y = Math.max(0, row.vuv_y) * 0.15825;  // erw. Kürzung
    var laufender_vorteil_y = st_priv_y - st_gmbh_y;
    var grest_einmal = row.kp * (_state.config.grest_satz_pct / 100);
    var notar_einmal = row.kp * (_state.config.notar_grundbuch_pct / 100);
    var amort_jahre = laufender_vorteil_y > 0 ? (grest_einmal + notar_einmal) / laufender_vorteil_y : 999;

    if (row.spekfrist_rest === 0 || row.spekfrist_rest == null) {
      // Spekfrist abgelaufen ODER unbekannt
      if (laufender_vorteil_y > 1500 && amort_jahre < 8) {
        v.push({
          code: 'UMHAENGEN_VVGMBH',
          severity: 'opportunity',
          label: 'In VV-GmbH einbringen',
          detail: 'Laufende Steuerersparnis ~' + Math.round(laufender_vorteil_y) + ' €/J. Einmalkosten (GrESt+Notar): ~' + Math.round(grest_einmal + notar_einmal) + ' €. Amortisation in ~' + amort_jahre.toFixed(1) + ' Jahren.',
          impact_eur: laufender_vorteil_y * 10 - (grest_einmal + notar_einmal)
        });
      } else if (laufender_vorteil_y < 500) {
        v.push({
          code: 'PRIVAT_HALTEN',
          severity: 'info',
          label: 'Privat halten — Umhängen lohnt nicht',
          detail: 'Steuerersparnis durch GmbH-Hülle (' + Math.round(laufender_vorteil_y) + ' €/J.) zu gering, um GrESt zu rechtfertigen.',
          impact_eur: 0
        });
      }
    } else if (row.spekfrist_rest > 0 && laufender_vorteil_y > 2000) {
      // Spekfrist noch nicht abgelaufen, aber Umhängen wäre wirtschaftlich
      v.push({
        code: 'UMHAENGEN_NACH_SPEKFRIST',
        severity: 'info',
        label: 'Umhängen erst nach §23-Frist (in ' + row.spekfrist_rest + ' J.)',
        detail: 'Einbringung jetzt löst Spekulationsgewinn-Besteuerung aus. Nach Ablauf der Frist steuerneutral übertragbar (Verkehrswert = Anschaffungskosten der GmbH).',
        impact_eur: laufender_vorteil_y * (10 - row.spekfrist_rest)
      });
    }

    // ── 5. Sanierungs-Hebel: Werbungskosten gezielt erzeugen ─
    if (row.sanstand >= 4 && row.vuv_y > -500 && p.tax_weight >= 0.3) {
      // Schlecht erhalten + aktuell wenig Verlust → Sanierung würde V+V negativ ziehen
      var san_vorschlag = Math.min(row.kp * 0.08, 25000);  // 8% des KP, max 25k
      var st_erspar = san_vorschlag * grenz_priv;
      v.push({
        code: 'SANIEREN_WERBUNGSKOSTEN',
        severity: 'opportunity',
        label: 'Erhaltungsaufwand gezielt einsetzen',
        detail: 'Sanierungs­bedarf hoch (Sanstand ' + row.sanstand + '/5). Erhaltungsaufwand bis ~' + Math.round(san_vorschlag).toLocaleString('de-DE') + ' € sofort als Werbungskosten abziehbar (oder §82b EStDV: 2-5 Jahre verteilen). Steuerersparnis bei aktuellem Grenzsteuersatz (' + Math.round(grenz_priv * 100) + '%): ~' + Math.round(st_erspar) + ' €.',
        impact_eur: st_erspar
      });
    }

    // ── 6. Lohnsteuerermäßigungs-Antrag bei großen Verlusten ─
    if (row.vuv_y < -3000 && inp.base_income_zve > 30000) {
      var monatl_liq = (-row.vuv_y * grenz_priv) / 12;
      v.push({
        code: 'LOHNSTEUER_ERMAESSIGUNG',
        severity: 'opportunity',
        label: 'Lohnsteuerermäßigungs-Antrag stellen',
        detail: 'Erwarteter V+V-Verlust ~' + Math.round(-row.vuv_y).toLocaleString('de-DE') + ' €/J. Über Freibetrag auf der Lohnsteuerkarte fließen ~' + Math.round(monatl_liq) + ' €/Monat zusätzliche Liquidität — nicht erst nach Veranlagung. Antrag beim Finanzamt vor Jahresanfang.',
        impact_eur: -row.vuv_y * grenz_priv
      });
    }

    // ── 7. LTV-Refi: EK aus aufgewertetem Bestand freisetzen ──
    if (row.verkehrswert > row.kp * 1.15 && row.ltv_aktuell < p.ltv_target && p.growth_weight >= 0.4) {
      var beleihbar = row.verkehrswert * p.ltv_target - row.d_total;
      if (beleihbar > 20000) {
        v.push({
          code: 'LTV_REFI_FREISETZEN',
          severity: 'opportunity',
          label: 'Eigenkapital durch Aufstockung freisetzen',
          detail: 'Verkehrswert (' + Math.round(row.verkehrswert).toLocaleString('de-DE') + ' €) ist deutlich über KP. Bei Aufstockung auf ' + Math.round(p.ltv_target * 100) + '% LTV (Profil "' + p.label + '") werden ~' + Math.round(beleihbar).toLocaleString('de-DE') + ' € EK frei — nutzbar als Eigenkapital für weitere Käufe.',
          impact_eur: beleihbar
        });
      }
    }

    // ── 8. LTV zu hoch für Profil → Risiko reduzieren ─────────
    // V128: ltv_aktuell (über Verkehrswert) statt ltv (über KP).
    // Bei Wertsteigerung sinkt der reale LTV automatisch.
    var aktuellLtv = row.ltv_aktuell || row.ltv;
    if (aktuellLtv > p.ltv_max) {
      v.push({
        code: 'LTV_ZU_HOCH',
        severity: 'warning',
        label: 'LTV über Profil-Toleranz',
        detail: 'LTV ' + Math.round(aktuellLtv * 100) + '% (Verkehrswert-Basis) liegt über deiner Profil-Schwelle (' + Math.round(p.ltv_max * 100) + '% für "' + p.label + '"). Bei Zinsänderung oder Mietausfall überproportionales Risiko. Optionen: Sondertilgung, Profilwechsel auf "Wachstum"/"Aggressiv" (wenn LTV gewollt) oder Mietsteigerung (höherer Verkehrswert senkt LTV).',
        impact_eur: 0
      });
    }

    // ── 9. AfA-Endphase: noch wertvoll haltenswert ────────────
    if (row.rnd && row.rnd.rnd_jahre > 20 && row.afa_y > 3000) {
      var rest_afa_volumen = row.afa_y * Math.min(row.rnd.rnd_jahre, 30);
      v.push({
        code: 'HALTEN_WEGEN_AFA',
        severity: 'info',
        label: 'AfA-Volumen noch hoch — privat halten attraktiv',
        detail: 'Über die nächsten ' + Math.min(row.rnd.rnd_jahre, 30) + ' Jahre laufende AfA von ~' + Math.round(rest_afa_volumen).toLocaleString('de-DE') + ' € (kumuliert). Voller Einkommensteuer-Hebel im Privatvermögen.',
        impact_eur: rest_afa_volumen * grenz_priv
      });
    }

    // ── 9b. MIETLÜCKE → Mietanpassung möglich (V128) ──────────
    if (row.miete_luecke_y > 1500) {
      var luecke_pct = row.marktmiete_y > 0 ? row.miete_luecke_y / row.nkm_y * 100 : 0;
      // Cap gem. §558 BGB Mieterhöhung 20% in 3 Jahren (15% in Spannungsgebieten)
      var realistisch_y = Math.min(row.miete_luecke_y, row.nkm_y * 0.20);
      var st_extra_y = realistisch_y * grenz_priv * (-1) + realistisch_y;  // Mietsteigerung erhöht zvE → mehr Steuer
      var netto_extra_y = realistisch_y * (1 - grenz_priv);  // Netto-Mehrertrag
      v.push({
        code: 'MIETSTEIGERUNG_MOEGLICH',
        severity: 'opportunity',
        label: 'Mietanpassung an Marktmiete prüfen',
        detail: 'Ist-Miete ' + (row.ist_miete_qm * 100 / 100).toFixed(2).replace('.', ',') + ' €/m², Marktmiete ' + row.marktmiete_qm.toFixed(2).replace('.', ',') + ' €/m². Mietlücke ~' + Math.round(row.miete_luecke_y).toLocaleString('de-DE') + ' €/J. (' + Math.round(luecke_pct) + '% unter Markt). §558 BGB: Mieterhöhung max. 20% in 3 Jahren (Kappungs­grenze, in Spannungs­gebieten 15%). Realistisches Plus pro Jahr: ~' + Math.round(realistisch_y).toLocaleString('de-DE') + ' € brutto, ~' + Math.round(netto_extra_y).toLocaleString('de-DE') + ' € netto. Plus: höherer Verkehrswert → mehr Beleihungs­spielraum.',
        impact_eur: netto_extra_y * 10  // 10-Jahres-Effekt
      });
    }

    // ─── V127 NEUE VERDIKTE ──────────────────────────────────────

    // ── 10. Anschaffungsnahe Aufwendungen (§6 Abs.1 Nr.1a EStG) ─
    if (row.an15_aktiv && row.an15_rest > 0 && row.sanstand >= 3) {
      var rest_jahre = Math.max(0, _state.config.anschaffungsnah_jahre - row.halte_dauer);
      var st_erspar15 = row.an15_rest * grenz_priv;
      v.push({
        code: 'ANSCHAFFUNGSNAH_15PCT',
        severity: 'opportunity',
        label: '§6 (1) 1a EStG: 15%-Grenze nutzen',
        detail: 'Innerhalb der ersten 3 Jahre nach Kauf: Erhaltungs­aufwand bis ~' + Math.round(row.an15_rest).toLocaleString('de-DE') + ' € (15%-Grenze) bleibt sofort abziehbar. Darüber wird er zu Anschaffungs­kosten umqualifiziert (nur AfA). Noch ~' + rest_jahre + ' Jahr(e) Frist. Steuerersparnis bei vollem Ausnutzen: ~' + Math.round(st_erspar15).toLocaleString('de-DE') + ' €.',
        impact_eur: st_erspar15
      });
    } else if (!row.an15_aktiv && row.kaufjahr > 0 && row.halte_dauer >= 3) {
      // Hinweis nur informativ wenn schon raus aus der Frist
      // (kein Verdikt nötig — relevant nur für Neukäufe)
    }

    // ── 11. Bank-Verhandlung: Beleihungs-Reserve nutzbar ──────
    if (row.beleihungs_reserve > 30000) {
      v.push({
        code: 'BANK_VERHANDLUNG',
        severity: p.growth_weight >= 0.4 ? 'opportunity' : 'info',
        label: 'Bank-Verhandlung: Beleihungs-Reserve verfügbar',
        detail: 'Aktueller Verkehrswert ' + Math.round(row.verkehrswert).toLocaleString('de-DE') + ' €, Restschuld ' + Math.round(row.d_total).toLocaleString('de-DE') + ' €. Bei 80%-Beleihungs­auslauf (Standardbank) sind ~' + Math.round(row.beleihungs_reserve).toLocaleString('de-DE') + ' € Reserve verfügbar — verhandelbar als zusätzliche Grundschuld für Folge-Investitionen ohne neuen Notar-Aufwand.',
        impact_eur: row.beleihungs_reserve
      });
    }

    // ── 12. Rollierendes-EK-Kandidat ──────────────────────────
    // Geeignet: niedriger LTV, hoher Verkehrswert, gut getilgt, idealerweise
    // sanierungsstabil (Sanstand 1-3) → kein Cluster-Risiko an einem Objekt.
    if (row.verkehrswert >= _state.config.rollierendes_ek_min_value
        && row.ltv_aktuell < 0.45
        && row.beleihungs_reserve > 50000
        && row.sanstand <= 3
        && p.growth_weight >= 0.3) {
      v.push({
        code: 'ROLL_EK_KANDIDAT',
        severity: 'opportunity',
        label: 'Anker für rollierendes EK',
        detail: 'Niedriger LTV (' + Math.round(row.ltv_aktuell * 100) + '%), hoher Verkehrswert, stabiler Sanstand. Geeignet als Daueranker: Beleihungslinie über ~' + Math.round(row.beleihungs_reserve).toLocaleString('de-DE') + ' € öffnen, EK rollierend für weitere Käufe nutzen, nach jedem Wertzuwachs (Sanierung/Mietsteigerung) Linie erweitern.',
        impact_eur: row.beleihungs_reserve * 1.5  // Hebel-Schätzung
      });
    }

    // ── 13. Op-GmbH-Kandidat (hoher Sanierungs­bedarf) ─────────
    if (row.sanstand >= 4 && row.kp >= 200000 && p.growth_weight >= 0.4) {
      var san_y_geschaetzt = row.kp * 0.03;  // 3% des KP p.a. typisch in Sanierung
      v.push({
        code: 'OPGMBH_KANDIDAT',
        severity: 'info',
        label: 'Sanierung über Op-GmbH erwägen',
        detail: 'Bei diesem Objekt ist mit erheblichem Sanierungs­volumen zu rechnen (~' + Math.round(san_y_geschaetzt).toLocaleString('de-DE') + ' €/J. Schätzung). Eine operative GmbH (Sanierung/Bauträger) kann Leistungen an die Eigentümer-GmbH/Privat fakturieren — Fahrtkosten, Werkzeug, Personal werden Betriebs­ausgabe. Erst ab gesamten Sanierungs­volumen >30k €/J. wirtschaftlich.',
        impact_eur: san_y_geschaetzt * 0.15  // grob: 15% Steuervorteil durch BA-Verlagerung
      });
    }

    // ── 14. Nutzen-Lasten-Verschiebung beim Neukauf ───────────
    // Nur sinnvoll als Hinweis, wenn das Objekt sehr frisch gekauft ist
    // (kaufjahr = aktuelles Jahr UND viel Sanierungs­bedarf)
    if (row.kaufjahr > 0 && row.halte_dauer === 0 && row.sanstand >= 4) {
      var sanvolumen_max = row.geb_anteil_eur * 0.15;
      v.push({
        code: 'NUTZEN_LASTEN_VERSCHIEBEN',
        severity: 'info',
        label: 'Sanierung VOR Nutzen-Lasten-Wechsel prüfen',
        detail: 'Bei Käufen mit klarem Sanierungs­bedarf: Verkäufer fragen, ob der Nutzen-Lasten-Wechsel um bis zu 12 Monate verschoben werden kann. Während dieser Zeit Sanierung BEZAHLEN aber NICHT als Eigentümer abrechnen — die Aufwendungen fallen dann unter §6 (1) Nr. 1a EStG mit der 15%-Grenze; der Steuervorteil aus dem persönlichen Grenzsteuersatz ist bei rechtzeitiger Abstimmung mit Notar/Verkäufer realisierbar. Maximaler Hebel: ~' + Math.round(sanvolumen_max).toLocaleString('de-DE') + ' €.',
        impact_eur: sanvolumen_max * grenz_priv
      });
    }

    // ─── V130 ZUSÄTZLICHE STEUER-WERKZEUGE (mit § -Bezug) ──────────
    // Alle dokumentierte legale Gestaltungs­möglichkeiten — KEINE
    // Grauzonen. Jedes Verdikt mit §-Verweis und expliziter
    // "Voraussetzung"-/"Risiko"-Logik.

    // ── 15. §82b EStDV-Verteilung explizit (V130) ────────────────
    // Erhaltungs­aufwand kann auf 2-5 Jahre verteilt werden, statt
    // sofort — sinnvoll wenn das laufende Jahr keinen hohen
    // Grenzsteuersatz aufweist (z.B. nach Veräußerung, Kinderpause).
    if (row.sanstand >= 4 && row.kp > 0 && row.geb_anteil_eur > 50000) {
      var voraussichtl_san = row.kp * 0.02; // grob 2% des KP über 5 J
      v.push({
        code: 'PARA_82B_VERTEILUNG',
        severity: 'info',
        label: '§82b EStDV: Sanierungs-Aufwand verteilen',
        detail: 'Bei größeren Sanierungs­maßnahmen (>3 J Halte­dauer) kann der Erhaltungs­aufwand auf 2-5 Jahre verteilt werden statt sofort als Werbungs­kosten anzusetzen. Sinnvoll, wenn dein Grenzsteuersatz im laufenden Jahr niedrig ist (z.B. Sabbatical, Kinderpause, Verkaufs­gewinne aus Wertpapieren) oder du in den Folgejahren höhere Mieten erwartest. Voraussetzung: Erhaltungs­aufwand >3.000 € pro Maßnahme. Wahlrecht im Jahr der Aufwendung.',
        impact_eur: voraussichtl_san * 0.05  // ~5% Steuer-Smoothing-Vorteil
      });
    }

    // ── 16. §11 Abs. 2 EStG Zufluss-/Abfluss (V130) ──────────────
    // Strategisches Verschieben von Erhaltungs­aufwand übers Jahresende
    // (Zufluss-/Abfluss-Prinzip). Nur Hinweis bei Objekten mit
    // bevorstehender Sanierung im 4. Quartal.
    if (row.sanstand >= 3 && row.cf_vor_y > 0) {
      v.push({
        code: 'PARA_11_TIMING',
        severity: 'info',
        label: '§11 Abs. 2 EStG: Jahresende-Timing nutzen',
        detail: 'Anstehende Sanierungs- oder Verwaltungs­ausgaben (Heizung, Außen­anstrich, Verwalter­honorar Folgejahr) bewusst noch in dieses Jahr legen, wenn dein zvE hoch ist — oder ins nächste Jahr verschieben, wenn es niedriger erwartet wird. Mögliche Verschiebung: 4 Wochen vor/nach 31.12. Beachte 10-Tage-Regel bei regelmäßigen Zahlungen (BFH IX R 13/19).',
        impact_eur: row.bwk_y * 0.10  // 10% des laufenden Aufwands beweglich
      });
    }

    // ── 17. §6b EStG Reinvestitions-Rücklage (V130) ──────────────
    // Bei geplanten Verkäufen außerhalb der Spekfrist: Bildung einer
    // Reinvestitions-Rücklage zur Steueraufschiebung. Gilt nur bei
    // betrieblicher Nutzung (GmbH oder gewerbliche Vermietung) — bei
    // privater V+V außerhalb §23 ist Verkauf ohnehin steuerfrei.
    if (row.spekfrist_rest === 0 && row.verkehrswert > row.kp * 1.3 && _state.inputs.hat_struktur !== 'keine') {
      v.push({
        code: 'PARA_6B_RUECKLAGE',
        severity: 'info',
        label: '§6b EStG: Reinvestitions-Rücklage prüfen',
        detail: 'Bei Verkauf aus dem Betriebsvermögen (GmbH oder gewerblich): Veräußerungs­gewinn kann auf bis zu 4 Jahre auf andere Reinvestitions-Objekte übertragen werden statt sofort versteuert. Voraussetzung: 6 Jahre Halte­dauer im BV, Reinvestition in begünstigtes Anlagevermögen, formelle Rücklagen­bildung in der Bilanz. Bei privater V+V irrelevant (§23-frei).',
        impact_eur: (row.verkehrswert - row.kp) * 0.15
      });
    }

    // ── 18. §35a EStG für Eigennutzungs-Anteile (V130) ───────────
    // Bei Mischnutzung (z.B. selbst genutzte Einliegerwohnung in MFH):
    // 20% der Lohnkosten der Handwerker (max. 1.200 €/J) sind direkte
    // Steuerermäßigung. Nur sinnvoll wenn ein Eigennutzungs-Anteil
    // existiert oder geplant ist.
    // Conservative: nur Hinweis als Optionsschilderung, kein Auto-Push
    if (row.kp > 200000 && row.sanstand >= 3) {
      v.push({
        code: 'PARA_35A_HAUSHALT',
        severity: 'info',
        label: '§35a EStG: Bei Mischnutzung Handwerker absetzen',
        detail: 'Falls (geplant) eine Wohnung in diesem Objekt selbst genutzt wird: 20 % der Handwerker-Lohnkosten (nicht Material!) sind direkte Steuer­ermäßigung, max. 1.200 €/J. Bei energetischer Sanierung +35 % gem. §35c EStG (max. 40.000 € über 3 J). Voraussetzung: Rechnung + Über­weisung (kein Bargeld), Lohn­anteil getrennt ausgewiesen.',
        impact_eur: 1200 * 5  // konservativ
      });
    }

    // ── 19. §7h/§7i EStG Sanierungs­gebiet/Denkmal (V130) ────────
    // Erhöhte AfA für Modernisierungs­aufwand in Sanierungs­gebieten oder
    // Denkmal-Objekten — 9% in den ersten 8 Jahren, 7% in 4 weiteren.
    // Wir können das nicht ohne Zusatz-Daten ermitteln, daher Hinweis
    // bei alten Objekten mit Sanierungs­volumen.
    if (row.baujahr > 0 && row.baujahr < 1960 && row.sanstand >= 4) {
      v.push({
        code: 'PARA_7H_7I_HINWEIS',
        severity: 'info',
        label: '§7h / §7i EStG prüfen: Sanierungs­gebiet/Denkmal?',
        detail: 'Objekt aus Bj. ' + row.baujahr + '. Bei Belegenheit in einem förmlich festgelegten Sanierungs­gebiet (§7h) oder bei Denkmal­schutz (§7i): erhöhte AfA für Modernisierungs­aufwand — 9 % in den ersten 8 Jahren, dann 7 % in 4 weiteren. Voraussetzung: Bescheinigung der Gemeinde/Denkmalbehörde VOR Beginn der Maßnahme (Antrag­frist beachten!). Bei zutreffender Lage: einer der stärksten AfA-Hebel überhaupt.',
        impact_eur: row.kp * 0.05 * 0.42  // 5% sanierbar × 42% Steuer
      });
    }

    // ── 20. §10f EStG Eigennutzungs-Sonder-AfA (V130) ────────────
    // Wie §7h/§7i, aber für selbst genutzten Wohnraum bei Denkmal/
    // Sanierungs­gebiet — 9% Sonderausgabenabzug für 10 Jahre.
    // Nur bei Eigennutzungs-Plänen relevant.

    // ── 21. JStG 2024: §9 Nr. 1 S. 1 GewStG Update (V130) ────────
    // Ab Erhebungszeitraum 2025: einfache Grundbesitz­kürzung in der
    // GewSt nur noch in Höhe der TATSÄCHLICH GEZAHLTEN Grundsteuer
    // (war: pauschal 1,2% des Einheitswerts × 1,2). Das senkt die
    // GewSt-Kürzung bei VV-GmbHs ohne erweiterte Kürzung.
    if (_state.inputs.hat_struktur !== 'keine' && row.kp > 0) {
      v.push({
        code: 'JSTG2024_GEWST_HINWEIS',
        severity: 'info',
        label: 'JStG 2024: GewSt-Grundbesitzkürzung gekoppelt',
        detail: 'Ab Erhebungs­zeitraum 2025 ist die einfache Grundbesitz­kürzung in der GewSt (§9 Nr. 1 S. 1 GewStG) an die TATSÄCHLICH gezahlte Grundsteuer gekoppelt — nicht mehr pauschal 1,2 % vom Einheitswert. Falls deine VV-GmbH NICHT die erweiterte Kürzung (§9 Nr. 1 S. 2 GewStG) anwendet: Grundsteuer­zahlungen sauber buchen, keine Vorauszahlungen über Jahres­wechsel verschieben. Für die erweiterte Kürzung gilt die Änderung nicht.',
        impact_eur: 0
      });
    }

    // ─── V131 LAGE- UND MARKT-VERDIKTE ─────────────────────────
    var lageStark = (row.mikrolage === 'sehr_gut' || row.mikrolage === 'gut')
                 || (row.bevoelkerung === 'stark_wachsend' || row.bevoelkerung === 'wachsend')
                 || (row.nachfrage === 'sehr_stark' || row.nachfrage === 'stark');
    var lageSchwach = (row.mikrolage === 'einfach' || row.mikrolage === 'problematisch')
                  || (row.bevoelkerung === 'leicht_fallend' || row.bevoelkerung === 'stark_fallend')
                  || (row.nachfrage === 'schwach' || row.nachfrage === 'sehr_schwach');

    // ── 22. Lage stark + Mietlücke → aggressiv anpassen ──────
    if (lageStark && row.miete_luecke_y > 1000 && p.cashflow_weight + p.growth_weight >= 0.4) {
      v.push({
        code: 'LAGE_STARK_MIETPOTENZIAL',
        severity: 'opportunity',
        label: 'Starke Lage — Mieten konsequent anziehen',
        detail: 'Die Lagequalität (' + (row.mikrolage || 'gut') + (row.bevoelkerung ? ', Bevölkerung ' + row.bevoelkerung : '') + (row.nachfrage ? ', Nachfrage ' + row.nachfrage : '') + ') trägt deutlich höhere Mieten als der aktuelle Stand. In starken Lagen sind Mietsteigerungs­spielräume oft auch nach §558 BGB-Kappung schnell wieder gegeben. Strategie: Bei jeder Wieder­vermietung Marktmiete ansetzen, in laufenden Verträgen alle 15 Monate die 20%-Kappungs­grenze ausschöpfen. Mietlücke aktuell ~' + Math.round(row.miete_luecke_y).toLocaleString('de-DE') + ' €/J.',
        impact_eur: row.miete_luecke_y * 7
      });
    }

    // ── 23. Lage schwach → Exit-Strategie statt Halten ───────
    if (lageSchwach && row.spekfrist_rest === 0) {
      v.push({
        code: 'LAGE_SCHWACH_EXIT',
        severity: 'warning',
        label: 'Schwache Lage + §23-Frist abgelaufen → Verkauf prüfen',
        detail: 'Lage ist mittelfristig kritisch (' + (row.mikrolage || 'einfach') + (row.bevoelkerung ? ', Bevölkerung ' + row.bevoelkerung : '') + '). Mietwachstum und Wertsteigerung deutlich begrenzt. Mit abgelaufener §23-Frist ist ein Verkauf einkommen­steuerfrei möglich — Erlös in Lagen mit besserer Demographie reinvestieren. Aktueller Verkehrswert: ' + Math.round(row.verkehrswert).toLocaleString('de-DE') + ' €.',
        impact_eur: Math.max(0, (row.verkehrswert - row.kp) * 0.4)
      });
    }

    // ── 24. Wertsteigerungs-Erwartung + niedriger LTV → Hebel ─
    if ((row.wertsteigerung === 'sehr_hoch' || row.wertsteigerung === 'hoch')
        && row.ltv_aktuell < 0.6 && row.beleihungs_reserve > 30000
        && p.growth_weight >= 0.3) {
      v.push({
        code: 'WERT_HEBEL_AKTIVIEREN',
        severity: 'opportunity',
        label: 'Wertsteigerungs-Erwartung hoch — Beleihungs-Hebel aktivieren',
        detail: 'Erwartete Wertsteigerung: "' + row.wertsteigerung + '". Bei niedrigem aktuellen LTV (' + Math.round(row.ltv_aktuell * 100) + '%) und ~' + Math.round(row.beleihungs_reserve).toLocaleString('de-DE') + ' € Beleihungs­reserve: Linie öffnen, EK in 1-2 Folgekäufe an gleicher Lage stecken. Wenn die Wertsteigerung eintritt, wächst die Beleihungs­reserve weiter — rollierender Hebel ohne neues Privatkapital.',
        impact_eur: row.beleihungs_reserve * 4 * 0.05 * 5
      });
    }

    // ── 25. Entwicklungs­möglichkeiten → §6b/§82b Cluster ─────
    if (row.entwicklungs_moegl === 'hoch' || row.entwicklungs_moegl === 'sehr_hoch') {
      v.push({
        code: 'ENTWICKLUNGS_POTENZIAL',
        severity: 'info',
        label: 'Entwicklungs­potenzial vorhanden — Maßnahmen budgetieren',
        detail: 'Objekt-Eingabe weist Entwicklungs­möglichkeiten aus (Aufstockung, Ausbau, Teilung, Umnutzung). Steuerlich: solche Maßnahmen sind oft Herstellungs­kosten (= AfA über RND), aber Teile davon (Putz/Anstrich an Fassaden, Innen­ausbau-Ergänzungen) gelten als Erhaltungs­aufwand und sind sofort oder §82b-verteilt abziehbar. Vor Beginn Steuerberater-Abstimmung — ggf. Bauantrag in Ausbau- + Erhaltungs-Pakete teilen.',
        impact_eur: row.kp * 0.05
      });
    }

    // ── 26. Energieklasse F-H → §35c-Hebel ────────────────────
    if (row.energieklasse && ['F', 'G', 'H'].indexOf(row.energieklasse) >= 0) {
      v.push({
        code: 'ENERGIE_SANIERUNG',
        severity: 'info',
        label: 'Energieklasse ' + row.energieklasse + ' — §35c EStG nutzbar',
        detail: 'Energetische Sanierung (Dämmung, Fenster, Heizung) qualifiziert für §35c EStG: 7 % der Kosten in Jahr 1+2, 6 % in Jahr 3 — max. 40.000 € Steuer­ermäßigung über 3 Jahre. Voraussetzung: Bescheinigung des Fach­unternehmens nach §88 EStDV. Nicht kombinierbar mit KfW-Förderung derselben Maßnahme (Wahlrecht!). Sekundär: höherer Verkehrswert, geringeres Leerstands­risiko. Bei reiner V+V: Erhaltungs­aufwand statt §35c.',
        impact_eur: 40000
      });
    }

    return v;
  }
  function _persoenlicheSteuerDelta(baseZvE, vuvY) {
    // Nutzt Tax-Modul (§32a EStG Tarif 2026) für konsistente Werte.
    if (typeof Tax === 'undefined' || !Tax.calcEStG) {
      // Fallback: pauschal Grenzsteuer 35%
      return { taxBefore: baseZvE * 0.35, taxAfter: (baseZvE + vuvY) * 0.35,
               delta: vuvY * 0.35, grenz: 0.35 };
    }
    var newZvE = Math.max(0, baseZvE + vuvY);
    var t1 = Tax.calcEStG(baseZvE);
    var t2 = Tax.calcEStG(newZvE);
    var grenz = Tax.calcGrenzsteuersatz ? Tax.calcGrenzsteuersatz(newZvE) : 0;

    // SolZ ab 18.130 € (2026 Freigrenze) ~ 5,5% auf ESt
    var solzBefore = t1 > 18130 ? t1 * 0.055 : 0;
    var solzAfter  = t2 > 18130 ? t2 * 0.055 : 0;
    var kistBefore = _state.inputs.church_tax ? t1 * 0.09 : 0;
    var kistAfter  = _state.inputs.church_tax ? t2 * 0.09 : 0;

    return {
      taxBefore: t1 + solzBefore + kistBefore,
      taxAfter:  t2 + solzAfter + kistAfter,
      delta:     (t2 + solzAfter + kistAfter) - (t1 + solzBefore + kistBefore),
      grenz:     grenz
    };
  }

  function _gmbhSteuerLaufend(gewinn, opts) {
    // Jährliche GmbH-Steuer auf laufenden Gewinn.
    // opts.erwKuerzung = true → GewSt = 0 (§9 Nr.1 S.2 GewStG)
    opts = opts || {};
    var c = _state.config;
    var kst = gewinn * c.kst_satz;
    var solz = kst * c.solz_satz;
    var gewst = 0;
    if (!opts.erwKuerzung) {
      // GewSt = Gewinn × Messzahl × (Hebesatz/100)
      gewst = gewinn * c.gewst_messzahl * (c.gewst_hebesatz / 100);
    }
    return { kst: kst, solz: solz, gewst: gewst, total: kst + solz + gewst };
  }

  function _entnahmeSteuer(ausschuettung) {
    // Privatentnahme aus GmbH → KapESt + SolZ + ggf. KiSt
    var c = _state.config;
    var kapest = ausschuettung * c.kapest_satz;
    var solz   = kapest * c.solz_satz;
    var kist   = _state.inputs.church_tax ? kapest * 0.09 : 0;
    return { kapest: kapest, solz: solz, kist: kist, total: kapest + solz + kist };
  }

  // ── SZENARIO-BERECHNUNG ─────────────────────────────────────────
  /**
   * Liefert pro Szenario:
   *   {
   *     key, label, struktur,
   *     stueck:        { Anzahl Privat / GmbH / Holding },
   *     einmalkosten:  { grest, notar, summe },
   *     jahr1:         { miete, ueberschuss, steuer, cf_n_st },
   *     horizon:       { jahre, cf_kum, ek_endwert, npv, irr },
   *     pros[], cons[], note
   *   }
   */
  function _calcScenario(key, port, rows) {
    var c = _state.config;
    var inp = _state.inputs;
    var H = c.horizon_years;
    var disc = c.discount_rate;

    function discountFactor(yr) { return 1 / Math.pow(1 + disc, yr); }
    function project(values, growth) {
      // values: array of (yr 1..H) — multiplikative Steigerung
      var arr = [];
      for (var i = 0; i < H; i++) arr.push(values * Math.pow(1 + growth, i));
      return arr;
    }
    function sum(arr) { return arr.reduce(function(a, b) { return a + b; }, 0); }
    function npv(arr) { return arr.reduce(function(s, v, i) { return s + v * discountFactor(i + 1); }, 0); }

    var miete    = project(port.nkm_y, inp.growth_rent_pa);
    var bwkArr   = project(port.bwk_y, inp.growth_rent_pa);   // skaliert mit Miete
    var instArr  = project(port.instand_y, 0.02);             // 2% Inflation
    var zinsArr  = []; var tilgArr = []; var afaArr = [];

    // Vereinfachung: konstante Annuität (Sondertilgungen ignoriert).
    // Restschuld-Lauf grob: Tilgung wächst leicht durch Tilgungsverstärkung
    // — hier vereinfacht konstant; reale Annuitätenrechnung wäre
    // nächster Iterationsschritt.
    for (var y = 0; y < H; y++) {
      zinsArr.push(port.zins_y * Math.pow(0.97, y));   // Zins sinkt ~3% p.a. mit Tilgung
      tilgArr.push(port.tilg_y * Math.pow(1.03, y));
      afaArr.push(port.afa_y);                         // linear
    }

    var cf_op  = miete.map(function(m, i) { return m - bwkArr[i] - instArr[i]; });
    var vuv    = miete.map(function(m, i) { return m - bwkArr[i] - instArr[i] - zinsArr[i] - afaArr[i]; });
    var cf_vor = miete.map(function(m, i) { return m - bwkArr[i] - instArr[i] - zinsArr[i] - tilgArr[i]; });

    var sc = { key: key, einmalkosten: { grest: 0, notar: 0, summe: 0 }, pros: [], cons: [], note: '' };

    // ─── 1. PRIVAT_BASIS ───────────────────────────────────
    if (key === 'privat_basis') {
      sc.label    = 'Privat halten — Status quo';
      sc.struktur = 'Alle Objekte privat, keine Strukturänderung.';
      sc.stueck   = { privat: rows.length, gmbh: 0, holding: 0 };

      var steuerJahr = vuv.map(function(v) {
        return _persoenlicheSteuerDelta(inp.base_income_zve, v).delta;
      });
      var cfNach = cf_vor.map(function(c, i) { return c - steuerJahr[i]; });

      sc.jahr1 = {
        miete:        miete[0],
        ueberschuss:  vuv[0],
        steuer:       steuerJahr[0],
        cf_n_st:      cfNach[0],
        grenz:        _persoenlicheSteuerDelta(inp.base_income_zve, vuv[0]).grenz
      };
      sc.horizon = {
        jahre:       H,
        cf_kum:      sum(cfNach),
        ek_endwert:  port.ek + sum(tilgArr) + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv:         npv(cfNach),
        steuer_kum:  sum(steuerJahr)
      };
      sc.pros = [
        'Keine Übertragungs­kosten, keine Restrukturierung nötig.',
        'AfA + Werbungskosten reduzieren persönliche ESt direkt.',
        'Nach 10 Jahren Veräußerung steuerfrei (§23 EStG Spekulationsfrist).'
      ];
      sc.cons = [
        'Mietüberschüsse werden mit persönlichem Grenzsteuersatz versteuert.',
        'Bei Gewinnen oberhalb der Spekulationsfrist trotzdem volle Belastung laufender Erträge.',
        'Skalierungsgrenzen: Banken sehen Einzelperson als Klumpenrisiko.'
      ];
      sc.note = 'Basislinie zur Vergleichbarkeit aller anderen Szenarien.';
    }

    // ─── 2. PRIVAT_OPTIMIERT ───────────────────────────────
    else if (key === 'privat_optimiert') {
      sc.label    = 'Privat — steueroptimiert';
      sc.struktur = 'Privat, aber AfA-Hebel maximiert + 5-Jahres-Verteilung Erhaltung.';
      sc.stueck   = { privat: rows.length, gmbh: 0, holding: 0 };

      // Annahme: zusätzliche AfA-Optimierung (BMF-Aufteilung) bringt im Schnitt 0,3 % mehr AfA-Quote
      // → höhere V+V-Verlust → größere Steuererstattung.
      var afaBoost = 1.15; // +15% AfA-Volumen durch BMF-optimierte Aufteilung
      var afaArrOpt = afaArr.map(function(a) { return a * afaBoost; });
      var vuvOpt = miete.map(function(m, i) { return m - bwkArr[i] - instArr[i] - zinsArr[i] - afaArrOpt[i]; });
      var steuerJ = vuvOpt.map(function(v) {
        return _persoenlicheSteuerDelta(inp.base_income_zve, v).delta;
      });
      var cfNach = cf_vor.map(function(c, i) { return c - steuerJ[i]; });

      sc.jahr1 = {
        miete: miete[0], ueberschuss: vuvOpt[0],
        steuer: steuerJ[0], cf_n_st: cfNach[0],
        grenz: _persoenlicheSteuerDelta(inp.base_income_zve, vuvOpt[0]).grenz
      };
      sc.horizon = {
        jahre: H,
        cf_kum: sum(cfNach),
        ek_endwert: port.ek + sum(tilgArr) + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: npv(cfNach),
        steuer_kum: sum(steuerJ)
      };
      sc.pros = [
        'Höhere AfA durch sachverständige Kaufpreisaufteilung (BMF-Verfahren).',
        'Erhaltungsaufwand auf 2-5 Jahre verteilbar (§82b EStDV) — glättet Steuerlast.',
        'Spekulationsfrist nach 10 Jahren weiterhin nutzbar.'
      ];
      sc.cons = [
        'Setzt aktive Pflege voraus (Gutachten, Verteilungsanträge).',
        'Persönlicher Grenzsteuersatz bleibt der Engpass.',
        'BMF-Aufteilung kann vom Finanzamt geprüft / verworfen werden.'
      ];
      sc.note = '+15 % AfA-Volumen unterstellt (typische BMF-Optimierung). Zahlen modellhaft.';
    }

    // ─── 3. VVGMBH_NEU ─────────────────────────────────────
    else if (key === 'vvgmbh_neu') {
      sc.label    = 'Vermögensverwaltungs-GmbH (nur Neukäufe)';
      sc.struktur = 'Bestand bleibt privat. Künftige Käufe via VV-GmbH mit erweiterter Kürzung.';
      sc.stueck   = { privat: rows.length, gmbh: 0, holding: 0 };

      // Annahme: Bestand verhält sich wie Privat-Basis.
      // Plus: GmbH-Schale bereitstehend = Strukturkosten ohne direkten Effekt.
      var gruendung = 1500;        // Gründungs-Kosten Pauschale (Notar, HRB, Stammkapital nicht angesetzt)
      sc.einmalkosten = { grest: 0, notar: gruendung, summe: gruendung };

      var steuerJahr = vuv.map(function(v) {
        return _persoenlicheSteuerDelta(inp.base_income_zve, v).delta;
      });
      var cfNach = cf_vor.map(function(c, i) { return c - steuerJahr[i]; });

      sc.jahr1 = {
        miete: miete[0], ueberschuss: vuv[0],
        steuer: steuerJahr[0], cf_n_st: cfNach[0] - gruendung,
        grenz: _persoenlicheSteuerDelta(inp.base_income_zve, vuv[0]).grenz
      };
      sc.horizon = {
        jahre: H,
        cf_kum: sum(cfNach) - gruendung,
        ek_endwert: port.ek + sum(tilgArr) + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: npv(cfNach) - gruendung,
        steuer_kum: sum(steuerJahr)
      };
      sc.pros = [
        'Skalierbar: Neue Objekte landen direkt in steueroptimierter Hülle.',
        'Bei erweiterter Kürzung (§9 Nr.1 S.2 GewStG): nur ~15,825 % auf Mietgewinn.',
        'Thesaurierte Mittel re-investierbar ohne erneute Privatbesteuerung.'
      ];
      sc.cons = [
        'Bestand profitiert nicht — Hebel erst bei Neukäufen.',
        'GmbH-Buchhaltung & Jahresabschluss = laufende Kosten (~1.500-3.000 €/J).',
        'Bei Mischbetätigung (z.B. PV-Anlage, Kurzzeitvermietung) entfällt erw. Kürzung komplett.'
      ];
      sc.note = 'Strategie für Investoren mit klarem Wachstumspfad. Bestand bleibt unangetastet.';
    }

    // ─── 4b. VVGMBH_SELEKTIV (V126: neu) ───────────────────
    else if (key === 'vvgmbh_selektiv') {
      // Selektiv: Nur Objekte umhängen, deren Spekfrist abgelaufen ist
      // UND deren laufender Steuervorteil GrESt-Einmalkosten innerhalb
      // umhaengen_min_npv_gain rechtfertigt.
      var profileObj = PROFILES[inp.profile] || PROFILES.cashflow;
      var selektiv = rows.filter(function(r) {
        var ablauf = (r.spekfrist_rest === 0 || r.spekfrist_rest == null);
        var vorteil_y = Math.max(0, r.vuv_y) * 0.42 - Math.max(0, r.vuv_y) * 0.15825;
        var grest_e = r.kp * (c.grest_satz_pct / 100);
        var npv_gain_est = vorteil_y * H - grest_e - r.kp * (c.notar_grundbuch_pct / 100);
        return ablauf && npv_gain_est >= profileObj.umhaengen_min_npv_gain;
      });
      var rest = rows.filter(function(r) { return selektiv.indexOf(r) < 0; });

      sc.label    = 'Selektiv umhängen — nach Profil "' + profileObj.label + '"';
      sc.struktur = selektiv.length + ' von ' + rows.length + ' Objekten in VV-GmbH überführen, ' + rest.length + ' bleiben privat. Auswahl nach §23-Frist und NPV-Gewinn-Schwelle.';
      sc.stueck   = { privat: rest.length, gmbh: selektiv.length, holding: 0 };

      var kpUmhaengen = selektiv.reduce(function(s, r) { return s + r.kp; }, 0);
      var grestSel = kpUmhaengen * (c.grest_satz_pct / 100);
      var notarSel = kpUmhaengen * (c.notar_grundbuch_pct / 100);
      var gruendungSel = selektiv.length > 0 ? 1500 : 0;
      sc.einmalkosten = { grest: grestSel, notar: notarSel + gruendungSel, summe: grestSel + notarSel + gruendungSel };

      // Aggregat: Privater Teil + GmbH-Teil
      var portPriv = _aggregatePortfolio(rest);
      var portGmbH = _aggregatePortfolio(selektiv);

      var steuerJahr = []; var cfNach = [];
      for (var yi = 0; yi < H; yi++) {
        // Privat
        var miete_priv  = portPriv.nkm_y * Math.pow(1 + inp.growth_rent_pa, yi);
        var bwk_priv    = portPriv.bwk_y * Math.pow(1 + inp.growth_rent_pa, yi);
        var inst_priv   = portPriv.instand_y * Math.pow(1.02, yi);
        var zins_priv   = portPriv.zins_y * Math.pow(0.97, yi);
        var tilg_priv   = portPriv.tilg_y * Math.pow(1.03, yi);
        var afa_priv    = portPriv.afa_y;
        var vuv_priv_y  = miete_priv - bwk_priv - inst_priv - zins_priv - afa_priv;
        var st_priv     = _persoenlicheSteuerDelta(inp.base_income_zve, vuv_priv_y).delta;
        var cf_vor_priv = miete_priv - bwk_priv - inst_priv - zins_priv - tilg_priv;

        // GmbH
        var miete_g  = portGmbH.nkm_y * Math.pow(1 + inp.growth_rent_pa, yi);
        var bwk_g    = portGmbH.bwk_y * Math.pow(1 + inp.growth_rent_pa, yi);
        var inst_g   = portGmbH.instand_y * Math.pow(1.02, yi);
        var zins_g   = portGmbH.zins_y * Math.pow(0.97, yi);
        var tilg_g   = portGmbH.tilg_y * Math.pow(1.03, yi);
        var afa_g    = portGmbH.afa_y;
        var vuv_g_y  = miete_g - bwk_g - inst_g - zins_g - afa_g;
        var st_g     = _gmbhSteuerLaufend(Math.max(0, vuv_g_y), { erwKuerzung: true }).total;
        var cf_vor_g = miete_g - bwk_g - inst_g - zins_g - tilg_g;

        steuerJahr.push(st_priv + st_g);
        cfNach.push(cf_vor_priv + cf_vor_g - st_priv - st_g);
      }

      sc.jahr1 = {
        miete: rows.reduce(function(s, r) { return s + r.nkm_y * (1 + inp.growth_rent_pa); }, 0) / rows.length * rows.length, // ≈ port.nkm_y * (1+g)
        ueberschuss: portPriv.vuv_y + portGmbH.vuv_y,
        steuer: steuerJahr[0],
        cf_n_st: cfNach[0],
        grenz: 0   // gemischt — schwer pauschal anzugeben
      };
      sc.horizon = {
        jahre: H,
        cf_kum: cfNach.reduce(function(a, b) { return a + b; }, 0) - sc.einmalkosten.summe,
        ek_endwert: port.ek + port.tilg_y * H * 1.1 + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: cfNach.reduce(function(s, v, i) { return s + v / Math.pow(1 + disc, i + 1); }, 0) - sc.einmalkosten.summe,
        steuer_kum: steuerJahr.reduce(function(a, b) { return a + b; }, 0) + sc.einmalkosten.summe
      };
      sc.pros = [
        'Nur Objekte mit klarem NPV-Vorteil werden umgehängt — minimale GrESt-Last.',
        'Spekulationsfrist-Strategie wird respektiert — keine vorzeitige Einbringung.',
        'Bestand mit hohem AfA-Hebel bleibt im Privatvermögen (steuerneutral nach 10 J).'
      ];
      sc.cons = [
        'Gemischte Struktur erfordert beide Buchhaltungen (privat + GmbH).',
        'Auswahl ändert sich, wenn sich §23-Fristen oder Profile ändern.',
        'Komplexere Vermögensverwaltung — höherer Beratungsaufwand.'
      ];
      sc.note = selektiv.length === 0
        ? 'Mit aktuellem Profil und Bestand kein Objekt geeignet — bleibt komplett privat.'
        : 'Empfohlene Objekte zum Umhängen: ' + selektiv.map(function(r) { return r.kuerzel; }).join(', ');
    }

    // ─── 5. VVGMBH_KOMPLETT (vorher: vvgmbh_umhaengen) ─────
    else if (key === 'vvgmbh_komplett') {
      sc.label    = 'Bestand komplett in VV-GmbH einbringen';
      sc.struktur = 'Verkauf/Einbringung des kompletten Bestands in VV-GmbH. GrESt fällt für ALLE Objekte an.';
      sc.stueck   = { privat: 0, gmbh: rows.length, holding: 0 };

      var grest = port.kp * (c.grest_satz_pct / 100);
      var notarG = port.kp * (c.notar_grundbuch_pct / 100);
      var gruendung = 1500;
      sc.einmalkosten = { grest: grest, notar: notarG + gruendung, summe: grest + notarG + gruendung };

      // Laufend in GmbH (mit erw. Kürzung):
      var gewinnGmbH = vuv.map(function(v) { return Math.max(0, v); }); // Verluste in GmbH = Vortrag
      var steuerGmbH = gewinnGmbH.map(function(g) {
        return _gmbhSteuerLaufend(g, { erwKuerzung: true }).total;
      });
      // Annahme: keine Ausschüttung — voll thesauriert.
      var cfNach = cf_vor.map(function(c, i) { return c - steuerGmbH[i]; });

      sc.jahr1 = {
        miete: miete[0], ueberschuss: vuv[0],
        steuer: steuerGmbH[0], cf_n_st: cfNach[0],
        grenz: 0.15825   // KSt + SolZ
      };
      sc.horizon = {
        jahre: H,
        cf_kum: sum(cfNach) - sc.einmalkosten.summe,
        ek_endwert: port.ek + sum(tilgArr) + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: npv(cfNach) - sc.einmalkosten.summe,
        steuer_kum: sum(steuerGmbH) + sc.einmalkosten.summe
      };
      sc.pros = [
        'Laufende Belastung sinkt drastisch (~15,8 % statt 42 %+).',
        'Thesaurierte Mittel = höhere Eigenkapitalbildung pro Jahr.',
        'Spätere Strukturen (Holding, Nachfolge) leichter umsetzbar.'
      ];
      sc.cons = [
        'GrESt bei Übertragung — bricht oft ~6,5 % des KP weg.',
        'Spekulationsfrist startet neu — 10-Jahres-Steuerfreiheit verloren.',
        'Bei Aufdeckung stiller Reserven: ESt auf Veräußerungs­gewinn (außer §6 EStG-Gestaltungen).',
        'Komplexe Gestaltung — Steuerberater + Notar zwingend.'
      ];
      sc.note = '§6a UmwStG / §3 UmwStG-Wege prüfen für GrESt-Vermeidung. Modell ohne diese Vergünstigungen.';
    }

    // ─── 5. HOLDING_STRUKTUR ───────────────────────────────
    else if (key === 'holding_struktur') {
      sc.label    = 'Holding-GmbH + VV-GmbH (Tochter)';
      sc.struktur = 'Holding hält 100 % der VV-GmbH. Ausschüttungen Tochter→Holding zu 95% steuerfrei (§8b KStG).';
      sc.stueck   = { privat: 0, gmbh: rows.length, holding: 1 };

      var grest = port.kp * (c.grest_satz_pct / 100);
      var notarG = port.kp * (c.notar_grundbuch_pct / 100);
      var gruendung = 3000;  // 2× GmbH-Gründung
      sc.einmalkosten = { grest: grest, notar: notarG + gruendung, summe: grest + notarG + gruendung };

      var gewinnT = vuv.map(function(v) { return Math.max(0, v); });
      var steuerT = gewinnT.map(function(g) {
        return _gmbhSteuerLaufend(g, { erwKuerzung: true }).total;
      });
      // Bei Ausschüttung Tochter→Mutter: 5 % gelten als nichtabziehbare BA (§8b Abs.5 KStG)
      // = 5% des ausgeschütteten Betrages × 15,825 % Belastung in Holding.
      // Annahme: 50 % der Mittel werden an die Holding ausgeschüttet, 50 % thesauriert in Tochter.
      var ausschTochter = gewinnT.map(function(g, i) { return Math.max(0, g - steuerT[i]) * 0.5; });
      var nachAB_Holding = ausschTochter.map(function(a) { return a * 0.05 * 0.15825; });
      var steuerGesamt = steuerT.map(function(t, i) { return t + nachAB_Holding[i]; });
      var cfNach = cf_vor.map(function(c, i) { return c - steuerGesamt[i]; });

      sc.jahr1 = {
        miete: miete[0], ueberschuss: vuv[0],
        steuer: steuerGesamt[0], cf_n_st: cfNach[0],
        grenz: 0.16  // effektiv ~15,8 % + minimale Holding-Belastung
      };
      sc.horizon = {
        jahre: H,
        cf_kum: sum(cfNach) - sc.einmalkosten.summe,
        ek_endwert: port.ek + sum(tilgArr) + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: npv(cfNach) - sc.einmalkosten.summe,
        steuer_kum: sum(steuerGesamt) + sc.einmalkosten.summe
      };
      sc.pros = [
        'Maximale Reinvestitions­quote durch §8b KStG (95% steuerfreie Ausschüttung Tochter→Mutter).',
        'Holding kann Gewinne weiterverwenden (z.B. Aktien, weitere Beteiligungen).',
        'Saubere Nachfolgeplanung möglich (Anteile, nicht Immobilien einzeln).'
      ];
      sc.cons = [
        'GrESt + doppelte Gründungs- und Verwaltungs­kosten.',
        'Kein 95%-Privileg auf laufende Mieten — nur auf Beteiligungs­erträge.',
        'Komplexität deutlich höher — laufende Kosten ~3.000-6.000 €/J.',
        'Holding-Effekt erst bei späterem Exit oder Beteiligungs­verkauf voll wirksam.'
      ];
      sc.note = 'Sinnvoll erst ab ~5+ Objekten oder geplantem Exit in 5-10 Jahren.';
    }

    // ─── 7. WACHSTUM_LTV (V126: neu) ────────────────────────
    else if (key === 'wachstum_ltv') {
      // Strategie: Bei aufgewerteten Objekten (Verkehrswert > KP) bis
      // zum Profil-Ziel-LTV beleihen, freigesetztes EK in neue Objekte
      // (typische Größe 200k KP, 5,5% Bruttomietrendite, ROI ~6% n.St.)
      var profileObj = PROFILES[inp.profile] || PROFILES.cashflow;
      var freeEk = 0;
      rows.forEach(function(r) {
        if (r.verkehrswert > r.kp * 1.05 && r.ltv_aktuell < profileObj.ltv_target) {
          freeEk += r.verkehrswert * profileObj.ltv_target - r.d_total;
        }
      });
      // Konservativ: Annahme, dass freigesetztes EK 25% EK-Quote bei Neukauf bedeutet
      var neukauf_volumen = freeEk * 4;  // 4× Hebel bei 75% LTV
      var neue_objekte = Math.floor(neukauf_volumen / 200000); // typische 200k-Objekte
      var miete_neu_y = neukauf_volumen * 0.055;   // 5,5% Bruttomietrendite
      var bwk_neu_y = miete_neu_y * 0.18;
      var afa_neu_y = neukauf_volumen * 0.80 * 0.02;
      var zins_neu_y = neukauf_volumen * 0.75 * 0.04;  // 4% Zins
      var tilg_neu_y = neukauf_volumen * 0.75 * 0.02;
      var vuv_neu_y  = miete_neu_y - bwk_neu_y - zins_neu_y - afa_neu_y;
      var cf_neu_vor_y = miete_neu_y - bwk_neu_y - zins_neu_y - tilg_neu_y;

      sc.label    = 'Wachstum durch EK-Freisetzung';
      sc.struktur = freeEk > 0
        ? 'Bestand auf Ziel-LTV ' + Math.round(profileObj.ltv_target * 100) + '% (Profil "' + profileObj.label + '") beleihen → ~' + Math.round(freeEk).toLocaleString('de-DE') + ' € EK frei. Damit ' + neue_objekte + ' weitere Objekte (' + Math.round(neukauf_volumen).toLocaleString('de-DE') + ' € Volumen) zukaufen.'
        : 'Mit aktuellem Profil ist keine LTV-Aufstockung möglich. Bestand bereits an Ziel-LTV.';
      sc.stueck   = { privat: rows.length + neue_objekte, gmbh: 0, holding: 0 };

      // Aufstockungs-Kosten (Notar + GBA für Grundschuld-Erhöhung)
      var aufstockKosten = freeEk * 0.005;       // ~0,5% pauschal
      var nkErwerb = neukauf_volumen * 0.10;     // 10% NK je neuem Objekt (Makler+Notar+GrESt)
      sc.einmalkosten = { grest: nkErwerb * 0.6, notar: nkErwerb * 0.4 + aufstockKosten, summe: nkErwerb + aufstockKosten };

      // Combined-CF: bestehend (privat_basis) + neu
      var steuerJahr = []; var cfNach = [];
      for (var yi2 = 0; yi2 < H; yi2++) {
        var miete_b   = port.nkm_y * Math.pow(1 + inp.growth_rent_pa, yi2);
        var bwk_b     = port.bwk_y * Math.pow(1 + inp.growth_rent_pa, yi2);
        var inst_b    = port.instand_y * Math.pow(1.02, yi2);
        var zins_b    = port.zins_y * Math.pow(0.97, yi2);
        var tilg_b    = port.tilg_y * Math.pow(1.03, yi2);
        var afa_b     = port.afa_y;
        var vuv_b_y   = miete_b - bwk_b - inst_b - zins_b - afa_b;

        // Neukäufe addieren erst ab Jahr 2 (Käufe brauchen Zeit)
        var faktorN = yi2 === 0 ? 0 : 1;
        var miete_neu_t = miete_neu_y * faktorN * Math.pow(1 + inp.growth_rent_pa, Math.max(0, yi2 - 1));
        var bwk_neu_t   = bwk_neu_y * faktorN;
        var afa_neu_t   = afa_neu_y * faktorN;
        var zins_neu_t  = zins_neu_y * faktorN * Math.pow(0.97, Math.max(0, yi2 - 1));
        var tilg_neu_t  = tilg_neu_y * faktorN * Math.pow(1.03, Math.max(0, yi2 - 1));
        var vuv_neu_t   = miete_neu_t - bwk_neu_t - zins_neu_t - afa_neu_t;
        var cf_neu_vor_t= miete_neu_t - bwk_neu_t - zins_neu_t - tilg_neu_t;

        var st = _persoenlicheSteuerDelta(inp.base_income_zve, vuv_b_y + vuv_neu_t).delta;
        steuerJahr.push(st);
        cfNach.push((miete_b - bwk_b - inst_b - zins_b - tilg_b) + cf_neu_vor_t - st);
      }

      sc.jahr1 = {
        miete: port.nkm_y, // Jahr 1 noch ohne Neukäufe
        ueberschuss: port.vuv_y,
        steuer: steuerJahr[0],
        cf_n_st: cfNach[0] + freeEk - sc.einmalkosten.summe,  // EK-Freisetzung als sofortiger Inflow
        grenz: _persoenlicheSteuerDelta(inp.base_income_zve, port.vuv_y).grenz
      };
      // freeEk ist Cash-Inflow durch Aufstockung (kein Verkauf, keine Steuer)
      // Die NK-Kosten der Neukäufe werden aus diesem freigesetzten EK gedeckt.
      // Der NPV-Effekt: freeEk fließt sofort ein, die Neukäufe werden über die
      // nächsten Jahre rentabel.
      var npv_with_freed = freeEk + cfNach.reduce(function(s, v, i) { return s + v / Math.pow(1 + disc, i + 1); }, 0) - sc.einmalkosten.summe;
      sc.horizon = {
        jahre: H,
        cf_kum: cfNach.reduce(function(a, b) { return a + b; }, 0) - sc.einmalkosten.summe,
        ek_endwert: port.ek + freeEk * 0.7 + (port.kp + neukauf_volumen) * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: npv_with_freed,
        steuer_kum: steuerJahr.reduce(function(a, b) { return a + b; }, 0) + sc.einmalkosten.summe,
        ek_freigesetzt: freeEk,
        neue_objekte: neue_objekte
      };
      sc.pros = [
        freeEk > 0 ? '~' + Math.round(freeEk).toLocaleString('de-DE') + ' € EK aus Bestand freigesetzt — ohne Verkauf.' : 'Modell zeigt Potenzial bei Wertsteigerung.',
        'Skalierungs-Hebel: Neue Objekte erzeugen zusätzliche AfA + Mieteinnahmen.',
        'Bestand bleibt im Privatvermögen — §23-Frist nicht unterbrochen.'
      ];
      sc.cons = [
        'Höhere LTV = höheres Zinsänderungs- und Mietausfall-Risiko.',
        'Bankprüfung erforderlich — Aufstockung nicht garantiert.',
        'Annahme: Verkehrswert ist marktfähig (Beleihungswert ggf. niedriger).',
        'Profil-abhängig: Bei Profil "Sicherheit" geringer / nicht empfohlen.'
      ];
      sc.note = 'Voraussetzung: Bank stimmt Aufstockung zu UND Beleihungswert deckt LTV. Profil "' + profileObj.label + '" passt zu dieser Strategie ' + (profileObj.growth_weight >= 0.4 ? 'gut' : 'nur eingeschränkt') + '.';
    }

    // ─── 8. KONZERN_OPGMBH (V127, in V129 vereinfacht) ─────
    // Holding über mehreren VV-GmbHs + operative GmbH für Sanierung.
    // V129: Anzahl VV-GmbHs + Sanierungs­volumen werden aus Bestand
    // ABGELEITET, nicht mehr vom User getippt:
    //   – Anzahl VV-GmbHs: 1 pro 5-7 Objekte (Risikostreuung)
    //   – Op-GmbH-Volumen: Summe der erforderlichen Sanierungen
    //     basierend auf Sanstand 4-5 (~3% des KP p.a.)
    else if (key === 'konzern_opgmbh') {
      var profileObj_k = PROFILES[inp.profile] || PROFILES.cashflow;
      // Anzahl VV-GmbHs: 1 für ≤5 Objekte, 2 für 6-12, 3 für 13+
      var anzahl_vv = rows.length <= 5 ? 1 : (rows.length <= 12 ? 2 : 3);
      // Sanierungs­volumen: Objekte mit Sanstand ≥4 brauchen ~3% p.a.
      var op_san_y = rows
        .filter(function(r) { return r.sanstand >= 4; })
        .reduce(function(s, r) { return s + r.kp * 0.03; }, 0);
      var sa_anteil = 0.7;  // 70 % über Op-GmbH (Standard­annahme)

      sc.label    = 'Konzern: Holding + ' + anzahl_vv + '× VV-GmbH + Op-GmbH';
      sc.struktur = 'Holding hält ' + anzahl_vv + ' VV-GmbH(s) (jeweils mit Objekt-Bündel) sowie eine Operative GmbH (Sanierung, Vermarktung, Verwaltung). Op-GmbH fakturiert Leistungen an die VV-GmbHs zum Marktpreis (Fremdvergleich!).';
      sc.stueck   = { privat: 0, gmbh: rows.length, holding: 1, opgmbh: 1, vvgmbhs: anzahl_vv };

      // Einmalkosten: GrESt + Notar + Gründung mehrerer Hüllen
      var grest_konz = port.kp * (c.grest_satz_pct / 100);
      var notarG_konz = port.kp * (c.notar_grundbuch_pct / 100);
      var gruendung_konz = 1500 + 1500 * anzahl_vv + 1500;  // Holding + VVs + OpGmbH
      sc.einmalkosten = { grest: grest_konz, notar: notarG_konz + gruendung_konz, summe: grest_konz + notarG_konz + gruendung_konz };

      // Laufende Belastung
      // 1) VV-GmbHs zahlen: KSt + SolZ (erw. Kürzung greift)
      // 2) Op-GmbH bekommt einen Teil der Sanierungs- und Verwaltungs­leistungen
      //    als Umsatz, hat aber selbst Personal/Fahrtkosten/Material als BA
      // 3) Sanierung über Op-GmbH: typische Marge 15% Gewinn → KSt+GewSt darauf
      //    (Op-GmbH ist gewerblich, keine erw. Kürzung)
      // 4) Holding bekommt Ausschüttungen von Töchtern (95%-Privileg §8b KStG)
      var steuerJahr = []; var cfNach = [];
      for (var yi3 = 0; yi3 < H; yi3++) {
        var miete_g3   = port.nkm_y * Math.pow(1 + inp.growth_rent_pa, yi3);
        var bwk_g3     = port.bwk_y * Math.pow(1 + inp.growth_rent_pa, yi3);
        var inst_g3    = port.instand_y * Math.pow(1.02, yi3);
        var zins_g3    = port.zins_y * Math.pow(0.97, yi3);
        var tilg_g3    = port.tilg_y * Math.pow(1.03, yi3);
        var afa_g3     = port.afa_y;
        var vuv_g3     = miete_g3 - bwk_g3 - inst_g3 - zins_g3 - afa_g3;

        // VV-GmbH-Steuer (mit erw. Kürzung)
        var st_vv = _gmbhSteuerLaufend(Math.max(0, vuv_g3), { erwKuerzung: true }).total;

        // Op-GmbH-Effekt
        // Annahme: Op-GmbH bekommt sa_anteil der Sanierung als Umsatz,
        // hat 85% Kostenquote (Material+Personal+Fahrt) → 15% Marge.
        // Marge wird mit voller GmbH-Steuer (KSt+SolZ+GewSt) belastet.
        var op_umsatz = op_san_y * sa_anteil;
        var op_marge = op_umsatz * 0.15;
        var st_op = _gmbhSteuerLaufend(op_marge, { erwKuerzung: false }).total;
        // Vorteil: 85% des Sanierungs­volumens werden bei der Op-GmbH zur BA
        // (statt im Privatvermögen begrenzt durch §6(1)1a). Effektiver Hebel
        // ist die Differenz zwischen privater Behandlung und Op-GmbH.
        // Wir modellieren das als "zusätzliche Steuerersparnis":
        var op_vorteil_y = op_umsatz * 0.85 * 0.15; // 15% Steuerersparnis durch BA-Verlagerung
        var st_gesamt = st_vv + st_op - op_vorteil_y;
        steuerJahr.push(st_gesamt);
        cfNach.push((miete_g3 - bwk_g3 - inst_g3 - zins_g3 - tilg_g3) - st_gesamt);
      }

      sc.jahr1 = {
        miete: port.nkm_y * (1 + inp.growth_rent_pa),
        ueberschuss: port.vuv_y,
        steuer: steuerJahr[0],
        cf_n_st: cfNach[0],
        grenz: 0.158  // ungefähr KSt+SolZ
      };
      sc.horizon = {
        jahre: H,
        cf_kum: cfNach.reduce(function(a, b) { return a + b; }, 0) - sc.einmalkosten.summe,
        ek_endwert: port.ek + port.tilg_y * H * 1.1 + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: cfNach.reduce(function(s, v, i) { return s + v / Math.pow(1 + disc, i + 1); }, 0) - sc.einmalkosten.summe,
        steuer_kum: steuerJahr.reduce(function(a, b) { return a + b; }, 0) + sc.einmalkosten.summe,
        anzahl_vvgmbhs: anzahl_vv,
        op_san_y: op_san_y
      };
      sc.pros = [
        anzahl_vv > 1 ? 'Risikostreuung über ' + anzahl_vv + ' rechtlich getrennte VV-Hüllen.' : 'Saubere Separation Bestand vs. Operatives Geschäft.',
        'Op-GmbH macht Sanierung, Werbungs­kosten + Fahrtkosten + Personal werden BA.',
        'Op-GmbH kann gegenseitig Bürofläche von VV mieten (zusätzliche Mieteinnahme bei VV mit erw. Kürzung).',
        'Holding mit §8b KStG: Ausschüttungen Töchter → Mutter zu 95% steuerfrei für Folge-Investitionen.',
        'Skalierbar: Weitere VV-GmbHs können easy unter Holding gehängt werden.'
      ];
      sc.cons = [
        'Hohe Einmalkosten: ' + Math.round(sc.einmalkosten.summe).toLocaleString('de-DE') + ' € (GrESt + Notar + ' + (anzahl_vv + 2) + '× Gründungen).',
        'Laufende Verwaltungs­kosten: 5.000-10.000 €/J. (Buchhaltung, JA, Beratung).',
        'Fremdvergleichs­grundsatz: Op-GmbH muss Marktpreise nehmen, sonst vGA-Risiko.',
        'Op-GmbH gewerblich → KEINE erw. Kürzung möglich, voller GewSt-Satz.',
        'Lohnt sich erst ab ~' + c.opgmbh_min_objekte + ' Objekten oder Sanierungs­volumen >' + (c.opgmbh_min_san_volumen_y / 1000) + 'k €/J.'
      ];
      sc.note = 'Konzernstruktur ist die "Königsklasse" — sinnvoll für mittelfristigen Aufbau zum 8-stelligen Bestand. Strikte Steuerberatung erforderlich (vGA, Fremdvergleich, §6 EStG-Sperrfristen).';
    }

    // ─── 9. ROLLIERENDES_EK (V127: neu) ────────────────────
    // 1 Objekt aus Bestand wird als dauerhafter Beleihungs-Anker genutzt.
    // EK wird rollierend aus Wertsteigerungen freigesetzt.
    else if (key === 'rollierendes_ek') {
      var profileObj_r = PROFILES[inp.profile] || PROFILES.cashflow;
      // Anker = Objekt mit dem höchsten Verkehrswert UND niedrigem LTV
      var anker = rows.slice().sort(function(a, b) {
        var sa = a.verkehrswert * (1 - a.ltv_aktuell) - 0;
        var sb = b.verkehrswert * (1 - b.ltv_aktuell) - 0;
        return sb - sa;
      })[0];

      sc.label    = 'Rollierendes EK';
      sc.stueck   = { privat: rows.length, gmbh: 0, holding: 0 };

      if (!anker || anker.beleihungs_reserve < 50000) {
        sc.struktur = 'Im aktuellen Bestand kein Objekt mit ausreichender Beleihungs-Reserve als Daueranker (<50k €) vorhanden.';
        sc.einmalkosten = { grest: 0, notar: 0, summe: 0 };
        sc.jahr1 = { miete: port.nkm_y, ueberschuss: port.vuv_y, steuer: 0, cf_n_st: port.cf_vor_y, grenz: 0 };
        sc.horizon = { jahre: H, cf_kum: 0, ek_endwert: port.ek, npv: 0, steuer_kum: 0 };
        sc.pros = ['Konzeptionell sinnvoll — aber Voraussetzung Anker-Objekt fehlt aktuell.'];
        sc.cons = ['Bestehende Objekte bereits höher beleihbar oder Verkehrswert zu niedrig.'];
        sc.note = 'Strategie wieder prüfen, sobald ein Objekt durch Sanierung/Mietsteigerung deutlich aufgewertet wurde.';
      } else {
        // Anker beleihen: Reserve frei + zusätzliche Mietsteigerungs-Hebel über die Jahre
        var anker_beleih = anker.beleihungs_reserve;
        // Annahme: Bank gibt nach 3 Jahren bei guter Performance weitere 30% der Reserve frei
        // Strategie: alle 3 Jahre re-bewerten lassen, Beleihung erweitern
        sc.struktur = 'Anker-Objekt: ' + anker.kuerzel + ' (Verkehrswert ' + Math.round(anker.verkehrswert).toLocaleString('de-DE') + ' €, LTV ' + Math.round(anker.ltv_aktuell * 100) + '%). Beleihung initial ~' + Math.round(anker_beleih).toLocaleString('de-DE') + ' € freisetzen, alle 3 Jahre Werterhöhung re-prüfen und Linie erweitern.';
        sc.einmalkosten = { grest: 0, notar: anker_beleih * 0.005, summe: anker_beleih * 0.005 };

        // Annahme: jeder freigesetzte EK fließt in Neukäufe mit 5% n.St.-Rendite
        // Re-Bewertung alle 3 Jahre bringt zusätzliche 25% der Initial-Linie
        var freigaben_y = []; // pro Jahr neu freigesetztes EK
        var akkumuliertes_ek = anker_beleih;
        for (var yir = 0; yir < H; yir++) {
          if (yir === 0) freigaben_y.push(anker_beleih);
          else if (yir % 3 === 0) {
            var neue_freigabe = akkumuliertes_ek * 0.25;
            akkumuliertes_ek += neue_freigabe;
            freigaben_y.push(neue_freigabe);
          } else freigaben_y.push(0);
        }
        // Jeder freigesetzte EK-Block wird investiert mit 5% Return p.a.
        var total_invested = 0;
        var return_y = [];
        for (var yir2 = 0; yir2 < H; yir2++) {
          total_invested += freigaben_y[yir2];
          return_y.push(total_invested * 0.05);
        }
        // Bestand-CF (wie privat_basis) + Roll-EK-Returns
        var steuerJahr_r = []; var cfNach_r = [];
        for (var yir3 = 0; yir3 < H; yir3++) {
          var miete_r   = port.nkm_y * Math.pow(1 + inp.growth_rent_pa, yir3);
          var bwk_r     = port.bwk_y * Math.pow(1 + inp.growth_rent_pa, yir3);
          var inst_r    = port.instand_y * Math.pow(1.02, yir3);
          var zins_r    = port.zins_y * Math.pow(0.97, yir3);
          var tilg_r    = port.tilg_y * Math.pow(1.03, yir3);
          var afa_r     = port.afa_y;
          var vuv_r     = miete_r - bwk_r - inst_r - zins_r - afa_r;
          var st_r      = _persoenlicheSteuerDelta(inp.base_income_zve, vuv_r).delta;
          var cf_v_r    = miete_r - bwk_r - inst_r - zins_r - tilg_r;
          steuerJahr_r.push(st_r);
          cfNach_r.push(cf_v_r - st_r + return_y[yir3]);
        }

        sc.jahr1 = {
          miete: port.nkm_y * (1 + inp.growth_rent_pa),
          ueberschuss: port.vuv_y,
          steuer: steuerJahr_r[0],
          cf_n_st: cfNach_r[0] + anker_beleih - sc.einmalkosten.summe,  // EK-Freisetzung als Inflow
          grenz: _persoenlicheSteuerDelta(inp.base_income_zve, port.vuv_y).grenz
        };
        sc.horizon = {
          jahre: H,
          cf_kum: cfNach_r.reduce(function(a, b) { return a + b; }, 0) - sc.einmalkosten.summe,
          ek_endwert: port.ek + total_invested * 0.5 + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
          npv: anker_beleih + cfNach_r.reduce(function(s, v, i) { return s + v / Math.pow(1 + disc, i + 1); }, 0) - sc.einmalkosten.summe,
          steuer_kum: steuerJahr_r.reduce(function(a, b) { return a + b; }, 0) + sc.einmalkosten.summe,
          anker_kuerzel: anker.kuerzel,
          anker_initial_freigabe: anker_beleih,
          total_invested: total_invested
        };
        sc.pros = [
          'Nur 1 Objekt als Daueranker — Risiko fokussiert, nicht über das Portfolio gestreut.',
          'Re-Bewertungen alle 3 Jahre ermöglichen rollierendes Wachstum.',
          'Spekulationsfrist wird nicht unterbrochen (kein Verkauf, nur Beleihung).',
          'Bestand bleibt steuerlich unverändert (kein Strukturwechsel).'
        ];
        sc.cons = [
          'Cluster-Risiko am Anker-Objekt — Wertverlust trifft Beleihungs­linie.',
          'Bank-Mitarbeit erforderlich: nicht jede Bank gibt rollierende Linien.',
          'Höhere Gesamtverschuldung — bei Zinsänderung schwerer Stress.',
          'Zinsen auf die Linie sind Werbungs­kosten — aber nur wenn der Verwendungs­zweck V+V ist (Verwendungs­dokumentation!).'
        ];
        sc.note = 'Bank-Verhandlungs­strategie: Linie als "Investitions­kreditrahmen" gegen Grundschuld auf Anker-Objekt formulieren. Gegenfinanzierung muss V+V-bezogen dokumentiert sein, sonst keine WK-Anerkennung.';
      }
    }

    // ─── 10. STRETCH_SANIERUNG (V127: neu) ─────────────────
    // Zwei Sub-Hebel:
    //   (a) Innerhalb der 15%-Frist Erhaltungs­aufwand maximal nutzen
    //   (b) Bei NEUEM Kauf: Nutzen-Lasten verschieben + vor Übergang sanieren
    else if (key === 'stretch_sanierung') {
      var profileObj_s = PROFILES[inp.profile] || PROFILES.cashflow;

      // (a) Bestand: Objekte in 15%-Frist + Sanstand >=3 → Erhaltung maximieren
      var kandidaten_15 = rows.filter(function(r) {
        return r.an15_aktiv && r.an15_rest > 5000 && r.sanstand >= 3;
      });
      var max_erhaltung_y = kandidaten_15.reduce(function(s, r) { return s + r.an15_rest; }, 0);
      var grenz_typ = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
        ? Tax.calcGrenzsteuersatz(inp.base_income_zve)
        : 0.42;
      var st_erspar_a = max_erhaltung_y * grenz_typ;

      sc.label    = 'Stretch-Sanierung (15%-Hebel + Vor-Erwerb)';
      sc.struktur = kandidaten_15.length > 0
        ? 'Maximales Erhaltungs­volumen ~' + Math.round(max_erhaltung_y).toLocaleString('de-DE') + ' € auf ' + kandidaten_15.length + ' Objekt(e) in der 3-Jahres-Frist (§6 (1) Nr. 1a EStG). Plus: Bei Neukäufen den Nutzen-Lasten-Wechsel um bis zu 12 Monate verschieben — Sanierung in der Zwischenzeit.'
        : 'Aktuell kein Objekt mehr in der 15%-Frist (>3 Jahre Halte­dauer). Hebel nur für Neukäufe nutzbar.';
      sc.stueck   = { privat: rows.length, gmbh: 0, holding: 0 };
      sc.einmalkosten = { grest: 0, notar: 0, summe: 0 };

      // CF-Effekt: Erhaltungsaufwand reduziert V+V → Steuererstattung im Jahr 1
      // Annahme: das Sanierungs­volumen wird im ersten Jahr ausgegeben
      var steuerJahr_s = []; var cfNach_s = [];
      for (var yis = 0; yis < H; yis++) {
        var miete_s   = port.nkm_y * Math.pow(1 + inp.growth_rent_pa, yis);
        var bwk_s     = port.bwk_y * Math.pow(1 + inp.growth_rent_pa, yis);
        var inst_s    = port.instand_y * Math.pow(1.02, yis);
        var zins_s    = port.zins_y * Math.pow(0.97, yis);
        var tilg_s    = port.tilg_y * Math.pow(1.03, yis);
        var afa_s     = port.afa_y;
        var erh_s     = yis === 0 ? max_erhaltung_y : 0;  // im ersten Jahr ausgeben
        var vuv_s     = miete_s - bwk_s - inst_s - zins_s - afa_s - erh_s;
        var st_s      = _persoenlicheSteuerDelta(inp.base_income_zve, vuv_s).delta;
        var cf_v_s    = miete_s - bwk_s - inst_s - zins_s - tilg_s - erh_s;
        steuerJahr_s.push(st_s);
        cfNach_s.push(cf_v_s - st_s);
      }

      sc.jahr1 = {
        miete: port.nkm_y,
        ueberschuss: port.vuv_y - max_erhaltung_y,
        steuer: steuerJahr_s[0],
        cf_n_st: cfNach_s[0],
        grenz: grenz_typ
      };
      sc.horizon = {
        jahre: H,
        cf_kum: cfNach_s.reduce(function(a, b) { return a + b; }, 0),
        ek_endwert: port.ek + max_erhaltung_y * 0.5 + port.kp * (Math.pow(1 + inp.growth_value_pa, H) - 1),
        npv: cfNach_s.reduce(function(s, v, i) { return s + v / Math.pow(1 + disc, i + 1); }, 0),
        steuer_kum: steuerJahr_s.reduce(function(a, b) { return a + b; }, 0),
        max_erhaltung: max_erhaltung_y,
        st_erspar_J1: st_erspar_a
      };
      sc.pros = [
        kandidaten_15.length > 0 ? 'Sofort-Steuerersparnis im Jahr 1: ~' + Math.round(st_erspar_a).toLocaleString('de-DE') + ' €.' : 'Hebel für ALLE zukünftigen Käufe nutzbar.',
        'Voll abziehbar (kein §82b-Verteilung nötig) — Liquidität sofort verfügbar.',
        'Nutzen-Lasten-Verschiebung: Sanierung VOR Eigentums­übergang ist NICHT anschaffungsnah, aber wirkt auf späteren Wert/Miete.',
        'Lohnsteuer­ermäßigungs­antrag möglich — höhere Liquidität laufend, nicht erst nach Veranlagung.'
      ];
      sc.cons = [
        '15%-Grenze ist hart — Überschreitung = Umqualifizierung in Anschaffungs­kosten (nur AfA).',
        'Bei Nutzen-Lasten-Verschiebung: BFH-Rechtsprechung zum wirtschaftlichen Eigentum genau prüfen (Vorsicht!).',
        'Sanierung zwischen Kauf und Übergang: Verkäufer muss zustimmen, Notar muss das sauber aufsetzen.',
        'Volle Sofort-Sanierung kann Liquidität strapazieren (besser §82b auf 5 J. verteilen?).'
      ];
      sc.note = 'BFH IX R 25/19 zur Aufteilung von Erhaltungs- und Anschaffungs­aufwand beachten. Bei Nutzen-Lasten-Verschiebung ggf. Schenkungs- bzw. Bereicherungs­diskussion mit Verkäufer.';
    }

    // Risk-Faktor (V126): wird im Score genutzt um zu steuern, wie
    // ein Szenario zum Profil passt (Sicherheit vs. Aggressiv).
    // Skala 0..1: 0 = niedriges Risiko, 1 = sehr riskant.
    sc.risk_factor = _deriveRiskFactor(sc, port, key);

    // Stärken/Schwächen-Score (rein indikativ)
    sc.score = _scenarioScore(sc);
    return sc;
  }

  function _deriveRiskFactor(sc, port, key) {
    var risk = 0;
    // LTV-getriebenes Risiko: Wachstum-Strategie hebelt LTV
    if (key === 'wachstum_ltv') risk += 0.6;
    // GmbH-Komplettumzug = hohe Einmalkosten + Strukturrisiko
    if (key === 'vvgmbh_komplett') risk += 0.4;
    if (key === 'holding_struktur') risk += 0.5;
    // Selektiv = niedriges Risiko, abhängig davon, wie viele umgehängt werden
    if (key === 'vvgmbh_selektiv') {
      risk += (sc.stueck.gmbh / Math.max(1, sc.stueck.gmbh + sc.stueck.privat)) * 0.3;
    }
    // Neue GmbH-Schale alleine = minimales Risiko
    if (key === 'vvgmbh_neu') risk += 0.1;
    // V127-Szenarien
    if (key === 'konzern_opgmbh') risk += 0.7;          // höchstes Strukturrisiko
    if (key === 'rollierendes_ek') risk += 0.4;         // Cluster-Risiko Anker
    if (key === 'stretch_sanierung') risk += 0.2;       // mittleres Risiko (BFH-Klarheit)
    // Hohe Einmalkosten relativ zum Portfolio
    if (port.kp > 0 && sc.einmalkosten.summe / port.kp > 0.05) risk += 0.2;
    return Math.max(0, Math.min(1, risk));
  }

  function _scenarioScore(sc, profile) {
    // Profil-gewichteter Score 0..100.
    // Komponenten:
    //   – NPV: stärkster Treiber, skaliert nach growth/cashflow weight
    //   – Steuerlast: Penalty (gewichtet mit tax_weight)
    //   – Einmalkosten: Penalty, abgemildert bei niedriger complexity_penalty
    //   – Risiko-Penalty (sc.risk_factor 0..1) skaliert invers mit growth_weight:
    //     Sicherheit straft Risiko hart, Aggressiv ignoriert es weitgehend
    //   – Komplexitäts-Strafe (Holding > GmbH > Privat)
    var p = profile || PROFILES[_state.inputs.profile] || PROFILES.cashflow;
    var npv_faktor = 30 + (p.cashflow_weight + p.growth_weight) * 30;
    var npvN = (sc.horizon.npv / 100000) * npv_faktor;
    var stN  = -(sc.horizon.steuer_kum / 200000) * 25 * p.tax_weight;
    var einmal_faktor = 15 * (1 - p.growth_weight * 0.5);
    var einN = -(sc.einmalkosten.summe / 50000) * einmal_faktor;
    var komplexN = -(sc.stueck.holding * 8 + sc.stueck.gmbh * 0.5) * p.complexity_penalty;
    // Risk-Penalty: hochgehebelte Strategien werden bei Sicherheit hart bestraft
    // sc.risk_factor: 0 = sicher, 1 = sehr riskant; Skalierung: -30 bei Sicherheit, ~0 bei Aggressiv
    var risk = sc.risk_factor || 0;
    var riskN = -risk * 50 * (1 - p.growth_weight);
    var raw = 50 + npvN + stN + einN + komplexN + riskN;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  // ── HAUPT-API ───────────────────────────────────────────────────
  // ── V131: §-GLOSSAR (ausführliche Erklärungen) ──────────────────
  // Pro Paragraph: was ist es, warum wichtig, wann anwenden, Risiken.
  // Wird in der UI als ausklappbarer Block am Ende dargestellt + die
  // Strategien können auf einzelne Einträge verweisen.
  // ── V133: GMBH-TIER-SYSTEM ──────────────────────────────────────
  // Stufung des V+V-Überschusses in 5 Tiers (0..4).
  // Berücksichtigt zusätzlich: bestehende Struktur, Skalierungs-Plan,
  // persönlicher Grenzsteuersatz.
  var GMBH_TIERS = [
    {
      tier: 0,
      key: 'tier0',
      name: 'Tier 0 — Privat halten',
      headline: 'GmbH lohnt sich nicht',
      vuv_label: '< 12k €/J',
      vuv_range: [0, 12000],
      braucht: [],
      label: 'Privat halten',
      kurz: 'GmbH lohnt nicht',
      vuv_min: 0,
      vuv_max: 12000,
      detail: 'V+V-Überschuss unter 12k €/J — die GmbH-Strukturkosten (~3.000 €/J) übersteigen jeden Steuer-Vorteil.',
      empfehlung: 'V+V im Privat­vermögen optimieren. AfA via RND-Gutachten, §82b-Verteilung, §6(1)1a-Hebel beim Neukauf. §23-Steuer­freiheit nach 10 J. abwarten.',
      vorteile: ['§23 EStG: Verkauf nach 10 J. einkommen­steuer­frei', 'Kein Buchhaltungs­aufwand', 'Volle Werbungs­kosten-Anerkennung'],
      nachteile: ['Voller Spitzen­steuersatz auf laufende Mieten', 'Keine Erbschafts­steuer-Verschonung', 'Bei 4. Verkauf in 5 J: gewerblicher Grundstücks­handel-Risiko']
    },
    {
      tier: 1,
      key: 'tier1',
      name: 'Tier 1 — Nur wenn GmbH schon da',
      headline: 'Bei bestehender GmbH neue Käufe darüber abwickeln',
      vuv_label: '12k–25k €/J',
      vuv_range: [12000, 25000],
      braucht: ['Bestehende VV-GmbH-Struktur (eigene oder Familie/Partner)'],
      label: 'GmbH NUR bei vorhandener Struktur',
      kurz: 'Neugründung lohnt nicht',
      vuv_min: 12000,
      vuv_max: 25000,
      detail: 'V+V-Überschuss 12-25k €/J — bei vorhandener GmbH/Holding lohnt sich die zusätzliche Nutzung. Für Neugründung zu klein.',
      empfehlung: 'Wenn GmbH/Holding bereits existiert: Neukäufe in die bestehende Hülle. Bei Neugründung: noch zu klein. Vorher Bestand vergrößern.',
      vorteile: ['Bei vorhandener Hülle: zusätzlicher V+V-Hebel', 'Steuer­last auf Mieten 15,8 % statt persönlich'],
      nachteile: ['Ohne Hülle: Setup nicht wirtschaftlich', 'GrESt 3,5-6,5 % bei Einbringung von Bestand', '§23-Frist startet in der GmbH neu']
    },
    {
      tier: 2,
      key: 'tier2',
      name: 'Tier 2 — Neu-Gründung lohnt',
      headline: 'Jetzt VV-GmbH gründen',
      vuv_label: '25k–50k €/J',
      vuv_range: [25000, 50000],
      braucht: ['~1.500 € Setup (Notar + HRB + IHK)', '25.000 € Stamm­einlage (oder UG mit 1 €)', 'Steuerberater mit Immobilien-GmbH-Erfahrung'],
      label: 'Neugründung sinnvoll',
      kurz: 'Break-Even erreicht',
      vuv_min: 25000,
      vuv_max: 50000,
      detail: 'V+V-Überschuss 25-50k €/J — Break-Even für Neugründung erreicht.',
      empfehlung: 'VV-GmbH-Neugründung lohnt sich. Erweiterte Kürzung §9 Nr. 1 S. 2 GewStG beim FA beantragen. Bestand­objekte privat lassen, nur Neukäufe in die GmbH.',
      vorteile: ['~9-13k €/J Steuer­vorteil bei 35k V+V', 'Saubere Trennung Privat / Geschäft', 'Skalierungs­vehikel für Folge­käufe'],
      nachteile: ['~3.500 €/J laufende Kosten', 'Buchhaltung + Jahres­abschluss + Bundes­anzeiger', 'Geld in GmbH ≠ frei verfügbar (Ausschüttung mit KapESt 26,4 %)']
    },
    {
      tier: 3,
      key: 'tier3',
      name: 'Tier 3 — Klar lohnenswert',
      headline: 'VV-GmbH + Holding-Aufbau prüfen',
      vuv_label: '50k–100k €/J',
      vuv_range: [50000, 100000],
      braucht: ['Bestehende oder neu gegründete VV-GmbH', 'Zusätzlich Holding-GmbH (~1.500 € Gründung)', 'Notar + Steuerberater für Anteils-Einbringung'],
      label: 'GmbH klar lohnenswert · Holding prüfen',
      kurz: 'Strukturwechsel sehr empfohlen',
      vuv_min: 50000,
      vuv_max: 100000,
      detail: 'V+V-Überschuss 50-100k €/J — klarer Vorteil. Strukturwechsel bringt 5-stellige Beträge pro Jahr.',
      empfehlung: 'VV-GmbH ist klare Wahl. Parallel Holding aufsetzen für §8b KStG (95 % der Tochter-Ausschüttungen steuerfrei) und §13a/§13b ErbStG-Verschonung.',
      vorteile: ['~16-26k €/J Steuer­vorteil bei 75k V+V', 'Holding-Privileg §8b KStG', 'Fast volle Reinvestitions­quote', 'Erbschafts­verschonung greifbar'],
      nachteile: ['Doppelter Buchhaltungs­aufwand (VV + Holding)', 'Sperrfristen §6 Abs. 5 EStG bei Strukturen­änderungen', 'Komplexität in der Buchführung steigt']
    },
    {
      tier: 4,
      key: 'tier4',
      name: 'Tier 4 — Königsklasse',
      headline: 'Konzern: Holding + VV-GmbH + Op-GmbH',
      vuv_label: '> 100k €/J',
      vuv_range: [100000, 1e9],
      braucht: ['Mind. 3 GmbH-Hüllen (Holding + VV + Op)', 'Steuerberater mit Konzern-Erfahrung', 'Fach­anwalt für Erbrecht für Generations-Planung'],
      label: 'Konzern­struktur',
      kurz: 'Holding + VV + ggf. Op-GmbH',
      vuv_min: 100000,
      vuv_max: null,
      detail: 'V+V-Überschuss >100k €/J — Konzern­struktur lohnt sich (Holding + VV-GmbH(s) + ggf. Op-GmbH).',
      empfehlung: 'Volle Konzern­struktur: Holding obenauf, eine oder mehrere VV-GmbHs darunter, separate Op-GmbH für gewerbliche Neben­tätigkeiten.',
      vorteile: ['~33k+ €/J Steuer­vorteil bei 150k V+V', 'Saubere Trennung gewerblich/vermögens­verwaltend', 'Maximale ErbSt-Verschonung', 'Einfache Veräußerung (Anteils­verkauf statt Asset-Verkauf)'],
      nachteile: ['~6.000 €/J Buchhaltung (zwei Hüllen)', 'Steuer­berater mit Holding-Erfahrung zwingend', 'vGA-Risiko bei GF-Vergütungen', 'Verwaltungs­vermögens­quote >90 % aktiv überwachen']
    }
  ];

  function _findGmbhTier(vuv_y) {
    var v = Math.max(0, vuv_y || 0);
    for (var i = GMBH_TIERS.length - 1; i >= 0; i--) {
      var t = GMBH_TIERS[i];
      if (t.vuv_max == null && v >= t.vuv_min) return t;
      if (v >= t.vuv_min && v < t.vuv_max) return t;
    }
    return GMBH_TIERS[0];
  }

  // Wirtschaftlichkeits-Rechnung GmbH vs. Privat
  function _calcGmbhVorteil(vuv_y, baseZvE, gmbhKostenJ) {
    var grenz = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
      ? Tax.calcGrenzsteuersatz((baseZvE || 0) + (vuv_y || 0))
      : 0.42;
    var gmbhSatz = 0.158;  // KSt 15 % + SolZ 5,5 % auf KSt = 15,825 %
    var brutto = Math.max(0, (vuv_y || 0) * (grenz - gmbhSatz));
    var netto = brutto - (gmbhKostenJ || 3000);
    return { grenz: grenz, brutto: brutto, netto: netto };
  }

  function _findGmbhTier(vuv_y) {
    var v = Math.max(0, vuv_y || 0);
    for (var i = GMBH_TIERS.length - 1; i >= 0; i--) {
      var t = GMBH_TIERS[i];
      if (t.vuv_max == null && v >= t.vuv_min) return t;
      if (v >= t.vuv_min && v < t.vuv_max) return t;
    }
    return GMBH_TIERS[0];
  }


  // V133: Helper — konkrete Wirtschaftlichkeits-Rechnung für die aktuelle Person
  function _calcGmbhVorteil(vuvY, baseZvE, gmbhKostenJ) {
    if (vuvY <= 0) return { brutto: 0, netto: -gmbhKostenJ, grenz: 0, gmbhKosten: gmbhKostenJ };
    var grenzPriv = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
      ? Tax.calcGrenzsteuersatz(baseZvE + vuvY) : 0.42;
    var gmbhSteuer = 0.158;  // KSt 15% + SolZ 5,5% = ~15,825%
    var brutto = vuvY * (grenzPriv - gmbhSteuer);
    var netto = brutto - gmbhKostenJ;
    return { brutto: brutto, netto: netto, grenz: grenzPriv, gmbhKosten: gmbhKostenJ };
  }

  // Adjusted-Tier: berücksichtigt zusätzliche Faktoren
  // (vorhandene Struktur, hoher Grenz­steuersatz)
  function _gmbhTierAdjusted(vuv_y, ctx) {
    var base = _findGmbhTier(vuv_y);
    if (!ctx) return { base: base, effective: base, hint: null };
    var hints = [];
    var idx = base.tier;

    // Wenn schon Struktur vorhanden: Tier praktisch -1 (Setup-Kosten weg)
    if (ctx.hat_struktur && ctx.hat_struktur !== 'keine' && idx > 0) {
      idx = Math.max(0, idx - 1);
      hints.push('Bestehende Struktur senkt die Schwelle um ein Tier (Setup-Kosten entfallen).');
    }
    // Wenn Spitzen­steuersatz (>=44 %): Tier praktisch +0,5
    if (ctx.grenz && ctx.grenz >= 0.44 && idx < GMBH_TIERS.length - 1) {
      hints.push('Hoher Grenz­steuersatz (' + Math.round(ctx.grenz * 100) + ' %) verstärkt den GmbH-Vorteil — Tier-Empfehlung greift früher.');
    }
    return {
      base: base,
      effective: GMBH_TIERS[idx],
      hint: hints.length > 0 ? hints.join(' ') : null
    };
  }

  var PARAGRAPH_GLOSSARY = {
    '7_4_estg': {
      titel: '§7 Abs. 4 EStG — Lineare AfA für Wohngebäude',
      kurz: '2 % p.a. (50 J) Standard, 2,5 % bei Bj. vor 1925, 3 % bei Bj. ab 2023',
      lang: 'Die lineare Gebäude-AfA. Wohngebäude werden über 50 Jahre abgeschrieben (2 % p.a.) — bei Baujahren vor 1925 über 40 Jahre (2,5 %). Für Neubau-Mietwohnungen mit Bauantrag/Anzeige ab 01.10.2023 gilt 3 % über 33 Jahre. Wenn die tatsächliche Restnutzungsdauer kürzer ist, kann sie via Gutachten geltend gemacht werden — siehe §7 Abs. 4 Satz 2 EStG.',
      anwendung: 'Greift bei JEDEM vermieteten Wohngebäude automatisch. Höhere AfA = mehr Werbungskosten = niedrigere Steuer. Standard-Hebel: bei 200k Gebäudeanteil und 42% Grenzsteuer ~1.680 €/J Steuerersparnis aus AfA.',
      risiko: 'Keine — gesetzlich abgesichert. Nur Grundstücksanteil ist nicht abschreibbar.'
    },
    '7_4_satz_2_estg': {
      titel: '§7 Abs. 4 Satz 2 EStG — Kürzere Nutzungsdauer (RND-Gutachten)',
      kurz: 'Tatsächliche RND statt 50-J-Standard via qualifiziertem Gutachten',
      lang: 'Wenn die tatsächliche Restnutzungs­dauer eines Gebäudes kürzer ist als die 50/40-Jahres-Pauschale, kann sie per qualifiziertem Sachverständigen­gutachten nachgewiesen werden. Das BFH-Urteil IX R 25/19 (28.07.2021) hat klargestellt, dass JEDES Wertgutachten nach anerkannter Methode (z.B. nach Ross/Brachmann/Holzner-Methode oder ImmoWertV) ausreicht — keine zwingende Vor-Ort-Besichtigung. ',
      anwendung: 'Für jedes ältere Objekt prüfen — gerade Bj. 1980-2000 mit unsanierten Gewerken. Bei einer RND von 21 J statt 50 J: AfA-Quote 4,76 % statt 2 % → bei 200k Gebäudeanteil ~5.520 €/J mehr Werbungs­kosten.',
      risiko: 'Gutachten 800-1.500 €. Bundesrat hatte 2024 Verschärfung (Vor-Ort-Pflicht, 20%-Schwelle) vorgeschlagen — am 22.11.2024 vom Bundestag NICHT übernommen. Aktuelle Rechtslage gilt weiter, Gesetz­geber kann jederzeit erneut ansetzen — daher zeitnah handeln. Steuerbescheide bleiben bis zur Bestandskraft änderbar.'
    },
    '6_1_1a_estg': {
      titel: '§6 Abs. 1 Nr. 1a EStG — Anschaffungsnahe Aufwendungen',
      kurz: '15 %-Grenze: Sanierung in den ersten 3 J nach Kauf — sofort oder als AHK',
      lang: 'Innerhalb der ersten 3 Jahre nach Anschaffung dürfen die Sanierungs- und Modernisierungs­kosten 15 % der Gebäude-Anschaffungs­kosten (netto, ohne USt) nicht überschreiten. Wenn doch: alle in diesem Zeitraum anfallenden Kosten werden in nachträgliche Anschaffungs­kosten umqualifiziert — kein Sofortabzug, sondern AfA über die Restnutzungs­dauer. ',
      anwendung: 'Bei Neukäufen GEZIELT die Grenze nutzen: Sanierungen so timen, dass im 3-Jahres-Fenster das Maximum bis 15 % als Erhaltungs­aufwand abgesetzt wird. Beispiel: 200k Gebäudeanteil → 30k € Sanierung im Fenster sind voll Werbungskosten. Bei 42% Grenzsteuersatz = 12.600 € Sofort-Steuerersparnis.',
      risiko: 'Reine Erhaltungs­arbeiten (Schönheits­reparaturen, Reparaturen — z.B. tropfender Wasser­hahn) zählen NICHT mit. Standardmäßig auch nicht: Ausbauten/Erweiterungen (= Herstellungs­kosten). BFH IX R 25/14 zur Aufteilung beachten. Ab Tag 1 nach Kauf läuft die Frist — am besten saniert man VOR dem Kauf (Nutzen-Lasten-Verschiebung).'
    },
    '11_2_estg': {
      titel: '§11 Abs. 2 EStG — Zufluss-/Abfluss-Prinzip',
      kurz: 'Werbungskosten zählen im Jahr des Abflusses (Bezahlung)',
      lang: 'Im Privatvermögen (V+V) werden Einnahmen im Jahr des Zuflusses, Ausgaben im Jahr des Abflusses (= Bezahlung) erfasst. Bedeutet: durch Verschieben von Zahlungen vor/nach 31.12. lässt sich die Steuer­belastung zwischen zwei Jahren bewusst steuern. Beispiel: Heizungs­tausch im Dezember zahlen → Werbungs­kosten dieses Jahr. Oder im Januar zahlen → Folgejahr.',
      anwendung: 'Ende-Q4-Strategie: Jahres­ausblick prüfen — wenn dieses Jahr hohes zvE, anstehende Sanierungen vorziehen. Wenn niedriges zvE (z.B. nach Job-Wechsel, Sabbatical, Geburt), Zahlungen ins Folgejahr legen. 10-Tage-Regel: Regelmäßige Zahlungen (Versicherung, Hausgeld) gelten bei Zahlung 21.12.-10.01. dem wirtschaftlich richtigen Jahr zugehörig (BFH IX R 13/19).',
      risiko: 'Nicht für Sonderaus­gaben/außer­gewöhnliche Belastungen (andere Regeln). Buchhalterisch Anweisung an Hausverwalter genau dokumentieren.'
    },
    '82b_estdv': {
      titel: '§82b EStDV — Verteilung größerer Erhaltungs­aufwendungen',
      kurz: 'Erhaltungs­aufwand auf 2-5 Jahre verteilen statt sofort',
      lang: 'Größere Erhaltungs­aufwendungen (Heizung, Dach, Fassade) können auf gleichmäßige Beträge in 2-5 Jahren verteilt werden — Wahlrecht des Steuer­pflichtigen. Greift NUR im Privatvermögen (V+V), nicht im Betriebsvermögen. Voraussetzung: Erhaltungs­aufwand >3.000 € pro Maßnahme, mind. 5 Jahre Halte­dauer geplant.',
      anwendung: 'Wenn Grenz­steuersatz im laufenden Jahr niedrig ist, aber in den Folge­jahren steigen wird (z.B. Lohnsteuer­tabelle wechselt, Mieter­erhöhung, Job-Wechsel zu höherem Gehalt) — Aufwand verteilen, höhere Wirkung später. Auch sinnvoll, wenn der V+V-Verlust sonst nicht voll mit anderen Einkünften verrechen­bar wäre.',
      risiko: 'Wahlrecht ist im Jahr der Aufwendung auszuüben — danach nicht mehr änderbar. Bei Verkauf vor Ablauf der Verteilungs­zeit: Restbetrag im Verkaufsjahr abzuziehen.'
    },
    '6b_estg': {
      titel: '§6b EStG — Reinvestitions-Rücklage',
      kurz: 'Veräußerungs­gewinn aus BV auf neues Anlage­vermögen übertragen',
      lang: 'Im Betriebsvermögen (GmbH oder gewerbliche Vermietung): Gewinn aus dem Verkauf von Grund und Boden, Gebäuden oder Aufwuchs kann in eine Reinvestitions-Rücklage überführt werden statt sofort versteuert. Auflösung erfolgt durch Übertragung auf neue Reinvestitions-Objekte — bis zu 4 Jahre, bei Hochbauten 6 Jahre Frist.',
      anwendung: 'Bei Verkauf einer GmbH-Immobilie mit Gewinn: 100k € Steuer­aufschiebung möglich. Voraussetzung: 6 Jahre Halte­dauer, Reinvestition in inländisches Anlage­vermögen. Achtung: nur in der GmbH, NICHT bei privater V+V (dort Verkauf nach §23 ohnehin steuerfrei nach 10 J).',
      risiko: 'Wenn keine Reinvestition rechtzeitig: Auflösung mit Gewinn­zuschlag von 6 % p.a. Komplexe Bilanzierung — Steuerberater zwingend.'
    },
    '35a_35c_estg': {
      titel: '§35a / §35c EStG — Handwerker- und Sanierungs-Steuer­ermäßigung',
      kurz: '20 % der Lohnkosten direkt, +35c bei energetischer Sanierung',
      lang: '§35a: 20 % der Lohn-, Maschinen- und Fahrtkosten von Hand­werkern (NICHT Material) als direkte Steuer­ermäßigung — max. 1.200 €/J. Greift NUR bei selbst genutztem Wohnraum bzw. Eigennutzungs­anteil. §35c (zusätzlich): bei energetischer Sanierung 7 % der Kosten in Jahr 1+2, 6 % in Jahr 3 — max. 40.000 € Steuer­ermäßigung über 3 Jahre, pro Objekt einmalig.',
      anwendung: 'Bei Mischnutzung (Mehrfamilien­haus mit Eigennutzungs-Wohnung): den Eigennutzungs-Anteil herausrechnen → §35a/c anwendbar. Bei reiner V+V: Lohn­kosten als Werbungs­kosten (Erhaltungs­aufwand), §35c nicht anwendbar. Beim Übergang ins Eigennutzungs-Modell daran denken.',
      risiko: 'Voraussetzung: Rechnung + Über­weisung (KEIN Bargeld!), Lohn­anteil getrennt aus­gewiesen. §35c nur bei mehr als 10 J alten Gebäuden, Bescheinigung des Fach­unternehmens nach §88 EStDV erforderlich, Nicht kombinier­bar mit KfW-Förderung gleicher Maßnahme.'
    },
    '7h_7i_estg': {
      titel: '§7h / §7i EStG — Sanierungs­gebiet / Denkmalschutz-AfA',
      kurz: '9 % über 8 J + 7 % über 4 J auf Sanierungs­aufwand',
      lang: '§7h: bei förmlich festgelegten Sanierungs­gebieten und städte­baulichen Entwicklungs­bereichen — erhöhte Absetzung der Modernisierungs­aufwendungen. §7i: für Baudenkmäler. Beide bieten 9 % der Sanierungs­kosten in den ersten 8 Jahren, danach 7 % über 4 weitere Jahre — also über 12 Jahre 100 % der Modernisierungs­aufwendungen abzuschreiben (gegenüber linearer 50-J-AfA).',
      anwendung: 'Bei einem 200k-Sanierungs­volumen im Sanierungs­gebiet: 18.000 € pro Jahr in Jahr 1-8 als AfA — bei 42% Grenz­steuer­satz = 7.560 €/J Steuer­ersparnis, kumuliert 60.480 € in 8 J. Stärkster AfA-Hebel im deutschen Steuer­recht für Privat-Investoren.',
      risiko: 'Voraus­setzung: Bescheinigung der Gemeinde/Denkmal­behörde VOR Beginn der Maßnahme — Antrags­frist genau einhalten. Bei nachträglicher Beantragung: oft Versagung. Bei Auf­wendungen außerhalb des Sanierungs­plans: nur Standard-AfA.'
    },
    '13a_13b_erbstg': {
      titel: '§13a / §13b ErbStG — Verschonung von Betriebs­vermögen',
      kurz: 'Bis 85 %/100 % erbschafts­steuerfreie Übertragung von BV',
      lang: 'Bei Übertragung von Betriebs­vermögen (z.B. Anteilen einer Immobilien-Holding) zu Lebzeiten oder im Erbfall: Regel­verschonung 85 % steuerfrei (Bedingung: 5-J-Lohn­summe + Behaltens­frist). Options­modell 100 % steuer­frei (7-J-Lohn­summe + Behaltens­frist).',
      anwendung: 'Wesentlicher Grund FÜR die Holding-Struktur. Privates Immobilien­vermögen wird im Erbfall mit voller Erbschaftsteuer belastet (Frei­beträge: Kinder 400k, Ehegatte 500k). Holding-Anteile bei strukturierter Verwaltung können zu 85 % oder 100 % verschont werden. Substanz­quote >90 % ist die typische Hürde — bei Immobilien-Holdings idR. erfüllbar.',
      risiko: 'Sehr komplex: Verwaltungs­vermögens­quote, Lohnsumme, Behaltens­frist. Falsche Strukturierung kann nachträg­lich Voll­steuer­pflicht aus­lösen. Steuer­berater + Notar JA spätestens 2 Jahre vor geplanter Übertragung einbeziehen.'
    },
    '558_bgb': {
      titel: '§558 BGB — Mieterhöhung bis zur ortsüblichen Vergleichsmiete',
      kurz: 'Anhebung max. 20 % in 3 J. (15 % in Mietpreisbremse-Regionen)',
      lang: 'Der Vermieter darf die Miete bis zur ortsüblichen Vergleichsmiete anheben — belegt durch Mietspiegel der Stadt, drei Vergleichswohnungen oder Sachverständigen-Gutachten. Kappungsgrenze: max. 20 % Anhebung in 3 J. (15 % wenn Bundesland eine Verordnung nach §558 Abs. 3 BGB erlassen hat — gilt z. B. für Berlin, München, viele NRW-Großstädte). Schriftliche Mieterhöhung mit Begründung, Mieter hat 2 Monate Zustimmungsfrist.',
      anwendung: 'Klassischer Mieterhöhungs­hebel im Bestand. Beispiel: Wohnung in Köln, Ist-Miete 8 €/m², Marktmiete 11,50 €/m², 80 m² Wohnfläche. Lücke: 280 €/Mon = 3.360 €/J. §558-Anhebung max. 15 % von 8 € = 9,20 €/m² → 96 €/Mon Mehr-Miete = 1.152 €/J. Bei zweiter Anhebung nach 3 weiteren Jahren weitere 15 % auf 9,20 € = 10,58 €/m² (immer noch unter Markt). Lücke wird über 6-9 J. geschlossen.',
      risiko: 'Mietspiegel muss bei Begründung beigefügt sein, sonst Anhebungs-Verfahren formell unwirksam. Mieter kann Wohnungs­wechsel als Reaktion wählen — Leerstand-Risiko in entspannten Märkten. Nach BGH-Urteil 2024: bei Verweis auf Mietspiegel müssen ALLE Spiegel-Felder, die die Wohnung erfüllt, dokumentiert sein — nicht nur das günstigste.'
    },
    '559_bgb': {
      titel: '§559 BGB — Modernisierungs-Mieterhöhung',
      kurz: '8 % p.a. der Modernisierungs­kosten umlagefähig',
      lang: 'Nach Modernisierungs­maßnahmen (energetische Sanierung, Wohnwert-Verbesserung wie Bad-Erneuerung, Balkon-Anbau) dürfen 8 % der modernisierungs­bedingten Kosten als jährliche Miet­erhöhung umgelegt werden. Kappungsgrenze: max. 3 €/m² in 6 J. (2 €/m² wenn Miete vor Erhöhung <7 €/m²). Erhöhung nach Bauabnahme, mind. 3 Mon. vor Bau-Beginn dem Mieter ankündigen (§555c BGB).',
      anwendung: 'Beispiel: 70 m² Wohnung, Modernisierung 56k € (Heizung+Dämmung+neue Fenster). 8 % von 56k = 4.480 €/J = 5,33 €/m²/Mon. Kappungsgrenze greift: max. 3 €/m² → 210 €/Mon = 2.520 €/J Mehr-Miete. Verkehrs­wert steigt proportional (Mietsteigerung × Faktor 22-25 = 55-63k € Wertgewinn). Kombi mit §35c EStG: 20 % der Sanierungs­kosten = 11.200 € Steuer-Ermäßigung über 3 J. Effektive Rendite der Sanierung: ~15-25 % p.a. auf das eingesetzte Kapital.',
      risiko: 'Nicht jeder Aufwand ist modernisierungs­fähig — reine Instandhaltung (z. B. Reparatur einer alten Heizung gleichen Typs) zählt NICHT. Härtefall-Klausel §559 Abs. 4 BGB: Mieter kann Härtefall geltend machen — dann reduzierte Umlage. Energetisch unzureichende Maßnahmen (z. B. nur Fenster-Tausch ohne Dämmung) qualifizieren teilweise nicht.'
    },
    '15_estg_3_objekt': {
      titel: '§15 EStG / 3-Objekt-Grenze — Gewerblicher Grundstücks­handel',
      kurz: '3 Verkäufe in 5 Jahren = gewerblich, voll steuer­pflichtig',
      lang: 'Wer innerhalb von 5 Jahren mehr als 3 Objekte verkauft, gilt als gewerb­licher Grundstücks­händler — der Verkaufs­gewinn ist dann VOLL einkommen­steuer­pflichtig (statt nach §23 EStG nach 10 J. steuerfrei). Verkauf aus Holding/VV-GmbH zählt separat. Bei Mischnutzung (Wohnen + Gewerbe) zählt jede selbständige Wohnung/Einheit als ein Objekt.',
      anwendung: 'WICHTIG bei aktiver Bestand­bewirtschaftung mit häufigen Verkäufen — z.B. bei Roll-EK-Strategien mit zwischen­geschalteten Verkäufen. Lieber 1 Verkauf abwarten, dann 3 Jahre Pause. Oder Verkäufe komplett in der GmbH abwickeln (dort eh KSt-pflichtig, also kein Schaden).',
      risiko: 'Rückwirkend ausgelöst — wenn der 4. Verkauf nach z.B. 4 Jahren erfolgt, werden ALLE 4 Verkäufe rückwirkend gewerblich. Inkl. GewSt + Umsatzsteuer-Folgen. Daher früh Steuer­berater einbeziehen.'
    },
    '23_estg': {
      titel: '§23 EStG — Spekulations­frist Privat-Verkauf',
      kurz: '10 J Halten = Verkauf einkommens­teuer­frei (Privat­vermögen)',
      lang: 'Im Privatvermögen ist der Veräußerungs­gewinn aus Immobilien­verkäufen einkommen­steuer­frei, wenn zwischen Anschaffung und Verkauf mehr als 10 Jahre liegen. Ausnahme: bei Eigennutzung im Verkaufs­jahr und den 2 vorhergehenden Jahren — dann sofort steuerfrei (§23 Abs. 1 Nr. 1 S. 3 EStG).',
      anwendung: 'Größter Vorteil der privaten Immobilien­anlage gegenüber GmbH. Bei strategisch geplanten Verkäufen NACH 10 J: 100 % Wert­zuwachs steuerfrei. Stark aufgewertete Objekte rechtzeitig identifizieren — der Hebel ist enorm.',
      risiko: 'Bei Einbringung in GmbH unter­halb 10 J: Spekfrist beginnt von Neuem in der GmbH (dort §23 KStG-Pendant, aber ungünstiger). Daher Bestand vor Ein­bringungs-Entscheidungen prüfen.'
    },
    '13_4a_erbstg': {
      titel: '§13 Abs. 1 Nr. 4a ErbStG — Familienheim-Schenkung',
      kurz: 'Selbstgenutztes Familienheim zwischen Ehegatten schenkungsteuerfrei — wertmäßig unbegrenzt',
      lang: 'Zuwendungen unter Lebenden, mit denen ein Ehegatte/Lebenspartner dem anderen Eigentum oder Miteigentum am gemeinsam genutzten Familienheim verschafft, sind in voller Höhe schenkungsteuerfrei. Der 500k-Freibetrag (§16 ErbStG) bleibt unangetastet. Kein Objektverbrauch — mehrfach wiederholbar während der Ehe. Keine Behaltensfrist. Voraussetzung: gemeinsame Selbstnutzung als Lebensmittelpunkt.',
      anwendung: 'Kern der Eigenheimschaukel (Sylter Modell): Ehegatte A schenkt Familienheim an B (steuerfrei nach §13 Abs. 1 Nr. 4a). B verkauft nach 6+ Monaten Schamfrist an A zum Verkehrswert zurück — kein GrESt (§3 Nr. 4 GrEStG), keine Spekulationssteuer (§23 Abs. 1 Nr. 1 S. 3 EStG, weil eigengenutzt). Ergebnis: B hat steuerfrei Bargeld in Höhe des VW erhalten.',
      risiko: '§42 AO Gestaltungsmissbrauch: Schamfrist 6+ Monate, marktüblicher KP, Freiwilligkeit (kein vertraglicher Rückübertragungs-Anspruch). Sonst Steuerfalle. Gilt nur für Familienheim — nicht für Renditeobjekte.'
    },
    '3_4_grestg': {
      titel: '§3 Nr. 4 GrEStG — Grunderwerbsteuer-Befreiung Ehegatten',
      kurz: 'Übertragungen zwischen Ehegatten/Lebenspartnern grunderwerbsteuerfrei',
      lang: 'Der Grundstückserwerb durch den Ehegatten oder Lebenspartner des Veräußerers ist von der Grunderwerbsteuer befreit. Gilt für Schenkung UND Kauf zwischen Ehegatten. Gilt auch noch nach Scheidung/Aufhebung der Lebenspartnerschaft, wenn die Übertragung im Rahmen der Vermögensauseinandersetzung erfolgt.',
      anwendung: 'Hebel-Verstärker bei Eigenheimschaukel und gemeinsamer Familienplanung. Bei einer 800k-Familie spart man pro Übertragung 28k-52k GrESt (je nach Bundesland). Bei mehrfacher Anwendung über die Ehe hinweg sechsstellige Hebel.',
      risiko: 'Nur Ehegatten/eingetragene Lebenspartner — nicht Lebenspartner ohne Eintragung, nicht Geschwister, nicht Kinder. Bei Geschiedenen: Nachweis der Vermögensauseinandersetzung erforderlich.'
    },
    '6a_grestg': {
      titel: '§6a GrEStG — Konzernklausel',
      kurz: 'Steuerfreie Umstrukturierung im Konzern bei 95-%-Mindestbeteiligung',
      lang: 'Bei Umwandlungen im Sinne des Umwandlungsgesetzes (Verschmelzung, Spaltung, Vermögensübertragung) und bei Anteilsübertragungen innerhalb eines Konzerns wird die Grunderwerbsteuer nicht erhoben, wenn das herrschende Unternehmen mindestens 95 % an dem abhängigen Unternehmen beteiligt ist — sowohl 5 Jahre vor der Umwandlung als auch 5 Jahre danach.',
      anwendung: 'Aufbau einer Holding-Struktur ohne GrESt-Belastung. Beispiel: Privatperson hält 100 % an einer VV-GmbH. Sie gründet eine Holding-GmbH und überträgt die VV-GmbH-Anteile an die Holding. Wenn die 95-%-Bedingung über 10 Jahre eingehalten wird, fällt keine GrESt an. Bei einem Bestand von 5 Mio. € sparst du potenziell 250-325k €.',
      risiko: 'Vor- und Nachfrist 5 Jahre — bei Verstoß rückwirkende GrESt. Auch der Verkauf eines Teils der GmbH-Anteile innerhalb der Frist kann das Privileg kippen.'
    },
    'kp_aufteilung_grund_gebaeude': {
      titel: 'Kaufpreis-Aufteilung Grund/Boden vs. Gebäude im Notarvertrag',
      kurz: 'Nur der Gebäudeanteil ist abschreibbar — höherer Anteil = mehr AfA',
      lang: 'Im Notarvertrag wird der Gesamt-Kaufpreis aufgeteilt zwischen nicht-abschreibbarem Grund und Boden und abschreibbarem Gebäude. Standard-Schätzung der Finanzverwaltung: oft 80/20 oder 75/25. Bei begründeter höherer Gebäude-Quote (z.B. 85/15) per BMF-Aufteilungs-Hilfe oder Sachverständigen-Gutachten verbessert sich die AfA-Bemessungs­grundlage erheblich.',
      anwendung: 'Bei einer 400k-ETW: Standard 75 % Geb-Anteil = 300k AfA-Basis. Höhere 85 % = 340k AfA-Basis = 40k mehr Abschreibungs-Volumen. Bei 2 % AfA und 42 % Grenzsteuersatz bedeutet das ~336 €/J zusätzliche Steuer-Ersparnis. Über 50 J. Nutzungsdauer = 16.800 € Hebel pro Objekt nominal.',
      risiko: 'Finanzamt prüft die Aufteilung. Bei deutlicher Abweichung von der BMF-Aufteilungs-Hilfe (online verfügbar) ist Bodenrichtwert-Argumentation oder Sachverständigen-Gutachten nötig. Bei A-Lagen mit hohem Boden­anteil (München, Hamburg) ist die Hebel-Wirkung kleiner.'
    },
    'familienstiftung': {
      titel: 'Familienstiftung als Alternative zur Holding',
      kurz: 'Vermögen in Stiftung — kein Gesellschafter, kein vGA-Risiko, Generationsvermögen',
      lang: 'Eine Familienstiftung ist eine rechtsfähige Stiftung des privaten Rechts ohne Gesellschafter. Vermögen wird auf die Stiftung übertragen, die es im Sinne des Stifterwillens verwaltet. Begünstigte (Familie) erhalten Auszahlungen — das Stiftungsvermögen bleibt aber bestehen. Steuersätze auf laufende Erträge ähnlich wie GmbH (~15 % KSt + ggf. GewSt).',
      anwendung: 'Vorteile gegenüber Holding-GmbH: kein vGA-Risiko (keine Gesellschafter), generationenübergreifender Erhalt, Schutz vor Pflichtteils-Ansprüchen, kein Anteilsverkauf zwischen Erben möglich. Geeignet für Vermögen >2 Mio. € mit klarem Generationen­plan.',
      risiko: 'Schenkungs- bzw. Erbschaftsteuer bei Stiftungsgründung (Steuerklasse III, ~30 % auf alles über 200k Freibetrag). Ersatz-Erbschaftsteuer alle 30 Jahre auf das Stiftungsvermögen (mindestens 200k Freibetrag pro 30 J.). Hohe Errichtungs- und laufende Verwaltungs­kosten (~5k-10k €/J). Unwiderruflich — Vermögen geht der Stifterfamilie zivilrechtlich verloren.'
    },
    '23_eigennutzung': {
      titel: '§23 Abs. 1 Nr. 1 S. 3 EStG — Eigennutzungs-Befreiung',
      kurz: 'Verkauf sofort steuerfrei bei Eigennutzung im Verkaufsjahr + 2 Vorjahre',
      lang: 'Vom 10-Jahres-Spekulationsfrist (§23 Abs. 1 Nr. 1 S. 1 EStG) ausgenommen sind Wirtschaftsgüter, die im Zeitraum zwischen Anschaffung oder Fertigstellung und Veräußerung ausschließlich zu eigenen Wohnzwecken oder im Jahr der Veräußerung und in den beiden vorangegangenen Jahren zu eigenen Wohnzwecken genutzt wurden.',
      anwendung: 'Strategischer Hebel: ein renditeorientiertes Objekt für 2 volle Kalenderjahre + den Anteil des Verkaufsjahrs selbst bewohnen → Verkauf sofort einkommen­steuerfrei, ohne 10-J-Frist. Praktisch: Anschaffung Januar 2024 → Selbstnutzung 2024-2026 → Verkauf z.B. Februar 2026 → steuerfrei. Beste Anwendung bei stark aufgewerteten Objekten (Sanierung, Lage-Aufschwung) zur Realisierung des Wertzuwachses.',
      risiko: 'Eigennutzung muss tatsächlich erfolgen (Hauptwohnsitz, Meldung). Vermietung an Familienangehörige zählt nicht als Eigennutzung. Lückenhafte Nutzung kippt die Befreiung — auch eine vermietete Einliegerwohnung mindert anteilig.'
    },
    'share_deal_grestg': {
      titel: 'Share Deal — §1 Abs. 3 GrEStG',
      kurz: 'GmbH-Anteile statt Immobilie verkaufen — bei <90 % Übertragung keine GrESt',
      lang: 'Beim Verkauf einer Immobilien-GmbH werden nicht die Immobilien selbst veräußert, sondern die GmbH-Anteile. Seit 1.7.2021 fällt GrESt nach §1 Abs. 3 Nr. 1-2 GrEStG erst an, wenn binnen 10 Jahren mind. 90 % der Anteile auf einen Erwerber oder eine Erwerber-Gruppe übergehen (vorher 95 %).',
      anwendung: 'Strategie: Käufer übernimmt 89,9 % der GmbH-Anteile, Verkäufer behält 10,1 %. Keine GrESt. Nach 10 Jahren kann Verkäufer die restlichen 10,1 % zum vereinbarten Preis nachverkaufen — dann ggf. weitere Übertragung mit GrESt-Pflicht, aber zu diesem Zeitpunkt wirtschaftlich vom Käufer entkoppelt. Praktisch: bei Portfolio-Verkauf einer GmbH mit 5 Mio. € Verkehrswert spart man 175-325k € GrESt.',
      risiko: '90-%-Schwelle hart. Bei mehreren Erwerbern oder verbundenen Personen wird zusammengerechnet. 10-Jahres-Frist nach jedem Anteils-Wechsel neu. Bei Veränderung der Gesellschafter­struktur in der Frist droht §1 Abs. 2a GrEStG.'
    },
    '7_jahres_regel_gmbh': {
      titel: '7-Jahres-Regel beim GmbH-Verkauf',
      kurz: 'Nach 7 Jahren Holding-Struktur: GmbH-Verkauf zu ~1,5 % effektiver Steuerlast',
      lang: 'Bei einer Holding-Struktur mit mind. 10 % Beteiligung an der operativen/VV-GmbH greift §8b KStG: Veräußerungsgewinn aus dem GmbH-Verkauf ist zu 95 % steuerfrei in der Holding (5 % als nicht-abzugsfähige Betriebsausgabe). Effektive Steuerlast: ~1,5 % (15 % KSt × 5 %). Voraussetzung: Beteiligung am Anfang des Wirtschaftsjahres.',
      anwendung: 'Strategischer Plan für Bestände, die langfristig verkauft werden sollen: 7 Jahre vor dem geplanten Verkauf alles in die Holding-Struktur einbringen (Holding hält operative GmbH/VV-GmbH). Beim späteren Verkauf der Tochter-Anteile durch die Holding fallen nur ~1,5 % Steuer an — der Erlös bleibt fast komplett in der Holding und kann reinvestiert werden. Bei einem Verkaufserlös von 3 Mio. € spart man ~270-840k € gegenüber dem Privat-Verkauf.',
      risiko: 'Beteiligung muss zu Beginn des Wirtschaftsjahres bestehen (sonst keine Befreiung im selben Jahr). §1 Abs. 3 GrEStG-Regeln beim Aufbau der Struktur beachten. Bei Sperrfristen nach §22 UmwStG (7 Jahre) kann frühe Anteilsübertragung zu nachträglicher Besteuerung führen.'
    },
    'verdeckte_einlage': {
      titel: '§8 Abs. 3 S. 3 KStG / §6 Abs. 1 Nr. 5 EStG — Verdeckte Einlage',
      kurz: 'Verkauf an eigene GmbH unter Verkehrswert: GrESt-Hebel + Bilanz-Trick',
      lang: 'Wenn ein Gesellschafter (oder eine ihm nahestehende Person) seiner GmbH einen Vermögensvorteil gewährt — etwa durch Verkauf einer Immobilie unter Verkehrswert — liegt eine verdeckte Einlage nach §8 Abs. 3 S. 3 KStG vor. STEUERLICHE BEHANDLUNG: \n\n(1) GRUNDERWERBSTEUER: Bemessungsgrundlage ist der vereinbarte Kaufpreis (§9 GrEStG). Bei einem KP von 7 % vom Verkehrswert fällt GrESt nur auf diese 7 %. ACHTUNG §8 Abs. 2 Nr. 1 GrEStG: bei symbolischem KP (1 €) wird der Grundbesitzwert herangezogen.\n\n(2) STEUERBILANZ GMBH: Aktiva mit Teilwert (§6 Abs. 1 Nr. 5 EStG i.V.m. §8 Abs. 1 KStG) — also Verkehrswert. Differenz zum Kaufpreis = verdeckte Einlage in die Kapitalrücklage. Einkommen der GmbH wird nicht erhöht (§8 Abs. 3 S. 3 KStG).\n\n(3) STEUERLICHES EINLAGEKONTO §27 KStG: Die verdeckte Einlage wird auf dem Einlagekonto ausgewiesen. Spätere Ausschüttungen aus diesem Konto sind steuerfrei — aber strenge Reihenfolge nach §27 Abs. 1 S. 5 (zuerst Gewinne).\n\n(4) ANSCHAFFUNGSKOSTEN BETEILIGUNG: §6 Abs. 6 S. 2 EStG: Anschaffungskosten der GmbH-Anteile beim Verkäufer steigen um die Differenz Verkehrswert − KP. Bei späterem Verkauf der GmbH-Anteile niedrigerer Veräußerungsgewinn.\n\nBFH-RECHTSPRECHUNG: Der KP darf nicht „symbolisch" sein. Mindestens 4-5 % vom Buchwert (BFH-Praxis), Faustregel mit Sicherheits-Puffer 7-15 % vom Verkehrswert.',
      anwendung: 'NUR bei Objekten >10 Jahre Halte­dauer (§23 EStG-Spekfrist abgelaufen) — sonst löst der Verkauf Veräußerungsgewinn beim Verkäufer aus, der voll steuerpflichtig wäre und die GrESt-Ersparnis übersteigt. Reihenfolge: 1. Sachverständigen-Wertgutachten (dokumentiert Verkehrswert). 2. Notarvertrag GmbH ↔ Privatperson. 3. Steuerberater-Buchung der verdeckten Einlage. 4. §27-Einlagekonto-Feststellung in der GmbH-Steuerbilanz.',
      risiko: 'Sehr fehleranfällig. Verdeckte SCHENKUNG würde drohen, wenn die Differenz objektiv als unentgeltliche Zuwendung zu werten wäre — Finanzämter prüfen via wirtschaftliche Betrachtungs­weise. Steuerberater + Notar zwingend. Bei Ehegatten als nahestehende Person: Anschaffungskosten beim Gesellschafter erhöhen sich NICHT (BFH).'
    },
    '27_kstg_einlagekonto': {
      titel: '§27 KStG — Steuerliches Einlagekonto',
      kurz: 'Wo verdeckte Einlagen geparkt werden — spätere Ausschüttung steuerfrei',
      lang: 'Die KapGes hat alle nicht in das Nennkapital geleisteten Einlagen am Schluss jedes Wirtschaftsjahres auf dem steuerlichen Einlagekonto auszuweisen. Bei Ausschüttungen wird zuerst der ausschüttbare Gewinn verwendet, erst dann das Einlagekonto (§27 Abs. 1 S. 5 KStG). Ausschüttungen aus dem Einlagekonto sind beim Empfänger steuerfrei (§20 Abs. 1 Nr. 1 S. 3 EStG i.V.m. §27 KStG).',
      anwendung: 'Bei verdeckten Einlagen (z.B. Verkauf einer Immobilie an die GmbH unter Verkehrswert): Differenz wird in die Kapitalrücklage und damit auf das Einlagekonto gebucht. Bei späterer Ausschüttung kann diese Reserve steuerfrei zurückfließen — Voraussetzung: alle anderen Gewinne wurden vorher ausgeschüttet.',
      risiko: 'Reihenfolge §27 Abs. 1 S. 5 KStG: Gewinne haben Vorrang — Ausschüttung aus dem Einlagekonto ist erst möglich, wenn ausschüttbarer Gewinn = 0. In der Praxis bedeutet das, dass Einlagekonto-Ausschüttungen nur in Verlust- oder Liquidations-Phasen oder nach vollständiger Gewinn-Ausschüttung möglich sind.'
    },
    '8b_kstg': {
      titel: '§8b KStG — Beteiligungs­ertrags­befreiung in der Holding',
      kurz: '95 % der Dividenden steuerfrei in der Holding',
      lang: 'Wenn die Holding-GmbH mind. 10 % an einer Tochter (z.B. VV-GmbH) hält, sind Ausschüttungen der Tochter zu 95 % steuerfrei in der Holding (5 % als nicht-abzugsfähige Betriebs­ausgabe). Effektive Steuerlast in der Holding: ~1,5 % (15 % KSt + SolZ × 5 %). Fast volle Reinvestitions­quote.',
      anwendung: 'Kern­motivation für Holding-Struktur. Beispiel: VV-GmbH schüttet 100k an Holding aus — davon 95k unbesteuert verfügbar für Folge-Investitionen (statt im privaten Bereich nach KapESt + ggf. Soli + KiSt nur ~70k netto).',
      risiko: '10%-Schwellen­wert beachten. Streubesitz <10 %: voll steuerpflichtig. Bei Eingang neuer Investoren in die Holding: Beteiligungs­quoten nicht unter 10% drücken.'
    },
    '9_1_2_gewstg': {
      titel: '§9 Nr. 1 S. 2 GewStG — Erweiterte Grundstücks­kürzung',
      kurz: 'GmbH mit reiner Vermögens­verwaltung zahlt KEINE GewSt auf Mieten',
      lang: 'Eine VV-GmbH, deren Tätigkeit AUSSCHLIESSLICH in der Verwaltung und Nutzung eigenen Grund­besitzes besteht, kann auf Antrag die erweiterte Grundbesitz­kürzung beanspruchen — die Mieten werden komplett aus der GewSt heraus­gerechnet. Effektive Steuerlast: ~15,8 % (KSt + SolZ) statt ~30 % (KSt + GewSt + SolZ).',
      anwendung: 'Hauptmotiv für VV-GmbH. Bei 100k Mieteinnahmen p.a. spart die erweiterte Kürzung ~14k €/J GewSt gegenüber gewerblicher GmbH oder gegenüber persönlichem Spitzen­steuersatz.',
      risiko: 'Strenge Voraussetzungen — sobald die GmbH zusätzliche Tätigkeiten aus­übt (Möblier­ung, kurzfristige Vermietung, Photo­voltaik-Anlagen­betrieb >Bagatell), ist die erweiterte Kürzung WEG. Möbliert vermieten daher nur durch Mietvertrag-Konstrukt mit separater Möblierungs­miete oder durch Op-GmbH.'
    },
    'gmbh_schwellen': {
      titel: 'GmbH-Schwellenwerte — Stufensystem nach V+V-Überschuss',
      kurz: '5 Tiers von „privat halten" (Tier 0, <12k) bis „Konzern" (Tier 4, >100k)',
      lang: 'Es gibt KEINE einzelne magische Schwelle, ab der eine VV-GmbH lohnt. Die Quellenlage ist uneinig: Qonto setzt 75k Mieteinnahmen p.a. an, immoprentice rechnet anhand konkreter Bei­spiele vor (einzelne ETW in C-Lage lohnt nicht, MFH mit 7 Einheiten dagegen schon), ride.capital rechnet die Strukturkosten (~3.000 €/J) als Untergrenze — was bei sehr hohem persönlichen Grenzsteuersatz schon ab ~12k Vorteil bringen kann.\n\nWir arbeiten daher mit einem TIER-SYSTEM auf Basis des V+V-Überschusses (= laufender Mietüberschuss vor Steuer):\n\n• TIER 0 — UNTER 12k €/J\n  Privat halten. GmbH-Strukturkosten übersteigen jeden Vorteil. Empfehlung: V+V-Werbungskosten optimieren, AfA-Hebel via RND-Gutachten nutzen.\n\n• TIER 1 — 12k bis 25k €/J\n  Lohnt sich NUR, wenn die GmbH bereits existiert (z.B. operative GmbH, Holding aus anderem Geschäft). Bei Neugründung sind ~3-5k Buchhaltung + ~1.500 Setup als laufende Hürde zu hoch. Bei vorhandener Hülle: zusätzlicher V+V-Hebel mitnehmen, Neukäufe in die bestehende GmbH legen.\n\n• TIER 2 — 25k bis 50k €/J\n  Neugründung beginnt sich zu lohnen, abhängig vom persönlichen Grenzsteuersatz. Faustrechnung: Bei 35k V+V × (42 % Privat − 15,8 % GmbH) = 9.170 € jährlicher Steuer-Vorteil. Abzgl. 3.500 € Buchhaltung = 5.670 €/J Netto-Vorteil. Vor Strukturwechsel mit Steuer­berater Break-Even rechnen.\n\n• TIER 3 — 50k bis 100k €/J\n  Klarer Vorteil. Steuer-Differenz × Mietüberschuss überschreitet Kosten deutlich. Bei 75k: ca. 19.650 € Steuer-Vorteil − 3.500 € Kosten = 16.150 €/J. Holding-Aufbau parallel prüfen (§8b KStG-Privileg + §13a/§13b ErbStG bei späterer Übertragung).\n\n• TIER 4 — ÜBER 100k €/J\n  Konzern­struktur lohnt sich (Holding + VV-GmbH(s) + ggf. Op-GmbH für gewerbliche Nebentätigkeiten wie Möblierung/PV). Bei 150k V+V: ~39.300 € Steuer-Vorteil − 6.000 € Kosten (zwei Hüllen) = 33.300 €/J + die volle ErbSt-Verschonung über §13a/§13b für die nächste Generation.\n\nZUSATZ-FAKTOREN, die die Schwelle verschieben:\n\n• Persönlicher Grenz­steuersatz: bei 47,5 % (Spitzen­satz + Soli + KiSt) verschiebt sich der Break-Even nach unten (Tier 1 wird dann ab ~10k attraktiv)\n• Bestehende Struktur: wenn GmbH/Holding schon da ist, fallen Setup-Kosten weg → ein Tier nach unten\n• Skalierungs­plan: bei geplantem Bestand­wachstum direkt in der GmbH starten — auch wenn aktuell noch Tier 1\n• Erbschafts­planung: §13a/§13b ErbStG kann allein schon Strukturwechsel rechtfertigen, unabhängig von der laufenden Steuer­ersparnis\n• Stark schwankendes zvE (Selbständige): GmbH früher attraktiv, weil sie unabhängig vom Spitzen­satz ist\n\nQUELLEN: qonto.com (75k-Schwelle, konservativ), ride.capital (~3k Strukturkosten/J), immoprentice.de (Beispiel­rechnungen MFH vs. ETW), socha-immobilien.de, meine-renditeimmobilie.de.',
      anwendung: 'Berechne deinen aktuellen V+V-Überschuss (Mieteinnahmen − BWK − Zinsen − AfA), ordne in die Tiers ein, und prüfe Zusatzfaktoren. Bei Tier-Sprung (z.B. durch Neukauf): Steuerberater einbeziehen.',
      risiko: 'Tier-Schwellen sind Orientierung, keine harten Grenzen. Einbringung von Bestands­objekten löst GrESt 3,5-6,5 % aus + setzt §23-Spekfrist zurück. Bei Bestand: nur Neukäufe in die GmbH, Altbestand privat lassen bis §23-Frist abgelaufen ist.'
    },
    'kaufpreis_grenzen': {
      titel: 'Kaufpreis-Schwellen — Hüllen-Entscheidung pro Neukauf',
      kurz: '<150k → privat · 150-400k → flexibel · >400k → klar GmbH (sofern Tier 2+)',
      lang: 'Faustregel pro Neukauf-Entscheidung. Diese Schwellen ergänzen das Tier-System (siehe „GmbH-Schwellenwerte"): die Tiers sagen, OB eine GmbH-Hülle generell lohnt; die Kaufpreis-Schwellen sagen, OB DAS KONKRETE OBJEKT in die Hülle gehört.\n\n• KP <150k — typisch ETW oder Bestand-ETW in B-/C-Lage. Mietüberschuss meist 4-8k €/J pro Objekt. Selbst wenn die GmbH grundsätzlich existiert, drückt eine kleine Wohnung das Portfolio in der GmbH oft nicht relevant. Empfehlung: privat halten (§23-Steuerfreiheit nach 10 J. nutzen).\n\n• KP 150-400k — typisch ETW gehoben oder kleine MFH. Mietüberschuss 8-25k €/J. Hier hängt es vom Profil ab:\n  – bei laufender Skalierung (mehrere Käufe geplant): in die GmbH legen für Cluster-Effekt\n  – bei Single-Buy ohne Folgepläne: privat halten lohnt sich oft mehr (§23-Befreiung)\n\n• KP >400k — typisch MFH mit 6+ Einheiten. Mietüberschuss 25k+ €/J. Hier ist die GmbH klar besser, sofern man ohnehin in Tier 2+ ist. Cashflow-stark + langfristige Halte­dauer = perfekter VV-GmbH-Kandidat.\n\nWICHTIGE KOMBINATION: KP-Schwelle UND Tier müssen zusammen passen. Beispiel: Tier 0 (V+V <12k) + KP 500k Neukauf = trotzdem GmbH gründen, weil der Neukauf alleine schon Tier 2 erreicht. Andersrum: Tier 3 + KP 100k-Häuschen = trotzdem privat halten, weil ein Mini-Objekt in der GmbH den Strukturvorteil nicht hebt.',
      anwendung: 'Vor jedem Neukauf: KP gegen Schwelle prüfen, GLEICHZEITIG den projizierten V+V-Überschuss in die Tier-Skala einordnen (vorhandener Bestand + neues Objekt). Wenn beides für GmbH spricht: Steuerberater-Termin BEVOR die Vorvertrags-Phase abgeschlossen ist (Hülle muss VOR Notar-Termin existieren).',
      risiko: 'Bei Mischbestand (privat + GmbH) erhöhter Verwaltungs­aufwand. Trennung sauber dokumentieren — das FA prüft sehr genau, ob GmbH-Objekte und Privat­objekte sauber abgegrenzt sind (insbesondere bei der erweiterten Kürzung §9 Nr. 1 S. 2 GewStG).'
    }
  };
  // Pro Objekt einen DealScore2 berechnen, um Lage/Upside-Subscores zu nutzen.
  // Funktioniert nur, wenn DealScore2-Modul geladen ist UND das Objekt
  // entsprechende Felder hat. Sonst null.
  function _computeDS2ForRow(row) {
    if (typeof window === 'undefined' || !window.DealScore2 || !window.DealScore2.compute) return null;
    var d = row._raw || {};
    // DealScore2 erwartet flach strukturierte deal-Inputs
    var deal = {
      kaufpreis:           row.kp,
      gesamtkosten:        row.gi,
      eigenkapital:        row.ek,
      jahreskaltmiete:     row.nkm_y,
      monatlicheNkm:       row.nkm_y / 12,
      monatlicheEinnahmen: row.nkm_y / 12,
      monatlicheAusgaben:  (row.bwk_y + row.instand_y + row.zins_y + row.tilg_y) / 12,
      monatlicheKreditrate:(row.zins_y + row.tilg_y) / 12,
      jahresCashflow:      row.cf_vor_y,
      dscr:                row.dscr,
      ltv:                 row.ltv_aktuell || row.ltv,
      tilgung:             d.d1t || d.tilgung,
      zinsSatz:            d.d1z || d.zins,
      eigenkapitalQuote:   row.gi > 0 ? row.ek / row.gi : 0,
      // Risiko-Felder
      zustand:             row.ds2_zustand || (row.sanstand >= 4 ? 'renovierungsbeduerftig' : 'normal'),
      energieKlasse:       row.energieklasse || '',
      mietausfallRisiko:   row.mietausfall_risiko || '',
      leerstandPct:        d.leerstand_pct || 0,
      instandhaltungPctNkm: d.instandhaltung_pct_nkm || 0,
      // Lage
      mikrolage:           row.mikrolage || '',
      bevoelkerung:        row.bevoelkerung || '',
      nachfrage:           row.nachfrage || '',
      istMieteEurQm:       row.ist_miete_qm,
      marktmieteEurQm:     row.marktmiete_qm,
      mietwachstumPct:     d.mietwachstum_pct,
      // Upside
      wertsteigerung:       row.wertsteigerung || '',
      entwicklungsmoeglichkeiten: row.entwicklungs_moegl || ''
    };
    try {
      var res = window.DealScore2.compute(deal);
      if (!res || !res.categories) return null;
      return {
        score: res.score,
        label: res.label,
        lageScore:   res.categories.lage   ? res.categories.lage.score   : null,
        upsideScore: res.categories.upside ? res.categories.upside.score : null,
        risikoScore: res.categories.risiko ? res.categories.risiko.score : null,
        positives:   res.positives || [],
        negatives:   res.negatives || [],
        completeness: res.dataCompleteness
      };
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('DS2 fail for ' + row.kuerzel + ':', e);
      return null;
    }
  }

  function _avgLageScore(rows) {
    var vals = rows
      .filter(function(r) { return r.dealScore2 && r.dealScore2.lageScore != null; })
      .map(function(r) { return r.dealScore2.lageScore; });
    if (vals.length === 0) return null;
    return Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length);
  }
  function _avgUpsideScore(rows) {
    var vals = rows
      .filter(function(r) { return r.dealScore2 && r.dealScore2.upsideScore != null; })
      .map(function(r) { return r.dealScore2.upsideScore; });
    if (vals.length === 0) return null;
    return Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length);
  }

  // ── V135: ZUKAUF-PLAN-ANALYSE ───────────────────────────────────
  // Aus Ziel-Inputs (zielenheiten_pa, kp_min/max_geplant, sparquote_pct,
  // marktzins_pct) konkrete Plausibilit\u00E4ts-Rechnung ableiten:
  //  - EK-Bedarf pro Zukauf (Kaufnebenkosten + 10-20 % EK-Anteil)
  //  - J\u00E4hrliche EK-Anh\u00E4ufung aus Sparquote + Beleihungs-Reserve
  //  - Annuit\u00E4t bei aktuellem Marktzins
  //  - Tragf\u00E4higkeit gegen das zvE
  // ── V137: GMBH-VERKAUFS-ANALYSE (verdeckte Einlage) ────────────
  // BFH-Rechtsprechung: Verkauf an eigene GmbH zu 6-15 % vom Verkehrswert ist
  // möglich, wenn KP nicht "symbolisch" ist. Mindestens 4-5 % vom Buchwert
  // (BFH-Praxis), 7 % vom Verkehrswert ist Faustregel mit Sicherheits-Puffer.
  //
  // Steuerliche Behandlung:
  //  – Grunderwerbsteuer: nur auf den Kaufpreis (= 7 % vom Verkehrswert)
  //  – Differenz zum Verkehrswert: verdeckte Einlage nach §8 Abs.3 S.3 KStG
  //    + §6 Abs.1 Nr.5 EStG, mit Teilwert in Steuerbilanz aktivieren
  //  – Steuerbilanz GmbH: Aktiva = Verkehrswert (Teilwert), Passiva = KP +
  //    Kapitalrücklage (Differenz). Einkommen der GmbH wird nicht erhöht.
  //  – Beim Verkäufer: Anschaffungskosten der GmbH-Beteiligung steigen um
  //    die Differenz (§6 Abs.6 S.2 EStG)
  //  – §23 EStG: Verkauf darf nicht innerhalb der Spekulationsfrist sein,
  //    sonst Veräußerungsgewinn beim Verkäufer voll steuerpflichtig
  //
  // Voraussetzungen:
  //  – Objekt muss >10 Jahre gehalten worden sein (§23 EStG-Frist abgelaufen)
  //  – KP zwischen 4-15 % vom Verkehrswert (sonst symbolisch / Schenkung)
  //  – Steuerberater-Letzt-Check zwingend
  // ── V138: EIGENHEIMSCHAUKEL-ANALYSE ─────────────────────────────
  // §13 Abs. 1 Nr. 4a ErbStG + §3 Nr. 4 GrEStG + §23 Abs. 1 Nr. 1 S. 3 EStG
  // Ehegatte A schenkt Familienheim an B → schenkungsteuerfrei,
  // wertmäßig unbegrenzt, kein Objektverbrauch, Freibetrag bleibt.
  // B verkauft nach 6+ Monaten Schamfrist an A zum Verkehrswert zurück.
  // Kein GrESt (Ehegatten-Befreiung), keine Spekulationssteuer (Eigennutzung).
  // → Vermögen in Höhe des Verkehrswerts steuerfrei zwischen Ehegatten transferiert.
  function _calcEigenheimSchaukelAnalyse(inp) {
    if (!inp.hat_familienheim || !inp.familienheim_partner || !inp.familienheim_wert) {
      return {
        anwendbar: false,
        grund: !inp.hat_familienheim ? 'Kein Familienheim angegeben'
              : !inp.familienheim_partner ? 'Keine Ehe oder eingetragene Lebenspartnerschaft'
              : 'Kein Verkehrswert für Familienheim hinterlegt'
      };
    }

    var vw = inp.familienheim_wert;
    // Hebel = 100 % vom VW transferierbar steuerfrei
    var transferbarer_betrag = vw;

    // Was hätte alternativ Steuer gekostet?
    // Bei Bargeld-Schenkung über 500k Freibetrag (§16 ErbStG): Steuerklasse I
    // Steuersätze: 7 % bis 75k, 11 % bis 300k, 15 % bis 600k, 19 % bis 6 Mio,
    // 23 % bis 13 Mio, 27 % bis 26 Mio, 30 % darüber
    var freibetrag = 500000;
    var ueber_freibetrag = Math.max(0, vw - freibetrag);
    var alt_steuer = 0;
    if (ueber_freibetrag > 0) {
      var rest = ueber_freibetrag;
      var stufen = [
        { lim: 75000, pct: 0.07 },
        { lim: 300000, pct: 0.11 },
        { lim: 600000, pct: 0.15 },
        { lim: 6000000, pct: 0.19 },
        { lim: 13000000, pct: 0.23 },
        { lim: 26000000, pct: 0.27 },
        { lim: Infinity, pct: 0.30 }
      ];
      var prev = 0;
      for (var i = 0; i < stufen.length && rest > 0; i++) {
        var stufe = stufen[i];
        var verfuegbar = stufe.lim - prev;
        var anwendbar = Math.min(rest, verfuegbar);
        alt_steuer += anwendbar * stufe.pct;
        rest -= anwendbar;
        prev = stufe.lim;
      }
    }

    // GrESt-Ersparnis (in einem normalen Verkaufs-Szenario würde GrESt anfallen
    // — bei der Schaukel nicht wegen §3 Nr. 4 GrEStG)
    var bundeslandGrESt = {
      'BW': 5.0, 'BY': 3.5, 'BE': 6.0, 'BB': 6.5, 'HB': 5.0, 'HH': 5.5,
      'HE': 6.0, 'MV': 6.0, 'NI': 5.0, 'NW': 6.5, 'RP': 5.0, 'SL': 6.5,
      'SN': 5.5, 'ST': 5.0, 'SH': 6.5, 'TH': 6.5
    };
    var grEStPct = bundeslandGrESt[inp.bundesland || 'NW'] || 6.5;
    var grest_ersparnis = vw * grEStPct / 100;

    return {
      anwendbar: true,
      vw: vw,
      transferbarer_betrag: transferbarer_betrag,
      freibetrag: freibetrag,
      alt_steuer_schenkung: alt_steuer,
      grest_ersparnis: grest_ersparnis,
      gesamt_hebel: alt_steuer + grest_ersparnis,
      bundesland: inp.bundesland,
      grest_pct: grEStPct,
      schamfrist_monate: 6,
      paragraphen: ['§13 Abs. 1 Nr. 4a ErbStG', '§3 Nr. 4 GrEStG', '§23 Abs. 1 Nr. 1 S. 3 EStG', '§42 AO']
    };
  }

  // ── V138: KP-AUFTEILUNG-HEBEL ────────────────────────────────────
  // Höherer Gebäudeanteil → höhere AfA-Bemessungsgrundlage
  // Standard 75 %, optimiert bis 85 % (mit Bodenrichtwert-Argumentation)
  function _calcKpAufteilungHebel(inp) {
    var aktuell = inp.kp_aufteilung_geb_pct || 75;
    var optimiert = inp.kp_aufteilung_geb_pct_optimiert || 85;
    if (optimiert <= aktuell) {
      return { anwendbar: false, grund: 'Optimierter Anteil <= aktueller Anteil' };
    }

    // Hebel pro 100k KP
    var diff_pct = optimiert - aktuell;
    var mehr_basis_pro_100k = 1000 * diff_pct;  // 1000 € pro %-Punkt
    var afa_satz = 0.02;
    var mehr_afa_pa_pro_100k = mehr_basis_pro_100k * afa_satz;
    var grenz_priv = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
      ? Tax.calcGrenzsteuersatz(inp.base_income_zve || 60000)
      : 0.42;
    var mehr_steuer_pa_pro_100k = mehr_afa_pa_pro_100k * grenz_priv;
    var mehr_steuer_50j_pro_100k = mehr_steuer_pa_pro_100k * 50;

    // Hochgerechnet auf den geplanten KP-Korridor
    var kp_avg = (inp.kp_min_geplant + inp.kp_max_geplant) / 2;
    var faktor = kp_avg / 100000;
    var mehr_steuer_pa = mehr_steuer_pa_pro_100k * faktor;
    var mehr_steuer_50j = mehr_steuer_50j_pro_100k * faktor;

    // Über die geplanten Zukäufe
    var objekte_pa = inp.ziel_objekte_pa || 0;
    var hebel_5j_alle_kaufe = mehr_steuer_pa * objekte_pa * 5;

    return {
      anwendbar: true,
      kp_aufteilung_aktuell_pct: aktuell,
      kp_aufteilung_optimiert_pct: optimiert,
      diff_pct: diff_pct,
      kp_avg: kp_avg,
      mehr_steuer_pa_pro_objekt: mehr_steuer_pa,
      mehr_steuer_50j_pro_objekt: mehr_steuer_50j,
      mehr_afa_basis_pro_objekt: 1000 * diff_pct * faktor,
      objekte_pa: objekte_pa,
      hebel_5j_alle_kaufe: hebel_5j_alle_kaufe,
      grenzsteuersatz: grenz_priv
    };
  }

  // ── V138: FAMILIENSTIFTUNG VS. HOLDING-VERGLEICH ─────────────────
  // Vergleicht beide Strukturen für die laufenden Erträge des Portfolios
  // und für den Erbschafts-Plan (Verschonung §13a/§13b ErbStG).
  function _calcFamilienstiftungVsHolding(inp, port) {
    if (!inp.stiftung_erwaegung || !port || port.gi < 1500000) {
      return {
        empfohlen: false,
        grund: !inp.stiftung_erwaegung ? 'Stiftung nicht aktiviert'
              : 'Portfolio-Volumen zu klein (<1,5 Mio €) — Stiftung lohnt sich i.d.R. erst ab 2 Mio'
      };
    }

    var vw = port.vw_total || port.gi;
    var vuv_pa = port.vuv_y || 0;

    // Holding-Variante:
    // Erträge: ~1,5 % Steuer (15 % KSt × 5 %) auf Ausschüttungen
    // ErbSt-Hebel: §13a/§13b ErbStG bis 85 % Verschonung möglich (Optionalverschonung)
    var holding_steuer_pa = vuv_pa * 0.158;  // grob, weil VuV unten in der VV-GmbH gewerbesteuerfrei
    var holding_setup_kosten = 4000;
    var holding_laufend_pa = 3000;

    // Stiftung:
    // Errichtungs-Schenkungssteuer (Steuerklasse III bei Familienstiftung,
    //   30 % auf alles über 200k Freibetrag)
    // Aber: bei Familienstiftung "günstigste Steuerklasse" §15 Abs. 2 ErbStG —
    //   vom entferntesten begünstigten Familienangehörigen → typisch StKl I
    // Ersatzerbschaftsteuer alle 30 J.
    var stiftung_freibetrag = 200000;  // konservativ
    var stiftung_bemessung = Math.max(0, vw - stiftung_freibetrag);
    // Vereinfacht: 19 % auf alles bis 6 Mio (StKl I)
    var stiftung_setup_steuer = stiftung_bemessung * 0.19;
    var stiftung_ersatz_erbst_30j = stiftung_bemessung * 0.19;  // alle 30 Jahre
    var stiftung_setup_kosten = 12000;  // Notar + Stiftungssatzung
    var stiftung_laufend_pa = 7000;     // Verwaltung
    var stiftung_steuer_pa = vuv_pa * 0.158;  // ähnlich GmbH

    return {
      empfohlen: true,
      portfolio_volumen: vw,
      holding: {
        steuer_pa: holding_steuer_pa,
        setup_kosten: holding_setup_kosten,
        laufend_pa: holding_laufend_pa,
        gesamt_30j: holding_steuer_pa * 30 + holding_setup_kosten + holding_laufend_pa * 30,
        vorteil: 'Flexibel, gewerbliche Tätigkeit möglich, Verkauf/Übertragung der Anteile einfach',
        nachteil: 'vGA-Risiko, Pflichtteilsansprüche bei Erbe, Schenkungsteuer bei Übertragung über Freibetrag'
      },
      stiftung: {
        setup_steuer: stiftung_setup_steuer,
        steuer_pa: stiftung_steuer_pa,
        ersatz_erbst_30j: stiftung_ersatz_erbst_30j,
        setup_kosten: stiftung_setup_kosten,
        laufend_pa: stiftung_laufend_pa,
        gesamt_30j: stiftung_setup_steuer + stiftung_setup_kosten + stiftung_steuer_pa * 30 + stiftung_laufend_pa * 30 + stiftung_ersatz_erbst_30j,
        vorteil: 'Kein vGA-Risiko, Schutz vor Pflichtteil, Generationenvermögen, kein Anteilsverkauf zwischen Erben',
        nachteil: 'Schenkungsteuer bei Errichtung, Ersatz-ErbSt alle 30 J., höhere Kosten, unwiderruflich'
      },
      empfehlung: vw > 3000000
        ? 'Stiftung empfohlen — Generationenvermögen, kein vGA-Risiko'
        : 'Holding empfohlen — flexibler bei diesem Volumen'
    };
  }

  function _calcGmbhVerkaufAnalyse(inp, rows) {
    var pct = (inp.gmbh_verkauf_pct || 7) / 100;
    if (pct < 0.04) pct = 0.04;  // BFH-Untergrenze hart
    if (pct > 0.20) pct = 0.20;  // Faustregel-Obergrenze

    // Bundesland-spezifische GrESt
    var bundeslandGrESt = {
      'BW': 5.0, 'BY': 3.5, 'BE': 6.0, 'BB': 6.5, 'HB': 5.0, 'HH': 5.5,
      'HE': 6.0, 'MV': 6.0, 'NI': 5.0, 'NW': 6.5, 'RP': 5.0, 'SL': 6.5,
      'SN': 5.5, 'ST': 5.0, 'SH': 6.5, 'TH': 6.5
    };
    var grEStPct = bundeslandGrESt[inp.bundesland || 'NW'] || 6.5;

    // Pro Objekt prüfen, ob Verkauf an GmbH lohnt
    var kandidaten = [];
    var nichtGeeignet = [];
    rows.forEach(function(r) {
      var vw = r.verkehrswert || r.kp || 0;
      var kp_an_gmbh = vw * pct;
      // GrESt bei Standard-Verkauf (zum Marktwert): vw × grEStPct
      var grest_standard = vw * grEStPct / 100;
      // GrESt bei 7 %-Verkauf: kp_an_gmbh × grEStPct
      var grest_7pct = kp_an_gmbh * grEStPct / 100;
      // Ersparnis
      var grest_ersparnis = grest_standard - grest_7pct;

      // Verdeckte Einlage = Differenz Verkehrswert − Kaufpreis
      var verdeckte_einlage = vw - kp_an_gmbh;

      // Voraussetzungs-Check
      var spekfrist_ok = (r.spekfrist_rest || 0) <= 0;
      var halte_dauer_jahre = r.halte_dauer || 0;

      var entry = {
        id: r.id,
        kuerzel: r.kuerzel,
        adresse: r.adresse,
        verkehrswert: vw,
        kp_an_gmbh: kp_an_gmbh,
        grest_standard: grest_standard,
        grest_7pct: grest_7pct,
        grest_ersparnis: grest_ersparnis,
        verdeckte_einlage: verdeckte_einlage,
        halte_dauer_jahre: halte_dauer_jahre,
        spekfrist_ok: spekfrist_ok,
        spekfrist_rest: r.spekfrist_rest,
        // Anschaffungskosten der Beteiligung steigen um diese Summe
        anschaffungskosten_beteiligung_plus: verdeckte_einlage,
        // AfA-Bemessungsgrundlage in der GmbH = Verkehrswert (Teilwert)
        // → höhere AfA als bei Kauf zum Marktpreis (weil Tilgung in privat
        //   bereits stattfand → Buchwert war niedriger)
        afa_basis_in_gmbh: vw,
        afa_y_neu_in_gmbh: vw * 0.75 * 0.02  // 75 % Geb-Anteil × 2 % AfA
      };

      if (spekfrist_ok && halte_dauer_jahre >= 10) {
        kandidaten.push(entry);
      } else {
        entry.grund_nicht_geeignet = halte_dauer_jahre < 10
          ? 'Halte-Dauer < 10 Jahre — §23 EStG-Spekulationsfrist nicht abgelaufen'
          : 'Spekulationsfrist läuft noch (' + (r.spekfrist_rest || 0) + ' J. Rest)';
        nichtGeeignet.push(entry);
      }
    });

    // Sortiere nach GrESt-Ersparnis
    kandidaten.sort(function(a, b) { return b.grest_ersparnis - a.grest_ersparnis; });

    // Aggregat
    var summe_grest_ersparnis = kandidaten.reduce(function(s, e) { return s + e.grest_ersparnis; }, 0);
    var summe_verdeckte_einlage = kandidaten.reduce(function(s, e) { return s + e.verdeckte_einlage; }, 0);
    var summe_kapitalruecklage = summe_verdeckte_einlage; // Geht in Kapitalrücklage

    return {
      pct_verwendet: pct * 100,
      pct_grenze_unten: 4.0,
      pct_grenze_oben: 20.0,
      grest_pct: grEStPct,
      bundesland: inp.bundesland,
      kandidaten: kandidaten,
      nicht_geeignet: nichtGeeignet,
      summe_grest_ersparnis: summe_grest_ersparnis,
      summe_verdeckte_einlage: summe_verdeckte_einlage,
      summe_kapitalruecklage: summe_kapitalruecklage,
      anzahl_kandidaten: kandidaten.length,
      anzahl_nicht_geeignet: nichtGeeignet.length,
      paragraphen: ['§8 Abs.3 S.3 KStG', '§6 Abs.1 Nr.5 EStG', '§6 Abs.6 S.2 EStG',
                    '§8 Abs.2 Nr.1 GrEStG', '§27 KStG (Einlagekonto)', '§23 EStG (Spekfrist)']
    };
  }

  // ── V137: PORTFOLIO-BESCHREIBUNG & BEWERTUNG ────────────────────
  // Erzeugt eine textliche Zusammenfassung + Stärken/Schwächen-Liste
  // auf Basis aller aggregierten Werte.
  function _calcPortfolioBewertung(port, rows) {
    var staerken = [];
    var schwaechen = [];
    var charakter = '';

    // Größe
    if (port.count === 0) {
      charakter = 'Kein Bestand vorhanden — Strategie zielt auf Erst-Kauf.';
      return { charakter: charakter, staerken: staerken, schwaechen: schwaechen, score: 0 };
    } else if (port.count === 1) {
      charakter = 'Einsteiger-Portfolio mit einem Objekt. ';
    } else if (port.count <= 3) {
      charakter = 'Kleines Portfolio mit ' + port.count + ' Objekten. ';
    } else if (port.count <= 7) {
      charakter = 'Mittelgroßes Portfolio mit ' + port.count + ' Objekten. ';
    } else {
      charakter = 'Großes Portfolio mit ' + port.count + ' Objekten — Profi-Niveau. ';
    }

    // Charakter durch Investitionsvolumen
    if (port.gi > 2000000) {
      charakter += 'Investitions-Volumen ' + Math.round(port.gi / 1000000 * 10) / 10 + ' Mio €. ';
    } else if (port.gi > 500000) {
      charakter += 'Investitions-Volumen ' + Math.round(port.gi / 1000) + 'k €. ';
    }

    // Cashflow
    if (port.vuv_y > 50000) {
      staerken.push('Starker laufender V+V-Überschuss (' + Math.round(port.vuv_y / 1000) + 'k €/J) — solide Basis für Skalierung oder Entschuldung.');
    } else if (port.vuv_y > 15000) {
      staerken.push('Positiver V+V-Überschuss von ' + Math.round(port.vuv_y / 1000) + 'k €/J — Portfolio trägt sich.');
    } else if (port.vuv_y > 0) {
      // neutral
    } else if (port.vuv_y > -5000) {
      schwaechen.push('V+V-Überschuss leicht negativ (' + Math.round(port.vuv_y / 1000) + 'k €/J) — Verluste werden steuerlich angerechnet, aber Cashflow muss aus anderen Quellen kommen.');
    } else {
      schwaechen.push('V+V deutlich negativ (' + Math.round(port.vuv_y / 1000) + 'k €/J) — Portfolio ist subventioniert vom Hauptberuf.');
    }

    // LTV
    var ltv = port.ltv_aktuell || port.ltv;
    if (ltv != null) {
      if (ltv < 0.5) {
        staerken.push('Niedriger LTV ' + Math.round(ltv * 100) + ' % — viel Beleihungs-Reserve, hohe Bonität bei Banken.');
      } else if (ltv < 0.75) {
        staerken.push('Solider LTV ' + Math.round(ltv * 100) + ' % — gesundes Verhältnis Eigen-/Fremdkapital.');
      } else if (ltv < 0.95) {
        // neutral
      } else {
        schwaechen.push('Hoher LTV ' + Math.round(ltv * 100) + ' % — wenig Manövrier-Spielraum, Anschluss-Finanzierung könnte teuer werden.');
      }
    }

    // Beleihungs-Reserve
    if ((port.beleihungs_reserve || 0) > 200000) {
      staerken.push('Beträchtliche Beleihungs-Reserve (' + Math.round(port.beleihungs_reserve / 1000) + 'k €) — kann als EK für Zukäufe rotieren ohne Bestandsverkauf.');
    } else if ((port.beleihungs_reserve || 0) > 50000) {
      staerken.push('Beleihungs-Reserve von ' + Math.round(port.beleihungs_reserve / 1000) + 'k € verfügbar — partiell als Wachstums-EK nutzbar.');
    }

    // DSCR
    if (port.dscr != null && port.dscr > 1.5) {
      staerken.push('Hoher DSCR ' + port.dscr.toFixed(2) + ' — Mieten decken Kapitaldienst mit großem Puffer.');
    } else if (port.dscr != null && port.dscr < 1.0) {
      schwaechen.push('DSCR < 1 (' + port.dscr.toFixed(2) + ') — Mieten reichen nicht zur Deckung von Zins+Tilgung.');
    }

    // Spekulations-Frist
    var spekfrist_abgelaufen = rows.filter(function(r) { return (r.spekfrist_rest || 0) <= 0; }).length;
    if (spekfrist_abgelaufen >= 2) {
      staerken.push(spekfrist_abgelaufen + ' Objekt(e) sind §23 EStG-frei — flexibel für Verkauf, GmbH-Übertragung, Reinvest.');
    }

    // Lage
    if (port.lageAvg != null) {
      if (port.lageAvg >= 75) {
        staerken.push('Sehr gute Ø Lage-Qualität (' + port.lageAvg + '/100) — wertsichernd.');
      } else if (port.lageAvg < 55) {
        schwaechen.push('Schwache Ø Lage (' + port.lageAvg + '/100) — Aufwärts-Potenzial begrenzt, Faktor-Arbitrage prüfen.');
      }
    }

    // Mietlücke
    if ((port.mietluecke_total_y || 0) > 5000) {
      schwaechen.push('Mietlücke ' + Math.round(port.mietluecke_total_y / 1000) + 'k €/J ungenutzt — § 558 BGB-Anpassungen sofort starten.');
    }

    // Klumpen-Risiko
    if ((port.klumpen_max || 0) >= 4) {
      schwaechen.push('Klumpen-Risiko: ' + port.klumpen_max + ' Objekte am gleichen Ort — strukturelles Standort-Risiko.');
    }

    // Energie
    if ((port.energie_risiko_objects || []).length > 0) {
      schwaechen.push((port.energie_risiko_objects || []).length + ' Objekt(e) Klassen F/G/H — GEG-Risiko bis 2028.');
    }

    // Score 0-100 — grobe Einschätzung
    var score = 50;
    score += staerken.length * 8;
    score -= schwaechen.length * 7;
    score = Math.max(0, Math.min(100, score));

    var einstufung = score >= 80 ? 'Exzellent'
                   : score >= 65 ? 'Gut'
                   : score >= 50 ? 'Solide'
                   : score >= 35 ? 'Verbesserungs-Bedarf'
                   : 'Kritisch';

    return {
      charakter: charakter,
      staerken: staerken,
      schwaechen: schwaechen,
      score: score,
      einstufung: einstufung
    };
  }

  function _calcZukaufPlan(inp, port, rows) {
    var bundeslandGrESt = {
      'BW': 5.0, 'BY': 3.5, 'BE': 6.0, 'BB': 6.5, 'HB': 5.0, 'HH': 5.5,
      'HE': 6.0, 'MV': 6.0, 'NI': 5.0, 'NW': 6.5, 'RP': 5.0, 'SL': 6.5,
      'SN': 5.5, 'ST': 5.0, 'SH': 6.5, 'TH': 6.5
    };
    var grEStPct = bundeslandGrESt[inp.bundesland || 'NW'] || 6.5;
    var maklerStandard = 3.57;
    var notarGrundbuch = 1.5;
    var nebenkostenPctMitMakler = grEStPct + notarGrundbuch + maklerStandard;
    var nebenkostenPctOhneMakler = grEStPct + notarGrundbuch;

    // V136: Klare Trennung Objekte vs. Wohneinheiten
    // ziel_objekte_pa: wie viele EINZELNE OBJEKTE (= Kaufverträge) pro Jahr
    // we_pro_objekt:   Wohneinheiten je Objekt (1 = ETW, 4-8 = MFH)
    var objekteProJahr = (typeof inp.ziel_objekte_pa === 'number')
      ? inp.ziel_objekte_pa
      : (inp.zielenheiten_pa || 0);
    var wePerObjekt = inp.we_pro_objekt || 1;
    var weProJahr = objekteProJahr * wePerObjekt;

    var kpAvg = (inp.kp_min_geplant + inp.kp_max_geplant) / 2;
    var nebenkostenEurMakler = kpAvg * nebenkostenPctMitMakler / 100;
    var nebenkostenEurOhneMakler = kpAvg * nebenkostenPctOhneMakler / 100;

    var ek_bedarf_min = nebenkostenEurOhneMakler;
    var ek_bedarf_solid = nebenkostenEurMakler + kpAvg * 0.10;
    var ek_bedarf_sicher = nebenkostenEurMakler + kpAvg * 0.20;

    // V136: Drei Finanzierungs-MODELLE
    var zinssatz = (inp.marktzins_pct || 3.9) / 100;
    var zinssatz20J = zinssatz + 0.004;
    var tilgung2 = 0.02;

    function _restschuldNach(jahre, darlehen, zinssatzM, tilgungM) {
      // Korrekte Annuitäten-Restschuld-Formel
      var q = 1 + zinssatzM;
      var n = jahre;
      var ann = darlehen * (zinssatzM + tilgungM);
      // Rest = Ursprung × q^n - Annuität × (q^n - 1) / (q - 1)
      var rs = darlehen * Math.pow(q, n) - ann * (Math.pow(q, n) - 1) / (q - 1);
      return Math.max(0, rs);
    }

    var modelle = [
      {
        key: 'standard',
        label: 'Standard 80/20',
        kurz: '20 % EK + 80 % Darlehen, 10 J., 2 % Tilgung',
        ltv: 0.80, ek_pct: 0.20, zinsbindung_jahre: 10, tilgung_pct: 2,
        zinssatz: zinssatz,
        ek_eur: nebenkostenEurMakler + kpAvg * 0.20,
        darlehen: kpAvg * 0.80,
        annuitaet_y: kpAvg * 0.80 * (zinssatz + tilgung2),
        restschuld_10j: _restschuldNach(10, kpAvg * 0.80, zinssatz, tilgung2),
        beschreibung: 'Bank-Standard. Geringes Zinsausfall-Risiko, 30+ J. Gesamt-Tilgung. Eignet sich fuer Sicherheits-Profile und Altersvorsorge.',
        passt_zu_ziel: ['altersvorsorge', 'langfristig_halten', 'cashflow_jetzt']
      },
      {
        key: 'minimal_ek',
        label: 'Minimaler EK-Einsatz 90/10',
        kurz: 'Nur Nebenkosten + 5 % EK, ~95-100 % Darlehen',
        ltv: 1.00, ek_pct: 0.05, zinsbindung_jahre: 10, tilgung_pct: 2,
        zinssatz: zinssatz + 0.003,
        ek_eur: nebenkostenEurMakler + kpAvg * 0.05,
        darlehen: kpAvg * 1.00,
        annuitaet_y: kpAvg * 1.00 * (zinssatz + 0.003 + tilgung2),
        restschuld_10j: _restschuldNach(10, kpAvg * 1.00, zinssatz + 0.003, tilgung2),
        beschreibung: 'EK-effizient. Maximale Skalierung — mehrere Objekte parallel moeglich. Aber: kein Sicherheits-Puffer bei Zins-Anstieg in der Anschluss-Finanzierung.',
        passt_zu_ziel: ['wachstum', 'vermoegen_aufbauen']
      },
      {
        key: 'lange_bindung',
        label: 'Lange Bindung 80/20, 20 J.',
        kurz: '20 % EK, 20 J. Zinsbindung, 2 % Tilgung',
        ltv: 0.80, ek_pct: 0.20, zinsbindung_jahre: 20, tilgung_pct: 2,
        zinssatz: zinssatz20J,
        ek_eur: nebenkostenEurMakler + kpAvg * 0.20,
        darlehen: kpAvg * 0.80,
        annuitaet_y: kpAvg * 0.80 * (zinssatz20J + tilgung2),
        restschuld_10j: _restschuldNach(10, kpAvg * 0.80, zinssatz20J, tilgung2),
        beschreibung: 'Zinssicherheit ueber 20 J. Bei Marktzins-Anstieg gewinnt diese Variante. Pflicht bei Altersvorsorge nahe Renteneintritt.',
        passt_zu_ziel: ['altersvorsorge', 'erbschaft']
      }
    ];

    var aktivesZiel = inp.ziel || 'wachstum';
    modelle.forEach(function(m) {
      m.empfohlen_fuer_aktives_ziel = m.passt_zu_ziel.indexOf(aktivesZiel) >= 0;
    });
    var empfohlenesModell = modelle.filter(function(m) { return m.empfohlen_fuer_aktives_ziel; })[0]
                          || modelle[0];

    // Backwards-compat
    var darlehenSolid = kpAvg * 0.80;
    var darlehenAggressiv = kpAvg * 1.00;
    var annuitaetSolid = darlehenSolid * (zinssatz + tilgung2);
    var annuitaetAgg = darlehenAggressiv * (zinssatz + tilgung2);

    var nettoEinkommen = (inp.base_income_zve || 0) * 0.70;
    var sparQuoteAbs = nettoEinkommen * (inp.sparquote_pct || 15) / 100;
    var beleihReserveProJahr = (port.beleihungs_reserve || 0) / 5;
    var ek_zufluss_y = sparQuoteAbs + beleihReserveProJahr;

    var ekBedarfProJahr_solid = objekteProJahr * ek_bedarf_solid;
    var ekBedarfProJahr_minimal = objekteProJahr * (nebenkostenEurMakler + kpAvg * 0.05);
    var ekBedarfProJahr_sicher = objekteProJahr * ek_bedarf_sicher;

    var deckungsquote = ekBedarfProJahr_solid > 0 ? ek_zufluss_y / ekBedarfProJahr_solid : 1;
    var jahre_bis_naechster_kauf = objekteProJahr > 0
      ? ek_bedarf_solid / Math.max(ek_zufluss_y, 1)
      : null;

    var bestandsAnnuitaet = (port.zins_y || 0) + (port.tilg_y || 0);
    var neueAnnuitaeten = objekteProJahr * annuitaetSolid;
    var gesamtAnnuitaet = bestandsAnnuitaet + neueAnnuitaeten;
    var belastungsquote = nettoEinkommen > 0 ? gesamtAnnuitaet / nettoEinkommen : null;

    // V136: 5-Jahres-Hochrechnung
    var prognose5j = {
      neue_objekte: objekteProJahr * 5,
      neue_einheiten: weProJahr * 5,
      gesamt_kp_zukauf: objekteProJahr * 5 * kpAvg,
      gesamt_ek_einsatz_solid: objekteProJahr * 5 * ek_bedarf_solid,
      gesamt_neue_annuitaet: objekteProJahr * 5 * annuitaetSolid,
      neue_mieten_y: (objekteProJahr * 5 * kpAvg) / 22,
      bestand_neu_count: (port.count || 0) + objekteProJahr * 5,
      bestand_neu_einheiten: ((port.einheiten_total || port.count || 0)) + weProJahr * 5
    };

    // V136: Steuer-Hebel
    var afaPaProObjekt = kpAvg * 0.75 * 0.02;
    var afaPaRndProObjekt = kpAvg * 0.75 * 0.035;
    var grenzPriv = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
      ? Tax.calcGrenzsteuersatz((inp.base_income_zve || 60000))
      : 0.42;
    var steuerhebel = {
      afa_pa_pro_obj: afaPaProObjekt,
      afa_pa_pro_obj_rnd: afaPaRndProObjekt,
      steuer_ersparnis_pa_pro_obj: afaPaProObjekt * grenzPriv,
      steuer_ersparnis_pa_pro_obj_rnd: afaPaRndProObjekt * grenzPriv,
      grenzsteuersatz: grenzPriv,
      steuer_ersparnis_5j_solid: 5 * objekteProJahr * afaPaProObjekt * grenzPriv,
      steuer_ersparnis_5j_rnd: 5 * objekteProJahr * afaPaRndProObjekt * grenzPriv
    };

    return {
      ziel: inp.ziel,
      ziel_horizon_jahre: inp.ziel_horizon_jahre,
      praeferenz_typ: inp.praeferenz_typ,
      ziel_objekte_pa: objekteProJahr,
      we_pro_objekt: wePerObjekt,
      ziel_einheiten_pa: weProJahr,
      zielenheiten_pa: objekteProJahr,
      kp_avg: kpAvg,
      kp_korridor: [inp.kp_min_geplant, inp.kp_max_geplant],
      marktzins_pct: inp.marktzins_pct,
      marktzins_stand: inp.marktzins_stand,
      bundesland: inp.bundesland,
      grest_pct: grEStPct,
      nebenkosten_pct: nebenkostenPctMitMakler,
      nebenkosten_pct_ohne_makler: nebenkostenPctOhneMakler,
      nebenkosten_eur: nebenkostenEurMakler,
      nebenkosten_eur_ohne_makler: nebenkostenEurOhneMakler,
      ek_bedarf_min: ek_bedarf_min,
      ek_bedarf_solid: ek_bedarf_solid,
      ek_bedarf_sicher: ek_bedarf_sicher,
      modelle: modelle,
      empfohlenes_modell: empfohlenesModell.key,
      darlehen_solid: darlehenSolid,
      darlehen_aggressiv: darlehenAggressiv,
      annuitaet_solid: annuitaetSolid,
      annuitaet_aggressiv: annuitaetAgg,
      sparquote_abs: sparQuoteAbs,
      beleihreserve_pa: beleihReserveProJahr,
      ek_zufluss_y: ek_zufluss_y,
      ek_bedarf_pa: ekBedarfProJahr_solid,
      ek_bedarf_pa_minimal: ekBedarfProJahr_minimal,
      ek_bedarf_pa_sicher: ekBedarfProJahr_sicher,
      deckungsquote: deckungsquote,
      jahre_bis_naechster_kauf: jahre_bis_naechster_kauf,
      bestand_annuitaet: bestandsAnnuitaet,
      neue_annuitaeten: neueAnnuitaeten,
      gesamt_annuitaet: gesamtAnnuitaet,
      belastungsquote: belastungsquote,
      prognose5j: prognose5j,
      steuerhebel: steuerhebel,
      sparquote_status: deckungsquote >= 1 ? 'ausreichend'
                       : deckungsquote >= 0.7 ? 'knapp'
                       : 'unzureichend',
      sparquote_empfohlen: deckungsquote < 1
        ? Math.min(40, Math.round((inp.sparquote_pct || 15) * (1 / Math.max(deckungsquote, 0.3))))
        : (inp.sparquote_pct || 15),
      belastung_status: belastungsquote == null ? 'unklar'
                      : belastungsquote < 0.30 ? 'gut'
                      : belastungsquote < 0.40 ? 'akzeptabel'
                      : 'kritisch'
    };
  }

  async function loadAndAnalyze() {
    var raw = await _loadObjects();
    _state.objects = raw;
    var allRows = raw.map(_aggregateObject).filter(function(r) { return r.kp > 0; });

    // V137: Objekt-Auswahl-Filter
    // Wenn ausgewaehlte_objekte gesetzt ist, nur diese in die Strategie einbeziehen.
    // Sonst alle Objekte verwenden.
    var auswahl = _state.inputs.ausgewaehlte_objekte;
    var rows;
    if (Array.isArray(auswahl) && auswahl.length > 0) {
      rows = allRows.filter(function(r) { return auswahl.indexOf(r.id) >= 0; });
      if (rows.length === 0) {
        // Falls Auswahl leer ist (User hat versehentlich alle abgewählt): alle nehmen
        rows = allRows;
      }
    } else {
      rows = allRows;
    }
    // Merke "alle Objekte" für UI-Auswahl-Liste
    _state.allRows = allRows;

    // V131: Pro-Objekt DealScore2 berechnen, Lage/Upside extrahieren
    rows.forEach(function(r) {
      r.dealScore2 = _computeDS2ForRow(r);
    });

    var port = _aggregatePortfolio(rows);

    // V131: Portfolio-Lage-Aggregat
    port.lageAvg = _avgLageScore(rows);
    port.upsideAvg = _avgUpsideScore(rows);
    port.topLageObjects = rows
      .filter(function(r) { return r.dealScore2 && r.dealScore2.lageScore != null; })
      .sort(function(a, b) { return (b.dealScore2.lageScore || 0) - (a.dealScore2.lageScore || 0); })
      .slice(0, 3)
      .map(function(r) { return { kuerzel: r.kuerzel, lage: r.dealScore2.lageScore, upside: r.dealScore2.upsideScore }; });
    port.weakLageObjects = rows
      .filter(function(r) { return r.dealScore2 && r.dealScore2.lageScore != null && r.dealScore2.lageScore < 50; })
      .map(function(r) { return { kuerzel: r.kuerzel, lage: r.dealScore2.lageScore }; });

    // V134: Markt-/Upside-Aggregate für neue Strategien
    // Mietkonvergenz: Summe der jährlichen Mietlücken über alle Objekte
    port.mietluecke_total_y = rows.reduce(function(s, r) {
      return s + (r.miete_luecke_y && r.miete_luecke_y > 0 ? r.miete_luecke_y : 0);
    }, 0);
    port.mietluecke_objects = rows
      .filter(function(r) { return r.miete_luecke_y && r.miete_luecke_y > 1000; })
      .sort(function(a, b) { return (b.miete_luecke_y || 0) - (a.miete_luecke_y || 0); })
      .map(function(r) { return { kuerzel: r.kuerzel, luecke_y: r.miete_luecke_y, ist_qm: r.ist_miete_qm, markt_qm: r.marktmiete_qm }; });

    // Faktor-Arbitrage: zu hohe Kaufpreis-Multiplikatoren identifizieren
    // (Faktor = KP / Jahres-Kaltmiete) — über 25 ist meist überzahlt für die Lage
    port.objektFaktoren = rows
      .filter(function(r) { return r.nkm_y > 0; })
      .map(function(r) {
        return {
          kuerzel: r.kuerzel,
          faktor: r.kp / r.nkm_y,
          verkehrsfaktor: r.verkehrswert / r.nkm_y,
          lage_score: r.dealScore2 ? r.dealScore2.lageScore : null
        };
      });
    port.ueberteuert_count = port.objektFaktoren.filter(function(o) {
      return o.lage_score != null && o.lage_score < 60 && o.verkehrsfaktor > 25;
    }).length;
    port.unterbewertet_count = port.objektFaktoren.filter(function(o) {
      return o.lage_score != null && o.lage_score >= 70 && o.verkehrsfaktor < 22;
    }).length;

    // Wachstums-Hotspots: Objekte mit Bevölkerungswachstum + starker Nachfrage
    port.hotspot_objects = rows
      .filter(function(r) {
        var d = r._raw || {};
        var bev = d.ds2_bevoelkerung || d.bevoelkerung;
        var nach = d.ds2_nachfrage || d.nachfrage;
        return (bev === 'stark_wachsend' || bev === 'wachsend')
          && (nach === 'sehr_stark' || nach === 'stark');
      })
      .map(function(r) { return { kuerzel: r.kuerzel, ort: (r._raw||{}).ort }; });

    // Klumpenrisiko: Wie viele Objekte am selben Ort?
    var orteCounts = {};
    rows.forEach(function(r) {
      var o = (r._raw || {}).ort || 'unbekannt';
      orteCounts[o] = (orteCounts[o] || 0) + 1;
    });
    port.klumpen_orte = Object.keys(orteCounts)
      .filter(function(o) { return orteCounts[o] >= 2; })
      .map(function(o) { return { ort: o, anzahl: orteCounts[o] }; })
      .sort(function(a, b) { return b.anzahl - a.anzahl; });
    port.klumpen_max = port.klumpen_orte.length > 0 ? port.klumpen_orte[0].anzahl : 0;

    // Energie-Risiko: Objekte mit Energieklasse F/G/H
    port.energie_risiko_objects = rows
      .filter(function(r) {
        var e = (r._raw || {}).ds2_energie || (r._raw || {}).energieklasse;
        return e === 'F' || e === 'G' || e === 'H';
      })
      .map(function(r) {
        return { kuerzel: r.kuerzel, klasse: (r._raw || {}).ds2_energie || (r._raw || {}).energieklasse, wfl: r.wfl };
      });

    // V135: Zukauf-Plan-Analyse aus Ziel-Inputs
    port.zukaufPlan = _calcZukaufPlan(_state.inputs, port, rows);
    port.ziel = ZIELE[_state.inputs.ziel] || ZIELE.wachstum;
    // V137: GmbH-Verkauf-Analyse (verdeckte Einlage)
    port.gmbhVerkauf = _calcGmbhVerkaufAnalyse(_state.inputs, rows);
    // V138: Eigenheimschaukel + KP-Aufteilung + Stiftung-Vergleich
    port.eigenheimSchaukel = _calcEigenheimSchaukelAnalyse(_state.inputs);
    port.kpAufteilung = _calcKpAufteilungHebel(_state.inputs);
    port.stiftungVergleich = _calcFamilienstiftungVsHolding(_state.inputs, port);
    // V137: Portfolio-Bewertung mit Stärken/Schwächen
    port.bewertung = _calcPortfolioBewertung(port, rows);

    var keys = ['privat_basis', 'privat_optimiert', 'vvgmbh_neu', 'vvgmbh_selektiv', 'vvgmbh_komplett', 'holding_struktur', 'konzern_opgmbh', 'wachstum_ltv', 'rollierendes_ek', 'stretch_sanierung'];
    var profile = PROFILES[_state.inputs.profile] || PROFILES.cashflow;
    var scenarios = keys.map(function(k) {
      var s = _calcScenario(k, port, rows);
      // Score nach aktuellem Profil neu berechnen
      s.score = _scenarioScore(s, profile);
      return s;
    });

    // Pro-Objekt-Verdikte
    var verdicts = rows.map(function(r) {
      return { object: r, verdicts: _verdictsForObject(r, profile) };
    });

    // Aggregierte Empfehlungen (Top-Hits über alle Objekte)
    var topVerdicts = _aggregateVerdicts(verdicts);

    // V128: Strategische Gesamtempfehlung (narrative)
    var narrative = _buildStrategicNarrative(rows, port, verdicts, profile, scenarios);

    // V129: Multi-Strategien + Peer-Vergleich
    var multi = _buildMultiStrategien(rows, port, verdicts, scenarios);

    // V133: GmbH-Tier-Bewertung
    var grenzNow = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
      ? Tax.calcGrenzsteuersatz(_state.inputs.base_income_zve + (port.vuv_y || 0))
      : 0.42;
    var gmbhTier = _gmbhTierAdjusted(port.vuv_y, {
      hat_struktur: _state.inputs.hat_struktur,
      grenz: grenzNow
    });

    _state.results = {
      portfolio: port,
      rows: rows,
      scenarios: scenarios,
      verdicts: verdicts,
      topVerdicts: topVerdicts,
      narrative: narrative,
      strategien: multi.strategien,
      peers: multi.peers,
      profile: profile,
      gmbhTier: gmbhTier,
      gmbhTiers: GMBH_TIERS,
      bestByNPV: scenarios.slice().sort(function(a, b) { return b.horizon.npv - a.horizon.npv; })[0],
      bestByScore: scenarios.slice().sort(function(a, b) { return b.score - a.score; })[0],
      timestamp: new Date().toISOString()
    };
    return _state.results;
  }

  // Aggregiert Verdikte über alle Objekte und liefert Top-Empfehlungen.
  function _aggregateVerdicts(perObject) {
    var grouped = {};
    perObject.forEach(function(item) {
      item.verdicts.forEach(function(v) {
        if (!grouped[v.code]) {
          grouped[v.code] = { code: v.code, severity: v.severity, label: v.label, count: 0, total_impact: 0, objects: [] };
        }
        grouped[v.code].count++;
        grouped[v.code].total_impact += v.impact_eur || 0;
        grouped[v.code].objects.push({ kuerzel: item.object.kuerzel, impact: v.impact_eur || 0 });
      });
    });
    return Object.keys(grouped)
      .map(function(k) { return grouped[k]; })
      .sort(function(a, b) {
        var sevOrder = { opportunity: 0, warning: 1, info: 2 };
        if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
        return (b.total_impact || 0) - (a.total_impact || 0);
      });
  }

  // ── STRATEGISCHE GESAMTEMPFEHLUNG (V128) ────────────────────────
  // Generiert eine narrative Empfehlung für das Gesamtportfolio:
  //   – Wo sollte zuerst gehandelt werden?
  //   – Welche Strukturentscheidung anstehen?
  //   – Welche Objekte sind Hebel, welche sind stabilisierend?
  //   – In welcher Reihenfolge?
  // Liefert ein Objekt mit:
  //   { headline, situation, naechste_schritte: [{prio, titel, detail, impact_eur}],
  //     struktur_empfehlung: {jetzt, in_2_3_jahren, langfristig},
  //     warnings: [...] }
  function _buildStrategicNarrative(rows, port, verdicts, profile, scenarios) {
    var inp = _state.inputs;
    var schritte = [];
    var warnings = [];

    // Sammle Verdikte aller Objekte mit Impact-Summen pro Code
    var byCode = {};
    verdicts.forEach(function(item) {
      item.verdicts.forEach(function(vd) {
        if (!byCode[vd.code]) byCode[vd.code] = { count: 0, total: 0, objects: [], samples: [] };
        byCode[vd.code].count++;
        byCode[vd.code].total += vd.impact_eur || 0;
        byCode[vd.code].objects.push(item.object.kuerzel);
        if (byCode[vd.code].samples.length < 2) byCode[vd.code].samples.push(item);
      });
    });

    var has = function(code) { return byCode[code] && byCode[code].count > 0; };
    var get = function(code) { return byCode[code] || { count: 0, total: 0, objects: [] }; };

    // ── PRIORITÄT 1: Sofort-Steuer-Ersparnis (RND-Gutachten) ────
    // V130: Nur Objekte mit RND_GUTACHTEN_LOHNT/DRINGEND/PRUEFEN zählen
    // (alle haben den 2%-Filter bestanden). RND_BAUZUSTAND_PRUEFEN ist
    // nur ein Hinweis und wird hier separat behandelt.
    var rndGutachtenCodes = ['RND_GUTACHTEN_DRINGEND', 'RND_GUTACHTEN_LOHNT', 'RND_GUTACHTEN_PRUEFEN'];
    var rndCount = rndGutachtenCodes.reduce(function(s, c) { return s + (byCode[c] ? byCode[c].count : 0); }, 0);
    var rndImpact = rndGutachtenCodes.reduce(function(s, c) { return s + (byCode[c] ? byCode[c].total : 0); }, 0);
    var rndBauHint = byCode['RND_BAUZUSTAND_PRUEFEN'] ? byCode['RND_BAUZUSTAND_PRUEFEN'].count : 0;
    if (rndCount > 0) {
      schritte.push({
        prio: 1,
        kategorie: 'Sofort-Hebel',
        titel: rndCount + (rndCount === 1 ? ' Objekt' : ' Objekte') + ' mit klarem RND-Gutachten-Hebel',
        detail: 'Bei ' + rndCount + ' Objekt(en) ergibt die Modellrechnung eine AfA-Quote über 2 % bei kürzerer Restnutzungsdauer — der Gutachten-Hebel ist also wirklich da. Gesamt­potenzial über die Restlaufzeit: ~' + Math.round(rndImpact).toLocaleString('de-DE') + ' €. Empfehlung: Gutachter beauftragen (typisch 800-1.500 €), Ergebnis beim FA per formlosem Antrag einreichen.' + (rndBauHint > 0 ? ' Zusätzlich ' + rndBauHint + ' Objekt(e) mit unklarem Bauzustand — Sanstand vor Ort prüfen, dann ggf. weiteres Potenzial.' : ''),
        impact_eur: rndImpact,
        objekte: rndGutachtenCodes.flatMap(function(c) { return byCode[c] ? byCode[c].objects : []; })
      });
    } else if (rndBauHint > 0) {
      // Nur Hinweis-Verdikt, ohne klares Gutachten-Lohnt
      schritte.push({
        prio: 1,
        kategorie: 'Sofort-Hebel',
        titel: rndBauHint + ' Objekt(e): Bauzustand vor Ort prüfen',
        detail: 'Bei ' + rndBauHint + ' Objekt(en) deutet die Heuristik auf RND-Potenzial hin, aber nur wenn der Bauzustand wirklich schlecht ist. Erst Sanstand auf 5 setzen, dann zeigt das Modul, ob ein Gutachten lohnt.',
        impact_eur: byCode['RND_BAUZUSTAND_PRUEFEN'].total,
        objekte: byCode['RND_BAUZUSTAND_PRUEFEN'].objects
      });
    }

    // ── PRIORITÄT 2: Mietanpassungen (sofort und ohne Investition) ──
    if (has('MIETSTEIGERUNG_MOEGLICH')) {
      var ms = get('MIETSTEIGERUNG_MOEGLICH');
      schritte.push({
        prio: 2,
        kategorie: 'Sofort-Hebel',
        titel: 'Mietanpassung an Markt für ' + ms.count + ' Objekt(e)',
        detail: 'Bei ' + ms.count + ' Objekt(en) liegt die Ist-Miete deutlich unter Marktniveau. §558 BGB erlaubt Anpassung in 20%-Schritten alle 3 Jahre. Netto-Effekt über 10 J.: ~' + Math.round(ms.total).toLocaleString('de-DE') + ' €. Bonus: höherer Verkehrswert → mehr Beleihungs­spielraum.',
        impact_eur: ms.total,
        objekte: ms.objects
      });
    }

    // ── PRIORITÄT 3: Werbungskosten / Sanierung steuerlich nutzen ──
    var sanCodes = ['SANIEREN_WERBUNGSKOSTEN', 'ANSCHAFFUNGSNAH_15PCT'];
    var sanImpact = sanCodes.reduce(function(s, c) { return s + (byCode[c] ? byCode[c].total : 0); }, 0);
    var sanCount = sanCodes.reduce(function(s, c) { return s + (byCode[c] ? byCode[c].count : 0); }, 0);
    if (sanCount > 0 && profile.tax_weight >= 0.3) {
      schritte.push({
        prio: 3,
        kategorie: 'Steuer-Hebel',
        titel: 'Erhaltungsaufwand gezielt einsetzen',
        detail: sanCount + ' Objekt(e) eignen sich als Werbungskosten-Hebel: bei sanierungsbedürftigen Objekten Sanierung als Erhaltungs­aufwand, bei frischen Käufen die 15%-Grenze (§6 Abs. 1 Nr. 1a EStG) ausnutzen. Empfehlung: jährliches Sanierungs­budget definieren und auf Objekte mit höchstem Bedarf konzentrieren. Steuer­ersparnis-Potenzial: ~' + Math.round(sanImpact).toLocaleString('de-DE') + ' €. Plus: Lohnsteuer­ermäßigung beantragen → Liquidität sofort statt erst nach Veranlagung.',
        impact_eur: sanImpact,
        objekte: sanCodes.flatMap(function(c) { return byCode[c] ? byCode[c].objects : []; })
      });
    }

    // ── PRIORITÄT 4: Strukturentscheidung (privat / VV-GmbH / Konzern) ──
    // Logik: Score-Sieger UND NPV-Sieger vergleichen
    var bestScore = scenarios.slice().sort(function(a, b) { return b.score - a.score; })[0];
    var bestNPV = scenarios.slice().sort(function(a, b) { return b.horizon.npv - a.horizon.npv; })[0];
    var struktur_empfehlung = {
      jetzt: '',
      in_2_3_jahren: '',
      langfristig: ''
    };

    // Klare Anweisungen pro Profil + Bestand-Größe + Score-Sieger
    if (port.count <= 2) {
      // Klein: kein GmbH-Aufwand
      struktur_empfehlung.jetzt = 'Bestand klein (' + port.count + ' Objekt(e)) — privat halten ist klar wirtschaftlich. Keine GmbH-Strukturen sinnvoll.';
      struktur_empfehlung.in_2_3_jahren = 'Bei Wachstum auf 4+ Objekte: VV-GmbH für Neukäufe vorbereiten (Hülle gründen).';
      struktur_empfehlung.langfristig = 'Ab 8+ Objekten oder geplanter Skalierung: Holding-Struktur prüfen.';
    } else if (port.count <= 5) {
      // Mittel
      struktur_empfehlung.jetzt = 'Bestand mittel (' + port.count + ' Objekte) — privat halten + Steuer­optimierung (Privat — Steueroptimiert: Score ' + (scenarios.find(function(s) { return s.key === 'privat_optimiert'; }) || {score:0}).score + ').';
      if (profile.growth_weight >= 0.4) {
        struktur_empfehlung.in_2_3_jahren = 'Neukäufe konsequent über VV-GmbH (Strategie 3 — Hülle gründen, GrESt für Bestand vermeiden).';
        struktur_empfehlung.langfristig = 'Ab 8+ Objekten oder Sanierungs­volumen >30k €/J: Holding + Op-GmbH prüfen.';
      } else {
        struktur_empfehlung.in_2_3_jahren = 'Selektives Umhängen: nur Objekte mit abgelaufener §23-Frist UND Steuervorteil > 30k € NPV.';
        struktur_empfehlung.langfristig = 'Holding-Strukturen erst bei klarem Exit-Plan (Verkauf von Anteilen statt Objekten).';
      }
    } else if (port.count <= 8) {
      // Größer
      struktur_empfehlung.jetzt = 'Bestand groß (' + port.count + ' Objekte) — Strukturentscheidung steht an. Empfohlenes Top-Szenario: ' + bestScore.label + ' (Score ' + bestScore.score + ').';
      if (inp.mit_opgmbh && inp.op_san_volumen_y >= 30000) {
        struktur_empfehlung.in_2_3_jahren = 'Op-GmbH einrichten — Sanierungs­volumen rechtfertigt eigene operative Hülle. Fahrtkosten, Personal und Material werden Betriebs­ausgabe.';
      } else {
        struktur_empfehlung.in_2_3_jahren = 'Wachstum konsequent über VV-GmbH (Neukäufe). Bestehende Objekte nach §23-Frist selektiv umhängen.';
      }
      struktur_empfehlung.langfristig = 'Holding über VV-GmbH(s) gründen für §8b KStG-Privileg bei Ausschüttungen → maximale Reinvestitions­quote.';
    } else {
      // Sehr groß
      struktur_empfehlung.jetzt = 'Bestand sehr groß (' + port.count + ' Objekte) — Konzernstruktur (' + scenarios.find(function(s) { return s.key === 'konzern_opgmbh'; }).label + ') ist mittel- bis langfristig die Königsklasse.';
      struktur_empfehlung.in_2_3_jahren = 'Aufbau-Reihenfolge: 1. Holding gründen, 2. VV-GmbH(s) als Töchter, 3. Op-GmbH für Sanierung/Vermarktung, 4. Bestand selektiv einbringen (nur §23-frei).';
      struktur_empfehlung.langfristig = 'Ab 15+ Objekten: separate VV-GmbHs für Risikostreuung (eine pro 5-7 Objekte). Op-GmbH übernimmt gewerbliche Tätigkeiten.';
    }

    // ── PRIORITÄT 5: EK-Freisetzung / Beleihung ─────────────────
    if (port.beleihungs_reserve > 100000 && profile.growth_weight >= 0.3) {
      var ek_codes = ['LTV_REFI_FREISETZEN', 'BANK_VERHANDLUNG', 'ROLL_EK_KANDIDAT'];
      var ekObjekte = [];
      ek_codes.forEach(function(c) { if (byCode[c]) ekObjekte = ekObjekte.concat(byCode[c].objects); });
      ekObjekte = Array.from(new Set(ekObjekte));
      schritte.push({
        prio: 4,
        kategorie: 'Wachstums-Hebel',
        titel: 'Beleihungs-Reserve aktivieren — ~' + Math.round(port.beleihungs_reserve).toLocaleString('de-DE') + ' € EK freisetzbar',
        detail: 'Im Gesamtbestand sind ~' + Math.round(port.beleihungs_reserve).toLocaleString('de-DE') + ' € Beleihungs-Reserve verfügbar (basierend auf Verkehrswerten und 80% Beleihungs­grenze). Diese kannst du in einem Bankgespräch realisieren — entweder als Aufstockung pro Objekt oder als rollierende Linie auf einem Anker. Hebel: bei 75% LTV im Neukauf entspricht das einem Investitions­volumen von ~' + Math.round(port.beleihungs_reserve * 4).toLocaleString('de-DE') + ' €.',
        impact_eur: port.beleihungs_reserve * 4 * 0.05 * 10,  // 5% Rendite auf 4× Hebel über 10 J
        objekte: ekObjekte
      });
    }

    // ── WARNINGS ─────────────────────────────────────────────────
    if (has('LTV_ZU_HOCH')) {
      var lt = get('LTV_ZU_HOCH');
      warnings.push({
        kategorie: 'Risiko',
        titel: lt.count + ' Objekt(e) über deiner Profil-LTV-Grenze',
        detail: 'Bei "' + profile.label + '" liegt die Toleranz-Grenze bei ' + Math.round(profile.ltv_max * 100) + '%. Prüfe: Sondertilgung, Mietanpassung (höherer Verkehrswert senkt LTV automatisch) oder Profilwechsel auf "Wachstum"/"Aggressiv", wenn diese LTVs gewollt sind.'
      });
    }
    if (has('PRIVAT_HALTEN_BIS_SPEKFRIST')) {
      var sp = get('PRIVAT_HALTEN_BIS_SPEKFRIST');
      warnings.push({
        kategorie: 'Timing',
        titel: sp.count + ' Objekt(e) noch in §23-Frist',
        detail: 'Strukturwechsel jetzt würde Spekulationsgewinne auslösen. Lieber warten oder § 6a UmwStG-Wege prüfen.'
      });
    }

    // Sortiere Schritte nach prio + Impact
    schritte.sort(function(a, b) {
      if (a.prio !== b.prio) return a.prio - b.prio;
      return (b.impact_eur || 0) - (a.impact_eur || 0);
    });

    // Headline + Situation
    var headline = '';
    var situation = '';
    if (rndCount > 0 && rndImpact > 20000) {
      headline = 'Größter Hebel: RND-Gutachten — bis zu ~' + Math.round(rndImpact).toLocaleString('de-DE') + ' € Steuerersparnis möglich.';
    } else if (port.beleihungs_reserve > 200000 && profile.growth_weight >= 0.4) {
      headline = 'Größter Hebel: ~' + Math.round(port.beleihungs_reserve).toLocaleString('de-DE') + ' € EK-Reserve aktivierbar für Wachstum.';
    } else if (sanImpact > 15000) {
      headline = 'Größter Hebel: Erhaltungsaufwand für ~' + Math.round(sanImpact).toLocaleString('de-DE') + ' € Steuerersparnis nutzen.';
    } else {
      headline = 'Bestand stabil — ' + bestScore.label + ' ist die beste Strategie für dein Profil "' + profile.label + '".';
    }

    var profil_passung = '';
    if (port.count >= 3) {
      profil_passung = ' Mit ' + port.count + ' Objekten und Profil "' + profile.label + '" ist die Wahl ';
      if (profile.growth_weight >= 0.5 && port.beleihungs_reserve < 50000) {
        profil_passung += '"' + profile.label + '" tendenziell zu offensiv für deinen aktuellen Bestand — wenig Beleihungs­reserve, wenig Wachstums­hebel.';
      } else if (profile.growth_weight <= 0.2 && port.ltv_aktuell > 0.8) {
        profil_passung += '"Sicherheit" passt nicht zu deiner aktuellen Struktur (Gesamt-LTV ' + Math.round(port.ltv_aktuell * 100) + '%) — entweder Profil anpassen oder Sondertilgung einleiten.';
      } else {
        profil_passung += '"' + profile.label + '" konsistent mit deinem Bestand.';
      }
    }
    situation = 'Bestand: ' + port.count + ' Objekte, Gesamt-Investment ' + Math.round(port.gi).toLocaleString('de-DE') + ' €, LTV ' + Math.round(port.ltv_aktuell * 100) + '%, Cashflow vor Steuer ' + Math.round(port.cf_vor_y).toLocaleString('de-DE') + ' €/J.' + profil_passung;

    return {
      headline: headline,
      situation: situation,
      naechste_schritte: schritte,
      struktur_empfehlung: struktur_empfehlung,
      warnings: warnings
    };
  }

  // ── MULTI-STRATEGIEN (V129) ─────────────────────────────────────
  // Generiert 3 alternative narrative Strategien (Steuern / Wachstum /
  // Sicherheit), unabhängig vom gewählten Profil. So sieht der User
  // alle Optionen nebeneinander, kann vergleichen und bewusst wählen.
  // Jede Strategie hat:
  //   – name, ziel, ansatz (3-Satz-Beschreibung)
  //   – konkrete_schritte: [] (was zu tun ist)
  //   – pros / cons
  //   – braucht: was musst du einbringen, um diese Strategie zu fahren?
  //   – passt_zu: Profil-Tag
  //   – impact_5j: Schätzung Steuer-/Cashflow-Effekt 5 Jahre
  function _buildMultiStrategien(rows, port, verdicts, scenarios) {
    var inp = _state.inputs;
    var byCode = {};
    verdicts.forEach(function(item) {
      item.verdicts.forEach(function(vd) {
        if (!byCode[vd.code]) byCode[vd.code] = { count: 0, total: 0, objects: [] };
        byCode[vd.code].count++;
        byCode[vd.code].total += vd.impact_eur || 0;
        byCode[vd.code].objects.push(item.object.kuerzel);
      });
    });
    var get = function(c) { return byCode[c] || { count: 0, total: 0, objects: [] }; };

    var rndImpact = (get('RND_GUTACHTEN_LOHNT').total + get('RND_GUTACHTEN_DRINGEND').total + get('RND_BAUZUSTAND_PRUEFEN').total);
    var sanImpact = get('SANIEREN_WERBUNGSKOSTEN').total + get('ANSCHAFFUNGSNAH_15PCT').total;
    var mietImpact = get('MIETSTEIGERUNG_MOEGLICH').total;
    var beleihReserve = port.beleihungs_reserve || 0;
    var freeEk = inp.free_ek - inp.notgroschen;  // verfügbares EK abzüglich Notgroschen
    var anzahl = port.count;

    var strategien = [];

    // ─── STRATEGIE A: STEUERN SENKEN (Verteidigend) ──────────────
    var stA = {
      key: 'steuern_senken',
      name: 'Steuern senken',
      ziel: 'Maximale Steuer­ersparnis aus Bestand — keine Strukturwechsel.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['sicherheit', 'cashflow'],
      paragraphs: ['7_4_satz_2_estg', '11_2_estg', '82b_estdv', '6_1_1a_estg'],
      impact_5j: 0
    };
    var stASchritte = [];
    if (rndImpact > 5000) {
      // V130: Nur Objekte zählen, die im RND-Verdikt mit AfA-Satz > 2% empfohlen wurden
      var rndCount = (get('RND_GUTACHTEN_LOHNT').count + get('RND_GUTACHTEN_DRINGEND').count + get('RND_GUTACHTEN_PRUEFEN').count);
      var rndObjekte = [].concat(get('RND_GUTACHTEN_LOHNT').objects, get('RND_GUTACHTEN_DRINGEND').objects, get('RND_GUTACHTEN_PRUEFEN').objects);
      // Ergänze pro-Objekt die erwartete AfA-Quote (für Klarheit "wie sicher")
      var rndDetails = rndObjekte.map(function(kuerzel) {
        var matchingRow = rows.filter(function(r) { return r.kuerzel === kuerzel; })[0];
        if (matchingRow && matchingRow.rndGutachten && matchingRow.rndGutachten.afa_kurz) {
          return kuerzel + ' (' + matchingRow.rndGutachten.afa_kurz.satz_pct + ' % AfA)';
        }
        return kuerzel;
      });
      stASchritte.push({
        nr: stASchritte.length + 1,
        titel: 'RND-Gutachten für ' + rndCount + ' geprüfte Objekt(e)',
        detail: 'Gutachten kostet typisch 800-1.500 € pro Objekt. Bei diesen Objekten ergibt die Modellrechnung eine AfA-Quote über 2 %, sodass sich das Gutachten klar lohnt. Betroffen: ' + rndDetails.join(', ') + '. Ergebnis als kürzere Nutzungsdauer beim FA per formlosem Antrag einreichen — höhere AfA wirkt sofort.',
        impact: rndImpact,
        zeitrahmen: '0-3 Monate',
        confidence: 'hoch'
      });
      stA.impact_5j += rndImpact / 2;
    }
    if (sanImpact > 5000) {
      stASchritte.push({
        nr: stASchritte.length + 1,
        titel: 'Erhaltungsaufwand gezielt einsetzen',
        detail: 'Bei sanierungsbedürftigen Objekten Sanierung als Werbungs­kosten ansetzen. Bei frischen Käufen: 15%-Grenze (§6 Abs. 1 Nr. 1a EStG) ausnutzen — alles bis dahin sofort voll abziehbar.',
        impact: sanImpact,
        zeitrahmen: '3-12 Monate'
      });
      stA.impact_5j += sanImpact;
    }
    if (get('LOHNSTEUER_ERMAESSIGUNG').count > 0) {
      stASchritte.push({
        nr: stASchritte.length + 1,
        titel: 'Lohnsteuer­ermäßigungs-Antrag stellen',
        detail: 'Bei prognostizierten V+V-Verlusten: Antrag beim Finanzamt — höhere monatliche Liquidität sofort, nicht erst nach Veranlagung.',
        impact: get('LOHNSTEUER_ERMAESSIGUNG').total,
        zeitrahmen: 'Vor Jahresanfang'
      });
    }
    if (mietImpact > 0) {
      stASchritte.push({
        nr: stASchritte.length + 1,
        titel: 'Mietanpassung an Markt prüfen',
        detail: '§558 BGB: 20 % in 3 Jahren. Höhere Miete = höherer Verkehrswert = mehr Beleihungs­reserve für später.',
        impact: mietImpact,
        zeitrahmen: '3-6 Monate'
      });
    }
    if (stASchritte.length === 0) {
      stASchritte.push({
        nr: 1,
        titel: 'Bestand ist bereits steueroptimiert',
        detail: 'Keine offensichtlichen Steuer-Hebel im Bestand identifiziert. Fokus auf Erhaltung und Liquidität.',
        impact: 0
      });
    }
    stA.konkrete_schritte = stASchritte;
    stA.ansatz = 'Du arbeitest mit dem, was du hast. Keine GmbH-Gründung, kein Strukturwechsel — nur die Steuerschrauben drehen, die im Bestand schon angelegt sind: AfA-Optimierung, Werbungskosten gezielt timing, Mietanpassungen.';
    stA.pros = [
      'Keine Einmalkosten, keine GrESt, keine Notar-Termine.',
      'Sofort wirksam — Effekt schon im laufenden Steuerjahr.',
      'Volle steuerliche Flexibilität bleibt erhalten (§23-Frist intakt).'
    ];
    stA.cons = [
      'Begrenzter Hebel — Wirkung endet, wenn AfA voll genutzt ist.',
      'Skalierungs­bremse: Ohne GmbH bleibt der persönliche Grenzsteuersatz die Belastung.',
      'Bei wachsender Vermögens­konzentration in Privatperson steigt das Klumpenrisiko.'
    ];
    stA.braucht = [
      'Gutachterkosten (~1.000 € pro RND-Gutachten).',
      'Aktive Bewirtschaftung: Mieterhöhungs-Schreiben, Sanierungs­budget.',
      rndImpact > 0 ? 'Bauzustand vor Ort dokumentieren (für Gutachter).' : 'Aktualisierte Baujahre/Sanstand-Eingaben.'
    ];

    // ─── STRATEGIE B: WACHSTUM ───────────────────────────────────
    var stB = {
      key: 'wachstum',
      name: 'Wachstum durch Hebel',
      ziel: 'Eigenkapital aktivieren, Bestand vergrößern, Skalierung über GmbH.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      paragraphs: ['9_1_2_gewstg', '6_1_1a_estg', '7_4_satz_2_estg', 'gmbh_schwellen'],
      passt_zu: ['wachstum', 'aggressiv'],
      impact_5j: 0
    };
    var stBSchritte = [];
    var ek_aus_reserve = beleihReserve > 30000 ? beleihReserve : 0;
    var gesamt_ek = freeEk + ek_aus_reserve;
    var hebel_volumen = gesamt_ek * 4;  // 4× Hebel bei 75 % LTV

    // V137: Explizite Diagnose pro Objekt — wo gibt es Beleihungs-Reserve?
    var nachbeleih_kandidaten = rows
      .filter(function(r) { return (r.beleihungs_reserve || 0) > 20000; })
      .sort(function(a, b) { return (b.beleihungs_reserve || 0) - (a.beleihungs_reserve || 0); });
    var auslaufPct = inp.beleihungs_auslauf_pct || 80;
    var abschlagPct = inp.beleihungswert_abschlag_pct || 10;
    if (nachbeleih_kandidaten.length > 0) {
      // Detail-Schritt: Pro-Objekt-Aufstellung
      var detailLines = nachbeleih_kandidaten.slice(0, 5).map(function(r) {
        return '· ' + r.kuerzel + ': VW ' + Math.round(r.verkehrswert).toLocaleString('de-DE') +
               ' €, Restschuld ' + Math.round(r.d_total).toLocaleString('de-DE') +
               ' €, Reserve ' + Math.round(r.beleihungs_reserve).toLocaleString('de-DE') + ' €';
      }).join('\n');
      stBSchritte.push({
        nr: stBSchritte.length + 1,
        titel: 'Nachbeleihung — ' + nachbeleih_kandidaten.length + ' Objekt(e) mit Reserve > 20k €',
        detail: 'Konfiguration: Beleihungswert = Verkehrswert × ' + (100 - abschlagPct) +
                ' % (Banken-Abschlag ' + abschlagPct + ' %), Bank-Limit = ' + auslaufPct +
                ' % davon = ' + Math.round((100 - abschlagPct) * auslaufPct / 100) + ' % vom Verkehrswert.\n' +
                'Konkret pro Objekt:\n' + detailLines + '\n\n' +
                'Gesamt verfügbare Reserve: ' + Math.round(beleihReserve).toLocaleString('de-DE') + ' €. ' +
                'Bei der Bank Aufstockungs­vorschlag mit aktuellen Verkehrswerten und ggf. neuen Mietspiegel-Auszug einreichen — keine neuen Notar-Termine, nur Grundschuld-Erhöhung.',
        impact: beleihReserve,
        zeitrahmen: '2-4 Monate'
      });
    } else if (beleihReserve > 30000) {
      stBSchritte.push({
        nr: stBSchritte.length + 1,
        titel: 'Beleihungs-Reserve aktivieren — ~' + Math.round(beleihReserve).toLocaleString('de-DE') + ' € EK frei',
        detail: 'Bankgespräch mit Aufstockungs­konzept führen. Verkehrswerte sind dokumentiert (Bestands­miete, Modernisierungs­zustand). Bank erhöht die Grundschuld auf bestehenden Objekten — kein neuer Notar-Termin pro Objekt nötig.',
        impact: beleihReserve,
        zeitrahmen: '2-4 Monate'
      });
    }
    if (gesamt_ek > 50000) {
      stBSchritte.push({
        nr: stBSchritte.length + 1,
        titel: 'Nachbeleihungs-Erlös als EK für ' + Math.floor(hebel_volumen / 250000) + ' weitere Objekt(e)',
        detail: 'Mit ~' + Math.round(gesamt_ek).toLocaleString('de-DE') + ' € EK (' +
                Math.round(freeEk).toLocaleString('de-DE') + ' € frei + ' +
                Math.round(ek_aus_reserve).toLocaleString('de-DE') + ' € aus Nachbeleihung) bei 75 % LTV: ' +
                'Investitions­volumen ~' + Math.round(hebel_volumen).toLocaleString('de-DE') + ' € — typisch 1-3 weitere Objekte. ' +
                'Hebel: jeder zusätzliche Objektkauf bringt ~5-7 % laufende Cashflow-Rendite + Wertsteigerung. ' +
                'Empfehlung: Mehrfamilienhaus mit Sanierungs­bedarf wählen, dann den nächsten Punkt nutzen.',
        impact: hebel_volumen * 0.05 * 5,
        zeitrahmen: '6-18 Monate'
      });
    }
    if (anzahl >= 3) {
      stBSchritte.push({
        nr: stBSchritte.length + 1,
        titel: inp.hat_struktur === 'keine'
          ? 'VV-GmbH gründen (Kosten ~1.500 €)'
          : 'Bestehende VV-GmbH für Neukäufe nutzen',
        detail: 'NEUKÄUFE direkt in der VV-GmbH parken. Bestand bleibt privat. Erweitere Kürzung §9 Nr. 1 S. 2 GewStG: laufende Mieten effektiv mit ~15,8 % besteuert statt persönlichem Grenzsteuersatz.',
        impact: 0,  // erst bei Käufen wirksam
        zeitrahmen: 'Vor erstem Zukauf'
      });
    }
    if (anzahl >= 1) {
      var nutzen_lasten_kandidaten = rows.filter(function(r) { return r.kaufjahr > 0 && r.halte_dauer === 0 && r.sanstand >= 4; });
      stBSchritte.push({
        nr: stBSchritte.length + 1,
        titel: 'Beim nächsten Kauf: Sanierung VOR wirtschaftlichem Übergang',
        detail: 'Verkäufer fragen, ob Nutzen-Lasten-Wechsel um bis zu 12 Monate verschoben werden kann. Sanierung in der Zeit bezahlen — fällt nicht unter §6 Abs. 1 Nr. 1a EStG (15%-Grenze), weil noch nicht angeschafft. Bei einem 300k-Objekt mit 100k Sanierung sind das bei 42% Grenzsteuersatz ~42.000 € Steuerersparnis sofort.',
        impact: 42000,
        zeitrahmen: 'Bei nächster Kaufverhandlung'
      });
      stB.impact_5j += 42000 / 2;  // konservativ: nur bei jedem 2. Kauf
    }
    stB.konkrete_schritte = stBSchritte;
    stB.impact_5j += hebel_volumen * 0.05 * 5;
    stB.ansatz = 'Du nutzt deinen Bestand als Fundament: Aufgewertete Objekte werden beleihbar, freigesetztes EK fließt in Zukäufe. Neukäufe landen direkt in einer GmbH-Hülle — der persönliche Steuersatz bleibt vom Wachstum verschont.';
    stB.pros = [
      'Aktiver Vermögens­aufbau: Bestand wächst ohne neues Privatkapital.',
      'GmbH-Hülle für Neukäufe = laufende Steuerlast nur ~15,8 % (mit erw. Kürzung).',
      'Skalierungs­modell: nach 5 Jahren oft Gesamt­bestand verdoppelt.'
    ];
    stB.cons = [
      'Höhere Gesamtverschuldung — bei Zinsanstieg überproportionaler Stress.',
      'Bank-Mitarbeit ist Voraussetzung — nicht jede Bank stockt auf.',
      'GmbH-Buchhaltung kostet 2.000-4.000 € pro Jahr und Hülle.'
    ];
    stB.braucht = [
      'Bonität für Folge­finanzierungen (saubere Steuer­bescheide, Kontoauszüge).',
      'Bankberater mit Investment-Fokus (idR Investmentbanker, kein Privatkunde).',
      inp.hat_struktur === 'keine' ? 'GmbH-Gründung ~1.500 € Notar/HRB.' : 'Aktualisierter Wirtschaftsplan für die GmbH.',
      gesamt_ek < 100000 ? 'Mehr verfügbares Eigenkapital (idealerweise 100k+) ODER längeren Atem (5+ Jahre, dann erst skalieren).' : 'Klarer Investitions­horizont (mindestens 10 Jahre).'
    ];

    // ─── STRATEGIE C: SICHERHEIT / KONSOLIDIEREN ─────────────────
    var stC = {
      key: 'sicherheit',
      name: 'Sicherheit & Konsolidierung',
      ziel: 'Risiken reduzieren, Cashflow stabilisieren, langfristig steuerfrei verkaufen können.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      paragraphs: ['23_estg', '82b_estdv'],
      passt_zu: ['sicherheit'],
      impact_5j: 0
    };
    var stCSchritte = [];
    var hochLtv = rows.filter(function(r) { return (r.ltv_aktuell || r.ltv) > 0.85; });
    if (hochLtv.length > 0) {
      stCSchritte.push({
        nr: stCSchritte.length + 1,
        titel: hochLtv.length + ' Objekt(e) gezielt tilgen — Sondertilgung nutzen',
        detail: 'Höher beliehene Objekte (LTV>85 %) zuerst entschulden. Reduziert Zinsänderungs-Risiko. Bei 5 % Sondertilgung pro Jahr und 4 % Zinssatz spart das pro Objekt schnell 5-stellige Beträge über die Gesamt­laufzeit.',
        impact: hochLtv.reduce(function(s, r) { return s + r.zins_y * 0.3; }, 0) * 5,  // grob: 30% Zinseinsparung
        zeitrahmen: '12-24 Monate'
      });
    }
    var spekKandidaten = rows.filter(function(r) { return r.spekfrist_rest != null && r.spekfrist_rest > 0 && r.spekfrist_rest <= 3; });
    if (spekKandidaten.length > 0) {
      stCSchritte.push({
        nr: stCSchritte.length + 1,
        titel: spekKandidaten.length + ' Objekt(e): §23-Frist bald durch — dann steuerfrei verkaufbar',
        detail: 'Diese Objekte haben in 1-3 Jahren die 10-Jahres-Spekulationsfrist erreicht. Nach Ablauf ist der Veräußerungs­gewinn einkommen­steuerfrei (§23 EStG). Plan: Verkauf vorbereiten oder gezielt umstrukturieren NACH Fristablauf — vorher würde die Frist neu starten.',
        impact: spekKandidaten.reduce(function(s, r) { return s + (r.verkehrswert - r.kp) * 0.30; }, 0),
        zeitrahmen: '1-3 Jahre'
      });
    }
    if (rndImpact > 5000) {
      stCSchritte.push({
        nr: stCSchritte.length + 1,
        titel: 'RND-Gutachten als planbare Steuer­ersparnis',
        detail: 'Auch in der Sicherheits­strategie ist das RND-Gutachten ein No-Brainer: Einmal-Kosten gegen jahrelange Steuerersparnis. Reduziert die laufende Steuerlast ohne jedes Risiko.',
        impact: rndImpact,
        zeitrahmen: '0-3 Monate'
      });
      stC.impact_5j += rndImpact / 2;
    }
    if (mietImpact > 0) {
      stCSchritte.push({
        nr: stCSchritte.length + 1,
        titel: 'Mietanpassung — niedriger Risiko-Hebel',
        detail: 'Mietsteigerungen erhöhen den Cashflow ohne neue Schulden. Stabilisiert die laufende Liquidität.',
        impact: mietImpact,
        zeitrahmen: '3-6 Monate'
      });
    }
    if (stCSchritte.length === 0) {
      stCSchritte.push({
        nr: 1,
        titel: 'Bestand ist bereits konservativ aufgestellt',
        detail: 'Niedrige LTVs, keine §23-Risiken, keine offensichtlichen Hebel. Empfehlung: Liquiditäts­reserve aufbauen für Anschluss­finanzierungen.',
        impact: 0
      });
    }
    stC.konkrete_schritte = stCSchritte;
    stC.ansatz = 'Du gehst keine neuen Risiken ein. Schulden runter, §23-Fristen abwarten, Cashflow stabilisieren. Ziel: in 5-10 Jahren ein entschuldetes, steuerfrei veräußerbares Portfolio.';
    stC.pros = [
      'Reduziertes Zinsänderungs- und Mietausfall-Risiko.',
      '§23-Frist intakt — späterer steuerfreier Verkauf möglich.',
      'Klare Liquiditäts­situation, niedriger Beratungs- und Verwaltungs­aufwand.'
    ];
    stC.cons = [
      'Verzicht auf Wachstum — Vermögen wächst nur durch Tilgung und Wertsteigerung.',
      'Inflation kann den Wertzuwachs auffressen, wenn nicht aktiv bewirtschaftet wird.',
      'Bei steigenden Lebenshaltungskosten kann die Eigen­kapital­position knapp werden.'
    ];
    stC.braucht = [
      'Liquidität für Sondertilgungen (' + Math.round((hochLtv.length || 1) * 5000).toLocaleString('de-DE') + ' € pro Jahr und Objekt empfehlenswert).',
      'Geduld und langfristigen Halte-Horizont.',
      'Regelmäßige Anschluss­finanzierungs-Planung (alle 5-10 Jahre).'
    ];

    // ─── STRATEGIE D: GMBH-AUFBAU (V133 — Tier-basiert) ───────────
    var stD = {
      key: 'gmbh_aufbau',
      name: 'GmbH-Strukturen aufbauen',
      ziel: 'VV-GmbH gründen für Skalierung, Erbschafts­planung, geringere laufende Steuer.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['wachstum', 'aggressiv'],
      impact_5j: 0,
      paragraphs: ['9_1_2_gewstg', '8b_kstg', '13a_13b_erbstg', 'gmbh_schwellen', 'kaufpreis_grenzen'],
      // V133: Tier-Information mitgeben — UI rendert Visualisierung
      gmbh_tier: null
    };
    var stDSchritte = [];
    var vuvOhne = port.vuv_y;

    // V133: Tier ermitteln + Wirtschaftlichkeits-Rechnung
    var aktuellerTier = _findGmbhTier(vuvOhne);
    var gmbhKostenJ = 3000;  // typisch laut ride.capital
    var gmbhVorteil = _calcGmbhVorteil(vuvOhne, inp.base_income_zve, gmbhKostenJ);
    stD.gmbh_tier = {
      aktuell: aktuellerTier.key,
      vuv_y: vuvOhne,
      grenzsteuersatz: gmbhVorteil.grenz,
      vorteil_brutto_y: gmbhVorteil.brutto,
      vorteil_netto_y: gmbhVorteil.netto,
      gmbh_kosten_y: gmbhKostenJ,
      tiers: GMBH_TIERS  // Komplette Tier-Tabelle für die UI
    };

    // Schritt 1: Tier-Diagnose (immer als erstes)
    stDSchritte.push({
      nr: stDSchritte.length + 1,
      titel: 'Diagnose: Du bist aktuell in ' + aktuellerTier.name,
      detail: 'V+V-Überschuss aktuell ' + Math.round(vuvOhne).toLocaleString('de-DE') + ' €/J. ' + aktuellerTier.detail + ' — Persönlicher Grenzsteuersatz nach Modul: ' + Math.round(gmbhVorteil.grenz * 100) + ' %. Brutto-Vorteil GmbH-Lösung: ~' + Math.round(gmbhVorteil.brutto).toLocaleString('de-DE') + ' €/J. Abzgl. Strukturkosten ~3.000 €/J = Netto-Vorteil ~' + Math.round(gmbhVorteil.netto).toLocaleString('de-DE') + ' €/J.',
      impact: 0,
      zeitrahmen: 'Diagnose'
    });

    // Schritt 2: Tier-spezifische Empfehlung
    if (aktuellerTier.key === 'tier0') {
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Bei Tier 0: Privat halten + Wachstums-Plan',
        detail: 'Mit aktuell <12k V+V/J würde eine GmbH-Gründung Geld kosten, nicht sparen. Erstmal privat optimieren (RND-Gutachten, §82b-Verteilung, §35c-Ermäßigung). Sobald durch 1-2 weitere Käufe Tier 2 (25k+) erreicht ist, kommt die GmbH wieder auf den Tisch.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
    } else if (aktuellerTier.key === 'tier1') {
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Bei Tier 1: Familie/Partner-GmbH prüfen',
        detail: 'Mit ' + Math.round(vuvOhne).toLocaleString('de-DE') + ' €/J liegst du in der Tier-1-Spanne. Eine Neu-Gründung lohnt noch nicht (Setup zu teuer für den Vorteil). ABER: Wenn ein Familien-Mitglied oder Geschäfts­partner bereits eine VV-GmbH hält, sprich mit ihnen — Neukäufe können dort einsteigen, der GmbH-Mantel trägt sich selbst und du sparst die Setup-Kosten. Alternativ: Auf Tier 2 hochwachsen (~25k V+V/J).',
        impact: 0,
        zeitrahmen: 'Strategisch'
      });
    } else if (aktuellerTier.key === 'tier2' && inp.hat_struktur === 'keine') {
      var net5 = Math.max(0, gmbhVorteil.netto) * 5;
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Bei Tier 2: VV-GmbH gründen — alle Neukäufe darüber',
        detail: 'Du bist im Bereich, wo die Neu-Gründung sich rechnet. Setup ~1.500 € einmalig (Notar + HRB + IHK), 25k Stamm­einlage (oder UG mit 1 €). Erweiterte Kürzung §9 Nr. 1 S. 2 GewStG beim FA beantragen — Mieten dann effektiv mit ~15,8 % besteuert. Bei deinem V+V von ' + Math.round(vuvOhne).toLocaleString('de-DE') + ' € und Grenzsteuer ' + Math.round(gmbhVorteil.grenz * 100) + ' % = Brutto-Vorteil ~' + Math.round(gmbhVorteil.brutto).toLocaleString('de-DE') + ' €, abzgl. Strukturkosten = ~' + Math.round(gmbhVorteil.netto).toLocaleString('de-DE') + ' €/J Netto. Über 5 J. ~' + Math.round(net5).toLocaleString('de-DE') + ' €.',
        impact: net5,
        zeitrahmen: '4-8 Wochen'
      });
      stD.impact_5j += net5;
    } else if ((aktuellerTier.key === 'tier3' || aktuellerTier.key === 'tier4') && inp.hat_struktur === 'keine') {
      var net5b = Math.max(0, gmbhVorteil.netto) * 5;
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Bei Tier ' + (aktuellerTier.key === 'tier3' ? '3' : '4') + ': SOFORT VV-GmbH + Holding-Plan',
        detail: 'Mit ' + Math.round(vuvOhne).toLocaleString('de-DE') + ' €/J V+V verschenkst du jeden Monat Geld. Sofort-Schritte: 1) VV-GmbH gründen (4-8 Wochen), 2) Erweiterte Kürzung beantragen, 3) Alle Neukäufe über die GmbH, 4) Nach 1-2 J. Holding obenauf für §8b KStG-Privileg. Brutto-Vorteil aktuell ~' + Math.round(gmbhVorteil.brutto).toLocaleString('de-DE') + ' €/J, Netto ~' + Math.round(gmbhVorteil.netto).toLocaleString('de-DE') + ' €/J. Über 5 J. ~' + Math.round(net5b).toLocaleString('de-DE') + ' €.',
        impact: net5b,
        zeitrahmen: '0-2 Monate (sofort!)'
      });
      stD.impact_5j += net5b;
    } else if (inp.hat_struktur !== 'keine') {
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Bestehende ' + (inp.hat_struktur === 'vv_gmbh' ? 'VV-GmbH' : 'Struktur') + ' prüfen — erweiterte Kürzung beantragt?',
        detail: 'Sicherstellen, dass die erweiterte Kürzung §9 Nr. 1 S. 2 GewStG beim Finanz­amt beantragt und anerkannt ist. Falls nicht: KOMPLETT andere Steuerlast (~30 % statt ~15,8 %). Auch prüfen: Wird zusätzliche gewerbliche Tätigkeit ausgeübt (Möblierung, Photovoltaik), die die Kürzung gefährdet? Falls ja → in eine separate Op-GmbH auslagern (Tier-4-Logik).',
        impact: vuvOhne * 0.14,
        zeitrahmen: 'Sofort prüfen'
      });
    }

    // Schritt 3: Holding-Empfehlung bei Tier 3/4
    if ((aktuellerTier.key === 'tier3' || aktuellerTier.key === 'tier4')
        && inp.hat_struktur !== 'holding_vv' && inp.hat_struktur !== 'konzern') {
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Holding aufsetzen für §8b KStG + Erbschafts-Verschonung',
        detail: 'In Tier ' + (aktuellerTier.key === 'tier3' ? '3' : '4') + ' lohnt zusätzlich eine Holding obenauf. 95 % der Ausschüttungen aus Tochter-GmbH(s) bleiben in der Holding steuerfrei (§8b KStG) — fast volle Reinvestitions­quote. Bei späterer Übertragung an die nächste Generation greift §13a/§13b ErbStG mit 85-100 % Verschonung. Empfehlung: Holding NACH 1-2 erfolgreichen VV-GmbH-Jahren gründen, nicht vorher (sonst zu viel Aufwand auf einmal).',
        impact: 0,
        zeitrahmen: '1-2 Jahre nach VV-GmbH'
      });
    }

    // Schritt 4: Konzern bei Tier 4
    if (aktuellerTier.key === 'tier4' && inp.hat_struktur !== 'konzern') {
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Tier 4: Voll-Konzern (Holding + VV + Op-GmbH)',
        detail: 'Bei >100k V+V-Überschuss ist die volle Konzern­struktur sinnvoll. Op-GmbH separiert gewerb­liche Tätigkeiten (Möblier­ung, Photo­voltaik, Co-Working), die in der VV-GmbH die erweiterte Kürzung gefährden würden. Zusätzliche Hebel: §35b GewStG-Anrechnung, gezielte Standort-Wahl der Op-GmbH (niedrige Hebesätze), §6b-Reinvestitions­rücklagen. Bei diesen Vermögens­volumen Steuer­berater + Fach­anwalt für Erbrecht zwingend.',
        impact: 0,
        zeitrahmen: '6-12 Monate'
      });
    }

    // Schritt 5: Bestand-Warnung (für ALLE Tiers, wenn Spek-Frist offen)
    var bestandsObj = rows.filter(function(r) { return r.spekfrist_rest > 0; });
    if (bestandsObj.length > 0) {
      stDSchritte.push({
        nr: stDSchritte.length + 1,
        titel: 'Bestand NICHT umhängen, solange §23-Frist läuft',
        detail: bestandsObj.length + ' Objekt(e) sind noch in der 10-Jahres-Spekulations­frist. Einbringung in die GmbH würde Veräußerungs­gewinn auslösen + GrESt (3,5-6,5 % vom Verkehrs­wert). Strategie: §23-Frist abwarten, dann steuer­frei in die GmbH einbringen — oder besser: privat halten, nur Neukäufe in die GmbH (kein GrESt-Doppelschlag, kein §15-Gewerblichkeits-Risiko).',
        impact: 0,
        zeitrahmen: 'Bei §23-Ablauf'
      });
    }

    stD.konkrete_schritte = stDSchritte;
    stD.ansatz = 'Du baust eine professionelle Struktur auf — angepasst an dein aktuelles Tier (' + aktuellerTier.name + '). Aktuell V+V-Überschuss ' + Math.round(vuvOhne).toLocaleString('de-DE') + ' €/J, Tier-Empfehlung: ' + aktuellerTier.empfehlung + '. Bei der Erbschafts­planung greift später §13a/§13b ErbStG mit bis zu 100 % Verschonung des Betriebs­vermögens.';
    stD.pros = [
      'Laufende Steuerlast effektiv ~15,8 % statt persönlichem Grenz­satz (bis 47,5 %).',
      '§8b KStG: 95 % der Ausschüttungen Tochter→Holding steuerfrei.',
      '§13a/§13b ErbStG: spätere Übertragung 85-100 % verschont.',
      'Saubere Trennung Privat- und Geschäfts­vermögen — Haftungs­vorteil.',
      'Bei Verkauf von GmbH-Anteilen: nur 5 % steuerpflichtig (§8b KStG bei Beteiligung >10 %).',
      'Schutz vor §15 EStG-3-Objekt-Grenze bei aktivem Handel.'
    ];
    stD.cons = [
      'Gründungskosten 1.500 € pro Hülle, laufende Buchhaltung 2-4k €/J.',
      'Geld in der GmbH ist nicht "deins" — Entnahme = Ausschüttung mit KapESt + Soli (~26 %).',
      'Bestands­einbringung: GrESt 3,5-6,5 %, Spekfrist startet ggf. neu.',
      '§23 EStG-Steuerfreiheit nach 10 J entfällt vollständig in der GmbH — Verkaufs­gewinne immer steuerpflichtig.',
      'Mehr Komplexität: Jahres­abschluss, GF-Vergütungs­regelungen (vGA-Risiko), Mindest­einlage 25k bei GmbH (oder 1 € bei UG).'
    ];
    stD.braucht = [
      '~1.500 € Gründungs­kosten pro GmbH-Hülle (Notar + HRB + IHK).',
      '25.000 € Stamm­kapital (oder 1 € bei UG-Variante).',
      'Steuer­berater mit Immobilien-GmbH-Erfahrung — von Anfang an.',
      'Bei mehreren Objekten: Klare Strategie, welche Objekte in welche Hülle (idealer­weise nach Risiko­profil getrennt).'
    ];

    // ─── STRATEGIE E: ENERGETISCHE SANIERUNG (V131) ──────────────
    var stE = {
      key: 'energetisch',
      name: 'Energetisch sanieren — §35c + Werterhalt',
      ziel: 'Energiekosten senken, Verkehrswert steigern, §35c-Ermäßigung mitnehmen.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['sicherheit', 'cashflow', 'wachstum'],
      impact_5j: 0,
      paragraphs: ['35a_35c_estg', '7h_7i_estg']
    };
    var schlechtEnergie = rows.filter(function(r) {
      return r.energieklasse && ['F', 'G', 'H'].indexOf(r.energieklasse) >= 0;
    });
    var stESchritte = [];
    if (schlechtEnergie.length > 0) {
      stESchritte.push({
        nr: stESchritte.length + 1,
        titel: schlechtEnergie.length + ' Objekt(e) mit Energie­klasse F-H — vorrangig sanieren',
        detail: 'Schlechte Energie­klassen treffen mehrere Effekte gleichzeitig: hohe Neben­kosten (Mieter-Druck), niedriger Verkehrs­wert (Bank-Bewertung), gesetzliche Sanierungs­pflichten in Sicht (GEG-Stufen). Bei energetischer Sanierung greift §35c EStG: 7 % der Kosten in Jahr 1+2, 6 % in Jahr 3 — max. 40.000 € Steuer­ermäßigung. Bei reinem V+V: Erhaltungs­aufwand statt §35c (oft besser, da voller Werbungskosten­abzug).',
        impact: schlechtEnergie.length * 25000,  // typisch 25k Effekt pro Objekt über 5 J
        zeitrahmen: '6-24 Monate'
      });
      stE.impact_5j += schlechtEnergie.length * 25000;
    }
    var altObjekte = rows.filter(function(r) { return r.baujahr > 0 && r.baujahr < 1995; });
    if (altObjekte.length > 0) {
      stESchritte.push({
        nr: stESchritte.length + 1,
        titel: 'Bei ' + altObjekte.length + ' älteren Objekt(en): Sanierungs­gebiet/Denkmal prüfen',
        detail: '§7h EStG (Sanierungs­gebiet) und §7i EStG (Denkmalschutz): erhöhte AfA von 9 % über 8 J + 7 % über 4 J auf Modernisierungs­aufwand. Bei 100k Sanierung in einem Sanierungs­gebiet: 9k €/J in Jahr 1-8 als AfA = bei 42 % Grenz­steuersatz 3.780 €/J Steuer­ersparnis = 30.240 € in 8 J. WICHTIG: Bescheinigung VOR Beginn der Maßnahme einholen, sonst Versagung. Lokales Stadtplanungs­amt fragen, ob das Objekt in einem festgelegten Sanierungs­gebiet liegt.',
        impact: altObjekte.length * 30000,
        zeitrahmen: '0-3 Monate Antrag, dann Maßnahme'
      });
      stE.impact_5j += altObjekte.length * 30000;
    }
    if (stESchritte.length === 0) {
      stESchritte.push({
        nr: 1,
        titel: 'Aktuell kein konkreter energetischer Hebel im Bestand',
        detail: 'Keine Objekte mit Energie­klasse F-H oder Bj. <1995 erkannt. Bei Neukäufen: gezielt nach energetisch sanierungs­bedürftigen Objekten in Sanierungs­gebieten suchen — die §7h/§7i-AfA ist einer der stärksten Hebel.',
        impact: 0
      });
    }
    stE.konkrete_schritte = stESchritte;
    stE.ansatz = 'Du machst den Bestand zukunfts­sicher und kassierst dabei direkte Steuer­ermäßigungen. Energetische Sanierung ist nicht nur Kosten — sie ist über §35c (Eigennutzung) bzw. Werbungs­kosten-Abzug (V+V) plus Verkehrswert-Hebel ein klarer wirtschaft­licher Vorteil.';
    stE.pros = [
      '§35c EStG: 20 % der Lohn- und Material­kosten direkte Steuer­ermäßigung, max. 40k über 3 J (bei Eigennutzung).',
      'Bei reiner V+V: Erhaltungs­aufwand voll abziehbar — bei 42 % Grenzsteuer­satz fast halbe Kosten als Steuer­vorteil.',
      'Höherer Verkehrs­wert → mehr Beleihungs­reserve.',
      'GEG-Sanierungs­pflicht 2030/2033 bereits abge­arbeitet — kein Druck später.',
      'Niedrigere Neben­kosten = höhere Mieter-Bindung, weniger Leerstand.'
    ];
    stE.cons = [
      'Hoher Cashbedarf vor Effekt­eintritt — typisch 50-150k pro Objekt.',
      'Sanierungs­gebiets-Bescheinigung muss VOR Beginn vorliegen — Antrags­frist eng.',
      '§35c nicht kombinier­bar mit KfW-Förderung (Wahlrecht — KfW-Zuschuss oft besser bei großen Maßnahmen).',
      'Material­anteile zählen bei §35c mit, aber nur bei Eigennutzung.'
    ];
    stE.braucht = [
      'Energie­berater für Bedarfs­analyse (~1.500 €).',
      'Bei §7h: Antrag bei der Gemeinde VOR Maßnahmen­beginn.',
      'Klare Aufteilung: was ist Erhaltungs­aufwand (sofort/§82b) vs. Herstellungs­kosten (AfA)?',
      'Bei §35c: Rechnungen mit Lohn-/Material-Trennung, Über­weisung (kein Bargeld), Bescheinigung des Fach­unternehmens.'
    ];

    // ─── STRATEGIE F: LAGE-OPTIMIERUNG (V131) ────────────────────
    var stF = {
      key: 'lage_optimierung',
      name: 'Lage-Optimierung — schwache abstoßen, starke verstärken',
      ziel: 'Bestand qualitativ verbessern: schwache Lagen verkaufen, starke ausbauen.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['cashflow', 'wachstum'],
      impact_5j: 0,
      paragraphs: ['23_estg', '15_estg_3_objekt', '6b_estg']
    };
    var stFSchritte = [];
    var weakLage = (port.weakLageObjects && port.weakLageObjects.length) || 0;
    var topLage = (port.topLageObjects && port.topLageObjects.length) || 0;
    if (weakLage > 0) {
      stFSchritte.push({
        nr: stFSchritte.length + 1,
        titel: weakLage + ' Objekt(e) in schwacher Lage — Verkauf prüfen',
        detail: 'Diese Objekte haben einen DealScore2-Lage-Score < 50. Bei mittel- bis langfristigem Halten überproportional Risiko (sinkende Mieten, schwächere Verkehrswert-Entwicklung). Wenn §23-Frist abgelaufen: Verkauf einkommens­teuer­frei. Bei kürzerer Halte­dauer: §23-Frist abwarten ODER Verkauf in der GmbH (dann KSt-pflichtig, aber §6b-Rücklage möglich). Erlös in starke Lagen reinvestieren.',
        impact: weakLage * 50000,  // grob: 50k Wertsteigerungs-Hebel pro Objekt-Tausch
        zeitrahmen: '6-18 Monate (oder bis §23-Ablauf)'
      });
      stF.impact_5j += weakLage * 50000;
    }
    if (topLage > 0 && port.topLageObjects && port.topLageObjects[0]) {
      var topObj = port.topLageObjects[0];
      stFSchritte.push({
        nr: stFSchritte.length + 1,
        titel: 'In starke Lagen reinvestieren — Beispiel-Anker: ' + topObj.kuerzel + ' (Lage ' + topObj.lage + ')',
        detail: 'Im Bestand sind ' + topLage + ' Objekt(e) mit DealScore2-Lage-Score ≥ 50. In diesen Lagen weiter zukaufen ist statistisch deutlich risiko­ärmer — Mieten und Verkehrs­werte steigen mit höherer Wahrschein­lichkeit als in schwächeren Lagen. Falls Beleihungs­reserve am Anker-Objekt vorhanden, dort Linie öffnen und in der gleichen Lage zukaufen (Cluster-Effekt: Hausverwaltung, Mieter-Pool, Marktkenntnis).',
        impact: topLage * 30000,
        zeitrahmen: 'Laufend (Marktbeobachtung)'
      });
      stF.impact_5j += topLage * 30000;
    }
    if (stFSchritte.length === 0) {
      stFSchritte.push({
        nr: 1,
        titel: 'Lage-Daten fehlen — DealScore2-Felder pflegen',
        detail: 'Im DealScore2-Tab pro Objekt die Felder Mikrolage, Bevölkerung, Nachfrage, Wertsteigerung, Entwicklungs­möglichkeiten ausfüllen. Dann zeigt diese Strategie konkret, welche Objekte schwach und welche stark sind.',
        impact: 0
      });
    }
    stFSchritte.push({
      nr: stFSchritte.length + 1,
      titel: 'Achtung: §15 EStG / 3-Objekt-Grenze',
      detail: 'Bei mehr als 3 Verkäufen in 5 Jahren wirst du gewerblicher Grundstücks­händler — alle Gewinne voll einkommen­steuer­pflichtig (statt §23-Frei nach 10 J). Bei Lage-Optimierung mit mehreren Verkäufen daher entweder: zeitlich strecken (mehr als 5 J zwischen Verkäufen) ODER über GmbH abwickeln (dort §15 EStG nicht relevant, weil eh Betriebs­vermögen).',
      impact: 0
    });
    stF.konkrete_schritte = stFSchritte;
    stF.ansatz = 'Du betrachtest deinen Bestand wie ein Aktien-Portfolio: schwache Posten ab­stoßen, in starke nachkaufen. Bei Immobilien wird die §23-Frist (Privat­vermögen) zum entscheidenden Timing-Faktor — und §15 EStG zum Risiko-Limiter.';
    stF.pros = [
      'Portfolio-Qualität steigt systematisch.',
      'Reinvestition in starke Lagen senkt Klumpen­risiko.',
      'Bei §23-Ausnutzung: Verkaufs­gewinne aus schwachen Lagen voll steuerfrei.',
      'Cluster-Bildung in starken Lagen → Verwaltungs-Skaleneffekte.'
    ];
    stF.cons = [
      'Transaktions­kosten: Makler 3,57 % beim Verkauf, GrESt 3,5-6,5 % beim Neukauf.',
      '§15 EStG-Risiko bei häufigen Verkäufen — gewerblicher Grundstücks­handel.',
      'Markt-Timing-Risiko — Verkauf in einer Schwächephase, Kauf in einer Hochphase.',
      'Lage-Bewertungen sind Eingaben — falsche Daten = falsche Strategie.'
    ];
    stF.braucht = [
      'Saubere DealScore2-Eingaben pro Objekt (Mikrolage, Bevölkerung, Nachfrage etc.).',
      'Steuerberater-Plan für 3-Objekt-Grenze: maximal 3 Verkäufe in 5 J.',
      'Liquiditäts­plan für Verkauf-Kauf-Zwischen­phase (oft 6-12 Monate Gap).',
      'Markt­kenntnis in den Ziel-Lagen.'
    ];

    // ─── STRATEGIE G: ENTSCHULDUNGS-SPRINT (V131) ────────────────
    var stG = {
      key: 'entschuldung',
      name: 'Entschuldungs-Sprint',
      ziel: 'Hoch beliehene Objekte zuerst tilgen — Risiko reduzieren, Liquidität freisetzen.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['sicherheit'],
      impact_5j: 0,
      paragraphs: ['23_estg']
    };
    var hochLtv2 = rows.filter(function(r) { return (r.ltv_aktuell || r.ltv) > 0.85; });
    var stGSchritte = [];
    if (hochLtv2.length > 0) {
      var zinsErspar = hochLtv2.reduce(function(s, r) { return s + r.zins_y * 0.3; }, 0) * 5;
      stGSchritte.push({
        nr: stGSchritte.length + 1,
        titel: hochLtv2.length + ' Objekt(e) mit LTV > 85 % — gezielt sondertilgen',
        detail: '5 % Sondertilgung pro Jahr ist bei Standard-Bank­darlehen vereinbart. Diese konsequent ausschöpfen — bei aktuellen Zinssätzen 3,5-4 % spart das pro Objekt schnell 5-stellige Beträge über die Gesamt­laufzeit. Geschätzte Zins­einsparung ' + Math.round(zinsErspar).toLocaleString('de-DE') + ' € über 5 J.',
        impact: zinsErspar,
        zeitrahmen: '12-24 Monate'
      });
      stG.impact_5j += zinsErspar;
    }
    stGSchritte.push({
      nr: stGSchritte.length + 1,
      titel: 'Anschluss­finanzierung 5+ Jahre vor Zinsbindungs-Ablauf planen',
      detail: 'Forward-Darlehen 12-36 Monate vor Zinsbindungs­ablauf können bei guten Konditionen Aufschläge sparen. Bei mehreren Objekten: Zinsbindungs-Enden bewusst staffeln (nicht alle gleichzeitig), um nicht in einem Hoch­zinsjahr alle Anschlüsse machen zu müssen.',
      impact: 0,
      zeitrahmen: 'Laufend'
    });
    var spekKandidaten2 = rows.filter(function(r) { return r.spekfrist_rest != null && r.spekfrist_rest > 0 && r.spekfrist_rest <= 3; });
    if (spekKandidaten2.length > 0) {
      stGSchritte.push({
        nr: stGSchritte.length + 1,
        titel: spekKandidaten2.length + ' Objekt(e) gehen bald aus §23-Frist — entweder verkaufen oder weiter halten',
        detail: 'Innerhalb 1-3 J ist die 10-J-Frist abgelaufen. Strategische Entscheidung: A) Halten und Verkauf für später vorbereiten (steuerfreier Veräußerungs­gewinn), B) Verkauf zur Entschuldung der anderen Objekte (Erlös in Sondertilgung), C) Weiter halten bei guter Lage. NICHT: vorzeitig verkaufen mit §23-Steuer­last.',
        impact: spekKandidaten2.reduce(function(s, r) { return s + (r.verkehrswert - r.kp); }, 0) * 0.30,
        zeitrahmen: '1-3 Jahre'
      });
    }
    stG.konkrete_schritte = stGSchritte;
    stG.ansatz = 'Du fährst die Schulden zurück, ohne ins Risiko zu gehen. Sicherheits-Strategie für Investoren mit ausreichend laufendem Cashflow, die nicht weiter wachsen wollen — Ziel ist ein in 5-10 J. weitgehend entschuldetes Portfolio.';
    stG.pros = [
      'Zinsänderungs­risiko sinkt überproportional.',
      'Frei werdender Cashflow (weniger Zinsen) verfügbar für Reserven oder Reinvestition.',
      'Anschluss­finanzierungen werden günstiger (niedriger LTV = bessere Konditionen).',
      'Mental: ruhiger Schlaf — bei Mietausfall keine Existenz-Bedrohung.'
    ];
    stG.cons = [
      'Verzicht auf Wachstum während der Tilgung.',
      'Tilgung in der GmbH ist NICHT Werbungs­kosten — voll aus versteuertem Gewinn.',
      'Inflation entwertet die Schuld — Tilgung kann unter Inflations­bedingungen "irrational gut" wirken.',
      'Sondertilgungen sind zinslos — keine Rendite auf das eingesetzte Kapital.'
    ];
    stG.braucht = [
      'Liquidität für Sondertilgungen (' + Math.round((hochLtv2.length || 1) * 5000).toLocaleString('de-DE') + ' €/J empfehlenswert).',
      'Kein Wachstums­druck.',
      'Steuer­liches Verständnis: Tilgungs­zahlungen sind keine Werbungs­kosten — der Steuer­spar-Hebel fällt mit der Schuld weg.'
    ];

    // ─── STRATEGIE H: MIETKONVERGENZ (V134) ──────────────────────
    // Gezielt Mietlücken schließen. §558 BGB-konforme Anpassungen.
    var stH = {
      key: 'mietkonvergenz',
      name: 'Mietkonvergenz — Lücke zu Marktmiete schließen',
      ziel: 'Ist-Mieten kontrolliert an Marktmiete heranführen — ohne Mieter zu verprellen.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['cashflow', 'wachstum'],
      impact_5j: Math.max(0, port.mietluecke_total_y * 0.6 * 5), // 60% in 5J realistisch
      paragraphs: ['558_bgb', '559_bgb', '23_estg']
    };
    var stHSchritte = [];
    if (port.mietluecke_total_y > 0) {
      stHSchritte.push({
        nr: 1,
        titel: 'Diagnose: Gesamt-Mietlücke ' + Math.round(port.mietluecke_total_y).toLocaleString('de-DE') + ' €/J',
        detail: port.mietluecke_objects.length + ' Objekt(e) haben deutliche Lücken zur Marktmiete. Größte Lücke: ' + (port.mietluecke_objects[0] ? port.mietluecke_objects[0].kuerzel + ' (~' + Math.round(port.mietluecke_objects[0].luecke_y).toLocaleString('de-DE') + ' €/J)' : '–') + '. Bei voller Schließung über 5 J. ~' + Math.round(port.mietluecke_total_y * 5).toLocaleString('de-DE') + ' € Mehr-Cashflow vor Steuer.',
        impact: port.mietluecke_total_y * 5,
        zeitrahmen: 'Diagnose'
      });
    }
    stHSchritte.push({
      nr: stHSchritte.length + 1,
      titel: 'Mieterhöhung nach §558 BGB — Mietspiegel-Vergleich',
      detail: 'Die "ortsübliche Vergleichsmiete" wird durch den Mietspiegel der Stadt belegt. Anhebung max. 20 % in 3 J (15 % in Mietpreisbremse-Regionen, §556d BGB). Förmlicher Brief mit Begründung (Mietspiegel-Auszug, drei Vergleichsobjekte). Mieter hat 2 Monate Zustimmungsfrist. Zweimal in 3 J nutzbar — also gestaffelt, nicht mit einem Schlag.',
      impact: 0,
      zeitrahmen: '0-3 Monate pro Objekt'
    });
    stHSchritte.push({
      nr: stHSchritte.length + 1,
      titel: 'Modernisierung-Umlage §559 BGB — bis zu 8 % p.a. der Sanierungs­kosten',
      detail: 'Bei energetischer Sanierung, Heizungs­modernisierung, Bad-Erneuerung dürfen 8 % der Modernisierungs­kosten als jährliche Mieterhöhung umgelegt werden — kombinierbar mit §35c-EStG-Förderung (20 % der Kosten als Steuer­ermäßigung). Bei 30k Modernisierungs­kosten: 2.400 €/J Mieterhöhung + 6k Steuer-Ermäßigung über 3 J = sehr starker Hebel.',
      impact: 0,
      zeitrahmen: '6-12 Monate pro Objekt'
    });
    stHSchritte.push({
      nr: stHSchritte.length + 1,
      titel: 'Mieterwechsel als Reset-Punkt nutzen',
      detail: 'Bei Auszug eines Bestand­mieters mit weit unter Markt liegender Miete: Wohnung ggf. modernisieren (Hebel §559!) und neu zur Marktmiete vermieten. ABER: Mietpreis­bremse beachten — bei Wieder­vermietung max. 10 % über ortsüblich (§556d BGB). Ausnahme: nach umfassender Modernisierung (>1/3 Neubau­kosten) entfällt die Bremse für 3 J.',
      impact: 0,
      zeitrahmen: 'Bei Mieterwechsel'
    });
    stH.konkrete_schritte = stHSchritte;
    stH.ansatz = 'Du nutzt drei Hebel: §558 BGB (regelmäßige Anpassung an ortsübliche Vergleichsmiete), §559 BGB (Modernisierungs­umlage), und Mieter­wechsel (Reset auf Marktmiete). Bei einer Gesamt-Mietlücke von ' + Math.round(port.mietluecke_total_y).toLocaleString('de-DE') + ' €/J ist das ein laufender Hebel über alle Objekte hinweg.';
    stH.pros = [
      'Direkter Cashflow-Hebel ohne Kapitaleinsatz.',
      'Verkehrswert steigt proportional zur höheren NKM.',
      'Bei Bank-Verhandlungen (LTV) wirkt höhere Miete sofort positiv.',
      'Hebel auch in deflationären Phasen wirksam.'
    ];
    stH.cons = [
      'Mieter-Beziehung leidet — bei Mieterwechsel Risiko Leerstand.',
      'Mietpreis­bremse (§556d BGB) limitiert die Reset-Höhe in vielen Großstädten.',
      'Modernisierung erfordert Vorab-Kapital — 30k pro Objekt typisch.',
      'Energetische Modernisierungen müssen Mietern 3 Mon. vor Beginn angekündigt werden (§555c BGB).'
    ];
    stH.braucht = [
      'Aktuelle Mietspiegel-Daten der Standort-Städte (oft Online-Recherche-Aufwand).',
      'Ggf. Modernisierungs­kapital 20-50k pro Objekt.',
      'Geduld: Mieterhöhungen wirken über 3-5 J., nicht sofort.',
      'Steuerberater-Check für §35c-Anrechnung der Modernisierungs­kosten.'
    ];

    // ─── STRATEGIE I: STANDORT-DIVERSIFIKATION (V134) ─────────────
    // Wenn ein Klumpen-Risiko erkannt wird (mehrere Objekte am gleichen Ort)
    var stI = {
      key: 'diversifikation',
      name: 'Standort-Diversifikation — Klumpen­risiko abbauen',
      ziel: 'Geografische Streuung erhöhen, makroökonomische Standort-Risiken reduzieren.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['sicherheit', 'wachstum'],
      impact_5j: 0,
      paragraphs: ['23_estg', '6b_estg']
    };
    var stISchritte = [];
    if (port.klumpen_max >= 3) {
      stISchritte.push({
        nr: 1,
        titel: 'Diagnose: Klumpen­risiko in ' + port.klumpen_orte[0].ort + ' (' + port.klumpen_max + ' Objekte)',
        detail: 'Du hast ' + port.klumpen_max + ' Objekte am selben Ort. Bei einem lokalen Schock (Großarbeitgeber-Insolvenz, Bevölkerungs-Rückgang, neue Mietregulierung im Bundesland) sind alle gleichzeitig betroffen. Ab 30 % Bestand am selben Ort wird das zum strukturellen Risiko — auch Banken werten das in der Bonitäts­prüfung kritisch.',
        impact: 0,
        zeitrahmen: 'Diagnose'
      });
      stISchritte.push({
        nr: stISchritte.length + 1,
        titel: 'Nächste Käufe in andere Region(en) lenken',
        detail: 'Statt am bekannten Standort weiter zuzukaufen (Komfort-Falle), aktiv in andere wachstums­starke Regionen schauen. Auswahlkriterien: Bevölkerungs­wachstum >0,5 %/J, Arbeitslosen­quote unter Bundes-Durchschnitt, mind. eine Universität oder Hochschule, geplante Verkehrs­anbindungs-Projekte (z. B. ICE-Halt, U-Bahn-Erweiterung).',
        impact: 0,
        zeitrahmen: 'Bei nächstem Zukauf'
      });
      stISchritte.push({
        nr: stISchritte.length + 1,
        titel: '§6b EStG-Reinvestitions­rücklage für Verkauf-Diversifikation',
        detail: 'Wenn ein Objekt aus dem Klumpen verkauft wird (nach §23-Frist also steuer­frei privat ODER mit §6b in der GmbH), kann der Erlös innerhalb von 4 J. in ein Objekt einer anderen Region reinvestiert werden — die stille Reserve wird übertragen statt versteuert (§6b EStG). Hebel: 100 % Steuer-Stundung beim Standort­wechsel.',
        impact: 0,
        zeitrahmen: '0-4 Jahre nach Verkauf'
      });
    } else {
      stISchritte.push({
        nr: 1,
        titel: 'Du bist gut diversifiziert — Achte auf Streuung beim weiteren Wachstum',
        detail: 'Aktuell kein Klumpen­risiko (max. ' + (port.klumpen_max || 1) + ' Objekt(e) am selben Ort). Beim weiteren Ausbau auf maximale Konzentration von 3 Objekten pro Stadt ODER 30 % des Bestands­wertes pro Region achten.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
    }
    stI.konkrete_schritte = stISchritte;
    stI.ansatz = (port.klumpen_max >= 3
      ? 'Aktuelles Klumpen­risiko: ' + port.klumpen_max + ' Objekte in ' + port.klumpen_orte[0].ort + '. Strategie zielt darauf ab, diese Konzentration über 3-5 J. abzubauen.'
      : 'Aktuell saubere Streuung. Strategie ist präventiv: Beim Ausbau Konzentration vermeiden.');
    stI.pros = [
      'Reduziert makroökonomisches Standort-Risiko.',
      'Banken bewerten diversifizierte Portfolios besser (LTV-Vorteil).',
      'Ermöglicht Region-Hopping nach Marktzyklen.',
      '§6b EStG-Stundung beim Standort­wechsel nutzbar.'
    ];
    stI.cons = [
      'Komfort-Verlust: andere Region = anderer Verwalter, andere Marktdaten.',
      'Mehrere Hebesätze (Grundsteuer, Gewerbe­steuer in der GmbH) zu beachten.',
      'Reisekosten zur Objekt­besichtigung höher.',
      'Lokale Netzwerke (Handwerker, Makler, Verwalter) müssen neu aufgebaut werden.'
    ];
    stI.braucht = [
      'Bereitschaft, andere Regionen zu lernen.',
      'Verwalter mit überregionaler Präsenz ODER lokale Verwalter pro Region.',
      'Rechtliche Beratung für §6b-Reinvestitions­rücklage.',
      'Kapital für Setup in neuer Region (Bank, Verwalter, Handwerker-Kontakte).'
    ];

    // ─── STRATEGIE J: FAKTOR-ARBITRAGE (V134) ─────────────────────
    // Überteuerte Objekte verkaufen (Kapital frei), unterbewertete kaufen
    var stJ = {
      key: 'faktor_arbitrage',
      name: 'Faktor-Arbitrage — überteuerte verkaufen, unterbewertete kaufen',
      ziel: 'Kapital aus überzahlten Objekten freisetzen und in unterbewertete Lagen umschichten.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['wachstum', 'aggressiv'],
      impact_5j: 0,
      paragraphs: ['23_estg', '6b_estg', '15_estg_3_objekt', 'kaufpreis_grenzen']
    };
    var stJSchritte = [];
    var ueberObjFaktoren = port.objektFaktoren.filter(function(o) {
      return o.lage_score != null && o.lage_score < 60 && o.verkehrsfaktor > 25;
    });
    if (ueberObjFaktoren.length > 0) {
      stJSchritte.push({
        nr: 1,
        titel: 'Diagnose: ' + ueberObjFaktoren.length + ' Objekt(e) mit ungünstigem Faktor in schwacher Lage',
        detail: 'Faktoren über 25 (= 25-faches der Jahres-Kaltmiete) bei gleichzeitig schwachem Lage-Score (<60) signalisieren: Markt hat dem Objekt früher zu viel zugetraut, jetzt klemmt der Cashflow und die Wertsteigerung bleibt aus. Größter Faktor: ' + ueberObjFaktoren[0].kuerzel + ' (Faktor ' + ueberObjFaktoren[0].verkehrsfaktor.toFixed(1) + ' bei Lage-Score ' + ueberObjFaktoren[0].lage_score + '). Kandidat für Verkauf.',
        impact: 0,
        zeitrahmen: 'Diagnose'
      });
      stJSchritte.push({
        nr: stJSchritte.length + 1,
        titel: '§23 EStG-Frist abwarten, dann steuer­frei verkaufen',
        detail: 'Wenn das Objekt aus dem Privat­vermögen >10 J. gehalten wird, ist der Verkaufs­erlös einkommen­steuer­frei (§23 EStG). Bei den ' + ueberObjFaktoren.length + ' Kandidaten prüfen, wie lange noch bis Frist­ablauf — wenn <2 J., warten lohnt fast immer. Erlös dann frei für Reinvest.',
        impact: 0,
        zeitrahmen: 'Bei §23-Ablauf'
      });
      stJSchritte.push({
        nr: stJSchritte.length + 1,
        titel: 'Reinvest in unterbewertete Lagen (Faktor <22, Lage-Score >70)',
        detail: 'Suchprofil: Objekte in stark wachsenden B-Städten (Leipzig, Dresden, Erfurt, Hannover, Mannheim, Augsburg, Nürnberg) mit Faktor unter 22 und gutem Lage-Score. Dort entsteht oft eine Bewertungs­lücke: Nachfrage steigt schneller als die Kaufpreise. Klassischer "Buy-Below-Replacement-Cost"-Ansatz.',
        impact: 0,
        zeitrahmen: '12-24 Monate nach Verkauf'
      });
      stJSchritte.push({
        nr: stJSchritte.length + 1,
        titel: '§15 EStG-3-Objekt-Grenze beachten — sonst gewerb­licher Grundstücks­handel',
        detail: 'Wenn du in 5 J. mehr als 3 Objekte aus dem Privat­vermögen verkaufst, kommst du in den gewerb­lichen Grundstücks­handel — alle Verkäufe werden rückwirkend voll versteuert (§15 EStG, BFH-Rechtsprechung). Strategie: max. 2-3 Verkäufe in 5 J., oder ab dem 4. Verkauf in die VV-GmbH wechseln.',
        impact: 0,
        zeitrahmen: 'Strategisch'
      });
    } else {
      stJSchritte.push({
        nr: 1,
        titel: 'Kein klarer Faktor-Arbitrage-Kandidat im Bestand',
        detail: 'Aktuell keine Objekte mit Faktor >25 UND schwacher Lage. Strategie kann später relevant werden, wenn der Markt dreht oder neue Objekte hinzukommen. Trotzdem: Bei jedem Neukauf den Faktor mit der Lage abgleichen — Faktor 28 in A-Lage ist okay, Faktor 28 in C-Lage ist nicht okay.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
    }
    stJ.konkrete_schritte = stJSchritte;
    stJ.ansatz = 'Du betrachtest jedes Objekt als Kapital­position mit eigener Rendite/Risiko-Charakteristik. Wenn der Faktor das aktuelle Marktumfeld nicht mehr rechtfertigt (etwa Faktor 28 in B-Lage), ist Verkaufen die rationale Entscheidung. Kapital wandert in Lagen mit besserem Faktor-zu-Lage-Verhältnis.';
    stJ.pros = [
      'Aktive Portfolio-Optimierung statt passives Halten.',
      '§23-Steuer­freiheit bei privatem Verkauf nach 10 J. — voller Wertzuwachs steuerfrei.',
      'Reinvest in stärkere Lagen erhöht Lage-Score-Schnitt des Portfolios.',
      'Geringere Konzentration auf einzelne Marktphasen.'
    ];
    stJ.cons = [
      '3-Objekt-Grenze §15 EStG begrenzt Frequenz auf 2-3 Verkäufe in 5 J.',
      'Transaktions­kosten 8-12 % vom Kaufpreis pro Wechsel (Makler, Notar, GrESt).',
      'Markt-Timing schwer — der "richtige" Zeitpunkt zum Verkaufen ist immer Glück.',
      'Bei Privatverkauf vor §23-Frist voller persönlicher Steuersatz.'
    ];
    stJ.braucht = [
      'Bewusster Umgang mit Trans­aktions­kosten — pro Wechsel ~10 % Reibungs­verlust.',
      '§23-Frist-Tracking pro Objekt (10-Jahres-Halte­dauer).',
      'Steuer­berater für §6b-Reinvestitions­rücklage (bei GmbH-Lösung).',
      'Markt-Recherche für unterbewertete B-Städte.'
    ];

    // ─── STRATEGIE K: WACHSTUMS-KORRIDOR (V134) ───────────────────
    // Bevölkerungs-Hotspots & Nachfrage-Märkte gezielt verstärken
    var stK = {
      key: 'wachstumskorridor',
      name: 'Wachstums-Korridor — Bevölkerungs-Hotspots verstärken',
      ziel: 'Kapital konzentrieren auf Märkte mit struktureller Bevölkerungs- und Nachfrage-Dynamik.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['wachstum', 'aggressiv'],
      impact_5j: 0,
      paragraphs: ['7_4_estg', '23_estg']
    };
    var stKSchritte = [];
    if (port.hotspot_objects && port.hotspot_objects.length > 0) {
      stKSchritte.push({
        nr: 1,
        titel: 'Diagnose: ' + port.hotspot_objects.length + ' Objekt(e) bereits in Wachstums-Hotspots',
        detail: 'Du bist bereits in starken Standorten engagiert: ' + port.hotspot_objects.map(function(o) { return o.kuerzel + (o.ort ? ' (' + o.ort + ')' : ''); }).join(', ') + '. Strategie: dort weiter aufstocken, statt in unbekannte Märkte zu expandieren — du kennst die lokalen Verwalter, Mietspiegel, Behörden.',
        impact: 0,
        zeitrahmen: 'Diagnose'
      });
    } else {
      stKSchritte.push({
        nr: 1,
        titel: 'Diagnose: Aktuell keine Objekte in dokumentierten Hotspots',
        detail: 'Im aktuellen Bestand sind keine Objekte mit gleichzeitig "Bevölkerung wachsend/stark wachsend" UND "Nachfrage stark/sehr stark" markiert (DealScore-Kategorien). Entweder Bewertungs­felder pro Objekt nachpflegen oder beim nächsten Zukauf gezielt diese Kombination suchen.',
        impact: 0,
        zeitrahmen: 'Datenpflege'
      });
    }
    stKSchritte.push({
      nr: stKSchritte.length + 1,
      titel: 'B-Städte-Liste 2026: gezielte Recherche der Wachstums-Profile',
      detail: 'Gut gehende B-Städte in DE mit struktureller Bevölkerungs-Dynamik (Stand 2026): Leipzig, Dresden, Erfurt, Jena (Ost), Mannheim, Heidelberg, Karlsruhe (Südwest), Münster, Osnabrück (Westfalen), Augsburg, Regensburg, Würzburg (Bayern). Charakteristik: Universitäts-/Forschungs­standorte oder Logistik-Hubs mit Verkehrs­anbindung, Bevölkerung >150k.',
      impact: 0,
      zeitrahmen: 'Recherche-Phase'
    });
    stKSchritte.push({
      nr: stKSchritte.length + 1,
      titel: 'Forecast-Daten checken: BBSR + Bertelsmann-Stiftung',
      detail: 'BBSR (Bundes­institut für Bau-, Stadt- und Raum­forschung) veröffentlicht jährlich Bevölkerungs-Prognosen pro Kreis bis 2045. Bertelsmann-Stiftungs­Wegweiser-Kommune liefert demografische Profile. Vor jedem Kauf in einer neuen Region: 15-Jahres-Bevölkerungs-Prognose anschauen — wenn negativ, Lage egal.',
      impact: 0,
      zeitrahmen: 'Pro Zukauf'
    });
    stKSchritte.push({
      nr: stKSchritte.length + 1,
      titel: 'Mit AfA-Hebel kombinieren — RND-Gutachten in Hotspots besonders wertvoll',
      detail: 'In Wachstums-Hotspots steigt der Verkehrs­wert oft schneller als die AfA-Bemessungs­grundlage — d. h. der Steuer­vorteil aus AfA liegt anteilig am Kaufpreis fest, während die Wert­steigerung (steuer­frei nach §23 oder via §6b in der GmbH) zusätzlich kommt. RND-Gutachten beim Kauf von älteren Objekten (>40 J.) in Hotspots fast immer rentabel: höhere AfA + steuer­freier Wertzuwachs.',
      impact: 0,
      zeitrahmen: 'Bei Zukauf'
    });
    stK.konkrete_schritte = stKSchritte;
    stK.ansatz = 'Statt "irgendwo etwas kaufen" gezielt in Märkte gehen, wo Bevölkerungs- und Nachfrage-Trends die Wertentwicklung der nächsten 15 J. tragen. Lage-KPIs aus dem DealScore (Bevölkerung, Nachfrage, Mikrolage) werden zum primären Kauf-Filter.';
    stK.pros = [
      'Bevölkerungs-Dynamik ist der zuverlässigste langfristige Werttreiber.',
      'Mietsteigerungs­potenzial in Hotspots strukturell höher.',
      'Bessere Nachvermietbarkeit bei Mieterwechsel.',
      'Banken finanzieren Hotspot-Objekte mit besseren Konditionen (geringeres Leerstands-Risiko).'
    ];
    stK.cons = [
      'Hotspots sind teurer — Faktor 25-32 statt 18-22 in B-Lagen.',
      'Konkurrenz-Käufer-Dichte hoch — Bietergefechte häufig.',
      'Mietpreisbremse meist aktiv (oft Spannen-Verkauf bei Wieder­vermietung schwer).',
      'Demografische Prognosen können sich ändern (z. B. Energie­krise, Industrie-Schock).'
    ];
    stK.braucht = [
      'Bereitschaft, in höhere Multiplikatoren zu investieren.',
      'Geduld für die Suche — durchschnittlich 6-12 Monate für ein passendes Objekt.',
      'Markt-Daten-Abos (z. B. F+B Mietspiegel-Index, Bulwiengesa-Frühjahrs­gutachten).',
      'Ggf. Bietagent oder Buyers-Broker für Off-Market-Zugang.'
    ];

    // ─── STRATEGIE L: ENERGETISCHER PFLICHT-PFAD (V134) ──────────
    // Wenn Energie­klassen F/G/H im Bestand sind: GEG-Pflichten + Sanierungs-Plan
    var stL = {
      key: 'energie_pflicht',
      name: 'Energie-Pflicht-Pfad — GEG-konform sanieren',
      ziel: 'Energetische Schwachstellen vor regulatorischem Zwang sanieren — und Förderungen mitnehmen.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['sicherheit', 'wachstum'],
      impact_5j: 0,
      paragraphs: ['35a_35c_estg', '7h_7i_estg', '82b_estdv']
    };
    var stLSchritte = [];
    if (port.energie_risiko_objects && port.energie_risiko_objects.length > 0) {
      stLSchritte.push({
        nr: 1,
        titel: 'Diagnose: ' + port.energie_risiko_objects.length + ' Objekt(e) mit Energie­klasse F/G/H',
        detail: 'Betroffene Objekte: ' + port.energie_risiko_objects.map(function(o) { return o.kuerzel + ' (Klasse ' + o.klasse + ')'; }).join(', ') + '. Diese sind GEG-pflicht-relevant: Heizung-Tausch, Dämmung, ggf. PV-Pflicht je nach Bundesland. Bei Verkauf wird der Energie­ausweis Käufer-Argument — schlechte Klassen drücken den Preis um 5-15 %.',
        impact: 0,
        zeitrahmen: 'Diagnose'
      });
      stLSchritte.push({
        nr: stLSchritte.length + 1,
        titel: 'Sanierungs­fahrplan iSFP — qualifizierter Energie-Berater',
        detail: 'Ein iSFP (individueller Sanierungs­fahrplan) durch einen BAFA-zertifizierten Energie­berater zeigt Schritt für Schritt, welche Maßnahmen die Klasse heben — und triggert eine zusätzliche 5%-Förderung in §35c EStG. Förderfähig in BEG-Programmen, BAFA bezuschusst die Beratung bis 50 %.',
        impact: 0,
        zeitrahmen: '2-3 Monate'
      });
      stLSchritte.push({
        nr: stLSchritte.length + 1,
        titel: '§35c EStG — 20 % der Sanierungs­kosten als Steuer­ermäßigung',
        detail: 'Über 3 Jahre verteilt: 7-7-6 % der Kosten direkt von der Steuer­schuld abziehbar (max. 40k pro Wohnung). Bedingung: Objekt selbst genutzt ODER vermietet (seit 2020). Kombi mit BEG-Förderung möglich, aber Doppel-Förderung sperren — pro Maßnahme nur eine Schiene.',
        impact: 0,
        zeitrahmen: 'Über 3 Jahre'
      });
      stLSchritte.push({
        nr: stLSchritte.length + 1,
        titel: 'Modernisierungs-Umlage §559 BGB nutzen',
        detail: 'Bis zu 8 % p.a. der Sanierungs­kosten dürfen auf die Miete umgelegt werden — gestaffelt mit der §559-Kappungsgrenze (3 €/m² in 6 J., 2 €/m² wenn Miete <7 €/m²). Bei einer 70k-Sanierung also bis zu 5.600 € Mehr-Miete/J → schließt oft die Mietlücke und erhöht den Verkehrs­wert proportional.',
        impact: 0,
        zeitrahmen: 'Nach Abnahme'
      });
    } else {
      stLSchritte.push({
        nr: 1,
        titel: 'Aktuell kein Energie-Risiko-Objekt im Bestand',
        detail: 'Im Bestand keine Klassen F/G/H markiert. Falls die Energie­ausweise nicht aktualisiert sind: jetzt prüfen — die GEG-Verschärfungen 2026/2028 betreffen alle vermieteten Objekte. Bei Heizungs­tausch oder Mieterwechsel ist ein neuer Ausweis ohnehin Pflicht.',
        impact: 0,
        zeitrahmen: 'Datenpflege'
      });
    }
    stL.konkrete_schritte = stLSchritte;
    stL.ansatz = 'Du nutzt regulatorischen Zwang als Hebel: Was sowieso gemacht werden MUSS (GEG, BEG-Pflichten), wird mit maximaler Förderung kombiniert (§35c EStG + BEG + iSFP-Bonus + §559-Umlage). Aus einer Pflicht wird ein gut renditierender Sanierungs-Plan.';
    stL.pros = [
      'Regulatorisches Risiko zeitig adressiert.',
      '§35c EStG: 20 % der Kosten als Steuer-Ermäßigung über 3 J.',
      'BEG-Förderungen 15-30 % obendrauf (je nach Maßnahme).',
      '§559-Umlage erhöht Miete dauerhaft.',
      'Verkehrs­wert steigt proportional zur höheren NKM.'
    ];
    stL.cons = [
      'Hoher Kapitaleinsatz pro Objekt (40-80k für umfassende Sanierung).',
      'Bauphase 4-9 Mon. mit potenziellem Mietausfall (selten, aber möglich).',
      'BEG-Förder­anträge VOR Beginn der Maßnahme — lange Laufzeiten.',
      '§35c EStG nicht mit BEG-Förderung doppelt nutzbar (gleicher Maßnahmen-Block).'
    ];
    stL.braucht = [
      'BAFA-zertifizierten Energie­berater für iSFP (~1.500 € Beratung).',
      '40-80k Sanierungs­kapital pro Objekt (oder Annuitäten-Darlehen).',
      'Mieter-Kommunikation 3 Mon. vor Beginn (§555c BGB).',
      'Steuer­berater für §35c-EStG-Anrechnung.'
    ];

    // ─── STRATEGIE M: ALTERSVORSORGE-PFAD (V135) ──────────────────
    // Zielgerichtet auf entschuldetes Portfolio bis zum Renteneintritt.
    // Greift, wenn Anlage-Ziel = altersvorsorge ODER Profil = sicherheit.
    var stM = {
      key: 'altersvorsorge',
      name: 'Altersvorsorge — entschuldetes Portfolio bis zur Rente',
      ziel: 'Bis Renteneintritt ein Bestand mit niedrigem LTV (<30 %), der laufend Cashflow nach Steuer liefert.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['sicherheit', 'cashflow'],
      impact_5j: 0,
      paragraphs: ['7_4_estg', '7_4_satz_2_estg', '23_estg', '13a_13b_erbstg']
    };
    var stMSchritte = [];
    var horizont = inp.ziel_horizon_jahre || 15;

    stMSchritte.push({
      nr: 1,
      titel: 'Diagnose: ' + horizont + ' Jahre Horizont, ' + anzahl + ' Objekt(e), LTV ' + Math.round((port.ltv_aktuell || port.ltv) * 100) + ' %',
      detail: 'Bei einem Horizont von ' + horizont + ' J. ist das Hauptziel: zur Rente einen LTV unter 30 % erreichen, um ~70-80 % der Bruttomiete als Netto-Cashflow zu haben. Bei aktuellem LTV ' + Math.round((port.ltv_aktuell || port.ltv) * 100) + ' % und Tilgungs-Geschwindigkeit ' + Math.round(port.tilg_y || 0).toLocaleString('de-DE') + ' €/J ist Tilgungs-Beschleunigung sinnvoll.',
      impact: 0,
      zeitrahmen: 'Diagnose'
    });

    stMSchritte.push({
      nr: stMSchritte.length + 1,
      titel: 'Sondertilgung 5 % p.a. nutzen — Standard-Recht in fast jedem Vertrag',
      detail: 'Die meisten Annuitäten-Verträge erlauben jährlich 5 % der Ursprungs-Darlehens­summe als Sonder­tilgung ohne Vorfälligkeits-Entschädigung. Bei einem Bestand-Darlehen von ' + Math.round(port.d_total || 0).toLocaleString('de-DE') + ' € sind das bis zu ' + Math.round((port.d_total || 0) * 0.05).toLocaleString('de-DE') + ' €/J zusätzliche Tilgung. Verkürzt die Restlaufzeit erheblich — vorrechnen lassen.',
      impact: 0,
      zeitrahmen: 'Jährlich, vor Jahresende'
    });

    stMSchritte.push({
      nr: stMSchritte.length + 1,
      titel: 'RND-Gutachten zur AfA-Erhöhung (älter als 40 J.)',
      detail: 'Bei Objekten mit Baujahr vor 1986 lohnt fast immer ein RND-Gutachten nach §7 Abs. 4 Satz 2 EStG. Höhere AfA → niedrigere Steuer → mehr Cashflow → schnellere Tilgung. Hebel zwischen 1.000 und 5.000 €/J Steuer-Ersparnis pro Objekt — das geht direkt in Sonder­tilgung.',
      impact: 0,
      zeitrahmen: '3-6 Monate pro Objekt'
    });

    if (anzahl >= 3) {
      stMSchritte.push({
        nr: stMSchritte.length + 1,
        titel: '1-2 Objekte nach §23-Frist verkaufen, Erlös zur Entschuldung',
        detail: 'Wenn der 10-Jahres-Horizont abläuft, kann man 1-2 Objekte steuerfrei verkaufen (§23 EStG) und den Erlös zur kompletten Entschuldung der übrig­bleibenden Objekte nutzen. Beispiel-Rechnung: 3 ETW, jede mit 200k Restschuld. Verkauf der ersten ETW für 380k → Resterlös 180k → tilgt komplett die Restschuld der zweiten ETW. Du hast danach: 1 schuldenfreies Objekt mit voller Miete + 1 fast schuldenfreies + Verkaufserlös der ersten als Cash-Reserve.',
        impact: 0,
        zeitrahmen: 'Nach §23-Ablauf'
      });
    }

    stMSchritte.push({
      nr: stMSchritte.length + 1,
      titel: 'Zinsbindung lang wählen — Zinserhöhungs-Risiko absichern',
      detail: 'Bei Anschluss­finanzierungen vor Renteneintritt: Zinsbindung 15 oder 20 Jahre wählen, auch wenn 0,3-0,5 Pp Aufschlag. Banken bieten aktuell ' + (inp.marktzins_pct || 3.9).toFixed(1).replace('.', ',') + ' % für 10 J., ca. ' + ((inp.marktzins_pct || 3.9) + 0.4).toFixed(1).replace('.', ',') + ' % für 20 J. Wenn die Zinsen steigen, kein Risiko mehr in der Rente. §489 BGB: nach 10 Jahren kannst du jederzeit kündigen, also keine Falle.',
      impact: 0,
      zeitrahmen: 'Bei nächster Anschluss-Finanzierung'
    });

    if (port.zukaufPlan && port.zukaufPlan.belastung_status === 'kritisch') {
      stMSchritte.push({
        nr: stMSchritte.length + 1,
        titel: '⚠ Kein weiterer Zukauf — Bestand zu Ende führen',
        detail: 'Belastungs­quote bereits ' + Math.round((port.zukaufPlan.belastungsquote || 0) * 100) + ' % vom Netto. Bei Altersvorsorge-Ziel hat Stabilität Vorrang vor Wachstum. Konzentriere die Sparquote auf Sondertilgungen, nicht auf Zukäufe. Wenn unbedingt Wachstum gewünscht: ggf. ein Bestand-Objekt verkaufen, mit Erlös 1 neueres effizienteres kaufen, aber per Saldo nicht erweitern.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
    }

    stM.konkrete_schritte = stMSchritte;
    stM.ansatz = 'Du planst rückwärts vom Renteneintritt: Welcher Cashflow ist nötig? Welcher Zustand der Objekte muss in Jahr X erreicht sein? Die Strategien fokussieren auf Tilgungs-Beschleunigung, AfA-Optimierung und §23-genutzte Verkäufe als Entschuldungs-Hebel. Wachstum ist Mittel, nicht Selbstzweck.';
    stM.pros = [
      'Klares Ziel = klare Schritte. Kein Drift, keine Opportunitäts-Käufe.',
      'Zur Rente: planbare passive Einnahme, weitgehend steuer-effizient.',
      '§23 EStG-Verkäufe sind das mächtigste Entschuldungs-Werkzeug.',
      'Stabilität = bei wirtschaftlichen Schocks (Krankheit, Job-Verlust) hält das Portfolio.'
    ];
    stM.cons = [
      'Kein Wachstum mehr — wer noch 30 J. hat, verschenkt Zinses-Zins.',
      'Sondertilgungen sind keine Werbungskosten — der Steuer-Hebel sinkt mit der Schuld.',
      'Bei Inflation entwertet sich der eingezahlte Tilgungs-Betrag teilweise.',
      'Verkäufe lösen Maklerkosten + Notar aus (8-12 % vom Verkaufspreis).'
    ];
    stM.braucht = [
      'Disziplin: 5 %-Sondertilgung jedes Jahr nutzen, nicht "vergessen".',
      'Ggf. 1-2 RND-Gutachten (à 1.000-1.500 €).',
      'Steuer­berater für §23-Verkaufs-Timing.',
      'Bei Anschluss-Finanzierung: Zinsbindungs-Vergleich 10 vs. 20 J. machen.'
    ];

    // ─── STRATEGIE N: VERKAUF AN EIGENE GMBH (V137) ───────────────
    // Verdeckte Einlage / 7-%-Methode nach BFH-Rechtsprechung.
    // Voraussetzung: Objekt > 10 J. (§23 EStG-frei) UND eigene GmbH existiert
    // ODER wird aufgesetzt.
    var stN = {
      key: 'gmbh_verkauf',
      name: 'Verkauf an eigene GmbH (verdeckte Einlage)',
      ziel: 'Bestand in eigene GmbH überführen mit massiver GrESt-Ersparnis durch 7-%-Methode.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['wachstum', 'cashflow', 'aggressiv'],
      impact_5j: 0,
      paragraphs: ['verdeckte_einlage', '27_kstg_einlagekonto', '8b_kstg', '23_estg', '6b_estg']
    };
    var gv = port.gmbhVerkauf;
    var stNSchritte = [];

    if (gv && gv.kandidaten && gv.kandidaten.length > 0) {
      // Schritt 1: Diagnose
      var detailKand = gv.kandidaten.slice(0, 5).map(function(k) {
        return '· ' + k.kuerzel + ': VW ' + Math.round(k.verkehrswert).toLocaleString('de-DE') +
               ' €, Halte­dauer ' + k.halte_dauer_jahre + ' J., GrESt-Ersparnis ' +
               Math.round(k.grest_ersparnis).toLocaleString('de-DE') + ' €';
      }).join('\n');
      stNSchritte.push({
        nr: 1,
        titel: 'Diagnose: ' + gv.kandidaten.length + ' Objekt(e) >10 J. — geeignet für 7-%-Methode',
        detail: 'Objekte über 10 Jahre sind §23 EStG-frei. Verkauf an eigene GmbH zu ' + gv.pct_verwendet.toFixed(0) +
                ' % vom Verkehrswert. GrESt nur auf den Kaufpreis = massive Ersparnis. ' +
                'Konkret pro Objekt:\n' + detailKand + '\n\nGesamt-GrESt-Ersparnis: ' +
                Math.round(gv.summe_grest_ersparnis).toLocaleString('de-DE') + ' € — sofort.',
        impact: gv.summe_grest_ersparnis,
        zeitrahmen: 'Diagnose'
      });
      stN.impact_5j += gv.summe_grest_ersparnis;

      // Schritt 2: Rechtliche Konstruktion
      stNSchritte.push({
        nr: 2,
        titel: 'Rechtliche Konstruktion: Verdeckte Einlage nach §8 Abs. 3 S. 3 KStG',
        detail: 'Verkaufspreis = ' + gv.pct_verwendet.toFixed(0) + ' % des Verkehrswerts. Differenz zum Verkehrswert = verdeckte Einlage.\n\n' +
                'Steuerliche Behandlung:\n' +
                '· GrESt: nur auf den vereinbarten Kaufpreis (' + gv.pct_verwendet.toFixed(0) + ' % vom VW)\n' +
                '· Steuerbilanz GmbH: Aktiva mit Teilwert (= Verkehrswert) gemäß §6 Abs. 1 Nr. 5 EStG i.V.m. §8 Abs. 1 KStG\n' +
                '· Passiva GmbH: Kaufpreis als Verbindlichkeit, Differenz als Kapitalrücklage (steuerliches Einlagekonto §27 KStG)\n' +
                '· Beim Verkäufer: Anschaffungs­kosten der GmbH-Beteiligung steigen um die verdeckte Einlage (§6 Abs. 6 S. 2 EStG)\n' +
                '· §23 EStG: Kein Veräußerungs­gewinn beim Verkäufer, weil Halte­dauer >10 J.\n\n' +
                'BFH-Rechtsprechung: KP zwischen 4-15 % vom Verkehrswert ist nicht „symbolisch". Bei <4 % würde §8 Abs. 2 Nr. 1 GrEStG greifen — dann GrESt auf den Grundbesitzwert.',
        impact: 0,
        zeitrahmen: 'Vor Vertrag'
      });

      // Schritt 3: AfA-Vorteil in der GmbH
      var afa_neu_summe = gv.kandidaten.reduce(function(s, k) { return s + k.afa_y_neu_in_gmbh; }, 0);
      stNSchritte.push({
        nr: 3,
        titel: 'Bonus: Höhere AfA-Bemessungs­grundlage in der GmbH',
        detail: 'Die GmbH aktiviert das Objekt mit dem Teilwert (Verkehrswert), nicht mit dem Kaufpreis. ' +
                'Heißt: höhere AfA-Basis als wenn die GmbH zum Marktpreis gekauft hätte. ' +
                'Bei den ' + gv.kandidaten.length + ' Kandidaten ergibt das gemeinsam ~' +
                Math.round(afa_neu_summe).toLocaleString('de-DE') + ' €/J AfA in der GmbH (bei Standard 2 % auf 75 % Geb.-Anteil). ' +
                'Bei 15,8 % GmbH-Steuersatz: ~' + Math.round(afa_neu_summe * 0.158).toLocaleString('de-DE') + ' €/J Steuerersparnis innerhalb der GmbH.',
        impact: afa_neu_summe * 0.158 * 5,
        zeitrahmen: 'Laufend ab Übertragung'
      });
      stN.impact_5j += afa_neu_summe * 0.158 * 5;

      // Schritt 4: Praktische Schritte
      stNSchritte.push({
        nr: 4,
        titel: 'Umsetzungs-Plan',
        detail: '1. Eigene VV-GmbH gründen (falls nicht vorhanden) — ~1.500 € einmalig.\n' +
                '2. Sachverständigen-Wertgutachten pro Objekt einholen — dokumentiert den Verkehrswert für den verdeckten Einlagen-Teil.\n' +
                '3. Notarvertrag GmbH ↔ Privatperson mit Kaufpreis = ' + gv.pct_verwendet.toFixed(0) + ' % vom VW.\n' +
                '4. Steuerberater bestätigt die Buchung der verdeckten Einlage in der GmbH-Steuerbilanz.\n' +
                '5. Kapitalrücklage in der GmbH wird für spätere steuerfreie Ausschüttung in §27-Einlagekonto eingestellt.\n' +
                '6. Bei Holding-Struktur: nach 1-2 J. GmbH-Anteile in Holding einbringen → §8b KStG-Privileg + Erbschafts­verschonung.',
        impact: 0,
        zeitrahmen: '3-6 Monate Gesamt-Prozess'
      });

      stN.ansatz = 'Du verkaufst dein über 10 Jahre gehaltenes Bestandsobjekt an deine eigene GmbH zu ' +
                   gv.pct_verwendet.toFixed(0) + ' % vom Verkehrswert. GrESt fällt nur auf diesen Kaufpreis an — ' +
                   'die Differenz zum Verkehrswert wird als verdeckte Einlage in die Kapitalrücklage gebucht. ' +
                   'Doppelter Hebel: GrESt-Ersparnis + höhere AfA-Basis in der GmbH.';

      stN.pros = [
        'GrESt-Ersparnis bis ' + Math.round(gv.summe_grest_ersparnis).toLocaleString('de-DE') + ' € — sofort.',
        'AfA-Basis in der GmbH = Verkehrswert (Teilwert), nicht historischer Kaufpreis',
        'Die Differenz wird in das §27 KStG-Einlagekonto gebucht und kann später steuerfrei ausgeschüttet werden.',
        'Anschaffungskosten der GmbH-Beteiligung steigen — bei späterem Verkauf der Anteile niedrigerer Veräußerungsgewinn.',
        'Mit Holding-Struktur kombiniert: §8b KStG + §13a/§13b ErbStG → langfristige Erbschafts-Optimierung.'
      ];
      stN.cons = [
        'Strikt nur bei Objekten > 10 J. — sonst Veräußerungsgewinn beim Verkäufer (§23 EStG).',
        'BFH-Untergrenze 4-5 %: bei zu niedrigem KP wird der Verkehrswert als Bemessungsgrundlage angesetzt → Strategie kippt.',
        'Steuerberater + Notar zwingend — Konstruktion fehleranfällig in der Buchung.',
        'Ausschüttung der Kapitalrücklage hat strenge Reihenfolge nach §27 Abs. 1 S. 5 KStG (zuerst Gewinne, dann Einlagekonto).',
        'Bei nahestehenden Personen (Ehegatte) gelten Sonderregeln — Anschaffungskosten beim Gesellschafter steigen NICHT (BFH).'
      ];
      stN.braucht = [
        'Halte-Dauer > 10 Jahre für die zu übertragenden Objekte (§23 EStG-frei).',
        'Eigene GmbH oder Bereitschaft zur Gründung (~1.500 € Setup).',
        'Sachverständigen-Wertgutachten pro Objekt (~1.500-3.000 € pro Objekt).',
        'Steuerberater mit Erfahrung in verdeckten Einlagen.',
        'KP zwischen 4-15 % vom Verkehrswert — User-Eingabe ' + gv.pct_verwendet.toFixed(0) + ' % liegt im sicheren Bereich.'
      ];
    } else if (gv && gv.nicht_geeignet && gv.nicht_geeignet.length > 0) {
      stNSchritte.push({
        nr: 1,
        titel: 'Aktuell keine Objekte > 10 J. — warten oder umstrukturieren',
        detail: 'Die ' + gv.nicht_geeignet.length + ' Objekt(e) sind noch in der §23-Spekfrist. ' +
                'Strategie ist erst nach Frist­ablauf nutzbar. Alternativ: bei sehr großen Verkehrswert-Differenzen (z. B. >300k pro Objekt) könnte ein Verkauf vor Frist­ablauf trotzdem rechnen — dann zahlst du den Veräußerungsgewinn voll, sparst aber GrESt + bekommst trotzdem die höhere AfA-Basis. Steuerberater-Rechnung erforderlich.',
        impact: 0,
        zeitrahmen: 'Bei §23-Ablauf'
      });
      stN.ansatz = 'Strategie ruht — ' + gv.nicht_geeignet.length + ' Objekt(e) noch in Spekulationsfrist. Wird automatisch aktiv, sobald >10 J. Halte­dauer.';
      stN.pros = ['Massive GrESt-Ersparnis bei späterer Aktivierung', 'BFH-konforme Konstruktion'];
      stN.cons = ['Aktuell nicht aktivierbar', '§23-Frist abwarten zwingend'];
      stN.braucht = ['Halte-Dauer > 10 Jahre', 'Eigene GmbH'];
    } else {
      stNSchritte.push({
        nr: 1,
        titel: 'Keine geeigneten Objekte im Bestand',
        detail: 'Strategie greift nicht ohne Bestand >10 J. Halte­dauer. Bei künftigen Käufen: 10-Jahres-Halte­plan einbauen.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
      stN.ansatz = 'Aktuell nicht anwendbar — kein Bestand mit >10 J. Halte­dauer.';
      stN.pros = ['Massive GrESt-Ersparnis bei künftiger Anwendung'];
      stN.cons = ['Aktuell nicht aktivierbar'];
      stN.braucht = ['Halte-Dauer > 10 Jahre'];
    }
    stN.konkrete_schritte = stNSchritte;

    // ─── STRATEGIE O: EIGENHEIMSCHAUKEL (V138) ────────────────────
    // §13 Abs. 1 Nr. 4a ErbStG + §3 Nr. 4 GrEStG + §23 Abs. 1 Nr. 1 S. 3 EStG
    var stO = {
      key: 'eigenheim_schaukel',
      name: 'Eigenheimschaukel — Vermögen steuerfrei zwischen Ehegatten',
      ziel: 'Großes Vermögen schenkungsteuerfrei auf den Ehepartner übertragen, Freibetrag bleibt unangetastet.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['cashflow', 'sicherheit', 'wachstum', 'aggressiv'],
      impact_5j: 0,
      paragraphs: ['13_4a_erbstg', '3_4_grestg', '23_eigennutzung']
    };
    var ehs = port.eigenheimSchaukel;
    var stOSchritte = [];
    if (ehs && ehs.anwendbar) {
      stOSchritte.push({
        nr: 1,
        titel: 'Diagnose: Familienheim mit Verkehrswert ' + Math.round(ehs.vw / 1000).toLocaleString('de-DE') + 'k €',
        detail: 'Eigenheimschaukel ermöglicht Transfer von ' + Math.round(ehs.transferbarer_betrag).toLocaleString('de-DE') +
                ' € steuerfrei zwischen Ehegatten. Vergleich:\n\n' +
                '· Bei direkter Bargeld-Schenkung über Freibetrag (' + Math.round(ehs.freibetrag).toLocaleString('de-DE') +
                ' € pro 10 J.): Schenkungsteuer ' + Math.round(ehs.alt_steuer_schenkung).toLocaleString('de-DE') + ' €\n' +
                '· Bei normalem Verkauf zwischen Familie: GrESt ' + Math.round(ehs.grest_ersparnis).toLocaleString('de-DE') + ' €\n' +
                '· Eigenheimschaukel: 0 € Steuer\n\n' +
                'Gesamt-Hebel: ' + Math.round(ehs.gesamt_hebel).toLocaleString('de-DE') + ' € einmalig + Freibetrag bleibt erhalten für andere Übertragungen.',
        impact: ehs.gesamt_hebel,
        zeitrahmen: 'Diagnose'
      });
      stO.impact_5j += ehs.gesamt_hebel;

      stOSchritte.push({
        nr: 2,
        titel: 'Schritt 1: Familienheim schenken',
        detail: 'Notarvertrag: Ehegatte A überträgt das Familienheim an Ehegatte B. Steuerfrei nach §13 Abs. 1 Nr. 4a ErbStG, ' +
                'wertmäßig unbegrenzt, kein Objektverbrauch, der 500k-Freibetrag (§16 ErbStG) bleibt unangetastet. ' +
                'Voraussetzung: Familienheim wird gemeinsam zu eigenen Wohnzwecken genutzt (Lebensmittelpunkt). ' +
                'Notarkosten ~0,5-1 % des Werts. Keine Behaltensfrist.',
        impact: 0,
        zeitrahmen: 'Schritt 1 — Tag X'
      });

      stOSchritte.push({
        nr: 3,
        titel: 'Schritt 2: Schamfrist abwarten (mind. 6 Monate)',
        detail: 'Zwischen Schenkung und Rückverkauf muss eine angemessene "Schamfrist" liegen, ' +
                'um den §42 AO-Gestaltungsmissbrauchs-Vorwurf zu vermeiden. ' +
                'Mindestens 6 Monate, in der Praxis oft 12-24 Monate. ' +
                'In dieser Zeit darf KEIN vertraglicher Rückübertragungs-Anspruch bestehen — der Rückverkauf muss freiwillig erfolgen.',
        impact: 0,
        zeitrahmen: '6-24 Monate Wartezeit'
      });

      stOSchritte.push({
        nr: 4,
        titel: 'Schritt 3: Rückverkauf zum Verkehrswert',
        detail: 'Ehegatte B verkauft das Familienheim an A zurück, zum aktuellen Verkehrswert. ' +
                'Sachverständigen-Gutachten zur Dokumentation. Notarvertrag mit marktüblichem KP. ' +
                'Steuerliche Behandlung:\n' +
                '· Keine GrESt: §3 Nr. 4 GrEStG (Ehegatten-Befreiung)\n' +
                '· Keine Spekulationssteuer: §23 Abs. 1 Nr. 1 S. 3 EStG (Eigennutzung)\n' +
                '· Kein neues Erbschafts-/Schenkungssteuer-Thema\n\n' +
                'Ergebnis: B hat steuerfrei Bargeld in Höhe des VW erhalten — ' +
                'A hat das Eigenheim wieder.',
        impact: 0,
        zeitrahmen: 'Schritt 3 — Notarvertrag'
      });

      stOSchritte.push({
        nr: 5,
        titel: 'Bonus: Mehrfache Anwendung möglich',
        detail: 'Anders als bei Bargeld-Schenkungen gibt es bei der Eigenheimschaukel KEINEN Objektverbrauch. ' +
                'Bei Bedarf kann das gleiche Familienheim erneut zwischen den Ehegatten geschaukelt werden. ' +
                'Auch der 500k-Freibetrag (§16 ErbStG) bleibt für andere Schenkungen unangetastet. ' +
                'Praktische Anwendung: alle 10 Jahre wiederholbar, parallel zur normalen Freibetrags-Nutzung für Bargeld-Schenkungen.',
        impact: 0,
        zeitrahmen: 'Wiederholbar'
      });

      stO.ansatz = 'Du nutzt das Privileg des selbstgenutzten Familienheims (§13 Abs. 1 Nr. 4a ErbStG): ' +
                   'Ehegatte A schenkt an B steuerfrei, B verkauft nach 6+ Monaten zum Verkehrswert zurück. ' +
                   'Ergebnis: Vermögen in Höhe von ' + Math.round(ehs.vw / 1000).toLocaleString('de-DE') +
                   'k € steuerfrei transferiert, ohne den 500k-Freibetrag anzutasten.';
      stO.pros = [
        'Wertmäßig unbegrenzte Steuerfreiheit (§13 Abs. 1 Nr. 4a ErbStG)',
        'Freibetrag bleibt unangetastet — parallel weiter nutzbar',
        'Kein Objektverbrauch — mehrfach wiederholbar',
        'Keine Behaltensfrist',
        'Auch GrESt (§3 Nr. 4 GrEStG) und Spekulationssteuer (§23 Abs. 1 Nr. 1 S. 3 EStG) entfallen'
      ];
      stO.cons = [
        '§42 AO-Risiko: bei zu kurzer Schamfrist oder vertraglichem Rückübertragungs-Anspruch wird Konstruktion verworfen',
        'Gilt NUR für selbstgenutztes Familienheim — nicht für Renditeobjekte',
        'BFH zweifelt seit Jahren an der Verfassungsmäßigkeit der Befreiung — könnte sich ändern',
        'Notarkosten bei jeder Übertragung (~0,5-1 % vom Wert)'
      ];
      stO.braucht = [
        'Ehe oder eingetragene Lebenspartnerschaft',
        'Selbstgenutztes Familienheim (Lebensmittelpunkt)',
        'Schamfrist 6+ Monate zwischen Schenkung und Rückverkauf',
        'Sachverständigen-Gutachten zum Verkehrswert für Rückverkauf',
        'Notar + Steuerberater für Vertragsgestaltung'
      ];
    } else {
      stO.ansatz = ehs && ehs.grund ? ehs.grund : 'Eigenheimschaukel nicht aktivierbar';
      stOSchritte.push({
        nr: 1,
        titel: 'Voraussetzungen prüfen',
        detail: 'Damit die Eigenheimschaukel angewandt werden kann, müssen folgende Bedingungen erfüllt sein: (1) Ehe oder eingetragene Lebenspartnerschaft, (2) selbstgenutztes Familienheim, (3) Verkehrswert hinterlegt. Aktuell: ' + (ehs.grund || 'unklar') + '.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
      stO.pros = ['Massiver Steuer-Hebel bei späterer Aktivierung'];
      stO.cons = ['Aktuell nicht aktivierbar'];
      stO.braucht = ['Ehe + Familienheim + Verkehrswert'];
    }
    stO.konkrete_schritte = stOSchritte;

    // ─── STRATEGIE P: SHARE DEAL & 7-JAHRES-REGEL (V138) ──────────
    var stP = {
      key: 'share_deal',
      name: 'Share Deal + 7-Jahres-Regel — Verkauf der GmbH zu 1,5 % Steuer',
      ziel: 'Bei späterem Verkauf des Portfolios: Share Deal über Holding statt Einzelverkauf der Immobilien.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['vermoegen_aufbauen', 'erbschaft', 'altersvorsorge'],
      impact_5j: 0,
      paragraphs: ['share_deal_grestg', '7_jahres_regel_gmbh', '8b_kstg', '6a_grestg']
    };
    var stPSchritte = [];
    var portVw = port.vw_total || port.gi || 0;
    var hatStruktur = inp.hat_struktur && inp.hat_struktur !== 'keine';
    var verkaufsHorizont = inp.verkaufs_horizont_jahre || 0;

    stPSchritte.push({
      nr: 1,
      titel: 'Diagnose: Portfolio-Volumen ' + Math.round(portVw / 1000000 * 10) / 10 + ' Mio €',
      detail: 'Wenn das Portfolio später verkauft werden soll, gibt es zwei Wege:\n\n' +
              'A) Asset Deal — einzelne Immobilien verkaufen:\n' +
              '   · Verkäufer privat: Spekfrist >10 J. → einkommen­steuerfrei, aber GrESt beim Käufer\n' +
              '   · Verkäufer GmbH: KSt + GewSt auf Veräußerungs­gewinn (~30 %)\n\n' +
              'B) Share Deal — GmbH-Anteile verkaufen:\n' +
              '   · Bei <90 % Anteilsübertragung: keine GrESt (§1 Abs. 3 GrEStG)\n' +
              '   · Über Holding: §8b KStG → 95 % steuerfrei → ~1,5 % effektive Steuer auf Veräußerungs­gewinn\n\n' +
              'Bei einem Verkaufserlös von ' + Math.round(portVw / 1000).toLocaleString('de-DE') +
              'k € (theoretisch): Asset Deal aus GmbH = ~30 % Steuer = ~' + Math.round(portVw * 0.30 / 1000).toLocaleString('de-DE') +
              'k €, Share Deal aus Holding = ~1,5 % = ~' + Math.round(portVw * 0.015 / 1000).toLocaleString('de-DE') +
              'k €. Differenz: ~' + Math.round(portVw * 0.285 / 1000).toLocaleString('de-DE') + 'k €.',
      impact: portVw * 0.285,
      zeitrahmen: 'Diagnose'
    });
    stP.impact_5j += portVw * 0.285 * 0.2;  // konservativ: 20% Wahrscheinlichkeit, dass Verkauf ansteht

    if (!hatStruktur) {
      stPSchritte.push({
        nr: 2,
        titel: '→ Holding-Struktur 7+ Jahre vor geplantem Verkauf aufbauen',
        detail: '7 Jahre vor dem geplanten Verkauf muss die Holding-Struktur stehen — wegen §22 UmwStG-Sperrfrist und Mindest-Beteiligungs-Anforderung des §8b KStG zu Beginn des Wirtschaftsjahres.\n\n' +
                'Schritt-für-Schritt:\n' +
                '1. Holding-GmbH gründen (Stammkapital 25k €, davon 12,5k einzahlbar)\n' +
                '2. Operative VV-GmbH gründen (oder bestehende übernehmen)\n' +
                '3. Bestand in die VV-GmbH einbringen (siehe Strategie N — verdeckte Einlage / 7-%-Methode)\n' +
                '4. VV-GmbH-Anteile in die Holding übertragen (§6a GrEStG-Konzernklausel: GrESt-frei bei 95-%-Bedingung)\n' +
                '5. 7+ Jahre laufen lassen — bei jedem späteren Anteilsverkauf greift §8b KStG\n\n' +
                'Setup-Kosten: ~5.000-8.000 € einmalig + ~3.000-5.000 €/J Verwaltung. Lohnt ab Volumen 1,5+ Mio €.',
        impact: 0,
        zeitrahmen: '7+ Jahre Aufbau'
      });
    } else {
      stPSchritte.push({
        nr: 2,
        titel: '✓ Holding-Struktur bereits vorhanden — Verkaufs-Pfad direkt nutzbar',
        detail: 'Du hast bereits eine Holding/VV-GmbH-Struktur. Bei späterem Verkauf der VV-GmbH-Anteile aus der Holding heraus greift §8b KStG: 95 % steuerfrei. ' +
                'Wichtig: Beteiligung muss zu Beginn des Wirtschaftsjahres bestehen, sonst keine Befreiung in diesem Jahr.',
        impact: 0,
        zeitrahmen: 'Sofort'
      });
    }

    stPSchritte.push({
      nr: 3,
      titel: 'Share Deal vorbereiten: 89,9-%-Schwelle nutzen',
      detail: 'Beim Verkauf der VV-GmbH:\n\n' +
              '· Käufer übernimmt 89,9 % der GmbH-Anteile (unter der 90-%-Schwelle des §1 Abs. 3 GrEStG)\n' +
              '· Verkäufer behält 10,1 %\n' +
              '· Keine GrESt — Hebel bei 5 Mio € Portfolio: 175-325k € gespart\n' +
              '· Nach 10 Jahren kann Verkäufer die restlichen 10,1 % zum vereinbarten Preis nachverkaufen\n\n' +
              'Achtung: 90-%-Schwelle hart. Bei mehreren Erwerbern oder verbundenen Personen wird zusammengerechnet. ' +
              '10-Jahres-Frist nach jedem Anteils-Wechsel neu.',
      impact: 0,
      zeitrahmen: 'Beim Verkauf'
    });

    stPSchritte.push({
      nr: 4,
      titel: 'Erlös in der Holding parken — keine Privat-Ausschüttung',
      detail: 'Verkaufserlös landet in der Holding. Bei Ausschüttung ans Privatvermögen würde 26,375 % KapESt + Soli + ggf. KiSt anfallen (~28 %). ' +
              'Stattdessen: Erlös in der Holding belassen und reinvestieren (neue Tochter-GmbHs, Bestands-Erwerb für die nächste Generation, Vermögensverwaltung). ' +
              'Bei Bedarf private Auszahlungen über den 800-€-Sparer-Pauschbetrag und niedrigere Tarif-Veranlagung.',
      impact: 0,
      zeitrahmen: 'Nach Verkauf'
    });

    stP.ansatz = 'Du baust die Holding-Struktur strategisch 7+ Jahre vor dem geplanten Portfolio-Verkauf auf. ' +
                 'Beim späteren Verkauf werden GmbH-Anteile (Share Deal) statt Immobilien (Asset Deal) übertragen — ' +
                 'GrESt entfällt bei <90 %-Übertragung, §8b KStG senkt die Steuer auf den Veräußerungsgewinn auf ~1,5 %.';
    stP.pros = [
      'Steuer-Hebel bei großen Portfolio-Verkäufen massiv: Asset Deal ~30 % vs. Share Deal ~1,5 %',
      'GrESt entfällt komplett (§1 Abs. 3 GrEStG bei <90 %)',
      'Erlös bleibt in der Holding, voll reinvestierbar',
      'Auch für die Erbschaftsplanung optimal: §13a/§13b ErbStG-Verschonung greift'
    ];
    stP.cons = [
      'Vorlauf 7+ Jahre — nicht für kurzfristige Verkaufs-Pläne',
      'Setup-Kosten ~5-8k einmalig + 3-5k/J laufend',
      'Lohnt ab 1,5+ Mio Portfolio-Volumen',
      '10,1 %-Restanteil bleibt beim Verkäufer (§22 UmwStG-Sperrfrist)',
      'Käufer akzeptieren nicht jeden Share Deal — historische Bilanz/Schulden kommen mit'
    ];
    stP.braucht = [
      'Verkaufs-Horizont von 7+ Jahren',
      'Portfolio-Volumen mind. 1,5 Mio €',
      'Holding-Struktur etabliert',
      'Steuerberater + spezialisierter Anwalt für Share Deal'
    ];
    stP.konkrete_schritte = stPSchritte;

    // ─── STRATEGIE Q: FAMILIENSTIFTUNG (V138) ─────────────────────
    var stQ = {
      key: 'familienstiftung',
      name: 'Familienstiftung — Generationenvermögen mit kalkulierter Steuerlast',
      ziel: 'Vermögen in eine Stiftung einbringen — kein vGA-Risiko, Pflichtteils-Schutz, generationenübergreifend.',
      ansatz: '',
      konkrete_schritte: [],
      pros: [],
      cons: [],
      braucht: [],
      passt_zu: ['erbschaft', 'langfristig_halten', 'altersvorsorge'],
      impact_5j: 0,
      paragraphs: ['familienstiftung', '13a_13b_erbstg']
    };
    var stiftV = port.stiftungVergleich;
    var stQSchritte = [];
    if (stiftV && stiftV.empfohlen) {
      stQSchritte.push({
        nr: 1,
        titel: 'Diagnose: Portfolio ' + Math.round(stiftV.portfolio_volumen / 1000000 * 10) / 10 + ' Mio € — Vergleich Holding vs. Stiftung',
        detail: 'Bei einem Vermögen von ' + Math.round(stiftV.portfolio_volumen / 1000).toLocaleString('de-DE') + 'k € über 30 Jahre:\n\n' +
                'HOLDING-VARIANTE:\n' +
                '· Setup-Kosten: ' + Math.round(stiftV.holding.setup_kosten).toLocaleString('de-DE') + ' €\n' +
                '· Steuer auf laufende Erträge: ~' + Math.round(stiftV.holding.steuer_pa).toLocaleString('de-DE') + ' €/J\n' +
                '· Laufende Verwaltung: ' + Math.round(stiftV.holding.laufend_pa).toLocaleString('de-DE') + ' €/J\n' +
                '· Gesamt 30 J.: ' + Math.round(stiftV.holding.gesamt_30j).toLocaleString('de-DE') + ' €\n\n' +
                'STIFTUNG-VARIANTE:\n' +
                '· Errichtungs-Schenkungssteuer: ~' + Math.round(stiftV.stiftung.setup_steuer).toLocaleString('de-DE') + ' €\n' +
                '· Setup-Kosten: ' + Math.round(stiftV.stiftung.setup_kosten).toLocaleString('de-DE') + ' €\n' +
                '· Steuer auf laufende Erträge: ~' + Math.round(stiftV.stiftung.steuer_pa).toLocaleString('de-DE') + ' €/J\n' +
                '· Ersatz-ErbSt nach 30 J.: ' + Math.round(stiftV.stiftung.ersatz_erbst_30j).toLocaleString('de-DE') + ' €\n' +
                '· Laufende Verwaltung: ' + Math.round(stiftV.stiftung.laufend_pa).toLocaleString('de-DE') + ' €/J\n' +
                '· Gesamt 30 J.: ' + Math.round(stiftV.stiftung.gesamt_30j).toLocaleString('de-DE') + ' €\n\n' +
                'EMPFEHLUNG: ' + stiftV.empfehlung,
        impact: 0,
        zeitrahmen: 'Diagnose'
      });

      stQSchritte.push({
        nr: 2,
        titel: 'Errichtung der Familienstiftung',
        detail: 'Notarielle Beurkundung der Stiftungssatzung. Anerkennung durch die zuständige Stiftungsbehörde des Bundeslandes. ' +
                'Wichtig: §15 Abs. 2 ErbStG — bei Familienstiftungen wird die "günstigste Steuerklasse" angewandt, abgeleitet vom entferntesten begünstigten Familienangehörigen. ' +
                'Bei Begünstigung von Kindern und Ehegatten: typisch Steuerklasse I, Freibetrag 200.000 €. ' +
                'Errichtungskosten ~10-15k € + Schenkungssteuer auf das Stiftungsvermögen über Freibetrag.',
        impact: 0,
        zeitrahmen: '6-12 Monate'
      });

      stQSchritte.push({
        nr: 3,
        titel: 'Vermögensübertragung in die Stiftung',
        detail: 'Immobilien werden in die Stiftung eingebracht. GrESt fällt an (kann durch Konzernklausel §6a GrEStG bei vorheriger GmbH-Struktur reduziert werden). ' +
                'Stiftung wird zum Eigentümer der Immobilien. Erträge unterliegen der KSt zu 15 % + ggf. GewSt (mit erweiterter Kürzung §9 Nr. 1 S. 2 GewStG sehr ähnlich GmbH).',
        impact: 0,
        zeitrahmen: 'Schritt-für-Schritt'
      });

      stQSchritte.push({
        nr: 4,
        titel: 'Begünstigte definieren — Auszahlungs-Plan',
        detail: 'In der Stiftungssatzung wird definiert: wer ist Begünstigter (z.B. Stifter zu Lebzeiten, dann Kinder, dann Enkel), ' +
                'unter welchen Bedingungen werden Auszahlungen gemacht, wie hoch sind sie, wer entscheidet darüber. ' +
                'Bei Auszahlung an Begünstigte: ggf. KapESt-pflichtig wie bei GmbH-Ausschüttung, alternative steuerfreie Zuwendungen für Lebenshaltungs­bedarf möglich.',
        impact: 0,
        zeitrahmen: 'Bei Errichtung'
      });

      stQSchritte.push({
        nr: 5,
        titel: 'Ersatz-Erbschaftsteuer alle 30 Jahre einkalkulieren',
        detail: '§1 Abs. 1 Nr. 4 ErbStG: alle 30 Jahre unterliegt das Stiftungsvermögen der Erbschaftsteuer (Steuerklasse I). ' +
                'Bei steigendem Vermögen entsprechend steigend. Geplant über die Generationen kann das mit Begünstigten-Ausschüttungen vor dem Stichtag (z.B. Hauskäufe für Kinder, Ausbildungs­finanzierungen) optimiert werden.',
        impact: 0,
        zeitrahmen: 'Alle 30 Jahre'
      });

      stQ.ansatz = stiftV.empfehlung;
      stQ.pros = [
        stiftV.stiftung.vorteil,
        'Schutz vor Pflichtteils-Ansprüchen — Vermögen bleibt im Familien-Generationen-Plan',
        '§13a/§13b ErbStG-Verschonung beim Übergang ins Stiftungsvermögen möglich (Vermögens-Holding)',
        'Generationenvermögen — kein Anteilsverkauf zwischen Erben möglich'
      ];
      stQ.cons = [
        stiftV.stiftung.nachteil,
        'Schenkungsteuer bei Errichtung (~' + Math.round(stiftV.stiftung.setup_steuer / 1000).toLocaleString('de-DE') + 'k €)',
        'Ersatz-ErbSt alle 30 J. (~' + Math.round(stiftV.stiftung.ersatz_erbst_30j / 1000).toLocaleString('de-DE') + 'k €)',
        'Hohe Errichtungs- und Verwaltungs­kosten',
        'Unwiderruflich — Vermögen geht der Stifterfamilie zivilrechtlich verloren'
      ];
      stQ.braucht = [
        'Portfolio-Volumen 2+ Mio € für sinnvolle Hebel',
        'Klarer Generationen-Plan (Stifterwille bindend)',
        'Spezialisierter Steuerberater + Stiftungs-Anwalt',
        'Anerkennung durch Stiftungsbehörde des Bundeslandes'
      ];
    } else {
      stQ.ansatz = stiftV && stiftV.grund ? stiftV.grund : 'Stiftung-Erwägung nicht aktiviert';
      stQSchritte.push({
        nr: 1,
        titel: 'Voraussetzungen prüfen',
        detail: 'Eine Familienstiftung lohnt sich i.d.R. erst ab 2 Mio € Portfolio-Volumen mit klarem Generationenplan. ' +
                'Aktivierung über Setting "Stiftung erwägen" möglich. Aktuell: ' + (stiftV.grund || 'unklar') + '.',
        impact: 0,
        zeitrahmen: 'Strukturell'
      });
      stQ.pros = ['Hebel bei großen Vermögen + Generationen-Plan'];
      stQ.cons = ['Aktuell nicht aktivierbar / nicht sinnvoll bei diesem Volumen'];
      stQ.braucht = ['Volumen 2+ Mio + Stiftungs-Wille'];
    }
    stQ.konkrete_schritte = stQSchritte;

    strategien.push(stA, stB, stC, stD, stE, stF, stG, stH, stI, stJ, stK, stL, stM, stN, stO, stP, stQ);

    // ─── PEER-VERGLEICH (V129) ─────────────────────────────────
    // 2-3 archetypische Investoren-Profile, die je nach Bestand
    // unterschiedliche Vorgehen wählen würden.
    var peers = _buildPeerScenarios(port, rows, anzahl, freeEk, beleihReserve);

    return { strategien: strategien, peers: peers };
  }

  function _buildPeerScenarios(port, rows, anzahl, freeEk, beleihReserve) {
    var peers = [];

    // Peer 1: Der vorsichtige Beamte (40-50, sicherer Job, will Altersvorsorge)
    peers.push({
      typ: 'Vorsichtiger Beamter',
      kontext: '50 Jahre, Beamter, Vollzeit, will in 15 J in Rente — fokussiert auf entschuldetes Portfolio.',
      vorgehen: anzahl <= 3
        ? 'Würde mit deinem Bestand wahrscheinlich AUFHÖREN, weiter zu kaufen. Stattdessen Sondertilgung priorisieren, RND-Gutachten machen, langfristige Anschluss­finanzierungen planen.'
        : 'Würde 1-2 Objekte in §23-Frist abwarten, dann steuerfrei verkaufen, mit Erlös die übrigen Objekte fast komplett entschulden. Ziel: 5 entschuldete Objekte zur Rente.',
      andersAlsDu: 'Verzichtet auf jede GmbH-Struktur. Keine Beleihungs­reserven heben. Reines Buy-and-hold.'
    });

    // Peer 2: Der ambitionierte Selbständige (35-45, Cashflow, Wachstum)
    peers.push({
      typ: 'Ambitionierter Selbständiger',
      kontext: '40 Jahre, Selbständig, hohes Einkommen aber schwankend — sucht Vermögensaufbau + Steuer­optimierung.',
      vorgehen: anzahl <= 5
        ? 'Würde JETZT eine VV-GmbH gründen für künftige Käufe und nebenher eine kleine Op-GmbH (Verwaltung) aufsetzen. Erste 1-2 Käufe direkt in die GmbH. Beleihungs­reserve im Bestand aktivieren — Hebel ~' + Math.round(beleihReserve * 4).toLocaleString('de-DE') + ' € Investitions­volumen.'
        : 'Würde Holding aufsetzen, bestehende GmbHs darunter sortieren. Op-GmbH für Sanierung — Fahrtkosten, Personal, Werkzeug werden Betriebs­ausgabe. Bestand teilweise erst nach §23-Frist umhängen.',
      andersAlsDu: 'Geht aktiv ins Risiko. Hohe LTVs (90 %+) sind Standard. Reinvestiert Mieten konsequent statt zu entnehmen.'
    });

    // Peer 3: Der Family-Office-Investor (50+, hoher Bestand, langfristig)
    peers.push({
      typ: 'Family-Office-Investor',
      kontext: '55 Jahre, hoher Bestand, denkt an Nachfolge — fokussiert auf Generationen-Transfer.',
      vorgehen: anzahl >= 8
        ? 'Würde Holding-Struktur priorisieren — nicht wegen laufender Steuern, sondern wegen späterer Nachfolge­regelung. Anteile sind leichter zu übertragen als Immobilien einzeln. §6a UmwStG-Wege bei Einbringung prüfen.'
        : 'Würde mit deinem Bestand klein anfangen: VV-GmbH gründen, in den nächsten 10 Jahren systematisch hineinwachsen, Holding kommt erst ab 8+ Objekten.',
      andersAlsDu: 'Denkt in 20-Jahres-Horizonten. Akzeptiert auch komplexe Strukturen, weil sie spätere Übertragungen einfacher machen.'
    });

    return peers;
  }

  async function _loadObjects() {
    if (typeof getAllObjectsData === 'function') {
      try { return (await getAllObjectsData()) || []; } catch(e) {}
    }
    var out = [];
    try {
      var raw = localStorage.getItem('ji_objects') || localStorage.getItem('dp_objects') || '[]';
      out = JSON.parse(raw) || [];
    } catch(e) {}
    if (!out.length) {
      // Fallback: Einzel-Keys ji_<timestamp>
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('ji_') === 0 || k.indexOf('dp_obj_') === 0)) {
          try {
            var d = JSON.parse(localStorage.getItem(k) || '{}');
            if (d && (d.kp || (d.data && d.data.kp))) out.push(d);
          } catch(e) {}
        }
      }
    }
    return out;
  }

  // ── EXPORT ──────────────────────────────────────────────────────
  window.PortfolioStrategy = {
    loadAndAnalyze:    loadAndAnalyze,
    getState:          function() { return _state; },
    setInputs:         function(o) { Object.assign(_state.inputs, o || {}); },
    setConfig:         function(o) { Object.assign(_state.config, o || {}); },
    aggregateObject:   _aggregateObject,
    aggregatePortfolio:_aggregatePortfolio,
    verdictsForObject: _verdictsForObject,
    findGmbhTier:      _findGmbhTier,
    calcGmbhVorteil:   _calcGmbhVorteil,
    PROFILES:          PROFILES,
    ZIELE:             ZIELE,
    OBJEKT_TYP_LABELS: OBJEKT_TYP_LABELS,
    DEFAULTS:          DEFAULTS,
    GLOSSARY:          PARAGRAPH_GLOSSARY,
    GMBH_TIERS:        GMBH_TIERS,
    VERSION:           'V144'
  };

})();
