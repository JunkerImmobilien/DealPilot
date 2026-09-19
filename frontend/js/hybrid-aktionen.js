/* ════════════════════════════════════════════════════════════════════
   v1449 · HYBRID WORKSPACE — rechte Aktionsspalte
   ════════════════════════════════════════════════════════════════════
   Backlog v22 Punkt 21, Marcels Wahl „Hybrid" (Demo:
   design/Vorschlaege/light-mode-kanzlei-demo.html). Im hellen Profil
   (Vorlage kanzlei) und ab 1500 px Breite steht rechts eine schmale Spalte
   mit den wichtigsten Aktionen und drei Kennzahlen des geladenen Objekts.
   Die Knoepfe rufen die VORHANDENEN Einstiege auf - keine neue Funktion:
     exportPDFBank / exportPDF / openMarktberichtView /
     exportWerbungskostenPDF / Reiter Deal-Aktion.
   Die Breite setzt body.dp-hybrid-rail; das Layout steht in style.css (v1449).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var MIN_BREITE = 1500;

  function istKanzlei() { return document.documentElement.getAttribute('data-ui-theme') === 'kanzlei'; }
  function reiter(teil) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) { if (tabs[i].textContent.indexOf(teil) >= 0 && typeof window.switchTab === 'function') { window.switchTab(i); return; } }
  }
  var AKTIONEN = [
    ['Bankunterlagen', 'dunkel', function () { reiter('Deal-Aktion'); }],
    ['Investment-PDF · Bank', '', function () { if (window.exportPDFBank) window.exportPDFBank(); }],
    ['Investment-PDF', '', function () { if (window.exportPDF) window.exportPDF(); }],
    ['Marktbericht', '', function () { if (window.openMarktberichtView) window.openMarktberichtView(); }],
    ['Finanzamt-PDF', '', function () { if (window.exportWerbungskostenPDF) window.exportWerbungskostenPDF('0'); }]
  ];

  function spalte() {
    var a = document.getElementById('dp-hybrid-aktionen');
    if (a) return a;
    a = document.createElement('aside');
    a.id = 'dp-hybrid-aktionen';
    a.setAttribute('aria-label', 'Aktionen');
    var h = '<div class="lbl">Aktionen</div>';
    AKTIONEN.forEach(function (x, i) { h += '<button type="button" data-i="' + i + '" class="' + x[1] + '">' + x[0] + '</button>'; });
    h += '<div class="lbl" style="margin-top:14px">Dieses Objekt</div><div id="dp-hy-kpi"></div>';
    a.innerHTML = h;
    a.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) AKTIONEN[+b.dataset.i][2](); });
    document.body.appendChild(a);
    return a;
  }
  function kennzahlen() {
    var host = document.getElementById('dp-hy-kpi'); if (!host) return;
    var K = (window.State && window.State.kpis) || {};
    function z(n, d, s) { return (n == null || !isFinite(n)) ? '—' : Number(n).toFixed(d).replace('.', ',') + (s || ''); }
    host.innerHTML =
      '<div class="kpi"><span>Bruttorendite</span><b>' + z(K.bmy, 2, ' %') + '</b></div>' +
      '<div class="kpi"><span>DSCR</span><b>' + z(K.dscr, 2) + '</b></div>' +
      '<div class="kpi"><span>Cashflow / Monat</span><b>' + (K.cf_m == null || !isFinite(K.cf_m) ? '—' : Math.round(K.cf_m).toLocaleString('de-DE') + ' €') + '</b></div>';
  }
  function anwenden() {
    var an = istKanzlei() && window.innerWidth >= MIN_BREITE;
    document.body.classList.toggle('dp-hybrid-rail', an);
    if (an) { spalte(); kennzahlen(); }
  }
  /* Kennzahlen nach jedem Rechenlauf nachziehen - an calc anhaengen wie
     financing.js (Marker mitnehmen, nie doppelt wickeln). */
  function anhaengen() {
    if (typeof window.calc !== 'function' || window.calc._dpHyHook) return !!(window.calc && window.calc._dpHyHook);
    var alt = window.calc;
    var neu = function () { var r = alt.apply(this, arguments); try { setTimeout(kennzahlen, 350); } catch (e) {} return r; };
    for (var k in alt) { if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k]; }
    neu._dpHyHook = true; window.calc = neu; return true;
  }
  var n = 0;
  function start() { anwenden(); if (!anhaengen() && ++n < 12) setTimeout(start, 400); }
  window.addEventListener('resize', function () { clearTimeout(window._dpHyT); window._dpHyT = setTimeout(anwenden, 150); });
  window.addEventListener('dp:object-ready', function () { setTimeout(kennzahlen, 500); });
  /* Die Vorlage kann nach dem Laden wechseln (Profil-Schalter). */
  try { new MutationObserver(anwenden).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-theme'] }); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
