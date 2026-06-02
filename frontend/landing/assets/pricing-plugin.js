/**
 * DealPilot Landing-Page — Pricing-Plugin (Adaptiert für Landing)
 * Original: pricing-modal.js V63.5
 * 
 * Anpassungen gegenüber dem App-Original:
 * - Kein Modal-Overlay (wird direkt in #pricing-host eingebettet)
 * - Kein "Aktueller Plan"-Check (User ist Neukunde)
 * - Alle CTAs zeigen auf https://app.dealpilot.junker-immobilien.io/?register=1&plan=KEY
 * - Service-CTAs zeigen auf Kontakt-Mailto
 * - Credit-CTAs zeigen auf Registration mit Hinweis
 */
(function() {
  'use strict';

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

  var STATE = {
    period: 'monthly',
    activeKey: 'investor'
  };

  // ═══════════════════════════════════════════════════════════════
  // EINBINDUNG AUF DER LANDING-PAGE (kein Modal, sondern Inline)
  // ═══════════════════════════════════════════════════════════════
  function initPricingPlugin() {
    var host = document.getElementById('pricing-host');
    if (!host) return;

    host.innerHTML = _pluginHtml();

    _initTimeline();
    _initToggle();
    _bindCtaHandlers();
    _renderCard(STATE.activeKey);
  }

  // Auto-Init wenn DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPricingPlugin);
  } else {
    initPricingPlugin();
  }
  window.initPricingPlugin = initPricingPlugin;

  // ═══════════════════════════════════════════════════════════════
  // PLUGIN-HTML
  // ═══════════════════════════════════════════════════════════════
  function _pluginHtml() {
    return '' +
      '<div class="dp-wrap">' +
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
              '<a class="dp-cta" href="https://app.dealpilot.junker-immobilien.io/?register=1" data-field="cta-link">' +
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
            _creditCard(5,   2,  'Mal schnell prüfen',        false) +
            _creditCard(15,  5,  'Mehrere Deals',             false) +
            _creditCard(40,  12, 'Aktiver Investor',          true)  +
            _creditCard(100, 25, 'Profi / Sachverständiger',  false) +
          '</div>' +
          '<p class="dp-note" style="text-align:center;margin-top:14px">Credits sind ab dem Starter-Plan zubuchbar und verfallen nicht.</p>' +
        '</div>' +

        // Marktdaten-Credits (Landing)
        '<div class="dp-container dp-section">' +
          '<div class="dp-section-head">' +
            '<span class="dp-pill dp-pill-alt">Marktdaten-Credits</span>' +
            '<h2 class="dp-h2">Echte Marktwerte auf Knopfdruck</h2>' +
            '<p class="dp-sub">' +
              '<strong>1 Credit = 1 Abruf.</strong> Automatische Marktbewertung über PriceHubble oder Sprengnetter. Ab dem Starter-Plan zubuchbar, Credits verfallen nicht.' +
            '</p>' +
          '</div>' +
          '<div class="dp-credits-grid">' +
            _avmCard(1,   7.99,   'Einzelabruf',               false) +
            _avmCard(5,   37.95,  'Mehrere Objekte',           true)  +
            _avmCard(10,  69.90,  'Aktiver Investor',          false) +
            _avmCard(25,  159.75, 'Profi / Sachverständiger',  false) +
          '</div>' +
          '<p class="dp-note" style="text-align:center;margin-top:14px">Daten von PriceHubble &amp; Sprengnetter · ab Starter · Credits verfallen nicht.</p>' +
        '</div>' +

        // Feature-Übersicht
        '<div class="dp-container dp-table-wrap-outer">' +
          '<h3 class="dp-section-h">Feature-Übersicht — alle Pläne im Vergleich</h3>' +
          '<p class="dp-section-sub">Klare Gegenüberstellung aller Features pro Plan.</p>' +
          '<div class="dp-table-wrap">' +
            _renderFeatureTable() +
          '</div>' +
        '</div>' +

        // Footer-Hinweise
        '<div class="dp-container dp-footer-note">' +
          '<p>Alle Preise zzgl. gesetzl. USt. Pläne jederzeit kündbar. Plan-Änderungen werden zum Beginn der nächsten Abrechnungsperiode wirksam. KI-Credits verfallen nicht.</p>' +
        '</div>' +
      '</div>';
  }

  // Feature-Tabelle
  function _renderFeatureTable() {
    var rows = [
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
      { cat: 'Finanzierung & Werbungskosten', items: [
        ['Finanzierungs-Optionen',               'einfach', 'Annuität', 'alle Typen', 'alle + erweitert'],
        ['Werbungskosten-Modul',                 '–', 'Werbungsk.', 'Werbungsk. + AfA', 'erweitert'],
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

    var html = '<table class="dp-table">' +
      '<thead><tr>' +
        '<th class="dp-table-feat">Feature</th>' +
        '<th>Free</th>' +
        '<th>Starter</th>' +
        '<th class="dp-table-best">Investor</th>' +
        '<th>Pro</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function(group) {
      html += '<tr class="dp-table-cat-row"><td colspan="5">' + group.cat + '</td></tr>';
      group.items.forEach(function(row) {
        html += '<tr>' +
          '<td class="dp-table-feat">' + row[0] + '</td>' +
          '<td>' + _ftCell(row[1]) + '</td>' +
          '<td>' + _ftCell(row[2]) + '</td>' +
          '<td class="dp-table-best">' + _ftCell(row[3]) + '</td>' +
          '<td>' + _ftCell(row[4]) + '</td>' +
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

  function _creditCard(credits, price, target, best) {
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
      '<a class="dp-credits-cta" href="https://app.dealpilot.junker-immobilien.io/?register=1&credits=' + credits + '">Credits kaufen</a>' +
    '</div>';
  }

  function _avmCard(credits, price, target, best) {
    var priceStr = price.toFixed(2).replace('.', ',');
    var perCallStr = (price / credits).toFixed(2).replace('.', ',') + ' €';
    var credLabel = credits === 1 ? '1 Credit' : credits + ' Credits';
    var abrufLabel = credits === 1 ? '1 Abruf' : credits + ' Abrufe';
    return '<div class="dp-credits-card' + (best ? ' dp-credits-card-best' : '') + '">' +
      (best ? '<span class="dp-credits-best">Beliebt</span>' : '') +
      '<div class="dp-credits-amount">' + credits + '</div>' +
      '<div class="dp-credits-amount-label">' + credLabel + ' = ' + abrufLabel + '</div>' +
      '<div class="dp-credits-divider"></div>' +
      '<div class="dp-credits-price">' + priceStr + ' €</div>' +
      '<div class="dp-credits-perunit">' + perCallStr + ' / Abruf</div>' +
      '<div class="dp-credits-target">' + target + '</div>' +
      '<a class="dp-credits-cta" href="https://app.dealpilot.junker-immobilien.io/?register=1&avm=' + credits + '">Credits kaufen</a>' +
    '</div>';
  }

  // Timeline
  function _initTimeline() {
    var nav = document.querySelector('#pricing-host .dp-timeline');
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

  // Toggle
  function _initToggle() {
    var toggle = document.querySelector('#pricing-host .dp-toggle');
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

  // Plan-Karte rendern
  function _renderCard(key) {
    var plan = PLANS.filter(function(p) { return p.key === key; })[0];
    if (!plan) return;
    var host = document.querySelector('#pricing-host .dp-card');
    if (!host) return;

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

    var feat = host.querySelector('[data-field="features"]');
    if (feat) {
      feat.innerHTML = plan.features.map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');
    }

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

    // CTA — auf der Landing immer "Plan starten / Registrieren" — kein "Aktueller Plan"
    var ctaText = host.querySelector('[data-field="cta-text"]');
    var ctaLink = host.querySelector('[data-field="cta-link"]');
    if (ctaText) ctaText.textContent = plan.ctaText;
    if (ctaLink) {
      ctaLink.classList.remove('dp-cta-current');
      ctaLink.setAttribute('href', 'https://app.dealpilot.junker-immobilien.io/?register=1&plan=' + key + '&period=' + STATE.period);
    }
  }

  function _bindCtaHandlers() {
    // Credits/Service-CTAs sind reine <a href>-Links auf der Landing — kein JS-Bind nötig
  }

})();
