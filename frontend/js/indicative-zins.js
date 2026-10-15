/* indicative-zins.js — v816c: definiert window.dpGetIndicativeZins(binding, margin).
 * WURZEL-FIX: Die Funktion wurde in investment-profile.js (getZins Z.77, Z.299) + im
 * Quickboarding-iframe (qc_zins-Retry) aufgerufen, war aber NIE definiert -> getZins() lieferte
 * immer null -> qc_zins blieb leer.
 *
 * v2245 · MARKTFORMEL statt Pfandbrief + feste Marge:
 *
 *   Bauzins(b, LTV) = Bund_b + Aufschlag_b + K + Z(LTV)
 *
 * Die Bausteine liefert das Backend (/market-rates/pfandbrief -> `formel`,
 * gerechnet in backend/src/services/bauzinsService.js). Rangfolge der Quellen:
 *   1. Live-Daten aus market-rates-pf.js (window.dpGetPfData().formel)
 *   2. DealPilotConfig.marketRates.bauzins (statischer, gemessener Stand)
 *   3. STATIC unten (dieselben Zahlen, falls die Config fehlt)
 *   4. Altmodell Pfandbrief + Marge (nur wenn gar keine Formel da ist)
 *
 * dpGetIndicativeZins(binding, margin, ltv)
 *   ltv (optional, Prozent): Zuschlag Z(LTV) linear aus den Stuetzstellen.
 *   ohne ltv: die Stufe margin (premium 60 % / standard 80 % / schwach 90 %).
 *
 * Dazu der Hinweis am Zinsfeld der Finanzierung (#d1z): "Marktzins fuer
 * deinen LTV ... : q %" mit Knopf "uebernehmen". Er UEBERSCHREIBT NIE von
 * selbst - der eingetragene Zins gehoert dem Nutzer.
 */
(function () {
  'use strict';
  if (window.dpGetIndicativeZins && window.dpGetIndicativeZins._v2245) return;

  /* Letzte Rueckfallebene - gemessen 15.10.2026 (tools/bauzins-pruefen.mjs),
     identisch mit config.js marketRates.bauzins und dem Backend-STATISCHER_STAND. */
  var STATIC_FORMEL = {
    bund:      { '5': 3.23,  '10': 3.51,  '15': 3.70,  '20': 3.80 },
    aufschlag: { '5': 1.144, '10': 0.558, '15': 0.530, '20': 0.385 },
    aufschlag_monat: '2026-08',
    k: 0.27,
    zuschlaege: [[60, -0.20], [70, -0.10], [80, 0], [90, 0.22], [100, 0.45], [110, 0.95]],
    stufen_ltv: { premium: 60, standard: 80, schwach: 90 }
  };
  var STUFEN_LTV = { premium: 60, standard: 80, schwach: 90 };

  /* Altmodell (vor v2245) - nur noch, wenn keine Formel vorliegt. */
  var STATIC_ALT = {
    yields:  { '5': 3.68, '10': 3.93, '15': 4.05, '20': 4.11 },
    margins: { premium: 0.25, standard: 0.40, schwach: 0.80 }
  };

  function _live() {
    try {
      if (typeof window.dpGetPfData === 'function') { var d = window.dpGetPfData(); if (d) return d; }
    } catch (e) {}
    return null;
  }
  function _gueltig(f) {
    return !!(f && f.bund && f.aufschlag && typeof f.k === 'number' && Array.isArray(f.zuschlaege) && f.zuschlaege.length);
  }
  /* Die Formel, mit der gerade gerechnet wird. */
  function _formel() {
    var l = _live();
    if (l && _gueltig(l.formel)) return l.formel;
    try {
      var C = window.DealPilotConfig;
      var b = C && C.marketRates && C.marketRates.bauzins;
      if (_gueltig(b)) return b;
    } catch (e) {}
    return STATIC_FORMEL;
  }

  function zuschlag(ltv, stuetz) {
    var S = stuetz || _formel().zuschlaege || STATIC_FORMEL.zuschlaege;
    var l = Number(ltv);
    if (!isFinite(l)) return 0;
    if (l <= S[0][0]) return S[0][1];
    if (l >= S[S.length - 1][0]) return S[S.length - 1][1];
    for (var i = 1; i < S.length; i++) {
      if (l <= S[i][0]) {
        var a = S[i - 1], b = S[i];
        return Math.round((a[1] + (b[1] - a[1]) * (l - a[0]) / (b[0] - a[0])) * 1000) / 1000;
      }
    }
    return 0;
  }

  function _nearestBinding(tab, binding) {
    var keys = Object.keys(tab || {}).map(function (k) { return parseInt(k, 10); }).filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; });
    if (!keys.length) return null;
    var b = parseInt(binding, 10); if (!isFinite(b) || b <= 0) b = 10;
    if (tab[String(b)] != null) return String(b);
    var best = keys[0], bestD = Math.abs(keys[0] - b);
    for (var i = 1; i < keys.length; i++) { var d = Math.abs(keys[i] - b); if (d < bestD) { bestD = d; best = keys[i]; } }
    return String(best);
  }

  function _r2(x) { return Math.round(x * 100) / 100; }

  /* Rechnet aus einer Formel. Gibt null, wenn ein Baustein fehlt. */
  function rechnen(f, binding, ltv) {
    if (!_gueltig(f)) return null;
    var bKey = _nearestBinding(f.bund, binding == null ? 10 : binding);
    if (bKey == null) return null;
    var bund = f.bund[bKey], a = f.aufschlag[bKey];
    if (typeof bund !== 'number' || typeof a !== 'number' || !isFinite(bund) || !isFinite(a)) return null;
    return _r2(bund + a + f.k + zuschlag(ltv, f.zuschlaege));
  }

  var fn = function (binding, margin, ltv) {
    try {
      var hatLtv = (ltv != null && ltv !== '' && isFinite(Number(ltv)) && Number(ltv) > 0);
      var f = _formel();
      if (hatLtv) {
        var r1 = rechnen(f, binding, Number(ltv));
        if (r1 != null) return r1;
      } else {
        var mKey = (margin && STUFEN_LTV[margin] != null) ? margin : 'standard';
        /* Stufe: zuerst der fertige Wert aus dem Backend (dieselbe Zahl wie die Kachel) */
        var l = _live();
        if (l && l.modell === 'bund+aufschlag' && l.indicativeRates) {
          var bk = _nearestBinding(l.indicativeRates, binding == null ? 10 : binding);
          var ir = bk && l.indicativeRates[bk];
          if (ir && typeof ir[mKey] === 'number') return ir[mKey];
        }
        var sl = (f.stufen_ltv && f.stufen_ltv[mKey]) || STUFEN_LTV[mKey];
        var r2 = rechnen(f, binding, sl);
        if (r2 != null) return r2;
      }
      /* Altmodell als allerletzter Rueckfall */
      var pf = _live() || STATIC_ALT;
      var yields = pf.yields || STATIC_ALT.yields;
      var margins = pf.margins || STATIC_ALT.margins;
      var k2 = _nearestBinding(yields, binding == null ? 10 : binding);
      if (k2 == null) return null;
      var y = yields[k2];
      var mk = (margin && margins[margin] != null) ? margin : 'standard';
      if (typeof y !== 'number' || !isFinite(y)) return null;
      return _r2(y + (margins[mk] != null ? margins[mk] : 0.40));
    } catch (e) { return null; }
  };
  fn._v2245 = true;
  window.dpGetIndicativeZins = fn;
  window.dpBauzinsZuschlag = zuschlag;
  window.dpBauzinsFormel = _formel;
  window.dpBauzinsRechnen = rechnen;

  /* ═══ Hinweis am Zinsfeld der Finanzierung ═══════════════════════════════
     LTV kommt aus State.kpis.ltv (calc.js Z.1580: Darlehen gesamt / LTV-Basis,
     also Verkehrswert, Bankbewertung oder Kaufpreis - dieselbe Zahl, die die
     Kennzahl "LTV" zeigt). Bindung aus #d1_bindj. */
  function _pd(s) {
    if (typeof window.parseDe === 'function') return window.parseDe(s);
    var n = parseFloat(String(s == null ? '' : s).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function _pz(x) { return x.toFixed(2).replace('.', ','); }

  function hinweis() {
    var inp = document.getElementById('d1z');
    if (!inp) return;
    var feld = inp.closest ? inp.closest('.f') : null;
    if (!feld) return;
    var box = document.getElementById('d1z-marktzins');
    if (!box) {
      box = document.createElement('div');
      box.id = 'd1z-marktzins';
      box.className = 'cf-hint dp-marktzins-hint';
      box.style.marginTop = '3px';
      feld.appendChild(box);
      box.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.dp-mz-uebernehmen') : null;
        if (!b) return;
        var q = Number(b.getAttribute('data-zins'));
        if (!isFinite(q) || q <= 0) return;
        inp.value = _pz(q);                       // nur auf ausdruecklichen Klick
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    var K = window.State && window.State.kpis;
    var ltv = K && typeof K.ltv === 'number' && isFinite(K.ltv) ? K.ltv : null;
    if (ltv == null || ltv <= 0) { box.style.display = 'none'; return; }
    var bEl = document.getElementById('d1_bindj');
    var bind = Math.round(_pd(bEl ? bEl.value : 10)) || 10;
    var f = _formel();
    var q = rechnen(f, bind, ltv);
    if (q == null) { box.style.display = 'none'; return; }
    var bk = _nearestBinding(f.bund, bind);
    var ist = _pd(inp.value);
    var gleich = Math.abs(ist - q) < 0.005;
    box.style.display = '';
    box.innerHTML = 'Marktzins für deinen LTV ' + Math.round(ltv) + ' % (Bindung ' + bind + ' J'
      + (String(bind) !== bk ? ', gerechnet mit ' + bk + ' J' : '') + '): <strong>' + _pz(q) + ' %</strong>'
      + (gleich ? ' · entspricht deinem Zins'
        : ' <button type="button" class="btn btn-outline btn-sm dp-mz-uebernehmen" data-zins="' + q
          + '" style="padding:1px 8px;margin-left:6px;font-size:11px">übernehmen</button>');
    box.title = 'Bundesanleihe ' + _pz(f.bund[bk]) + ' % + Marktaufschlag ' + _pz(f.aufschlag[bk])
      + (f.aufschlag_monat ? ' (Stand ' + f.aufschlag_monat + ')' : '') + ' + ' + _pz(f.k)
      + ' + Zuschlag nach Beleihung ' + _pz(zuschlag(ltv, f.zuschlaege));
  }
  window.dpMarktzinsHinweis = function () { try { hinweis(); } catch (e) {} };

  /* Nach jedem Rechenlauf nachziehen - calc() ist die Stelle, an der
     State.kpis.ltv entsteht. Marker der alten Funktion mitnehmen (v1244b). */
  function _anhaengen() {
    if (typeof window.calc !== 'function') return false;
    if (window.calc._dpMzHook) return true;
    var alt = window.calc;
    var neu = function () {
      var r = alt.apply(this, arguments);
      try { hinweis(); } catch (e) {}
      return r;
    };
    try { for (var k in alt) { if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k]; } } catch (e) {}
    neu._dpMzHook = true;
    window.calc = neu;
    return true;
  }
  function _start() {
    if (!_anhaengen()) { var n = 0, t = setInterval(function () { if (_anhaengen() || ++n > 20) clearInterval(t); }, 500); }
    var b = document.getElementById('d1_bindj');
    if (b && !b._dpMz) { b._dpMz = 1; b.addEventListener('input', function () { try { hinweis(); } catch (e) {} }); }
    try { hinweis(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _start);
  else _start();
})();
