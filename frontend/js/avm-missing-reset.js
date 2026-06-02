/* ============================================================================
   DealPilot v443 – avm-missing-reset.js
   Behebt: rote AVM-Pflichtfeld-Markierung (.oab-missing-hl) blieb kleben.
     - tippt man in ein markiertes Feld -> Markierung sofort weg
     - neues Objekt (newObj) / Objektwechsel (loadData) -> alle Markierungen weg
   Reiner additiver Wrapper. Idempotent. Frontend-only.
   ============================================================================ */
(function () {
  'use strict';
  function clearAll() {
    try { document.querySelectorAll('.oab-missing-hl').forEach(function (el) { el.classList.remove('oab-missing-hl'); }); } catch (e) {}
  }
  function clearOne(e) {
    var t = e && e.target;
    if (t && t.classList && t.classList.contains('oab-missing-hl')) t.classList.remove('oab-missing-hl');
  }
  // capture-phase: feuert zuerst, uebersteht stopPropagation weiter unten
  document.addEventListener('input', clearOne, true);
  document.addEventListener('change', clearOne, true);

  function wrap(name) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn._v443MissReset) return;
    var orig = fn;
    var w = function () { var r = orig.apply(this, arguments); try { setTimeout(clearAll, 0); } catch (e) {} return r; };
    w._v443MissReset = true;
    for (var k in orig) { try { w[k] = orig[k]; } catch (e) {} }
    window[name] = w;
  }
  // wiederholt versuchen: object-actions.js wrappt newObj/loadData ggf. spaeter neu
  var t = 0;
  (function boot() { wrap('newObj'); wrap('loadData'); if (t++ < 60) setTimeout(boot, 300); })();
})();
