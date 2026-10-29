/* ============================================================================
   DealPilot v3034 — objekt-bloecke.js · Reiter Objekt: Blöcke nach Objektart,
   Bauteile auf Häkchen, Wertermittlungsstichtag = wirtschaftlicher Übergang

   Marcel 29.10.2026:
   - „Gebäudeart nach NHK 2010 nur bei Ein- und Zweifamilienhäusern anzeigen"
     → #nhk-haus-block nur bei EFH, ZFH, DHH, RH (die NHK 2010 kennen die
       Hausform nur dort; MFH/ETW hatten bisher einen leeren Block mit Erklärung).
   - „Besondere und sonstige Bauteile nur über Checkbox anzeigen"
     → #btl-block nur bei Haken #btl_an; der Haken setzt sich selbst, sobald ein
       Bauteil-Wert gespeichert ist (nichts verschwindet unbemerkt).
   - „Wertermittlungsstichtag immer den wirtschaftlichen Übergang eintragen, Standard"
     → leerer Stichtag bekommt den Übergang (nicht in der Zukunft - § 2 Abs. 4
       ImmoWertV, der Bericht nimmt keinen künftigen Stichtag). Folgt der Stichtag
       bisher dem Übergang, zieht er bei dessen Änderung mit; ein eigenes Datum bleibt.
   ============================================================================ */
(function () {
  'use strict';
  if (window._dpObjektBloecke) return;
  window._dpObjektBloecke = true;

  var HAUS = { EFH: 1, ZFH: 1, DHH: 1, RH: 1 };
  var BTL = ['bes_bauteile', 'btl_gauben', 'btl_balkone', 'btl_vordach', 'btl_terrassen', 'btl_sonstige'];
  function $(id) { return document.getElementById(id); }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function nhk() {
    var b = $('nhk-haus-block'), a = $('objart');
    if (b) b.style.display = (a && HAUS[a.value]) ? '' : 'none';
  }
  function btl(vonLaden) {
    var cb = $('btl_an'), b = $('btl-block');
    if (!cb || !b) return;
    if (vonLaden && !cb.checked && BTL.some(function (id) { var e = $(id); return e && String(e.value || '').trim() !== '' && parseFloat(String(e.value).replace(',', '.')) !== 0; })) cb.checked = true;
    b.style.display = cb.checked ? '' : 'none';
  }
  var _uebAlt = null;
  function stichtag(ausUebergang) {
    var w = $('wertermittlungsstichtag'), u = $('wirtschaftlicher_uebergang');
    if (!w || !u) return;
    var uv = String(u.value || '');
    var ok = /^\d{4}-\d{2}-\d{2}$/.test(uv) && uv <= heute();
    var leer = String(w.value || '') === '';
    var folgte = _uebAlt != null && w.value === _uebAlt;
    if (ok && (leer || (ausUebergang && folgte))) {
      w.value = uv;
      try { w.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }
    _uebAlt = uv || null;
  }
  function alles(vonLaden) { nhk(); btl(vonLaden); stichtag(false); }

  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t) return;
    if (t.id === 'objart') nhk();
    else if (t.id === 'btl_an') btl(false);
    else if (t.id === 'wirtschaftlicher_uebergang') stichtag(true);
  }, true);
  window.addEventListener('dp:object-ready', function () { _uebAlt = null; setTimeout(function () { alles(true); }, 400); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { alles(true); });
  else setTimeout(function () { alles(true); }, 300);
  window.DealPilotObjektBloecke = { anwenden: alles };
})();
