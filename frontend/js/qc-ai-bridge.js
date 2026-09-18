'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v1374 (B21) · DIE KI-ANFRAGE DES QUICK-CHECKS GEHT ÜBER DEN SERVER

   Der Quick-Check läuft in einem iframe und hat keine Auth-Anbindung —
   `Auth.apiCall` kommt dort null mal vor. Er rief deshalb bisher
   `api.openai.com` DIREKT auf, mit einem Schlüssel, den der Nutzer in ein
   Feld tippt.

   Drei Dinge waren daran falsch: der Prompt stand im Klartext im
   ausgelieferten HTML, der Weg lief am Backend vorbei (an jeder Zählung,
   jedem Limit, jedem Protokoll), und ein API-Schlüssel lag im
   Browserspeicher.

   ────────────────────────────────────────────────────────────────────
   WARUM EINE EIGENE DATEI UND NICHT qc-bridge.js

   `qc-bridge.js` steht in CLAUDE.md unter „Nicht anfassen" — wegen des
   qcpm-Overlays darin. Dieser Vermittler hört auf eine eigene
   Nachrichtenart und kommt der Brücke nicht in die Quere. Zwei Hörer auf
   `message` sind kein Problem; jeder prüft seine eigene `type`.

   Das ist auch sonst die sauberere Trennung: die Brücke überträgt
   Objektdaten, dieser Vermittler eine KI-Anfrage. Zwei Zuständigkeiten,
   zwei Dateien.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  if (!window.Auth || typeof window.Auth.apiCall !== 'function') {
    console.warn('[qc-ai] Auth.apiCall fehlt — Vermittler nicht installiert');
    return;
  }

  function antwort(quelle, nutzlast) {
    try {
      quelle.postMessage(Object.assign({ source: 'dp-parent', type: 'qc-ai-antwort' },
                                       nutzlast), '*');
    } catch (e) { /* iframe weg - dann gibt es nichts zu antworten */ }
  }

  window.addEventListener('message', async function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'dp-qc' || d.type !== 'qc-ai-anfrage') return;

    /* Nur aus dem eigenen iframe annehmen. Ohne diese Prüfung könnte jede
       eingebettete Seite Analysen auf Kosten des Kontos auslösen. */
    var rahmen = document.querySelector('iframe[src*="quickcheck"]');
    if (!rahmen || ev.source !== rahmen.contentWindow) return;

    try {
      var r = await window.Auth.apiCall('/ai/quickcheck-analyse', {
        method: 'POST',
        body: {
          inputs: d.inputs || {},
          kpi: d.kpi || {},
          score: d.score,
          label: d.label,
          avm: d.avm || null
          /* Der Nutzerschlüssel geht bewusst NICHT mit: wer einen eigenen
             hat, pflegt ihn in den Einstellungen, und von dort holt ihn
             der Server-Pfad. Ein Schlüssel, der durch zwei Fenster
             gereicht wird, ist einer zu viel unterwegs. */
        }
      });
      antwort(ev.source, { ok: true, analyse: r && r.analyse });
    } catch (e) {
      /* Die Fehlermeldung geht durch, damit der Quick-Check sie zeigen
         kann - „irgendwas ging schief" hilft niemandem. */
      antwort(ev.source, { ok: false, fehler: (e && e.message) || 'unbekannt',
                           status: e && e.status });
    }
  });
})();
