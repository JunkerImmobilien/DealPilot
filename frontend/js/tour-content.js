/**
 * DealPilot V238 — First-Start-Tour Steps
 *
 * Step-Felder:
 *   tab        — welches Tab/Section: s-quick, s0-s8, sidebar, header
 *   selector   — CSS-Selector für Highlight-Element (Spotlight)
 *   title      — Schritt-Titel (1-3 Worte)
 *   body       — Erklärtext, HTML-erlaubt (b, strong, i, em, br), Mini-Markdown
 *   placement  — auto | top | bottom | left | right | center
 */
(function() {
  'use strict';

  window.DpTourSteps = [
    // ─── Schritt 1: Quick-Check (Standalone) ──────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-modal-card, #s-quick .qc-card',
      title: '👋 Willkommen bei DealPilot!',
      body: 'Du startest hier mit dem <strong>Quick-Check</strong> — der schnellsten Bewertung einer Immobilie.\n\nIn 60 Sekunden bekommst du einen ersten Eindruck: Lohnt sich das Objekt überhaupt für eine tiefere Analyse? Du brauchst nur Adresse, Kaufpreis, Wohnfläche und Miete.',
      placement: 'right'
    },

    // ─── Schritt 2: KI-Recherche ─────────────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-ai-research-btn, [data-action="qc-ai-research"], .qc-ai-btn',
      title: '🤖 KI-Recherche',
      body: '<strong>KI-gestützte Marktdaten-Recherche.</strong>\n\nDie KI sucht automatisch nach Vergleichsmieten und Bodenrichtwerten für deine PLZ — das spart dir 20-30 Minuten manuelle Recherche pro Objekt.\n\nKostet KI-Credits je nach Plan.',
      placement: 'bottom'
    },

    // ─── Schritt 3: Als Objekt speichern ─────────────────────────────
    {
      tab: 's-quick',
      selector: '#qc-save-btn, [data-action="qc-save"], .qc-save-btn',
      title: '💾 Vollanalyse starten',
      body: 'Wenn der Quick-Check vielversprechend ist, klicke <strong>"Als Objekt speichern"</strong>.\n\nDeine Daten werden in die 9-Tab-Vollanalyse übernommen — dort findest du Cashflow, DSCR, EK-Rendite, PDF-Export und alle Detail-Funktionen.',
      placement: 'top'
    },

    // ─── Schritt 4: Tab-Bar Übersicht ────────────────────────────────
    {
      tab: 's0',
      selector: '.tabs',
      title: '📊 9 Analyse-Tabs',
      body: 'Die <strong>9 Tabs</strong> führen dich durch die komplette Investmentbewertung:\n\n<strong>Objekt</strong> → <strong>Investition</strong> → <strong>Miete</strong> → <strong>Finanzierung</strong> → <strong>Bewirtschaftung</strong> → <strong>Steuer & KI</strong> → <strong>Bewertung</strong> → <strong>Charts</strong> → <strong>Aktion</strong>\n\nHäkchen zeigen den Fortschritt — bearbeite die Tabs in beliebiger Reihenfolge.',
      placement: 'bottom'
    },

    // ─── Schritt 5: Pflichtfelder ────────────────────────────────────
    {
      tab: 's0',
      selector: '#str, .dp-required',
      title: '⭐ Pflichtfelder',
      body: 'Felder mit einem <strong>roten Sternchen *</strong> sind Pflichtfelder.\n\nOhne diese Werte können DealScore, DSCR und Cashflow nicht korrekt berechnet werden. Die wichtigsten sind: <strong>Ort, Kaufpreis, Nettokaltmiete, Eigenkapital und Darlehenssumme</strong>.',
      placement: 'right'
    },

    // ─── Schritt 6: Finanzierung ─────────────────────────────────────
    {
      tab: 's3',
      selector: '#d1, .fin-loan-block',
      title: '🏦 Darlehensstrukturierung',
      body: 'In <strong>Tab Finanzierung</strong> baust du dein Darlehen.\n\nDu kannst zusätzliche Darlehen anlegen (z.B. <strong>KfW</strong>, <strong>Bausparvertrag</strong>) und für jedes Zinssatz + Tilgung getrennt konfigurieren.\n\nDie DSCR-Berechnung berücksichtigt automatisch alle aktiven Darlehen — sogar Bausparraten fließen mit ein.',
      placement: 'right'
    },

    // ─── Schritt 7: KI-Bewertung ─────────────────────────────────────
    {
      tab: 's5',
      selector: '#s5 .ai-section, #ai-location-score, [data-action="ai-location-analysis"]',
      title: '🎯 KI-Lagebewertung',
      body: 'In <strong>Tab Steuer & KI</strong> nutzt du die KI für Lagebewertung.\n\nSie analysiert <strong>Mikrolage</strong>, Infrastruktur, Mieterstruktur und Wertentwicklungsprognose. Das Ergebnis fließt mit in den DealScore ein und liefert einen ausführlichen Lage-Bericht für deine Bank.',
      placement: 'bottom'
    },

    // ─── Schritt 8: Bewertungs-Cockpit ───────────────────────────────
    {
      tab: 's6',
      selector: '#bc-cockpit, #bc-dscr, .bc-cards',
      title: '📊 Bewertungs-Cockpit',
      body: 'Hier sieht deine <strong>Bank zuerst hin</strong>: DSCR, LTV, Wertpuffer.\n\nDer DealScore (0-100) fasst alle Kennzahlen zusammen — du kannst die Gewichtung in den Einstellungen unter "Investor Deal Score 2.0" anpassen, je nachdem ob du eher Cashflow-, Wertsteigerungs- oder Sicherheits-Investor bist.',
      placement: 'top'
    },

    // ─── Schritt 9: Stress-Test ──────────────────────────────────────
    {
      tab: 's6',
      selector: '#bc-stress, .bc-stress-test, [data-section="stress"]',
      title: '⚠️ Stress-Test',
      body: 'Was passiert wenn die <strong>Zinsen steigen</strong>? Oder die <strong>Miete ausfällt</strong>?\n\nDer Stress-Test simuliert verschiedene Szenarien (z.B. Anschlusszins +2%, Mietausfall, Leerstand) und zeigt dir wann deine Finanzierung kippen würde. Banken lieben das.',
      placement: 'top'
    },

    // ─── Schritt 10: PDF-Export ──────────────────────────────────────
    {
      tab: 's8',
      selector: '#act-bank-pdf, [data-action="bank-pdf"], .act-pdf-btn',
      title: '📄 Investment-PDF',
      body: 'Das <strong>Investment-PDF</strong> generierst du in <strong>Tab Aktion</strong>.\n\nIn ~30 Sekunden bekommst du ein bank-fertiges PDF mit Objektdaten, Fotos, Cashflow-Übersicht, DSCR-Cockpit, Stress-Test und Lagebewertung. Ideal für Banktermine oder Investorengespräche.',
      placement: 'left'
    },

    // ─── Schritt 11: Sidebar / Objekt-Liste ──────────────────────────
    {
      tab: 'sidebar',
      selector: '#sidebar, .sidebar, aside.side',
      title: '📁 Gespeicherte Objekte',
      body: 'In der <strong>Sidebar links</strong> findest du alle gespeicherten Objekte.\n\nDu kannst sie jederzeit erneut öffnen, vergleichen oder dein Portfolio-Übersicht aufrufen. Pro Plan unterschiedliche Limits: <strong>Free 3 Objekte</strong>, <strong>Pro unlimited</strong>.',
      placement: 'right'
    },

    // ─── Schritt 12: Hilfe + Tour-nochmal ────────────────────────────
    {
      tab: 'header',
      selector: '#tabs-status-badge, .help-btn, [data-action="open-help"]',
      title: '💡 Hilfe immer dabei',
      body: 'Du hast es geschafft! 🎉\n\nIm <strong>Hilfe-Menü</strong> findest du:\n\n• <strong>Glossar</strong> mit 29 Finanzbegriffen\n• <strong>KI-Assistent</strong> für Fragen zu DealPilot\n• <strong>Diese Tour</strong> kannst du jederzeit nochmal starten\n\nViel Erfolg mit deinen Investments — und denk dran: ein guter Deal ist halb verhandelt, der Rest ist Bewertung.',
      placement: 'left'
    }
  ];
})();
