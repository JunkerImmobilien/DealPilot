/* ═══════════════════════════════════════════════════════════════════════
   dp2-module.js · landing-module-2 · Die 19 Module in vier Phasen
   Daten: window.DP_MODULE (dp2-daten.js, Reihenfolge 1–19 unverändert).
   Hier nur: Gruppierung, Icons, Reiter, gestaffelter Einlauf, Autoplay.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var host = document.getElementById('modShow');
  if (!host || !window.DP_MODULE) return;
  var M = window.DP_MODULE;

  /* Linien-Icons, 24er Raster, Strich 1,6 – je Modul (Index 0–18 wie DP_MODULE) */
  var I = [
    '<path d="M3 13h18"/><path d="M5 13l2-6h10l2 6"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/><path d="M12 3v4"/>',        // 1 Boarding
    '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/><path d="M3 9l2 2 3-3"/>',                                 // 2 Exposé & Dokumente
    '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/><circle cx="18" cy="5" r="2"/>',                            // 3 Objekt & Lage
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2"/><path d="M3 12h18"/><path d="M12 11v3"/>',                        // 4 Investition
    '<path d="M4 20V10M10 20V6M16 20v-8M22 20H2"/><path d="M4 10l6-4 6 6 5-5"/>',                                                            // 5 Miete & Markt
    '<path d="M6 3h9l4 4v14H6z"/><path d="M9 9h6M9 13h6M9 17h3"/><path d="M15 3v4h4"/>',                                                     // 6 Werbungskosten
    '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/>',                                             // 7 Finanzierung
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',  // 8 Bewirtschaftung
    '<path d="M12 3l2.4 4.8L20 9l-4 3.9.9 5.6L12 16l-4.9 2.5.9-5.6L4 9l5.6-1.2z"/>',                                                          // 9 Co-Pilot (KI)
    '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/><circle cx="12" cy="18" r="1.4"/><path d="M6.5 13.5l-1-1M17.5 13.5l1-1M12 9V8"/>', // 10 Deal Score
    '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-7h6v7"/><path d="M8 10h8"/>',                                                              // 11 Bankexport
    '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', // 12 Portfolio
    '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',                 // 13 Auto-Save & Cloud
    '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/><path d="M9.5 16l5-5"/>',                                       // 14 Steuer & AfA
    '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/><circle cx="19" cy="6" r="1.4"/>',                                                    // 15 Marktdaten
    '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a5 5 0 0 1 10 0"/><path d="M13.5 20a4 4 0 0 1 7.5-2"/>',      // 16 Partnernetzwerk
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M8.5 21h7"/>',                         // 17 Spracheingabe
    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',             // 18 ImmoMetrica-Anbindung
    '<path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z"/><path d="M8.5 12l2.3 2.3 4.7-4.6"/>'                                       // 19 Marktbewertung (AVM)
  ];
  var PHASEN = [
    { t: 'Erfassen', k: 'Objekt in Minuten aufnehmen – tippen, sprechen oder Unterlagen einlesen.', m: [0, 1, 16, 17, 2] },
    { t: 'Bewerten', k: 'Was ist das Objekt wert – und passt es zu dir?', m: [14, 18, 9, 8, 4] },
    { t: 'Rechnen', k: 'Investition, Finanzierung, Bewirtschaftung und Steuer – bis aufs Jahr.', m: [3, 6, 7, 13, 5] },
    { t: 'Halten & Teilen', k: 'Für die Bank, fürs Portfolio, für dein Team.', m: [10, 11, 15, 12] }
  ];
  var TAKT = 7000, aktiv = 0, uhr = null, pause = false;
  var leise = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  host.innerHTML = '<div class="mods-tabs" role="tablist">' + PHASEN.map(function (p, i) {
      return '<button type="button" class="mods-tab" role="tab" data-p="' + i + '"><span class="n">0' + (i + 1) + '</span>' + p.t
        + ' <span class="z">' + p.m.length + '</span><span class="lauf"><i></i></span></button>';
    }).join('') + '</div><p class="mods-kopf" aria-live="polite"></p><div class="mods-grid"></div>';
  var tabs = [].slice.call(host.querySelectorAll('.mods-tab'));
  var kopf = host.querySelector('.mods-kopf'), grid = host.querySelector('.mods-grid');
  host.style.setProperty('--mods-takt', (TAKT / 1000) + 's');

  function karte(idx) {
    var m = M[idx];
    return '<article class="mod"><div class="mod-kopf"><div class="mod-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + (I[idx] || '') + '</svg></div>'
      + '<span class="mod-nr">MODUL ' + String(idx + 1).padStart(2, '0') + '</span></div>'
      + '<h3>' + m.t + '</h3><p class="sb">' + m.s + '</p>'
      + '<ul>' + m.b.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul></article>';
  }
  function zeige(i, vonHand) {
    aktiv = (i + PHASEN.length) % PHASEN.length;
    tabs.forEach(function (t, n) { t.classList.toggle('on', n === aktiv); t.setAttribute('aria-selected', n === aktiv ? 'true' : 'false'); t.classList.remove('laeuft'); });
    kopf.textContent = PHASEN[aktiv].k;
    grid.innerHTML = PHASEN[aktiv].m.map(karte).join('');
    var k = [].slice.call(grid.children);
    if (leise) k.forEach(function (x) { x.classList.add('da'); });
    else k.forEach(function (x, n) { setTimeout(function () { x.classList.add('da'); }, 60 + n * 90); });
    if (vonHand) { pause = true; halt(); }
    else lauf();
  }
  function lauf() {
    halt();
    if (leise || pause || document.hidden) return;
    void tabs[aktiv].offsetWidth; tabs[aktiv].classList.add('laeuft');
    uhr = setTimeout(function () { zeige(aktiv + 1); }, TAKT);
  }
  function halt() { if (uhr) { clearTimeout(uhr); uhr = null; } tabs.forEach(function (t) { t.classList.remove('laeuft'); }); }
  tabs.forEach(function (t, n) { t.addEventListener('click', function () { zeige(n, true); }); });
  host.addEventListener('mouseenter', function () { halt(); });
  host.addEventListener('mouseleave', function () { if (!pause) lauf(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else if (!pause) lauf(); });
  /* erst laufen, wenn die Sektion zu sehen ist */
  var gestartet = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !gestartet) { gestartet = true; zeige(0); } }); }, { threshold: 0.25 }).observe(host);
  } else zeige(0);
})();
