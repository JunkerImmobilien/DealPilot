// quellen_links.js  (v1099-WQL)
//
// WO DER KUNDE DEN WERT SELBST HOLT.
//
// Marcels Vorgabe vom 13.09.2026: „gib im Marktbericht bei den
// Liegenschaftszinsen und Sachwertfaktoren den Link an, wenn der Kunde die
// Adresse eingegeben hat. Dann kann er selber die Werte holen oder kaufen,
// wenn diese nicht umsonst zur Verfügung stehen."
//
// DAS IST DAS GEGENSTUECK ZUR DOKTRIN. Wir erfinden keine Zahl — also
// muessen wir umso genauer sagen koennen, wo die echte steht. Ein Bericht,
// der „kein Wert hinterlegt" sagt und den Nutzer damit allein laesst, ist
// schlechter als einer, der den zustaendigen Ausschuss beim Namen nennt und
// verlinkt.
//
// DREI REGELN, die aus dem Backlog (C2) kommen und hier gelten:
//
//   1. NUR DIE LANDINGSEITE, nie das Jahrgangs-PDF. Deep-Links brechen
//      jaehrlich; ein toter Link im Kundenbericht ist schlimmer als keiner.
//   2. KEIN BETRAG OHNE BELEG. Wo ein Bericht kostenpflichtig ist, steht
//      „kostenpflichtig" — keine Zahl, solange sie nicht belegt ist.
//   3. DER LINK DARF NICHT SUGGERIEREN, dass DealPilot den Wert liefert.
//      Der Text sagt, wer ihn fuehrt.
//
// WARUM EINE DATEI UND KEINE DATENBANKTABELLE (noch nicht):
// Das Quellenregister in der Datenbank ist Backlog C1 und groesser — es
// fuehrt Jahrgang, Lizenz, Stichtag, Seite und den Pruefzyklus. Diese Datei
// ist der kleine Anfang: sie beantwortet genau eine Frage, naemlich „wohin
// schicke ich den Nutzer". Sobald C1 steht, zieht sie dort ein; bis dahin
// ist eine Datei besser als ein fehlender Link.

/** Bundesland-Portale. Schluessel ist das Landeskuerzel des AGS (erste zwei
 *  Stellen), damit die Zuordnung ohne Namensliste funktioniert. */
export const LAND_QUELLEN = {
  '01': { land: 'Schleswig-Holstein',
          stelle: 'Obere Gutachterausschuss für Grundstückswerte in Schleswig-Holstein',
          url: 'https://www.schleswig-holstein.de/DE/landesregierung/themen/bauen-wohnen/gutachterausschuesse/gutachterausschuesse_node.html',
          zugang: 'teils kostenpflichtig' },
  '02': { land: 'Hamburg',
          stelle: 'Gutachterausschuss für Grundstückswerte in Hamburg',
          url: 'https://www.hamburg.de/politik-und-verwaltung/behoerden/behoerde-fuer-stadtentwicklung-und-wohnen/aemter-und-landesbetrieb/landesbetrieb-geoinformation-und-vermessung/produkte-und-dienstleistungen/infos-ueber-grundstuecke/gutachterausschuss-fuer-grundstueckswerte',
          zugang: 'kostenfrei' },
  /* v1122-WNI · Niedersachsen führt seine Sachwertfaktoren in KALKULATOREN,
     einen je Ausschuss und Teilmarkt, erreichbar über eine Karte. Der Weg
     dorthin ist zwei Klicks lang und lohnt die genauere Auskunft: die
     Landesseite darüber führt alle Marktdaten, die Karte führt GENAU den
     Rechner für das Gebiet des Nutzers. */
  '03': { land: 'Niedersachsen',
          stelle: 'Gutachterausschüsse für Grundstückswerte in Niedersachsen',
          url: 'https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/sachwertfaktor/',
          zugang: 'kostenfrei',
          hinweis: 'Der Sachwertfaktor steht dort in einem Rechner, nicht in einer Tabelle: Teilmarkt wählen (Ein-/Zweifamilienhaus, Reihenhaus/Doppelhaushälfte, Hof, Wochenendhaus), auf der Karte die Region anklicken, dann Bodenrichtwert und vorläufigen Sachwert eingeben. Der Rechner nennt auch die Standardabweichung und die Stichprobe.' },
  '04': { land: 'Bremen',
          stelle: 'Gutachterausschuss für Grundstückswerte in Bremen',
          url: 'https://www.bauumwelt.bremen.de/bauen/gutachterausschuss-fuer-grundstueckswerte-3489',
          zugang: 'teils kostenpflichtig' },
  '05': { land: 'Nordrhein-Westfalen',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte in Nordrhein-Westfalen',
          url: 'https://www.boris.nrw.de/',
          zugang: 'kostenfrei',
          hinweis: 'Die Grundstücksmarktberichte der einzelnen Ausschüsse stehen zusätzlich unter gars.nrw.' },
  '06': { land: 'Hessen',
          stelle: 'Zentrale Geschäftsstelle der Gutachterausschüsse für Immobilienwerte des Landes Hessen',
          url: 'https://hvbg.hessen.de/immobilienwertermittlung/immobilienmarktberichte',
          zugang: 'kostenfrei',
          hinweis: 'Die regionalen Immobilienmarktberichte der letzten zehn Jahre stehen im Downloadcenter unter gds.hessen.de.' },
  /* v1128-WRP · Hier stand „der Landesbericht ist kostenpflichtig". GEMESSEN
     am 14.09.2026: er ist es nicht — der Landesgrundstücksmarktbericht 2025
     steht als PDF frei zum Abruf. Wichtiger noch ist die zweite Zeile: der
     Herausgeber hat seine eigenen Sachwertfaktoren nachträglich
     eingeschränkt, und wer nur die Haupttabelle liest, erfährt es nicht. */
  '07': { land: 'Rheinland-Pfalz',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte Rheinland-Pfalz',
          url: 'https://gutachterausschuesse.rlp.de/marktdaten/landesgrundstuecksmarktbericht-rheinland-pfalz-lgmb',
          zugang: 'kostenfrei',
          hinweis: 'Der Landesgrundstücksmarktbericht führt Sachwertfaktoren und Liegenschaftszinssätze; daneben erscheinen eigene Berichte für Kaiserslautern, Koblenz, Ludwigshafen, Mainz, Trier und Worms. WICHTIG: der Ausschuss hat am 30.04.2025 selbst nachgeschoben, dass die für MARKTSEGMENT 1 veröffentlichten Sachwertfaktoren für Ein- und Zweifamilienhäuser „als etwas zu hoch anzusehen sind und in der praktischen Anwendung niedriger angesetzt werden sollten" — der Hinweis steht als eigenes Blatt neben dem Bericht.' },
  '08': { land: 'Baden-Württemberg',
          stelle: 'Gutachterausschüsse in Baden-Württemberg',
          url: 'https://www.gutachterausschuesse-bw.de/',
          zugang: 'teils kostenpflichtig' },
  '09': { land: 'Bayern',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte im Freistaat Bayern',
          url: 'https://www.gutachterausschuesse-bayern.de/marktberichte-bayern/',
          zugang: 'kostenfrei',
          hinweis: 'Der Landesbericht ist frei abrufbar; die örtlichen Berichte führen die Gutachterausschüsse der Kreise und kreisfreien Städte.' },
  '10': { land: 'Saarland',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte im Saarland',
          url: 'https://www.saarland.de/lvgl/DE/portalthemen/immobilienmarkt/immobilienmarkt_node.html',
          zugang: 'teils kostenpflichtig' },
  '11': { land: 'Berlin',
          stelle: 'Gutachterausschuss für Grundstückswerte in Berlin',
          url: 'https://www.berlin.de/gutachterausschuss/',
          zugang: 'kostenfrei' },
  '12': { land: 'Brandenburg',
          stelle: 'Gutachterausschüsse für Grundstückswerte im Land Brandenburg',
          url: 'https://gutachterausschuesse-bb.de/',
          zugang: 'kostenfrei' },
  '13': { land: 'Mecklenburg-Vorpommern',
          stelle: 'Gutachterausschüsse für Grundstückswerte in Mecklenburg-Vorpommern',
          url: 'https://www.laiv-mv.de/Geoinformation/Wertermittlung/gutachterausschuesse%E2%80%93fuer%E2%80%93grundstueckswerte/',
          zugang: 'kostenfrei' },
  '14': { land: 'Sachsen',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte im Freistaat Sachsen',
          url: 'https://www.landesvermessung.sachsen.de/gutachterausschuesse-fuer-grundstueckswerte-4127.html',
          zugang: 'teils kostenpflichtig' },
  '15': { land: 'Sachsen-Anhalt',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte in Sachsen-Anhalt',
          url: 'https://www.lvermgeo.sachsen-anhalt.de/de/gutachterausschuesse.html',
          zugang: 'kostenfrei' },
  '16': { land: 'Thüringen',
          stelle: 'Oberer Gutachterausschuss für Grundstückswerte in Thüringen',
          url: 'https://tlbg.thueringen.de/gutachterausschuesse',
          zugang: 'kostenfrei' },
};

/* ═══ v1118-WAQ · DIE AUSSCHUSS-EBENE ═══════════════════════════════════
 *
 * Die Landestabelle darueber schickt jeden Nutzer auf dasselbe Portal.
 * Das ist besser als nichts, aber es ist nicht das, was wir wissen.
 *
 * Bei der Ernte wird JEDER Ausschuss einzeln geprueft, und bei vielen
 * endet die Pruefung mit „geht nicht" — der Bericht ist kostenpflichtig,
 * die Zahlen stehen nur als Diagramm, das Modell ist zehn Jahre alt. Diese
 * Erkenntnis war Arbeit und ist fuer den Nutzer mehr wert als das
 * Landesportal: sie sagt ihm, WO genau die Zahl liegt und WAS ihn
 * erwartet, wenn er sie holt.
 *
 * Ohne diese Tabelle faellt sie nach jeder Ernte auf den Boden.
 *
 * Schluessel ist der AGS-PRAEFIX (Kreis- oder Gemeindeschluessel); der
 * laengste Treffer gewinnt. `warum_kein_wert` ist Pflicht — wer hier einen
 * Eintrag anlegt, hat nachgesehen und schreibt auf, was er gefunden hat.
 *
 * NICHT hier hinein gehoert ein Ausschuss, dessen Zahlen im Register
 * stehen. Dort gewinnt ohnehin der Registersatz. */
export const AUSSCHUSS_QUELLEN = {
  /* v1139 · Main-Kinzig-Kreis, Wetteraukreis und Stadt Hanau.
   * Der Bericht sieht aus wie eine reiche Quelle — zwei grosse Matrizen,
   * 1.526 Kauffaelle, Fallzahl und Bestimmtheitsmass je Klasse. Sie sind
   * aber NICHT oertlich abgeleitet: "Nach diesem Modell hat die ZGGH die
   * Kaufvertragsdaten der hessischen Gutachterausschuesse einheitlich
   * ausgewertet" (Kap. 8.3, S. 78), raeumlicher Anwendungsbereich
   * "Ueberregionale Auswertung (hessenweit)". Ein Landeswert im Gewand
   * eines Regionalberichts. */
  '06435': {
    stelle: 'Gutachterausschuss für Immobilienwerte für den Bereich des Main-Kinzig-Kreises, des Wetteraukreises und der Stadt Hanau',
    url: 'https://gds.hessen.de/INTERSHOP/web/WFS/HLBG-Geodaten-Site/de_DE/-/EUR/ViewDownloadcenter-Start?path=Immobilienwerte/Regionale%20Immobilienmarktberichte',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Immobilienmarktbericht 2026 druckt zwar zwei umfangreiche Sachwertfaktor-Tabellen ab, diese sind aber hessenweit von der Zentralen Geschäftsstelle ermittelt und nicht vom Gutachterausschuss beschlossen. Damit sind es keine sonstigen zur Wertermittlung erforderlichen Daten nach § 193 Abs. 5 BauGB. Ein örtlich abgeleiteter Sachwertfaktor liegt für diesen Bereich nicht vor.',
    hinweis: 'Der Bericht ist im Downloadcenter der Hessischen Verwaltung für Bodenmanagement kostenfrei abrufbar (Datei 2026_IMB_AFB_Büdingen.pdf). Kapitel 8.3 nennt das vollständige Sachwertmodell — Gesamtnutzungsdauer 80 Jahre, NHK 2010, kein Regionalfaktor, Außenanlagen 1 bis 10 Prozent je nach Standardstufe —, sodass eine modellkonforme Rechnung mit dem hessenweiten Faktor bewusst möglich bleibt.',
  },
  '06440': {
    stelle: 'Gutachterausschuss für Immobilienwerte für den Bereich des Main-Kinzig-Kreises, des Wetteraukreises und der Stadt Hanau',
    url: 'https://gds.hessen.de/INTERSHOP/web/WFS/HLBG-Geodaten-Site/de_DE/-/EUR/ViewDownloadcenter-Start?path=Immobilienwerte/Regionale%20Immobilienmarktberichte',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Immobilienmarktbericht 2026 druckt zwar zwei umfangreiche Sachwertfaktor-Tabellen ab, diese sind aber hessenweit von der Zentralen Geschäftsstelle ermittelt und nicht vom Gutachterausschuss beschlossen. Damit sind es keine sonstigen zur Wertermittlung erforderlichen Daten nach § 193 Abs. 5 BauGB. Ein örtlich abgeleiteter Sachwertfaktor liegt für diesen Bereich nicht vor.',
    hinweis: 'Der Bericht ist im Downloadcenter der Hessischen Verwaltung für Bodenmanagement kostenfrei abrufbar (Datei 2026_IMB_AFB_Büdingen.pdf). Kapitel 8.3 nennt das vollständige Sachwertmodell — Gesamtnutzungsdauer 80 Jahre, NHK 2010, kein Regionalfaktor, Außenanlagen 1 bis 10 Prozent je nach Standardstufe —, sodass eine modellkonforme Rechnung mit dem hessenweiten Faktor bewusst möglich bleibt.',
  },
  /* v1156 · Vorpommern-Greifswald. Der Bericht 2024 ist frei abrufbar und
   * fuehrt das Kapitel 6.1.1 - aber es ist LEER. Woertlich: "Dieses Kapitel
   * ist zum Zeitpunkt der Veroeffentlichung noch nicht vollstaendig
   * abgeschlossen." Ein dritter Zustand neben "kostenpflichtig" und "nicht
   * zuzuordnen": der Ausschuss ist noch nicht fertig. */
  '13075': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Landkreis Vorpommern-Greifswald',
    url: 'https://www.geocms.com/geoshop-lk-vorpommern-greifswald/de/grundstuecksmarktberichte.html',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Grundstücksmarktbericht 2024 führt das Kapitel „Sachwertfaktoren für freistehende Ein- und Zweifamilienhäuser" zwar auf, lässt es aber leer. Der Ausschuss schreibt dort: „Dieses Kapitel ist zum Zeitpunkt der Veröffentlichung noch nicht vollständig abgeschlossen. Die fehlenden Inhalte werden nach Fertigstellung im Wege einer Ergänzung bzw. Fortschreibung des Grundstücksmarktberichts veröffentlicht." Es gibt hier also derzeit keinen veröffentlichten Sachwertfaktor — weder kostenfrei noch gegen Gebühr.',
    hinweis: 'Das Bewertungsmodell ist dagegen vollständig abgedruckt (Tabelle 76): NHK 2010, Bezugsmaßstab Bruttogrundfläche aus der ALK, Baupreisindex nach § 36 ImmoWertV, ursprüngliches Baujahr, Gesamtnutzungsdauer nach Anlage 1 ImmoWertV, Restnutzungsdauer über 25 Jahre, lineare Alterswertminderung, bauliche Außenanlagen mit 2 bis 4 Prozent vom Zeitwert des Gebäudes. Sobald die Fortschreibung erscheint, ist der Faktor damit sofort modellkonform anwendbar — es lohnt, den Bericht im nächsten Jahrgang erneut zu prüfen. Der Liegenschaftszinssatz (Kapitel 6.2) ist im selben Bericht vollständig enthalten.',
  },
  /* v1155 · Landkreis Rostock. Der Bericht ist frei abrufbar und fachlich
   * reich - 675 Kauffaelle, vollstaendige Modellbeschreibung, Tabelle 12 mit
   * Regressionskonstanten je Teilmarkt. Woran es scheitert: die fuenf
   * regionalen Teilmaerkte sind RAUMORDNERISCH benannt ("Direktes +
   * entferntes Rostocker Umland", "Laendliche Zentren + Raum Nord und
   * staedtische Grundzentren auf der Siedlungsachse"), nicht mit Gemeinden.
   * Der Bericht fuehrt keine Zuordnungsliste; gesucht wurde danach in allen
   * 5.393 Textzeilen.
   *
   * DER KUNDE KANN ES TROTZDEM: er kennt seine Gemeinde, wir nicht. Deshalb
   * steht hier der Weg samt Fundstelle statt einer geratenen Zuordnung. */
  '13072': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Landkreis Rostock',
    url: 'https://www.geocms.com/geoshop-lk-rostock/de/grundstuecksmarktbericht.html',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Gutachterausschuss unterscheidet FÜNF regionale Teilmärkte mit erheblich verschiedenen Sachwertfaktoren — bei 100.000 Euro vorläufigem Sachwert reichen sie von 1,88 bis 1,02, bei 700.000 Euro von 0,78 bis 0,98. Welche Gemeinde zu welchem Teilmarkt gehört, führt der Bericht aber nicht als Liste; die Bereiche sind raumordnerisch benannt. Eine Zuordnung ohne diese Angabe wäre geraten, und bei einer Spannweite von mehr als Faktor zwei wäre ein falscher Teilmarkt teurer als gar kein Wert.',
    hinweis: 'Der Grundstücksmarktbericht 2025 ist kostenfrei als PDF abrufbar und enthält alles Nötige: Tabelle 12 auf Seite 43 führt für freistehende Ein- und Zweifamilienhäuser je Teilmarkt die Regressionskonstanten der Formel k = a × vSW^b (vorläufiger Sachwert in Mio. Euro), dazu Fallzahl, mittleres Bodenrichtwertniveau, Wohnfläche und Baujahr. Die fünf Teilmärkte heißen: Direktes und entferntes Rostocker Umland · Ostseebäder samt Umfeld und Mittelzentrum Bad Doberan · Mittelzentrum Güstrow · Ländliche Zentren Raum Süd mit Mittelzentrum Teterow · Ländliche Zentren Raum Nord. Wer weiß, wo sein Objekt liegt, findet seinen Faktor dort in einer Minute. Modell: NHK 2010, kein Regionalfaktor, Bruttogrundfläche, Zuschläge für ausgebauten Spitzboden (1,05), Zweifamilienhaus (1,05) und zum Wohnen ausgebauten Keller (1,10).',
  },
  /* v1154 · Nuernberg. Groesste bayerische Stadt nach Muenchen und in der
   * Erntekarte Gruppe A ("Sachwertfaktoren UND Marktbericht vorhanden").
   * Der Marktbericht steht online aber nur als LESEPROBE - die Tabelle der
   * Basissachwertfaktoren traegt dort woertlich die Ueberschrift
   * "Leseprobe ohne Daten". Die Modellbeschreibung ist vollstaendig, die
   * Zahlen fehlen. Gemessen am 14.09.2026 an der Datei
   * 24v400_gmb_nuernberg_2024_leseprobe.pdf. */
  '09564': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Bereich der Stadt Nürnberg',
    url: 'https://www.nuernberg.de/internet/geoinformation_bodenordnung/gutachterausschuss.html',
    zugang: 'kostenpflichtig',
    warum_kein_wert: 'Der Nürnberger Grundstücksmarktbericht steht online nur als Leseprobe zur Verfügung. Die Tabelle der Basissachwertfaktoren trägt dort die Überschrift „Leseprobe ohne Daten" — die Modellbeschreibung ist vollständig abgedruckt, die Zahlen selbst stehen nur im kostenpflichtigen Vollbericht.',
    hinweis: 'Das Modell ist ungewöhnlich und weicht von allen anderen Ausschüssen im Register ab: der Sachwertfaktor ergibt sich aus einem BASISSACHWERTFAKTOR, der nach dem prozentualen Bodenanteil am vorläufigen Sachwert (25 bis 80 Prozent) und dem Sachwert der baulichen Anlagen ohne Bodenwert gestaffelt ist; daran sind weitere Korrekturen anzubringen. Grundlage sind 1.204 Verkaufsfälle der Jahre 2018 bis 2024, bezogen auf 2024. Die korrigierten Faktoren liegen im Mittel bei 1,12 mit einer Streuung von 0,14; die damit errechneten Sachwerte haben eine Standardabweichung von 15 Prozent. Wer den Vollbericht bezieht, kann das Modell damit einordnen, bevor er zahlt.',
  },
  /* v1143 · Stadt Fulda. Eigener Gutachterausschuss, eigener Bericht — und
   * die Sachwertfaktoren stehen darin NUR als Diagramm. Keine Tabelle, keine
   * Regressionsformel, keine Stuetzstellen an den Kurven; die beigestellten
   * Kaesten nennen ausschliesslich Fallzahl, Bestimmtheitsmass und Mittelwerte.
   * Ablesen waere Schaetzen. Der Kreisausschuss (AfB Fulda) fuehrt fuer den
   * Marktbereich 3 zwar Werte, ist fuer das Stadtgebiet aber nicht zustaendig. */
  '06631009': {
    stelle: 'Gutachterausschuss für Immobilienwerte für den Bereich der Stadt Fulda',
    url: 'https://gds.hessen.de/INTERSHOP/web/WFS/HLBG-Geodaten-Site/de_DE/-/EUR/ViewDownloadcenter-Start?path=Immobilienwerte/Regionale%20Immobilienmarktberichte',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Immobilienmarktbericht 2026 der Stadt Fulda stellt die Sachwertfaktoren ausschließlich als Diagramm dar (Abbildungen 46 und 47) — ohne Wertetabelle und ohne Regressionsformel. Die Kurven lassen sich nicht ablesen, ohne zu schätzen, und geschätzte Werte gehören nicht in eine Wertermittlung. Der Gutachterausschuss gibt die Zahlen auf Anfrage heraus.',
    hinweis: 'Der Bericht ist im Downloadcenter der Hessischen Verwaltung für Bodenmanagement kostenfrei abrufbar (Datei 2026_IMB_Stadt_Fulda.pdf). Das Bewertungsmodell nennt er vollständig (Kapitel 9.2): Gesamtnutzungsdauer 80 Jahre, NHK 2010, Regionalfaktor 1,0, Bezugsmaßstab BGF nach DIN 277, Bodenrichtwertbereich 90 bis 655 Euro/m², Kauffälle 2024 bis 2025, Stichtag 01.01.2026. Für freistehende Ein- und Zweifamilienhäuser 115 Kauffälle bei einem Bestimmtheitsmaß von 0,67, für Doppel- und Reihenhäuser 52 Kauffälle bei 0,74.',
  },
  '08111': {
    stelle: 'Gutachterausschuss für die Ermittlung von Grundstückswerten in Stuttgart',
    url: 'https://www.stuttgart.de/leben/bauen/grundstueckswerte/',
    zugang: 'kostenpflichtig',
    warum_kein_wert: 'Der Internet-Auszug des Grundstücksmarktberichts ist kostenfrei, führt die Sachwertfaktoren aber nicht. Sie stehen in Kapitel 6.5.3 des Vollberichts, den das Kundenzentrum des Stadtmessungsamts abgibt.',
    hinweis: 'Die Modellbeschreibung zu den Sachwertfaktoren ist frei abrufbar (Stand 20.05.2025) — sie nennt alle Ansätze, die eine modellkonforme Rechnung braucht, nur nicht die Faktoren selbst.',
  },
  '01002': {
    stelle: 'Gutachterausschuss für Grundstückswerte in der Landeshauptstadt Kiel',
    url: 'https://www.gutachterausschuss-kiel.de/dienstleistungen/sachwertfaktoren/',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Das veröffentlichte Sachwertfaktorenmodell wertet die Jahre 2013 bis 2015 aus (Stand Februar 2017). Ein Faktor mit zehn Jahre altem Stichtag gehört nicht ungefragt in eine heutige Wertermittlung — wer ihn anwenden will, soll das bewusst tun.',
  },
  '01056': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Kreis Pinneberg',
    url: 'https://www.schleswig-holstein.de/gaa/DE/wir_ueber_uns/Gutachterausschuesse/gaPinneberg',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Die Immobilienmarktinformation 2025 beschreibt vier Bodenrichtwertklassen (100–275, 300–425, rund 500, 600–850 €/m²), druckt die Sachwertfaktoren aber nur als Diagramm ab. Eine Kurve abzulesen wäre geraten.',
  },
  '01060': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Kreis Segeberg',
    url: 'https://www.segeberg.de/Für-Segeberger/Umwelt-Planen-Bauen/Gutachterausschuss/',
    zugang: 'kostenfrei',
    warum_kein_wert: 'Der Grundstücksmarktbericht liegt beim Kreis selbst und nicht auf dem Landesportal; ein Sachwertfaktorenblatt im Format der übrigen Ausschüsse gibt es dort nicht.',
  },
  '01062': {
    stelle: 'Gutachterausschuss für Grundstückswerte im Kreis Stormarn',
    url: 'https://www.kreis-stormarn.de/kreis/sonderbereiche/gutachterausschuss-fuer-grundstueckswerte-im-kreis-stormarn/index.html',
    zugang: 'kostenpflichtig',
    warum_kein_wert: 'Der Grundstücksmarktbericht erscheint alle zwei bis drei Jahre und führt Sachwertfaktoren; die Einzelwerte gibt der Ausschuss kostenpflichtig über bodenrichtwerte.com heraus.',
  },
};

/**
 * Den Weg zur Quelle fuer einen AGS bestimmen.
 *
 * Liefert IMMER etwas, solange der AGS ein bekanntes Landeskuerzel traegt —
 * das ist der Sinn der Sache: der Nutzer soll nie ohne Anlaufstelle
 * dastehen. Ein Registersatz, falls vorhanden, gewinnt gegen die
 * Landestabelle, weil er den ZUSTAENDIGEN Ausschuss namentlich kennt.
 *
 * @param {string} ags        Amtlicher Gemeindeschluessel
 * @param {object} [satz]     Registersatz, falls einer vorliegt
 * @returns {{stelle:string, url:string, land:string, zugang:string,
 *            hinweis?:string, herkunft:'registersatz'|'landestabelle'}|null}
 */
export function quelleFuer(ags, satz = null) {
  /* Der Registersatz ist die bessere Auskunft: er nennt den Ausschuss, der
   * wirklich zustaendig ist, und die Seite, von der die Zahl stammt. */
  if (satz && satz.quelle_url) {
    const land = LAND_QUELLEN[String(satz.ags || ags || '').slice(0, 2)];
    return {
      stelle: satz.gaa_name || (land && land.stelle) || 'zuständiger Gutachterausschuss',
      url: satz.quelle_url,
      land: land ? land.land : null,
      zugang: (land && land.zugang) || 'unbekannt',
      hinweis: satz.auflagen || undefined,
      herkunft: 'registersatz',
    };
  }

  /* v1118-WAQ - der zustaendige Ausschuss gewinnt gegen das Landesportal.
     Laengster Praefix zuerst: ein Gemeindeeintrag (08111) schlaegt einen
     Kreiseintrag, ein Kreiseintrag schlaegt das Land. */
  const ziffern = String(ags || '').replace(/\D/g, '');
  if (ziffern) {
    const treffer = Object.keys(AUSSCHUSS_QUELLEN)
      .filter((p) => ziffern.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    if (treffer) {
      const a = AUSSCHUSS_QUELLEN[treffer];
      const land = LAND_QUELLEN[ziffern.slice(0, 2)];
      return { stelle: a.stelle, url: a.url, land: land ? land.land : null,
               zugang: a.zugang, hinweis: a.hinweis,
               warum_kein_wert: a.warum_kein_wert, herkunft: 'ausschusstabelle' };
    }
  }

  const l = LAND_QUELLEN[String(ags || '').replace(/\D/g, '').slice(0, 2)];
  if (!l) return null;
  return { stelle: l.stelle, url: l.url, land: l.land, zugang: l.zugang,
           hinweis: l.hinweis, herkunft: 'landestabelle' };
}

/**
 * Ein Satz fuer den Bericht — fertig formuliert, damit die Formulierung an
 * EINER Stelle steht und nicht in drei Ansichten auseinanderlaeuft.
 *
 * Er sagt drei Dinge: wer den Wert fuehrt, wo er steht, und ob er etwas
 * kostet. Was er NICHT sagt: dass DealPilot ihn liefert.
 */
export function quellenSatz(q, kennzahl = 'Wert') {
  if (!q) return null;
  const was = kennzahl === 'sachwertfaktor' ? 'Sachwertfaktoren'
            : kennzahl === 'liegenschaftszinssatz' ? 'Liegenschaftszinssätze'
            : kennzahl;
  const kosten = q.zugang === 'kostenfrei'
      ? 'Der Bericht steht dort kostenfrei zum Abruf.'
    : q.zugang === 'teils kostenpflichtig'
      ? 'Je nach Ausschuss ist der Bericht kostenfrei oder kostenpflichtig.'
    : q.zugang === 'kostenpflichtig'
      /* v1118-WAQ - hier ist es nicht "vielleicht": der zustaendige
         Ausschuss gibt die Zahl gegen Gebuehr heraus. Das gehoert
         gesagt, bevor jemand vergeblich sucht. */
      ? 'Der Ausschuss gibt diese Werte gegen Gebuehr heraus.'
      : '';
  return {
    text: `${was} für dieses Gebiet führt ${q.stelle}.`,
    kosten,
    url: q.url,
    hinweis: q.hinweis || null,
    /* v1118-WAQ - warum hier keine Zahl steht. Nur die Ausschusstabelle
       fuehrt das; bei Land und Registersatz bleibt es leer. */
    warum_kein_wert: q.warum_kein_wert || null,
  };
}

/* ── Bayern: wo der Ausschuss amtlich KEINE Sachwertfaktoren fuehrt ──────
 *
 * v1144 · Der Obere Gutachterausschuss fuer Grundstueckswerte im Freistaat
 * Bayern druckt im Immobilienmarktbericht 2026 (Kap. 11, S. 198 f.) eine
 * Uebersicht aller gemeldeten Ausschuesse ab: welche wertermittlungs-
 * relevanten Daten in den Jahren 2023 bis 2025 abgeleitet wurden und ob ein
 * Grundstuecksmarktbericht vorliegt.
 *
 * Fuer die hier gelisteten 35 Zustaendigkeitsbereiche steht in der Spalte
 * "Sachwertfaktoren" NICHTS. Das ist eine amtliche Aussage und keine Luecke
 * unserer Ernte - der Kunde soll sie erfahren, statt eine leere Antwort zu
 * bekommen.
 *
 * Darunter sind Muenchen LK, Starnberg, Ebersberg, Freising, Erding und
 * Miesbach: der gesamte Speckguertel um Muenchen mit den hoechsten
 * Bodenwerten Deutschlands. Wer dort im Sachwertverfahren bewertet, findet
 * beim oertlich zustaendigen Ausschuss keinen Marktanpassungsfaktor.
 *
 * Die Kreisschluessel stammen aus dem Gemeindeverzeichnis des Statistischen
 * Bundesamtes (Gebietsstand 30.09.2026), nicht aus dem Gedaechtnis.
 * Die vollstaendige Auswertung steht in claude/erntekarte-bayern.md. */
const BY_OHNE_SACHWERTFAKTOR = {
  '09161': 'Ingolstadt',            '09175': 'Ebersberg',
  '09177': 'Erding',                '09178': 'Freising',
  '09181': 'Landsberg am Lech',     '09182': 'Miesbach',
  '09184': 'München',               '09187': 'Rosenheim',
  '09188': 'Starnberg',             '09262': 'Passau',
  '09273': 'Kelheim',               '09274': 'Landshut',
  '09277': 'Rottal-Inn',            '09279': 'Dingolfing-Landau',
  '09373': 'Neumarkt i. d. Oberpfalz', '09461': 'Bamberg',
  '09472': 'Bayreuth',              '09473': 'Coburg',
  '09475': 'Hof',                   '09478': 'Lichtenfels',
  '09479': 'Wunsiedel i. Fichtelgebirge', '09561': 'Ansbach',
  '09565': 'Schwabach',             '09661': 'Aschaffenburg',
  '09662': 'Schweinfurt',           '09671': 'Aschaffenburg',
  '09672': 'Bad Kissingen',         '09674': 'Haßberge',
  '09675': 'Kitzingen',             '09676': 'Miltenberg',
  '09677': 'Main-Spessart',         '09678': 'Schweinfurt',
  '09762': 'Kaufbeuren',            '09764': 'Memmingen',
  '09780': 'Oberallgäu',
};

for (const [ags, name] of Object.entries(BY_OHNE_SACHWERTFAKTOR)) {
  /* Dritte Stelle 6 kennzeichnet in Bayern die kreisfreien Staedte. */
  const kreisfrei = ags[3] === '6';
  AUSSCHUSS_QUELLEN[ags] = {
    stelle: kreisfrei
      ? `Gutachterausschuss für Grundstückswerte im Bereich der Stadt ${name}`
      : `Gutachterausschuss für Grundstückswerte im Bereich des Landkreises ${name}`,
    url: 'https://www.gutachterausschuesse-bayern.de/marktberichte-bayern/',
    zugang: 'kostenfrei',
    warum_kein_wert:
      'Der zuständige Gutachterausschuss hat für die Jahre 2023 bis 2025 keine '
      + 'Sachwertfaktoren abgeleitet. Das steht so in der Übersicht des Oberen '
      + 'Gutachterausschusses für Grundstückswerte im Freistaat Bayern '
      + '(Immobilienmarktbericht 2026, Kapitel 11, Stand 2025). Ein amtlicher '
      + 'Marktanpassungsfaktor für das Sachwertverfahren liegt hier also nicht vor.',
    hinweis:
      'Die Übersicht sagt nur, OB Daten vorliegen — nicht für welche Objektart '
      + 'oder welchen Stichtag; sie führt außerdem nur, was dem Oberen '
      + 'Gutachterausschuss gemeldet wurde. Eine Nachfrage beim örtlich '
      + 'zuständigen Ausschuss kann sich deshalb lohnen. Bayern hat kein '
      + 'zentrales Downloadportal für Marktberichte; der Einstieg über die '
      + 'Landesseite führt zu den einzelnen Geschäftsstellen.',
  };
}
