/**
 * DealPilot V238.4 — Tour Steps (23 Steps)
 *
 * Aenderungen ggue V238.3:
 * - Alle 8 Tabs einzeln vorgestellt (Objekt, Investition, Miete, Finanzierung,
 *   Bewirtschaftung, KI-Analyse, Bewertung, Deal-Aktion)
 * - DealScore-Selektor praezisiert (svg.ds-donut im bc-cockpit)
 * - Won-Card als Container ZUERST (war: Star-Button)
 * - Kontakt = ganze Stage-1 ZUERST (war: nur Progress-Counter)
 * - Business-Case-PDF mit Wo/Wie/Tipp
 * - Letzter Step erklaert Tour-Restart via Hilfe-Modal
 */
(function() {
  'use strict';

  window.DpTourSteps = [
    // ═══ Quick-Check (3 Steps) ════════════════════════════════════════
    
    {
      tab: 's-quick',
      selector: '#qc-score-circle, .ds-donut, #qc-tab-host .qc-score-kpis',
      icon: 'i-flame',
      title: 'Willkommen bei DealPilot',
      body: 'Der **Quick-Check** ist deine schnellste Bewertung — in 60 Sekunden weisst du, ob ein Objekt eine tiefere Analyse lohnt.',
      bodyMore: 'Du brauchst nur: **PLZ, Strasse, Wohnflaeche, Kaufpreis und Nettokaltmiete**.\n\nDealPilot rechnet daraus sofort die wichtigsten Eckwerte:\n\n• **Bruttomietrendite** (Kaufpreis vs. Jahresmiete)\n• **Vorlaeufigen DealScore** als Ampel-Indikator\n• **Erste Lage-Einschaetzung** ueber die KI-Recherche\n\nIdeal beim Inseraten-Sichten oder Mailings vom Makler. Vielversprechende Objekte uebernimmst du dann mit einem Klick in die Vollanalyse.',
      placement: 'auto'
    },
    
    {
      tab: 's-quick',
      selector: '#qc-ai-research-btn',
      icon: 'i-brain',
      title: 'KI-Marktrecherche',
      body: 'Die KI sucht **automatisch** nach Vergleichsmieten und Bodenrichtwerten fuer deine PLZ — spart 20-30 Min manuelle Recherche.',
      bodyMore: 'Was die KI fuer dich macht:\n\n• **Vergleichsmieten** aus aktuellen Inseraten und Mietspiegel-Daten\n• **Bodenrichtwerte** ueber oeffentliche GAA-Datenbanken\n• **Mikrolage-Bewertung** (Infrastruktur, Anbindung, Mieterstruktur)\n• **Wertentwicklungs-Prognose** fuer die kommenden Jahre\n\nDas Ergebnis fliesst in DealScore und Plausibilitaetspruefung. Kostet KI-Credits je nach Plan — **Pro-User haben unlimited KI-Recherche**.',
      placement: 'auto'
    },
    
    {
      tab: 's-quick',
      selector: '#qc-save-btn',
      icon: 'i-piggy-bank',
      title: 'Vollanalyse starten',
      body: 'Vielversprechender Quick-Check? Mit einem Klick uebernimmst du alle Daten in die **Vollanalyse**.',
      bodyMore: 'Was beim Speichern passiert:\n\n• Alle Quick-Check-Daten landen in **Tab Objekt + Tab Investition + Tab Miete**\n• Wohnflaeche, Adresse, Baujahr werden vorbefuellt — kein doppeltes Tippen\n• Du landest direkt in der Vollanalyse und kannst Finanzierung, Bewirtschaftung etc. ergaenzen\n• Das Objekt erscheint dauerhaft in deiner **Sidebar links**\n\nFree-Plan: 3 gespeicherte Objekte. Pro-Plan: unlimited.',
      placement: 'auto'
    },

    // ═══ Tab-Bar Overview (1 Step) ════════════════════════════════════
    
    {
      tab: 's0',
      selector: '.tab[data-target-sec="s0"]',
      icon: 'i-layers',
      title: '8 Analyse-Tabs',
      body: 'Die Tab-Leiste fuehrt dich durch die komplette Bewertung. Schauen wir uns jeden Tab einzeln an.',
      bodyMore: 'Die naechsten Schritte zeigen dir nacheinander:\n\n• **Objekt** — Adresse, Wohnflaeche, Baujahr, Fotos\n• **Investition** — Kaufpreis, Nebenkosten, Sanierung\n• **Miete** — Nettokaltmiete, Hausgeld, Zusatzertraege\n• **Finanzierung** — Darlehen, Zinsbindung, Bausparvertrag\n• **Bewirtschaftung** — Instandhaltung, Mietausfall, Verwaltung\n• **KI-Analyse** — Lagebewertung, Marktvergleich\n• **Bewertung** — DSCR, LTV, DealScore, Stress-Test\n• **Deal-Aktion** — Bank-Anfrage, PDF, Zuschlag\n\n**Haekchen an den Tabs** zeigen Fortschritt. Reihenfolge ist frei — DealPilot rechnet jederzeit neu.',
      placement: 'bottom'
    },

    // ═══ Tab 1: Objekt (s0) ═══════════════════════════════════════════
    
    {
      tab: 's0',
      selector: '.tab[data-target-sec="s0"]',
      icon: 'i-home',
      title: 'Tab: Objekt',
      body: 'Hier traegst du die **Stammdaten** ein: Adresse, Wohnflaeche, Baujahr, Etage, Zimmer, Fotos.',
      bodyMore: '**Wichtigste Felder:**\n\n• **PLZ + Ort + Strasse** — fuer KI-Lagebewertung und Marktmiete-Recherche\n• **Wohnflaeche** — Basis fuer Euro/m2-Vergleiche und Sonder-AfA-Pruefung\n• **Baujahr** — bestimmt AfA-Satz (vor 1925 / 1925-2000 / nach 2000)\n• **Etage / Zimmer / Balkon / Keller** — Wertfaktoren fuer Lage-Score\n• **Bis zu 8 Fotos** — landen direkt im Business-Case-PDF\n\n**Tipp:** Adresse so genau wie moeglich — die KI braucht das fuer akkurate Bodenrichtwerte und Vergleichsmieten.',
      placement: 'auto'
    },
    
    // ═══ Pflichtfelder ═══
    
    {
      tab: 's0',
      selector: '#str',
      icon: 'i-flag',
      title: 'Pflichtfelder beachten',
      body: 'Felder mit **rotem Sternchen** sind Pflichtfelder. Ohne sie kein DealScore und kein PDF-Export.',
      bodyMore: 'Die 5 kritischen Pflichtfelder app-weit:\n\n• **Ort + Strasse** (Tab Objekt) — fuer Marktmiete-Recherche und Lage-Score\n• **Kaufpreis** (Tab Investition) — Basis aller Renditen\n• **Wohnflaeche** (Tab Objekt) — fuer Euro/m2-Vergleiche\n• **Nettokaltmiete** (Tab Miete) — Cashflow-Berechnung\n• **Eigenkapital + Darlehenssumme** (Tab Finanzierung)\n\n**Tipp:** Die Quick-Check-Daten werden beim Speichern automatisch in diese Felder uebernommen.',
      placement: 'auto'
    },

    // ═══ Tab 2: Investition (s1) ══════════════════════════════════════
    
    {
      tab: 's1',
      selector: '.tab[data-target-sec="s1"]',
      icon: 'i-coins',
      title: 'Tab: Investition',
      body: 'Hier definierst du den **Kaufpreis und die Nebenkosten** — die echten Anschaffungskosten deines Investments.',
      bodyMore: '**Was hier rein gehoert:**\n\n• **Kaufpreis** — wie verhandelt\n• **Grunderwerbsteuer** — automatisch nach Bundesland (3,5% - 6,5%)\n• **Notar + Grundbuch** — typisch 1,5-2%\n• **Maklerprovision** — wenn vorhanden\n• **Sanierungskosten** — geplante Modernisierungen mit AfA-Wirkung\n• **Aufteilung Boden / Gebaeude** — wichtig fuer AfA\n\nDealPilot rechnet automatisch:\n• Gesamtinvestition\n• AfA-Basis pro Jahr\n• Sonder-AfA-Berechtigung (§7b)',
      placement: 'auto'
    },

    // ═══ Tab 3: Miete (s2) ════════════════════════════════════════════
    
    {
      tab: 's2',
      selector: '.tab[data-target-sec="s2"]',
      icon: 'i-euro',
      title: 'Tab: Miete',
      body: 'Hier traegst du die **Einnahmen-Seite** ein: Nettokaltmiete und Zusatzertraege.',
      bodyMore: '**Was hier rein gehoert:**\n\n• **Nettokaltmiete / Monat** (Pflichtfeld)\n• **Mietsteigerung p.a.** — Default 1,5% (Inflation)\n• **Leerstandsquote** — Default 3% (durchschnittliches Risiko)\n• **Hausgeld umlagefaehig** — Anteil den Mieter zahlt\n• **Zusatzertraege** — Garage, Stellplatz, moeblierte Vermietung\n\n**Wichtig:** Hier IMMER **Netto-Kalt-Miete** ohne Heizkosten, ohne Nebenkosten. Die echte Einnahme vor Hausgeld-Abzug.',
      placement: 'auto'
    },

    // ═══ Tab 4: Finanzierung (s3) ═════════════════════════════════════
    
    {
      tab: 's3',
      selector: '.tab[data-target-sec="s3"]',
      icon: 'i-bank',
      title: 'Tab: Finanzierung',
      body: 'Hier baust du **dein Darlehen** — auch komplexe Setups mit mehreren Darlehen und Bausparvertraegen.',
      bodyMore: '**Was DealPilot kann:**\n\n• **Hauptdarlehen** mit Zinsbindung 5/10/15/20/30 Jahre\n• **Zusatzdarlehen** fuer KfW-Foerderprogramme oder Familiendarlehen\n• **Bausparvertrag (BSV)** als Tilgungsersatz oder Anschluss-Sicherung\n• **Tilgungssatz** frei waehlbar (1-10 % p.a.)\n• **Anschlusszins-Szenario** fuer Stress-Test (Default 5,0 %)\n• **Sondertilgungen** moeglich\n\nDie DSCR-Berechnung beruecksichtigt automatisch alle aktiven Darlehen — sogar Bausparraten fliessen mit ein. **Single Source of Truth** fuer alle Bewertungsstellen.',
      placement: 'auto'
    },

    // ═══ Tab 5: Bewirtschaftung (s4) ══════════════════════════════════
    
    {
      tab: 's4',
      selector: '.tab[data-target-sec="s4"]',
      icon: 'i-settings',
      title: 'Tab: Bewirtschaftung',
      body: 'Hier definierst du **die laufenden Kosten** als Eigentuemer — Hausgeld, Instandhaltung, Verwaltung.',
      bodyMore: '**Was hier rein gehoert:**\n\n• **Hausgeld (nicht umlagefaehig)** — Verwaltungskosten + Ruecklagen\n• **Instandhaltung** — typisch 0,8-1,2 % des Gebaeudewerts p.a.\n• **Mietausfallwagnis** — Default 2% von Kaltmiete\n• **Property-Management** — falls Hausverwalter (typ. 4-8% Kaltmiete)\n• **Versicherung** — Wohngebaeude, Haftpflicht\n\n**Wichtig:** Diese Kosten reduzieren deinen Cashflow direkt. Wer hier zu optimistisch rechnet, bekommt boese Ueberraschungen. **Konservativ schaetzen, kontrolliert hoch leben.**',
      placement: 'auto'
    },

    // ═══ Tab 6: KI-Analyse (s5) ═══════════════════════════════════════
    
    {
      tab: 's5',
      selector: '.tab[data-target-sec="s5"]',
      icon: 'i-pin',
      title: 'Tab: KI-Analyse',
      body: 'Die KI analysiert **Mikrolage, Infrastruktur, Wertentwicklung** und liefert einen ausfuehrlichen Lage-Bericht.',
      bodyMore: '**Was die Lage-KI prueft:**\n\n• **Mikrolage** — Verkehrsanbindung, Infrastruktur, Nachbarschaft\n• **Mieterstruktur** — Einkommensniveau, Beruf, Familienstand-Verteilung\n• **Wertentwicklung** — historische Preisentwicklung + Prognose\n• **Risikofaktoren** — Leerstand, Gentrifizierung, geplante Bauprojekte\n• **Vergleichsobjekte** im Umkreis\n\nErgebnis: ein **Lage-Score (0-100)** + ausfuehrlicher Text fuer deine Bank-Praesentation. Der Score fliesst in den DealScore mit ein.\n\n**Kostet KI-Credits** — auf Pro-Plan unlimited.',
      placement: 'auto'
    },

    // ═══ Tab 7: Bewertung (s6) ════════════════════════════════════════
    
    {
      tab: 's6',
      selector: '.tab[data-target-sec="s6"]',
      icon: 'i-gauge',
      title: 'Tab: Bewertung',
      body: 'Der wichtigste Tab fuer Banker: **DSCR, LTV, Wertpuffer, DealScore, Stress-Test** — alles in einem Cockpit.',
      bodyMore: '**Die Kernbestandteile:**\n\n• **Bewertungs-Cockpit** mit DSCR + LTV im Verlauf (15 Jahre)\n• **DealScore 0-100** als Gesamtbewertung\n• **Investor-Profil** fuer Score-Gewichtung\n• **Stress-Test** mit 4 Szenarien\n• **Cashflow-Tabelle** ueber 10 Jahre\n• **Werbungskosten-Anlage** fuer Finanzamt\n\nDieser Tab ist die **Bewertungs-Heimat** — hier verbringst du beim Endcheck die meiste Zeit. Alle Zahlen synchronisieren live mit den anderen Tabs.',
      placement: 'auto'
    },
    
    // ═══ Cockpit-Detail ═══
    
    {
      tab: 's6',
      selector: '#bc-cockpit',
      icon: 'i-gauge',
      title: 'Bewertungs-Cockpit',
      body: '**DSCR & LTV im 15-Jahres-Verlauf** — was die Bank zuerst sieht.',
      bodyMore: '**DSCR (Schuldendienstdeckung):**\n• ueber 1,2 = solide, Bank ist zufrieden\n• 1,0-1,2 = knapp, mehr Eigenkapital empfohlen\n• unter 1,0 = kritisch, Finanzierung kippt\n\n**LTV (Beleihungsauslauf):**\n• unter 85% = solide, beste Konditionen\n• 85-100% = erhoehter Zins\n• ueber 100% = Vollfinanzierung, schwierig\n\n**Wertpuffer:** Differenz Verkehrswert vs. Kaufpreis. Je groesser, desto mehr Sicherheit bei Marktverlusten.\n\nDie Bank schaut sich zuerst diese Zahlen an, bevor sie ueberhaupt das Objekt anschaut.',
      placement: 'auto'
    },
    
    // ═══ DealScore ═══
    
    {
      tab: 's6',
      selector: '#bc-cockpit svg.ds-donut, #bc-cockpit .ds-donut',
      icon: 'i-percent',
      title: 'DealScore 0-100',
      body: 'Der **DealScore** fasst alle Kennzahlen in einer Zahl zusammen — schnellster Vergleichswert zwischen Objekten.',
      bodyMore: 'Der DealScore kombiniert 8 Kennzahlen zu einer Gesamtbewertung:\n\n• Cashflow nach Steuern\n• Nettomietrendite\n• Bruttomietrendite\n• DSCR (Schuldendeckung)\n• LTV (Beleihungsauslauf)\n• EK-Rendite p.a.\n• Vermoegenszuwachs ueber 10 Jahre\n• Wertpuffer / Sicherheitsreserve\n\n**Skala:**\n• **80-100** Ausgezeichnet — klare Kauf-Empfehlung\n• **60-79** Gut — sorgfaeltig pruefen, Verhandlungspotenzial\n• **40-59** Mittel — Vorsicht, nur mit klarer Strategie\n• **unter 40** Schwach — eher ablehnen\n\nDealScore ist objektspezifisch — derselbe Deal kann fuer verschiedene Investoren unterschiedlich gut sein.',
      placement: 'auto'
    },
    
    // ═══ Investor-Profil ═══
    
    {
      tab: 'settings',
      selector: 'button[onclick*="sbActionsAction(\'settings\')"], .sb-act-item[onclick*="settings"]',
      icon: 'i-percent',
      title: 'Investor-Profil',
      body: 'In den **Einstellungen** passt du die DealScore-Gewichtung an dein Investor-Typ an.',
      bodyMore: 'Drei Investor-Profile zur Auswahl:\n\n• **Cashflow-Investor** — Cashflow + Nettomietrendite hoeher gewichtet. Du willst monatlich Geld auf dem Konto sehen.\n• **Wertsteigerungs-Investor** — Vermoegenszuwachs + EK-Rendite + Wertpuffer hoeher. Du baust langfristig Vermoegen auf.\n• **Sicherheits-Investor** — DSCR + LTV + Wertpuffer hoeher. Du willst maximale Risiko-Abdeckung.\n\nOder du erstellst dein **eigenes Profil** mit individueller Gewichtung jeder der 8 Kennzahlen.\n\nDie Gewichtung beeinflusst nur deinen DealScore-Wert — nicht die Berechnung der einzelnen Kennzahlen.',
      placement: 'auto'
    },
    
    // ═══ Stress-Test ═══
    
    {
      tab: 's6',
      selector: '#bc-stress',
      icon: 'i-cpu',
      title: 'Stress-Test',
      body: 'Was passiert wenn **Zinsen steigen** oder **Miete ausfaellt**? Der Stress-Test simuliert es.',
      bodyMore: 'Standard-Szenarien:\n\n• **Anschlusszins +2 Prozentpunkte** — was kostet das Darlehen in 10 Jahren?\n• **Mietausfall 3 Monate** — bleibt der Cashflow stabil?\n• **Leerstand 10 %** dauerhaft — kippt die Finanzierung?\n• **Marktwertverlust 15 %** — wie steht der LTV dann?\n\nFuer jedes Szenario zeigt DealPilot den **neuen DSCR** und ob die Finanzierung weiter traegt. Banken lieben diese Analyse — sie zeigt dass du das Risiko verstanden hast. **Print direkt mit ins Business-Case-PDF.**',
      placement: 'auto'
    },

    // ═══ Tab 8: Deal-Aktion (s8) ══════════════════════════════════════
    
    {
      tab: 's8',
      selector: '.tab[data-target-sec="s8"]',
      icon: 'i-flag',
      title: 'Tab: Deal-Aktion',
      body: 'Im **Tab Deal-Aktion** fuehrst du den Deal zum Abschluss: Bankanfrage, Beratung, PDF-Export, Zuschlag.',
      bodyMore: 'Der Deal-Aktion-Tab strukturiert deinen kompletten Kaufprozess in 3 Stages:\n\n**Stage 1: Deal pruefen**\n• Bonitaet klaeren\n• Bankanfrage starten (Pflicht-Dokumente sammeln)\n• Steuer-/Rechtsberatung anfragen\n\n**Stage 2: Deal verhandeln**\n• Gutachten anfragen\n• Verhandlungs-Strategie\n• Business-Case-PDF an Bank\n\n**Stage 3: Deal abschliessen**\n• Zuschlag bekommen (Stern setzen)\n• Notartermin\n• Schluesseluebergabe\n\nAlle Aktionen sind direkt aus diesem Tab erreichbar — kein Tab-Wechsel mehr.',
      placement: 'bottom'
    },
    
    // ═══ Stage 1 Bank-Anfrage / Kontakt ═══
    
    {
      tab: 's8',
      selector: '.da-stage-1, .da-stage',
      icon: 'i-help',
      title: 'Kontakt aufnehmen',
      body: 'Direkt aus DealPilot kannst du **Bank, Steuerberater oder Anwalt anschreiben** — mit Business-Case angehaengt.',
      bodyMore: 'Wer hilft dir beim Deal-Abschluss?\n\n• **Finanzierungsberater** — Vergleich mehrerer Banken, beste Konditionen finden\n• **Steuerberater** — AfA-Aufteilung, Sonder-AfA-Pruefung, Finanzamt-Anmeldung\n• **Rechtsanwalt** — Kaufvertrag pruefen, Teilungserklaerung verstehen\n• **Sachverstaendiger** — Verkehrswertgutachten erstellen\n\nDealPilot bietet **vorausgefuellte Mail-Templates** mit den wichtigsten Eckdaten + Business-Case als Anhang. Du musst nur noch absenden.\n\nBei mehreren parallelen Bank-Anfragen helfen dir die **Pflicht-Dokumente-Listen** den Ueberblick zu behalten.',
      placement: 'auto'
    },
    
    // ═══ Business-Case-PDF ═══
    
    {
      tab: 's8',
      selector: '[data-feature="bank_pdf_a3"], .sb-act-item[data-feature="bank_pdf_a3"]',
      icon: 'i-file-text',
      title: 'Business-Case-PDF',
      body: 'Das **Business-Case-PDF** ist deine bank-fertige Praesentation des Investments — in 30 Sekunden generiert.',
      bodyMore: '**Wo finden:** Sidebar links unter "Aktionen" -> "Business-Case-PDF". Oder direkt im Deal-Aktion-Tab.\n\n**Wie generieren:** Ein Klick. DealPilot baut das PDF mit allen aktuellen Daten und oeffnet einen Download-Link. Dauer 5-30 Sekunden je nach Objektgroesse.\n\n**Was drin ist:**\n• Deckblatt mit Objektfotos + Eckdaten\n• Investitionsuebersicht (KP + KNK + Sanierung)\n• Cashflow-Tabelle ueber 10 Jahre\n• DSCR + LTV + Wertpuffer als Cockpit\n• Stress-Test-Szenarien\n• KI-Lagebewertung als Volltext\n• Werbungskosten-Anlage fuer Finanzamt\n\n**Tipp vor PDF-Export:** Alle Pflichtfelder checken (rot markiert). Sonst sind Luecken im PDF.\n\nPro-Plan: **eigenes Logo + Footer + Impressum**.',
      placement: 'auto'
    },
    
    // ═══ Won-Card Deal abschliessen ═══
    
    {
      tab: 's8',
      selector: '.da-won-card, #da-won-card, #da-won-star',
      icon: 'i-check',
      title: 'Deal abschliessen',
      body: 'Wenn du den **Zuschlag** bekommst: klicke auf den Stern. DealPilot markiert das Objekt als "Gekauft".',
      bodyMore: 'Was passiert beim Klick auf den Stern:\n\n• Objekt-Status wechselt von "in Pruefung" auf **"gekauft"**\n• In der Sidebar erscheint ein gruener Marker\n• Portfolio-Uebersicht zaehlt das Objekt jetzt zum Bestand\n• Cashflow + Tilgung fliessen in dein **Gesamt-Portfolio**\n• Sonder-AfA-Periode startet automatisch (falls anwendbar)\n\nDu kannst spaeter weiter Daten ergaenzen (Notartermin, Schluesseluebergabe, erste Mieteinnahme).\n\n**Tipp:** Auch nicht-erfolgte Deals als "verloren" markieren — DealPilot kann daraus lernen welche Objekte du verpasst hast und gibt bessere Empfehlungen.',
      placement: 'auto'
    },

    // ═══ Sidebar / Portfolio ══════════════════════════════════════════
    
    {
      tab: 'sidebar',
      selector: '#sidebar',
      icon: 'i-portfolio',
      title: 'Gespeicherte Objekte',
      body: 'In der **Sidebar links** findest du alle gespeicherten Objekte und dein Portfolio.',
      bodyMore: 'Was du hier hast:\n\n• **Alle Objekte** mit DealScore-Ampel auf einen Blick\n• **Portfolio-Uebersicht** — Gesamtwert, Gesamt-Cashflow, Durchschnitts-DSCR\n• **Such- und Filter-Funktion** nach Score, Lage, Plan\n• **Schnell-Wechsel** zwischen Objekten ohne Speichern-Klick\n• **Demo-Objekte** zum Ueben (loesch- und wiederherstellbar)\n\nLimits:\n• **Free**: 3 Objekte\n• **Starter**: 15 Objekte\n• **Investor**: 50 Objekte\n• **Pro**: unlimited',
      placement: 'auto'
    },

    // ═══ Hilfe (letzter Step mit Spotlight auf Hilfe-Badge) ═══════════
    
    {
      tab: 'header',
      selector: '#tabs-status-badge',
      icon: 'i-bulb',
      title: 'Hilfe immer dabei',
      body: 'Du hast es geschafft! Im **Hilfe-Menue** (oben rechts, gespotlightet) findest du jederzeit alles was du brauchst.',
      bodyMore: '**Tour nochmal starten:**\n• Klicke auf das gelbe Badge oben rechts\n• Im Hilfe-Modal links unten: "Einfuehrungs-Tour"\n• Oder Tastatur-Shortcut: ESC dann erneut auf das Badge\n\n**Was du im Hilfe-Modal findest:**\n\n• **Glossar** mit 29 Finanzbegriffen (DSCR, AfA, BSV, IRR, Sonder-§7b ...)\n• **KI-Assistent** fuer DealPilot-Fragen und Investment-Beratung\n• **Anleitungen** fuer PDF-Export, Stripe-Setup, Plan-Wechsel\n• **Tipps & Tricks** zur schnelleren Bewertung\n• **Kontakt** zu Junker Immobilien\n\nViel Erfolg mit deinen Investments — und denk dran: **ein guter Deal ist halb verhandelt, der Rest ist Bewertung.**',
      placement: 'auto'
    }
  ];
})();
