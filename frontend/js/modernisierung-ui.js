/* js/modernisierung-ui.js — v3660 · WORAUF SICH DIE RESTNUTZUNGSDAUER STÜTZT (Reiter Objekt)
 * ═══════════════════════════════════════════════════════════════════════════
 * Zeigt unter „Modernisierungsgrad (Anlage 2)" die Grundlage der Punkte, wenn keine
 * eingetragen sind (Rangfolge: js/modernisierung-herkunft.js), mit den Gewerken zum
 * Aufklappen, und leitet sie ab:
 *   - aus dem Exposé (ausExpose: KI-Belege + Textmuster, je Gewerk mit Zitat)
 *   - aus den Objektfotos (ausBildern: /ai/extract-zustand-bilder, bis 8 Bilder,
 *     verkleinert, EINMAL je Bildsatz - das Ergebnis liegt im Objekt, Feld mod_ableitung)
 * Ergebnis je Gewerk kombiniert (Marcel 17.11.2026: „Er soll gucken, was Mehrwert gibt").
 * Ist der Zustand leer, wird er vorbelegt (Feld ds2_zustand, Kennung ds2_zustand_quelle
 * = text/bilder); jede Hand-Auswahl macht ihn zur eigenen Angabe.
 * Rechnet nichts: die Punkte gehen an rnd-calc.js / den Marktbericht.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var M = function () { return window.DpModernisierung || null; };
  var GEW = ['dach', 'fenster', 'leitungen', 'heizung', 'aussenwand', 'baeder', 'innenausbau', 'grundriss'];
  var LAB = { dach: 'Dach', fenster: 'Fenster', leitungen: 'Leitungen', heizung: 'Heizung', aussenwand: 'Außenwand', baeder: 'Bäder', innenausbau: 'Innenausbau', grundriss: 'Grundriss' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function setze(id, v) { var e = $(id); if (!e) return; if (String(e.value) === String(v)) return; e.value = v; try { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} }

  function roh() {
    var s = val('mod_ableitung'); if (!s) return null;
    try { var o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  }
  function stichtagJahr() { var w = val('wertermittlungsstichtag'); var j = parseInt(w.slice(0, 4), 10); return j > 1900 ? j : new Date().getFullYear(); }

  /* Text- und Bildbefunde neu kombinieren (Baujahr/Energieklasse koennen sich geaendert haben) */
  function neuKombinieren(r) {
    var D = M(); if (!D || !r) return r;
    var k = D.kombinieren({ text: r.roh && r.roh.text || [], fotos: r.roh && r.roh.fotos || {},
      baujahr: val('baujahr'), stichtag_jahr: stichtagJahr(), energieklasse: val('ds2_energie') });
    var aus = k ? k : { punkte: null, gewerke: null };
    aus.roh = r.roh || {};
    return aus;
  }
  function speichern(r) { setze('mod_ableitung', r ? JSON.stringify(r) : ''); }

  /* Zustand vorbelegen - nur, wenn er leer ist oder selbst schon abgeleitet war */
  function zustandVorbelegen(r, quelle) {
    var D = M(); if (!D || !r || r.punkte == null) return;
    var q = val('ds2_zustand_quelle');
    if (val('ds2_zustand') && q !== 'bilder' && q !== 'text') return;
    /* v3660f · Marcel: „Wenn Zustand im Text, dann den nehmen" - Bilder ueberschreiben keinen Zustand aus dem Exposé */
    if (val('ds2_zustand') && q === 'text' && quelle === 'bilder') return;
    setze('ds2_zustand_quelle', quelle);
    setze('ds2_zustand', D.zustandAusPunkten(r.punkte));
  }

  function eigeneHerkunft() {
    var mp = val('mod_punkte');
    var n = GEW.reduce(function (a, k) { var v = val('mod_' + k); return a + (v ? 1 : 0); }, 0);
    var q = val('mod_quelle');
    return { mod_punkte: mp === '' ? null : mp, mod_angaben: n,
             mod_punkte_herkunft: mp === '' ? null : (q === 'einheiten' ? 'mfh' : (n ? 'gewerke' : 'eigene_angabe')) };
  }

  function bestimmen() {
    var D = M(); if (!D) return null;
    var e = eigeneHerkunft(), r = roh();
    return D.bestimmen({ mod_punkte: e.mod_punkte, mod_punkte_herkunft: e.mod_punkte_herkunft, mod_angaben: e.mod_angaben,
      zustand: val('ds2_zustand'), zustand_quelle: val('ds2_zustand_quelle') || 'eigene',
      ableitung: r && r.punkte != null ? r : null, baujahr: val('baujahr'), stichtag_jahr: stichtagJahr(), energieklasse: val('ds2_energie') });
  }

  function anzeigen() {
    var box = $('mod_herkunft'); if (!box) return;
    var b = bestimmen(); if (!b) { box.innerHTML = ''; return; }
    var html = '';
    if (b.herkunft === 'eigene') {
      html = '<span>Grundlage der Restnutzungsdauer: eigene Angabe (' + esc(b.punkte) + ' Punkte).</span>';
    } else {
      var _ann = b.annahme_satz || '';
      var _haupt = _ann ? String(b.satz).replace(' ' + _ann, '') : b.satz;
      html = '<span><b>Grundlage der Restnutzungsdauer:</b> ' + esc(_haupt) + '</span>';
      if (b.gewerke && b.herkunft === 'abgeleitet') {
        html += '<details style="margin-top:3px"><summary style="cursor:pointer">Gewerke ansehen</summary><ul style="margin:4px 0 0 16px;padding:0">'
          + GEW.map(function (k) { var g = b.gewerke[k]; if (!g) return '';
              return '<li>' + esc(LAB[k]) + ': ' + esc(String(g.punkte).replace('.', ',')) + ' Pkt. · '
                + esc(g.quelle === 'text' ? 'Exposé-Text' : (g.quelle === 'bild' ? 'Bilder' : 'angenommen')) + (g.wie ? ' (' + esc(g.wie) + ')' : '')
                + (g.beleg ? '<br><i>' + esc(g.beleg) + '</i>' : '') + (g.widerspruch ? '<br><b>Widerspruch:</b> ' + esc(g.widerspruch) : '') + '</li>'; }).join('')
          + '</ul></details>';
      }
      /* v3660a · Marcel: die Annahme steht immer sichtbar UNTEN, mit Sprung zum Einstellen je Gewerk */
      if (_ann) html += '<span id="mod_annahme" style="display:block;margin-top:4px">' + esc(_ann.replace(/ ?Den Zustand kannst du je Gewerk einstellen\.$/, ''))
        + ' <a href="#" id="mod_einstellen">Zustand je Gewerk einstellen</a></span>';
      else html += '<span style="display:block;margin-top:2px">Genauer: die acht Gewerke oben eintragen oder den Grad hier wählen.</span>';
    }
    var hatFotos = fotosQuelle().length > 0;
    if (hatFotos) html += '<button type="button" id="mod_bilder_knopf" class="btn-ghost" style="margin-top:4px;font-size:11px;padding:2px 8px">Zustand aus Bildern ' + (roh() && roh().roh && roh().roh.fotos_hash ? 'neu ' : '') + 'ableiten</button>';
    box.innerHTML = html;
    var kn = $('mod_bilder_knopf'); if (kn) kn.onclick = function () { ausBildern(true); };
    var ke = $('mod_einstellen'); if (ke) ke.onclick = function (ev) { ev.preventDefault(); var f = $('mod_dach'); if (f) { f.scrollIntoView({ block: 'center' }); try { f.focus(); } catch (x) {} } };
    var zh = $('ds2_zustand_herkunft');
    if (zh) {
      var q = val('ds2_zustand_quelle'), r = roh();
      var _abg = val('ds2_zustand') && (q === 'bilder' || q === 'text');
      var _t1 = _abg ? ((q === 'bilder' ? 'aus Bildern abgeleitet' : 'aus dem Exposé abgeleitet') + ' · jederzeit änderbar') : '';
      /* v3660f · Detailstufe 1: dort ist der Block Sach- und Ertragswert ausgeblendet. Die Grundlage der
         Restnutzungsdauer steht deshalb auch hier, kurz, mit dem Zustand als Weg zum Genauer-Machen. */
      var _b1 = bestimmen(), _t2 = '';
      if (_b1 && _b1.herkunft !== 'eigene' && _b1.herkunft !== 'zustand' && _b1.herkunft !== 'jung') {
        _t2 = 'Restnutzungsdauer: ' + (_b1.herkunft === 'abgeleitet' ? _b1.kurz : (_b1.grad + ' angenommen, keine Angabe' + (_b1.herkunft === 'rueckfall_energie' ? ' (nach Energieklasse)' : '')))
          + ' (' + _b1.punkte + ' Punkte). Mit dem Zustand hier oder je Gewerk genauer.';
      }
      /* v3990 · Marcel 23.11.2026: der Satz zur Restnutzungsdauer steht nicht mehr unter dem Feld,
         sondern im Tooltip eines kleinen Info-Symbols am Label (gemessen: der Hinweis nahm 100 von
         194 px der Gruppe Zustand ein). Antippen klappt ihn unter dem Feld auf (Handy hat kein Hover). */
      var _lab = zh.parentElement && zh.parentElement.querySelector('label');
      var ic = $('ds2_zustand_rnd_info');
      if (!ic && _lab) {
        ic = document.createElement('span');
        ic.id = 'ds2_zustand_rnd_info'; ic.className = 'dp-rnd-info'; ic.textContent = 'i';
        ic.setAttribute('role', 'button'); ic.setAttribute('tabindex', '0');
        var _schalten = function (ev) { ev.preventDefault(); ev.stopPropagation(); ic._offen = !ic._offen; anzeigen(); };
        ic.addEventListener('click', _schalten);
        ic.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') _schalten(ev); });
        var _tipBtn = _lab.querySelector('.dp-tip');
        if (_tipBtn && _tipBtn.nextSibling) _lab.insertBefore(ic, _tipBtn.nextSibling); else _lab.appendChild(ic);
      }
      if (ic) {
        ic.style.display = _t2 ? '' : 'none';
        ic.title = _t2; ic.setAttribute('aria-label', _t2 || 'Restnutzungsdauer');
        if (!_t2) ic._offen = false;
      }
      zh.textContent = [_t1, ic && ic._offen ? _t2 : (ic ? '' : _t2)].filter(Boolean).join(' ');
      zh.style.display = zh.textContent ? 'block' : 'none';
      /* v3660d · Begruendung dezent im Tooltip (Bildbeschreibung bzw. belegte Gewerke), keine laute Flaeche */
      var _tip = '';
      if (_abg && r && r.gewerke) _tip = GEW.map(function (k) { var g = r.gewerke[k]; return g && g.quelle !== 'angenommen' ? LAB[k] + ': ' + (g.beleg || g.wie || '') : null; }).filter(Boolean).join(' · ');
      if (_abg && r && r.roh && r.roh.fotos_text) _tip = r.roh.fotos_text + (_tip ? ' · ' + _tip : '');
      zh.title = _tip;
    }
  }

  /* ── Exposé ─────────────────────────────────────────────────────────── */
  /* v3660a · nur berechnen (fuer die Uebernahme mit Haken), nichts schreiben */
  function ausExposeBerechnen(text, extracted) {
    var D = M(); if (!D) return null;
    var sj = stichtagJahr();
    var ki = D.normListe((extracted && extracted.modernisierungen) || [], text);
    var muster = D.ausText(text || '', { stichtag_jahr: sj });
    var hat = {}; ki.forEach(function (t) { hat[t.gewerk + '|' + t.art] = 1; });
    var liste = ki.concat(muster.filter(function (t) { return !hat[t.gewerk + '|' + t.art]; }));
    var bj = (extracted && extracted.baujahr) || val('baujahr'), ek = (extracted && extracted.energieklasse) || val('ds2_energie');
    var k = D.kombinieren({ text: liste, baujahr: bj, stichtag_jahr: sj, energieklasse: ek });
    if (!k) return null;
    k.roh = { text: liste };
    return k;
  }
  /* v3660a · aus der Uebernahme: Ableitung ins Objekt (Text-Befunde, Bild-Befunde bleiben erhalten) */
  function uebernehmen(k, zustandMit) {
    if (!k || !k.roh) return false;
    var r = roh() || { roh: {} }; r.roh = r.roh || {};
    r.roh.text = k.roh.text || [];
    r = neuKombinieren(r);
    speichern(r);
    if (zustandMit && r.punkte != null) zustandVorbelegen(r, 'text');
    anzeigen();
    return true;
  }
  function zustandUebernehmen(wert, quelle) {
    if (!wert) return false;
    var q = val('ds2_zustand_quelle');
    if (val('ds2_zustand') && q !== 'bilder' && q !== 'text' && q !== '') return false;   /* eigene Auswahl bleibt */
    setze('ds2_zustand_quelle', quelle || 'text');
    setze('ds2_zustand', wert);
    anzeigen();
    return true;
  }
  function ausExpose(text, extracted) {
    var D = M(); if (!D) return null;
    var sj = stichtagJahr();
    var ki = D.normListe((extracted && extracted.modernisierungen) || [], text);
    var muster = D.ausText(text || '', { stichtag_jahr: sj });
    /* KI-Belege zuerst; die Textmuster ergaenzen Gewerke, zu denen die KI nichts lieferte */
    var hat = {}; ki.forEach(function (t) { hat[t.gewerk + '|' + t.art] = 1; });
    var liste = ki.concat(muster.filter(function (t) { return !hat[t.gewerk + '|' + t.art]; }));
    var r = roh() || { roh: {} }; r.roh = r.roh || {};
    r.roh.text = liste;
    r = neuKombinieren(r);
    speichern(r);
    if (r.punkte != null) zustandVorbelegen(r, 'text');
    anzeigen();
    return r;
  }

  /* ── Bilder ─────────────────────────────────────────────────────────── */
  function fotosQuelle() {
    var q = [];
    try { q = (typeof window.dpGetImgs === 'function' ? window.dpGetImgs() : []) || []; } catch (e) { q = []; }
    return q.map(function (i) { return i && i.src; }).filter(function (s) { return typeof s === 'string' && s.indexOf('data:image') === 0; }).slice(0, 8);
  }
  function hash(liste) {
    var h = 0, s = liste.map(function (x) { return x.length + ':' + x.slice(-120); }).join('|');
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return liste.length + '-' + (h >>> 0).toString(36);
  }
  var _laeuft = false;
  async function ausBildern(erzwingen) {
    if (_laeuft) return null;
    var D = M(); var src = fotosQuelle();
    if (!D || !src.length || !window.Auth || typeof Auth.apiCall !== 'function') return null;
    var hs = hash(src), r = roh() || { roh: {} }; r.roh = r.roh || {};
    if (!erzwingen && r.roh.fotos_hash === hs) return r;   /* dieser Bildsatz ist schon ausgewertet */
    _laeuft = true;
    var box = $('mod_herkunft'); if (box) box.insertAdjacentHTML('beforeend', '<span id="mod_bilder_lauf" style="display:block">Bilder werden ausgewertet …</span>');
    try {
      var klein = [];
      for (var i = 0; i < src.length; i++) {
        try { var k = typeof window._dpResizeDataUrl === 'function' ? await window._dpResizeDataUrl(src[i], 768, 0.72) : src[i]; if (k) klein.push(k); } catch (e) {}
      }
      var a = await Auth.apiCall('/ai/extract-zustand-bilder', { method: 'POST', timeout: 120000, body: { fotos: klein, baujahr: val('baujahr') } });
      if (!a || !a.success) throw new Error((a && a.error) || 'keine Auswertung');
      r = roh() || { roh: {} }; r.roh = r.roh || {};
      r.roh.fotos = D.normFotos(a.gewerke || {});
      r.roh.fotos_hash = hs; r.roh.fotos_text = a.gesamteindruck || ''; r.roh.fotos_am = new Date().toISOString().slice(0, 10);
      r = neuKombinieren(r);
      speichern(r);
      if (r.punkte != null) zustandVorbelegen(r, (r.quellen || []).indexOf('text') >= 0 ? 'text' : 'bilder');
      try { if (window._currentObjKey && typeof window.saveObj === 'function') await window.saveObj({ silent: true }); } catch (e) {}
      return r;
    } catch (e) {
      try { if (typeof window.toast === 'function') window.toast('Zustand aus Bildern: ' + ((e && e.message) || 'nicht auswertbar')); } catch (x) {}
      return null;
    } finally {
      _laeuft = false; var l = $('mod_bilder_lauf'); if (l) l.remove(); anzeigen();
    }
  }
  /* automatisch: neuer Bildsatz am geladenen Objekt (nicht in Aufnahme-/Messe-Laeufen) */
  var _t = null;
  function vielleichtAuto() {
    if (/messe|drehbuch|aufnahme|nokiauto/i.test(location.search + location.hash)) return;
    if (!fotosQuelle().length) return;   /* v3660f: auch am neuen Objekt (Exposé-Bilder vor dem ersten Speichern) */
    if (window._dpPaketLaeuft) return;
    clearTimeout(_t); _t = setTimeout(function () { ausBildern(false); }, 4000);
  }

  function init() {
    if (!$('mod_punkte')) return;
    ['mod_punkte', 'baujahr', 'ds2_energie', 'ds2_zustand', 'wertermittlungsstichtag'].concat(GEW.map(function (k) { return 'mod_' + k; })).forEach(function (id) {
      var e = $(id); if (!e) return;
      e.addEventListener('change', function (ev) {
        if (id === 'ds2_zustand' && ev.isTrusted) {
          setze('ds2_zustand_quelle', 'eigene');
          try { if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (x) {}   /* v3660a: Kennzeichnung sofort weg */
        }
        if ((id === 'baujahr' || id === 'ds2_energie') && roh()) speichern(neuKombinieren(roh()));
        anzeigen();
      });
    });
    window.addEventListener('dp:object-ready', function () { setTimeout(anzeigen, 300); vielleichtAuto(); });
    var grid = $('img-grid');
    if (grid && window.MutationObserver) new MutationObserver(function () { anzeigen(); vielleichtAuto(); }).observe(grid, { childList: true });
    anzeigen();
  }
  /* v3660a · Sprung zum Feld Zustand (aus dem Deal-Score-2-Kriterium „Bausubstanz") */
  window._dpZustandEinstellen = function (ev) {
    try { if (ev) { ev.preventDefault(); ev.stopPropagation(); } } catch (x) {}
    var z = $('ds2_zustand'); if (z) { z.scrollIntoView({ block: 'center' }); try { z.focus(); } catch (x) {} }
    return false;
  };
  window.DpModUI = { anzeigen: anzeigen, ausExpose: ausExpose, ausExposeBerechnen: ausExposeBerechnen, uebernehmen: uebernehmen, zustandUebernehmen: zustandUebernehmen, ausBildern: ausBildern, bestimmen: bestimmen, eigeneHerkunft: eigeneHerkunft };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
