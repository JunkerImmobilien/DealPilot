/* Erzeugt von tools/handbuch-erzeugen.mjs — NICHT von Hand aendern. */
window.DP_HANDBUCH = {
 "version": "v2555",
 "quellen": {
  "index.html": "1c94fd03702f9354",
  "tooltip-content.js": "ede920d2f6583fdc",
  "help.js": "f7e7ccb0d347a0e2",
  "tour-content.js": "337253bde80bf1e1",
  "objekt-reiter.js": "146e176f961a3b25",
  "deal-action-readycheck.js": "4d9c815073f8d2ab",
  "feld-hilfe.js": "db5913c4ec4dc08e",
  "mfh-einheiten.js": "9fdc26a09d7d7669",
  "calc.js": "c43592c29e191de1",
  "ui.js": "c2c22102bef4ef5e",
  "pdf.js": "315c92dfeefac6e7",
  "pdf-investment-bank.js": "cd661801c609d54c",
  "financing-pdf.js": "499286d3cab32382",
  "werbungskosten-pdf.js": "4048d673682f3acb",
  "pdf-anlage-bmf.js": "41997cf31f29fb07",
  "pdf-kaufpreisaufteilung.js": "fe5f492746a957c4",
  "frontend-konstanten.json": "0a7cb96f8371632c",
  "aufnahme.json": "433c9aa7f5c9ec56",
  "handbuch-ablaeufe.mjs": "4a50fccab170f185"
 },
 "reiter": [
  {
   "sec": "s0",
   "name": "Objekt",
   "titel": "Objekt & Fotos",
   "desc": "Grunddaten, Lage und Objektfotos für den Bankexport",
   "hilfe": {
    "titel": "Objekt — Grunddaten, Lage und Eingabetiefe",
    "text": "Hier beginnt jedes Objekt: <strong>PLZ</strong>, <strong>Ort</strong>, <strong>Straße</strong>, <strong>Hausnummer</strong>, <strong>Objektart</strong>, <strong>Wohnfläche (m²)</strong> und <strong>Baujahr</strong>. Dazu kommen Zimmer, Zustand, Standardstufe (NHK 2010), Energieklasse, Vermietungsstand und die Wertanker (<strong>Bankbewertung</strong>, <strong>Verkehrswert</strong>).\n\n<strong>Eingabetiefe</strong> — sie bestimmt, welche Felder Pflicht sind:\n• <strong>Einfach · Stufe 1</strong> — Adresse, Objektart, Wohnfläche, Baujahr: Marktpreisindikation.\n• <strong>Mittel · Stufe 2</strong> — dazu Kaufpreis, Miete, Zustand, Energie, Standardstufe: erweiterte Indikation.\n• <strong>Ausgiebig · Stufe 3</strong> — dazu Grundstück, Bodenrichtwert, bei Häusern BGF und NHK-Typ: Sach- und Ertragswert nach ImmoWertV.\n\nFehlende Pflichtfelder sind rot umrandet; „x fehlt“ zeigt sie dir. In der Box <strong>Marktbericht abrufen</strong> holst du den Bericht der gewählten Stufe — Stufe 2 gibt es ab Investor, Stufe 3 ab Pro.\n\nTipp: Liegt der Verkehrswert über dem Kaufpreis, zeigt DealPilot oben den <strong>Sofortigen Wertpuffer / Equity</strong>."
   },
   "tour": {
    "titel": "Boarding-Pass zum Objekt",
    "text": "Auch hier im **Tab Objekt** erstellst du jederzeit einen **Boarding-Pass** — und teilst ihn per Link oder QR-Code."
   },
   "karten": [
    {
     "titel": "Objektdaten",
     "felder": [
      "plz",
      "ort",
      "str",
      "hnr",
      "objart",
      "nutzungsart",
      "wfl",
      "zimmer",
      "baujahr",
      "etage",
      "etagen_ges",
      "einheiten",
      "ds2_zustand",
      "standardstufe",
      "ds2_energie",
      "vermstand",
      "gsfl",
      "mea",
      "kuerzel",
      "thesis",
      "risiken",
      "exitstr",
      "kaufdat",
      "wirtschaftlicher_uebergang",
      "halter",
      "mand_ueberf_cb",
      "verkehrswert_ueberf",
      "ueberf_preis",
      "halter_seit",
      "gesellschafterdarlehen",
      "ueberf_restschuld",
      "ueberf_rest_zins",
      "ueberf_ende"
     ]
    },
    {
     "titel": "Automatisch ermittelt",
     "felder": [
      "brw",
      "brw_stichtag",
      "ausst"
     ]
    },
    {
     "titel": "Gewerke & Ausstattung",
     "felder": [
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
    {
     "titel": "Bauteile & Grundstück",
     "felder": [
      "eq_elevator",
      "eq_guest_wc",
      "eq_store_room",
      "bad_anz",
      "balkon_flae",
      "garagen",
      "stellpl_aussen",
      "modernis",
      "baustatus",
      "gemarkung",
      "flur",
      "flurstueck",
      "hinterland_qm",
      "hinterland_eur_qm",
      "hinterland_rentierlich",
      "erbpacht",
      "erbbauzins",
      "erb_restlz",
      "erb_zs_ang",
      "erb_entsch",
      "erb_wert_ist_erb"
     ]
    },
    {
     "titel": "Lage & Einschätzung",
     "felder": [
      "lageklasse",
      "makrolage",
      "mikrolage",
      "ds2_bevoelkerung",
      "ds2_nachfrage",
      "ds2_wertsteigerung",
      "ds2_entwicklung",
      "bankval",
      "svwert",
      "wert_soll"
     ]
    },
    {
     "titel": "Sonstige Bemerkungen",
     "felder": [
      "notizen"
     ]
    },
    {
     "titel": "Mieterhöhung und Zielbild",
     "felder": [
      "zb_fertig_jahr",
      "zb_vgl_qm",
      "zb_soll_qm",
      "zb_soll_ab",
      "zb_ziel_qm",
      "zb_ziel_wann"
     ]
    },
    {
     "titel": "Sach- und Ertragswert · Stufe 3",
     "felder": [
      "bgf",
      "grundriss",
      "mod_punkte",
      "sachwertfaktor",
      "uk_flaeche",
      "wgfz_objekt",
      "stellplatz_miete_monat",
      "sonstige_jahr",
      "nhk_haus",
      "nhk_geschosse",
      "nhk_dach",
      "garagen_bgf_qm",
      "garagen_stufe",
      "aussenanlagen_pct",
      "aussenanlagen",
      "bes_bauteile",
      "btl_gauben",
      "btl_balkone",
      "btl_vordach",
      "btl_terrassen",
      "btl_sonstige",
      "lzs_pct",
      "brw_manuell",
      "brw_anpassung_pct",
      "brw_anpassung_grund"
     ]
    }
   ]
  },
  {
   "sec": "s1",
   "name": "Investition",
   "titel": "Kaufpreis & Investition",
   "desc": "Kaufpreis, Nebenkosten, Gesamtinvestition und Prognose-Annahmen",
   "hilfe": {
    "titel": "Investition — Kaufpreis und Kaufnebenkosten",
    "text": "Trag den <strong>Kaufpreis</strong> ein und darunter die Kaufnebenkosten. Jede Position gibt es doppelt — in Prozent und in Euro; änderst du eins, rechnet DealPilot das andere nach:\n• <strong>Makler</strong>\n• <strong>Notar</strong>\n• <strong>Grundbuchamt</strong> (bei neuen Objekten mit 0,5 % vorbelegt)\n• <strong>Grunderwerbsteuer</strong> (neu vorbelegt mit 6,5 % — prüf den Satz deines Bundeslands)\n• <strong>Sonstige</strong> — Bausachverständiger, Anfahrt, Gutachten\n\nDaraus entstehen <strong>Summe Nebenkosten</strong> und die <strong>Gesamtinvestition</strong> = Kaufpreis + Nebenkosten + Sanierungskosten + Inventarkosten. Der <strong>Markt-Faktor</strong> (Kaufpreis ÷ Jahres-Nettokaltmiete) rechnet sich selbst.\n\nUnter <strong>Sanierung</strong> schätzt du Gewerke ab und übernimmst die Summe in die <strong>Sanierungskosten</strong>. DealPilot prüft dabei die <strong>15 %-Grenze</strong> (§ 6 Abs. 1 Nr. 1a EStG) — gemessen netto, deshalb wählst du, ob dein Betrag brutto oder netto ist. <strong>Inventarkosten</strong> (Küche, Möbel, Geräte …) zählen nicht zur Grenze und werden separat abgeschrieben."
   },
   "tour": {
    "titel": "Tab 2: Investition",
    "text": "Hier definierst du **Kaufpreis + Nebenkosten** — die echten Anschaffungskosten."
   },
   "karten": [
    {
     "titel": "Kaufpreis & Nebenkosten",
     "felder": [
      "kp",
      "makler_p",
      "makler_e",
      "notar_p",
      "notar_e",
      "gba_p",
      "gba_e",
      "gest_p",
      "gest_e",
      "ji_p",
      "ji_e"
     ]
    },
    {
     "titel": "Sanierung Sanierungsbedarf einschätzen",
     "felder": [
      "san",
      "san_ust"
     ]
    },
    {
     "titel": "Inventar Inventar erfassen",
     "felder": [
      "moebl",
      "inv_kueche",
      "inv_moebel",
      "inv_geraete",
      "inv_pv",
      "inv_stellplatz",
      "inv_sonst"
     ]
    }
   ]
  },
  {
   "sec": "s2",
   "name": "Miete",
   "titel": "Miete",
   "desc": "Mietstruktur, Nettokaltmiete und Warmmiete",
   "hilfe": {
    "titel": "Miete — Einnahmen und Mietentwicklung",
    "text": "Unter <strong>Mietstruktur</strong> trägst du die <strong>Nettokaltmiete / Monat</strong> ein, dazu <strong>Zusätzliche Einnahmen / Monat</strong> (Stellplatz, Garage) und <strong>Umlagefähige Kosten / Monat</strong>. Warmmiete und Jahreswerte rechnet DealPilot.\n\nGanz oben recherchiert <strong>Mietpreis recherchieren</strong> die marktübliche Miete und das Mietausfall-Risiko für deine Adresse; die Werte übernimmst du per Klick. <strong>Marktmiete (€/m²)</strong> wird mit deiner Ist-Miete verglichen und geht in den Investor Deal Score.\n\n<strong>Mietentwicklung</strong> — drei Wege:\n• <strong>Prognose</strong> — eine konstante <strong>Mietsteigerung p.a.</strong>\n• <strong>Detail</strong> — einzelne Erhöhungen: Soll-Mietspiegel, Anzahl Erhöhungen, Intervall\n• <strong>Aus Wohnungen</strong> — die Miete wird aus den einzelnen Wohnungen eines MFH summiert\n\nUnter <strong>Prognose-Annahmen</strong> stehen Wertsteigerung, Kostensteigerung, Leerstand, Betrachtungszeitraum und Exit-Rendite. Bei neuen Objekten kommen Mietsteigerung, Wertsteigerung und Leerstand aus deinen Einstellungen."
   },
   "tour": {
    "titel": "Tab 3: Miete",
    "text": "Hier trägst du die **Einnahmen-Seite** ein: Nettokaltmiete und Zusatzerträge."
   },
   "karten": [
    {
     "titel": "Mietstruktur",
     "felder": [
      "nkm",
      "ze",
      "umlagef"
     ]
    },
    {
     "titel": "Mietpreis-Analyse",
     "felder": [
      "ds2_marktmiete",
      "ds2_mietausfall"
     ]
    },
    {
     "titel": "Mietvertrag",
     "felder": [
      "mv_art",
      "mv_beginn",
      "mv_letzte_erhoehung",
      "mv_letzte_erhoehung_betrag"
     ]
    },
    {
     "titel": "Mietentwicklung",
     "felder": [
      "me_soll",
      "me_anz",
      "me_int",
      "me_pct"
     ]
    }
   ]
  },
  {
   "sec": "s3",
   "name": "Finanzierung",
   "titel": "Finanzierung",
   "desc": "Darlehensstruktur, Zinsbindung, Restschuld und Anschlussfinanzierung",
   "hilfe": {
    "titel": "Finanzierung — Darlehen, Zinsbindung, Bausparvertrag",
    "text": "<strong>Darlehen I – Hauptdarlehen</strong>: Eigenkapital, <strong>Anfängl. Darlehenssumme</strong>, <strong>Zinssatz nominal</strong>, <strong>Tilgung</strong> und <strong>Zinsbindung (Jahre)</strong>. DealPilot rechnet Rate, Restschuld am Ende der Zinsbindung und das Jahr der Volltilgung. Passen Eigenkapital und Darlehen nicht zur Gesamtinvestition, gleichst du mit <strong>Eigenkapital passend setzen</strong> oder <strong>Darlehen passend setzen</strong> aus.\n\n<strong>Zinsbindung und Anschluss:</strong> Hak <strong>Eigene Anschlussfinanzierung für Darlehen 1</strong> an und rechne konservativ, etwa 5,0 % Zins und 1,0 % Tilgung. Das zeigt Zinsrisiko und Mehrkosten pro Monat. Ohne Haken läuft das Darlehen mit seiner Rate weiter.\n\n<strong>Bausparvertrag:</strong> Wähl bei „Art des Darlehens“ <strong>Tilgungsaussetzungsdarlehen (mit Bausparvertrag)</strong>. Die Tilgung wird gesperrt, und die Karte <strong>Bausparvertrag Tilgungsaussetzung</strong> erscheint: Bausparsumme, Sparrate, Mindestsparquote, Konditionen des Bauspardarlehens.\n\n<strong>Darlehen II – Zusatzdarlehen</strong> schaltest du mit <strong>Hinzufügen</strong> zu — auch als KfW-Darlehen."
   },
   "tour": {
    "titel": "Tab 4: Finanzierung",
    "text": "Hier baust du **dein Darlehen** — auch komplexe Setups mit mehreren Darlehen + BSV."
   },
   "karten": [
    {
     "titel": "Darlehen I – Hauptdarlehen",
     "felder": [
      "bank_inst",
      "d1_vertrag",
      "d1_vertragsdatum",
      "d1_type",
      "d1_auszahl",
      "ek",
      "ek_ist_nk",
      "ek_inkl_nk",
      "d1",
      "d1z",
      "d1t",
      "d1_bindj",
      "d1_anschl_enable",
      "anschl_z",
      "anschl_t",
      "anschl_bj"
     ]
    },
    {
     "titel": "Bausparvertrag Tilgungsaussetzung",
     "felder": [
      "bspar_inst",
      "bspar_vertrag",
      "bspar_vertragsdatum",
      "bspar_sum",
      "bspar_rate",
      "bspar_quote_min",
      "bspar_zins",
      "bspar_dar_z",
      "bspar_dar_t"
     ]
    },
    {
     "titel": "Darlehen II – Zusatzdarlehen",
     "felder": [
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
   ]
  },
  {
   "sec": "s4",
   "name": "Bewirtschaftung",
   "titel": "Bewirtschaftungskosten",
   "desc": "Alle laufenden Kosten – umlagefähig und nicht umlagefähig pro Jahr",
   "hilfe": {
    "titel": "Bewirtschaftung — Kosten je Objektart",
    "text": "Zwei Eingabe-Modi: <strong>Detailliert</strong> oder <strong>% der NKM</strong> als Schnellweg — die Quote überzeichnet bei hohen Mieten.\n\nIm Detail trennst du <strong>Umlagefähige Kosten / Jahr</strong> (Hausgeld umlagefähig, Grundsteuer) von <strong>Nicht umlagefähigen Kosten / Jahr</strong> (Hausgeld nicht umlagefähig, eigene Instandhaltungsrücklage, kalkulatorischer Mietausfall, Sonderverwaltung). Nur die nicht umlagefähigen mindern deinen Cashflow.\n\n<strong>Standardwerte je Objektart</strong> — sobald Objektart und Wohnfläche stehen, schlägt DealPilot drei Felder vor:\n• <strong>Eigentumswohnung</strong>: Hausgeld 4,00 €/m² im Monat, davon 30 % nicht umlagefähig; eigene Rücklage 0,50 €/m².\n• <strong>Ein-/Zweifamilienhaus</strong>: Betriebskosten 2,20 €/m², Verwaltung 230 €, Instandhaltung 9,00 €/m² im Jahr.\n• <strong>Mehrfamilienhaus</strong>: Betriebskosten 2,50 €/m², Verwaltung 230 € je Wohnung, Instandhaltung 9,00 €/m².\nVerwaltung und Instandhaltung sind Basiswerte der ImmoWertV Anlage 3, fortgeschrieben mit einem Jahresfaktor. Eigene Eingaben gehen immer vor; anpassen kannst du die Werte im „Investment-Profil“."
   },
   "tour": {
    "titel": "Tab 5: Bewirtschaftung",
    "text": "Hier definierst du **die laufenden Kosten** als Eigentümer — Hausgeld, Instandhaltung, Verwaltung."
   },
   "karten": [
    {
     "titel": "BWK – Quick-Eingabe",
     "felder": [
      "bwk_ul_pct",
      "bwk_nul_pct",
      "bwk_kp_pct"
     ]
    },
    {
     "titel": "Umlagefähige Kosten / Jahr",
     "felder": [
      "hg_ul",
      "grundsteuer",
      "ul_sonst"
     ]
    },
    {
     "titel": "Nicht umlagefähige Kosten / Jahr",
     "felder": [
      "hg_nul",
      "weg_r",
      "eigen_r",
      "mietausfall",
      "nul_sonst"
     ]
    },
    {
     "titel": "Detailpositionen (optional)",
     "felder": [
      "kp1",
      "kp1l",
      "kp2",
      "kp2l",
      "kp3",
      "kp3l",
      "kp4",
      "kp4l"
     ]
    }
   ]
  },
  {
   "sec": "s3-tax",
   "name": "Steuer",
   "titel": "Steuer-Details",
   "desc": "Vollständige Steuerlogik – AfA, Progression, jährliche Werbungskosten und Finanzamt-PDFs",
   "hilfe": {
    "titel": "Steuer — zvE, AfA und Steuerwirkung",
    "text": "Unter <strong>Persönliche Steuer</strong> trägst du das <strong>Zu versteuernde Einkommen (zvE) vor Immobilie</strong> ein. Daraus berechnet DealPilot den <strong>Persönl. Grenzsteuersatz</strong> nach § 32a EStG — du kannst ihn übersteuern, wenn du „automatisch berechnen“ abhakst.\n\n<strong>AfA-Konfiguration:</strong>\n• <strong>AfA-Satz</strong> — 2,0 % linear (Standard), 2,5 % für Baujahre vor 1925, 3,0 % für Wohnzwecke ab 2023 oder 5,0 % degressiv bei Neubauten\n• <strong>Gebäudeanteil am KP (%)</strong> — der Rest ist Grund und Boden, der nicht abgeschrieben wird. Den Anteil kannst du mit dem <strong>BMF-Rechner</strong> ermitteln.\n• <strong>Sonder-AfA § 7b EStG</strong> — wird nur angesetzt, wenn du alle Voraussetzungen bestätigst\n\nDas <strong>Steuer-Modul</strong> rechnet die Steuerwirkung als Differenz zweier Tarifberechnungen, mit und ohne dieses Objekt. Deine gespeicherten Bestandsobjekte rechnen in der Reihenfolge ihres Kaufs mit. Im <strong>Steuerformular pro Jahr</strong> trägst du echte Werbungskosten ein; Belege liest <strong>Belege &amp; Abrechnungen einlesen (KI)</strong> ein.\n\nDealPilot ist eine Rechenhilfe, keine Steuerberatung."
   },
   "tour": {
    "titel": "Tab 6: Steuer",
    "text": "Hier rechnest du **die Steuerwirkung** deines Objekts: Grenzsteuersatz, AfA und Werbungskosten — Jahr für Jahr."
   },
   "karten": [
    {
     "titel": "Persönliche Steuer",
     "felder": [
      "zve",
      "grenz",
      "grenz_auto"
     ]
    },
    {
     "titel": "AfA-Konfiguration",
     "felder": [
      "afa_satz",
      "geb_ant",
      "afa_sonder7b_aktiv",
      "afa_sonder7b_eh40",
      "afa_sonder7b_baukosten",
      "afa_sonder7b_vermietung",
      "afa_sonder7b_neubau"
     ]
    }
   ]
  }
 ],
 "felder": {
  "plz": {
   "id": "plz",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "PLZ",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 12345",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Exposé oder Kaufvertragsentwurf",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Bank-PDF (Investment Case)",
    "steht im Werbungskosten-PDF",
    "steht im PDF Kaufpreisaufteilung"
   ]
  },
  "ort": {
   "id": "ort",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Ort",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. Musterstadt",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Exposé oder Kaufvertragsentwurf",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)",
    "steht im Werbungskosten-PDF",
    "steht im PDF Kaufpreisaufteilung"
   ]
  },
  "str": {
   "id": "str",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Straße",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. Musterstraße",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Exposé oder Kaufvertragsentwurf",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)",
    "steht im Werbungskosten-PDF",
    "steht im PDF Kaufpreisaufteilung"
   ]
  },
  "hnr": {
   "id": "hnr",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Hausnummer",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 12",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé oder Kaufvertragsentwurf",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)",
    "steht im Werbungskosten-PDF",
    "steht im PDF Kaufpreisaufteilung"
   ]
  },
  "objart": {
   "id": "objart",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Objektart",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– bitte wählen –"
    },
    {
     "wert": "ETW",
     "text": "Eigentumswohnung (ETW)"
    },
    {
     "wert": "EFH",
     "text": "Einfamilienhaus (EFH)"
    },
    {
     "wert": "ZFH",
     "text": "Zweifamilienhaus (ZFH)"
    },
    {
     "wert": "MFH",
     "text": "Mehrfamilienhaus (MFH)"
    },
    {
     "wert": "DHH",
     "text": "Doppelhaushälfte (DHH)"
    },
    {
     "wert": "RH",
     "text": "Reihenhaus (RH)"
    },
    {
     "wert": "BUERO",
     "text": "Bürogebäude"
    },
    {
     "wert": "GESCH",
     "text": "Geschäftshaus"
    },
    {
     "wert": "HOTEL",
     "text": "Hotel"
    },
    {
     "wert": "GEW",
     "text": "Gewerbe-/Industriegebäude"
    },
    {
     "wert": "GAR",
     "text": "Garage / Stellplatz"
    },
    {
     "wert": "GRST",
     "text": "Unbebautes Grundstück"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)",
    "steht im Werbungskosten-PDF"
   ]
  },
  "nutzungsart": {
   "id": "nutzungsart",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Nutzungsart",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "kapitalanlage",
     "text": "Vermietet (Kapitalanlage)"
    },
    {
     "wert": "eigennutzung",
     "text": "Selbst genutzt"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "wfl": {
   "id": "wfl",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Wohnfläche (m²)",
   "typ": "zahl",
   "einheit": "m²",
   "platzhalter": "96",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Wohnfläche",
    "text": "Wohnfläche nach Wohnflächenverordnung (WoFlV). Wichtig für: Miete pro m², Bodenrichtwert-Hochrechnung, BMF-AfA-Berechnung und § 7b Sonder-AfA-Cap (max. 4.000 €/m² förderfähig).",
    "beispiel": "",
    "paragraf": "WoFlV"
   },
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Exposé, Wohnflächenberechnung oder Grundriss",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)",
    "steht im Werbungskosten-PDF"
   ]
  },
  "zimmer": {
   "id": "zimmer",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Zimmer",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 3",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé, Wohnflächenberechnung oder Grundriss",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "baujahr": {
   "id": "baujahr",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Baujahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "1997",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Exposé oder Energieausweis",
   "wirkung": [
    "zählt im Readycheck der Deal-Aktion (Bausubstanz)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "etage": {
   "id": "etage",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Etage",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 1",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé, Wohnflächenberechnung oder Grundriss",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "etagen_ges": {
   "id": "etagen_ges",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Anzahl Etagen",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 3",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé, Wohnflächenberechnung oder Grundriss",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "einheiten": {
   "id": "einheiten",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Wohneinheiten im Gebäude",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "10",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé oder Mieterliste",
   "wirkung": []
  },
  "ds2_zustand": {
   "id": "ds2_zustand",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Zustand der Wohnung",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– bitte wählen –"
    },
    {
     "wert": "neubau",
     "text": "Neubau / kernsaniert"
    },
    {
     "wert": "gut",
     "text": "Guter Zustand"
    },
    {
     "wert": "normal",
     "text": "Normaler Zustand"
    },
    {
     "wert": "renovierungsbeduerftig",
     "text": "Renovierungsbedürftig"
    },
    {
     "wert": "stark_sanierungsbeduerftig",
     "text": "Stark sanierungsbedürftig"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Zustand der Wohnung",
    "text": "Subjektive Einschätzung des Bauzustands. Beeinflusst den DealScore-Risiko-Anteil und unterstützt die Auto-AfA-Vorauswahl (Neubau ab Baujahr 2023 → degressive AfA möglich).",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": true,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Objektzustand)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "standardstufe": {
   "id": "standardstufe",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Standardstufe (NHK 2010)",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "1",
     "text": "1 · sehr einfach (nur Häuser)"
    },
    {
     "wert": "2",
     "text": "2 · einfach (nur Häuser)"
    },
    {
     "wert": "3",
     "text": "3 · Standard"
    },
    {
     "wert": "4",
     "text": "4 · gehoben"
    },
    {
     "wert": "5",
     "text": "5 · stark gehoben"
    }
   ],
   "hinweis": "",
   "titel": "Die Normalherstellungskosten 2010 staffeln die Baukosten nach fünf Standardstufen — von sehr einfach (1) bis stark gehoben (5). Die Stufe beschreibt die Ausstattungsqualität des Gebäudes, nicht seinen Zustand; der Zustand steckt im Modernisierungsgrad.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_energie": {
   "id": "ds2_energie",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Energieklasse",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "A+",
     "text": "A+"
    },
    {
     "wert": "A",
     "text": "A"
    },
    {
     "wert": "B",
     "text": "B"
    },
    {
     "wert": "C",
     "text": "C"
    },
    {
     "wert": "D",
     "text": "D"
    },
    {
     "wert": "E",
     "text": "E"
    },
    {
     "wert": "F",
     "text": "F"
    },
    {
     "wert": "G",
     "text": "G"
    },
    {
     "wert": "H",
     "text": "H"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Energieklasse",
    "text": "Die Energieklasse (A+ bis H) zeigt den Energieverbrauch des Gebäudes. Sie steht im Energieausweis und ist seit 2014 Pflichtangabe in Immobilien-Inseraten. A+ = sehr sparsam (Passivhaus), H = sehr hoher Verbrauch (unsaniert).",
    "beispiel": "Beispiel: B = Effizienzhaus 70, üblich für Neubauten ab 2016.",
    "paragraf": "GEG § 86"
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "Sie steht im Energieausweis und ist seit 2014 Pflichtangabe in Immobilien-Inseraten.",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Energieklasse)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "vermstand": {
   "id": "vermstand",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Vermietungsstand",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "Vollvermietet",
     "text": "Vollvermietet"
    },
    {
     "wert": "Teilweise leer",
     "text": "Teilweise leer"
    },
    {
     "wert": "Leer",
     "text": "Leer"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Vermietungsstand",
    "text": "Aktueller Stand: vollvermietet, teilvermietet, leerstehend oder Eigenbedarf. Banken zahlen für vollvermietete Objekte deutlich bessere Konditionen — Mieteinnahmen sind nachgewiesen.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "gsfl": {
   "id": "gsfl",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Grundstücksfläche (m²)",
   "typ": "zahl",
   "einheit": "m²",
   "platzhalter": "1570",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Grundbuchauszug oder Flurkarte",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "mea": {
   "id": "mea",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Miteigentumsanteil (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "7.06",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Miteigentumsanteil (MEA)",
    "text": "Dein Anteil am gesamten Grundstück (in % oder als Bruch wie \"75/1000\"). Steht in der Teilungserklärung und im Kaufvertrag. Multipliziert mit Grundstücksfläche ergibt das deinen Grundstücksanteil — relevant für AfA und Bodenwert.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Steht in der Teilungserklärung und im Kaufvertrag.",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "kuerzel": {
   "id": "kuerzel",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Kürzel",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. MS_MUS_12",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Objekt-Kürzel",
    "text": "Kurzes Kennzeichen zur internen Identifikation, z.B. \"MS_HAU_12\" für \"Münster Hauptstraße 12\". Wird im PDF-Header und in der Objekt-Liste angezeigt.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "steht im Investment-PDF"
   ]
  },
  "thesis": {
   "id": "thesis",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Investitionsthese",
   "typ": "text",
   "einheit": "",
   "platzhalter": "Was macht dieses Objekt besonders?",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Investitionsthese",
    "text": "Deine Begründung warum dieser Deal Sinn macht — in einem Satz. Beispiel: \"ETW unter Marktwert, Buy-and-Hold, Mietsteigerung durch lokales Bevölkerungswachstum\". Wird in der KI-Analyse mitberücksichtigt.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF"
   ]
  },
  "risiken": {
   "id": "risiken",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Bekannte Risiken",
   "typ": "text",
   "einheit": "",
   "platzhalter": "Bekannte Risiken und Maßnahmen...",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Bekannte Risiken",
    "text": "Risiken die dir bewusst sind — z.B. Sanierungsstau am Dach, anstehende GEG-Pflicht für Heizungstausch, Mieterwechsel geplant. Hilft dir bei späteren Verhandlungen ehrlich zu bleiben und fließt in die KI-Risikoanalyse.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "exitstr": {
   "id": "exitstr",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Exitstrategie",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "Langfristig halten",
     "text": "Langfristig halten"
    },
    {
     "wert": "Verkauf nach 10 Jahren",
     "text": "Verkauf nach 10 Jahren"
    },
    {
     "wert": "Verkauf nach 20 Jahren",
     "text": "Verkauf nach 20 Jahren"
    },
    {
     "wert": "Aufwertung & Verkauf",
     "text": "Aufwertung & Verkauf"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Exitstrategie",
    "text": "Wie lange willst du das Objekt halten? \"Langfristig halten\" = klassischer Buy-and-Hold. \"10 Jahre Spekulationsfrist\" = Verkauf steuerfrei nach 10 Jahren (§ 23 EStG). \"Kurzfristig flippen\" = nicht steuerfrei und ggf. gewerblich.",
    "beispiel": "",
    "paragraf": "§ 23 EStG"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "kaufdat": {
   "id": "kaufdat",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Kaufdatum",
   "typ": "datum",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "wirtschaftlicher_uebergang": {
   "id": "wirtschaftlicher_uebergang",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Wirtsch. Übergang · Nutzen-/Lastenwechsel",
   "typ": "datum",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": true,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "halter": {
   "id": "halter",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Halter / Mandant · wer hält das Objekt",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "mand_ueberf_cb": {
   "id": "mand_ueberf_cb",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Dieses Objekt wurde aus dem Privatbestand überführt",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "verkehrswert_ueberf": {
   "id": "verkehrswert_ueberf",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Verkehrswert (AfA-Basis Gesellschaft)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 450000",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "ueberf_preis": {
   "id": "ueberf_preis",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Überführungspreis (GrESt-Basis)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 340000",
   "optionen": null,
   "hinweis": "—",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "halter_seit": {
   "id": "halter_seit",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Stichtag Überführung (Cut: Privat → Gesellschaft)",
   "typ": "datum",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "gesellschafterdarlehen": {
   "id": "gesellschafterdarlehen",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Gesellschafterdarlehen (gestundeter Kaufpreis)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "ueberf_restschuld": {
   "id": "ueberf_restschuld",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Übernommene Restschuld (Darlehen geht mit in die Gesellschaft)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "—",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "ueberf_rest_zins": {
   "id": "ueberf_rest_zins",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Zins übernommenes Darlehen % p.a. (falls neu verhandelt)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 3,8",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "ueberf_ende": {
   "id": "ueberf_ende",
   "reiter": "s0",
   "karte": "Objektdaten",
   "label": "Privat-Ende / überführt am (Cut: Privat-Objekt rechnet bis hier, dann eingefroren)",
   "typ": "datum",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "brw": {
   "id": "brw",
   "reiter": "s0",
   "karte": "Automatisch ermittelt",
   "label": "Bodenrichtwert (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "150",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Bodenrichtwert",
    "text": "Durchschnittspreis pro m² Bauland in deiner Lage. Wird von Gutachterausschüssen festgelegt und ist die Basis für die Aufteilung Boden-/Gebäudeanteil. Du findest aktuelle Werte im BORIS-Portal des jeweiligen Bundeslands.",
    "beispiel": "Beispiel: München-Schwabing: 8.000 €/m². Münster-Geist: 420 €/m².",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Bodenrichtwertkarte (amtlich)",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "brw_stichtag": {
   "id": "brw_stichtag",
   "reiter": "s0",
   "karte": "Automatisch ermittelt",
   "label": "Stichtag Bodenrichtwert",
   "typ": "text",
   "einheit": "",
   "platzhalter": "2024-01-01",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ausst": {
   "id": "ausst",
   "reiter": "s0",
   "karte": "Automatisch ermittelt",
   "label": "Ausstattung (Altfeld, ersetzt durch die Standardstufe)",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "Einfach",
     "text": "Einfach"
    },
    {
     "wert": "Normal",
     "text": "Normal"
    },
    {
     "wert": "Gehoben",
     "text": "Gehoben"
    },
    {
     "wert": "Luxus",
     "text": "Luxus"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "eq_walls": {
   "id": "eq_walls",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Außenwände · Art",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "AUSSENWAENDE_GEDAEMMT",
     "text": "Gedämmt"
    },
    {
     "wert": "AUSSENWAENDE_NICHT_GEDAEMMT",
     "text": "Nicht gedämmt"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "mod_aussenwand": {
   "id": "mod_aussenwand",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Außenwände · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_aussenwaende": {
   "id": "ausst_aussenwaende",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Außenwände · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "eq_roof": {
   "id": "eq_roof",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Dach · Art",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "DACHPFANNEN",
     "text": "Dachpfannen"
    },
    {
     "wert": "SCHIEFER",
     "text": "Schiefer"
    },
    {
     "wert": "METALL",
     "text": "Metall"
    },
    {
     "wert": "DACHPAPPE",
     "text": "Dachpappe"
    },
    {
     "wert": "SONSTIGE",
     "text": "Sonstige"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "mod_dach": {
   "id": "mod_dach",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Dach · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_dach": {
   "id": "ausst_dach",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Dach · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "eq_windows": {
   "id": "eq_windows",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Fenster / Außentüren · Art",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "EINFACH",
     "text": "Einfachverglasung"
    },
    {
     "wert": "ISOLIERVERGLASUNG",
     "text": "Isolierverglasung"
    },
    {
     "wert": "ZWEIFACHVERGLASUNG",
     "text": "Zweifachverglasung"
    },
    {
     "wert": "DREIFACHVERGLASUNG",
     "text": "Dreifachverglasung"
    },
    {
     "wert": "SPEZIALVERGLASUNG",
     "text": "Spezialverglasung"
    },
    {
     "wert": "RAUMHOHE_VERGLASUNG",
     "text": "Raumhohe Verglasung"
    },
    {
     "wert": "KASTENFENSTER",
     "text": "Kastenfenster"
    },
    {
     "wert": "SONSTIGE",
     "text": "Sonstige"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "mod_fenster": {
   "id": "mod_fenster",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Fenster / Außentüren · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_fenster": {
   "id": "ausst_fenster",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Fenster / Außentüren · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "eq_heating": {
   "id": "eq_heating",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Heizung · Art",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "FUSSBODENHEIZUNG",
     "text": "Fußbodenheizung"
    },
    {
     "wert": "ZENTRALHEIZUNG",
     "text": "Zentralheizung"
    },
    {
     "wert": "EINZELOEFEN",
     "text": "Einzelöfen"
    },
    {
     "wert": "SONSTIGE",
     "text": "Sonstige"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "mod_heizung": {
   "id": "mod_heizung",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Heizung · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_heizung": {
   "id": "ausst_heizung",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Heizung · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "eq_bath": {
   "id": "eq_bath",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Bad / Sanitär · Art",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "EIN_BAD",
     "text": "Ein Bad"
    },
    {
     "wert": "INNENLIEGEND",
     "text": "Innenliegend, ohne Fenster"
    },
    {
     "wert": "MIT_FENSTER",
     "text": "Mit Fenster"
    },
    {
     "wert": "MEHR_ALS_EIN_BAD",
     "text": "Mehr als ein Bad"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "mod_baeder": {
   "id": "mod_baeder",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Bad / Sanitär · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_sanitaer": {
   "id": "ausst_sanitaer",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Bad / Sanitär · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "eq_floor": {
   "id": "eq_floor",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Fußböden · Art",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "PARKETT_NATURSTEIN",
     "text": "Parkett / Naturstein"
    },
    {
     "wert": "FLIESEN",
     "text": "Fliesen"
    },
    {
     "wert": "TEPPICH_LAMINAT",
     "text": "Teppich / Laminat"
    },
    {
     "wert": "KUNSTSTOFF_PVC",
     "text": "Kunststoff / PVC"
    },
    {
     "wert": "SONSTIGE",
     "text": "Sonstige"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "ausst_fussboeden": {
   "id": "ausst_fussboeden",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Fußböden · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "mod_innenausbau": {
   "id": "mod_innenausbau",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Innenwände · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_innenwaende": {
   "id": "ausst_innenwaende",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Innenwände · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "ausst_decken": {
   "id": "ausst_decken",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Decken / Treppen · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "mod_leitungen": {
   "id": "mod_leitungen",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Technik / Leitungen · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "ausst_technik": {
   "id": "ausst_technik",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Technik / Leitungen · Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "–"
    },
    {
     "wert": "1",
     "text": "1"
    },
    {
     "wert": "1.5",
     "text": "1,5"
    },
    {
     "wert": "2",
     "text": "2"
    },
    {
     "wert": "2.5",
     "text": "2,5"
    },
    {
     "wert": "3",
     "text": "3"
    },
    {
     "wert": "3.5",
     "text": "3,5"
    },
    {
     "wert": "4",
     "text": "4"
    },
    {
     "wert": "4.5",
     "text": "4,5"
    },
    {
     "wert": "5",
     "text": "5"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score"
   ]
  },
  "mod_grundriss": {
   "id": "mod_grundriss",
   "reiter": "s0",
   "karte": "Gewerke & Ausstattung",
   "label": "Grundriss (Anlage 2) · modernisiert",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Keine/Nie",
     "text": "Keine/Nie"
    },
    {
     "wert": "> 20 Jahre",
     "text": "> 20 Jahre"
    },
    {
     "wert": "10 - 20 Jahre",
     "text": "10 - 20 Jahre"
    },
    {
     "wert": "5 - 10 Jahre",
     "text": "5 - 10 Jahre"
    },
    {
     "wert": "< 5 Jahre",
     "text": "< 5 Jahre"
    },
    {
     "wert": "Kernsanierung",
     "text": "Kernsanierung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)"
   ]
  },
  "eq_elevator": {
   "id": "eq_elevator",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Aufzug",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "Ja",
     "text": "Ja"
    },
    {
     "wert": "Nein",
     "text": "Nein"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Aufzug",
    "text": "Aufzug im Gebäude vorhanden? Werterhöhend besonders in oberen Etagen — geht in die Marktbewertung ein.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "eq_guest_wc": {
   "id": "eq_guest_wc",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Gäste-WC",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "GAESTE_WC",
     "text": "Ja"
    },
    {
     "wert": "KEIN_GAESTE_WC",
     "text": "Nein"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Gäste-WC",
    "text": "Separates Gäste-WC vorhanden? Werterhöhendes Ausstattungsmerkmal in der Marktbewertung.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "eq_store_room": {
   "id": "eq_store_room",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Keller / Abstellraum",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "INNERHALB",
     "text": "Innerhalb"
    },
    {
     "wert": "AUSSERHALB",
     "text": "Außerhalb"
    },
    {
     "wert": "INNERHALB_UND_AUSSERHALB",
     "text": "Innen & außen"
    },
    {
     "wert": "KEINER",
     "text": "Keiner"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Keller / Abstellraum",
    "text": "Lage des Abstellraums. Relevant für die Ausstattungsbewertung in der Marktbewertung.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)"
   ]
  },
  "bad_anz": {
   "id": "bad_anz",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Badezimmer",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 1",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé, Wohnflächenberechnung oder Grundriss",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "balkon_flae": {
   "id": "balkon_flae",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Balkon / Terrasse (m²)",
   "typ": "zahl",
   "einheit": "m²",
   "platzhalter": "z.B. 10",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "garagen": {
   "id": "garagen",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Garagenplätze",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 1",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "stellpl_aussen": {
   "id": "stellpl_aussen",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Außenstellplätze",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "modernis": {
   "id": "modernis",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Modernisierungsjahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 2025",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "baustatus": {
   "id": "baustatus",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Baustatus",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "bestand",
     "text": "Bestand"
    },
    {
     "wert": "bestand_erstbezug_saniert",
     "text": "Bestand – Erstbezug nach Sanierung"
    },
    {
     "wert": "neubau_erstbezug",
     "text": "Neubau – Erstbezug"
    },
    {
     "wert": "neubau_im_bau",
     "text": "Neubau – im Bau"
    },
    {
     "wert": "geplant",
     "text": "Geplant / Bauträger"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "gemarkung": {
   "id": "gemarkung",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Gemarkung",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. Hüllhorst",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "flur": {
   "id": "flur",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Flur",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 3",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "flurstueck": {
   "id": "flurstueck",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Flurstück",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 45",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "hinterland_qm": {
   "id": "hinterland_qm",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Zusätzliche Fläche / Hinterland (m²)",
   "typ": "zahl",
   "einheit": "m²",
   "platzhalter": "nur die Fläche AUSSERHALB des Baulands",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "hinterland_eur_qm": {
   "id": "hinterland_eur_qm",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Wertansatz Hinterland (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z. B. 5 €/m²",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "hinterland_rentierlich": {
   "id": "hinterland_rentierlich",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Zusatzfläche ist rentierlich",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "nein · wirft keinen Ertrag ab (Standard)"
    },
    {
     "wert": "ja",
     "text": "ja · wird vermietet oder verpachtet"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "erbpacht": {
   "id": "erbpacht",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Erbbaurecht / Erbpacht",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Das Grundstück gehört nicht mit — es wird gegen Erbbauzins überlassen.",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "erbbauzins": {
   "id": "erbbauzins",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Erbbauzins (€ pro Jahr)",
   "typ": "zahl",
   "einheit": "J",
   "platzhalter": "1.800",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "erb_restlz": {
   "id": "erb_restlz",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Restlaufzeit (Jahre)",
   "typ": "zahl",
   "einheit": "J",
   "platzhalter": "55",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "erb_zs_ang": {
   "id": "erb_zs_ang",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Angemessener Erbbauzinssatz (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "3,5",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "erb_entsch": {
   "id": "erb_entsch",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Entschädigung bei Zeitablauf (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "66,7",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "erb_wert_ist_erb": {
   "id": "erb_wert_ist_erb",
   "reiter": "s0",
   "karte": "Bauteile & Grundstück",
   "label": "Verkehrswert / Bankbewertung ist bereits der Erbbaurechtswert (dann nicht noch einmal kürzen)",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "lageklasse": {
   "id": "lageklasse",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Lageklasse",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "- keine Angabe -"
    },
    {
     "wert": "A",
     "text": "A-Lage"
    },
    {
     "wert": "B",
     "text": "B-Lage"
    },
    {
     "wert": "C",
     "text": "C-Lage"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Bestimmt deine Zielrendite aus den Einstellungen. Daraus rechnet DealPilot, auf welchen Kaufpreis du verhandeln müsstest.",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "makrolage": {
   "id": "makrolage",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Makrolage",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "sehr_schwach",
     "text": "Sehr schwach"
    },
    {
     "wert": "schwach",
     "text": "Schwach"
    },
    {
     "wert": "durchschnittlich",
     "text": "Durchschnittlich"
    },
    {
     "wert": "gut",
     "text": "Gut"
    },
    {
     "wert": "sehr_gut",
     "text": "Sehr gut"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Makrolage)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "mikrolage": {
   "id": "mikrolage",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Mikrolage",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "sehr_schwach",
     "text": "Sehr schwach"
    },
    {
     "wert": "schwach",
     "text": "Schwach"
    },
    {
     "wert": "durchschnittlich",
     "text": "Durchschnittlich"
    },
    {
     "wert": "gut",
     "text": "Gut"
    },
    {
     "wert": "sehr_gut",
     "text": "Sehr gut"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Mikrolage)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_bevoelkerung": {
   "id": "ds2_bevoelkerung",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Bevölkerungsentwicklung",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "stark_wachsend",
     "text": "Stark wachsend"
    },
    {
     "wert": "wachsend",
     "text": "Wachsend"
    },
    {
     "wert": "stabil",
     "text": "Stabil"
    },
    {
     "wert": "leicht_fallend",
     "text": "Leicht fallend"
    },
    {
     "wert": "stark_fallend",
     "text": "Stark fallend"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Bevölkerung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_nachfrage": {
   "id": "ds2_nachfrage",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Nachfrage Vermarktungsdauer",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "sehr_stark",
     "text": "Sehr stark (bis 30 Tage)"
    },
    {
     "wert": "stark",
     "text": "Stark (bis 60 Tage)"
    },
    {
     "wert": "mittel",
     "text": "Mittel (bis 120 Tage)"
    },
    {
     "wert": "schwach",
     "text": "Schwach (bis 200 Tage)"
    },
    {
     "wert": "sehr_schwach",
     "text": "Sehr schwach (über 200 Tage)"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Nachfrage)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_wertsteigerung": {
   "id": "ds2_wertsteigerung",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Wertsteigerungs-Potenzial",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "sehr_hoch",
     "text": "Sehr hoch"
    },
    {
     "wert": "hoch",
     "text": "Hoch"
    },
    {
     "wert": "mittel",
     "text": "Mittel"
    },
    {
     "wert": "niedrig",
     "text": "Niedrig"
    },
    {
     "wert": "keines",
     "text": "Keines"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Wertsteigerung p.a.",
    "text": "Erwartete jährliche Wertsteigerung der Immobilie. Stabile A-Lagen: 1-2%, Wachstumsregionen: 2-4%, Spekulationsmarkt: 4%+. Über lange Sicht meist Inflation + 0,5-1,5%.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Wertsteigerung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_entwicklung": {
   "id": "ds2_entwicklung",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Entwicklungsmöglichkeiten",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "mehrere",
     "text": "Mehrere klare Möglichkeiten"
    },
    {
     "wert": "eine_starke",
     "text": "Eine starke Möglichkeit"
    },
    {
     "wert": "begrenzt",
     "text": "Begrenzt"
    },
    {
     "wert": "kaum",
     "text": "Kaum"
    },
    {
     "wert": "keine",
     "text": "Keine"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Entwicklungsmöglichkeiten)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "bankval": {
   "id": "bankval",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Bankbewertung",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "234000",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Bankbewertung",
    "text": "Beleihungswert nach BelWertV (Beleihungswertermittlungsverordnung). Banken setzen typisch 80-90% des Verkehrswerts an — der dann als Sicherheit dient. Wenn unbekannt: Verkehrswert nutzen.",
    "beispiel": "",
    "paragraf": "BelWertV"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF"
   ]
  },
  "svwert": {
   "id": "svwert",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Verkehrswert (§ 194 BauGB · Sachwert/Ertragswert/Vergleichswert)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "237000",
   "optionen": null,
   "hinweis": "(§ 194 BauGB · Sachwert/Ertragswert/Vergleichswert)",
   "titel": "Verkehrswert nach § 194 BauGB / ImmoWertV — durch Sachwert-, Ertragswert- oder Vergleichswertverfahren ermittelt",
   "tip": {
    "titel": "Verkehrswert (§ 194 BauGB)",
    "text": "Der \"objektive\" Marktwert nach Sachverständigen-Gutachten — meist via Sachwertverfahren, Ertragswertverfahren oder Vergleichswertverfahren. Wenn höher als Kaufpreis → Wertpuffer und besseres Verhandlungsargument bei der Bank.",
    "beispiel": "",
    "paragraf": "§ 194 BauGB"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF"
   ]
  },
  "wert_soll": {
   "id": "wert_soll",
   "reiter": "s0",
   "karte": "Lage & Einschätzung",
   "label": "Wert nach Sanierung (optional · stabilisiert)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z.B. 1.250.000",
   "optionen": null,
   "hinweis": "(optional · stabilisiert)",
   "titel": "Erwarteter Wert nach Abschluss der Sanierung/Modernisierung (stabilisierter Zustand). Banken rechnen Sanierungsfinanzierungen gegen diesen Wert (as-completed).",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "notizen": {
   "id": "notizen",
   "reiter": "s0",
   "karte": "Sonstige Bemerkungen",
   "label": "Zusätzliche Notizen",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. Makler sagt: Verwalterwechsel geplant · Besichtigung 12.09. · Keller feucht?",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Zusätzliche Notizen",
    "text": "Alles, was kein Argument (Investitionsthese) und kein Risiko ist: Absprachen mit dem Makler, Besichtigungstermine, Nachfragen an die Verwaltung, Zustand einzelner Räume. Zwei Besonderheiten: der Exposé- und ImmoMetrica-Import hängt seine Objektbeschreibung hier an, statt sie zu überschreiben — deine eigenen Notizen bleiben also stehen. Und arbeitest du mit einem Berater über das Partner-Portal, sieht er diesen Text in seiner Mandanten-Ansicht.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Zwei Besonderheiten: der Exposé- und ImmoMetrica-Import hängt seine Objektbeschreibung hier an, statt sie zu überschreiben — deine eigenen Notizen bleiben also stehen.",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "zb_fertig_jahr": {
   "id": "zb_fertig_jahr",
   "reiter": "s0",
   "karte": "Mieterhöhung und Zielbild",
   "label": "Zielbild fertig (Jahr)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z. B. 2028",
   "optionen": null,
   "hinweis": "",
   "titel": "In welchem Jahr ist das Zielbild erreicht (Umbau fertig, neu vermietet)? Leer: in Pilot-Analyse und PDF steht das Jahr als offen.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "zb_vgl_qm": {
   "id": "zb_vgl_qm",
   "reiter": "s0",
   "karte": "Mieterhöhung und Zielbild",
   "label": "Vergleichsmiete (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "aus Tab Miete",
   "optionen": null,
   "hinweis": "",
   "titel": "Die ortsübliche Vergleichsmiete (Mietspiegel, § 558 BGB). Leer: DealPilot nimmt die Marktmiete aus dem Tab Miete.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "zb_soll_qm": {
   "id": "zb_soll_qm",
   "reiter": "s0",
   "karte": "Mieterhöhung und Zielbild",
   "label": "Soll-Miete (Mieter bleibt, €/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "leer = gerechnet",
   "optionen": null,
   "hinweis": "",
   "titel": "Eigene Angabe. Leer: DealPilot rechnet vor — bis zur Vergleichsmiete, höchstens Kappungsgrenze, frühestens 15 Monate nach der letzten Erhöhung.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "zb_soll_ab": {
   "id": "zb_soll_ab",
   "reiter": "s0",
   "karte": "Mieterhöhung und Zielbild",
   "label": "Soll erreichbar ab",
   "typ": "text",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "Leer: 15 Monate nach der letzten Erhöhung (Tab Miete, Mietvertrag).",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "zb_ziel_qm": {
   "id": "zb_ziel_qm",
   "reiter": "s0",
   "karte": "Mieterhöhung und Zielbild",
   "label": "Zielmiete (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z. B. 9,20",
   "optionen": null,
   "hinweis": "",
   "titel": "Was nach Umbau oder Neuvermietung erzielbar ist.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "zb_ziel_wann": {
   "id": "zb_ziel_wann",
   "reiter": "s0",
   "karte": "Mieterhöhung und Zielbild",
   "label": "Zielbild ab wann",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z. B. bei Mieterwechsel, nach Sanierung 2027",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "bgf": {
   "id": "bgf",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Bruttogrundfläche (m²)",
   "typ": "zahl",
   "einheit": "m²",
   "platzhalter": "nur für den Sachwert bei Häusern",
   "optionen": null,
   "hinweis": "",
   "titel": "Bruttogrundfläche nach DIN 277: alle Grundflächen aller Grundrissebenen, außen gemessen. NICHT die Wohnfläche — die BGF ist regelmäßig deutlich größer und ist die Bezugsgröße der NHK.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "grundriss": {
   "id": "grundriss",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Grundrissart",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "einspaenner",
     "text": "Einspänner · 1 Wohnung je Treppenhaus (× 1,05)"
    },
    {
     "wert": "zweispaenner",
     "text": "Zweispänner · 2 Wohnungen (× 1,00)"
    },
    {
     "wert": "dreispaenner",
     "text": "Dreispänner · 3 Wohnungen (× 0,97)"
    },
    {
     "wert": "vierspaenner",
     "text": "Vierspänner · 4 Wohnungen (× 0,95)"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "mod_punkte": {
   "id": "mod_punkte",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Modernisierungsgrad (Anlage 2)",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe, wird geschätzt —"
    },
    {
     "wert": "0",
     "text": "nicht modernisiert"
    },
    {
     "wert": "4",
     "text": "kleine Modernisierungen im Rahmen der Instandhaltung"
    },
    {
     "wert": "8",
     "text": "mittlerer Modernisierungsgrad"
    },
    {
     "wert": "14",
     "text": "überwiegend modernisiert"
    },
    {
     "wert": "19",
     "text": "umfassend modernisiert"
    }
   ],
   "hinweis": "",
   "titel": "Punktesystem der Anlage 2: durchgeführte Modernisierungen (Dach, Fenster, Heizung, Bäder, Leitungen ...) ergeben Punkte, aus denen sich die verlängerte Restnutzungsdauer ableitet. Es beschreibt den Zustand — die Standardstufe daneben die Ausstattungsqualität.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "sachwertfaktor": {
   "id": "sachwertfaktor",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Sachwertfaktor",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "leer = aus der Parametertabelle",
   "optionen": null,
   "hinweis": "",
   "titel": "Marktanpassungsfaktor nach Paragraf 21 Abs. 3 ImmoWertV: er führt den vorläufigen Sachwert zum marktangepassten Sachwert. Er kommt vom örtlichen Gutachterausschuss und ist keine Schätzung — ohne Faktor bleibt der Sachwert vorläufig.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "uk_flaeche": {
   "id": "uk_flaeche",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Umrechnungskoeffizient Grundstücksgröße",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "leer = Wert des Ausschusses",
   "optionen": null,
   "hinweis": "",
   "titel": "Umrechnungskoeffizient nach Paragraf 19 ImmoWertV: passt den Bodenrichtwert an die Größe des Grundstücks an. Er kommt vom örtlichen Gutachterausschuss (Grundstücksmarktbericht oder BORIS-Anhang). Leer lassen, wenn DealPilot ihn aus dem Register holt — eintragen nur, wenn keiner hinterlegt ist.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "wgfz_objekt": {
   "id": "wgfz_objekt",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "WGFZ des Objekts",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z. B. 1,2 — oberirdische Geschossfläche / Grundstück",
   "optionen": null,
   "hinweis": "",
   "titel": "Wertrelevante Geschossflächenzahl nach Paragraf 16 Abs. 4 ImmoWertV: Fläche aller oberirdischen Geschosse (Außenmaße, ausgebautes oder ausbaufähiges Dachgeschoss zu 75 Prozent, ohne Keller) geteilt durch die Grundstücksfläche. Weicht sie von der WGFZ der Bodenrichtwertzone ab, rechnet DealPilot den Bodenrichtwert mit den Umrechnungskoeffizienten des Gutachterausschusses um — vor allem bei Mehrfamilienhäusern.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "stellplatz_miete_monat": {
   "id": "stellplatz_miete_monat",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Stellplatzmiete (€/Monat)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "je Stellplatz",
   "optionen": null,
   "hinweis": "",
   "titel": "Nur die Stellplatz- und Garagenmiete. Die Nettokaltmiete der Wohnung steht im Tab Miete und wird von dort übernommen — sie fehlt hier nicht, sie steht nur nicht zweimal. Die Bewirtschaftungskosten-Quoten rechnen auf dem GESAMTEN Rohertrag, also einschliesslich dieser Stellplätze.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "sonstige_jahr": {
   "id": "sonstige_jahr",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Sonstige Einnahmen (€/Jahr)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "Werbefläche, Antennenanlage …",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "nhk_haus": {
   "id": "nhk_haus",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Hausform",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "1",
     "text": "freistehendes Ein-/Zweifamilienhaus"
    },
    {
     "wert": "2",
     "text": "Doppelhaus / Reihenendhaus"
    },
    {
     "wert": "3",
     "text": "Reihenmittelhaus"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "nhk_geschosse": {
   "id": "nhk_geschosse",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Geschosse und Unterkellerung",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "0",
     "text": "Keller- und Erdgeschoss"
    },
    {
     "wert": "1",
     "text": "Keller-, Erd- und Obergeschoss"
    },
    {
     "wert": "2",
     "text": "Erdgeschoss, nicht unterkellert"
    },
    {
     "wert": "3",
     "text": "Erd- und Obergeschoss, nicht unterkellert"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "nhk_dach": {
   "id": "nhk_dach",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Dachausbildung",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "1",
     "text": "Dachgeschoss voll ausgebaut"
    },
    {
     "wert": "2",
     "text": "Dachgeschoss nicht ausgebaut"
    },
    {
     "wert": "3",
     "text": "Flachdach oder flach geneigtes Dach"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "garagen_bgf_qm": {
   "id": "garagen_bgf_qm",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Garage / Carport – Bruttogrundfläche (m²)",
   "typ": "zahl",
   "einheit": "m²",
   "platzhalter": "Länge × Breite, alle zusammen",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "garagen_stufe": {
   "id": "garagen_stufe",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Garage – Standardstufe",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "— keine Angabe —"
    },
    {
     "wert": "3",
     "text": "3 · Fertiggarage"
    },
    {
     "wert": "4",
     "text": "4 · Massivbauweise"
    },
    {
     "wert": "5",
     "text": "5 · Massiv mit besonderer Ausführung"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "aussenanlagen_pct": {
   "id": "aussenanlagen_pct",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Außenanlagen (% des Gebäudesachwerts)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "z. B. 5 bis 7 – alternativ Betrag",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "aussenanlagen": {
   "id": "aussenanlagen",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Außenanlagen (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "Wege, Einfriedung, Ver- und Entsorgung",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "bes_bauteile": {
   "id": "bes_bauteile",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Besondere Bauteile (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "z. B. Aufzug",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "btl_gauben": {
   "id": "btl_gauben",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Dachgauben (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "btl_balkone": {
   "id": "btl_balkone",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Balkone (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "btl_vordach": {
   "id": "btl_vordach",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Vordächer / Eingangsvorbau (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "btl_terrassen": {
   "id": "btl_terrassen",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Terrassen (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "btl_sonstige": {
   "id": "btl_sonstige",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Weitere Bauteile (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "lzs_pct": {
   "id": "lzs_pct",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Liegenschaftszinssatz (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "leer = amtlicher bzw. gesetzlicher Wert",
   "optionen": null,
   "hinweis": "",
   "titel": "Der Zinssatz, mit dem der Verkehrswert von Grundstücken im Durchschnitt marktüblich verzinst wird (Paragraf 21 Abs. 2 ImmoWertV). Er kommt vom örtlichen Gutachterausschuss und steuert den Ertragswert stark — schon ein halber Punkt verschiebt ihn spürbar.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "brw_manuell": {
   "id": "brw_manuell",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Bodenrichtwert manuell (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "leer = amtlicher Abruf",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "brw_anpassung_pct": {
   "id": "brw_anpassung_pct",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Bodenwert-Anpassung (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "z. B. -10 für Lärmbelastung",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "brw_anpassung_grund": {
   "id": "brw_anpassung_grund",
   "reiter": "s0",
   "karte": "Sach- und Ertragswert · Stufe 3",
   "label": "Begründung der Anpassung",
   "typ": "text",
   "einheit": "",
   "platzhalter": "Pflicht, sobald eine Anpassung eingetragen ist",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "kp": {
   "id": "kp",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Kaufpreis",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "180000",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Kaufpreis",
    "text": "Notarieller Kaufpreis ohne Erwerbsnebenkosten. Aufgeteilt in Grundstücksanteil (kein AfA möglich) und Gebäudeanteil (AfA-fähig). Bei Wohneigentum: oft 80/20 Gebäude/Boden, exakte Werte über BMF-Rechner oder Gutachten.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Exposé oder Kaufvertragsentwurf",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)",
    "steht im PDF Kaufpreisaufteilung"
   ]
  },
  "makler_p": {
   "id": "makler_p",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Makler (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Maklerprovision",
    "text": "Übliche Höhe in Deutschland: 3,57% inkl. USt für den Käufer (Bestellerprinzip seit 2020 oft 50/50 zwischen Käufer und Verkäufer). 0 bei Privatkauf. Maklerkosten sind Anschaffungsnebenkosten — sie erhöhen die Gebäude-AfA-Basis nicht direkt, sondern nur anteilig.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Exposé (Käuferprovision)",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF"
   ]
  },
  "makler_e": {
   "id": "makler_e",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Makler (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "notar_p": {
   "id": "notar_p",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Notar (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Notarkosten",
    "text": "Notar- und Grundbuchgebühren nach GNotKG-Tabelle. Üblich: 1,5-2,0% des Kaufpreises. Wird teilweise zwischen Käufer und Verkäufer aufgeteilt — meist trägt der Käufer die Kosten für die Auflassungsvormerkung und Eigentumsumschreibung.",
    "beispiel": "",
    "paragraf": "GNotKG"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF"
   ]
  },
  "notar_e": {
   "id": "notar_e",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Notar (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "gba_p": {
   "id": "gba_p",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Grundbuchamt (%) · Vorbelegung 0,5 %",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "0,5",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Grundbuchamt",
    "text": "Eintragungsgebühren beim Grundbuchamt — typisch 0,5-1,0% des Kaufpreises. Inkludiert: Auflassungsvormerkung, Eigentumsumschreibung, Eintragung der Grundschuld (falls Finanzierung).",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Eintragungsgebühren beim Grundbuchamt — typisch 0,5-1,0% des Kaufpreises.",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF"
   ]
  },
  "gba_e": {
   "id": "gba_e",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Grundbuchamt (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "gest_p": {
   "id": "gest_p",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Grunderwerbsteuer (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Grunderwerbsteuer",
    "text": "Bundesland-spezifisch zwischen 3,5% (Bayern, Sachsen) und 6,5% (NRW, Schleswig-Holstein, Saarland, Brandenburg). DealPilot ermittelt den Satz automatisch aus der PLZ — manuelles Übersteuern bleibt möglich.",
    "beispiel": "",
    "paragraf": "GrEStG"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "gest_e": {
   "id": "gest_e",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Grunderwerbsteuer (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "ji_p": {
   "id": "ji_p",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Sonstige (%) · Bausachverständiger, Anfahrt, Gutachten",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "Bausachverständiger, Anfahrt, Gutachten, Behördengebühren",
   "tip": {
    "titel": "Sonstige Kaufnebenkosten",
    "text": "Alles, was neben Notar, Grunderwerbsteuer, Grundbuchamt und Makler anfällt: Bausachverständiger für die Kaufprüfung, Anfahrten zu Besichtigungen, Behördengebühren, Kopien aus der Teilungserklärung. Der Vorschlag von 1,5 % ist eine Faustzahl — wer seine echten Positionen kennt, trägt sie ein.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Alles, was neben Notar, Grunderwerbsteuer, Grundbuchamt und Makler anfällt: Bausachverständiger für die Kaufprüfung, Anfahrten zu Besichtigungen, Behördengebühren, Kopien aus der Teilungserklärung.",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF"
   ]
  },
  "ji_e": {
   "id": "ji_e",
   "reiter": "s1",
   "karte": "Kaufpreis & Nebenkosten",
   "label": "Sonstige (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "san": {
   "id": "san",
   "reiter": "s1",
   "karte": "Sanierung Sanierungsbedarf einschätzen",
   "label": "Sanierungskosten",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Grenze wird berechnet...",
   "titel": "",
   "tip": {
    "titel": "Sanierungs-Steueroption",
    "text": "Wie sollen Sanierungskosten steuerlich verteilt werden? \"Automatisch (15%-Regel)\": bei Beträgen unter 15% Gebäudeanteil als Erhaltungsaufwand sofort absetzbar, sonst über AfA-Periode. Manuell: feste Jahre wählen (§ 82b EStDV erlaubt Verteilung auf 2-5 Jahre).",
    "beispiel": "",
    "paragraf": "§ 82b EStDV"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "san_ust": {
   "id": "san_ust",
   "reiter": "s1",
   "karte": "Sanierung Sanierungsbedarf einschätzen",
   "label": "Angegebener Betrag — für die 15 %-Grenze",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "brutto",
     "text": "brutto (inkl. 19 % USt)"
    },
    {
     "wert": "netto",
     "text": "netto (ohne USt)"
    }
   ],
   "hinweis": "— für die 15 %-Grenze",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "moebl": {
   "id": "moebl",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "Inventarkosten",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0,00",
   "optionen": null,
   "hinweis": "Beweglich, NICHT in der 15-%-Grenze. Separat über die Inventar-Nutzungsdauer abgeschrieben.",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "inv_kueche": {
   "id": "inv_kueche",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "Küche",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "inv_moebel": {
   "id": "inv_moebel",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "Möbel",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "inv_geraete": {
   "id": "inv_geraete",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "Geräte",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "inv_pv": {
   "id": "inv_pv",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "PV-Anlage",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "inv_stellplatz": {
   "id": "inv_stellplatz",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "Stellplatz",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "inv_sonst": {
   "id": "inv_sonst",
   "reiter": "s1",
   "karte": "Inventar Inventar erfassen",
   "label": "Sonstiges",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "nkm": {
   "id": "nkm",
   "reiter": "s2",
   "karte": "Mietstruktur",
   "label": "Nettokaltmiete / Monat",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "850",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Nettokaltmiete",
    "text": "Reine Miete für die Wohnung ohne Nebenkosten — Zins, Tilgung und Werbungskosten beziehen sich darauf. Heizung, Wasser, Müllabfuhr etc. sind NICHT enthalten (das sind die umlagefähigen Nebenkosten).",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Mietvertrag oder Mieterliste",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "ze": {
   "id": "ze",
   "reiter": "s2",
   "karte": "Mietstruktur",
   "label": "Zusätzliche Einnahmen / Monat",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "90",
   "optionen": null,
   "hinweis": "Stellplatz, Garage etc. – fließt in Nettokaltmiete + Steuerberechnung ein",
   "titel": "",
   "tip": {
    "titel": "Zusätzliche Einnahmen",
    "text": "Mieteinnahmen aus Stellplatz, Garage, Keller, Garten oder anderen Nebenflächen. Fließen in die Nettokaltmiete der Steuerberechnung ein. Wichtig: getrennt vom NKM ausweisen, damit die Miete pro m² korrekt berechnet wird.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Mietvertrag oder Mieterliste",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "umlagef": {
   "id": "umlagef",
   "reiter": "s2",
   "karte": "Mietstruktur",
   "label": "Umlagefähige Kosten / Monat",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "144",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Umlagefähige Kosten",
    "text": "Betriebskosten die der Mieter zahlt: Heizung, Wasser, Müllabfuhr, Grundsteuer, Versicherungen (Gebäudehaftpflicht), Hausmeister, Aufzugswartung. Sind in der Bewirtschaftung als \"durchlaufender Posten\" — Mieter zahlt, Verwaltung leitet weiter.",
    "beispiel": "",
    "paragraf": "BetrKV"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_marktmiete": {
   "id": "ds2_marktmiete",
   "reiter": "s2",
   "karte": "Mietpreis-Analyse",
   "label": "Marktmiete (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "9,00",
   "optionen": null,
   "hinweis": "Markt-üblich für die Region — wird mit Ist-Miete verglichen für Upside-Score.",
   "titel": "",
   "tip": {
    "titel": "Marktmiete (€/m²)",
    "text": "Markt-übliche Nettokaltmiete pro m² für vergleichbare Objekte in der Region. Aus Mietspiegel, Immobilienscout-Statistik oder KI-Recherche. Wird mit der Ist-Miete verglichen für den Upside-Score: wenn Ist < Markt → Mietsteigerungs-Potenzial.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Marktmiete)",
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein"
   ]
  },
  "ds2_mietausfall": {
   "id": "ds2_mietausfall",
   "reiter": "s2",
   "karte": "Mietpreis-Analyse",
   "label": "Mietausfall-Risiko",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    },
    {
     "wert": "sehr_niedrig",
     "text": "Sehr niedrig (Leerstand unter 1,5 %)"
    },
    {
     "wert": "niedrig",
     "text": "Niedrig (unter 3 %)"
    },
    {
     "wert": "mittel",
     "text": "Mittel (unter 6 %)"
    },
    {
     "wert": "erhoeht",
     "text": "Erhöht (unter 9 %)"
    },
    {
     "wert": "hoch",
     "text": "Hoch (ab 9 %)"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Mietausfall-Risiko",
    "text": "Wie wahrscheinlich sind Mietausfälle in deiner Lage? Faktoren: Mieterstruktur, Sozialindex, Leerstandsquote, lokale Wirtschaftslage. Niedrig = großstädtische A-Lage, Hoch = strukturschwache Region.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "zählt im Readycheck der Deal-Aktion (Mietausfall-Risiko)"
   ]
  },
  "mv_art": {
   "id": "mv_art",
   "reiter": "s2",
   "karte": "Mietvertrag",
   "label": "Vertragsart",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "",
     "text": "– keine Angabe –"
    }
   ],
   "hinweis": "",
   "titel": "Die Vertragsform bestimmt, ob und wann erhöht werden darf. Staffel- und Indexmiete tragen ihren nächsten Termin schon im Vertrag — sie sind kein Potenzial, sondern ein Datum.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "mv_beginn": {
   "id": "mv_beginn",
   "reiter": "s2",
   "karte": "Mietvertrag",
   "label": "Mietverhältnis seit",
   "typ": "datum",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "Seit wann das Mietverhältnis besteht. Bei Staffelmiete die Grundlage für die Stufen, bei Indexmiete für die Zwölfmonatsfrist.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "mv_letzte_erhoehung": {
   "id": "mv_letzte_erhoehung",
   "reiter": "s2",
   "karte": "Mietvertrag",
   "label": "Letzte Erhöhung",
   "typ": "datum",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "Wann die Miete zuletzt erhöht wurde. Daran hängen die Kappungsgrenze und bei Indexmieten die Frist bis zur nächsten Anpassung.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "mv_letzte_erhoehung_betrag": {
   "id": "mv_letzte_erhoehung_betrag",
   "reiter": "s2",
   "karte": "Mietvertrag",
   "label": "Letzte Erhöhung um",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "€/Monat",
   "optionen": null,
   "hinweis": "",
   "titel": "Um wie viel Euro im Monat die Miete bei der letzten Erhöhung gestiegen ist (bei mehreren in den letzten drei Jahren: die Summe, ohne Modernisierungsumlage und Betriebskosten). Die Kappungsgrenze gilt auf die Miete vor drei Jahren — ohne diese Angabe rechnet DealPilot den Spielraum zu groß.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "me_soll": {
   "id": "me_soll",
   "reiter": "s2",
   "karte": "Mietentwicklung",
   "label": "Soll-Mietspiegel (€/m²)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "9.50",
   "optionen": null,
   "hinweis": "Marktmiete laut lokalem Mietspiegel",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Marktmiete laut lokalem Mietspiegel",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "me_anz": {
   "id": "me_anz",
   "reiter": "s2",
   "karte": "Mietentwicklung",
   "label": "Anzahl Erhöhungen",
   "typ": "zahl",
   "einheit": "×",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "me_int": {
   "id": "me_int",
   "reiter": "s2",
   "karte": "Mietentwicklung",
   "label": "Intervall",
   "typ": "zahl",
   "einheit": "Jahre",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "me_pct": {
   "id": "me_pct",
   "reiter": "s2",
   "karte": "Mietentwicklung",
   "label": "Angestrebte Entwicklung",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Gesamt über alle Erhöhungen verteilt",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "bank_inst": {
   "id": "bank_inst",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Institution",
   "typ": "text",
   "einheit": "",
   "platzhalter": "Bank / Kreditinstitut",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d1_vertrag": {
   "id": "d1_vertrag",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Vertragsnummer",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. KD-2025-001",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d1_vertragsdatum": {
   "id": "d1_vertragsdatum",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Vertragsdatum",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 14.03.2025",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "d1_type": {
   "id": "d1_type",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Art des Darlehens",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "annuitaet",
     "text": "Annuitätendarlehen"
    },
    {
     "wert": "tilgungsaussetzung",
     "text": "Tilgungsaussetzungsdarlehen (mit Bausparvertrag)"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d1_auszahl": {
   "id": "d1_auszahl",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Auszahlungsdatum",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 05.2025",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "ek": {
   "id": "ek",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Eigenkapital",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "17905",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Eigenkapital",
    "text": "Wieviel zahlst du aus eigener Tasche? Banken geben für Wohnimmobilien typischerweise bis zu 100% Kaufpreis-Finanzierung — die Erwerbsnebenkosten (~10%) musst du aus eigenen Mitteln zahlen. Mehr EK = besserer LTV = bessere Konditionen.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "ek_ist_nk": {
   "id": "ek_ist_nk",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Eigenkapital entspricht den Kaufnebenkosten",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "Setzt das Eigenkapital auf die Kaufnebenkosten (Makler, Notar/Grundbuch, Grunderwerbsteuer, weitere). Das Darlehen finanziert dann Kaufpreis, Sanierung und Möblierung.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "ek_inkl_nk": {
   "id": "ek_inkl_nk",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "LTV inkl. Erwerbsnebenkosten berechnen (strenger, GI-Bezug)",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "(strenger, GI-Bezug)",
   "titel": "LTV-Bezugsgröße: AUS = LTV gegen Kaufpreis (Standard-Bankenpraxis, Beleihungsbasis ≈ KP). AN = LTV gegen Gesamtinvestition inkl. Erwerbsnebenkosten (konservativere Sicht — strenger, da KNK nicht als Sicherheit zählen).",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d1": {
   "id": "d1",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Anfängl. Darlehenssumme",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "200000",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d1z": {
   "id": "d1z",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Zinssatz nominal (% p.a.)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Zinssatz nominal",
    "text": "Der Sollzins deines Darlehens laut Bankangebot, in Prozent pro Jahr. Er bestimmt die Zinsen und damit Rate, Cashflow und DSCR — und über die Schuldzinsen auch die Werbungskosten in der Steuer. Vorbelegt wird er aus deinen Einstellungen (eigener Zins oder indikativer Marktzins); mit einem echten Angebot trägst du hier dessen Satz ein.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "zählt im Readycheck der Deal-Aktion (Zinssatz)",
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d1t": {
   "id": "d1t",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Tilgung (% p.a.) — bei Aussetzung deaktiviert",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "— bei Aussetzung deaktiviert",
   "titel": "",
   "tip": {
    "titel": "Tilgung p.a.",
    "text": "Wieviel deiner Schulden tilgst du pro Jahr (in % der Darlehenssumme). Banken verlangen heute meist mindestens 2%. Höhere Tilgung = schnellere Entschuldung + geringere Restschuld bei Anschlussfinanzierung. Faustregel: mindestens 2,5% bei 10 Jahre Zinsbindung.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": true,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "zählt im Readycheck der Deal-Aktion (Tilgung)",
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d1_bindj": {
   "id": "d1_bindj",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Zinsbindung (Jahre)",
   "typ": "zahl",
   "einheit": "J.",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d1_anschl_enable": {
   "id": "d1_anschl_enable",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Eigene Anschlussfinanzierung für Darlehen 1",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "anschl_z": {
   "id": "anschl_z",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Zinssatz Anschluss (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "anschl_t": {
   "id": "anschl_t",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Tilgung Anschluss (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "anschl_bj": {
   "id": "anschl_bj",
   "reiter": "s3",
   "karte": "Darlehen I – Hauptdarlehen",
   "label": "Zinsbindung Anschluss (J.)",
   "typ": "zahl",
   "einheit": "J.",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "bspar_inst": {
   "id": "bspar_inst",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Bausparkasse",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. Wüstenrot, Schwäbisch Hall",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_vertrag": {
   "id": "bspar_vertrag",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Vertragsnummer",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. BSV-12345678",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_vertragsdatum": {
   "id": "bspar_vertragsdatum",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Vertragsdatum",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 14.03.2025",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "bspar_sum": {
   "id": "bspar_sum",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Bausparsumme",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "200000",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_rate": {
   "id": "bspar_rate",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Sparrate / Monat",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "350",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_quote_min": {
   "id": "bspar_quote_min",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Mindestsparquote für Zuteilung (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Wüstenrot/SchwäbHall typ. 40-50%, manche Tarife ab 25%",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_zins": {
   "id": "bspar_zins",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Guthaben-Zinssatz (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_dar_z": {
   "id": "bspar_dar_z",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Zinssatz Bauspardarlehen (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Tariflich festgelegt, oft 1,5-3 %",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "bspar_dar_t": {
   "id": "bspar_dar_t",
   "reiter": "s3",
   "karte": "Bausparvertrag Tilgungsaussetzung",
   "label": "Tilgung Bauspardarlehen (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Hohe Tilgung typisch (5-7 %)",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d2_type": {
   "id": "d2_type",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Art des Darlehens",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "annuitaet",
     "text": "Annuitätendarlehen"
    },
    {
     "wert": "tilgungsaussetzung",
     "text": "Tilgungsaussetzungsdarlehen"
    },
    {
     "wert": "kfw",
     "text": "KfW-Darlehen"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_inst": {
   "id": "d2_inst",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Institution",
   "typ": "text",
   "einheit": "",
   "platzhalter": "Bank / KfW",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF"
   ]
  },
  "d2_vertrag": {
   "id": "d2_vertrag",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Vertragsnummer",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. KfW-1234567",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_bspar": {
   "id": "d2_bspar",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Bausparvertrag (optional)",
   "typ": "text",
   "einheit": "",
   "platzhalter": "Bausparvertragsnr.",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_auszahl": {
   "id": "d2_auszahl",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Auszahlungsdatum",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 06.2026",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_vertragsdatum": {
   "id": "d2_vertragsdatum",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Vertragsdatum",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. 02.06.2026",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "d2": {
   "id": "d2",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Darlehenssumme",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d2z": {
   "id": "d2z",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Zinssatz nominal (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d2t": {
   "id": "d2t",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Tilgung (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Bei Tilgungsaussetzung: 0",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "d2_bindj": {
   "id": "d2_bindj",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Zinsbindung (Jahre)",
   "typ": "zahl",
   "einheit": "J.",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Finanzierungsangebot der Bank",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_anschl_enable": {
   "id": "d2_anschl_enable",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Eigene Anschlussfinanzierung für Darlehen 2",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_az": {
   "id": "d2_az",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Zinssatz Anschluss (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "d2_at": {
   "id": "d2_at",
   "reiter": "s3",
   "karte": "Darlehen II – Zusatzdarlehen",
   "label": "Tilgung Anschluss (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "bwk_ul_pct": {
   "id": "bwk_ul_pct",
   "reiter": "s4",
   "karte": "BWK – Quick-Eingabe",
   "label": "Umlagefähig (% der NKM)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Typisch: 15–20% (Hausgeld umlagefähig, Grundsteuer, etc.)",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "bwk_nul_pct": {
   "id": "bwk_nul_pct",
   "reiter": "s4",
   "karte": "BWK – Quick-Eingabe",
   "label": "Nicht umlagefähig (% der NKM)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Typisch: 15–22% (Verwaltung, Rücklagen, Mietausfall)",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "bwk_kp_pct": {
   "id": "bwk_kp_pct",
   "reiter": "s4",
   "karte": "BWK – Quick-Eingabe",
   "label": "BWK gesamt (% vom Kaufpreis)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Bewährter Erfahrungswert: 0,5 – 1,0% des Kaufpreises p.a.",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "hg_ul": {
   "id": "hg_ul",
   "reiter": "s4",
   "karte": "Umlagefähige Kosten / Jahr",
   "label": "Hausgeld (umlagefähig) / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "1391",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Hausgeld (umlagefähig)",
    "text": "Anteil des JAEHRLICHEN Hausgelds (das Feld rechnet in Euro pro Jahr), den du auf den Mieter umlegen darfst: Heizung, Wasser, Müll, Hausreinigung, Aufzugswartung, Hausmeister, Versicherungen, Grundsteuer. Steht in der Hausgeld-Abrechnung.",
    "beispiel": "",
    "paragraf": "BetrKV § 2"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Wirtschaftsplan oder Hausgeldabrechnung der WEG",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "grundsteuer": {
   "id": "grundsteuer",
   "reiter": "s4",
   "karte": "Umlagefähige Kosten / Jahr",
   "label": "Grundsteuer / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "336",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "ul_sonst": {
   "id": "ul_sonst",
   "reiter": "s4",
   "karte": "Umlagefähige Kosten / Jahr",
   "label": "Sonstiges umlagefähig / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Sonstiges umlagefähig",
    "text": "Weitere umlagefähige Positionen: Schornsteinfeger, Hausmeister, Aufzugs-Wartung, Müllabfuhr, anteilige Gebäudeversicherung, Strom für Treppenhaus.",
    "beispiel": "",
    "paragraf": "BetrKV § 2"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "hg_nul": {
   "id": "hg_nul",
   "reiter": "s4",
   "karte": "Nicht umlagefähige Kosten / Jahr",
   "label": "Hausgeld (nicht umlagefähig)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "1539",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Hausgeld (nicht umlagefähig)",
    "text": "Anteil des Hausgelds, den DU trägst — kann NICHT auf den Mieter umgelegt werden: Verwaltergebühren, WEG-Rücklage, Bankgebühren, anteilige Sanierungen aus der Rücklage. Typisch 30-50% des Gesamthausgelds.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "Wirtschaftsplan oder Hausgeldabrechnung der WEG",
   "wirkung": [
    "geht in den Investor Deal Score",
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "weg_r": {
   "id": "weg_r",
   "reiter": "s4",
   "karte": "Nicht umlagefähige Kosten / Jahr",
   "label": "WEG-Rücklage / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "798",
   "optionen": null,
   "hinweis": "Anteil der Rücklage am Hausgeld - nur zur Information, fließt nicht doppelt in die Bewirtschaftung ein.",
   "titel": "",
   "tip": {
    "titel": "WEG-Rücklage (nur Info!)",
    "text": "Anteil der monatlichen WEG-Rücklage am Hausgeld — wird NICHT zusätzlich summiert, ist BEREITS Teil des nicht-umlagefähigen Hausgelds. Nur zur Information für deine eigene Übersicht. Doppelt-Einrechnen führt zu falscher Cashflow-Berechnung!",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "Nur Info — wird NICHT zusätzlich summiert. Die Rücklage ist normalerweise bereits Teil des Hausgeldes (HG)",
    "geht in den Investor Deal Score",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "eigen_r": {
   "id": "eigen_r",
   "reiter": "s4",
   "karte": "Nicht umlagefähige Kosten / Jahr",
   "label": "Eigene Instandhaltungsrücklage",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Eigene Instandhaltungsrücklage",
    "text": "Zusätzliches Geld, das DU zurücklegst — NEBEN der WEG-Rücklage. Für sondereigentums-spezifische Sanierungen (eigenes Bad, Heizung, Fenster). Faustregel: 1-2% vom Kaufpreis p.a. bei ETW, 5-10% der NKM bei MFH.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": true,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in den Investor Deal Score",
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "mietausfall": {
   "id": "mietausfall",
   "reiter": "s4",
   "karte": "Nicht umlagefähige Kosten / Jahr",
   "label": "Kalkulat. Mietausfall / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Kalkulatorischer Mietausfall",
    "text": "Konservativer Puffer für Mieterwechsel, Leerstand und Zahlungsausfälle. Bei stabilem Mieter: 0. Bei normalem Risiko: 1-2 Monatsmieten p.a. Bei strukturschwacher Lage: 3-4 Monate. Wird je nach DS2-Mietausfall-Risiko (Tab Miete) auto-vorbefüllt.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "nul_sonst": {
   "id": "nul_sonst",
   "reiter": "s4",
   "karte": "Nicht umlagefähige Kosten / Jahr",
   "label": "Sonderverwaltung / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Sonderverwaltung",
    "text": "Zusätzliche Verwalter-Gebühren für Sonderaufgaben: WEG-Versammlungs-Vorbereitung, juristische Beratung, Sonder-Abrechnungen. Bei MFH selbst-verwaltet: 0. Bei ETW im WEG: meist im Hausgeld enthalten — hier dann 0.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "kp1": {
   "id": "kp1",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Kostenposition I (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "kp1l": {
   "id": "kp1l",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Bezeichnung",
   "typ": "text",
   "einheit": "",
   "platzhalter": "z.B. Hausverwaltung",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "kp2": {
   "id": "kp2",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Kostenposition II (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "kp2l": {
   "id": "kp2l",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Bezeichnung",
   "typ": "text",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "kp3": {
   "id": "kp3",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Kostenposition III (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "kp3l": {
   "id": "kp3l",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Bezeichnung",
   "typ": "text",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "kp4": {
   "id": "kp4",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Kostenposition IV (€)",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "0",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)"
   ]
  },
  "kp4l": {
   "id": "kp4l",
   "reiter": "s4",
   "karte": "Detailpositionen (optional)",
   "label": "Bezeichnung",
   "typ": "text",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "zve": {
   "id": "zve",
   "reiter": "s3-tax",
   "karte": "Persönliche Steuer",
   "label": "Zu versteuerndes Einkommen (zvE) vor Immobilie / Jahr",
   "typ": "zahl",
   "einheit": "",
   "platzhalter": "60000",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "zvE — zu versteuerndes Einkommen",
    "text": "Dein zu versteuerndes Einkommen ohne diese Immobilie. Du findest es im letzten Steuerbescheid unter \"zu versteuerndes Einkommen\". Daraus berechnet sich der Grenzsteuersatz: bei zvE 30.000 € ≈ 25%, bei 60.000 € ≈ 35%, bei 80.000 € ≈ 42% (Höchstsatz).",
    "beispiel": "",
    "paragraf": "§ 32a EStG"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "Du findest es im letzten Steuerbescheid unter \"zu versteuerndes Einkommen\".",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF"
   ]
  },
  "grenz": {
   "id": "grenz",
   "reiter": "s3-tax",
   "karte": "Persönliche Steuer",
   "label": "Persönl. Grenzsteuersatz (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "40,45",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "Grenzsteuersatz",
    "text": "Steuersatz auf den nächsten verdienten Euro — entscheidend für die Wirkung der V+V-Verluste. Wenn DealPilot ihn aus dem zvE berechnen soll, einfach die Checkbox aktiv lassen. Reichensteuer (45%) ab 277.826 € zvE.",
    "beispiel": "",
    "paragraf": "§ 32a EStG"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "letzter Einkommensteuerbescheid",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "grenz_auto": {
   "id": "grenz_auto",
   "reiter": "s3-tax",
   "karte": "Persönliche Steuer",
   "label": "Grenzsteuersatz automatisch aus zvE berechnen",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "Wenn aktiv, wird der Grenzsteuersatz automatisch aus deinem zvE nach §32a EStG (Tarif 2026) berechnet.",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "afa_satz": {
   "id": "afa_satz",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "AfA-Satz",
   "typ": "auswahl",
   "einheit": "",
   "platzhalter": "",
   "optionen": [
    {
     "wert": "2.0",
     "text": "2,0 % linear — Standard ab 1925"
    },
    {
     "wert": "2.5",
     "text": "2,5 % linear — Baujahr vor 1925"
    },
    {
     "wert": "3.0",
     "text": "3,0 % linear — Wohnzwecke ab 2023"
    },
    {
     "wert": "5.0_deg",
     "text": "5,0 % degressiv — ohne Wechsel"
    },
    {
     "wert": "5.0_deg_wechsel",
     "text": "5,0 % degressiv mit Wechsel auf 3% linear (empfohlen)"
    }
   ],
   "hinweis": "",
   "titel": "",
   "tip": {
    "titel": "AfA-Satz",
    "text": "Wie schnell wird das Gebäude abgeschrieben? Linear 2,0% (50 Jahre): Standard ab Baujahr 1925. Linear 2,5% (40 Jahre): vor 1925. Linear 3,0% (33 Jahre): Wohnzwecke mit Bauantrag ab 2023. Degressiv 5,0%: nur für Neubau-Wohnbau (Bauantrag 10/2023 – 09/2029).",
    "beispiel": "",
    "paragraf": "§ 7 EStG"
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "geb_ant": {
   "id": "geb_ant",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "Gebäudeanteil am KP (%)",
   "typ": "zahl",
   "einheit": "%",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "Rest = Grundstücksanteil",
   "titel": "",
   "tip": {
    "titel": "Gebäudeanteil",
    "text": "Anteil des Gebäudes am Kaufpreis. Der Rest ist Grundstücksanteil und NICHT abschreibbar. Standard: 80% Gebäude / 20% Grundstück (ETW). Bei A-Lagen kann der Grundstücksanteil 30-40% betragen. Exakte Werte über BMF-Sachwertverfahren oder Gutachten ermitteln.",
    "beispiel": "",
    "paragraf": ""
   },
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)",
    "geht in die Pilot-Analyse ein",
    "steht im Investment-PDF",
    "steht im Bank-PDF (Investment Case)"
   ]
  },
  "afa_sonder7b_aktiv": {
   "id": "afa_sonder7b_aktiv",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "§ 7b Sonder-AfA aktivieren",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": [
    "geht in die Pilot-Analyse ein"
   ]
  },
  "afa_sonder7b_eh40": {
   "id": "afa_sonder7b_eh40",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "Effizienzhaus 40 NH (QNG-Siegel)",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "afa_sonder7b_baukosten": {
   "id": "afa_sonder7b_baukosten",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "Baukosten ≤ 5.200 €/m² Wohnfläche",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "afa_sonder7b_vermietung": {
   "id": "afa_sonder7b_vermietung",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "10 Jahre Vermietung verbindlich",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  },
  "afa_sonder7b_neubau": {
   "id": "afa_sonder7b_neubau",
   "reiter": "s3-tax",
   "karte": "AfA-Konfiguration",
   "label": "Neubau mit Bauantrag/Kaufvertrag 01.01.2023 – 30.09.2029",
   "typ": "haken",
   "einheit": "",
   "platzhalter": "",
   "optionen": null,
   "hinweis": "",
   "titel": "",
   "tip": null,
   "ds2": false,
   "pflichtMarke": false,
   "woher": "",
   "wirkung": []
  }
 },
 "kapitel": [
  {
   "art": "ETW",
   "name": "Eigentumswohnung",
   "beispiel": {
    "nutzungsart": "kapitalanlage",
    "makler_p": "3,57",
    "notar_p": "1,7",
    "gba_p": "0,5",
    "gest_p": "6,5",
    "d1z": "4,31",
    "d1t": "1,5",
    "d1_bindj": "10",
    "zve": "60000",
    "plz": "32052",
    "ort": "Herford",
    "str": "Sachsenstraße",
    "hnr": "18",
    "objart": "ETW",
    "wfl": "100",
    "zimmer": "3",
    "baujahr": "1998",
    "etage": "2",
    "etagen_ges": "3",
    "ds2_zustand": "gut",
    "standardstufe": "3",
    "ds2_energie": "C",
    "gsfl": "1200",
    "mea": "12",
    "brw": "190",
    "kp": "239000",
    "nkm": "750",
    "ze": "40",
    "umlagef": "220",
    "ek": "72910",
    "d1": "199000",
    "hg_ul": "2400",
    "grundsteuer": "260",
    "hg_nul": "900",
    "weg_r": "600",
    "bgf": "135",
    "thesis": "Solide vermietete 3-Zimmer-Wohnung, Miete unter Vergleichsniveau."
   },
   "pflicht": {
    "1": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr"
    ],
    "2": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr",
     "kp",
     "nkm",
     "ds2_zustand",
     "ds2_energie",
     "standardstufe",
     "zimmer",
     "etage"
    ],
    "3": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr",
     "kp",
     "nkm",
     "ds2_zustand",
     "ds2_energie",
     "standardstufe",
     "zimmer",
     "etage",
     "nutzungsart",
     "gsfl",
     "brw",
     "bgf",
     "mea"
    ]
   },
   "schritte": [
    {
     "sec": "s0",
     "auswahl": "Haken „Erbbaurecht / Erbpacht“ gesetzt",
     "felder": [
      {
       "id": "plz",
       "nr": 1,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ort",
       "nr": 2,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "str",
       "nr": 3,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hnr",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "objart",
       "nr": 5,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nutzungsart",
       "nr": 6,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wfl",
       "nr": 7,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zimmer",
       "nr": 8,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "baujahr",
       "nr": 9,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "etage",
       "nr": 10,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "etagen_ges",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_zustand",
       "nr": 12,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "standardstufe",
       "nr": 13,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_energie",
       "nr": 14,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "vermstand",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gsfl",
       "nr": 16,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mea",
       "nr": 17,
       "stufe": 3,
       "artPflicht": true,
       "artHinweis": "Bei Wohnungseigentum trägt der Miteigentumsanteil den Bodenwert.",
       "nachAuswahl": false
      },
      {
       "id": "kuerzel",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "thesis",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "risiken",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "exitstr",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kaufdat",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wirtschaftlicher_uebergang",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "halter",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mand_ueberf_cb",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw",
       "nr": 26,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_stichtag",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_walls",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_aussenwand",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_aussenwaende",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_roof",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_dach",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_dach",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_windows",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_fenster",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_fenster",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_heating",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_heizung",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_heizung",
       "nr": 39,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_bath",
       "nr": 40,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_baeder",
       "nr": 41,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_sanitaer",
       "nr": 42,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_floor",
       "nr": 43,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_fussboeden",
       "nr": 44,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_innenausbau",
       "nr": 45,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_innenwaende",
       "nr": 46,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_decken",
       "nr": 47,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_leitungen",
       "nr": 48,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_technik",
       "nr": 49,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_grundriss",
       "nr": 50,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_elevator",
       "nr": 51,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_guest_wc",
       "nr": 52,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_store_room",
       "nr": 53,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bad_anz",
       "nr": 54,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "balkon_flae",
       "nr": 55,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen",
       "nr": 56,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "stellpl_aussen",
       "nr": 57,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "modernis",
       "nr": 58,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "baustatus",
       "nr": 59,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gemarkung",
       "nr": 60,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "flur",
       "nr": 61,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "flurstueck",
       "nr": 62,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_qm",
       "nr": 63,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_eur_qm",
       "nr": 64,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_rentierlich",
       "nr": 65,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "erbpacht",
       "nr": 66,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "lageklasse",
       "nr": 67,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makrolage",
       "nr": 68,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mikrolage",
       "nr": 69,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_bevoelkerung",
       "nr": 70,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_nachfrage",
       "nr": 71,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_wertsteigerung",
       "nr": 72,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_entwicklung",
       "nr": 73,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bankval",
       "nr": 74,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "svwert",
       "nr": 75,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wert_soll",
       "nr": 76,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notizen",
       "nr": 77,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_fertig_jahr",
       "nr": 78,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_vgl_qm",
       "nr": 79,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_soll_qm",
       "nr": 80,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_soll_ab",
       "nr": 81,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_ziel_qm",
       "nr": 82,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_ziel_wann",
       "nr": 83,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bgf",
       "nr": 84,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grundriss",
       "nr": 85,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_punkte",
       "nr": 86,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "sachwertfaktor",
       "nr": 87,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "uk_flaeche",
       "nr": 88,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wgfz_objekt",
       "nr": 89,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "stellplatz_miete_monat",
       "nr": 90,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "sonstige_jahr",
       "nr": 91,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_haus",
       "nr": 92,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_geschosse",
       "nr": 93,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_dach",
       "nr": 94,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen_bgf_qm",
       "nr": 95,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen_stufe",
       "nr": 96,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "aussenanlagen_pct",
       "nr": 97,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "aussenanlagen",
       "nr": 98,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bes_bauteile",
       "nr": 99,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_gauben",
       "nr": 100,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_balkone",
       "nr": 101,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_vordach",
       "nr": 102,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_terrassen",
       "nr": 103,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_sonstige",
       "nr": 104,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "lzs_pct",
       "nr": 105,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_manuell",
       "nr": 106,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_anpassung_pct",
       "nr": 107,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_anpassung_grund",
       "nr": 108,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "erbbauzins",
       "nr": 109,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_restlz",
       "nr": 110,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_zs_ang",
       "nr": 111,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_entsch",
       "nr": 112,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_wert_ist_erb",
       "nr": 113,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [
      {
       "id": "verkehrswert_ueberf",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_preis",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "halter_seit",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "gesellschafterdarlehen",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_restschuld",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_rest_zins",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_ende",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ausst",
       "stufe": 0,
       "grund": "Altfeld, ersetzt durch die Standardstufe (NHK 2010). Die App blendet es nicht mehr ein; gespeicherte Werte bleiben lesbar."
      }
     ],
     "bilder": [
      {
       "datei": "hb-etw-s0-1.webp",
       "felder": [
        "plz",
        "ort",
        "str",
        "hnr",
        "objart",
        "nutzungsart",
        "wfl",
        "zimmer",
        "baujahr",
        "etage",
        "etagen_ges",
        "ds2_zustand",
        "standardstufe",
        "ds2_energie",
        "vermstand",
        "gsfl",
        "mea",
        "kuerzel"
       ],
       "marken": [
        {
         "id": "plz",
         "x": 0.024,
         "y": 0.0935
        },
        {
         "id": "ort",
         "x": 0.252,
         "y": 0.0935
        },
        {
         "id": "str",
         "x": 0.024,
         "y": 0.1871
        },
        {
         "id": "hnr",
         "x": 0.252,
         "y": 0.1871
        },
        {
         "id": "objart",
         "x": 0.024,
         "y": 0.2806
        },
        {
         "id": "nutzungsart",
         "x": 0.252,
         "y": 0.2806
        },
        {
         "id": "wfl",
         "x": 0.024,
         "y": 0.3751
        },
        {
         "id": "zimmer",
         "x": 0.252,
         "y": 0.3751
        },
        {
         "id": "baujahr",
         "x": 0.024,
         "y": 0.4687
        },
        {
         "id": "etage",
         "x": 0.252,
         "y": 0.4687
        },
        {
         "id": "etagen_ges",
         "x": 0.024,
         "y": 0.5622
        },
        {
         "id": "ds2_zustand",
         "x": 0.252,
         "y": 0.5622
        },
        {
         "id": "standardstufe",
         "x": 0.024,
         "y": 0.6597
        },
        {
         "id": "ds2_energie",
         "x": 0.252,
         "y": 0.6597
        },
        {
         "id": "vermstand",
         "x": 0.024,
         "y": 0.7582
        },
        {
         "id": "gsfl",
         "x": 0.252,
         "y": 0.7582
        },
        {
         "id": "mea",
         "x": 0.024,
         "y": 0.8517
        },
        {
         "id": "kuerzel",
         "x": 0.252,
         "y": 0.8517
        }
       ]
      },
      {
       "datei": "hb-etw-s0-2.webp",
       "felder": [
        "thesis",
        "risiken",
        "exitstr",
        "kaufdat",
        "wirtschaftlicher_uebergang",
        "halter",
        "mand_ueberf_cb"
       ],
       "marken": [
        {
         "id": "thesis",
         "x": 0.024,
         "y": 0.038
        },
        {
         "id": "risiken",
         "x": 0.024,
         "y": 0.225
        },
        {
         "id": "exitstr",
         "x": 0.024,
         "y": 0.413
        },
        {
         "id": "kaufdat",
         "x": 0.024,
         "y": 0.675
        },
        {
         "id": "wirtschaftlicher_uebergang",
         "x": 0.252,
         "y": 0.675
        },
        {
         "id": "halter",
         "x": 0.024,
         "y": 0.805
        },
        {
         "id": "mand_ueberf_cb",
         "x": 0.024,
         "y": 0.934
        }
       ]
      },
      {
       "datei": "hb-etw-s0-3.webp",
       "felder": [
        "brw",
        "brw_stichtag"
       ],
       "marken": [
        {
         "id": "brw",
         "x": 0.517,
         "y": 0.293
        },
        {
         "id": "brw_stichtag",
         "x": 0.517,
         "y": 0.738
        }
       ]
      },
      {
       "datei": "hb-etw-s0-4.webp",
       "felder": [
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
        "mod_grundriss",
        "eq_elevator",
        "eq_guest_wc",
        "eq_store_room"
       ],
       "marken": [
        {
         "id": "eq_walls",
         "x": 0.23,
         "y": 0.129
        },
        {
         "id": "mod_aussenwand",
         "x": 0.537,
         "y": 0.129
        },
        {
         "id": "ausst_aussenwaende",
         "x": 0.762,
         "y": 0.129
        },
        {
         "id": "eq_roof",
         "x": 0.23,
         "y": 0.189
        },
        {
         "id": "mod_dach",
         "x": 0.537,
         "y": 0.189
        },
        {
         "id": "ausst_dach",
         "x": 0.762,
         "y": 0.189
        },
        {
         "id": "eq_windows",
         "x": 0.23,
         "y": 0.249
        },
        {
         "id": "mod_fenster",
         "x": 0.537,
         "y": 0.249
        },
        {
         "id": "ausst_fenster",
         "x": 0.762,
         "y": 0.249
        },
        {
         "id": "eq_heating",
         "x": 0.23,
         "y": 0.308
        },
        {
         "id": "mod_heizung",
         "x": 0.537,
         "y": 0.308
        },
        {
         "id": "ausst_heizung",
         "x": 0.762,
         "y": 0.308
        },
        {
         "id": "eq_bath",
         "x": 0.23,
         "y": 0.368
        },
        {
         "id": "mod_baeder",
         "x": 0.537,
         "y": 0.368
        },
        {
         "id": "ausst_sanitaer",
         "x": 0.762,
         "y": 0.368
        },
        {
         "id": "eq_floor",
         "x": 0.23,
         "y": 0.427
        },
        {
         "id": "ausst_fussboeden",
         "x": 0.762,
         "y": 0.427
        },
        {
         "id": "mod_innenausbau",
         "x": 0.537,
         "y": 0.487
        },
        {
         "id": "ausst_innenwaende",
         "x": 0.762,
         "y": 0.487
        },
        {
         "id": "ausst_decken",
         "x": 0.762,
         "y": 0.547
        },
        {
         "id": "mod_leitungen",
         "x": 0.537,
         "y": 0.606
        },
        {
         "id": "ausst_technik",
         "x": 0.762,
         "y": 0.606
        },
        {
         "id": "mod_grundriss",
         "x": 0.537,
         "y": 0.666
        },
        {
         "id": "eq_elevator",
         "x": 0.024,
         "y": 0.901
        },
        {
         "id": "eq_guest_wc",
         "x": 0.339,
         "y": 0.901
        },
        {
         "id": "eq_store_room",
         "x": 0.654,
         "y": 0.901
        }
       ]
      },
      {
       "datei": "hb-etw-s0-5.webp",
       "felder": [
        "bad_anz",
        "balkon_flae",
        "garagen",
        "stellpl_aussen",
        "modernis",
        "baustatus",
        "gemarkung",
        "flur",
        "flurstueck",
        "hinterland_qm",
        "hinterland_eur_qm",
        "hinterland_rentierlich",
        "erbpacht",
        "lageklasse",
        "makrolage",
        "mikrolage",
        "ds2_bevoelkerung",
        "ds2_nachfrage",
        "ds2_wertsteigerung",
        "ds2_entwicklung"
       ],
       "marken": [
        {
         "id": "bad_anz",
         "x": 0.024,
         "y": 0.175
        },
        {
         "id": "balkon_flae",
         "x": 0.339,
         "y": 0.175
        },
        {
         "id": "garagen",
         "x": 0.654,
         "y": 0.175
        },
        {
         "id": "stellpl_aussen",
         "x": 0.024,
         "y": 0.261
        },
        {
         "id": "modernis",
         "x": 0.339,
         "y": 0.261
        },
        {
         "id": "baustatus",
         "x": 0.654,
         "y": 0.261
        },
        {
         "id": "gemarkung",
         "x": 0.024,
         "y": 0.348
        },
        {
         "id": "flur",
         "x": 0.339,
         "y": 0.348
        },
        {
         "id": "flurstueck",
         "x": 0.654,
         "y": 0.348
        },
        {
         "id": "hinterland_qm",
         "x": 0.024,
         "y": 0.434
        },
        {
         "id": "hinterland_eur_qm",
         "x": 0.339,
         "y": 0.434
        },
        {
         "id": "hinterland_rentierlich",
         "x": 0.654,
         "y": 0.434
        },
        {
         "id": "erbpacht",
         "x": 0.024,
         "y": 0.527
        },
        {
         "id": "lageklasse",
         "x": 0.024,
         "y": 0.72
        },
        {
         "id": "makrolage",
         "x": 0.339,
         "y": 0.72
        },
        {
         "id": "mikrolage",
         "x": 0.654,
         "y": 0.72
        },
        {
         "id": "ds2_bevoelkerung",
         "x": 0.024,
         "y": 0.81
        },
        {
         "id": "ds2_nachfrage",
         "x": 0.339,
         "y": 0.81
        },
        {
         "id": "ds2_wertsteigerung",
         "x": 0.654,
         "y": 0.81
        },
        {
         "id": "ds2_entwicklung",
         "x": 0.024,
         "y": 0.9
        }
       ]
      },
      {
       "datei": "hb-etw-s0-6.webp",
       "felder": [
        "bankval",
        "svwert",
        "wert_soll",
        "notizen",
        "zb_fertig_jahr",
        "zb_vgl_qm",
        "zb_soll_qm",
        "zb_soll_ab",
        "zb_ziel_qm",
        "zb_ziel_wann"
       ],
       "marken": [
        {
         "id": "bankval",
         "x": 0.024,
         "y": 0.026
        },
        {
         "id": "svwert",
         "x": 0.339,
         "y": 0.026
        },
        {
         "id": "wert_soll",
         "x": 0.654,
         "y": 0.026
        },
        {
         "id": "notizen",
         "x": 0.515,
         "y": 0.223
        },
        {
         "id": "zb_fertig_jahr",
         "x": 0.024,
         "y": 0.564
        },
        {
         "id": "zb_vgl_qm",
         "x": 0.024,
         "y": 0.707
        },
        {
         "id": "zb_soll_qm",
         "x": 0.339,
         "y": 0.707
        },
        {
         "id": "zb_soll_ab",
         "x": 0.654,
         "y": 0.707
        },
        {
         "id": "zb_ziel_qm",
         "x": 0.024,
         "y": 0.818
        },
        {
         "id": "zb_ziel_wann",
         "x": 0.024,
         "y": 0.904
        }
       ]
      },
      {
       "datei": "hb-etw-s0-7.webp",
       "felder": [
        "bgf",
        "grundriss",
        "mod_punkte",
        "sachwertfaktor",
        "uk_flaeche",
        "wgfz_objekt",
        "stellplatz_miete_monat",
        "sonstige_jahr",
        "nhk_haus",
        "nhk_geschosse",
        "nhk_dach",
        "garagen_bgf_qm",
        "garagen_stufe",
        "aussenanlagen_pct"
       ],
       "marken": [
        {
         "id": "bgf",
         "x": 0.024,
         "y": 0.252
        },
        {
         "id": "grundriss",
         "x": 0.339,
         "y": 0.252
        },
        {
         "id": "mod_punkte",
         "x": 0.654,
         "y": 0.252
        },
        {
         "id": "sachwertfaktor",
         "x": 0.024,
         "y": 0.441
        },
        {
         "id": "uk_flaeche",
         "x": 0.339,
         "y": 0.441
        },
        {
         "id": "wgfz_objekt",
         "x": 0.654,
         "y": 0.441
        },
        {
         "id": "stellplatz_miete_monat",
         "x": 0.024,
         "y": 0.531
        },
        {
         "id": "sonstige_jahr",
         "x": 0.339,
         "y": 0.531
        },
        {
         "id": "nhk_haus",
         "x": 0.024,
         "y": 0.737
        },
        {
         "id": "nhk_geschosse",
         "x": 0.339,
         "y": 0.737
        },
        {
         "id": "nhk_dach",
         "x": 0.654,
         "y": 0.737
        },
        {
         "id": "garagen_bgf_qm",
         "x": 0.024,
         "y": 0.9
        },
        {
         "id": "garagen_stufe",
         "x": 0.339,
         "y": 0.9
        },
        {
         "id": "aussenanlagen_pct",
         "x": 0.654,
         "y": 0.9
        }
       ]
      },
      {
       "datei": "hb-etw-s0-8.webp",
       "felder": [
        "aussenanlagen",
        "bes_bauteile",
        "btl_gauben",
        "btl_balkone",
        "btl_vordach",
        "btl_terrassen",
        "btl_sonstige",
        "lzs_pct",
        "brw_manuell",
        "brw_anpassung_pct",
        "brw_anpassung_grund"
       ],
       "marken": [
        {
         "id": "aussenanlagen",
         "x": 0.024,
         "y": 0.1804
        },
        {
         "id": "bes_bauteile",
         "x": 0.024,
         "y": 0.4166
        },
        {
         "id": "btl_gauben",
         "x": 0.339,
         "y": 0.4166
        },
        {
         "id": "btl_balkone",
         "x": 0.654,
         "y": 0.4166
        },
        {
         "id": "btl_vordach",
         "x": 0.024,
         "y": 0.5284
        },
        {
         "id": "btl_terrassen",
         "x": 0.339,
         "y": 0.5284
        },
        {
         "id": "btl_sonstige",
         "x": 0.654,
         "y": 0.5284
        },
        {
         "id": "lzs_pct",
         "x": 0.024,
         "y": 0.7646
        },
        {
         "id": "brw_manuell",
         "x": 0.339,
         "y": 0.7646
        },
        {
         "id": "brw_anpassung_pct",
         "x": 0.654,
         "y": 0.7646
        },
        {
         "id": "brw_anpassung_grund",
         "x": 0.024,
         "y": 0.8763
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-etw-s0-x1.webp",
       "felder": [
        "erbbauzins",
        "erb_restlz",
        "erb_zs_ang",
        "erb_entsch",
        "erb_wert_ist_erb"
       ],
       "marken": [
        {
         "id": "erbbauzins",
         "x": 0.024,
         "y": 0.103
        },
        {
         "id": "erb_restlz",
         "x": 0.497,
         "y": 0.103
        },
        {
         "id": "erb_zs_ang",
         "x": 0.024,
         "y": 0.458
        },
        {
         "id": "erb_entsch",
         "x": 0.497,
         "y": 0.458
        },
        {
         "id": "erb_wert_ist_erb",
         "x": 0.024,
         "y": 0.812
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-etw-s0-m1.webp",
       "felder": [
        "plz",
        "ort",
        "str",
        "hnr",
        "objart"
       ],
       "marken": [
        {
         "id": "plz",
         "x": 0.425,
         "y": 0.203
        },
        {
         "id": "ort",
         "x": 0.827,
         "y": 0.203
        },
        {
         "id": "str",
         "x": 0.626,
         "y": 0.46
        },
        {
         "id": "hnr",
         "x": 0.827,
         "y": 0.46
        },
        {
         "id": "objart",
         "x": 0.827,
         "y": 0.717
        }
       ]
      },
      {
       "datei": "hb-etw-s0-m2.webp",
       "felder": [
        "nutzungsart",
        "wfl",
        "zimmer"
       ],
       "marken": [
        {
         "id": "nutzungsart",
         "x": 0.827,
         "y": 0.082
        },
        {
         "id": "wfl",
         "x": 0.827,
         "y": 0.378
        },
        {
         "id": "zimmer",
         "x": 0.827,
         "y": 0.674
        }
       ]
      }
     ]
    },
    {
     "sec": "s1",
     "auswahl": "Haken „Inventar erfassen“ gesetzt",
     "felder": [
      {
       "id": "kp",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makler_p",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makler_e",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notar_p",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notar_e",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gba_p",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gba_e",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gest_p",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gest_e",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ji_p",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ji_e",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "san",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "san_ust",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "moebl",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "inv_kueche",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_moebel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_geraete",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_pv",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_stellplatz",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_sonst",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-etw-s1-1.webp",
       "felder": [
        "kp",
        "makler_p",
        "makler_e",
        "notar_p",
        "notar_e",
        "gba_p",
        "gba_e",
        "gest_p",
        "gest_e",
        "ji_p",
        "ji_e",
        "san",
        "san_ust",
        "moebl"
       ],
       "marken": [
        {
         "id": "kp",
         "x": 0.024,
         "y": 0.115
        },
        {
         "id": "makler_p",
         "x": 0.024,
         "y": 0.25
        },
        {
         "id": "makler_e",
         "x": 0.251,
         "y": 0.25
        },
        {
         "id": "notar_p",
         "x": 0.024,
         "y": 0.366
        },
        {
         "id": "notar_e",
         "x": 0.251,
         "y": 0.366
        },
        {
         "id": "gba_p",
         "x": 0.024,
         "y": 0.482
        },
        {
         "id": "gba_e",
         "x": 0.251,
         "y": 0.482
        },
        {
         "id": "gest_p",
         "x": 0.024,
         "y": 0.597
        },
        {
         "id": "gest_e",
         "x": 0.251,
         "y": 0.597
        },
        {
         "id": "ji_p",
         "x": 0.024,
         "y": 0.713
        },
        {
         "id": "ji_e",
         "x": 0.251,
         "y": 0.713
        },
        {
         "id": "san",
         "x": 0.515,
         "y": 0.13
        },
        {
         "id": "san_ust",
         "x": 0.515,
         "y": 0.276
        },
        {
         "id": "moebl",
         "x": 0.515,
         "y": 0.839
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-etw-s1-x1.webp",
       "felder": [
        "inv_kueche",
        "inv_moebel",
        "inv_geraete",
        "inv_pv",
        "inv_stellplatz",
        "inv_sonst"
       ],
       "marken": [
        {
         "id": "inv_kueche",
         "x": 0.515,
         "y": 0.126
        },
        {
         "id": "inv_moebel",
         "x": 0.666,
         "y": 0.126
        },
        {
         "id": "inv_geraete",
         "x": 0.818,
         "y": 0.126
        },
        {
         "id": "inv_pv",
         "x": 0.515,
         "y": 0.534
        },
        {
         "id": "inv_stellplatz",
         "x": 0.666,
         "y": 0.534
        },
        {
         "id": "inv_sonst",
         "x": 0.818,
         "y": 0.534
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-etw-s1-m1.webp",
       "felder": [
        "kp",
        "makler_p"
       ],
       "marken": [
        {
         "id": "kp",
         "x": 0.827,
         "y": 0.257
        },
        {
         "id": "makler_p",
         "x": 0.827,
         "y": 0.643
        }
       ]
      }
     ]
    },
    {
     "sec": "s2",
     "auswahl": "",
     "felder": [
      {
       "id": "nkm",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ze",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "umlagef",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_marktmiete",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_mietausfall",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_art",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_beginn",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_letzte_erhoehung",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_letzte_erhoehung_betrag",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_soll",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_anz",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_int",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_pct",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-etw-s2-1.webp",
       "felder": [
        "nkm",
        "ze",
        "umlagef"
       ],
       "marken": [
        {
         "id": "nkm",
         "x": 0.024,
         "y": 0.245
        },
        {
         "id": "ze",
         "x": 0.024,
         "y": 0.453
        },
        {
         "id": "umlagef",
         "x": 0.024,
         "y": 0.734
        }
       ]
      },
      {
       "datei": "hb-etw-s2-2.webp",
       "felder": [
        "ds2_marktmiete",
        "ds2_mietausfall"
       ],
       "marken": [
        {
         "id": "ds2_marktmiete",
         "x": 0.024,
         "y": 0.112
        },
        {
         "id": "ds2_mietausfall",
         "x": 0.024,
         "y": 0.568
        }
       ]
      },
      {
       "datei": "hb-etw-s2-3.webp",
       "felder": [
        "mv_art",
        "mv_beginn",
        "mv_letzte_erhoehung",
        "mv_letzte_erhoehung_betrag",
        "me_soll",
        "me_anz",
        "me_int",
        "me_pct"
       ],
       "marken": [
        {
         "id": "mv_art",
         "x": 0.515,
         "y": 0.095
        },
        {
         "id": "mv_beginn",
         "x": 0.515,
         "y": 0.176
        },
        {
         "id": "mv_letzte_erhoehung",
         "x": 0.515,
         "y": 0.257
        },
        {
         "id": "mv_letzte_erhoehung_betrag",
         "x": 0.515,
         "y": 0.338
        },
        {
         "id": "me_soll",
         "x": 0.515,
         "y": 0.731
        },
        {
         "id": "me_anz",
         "x": 0.743,
         "y": 0.731
        },
        {
         "id": "me_int",
         "x": 0.515,
         "y": 0.856
        },
        {
         "id": "me_pct",
         "x": 0.743,
         "y": 0.856
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-etw-s2-m1.webp",
       "felder": [
        "nkm",
        "ze"
       ],
       "marken": [
        {
         "id": "nkm",
         "x": 0.827,
         "y": 0.245
        },
        {
         "id": "ze",
         "x": 0.827,
         "y": 0.523
        }
       ]
      }
     ]
    },
    {
     "sec": "s3",
     "auswahl": "Haken „Eigene Anschlussfinanzierung für Darlehen 1“, Art des Darlehens „Tilgungsaussetzungsdarlehen (mit Bausparvertrag)“, Darlehen II „Hinzufügen“ und dessen Anschlussfinanzierung",
     "felder": [
      {
       "id": "bank_inst",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_vertrag",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_vertragsdatum",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_type",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_auszahl",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek_ist_nk",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek_inkl_nk",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1z",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1t",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_bindj",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_anschl_enable",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "anschl_z",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "anschl_t",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "anschl_bj",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_inst",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_vertrag",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_vertragsdatum",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_sum",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_rate",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_quote_min",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_zins",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_dar_z",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_dar_t",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_type",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_inst",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_vertrag",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_bspar",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_auszahl",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_vertragsdatum",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2z",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2t",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_bindj",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_anschl_enable",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_az",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_at",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-etw-s3-1.webp",
       "felder": [
        "bank_inst",
        "d1_vertrag",
        "d1_vertragsdatum",
        "d1_type",
        "d1_auszahl",
        "ek",
        "ek_ist_nk",
        "ek_inkl_nk",
        "d1",
        "d1z",
        "d1t"
       ],
       "marken": [
        {
         "id": "bank_inst",
         "x": 0.024,
         "y": 0.118
        },
        {
         "id": "d1_vertrag",
         "x": 0.251,
         "y": 0.118
        },
        {
         "id": "d1_vertragsdatum",
         "x": 0.024,
         "y": 0.201
        },
        {
         "id": "d1_type",
         "x": 0.024,
         "y": 0.286
        },
        {
         "id": "d1_auszahl",
         "x": 0.251,
         "y": 0.286
        },
        {
         "id": "ek",
         "x": 0.024,
         "y": 0.386
        },
        {
         "id": "ek_ist_nk",
         "x": 0.024,
         "y": 0.466
        },
        {
         "id": "ek_inkl_nk",
         "x": 0.024,
         "y": 0.511
        },
        {
         "id": "d1",
         "x": 0.024,
         "y": 0.553
        },
        {
         "id": "d1z",
         "x": 0.024,
         "y": 0.832
        },
        {
         "id": "d1t",
         "x": 0.251,
         "y": 0.832
        }
       ]
      },
      {
       "datei": "hb-etw-s3-2.webp",
       "felder": [
        "d1_bindj",
        "d1_anschl_enable"
       ],
       "marken": [
        {
         "id": "d1_bindj",
         "x": 0.024,
         "y": 0.067
        },
        {
         "id": "d1_anschl_enable",
         "x": 0.024,
         "y": 0.8726
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-etw-s3-x1.webp",
       "felder": [
        "anschl_z",
        "anschl_t",
        "anschl_bj",
        "bspar_inst",
        "bspar_vertrag",
        "bspar_vertragsdatum",
        "bspar_sum",
        "bspar_rate",
        "bspar_quote_min",
        "bspar_zins",
        "bspar_dar_z",
        "bspar_dar_t"
       ],
       "marken": [
        {
         "id": "anschl_z",
         "x": 0.024,
         "y": 0.026
        },
        {
         "id": "anschl_t",
         "x": 0.251,
         "y": 0.026
        },
        {
         "id": "anschl_bj",
         "x": 0.251,
         "y": 0.102
        },
        {
         "id": "bspar_inst",
         "x": 0.024,
         "y": 0.452
        },
        {
         "id": "bspar_vertrag",
         "x": 0.251,
         "y": 0.452
        },
        {
         "id": "bspar_vertragsdatum",
         "x": 0.024,
         "y": 0.541
        },
        {
         "id": "bspar_sum",
         "x": 0.024,
         "y": 0.617
        },
        {
         "id": "bspar_rate",
         "x": 0.251,
         "y": 0.617
        },
        {
         "id": "bspar_quote_min",
         "x": 0.024,
         "y": 0.692
        },
        {
         "id": "bspar_zins",
         "x": 0.251,
         "y": 0.692
        },
        {
         "id": "bspar_dar_z",
         "x": 0.024,
         "y": 0.874
        },
        {
         "id": "bspar_dar_t",
         "x": 0.251,
         "y": 0.874
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-etw-s3-x2.webp",
       "felder": [
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
       ],
       "marken": [
        {
         "id": "d2_type",
         "x": 0.024,
         "y": 0.036
        },
        {
         "id": "d2_inst",
         "x": 0.251,
         "y": 0.036
        },
        {
         "id": "d2_vertrag",
         "x": 0.024,
         "y": 0.139
        },
        {
         "id": "d2_bspar",
         "x": 0.251,
         "y": 0.139
        },
        {
         "id": "d2_auszahl",
         "x": 0.024,
         "y": 0.243
        },
        {
         "id": "d2_vertragsdatum",
         "x": 0.251,
         "y": 0.243
        },
        {
         "id": "d2",
         "x": 0.024,
         "y": 0.346
        },
        {
         "id": "d2z",
         "x": 0.024,
         "y": 0.45
        },
        {
         "id": "d2t",
         "x": 0.251,
         "y": 0.45
        },
        {
         "id": "d2_bindj",
         "x": 0.024,
         "y": 0.591
        },
        {
         "id": "d2_anschl_enable",
         "x": 0.024,
         "y": 0.801
        },
        {
         "id": "d2_az",
         "x": 0.024,
         "y": 0.867
        },
        {
         "id": "d2_at",
         "x": 0.251,
         "y": 0.867
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-etw-s3-m1.webp",
       "felder": [
        "bank_inst",
        "d1_vertrag"
       ],
       "marken": [
        {
         "id": "bank_inst",
         "x": 0.827,
         "y": 0.394
        },
        {
         "id": "d1_vertrag",
         "x": 0.827,
         "y": 0.682
        }
       ]
      }
     ]
    },
    {
     "sec": "s4",
     "auswahl": "Eingabe-Modus „% der NKM“",
     "felder": [
      {
       "id": "hg_ul",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grundsteuer",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ul_sonst",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hg_nul",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "weg_r",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eigen_r",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mietausfall",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nul_sonst",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp1l",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp2",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp2l",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp3",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp3l",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp4",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp4l",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bwk_ul_pct",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bwk_nul_pct",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [
      {
       "id": "bwk_kp_pct",
       "stufe": 0,
       "grund": "Erscheint im Eingabe-Modus „% der NKM“ erst mit der Unterwahl „% vom Kaufpreis“ und ersetzt dann die beiden NKM-Quoten — es steht nie zusammen mit ihnen im Bild."
      }
     ],
     "bilder": [
      {
       "datei": "hb-etw-s4-1.webp",
       "felder": [
        "hg_ul",
        "grundsteuer",
        "ul_sonst",
        "hg_nul",
        "weg_r",
        "eigen_r",
        "mietausfall"
       ],
       "marken": [
        {
         "id": "hg_ul",
         "x": 0.024,
         "y": 0.089
        },
        {
         "id": "grundsteuer",
         "x": 0.024,
         "y": 0.163
        },
        {
         "id": "ul_sonst",
         "x": 0.024,
         "y": 0.238
        },
        {
         "id": "hg_nul",
         "x": 0.024,
         "y": 0.511
        },
        {
         "id": "weg_r",
         "x": 0.024,
         "y": 0.59
        },
        {
         "id": "eigen_r",
         "x": 0.024,
         "y": 0.825
        },
        {
         "id": "mietausfall",
         "x": 0.024,
         "y": 0.904
        }
       ]
      },
      {
       "datei": "hb-etw-s4-2.webp",
       "felder": [
        "nul_sonst"
       ],
       "marken": [
        {
         "id": "nul_sonst",
         "x": 0.024,
         "y": 0.213
        }
       ]
      },
      {
       "datei": "hb-etw-s4-3.webp",
       "felder": [
        "kp1",
        "kp1l",
        "kp2",
        "kp2l",
        "kp3",
        "kp3l",
        "kp4",
        "kp4l"
       ],
       "marken": [
        {
         "id": "kp1",
         "x": 0.515,
         "y": 0.067
        },
        {
         "id": "kp1l",
         "x": 0.743,
         "y": 0.067
        },
        {
         "id": "kp2",
         "x": 0.515,
         "y": 0.295
        },
        {
         "id": "kp2l",
         "x": 0.743,
         "y": 0.295
        },
        {
         "id": "kp3",
         "x": 0.515,
         "y": 0.524
        },
        {
         "id": "kp3l",
         "x": 0.743,
         "y": 0.524
        },
        {
         "id": "kp4",
         "x": 0.515,
         "y": 0.753
        },
        {
         "id": "kp4l",
         "x": 0.743,
         "y": 0.753
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-etw-s4-x1.webp",
       "felder": [
        "bwk_ul_pct",
        "bwk_nul_pct"
       ],
       "marken": [
        {
         "id": "bwk_ul_pct",
         "x": 0.024,
         "y": 0.345
        },
        {
         "id": "bwk_nul_pct",
         "x": 0.024,
         "y": 0.641
        }
       ]
      }
     ],
     "mobil": []
    },
    {
     "sec": "s3-tax",
     "auswahl": "Haken „§ 7b Sonder-AfA aktivieren“ gesetzt",
     "felder": [
      {
       "id": "zve",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grenz",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grenz_auto",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_satz",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "geb_ant",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_sonder7b_aktiv",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_sonder7b_eh40",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_baukosten",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_vermietung",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_neubau",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-etw-s3-tax-1.webp",
       "felder": [
        "zve",
        "grenz",
        "grenz_auto",
        "afa_satz",
        "geb_ant",
        "afa_sonder7b_aktiv"
       ],
       "marken": [
        {
         "id": "zve",
         "x": 0.024,
         "y": 0.205
        },
        {
         "id": "grenz",
         "x": 0.497,
         "y": 0.205
        },
        {
         "id": "grenz_auto",
         "x": 0.024,
         "y": 0.285
        },
        {
         "id": "afa_satz",
         "x": 0.024,
         "y": 0.634
        },
        {
         "id": "geb_ant",
         "x": 0.497,
         "y": 0.634
        },
        {
         "id": "afa_sonder7b_aktiv",
         "x": 0.035,
         "y": 0.937
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-etw-s3-tax-x1.webp",
       "felder": [
        "afa_sonder7b_eh40",
        "afa_sonder7b_baukosten",
        "afa_sonder7b_vermietung",
        "afa_sonder7b_neubau"
       ],
       "marken": [
        {
         "id": "afa_sonder7b_eh40",
         "x": 0.043,
         "y": 0.115
        },
        {
         "id": "afa_sonder7b_baukosten",
         "x": 0.043,
         "y": 0.315
        },
        {
         "id": "afa_sonder7b_vermietung",
         "x": 0.043,
         "y": 0.516
        },
        {
         "id": "afa_sonder7b_neubau",
         "x": 0.043,
         "y": 0.716
        }
       ]
      }
     ],
     "mobil": []
    }
   ],
   "wohnungsliste": false,
   "wohnungBilder": []
  },
  {
   "art": "EFH",
   "name": "Einfamilienhaus",
   "beispiel": {
    "nutzungsart": "kapitalanlage",
    "makler_p": "3,57",
    "notar_p": "1,7",
    "gba_p": "0,5",
    "gest_p": "6,5",
    "d1z": "4,31",
    "d1t": "1,5",
    "d1_bindj": "10",
    "zve": "60000",
    "plz": "32052",
    "ort": "Herford",
    "str": "Musterweg",
    "hnr": "5",
    "objart": "EFH",
    "wfl": "140",
    "zimmer": "5",
    "baujahr": "1985",
    "etagen_ges": "2",
    "ds2_zustand": "normal",
    "standardstufe": "3",
    "ds2_energie": "E",
    "gsfl": "650",
    "brw": "210",
    "kp": "365000",
    "nkm": "1250",
    "ze": "60",
    "umlagef": "280",
    "ek": "120261",
    "d1": "295000",
    "grundsteuer": "480",
    "eigen_r": "1800",
    "bgf": "260",
    "nhk_haus": "",
    "thesis": "Freistehendes Haus mit Garten, langfristig vermietet."
   },
   "pflicht": {
    "1": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr"
    ],
    "2": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr",
     "kp",
     "nkm",
     "ds2_zustand",
     "ds2_energie",
     "standardstufe",
     "zimmer"
    ],
    "3": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr",
     "kp",
     "nkm",
     "ds2_zustand",
     "ds2_energie",
     "standardstufe",
     "zimmer",
     "nutzungsart",
     "gsfl",
     "brw",
     "bgf",
     "nhk_haus",
     "nhk_geschosse",
     "nhk_dach"
    ]
   },
   "schritte": [
    {
     "sec": "s0",
     "auswahl": "Haken „Erbbaurecht / Erbpacht“ gesetzt",
     "felder": [
      {
       "id": "plz",
       "nr": 1,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ort",
       "nr": 2,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "str",
       "nr": 3,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hnr",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "objart",
       "nr": 5,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nutzungsart",
       "nr": 6,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wfl",
       "nr": 7,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zimmer",
       "nr": 8,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "baujahr",
       "nr": 9,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "etagen_ges",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_zustand",
       "nr": 11,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "standardstufe",
       "nr": 12,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_energie",
       "nr": 13,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "vermstand",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gsfl",
       "nr": 15,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kuerzel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "thesis",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "risiken",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "exitstr",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kaufdat",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wirtschaftlicher_uebergang",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "halter",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mand_ueberf_cb",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw",
       "nr": 24,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_stichtag",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_walls",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_aussenwand",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_aussenwaende",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_roof",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_dach",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_dach",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_windows",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_fenster",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_fenster",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_heating",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_heizung",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_heizung",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_bath",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_baeder",
       "nr": 39,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_sanitaer",
       "nr": 40,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_floor",
       "nr": 41,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_fussboeden",
       "nr": 42,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_innenausbau",
       "nr": 43,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_innenwaende",
       "nr": 44,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_decken",
       "nr": 45,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_leitungen",
       "nr": 46,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_technik",
       "nr": 47,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_grundriss",
       "nr": 48,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_elevator",
       "nr": 49,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_guest_wc",
       "nr": 50,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_store_room",
       "nr": 51,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bad_anz",
       "nr": 52,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "balkon_flae",
       "nr": 53,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen",
       "nr": 54,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "stellpl_aussen",
       "nr": 55,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "modernis",
       "nr": 56,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "baustatus",
       "nr": 57,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gemarkung",
       "nr": 58,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "flur",
       "nr": 59,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "flurstueck",
       "nr": 60,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_qm",
       "nr": 61,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_eur_qm",
       "nr": 62,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_rentierlich",
       "nr": 63,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "erbpacht",
       "nr": 64,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "lageklasse",
       "nr": 65,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makrolage",
       "nr": 66,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mikrolage",
       "nr": 67,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_bevoelkerung",
       "nr": 68,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_nachfrage",
       "nr": 69,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_wertsteigerung",
       "nr": 70,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_entwicklung",
       "nr": 71,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bankval",
       "nr": 72,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "svwert",
       "nr": 73,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wert_soll",
       "nr": 74,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notizen",
       "nr": 75,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_fertig_jahr",
       "nr": 76,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_vgl_qm",
       "nr": 77,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_soll_qm",
       "nr": 78,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_soll_ab",
       "nr": 79,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_ziel_qm",
       "nr": 80,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_ziel_wann",
       "nr": 81,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bgf",
       "nr": 82,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grundriss",
       "nr": 83,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_punkte",
       "nr": 84,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "sachwertfaktor",
       "nr": 85,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "uk_flaeche",
       "nr": 86,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wgfz_objekt",
       "nr": 87,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "stellplatz_miete_monat",
       "nr": 88,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "sonstige_jahr",
       "nr": 89,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_haus",
       "nr": 90,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_geschosse",
       "nr": 91,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_dach",
       "nr": 92,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen_bgf_qm",
       "nr": 93,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen_stufe",
       "nr": 94,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "aussenanlagen_pct",
       "nr": 95,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "aussenanlagen",
       "nr": 96,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bes_bauteile",
       "nr": 97,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_gauben",
       "nr": 98,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_balkone",
       "nr": 99,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_vordach",
       "nr": 100,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_terrassen",
       "nr": 101,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_sonstige",
       "nr": 102,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "lzs_pct",
       "nr": 103,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_manuell",
       "nr": 104,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_anpassung_pct",
       "nr": 105,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_anpassung_grund",
       "nr": 106,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "erbbauzins",
       "nr": 107,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_restlz",
       "nr": 108,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_zs_ang",
       "nr": 109,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_entsch",
       "nr": 110,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_wert_ist_erb",
       "nr": 111,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [
      {
       "id": "verkehrswert_ueberf",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_preis",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "halter_seit",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "gesellschafterdarlehen",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_restschuld",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_rest_zins",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_ende",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ausst",
       "stufe": 0,
       "grund": "Altfeld, ersetzt durch die Standardstufe (NHK 2010). Die App blendet es nicht mehr ein; gespeicherte Werte bleiben lesbar."
      }
     ],
     "bilder": [
      {
       "datei": "hb-efh-s0-1.webp",
       "felder": [
        "plz",
        "ort",
        "str",
        "hnr",
        "objart",
        "nutzungsart",
        "wfl",
        "zimmer",
        "baujahr",
        "etagen_ges",
        "ds2_zustand",
        "standardstufe",
        "ds2_energie",
        "vermstand",
        "gsfl",
        "kuerzel",
        "thesis"
       ],
       "marken": [
        {
         "id": "plz",
         "x": 0.024,
         "y": 0.0928
        },
        {
         "id": "ort",
         "x": 0.252,
         "y": 0.0928
        },
        {
         "id": "str",
         "x": 0.024,
         "y": 0.1868
        },
        {
         "id": "hnr",
         "x": 0.252,
         "y": 0.1868
        },
        {
         "id": "objart",
         "x": 0.024,
         "y": 0.2808
        },
        {
         "id": "nutzungsart",
         "x": 0.252,
         "y": 0.2808
        },
        {
         "id": "wfl",
         "x": 0.024,
         "y": 0.3758
        },
        {
         "id": "zimmer",
         "x": 0.252,
         "y": 0.3758
        },
        {
         "id": "baujahr",
         "x": 0.024,
         "y": 0.4698
        },
        {
         "id": "etagen_ges",
         "x": 0.252,
         "y": 0.4698
        },
        {
         "id": "ds2_zustand",
         "x": 0.024,
         "y": 0.5638
        },
        {
         "id": "standardstufe",
         "x": 0.252,
         "y": 0.5638
        },
        {
         "id": "ds2_energie",
         "x": 0.024,
         "y": 0.6618
        },
        {
         "id": "vermstand",
         "x": 0.252,
         "y": 0.6618
        },
        {
         "id": "gsfl",
         "x": 0.024,
         "y": 0.7598
        },
        {
         "id": "kuerzel",
         "x": 0.252,
         "y": 0.7598
        },
        {
         "id": "thesis",
         "x": 0.024,
         "y": 0.8548
        }
       ]
      },
      {
       "datei": "hb-efh-s0-2.webp",
       "felder": [
        "risiken",
        "exitstr",
        "kaufdat",
        "wirtschaftlicher_uebergang",
        "halter",
        "mand_ueberf_cb"
       ],
       "marken": [
        {
         "id": "risiken",
         "x": 0.024,
         "y": 0.0481
        },
        {
         "id": "exitstr",
         "x": 0.024,
         "y": 0.2791
        },
        {
         "id": "kaufdat",
         "x": 0.024,
         "y": 0.6031
        },
        {
         "id": "wirtschaftlicher_uebergang",
         "x": 0.252,
         "y": 0.6031
        },
        {
         "id": "halter",
         "x": 0.024,
         "y": 0.7621
        },
        {
         "id": "mand_ueberf_cb",
         "x": 0.024,
         "y": 0.9211
        }
       ]
      },
      {
       "datei": "hb-efh-s0-3.webp",
       "felder": [
        "brw",
        "brw_stichtag"
       ],
       "marken": [
        {
         "id": "brw",
         "x": 0.517,
         "y": 0.2898
        },
        {
         "id": "brw_stichtag",
         "x": 0.517,
         "y": 0.7348
        }
       ]
      },
      {
       "datei": "hb-efh-s0-4.webp",
       "felder": [
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
        "mod_grundriss",
        "eq_elevator",
        "eq_guest_wc",
        "eq_store_room"
       ],
       "marken": [
        {
         "id": "eq_walls",
         "x": 0.23,
         "y": 0.1279
        },
        {
         "id": "mod_aussenwand",
         "x": 0.537,
         "y": 0.1279
        },
        {
         "id": "ausst_aussenwaende",
         "x": 0.762,
         "y": 0.1279
        },
        {
         "id": "eq_roof",
         "x": 0.23,
         "y": 0.188
        },
        {
         "id": "mod_dach",
         "x": 0.537,
         "y": 0.188
        },
        {
         "id": "ausst_dach",
         "x": 0.762,
         "y": 0.188
        },
        {
         "id": "eq_windows",
         "x": 0.23,
         "y": 0.2481
        },
        {
         "id": "mod_fenster",
         "x": 0.537,
         "y": 0.2481
        },
        {
         "id": "ausst_fenster",
         "x": 0.762,
         "y": 0.2481
        },
        {
         "id": "eq_heating",
         "x": 0.23,
         "y": 0.3072
        },
        {
         "id": "mod_heizung",
         "x": 0.537,
         "y": 0.3072
        },
        {
         "id": "ausst_heizung",
         "x": 0.762,
         "y": 0.3072
        },
        {
         "id": "eq_bath",
         "x": 0.23,
         "y": 0.3672
        },
        {
         "id": "mod_baeder",
         "x": 0.537,
         "y": 0.3672
        },
        {
         "id": "ausst_sanitaer",
         "x": 0.762,
         "y": 0.3672
        },
        {
         "id": "eq_floor",
         "x": 0.23,
         "y": 0.4263
        },
        {
         "id": "ausst_fussboeden",
         "x": 0.762,
         "y": 0.4263
        },
        {
         "id": "mod_innenausbau",
         "x": 0.537,
         "y": 0.4864
        },
        {
         "id": "ausst_innenwaende",
         "x": 0.762,
         "y": 0.4864
        },
        {
         "id": "ausst_decken",
         "x": 0.762,
         "y": 0.5464
        },
        {
         "id": "mod_leitungen",
         "x": 0.537,
         "y": 0.6055
        },
        {
         "id": "ausst_technik",
         "x": 0.762,
         "y": 0.6055
        },
        {
         "id": "mod_grundriss",
         "x": 0.537,
         "y": 0.6656
        },
        {
         "id": "eq_elevator",
         "x": 0.024,
         "y": 0.9009
        },
        {
         "id": "eq_guest_wc",
         "x": 0.339,
         "y": 0.9009
        },
        {
         "id": "eq_store_room",
         "x": 0.654,
         "y": 0.9009
        }
       ]
      },
      {
       "datei": "hb-efh-s0-5.webp",
       "felder": [
        "bad_anz",
        "balkon_flae",
        "garagen",
        "stellpl_aussen",
        "modernis",
        "baustatus",
        "gemarkung",
        "flur",
        "flurstueck",
        "hinterland_qm",
        "hinterland_eur_qm",
        "hinterland_rentierlich",
        "erbpacht",
        "lageklasse",
        "makrolage",
        "mikrolage",
        "ds2_bevoelkerung",
        "ds2_nachfrage",
        "ds2_wertsteigerung",
        "ds2_entwicklung"
       ],
       "marken": [
        {
         "id": "bad_anz",
         "x": 0.024,
         "y": 0.1762
        },
        {
         "id": "balkon_flae",
         "x": 0.339,
         "y": 0.1762
        },
        {
         "id": "garagen",
         "x": 0.654,
         "y": 0.1762
        },
        {
         "id": "stellpl_aussen",
         "x": 0.024,
         "y": 0.2622
        },
        {
         "id": "modernis",
         "x": 0.339,
         "y": 0.2622
        },
        {
         "id": "baustatus",
         "x": 0.654,
         "y": 0.2622
        },
        {
         "id": "gemarkung",
         "x": 0.024,
         "y": 0.3492
        },
        {
         "id": "flur",
         "x": 0.339,
         "y": 0.3492
        },
        {
         "id": "flurstueck",
         "x": 0.654,
         "y": 0.3492
        },
        {
         "id": "hinterland_qm",
         "x": 0.024,
         "y": 0.4352
        },
        {
         "id": "hinterland_eur_qm",
         "x": 0.339,
         "y": 0.4352
        },
        {
         "id": "hinterland_rentierlich",
         "x": 0.654,
         "y": 0.4352
        },
        {
         "id": "erbpacht",
         "x": 0.024,
         "y": 0.5282
        },
        {
         "id": "lageklasse",
         "x": 0.024,
         "y": 0.7212
        },
        {
         "id": "makrolage",
         "x": 0.339,
         "y": 0.7212
        },
        {
         "id": "mikrolage",
         "x": 0.654,
         "y": 0.7212
        },
        {
         "id": "ds2_bevoelkerung",
         "x": 0.024,
         "y": 0.8112
        },
        {
         "id": "ds2_nachfrage",
         "x": 0.339,
         "y": 0.8112
        },
        {
         "id": "ds2_wertsteigerung",
         "x": 0.654,
         "y": 0.8112
        },
        {
         "id": "ds2_entwicklung",
         "x": 0.024,
         "y": 0.9012
        }
       ]
      },
      {
       "datei": "hb-efh-s0-6.webp",
       "felder": [
        "bankval",
        "svwert",
        "wert_soll",
        "notizen",
        "zb_fertig_jahr",
        "zb_vgl_qm",
        "zb_soll_qm",
        "zb_soll_ab",
        "zb_ziel_qm",
        "zb_ziel_wann"
       ],
       "marken": [
        {
         "id": "bankval",
         "x": 0.024,
         "y": 0.026
        },
        {
         "id": "svwert",
         "x": 0.339,
         "y": 0.026
        },
        {
         "id": "wert_soll",
         "x": 0.654,
         "y": 0.026
        },
        {
         "id": "notizen",
         "x": 0.515,
         "y": 0.223
        },
        {
         "id": "zb_fertig_jahr",
         "x": 0.024,
         "y": 0.564
        },
        {
         "id": "zb_vgl_qm",
         "x": 0.024,
         "y": 0.707
        },
        {
         "id": "zb_soll_qm",
         "x": 0.339,
         "y": 0.707
        },
        {
         "id": "zb_soll_ab",
         "x": 0.654,
         "y": 0.707
        },
        {
         "id": "zb_ziel_qm",
         "x": 0.024,
         "y": 0.818
        },
        {
         "id": "zb_ziel_wann",
         "x": 0.024,
         "y": 0.904
        }
       ]
      },
      {
       "datei": "hb-efh-s0-7.webp",
       "felder": [
        "bgf",
        "grundriss",
        "mod_punkte",
        "sachwertfaktor",
        "uk_flaeche",
        "wgfz_objekt",
        "stellplatz_miete_monat",
        "sonstige_jahr",
        "nhk_haus",
        "nhk_geschosse",
        "nhk_dach",
        "garagen_bgf_qm",
        "garagen_stufe",
        "aussenanlagen_pct"
       ],
       "marken": [
        {
         "id": "bgf",
         "x": 0.024,
         "y": 0.252
        },
        {
         "id": "grundriss",
         "x": 0.339,
         "y": 0.252
        },
        {
         "id": "mod_punkte",
         "x": 0.654,
         "y": 0.252
        },
        {
         "id": "sachwertfaktor",
         "x": 0.024,
         "y": 0.441
        },
        {
         "id": "uk_flaeche",
         "x": 0.339,
         "y": 0.441
        },
        {
         "id": "wgfz_objekt",
         "x": 0.654,
         "y": 0.441
        },
        {
         "id": "stellplatz_miete_monat",
         "x": 0.024,
         "y": 0.532
        },
        {
         "id": "sonstige_jahr",
         "x": 0.339,
         "y": 0.532
        },
        {
         "id": "nhk_haus",
         "x": 0.024,
         "y": 0.738
        },
        {
         "id": "nhk_geschosse",
         "x": 0.339,
         "y": 0.738
        },
        {
         "id": "nhk_dach",
         "x": 0.654,
         "y": 0.738
        },
        {
         "id": "garagen_bgf_qm",
         "x": 0.024,
         "y": 0.9
        },
        {
         "id": "garagen_stufe",
         "x": 0.339,
         "y": 0.9
        },
        {
         "id": "aussenanlagen_pct",
         "x": 0.654,
         "y": 0.9
        }
       ]
      },
      {
       "datei": "hb-efh-s0-8.webp",
       "felder": [
        "aussenanlagen",
        "bes_bauteile",
        "btl_gauben",
        "btl_balkone",
        "btl_vordach",
        "btl_terrassen",
        "btl_sonstige",
        "lzs_pct",
        "brw_manuell",
        "brw_anpassung_pct",
        "brw_anpassung_grund"
       ],
       "marken": [
        {
         "id": "aussenanlagen",
         "x": 0.024,
         "y": 0.0408
        },
        {
         "id": "bes_bauteile",
         "x": 0.024,
         "y": 0.3178
        },
        {
         "id": "btl_gauben",
         "x": 0.339,
         "y": 0.3178
        },
        {
         "id": "btl_balkone",
         "x": 0.654,
         "y": 0.3178
        },
        {
         "id": "btl_vordach",
         "x": 0.024,
         "y": 0.4488
        },
        {
         "id": "btl_terrassen",
         "x": 0.339,
         "y": 0.4488
        },
        {
         "id": "btl_sonstige",
         "x": 0.654,
         "y": 0.4488
        },
        {
         "id": "lzs_pct",
         "x": 0.024,
         "y": 0.7258
        },
        {
         "id": "brw_manuell",
         "x": 0.339,
         "y": 0.7258
        },
        {
         "id": "brw_anpassung_pct",
         "x": 0.654,
         "y": 0.7258
        },
        {
         "id": "brw_anpassung_grund",
         "x": 0.024,
         "y": 0.8568
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-efh-s0-x1.webp",
       "felder": [
        "erbbauzins",
        "erb_restlz",
        "erb_zs_ang",
        "erb_entsch",
        "erb_wert_ist_erb"
       ],
       "marken": [
        {
         "id": "erbbauzins",
         "x": 0.024,
         "y": 0.103
        },
        {
         "id": "erb_restlz",
         "x": 0.497,
         "y": 0.103
        },
        {
         "id": "erb_zs_ang",
         "x": 0.024,
         "y": 0.458
        },
        {
         "id": "erb_entsch",
         "x": 0.497,
         "y": 0.458
        },
        {
         "id": "erb_wert_ist_erb",
         "x": 0.024,
         "y": 0.812
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-efh-s0-m1.webp",
       "felder": [
        "plz",
        "ort",
        "str",
        "hnr",
        "objart"
       ],
       "marken": [
        {
         "id": "plz",
         "x": 0.425,
         "y": 0.203
        },
        {
         "id": "ort",
         "x": 0.827,
         "y": 0.203
        },
        {
         "id": "str",
         "x": 0.626,
         "y": 0.46
        },
        {
         "id": "hnr",
         "x": 0.827,
         "y": 0.46
        },
        {
         "id": "objart",
         "x": 0.827,
         "y": 0.717
        }
       ]
      },
      {
       "datei": "hb-efh-s0-m2.webp",
       "felder": [
        "nutzungsart",
        "wfl",
        "zimmer"
       ],
       "marken": [
        {
         "id": "nutzungsart",
         "x": 0.827,
         "y": 0.082
        },
        {
         "id": "wfl",
         "x": 0.827,
         "y": 0.378
        },
        {
         "id": "zimmer",
         "x": 0.827,
         "y": 0.674
        }
       ]
      }
     ]
    },
    {
     "sec": "s1",
     "auswahl": "Haken „Inventar erfassen“ gesetzt",
     "felder": [
      {
       "id": "kp",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makler_p",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makler_e",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notar_p",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notar_e",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gba_p",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gba_e",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gest_p",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gest_e",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ji_p",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ji_e",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "san",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "san_ust",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "moebl",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "inv_kueche",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_moebel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_geraete",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_pv",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_stellplatz",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_sonst",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-efh-s1-1.webp",
       "felder": [
        "kp",
        "makler_p",
        "makler_e",
        "notar_p",
        "notar_e",
        "gba_p",
        "gba_e",
        "gest_p",
        "gest_e",
        "ji_p",
        "ji_e",
        "san",
        "san_ust",
        "moebl"
       ],
       "marken": [
        {
         "id": "kp",
         "x": 0.024,
         "y": 0.115
        },
        {
         "id": "makler_p",
         "x": 0.024,
         "y": 0.25
        },
        {
         "id": "makler_e",
         "x": 0.251,
         "y": 0.25
        },
        {
         "id": "notar_p",
         "x": 0.024,
         "y": 0.366
        },
        {
         "id": "notar_e",
         "x": 0.251,
         "y": 0.366
        },
        {
         "id": "gba_p",
         "x": 0.024,
         "y": 0.482
        },
        {
         "id": "gba_e",
         "x": 0.251,
         "y": 0.482
        },
        {
         "id": "gest_p",
         "x": 0.024,
         "y": 0.597
        },
        {
         "id": "gest_e",
         "x": 0.251,
         "y": 0.597
        },
        {
         "id": "ji_p",
         "x": 0.024,
         "y": 0.713
        },
        {
         "id": "ji_e",
         "x": 0.251,
         "y": 0.713
        },
        {
         "id": "san",
         "x": 0.515,
         "y": 0.13
        },
        {
         "id": "san_ust",
         "x": 0.515,
         "y": 0.276
        },
        {
         "id": "moebl",
         "x": 0.515,
         "y": 0.839
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-efh-s1-x1.webp",
       "felder": [
        "inv_kueche",
        "inv_moebel",
        "inv_geraete",
        "inv_pv",
        "inv_stellplatz",
        "inv_sonst"
       ],
       "marken": [
        {
         "id": "inv_kueche",
         "x": 0.515,
         "y": 0.126
        },
        {
         "id": "inv_moebel",
         "x": 0.666,
         "y": 0.126
        },
        {
         "id": "inv_geraete",
         "x": 0.818,
         "y": 0.126
        },
        {
         "id": "inv_pv",
         "x": 0.515,
         "y": 0.534
        },
        {
         "id": "inv_stellplatz",
         "x": 0.666,
         "y": 0.534
        },
        {
         "id": "inv_sonst",
         "x": 0.818,
         "y": 0.534
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-efh-s1-m1.webp",
       "felder": [
        "kp",
        "makler_p"
       ],
       "marken": [
        {
         "id": "kp",
         "x": 0.827,
         "y": 0.257
        },
        {
         "id": "makler_p",
         "x": 0.827,
         "y": 0.643
        }
       ]
      }
     ]
    },
    {
     "sec": "s2",
     "auswahl": "",
     "felder": [
      {
       "id": "nkm",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ze",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "umlagef",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_marktmiete",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_mietausfall",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_art",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_beginn",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_letzte_erhoehung",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_letzte_erhoehung_betrag",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_soll",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_anz",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_int",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_pct",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-efh-s2-1.webp",
       "felder": [
        "nkm",
        "ze",
        "umlagef"
       ],
       "marken": [
        {
         "id": "nkm",
         "x": 0.024,
         "y": 0.245
        },
        {
         "id": "ze",
         "x": 0.024,
         "y": 0.453
        },
        {
         "id": "umlagef",
         "x": 0.024,
         "y": 0.734
        }
       ]
      },
      {
       "datei": "hb-efh-s2-2.webp",
       "felder": [
        "ds2_marktmiete",
        "ds2_mietausfall"
       ],
       "marken": [
        {
         "id": "ds2_marktmiete",
         "x": 0.024,
         "y": 0.112
        },
        {
         "id": "ds2_mietausfall",
         "x": 0.024,
         "y": 0.568
        }
       ]
      },
      {
       "datei": "hb-efh-s2-3.webp",
       "felder": [
        "mv_art",
        "mv_beginn",
        "mv_letzte_erhoehung",
        "mv_letzte_erhoehung_betrag",
        "me_soll",
        "me_anz",
        "me_int",
        "me_pct"
       ],
       "marken": [
        {
         "id": "mv_art",
         "x": 0.515,
         "y": 0.095
        },
        {
         "id": "mv_beginn",
         "x": 0.515,
         "y": 0.176
        },
        {
         "id": "mv_letzte_erhoehung",
         "x": 0.515,
         "y": 0.257
        },
        {
         "id": "mv_letzte_erhoehung_betrag",
         "x": 0.515,
         "y": 0.338
        },
        {
         "id": "me_soll",
         "x": 0.515,
         "y": 0.731
        },
        {
         "id": "me_anz",
         "x": 0.743,
         "y": 0.731
        },
        {
         "id": "me_int",
         "x": 0.515,
         "y": 0.856
        },
        {
         "id": "me_pct",
         "x": 0.743,
         "y": 0.856
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-efh-s2-m1.webp",
       "felder": [
        "nkm",
        "ze"
       ],
       "marken": [
        {
         "id": "nkm",
         "x": 0.827,
         "y": 0.245
        },
        {
         "id": "ze",
         "x": 0.827,
         "y": 0.523
        }
       ]
      }
     ]
    },
    {
     "sec": "s3",
     "auswahl": "Haken „Eigene Anschlussfinanzierung für Darlehen 1“, Art des Darlehens „Tilgungsaussetzungsdarlehen (mit Bausparvertrag)“, Darlehen II „Hinzufügen“ und dessen Anschlussfinanzierung",
     "felder": [
      {
       "id": "bank_inst",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_vertrag",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_vertragsdatum",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_type",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_auszahl",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek_ist_nk",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek_inkl_nk",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1z",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1t",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_bindj",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_anschl_enable",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "anschl_z",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "anschl_t",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "anschl_bj",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_inst",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_vertrag",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_vertragsdatum",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_sum",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_rate",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_quote_min",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_zins",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_dar_z",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_dar_t",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_type",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_inst",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_vertrag",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_bspar",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_auszahl",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_vertragsdatum",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2z",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2t",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_bindj",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_anschl_enable",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_az",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_at",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-efh-s3-1.webp",
       "felder": [
        "bank_inst",
        "d1_vertrag",
        "d1_vertragsdatum",
        "d1_type",
        "d1_auszahl",
        "ek",
        "ek_ist_nk",
        "ek_inkl_nk",
        "d1",
        "d1z",
        "d1t"
       ],
       "marken": [
        {
         "id": "bank_inst",
         "x": 0.024,
         "y": 0.118
        },
        {
         "id": "d1_vertrag",
         "x": 0.251,
         "y": 0.118
        },
        {
         "id": "d1_vertragsdatum",
         "x": 0.024,
         "y": 0.201
        },
        {
         "id": "d1_type",
         "x": 0.024,
         "y": 0.286
        },
        {
         "id": "d1_auszahl",
         "x": 0.251,
         "y": 0.286
        },
        {
         "id": "ek",
         "x": 0.024,
         "y": 0.386
        },
        {
         "id": "ek_ist_nk",
         "x": 0.024,
         "y": 0.466
        },
        {
         "id": "ek_inkl_nk",
         "x": 0.024,
         "y": 0.511
        },
        {
         "id": "d1",
         "x": 0.024,
         "y": 0.553
        },
        {
         "id": "d1z",
         "x": 0.024,
         "y": 0.832
        },
        {
         "id": "d1t",
         "x": 0.251,
         "y": 0.832
        }
       ]
      },
      {
       "datei": "hb-efh-s3-2.webp",
       "felder": [
        "d1_bindj",
        "d1_anschl_enable"
       ],
       "marken": [
        {
         "id": "d1_bindj",
         "x": 0.024,
         "y": 0.0702
        },
        {
         "id": "d1_anschl_enable",
         "x": 0.024,
         "y": 0.8758
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-efh-s3-x1.webp",
       "felder": [
        "anschl_z",
        "anschl_t",
        "anschl_bj",
        "bspar_inst",
        "bspar_vertrag",
        "bspar_vertragsdatum",
        "bspar_sum",
        "bspar_rate",
        "bspar_quote_min",
        "bspar_zins",
        "bspar_dar_z",
        "bspar_dar_t"
       ],
       "marken": [
        {
         "id": "anschl_z",
         "x": 0.024,
         "y": 0.026
        },
        {
         "id": "anschl_t",
         "x": 0.251,
         "y": 0.026
        },
        {
         "id": "anschl_bj",
         "x": 0.251,
         "y": 0.1019
        },
        {
         "id": "bspar_inst",
         "x": 0.024,
         "y": 0.4515
        },
        {
         "id": "bspar_vertrag",
         "x": 0.251,
         "y": 0.4515
        },
        {
         "id": "bspar_vertragsdatum",
         "x": 0.024,
         "y": 0.5404
        },
        {
         "id": "bspar_sum",
         "x": 0.024,
         "y": 0.6163
        },
        {
         "id": "bspar_rate",
         "x": 0.251,
         "y": 0.6163
        },
        {
         "id": "bspar_quote_min",
         "x": 0.024,
         "y": 0.6912
        },
        {
         "id": "bspar_zins",
         "x": 0.251,
         "y": 0.6912
        },
        {
         "id": "bspar_dar_z",
         "x": 0.024,
         "y": 0.873
        },
        {
         "id": "bspar_dar_t",
         "x": 0.251,
         "y": 0.873
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-efh-s3-x2.webp",
       "felder": [
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
       ],
       "marken": [
        {
         "id": "d2_type",
         "x": 0.024,
         "y": 0.0359
        },
        {
         "id": "d2_inst",
         "x": 0.251,
         "y": 0.0359
        },
        {
         "id": "d2_vertrag",
         "x": 0.024,
         "y": 0.1388
        },
        {
         "id": "d2_bspar",
         "x": 0.251,
         "y": 0.1388
        },
        {
         "id": "d2_auszahl",
         "x": 0.024,
         "y": 0.2426
        },
        {
         "id": "d2_vertragsdatum",
         "x": 0.251,
         "y": 0.2426
        },
        {
         "id": "d2",
         "x": 0.024,
         "y": 0.3454
        },
        {
         "id": "d2z",
         "x": 0.024,
         "y": 0.4493
        },
        {
         "id": "d2t",
         "x": 0.251,
         "y": 0.4493
        },
        {
         "id": "d2_bindj",
         "x": 0.024,
         "y": 0.59
        },
        {
         "id": "d2_anschl_enable",
         "x": 0.024,
         "y": 0.7997
        },
        {
         "id": "d2_az",
         "x": 0.024,
         "y": 0.8656
        },
        {
         "id": "d2_at",
         "x": 0.251,
         "y": 0.8656
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-efh-s3-m1.webp",
       "felder": [
        "bank_inst",
        "d1_vertrag"
       ],
       "marken": [
        {
         "id": "bank_inst",
         "x": 0.827,
         "y": 0.394
        },
        {
         "id": "d1_vertrag",
         "x": 0.827,
         "y": 0.682
        }
       ]
      }
     ]
    },
    {
     "sec": "s4",
     "auswahl": "Eingabe-Modus „% der NKM“",
     "felder": [
      {
       "id": "hg_ul",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grundsteuer",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ul_sonst",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hg_nul",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "weg_r",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eigen_r",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mietausfall",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nul_sonst",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp1l",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp2",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp2l",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp3",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp3l",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp4",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp4l",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bwk_ul_pct",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bwk_nul_pct",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [
      {
       "id": "bwk_kp_pct",
       "stufe": 0,
       "grund": "Erscheint im Eingabe-Modus „% der NKM“ erst mit der Unterwahl „% vom Kaufpreis“ und ersetzt dann die beiden NKM-Quoten — es steht nie zusammen mit ihnen im Bild."
      }
     ],
     "bilder": [
      {
       "datei": "hb-efh-s4-1.webp",
       "felder": [
        "hg_ul",
        "grundsteuer",
        "ul_sonst",
        "hg_nul",
        "weg_r",
        "eigen_r",
        "mietausfall"
       ],
       "marken": [
        {
         "id": "hg_ul",
         "x": 0.024,
         "y": 0.089
        },
        {
         "id": "grundsteuer",
         "x": 0.024,
         "y": 0.163
        },
        {
         "id": "ul_sonst",
         "x": 0.024,
         "y": 0.238
        },
        {
         "id": "hg_nul",
         "x": 0.024,
         "y": 0.511
        },
        {
         "id": "weg_r",
         "x": 0.024,
         "y": 0.59
        },
        {
         "id": "eigen_r",
         "x": 0.024,
         "y": 0.825
        },
        {
         "id": "mietausfall",
         "x": 0.024,
         "y": 0.904
        }
       ]
      },
      {
       "datei": "hb-efh-s4-2.webp",
       "felder": [
        "nul_sonst"
       ],
       "marken": [
        {
         "id": "nul_sonst",
         "x": 0.024,
         "y": 0.213
        }
       ]
      },
      {
       "datei": "hb-efh-s4-3.webp",
       "felder": [
        "kp1",
        "kp1l",
        "kp2",
        "kp2l",
        "kp3",
        "kp3l",
        "kp4",
        "kp4l"
       ],
       "marken": [
        {
         "id": "kp1",
         "x": 0.515,
         "y": 0.067
        },
        {
         "id": "kp1l",
         "x": 0.743,
         "y": 0.067
        },
        {
         "id": "kp2",
         "x": 0.515,
         "y": 0.295
        },
        {
         "id": "kp2l",
         "x": 0.743,
         "y": 0.295
        },
        {
         "id": "kp3",
         "x": 0.515,
         "y": 0.524
        },
        {
         "id": "kp3l",
         "x": 0.743,
         "y": 0.524
        },
        {
         "id": "kp4",
         "x": 0.515,
         "y": 0.753
        },
        {
         "id": "kp4l",
         "x": 0.743,
         "y": 0.753
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-efh-s4-x1.webp",
       "felder": [
        "bwk_ul_pct",
        "bwk_nul_pct"
       ],
       "marken": [
        {
         "id": "bwk_ul_pct",
         "x": 0.024,
         "y": 0.4103
        },
        {
         "id": "bwk_nul_pct",
         "x": 0.024,
         "y": 0.7063
        }
       ]
      }
     ],
     "mobil": []
    },
    {
     "sec": "s3-tax",
     "auswahl": "Haken „§ 7b Sonder-AfA aktivieren“ gesetzt",
     "felder": [
      {
       "id": "zve",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grenz",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grenz_auto",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_satz",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "geb_ant",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_sonder7b_aktiv",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_sonder7b_eh40",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_baukosten",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_vermietung",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_neubau",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-efh-s3-tax-1.webp",
       "felder": [
        "zve",
        "grenz",
        "grenz_auto",
        "afa_satz",
        "geb_ant",
        "afa_sonder7b_aktiv"
       ],
       "marken": [
        {
         "id": "zve",
         "x": 0.024,
         "y": 0.205
        },
        {
         "id": "grenz",
         "x": 0.497,
         "y": 0.205
        },
        {
         "id": "grenz_auto",
         "x": 0.024,
         "y": 0.285
        },
        {
         "id": "afa_satz",
         "x": 0.024,
         "y": 0.634
        },
        {
         "id": "geb_ant",
         "x": 0.497,
         "y": 0.634
        },
        {
         "id": "afa_sonder7b_aktiv",
         "x": 0.035,
         "y": 0.937
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-efh-s3-tax-x1.webp",
       "felder": [
        "afa_sonder7b_eh40",
        "afa_sonder7b_baukosten",
        "afa_sonder7b_vermietung",
        "afa_sonder7b_neubau"
       ],
       "marken": [
        {
         "id": "afa_sonder7b_eh40",
         "x": 0.043,
         "y": 0.115
        },
        {
         "id": "afa_sonder7b_baukosten",
         "x": 0.043,
         "y": 0.315
        },
        {
         "id": "afa_sonder7b_vermietung",
         "x": 0.043,
         "y": 0.516
        },
        {
         "id": "afa_sonder7b_neubau",
         "x": 0.043,
         "y": 0.716
        }
       ]
      }
     ],
     "mobil": []
    }
   ],
   "wohnungsliste": false,
   "wohnungBilder": []
  },
  {
   "art": "MFH",
   "name": "Mehrfamilienhaus",
   "beispiel": {
    "nutzungsart": "kapitalanlage",
    "makler_p": "3,57",
    "notar_p": "1,7",
    "gba_p": "0,5",
    "gest_p": "6,5",
    "d1z": "4,31",
    "d1t": "1,5",
    "d1_bindj": "10",
    "zve": "60000",
    "plz": "33613",
    "ort": "Bielefeld",
    "str": "Westerfeldstr.",
    "hnr": "140",
    "objart": "MFH",
    "wfl": "390",
    "baujahr": "1967",
    "etagen_ges": "3",
    "einheiten": "4",
    "ds2_zustand": "normal",
    "standardstufe": "3",
    "ds2_energie": "E",
    "gsfl": "1570",
    "brw": "450",
    "kp": "545000",
    "nkm": "2650",
    "ze": "120",
    "umlagef": "780",
    "ek": "185047",
    "d1": "435000",
    "grundsteuer": "1200",
    "eigen_r": "5200",
    "bgf": "507",
    "thesis": "Vier Wohnungen, Mieten deutlich unter Vergleichsmiete."
   },
   "pflicht": {
    "1": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr"
    ],
    "2": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr",
     "kp",
     "nkm",
     "ds2_zustand",
     "ds2_energie",
     "standardstufe",
     "einheiten"
    ],
    "3": [
     "plz",
     "ort",
     "str",
     "objart",
     "wfl",
     "baujahr",
     "kp",
     "nkm",
     "ds2_zustand",
     "ds2_energie",
     "standardstufe",
     "einheiten",
     "nutzungsart",
     "gsfl",
     "brw",
     "bgf"
    ]
   },
   "schritte": [
    {
     "sec": "s0",
     "auswahl": "Haken „Erbbaurecht / Erbpacht“ gesetzt",
     "felder": [
      {
       "id": "plz",
       "nr": 1,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ort",
       "nr": 2,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "str",
       "nr": 3,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hnr",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "objart",
       "nr": 5,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nutzungsart",
       "nr": 6,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wfl",
       "nr": 7,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "baujahr",
       "nr": 8,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "etagen_ges",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "einheiten",
       "nr": 10,
       "stufe": 2,
       "artPflicht": true,
       "artHinweis": "Beim Mehrfamilienhaus zählt die Zahl der Wohneinheiten, nicht die Zimmer einer einzelnen.",
       "nachAuswahl": false
      },
      {
       "id": "ds2_zustand",
       "nr": 11,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "standardstufe",
       "nr": 12,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_energie",
       "nr": 13,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "vermstand",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gsfl",
       "nr": 15,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kuerzel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "thesis",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "risiken",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "exitstr",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kaufdat",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wirtschaftlicher_uebergang",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "halter",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mand_ueberf_cb",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw",
       "nr": 24,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_stichtag",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_walls",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_aussenwand",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_aussenwaende",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_roof",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_dach",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_dach",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_windows",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_fenster",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_fenster",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_heating",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_heizung",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_heizung",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_bath",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_baeder",
       "nr": 39,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_sanitaer",
       "nr": 40,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_floor",
       "nr": 41,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_fussboeden",
       "nr": 42,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_innenausbau",
       "nr": 43,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_innenwaende",
       "nr": 44,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_decken",
       "nr": 45,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_leitungen",
       "nr": 46,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ausst_technik",
       "nr": 47,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_grundriss",
       "nr": 48,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_elevator",
       "nr": 49,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_guest_wc",
       "nr": 50,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eq_store_room",
       "nr": 51,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "balkon_flae",
       "nr": 52,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen",
       "nr": 53,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "stellpl_aussen",
       "nr": 54,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "modernis",
       "nr": 55,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "baustatus",
       "nr": 56,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gemarkung",
       "nr": 57,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "flur",
       "nr": 58,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "flurstueck",
       "nr": 59,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_qm",
       "nr": 60,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_eur_qm",
       "nr": 61,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hinterland_rentierlich",
       "nr": 62,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "erbpacht",
       "nr": 63,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "lageklasse",
       "nr": 64,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makrolage",
       "nr": 65,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mikrolage",
       "nr": 66,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_bevoelkerung",
       "nr": 67,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_nachfrage",
       "nr": 68,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_wertsteigerung",
       "nr": 69,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_entwicklung",
       "nr": 70,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bankval",
       "nr": 71,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "svwert",
       "nr": 72,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wert_soll",
       "nr": 73,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notizen",
       "nr": 74,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "zb_fertig_jahr",
       "nr": 75,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bgf",
       "nr": 76,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grundriss",
       "nr": 77,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mod_punkte",
       "nr": 78,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "sachwertfaktor",
       "nr": 79,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "uk_flaeche",
       "nr": 80,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "wgfz_objekt",
       "nr": 81,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "stellplatz_miete_monat",
       "nr": 82,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "sonstige_jahr",
       "nr": 83,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_haus",
       "nr": 84,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_geschosse",
       "nr": 85,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nhk_dach",
       "nr": 86,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen_bgf_qm",
       "nr": 87,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "garagen_stufe",
       "nr": 88,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "aussenanlagen_pct",
       "nr": 89,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "aussenanlagen",
       "nr": 90,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bes_bauteile",
       "nr": 91,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_gauben",
       "nr": 92,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_balkone",
       "nr": 93,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_vordach",
       "nr": 94,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_terrassen",
       "nr": 95,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "btl_sonstige",
       "nr": 96,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "lzs_pct",
       "nr": 97,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_manuell",
       "nr": 98,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_anpassung_pct",
       "nr": 99,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "brw_anpassung_grund",
       "nr": 100,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "erbbauzins",
       "nr": 101,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_restlz",
       "nr": 102,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_zs_ang",
       "nr": 103,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_entsch",
       "nr": 104,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "erb_wert_ist_erb",
       "nr": 105,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [
      {
       "id": "verkehrswert_ueberf",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_preis",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "halter_seit",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "gesellschafterdarlehen",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_restschuld",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_rest_zins",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ueberf_ende",
       "stufe": 0,
       "grund": "Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild."
      },
      {
       "id": "ausst",
       "stufe": 0,
       "grund": "Altfeld, ersetzt durch die Standardstufe (NHK 2010). Die App blendet es nicht mehr ein; gespeicherte Werte bleiben lesbar."
      }
     ],
     "bilder": [
      {
       "datei": "hb-mfh-s0-1.webp",
       "felder": [
        "plz",
        "ort",
        "str",
        "hnr",
        "objart",
        "nutzungsart",
        "wfl",
        "baujahr",
        "etagen_ges",
        "einheiten",
        "ds2_zustand",
        "standardstufe",
        "ds2_energie",
        "vermstand",
        "gsfl",
        "kuerzel"
       ],
       "marken": [
        {
         "id": "plz",
         "x": 0.024,
         "y": 0.0909
        },
        {
         "id": "ort",
         "x": 0.252,
         "y": 0.0909
        },
        {
         "id": "str",
         "x": 0.024,
         "y": 0.184
        },
        {
         "id": "hnr",
         "x": 0.252,
         "y": 0.184
        },
        {
         "id": "objart",
         "x": 0.024,
         "y": 0.2771
        },
        {
         "id": "nutzungsart",
         "x": 0.252,
         "y": 0.2771
        },
        {
         "id": "wfl",
         "x": 0.024,
         "y": 0.3702
        },
        {
         "id": "baujahr",
         "x": 0.252,
         "y": 0.3702
        },
        {
         "id": "etagen_ges",
         "x": 0.024,
         "y": 0.5715
        },
        {
         "id": "einheiten",
         "x": 0.252,
         "y": 0.5715
        },
        {
         "id": "ds2_zustand",
         "x": 0.024,
         "y": 0.7056
        },
        {
         "id": "standardstufe",
         "x": 0.252,
         "y": 0.7056
        },
        {
         "id": "ds2_energie",
         "x": 0.024,
         "y": 0.8028
        },
        {
         "id": "vermstand",
         "x": 0.252,
         "y": 0.8028
        },
        {
         "id": "gsfl",
         "x": 0.024,
         "y": 0.8999
        },
        {
         "id": "kuerzel",
         "x": 0.252,
         "y": 0.8999
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-2.webp",
       "felder": [
        "thesis",
        "risiken",
        "exitstr",
        "kaufdat",
        "wirtschaftlicher_uebergang",
        "halter",
        "mand_ueberf_cb"
       ],
       "marken": [
        {
         "id": "thesis",
         "x": 0.024,
         "y": 0.0363
        },
        {
         "id": "risiken",
         "x": 0.024,
         "y": 0.2233
        },
        {
         "id": "exitstr",
         "x": 0.024,
         "y": 0.4113
        },
        {
         "id": "kaufdat",
         "x": 0.024,
         "y": 0.6733
        },
        {
         "id": "wirtschaftlicher_uebergang",
         "x": 0.252,
         "y": 0.6733
        },
        {
         "id": "halter",
         "x": 0.024,
         "y": 0.8033
        },
        {
         "id": "mand_ueberf_cb",
         "x": 0.024,
         "y": 0.9323
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-3.webp",
       "felder": [
        "brw",
        "brw_stichtag"
       ],
       "marken": [
        {
         "id": "brw",
         "x": 0.517,
         "y": 0.2898
        },
        {
         "id": "brw_stichtag",
         "x": 0.517,
         "y": 0.7348
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-4.webp",
       "felder": [
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
        "mod_grundriss",
        "eq_elevator",
        "eq_guest_wc",
        "eq_store_room"
       ],
       "marken": [
        {
         "id": "eq_walls",
         "x": 0.23,
         "y": 0.1279
        },
        {
         "id": "mod_aussenwand",
         "x": 0.537,
         "y": 0.1279
        },
        {
         "id": "ausst_aussenwaende",
         "x": 0.762,
         "y": 0.1279
        },
        {
         "id": "eq_roof",
         "x": 0.23,
         "y": 0.188
        },
        {
         "id": "mod_dach",
         "x": 0.537,
         "y": 0.188
        },
        {
         "id": "ausst_dach",
         "x": 0.762,
         "y": 0.188
        },
        {
         "id": "eq_windows",
         "x": 0.23,
         "y": 0.2481
        },
        {
         "id": "mod_fenster",
         "x": 0.537,
         "y": 0.2481
        },
        {
         "id": "ausst_fenster",
         "x": 0.762,
         "y": 0.2481
        },
        {
         "id": "eq_heating",
         "x": 0.23,
         "y": 0.3072
        },
        {
         "id": "mod_heizung",
         "x": 0.537,
         "y": 0.3072
        },
        {
         "id": "ausst_heizung",
         "x": 0.762,
         "y": 0.3072
        },
        {
         "id": "eq_bath",
         "x": 0.23,
         "y": 0.3672
        },
        {
         "id": "mod_baeder",
         "x": 0.537,
         "y": 0.3672
        },
        {
         "id": "ausst_sanitaer",
         "x": 0.762,
         "y": 0.3672
        },
        {
         "id": "eq_floor",
         "x": 0.23,
         "y": 0.4263
        },
        {
         "id": "ausst_fussboeden",
         "x": 0.762,
         "y": 0.4263
        },
        {
         "id": "mod_innenausbau",
         "x": 0.537,
         "y": 0.4864
        },
        {
         "id": "ausst_innenwaende",
         "x": 0.762,
         "y": 0.4864
        },
        {
         "id": "ausst_decken",
         "x": 0.762,
         "y": 0.5464
        },
        {
         "id": "mod_leitungen",
         "x": 0.537,
         "y": 0.6055
        },
        {
         "id": "ausst_technik",
         "x": 0.762,
         "y": 0.6055
        },
        {
         "id": "mod_grundriss",
         "x": 0.537,
         "y": 0.6656
        },
        {
         "id": "eq_elevator",
         "x": 0.024,
         "y": 0.9009
        },
        {
         "id": "eq_guest_wc",
         "x": 0.339,
         "y": 0.9009
        },
        {
         "id": "eq_store_room",
         "x": 0.654,
         "y": 0.9009
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-5.webp",
       "felder": [
        "balkon_flae",
        "garagen",
        "stellpl_aussen",
        "modernis",
        "baustatus",
        "gemarkung",
        "flur",
        "flurstueck",
        "hinterland_qm",
        "hinterland_eur_qm",
        "hinterland_rentierlich",
        "erbpacht",
        "lageklasse",
        "makrolage",
        "mikrolage",
        "ds2_bevoelkerung",
        "ds2_nachfrage",
        "ds2_wertsteigerung",
        "ds2_entwicklung"
       ],
       "marken": [
        {
         "id": "balkon_flae",
         "x": 0.024,
         "y": 0.1752
        },
        {
         "id": "garagen",
         "x": 0.339,
         "y": 0.1752
        },
        {
         "id": "stellpl_aussen",
         "x": 0.654,
         "y": 0.1752
        },
        {
         "id": "modernis",
         "x": 0.024,
         "y": 0.2613
        },
        {
         "id": "baustatus",
         "x": 0.339,
         "y": 0.2613
        },
        {
         "id": "gemarkung",
         "x": 0.654,
         "y": 0.2613
        },
        {
         "id": "flur",
         "x": 0.024,
         "y": 0.3484
        },
        {
         "id": "flurstueck",
         "x": 0.339,
         "y": 0.3484
        },
        {
         "id": "hinterland_qm",
         "x": 0.654,
         "y": 0.3484
        },
        {
         "id": "hinterland_eur_qm",
         "x": 0.024,
         "y": 0.4345
        },
        {
         "id": "hinterland_rentierlich",
         "x": 0.339,
         "y": 0.4345
        },
        {
         "id": "erbpacht",
         "x": 0.024,
         "y": 0.5276
        },
        {
         "id": "lageklasse",
         "x": 0.024,
         "y": 0.7208
        },
        {
         "id": "makrolage",
         "x": 0.339,
         "y": 0.7208
        },
        {
         "id": "mikrolage",
         "x": 0.654,
         "y": 0.7208
        },
        {
         "id": "ds2_bevoelkerung",
         "x": 0.024,
         "y": 0.811
        },
        {
         "id": "ds2_nachfrage",
         "x": 0.339,
         "y": 0.811
        },
        {
         "id": "ds2_wertsteigerung",
         "x": 0.654,
         "y": 0.811
        },
        {
         "id": "ds2_entwicklung",
         "x": 0.024,
         "y": 0.9011
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-6.webp",
       "felder": [
        "bankval",
        "svwert",
        "wert_soll",
        "notizen",
        "zb_fertig_jahr"
       ],
       "marken": [
        {
         "id": "bankval",
         "x": 0.024,
         "y": 0.0345
        },
        {
         "id": "svwert",
         "x": 0.339,
         "y": 0.0345
        },
        {
         "id": "wert_soll",
         "x": 0.654,
         "y": 0.0345
        },
        {
         "id": "notizen",
         "x": 0.515,
         "y": 0.3119
        },
        {
         "id": "zb_fertig_jahr",
         "x": 0.024,
         "y": 0.8686
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-7.webp",
       "felder": [
        "bgf",
        "grundriss",
        "mod_punkte",
        "sachwertfaktor",
        "uk_flaeche",
        "wgfz_objekt",
        "stellplatz_miete_monat",
        "sonstige_jahr",
        "nhk_haus",
        "nhk_geschosse",
        "nhk_dach",
        "garagen_bgf_qm",
        "garagen_stufe",
        "aussenanlagen_pct"
       ],
       "marken": [
        {
         "id": "bgf",
         "x": 0.024,
         "y": 0.2508
        },
        {
         "id": "grundriss",
         "x": 0.339,
         "y": 0.2508
        },
        {
         "id": "mod_punkte",
         "x": 0.654,
         "y": 0.2508
        },
        {
         "id": "sachwertfaktor",
         "x": 0.024,
         "y": 0.4398
        },
        {
         "id": "uk_flaeche",
         "x": 0.339,
         "y": 0.4398
        },
        {
         "id": "wgfz_objekt",
         "x": 0.654,
         "y": 0.4398
        },
        {
         "id": "stellplatz_miete_monat",
         "x": 0.024,
         "y": 0.5298
        },
        {
         "id": "sonstige_jahr",
         "x": 0.339,
         "y": 0.5298
        },
        {
         "id": "nhk_haus",
         "x": 0.024,
         "y": 0.7358
        },
        {
         "id": "nhk_geschosse",
         "x": 0.339,
         "y": 0.7358
        },
        {
         "id": "nhk_dach",
         "x": 0.654,
         "y": 0.7358
        },
        {
         "id": "garagen_bgf_qm",
         "x": 0.024,
         "y": 0.8988
        },
        {
         "id": "garagen_stufe",
         "x": 0.339,
         "y": 0.8988
        },
        {
         "id": "aussenanlagen_pct",
         "x": 0.654,
         "y": 0.8988
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-8.webp",
       "felder": [
        "aussenanlagen",
        "bes_bauteile",
        "btl_gauben",
        "btl_balkone",
        "btl_vordach",
        "btl_terrassen",
        "btl_sonstige",
        "lzs_pct",
        "brw_manuell",
        "brw_anpassung_pct",
        "brw_anpassung_grund"
       ],
       "marken": [
        {
         "id": "aussenanlagen",
         "x": 0.024,
         "y": 0.0408
        },
        {
         "id": "bes_bauteile",
         "x": 0.024,
         "y": 0.3178
        },
        {
         "id": "btl_gauben",
         "x": 0.339,
         "y": 0.3178
        },
        {
         "id": "btl_balkone",
         "x": 0.654,
         "y": 0.3178
        },
        {
         "id": "btl_vordach",
         "x": 0.024,
         "y": 0.4488
        },
        {
         "id": "btl_terrassen",
         "x": 0.339,
         "y": 0.4488
        },
        {
         "id": "btl_sonstige",
         "x": 0.654,
         "y": 0.4488
        },
        {
         "id": "lzs_pct",
         "x": 0.024,
         "y": 0.7258
        },
        {
         "id": "brw_manuell",
         "x": 0.339,
         "y": 0.7258
        },
        {
         "id": "brw_anpassung_pct",
         "x": 0.654,
         "y": 0.7258
        },
        {
         "id": "brw_anpassung_grund",
         "x": 0.024,
         "y": 0.8568
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-mfh-s0-x1.webp",
       "felder": [
        "erbbauzins",
        "erb_restlz",
        "erb_zs_ang",
        "erb_entsch",
        "erb_wert_ist_erb"
       ],
       "marken": [
        {
         "id": "erbbauzins",
         "x": 0.024,
         "y": 0.103
        },
        {
         "id": "erb_restlz",
         "x": 0.497,
         "y": 0.103
        },
        {
         "id": "erb_zs_ang",
         "x": 0.024,
         "y": 0.458
        },
        {
         "id": "erb_entsch",
         "x": 0.497,
         "y": 0.458
        },
        {
         "id": "erb_wert_ist_erb",
         "x": 0.024,
         "y": 0.812
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-mfh-s0-m1.webp",
       "felder": [
        "plz",
        "ort",
        "str",
        "hnr",
        "objart"
       ],
       "marken": [
        {
         "id": "plz",
         "x": 0.425,
         "y": 0.203
        },
        {
         "id": "ort",
         "x": 0.827,
         "y": 0.203
        },
        {
         "id": "str",
         "x": 0.626,
         "y": 0.46
        },
        {
         "id": "hnr",
         "x": 0.827,
         "y": 0.46
        },
        {
         "id": "objart",
         "x": 0.827,
         "y": 0.717
        }
       ]
      },
      {
       "datei": "hb-mfh-s0-m2.webp",
       "felder": [
        "nutzungsart",
        "wfl"
       ],
       "marken": [
        {
         "id": "nutzungsart",
         "x": 0.827,
         "y": 0.079
        },
        {
         "id": "wfl",
         "x": 0.827,
         "y": 0.366
        }
       ]
      }
     ]
    },
    {
     "sec": "s1",
     "auswahl": "Haken „Inventar erfassen“ gesetzt",
     "felder": [
      {
       "id": "kp",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makler_p",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "makler_e",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notar_p",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "notar_e",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gba_p",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gba_e",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gest_p",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "gest_e",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ji_p",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ji_e",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "san",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "san_ust",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "moebl",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "inv_kueche",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_moebel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_geraete",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_pv",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_stellplatz",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "inv_sonst",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-mfh-s1-1.webp",
       "felder": [
        "kp",
        "makler_p",
        "makler_e",
        "notar_p",
        "notar_e",
        "gba_p",
        "gba_e",
        "gest_p",
        "gest_e",
        "ji_p",
        "ji_e",
        "san",
        "san_ust",
        "moebl"
       ],
       "marken": [
        {
         "id": "kp",
         "x": 0.024,
         "y": 0.115
        },
        {
         "id": "makler_p",
         "x": 0.024,
         "y": 0.25
        },
        {
         "id": "makler_e",
         "x": 0.251,
         "y": 0.25
        },
        {
         "id": "notar_p",
         "x": 0.024,
         "y": 0.366
        },
        {
         "id": "notar_e",
         "x": 0.251,
         "y": 0.366
        },
        {
         "id": "gba_p",
         "x": 0.024,
         "y": 0.482
        },
        {
         "id": "gba_e",
         "x": 0.251,
         "y": 0.482
        },
        {
         "id": "gest_p",
         "x": 0.024,
         "y": 0.597
        },
        {
         "id": "gest_e",
         "x": 0.251,
         "y": 0.597
        },
        {
         "id": "ji_p",
         "x": 0.024,
         "y": 0.713
        },
        {
         "id": "ji_e",
         "x": 0.251,
         "y": 0.713
        },
        {
         "id": "san",
         "x": 0.515,
         "y": 0.13
        },
        {
         "id": "san_ust",
         "x": 0.515,
         "y": 0.276
        },
        {
         "id": "moebl",
         "x": 0.515,
         "y": 0.839
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-mfh-s1-x1.webp",
       "felder": [
        "inv_kueche",
        "inv_moebel",
        "inv_geraete",
        "inv_pv",
        "inv_stellplatz",
        "inv_sonst"
       ],
       "marken": [
        {
         "id": "inv_kueche",
         "x": 0.515,
         "y": 0.126
        },
        {
         "id": "inv_moebel",
         "x": 0.666,
         "y": 0.126
        },
        {
         "id": "inv_geraete",
         "x": 0.818,
         "y": 0.126
        },
        {
         "id": "inv_pv",
         "x": 0.515,
         "y": 0.534
        },
        {
         "id": "inv_stellplatz",
         "x": 0.666,
         "y": 0.534
        },
        {
         "id": "inv_sonst",
         "x": 0.818,
         "y": 0.534
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-mfh-s1-m1.webp",
       "felder": [
        "kp",
        "makler_p"
       ],
       "marken": [
        {
         "id": "kp",
         "x": 0.827,
         "y": 0.257
        },
        {
         "id": "makler_p",
         "x": 0.827,
         "y": 0.643
        }
       ]
      }
     ]
    },
    {
     "sec": "s2",
     "auswahl": "",
     "felder": [
      {
       "id": "nkm",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ze",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "umlagef",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_marktmiete",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ds2_mietausfall",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_art",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_beginn",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_letzte_erhoehung",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mv_letzte_erhoehung_betrag",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_soll",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_anz",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_int",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "me_pct",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-mfh-s2-1.webp",
       "felder": [
        "nkm",
        "ze",
        "umlagef"
       ],
       "marken": [
        {
         "id": "nkm",
         "x": 0.024,
         "y": 0.245
        },
        {
         "id": "ze",
         "x": 0.024,
         "y": 0.453
        },
        {
         "id": "umlagef",
         "x": 0.024,
         "y": 0.734
        }
       ]
      },
      {
       "datei": "hb-mfh-s2-2.webp",
       "felder": [
        "ds2_marktmiete",
        "ds2_mietausfall"
       ],
       "marken": [
        {
         "id": "ds2_marktmiete",
         "x": 0.024,
         "y": 0.112
        },
        {
         "id": "ds2_mietausfall",
         "x": 0.024,
         "y": 0.568
        }
       ]
      },
      {
       "datei": "hb-mfh-s2-3.webp",
       "felder": [
        "mv_art",
        "mv_beginn",
        "mv_letzte_erhoehung",
        "mv_letzte_erhoehung_betrag",
        "me_soll",
        "me_anz",
        "me_int",
        "me_pct"
       ],
       "marken": [
        {
         "id": "mv_art",
         "x": 0.515,
         "y": 0.092
        },
        {
         "id": "mv_beginn",
         "x": 0.515,
         "y": 0.17
        },
        {
         "id": "mv_letzte_erhoehung",
         "x": 0.515,
         "y": 0.247
        },
        {
         "id": "mv_letzte_erhoehung_betrag",
         "x": 0.515,
         "y": 0.325
        },
        {
         "id": "me_soll",
         "x": 0.515,
         "y": 0.741
        },
        {
         "id": "me_anz",
         "x": 0.743,
         "y": 0.741
        },
        {
         "id": "me_int",
         "x": 0.515,
         "y": 0.861
        },
        {
         "id": "me_pct",
         "x": 0.743,
         "y": 0.861
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-mfh-s2-m1.webp",
       "felder": [
        "nkm",
        "ze"
       ],
       "marken": [
        {
         "id": "nkm",
         "x": 0.827,
         "y": 0.245
        },
        {
         "id": "ze",
         "x": 0.827,
         "y": 0.523
        }
       ]
      }
     ]
    },
    {
     "sec": "s3",
     "auswahl": "Haken „Eigene Anschlussfinanzierung für Darlehen 1“, Art des Darlehens „Tilgungsaussetzungsdarlehen (mit Bausparvertrag)“, Darlehen II „Hinzufügen“ und dessen Anschlussfinanzierung",
     "felder": [
      {
       "id": "bank_inst",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_vertrag",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_vertragsdatum",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_type",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_auszahl",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek_ist_nk",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ek_inkl_nk",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1z",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1t",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_bindj",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "d1_anschl_enable",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "anschl_z",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "anschl_t",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "anschl_bj",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_inst",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_vertrag",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_vertragsdatum",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_sum",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_rate",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_quote_min",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_zins",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_dar_z",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bspar_dar_t",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_type",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_inst",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_vertrag",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_bspar",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_auszahl",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_vertragsdatum",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2z",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2t",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_bindj",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_anschl_enable",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_az",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "d2_at",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-mfh-s3-1.webp",
       "felder": [
        "bank_inst",
        "d1_vertrag",
        "d1_vertragsdatum",
        "d1_type",
        "d1_auszahl",
        "ek",
        "ek_ist_nk",
        "ek_inkl_nk",
        "d1",
        "d1z",
        "d1t"
       ],
       "marken": [
        {
         "id": "bank_inst",
         "x": 0.024,
         "y": 0.121
        },
        {
         "id": "d1_vertrag",
         "x": 0.251,
         "y": 0.121
        },
        {
         "id": "d1_vertragsdatum",
         "x": 0.024,
         "y": 0.206
        },
        {
         "id": "d1_type",
         "x": 0.024,
         "y": 0.294
        },
        {
         "id": "d1_auszahl",
         "x": 0.251,
         "y": 0.294
        },
        {
         "id": "ek",
         "x": 0.024,
         "y": 0.397
        },
        {
         "id": "ek_ist_nk",
         "x": 0.024,
         "y": 0.48
        },
        {
         "id": "ek_inkl_nk",
         "x": 0.024,
         "y": 0.526
        },
        {
         "id": "d1",
         "x": 0.024,
         "y": 0.569
        },
        {
         "id": "d1z",
         "x": 0.024,
         "y": 0.856
        },
        {
         "id": "d1t",
         "x": 0.251,
         "y": 0.856
        }
       ]
      },
      {
       "datei": "hb-mfh-s3-2.webp",
       "felder": [
        "d1_bindj",
        "d1_anschl_enable"
       ],
       "marken": [
        {
         "id": "d1_bindj",
         "x": 0.024,
         "y": 0.0702
        },
        {
         "id": "d1_anschl_enable",
         "x": 0.024,
         "y": 0.8758
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-mfh-s3-x1.webp",
       "felder": [
        "anschl_z",
        "anschl_t",
        "anschl_bj",
        "bspar_inst",
        "bspar_vertrag",
        "bspar_vertragsdatum",
        "bspar_sum",
        "bspar_rate",
        "bspar_quote_min",
        "bspar_zins",
        "bspar_dar_z",
        "bspar_dar_t"
       ],
       "marken": [
        {
         "id": "anschl_z",
         "x": 0.024,
         "y": 0.0248
        },
        {
         "id": "anschl_t",
         "x": 0.251,
         "y": 0.0248
        },
        {
         "id": "anschl_bj",
         "x": 0.251,
         "y": 0.1008
        },
        {
         "id": "bspar_inst",
         "x": 0.024,
         "y": 0.4508
        },
        {
         "id": "bspar_vertrag",
         "x": 0.251,
         "y": 0.4508
        },
        {
         "id": "bspar_vertragsdatum",
         "x": 0.024,
         "y": 0.5398
        },
        {
         "id": "bspar_sum",
         "x": 0.024,
         "y": 0.6158
        },
        {
         "id": "bspar_rate",
         "x": 0.251,
         "y": 0.6158
        },
        {
         "id": "bspar_quote_min",
         "x": 0.024,
         "y": 0.6908
        },
        {
         "id": "bspar_zins",
         "x": 0.251,
         "y": 0.6908
        },
        {
         "id": "bspar_dar_z",
         "x": 0.024,
         "y": 0.8728
        },
        {
         "id": "bspar_dar_t",
         "x": 0.251,
         "y": 0.8728
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-mfh-s3-x2.webp",
       "felder": [
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
       ],
       "marken": [
        {
         "id": "d2_type",
         "x": 0.024,
         "y": 0.0344
        },
        {
         "id": "d2_inst",
         "x": 0.251,
         "y": 0.0344
        },
        {
         "id": "d2_vertrag",
         "x": 0.024,
         "y": 0.1374
        },
        {
         "id": "d2_bspar",
         "x": 0.251,
         "y": 0.1374
        },
        {
         "id": "d2_auszahl",
         "x": 0.024,
         "y": 0.2414
        },
        {
         "id": "d2_vertragsdatum",
         "x": 0.251,
         "y": 0.2414
        },
        {
         "id": "d2",
         "x": 0.024,
         "y": 0.3444
        },
        {
         "id": "d2z",
         "x": 0.024,
         "y": 0.4484
        },
        {
         "id": "d2t",
         "x": 0.251,
         "y": 0.4484
        },
        {
         "id": "d2_bindj",
         "x": 0.024,
         "y": 0.5894
        },
        {
         "id": "d2_anschl_enable",
         "x": 0.024,
         "y": 0.7994
        },
        {
         "id": "d2_az",
         "x": 0.024,
         "y": 0.8654
        },
        {
         "id": "d2_at",
         "x": 0.251,
         "y": 0.8654
        }
       ]
      }
     ],
     "mobil": [
      {
       "datei": "hb-mfh-s3-m1.webp",
       "felder": [
        "bank_inst",
        "d1_vertrag"
       ],
       "marken": [
        {
         "id": "bank_inst",
         "x": 0.827,
         "y": 0.394
        },
        {
         "id": "d1_vertrag",
         "x": 0.827,
         "y": 0.682
        }
       ]
      }
     ]
    },
    {
     "sec": "s4",
     "auswahl": "Eingabe-Modus „% der NKM“",
     "felder": [
      {
       "id": "hg_ul",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grundsteuer",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "ul_sonst",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "hg_nul",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "weg_r",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "eigen_r",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "mietausfall",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "nul_sonst",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp1l",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp2",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp2l",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp3",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp3l",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp4",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "kp4l",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "bwk_ul_pct",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "bwk_nul_pct",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [
      {
       "id": "bwk_kp_pct",
       "stufe": 0,
       "grund": "Erscheint im Eingabe-Modus „% der NKM“ erst mit der Unterwahl „% vom Kaufpreis“ und ersetzt dann die beiden NKM-Quoten — es steht nie zusammen mit ihnen im Bild."
      }
     ],
     "bilder": [
      {
       "datei": "hb-mfh-s4-1.webp",
       "felder": [
        "hg_ul",
        "grundsteuer",
        "ul_sonst",
        "hg_nul",
        "weg_r",
        "eigen_r",
        "mietausfall"
       ],
       "marken": [
        {
         "id": "hg_ul",
         "x": 0.024,
         "y": 0.089
        },
        {
         "id": "grundsteuer",
         "x": 0.024,
         "y": 0.163
        },
        {
         "id": "ul_sonst",
         "x": 0.024,
         "y": 0.238
        },
        {
         "id": "hg_nul",
         "x": 0.024,
         "y": 0.511
        },
        {
         "id": "weg_r",
         "x": 0.024,
         "y": 0.59
        },
        {
         "id": "eigen_r",
         "x": 0.024,
         "y": 0.825
        },
        {
         "id": "mietausfall",
         "x": 0.024,
         "y": 0.904
        }
       ]
      },
      {
       "datei": "hb-mfh-s4-2.webp",
       "felder": [
        "nul_sonst"
       ],
       "marken": [
        {
         "id": "nul_sonst",
         "x": 0.024,
         "y": 0.213
        }
       ]
      },
      {
       "datei": "hb-mfh-s4-3.webp",
       "felder": [
        "kp1",
        "kp1l",
        "kp2",
        "kp2l",
        "kp3",
        "kp3l",
        "kp4",
        "kp4l"
       ],
       "marken": [
        {
         "id": "kp1",
         "x": 0.515,
         "y": 0.067
        },
        {
         "id": "kp1l",
         "x": 0.743,
         "y": 0.067
        },
        {
         "id": "kp2",
         "x": 0.515,
         "y": 0.295
        },
        {
         "id": "kp2l",
         "x": 0.743,
         "y": 0.295
        },
        {
         "id": "kp3",
         "x": 0.515,
         "y": 0.524
        },
        {
         "id": "kp3l",
         "x": 0.743,
         "y": 0.524
        },
        {
         "id": "kp4",
         "x": 0.515,
         "y": 0.753
        },
        {
         "id": "kp4l",
         "x": 0.743,
         "y": 0.753
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-mfh-s4-x1.webp",
       "felder": [
        "bwk_ul_pct",
        "bwk_nul_pct"
       ],
       "marken": [
        {
         "id": "bwk_ul_pct",
         "x": 0.024,
         "y": 0.4103
        },
        {
         "id": "bwk_nul_pct",
         "x": 0.024,
         "y": 0.7063
        }
       ]
      }
     ],
     "mobil": []
    },
    {
     "sec": "s3-tax",
     "auswahl": "Haken „§ 7b Sonder-AfA aktivieren“ gesetzt",
     "felder": [
      {
       "id": "zve",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grenz",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "grenz_auto",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_satz",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "geb_ant",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_sonder7b_aktiv",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": false
      },
      {
       "id": "afa_sonder7b_eh40",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_baukosten",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_vermietung",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      },
      {
       "id": "afa_sonder7b_neubau",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": "",
       "nachAuswahl": true
      }
     ],
     "weitere": [],
     "bilder": [
      {
       "datei": "hb-mfh-s3-tax-1.webp",
       "felder": [
        "zve",
        "grenz",
        "grenz_auto",
        "afa_satz",
        "geb_ant",
        "afa_sonder7b_aktiv"
       ],
       "marken": [
        {
         "id": "zve",
         "x": 0.024,
         "y": 0.205
        },
        {
         "id": "grenz",
         "x": 0.497,
         "y": 0.205
        },
        {
         "id": "grenz_auto",
         "x": 0.024,
         "y": 0.285
        },
        {
         "id": "afa_satz",
         "x": 0.024,
         "y": 0.634
        },
        {
         "id": "geb_ant",
         "x": 0.497,
         "y": 0.634
        },
        {
         "id": "afa_sonder7b_aktiv",
         "x": 0.035,
         "y": 0.937
        }
       ]
      },
      {
       "nachAuswahl": true,
       "datei": "hb-mfh-s3-tax-x1.webp",
       "felder": [
        "afa_sonder7b_eh40",
        "afa_sonder7b_baukosten",
        "afa_sonder7b_vermietung",
        "afa_sonder7b_neubau"
       ],
       "marken": [
        {
         "id": "afa_sonder7b_eh40",
         "x": 0.043,
         "y": 0.115
        },
        {
         "id": "afa_sonder7b_baukosten",
         "x": 0.043,
         "y": 0.315
        },
        {
         "id": "afa_sonder7b_vermietung",
         "x": 0.043,
         "y": 0.516
        },
        {
         "id": "afa_sonder7b_neubau",
         "x": 0.043,
         "y": 0.716
        }
       ]
      }
     ],
     "mobil": []
    }
   ],
   "wohnungsliste": true,
   "wohnungBilder": [
    {
     "datei": "hb-mfh-wohnungen-1.webp",
     "unterschrift": "Einheiten erfassen · Schritt 2 „Einheiten“ mit vier Wohnungen"
    },
    {
     "datei": "hb-mfh-wohnungen-2.webp",
     "unterschrift": "Details einer Wohnung · Stammdaten und Mietvertrag"
    },
    {
     "datei": "hb-mfh-wohnungen-3.webp",
     "unterschrift": "Details einer Wohnung · Soll-Miete, Zielbild und Ertragswert"
    }
   ]
  }
 ],
 "wohnungsliste": {
  "schritte": [
   {
    "titel": "Gebäude",
    "text": "die vier gemeinsamen Gewerke (Dach, Außenwand, Leitungen, Heizung) und die Vorgabe für die vier wohnungsbezogenen — sie gilt für JEDE Einheit, bis eine Einheit widerspricht (Vererbung)."
   },
   {
    "titel": "Einheiten",
    "text": "Hier nur das Nötigste. Details öffnet die Wohnung: Mietvertrag, Soll-Miete (Mieter bleibt), Zielbild mit Maßnahmen und den Ertragswert. Ähnliche Wohnungen mit ⧉ duplizieren. Übernommen werden Fläche, Einheitenzahl und Ist-Kaltmiete der vermieteten Einheiten."
   },
   {
    "titel": "Zustand je Einheit",
    "text": "je Einheit Fenster, Bäder, Innenausbau, Grundriss; Vorgabe ist „wie Gebäude“."
   },
   {
    "titel": "Ergebnis",
    "text": "Punkte und Restnutzungsdauer je Einheit, flächengewichtet aufs Gebäude, Übernahme ins Objekt."
   }
  ],
  "einstieg": "Hier nur das Nötigste. Details öffnet die Wohnung: Mietvertrag, Soll-Miete (Mieter bleibt), Zielbild mit Maßnahmen und den Ertragswert. Ähnliche Wohnungen mit ⧉ duplizieren. Übernommen werden Fläche, Einheitenzahl und Ist-Kaltmiete der vermieteten Einheiten.",
  "spalten": [
   "Nr.",
   "Lage",
   "m²",
   "Zi.",
   "Ist-Miete",
   "Status"
  ],
  "felder": [
   {
    "key": "nr",
    "label": "Nummer",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "lage",
    "label": "Lage im Haus",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": "EG links"
   },
   {
    "key": "art",
    "label": "Art",
    "block": "Stammdaten",
    "typ": "auswahl",
    "platzhalter": ""
   },
   {
    "key": "wfl",
    "label": "Wohnfläche (m²)",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "zimmer",
    "label": "Zimmer",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "etage",
    "label": "Etage",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": "z. B. 2. OG"
   },
   {
    "key": "balkon_qm",
    "label": "Balkon/Terrasse (m²)",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "keller",
    "label": "Keller / Abstellraum",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": "z. B. Kellerabteil 4"
   },
   {
    "key": "stellplatz",
    "label": "Stellplatz / Garage",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": "z. B. TG-Platz 7"
   },
   {
    "key": "zustand",
    "label": "Gesamtzustand",
    "block": "Stammdaten",
    "typ": "auswahl",
    "platzhalter": ""
   },
   {
    "key": "mea_anteil",
    "label": "Miteigentumsanteil (z. B. 125 von 1000)",
    "block": "Stammdaten",
    "typ": "eingabe",
    "platzhalter": "optional"
   },
   {
    "key": "nutzung_gew",
    "label": "Nutzungsart",
    "block": "Gewerbe",
    "typ": "auswahl",
    "platzhalter": ""
   },
   {
    "key": "markt_qm",
    "label": "Marktübliche Miete (€/m² · Monat)",
    "block": "Gewerbe",
    "typ": "eingabe",
    "platzhalter": "optional"
   },
   {
    "key": "ist",
    "label": "Ist-Kaltmiete (€/Monat)",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "status",
    "label": "Status",
    "block": "Mietvertrag · Ist",
    "typ": "auswahl",
    "platzhalter": ""
   },
   {
    "key": "nk_vorauszahlung",
    "label": "NK-Vorauszahlung (€/Monat)",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "stellplatz_miete",
    "label": "Stellplatzmiete (€/Monat)",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "mv_art",
    "label": "Vertragsart",
    "block": "Mietvertrag · Ist",
    "typ": "auswahl",
    "platzhalter": ""
   },
   {
    "key": "mv_beginn",
    "label": "Mietbeginn",
    "block": "Mietvertrag · Ist",
    "typ": "datum",
    "platzhalter": ""
   },
   {
    "key": "mv_letzte_erhoehung",
    "label": "Letzte Erhöhung",
    "block": "Mietvertrag · Ist",
    "typ": "datum",
    "platzhalter": ""
   },
   {
    "key": "mv_letzte_erhoehung_betrag",
    "label": "Letzte Erhöhung um (€/Monat)",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": "für die Kappungsgrenze"
   },
   {
    "key": "mv_naechste_anpassung",
    "label": "Nächste Anpassung (Staffel/Index)",
    "block": "Mietvertrag · Ist",
    "typ": "datum",
    "platzhalter": ""
   },
   {
    "key": "mv_kaution",
    "label": "Kaution (€)",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "mv_befristet_bis",
    "label": "Befristet bis",
    "block": "Mietvertrag · Ist",
    "typ": "datum",
    "platzhalter": ""
   },
   {
    "key": "mv_kuendigungsverzicht_bis",
    "label": "Kündigungsverzicht bis",
    "block": "Mietvertrag · Ist",
    "typ": "datum",
    "platzhalter": ""
   },
   {
    "key": "mv_mieter",
    "label": "Mieter (Name, optional)",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "mv_notiz",
    "label": "Notiz zum Vertrag",
    "block": "Mietvertrag · Ist",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "mv_erhoehung_art",
    "label": "Erhöhung angeben als",
    "block": "Geplante Erhöhungen",
    "typ": "auswahl",
    "platzhalter": ""
   },
   {
    "key": "mv_erhoehung_wert",
    "label": "Nächste Erhöhung (Höhe)",
    "block": "Geplante Erhöhungen",
    "typ": "eingabe",
    "platzhalter": "z. B. 3 oder 45"
   },
   {
    "key": "mv_rhythmus_jahre",
    "label": "Rhythmus (alle … Jahre)",
    "block": "Geplante Erhöhungen",
    "typ": "eingabe",
    "platzhalter": "z. B. 2"
   },
   {
    "key": "mv_stufen_offen",
    "label": "Noch offene Stufen",
    "block": "Geplante Erhöhungen",
    "typ": "eingabe",
    "platzhalter": "z. B. 3"
   },
   {
    "key": "vgl_qm",
    "label": "Vergleichsmiete €/m² (Mietspiegel)",
    "block": "Soll-Miete (Mieter bleibt) kann, nicht muss",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "soll",
    "label": "Soll-Miete (€/Monat, eigene Angabe)",
    "block": "Soll-Miete (Mieter bleibt) kann, nicht muss",
    "typ": "eingabe",
    "platzhalter": ""
   },
   {
    "key": "soll_ab",
    "label": "Erreichbar ab (eigene Angabe)",
    "block": "Soll-Miete (Mieter bleibt) kann, nicht muss",
    "typ": "datum",
    "platzhalter": ""
   },
   {
    "key": "ziel_qm",
    "label": "Zielmiete (€/m²)",
    "block": "Zielbild · nach Umbau kann, nicht muss",
    "typ": "eingabe",
    "platzhalter": "z. B. 9,20"
   },
   {
    "key": "ziel_wann",
    "label": "Wann",
    "block": "Zielbild · nach Umbau kann, nicht muss",
    "typ": "eingabe",
    "platzhalter": "z. B. bei Mieterwechsel"
   }
  ],
  "hinweise": [
   "Die Fläche gilt hier als Nutzfläche. Für den Ertragswert zählt die marktübliche Miete (§ 31 Abs. 2 ImmoWertV). Fehlt sie, setzt der Marktbericht die Ist-Miete an und kennzeichnet das Ergebnis als indikativ.",
   "Staffel- und Indexmiete tragen ihre nächste Erhöhung schon im Vertrag — sie sind ein Termin, kein Potenzial. Kündigungsverzicht heißt: beide Seiten verzichten bis zu diesem Datum auf die ordentliche Kündigung (bei Staffelmiete höchstens vier Jahre, § 557a Abs. 3 BGB).",
   "Höchstens … Bilder je Wohnung, automatisch verkleinert."
  ],
  "hilfe": [
   {
    "titel": "Drei Mieten je Wohnung",
    "text": "<strong>Ist</strong> ist, was heute gezahlt wird. Die <strong>Soll-Miete (Mieter bleibt)</strong> ist, was der jetzige Mieter nach normalen Mieterhöhungen zahlt. Das <strong>Zielbild</strong> ist, was nach deinem Umbau oder bei einem Mieterwechsel drin ist. Beides ist freiwillig — ohne Angaben ändert sich nichts."
   },
   {
    "titel": "Wo du es einträgst",
    "text": "Bei ETW, EFH und ZFH im Reiter Objekt, Karte „Mieterhöhung und Zielbild (optional)“. Beim Mehrfamilienhaus je Wohnung: „Einheiten erfassen“ → in der Liste <strong>Details</strong> → Blöcke Mietvertrag, Soll-Miete, Zielbild und Ertragswert. Die Karte im Reiter Objekt zeigt dann nur die Summe aus den Wohnungen. Eingetragen wird im laufenden Objekt (Bestand), nicht im eingefrorenen Ankauf-Stand. Auch die geführte Eingabe und die Spracheingabe fragen freiwillig danach."
   },
   {
    "titel": "Wie DealPilot die Soll-Miete vorrechnet",
    "text": "Ohne eigene Angabe: bis zur ortsüblichen Vergleichsmiete (§ 558 BGB; Vergleichsmiete an der Wohnung, sonst die Marktmiete aus dem Reiter Miete), frühestens 15 Monate nach der letzten Erhöhung, höchstens um die Kappungsgrenze — 15 % in drei Jahren, wo die Gemeinde in der Landesverordnung steht, sonst 20 %. Ist die Gemeinde unbekannt oder die Verordnung ausgelaufen, steht 20 % mit dem Hinweis, es zu prüfen. Eine Maßnahme mit Haken „bewohnt (§ 559)“ erhöht die Soll-Miete um 8 % der Kosten im Jahr, gedeckelt auf 3 €/m² (2 €/m² unter 7 €/m²) in sechs Jahren. Deine eigene Angabe überschreibt immer."
   },
   {
    "titel": "Maßnahmen und Restnutzungsdauer",
    "text": "Maßnahmen wählst du als Chips mit Kosten. Bad, Fenster, Böden/Innenausbau und Grundriss tragen Modernisierungspunkte nach Anlage 2 ImmoWertV — höchstens bis zum Maximum des Gewerks. Dach, Fassade, Heizung und Leitungen gehören dem ganzen Haus. Mieterhöhung und Zielbild rechnen mit der Restnutzungsdauer nach diesen Punkten, der Bestand mit der heutigen."
   },
   {
    "titel": "Ertragswert je Stufe und Aufteilung",
    "text": "DealPilot rechnet den Ertragswert für Bestand, Mieterhöhung und Zielbild mit demselben Rechenkern und denselben Ansätzen wie der Marktbericht Stufe 3 (Liegenschaftszins, Bewirtschaftung, Bodenwert); je Stufe wechseln nur Miete und Restnutzungsdauer. Kein Kontingent. Beim MFH zusätzlich je Wohnung — als Anteil am Haus oder, mit dem Haken „aufgeteilt“, als Eigentumswohnung mit dem Zins für Wohnungseigentum. Die Summe nach Aufteilung steht dem Haus als Ganzes gegenüber, abzüglich der Kosten der Aufteilung (Vorbelegung 1.800 € je Wohnung, eigene Angabe möglich). Alles ist ein <strong>Potenzialwert nach Mieterhöhung bzw. Zielbild, keine Verkehrswertermittlung</strong>."
   },
   {
    "titel": "Wo es erscheint — und wo nicht",
    "text": "In der Pilot-Analyse (Reiter „Ankauf · Bestand · Zielbild“ mit einem Absatz des Piloten), in beiden PDFs (Seite „Wertpotenzial“) und im Portfolio-Pilot („Wo steckt das meiste Potenzial?“). Die Mietentwicklung im Modus „Aus Wohnungen“ rechnet ab „erreichbar“ mit der Soll-Miete, das Zielbild nicht. Score, Verkehrswert und Marktbericht bleiben beim Bestand."
   }
  ]
 },
 "auffaellig": [],
 "aufnahme": {
  "am": "2026-10-21",
  "ansicht": {
   "breite": 2133,
   "hoehe": 987,
   "hinweis": "Desktop, Eingabetiefe 3, weitere Objektdetails an"
  }
 },
 "ablaeufe": [
  {
   "id": "einrichten",
   "titel": "Vor dem ersten Flug: Anlegerprofil und Einstellungen",
   "kurz": "Einmal einrichten, womit DealPilot rechnet — danach ist jedes neue Objekt mit deinen Annahmen vorbelegt.",
   "wann": "Beim ersten Anmelden und immer dann, wenn sich deine Annahmen ändern.",
   "hinweis": "Unten im Einstellungsfenster steht „Auto-Save aktiv · Änderungen werden direkt übernommen“ — die meisten Felder speichern sich sofort.",
   "bilder": [],
   "siehe": [],
   "schritte": [
    {
     "t": "Beim ersten Anmelden öffnet sich ein Einrichtungsfenster mit sechs Schritten: **Aussehen**, **Daten**, **Finanzierung** (dein Anlegerprofil), **Steuer**, **Bewertung** und **Hilfe**. Jeden Schritt kannst du überspringen — dann gilt die Vorbelegung.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/onboarding.js: Wie soll DealPilot aussehen?",
      "js/onboarding.js: Dein Anlegerprofil — womit sollen wir rechnen?",
      "js/onboarding.js: Möchtest du Hilfe beim Start?"
     ]
    },
    {
     "t": "Später erreichst du alles über die Seitenleiste: **Aktionen** → unter „System“ **Einstellungen**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"sb-actions-l\">Aktionen</span>",
      "index.html: <div class=\"sb-act-section-title\">System</div>",
      "index.html: sbActionsAction('settings')"
     ]
    },
    {
     "t": "Reiter **Standardwerte**, ganz oben **Dein Anlegerprofil**: wähle **Ausgewogen**, **Vorsichtig** oder **Renditeorientiert**. Das Profil setzt Tilgung, Eigenkapital, Mietausfall, Mindest-DSCR, den Abschlag auf Angebotspreise und die Gewichte des Deal Scores.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/settings.js: standardwerte:['Standardwerte'",
      "js/standardwerte-karten.js: Dein Anlegerprofil",
      "js/standardwerte-karten.js: Dein Anlegerprofil setzt Tilgung, Eigenkapital, Mietausfall, Mindest-DSCR, den Abschlag auf Angebotspreise und die Gewichte des Deal Scores.",
      "js/standardwerte-karten.js: 'Renditeorientiert'"
     ]
    },
    {
     "t": "Darunter unter **Lageklassen A · B · C** je Klasse die Zielrendite (% brutto) eintragen und bei **Standard für neue Quick-Checks** die Klasse wählen, die im Quick-Check vorausgewählt sein soll.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/investment-profile.js: Lageklassen A · B · C",
      "js/investment-profile.js: Standard für neue Quick-Checks"
     ]
    },
    {
     "t": "Mit **Profil speichern** sichern. Die Gewichte des Scores gelten sofort; **Auf Defaults zurücksetzen** stellt die Vorgaben wieder her.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/investment-profile.js: >Profil speichern<",
      "js/investment-profile.js: >Auf Defaults zurücksetzen<",
      "js/standardwerte-karten.js: die Score-Gewichte gelten sofort"
     ]
    },
    {
     "t": "Reiter **Kontakt & Logo**: Kontaktdaten eintragen und über **Logo hochladen** dein Logo setzen — es steht dann im Kopf deiner PDFs.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/settings.js: contact:['Kontakt & Logo'",
      "js/settings.js: Logo hochladen"
     ]
    },
    {
     "t": "Reiter **Mandanten**: festlegen, wer Objekte hält (Privat oder eine Gesellschaft), und dort die Steuerzeiträume pflegen (siehe Ablauf „Steuer“).",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/settings.js: mandanten:['Mandanten','Gesellschaften, Halter und Steuerregime verwalten.']"
     ]
    },
    {
     "t": "Reiter **Plan**: hier siehst du dein Abo und dein Kontingent — wie viele Marktberichte je Stufe in diesem Monat noch frei sind.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/settings.js: plan:['Plan','Dein aktueller Tarif und dein Bewertungs-Kontingent.']"
     ]
    }
   ]
  },
  {
   "id": "quickcheck",
   "titel": "Erstes Objekt: Quick-Check und „Als Objekt speichern“",
   "kurz": "Ein Inserat in einer Minute einordnen — und wenn es sich lohnt, mit einem Klick als Objekt anlegen.",
   "wann": "",
   "hinweis": "Nach der Marktbewertung trägt DealPilot die Marktmiete als Grundmiete ein. Willst du mit der Ist-Miete rechnen, trag sie danach wieder ein.",
   "bilder": [],
   "siehe": [],
   "schritte": [
    {
     "t": "Seitenleiste: **Aktionen** → unter „Anlegen“ **Quick Boarding**. Der Quick-Check öffnet sich im Inhaltsbereich.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <div class=\"sb-act-section-title\">Anlegen</div>",
      "index.html: sbActionsAction('quickcheck')",
      "index.html: <span class=\"sb-act-l\">Quick Boarding</span>"
     ]
    },
    {
     "t": "Die Pflichtfelder ausfüllen: Straße, PLZ, Ort, Wohnfläche, Kaufpreis, Nettokaltmiete, Hausgeld, den nicht umlagefähigen Anteil, Eigenkapital, Zins und Tilgung. Die Hausnummer ist freiwillig. Solange etwas fehlt, bleibt das Speichern gesperrt.",
     "kosten": "",
     "plan": "",
     "belege": [
      "quickcheck-app.html: Pflichtfelder aus, um das Objekt speichern zu können"
     ]
    },
    {
     "t": "Optional Daten holen: in der Leiste **QUICKBOARDING PASS** Kacheln anklicken — **DealPilot** (Marktbewertung: Marktwert, Marktmiete, Lage), **Exposé / Marktbericht** (PDF auslesen), **Sprachaufzeichnung** (Objekt frei einsprechen) — und **Abrufen** drücken.",
     "kosten": "Die DealPilot-Marktbewertung verbraucht 1 Bewertung aus deinem Kontingent. Vorher fragt DealPilot im Fenster „Abruf bestätigen“ nach.",
     "plan": "",
     "belege": [
      "quickcheck-app.html: QUICKBOARDING PASS",
      "quickcheck-app.html: Exposé / Marktbericht",
      "quickcheck-app.html: Sprachaufzeichnung",
      "quickcheck-app.html: onclick=\"QcApp.openCreditModal()\"",
      "quickcheck-app.html: Abruf bestätigen",
      "js/object-actions.js: dealpilot:    '1 Bewertung'"
     ]
    },
    {
     "t": "Ergebnis lesen: **QUICK CHECK SCORE** mit Kennzahlen, die Bewertung und die **Verhandlungs-Empfehlung** mit Zielkaufpreis.",
     "kosten": "",
     "plan": "",
     "belege": [
      "quickcheck-app.html: QUICK CHECK SCORE",
      "quickcheck-app.html: Verhandlungs-Empfehlung"
     ]
    },
    {
     "t": "Passt das Objekt: **Als Objekt speichern** klicken.",
     "kosten": "",
     "plan": "",
     "belege": [
      "quickcheck-app.html: Als Objekt speichern"
     ]
    },
    {
     "t": "Im Fenster **Diese Daten werden übernommen** zeigt der Reiter **Übernahme** die Werte der Marktbewertung — unter **Spanne** wählst du Unten, Ø oder Oben. Der Reiter **Ausgelesene Daten** zeigt alles aus dem Quick-Check. Haken entfernen, was nicht mit soll, oder **Alle übernehmen**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/qc-bridge.js: Diese Daten werden übernommen",
      "js/qc-bridge.js: Ausgelesene Daten",
      "js/qc-bridge.js: <span class=\"qcpm-cl\">Spanne</span>",
      "js/qc-bridge.js: Alle übernehmen"
     ]
    },
    {
     "t": "**Speichern & übernehmen** — DealPilot legt ein neues Objekt an; ein geöffnetes Objekt wird nicht überschrieben.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/qc-bridge.js: Speichern & übernehmen"
     ]
    },
    {
     "t": "Ohne Quick-Check geht es auch: **Aktionen** → **Neues Objekt** (oder **Neues Objekt hinzufügen** oben in der Objektliste) legt ein leeres Objekt an.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: sbActionsAction('new')",
      "index.html: <span class=\"sb-act-l\">Neues Objekt</span>",
      "js/storage.js: Neues Objekt hinzufügen"
     ]
    }
   ]
  },
  {
   "id": "import",
   "titel": "Exposé oder PDF einlesen",
   "kurz": "Statt abzutippen: Exposé, Marktbericht oder andere PDFs lesen lassen und die Werte gezielt übernehmen.",
   "wann": "",
   "hinweis": "Aus fremden Gutachten übernimmt DealPilot nur die Eingaben, nie deren Ergebnis — gerechnet wird in DealPilot.",
   "bilder": [],
   "siehe": [],
   "schritte": [
    {
     "t": "Das Objekt öffnen. In der Leiste oben im Objekt („Daten einlesen“ bzw. „Daten übernehmen aus“) die Kachel **Exposé / Marktbericht** wählen und **Abrufen** drücken.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/object-actions.js: <span class=\"k-heute\">Daten einlesen</span>",
      "js/object-actions.js: pfTileTool('import', _doc, 'Exposé / Marktbericht'"
     ]
    },
    {
     "t": "Im Fenster **PDFs einlesen — Exposé, Marktbericht, Dokumente** die Dateien auswählen oder hineinziehen. Mehrere PDFs auf einmal gehen, bis 100 MB je Datei.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/object-actions.js: PDFs einlesen — Exposé, Marktbericht, Dokumente",
      "js/object-actions.js: mehrere Dateien möglich · max 100 MB je Datei"
     ]
    },
    {
     "t": "DealPilot erkennt den Typ jeder Datei (auch gescannte PDFs); du kannst ihn je Datei umstellen. Alle Werte werden zusammengeführt — widersprechen sich zwei Dateien, führt der Marktbericht.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/object-actions.js: Typ wird automatisch erkannt (inkl. OCR bei Scan-/Grafik-PDFs) und ist pro Datei umstellbar",
      "js/object-actions.js: Marktbericht führt bei Konflikt"
     ]
    },
    {
     "t": "Liste prüfen: Weicht ein gelesener Wert von dem ab, was schon im Objekt steht, ist die Zeile markiert und nicht vorgehakt. Gefundene Bilder lassen sich in die Objektfotos übernehmen.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/object-actions.js: ' class=\"oabi-abw\"'",
      "js/object-actions.js: in Objektfotos übernehmen"
     ]
    },
    {
     "t": "**Ausgewählte übernehmen** — die angehakten Werte stehen in den Feldern.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/object-actions.js: Ausgewählte übernehmen"
     ]
    },
    {
     "t": "Für andere Dokumente: **Aktionen** → **Import**. Dort liest **Dokument einlesen** z. B. Grundbuch, Gutachten oder Kaufvertrag; **Excel-Kalkulation importieren** übernimmt eine Excel-Kalkulation ins geöffnete Objekt (bestehende Eingaben werden überschrieben); **JSON-Backup importieren** stellt eine Sicherung wieder her.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: sbActionsAction('hub-import')",
      "js/import-export-modal.js: <h3>Dokument einlesen",
      "js/import-export-modal.js: <h3>Excel-Kalkulation importieren",
      "js/import-export-modal.js: Bestehende Eingaben im aktuellen Objekt werden überschrieben",
      "js/import-export-modal.js: <h3>JSON-Backup importieren"
     ]
    }
   ]
  },
  {
   "id": "erfassen",
   "titel": "Ein Objekt vollständig erfassen — die Reiter der Reihe nach",
   "kurz": "Der Weg durch die Datenaufnahme, vom Groben zum Feinen. Was in jedes einzelne Feld gehört, steht in den Kapiteln Eigentumswohnung, Einfamilienhaus und Mehrfamilienhaus.",
   "wann": "",
   "hinweis": "",
   "bilder": [
    {
     "datei": "hb-etw-s0-1.webp",
     "unter": "Reiter Objekt, Objektdaten — die Nummern gehören zur Feldliste im Kapitel Eigentumswohnung"
    }
   ],
   "siehe": [
    [
     "#k-ETW",
     "Kapitel Eigentumswohnung"
    ],
    [
     "#k-EFH",
     "Kapitel Einfamilienhaus"
    ],
    [
     "#k-MFH",
     "Kapitel Mehrfamilienhaus"
    ],
    [
     "#s-MFH-wohnungen",
     "Wohnungsliste"
    ]
   ],
   "schritte": [
    {
     "t": "Das Objekt in der Objektliste anklicken. Änderungen speichert DealPilot automatisch.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/tour-content.js: werden automatisch gespeichert"
     ]
    },
    {
     "t": "Reiter **Objekt**: oben die **Eingabetiefe** wählen (Pillen 1 · 2 · 3 — Einfach, Mittel, Ausgiebig). Sie bestimmt, welche Felder für den Marktbericht Pflicht sind. Den Haken **weitere Objektdetails angeben** setzen, wenn du alle Felder sehen willst. Dann Adresse, Objektart, Wohnfläche und Baujahr eintragen.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"tab-lbl\">Objekt</span>",
      "index.html: <span class=\"oe-ziel-lbl\">Eingabetiefe</span>",
      "index.html: weitere Objektdetails angeben",
      "js/objekt-reiter.js: name: 'Einfach · Stufe 1'"
     ]
    },
    {
     "t": "Beim Mehrfamilienhaus die Wohnungen erfassen — die **Wohnungsliste** mit ihren Schritten steht im Kapitel Mehrfamilienhaus.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/mfh-einheiten.js: var SCHRITTE = ["
     ]
    },
    {
     "t": "Reiter **Investition**: Kaufpreis und Kaufnebenkosten (Makler, Notar, Grundbuchamt, Grunderwerbsteuer), dazu Sanierung und Inventar, wenn es sie gibt.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"tab-lbl\">Investition</span>"
     ]
    },
    {
     "t": "Reiter **Miete**: Nettokaltmiete pro Monat, zusätzliche Einnahmen und die Angaben zum Mietvertrag.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"tab-lbl\">Miete</span>"
     ]
    },
    {
     "t": "Reiter **Finanzierung**: Darlehen, Zinsbindung und Anschlussfinanzierung (eigener Ablauf weiter unten).",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"tab-lbl\">Finanzierung</span>"
     ]
    },
    {
     "t": "Reiter **Bewirtschaftung**: entweder schnell als Prozent der Nettokaltmiete oder als einzelne Kosten pro Jahr. Leere Felder füllt DealPilot aus deinen Standardwerten je Objektart.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"tab-lbl\">Bewirtschaftung</span>"
     ]
    },
    {
     "t": "Reiter **Steuer**: Einkommen und AfA (eigener Ablauf weiter unten).",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span class=\"tab-lbl\">Steuer</span>"
     ]
    },
    {
     "t": "Kontrolle: rechts in der Reiterleiste zeigt die Anzeige „… / 6 · … %“, wie weit die Datenaufnahme ist. Danach die Ergebnisse ansehen: Reiter **Bewertung** (Kennzahlen), **Pilot-Analyse** und **Deal-Aktion**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: title=\"Workflow-Fortschritt\"",
      "index.html: <span class=\"tab-lbl\">Bewertung</span>",
      "index.html: <span class=\"tab-lbl\">Pilot-Analyse</span>",
      "index.html: <span class=\"tab-lbl\">Deal-Aktion</span>"
     ]
    }
   ]
  },
  {
   "id": "finanzierung",
   "titel": "Finanzierung und Anschlussfinanzierung eintragen",
   "kurz": "Das Darlehen so erfassen, wie es im Vertrag oder Angebot steht — und festlegen, womit nach der Zinsbindung gerechnet wird.",
   "wann": "",
   "hinweis": "",
   "bilder": [
    {
     "datei": "hb-etw-s3-2.webp",
     "unter": "Zinsbindung, Bank-PDF-Import und der Haken für die Anschlussfinanzierung"
    },
    {
     "datei": "hb-etw-s3-x1.webp",
     "unter": "Nach dem Haken: die Felder der Anschlussfinanzierung"
    }
   ],
   "siehe": [
    [
     "#s-ETW-s3",
     "Reiter Finanzierung, Feld für Feld"
    ]
   ],
   "schritte": [
    {
     "t": "Reiter **Finanzierung**, Karte **Darlehen I – Hauptdarlehen**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Darlehen I – Hauptdarlehen"
     ]
    },
    {
     "t": "**Art des Darlehens** wählen: **Annuitätendarlehen** oder **Tilgungsaussetzungsdarlehen (mit Bausparvertrag)**. Bei der Tilgungsaussetzung erscheint zusätzlich die Karte für den Bausparvertrag.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <label>Art des Darlehens",
      "index.html: Tilgungsaussetzungsdarlehen (mit Bausparvertrag)",
      "index.html: Bausparvertrag"
     ]
    },
    {
     "t": "Eigenkapital, Darlehenssumme, **Zinssatz nominal (% p.a.)**, **Tilgung (% p.a.)** und **Zinsbindung (Jahre)** eintragen. Rate, Restschuld am Ende der Zinsbindung und das Ende der Bindung rechnet DealPilot selbst.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Zinssatz nominal (% p.a.)",
      "index.html: Tilgung (% p.a.)",
      "index.html: Zinsbindung (Jahre)",
      "index.html: Restschuld Ende Zinsbindung"
     ]
    },
    {
     "t": "Liegt der Darlehensvertrag als PDF vor: **Daten aus Bank-PDF importieren** — die Werte werden aus dem Vertrag übernommen.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Daten aus Bank-PDF importieren",
      "index.html: Bankvertrag scannen — Werte werden automatisch übernommen"
     ]
    },
    {
     "t": "Anschlussfinanzierung: den Haken **Eigene Anschlussfinanzierung für Darlehen 1** setzen und **Zinssatz Anschluss (%)** sowie **Tilgung Anschluss (%)** eintragen. Ohne Haken läuft das Darlehen nach der Bindung zu den heutigen Konditionen weiter.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Eigene Anschlussfinanzierung für Darlehen 1",
      "index.html: Zinssatz Anschluss (%)",
      "index.html: Tilgung Anschluss (%)",
      "js/help.js: Ohne Haken läuft das Darlehen zu den heutigen Konditionen weiter"
     ]
    },
    {
     "t": "Ein zweites Darlehen (z. B. Förderdarlehen): in der Karte **Darlehen II – Zusatzdarlehen** auf **Hinzufügen** — es hat seine eigene Anschlussfinanzierung.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Darlehen II – Zusatzdarlehen",
      "index.html: <span>Hinzufügen</span>",
      "index.html: Eigene Anschlussfinanzierung für Darlehen 2"
     ]
    },
    {
     "t": "Wirkung prüfen: Die Mehrbelastung nach der Zinsbindung (Zinsänderungsrisiko) steht im Reiter **Bewertung**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/help.js: Es steht im Reiter <strong>Bewertung</strong> und im Bankgespräch"
     ]
    }
   ]
  },
  {
   "id": "rnd",
   "titel": "Restnutzungsdauer mit dem Assistenten ermitteln",
   "kurz": "Ist das Gebäude kürzer nutzbar als die Regel-AfA annimmt, ist ein höherer AfA-Satz möglich. Der Assistent ermittelt die Restnutzungsdauer und setzt den Satz.",
   "wann": "",
   "hinweis": "Der Assistent dient der Steuer. Für den Marktbericht rechnet DealPilot die Restnutzungsdauer aus den Modernisierungen im Reiter Objekt (Modernisierungsgrad nach Anlage 2 ImmoWertV).",
   "bilder": [
    {
     "datei": "hb-etw-s3-tax-1.webp",
     "unter": "Reiter Steuer — Feld AfA-Satz in der Karte AfA-Konfiguration"
    }
   ],
   "siehe": [
    [
     "#s-ETW-s3-tax",
     "Reiter Steuer, Feld für Feld"
    ]
   ],
   "schritte": [
    {
     "t": "Reiter **Steuer**, Karte **AfA-Konfiguration**, Feld **AfA-Satz**: den Eintrag **Eigenen Satz / Restnutzungsdauer eingeben …** wählen.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: AfA-Konfiguration",
      "js/afa-eigen.js: Eigenen Satz / Restnutzungsdauer eingeben …"
     ]
    },
    {
     "t": "Auf **Restnutzungsdauer ermitteln** klicken. Der Assistent hat neun Schritte: Objekt-Basis · Auftraggeber & Stichtag · Bauliche Anlagen · Gebäudetechnik · Modernisierungen · Zustand der Gewerke · Schäden & Mängel · Sachverständiger · Ergebnis & Empfehlung. Was im Objekt schon steht, ist vorausgefüllt.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/afa-eigen.js: >Restnutzungsdauer ermitteln<",
      "js/rnd-wizard.js: title: 'Objekt-Basis'",
      "js/rnd-wizard.js: title: 'Schäden & Mängel'",
      "js/rnd-wizard.js: title: 'Ergebnis & Empfehlung'",
      "js/deal-action.js: var prefill = _getRndPrefill();"
     ]
    },
    {
     "t": "Mit **Weiter →** durch die Schritte; in Schritt 8 heißt der Knopf **Berechnen →**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/rnd-wizard.js: 'Weiter →'",
      "js/rnd-wizard.js: 'Berechnen →'"
     ]
    },
    {
     "t": "Im Ergebnis **Restnutzungsdauer … Jahre übernehmen** klicken: DealPilot setzt den eigenen AfA-Satz (100 ÷ Restnutzungsdauer) und zeigt die Steuerwirkung vorher und nachher. Ist die Übernahme gesperrt, braucht der Fall erst eine sachverständige Beurteilung.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/rnd-wizard.js:  Jahre übernehmen",
      "js/rnd-wizard.js: Übernahme gesperrt — erst nach sachverständiger Beurteilung",
      "js/afa-eigen.js: Eine eingetragene Restnutzungsdauer ergibt den Satz: 100 ÷ RND."
     ]
    },
    {
     "t": "Für den Nachweis beim Finanzamt: **✉ Anfrage senden →** schickt die Angaben als Anfrage für ein Gutachten an einen Sachverständigen.",
     "kosten": "Das Gutachten selbst ist eine eigene, kostenpflichtige Leistung des Sachverständigen — DealPilot zeigt die Gutachterkosten im Reiter Deal-Aktion neben der Steuerersparnis.",
     "plan": "",
     "belege": [
      "js/rnd-wizard.js: '✉ Anfrage senden →'",
      "js/deal-action.js: GUTACHTER-KOSTEN"
     ]
    },
    {
     "t": "Später genügt **Letzte Ermittlung übernehmen**: Restnutzungsdauer und Satz werden eingesetzt, unter **Grundlage** steht „RND-Ermittlung DealPilot (indikativ)“. Das Finanzamt verlangt für einen eigenen Satz einen Nachweis (Gutachten).",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/afa-eigen.js: Letzte Ermittlung übernehmen",
      "js/afa-eigen.js: RND-Ermittlung DealPilot (indikativ)",
      "js/afa-eigen.js: Das Finanzamt verlangt dafür einen Nachweis (Gutachten)."
     ]
    }
   ]
  },
  {
   "id": "marktbericht",
   "titel": "Marktbericht und Potenzial abrufen und lesen",
   "kurz": "Den Wert des Objekts einordnen lassen — von der schnellen Marktpreisindikation bis zur Wertermittlung nach ImmoWertV — und sehen, was nach Mieterhöhung oder Umbau drin ist.",
   "wann": "",
   "hinweis": "Der Marktbericht ist eine Marktpreisindikation, ausdrücklich kein Gutachten nach § 194 BauGB. Fehlt ein amtlicher Wert, nennt der Bericht den zuständigen Gutachterausschuss und den Weg zur Quelle.",
   "bilder": [],
   "siehe": [
    [
     "#k-ETW",
     "Pflichtfelder je Stufe (Steckbrief jedes Kapitels)"
    ]
   ],
   "schritte": [
    {
     "t": "Reiter **Objekt**, oben die **Eingabetiefe** wählen: **Einfach · Stufe 1** (Marktpreisindikation), **Mittel · Stufe 2** (erweiterte Indikation, ab Plan Investor) oder **Ausgiebig · Stufe 3** (Wertermittlung nach ImmoWertV mit Boden-, Ertrags- und Sachwert, ab Plan Pro).",
     "kosten": "",
     "plan": "Stufe 2 ab Investor, Stufe 3 ab Pro",
     "belege": [
      "js/objekt-reiter.js: name: 'Einfach · Stufe 1'",
      "js/objekt-reiter.js: name: 'Mittel · Stufe 2'",
      "js/objekt-reiter.js: name: 'Ausgiebig · Stufe 3'",
      "js/objekt-reiter.js: var ab = { 2: 'ab Investor', 3: 'ab Pro' };"
     ]
    },
    {
     "t": "In der Box **Marktbericht abrufen** steht je Stufe, wie viele Berichte noch frei sind. Heißt der Knopf **was fehlt**, zeigt ein Klick die fehlenden Felder — ausfüllen, bis dort **abrufen** steht. Der Bericht rechnet nie halb.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Marktbericht abrufen",
      "js/objekt-reiter.js: (fehlt ? 'was fehlt' : 'abrufen')",
      "js/objekt-reiter.js: r + ' frei'"
     ]
    },
    {
     "t": "**abrufen** klicken und bestätigen.",
     "kosten": "Jeder Abruf verbraucht 1 Bewertung aus dem Kontingent seiner Stufe. Eine schon bezahlte Tiefe kostet beim erneuten Abruf nichts.",
     "plan": "",
     "belege": [
      "js/object-actions.js: Für diesen Abruf wird dein Kontingent belastet:",
      "js/help.js: eine schon bezahlte Tiefe kostet beim erneuten Abruf nichts"
     ]
    },
    {
     "t": "Ein Fenster zeigt die Etappen. Mit **Im Hintergrund weiter** arbeitest du normal weiter; ist der Bericht fertig, wird die Pille unten zu „✓ Marktbericht fertig · … — öffnen“.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/mb-auftrag.js: Im Hintergrund weiter",
      "js/mb-auftrag.js: Marktbericht fertig · "
     ]
    },
    {
     "t": "Lesen: **Im Marktbericht öffnen →** (oder **Aktionen** → **Marktbericht**). In Stufe 3 trägt jede amtliche Zahl ihre Herkunftsstufe (A bis E und N), und der Quellennachweis nennt die Gutachterausschüsse, deren Zahlen im Bericht stecken.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Im Marktbericht öffnen →",
      "index.html: sbActionsAction('marktbericht')"
     ]
    },
    {
     "t": "Verkehrswert übernehmen: Reiter **Objekt**, Karte **Wertanker**, unter dem Feld Verkehrswert einen Eintrag aus dem Verlauf wählen und **als Verkehrswert übernehmen** klicken. Welche Zahl gilt, entscheidest du.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Wertanker",
      "js/objekt-reiter.js: als Verkehrswert übernehmen"
     ]
    },
    {
     "t": "Alte Berichte: Reiter **Deal-Aktion**, Abschnitt **Marktberichte** („Erzeugte Berichte als PDF“) — neueste zuerst, als PDF ladbar.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/deal-action-boarding.js: band('doc', 'Marktberichte', 'Erzeugte Berichte als PDF')"
     ]
    },
    {
     "t": "Potenzial: im Reiter **Objekt** die Karte **Mieterhöhung und Zielbild (optional)** ausfüllen (beim Mehrfamilienhaus je Wohnung in der Wohnungsliste). DealPilot rechnet Soll-Miete und Zielbild mit demselben Kern wie Stufe 3 — ohne Kontingent. Das Ergebnis steht in der Pilot-Analyse unter **Ankauf · Bestand · Zielbild** und in den PDFs.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Mieterhöhung und Zielbild",
      "index.html: Ankauf &middot; Bestand &middot; Zielbild",
      "js/help.js: je Stufe wechseln nur Miete und Restnutzungsdauer. Kein Kontingent."
     ]
    },
    {
     "t": "Marktpreise zum Potenzial: Reiter **Pilot-Analyse**, Bereich „Ankauf · Bestand · Zielbild“ → **Marktpreise abrufen** → **Ja, abrufen**.",
     "kosten": "Kostet 1 × erweiterte Marktpreisindikation aus deinem Kontingent; DealPilot fragt vorher nach.",
     "plan": "",
     "belege": [
      "js/potenzial.js: Marktpreise abrufen",
      "js/potenzial.js: Kostet 1 × erweiterte Marktpreisindikation",
      "js/potenzial.js: Ja, abrufen"
     ]
    }
   ]
  },
  {
   "id": "pilot",
   "titel": "Pilot-Analyse abrufen und als PDF ausgeben",
   "kurz": "Die KI-Einschätzung zum Objekt holen und mit genau den Bausteinen ins PDF bringen, die du zeigen willst.",
   "wann": "",
   "hinweis": "Im Free-Plan trägt jedes PDF ein Wasserzeichen.",
   "bilder": [],
   "siehe": [],
   "schritte": [
    {
     "t": "Reiter **Pilot-Analyse** → **Pilot-Analyse starten**. Sie ist in deinem Plan enthalten und verbraucht kein Kontingent.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: <span>Pilot-Analyse starten</span>",
      "js/help.js: Die Pilot-Analyse ist in deinem Plan enthalten und verbraucht kein Kontingent."
     ]
    },
    {
     "t": "Die Analyse wird beim Objekt gespeichert. Für eine frische Einschätzung (etwa nach geänderten Zahlen) einfach erneut starten.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/help.js: Die Pilot-Analyse wird beim Objekt gespeichert."
     ]
    },
    {
     "t": "Fürs PDF: den Schalter **Pilot-Analyse im PDF-Export einschließen** setzen, dann **Bausteine im PDF** aufklappen und die Haken setzen oder entfernen — z. B. Gesamtbewertung, Stärken, Risiken, Verhandlungsempfehlung, Bankargumente, Ankauf · Bestand · Zielbild, Steuerliche Zusammenfassung.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Pilot-Analyse im PDF-Export einschließen",
      "index.html: Bausteine im PDF",
      "index.html: id=\"ai-pdf-sec-gesamt\"",
      "index.html: id=\"ai-pdf-sec-steuer\""
     ]
    },
    {
     "t": "Tipp: einmal kurz den Reiter **Bewertung** öffnen — dann sind alle Grafiken gezeichnet.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/help.js: Öffne vorher einmal kurz den Reiter <strong>Bewertung</strong>"
     ]
    },
    {
     "t": "Reiter **Deal-Aktion** → **PDFs herunterladen** → beim **Investment-PDF** auf **PDF**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/deal-action-boarding.js: PDFs herunterladen",
      "js/deal-action-boarding.js: DealActionBoarding.exportDoc(\\''"
     ]
    },
    {
     "t": "Fassung wählen: **Bankfassung**, **Investment-PDF · hell** oder **Investment-PDF · Obsidian**. Mit **Diese Wahl merken** fragt DealPilot nicht mehr — zurück zur Auswahl kommst du über den Knopf **Fassung** neben „PDF“.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/pdf-wahl.js: titel: 'Bankfassung'",
      "js/pdf-wahl.js: titel: 'Investment-PDF · hell'",
      "js/pdf-wahl.js: titel: 'Investment-PDF · Obsidian'",
      "js/pdf-wahl.js: Diese Wahl merken",
      "js/deal-action-boarding.js: >Fassung</button>"
     ]
    },
    {
     "t": "Derselbe Bericht geht auch über **Aktionen** → **Export** → **PDF-Report für Objekt**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: sbActionsAction('hub-export')",
      "js/import-export-modal.js: PDF-Report für Objekt"
     ]
    }
   ]
  },
  {
   "id": "bank",
   "titel": "Unterlagen für die Bank: Bank-PDF und Bankexport",
   "kurz": "Das Objekt bankfertig machen, die Bankfassung des PDFs erzeugen und die Darlehen aller Objekte als Liste ausgeben.",
   "wann": "",
   "hinweis": "",
   "bilder": [],
   "siehe": [
    [
     "#k-ETW",
     "Felder, die in den Bank-PDFs stehen (Feldlisten, „Was es bewirkt“)"
    ]
   ],
   "schritte": [
    {
     "t": "Reiter **Deal-Aktion**, Abschnitt **Bereit für die Bank?**: dort steht „… Grundfelder befüllt“; jedes fehlende Feld ist aufgeführt und führt per Klick zum Eingabefeld.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/deal-action-boarding.js: Bereit für die Bank?",
      "js/deal-action-boarding.js: Grundfelder befüllt"
     ]
    },
    {
     "t": "Unter **PDFs herunterladen** beim **Investment-PDF** auf **PDF** und die Fassung **Bankfassung** wählen — weißes Papier, Kennzahlen als Tabelle, für Bank, Finanzierung und Steuerberater.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/pdf-wahl.js: unter: 'Weisses Papier, Kennzahlen als Tabelle'",
      "js/pdf-wahl.js: fuer: 'Bank · Finanzierung · Steuerberater'"
     ]
    },
    {
     "t": "Abschnitt **Bordkarte & Unterlagen**: die Listen „Persönliche Unterlagen“ und „Objekt-Unterlagen“ zeigen, was die Bank üblicherweise sehen will. **Unterlagen beim Amt anfordern** ermittelt die zuständige Stelle und schreibt den Antrag.",
     "kosten": "Die Ämter erheben für Auszüge und Akten ihre eigenen Gebühren.",
     "plan": "",
     "belege": [
      "js/deal-action-boarding.js: band('doc2', 'Bordkarte &amp; Unterlagen'",
      "js/deal-action-boarding.js: Persönliche Unterlagen",
      "js/deal-action-boarding.js: Unterlagen beim Amt anfordern",
      "js/deal-action-boarding.js: die zuständige Stelle und schreibt den Antrag"
     ]
    },
    {
     "t": "Alle Darlehen aller Objekte als Liste: Seitenleiste **Aktionen** → unter „Ausgeben“ **Bankexport**. Einzelne Darlehen per Häkchen abwählen, dann **CSV exportieren**, **Excel exportieren** oder **PDF erstellen**.",
     "kosten": "",
     "plan": "je nach Plan freigeschaltet",
     "belege": [
      "index.html: sbActionsAction('bankexport')",
      "index.html: data-feature=\"bank_pdf_a3\"",
      "js/storage.js: CSV exportieren",
      "js/storage.js: Excel exportieren",
      "js/storage.js: 'PDF erstellen"
     ]
    },
    {
     "t": "Als Nachweis deiner Erfahrung: **Aktionen** → **Track Record** — gewonnene Deals als Einzel- oder Sammel-PDF.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: sbActionsAction('trackrec')",
      "index.html: <span class=\"sb-act-l\">Track Record</span>"
     ]
    }
   ]
  },
  {
   "id": "steuer",
   "titel": "Steuer: Einkommen, Steuerzeiträume und BMF-Kaufpreisaufteilung",
   "kurz": "Die Steuerwirkung des Objekts richtig rechnen lassen: dein Einkommen über die Jahre, der Gebäudeanteil und die Werbungskosten bis zum Finanzamt-PDF.",
   "wann": "",
   "hinweis": "DealPilot ist keine Steuerberatung (§ 6 StBerG). Die Rechnungen sind Hilfsmittel — die finale Beurteilung gehört zu deinem Steuerberater.",
   "bilder": [
    {
     "datei": "hb-etw-s3-tax-1.webp",
     "unter": "Reiter Steuer: Persönliche Steuer mit „Steuerzeiträume verwalten“, AfA-Konfiguration mit dem Knopf BMF-Rechner"
    }
   ],
   "siehe": [
    [
     "#s-ETW-s3-tax",
     "Reiter Steuer, Feld für Feld"
    ]
   ],
   "schritte": [
    {
     "t": "Reiter **Steuer**, Karte **Persönliche Steuer**: dein zu versteuerndes Einkommen (zvE) vor der Immobilie eintragen. Mit dem Haken **Grenzsteuersatz automatisch aus zvE berechnen** rechnet DealPilot den Satz selbst.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Persönliche Steuer",
      "index.html: Zu versteuerndes Einkommen (zvE) vor Immobilie / Jahr",
      "index.html: Grenzsteuersatz automatisch aus zvE berechnen"
     ]
    },
    {
     "t": "Ändert sich dein Einkommen über die Jahre: **📅 Steuerzeiträume verwalten →**. Unter **Neuen Zeitraum hinzufügen** **Gültig von**, **Gültig bis (leer = laufend)**, **zvE / Jahr (€)** und einen **Grund** eintragen, dann **Hinzufügen**. Überschneidet sich ein Zeitraum, zeigt DealPilot den Konflikt — du kannst abbrechen oder **Trotzdem als neuen Zeitraum anlegen**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: 📅 Steuerzeiträume verwalten →",
      "js/tax-periods.js: Neuen Zeitraum hinzufügen",
      "js/tax-periods.js: Gültig bis (leer = laufend)",
      "js/tax-periods.js: zvE / Jahr (€)",
      "js/tax-periods.js: Trotzdem als neuen Zeitraum anlegen"
     ]
    },
    {
     "t": "Karte **AfA-Konfiguration**: **AfA-Satz** und **Gebäudeanteil am KP (%)** prüfen. Für einen genaueren Gebäudeanteil rechts in der Karte den Knopf **BMF-Rechner** öffnen (nicht den Link unter „Hilfreiche Links“).",
     "kosten": "",
     "plan": "BMF-Rechner ab Pro",
     "belege": [
      "index.html: Gebäudeanteil am KP (%)",
      "index.html: id=\"btnBmfAdvanced\"",
      "index.html: onclick=\"openBMFModal()\"",
      "index.html: plan-badge plan-badge-gold"
     ]
    },
    {
     "t": "Im Fenster **Anschaffungskosten & BMF-Kaufpreisaufteilung** die vier Reiter der Reihe nach: **1 Anschaffungskosten** · **2 BMF-Aufteilung** · **3 AfA-Vorschau** · **4 AfA-Hebel**, jeweils mit **Weiter →**. Die Reiter 2 bis 4 öffnen erst, wenn die Pflichtangaben vollständig sind.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/bmf-modal-html.html: Anschaffungskosten &amp; BMF-Kaufpreisaufteilung",
      "js/bmf-modal-html.html: switchPane('p-hebel')",
      "js/bmf-modal.js: 'p-hebel': '<b>Schritt 4 / 4:</b>",
      "js/bmf-modal-html.html: Weiter →"
     ]
    },
    {
     "t": "Im Reiter 4 eine Variante per Klick wählen und **✓ Übernehmen** — Gebäudeanteil und AfA-Satz stehen danach im Reiter Steuer. Ausgabe: **Kaufpreisaufteilung als PDF** oder **BMF-Arbeitshilfe als PDF**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/bmf-modal-html.html: ✓ Übernehmen",
      "js/bmf-modal.js: Kaufpreisaufteilung als PDF",
      "js/bmf-modal.js: BMF-Arbeitshilfe als PDF"
     ]
    },
    {
     "t": "Werbungskosten je Jahr: Karte **Steuerformular pro Jahr · individuelle Werte**. DealPilot schlägt Werte vor; du überschreibst sie, etwa mit den Zahlen aus dem Bescheid. Belege liest **Belege & Abrechnungen einlesen (KI)**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Steuerformular pro Jahr · individuelle Werte",
      "index.html: Belege &amp; Abrechnungen einlesen (KI)"
     ]
    },
    {
     "t": "Finanzamt-PDF: unter **Steuerjahr** ein Jahr wählen, optional **Anlage V** anhaken und **Finanzamt-PDF** klicken. Dasselbe PDF gibt es im Reiter Deal-Aktion unter „PDFs herunterladen“.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: >Steuerjahr<",
      "index.html: id=\"fa-pdf-anlagev\"",
      "index.html: title=\"Finanzamt-PDF für das gewählte Steuerjahr erzeugen",
      "js/deal-action-boarding.js: Finanzamt-PDF (Steuerformular)"
     ]
    }
   ]
  },
  {
   "id": "portfolio",
   "titel": "Vom Deal zum Portfolio",
   "kurz": "Ein gekauftes Objekt in den Bestand nehmen und alle Objekte zusammen im Portfolio-Cockpit steuern.",
   "wann": "",
   "hinweis": "Das Portfolio zählt nur Objekte mit Status Gewonnen. Verlorene Objekte bleiben mit allen Zahlen erhalten.",
   "bilder": [],
   "siehe": [],
   "schritte": [
    {
     "t": "Im Reiter **Objekt** das Datum **Wirtsch. Übergang** (Nutzen-/Lastenwechsel) eintragen. Ohne dieses Datum friert DealPilot den Ankauf-Stand nicht ein.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: Wirtsch. Übergang"
     ]
    },
    {
     "t": "Reiter **Deal-Aktion**, Deal-Status **Gewonnen** wählen („Deal gewonnen — Objekt im Bestand“). DealPilot schreibt den Ankauf-Stand zu diesem Tag fest.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/deal-action-boarding.js: ['won', 'Gewonnen', 'Abgeflogen', 'Deal gewonnen \\u2014 Objekt im Bestand']"
     ]
    },
    {
     "t": "Seitenleiste **Aktionen** → **Portfolio-Cockpit**.",
     "kosten": "",
     "plan": "",
     "belege": [
      "index.html: sbActionsAction('cockpit')",
      "index.html: <span class=\"sb-act-l\">Portfolio-Cockpit</span>"
     ]
    },
    {
     "t": "Oben **Portfolio Score** und die Kennzahlen über alle gewonnenen Objekte. Weiter unten die Steuer über alle Objekte und die Projektion.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/dashboard.js: Portfolio Score"
     ]
    },
    {
     "t": "Steuer-Mappe fürs Finanzamt: **Veranlagungsjahr** wählen, optional **Anlage-V-Zuordnung anhängen**, dann **Steuer-Mappe erstellen** — ein PDF über alle Objekte mit Steuerdaten.",
     "kosten": "",
     "plan": "",
     "belege": [
      "js/dashboard.js: Veranlagungsjahr",
      "js/dashboard.js: Anlage-V-Zuordnung anhängen",
      "js/dashboard.js: Steuer-Mappe erstellen"
     ]
    }
   ]
  }
 ]
};
