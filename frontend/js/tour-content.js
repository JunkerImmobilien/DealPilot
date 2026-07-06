// V251-03: Tour-Reihenfolge — DealScore + Investor Deal Score vor Bewertungs-Cockpit
/**
 * DealPilot V239 — Tour Steps (2 Varianten)
 *
 * window.DpTourVariants = {
 *   withObjects: [...]  // User hat schon Objekte (24 Steps)
 *   empty: [...]        // User leer (Onboarding, 20 Steps)
 * }
 *
 * Engine entscheidet bei Tour.start() welche Variante geladen wird.
 */
(function() {
  'use strict';

  // ─── Variante A: User hat schon Objekte (24 Steps) ─────────────────────
  
  var STEPS_WITH_OBJECTS = [
    
    // ═══ Phase 1: Sidebar Overview ════════════════════════════════════
    
    {
      tab: 'sidebar',
      selector: '#sb-list, #sidebar',
      icon: 'i-portfolio',
      title: 'Willkommen bei DealPilot',
      body: 'In der **Sidebar links** siehst du **alle deine Objekte**. Hier startest du jede Analyse.',
      bodyMore: 'Was die Sidebar dir zeigt:\n\n• **Jedes Objekt als Card** mit Adresse, Kaufpreis, DealScore-Ampel\n• **Kennzahlen** im Mini-Format: DSCR, Cashflow, Bruttomietrendite\n• **Sortier- und Filter-Funktion** nach Score, Lage, Plan\n• **Demo-Objekte** mit grüner Markierung\n\n**Limits nach Plan:**\n• **Free**: 3 Objekte\n• **Starter**: 15 Objekte\n• **Investor**: 50 Objekte\n• **Pro**: unlimited\n\nKlick einfach auf ein Objekt um es zu öffnen und in die Vollanalyse zu starten.',
      placement: 'right'
    },
    
    {
      tab: 'sidebar',
      selector: '#sb-list > *:first-child, #sb-list button:first-of-type, #sb-list',
      icon: 'i-home',
      title: 'Objekt auswählen',
      body: '**Klick auf ein Objekt** in der Sidebar — sofort siehst du alle Details, Tabs und Kennzahlen.',
      bodyMore: 'Was passiert wenn du ein Objekt anklickst:\n\n• **Alle 8 Tabs** werden mit den Objekt-Daten gefüllt\n• **DealScore** wird live berechnet\n• **Bewertungs-Cockpit** zeigt DSCR + LTV im 15-Jahres-Verlauf\n• **Änderungen** werden automatisch gespeichert\n\n**Tipp:** Du kannst zwischen Objekten jederzeit hin- und herwechseln — DealPilot speichert deinen Stand. Auch unfertige Bewertungen bleiben in der Sidebar.\n\nFür die Tour zeigen wir dir jetzt die wichtigsten Funktionen am Beispiel des aktuellen Objekts.',
      placement: 'right'
    },
    
    // ═══ Phase 2: Quick-Check (für NEUE Objekte) ═════════════════════
    
    {
      tab: 'sidebar',
      selector: '#sb-actions-accordion .sb-act-accent[onclick*="quickcheck"], #sb-actions-accordion button[onclick*="sbActionsAction(\'quickcheck\')"]',
      icon: 'i-flame',
      id: 'qb-intro',
      title: 'Neues Objekt? Quick-Boarding!',
      body: 'Der **goldene Quick-Boarding-Button** in der Sidebar startet das Quick-Boarding — die **30-Sekunden-Erstbewertung** für neue Objekte. Wie willst du weitermachen?',
      choices: [
        { label: 'Quick-Boarding Schritt für Schritt ansehen', goto: 'qb-score' },
        { label: 'Überspringen — weiter zur PRE-FLIGHT-Karte', goto: 'preflight' }
      ],
      bodyMore: 'Wann du den Quick-Check nutzt:\n\n• **Inseraten-Sichten** auf Immo-Plattformen\n• **Mailings vom Makler** schnell einschätzen\n• **Erste Sondierung** ob ein Objekt tiefer-prüfenswert ist\n\n**Was du brauchst:**\n• PLZ + Strasse\n• Wohnfläche\n• Kaufpreis\n• Nettokaltmiete\n\n**Was du sofort bekommst:**\n• Bruttomietrendite\n• Vorläufigen DealScore\n• Erste Lage-Einschätzung\n\nVielversprechende Objekte übernimmst du dann mit einem Klick in die Vollanalyse — alle Daten werden automatisch in die 8 Tabs übertragen.',
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
      body: '**Links oben im Panel**: der Live-Tacho. Während du Daten eingibst, wandert die Bewertung von rot zu grün.',
      bodyMore: 'Was im Score-Bereich passiert:\n\n• **DealScore-Donut** zeigt Wert 0-100 in Echtzeit\n• **5 Hauptkennzahlen** werden live aktualisiert: Bruttomietrendite, Nettomietrendite, Cashflow, DSCR, LTV\n• **Ampel-Farben**: Grün ab DealScore 70, Gelb 40-69, Rot unter 40\n\nDie Berechnung passiert ohne dass du speichern musst — sofort sichtbar nach jeder Eingabe.\n\n**Tipp:** Spiel mit Kaufpreis, Miete und Eigenkapital — du siehst sofort wie sich die Bewertung ändert. Perfekt für Verhandlungs-Vorbereitung.',
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
      body: '**Rechts oben im Panel** klebt der **Quickboarding-Pass** (der weisse Abriss mit „SCAN › ÜBERNEHMEN“) — dein teilbarer Kurz-Steckbrief. Er entsteht direkt hier beim Quick-Boarding.',
      bodyMore: 'Was der Boarding-Pass ist:\n\n• Eine **öffentliche Kurz-Ansicht** deines Objekts: Adresse, Eckdaten, Score — hübsch aufbereitet wie eine echte Bordkarte\n• Erreichbar über **Link oder QR-Code** — ideal für Partner, Mitinvestoren oder die Bank\n• **Zeitlich begrenzt gültig** und jederzeit widerrufbar — du behältst die Kontrolle\n\n**So entsteht er:**\n• Während du das Quick-Boarding befüllst, baut sich der Pass **rechts oben im Panel** automatisch mit auf\n• Beim **Speichern als Objekt** kannst du ihn direkt **mit übernehmen** — inklusive Link + QR-Code\n• Später erstellst/teilst du ihn jederzeit neu über „Quick Boarding teilen“ beim Objekt\n• Der QR-Code erscheint dann auch im **Deal-Aktion-Tab** direkt neben dem Deal-Status',
      placement: 'auto'
    },

    {
      id: 'qb-save',
      tab: 's-quick',
      selector: '#qc-tab-host, #s-quick',
      subSelectors: ['#qc-save-btn'],
      subTargets: ['Als Objekt speichern', 'speichern'],
      icon: 'i-piggy-bank',
      title: 'Als Objekt speichern',
      body: 'Vielversprechend? **Ein Klick** übernimmt alle Daten in die Vollanalyse mit 8 Tabs.',
      bodyMore: 'Was beim Speichern passiert:\n\n• Alle Quick-Check-Daten landen in **Tab Objekt + Investition + Miete**\n• Wohnfläche, Adresse, Baujahr werden vorbefüllt — kein doppeltes Tippen\n• Das Objekt erscheint dauerhaft in deiner **Sidebar links**\n• Du landest direkt in der Vollanalyse\n\nJetzt zeigen wir dir die 8 Tabs einzeln — das ist die eigentliche Bewertungs-Tiefe.',
      placement: 'auto'
    },

    // ═══ Phase 2b: PRE-FLIGHT-Karte (v865) ═════════════════════

    {
      id: 'preflight',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      icon: 'i-rocket',
      title: 'PRE-FLIGHT — dein Daten-Cockpit',
      body: 'Die **PRE-FLIGHT-Karte** oben im Objekt-Tab bringt Daten in Sekunden ins Objekt: Import, Sprache, Schnittstelle, Marktbewertung.',
      bodyMore: 'Vier Wege, wie deine Daten ins Objekt kommen:\n\n• **Dokument-Import** — Exposés und Marktberichte hochladen, DealPilot liest die Felder aus\n• **Sprachaufzeichnung** — Objekt einfach einsprechen\n• **ImmoMetrica-Import** — Objekte direkt aus deinem ImmoMetrica-Konto ziehen\n• **Marktbewertung** — professionelle Marktwert- und Mietpreis-Einschätzung abrufen\n\nDie nächsten Schritte zeigen dir jeden Weg einzeln.',
      placement: 'auto'
    },

    {
      id: 'pf-import',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['Exposé'],
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

    {
      id: 'pf-immo',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['ImmoMetrica'],
      icon: 'i-import',
      title: 'ImmoMetrica-Import',
      body: 'Mit hinterlegtem **API-Key** ziehst du Objekte **direkt aus ImmoMetrica** nach DealPilot.',
      bodyMore: 'So richtest du die ImmoMetrica-Anbindung ein:\n\n• API-Key in den **Einstellungen unter „Externe Anbieter“** hinterlegen (sicher verschlüsselt gespeichert)\n• Danach in der PRE-FLIGHT-Karte den **ImmoMetrica-Import** starten\n• Objekt auswählen — Stammdaten, Flächen und Preise werden **automatisch übernommen**\n\nIdeal, wenn du in ImmoMetrica recherchierst und in DealPilot rechnest — kein doppeltes Erfassen.',
      placement: 'auto'
    },

    {
      id: 'pf-avm',
      tab: 's0',
      selector: '#obj-action-bar, .obj-action-bar',
      subTargets: ['DealPilot', 'Sprengnetter', 'PriceHubble', 'Abrufen'],
      icon: 'i-chart',
      title: 'Marktbewertung — Wert & Miete mit Spanne',
      body: 'Hol dir eine professionelle **Marktwert-** und **Mietpreis-Einschätzung** — jeweils mit **oberer und unterer Spanne**.',
      bodyMore: 'Was die Marktbewertung liefert:\n\n• **Marktpreis-Indikation** für dein Objekt — mit Ober- und Untergrenze statt einer Schein-Genauigkeit\n• **Mietpreis-Einschätzung** — ebenfalls als Spanne\n• Basierend auf professionellen Bewertungsdaten und der genauen Adresse\n\n**Wofür du das nutzt:**\n• Kaufpreis **plausibilisieren** — liegt das Angebot in der Spanne?\n• **Verhandlungsargumente** — mit Daten statt Bauchgefühl\n• Miete nach Modernisierung **realistisch ansetzen**\n\nDie Einschätzung fliesst direkt in deine Bewertung ein. Abruf kostet Kerosin — der Preis wird vorher klar angezeigt.',
      placement: 'auto'
    },

    {
      id: 'pass-obj',
      tab: 's0',
      selector: '#obj-action-bar, .tab[data-target-sec="s0"]',
      subTargets: ['PASS'],
      icon: 'i-qr',
      title: 'Boarding-Pass zum Objekt',
      body: 'Auch hier im **Tab Objekt** erstellst du jederzeit einen **Boarding-Pass** — und teilst ihn per Link oder QR-Code.',
      bodyMore: 'Der Boarding-Pass im Überblick:\n\n• **Was drin ist:** Adresse, Objektart, Eckdaten (Kaufpreis, Fläche, Miete), Score — als hübsche Bordkarte aufbereitet\n• **Erstellen:** über „Quick Boarding teilen“ beim Objekt — DealPilot erzeugt Link + QR-Code\n• **Teilen:** Link verschicken oder QR zeigen — der Empfänger braucht **keinen Account**\n• **Kontrolle:** zeitlich begrenzt gültig, jederzeit widerrufbar\n• Der QR-Code erscheint zusätzlich im **Deal-Aktion-Tab** direkt neben dem Deal-Status\n\nPerfekt für Mitinvestoren, Partner oder das Bankgespräch.',
      placement: 'auto'
    },

    // ═══ Phase 3: 8 Tabs einzeln ══════════════════════════════════════
    
    {
      tab: 's0',
      selector: '.tab[data-target-sec="s0"]',
      icon: 'i-home',
      title: 'Tab 1: Objekt',
      body: 'Hier trägst du die **Stammdaten** ein: Adresse, Wohnfläche, Baujahr, Etage, Zimmer, Fotos.',
      bodyMore: '**Wichtigste Felder:**\n\n• **PLZ + Ort + Strasse** — für KI-Lagebewertung\n• **Wohnfläche** — Basis für Euro/m2-Vergleiche\n• **Baujahr** — bestimmt AfA-Satz (vor 1925 / 1925-2000 / nach 2000)\n• **Etage / Zimmer / Balkon / Keller** — Wertfaktoren\n• **Bis zu 8 Fotos** — landen direkt im Business-Case-PDF\n\nFelder mit **rotem Sternchen** sind Pflicht. Tipp: Adresse so genau wie möglich — die KI braucht das für akkurate Bodenrichtwerte.',
      placement: 'auto'
    },
    
    {
      tab: 's1',
      selector: '.tab[data-target-sec="s1"]',
      icon: 'i-coins',
      title: 'Tab 2: Investition',
      body: 'Hier definierst du **Kaufpreis + Nebenkosten** — die echten Anschaffungskosten.',
      bodyMore: '**Was hier rein gehört:**\n\n• **Kaufpreis** — wie verhandelt (Pflichtfeld)\n• **Grunderwerbsteuer** — automatisch nach Bundesland (3,5-6,5%)\n• **Notar + Grundbuch** — typisch 1,5-2%\n• **Maklerprovision** — wenn vorhanden\n• **Sanierungskosten** — geplante Modernisierungen\n• **Aufteilung Boden / Gebäude** — wichtig für AfA\n\nDealPilot rechnet automatisch:\n• Gesamtinvestition\n• AfA-Basis pro Jahr\n• Sonder-AfA-Berechtigung (§7b)',
      placement: 'auto'
    },
    
    {
      tab: 's2',
      selector: '.tab[data-target-sec="s2"]',
      icon: 'i-euro',
      title: 'Tab 3: Miete',
      body: 'Hier trägst du die **Einnahmen-Seite** ein: Nettokaltmiete und Zusatzerträge.',
      bodyMore: '**Was hier rein gehört:**\n\n• **Nettokaltmiete / Monat** (Pflichtfeld)\n• **Mietsteigerung p.a.** — Default 1,5%\n• **Leerstandsquote** — Default 3%\n• **Hausgeld umlagefähig** — Anteil den Mieter zahlt\n• **Zusatzerträge** — Garage, Stellplatz, möblierte Vermietung\n\n**Wichtig:** Hier IMMER **Netto-Kalt-Miete** — ohne Heizkosten, ohne Nebenkosten.',
      placement: 'auto'
    },
    
    {
      tab: 's3',
      selector: '.tab[data-target-sec="s3"]',
      icon: 'i-bank',
      title: 'Tab 4: Finanzierung',
      body: 'Hier baust du **dein Darlehen** — auch komplexe Setups mit mehreren Darlehen + BSV.',
      bodyMore: '**Was DealPilot kann:**\n\n• **Hauptdarlehen** mit Zinsbindung 5/10/15/20/30 Jahre\n• **Zusatzdarlehen** für KfW oder Familiendarlehen\n• **Bausparvertrag (BSV)** als Tilgungsersatz\n• **Tilgungssatz** frei wählbar (1-10 % p.a.)\n• **Anschlusszins-Szenario** für Stress-Test (Default 5,0 %)\n• **Sondertilgungen** möglich\n\nDie DSCR-Berechnung berücksichtigt automatisch alle aktiven Darlehen — sogar BSV-Raten fliessen mit ein. **Single Source of Truth** für alle Bewertungsstellen.',
      placement: 'auto'
    },
    
    {
      tab: 's4',
      selector: '.tab[data-target-sec="s4"]',
      icon: 'i-settings',
      title: 'Tab 5: Bewirtschaftung',
      body: 'Hier definierst du **die laufenden Kosten** als Eigentümer — Hausgeld, Instandhaltung, Verwaltung.',
      bodyMore: '**Was hier rein gehört:**\n\n• **Hausgeld (nicht umlagefähig)** — Verwaltung + Rücklagen\n• **Instandhaltung** — typisch 0,8-1,2 % des Gebäudewerts p.a.\n• **Mietausfallwagnis** — Default 2%\n• **Property-Management** — falls Hausverwalter (typ. 4-8% Kaltmiete)\n• **Versicherung** — Wohngebäude, Haftpflicht\n\n**Wichtig:** Diese Kosten reduzieren deinen Cashflow direkt. **Konservativ schätzen, kontrolliert hoch leben.**',
      placement: 'auto'
    },
    
    {
      tab: 's5',
      selector: '.tab[data-target-sec="s5"]',
      icon: 'i-pin',
      title: 'Tab 6: Pilot-Analyse',
      body: 'Die **KI analysiert Mikrolage, Infrastruktur, Wertentwicklung** und liefert einen ausführlichen Lage-Bericht.',
      bodyMore: '**Was die Lage-KI prüft:**\n\n• **Mikrolage** — Verkehrsanbindung, Infrastruktur, Nachbarschaft\n• **Mieterstruktur** — Einkommensniveau, Beruf\n• **Wertentwicklung** — historisch + Prognose\n• **Risikofaktoren** — Leerstand, Gentrifizierung\n• **Vergleichsobjekte** im Umkreis\n\nErgebnis: ein **Lage-Score (0-100)** + ausführlicher Text für deine Bank-Präsentation.\n\nKostet KI-Credits — auf Pro-Plan unlimited.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '.tab[data-target-sec="s6"]',
      icon: 'i-gauge',
      title: 'Tab 7: Bewertung',
      body: 'Der **wichtigste Tab** für Banker: DSCR, LTV, Wertpuffer, DealScore, Stress-Test — alles in einem Cockpit.',
      bodyMore: '**Die Kernbestandteile:**\n\n• **Bewertungs-Cockpit** mit DSCR + LTV im Verlauf (15 Jahre)\n• **DealScore 0-100** als Gesamtbewertung\n• **Investor Deal Score** mit 24 KPIs (Starter+)\n• **Stress-Test** mit 4 Szenarien\n• **Cashflow-Tabelle** über 10 Jahre\n• **Werbungskosten-Anlage** für Finanzamt\n\nHier verbringst du beim Endcheck die meiste Zeit. Alle Zahlen synchronisieren live mit den anderen Tabs.',
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
      bodyMore: 'Die 5 Hauptfaktoren des DealPilot Scores:\n\n• **Rendite** — Brutto-/Nettomietrendite, EK-Rendite\n• **Cashflow** — monatlicher Überschuss nach Steuern\n• **Sicherheit** — Wertpuffer, Reserven\n• **Finanzierung** — DSCR (Schuldendeckung), LTV (Beleihung)\n• **Effizienz** — Bewirtschaftungsquote\n\n**Skala:**\n• **80-100** Ausgezeichnet — klare Kauf-Empfehlung\n• **60-79** Gut — sorgfältig prüfen\n• **40-59** Mittel — Vorsicht\n• **unter 40** Schwach — eher ablehnen\n\nDealScore ist objektspezifisch — derselbe Deal kann für verschiedene Investoren unterschiedlich gut sein.',
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
      body: 'Der **Investor Deal Score** ist die erweiterte Bewertung mit **24 KPIs in 6 Kategorien** — deutlich tiefer als die 5 Hauptfaktoren des Basis-Scores — verfügbar ab **Starter-Plan**.',
      bodyMore: '**Was der Investor Score zusätzlich prüft:**\n\n• Vermögens-Multiplikator (Equity Multiple)\n• Cash-on-Cash-Return\n• Net Operating Income (NOI)\n• Cap Rate\n• Sensitivitäten (Zins, Miete, Marktwert)\n• 19 weitere Kennzahlen\n\n**Wo finden:**\n• Im Tab Bewertung als eigene Cockpit-Karte (gerade gespotlightet)\n• Im Header oben rechts: Toggle-Button "Investor Deal Score" ein/aus\n\n**Plan-Verfügbarkeit:**\n• **Free**: Nur Basis-DealPilot-Score (5 Hauptfaktoren)\n• **Starter & höher**: Investor Score mit 24 Kennzahlen\n• **Pro**: Plus Custom-Gewichtungen + Profile speichern\n\nFür Banker und ernsthafte Investoren ist der Investor Deal Score Pflicht — er zeigt Aspekte die der Basis-Score nicht abdeckt.',
      placement: 'center'
    },
    
    {
      tab: 's6',
      selector: '#bc-cockpit, #s6',
      icon: 'i-gauge',
      title: 'Bewertungs-Cockpit',
      body: '**DSCR & LTV im 15-Jahres-Verlauf** — was die Bank zürst sieht.',
      bodyMore: '**DSCR (Schuldendienstdeckung):**\n• über 1,2 = solide\n• 1,0-1,2 = knapp\n• unter 1,0 = kritisch\n\n**LTV (Beleihungsauslauf):**\n• unter 85% = solide, beste Konditionen\n• 85-100% = erhöhter Zins\n• über 100% = Vollfinanzierung, schwierig\n\n**Wertpuffer:** Differenz Verkehrswert vs. Kaufpreis. Je grösser, desto mehr Sicherheit.\n\nDie Bank schaut sich zürst diese Zahlen an, bevor sie überhaupt das Objekt anschaut.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '#bc-stress, #s6',
      icon: 'i-cpu',
      title: 'Stress-Test',
      body: 'Was passiert wenn **Zinsen steigen** oder **Miete ausfällt**? Der Stress-Test simuliert es.',
      bodyMore: 'Standard-Szenarien:\n\n• **Anschlusszins +2 Prozentpunkte** — was kostet das Darlehen in 10 Jahren?\n• **Mietausfall 3 Monate** — bleibt der Cashflow stabil?\n• **Leerstand 10 %** dauerhaft — kippt die Finanzierung?\n• **Marktwertverlust 15 %** — wie steht der LTV dann?\n\nFür jedes Szenario zeigt DealPilot den **neuen DSCR** und ob die Finanzierung weiter trägt. **Banken lieben diese Analyse** — sie zeigt dass du das Risiko verstanden hast. Print direkt mit ins Business-Case-PDF.',
      placement: 'auto'
    },

    // ═══ Phase 5: Deal-Aktion ═════════════════════════════════════════
    
    {
      tab: 's8',
      selector: '.tab[data-target-sec="s8"]',
      icon: 'i-flag',
      id: 'da-intro',
      title: 'Tab 8: Deal-Aktion — dein Boarding-Cockpit',
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
      tab: 'header',
      selector: '.hdr-pdf-btn, button[onclick*="exportPDF"]',
      icon: 'i-file-text',
      title: 'Investment-PDF',
      body: 'Der **Investment-PDF-Button oben rechts im Header** (gespotlightet) erstellt das bank-fertige Investment-PDF mit allen aktuellen Daten.',
      bodyMore: '**Wo finden:** Sidebar links unter "Aktionen" -> "Business-Case-PDF". Oder direkt im Deal-Aktion-Tab.\n\n**Wie generieren:** Ein Klick. DealPilot baut das PDF mit allen aktuellen Daten und öffnet einen Download-Link. Dauer 5-30 Sekunden.\n\n**Was drin ist:**\n• Deckblatt mit Objektfotos + Eckdaten\n• Investitionsübersicht\n• Cashflow-Tabelle über 10 Jahre\n• DSCR + LTV + Wertpuffer als Cockpit\n• Stress-Test-Szenarien\n• KI-Lagebewertung als Volltext\n• Werbungskosten-Anlage für Finanzamt\n\n**Tipp vor PDF-Export:** Alle Pflichtfelder checken (rot markiert).\n\nPro-Plan: **eigenes Logo + Footer + Impressum**.',
      placement: 'auto'
    },
    
    // ═══ Phase 6: Tool-Tips + Hilfe ════════════════════════════════════
    
    {
      id: 'actions-menu',
      tab: 'sidebar',
      selector: '#sb-actions-accordion',
      icon: 'i-menu',
      title: 'Das Aktionen-Menü',
      body: 'Über **Aktionen** in der Sidebar erreichst du alles Zentrale: Neues Objekt, Quick Boarding, Portfolio-Cockpit, Marktbericht, Import & Export.',
      bodyMore: 'Was du hier findest:\n\n• **Neues Objekt** — leeres Objekt anlegen\n• **Quick Boarding** — die 30-Sekunden-Erstbewertung\n• **Portfolio-Cockpit** — Gesamtübersicht über ALLE Objekte\n• **Marktbericht** — Mikro-/Makrolage für eine Adresse\n• **Track Record & Bankexport** — deine Nachweise\n• **Import / Export** — Datensicherung und Datenübernahme\n• **Einstellungen & Feedback** — App-Konfiguration und direkter Draht zu uns',
      placement: 'right'
    },

    {
      id: 'cockpit-offer',
      tab: 'sidebar',
      selector: '#sb-actions-accordion',
      subTargets: ['Portfolio-Cockpit'],
      icon: 'i-portfolio',
      title: 'Portfolio-Cockpit — alles auf einen Blick',
      body: 'Das **Portfolio-Cockpit** zeigt die **Gesamtübersicht über alle Objekte**: Werte, Cashflows, Scores. Kurz reinschauen?',
      choices: [
        { label: 'Ja — Portfolio-Cockpit kurz zeigen', goto: 'cockpit-live' },
        { label: 'Weiter mit der Tour', goto: 'finish' }
      ],
      bodyMore: 'Was das Cockpit bündelt:\n\n• **Portfolio-Wert & Fremdkapital** über alle Objekte\n• **Cashflow-Summe** pro Monat\n• **Score-Verteilung** — wo stehen deine Deals?\n• Objekt-Vergleich in einer Tabelle\n\nDu findest es jederzeit hier im Aktionen-Menü.',
      placement: 'right'
    },

    {
      id: 'cockpit-live',
      tab: 'sidebar',
      selector: '#dashboard-main, .dashboard, body',
      customAction: 'open-cockpit',
      icon: 'i-portfolio',
      title: 'Dein Portfolio-Cockpit',
      body: 'Hier laufen **alle Objekte zusammen**: Gesamtwert, Fremdkapital, Cashflow-Summe und die Score-Verteilung deines Portfolios.',
      choices: [
        { label: 'Tour hier abschliessen — viel Erfolg!', goto: '__complete' },
        { label: 'Zurück zur Tour', goto: 'finish' }
      ],
      bodyMore: 'So arbeitest du mit dem Cockpit:\n\n• **Kacheln oben** — Portfolio-Summen auf einen Blick\n• **Objekt-Tabelle** — alle Deals im Vergleich, sortierbar\n• **Charts** — Entwicklung und Verteilung\n\nIdeal als Start in den Tag: erst Cockpit, dann ins einzelne Objekt.',
      placement: 'center'
    },

    {
      id: 'finish',
      tab: 'sidebar',
      selector: '#sb-actions-accordion',
      icon: 'i-help',
      title: 'Tool-Tips: Anfänger, Profi oder Aus?',
      body: 'DealPilot zeigt **Tool-Tips** bei vielen Feldern (kleine ?-Icons). Welcher Modus passt zu dir? **Probier es direkt aus:**',
      bodyMore: 'Den Schalter findest du jederzeit in den Einstellungen unter "Profil & Anzeige".\n\n**Anfänger** (Standard):\n• ALLE Tooltips eingeblendet\n• Inkl. Erklärungen für DSCR, AfA, BSV, IRR\n• Beispiele und Standardwerte\n• Ideal beim Einarbeiten\n\n**Profi:**\n• Nur kritische Hinweise (z.B. § 7b Sonder-AfA, 15%-Regel)\n• Anfänger-Erklärungen ausgeblendet\n• Kompakter Look\n\n**Aus:**\n• Keine Tooltips\n• Maximal aufgeräumte UI\n• Du kennst alles auswendig\n\nDu kannst jederzeit zwischen den Modi wechseln.',
      placement: 'center',
      customAction: 'tooltip-mode'
    },

    {
      tab: 'header',
      selector: 'button.hdr-icon-btn[title="Hilfe"], button[onclick*="showHelp"]',
      icon: 'i-bulb',
      title: 'Hilfe immer dabei',
      body: 'Du hast es geschafft! Klick auf das **Hilfe-Icon oben rechts** — dort findest du alles was du brauchst.',
      bodyMore: '**Tour nochmal starten:**\n• Klicke auf das Hilfe-Icon oben rechts (Fragezeichen in Gold)\n• Im Hilfe-Modal: Button "Einführungs-Tour starten"\n\n**Was du im Hilfe-Modal findest:**\n\n• **Glossar** mit 29 Finanzbegriffen (DSCR, AfA, BSV, IRR, Sonder-§7b ...)\n• **KI-Assistent** für DealPilot-Fragen und Investment-Beratung\n• **Anleitungen** für PDF-Export, Stripe-Setup, Plan-Wechsel\n• **Tipps & Tricks**\n• **Kontakt** zu Junker Immobilien\n\n**Hinweis:** Das gelbe Badge mit Prozent daneben ist der **Workflow-Fortschritt** — zeigt wie viele Tabs du schon ausgefüllt hast.\n\nViel Erfolg mit deinen Investments — denk dran: **ein guter Deal ist halb verhandelt, der Rest ist Bewertung.**',
      placement: 'auto'
    }
  ];

  // ─── Variante B: User ohne Objekte (20 Steps) ──────────────────────────
  
  var STEPS_EMPTY = [
    
    // Sidebar mit Onboarding-Hinweis
    {
      tab: 'sidebar',
      selector: '#sb-list, #sidebar',
      icon: 'i-portfolio',
      title: 'Willkommen bei DealPilot',
      body: 'In der **Sidebar links** sammelst du deine Objekte. **Du hast noch keins** — lass uns dein erstes anlegen!',
      bodyMore: 'Was die Sidebar dir künftig zeigt:\n\n• **Jedes Objekt** mit DealScore-Ampel\n• **Portfolio-Übersicht** mit Gesamt-Cashflow\n• **Such- und Filter-Funktion**\n• **Demo-Objekte** zum Üben (deine ersten Tutorial-Objekte)\n\n**Plan-Limits:**\n• Free: 3 Objekte\n• Starter: 15\n• Investor: 50\n• Pro: unlimited\n\nLass uns mit dem **Quick-Check** starten — dem schnellsten Weg ein Objekt zu bewerten.',
      placement: 'right'
    },
    
    {
      tab: 'sidebar',
      selector: '.sb-act-accent[onclick*="quickcheck"], button[onclick*="sbActionsAction(\'quickcheck\')"]',
      icon: 'i-flame',
      title: 'Starte mit Quick-Boarding',
      body: '**Klick auf den goldenen Quick-Boarding-Button** in der Sidebar — das Quick-Boarding ist die schnellste Erstbewertung, fertig in **30 Sekunden**.',
      bodyMore: 'Der Quick-Check ist dein **schnellster Einstieg**:\n\n**Was du brauchst:**\n• PLZ + Strasse\n• Wohnfläche\n• Kaufpreis\n• Nettokaltmiete\n\n**Was du bekommst:**\n• Bruttomietrendite\n• Vorläufigen DealScore (0-100)\n• Erste Lage-Einschätzung\n\n**Ideal für:**\n• Inseraten-Sichten\n• Mailings vom Makler\n• Erste Sondierung\n\nVielversprechende Objekte übernimmst du dann mit einem Klick in die Vollanalyse mit 8 Tabs.',
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
