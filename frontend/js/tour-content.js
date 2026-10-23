// V251-03: Tour-Reihenfolge — DealScore + Investor Deal Score vor Bewertungs-Cockpit
/**
 * DealPilot V239 — Tour Steps (2 Varianten)
 *
 * window.DpTourVariants = {
 *   withObjects: [...]  // User hat schon Objekte
 *   empty: [...]        // User leer (Onboarding) - seit v2178 legt die Engine ein Demo-Objekt an
 *   (v2205a: keine Schrittzahlen mehr hier - sie stimmten nie: 24/20 statt 39/38)
 * }
 *
 * Engine entscheidet bei Tour.start() welche Variante geladen wird.
 */
(function() {
  'use strict';

  // ─── Variante A: User hat schon Objekte ─────────────────────
  
  var STEPS_WITH_OBJECTS = [
    
    // ═══ Phase 1: Sidebar Overview ════════════════════════════════════
    
    {
      tab: 'sidebar',
      selector: '.dpl-teil-objekte, #sb-list, .dpl-schiene, #sidebar',
      icon: 'i-portfolio',
      title: 'Willkommen bei DealPilot',
      body: 'Hier liegen **alle deine Objekte**. In der Ansicht „Heute“ in der Sidebar links — in der Aktenmappe klappst du dafür links die **Portfolio-Schiene** auf, auf dem Handy öffnet der Portfolio-Knopf das Menü. Von hier startet jede Analyse.',
      bodyMore: 'Was die Sidebar dir zeigt:\n\n• **Jedes Objekt als Card** mit Adresse, Kaufpreis, DealScore-Ampel\n• **Kennzahlen** im Mini-Format: DSCR, Cashflow, Bruttomietrendite\n• **Sortieren** nach zuletzt bearbeitet, Objekt-ID, Kaufdatum oder Lage (A/B/C); **filtern** nach Stand (Bestand/Ankauf) und Mandant\n• **Demo-Objekt** zum Ausprobieren\n\n**Limits nach Plan:**\n• **Free**: 1 Objekt\n• **Starter**: 5 Objekte\n• **Investor**: 25 Objekte\n• **Pro**: unbegrenzt\n\nKlick einfach auf ein Objekt, um es zu öffnen und in die Vollanalyse zu starten.',
      placement: 'right'
    },
    
    {
      tab: 'sidebar',
      selector: '.dpl-teil-objekte .sb-card, #sb-list .sb-card, .dpl-schiene .sb-card, .sb-card, #sb-list',
      icon: 'i-home',
      title: 'Objekt auswählen',
      body: '**Klick auf ein Objekt** in der Liste — sofort siehst du alle Details, Tabs und Kennzahlen. Ganz oben steht **„Neues Objekt hinzufügen"**: damit legst du ein leeres Objekt von Hand an.',
      bodyMore: 'Was passiert, wenn du ein Objekt anklickst:\n\n• **Alle 9 Reiter** werden mit den Objekt-Daten gefüllt\n• **DealScore** wird live berechnet\n• **Bewertungs-Cockpit** zeigt DSCR + LTV im Verlauf deines Betrachtungszeitraums (vorbelegt 15 Jahre)\n• **Änderungen** werden automatisch gespeichert\n\n**Tipp:** Du kannst zwischen Objekten jederzeit hin- und herwechseln — DealPilot speichert deinen Stand. Auch unfertige Bewertungen bleiben in der Sidebar.\n\nFür die Tour zeigen wir dir jetzt die wichtigsten Funktionen am Beispiel des aktuellen Objekts.',
      placement: 'right'
    },
    
    // ═══ Phase 2: Quick-Check (für NEUE Objekte) ═════════════════════
    
    {
      tab: 'sidebar',
      selector: '#sb-actions-accordion .sb-act-accent[onclick*="quickcheck"], #sb-actions-accordion button[onclick*="sbActionsAction(\'quickcheck\')"]',
      icon: 'i-flame',
      id: 'qb-intro',
      title: 'Neues Objekt? Quick-Boarding!',
      body: 'Der **goldene Quick-Boarding-Button** in der Sidebar startet das Quick-Boarding — die **Erstbewertung in rund einer Minute** für neue Objekte. Wie willst du weitermachen?',
      choices: [
        { label: 'Quick-Boarding Schritt für Schritt ansehen', goto: 'qb-score' },
        { label: 'Überspringen — weiter zur PRE-FLIGHT-Karte', goto: 'preflight' }
      ],
      bodyMore: 'Wann du den Quick-Check nutzt:\n\n• **Inseraten-Sichten** auf Immo-Plattformen\n• **Mailings vom Makler** schnell einschätzen\n• **Erste Sondierung**, ob ein Objekt tiefer prüfenswert ist\n\n**Was du brauchst:**\nAdresse (Straße, PLZ, Ort), Wohnfläche, Kaufpreis, Nettokaltmiete, Hausgeld samt nicht umlagefähigem Anteil, Eigenkapital, Zins und Tilgung. Zins, Tilgung und Hausgeld schlägt DealPilot aus deinen Standardwerten vor.\n\n**Was du sofort bekommst:**\n• DealScore mit Stufe\n• Sieben Kennzahlen (u. a. Bruttomietrendite, Cashflow, DSCR, LTV)\n• Zielkaufpreis und Verhandlungs-Empfehlung\n\nVielversprechende Objekte übernimmst du dann mit einem Klick in die Vollanalyse — alle Daten werden automatisch in die Reiter übertragen.',
      placement: 'right'
    },
    
    {
      tab: 's-quick',
      selector: '#qc-tab-host, #s-quick',
      icon: 'i-flame',
      id: 'qb-score',
      subTargets: ['Quick Boarding'],
      subClimb: 150,
      title: 'Quick-Boarding Score',
      body: 'Sobald alle Pflichtfelder gefüllt sind, zeigt ein **Score-Ring** die Bewertung — jede weitere Änderung rechnet sofort neu. Bis dahin steht dort, wie viele Pflichtfelder noch offen sind.',
      bodyMore: 'Was im Score-Bereich passiert:\n\n• **Score-Ring** mit Wert 0–100 und Stufe\n• **7 Kennzahlen** mit Zielwert: Bruttomietrendite, Nettomietrendite, EK-Rendite, Cashflow, DSCR, LTV, Bewirtschaftung\n• **Stufen**: ab 85 Sehr gut, ab 70 Gut, ab 50 Solide, ab 35 Schwach, darunter Kritisch\n\nDie Berechnung passiert, ohne dass du speichern musst.\n\n**Tipp:** Spiel mit Kaufpreis, Miete und Eigenkapital — du siehst sofort, wie sich die Bewertung ändert. Perfekt für die Verhandlungs-Vorbereitung.',
      placement: 'auto'
    },
    
    
    {
      id: 'qb-pass',
      tab: 's-quick',
      selector: '#qc-tab-host, #s-quick',
      subTargets: ['Quickboarding Pass'],
      subClimb: 90,
      placementHintV866: 1,
      icon: 'i-qr',
      title: 'Boarding-Pass — direkt beim Quick-Boarding',
      body: 'Im Quick-Boarding entsteht nebenbei der **Quickboarding-Pass** — dein teilbarer Kurz-Steckbrief mit QR-Code. Du erkennst ihn am **dunklen Streifen** mit dem Code; je nach Ansicht sitzt er seitlich oder unten.',
      bodyMore: 'Was der Boarding-Pass ist:\n\n• Eine **öffentliche Kurz-Ansicht** deines Objekts: Adresse, Eckdaten, Score — hübsch aufbereitet wie eine echte Bordkarte\n• Erreichbar über **Link oder QR-Code** — ideal für Partner, Mitinvestoren oder die Bank\n• **Zeitlich begrenzt gültig** und jederzeit widerrufbar — du behältst die Kontrolle\n\n**So entsteht er:**\n• Während du das Quick-Boarding befüllst, baut sich der Pass im **dunklen Streifen** automatisch mit auf\n• Beim **Speichern als Objekt** kannst du ihn direkt **mit übernehmen** — inklusive Link + QR-Code\n• Später erstellst/teilst du ihn jederzeit neu über „Quick Boarding teilen“ beim Objekt\n• Der QR-Code erscheint dann auch im **Deal-Aktion-Tab** direkt neben dem Deal-Status',
      placement: 'auto'
    },

    {
      id: 'qb-save',
      tab: 's-quick',
      selector: '#qc-tab-host, #s-quick',
      subSelectors: ['#save-btn'],
      subTargets: ['Als Objekt speichern', 'speichern'],
      icon: 'i-piggy-bank',
      title: 'Als Objekt speichern',
      body: 'Vielversprechend? Der Knopf **„Als Objekt speichern“** am Ende des Quick-Boardings übernimmt alle Daten in die Vollanalyse — scroll im Panel nach unten, falls du ihn nicht siehst.',
      bodyMore: 'Was beim Speichern passiert:\n\n• Alle Quick-Check-Daten landen in **Objekt, Investition, Miete und Finanzierung**\n• Wohnfläche, Adresse, Baujahr werden vorbefüllt — kein doppeltes Tippen\n• Das Objekt erscheint dauerhaft in deiner **Sidebar links**\n• Du landest direkt in der Vollanalyse\n\nJetzt zeigen wir dir die Reiter einzeln — das ist die eigentliche Bewertungs-Tiefe.',
      placement: 'center'   /* v1744 · der Knopf liegt am Ende eines scrollbaren Panels; ohne Treffer wurde der Schritt still uebersprungen */
    },

    // ═══ Phase 2b: PRE-FLIGHT-Karte (v865) ═════════════════════

    {
      id: 'preflight',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      icon: 'i-rocket',
      title: 'PRE-FLIGHT — dein Daten-Cockpit',
      body: 'Die **PRE-FLIGHT-Karte** oben im Objekt-Tab bringt Daten in Sekunden ins Objekt: Import, Sprache, geführte Eingabe, Schnittstelle, Marktbewertung.',
      bodyMore: 'Fünf Wege, wie deine Daten ins Objekt kommen:\n\n• **Dokument-Import** — Exposés und Marktberichte hochladen, DealPilot liest die Felder aus\n• **Sprachaufzeichnung** — Objekt einfach einsprechen\n• **Geführte Eingabe** — DealPilot fragt der Reihe nach, du tippst oder sprichst\n• **ImmoMetrica-Import** — Objekte direkt aus deinem ImmoMetrica-Konto ziehen\n• **Marktbewertung** — professionelle Marktwert- und Mietpreis-Einschätzung abrufen\n\nDie nächsten Schritte zeigen dir jeden Weg einzeln.',
      placement: 'auto'
    },

    {
      id: 'pf-import',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['Exposé / Marktbericht'],   /* v1743 · war nur 'Exposé' — im Tower gewinnt damit 'Exposé / Gesamt-PDF' aus der Ausgaben-Schiene, weil _findByText den KUERZESTEN Treffer nimmt (19 statt 21 Zeichen) */
      icon: 'i-file-text',
      title: 'Import aus Exposés & Marktberichten',
      body: '**PDFs oder Dokumente hochladen** — DealPilot liest die wichtigsten Felder automatisch aus.',
      bodyMore: 'So funktioniert der Dokument-Import:\n\n• Exposé, Marktbericht oder andere Objekt-Dokumente **hochladen** (PDF und mehr)\n• DealPilot **erkennt die wichtigsten Felder**: Adresse, Wohnfläche, Kaufpreis, Baujahr, Miete u.v.m.\n• Du bekommst die erkannten Werte **zur Auswahl angezeigt** — du entscheidest, was übernommen wird\n• Ein Klick, und die Felder sind gefüllt — kein Abtippen\n\n**Tipp:** Je vollständiger das Exposé, desto mehr Felder werden erkannt. Nachjustieren kannst du jederzeit in den Tabs.',
      placement: 'auto'
    },

    {
      id: 'pf-voice',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['Sprache'],
      icon: 'i-mic',
      title: 'Sprachaufzeichnung',
      body: 'Objekt **einfach einsprechen** — mit allen wichtigen Informationen. DealPilot übernimmt den Rest.',
      bodyMore: 'So nutzt du die Sprachaufzeichnung:\n\n• **Aufnahme starten** und das Objekt beschreiben: Adresse, Grösse, Preis, Miete, Zustand, Besonderheiten\n• DealPilot **erkennt die Angaben** und ordnet sie den richtigen Feldern zu\n• Perfekt **unterwegs nach der Besichtigung** oder beim Telefonat mit dem Makler\n\n**Tipp:** Sprich Zahlen klar aus („Kaufpreis zweihundertfünfzigtausend Euro“) — dann sitzt die Zuordnung am besten.',
      placement: 'auto'
    },

    /* v1742 · Eigener Schritt für die geführte Eingabe. Sie stand bis
       hierher nur HINTER dem Knopf „Sprache" — wer die Tour sah, erfuhr
       nie, dass es einen Weg ohne Formular und ohne Mikrofon gibt. */
    {
      id: 'pf-gefuehrt',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['Geführte Eingabe'],
      icon: 'i-list',
      title: 'Geführte Eingabe',
      body: 'Kein Formular, kein Mikrofon: DealPilot **fragt der Reihe nach** — Preis, Miete, Fläche, Adresse und den Rest. Antworten kannst du **tippen oder sprechen**.',
      bodyMore: 'Wann dieser Weg der richtige ist:\n\n• Du willst **nichts vergessen** — gefragt wird jedes Feld, das für die Rechnung zählt\n• Du sitzt im **Büro oder Zug** und möchtest nicht sprechen\n• Das Objekt ist **neu** und es gibt noch kein Exposé\n\n**Wie es läuft:**\n• Eine Frage nach der anderen, mit kurzer Erklärung, wozu die Zahl dient\n• **Weiss ich nicht** überspringt eine Frage — nichts wird erfunden\n• **Fertig** springt jederzeit zur Übernahme-Tabelle\n• Unterwegs rechnet DealPilot schon mit und zeigt, wohin es läuft\n\n**Kombinierbar:** erst ein Exposé einlesen, dann die Lücken per geführter Eingabe schliessen — was bereits gefüllt ist, wird nicht noch einmal gefragt.',
      placement: 'auto'
    },

    {
      id: 'pf-immo',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['ImmoMetrica'],
      icon: 'i-import',
      title: 'ImmoMetrica-Import',
      body: 'Mit hinterlegtem **API-Key** ziehst du Objekte **direkt aus ImmoMetrica** nach DealPilot.',
      bodyMore: 'So richtest du die ImmoMetrica-Anbindung ein:\n\n• API-Key in den **Einstellungen unter „Account & Sicherheit“** hinterlegen (sicher verschlüsselt gespeichert)\n• Danach in der PRE-FLIGHT-Karte den **ImmoMetrica-Import** starten\n• Objekt auswählen — Stammdaten, Flächen und Preise werden **automatisch übernommen**\n\nIdeal, wenn du in ImmoMetrica recherchierst und in DealPilot rechnest — kein doppeltes Erfassen.',
      placement: 'auto'
    },

    {
      id: 'pf-avm',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['DealPilot', 'Abrufen'],   /* v2205a: Anbieternamen raus (Neutralitaet) */
      icon: 'i-chart',
      title: 'Marktbewertung — Wert & Miete mit Spanne',
      body: 'Hol dir eine professionelle **Marktwert-** und **Mietpreis-Einschätzung** — jeweils mit **oberer und unterer Spanne**.',
      bodyMore: 'Was die Marktbewertung liefert:\n\n• **Marktpreis-Indikation** für dein Objekt — mit Ober- und Untergrenze statt einer Schein-Genauigkeit\n• **Mietpreis-Einschätzung** — ebenfalls als Spanne\n• Basierend auf professionellen Bewertungsdaten und der genauen Adresse\n\n**Wofür du das nutzt:**\n• Kaufpreis **plausibilisieren** — liegt das Angebot in der Spanne?\n• **Verhandlungsargumente** — mit Daten statt Bauchgefühl\n• Miete nach Modernisierung **realistisch ansetzen**\n\nDie Einschätzung fliesst direkt in deine Bewertung ein. Ein Abruf verbraucht eine Bewertung aus deinem Kontingent.',
      placement: 'auto'
    },

    {
      id: 'pass-obj',
      tab: 's0',
      selector: '#obj-action-bar, .tab[data-target-sec="s0"]',
      /* v1747e · der QR selbst, nicht das Wort PASS irgendwo im Dokument */
      subSelectors: ['#oab-pf-qr', '.dp-pf-qr'],
      icon: 'i-qr',
      title: 'Boarding-Pass zum Objekt',
      body: 'Auch hier im **Tab Objekt** erstellst du jederzeit einen **Boarding-Pass** — und teilst ihn per Link oder QR-Code.',
      bodyMore: 'Der Boarding-Pass im Überblick:\n\n• **Was drin ist:** Adresse, Objektart, Eckdaten (Kaufpreis, Fläche, Miete), Score — als hübsche Bordkarte aufbereitet\n• **Erstellen:** über „Quick Boarding teilen“ beim Objekt — DealPilot erzeugt Link + QR-Code\n• **Teilen:** Link verschicken oder QR zeigen — der Empfänger braucht **keinen Account**\n• **Kontrolle:** zeitlich begrenzt gültig, jederzeit widerrufbar\n• Der QR-Code erscheint zusätzlich im **Deal-Aktion-Tab** direkt neben dem Deal-Status\n\nPerfekt für Mitinvestoren, Partner oder das Bankgespräch.',
      placement: 'auto'
    },

    // ═══ Phase 3: 9 Reiter einzeln ══════════════════════════════════════
    
    {
      tab: 's0',
      selector: '.tab[data-target-sec="s0"]',
      icon: 'i-home',
      title: 'Tab 1: Objekt',
      body: 'Hier trägst du die **Stammdaten** ein: Adresse, Wohnfläche, Baujahr, Etage, Zimmer, Fotos.',
      bodyMore: '**Wichtigste Felder:**\n\n• **Straße + PLZ + Ort** — für Lage, Bodenrichtwert und Marktbewertung\n• **Wohnfläche** — Basis für Euro/m²-Vergleiche\n• **Baujahr** — wichtig für Restnutzungsdauer und Bewertung (den AfA-Satz wählst du im Reiter Steuer)\n• **Etage / Zimmer / Balkon / Keller** — Wertfaktoren\n• **Fotos** — je nach Plan 3 bis 30 pro Objekt; bis zu 6 erscheinen im Investment-PDF\n\nFehlende Pflichtfelder sind **rot umrandet**. Tipp: Adresse so genau wie möglich — davon hängen Bodenrichtwert und Lage ab.',
      placement: 'auto'
    },
    
    {
      tab: 's1',
      selector: '.tab[data-target-sec="s1"]',
      icon: 'i-coins',
      title: 'Tab 2: Investition',
      body: 'Hier definierst du **Kaufpreis + Nebenkosten** — die echten Anschaffungskosten.',
      bodyMore: '**Was hier rein gehört:**\n\n• **Kaufpreis** — wie verhandelt (Pflichtfeld)\n• **Grunderwerbsteuer** — automatisch nach Bundesland (3,5–6,5 %)\n• **Notar** (vorbelegt 2,2 %) und **Grundbuchamt** (vorbelegt 0,5 %)\n• **Maklerprovision** — wenn vorhanden\n• **Sanierungskosten** — geplante Modernisierungen\n\nDealPilot rechnet daraus die **Gesamtinvestition**. Die Aufteilung Boden/Gebäude (BMF-Rechner), den AfA-Satz und die Sonder-AfA § 7b stellst du im Reiter **Steuer** ein.',
      placement: 'auto'
    },
    
    {
      tab: 's2',
      selector: '.tab[data-target-sec="s2"]',
      icon: 'i-euro',
      title: 'Tab 3: Miete',
      body: 'Hier trägst du die **Einnahmen-Seite** ein: Nettokaltmiete und Zusatzerträge.',
      bodyMore: '**Was hier rein gehört:**\n\n• **Nettokaltmiete / Monat** (Pflichtfeld)\n• **Mietsteigerung p.a.** — Default 1,5%\n• **Leerstand** — Vorgabe 2 % (aus deinen Standardwerten)\n• **Hausgeld umlagefähig** — Anteil den Mieter zahlt\n• **Zusatzerträge** — Garage, Stellplatz, möblierte Vermietung\n\n**Wichtig:** Hier IMMER **Netto-Kalt-Miete** — ohne Heizkosten, ohne Nebenkosten.',
      placement: 'auto'
    },
    
    {
      tab: 's3',
      selector: '.tab[data-target-sec="s3"]',
      icon: 'i-bank',
      title: 'Tab 4: Finanzierung',
      body: 'Hier baust du **dein Darlehen** — auch komplexe Setups mit mehreren Darlehen + BSV.',
      bodyMore: '**Was DealPilot kann:**\n\n• **Hauptdarlehen** mit frei wählbarer Zinsbindung (vorbelegt 10 Jahre)\n• **Darlehen II** als Annuitäten- oder **KfW-Darlehen**\n• **Bausparvertrag (BSV)** als Tilgungsersatz\n• **Tilgung** frei wählbar\n• **Eigene Anschlussfinanzierung** mit Anschlusszins (vorbelegt 5,0 %)\n• Im **Tilgungsplan** lassen sich einzelne Werte überschreiben, etwa für Sondertilgungen\n\nDie DSCR-Berechnung berücksichtigt automatisch alle aktiven Darlehen — auch die BSV-Raten.',
      placement: 'auto'
    },
    
    {
      tab: 's4',
      selector: '.tab[data-target-sec="s4"]',
      icon: 'i-settings',
      title: 'Tab 5: Bewirtschaftung',
      body: 'Hier definierst du **die laufenden Kosten** als Eigentümer — Hausgeld, Instandhaltung, Verwaltung.',
      bodyMore: '**Was hier rein gehört:**\n\n• **Hausgeld (nicht umlagefähig)** — Verwaltung + Rücklagen\n• **Eigene Instandhaltungsrücklage** — DealPilot schlägt je Objektart einen Wert in €/m² vor (ImmoWertV Anlage 3)\n• **Mietausfallwagnis** — vorbelegt 1 % (Einstellungen → Standardwerte)\n• **Sonderverwaltung** — falls eine Hausverwaltung extra kostet\n• **Weitere Kosten** — zwei freie Kostenpositionen, z. B. Versicherung\n\n**Wichtig:** Diese Kosten reduzieren deinen Cashflow direkt — lieber vorsichtig schätzen.',
      placement: 'auto'
    },

    /* v2205 · N63.8: der Reiter Steuer fehlte in der Tour - sie sprang von
       „Tab 5: Bewirtschaftung" zu „Tab 6: Pilot-Analyse", obwohl Steuer der
       sechste Reiter ist (data-target-sec="s3-tax"). */
    {
      tab: 's3-tax',
      selector: '.tab[data-target-sec="s3-tax"]',
      icon: 'i-receipt',
      title: 'Tab 6: Steuer',
      body: 'Hier rechnest du **die Steuerwirkung** deines Objekts: Grenzsteuersatz, AfA und Werbungskosten — Jahr für Jahr.',
      bodyMore: '**Was du hier findest:**\n\n• **Grenzsteuersatz** — aus deinem zu versteuernden Einkommen\n• **AfA** — Gebäudeanteil (vorbelegt 80 %), 2 %, vor 1925 2,5 %, ab 2023 fertiggestellt 3 %, dazu § 7b\n• **BMF-Rechner** — Kaufpreis in Boden und Gebäude aufteilen\n• **Werbungskosten je Jahr** — mit „Werte aus dem Vorjahr übernehmen“ für wiederkehrende Posten\n• **Finanzamt-PDF** — auf Wunsch mit Anlage V\n\nDealPilot ist eine Rechenhilfe und ersetzt keine Steuerberatung.',
      placement: 'auto'
    },
    
    {
      tab: 's5',
      selector: '.tab[data-target-sec="s5"]',
      icon: 'i-pin',
      title: 'Tab 7: Pilot-Analyse',
      body: 'Der **Pilot bewertet dein Objekt in Worten** — auf Grundlage aller Eingaben, mit Recherche zu Makro- und Mikrolage.',
      bodyMore: '**Was die Pilot-Analyse liefert:**\n\n• **Gesamtbewertung** mit Empfehlung Kaufen, Prüfen oder Nicht kaufen\n• **Stärken und Risiken**\n• **Makro- und Mikrolage** aus der Recherche\n• **Verhandlungsempfehlung** mit Zielpreis\n• **Bankargumente** und ein Fazit\n\nDie Pilot-Analyse ist in deinem Plan enthalten und verbraucht kein Kontingent.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '.tab[data-target-sec="s6"]',
      icon: 'i-gauge',
      title: 'Tab 8: Bewertung',
      body: 'Der **wichtigste Tab** für Banker: DSCR, LTV, Wertpuffer, DealScore, Stress-Test — alles in einem Cockpit.',
      bodyMore: '**Die Kernbestandteile:**\n\n• **Bewertungs-Cockpit** mit DSCR + LTV im Verlauf deines Betrachtungszeitraums (vorbelegt 15 Jahre)\n• **DealScore 0–100** als Gesamtbewertung\n• **Investor Deal Score** mit 24 KPIs (Investor und Pro, im Free-Plan als Demo)\n• **Stress-Test** als 5×5-Matrix aus Zins und Miete\n• **Cashflow-Projektion** über deinen Betrachtungszeitraum\n\nHier verbringst du beim Endcheck die meiste Zeit. Alle Zahlen synchronisieren live mit den anderen Reitern.',
      placement: 'auto'
    },
    
    // ═══ Phase 4: Bewertungs-Cockpit-Details ══════════════════════════
    
    {
      tab: 's6',
      selector: '#dealscore-card, [id^="dpsh"], #s6',
      focusText: 'DealPilot Score',
      focusMinH: 380,
      placement: 'bottom',
      icon: 'i-percent',
      title: 'DealScore 0-100',
      body: 'Der **DealPilot Score** bündelt die Bewertung in **5 Hauptfaktoren** zu einer Zahl von 0-100 — dein schnellster Vergleichswert.',
      bodyMore: 'Die 5 Faktoren des DealPilot Scores:\n\n• **Cashflow** (30 %)\n• **Rendite** — Nettomietrendite (25 %)\n• **Beleihung** — LTV (15 %)\n• **Risiko** — DSCR (15 %)\n• **Potenzial** — Wertpuffer und Mietsteigerung (15 %)\n\n**Skala:**\n• **ab 85** Sehr gut\n• **ab 70** Gut\n• **ab 50** Solide\n• **ab 35** Schwach\n• **darunter** Kritisch\n\nDie Gewichte kannst du in den Einstellungen unter Deal Score anpassen.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '#dealscore2-card, .ds2-card, [id^="dpsh"], #s6',
      focusText: 'Investor Deal Score',
      focusMinH: 380,
      placement: 'bottom',
      icon: 'i-cpu',
      title: 'Investor Deal Score',
      body: 'Der **Investor Deal Score** ist die erweiterte Bewertung mit **24 KPIs in 5 Kategorien** — deutlich tiefer als die 5 Faktoren des Basis-Scores — im **Investor- und Pro-Plan**.',
      bodyMore: '**Die 5 Kategorien:** Rendite, Finanzierung, Risiko, Lage, Upside\n\n**Was er zusätzlich prüft:**\n• Cash-on-Cash, DSCR, LTV, Zins\n• Leerstand, Instandhaltung, Baujahr, Energie\n• Marktmiete gegen Ist-Miete, Bevölkerung, Mikrolage\n• Mietsteigerung, Kaufpreisfaktor, Wertsteigerung\n\n**Wo finden:**\n• Im Reiter Bewertung als eigene Cockpit-Karte\n• Im Kopf oben rechts: Umschalter „Investor Deal Score“\n\n**Plan-Verfügbarkeit:**\n• **Free**: als Demo\n• **Starter**: nicht enthalten\n• **Investor & Pro**: voll, mit eigenen Gewichtungen und Bewertungsprofilen in den Einstellungen',
      placement: 'center'
    },
    
    {
      tab: 's6',
      selector: '#bc-cockpit',
      /* v1789 · Derselbe Notnagel wie beim Stress-Test, derselbe Befund:
         hier stand `subTargets: ['Cockpit']`, weil "#bc-cockpit im Tab
         0x0" sei. Gemessen am 02.10.2026: 1280 x 628 px, 1 Kind, Inhalt
         "Bank-Cockpit · Risiko-Kennzahlen". Auch dieser Ersatz ist weg. */
      icon: 'i-gauge',
      title: 'Bewertungs-Cockpit',
      body: '**DSCR & LTV im Verlauf** deines Betrachtungszeitraums — was die Bank zuerst sieht.',
      bodyMore: '**DSCR (Schuldendienstdeckung):**\n• ab 1,5 = sehr solide\n• 1,2–1,5 = solide\n• 1,0–1,2 = knapp\n• 0,8–1,0 = kritisch\n• unter 0,8 = Stress\n\n**LTV (Beleihungsauslauf):**\n• bis 60 % = sehr sicher\n• unter 85 % = solide\n• 85–100 % = erhöht\n• über 100 % = kritisch\n\n**Wertpuffer:** Differenz Verkehrswert zu Kaufpreis. Je größer, desto mehr Sicherheit.',
      placement: 'auto'   /* v1789 · war 'center' - das galt dem angeblich leeren Ziel. Die Karte ist da und wird gerahmt, also sitzt die Blase wieder daneben. */
    },
    
    {
      tab: 's6',
      selector: '#bc-stress',
      /* v1789 · HIER STAND `subTargets: ['Stress']` MIT DER BEGRUENDUNG
         "#bc-stress ist ein voellig leerer div (0 Kinder)". GEMESSEN am
         02.10.2026 auf Staging stimmt das nicht mehr:

           #bc-stress   1280 x 883 px, 1 Kind (.bc-card)
                        > .bc-head  "Stress-Test · DSCR-Resilienz"
                        > .bc-body  746 px Szenarien-Matrix

         Der Notnagel traf damit per _findByText den KUERZESTEN Knoten mit
         dem Wort - ein Chip von 29 x 16 px irgendwo im Formular. Und weil
         _applySubHl 420 ms NACH dem Spot laeuft und auf sein Unterziel
         scrollt, wanderte das Bild unter dem fertig gesetzten Rahmen weg.
         GENAU DAS war Schritt 24, vier Anlaeufe lang.

         > Zweimal habe ich das Scrollen repariert (v1782, v1782b) und
         > beide Male zurueckgenommen. Repariert gehoerte nicht das
         > Scrollen, sondern der Grund, warum ueberhaupt ein zweites Mal
         > gescrollt wurde: ein Ersatzziel fuer ein Ziel, das es laengst
         > wieder gibt. Ein Notnagel, den niemand nachmisst, ueberlebt den
         > Defekt, gegen den er gebaut wurde - und wird selbst zu einem.

         Ohne subTargets laeuft _applySubHl gar nicht erst an. Der Spot
         bleibt, wo _scrollIntoView ihn gesetzt hat, und die Karte passt
         mit 883 px in den sichtbaren Bereich (gemessen 988 px). */
      icon: 'i-cpu',
      title: 'Stress-Test',
      body: 'Was passiert wenn **Zinsen steigen** oder **Miete ausfällt**? Der Stress-Test simuliert es.',
      bodyMore: 'Eine **5×5-Matrix**: Zinsänderung (−2 bis +5 Prozentpunkte) gegen Mietänderung (−20 % bis +20 %). Jede Zelle zeigt den **DSCR** in diesem Szenario:\n\n• **grün** ab 1,2\n• **hellgrün** 1,0–1,2\n• **gold** 0,8–1,0\n• **rot** darunter\n\nDie Zelle ±0/±0 ist dein Base-Case. Hält der DSCR auch bei −10 % Miete und +1 Prozentpunkt Zins mindestens 1,0, bist du bank-tauglich.',
      placement: 'auto'   /* v1789 · war 'center' - das galt dem angeblich leeren Ziel. Die Karte ist da und wird gerahmt, also sitzt die Blase wieder daneben. */
    },

    // ═══ Phase 5: Deal-Aktion ═════════════════════════════════════════
    
    {
      tab: 's8',
      selector: '.tab[data-target-sec="s8"]',
      icon: 'i-flag',
      id: 'da-intro',
      title: 'Tab 9: Deal-Aktion — dein Boarding-Cockpit',
      body: 'Hier führst du den Deal zum **Abschluss**: Bank-Readiness, Deal-Status, Exporte, Überführung und dein Partnernetzwerk.',
      bodyMore: 'Der Deal-Aktion-Tab ist als **Boarding-Cockpit** aufgebaut:\n\n• **Bereit für die Bank?** — Readiness-Ring + Startbahn zeigen, wie vollständig deine Grundfelder sind\n• **Bereit zum Abflug** — Deal-Status setzen: Offen, Gewonnen, Verloren (mit Boarding-Pass-QR daneben)\n• **Dokumente & Exporte** — Investment-PDF, Finanzamt-PDF, Track Record\n• **In Gesellschaft überführen** — Privat-Objekt in GmbH/UG umziehen\n• **Dein Netzwerk** — geprüften Partnern eine Anfrage schicken, Objektdaten gehen mit\n\nDie nächsten Schritte gehen alles einzeln durch.',
      placement: 'auto'
    },
    
    {
      id: 'da-ready',
      tab: 's8',
      selector: '#s8 .dab-chips, #s8 .dab-body, #s8',
      icon: 'i-check',
      title: 'Bereit für die Bank?',
      body: 'Der **Readiness-Ring** und die **Startbahn** zeigen, wie vollständig deine Grundfelder sind — die **Chips** führen dich direkt zu fehlenden Feldern.',
      bodyMore: 'So liest du den Vorflug-Check:\n\n• **Ring + Prozentwert** — dein Readiness-Stand für das Bankgespräch\n• **Startbahn-Segmente** — jedes grüne Segment = ein befülltes Grundfeld\n• **Fehlt-Chips** — klick auf einen Chip und DealPilot springt **direkt zum fehlenden Feld** (mit Gold-Blitz)\n\n**Wichtig:** Nur die **Grundfelder** zählen in diese Bewertung. Weitere Angaben (Ausstattung, Historie, Fotos) sind hilfreich, fliessen hier aber nicht ein.\n\nZiel vor der Bankanfrage: **100 %** — dann sind auch die Partner-Anfragen im Netzwerk freigeschaltet, die einen vollständigen Check voraussetzen.',
      placement: 'auto'
    },

    {
      id: 'da-status',
      tab: 's8',
      selector: '#s8 .dab-status-grid, #s8',
      icon: 'i-flag',
      title: 'Bereit zum Abflug — Deal-Status',
      body: 'Markiere den Deal als **Offen (Boarding)**, **Gewonnen (Abgeflogen)** oder **Verloren (Gestrichen)** — rechts daneben dein Boarding-Pass-QR.',
      bodyMore: 'Die Departure-Tafel:\n\n• **Offen · Boarding** — Deal in Prüfung (Standard)\n• **Gewonnen · Abgeflogen** — Zuschlag erhalten, Objekt zählt zum Bestand: Portfolio, Cashflow und Steuer rechnen ab jetzt mit\n• **Verloren · Gestrichen** — Deal nicht zustande gekommen; auch das festhalten lohnt sich für deinen Track Record\n\n**Rechts daneben:** Sobald das Objekt geteilt ist, erscheint hier der **Boarding-Pass mit QR-Code** — direkt griffbereit fürs Gespräch.',
      placement: 'auto'
    },

    {
      id: 'da-exports',
      tab: 's8',
      selector: '#s8 .dab-doc-row, #s8',
      focusText: 'Dokumente & Exporte',
      focusMinH: 340,
      ensureVisibleText: 'Finanzamt-PDF',
      expanderText: 'PDFs herunterladen',
      icon: 'i-file-text',
      title: 'Dokumente & Exporte',
      body: 'Hier erzeugst du das **Investment-PDF**, das **Finanzamt-PDF** (mit Steuerjahr-Auswahl) und deinen **Track Record**.',
      bodyMore: 'Die drei Exporte im Überblick:\n\n• **Investment-PDF** — der bank-fertige Business-Case: Eckdaten, Cashflow, DSCR/LTV, Stress-Test, Lagebewertung\n• **Finanzamt-PDF** — die Werbungskosten-Aufstellung als Steuerformular; **Steuerjahr per Dropdown** wählbar (oder Gesamt-Übersicht)\n• **Track Record** — deine Performance-Historie als Nachweis für Banken und Partner\n\nAlle Exporte nutzen immer den **aktuellen Datenstand** — vorher kurz die Pflichtfelder checken.',
      placement: 'auto'
    },

    {
      id: 'da-uew',
      tab: 's8',
      selector: '#dab-uew-slot, #dpuew-stage, #s8',
      icon: 'i-import',
      title: 'In Gesellschaft überführen',
      body: 'Objekt privat gekauft, später in die **GmbH/UG**? Der Überführungs-Assistent erledigt den Umzug.',
      bodyMore: 'So funktioniert die Überführung:\n\n• Das **Privat-Objekt wird eingefroren** (bleibt als Historie erhalten)\n• Ein **neues Gesellschafts-Objekt** wird angelegt — Werte, Fotos und KI-Analysen werden übernommen\n• Steuerlich rechnet das neue Objekt mit dem **Steuerregime der Gesellschaft** (Körperschaftsteuer statt ESt)\n\n**Zwei Wege dorthin:**\n• Hier im Deal-Aktion-Tab: „Überführung starten“\n• Oder in den **Einstellungen unter Mandanten** — dort mit Objekt-Auswahl\n\nMandanten/Gesellschaften sind Teil des Pro-Plans.',
      placement: 'auto'
    },

    {
      id: 'da-network',
      tab: 's8',
      selector: '#dab-rails-host, #s8',
      icon: 'i-users',
      title: 'Dein Partnernetzwerk',
      body: 'Geprüfte **Finanzierer, Gutachter & Partner** — Anfrage mit einem Klick, deine **Objektdaten gehen mit**. Netzwerk im Detail ansehen?',
      choices: [
        { label: 'Ja — Partnernetzwerk im Detail', goto: 'net-card' },
        { label: 'Überspringen — zum Abschluss', goto: 'finish' }
      ],
      bodyMore: 'Das Netzwerk im Deal-Aktion-Tab:\n\n• Partner sind als **Boarding-Pass-Karten** in Kategorien-Reihen organisiert (z.B. Finanzierung & Banken, Gutachter)\n• Jede Karte zeigt Rolle, Stärken, Antwortzeit und Webseite\n• Eine **Anfrage** schickt deine Objekt-Eckdaten strukturiert mit — kein Zusammensuchen von Unterlagen',
      placement: 'auto'
    },

    {
      id: 'net-card',
      tab: 's8',
      selector: '#dab-rails-host, #s8',
      icon: 'i-users',
      title: 'Partnerkarten & Kategorien',
      body: 'Jede Reihe ist eine **Kategorie** (z.B. Finanzierung & Banken, Gutachter) — jede Karte ein **geprüfter Partner** im Bordkarten-Look.',
      bodyMore: 'So liest du eine Partnerkarte:\n\n• **Name + Rolle** und das „Geprüft“-Siegel\n• **Tags** — die Stärken auf einen Blick (z.B. „450 Banken“, „ungebunden“)\n• **Antwortzeit** — wie schnell du eine Rückmeldung erwarten kannst\n• **Webseite** — direkt verlinkt\n\nMit den **Pfeilen** (oder dem Mausrad) scrollst du durch die Reihen. Als Pro-Nutzer kannst du in den Einstellungen sogar eine **eigene Partnerkarte einreichen** — nach Freigabe erscheint sie hier.',
      placement: 'auto'
    },

    {
      id: 'net-send',
      tab: 's8',
      selector: '#dab-rails-host, #s8',
      icon: 'i-send',
      title: 'Anfrage senden — Daten gehen mit',
      body: 'Ein Klick auf **„Anfrage senden“** — DealPilot schickt deine **Objekt-Eckdaten strukturiert mit**. Der Partner antwortet dir direkt.',
      bodyMore: 'Was bei einer Anfrage passiert:\n\n• Vor dem Senden zeigt dir das **Mitgabe-Blatt**, welche Daten der Partner bekommt: Objekt, Eckdaten (Kaufpreis, Fläche, DSCR, LTV), deine Kontakt-E-Mail, optional Datenraum-Links\n• Manche Partner setzen **Voraussetzungen** — z.B. Grundfelder-Check 100 % oder verknüpfter Datenraum. Die Karte zeigt dir das vorher an\n• Der Partner **antwortet dir direkt per E-Mail** — DealPilot steht nicht dazwischen\n\n**Tipp:** Erst den Vorflug-Check auf 100 % bringen — dann sind alle Anfragen freigeschaltet und der Partner bekommt ein vollständiges Bild.',
      placement: 'auto'
    },
    
    {
      /* v1739 · HIER ZEIGTE DIE TOUR AUF EINEN KNOPF, DEN ES NICHT GIBT.
         Gemessen in allen vier Ansichten (Standard, Aktenmappe, Kanzlei,
         Tower): `.hdr-pdf-btn` und `button[onclick*="exportPDF"]` finden
         NULL Elemente - als einziger der 37 Schritte. Der Knopf sass
         einmal oben rechts im Kopf; heute steht er im Deal-Aktion-Tab in
         der Liste „Ausgabe" (`.dab-doc-btn`, sechs Stueck).

         > Ein Tour-Schritt, dessen Ziel es nicht mehr gibt, zeigt ins
         > Leere und erzaehlt dabei weiter. Der Text beschrieb eine Stelle,
         > an der der Nutzer nichts findet - und fuer einen, der die App
         > zum ersten Mal sieht, ist das nicht „veraltet", sondern falsch. */
      tab: 's8',
      /* v1789 · DER SELEKTOR TRAF ZWAR, ABER ZU KLEIN. Gemessen am
         02.10.2026 fand er genau ein Element: den Knopf "PDF", 82 x 39 px.
         Der Tour-Text davor sagt "unter Ausgabe steht das bank-fertige
         Investment-PDF" - gespotlightet wurde dann ein Knoepfchen ohne
         Beschriftung, zwischen fuenf gleich aussehenden Geschwistern
         (.dab-doc-btn gibt es sechsmal, der erste heisst "Fassung").

           button.dab-doc-btn.gold    82 x 39    "PDF"
           div.dab-doc-act           173 x 39    "Fassung PDF"
           div.dab-doc-row          1240 x 73    "Investment-PDF Empfohlen -
                                                  Business-Case, bank-fertig"   <- das ist die Stelle

         > Ein Spot ist eine Antwort auf "wo?". Ein 82-px-Knopf ohne
         > seine Zeile beantwortet die Frage nicht - der Name der Sache
         > steht daneben, und genau der faellt aus dem Rahmen.

         Erster Teil mit :has() auf die Zeile; _findElementWithRetry
         splittet bei Komma und probiert jeden Teil einzeln in try/catch,
         also faellt es notfalls sauber auf den Knopf zurueck. */
      selector: '.dab-doc-row:has([onclick*="exportDoc(\'invest\')"]), [onclick*="exportDoc(\'invest\')"], .dab-doc-btn.gold',
      icon: 'i-file-text',
      title: 'Investment-PDF',
      body: 'Im Deal-Aktion-Tab unter **Dokumente & Exporte** steht das bank-fertige Investment-PDF (gespotlightet). Ein Klick fragt, welche **Fassung** du brauchst — Bankfassung, hell oder Obsidian.',
      bodyMore: '**Wo finden:** Deal-Aktion-Tab, „Dokumente & Exporte“, erste Zeile.\n\n**Wie generieren:** Ein Klick auf „PDF“. DealPilot fragt nach der Fassung und baut das Dokument mit allen aktuellen Daten.\n\n**Vier Fassungen:**\n• **Bankfassung** — weißes Papier, Kennzahlen als Tabelle. Für Bank, Finanzierung, Steuerberater.\n• **Kurzfassung** — rund vier Seiten, weißes Papier. Für den Erstkontakt mit Bank oder Investor.\n• **Hell** — volles Dokument, helles Deckblatt. Für Miteigentümer und Ausdruck.\n• **Obsidian** — volles Dokument, dunkles Deckblatt. Für den eigenen Gebrauch.\n\nÜber den Knopf **„Fassung“** daneben lässt sich die Wahl jederzeit ändern.\n\n**Was drin ist:**\n• Deckblatt mit Objektfotos + Eckdaten\n• Investitionsübersicht\n• Cashflow-Projektion über deinen Betrachtungszeitraum\n• DSCR + LTV + Wertpuffer als Cockpit\n• Stress-Test\n• die Pilot-Analyse, sofern erstellt\n\nDas Finanzamt-PDF und die Kaufpreisaufteilung stehen als **eigene Zeilen** darunter.\n\nAb dem **Investor-Plan**: eigenes Logo und Kontaktdaten im PDF.',
      placement: 'auto'
    },
    
    // ═══ Phase 6: Tool-Tips + Hilfe ════════════════════════════════════
    
    {
      id: 'actions-menu',
      tab: 'sidebar',
      selector: '#sb-actions-accordion, .dpl-schiene',
      icon: 'i-menu',
      title: 'Das Aktionen-Menü',
      body: 'Über **Aktionen** in der Sidebar erreichst du alles Zentrale: Neues Objekt, Quick Boarding, Portfolio-Cockpit, Marktbericht, Import & Export.',
      bodyMore: 'Was du hier findest:\n\n• **Neues Objekt** — leeres Objekt anlegen\n• **Quick Boarding** — die Erstbewertung in rund einer Minute\n• **Portfolio-Cockpit** — Gesamtübersicht über ALLE Objekte\n• **Marktbericht** — Mikro-/Makrolage für eine Adresse\n• **Track Record & Bankexport** — deine Nachweise\n• **Import / Export** — Datensicherung und Datenübernahme\n• **Einstellungen & Feedback** — App-Konfiguration und direkter Draht zu uns',
      placement: 'right'
    },

    {
      id: 'cockpit-offer',
      tab: 'sidebar',
      selector: '#sb-actions-accordion, .dpl-schiene',
      subTargets: ['Portfolio-Cockpit'],
      icon: 'i-portfolio',
      title: 'Portfolio-Cockpit — alles auf einen Blick',
      body: 'Das **Portfolio-Cockpit** zeigt die **Gesamtübersicht über alle Objekte**: Portfolio Score, Kennzahlen und das Objekt-Board. Kurz reinschauen?',
      choices: [
        { label: 'Ja — Portfolio-Cockpit kurz zeigen', goto: 'cockpit-live' },
        { label: 'Weiter mit der Tour', goto: 'finish' }
      ],
      bodyMore: 'Was das Cockpit bündelt:\n\n• **Portfolio Score** deiner gewonnenen Objekte\n• **Kennzahlen** wie Mieteinnahmen, Investition, Restschuld und Cashflow\n• **Objekt-Board**: In Prüfung · Gewonnen · Verloren\n\nDu findest es jederzeit hier im Aktionen-Menü.',
      placement: 'right'
    },

    {
      id: 'cockpit-live',
      tab: 'sidebar',
      selector: '#dashboard-main, .dashboard, body',
      customAction: 'open-cockpit',
      icon: 'i-portfolio',
      title: 'Dein Portfolio-Cockpit',
      body: 'Hier laufen **alle Objekte zusammen**: der **Portfolio Score** deiner gewonnenen Objekte, Kennzahlen wie Mieteinnahmen, Investition, Restschuld und Cashflow, dazu das **Objekt-Board** (In Prüfung · Gewonnen · Verloren).',
      choices: [
        { label: 'Tour hier abschliessen — viel Erfolg!', goto: '__complete' },
        { label: 'Zurück zur Tour', goto: 'finish' }
      ],
      bodyMore: 'So arbeitest du mit dem Cockpit:\n\n• **Kacheln oben** — Portfolio-Summen auf einen Blick\n• **Objekt-Board** — deine Deals nach Stand\n• **Steuer und Projektion** über alle Objekte\n\nIdeal als Start in den Tag: erst Cockpit, dann ins einzelne Objekt.',
      placement: 'center'
    },

    {
      id: 'finish',
      tab: 'sidebar',
      selector: '#sb-actions-accordion, .dpl-schiene',
      icon: 'i-help',
      title: 'Tool-Tips: Anfänger, Profi oder Aus?',
      body: 'DealPilot zeigt **Tool-Tips** bei vielen Feldern (kleine ?-Icons). Welcher Modus passt zu dir? **Probier es direkt aus:**',
      bodyMore: 'Den Schalter findest du jederzeit in den Einstellungen unter „Darstellung“.\n\n**Anfänger** (Standard):\n• ALLE Tooltips eingeblendet\n• Inkl. Erklärungen für DSCR, AfA, BSV, IRR\n• Beispiele und Standardwerte\n• Ideal beim Einarbeiten\n\n**Profi:**\n• Nur kritische Hinweise (z.B. § 7b Sonder-AfA, 15%-Regel)\n• Anfänger-Erklärungen ausgeblendet\n• Kompakter Look\n\n**Aus:**\n• Keine Tooltips\n• Maximal aufgeräumte UI\n• Du kennst alles auswendig\n\nDu kannst jederzeit zwischen den Modi wechseln.',
      placement: 'center',
      customAction: 'tooltip-mode'
    },

    {
      tab: 'header',
      selector: 'button.hdr-icon-btn[title="Hilfe"], button[onclick*="showHelp"]',
      icon: 'i-bulb',
      title: 'Hilfe immer dabei',
      body: 'Du hast es geschafft! Klick auf das **Hilfe-Icon oben rechts** — dort findest du alles was du brauchst.',
      bodyMore: '**Tour nochmal starten:**\n• Im Hilfe-Fenster unter „Einstieg, Abläufe & Pilot“: **„Tour starten“**\n• oder in der Sidebar unter Aktionen → **„Rundgang starten“**\n\n**Was du im Hilfe-Fenster findest:**\n\n• **Themen** von Quick-Check über Steuer und Marktbericht bis Einstellungen\n• **Häufige Fragen** und ein **Glossar** mit 34 Begriffen\n• **Den Piloten**: Frage ins Suchfeld tippen, Enter fragt die KI — oder überall **F1** drücken\n\n**Hinweis:** Das Badge mit Prozent rechts in der **Reiterleiste** ist der Workflow-Fortschritt — es zeigt, wie viele der sechs Eingabe-Reiter ausgefüllt sind.\n\nViel Erfolg mit deinen Investments — denk dran: **ein guter Deal ist halb verhandelt, der Rest ist Bewertung.**',
      placement: 'auto'
    }
  ];

  // ─── Variante B: User ohne Objekte ──────────────────────────
  
  var STEPS_EMPTY = [
    
    // Sidebar mit Onboarding-Hinweis
    {
      tab: 'sidebar',
      selector: '.dpl-teil-objekte, #sb-list, .dpl-schiene, #sidebar',
      icon: 'i-portfolio',
      title: 'Willkommen bei DealPilot',
      body: 'In der **Sidebar links** sammelst du deine Objekte. **Du hast noch keins** — lass uns dein erstes anlegen!',
      bodyMore: 'Was die Sidebar dir künftig zeigt:\n\n• **Jedes Objekt** mit DealScore-Ampel\n• **Sortieren und filtern** nach Stand, Lage und Mandant\n• **Demo-Objekt** zum Üben\n\n**Limits nach Plan:**\n• **Free**: 1 Objekt\n• **Starter**: 5 Objekte\n• **Investor**: 25 Objekte\n• **Pro**: unbegrenzt\n\nLass uns mit dem **Quick-Check** starten — dem schnellsten Weg, ein Objekt zu bewerten.',
      placement: 'right'
    },
    
    {
      tab: 'sidebar',
      selector: '.sb-act-accent[onclick*="quickcheck"], button[onclick*="sbActionsAction(\'quickcheck\')"]',
      icon: 'i-flame',
      title: 'Starte mit Quick-Boarding',
      body: '**Klick auf den goldenen Quick-Boarding-Button** in der Sidebar — das Quick-Boarding ist die schnellste Erstbewertung, fertig in **rund einer Minute**.',
      bodyMore: 'Der Quick-Check ist dein **schnellster Einstieg**.\n\n**Was du brauchst:**\nAdresse (Straße, PLZ, Ort), Wohnfläche, Kaufpreis, Nettokaltmiete, Hausgeld samt nicht umlagefähigem Anteil, Eigenkapital, Zins und Tilgung. Zins, Tilgung und Hausgeld schlägt DealPilot aus deinen Standardwerten vor.\n\n**Was du sofort bekommst:**\n• DealScore mit Stufe\n• Sieben Kennzahlen (u. a. Bruttomietrendite, Cashflow, DSCR, LTV)\n• Zielkaufpreis und Verhandlungs-Empfehlung\n\n**Ideal für:**\n• Inseraten-Sichten\n• Mailings vom Makler\n• Erste Sondierung\n\nVielversprechende Objekte übernimmst du dann mit einem Klick in die Vollanalyse mit 9 Reitern.',
      placement: 'right'
    }
  ];

  // Restliche Schritte von withObjects ab Index 3 (Quick-Check Score) wiederverwenden
  // damit die Variante "empty" nicht doppelt gepflegt werden muss
  for (var i = 3; i < STEPS_WITH_OBJECTS.length; i++) {
    STEPS_EMPTY.push(STEPS_WITH_OBJECTS[i]);
  }

  // ─── Export ──────────────────────────────────────────────────────────
  
  window.DpTourVariants = {
    withObjects: STEPS_WITH_OBJECTS,
    empty: STEPS_EMPTY
  };

  // Kompatibilität: alte DpTourSteps-Property zeigt auf withObjects als Default
  window.DpTourSteps = STEPS_WITH_OBJECTS;

})();
