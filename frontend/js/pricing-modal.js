/**
 * DealPilot V63.5 — Pricing-Modal
 *
 * Integriert das angehängte DealPilot-Pakete-Plugin als In-App-Modal.
 * Wird von "Mein Plan" im Sidebar-User-Submenü geöffnet.
 * Stripe-Anbindungs-Hooks vorbereitet (siehe _onPlanSelect / _onCreditsBuy / _onSupportBuy).
 *
 * Plan-Datenstruktur ist mit DealPilotConfig.pricing.plans synchronisiert,
 * aber zusätzlich angereichert für die Plugin-UI (lead, result, ctaText etc.).
 */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // PLAN-DEFINITION (synchronisiert mit DealPilotConfig.pricing.plans)
  // ═══════════════════════════════════════════════════════════════
  var PLANS = [
    {
      key: 'free', letter: 'F', label: 'Free', tag: 'Einstieg', title: 'Free',
      lead: 'Beeindrucken, nicht arbeiten. Lernen Sie DealPilot kennen — mit voller Score-Logik im Hintergrund, aber Wasserzeichen auf den Exporten.',
      price_monthly: 0, price_yearly: 0,
      features: [
        '1 Objekt',
        '3 Speicherungen',
        'DealPilot Score (5 Faktoren)',
        'Investor Deal Score (24 KPIs) — Demo',
        '1 KI-Analyse',
        'Alle PDFs mit Wasserzeichen'
      ],
      not_included: null,
      result: 'Sie sehen die volle Tiefe von DealPilot — und entscheiden danach, ob Sie upgraden.',
      ctaText: 'Kostenlos starten',
      footnote: 'Keine Kreditkarte nötig'
    },
    {
      key: 'starter', letter: 'S', label: 'Starter', tag: 'Privat-Investor', title: 'Starter',
      lead: 'Fühlt sich vollständig an. Volle PDFs ohne Wasserzeichen, Werbungskosten-Modul, Mietspiegel-Vergleich — für die ersten echten Deals.',
      price_monthly: 29, price_yearly: 290,
      features: [
        '5 Objekte',
        'DealPilot Score (5 Faktoren)',
        'Investment-PDF ohne Wasserzeichen',
        'Werbungskosten-PDF ohne Wasserzeichen',
        'Werbungskosten-Modul vollständig',
        'Mietspiegel-Vergleich (manuell)',
        'Manuelle Marktzinsen',
        '5 KI-Credits / Monat (= 10 Analysen)'
      ],
      not_included: [
        'Investor Deal Score (24 KPIs)',
        'Track-Record',
        'Bankexport',
        'Logo im PDF',
        'Live-Marktzinsen',
        'BMF-Rechner & Export'
      ],
      result: 'Sie liefern professionelle Unterlagen — und sparen sich Excel-Kämpfe.',
      ctaText: 'Starter-Plan starten',
      footnote: 'Bei jährlicher Zahlung sparen Sie 58 € (~17 %)'
    },
    {
      key: 'investor', letter: 'I', label: 'Investor', tag: 'Bestseller', title: 'Investor',
      lead: 'Der Plan für aktive Investoren. Investor Deal Score mit 24 KPIs, Track-Record-PDF, Bankexport, Live-Marktzinsen und BMF-Rechner — alles, was Sie für ernstgemeinte Investments brauchen.',
      price_monthly: 59, price_yearly: 590,
      best: true,
      features: [
        '25 Objekte',
        'Investor Deal Score (24 KPIs)',
        'Track-Record-PDF',
        'Bankexport',
        'Logo & Footer im PDF',
        'Live-Marktzinsen',
        'Mietspiegel — Auto-Vergleich',
        'BMF-Rechner & Export',
        '15 KI-Credits / Monat (= 30 Analysen)'
      ],
      not_included: null,
      result: 'Sie investieren wie ein institutioneller Investor — mit allen KPIs, die Banken und Steuerberater erwarten.',
      ctaText: 'Investor-Plan starten',
      footnote: 'Bei jährlicher Zahlung sparen Sie 118 € (~17 %)'
    },
    {
      key: 'pro', letter: 'P', label: 'Pro', tag: 'Profis · Sachverständige', title: 'Pro',
      lead: 'Für Investoren, Sachverständige und Vermögensverwalter. Unbegrenzte Objekte, Premium-PDF-Layouts, Custom Track-Record Cover und Migration & Setup-Service inklusive.',
      price_monthly: 99, price_yearly: 990,
      features: [
        'Unbegrenzte Objekte',
        'Alle Investor-Features',
        'Premium-PDF-Layouts',
        'Custom Track-Record Cover',
        'BMF-Rechner & Export',
        'Priorisierter Support',
        '40 KI-Credits / Monat (= 80 Analysen)',
        'Migration & Einrichtungsservice (bis 3 h) inkl.'
      ],
      not_included: null,
      result: 'Sie skalieren Ihre Analyse-Kapazität — und können DealPilot direkt im Kundengespräch einsetzen.',
      ctaText: 'Pro-Plan starten',
      footnote: 'Bei jährlicher Zahlung sparen Sie 198 € (~17 %)'
    }
  ];

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  var STATE = {
    period: 'monthly',     // 'monthly' | 'yearly'
    activeKey: 'investor'  // V63.6: Default IMMER 'investor' beim ersten Öffnen
  };

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  window.openPricingModal = function() {
    // V63.6: Beim Öffnen IMMER auf Investor starten (Bestseller-Highlight),
    // unabhängig vom aktuellen Plan. Der aktuelle Plan ist im UI als "✓ Aktueller Plan"
    // markiert (auf der jeweiligen Plan-Karte), aber initial sichtbar ist Investor.
    STATE.activeKey = 'investor';
    _renderModal();
  };
  window.closePricingModal = function() {
    var modal = document.getElementById('pricing-modal');
    if (modal) modal.remove();
  };

  // ═══════════════════════════════════════════════════════════════
  // MODAL-RENDER
  // ═══════════════════════════════════════════════════════════════
  function _renderModal() {
    // Wenn schon offen, nicht doppelt rendern
    if (document.getElementById('pricing-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'pricing-modal';
    modal.className = 'pricing-modal-overlay';
    modal.innerHTML =
      '<div class="pricing-modal-shell">' +
        '<button class="pricing-modal-close" type="button" onclick="closePricingModal()" aria-label="Schließen">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<div class="dp-wrap" id="pricing-plugin-host">' + _pluginHtml() + '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Klick aufs Overlay (nicht aufs Shell) → schließen
    modal.addEventListener('click', function(e) {
      if (e.target === modal) window.closePricingModal();
    });

    // Plugin-JS initialisieren (nach kurzem Delay damit DOM ready ist)
    setTimeout(function() {
      _initTimeline();
      _initToggle();
      _bindCtaHandlers();
      _renderCard(STATE.activeKey);
    }, 30);
  }

  // ═══════════════════════════════════════════════════════════════
  // PLUGIN-HTML (aus dem angehängten Plugin extrahiert + adaptiert)
  // ═══════════════════════════════════════════════════════════════
  function _pluginHtml() {
    return '' +
      // Header
      '<div class="dp-container dp-header">' +
        '<span class="dp-pill">Mein Plan</span>' +
        '<h2 class="dp-h1">Wählen Sie Ihren DealPilot-Plan</h2>' +
        '<p class="dp-sub">Vom kostenlosen Test bis zum unbegrenzten Profi-Werkzeug — jederzeit kündbar, jederzeit upgrade- oder downgradebar.</p>' +
        '<div class="dp-toggle" role="tablist" aria-label="Abrechnungszeitraum">' +
          '<button type="button" class="dp-toggle-btn dp-on" data-period="monthly" aria-selected="true">Monatlich</button>' +
          '<button type="button" class="dp-toggle-btn" data-period="yearly" aria-selected="false">Jährlich <span class="dp-toggle-save">~17 % gespart</span></button>' +
        '</div>' +
      '</div>' +

      // Timeline
      '<div class="dp-container">' +
        '<nav class="dp-timeline" aria-label="Pläne">' +
          '<div class="dp-timeline-line" aria-hidden="true"></div>' +
        '</nav>' +
      '</div>' +

      // Plan-Detail-Karte
      '<div class="dp-container">' +
        '<article class="dp-card" aria-live="polite">' +
          '<div class="dp-card-left">' +
            '<div class="dp-card-meta">' +
              '<span class="dp-card-badge" data-field="badge"></span>' +
              '<span class="dp-card-tag" data-field="tag"></span>' +
            '</div>' +
            '<h3 class="dp-card-title" data-field="title"></h3>' +
            '<p class="dp-card-lead" data-field="lead"></p>' +
            '<ul class="dp-card-features" data-field="features"></ul>' +
            '<div class="dp-card-notincl" data-field="notincl-wrap" hidden>' +
              '<div class="dp-card-notincl-label">Nicht enthalten:</div>' +
              '<ul class="dp-card-notincl-list" data-field="notincl"></ul>' +
            '</div>' +
            '<a class="dp-cta" href="#" data-field="cta-link" onclick="return false;">' +
              '<span data-field="cta-text">Plan wählen</span>' +
              '<span class="dp-cta-arrow" aria-hidden="true">⟶</span>' +
            '</a>' +
          '</div>' +
          '<div class="dp-card-right">' +
            '<span class="dp-card-watermark" data-field="watermark" aria-hidden="true"></span>' +
            '<div class="dp-card-right-inner">' +
              '<span class="dp-card-pricelabel">Preis</span>' +
              '<div class="dp-card-price" data-field="price"></div>' +
              '<div class="dp-card-pricenote" data-field="price-note"></div>' +
              '<div class="dp-card-divider"></div>' +
              '<span class="dp-card-resultlabel">Ihr Ergebnis</span>' +
              '<p class="dp-card-result" data-field="result"></p>' +
            '</div>' +
          '</div>' +
        '</article>' +
      '</div>' +

      // KI-Credits
      '<div class="dp-container dp-section">' +
        '<div class="dp-section-head">' +
          '<span class="dp-pill dp-pill-alt">KI-Credits</span>' +
          '<h2 class="dp-h2">Mehr KI-Power, wann Sie sie brauchen</h2>' +
          '<p class="dp-sub">' +
            '<strong>1 Credit = 2 KI-Analysen.</strong> Monatliche inklusive Credits werden zuerst verbraucht. Zugekaufte Credits verfallen nicht.' +
          '</p>' +
        '</div>' +
        '<div class="dp-credits-grid">' +
          _creditCard(5, 5, '1,00 €', 'Mal schnell prüfen', false) +
          _creditCard(15, 12, '0,80 €', 'Mehrere Deals', false) +
          _creditCard(40, 29, '0,72 €', 'Aktiver Investor', true) +
          _creditCard(100, 59, '0,59 €', 'Profi / Sachverständiger', false) +
        '</div>' +
        '<p class="dp-note" style="text-align:center;margin-top:14px">Credits sind ab dem Starter-Plan zubuchbar und verfallen nicht.</p>' +
      '</div>' +

      // V63.82: Feature-Übersicht — vollständige Vergleichstabelle
      '<div class="dp-container dp-feature-table-wrap">' +
        '<h3 class="dp-feature-table-h">Feature-Übersicht — alle Pläne im Vergleich</h3>' +
        '<p class="dp-feature-table-sub">Klare Gegenüberstellung aller Features pro Plan.</p>' +
        '<div class="dp-feature-table-scroll">' +
          _renderFeatureTable() +
        '</div>' +
      '</div>' +

      // V63.82: Service-Levels (Silver / Gold / Platinum) — buchbar zu jedem Plan
      '<div class="dp-container dp-services">' +
        '<h3 class="dp-services-h">Service & Support — zubuchbar</h3>' +
        '<p class="dp-services-sub">Brauchst du schnellere Antworten oder einen persönlichen Ansprechpartner? Erweitere deinen Plan um eine Service-Stufe.</p>' +
        '<div class="dp-services-grid">' +
          _serviceCard('silver',   '🥈', 'Silver Support',     '19 €/Mon.',  ['Antwort < 24 h', 'Hilfe bei Objekten & PDFs', 'E-Mail-Priorisierung'],                                                false) +
          _serviceCard('gold',     '🥇', 'Gold Service',       '49 €/Mon.',  ['Antwort < 6 h (werktags)', 'Persönlicher Ansprechpartner', '1× 30-Min-Call / Monat', 'Hilfe bei Score- & KI-Ergebnissen'], true) +
          _serviceCard('platinum', '💎', 'Platinum Setup',     '249 € einmalig', ['2–3 h Setup-Call', 'Migration aus Excel/Listen', 'Branding-Einrichtung'],                                       false) +
        '</div>' +
      '</div>' +

      // Footer-Hinweise
      '<div class="dp-container dp-footer-note">' +
        '<p>Alle Preise zzgl. gesetzl. USt. Pläne jederzeit kündbar. Plan-Änderungen werden zum Beginn der nächsten Abrechnungsperiode wirksam. KI-Credits verfallen nicht.</p>' +
      '</div>';
  }

  // V63.82: Service-Card-Helper
  // V63.82: Feature-Übersicht-Tabelle — alle Features alle Pläne
  function _renderFeatureTable() {
    var rows = [
      // [Feature-Label, Free, Starter, Investor, Pro]
      { cat: 'Score & Bewertung', items: [
        ['DealPilot Score (5 Faktoren)',         '✓', '✓', '✓', '✓'],
        ['Investor Deal Score (24 KPIs)',        'Demo', '–', '✓', '✓'],
        ['Quick-Check (Schnellbewertung)',       '✓', '✓', '✓', '✓'],
        ['Deal-Aktion (Anfragen / Gutachten)',   '✓', '✓', '✓', '✓']
      ]},
      { cat: 'PDFs & Export', items: [
        ['Investment-PDF',                       'Wasserzeichen', '✓', '✓', '✓'],
        ['Werbungskosten-PDF',                   'Wasserzeichen', '✓', '✓', '✓'],
        ['Track-Record-PDF',                     'Wasserzeichen', '–', '✓', '✓'],
        ['Bankexport',                           'Wasserzeichen', '–', '✓', '✓'],
        ['Logo & Footer im PDF',                 '–', '–', '✓', '✓'],
        ['Premium-PDF-Layouts',                  '–', '–', '–', '✓'],
        ['Custom Track-Record-Cover',            '–', '–', '–', '✓']
      ]},
      { cat: 'Daten & Marktanalyse', items: [
        ['Marktdatenfelder',                     'ausgegraut', 'ausgegraut', '✓', '✓'],
        ['Live-Marktzinsen',                     '–', '–', '✓', '✓'],
        ['Mietspiegel-Vergleich',                '–', 'manuell', 'auto', 'auto'],
        ['BMF-Rechner & -Export',                '–', '–', '✓', '✓']
      ]},
      { cat: 'Finanzierung & Steuern', items: [
        ['Finanzierungs-Optionen',               'einfach', 'Annuität', 'alle Typen', 'alle + erweitert'],
        ['Steuer-Modul',                         '–', 'Werbungsk.', 'Werbungsk. + AfA', 'erweitert'],
        ['Personalisierte Zinsmodelle',          '–', '–', '–', '✓']
      ]},
      { cat: 'KI-Analyse', items: [
        ['KI-Analyse-Tab',                       'vereinfacht', 'vereinfacht', '✓', '✓'],
        ['KI-Credits / Monat (inkl.)',           '1', '5', '15', '40'],
        ['KI-Marktanalyse / Lagebewertung',      '–', '–', '✓', '✓']
      ]},
      { cat: 'Limits & Import', items: [
        ['Objekte',                              '1', '5', '25', '∞'],
        ['Import (Excel, PDF)',                  '–', 'Excel', 'Excel + Bank-PDF', 'alle Formate'],
        ['Migration & Setup-Service',            '–', '–', '–', '✓ (3 h)']
      ]}
    ];

    var html = '<table class="dp-feature-table">' +
      '<thead><tr>' +
        '<th class="dp-ft-feature">Feature</th>' +
        '<th class="dp-ft-plan">Free</th>' +
        '<th class="dp-ft-plan">Starter</th>' +
        '<th class="dp-ft-plan dp-ft-plan-best">Investor ⭐</th>' +
        '<th class="dp-ft-plan">Pro</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function(group) {
      html += '<tr class="dp-ft-cat-row"><td colspan="5">' + group.cat + '</td></tr>';
      group.items.forEach(function(row) {
        html += '<tr>' +
          '<td class="dp-ft-feature">' + row[0] + '</td>' +
          '<td class="dp-ft-cell">' + _ftCell(row[1]) + '</td>' +
          '<td class="dp-ft-cell">' + _ftCell(row[2]) + '</td>' +
          '<td class="dp-ft-cell dp-ft-cell-best">' + _ftCell(row[3]) + '</td>' +
          '<td class="dp-ft-cell">' + _ftCell(row[4]) + '</td>' +
        '</tr>';
      });
    });
    html += '</tbody></table>';
    return html;
  }

  function _ftCell(value) {
    if (value === '✓')   return '<span class="dp-ft-yes">✓</span>';
    if (value === '–')   return '<span class="dp-ft-no">–</span>';
    return '<span class="dp-ft-text">' + value + '</span>';
  }

  function _serviceCard(key, icon, title, price, benefits, highlight) {
    return '<div class="dp-service-card' + (highlight ? ' dp-service-card-best' : '') + '" data-service="' + key + '">' +
      (highlight ? '<div class="dp-service-best-badge">Empfohlen</div>' : '') +
      '<div class="dp-service-icon">' + icon + '</div>' +
      '<div class="dp-service-title">' + title + '</div>' +
      '<div class="dp-service-price">' + price + '</div>' +
      '<ul class="dp-service-list">' +
        benefits.map(function(b) { return '<li>' + b + '</li>'; }).join('') +
      '</ul>' +
      '<button type="button" class="dp-service-cta" onclick="_dpServiceSelect(\'' + key + '\')">Anfragen</button>' +
    '</div>';
  }
  // Globaler Handler für Service-Anfrage
  window._dpServiceSelect = function(key) {
    if (typeof toast === 'function') toast('Service "' + key + '" angefragt — Marcel meldet sich.');
    // V63.82: Bei aktivem Backend-Mailer wäre hier ein POST /service-request möglich.
    // Für jetzt: einfach toasten — Marcel sieht's beim Plan-Wechsel-Workflow.
  };

  function _creditCard(credits, price, perUnit, target, best) {
    // V63.6: 1 Credit = 2 Anfragen — also doppelte Anfragen-Anzahl + halbierter Preis pro Anfrage
    var anfragen = credits * 2;
    var perAnfrage = (price / anfragen);
    var perAnfrageStr = perAnfrage.toFixed(2).replace('.', ',') + ' €';
    return '<div class="dp-credits-card' + (best ? ' dp-credits-card-best' : '') + '">' +
      (best ? '<span class="dp-credits-best">Beliebt</span>' : '') +
      '<div class="dp-credits-amount">' + credits + '</div>' +
      '<div class="dp-credits-amount-label">Credits = ' + anfragen + ' Anfragen</div>' +
      '<div class="dp-credits-divider"></div>' +
      '<div class="dp-credits-price">' + price + ' €</div>' +
      '<div class="dp-credits-perunit">' + perAnfrageStr + ' / Anfrage</div>' +
      '<div class="dp-credits-target">' + target + '</div>' +
      '<a class="dp-credits-cta" href="#" data-credits-cta="' + credits + '">Credits kaufen</a>' +
    '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // TIMELINE (Plan-Steps)
  // ═══════════════════════════════════════════════════════════════
  function _initTimeline() {
    var nav = document.querySelector('#pricing-plugin-host .dp-timeline');
    if (!nav) return;
    var html = '<div class="dp-timeline-line" aria-hidden="true"></div>';
    PLANS.forEach(function(p) {
      var isBest = p.best;
      var isActive = p.key === STATE.activeKey;
      html += '<button type="button" class="dp-step' + (isActive ? ' dp-active' : '') + (isBest ? ' dp-best' : '') + '" data-key="' + p.key + '">' +
        '<span class="dp-step-circle">' + p.letter + '</span>' +
        '<span class="dp-step-label">' + p.label + '</span>' +
        (isBest ? '<span class="dp-step-bestmark">★ Bestseller</span>' : '') +
      '</button>';
    });
    nav.innerHTML = html;
    nav.querySelectorAll('.dp-step').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var k = btn.getAttribute('data-key');
        STATE.activeKey = k;
        nav.querySelectorAll('.dp-step').forEach(function(b) { b.classList.remove('dp-active'); });
        btn.classList.add('dp-active');
        _renderCard(k);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOGGLE Monatlich / Jährlich
  // ═══════════════════════════════════════════════════════════════
  function _initToggle() {
    var toggle = document.querySelector('#pricing-plugin-host .dp-toggle');
    if (!toggle) return;
    toggle.querySelectorAll('.dp-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = btn.getAttribute('data-period');
        STATE.period = p;
        toggle.querySelectorAll('.dp-toggle-btn').forEach(function(b) {
          var on = b.getAttribute('data-period') === p;
          b.classList.toggle('dp-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        _renderCard(STATE.activeKey);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAN-KARTE rendern
  // ═══════════════════════════════════════════════════════════════
  function _renderCard(key) {
    var plan = PLANS.filter(function(p) { return p.key === key; })[0];
    if (!plan) return;
    var host = document.querySelector('#pricing-plugin-host .dp-card');
    if (!host) return;

    // V63.6: Investor-Ribbon-Overlay auf der Karte wenn investor aktiv ist
    host.classList.remove('dp-card-with-investor-ribbon');
    var existingRibbon = host.querySelector('.dp-card-investor-ribbon');
    if (existingRibbon) existingRibbon.remove();
    if (key === 'investor' || plan.best) {
      host.classList.add('dp-card-with-investor-ribbon');
      var ribbon = document.createElement('div');
      ribbon.className = 'dp-card-investor-ribbon';
      ribbon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> <span>INVESTOR</span>';
      host.appendChild(ribbon);
    }

    function _set(field, val) {
      var el = host.querySelector('[data-field="' + field + '"]');
      if (el) el.innerHTML = val;
    }

    _set('badge', plan.letter);
    _set('tag', plan.tag);
    _set('title', plan.title);
    _set('lead', plan.lead);
    _set('watermark', plan.label);

    // Preis
    var price, priceNote;
    if (STATE.period === 'monthly') {
      price = plan.price_monthly === 0 ? '0 €' : plan.price_monthly + ' €<small>/ Monat</small>';
      priceNote = plan.price_monthly === 0 ? 'kostenlos' : 'monatliche Abrechnung';
    } else {
      price = plan.price_yearly === 0 ? '0 €' : plan.price_yearly + ' €<small>/ Jahr</small>';
      priceNote = plan.price_yearly === 0 ? 'kostenlos' : 'entspricht ' + Math.round(plan.price_yearly / 12) + ' € / Monat';
    }
    _set('price', price);
    _set('price-note', priceNote);
    _set('result', plan.result);

    // Features
    var feat = host.querySelector('[data-field="features"]');
    if (feat) {
      feat.innerHTML = plan.features.map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');
    }

    // Not-included
    var notInclWrap = host.querySelector('[data-field="notincl-wrap"]');
    var notIncl = host.querySelector('[data-field="notincl"]');
    if (plan.not_included && plan.not_included.length) {
      notInclWrap.removeAttribute('hidden');
      notIncl.innerHTML = plan.not_included.map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');
    } else {
      notInclWrap.setAttribute('hidden', '');
    }

    // CTA — bei aktivem Plan deaktiviert, sonst Plan-Wechsel-Trigger
    var ctaText = host.querySelector('[data-field="cta-text"]');
    var ctaLink = host.querySelector('[data-field="cta-link"]');
    var isCurrent = (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.currentKey() === key);
    if (isCurrent) {
      if (ctaText) ctaText.textContent = '✓ Aktueller Plan';
      if (ctaLink) {
        ctaLink.classList.add('dp-cta-current');
        ctaLink.onclick = function(e) { e.preventDefault(); return false; };
      }
    } else {
      if (ctaText) ctaText.textContent = plan.ctaText;
      if (ctaLink) {
        ctaLink.classList.remove('dp-cta-current');
        ctaLink.onclick = function(e) {
          e.preventDefault();
          _onPlanSelect(key, STATE.period);
          return false;
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STRIPE-HOOKS — hier kommt später Stripe rein
  // ═══════════════════════════════════════════════════════════════

  /**
   * Plan-Wechsel angefordert.
   *
   * STRIPE-INTEGRATION (später):
   * 1. POST /api/stripe/create-checkout-session  { plan, period }
   * 2. Backend ruft stripe.checkout.sessions.create() mit dem zugehörigen
   *    price_id (siehe DealPilotConfig.pricing.plans[plan].stripe_price_id_{monthly|yearly})
   * 3. Frontend redirected mit der zurückgelieferten URL: window.location = data.url
   * 4. Webhook /api/stripe/webhook empfängt 'checkout.session.completed' und
   *    aktualisiert subscriptions in PostgreSQL
   * 5. Bei Erfolg-Redirect zurück → Sub.invalidateCache() + applyFeatureGates()
   *
   * Aktuell (Dev-Mode): direkter setOverride()-Call für lokales Testen.
   */
  function _onPlanSelect(planKey, period) {
    if (!window.DealPilotConfig || !DealPilotConfig.pricing) return;

    // Stripe-Mode (Live): Checkout-Session erstellen
    if (DealPilotConfig.pricing.payment && DealPilotConfig.pricing.payment().stripe_enabled) {
      _startStripeCheckout(planKey, period);
      return;
    }

    // Dev-Mode: Plan-Override setzen
    DealPilotConfig.pricing.setOverride(planKey);
    if (typeof toast === 'function') {
      toast('✓ Plan auf "' + DealPilotConfig.pricing.get(planKey).label + '" gewechselt');
    }
    // Cache invalidieren + UI refresh
    if (typeof Sub !== 'undefined' && typeof Sub.invalidateCache === 'function') {
      Sub.invalidateCache();
    }
    if (typeof window.renderSubscriptionBadge === 'function') {
      window.renderSubscriptionBadge();
    }
    if (typeof applyFeatureGates === 'function') {
      applyFeatureGates();
    } else if (typeof window.applyFeatureGates === 'function') {
      window.applyFeatureGates();
    }
    if (typeof updHeaderBadges === 'function') updHeaderBadges();
    // Modal nach kurzem Delay schließen
    setTimeout(function() {
      window.closePricingModal();
    }, 800);
  }

  /**
   * Stripe-Checkout starten (Stub für später).
   */
  async function _startStripeCheckout(planKey, period) {
    // TODO: Implement when Stripe is enabled
    // var resp = await Auth.apiCall('/stripe/create-checkout-session', {
    //   method: 'POST',
    //   body: JSON.stringify({ plan: planKey, period: period })
    // });
    // window.location = resp.url;
    if (typeof toast === 'function') {
      toast('⏳ Stripe-Checkout noch nicht aktiv — wird beim Live-Launch verfügbar.');
    }
  }

  /**
   * KI-Credit-Paket gekauft.
   *
   * STRIPE-INTEGRATION (später):
   * 1. POST /api/stripe/buy-credits  { credits: 5|15|40|100 }
   * 2. Backend erstellt einmaliges Stripe-Payment-Intent
   * 3. Frontend zeigt Stripe Elements oder Redirect auf Checkout
   * 4. Webhook /api/stripe/webhook → 'payment_intent.succeeded' →
   *    Backend addiert credits in user_credits Tabelle
   */
  function _onCreditsBuy(credits) {
    if (typeof toast === 'function') {
      toast('💳 Credit-Paket "' + credits + ' Credits" — Stripe-Checkout noch nicht aktiv.');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CTA-Handler binden
  // ═══════════════════════════════════════════════════════════════
  function _bindCtaHandlers() {
    var host = document.getElementById('pricing-plugin-host');
    if (!host) return;
    // Credit-Pakete
    host.querySelectorAll('[data-credits-cta]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        var credits = parseInt(a.getAttribute('data-credits-cta'), 10);
        _onCreditsBuy(credits);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ESC-Key zum Schließen
  // ═══════════════════════════════════════════════════════════════
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('pricing-modal')) {
      window.closePricingModal();
    }
  });

})();
