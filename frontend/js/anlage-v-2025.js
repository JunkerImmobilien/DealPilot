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

   Von 26 Feldern: 11 aus dem Formular, 10 über den Auffangposten, 5 aus
   Sachlogik. SEIT v1220 IST KEINES MEHR OFFEN: die AfA auf bewegliche
   Wirtschaftsgüter steht in Zeile 45 (Kz 60) — Marcel hatte auf sie
   hingewiesen, die Nummer stand zwölf Zeilen tiefer als vermutet.

   v3800 · ERWEITERT (Marcel 19.11.2026 nach dem Termin bei der Kanzlei:
   alles, was die Anlage V abfragt, muss eingebbar sein). Neu abgeschrieben aus
   demselben PDF (pdftotext -layout, 19.11.2026): Zeilen 16-18, 21-24, 30, 31
   (Kz 08), 54, 56, 57, 84, 86, 89 und die Kennzahlen 04, 05, 11, 12, 13, 37,
   50, 57, 59. Die Seitenkennungen lauten 2025AnlV101NET bis 2025AnlV104NET,
   Stand „September 2025" (hier stand bis v3800 nur die Kennung von Seite 3).
   Neu: `summen` - die Zeilen fuer Summe der Einnahmen, Summe der
   Werbungskosten, Ueberschuss und Paragraf 7b. Bis v3800 standen „Zeile 32/38/83/85"
   fest in drei Ansichten - das waeren fuer jedes andere Jahr alte Nummern.
   Gelesen wird diese Datei nur noch ueber js/anlage-v-kern.js.

   ICH BIN KEIN STEUERBERATER. Die Abschriften sind Abschrift; alles andere
   ist gekennzeichnet, damit es geprüft werden kann statt geglaubt.
   ═══════════════════════════════════════════════════════════════════════════ */
window.AnlageV2025 = {
  jahr: 2025,
  formular: '2025AnlV101NET–2025AnlV104NET',
  quelle: 'design/mockups/Anlage_V_2025.pdf',
  stand: 'September 2025',

  /* v3800 · Summenzeilen und Zeilen ohne eigenes DealPilot-Feld, je Jahr. */
  summen: { einnahmen: 32, zuschuesse_ergebnis: 31, werbungskosten: 83, ueberschuss: 85, sonder7b: 38,
            erh_verteilt_gesamt: 57, erh_verteilt_jahr: 60,
            /* v3800b · Einzelangaben, AfA-Angaben, Zurechnung */
            einzel_wohnung: 13, einzel_wohnung_weitere: 14, einzel_raum: 16, einzel_raum_weitere: 17,
            afa_angaben: 33, zurechnung: 86,
            /* Zeile 56 (Kz 37) ist selbst Summenzeile der verhaeltnismaessig zugeordneten Erhaltung */
            verh_selbst: [56] },

  /* v3800b · Summenzeile -> Zeile „durch verhaeltnismaessige Zuordnung ermittelt" (Gesamtbetrag,
     abzugsfaehiger Anteil). Abgeschrieben aus dem Formular Seite 2 bis 4: 33/34->35, 36/37->38,
     39/40->41, 42/43/44->45, 46/47->48, 49/50->51, 52/53->54, 55 direkt / 56 verhaeltnismaessig,
     58/59->60, 61/62->63, 64/65->66, 67/68->69, 70/71->72, 73/74->75, 76/77->78, 80/81->82.
     Zeile 79 (gezahlte Umsatzsteuer) kennt nur die direkte Zuordnung. */
  verh: { 35: 34, 38: 37, 41: 40, 45: 44, 48: 47, 51: 50, 54: 53, 55: 56, 60: 59, 63: 62, 66: 65, 69: 68, 72: 71, 75: 74, 78: 77, 82: 81 },

  /* Die Struktur des Formulars, soweit fuer die Aufstellung gebraucht.
     `kz` ist die amtliche Kennzahl, wo das Formular eine ausweist. */
  zeilen: {
    10: { text: 'Das Objekt wird ganz oder teilweise als Ferienwohnung genutzt (Kz 61) / kurzfristig vermietet (Kz 63) / an Angehörige zu Wohnzwecken vermietet (Kz 62) — 1 = Ja, 2 = Nein' },
    11: { text: 'Gesamtwohnfläche (in m²)', kz: '54' },
    12: { text: 'In Zeile 11 enthaltener eigengenutzter / unentgeltlich an Dritte überlassener Wohnraum (in m²)', kz: '55' },
    13: { text: 'Mieteinnahmen für Wohnungen (ohne Umlagen / ohne Umsatzsteuer) — Bezeichnung der Wohneinheit, Wohnfläche' },
    14: { text: 'Bezeichnung weiterer Wohneinheiten, Wohnfläche' },
    17: { text: 'Bezeichnung weiterer Einheiten, Nutzfläche' },
    33: { text: 'Absetzung für Abnutzung für Gebäude — durch direkte Zuordnung ermittelt: 1 = linear / 2 = degressiv, %, 1 = wie Vorjahr / 2 = laut Erläuterung' },
    15: { text: 'Summe der Mieteinnahmen für Wohnungen', kz: '01' },
    16: { text: 'Einnahmen für andere Räume (ohne Umlagen / ohne Umsatzsteuer) — Bezeichnung der Einheit, Nutzfläche' },
    18: { text: 'Summe der Einnahmen für andere Räume', kz: '02' },
    19: { text: 'Einnahmen für an Angehörige vermietete Wohnungen (ohne Umlagen / ohne Umsatzsteuer)', kz: '03' },
    20: { text: 'Auf die Zeilen 15 und 18 entfallende laufende Neben- / Betriebskosten', kz: '04' },
    21: { text: 'Auf die Zeilen 15 und 18 entfallende und im Jahr 2025 erhaltene Nachzahlungen / geleistete Erstattungen (negativen Betrag mit vorangestelltem Minuszeichen eintragen)', kz: '11' },
    22: { text: 'Auf Zeile 19 entfallende laufende Neben- / Betriebskosten', kz: '05' },
    23: { text: 'Auf Zeile 19 entfallende und im Jahr 2025 erhaltene Nachzahlungen / geleistete Erstattungen (negativen Betrag mit vorangestelltem Minuszeichen eintragen)', kz: '12' },
    24: { text: 'Neben- / Betriebskosten wurden nicht gesondert vereinbart (1 = Ja)', kz: '13' },
    25: { text: 'Vereinnahmte Mieten für frühere Jahre / verrechnete Mietkautionen / auf das Kalenderjahr entfallende Mietvorauszahlungen aus Baukostenzuschüssen', kz: '06' },
    26: { text: 'Einnahmen aus Vermietung von Garagen, Werbeflächen, Grund und Boden für Kioske usw.', kz: '07' },
    27: { text: 'Vereinnahmte Umsatzsteuer', kz: '09' },
    28: { text: 'Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer', kz: '10' },
    29: { text: 'Öffentliche Zuschüsse nach dem Wohnraumförderungsgesetz oder zu Erhaltungsaufwendungen, Aufwendungszuschüsse, Guthabenzinsen aus Bausparverträgen und sonstige Einnahmen' },
    30: { text: 'davon entfallen auf eigengenutzte oder unentgeltlich an Dritte überlassene Wohnungen laut Zeile 12' },
    31: { text: 'Ergebnis der Zeilen 29 und 30', kz: '08' },
    32: { text: 'Summe der Einnahmen aus den Zeilen 15, 18 bis 28 und 31' },

    35: { text: 'Absetzung für Abnutzung für Gebäude (ohne Beträge in den Zeilen 36 bis 41) — abzugsfähige Werbungskosten', kz: '30' },
    38: { text: 'Sonderabschreibung für Mietwohnungsneubau nach § 7b EStG — abzugsfähige Werbungskosten', kz: '70' },
    41: { text: 'Erhöhte Absetzungen nach den §§ 7h, 7i EStG und / oder nach dem Schutzbaugesetz — abzugsfähige Werbungskosten', kz: '31' },
    45: { text: 'Absetzung für Abnutzung für Wirtschaftsgüter, die keine Gebäude sind (z. B. bewegliche Wirtschaftsgüter) — abzugsfähige Werbungskosten', kz: '60' },
    48: { text: 'Schuldzinsen (ohne Tilgungsbeträge) — abzugsfähige Werbungskosten', kz: '33' },
    51: { text: 'Geldbeschaffungskosten (z. B. Schätz-, Notar-, Grundbuchgebühren) — abzugsfähige Werbungskosten', kz: '34' },
    54: { text: 'Renten, dauernde Lasten — abzugsfähige Werbungskosten', kz: '35' },
    55: { text: '2025 voll abzuziehende Erhaltungsaufwendungen (einschließlich Entnahmen aus der Erhaltungsrücklage) — durch direkte Zuordnung ermittelt', kz: '36' },
    56: { text: '2025 voll abzuziehende Erhaltungsaufwendungen — durch verhältnismäßige Zuordnung ermittelt', kz: '37' },
    57: { text: 'Auf bis zu 5 Jahre zu verteilende Erhaltungsaufwendungen (§§ 11a, 11b EStG, § 82b EStDV) — Gesamtaufwand 2025', kz: '57' },
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
    84: { text: 'Nur bei umsatzsteuerpflichtiger Vermietung: in den Werbungskosten laut Zeile 83 enthaltene abziehbare Vorsteuerbeträge', kz: '59' },
    85: { text: 'Überschuss (Einnahmen laut Zeile 32 abzüglich Werbungskosten laut Zeile 83)' },
    86: { text: 'Zurechnung des Betrags aus Zeile 85 — Steuerpflichtige Person / Ehemann / Person A, Ehefrau / Person B', kz: '20/21' },
    87: { text: 'Kürzung der Werbungskosten wegen verbilligter Vermietung (in %)', kz: '50' },
    88: { text: 'Betragsmäßige Kürzung der Werbungskosten wegen verbilligter Vermietung eines Teils des Objekts', kz: '51' },
    89: { text: '2025 vereinnahmte oder bewilligte Zuschüsse aus öffentlichen Mitteln zu den Anschaffungs- / Herstellungskosten (laut gesonderter Aufstellung)' }
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
    /* v1220: Marcel wies auf Zeile 36 hin. Im Formular 2025 ist 36 die
       Sonderabschreibung nach Paragraf 7b; die beweglichen Wirtschaftsgueter
       stehen in 42-45, Summe in Zeile 45 (Kz 60), woertlich: "Absetzung fuer
       Abnutzung fuer Wirtschaftsgueter, die keine Gebaeude sind (z. B.
       bewegliche Wirtschaftsgueter)". Der Sachverhalt stimmte, die Nummer
       nicht — genau dafuer ist die Abschrift da. */
    sonst_bewegl_wg:  { zeile: 45, art: 'wk', quelle: 'formular' },

    /* v3800 · Die weiteren Angaben der Anlage V (Bedeutung in js/anlage-v-kern.js FELDER).
       Abschrift: die Angabe ist genau die Zeilenueberschrift. */
    av_andere_raeume:   { zeile: 18, art: 'einnahme', quelle: 'formular' },
    av_angehoerige:     { zeile: 19, art: 'einnahme', quelle: 'formular' },
    av_nk_nachzahlung:  { zeile: 21, art: 'einnahme', quelle: 'formular' },
    av_nk_angehoerige:  { zeile: 22, art: 'einnahme', quelle: 'formular' },
    av_nk_nachz_angeh:  { zeile: 23, art: 'einnahme', quelle: 'formular' },
    av_fruehere_mieten: { zeile: 25, art: 'einnahme', quelle: 'formular' },
    /* Garagen und Werbeflaechen stehen woertlich in der Zeile; Antennen/Mobilfunk sind
       Ueberlassung von Dach- oder Grundflaechen - dieselbe Gruppe wie „Grund und Boden fuer
       Kioske usw.". Die Begruendung steht im Feld. */
    /* v3800b: Mobilfunkantennen nennt die ELSTER-Hilfe zur Anlage V 2025 zu Zeile 26 ausdruecklich
       (Grundstuecksteile fuer Mobilfunkantennen, Windkraftanlagen, WLAN-Hotspots) - Abschrift, keine Sachlogik. */
    av_garagen:         { zeile: 26, art: 'einnahme', quelle: 'formular' },
    av_ust_vereinnahmt: { zeile: 27, art: 'einnahme', quelle: 'formular' },
    av_ust_erstattet:   { zeile: 28, art: 'einnahme', quelle: 'formular' },
    av_zuschuesse:      { zeile: 29, art: 'einnahme', quelle: 'formular' },
    av_zuschuesse_eigen:{ zeile: 30, art: 'einnahme', quelle: 'formular' },
    av_7h7i:            { zeile: 41, art: 'wk', quelle: 'formular' },
    av_renten:          { zeile: 54, art: 'wk', quelle: 'formular' },
    /* „aus 2024" bis „aus 2021" - im Formular 2025 die Vorjahre 1 bis 4 */
    av_erh_m1:          { zeile: 72, art: 'wk', quelle: 'formular' },
    av_erh_m2:          { zeile: 69, art: 'wk', quelle: 'formular' },
    av_erh_m3:          { zeile: 66, art: 'wk', quelle: 'formular' },
    av_erh_m4:          { zeile: 63, art: 'wk', quelle: 'formular' },
    av_ust_gezahlt:     { zeile: 79, art: 'wk', quelle: 'formular' },
    av_vorsteuer:       { zeile: 84, art: 'info', quelle: 'formular' },
    av_wohnflaeche:     { zeile: 11, art: 'info', quelle: 'formular' },
    av_eigen_qm:        { zeile: 12, art: 'info', quelle: 'formular' },
    av_kuerzung_pct:    { zeile: 87, art: 'info', quelle: 'formular' },
    av_kuerzung_betrag: { zeile: 88, art: 'info', quelle: 'formular' },
    av_zuschuss_ahk:    { zeile: 89, art: 'info', quelle: 'formular' },
    /* v3800b */
    av_fewo:            { zeile: 10, kz: '61', art: 'info', quelle: 'formular' },
    av_kurzfristig:     { zeile: 10, kz: '63', art: 'info', quelle: 'formular' },
    av_angeh_flag:      { zeile: 10, kz: '62', art: 'info', quelle: 'formular' },
    av_nk_nicht_vereinbart: { zeile: 24, art: 'info', quelle: 'formular' },
    av_anteil_pct:      { zeile: null, art: 'info', quelle: 'formular', grund: 'Kein eigenes Feld: der Anteil steht je Posten in den Zeilen „durch verhältnismäßige Zuordnung ermittelt“ (siehe verh).' },
    av_zurechnung_a_pct:{ zeile: 86, art: 'info', quelle: 'formular' }
  },

  /* Was DealPilot nicht getrennt fuehrt und deshalb in der Ansicht benannt
     statt weggelassen wird. */
  nicht_erfasst: [
    /* v3800b · Ankreuzfelder (10, 24), Einzelangaben (13/14, 16/17), Zuordnungsart (33 ff.) und Zurechnung (86)
       sind seit v3800b eingebbar bzw. werden aus dem Objekt vorgeschlagen. Es bleibt der Hinweis zu Zeile 38. */
    { zeile: 38, text: 'Sonderabschreibung nach § 7b EStG — DealPilot rechnet sie und weist sie getrennt aus, sobald das Objekt eine Sonderabschreibung führt. Bei älteren gespeicherten Jahreswerten ist die Aufteilung nicht bekannt: steht auf diesem Blatt keine Zeile 38, obwohl die AfA einen § 7b-Anteil enthält, gehört dieser Teil laut Formular nicht in Zeile 35, sondern in Zeile 38.' }
  ]
};
