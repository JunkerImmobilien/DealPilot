/* ════════════════════════════════════════════════════════════════════
   v3600 · VORSCHAU-FUNKTIONEN IN DER APP

   Marcel 17.11.2026: „Funktionen, die noch nicht fertig sind, dürfen beim
   nächsten Prod-Rollout nicht für Kunden sichtbar werden.“

   Die Liste steht EINMAL im Backend (backend/src/services/vorschau-funktionen.json),
   GET /vorschau sagt je Schlüssel, ob dieses Konto die Funktion sieht. Die Routen
   der Funktion antworten ohnehin 403 – das hier ist nur die Oberfläche.

     DpVorschau.frei('gutachten_org')  -> Promise<boolean>   (ohne Antwort: false)
     DpVorschau.istFrei('vermoegen')   -> boolean | null       (null = noch nicht geladen)
     DpVorschau.markieren()            setzt .dpv-frei an jedes [data-vorschau="<frei>"]

   Statisches Markup trägt data-vorschau="<schluessel>" und ist ausgeblendet, bis
   der Schlüssel frei ist. Die Regel schlägt aside.sidebar .sb-act-item{display:flex
   !important} (0,2,1) – v3495: genau daran scheiterte die alte Sperre am Handy.
   Konto-Wechsel: neu laden bei dp:plan-ready.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpVorschau) return;

  try {
    var st = document.createElement('style');
    st.id = 'dp-vorschau-sperre';
    st.textContent = '[data-vorschau]:not(.dpv-frei),'
      + 'aside.sidebar .sb-act-item[data-vorschau]:not(.dpv-frei),'
      + 'html body #sidebar [data-vorschau]:not(.dpv-frei),'
      + 'html body aside.sidebar [data-vorschau]:not(.dpv-frei){display:none !important}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  var _stand = null, _laeuft = null, _uid = null;

  function uid() { try { var s = JSON.parse(localStorage.getItem('ji_session') || localStorage.getItem('dp_session') || 'null'); return s && (s.userId || s.email) || null; } catch (e) { return null; } }
  function angemeldet() { try { return !!(window.Auth && Auth.isApiMode && Auth.isApiMode() && Auth.isLoggedIn()); } catch (e) { return false; } }

  function laden(neu) {
    if (neu) { _stand = null; _laeuft = null; }
    if (_stand) return Promise.resolve(_stand);
    if (_laeuft) return _laeuft;
    if (!angemeldet()) return Promise.resolve({});
    _laeuft = Auth.apiCall('/vorschau').then(function (r) {
      _stand = (r && r.funktionen) || {}; _uid = uid(); markieren();
      try { window.dispatchEvent(new CustomEvent('dp:vorschau', { detail: _stand })); } catch (e) {}
      return _stand;
    }).catch(function () { return {}; }).then(function (s) { _laeuft = null; return s; });
    return _laeuft;
  }

  function frei(schluessel) { return laden().then(function (s) { return s[schluessel] === true; }); }
  function istFrei(schluessel) { return _stand ? _stand[schluessel] === true : null; }

  function markieren() {
    try {
      document.querySelectorAll('[data-vorschau]').forEach(function (el) {
        el.classList.toggle('dpv-frei', !!(_stand && _stand[el.getAttribute('data-vorschau')] === true));
      });
    } catch (e) {}
  }

  window.DpVorschau = { frei: frei, istFrei: istFrei, laden: laden, markieren: markieren };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { laden(); });
  else laden();
  window.addEventListener('dp:plan-ready', function () { if (_uid !== uid()) { _stand = null; markieren(); } laden(_uid !== uid()); });
})();
