/* ═══════════════════════════════════════════════════════════════════════
   js/indexreihen.js · v3026 — amtliche Indexreihen im Browser

   Holt GET /marktbericht/indexreihen (VPI und Index der Nettokaltmieten,
   2020 = 100; Baupreisindex 2021 = 100) höchstens einmal am Tag und hält sie
   im Speicher und in localStorage (mit Stand und ETag). Die Reihen ändern sich
   monatlich, der Server holt sie wöchentlich — ein Abruf je Nutzer und Tag
   reicht. Fällt der Server aus, rechnet die App mit dem letzten Stand aus
   localStorage; ohne jeden Stand liefert get() null und die Indexmiete sagt,
   dass die Reihe fehlt (kein Platzhalterwert).

   Die Rechenkerne (js/indexmiete.js) bekommen die Reihe als PARAMETER.
   Im QC-/Marktbericht-iframe liest das Modul die Reihe der Eltern-App.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var SCHLUESSEL = 'dp_indexreihen_v1';
  var TAG_MS = 24 * 3600 * 1000;
  var _daten = null, _laedt = null;

  function eltern() { try { return global.parent && global.parent !== global ? global.parent : null; } catch (e) { return null; } }
  function ausSpeicher() {
    try { var s = global.localStorage.getItem(SCHLUESSEL); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function inSpeicher(o) { try { global.localStorage.setItem(SCHLUESSEL, JSON.stringify(o)); } catch (e) {} }

  function laden(erzwingen) {
    if (_laedt) return _laedt;
    var w = eltern();
    if (w && w.DpIndexreihen && w.DpIndexreihen !== api) {
      _daten = w.DpIndexreihen.get(); return Promise.resolve(_daten);
    }
    var lok = ausSpeicher();
    if (lok && lok.daten && !_daten) _daten = lok.daten;
    if (!erzwingen && lok && lok.geholt && Date.now() - lok.geholt < TAG_MS) return Promise.resolve(_daten);
    var A = global.Auth;
    if (!A || typeof A.apiCall !== 'function') return Promise.resolve(_daten);
    var tok = null; try { tok = global.localStorage.getItem('ji_token'); } catch (e) {}
    if (!tok) return Promise.resolve(_daten);   /* nicht angemeldet: kein Abruf, kein 401 */
    _laedt = A.apiCall('/marktbericht/indexreihen', { method: 'GET' }).then(function (r) {
      _laedt = null;
      if (r && r.reihen && r.reihen.vpi) {
        _daten = r; inSpeicher({ geholt: Date.now(), etag: r.etag || null, stand: r.stand || null, daten: r });
        try { global.dispatchEvent(new CustomEvent('dp:indexreihen', { detail: { stand: r.stand } })); } catch (e) {}
      }
      return _daten;
    }).catch(function () { _laedt = null; return _daten; });
    return _laedt;
  }

  /** gesamte Antwort oder null */
  function get() { if (!_daten) { var l = ausSpeicher(); if (l && l.daten) _daten = l.daten; } if (!_daten) laden(); return _daten; }
  /** eine Reihe ('vpi' | 'nkm' | 'bpi') als { monate, basis, bis, stand } oder null */
  function reihe(k) { var d = get(); var r = d && d.reihen ? d.reihen[k] : null; return r ? Object.assign({ stand: d.stand || null }, r) : null; }

  var api = { laden: laden, get: get, reihe: reihe, SCHLUESSEL: SCHLUESSEL };
  global.DpIndexreihen = api;
  if (global.document && global.document.readyState !== 'loading') setTimeout(function () { laden(); }, 1500);
  else if (global.document) global.document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { laden(); }, 1500); });
})(window);
