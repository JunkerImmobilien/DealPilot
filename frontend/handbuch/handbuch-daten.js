/* Erzeugt von tools/handbuch-erzeugen.mjs — NICHT von Hand aendern. */
window.DP_HANDBUCH = {
 "version": "v2555",
 "quellen": {
  "index.html": "9e1298d7dd123ea4",
  "tooltip-content.js": "4ac19b29bc691f75",
  "help.js": "f7e7ccb0d347a0e2",
  "tour-content.js": "337253bde80bf1e1",
  "objekt-reiter.js": "64beaea4aed16e97",
  "deal-action-readycheck.js": "4d9c815073f8d2ab",
  "feld-hilfe.js": "db5913c4ec4dc08e",
  "mfh-einheiten.js": "9fdc26a09d7d7669",
  "calc.js": "c43592c29e191de1",
  "ui.js": "19f957f0aca8717e",
  "pdf.js": "315c92dfeefac6e7",
  "pdf-investment-bank.js": "cd661801c609d54c",
  "financing-pdf.js": "499286d3cab32382",
  "werbungskosten-pdf.js": "4048d673682f3acb",
  "pdf-anlage-bmf.js": "41997cf31f29fb07",
  "pdf-kaufpreisaufteilung.js": "fe5f492746a957c4",
  "frontend-konstanten.json": "8cf24bc346f29d58",
  "aufnahme.json": "fehlt"
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
   "label": "Lageklasse Ziel",
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
   "label": "LTV inkl. Erwerbsnebenkosten berechnen (strenger, GI-Bezug) ℹ",
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
   "tip": null,
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
   "label": "WEG-Rücklage / Jahr ℹ Info",
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
   "beispiel": null,
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
     "felder": [
      {
       "id": "plz",
       "nr": 1,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ort",
       "nr": 2,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "str",
       "nr": 3,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hnr",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "objart",
       "nr": 5,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nutzungsart",
       "nr": 6,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wfl",
       "nr": 7,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zimmer",
       "nr": 8,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "baujahr",
       "nr": 9,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "etage",
       "nr": 10,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "etagen_ges",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_zustand",
       "nr": 12,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "standardstufe",
       "nr": 13,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_energie",
       "nr": 14,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "vermstand",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gsfl",
       "nr": 16,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mea",
       "nr": 17,
       "stufe": 3,
       "artPflicht": true,
       "artHinweis": "Bei Wohnungseigentum trägt der Miteigentumsanteil den Bodenwert."
      },
      {
       "id": "kuerzel",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "thesis",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "risiken",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "exitstr",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kaufdat",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wirtschaftlicher_uebergang",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "halter",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mand_ueberf_cb",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "verkehrswert_ueberf",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_preis",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "halter_seit",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gesellschafterdarlehen",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_restschuld",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_rest_zins",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_ende",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw",
       "nr": 33,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_stichtag",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_walls",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_aussenwand",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_aussenwaende",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_roof",
       "nr": 39,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_dach",
       "nr": 40,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_dach",
       "nr": 41,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_windows",
       "nr": 42,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_fenster",
       "nr": 43,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_fenster",
       "nr": 44,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_heating",
       "nr": 45,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_heizung",
       "nr": 46,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_heizung",
       "nr": 47,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_bath",
       "nr": 48,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_baeder",
       "nr": 49,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_sanitaer",
       "nr": 50,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_floor",
       "nr": 51,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_fussboeden",
       "nr": 52,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_innenausbau",
       "nr": 53,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_innenwaende",
       "nr": 54,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_decken",
       "nr": 55,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_leitungen",
       "nr": 56,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_technik",
       "nr": 57,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_grundriss",
       "nr": 58,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_elevator",
       "nr": 59,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_guest_wc",
       "nr": 60,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_store_room",
       "nr": 61,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bad_anz",
       "nr": 62,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "balkon_flae",
       "nr": 63,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen",
       "nr": 64,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "stellpl_aussen",
       "nr": 65,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "modernis",
       "nr": 66,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "baustatus",
       "nr": 67,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gemarkung",
       "nr": 68,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "flur",
       "nr": 69,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "flurstueck",
       "nr": 70,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_qm",
       "nr": 71,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_eur_qm",
       "nr": 72,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_rentierlich",
       "nr": 73,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erbpacht",
       "nr": 74,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erbbauzins",
       "nr": 75,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_restlz",
       "nr": 76,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_zs_ang",
       "nr": 77,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_entsch",
       "nr": 78,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_wert_ist_erb",
       "nr": 79,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "lageklasse",
       "nr": 80,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makrolage",
       "nr": 81,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mikrolage",
       "nr": 82,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_bevoelkerung",
       "nr": 83,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_nachfrage",
       "nr": 84,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_wertsteigerung",
       "nr": 85,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_entwicklung",
       "nr": 86,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bankval",
       "nr": 87,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "svwert",
       "nr": 88,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wert_soll",
       "nr": 89,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notizen",
       "nr": 90,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_fertig_jahr",
       "nr": 91,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_vgl_qm",
       "nr": 92,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_soll_qm",
       "nr": 93,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_soll_ab",
       "nr": 94,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_ziel_qm",
       "nr": 95,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_ziel_wann",
       "nr": 96,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bgf",
       "nr": 97,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grundriss",
       "nr": 98,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_punkte",
       "nr": 99,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "sachwertfaktor",
       "nr": 100,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "uk_flaeche",
       "nr": 101,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wgfz_objekt",
       "nr": 102,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "stellplatz_miete_monat",
       "nr": 103,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "sonstige_jahr",
       "nr": 104,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_haus",
       "nr": 105,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_geschosse",
       "nr": 106,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_dach",
       "nr": 107,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen_bgf_qm",
       "nr": 108,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen_stufe",
       "nr": 109,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "aussenanlagen_pct",
       "nr": 110,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "aussenanlagen",
       "nr": 111,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bes_bauteile",
       "nr": 112,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_gauben",
       "nr": 113,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_balkone",
       "nr": 114,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_vordach",
       "nr": 115,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_terrassen",
       "nr": 116,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_sonstige",
       "nr": 117,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "lzs_pct",
       "nr": 118,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_manuell",
       "nr": 119,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_anpassung_pct",
       "nr": 120,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_anpassung_grund",
       "nr": 121,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s1",
     "felder": [
      {
       "id": "kp",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makler_p",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makler_e",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notar_p",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notar_e",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gba_p",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gba_e",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gest_p",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gest_e",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ji_p",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ji_e",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "san",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "san_ust",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "moebl",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_kueche",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_moebel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_geraete",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_pv",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_stellplatz",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_sonst",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s2",
     "felder": [
      {
       "id": "nkm",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ze",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "umlagef",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_marktmiete",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_mietausfall",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_art",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_beginn",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_letzte_erhoehung",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_letzte_erhoehung_betrag",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_soll",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_anz",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_int",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_pct",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s3",
     "felder": [
      {
       "id": "bank_inst",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_vertrag",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_vertragsdatum",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_type",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_auszahl",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek_ist_nk",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek_inkl_nk",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1z",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1t",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_bindj",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_anschl_enable",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_z",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_t",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_bj",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_inst",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_vertrag",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_vertragsdatum",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_sum",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_rate",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_quote_min",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_zins",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_dar_z",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_dar_t",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_type",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_inst",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_vertrag",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_bspar",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_auszahl",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_vertragsdatum",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2z",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2t",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_bindj",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_anschl_enable",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_az",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_at",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s4",
     "felder": [
      {
       "id": "bwk_ul_pct",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bwk_nul_pct",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bwk_kp_pct",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hg_ul",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grundsteuer",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ul_sonst",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hg_nul",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "weg_r",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eigen_r",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mietausfall",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nul_sonst",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp1",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp1l",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp2",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp2l",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp3",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp3l",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp4",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp4l",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s3-tax",
     "felder": [
      {
       "id": "zve",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grenz",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grenz_auto",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_satz",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "geb_ant",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_aktiv",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_eh40",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_baukosten",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_vermietung",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_neubau",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    }
   ],
   "wohnungsliste": false,
   "wohnungBilder": []
  },
  {
   "art": "EFH",
   "name": "Einfamilienhaus",
   "beispiel": null,
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
     "felder": [
      {
       "id": "plz",
       "nr": 1,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ort",
       "nr": 2,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "str",
       "nr": 3,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hnr",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "objart",
       "nr": 5,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nutzungsart",
       "nr": 6,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wfl",
       "nr": 7,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zimmer",
       "nr": 8,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "baujahr",
       "nr": 9,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "etagen_ges",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_zustand",
       "nr": 11,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "standardstufe",
       "nr": 12,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_energie",
       "nr": 13,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "vermstand",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gsfl",
       "nr": 15,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kuerzel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "thesis",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "risiken",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "exitstr",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kaufdat",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wirtschaftlicher_uebergang",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "halter",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mand_ueberf_cb",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "verkehrswert_ueberf",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_preis",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "halter_seit",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gesellschafterdarlehen",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_restschuld",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_rest_zins",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_ende",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw",
       "nr": 31,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_stichtag",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_walls",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_aussenwand",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_aussenwaende",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_roof",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_dach",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_dach",
       "nr": 39,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_windows",
       "nr": 40,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_fenster",
       "nr": 41,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_fenster",
       "nr": 42,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_heating",
       "nr": 43,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_heizung",
       "nr": 44,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_heizung",
       "nr": 45,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_bath",
       "nr": 46,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_baeder",
       "nr": 47,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_sanitaer",
       "nr": 48,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_floor",
       "nr": 49,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_fussboeden",
       "nr": 50,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_innenausbau",
       "nr": 51,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_innenwaende",
       "nr": 52,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_decken",
       "nr": 53,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_leitungen",
       "nr": 54,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_technik",
       "nr": 55,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_grundriss",
       "nr": 56,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_elevator",
       "nr": 57,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_guest_wc",
       "nr": 58,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_store_room",
       "nr": 59,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bad_anz",
       "nr": 60,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "balkon_flae",
       "nr": 61,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen",
       "nr": 62,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "stellpl_aussen",
       "nr": 63,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "modernis",
       "nr": 64,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "baustatus",
       "nr": 65,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gemarkung",
       "nr": 66,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "flur",
       "nr": 67,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "flurstueck",
       "nr": 68,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_qm",
       "nr": 69,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_eur_qm",
       "nr": 70,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_rentierlich",
       "nr": 71,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erbpacht",
       "nr": 72,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erbbauzins",
       "nr": 73,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_restlz",
       "nr": 74,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_zs_ang",
       "nr": 75,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_entsch",
       "nr": 76,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_wert_ist_erb",
       "nr": 77,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "lageklasse",
       "nr": 78,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makrolage",
       "nr": 79,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mikrolage",
       "nr": 80,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_bevoelkerung",
       "nr": 81,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_nachfrage",
       "nr": 82,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_wertsteigerung",
       "nr": 83,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_entwicklung",
       "nr": 84,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bankval",
       "nr": 85,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "svwert",
       "nr": 86,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wert_soll",
       "nr": 87,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notizen",
       "nr": 88,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_fertig_jahr",
       "nr": 89,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_vgl_qm",
       "nr": 90,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_soll_qm",
       "nr": 91,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_soll_ab",
       "nr": 92,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_ziel_qm",
       "nr": 93,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_ziel_wann",
       "nr": 94,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bgf",
       "nr": 95,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grundriss",
       "nr": 96,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_punkte",
       "nr": 97,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "sachwertfaktor",
       "nr": 98,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "uk_flaeche",
       "nr": 99,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wgfz_objekt",
       "nr": 100,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "stellplatz_miete_monat",
       "nr": 101,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "sonstige_jahr",
       "nr": 102,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_haus",
       "nr": 103,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_geschosse",
       "nr": 104,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_dach",
       "nr": 105,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen_bgf_qm",
       "nr": 106,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen_stufe",
       "nr": 107,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "aussenanlagen_pct",
       "nr": 108,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "aussenanlagen",
       "nr": 109,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bes_bauteile",
       "nr": 110,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_gauben",
       "nr": 111,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_balkone",
       "nr": 112,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_vordach",
       "nr": 113,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_terrassen",
       "nr": 114,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_sonstige",
       "nr": 115,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "lzs_pct",
       "nr": 116,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_manuell",
       "nr": 117,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_anpassung_pct",
       "nr": 118,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_anpassung_grund",
       "nr": 119,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s1",
     "felder": [
      {
       "id": "kp",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makler_p",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makler_e",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notar_p",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notar_e",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gba_p",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gba_e",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gest_p",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gest_e",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ji_p",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ji_e",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "san",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "san_ust",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "moebl",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_kueche",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_moebel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_geraete",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_pv",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_stellplatz",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_sonst",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s2",
     "felder": [
      {
       "id": "nkm",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ze",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "umlagef",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_marktmiete",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_mietausfall",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_art",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_beginn",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_letzte_erhoehung",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_letzte_erhoehung_betrag",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_soll",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_anz",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_int",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_pct",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s3",
     "felder": [
      {
       "id": "bank_inst",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_vertrag",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_vertragsdatum",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_type",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_auszahl",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek_ist_nk",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek_inkl_nk",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1z",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1t",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_bindj",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_anschl_enable",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_z",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_t",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_bj",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_inst",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_vertrag",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_vertragsdatum",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_sum",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_rate",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_quote_min",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_zins",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_dar_z",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_dar_t",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_type",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_inst",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_vertrag",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_bspar",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_auszahl",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_vertragsdatum",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2z",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2t",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_bindj",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_anschl_enable",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_az",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_at",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s4",
     "felder": [
      {
       "id": "bwk_ul_pct",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bwk_nul_pct",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bwk_kp_pct",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hg_ul",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grundsteuer",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ul_sonst",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hg_nul",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "weg_r",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eigen_r",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mietausfall",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nul_sonst",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp1",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp1l",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp2",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp2l",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp3",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp3l",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp4",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp4l",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s3-tax",
     "felder": [
      {
       "id": "zve",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grenz",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grenz_auto",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_satz",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "geb_ant",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_aktiv",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_eh40",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_baukosten",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_vermietung",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_neubau",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    }
   ],
   "wohnungsliste": false,
   "wohnungBilder": []
  },
  {
   "art": "MFH",
   "name": "Mehrfamilienhaus",
   "beispiel": null,
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
     "zimmer",
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
     "felder": [
      {
       "id": "plz",
       "nr": 1,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ort",
       "nr": 2,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "str",
       "nr": 3,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hnr",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "objart",
       "nr": 5,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nutzungsart",
       "nr": 6,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wfl",
       "nr": 7,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "baujahr",
       "nr": 8,
       "stufe": 1,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "etagen_ges",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "einheiten",
       "nr": 10,
       "stufe": 2,
       "artPflicht": true,
       "artHinweis": "Beim Mehrfamilienhaus zählt die Zahl der Wohneinheiten, nicht die Zimmer einer einzelnen."
      },
      {
       "id": "ds2_zustand",
       "nr": 11,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "standardstufe",
       "nr": 12,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_energie",
       "nr": 13,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "vermstand",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gsfl",
       "nr": 15,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kuerzel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "thesis",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "risiken",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "exitstr",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kaufdat",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wirtschaftlicher_uebergang",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "halter",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mand_ueberf_cb",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "verkehrswert_ueberf",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_preis",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "halter_seit",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gesellschafterdarlehen",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_restschuld",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_rest_zins",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ueberf_ende",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw",
       "nr": 31,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_stichtag",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_walls",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_aussenwand",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_aussenwaende",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_roof",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_dach",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_dach",
       "nr": 39,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_windows",
       "nr": 40,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_fenster",
       "nr": 41,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_fenster",
       "nr": 42,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_heating",
       "nr": 43,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_heizung",
       "nr": 44,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_heizung",
       "nr": 45,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_bath",
       "nr": 46,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_baeder",
       "nr": 47,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_sanitaer",
       "nr": 48,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_floor",
       "nr": 49,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_fussboeden",
       "nr": 50,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_innenausbau",
       "nr": 51,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_innenwaende",
       "nr": 52,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_decken",
       "nr": 53,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_leitungen",
       "nr": 54,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ausst_technik",
       "nr": 55,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_grundriss",
       "nr": 56,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_elevator",
       "nr": 57,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_guest_wc",
       "nr": 58,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eq_store_room",
       "nr": 59,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "balkon_flae",
       "nr": 60,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen",
       "nr": 61,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "stellpl_aussen",
       "nr": 62,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "modernis",
       "nr": 63,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "baustatus",
       "nr": 64,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gemarkung",
       "nr": 65,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "flur",
       "nr": 66,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "flurstueck",
       "nr": 67,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_qm",
       "nr": 68,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_eur_qm",
       "nr": 69,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hinterland_rentierlich",
       "nr": 70,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erbpacht",
       "nr": 71,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erbbauzins",
       "nr": 72,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_restlz",
       "nr": 73,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_zs_ang",
       "nr": 74,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_entsch",
       "nr": 75,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "erb_wert_ist_erb",
       "nr": 76,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "lageklasse",
       "nr": 77,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makrolage",
       "nr": 78,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mikrolage",
       "nr": 79,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_bevoelkerung",
       "nr": 80,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_nachfrage",
       "nr": 81,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_wertsteigerung",
       "nr": 82,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_entwicklung",
       "nr": 83,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bankval",
       "nr": 84,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "svwert",
       "nr": 85,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wert_soll",
       "nr": 86,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notizen",
       "nr": 87,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_fertig_jahr",
       "nr": 88,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_vgl_qm",
       "nr": 89,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_soll_qm",
       "nr": 90,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_soll_ab",
       "nr": 91,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_ziel_qm",
       "nr": 92,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "zb_ziel_wann",
       "nr": 93,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bgf",
       "nr": 94,
       "stufe": 3,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grundriss",
       "nr": 95,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mod_punkte",
       "nr": 96,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "sachwertfaktor",
       "nr": 97,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "uk_flaeche",
       "nr": 98,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "wgfz_objekt",
       "nr": 99,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "stellplatz_miete_monat",
       "nr": 100,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "sonstige_jahr",
       "nr": 101,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_haus",
       "nr": 102,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_geschosse",
       "nr": 103,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nhk_dach",
       "nr": 104,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen_bgf_qm",
       "nr": 105,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "garagen_stufe",
       "nr": 106,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "aussenanlagen_pct",
       "nr": 107,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "aussenanlagen",
       "nr": 108,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bes_bauteile",
       "nr": 109,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_gauben",
       "nr": 110,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_balkone",
       "nr": 111,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_vordach",
       "nr": 112,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_terrassen",
       "nr": 113,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "btl_sonstige",
       "nr": 114,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "lzs_pct",
       "nr": 115,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_manuell",
       "nr": 116,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_anpassung_pct",
       "nr": 117,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "brw_anpassung_grund",
       "nr": 118,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s1",
     "felder": [
      {
       "id": "kp",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makler_p",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "makler_e",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notar_p",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "notar_e",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gba_p",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gba_e",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gest_p",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "gest_e",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ji_p",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ji_e",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "san",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "san_ust",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "moebl",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_kueche",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_moebel",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_geraete",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_pv",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_stellplatz",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "inv_sonst",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s2",
     "felder": [
      {
       "id": "nkm",
       "nr": 1,
       "stufe": 2,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ze",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "umlagef",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_marktmiete",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ds2_mietausfall",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_art",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_beginn",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_letzte_erhoehung",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mv_letzte_erhoehung_betrag",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_soll",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_anz",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_int",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "me_pct",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s3",
     "felder": [
      {
       "id": "bank_inst",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_vertrag",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_vertragsdatum",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_type",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_auszahl",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek_ist_nk",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ek_inkl_nk",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1z",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1t",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_bindj",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d1_anschl_enable",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_z",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_t",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "anschl_bj",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_inst",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_vertrag",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_vertragsdatum",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_sum",
       "nr": 20,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_rate",
       "nr": 21,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_quote_min",
       "nr": 22,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_zins",
       "nr": 23,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_dar_z",
       "nr": 24,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bspar_dar_t",
       "nr": 25,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_type",
       "nr": 26,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_inst",
       "nr": 27,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_vertrag",
       "nr": 28,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_bspar",
       "nr": 29,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_auszahl",
       "nr": 30,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_vertragsdatum",
       "nr": 31,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2",
       "nr": 32,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2z",
       "nr": 33,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2t",
       "nr": 34,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_bindj",
       "nr": 35,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_anschl_enable",
       "nr": 36,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_az",
       "nr": 37,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "d2_at",
       "nr": 38,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s4",
     "felder": [
      {
       "id": "bwk_ul_pct",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bwk_nul_pct",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "bwk_kp_pct",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hg_ul",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grundsteuer",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "ul_sonst",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "hg_nul",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "weg_r",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "eigen_r",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "mietausfall",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "nul_sonst",
       "nr": 11,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp1",
       "nr": 12,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp1l",
       "nr": 13,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp2",
       "nr": 14,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp2l",
       "nr": 15,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp3",
       "nr": 16,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp3l",
       "nr": 17,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp4",
       "nr": 18,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "kp4l",
       "nr": 19,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    },
    {
     "sec": "s3-tax",
     "felder": [
      {
       "id": "zve",
       "nr": 1,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grenz",
       "nr": 2,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "grenz_auto",
       "nr": 3,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_satz",
       "nr": 4,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "geb_ant",
       "nr": 5,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_aktiv",
       "nr": 6,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_eh40",
       "nr": 7,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_baukosten",
       "nr": 8,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_vermietung",
       "nr": 9,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      },
      {
       "id": "afa_sonder7b_neubau",
       "nr": 10,
       "stufe": 0,
       "artPflicht": false,
       "artHinweis": ""
      }
     ],
     "weitere": [],
     "bilder": []
    }
   ],
   "wohnungsliste": true,
   "wohnungBilder": []
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
 "auffaellig": [
  "d1z trägt den Hilfetext tab5.zinsbindung („Zinsbindung“)"
 ],
 "aufnahme": null
};
