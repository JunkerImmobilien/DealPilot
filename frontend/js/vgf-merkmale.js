'use strict';
/* ============================================================================
   v3008 · MERKMALE DES GUTACHTERAUSSCHUSSES FUER VERGLEICHSFAKTOREN
   ----------------------------------------------------------------------------
   Manche Ausschuesse beschliessen ihre Vergleichsfaktoren je KLASSE, die nur
   sie selbst vergeben - Konstanz z. B. je Wohnlage (Lageklasse der
   Bodenrichtwertkarte) und Ausstattungsklasse (eigener Merkmalskatalog).
   DealPilot rechnet sie nur mit diesen Klassen - nie aus der eigenen
   Lageeinschaetzung umgedeutet.

   Die Felder `vgf_wohnlage` und `vgf_ausstattung` (Reiter Objekt, Block
   Wertermittlung) erscheinen NUR, wenn der fuer das Objekt geltende
   Registersatz das Merkmal fuehrt. Gefragt wird die Leseroutine selbst
   (/marktbericht/register/probe, kennzahl vergleichsfaktor): sie meldet
   `merkmal_fehlt` mit Klassen, Wortlaut und Link des Ausschusses. Klassen
   und Hilfetexte kommen damit aus dem SATZ, nicht aus dieser Datei.

   Gespeichert wird im versteckten Feld (storage.js WM_FIELDS), das
   Auswahlfeld wird aus den Klassen gebaut - so geht ein gespeicherter Wert
   nicht verloren, wenn die Klassen erst nach dem Laden kommen.
   ============================================================================ */
(function (global) {
  var FELDER = ['vgf_wohnlage', 'vgf_ausstattung'];
  var _agsLauf = {};
  var _letzt = '';
  var _timer = null;

  function $(id) { return document.getElementById(id); }
  function wert(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(pfad, opt) {
    if (!global.Auth || typeof global.Auth.apiCall !== 'function') return Promise.resolve(null);
    return global.Auth.apiCall(pfad, opt || {}).catch(function () { return null; });
  }

  /* Die Gemeindekennzahl liefert derselbe Weg wie potenzial.js (Zinssatz-Auskunft, lesend). */
  function agsHolen(plz) {
    var p = global._dpPotenzial;
    if (p && p.plz === plz && p.ags) return Promise.resolve(String(p.ags));
    if (_agsLauf[plz]) return _agsLauf[plz];
    _agsLauf[plz] = api('/marktbericht/wertparameter/zinssatz', { method: 'POST',
      body: { object: { plz: plz, ort: wert('ort'), objart: wert('objart') } } })
      .then(function (r) { return r && r.ags ? String(r.ags) : null; });
    return _agsLauf[plz];
  }

  function objektartCode() {
    var a = wert('objart').toUpperCase();
    if (a === 'ETW') return 'etw';
    if (a === 'MFH') return 'mfh';
    if (a === 'DHH' || a === 'RH') return 'rhdhh';
    if (a === 'EFH' || a === 'ZFH') return 'ezfh';
    return a.toLowerCase();
  }

  function verstecken() {
    FELDER.forEach(function (f) { var w = $(f + '_feld'); if (w) w.style.display = 'none'; });
  }

  function zeigen(m) {
    var w = $(m.feld + '_feld'), sel = $(m.feld + '_wahl'), ver = $(m.feld), hl = $(m.feld + '_hilfe');
    if (!w || !sel || !ver) return;
    var klassen = Array.isArray(m.klassen) ? m.klassen : [];
    var html = '<option value="">' + (m.feld === 'vgf_wohnlage'
      ? '– leer = aus der Bodenrichtwertkarte, sonst kein Wert –' : '– keine Angabe, dann kein Vergleichsfaktor –') + '</option>';
    klassen.forEach(function (k) { html += '<option value="' + esc(k) + '">' + esc(k) + '</option>'; });
    sel.innerHTML = html;
    sel.value = klassen.indexOf(ver.value) >= 0 ? ver.value : '';
    if (hl) {
      hl.innerHTML = esc(m.hilfe || '') + (m.url ? ' <a href="' + esc(m.url) + '" target="_blank" rel="noopener">Merkmale des Gutachterausschusses</a>' : '');
    }
    w.style.display = '';
  }

  function pruefen() {
    var plz = wert('plz');
    var art = objektartCode();
    var bj = wert('baujahr');
    var schl = [plz, art, bj].join('|');
    if (!plz || !art) { verstecken(); _letzt = ''; return; }
    if (schl === _letzt) return;
    _letzt = schl;
    agsHolen(plz).then(function (ags) {
      if (!ags || _letzt !== schl) { if (!ags) verstecken(); return null; }
      return api('/marktbericht/register/probe?kennzahl=vergleichsfaktor&ags=' + encodeURIComponent(ags)
        + '&objektart=' + encodeURIComponent(art) + (bj ? '&baujahr=' + encodeURIComponent(bj) : ''));
    }).then(function (r) {
      if (_letzt !== schl) return;
      var e = r && r.ergebnis;
      var fm = (e && Array.isArray(e.fehlende_merkmale)) ? e.fehlende_merkmale : [];
      verstecken();
      fm.forEach(function (m) { if (FELDER.indexOf(m.feld) >= 0) zeigen(m); });
    });
  }

  function planen() { clearTimeout(_timer); _timer = setTimeout(pruefen, 400); }

  function verdrahten() {
    FELDER.forEach(function (f) {
      var sel = $(f + '_wahl'), ver = $(f);
      if (sel && ver && !sel._vgfDran) {
        sel._vgfDran = true;
        sel.addEventListener('change', function () {
          ver.value = sel.value;
          try { ver.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          if (typeof global.calc === 'function') { try { global.calc(); } catch (e) {} }
        });
      }
    });
    ['plz', 'objart', 'baujahr', 'ort'].forEach(function (id) {
      var el = $(id);
      if (el && !el._vgfDran) { el._vgfDran = true; el.addEventListener('change', planen); }
    });
  }

  global.addEventListener('dp:object-ready', function () { _letzt = ''; verdrahten(); planen(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { verdrahten(); planen(); });
  else { verdrahten(); planen(); }
  global.DpVgfMerkmale = { pruefen: function () { _letzt = ''; pruefen(); } };
})(window);
