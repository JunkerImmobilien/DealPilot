/* ═══════════════════════════════════════════════════════════════════════════
   ANLAGE V · VERANLAGUNGSJAHR 2025 — ZEILENZUORDNUNG
   ───────────────────────────────────────────────────────────────────────────
   ABGESCHRIEBEN AUS DEM AMTLICHEN FORMULAR, nicht geraten.
   Quelle: `design/mockups/Anlage_V_2025.pdf` (von Marcel am 03.09.2026
   bereitgestellt, Formularkennung "2025AnlV103NET"). Die Zeilennummern und
   Kennzahlen wurden per Text- und Positionsauswertung aus dem PDF gelesen;
   das Skript dazu liegt im Sitzungs-Scratchpad (Subset-Font, UTF-16BE, Codes
   um 29 verschoben).

   WARUM DIESE DATEI EIN JAHR IM NAMEN TRAEGT: die Zeilennummern der Anlage V
   aendern sich je Veranlagungsjahr. Fuer 2026 entsteht eine eigene Datei aus
   dem dann gueltigen Formular. Gibt es fuer ein Jahr keine Datei, erscheint
   die Anlage-V-Ansicht NICHT — statt mit den Nummern des Vorjahres zu raten.
   Dasselbe Prinzip wie bei der Wertermittlung.

   ───────────────────────────────────────────────────────────────────────────
   ───────────────────────────────────────────────────────────────────────────
   JEDE ZUORDNUNG SAGT, WORAUF SIE BERUHT
   ───────────────────────────────────────────────────────────────────────────
   Marcel am 03.09.2026, nachdem er die erste Fassung gesehen hatte:
   „eigentlich müssten wir alles zuordnen können." Er hatte recht — und der
   Grund für die zwölf Lücken lag bei mir: ich hatte die Zeilen 73/75 des
   Formulars überlesen. Sie tragen die Überschrift

     „Umgelegte Kosten (z. B. Grundsteuer, Straßenreinigung, Müllabfuhr,
      Wasserversorgung, Entwässerung, Hausbeleuchtung, Heizung, Warmwasser,
      Schornsteinreinigung, Hausversicherungen, Hauswart, Treppenhaus-
      reinigung, Fahrstuhl)"

   — also genau die umlagefähigen Nebenkosten, die ich als „nicht zuordenbar"
   ausgewiesen hatte. Das Formular hatte die Antwort die ganze Zeit.

   Jetzt trägt jedes Feld ein `quelle`, und das ist wichtiger als die
   Zuordnung selbst: ein Leser muss unterscheiden können, was Abschrift ist
   und was Schlussfolgerung.

     'formular'  — die Kostenart steht WÖRTLICH in der Beispielliste der
                   Zeilenüberschrift. Abschrift, kein Urteil.
     'auffang'   — die Kostenart steht in KEINER spezielleren Liste. Das
                   Formular führt für diesen Fall Zeile 80/82 „Sonstige
                   Kosten"; die Zuordnung folgt aus seinem Aufbau.
     'sachlogik' — die Zuordnung folgt aus der Art des Aufwands, nicht aus
                   dem Formulartext. Mit Begründung, und in der Ansicht als
                   solche gekennzeichnet.

   Von 26 Feldern: 10 aus dem Formular, 10 über den Auffangposten, 5 aus
   Sachlogik, EINES bleibt offen (AfA auf bewegliche Wirtschaftsgüter — die
   Anlage V führt dafür keine eigene Zeile).

   ICH BIN KEIN STEUERBERATER. Die Abschriften sind Abschrift; alles andere
   ist gekennzeichnet, damit es geprüft werden kann statt geglaubt.
   ═══════════════════════════════════════════════════════════════════════════ */
window.AnlageV2025 = {
  jahr: 2025,
  formular: '2025AnlV103NET',
  quelle: 'design/mockups/Anlage_V_2025.pdf',

  /* Die Struktur des Formulars, soweit fuer die Aufstellung gebraucht.
     `kz` ist die amtliche Kennzahl, wo das Formular eine ausweist. */
  zeilen: {
    11: { text: 'Gesamtwohnfläche (in m²)' },
    12: { text: 'Eigengenutzter oder unentgeltlich an Dritte überlassener Wohnraum (in m²)' },
    13: { text: 'Mieteinnahmen für Wohnungen (ohne Umlagen / ohne Umsatzsteuer)' },
    15: { text: 'Summe der Mieteinnahmen für Wohnungen', kz: '01' },
    18: { text: 'Summe der Einnahmen für andere Räume', kz: '02' },
    19: { text: 'Einnahmen für an Angehörige vermietete Wohnungen', kz: '03' },
    20: { text: 'Auf die Zeilen 15 und 18 entfallende laufende Neben- / Betriebskosten' },
    21: { text: 'Erstattungen (negativer Betrag mit vorangestelltem Minuszeichen)' },
    22: { text: 'Auf Zeile 19 entfallende laufende Neben- / Betriebskosten' },
    25: { text: 'Vereinnahmte Mieten für frühere Jahre / verrechnete Mietkautionen / auf das Kalenderjahr entfallende Mietvorauszahlungen aus Baukostenzuschüssen', kz: '06' },
    26: { text: 'Einnahmen aus Vermietung von Garagen, Werbeflächen, Grund und Boden für Kioske usw.', kz: '07' },
    27: { text: 'Vereinnahmte Umsatzsteuer', kz: '09' },
    28: { text: 'Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer', kz: '10' },
    29: { text: 'Öffentliche Zuschüsse, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen und sonstige Einnahmen' },
    31: { text: 'Ergebnis der Zeilen 29 und 30', kz: '08' },
    32: { text: 'Summe der Einnahmen aus den Zeilen 15, 18 bis 28 und 31' },

    35: { text: 'Absetzung für Abnutzung für Gebäude — abzugsfähige Werbungskosten', kz: '30' },
    48: { text: 'Schuldzinsen (ohne Tilgungsbeträge) — abzugsfähige Werbungskosten', kz: '33' },
    51: { text: 'Geldbeschaffungskosten (z. B. Schätz-, Notar-, Grundbuchgebühren) — abzugsfähige Werbungskosten', kz: '34' },
    54: { text: 'Renten, dauernde Lasten — abzugsfähige Werbungskosten', kz: '35' },
    55: { text: 'Voll abzuziehende Erhaltungsaufwendungen (einschließlich Entnahmen aus der Erhaltungsrücklage)', kz: '36' },
    60: { text: 'Auf mehrere Jahre verteilte Erhaltungsaufwendungen aus 2025 — abzugsfähige Werbungskosten', kz: '38' },
    63: { text: 'Verteilte Erhaltungsaufwendungen aus 2021 — abzugsfähige Werbungskosten', kz: '39' },
    66: { text: 'Verteilte Erhaltungsaufwendungen aus 2022 — abzugsfähige Werbungskosten', kz: '40' },
    69: { text: 'Verteilte Erhaltungsaufwendungen aus 2023 — abzugsfähige Werbungskosten', kz: '41' },
    72: { text: 'Verteilte Erhaltungsaufwendungen aus 2024 — abzugsfähige Werbungskosten', kz: '42' },
    75: { text: 'Umgelegte Kosten (z. B. Grundsteuer, Straßenreinigung, Müllabfuhr, Wasserversorgung, Entwässerung, Hausbeleuchtung, Heizung, Warmwasser, Schornsteinreinigung, Hausversicherungen, Hauswart, Treppenhausreinigung, Fahrstuhl) — abzugsfähige Werbungskosten', kz: '52' },
    78: { text: 'Nicht umgelegte Kosten (z. B. Verwaltungskosten, Bank- und Kontoführungsgebühren ohne Erhaltungsrücklage) — abzugsfähige Werbungskosten', kz: '48' },
    79: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: an das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer', kz: '58' },
    82: { text: 'Sonstige Kosten — abzugsfähige Werbungskosten', kz: '49' },
    83: { text: 'Summe der Werbungskosten (Summe der Zeilen 35, 38, 41, 45, 48, 51, 54, 55, 56, 60, 63, 66, 69, 72, 75, 78, 79 und 82)' },
    85: { text: 'Überschuss (Einnahmen laut Zeile 32 abzüglich Werbungskosten laut Zeile 83)' },
    87: { text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung (in %)' },
    88: { text: 'Betragsmäßige Kürzung der Werbungskosten wegen verbilligter Vermietung eines Teils des Objekts', kz: '51' }
  },


  /* DealPilot-Feld -> Anlage-V-Zeile.
     `quelle` sagt, WORAUF die Zuordnung beruht — das ist wichtiger als die
     Zuordnung selbst, weil ein Leser wissen muss, was Abschrift ist und was
     Schlussfolgerung:

       'formular'  — die Kostenart steht WOERTLICH in der Beispielliste der
                     Zeilenueberschrift. Abschrift, kein Urteil.
       'auffang'   — die Kostenart steht in KEINER spezielleren Liste; das
                     Formular fuehrt fuer diesen Fall Zeile 80/82
                     "Sonstige Kosten". Die Zuordnung folgt aus dem Aufbau
                     des Formulars, nicht aus einer Meinung.
       'sachlogik' — die Zuordnung folgt aus der Art des Aufwands, nicht aus
                     dem Formulartext. MIT BEGRUENDUNG, und der Posten wird
                     in der Ansicht als solcher gekennzeichnet.
       null        — weiterhin offen. */
  felder: {
    einnahmen_km:     { zeile: 15, art: 'einnahme', quelle: 'formular' },
    einnahmen_nk:     { zeile: 20, art: 'einnahme', quelle: 'formular' },

    /* Abschrift — die Kostenart steht in der Zeilenueberschrift. */
    afa:              { zeile: 35, art: 'wk', quelle: 'formular' },
    schuldzinsen:     { zeile: 48, art: 'wk', quelle: 'formular' },
    notar_grundschuld:{ zeile: 51, art: 'wk', quelle: 'formular' },
    erhaltungsaufwand:{ zeile: 55, art: 'wk', quelle: 'formular' },
    nk_umlf:          { zeile: 75, art: 'wk', quelle: 'formular' },
    hausverwaltung:   { zeile: 78, art: 'wk', quelle: 'formular' },
    kontofuehrung:    { zeile: 78, art: 'wk', quelle: 'formular' },
    nk_n_umlf:        { zeile: 78, art: 'wk', quelle: 'formular' },

    /* Auffangposten — steht in keiner spezielleren Liste des Formulars. */
    porto:            { zeile: 82, art: 'wk', quelle: 'auffang' },
    fahrtkosten:      { zeile: 82, art: 'wk', quelle: 'auffang' },
    verpflegung:      { zeile: 82, art: 'wk', quelle: 'auffang' },
    hotel:            { zeile: 82, art: 'wk', quelle: 'auffang' },
    inserat:          { zeile: 82, art: 'wk', quelle: 'auffang' },
    gericht:          { zeile: 82, art: 'wk', quelle: 'auffang' },
    telefon:          { zeile: 82, art: 'wk', quelle: 'auffang' },
    sonst_kosten:     { zeile: 82, art: 'wk', quelle: 'auffang' },
    verw_sonst:       { zeile: 78, art: 'wk', quelle: 'auffang', grund: 'Verwaltungskosten — Zeile 78 nennt sie ausdrücklich; „sonstige" bleibt in derselben Gruppe.' },
    betr_sonst:       { zeile: 78, art: 'wk', quelle: 'auffang', grund: 'Was nicht ausdrücklich umgelegt wird, gehört zu den nicht umgelegten Kosten. Wird es umgelegt, gehört es in Zeile 75.' },

    /* Sachlogik — mit Begruendung, in der Ansicht gekennzeichnet. */
    bereitstellung:   { zeile: 48, art: 'wk', quelle: 'sachlogik', grund: 'Bereitstellungszinsen sind Zinsen. Die amtliche Anleitung rechnet auch Damnum / Disagio zu den Schuldzinsen.' },
    vermittlung:      { zeile: 51, art: 'wk', quelle: 'sachlogik', grund: 'Eine Vermittlungsprovision für ein Darlehen gehört zu den Kosten der Geldbeschaffung — dieselbe Gruppe wie Schätz-, Notar- und Grundbuchgebühren.' },
    finanz_sonst:     { zeile: 51, art: 'wk', quelle: 'sachlogik', grund: 'Sonstige Finanzierungsnebenkosten gehören zur Geldbeschaffung. Ist der Aufwand ein Zins, gehört er in Zeile 48.' },
    steuerber:        { zeile: 82, art: 'wk', quelle: 'sachlogik', grund: 'Steuerberatungskosten sind Werbungskosten, soweit sie auf die Ermittlung der Einkünfte entfallen. Der auf den Mantelbogen entfallende Teil ist keine Anlage-V-Position.' },
    anschaffungsnah:  { zeile: 35, art: 'wk', quelle: 'sachlogik', grund: 'Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) sind nicht sofort abziehbar; sie erhöhen die Bemessungsgrundlage und wirken über die AfA in Zeile 35.' },

    /* Weiterhin offen. */
    sonst_bewegl_wg:  { zeile: null, art: 'wk', grund: 'AfA auf bewegliche Wirtschaftsgüter (Einrichtung). Die Anlage V führt dafür keine eigene Zeile; ob sie zu den sonstigen Kosten (Zeile 82) gehört oder gesondert zu erläutern ist, hängt vom Einzelfall ab.' }
  },

  /* Was DealPilot gar nicht erfasst und deshalb in der Ansicht leer bleibt.
     Steht hier, damit die Ansicht es BENENNEN kann statt es wegzulassen. */
  nicht_erfasst: [
    { zeile: 19, text: 'Einnahmen für an Angehörige vermietete Wohnungen — DealPilot unterscheidet nicht nach Mieterkreis.' },
    { zeile: 25, text: 'Mieten für frühere Jahre, Mietkautionen, Mietvorauszahlungen — nicht erfasst.' },
    { zeile: 26, text: 'Einnahmen aus Garagen, Werbeflächen, Kiosken — in DealPilot Teil der Mieteinnahmen, nicht getrennt.' },
    { zeile: 27, text: 'Vereinnahmte Umsatzsteuer — DealPilot rechnet ohne Umsatzsteuer.' },
    { zeile: 28, text: 'Vom Finanzamt erstattete Umsatzsteuer — nicht erfasst.' },
    { zeile: 29, text: 'Öffentliche Zuschüsse, Guthabenzinsen — nicht erfasst.' },
    { zeile: 87, text: 'Kürzung wegen verbilligter Vermietung — DealPilot warnt seit v1216 vor der 66-%-Grenze, trägt die Kürzung aber nicht ein.' }
  ]
};
