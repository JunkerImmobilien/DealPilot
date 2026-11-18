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
  /* v3689a · Marcel 18.11.2026: „Eigentlich brauchen wir dieses Feld ja gar nicht, weil wir können die ja unter
     Investition sonstige Kosten hinzufügen.“ Beim Laden eines Objekts zieht ein Betrag als Anschaffungsnebenkosten
     (art leer/ank) EINMAL nach #ji_e um (Sonstige €, geht dort in die Nebenkosten und die AfA-Basis), das Feld wird
     geleert, ein Hinweis sagt es. „sofort abziehbar“ bleibt hier (gehört nicht in die AK) und nur dann ist der Block
     sichtbar. Nichts geht still verloren. */
  function umziehen() {
    var blk = document.getElementById('kpa_kosten_block');
    var b = betrag(), sofort = wert('kpa_kosten_art') === 'sofort';
    if (blk) blk.style.display = (b > 0 && sofort) ? '' : 'none';
    if (!(b > 0) || sofort) return;
    var je = document.getElementById('ji_e'), kk = document.getElementById('kpa_kosten');
    if (!je || !kk) return;
    var alt = parseFloat(String(je.value || '').replace(/\./g, '').replace(',', '.')) || 0;
    je.value = String(Math.round((alt + b) * 100) / 100).replace('.', ',');
    kk.value = '';
    try { je.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { kk.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { if (typeof window.toast === 'function') window.toast('Kosten der Kaufpreisaufteilung (' + b.toLocaleString('de-DE') + ' €) stehen jetzt unter Investition › Sonstige (€).'); } catch (e) {}
  }
  /* v3691 · ohne Browserfenster (Pruefer im vm-Kontext) kein Ereignis - steuer-audit-pruefen lief sonst rot */
  if (typeof window.addEventListener === 'function') window.addEventListener('dp:object-ready', function () { setTimeout(umziehen, 400); });
  window.DpKpaKosten.umziehen = umziehen;
  window.DpKpaKosten.TEXT_ANK = 'Gutachten zur Kaufpreisaufteilung (vor dem Kauf, für den Kaufvertrag)';
  window.DpKpaKosten.TEXT_SOFORT = 'Kosten der Kaufpreisaufteilung / AfA-Ermittlung (nach dem Kauf, sofort abziehbar)';
})();
