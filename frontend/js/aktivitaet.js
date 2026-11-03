/* ══════════════════════════════════════════════════════════════════════
   v3095 · Online-Dauer — ein Puls pro Minute an /aktivitaet/puls

   Nur wenn: angemeldet, Fenster sichtbar, und in den letzten 5 Minuten eine
   Eingabe (Maus, Tastatur, Scrollen, Berührung) — oder der Fokus liegt in
   einem iframe (Quick-Check, Marktbericht: deren Eingaben erreichen dieses
   Dokument nicht). Die Rechnung macht der Server (routes/aktivitaet.js).
   Fehler bleiben still: die Messung darf die App nie stören.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpAktivitaet) return;

  var TAKT_MS = 60 * 1000;
  var LEERLAUF_MS = 5 * 60 * 1000;
  var letzteEingabe = Date.now();

  function merken() { letzteEingabe = Date.now(); }
  ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart', 'mousemove'].forEach(function (ev) {
    window.addEventListener(ev, merken, { passive: true, capture: true });
  });

  function angemeldet() {
    try { return !!(window.Auth && Auth.isApiMode && Auth.isApiMode() && Auth.isLoggedIn && Auth.isLoggedIn()); }
    catch (e) { return false; }
  }

  function aktiv() {
    if (document.visibilityState !== 'visible') return false;
    var el = document.activeElement;
    if (el && el.tagName === 'IFRAME') return true;
    return Date.now() - letzteEingabe <= LEERLAUF_MS;
  }

  function puls() {
    if (!angemeldet() || !aktiv()) return;
    try { Auth.apiCall('/aktivitaet/puls', { method: 'POST', timeout: 10000 }).catch(function () {}); }
    catch (e) { /* still */ }
  }

  setInterval(puls, TAKT_MS);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { merken(); puls(); }
  });
  setTimeout(puls, 5000);

  window.DpAktivitaet = { puls: puls };
})();
