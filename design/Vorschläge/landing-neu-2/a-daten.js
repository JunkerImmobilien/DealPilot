/* landing-neu-2 · gemeinsame Daten fuer idee-01 bis idee-05 (Vorschlag, nicht eingebaut).
   Herkunft jeder Zahl:
   - Score: Hero der Landing (frontend/landing/dp2.js CATS, index.html .idscard: 87, 180.000 EUR, 23/24, 96 %).
     Aufteilung Investment/Finanzierung mit _zweiTeil() aus frontend/js/dealscore2.js gerechnet
     (design/Vorschläge/score-animation-2/rechnung.mjs): Investment 80,911 -> 81 (Gewicht 59,25),
     Finanzierung 96,344 -> 96 (Gewicht 40,75), gewichtetes Mittel 87,2 -> 87.
     Fuenf Bereiche mit den Gewichten 35/25/20/10/10 aus frontend/js/dealscore.js / Landing: 87,2 -> 87.
   - Register- und Datenzahlen: frontend/landing/register-stand.js, index.html (data-umfang), Stand 11.11.2026.
   - Preise: frontend/landing/index.html #pricing.
   - Videos: frontend/landing/assets/videothek/videos.json (Titel, Dauer, Datei, Poster); Untertitel
     aus "unterzeile" ohne Gedankenstrich umformuliert. MP4 liegen nicht im Git, sondern unter
     https://dealpilot.immo/medien/videothek/ (gemessen 19.11.2026: 206 video/mp4, 31 MB beim Spot). */
(function () {
  var L = '../../../frontend/landing/';
  window.A_DATEN = {
    L: L,
    medien: 'https://dealpilot.immo/medien/videothek/',
    poster: L + 'assets/videothek/',
    heroVideo: L + 'assets/video/dp-hero-flug.mp4',
    heroPoster: L + 'assets/bild/hero.jpg',
    cockpitVideo: L + 'assets/video/dp-intro-cockpit.mp4',
    app: 'https://app.dealpilot.immo/?register=1',

    score: {
      gesamt: 87, stufe: 'Sehr gut', kaufpreis: '180.000 €', kpis: '23/24', tiefe: '96 %',
      investment: { wert: 81, roh: 80.911, stufe: 'Gut', anteil: 59, gewicht: 59.25,
        frage: 'Wie gut ist die Immobilie, egal wie sie finanziert wird?',
        gruppen: [
          ['Objektrendite', 99, '32,5', '2/2', 'Bruttorendite, Nettorendite'],
          ['Risiko & Zustand', 88, '33,8', '5/6', 'Leerstand, Instandhaltung, Bausubstanz, Energieklasse, Mietausfall'],
          ['Lage & Markt', 60, '16,9', '5/5', 'Marktmiete, Mietwachstum, Bevölkerung, Nachfrage, Mikrolage'],
          ['Potenzial & Preis', 53, '16,9', '4/4', 'Mietsteigerung, Faktor gegen Markt, Wertsteigerung']
        ] },
      finanzierung: { wert: 96, roh: 96.344, stufe: 'Sehr gut', anteil: 41, gewicht: 40.75,
        frage: 'Trägt die geplante Finanzierung dieses Objekt?',
        gruppen: [
          ['Kapitaldienst & Beleihung', 96, '61,3', '5/5', 'DSCR, LTV, Zinssatz, Tilgung, EK-Bedarf'],
          ['Cashflow & EK-Rendite', 97, '38,7', '2/2', 'Cashflow im Monat, Cash-on-Cash']
        ] },
      bereiche: [
        ['Rendite', 35, 98, '4/4'], ['Finanzierung', 25, 96, '5/5'], ['Risiko', 20, 88, '5/6'],
        ['Lage & Markt', 10, 60, '5/5'], ['Potenzial', 10, 53, '4/4']
      ]
    },

    etappen: [
      ['01', 'Quick-Check', 'Erst prüfen, dann erfassen', 'Alle Exposés und Dateien auf einmal hineinziehen. In etwa einer halben Minute stehen Score, Rendite, Cashflow und ein klares Urteil gegen dein eigenes Ziel, mit dem Kaufpreis, ab dem es passt.', '00-quick-check.webp', 'ueberblick-1-quick-boarding'],
      ['02', 'Erfassen', 'Objekt erfassen', 'Exposé hineinziehen, frei erzählen, ein Inserat aus ImmoMetrica übernehmen oder Frage für Frage eingeben. Wie tief du gehst, wählst du selbst.', '01-objekt-erfassen.webp', 'modul-03-datenaufnahme-vier-wege'],
      ['03', 'Prüfen', 'Rendite und Investor Deal Score', 'Der Score fasst 24 Kennzahlen in fünf Bereichen zusammen. Getrennt nach Investment und Finanzierung steht am Ende eine Zahl von 0 bis 100 mit Stufe und Empfehlung.', '02-score.webp', 'modul-12-bewertung-und-kpis'],
      ['04', 'Prüfen', 'Unterlagen lesen', 'Mietaufstellung, Grundbuch, WEG-Protokolle und Energieausweis auf einmal. DealPilot schwärzt Personendaten und zeigt mit Fundstelle, was absehbar Geld kostet.', '03-unterlagen.webp', 'modul-28-unterlagen-einlesen'],
      ['05', 'Rechnen', 'Finanzierung und Cashflow', 'Den indikativen Zins gibt es täglich aktuell je Zinsbindung. Ob die Finanzierung trägt, prüft der DSCR, die Beleihung der LTV.', '04-finanzierung.webp', 'modul-08-finanzierung'],
      ['06', 'Rechnen', 'Steuer, AfA und Restnutzungsdauer', 'Kaufpreisaufteilung nach der Arbeitshilfe des Bundesfinanzministeriums, Restnutzungsdauer nach Anlage 2 ImmoWertV und der Steuerverlauf mit Wendepunkt.', '05-steuer.webp', 'modul-27-steuerverlauf-mit-wendepunkt'],
      ['07', 'Bewerten', 'Wertermittlung nach ImmoWertV', 'Lage, Bodenrichtwert und Vergleichspreise, begründet mit Liegenschaftszinssätzen und Sachwertfaktoren der Gutachterausschüsse. Fehlt eine amtliche Zahl, wird keine erfunden.', '06-wertermittlung.webp', null],
      ['08', 'Planen', 'Mieterhöhung und Zielbild', 'Wohnung für Wohnung: was der Vertrag hergibt, was nach Mietspiegel und Kappungsgrenze verlangbar ist und was erst nach Umbau geht.', '07-zielbild.webp', 'modul-26-mieterhoehung-und-zielbild'],
      ['09', 'Halten', 'Vom Ankauf in den Bestand', 'Gewonnen heißt eingefroren. Im Bestand vergleicht DealPilot Plan gegen heute, für die Bank entstehen Investment-PDF, Track-Record und Bankexport.', '08-bestand.webp', 'modul-14-ankauf-in-den-bestand']
    ],

    videos: [
      { id: 'spot-das-haus-hab-ich', nr: 'Spot', dauer: 91, titel: 'Das Haus hab ich.', satz: 'Vom Exposé bis zum Kauf. Ein Objekt, ein Weg, in 90 Sekunden.', datei: 'dealpilot-spot-das-haus-hab-ich-v3730.mp4', poster: 'dealpilot-spot-das-haus-hab-ich.webp' },
      { id: 'ueberblick-1-quick-boarding', nr: 'Ü1', dauer: 224, titel: 'Quick-Check', satz: 'Vom Exposé zum ersten Urteil in wenigen Minuten.', datei: 'dealpilot-ueberblick-1-quick-boarding-v3730.mp4', poster: 'dealpilot-ueberblick-1-quick-boarding.webp' },
      { id: 'ueberblick-2-objekt-bis-investment-pdf', nr: 'Ü2', dauer: 305, titel: 'Vom neuen Objekt zum Investment-PDF', satz: 'Der ganze Weg am Stück, in fünf Minuten.', datei: 'dealpilot-ueberblick-2-objekt-bis-investment-pdf-v3730.mp4', poster: 'dealpilot-ueberblick-2-objekt-bis-investment-pdf.webp' },
      { id: 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', nr: 'Ü3', dauer: 2637, titel: 'Komplettbeispiel Mehrfamilienhaus', satz: 'Ein Haus, zehn Kapitel, vom leeren Objekt bis zum PDF für die Bank.', datei: 'dealpilot-ueberblick-3-komplettbeispiel-mehrfamilienhaus-v3730.mp4', poster: 'dealpilot-ueberblick-3-komplettbeispiel-mehrfamilienhaus.webp' },
      { id: 'modul-12-bewertung-und-kpis', nr: '12', dauer: 262, titel: 'Bewertung und KPIs', satz: 'Das Gesamturteil, Investment und Finanzierung und jede Kennzahl dahinter.', datei: 'dealpilot-modul-12-bewertung-und-kpis.mp4', poster: 'dealpilot-modul-12-bewertung-und-kpis.webp' },
      { id: 'modul-28-unterlagen-einlesen', nr: '28', dauer: 307, titel: 'Alle Unterlagen reinladen', satz: 'Dreizehn PDFs, eine Übernahme. Jeder Wert mit Quelle.', datei: 'dealpilot-modul-28-alle-unterlagen-reinladen-v3730.mp4', poster: 'dealpilot-modul-28-alle-unterlagen-reinladen.webp' },
      { id: 'modul-08-finanzierung', nr: '08', dauer: 353, titel: 'Finanzierung', satz: 'Wie der Zins entsteht und wo du die Standardwerte setzt.', datei: 'dealpilot-modul-08-finanzierung-v3730.mp4', poster: 'dealpilot-modul-08-finanzierung.webp' },
      { id: 'modul-27-steuerverlauf-mit-wendepunkt', nr: '27', dauer: 436, titel: 'Steuerverlauf mit Wendepunkt', satz: 'Ab wann ein Objekt Steuern kostet. Keine Steuerberatung.', datei: 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.mp4', poster: 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt-v3502.webp' },
      { id: 'modul-26-mieterhoehung-und-zielbild', nr: '26', dauer: 746, titel: 'Mieterhöhung und Zielbild', satz: 'Wohnung für Wohnung, Ist, Soll und Zielbild bis zum Wertpotenzial.', datei: 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.mp4', poster: 'dealpilot-modul-26-mieterhoehung-und-zielbild-v3502.webp' },
      { id: 'modul-14-ankauf-in-den-bestand', nr: '14', dauer: 178, titel: 'Vom Ankauf in den Bestand', satz: 'Gewonnen, eingefroren, verglichen. Plan gegen heute.', datei: 'dealpilot-modul-14-ankauf-in-den-bestand-v3502.mp4', poster: 'dealpilot-modul-14-ankauf-in-den-bestand-v3502.webp' },
      { id: 'modul-19-das-bank-pdf', nr: '19', dauer: 254, titel: 'Das Bank-PDF', satz: 'Ein Investment Case, den die Bank nicht erst übersetzen muss.', datei: 'dealpilot-modul-19-das-bank-pdf-v3730.mp4', poster: 'dealpilot-modul-19-das-bank-pdf.webp' }
    ],

    zahlen: [
      [1100360, 'amtliche Datenpunkte in unseren Datenbanken'],
      [6187, 'Kennzahlen von 201 Gutachterausschüssen'],
      [18318, 'Sätze im Register der Gutachterausschüsse'],
      [36, 'amtliche Dienste und Tabellen angebunden'],
      [109, 'Veröffentlichungsseiten der Ausschüsse, automatisch geprüft'],
      [84, 'automatische Prüfwerkzeuge für Rechnung und Daten']
    ],
    quellen: [
      ['Bodenrichtwerte', 'Bodenrichtwert und Zone aus den amtlichen Diensten, für alle 16 Länder.', '10 Bodenrichtwert-Dienste', 'live je Bericht'],
      ['Gutachterausschüsse', 'Liegenschaftszinssätze, Sachwertfaktoren, Vergleichsfaktoren. Jeder Wert mit Ausschuss, Jahrgang und Fundstelle.', '6.187 Werte, 201 Ausschüsse', 'Jan. bis Juni wöchentlich'],
      ['Zensus 2022', 'Wohnungen, Gebäude, Leerstand und Mieten bis auf die Gemeinde.', '894.880 Werte, 11.186 Gebiete', 'Stichtag 15.05.2022'],
      ['Regionaldatenbank', 'Bevölkerung, Einkommen, Arbeitsmarkt und Wanderung je Kreis und Gemeinde.', '108.676 Werte, 6 Tabellen', 'monatlich abgeglichen'],
      ['Bautätigkeit und Bauland', 'Baugenehmigungen, Fertigstellungen und Kaufwerte für Bauland.', '56.128 Werte, 5 Tabellen', 'monatlich abgeglichen'],
      ['Obere Gutachterausschüsse', 'Bundesweite Preis- und Mietspannen zur Einordnung jedes Objekts.', '28.827 Werte', 'bundesweit']
    ],

    preise: [
      { name: 'Free', klasse: 'Economy', tag: 'Einstieg · Testflug', m: '0', j: null, notiz: '4 Wochen Pro, keine Kreditkarte', kontingent: '4 Wochen Pro, dann 1 / Monat', punkte: ['1 Objekt', '4 Wochen voller Pro-Umfang', 'Co-Pilot: 10 Fragen am Tag'], knopf: 'Kostenlos starten', pass: 'DP-01' },
      { name: 'Starter', klasse: 'Premium Economy', tag: 'Privat-Investor', m: '19,99', j: '219', kontingent: '5 Bewertungen / Monat', punkte: ['5 Objekte', 'Investment-PDF ohne Wasserzeichen', 'Co-Pilot: 20 Fragen am Tag'], knopf: 'Starter wählen', pass: 'DP-02' },
      { name: 'Investor', klasse: 'Business', tag: 'Aktiver Investor', m: '34,99', j: '384', kontingent: '10 Bewertungen / Monat', punkte: ['25 Objekte', 'Investor Deal Score (24 KPIs)', 'Track-Record-PDF, Bankexport'], knopf: 'Investor wählen', pass: 'DP-03', top: 'Bestseller' },
      { name: 'Pro', klasse: 'First', tag: 'Profi', m: '49,99', j: '549', kontingent: '15 Bewertungen / Monat', punkte: ['Unbegrenzte Objekte', 'Alle Investor-Funktionen', 'API-Zugang'], knopf: 'Pro wählen', pass: 'DP-04' }
    ],

    fragen: [
      ['Was kostet der Einstieg?', 'Nichts. Das Free-Paket ist dauerhaft kostenlos, und die ersten vier Wochen läuft jedes neue Konto mit dem vollen Pro-Umfang. Ohne Zahlungsdaten, ohne Kündigung. Danach wird daraus automatisch Free.'],
      ['Wie lange dauert es bis zur ersten belastbaren Zahl?', 'Eine Minute für den Quick-Check mit sechs Angaben. Zehn bis zwanzig Minuten für ein vollständig gerechnetes Objekt mit Finanzierung, Steuerwirkung und Deal Score. Wenige Minuten mehr für den Investment-Case als PDF für die Bank.'],
      ['Muss ich alles eintippen?', 'Nein. Exposé hochladen, das Objekt diktieren, Belege einlesen oder ein Inserat aus ImmoMetrica übernehmen. Die Wege lassen sich mischen, und alles Übernommene lässt sich von Hand nachbessern.'],
      ['Wie entsteht der Investor Deal Score?', 'Aus 24 Kennzahlen in fünf Bereichen: Rendite 35 %, Finanzierung 25 %, Risiko 20 %, Lage und Markt 10 %, Potenzial 10 %. Getrennt nach Investment und Finanzierung siehst du, welche Kennzahl ihn trägt und welche ihn drückt.'],
      ['Sind die Werte amtlich oder geschätzt?', 'Jede Zahl trägt ihre Herkunft mit Quelle, Jahrgang und Stichtag. Wo keine amtliche Zahl vorliegt, wird keine erfunden. Dann zeigt DealPilot den Weg zum zuständigen Gutachterausschuss.'],
      ['Kann ich monatlich kündigen?', 'Ja, alle Pakete sind monatlich kündbar. Beim Jahrestarif zahlst du zwölf Monate im Voraus und sparst rund 17 Prozent.']
    ]
  };
})();
