'use strict';
/* v2204 · N63.7 · Abgeschaltete Hinweise — einmal gesagt, überall gemerkt
   ─────────────────────────────────────────────────────────────────────
   Marcel, 13.10.2026: „auf Wunsch: Erklär mir das. Das würde ich aber
   gerne auch wegxen können. Und dass man da vielleicht auch angeben kann
   ‚Nicht mehr anzeigen', dass es beim nächsten Mal nicht mehr kommt, dass
   er sich das merkt."

   Gemerkt wird im Browser (sofort) UND im Konto (user_settings, Schlüssel
   „hinweise", kein Schema nötig) — sonst käme der Hinweis auf dem Handy
   wieder, den man am Schreibtisch abgeschaltet hat. Der Server gewinnt beim
   Laden; geschrieben wird beides.

   DpHinweise.aus('erklaer')          -> true, wenn abgeschaltet
   DpHinweise.setze('erklaer', true)  -> abschalten (false = wieder an) */
(function () {
  if (window.DpHinweise) return;
  var LS = 'dp_hinweise';
  var stand = {};
  try { stand = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { stand = {}; }

  function sichern() {
    try { localStorage.setItem(LS, JSON.stringify(stand)); } catch (e) {}
    try {
      if (window.Auth && Auth.apiCall && (!Auth.isApiMode || Auth.isApiMode()))
        Auth.apiCall('/user-settings/hinweise', { method: 'PUT', body: { wert: stand } }).catch(function () {});
    } catch (e) {}
  }
  function laden() {
    try {
      if (!(window.Auth && Auth.apiCall && (!Auth.isApiMode || Auth.isApiMode()))) return;
      Auth.apiCall('/user-settings/hinweise').then(function (r) {
        if (r && r.wert && typeof r.wert === 'object') {
          stand = r.wert;
          try { localStorage.setItem(LS, JSON.stringify(stand)); } catch (e) {}
        }
      }).catch(function () {});
    } catch (e) {}
  }
  window.DpHinweise = {
    aus: function (k) { return stand[k] === true; },
    setze: function (k, an) { if (an) stand[k] = true; else delete stand[k]; sichern(); },
    laden: laden
  };
  /* nach dem Login (Plan steht) einmal vom Server holen */
  try { window.addEventListener('dp:plan-ready', laden, { once: true }); } catch (e) {}
  setTimeout(laden, 2500);
})();
