/**
 * V167 — UI-Audit (sicher, ohne Plan-Override)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Browser-Konsole:
 *   DealPilotUIAudit.run()             — Audit für aktuell aktiven Plan
 *   DealPilotUIAudit.preview('starter')— Was würde Plan X zeigen? (NUR LESEND)
 *   DealPilotUIAudit.diff('starter','investor')  — Welche Features ändern sich?
 *
 * V167: switchToPlan() ENTFERNT — verursachte App-Hang weil
 * Backend-Plan via Sub.getCurrentSync() den Override überschrieb und
 * die App in inkonsistenten Zustand brachte. Statt echtem Switch
 * gibt's jetzt nur read-only Vorschauen via DealPilotConfig.pricing.plans.
 */
(function () {
  'use strict';

  function _cur() {
    try { return window.DealPilotConfig.pricing.current(); } catch (e) { return null; }
  }

  function _allPlans() {
    try { return window.DealPilotConfig.pricing.plans; } catch (e) { return null; }
  }

  function _fmt(label, value, ok) {
    var icon = ok === true ? '✅' : ok === false ? '❌' : '⚙';
    return '  ' + icon + ' ' + label + ': ' + value;
  }

  function checkConfigVsDb() {
    console.log('');
    console.log('═══ 1. DB vs config.js (Preis-Konsistenz) ═══');
    var cur = _cur();
    if (!cur) {
      console.log('  ⚠ Kein aktueller Plan verfügbar (nicht eingeloggt?)');
      return;
    }
    console.log(_fmt('Aktiver Plan (Frontend)', cur.label + ' (' + cur.key + ')', true));
    console.log(_fmt('Preis monatlich', cur.price_monthly_eur + ' €'));
    console.log(_fmt('Preis jährlich', cur.price_yearly_eur + ' €'));
    console.log(_fmt('max_objects', cur.limits.objects === -1 ? 'unbegrenzt' : cur.limits.objects));
    console.log(_fmt('KI-Credits / Monat', cur.limits.ai_credits + ' (=' + (cur.limits.ai_credits * 2) + ' Anfragen)'));
    console.log(_fmt('Watermark', cur.limits.watermark ? 'JA' : 'NEIN'));

    fetch('/api/v1/plans', { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('ji_token') || '') } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var dbPlan = (data.plans || []).find(function (p) { return p.id === cur.key; });
        if (!dbPlan) {
          console.warn('  ⚠ Plan "' + cur.key + '" nicht in DB-Response gefunden');
          return;
        }
        console.log('');
        console.log('  DB-Werte für "' + cur.key + '":');
        console.log('    Preis monatlich: ' + (dbPlan.price_monthly_cents / 100) + ' €');
        console.log('    Preis jährlich:  ' + (dbPlan.price_yearly_cents / 100) + ' €');
        console.log('    max_objects:     ' + (dbPlan.max_objects === -1 ? 'unbegrenzt' : dbPlan.max_objects));
        console.log('    custom_finance_models: ' + dbPlan.features.custom_finance_models);

        if (Number(dbPlan.price_monthly_cents / 100) !== Number(cur.price_monthly_eur)) {
          console.warn('  🚨 Preis-Diskrepanz! Frontend: ' + cur.price_monthly_eur + ' € vs DB: ' + (dbPlan.price_monthly_cents / 100) + ' €');
        }
        if (dbPlan.max_objects !== cur.limits.objects) {
          console.warn('  🚨 max_objects Diskrepanz! Frontend: ' + cur.limits.objects + ' vs DB: ' + dbPlan.max_objects);
        }
      })
      .catch(function (e) { console.warn('  ⚠ DB-Plan nicht abrufbar:', e.message); });
  }

  function checkUiFeatureGates() {
    console.log('');
    console.log('═══ 2. UI Feature-Gates (für aktiven Plan) ═══');
    var cur = _cur();
    if (!cur) return;
    var f = cur.features;

    var d1TypeSelect = document.getElementById('d1_type') || document.getElementById('d1_typ');
    if (d1TypeSelect) {
      var options = [].slice.call(d1TypeSelect.options);
      var tilgOption = options.find(function (o) { return o.text.toLowerCase().includes('tilgungsaussetz'); });
      var bausparOption = options.find(function (o) { return o.text.toLowerCase().includes('bauspar'); });
      var expected = !!f.custom_finance_models;
      var visibleTilg = tilgOption && !tilgOption.disabled && !tilgOption.text.includes('🔒');
      var visibleBauspar = bausparOption && !bausparOption.disabled && !bausparOption.text.includes('🔒');
      console.log(_fmt('d1_type Dropdown Tilgungsaussetzung', visibleTilg ? 'frei' : 'gesperrt (🔒)', visibleTilg === expected));
      if (bausparOption) {
        console.log(_fmt('d1_type Dropdown Bausparvertrag', visibleBauspar ? 'frei' : 'gesperrt (🔒)', visibleBauspar === expected));
      }
    } else {
      console.log('  ⚙ d1_type Dropdown nicht gefunden (eventuell anderer Tab)');
    }

    console.log(_fmt('Watermark erwartet auf PDFs', cur.limits.watermark ? 'JA (Free)' : 'NEIN', null));

    var demoBadge = document.querySelector('.sc-demo-badge, .sc-investor-badge');
    var inDemo = demoBadge && demoBadge.textContent.toLowerCase().includes('demo');
    var expected = f.deal_score_v2;
    console.log(_fmt('Investor DealScore (24 KPI)', expected === true ? 'vollständig' : expected === 'demo' ? 'Demo-Badge' : 'aus', null));
    if (inDemo) console.log('    → Demo-Badge gefunden ✓');
  }

  function checkPaywallTriggers() {
    console.log('');
    console.log('═══ 3. Paywall-Trigger Status ═══');
    var cur = _cur();
    if (!cur) return;

    var objCount = 0;
    try {
      var objs = JSON.parse(localStorage.getItem('dp_objects') || '[]');
      objCount = objs.length;
    } catch (e) {}
    var sidebar = document.querySelectorAll('.dp-portfolio-item, .so-card, .sb-obj').length;
    console.log(_fmt('Gespeicherte Objekte (lokal)', objCount, null));
    console.log(_fmt('Sichtbare Objekte (Sidebar)', sidebar, null));
    console.log(_fmt('Plan-Limit', cur.limits.objects === -1 ? '∞' : cur.limits.objects, null));

    if (cur.limits.objects !== -1 && objCount >= cur.limits.objects) {
      console.warn('  🚨 Objekt-Limit erreicht! Paywall sollte triggern.');
    }

    var paywallBanner = document.querySelector('.dp-paywall, .paywall-banner, [class*="paywall"]');
    console.log(_fmt('Paywall-Banner sichtbar', paywallBanner ? 'JA' : 'NEIN', null));
  }

  function run() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  DealPilot UI-Audit V167 — Plan-Konsistenz-Check');
    console.log('═══════════════════════════════════════════════════════════');
    checkConfigVsDb();
    checkUiFeatureGates();
    checkPaywallTriggers();
    console.log('');
    console.log('Lese-Tools (sicher):');
    console.log('  → DealPilotUIAudit.preview("starter") — Plan-Definition anschauen');
    console.log('  → DealPilotUIAudit.diff("starter","investor") — Plan-Diff');
    console.log('  → DealPilotPlanAudit.run() — Alle Pläne im Detail');
  }

  function preview(planKey) {
    var plans = _allPlans();
    if (!plans || !plans[planKey]) {
      console.error('Plan unbekannt:', planKey, '— Optionen: free, starter, investor, pro');
      return;
    }
    var p = plans[planKey];
    console.log('═══ Vorschau: Plan "' + planKey + '" — was würde ein User sehen ═══');
    console.log('  Name:           ' + p.label);
    console.log('  Tagline:        ' + (p.tagline || '–'));
    console.log('  Preis:          ' + p.price_monthly_eur + ' €/Mo · ' + p.price_yearly_eur + ' €/Jahr');
    console.log('  Objekte:        ' + (p.limits.objects === -1 ? '∞' : p.limits.objects));
    console.log('  KI-Credits:     ' + p.limits.ai_credits + ' (= ' + (p.limits.ai_credits * 2) + ' Anfragen)');
    console.log('  Watermark:      ' + (p.limits.watermark ? 'JA' : 'nein'));
    console.log('');
    console.log('  Feature-Sichtbarkeit (✅ = sichtbar, ❌ = gesperrt):');
    var f = p.features;
    var importantFeatures = [
      ['Tilgungsaussetzung/Bauspar', f.custom_finance_models],
      ['Investor DealScore 24 KPI', f.deal_score_v2],
      ['BMF-Rechner & Export', f.bmf_calc_export],
      ['Bankexport', f.bankexport],
      ['Track-Record-PDF', f.track_record_pdf],
      ['Live-Marktzinsen', f.live_market_rates],
      ['Custom Logo im PDF', f.custom_logo],
      ['Bank-PDF Premium-Layout', f.bank_pdf_premium],
      ['Custom Track-Record Cover', f.track_record_custom_cover],
      ['Priorisierter Support', f.priority_support || f.support === 'priority'],
      ['Investment-Thesis KI', f.investment_thesis_ai]
    ];
    importantFeatures.forEach(function(row) {
      var name = row[0]; var val = row[1];
      var icon = val === true ? '✅' : val === 'demo' ? '⚙ Demo' : '❌';
      console.log('    ' + icon + ' ' + name);
    });
    console.log('');
    console.log('  Hinweis: NUR Vorschau, kein Plan-Wechsel. Dein aktiver Plan: ' +
      (_cur() ? _cur().label : '?'));
  }

  function diff(planA, planB) {
    var plans = _allPlans();
    if (!plans || !plans[planA] || !plans[planB]) {
      console.error('Plan unbekannt. Optionen: free, starter, investor, pro');
      return;
    }
    var pa = plans[planA], pb = plans[planB];
    console.log('═══ Diff: ' + planA + ' vs ' + planB + ' ═══');
    console.log('Preis:   ' + pa.price_monthly_eur + ' € → ' + pb.price_monthly_eur + ' €');
    console.log('Objekte: ' + (pa.limits.objects === -1 ? '∞' : pa.limits.objects) +
                ' → ' + (pb.limits.objects === -1 ? '∞' : pb.limits.objects));
    console.log('KI-Credits/Mo: ' + pa.limits.ai_credits + ' → ' + pb.limits.ai_credits);
    console.log('');
    console.log('Features die in "' + planB + '" anders sind:');
    var allKeys = {};
    Object.keys(pa.features).forEach(function(k) { allKeys[k] = true; });
    Object.keys(pb.features).forEach(function(k) { allKeys[k] = true; });
    Object.keys(allKeys).sort().forEach(function(k) {
      var va = pa.features[k], vb = pb.features[k];
      if (JSON.stringify(va) === JSON.stringify(vb)) return;
      console.log('  ' + k + ':  ' + JSON.stringify(va) + ' → ' + JSON.stringify(vb));
    });
  }

  window.DealPilotUIAudit = { run: run, preview: preview, diff: diff };
  console.log('[ui-audit V167] geladen — sichere Read-Only-Tools: run() / preview("starter") / diff("a","b")');
})();
