/* ═══════════════════════════════════════════════════════════════════════
   dealcheck-laden.js · landing-seo-3 (15.11.2026)
   EIN Lader für den Deal-Check, auf der Startseite und auf den Rechner-
   Seiten (immobilien-rendite-berechnen, cashflow-immobilie-berechnen,
   kaufpreisfaktor-berechnen). Vorher stand er als Inline-Skript in
   index.html, die Rechner-Seiten hatten mit rechner-kern.js/rechner.js
   einen eigenen Rechner (landing-seo-2). Marcel 15.11.2026: „Wir haben doch
   schon einen Deal-Check-Rechner auf der Landingpage.“ Jetzt eine Komponente.

   Lädt die ECHTEN Kerne der App (DealKpis, Dscr, DealScore, ScoreTier) und
   danach dp2-dealcheck.js. BUSTER: dieselben wie frontend/index.html, diese
   Datei steht in tools/buster-ebenen-pruefen.mjs (DOKUMENTE).

   App-Domain: staging.dealpilot.immo -> app.staging.dealpilot.immo, sonst
   app.dealpilot.immo.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var h = location.hostname, app = /(^|\.)staging\.dealpilot\.immo$/.test(h) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/';
  ['js/dscr-engine.js?v=v3031b', 'js/deal-kpis.js?v=v3215', 'js/score-tiers.js?v=v3254', 'js/dealscore.js?v=v3289', 'dp2-dealcheck.js?v=landing-dealcheck-13c']
    .forEach(function (s) { var e = document.createElement('script'); e.src = (s.indexOf('js/') === 0 ? app : '') + s; e.async = false; document.body.appendChild(e); });
})();
