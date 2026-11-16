/* kpa-kosten.js · v3511 · Kosten der Kaufpreisaufteilung - EINE Stelle fuer Betrag und Einordnung.
 *
 * Marcel 16.11.2026: „Die 549 € müssen in die Anschaffungskosten, weil das mit dem Kauf verbundene
 * Kosten sind. Das Haus ist ja noch nicht gekauft und die KPA kommt ja in den Kaufvertrag."
 *
 * Felder am Objekt (Reiter Steuern, beim Gebaeudeanteil): #kpa_kosten (Betrag) und #kpa_kosten_art
 *   ank    (Vorgabe, auch leer) Anschaffungsnebenkosten: anteilig Boden/Gebaeude, nur der Gebaeudeanteil
 *          in die AfA-Bemessungsgrundlage - wie Grunderwerbsteuer, Notar, Grundbuch
 *   sofort gesondert, sofort abziehbar (nach dem Kauf nur zur AfA-Ermittlung beauftragt): Werbungskosten
 *          im Kaufjahr (tax.js verw_sonst), nicht in den Anschaffungskosten
 * Leser: calc.js (AfA-Basis), bmf-modal.js (runBmf, Summe Anschaffungskosten), bmf-bodenabschlag.js,
 * bmf-modal-v292.js (Pipeline, investition.kpa_kosten_e), tax.js (Kaufjahr), beide Kaufpreisaufteilungs-PDFs. */
(function () {
  'use strict';
  function wert(id) { var e = document.getElementById(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function betrag() {
    var s = wert('kpa_kosten').replace(/[^\d,.\-]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s); return isFinite(n) && n > 0 ? n : 0;
  }
  window.DpKpaKosten = function () {
    var b = betrag(), sofort = wert('kpa_kosten_art') === 'sofort';
    return { betrag: b, art: sofort ? 'sofort' : 'ank', ank: sofort ? 0 : b, sofort: sofort ? b : 0 };
  };
  window.DpKpaKosten.TEXT_ANK = 'Gutachten zur Kaufpreisaufteilung (vor dem Kauf, für den Kaufvertrag)';
  window.DpKpaKosten.TEXT_SOFORT = 'Kosten der Kaufpreisaufteilung / AfA-Ermittlung (nach dem Kauf, sofort abziehbar)';
})();
