'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT – config.js
   Zentrale Konfiguration:
   - Branding (zentral, nicht im PDF-Code verteilt)
   - Pricing-Pläne (Free / Investor / Pro / Business)
   - Dev-Flags
═══════════════════════════════════════════════════ */

// V1.1: Logo-Saga abgeschlossen + Auth-Style überarbeitet (intern: 1.1.222)
// Versionierungs-Strategie: Major.Minor.Patch (siehe CHANGELOG.md)
window.DealPilotVersion = {
  label:    'V1.1',
  major:    1,
  minor:    1,
  patch:    222,
  semver:   '1.1.222',
  build:    '2026-05-18',
  channel:  'stable',
  tagline:  'Investmentanalyse für Profis'
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
  // V192: Junker-Defaults als zentrale Konstante — werden für alle Pläne außer Pro genutzt
  var JUNKER_DEFAULTS = {
    company: 'Junker Immobilien',
    name: '',
    role: '',
    address: 'Hermannstr. 9',
    plz: '32609',
    city: 'Hüllhorst',
    phone: '+49 151 298 200 57',
    email: 'info@dealpilot.immo',
    website: 'https://www.junker-immobilien.io'
  };

  function getBranding() {
    var s = (typeof Settings !== 'undefined') ? Settings.get() : {};
    
    // V192: Plan-Gating — nur Pro-Plan-User dürfen eigenes Branding nutzen
    var isPro = false;
    try {
      var planKey = getCurrentPlanKey();
      isPro = (planKey === 'pro');
    } catch(e) { /* Falls Pricing-Modul noch nicht geladen → Default Junker */ }
    
    if (!isPro) {
      // Free, Starter, Investor → IMMER Junker-Defaults zurückgeben (ignoriert User-Settings)
      return {
        product_name: BRANDING_DEFAULTS.product_name,
        tagline: BRANDING_DEFAULTS.tagline,
        logo_b64: '',
        logo_path: BRANDING_DEFAULTS.logo_path,
        company: JUNKER_DEFAULTS.company,
        name: JUNKER_DEFAULTS.name,
        role: JUNKER_DEFAULTS.role,
        address: JUNKER_DEFAULTS.address,
        plz: JUNKER_DEFAULTS.plz,
        city: JUNKER_DEFAULTS.city,
        phone: JUNKER_DEFAULTS.phone,
        email: JUNKER_DEFAULTS.email,
        website: JUNKER_DEFAULTS.website,
        is_custom: false
      };
    }
    
    // Pro-Plan: User-Custom-Branding wenn gesetzt, sonst Junker-Defaults als Fallback
    return {
      product_name: BRANDING_DEFAULTS.product_name,
      tagline: BRANDING_DEFAULTS.tagline,
      logo_b64: s.pdf_logo_b64 || '',
      logo_path: BRANDING_DEFAULTS.logo_path,
      company: s.user_company || JUNKER_DEFAULTS.company,
      name: s.user_name || '',
      role: s.user_role || '',
      address: s.pdf_address || JUNKER_DEFAULTS.address,
      plz: s.pdf_plz || JUNKER_DEFAULTS.plz,
      city: s.pdf_city || JUNKER_DEFAULTS.city,
      phone: s.pdf_phone || JUNKER_DEFAULTS.phone,
      email: s.pdf_email || JUNKER_DEFAULTS.email,
      website: s.pdf_website || JUNKER_DEFAULTS.website,
      is_custom: !!(s.user_company || s.pdf_phone || s.pdf_email)
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
        marktreport: false, rnd_full: false, json_backup: false, excel_import: false, // v494-matrix
        full_calc:           true,    // Vollständige Kalkulation & Charts
        deal_score_v2:       'demo', // V63.82: nur Demo-Sichtbarkeit, kein voller Funktionsumfang
        deal_score_basic:    true,    // V112: Free zeigt BEIDE Scores (DS1 + DS2-Demo) — Marcels Wunsch
        ai_analysis_tab:     'full',  // V159: Free hat vollen Umfang als Demo
        market_data_fields:  false,   // v1160-GATE: Entscheidung Marcel 13.08.2026 —
                                      //   „Gate zuziehen, das Versprechen gilt."
                                      //   Vorher true mit dem Kommentar „Free darf Marktdaten
                                      //   sehen (Demo)" — der Wert war aber VOLL, nicht 'demo'.
                                      //   Landing (Cockpit-Matrix Z. 12) und pricing-modal
                                      //   (Z. 261 UND Z. 505) sagen bei Free „gesperrt*", und
                                      //   die Fussnote wird noch deutlicher: „Marktdatenfelder
                                      //   in Free & Starter als Vorschau gesperrt, ab Investor
                                      //   freigeschaltet." Starter fuehrt dafuer false — Free
                                      //   bekommt jetzt dasselbe. Derselbe Fall wie W42-free-bmf
                                      //   unten, dieselbe Entscheidung.
        bmf_calc_export:     false,   // W42-free-bmf: Entscheidung 16.07.2026 —
                                      //   Free bekommt keinen BMF-Rechner. Vorher stand hier
                                      //   true ("V159: BMF-Demo verfuegbar"), waehrend Landing
                                      //   (Z.2850) UND pricing-modal (Z.264/508) bei Free '–'
                                      //   sagen. Der Free-User durfte etwas, das ihm nirgends
                                      //   versprochen wurde. Jetzt sagen alle drei dasselbe.
        bmf_advanced:        false,   // W41: Advanced ist Pro+
        beleg_import:        false,   // v1007-beleg: KI-Beleg-Import (Investor+)
        /* W41-bmf-gate: 'bmf_advanced' stand in KEINEM Plan. hasFeature()
           liest zuerst die DB und faellt sonst hierher zurueck — kannte die
           DB den Schluessel nicht, war er fuer JEDEN false, auch fuer Pro.
           Damit konnte niemand den BMF-Rechner oeffnen. */
        export_pdf:          true,    // mit Wasserzeichen
        export_csv:          false,   // v494-matrix: Rohdatenexport nur Pro
        /* v1171: war true. Die DB führt für free `custom_finance_models=false`,
           und die DB ist die Quelle — ein echter Free-Nutzer hatte es nie.
           Der Fallback log aber im STARTFENSTER, bis die DB antwortet, und
           zeigte kurz eine Funktion, die gleich wieder verschwindet.
           Dasselbe Muster wie v1160, anderer Schlüssel. */
        custom_finance_models: false,  // V159/v1171: ab Investor (Bauspar/Tilgungsaussetzung)
        custom_logo:         false,
        live_market_rates:   false,   // v1160-GATE: Entscheidung Marcel 13.08.2026.
                                      //   Vorher true mit dem Kommentar „Demo" — der Wert war
                                      //   aber VOLL. Landing und pricing-modal fuehren bei Free
                                      //   UND Starter ein „–", also gar nicht. Starter hat
                                      //   dafuer bereits false (Z. 291); Free bekommt dasselbe.
        bank_pdf_a3:         false,
        bank_pdf_normal:     true,    // V159: Demo
        werbungskosten_pdf:  false,   // v494-matrix: erst ab Investor
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
        marktreport: true, rnd_full: false, json_backup: false, excel_import: true, // v494-matrix
        full_calc:           true,
        deal_score_v2:       false,       // Nur Basic-Score
        deal_score_basic:    true,        // 5 Faktoren sichtbar
        ai_analysis:         true,        // V168: explizit (war undefined)
        ai_analysis_tab:     'simplified', // V63.82: vereinfachte KI-Analyse
        ai_market_analysis:  true,         // v494-matrix: Matrix — Lagebewertung ab Starter
        market_data_fields:  false,        // V63.82: ausgegraut
        bmf_calc_export:     false,        // V63.82: BMF nur Investor+
        beleg_import:        false,   // v1007-beleg
        bmf_advanced:        false,        // W41
        bankexport:          false,        // V168: explizit (war undefined)
        export_pdf:          true,
        export_csv:          false,   // v494-matrix
        bank_pdf_normal:     true,
        bank_pdf_premium:    false,        // V168: explizit (war undefined)
        werbungskosten_pdf:  false,   // v494-matrix: erst ab Investor
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
        ai_credits:    40,                // v494-matrix: 40 L Kerosin / Monat
        photos_per_obj: 10,
        watermark:     false
      },
      features: {
        marktreport: true, rnd_full: true, json_backup: false, excel_import: true, // v494-matrix
        full_calc:           true,
        deal_score_v2:       true,        // Voller Deal Score 2.0 (24-30 KPIs)
        deal_score_basic:    true,        // V112: DS1 sichtbar (in Tab Kennzahlen eingeklappt, ausklappbar)
        export_pdf:          true,
        export_csv:          false,   // v494-matrix
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
        beleg_import:        true,    // v1007-beleg
        bmf_advanced:        false,       // W41: Landing Z.2850 sagt Investor '✓',
                                          //      Pro '✓ Advanced'. Genau das gilt jetzt.
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
      tagline: 'Profis · Sachverständige · White-Label',
      price_monthly_eur: 99,
      price_yearly_eur: 990,             // 2 Monate gratis
      sort_order: 4,
      limits: {
        objects:       -1,                // Unbegrenzt
        max_saves:     -1,
        ai_credits:    100,               // v494-matrix: 100 L Kerosin / Monat
        photos_per_obj: 30,
        watermark:     false
      },
      features: {
        theme_palette:       true,    /*v901-theme*/
        marktreport: true, rnd_full: true, json_backup: true, excel_import: true, // v494-matrix
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
        beleg_import:                true,     // v1007-beleg
        bmf_advanced:               true,     // W41: das Pro-Extra. Der Partner-Klon
                                              //      (W9) erbt es automatisch mit.
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

  // v489-kerosin: Kerosin-Pakete (Landing-Page Wahrheit) — vorher KI-Credit-Pakete
  // 1 Liter = 1 Pilot-Anfrage (klein). Kerosin ab Starter zubuchbar. Verfällt nicht.
  // Kompat: credits/anfragen/per_anfrage spiegeln liter/per_liter, damit
  // bestehende Konsumenten (plan-audit.js etc.) nicht brechen.
  var AI_CREDIT_PACKAGES = [
    { key: 'kerosin_10',  liter: 10,  per_liter: 0.20,  credits: 10,  anfragen: 10,  price_eur: 2,  per_anfrage: 0.20,  label: '10 Liter',  tag: 'Mal schnell prüfen',  flight: '✈ Kurzstrecke',       gauge_off: 164.8, gauge_deg: -57.6 },
    { key: 'kerosin_28',  liter: 28,  per_liter: 0.18,  credits: 28,  anfragen: 28,  price_eur: 5,  per_anfrage: 0.18,  label: '28 Liter',  tag: 'Mehrere Deals',        flight: '✈✈ Mittelstrecke',   gauge_off: 116.6, gauge_deg: -14.4 },
    { key: 'kerosin_90',  liter: 90,  per_liter: 0.167, credits: 90,  anfragen: 90,  price_eur: 15, per_anfrage: 0.167, label: '90 Liter',  tag: 'Aktiver Investor',     flight: '✈✈✈ Langstrecke',  gauge_off: 56.3,  gauge_deg: 39.6, highlight: true },
    { key: 'kerosin_160', liter: 160, per_liter: 0.156, credits: 160, anfragen: 160, price_eur: 25, per_anfrage: 0.156, label: '160 Liter', tag: 'Maximale Reichweite',  flight: '🌍 Interkontinental', gauge_off: 14.1,  gauge_deg: 77.4 }
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
    trial_days: 7               // TR7-trial: 7 Tage Pro ab Registrierung.
                                // Reine ANZEIGE-Wahrheit fuer die UI — die
                                // verbindliche Laufzeit steht in plan_trials
                                // (Backend). Hier nichts berechnen.
  };

  function getPlan(key) {
    return PRICING[key] || PRICING.free;
  }

  function listPlans() {
    return Object.keys(PRICING)
      .map(function(k) { return PRICING[k]; })
      .sort(function(a, b) { return (a.sort_order || 99) - (b.sort_order || 99); });
  }

  /* ═══ v1163-pruefplan ═════════════════════════════════════════════
     Der Plan-Override war im API-Modus WIRKUNGSLOS: getCurrentPlanKey()
     fragte zuerst Sub.getCurrentSync(), und ein echtes Abo im Cache gewann
     immer. Gemessen: dp_plan_override='free' gesetzt, currentKey() blieb
     'partner'. Damit war „jeden Plan einmal durchklicken" nicht simulierbar
     — der Prueflauf aus Backlog-Punkt 6 haette je ein echtes Konto gebraucht.

     Warum nicht einfach Vorrang fuer den Override? Weil das JEDEN Nutzer
     mit einer Konsolenzeile auf 'partner' hochstufen wuerde. Das Gate ist
     zwar nur Anzeige und das Backend setzt eigenstaendig durch — aber ein
     Werkzeug, das nebenbei die Schaufenstersperre oeffnet, baut man nicht.

     Deshalb: DER OVERRIDE DARF NUR HERABSTUFEN. Wer ein Partner-Abo hat,
     kann sich free/starter/investor/pro ansehen; nach oben geht nichts.
     Das genuegt fuer den Prueflauf und verschenkt keine Rechte.

     WICHTIG fuer den Pruefer: das simuliert das FRONTEND-Gate, nicht die
     Durchsetzung im Backend. Ein herabgestufter Client sieht die Sperren,
     die API antwortet weiterhin nach dem echten Abo. */
  var PLAN_RANG = { free: 0, starter: 1, investor: 2, pro: 3, partner: 4 };

  /* Liefert den WIRKSAMEN Herabstufungs-Override gegen einen echten Plan,
     sonst null. Eine Quelle fuer beide Leser (Planschluessel UND Features) —
     laufen die auseinander, zeigt die Oberflaeche 'free' und schaltet
     trotzdem Partner-Funktionen frei. Das waere schlimmer als gar kein
     Pruefmodus, weil es wie ein bestandener Test aussieht. */
  function pruefOverride(echterPlan) {
    try {
      var ov = localStorage.getItem('dp_plan_override');
      if (ov && PRICING[ov] && PLAN_RANG[ov] != null && PLAN_RANG[echterPlan] != null
          && PLAN_RANG[ov] < PLAN_RANG[echterPlan]) return ov;
    } catch (e) {}
    return null;
  }

  function getCurrentPlanKey() {
    // Reihenfolge: API-Subscription (wenn API-mode aktiv) > localStorage-override > 'free'
    if (typeof Sub !== 'undefined' && typeof Sub.getCurrentSync === 'function') {
      var apiPlan = Sub.getCurrentSync();
      if (apiPlan && PRICING[apiPlan]) {
        /* v1163: Herabstufung zum Pruefen zulassen — aber NIE hinauf. */
        {
          var ovDown = pruefOverride(apiPlan);
          if (ovDown) {
            if (!getCurrentPlanKey._ovWarned) {
              getCurrentPlanKey._ovWarned = true;
              console.warn('[Plan] Pruefmodus: ' + apiPlan + ' wird als ' + ovDown
                + ' angezeigt. Nur das Frontend-Gate — das Backend antwortet nach dem echten Abo.'
                + ' Aufheben: localStorage.removeItem("dp_plan_override")');
            }
            return ovDown;
          }
        }
        return apiPlan;
      }
    }
    var override = localStorage.getItem('dp_plan_override');
    // V63.7: Legacy 'business' / 'enterprise' als veraltet behandeln und auf free zurücksetzen
    if (override === 'business' || override === 'enterprise') {
      try { localStorage.removeItem('dp_plan_override'); } catch(e) {}
      return 'free';
    }
    if (override && PRICING[override]) return override;
    /* W4-nosilent: NIE wortlos auf free herabstufen. Sub.getCurrentSync() lieferte
       null, sobald der Cache geleert war (5 Aufrufer) -> zahlende Kunden bekamen
       Wasserzeichen + gesperrte Features, ohne dass irgendwo etwas geloggt wurde. */
    try {
      var _lk = localStorage.getItem('dp_last_plan');
      if (_lk && PRICING[_lk]) {
        if (!getCurrentPlanKey._warned) {
          getCurrentPlanKey._warned = true;
          console.warn('[Plan] Subscription nicht im Cache — nutze letzten bekannten Plan:', _lk);
        }
        return _lk;
      }
    } catch (e) {}
    return 'free';
  }

  /* ═══ v1081-planfamilie ═══════════════════════════════════════════
     'partner' ist ein ERWEITERTER 'pro' — reseller-portal.js:568 klont dafuer
     die Pro-Features in PRICING.partner ("Partner ist ein erweiterter Pro").
     Fuenf Stellen verglichen trotzdem hart auf currentKey() === 'pro' und
     sperrten damit ausgerechnet den HOEHEREN Plan aus:
       netzwerk-einreichung.js:26  Netzwerk-Einreichung -> Teaser statt Formular
       deal-action.js:60           Deal-Aktion-Konfiguration
       apikeys.js:12               API-Zugang (Partner hat api_access in der DB)
       settings.js:1360            Branding-Routing
       config.js:846               Farbpalette (_isPalette)
     settings.js:3164/3247 machen es richtig ((k==='pro'||k==='partner')) —
     das ist die Vorlage. Ab hier gibt es dafuer EINE Quelle.
     Erweitert sich die Familie, steht die Liste an genau einer Stelle. */
  var PRO_FAMILIE = ['pro', 'partner'];
  function isProOrAbove() {
    try { return PRO_FAMILIE.indexOf(getCurrentPlanKey()) >= 0; } catch (e) { return false; }
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
      isProOrAbove: isProOrAbove,   /* v1081-planfamilie: 'pro' ODER 'partner' */
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
          /* v1163: Im Pruefmodus (wirksame Herabstufung) die DB UEBERSPRINGEN.
             Sonst zeigt die Oberflaeche den simulierten Plan, die Funktionen
             blieben aber die des echten Abos — ein halber Schalter, der einen
             bestandenen Test vortaeuscht. Dann gilt der config.js-Zweig fuer
             den simulierten Plan. */
          var echt = (typeof Sub.getCurrentSync === 'function') ? Sub.getCurrentSync() : null;
          if (!(echt && pruefOverride(echt))) {
            var backendValue = Sub.hasCachedFeature(featureKey);
            if (backendValue !== null) return backendValue;
          }
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
        centralEmail: 'info@dealpilot.immo'
      },
      // V63.75: Calendly für Beratungs-Termine (statt Stripe)
      calendly: {
        enabled: true,
        url: 'https://calendly.com/junker_immobilien/kennenlernen',
        priceLabel: '89 € pro Stunde'
      },
      // Empfänger pro Anfragetyp – aktuell alle = centralEmail.
      // V185: Alle Mail-Empfänger auf info@dealpilot.immo vereinheitlicht.
      // Marcel kann hier später pro Typ unterschiedliche Adressen hinterlegen.
      bankPartner: {
        name: 'Junker Immobilien — Finanzierung',
        email: 'info@dealpilot.immo',
        fbEmail: 'info@dealpilot.immo'
      },
      expert: {
        name: 'Junker Immobilien',
        email: 'info@dealpilot.immo'
      },
      consult: {
        name: 'Junker Immobilien',
        email: 'info@dealpilot.immo',
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
      bankExportPlans: ['investor', 'pro'],   /* v1161-PLANS: 'business' war ein toter Eintrag */
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
      zins_override:          null,   // eigener Zinssatz (%); null = indikativer Pfandbrief-Satz
      zins_margin:            'standard', // Zins-Stufe: premium (LTV<=60%) / standard (60-80%) / schwach (>90%)
      hausgeld_pct:           null,   // Hausgeld-Annahme als % vom Kaufpreis p.a.; null = aus
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
          premium:  0.40,   // LTV ≤ 60%, Top-Bonität
          standard: 0.70,   // LTV 60–80%, normale Bonität
          schwach:  1.00    // LTV > 90% oder Bonität mittel
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


/* ═══════════════════ v901-theme — zentrales Theme-Fundament (Phase 2a) ═══════════════════
   Skin (Hell/Dunkel) fuer ALLE Plaene · Akzent-Palette nur Pro (theme_palette).
   Faerbt app-weit via --gold (setzt v900 voraus) + Modale via storage._dpApplyThemeVars. */
(function(){
  if(!window.DealPilotConfig || !DealPilotConfig.branding) return;
  var DPC = window.DealPilotConfig;
  var SKINS = ['obsidian','hell','slate','mono'];
  var DEF  = { skin:'obsidian', accent:'#C9A84C', obsidian:'#070707' };

  function _rgb(h){h=(h||'').replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c;}).join('');
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function _hex(r,g,b){function c(x){x=Math.max(0,Math.min(255,Math.round(x)));return ('0'+x.toString(16)).slice(-2);}return '#'+c(r)+c(g)+c(b);}
  function _lighten(h,p){var a=_rgb(h);return _hex(a[0]+(255-a[0])*p/100,a[1]+(255-a[1])*p/100,a[2]+(255-a[2])*p/100);}
  function _darken(h,p){var a=_rgb(h);return _hex(a[0]*(1-p/100),a[1]*(1-p/100),a[2]*(1-p/100));}

  /* ═══════════════════════════════════════════════════════════════════════
     v1097 · Markentoene mit Mindestkontrast (TR9 -> TR10)

     BEFUND, gemessen mit Partner-Rot #7B2D3B und mit Hellgelb #F0D000:

       --gold-2 = _lighten(akzent, 8)   33 Stellen, ALLE auf dunklem Grund
                                        bei #7B2D3B -> #863e4b, Kontrast 2,26
       --gold-d = _darken(akzent, 9)    19 Stellen, ALLE auf hellem Grund
                                        bei #F0D000 -> #dabd00, Kontrast 1,86

     Der Fehler ist die feste Prozent-Ableitung: "8 % heller als der Akzent"
     sagt nichts darueber, ob der Ton auf seinem Grund lesbar IST. Bei einem
     ohnehin dunklen Akzent bleibt --gold-2 dunkel, bei einem hellen bleibt
     --gold-d hell.

     Deshalb: erst den bisherigen Wert bilden, und NUR wenn der den
     Mindestkontrast verfehlt, die Helligkeit nachziehen — in OKLab, damit
     der Farbton und moeglichst viel Saettigung erhalten bleiben. Gemessen
     gegen die RGB-Aufhellung: #7B2D3B ergibt ueber OKLab #c0727e mit
     Saettigung 0,41 statt #ab7982 mit 0,29.

     DIE SCHWELLEN STEHEN NICHT WILLKUERLICH, sie sind an der eigenen Marke
     gemessen: das Haus-Dunkelgold #9a7f33 liegt auf Weiss bei 3,85 -> 3,8.
     Auf der dunklen Seite waere das Haus-Gold #E8C964 mit 10,44 fuer jeden
     farbigen Akzent unerreichbar, dort gilt die uebliche Schwelle 4,5.

     WER NICHTS AENDERT, MERKT NICHTS: Standard-Gold, Statusgruen und
     Status-Rot erfuellen die Schwellen bereits und kommen unveraendert
     heraus (nachgemessen, siehe BACKLOG).
     ═══════════════════════════════════════════════════════════════════════ */
  var _GRUND_DUNKEL = [26,29,34];   /* #1A1D22 — die HELLSTE dunkle Flaeche
                                       (Objektkarte in "konsole"). Gegen
                                       Schwarz ist der Kontrast dann besser,
                                       nie schlechter. */
  var _GRUND_HELL   = [255,255,255];
  var _MIN_DUNKEL = 4.5, _MIN_HELL = 3.8;

  function _lum(a){function f(x){x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);}
    return 0.2126*f(a[0])+0.7152*f(a[1])+0.0722*f(a[2]);}
  function _kontrast(a,b){var l1=_lum(a),l2=_lum(b);
    return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);}

  /* sRGB <-> OKLab (Ottosson). Gegen die CSS-Referenz oklch(from ...) im
     Browser geprueft: Abweichung 0 auf allen drei Kanaelen. Bewusst in
     JS gerechnet und nicht per CSS — das Ergebnis muss als Hex in Tokens
     UND in den Sweeper, und var()/oklch() traegt nicht ueberall
     (SVG-Attribute, Canvas, jsPDF). */
  function _s2l(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function _l2s(c){c=c<=0.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-0.055;
    return Math.round(Math.max(0,Math.min(1,c))*255);}
  function _toLab(a){var r=_s2l(a[0]),g=_s2l(a[1]),b=_s2l(a[2]);
    var l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b);
    var m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b);
    var s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
    return [0.2104542553*l+0.7936177850*m-0.0040720468*s,
            1.9779984951*l-2.4285922050*m+0.4505937099*s,
            0.0259040371*l+0.7827717662*m-0.8086757660*s];}
  function _fromLab(L,A,B){var l=Math.pow(L+0.3963377774*A+0.2158037573*B,3);
    var m=Math.pow(L-0.1055613458*A-0.0638541728*B,3);
    var s=Math.pow(L-0.0894841775*A-1.2914855480*B,3);
    return [_l2s( 4.0767416621*l-3.3077115913*m+0.2309699292*s),
            _l2s(-1.2684380046*l+2.6097574011*m-0.3413193965*s),
            _l2s(-0.0041960863*l-0.7034186147*m+1.7076147010*s)];}

  /* Der Ton fuer DUNKLE Flaechen: heller ziehen, bis er traegt. */
  function tonAufDunkel(akzent){
    var start = _lighten(akzent, 8);                      /* wie bisher */
    if(_kontrast(_rgb(start), _GRUND_DUNKEL) >= _MIN_DUNKEL) return start;
    var lab = _toLab(_rgb(start));
    for(var L = lab[0] + 0.02; L <= 0.95; L += 0.02){
      var c = _fromLab(L, lab[1], lab[2]);
      if(_kontrast(c, _GRUND_DUNKEL) >= _MIN_DUNKEL) return _hex(c[0],c[1],c[2]);
    }
    var e = _fromLab(0.95, lab[1], lab[2]); return _hex(e[0],e[1],e[2]);
  }
  /* Der Ton fuer HELLE Flaechen: dunkler ziehen, bis er traegt. */
  function tonAufHell(akzent){
    var start = _darken(akzent, 9);                       /* wie bisher */
    if(_kontrast(_rgb(start), _GRUND_HELL) >= _MIN_HELL) return start;
    var lab = _toLab(_rgb(start));
    for(var L = lab[0] - 0.02; L >= 0.08; L -= 0.02){
      var c = _fromLab(L, lab[1], lab[2]);
      if(_kontrast(c, _GRUND_HELL) >= _MIN_HELL) return _hex(c[0],c[1],c[2]);
    }
    var e = _fromLab(0.08, lab[1], lab[2]); return _hex(e[0],e[1],e[2]);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     v1113 · Text AUF der Markenflaeche (dritte Ableitung neben TR9/TR10)

     BEFUND (Backlog "Gold auf Gold", Bild Screenshot 2026-08-06 144507):
     Unter jeder hellen Vorlage macht body.dp-chrome-hell die Score-Karte
     zur Markenflaeche (linear-gradient aus --gold-hi/--gold/--gold-lo).
     Die Texte darauf blieben die fuer DUNKLEN Grund gebauten:

       #hdr-badges .sc-l   color:var(--gold)             k = 1,06
       #hdr-badges .sc-sub color:rgba(168,162,153,.95)   k = 1,16
       .sc-grade           Statusgruen #2E8455           k = 1,97

     tonAufDunkel/tonAufHell helfen hier NICHT: sie rechnen gegen zwei feste
     Gruende (#1A1D22 und Weiss). Der Grund ist hier die Marke selbst — und
     die ist mal hell (Gold rgb(206,173,82)) und mal dunkel (Partner-Rot
     rgb(126,58,70)). GEMESSEN: ein fest dunkler Ton, der auf Gold 5,78
     erreicht, faellt auf Partner-Rot auf 2,16. Es ist derselbe Denkfehler
     wie die feste Prozent-Ableitung aus v1097, nur eine Ebene weiter.

     Deshalb entscheidet die Helligkeit des GRUNDES die Richtung, und
     gezogen wird wieder in OKLab. Das gilt fuer jede Farbe, nicht nur fuer
     den Akzent — Statusgruen laeuft durch dieselbe Funktion und bleibt
     dabei Gruen (nur die Helligkeit wandert, Farbton und Saettigung
     bleiben). Das ist ausdruecklich KEIN Tokenisieren der Statusfarben.
     ═══════════════════════════════════════════════════════════════════════ */
  var _MIN_MARKE = 4.5;

  /* Zieht `farbe` so lange in OKLab, bis sie auf `grund` traegt.
     Richtung aus der Helligkeit des Grundes: heller Grund -> dunkler ziehen.
     Erfuellt der Startwert die Schwelle schon, kommt er unveraendert
     zurueck — wer nichts aendert, merkt nichts (Muster aus v1097). */
  function tonFuerGrund(farbe, grund, min){
    var f = _rgb(farbe), g = (typeof grund === 'string') ? _rgb(grund) : grund;
    min = min || _MIN_MARKE;
    if(_kontrast(f, g) >= min) return _hex(f[0],f[1],f[2]);
    var lab = _toLab(f);
    var runter = _lum(g) > 0.18;                 /* heller Grund -> abdunkeln */
    var schritt = runter ? -0.02 : 0.02;
    var ende    = runter ?  0.04 : 0.99;
    for(var L = lab[0] + schritt; runter ? L >= ende : L <= ende; L += schritt){
      var c = _fromLab(L, lab[1], lab[2]);
      if(_kontrast(c, g) >= min) return _hex(c[0],c[1],c[2]);
    }
    var e = _fromLab(ende, lab[1], lab[2]); return _hex(e[0],e[1],e[2]);
  }

  /* Die Markenflaeche ist ein Verlauf. Gerechnet wird gegen den Stopp, der
     dem Text am naechsten kommt — sonst traegt der Ton nur im Mittel und
     versagt an einem Ende der Karte. */
  function grundDerMarke(akzent){
    var stopps = [_rgb(akzent), _rgb(_lighten(akzent,22)), _rgb(_darken(akzent,16))];
    return stopps;
  }
  function tonAufMarke(akzent, startfarbe, min){
    var stopps = grundDerMarke(akzent), ton = startfarbe || akzent;
    /* je Stopp nachziehen, der strengste gewinnt */
    for(var i = 0; i < stopps.length; i++) ton = tonFuerGrund(ton, stopps[i], min);
    return ton;
  }

  function _isPalette(){ /*v904-palette-fix*/
    if(window.DP_THEME_PALETTE_FORCE===true) return true;            // Test/Dev-Bypass
    try{
      /* v1081-planfamilie: war ==='pro' und sperrte den Partner (hoeherer Plan) aus */
      if(DPC.pricing.isProOrAbove && DPC.pricing.isProOrAbove()) return true;   // Frontend-only: an Plan-Key
      if(DPC.pricing.hasFeature && DPC.pricing.hasFeature('theme_palette')) return true;  // spaeter, wenn Backend es kennt
    }catch(e){}
    return false;
  }
  function _validSkin(s){ return SKINS.indexOf(s)>=0 ? s : DEF.skin; }

  function getTheme(){
    var skin = _validSkin(localStorage.getItem('dp_theme_skin') || DEF.skin);   // alle Plaene
    var SKIN_ACCENT = { obsidian:'#C9A84C', hell:'#C9A84C', slate:'#2F6FED', mono:'#1A1A1A' }; /*v907-skin-accent*//*v909-hell-gold*/
    var acc = SKIN_ACCENT[skin] || DEF.accent;                                  // Skin-Default; Palette (Pro) ueberschreibt unten
    if(_isPalette()){ var a=localStorage.getItem('dp_theme_accent'); if(a && /^#[0-9a-fA-F]{6}$/.test(a)) acc=a; }
    return { skin:skin, accent:acc, accentHi:_lighten(acc,22), accentLo:_darken(acc,16), obsidian:DEF.obsidian };
  }

  function setTheme(patch){
    patch = patch || {};
    if(typeof patch.skin === 'string') localStorage.setItem('dp_theme_skin', _validSkin(patch.skin));
    if(typeof patch.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.accent)){
      if(_isPalette()) localStorage.setItem('dp_theme_accent', patch.accent);   // sonst ignoriert (gated)
    }
    applyTheme();
    return getTheme();
  }

  function applyTheme(){
    var t = getTheme(), r = document.documentElement.style;
    /* ═══════════════════════════════════════════════════════════════════
       v1114 · Ein aktives Whitelabel darf hier NICHT ueberschrieben werden.

       GEMESSEN (Mitschnitt auf setProperty, Partner-Konto mit Akzent
       #b33d29):
         1089 ms  --gold=#b33d29   whitelabel-override.js:497 <- _ownerBoot
         1096 ms  --obsidian=…     whitelabel-override.js:517 <- _ownerBoot
         1835 ms  --gold=#C9A84C   config.js  <- setTimeout(boot,1600)

       applyTheme() weiss nichts vom Whitelabel: getTheme() liest
       dp_theme_accent, das Whitelabel liegt aber in der DB des Partners.
       Es setzte deshalb 746 ms nach dem Sweeper wieder Standard-Gold.

       Sichtbare Folge und genau Marcels Befund "einzeln geaenderte Farben
       wirken nicht": ein GEMISCHTER Zustand. Die 443 vom Sweeper direkt
       angefassten Elemente behalten die Partnerfarbe (er schreibt
       Literale), alles Tokenbasierte faellt auf DealPilot-Gold zurueck.

       Der Akzent-Teil wird deshalb uebersprungen, sobald der Sweeper aktiv
       ist. Alles andere in dieser Funktion (Skin-Attribut, Logo-Tausch,
       die v1113-Markentoene) laeuft weiter — die haengen an --gold, das
       dann eben das Whitelabel-Gold ist. */
    var _wlAktiv = false;
    try { _wlAktiv = !!(window.DealPilotWhitelabel && DealPilotWhitelabel.isActive()); } catch(e){}
    if(_wlAktiv){
      var _wlAcc = null;
      try { _wlAcc = DealPilotWhitelabel.accent(); } catch(e){}
      if(_wlAcc) t = { skin: t.skin, accent: _wlAcc,
                       accentHi: _lighten(_wlAcc,22), accentLo: _darken(_wlAcc,16),
                       obsidian: t.obsidian, _wl: true };
    }
    var _gd = (!t._wl) && (String(t.accent).toLowerCase() === '#c9a84c'); /*v908-goldfam*/
    if(_gd){
      r.setProperty('--gold','#C9A84C'); r.setProperty('--gold-hi','#E8CC7A'); r.setProperty('--gold-lo','#b8932f');
      r.setProperty('--gold-l','#E2C97E'); r.setProperty('--gold-2','#E8C964'); r.setProperty('--gold-3','#9a7f33'); r.setProperty('--gold-bg','#FAF5E8');
    } else {
      r.setProperty('--gold',t.accent); r.setProperty('--gold-hi',t.accentHi); r.setProperty('--gold-lo',t.accentLo);
      r.setProperty('--gold-l',_lighten(t.accent,15));
      /* v1097: nicht mehr _lighten(...,8) — der Ton muss auf dunklem Grund
         TRAGEN, nicht "8 % heller als der Akzent" sein. */
      r.setProperty('--gold-2',tonAufDunkel(t.accent));
      r.setProperty('--gold-3',_darken(t.accent,26)); r.setProperty('--gold-bg',_lighten(t.accent,88));
      /* v1097: --gold-d wurde hier bisher GAR NICHT gesetzt. Genau das war
         das Loch aus v1096b — ueber diesen Weg fielen alle Regeln mit
         var(--gold-d, ...) auf das Standard-Dunkelgold zurueck. */
      r.setProperty('--gold-d',tonAufHell(t.accent));
    }
    /* v1113: Text auf der Markenflaeche — auf BEIDEN Wegen setzen, sonst
       laufen Regler-Weg und Sweeper-Weg auseinander (der v1096b-Fehler).
       Auch im Gold-Zweig: die Score-Karte ist unter jeder hellen Vorlage
       golden, unabhaengig davon ob ein Whitelabel aktiv ist. */
    r.setProperty('--uv-sc-ink', tonAufMarke(t.accent, t.accent,  4.5));
    r.setProperty('--uv-sc-mut', tonAufMarke(t.accent, '#a8a299', 4.0));
    r.setProperty('--uv-sc-ok',  tonAufMarke(t.accent, '#3FA56C', 4.0));
    /* Der Hauptwert der Karte. Start Weiss und Schwelle 7: auf einer
       dunklen Markenflaeche bleibt Weiss stehen, auf einer hellen wird es
       neutral abgedunkelt — Weiss hat in OKLab a=b=0, der Ton bleibt also
       neutral und nimmt keinen Markenstich an. */
    r.setProperty('--uv-sc-txt', tonAufMarke(t.accent, '#ffffff', 7.0));
    /* Und die Gegenrichtung: Markenakzent auf DUNKLEM Grund (konsole und
       "ohne Vorlage" — dort ist die Score-Karte nicht golden). Gerechnet
       gegen _GRUND_DUNKEL wie TR9. Standard-Gold und Hellgelb erfuellen die
       Schwelle bereits und kommen bitgenau unveraendert heraus. */
    r.setProperty('--uv-sc-akz', tonFuerGrund(t.accent, _GRUND_DUNKEL, 4.5));
    if(document.body) document.body.setAttribute('data-dp-skin', t.skin);
    if(typeof window._dpApplyThemeVars === 'function'){ try{ window._dpApplyThemeVars(); }catch(e){} }
    try{ /*v911-logo-swap*/
      var _lg=document.querySelector('.app-logo-simple-sidebar');
      if(_lg){
        if(!_lg.getAttribute('data-logo-dark')) _lg.setAttribute('data-logo-dark', _lg.getAttribute('src')||'');
        var _dark=_lg.getAttribute('data-logo-dark');
        var _light='assets/dealpilot-wortmarke.png';   /* v1079-LOGO: eine Datei fuer hell und dunkel, Kasten macht CSS */
        _lg.setAttribute('src', (t.skin==='hell') ? _light : _dark);
      }
    }catch(e){}
  }

  // theme in branding.get() einhaengen (storage._dpApplyThemeVars liest b.theme)
  var _origGet = DPC.branding.get;
  if(typeof _origGet === 'function'){
    DPC.branding.get = function(){ var b = _origGet.apply(this, arguments) || {}; b.theme = getTheme(); return b; };
  }
  DPC.branding.getTheme   = getTheme;
  DPC.branding.setTheme   = setTheme;
  DPC.branding.applyTheme = applyTheme;
  /* v1097: eine Quelle fuer die kontrastgeprueften Markentoene.
     whitelabel-override.js ruft genau diese beiden. */
  DPC.branding.tonAufDunkel = tonAufDunkel;
  DPC.branding.tonAufHell   = tonAufHell;
  /* v1113: dritte Ableitung — Text AUF der Markenflaeche. */
  DPC.branding.tonFuerGrund = tonFuerGrund;
  DPC.branding.tonAufMarke  = tonAufMarke;

  function boot(){ applyTheme(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1600);   // nochmal nach Plan-/Sub-Load (Palette-Gating kann sich aendern)
})();
/* ═══════════════════ /v901-theme ═══════════════════ */
