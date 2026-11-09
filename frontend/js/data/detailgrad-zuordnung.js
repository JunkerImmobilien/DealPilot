/* frontend/js/data/detailgrad-zuordnung.js — ERZEUGT, nicht von Hand ändern.
   Quelle: design/Vorschläge/arbeitsbereich-detailgrad-zuordnung.json (Stand 2026-11-09)
   Neu erzeugen: node tools/detailgrad-pruefen.mjs --schreiben
   Je Reiter und Stufe (1 Einsteiger · 2 Fortgeschritten · 3 Experte): Karten/Bereiche und Feld-ids,
   die AB dieser Stufe erscheinen. Was nicht gelistet ist, ist Experte. Leser: js/detailgrad.js. */
window.DpDetailgradZuordnung = {
 "stand": "2026-11-09",
 "reiter": {
  "s0": {
   "1": {
    "karten": [
     {
      "s": "#plz",
      "art": "kind",
      "titel": "Objektdaten"
     },
     {
      "s": "#qz-card",
      "art": "karte",
      "titel": "Automatisch ermittelt"
     },
     {
      "s": "#oe-karte-lage",
      "art": "karte",
      "titel": "Lage & Einschätzung"
     },
     {
      "s": "#img-inp",
      "art": "kind",
      "titel": "Objektfotos"
     }
    ],
    "felder": [
     "str",
     "hnr",
     "plz",
     "ort",
     "objart",
     "wfl",
     "zimmer",
     "etage",
     "einheiten",
     "baujahr",
     "ds2_zustand",
     "ds2_energie",
     "kaufdat",
     "brw",
     "brw_stichtag",
     "ausst",
     "lageklasse",
     "makrolage",
     "mikrolage",
     "svwert",
     "svw_herkunft",
     "img-inp"
    ]
   },
   "2": {
    "karten": [
     {
      "s": "#oe-karte-gewerke",
      "art": "karte",
      "titel": "Gewerke & Ausstattung"
     },
     {
      "s": "#notizen",
      "art": "kind",
      "titel": "Sonstige Bemerkungen"
     }
    ],
    "felder": [
     "nutzungsart",
     "etagen_ges",
     "standardstufe",
     "vermstand",
     "gsfl",
     "mea",
     "kuerzel",
     "ds2_bevoelkerung",
     "ds2_nachfrage",
     "ds2_wertsteigerung",
     "ds2_entwicklung",
     "notizen",
     "eq_walls",
     "mod_aussenwand",
     "ausst_aussenwaende",
     "eq_roof",
     "mod_dach",
     "ausst_dach",
     "eq_windows",
     "mod_fenster",
     "ausst_fenster",
     "eq_heating",
     "mod_heizung",
     "ausst_heizung",
     "eq_bath",
     "mod_baeder",
     "ausst_sanitaer",
     "eq_floor",
     "ausst_fussboeden",
     "mod_innenausbau",
     "ausst_innenwaende",
     "ausst_decken",
     "mod_leitungen",
     "ausst_technik",
     "mod_grundriss"
    ]
   },
   "3": {
    "karten": [
     {
      "s": "#oe-auto-wrap",
      "art": "block",
      "titel": "Parameter der Verkehrswertermittlung (in Automatisch ermittelt)"
     }
    ],
    "felder": []
   }
  },
  "s1": {
   "1": {
    "karten": [
     {
      "s": "#kp",
      "art": "kind",
      "titel": "Kaufpreis & Nebenkosten"
     }
    ],
    "felder": [
     "kp",
     "gest_p",
     "notar_p",
     "gba_p",
     "makler_p",
     "ji_p",
     "san"
    ]
   },
   "2": {
    "karten": [
     {
      "s": "#sanbedarf_toggle",
      "art": "kind",
      "titel": "Sanierung"
     },
     {
      "s": "#sanbedarf_body",
      "art": "block",
      "titel": "Sanierung · FESH-Kacheln"
     },
     {
      "s": "#san_tax_years_wrap",
      "art": "block",
      "titel": "Sanierung · steuerliche Verteilung (v3236: in Einsteiger nur die Summe)"
     },
     {
      "s": "#san-plan-wrap",
      "art": "block",
      "titel": "Sanierung · weitere Sanierungen in späteren Jahren"
     },
     {
      "s": "#moebl",
      "art": "kind",
      "titel": "Inventar"
     },
     {
      "s": "#zb-karte",
      "art": "karte",
      "titel": "Mieterhöhung und Zielbild"
     },
     {
      "s": "#zb-leiter",
      "art": "block",
      "js": "potenzial.js",
      "titel": "Mietleiter ETW/EFH/ZFH (in der Zielbild-Karte)"
     }
    ],
    "felder": [
     "sanbedarf_toggle",
     "fesh_f",
     "fesh_f_cost",
     "fesh_e",
     "fesh_e_cost",
     "fesh_s",
     "fesh_s_cost",
     "fesh_h",
     "fesh_h_cost",
     "fesh_d",
     "fesh_d_cost",
     "fesh_b",
     "fesh_b_cost",
     "fesh_k",
     "fesh_k_cost",
     "fesh_o",
     "fesh_o_cost",
     "san_ausgefuehrt",
     "san_ust",
     "san_tax_active",
     "san_tax_years",
     "moebl",
     "zb_fertig_jahr",
     "zb_markt_qm",
     "zb_vgl_qm",
     "zb_soll_qm",
     "zb_soll_ab",
     "zb_ziel_qm",
     "zb_ziel_wann"
    ]
   }
  },
  "s2": {
   "1": {
    "karten": [
     {
      "s": "#nkm",
      "art": "kind",
      "titel": "Mietstruktur"
     },
     {
      "s": "#mietstg",
      "art": "kind",
      "titel": "Mietentwicklung · Prognose"
     },
     {
      "s": "#wertstg",
      "art": "kind",
      "titel": "Prognose-Annahmen"
     }
    ],
    "felder": [
     "nkm",
     "ze",
     "umlagef",
     "mietstg",
     "wertstg",
     "leerstand"
    ]
   },
   "2": {
    "karten": [
     {
      "s": "#ds2_marktmiete",
      "art": "kind",
      "titel": "Mietpreis-Analyse"
     },
     {
      "s": "#mv-objekt-karte",
      "art": "karte",
      "titel": "Mietvertrag für dieses Objekt"
     },
     {
      "s": "#dp-mietrecht-karte",
      "art": "karte",
      "js": "potenzial.js",
      "titel": "Mietrecht an dieser Adresse"
     }
    ],
    "felder": [
     "ds2_marktmiete",
     "ds2_mietausfall",
     "mv_art",
     "mv_beginn",
     "mv_letzte_erhoehung",
     "mv_letzte_erhoehung_betrag",
     "mv_befristet_bis",
     "mv_kuendigungsverzicht_bis",
     "mv_abw_jahre",
     "kostenstg",
     "btj",
     "exit_bmy"
    ]
   }
  },
  "s3": {
   "1": {
    "karten": [
     {
      "s": "#v10-zins-compact",
      "art": "karte",
      "titel": "Empfohlen für Ihr Objekt (Zinsen kompakt)"
     },
     {
      "s": "#d1",
      "art": "kind",
      "titel": "Darlehen I – Hauptdarlehen"
     },
     {
      "s": "#ltv-explanation",
      "art": "kind",
      "titel": "Finanzierungsübersicht"
     }
    ],
    "felder": [
     "ek",
     "d1",
     "d1z",
     "d1t",
     "d1_bindj"
    ]
   },
   "2": {
    "karten": [
     {
      "s": "#mr-pf-grid",
      "art": "kind",
      "titel": "Indikative Konditionen nach Zinsbindung"
     },
     {
      "s": "#d2",
      "art": "kind",
      "titel": "Darlehen II – Zusatzdarlehen"
     },
     {
      "s": "#dw-card",
      "art": "karte",
      "titel": "Weitere Darlehen"
     },
     {
      "s": "#bi-dscr",
      "art": "kind",
      "titel": "Bankargumente"
     }
    ],
    "felder": [
     "d1_type",
     "bank_inst",
     "ek_ist_nk",
     "d1_anschl_enable",
     "anschl_z",
     "anschl_t",
     "anschl_bj",
     "d2_enable",
     "d2_type",
     "d2_inst",
     "d2_vertrag",
     "d2_bspar",
     "d2_auszahl",
     "d2_vertragsdatum",
     "d2",
     "d2z",
     "d2t",
     "d2_bindj",
     "d2_anschl_enable",
     "d2_az",
     "d2_at"
    ]
   }
  },
  "s4": {
   "1": {
    "karten": [
     {
      "s": "#hg_ul",
      "art": "kind",
      "titel": "Umlagefähige Kosten / Jahr"
     },
     {
      "s": "#hg_nul",
      "art": "kind",
      "titel": "Nicht umlagefähige Kosten / Jahr"
     },
     {
      "s": "#r-bwk",
      "art": "kind",
      "titel": "BWK Zusammenfassung"
     }
    ],
    "felder": [
     "hg_ul",
     "grundsteuer",
     "hg_nul",
     "mietausfall"
    ]
   },
   "2": {
    "karten": [
     {
      "s": "#bwk-modus-btns",
      "art": "kind",
      "titel": "Eingabe-Modus (Detailliert | % der NKM)"
     },
     {
      "s": "#bwk-percent-mode",
      "art": "block",
      "titel": "Prozent-Modus: BWK – Quick-Eingabe + Berechnete BWK"
     },
     {
      "s": "#bwk_ul_pct",
      "art": "kind",
      "titel": "BWK – Quick-Eingabe"
     },
     {
      "s": "#bwk_pct_nkm",
      "art": "kind",
      "titel": "Berechnete BWK"
     }
    ],
    "felder": [
     "bwk_ul_pct",
     "bwk_nul_pct",
     "ul_sonst",
     "weg_r",
     "eigen_r",
     "nul_sonst"
    ]
   }
  },
  "s3-tax": {
   "1": {
    "karten": [
     {
      "s": "#tax-personal-card",
      "art": "karte",
      "titel": "Persönliche Steuer"
     },
     {
      "s": "#tax-timeline-card",
      "art": "karte",
      "titel": "Steuerverlauf"
     }
    ],
    "felder": [
     "grenz"
    ]
   },
   "2": {
    "karten": [
     {
      "s": "#tax-flow-hint",
      "art": "karte",
      "titel": "Was mit diesen Werten passiert"
     },
     {
      "s": "#afa_satz",
      "art": "kind",
      "titel": "AfA-Konfiguration"
     },
     {
      "s": "#tax-result-box",
      "art": "kind",
      "titel": "Steuer-Modul · Echte Progression"
     }
    ],
    "felder": [
     "zve",
     "grenz_auto",
     "afa_satz",
     "geb_ant"
    ]
   }
  },
  "s5": {
   "1": {
    "karten": [
     {
      "s": ".ai-box",
      "art": "block",
      "titel": "Investment-Analyse (ai-box)"
     }
    ],
    "felder": [
     "ai-in-pdf"
    ]
   },
   "2": {
    "karten": [],
    "felder": []
   },
   "3": {
    "karten": [
     {
      "s": ".ai-pdf-details",
      "art": "block",
      "titel": "Bausteine im PDF"
     }
    ],
    "felder": []
   }
  },
  "s6": {
   "1": {
    "karten": [
     {
      "s": "#dealscore-card",
      "art": "karte",
      "titel": "DealPilot Score"
     },
     {
      "s": "#dealscore2-card",
      "art": "karte",
      "titel": "Investor Deal Score"
     },
     {
      "s": "#cr-title",
      "art": "kind",
      "titel": "Cashflow – Korrekte Berechnung"
     },
     {
      "s": "#r-bmy",
      "art": "kind",
      "titel": "Alle Kennzahlen"
     },
     {
      "s": "#card-wert-zielbild",
      "art": "karte",
      "js": "wert-zielbild.js",
      "titel": "Wert & Zielbild"
     }
    ],
    "felder": []
   },
   "2": {
    "karten": [
     {
      "s": "#kpi-eval-card",
      "art": "karte",
      "titel": "Kennzahlen-Bewertung"
     },
     {
      "s": "#ai-mini-card",
      "art": "karte",
      "titel": "Pilot-Kurzfazit"
     },
     {
      "s": "#card-vermoegen-zuwachs",
      "art": "karte",
      "titel": "Vermögenszuwachs · 10 Jahre"
     },
     {
      "s": "#card-cashflow-projektion",
      "art": "karte",
      "titel": "Cashflow-Projektion"
     }
    ],
    "felder": []
   }
  },
  "s8": {
   "1": {
    "karten": [
     {
      "s": "#dab-cockpit",
      "art": "block",
      "js": "deal-action-boarding.js",
      "titel": "Bereit für die Bank (Readiness)"
     },
     {
      "s": "#dab-smart",
      "art": "block",
      "js": "deal-action-boarding.js",
      "titel": "Dokumente & Exporte (Investment-PDF)"
     },
     {
      "s": "#dab-rails-host",
      "art": "block",
      "js": "deal-action-boarding.js",
      "titel": "Dein Netzwerk"
     }
    ],
    "felder": []
   },
   "2": {
    "karten": [
     {
      "s": "#dab-mb-host",
      "art": "block",
      "js": "deal-action-boarding.js",
      "titel": "Marktberichte"
     },
     {
      "s": "#dab-dr-host",
      "art": "block",
      "js": "deal-action-boarding.js",
      "titel": "Bordkarte & Unterlagen"
     }
    ],
    "felder": []
   },
   "3": {
    "karten": [
     {
      "s": "#dpuew-stage",
      "art": "block",
      "js": "deal-action.js",
      "titel": "In Gesellschaft überführen"
     }
    ],
    "felder": []
   }
  }
 }
};
