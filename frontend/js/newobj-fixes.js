/* ============================================================================
   DealPilot v434 – newobj-fixes.js
   Behebt drei Dinge beim Anlegen eines neuen Objekts (zentral fuer alle Wege:
   Submenu sbActionsAction('new'), Bottom-Sheet bsheetAction('new'), Button newObj()):

   #1  Auto-Save + leere Kartei: ein frisch angelegtes (leeres) Objekt wird NICHT
       gespeichert, weil der Auto-Save-Pfad hasCoreData() verlangt. -> Wir rufen
       saveObj() DIREKT auf (umgeht hasCoreData) -> Kartei erscheint sofort.
   #4  Aktionen-Checkboxen (.qc7-src) bleiben gehakt -> ObjectActions.render()
       baut die Leiste frisch (ungehakt) neu auf.
   #5  Kein Scroll-to-top -> .main-col.scrollTop = 0 (html/body haben overflow:hidden).

   Reiner additiver Wrapper um window.newObj. Idempotent. Frontend-only, kein Rebuild.
   ============================================================================ */
(function () {
  'use strict';

  function scrollTopMain() {
    try {
      var mc = document.querySelector('.main-col');
      if (mc) mc.scrollTop = 0;
    } catch (e) {}
  }

  function resetActionBar() {
    // #4: Aktionsleiste neu rendern -> Checkboxen (.qc7-src) ungehakt.
    try {
      if (window.ObjectActions && typeof window.ObjectActions.render === 'function') {
        window.ObjectActions.render();
      }
    } catch (e) {}
  }

  function saveEmptyCard() {
    // #1: leeres neues Objekt sofort als Kartei speichern (umgeht hasCoreData).
    // saveObj() committet die Preview-ID, setzt _currentObjKey und rendert die Sidebar.
    try {
      if (typeof window.saveObj === 'function') {
        var p = window.saveObj({ silent: true });
        if (p && typeof p.then === 'function') p.catch(function () {});
      }
    } catch (e) {}
  }

  function afterNewObj() {
    // Reihenfolge: erst Leiste/Scroll (synchron sichtbar), dann speichern.
    resetActionBar();
    scrollTopMain();
    // kurz warten, damit newObj() (inkl. setDefaults/peekNextLocal) fertig ist,
    // bevor wir die leere Kartei committen.
    setTimeout(saveEmptyCard, 60);
  }

  function wrap() {
    if (typeof window.newObj !== 'function') return false;
    if (window.newObj._v434Wrapped) return true;
    var orig = window.newObj;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      try { setTimeout(afterNewObj, 0); } catch (e) {}
      return r;
    };
    // Flags/Marker der bestehenden Wraps (auto-save.js, object-actions.js) durchreichen,
    // damit die ihren Wrap nicht erneut anlegen bzw. erkennen.
    wrapped._v434Wrapped = true;
    if (orig._dpWrapped) wrapped._dpWrapped = true;
    window.newObj = wrapped;
    return true;
  }

  // Spaet genug wrappen, dass auto-save.js + object-actions.js ihre Wraps schon gesetzt
  // haben (wir sitzen damit AUSSEN herum und laufen zuletzt). Mehrfach versuchen.
  var tries = 0;
  (function ensure() {
    if (wrap()) return;
    if (tries++ < 60) setTimeout(ensure, 200);
  })();

  // Falls eine spaetere Datei window.newObj erneut ersetzt: nach DOMContentLoaded
  // + verzoegert nochmal sicherstellen.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(wrap, 800); });
  } else {
    setTimeout(wrap, 800);
  }
  setTimeout(wrap, 2500);
})();
