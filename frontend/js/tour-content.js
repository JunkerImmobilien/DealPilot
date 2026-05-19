/**
 * DealPilot V238.3 — Tour Steps (17 Steps)
 *
 * Neue Steps gegenueber V238.2:
 * - DealScore (eigener Step nach Cockpit)
 * - Investor-Profil (Score-Gewichtung in Settings)
 * - Deal-Aktion-Tab Uebersicht
 * - Business-Case-PDF (war "Investment-PDF" — neues Wording)
 * - Kontakt-Button (Mail an Bank etc.)
 * - Deal abschliessen (Won-Star)
 */
(function() {
  'use strict';

  window.DpTourSteps = [
    // ─── 1: Quick-Check ────────────────────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-score-circle, .ds-donut, #qc-tab-host .qc-score-kpis',
      icon: 'i-flame',
      title: 'Willkommen bei DealPilot',
      body: 'Der **Quick-Check** ist deine schnellste Bewertung — in 60 Sekunden weisst du, ob ein Objekt eine tiefere Analyse lohnt.',
      bodyMore: 'Du brauchst nur: **PLZ, Strasse, Wohnflaeche, Kaufpreis und Nettokaltmiete**.\n\nDealPilot rechnet daraus sofort die wichtigsten Eckwerte:\n\n• **Bruttomietrendite** (Kaufpreis vs. Jahresmiete)\n• **Vorlaeufigen DealScore** als Ampel-Indikator\n• **Erste Lage-Einschaetzung** ueber die KI-Recherche\n\nIdeal beim Inseraten-Sichten oder Mailings vom Makler. Vielversprechende Objekte uebernimmst du dann mit einem Klick in die Vollanalyse.',
      placement: 'auto'
    },

    // ─── 2: KI-Recherche ───────────────────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-ai-research-btn',
      icon: 'i-brain',
      title: 'KI-Marktrecherche',
      body: 'Die KI sucht **automatisch** nach Vergleichsmieten und Bodenrichtwerten fuer deine PLZ.',
      bodyMore: 'Was die KI fuer dich macht:\n\n• **Vergleichsmieten** aus aktuellen Inseraten und Mietspiegel-Daten\n• **Bodenrichtwerte** ueber oeffentliche GAA-Datenbanken\n• **Mikrolage-Bewertung** (Infrastruktur, Anbindung, Mieterstruktur)\n• **Wertentwicklungs-Prognose** fuer die kommenden Jahre\n\nDas Ergebnis fliesst in DealScore und Plausibilitaetspruefung. Kostet KI-Credits je nach Plan — **Pro-User haben unlimited KI-Recherche**.',
      placement: 'auto'
    },

    // ─── 3: Speichern ──────────────────────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-save-btn',
      icon: 'i-piggy-bank',
      title: 'Vollanalyse starten',
      body: 'Vielversprechender Quick-Check? Mit einem Klick uebernimmst du alle Daten in die **9-Tab-Vollanalyse**.',
      bodyMore: 'Was beim Speichern passiert:\n\n• Alle Quick-Check-Daten landen in **Tab Objekt + Tab Investition + Tab Miete**\n• Wohnflaeche, Adresse, Baujahr werden vorbefuellt — kein doppeltes Tippen\n• Du landest direkt in der Vollanalyse und kannst Finanzierung, Bewirtschaftung etc. ergaenzen\n• Das Objekt erscheint dauerhaft in deiner **Sidebar links**\n\nFree-Plan: 3 gespeicherte Objekte. Pro-Plan: unlimited.',
      placement: 'auto'
    },

    // ─── 4: Tab-Bar ────────────────────────────────────────────────
    {
      tab: 's0',
      selector: '.tab[data-target-sec="s0"]',
      icon: 'i-layers',
      title: '9 Analyse-Tabs',
      body: 'Die Tabs fuehren dich Schritt fuer Schritt durch die komplette Bewertung. **Haekchen** zeigen Fortschritt.',
      bodyMore: 'Die 9 Tabs im Detail:\n\n**1. Objekt** — Adresse, Wohnflaeche, Baujahr, Fotos\n**2. Investition** — Kaufpreis, KNK, Sanierung\n**3. Miete** — Kaltmiete, Bewirtschaftungskosten, Zusatzertraege\n**4. Finanzierung** — Darlehen, Zinsbindung, BSV-Optionen\n**5. KI-Analyse** — Lagebewertung, Marktvergleich\n**6. Bewertung** — DSCR, LTV, DealScore, Stress-Test\n**7. Charts** — Cashflow-Waterfall, Equity-Build\n**8. Bewirtschaftung** — Hausgeld, Instandhaltung\n**9. Deal-Aktion** — Bank-Anfrage, PDF, Zuschlag\n\nReihenfolge ist frei — DealPilot berechnet jederzeit neu.',
      placement: 'auto'
    },

    // ─── 5: Pflichtfelder ──────────────────────────────────────────
    {
      tab: 's0',
      selector: '#str',
      icon: 'i-flag',
      title: 'Pflichtfelder',
      body: 'Felder mit **rotem Sternchen** sind Pflichtfelder. Ohne sie kein DealScore.',
      bodyMore: 'Die 5 kritischen Pflichtfelder:\n\n• **Ort + Strasse** — fuer Marktmiete-Recherche und Lage-Score\n• **Kaufpreis** — Basis aller Renditen\n• **Wohnflaeche** — fuer Euro/m2-Vergleiche und Sonder-AfA-Pruefung\n• **Nettokaltmiete** — Cashflow-Berechnung\n• **Eigenkapital + Darlehenssumme** — Finanzierungs-Struktur\n\n**Tipp:** Die Quick-Check-Daten werden beim Speichern automatisch in diese Felder uebernommen.',
      placement: 'auto'
    },

    // ─── 6: Finanzierung ───────────────────────────────────────────
    {
      tab: 's3',
      selector: '#d1',
      icon: 'i-bank',
      title: 'Darlehensstrukturierung',
      body: 'Hier baust du dein Darlehen — auch komplexe Setups mit **mehreren Darlehen + Bausparvertrag**.',
      bodyMore: 'Was DealPilot kann:\n\n• **Hauptdarlehen** mit Zinsbindung 10/15/20 Jahre\n• **Zusatzdarlehen** fuer KfW-Foerderprogramme oder Familiendarlehen\n• **Bausparvertrag (BSV)** als Tilgungsersatz oder Anschluss-Sicherung\n• **Tilgungssatz** frei waehlbar (1-10 % p.a.)\n• **Anschlusszins-Szenario** fuer Stress-Test (Default 5,0 %)\n\nDie DSCR-Berechnung beruecksichtigt automatisch alle aktiven Darlehen — sogar Bausparraten fliessen mit ein. **Single Source of Truth** fuer alle Bewertungsstellen.',
      placement: 'auto'
    },

    // ─── 7: KI-Lagebewertung ───────────────────────────────────────
    {
      tab: 's5',
      selector: '.tab[data-target-sec="s5"]',
      icon: 'i-pin',
      title: 'KI-Lagebewertung',
      body: 'Die KI analysiert **Mikrolage, Infrastruktur, Wertentwicklung** und liefert einen ausfuehrlichen Lage-Bericht.',
      bodyMore: 'Was die Lage-KI prueft:\n\n• **Mikrolage** — Verkehrsanbindung, Infrastruktur, Nachbarschaft\n• **Mieterstruktur** — Einkommensniveau, Beruf, Familienstand-Verteilung\n• **Wertentwicklung** — historische Preisentwicklung + Prognose\n• **Risikofaktoren** — Leerstand, Gentrifizierung, geplante Bauprojekte\n• **Vergleichsobjekte** im Umkreis\n\nErgebnis: ein **Lage-Score (0-100)** + ausfuehrlicher Text fuer deine Bank-Praesentation. Der Score fliesst in den DealScore mit ein.',
      placement: 'auto'
    },

    // ─── 8: Bewertungs-Cockpit ─────────────────────────────────────
    {
      tab: 's6',
      selector: '#bc-cockpit',
      icon: 'i-gauge',
      title: 'Bewertungs-Cockpit',
      body: '**DSCR, LTV, Wertpuffer** — die Kennzahlen, auf die deine Bank zuerst schaut.',
      bodyMore: 'Was hier visualisiert wird:\n\n• **DSCR** (Schuldendienstdeckung) — Ampel-Skala 1,2 solide / 1,0-1,2 knapp / unter 1,0 kritisch\n• **LTV** (Beleihungsauslauf) — unter 85% solide / 85-100% erhoeht / ueber 100% kritisch\n• **Wertpuffer** — Differenz Verkehrswert vs. Kaufpreis\n• **EK-Rendite p.a.** ueber 10 Jahre\n• **Equity Multiple** (Vermoegenszuwachs)\n\nDie Bank schaut sich zuerst diese Zahlen an, bevor sie ueberhaupt das Objekt anschaut.',
      placement: 'auto'
    },

    // ─── 9: DealScore (NEU) ────────────────────────────────────────
    {
      tab: 's6',
      selector: '#bc-cockpit .ds-donut, #bc-cockpit',
      icon: 'i-gauge',
      title: 'DealScore 0-100',
      body: 'Der **DealScore** fasst alle Kennzahlen in einer Zahl zusammen — schnellster Vergleichswert zwischen Objekten.',
      bodyMore: 'Der DealScore kombiniert 8 Kennzahlen zu einer Gesamtbewertung:\n\n• Cashflow nach Steuern\n• Nettomietrendite\n• Bruttomietrendite\n• DSCR (Schuldendeckung)\n• LTV (Beleihungsauslauf)\n• EK-Rendite p.a.\n• Vermoegenszuwachs ueber 10 Jahre\n• Wertpuffer / Sicherheitsreserve\n\n**Skala:**\n• **80-100** Ausgezeichnet — klare Kauf-Empfehlung\n• **60-79** Gut — sorgfaeltig pruefen, Verhandlungspotenzial\n• **40-59** Mittel — Vorsicht, nur mit klarer Strategie\n• **unter 40** Schwach — eher ablehnen\n\nDealScore ist objektspezifisch — selbst dasselbe Objekt kann fuer verschiedene Investoren unterschiedlich gut sein. Daher die Gewichtungen anpassbar (naechster Schritt).',
      placement: 'auto'
    },

    // ─── 10: Investor-Profil (NEU) ─────────────────────────────────
    {
      tab: 'settings',
      selector: 'button[onclick*="sbActionsAction(\'settings\')"], .sb-act-item[onclick*="settings"], [data-action="settings"]',
      icon: 'i-percent',
      title: 'Investor-Profil',
      body: 'In den **Einstellungen** kannst du die DealScore-Gewichtung anpassen — passt dein Score zu deinem Investor-Typ.',
      bodyMore: 'Drei Investor-Profile zur Auswahl:\n\n• **Cashflow-Investor** — Cashflow + Nettomietrendite hoeher gewichtet. Du willst monatlich Geld auf dem Konto sehen.\n• **Wertsteigerungs-Investor** — Vermoegenszuwachs + EK-Rendite + Wertpuffer hoeher. Du baust langfristig Vermoegen auf.\n• **Sicherheits-Investor** — DSCR + LTV + Wertpuffer hoeher. Du willst maximale Risiko-Abdeckung.\n\nOder du erstellst dein **eigenes Profil** mit individueller Gewichtung jeder der 8 Kennzahlen.\n\nWichtig: Die Gewichtung beeinflusst nur deinen DealScore-Wert — nicht die Berechnung der einzelnen Kennzahlen.',
      placement: 'auto'
    },

    // ─── 11: Stress-Test ───────────────────────────────────────────
    {
      tab: 's6',
      selector: '#bc-stress',
      icon: 'i-cpu',
      title: 'Stress-Test',
      body: 'Was passiert wenn **Zinsen steigen** oder **Miete ausfaellt**? Der Stress-Test simuliert es.',
      bodyMore: 'Standard-Szenarien:\n\n• **Anschlusszins +2 Prozentpunkte** — was kostet das Darlehen in 10 Jahren?\n• **Mietausfall 3 Monate** — bleibt der Cashflow stabil?\n• **Leerstand 10 %** dauerhaft — kippt die Finanzierung?\n• **Marktwertverlust 15 %** — wie steht der LTV dann?\n\nFuer jedes Szenario zeigt DealPilot den **neuen DSCR** und ob die Finanzierung weiter traegt. Banken lieben diese Analyse — sie zeigt dass du das Risiko verstanden hast. **Print direkt mit ins Business-Case-PDF.**',
      placement: 'auto'
    },

    // ─── 12: Deal-Aktion-Tab Übersicht (NEU) ────────────────────────
    {
      tab: 's8',
      selector: '.tab[data-target-sec="s8"]',
      icon: 'i-flag',
      title: 'Deal-Aktion',
      body: 'Im **Tab Deal-Aktion** fuehrst du den Deal zum Abschluss: Bankanfrage, Beratung, PDF-Export, Zuschlag.',
      bodyMore: 'Der Deal-Aktion-Tab strukturiert deinen kompletten Kaufprozess in 3 Stages:\n\n**Stage 1: Deal pruefen**\n• Bonitaet klaeren\n• Bankanfrage starten (Pflicht-Dokumente sammeln)\n• Steuer-/Rechtsberatung anfragen\n\n**Stage 2: Deal verhandeln**\n• Gutachten anfragen\n• Verhandlungs-Strategie\n• Business-Case-PDF an Bank\n\n**Stage 3: Deal abschliessen**\n• Zuschlag bekommen (Stern setzen)\n• Notartermin\n• Schluesseluebergabe\n\nAlle Aktionen sind direkt aus diesem Tab erreichbar — kein Tab-Wechsel mehr.',
      placement: 'auto'
    },

    // ─── 13: Business-Case-PDF (umbenannt) ──────────────────────────
    {
      tab: 's8',
      selector: '[data-feature="bank_pdf_a3"], .sb-act-item[data-feature="bank_pdf_a3"]',
      icon: 'i-file-text',
      title: 'Business-Case-PDF',
      body: 'Das **Business-Case-PDF** ist deine bank-fertige Praesentation des Investments — in 30 Sekunden generiert.',
      bodyMore: 'Was im Business Case drin ist:\n\n• **Deckblatt** mit Objektfotos und Eckdaten\n• **Investitionsuebersicht** (KP + KNK + Sanierung)\n• **Cashflow-Tabelle** ueber 10 Jahre\n• **DSCR + LTV + Wertpuffer** als Cockpit\n• **Stress-Test-Szenarien**\n• **KI-Lagebewertung** als Volltext\n• **Werbungskosten-Anlage** fuer Finanzamt\n\nPro-Plan: **eigenes Logo + Footer + Impressum**. Custom-Branding fuer Reseller verfuegbar. **Free-Plan** hat DealPilot-Wasserzeichen.\n\nBanker sagen oft: "Ein gutes Investment-PDF zeigt mir in 5 Minuten ob die Finanzierung machbar ist."',
      placement: 'auto'
    },

    // ─── 14: Kontakt-Button (NEU) ───────────────────────────────────
    {
      tab: 's8',
      selector: '#da-bank-progress, .da-stage-1, .da-stage',
      icon: 'i-help',
      title: 'Kontakt aufnehmen',
      body: 'Direkt aus DealPilot kannst du **Bank, Steuerberater oder Anwalt anschreiben** — mit Business-Case angehaengt.',
      bodyMore: 'Wer hilft dir beim Deal-Abschluss?\n\n• **Finanzierungsberater** — Vergleich mehrerer Banken, beste Konditionen finden\n• **Steuerberater** — AfA-Aufteilung, Sonder-AfA-Pruefung, Finanzamt-Anmeldung\n• **Rechtsanwalt** — Kaufvertrag pruefen, Teilungserklaerung verstehen\n• **Sachverstaendiger** — Verkehrswertgutachten erstellen\n\nDealPilot bietet **vorausgefuellte Mail-Templates** mit den wichtigsten Eckdaten + Business-Case als Anhang. Du musst nur noch absenden.\n\nBei mehreren parallelen Bank-Anfragen helfen dir die **Pflicht-Dokumente-Listen** den Ueberblick zu behalten.',
      placement: 'auto'
    },

    // ─── 15: Deal abschliessen (NEU - Won-Star) ─────────────────────
    {
      tab: 's8',
      selector: '#da-won-star, #da-won-card, .da-won-card',
      icon: 'i-check',
      title: 'Deal abschliessen',
      body: 'Wenn du den **Zuschlag** bekommst: klicke auf den Stern. DealPilot markiert das Objekt als "Gekauft".',
      bodyMore: 'Was passiert beim Klick auf den Stern:\n\n• Objekt-Status wechselt von "in Pruefung" auf **"gekauft"**\n• In der Sidebar erscheint ein gruener Pruefen-Marker\n• Portfolio-Uebersicht zaehlt das Objekt jetzt zum Bestand\n• Cashflow + Tilgung fliessen in dein **Gesamt-Portfolio**\n• Sonder-AfA-Periode startet automatisch (falls anwendbar)\n\nDu kannst spaeter weiter Daten ergaenzen (Notartermin, Schluesseluebergabe, erste Mieteinnahme).\n\n**Tipp:** Auch nicht-erfolgte Deals als "verloren" markieren — DealPilot kann daraus lernen welche Objekte du verpasst hast und gibt bessere Empfehlungen.',
      placement: 'auto'
    },

    // ─── 16: Sidebar / Portfolio ───────────────────────────────────
    {
      tab: 'sidebar',
      selector: '#sidebar',
      icon: 'i-portfolio',
      title: 'Gespeicherte Objekte',
      body: 'In der **Sidebar links** findest du alle gespeicherten Objekte und dein Portfolio.',
      bodyMore: 'Was du hier hast:\n\n• **Alle Objekte** mit DealScore-Ampel auf einen Blick\n• **Portfolio-Uebersicht** — Gesamtwert, Gesamt-Cashflow, Durchschnitts-DSCR\n• **Such- und Filter-Funktion** nach Score, Lage, Plan\n• **Schnell-Wechsel** zwischen Objekten ohne Speichern-Klick\n• **Demo-Objekte** zum Ueben (loesch- und wiederherstellbar)\n\nLimits:\n• **Free**: 3 Objekte\n• **Starter**: 15 Objekte\n• **Investor**: 50 Objekte\n• **Pro**: unlimited',
      placement: 'auto'
    },

    // ─── 17: Hilfe ─────────────────────────────────────────────────
    {
      tab: 'header',
      selector: '#tabs-status-badge',
      icon: 'i-bulb',
      title: 'Hilfe immer dabei',
      body: 'Du hast es geschafft! Im **Hilfe-Menue** findest du jederzeit alles was du brauchst.',
      bodyMore: 'Was dich im Hilfe-Modal erwartet:\n\n• **Glossar** mit 29 Finanzbegriffen (DSCR, AfA, BSV, IRR, Sonder-§7b ...)\n• **KI-Assistent** fuer DealPilot-Fragen und Investment-Beratung\n• **Diese Tour** kannst du jederzeit nochmal starten — unten links im Hilfe-Modal\n• **Schritt-fuer-Schritt-Anleitungen** fuer PDF-Export, Stripe-Setup, Plan-Wechsel\n\nViel Erfolg mit deinen Investments — und denk dran: **ein guter Deal ist halb verhandelt, der Rest ist Bewertung**.',
      placement: 'auto'
    }
  ];
})();
