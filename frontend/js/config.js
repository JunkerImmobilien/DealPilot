'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT – config.js
   Zentrale Konfiguration:
   - Branding (zentral, nicht im PDF-Code verteilt)
   - Pricing-Pläne (Free / Investor / Pro / Business)
   - Dev-Flags
═══════════════════════════════════════════════════ */

// V1.0: Erster offizieller Production-Release (intern: build v1.0.0)
// Vorher: V215 als Build-Stamp. Ab jetzt V1.x für externe Kommunikation.
window.DealPilotVersion = {
  label:   'V1.0',
  build:   '2026-05-12',
  channel: 'stable',
  tagline: 'Investmentanalyse für Profis'
};

window.DealPilotConfig = (function() {

  // ── BRANDING ─────────────────────────────────────
  // Diese Defaults greifen, wenn der User in den Einstellungen NICHTS Eigenes hinterlegt hat.
  // KEIN Junker-Immobilien-Hardcoding mehr — Standard ist DealPilot.
  var BRANDING_DEFAULTS = {
    product_name: 'DealPilot',
    tagline: 'Investmentanalyse für Profis',
    logo_path: 'assets/dealpilot_logo.png',
    // Footer-Defaults — bewusst neutral.
    footer_company: 'DealPilot',
    footer_address: '',
    footer_plz: '',
    footer_city: '',
    footer_phone: '',
    footer_email: '',
    footer_website: ''
  };

  /**
   * Liefert effektive Branding-Daten:
   *  1) User hat in Settings etwas hinterlegt → User-Daten
   *  2) sonst → DealPilot-Defaults
   * Custom-Logo (settings.pdf_logo_b64) hat Vorrang vor dem DealPilot-Logo.
   */
  function getBranding() {
    var s = (typeof Settings !== 'undefined') ? Settings.get() : {};
    return {
      product_name: BRANDING_DEFAULTS.product_name,
      tagline: BRANDING_DEFAULTS.tagline,
      logo_b64: s.pdf_logo_b64 || '',  // leer → Loader nutzt logo_path
      logo_path: BRANDING_DEFAULTS.logo_path,
      // Footer / Kontaktdaten
      company: s.user_company || s.user_name || BRANDING_DEFAULTS.footer_company,
      name: s.user_name || '',
      role: s.user_role || '',
      address: s.pdf_address || BRANDING_DEFAULTS.footer_address,
      plz: s.pdf_plz || BRANDING_DEFAULTS.footer_plz,
      city: s.pdf_city || BRANDING_DEFAULTS.footer_city,
      phone: s.pdf_phone || BRANDING_DEFAULTS.footer_phone,
      email: s.pdf_email || BRANDING_DEFAULTS.footer_email,
      website: s.pdf_website || BRANDING_DEFAULTS.footer_website
    };
  }

  function formatFooter(b, sep) {
    sep = sep || ' \u00b7 ';
    var parts = [];
    if (b.company) parts.push(b.company);
    if (b.address) parts.push(b.address);
    if (b.plz || b.city) {
      var loc = ((b.plz || '') + ' ' + (b.city || '')).trim();
      if (loc) parts.push(loc);
    }
    if (b.phone)   parts.push('Tel: ' + b.phone);
    if (b.email)   parts.push(b.email);
    if (b.website) parts.push(b.website);
    return parts.filter(function(p){ return p && ('' + p).trim(); }).join(sep);
  }

  // ══════════════════════════════════════════════════
  //  PRICING-KONFIGURATION
  //  Alle Plan-Definitionen, Limits, Features und Preise (monatlich + jährlich)
  //  zentral hier. Backend hat eine Spiegel-Tabelle und synct gegen diese Werte.
  //
  //  Anpassen: Werte einfach ändern, dann Frontend reload + Backend-Migration
  //  oder /api/v1/admin/sync-plans aufrufen, um die DB zu synchronisieren.
  //
  //  Limits-Konvention:
  //    -1 = unbegrenzt
  //    null/undefined = Feature deaktiviert
  // ══════════════════════════════════════════════════
  // V63: Komplett überarbeitete Plan-Struktur nach User-Spec
  // 4 Hauptpläne: Free / Starter / Investor (Bestseller) / Pro
  // Plus KI-Credit-Pakete für In-App-Käufe
  // V63.82: SERVICE-LEVELS — buchbar zusätzlich zu allen Pricing-Plänen
  var SERVICE_LEVELS = {
    silver: {
      key: 'silver',
      label: 'Silver Support',
      tagline: 'Schneller Antwort-Service',
      price_monthly_eur: 19,
      price_yearly_eur: 190,
      sort_order: 1,
      benefits: [
        'Antwort innerhalb von 24 h',
        'Hilfe bei konkreten Objekten & PDFs',
        'E-Mail-Priorisierung'
      ],
      icon: 'lifebuoy'
    },
    gold: {
      key: 'gold',
      label: 'Gold Service',
      tagline: 'Persönlicher Ansprechpartner',
      price_monthly_eur: 49,
      price_yearly_eur: 490,
      sort_order: 2,
      highlight: true,
      benefits: [
        'Antwort innerhalb von 6 h (werktags)',
        'Persönlicher Ansprechpartner',
        '1× 30-Min-Call pro Monat',
        'Hilfe bei Score- & KI-Ergebnissen'
      ],
      icon: 'star'
    },
    platinum: {
      key: 'platinum',
      label: 'Platinum Migration & Setup',
      tagline: 'Einmal-Service: Komplett-Setup',
      price_monthly_eur: null,
      price_yearly_eur: null,
      price_one_time_eur: 249,
      sort_order: 3,
      benefits: [
        '2–3 Stunden persönlicher Setup-Call',
        'Migration bestehender Objekte aus Excel/Listen',
        'Einrichtung von Branding, PDFs, Einstellungen'
      ],
      icon: 'badge',
      one_time: true
    }
  };

  function listServiceLevels() {
    return Object.keys(SERVICE_LEVELS)
      .map(function(k) { return SERVICE_LEVELS[k]; })
      .sort(function(a, b) { return (a.sort_order || 99) - (b.sort_order || 99); });
  }

  var PRICING = {
    free: {
      key: 'free',
      label: 'Free',
      tagline: 'Einstieg',
      price_monthly_eur: 0,
      price_yearly_eur: 0,
      sort_order: 1,
      limits: {
        objects:       1,
        max_saves:     3,        // V63: Max-Speicherungen
        ai_credits:    1,        // 1 Credit = 2 Anfragen (Demo)
        photos_per_obj: 3,
        watermark:     true
      },
      features: {
        full_calc:           true,    // Vollständige Kalkulation & Charts
        deal_score_v2:       'demo', // V63.82: nur Demo-Sichtbarkeit, kein voller Funktionsumfang
        deal_score_basic:    true,    // V112: Free zeigt BEIDE Scores (DS1 + DS2-Demo) — Marcels Wunsch
        ai_analysis_tab:     'full',  // V159: Free hat vollen Umfang als Demo
        market_data_fields:  true,    // V159: Free darf Marktdaten sehen (Demo)
        bmf_calc_export:     true,    // V159: BMF-Demo verfügbar
        export_pdf:          true,    // mit Wasserzeichen
        export_csv:          true,
        custom_finance_models: true,  // V159: ✅ zum Ausprobieren (Bauspar/Tilgungsaussetzung)
        custom_logo:         false,
        live_market_rates:   true,    // V159: Demo
        bank_pdf_a3:         false,
        bank_pdf_normal:     true,    // V159: Demo
        werbungskosten_pdf:  true,
        steuer_modul:        true,
        track_record_pdf:    true     // V159: Demo
      },
      stripe_price_id_monthly: null,
      stripe_price_id_yearly: null
    },
    starter: {
      key: 'starter',
      label: 'Starter',
      tagline: 'Privat-Investor',
      price_monthly_eur: 29,
      price_yearly_eur: 290,             // 2 Monate gratis (= 290 statt 348)
      sort_order: 2,
      limits: {
        objects:       5,
        max_saves:     -1,                // unbegrenzt
        ai_credits:    5,                 // 5 Credits = 10 Anfragen / Monat
        photos_per_obj: 6,
        watermark:     false              // PDFs ohne Wasserzeichen
      },
      features: {
        full_calc:           true,
        deal_score_v2:       false,       // Nur Basic-Score
        deal_score_basic:    true,        // 5 Faktoren sichtbar
        ai_analysis:         true,        // V168: explizit (war undefined)
        ai_analysis_tab:     'simplified', // V63.82: vereinfachte KI-Analyse
        ai_market_analysis:  false,        // V168: explizit (war undefined)
        market_data_fields:  false,        // V63.82: ausgegraut
        bmf_calc_export:     false,        // V63.82: BMF nur Investor+
        bankexport:          false,        // V168: explizit (war undefined)
        export_pdf:          true,
        export_csv:          true,
        bank_pdf_normal:     true,
        bank_pdf_premium:    false,        // V168: explizit (war undefined)
        werbungskosten_pdf:  true,
        steuer_modul:        true,        // Steuer-Modul voll
        investment_thesis_ai: false,       // V168: explizit (war undefined)
        custom_logo:         false,
        custom_finance_models: false,     // V159: ❌ ab Investor (Bauspar/Tilgungsaussetzung)
        custom_imports:      false,        // V168: explizit (war undefined)
        live_market_rates:   false,
        bank_pdf_a3:         false,
        track_record_pdf:    false,
        track_record_custom_cover: false,  // V168: explizit (war undefined)
        premium_pdf_layouts: false,        // V168: explizit (war undefined)
        priority_support:    false,        // V168: explizit (war undefined)
        api_access:          false,        // V168: explizit (war undefined)
        mietspiegel_vergleich: 'manual'
      },
      stripe_price_id_monthly: null,
      stripe_price_id_yearly: null
    },
    investor: {
      key: 'investor',
      label: 'Investor',
      tagline: 'Bestseller',
      price_monthly_eur: 59,
      price_yearly_eur: 590,             // 2 Monate gratis
      sort_order: 3,
      highlight: true,                    // Bestseller-Badge
      limits: {
        objects:       25,
        max_saves:     -1,
        ai_credits:    15,                // 15 Credits = 30 Anfragen / Monat
        photos_per_obj: 10,
        watermark:     false
      },
      features: {
        full_calc:           true,
        deal_score_v2:       true,        // Voller Deal Score 2.0 (24-30 KPIs)
        deal_score_basic:    true,        // V112: DS1 sichtbar (in Tab Kennzahlen eingeklappt, ausklappbar)
        export_pdf:          true,
        export_csv:          true,
        bank_pdf_normal:     true,
        bank_pdf_a3:         true,        // Bank-PDF A3
        bankexport:          true,        // V159: Bankexport
        werbungskosten_pdf:  true,
        steuer_modul:        true,
        track_record_pdf:    true,        // Track-Record-PDF
        custom_logo:         true,        // Eigenes Logo
        custom_finance_models: true,      // V159: ✅ Bauspar/Tilgungsaussetzung
        live_market_rates:   true,        // Live-Marktzinsen
        ai_analysis:         true,
        ai_analysis_tab:     'full',     // V63.82
        market_data_fields:  true,        // V63.82: Live-Marktdaten
        bmf_calc_export:     true,        // V63.82: BMF-Rechner & -Export
        ai_market_analysis:  true,        // V63.82: KI-Marktanalysen
        investment_thesis_ai: true,
        mietspiegel_vergleich: 'auto'
      },
      stripe_price_id_monthly: null,
      stripe_price_id_yearly: null
    },
    pro: {
      key: 'pro',
      label: 'Pro',
      tagline: 'Profis · Sachverständige',
      price_monthly_eur: 99,
      price_yearly_eur: 990,             // 2 Monate gratis
      sort_order: 4,
      limits: {
        objects:       -1,                // Unbegrenzt
        max_saves:     -1,
        ai_credits:    40,                // 40 Credits = 80 Anfragen / Monat
        photos_per_obj: 30,
        watermark:     false
      },
      features: {
        full_calc:                  true,
        deal_score_v2:              true,
        deal_score_basic:           true,    // V112: DS1 sichtbar (in Tab Kennzahlen eingeklappt, ausklappbar)
        export_pdf:                 true,
        export_csv:                 true,
        bank_pdf_normal:            true,
        bank_pdf_a3:                true,
        bankexport:                 true,
        werbungskosten_pdf:         true,
        steuer_modul:               true,
        track_record_pdf:           true,
        track_record_custom_cover:  true,
        investment_thesis_ai:       true,
        custom_logo:                true,
        live_market_rates:          true,
        ai_analysis:                true,
        premium_pdf_layouts:        true,    // Premium-PDF-Layouts
        api_access:                 true,    // API-Zugang
        priority_support:           true,    // Priorisierter Support
        ai_analysis_tab:            'full',   // V63.82
        market_data_fields:         true,     // V63.82
        bmf_calc_export:            true,     // V63.82
        ai_market_analysis:         true,     // V63.82
        custom_finance_models:      true,     // V63.82: personalisierte Zinsmodelle
        custom_imports:             true,     // V63.82: CSV/JSON Import
        migration_service:          true,     // 3h Setup
        mietspiegel_vergleich:      'auto'
      },
      stripe_price_id_monthly: null,
      stripe_price_id_yearly: null
    }
  };

  // V159: KI-Credit-Pakete (Landing-Page Wahrheit)
  // 1 Credit = 2 Anfragen. Credits ab Starter zubuchbar. Verfallen nicht.
  var AI_CREDIT_PACKAGES = [
    { key: 'pack_5',   credits: 5,   anfragen: 10,  price_eur: 2,  per_anfrage: 0.20, label: '5 Credits',   tag: 'Mal schnell prüfen' },
    { key: 'pack_15',  credits: 15,  anfragen: 30,  price_eur: 5,  per_anfrage: 0.17, label: '15 Credits',  tag: 'Mehrere Deals' },
    { key: 'pack_40',  credits: 40,  anfragen: 80,  price_eur: 12, per_anfrage: 0.15, label: '40 Credits',  tag: 'Aktiver Investor', highlight: true },
    { key: 'pack_100', credits: 100, anfragen: 200, price_eur: 25, per_anfrage: 0.13, label: '100 Credits', tag: 'Profi / Sachverständiger' }
  ];

  // V63: Yearly-Bonus-Konfiguration (was beim Wechsel auf jährlich extra dazu kommt)
  var YEARLY_BONUS = {
    free_months:           2,                      // 2 Monate gratis
    bonus_ai_credits:      50,                     // 50 Bonus-KI-Credits einmalig
    price_lock_months:     24                      // Preisgarantie 24 Monate
  };

  // ══════════════════════════════════════════════════
  //  PAYMENT-PROVIDER-KONFIG
  //  Aktuell wird KEINE echte Bezahlung verarbeitet — Plan-Wechsel passiert
  //  manuell durch den Admin (/api/v1/admin/users/:id/plan).
  //  Wenn du später aktiv wechseln willst, hier den Provider aktivieren.
  //  Unterstützte Provider (Adapter im Backend):
  //    'manual'  — Plan-Wechsel nur durch Admin-Interface (Default)
  //    'stripe'  — Stripe Checkout + Webhooks
  //    'mollie'  — Mollie (EU-Alternative, geplant)
  //    'paddle'  — Paddle Merchant-of-Record (geplant)
  // ══════════════════════════════════════════════════
  var PAYMENT = {
    provider: 'manual',         // 'manual' | 'stripe' | 'mollie' | 'paddle'
    currency: 'EUR',
    yearly_discount_label: '~17% gespart',  // Anzeigetext beim Toggle
    show_yearly_toggle: true,
    trial_days: 0               // 0 = keine Testphase
  };

  function getPlan(key) {
    return PRICING[key] || PRICING.free;
  }

  function listPlans() {
    return Object.keys(PRICING)
      .map(function(k) { return PRICING[k]; })
      .sort(function(a, b) { return (a.sort_order || 99) - (b.sort_order || 99); });
  }

  function getCurrentPlanKey() {
    // Reihenfolge: API-Subscription (wenn API-mode aktiv) > localStorage-override > 'free'
    if (typeof Sub !== 'undefined' && typeof Sub.getCurrentSync === 'function') {
      var apiPlan = Sub.getCurrentSync();
      if (apiPlan && PRICING[apiPlan]) return apiPlan;
    }
    var override = localStorage.getItem('dp_plan_override');
    // V63.7: Legacy 'business' / 'enterprise' als veraltet behandeln und auf free zurücksetzen
    if (override === 'business' || override === 'enterprise') {
      try { localStorage.removeItem('dp_plan_override'); } catch(e) {}
      return 'free';
    }
    if (override && PRICING[override]) return override;
    return 'free';
  }

  function setPlanOverride(key) {
    if (PRICING[key]) {
      localStorage.setItem('dp_plan_override', key);
    } else {
      localStorage.removeItem('dp_plan_override');
    }
  }

  function getCurrentPlan() {
    return getPlan(getCurrentPlanKey());
  }

  /**
   * Liefert Preis für einen Plan in der gewählten Abrechnungsperiode.
   *  interval: 'monthly' (default) oder 'yearly'
   */
  function getPrice(planKey, interval) {
    var p = getPlan(planKey);
    if (interval === 'yearly') return p.price_yearly_eur || 0;
    return p.price_monthly_eur || 0;
  }

  /**
   * Berechnet effektiven Monatspreis bei jährlicher Abrechnung
   * (für Anzeige "X €/Monat — bei jährlicher Zahlung").
   */
  function getEffectiveMonthlyPrice(planKey) {
    var p = getPlan(planKey);
    if (!p.price_yearly_eur) return p.price_monthly_eur || 0;
    return Math.round((p.price_yearly_eur / 12) * 100) / 100;
  }

  function getYearlySavings(planKey) {
    var p = getPlan(planKey);
    if (!p.price_monthly_eur || !p.price_yearly_eur) return 0;
    return (p.price_monthly_eur * 12) - p.price_yearly_eur;
  }

  function getPaymentConfig() { return PAYMENT; }

  // ── DEV-FLAGS ─────────────────────────────────────
  // Während der Entwicklung dürfen Limits softer greifen.
  // In Produktion: alle Flags auf false setzen.
  var DEV_FLAGS = {
    ALLOW_AI_ANALYSIS_IN_DEV: true,    // KI-Analyse blockiert nicht, auch wenn Limit erreicht
    ALLOW_EXPORTS_IN_DEV:     true,    // Exporte bleiben offen
    SHOW_PLAN_SWITCHER:       true     // UI-Switcher in Settings sichtbar
  };

  function isDev() {
    // Läuft auf localhost / 127.0.0.1 / 0.0.0.0
    var h = (typeof location !== 'undefined') ? location.hostname : '';
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '';
  }

  // ── PUBLIC API ────────────────────────────────────
  return {
    branding: { get: getBranding, formatFooter: formatFooter, defaults: BRANDING_DEFAULTS },
    pricing:  {
      plans: PRICING,
      list: listPlans,
      get: getPlan,
      current: getCurrentPlan,
      currentKey: getCurrentPlanKey,
      setOverride: setPlanOverride,
      getPrice: getPrice,
      getEffectiveMonthlyPrice: getEffectiveMonthlyPrice,
      getYearlySavings: getYearlySavings,
      payment: getPaymentConfig,
      // V63: Erweiterte API
      aiCreditPackages: AI_CREDIT_PACKAGES,
      yearlyBonus: YEARLY_BONUS,
      // V63.82: Service-Level
      serviceLevels: SERVICE_LEVELS,
      listServiceLevels: listServiceLevels,
      // Feature-Gate-Helper: Prüft ob ein Feature im aktuellen Plan aktiv ist
      // V63.82: Behandelt jetzt auch String-Modi: 'demo', 'simplified', 'full' = aktiv
      // Für den Demo-/Simplified-Modus wird zusätzlich featureMode() genutzt.
      hasFeature: function(featureKey) {
        // V186: Backend-Cache (DB) ist Quelle der Wahrheit.
        // Frontend config.js dient nur als Fallback wenn Sub noch nicht geladen.
        if (typeof Sub !== 'undefined' && typeof Sub.hasCachedFeature === 'function') {
          var backendValue = Sub.hasCachedFeature(featureKey);
          if (backendValue !== null) return backendValue;
        }
        // Fallback: alte config.js-Logik
        var p = getCurrentPlan();
        if (!p || !p.features) return false;
        var v = p.features[featureKey];
        if (v === true) return true;
        if (typeof v === 'string' && v.length > 0) return true;
        return false;
      },
      // V63.82: Liefert den Modus eines Features als String oder true/false
      // - 'full' / 'demo' / 'simplified' → genau das
      // - true → 'full'
      // - false / undefined → null
      featureMode: function(featureKey) {
        var p = getCurrentPlan();
        if (!p || !p.features) return null;
        var v = p.features[featureKey];
        if (v === true) return 'full';
        if (typeof v === 'string') return v;
        return null;
      },
      // V63.82: Liefert true wenn Feature voll verfügbar (kein 'demo'/'simplified')
      hasFullFeature: function(featureKey) {
        var p = getCurrentPlan();
        if (!p || !p.features) return false;
        return p.features[featureKey] === true;
      },
      // Limit-Helper: Prüft ob ein Limit erreicht ist (-1 = unbegrenzt)
      getLimit: function(limitKey) {
        var p = getCurrentPlan();
        if (!p || !p.limits) return -1;
        var v = p.limits[limitKey];
        return (v === undefined || v === null) ? -1 : v;
      }
    },
    // ═══════════════════════════════════════════════════════════
    // V30: MARKTZINSEN — manuell pflegbar
    // ═══════════════════════════════════════════════════════════
    // Diese Werte sind die Single Source of Truth für die Markt-
    // zinsen-Anzeige im Tab "Finanzierung". Sie kommen aus der
    // ECB-Pressemitteilung zur deutschen MFI-Zinsstatistik.
    //
    // ─── WIE UPDATEN? (Marcel) ───────────────────────────────
    // 1. Aktuelle Werte holen (monatlich, ca. 5. des Monats):
    //    https://www.ecb.europa.eu/press/stats/mfi/  (englisch)
    //    Oder direkt:
    //    https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/wohnungsbaukredite-an-private-haushalte
    //
    // 2. Im aktuellen Press-Release findest du den Block
    //    "loans for house purchase" mit 4 Zeilen für Deutschland:
    //      - floating rate / up to 1 year     → 'var'
    //      - over 1 and up to 5 years         → '1_5'
    //      - over 5 and up to 10 years        → '5_10'
    //      - over 10 years                    → 'over10'
    //
    // 3. Werte unten anpassen + asOf auf den Stand-Monat updaten.
    //
    // 4. Speichern, Browser hard-reload (Ctrl+F5) — fertig.
    //
    // Stand: ECB-Pressemitteilung Februar 2026 (publiziert 06.04.2026)
    // ═══════════════════════════════════════════════════════════
    // V63.74: DEAL-AKTION — Empfänger-E-Mails + Pakete
    // ═══════════════════════════════════════════════════════════
    // Zentrale Konfig für den Tab "Deal-Aktion". Anfragen gehen
    // an die hier hinterlegten Adressen oder den Backend-Endpoint
    // /api/v1/deal-action/submit.
    dealAction: {
      // V63.75: Brand-Daten (zentrale Anlaufstelle, KEIN persönlicher Name)
      brand: {
        name: 'Junker Immobilien',
        website: 'https://www.junker-immobilien.io',
        // Zentrale E-Mail – aktuell alles hier rein. Über die Felder unten
        // (bankPartner.email etc.) kann später pro Anfragetyp differenziert werden.
        centralEmail: 'info@junker-immobilien.io'
      },
      // V63.75: Calendly für Beratungs-Termine (statt Stripe)
      calendly: {
        enabled: true,
        url: 'https://calendly.com/junker_immobilien/kennenlernen',
        priceLabel: '89 € pro Stunde'
      },
      // Empfänger pro Anfragetyp – aktuell alle = centralEmail.
      // V185: Alle Mail-Empfänger auf info@junker-immobilien.io vereinheitlicht.
      // Marcel kann hier später pro Typ unterschiedliche Adressen hinterlegen.
      bankPartner: {
        name: 'Junker Immobilien — Finanzierung',
        email: 'info@junker-immobilien.io',
        fbEmail: 'info@junker-immobilien.io'
      },
      expert: {
        name: 'Junker Immobilien',
        email: 'info@junker-immobilien.io'
      },
      consult: {
        name: 'Junker Immobilien',
        email: 'info@junker-immobilien.io',
        priceQuick: 0,    // Schnell-Check kostenlos (Pro/Business)
        price60: 89       // 60-Min-Termin (entspricht Calendly)
      },
      // V63.75: Reduzierte Pflichtdokumente — nur Ausweis + Gehalt sind required.
      // Damit kann der User den Workflow durchtesten ohne alle Unterlagen.
      // Optionale Dokumente sind weiter im UI sichtbar und hochladbar.
      bankDocs: [
        { id: 'ausweis',     label: 'Personalausweis (Vorder- & Rückseite)', required: true },
        { id: 'gehalt',      label: 'Letzte 3 Gehaltsabrechnungen',           required: true },
        { id: 'steuerbesch', label: 'Letzter Einkommensteuerbescheid',        required: true },
        { id: 'selbstausk',  label: 'Selbstauskunft (ausgefüllt)',            required: true },
        { id: 'expose',      label: 'Exposé / Objektunterlagen',              required: true },
        { id: 'grundbuch',   label: 'Grundbuchauszug (falls vorhanden)',      required: true },
        { id: 'mvertraege',  label: 'Mietverträge / Mieterliste',             required: true },
        { id: 'energieausw', label: 'Energieausweis',                         required: true },
        { id: 'wfberech',    label: 'Wohnflächenberechnung',                  required: true },
        { id: 'fotos',       label: 'Lichtbilder Objekt (innen + außen)',     required: true }
      ],
      fbDocs: [
        { id: 'ausweis',    label: 'Personalausweis (Vorder- & Rückseite)', required: true },
        { id: 'gehalt',     label: 'Letzte 3 Gehaltsabrechnungen',           required: true },
        { id: 'eknachweis', label: 'Eigenkapitalnachweis (Kontoauszug)',     required: true },
        { id: 'schufa',     label: 'Schufa-Selbstauskunft',                  required: true },
        { id: 'expose',     label: 'Objekt-Exposé',                          required: true }
      ],
      // Welche Pläne dürfen den Bankexport automatisch mitsenden?
      bankExportPlans: ['investor', 'pro', 'business'],
      submitMode: 'auto'    // 'backend' | 'mailto' | 'auto'
    },

    // ═══════════════════════════════════════════════════════════
    // V63.76: INVESTMENTPROFIL — persönliche Default-Annahmen
    // ═══════════════════════════════════════════════════════════
    // Vom User in Settings → Investmentprofil pflegbar. Werden bei
    // jedem neuen Objekt vor-eingefüllt (newObj() / Quick-Check).
    // Persistiert in localStorage 'dp_investment_profile'.
    // ═══════════════════════════════════════════════════════════
    // V63.77: APP-START — Welcher View beim Öffnen der App?
    // ═══════════════════════════════════════════════════════════
    // 'objekt'      → Tab "Objekt" (Default, sicher)
    // 'quickcheck'  → Quick-Check Standalone-View
    // 'all-objects' → "Alle Objekte"-Übersicht
    // User-Override über Settings → Anzeige (localStorage 'dp_startup_view').
    startupView: 'objekt',

    investmentProfileDefaults: {
      // Finanzierung
      tilgung_default:        2.5,    // % p.a.
      zinsbindung_default:    10,     // Jahre
      ek_quote_default:       20,     // % vom Kaufpreis
      // Bewirtschaftung
      bwk_anteil_default:     22,     // % der NKM (nicht-umlagefähig)
      // Kennzahl-Schwellen (persönliche Mindest-Anforderungen)
      min_dscr:               1.20,   // <—— "ab hier kauf ich"
      min_cashflow_vor_st:    0,      // €/Monat
      max_ltv:                90,     // %
      // Steuern
      grenzsteuersatz:        42,     // %
      // Bundesland (für Grunderwerbsteuer-Default)
      bundesland:             'NW',   // ISO-Kürzel
      // Nebenkosten-Pauschalen
      notar_grundbuch:        2.0,    // %
      maklerkosten:           3.57,   // %
      // V63.90: KI-Analyse-Standardparameter (vorher nur als Selects im KI-Tab,
      // jetzt persönlicher Default — nutzt der KI-Prompt-Builder via hidden inputs)
      ai_strat:  'Buy & Hold (Langfristig halten)',
      ai_verk:   'Mittel (normale Situation)',
      ai_risk:   'Moderat (ausgewogen)',
      ai_markt:  'Ausgeglichen (stabil)'
    },

    marketRates: {
      // %-Werte (Effektivzinssätze, Neugeschäft, Wohnungsbaukredite DE)
      values: {
        'var':    3.48,
        '1_5':    3.37,
        '5_10':   3.55,
        'over10': 3.26
      },
      // YYYY-MM des Datenstands
      asOf: '2026-02',
      // Quelle für UI-Link
      sourceLabel: 'ECB-Pressemitteilung · Bundesbank-MFI-Statistik',
      sourceUrl:   'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen',
      // Vergleichslinks (Konditionen-Rechner — anders als Bundesbank-Durchschnitt)
      compareLinks: [
        { label: 'Interhyp',            url: 'https://www.interhyp.de/ratgeber/was-zaehlt/bauzinsen/aktuelle-bauzinsen.html' },
        { label: 'Dr. Klein',           url: 'https://www.drklein.de/bauzinsen.html' },
        { label: 'Baufi24',             url: 'https://www.baufi24.de/bauzinsen-aktuell/' },
        { label: 'Bundesbank-Statistik', url: 'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen' }
      ],

      // V210: Pfandbrief-Renditen pro Laufzeit (Fallback wenn API nicht greift)
      //   Marcel pflegt diese monatlich aus:
      //     https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/taegliche-zinsstruktur-fuer-pfandbriefe-650734
      //   (Kapitalmarktstatistik-PDF, Tabelle "Zinssatz bei Restlaufzeiten von ... Jahren")
      pfandbrief: {
        yields: {
          '5':  2.85,
          '10': 3.05,
          '15': 3.18,
          '20': 3.28
        },
        // Bank-Marge pro Bonitäts-/LTV-Stufe
        margins: {
          premium:  0.60,   // LTV ≤ 60%, Top-Bonität
          standard: 1.00,   // LTV 60–80%, normale Bonität
          schwach:  1.60    // LTV > 90% oder Bonität mittel
        },
        asOf: '2026-05',
        sourceLabel: 'Bundesbank Kapitalmarktstatistik · Pfandbrief-Zinsstruktur',
        sourceUrl: 'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/taegliche-zinsstruktur-fuer-pfandbriefe-650734'
      },

      // V211: Markt-Kontext (EZB-Leitzins + EURIBOR 3M)
      //   Marcel pflegt diese 1x/Monat aus ECB Press Release.
      //   Quelle EZB: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html
      //   Quelle EURIBOR: https://www.euribor-rates.eu/de/aktuelle-euribor-werte/2/euribor-zinssatz-3-monate/
      marketContext: {
        ecb_mrr:    2.15,  // EZB Hauptrefinanzierungssatz (Stand 05/2026)
        euribor_3m: 2.32,  // EURIBOR 3M (Stand 05/2026)
        asOf: '2026-05'
      }
    },
    dev:      { flags: DEV_FLAGS, isDev: isDev }
  };
})();

// V63.82: Globaler Plan-Helper für einfacheres Feature-Gating
// Beispiele:
//   if (Plan.can('bmf_calc_export')) { ... }
//   if (Plan.mode('ai_analysis_tab') === 'simplified') { ... }
//   if (Plan.atLimit('objects', currentObjectCount)) { showPaywall(); }
//   var max = Plan.limit('ai_credits');
//   var key = Plan.key();
window.Plan = {
  // Prüft ob ein Feature im aktuellen Plan überhaupt aktiv ist (auch 'demo'/'simplified' zählt als aktiv)
  can: function(featureKey) {
    return DealPilotConfig.pricing.hasFeature(featureKey);
  },
  // Prüft ob ein Feature voll verfügbar ist (kein 'demo'/'simplified')
  full: function(featureKey) {
    return DealPilotConfig.pricing.hasFullFeature(featureKey);
  },
  // Liefert den Modus: 'full' / 'demo' / 'simplified' / null
  mode: function(featureKey) {
    return DealPilotConfig.pricing.featureMode(featureKey);
  },
  // Liefert das Limit (-1 = unbegrenzt)
  limit: function(limitKey) {
    return DealPilotConfig.pricing.getLimit(limitKey);
  },
  // Prüft ob ein Limit erreicht ist (current >= limit)
  // -1 (unbegrenzt) liefert immer false.
  atLimit: function(limitKey, currentValue) {
    var lim = DealPilotConfig.pricing.getLimit(limitKey);
    if (lim < 0) return false;        // unbegrenzt
    return (currentValue || 0) >= lim;
  },
  // Liefert den aktuellen Plan-Key ('free' / 'starter' / 'investor' / 'pro')
  key: function() {
    return DealPilotConfig.pricing.currentKey();
  },
  // Liefert das aktuelle Plan-Objekt
  current: function() {
    return DealPilotConfig.pricing.current();
  },
  // V63.82: Hilfs-Funktion für Paywall-Anzeige — liefert true wenn der minimale
  // Plan für ein Feature höher ist als der aktuelle.
  needsUpgrade: function(featureKey) {
    return !this.can(featureKey);
  }
};
