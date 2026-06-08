/* ============================================================
   DealPilot — session-expired-banner.js (v500)

   Problem: Laeuft der JWT ab (z.B. nach 7/30 Tagen), schlagen
   API-Calls mit 401 fehl. Manche Pfade (PDF-/Expose-Import,
   Marktbericht) schlucken den Fehler still — der User sieht
   z.B. nur Bilder ohne Daten und denkt, der Import sei kaputt.

   Loesung: fetch()-Wrapper nach V229-Muster. Antwortet ein
   /api/v1/-Call mit 401, obwohl beim Aufruf ein Token vorlag,
   erscheint EINMAL pro Seite ein deutliches Banner:
   "Sitzung abgelaufen — bitte neu anmelden" + Button.
   Der Original-Response wird unveraendert durchgereicht —
   bestehende Fehlerbehandlung (auth-401-handler, pdf-import-
   Meldungen) funktioniert weiter wie bisher.
   ============================================================ */
(function () {
  'use strict';
  if (window._dpV500SessBanner) return;
  window._dpV500SessBanner = true;

  function hasToken() {
    try { return !!localStorage.getItem('ji_token'); } catch (e) { return false; }
  }

  var shown = false;
  function showBanner() {
    if (shown) return;
    shown = true;
    try {
      var st = document.createElement('style');
      st.textContent =
        '#dp-sess-banner{position:fixed;top:0;left:0;right:0;z-index:2147483000;' +
          'display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;' +
          'padding:13px 18px;background:linear-gradient(135deg,#1a1408 0%,#0d0a04 100%);' +
          'border-bottom:1.5px solid #C9A84C;box-shadow:0 6px 30px rgba(0,0,0,.55);' +
          'font-family:Inter,sans-serif;font-size:14px;color:#F4ECD8;' +
          'animation:dpSessIn .35s ease-out}' +
        '@keyframes dpSessIn{from{transform:translateY(-100%)}to{transform:translateY(0)}}' +
        '#dp-sess-banner b{color:#E8CC7A}' +
        '#dp-sess-banner button{font-family:"Space Grotesk",Inter,sans-serif;font-weight:600;' +
          'font-size:13px;cursor:pointer;border-radius:999px;padding:8px 18px}' +
        '#dp-sess-relogin{background:linear-gradient(135deg,#C9A84C,#E8CC7A);color:#0a0a0a;border:none}' +
        '#dp-sess-close{background:transparent;color:rgba(244,236,216,.6);' +
          'border:1px solid rgba(201,168,76,.35)}';
      document.head.appendChild(st);

      var b = document.createElement('div');
      b.id = 'dp-sess-banner';
      b.setAttribute('role', 'alert');
      b.innerHTML =
        '<span><b>Sitzung abgelaufen</b> — bitte neu anmelden. ' +
        'Der letzte Vorgang (z.\u202fB. PDF-Import) wurde nicht ausgef\u00fchrt.</span>' +
        '<button id="dp-sess-relogin" type="button">Neu anmelden</button>' +
        '<button id="dp-sess-close" type="button">Schlie\u00dfen</button>';
      document.body.appendChild(b);

      document.getElementById('dp-sess-relogin').addEventListener('click', function () {
        try { localStorage.removeItem('ji_token'); } catch (e) {}
        try { localStorage.removeItem('ji_session'); } catch (e) {}
        location.reload();
      });
      document.getElementById('dp-sess-close').addEventListener('click', function () {
        b.remove();
      });
    } catch (e) {
      try { console.warn('[v500-sess-banner]', e); } catch (_) {}
    }
  }

  var _origFetch = window.fetch;
  window.fetch = function (input, init) {
    var hadToken = hasToken();
    return _origFetch.call(this, input, init).then(function (resp) {
      try {
        if (resp && resp.status === 401 && hadToken) {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          if (url.indexOf('/api/v1/') !== -1) {
            if (document.body) showBanner();
            else document.addEventListener('DOMContentLoaded', showBanner);
          }
        }
      } catch (e) {}
      return resp;
    });
  };
})();
