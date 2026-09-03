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
   WAS HIER BEWUSST NICHT STEHT
   ───────────────────────────────────────────────────────────────────────────
   Nur Zuordnungen, bei denen die Formularbezeichnung EINDEUTIG ist —
   "Schuldzinsen" auf "Schuldzinsen", "Absetzung fuer Abnutzung fuer Gebaeude"
   auf die AfA. Wo die Zuordnung eine steuerfachliche Entscheidung waere
   (gehoeren Vermittlungskosten zu den Geldbeschaffungskosten oder zu den
   sonstigen Kosten?), steht `zeile: null` mit einem Grund.

   Solche Posten verschwinden NICHT — sie erscheinen in der Ansicht sichtbar
   ohne Zuordnung. Marcels Anforderung lautet "sollte nur vollstaendig sein",
   und vollstaendig heisst: jede Position ist zu sehen, auch die, fuer die
   DealPilot keine Zeile behaupten kann. Eine Anlage-V-Ansicht, in der eine
   Position stillschweigend fehlt, ist schlimmer als keine — sie sieht aus
   wie eine fertige Erklaerung.

   ICH BIN KEIN STEUERBERATER. Die eindeutigen Zuordnungen sind Abschrift,
   die offenen sind als offen gekennzeichnet.
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
    78: { text: 'Nicht umgelegte Kosten (z. B. Verwaltungskosten, Bank- und Kontoführungsgebühren ohne Erhaltungsrücklage) — abzugsfähige Werbungskosten', kz: '48' },
    82: { text: 'Sonstige Kosten — abzugsfähige Werbungskosten', kz: '49' },
    83: { text: 'Summe der Werbungskosten (Summe der Zeilen 35, 38, 41, 45, 48, 51, 54, 55, 56, 60, 63, 66, 69, 72, 75, 78, 79 und 82)' },
    85: { text: 'Überschuss (Einnahmen laut Zeile 32 abzüglich Werbungskosten laut Zeile 83)' },
    87: { text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung (in %)' },
    88: { text: 'Betragsmäßige Kürzung der Werbungskosten wegen verbilligter Vermietung eines Teils des Objekts', kz: '51' }
  },

  /* DealPilot-Feld -> Anlage-V-Zeile.
     `zeile: null` heisst: die Zuordnung waere eine steuerfachliche
     Entscheidung, keine Abschrift. Der Posten erscheint trotzdem. */
  felder: {
    einnahmen_km:     { zeile: 15, art: 'einnahme' },
    einnahmen_nk:     { zeile: 20, art: 'einnahme' },

    afa:              { zeile: 35, art: 'wk' },
    schuldzinsen:     { zeile: 48, art: 'wk' },
    notar_grundschuld:{ zeile: 51, art: 'wk' },
    erhaltungsaufwand:{ zeile: 55, art: 'wk' },
    hausverwaltung:   { zeile: 78, art: 'wk' },
    kontofuehrung:    { zeile: 78, art: 'wk' },

    bereitstellung:   { zeile: null, art: 'wk', grund: 'Bereitstellungszinsen — je nach Sachverhalt Zeile 48 (Schuldzinsen) oder 51 (Geldbeschaffungskosten). Keine Abschrift möglich.' },
    vermittlung:      { zeile: null, art: 'wk', grund: 'Vermittlungskosten — je nach Anlass Zeile 51 oder 82. Keine Abschrift möglich.' },
    finanz_sonst:     { zeile: null, art: 'wk', grund: 'Sammelposten; die Zeile hängt vom einzelnen Aufwand ab.' },
    nk_umlf:          { zeile: null, art: 'wk', grund: 'Umlagefähige Nebenkosten sind ein durchlaufender Posten und stehen zugleich als Einnahme in Zeile 20. Die Behandlung auf der Werbungskostenseite gehört geprüft.' },
    nk_n_umlf:        { zeile: null, art: 'wk', grund: 'Nicht umlagefähige Nebenkosten — meist Zeile 78, je nach Kostenart aber auch 82.' },
    betr_sonst:       { zeile: null, art: 'wk', grund: 'Sammelposten; die Zeile hängt vom einzelnen Aufwand ab.' },
    steuerber:        { zeile: null, art: 'wk', grund: 'Steuerberatungskosten — die Aufteilung auf Anlage V und Sonderausgaben ist eine Einzelfallfrage.' },
    porto:            { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    verw_sonst:       { zeile: null, art: 'wk', grund: 'Sammelposten; meist Zeile 78.' },
    fahrtkosten:      { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    verpflegung:      { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    hotel:            { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    inserat:          { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    gericht:          { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    telefon:          { zeile: null, art: 'wk', grund: 'Meist Zeile 82; keine ausdrückliche Formularbezeichnung.' },
    sonst_kosten:     { zeile: 82, art: 'wk' },
    sonst_bewegl_wg:  { zeile: null, art: 'wk', grund: 'AfA auf bewegliche Wirtschaftsgüter — Zeile 79, die Abgrenzung zum Gebäude gehört geprüft.' },
    anschaffungsnah:  { zeile: null, art: 'wk', grund: 'Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) gehen über die AfA in Zeile 35 ein, nicht als eigener Posten.' }
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
