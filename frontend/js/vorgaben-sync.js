'use strict';
/* ══ v3024 · DIE BEWERTUNGS-VORGABEN GEHÖREN ANS KONTO, NICHT AN DEN BROWSER ══

   Marcel am 28.10.2026 zum Demo-Konto: „das sollten wir alles so setzen,
   dass es passt und beide Konten Prod wie Staging gleich sind. Es muss
   halt zum Storytelling passen."

   GEMESSEN am 28.10.2026: das Demo-Konto rechnet auf Staging mit der
   Vorlage „Lage-Fokus" (dp_dealscore2_preset = lage, DS-Gewichte
   20/22/14/14/30) - alle 17 gespeicherten Demo-Scores sind damit
   bitgleich nachgerechnet. Derselbe Browser hatte auf Prod „custom" mit
   30/25/15/15/15. Wer dort ein Demo-Objekt öffnet, sieht die
   Westerfeldstr. 140 mit 85 „Sehr gut" statt 77 „Gut" - und speichert
   die 85 beim nächsten Speichern in die Datenbank.

   Ursache: Vorlage, Gewichte, Anlegerprofil-Set und Investmentprofil
   liegen nur im localStorage. localStorage gehört dem BROWSER, nicht dem
   Nutzer: zwei Konten im selben Browser teilen sich die Vorgaben, ein
   Konto auf zwei Rechnern hat zwei verschiedene.

   WAS DIESES MODUL TUT (user_settings `browser_vorgaben`):
     · Laden: der Server gewinnt, aber nie gegen leer (userSettings.js).
       Weicht der Server vom Browser ab, werden die Schlüssel gesetzt und
       die Seite EINMAL je Sitzung und Konto neu geladen - die Scores sind
       zu diesem Zeitpunkt schon mit den alten Gewichten gerechnet.
     · Leerer Server: der Browserstand wird hochgeschrieben - aber nur,
       wenn er diesem Konto gehört (dp_vorgaben_nutzer). Gehört er einem
       anderen Konto, wird er beiseitegelegt (dp_vorgaben_ablage_<id>) und
       dieses Konto startet mit den Vorgaben der App (Standard).
     · Schreiben: jede Änderung an einem der Schlüssel geht (gebündelt)
       an den Server. Abgefangen an Storage.prototype.setItem/removeItem,
       damit keine der Stellen, die die Vorgaben setzen (dealscore.js,
       dealscore2.js, standardwerte-karten.js, investment-profile.js,
       onboarding.js), einzeln verdrahtet werden muss.

   Ohne Anmeldung, ohne API oder bei Fehlern passiert nichts - der Browser
   rechnet dann wie bisher mit seinem eigenen Stand. */
(function () {
  if (window.DpVorgabenSync) return;

  var SCHLUESSEL = 'browser_vorgaben';
  var KEYS = [
    'dp_dealscore2_preset',   /* Bewertungsprofil (dealscore2.js) */
    'dp_dealscore2_config',   /* eigene DS2-Gewichte bei „custom" */
    'dp_dealscore_weights',   /* DealPilot-Score-Gewichte (dealscore.js) */
    'dp_dealscore_eigen',     /* v2191 · eigene DS-Regler aktiv */
    'dp_std_set',             /* Anlegerprofil-Set (standardwerte-karten.js) */
    'dp_investment_profile'   /* Investmentprofil inkl. Co-Pilot-Strategie */
  ];
  var LS_NUTZER = 'dp_vorgaben_nutzer';
  var SS_NEU = 'dp_vorgaben_neu_';

  var _set = Storage.prototype.setItem, _rem = Storage.prototype.removeItem;
  var uid = null, bereit = false, timer = null, zuletzt = null, aktiv = false;

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function stand() {
    var s = ls(), o = {};
    if (!s) return o;
    KEYS.forEach(function (k) { var v = s.getItem(k); if (v != null) o[k] = v; });
    return o;
  }
  function gleich(a, b) {
    return KEYS.every(function (k) { return (a[k] == null ? null : String(a[k])) === (b[k] == null ? null : String(b[k])); });
  }
  function setzen(o) {
    var s = ls(); if (!s) return;
    KEYS.forEach(function (k) {
      if (o[k] == null) _rem.call(s, k); else _set.call(s, k, String(o[k]));
    });
  }
  function hoch(o) {
    if (!uid) return;
    var wert = { keys: o, nutzer: uid, stand: new Date().toISOString() };
    zuletzt = o;
    try { Auth.apiCall('/user-settings/' + SCHLUESSEL, { method: 'PUT', body: { wert: wert } }).catch(function () {}); } catch (e) {}
  }
  function vorgemerkt() {
    if (!bereit) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      var o = stand();
      if (zuletzt && gleich(o, zuletzt)) return;
      hoch(o);
    }, 1200);
  }

  /* Abfangen: nur localStorage, nur die Schlüssel oben, erst nach dem Laden. */
  Storage.prototype.setItem = function (k, v) {
    _set.call(this, k, v);
    try { if (bereit && this === ls() && KEYS.indexOf(String(k)) >= 0) vorgemerkt(); } catch (e) {}
  };
  Storage.prototype.removeItem = function (k) {
    _rem.call(this, k);
    try { if (bereit && this === ls() && KEYS.indexOf(String(k)) >= 0) vorgemerkt(); } catch (e) {}
  };

  function neuLaden() {
    try {
      var ss = window.sessionStorage;
      if (ss.getItem(SS_NEU + uid)) return;   /* einmal je Sitzung und Konto - nie eine Schleife */
      ss.setItem(SS_NEU + uid, '1');
    } catch (e) { return; }
    try { location.reload(); } catch (e) {}
  }

  function start() {
    try {
      if (!window.Auth || !Auth.isApiMode || !Auth.isApiMode()) return;
      var sess = Auth.getSession && Auth.getSession();
      if (!sess || !sess.userId) return;
      if (aktiv && String(sess.userId) === uid) return;   /* Kontowechsel ohne Neuladen: neu beginnen */
      uid = String(sess.userId);
    } catch (e) { return; }
    aktiv = true; bereit = false; zuletzt = null;
    var s = ls(); if (!s) return;
    Auth.apiCall('/user-settings/' + SCHLUESSEL).then(function (r) {
      var lokal = stand();
      var besitzer = s.getItem(LS_NUTZER);
      var server = (r && r.wert && typeof r.wert === 'object' && r.wert.keys && typeof r.wert.keys === 'object') ? r.wert.keys : null;
      if (server) {
        /* Der bisherige Browserstand wird beiseitegelegt, bevor der Server ihn ersetzt -
           ohne bekannten Besitzer (erster Lauf nach v3024) unter „ohne": er gehört dann
           dem ersten Konto mit leerem Server, das hier angemeldet wird. */
        if (besitzer !== uid && Object.keys(lokal).length && !gleich(server, lokal)) {
          try { _set.call(s, 'dp_vorgaben_ablage_' + (besitzer || 'ohne'), JSON.stringify(lokal)); } catch (e) {}
        }
        _set.call(s, LS_NUTZER, uid);
        zuletzt = server;
        bereit = true;
        if (!gleich(server, lokal)) { setzen(server); neuLaden(); }
        return;
      }
      /* Server leer */
      if (!besitzer || besitzer === uid) {
        _set.call(s, LS_NUTZER, uid);
        bereit = true;
        hoch(lokal);
        return;
      }
      /* Der Browserstand gehört einem anderen Konto: beiseitelegen, eigene Ablage zurückholen oder Standard. */
      try { _set.call(s, 'dp_vorgaben_ablage_' + besitzer, JSON.stringify(lokal)); } catch (e) {}
      var eigen = {}, ablage = s.getItem('dp_vorgaben_ablage_' + uid);
      if (ablage == null) { ablage = s.getItem('dp_vorgaben_ablage_ohne'); if (ablage != null) _rem.call(s, 'dp_vorgaben_ablage_ohne'); }
      try { eigen = JSON.parse(ablage || '{}') || {}; } catch (e) { eigen = {}; }
      _set.call(s, LS_NUTZER, uid);
      bereit = true;
      if (!gleich(eigen, lokal)) { setzen(eigen); hoch(eigen); neuLaden(); }
      else hoch(eigen);
    }).catch(function () { /* kein Server - der Browser rechnet wie bisher */ });
  }

  window.DpVorgabenSync = { start: start, KEYS: KEYS, stand: stand };
  try { start(); } catch (e) {}
  /* Nach einer Anmeldung ohne Neuladen (Login-Fenster) kommt der Plan nach. */
  window.addEventListener('dp:plan-ready', function () { try { start(); } catch (e) {} });
})();
