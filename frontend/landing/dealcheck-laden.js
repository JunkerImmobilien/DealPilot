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
/* landing-faecher-1 (20.11.2026) · zwei Kerne mehr, Buster wie frontend/index.html:
     js/indicative-zins.js   Zins je Zinsbindung, wenn der Tagesabruf /market-rates/bauzins nicht antwortet
                             (dpGetIndicativeZins: Marktformel mit dem gespeicherten Stand, wie die App)
     js/dealscore2.js        Investor Deal Score für die Startbahn „Fächer“ (nur, wo es #einlesen gibt) */
(function () {
  var h = location.hostname, app = /(^|\.)staging\.dealpilot\.immo$/.test(h) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/';
  var liste = ['js/dscr-engine.js?v=v4440', 'js/deal-kpis.js?v=v3215', 'js/score-tiers.js?v=v3254', 'js/dealscore.js?v=v3289', 'js/qc-score-weg.js?v=v4720', 'js/indicative-zins.js?v=v3256'];
  /* v4760 · Investor Deal Score rechnet mit EK-Rendite Stufe 2 (DpEkRendite), deshalb ek-rendite.js vorher */
  if (document.getElementById('einlesen')) { liste.push('js/ek-rendite.js?v=v4620a'); liste.push('js/dealscore2.js?v=v4760'); }
  liste.push('dp2-dealcheck.js?v=einzelcheck-5');   /* landing-faecher-2 · zwei Wege, Miete kurz, Pakete */
  liste.forEach(function (s) { var e = document.createElement('script'); e.src = (s.indexOf('js/') === 0 ? app : '') + s; e.async = false; document.body.appendChild(e); });
})();
