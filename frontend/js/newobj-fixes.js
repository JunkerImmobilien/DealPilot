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

  /* v1268b: Ist im Formular ueberhaupt etwas eingetragen? Die sechs Felder
     sind die, die eine Karte erst zu einem Objekt machen. */
  function _formularLeer() {
    try {
      var ids = ['ort', 'str', 'plz', 'kp', 'wfl', 'baujahr'];
      for (var i = 0; i < ids.length; i++) {
        var e = document.getElementById(ids[i]);
        if (e && String(e.value || '').trim() !== '') return false;
      }
      return true;
    } catch (e) { return false; }
  }

  function saveEmptyCard() {
    // #1: leeres neues Objekt sofort als Kartei speichern (umgeht hasCoreData).
    // saveObj() committet die Preview-ID, setzt _currentObjKey und rendert die Sidebar.
    /* v728-once-guard: doppelte leere Karte verhindern. newObj kann ueber mehrere Wege 2x feuern,
       saveObj ist async -> ein _currentObjKey-Check greift zu spaet. Daher SYNCHRONES Flag,
       das sofort sperrt und nach 1.5s (bzw. nach Erfolg) wieder freigibt. */
    try {
      if (window._dpEmptyCardSaving) return;
      /* ═══ v1268b · Zweimal klicken gibt trotzdem EINE leere Karte ═════════
         Der Guard oben haelt nur, solange der Save laeuft. Wer danach noch
         einmal klickt, bekommt ein zweites leeres Objekt - gemessen am
         09.09.2026: drei Klicks in 150 ms ergaben zwei Karteileichen.
         Solange das Formular unangetastet leer ist, wird deshalb die zuletzt
         angelegte leere Karte WIEDERVERWENDET statt eine neue anzulegen. Ein
         leeres Objekt zweimal zu haben hat keinen Zweck; sobald der Nutzer
         etwas eintraegt, greift die Wiederverwendung nicht mehr. */
      var _m = window._dpLetzteLeereKarte;
      if (!window._currentObjKey && _m && _m.key && (Date.now() - _m.t) < 30000 && _formularLeer()) {
        /* ═══ v1268c · Ist die gemerkte Karte UEBERHAUPT noch leer? ═════════
           Gemessen am 09.09.2026: Objekt leer angelegt, dann gefuellt und
           gespeichert, dann "Objekt anlegen" - der Merker zeigte weiter auf
           dieselbe Karte, und der naechste Tastendruck haette das gefuellte
           Objekt ueberschrieben. Das leere Formular sagt nur, dass HIER
           nichts steht, nicht was in der Karte steht. Also nachsehen; nur
           was der Server als leer meldet, wird wiederverwendet. */
        window._dpEmptyCardSaving = true;   /* sperrt, bis die Antwort da ist */
        Promise.resolve(
          (typeof Auth !== 'undefined' && Auth.apiCall) ? Auth.apiCall('/objects/' + _m.key) : null
        ).then(function (o) {
          window._dpEmptyCardSaving = false;
          var d = (o && o.data) || {};
          var leer = !String(d.ort || '').trim() && !String(d.str || '').trim() &&
                     !String(d.kp || '').trim() && !String(d.wfl || '').trim();
          if (!o || !leer) { window._dpLetzteLeereKarte = null; saveEmptyCard(); return; }
          window._currentObjKey = _m.key;
          window._currentObjSeq = _m.seq || null;
          window._objSeqIsPreview = false;
          try { if (typeof updHeader === 'function') updHeader(); } catch (e) {}
          try { if (typeof renderSaved === 'function') renderSaved(); } catch (e) {}
        }).catch(function () {
          window._dpEmptyCardSaving = false;
          window._dpLetzteLeereKarte = null;
        });
        return;
      }
      if (window._currentObjKey) return; /* bereits eine ID -> kein leeres Anlegen noetig */
      window._dpEmptyCardSaving = true;
      var _rel = function () {
        window._dpEmptyCardSaving = false;
        /* v1268b: merken, WELCHE leere Karte gerade entstanden ist */
        try {
          if (window._currentObjKey && _formularLeer()) {
            window._dpLetzteLeereKarte = { key: window._currentObjKey, seq: window._currentObjSeq, t: Date.now() };
          }
        } catch (e) {}
      };
      setTimeout(_rel, 1500); /* Sicherheitsnetz falls Promise nie aufloest */
      if (typeof window.saveObj === 'function') {
        var p = window.saveObj({ silent: true });
        if (p && typeof p.then === 'function') { p.then(_rel).catch(function () { _rel(); }); }
        else { _rel(); }
      } else { _rel(); }
    } catch (e) { window._dpEmptyCardSaving = false; }
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

  /* ═══ v1268 · Die leere Karte haengt jetzt am Ereignis, nicht nur an 60 ms ══
     storage.js wartet seit v1268 einen laufenden Sicherungs-Save ab, bevor es
     das Formular leert (sonst legt der Save selbst eine Karteileiche an).
     In dem Fall kaeme das setTimeout(60) unten zu frueh: es saehe den noch
     gesetzten _currentObjKey des alten Objekts, wuerde per Guard aussteigen -
     und es entstuende gar keine neue Karte. Darum zusaetzlich auf das
     Fertig-Signal hoeren. Doppelt schadet nicht: saveEmptyCard ist durch
     _dpEmptyCardSaving und _currentObjKey selbst gesperrt. */
  window.addEventListener('dp:newobj-ready', function () {
    resetActionBar();
    scrollTopMain();
    setTimeout(saveEmptyCard, 60);
  });
  setTimeout(wrap, 2500);
})();
