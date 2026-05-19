/**
 * DealPilot V238.1 — First-Start-Tour Steps mit Mehr-erfahren-Body
 *
 * Step-Felder:
 *   tab        — s-quick, s0-s8, sidebar, header
 *   selector   — CSS-Selector für Highlight-Element
 *   icon       — SVG-Sprite-ID aus index.html (z.B. 'i-flame', 'i-bank')
 *   title      — Schritt-Titel
 *   body       — Kurz-Erklärung (1-2 Sätze, default sichtbar)
 *   bodyMore   — Ausführliche Erklärung mit Zahlen, Beispielen (Aufklapp)
 *   placement  — auto | top | bottom | left | right | center
 */
(function() {
  'use strict';

  window.DpTourSteps = [
    // ─── Schritt 1: Quick-Check ──────────────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-modal-card, #s-quick .qc-card, #s-quick',
      icon: 'i-flame',
      title: 'Willkommen bei DealPilot',
      body: 'Der **Quick-Check** ist deine schnellste Bewertung — in 60 Sekunden weißt du, ob ein Objekt eine tiefere Analyse lohnt.',
      bodyMore: 'Du brauchst nur: **PLZ, Straße, Wohnfläche, Kaufpreis und Nettokaltmiete**.\n\nDealPilot rechnet daraus sofort die wichtigsten Eckwerte:\n\n• **Bruttomietrendite** (Kaufpreis vs. Jahresmiete)\n• **Vorläufigen DealScore** als Ampel-Indikator\n• **Erste Lage-Einschätzung** über die KI-Recherche\n\nIdeal beim Inseraten-Sichten oder Mailings vom Makler. Vielversprechende Objekte übernimmst du dann mit einem Klick in die Vollanalyse.',
      placement: 'right'
    },

    // ─── Schritt 2: KI-Recherche ─────────────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-ai-research-btn, [data-action="qc-ai-research"], .qc-ai-btn',
      icon: 'i-brain',
      title: 'KI-Marktrecherche',
      body: 'Die KI sucht **automatisch** nach Vergleichsmieten und Bodenrichtwerten für deine PLZ — spart dir 20-30 Min manuelle Recherche pro Objekt.',
      bodyMore: 'Was die KI für dich macht:\n\n• **Vergleichsmieten** aus aktuellen Inseraten und Mietspiegel-Daten\n• **Bodenrichtwerte** über öffentliche GAA-Datenbanken\n• **Mikrolage-Bewertung** (Infrastruktur, Anbindung, Mieterstruktur)\n• **Wertentwicklungs-Prognose** für die kommenden Jahre\n\nDas Ergebnis fließt in DealScore und Plausibilitätsprüfung. Kostet KI-Credits je nach Plan — **Pro-User haben unlimited KI-Recherche**.',
      placement: 'bottom'
    },

    // ─── Schritt 3: Als Objekt speichern ─────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-save-btn, [data-action="qc-save"], .qc-save-btn',
      icon: 'i-piggy-bank',
      title: 'Vollanalyse starten',
      body: 'Vielversprechender Quick-Check? Mit einem Klick übernimmst du alle Daten in die **9-Tab-Vollanalyse**.',
      bodyMore: 'Was beim Speichern passiert:\n\n• Alle Quick-Check-Daten landen in **Tab Objekt + Tab Investition + Tab Miete**\n• Wohnfläche, Adresse, Baujahr werden vorbefüllt — kein doppeltes Tippen\n• Du landest direkt in der Vollanalyse und kannst Finanzierung, Bewirtschaftung etc. ergänzen\n• Das Objekt erscheint dauerhaft in deiner **Sidebar links**\n\nFree-Plan: 3 gespeicherte Objekte. Pro-Plan: unlimited.',
      placement: 'top'
    },

    // ─── Schritt 4: Tab-Bar ──────────────────────────────────────────
    {
      tab: 's0',
      selector: '.tabs',
      icon: 'i-layers',
      title: '9 Analyse-Tabs',
      body: 'Die Tabs führen dich Schritt für Schritt durch die komplette Bewertung. **Häkchen** zeigen Fortschritt.',
      bodyMore: 'Die 9 Tabs im Detail:\n\n**1. Objekt** — Adresse, Wohnfläche, Baujahr, Fotos\n**2. Investition** — Kaufpreis, KNK, Sanierung\n**3. Miete** — Kaltmiete, Bewirtschaftungskosten, Zusatzerträge\n**4. Finanzierung** — Darlehen, Zinsbindung, BSV-Optionen\n**5. Bewirtschaftung** — Hausgeld, Instandhaltung, Mietausfall\n**6. Steuer & KI** — AfA, Grenzsteuersatz, KI-Lagebewertung\n**7. Bewertung** — DSCR, LTV, DealScore, Stress-Test\n**8. Charts** — Cashflow-Waterfall, Equity-Build\n**9. Aktion** — PDF-Export, E-Mail, Portfolio\n\nReihenfolge ist frei — DealPilot berechnet jederzeit neu.',
      placement: 'bottom'
    },

    // ─── Schritt 5: Pflichtfelder ────────────────────────────────────
    {
      tab: 's0',
      selector: '#str, .dp-required',
      icon: 'i-flag',
      title: 'Pflichtfelder',
      body: 'Felder mit **rotem Sternchen** sind Pflichtfelder. Ohne sie kein DealScore.',
      bodyMore: 'Die 5 kritischen Pflichtfelder:\n\n• **Ort + Straße** — für Marktmiete-Recherche und Lage-Score\n• **Kaufpreis** — Basis aller Renditen\n• **Wohnfläche** — für €/m²-Vergleiche und Sonder-AfA-Prüfung\n• **Nettokaltmiete** — Cashflow-Berechnung\n• **Eigenkapital + Darlehenssumme** — Finanzierungs-Struktur\n\n**Tipp:** Die Quick-Check-Daten werden beim Speichern automatisch in diese Felder übernommen — kein doppeltes Eintippen nötig.',
      placement: 'right'
    },

    // ─── Schritt 6: Finanzierung ─────────────────────────────────────
    {
      tab: 's3',
      selector: '#d1, .fin-loan-block',
      icon: 'i-bank',
      title: 'Darlehensstrukturierung',
      body: 'Hier baust du dein Darlehen — auch komplexe Setups mit **mehreren Darlehen + Bausparvertrag**.',
      bodyMore: 'Was DealPilot kann:\n\n• **Hauptdarlehen** mit Zinsbindung 10/15/20 Jahre\n• **Zusatzdarlehen** für KfW-Förderprogramme oder Familiendarlehen\n• **Bausparvertrag (BSV)** als Tilgungsersatz oder Anschluss-Sicherung\n• **Tilgungssatz** frei wählbar (1-10 % p.a.)\n• **Anschlusszins-Szenario** für Stress-Test (Default 5,0 %)\n\nDie DSCR-Berechnung berücksichtigt automatisch alle aktiven Darlehen — sogar Bausparraten fließen mit ein. **Single Source of Truth** für alle Bewertungsstellen.',
      placement: 'right'
    },

    // ─── Schritt 7: KI-Lagebewertung ─────────────────────────────────
    {
      tab: 's5',
      selector: '#s5 .ai-section, #ai-location-score, [data-action="ai-location-analysis"]',
      icon: 'i-pin',
      title: 'KI-Lagebewertung',
      body: 'Die KI analysiert **Mikrolage, Infrastruktur, Wertentwicklung** und liefert einen ausführlichen Lage-Bericht.',
      bodyMore: 'Was die Lage-KI prüft:\n\n• **Mikrolage** — Verkehrsanbindung, Infrastruktur, Nachbarschaft\n• **Mieterstruktur** — Einkommensniveau, Beruf, Familienstand-Verteilung\n• **Wertentwicklung** — historische Preisentwicklung + Prognose\n• **Risikofaktoren** — Leerstand, Gentrifizierung, geplante Bauprojekte\n• **Vergleichsobjekte** im Umkreis\n\nErgebnis: ein **Lage-Score (0-100)** + ausführlicher Text für deine Bank-Präsentation. Der Score fließt in den DealScore mit ein (gewichtet je nach Settings).',
      placement: 'bottom'
    },

    // ─── Schritt 8: Bewertungs-Cockpit ───────────────────────────────
    {
      tab: 's6',
      selector: '#bc-cockpit, #bc-dscr, .bc-cards',
      icon: 'i-gauge',
      title: 'Bewertungs-Cockpit',
      body: '**DSCR, LTV, Wertpuffer** — die Kennzahlen, auf die deine Bank zuerst schaut.',
      bodyMore: 'Was hier visualisiert wird:\n\n• **DSCR** (Schuldendienstdeckung) — Ampel-Skala 🟢 ≥1,2 / 🟡 1,0-1,2 / 🔴 <1,0\n• **LTV** (Beleihungsauslauf) — 🟢 <85% / 🟡 85-100% / 🔴 >100%\n• **Wertpuffer** — Differenz Verkehrswert vs. Kaufpreis\n• **EK-Rendite p.a.** über 10 Jahre\n• **Equity Multiple** (Vermögenszuwachs)\n\nDer **DealScore (0-100)** fasst alles in einer Zahl zusammen. Gewichtung der Bausteine kannst du in **Settings → Investor Deal Score 2.0** anpassen — je nach Investor-Typ (Cashflow / Wertsteigerung / Sicherheit).',
      placement: 'top'
    },

    // ─── Schritt 9: Stress-Test ──────────────────────────────────────
    {
      tab: 's6',
      selector: '#bc-stress, .bc-stress-test, [data-section="stress"]',
      icon: 'i-cpu',
      title: 'Stress-Test',
      body: 'Was passiert wenn **Zinsen steigen** oder **Miete ausfällt**? Der Stress-Test simuliert es.',
      bodyMore: 'Standard-Szenarien:\n\n• **Anschlusszins +2 Prozentpunkte** — was kostet das Darlehen in 10 Jahren?\n• **Mietausfall 3 Monate** — bleibt der Cashflow stabil?\n• **Leerstand 10 %** dauerhaft — kippt die Finanzierung?\n• **Marktwertverlust 15 %** — wie steht der LTV dann?\n\nFür jedes Szenario zeigt DealPilot den **neuen DSCR** und ob die Finanzierung weiter trägt. Banken lieben diese Analyse — sie zeigt dass du das Risiko verstanden hast. **Print direkt mit ins Investment-PDF.**',
      placement: 'top'
    },

    // ─── Schritt 10: Investment-PDF ──────────────────────────────────
    {
      tab: 's8',
      selector: '#act-bank-pdf, [data-action="bank-pdf"], .act-pdf-btn',
      icon: 'i-file-text',
      title: 'Investment-PDF',
      body: 'Das **bank-fertige Investment-PDF** in 30 Sekunden — perfekt für Banktermine.',
      bodyMore: 'Was im PDF drin ist:\n\n• **Deckblatt** mit Objektfotos und Eckdaten\n• **Investitionsübersicht** (KP + KNK + Sanierung)\n• **Cashflow-Tabelle** über 10 Jahre\n• **DSCR + LTV + Wertpuffer** als Cockpit\n• **Stress-Test-Szenarien**\n• **KI-Lagebewertung** als Volltext\n• **Werbungskosten-Anlage** für Finanzamt\n\nPro-Plan: **eigenes Logo + Footer + Impressum**. Custom-Branding für Reseller verfügbar. **Free-Plan** hat DealPilot-Wasserzeichen.',
      placement: 'left'
    },

    // ─── Schritt 11: Sidebar / Portfolio ─────────────────────────────
    {
      tab: 'sidebar',
      selector: '#sidebar, .sidebar, aside.side',
      icon: 'i-portfolio',
      title: 'Gespeicherte Objekte',
      body: 'In der **Sidebar links** findest du alle gespeicherten Objekte und dein Portfolio.',
      bodyMore: 'Was du hier hast:\n\n• **Alle Objekte** mit DealScore-Ampel auf einen Blick\n• **Portfolio-Übersicht** — Gesamtwert, Gesamt-Cashflow, Durchschnitts-DSCR\n• **Such- und Filter-Funktion** nach Score, Lage, Plan\n• **Schnell-Wechsel** zwischen Objekten ohne Speichern-Klick\n• **Demo-Objekte** zum Üben (lösch- und wiederherstellbar)\n\nLimits:\n• **Free**: 3 Objekte\n• **Starter**: 15 Objekte\n• **Investor**: 50 Objekte\n• **Pro**: unlimited',
      placement: 'right'
    },

    // ─── Schritt 12: Hilfe + Tour-nochmal ────────────────────────────
    {
      tab: 'header',
      selector: '#tabs-status-badge, .help-btn, [data-action="open-help"]',
      icon: 'i-bulb',
      title: 'Hilfe immer dabei',
      body: 'Du hast es geschafft! Im **Hilfe-Menü** findest du jederzeit alles was du brauchst.',
      bodyMore: 'Was dich im Hilfe-Modal erwartet:\n\n• **Glossar** mit 29 Finanzbegriffen (DSCR, AfA, BSV, IRR, Sonder-§7b ...)\n• **KI-Assistent** für DealPilot-Fragen und Investment-Beratung\n• **Diese Tour** kannst du jederzeit nochmal starten — unten links im Hilfe-Modal\n• **Schritt-für-Schritt-Anleitungen** für PDF-Export, Stripe-Setup, Plan-Wechsel\n\nViel Erfolg mit deinen Investments — und denk dran: **ein guter Deal ist halb verhandelt, der Rest ist Bewertung**.',
      placement: 'left'
    }
  ];
})();
