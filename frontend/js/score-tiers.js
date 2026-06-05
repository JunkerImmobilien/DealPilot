/* ════════════════════════════════════════════════════════════════════
   DealPilot score-tiers.js  (v463)
   SINGLE SOURCE OF TRUTH fuer die Score-Tier-Grenzen.
   Alle Score-Anzeigen (DealPilot Score, Investor Deal Score, Quick-Check,
   Portfolio-Dashboard) klassifizieren ueber window.ScoreTier.classify(score).

   Kanonisches Schema:
     >= 85  'top'    (Top Deal / Sehr gut)
     >= 70  'green'  (Gut)
     >= 50  'gold'   (Solide / Okay)
     <  50  'red'    (Schwach)

   Label + Farbe bleiben pro Anzeige lokal (gleiche Werte, andere Worte) —
   ZENTRAL ist nur die GRENZE. Wer die Grenzen aendern will, aendert NUR hier.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TOP = 85, GREEN = 70, GOLD = 50;

  function classify(score) {
    var s = (typeof score === 'number' && isFinite(score)) ? score : parseFloat(score);
    if (!isFinite(s)) return 'na';
    if (s >= TOP)   return 'top';
    if (s >= GREEN) return 'green';
    if (s >= GOLD)  return 'gold';
    return 'red';
  }

  window.ScoreTier = {
    classify: classify,
    TOP: TOP,
    GREEN: GREEN,
    GOLD: GOLD
  };
})();
