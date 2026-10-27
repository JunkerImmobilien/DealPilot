/* ─────────────────────────────────────────────────────────────────
 * V291: Inventar-Detail-Sync
 *
 * Synchronisiert die 6 Detail-Felder (Küche/Möbel/Geräte/PV/
 * Stellplatz/Sonstiges) mit dem bestehenden #moebl-Feld.
 *
 * Verhalten:
 *   - Wenn IRGENDEIN Detail-Feld einen Wert > 0 hat:
 *       → Summe wird in #moebl geschrieben (read-only Optik)
 *       → #moebl bekommt "from-inv-detail" Klasse + Tooltip
 *   - Wenn alle Detail-Felder leer (alte Bestandsobjekte):
 *       → #moebl bleibt manuell editierbar (Rückwärtskompatibilität)
 *
 * Außerdem:
 *   - Anzeige "Summe Inventar" (#inv_sum)
 *   - Anzeige "Immobilien-KP = KP − Inventar" (#inv_immo_kp)
 * ───────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  var INV_IDS = ['inv_kueche', 'inv_moebel', 'inv_geraete', 'inv_pv', 'inv_stellplatz', 'inv_sonst'];

  function _parseDe(s){
    if (s == null) return 0;
    s = String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    var v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  function _fmtEur(v, decimals){
    if (decimals == null) decimals = 0;
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(v) + ' €';
  }

  function _getInvSum(){
    var sum = 0;
    INV_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if (el) sum += _parseDe(el.value);
    });
    return sum;
  }

  function _hasAnyDetail(){
    return INV_IDS.some(function(id){
      var el = document.getElementById(id);
      return el && _parseDe(el.value) > 0;
    });
  }

  function _syncInventarToMoebl(){
    var sum = _getInvSum();
    var hasDetail = _hasAnyDetail();
    var moebl = document.getElementById('moebl');
    var sumEl = document.getElementById('inv_sum');
    var statusEl = document.getElementById('inv_sync_status');
    var immoKpEl = document.getElementById('inv_immo_kp');

    // 1. Summe anzeigen
    if (sumEl) sumEl.textContent = _fmtEur(sum);

    // 2. #moebl synchronisieren wenn Detail-Felder gefüllt
    if (moebl) {
      if (hasDetail) {
        // Detail-Modus: #moebl wird automatisch befüllt + gesperrt
        var moeblOld = _parseDe(moebl.value);
        if (Math.abs(sum - moeblOld) > 0.5) {
          moebl.value = sum.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        moebl.setAttribute('readonly', 'readonly');
        moebl.classList.add('from-inv-detail');
        moebl.style.background = 'var(--gold-bg, #FFF7E0)';
        moebl.style.cursor = 'not-allowed';
        moebl.title = 'Aus Inventar-Detail-Aufschlüsselung synchronisiert · ' + _fmtEur(sum);
        if (statusEl) {
          statusEl.textContent = '✓ Synchronisiert';
          statusEl.style.color = 'var(--green, #3FA56C)';
        }
      } else {
        // Legacy-Modus: #moebl manuell editierbar
        moebl.removeAttribute('readonly');
        moebl.classList.remove('from-inv-detail');
        moebl.style.background = '';
        moebl.style.cursor = '';
        moebl.title = '';
        if (statusEl) {
          statusEl.textContent = '— Detail leer, Möblierung manuell';
          statusEl.style.color = 'var(--muted)';
        }
      }
    }

    // 3. Immobilien-KP anzeigen
    var kp = _parseDe((document.getElementById('kp') || {}).value);
    var immoKp = Math.max(0, kp - sum);
    if (immoKpEl) immoKpEl.textContent = kp > 0 ? _fmtEur(immoKp) : '—';
  }

  /* v2269 · EINE Inventarsumme fuer alle Rechner: die Detailbox, und wenn sie
     leer ist, #moebl („Legacy-Modus" oben - Inventar direkt eingetragen).
     Bis hier zaehlten BMF-Fenster, Bodenabschlag und RND-Rechner nur die
     Detailbox und rechneten mit dem vollen Kaufpreis, sobald das Inventar nur
     in #moebl stand (Ravensberger Weg 38: 7.000 EUR). */
  window.dpInventarSumme = function () {
    var s = _getInvSum();
    if (s > 0) return s;
    var m = document.getElementById('moebl');
    var v = m ? _parseDe(m.value) : 0;
    return v > 0 ? v : 0;
  };

  // Globaler Export
  window._syncInventarToMoebl = _syncInventarToMoebl;
  window._getInventarSum = _getInvSum;
  window._hasAnyInvDetail = _hasAnyDetail;

  // Initial-Sync nach DOM ready + bei Storage-Load
  /* v3006c · Hinweis am Inventarfeld: die Grunderwerbsteuer rechnet DealPilot seit v3006c auf
     den Kaufpreis ohne Inventar (§ 2 GrEStG) - das traegt nur, wenn der Vertrag es ausweist.
     Hier statt in index.html, weil der Hinweis zur Rechnung gehoert, nicht zum Layout. */
  function _grestHinweis(){
    var m = document.getElementById('moebl');
    var f = m && m.closest ? m.closest('.f') : null;
    if (!f || f.querySelector('[data-grest-hinweis]')) return;
    var s = document.createElement('span');
    s.className = 'hint'; s.setAttribute('data-grest-hinweis', '1');
    s.style.cssText = 'font-size:11px;display:block;margin-top:2px';
    s.textContent = 'Inventar ist grunderwerbsteuerfrei, wenn es im Kaufvertrag gesondert und angemessen ausgewiesen ist.';
    f.appendChild(s);
  }
  function _init(){
    _syncInventarToMoebl();
    try { _grestHinweis(); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', _init);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_init, 100);
  }

  // Re-Sync wenn Objekt geladen wird (storage.js löst _v264_object_loaded aus)
  document.addEventListener('dp:object-loaded', _init);

  // Re-Sync wenn #kp ändert (für Immobilien-KP-Anzeige)
  document.addEventListener('DOMContentLoaded', function(){
    var kp = document.getElementById('kp');
    if (kp) {
      kp.addEventListener('input', function(){
        // Nur Immobilien-KP-Anzeige updaten, nicht #moebl überschreiben
        var sum = _getInvSum();
        var kpVal = _parseDe(kp.value);
        var immoKpEl = document.getElementById('inv_immo_kp');
        if (immoKpEl) immoKpEl.textContent = kpVal > 0 ? _fmtEur(Math.max(0, kpVal - sum)) : '—';
      });
    }
  });

})();
