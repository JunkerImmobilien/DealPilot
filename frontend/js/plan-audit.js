/**
 * V159 — Plan-Audit (Diagnose-Helper)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Im Browser Console aufrufen:
 *   DealPilotPlanAudit.run()           — Komplette Übersicht aller 4 Pläne
 *   DealPilotPlanAudit.checkUser()     — Was hat der aktuell eingeloggte User?
 *   DealPilotPlanAudit.compare(a, b)   — Diff zwischen zwei Plänen
 *
 * Zweck: verifizieren dass Frontend-config.js, Backend-Plans-Tabelle und
 * UI-Gating konsistent sind.
 */
(function () {
  'use strict';

  function _planMap() {
    if (!window.DealPilotConfig || !window.DealPilotConfig.pricing) {
      console.error('DealPilotConfig nicht geladen');
      return null;
    }
    var plans = window.DealPilotConfig.pricing.plans;
    return plans;
  }

  function run() {
    var plans = _planMap();
    if (!plans) return;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  DealPilot Plan-Audit — V159');
    console.log('═══════════════════════════════════════════════════════════');

    var keys = ['free', 'starter', 'investor', 'pro'];
    keys.forEach(function (k) {
      var p = plans[k];
      if (!p) return;
      console.log('');
      console.log('📋 ' + p.label.toUpperCase() + ' — ' + (p.tagline || '–'));
      console.log('   Preis:        ' + p.price_monthly_eur + ' €/Mo · ' + p.price_yearly_eur + ' €/Jahr');
      console.log('   Objekte:      ' + (p.limits.objects === -1 ? '∞' : p.limits.objects));
      console.log('   KI-Credits:   ' + p.limits.ai_credits + ' / Monat (=' + (p.limits.ai_credits * 2) + ' Anfragen)');
      console.log('   Watermark:    ' + (p.limits.watermark ? 'ja' : 'nein'));
      console.log('   ── Features ──');
      var fkeys = Object.keys(p.features).sort();
      var truthy = fkeys.filter(function(f) { return p.features[f] === true || p.features[f] === 'full' || p.features[f] === 'auto'; });
      var falsy  = fkeys.filter(function(f) { return p.features[f] === false; });
      var other  = fkeys.filter(function(f) { return truthy.indexOf(f) === -1 && falsy.indexOf(f) === -1; });
      console.log('   ✅ aktiv (' + truthy.length + '):  ' + truthy.join(', '));
      if (falsy.length)  console.log('   ❌ aus  (' + falsy.length + '):  ' + falsy.join(', '));
      if (other.length)  console.log('   ⚙ andere: ' + other.map(function(f) { return f + '=' + JSON.stringify(p.features[f]); }).join(', '));
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  KI-Credit-Pakete');
    console.log('═══════════════════════════════════════════════════════════');
    var packs = window.DealPilotConfig.pricing.ai_credit_packages || window.DealPilotConfig.ai_credit_packages || [];
    packs.forEach(function (pkg) {
      console.log('  ' + pkg.credits + ' Credits (' + pkg.anfragen + ' Anfragen) — ' + pkg.price_eur + ' €  → ' + pkg.per_anfrage + ' €/Anfrage' + (pkg.highlight ? '  ⭐ BELIEBT' : ''));
    });
  }

  function checkUser() {
    var current = null;
    try {
      current = window.DealPilotConfig.pricing.current();
    } catch (e) {}
    if (!current) {
      console.error('Kein aktiver Plan ermittelbar — Session?');
      return;
    }
    console.log('Aktueller User-Plan: ' + current.label + ' (' + current.key + ')');
    console.log('  Preis: ' + current.price_monthly_eur + ' €/Mo');
    console.log('  Features:');
    Object.keys(current.features).sort().forEach(function (f) {
      var v = current.features[f];
      var icon = v === true ? '✅' : v === false ? '❌' : '⚙';
      console.log('    ' + icon + ' ' + f + ' = ' + JSON.stringify(v));
    });
  }

  function compare(a, b) {
    var plans = _planMap();
    if (!plans || !plans[a] || !plans[b]) {
      console.error('Plan unbekannt:', a, b);
      return;
    }
    var pa = plans[a], pb = plans[b];
    var allKeys = {};
    Object.keys(pa.features).forEach(function (k) { allKeys[k] = true; });
    Object.keys(pb.features).forEach(function (k) { allKeys[k] = true; });
    console.log('═══ Diff: ' + a + ' vs ' + b + ' ═══');
    Object.keys(allKeys).sort().forEach(function (k) {
      var va = pa.features[k], vb = pb.features[k];
      if (JSON.stringify(va) === JSON.stringify(vb)) return;
      console.log('  ' + k + ':  ' + a + '=' + JSON.stringify(va) + '  →  ' + b + '=' + JSON.stringify(vb));
    });
  }

  window.DealPilotPlanAudit = { run: run, checkUser: checkUser, compare: compare };
  console.log('[plan-audit-v159] geladen — Aufrufen: DealPilotPlanAudit.run() / .checkUser() / .compare("free","starter")');
})();
