/* v1072-WHIL-2 · Feldhilfen fuer die Flaechen- und Sachwertfelder.
 * Sie werden an window.MB_FELDHILFE angehaengt, damit die bestehende
 * Feldhilfe-Mechanik (data-fh) sie findet. */
window.MB_FELDHILFE = Object.assign(window.MB_FELDHILFE || {}, {
  hinterland: 'Nur die Fläche AUSSERHALB des Baulands. Beispiel Löhner Straße: '
    + '1.628 m² gesamt, davon 800 m² dem Haus zuzuordnendes Bauland und 828 m² '
    + 'rückwärtiges Garten- bzw. Hinterland. Hier gehören die 828 hinein, oben '
    + 'die 800. Nicht die gesamte Grundstücksfläche eintragen — sie würde doppelt '
    + 'gezählt.',
  hinterlandRent: 'Rentierlich heißt: die Fläche wirft einen Ertrag ab, etwa weil '
    + 'sie verpachtet ist. Das ist die Ausnahme. Eine nicht rentierliche Fläche '
    + 'geht in den Bodenwert ein, unterliegt aber nicht der Bodenwertverzinsung im '
    + 'Ertragswertverfahren (§ 41 ImmoWertV) — sonst mindert sie den '
    + 'Gebäudeertrag, obwohl sie gar keinen tragen soll.',
  hinterlandWert: 'Der Wertansatz je Quadratmeter. Übliche Größenordnung ist ein '
    + 'Bruchteil des Bodenrichtwerts: der Gutachterausschuss Minden-Lübbecke weist '
    + 'für private Grünflächen 5 €/m² aus (Spanne 1 bis 12); in Gutachten sind '
    + 'auch 20 Prozent des Bodenrichtwerts üblich. Ohne Angabe wird nicht '
    + 'geschätzt — der Wert hängt von Zuschnitt, Zuwegung und Nutzbarkeit ab.',
  /* v1142-GARMEA · Der Text sagte "aller Garagen zusammen" — bei einer
   * Eigentumswohnung genau die falsche Lesart. Der Wert geht ungekuerzt in
   * den Sachwert ein: lib/nhk2010.js kennt weder mea noch ist_wohnung.
   * Beim Bodenwert wird der Miteigentumsanteil abgezogen, hier NICHT, und
   * dieser Unterschied stand nirgends. Am Pruefobjekt Huellhorst standen
   * 64,58 m2 fuer eine von drei Einheiten — bis zu 18.500 EUR zu viel. */
  garagenBgf: 'Länge × Breite der Garagen, die zu <b>dieser</b> Bewertung '
    + 'gehören — nicht die Zahl der Stellplätze. Bei einer Eigentumswohnung '
    + 'also nur die eigene Garage oder der eigene Anteil; wird das ganze '
    + 'Gebäude bewertet, kommen alle hinein. <b>Der Miteigentumsanteil wird '
    + 'hier nicht automatisch abgezogen</b> — anders als beim Bodenwert. '
    + 'Die NHK 2010 führen für Garagen eigene Kostenkennwerte '
    + '(Gebäudeart 14.1) und eine eigene Gesamtnutzungsdauer von 60 Jahren — eine '
    + 'Garage hält nicht so lange wie das Wohnhaus. Ohne Fläche wird sie nicht '
    + 'angesetzt.',
  garagenStufe: 'Stufe 3 sind Fertiggaragen, Stufe 4 Massivbauweise, Stufe 5 '
    + 'massiv mit besonderer Ausführung (Ziegel- oder Gründach, Fliesen, Wasser '
    + 'und Heizung). Kostenkennwerte 245 / 485 / 780 €/m² BGF, Stand 2010.',
  aussenPct: 'Wege, Hofflächen, Einfriedungen, Ver- und Entsorgungsanlagen. '
    + 'Übliche Ansätze liegen zwischen 5 und 7 Prozent des Gebäudesachwerts; '
    + 'manche Gutachterausschüsse geben stattdessen feste Beträge vor '
    + '(Minden-Lübbecke: Kanal 2.900 €, Einfahrt 2.500 €, Terrasse 2.000 €). '
    + 'Ist oben ein Eurobetrag eingetragen, hat der Vorrang.',
  /* v1074-WAUS9-10 · Hilfen fuer die neuen Felder. */
  ausstGewerk: 'Feinere Alternative zur glatten Standardstufe nach SW-RL: je '
    + 'Gewerk eine Stufe 1–5, halbe Stufen erlaubt. Gerechnet wird nur, wenn '
    + 'alle neun Gewerke gesetzt sind — sonst gilt die glatte Standardstufe '
    + 'oben. Die Gewichte stehen in der Feldbezeichnung (Außenwände 23 % … '
    + 'sonstige Technik 6 %). Quelle: SW-RL 2012 Anlage 2.',
  bauteilHk: 'Herstellungskosten zum heutigen Stichtag, ohne erneute '
    + 'Indexierung. Sie unterliegen derselben Alterswertminderung wie das '
    + 'Gebäude. Größenordnung Beispiel Löhner Straße: Gauben 51.000, '
    + 'Balkone 13.000, Vordach 10.000, Terrassen 18.000, Sonstiges 3.000 €.',
});

/* wertermittlung.js — Zielfrage, Stufenfelder, Pflichtfeld-Ampel.
 * ────────────────────────────────────────────────────────────────────────────
 * Aufbau nach Konzept: EINE Frage am Anfang statt Checkboxen mittendrin.
 *
 *   Stufe 1  Schnelle Einschätzung     was schon da ist
 *   Stufe 2  Genaue Preisindikation    + Baustatus, Zustand, Qualität, Energie
 *   Stufe 3  Wertermittlung            + Bodenwert, Ertragswert, ggf. Sachwert
 *
 * Jederzeit hochschaltbar, ohne neu anzufangen — Eingetragenes bleibt stehen.
 *
 * HARTE REGEL: kein Verfahren rechnet halb. Entweder alle Pflichtangaben liegen
 * vor und es läuft, oder es erscheint gar nicht im Bericht. Kein stillschweigend
 * eingesetzter Standardwert. Genau dieser Fehler — ein unbemerkter Nullwert bei
 * den Bewirtschaftungskosten — hat im Test den Ertragswert um 13 % verschoben.
 *
 * Empfohlene Felder dürfen einen Annahmewert haben, aber nur sichtbar
 * gekennzeichnet. Pflichtfelder nie.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STUFE_KEY = 'dp_mb_stufe';

  /* ── Feldkatalog ───────────────────────────────────────────────────────── */
  /* pflicht: ohne das rechnet das Verfahren nicht.
     empfohlen: es rechnet, aber die Belastbarkeit sinkt. */
  var FELDER = {
    /* v1017 · Der Baustatus steht jetzt in STUFE 1.
     * Gemessen (Leipzig, 12 Monate, gleiche Flaeche): Erstbezug 14,47 EUR/m2
     * gegen 10,28 im vergleichbaren Bestand — 41 Prozent Unterschied. Kein
     * Feld aus Stufe 2 bewegt den Wert annaehernd so stark, und es kostet
     * einen Klick. In der Feinjustierung war es falsch aufgehoben. */
    stufe1: [
      /* ── v1201 · Der Miteigentumsanteil steht jetzt GANZ VORN ─────────────
         Marcels Entscheidung vom 02.09.2026: „der Miteigentumsanteil muss
         ausgefuellt werden als Pflichtwert, sonst kann man es nicht
         ausfuehren."

         Er stand bis hierher in `stufe3` und wurde erst gebaut, wenn jemand
         die Wertermittlung ansteuerte (`if (s >= 3)`). Damit war er bei
         Stufe 1 und 2 NICHT EINMAL SICHTBAR — eine Pflicht, die man nicht
         erfuellen kann, ist keine Pflicht, sondern eine Sackgasse.

         `wenn: istWohnung()` sorgt weiterhin dafuer, dass er nur bei
         Eigentumswohnungen erscheint; bei Haeusern gibt es ihn nach wie vor
         nicht. Der Eintrag ist unveraendert uebernommen, nur verschoben. */
      { id: 'mea', label: 'Miteigentumsanteil (%)', typ: 'number', hilfe: 'mea',
        pflichtWenn: function () { return istWohnung(); },
        wenn: function () { return istWohnung(); } },
      { id: 'baustatus', label: 'Baustatus', typ: 'select', pflicht: true, hilfe: 'baustatus',
        opt: [['bestand', 'Bestand'],
              ['bestand_erstbezug_saniert', 'Bestand \u2013 Erstbezug nach Sanierung'],
              ['neubau_erstbezug', 'Neubau \u2013 Erstbezug'],
              ['neubau_im_bau', 'Neubau \u2013 im Bau'],
              ['geplant', 'Geplant / Bautr\u00e4ger']] },
    ],

    stufe2: [
      { id: 'sanierungsjahr', label: 'Sanierungsjahr', typ: 'number', empfohlen: true,
        wenn: function () { return /saniert/.test(wert('baustatus')) || /saniert/.test(wert('cond')); } },
    ],
    /* v1016 · Nur fragen, was wir NICHT selbst herausfinden.
     * Liegenschaftszins kommt aus der Parametertabelle, der Bodenrichtwert
     * ueber BORIS. Beides braucht den Nutzer nur, wenn der Abruf nichts
     * liefert. Anpassung und Begruendung sind Feinjustierung fuer den
     * Sachverstaendigen. Die Stellplatzmiete ist ohne Stellplaetze sinnlos. */
    stufe3: [
      { id: 'plot', label: 'Grundst\u00fccksfl\u00e4che (m\u00b2)', typ: 'number', pflicht: true, hilfe: 'plot',
        vorhanden: true },
      { id: 'units', label: 'Anzahl Wohneinheiten', typ: 'number', pflicht: true, vorhanden: true },
      /* v1040 · Ohne Einschraenkung. Vorher nur bei Haeusern sichtbar — wer
       * eine Wohnung bewertete, fand das Feld nicht und konnte nicht wissen,
       * dass es es gibt. Die Hilfe erklaert, wofuer es gilt. */
      { id: 'bgf', label: 'Bruttogrundfl\u00e4che (m\u00b2)', typ: 'number', hilfe: 'bgf',
        platzhalter: 'nur f\u00fcr den Sachwert bei H\u00e4usern' },
      { id: 'spMiete', label: 'Stellplatzmiete (\u20ac/Monat)', typ: 'number',
        wenn: function () { return (parseFloat(wert('garages')) || 0) + (parseFloat(wert('outdoor')) || 0) > 0; } },

      /* v1047-WFELD-1 · Ohne Standardstufe kein Sachwert. Vorher wurde
       * stillschweigend Stufe 3 gerechnet — 42.000 EUR Unterschied bei
       * einer 165-m2-Wohnung, ausgewiesen als waere er ermittelt. Die
       * Sperre ohne dieses Feld waere eine Sackgasse gewesen. */
      /* v1057-WSON-5 · Kueche, Moeblierung, Werbeflaeche, Antennenanlage. */
      { id: 'sonstEinnahmen', label: 'Sonstige Einnahmen (\u20ac/Jahr)', typ: 'number' },

      /* v1067-WSW-4 · Ohne Gebaeudeart kein Sachwert fuer Haeuser.
       * CrossCheckService leitet sie nur fuer Wohnungen ab (4.1/4.2/4.3
       * nach Zahl der Einheiten) und uebergab fuer Haeuser null — der
       * Sachwert war fuer den haeufigsten Objekttyp im Markt tot
       * verdrahtet. Ableiten laesst sie sich nicht: die Typennummer der
       * NHK 2010 kodiert die Geometrie, nicht die Hausform. */
      /* v1068-WNHK-4 · Statt einer Liste mit 36 Eintraegen drei Fragen,
       * die die Typennummer bilden. Ein Sachverstaendiger weiss, ob das
       * Haus unterkellert ist und wie das Dach aussieht — er weiss nicht
       * auswendig, dass das "2.13" heisst. */
      /* v1071-WHIN-5 · Zwei Felder statt einer Vermutung. */
      /* v1072-WHIL-1 · Die Texte zu 'hinterland' und den neuen Feldern
       * fehlten — der Marker stand da, der Text nicht. */
      { id: 'hinterlandFlaeche', label: 'Zus\u00e4tzliche Grundst\u00fccksfl\u00e4che / Hinterland (m\u00b2)',
        typ: 'number', hilfe: 'hinterland',
        platzhalter: 'nur die Fl\u00e4che AUSSERHALB des Baulands' },
      /* v1072-WREN-6 · Der Haken aus dem Werkzeug des Sachverstaendigen. */
      { id: 'hinterlandRent', label: 'Zusatzfl\u00e4che ist rentierlich', typ: 'select',
        opt: [['', 'nein \u00b7 wirft keinen Ertrag ab (Standard)'],
                   ['ja', 'ja \u00b7 wird vermietet oder verpachtet']],
        hilfe: 'hinterlandRent',
        wenn: function () { return !!wert('hinterlandFlaeche'); } },
      { id: 'hinterlandWert', label: 'Wertansatz Hinterland (\u20ac/m\u00b2)', typ: 'number',
        platzhalter: 'z. B. 5 \u20ac/m\u00b2 (Gr\u00fcnfl\u00e4che Minden-L\u00fcbbecke)',
        pflichtWenn: function () { return !!wert('hinterlandFlaeche'); } },

      /* v1072-WGAR-6 · Ohne Bruttogrundflaeche der Garage wird nicht
       * geschaetzt — die Zahl der Stellplaetze sagt nichts ueber die
       * Flaeche. Im Gutachten sind es 64,58 m2 fuer zwei Garagen. */
      /* v1165-GARMEA2 \u00b7 Der Platzhalter widersprach der Feldhilfe, und zwar
       * an der teuersten Stelle. Die Hilfe (v1142) sagt \u201ebei einer
       * Eigentumswohnung nur die eigene Garage oder der eigene Anteil" \u2014
       * der Platzhalter sagte \u201ealle Garagen zusammen". Sichtbar ist der
       * Platzhalter; die Hilfe muss man aufklappen. Der Nutzer trug also
       * genau die Gesamtflaeche ein, die den Sachwert zu hoch macht:
       * lib/nhk2010.js kennt weder mea noch ist_wohnung und kuerzt nichts.
       * Am Pruefobjekt Huellhorst sind das 64,58 m2 fuer eine von drei
       * Einheiten, bis zu ~18.500 EUR zu viel.
       *
       * Das ist KEINE Vorwegnahme der fachlichen Frage aus Backlog-Punkt 10
       * (gehoert eine MEA-Kuerzung ins Feld oder nicht) \u2014 es raeumt nur den
       * Widerspruch zwischen zwei Texten weg, von denen einer falsch sein
       * MUSS. Die juengere, fachlich begruendete Fassung gewinnt. */
      { id: 'garagenBgf', label: 'Garage / Carport \u2013 Bruttogrundfl\u00e4che (m\u00b2)',
        typ: 'number', hilfe: 'garagenBgf',
        platzhalter: 'L\u00e4nge \u00d7 Breite \u2013 bei einer ETW nur der eigene Anteil' },
      { id: 'garagenStufe', label: 'Garage \u2013 Standardstufe', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['3', '3 \u00b7 Fertiggarage'],
                   ['4', '4 \u00b7 Massivbauweise'],
                   ['5', '5 \u00b7 Massiv mit besonderer Ausf\u00fchrung']],
        hilfe: 'garagenStufe',
        wenn: function () { return !!wert('garagenBgf'); },
        pflichtWenn: function () { return !!wert('garagenBgf'); } },
      { id: 'aussenPct', label: 'Au\u00dfenanlagen (% des Geb\u00e4udesachwerts)',
        typ: 'number', hilfe: 'aussenPct',
        platzhalter: 'z. B. 5 bis 7 \u2013 alternativ Betrag oben' },

      { id: 'nhkHaus', label: 'Hausform (NHK 2010)', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['1', 'freistehendes Ein-/Zweifamilienhaus'],
                   ['2', 'Doppelhaus / Reihenendhaus'],
                   ['3', 'Reihenmittelhaus']],
        wenn: function () { return !istWohnung(); },
        pflichtWenn: function () { return !istWohnung(); } },
      { id: 'nhkGeschosse', label: 'Geschosse und Unterkellerung', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['0', 'Keller- und Erdgeschoss'],
                   ['1', 'Keller-, Erd- und Obergeschoss'],
                   ['2', 'Erdgeschoss, nicht unterkellert'],
                   ['3', 'Erd- und Obergeschoss, nicht unterkellert']],
        wenn: function () { return !istWohnung(); },
        pflichtWenn: function () { return !istWohnung(); } },
      { id: 'nhkDach', label: 'Dachausbildung', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['1', 'Dachgeschoss voll ausgebaut'],
                   ['2', 'Dachgeschoss nicht ausgebaut'],
                   ['3', 'Flachdach oder flach geneigtes Dach']],
        wenn: function () { return !istWohnung(); },
        pflichtWenn: function () { return !istWohnung(); } },

      /* v1067-WSW-5 · Die Stufen 1 und 2 gibt es nur fuer Haeuser. Sie
       * hier anzubieten, wo die Tabelle sie nicht hat, waere eine
       * Einladung zu einem stillen Ersatzwert. */
      { id: 'standardstufe', label: 'Standardstufe (NHK 2010)', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['1', '1 \u00b7 sehr einfach (nur H\u00e4user)'],
                   ['2', '2 \u00b7 einfach (nur H\u00e4user)'],
                   ['3', '3 \u00b7 Standard'],
                   ['4', '4 \u00b7 gehoben'],
                   ['5', '5 \u00b7 stark gehoben']],
        hilfe: 'standardstufe' },

      /* v1074-WAUS9-6 · Ausstattung nach Gewerken (SW-RL 2012 Anlage 2).
       * Alle neun oder gar nicht — sonst gilt die glatte Stufe oben. */
      { id: 'ausstAussenwaende', label: 'Au\u00dfenw\u00e4nde \u00b7 23 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstDach', label: 'Dach \u00b7 15 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstFenster', label: 'Fenster/Au\u00dfent\u00fcren \u00b7 11 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstInnenwaende', label: 'Innenw\u00e4nde \u00b7 11 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstDecken', label: 'Decken/Treppen \u00b7 11 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstFussboeden', label: 'Fu\u00dfb\u00f6den \u00b7 5 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstSanitaer', label: 'Sanit\u00e4r \u00b7 9 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstHeizung', label: 'Heizung \u00b7 9 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },
      { id: 'ausstTechnik', label: 'sonst. Technik \u00b7 6 %', typ: 'select',
        opt: [['', '\u2013'], ['1', '1'], ['1.5', '1,5'], ['2', '2'], ['2.5', '2,5'], ['3', '3'], ['3.5', '3,5'], ['4', '4'], ['4.5', '4,5'], ['5', '5']],
        wenn: function () { return !istWohnung(); }, hilfe: 'ausstGewerk' },

      /* v1062-WAUS-1 · Beide Betraege gehen seit jeher durch nhk2010.js und
       * hatten nie ein Feld — der Sachwert rechnete sie mit 0.
       * KEINE Baunebenkosten hier: die NHK-2010-Kennwerte enthalten sie
       * bereits (NHK_2010.baunebenkosten_enthalten). Ein eigenes Feld waere
       * eine Doppelzaehlung. */
      { id: 'aussenanlagen', label: 'Au\u00dfenanlagen (\u20ac)', typ: 'number',
        platzhalter: 'Wege, Einfriedung, Ver- und Entsorgung' },
      { id: 'besBauteile', label: 'Besondere Bauteile (\u20ac)', typ: 'number',
        platzhalter: 'z. B. Aufzug \u00b7 ohne Baunebenkosten (in NHK enthalten)' },

      /* v1074-WBTL-6 · Sonstige Bauteile: Herstellungskosten HEUTE,
       * gleiche Alterswertminderung wie das Gebaeude (vor dem Abzug). */
      { id: 'btlGauben', label: 'Dachgauben (\u20ac)', typ: 'number',
        wenn: function () { return !istWohnung(); }, hilfe: 'bauteilHk' },
      { id: 'btlBalkone', label: 'Balkone (\u20ac)', typ: 'number',
        wenn: function () { return !istWohnung(); }, hilfe: 'bauteilHk' },
      { id: 'btlVordach', label: 'Vord\u00e4cher / Eingangsvorbau (\u20ac)', typ: 'number',
        wenn: function () { return !istWohnung(); }, hilfe: 'bauteilHk' },
      { id: 'btlTerrassen', label: 'Terrassen (\u20ac)', typ: 'number',
        wenn: function () { return !istWohnung(); }, hilfe: 'bauteilHk' },
      { id: 'btlSonstige', label: 'Weitere Bauteile (\u20ac)', typ: 'number',
        wenn: function () { return !istWohnung(); }, hilfe: 'bauteilHk' },

      /* Korrekturfaktor aus Anlage 4, Fussnote 5 — lag fertig im Rechenkern
       * und hatte nie ein Feld. Die Beschriftung erklaert ihn, statt nur
       * den Fachbegriff hinzustellen. */
      { id: 'grundriss', label: 'Grundrissart', typ: 'select',
        opt: [['', '\u2013 keine Angabe \u2013'],
                   ['einspaenner', 'Einsp\u00e4nner \u00b7 1 Wohnung je Treppenhaus (\u00d7 1,05)'],
                   ['zweispaenner', 'Zweisp\u00e4nner \u00b7 2 Wohnungen (\u00d7 1,00)'],
                   ['dreispaenner', 'Dreisp\u00e4nner \u00b7 3 Wohnungen (\u00d7 0,97)'],
                   ['vierspaenner', 'Viersp\u00e4nner \u00b7 4 Wohnungen (\u00d7 0,95)']],
        hilfe: 'grundriss',
        wenn: function () { return istWohnung() || (parseFloat(wert('units')) || 0) > 2; } },

      /* Anlage 2 laesst ausdruecklich beide Wege zu: Punktevergabe je
       * Bauteil ODER sachverstaendige Einschaetzung des Grades. Der zweite
       * ist im Formular zumutbar, der erste waere ein eigener Dialog.
       * Die Zahlen sind die Mitten der Baender aus Tabelle 2. */
      { id: 'modGrad', label: 'Modernisierungsgrad (Anlage 2)', typ: 'select',
        opt: [['', '\u2013 keine Angabe, wird gesch\u00e4tzt \u2013'],
                   ['0', 'nicht modernisiert'],
                   ['4', 'kleine Modernisierungen im Rahmen der Instandhaltung'],
                   ['8', 'mittlerer Modernisierungsgrad'],
                   ['14', '\u00fcberwiegend modernisiert'],
                   ['19', 'umfassend modernisiert']],
        hilfe: 'modGrad' },
    ],

    /* Nur fuer den Ausnahmefall — eingeklappt, klar beschriftet. */
    experte: [
      { id: 'brwManuell', label: 'Bodenrichtwert (\u20ac/m\u00b2)', typ: 'number', hilfe: 'brwManuell',
        platzhalter: 'leer = amtlicher Abruf' },
      { id: 'brwStichtag', label: 'Stichtag des Bodenrichtwerts', typ: 'text',
        platzhalter: 'z. B. 2024-01-01',
        pflichtWenn: function () { return !!wert('brwManuell'); } },
      { id: 'lzs', label: 'Liegenschaftszinssatz (%)', typ: 'number', hilfe: 'lzs',
        platzhalter: 'leer = amtlicher bzw. gesetzlicher Wert' },
      { id: 'sachwertfaktor', label: 'Sachwertfaktor', typ: 'number', hilfe: 'sachwertfaktor',
        platzhalter: 'leer = aus der Parametertabelle',
        wenn: function () { return !istWohnung(); } },
      { id: 'brwAnp', label: 'Bodenwert-Anpassung (%)', typ: 'number', hilfe: 'brwAnp' },
      { id: 'brwAnpGrund', label: 'Begr\u00fcndung der Anpassung', typ: 'text',
        pflichtWenn: function () { return !!wert('brwAnp'); } },
    ],
  };

  /* Welche Angaben welches Verfahren braucht. */
  var VERFAHREN = [
    { key: 'markt', name: 'Marktpreisindikation', ab: 1,
      /* v1014b · 'living' gibt es nicht — das Feld heisst 'area'. Deshalb stand
       * in der Ampel dauerhaft "fehlt: living", obwohl die Wohnflaeche da war. */
      /* v1017 · Baujahr ist Pflicht, nicht Kuer: ohne Baujahr faellt in der
       * Segmentierungs-Kaskade das komplette Baujahrsband weg, dann liegen
       * Altbauten von 1900 im selben Topf wie Neubauten. */
      pflicht: ['ptype', 'area', 'year', 'baustatus'], empfohlen: ['cond', 'quality'] },
    /* v1018 · "ab Stufe 3" war irrefuehrend: der Quercheck rechnet den
     * Ertragswert immer, nur mit Pauschalen. Ab Stufe 3 rechnet derselbe
     * Kern mit echten Parametern. */
    { key: 'ertrag', name: 'Ertragswert', ab: 1, genauerAb: 3,
      pflicht: ['plot', 'units'], empfohlen: ['lzs', 'baustatus'] },
    { key: 'sach', name: 'Sachwert', ab: 1, genauerAb: 3,
      pflicht: ['plot', 'year'], empfohlen: ['quality'],
      nichtWenn: function () { return istWohnung(); },
      nichtGrund: 'bei Eigentumswohnung nicht anwendbar' },
  ];

  /* ── v1119-WBED · Bedingungen gegen zerstoerte Felder ────────────────────
   * zeichnen() entfernt wm-b1/b2/b3, BEVOR block() die wenn:-Funktionen
   * auswertet. Jede Bedingung, die ein Feld INNERHALB dieser Bloecke liest,
   * war damit immer falsch — das Feld konnte gar nicht erscheinen.
   * Gemessen betraf das: hinterlandRent, garagenStufe (beide auch
   * pflichtWenn!), sanierungsjahr ueber baustatus, brwStichtag, brwAnpGrund.
   *
   * _letzte haelt die Werte der gerade entfernten Bloecke. Es wird NUR
   * waehrend des Neuzeichnens gelesen (_imNeuzeichnen). Ohne diese Sperre
   * liefe payload() ueber denselben Weg und wuerde abgewaehlte Felder
   * stillschweigend mitschicken — z. B. mea bei einem Haus. Genau das darf
   * nicht passieren: fehlt eine Angabe, fehlt sie. */
  var _letzte = {};
  var _imNeuzeichnen = false;
  function wert(id) {
    var e = $(id);
    if (e) return String(e.value || '').trim();
    if (_imNeuzeichnen) return String(_letzte[id] || '').trim();
    return '';
  }

  /* ── v1200 · Was das Objekt weiss, gehoert in den Bericht ────────────────
     `wert()` liest das FORMULARFELD. Existiert es nicht, liefert es ''. Das
     ist fuer die Stufenlogik richtig und muss so bleiben (v1139: sonst
     spraenge die Stufe von allein hoch, ohne dass jemand geklickt hat).

     Fuer den PAYLOAD ist es falsch. Gemessen am 02.09.2026, Objekt
     Huellhorst, erreichte Stufe 2:

         Feld `mea` im DOM ......... nein (der Wertermittlungs-Block wird
                                     erst aufgeklappt gebaut)
         window._mbVorrat('mea') ... "50"
         payload().mea_pct ......... null

     Die App KANNTE den Miteigentumsanteil, schrieb sogar in die Ampel
     „liegt im Objekt vor: Miteigentumsanteil" — und schickte ihn nicht mit.
     Der Bericht rechnete daraufhin ohne ihn. Ein Wert, der da ist, darf
     nicht verlorengehen, nur weil sein Eingabefeld gerade nicht gezeichnet
     ist.

     DIE UNTERSCHEIDUNG, auf die es ankommt:
       Feld da, aber leer  -> der Nutzer hat es so gewollt. Leer bleibt leer.
       Feld gar nicht da   -> niemand hat etwas gewollt. Der Vorrat gilt.

     Dieselbe Trennung macht `ausObjekt()` in mb-stufen.js seit v1139.

     KEIN PREIS-EINFLUSS, geprueft: die faellige Stufe kommt aus
     `wert_stufe` (stufe()), nicht aus dem Miteigentumsanteil. Der Server
     leitet aus `mea_pct` nur den Bodenwert ab. */
  function pWert(id) {
    if ($(id)) return wert(id);        /* Feld da -> es entscheidet, auch leer */
    var v = wert(id);                  /* Ruecklage aus dem Neuzeichnen zuerst */
    if (v) return v;
    try {
      if (typeof window._mbVorrat === 'function') {
        var o = window._mbVorrat(id);
        if (o != null && String(o).trim() !== '') return String(o).trim();
      }
    } catch (e) {}
    return '';
  }
  function istWohnung() { return /wohnung|etw/i.test(wert('ptype')); }
  function stufe() {
    try { return parseInt(localStorage.getItem(STUFE_KEY), 10) || 1; } catch (e) { return 1; }
  }
  function setStufe(n) {
    try { localStorage.setItem(STUFE_KEY, String(n)); } catch (e) {}
    zeichnen(); stufenAnwenden(true); ampel();
  }

  /* ── Aufbau ────────────────────────────────────────────────────────────── */
  function stil() {
    if ($('wm-css')) return;
    var s = document.createElement('style');
    s.id = 'wm-css';
    s.textContent =
      '.wm-ziel{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,168,76,.25);' +
      'border-radius:8px;background:rgba(201,168,76,.04)}' +
      '.wm-ziel h4{margin:0 0 10px;font-size:13px;color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}' +
      '.wm-opt{display:block;padding:7px 9px;margin:3px 0;border-radius:5px;cursor:pointer;font-size:12.5px;line-height:1.5}' +
      '.wm-opt:hover{background:rgba(201,168,76,.07)}' +
      '.wm-opt.an{background:rgba(201,168,76,.13);border-left:2px solid var(--wl-c9a84c,#C9A84C)}' +
      '.wm-opt{position:relative}' +
      '.wm-kero{position:absolute;right:9px;top:7px;font-size:11px;font-weight:600;' +
        'color:var(--wl-c9a84c,#C9A84C);opacity:.85}' +
      '.wm-opt small{display:block;color:#8a8a93;font-size:11px;margin-top:2px}' +
      '.wm-block{margin:14px 0;padding:12px 14px;border:1px solid rgba(128,128,128,.22);border-radius:7px}' +
      '.wm-block h4{margin:0 0 10px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.65}' +
      '.wm-f{margin-bottom:9px}' +
      '.wm-f label{display:block;font-size:11.5px;margin-bottom:3px;opacity:.85}' +
      /* v1014b · KEINE eigenen Feldfarben. Vorher standen hier
       * border:rgba(255,255,255,.12) und ein fast durchsichtiger weisser
       * Hintergrund — geschrieben fuers dunkle Cockpit. Der Marktbericht ist
       * aber HELL (steht so in der Projektanweisung). Auf weissem Grund war
       * beides unsichtbar: Label und Platzhalter sichtbar, Feld nicht.
       * Jetzt erben die Felder die Formatierung der App wie alle anderen. */
      '.wm-f.fehlt input,.wm-f.fehlt select{outline:2px solid var(--wl-b8625c,#B8625C);outline-offset:1px}' +
      '.wm-pf{color:var(--wl-b8625c,#B8625C);margin-left:3px}' +
      '.wm-ampel{margin:14px 0;padding:12px 14px;border:1px solid rgba(128,128,128,.22);border-radius:7px;font-size:12.5px}' +
      '.wm-z{display:flex;gap:8px;padding:5px 0;line-height:1.5;cursor:pointer}' +
      '.wm-z:hover{opacity:.8}' +
      '.wm-i{width:15px;flex:0 0 15px;text-align:center}' +
      '.wm-ok{color:#3FA56C}.wm-warn{color:#E8B84F}.wm-nein{color:#8a8a93}' +
      '.wm-z b{font-weight:600}.wm-z span{color:#8a8a93}';
    document.head.appendChild(s);
  }

  function zielfrage(wo) {
    if ($('wm-ziel')) return;
    var d = document.createElement('div');
    d.className = 'wm-ziel'; d.id = 'wm-ziel';
    d.innerHTML =
      '<h4>Was soll der Bericht leisten?</h4>' +
      /* v1177: dieselben drei Namen wie in mb-stufen.js und auf der
         Preisseite. Drei Stellen, ein Wort — sonst heisst dasselbe Ding im
         Werkzeug anders als im Tarif. */
      opt(1, 'Marktpreisindikation', 'Lage und Preisspanne. Wenige Angaben.') +
      opt(2, 'Erweiterte Marktpreisindikation', 'Zusätzlich Baustatus, Zustand und Qualität. Deutlich engere Spanne.') +
      opt(3, 'Wertermittlung nach ImmoWertV', 'Zusätzlich Bodenwert und Ertragswert nach ImmoWertV, mit Rechenweg im PDF. Ersetzt kein Gutachten.') +
      '<div style="margin-top:8px;font-size:11px;color:#7a7a84">Du kannst jederzeit hochschalten — Eingetragenes bleibt erhalten.</div>';
    wo.insertBefore(d, wo.firstChild);
    d.querySelectorAll('.wm-opt').forEach(function (o) {
      o.addEventListener('click', function () { setStufe(parseInt(o.getAttribute('data-s'), 10)); });
    });
  }

  /* ── v1194 · Hier lag der Preis ein zweites Mal, und zwar in Kerosin ──
     Bis hierher stand `var KEROSIN = { 1: 2, 2: 5, 3: 12 }` und die
     Optionen trugen ein Schild „2 L / 5 L / 12 L".

     Zwei Gruende, warum es weg ist und nicht nur uebersetzt wurde:

       · Es war eine ZWEITE Preisquelle. Was eine Stufe kostet, weiss der
         Server (`GET /marktbericht/stufenpreis`, Feld `kosten`), und
         `mb-stufen.js` holt es dort ab. Eine fest verdrahtete Zahl
         daneben laeuft frueher oder spaeter auseinander — genau so ist
         der Liter-Tarif hier stehengeblieben, als v1183 die Waehrung
         abgeschafft hat.
       · Diese Liste lebt nur Millisekunden: `mb-stufen.zeichnen()`
         ersetzt den Inhalt von `#wm-ziel` durch die Meilenstein-Ampel
         („Die alte Optionsliste weicht"). Deshalb hat v1193 im
         Seitentext auch kein `L` mehr gefunden — die Stelle war nicht
         sichtbar, nur geladen. Faellt mb-stufen.js aber aus, bleibt
         stehen, was hier steht. Ein falscher Preis als Rueckfallebene
         ist schlechter als gar keiner.

     Der Preis steht jetzt an EINER Stelle: in der Ampel darueber. */

  function opt(n, titel, text) {
    return '<div class="wm-opt' + (stufe() === n ? ' an' : '') + '" data-s="' + n + '">' +
      '<b>' + titel + '</b>' +
      '<small>' + text + '</small></div>';
  }

  function feld(f) {
    var pflicht = f.pflicht || (f.pflichtWenn && f.pflichtWenn());
    var h = '<div class="wm-f" id="wm-w-' + f.id + '">' +
      '<label>' + f.label + (pflicht ? '<span class="wm-pf">*</span>' : '') +
      (f.hilfe ? ' <span class="fh" data-fh="' + f.hilfe + '">&#9432;</span>' : '') + '</label>';
    if (f.typ === 'select') {
      h += '<select id="' + f.id + '">';
      f.opt.forEach(function (o) { h += '<option value="' + o[0] + '">' + o[1] + '</option>'; });
      h += '</select>';
    } else {
      h += '<input id="' + f.id + '" type="' + (f.typ === 'number' ? 'number' : 'text') + '"' +
        (f.platzhalter ? ' placeholder="' + f.platzhalter + '"' : '') + '>';
    }
    return h + '</div>';
  }

  /* ═══ v1166-GARMEA3 · Die Rueckfrage, die in beiden Wegen richtig ist ═════
     Backlog-Punkt 10 wartet auf eine fachliche Entscheidung (Feld
     wohnungsbezogen ODER Rechnung kuerzt selbst). Dieser Hinweis nimmt sie
     NICHT vorweg — er fragt nur nach, und zwar genau dann, wenn beide
     Auslegungen auseinanderfallen koennen: ein Miteigentumsanteil ist
     gepflegt (also eine ETW) UND eine Garagenflaeche steht drin.

     Der Anlass ist gemessen, nicht vermutet: lib/nhk2010.js kennt weder
     `mea` noch `ist_wohnung` und kuerzt die Flaeche NICHT — anders als der
     Bodenwert, der ueber ErtragswertService.bodenwert() anteilig kommt. Am
     Pruefobjekt Huellhorst standen 64,58 m2 fuer eine von drei Einheiten;
     ungekuerzt sind das bis zu ~18.500 EUR zu viel im Sachwert.

     Bewusst KEINE Schwelle und KEINE Rechnung: die Garage folgt in der
     Teilungserklaerung meist einem eigenen Anteil oder einem
     Sondernutzungsrecht, nicht dem Wohnungs-MEA. Eine automatische Kuerzung
     waere darum in beide Richtungen falsch. Gefragt wird, nicht gerechnet. */
  function meaHinweis() {
    var w = $('wm-w-garagenBgf');
    if (!w) return;
    var alt = w.querySelector('.wm-mea-hint');
    var meaEl = $('mea'), garEl = $('garagenBgf');
    var hatMea = !!(meaEl && parseFloat(String(meaEl.value).replace(',', '.')) > 0);
    var hatGar = !!(garEl && parseFloat(String(garEl.value).replace(',', '.')) > 0);
    if (!(hatMea && hatGar)) { if (alt) alt.remove(); return; }
    if (alt) return;                                   /* schon da, nicht doppeln */
    /* Eigene Darstellung statt einer fremden Klasse: fuer `.wm-f small` gibt
       es in dieser App keine Regel, ein blankes <small> haette geerbt, was
       gerade da war. Gedaempft und ohne Statusfarbe — es ist eine Rueckfrage,
       kein Fehler. Der Gold-Akzent steht als Whitelabel-Token. */
    var s = document.createElement('small');
    s.className = 'wm-mea-hint';
    s.style.cssText = 'display:block;margin-top:5px;font-size:11px;line-height:1.45;'
      + 'opacity:.85;padding-left:7px;border-left:2px solid var(--wl-c9a84c,#C9A84C)';
    s.innerHTML = 'Der Miteigentumsanteil wird hier <b>nicht</b> abgezogen — '
      + 'anders als beim Bodenwert. Steht dort der eigene Anteil?';
    w.appendChild(s);
  }

  function block(id, titel, liste) {
    var alt = $(id);
    if (alt) alt.remove();
    var sichtbar = liste.filter(function (f) {
      return !f.vorhanden && (!f.wenn || f.wenn());
    });
    if (!sichtbar.length) return null;
    var d = document.createElement('div');
    d.className = 'wm-block'; d.id = id;
    d.innerHTML = '<h4>' + titel + '</h4>' + sichtbar.map(feld).join('');
    return d;
  }

  function zeichnen() {
    var wo = $('wm-ziel') ? $('wm-ziel').parentNode : null;
    if (!wo) return;
    var s = stufe();
    document.querySelectorAll('.wm-opt').forEach(function (o) {
      o.classList.toggle('an', parseInt(o.getAttribute('data-s'), 10) === s);
    });

    var alt = {};
    ['wm-b1', 'wm-b2', 'wm-b3'].forEach(function (id) {
      var b = $(id);
      if (b) {
        b.querySelectorAll('input,select').forEach(function (e) {
          alt[e.id] = e.value;
          _letzte[e.id] = e.value;   /* v1119-WBED: siehe wert() */
        });
        b.remove();
      }
    });
    _imNeuzeichnen = true;   /* v1119-WBED: ab hier darf wert() auf _letzte zurueckfallen */
    try {

    var anker = $('wm-ampel') || null;
    /* v1017 · Stufe-1-Block: gilt fuer JEDE Stufe, deshalb ohne Bedingung. */
    var b1 = block('wm-b1', 'Baustatus', FELDER.stufe1);
    if (b1) {
      /* v1018 · Direkt hinter die Grundfelder, nicht ans Kartenende. Vorher
       * landete der Block hinter den Knoepfen, weil die Ampel dort haengt. */
      var vor1 = $('precHead');
      wo.insertBefore(b1, (vor1 && vor1.parentNode === wo) ? vor1 : anker);
    }
    if (s >= 2) {
      var b2 = block('wm-b2', 'Genauere Angaben', FELDER.stufe2);
      if (b2) wo.insertBefore(b2, anker);
    }
    if (s >= 3) {
      var b3 = block('wm-b3', 'Wertermittlung', FELDER.stufe3);
      if (b3) {
        /* Was automatisch passiert — damit niemand raetselt, warum nach
         * Grundstueck und Miteigentumsanteil nichts mehr kommt. */
        var au = document.createElement('div');
        au.className = 'fh-box';
        au.innerHTML = '<b>Wird automatisch ermittelt</b><br>'
          + 'Bodenrichtwert \u00fcber BORIS \u00b7 Liegenschaftszinssatz aus dem amtlichen '
          + 'Datenbestand, sonst nach \u00a7 256 BewG. Beides steht mit Herkunft im PDF.';
        b3.appendChild(au);

        /* Expertenfelder eingeklappt. */
        var det = document.createElement('div');
        det.style.cssText = 'margin-top:10px';
        det.innerHTML = '<div id="wm-exp-head" style="cursor:pointer;font-size:11.5px;'
          + 'color:var(--wl-c9a84c,#C9A84C)">\u25b8 Werte selbst setzen</div>'
          + '<div id="wm-exp-box" style="display:none;margin-top:8px">'
          + FELDER.experte.map(feld).join('')
          + '<div style="font-size:11px;opacity:.7;margin-top:4px">'
          + 'Nur n\u00f6tig, wenn der amtliche Abruf nichts liefert oder du eigene '
          + 'Werte aus dem Grundst\u00fccksmarktbericht hast.</div></div>';
        b3.appendChild(det);
        var h = det.querySelector('#wm-exp-head'), bx = det.querySelector('#wm-exp-box');
        h.addEventListener('click', function () {
          var auf = bx.style.display === 'none';
          bx.style.display = auf ? 'block' : 'none';
          h.textContent = (auf ? '\u25be' : '\u25b8') + ' Werte selbst setzen';
        });
        wo.insertBefore(b3, anker);
      }
    }
    } finally { _imNeuzeichnen = false; }   /* v1119-WBED */

    /* Eingetragenes zurückschreiben — Hochschalten darf nichts verlieren. */
    Object.keys(alt).forEach(function (k) { if ($(k) && alt[k]) $(k).value = alt[k]; });

    /* v1119-WAUS · Die Ausloeserliste war unvollstaendig. Gemessen: ptype
     * stand NICHT darin, obwohl istWohnung() daran haengt und damit 22
     * Felder — 17 nur fuer Haeuser (nhkHaus/nhkGeschosse/nhkDach, neun
     * ausst*, fuenf btl*, sachwertfaktor), zwei nur fuer Wohnungen (mea,
     * grundriss). Wer die Objektart wechselte, sah die Hausfelder NIE, und
     * drei davon sind pflichtWenn. Ebenso fehlten die Ausloeser fuer
     * spMiete (garages/outdoor), grundriss (units) und sanierungsjahr
     * (cond). hinterlandFlaeche und garagenBgf sind erst seit v1119-WBED
     * ueberhaupt wirksam. */
    ['ptype', 'cond', 'units', 'garages', 'outdoor',
     'hinterlandFlaeche', 'garagenBgf',
     'baustatus', 'mea', 'lzs', 'brwAnp', 'brwAnpGrund', 'sanierungsjahr', 'spMiete', 'brwManuell', 'brwStichtag', 'bgf', 'sachwertfaktor'].forEach(function (id) {
      var e = $(id);
      if (e && !e._wm) { e._wm = 1; e.addEventListener('change', function () { zeichnen(); ampel(); }); }
    });
    /* v1166-GARMEA3 · NACH dem Neuzeichnen — zeichnen() baut die Bloecke neu
       auf, ein vorher angehaengter Hinweis waere wieder weg. `mea` und
       `garagenBgf` stehen in der Ausloeserliste darueber, der Hinweis kommt
       also bei jeder Aenderung an einem der beiden mit. */
    meaHinweis();
    if (window.Feldhilfe && window.Feldhilfe.neuLaden) window.Feldhilfe.neuLaden();
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * STUFENSTEUERUNG — das eigentliche Versprechen der Frage oben.
   * ───────────────────────────────────────────────────────────────────────
   * Bisher blendete die Stufenwahl nur ZUSAETZLICHE Felder ein; die
   * Grundfelder standen immer alle da. Damit war nicht erkennbar, was die
   * Auswahl ueberhaupt bewirkt.
   *
   * Das Formular hat bereits einen Aufklapper "Erweiterte Angaben"
   * (#precHead / #precBox) mit Zustand, Qualitaet, Energie und den Gewerken.
   * Wir muessen also nichts zerlegen, sondern nur steuern, was offen ist:
   *
   *   Stufe 1  Grundfelder. Aufklapper ausgeblendet.
   *   Stufe 2  + Aufklapper sichtbar und aufgeklappt.
   *   Stufe 3  + Wertermittlungsblock.
   *
   * Aufgeklappt wird nur beim Hochschalten, nicht bei jedem Neuzeichnen —
   * wer den Block zuklappt, soll das duerfen.
   * ═══════════════════════════════════════════════════════════════════════ */
  function stufenAnwenden(gewechselt) {
    var s = stufe();
    var kopf = $('precHead'), box = $('precBox'), caret = $('precCaret');
    if (kopf && box) {
      if (s === 1) {
        kopf.style.display = 'none';
        box.style.display = 'none';
        if (caret) caret.textContent = '\u25b8';
      } else {
        kopf.style.display = '';
        if (gewechselt) {
          box.style.display = '';
          if (caret) caret.textContent = '\u25be';
        }
      }
    }

    var id = 'wm-stufe-info';
    var alt = $(id);
    if (alt) alt.remove();
    var texte = {
      1: 'Es gen\u00fcgen Adresse, Objektart, Wohnfl\u00e4che und Zimmer.',
      2: 'Zus\u00e4tzlich Zustand, Qualit\u00e4t, Energieklasse und Ausstattung \u2014 der Block \u201eErweiterte Angaben\u201c ist daf\u00fcr aufgeklappt.',
      3: 'Zus\u00e4tzlich Grundst\u00fcck, Miteigentumsanteil und Bodenrichtwert im Block \u201eWertermittlung\u201c.'
    };
    var z = $('wm-ziel');
    if (z) {
      var d = document.createElement('div');
      d.id = id;
      d.style.cssText = 'margin-top:9px;padding:7px 9px;border-radius:5px;'
        + 'background:rgba(201,168,76,.10);font-size:11.5px;line-height:1.5';
      d.textContent = texte[s] || '';
      z.appendChild(d);
    }
  }

  /* ── Pflichtfeld-Ampel ─────────────────────────────────────────────────── */
  function pruefe(v) {
    if (stufe() < v.ab) return { zeichen: '·', klasse: 'wm-nein', text: 'ab Stufe ' + v.ab };
    /* v1018 · Zwischenstufe: es gibt das Verfahren, nur ungenauer. */
    if (v.genauerAb && stufe() < v.genauerAb) {
      return { zeichen: '○', klasse: 'wm-warn',
        text: 'indikativ mit Pauschalwerten — genau ab Stufe ' + v.genauerAb };
    }
    if (v.nichtWenn && v.nichtWenn()) return { zeichen: '\u2715', klasse: 'wm-nein', text: v.nichtGrund };
    var fehlt = v.pflicht.filter(function (id) { return !wert(id); });
    if (fehlt.length) {
      return { zeichen: '\u26a0', klasse: 'wm-warn', fehlt: fehlt,
        text: 'fehlt: ' + fehlt.map(bez).join(', ') };
    }
    var offen = (v.empfohlen || []).filter(function (id) { return !wert(id); });
    if (offen.length) {
      return { zeichen: '\u2713', klasse: 'wm-ok', fehlt: offen,
        text: 'rechnet — genauer mit: ' + offen.map(bez).join(', ') };
    }
    return { zeichen: '\u2713', klasse: 'wm-ok', text: 'vollständig' };
  }

  function bez(id) {
    var e = $('wm-w-' + id);
    if (e) return e.querySelector('label').textContent.replace('*', '').replace('\u24d8', '').trim();
    var l = $(id) && $(id).parentNode ? $(id).parentNode.querySelector('label') : null;
    return l ? l.textContent.trim() : id;
  }

  /* v1027 · Kein Bericht mit Luecken.
   * Bisher konnte man auf Stufe 3 ohne Miteigentumsanteil erzeugen — und
   * bekam einen Bodenwert ueber das ganze Grundstueck. Der Knopf bleibt
   * jetzt gesperrt, solange ein Pflichtfeld des gewaehlten Umfangs fehlt,
   * und sagt welches. */
  /* v1029 · Der Knopftext wird NICHT mehr ueberschrieben.
   * Vorher stand dauerhaft "Es fehlt: ..." im Knopf, auch wenn alles
   * ausgefuellt war. Ursache: die Anwendung setzt den Knopftext selbst
   * ("erstelle…" mit Spinner). Mein _wmAlt hat je nach Zeitpunkt diesen
   * Zwischenstand als Original gemerkt und danach nie mehr sauber
   * zurueckgeschrieben — zwei Schreiber auf demselben Element.
   *
   * Jetzt: nur disabled setzen, der Hinweis steht in einem eigenen Feld
   * darueber. Ein Element, ein Schreiber. */
  function knopfFinden() {
    return document.querySelector('#btn-report, #createReport, [data-mb-create]')
      || Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
        return /marktbericht erstellen/i.test(b.textContent || '');
      });
  }

  function knopfSperren() {
    var knopf = knopfFinden();
    if (!knopf) return;

    var fehlt = [];
    VERFAHREN.forEach(function (v) {
      /* v1152-SPERRE · Marcels Befund: „Der Erzeugen-Knopf lässt sich nicht
       * klicken, obwohl die Angaben für die einfache Einschätzung
       * vollständig sind. Das muss ja irgendwie möglich sein."
       *
       * Gemessen am 12.08. bei Stufe 1, ETW, alle Angaben aus BEDARF
       * gefüllt: der Knopf trug bereits „Marktbericht erstellen · 2 L",
       * blieb aber `disabled`, und sein Titel nannte als fehlend
       * „Grundstück (m²) · Wohneinheiten" — die Pflichtfelder von
       * Ertrags- und Sachwert, also von STUFE 3.
       *
       * Ursache: `ab` und `genauerAb` bedeuten Verschiedenes. Ertrags- und
       * Sachwert stehen bewusst auf `ab: 1`, weil sie IMMER mitrechnen —
       * „nur mit Pauschalen" (v1018). Ihre Pflichtfelder brauchen sie erst
       * bei `genauerAb: 3`, wenn derselbe Kern mit echten Parametern
       * rechnet. Geprüft wurde aber gegen `ab`, also verlangte Stufe 1 die
       * Angaben von Stufe 3 — und der Meilenstein-Gedanke war damit
       * ausgehebelt: wer bei „Einschätzung" stehenbleiben will, konnte dort
       * nicht erzeugen.
       *
       * Das ist zugleich die zweite Doppelliste derselben Sache: `BEDARF`
       * in mb-stufen.js führt für Stufe 1 vier Felder, `VERFAHREN[].pflicht`
       * hier deren sieben. v1126d hat schon einmal eine solche Zweitliste
       * beseitigt („und lief prompt auseinander"). Sie sind jetzt wieder
       * deckungsgleich — bleibt es bei zwei Listen, gehört das
       * zusammengeführt. */
      var abPflicht = (v.genauerAb != null) ? v.genauerAb : v.ab;
      if (stufe() < abPflicht) return;
      if (v.nichtWenn && v.nichtWenn()) return;
      v.pflicht.forEach(function (id) { if (!wert(id) && fehlt.indexOf(id) < 0) fehlt.push(id); });
    });
    if (stufe() >= 3 && istWohnung() && !wert('mea') && fehlt.indexOf('mea') < 0) fehlt.push('mea');

    var id = 'wm-fehlt';
    var box = document.getElementById(id);
    if (!fehlt.length) {
      knopf.disabled = false;
      knopf.style.opacity = '';
      knopf.title = '';
      if (box) box.remove();
      return;
    }

    knopf.disabled = true;
    knopf.style.opacity = '.55';
    var text = 'Es fehlt noch: ' + fehlt.map(bez).join(' \u00b7 ');
    knopf.title = text;
    if (!box) {
      box = document.createElement('div');
      box.id = id;
      box.style.cssText = 'margin:8px 0;padding:8px 10px;border-radius:6px;font-size:11.5px;'
        + 'line-height:1.5;background:rgba(184,98,92,.10);'
        + 'border-left:2px solid var(--wl-b8625c,#B8625C)';
      if (knopf.parentNode) knopf.parentNode.insertBefore(box, knopf);
    }
    box.textContent = text;
  }

  function ampel() {
    var wo = $('wm-ziel') ? $('wm-ziel').parentNode : null;
    if (!wo) return;
    var d = $('wm-ampel');
    if (!d) {
      d = document.createElement('div');
      d.className = 'wm-ampel'; d.id = 'wm-ampel';
      wo.appendChild(d);
    }
    var h = '<h4 style="margin:0 0 8px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#8a8a93">Was der Bericht enthalten wird</h4>';
    VERFAHREN.forEach(function (v) {
      var r = pruefe(v);
      h += '<div class="wm-z" data-ziel="' + ((r.fehlt && r.fehlt[0]) || '') + '">' +
        '<span class="wm-i ' + r.klasse + '">' + r.zeichen + '</span>' +
        '<span style="flex:1"><b style="color:#c8c8d0">' + v.name + '</b> &nbsp;<span>' + r.text + '</span></span></div>';
    });
    d.innerHTML = h;
    knopfSperren();
    d.querySelectorAll('.wm-z').forEach(function (z) {
      z.addEventListener('click', function () {
        var t = z.getAttribute('data-ziel');
        if (t && $(t)) { $(t).scrollIntoView({ behavior: 'smooth', block: 'center' }); $(t).focus(); }
      });
    });
  }

  /* ── Payload ───────────────────────────────────────────────────────────── */
  function payload() {
    var z = parseFloat(pWert('mea'));
    return {
      wert_stufe: stufe(),
      baustatus: pWert('baustatus') || 'bestand',
      first_time_use: /neubau_erstbezug|neubau_im_bau/.test(pWert('baustatus')) || pWert('cond') === 'erstbezug',
      refurbished: /saniert/.test(pWert('baustatus')) || /saniert/.test(pWert('cond')),
      reconstruction_year: parseInt(pWert('sanierungsjahr'), 10) || null,
      mea_pct: isFinite(z) && z > 0 ? z : null,
      lzs_pct: parseFloat(pWert('lzs')) || null,
      land_value_manual: parseFloat(pWert('brwManuell')) || null,
      land_value_stichtag: pWert('brwStichtag') || null,
      brw_anpassung_pct: parseFloat(pWert('brwAnp')) || null,
      brw_anpassung_grund: pWert('brwAnpGrund') || null,
      bgf: parseFloat(pWert('bgf')) || null,
      sachwertfaktor: parseFloat(pWert('sachwertfaktor')) || null,
      stellplatz_miete_monat: parseFloat(pWert('spMiete')) || null,
      /* v1055-WFELD-1 · Seit v1047 stehen diese drei im Formular und wurden
       * nie mitgeschickt. app.js sammelt den Block nicht selbst ein, sondern
       * uebernimmt payload() als Ganzes — wer hier fehlt, existiert fuer den
       * Bericht nicht. */
      /* v1057-WSON-4 · Kueche, Moeblierung, Werbeflaeche. Getrennt von der
       * Kaltmiete, weil die Vergleichsmiete aus reinen Wohnungsangeboten
       * stammt — und getrennt kapitalisiert, weil sie nicht am Gebaeude
       * haengt. */
      sonstige_jahr: parseFloat(pWert('sonstEinnahmen')) || null,
      /* v1067-WSW-6 · app.js uebernimmt payload() als Ganzes. Wer hier
       * fehlt, existiert fuer den Bericht nicht — dieselbe Lehre wie
       * v1055 und v1062. */
      /* v1068-WNHK-5 · Typennummer <Haustyp>.<Geschosse><Dach>.
       * Fehlt eine der drei Angaben, wird KEINE Nummer gebildet — eine
       * halb geratene Gebaeudeart waere schlimmer als gar keine. */
      /* v1071-WHIN-4 · Zusaetzliche Grundstuecksflaeche. Ableiten laesst
       * sich das nicht — bei einer Wohnung ist "Garten" ein Teil des
       * Grundstuecks, bei einem Haus koennen 928 m2 Hinterland daneben
       * liegen. Deshalb gefragt, nicht geraten. */
      hinterland_qm: parseFloat(pWert('hinterlandFlaeche')) || null,
      hinterland_eur_qm: parseFloat(pWert('hinterlandWert')) || null,
      hinterland_rentierlich: pWert('hinterlandRent') === 'ja',   /* v1072-WREN-7 */
      garagen_bgf_qm: parseFloat(pWert('garagenBgf')) || null,
      garagen_stufe: parseFloat(pWert('garagenStufe')) || null,
      aussenanlagen_pct: parseFloat(pWert('aussenPct')) || null,
      nhk_typ: (function () {
        var h = pWert('nhkHaus'), g = pWert('nhkGeschosse'), d = pWert('nhkDach');
        return (h && g && d) ? (h + '.' + g + d) : null;
      })(),
      standardstufe: parseFloat(pWert('standardstufe')) || null,
      grundriss: pWert('grundriss') || null,
      mod_punkte: pWert('modGrad') !== '' ? parseFloat(pWert('modGrad')) : null,
      /* v1062-WAUS-2 · app.js sammelt den Block nicht selbst ein, es
       * uebernimmt payload() als Ganzes. Wer hier fehlt, existiert fuer den
       * Bericht nicht — genau wie v1055 es fuer drei andere Felder gelernt hat. */
      aussenanlagen: parseFloat(pWert('aussenanlagen')) || null,
      bes_bauteile: parseFloat(pWert('besBauteile')) || null,
      /* v1074-WAUS9-7 · payload() ist die einzige Tuer zum Bericht —
       * dieselbe Lehre wie v1055, v1062, v1067. */
      ausstattung: (function () {
        var m = { aussenwaende: 'ausstAussenwaende', dach: 'ausstDach',
                  fenster_tueren: 'ausstFenster', innenwaende: 'ausstInnenwaende',
                  decken_treppen: 'ausstDecken', fussboeden: 'ausstFussboeden',
                  sanitaer: 'ausstSanitaer', heizung: 'ausstHeizung',
                  sonstige_technik: 'ausstTechnik' };
        var o = {}, n = 0;
        Object.keys(m).forEach(function (k) {
          var v = parseFloat(pWert(m[k]));
          if (isFinite(v) && v >= 1 && v <= 5) { o[k] = v; n++; }
        });
        return n > 0 ? o : null;
      })(),
      bauteile_hk: (function () {
        var s = 0;
        ['btlGauben', 'btlBalkone', 'btlVordach', 'btlTerrassen', 'btlSonstige']
          .forEach(function (id) { s += parseFloat(pWert(id)) || 0; });
        return s > 0 ? Math.round(s) : null;
      })(),
      bauteile_detail: (function () {
        var d = { gauben: parseFloat(pWert('btlGauben')) || null,
                  balkone: parseFloat(pWert('btlBalkone')) || null,
                  vordaecher: parseFloat(pWert('btlVordach')) || null,
                  terrassen: parseFloat(pWert('btlTerrassen')) || null,
                  sonstige: parseFloat(pWert('btlSonstige')) || null };
        var hat = Object.keys(d).some(function (k) { return d[k]; });
        return hat ? d : null;
      })(),
      bwk_modus: stufe() >= 3 ? 'normiert' : null,
    };
  }

  /* ── Start ─────────────────────────────────────────────────────────────── */
  function start() {
    /* v1012 · Die Zielfrage sass mitten im Formular zwischen Balkon und Garten,
     * weil ich sie an das Grundstuecksfeld gehaengt habe. Sie gehoert an den
     * Anfang: erst die Frage, was der Bericht leisten soll, dann die Felder.
     * Anker ist deshalb das ERSTE Feld des Formulars (Adresse), und die
     * Zielfrage wird davor gesetzt. */
    var erst = $('address') || $('ptype') || $('area');
    if (!erst) return;
    var wo = null, k = erst;
    for (var i = 0; i < 6 && k; i++) {
      k = k.parentNode;
      if (k && (k.tagName === 'FORM' || (k.className && /card|panel|form|box/i.test(String(k.className))))) { wo = k; break; }
    }
    if (!wo) wo = erst.parentNode ? erst.parentNode.parentNode : null;
    if (!wo) return;
    stil();
    zielfrage(wo);
    zeichnen();
    stufenAnwenden(false);
    ampel();
    /* v1029 · 'living' gibt es nicht — das Feld heisst 'area'. Und geprueft
     * wird auch bei Eingabe, nicht erst beim Verlassen des Feldes. */
    ['ptype', 'area', 'year', 'cond', 'quality', 'plot', 'units', 'mea'].forEach(function (id) {
      var e = $(id);
      if (e && !e._wm) {
        e._wm = 1;
        e.addEventListener('change', ampel);
        e.addEventListener('input', ampel);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* v1075-WUI-1 · Feinjustierung als Klappbloecke. Rein darstellend:
   * die 14 Felder aus v1074 werden nach jedem Zeichnen in zwei
   * zugeklappte Container verschoben (Wrapper wm-w-<id> bleiben ganz,
   * payload() liest weiter ueber die ids). Zugeklappt gilt die glatte
   * Standardstufe; der Chip im Kopf zeigt den Zustand ohne Aufklappen. */
  (function () {
    var GEW = ['ausstAussenwaende', 'ausstDach', 'ausstFenster', 'ausstInnenwaende',
      'ausstDecken', 'ausstFussboeden', 'ausstSanitaer', 'ausstHeizung', 'ausstTechnik'];
    var GWT = { ausstAussenwaende: 23, ausstDach: 15, ausstFenster: 11, ausstInnenwaende: 11,
      ausstDecken: 11, ausstFussboeden: 5, ausstSanitaer: 9, ausstHeizung: 9, ausstTechnik: 6 };
    var BTL = ['btlGauben', 'btlBalkone', 'btlVordach', 'btlTerrassen', 'btlSonstige'];
    var CSS_KOPF = 'display:flex;align-items:center;gap:9px;padding:10px 12px;cursor:pointer;'
      + 'user-select:none;border:1.5px solid rgba(42,39,39,.14);border-radius:10px;background:#fff';
    var CSS_CHIP_AUS = 'margin-left:auto;font:600 10px monospace;letter-spacing:.4px;padding:3px 8px;'
      + 'border-radius:99px;background:#FBF6E9;color:#8a8378;border:1px solid rgba(42,39,39,.14);white-space:nowrap';
    var CSS_CHIP_AN = 'margin-left:auto;font:600 10px monospace;letter-spacing:.4px;padding:3px 8px;'
      + 'border-radius:99px;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),'
      + 'var(--wl-c9a84c, #C9A84C) 60%,var(--wl-b8932f, #b8932f));color:#1a1407;'
      + 'border:1px solid var(--wl-b8932f, #b8932f);white-space:nowrap';
    /* v1076-WUI-2 · Kopf einzeilig (ellipsis), Inhalt als Raster statt
     * Endlosliste — Befund vom 03.08.: die neun Felder liefen in voller
     * Breite untereinander, der Kopf brach vierzeilig um. */
    function kasten(id, titel, sub) {
      if (!document.getElementById('wm-klapp-css')) {
        var st = document.createElement('style');
        st.id = 'wm-klapp-css';
        st.textContent = '.wm-klapp-in{display:none;grid-template-columns:repeat(3,minmax(0,1fr));'
          + 'gap:7px 8px;padding:9px 2px 4px}'
          + '#wm-klapp-bauteile .wm-klapp-in{grid-template-columns:repeat(2,minmax(0,1fr))}'
          + '.wm-klapp-in .wm-f{margin:0}'
          + '.wm-klapp-in .wm-f label{font-size:10px;line-height:1.3;display:block;min-height:26px}'
          + '.wm-klapp-in .wm-f select,.wm-klapp-in .wm-f input{width:100%;padding:6px;font-size:12.5px}';
        document.head.appendChild(st);
      }
      var k = document.createElement('div');
      k.id = id; k.style.cssText = 'margin:10px 0';
      k.innerHTML = '<div class="wm-klapp-kopf" style="' + CSS_KOPF + '">'
        + '<span class="wm-klapp-pf" style="color:var(--wl-b8932f, #b8932f);font-size:10px;flex-shrink:0">\u25b6</span>'
        + '<span style="flex:1;min-width:0">'
        + '<b style="font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + titel + '</b>'
        + '<span style="font-size:10px;color:#8a8378;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sub + '</span>'
        + '</span>'
        + '<span class="wm-klapp-chip" style="' + CSS_CHIP_AUS + '"></span></div>'
        + '<div class="wm-klapp-in"></div>';
      k.querySelector('.wm-klapp-kopf').addEventListener('click', function () {
        var inn = k.querySelector('.wm-klapp-in');
        var offen = inn.style.display === 'grid';
        inn.style.display = offen ? '' : 'grid';
        k.querySelector('.wm-klapp-pf').textContent = offen ? '\u25b6' : '\u25bc';
      });
      return k;
    }
    function chips() {
      var k1 = $('wm-klapp-gewerke'), k2 = $('wm-klapp-bauteile');
      if (k1) {
        var sum = 0, n = 0;
        GEW.forEach(function (id) {
          var v = parseFloat(wert(id));
          if (isFinite(v) && v >= 1) { sum += v * GWT[id] / 100; n++; }
        });
        var c = k1.querySelector('.wm-klapp-chip');
        if (n === 9) { c.style.cssText = CSS_CHIP_AN; c.textContent = 'GEWOGEN \u00b7 STUFE ' + sum.toFixed(2).replace('.', ','); }
        else if (n > 0) { c.style.cssText = CSS_CHIP_AUS; c.textContent = n + ' / 9 \u2014 NOCH GLATTE STUFE'; }
        else { c.style.cssText = CSS_CHIP_AUS; c.textContent = 'AUS \u00b7 GLATTE STUFE'; }
      }
      if (k2) {
        var s = 0;
        BTL.forEach(function (id) { s += parseFloat(wert(id)) || 0; });
        var c2 = k2.querySelector('.wm-klapp-chip');
        c2.style.cssText = s > 0 ? CSS_CHIP_AN : CSS_CHIP_AUS;
        c2.textContent = s > 0 ? ('+ ' + Math.round(s).toLocaleString('de-DE') + ' \u20ac') : 'KEINE';
      }
    }
    function bauen() {
      var e1 = $('wm-w-ausstAussenwaende');
      if (e1 && !$('wm-klapp-gewerke')) {
        var k = kasten('wm-klapp-gewerke', 'Feinjustierung nach Gewerken',
          'SW-RL Anlage 2 \u00b7 zugeklappt gilt die glatte Stufe');
        e1.parentNode.insertBefore(k, e1);
        var inn = k.querySelector('.wm-klapp-in');
        GEW.forEach(function (id) { var w = $('wm-w-' + id); if (w) inn.appendChild(w); });
      }
      var b1 = $('wm-w-btlGauben');
      if (b1 && !$('wm-klapp-bauteile')) {
        var k2 = kasten('wm-klapp-bauteile', 'Sonstige Bauteile',
          'HK heute \u00b7 gleiche Alterswertminderung wie das Geb\u00e4ude');
        b1.parentNode.insertBefore(k2, b1);
        var in2 = k2.querySelector('.wm-klapp-in');
        BTL.forEach(function (id) { var w = $('wm-w-' + id); if (w) in2.appendChild(w); });
      }
      chips();
    }
    document.addEventListener('change', function (e) {
      if (e.target && /^(ausst|btl)/.test(e.target.id || '')) chips();
    });
    document.addEventListener('input', function (e) {
      if (e.target && /^btl/.test(e.target.id || '')) chips();
    });
    var mo = new MutationObserver(function () {
      if (($('wm-w-ausstAussenwaende') && !$('wm-klapp-gewerke'))
        || ($('wm-w-btlGauben') && !$('wm-klapp-bauteile'))) bauen();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(bauen, 0);
  })();

  window.Wertermittlung = { payload: payload, stufe: stufe, setStufe: setStufe, neuZeichnen: zeichnen };
})();
