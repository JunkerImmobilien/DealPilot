/* ═══════════════════════════════════════════════════════════════════════════
   ANLAGE V · VERANLAGUNGSJAHR 2023 · ZEILENZUORDNUNG (v3900)
   ───────────────────────────────────────────────────────────────────────────
   ABGESCHRIEBEN AUS DEM AMTLICHEN VORDRUCK, nicht geraten.
   Quelle: Formular-Management-System der Bundesfinanzverwaltung (formulare-bfinv.de),
   Steuerformulare › Einkommensteuer › Einkommensteuer 2023, Eintrag „080 Anlage V (2023)“,
   Vordruck 034032_23, abgerufen am 19.11.2026, Ablage design/mockups/Anlage_V_2023.pdf.
   Gelesen mit pdftotext -layout und, wo die Lage einer Kennzahl unklar war, mit den Wortpositionen (-bbox).
   Marcel 19.11.2026 („setz das für die Steuer so um“): Zeilen je Jahr hinterlegen und beim Speichern
   mitstempeln (js/anlage-v-kern.js stempel). Bedeutung der Felder und Quellenarten wie in anlage-v-2025.js.
   AUFBAU: vier Seiten (2023AnlV101NET bis 2023AnlV104NET, Stand September 2023). Abweichend von 2024:
   Ankreuzfelder Zeile 8, Gesamtwohnfläche 9, eigengenutzt 10, Ferienwohnung 11, Einzelangaben Wohnungen
   12, 13 und weitere 14 (DealPilot schreibt die erste Wohnung in 12, alle weiteren in 13). Zeile 15 bis 41
   wie 2024; die bewegliche AfA hat nur zwei Eingabezeilen (42, 43), ab der Summe (44, Kz 60) liegt jede
   Zeile eins unter 2024: Schuldzinsen 47, Geldbeschaffung 50, Renten 53, Erhaltung 54/55, verteilt 56/59,
   aus 2019 bis 2022 62/65/68/71, umgelegte Kosten 74, nicht umgelegte 77, Umsatzsteuer 78, Sonstige 81,
   Summe 82, Vorsteuer 83, Überschuss 84, Zurechnung 85, Kürzung 86/87, Zuschüsse 88.
   ICH BIN KEIN STEUERBERATER. Abschrift ist Abschrift, alles andere ist gekennzeichnet (quelle, grund).
   Erzeugt aus den Abschriften, Pruefer: node tools/anlage-v-pruefen.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
window.AnlageV2023 = {
  jahr: 2023,
  formular: '2023AnlV101NET–2023AnlV104NET',
  quelle: 'Formular-Management-System der Bundesfinanzverwaltung (formulare-bfinv.de), Steuerformulare › Einkommensteuer › Einkommensteuer 2023, Vordruck 034032_23 „Anlage V (2023)“, abgerufen am 19.11.2026; Ablage design/mockups/Anlage_V_2023.pdf',
  stand: 'September 2023',

  /* Summenzeilen und Zeilen ohne eigenes DealPilot-Feld (Bedeutung wie in anlage-v-2025.js) */
  summen: { einnahmen: 32, zuschuesse_ergebnis: 31, werbungskosten: 82, ueberschuss: 84, sonder7b: 38, erh_verteilt_gesamt: 56, erh_verteilt_jahr: 59, einzel_wohnung: 12, einzel_wohnung_weitere: 13, einzel_raum: 16, einzel_raum_weitere: 17, afa_angaben: 33, zurechnung: 85, verh_selbst: [55] },

  /* Summenzeile -> Zeile „durch verhaeltnismaessige Zuordnung ermittelt" */
  verh: { 35: 34, 38: 37, 41: 40, 44: 43, 47: 46, 50: 49, 53: 52, 54: 55, 59: 58, 62: 61, 65: 64, 68: 67, 71: 70, 74: 73, 77: 76, 81: 80 },

  zeilen: {
    8: { text: 'Das Objekt wird ganz oder teilweise als Ferienwohnung genutzt (Kz 61) / kurzfristig vermietet (Kz 63) / an Angehörige zu Wohnzwecken vermietet (Kz 62), 1 = Ja, 2 = Nein' },
    9: { text: 'Gesamtwohnfläche (in m²)', kz: '54' },
    10: { text: 'In Zeile 9 enthaltener eigengenutzter oder unentgeltlich an Dritte überlassener Wohnraum (in m²)', kz: '55' },
    12: { text: 'Mieteinnahmen für Wohnungen (ohne Umlagen), Bezeichnung der Wohneinheit, Wohnfläche' },
    13: { text: 'Bezeichnung der Wohneinheit, Wohnfläche (zweite Wohneinheit)' },
    14: { text: 'Bezeichnung weiterer Wohneinheiten, Wohnfläche' },
    15: { text: 'Summe der Mieteinnahmen für Wohnungen', kz: '01' },
    16: { text: 'Einnahmen für andere Räume (ohne Umlagen / Umsatzsteuer), Bezeichnung der Einheit, Nutzfläche' },
    17: { text: 'Bezeichnung weiterer Einheiten, Nutzfläche' },
    18: { text: 'Summe der Einnahmen für andere Räume', kz: '02' },
    19: { text: 'Einnahmen für an Angehörige vermietete Wohnungen (ohne Umlagen)', kz: '03' },
    20: { text: 'Auf die Zeilen 15 und 18 entfallende laufende Neben- / Betriebskosten', kz: '04' },
    21: { text: 'Auf die Zeilen 15 und 18 entfallende und im Jahr 2023 erhaltene Nachzahlungen / geleistete Erstattungen (negativen Betrag mit vorangestelltem Minuszeichen eintragen)', kz: '11' },
    22: { text: 'Auf Zeile 19 entfallende laufende Neben- / Betriebskosten', kz: '05' },
    23: { text: 'Auf Zeile 19 entfallende und im Jahr 2023 erhaltene Nachzahlungen / geleistete Erstattungen (negativen Betrag mit vorangestelltem Minuszeichen eintragen)', kz: '12' },
    24: { text: 'Neben- / Betriebskosten wurden nicht gesondert vereinbart (1 = Ja)', kz: '13' },
    25: { text: 'Vereinnahmte Mieten für frühere Jahre / verrechnete Mietkautionen / auf das Kalenderjahr entfallende Mietvorauszahlungen aus Baukostenzuschüssen', kz: '06' },
    26: { text: 'Einnahmen aus Vermietung von Garagen, Werbeflächen, Grund und Boden für Kioske usw.', kz: '07' },
    27: { text: 'Vereinnahmte Umsatzsteuer', kz: '09' },
    28: { text: 'Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer', kz: '10' },
    29: { text: 'Öffentliche Zuschüsse nach dem Wohnraumförderungsgesetz oder zu Erhaltungsaufwendungen, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen und sonstige Einnahmen' },
    30: { text: 'davon entfallen auf eigengenutzte oder unentgeltlich an Dritte überlassene Wohnungen laut Zeile 10' },
    31: { text: 'Ergebnis der Zeilen 29 und 30', kz: '08' },
    32: { text: 'Summe der Einnahmen aus den Zeilen 15, 18 bis 28 und 31' },
    33: { text: 'Absetzung für Abnutzung für Gebäude, durch direkte Zuordnung ermittelt: 1 = linear / 2 = degressiv, %, 1 = wie Vorjahr / 2 = laut Erläuterung' },
    35: { text: 'Absetzung für Abnutzung für Gebäude (ohne Beträge in den Zeilen 36 bis 41), abzugsfähige Werbungskosten', kz: '30' },
    38: { text: 'Sonderabschreibung für Mietwohnungsneubau nach § 7b EStG, abzugsfähige Werbungskosten', kz: '70' },
    41: { text: 'Erhöhte Absetzungen nach den §§ 7h, 7i EStG und / oder nach dem Schutzbaugesetz, abzugsfähige Werbungskosten', kz: '31' },
    44: { text: 'Absetzung für Abnutzung für Wirtschaftsgüter, die keine Gebäude sind (z. B. bewegliche Wirtschaftsgüter), abzugsfähige Werbungskosten', kz: '60' },
    47: { text: 'Schuldzinsen (ohne Tilgungsbeträge), abzugsfähige Werbungskosten', kz: '33' },
    50: { text: 'Geldbeschaffungskosten (z. B. Schätz-, Notar-, Grundbuchgebühren), abzugsfähige Werbungskosten', kz: '34' },
    53: { text: 'Renten, dauernde Lasten, abzugsfähige Werbungskosten', kz: '35' },
    54: { text: '2023 voll abzuziehende Erhaltungsaufwendungen (einschließlich Entnahmen aus der Erhaltungsrücklage), durch direkte Zuordnung ermittelt', kz: '36' },
    55: { text: '2023 voll abzuziehende Erhaltungsaufwendungen, durch verhältnismäßige Zuordnung ermittelt', kz: '37' },
    56: { text: 'Auf bis zu 5 Jahre zu verteilende Erhaltungsaufwendungen (§§ 11a, 11b EStG, § 82b EStDV), Gesamtaufwand 2023', kz: '57' },
    59: { text: 'Auf mehrere Jahre verteilte Erhaltungsaufwendungen aus 2023, abzugsfähige Werbungskosten', kz: '38' },
    62: { text: 'Verteilte Erhaltungsaufwendungen aus 2019, abzugsfähige Werbungskosten', kz: '39' },
    65: { text: 'Verteilte Erhaltungsaufwendungen aus 2020, abzugsfähige Werbungskosten', kz: '40' },
    68: { text: 'Verteilte Erhaltungsaufwendungen aus 2021, abzugsfähige Werbungskosten', kz: '41' },
    71: { text: 'Verteilte Erhaltungsaufwendungen aus 2022, abzugsfähige Werbungskosten', kz: '42' },
    74: { text: 'Umgelegte Kosten (z. B. Grundsteuer, Straßenreinigung, Müllabfuhr, Wasserversorgung, Entwässerung, Hausbeleuchtung, Heizung, Warmwasser, Schornsteinreinigung, Hausversicherungen, Hauswart, Treppenhausreinigung, Fahrstuhl), abzugsfähige Werbungskosten', kz: '52' },
    77: { text: 'Nicht umgelegte Kosten (z. B. Verwaltungskosten, Bank- und Kontoführungsgebühren ohne Erhaltungsrücklage), abzugsfähige Werbungskosten', kz: '48' },
    78: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: an das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer', kz: '58' },
    81: { text: 'Sonstige Kosten, abzugsfähige Werbungskosten', kz: '49' },
    82: { text: 'Summe der Werbungskosten (Summe der Zeilen 35, 38, 41, 44, 47, 50, 53, 54, 55, 59, 62, 65, 68, 71, 74, 77, 78 und 81)' },
    83: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: in den Werbungskosten laut Zeile 82 enthaltene abziehbare Vorsteuerbeträge', kz: '59' },
    84: { text: 'Überschuss (Einnahmen laut Zeile 32 abzüglich Werbungskosten laut Zeile 82)' },
    85: { text: 'Zurechnung des Betrags aus Zeile 84, Steuerpflichtige Person / Ehemann / Person A, Ehefrau / Person B', kz: '20/21' },
    86: { text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung (in %)', kz: '50' },
    87: { text: 'Betragsmäßige Kürzung der Werbungskosten wegen verbilligter Vermietung eines Teils des Objekts', kz: '51' },
    88: { text: '2023 vereinnahmte oder bewilligte Zuschüsse aus öffentlichen Mitteln zu den Anschaffungs- / Herstellungskosten (laut gesonderter Aufstellung)' }
  },

  /* DealPilot-Feld -> Zeile. quelle: formular (Abschrift) · auffang (Sonstige Kosten) · sachlogik (mit grund) */
  felder: {
    einnahmen_km: { zeile: 15, art: 'einnahme', quelle: 'formular' },
    einnahmen_nk: { zeile: 20, art: 'einnahme', quelle: 'formular' },
    afa: { zeile: 35, art: 'wk', quelle: 'formular' },
    schuldzinsen: { zeile: 47, art: 'wk', quelle: 'formular' },
    notar_grundschuld: { zeile: 50, art: 'wk', quelle: 'formular' },
    erhaltungsaufwand: { zeile: 54, art: 'wk', quelle: 'formular' },
    nk_umlf: { zeile: 74, art: 'wk', quelle: 'formular' },
    hausverwaltung: { zeile: 77, art: 'wk', quelle: 'formular' },
    kontofuehrung: { zeile: 77, art: 'wk', quelle: 'formular' },
    nk_n_umlf: { zeile: 77, art: 'wk', quelle: 'formular' },
    porto: { zeile: 81, art: 'wk', quelle: 'auffang' },
    fahrtkosten: { zeile: 81, art: 'wk', quelle: 'auffang' },
    verpflegung: { zeile: 81, art: 'wk', quelle: 'auffang' },
    hotel: { zeile: 81, art: 'wk', quelle: 'auffang' },
    inserat: { zeile: 81, art: 'wk', quelle: 'auffang' },
    gericht: { zeile: 81, art: 'wk', quelle: 'auffang' },
    telefon: { zeile: 81, art: 'wk', quelle: 'auffang' },
    sonst_kosten: { zeile: 81, art: 'wk', quelle: 'auffang' },
    verw_sonst: { zeile: 77, art: 'wk', quelle: 'auffang', grund: 'Verwaltungskosten, Zeile 78 nennt sie ausdrücklich; „sonstige" bleibt in derselben Gruppe.' },
    betr_sonst: { zeile: 77, art: 'wk', quelle: 'auffang', grund: 'Was nicht ausdrücklich umgelegt wird, gehört zu den nicht umgelegten Kosten. Wird es umgelegt, gehört es in Zeile 75.' },
    bereitstellung: { zeile: 47, art: 'wk', quelle: 'sachlogik', grund: 'Bereitstellungszinsen sind Zinsen. Die amtliche Anleitung rechnet auch Damnum / Disagio zu den Schuldzinsen.' },
    vermittlung: { zeile: 50, art: 'wk', quelle: 'sachlogik', grund: 'Eine Vermittlungsprovision für ein Darlehen gehört zu den Kosten der Geldbeschaffung, dieselbe Gruppe wie Schätz-, Notar- und Grundbuchgebühren.' },
    finanz_sonst: { zeile: 50, art: 'wk', quelle: 'sachlogik', grund: 'Sonstige Finanzierungsnebenkosten gehören zur Geldbeschaffung. Ist der Aufwand ein Zins, gehört er in Zeile 48.' },
    steuerber: { zeile: 81, art: 'wk', quelle: 'sachlogik', grund: 'Steuerberatungskosten sind Werbungskosten, soweit sie auf die Ermittlung der Einkünfte entfallen. Der auf den Mantelbogen entfallende Teil ist keine Anlage-V-Position.' },
    anschaffungsnah: { zeile: 35, art: 'wk', quelle: 'sachlogik', grund: 'Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) sind nicht sofort abziehbar, sie erhöhen die Bemessungsgrundlage und wirken über die AfA in Zeile 35.' },
    sonst_bewegl_wg: { zeile: 44, art: 'wk', quelle: 'formular' },
    av_andere_raeume: { zeile: 18, art: 'einnahme', quelle: 'formular' },
    av_angehoerige: { zeile: 19, art: 'einnahme', quelle: 'formular' },
    av_nk_nachzahlung: { zeile: 21, art: 'einnahme', quelle: 'formular' },
    av_nk_angehoerige: { zeile: 22, art: 'einnahme', quelle: 'formular' },
    av_nk_nachz_angeh: { zeile: 23, art: 'einnahme', quelle: 'formular' },
    av_fruehere_mieten: { zeile: 25, art: 'einnahme', quelle: 'formular' },
    av_garagen: { zeile: 26, art: 'einnahme', quelle: 'formular' },
    av_ust_vereinnahmt: { zeile: 27, art: 'einnahme', quelle: 'formular' },
    av_ust_erstattet: { zeile: 28, art: 'einnahme', quelle: 'formular' },
    av_zuschuesse: { zeile: 29, art: 'einnahme', quelle: 'formular' },
    av_zuschuesse_eigen: { zeile: 30, art: 'einnahme', quelle: 'formular' },
    av_7h7i: { zeile: 41, art: 'wk', quelle: 'formular' },
    av_renten: { zeile: 53, art: 'wk', quelle: 'formular' },
    av_erh_m1: { zeile: 71, art: 'wk', quelle: 'formular' },
    av_erh_m2: { zeile: 68, art: 'wk', quelle: 'formular' },
    av_erh_m3: { zeile: 65, art: 'wk', quelle: 'formular' },
    av_erh_m4: { zeile: 62, art: 'wk', quelle: 'formular' },
    av_ust_gezahlt: { zeile: 78, art: 'wk', quelle: 'formular' },
    av_vorsteuer: { zeile: 83, art: 'info', quelle: 'formular' },
    av_wohnflaeche: { zeile: 9, art: 'info', quelle: 'formular' },
    av_eigen_qm: { zeile: 10, art: 'info', quelle: 'formular' },
    av_kuerzung_pct: { zeile: 86, art: 'info', quelle: 'formular' },
    av_kuerzung_betrag: { zeile: 87, art: 'info', quelle: 'formular' },
    av_zuschuss_ahk: { zeile: 88, art: 'info', quelle: 'formular' },
    av_fewo: { zeile: 8, kz: '61', art: 'info', quelle: 'formular' },
    av_kurzfristig: { zeile: 8, kz: '63', art: 'info', quelle: 'formular' },
    av_angeh_flag: { zeile: 8, kz: '62', art: 'info', quelle: 'formular' },
    av_nk_nicht_vereinbart: { zeile: 24, art: 'info', quelle: 'formular' },
    av_anteil_pct: { zeile: null, art: 'info', quelle: 'formular', grund: 'Kein eigenes Feld: der Anteil steht je Posten in den Zeilen „durch verhältnismäßige Zuordnung ermittelt“ (siehe verh).' },
    av_zurechnung_a_pct: { zeile: 85, art: 'info', quelle: 'formular' }
  },

  nicht_erfasst: [
    { zeile: 38, text: 'Sonderabschreibung nach § 7b EStG. DealPilot rechnet sie und weist sie getrennt aus, sobald das Objekt eine Sonderabschreibung führt. Bei älteren gespeicherten Jahreswerten ist die Aufteilung nicht bekannt: steht auf diesem Blatt keine Zeile 38, obwohl die AfA einen § 7b-Anteil enthält, gehört dieser Teil laut Formular nicht in Zeile 35, sondern in Zeile 38.' }
  ]
};
