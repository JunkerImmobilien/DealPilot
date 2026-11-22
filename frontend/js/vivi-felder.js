'use strict';
/* ═══ js/vivi-felder.js — v3950 · VERKNUEPFTE FELDER: AUSGEGRAUT, HINWEIS, LOKAL UEBERSCHREIBEN ══════
 *
 * Marcel 22.11.2026: „Verknüpfte Felder sind ausgegraut. Beim Darüberfahren erscheint ein Hinweis:
 * verknüpft mit ViVi, Änderungen bitte in ViVi. Händisch anpassen geht, wird aber nicht nach ViVi
 * geschrieben.“
 *
 * Dieses Modul spricht NICHT mit dem Backend. js/vivi.js holt die Werte (GET /vivi/objekt/:id/werte) und
 * reicht sie an setzen(). Hier passiert nur:
 *   · der ViVi-Wert kommt ins Feld (ausser der Kunde hat ihn lokal ueberschrieben), danach wird wie immer
 *     gespeichert (saveObj). Ein zweiter Schreibweg in objects.data entsteht nicht.
 *   · das Feld wird gesperrt: readOnly, Klasse vivi-verknuepft, EIGENES Merkattribut data-vivi-ro (nicht
 *     data-mff-ro aus mfh-felder.js: wo beide sperren, hoebe sonst die eine Schicht die andere auf), title
 *     mit dem Hinweis, Selects mit pointer-events:none und tabindex -1.
 *   · ein Schloss am Feld loest es: der Wert gilt dann als eigene Angabe (_vivi.eigen), wird nie nach ViVi
 *     geschrieben, und der Hinweis nennt den ViVi-Wert daneben. Ein zweiter Klick nimmt den ViVi-Wert zurueck.
 *   · MFH: die Zellen der Einheitentabelle (#mfh-modal, data-i/data-k) und das Wohnungsfenster (#mfh-we-ov,
 *     data-i, data-wk) werden nach jedem Zeichnen neu gesperrt.
 *
 * Gespeichert im Objekt: _vivi (storage.js FIELDS, versteckt) = { verknuepft, stand, felder: {id: wert},
 * eigen: {id: wert} }. Massgeblich bleibt vivi_werte im Backend, _vivi ist der Spiegel fuer die Anzeige.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpViviFelder) return;
  var HINWEIS = 'Verknüpft mit ViVi, der Wert kommt aus ViVi, Änderungen bitte in ViVi.';
  var HINWEIS_LOESEN = 'Über das Schloss kannst du den Wert in DealPilot selbst festlegen. Er wird nicht nach ViVi übertragen.';
  var FRAGE_LOESEN = 'Diesen Wert in DealPilot selbst festlegen? Er wird nicht nach ViVi übertragen.';
  var FRAGE_ZURUECK = 'Den Wert aus ViVi wieder übernehmen?';
  /* Felder einer Einheit, die ViVi fuehrt (Schluessel wie in _mfh.einheiten[]) */
  var EINHEIT_FELDER = ['wfl', 'ist', 'status', 'nk_vorauszahlung', 'mv_beginn', 'mv_befristet_bis', 'mv_kaution', 'mv_letzte_erhoehung', 'mv_art', 'stellplatz_miete'];
  var ZAHL_FELDER = /^(kp|makler_p|gest_p|notar_p|gba_p|ji_p|wfl|nkm|nk_vorauszahlung|ze_stp_monat|mv_kaution|d[12]|d[12]z|d[12]t|ist|stellplatz_miete)$/;

  var SCHLOSS_ZU = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var SCHLOSS_OFFEN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/></svg>';
  var _stand = null;       // letzte Antwort von /werte
  var _aktiv = false;

  function $(id) { return document.getElementById(id); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s|€|%/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function alsText(feld, wert) {
    if (wert == null) return '';
    if (typeof wert === 'number') return Number.isInteger(wert) ? String(wert) : String(wert).replace('.', ',');
    return String(wert);
  }
  function gleich(feld, a, b) {
    var k = feld.split('.').pop();
    if (ZAHL_FELDER.test(k)) { var x = zahl(a), y = zahl(b); return x === y || (x != null && y != null && Math.abs(x - y) < 0.005); }
    return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  }
  function standText(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var z = function (n) { return ('0' + n).slice(-2); };
    return 'Stand ' + z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  /* ── _vivi im Objekt ─────────────────────────────────────────────── */
  function lesen() {
    var e = $('_vivi'); var v = null;
    try { v = e && e.value ? JSON.parse(e.value) : null; } catch (x) { v = null; }
    if (!v || typeof v !== 'object') v = {};
    if (!v.eigen || typeof v.eigen !== 'object') v.eigen = {};
    if (!v.felder || typeof v.felder !== 'object') v.felder = {};
    return v;
  }
  function schreiben(v) { var e = $('_vivi'); if (e) e.value = v && v.verknuepft ? JSON.stringify(v) : ''; }

  /* ── Sperre an einem Element ─────────────────────────────────────── */
  function sperreAn(el, feld, viviWert, eigen, stand) {
    if (!el) return;
    var istEigen = eigen && Object.prototype.hasOwnProperty.call(eigen, feld);
    if (istEigen) { sperreAus(el); el.classList.add('vivi-eigen'); }
    else {
      if (!el.hasAttribute('data-vivi-ro')) el.setAttribute('data-vivi-ro', el.readOnly ? '1' : '0');
      if (el.tagName === 'SELECT') { el.setAttribute('tabindex', '-1'); }
      else el.readOnly = true;
      el.classList.add('vivi-verknuepft');
      el.classList.remove('vivi-eigen');
      el.setAttribute('aria-readonly', 'true');
    }
    el.title = istEigen
      ? 'Eigene Angabe in DealPilot. ViVi führt ' + (alsText(feld, viviWert) || 'keinen Wert') + '. Dieser Wert wird nicht nach ViVi übertragen.'
      : HINWEIS + '\n' + HINWEIS_LOESEN + (stand ? '\n' + stand : '');
    schloss(el, feld, istEigen, viviWert);
  }
  function sperreAus(el) {
    if (!el) return;
    if (el.classList.contains('vivi-verknuepft')) {
      el.classList.remove('vivi-verknuepft');
      el.removeAttribute('aria-readonly');
      if (el.tagName === 'SELECT') el.removeAttribute('tabindex');
      else el.readOnly = el.getAttribute('data-vivi-ro') === '1';
      el.removeAttribute('data-vivi-ro');
    }
    el.classList.remove('vivi-eigen');
    if (/^(Verknüpft mit ViVi|Eigene Angabe in DealPilot)/.test(el.title || '')) el.title = '';
  }
  function schloss(el, feld, istEigen, viviWert) {
    var platz = el.parentNode; if (!platz) return;
    var b = platz.querySelector('.vivi-schloss[data-vivi-feld="' + feld + '"]');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button'; b.className = 'vivi-schloss'; b.setAttribute('data-vivi-feld', feld);
      el.insertAdjacentElement('afterend', b);
    }
    b.innerHTML = istEigen ? SCHLOSS_OFFEN : SCHLOSS_ZU;
    b.setAttribute('aria-label', istEigen ? 'ViVi-Wert wieder übernehmen' : 'Wert in DealPilot selbst festlegen');
    b.title = istEigen ? 'ViVi-Wert wieder übernehmen (' + (alsText(feld, viviWert) || 'leer') + ')' : FRAGE_LOESEN;
  }
  function schlossWeg(el) {
    var p = el && el.parentNode; if (!p) return;
    Array.prototype.forEach.call(p.querySelectorAll('.vivi-schloss'), function (b) { b.remove(); });
  }

  /* Eingaben in gesperrte Felder abfangen: andere Schichten (mfh-felder.js) setzen readOnly beim Loesen auf
     ihren eigenen Merker zurueck. Die Klasse bleibt, also haelt dieser Riegel. */
  ['beforeinput', 'paste', 'drop'].forEach(function (t) {
    document.addEventListener(t, function (ev) {
      var el = ev.target;
      if (el && el.classList && el.classList.contains('vivi-verknuepft')) { ev.preventDefault(); ev.stopPropagation(); }
    }, true);
  });
  document.addEventListener('keydown', function (ev) {
    var el = ev.target;
    if (!(el && el.classList && el.classList.contains('vivi-verknuepft'))) return;
    if (ev.key && (ev.key.length === 1 || ev.key === 'Backspace' || ev.key === 'Delete')) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);

  /* ── Werte setzen ────────────────────────────────────────────────── */
  function feldSetzen(id, wert) {
    var el = $(id); if (!el) return false;
    var t = alsText(id, wert);
    if (gleich(id, el.value, t)) return false;
    el.value = t;
    try { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); } catch (e) {}
    return true;
  }
  /* Index einer Einheit in _dpMfh: der beim Anlegen gemerkte, gegengeprueft ueber die Nummer */
  function einheitIndex(i, info) {
    var L = window._dpMfh && Array.isArray(window._dpMfh.einheiten) ? window._dpMfh.einheiten : null;
    if (!L) return null;
    var soll = info && info.einheiten && info.einheiten[i] && info.einheiten[i].nr;
    if (soll == null) return L[i] ? i : null;
    if (L[i] && String(L[i].nr || (i + 1)) === String(soll)) return i;
    for (var k = 0; k < L.length; k++) if (String(L[k].nr || (k + 1)) === String(soll)) return k;
    return null;
  }
  function einheitenSummen() {
    var L = window._dpMfh && Array.isArray(window._dpMfh.einheiten) ? window._dpMfh.einheiten : [];
    if (!L.length) return false;
    var fl = 0, ohne = 0, ist = 0;
    L.forEach(function (e) { var f = zahl(e.wfl); if (f > 0) fl += f; else ohne++; if (e.status !== 'leer') ist += zahl(e.ist) || 0; });
    var g = false;
    if (fl > 0 && !ohne) g = feldSetzen('wfl', Math.round(fl * 100) / 100) || g;
    if (ist > 0) g = feldSetzen('nkm', Math.round(ist * 100) / 100) || g;
    return g;
  }

  /**
   * stand = Antwort von GET /vivi/objekt/:id/werte. Setzt die Werte, sperrt die Felder, schreibt _vivi.
   * Gibt true zurueck, wenn sich am Objekt etwas geaendert hat (dann speichert js/vivi.js).
   */
  function setzen(stand) {
    _stand = stand || null;
    var v = lesen();
    if (!stand || !stand.verknuepft) { allesLoesen(true); return false; }
    _aktiv = true;
    var felder = stand.felder || {}, info = stand.info || {};
    var st = standText(stand.letzter_abruf);
    var geaendert = false, einheitGeaendert = false;
    v.verknuepft = true; v.stand = stand.letzter_abruf || null; v.felder = {};
    Object.keys(felder).forEach(function (id) {
      var w = felder[id] && felder[id].wert;
      v.felder[id] = w;
      var eigen = Object.prototype.hasOwnProperty.call(v.eigen, id);
      var m = /^einheit\.(\d+)\.(\w+)$/.exec(id);
      if (m) {
        if (eigen) return;
        var idx = einheitIndex(+m[1], info);
        var L = window._dpMfh && window._dpMfh.einheiten;
        if (idx == null || !L || !L[idx]) return;
        var t = alsText(m[2], w);
        if (!gleich(m[2], L[idx][m[2]], t)) { L[idx][m[2]] = t; einheitGeaendert = true; }
        return;
      }
      if (!eigen && feldSetzen(id, w)) geaendert = true;
      sperreAn($(id), id, w, v.eigen, st);
    });
    if (einheitGeaendert) { geaendert = true; einheitenSummen(); }
    /* Felder, die ViVi nicht mehr fuehrt, werden frei */
    Array.prototype.forEach.call(document.querySelectorAll('.vivi-verknuepft, .vivi-eigen'), function (el) {
      if (el.id && !Object.prototype.hasOwnProperty.call(felder, el.id) && !el.hasAttribute('data-vivi-zelle')) { sperreAus(el); schlossWeg(el); }
    });
    schreiben(v);
    if (geaendert) { try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} try { if (window.DpMfhFelder) window.DpMfhFelder.anwenden(); } catch (e) {} }
    einheitenSperren();
    return geaendert;
  }

  /* datenLeeren: nur wenn das Backend sagt, das Objekt ist nicht (mehr) verknuepft. Beim Objektwechsel fallen nur
     die Sperren im Formular, _vivi des neu geladenen Objekts (mit seinen eigenen Angaben) bleibt. */
  function allesLoesen(datenLeeren) {
    _aktiv = false;
    Array.prototype.forEach.call(document.querySelectorAll('.vivi-verknuepft, .vivi-eigen'), function (el) { sperreAus(el); schlossWeg(el); el.removeAttribute('data-vivi-zelle'); });
    if (datenLeeren) { var v = lesen(); if (v.verknuepft) { schreiben({}); return true; } }
    return false;
  }

  /* ── MFH: Tabelle und Wohnungsfenster ────────────────────────────── */
  function einheitSchluessel(i, k) {
    if (!_stand || !_stand.felder) return null;
    var info = _stand.info || {};
    /* Rueckwaerts: welcher ViVi-Index gehoert zur Einheit i in _dpMfh? */
    var ids = Object.keys(_stand.felder).filter(function (id) { return /^einheit\.\d+\./.test(id) && id.split('.')[2] === k; });
    for (var n = 0; n < ids.length; n++) { var vi = +ids[n].split('.')[1]; if (einheitIndex(vi, info) === i) return ids[n]; }
    return null;
  }
  function zelleSperren(el, i, k, stand) {
    var id = einheitSchluessel(i, k); var v = lesen();
    if (!id) { if (el.hasAttribute('data-vivi-zelle')) { sperreAus(el); schlossWeg(el); el.removeAttribute('data-vivi-zelle'); } return; }
    el.setAttribute('data-vivi-zelle', id);
    sperreAn(el, id, _stand.felder[id] && _stand.felder[id].wert, v.eigen, stand);
  }
  function einheitenSperren() {
    if (!_aktiv) return;
    var st = standText(_stand && _stand.letzter_abruf);
    var modal = $('mfh-modal');
    if (modal) Array.prototype.forEach.call(modal.querySelectorAll('[data-i][data-k]'), function (el) {
      var k = el.getAttribute('data-k'); if (EINHEIT_FELDER.indexOf(k) < 0) return;
      zelleSperren(el, +el.getAttribute('data-i'), k, st);
    });
    var ov = $('mfh-we-ov');
    if (ov && ov.hasAttribute('data-i')) {
      var i = +ov.getAttribute('data-i');
      Array.prototype.forEach.call(ov.querySelectorAll('[data-wk]'), function (el) {
        var k = el.getAttribute('data-wk'); if (EINHEIT_FELDER.indexOf(k) < 0) return;
        zelleSperren(el, i, k, st);
      });
    }
  }
  var _mt = null;
  function spaeter() { clearTimeout(_mt); _mt = setTimeout(einheitenSperren, 60); }
  var _beob = new WeakSet();
  function beobachten(el) {
    if (!el || _beob.has(el)) return;
    _beob.add(el);
    try { new MutationObserver(spaeter).observe(el, { childList: true, subtree: true }); } catch (e) {}
    spaeter();
  }
  try {
    new MutationObserver(function () { beobachten($('mfh-modal')); beobachten($('mfh-we-ov')); })
      .observe(document.body || document.documentElement, { childList: true });
  } catch (e) {}

  /* ── Schloss ─────────────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('.vivi-schloss') : null;
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var id = b.getAttribute('data-vivi-feld');
    var el = b.previousElementSibling;
    var v = lesen();
    var viviWert = _stand && _stand.felder && _stand.felder[id] ? _stand.felder[id].wert : v.felder[id];
    if (Object.prototype.hasOwnProperty.call(v.eigen, id)) {
      if (!window.confirm(FRAGE_ZURUECK)) return;
      delete v.eigen[id];
      schreiben(v);
      if (!/^einheit\./.test(id)) feldSetzen(id, viviWert);
      else if (el) { el.value = alsText(id, viviWert); try { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); } catch (e) {} }
      sperreAn(el, id, viviWert, v.eigen, standText(_stand && _stand.letzter_abruf));
    } else {
      if (!window.confirm(FRAGE_LOESEN)) return;
      v.eigen[id] = el ? el.value : null;
      schreiben(v);
      sperreAn(el, id, viviWert, v.eigen, '');
      try { if (el) el.focus(); } catch (e) {}
    }
    try { var h = $('_vivi'); if (h) h.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }, true);

  /* Eine eigene Angabe folgt der Eingabe (sonst stuende im Spiegel der Wert beim Loesen) */
  document.addEventListener('input', function (ev) {
    var el = ev.target; if (!el || !el.classList || !el.classList.contains('vivi-eigen')) return;
    var id = el.getAttribute('data-vivi-zelle') || el.id; if (!id) return;
    var v = lesen(); if (!Object.prototype.hasOwnProperty.call(v.eigen, id)) return;
    v.eigen[id] = el.value; schreiben(v);
  }, true);

  function stil() {
    if ($('vivi-felder-stil')) return;
    var s = document.createElement('style'); s.id = 'vivi-felder-stil';
    s.textContent = [
      'input.vivi-verknuepft,select.vivi-verknuepft,textarea.vivi-verknuepft{opacity:.62;cursor:not-allowed;background-image:none}',
      'select.vivi-verknuepft{pointer-events:none}',
      '.vivi-schloss{flex:0 0 auto;margin-left:4px;border:0;background:transparent;cursor:pointer;font-size:12px;line-height:1;padding:2px 3px;opacity:.75;vertical-align:middle}',
      '.vivi-schloss:hover,.vivi-schloss:focus{opacity:1}',
      'input.vivi-eigen,select.vivi-eigen{box-shadow:inset 3px 0 0 var(--wl-c9a84c, #C9A84C)}'
    ].join('');
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stil); else stil();
  /* Objektwechsel: die Sperren des vorigen Objekts fallen, js/vivi.js setzt die neuen */
  window.addEventListener('dp:object-ready', function () { _stand = null; allesLoesen(false); });
  window.addEventListener('dp:detailgrad', function () { if (_stand) setzen(_stand); });

  window.DpViviFelder = { setzen: setzen, allesLoesen: allesLoesen, einheitenSperren: einheitenSperren, lesen: lesen, HINWEIS: HINWEIS, EINHEIT_FELDER: EINHEIT_FELDER,
    /* fuer den Unterlagen-Abgleich (Paket V5): ist ein Feld verknuepft, und welchen Wert fuehrt ViVi? */
    istVerknuepft: function (id) { var v = lesen(); return !!(_stand && _stand.felder && _stand.felder[id]) && !Object.prototype.hasOwnProperty.call(v.eigen, id); },
    viviWert: function (id) { return _stand && _stand.felder && _stand.felder[id] ? _stand.felder[id].wert : undefined; }
  };
})();
