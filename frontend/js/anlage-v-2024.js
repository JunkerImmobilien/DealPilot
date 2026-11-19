/* ═══════════════════════════════════════════════════════════════════════════
   ANLAGE V · VERANLAGUNGSJAHR 2024 · ZEILENZUORDNUNG (v3900)
   ───────────────────────────────────────────────────────────────────────────
   ABGESCHRIEBEN AUS DEM AMTLICHEN VORDRUCK, nicht geraten.
   Quelle: Formular-Management-System der Bundesfinanzverwaltung (formulare-bfinv.de),
   Steuerformulare › Einkommensteuer › Einkommensteuer 2024, Eintrag „080 Anlage V (2024)“,
   Vordruck 034032_24, abgerufen am 19.11.2026, Ablage design/mockups/Anlage_V_2024.pdf.
   Gelesen mit pdftotext -layout und, wo die Lage einer Kennzahl unklar war, mit den Wortpositionen (-bbox).
   Marcel 19.11.2026 („setz das für die Steuer so um“): Zeilen je Jahr hinterlegen und beim Speichern
   mitstempeln (js/anlage-v-kern.js stempel). Bedeutung der Felder und Quellenarten wie in anlage-v-2025.js.
   AUFBAU: vier Seiten (2024AnlV101NET bis 2024AnlV104NET, Stand September 2024), Zeile 13 bis 89 wie 2025.
   Abweichend von 2025: Ankreuzfelder Zeile 9 (2025: 10), Gesamtwohnfläche Zeile 10 (11), eigengenutzter
   Wohnraum Zeile 11 (12), als Ferienwohnung genutzter Wohnraum Zeile 12. Verteilte Erhaltung aus 2020 bis 2023
   in den Zeilen 63, 66, 69, 72.
   ICH BIN KEIN STEUERBERATER. Abschrift ist Abschrift, alles andere ist gekennzeichnet (quelle, grund).
   Erzeugt aus den Abschriften, Pruefer: node tools/anlage-v-pruefen.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
window.AnlageV2024 = {
  jahr: 2024,
  formular: '2024AnlV101NET–2024AnlV104NET',
  quelle: 'Formular-Management-System der Bundesfinanzverwaltung (formulare-bfinv.de), Steuerformulare › Einkommensteuer › Einkommensteuer 2024, Vordruck 034032_24 „Anlage V (2024)“, abgerufen am 19.11.2026; Ablage design/mockups/Anlage_V_2024.pdf',
  stand: 'September 2024',

  /* Summenzeilen und Zeilen ohne eigenes DealPilot-Feld (Bedeutung wie in anlage-v-2025.js) */
  summen: { einnahmen: 32, zuschuesse_ergebnis: 31, werbungskosten: 83, ueberschuss: 85, sonder7b: 38, erh_verteilt_gesamt: 57, erh_verteilt_jahr: 60, einzel_wohnung: 13, einzel_wohnung_weitere: 14, einzel_raum: 16, einzel_raum_weitere: 17, afa_angaben: 33, zurechnung: 86, verh_selbst: [56] },

  /* Summenzeile -> Zeile „durch verhaeltnismaessige Zuordnung ermittelt" */
  verh: { 35: 34, 38: 37, 41: 40, 45: 44, 48: 47, 51: 50, 54: 53, 55: 56, 60: 59, 63: 62, 66: 65, 69: 68, 72: 71, 75: 74, 78: 77, 82: 81 },

  zeilen: {
    9: { text: 'Das Objekt wird ganz oder teilweise als Ferienwohnung genutzt (Kz 61) / kurzfristig vermietet (Kz 63) / an Angehörige zu Wohnzwecken vermietet (Kz 62), 1 = Ja, 2 = Nein' },
    10: { text: 'Gesamtwohnfläche (in m²)', kz: '54' },
    11: { text: 'In Zeile 10 enthaltener eigengenutzter oder unentgeltlich an Dritte überlassener Wohnraum (in m²)', kz: '55' },
    13: { text: 'Mieteinnahmen für Wohnungen (ohne Umlagen / ohne Umsatzsteuer), Bezeichnung der Wohneinheit, Wohnfläche' },
    14: { text: 'Bezeichnung weiterer Wohneinheiten, Wohnfläche' },
    15: { text: 'Summe der Mieteinnahmen für Wohnungen', kz: '01' },
    16: { text: 'Einnahmen für andere Räume (ohne Umlagen / ohne Umsatzsteuer), Bezeichnung der Einheit, Nutzfläche' },
    17: { text: 'Bezeichnung weiterer Einheiten, Nutzfläche' },
    18: { text: 'Summe der Einnahmen für andere Räume', kz: '02' },
    19: { text: 'Einnahmen für an Angehörige vermietete Wohnungen (ohne Umlagen / ohne Umsatzsteuer)', kz: '03' },
    20: { text: 'Auf die Zeilen 15 und 18 entfallende laufende Neben- / Betriebskosten', kz: '04' },
    21: { text: 'Auf die Zeilen 15 und 18 entfallende und im Jahr 2024 erhaltene Nachzahlungen / geleistete Erstattungen (negativen Betrag mit vorangestelltem Minuszeichen eintragen)', kz: '11' },
    22: { text: 'Auf Zeile 19 entfallende laufende Neben- / Betriebskosten', kz: '05' },
    23: { text: 'Auf Zeile 19 entfallende und im Jahr 2024 erhaltene Nachzahlungen / geleistete Erstattungen (negativen Betrag mit vorangestelltem Minuszeichen eintragen)', kz: '12' },
    24: { text: 'Neben- / Betriebskosten wurden nicht gesondert vereinbart (1 = Ja)', kz: '13' },
    25: { text: 'Vereinnahmte Mieten für frühere Jahre / verrechnete Mietkautionen / auf das Kalenderjahr entfallende Mietvorauszahlungen aus Baukostenzuschüssen', kz: '06' },
    26: { text: 'Einnahmen aus Vermietung von Garagen, Werbeflächen, Grund und Boden für Kioske usw.', kz: '07' },
    27: { text: 'Vereinnahmte Umsatzsteuer', kz: '09' },
    28: { text: 'Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer', kz: '10' },
    29: { text: 'Öffentliche Zuschüsse nach dem Wohnraumförderungsgesetz oder zu Erhaltungsaufwendungen, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen und sonstige Einnahmen' },
    30: { text: 'davon entfallen auf eigengenutzte oder unentgeltlich an Dritte überlassene Wohnungen laut Zeile 11' },
    31: { text: 'Ergebnis der Zeilen 29 und 30', kz: '08' },
    32: { text: 'Summe der Einnahmen aus den Zeilen 15, 18 bis 28 und 31' },
    33: { text: 'Absetzung für Abnutzung für Gebäude, durch direkte Zuordnung ermittelt: 1 = linear / 2 = degressiv, %, 1 = wie Vorjahr / 2 = laut Erläuterung' },
    35: { text: 'Absetzung für Abnutzung für Gebäude (ohne Beträge in den Zeilen 36 bis 41), abzugsfähige Werbungskosten', kz: '30' },
    38: { text: 'Sonderabschreibung für Mietwohnungsneubau nach § 7b EStG, abzugsfähige Werbungskosten', kz: '70' },
    41: { text: 'Erhöhte Absetzungen nach den §§ 7h, 7i EStG und / oder nach dem Schutzbaugesetz, abzugsfähige Werbungskosten', kz: '31' },
    45: { text: 'Absetzung für Abnutzung für Wirtschaftsgüter, die keine Gebäude sind (z. B. bewegliche Wirtschaftsgüter), abzugsfähige Werbungskosten', kz: '60' },
    48: { text: 'Schuldzinsen (ohne Tilgungsbeträge), abzugsfähige Werbungskosten', kz: '33' },
    51: { text: 'Geldbeschaffungskosten (z. B. Schätz-, Notar-, Grundbuchgebühren), abzugsfähige Werbungskosten', kz: '34' },
    54: { text: 'Renten, dauernde Lasten, abzugsfähige Werbungskosten', kz: '35' },
    55: { text: '2024 voll abzuziehende Erhaltungsaufwendungen (einschließlich Entnahmen aus der Erhaltungsrücklage), durch direkte Zuordnung ermittelt', kz: '36' },
    56: { text: '2024 voll abzuziehende Erhaltungsaufwendungen, durch verhältnismäßige Zuordnung ermittelt', kz: '37' },
    57: { text: 'Auf bis zu 5 Jahre zu verteilende Erhaltungsaufwendungen (§§ 11a, 11b EStG, § 82b EStDV), Gesamtaufwand 2024', kz: '57' },
    60: { text: 'Auf mehrere Jahre verteilte Erhaltungsaufwendungen aus 2024, abzugsfähige Werbungskosten', kz: '38' },
    63: { text: 'Verteilte Erhaltungsaufwendungen aus 2020, abzugsfähige Werbungskosten', kz: '39' },
    66: { text: 'Verteilte Erhaltungsaufwendungen aus 2021, abzugsfähige Werbungskosten', kz: '40' },
    69: { text: 'Verteilte Erhaltungsaufwendungen aus 2022, abzugsfähige Werbungskosten', kz: '41' },
    72: { text: 'Verteilte Erhaltungsaufwendungen aus 2023, abzugsfähige Werbungskosten', kz: '42' },
    75: { text: 'Umgelegte Kosten (z. B. Grundsteuer, Straßenreinigung, Müllabfuhr, Wasserversorgung, Entwässerung, Hausbeleuchtung, Heizung, Warmwasser, Schornsteinreinigung, Hausversicherungen, Hauswart, Treppenhausreinigung, Fahrstuhl), abzugsfähige Werbungskosten', kz: '52' },
    78: { text: 'Nicht umgelegte Kosten (z. B. Verwaltungskosten, Bank- und Kontoführungsgebühren ohne Erhaltungsrücklage), abzugsfähige Werbungskosten', kz: '48' },
    79: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: an das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer', kz: '58' },
    82: { text: 'Sonstige Kosten, abzugsfähige Werbungskosten', kz: '49' },
    83: { text: 'Summe der Werbungskosten (Summe der Zeilen 35, 38, 41, 45, 48, 51, 54, 55, 56, 60, 63, 66, 69, 72, 75, 78, 79 und 82)' },
    84: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: in den Werbungskosten laut Zeile 83 enthaltene abziehbare Vorsteuerbeträge', kz: '59' },
    85: { text: 'Überschuss (Einnahmen laut Zeile 32 abzüglich Werbungskosten laut Zeile 83)' },
    86: { text: 'Zurechnung des Betrags aus Zeile 85, Steuerpflichtige Person / Ehemann / Person A, Ehefrau / Person B', kz: '20/21' },
    87: { text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung (in %)', kz: '50' },
    88: { text: 'Betragsmäßige Kürzung der Werbungskosten wegen verbilligter Vermietung eines Teils des Objekts', kz: '51' },
    89: { text: '2024 vereinnahmte oder bewilligte Zuschüsse aus öffentlichen Mitteln zu den Anschaffungs- / Herstellungskosten (laut gesonderter Aufstellung)' }
  },

  /* DealPilot-Feld -> Zeile. quelle: formular (Abschrift) · auffang (Sonstige Kosten) · sachlogik (mit grund) */
  felder: {
    einnahmen_km: { zeile: 15, art: 'einnahme', quelle: 'formular' },
    einnahmen_nk: { zeile: 20, art: 'einnahme', quelle: 'formular' },
    afa: { zeile: 35, art: 'wk', quelle: 'formular' },
    schuldzinsen: { zeile: 48, art: 'wk', quelle: 'formular' },
    notar_grundschuld: { zeile: 51, art: 'wk', quelle: 'formular' },
    erhaltungsaufwand: { zeile: 55, art: 'wk', quelle: 'formular' },
    nk_umlf: { zeile: 75, art: 'wk', quelle: 'formular' },
    hausverwaltung: { zeile: 78, art: 'wk', quelle: 'formular' },
    kontofuehrung: { zeile: 78, art: 'wk', quelle: 'formular' },
    nk_n_umlf: { zeile: 78, art: 'wk', quelle: 'formular' },
    porto: { zeile: 82, art: 'wk', quelle: 'auffang' },
    fahrtkosten: { zeile: 82, art: 'wk', quelle: 'auffang' },
    verpflegung: { zeile: 82, art: 'wk', quelle: 'auffang' },
    hotel: { zeile: 82, art: 'wk', quelle: 'auffang' },
    inserat: { zeile: 82, art: 'wk', quelle: 'auffang' },
    gericht: { zeile: 82, art: 'wk', quelle: 'auffang' },
    telefon: { zeile: 82, art: 'wk', quelle: 'auffang' },
    sonst_kosten: { zeile: 82, art: 'wk', quelle: 'auffang' },
    verw_sonst: { zeile: 78, art: 'wk', quelle: 'auffang', grund: 'Verwaltungskosten, Zeile 78 nennt sie ausdrücklich; „sonstige" bleibt in derselben Gruppe.' },
    betr_sonst: { zeile: 78, art: 'wk', quelle: 'auffang', grund: 'Was nicht ausdrücklich umgelegt wird, gehört zu den nicht umgelegten Kosten. Wird es umgelegt, gehört es in Zeile 75.' },
    bereitstellung: { zeile: 48, art: 'wk', quelle: 'sachlogik', grund: 'Bereitstellungszinsen sind Zinsen. Die amtliche Anleitung rechnet auch Damnum / Disagio zu den Schuldzinsen.' },
    vermittlung: { zeile: 51, art: 'wk', quelle: 'sachlogik', grund: 'Eine Vermittlungsprovision für ein Darlehen gehört zu den Kosten der Geldbeschaffung, dieselbe Gruppe wie Schätz-, Notar- und Grundbuchgebühren.' },
    finanz_sonst: { zeile: 51, art: 'wk', quelle: 'sachlogik', grund: 'Sonstige Finanzierungsnebenkosten gehören zur Geldbeschaffung. Ist der Aufwand ein Zins, gehört er in Zeile 48.' },
    steuerber: { zeile: 82, art: 'wk', quelle: 'sachlogik', grund: 'Steuerberatungskosten sind Werbungskosten, soweit sie auf die Ermittlung der Einkünfte entfallen. Der auf den Mantelbogen entfallende Teil ist keine Anlage-V-Position.' },
    anschaffungsnah: { zeile: 35, art: 'wk', quelle: 'sachlogik', grund: 'Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) sind nicht sofort abziehbar; sie erhöhen die Bemessungsgrundlage und wirken über die AfA in Zeile 35.' },
    sonst_bewegl_wg: { zeile: 45, art: 'wk', quelle: 'formular' },
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
    av_renten: { zeile: 54, art: 'wk', quelle: 'formular' },
    av_erh_m1: { zeile: 72, art: 'wk', quelle: 'formular' },
    av_erh_m2: { zeile: 69, art: 'wk', quelle: 'formular' },
    av_erh_m3: { zeile: 66, art: 'wk', quelle: 'formular' },
    av_erh_m4: { zeile: 63, art: 'wk', quelle: 'formular' },
    av_ust_gezahlt: { zeile: 79, art: 'wk', quelle: 'formular' },
    av_vorsteuer: { zeile: 84, art: 'info', quelle: 'formular' },
    av_wohnflaeche: { zeile: 10, art: 'info', quelle: 'formular' },
    av_eigen_qm: { zeile: 11, art: 'info', quelle: 'formular' },
    av_kuerzung_pct: { zeile: 87, art: 'info', quelle: 'formular' },
    av_kuerzung_betrag: { zeile: 88, art: 'info', quelle: 'formular' },
    av_zuschuss_ahk: { zeile: 89, art: 'info', quelle: 'formular' },
    av_fewo: { zeile: 9, kz: '61', art: 'info', quelle: 'formular' },
    av_kurzfristig: { zeile: 9, kz: '63', art: 'info', quelle: 'formular' },
    av_angeh_flag: { zeile: 9, kz: '62', art: 'info', quelle: 'formular' },
    av_nk_nicht_vereinbart: { zeile: 24, art: 'info', quelle: 'formular' },
    av_anteil_pct: { zeile: null, art: 'info', quelle: 'formular', grund: 'Kein eigenes Feld: der Anteil steht je Posten in den Zeilen „durch verhältnismäßige Zuordnung ermittelt“ (siehe verh).' },
    av_zurechnung_a_pct: { zeile: 86, art: 'info', quelle: 'formular' }
  },

  nicht_erfasst: [
    { zeile: 38, text: 'Sonderabschreibung nach § 7b EStG. DealPilot rechnet sie und weist sie getrennt aus, sobald das Objekt eine Sonderabschreibung führt. Bei älteren gespeicherten Jahreswerten ist die Aufteilung nicht bekannt: steht auf diesem Blatt keine Zeile 38, obwohl die AfA einen § 7b-Anteil enthält, gehört dieser Teil laut Formular nicht in Zeile 35, sondern in Zeile 38.' }
  ]
};
