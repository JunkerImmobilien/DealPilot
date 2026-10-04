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

  /* v1859 · Die fuenfte Stufe und die WORTE — bisher stand hier nur die
     Grenze, und jede Anzeige erfand ihr eigenes Wort („Okay", „Sehr gut").
     CLAUDE.md: TOP >= 85 · GUT >= 70 · SOLIDE >= 50 · SCHWACH >= 35 ·
     KRITISCH < 35; auf der Karte versal, im Fliesstext Kamelschrift. Die
     Farbkette (top/green/gold/red) bleibt bei 85/70/50 — classify() aendert
     sich nicht, Schwach und Kritisch sind beide rot. */
  var SCHWACH = 35;
  function stufe(score) {
    var s = (typeof score === 'number' && isFinite(score)) ? score : parseFloat(score);
    if (!isFinite(s)) return { wort: '–', versal: '–', farbe: 'na' };
    if (s >= TOP)     return { wort: 'Top',      versal: 'TOP',      farbe: 'top' };
    if (s >= GREEN)   return { wort: 'Gut',      versal: 'GUT',      farbe: 'green' };
    if (s >= GOLD)    return { wort: 'Solide',   versal: 'SOLIDE',   farbe: 'gold' };
    if (s >= SCHWACH) return { wort: 'Schwach',  versal: 'SCHWACH',  farbe: 'red' };
    return                   { wort: 'Kritisch', versal: 'KRITISCH', farbe: 'red' };
  }
  window.ScoreTier = {
    classify: classify,
    stufe: stufe,
    TOP: TOP,
    GREEN: GREEN,
    GOLD: GOLD,
    SCHWACH: SCHWACH
  };
})();
