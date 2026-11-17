/* js/qc-zustand-bilder.js — v3660f · ZUSTAND AUS DEN FOTOS IM QUICK-CHECK
 * ═══════════════════════════════════════════════════════════════════════════
 * Marcel 17.11.2026: „Er soll aus den Bildern den Zustand ableiten und setzen, bitte mit
 * Text daneben. Wenn Zustand im Text, dann den nehmen."
 *
 * Laeuft im iframe-Dokument quickcheck-app.html (eigenes Dokument, erbt nichts):
 *   - beobachtet #photo-grid (eigene Fotos und Exposé-Bilder des QC-Imports)
 *   - neuer Bildsatz (Pruefsumme) -> POST /api/v1/ai/extract-zustand-bilder (bis 8 Bilder,
 *     auf 768 px verkleinert; KI-Deckel Gruppe Dokument-Auswertungen), EINMAL je Bildsatz
 *   - Ergebnis je Gewerk -> DpModernisierung.kombinieren -> #qc_mod_ableitung (JSON)
 *   - #qc_zustand wird nur vorbelegt, wenn er leer ist oder selbst aus Bildern stammt;
 *     ein selbst gewaehlter oder aus dem Exposé uebernommener Zustand bleibt
 *   - darunter dezent (.cf-hint) „aus Bildern abgeleitet · jederzeit änderbar", Begruendung im Tooltip
 * Rechnet nichts: die Punkte gehen ueber die Rangfolge in den Pruefstein und die Marktbewertung.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LAB = { dach: 'Dach', fenster: 'Fenster', leitungen: 'Leitungen', heizung: 'Heizung', aussenwand: 'Außenwand', baeder: 'Bäder', innenausbau: 'Innenausbau', grundriss: 'Grundriss' };
  function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function setze(id, v) { var e = $(id); if (!e || String(e.value) === String(v)) return; e.value = v; try { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} }
  function versteckt(id) {
    var e = $(id); if (e) return e;
    e = document.createElement('input'); e.type = 'hidden'; e.id = id;
    var z = $('qc_zustand'); (z && z.parentNode ? z.parentNode : document.body).appendChild(e);
    return e;
  }
  function hinweis() {
    var h = $('qc_zustand_herkunft'); if (h) return h;
    var z = $('qc_zustand'); if (!z || !z.parentNode) return null;
    h = document.createElement('small'); h.id = 'qc_zustand_herkunft'; h.className = 'cf-hint';
    h.style.display = 'block'; h.style.marginTop = '3px';
    z.parentNode.appendChild(h);
    return h;
  }
  function ableitung() { try { var s = val('qc_mod_ableitung'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  function anzeigen() {
    var h = hinweis(); if (!h) return;
    var q = val('qc_zustand_quelle'), a = ableitung();
    var ausBild = val('qc_zustand') && q === 'bilder';
    h.textContent = ausBild ? 'aus Bildern abgeleitet · jederzeit änderbar' : (a && a.punkte != null && q !== 'bilder' ? 'Bilder ausgewertet, dein Zustand gilt' : '');
    var tip = '';
    if (a && a.gewerke) tip = Object.keys(LAB).map(function (k) { var g = a.gewerke[k]; return g && g.quelle === 'bild' ? LAB[k] + ': ' + (g.beleg || g.wie || '') : null; }).filter(Boolean).join(' · ');
    if (a && a.roh && a.roh.fotos_text) tip = a.roh.fotos_text + (tip ? ' · ' + tip : '');
    h.title = tip;
  }

  function bilder() {
    return Array.prototype.slice.call(document.querySelectorAll('#photo-grid img'))
      .map(function (i) { return i.getAttribute('src') || ''; })
      .filter(function (s) { return s.indexOf('data:image') === 0; }).slice(0, 8);
  }
  function pruefsumme(l) {
    var h = 0, s = l.map(function (x) { return x.length + ':' + x.slice(-120); }).join('|');
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return l.length + '-' + (h >>> 0).toString(36);
  }
  function verkleinern(src) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        try {
          var f = Math.min(1, 768 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.72));
        } catch (e) { res(null); }
      };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }
  var _laeuft = false, _t = null;
  async function auswerten() {
    var D = window.DpModernisierung, src = bilder();
    if (!src.length) {   /* keine Bilder (mehr): keine Bildableitung stehen lassen */
      if (val('qc_mod_ableitung')) { versteckt('qc_mod_ableitung').value = ''; if (val('qc_zustand_quelle') === 'bilder') versteckt('qc_zustand_quelle').value = ''; anzeigen(); }
      return;
    }
    if (!D || _laeuft) return;
    var hs = pruefsumme(src), a = ableitung();
    if (a && a.roh && a.roh.fotos_hash === hs) return;   /* dieser Bildsatz ist ausgewertet */
    var tok = null; try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    if (!tok) return;
    _laeuft = true;
    var h = hinweis(); if (h) h.textContent = 'Bilder werden ausgewertet …';
    try {
      var klein = [];
      for (var i = 0; i < src.length; i++) { var k = await verkleinern(src[i]); if (k) klein.push(k); }
      var r = await fetch('/api/v1/ai/extract-zustand-bilder', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ fotos: klein, baujahr: val('qc_bj') }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.success) throw new Error(j.error || ('Status ' + r.status));
      var fotos = D.normFotos(j.gewerke || {});
      var komb = D.kombinieren({ text: [], fotos: fotos, baujahr: val('qc_bj'), energieklasse: val('qc_energieklasse') });
      if (!komb) { versteckt('qc_mod_ableitung').value = JSON.stringify({ roh: { fotos_hash: hs, fotos: fotos, fotos_text: j.gesamteindruck || '' } }); return; }
      komb.roh = { fotos: fotos, fotos_hash: hs, fotos_text: j.gesamteindruck || '' };
      setze(versteckt('qc_mod_ableitung').id, JSON.stringify(komb));
      /* Zustand nur, wenn leer oder selbst aus Bildern; ein eigener oder Exposé-Zustand bleibt */
      if (!val('qc_zustand') || val('qc_zustand_quelle') === 'bilder') {
        var z = D.zustandAusPunkten(komb.punkte);
        if (z === 'renovierungsbeduerftig') z = 'normal';   /* der Quick-Check fuehrt nur gut / mittel / sanierungsbeduerftig */
        if (z === 'neubau') z = 'gut';
        setze(versteckt('qc_zustand_quelle').id, 'bilder');
        setze('qc_zustand', z);
      }
    } catch (e) {
      if (h) h.textContent = '';
      try { console.warn('[qc-zustand-bilder]', e && e.message); } catch (x) {}
    } finally {
      _laeuft = false; anzeigen();
      try { var kp = $('qc_kp'); if (kp) kp.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {}   /* Bewertung neu */
    }
  }
  function init() {
    versteckt('qc_zustand_quelle'); versteckt('qc_mod_ableitung');
    var z = $('qc_zustand');
    if (z) z.addEventListener('change', function (ev) { if (ev.isTrusted) { $('qc_zustand_quelle').value = 'eigene'; anzeigen(); } });
    var g = $('photo-grid');
    if (g && window.MutationObserver) new MutationObserver(function () { clearTimeout(_t); _t = setTimeout(auswerten, 2500); }).observe(g, { childList: true });
    anzeigen();
  }
  window.QcZustandBilder = { auswerten: auswerten, anzeigen: anzeigen };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
