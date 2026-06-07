/* v495 — Free-Plan Korridor-Lock
   Adress-Lock: str/hnr/plz/ort/objart sind nach dem ersten Speichern fix.
   Kaufpreis-Korridor: +/-20% um den persistierten Kaufpreis.
   Additiv: wrappt window.saveObj (Muster wie sidebar-collapse), fail-open bei API-Fehlern. */
(function () {
  'use strict';
  if (window._dpFreeLockInstalled) return;
  window._dpFreeLockInstalled = true;

  var LOCK_FIELDS = ['str', 'hnr', 'plz', 'ort', 'objart'];
  var KP_CORRIDOR = 0.20;

  function planId() {
    try {
      if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.current === 'function') {
        var p = DealPilotConfig.pricing.current();
        if (p && p.id) return String(p.id).toLowerCase();
      }
    } catch (e) {}
    try { var o = localStorage.getItem('dp_plan_override'); if (o) return String(o).toLowerCase(); } catch (e) {}
    return 'free';
  }

  function dom(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function numDE(v) {
    if (v == null) return 0;
    var s = String(v).trim();
    if (!s) return 0;
    var n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  function say(msg) {
    if (typeof toast === 'function') toast(msg);
    else alert(msg);
  }

  function install() {
    var _orig = window.saveObj;
    if (typeof _orig !== 'function') { setTimeout(install, 500); return; }
    if (_orig._dpFreeLock) return;

    window.saveObj = async function (opts) {
      try {
        if (planId() === 'free' && window.Api && typeof Api.get === 'function') {
          var list = await Api.get('/objects?limit=100');
          var items = (list && list.items) || [];
          if (items.length > 0) {
            var det = await Api.get('/objects/' + items[0].id);
            var blob = (det && det.data) || det || {};

            // 1) Adress-Lock — greift erst, wenn eine Adresse persistiert ist
            if (String(blob.str || '').trim()) {
              for (var i = 0; i < LOCK_FIELDS.length; i++) {
                var f = LOCK_FIELDS[i];
                var oldV = String(blob[f] == null ? '' : blob[f]).trim();
                var newV = dom(f);
                if (oldV && newV && oldV !== newV) {
                  say('Free-Plan: Dein Objekt ist auf Adresse und Objektart festgelegt. F\u00fcr weitere Objekte einfach upgraden (ab 29 \u20ac/Monat).');
                  return false;
                }
              }
            }

            // 2) Kaufpreis-Korridor +/-20% um den persistierten Kaufpreis
            var oldKp = numDE(blob.kp);
            var newKp = numDE(dom('kp'));
            if (oldKp > 0 && newKp > 0) {
              var lo = oldKp * (1 - KP_CORRIDOR);
              var hi = oldKp * (1 + KP_CORRIDOR);
              if (newKp < lo || newKp > hi) {
                say('Free-Plan: Kaufpreis-Szenarien sind im Korridor \u00b120 % m\u00f6glich (' +
                  Math.round(lo).toLocaleString('de-DE') + ' \u2013 ' + Math.round(hi).toLocaleString('de-DE') +
                  ' \u20ac). F\u00fcr andere Objekte: Plan upgraden.');
                return false;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[free-lock v495] Check uebersprungen (fail-open):', e);
      }
      return _orig.apply(this, arguments);
    };
    window.saveObj._dpFreeLock = true;
    console.log('[free-lock v495] installiert');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
