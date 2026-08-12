// nhk2010.js — Normalherstellungskosten und Sachwertrechnung.
// ────────────────────────────────────────────────────────────────────────────
// WICHTIG: Die Kostenkennwerte unten sind ein GERUEST, keine Verordnungswerte.
// `geprueft: false` sperrt den Sachwert, bis sie gegen Anlage 4 ImmoWertV
// (NHK 2010) eingetragen sind. Erfundene Kennwerte waeren schlimmer als kein
// Sachwert — sie saehen aus wie eine Messung.
//
// Eintragen: die Tabelle in WERTE fuellen, dann `geprueft: true` setzen.
// Der Sachwert erscheint danach automatisch, ohne Codeaenderung.

export const NHK_2010 = {
  fassung: 'ImmoWertV 2021, Anlage 4 (NHK 2010)',
  geprueft: true,   // fuer die enthaltenen Gebaeudearten; 1.x-3.x fehlen (Grafik)
  basisjahr: 2010,

  /* Gebaeudetypen der NHK-2010-Systematik. Die Achsen sind Gebaeudeart,
   * Keller/Dachgeschoss und Standardstufe 1 bis 5. */
  /* Gebaeudearten nach Anlage 4, Nummer II. Die Nummern sind die der
   * Verordnung — so bleibt die Zuordnung nachpruefbar. */
  typen: {
    /* v1067-WSW-1 · Die Gebaeudearten 1. bis 3. (freistehende Ein- und
     * Zweifamilienhaeuser, Doppelhaeuser, Reihenhaeuser) sind in Anlage 4
     * als Grafik eingebunden und liessen sich nicht auslesen. Belegt ist
     * bisher GENAU EINE Zeile — sie steht in der Erlaeuterung zur SW-RL
     * 2012 vollstaendig mit Typennummer und allen fuenf Stufen.
     *
     * Die Typennummer kodiert die GEOMETRIE, nicht nur die Hausform.
     * Deshalb laesst sie sich nicht aus der Objektart ableiten, sondern
     * muss gefragt werden. */
    /* v1068-WNHK-1 · Die vollstaendige Tabelle der Gebaeudearten 1. bis 3.
     * QUELLE: Sachwertrichtlinie (SW-RL) vom 5. September 2012, Anlage 1
     * "Normalherstellungskosten 2010", amtlich veroeffentlicht im
     * Bundesanzeiger BAnz AT 18.10.2012 B1, Seite 11.
     *
     * Sie war bisher als "im Bundesgesetzblatt nur als Grafik" gefuehrt.
     * Das gilt fuer die Anlage 4 ImmoWertV — die SW-RL druckt dieselbe
     * Tabelle als TEXT, und sie ist die Quelle, auf die sich Anlage 4
     * bezieht.
     *
     * SYSTEMATIK DER TYPENNUMMER: <Haustyp>.<Geschosse><Dach>
     *   Haustyp   1 freistehend · 2 Doppel-/Reihenendhaus · 3 Reihenmittelhaus
     *   Geschosse 0 KG+EG · 1 KG+EG+OG · 2 EG ohne Keller · 3 EG+OG ohne Keller
     *   Dach      1 DG voll ausgebaut · 2 DG nicht ausgebaut · 3 Flachdach
     *
     * Die Nummer kodiert also die GEOMETRIE. Sie laesst sich nicht aus der
     * Objektart ableiten und wird im Formular aus drei Angaben gebildet. */
    '1.01': 'freistehendes Ein-/Zweifamilienhaus · Keller- und Erdgeschoss · Dachgeschoss voll ausgebaut',
    '1.02': 'freistehendes Ein-/Zweifamilienhaus · Keller- und Erdgeschoss · Dachgeschoss nicht ausgebaut',
    '1.03': 'freistehendes Ein-/Zweifamilienhaus · Keller- und Erdgeschoss · Flachdach oder flach geneigtes Dach',
    '1.11': 'freistehendes Ein-/Zweifamilienhaus · Keller-, Erd- und Obergeschoss · Dachgeschoss voll ausgebaut',
    '1.12': 'freistehendes Ein-/Zweifamilienhaus · Keller-, Erd- und Obergeschoss · Dachgeschoss nicht ausgebaut',
    '1.13': 'freistehendes Ein-/Zweifamilienhaus · Keller-, Erd- und Obergeschoss · Flachdach oder flach geneigtes Dach',
    '1.21': 'freistehendes Ein-/Zweifamilienhaus · Erdgeschoss, nicht unterkellert · Dachgeschoss voll ausgebaut',
    '1.22': 'freistehendes Ein-/Zweifamilienhaus · Erdgeschoss, nicht unterkellert · Dachgeschoss nicht ausgebaut',
    '1.23': 'freistehendes Ein-/Zweifamilienhaus · Erdgeschoss, nicht unterkellert · Flachdach oder flach geneigtes Dach',
    '1.31': 'freistehendes Ein-/Zweifamilienhaus · Erd- und Obergeschoss, nicht unterkellert · Dachgeschoss voll ausgebaut',
    '1.32': 'freistehendes Ein-/Zweifamilienhaus · Erd- und Obergeschoss, nicht unterkellert · Dachgeschoss nicht ausgebaut',
    '1.33': 'freistehendes Ein-/Zweifamilienhaus · Erd- und Obergeschoss, nicht unterkellert · Flachdach oder flach geneigtes Dach',
    '2.01': 'Doppelhaus/Reihenendhaus · Keller- und Erdgeschoss · Dachgeschoss voll ausgebaut',
    '2.02': 'Doppelhaus/Reihenendhaus · Keller- und Erdgeschoss · Dachgeschoss nicht ausgebaut',
    '2.03': 'Doppelhaus/Reihenendhaus · Keller- und Erdgeschoss · Flachdach oder flach geneigtes Dach',
    '2.11': 'Doppelhaus/Reihenendhaus · Keller-, Erd- und Obergeschoss · Dachgeschoss voll ausgebaut',
    '2.12': 'Doppelhaus/Reihenendhaus · Keller-, Erd- und Obergeschoss · Dachgeschoss nicht ausgebaut',
    '2.13': 'Doppelhaus/Reihenendhaus · Keller-, Erd- und Obergeschoss · Flachdach oder flach geneigtes Dach',
    '2.21': 'Doppelhaus/Reihenendhaus · Erdgeschoss, nicht unterkellert · Dachgeschoss voll ausgebaut',
    '2.22': 'Doppelhaus/Reihenendhaus · Erdgeschoss, nicht unterkellert · Dachgeschoss nicht ausgebaut',
    '2.23': 'Doppelhaus/Reihenendhaus · Erdgeschoss, nicht unterkellert · Flachdach oder flach geneigtes Dach',
    '2.31': 'Doppelhaus/Reihenendhaus · Erd- und Obergeschoss, nicht unterkellert · Dachgeschoss voll ausgebaut',
    '2.32': 'Doppelhaus/Reihenendhaus · Erd- und Obergeschoss, nicht unterkellert · Dachgeschoss nicht ausgebaut',
    '2.33': 'Doppelhaus/Reihenendhaus · Erd- und Obergeschoss, nicht unterkellert · Flachdach oder flach geneigtes Dach',
    '3.01': 'Reihenmittelhaus · Keller- und Erdgeschoss · Dachgeschoss voll ausgebaut',
    '3.02': 'Reihenmittelhaus · Keller- und Erdgeschoss · Dachgeschoss nicht ausgebaut',
    '3.03': 'Reihenmittelhaus · Keller- und Erdgeschoss · Flachdach oder flach geneigtes Dach',
    '3.11': 'Reihenmittelhaus · Keller-, Erd- und Obergeschoss · Dachgeschoss voll ausgebaut',
    '3.12': 'Reihenmittelhaus · Keller-, Erd- und Obergeschoss · Dachgeschoss nicht ausgebaut',
    '3.13': 'Reihenmittelhaus · Keller-, Erd- und Obergeschoss · Flachdach oder flach geneigtes Dach',
    '3.21': 'Reihenmittelhaus · Erdgeschoss, nicht unterkellert · Dachgeschoss voll ausgebaut',
    '3.22': 'Reihenmittelhaus · Erdgeschoss, nicht unterkellert · Dachgeschoss nicht ausgebaut',
    '3.23': 'Reihenmittelhaus · Erdgeschoss, nicht unterkellert · Flachdach oder flach geneigtes Dach',
    '3.31': 'Reihenmittelhaus · Erd- und Obergeschoss, nicht unterkellert · Dachgeschoss voll ausgebaut',
    '3.32': 'Reihenmittelhaus · Erd- und Obergeschoss, nicht unterkellert · Dachgeschoss nicht ausgebaut',
    '3.33': 'Reihenmittelhaus · Erd- und Obergeschoss, nicht unterkellert · Flachdach oder flach geneigtes Dach',
    '4.1': 'Mehrfamilienhäuser4  5 mit bis zu 6 WE',
    '4.2': 'Mehrfamilienhäuser4 5 mit 7 bis 20 WE',
    '4.3': 'Mehrfamilienhäuser4 5 mit mehr als 20 WE',
    '5.1': 'Wohnhäuser mit Mischnutzung7',
    '5.2': 'Banken und Geschäftshäuser mit Wohnungen',
    '5.3': 'Banken und Geschäftshäuser ohne Wohnungen',
    '6.1': 'Bürogebäude, Massivbau',
    '6.2': 'Bürogebäude, Stahlbetonskelettbau',
    '7.1': 'Gemeindezentren',
    '7.2': 'Saalbauten/Veranstaltungsgebäude',
    '8.1': 'Kindergärten',
    '8.2': 'Allgemeinbildende Schulen, Berufsbildende Schulen',
    '8.3': 'Sonderschulen',
    '9.1': 'Wohnheime/Internate',
    '9.2': 'Alten-/Pflegeheime',
    '10.1': 'Krankenhäuser/Kliniken',
    '10.2': 'Tageskliniken/Ärztehäuser',
    '11.1': 'Hotels',
    '12.1': 'Sporthallen (Einfeldhallen)',
    '12.2': 'Sporthallen (Dreifeldhallen/Mehrzweckhallen)',
    '12.3': 'Tennishallen',
    '12.4': 'Freizeitbäder/Heilbäder',
    '13.1': 'Verbrauchermärkte',
    '13.2': 'Kauf-/Warenhäuser',
    '13.3': 'Autohäuser ohne Werkstatt',
    '14.1': 'Einzelgaragen/Mehrfachgaragen',
    '14.2': 'Hochgaragen',
    '14.3': 'Tiefgaragen',
    '14.4': 'Nutzfahrzeuggaragen',
    '15.1': 'Betriebs-/Werkstätten, eingeschossig',
    '15.2': 'Betriebs-/Werkstätten, mehrgeschossig ohne Hallenanteil',
    '15.3': 'Betriebs-/Werkstätten, mehrgeschossig, hoher Hallenanteil',
    '15.4': 'Industrielle Produktionsgebäude, Massivbauweise',
    '15.5': 'Industrielle Produktionsgebäude, überwiegend Skelettbauweise',
    '16.1': 'Lagergebäude ohne Mischnutzung, Kaltlager',
    '16.2': 'Lagergebäude mit bis zu 25 % Mischnutzung',
    '16.3': 'Lagergebäude mit mehr als 25 % Mischnutzung',
    '17.1': 'Museen',
    '17.2': 'Theater',
    '17.3': 'Sakralbauten',
    '17.4': 'Friedhofsgebäude',
  },

  keller_dg: {
    kg_dg_ausgebaut: 'mit Keller, Dachgeschoss ausgebaut',
    kg_dg_nicht: 'mit Keller, Dachgeschoss nicht ausgebaut',
    ohne_kg_dg_ausgebaut: 'ohne Keller, Dachgeschoss ausgebaut',
    ohne_kg_flach: 'ohne Keller, Flachdach oder flach geneigt',
  },

  /* EUR je m2 Bruttogrundflaeche, Preisstand 2010.
   * Schluessel: <typ>|<keller_dg>|<standardstufe 1-5>
   * LEER = noch einzutragen. Solange leer, kein Sachwert. */
  /* Ausgelesen aus dem Verordnungstext (gesetze-im-internet.de, Anlage 4
   * ImmoWertV, BGBl. I 2021, 2824-2855) am 01.08.2026 — nicht geschaetzt.
   * Schluessel: <Gebaeudeart-Nr>|<Standardstufe>, EUR je m2 BGF, Stand 2010.
   *
   * NICHT ENTHALTEN: die Tabelle fuer freistehende Ein- und Zweifamilien-,
   * Doppel- und Reihenhaeuser (Gebaeudearten 1.x bis 3.x). Sie ist auf
   * gesetze-im-internet.de als Grafik eingebunden und laesst sich nicht aus
   * dem Text ziehen. Solange sie fehlt, rechnet der Sachwert fuer diese
   * Gebaeude nicht — geschaetzte Kennwerte waeren schlimmer als keine. */
  WERTE: {
    /* v1067-WSW-2 · 1.01 freistehendes Einfamilienhaus, Keller + Erd- +
     * voll ausgebautes Dachgeschoss. Quelle: SW-RL 2012, Erlaeuterung
     * Abschnitt 2.3 — dort als vollstaendige Zeile abgedruckt:
     *     Standardstufe   1     2     3      4       5
     *     Kostenkennwert  655   725   835    1.005   1.260
     * Nachgerechnet gegen das Anwendungsbeispiel derselben Quelle:
     * gewogener Kennwert 823,62 EUR/m2 bei gewogener Stufe 2,84. */
    /* v1068-WNHK-2 · 180 Kostenkennwerte, Gebaeudearten 1. bis 3.
     * SW-RL 2012, Anlage 1 (BAnz AT 18.10.2012 B1, Seite 11).
     * Baunebenkosten 17 Prozent sind enthalten (Fussnote 2).
     * Korrekturfaktor freistehende Zweifamilienhaeuser 1,05 (Fussnote 3).
     *
     * GEGENGEPRUEFT an vier Beispielen desselben Dokuments:
     *   Beispiel 1 (Mischkalkulation Unterkellerung):
     *     145,2 m2 x 785 (2.11) + 89,1 m2 x 865 (2.31) = 191.053,50 EUR
     *   Beispiel 2 (nicht unterkellerter Anbau):
     *     264 m2 x 785 (2.11) + 15 m2 x 1.105 (2.23)   = 223.815 EUR
     *   Beispiel 3 (Baupreisindex): 1.005 EUR fuer 1.01 Standardstufe 4
     *   Anwendungsbeispiel Anlage 2: 1.01 = 655/725/835/1.005/1.260
     * Dazu zwei Plausibilitaetsproben: jede Staffel steigt streng, und ein
     * Reihenmittelhaus ist in keiner Zelle teurer als ein freistehendes. */
    /* freistehendes Ein-/Zweifamilienhaus · Keller- und Erdgeschoss */
    '1.01|1': 655,
    '1.01|2': 725,
    '1.01|3': 835,
    '1.01|4': 1005,
    '1.01|5': 1260,
    '1.02|1': 545,
    '1.02|2': 605,
    '1.02|3': 695,
    '1.02|4': 840,
    '1.02|5': 1050,
    '1.03|1': 705,
    '1.03|2': 785,
    '1.03|3': 900,
    '1.03|4': 1085,
    '1.03|5': 1360,
    /* freistehendes Ein-/Zweifamilienhaus · Keller-, Erd- und Obergeschoss */
    '1.11|1': 655,
    '1.11|2': 725,
    '1.11|3': 835,
    '1.11|4': 1005,
    '1.11|5': 1260,
    '1.12|1': 570,
    '1.12|2': 635,
    '1.12|3': 730,
    '1.12|4': 880,
    '1.12|5': 1100,
    '1.13|1': 665,
    '1.13|2': 740,
    '1.13|3': 850,
    '1.13|4': 1025,
    '1.13|5': 1285,
    /* freistehendes Ein-/Zweifamilienhaus · Erdgeschoss, nicht unterkellert */
    '1.21|1': 790,
    '1.21|2': 875,
    '1.21|3': 1005,
    '1.21|4': 1215,
    '1.21|5': 1515,
    '1.22|1': 585,
    '1.22|2': 650,
    '1.22|3': 745,
    '1.22|4': 900,
    '1.22|5': 1125,
    '1.23|1': 920,
    '1.23|2': 1025,
    '1.23|3': 1180,
    '1.23|4': 1420,
    '1.23|5': 1775,
    /* freistehendes Ein-/Zweifamilienhaus · Erd- und Obergeschoss, nicht unterkellert */
    '1.31|1': 720,
    '1.31|2': 800,
    '1.31|3': 920,
    '1.31|4': 1105,
    '1.31|5': 1385,
    '1.32|1': 620,
    '1.32|2': 690,
    '1.32|3': 790,
    '1.32|4': 955,
    '1.32|5': 1190,
    '1.33|1': 785,
    '1.33|2': 870,
    '1.33|3': 1000,
    '1.33|4': 1205,
    '1.33|5': 1510,
    /* Doppelhaus/Reihenendhaus · Keller- und Erdgeschoss */
    '2.01|1': 615,
    '2.01|2': 685,
    '2.01|3': 785,
    '2.01|4': 945,
    '2.01|5': 1180,
    '2.02|1': 515,
    '2.02|2': 570,
    '2.02|3': 655,
    '2.02|4': 790,
    '2.02|5': 985,
    '2.03|1': 665,
    '2.03|2': 735,
    '2.03|3': 845,
    '2.03|4': 1020,
    '2.03|5': 1275,
    /* Doppelhaus/Reihenendhaus · Keller-, Erd- und Obergeschoss */
    '2.11|1': 615,
    '2.11|2': 685,
    '2.11|3': 785,
    '2.11|4': 945,
    '2.11|5': 1180,
    '2.12|1': 535,
    '2.12|2': 595,
    '2.12|3': 685,
    '2.12|4': 825,
    '2.12|5': 1035,
    '2.13|1': 625,
    '2.13|2': 695,
    '2.13|3': 800,
    '2.13|4': 965,
    '2.13|5': 1205,
    /* Doppelhaus/Reihenendhaus · Erdgeschoss, nicht unterkellert */
    '2.21|1': 740,
    '2.21|2': 825,
    '2.21|3': 945,
    '2.21|4': 1140,
    '2.21|5': 1425,
    '2.22|1': 550,
    '2.22|2': 610,
    '2.22|3': 700,
    '2.22|4': 845,
    '2.22|5': 1055,
    '2.23|1': 865,
    '2.23|2': 965,
    '2.23|3': 1105,
    '2.23|4': 1335,
    '2.23|5': 1670,
    /* Doppelhaus/Reihenendhaus · Erd- und Obergeschoss, nicht unterkellert */
    '2.31|1': 675,
    '2.31|2': 750,
    '2.31|3': 865,
    '2.31|4': 1040,
    '2.31|5': 1300,
    '2.32|1': 580,
    '2.32|2': 645,
    '2.32|3': 745,
    '2.32|4': 895,
    '2.32|5': 1120,
    '2.33|1': 735,
    '2.33|2': 820,
    '2.33|3': 940,
    '2.33|4': 1135,
    '2.33|5': 1415,
    /* Reihenmittelhaus · Keller- und Erdgeschoss */
    '3.01|1': 575,
    '3.01|2': 640,
    '3.01|3': 735,
    '3.01|4': 885,
    '3.01|5': 1105,
    '3.02|1': 480,
    '3.02|2': 535,
    '3.02|3': 615,
    '3.02|4': 740,
    '3.02|5': 925,
    '3.03|1': 620,
    '3.03|2': 690,
    '3.03|3': 795,
    '3.03|4': 955,
    '3.03|5': 1195,
    /* Reihenmittelhaus · Keller-, Erd- und Obergeschoss */
    '3.11|1': 575,
    '3.11|2': 640,
    '3.11|3': 735,
    '3.11|4': 885,
    '3.11|5': 1105,
    '3.12|1': 505,
    '3.12|2': 560,
    '3.12|3': 640,
    '3.12|4': 775,
    '3.12|5': 965,
    '3.13|1': 585,
    '3.13|2': 650,
    '3.13|3': 750,
    '3.13|4': 905,
    '3.13|5': 1130,
    /* Reihenmittelhaus · Erdgeschoss, nicht unterkellert */
    '3.21|1': 695,
    '3.21|2': 770,
    '3.21|3': 885,
    '3.21|4': 1065,
    '3.21|5': 1335,
    '3.22|1': 515,
    '3.22|2': 570,
    '3.22|3': 655,
    '3.22|4': 790,
    '3.22|5': 990,
    '3.23|1': 810,
    '3.23|2': 900,
    '3.23|3': 1035,
    '3.23|4': 1250,
    '3.23|5': 1560,
    /* Reihenmittelhaus · Erd- und Obergeschoss, nicht unterkellert */
    '3.31|1': 635,
    '3.31|2': 705,
    '3.31|3': 810,
    '3.31|4': 975,
    '3.31|5': 1215,
    '3.32|1': 545,
    '3.32|2': 605,
    '3.32|3': 695,
    '3.32|4': 840,
    '3.32|5': 1050,
    '3.33|1': 690,
    '3.33|2': 765,
    '3.33|3': 880,
    '3.33|4': 1060,
    '3.33|5': 1325,
    /* 4.1 Mehrfamilienhäuser4  5 mit bis zu 6 WE */
    '4.1|3': 825,
    '4.1|4': 985,
    '4.1|5': 1190,
    /* 4.2 Mehrfamilienhäuser4 5 mit 7 bis 20 WE */
    '4.2|3': 765,
    '4.2|4': 915,
    '4.2|5': 1105,
    /* 4.3 Mehrfamilienhäuser4 5 mit mehr als 20 WE */
    '4.3|3': 755,
    '4.3|4': 900,
    '4.3|5': 1090,
    /* 5.1 Wohnhäuser mit Mischnutzung7 */
    '5.1|3': 860,
    '5.1|4': 1085,
    '5.1|5': 1375,
    /* 5.2 Banken und Geschäftshäuser mit Wohnungen */
    '5.2|3': 890,
    '5.2|4': 1375,
    '5.2|5': 1720,
    /* 5.3 Banken und Geschäftshäuser ohne Wohnungen */
    '5.3|3': 930,
    '5.3|4': 1520,
    '5.3|5': 1900,
    /* 6.1 Bürogebäude, Massivbau */
    '6.1|3': 1040,
    '6.1|4': 1685,
    '6.1|5': 1900,
    /* 6.2 Bürogebäude, Stahlbetonskelettbau */
    '6.2|3': 1175,
    '6.2|4': 1840,
    '6.2|5': 2090,
    /* 7.1 Gemeindezentren */
    '7.1|3': 1130,
    '7.1|4': 1425,
    '7.1|5': 1905,
    /* 7.2 Saalbauten/Veranstaltungsgebäude */
    '7.2|3': 1355,
    '7.2|4': 1595,
    '7.2|5': 2085,
    /* 8.1 Kindergärten */
    '8.1|3': 1300,
    '8.1|4': 1495,
    '8.1|5': 1900,
    /* 8.2 Allgemeinbildende Schulen, Berufsbildende Schulen */
    '8.2|3': 1450,
    '8.2|4': 1670,
    '8.2|5': 2120,
    /* 8.3 Sonderschulen */
    '8.3|3': 1585,
    '8.3|4': 1820,
    '8.3|5': 2315,
    /* 9.1 Wohnheime/Internate */
    '9.1|3': 1000,
    '9.1|4': 1225,
    '9.1|5': 1425,
    /* 9.2 Alten-/Pflegeheime */
    '9.2|3': 1170,
    '9.2|4': 1435,
    '9.2|5': 1665,
    /* 10.1 Krankenhäuser/Kliniken */
    '10.1|3': 1720,
    '10.1|4': 2080,
    '10.1|5': 2765,
    /* 10.2 Tageskliniken/Ärztehäuser */
    '10.2|3': 1585,
    '10.2|4': 1945,
    '10.2|5': 2255,
    /* 11.1 Hotels */
    '11.1|3': 1385,
    '11.1|4': 1805,
    '11.1|5': 2595,
    /* 12.1 Sporthallen (Einfeldhallen) */
    '12.1|3': 1320,
    '12.1|4': 1670,
    '12.1|5': 1955,
    /* 12.2 Sporthallen (Dreifeldhallen/Mehrzweckhallen) */
    '12.2|3': 1490,
    '12.2|4': 1775,
    '12.2|5': 2070,
    /* 12.3 Tennishallen */
    '12.3|3': 1010,
    '12.3|4': 1190,
    '12.3|5': 1555,
    /* 12.4 Freizeitbäder/Heilbäder */
    '12.4|3': 2450,
    '12.4|4': 2985,
    '12.4|5': 3840,
    /* 13.1 Verbrauchermärkte */
    '13.1|3': 720,
    '13.1|4': 870,
    '13.1|5': 1020,
    /* 13.2 Kauf-/Warenhäuser */
    '13.2|3': 1320,
    '13.2|4': 1585,
    '13.2|5': 1850,
    /* 13.3 Autohäuser ohne Werkstatt */
    '13.3|3': 940,
    '13.3|4': 1240,
    '13.3|5': 1480,
    /* 14.1 Einzelgaragen/Mehrfachgaragen */
    '14.1|3': 245,
    '14.1|4': 485,
    '14.1|5': 780,
    /* 14.2 Hochgaragen */
    '14.2|3': 480,
    '14.2|4': 655,
    '14.2|5': 780,
    /* 14.3 Tiefgaragen */
    '14.3|3': 560,
    '14.3|4': 715,
    '14.3|5': 850,
    /* 14.4 Nutzfahrzeuggaragen */
    '14.4|3': 530,
    '14.4|4': 680,
    '14.4|5': 810,
    /* 15.1 Betriebs-/Werkstätten, eingeschossig */
    '15.1|3': 970,
    '15.1|4': 1165,
    '15.1|5': 1430,
    /* 15.2 Betriebs-/Werkstätten, mehrgeschossig ohne Hallenanteil */
    '15.2|3': 910,
    '15.2|4': 1090,
    '15.2|5': 1340,
    /* 15.3 Betriebs-/Werkstätten, mehrgeschossig, hoher Hallenanteil */
    '15.3|3': 620,
    '15.3|4': 860,
    '15.3|5': 1070,
    /* 15.4 Industrielle Produktionsgebäude, Massivbauweise */
    '15.4|3': 950,
    '15.4|4': 1155,
    '15.4|5': 1440,
    /* 15.5 Industrielle Produktionsgebäude, überwiegend Skelettbauweise */
    '15.5|3': 700,
    '15.5|4': 965,
    '15.5|5': 1260,
    /* 16.1 Lagergebäude ohne Mischnutzung, Kaltlager */
    '16.1|3': 350,
    '16.1|4': 490,
    '16.1|5': 640,
    /* 16.2 Lagergebäude mit bis zu 25 % Mischnutzung */
    '16.2|3': 550,
    '16.2|4': 690,
    '16.2|5': 880,
    /* 16.3 Lagergebäude mit mehr als 25 % Mischnutzung */
    '16.3|3': 890,
    '16.3|4': 1095,
    '16.3|5': 1340,
    /* 17.1 Museen */
    '17.1|3': 1880,
    '17.1|4': 2295,
    '17.1|5': 2670,
    /* 17.2 Theater */
    '17.2|3': 2070,
    '17.2|4': 2625,
    '17.2|5': 3680,
    /* 17.3 Sakralbauten */
    '17.3|3': 1510,
    '17.3|4': 2060,
    '17.3|5': 2335,
    /* 17.4 Friedhofsgebäude */
    '17.4|3': 1320,
    '17.4|4': 1490,
    '17.4|5': 1720,
  },

  /* Gewichtung der neun Gewerke fuer die Standardstufe (Anlage 4).
   * Ebenfalls gegen den Verordnungstext zu pruefen. */
  /* v1074-WAUS9-1 · Waegungsanteile der neun Gewerke, SW-RL 2012 Anlage 2
   * Tabelle 1 (BAnz AT 18.10.2012 B1). Summe exakt 100. Belegt gegen das
   * Anwendungsbeispiel derselben Anlage: gewogener Kostenkennwert 880 EUR/m2
   * BGF fuer Gebaeudeart 1.01 — nachgerechnet in gewogenerKennwert().
   * Die Verordnung gibt die Anteile nur fuer Ein- und Zweifamilienhaeuser;
   * fuer andere Gebaeudearten bleibt der gewogene Weg deshalb aus. */
  gewerke_gewicht: {
    aussenwaende: 23, dach: 15, fenster_tueren: 11,
    innenwaende: 11, decken_treppen: 11, fussboeden: 5,
    sanitaer: 9, heizung: 9, sonstige_technik: 6,
  },

  /* Korrekturfaktoren aus Anlage 4, Fussnoten zu den Wohngebaeuden.
   * Wohnungsgroesse wird linear zwischen den Stuetzstellen interpoliert. */
  korrektur_wohnungsgroesse: { 35: 1.10, 50: 1.00, 135: 0.85 },
  korrektur_grundriss: { einspaenner: 1.05, zweispaenner: 1.00, dreispaenner: 0.97, vierspaenner: 0.95 },

  /* Baunebenkosten sind in den Kennwerten bereits enthalten (Anlage 4 I.1 Abs. 3):
   * Mehrfamilienhaeuser 19 %, Wohnhaeuser mit Mischnutzung 18 %,
   * Banken und Geschaeftshaeuser 22 %, Buerogebaeude 18 %.
   * Nicht noch einmal aufschlagen. */
  baunebenkosten_enthalten: true,

  /* v1068-WNHK-3 · Fussnote 3 der Anlage 1 SW-RL: "Korrekturfaktor fuer
   * freistehende Zweifamilienhaeuser: 1,05". Er gilt NUR fuer die
   * Gebaeudearten 1.xx und NUR, wenn das Objekt tatsaechlich ein
   * Zweifamilienhaus ist. Bei einem Einfamilienhaus angewandt waeren es
   * fuenf Prozent zu viel.
   *
   * Baunebenkosten der Gebaeudearten 1. bis 3.: 17 Prozent, in den
   * Kennwerten enthalten (Fussnote 2). Nicht noch einmal aufschlagen. */
  /* v1072-WGAR-2 · Anlage 3 SW-RL: Einzelgaragen 60 Jahre ± 10. */
  gnd_garage: 60,
  korrektur_zweifamilienhaus: 1.05,
  baunebenkosten_1_3_pct: 17,

  /* Aussenanlagen: in der Verordnung nicht als fester Satz vorgegeben.
   * Bleibt eine Eingabe, kein Automatismus. */
  aussenanlagen_pct: null,
};

/* Schluessel ist <Gebaeudeart-Nr>|<Standardstufe>, z. B. '4.1|3'.
 * Die Keller/Dachgeschoss-Achse gilt nur fuer die Ein- und Zweifamilien-
 * haeuser (1.x-3.x), und genau deren Tabelle fehlt noch. */
export function nhkKennwert(typ, kellerDg, stufe) {
  if (!NHK_2010.geprueft) return null;
  /* v1047-WSTD-1 · Vorher: `Number(stufe) || 3`. Eine fehlende Angabe
   * wurde damit zu Stufe 3 — still. Gemessen an einer 165-m2-Wohnung:
   * 216.978 EUR statt 259.059 EUR bei Stufe 4. Zwischen Stufe 3 und 5
   * liegen bei 4.1 rund 44 Prozent; das laesst sich nicht mitteln. Ohne
   * Angabe erscheint das Verfahren nicht, wie bei jeder anderen fehlenden
   * Pflichtangabe auch. */
  const roh = Number(stufe);
  if (!Number.isFinite(roh) || roh < 1) return null;
  /* v1067-WSW-3 · Die Klemme galt pauschal fuer 3 bis 5 und hat damit
   * jedes Haus der Standardstufe 1 oder 2 still auf 3 gehoben. Bei Typ
   * 1.01 sind das 835 statt 655 EUR/m2 BGF — 27 Prozent zu viel, und der
   * Sachwert saeh aus wie gemessen.
   *
   * Die NHK 2010 fuehren die Stufen 1 und 2 NUR fuer die Gebaeudearten
   * 1. bis 3. Fuer alle uebrigen ist bei nicht mehr zeitgemaessen
   * Standardmerkmalen ein Abschlag sachverstaendig vorzunehmen — den
   * duerfen wir nicht durch Hochklemmen ersetzen, aber auch nicht
   * erfinden. Dort bleibt es deshalb bei 3 als Untergrenze. */
  const _wohnhaus = /^[123]\./.test(String(typ || ''));
  const _min = _wohnhaus ? 1 : 3;
  const st = Math.min(5, Math.max(_min, Math.round(roh)));
  const v = NHK_2010.WERTE[`${typ}|${st}`];
  return Number.isFinite(v) ? v : null;
}

/* v1074-WAUS9-2 · Gewogener Kostenkennwert nach SW-RL 2012 Anlage 2:
 * je Gewerk eine Standardstufe (halbe Stufen erlaubt, linear interpoliert),
 * der Kennwert ist die Summe der gewichteten Einzelkennwerte. Belegt gegen
 * das Anwendungsbeispiel der Anlage 2, Gebaeudeart 1.01: 880 EUR/m2 BGF.
 * NUR fuer die Gebaeudearten 1. bis 3. — die Verordnung gibt die
 * Waegungsanteile nur fuer Ein- und Zweifamilienhaeuser. */
export function gewogenerKennwert(typ, ausstattung) {
  if (!/^[123]\./.test(String(typ || ''))) {
    return { verfuegbar: false,
      grund: 'Wägungsanteile sind nur für Ein-/Zweifamilien-, Doppel- und Reihenhäuser belegt.' };
  }
  const G = NHK_2010.gewerke_gewicht;
  const keys = Object.keys(G);
  const a = ausstattung || {};
  const fehlt = keys.filter((k) => {
    const v = Number(a[k]);
    return !(Number.isFinite(v) && v >= 1 && v <= 5);
  });
  if (fehlt.length) {
    return { verfuegbar: false, fehlt,
      grund: 'Ausstattung nach Gewerken unvollständig ('
        + (keys.length - fehlt.length) + ' von 9 Stufen angegeben).' };
  }
  const kwStufe = (st) => {
    const lo = Math.floor(st), hi = Math.ceil(st);
    const w1 = NHK_2010.WERTE[typ + '|' + lo], w2 = NHK_2010.WERTE[typ + '|' + hi];
    if (!Number.isFinite(w1) || !Number.isFinite(w2)) return null;
    return w1 + (w2 - w1) * (st - lo);
  };
  let kw = 0, stufe = 0;
  const teile = [];
  for (const k of keys) {
    const st = Number(a[k]);
    const einzel = kwStufe(st);
    if (einzel == null) {
      return { verfuegbar: false,
        grund: 'Für ' + typ + ' fehlt ein Kostenkennwert der Stufe ' + st + '.' };
    }
    kw += (G[k] / 100) * einzel;
    stufe += (G[k] / 100) * st;
    teile.push({ gewerk: k, gewicht_pct: G[k], stufe: st,
      kennwert_eur_qm: Math.round(einzel * 100) / 100 });
  }
  return { verfuegbar: true,
    /* Rundung auf volle Euro wie im Anwendungsbeispiel der SW-RL (880). */
    kennwert_eur_qm: Math.round(kw),
    gewogene_stufe: Math.round(stufe * 100) / 100, teile,
    quelle: 'SW-RL 2012 Anlage 2 (Wägungsanteile), NHK 2010' };
}

/* Korrekturfaktoren fuer Wohngebaeude (Anlage 4, Fussnoten).
 * Wohnungsgroesse linear zwischen 35, 50 und 135 m2 WF je WE. */
export function korrekturWohnung({ wohnflaeche_je_we, grundriss }) {
  let f = 1;
  const w = Number(wohnflaeche_je_we);
  if (Number.isFinite(w) && w > 0) {
    const k = NHK_2010.korrektur_wohnungsgroesse;
    if (w <= 35) f *= k[35];
    else if (w >= 135) f *= k[135];
    else if (w <= 50) f *= k[35] + (k[50] - k[35]) * (w - 35) / 15;
    else f *= k[50] + (k[135] - k[50]) * (w - 50) / 85;
  }
  const g = NHK_2010.korrektur_grundriss[String(grundriss || '').toLowerCase()];
  if (g) f *= g;
  return Math.round(f * 1000) / 1000;
}

/**
 * Bruttogrundflaeche. Direkt angegeben schlaegt jede Naeherung.
 * Die Naeherung aus der Wohnflaeche ist grob und wird als solche gemeldet —
 * bei einem Mehrfamilienhaus ist sie unbrauchbar, weil Treppenhaus,
 * Keller und Nebenraeume je nach Gebaeude stark schwanken.
 */
export function bgf({ bgf_direkt, wohnflaeche_qm, objektart }) {
  const d = Number(bgf_direkt);
  if (Number.isFinite(d) && d > 0) return { wert: d, herkunft: 'direkt', verlaesslich: true };
  const w = Number(wohnflaeche_qm);
  if (!Number.isFinite(w) || w <= 0) return { wert: null, herkunft: null, verlaesslich: false };
  const istMfh = /mfh|mehrfamilien/i.test(String(objektart || ''));
  if (istMfh) {
    return { wert: null, herkunft: null, verlaesslich: false,
      hinweis: 'Bei Mehrfamilienhaeusern ist die Naeherung aus der Wohnflaeche zu ungenau. '
             + 'Bruttogrundflaeche bitte direkt angeben.' };
  }
  return { wert: Math.round(w * 1.55), herkunft: 'Naeherung aus Wohnflaeche', verlaesslich: false };
}

/**
 * Sachwert nach §§ 35–39 ImmoWertV.
 *
 * @param {object} ein
 * @param {object} bodenwertErgebnis  aus ErtragswertService.bodenwert()
 * @param {object} [param]  { sachwertfaktor, stufe, quelle } aus der Parametertabelle
 */
const GND_GARAGE = 60;   /* v1072-WGAR-3 · Anlage 3 SW-RL */

export function sachwert(ein, bodenwertErgebnis, param) {
  const out = {
    verfahren: 'Sachwertverfahren', rechtsgrundlage: '§§ 35–39 ImmoWertV 2021',
    staffel: [], hinweise: [], warnungen: [], wert: null, anwendbar: false,
  };

  if (!NHK_2010.geprueft) {
    out.grund = 'Die NHK-2010-Kostenkennwerte sind noch nicht hinterlegt. Solange sie fehlen, '
      + 'wird kein Sachwert ausgewiesen — ein geschätzter Herstellungskostenwert wäre '
      + 'irreführend, weil er wie eine Messung aussieht.';
    return out;
  }

  /* v1074-WAUS9-8 · Erst der gewogene Ausstattungsgrad (alle neun
   * Gewerke), sonst die glatte Standardstufe. KEIN halber Weg: fehlt ein
   * Gewerk, wird glatt gerechnet und der Umstand ausgewiesen. */
  let _gewogen = null;
  if (ein.ausstattung) {
    const _g = gewogenerKennwert(ein.nhk_typ, ein.ausstattung);
    if (_g.verfuegbar) _gewogen = _g;
    else out.hinweise.push('Ausstattung nach Gewerken nicht verwendet: ' + _g.grund
      + ' Gerechnet wurde mit der glatten Standardstufe.');
  }
  const kw = _gewogen ? _gewogen.kennwert_eur_qm
    : nhkKennwert(ein.nhk_typ, ein.keller_dg, ein.standardstufe);
  if (_gewogen) {
    out.ausstattung_gewogen = { gewogene_stufe: _gewogen.gewogene_stufe,
      teile: _gewogen.teile, quelle: _gewogen.quelle };
    out.hinweise.push('Kostenkennwert gewogen aus neun Gewerken (gewogene Standardstufe '
      + String(_gewogen.gewogene_stufe).replace('.', ',') + ') nach SW-RL 2012 Anlage 2.');
  }
  if (kw == null) {
    const istEfh = /^[123]\./.test(String(ein.nhk_typ || ''));
    out.grund = istEfh
      ? 'Für freistehende Ein- und Zweifamilien-, Doppel- und Reihenhäuser fehlt die '
        + 'Kostenkennwert-Tabelle noch. Sie ist im Verordnungstext als Grafik eingebunden '
        + 'und ließ sich nicht auslesen. Geschätzte Kennwerte wären irreführend.'
      : `Für ${ein.nhk_typ || 'diesen Gebäudetyp'} in Standardstufe `
        + `${ein.standardstufe || '?'} ist kein Kostenkennwert hinterlegt.`;
    return out;
  }
  /* Korrekturfaktoren fuer Wohnungsgroesse und Grundrissart. */
  const korr = korrekturWohnung({
    wohnflaeche_je_we: ein.wohnflaeche_je_we, grundriss: ein.grundriss,
  });

  const f = bgf(ein);
  if (!f.wert) {
    out.grund = f.hinweis || 'Ohne Bruttogrundfläche kein Sachwert.';
    return out;
  }
  if (!f.verlaesslich) {
    out.hinweise.push('Die Bruttogrundfläche wurde aus der Wohnfläche genähert (Faktor 1,55). '
      + 'Für ein belastbares Ergebnis bitte direkt angeben.');
  }

  const index = Number(ein.baupreisindex) || null;
  if (!index) { out.grund = 'Ohne Baupreisindex kein Sachwert.'; return out; }
  const regional = Number(ein.regionalfaktor) || 1.0;

  let herst = Math.round(kw * f.wert * index * regional * korr);   /* v1074-WBTL-2 · let: Bauteile kommen dazu */
  out.staffel.push({ pos: `Normalherstellungskosten (${kw} €/m² BGF × ${f.wert} m²)`, wert: Math.round(kw * f.wert) });
  if (korr !== 1) out.staffel.push({ pos: `× Korrektur Wohnungsgröße / Grundriss`, faktor: korr, wert: null });
  out.staffel.push({ pos: `× Baupreisindex ${index}`, faktor: index, wert: null });
  if (regional !== 1) out.staffel.push({ pos: `× Regionalfaktor ${regional}`, faktor: regional, wert: null });
  /* v1074-WBTL-1 · Sonstige Bauteile (Gauben, Balkone, Vordaecher,
   * Terrassen) als HERSTELLUNGSKOSTEN zum Stichtag — sie unterliegen
   * derselben Alterswertminderung wie das Gebaeude und stehen deshalb VOR
   * dem Abzug. bes_bauteile weiter unten bleibt der Zeitwert-Weg (Aufzug
   * u. ae.) und steht NACH dem Abzug. Eingaben sind heutige Preise; der
   * Baupreisindex wird NICHT noch einmal angewandt. */
  const _bauteile = Math.round(Number(ein.bauteile_hk) || 0);
  if (_bauteile > 0) {
    herst += _bauteile;
    out.staffel.push({ pos: '+ sonstige Bauteile (Gauben, Balkone, Vordächer, Terrassen)', wert: _bauteile });
    out.bauteile_hk_eur = _bauteile;
    if (ein.bauteile_detail) out.bauteile_detail = ein.bauteile_detail;
  }
  out.staffel.push({ pos: '= Herstellungskosten Gebäude', wert: herst, summe: true });

  const gnd = Number(ein.gnd_jahre), rnd = Number(ein.rnd_jahre);
  if (!gnd || rnd == null) { out.grund = 'Ohne Rest- und Gesamtnutzungsdauer kein Sachwert.'; return out; }
  const minderung = Math.round(herst * ((gnd - rnd) / gnd));
  out.staffel.push({ pos: `− Alterswertminderung (${gnd - rnd} von ${gnd} Jahren)`, wert: -minderung, summe: true });

  let geb = herst - minderung;
  const bes = Number(ein.bes_bauteile) || 0;
  if (bes) { geb += bes; out.staffel.push({ pos: '+ besondere Bauteile', wert: bes }); }
  /* v1072-WAUS-1 · Aussenanlagen als PROZENTSATZ des Gebaeudesachwerts.
   * Das Gutachten zu Loehner Str. 278 setzt 7 % an ("aufgrund der
   * Ausfuehrung der Aussenanlagen") und kommt auf 15.693 EUR — bei uns
   * standen null. Das Lued'scheider Sachwertmodell nennt 5 %,
   * Minden-Luebbecke feste Betraege (Kanal 2.900, Einfahrt 2.500 …).
   * Je nach Modell des Ausschusses das eine oder das andere; deshalb
   * BEIDE Wege, und der Eurobetrag hat Vorrang, weil er konkreter ist. */
  let aussen = Number(ein.aussenanlagen) || 0;
  let aussenHerkunft = aussen ? 'Betrag' : null;
  const _aussenPct = Number(ein.aussenanlagen_pct);
  if (!aussen && Number.isFinite(_aussenPct) && _aussenPct > 0) {
    aussen = Math.round(geb * _aussenPct / 100);
    aussenHerkunft = _aussenPct + ' % des Gebäudesachwerts';
  }
  if (!aussen && NHK_2010.aussenanlagen_pct) {
    aussen = Math.round(geb * NHK_2010.aussenanlagen_pct / 100);
    aussenHerkunft = NHK_2010.aussenanlagen_pct + ' % (Vorgabe)';
  }
  if (aussen) {
    geb += aussen;
    out.staffel.push({ pos: '+ Außenanlagen', detail: aussenHerkunft, wert: aussen });
    out.aussenanlagen_eur = aussen;
    out.aussenanlagen_herkunft = aussenHerkunft;
  }

  /* v1072-WGAR-1 · GARAGEN ALS EIGENE BAULICHE ANLAGE.
   * Die NHK 2010 fuehren fuer Garagen eigene Kostenkennwerte (Gebaeudeart
   * 14.1: 245 / 485 / 780 EUR/m2 BGF, Baunebenkosten 12 %). Das Gutachten
   * setzt die Garage mit rund 28.500 EUR an — bei uns fehlte sie ganz.
   *
   * Eigene Gesamtnutzungsdauer: Anlage 3 SW-RL nennt fuer Einzelgaragen
   * 60 Jahre. Sie mit den 80 Jahren des Hauses zu rechnen waere bequem und
   * falsch — eine Garage haelt nicht so lange wie ein Wohnhaus.
   *
   * Ohne Bruttogrundflaeche der Garage wird NICHT geschaetzt. Die Zahl der
   * Stellplaetze allein sagt nichts ueber die Flaeche. */
  const _garBgf = Number(ein.garagen_bgf_qm);
  if (Number.isFinite(_garBgf) && _garBgf > 0) {
    const _garStufe = Math.min(5, Math.max(3, Math.round(Number(ein.garagen_stufe) || 3)));
    const _garKw = NHK_2010.WERTE['14.1|' + _garStufe];
    if (Number.isFinite(_garKw)) {
      const _garGnd = Number(ein.garagen_gnd) || GND_GARAGE;
      const _garRnd = Number.isFinite(Number(ein.garagen_rnd))
        ? Number(ein.garagen_rnd)
        : Math.max(0, Math.min(_garGnd, rnd));
      const _garHerst = Math.round(_garKw * _garBgf * (index || 1));
      const _garMind = Math.round(_garHerst * ((_garGnd - _garRnd) / _garGnd));
      const _garWert = _garHerst - _garMind;
      geb += _garWert;
      out.staffel.push({
        pos: '+ Garage / Stellplatz',
        detail: _garBgf + ' m² × ' + _garKw + ' €/m² × ' + (index || 1)
          + ' − Alterswertminderung (' + Math.round(_garGnd - _garRnd) + ' von ' + _garGnd + ' Jahren)',
        wert: _garWert,
      });
      out.garage = {
        bgf_qm: _garBgf, standardstufe: _garStufe, kennwert_eur_qm: _garKw,
        gnd_jahre: _garGnd, rnd_jahre: _garRnd,
        herstellungskosten_eur: _garHerst, wert_eur: _garWert,
        quelle: 'NHK 2010, Gebäudeart 14.1 (Einzel-/Mehrfachgaragen); '
          + 'Gesamtnutzungsdauer 60 Jahre nach Anlage 3 SW-RL',
      };
    }
  }
  out.staffel.push({ pos: '= Gebäudesachwert', wert: geb, summe: true });
  /* v1056-WSW-1 · Diese Werte gab es nur als lokale Variablen. Die
   * Ergebniskarte las sw.gebaeude_sachwert_eur und bekam undefined —
   * sichtbar als "Gebäude –" neben einer korrekten Staffel. */
  out.gebaeude_sachwert_eur = geb;
  out.nhk_eur_qm_bgf = kw;   /* v1061-WFUS-4 · der tatsaechlich benutzte Kennwert */
  out.restnutzungsdauer_jahre = rnd;
  out.gesamtnutzungsdauer_jahre = gnd;
  out.alterswertminderung_eur = minderung;
  out.herstellungskosten_eur = herst;

  const bw = (bodenwertErgebnis && bodenwertErgebnis.vollstaendig) ? bodenwertErgebnis.wert : 0;
  if (!bw) out.warnungen.push('Ohne Bodenwert ist der Sachwert unvollständig — er besteht aus Gebäude UND Boden.');
  out.staffel.push({ pos: '+ Bodenwert', wert: bw });
  out.bodenwert_eur = bw || null;   /* v1056-WSW-2 */
  const vorlaeufig = geb + bw;
  out.vorlaeufiger_sachwert_eur = vorlaeufig;
  out.staffel.push({ pos: '= vorläufiger Sachwert', wert: vorlaeufig, summe: true });

  /* Marktanpassung. Ohne Sachwertfaktor bleibt es beim vorlaeufigen Sachwert —
   * der ist ein definierter Zwischenwert, aber KEIN Marktwert. In schwachen
   * Maerkten liegt der Faktor deutlich unter 1, in starken darueber. */
  /* v1144-SWFELD · FALSCHER FELDNAME, seit jeher.
   * Geliefert wird hier das Ergebnis von WertParameterService.sachwertfaktor()
   * bzw. hole() — beide geben `{ wert, stufe, quelle, … }` zurück. Ein Feld
   * `sachwertfaktor` gibt es in keinem der beiden Rückgabewege. Number(undefined)
   * ist NaN, `!swf` damit immer wahr: **der Sachwertfaktor wurde nie angewandt**,
   * weder als eigene Angabe (Stufe E) noch als amtlicher Wert.
   *
   * Am 2026-08-12 an Hermannstraße 9 gemessen: 1,15 stand im Objekt, kam als
   * `sachwertfaktor: 1.15` im Payload an — und blieb wirkungslos. Bei der ETW
   * fiel es nicht auf, weil für Wohnungen ohnehin kein Faktor angesetzt werden
   * darf; bei jedem Haus rechnet es still den vorläufigen Sachwert aus.
   *
   * `param.stufe` und `param.quelle` unten stimmen — nur der Wert war falsch
   * adressiert. Der alte Name bleibt als Rückfall stehen, falls ein Aufrufer
   * ihn doch setzt. */
  const swf = param && Number(param.wert != null ? param.wert : param.sachwertfaktor);
  if (!swf) {
    out.wert = vorlaeufig;
    out.marktangepasst = false;
    out.warnungen.push('Kein Sachwertfaktor verfügbar. Ausgewiesen ist der vorläufige Sachwert '
      + 'ohne Marktanpassung — das ist eine Herstellungskostenrechnung, kein Marktwert. '
      + 'Abweichungen von 30 % und mehr sind normal.');
    return out;
  }
  const marktwert = Math.round(vorlaeufig * swf);
  out.staffel.push({ pos: `× Sachwertfaktor ${String(swf).replace('.', ',')}`, faktor: swf, wert: null });
  out.staffel.push({ pos: '= marktangepasster Sachwert', wert: marktwert, summe: true });
  out.wert = marktwert;
  out.marktangepasst = true;
  out.sachwertfaktor = { wert: swf, stufe: param.stufe || null, quelle: param.quelle || null };
  out.anwendbar = true;
  return out;
}
