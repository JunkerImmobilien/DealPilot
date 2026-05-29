/**
 * V168 — KI-LTV-Verify-Tool
 * ═══════════════════════════════════════════════════════════════════
 *
 * Browser-Konsole:
 *   DealPilotKIVerify.checkLTV()      — Aktuelle Werte + Erwartung
 *   DealPilotKIVerify.runWithObject() — KI mit aktuellem Objekt rufen
 *                                       und prüfen ob VW-LTV erwähnt wird
 *
 * Hintergrund:
 *   V158 hat den Backend-KI-Prompt erweitert. Wenn Verkehrswert > 0,
 *   wird zusätzlich "LTV auf Verkehrswert" berechnet und der KI als
 *   [BANK-RELEVANT] markiert. Dieses Tool verifiziert dass der Fix
 *   im Live-Backend ankommt.
 */
(function () {
  'use strict';

  function _v(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(String(el.value || '0').replace(',', '.')) || 0;
  }

  function checkLTV() {
    console.log('═══ KI-LTV-Verify (V168) — Aktuelles Objekt ═══');
    var kp = _v('kp');
    var svwert = _v('svwert');
    var d1 = _v('d1');
    var d2 = _v('d2') || 0;
    var ek = _v('ek');
    var nk_proz = _v('nk_proz') || 1.5;
    var grerw_proz = _v('grerw_proz') || 6.5;
    var makler_proz = _v('makler_proz') || 3.57;
    var san = _v('san') || 0;
    var nk_total = kp * (nk_proz + grerw_proz + makler_proz) / 100;
    var gi = kp + nk_total + san;
    var d_total = d1 + d2;

    console.log('Eingaben:');
    console.log('  Kaufpreis (kp):              ' + kp.toLocaleString('de-DE') + ' €');
    console.log('  Verkehrswert (svwert):       ' + svwert.toLocaleString('de-DE') + ' €');
    console.log('  Darlehen total (d1+d2):      ' + d_total.toLocaleString('de-DE') + ' €');
    console.log('  Eigenkapital (ek):           ' + ek.toLocaleString('de-DE') + ' €');
    console.log('  Gesamtinvestition (kp+NK):   ' + gi.toLocaleString('de-DE') + ' €');
    console.log('');

    if (kp <= 0 || d_total <= 0) {
      console.warn('  ⚠ Bitte erst ein Objekt mit Kaufpreis und Darlehen laden');
      return;
    }

    var ltvKp = (d_total / kp) * 100;
    var ltvGi = (d_total / gi) * 100;
    var ltvVw = svwert > 0 ? (d_total / svwert) * 100 : null;

    console.log('LTV-Berechnungen:');
    console.log('  LTV auf Kaufpreis:         ' + ltvKp.toFixed(1) + ' %');
    console.log('  LTV auf Gesamtinvestition: ' + ltvGi.toFixed(1) + ' %');
    if (ltvVw !== null) {
      console.log('  LTV auf Verkehrswert:      ' + ltvVw.toFixed(1) + ' %  ★ BANK-RELEVANT');
    } else {
      console.warn('  ⚠ Verkehrswert nicht gesetzt — KI wird nur LTV auf KP/GI bekommen');
    }
    console.log('');

    if (ltvVw !== null && Math.abs(ltvKp - ltvVw) > 10) {
      console.warn('  🚨 GROSSE DIFFERENZ zwischen KP-LTV und VW-LTV (' +
        Math.abs(ltvKp - ltvVw).toFixed(0) + ' Prozentpunkte)');
      console.log('     → Backend-V158-Fix muss VW-LTV als BANK-RELEVANT senden');
      console.log('     → KI soll dann VW-LTV für Bewertung nutzen, nicht KP-LTV');
    }

    console.log('');
    console.log('Test: DealPilotKIVerify.runWithObject()');
    console.log('  → ruft KI-Analyse und prüft Response-Text auf VW-LTV-Erwähnung');
  }

  function runWithObject() {
    console.log('═══ KI-LTV-Verify — KI-Aufruf ═══');
    console.log('Starte KI-Analyse-Tab und schaue Output an...');
    // Schau ob KI-Analyse-Tab existiert und aktiv
    var aiTab = document.querySelector('[onclick*="switchTab(5)"], [onclick*="ai"]') ||
                Array.from(document.querySelectorAll('.tab')).find(function(t){return t.textContent.includes('KI');});
    if (aiTab) {
      console.log('  → Bitte klicke jetzt auf den Tab "KI-Analyse" und führe "Analyse starten" aus.');
      console.log('  → Im Output sollte der LTV-Wert auf VW erwähnt sein (nicht 95%+)');
    } else {
      console.warn('  KI-Analyse-Tab nicht gefunden');
    }

    var lastAiResponse = window._lastAiAnalysisResponse;
    if (lastAiResponse) {
      console.log('');
      console.log('Letzte KI-Antwort enthält:');
      var verkehrswertMentions = (lastAiResponse.match(/verkehrswert/gi) || []).length;
      var bankRelevantMentions = (lastAiResponse.match(/bank-relevant/gi) || []).length;
      console.log('  Verkehrswert erwähnt: ' + verkehrswertMentions + 'x');
      console.log('  "BANK-RELEVANT" erwähnt: ' + bankRelevantMentions + 'x');
      if (verkehrswertMentions === 0) {
        console.warn('  ⚠ KI-Antwort erwähnt Verkehrswert nicht — V158-Backend-Fix evtl. nicht aktiv');
      }
    }
  }

  window.DealPilotKIVerify = { checkLTV: checkLTV, runWithObject: runWithObject };
  console.log('[ki-verify V168] geladen — DealPilotKIVerify.checkLTV() / .runWithObject()');
})();
