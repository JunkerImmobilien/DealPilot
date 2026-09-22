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

   v1455 (Marcel 20.09.2026): unten in der Spalte stehen der Investor Deal
   Score und die Kennzahlen, die bisher oben im Kopf standen — im hellen
   Profil laesst der Kopf sie dafuer dauerhaft weg (style.css v1455).
   Die Zahlen werden NICHT neu gerechnet: Score und Vollstaendigkeit werden
   aus den Kopf-Bausteinen gelesen (sie bleiben im DOM, nur unsichtbar),
   die Renditen kommen wie bisher aus State.kpis.
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
    h += '<div class="dp-hy-fuss"><div id="dp-hy-score"></div>'
      + '<div class="lbl">Dieses Objekt</div><div id="dp-hy-kpi"></div></div>';
    a.innerHTML = h;
    a.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) AKTIONEN[+b.dataset.i][2](); });
    document.body.appendChild(a);
    return a;
  }
  /* Score aus dem Kopf uebernehmen (dort ausgeblendet, aber im DOM).
     Die Stufen-Schwellen stehen in js/dashboard.js:390 - hier wird nur
     eingefaerbt, nicht neu bewertet. */
  function farbe(n) { return n >= 85 ? '#2E8455' : n >= 70 ? '#3FA56C' : n >= 50 ? 'var(--wl-c9a84c, #C9A84C)' : n >= 35 ? '#C2703F' : '#B8625C'; }
  /* v1455c · gemessen: der Kopf LAESST den alten Score im DOM stehen und
     blendet ihn per Inline-Stil aus (display:none), dazu body.hdr-no-score.
     Ohne diese Pruefung zeigte die Spalte den Score des VORIGEN Objekts.
     Dieselbe Mechanik bei der Vollstaendigkeit. */
  function gilt(e) { return !!e && e.style.display !== 'none'; }
  function score() {
    var host = document.getElementById('dp-hy-score'); if (!host) return;
    var mini = document.getElementById('hdr-score-mini');
    if (document.body.classList.contains('hdr-no-score') || !gilt(mini)) { host.innerHTML = ''; host.style.display = 'none'; return; }
    var b = mini && mini.querySelector('b'), st = mini && mini.querySelector('span');
    var n = b ? parseInt(String(b.textContent).replace(/[^0-9]/g, ''), 10) : NaN;
    if (!isFinite(n)) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML = '<div class="lbl">Investor Deal Score</div>'
      + '<div class="dp-hy-score-z"><b style="color:' + farbe(n) + '">' + n + '</b><span>/ 100</span>'
      + '<em style="background:' + farbe(n) + '">' + ((st && st.textContent.trim()) || '') + '</em></div>'
      + '<div class="dp-hy-bar"><i style="width:' + Math.max(2, Math.min(100, n)) + '%;background:' + farbe(n) + '"></i></div>'
      + bereiche();
  }

  /* v1516 · Marcel 22.09.2026: "dass wir dort halt auch noch den Deal-Score
     hinpacken ... also quasi das, was wir oben haben, mit den Parametern
     Rendite, Finanzierung, Risiko, Lage und Upside."
     Die Zahlen kommen aus DealScore2.compute() - demselben Kern, der auch
     den Kopf speist. Kein zweiter Rechenweg, kein Abschreiben aus dem DOM:
     nur die Gesamtzahl wird weiter aus dem Kopf uebernommen, weil sie dort
     schon steht (und die Spalte sonst einen anderen Stand zeigen koennte als
     der Kopf zwei Zentimeter daneben). */
  var BEREICHE = [
    ['rendite', 'Rendite'],
    ['finanzierung', 'Finanzierung'],
    ['risiko', 'Risiko'],
    ['lage', 'Lage'],
    ['upside', 'Upside'],
  ];
  function bereiche() {
    var erg = null;
    try {
      if (window.DealScore2 && typeof window.DealScore2.compute === 'function'
          && typeof window._buildDeal2FromState === 'function') {
        erg = window.DealScore2.compute(window._buildDeal2FromState());
      }
    } catch (e) { return ''; }
    if (!erg || !erg.categories) return '';
    var zeilen = BEREICHE.map(function (b) {
      var c = erg.categories[b[0]];
      if (!c || c.score == null || !isFinite(c.score)) return '';
      var w = Math.max(2, Math.min(100, Math.round(c.score)));
      /* Wie viele Kennzahlen dahinterstehen, gehoert dazu: ein Bereich aus
         einer einzigen Angabe ist etwas anderes als einer aus sechs. */
      var tief = (c.availableKpis != null && c.totalKpis)
        ? '<em>' + c.availableKpis + '/' + c.totalKpis + '</em>' : '';
      return '<div class="dp-hy-br">'
        + '<span>' + b[1] + tief + '</span>'
        + '<div class="dp-hy-brbar"><i style="width:' + w + '%;background:' + farbe(c.score) + '"></i></div>'
        + '<b>' + Math.round(c.score) + '</b>'
        + '</div>';
    }).join('');
    if (!zeilen) return '';
    return '<div class="dp-hy-bereiche">' + zeilen + '</div>';
  }
  function ausKopf(sel, wirt) { var e = document.querySelector(sel); if (!e) return null; if (wirt && !gilt(document.querySelector(wirt))) return null; var t = e.textContent.trim().replace(/\s+/g, ' '); return t || null; }
  function kennzahlen() {
    score();
    var host = document.getElementById('dp-hy-kpi'); if (!host) return;
    var K = (window.State && window.State.kpis) || {};
    function z(n, d, s) { return (n == null || !isFinite(n)) ? '—' : Number(n).toFixed(d).replace('.', ',') + (s || ''); }
    var voll = ausKopf('.hdr-comp-text', '#hdr-completeness'), pflicht = ausKopf('#tabs-status-text');
    host.innerHTML =
      (voll ? '<div class="kpi"><span>Vollständigkeit</span><b>' + voll.replace(' Felder', '') + '</b></div>' : '') +
      (pflicht ? '<div class="kpi"><span>Pflichtfelder</span><b>' + pflicht + '</b></div>' : '') +
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
  window.addEventListener('dp:object-ready', function () { setTimeout(kennzahlen, 500); setTimeout(kennzahlen, 1600); });
  /* Der Score wird vom Kopf gesetzt, nicht von calc - deshalb dort lauschen. */
  try {
    new MutationObserver(function () { if (document.body.classList.contains('dp-hybrid-rail')) kennzahlen(); })
      .observe(document.querySelector('header.hdr') || document.body, { subtree: true, childList: true, characterData: true });
  } catch (e) {}
  /* Die Vorlage kann nach dem Laden wechseln (Profil-Schalter). */
  try { new MutationObserver(anwenden).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-theme'] }); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
