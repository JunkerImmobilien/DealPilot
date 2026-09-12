/* feldhilfe.js — Erklärungen an den Eingabefeldern der Wertermittlung.
 * ────────────────────────────────────────────────────────────────────────────
 * Konzept Kap. 6: drei Ebenen.
 *   1  Ankertext   steht unter der Option, immer sichtbar, kein Klick
 *   2  Kurzhilfe   ⓘ am Feld: was ist gemeint, was ist ein typischer Wert
 *   3  Ausführlich aufklappbar: Rechtsgrundlage, Wirkung, Beispiel
 *
 * KONTEXTSENSITIV: die Hilfe kennt den Zustand des Formulars. Bei Baustatus
 * "Neubau" steht am Modernisierungsblock nicht die allgemeine Erklärung,
 * sondern der Hinweis, dass dort nichts einzutragen ist — und der Block wird
 * ausgeblendet, NICHT auf null gesetzt. Eine Null wird mitgerechnet,
 * ein "nicht anwendbar" nicht.
 *
 * Texte stehen hier als Daten, nicht im Code — änderbar ohne Logik anzufassen.
 * Farben über die --wl-Ebene, keine harte Marke in den Texten.
 */
(function () {
  'use strict';

  var AN = 'dp_feldhilfe';          // Einstellung: Erklärungen anzeigen
  var $ = function (id) { return document.getElementById(id); };

  /* ── Die Texte ─────────────────────────────────────────────────────────── */
  var TEXTE = {
    baustatus: {
      kurz: 'Steuert, welche weiteren Angaben nötig sind. Ein Neubau hat keine Modernisierung — dort verschwindet der Block, statt auf null zu stehen.',
      lang: 'Neubau-Erstbezug und Erstbezug nach Sanierung sind bewertungstechnisch gegensätzlich: der Neubau hat die volle Nutzungsdauer und keine Alterswertminderung, die sanierte Bestandsimmobilie einen maximalen Modernisierungsgrad bei verkürzter Restnutzungsdauer. Steuerlich ist der Unterschied noch größer — beim Erstbezug nach Sanierung wird die 15-%-Grenze für anschaffungsnahe Herstellungskosten scharf.',
      grund: 'ImmoWertV 2021; § 6 Abs. 1b EStG',
      anker: {
        bestand: 'Gebäude ist in Nutzung, keine Erstvermietung.',
        bestand_erstbezug_saniert: 'Umfassend modernisiert, danach erstmals wieder vermietet oder bezogen.',
        neubau_erstbezug: 'Fertiggestellt und noch nie genutzt.',
        neubau_im_bau: 'Noch nicht fertiggestellt — Bewertung auf den Zustand nach Fertigstellung.',
        geplant: 'Baubeginn steht aus. Wertermittlung nur eingeschränkt möglich.'
      }
    },
    cond: {
      kurz: 'Zustand des Gebäudes zum Bewertungsstichtag. Zwei Nutzer sollen beim selben Objekt dieselbe Stufe wählen — deshalb die Kurzbeschreibungen.',
      anker: {
        erstbezug: 'Neubau, noch nie genutzt.',
        neuwertig: 'Wie neu, keinerlei Gebrauchsspuren.',
        gepflegt: 'Laufende Instandhaltung, keine erkennbaren Mängel.',
        saniert: 'Wesentliche Gewerke erneuert.',
        kernsaniert: 'Bis auf den Rohbau zurückgebaut und neu aufgebaut.',
        renovierungsbeduerftig: 'Nutzbar, aber Instandhaltungsstau erkennbar.',
        renovierungsstau: 'Mehrere Gewerke überfällig, Investition kurzfristig nötig.'
      }
    },
    plot: {
      kurz: 'Grundstücksfläche in m². Ohne sie kein Bodenwert — und ohne Bodenwert rechnet das Ertragswertverfahren nur in der vereinfachten Form.',
      lang: 'Steht im Kaufvertrag, im Grundbuchauszug oder im Liegenschaftskataster. Bei einer Eigentumswohnung ist es die Fläche des gesamten Grundstücks; der eigene Anteil ergibt sich erst über den Miteigentumsanteil.',
      grund: '§ 40 ImmoWertV'
    },
    mea: {
      kurz: 'Miteigentumsanteil in Prozent, nur bei Eigentumswohnungen. Aus der Teilungserklärung, dort meist als Bruch (z. B. 125/1000 = 12,5 %).',
      lang: 'Der Bodenwert des Gesamtgrundstücks wird mit diesem Anteil multipliziert. Ohne Angabe rechnet die Wertermittlung mit dem vollen Grundstück und überschätzt den Wohnungswert erheblich.',
      grund: '§ 3 WEG'
    },
    /* v1142-GARMEA · Das Feld trug ein ⓘ, das nichts tat: `garagenBgf` stand
     * als Hilfe-Schlüssel in wertermittlung.js, aber nicht hier — und
     * textFuer() kennt keinen Rückfall auf die dortigen Texte.
     *
     * Inhaltlich der Punkt, der den Hinweis nötig macht: lib/nhk2010.js
     * kennt weder mea noch ist_wohnung, die Fläche geht also UNGEKÜRZT in
     * den Sachwert. Beim Bodenwert wird der Miteigentumsanteil abgezogen,
     * hier nicht, und dieser Unterschied stand nirgends. Am Prüfobjekt
     * Hüllhorst standen 64,58 m² für eine von drei Einheiten. */
    garagenBgf: {
      kurz: 'Länge × Breite der Garagen, die zu <b>dieser</b> Bewertung gehören — nicht die Zahl der Stellplätze. Bei einer Eigentumswohnung also nur die eigene Garage oder der eigene Anteil; wird das ganze Gebäude bewertet, kommen alle hinein.',
      lang: '<b>Der Miteigentumsanteil wird hier nicht automatisch abgezogen</b> — anders als beim Bodenwert. Die Fläche geht so in den Sachwert ein, wie sie hier steht. Die NHK 2010 führen für Garagen eigene Kostenkennwerte (Gebäudeart 14.1) und eine eigene Gesamtnutzungsdauer von 60 Jahren; eine Garage hält nicht so lange wie das Wohnhaus. Ohne Fläche wird sie nicht angesetzt.',
      grund: '§ 36 ImmoWertV · NHK 2010, Gebäudeart 14.1'
    },
    /* ── v1146-FHTEXT · Neun Felder trugen ein ⓘ, das nichts tat ──────────
     * `wertermittlung.js` vergab 18 Hilfe-Schlüssel, `TEXTE` führte 10 —
     * und `textFuer()` kennt keinen Rückfall: fehlt der Schlüssel, gibt es
     * `null` zurück und der Klick verpufft still. Betroffen waren
     * ausgerechnet die erklärungsbedürftigsten Felder.
     *
     * Sechs Texte gab es längst — im HILFE-Block von `wertermittlung.js`,
     * wo sie nie jemand zu sehen bekam. Sie sind hierher überführt und in
     * kurz/lang geteilt; drei (Standardstufe, Modernisierungsgrad,
     * Grundriss) sind neu. */
    standardstufe: {
      kurz: 'Bauqualität des Gebäudes in fünf Stufen. Stufe 3 ist der Durchschnitt, Stufe 1 einfachst, Stufe 5 aufwendig. Sie steuert den Kostenkennwert und damit den ganzen Sachwert.',
      lang: 'Die Stufen der Sachwertrichtlinie beschreiben Fenster, Dach, Heizung, Sanitär und Ausbau zusammengefasst. Eine Stufe Unterschied verschiebt die Herstellungskosten je nach Gebäudetyp um 15 bis 25 Prozent — es lohnt, hier genau zu sein. Wer es feiner will, füllt stattdessen die neun Gewerke einzeln aus; sind alle gesetzt, haben sie Vorrang vor dieser glatten Stufe.',
      grund: 'SW-RL 2012, Anlage 1 · NHK 2010'
    },
    modGrad: {
      kurz: 'Modernisierungspunkte nach SW-RL. Sie verlängern die Restnutzungsdauer eines älteren Gebäudes — ohne sie rechnet der Bericht mit dem reinen Baujahr.',
      lang: 'Bewertet werden Dach, Fenster, Leitungen, Heizung, Bäder, Böden, Grundriss und Wärmedämmung mit je 0 bis 4 Punkten. Aus der Summe leitet sich das fiktive Baujahr ab. Bei einem Haus von 1964 macht eine durchgreifende Modernisierung schnell zwanzig Jahre Restnutzungsdauer aus — und die geht über den Barwertfaktor direkt in den Ertragswert.',
      grund: 'SW-RL 2012, Anlage 4 · § 4 Abs. 3 ImmoWertV'
    },
    grundriss: {
      kurz: 'Wohnungszuschnitt im Gebäude — Zweispänner, Dreispänner, Laubengang. Er korrigiert den Kostenkennwert nach oben oder unten.',
      lang: 'Je mehr Wohnungen an einem Treppenhaus hängen, desto günstiger wird der Quadratmeter: die Erschließungsfläche verteilt sich auf mehr Einheiten. Die NHK 2010 führen dafür eigene Korrekturfaktoren. Ohne Angabe rechnet der Bericht ohne Korrektur — das ist die neutrale Annahme, kein Schätzwert.',
      grund: 'NHK 2010, Korrektur Grundrissart'
    },
    hinterland: {
      kurz: 'Nur die zusätzliche Fläche eintragen, die über das normale Baugrundstück hinausgeht — nicht die gesamte Grundstücksfläche, sie würde doppelt gezählt.',
      lang: 'Beispiel: 1.000 m² Grundstück, davon 800 m² Bauland und 200 m² Hinterland — hier gehören die 200 hinein, nicht die 800 und nicht die 1.000. Die Fläche wird getrennt bewertet, weil sie nicht denselben Wert hat wie das Baugrundstück (§ 41 ImmoWertV).',
      grund: '§ 41 ImmoWertV'
    },
    hinterlandRent: {
      kurz: 'Rentierlich heißt: die Fläche wirft einen Ertrag ab, etwa weil sie verpachtet ist. Das ist die Ausnahme.',
      lang: 'Eine <b>nicht</b> rentierliche Fläche geht in den Bodenwert ein, unterliegt aber nicht der Bodenwertverzinsung im Ertragswertverfahren — sonst mindert sie den Gebäudeertrag, obwohl sie gar keinen tragen soll. Der Haken ist damit eine der wenigen Stellen, an denen eine einzelne Angabe den Ertragswert spürbar verschiebt.',
      grund: '§ 41 ImmoWertV'
    },
    garagenStufe: {
      kurz: 'Stufe 3 sind Fertiggaragen, Stufe 4 Massivbauweise, Stufe 5 massiv mit besonderer Ausführung (Ziegel- oder Gründach, Fliesen, Wasser und Heizung).',
      lang: 'Kostenkennwerte 245 / 485 / 780 €/m² BGF, Stand 2010 — sie werden mit dem Baupreisindex auf den Stichtag gebracht. Zwischen Stufe 3 und 5 liegt gut das Dreifache; bei einer Doppelgarage macht das im Sachwert mehrere zehntausend Euro aus.',
      grund: 'NHK 2010, Gebäudeart 14.1'
    },
    aussenPct: {
      kurz: 'Wege, Hofflächen, Einfriedungen, Ver- und Entsorgungsanlagen — als Prozentsatz des Gebäudesachwerts.',
      lang: 'Übliche Ansätze liegen zwischen 5 und 7 Prozent; manche Gutachterausschüsse geben stattdessen feste Beträge vor (Minden-Lübbecke: Kanal 2.900 €, Einfahrt 2.500 €, Terrasse 2.000 €). Ist oben ein Eurobetrag eingetragen, hat der Vorrang. Weil der Wert am Gebäudesachwert hängt, skaliert er bei einer Eigentumswohnung automatisch mit — anders als die Garagenfläche.',
      grund: '§ 36 Abs. 3 ImmoWertV'
    },
    ausstGewerk: {
      kurz: 'Feinere Alternative zur glatten Standardstufe: je Gewerk eine Stufe 1–5, halbe Stufen erlaubt.',
      lang: 'Gerechnet wird nur, wenn <b>alle neun</b> Gewerke gesetzt sind — sonst gilt die glatte Standardstufe oben. Das ist Absicht: eine halb gefüllte Gewerkeliste wäre genauer aussehend, aber ungenauer. Die Gewichte stehen in der Feldbezeichnung (Außenwände 23 % … sonstige Technik 6 %).',
      grund: 'SW-RL 2012, Anlage 2'
    },
    bauteilHk: {
      kurz: 'Herstellungskosten besonderer Bauteile zum heutigen Stichtag, ohne erneute Indexierung.',
      lang: 'Sie unterliegen derselben Alterswertminderung wie das Gebäude. Größenordnung am Beispiel Löhner Straße: Gauben 51.000, Balkone 13.000, Vordach 10.000, Terrassen 18.000, Sonstiges 3.000 €. Gemeint sind Bauteile, die im Kostenkennwert nicht enthalten sind — nicht die normale Ausstattung.',
      grund: '§ 36 Abs. 2 ImmoWertV'
    },
    lzs: {
      kurz: 'Liegenschaftszinssatz in Prozent. Die größte Stellschraube im ganzen Verfahren — ein halber Punkt verschiebt den Ertragswert um rund acht Prozent.',
      lang: 'Er stammt aus dem Grundstücksmarktbericht des örtlichen Gutachterausschusses. Liegt keiner vor, greift der gesetzliche Auffangwert nach § 256 BewG — der ist nicht marktabgeleitet, liegt in der Regel darunter und erzeugt damit einen eher hohen Ertragswert. Die verwendete Stufe steht im Ergebnis und im PDF.',
      grund: '§ 21 Abs. 2 ImmoWertV; § 256 BewG'
    },
    bgf: {
      kurz: 'Die Bruttogrundfläche ist die Summe aller Grundrissebenen, außen gemessen — nicht die Wohnfläche.',
      lang: 'Gemessen werden alle Geschosse an den Außenkanten, einschließlich Wände, Treppenhaus, Keller und ausgebautem Dachgeschoss. Sie ist deshalb deutlich größer als die Wohnfläche: bei einem Einfamilienhaus grob das Anderthalbfache. Der Sachwert rechnet mit ihr, weil die Herstellungskosten je Quadratmeter Bruttogrundfläche angegeben sind. Steht sie in den Bauunterlagen, trag sie ein — jede Schätzung überträgt sich eins zu eins auf den Sachwert.',
      grund: 'DIN 277 · Anlage 4 ImmoWertV'
    },
    sachwertfaktor: {
      kurz: 'Rechnet den Sachwert auf das örtliche Marktniveau um. Leer lassen, wenn kein amtlicher Wert vorliegt.',
      lang: 'Der Sachwert aus Herstellungskosten und Bodenwert ist noch kein Marktwert — er sagt, was der Bau kosten würde, nicht was jemand zahlt. Der Sachwertfaktor stellt diese Verbindung her: in schwachen Märkten liegt er bei 0,7, in gefragten Lagen über 1,3. Er wird vom Gutachterausschuss aus tatsächlichen Kaufpreisen abgeleitet und steht im Grundstücksmarktbericht. Ohne ihn weist der Bericht nur den vorläufigen Sachwert aus, mit entsprechendem Hinweis.',
      grund: '§ 21 Abs. 3 ImmoWertV'
    },
    brwManuell: {
      kurz: 'Bodenrichtwert in €/m². Leer lassen, wenn der amtliche Abruf funktioniert — er wird dann automatisch geholt.',
      lang: 'In Bayern, Baden-Württemberg, im Saarland und in Schleswig-Holstein gibt es keinen freien Abrufdienst; dort ist die manuelle Eingabe der einzige Weg. Den Wert findest du im BORIS-Portal deines Bundeslandes: Adresse suchen, auf das Grundstück klicken, Wert und Stichtag ablesen. Achte darauf, den Richtwert für die richtige Nutzungsart zu nehmen — für eine Wohnung ist das die Wohnbaufläche.',
      grund: '§ 196 BauGB'
    },
    brwAnp: {
      kurz: 'Prozentuale Anpassung des Bodenrichtwerts für Zuschnitt, Ecklage oder Tiefe. Ohne Begründung im Dossier nicht verwertbar.',
      grund: '§ 40 Abs. 3 ImmoWertV'
    },

    /* === v1334 - Die Grundangaben hatten keine einzige Erklaerung =======
       Marcels Befund: "Die beschreibungen fehlen. Was ist mit zum Beispiel
       geschossen gemeint oder Etagen? Vollgeschosse mit oder ohne
       Dachboden? Ich wuerde mir mehr beschreibung wuenschen und vlt
       zusaetzlich wo bekomme ich das her."

       Er hat zweimal recht. Erstens trug KEIN Feld des Grundformulars ein
       Info-Zeichen - die 19 vorhandenen Texte haengen alle an der
       Wertermittlung, also am tiefsten Teil. Wer oben anfaengt, bekommt
       nichts. Zweitens ist "wo bekomme ich das her" die Frage, die in der
       Praxis wirklich aufhaelt; sie steht ab jetzt als eigenes Feld
       `woher` in jedem Text, immer an derselben Stelle. */
    address: {
      kurz: 'Stra\u00dfe, Hausnummer, Postleitzahl und Ort \u2014 in einer Zeile. Sie bestimmt den Gutachterausschuss, den Bodenrichtwert und das Vergleichsgebiet.',
      woher: 'Kaufvertrag, Expos\u00e9 oder Grundbuchauszug.',
      lang: 'Ohne Hausnummer trifft der Bodenrichtwert-Abruf die falsche Richtwertzone \u2014 in gewachsenen Orten liegen zwei Seiten derselben Stra\u00dfe regelm\u00e4\u00dfig in verschiedenen Zonen. Der Ort allein reicht f\u00fcr eine Marktpreisindikation, nicht f\u00fcr eine Wertermittlung.'
    },
    ptype: {
      kurz: 'Die Objektart steuert das ganze Verfahren: welche Normalherstellungskosten gelten, welcher Liegenschaftszinssatz gezogen wird und ob ein Sachwert \u00fcberhaupt sinnvoll ist.',
      woher: 'Kaufvertrag oder Teilungserkl\u00e4rung.',
      lang: 'Bei einer Eigentumswohnung wird kein eigenst\u00e4ndiger Bodenwert angesetzt, sondern der Anteil \u00fcber den Miteigentumsanteil. Bei einem Mehrfamilienhaus f\u00fchrt das Ertragswertverfahren, beim Einfamilienhaus das Sachwertverfahren \u2014 dieselbe Adresse ergibt je nach Objektart einen anderen Rechenweg.',
      grund: '\u00a7\u00a7 17 ff. ImmoWertV'
    },
    usage: {
      kurz: 'Kapitalanlage oder Eigennutzung. \u00c4ndert nicht den Verkehrswert, aber die Kennzahlen, die daneben stehen \u2014 Rendite, Cashflow und Steuerwirkung.',
      woher: 'Deine eigene Absicht.'
    },
    area: {
      kurz: 'Wohnfl\u00e4che in m\u00b2 nach Wohnfl\u00e4chenverordnung \u2014 nicht die Grundfl\u00e4che und nicht die Bruttogrundfl\u00e4che.',
      woher: 'Kaufvertrag, Teilungserkl\u00e4rung mit Aufteilungsplan, Mietvertrag oder Wohnfl\u00e4chenberechnung des Architekten.',
      lang: 'Balkone, Loggien und Terrassen z\u00e4hlen in der Regel zu einem Viertel, h\u00f6chstens zur H\u00e4lfte. Fl\u00e4chen unter Dachschr\u00e4gen z\u00e4hlen zwischen einem und zwei Metern H\u00f6he zur H\u00e4lfte, darunter gar nicht. Keller, Waschk\u00fcche und Garage geh\u00f6ren nie dazu. Eine um f\u00fcnf Prozent zu gro\u00dfe Wohnfl\u00e4che verschiebt den Ertragswert um denselben Satz.',
      grund: '\u00a7\u00a7 2\u20134 WoFlV'
    },
    rooms: {
      kurz: 'Anzahl der Wohnr\u00e4ume. K\u00fcche, Bad, Flur und Abstellraum z\u00e4hlen nicht mit.',
      woher: 'Grundriss oder Expos\u00e9.'
    },
    year: {
      kurz: 'Baujahr im Sinne der Bezugsfertigkeit \u2014 das Jahr, in dem das Geb\u00e4ude erstmals genutzt werden konnte, nicht das Jahr der Baugenehmigung.',
      woher: 'Bauakte beim Bauamt, Grundbuch-Bestandsverzeichnis, Energieausweis oder Expos\u00e9.',
      lang: 'Aus dem Baujahr folgt \u00fcber die Gesamtnutzungsdauer die Restnutzungsdauer, und aus der die Alterswertminderung. Bei umfassender Modernisierung wird die Restnutzungsdauer nach Anlage 2 ImmoWertV verl\u00e4ngert \u2014 dann ist das Baujahr weiter das echte, und die Verl\u00e4ngerung wird getrennt ausgewiesen. Ein \u201efiktives Baujahr\u201c einzutragen, verf\u00e4lscht beides.',
      grund: '\u00a7 38 ImmoWertV, Anlage 1 und 2'
    },
    floor: {
      kurz: 'In welchem Geschoss die Wohnung liegt \u2014 <b>nicht</b> wie viele Geschosse das Haus hat. 0 ist das Erdgeschoss, 1 das erste Obergeschoss.',
      woher: 'Teilungserkl\u00e4rung mit Aufteilungsplan, Klingelschild oder Expos\u00e9.',
      lang: 'Die Zahl der Geschosse im Geb\u00e4ude wird an ganz anderer Stelle gefragt: im Sachwertblock unter \u201eGeschosse und Unterkellerung\u201c, weil sie in den Kostenkennwert eingeht. Hier geht es nur um die Lage der bewerteten Wohnung im Haus \u2014 Erdgeschoss und Dachgeschoss werden am Markt unterschiedlich bezahlt, ein Obergeschoss ohne Aufzug ab dem dritten sp\u00fcrbar schlechter. Bei einem Haus bleibt das Feld leer.'
    },
    rent: {
      kurz: 'Monatliche Nettokaltmiete des Wohnraums \u2014 ohne Betriebskosten, ohne Stellplatz, ohne M\u00f6blierungs- oder K\u00fcchenzuschlag.',
      woher: 'Mietvertrag oder Mieterliste. Bei Leerstand leer lassen \u2014 dann rechnet der Bericht mit der Marktmiete.',
      lang: 'Die Vergleichsmiete stammt aus reinen Wohnungsangeboten. Wer den Stellplatz mit einrechnet, bekommt eine gemeldete Abweichung, die keine ist. Stellplatzmieten geh\u00f6ren in das eigene Feld im Ertragswertblock \u2014 sie z\u00e4hlen zum Rohertrag, aber getrennt.',
      grund: '\u00a7 31 ImmoWertV'
    },
    price: {
      kurz: 'Kaufpreis oder Angebotspreis, wenn bekannt. Er geht nicht in die Wertermittlung ein \u2014 der Bericht stellt ihn dem ermittelten Wert gegen\u00fcber.',
      woher: 'Kaufvertrag oder Expos\u00e9.'
    },
    energy: {
      kurz: 'Energieeffizienzklasse A bis H aus dem Energieausweis. Sie wirkt \u00fcber den Markt, nicht \u00fcber die Herstellungskosten.',
      woher: 'Energieausweis, Seite 1 \u2014 der Buchstabe neben dem Farbband. Beim Verkauf ist er vorzulegen.',
      lang: 'Verbrauchs- und Bedarfsausweis sind nicht dasselbe: der Verbrauchsausweis bildet das Heizverhalten der bisherigen Bewohner ab und schwankt deutlich. Trag ein, was im Ausweis steht \u2014 die Einordnung geh\u00f6rt in den Bericht, nicht in deine Sch\u00e4tzung.',
      grund: '\u00a7\u00a7 80 ff. GEG'
    },
    quality: {
      kurz: 'Ausstattungsqualit\u00e4t im Vergleich zum ortsüblichen Standard des Baujahrs \u2014 nicht zum Neubaustandard von heute.',
      woher: 'Eigener Eindruck bei der Besichtigung; B\u00e4der, B\u00f6den, Fenster und Heizung geben den Ausschlag.',
      lang: 'Ein Haus von 1970 mit originalen, gepflegten B\u00e4dern ist \u201enormal\u201c, nicht \u201eeinfach\u201c. \u201eGehoben\u201c setzt mehr voraus als ein neues Bad: hochwertige B\u00f6den, gute Fenster, ordentliche Haustechnik. Wer hier zu gro\u00dfz\u00fcgig ist, hebt den Sachwert \u00fcber die Standardstufe sp\u00fcrbar an.'
    },
    modern: {
      kurz: 'Grad der Modernisierung. Steuert zusammen mit dem Baujahr die Verl\u00e4ngerung der Restnutzungsdauer.',
      woher: 'Rechnungen, Handwerkerbelege, Bauakte \u2014 die Verl\u00e4ngerung muss belegbar sein.',
      lang: 'Eine verl\u00e4ngerte Restnutzungsdauer ist der wirksamste Hebel im ganzen Sachwertverfahren. Sie setzt echte Ma\u00dfnahmen voraus: D\u00e4mmung, Fenster, Heizung, Leitungen, B\u00e4der. Ein neuer Anstrich ist keine Modernisierung.',
      grund: 'Anlage 2 ImmoWertV'
    },
    modyear: {
      kurz: 'Jahr der letzten wesentlichen Modernisierung. Nur ausf\u00fcllen, wenn wirklich modernisiert wurde.',
      woher: 'Rechnungen oder Auskunft des Eigent\u00fcmers.'
    },
    baths: {
      kurz: 'Anzahl der B\u00e4der. Ein G\u00e4ste-WC z\u00e4hlt nicht als Bad \u2014 daf\u00fcr gibt es ein eigenes Feld.',
      woher: 'Grundriss.'
    },
    balcony: {
      kurz: 'Fl\u00e4che von Balkon, Loggia oder Terrasse in m\u00b2 \u2014 die volle Fl\u00e4che, nicht der bereits geviertelte Anteil.',
      woher: 'Aufteilungsplan oder Wohnfl\u00e4chenberechnung. Nicht doppelt: was schon in der Wohnfl\u00e4che steckt, geh\u00f6rt nicht noch einmal hierher.'
    },
    garden: {
      kurz: 'Gartenfl\u00e4che zur alleinigen Nutzung in m\u00b2. Bei einer Wohnung nur ein zugeordnetes Sondernutzungsrecht.',
      woher: 'Teilungserkl\u00e4rung (Sondernutzungsrecht) oder Lageplan.'
    },
    units: {
      kurz: 'Anzahl der Wohnungen im Geb\u00e4ude. Bei einer Eigentumswohnung, einem Einfamilienhaus, einer Doppelhaush\u00e4lfte und einem Reihenhaus ist es 1 \u2014 das wird automatisch gesetzt.',
      woher: 'Teilungserkl\u00e4rung, Mieterliste oder Klingelanlage.',
      lang: 'Gebraucht wird die Zahl f\u00fcr die Verwaltungskosten: die werden je bewerteter Einheit angesetzt, nicht je Quadratmeter. Bei einem Mehrfamilienhaus \u00e4ndert eine Einheit mehr oder weniger den Reinertrag sp\u00fcrbar, deshalb wird dort gefragt statt geraten.',
      grund: 'Anlage 3 ImmoWertV'
    },
    garages: {
      kurz: 'Anzahl der Garagen und Tiefgaragenstellpl\u00e4tze. Sie werden getrennt bewertet, nicht \u00fcber die Wohnfl\u00e4che.',
      woher: 'Kaufvertrag oder Teilungserkl\u00e4rung.'
    },
    outdoor: {
      kurz: 'Anzahl der Au\u00dfenstellpl\u00e4tze ohne Bauwerk. Sie flie\u00dfen \u00fcber die Au\u00dfenanlagen ein, nicht \u00fcber die Herstellungskosten.',
      woher: 'Lageplan oder Kaufvertrag.'
    },
    elevator: {
      kurz: 'Aufzug im Geb\u00e4ude. Wirkt vor allem in oberen Geschossen und bei altersgerechter Nutzung.',
      woher: 'Besichtigung.'
    },
    nhkGeschosse: {
      kurz: 'Anzahl der <b>Vollgeschosse</b> des Geb\u00e4udes und ob es unterkellert ist \u2014 die Gr\u00f6\u00dfe, die den Kostenkennwert steuert.',
      woher: 'Bauzeichnung oder Baugenehmigung beim Bauamt; die Vollgeschossdefinition steht in der Landesbauordnung.',
      lang: 'Vollgeschoss ist nicht dasselbe wie Etage. Ein ausgebautes Dachgeschoss z\u00e4hlt nur dann als Vollgeschoss, wenn es die Mindesth\u00f6he \u00fcber einem ausreichend gro\u00dfen Teil seiner Grundfl\u00e4che erreicht \u2014 in den meisten Landesbauordnungen zwei Drittel bis drei Viertel bei 2,30 m. Ein normaler Spitzboden oder ein nicht ausgebauter Dachboden ist NIE ein Vollgeschoss. Der Keller z\u00e4hlt in der Regel ebenfalls nicht mit; ob unterkellert wird, ist die eigene Frage in derselben Auswahl. Im Zweifel gilt: was in der Baugenehmigung als Vollgeschoss gef\u00fchrt wird.',
      grund: 'NHK 2010, Anlage 4 ImmoWertV; Vollgeschoss nach Landesbauordnung'
    },
    nhkDach: {
      kurz: 'Ob das Dachgeschoss ausgebaut ist \u2014 oder ob es ein Flachdach gibt. Geht direkt in den Kostenkennwert ein.',
      woher: 'Besichtigung oder Bauzeichnung.',
      lang: 'Ausgebaut hei\u00dft: beheizt und bewohnbar. Ein ged\u00e4mmter, aber unbewohnter Dachboden ist nicht ausgebaut. Der Unterschied im Kostenkennwert liegt je nach Geb\u00e4udeart bei rund zehn Prozent \u2014 er wirkt auf den gesamten Sachwert, nicht nur auf das Dachgeschoss.'
    },
    nhkHaus: {
      kurz: 'Geb\u00e4udeart nach den Normalherstellungskosten 2010 \u2014 freistehend, Doppelhaush\u00e4lfte, Reihenmittelhaus und so weiter.',
      woher: 'Lageplan oder Besichtigung.',
      lang: 'Die NHK 2010 f\u00fchren je Geb\u00e4udeart eine eigene Kostentabelle. Ein Reihenmittelhaus ist je Quadratmeter g\u00fcnstiger als ein freistehendes Haus, weil zwei W\u00e4nde entfallen \u2014 deshalb ist die Zuordnung keine Formsache.',
      grund: 'Anlage 4 ImmoWertV (NHK 2010)'
    },
    spMiete: {
      kurz: 'Monatliche Miete je Stellplatz. Geh\u00f6rt zum Rohertrag, aber getrennt von der Wohnraummiete.',
      woher: 'Mietvertrag; ortsüblich sind je nach Lage 15 bis 80 \u20ac im Monat.',
      grund: '\u00a7 31 ImmoWertV'
    },
    sonstEinnahmen: {
      kurz: 'Sonstige j\u00e4hrliche Einnahmen aus dem Grundst\u00fcck \u2014 Werbefl\u00e4chen, Mobilfunkantenne, Photovoltaik-Dachpacht.',
      woher: 'Die zugeh\u00f6rigen Vertr\u00e4ge. Nur dauerhafte Einnahmen, keine einmaligen.',
      grund: '\u00a7 31 ImmoWertV'
    },
    sanierungsjahr: {
      kurz: 'Jahr der Kernsanierung. Nur bei einer Sanierung, die einem Neubau nahekommt \u2014 nicht bei einzelnen Gewerken.',
      woher: 'Bauakte oder Rechnungen.'
    },
    brwStichtag: {
      kurz: 'Stichtag des Bodenrichtwerts. Die Richtwerte werden zum 1. Januar der geraden Jahre fortgeschrieben.',
      woher: 'Steht im BORIS-Auszug direkt am Wert.',
      grund: '\u00a7 196 BauGB'
    },
    brwAnpGrund: {
      kurz: 'Begr\u00fcndung der Bodenwertanpassung. Ohne sie ist die Anpassung im Dossier nicht verwertbar.',
      woher: 'Deine eigene Feststellung \u2014 Ecklage, Zuschnitt, \u00fcbertiefe, Hanglage.',
      grund: '\u00a7 40 Abs. 3 ImmoWertV'
    },
    aussenanlagen: {
      kurz: 'Wert der Au\u00dfenanlagen in Euro \u2014 Wege, Einfriedung, Terrasse, Gartenanlage. Nur ausf\u00fcllen, wenn nicht \u00fcber den Prozentsatz gerechnet wird.',
      woher: 'Eigene Sch\u00e4tzung anhand der tats\u00e4chlichen Anlagen.',
      grund: '\u00a7 36 Abs. 2 ImmoWertV'
    },
    hinterlandWert: {
      kurz: 'Wert des Hinterlands je m\u00b2. Fl\u00e4che hinter der baulich nutzbaren Tiefe \u2014 sie wird deutlich niedriger angesetzt.',
      woher: 'Grundst\u00fccksmarktbericht des Gutachterausschusses; ohne Angabe gilt ein Bruchteil des Bodenrichtwerts.',
      grund: '\u00a7 40 ImmoWertV'
    },
    besBauteile: {
      kurz: 'Wert besonderer Bauteile in Euro, die im Kostenkennwert nicht enthalten sind \u2014 Gauben, Balkone, Vordach, Wintergarten.',
      woher: 'Eigene Sch\u00e4tzung; sie unterliegen derselben Alterswertminderung wie das Geb\u00e4ude.',
      grund: '\u00a7 36 Abs. 2 ImmoWertV'
    }
  };

  /* ── Anzeige ───────────────────────────────────────────────────────────── */
  function aktiv() {
    try { return localStorage.getItem(AN) !== '0'; } catch (e) { return true; }
  }

  function stil() {
    if ($('fh-css')) return;
    var s = document.createElement('style');
    s.id = 'fh-css';
    s.textContent =
      '.fh{cursor:pointer;color:var(--wl-c9a84c,#C9A84C);font-size:13px;margin-left:5px;opacity:.75}' +
      '.fh:hover{opacity:1}' +
      '.fh-box{margin:6px 0 2px;padding:9px 11px;background:rgba(201,168,76,.06);' +
      'border-left:2px solid var(--wl-c9a84c,#C9A84C);border-radius:4px;font-size:12px;line-height:1.5;color:#b9b9c2}' +
      '.fh-box b{color:var(--wl-e8cc7a,#E8CC7A);font-weight:600}' +
      '.fh-more{margin-top:6px;cursor:pointer;color:var(--wl-c9a84c,#C9A84C);font-size:11.5px}' +
      '.fh-grund{margin-top:5px;font-size:11px;color:#7a7a84;font-style:italic}' +
      '.fh-anker{font-size:11.5px;color:#8a8a93;margin-top:4px;line-height:1.45}' +
      /* v1334: \u201ewo bekomme ich das her\u201c steht immer an derselben Stelle */
      '.fh-woher{margin-top:6px;font-size:11.5px;color:#9a9aa3;line-height:1.5}' +
      '.fh-woher b{color:#b9b9c2;font-weight:600}' +
      /* v1334: Vorschau beim Dr\u00fcberfahren. Sie zeigt NUR den Kurztext -
         wer mehr will, klickt. Auf Ger\u00e4ten ohne Maus erscheint sie nie
         (hover: none), dort bleibt der Klick der einzige Weg. */
      '.fh-tip{position:fixed;z-index:99999;max-width:330px;padding:9px 11px;background:#15151a;border:1px solid var(--wl-c9a84c,#C9A84C);border-radius:8px;font-size:12px;line-height:1.5;color:#d8d8e0;box-shadow:0 8px 26px rgba(0,0,0,.55);pointer-events:none;opacity:0;transition:opacity .12s}' +
      '.fh-tip.an{opacity:1}' +
      '.fh-tip .fh-tip-w{display:block;margin-top:6px;color:#9a9aa3;font-size:11px}' +
      '.fh-tip .fh-tip-k{display:block;margin-top:6px;color:#7a7a84;font-size:10.5px;font-style:italic}' +
      '@media (hover: none){.fh-tip{display:none}}';

    document.head.appendChild(s);
  }

  function box(feld, txt, anker) {
    var alt = document.querySelector('.fh-box[data-fh-for="' + feld + '"]');
    if (alt) { alt.remove(); return null; }
    /* v1146b-FHANKER · Nicht jeder Hilfe-Schlüssel ist eine Feld-Id.
     * `hinterland`, `ausstGewerk` und `bauteilHk` stehen für ganze
     * Feldgruppen — das ⓘ hängt dort 9× bzw. 5× an verschiedenen Feldern
     * (`ausstAussenwaende`, `btlGauben`, …). `$(feld)` findet dann nichts
     * und der Kasten wurde **still** gar nicht erst gebaut: der Text war
     * vorhanden, `textFuer()` warnte zu Recht nicht, und trotzdem passierte
     * beim Klick nichts. Genau der Fehler, den v1146 beheben sollte — nur
     * eine Ebene tiefer.
     *
     * Rückfall auf das angeklickte Zeichen selbst: es steht immer im Label
     * des Feldes, zu dem die Erklärung gehört. */
    var el = $(feld) || anker;
    if (!el) return null;
    var d = document.createElement('div');
    d.className = 'fh-box';
    d.setAttribute('data-fh-for', feld);
    var html = '<b>' + (txt.titel || 'Hinweis') + '</b><br>' + txt.kurz;
    /* v1334: die Quelle steht VOR dem Aufklapptext - sie ist die Frage,
       die in der Praxis wirklich aufh\u00e4lt. */
    if (txt.woher) html += '<div class="fh-woher"><b>Wo du das findest:</b> ' + txt.woher + '</div>';
    if (txt.lang) html += '<div class="fh-more" data-lang="1">\u25b8 mehr</div><div style="display:none">' + txt.lang + '</div>';

    if (txt.grund) html += '<div class="fh-grund">' + txt.grund + '</div>';
    d.innerHTML = html;
    (el.parentNode || document.body).appendChild(d);
    var m = d.querySelector('.fh-more');
    if (m) m.addEventListener('click', function () {
      var n = m.nextSibling;
      var auf = n.style.display === 'none';
      n.style.display = auf ? 'block' : 'none';
      m.textContent = auf ? '▾ weniger' : '▸ mehr';
    });
    return d;
  }

  /* Kontextsensitiv: der Text richtet sich nach dem, was gewählt ist. */
  function textFuer(feld) {
    var t = TEXTE[feld];
    /* v1146-FHTEXT · Ein stiller Rückfall sieht aus wie ein bestandener
     * Lauf. Genau so blieben neun Info-Zeichen unbemerkt wirkungslos: der
     * Klick fand keinen Text, gab `null` zurück, und niemand erfuhr davon
     * — weder Nutzer noch Entwickler. Fehlende Module laut melden, nicht
     * im Rückfall verschwinden lassen (dieselbe Lehre wie beim
     * DPC-Alias). */
    if (!t) {
      try {
        console.warn('[feldhilfe] kein Text für Feld "' + feld
          + '" — das Info-Zeichen bleibt wirkungslos. Eintrag in TEXTE fehlt.');
      } catch (e) {}
      return null;
    }
    var out = { kurz: t.kurz, lang: t.lang, grund: t.grund, titel: null };

    if (feld === 'lzs') {
      var bs = $('baustatus') ? $('baustatus').value : '';
      if (bs === 'neubau_erstbezug' || bs === 'neubau_im_bau') {
        out.kurz = 'Bei Neubauten liegt der Liegenschaftszinssatz meist am unteren Rand der örtlichen Spanne. ' + out.kurz;
      }
    }
    if (feld === 'plot') {
      var pt = $('ptype') ? String($('ptype').value).toLowerCase() : '';
      if (/etw|wohnung/.test(pt)) {
        out.titel = 'Bei einer Eigentumswohnung';
        out.kurz = 'Hier gehört die Fläche des GESAMTEN Grundstücks hinein, nicht ein Anteil davon. Den Anteil trägst du separat als Miteigentumsanteil ein.';
      }
    }
    /* v1145-SWFART · Ein Eingabefeld, das den Wert wegwirft, ist schlimmer
     * als keins. Für Eigentumswohnungen (und MFH/Gewerbe) leitet kein
     * Gutachterausschuss Sachwertfaktoren ab; seit v1144 wird ein
     * eingetragener Wert deshalb verworfen — bis dahin verschluckte ihn
     * ohnehin ein Feldname-Fehler. Am Prüfobjekt stand 1,15 im Feld und
     * blieb wirkungslos, ohne dass irgendwo etwas dazu stand. */
    if (feld === 'sachwertfaktor') {
      var pt2 = $('ptype') ? String($('ptype').value).toLowerCase() : '';
      if (/etw|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(pt2)) {
        out.titel = 'Für diese Objektart ohne Wirkung';
        out.kurz = 'Sachwertfaktoren werden nur für Ein- und Zweifamilien-, Doppel- und '
          + 'Reihenhäuser abgeleitet (Abschnitt 5.1.4). Ein hier eingetragener Wert '
          + '<b>wird nicht angewandt</b> — der Bericht weist den vorläufigen Sachwert aus.';
        out.lang = 'Das ist kein Mangel des Berichts: bei einer Eigentumswohnung führt das '
          + 'Vergleichswertverfahren, der Sachwert steht nur zur Einordnung daneben. Einen '
          + 'Faktor aus der Häuser-Ableitung auf eine Wohnung anzuwenden wäre ein '
          + 'Modellbruch (§ 10 ImmoWertV). ' + out.lang;
      }
    }
    return out;
  }

  /* Anker unter den Optionen eines Selects. */
  function ankerZeigen(feld) {
    var t = TEXTE[feld];
    var el = $(feld);
    if (!t || !t.anker || !el) return;
    var id = 'fh-anker-' + feld;
    var d = $(id);
    if (!d) {
      d = document.createElement('div');
      d.id = id; d.className = 'fh-anker';
      (el.parentNode || document.body).appendChild(d);
    }
    d.textContent = t.anker[el.value] || '';
  }

  /* ── v1145-SWFART · Sichtbar, ohne Klick ────────────────────────────────
   * Die Feldhilfe erklärt es erst auf Klick — gemerkt hat es aber niemand:
   * am Prüfobjekt stand 1,15 im Feld und blieb wirkungslos. `ankerZeigen()`
   * taugt hier nicht, es hängt am eigenen Feldwert; hier entscheidet die
   * Objektart nebenan. Deshalb eine eigene kleine Anzeige, die derselben
   * Klasse folgt. */
  function swfWirkung() {
    var el = $('sachwertfaktor');
    var id = 'fh-swf-aus';
    var d = $(id);
    if (!el) { if (d) d.remove(); return; }
    var pt = $('ptype') ? String($('ptype').value).toLowerCase() : '';
    if (!/etw|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(pt)) {
      if (d) d.remove();
      return;
    }
    if (!d) {
      d = document.createElement('div');
      d.id = id; d.className = 'fh-anker';
      (el.parentNode || document.body).appendChild(d);
    }
    d.textContent = 'Für diese Objektart ohne Wirkung — Sachwertfaktoren werden nur '
      + 'für Ein- und Zweifamilien-, Doppel- und Reihenhäuser abgeleitet.';
  }

  /* Baustatus schaltet den Modernisierungsblock. */
  function baustatusAnwenden() {
    var el = $('baustatus');
    if (!el) return;
    var neubau = /^neubau|^geplant/.test(el.value);
    ['modern', 'modyear'].forEach(function (f) {
      var e = $(f);
      if (!e) return;
      var wrap = e.closest ? e.closest('div') : e.parentNode;
      if (!wrap) return;
      wrap.style.display = neubau ? 'none' : '';
      /* NIE auf 0 setzen — eine Null wird mitgerechnet, "nicht anwendbar" nicht. */
      if (neubau) e.value = '';
    });
    var id = 'fh-neubau-hinweis';
    var alt = $(id);
    if (alt) alt.remove();
    if (neubau) {
      var d = document.createElement('div');
      d.id = id; d.className = 'fh-box';
      d.innerHTML = '<b>Neubau &mdash; hier ist nichts einzutragen.</b><br>'
        + 'Die Restnutzungsdauer entspricht der vollen Gesamtnutzungsdauer, eine Alterswertminderung f&auml;llt nicht an. '
        + 'Der Modernisierungsblock ist deshalb ausgeblendet.';
      (el.parentNode || document.body).appendChild(d);
    }
    /* Erstbezug nach Sanierung: Modernisierung auf Maximum vorbelegen. */
    if (el.value === 'bestand_erstbezug_saniert' && $('modern') && !$('modern').value) {
      $('modern').value = 'kernsaniert';
    }
  }

  /* === v1334 - DIE INFO-ZEICHEN HAENGEN SICH SELBST AN ================
     Bisher stand jedes \u24d8 von Hand im Markup, und zwar ausschliesslich
     in wertermittlung.js. Das Grundformular in index.html trug KEIN
     einziges `data-fh` - genau die Felder also, an denen Marcel
     haengengeblieben ist.

     Von Hand nachtragen hiesse: 35 Stellen im HTML, und beim naechsten
     neuen Feld faengt es von vorn an. Stattdessen wird hier zugeordnet:
     wo es einen Text gibt und das Feld ein <label> hat, kommt das
     Zeichen dazu. Die Zuordnung ist bewusst EXPLIZIT und nicht
     "Feld-Id == Text-Schluessel fuer alles" - sonst bekaeme ein Feld ein
     Zeichen, sobald zufaellig ein gleichnamiger Text existiert.

     ZWEITER FEHLER, DER DABEI AUFFIEL: `start()` band den Klick nur an
     die \u24d8, die es beim Start schon gab. Die Wertermittlung baut ihre
     Felder aber erst je Stufe - deren Zeichen waren da, sahen richtig
     aus und taten nichts, bis jemand `Feldhilfe.neuLaden()` rief. Die
     Bindung haengt jetzt am document und gilt damit auch fuer alles,
     was spaeter entsteht. */
  var AUTO = [
    'address', 'ptype', 'usage', 'area', 'rooms', 'year', 'floor', 'rent',
    'price', 'cond', 'energy', 'quality', 'modern', 'modyear', 'baths',
    'balcony', 'garden', 'plot', 'units', 'garages', 'outdoor', 'elevator',
    'nhkGeschosse', 'nhkDach', 'nhkHaus', 'spMiete', 'sonstEinnahmen',
    'sanierungsjahr', 'brwStichtag', 'brwAnpGrund', 'aussenanlagen',
    'hinterlandWert', 'besBauteile'
  ];
  function zeichenAnhaengen() {
    var n = 0;
    for (var i = 0; i < AUTO.length; i++) {
      var id = AUTO[i];
      if (!TEXTE[id]) continue;
      var el = $(id); if (!el) continue;
      var umfeld = el.closest ? el.closest('div') : null;
      var lab = umfeld ? umfeld.querySelector('label') : null;
      if (!lab) continue;
      if (lab.querySelector('.fh[data-fh="' + id + '"]')) continue;
      var sp = document.createElement('span');
      sp.className = 'fh';
      sp.setAttribute('data-fh', id);
      sp.innerHTML = '&#9432;';
      lab.appendChild(sp);
      n++;
    }
    return n;
  }

  /* Vorschau beim Dr\u00fcberfahren - Marcels Wunsch w\u00f6rtlich: "ein info feld
     dahinter anzeigen wenn man mit der maus dr\u00fcber f\u00e4hrt". */
  var _tip = null, _tipZeit = null;
  function tipWeg() {
    if (_tipZeit) { clearTimeout(_tipZeit); _tipZeit = null; }
    if (_tip) { _tip.classList.remove('an'); var t = _tip; _tip = null; setTimeout(function () { try { t.remove(); } catch (e) {} }, 200); }
  }
  function tipZeigen(el, feld) {
    var txt = textFuer(feld); if (!txt) return;
    tipWeg();
    var d = document.createElement('div');
    d.className = 'fh-tip';
    var h = txt.kurz || '';
    if (txt.woher) h += '<span class="fh-tip-w"><b>Wo du das findest:</b> ' + txt.woher + '</span>';
    h += '<span class="fh-tip-k">Klicken f\u00fcr die ausf\u00fchrliche Erkl\u00e4rung</span>';
    d.innerHTML = h;
    document.body.appendChild(d);
    var r = el.getBoundingClientRect();
    var b = d.getBoundingClientRect();
    var links = Math.min(Math.max(8, r.left), (window.innerWidth || 800) - b.width - 8);
    var oben = r.bottom + 8;
    if (oben + b.height > (window.innerHeight || 600) - 8) oben = Math.max(8, r.top - b.height - 8);
    d.style.left = links + 'px';
    d.style.top = oben + 'px';
    _tip = d;
    requestAnimationFrame(function () { if (_tip === d) d.classList.add('an'); });
  }

  function start() {
    if (!aktiv()) return;
    stil();
    zeichenAnhaengen();
    /* v1334: einmal am document statt n-mal am Zeichen - gilt auch fuer
       Felder, die wertermittlung.js erst je Stufe baut. */
    if (!window.__fhDelegiert) {
      window.__fhDelegiert = 1;
      document.addEventListener('click', function (ev) {
        var i = ev.target && ev.target.closest ? ev.target.closest('.fh') : null;
        if (!i) return;
        var f = i.getAttribute('data-fh');
        var t = textFuer(f);
        if (t) box(f, t, i.parentNode || i);   /* v1146b: Anker fuer Gruppen-Schluessel */
        tipWeg();
      }, true);
      document.addEventListener('mouseover', function (ev) {
        var i = ev.target && ev.target.closest ? ev.target.closest('.fh') : null;
        if (!i) return;
        if (_tipZeit) clearTimeout(_tipZeit);
        _tipZeit = setTimeout(function () { tipZeigen(i, i.getAttribute('data-fh')); }, 260);
      }, true);
      document.addEventListener('mouseout', function (ev) {
        var i = ev.target && ev.target.closest ? ev.target.closest('.fh') : null;
        if (i) tipWeg();
      }, true);
      document.addEventListener('scroll', tipWeg, true);
      /* Neue Felder bekommen ihr Zeichen, sobald sie entstehen. */
      try {
        new MutationObserver(function () { zeichenAnhaengen(); })
          .observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
    }
    ['baustatus', 'cond'].forEach(function (f) {
      var e = $(f);
      if (!e) return;
      ankerZeigen(f);
      e.addEventListener('change', function () { ankerZeigen(f); });
    });
    /* v1145-SWFART · Das Feld `sachwertfaktor` liegt im Block wm-b3 und
     * entsteht erst beim Hochstufen — ein einmaliger Aufruf beim Start
     * verpufft deshalb. Am `document` lauschen ist hier billiger als ein
     * Beobachter: die Prüfung ist zwei Feldzugriffe lang. */
    document.addEventListener('change', swfWirkung, true);
    document.addEventListener('input', swfWirkung, true);
    swfWirkung();
    var bs = $('baustatus');
    if (bs) { bs.addEventListener('change', baustatusAnwenden); baustatusAnwenden(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Feldhilfe = { texte: TEXTE, neuLaden: start, zeichenAnhaengen: zeichenAnhaengen };   /* v1334 */
})();
