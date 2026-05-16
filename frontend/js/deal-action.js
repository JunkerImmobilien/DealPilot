'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V160 — Deal-Aktion Tab (s8)

   Der 10. Tab. Zeigt 4 Aktions-Karten nach der Analyse:
     1. Bankanfrage             (Doc-Upload, KI-Vorprüfung, Versand)
     2. Finanzierungsbestätigung (kleinerer Doc-Set)
     3. Gutachten & Expertise   (Verkehrswert, RND, Sanierung)
     4. Beratung & Zweite Meinung (Schnell-Check + Termin via Stripe)

   Alle Anfragen werden:
     - an die in DealPilotConfig.dealAction.* hinterlegte E-Mail gesendet
     - mit Objektdaten (JSON) + PDF-Investmentanalyse + hochgeladenen
       Dokumenten als Attachments.
     - Submit: POST /api/deal-action/submit (FormData) → Fallback auf
       mailto: + Download-Bundle wenn Backend nicht erreichbar.

   Aktivierung: window.DealPilotDealAction.init() wird aus main.js gerufen.
═══════════════════════════════════════════════════════════════ */

window.DealPilotDealAction = (function() {

  // ───────────────────────── Helpers ─────────────────────────
  function $(id)        { return document.getElementById(id); }
  function val(id)      { var e = $(id); return e ? (e.value || '').trim() : ''; }
  function num(id)      {
    var v = val(id);
    if (!v) return 0;
    return (typeof parseDe === 'function') ? parseDe(v) : (parseFloat(v.replace(',', '.')) || 0);
  }
  function fmtEur(n)    { return (n || 0).toLocaleString('de-DE', {maximumFractionDigits: 0}) + ' €'; }
  function fmtNum(n,d)  { return (n || 0).toLocaleString('de-DE', {minimumFractionDigits: d||0, maximumFractionDigits: d||0}); }
  function esc(s)       { return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // V63.75: SVG-Icon-Helper (statt Emojis) — nutzt window.Icons aus icons.js
  function ico(name, size) {
    size = size || 18;
    if (window.Icons && typeof window.Icons[name] === 'function') {
      try { return window.Icons[name]({ size: size }); } catch (e) {}
    }
    return '';
  }

  function cfg() {
    var base = (window.DealPilotConfig && window.DealPilotConfig.dealAction) || {};
    // V193: Bei Pro-Plan User-Custom-Routing einblenden
    return _v193ApplyProOverride(base);
  }
  
  // V193: Pro-User-Override für cfg() — liest aus Settings.get()
  function _v193ApplyProOverride(base) {
    try {
      // Plan-Check
      var isPro = false;
      if (window.DealPilotConfig && window.DealPilotConfig.pricing &&
          typeof window.DealPilotConfig.pricing.currentKey === 'function') {
        isPro = (window.DealPilotConfig.pricing.currentKey() === 'pro');
      }
      if (!isPro) return base;
      
      // Settings holen
      var s = (typeof Settings !== 'undefined' && Settings.get) ? Settings.get() : {};
      
      // Deep-Clone von base damit wir nicht den Original-Config mutieren
      var c = JSON.parse(JSON.stringify(base));
      var defaultEmail = s.pdf_email || (c.brand && c.brand.centralEmail) || 'info@junker-immobilien.io';
      
      // Brand-Name (für Submit-Buttons "An [Firma] senden")
      if (s.user_company) {
        if (!c.brand) c.brand = {};
        c.brand.name = s.user_company;
        c.brand.centralEmail = defaultEmail;
        if (s.pdf_website) c.brand.website = s.pdf_website;
      }
      
      // Bank-Partner Override
      if (!c.bankPartner) c.bankPartner = {};
      if (s.branding_bank_name) c.bankPartner.name = s.branding_bank_name;
      else if (s.user_company) c.bankPartner.name = s.user_company + ' — Finanzierung';
      
      if (s.branding_email_bank) {
        c.bankPartner.email = s.branding_email_bank;
      } else {
        c.bankPartner.email = defaultEmail;
      }
      
      if (s.branding_email_fb) {
        c.bankPartner.fbEmail = s.branding_email_fb;
      } else if (s.branding_email_bank) {
        c.bankPartner.fbEmail = s.branding_email_bank;
      } else {
        c.bankPartner.fbEmail = defaultEmail;
      }
      
      // Expert (Gutachten)
      if (!c.expert) c.expert = {};
      if (s.user_company) c.expert.name = s.user_company;
      if (s.branding_email_expert) c.expert.email = s.branding_email_expert;
      else c.expert.email = defaultEmail;
      
      // Consult (Beratung)
      if (!c.consult) c.consult = {};
      if (s.user_company) c.consult.name = s.user_company;
      if (s.branding_email_consult) c.consult.email = s.branding_email_consult;
      else c.consult.email = defaultEmail;
      if (s.branding_consult_price && !isNaN(parseFloat(s.branding_consult_price))) {
        c.consult.price60 = parseFloat(s.branding_consult_price);
      }
      
      // Calendly
      if (!c.calendly) c.calendly = {};
      if (s.branding_calendly_url) c.calendly.url = s.branding_calendly_url;
      
      return c;
    } catch(e) {
      console.warn('[v193] cfg-override failed:', e);
      return base;
    }
  }

  // V63.75: Brand-Empfänger / Webseite zentral abrufen
  function brand() {
    var c = cfg();
    return (c.brand) || { name: 'Junker Immobilien', website: 'https://www.junker-immobilien.io', centralEmail: 'info@junker-immobilien.io' };
  }
  
  // V192: Helper für aktuellen Firmennamen (aus Branding) — fallback Junker
  function _brandCompany() {
    try {
      var b = (window.DealPilotConfig && window.DealPilotConfig.branding && window.DealPilotConfig.branding.get)
        ? window.DealPilotConfig.branding.get()
        : null;
      if (b && b.company) return b.company;
    } catch(e) {}
    return 'Junker Immobilien';
  }

  // V63.75: Aktueller Plan-Key (für bankExport-Anhang)
  function currentPlanKey() {
    try {
      if (window.DealPilotConfig && window.DealPilotConfig.pricing
          && typeof window.DealPilotConfig.pricing.currentKey === 'function') {
        return (window.DealPilotConfig.pricing.currentKey() || '').toLowerCase();
      }
    } catch (e) {}
    return 'free';
  }
  function planAllowsBankExport() {
    var c = cfg();
    var allowed = (c.bankExportPlans || []).map(function(p){ return String(p).toLowerCase(); });
    return allowed.indexOf(currentPlanKey()) >= 0;
  }

  // Sammelt alle relevanten Objektdaten für die Anfrage
  function collectObjectData() {
    var addrParts = [val('str'), val('hnr')].filter(Boolean).join(' ');
    var addrLine  = [val('plz'), val('ort')].filter(Boolean).join(' ');
    var fullAddr  = [addrParts, addrLine].filter(Boolean).join(', ');

    var kpiDscr = $('kpi-dscr'), kpiLtv = $('kpi-ltv');

    // V63.75: Finanzierungsdaten aus Tab "Finanzierung" extrahieren (best-effort)
    var zinsBdg = num('zinsbindung') || 0;
    var tilg    = num('tilgung')     || 0;
    var sollzins= num('sollzins')    || 0;
    var darlehen= 0;
    try {
      var kp = num('kp'), ek = num('ek');
      // FESH = optional, falls nicht da → grobe Schätzung 8%
      var fesh = num('fesh') || (kp * 0.08);
      darlehen = Math.max(0, kp + fesh - ek);
    } catch (e) {}

    return {
      meta: {
        version:    'DealPilot V63.75',
        timestamp:  new Date().toISOString(),
        kuerzel:    val('kuerzel') || ''
      },
      objekt: {
        adresse:     fullAddr,
        plz:         val('plz'),
        ort:         val('ort'),
        strasse:     val('str'),
        hausnummer:  val('hnr'),
        objektart:   val('objart'),
        wohnflaeche: num('wfl'),
        baujahr:     val('baujahr'),
        ausstattung: val('ausst'),
        kaufdatum:   val('kaufdat'),
        these:       val('thesis'),
        risiken:     val('risiken')
      },
      finanz: {
        kaufpreis:    num('kp'),
        eigenkapital: num('ek'),
        // V63.75: Finanzierungsdaten
        darlehen:     darlehen,
        sollzins:     sollzins,
        tilgung:      tilg,
        zinsbindung:  zinsBdg
      },
      kennzahlen: {
        dscr: kpiDscr ? kpiDscr.textContent : '—',
        ltv:  kpiLtv  ? kpiLtv.textContent  : '—'
      }
    };
  }

  // ────────────────────── V104: Deal-Won-Status ──────────────────────
  function isDealWon() {
    var el = document.getElementById('_deal_won_state');
    if (el) return el.value === 'true';
    return false;
  }
  function setDealWon(won, propagate) {
    // Wert in hidden Input und State persistieren
    var el = document.getElementById('_deal_won_state');
    if (el) el.value = won ? 'true' : 'false';
    var atEl = document.getElementById('_deal_won_at_state');
    var nowIso = new Date().toISOString();
    if (atEl) atEl.value = won ? nowIso : '';

    // UI-Update (Stern, Text, Badge)
    refreshDealWonUI();

    // Auto-save triggern damit der Won-Status sofort persistiert wird
    if (propagate !== false) {
      if (typeof saveObj === 'function') {
        try { saveObj(true); } catch(e) { console.warn('[V104] auto-save fail:', e); }
      }
    }
  }
  function refreshDealWonUI() {
    var won = isDealWon();
    var card = document.getElementById('da-won-card');
    if (!card) return;
    card.classList.toggle('da-won-active', won);
    var star = document.getElementById('da-won-star');
    if (star) star.innerHTML = won
      ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    var label = document.getElementById('da-won-label');
    if (label) label.textContent = won ? 'Zuschlag erhalten' : 'Noch kein Zuschlag';
    var sub = document.getElementById('da-won-sub');
    if (sub) sub.textContent = won
      ? 'Dieses Objekt erscheint im Track Record und Bankexport (Standard).'
      : 'Klicke auf den Stern wenn du den Zuschlag bekommen hast.';
    // Sidebar-Card neu rendern (zeigt das Won-Badge)
    if (typeof renderSaved === 'function') {
      try { renderSaved({_immediate: true}); } catch(e) {}
    }
  }
  // ───────────────────── V138: RND-Empfehlung ────────────────────
  // Berechnet RND auf Basis der aktuellen Objekt-Eingaben und zeigt eine
  // Empfehlungs-Karte, wenn das Gutachten lohnend ist (Amortisation < 2 J.,
  // signifikante Steuer-Ersparnis).
  function renderRndRecommendation() {
    // Nur wenn RND-Module verfügbar
    if (typeof DealPilotRND === 'undefined' || !DealPilotRND.calcAll || !DealPilotRND.calcAfaVergleich) {
      return '';
    }

    // Aktuelle Objekt-Eingaben aus den Form-Feldern lesen
    var baujahr = num('input-baujahr');
    var kp = num('input-kp');
    var gebAntPct = num('input-geb-ant') || 75;
    var afaSatzPct = num('input-afa-satz') || 2;
    var kaufdatum = val('input-kaufdatum');
    var sanstand = num('input-sanstand') || 3;
    var objektTyp = val('input-objekt-typ') || 'mfh';

    // V139: Wenn Daten fehlen → Hinweis-Banner mit Sprung zum Objekt-Tab
    if (!baujahr || baujahr < 1800) {
      // KP da aber kein Baujahr → eindeutige Lücke
      if (kp && kp >= 50000) {
        return [
          '<div class="da-rnd-banner-info" style="margin:14px 0;background:#fff8e8;border:1px solid #C9A84C;border-radius:8px;padding:14px 18px;">',
          '  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">',
          '    <div style="font-family:Cormorant Garamond,serif;font-size:16px;font-weight:600;color:#2A2727;">RND-Analyse möglich — Baujahr fehlt</div>',
          '    <button type="button" class="da-cta-mini" style="background:transparent;border:1px solid #C9A84C;color:#C9A84C;padding:5px 14px;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit" onclick="DealPilotDealAction.gotoObjektTab()">→ Objekt-Tab öffnen</button>',
          '  </div>',
          '  <div style="margin-top:6px;font-size:12px;color:#7A7370;line-height:1.5">',
          '    Mit Baujahr kann DealPilot prüfen, ob ein Restnutzungsdauer-Gutachten den AfA-Hebel erhöht — bei Objekten >40 J. oft sehr lohnend.',
          '  </div>',
          '</div>'
        ].join('');
      }
      return '';  // Daten unvollständig
    }

    if (!kp || kp < 50000) return '';

    var heute = new Date().getFullYear();
    var alter = heute - baujahr;
    if (alter < 15) return '';  // bei jungen Objekten lohnt RND-Gutachten i.d.R. nicht

    var gebAnteilEur = kp * (gebAntPct / 100);

    // RND-Berechnung
    var rndJahre = 0;
    try {
      var typId = (typeof DealPilotRND_GND !== 'undefined' && DealPilotRND_GND.suggestFromObjectType)
        ? DealPilotRND_GND.suggestFromObjectType(objektTyp) : 'mfh';
      var gnd = (typeof DealPilotRND_GND !== 'undefined' && DealPilotRND_GND.getDefault)
        ? DealPilotRND_GND.getDefault(typId) : 70;
      var gewerke = sanstand <= 2 ? { fenster: 'gehoben', dach: 'gehoben', heizung: 'gehoben' }
                  : sanstand === 3 ? { fenster: 'standard', dach: 'standard', heizung: 'standard' }
                  : { fenster: 'veraltet', dach: 'veraltet', heizung: 'veraltet' };
      var rndRes = DealPilotRND.calcAll({
        baujahr: baujahr,
        stichtag: heute + '-01-01',
        gnd: gnd,
        modPoints: sanstand <= 2 ? 6 : (sanstand === 3 ? 3 : 0),
        gewerkeBewertung: gewerke
      });
      rndJahre = rndRes.final_rnd;
    } catch (e) {
      return '';
    }

    if (!rndJahre || rndJahre >= 45) return '';  // kein RND-Hebel

    // Vergleichs-Rechnung
    var grenz = (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
      ? Tax.calcGrenzsteuersatz(60000) : 0.42;
    var rndCmp;
    try {
      rndCmp = DealPilotRND.calcAfaVergleich({
        gebaeudeanteil: gebAnteilEur,
        rnd: rndJahre,
        grenzsteuersatz: grenz,
        standardAfaSatz: afaSatzPct / 100,
        gutachterkosten: 1000,
        abzinsung: 0.03
      });
    } catch (e) { return ''; }

    if (!rndCmp || !rndCmp.valid) return '';
    var amortJahre = rndCmp.steuerersparnis_jahr > 0
      ? rndCmp.gutachterkosten / rndCmp.steuerersparnis_jahr : null;
    var afaSteigerungPct = rndCmp.afa_standard.satz_pct > 0
      ? ((rndCmp.afa_kurz.satz_pct / rndCmp.afa_standard.satz_pct) - 1) * 100 : 0;

    // Nur empfehlen wenn ROI klar positiv (Amortisation < 2 J.)
    if (rndCmp.ampel === 'rot' || (amortJahre && amortJahre > 2)) return '';

    var ampelColor = rndCmp.ampel === 'gruen' ? '#2A9A5A' : '#C9A84C';
    var ampelLabel = rndCmp.ampel === 'gruen' ? 'STARK EMPFOHLEN' : 'EMPFOHLEN';

    return [
      '<div class="da-rnd-banner" style="margin:14px 0;background:#FAF6E8;border:2px solid ' + ampelColor + ';border-radius:8px;padding:16px 20px;">',
      '  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">',
      '    <div style="flex-shrink:0;background:' + ampelColor + ';color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.8px;">' + ampelLabel + '</div>',
      '    <div style="font-family:Cormorant Garamond,serif;font-size:18px;font-weight:600;color:#2A2727;">Restnutzungsdauer-Gutachten lohnt sich für dieses Objekt</div>',
      '  </div>',
      '  <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">AfA-STEIGERUNG</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">+' + Math.round(afaSteigerungPct) + ' %</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">STEUER-ERSPARNIS/J</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + fmtEur(rndCmp.steuerersparnis_jahr) + '</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">GUTACHTER-KOSTEN</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + fmtEur(rndCmp.gutachterkosten) + '</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">AMORTISATION</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + (amortJahre ? amortJahre.toFixed(1).replace('.', ',') + ' J.' : '–') + '</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">BARWERT GESAMT</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + fmtEur(rndCmp.netto_vorteil) + '</div></div>',
      '  </div>',
      '  <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">',
      '    <button type="button" class="da-cta" style="background:#2A2727;color:#fff;border:none;padding:10px 18px;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" onclick="DealPilotDealAction.openExpertWithRnd()">Gutachten direkt anfragen</button>',
      '    <span style="font-size:12px;color:#7A7370">Springt zur Anfrage-Maske mit RND-Gutachten vorausgewählt.</span>',
      '  </div>',
      '  <div style="margin-top:10px;font-size:11px;color:#7A7370;line-height:1.5">',
      '    <strong>Berechnungs­basis:</strong> §7 Abs. 4 Satz 2 EStG. Baujahr ' + baujahr + ' (Alter ' + alter + ' J.), berechnete RND ' + Math.round(rndJahre) + ' J., neuer AfA-Satz ' + rndCmp.afa_kurz.satz_pct.toFixed(2).replace('.', ',') + ' % statt Standard ' + rndCmp.afa_standard.satz_pct.toFixed(2).replace('.', ',') + ' %. Annahme Grenzsteuersatz ' + Math.round(grenz * 100) + ' %.',
      '  </div>',
      '</div>'
    ].join('');
  }

  // ───────────────────── V139: KP-Aufteilung-Empfehlung ─────────
  // Zeigt einen Banner wenn die Kaufpreis-Aufteilung Grund/Boden vs. Gebäude
  // suboptimal ist. Erfordert: Kaufpreis, Gebäudeanteil, Bodenrichtwert
  // (oder Wohnfläche für Schätzung).
  function renderKpAufteilungBanner() {
    var kp = num('input-kp');
    var gebAntPct = num('input-geb-ant');
    var grenz_input = num('input-grenz');
    var bodenrichtwert = num('input-bodenrichtwert');  // optional
    var grundstueckGroesse = num('input-grundstueck-flaeche');  // optional

    // Voraussetzung: KP + Gebäudeanteil
    if (!kp || kp < 50000) return '';
    if (!gebAntPct) return '';

    // Wenn Gebäudeanteil bereits hoch ist (>=85%) → kein Hebel
    if (gebAntPct >= 85) return '';

    // Wenn Gebäudeanteil ungewöhnlich niedrig (<60%) → besonders relevant
    var ampelColor = gebAntPct < 65 ? '#C94C4C'
                    : gebAntPct < 75 ? '#C9A84C' : '#2A9A5A';
    var ampelLabel = gebAntPct < 65 ? 'DRINGEND PRÜFEN'
                    : gebAntPct < 75 ? 'OPTIMIERUNG MÖGLICH' : 'OK, KLEINE OPTIMIERUNG MÖGLICH';

    // Hebel-Berechnung
    var aktBasis = kp * gebAntPct / 100;
    var optBasis = kp * 85 / 100;
    var diffBasis = optBasis - aktBasis;
    var afaSatz = num('input-afa-satz') || 2;
    var mehrAfaJahr = diffBasis * afaSatz / 100;
    var grenz = grenz_input ? grenz_input / 100
              : (typeof Tax !== 'undefined' && Tax.calcGrenzsteuersatz)
                ? Tax.calcGrenzsteuersatz(60000) : 0.42;
    var mehrSteuerJahr = mehrAfaJahr * grenz;
    var mehrSteuer50J = mehrSteuerJahr * 50;

    // Zu wenig Hebel? Banner ausblenden
    if (mehrSteuerJahr < 50) return '';

    // Daten-Verfügbarkeits-Check
    var datenStatus = '';
    var fehltSprung = '';
    if (!bodenrichtwert && !grundstueckGroesse) {
      datenStatus = '<div style="margin-top:10px;padding:10px 12px;background:rgba(201,168,76,0.1);border-radius:4px;font-size:12px;color:#7A7370;line-height:1.5">' +
        '<strong style="color:#2A2727">Hinweis:</strong> Für eine präzise Argumentation gegenüber dem Finanzamt fehlen Bodenrichtwert und Grundstücks­fläche. Diese im Objekt-Tab unter "Erweiterte Angaben" pflegen — dann kann auch eine konkrete BMF-konforme Aufteilung vorgeschlagen werden.';
      fehltSprung = '<button type="button" class="da-cta-mini" style="background:transparent;border:1px solid #C9A84C;color:#C9A84C;padding:4px 10px;margin-left:8px;border-radius:3px;font-size:11px;cursor:pointer" onclick="DealPilotDealAction.gotoObjektTab()">→ Objekt-Tab öffnen</button>';
      datenStatus = datenStatus.replace('</div>', fehltSprung + '</div>');
    }

    return [
      '<div class="da-kpa-banner" style="margin:14px 0;background:#FAF6E8;border:2px solid ' + ampelColor + ';border-radius:8px;padding:16px 20px;">',
      '  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">',
      '    <div style="flex-shrink:0;background:' + ampelColor + ';color:#fff;padding:4px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.8px;">' + ampelLabel + '</div>',
      '    <div style="font-family:Cormorant Garamond,serif;font-size:18px;font-weight:600;color:#2A2727;">Kaufpreis-Aufteilung Grund/Boden vs. Gebäude</div>',
      '  </div>',
      '  <div style="margin-top:6px;font-size:13px;color:#7A7370;line-height:1.5">',
      '    Aktuell ' + gebAntPct + ' % Gebäudeanteil. Mit Bodenrichtwert-Argumentation oder Sachverständigen-Gutachten lässt sich i.d.R. <strong>85 %</strong> ansetzen — höherer Anteil = mehr AfA-Basis = weniger Steuer über die ganze Halte­dauer.',
      '  </div>',
      '  <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">DIFFERENZ AfA-BASIS</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + fmtEur(diffBasis) + '</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">MEHR STEUER/JAHR</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + fmtEur(mehrSteuerJahr) + '</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">ÜBER 50 JAHRE</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + fmtEur(mehrSteuer50J) + '</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">GRENZSTEUER-ANNAHME</div><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;color:#2A2727;">' + Math.round(grenz * 100) + ' %</div></div>',
      '  </div>',
      '  <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">',
      '    <button type="button" class="da-cta" style="background:#2A2727;color:#fff;border:none;padding:10px 18px;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit" onclick="DealPilotDealAction.openExpertWithGutachten()">Gutachten zur Aufteilung anfragen</button>',
      '    <span style="font-size:12px;color:#7A7370">Verkehrswert-Gutachten mit getrennter Ausweisung Grund/Boden vs. Gebäude — argumentations-fest gegenüber Finanzamt.</span>',
      '  </div>',
      datenStatus,
      '  <div style="margin-top:10px;font-size:11px;color:#7A7370;line-height:1.5">',
      '    <strong>Rechtliche Basis:</strong> §6 Abs. 1 Nr. 1 EStG i.V.m. BMF-Aufteilungs-Hilfe. Standardmäßig 75/25 oder 80/20, mit Argumentation und Gutachten 85/15+ möglich. BFH-Urteil IX R 26/19: Aufteilung im Notarvertrag verbindlich, wenn nicht offensichtlich falsch.',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderWonCard() {
    return [
      '<div class="da-won-card" id="da-won-card">',
      '  <button type="button" class="da-won-star" id="da-won-star" onclick="DealPilotDealAction.toggleWon()" title="Zuschlag bekommen umschalten" aria-label="Won-Status umschalten"></button>',
      '  <div class="da-won-text">',
      '    <div class="da-won-label" id="da-won-label">Noch kein Zuschlag</div>',
      '    <div class="da-won-sub" id="da-won-sub">Klicke auf den Stern wenn du den Zuschlag bekommen hast.</div>',
      '  </div>',
      '  <input type="hidden" id="_deal_won_state" value="false">',
      '  <input type="hidden" id="_deal_won_at_state" value="">',
      '</div>'
    ].join('');
  }

  // ────────────────────── Tab-Renderer ──────────────────────
  function renderTab() {
    var sec = $('s8');
    if (!sec) return;

    // V191: Junker-Banner statisch im HTML bewahren falls vorhanden
    var existingBanner = sec.querySelector('.junker-action-banner');
    var bannerHtml = existingBanner ? existingBanner.outerHTML : '';

    sec.innerHTML = bannerHtml + [
      // V191: Sec-Title unverändert
      '<h2 class="sec-title">Deal-Aktion</h2>',
      '<p class="sec-desc">Was möchtest du als Nächstes tun? Die Objektdaten werden automatisch übergeben.</p>',
      
      // V191: Banner-Sektion (Empfehlungen + KP-Aufteilung) ganz oben
      renderRndRecommendation(),
      renderKpAufteilungBanner(),
      
      // V191: ═══════ STAGE 1: DEAL PRÜFEN ═══════
      '<div class="da-stage da-stage-1">',
        '<div class="da-stage-head">',
          '<span class="da-stage-ico">①</span>',
          '<div class="da-stage-title">Deal prüfen</div>',
          '<div class="da-stage-sub">Bonität klären, Bankanfrage starten, Beratung holen</div>',
        '</div>',
        '<div class="da-grid">',
          renderCard({
            id: 'da-card-bank',
            icon: ico('bank', 26),
            title: 'Bankanfrage',
            subtitle: 'An den Finanzierungspartner senden',
            desc: 'Komplettpaket: Objektanalyse + Bankunterlagen. KI prüft Vollständigkeit vor dem Versand.',
            status: '<span id="da-bank-progress">0 / 2 Pflicht-Dokumente</span>',
            cta: 'Anfrage starten',
            onclick: 'DealPilotDealAction.openBank()'
          }),
          renderCard({
            id: 'da-card-fb',
            icon: ico('shieldCheck', 26),
            title: 'Finanzierungs&shy;bestätigung',
            subtitle: 'Verbindliche FB anfragen',
            desc: 'Schlanker Prozess für die FB. 2 Pflichtdokumente — Versand direkt an die Bank.',
            status: '<span id="da-fb-progress">0 / 2 Pflicht-Dokumente</span>',
            cta: 'Anfrage starten',
            onclick: 'DealPilotDealAction.openFB()'
          }),
          renderCard({
            id: 'da-card-consult',
            icon: ico('lifebuoy', 26),
            title: 'Beratung & Zweite Meinung',
            subtitle: 'Schnell-Check oder Termin buchen',
            desc: 'Fotos hochladen + Frage stellen ODER Termin online buchen — direkt im Kalender.',
            status: '<span style="color:var(--muted)">Schnell-Check oder Termin</span>',
            cta: 'Auswählen',
            onclick: 'DealPilotDealAction.openConsult()'
          }),
        '</div>',
      '</div>',
      
      // V191: ═══════ STAGE 2: DEAL ABSICHERN ═══════
      '<div class="da-stage da-stage-2">',
        '<div class="da-stage-head">',
          '<span class="da-stage-ico">②</span>',
          '<div class="da-stage-title">Deal absichern</div>',
          '<div class="da-stage-sub">Gutachten, Restnutzungsdauer, Aufteilung KP/Boden</div>',
        '</div>',
        '<div class="da-grid">',
          renderCard({
            id: 'da-card-expert',
            icon: ico('clipboard', 26),
            title: 'Gutachten & Expertise',
            subtitle: 'Sachverständigen-Leistungen',
            desc: 'Verkehrswert · Restnutzungsdauer · Sanierungskonzept · Projektentwicklung — durch ' + _brandCompany() + '.',
            status: '<span style="color:var(--muted)">Anfrage per E-Mail</span>',
            cta: 'Anfrage stellen',
            onclick: 'DealPilotDealAction.openExpert()'
          }),
        '</div>',
      '</div>',
      
      // V191: ═══════ STAGE 3: DEAL ABSCHLIESSEN ═══════
      '<div class="da-stage da-stage-3">',
        '<div class="da-stage-head">',
          '<span class="da-stage-ico">③</span>',
          '<div class="da-stage-title">Deal abschließen</div>',
          '<div class="da-stage-sub">Won-Status setzen, Datenraum nutzen</div>',
        '</div>',
        renderWonCard(),
        _renderDatenraumQuickAccess(),
      '</div>',
      
      // V191: Coming Soon ans Ende — separat, klein
      '<div class="da-coming-soon">',
        '<div class="da-stage-head" style="margin-bottom:8px">',
          '<span class="da-stage-ico" style="background:rgba(201,168,76,0.10);color:#9a7f33">✨</span>',
          '<div class="da-stage-title" style="font-size:14px">Kommt bald</div>',
        '</div>',
        '<div class="da-grid">',
          renderCard({
            id: 'da-card-strategy',
            icon: ico('compass', 26),
            title: 'Portfolio-Strategie&shy;analyse',
            subtitle: '17 Strategien · 12 Diagnose-Karten',
            desc: 'Anlage-Ziel, Bestand und Marktlage in einer ganzheitlichen Strategie. RND, KP-Aufteilung, GmbH-Verkauf, Eigenheim­schaukel, Familien­stiftung u.v.m.',
            status: '<span style="color:#C9A84C;font-weight:600">🚀 Coming Soon</span>',
            cta: 'Coming Soon',
            onclick: 'event.preventDefault();event.stopPropagation();if(typeof toast===\'function\')toast(\'🚀 Portfolio-Strategie kommt in einer der nächsten Versionen\');return false;',
            disabled: true
          }),
        '</div>',
      '</div>',
      '<div class="da-foot" style="margin-top:18px;padding:14px 16px;background:var(--surface);border:1px solid var(--line);border-radius:10px;font-size:12px;color:var(--muted);line-height:1.5">',
      '  <strong style="color:var(--ch)">Hinweis:</strong> Alle Anfragen werden mit deinen aktuellen Objektdaten + der PDF-Investmentanalyse versendet. ',
      '  Du erhältst eine Bestätigungskopie an deine in den Settings hinterlegte E-Mail-Adresse. ',
      '  Die hochgeladenen Dokumente werden ausschließlich für die jeweilige Anfrage genutzt und nicht dauerhaft gespeichert.',
      '</div>'
    ].join('');

    refreshProgressLabels();
    // V104: Won-Status aus dem aktuell geladenen Objekt rekonstruieren und UI updaten
    try {
      var won = false;
      if (typeof window._currentObjData === 'object' && window._currentObjData) {
        won = !!window._currentObjData._deal_won;
      }
      var el = document.getElementById('_deal_won_state');
      if (el) el.value = won ? 'true' : 'false';
      refreshDealWonUI();
    } catch(e) {}
    
    // V192: Banner mit aktuellen Branding-Daten füllen
    try { _updateBanner(); } catch(e) { console.warn('[v192] banner update:', e); }
  }
  
  // V192: Banner dynamisch aus getBranding() befüllen
  function _updateBanner() {
    var b = (window.DealPilotConfig && window.DealPilotConfig.branding && window.DealPilotConfig.branding.get)
      ? window.DealPilotConfig.branding.get()
      : null;
    if (!b) return;
    
    var titleEl = document.getElementById('dp-banner-title');
    var subEl = document.getElementById('dp-banner-sub');
    var phoneEl = document.getElementById('dp-banner-phone');
    var emailEl = document.getElementById('dp-banner-email');
    
    if (titleEl) titleEl.textContent = (b.company || 'DealPilot') + ' · Dein Partner für die nächsten Schritte';
    if (subEl) subEl.textContent = 'Bankanfragen, Gutachten, Restnutzungsdauer, Sanierungskonzept — alles aus einer Hand.';
    if (phoneEl && b.phone) {
      phoneEl.textContent = '📞 ' + b.phone;
      phoneEl.setAttribute('href', 'tel:' + b.phone.replace(/[^+0-9]/g, ''));
    }
    if (emailEl && b.email) {
      emailEl.textContent = '✉ ' + b.email;
      emailEl.setAttribute('href', 'mailto:' + b.email);
    }
  }

  function renderCard(o) {
    var disabledClass = o.disabled ? ' da-card-disabled' : '';
    var btnClass = o.disabled ? 'btn btn-disabled da-card-cta' : 'btn btn-primary da-card-cta';
    var btnDisabledAttr = o.disabled ? ' disabled' : '';
    return [
      '<div class="da-card' + disabledClass + '" id="', o.id, '"',
        o.disabled ? ' style="opacity:0.55;cursor:not-allowed;filter:grayscale(0.4)"' : '',
      '>',
      '  <div class="da-card-icon">', o.icon, '</div>',
      '  <div class="da-card-title">', o.title, '</div>',
      '  <div class="da-card-sub">', o.subtitle, '</div>',
      '  <div class="da-card-desc">', o.desc, '</div>',
      '  <div class="da-card-status">', o.status, '</div>',
      '  <button class="' + btnClass + '"' + btnDisabledAttr + ' onclick="', o.onclick, '"',
        o.disabled ? ' style="background:#9C9893;cursor:not-allowed;border-color:#9C9893"' : '',
      '>', o.cta, o.disabled ? '' : ' →', '</button>',
      '</div>'
    ].join('');
  }

  function refreshProgressLabels() {
    var c = cfg();

    // Gesamt-Anzahl hochgeladener Dateien (über alle Doc-Slots)
    function totalFiles(store) {
      if (!store) return 0;
      var total = 0;
      Object.keys(store).forEach(function(k) {
        if (Array.isArray(store[k])) total += store[k].length;
      });
      return total;
    }

    function reqUploaded(docs, store) {
      return (docs || []).filter(function(d) {
        return d.required && store && store[d.id] && store[d.id].length;
      }).length;
    }

    var bankReq = (c.bankDocs || []).filter(function(d){return d.required;}).length;
    var fbReq   = (c.fbDocs   || []).filter(function(d){return d.required;}).length;

    var bankUploaded = totalFiles(window._daBankFiles);
    var fbUploaded   = totalFiles(window._daFbFiles);

    var bankReqOk = reqUploaded(c.bankDocs, window._daBankFiles);
    var fbReqOk   = reqUploaded(c.fbDocs,   window._daFbFiles);

    var bp = $('da-bank-progress'), fp = $('da-fb-progress');
    // V63.78: Zeigt echte Anzahl + Pflicht-Status, z.B. "5 Dateien · 2/2 Pflicht ✓"
    if (bp) {
      bp.textContent = bankUploaded + ' Datei' + (bankUploaded===1?'':'en')
                     + ' · ' + bankReqOk + '/' + bankReq + ' Pflicht'
                     + (bankReqOk >= bankReq ? ' ✓' : '');
    }
    if (fp) {
      fp.textContent = fbUploaded + ' Datei' + (fbUploaded===1?'':'en')
                     + ' · ' + fbReqOk + '/' + fbReq + ' Pflicht'
                     + (fbReqOk >= fbReq ? ' ✓' : '');
    }
  }

  // ──────────────────────── Modal-System ────────────────────────
  function openModal(opts) {
    closeModal();
    var ov = document.createElement('div');
    ov.className = 'da-modal-ov';
    ov.id = 'da-modal-ov';
    ov.onclick = function(e) { if (e.target === ov) closeModal(); };

    var box = document.createElement('div');
    box.className = 'da-modal';
    box.innerHTML = [
      '<div class="da-modal-head">',
      '  <h3>', esc(opts.title), '</h3>',
      '  <button class="da-modal-close" onclick="DealPilotDealAction.closeModal()" aria-label="Schließen">×</button>',
      '</div>',
      '<div class="da-modal-body">', opts.body || '', '</div>',
      '<div class="da-modal-foot" id="da-modal-foot">', opts.foot || '', '</div>'
    ].join('');

    ov.appendChild(box);
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    if (typeof opts.onMount === 'function') opts.onMount();
  }
  function closeModal() {
    var m = $('da-modal-ov');
    if (m) m.remove();
    document.body.style.overflow = '';
  }

  // ───────────────────── Daten-Vorschau (Step 1) ─────────────────────
  function renderObjectPreview(d) {
    var rows = [
      kvRow('Adresse',     d.objekt.adresse || '—'),
      kvRow('Objektart',   d.objekt.objektart || '—'),
      kvRow('Wohnfläche',  d.objekt.wohnflaeche ? fmtNum(d.objekt.wohnflaeche, 0) + ' m²' : '—'),
      kvRow('Baujahr',     d.objekt.baujahr || '—'),
      kvRow('Kaufpreis',   fmtEur(d.finanz.kaufpreis)),
      kvRow('Eigenkapital', fmtEur(d.finanz.eigenkapital)),
      kvRow('DSCR',        d.kennzahlen.dscr),
      kvRow('LTV',         d.kennzahlen.ltv)
    ];
    // V63.75: Finanzierungsdaten zeigen, falls vorhanden
    if (d.finanz.darlehen > 0 || d.finanz.sollzins > 0) {
      rows.push(kvRow('Darlehen',    d.finanz.darlehen ? fmtEur(d.finanz.darlehen) : '—'));
      rows.push(kvRow('Sollzins',    d.finanz.sollzins ? fmtNum(d.finanz.sollzins, 2) + ' %' : '—'));
      rows.push(kvRow('Tilgung',     d.finanz.tilgung  ? fmtNum(d.finanz.tilgung, 2)  + ' %' : '—'));
      rows.push(kvRow('Zinsbindung', d.finanz.zinsbindung ? fmtNum(d.finanz.zinsbindung, 0) + ' Jahre' : '—'));
    }
    return [
      '<div class="da-preview">',
      '  <div class="da-prev-head">Objekt- & Finanzierungsdaten <span class="da-prev-sub">(werden mit der Anfrage übermittelt)</span></div>',
      '  <div class="da-prev-grid">',
      rows.join(''),
      '  </div>',
      // V63.75: Statt Modal zu schließen — Hinweistext mit Anker. Wenn der User
      // wirklich anpassen will, schließt er bewusst über den X-Button.
      '  <div class="da-prev-hint">Werte stimmen nicht? Schließe diesen Dialog (×) und passe sie in den Tabs an.</div>',
      '</div>'
    ].join('');
  }
  function kvRow(k, v) {
    return '<div class="da-prev-row"><span class="da-prev-k">' + esc(k) + '</span><span class="da-prev-v">' + esc(v) + '</span></div>';
  }

  // ───────────────────── BANKANFRAGE ─────────────────────
  window._daBankFiles = {};

  // V141: Datenraum-Panel-Helper
  // Zeigt im Bank/FB-Modal den persönlichen + objekt-spezifischen Cloud-Ordner
  function _renderDatenraumPanel(kind) {
    if (typeof window.DealPilotDatenraum === 'undefined') return '';
    // V143: Aktuelle Objekt-ID über zentrale Helper-Funktion
    var currentObjId = _resolveCurrentObjId();
    return window.DealPilotDatenraum.renderDealActionPanel(currentObjId, kind);
  }

  // V143: Helper zentral — Objekt-ID aus mehreren Quellen
  function _resolveCurrentObjId() {
    try {
      // 1. window._currentObjData mit ID
      if (typeof window._currentObjData === 'object' && window._currentObjData) {
        if (window._currentObjData.id) return window._currentObjData.id;
        if (window._currentObjData._id) return window._currentObjData._id;
      }
      // 2. localStorage
      var fromStorage = localStorage.getItem('dp_current_object_id');
      if (fromStorage) return fromStorage;
      // 3. window.currentObjectId
      if (typeof window.currentObjectId === 'string' && window.currentObjectId) return window.currentObjectId;
    } catch (e) {}
    return null;
  }

  // V141: Quick-Access — Schnellzugriff auf persönlichen + Objekt-Ordner
  function _renderDatenraumQuickAccess() {
    if (typeof window.DealPilotDatenraum === 'undefined') return '';
    var DR = window.DealPilotDatenraum;
    var pers = DR.getPersoenlich();
    var currentObjId = _resolveCurrentObjId();
    var obj = currentObjId ? DR.getObjektOrdner(currentObjId) : null;

    var hasPers = !!(pers && pers.url);
    var hasObj = !!(obj && obj.url);

    if (!hasPers && !hasObj) {
      return [
        '<div class="da-dr-quick da-dr-quick-empty">',
        '  <div class="da-dr-quick-text">',
        '    <strong>Datenraum noch nicht verknüpft.</strong>',
        '    <span style="color:var(--muted)">Verbinde deinen persönlichen Cloud-Ordner und einen Ordner pro Objekt für Schnellzugriff und automatische Bank-Anfragen.</span>',
        '  </div>',
        '  <button type="button" class="btn btn-outline" onclick="DealPilotDealAction.openDatenraumSettings()">Datenraum einrichten</button>',
        '</div>'
      ].join('');
    }
    var html = ['<div class="da-dr-quick">'];
    html.push('  <div class="da-dr-quick-label">Datenraum:</div>');
    if (hasPers) {
      html.push('  <button type="button" class="da-dr-chip" onclick="DealPilotDatenraum.openPersoenlich()" title="' + (pers.url || '').replace(/"/g, '&quot;') + '">');
      html.push('    <span class="da-dr-chip-icon">P</span>');
      html.push('    <span>Persönlich</span>');
      html.push('  </button>');
    } else {
      html.push('  <button type="button" class="da-dr-chip da-dr-chip-empty" onclick="DealPilotDatenraum._editPers()">');
      html.push('    <span class="da-dr-chip-icon">+</span>');
      html.push('    <span>Persönlich verknüpfen</span>');
      html.push('  </button>');
    }
    if (hasObj) {
      html.push('  <button type="button" class="da-dr-chip" onclick="DealPilotDatenraum.openObjekt(\'' + currentObjId + '\')" title="' + (obj.url || '').replace(/"/g, '&quot;') + '">');
      html.push('    <span class="da-dr-chip-icon">O</span>');
      html.push('    <span>' + (obj.label || 'Objekt-Ordner').replace(/[<>]/g, '') + '</span>');
      html.push('  </button>');
    } else if (currentObjId) {
      html.push('  <button type="button" class="da-dr-chip da-dr-chip-empty" onclick="DealPilotDatenraum._editObj(\'' + currentObjId + '\')">');
      html.push('    <span class="da-dr-chip-icon">+</span>');
      html.push('    <span>Objekt-Ordner verknüpfen</span>');
      html.push('  </button>');
    }
    html.push('  <button type="button" class="da-dr-quick-edit" onclick="DealPilotDealAction.openDatenraumSettings()" title="Datenraum-Einstellungen">⚙</button>');
    html.push('</div>');
    return html.join('');
  }

  // V140: Externe API damit datenraum.js beim Speichern den Banner aktualisieren kann
  function refreshDatenraum() {
    var hostBank = document.getElementById('da-bank-datenraum-host');
    if (hostBank) hostBank.innerHTML = _renderDatenraumPanel('bank');
    var hostFb = document.getElementById('da-fb-datenraum-host');
    if (hostFb) hostFb.innerHTML = _renderDatenraumPanel('fb');
    // Auch Quick-Access-Bar aktualisieren wenn sichtbar
    var sec = document.getElementById('s8');
    if (sec && typeof renderTab === 'function') {
      var existingQuick = sec.querySelector('.da-dr-quick');
      if (existingQuick) {
        var newHtml = _renderDatenraumQuickAccess();
        var tmp = document.createElement('div');
        tmp.innerHTML = newHtml;
        if (tmp.firstElementChild) {
          existingQuick.replaceWith(tmp.firstElementChild);
        }
      }
    }
  }

  function openBank() {
    var data = collectObjectData();
    var docs = cfg().bankDocs || [];
    if (!data.objekt.adresse || !data.finanz.kaufpreis) {
      return alert('Bitte zuerst Adresse und Kaufpreis im Objekt-Tab erfassen.');
    }

    openModal({
      title: 'Bankanfrage stellen',
      body: [
        renderStepper(['Objekt', 'Dokumente', 'Versand']),
        '<div id="da-bank-step-1" class="da-step">',
          renderObjectPreview(data),
          '<div class="da-cmt"><label>Anmerkung an die Bank (optional)</label>',
          '<textarea id="da-bank-note" rows="3" placeholder="z.B. Wunschkonditionen, gewünschte Tilgung, Zinsbindung, besondere Hinweise..."></textarea></div>',
        '</div>',
        '<div id="da-bank-step-2" class="da-step" style="display:none">',
          // V140: Datenraum-Panel — zeigt verknüpften Cloud-Ordner + Pflicht-Doc-Status
          '<div id="da-bank-datenraum-host">' + _renderDatenraumPanel('bank') + '</div>',
          renderDocList(docs, 'bank'),
          '<div class="da-ai-info">',
          '  <strong>🤖 KI-Vorprüfung:</strong> Sobald alle Pflichtdokumente hochgeladen sind, werden sie automatisch auf Lesbarkeit, Vollständigkeit und Aktualität geprüft.',
          '</div>',
        '</div>',
        '<div id="da-bank-step-3" class="da-step" style="display:none">',
          '<div id="da-bank-aicheck" class="da-aicheck"></div>',
          '<div id="da-bank-summary" class="da-summary"></div>',
        '</div>'
      ].join(''),
      foot: footStep1('bank'),
      onMount: function() {
        bindFileInputs('bank');
      }
    });
  }

  function openFB() {
    var data = collectObjectData();
    var docs = cfg().fbDocs || [];
    if (!data.objekt.adresse || !data.finanz.kaufpreis) {
      return alert('Bitte zuerst Adresse und Kaufpreis im Objekt-Tab erfassen.');
    }

    openModal({
      title: 'Finanzierungsbestätigung anfragen',
      body: [
        renderStepper(['Objekt', 'Dokumente', 'Versand']),
        '<div id="da-fb-step-1" class="da-step">',
          renderObjectPreview(data),
          '<div class="da-cmt"><label>Anmerkung (optional)</label>',
          '<textarea id="da-fb-note" rows="3" placeholder="z.B. wofür die FB benötigt wird, gewünschtes Ausstellungsdatum..."></textarea></div>',
        '</div>',
        '<div id="da-fb-step-2" class="da-step" style="display:none">',
          // V140: Datenraum-Panel
          '<div id="da-fb-datenraum-host">' + _renderDatenraumPanel('fb') + '</div>',
          renderDocList(docs, 'fb'),
        '</div>',
        '<div id="da-fb-step-3" class="da-step" style="display:none">',
          '<div id="da-fb-summary" class="da-summary"></div>',
        '</div>'
      ].join(''),
      foot: footStep1('fb'),
      onMount: function() {
        bindFileInputs('fb');
      }
    });
  }

  function renderStepper(labels) {
    var html = '<div class="da-stepper">';
    for (var i = 0; i < labels.length; i++) {
      html += '<div class="da-step-pill' + (i === 0 ? ' active' : '') + '" data-step="' + (i+1) + '">';
      html += '<span class="da-step-num">' + (i+1) + '</span><span class="da-step-lbl">' + esc(labels[i]) + '</span>';
      html += '</div>';
      if (i < labels.length - 1) html += '<div class="da-step-sep"></div>';
    }
    html += '</div>';
    return html;
  }

  function renderDocList(docs, kind) {
    var html = '<div class="da-doclist">';
    docs.forEach(function(doc) {
      // V63.75: Selbstauskunft bekommt einen "Vorlage herunterladen"-Button
      var extraBtn = '';
      if (doc.id === 'selbstausk') {
        extraBtn = '<button type="button" class="btn btn-outline da-doc-tplbtn" ' +
                   'onclick="if(window.SelbstauskunftPDF) SelbstauskunftPDF.generate()">' +
                   ico('download', 14) + ' Vorlage' +
                   '</button>';
      }
      html += [
        '<div class="da-doc" data-doc="', doc.id, '">',
        '  <div class="da-doc-info">',
        '    <span class="da-doc-status" id="da-', kind, '-st-', doc.id, '">○</span>',
        '    <span class="da-doc-lbl">', esc(doc.label), doc.required ? ' <em class="da-doc-req">Pflicht</em>' : ' <em>(optional)</em>', '</span>',
        '  </div>',
        '  <div class="da-doc-actions">',
        extraBtn,
        '    <input type="file" id="da-', kind, '-file-', doc.id, '" multiple ',
        '           accept=".pdf,.png,.jpg,.jpeg" style="display:none">',
        '    <button class="btn btn-outline da-doc-btn" type="button" ',
        '            onclick="document.getElementById(\'da-', kind, '-file-', doc.id, '\').click()">' + ico('upload', 14) + ' Datei wählen</button>',
        '    <span class="da-doc-fname" id="da-', kind, '-fn-', doc.id, '"></span>',
        '  </div>',
        '</div>'
      ].join('');
    });
    html += '</div>';

    // V63.75: Plan-abhängiger Hinweis auf automatischen Bankexport-Anhang
    if (kind === 'bank' || kind === 'fb') {
      if (planAllowsBankExport()) {
        html += '<div class="da-bankexp-info da-bankexp-info-ok">' +
                ico('check', 14) + ' Dein Bankexport (Finanzierungsparameter) wird automatisch mitgesendet.' +
                '</div>';
      } else {
        html += '<div class="da-bankexp-info da-bankexp-info-upgrade">' +
                ico('info', 14) + ' Tipp: Mit Investor/Pro/Business wird zusätzlich der vollständige Bankexport mitgesendet.' +
                '</div>';
      }
    }
    return html;
  }

  function bindFileInputs(kind) {
    var docs = (kind === 'bank' ? cfg().bankDocs : cfg().fbDocs) || [];
    docs.forEach(function(doc) {
      var inp = $('da-' + kind + '-file-' + doc.id);
      if (!inp) return;
      inp.addEventListener('change', function() {
        if (!inp.files || !inp.files.length) return;

        // V63.77: Format-Validierung vor Annahme
        var validation = validateFiles(inp.files);
        if (validation.errors.length) {
          alert('Fehler bei den hochgeladenen Dateien:\n\n• ' + validation.errors.join('\n• '));
          inp.value = '';
          return;
        }

        var store = (kind === 'bank') ? window._daBankFiles : window._daFbFiles;
        store[doc.id] = Array.prototype.slice.call(inp.files);
        var st = $('da-' + kind + '-st-' + doc.id);
        var fn = $('da-' + kind + '-fn-' + doc.id);
        if (st) { st.textContent = '✓'; st.classList.add('ok'); }
        if (fn) {
          fn.textContent = inp.files.length === 1
            ? inp.files[0].name + ' (' + Math.round(inp.files[0].size/1024) + ' KB)'
            : (inp.files.length + ' Dateien');
        }
        refreshProgressLabels();
        validateStep2(kind);
      });
    });
  }

  // V63.77: Bankunterlagen-Validierung (Format + Größe)
  // Hinweis: Echte KI-Plausibilitätsprüfung ("ist das wirklich ein Personalausweis?")
  // ist bewusst NICHT enthalten (DSGVO + Kosten — wird in V63.78+ separat diskutiert).
  function validateFiles(fileList) {
    var ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    var ALLOWED_EXT  = ['.pdf', '.png', '.jpg', '.jpeg'];
    var MAX_SIZE     = 10 * 1024 * 1024;  // 10 MB

    var errors = [];
    Array.prototype.forEach.call(fileList, function(f) {
      var name = f.name || 'unbekannt';
      // Format
      var ext = name.toLowerCase().substring(name.lastIndexOf('.'));
      var typeOk = ALLOWED_MIME.indexOf(f.type) >= 0;
      var extOk  = ALLOWED_EXT.indexOf(ext) >= 0;
      if (!typeOk && !extOk) {
        errors.push('"' + name + '": nicht erlaubtes Format (' + (f.type || 'unbekannt') + '). Erlaubt: PDF, PNG, JPG.');
      }
      // Größe
      if (f.size > MAX_SIZE) {
        errors.push('"' + name + '": zu groß (' + Math.round(f.size/1024/1024 * 10)/10 + ' MB). Maximum: 10 MB.');
      }
      // Mindestgröße (verhindert versehentlich leere/defekte Files)
      if (f.size < 1024) {
        errors.push('"' + name + '": Datei scheint leer oder defekt (< 1 KB).');
      }
    });
    return { errors: errors, ok: errors.length === 0 };
  }

  function validateStep2(kind) {
    var docs = (kind === 'bank' ? cfg().bankDocs : cfg().fbDocs) || [];
    var store = (kind === 'bank') ? window._daBankFiles : window._daFbFiles;
    var allRequired = docs.filter(function(d){return d.required;}).every(function(d){
      return store[d.id] && store[d.id].length > 0;
    });
    var nextBtn = $('da-' + kind + '-next-2');
    if (nextBtn) {
      nextBtn.disabled = !allRequired;
      nextBtn.title = allRequired ? '' : 'Bitte alle Pflichtdokumente hochladen';
    }
  }

  function footStep1(kind) {
    return [
      '<button class="btn btn-outline" onclick="DealPilotDealAction.closeModal()">Abbrechen</button>',
      '<button class="btn btn-primary" onclick="DealPilotDealAction.gotoStep(\'', kind, '\',2)">Weiter zu Dokumenten →</button>'
    ].join('');
  }

  function gotoStep(kind, step) {
    // Steps anzeigen
    for (var i = 1; i <= 3; i++) {
      var el = $('da-' + kind + '-step-' + i);
      if (el) el.style.display = (i === step ? 'block' : 'none');
    }
    // Stepper-Pills aktualisieren
    document.querySelectorAll('.da-step-pill').forEach(function(p) {
      var n = parseInt(p.getAttribute('data-step'), 10);
      p.classList.toggle('active', n === step);
      p.classList.toggle('done', n < step);
    });
    // Footer aktualisieren
    var foot = $('da-modal-foot');
    if (!foot) return;

    if (step === 1) {
      foot.innerHTML = footStep1(kind);
    } else if (step === 2) {
      foot.innerHTML = [
        '<button class="btn btn-outline" onclick="DealPilotDealAction.gotoStep(\'', kind, '\',1)">← Zurück</button>',
        '<button class="btn btn-primary" id="da-', kind, '-next-2" disabled ',
        '        onclick="DealPilotDealAction.gotoStep(\'', kind, '\',3)">Weiter zur Vorprüfung →</button>'
      ].join('');
      validateStep2(kind);
    } else if (step === 3) {
      foot.innerHTML = [
        '<button class="btn btn-outline" onclick="DealPilotDealAction.gotoStep(\'', kind, '\',2)">← Zurück</button>',
        '<button class="btn btn-primary" id="da-', kind, '-send" ',
        '        onclick="DealPilotDealAction.submit(\'', kind, '\')">' + ico('upload', 14) + ' An ' + _brandCompany() + ' senden</button>'
      ].join('');
      runAICheck(kind);
    }
  }

  // ────────────────────── KI-Vorprüfung ──────────────────────
  function runAICheck(kind) {
    var box = $('da-' + kind + '-aicheck') || $('da-' + kind + '-summary');
    if (!box) return;

    var docs = (kind === 'bank' ? cfg().bankDocs : cfg().fbDocs) || [];
    var store = (kind === 'bank') ? window._daBankFiles : window._daFbFiles;

    var rows = docs.map(function(d) {
      var has = store[d.id] && store[d.id].length > 0;
      var icon, color, msg;
      if (has) {
        icon = '✓'; color = 'var(--green)';
        var f = store[d.id][0];
        var sizeKb = Math.round((f.size||0)/1024);
        msg = f.name + (store[d.id].length > 1 ? ' (+ ' + (store[d.id].length-1) + ')' : '') + ' · ' + sizeKb + ' KB';
      } else if (d.required) {
        icon = '✗'; color = 'var(--red)'; msg = 'Pflichtdokument fehlt';
      } else {
        icon = '–'; color = 'var(--muted)'; msg = 'optional, nicht hochgeladen';
      }
      return [
        '<div class="da-ai-row">',
        '  <span class="da-ai-icon" style="color:', color, '">', icon, '</span>',
        '  <span class="da-ai-doc">', esc(d.label), '</span>',
        '  <span class="da-ai-msg">', esc(msg), '</span>',
        '</div>'
      ].join('');
    }).join('');

    box.innerHTML = [
      '<div class="da-ai-head">📋 Zusammenfassung deiner Unterlagen</div>',
      '<div class="da-ai-list">', rows, '</div>',
      '<div class="da-ai-foot">Alles in Ordnung? Mit "Senden" geht das Paket raus.</div>'
    ].join('');

    // Bonus: optionaler echter KI-Check via openaiService (falls verfügbar)
    if (typeof window.dpOpenAIChat === 'function') {
      // OpenAI-Proxy ist da — wir können später eine echte Plausibilitätsprüfung anhängen
      // (z.B. Bildanalyse für "ist das wirklich ein Personalausweis?")
      // Bewusst noch nicht aktiv — würde Credits verbrauchen ohne klaren UX-Gewinn.
    }
  }

  // ────────────────────── Submit ──────────────────────
  function submit(kind) {
    var sendBtn = $('da-' + kind + '-send');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sende…'; }

    var data = collectObjectData();
    var note = val('da-' + kind + '-note');
    var c    = cfg();
    var to   = (kind === 'bank') ? (c.bankPartner && c.bankPartner.email)
                                 : (c.bankPartner && (c.bankPartner.fbEmail || c.bankPartner.email));

    var subject = (kind === 'bank' ? 'Bankanfrage' : 'Finanzierungsbestätigung')
                + ' — ' + (data.objekt.adresse || 'Objekt');

    var bodyText = buildEmailBody(kind, data, note);
    var store = (kind === 'bank') ? window._daBankFiles : window._daFbFiles;

    // V63.75: PDF-Investmentanalyse generieren & anhängen (best-effort, non-blocking)
    attachInvestmentPdfAndSubmit(kind, store, function(filesWithPdf) {
      submitWithFallback({
        kind: kind,
        to: to,
        subject: subject,
        body: bodyText,
        data: data,
        files: filesWithPdf
      }, function(success, mode) {
        if (success) {
          showSuccess(kind, to, mode);
        } else {
          if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = ico('upload', 14) + ' An ' + _brandCompany() + ' senden'; }
          alert('Versand fehlgeschlagen. Bitte E-Mail-Programm prüfen oder später erneut versuchen.');
        }
      });
    });
  }

  // V63.75/76: Hängt PDF-Investmentanalyse + ggf. Bank-Präsentation an die Files-Map.
  // Bankexport (separates PDF) wird nur bei Bank/FB-Anfragen angehängt UND wenn
  // der Plan das erlaubt (config.dealAction.bankExportPlans).
  function attachInvestmentPdfAndSubmit(kind, originalFiles, cb) {
    var files = {};
    Object.keys(originalFiles || {}).forEach(function(k) { files[k] = originalFiles[k]; });

    // Schritt 1: Investment-PDF generieren
    function step1_addInvestmentPdf() {
      if (typeof window.exportPDFBlob !== 'function') {
        return step2_addBankPdf();
      }
      Promise.resolve()
        .then(function() { return window.exportPDFBlob(); })
        .then(function(result) {
          if (result && result.blob) {
            var pdfFile = new File([result.blob], result.filename, { type: 'application/pdf' });
            files['_investmentanalyse'] = [pdfFile];
          }
          step2_addBankPdf();
        })
        .catch(function(e) {
          console.warn('[deal-action] Investment-PDF-Anhang fehlgeschlagen:', e);
          step2_addBankPdf();
        });
    }

    // Schritt 2: Bank-PDF (nur bei bank/fb + erlaubter Plan)
    function step2_addBankPdf() {
      var attachBank = (kind === 'bank' || kind === 'fb') && planAllowsBankExport()
                       && typeof window.exportBankPdfBlob === 'function';
      if (!attachBank) return cb(files);

      Promise.resolve()
        .then(function() { return window.exportBankPdfBlob(); })
        .then(function(result) {
          if (result && result.blob) {
            var bankFile = new File([result.blob], result.filename, { type: 'application/pdf' });
            files['_bankexport'] = [bankFile];
          }
          cb(files);
        })
        .catch(function(e) {
          console.warn('[deal-action] Bank-PDF-Anhang fehlgeschlagen:', e);
          cb(files);
        });
    }

    step1_addInvestmentPdf();
  }

  function submitWithFallback(payload, cb) {
    var mode = (cfg().submitMode || 'auto');

    function doMailto() {
      // Fallback: mailto + Download-ZIP-Bundle für die Anhänge
      var url = 'mailto:' + encodeURIComponent(payload.to)
              + '?subject=' + encodeURIComponent(payload.subject)
              + '&body='    + encodeURIComponent(payload.body);

      // Anhänge können wir per mailto nicht setzen — wir bieten einen
      // Sammel-Download an, den der User dann manuell anhängt.
      offerBundleDownload(payload, function() {
        try { window.location.href = url; } catch(e) {}
        cb(true, 'mailto');
      });
    }

    function doBackend() {
      var fd = new FormData();
      fd.append('kind', payload.kind);
      fd.append('to',   payload.to);
      fd.append('subject', payload.subject);
      fd.append('body',    payload.body);
      fd.append('data',    JSON.stringify(payload.data));

      Object.keys(payload.files || {}).forEach(function(docId) {
        (payload.files[docId] || []).forEach(function(f, idx) {
          fd.append('docs[' + docId + '][' + idx + ']', f, f.name);
        });
      });

      var token = null; try { token = localStorage.getItem('ji_token'); } catch(e){}
      var headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;

      fetch('/api/v1/deal-action/submit', { method: 'POST', headers: headers, body: fd })
        .then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function() { cb(true, 'backend'); })
        .catch(function() {
          if (mode === 'auto') doMailto(); else cb(false, 'failed');
        });
    }

    if (mode === 'mailto') doMailto();
    else if (mode === 'backend') doBackend();
    else doBackend(); // 'auto'
  }

  // Erzeugt ein Download-Bundle (JSON + alle hochgeladenen Files in einer ZIP-ähnlichen
  // Sammelseite). Da wir keine ZIP-Bibliothek einziehen wollen, geben wir die JSON ab
  // und triggern Einzeldownloads via <a download> für jede Datei.
  function offerBundleDownload(payload, after) {
    // 1) JSON-Datei mit den Objektdaten
    var jsonStr = JSON.stringify(payload.data, null, 2);
    triggerDownload(jsonStr, 'application/json', 'DealPilot_Anfrage_' + (payload.data.objekt.ort || 'Objekt') + '.json');

    // 2) Hinweis-PDF/TXT
    triggerDownload(payload.body, 'text/plain;charset=utf-8',
      'DealPilot_Anfrage_' + (payload.data.objekt.ort || 'Objekt') + '_Begleittext.txt');

    if (typeof after === 'function') setTimeout(after, 300);
  }

  function triggerDownload(content, mime, filename) {
    var blob = new Blob([content], { type: mime });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  function buildEmailBody(kind, d, note) {
    var lines = [];
    var brand = (window.DealPilotConfig && window.DealPilotConfig.branding && window.DealPilotConfig.branding.get) ? window.DealPilotConfig.branding.get() : { firma:'Junker Immobilien' };
    var titel = ({
      bank:    'Bankanfrage',
      fb:      'Finanzierungsbestätigung',
      expert:  'Gutachten-/Expertise-Anfrage',
      consult: 'Beratungs-Anfrage'
    })[kind] || 'Anfrage';

    lines.push('Hallo,');
    lines.push('');
    lines.push('anbei eine ' + titel + ' aus DealPilot.');
    lines.push('');
    lines.push('── Objekt ──');
    lines.push('Adresse:      ' + (d.objekt.adresse || '—'));
    lines.push('Objektart:    ' + (d.objekt.objektart || '—'));
    lines.push('Wohnfläche:   ' + (d.objekt.wohnflaeche ? fmtNum(d.objekt.wohnflaeche, 0) + ' m²' : '—'));
    lines.push('Baujahr:      ' + (d.objekt.baujahr || '—'));
    lines.push('Ausstattung:  ' + (d.objekt.ausstattung || '—'));
    lines.push('');
    lines.push('── Finanz ──');
    lines.push('Kaufpreis:    ' + fmtEur(d.finanz.kaufpreis));
    lines.push('Eigenkapital: ' + fmtEur(d.finanz.eigenkapital));
    lines.push('DSCR:         ' + d.kennzahlen.dscr);
    lines.push('LTV:          ' + d.kennzahlen.ltv);
    if (note) {
      lines.push('');
      lines.push('── Anmerkung ──');
      lines.push(note);
    }

    // V141: Datenraum-Snippet bei Bank/FB-Anfragen — pro Objekt
    if ((kind === 'bank' || kind === 'fb') && typeof window.DealPilotDatenraum !== 'undefined') {
      try {
        var currentObjId = null;
        try { currentObjId = localStorage.getItem('dp_current_object_id'); } catch (e) {}
        var snippet = window.DealPilotDatenraum.buildBankSnippet(currentObjId, kind);
        if (snippet) {
          lines.push('');
          lines.push(snippet);
        }
      } catch (e) {
        console.warn('[deal-action] Datenraum-Snippet failed', e);
      }
    }

    lines.push('');
    lines.push('Die vollständigen Objektdaten (JSON) sowie ggf. hochgeladene Bankunterlagen sind angehängt.');
    lines.push('');
    lines.push('Beste Grüße');
    lines.push('— gesendet mit DealPilot');
    return lines.join('\n');
  }

  function showSuccess(kind, to, mode) {
    var dest = ({
      bank:    'Junker Immobilien',
      fb:      'Junker Immobilien',
      expert:  'Junker Immobilien',
      consult: 'Junker Immobilien'
    })[kind] || 'Junker Immobilien';

    var modeNote = (mode === 'mailto')
      ? 'Dein E-Mail-Programm wurde geöffnet. Bitte hänge die heruntergeladene JSON-Datei sowie deine Bankunterlagen an die E-Mail an, dann auf <em>Senden</em> klicken.'
      : 'Die Anfrage wurde erfolgreich an unseren Server übermittelt. Du bekommst gleich eine Bestätigungskopie per E-Mail.';

    var body = $('da-modal-ov') && document.querySelector('.da-modal-body');
    if (body) {
      body.innerHTML = [
        '<div class="da-ok">',
        '  <div class="da-ok-icon">✓</div>',
        '  <h3>Anfrage versendet</h3>',
        '  <p>Die Anfrage wurde an <strong>', esc(dest), '</strong> (', esc(to), ') vorbereitet.</p>',
        '  <p style="font-size:13px;color:var(--muted);margin-top:8px">', modeNote, '</p>',
        '</div>'
      ].join('');
    }
    var foot = $('da-modal-foot');
    if (foot) foot.innerHTML = '<button class="btn btn-primary" onclick="DealPilotDealAction.closeModal()">Schließen</button>';

    // Reset Files
    if (kind === 'bank') window._daBankFiles = {};
    if (kind === 'fb')   window._daFbFiles   = {};
    refreshProgressLabels();
  }

  // ───────────────────── GUTACHTEN / EXPERTISE ─────────────────────
  function openExpert() {
    var data = collectObjectData();
    if (!data.objekt.adresse) {
      return alert('Bitte zuerst Adresse im Objekt-Tab erfassen.');
    }

    openModal({
      title: 'Gutachten & Expertise anfragen',
      body: [
        renderObjectPreview(data),
        '<div class="da-cmt"><label>Welche Leistung benötigst du?</label>',
        '  <div class="da-opt-grid">',
        optRadio('expert-type', 'verkehrswert', ico('house', 16) + ' Verkehrswertgutachten', 'Marktwert nach §194 BauGB — gerichtsfest, für Bank/Erbschaft/Verkauf', true),
        optRadio('expert-type', 'rnd',          ico('refresh', 16) + ' Restnutzungsdauer-Gutachten', 'Wizard mit Einschätzung ob es sich lohnt — danach optional anfragen'),
        optRadio('expert-type', 'sanierung',    ico('shield', 16) + ' Sanierungskonzept', 'Konkrete Maßnahmen + Kostenplanung für Bestandsobjekt'),
        optRadio('expert-type', 'projektentw',  ico('building', 16) + ' Projektentwicklung', 'Mehrfamilienhaus / Aufstockung / Umbau — Begleitung A bis Z'),
        optRadio('expert-type', 'sonstiges',    ico('fileText', 16) + ' Etwas anderes', 'Beschreibe unten frei, was du brauchst'),
        '  </div>',
        '</div>',
        '<div class="da-cmt"><label>Was brauchst du genau?</label>',
        '  <textarea id="da-expert-msg" rows="4" placeholder="Beschreibe dein Anliegen, gewünschten Termin, besondere Hinweise..."></textarea>',
        '</div>',
        '<div class="da-cmt"><label>Fotos beifügen (optional)</label>',
        '  <input type="file" id="da-expert-photos" multiple accept="image/*" style="display:none" onchange="DealPilotDealAction._onPhotos(this,\'expert\')">',
        '  <button class="btn btn-outline" type="button" onclick="document.getElementById(\'da-expert-photos\').click()">' + ico('image', 14) + ' Fotos auswählen</button>',
        '  <span id="da-expert-photos-cnt" style="margin-left:10px;color:var(--muted);font-size:12px"></span>',
        '</div>'
      ].join(''),
      foot: [
        '<button class="btn btn-outline" onclick="DealPilotDealAction.closeModal()">Abbrechen</button>',
        '<button class="btn btn-primary" onclick="DealPilotDealAction.submitExpert()">' + ico('upload', 14) + ' Anfrage senden</button>'
      ].join('')
    });

    // V144: RND-Radio-Klick öffnet den Wizard direkt (statt nur Radio zu aktivieren)
    setTimeout(function() {
      var rndRadio = document.querySelector('input[name="expert-type"][value="rnd"]');
      if (rndRadio) {
        rndRadio.addEventListener('change', function(e) {
          if (this.checked) {
            // Modal schließen und Wizard starten
            closeModal();
            setTimeout(function() {
              openExpertWithRnd();
            }, 200);
          }
        });
      }
    }, 100);
  }

  function optRadio(name, val, label, hint, checked) {
    return [
      '<label class="da-opt">',
      '  <input type="radio" name="', name, '" value="', val, '"', (checked?' checked':''), '>',
      '  <div><div class="da-opt-lbl">', label, '</div><div class="da-opt-hint">', esc(hint), '</div></div>',
      '</label>'
    ].join('');
  }

  window._daPhotos = {};
  function _onPhotos(input, kind) {
    if (!input.files || !input.files.length) return;
    window._daPhotos[kind] = Array.prototype.slice.call(input.files);
    var cnt = $('da-' + kind + '-photos-cnt');
    if (cnt) cnt.textContent = input.files.length + ' Foto' + (input.files.length===1?'':'s') + ' ausgewählt';
  }

  function submitExpert() {
    var typeEl = document.querySelector('input[name="expert-type"]:checked');
    var typ    = typeEl ? typeEl.value : 'sonstiges';

    // V63.77: Bei "Restnutzungsdauer-Gutachten" + Pro/Business-Plan → RND-Modul öffnen
    // statt Mail-Anfrage.
    if (typ === 'rnd' && planAllowsBankExport() && typeof window.DealPilotRND_UI !== 'undefined') {
      closeModal();
      setTimeout(openRND, 100);
      return;
    }

    var msg    = val('da-expert-msg');
    var data   = collectObjectData();
    var c      = cfg();

    var labels = { verkehrswert:'Verkehrswertgutachten', rnd:'Restnutzungsdauer-Gutachten', sanierung:'Sanierungskonzept', projektentw:'Projektentwicklung', sonstiges:'Sonstige Anfrage' };
    var subject = (labels[typ] || 'Gutachten-Anfrage') + ' — ' + (data.objekt.adresse || 'Objekt');

    var bodyText = buildEmailBody('expert', data, msg) + '\n\n── Anfragetyp ──\n' + (labels[typ] || typ);

    var photos = window._daPhotos.expert || [];
    var files = {};
    if (photos.length) files.fotos = photos;

    submitWithFallback({
      kind: 'expert',
      to: c.expert && c.expert.email,
      subject: subject,
      body: bodyText,
      data: data,
      files: files
    }, function(success, mode) {
      if (success) showSuccess('expert', c.expert.email, mode);
      else alert('Versand fehlgeschlagen.');
    });
  }

  // V63.77: RND-Modul öffnen (Pro/Business). Free/Starter/Investor sehen Anfrage-Hinweis.
  // V63.78: Pro-Mode komplett überarbeitet — Headline + CTA + Auto-Import, kein PDF-Export sichtbar
  function openRND() {
    var data = collectObjectData();
    if (!data.objekt.adresse) {
      return alert('Bitte zuerst Adresse im Objekt-Tab erfassen.');
    }
    var c = cfg();
    var canUseModule = planAllowsBankExport() && typeof window.DealPilotRND_UI !== 'undefined';

    if (!canUseModule) {
      // Kein Plan → Anfrage-Modal mit RND-spezifischem Vorschlagstext
      openModal({
        title: 'Restnutzungsdauer-Gutachten anfragen',
        body: [
          renderObjectPreview(data),
          '<div class="da-rnd-upsell">',
          '  <strong>RND-Vollmodul ist Pro/Business-exklusiv.</strong> Du kannst die Anfrage trotzdem stellen — wir erstellen das Gutachten manuell für dich.',
          '</div>',
          '<div class="da-cmt"><label>Was brauchst du genau?</label>',
          '  <textarea id="da-rnd-msg" rows="4" placeholder="Beschreibe Modernisierungen, bekannte Schäden, Sondereinflüsse...">Ich benötige ein Restnutzungsdauer-Gutachten zur AfA-Optimierung für mein Objekt.</textarea>',
          '</div>'
        ].join(''),
        foot: [
          '<button class="btn btn-outline" onclick="DealPilotDealAction.closeModal()">Abbrechen</button>',
          '<button class="btn btn-primary" onclick="DealPilotDealAction.submitRNDRequest()">' + ico('upload', 14) + ' Anfrage senden</button>'
        ].join('')
      });
      return;
    }

    // V63.78: Pro/Business — neuer Aufbau
    // - Großes Modal
    // - Headline mit empfohlener RND prominent
    // - RND-Modul gerendert (Export + AfA-Card per CSS-Klasse versteckt)
    // - CTA "Gutachten beantragen" am Ende (sendet alles an dealpilot@)
    openModal({
      title: 'Restnutzungsdauer ermitteln — DealPilot Pro',
      body: [
        '<div class="da-rnd-headline" id="da-rnd-headline">',
        '  <div class="da-rnd-headline-label">Empfohlene Restnutzungsdauer</div>',
        '  <div class="da-rnd-headline-value">',
        '    <span id="da-rnd-headline-num">—</span>',
        '    <span class="da-rnd-headline-unit">Jahre</span>',
        '  </div>',
        '  <div class="da-rnd-headline-method" id="da-rnd-headline-method">wird berechnet…</div>',
        '</div>',
        '<div id="rnd-host" class="da-rnd-host da-rnd-host-pro"></div>'
      ].join(''),
      foot: [
        '<button class="btn btn-outline" onclick="DealPilotDealAction.closeModal()">Schließen</button>',
        '<button class="btn btn-primary da-rnd-cta" onclick="DealPilotDealAction.submitRNDFromModule()">',
        ico('upload', 16) + ' Restnutzungsdauer-Gutachten beantragen',
        '</button>'
      ].join('')
    });

    // RND-Modul rendern + Objektdaten AUTOMATISCH übernehmen + Headline live updaten
    setTimeout(function() {
      var host = document.getElementById('rnd-host');
      if (!host) return;
      try {
        window.DealPilotRND_UI.render(host, {
          showPlanGate: false,
          initialData: _rndDealData(data),
          // V63.78: Bei jedem Recalc den Headline-Wert aktualisieren
          onRecalc: function(result, afa) {
            window._daRNDLastResult = { result: result, afa: afa };
            _updateRNDHeadline(result);
          }
        });
        // Objekt automatisch importieren — kein User-Klick nötig
        if (typeof window.DealPilotRND_UI.loadObject === 'function') {
          window.DealPilotRND_UI.loadObject(_rndDealData(data));
        }
        // V63.78: Cards verstecken die für den User nicht relevant sind
        // (Berater-Sachen — Export, AfA-Vergleich mit Gutachterkosten, Override, Gutachten-Metadaten)
        _hideRNDExtras(host);
      } catch (e) {
        console.error('[deal-action] RND init failed:', e);
        host.innerHTML = '<p style="color:var(--red);padding:20px">RND-Modul konnte nicht geladen werden: ' + e.message + '</p>';
      }
    }, 50);
  }

  // V63.78: Versteckt Cards im RND-Modul, die für den End-User nicht relevant sind.
  // Wir matchen über den H3-Text (robust gegen RND-interne Refactorings).
  function _hideRNDExtras(host) {
    var hideKeywords = [
      'Export',
      'AfA-Vergleich',
      'Lohnt sich ein Gutachten',
      'Sachverständigen-Override',
      'Sachverständigen-RND',
      'Gutachten-Daten',
      'Gutachten-Metadaten'
    ];
    var cards = host.querySelectorAll('.rnd-card');
    cards.forEach(function(card) {
      var h3 = card.querySelector('h3');
      if (!h3) return;
      var text = (h3.textContent || '').trim();
      for (var i = 0; i < hideKeywords.length; i++) {
        if (text.indexOf(hideKeywords[i]) >= 0) {
          card.style.display = 'none';
          return;
        }
      }
    });
    // Disclaimer am Ende auch dezenter
    var dis = host.querySelector('.rnd-disclaimer');
    if (dis) dis.style.display = 'none';
  }

  // V63.78: Headline mit empfohlener RND aktualisieren
  function _updateRNDHeadline(result) {
    var num = $('da-rnd-headline-num');
    var method = $('da-rnd-headline-method');
    if (!result || !num) return;
    // result-Struktur (RND-Modul): { rndJahre, methode, ... } oder result.empfehlung
    var rnd = null, methodLabel = '';
    if (result.empfehlung && result.empfehlung.rnd) {
      rnd = result.empfehlung.rnd;
      methodLabel = result.empfehlung.label || result.empfehlung.methode || '';
    } else if (typeof result.rndJahre === 'number') {
      rnd = result.rndJahre;
      methodLabel = result.methode || '';
    } else if (result.median) {
      rnd = result.median;
      methodLabel = 'Median über alle Verfahren';
    }
    if (rnd != null) num.textContent = Math.round(rnd);
    if (methodLabel && method) method.textContent = 'Methode: ' + methodLabel;
  }

  // RND-Datenformat aus collectObjectData ableiten
  function _rndDealData(d) {
    var settings = {};
    try { settings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}'); } catch (e) {}
    // V139: Komplettes Roh-Objekt aus localStorage holen, damit der V3-Mapper
    // alle rate_*-Felder, ds2_*-Energieklasse, geb_ant etc. greifen kann.
    var raw = {};
    try {
      var allObjs = JSON.parse(localStorage.getItem('ji_objects') || '[]');
      var currentId = localStorage.getItem('dp_current_object_id') || '';
      var match = allObjs.filter(function(o) { return o.id === currentId; })[0];
      if (match && match.data) raw = match.data;
    } catch (e) {}

    return {
      // Roh-Objekt-Felder für den V3-Mapper (rate_bad/boden/fenster/kueche, ds2_*, geb_ant)
      kp:              d.finanz.kaufpreis || raw.kp,
      geb_ant:         raw.geb_ant != null ? raw.geb_ant : 80,
      rate_bad:        raw.rate_bad,
      rate_boden:      raw.rate_boden,
      rate_fenster:    raw.rate_fenster,
      rate_kueche:     raw.rate_kueche,
      ds2_energie:     raw.ds2_energie || raw.energieklasse,
      ds2_zustand:     raw.ds2_zustand,
      objart:          raw.objart || raw.objektTyp || 'etw',
      grenz:           raw.grenz,
      afa_satz:        raw.afa_satz,
      // Plus die abstrahierten Felder als Fallback (V2-Kompat)
      baujahr:         d.objekt.baujahr ? parseInt(d.objekt.baujahr, 10) : (raw.baujahr || null),
      objektTyp:       'etw',
      kaufdatum:       d.objekt.kaufdatum || raw.kaufdatum || new Date().toISOString().slice(0, 10),
      kaufpreis:       d.finanz.kaufpreis || raw.kp,
      grundstueckswert: 0,
      adresse:         d.objekt.adresse,
      einheit:         '',
      wohnflaeche:     d.objekt.wohnflaeche || raw.wfl,
      eigentuemer:     settings.user_name || '',
      zve_geschaetzt:  0
    };
  }

  // V63.78: Submit aus dem RND-Modul (Pro) — nutzt aktuelle Berechnung
  function submitRNDFromModule() {
    var data = collectObjectData();
    var c    = cfg();
    var rndResult = window._daRNDLastResult || {};
    var rndStr = '';
    try {
      if (typeof window.DealPilotRND_UI !== 'undefined' && typeof window.DealPilotRND_UI.getCurrentResult === 'function') {
        var current = window.DealPilotRND_UI.getCurrentResult();
        if (current) rndResult = current;
      }
    } catch (e) {}

    if (rndResult && rndResult.result) {
      var emp = rndResult.result.empfehlung || {};
      rndStr += '\n── Berechnete Restnutzungsdauer ──\n';
      if (emp.rnd) rndStr += 'Empfohlene RND: ' + Math.round(emp.rnd) + ' Jahre\n';
      if (emp.label || emp.methode) rndStr += 'Methode: ' + (emp.label || emp.methode) + '\n';
      if (rndResult.result.byMethod) {
        rndStr += 'Alle Verfahren:\n';
        Object.keys(rndResult.result.byMethod).forEach(function(k) {
          var v = rndResult.result.byMethod[k];
          if (v && typeof v.rnd === 'number') {
            rndStr += '  ' + k + ': ' + Math.round(v.rnd) + ' J.\n';
          }
        });
      }
    }

    var subject = 'RND-Gutachten beantragen — ' + (data.objekt.adresse || 'Objekt');
    var bodyText = buildEmailBody('expert', data, 'Bitte erstellt mir ein Restnutzungsdauer-Gutachten für mein Objekt. Die mit DealPilot ermittelten Werte habe ich unten beigefügt.') + rndStr;

    submitWithFallback({
      kind: 'expert',
      to: c.expert && c.expert.email,
      subject: subject,
      body: bodyText,
      data: data,
      files: {}
    }, function(success, mode) {
      if (success) showSuccess('expert', c.expert.email, mode);
      else alert('Versand fehlgeschlagen.');
    });
  }

  // Submit der RND-Anfrage (Free/Starter/Investor — Mail-Workflow)
  function submitRNDRequest() {
    var msg  = val('da-rnd-msg');
    var data = collectObjectData();
    var c    = cfg();
    var subject = 'Restnutzungsdauer-Gutachten — ' + (data.objekt.adresse || 'Objekt');
    var bodyText = buildEmailBody('expert', data, msg) +
                   '\n\n── Anfragetyp ──\nRestnutzungsdauer-Gutachten (manuell, Free/Starter/Investor)';
    submitWithFallback({
      kind: 'expert',
      to: c.expert && c.expert.email,
      subject: subject,
      body: bodyText,
      data: data,
      files: {}
    }, function(success, mode) {
      if (success) showSuccess('expert', c.expert.email, mode);
      else alert('Versand fehlgeschlagen.');
    });
  }

  // ───────────────────── BERATUNG / ZWEITE MEINUNG ─────────────────────
  function openConsult() {
    var data = collectObjectData();
    if (!data.objekt.adresse) {
      return alert('Bitte zuerst Adresse im Objekt-Tab erfassen.');
    }
    var c = cfg();
    var b = brand();
    var calUrl = (c.calendly && c.calendly.enabled && c.calendly.url) ? c.calendly.url : '';
    var calPrice = (c.calendly && c.calendly.priceLabel) || (c.consult.price60 ? fmtEur(c.consult.price60) + ' / Stunde' : '');

    var bookingHtml = calUrl
      ? '<a class="btn btn-primary" href="' + esc(calUrl) + '" target="_blank" rel="noopener">' +
          ico('calendar', 14) + ' Termin online buchen</a>' +
        '<div class="da-consult-cal-hint">Öffnet den Junker-Kalender in einem neuen Tab.</div>'
      : '<button class="btn btn-outline" onclick="DealPilotDealAction.bookSlot(60)">' +
          ico('calendar', 14) + ' Termin per E-Mail anfragen</button>';

    openModal({
      title: 'Beratung & Zweite Meinung',
      body: [
        '<div class="da-consult-grid">',
        '  <div class="da-consult-card">',
        '    <div class="da-consult-icon">' + ico('lightbulb', 24) + '</div>',
        '    <div class="da-consult-title">Schnell-Check</div>',
        '    <div class="da-consult-desc">Beschreibe dein Anliegen, lade Fotos hoch — Antwort per E-Mail innerhalb 1–2 Werktagen.</div>',
        '    <div class="da-consult-price">' + (c.consult.priceQuick === 0 ? 'Kostenlos bei Pro/Business' : fmtEur(c.consult.priceQuick)) + '</div>',
        '    <button class="btn btn-primary" onclick="DealPilotDealAction.openConsultQuick()">' + ico('mail', 14) + ' Anfrage stellen</button>',
        '  </div>',
        '  <div class="da-consult-card">',
        '    <div class="da-consult-icon">' + ico('calendar', 24) + '</div>',
        '    <div class="da-consult-title">Persönliches Gespräch</div>',
        '    <div class="da-consult-desc">Video oder Telefon — direkt im Kalender einen freien Slot wählen.</div>',
        '    <div class="da-consult-price">' + esc(calPrice) + '</div>',
        '    <div class="da-consult-options">',
              bookingHtml,
        '    </div>',
        '  </div>',
        '</div>',
        '<div class="da-consult-foot">',
        '  <a href="' + esc(b.website) + '" target="_blank" rel="noopener" class="da-consult-weblink">',
        ico('link', 13) + ' ' + esc(b.website.replace(/^https?:\/\//, '')),
        '  </a>',
        '</div>'
      ].join(''),
      foot: '<button class="btn btn-outline" onclick="DealPilotDealAction.closeModal()">Schließen</button>'
    });
  }

  function openConsultQuick() {
    var data = collectObjectData();
    var c = cfg();

    openModal({
      title: 'Schnell-Check anfragen',
      body: [
        renderObjectPreview(data),
        '<div class="da-cmt"><label>Was beschäftigt dich? *</label>',
        '  <textarea id="da-consult-msg" rows="5" placeholder="z.B. Unsicher wegen Lage / Sanierungsbedarf / Mietspiegel / Finanzierungsstruktur..."></textarea>',
        '</div>',
        '<div class="da-cmt"><label>Fotos (Innen/Außen, Risse, Schäden — alles was hilft)</label>',
        '  <input type="file" id="da-consult-photos" multiple accept="image/*" style="display:none" onchange="DealPilotDealAction._onPhotos(this,\'consult\')">',
        '  <button class="btn btn-outline" type="button" onclick="document.getElementById(\'da-consult-photos\').click()">' + ico('image', 14) + ' Fotos auswählen</button>',
        '  <span id="da-consult-photos-cnt" style="margin-left:10px;color:var(--muted);font-size:12px"></span>',
        '</div>'
      ].join(''),
      foot: [
        '<button class="btn btn-outline" onclick="DealPilotDealAction.openConsult()">← Zurück</button>',
        '<button class="btn btn-primary" onclick="DealPilotDealAction.submitConsultQuick()">' + ico('upload', 14) + ' Anfrage senden</button>'
      ].join('')
    });
  }

  function submitConsultQuick() {
    var msg  = val('da-consult-msg');
    if (!msg) return alert('Bitte beschreibe dein Anliegen.');

    var data = collectObjectData();
    var c    = cfg();
    var subject = 'Schnell-Check — ' + (data.objekt.adresse || 'Objekt');
    var bodyText = buildEmailBody('consult', data, msg);

    var photos = window._daPhotos.consult || [];
    var files = {};
    if (photos.length) files.fotos = photos;

    submitWithFallback({
      kind: 'consult',
      to: c.consult && c.consult.email,
      subject: subject,
      body: bodyText,
      data: data,
      files: files
    }, function(success, mode) {
      if (success) showSuccess('consult', c.consult.email, mode);
      else alert('Versand fehlgeschlagen.');
    });
  }

  function bookSlot(minutes) {
    var c = cfg();
    var price = (minutes === 30) ? c.consult.price30 : c.consult.price60;
    var data  = collectObjectData();

    // Stripe-Checkout vorbereitet — wenn Backend-Endpoint da, redirect.
    // Sonst: Termin-Anfrage per E-Mail.
    var token = null; try { token = localStorage.getItem('ji_token'); } catch(e){}

    fetch('/api/v1/checkout/consult', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, token ? {'Authorization':'Bearer '+token} : {}),
      body: JSON.stringify({ minutes: minutes, objekt: data })
    })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(j) {
        if (j && j.url) window.location.href = j.url;
        else throw new Error('No URL');
      })
      .catch(function() {
        // Fallback: per E-Mail anfragen
        var ok = confirm(
          'Online-Buchung noch nicht aktiviert.\n\n' +
          'Möchtest du stattdessen einen ' + minutes + '-Min-Termin (' + fmtEur(price) + ') per E-Mail anfragen?'
        );
        if (!ok) return;

        var subject = 'Termin-Anfrage ' + minutes + ' Min — ' + (data.objekt.adresse || 'Objekt');
        var note    = 'Ich möchte einen ' + minutes + '-Minuten-Beratungstermin (' + fmtEur(price) + ') buchen.\n\n'
                    + 'Bitte schickt mir 2-3 Terminvorschläge.';
        var bodyText = buildEmailBody('consult', data, note);

        submitWithFallback({
          kind: 'consult',
          to: c.consult && c.consult.email,
          subject: subject,
          body: bodyText,
          data: data,
          files: {}
        }, function(success, mode) {
          if (success) showSuccess('consult', c.consult.email, mode);
          else alert('Versand fehlgeschlagen.');
        });
      });
  }

  // ──────────────────────── Init / Public API ────────────────────────
  function init() {
    // Tab erst rendern wenn Section existiert
    if (!$('s8')) return;
    renderTab();

    // Bei Tab-Wechsel auf s8 Werte aktualisieren (DSCR/LTV könnten sich geändert haben)
    document.addEventListener('click', function(e) {
      var t = e.target.closest && e.target.closest('.tab');
      if (t) setTimeout(refreshTabIfActive, 80);
    });
  }

  function refreshTabIfActive() {
    var sec = $('s8');
    if (sec && sec.classList.contains('active')) {
      // Nur die Vorschau-Werte updaten, Karten-Struktur bleibt
      refreshProgressLabels();
    }
  }

  // V142: RND-Wizard öffnen (statt direkter Expert-Anfrage)
  // Der Wizard führt durch 9 Schritte, rechnet automatisch RND + AfA-Vergleich,
  // zeigt das Ergebnis mit "Lohnt sich"-Bewertung und bietet danach Optionen:
  //   - Vollständiges Gutachten anfragen (Expert-Maske)
  //   - PDF/DOCX direkt exportieren
  function openExpertWithRnd() {
    if (typeof window.DealPilotRND_Wizard === 'undefined' ||
        typeof window.DealPilotRND_Wizard.open !== 'function') {
      // Fallback wenn Wizard noch nicht geladen
      console.warn('[deal-action] RND-Wizard nicht verfügbar — falle zurück auf Expert-Maske');
      return openExpertFallbackRnd();
    }
    // Aktuelles Objekt als Prefill
    var prefill = _getRndPrefill();
    window.DealPilotRND_Wizard.open({
      prefill: prefill,
      onComplete: function(gutachtenState) {
        _showRndWizardResult(gutachtenState);
      }
    });
  }

  // V142: Liefert Prefill-Daten für den RND-Wizard aus dem aktuellen Objekt
  // V151: DOM-IDs korrigiert — Live-HTML nutzt 'str' nicht 'input-str' etc.
  // V154: objart-Kurz-Code wird auf Wizard-Langlabel gemappt, damit das
  //       Dropdown im Wizard die richtige Option vorauswählt.
  function _getRndPrefill() {
    var prefill = {};
    // Erst versuchen mit echten Live-IDs (V125+), Fallback mit input-Prefix
    var fieldMap = {
      // Wizard-Feld    : [Live-ID,        Fallback-ID]
      'baujahr':         ['baujahr',       'input-baujahr'],
      'wohnflaeche':     ['wfl',           'input-wfl'],
      'kp':              ['kp',            'input-kp'],
      'geb_ant':         ['geb_ant',       'input-geb-ant'],
      'str':             ['str',           'input-str'],
      'hnr':             ['hnr',           'input-hnr'],
      'plz':             ['plz',           'input-plz'],
      'ort':             ['ort',           'input-ort'],
      'kuerzel':         ['kuerzel',       'input-kuerzel'],
      'mea':             ['mea',           'input-mea'],
      'grenz':           ['grenz',         'input-grenz'],
      'afa_satz':        ['afa_satz',      'input-afa-satz'],
      'objart':          ['objart',        'input-objart'],  // Kurz-Code raw
      'ds2_energie':     ['ds2_energie',   'input-ds2-energie'],
      'ds2_zustand':     ['ds2_zustand',   'input-ds2-zustand']
    };
    Object.keys(fieldMap).forEach(function(wizField) {
      var ids = fieldMap[wizField];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) {
          var val = el.value || el.textContent || '';
          if (val) { prefill[wizField] = val; break; }
        }
      }
    });

    // V154: Kurz-Code aus Objekt-Tab → Langlabel im Wizard-Dropdown
    // (Wizard zeigt "Eigentumswohnung", Backend speichert "ETW")
    var objartLabelMap = {
      'ETW':    'Eigentumswohnung',
      'EFH':    'Einfamilienhaus',
      'MFH':    'Mehrfamilienhaus',
      'DHH':    'Doppelhaushälfte',
      'RH':     'Reihenhaus',
      'BUERO':  'Bürogebäude',
      'GESCH':  'Geschäftshaus',
      'HOTEL':  'Hotel',
      'GEW':    'Gewerbe-/Industriegebäude',
      'Gewerbe':'Gewerbe-/Industriegebäude',  // V124-Legacy
      'GAR':    'Garage / Stellplatz'
    };
    if (prefill.objart) {
      prefill.objekt_typ = objartLabelMap[prefill.objart] || prefill.objart;
    }

    // V151: Adresse + Objekt-Bezeichnung als Komposit-Feld
    if (prefill.str || prefill.hnr || prefill.plz || prefill.ort) {
      prefill.objekt_adresse =
        (prefill.str || '') + ' ' + (prefill.hnr || '') +
        ((prefill.plz || prefill.ort) ? ', ' + (prefill.plz || '') + ' ' + (prefill.ort || '') : '');
      prefill.objekt_adresse = prefill.objekt_adresse.trim().replace(/\s+/g, ' ');
    }
    // Einheit/Bezeichnung (z.B. WE 02)
    if (prefill.mea) prefill.einheit = prefill.mea;
    if (prefill.kuerzel) prefill.kuerzel_kurz = prefill.kuerzel;

    // Auftraggeber aus User-Settings
    try {
      var settings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      if (settings.user_name)  prefill.auftraggeber_name    = settings.user_name;
      if (settings.user_email) prefill.auftraggeber_email   = settings.user_email;
      if (settings.user_str)   prefill.auftraggeber_strasse = settings.user_str;
      if (settings.user_plz)   prefill.auftraggeber_plz     = settings.user_plz;
      if (settings.user_ort)   prefill.auftraggeber_ort     = settings.user_ort;
    } catch(e) {}
    // Stichtag = heute
    prefill.stichtag = new Date().toISOString().slice(0, 10);

    console.log('[RND-Wizard] Prefill ermittelt:', prefill);
    return prefill;
  }

  // V142: Zeigt nach Wizard-Abschluss das Ergebnis mit "Lohnt sich"-Bewertung
  function _showRndWizardResult(gutachtenState) {
    if (typeof window.DealPilotRND === 'undefined' || typeof window.DealPilotRND.calcAll !== 'function') {
      alert('RND-Modul nicht verfügbar.');
      return;
    }

    // Berechnung durchführen
    var calcInput = _buildCalcInputFromWizard(gutachtenState);
    var result;
    try {
      result = window.DealPilotRND.calcAll(calcInput);
    } catch (e) {
      console.error('[RND] Berechnung fehlgeschlagen:', e);
      alert('Berechnung fehlgeschlagen: ' + e.message);
      return;
    }

    // AfA-Vergleich
    var afa = null;
    try {
      var gebAnt = parseFloat(gutachtenState.geb_ant) || 80;
      var kp = parseFloat(gutachtenState.kp) || 0;
      var grenz = (parseFloat(gutachtenState.grenz) || 42) / 100;
      var standardAfa = (parseFloat(gutachtenState.afa_satz) || 2) / 100;
      if (kp > 0) {
        afa = window.DealPilotRND.calcAfaVergleich({
          gebaeudeanteil: kp * gebAnt / 100,
          rnd: result.final_rnd,
          grenzsteuersatz: grenz,
          standardAfaSatz: standardAfa,
          gutachterkosten: 1500,
          abzinsung: 0.03
        });
      }
    } catch (e) { console.warn('[RND] AfA-Vergleich nicht möglich:', e); }

    // V150: GND und Alter im Result anreichern (waren vorher '?')
    try {
      var bj = parseInt(gutachtenState.baujahr, 10);
      if (bj && !result.alter) {
        var stichtagYear = gutachtenState.stichtag
          ? new Date(gutachtenState.stichtag).getFullYear()
          : new Date().getFullYear();
        result.alter = stichtagYear - bj;
      }
      if (!result.gnd) {
        if (typeof DealPilotRND_GND !== 'undefined' && DealPilotRND_GND.getDefault) {
          result.gnd = DealPilotRND_GND.getDefault(gutachtenState.objekt_typ) || 70;
        } else {
          result.gnd = 70; // sicherer Default für Wohnobjekte
        }
      }
    } catch (e) { console.warn('[RND] Result-Enrichment fehlgeschlagen:', e); }

    _renderRndResultModal(gutachtenState, result, afa);
  }

  function _buildCalcInputFromWizard(g) {
    // Mapping der Wizard-Felder auf calcAll-Input
    return {
      baujahr: parseInt(g.baujahr, 10) || 1980,
      stichtag: g.stichtag || new Date().toISOString().slice(0,10),
      gnd: g.gnd || null,  // wird aus GND-Tabelle ermittelt falls nicht gesetzt
      objekt_typ: g.objekt_typ,
      gewerkeBewertung: g.gewerkeBewertung || {},
      modPoints: g.modPoints || 0,
      schaeden: g.schaeden || []
    };
  }

  function _renderRndResultModal(state, result, afa) {
    // Lohnt-Sich-Bewertung
    var lohntStufe = 'unklar';
    var lohntText = '';
    var lohntFarbe = '#7A7370';
    if (afa) {
      if (afa.ampel === 'gruen') { lohntStufe = 'klar lohnenswert'; lohntFarbe = '#3FA56C'; }
      else if (afa.ampel === 'gelb') { lohntStufe = 'grenzwertig'; lohntFarbe = '#C9A84C'; }
      else { lohntStufe = 'nicht lohnenswert'; lohntFarbe = '#B8625C'; }
      lohntText = (afa.empfehlung || '');
    } else if (result.final_rnd && result.final_rnd <= 30) {
      lohntStufe = 'wahrscheinlich lohnenswert';
      lohntFarbe = '#3FA56C';
      lohntText = 'RND ' + result.final_rnd + ' Jahre — i.d.R. attraktiver AfA-Hebel.';
    } else {
      lohntStufe = 'eher nicht lohnenswert';
      lohntFarbe = '#C9A84C';
      lohntText = 'RND ' + (result.final_rnd || '?') + ' Jahre — kaum Steuerhebel.';
    }

    var fmtE = function(v) {
      if (typeof v !== 'number' || !isFinite(v)) return '–';
      return v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
    };

    var modal = document.createElement('div');
    modal.id = 'rnd-result-modal';
    modal.className = 'da-modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px';

    var afaHtml = '';
    if (afa) {
      afaHtml = [
        '<div style="margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px">',
        '  <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">STANDARD-AfA</div><div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:600;color:#2A2727">' + (afa.afa_standard.satz_pct || '–') + ' %</div><div style="font-size:12px;color:#7A7370">' + fmtE(afa.afa_standard.jahresbetrag) + '/Jahr</div></div>',
        '  <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">KURZ-AfA (RND)</div><div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:600;color:#2A2727">' + (afa.afa_kurz.satz_pct || '–') + ' %</div><div style="font-size:12px;color:#7A7370">' + fmtE(afa.afa_kurz.jahresbetrag) + '/Jahr</div></div>',
        '  <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">MEHR STEUER/JAHR</div><div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:600;color:#3FA56C">' + fmtE(afa.steuerersparnis_jahr) + '</div></div>',
        '  <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">NETTO-VORTEIL</div><div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:600;color:#2A2727">' + fmtE(afa.netto_vorteil) + '</div><div style="font-size:12px;color:#7A7370">nach Gutachter-Kosten</div></div>',
        '</div>'
      ].join('');
    }

    modal.innerHTML = [
      '<div style="background:#fff;border-radius:8px;max-width:780px;width:100%;max-height:90vh;overflow-y:auto;padding:32px 36px;box-shadow:0 10px 40px rgba(0,0,0,0.2)">',
      '  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">',
      '    <div>',
      '      <div style="font-family:Cormorant Garamond,serif;font-size:26px;font-weight:600;color:#2A2727">RND-Analyse Ergebnis</div>',
      '      <div style="color:#7A7370;font-size:13px;margin-top:2px">' + (state.str || '') + ' ' + (state.hnr || '') + ', ' + (state.plz || '') + ' ' + (state.ort || '') + '</div>',
      '    </div>',
      '    <button onclick="document.getElementById(\'rnd-result-modal\').remove()" style="background:transparent;border:none;font-size:24px;cursor:pointer;color:#7A7370">×</button>',
      '  </div>',
      '  <div style="background:' + lohntFarbe + ';color:#fff;padding:14px 20px;border-radius:6px;margin-bottom:18px">',
      '    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:0.9">Bewertung</div>',
      '    <div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:600;margin-top:2px">' + lohntStufe.charAt(0).toUpperCase() + lohntStufe.slice(1) + '</div>',
      '    <div style="font-size:13px;margin-top:4px;opacity:0.95">' + lohntText + '</div>',
      '  </div>',
      '  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:8px">',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">RESTNUTZUNGSDAUER</div><div style="font-family:Cormorant Garamond,serif;font-size:32px;font-weight:600;color:#2A2727">' + (result.final_rnd || '?') + ' J.</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">GND</div><div style="font-family:Cormorant Garamond,serif;font-size:32px;font-weight:600;color:#2A2727">' + (result.gnd || '?') + ' J.</div></div>',
      '    <div><div style="font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.6px">ALTER</div><div style="font-family:Cormorant Garamond,serif;font-size:32px;font-weight:600;color:#2A2727">' + (result.alter || '?') + ' J.</div></div>',
      '  </div>',
      afaHtml,
      '  <div style="margin-top:20px;padding:14px 18px;background:#FAF6E8;border-radius:4px;font-size:12px;color:#7A7370;line-height:1.5">',
      '    <strong style="color:#2A2727">Rechtliche Basis:</strong> §7 Abs. 4 Satz 2 EStG, BFH IX R 25/19 (28.07.2021). Eine kürzere RND als die Standard-50-J. ist anerkennungsfähig durch Sachverständigen-Gutachten.',
      '  </div>',
      '  <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">',
      '    <button class="btn btn-outline" onclick="document.getElementById(\'rnd-result-modal\').remove()">Schließen</button>',
      '    <button class="btn btn-primary" onclick="DealPilotDealAction._rndOrderExpert()">Jetzt Anfrage senden →</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    // State für Anfrage cachen
    window._lastRndResult = { state: state, result: result, afa: afa };
  }

  // ─── V149: Anfrage an Junker-Backend senden (statt PDF/DOCX-Export) ───
  function _rndOrderExpert() {
    var r = window._lastRndResult;
    if (!r) {
      alert('Keine Wizard-Daten zum Senden vorhanden.');
      return;
    }

    // Vollständiges JSON-Payload für späteren Import im RND-Modul
    var payload = {
      typ: 'rnd_gutachten_anfrage',
      version: 'V149',
      timestamp: new Date().toISOString(),
      wizard_state: r.state,         // Komplette Wizard-Eingaben
      wizard_result: r.result,        // Berechnete RND + Zwischenergebnisse
      wizard_afa: r.afa,              // AfA-Vergleich
      meta: {
        user_agent: navigator.userAgent,
        absender: (window.DealPilotConfig && window.DealPilotConfig.branding && window.DealPilotConfig.branding.get && window.DealPilotConfig.branding.get().user_email) || null
      }
    };

    // Bestätigungs-Modal mit Loading-State
    var oldModal = document.getElementById('rnd-result-modal');
    if (oldModal) oldModal.remove();

    var confirmModal = document.createElement('div');
    confirmModal.id = 'rnd-anfrage-modal';
    confirmModal.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)';
    confirmModal.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:520px;width:100%;padding:32px;text-align:center;border:1px solid #C9A84C;box-shadow:0 30px 80px rgba(0,0,0,0.5)">' +
      '  <div id="rnd-anfrage-spinner" style="width:48px;height:48px;border:4px solid #FAF6E8;border-top-color:#C9A84C;border-radius:50%;margin:0 auto 20px;animation:rnd-spin 0.8s linear infinite"></div>' +
      '  <h3 style="margin:0 0 8px;font-family:\'Cormorant Garamond\',serif;font-size:22px;color:#2A2727;font-weight:600">Anfrage wird gesendet…</h3>' +
      '  <p style="margin:0;font-size:13px;color:#7A7370;line-height:1.6">Die Wizard-Daten werden übermittelt für die Erstellung eines vollständigen RND-Gutachtens durch ' + _brandCompany() + '.</p>' +
      '  <style>@keyframes rnd-spin { to { transform: rotate(360deg) } }</style>' +
      '</div>';
    document.body.appendChild(confirmModal);

    // POST an Backend
    fetch('/api/v1/rnd-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    }).then(function(resp) {
      return resp.ok ? resp.json() : Promise.reject(new Error('HTTP ' + resp.status));
    }).then(function(data) {
      _rndShowAnfrageSuccess(data && data.request_id);
    }).catch(function(err) {
      // Auch bei Fehler: JSON-Download als Fallback anbieten,
      // damit die Wizard-Eingaben nicht verloren gehen
      console.error('[RND] Anfrage-Submit fehlgeschlagen:', err);
      _rndShowAnfrageFallback(payload, err);
    });
  }

  function _rndShowAnfrageSuccess(requestId) {
    var modal = document.getElementById('rnd-anfrage-modal');
    if (!modal) return;
    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:520px;width:100%;padding:32px;text-align:center;border:1px solid #3FA56C;box-shadow:0 30px 80px rgba(0,0,0,0.5)">' +
      '  <div style="width:56px;height:56px;background:#3FA56C;border-radius:50%;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff">✓</div>' +
      '  <h3 style="margin:0 0 12px;font-family:\'Cormorant Garamond\',serif;font-size:24px;color:#2A2727;font-weight:600">Anfrage erfolgreich übermittelt</h3>' +
      '  <p style="margin:0 0 20px;font-size:13px;color:#7A7370;line-height:1.6">Ihre RND-Gutachten-Anfrage wurde an ' + _brandCompany() + ' gesendet.' +
            (requestId ? ' Referenz-Nr.: <strong style="color:#2A2727">' + requestId + '</strong>' : '') +
      '    <br><br>Sie erhalten in Kürze eine Bestätigung per E-Mail.' +
      '  </p>' +
      '  <button class="btn btn-primary" onclick="document.getElementById(\'rnd-anfrage-modal\').remove()" style="padding:10px 28px">Schließen</button>' +
      '</div>';
  }

  function _rndShowAnfrageFallback(payload, err) {
    var modal = document.getElementById('rnd-anfrage-modal');
    if (!modal) return;

    // JSON-Download URL erzeugen (für Fallback "manuell senden")
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var filename = 'rnd-anfrage-' + new Date().toISOString().slice(0,10) + '.json';

    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:560px;width:100%;padding:32px;border:1px solid #C9A84C;box-shadow:0 30px 80px rgba(0,0,0,0.5)">' +
      '  <div style="width:56px;height:56px;background:#E8B84F;border-radius:50%;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff">!</div>' +
      '  <h3 style="margin:0 0 12px;font-family:\'Cormorant Garamond\',serif;font-size:22px;color:#2A2727;font-weight:600;text-align:center">Server zurzeit nicht erreichbar</h3>' +
      '  <p style="margin:0 0 18px;font-size:13px;color:#7A7370;line-height:1.6;text-align:center">' +
      '    Die Anfrage konnte nicht direkt an ' + _brandCompany() + ' gesendet werden ' +
      '    <span style="color:#a04943">(' + (err && err.message ? err.message : 'Verbindungsfehler') + ')</span>.<br><br>' +
      '    <strong style="color:#2A2727">Alternative:</strong> Bitte laden Sie die Daten herunter und senden sie per E-Mail an ' +
      '    <a href="mailto:info@junker-immobilien.io" style="color:#C9A84C;text-decoration:none;font-weight:600">info@junker-immobilien.io</a>.' +
      '  </p>' +
      '  <div style="display:flex;gap:10px;justify-content:center">' +
      '    <button class="btn btn-outline" onclick="document.getElementById(\'rnd-anfrage-modal\').remove()">Abbrechen</button>' +
      '    <a class="btn btn-primary" href="' + url + '" download="' + filename + '" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:10px 22px">📄 JSON herunterladen</a>' +
      '  </div>' +
      '</div>';
  }

  // Alter Fallback (V138-Verhalten — falls Wizard nicht da)
  // V142: Portfolio-Strategieanalyse öffnen (vorher Hidden-Gate via roten Punkt
  // in Settings → Info). Setzt Unlock-Flag und öffnet das Modul direkt.
  // V143: Öffnet Settings → Datenraum-Tab — funktioniert für mehrere
  // Tab-Switch-Mechanismen (V124, V141, V142)
  function openDatenraumSettings() {
    // V151: Funktion heißt showSettings(initialTab), nicht openSettings
    var opener = null;
    if (typeof window.showSettings === 'function')      opener = window.showSettings;
    else if (typeof showSettings === 'function')        opener = showSettings;
    else if (typeof window.openSettings === 'function') opener = window.openSettings;
    else if (typeof openSettings === 'function')        opener = openSettings;

    if (!opener) {
      alert('Settings konnten nicht geöffnet werden. Bitte Seite neu laden.');
      return;
    }
    // showSettings akzeptiert optional initialTab — direkt auf "datenraum" wechseln
    try {
      opener('datenraum');
    } catch (e) {
      opener();
      // Fallback: nach Render-Pause manuell wechseln
      setTimeout(function() {
        var tab = document.querySelector('.st-tab[data-tab="datenraum"]');
        if (tab) {
          if (typeof window._swSet === 'function')      window._swSet(tab);
          else if (typeof _swSet === 'function')        _swSet(tab);
          else                                          tab.click();
        }
      }, 150);
    }
  }

  function openPortfolioStrategy() {
    if (typeof window.psUnlockAndOpen === 'function') {
      window.psUnlockAndOpen();
    } else {
      // Fallback wenn das UI-Modul noch nicht geladen ist
      try { localStorage.setItem('dp_ps_unlocked', 'true'); } catch(e) {}
      alert('Portfolio-Strategiemodul wird geladen — bitte Seite neu laden.');
    }
  }

  function openExpertFallbackRnd() {
    if (typeof openExpert === 'function') {
      openExpert();
      setTimeout(function() {
        var rndRadio = document.querySelector('input[name="expert-type"][value="rnd"]');
        if (rndRadio) {
          rndRadio.checked = true;
          var ev = new Event('change', { bubbles: true });
          rndRadio.dispatchEvent(ev);
        }
      }, 200);
    }
  }

  // V139: Öffnet Expert-Maske und wählt direkt Verkehrswert-Gutachten vor
  // (für KP-Aufteilung Grund/Boden vs. Gebäude)
  function openExpertWithGutachten() {
    if (typeof openExpert === 'function') {
      openExpert();
      setTimeout(function() {
        var vwRadio = document.querySelector('input[name="expert-type"][value="verkehrswert"]');
        if (vwRadio) {
          vwRadio.checked = true;
          var ev = new Event('change', { bubbles: true });
          vwRadio.dispatchEvent(ev);
        }
        // Vorbelegen des Nachrichten-Felds mit der KP-Aufteilung-Anfrage
        setTimeout(function() {
          var msgField = document.querySelector('#da-expert-msg, textarea[id*="msg"]');
          if (msgField && !msgField.value) {
            msgField.value = 'Ich benötige ein Verkehrswert-Gutachten mit getrennter Ausweisung Grund und Boden vs. Gebäude — zur Optimierung der AfA-Bemessungsgrundlage gegenüber dem Finanzamt (§6 Abs. 1 Nr. 1 EStG, BFH IX R 26/19).';
          }
        }, 100);
      }, 200);
    }
  }

  // V139: Springt zum Objekt-Tab (s0) — dort sind alle Eingaben für RND/KP-Aufteilung
  function gotoObjektTab() {
    closeModal();
    if (typeof window.switchTab === 'function') {
      window.switchTab(0);
    } else {
      // Fallback: direkt das Tab-Element klicken
      var tabBtn = document.querySelector('[data-tab="0"], #tab-0, .tab-0');
      if (tabBtn) tabBtn.click();
    }
    // Wenn der Bodenrichtwert-Bereich hidden ist (z.B. ausgeklappt unter "Erweiterte Angaben"),
    // versuchen, ihn sichtbar zu machen
    setTimeout(function() {
      var bodenrichtwertField = document.getElementById('input-bodenrichtwert');
      if (bodenrichtwertField) {
        bodenrichtwertField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bodenrichtwertField.focus();
      } else {
        // Falls Feld nicht existiert, dem User Hinweis geben
        alert('Bodenrichtwert-Feld nicht gefunden. Bitte unter Objekt-Tab → Erweiterte Angaben → Bodenrichtwert pflegen.');
      }
    }, 300);
  }

  return {
    init: init,
    openBank: openBank,
    openFB: openFB,
    openExpert: openExpert,
    openExpertWithRnd: openExpertWithRnd,
    openPortfolioStrategy: openPortfolioStrategy,
    openDatenraumSettings: openDatenraumSettings,
    _rndOrderExpert: _rndOrderExpert,
    _rndShowAnfrageSuccess: _rndShowAnfrageSuccess,
    _rndShowAnfrageFallback: _rndShowAnfrageFallback,
    openExpertWithGutachten: openExpertWithGutachten,
    gotoObjektTab: gotoObjektTab,
    refreshDatenraum: refreshDatenraum,
    openConsult: openConsult,
    openConsultQuick: openConsultQuick,
    submitExpert: submitExpert,
    openRND: openRND,
    submitRNDRequest: submitRNDRequest,
    submitRNDFromModule: submitRNDFromModule,
    submitConsultQuick: submitConsultQuick,
    bookSlot: bookSlot,
    submit: submit,
    gotoStep: gotoStep,
    closeModal: closeModal,
    _onPhotos: _onPhotos,
    // V104: Deal-Won-Status
    toggleWon: function() { setDealWon(!isDealWon(), true); },
    isWon: isDealWon,
    setWon: setDealWon,
    refreshWonUI: refreshDealWonUI,
    renderTab: renderTab
  };
})();
