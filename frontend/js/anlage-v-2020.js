/* ═══════════════════════════════════════════════════════════════════════════
   ANLAGE V · VERANLAGUNGSJAHR 2020 · ZEILENZUORDNUNG (v3900)
   ───────────────────────────────────────────────────────────────────────────
   ABGESCHRIEBEN AUS DEM AMTLICHEN VORDRUCK, nicht geraten.
   Quelle: Formular-Management-System der Bundesfinanzverwaltung (formulare-bfinv.de),
   Steuerformulare › Einkommensteuer › Einkommensteuer 2020, Eintrag „080 Anlage V (2020)“,
   Vordruck 034032_20, abgerufen am 19.11.2026, Ablage design/mockups/Anlage_V_2020.pdf.
   Gelesen mit pdftotext -layout und, wo die Lage einer Kennzahl unklar war, mit den Wortpositionen (-bbox).
   Marcel 19.11.2026 („setz das für die Steuer so um“): Zeilen je Jahr hinterlegen und beim Speichern
   mitstempeln (js/anlage-v-kern.js stempel). Bedeutung der Felder und Quellenarten wie in anlage-v-2025.js.
   AUFBAU: der alte zweiseitige Vordruck (2020AnlV101NET, 2020AnlV102NET, Stand Juli 2020). Einnahmen
   Zeile 9 bis 21 (Mieten je Geschoss, keine Einzelzeilen je Wohnung), Werbungskosten Zeile 33 bis 51 je
   EINE Zeile mit Spalten (Gesamtbetrag, direkt / verhältnismäßig, abzugsfähig), daher keine Zeilen
   „durch verhältnismäßige Zuordnung ermittelt“ (verh nur für die Erhaltung 40/41). Die Kennzahl 08 (Ergebnis
   der Zuschüsse) steht in Zeile 20 (Wortposition im PDF). Keine Zeile für die Kürzung bei verbilligter
   Vermietung und kein Ankreuzfeld „Nebenkosten nicht gesondert vereinbart“. Die Gliederung der Kosten ist
   nach Kostenart (Zeile 47 Liste, 48 Verwaltung, 50 Sonstiges), nicht nach „umgelegt / nicht umgelegt“.
   ICH BIN KEIN STEUERBERATER. Abschrift ist Abschrift, alles andere ist gekennzeichnet (quelle, grund).
   Erzeugt aus den Abschriften, Pruefer: node tools/anlage-v-pruefen.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
window.AnlageV2020 = {
  jahr: 2020,
  formular: '2020AnlV101NET–2020AnlV102NET',
  quelle: 'Formular-Management-System der Bundesfinanzverwaltung (formulare-bfinv.de), Steuerformulare › Einkommensteuer › Einkommensteuer 2020, Vordruck 034032_20 „Anlage V (2020)“, abgerufen am 19.11.2026; Ablage design/mockups/Anlage_V_2020.pdf',
  stand: 'Juli 2020',

  /* Summenzeilen und Zeilen ohne eigenes DealPilot-Feld (Bedeutung wie in anlage-v-2025.js) */
  summen: { einnahmen: 21, zuschuesse_ergebnis: 20, werbungskosten: 51, ueberschuss: 23, sonder7b: 34, erh_verteilt_gesamt: 42, erh_verteilt_jahr: 42, afa_angaben: 33, zurechnung: 24, verh_selbst: [41] },

  /* Summenzeile -> Zeile „durch verhaeltnismaessige Zuordnung ermittelt" */
  verh: { 40: 41 },

  zeilen: {
    7: { text: 'Das Objekt wird ganz oder teilweise als Ferienwohnung genutzt (Kz 61) / kurzfristig vermietet (Kz 63) / an Angehörige zu Wohnzwecken vermietet (Kz 62), 1 = Ja, 2 = Nein' },
    8: { text: 'Gesamtwohnfläche (Kz 54), davon eigengenutzter oder unentgeltlich an Dritte überlassener Wohnraum (Kz 55), davon als Ferienwohnung genutzter Wohnraum (Kz 56), in m²' },
    9: { text: 'Mieteinnahmen für Wohnungen (ohne Umlagen), aufgeteilt nach Erdgeschoss, 1. Obergeschoss, 2. Obergeschoss, weitere Geschosse', kz: '01' },
    10: { text: 'Anzahl und Wohnfläche der Wohnungen je Geschoss' },
    11: { text: 'Mieteinnahmen für andere Räume (ohne Umlagen / Umsatzsteuer), je Geschoss', kz: '02' },
    12: { text: 'Einnahmen für an Angehörige zu Wohnzwecken vermietete Wohnungen (ohne Umlagen), Anzahl, Wohnfläche', kz: '03' },
    13: { text: 'Umlagen, verrechnet mit Erstattungen (z. B. Wassergeld, Flur- und Kellerbeleuchtung, Müllabfuhr, Zentralheizung usw.), auf die Zeilen 9 und 11 entfallen', kz: '04' },
    14: { text: 'Umlagen, verrechnet mit Erstattungen, auf die Zeile 12 entfallen', kz: '05' },
    15: { text: 'Vereinnahmte Mieten für frühere Jahre / verrechnete Mietkautionen / auf das Kalenderjahr entfallende Mietvorauszahlungen aus Baukostenzuschüssen', kz: '06' },
    16: { text: 'Einnahmen aus Vermietung von Garagen, Werbeflächen, Grund und Boden für Kioske usw.', kz: '07' },
    17: { text: 'Vereinnahmte Umsatzsteuer', kz: '09' },
    18: { text: 'Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer', kz: '10' },
    19: { text: 'Öffentliche Zuschüsse nach dem Wohnraumförderungsgesetz oder zu Erhaltungsaufwendungen, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen und sonstige Einnahmen (Gesamtbetrag)' },
    20: { text: 'davon entfallen auf eigengenutzte oder unentgeltlich an Dritte überlassene Wohnungen laut Zeile 8, Ergebnis', kz: '08' },
    21: { text: 'Summe der Einnahmen' },
    22: { text: 'Summe der Werbungskosten (Übertrag aus Zeile 51)' },
    23: { text: 'Überschuss (zu übertragen nach Zeile 24)' },
    24: { text: 'Zurechnung des Betrags aus Zeile 23, stpfl. Person / Ehemann / Person A / Gesellschaft, Ehefrau / Person B', kz: '20/21' },
    33: { text: 'Absetzung für Abnutzung für Gebäude (ohne Beträge in den Zeilen 34 und 35), linear / degressiv, %, wie 2019 / laut gesonderter Erläuterung', kz: '30' },
    34: { text: 'Sonderabschreibung für Mietwohnungsneubau nach § 7b EStG', kz: '70' },
    35: { text: 'Erhöhte Absetzungen nach den §§ 7h, 7i EStG, Schutzbaugesetz', kz: '31' },
    36: { text: 'Absetzung für Abnutzung für bewegliche Wirtschaftsgüter', kz: '60' },
    37: { text: 'Schuldzinsen (ohne Tilgungsbeträge)', kz: '33' },
    38: { text: 'Geldbeschaffungskosten (z. B. Schätz-, Notar-, Grundbuchgebühren)', kz: '34' },
    39: { text: 'Renten, dauernde Lasten', kz: '35' },
    40: { text: '2020 voll abzuziehende Erhaltungsaufwendungen, die direkt zugeordnet werden können', kz: '36' },
    41: { text: '2020 voll abzuziehende Erhaltungsaufwendungen, die verhältnismäßig zugeordnet werden', kz: '37' },
    42: { text: 'Auf bis zu 5 Jahre zu verteilende Erhaltungsaufwendungen (§§ 11a, 11b EStG, § 82b EStDV), Gesamtaufwand 2020 (Kz 57), davon 2020 abzuziehen (Kz 38)', kz: '38' },
    43: { text: 'Zu berücksichtigender Anteil aus 2016', kz: '39' },
    44: { text: 'Zu berücksichtigender Anteil aus 2017', kz: '40' },
    45: { text: 'Zu berücksichtigender Anteil aus 2018', kz: '41' },
    46: { text: 'Zu berücksichtigender Anteil aus 2019', kz: '42' },
    47: { text: 'Grundsteuer, Straßenreinigung, Müllabfuhr, Wasserversorgung, Entwässerung, Hausbeleuchtung, Heizung, Warmwasser, Schornsteinreinigung, Hausversicherungen, Hauswart, Treppenreinigung, Fahrstuhl', kz: '52' },
    48: { text: 'Verwaltungskosten', kz: '48' },
    49: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: an das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer', kz: '58' },
    50: { text: 'Sonstiges', kz: '49' },
    51: { text: 'Summe der Werbungskosten (zu übertragen nach Zeile 22)' },
    52: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: in Zeile 51 enthaltene abziehbare Vorsteuerbeträge', kz: '59' },
    53: { text: '2020 vereinnahmte oder bewilligte Zuschüsse aus öffentlichen Mitteln zu den Anschaffungs- / Herstellungskosten (laut gesonderter Aufstellung)' }
  },

  /* DealPilot-Feld -> Zeile. quelle: formular (Abschrift) · auffang (Sonstige Kosten) · sachlogik (mit grund) */
  felder: {
    einnahmen_km: { zeile: 9, art: 'einnahme', quelle: 'formular' },
    einnahmen_nk: { zeile: 13, art: 'einnahme', quelle: 'formular' },
    afa: { zeile: 33, art: 'wk', quelle: 'formular' },
    schuldzinsen: { zeile: 37, art: 'wk', quelle: 'formular' },
    notar_grundschuld: { zeile: 38, art: 'wk', quelle: 'formular' },
    erhaltungsaufwand: { zeile: 40, art: 'wk', quelle: 'formular' },
    nk_umlf: { zeile: 47, art: 'wk', quelle: 'formular' },
    hausverwaltung: { zeile: 48, art: 'wk', quelle: 'formular' },
    kontofuehrung: { zeile: 50, art: 'wk', quelle: 'auffang', grund: 'Der Vordruck 2020 nennt Kontoführungsgebühren in keiner Zeile (Zeile 48 nur „Verwaltungskosten“), sie stehen deshalb unter „Sonstiges“.' },
    nk_n_umlf: { zeile: 50, art: 'wk', quelle: 'sachlogik', grund: 'Der Vordruck 2020 gliedert nach Kostenarten, nicht danach, ob umgelegt wird. Nicht umlagefähige Nebenkosten (z. B. Instandhaltung im Hausgeld, Bankgebühren) stehen in keiner Liste und gehören unter „Sonstiges“. Kostenarten aus der Liste der Zeile 47 (z. B. nicht umgelegte Grundsteuer) gehören in Zeile 47, die Verwaltergebühr in Zeile 48.' },
    porto: { zeile: 50, art: 'wk', quelle: 'auffang' },
    fahrtkosten: { zeile: 50, art: 'wk', quelle: 'auffang' },
    verpflegung: { zeile: 50, art: 'wk', quelle: 'auffang' },
    hotel: { zeile: 50, art: 'wk', quelle: 'auffang' },
    inserat: { zeile: 50, art: 'wk', quelle: 'auffang' },
    gericht: { zeile: 50, art: 'wk', quelle: 'auffang' },
    telefon: { zeile: 50, art: 'wk', quelle: 'auffang' },
    sonst_kosten: { zeile: 50, art: 'wk', quelle: 'auffang' },
    verw_sonst: { zeile: 48, art: 'wk', quelle: 'auffang', grund: 'Verwaltungskosten, Zeile 48 nennt sie ausdrücklich. „Sonstige“ bleibt in derselben Gruppe.' },
    betr_sonst: { zeile: 50, art: 'wk', quelle: 'auffang', grund: 'Steht in keiner Liste des Vordrucks 2020. Gehört die Kostenart zur Liste der Zeile 47, gehört sie dorthin.' },
    bereitstellung: { zeile: 37, art: 'wk', quelle: 'sachlogik', grund: 'Bereitstellungszinsen sind Zinsen. Die amtliche Anleitung rechnet auch Damnum / Disagio zu den Schuldzinsen.' },
    vermittlung: { zeile: 38, art: 'wk', quelle: 'sachlogik', grund: 'Eine Vermittlungsprovision für ein Darlehen gehört zu den Kosten der Geldbeschaffung, dieselbe Gruppe wie Schätz-, Notar- und Grundbuchgebühren.' },
    finanz_sonst: { zeile: 38, art: 'wk', quelle: 'sachlogik', grund: 'Sonstige Finanzierungsnebenkosten gehören zur Geldbeschaffung. Ist der Aufwand ein Zins, gehört er in Zeile 37.' },
    steuerber: { zeile: 50, art: 'wk', quelle: 'sachlogik', grund: 'Steuerberatungskosten sind Werbungskosten, soweit sie auf die Ermittlung der Einkünfte entfallen. Der auf den Mantelbogen entfallende Teil ist keine Anlage-V-Position.' },
    anschaffungsnah: { zeile: 33, art: 'wk', quelle: 'sachlogik', grund: 'Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) sind nicht sofort abziehbar. Sie erhöhen die Bemessungsgrundlage und wirken über die AfA in Zeile 33.' },
    sonst_bewegl_wg: { zeile: 36, art: 'wk', quelle: 'formular' },
    av_andere_raeume: { zeile: 11, art: 'einnahme', quelle: 'formular' },
    av_angehoerige: { zeile: 12, art: 'einnahme', quelle: 'formular' },
    av_nk_nachzahlung: { zeile: 13, art: 'einnahme', quelle: 'formular', grund: 'Der Vordruck 2020 führt die Umlagen „verrechnet mit Erstattungen“: Nachzahlungen und Erstattungen stehen in derselben Zeile wie die Umlagen, eine eigene Zeile gibt es erst ab 2023.' },
    av_nk_angehoerige: { zeile: 14, art: 'einnahme', quelle: 'formular' },
    av_nk_nachz_angeh: { zeile: 14, art: 'einnahme', quelle: 'formular', grund: 'Wie bei Zeile 13: im Vordruck 2020 mit den Umlagen verrechnet.' },
    av_fruehere_mieten: { zeile: 15, art: 'einnahme', quelle: 'formular' },
    av_garagen: { zeile: 16, art: 'einnahme', quelle: 'formular' },
    av_ust_vereinnahmt: { zeile: 17, art: 'einnahme', quelle: 'formular' },
    av_ust_erstattet: { zeile: 18, art: 'einnahme', quelle: 'formular' },
    av_zuschuesse: { zeile: 19, art: 'einnahme', quelle: 'formular' },
    av_zuschuesse_eigen: { zeile: 20, art: 'einnahme', quelle: 'formular' },
    av_7h7i: { zeile: 35, art: 'wk', quelle: 'formular' },
    av_renten: { zeile: 39, art: 'wk', quelle: 'formular' },
    av_erh_m1: { zeile: 46, art: 'wk', quelle: 'formular' },
    av_erh_m2: { zeile: 45, art: 'wk', quelle: 'formular' },
    av_erh_m3: { zeile: 44, art: 'wk', quelle: 'formular' },
    av_erh_m4: { zeile: 43, art: 'wk', quelle: 'formular' },
    av_ust_gezahlt: { zeile: 49, art: 'wk', quelle: 'formular' },
    av_vorsteuer: { zeile: 52, art: 'info', quelle: 'formular' },
    av_wohnflaeche: { zeile: 8, kz: '54', art: 'info', quelle: 'formular' },
    av_eigen_qm: { zeile: 8, kz: '55', art: 'info', quelle: 'formular' },
    av_kuerzung_pct: { zeile: null, art: 'info', quelle: 'formular', grund: 'Der Vordruck 2020 hat keine Zeile für die Kürzung. Bei verbilligter Vermietung stehen die Werbungskosten nur mit dem entgeltlichen Teil in den Zeilen 33 bis 50 (verhältnismäßig ermittelt, Prozentsatz in Spalte 3, laut Anleitung zur Anlage V 2020).' },
    av_kuerzung_betrag: { zeile: null, art: 'info', quelle: 'formular', grund: 'Wie bei der Kürzung in Prozent: im Vordruck 2020 keine eigene Zeile.' },
    av_zuschuss_ahk: { zeile: 53, art: 'info', quelle: 'formular' },
    av_fewo: { zeile: 7, kz: '61', art: 'info', quelle: 'formular' },
    av_kurzfristig: { zeile: 7, kz: '63', art: 'info', quelle: 'formular' },
    av_angeh_flag: { zeile: 7, kz: '62', art: 'info', quelle: 'formular' },
    av_nk_nicht_vereinbart: { zeile: null, art: 'info', quelle: 'formular', grund: 'Im Vordruck 2020 gibt es dieses Ankreuzfeld nicht (erst ab 2023).' },
    av_anteil_pct: { zeile: null, art: 'info', quelle: 'formular', grund: 'Kein eigenes Feld: der Anteil steht je Zeile in Spalte 3 („verhältnismäßig ermittelt“).' },
    av_zurechnung_a_pct: { zeile: 24, art: 'info', quelle: 'formular' }
  },

  nicht_erfasst: [
    { zeile: 34, text: 'Sonderabschreibung nach § 7b EStG. DealPilot rechnet sie und weist sie getrennt aus, sobald das Objekt eine Sonderabschreibung führt. Bei älteren gespeicherten Jahreswerten ist die Aufteilung nicht bekannt: steht auf diesem Blatt keine Zeile 34, obwohl die AfA einen § 7b-Anteil enthält, gehört dieser Teil laut Formular nicht in Zeile 33, sondern in Zeile 34.' },
    { zeile: 10, text: 'Anzahl und Wohnfläche der Wohnungen je Geschoss, und die Aufteilung der Mieten in den Zeilen 9 und 11 auf die Geschosse. DealPilot führt die Geschosse nicht, bitte im Vordruck selbst aufteilen.' }
  ]
};
