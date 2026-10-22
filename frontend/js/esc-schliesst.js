/* ============================================================================
   DealPilot v2572 — esc-schliesst.js
   ESC schliesst den obersten Dialog — auch dort, wo das Modul es nicht selbst tut.

   Gemessen am 21.10.2026 mit dem Modal-Pruefer der Messkabine (v2570,
   259 Messungen, 7 Breiten): bei acht Fenstern blieb Escape wirkungslos —
   Track-Record, Bank-Export (beide DP_BAR), Steuerperioden, Pass teilen,
   Deal-Score-Einstellungen, Rechtliches, die drei Deal-Aktion-Fenster
   (Bank, Gutachten, Beratung) und die Ueberfuehrung. Wer mit der Tastatur
   arbeitet, musste zur Maus greifen.

   WARUM EINE LISTE und kein „schliesse, was oben liegt":
   viele Fenster haben eigene ESC-Wege, manche schliessen mit einer
   Animation, und ein zweiter Klick auf ihren Schliesser wuerde sie
   wieder oeffnen oder das Fenster DARUNTER treffen. Hier stehen nur
   Fenster, die nachweislich keinen eigenen Weg haben — je mit dem
   Schliesser, den ihr eigener Code benutzt.

   Und es wird NACH den Modulen entschieden (setTimeout 0): hat ein
   eigener Handler das Fenster schon geschlossen, passiert hier nichts.
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotEscSchliesst) return;

  /* [Wurzel, Schliesser] — der Schliesser ist der Knopf, den das Fenster selbst traegt. */
  var FENSTER = [
    ['#trackrecord-modal',   '.dpm-x'],
    ['#bankexport-modal',    '.dpm-x'],
    ['#tax-periods-modal',   'button[onclick*="closeModal"]'],
    ['.qbs-ov',              '#qbs-x'],
    ['#ds-settings-modal',   '.pricing-close'],
    ['#dp-legal-info-modal', '.dp-legal-close'],
    ['#da-modal-ov',         '.da-modal-close'],
    ['#dpuew-overlay',       '.dpuew-x'],
    ['#mfh-modal',           '#mfh-zu'],
    /* v2820 · die drei Import-Fenster hatten keinen ESC-Weg (pdf-import.js,
       dokument-import.js, beleg-import.js: nur Klick auf ×/Schleier) */
    ['#pdfimport-modal',     '.pdfi-header .bmf-close'],
    ['#dpdi-modal',          '.dpdi-close'],
    ['#beleg-import-ov',     '.bi-x']
  ];

  function sichtbar(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  }
  function zIndex(el) {
    for (var p = el; p && p !== document.body; p = p.parentElement) {
      var z = parseInt(getComputedStyle(p).zIndex, 10);
      if (!isNaN(z)) return z;
    }
    return 0;
  }

  /* Das oberste offene Fenster aus der Liste - hoechster z-index, bei
     Gleichstand das spaeter im Dokument stehende. */
  function oberstes() {
    var best = null, bz = -Infinity;
    FENSTER.forEach(function (f) {
      var el = document.querySelector(f[0]);
      if (!sichtbar(el)) return;
      var z = zIndex(el);
      if (z > bz || (z === bz && best && (best.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        best = { el: el, schliesser: f[1] }; bz = z;
      }
    });
    return best;
  }

  /* Liegt ueber dem gefundenen Fenster ein ANDERES Overlay (eines, das hier
     nicht steht)? Dann gehoert ESC diesem - nichts tun. */
  function verdeckt(el) {
    var r = el.getBoundingClientRect();
    var x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
    var y = Math.min(Math.max(r.top + Math.min(r.height / 2, 40), 1), innerHeight - 1);
    var oben = document.elementFromPoint(x, y);
    return !!(oben && oben !== el && !el.contains(oben));
  }

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    var ziel = oberstes();
    if (!ziel || verdeckt(ziel.el)) return;
    setTimeout(function () {
      if (!sichtbar(ziel.el)) return;               /* das Modul war schneller */
      var k = ziel.el.querySelector(ziel.schliesser);
      if (k && typeof k.click === 'function') k.click();
    }, 0);
  }, true);

  window.DealPilotEscSchliesst = { fenster: FENSTER, oberstes: oberstes };
})();
