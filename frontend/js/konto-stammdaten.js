'use strict';
/* ══ v3040 · STAMMDATEN UND ERSTEINRICHTUNG GEHÖREN ANS KONTO ══════════

   Marcel am 29.10.2026: „ich bekomme ständig am Anfang, wenn ich mich
   anmelde, die Ersteinrichtung, und auch die Daten Adresse, E-Mail etc.
   muss ich immer wieder neu eingeben. Speichert er sich das nicht?"

   GEMESSEN am Code: beides lag nur im localStorage des BROWSERS —
     · Stammdaten (Name, Firma, Adresse, Telefon, E-Mail, Logo):
       `dp_user_settings`, js/settings.js save() schreibt nur dorthin
     · „Ersteinrichtung erledigt": `dp_onboarding_done_v1:<Konto>`
   Anderer Browser, anderes Gerät, Staging statt Prod oder ein Browser,
   der beim Schließen seine Websitedaten löscht: beides ist weg, und die
   Ersteinrichtung kommt wieder. vorgaben-sync.js (v3024) gleicht seit
   gestern die Bewertungs-Vorgaben ab — die Stammdaten waren nicht dabei.

   WAS DIESES MODUL TUT (user_settings `stammdaten`), nach derselben
   Regel wie vorgaben-sync.js: der Server gewinnt, aber nie gegen leer.
     · Laden: Stammdaten und Merker vom Server in den Browser.
     · Leerer Server: der Browserstand geht hoch — nur, wenn er diesem
       Konto gehört oder noch keinem (dp_stammdaten_nutzer). Fremde Daten
       werden weder hochgeladen noch gelöscht.
     · Schreiben: jede Änderung an dp_user_settings und am eigenen
       Erledigt-Merker geht gebündelt an den Server.
   Der eigene OpenAI-Schlüssel (openai_api_key) bleibt im Browser — ein
   Geheimnis gehört nicht in eine Einstellungszeile.

   onboarding.js fragt fertig() ab und wartet auf den Abgleich, bevor es
   die Ersteinrichtung zeigt — sonst käme sie, bevor der Server sagen
   kann, dass sie längst erledigt ist. */
(function () {
  if (window.DpKontoStammdaten) return;

  var SCHLUESSEL = 'stammdaten';
  var LS_SETTINGS = 'dp_user_settings';
  var LS_FERTIG = 'dp_onboarding_done_v1';
  var LS_NUTZER = 'dp_stammdaten_nutzer';
  var GEHEIM = ['openai_api_key'];
  var GRENZE = 190 * 1024;   /* Server nimmt 200 KB; das Logo fällt zuerst */

  var _set = Storage.prototype.setItem, _rem = Storage.prototype.removeItem;
  var uid = null, geladenFuer = null, bereit = false, timer = null, zuletzt = null;

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function fertigKey() { return LS_FERTIG + ':' + uid; }
  function lesen(k) { var s = ls(); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function settingsLokal() {
    try { var o = JSON.parse(lesen(LS_SETTINGS) || 'null'); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; }
  }
  function ohneGeheim(o) {
    var r = {};
    Object.keys(o || {}).forEach(function (k) { if (GEHEIM.indexOf(k) < 0) r[k] = o[k]; });
    return r;
  }
  function gefuellt(o) {
    return !!o && Object.keys(o).some(function (k) {
      var v = o[k]; return typeof v === 'string' && /^(user_|pdf_)/.test(k) && v.trim() !== '';
    });
  }
  function stand() {
    var st = ohneGeheim(settingsLokal() || {});
    var w = { settings: st, onboarding_fertig: lesen(fertigKey()) || null, nutzer: uid };
    if (JSON.stringify(w).length > GRENZE && st.pdf_logo_b64) {
      delete st.pdf_logo_b64; w.logo_zu_gross = true;
    }
    return w;
  }
  function gleich(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }

  function hoch() {
    if (!uid || !bereit) return;
    var w = stand();
    if (zuletzt && gleich(w.settings, zuletzt.settings) && w.onboarding_fertig === zuletzt.onboarding_fertig) return;
    zuletzt = w;
    try {
      Auth.apiCall('/user-settings/' + SCHLUESSEL, { method: 'PUT', body: { wert: w } }).catch(function () {});
    } catch (e) {}
  }
  function vorgemerkt() { clearTimeout(timer); timer = setTimeout(hoch, 1200); }

  function betrifft(k) { k = String(k); return k === LS_SETTINGS || (uid && k === fertigKey()); }
  Storage.prototype.setItem = function (k, v) {
    _set.call(this, k, v);
    try { if (bereit && this === ls() && betrifft(k)) vorgemerkt(); } catch (e) {}
  };
  Storage.prototype.removeItem = function (k) {
    _rem.call(this, k);
    try { if (bereit && this === ls() && betrifft(k)) vorgemerkt(); } catch (e) {}
  };

  function sitzungsUid() {
    try {
      if (!window.Auth || !Auth.isApiMode || !Auth.isApiMode()) return null;
      var s = Auth.getSession && Auth.getSession();
      return (s && s.userId) ? String(s.userId) : null;
    } catch (e) { return null; }
  }

  function start() {
    var u = sitzungsUid();
    if (!u || u === uid) return;
    uid = u; bereit = false; zuletzt = null;
    var s = ls(); if (!s) { geladenFuer = u; return; }
    var fertigFuer = u;
    var ende = function () { if (uid === fertigFuer) geladenFuer = fertigFuer; };
    Auth.apiCall('/user-settings/' + SCHLUESSEL).then(function (r) {
      if (uid !== fertigFuer) return;
      var server = (r && r.wert && typeof r.wert === 'object') ? r.wert : null;
      var besitzer = s.getItem(LS_NUTZER);
      var lokal = settingsLokal();

      if (server && (gefuellt(server.settings) || server.onboarding_fertig)) {
        if (server.settings && gefuellt(server.settings)) {
          /* Server gewinnt; das eigene Geheimnis und ein zu großes Logo bleiben lokal */
          var neu = {};
          Object.keys(server.settings).forEach(function (k) { neu[k] = server.settings[k]; });
          if (besitzer === uid && lokal) {
            GEHEIM.forEach(function (k) { if (lokal[k]) neu[k] = lokal[k]; });
            if (server.logo_zu_gross && lokal.pdf_logo_b64) neu.pdf_logo_b64 = lokal.pdf_logo_b64;
          }
          if (!gleich(neu, lokal)) _set.call(s, LS_SETTINGS, JSON.stringify(neu));
        }
        if (server.onboarding_fertig && !s.getItem(fertigKey())) _set.call(s, fertigKey(), String(server.onboarding_fertig));
        _set.call(s, LS_NUTZER, uid);
        bereit = true;
        zuletzt = stand();
        /* Lokal erledigt, Server wusste es noch nicht: nachtragen */
        if (!server.onboarding_fertig && s.getItem(fertigKey())) { zuletzt = null; hoch(); }
        ende();
        return;
      }
      /* Server leer: hochladen, was diesem Konto gehört (oder noch keinem) */
      if (!besitzer || besitzer === uid) {
        _set.call(s, LS_NUTZER, uid);
        bereit = true;
        var w = stand();
        if (gefuellt(w.settings) || w.onboarding_fertig) hoch();
      } else {
        bereit = true;   /* fremder Browserstand: nichts hochladen, nichts löschen */
        zuletzt = stand();
      }
      ende();
    }).catch(function () { ende(); });
    /* Ohne Antwort nach 5 s gilt der Browserstand — die App wartet nie länger */
    setTimeout(ende, 5000);
  }

  window.DpKontoStammdaten = {
    start: start,
    /* true, sobald der Abgleich für das angemeldete Konto durch ist (oder nichts abzugleichen ist) */
    fertig: function () { var u = sitzungsUid(); return !u || geladenFuer === u; }
  };
  try { start(); } catch (e) {}
  window.addEventListener('dp:plan-ready', function () { try { start(); } catch (e) {} });
})();
