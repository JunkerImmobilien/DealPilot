'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V51 — Quick-Check Tab (Haupt-Ansicht)

   Eigenständig, neben dem alten quick-check.js Modal.
   Felder mit qct_ Prefix damit's nicht kollidiert.
   ═══════════════════════════════════════════════════════════════ */
(function() {

  function _val(id) {
    var e = document.getElementById(id);
    return e ? parseFloat((e.value || '').replace(',', '.')) : NaN;
  }
  function _setT(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function _setCls(id, cls) {
    var e = document.getElementById(id);
    if (!e) return;
    e.classList.remove('gn', 'rd');
    if (cls) e.classList.add(cls);
  }
  function _fmtEur(n, dec) {
    if (!isFinite(n)) return '—';
    return '€ ' + n.toLocaleString('de-DE', {
      minimumFractionDigits: dec || 0,
      maximumFractionDigits: dec || 0
    });
  }
  function _fmtPct(n, dec) {
    if (!isFinite(n)) return '—';
    return n.toFixed(dec === undefined ? 2 : dec).replace('.', ',') + ' %';
  }
  function _fmtX(n) {
    if (!isFinite(n)) return '—';
    return n.toFixed(2).replace('.', ',') + ' ×';
  }

  function qcUpdate() {
    var kp   = _val('qct_kp');
    var wfl  = _val('qct_wfl');
    var nkm  = _val('qct_nkm');
    var ek   = _val('qct_ek') || 0;
    var zins = (_val('qct_zins') || 3.95) / 100;
    var tilg = (_val('qct_tilg') || 2.0) / 100;

    if (!kp || !nkm) {
      _setT('qct_verdict_ico', '⏳');
      _setT('qct_verdict_label', 'Eingaben prüfen…');
      _setT('qct_verdict_sub', 'Trag links Kaufpreis und Miete ein.');
      ['qct_bmr','qct_fak','qct_rate','qct_cf','qct_ltv','qct_ppm'].forEach(function(id) { _setT(id, '—'); });
      return;
    }

    // Annahmen für Schnell-Rechnung:
    //   NK pauschal 12% (Notar 2.2 + GrESt 6.5 + Makler 2.0 + GBA 0.5 + Puffer ~0.8)
    var nk = kp * 0.12;
    var gesi = kp + nk;
    var darlehen = Math.max(0, gesi - ek);
    var rate_m = darlehen * (zins + tilg) / 12;

    var bmr = (nkm * 12) / kp * 100;          // Bruttomietrendite auf KP
    var fak = kp / (nkm * 12);                // Faktor
    var cf_vst_m = nkm - rate_m;              // CF vor Steuer / Monat (sehr grob, ohne BWK)
    var ltv = darlehen / kp * 100;            // LTV auf KP
    var ppm = wfl > 0 ? kp / wfl : NaN;

    _setT('qct_bmr',  _fmtPct(bmr));
    _setT('qct_fak',  _fmtX(fak));
    _setT('qct_rate', _fmtEur(rate_m, 2));
    _setT('qct_cf',   _fmtEur(cf_vst_m, 2));
    _setT('qct_ltv',  _fmtPct(ltv, 1));
    _setT('qct_ppm',  _fmtEur(ppm));

    // Farben für CF + LTV
    _setCls('qct_cf', cf_vst_m >= 0 ? 'gn' : 'rd');
    _setCls('qct_ltv', ltv > 100 ? 'rd' : (ltv <= 85 ? 'gn' : null));
    _setCls('qct_bmr', bmr >= 5 ? 'gn' : (bmr < 3.5 ? 'rd' : null));

    // Verdict
    var ico, label, sub;
    if (bmr >= 5 && cf_vst_m >= 0 && ltv <= 100) {
      ico = '✅';
      label = 'Solider Deal';
      sub = 'Rendite passt, Cashflow positiv, Beleihung im Rahmen. Vollberechnung lohnt sich.';
    } else if (bmr >= 3.5 && cf_vst_m > -200) {
      ico = '⚠️';
      label = 'Grenzwertig — genauer prüfen';
      sub = 'Rendite oder Cashflow knapp. Mit Verhandlung oder mehr EK ggf. machbar.';
    } else {
      ico = '❌';
      label = 'Schwacher Deal';
      sub = 'Rendite zu niedrig oder Cashflow stark negativ. Eher passen.';
    }
    _setT('qct_verdict_ico', ico);
    _setT('qct_verdict_label', label);
    _setT('qct_verdict_sub', sub);
  }

  function qcReset() {
    ['qct_kp','qct_wfl','qct_nkm','qct_ek'].forEach(function(id) {
      var e = document.getElementById(id); if (e) e.value = '';
    });
    var z = document.getElementById('qct_zins');  if (z) z.value = '3.95';
    var t = document.getElementById('qct_tilg');  if (t) t.value = '2.0';
    qcUpdate();
  }

  function qcImportToFull() {
    var kp   = _val('qct_kp');
    var wfl  = _val('qct_wfl');
    var nkm  = _val('qct_nkm');
    var ek   = _val('qct_ek');
    var zins = _val('qct_zins');
    var tilg = _val('qct_tilg');

    if (!kp || !nkm) {
      if (typeof toast === 'function') toast('⚠ Bitte mind. Kaufpreis + Miete ausfüllen.');
      return;
    }

    // Werte in die echten Vollberechnungs-Felder schieben
    var map = {
      kp:   kp,
      wfl:  wfl,
      nkm:  nkm,
      ek:   ek,
      d1z:  zins,
      d1t:  tilg
    };
    Object.keys(map).forEach(function(id) {
      var e = document.getElementById(id);
      var v = map[id];
      if (e && isFinite(v)) {
        e.value = v;
        // Change-Event auslösen, damit calc()/upd() greift
        var evt = new Event('input', { bubbles: true });
        e.dispatchEvent(evt);
      }
    });

    if (typeof calc === 'function') calc();
    if (typeof toast === 'function') toast('✓ Werte in Vollberechnung übernommen — wechsle zu Tab Investition.');

    // V63.76: Standalone-Modus verlassen, dann zu Tab "Investition" (Index 1 nach Quick-Check-Refactor)
    if (typeof exitQuickCheckMode === 'function') exitQuickCheckMode();
    if (typeof switchTab === 'function') switchTab(1);
  }

  // Beim ersten Tab-Aktivieren ein qcUpdate auslösen (zeigt initialen "—"-State sauber)
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(qcUpdate, 50);
  });

  window.qcUpdate = qcUpdate;
  window.qcReset = qcReset;
  window.qcImportToFull = qcImportToFull;
})();
