/* bmf-pipeline-ergaenzung.js · v3511
 *
 * Ergaenzt die Anfrage an /bmf/pipeline (Reiter 3/4, Varianten, Vertragstext) um Felder, die
 * bmf-modal-v292.js nicht sammelt. Die Datei bmf-modal-v292.js steht unter „Nicht anfassen"
 * (Marcel 16.11.2026 zu einer Aenderung dort: „nein, dann lass es raus"), deshalb diese Huelle.
 *
 *  - garagen, einheiten (KPA G13/G42): v3345 hatte sie nur in runBmf (/bmf/aufteilung). Gemessen
 *    16.11.2026, Andersenweg 3 (MFH, 6 WE, 6 Garagen), Vorlage Maerz 2026: ohne beide 61,25 %,
 *    mit beiden 58,45 % - zwei Aufteilungen im selben Fenster.
 *  - kpa_kosten_e: Kosten der Kaufpreisaufteilung, wenn sie Anschaffungsnebenkosten sind
 *    (#kpa_kosten_art leer oder „ank", Vorgabe seit v3511). Bei „sofort" 0.
 *
 * Muss NACH bmf-modal-v292.js geladen werden. Die Huelle reicht alle Argumente weiter und
 * aendert nur, was sie selbst hinzufuegt.
 */
(function () {
  'use strict';
  var orig = window._v292CollectInputs;
  if (typeof orig !== 'function' || orig._dpErgaenzt) return;
  function wert(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  function ganz(id) { var n = parseInt(wert(id), 10); return n > 0 ? n : 0; }
  function betrag(id) {
    var s = wert(id).replace(/[^\d,.\-]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) && n > 0 ? n : 0;
  }
  var huelle = function () {
    var r = orig.apply(this, arguments);
    try {
      var p = r && r.phase1_inputs;
      if (p && p.objekt) { p.objekt.garagen = ganz('garagen'); p.objekt.einheiten = ganz('einheiten'); }
      if (p && p.investition) p.investition.kpa_kosten_e = window.DpKpaKosten ? DpKpaKosten().ank : ((wert('kpa_kosten_art') === 'sofort') ? 0 : betrag('kpa_kosten'));
    } catch (e) {}
    return r;
  };
  huelle._dpErgaenzt = true;
  window._v292CollectInputs = huelle;
})();
