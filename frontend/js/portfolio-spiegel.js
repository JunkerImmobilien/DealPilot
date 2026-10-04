/* portfolio-spiegel.js — der Browser legt sein Rechenergebnis ab (v1793)
 *
 * Marcel am 02.10.2026: "ich moechte eigentlich die komplette Auskunft haben
 * und du sollst das auch nicht doppelt bauen. Ich wuerde vorschlagen, dass
 * wir die Werte dann mit in die Datenbank schreiben, beim Portfolio."
 *
 * ── WARUM DAS DIE RICHTIGE LOESUNG IST ───────────────────────────────────
 *
 * Der Telegram-Bot braucht Portfolio-Zahlen. Gerechnet werden sie
 * ausschliesslich hier im Browser (`dashboard.js` aggStats/projectAll).
 * Die naheliegende Loesung — dasselbe im Backend nachbauen — ist die
 * verbotene:
 *
 *   > "Rechenkerne — nie duplizieren" (CLAUDE.md)
 *
 * Und das ist nicht theoretisch: `projectAll` rechnete JAHRELANG in Cent,
 * Faktor 100, in Tabelle UND Charts. Aufgefallen ist es erst, als der
 * Portfolio-Pilot dieselbe Groesse aus einer zweiten Quelle danebenstellte.
 *
 * Diese Datei RECHNET DESHALB NICHTS. Sie ruft `portfolioPayload()` — die
 * Funktion, die auch der Co-Pilot im Browser bekommt — und schickt das
 * Ergebnis unveraendert an den Server. Eine Quelle, zwei Leser.
 *
 * ── WANN GESCHRIEBEN WIRD ────────────────────────────────────────────────
 *
 * Nicht bei jeder Aenderung: das waere ein Schreibvorgang je Tastendruck.
 * Geschrieben wird, wenn sich der Inhalt WIRKLICH geaendert hat (Vergleich
 * ueber eine Pruefsumme) und hoechstens alle 60 Sekunden.
 *
 * ── WAS DER NUTZER DAVON MERKT ───────────────────────────────────────────
 *
 * Nichts, und das ist Absicht. Der Spiegel ist nur so frisch wie der letzte
 * Besuch — deshalb traegt jede Bot-Antwort ihren Stand mit. Eine Zahl ohne
 * Stand behauptet, aktuell zu sein.
 */
(function () {
  'use strict';

  var MIN_ABSTAND_MS = 60 * 1000;
  var _letzteSumme = null;
  var _letztesMal = 0;
  var _laeuft = false;

  /* Billige Pruefsumme ueber den Text. Kein Sicherheitszweck — sie soll nur
     unveraenderte Zustaende erkennen, und dafuer reicht sie. */
  function _summe(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h) + ':' + s.length;
  }

  function _version() {
    try {
      var m = document.querySelector('meta[name="dp-version"]');
      if (m) return m.getAttribute('content');
      var s = document.querySelector('script[src*="dashboard.js"]');
      if (s) { var q = (s.getAttribute('src') || '').split('?v=')[1]; if (q) return q; }
    } catch (e) {}
    return null;
  }

  async function schreiben(grund) {
    if (_laeuft) return;
    if (!(window.Auth && window.Auth.apiCall && window.Auth.isLoggedIn && window.Auth.isLoggedIn())) return;
    var D = window.DealPilotDashboard;
    if (!D || typeof D.portfolioPayload !== 'function') return;

    /* ERST LADEN, DANN RECHNEN LASSEN. `portfolioPayload()` liest einen
       Cache (`_details`), den nur `loadDetails()` fuellt — und das lief
       bisher nur beim Oeffnen des Dashboards. Gemessen am 02.10.2026:
       ohne diesen Schritt meldet der Payload `anzahl_objekte: 0`, obwohl
       neun gewonnene Objekte da sind.

       > Eine Funktion, die ohne Vorbereitung eine PLAUSIBLE Null liefert,
       > ist gefaehrlicher als eine, die wirft. */
    if (typeof D.portfolioLaden !== 'function') return;
    try { await D.portfolioLaden(); } catch (e) { return; }

    var payload;
    try {
      payload = D.portfolioPayload();
    } catch (e) {
      /* Lieber kein Spiegel als ein falscher. Ein halb gerechneter Payload
         waere schlimmer als gar keiner — der Bot wuerde ihn fuer vollstaendig
         halten. */
      return;
    }
    if (!payload || typeof payload !== 'object') return;

    /* Kein Objekt, nichts zu spiegeln. Einen leeren Spiegel zu schreiben
       hiesse, dem Bot "du hast kein Portfolio" zu sagen, obwohl vielleicht
       nur die Liste noch nicht geladen war. */
    if (!payload.anzahl_objekte) return;

    var roh;
    try { roh = JSON.stringify(payload); } catch (e) { return; }
    var sum = _summe(roh);
    var jetzt = Date.now();
    if (sum === _letzteSumme) return;                       /* unveraendert */
    if (jetzt - _letztesMal < MIN_ABSTAND_MS) return;       /* zu dicht */

    _laeuft = true;
    try {
      await window.Auth.apiCall('/portfolio-spiegel', {
        method: 'PUT',
        body: { payload: payload, app_version: _version() }
      });
      _letzteSumme = sum;
      _letztesMal = jetzt;
      try { console.debug('[portfolio-spiegel] geschrieben (' + grund + '), '
        + payload.anzahl_objekte + ' Objekte, ' + roh.length + ' Bytes'); } catch (e) {}
    } catch (e) {
      /* Still: der Spiegel ist eine Bequemlichkeit, kein Teil der App.
         Ein Fehler hier darf dem Nutzer nichts anzeigen. */
      try { console.debug('[portfolio-spiegel] nicht geschrieben: ' + (e && e.message)); } catch (e2) {}
    } finally { _laeuft = false; }
  }

  /* Anlaesse: einmal nach dem Start (wenn die Objekte stehen), und danach
     wenn ein Objekt fertig geladen wurde. `dp:object-ready` ist das einzige
     Objekt-Ereignis, das die App feuert — gemessen, nicht angenommen. */
  function start() {
    setTimeout(function () { schreiben('start'); }, 6000);
    try {
      window.addEventListener('dp:object-ready', function () {
        setTimeout(function () { schreiben('object-ready'); }, 1500);
      });
    } catch (e) {}
    /* Letzter Anlass vor dem Weggehen: der Nutzer hat gerechnet und schliesst
       den Tab. sendBeacon waere hier falsch — es kann kein Authorization
       setzen. Also ein normaler Aufruf, der notfalls abbricht. */
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') schreiben('verborgen');
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }

  window.DealPilotPortfolioSpiegel = { schreiben: schreiben };
})();
