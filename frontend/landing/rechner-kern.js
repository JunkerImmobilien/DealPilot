/* ═══════════════════════════════════════════════════════════════════════
   rechner-kern.js · landing-seo-2 (15.11.2026)
   Lädt für die Rechner-Seiten (immobilien-rendite-berechnen.html,
   cashflow-immobilie-berechnen.html, kaufpreisfaktor-berechnen.html) die
   ECHTEN Rechenkerne der App, danach rechner.js.

   Nichts wird hier oder in rechner.js nachgerechnet: Renditen, Faktor,
   Cashflow, Steuer und DSCR kommen aus DealKpis.compute() (deal-kpis.js,
   mit Dscr.compute() aus dscr-engine.js), der Gebäudeanteil für die AfA
   aus DealKpis.gebaeudeAhk().

   BUSTER: dieselben wie frontend/index.html und landing/index.html. Diese
   Datei steht deshalb in tools/buster-ebenen-pruefen.mjs (DOKUMENTE) - wer
   deal-kpis.js oder dscr-engine.js ändert, sieht hier ROT, bis der Buster
   gleichzieht.

   App-Domain wie in landing/index.html: staging.dealpilot.immo ->
   app.staging.dealpilot.immo, sonst app.dealpilot.immo.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var h = location.hostname;
  var app = /(^|\.)staging\.dealpilot\.immo$/.test(h) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/';
  ['js/dscr-engine.js?v=v3031b', 'js/deal-kpis.js?v=v3215', 'rechner.js?v=landing-seo-2']
    .forEach(function (s) {
      var e = document.createElement('script');
      e.src = (s.indexOf('js/') === 0 ? app : '') + s;
      e.async = false;
      document.body.appendChild(e);
    });
})();
