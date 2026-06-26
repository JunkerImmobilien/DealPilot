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
      bodyMore: 'Was die Sidebar dir zeigt:\n\n• **Jedes Objekt als Card** mit Adresse, Kaufpreis, DealScore-Ampel\n• **Kennzahlen** im Mini-Format: DSCR, Cashflow, Bruttomietrendite\n• **Sortier- und Filter-Funktion** nach Score, Lage, Plan\n• **Demo-Objekte** mit gruener Markierung\n\n**Limits nach Plan:**\n• **Free**: 3 Objekte\n• **Starter**: 15 Objekte\n• **Investor**: 50 Objekte\n• **Pro**: unlimited\n\nKlick einfach auf ein Objekt um es zu oeffnen und in die Vollanalyse zu starten.',
      placement: 'right'
    },
    
    {
      tab: 'sidebar',
      selector: '#sb-list > *:first-child, #sb-list button:first-of-type, #sb-list',
      icon: 'i-home',
      title: 'Objekt auswaehlen',
      body: '**Klick auf ein Objekt** in der Sidebar — sofort siehst du alle Details, Tabs und Kennzahlen.',
      bodyMore: 'Was passiert wenn du ein Objekt anklickst:\n\n• **Alle 8 Tabs** werden mit den Objekt-Daten gefuellt\n• **DealScore** wird live berechnet\n• **Bewertungs-Cockpit** zeigt DSCR + LTV im 15-Jahres-Verlauf\n• **Aenderungen** werden automatisch gespeichert\n\n**Tipp:** Du kannst zwischen Objekten jederzeit hin- und herwechseln — DealPilot speichert deinen Stand. Auch unfertige Bewertungen bleiben in der Sidebar.\n\nFuer die Tour zeigen wir dir jetzt die wichtigsten Funktionen am Beispiel des aktuellen Objekts.',
      placement: 'right'
    },
    
    // ═══ Phase 2: Quick-Check (fuer NEUE Objekte) ═════════════════════
    
    {
      tab: 'sidebar',
      selector: '#sb-actions-accordion .sb-act-accent[onclick*="quickcheck"], #sb-actions-accordion button[onclick*="sbActionsAction(\'quickcheck\')"]',
      icon: 'i-flame',
      title: 'Neues Objekt? Quick-Check!',
      body: 'Der **goldene Quick-Check-Button** in der Sidebar (gespotlightet) startet eine 60-Sekunden-Bewertung fuer neue Objekte.',
      bodyMore: 'Wann du den Quick-Check nutzt:\n\n• **Inseraten-Sichten** auf Immo-Plattformen\n• **Mailings vom Makler** schnell einschaetzen\n• **Erste Sondierung** ob ein Objekt tiefer-pruefenswert ist\n\n**Was du brauchst:**\n• PLZ + Strasse\n• Wohnflaeche\n• Kaufpreis\n• Nettokaltmiete\n\n**Was du sofort bekommst:**\n• Bruttomietrendite\n• Vorlaeufigen DealScore\n• Erste Lage-Einschaetzung\n\nVielversprechende Objekte uebernimmst du dann mit einem Klick in die Vollanalyse — alle Daten werden automatisch in die 8 Tabs uebertragen.',
      placement: 'right'
    },
    
    {
      tab: 's-quick',
      selector: '#qc-score-circle, .ds-donut, #qc-score-kpis, #qc-tab-host',
      icon: 'i-flame',
      title: 'Quick-Check Score',
      body: 'Hier siehst du die **Live-Bewertung** waehrend du Daten eingibst — Ampel von rot zu gruen.',
      bodyMore: 'Was im Score-Bereich passiert:\n\n• **DealScore-Donut** zeigt Wert 0-100 in Echtzeit\n• **5 Hauptkennzahlen** werden live aktualisiert: Bruttomietrendite, Nettomietrendite, Cashflow, DSCR, LTV\n• **Ampel-Farben**: Gruen ab DealScore 70, Gelb 40-69, Rot unter 40\n\nDie Berechnung passiert ohne dass du speichern musst — sofort sichtbar nach jeder Eingabe.\n\n**Tipp:** Spiel mit Kaufpreis, Miete und Eigenkapital — du siehst sofort wie sich die Bewertung aendert. Perfekt fuer Verhandlungs-Vorbereitung.',
      placement: 'auto'
    },
    
    {
      tab: 's-quick',
      selector: '#qc-ai-research-btn',
      icon: 'i-brain',
      title: 'KI-Marktrecherche',
      body: 'Die **KI sucht automatisch** Vergleichsmieten und Bodenrichtwerte fuer deine PLZ.',
      bodyMore: 'Was die KI fuer dich macht:\n\n• **Vergleichsmieten** aus aktuellen Inseraten und Mietspiegel\n• **Bodenrichtwerte** ueber oeffentliche GAA-Datenbanken\n• **Mikrolage-Bewertung** (Infrastruktur, Anbindung)\n• **Wertentwicklungs-Prognose**\n\nDas Ergebnis fliesst direkt in DealScore und Plausibilitaetspruefung.\n\n**Kostet KI-Credits:**\n• **Free**: 5 Credits/Monat\n• **Starter**: 30 Credits/Monat\n• **Investor**: 100 Credits/Monat\n• **Pro**: unlimited\n\nSpart 20-30 Min manuelle Recherche pro Objekt.',
      placement: 'auto'
    },
    
    {
      tab: 's-quick',
      selector: '#qc-save-btn',
      icon: 'i-piggy-bank',
      title: 'Als Objekt speichern',
      body: 'Vielversprechend? **Ein Klick** uebernimmt alle Daten in die Vollanalyse mit 8 Tabs.',
      bodyMore: 'Was beim Speichern passiert:\n\n• Alle Quick-Check-Daten landen in **Tab Objekt + Investition + Miete**\n• Wohnflaeche, Adresse, Baujahr werden vorbefuellt — kein doppeltes Tippen\n• Das Objekt erscheint dauerhaft in deiner **Sidebar links**\n• Du landest direkt in der Vollanalyse\n\nJetzt zeigen wir dir die 8 Tabs einzeln — das ist die eigentliche Bewertungs-Tiefe.',
      placement: 'auto'
    },

    // ═══ Phase 3: 8 Tabs einzeln ══════════════════════════════════════
    
    {
      tab: 's0',
      selector: '.tab[data-target-sec="s0"]',
      icon: 'i-home',
      title: 'Tab 1: Objekt',
      body: 'Hier traegst du die **Stammdaten** ein: Adresse, Wohnflaeche, Baujahr, Etage, Zimmer, Fotos.',
      bodyMore: '**Wichtigste Felder:**\n\n• **PLZ + Ort + Strasse** — fuer KI-Lagebewertung\n• **Wohnflaeche** — Basis fuer Euro/m2-Vergleiche\n• **Baujahr** — bestimmt AfA-Satz (vor 1925 / 1925-2000 / nach 2000)\n• **Etage / Zimmer / Balkon / Keller** — Wertfaktoren\n• **Bis zu 8 Fotos** — landen direkt im Business-Case-PDF\n\nFelder mit **rotem Sternchen** sind Pflicht. Tipp: Adresse so genau wie moeglich — die KI braucht das fuer akkurate Bodenrichtwerte.',
      placement: 'auto'
    },
    
    {
      tab: 's1',
      selector: '.tab[data-target-sec="s1"]',
      icon: 'i-coins',
      title: 'Tab 2: Investition',
      body: 'Hier definierst du **Kaufpreis + Nebenkosten** — die echten Anschaffungskosten.',
      bodyMore: '**Was hier rein gehoert:**\n\n• **Kaufpreis** — wie verhandelt (Pflichtfeld)\n• **Grunderwerbsteuer** — automatisch nach Bundesland (3,5-6,5%)\n• **Notar + Grundbuch** — typisch 1,5-2%\n• **Maklerprovision** — wenn vorhanden\n• **Sanierungskosten** — geplante Modernisierungen\n• **Aufteilung Boden / Gebaeude** — wichtig fuer AfA\n\nDealPilot rechnet automatisch:\n• Gesamtinvestition\n• AfA-Basis pro Jahr\n• Sonder-AfA-Berechtigung (§7b)',
      placement: 'auto'
    },
    
    {
      tab: 's2',
      selector: '.tab[data-target-sec="s2"]',
      icon: 'i-euro',
      title: 'Tab 3: Miete',
      body: 'Hier traegst du die **Einnahmen-Seite** ein: Nettokaltmiete und Zusatzertraege.',
      bodyMore: '**Was hier rein gehoert:**\n\n• **Nettokaltmiete / Monat** (Pflichtfeld)\n• **Mietsteigerung p.a.** — Default 1,5%\n• **Leerstandsquote** — Default 3%\n• **Hausgeld umlagefaehig** — Anteil den Mieter zahlt\n• **Zusatzertraege** — Garage, Stellplatz, moeblierte Vermietung\n\n**Wichtig:** Hier IMMER **Netto-Kalt-Miete** — ohne Heizkosten, ohne Nebenkosten.',
      placement: 'auto'
    },
    
    {
      tab: 's3',
      selector: '.tab[data-target-sec="s3"]',
      icon: 'i-bank',
      title: 'Tab 4: Finanzierung',
      body: 'Hier baust du **dein Darlehen** — auch komplexe Setups mit mehreren Darlehen + BSV.',
      bodyMore: '**Was DealPilot kann:**\n\n• **Hauptdarlehen** mit Zinsbindung 5/10/15/20/30 Jahre\n• **Zusatzdarlehen** fuer KfW oder Familiendarlehen\n• **Bausparvertrag (BSV)** als Tilgungsersatz\n• **Tilgungssatz** frei waehlbar (1-10 % p.a.)\n• **Anschlusszins-Szenario** fuer Stress-Test (Default 5,0 %)\n• **Sondertilgungen** moeglich\n\nDie DSCR-Berechnung beruecksichtigt automatisch alle aktiven Darlehen — sogar BSV-Raten fliessen mit ein. **Single Source of Truth** fuer alle Bewertungsstellen.',
      placement: 'auto'
    },
    
    {
      tab: 's4',
      selector: '.tab[data-target-sec="s4"]',
      icon: 'i-settings',
      title: 'Tab 5: Bewirtschaftung',
      body: 'Hier definierst du **die laufenden Kosten** als Eigentuemer — Hausgeld, Instandhaltung, Verwaltung.',
      bodyMore: '**Was hier rein gehoert:**\n\n• **Hausgeld (nicht umlagefaehig)** — Verwaltung + Ruecklagen\n• **Instandhaltung** — typisch 0,8-1,2 % des Gebaeudewerts p.a.\n• **Mietausfallwagnis** — Default 2%\n• **Property-Management** — falls Hausverwalter (typ. 4-8% Kaltmiete)\n• **Versicherung** — Wohngebaeude, Haftpflicht\n\n**Wichtig:** Diese Kosten reduzieren deinen Cashflow direkt. **Konservativ schaetzen, kontrolliert hoch leben.**',
      placement: 'auto'
    },
    
    {
      tab: 's5',
      selector: '.tab[data-target-sec="s5"]',
      icon: 'i-pin',
      title: 'Tab 6: Pilot-Analyse',
      body: 'Die **KI analysiert Mikrolage, Infrastruktur, Wertentwicklung** und liefert einen ausfuehrlichen Lage-Bericht.',
      bodyMore: '**Was die Lage-KI prueft:**\n\n• **Mikrolage** — Verkehrsanbindung, Infrastruktur, Nachbarschaft\n• **Mieterstruktur** — Einkommensniveau, Beruf\n• **Wertentwicklung** — historisch + Prognose\n• **Risikofaktoren** — Leerstand, Gentrifizierung\n• **Vergleichsobjekte** im Umkreis\n\nErgebnis: ein **Lage-Score (0-100)** + ausfuehrlicher Text fuer deine Bank-Praesentation.\n\nKostet KI-Credits — auf Pro-Plan unlimited.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '.tab[data-target-sec="s6"]',
      icon: 'i-gauge',
      title: 'Tab 7: Bewertung',
      body: 'Der **wichtigste Tab** fuer Banker: DSCR, LTV, Wertpuffer, DealScore, Stress-Test — alles in einem Cockpit.',
      bodyMore: '**Die Kernbestandteile:**\n\n• **Bewertungs-Cockpit** mit DSCR + LTV im Verlauf (15 Jahre)\n• **DealScore 0-100** als Gesamtbewertung\n• **Investor Deal Score** mit 32 KPIs (Starter+)\n• **Stress-Test** mit 4 Szenarien\n• **Cashflow-Tabelle** ueber 10 Jahre\n• **Werbungskosten-Anlage** fuer Finanzamt\n\nHier verbringst du beim Endcheck die meiste Zeit. Alle Zahlen synchronisieren live mit den anderen Tabs.',
      placement: 'auto'
    },
    
    // ═══ Phase 4: Bewertungs-Cockpit-Details ══════════════════════════
    
    {
      tab: 's6',
      selector: '#dealscore-card, #bc-cockpit svg.ds-donut',
      icon: 'i-percent',
      title: 'DealScore 0-100',
      body: 'Der **DealScore** fasst alle 8 Kennzahlen in einer Zahl zusammen — schnellster Vergleichswert.',
      bodyMore: 'Der DealScore kombiniert 8 Kennzahlen:\n\n• Cashflow nach Steuern\n• Nettomietrendite\n• Bruttomietrendite\n• DSCR (Schuldendeckung)\n• LTV (Beleihungsauslauf)\n• EK-Rendite p.a.\n• Vermoegenszuwachs ueber 10 Jahre\n• Wertpuffer / Sicherheitsreserve\n\n**Skala:**\n• **80-100** Ausgezeichnet — klare Kauf-Empfehlung\n• **60-79** Gut — sorgfaeltig pruefen\n• **40-59** Mittel — Vorsicht\n• **unter 40** Schwach — eher ablehnen\n\nDealScore ist objektspezifisch — derselbe Deal kann fuer verschiedene Investoren unterschiedlich gut sein.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '#dealscore2-card, .ds2-card',
      icon: 'i-cpu',
      title: 'Investor Deal Score',
      body: 'Der **Investor Deal Score** ist die erweiterte Bewertung mit **32 statt 8 KPIs** — verfuegbar ab **Starter-Plan**.',
      bodyMore: '**Was der Investor Score zusaetzlich prueft:**\n\n• Vermoegens-Multiplikator (Equity Multiple)\n• Cash-on-Cash-Return\n• Net Operating Income (NOI)\n• Cap Rate\n• Sensitivitaeten (Zins, Miete, Marktwert)\n• 19 weitere Kennzahlen\n\n**Wo finden:**\n• Im Tab Bewertung als eigene Cockpit-Karte (gerade gespotlightet)\n• Im Header oben rechts: Toggle-Button "Investor Deal Score" ein/aus\n\n**Plan-Verfuegbarkeit:**\n• **Free**: Nur Basis-DealScore (8 Kennzahlen)\n• **Starter & hoeher**: Investor Score mit 32 Kennzahlen\n• **Pro**: Plus Custom-Gewichtungen + Profile speichern\n\nFuer Banker und ernsthafte Investoren ist der Investor Deal Score Pflicht — er zeigt Aspekte die der Basis-Score nicht abdeckt.',
      placement: 'center'
    },
    
    {
      tab: 's6',
      selector: '#bc-cockpit',
      icon: 'i-gauge',
      title: 'Bewertungs-Cockpit',
      body: '**DSCR & LTV im 15-Jahres-Verlauf** — was die Bank zuerst sieht.',
      bodyMore: '**DSCR (Schuldendienstdeckung):**\n• ueber 1,2 = solide\n• 1,0-1,2 = knapp\n• unter 1,0 = kritisch\n\n**LTV (Beleihungsauslauf):**\n• unter 85% = solide, beste Konditionen\n• 85-100% = erhoehter Zins\n• ueber 100% = Vollfinanzierung, schwierig\n\n**Wertpuffer:** Differenz Verkehrswert vs. Kaufpreis. Je groesser, desto mehr Sicherheit.\n\nDie Bank schaut sich zuerst diese Zahlen an, bevor sie ueberhaupt das Objekt anschaut.',
      placement: 'auto'
    },
    
    {
      tab: 's6',
      selector: '#bc-stress',
      icon: 'i-cpu',
      title: 'Stress-Test',
      body: 'Was passiert wenn **Zinsen steigen** oder **Miete ausfaellt**? Der Stress-Test simuliert es.',
      bodyMore: 'Standard-Szenarien:\n\n• **Anschlusszins +2 Prozentpunkte** — was kostet das Darlehen in 10 Jahren?\n• **Mietausfall 3 Monate** — bleibt der Cashflow stabil?\n• **Leerstand 10 %** dauerhaft — kippt die Finanzierung?\n• **Marktwertverlust 15 %** — wie steht der LTV dann?\n\nFuer jedes Szenario zeigt DealPilot den **neuen DSCR** und ob die Finanzierung weiter traegt. **Banken lieben diese Analyse** — sie zeigt dass du das Risiko verstanden hast. Print direkt mit ins Business-Case-PDF.',
      placement: 'auto'
    },

    // ═══ Phase 5: Deal-Aktion ═════════════════════════════════════════
    
    {
      tab: 's8',
      selector: '.tab[data-target-sec="s8"]',
      icon: 'i-flag',
      title: 'Tab 8: Deal-Aktion',
      body: 'Hier fuehrst du den Deal zum **Abschluss**: Bankanfrage, Beratung, PDF, Zuschlag.',
      bodyMore: 'Der Deal-Aktion-Tab strukturiert deinen kompletten Kaufprozess in 3 Stages:\n\n**Stage 1: Deal pruefen**\n• Bonitaet klaeren\n• Bankanfrage starten\n• Steuer-/Rechtsberatung anfragen\n\n**Stage 2: Deal verhandeln**\n• Gutachten anfragen\n• Verhandlungs-Strategie\n• Business-Case-PDF an Bank\n\n**Stage 3: Deal abschliessen**\n• Zuschlag bekommen (Stern setzen)\n• Notartermin\n• Schluesseluebergabe',
      placement: 'auto'
    },
    
    {
      tab: 's8',
      selector: '.da-stage-1, .da-stage',
      icon: 'i-help',
      title: 'Kontakt aufnehmen',
      body: 'Direkt aus DealPilot kannst du **Bank, Steuerberater oder Anwalt anschreiben** — mit Business-Case angehaengt.',
      bodyMore: 'Wer hilft dir beim Deal-Abschluss?\n\n• **Finanzierungsberater** — Vergleich mehrerer Banken\n• **Steuerberater** — AfA-Aufteilung, Sonder-AfA, Finanzamt\n• **Rechtsanwalt** — Kaufvertrag, Teilungserklaerung\n• **Sachverstaendiger** — Verkehrswertgutachten\n\nDealPilot bietet **vorausgefuellte Mail-Templates** mit den wichtigsten Eckdaten + Business-Case als Anhang. Du musst nur noch absenden.\n\nBei mehreren parallelen Bank-Anfragen helfen dir die **Pflicht-Dokumente-Listen** den Ueberblick zu behalten.',
      placement: 'auto'
    },
    
    {
      tab: 'header',
      selector: '.hdr-pdf-btn, button[onclick*="exportPDF"]',
      icon: 'i-file-text',
      title: 'Investment-PDF',
      body: 'Der **Investment-PDF-Button oben rechts im Header** (gespotlightet) erstellt das bank-fertige Investment-PDF mit allen aktuellen Daten.',
      bodyMore: '**Wo finden:** Sidebar links unter "Aktionen" -> "Business-Case-PDF". Oder direkt im Deal-Aktion-Tab.\n\n**Wie generieren:** Ein Klick. DealPilot baut das PDF mit allen aktuellen Daten und oeffnet einen Download-Link. Dauer 5-30 Sekunden.\n\n**Was drin ist:**\n• Deckblatt mit Objektfotos + Eckdaten\n• Investitionsuebersicht\n• Cashflow-Tabelle ueber 10 Jahre\n• DSCR + LTV + Wertpuffer als Cockpit\n• Stress-Test-Szenarien\n• KI-Lagebewertung als Volltext\n• Werbungskosten-Anlage fuer Finanzamt\n\n**Tipp vor PDF-Export:** Alle Pflichtfelder checken (rot markiert).\n\nPro-Plan: **eigenes Logo + Footer + Impressum**.',
      placement: 'auto'
    },
    
    {
      tab: 's8',
      selector: '.da-won-card, #da-won-card, #da-won-star',
      icon: 'i-check',
      title: 'Deal abschliessen',
      body: 'Wenn du den **Zuschlag** bekommst: klicke auf den Stern. DealPilot markiert das Objekt als "Gekauft".',
      bodyMore: 'Was passiert beim Klick auf den Stern:\n\n• Objekt-Status wechselt von "in Pruefung" auf **"gekauft"**\n• In der Sidebar erscheint ein gruener Marker\n• Portfolio-Uebersicht zaehlt das Objekt jetzt zum Bestand\n• Cashflow + Tilgung fliessen in dein **Gesamt-Portfolio**\n• Sonder-AfA-Periode startet automatisch (falls anwendbar)\n\nDu kannst spaeter weiter Daten ergaenzen (Notartermin, Schluesseluebergabe, erste Mieteinnahme).\n\n**Tipp:** Auch nicht-erfolgte Deals als "verloren" markieren — DealPilot lernt daraus welche Objekte du verpasst hast.',
      placement: 'auto'
    },

    // ═══ Phase 6: Tool-Tips + Hilfe ════════════════════════════════════
    
    {
      tab: 'sidebar',
      selector: '#sb-actions-accordion',
      icon: 'i-help',
      title: 'Tool-Tips: Anfaenger, Profi oder Aus?',
      body: 'DealPilot zeigt **Tool-Tips** bei vielen Feldern (kleine ?-Icons). Welcher Modus passt zu dir? **Probier es direkt aus:**',
      bodyMore: 'Den Schalter findest du jederzeit in den Einstellungen unter "Profil & Anzeige".\n\n**Anfaenger** (Standard):\n• ALLE Tooltips eingeblendet\n• Inkl. Erklaerungen fuer DSCR, AfA, BSV, IRR\n• Beispiele und Standardwerte\n• Ideal beim Einarbeiten\n\n**Profi:**\n• Nur kritische Hinweise (z.B. § 7b Sonder-AfA, 15%-Regel)\n• Anfaenger-Erklaerungen ausgeblendet\n• Kompakter Look\n\n**Aus:**\n• Keine Tooltips\n• Maximal aufgeraeumte UI\n• Du kennst alles auswendig\n\nDu kannst jederzeit zwischen den Modi wechseln.',
      placement: 'center',
      customAction: 'tooltip-mode'
    },

    {
      tab: 'header',
      selector: 'button.hdr-icon-btn[title="Hilfe"], button[onclick*="showHelp"]',
      icon: 'i-bulb',
      title: 'Hilfe immer dabei',
      body: 'Du hast es geschafft! Klick auf das **Hilfe-Icon oben rechts** — dort findest du alles was du brauchst.',
      bodyMore: '**Tour nochmal starten:**\n• Klicke auf das Hilfe-Icon oben rechts (Fragezeichen in Gold)\n• Im Hilfe-Modal: Button "Einfuehrungs-Tour starten"\n\n**Was du im Hilfe-Modal findest:**\n\n• **Glossar** mit 29 Finanzbegriffen (DSCR, AfA, BSV, IRR, Sonder-§7b ...)\n• **KI-Assistent** fuer DealPilot-Fragen und Investment-Beratung\n• **Anleitungen** fuer PDF-Export, Stripe-Setup, Plan-Wechsel\n• **Tipps & Tricks**\n• **Kontakt** zu Junker Immobilien\n\n**Hinweis:** Das gelbe Badge mit Prozent daneben ist der **Workflow-Fortschritt** — zeigt wie viele Tabs du schon ausgefuellt hast.\n\nViel Erfolg mit deinen Investments — denk dran: **ein guter Deal ist halb verhandelt, der Rest ist Bewertung.**',
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
      bodyMore: 'Was die Sidebar dir kuenftig zeigt:\n\n• **Jedes Objekt** mit DealScore-Ampel\n• **Portfolio-Uebersicht** mit Gesamt-Cashflow\n• **Such- und Filter-Funktion**\n• **Demo-Objekte** zum Ueben (deine ersten Tutorial-Objekte)\n\n**Plan-Limits:**\n• Free: 3 Objekte\n• Starter: 15\n• Investor: 50\n• Pro: unlimited\n\nLass uns mit dem **Quick-Check** starten — dem schnellsten Weg ein Objekt zu bewerten.',
      placement: 'right'
    },
    
    {
      tab: 'sidebar',
      selector: '.sb-act-accent[onclick*="quickcheck"], button[onclick*="sbActionsAction(\'quickcheck\')"]',
      icon: 'i-flame',
      title: 'Starte mit Quick-Check',
      body: '**Klick auf Quick-Check** in der Sidebar — die schnellste Erstbewertung in 60 Sekunden.',
      bodyMore: 'Der Quick-Check ist dein **schnellster Einstieg**:\n\n**Was du brauchst:**\n• PLZ + Strasse\n• Wohnflaeche\n• Kaufpreis\n• Nettokaltmiete\n\n**Was du bekommst:**\n• Bruttomietrendite\n• Vorlaeufigen DealScore (0-100)\n• Erste Lage-Einschaetzung\n\n**Ideal fuer:**\n• Inseraten-Sichten\n• Mailings vom Makler\n• Erste Sondierung\n\nVielversprechende Objekte uebernimmst du dann mit einem Klick in die Vollanalyse mit 8 Tabs.',
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

  // Kompatibilitaet: alte DpTourSteps-Property zeigt auf withObjects als Default
  window.DpTourSteps = STEPS_WITH_OBJECTS;

})();
