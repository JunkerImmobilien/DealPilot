/* ════════════════════════════════════════════════════════════════════
   DealPilot score-tiers.js  (v463)
   SINGLE SOURCE OF TRUTH fuer die Score-Tier-Grenzen.
   Alle Score-Anzeigen (DealPilot Score, Investor Deal Score, Quick-Check,
   Portfolio-Dashboard) klassifizieren ueber window.ScoreTier.classify(score).

   ZENTRAL SIND GRENZE UND WORT. Wer eines von beiden aendern will,
   aendert NUR hier.

   Kanonisches Schema (fuenf Stufen, Worte seit v1863):
     >= 85  'top'    Sehr gut
     >= 70  'green'  Gut
     >= 50  'gold'   Solide
     >= 35  'red'    Schwach
     <  35  'red'    Kritisch

   Die FARBkette hat vier Baender (classify, Schnitt bei 85/70/50), die
   WORTkette fuenf (stufe, zusaetzlich 35). Schwach und Kritisch sind
   beide rot - das ist Absicht, kein Fehler.

   ──────────────────────────────────────────────────────────────────
   v1950 · HIER STAND DAS GEGENTEIL
      Bis zum 07.10.2026 sagte dieser Kopf:

        "Label + Farbe bleiben pro Anzeige lokal (gleiche Werte, andere
         Worte) - ZENTRAL ist nur die GRENZE."

      und beschrieb vier Baender, die bei 50 enden. Beides war seit v1859
      falsch: `stufe()` zehn Zeilen weiter unten fuehrt fuenf Stufen MIT
      den Worten, und CLAUDE.md sagt ausdruecklich "Die Kette steht an
      EINER Stelle".

      > Der Kopf hat die Doppelung nicht nur verschwiegen, er hat sie
      > ERLAUBT. Wer ihn las, durfte guten Gewissens ein eigenes Wort
      > erfinden - und genau das ist viermal passiert ("Okay" in
      > storage.js, "Top" im Marktbericht, "Sehr attraktiv" im
      > mb-Backend, "Durchschnittlich" in dealscore.js).

      **Ein Kommentar, der eine alte Doktrin konserviert, ist teurer als
      gar keiner**: er laesst die Abweichung wie eine Absicht aussehen,
      und beim Gegenlesen haelt man sie fuer geprueft.

      (Dieser Absatz stand zuerst als eigener Kommentarblock hier drin und
      hat den Dateikopf zerlegt: JS kennt keine verschachtelten Kommentare,
      das innere Ende schliesst das aeussere. Dieselbe Falle wie v1933a in
      der CSS-Datei. Gefangen von node --check, nicht von der
      Klammerbilanz - die stimmte. Und beim Aufschreiben GLEICH NOCH EINMAL,
      weil der Erklaertext die beiden Zeichen selbst enthielt. Deshalb
      stehen sie hier nirgends ausgeschrieben.)
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
    /* v1863 · Marcel: „mit gut, sehr gut und dann halt die anderen" — die
       oberste Stufe heisst „Sehr gut", nicht „Top". Schwellen unveraendert. */
    if (s >= TOP)     return { wort: 'Sehr gut', versal: 'SEHR GUT', farbe: 'top' };
    if (s >= GREEN)   return { wort: 'Gut',      versal: 'GUT',      farbe: 'green' };
    if (s >= GOLD)    return { wort: 'Solide',   versal: 'SOLIDE',   farbe: 'gold' };
    if (s >= SCHWACH) return { wort: 'Schwach',  versal: 'SCHWACH',  farbe: 'red' };
    return                   { wort: 'Kritisch', versal: 'KRITISCH', farbe: 'red' };
  }
  /* v1950: zusaetzlich als CommonJS, damit ein Pruefer die ECHTE Kette
     laden kann statt sie nachzubauen.
     v1955 - HIER STAND "Zur Laufzeit nutzt das niemand". Das stimmt nicht:
     `tools/rechenkerne-spiegeln.mjs` spiegelt diese Datei woertlich nach
     `backend/src/generated/rechenkerne/score-tiers.js`, und der
     Telegram-Dienst liest sie seitdem ueber `services/rechenkerne.js`.
     **Wer diese Datei aendert, muss die Spiegelung neu laufen lassen.** */
  /* v3070 · HARTE GRENZE NACH DSCR — EINE STELLE FÜR BEIDE SCORE-KERNE.
     Recherche 02.11.2026 (design/Vorschläge/score-benchmark-p1.md, Abschnitt 5):
     eine Mindest-DSCR steht in keiner Norm (§ 48u KWG kennt nur LTV und Tilgung);
     Branchenpraxis der Banken liegt bei 1,1–1,35, unter 1,0 trägt sich das Objekt
     nicht selbst. Staffel (ersetzt die pauschale Grenze 49 aus v3069):
       DSCR ≥ 1,2 oder Barkauf        → kein Deckel
       1,0 bis unter 1,2              → höchstens 84 (Gut)
       0,8 bis unter 1,0              → höchstens 69 (Solide)
       unter 0,8                      → höchstens 49 (Schwach)
       unter 0,8 und Darlehen > Marktwert → höchstens 34 (Kritisch)
     dscr: Zahl oder null (Barkauf); ueberMarktwert: true/false/null (unbekannt). */
  function dscrDeckel(dscr, ueberMarktwert) {
    if (dscr == null || !isFinite(dscr) || !(dscr > 0) || dscr >= 1.2) return null;
    var d = dscr.toFixed(2).replace('.', ',');
    if (dscr >= 1.0) return { max: 84, grund: 'DSCR ' + d + ' unter 1,2 — wenig Puffer für Zinsanstieg und Leerstand' };
    if (dscr >= 0.8) return { max: 69, grund: 'DSCR ' + d + ' unter 1,0 — die Miete trägt den Kapitaldienst nicht ganz' };
    if (ueberMarktwert === true) return { max: SCHWACH - 1, grund: 'DSCR ' + d + ' unter 0,8 und Darlehen über dem Marktwert' };
    return { max: GOLD - 1, grund: 'DSCR ' + d + ' unter 0,8 — die Miete deckt den Kapitaldienst deutlich nicht' };
  }
  var API = {
    classify: classify,
    stufe: stufe,
    dscrDeckel: dscrDeckel,   /* v3070 */
    TOP: TOP,
    GREEN: GREEN,
    GOLD: GOLD,
    SCHWACH: SCHWACH
  };
  if (typeof window !== 'undefined') window.ScoreTier = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
