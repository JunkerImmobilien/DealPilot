'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   DealPilot v1270 · adress-autocomplete.js
   Zwei Erleichterungen im Reiter "Objekt", beide aus Marcels Auftrag vom
   09.09.2026: "wenn man plz eingibt das der ort automatisch ausgefüllt
   wird und man unter Straße dann eine Liste der Straßen hat. man kann
   aber weiterhin die straße eintippen."

   QUELLE ist der Endpunkt, den es laengst gibt:
   /marktbericht/geocode/autocomplete (Geoapify, Schluessel bleibt auf dem
   Server). v1270 reicht dort type/limit durch - OHNE type mischt Geoapify
   Orte und Strassen, gemessen: "32120 Hiddenhausen Ha" ergab drei
   Ortszeilen und keine einzige Strasse.

   ZWEI REGELN, und jede hat einen Grund:

   1. Der Ort wird NUR gefuellt, wenn das Feld leer ist. Ein eingetragener
      Ort kann ein Ortsteil sein, den die Postleitzahl nicht kennt - der
      ist mehr wert als der amtliche Gemeindename.
   2. Die Strassenliste ist ein VORSCHLAG, kein Zwang. Getippt wird weiter
      frei; wer nichts anklickt, behaelt seinen Text. Eine Lage ohne
      Geoapify-Treffer darf nicht in eine Sackgasse fuehren.

   Kein Abruf ohne Postleitzahl oder Ort: die Suche braucht den
   Ortskontext, sonst schlaegt sie bundesweit zu.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BOX_ID = 'dp-adr-box';
  var _timer = null, _plzTimer = null, _treffer = [], _aktiv = -1, _plzMerker = '';

  function _el(id) { return document.getElementById(id); }
  function _wert(id) { var e = _el(id); return e ? String(e.value || '').trim() : ''; }
  function _esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Wert setzen UND die App davon erzaehlen: calc() haengt am input-Event. */
  function _setzen(el, wert) {
    if (!el) return;
    el.value = wert;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  function _api(pfad) {
    if (typeof Auth === 'undefined' || !Auth.apiCall) return Promise.reject(new Error('kein Auth'));
    return Auth.apiCall(pfad, { method: 'GET' });
  }

  /* ─── Stil ───────────────────────────────────────────────────────────
     position:fixed, weil der Vorfahre .f static ist und die Eingabemaske in
     einem eigenen Scroll-Container sitzt - ein absolut gesetztes Overlay
     wuerde beim Scrollen stehenbleiben oder abgeschnitten. Beim Scrollen
     wird die Liste deshalb geschlossen. Gold tokenisiert. */
  function _stil() {
    if (_el('dp-adr-stil')) return;
    var s = document.createElement('style');
    s.id = 'dp-adr-stil';
    s.textContent = [
      '#dp-adr-box{position:fixed;z-index:9999;max-height:246px;overflow:auto;',
      '  background:#14130f;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 46%, transparent);',
      '  border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.45);padding:4px}',
      '#dp-adr-box[hidden]{display:none}',
      '.dp-adr-opt{padding:7px 10px;border-radius:7px;cursor:pointer;color:#EDE7DA;',
      '  font:500 12.5px/1.25 Inter,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dp-adr-opt:hover,.dp-adr-opt.dp-adr-an{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent);',
      '  color:var(--wl-e8cc7a, #E8CC7A)}',
      '.dp-adr-kopf{padding:5px 10px 3px;color:var(--wl-c9a84c, #C9A84C);opacity:.75;',
      '  font:600 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}'
    ].join('');
    document.head.appendChild(s);
  }

  function _box() {
    var b = _el(BOX_ID);
    if (!b) {
      _stil();
      b = document.createElement('div');
      b.id = BOX_ID;
      b.hidden = true;
      /* mousedown statt click: ein click kaeme erst NACH dem blur des
         Feldes, und blur schliesst die Liste. */
      b.addEventListener('mousedown', function (ev) {
        var o = ev.target && ev.target.closest ? ev.target.closest('.dp-adr-opt') : null;
        if (!o) return;
        ev.preventDefault();
        _waehlen(parseInt(o.getAttribute('data-i'), 10));
      });
      document.body.appendChild(b);
    }
    return b;
  }

  function _schliessen() { var b = _el(BOX_ID); if (b) b.hidden = true; _aktiv = -1; }

  function _waehlen(i) {
    if (!(i >= 0) || !_treffer[i]) return;
    _setzen(_el('str'), _treffer[i]);
    _schliessen();
    var h = _el('hnr');
    if (h && !String(h.value || '').trim()) { try { h.focus(); } catch (e) {} }
  }

  function _zeigen(namen) {
    if (!namen || !namen.length) return _schliessen();
    _treffer = namen; _aktiv = -1;
    var el = _el('str'); if (!el) return;
    var r = el.getBoundingClientRect();
    var b = _box();
    b.innerHTML = '<div class="dp-adr-kopf">Straße wählen oder weitertippen</div>' +
      namen.map(function (n, i) {
        return '<div class="dp-adr-opt" data-i="' + i + '">' + _esc(n) + '</div>';
      }).join('');
    b.style.left = Math.round(r.left) + 'px';
    b.style.top = Math.round(r.bottom + 4) + 'px';
    b.style.width = Math.round(r.width) + 'px';
    b.hidden = false;
  }

  function _markieren() {
    var b = _el(BOX_ID); if (!b) return;
    var opts = b.querySelectorAll('.dp-adr-opt');
    for (var i = 0; i < opts.length; i++) opts[i].classList.toggle('dp-adr-an', i === _aktiv);
    if (_aktiv >= 0 && opts[_aktiv]) {
      try { opts[_aktiv].scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }

  /* ─── Straßen suchen ────────────────────────────────────────────────── */
  function _strSuchen() {
    var el = _el('str'); if (!el) return;
    var q = String(el.value || '').trim();
    var plz = _wert('plz'), ort = _wert('ort');
    if (q.length < 2 || (!plz && !ort)) return _schliessen();
    var text = (plz + ' ' + ort + ' ' + q).replace(/\s+/g, ' ').trim();
    _api('/marktbericht/geocode/autocomplete?type=street&limit=8&text=' + encodeURIComponent(text))
      .then(function (r) {
        /* Nur zeigen, wenn der Text seither nicht weitergewandert ist. */
        if (String(el.value || '').trim() !== q) return;
        var namen = [];
        ((r && r.results) || []).forEach(function (x) {
          var n = x.street || String(x.formatted || '').split(',')[0];
          n = String(n || '').trim();
          if (n && namen.indexOf(n) < 0) namen.push(n);
        });
        _zeigen(namen);
      })
      .catch(function () { _schliessen(); });
  }

  /* ─── Ort aus der Postleitzahl ──────────────────────────────────────── */
  function _plzPruefen() {
    var plz = _wert('plz');
    if (!/^\d{5}$/.test(plz) || plz === _plzMerker) return;
    _plzMerker = plz;
    var ortEl = _el('ort');
    if (!ortEl || String(ortEl.value || '').trim() !== '') return;   /* nie ueberschreiben */
    _api('/marktbericht/geocode/autocomplete?type=postcode&limit=1&text=' + encodeURIComponent(plz))
      .then(function (r) {
        var t = (r && r.results && r.results[0]) || null;
        if (!t || !t.city) return;
        if (String(ortEl.value || '').trim() !== '') return;   /* inzwischen selbst getippt */
        _setzen(ortEl, t.city);
        try { if (typeof toast === 'function') toast('Ort aus der Postleitzahl ergänzt: ' + t.city); } catch (e) {}
      })
      .catch(function () {});
  }

  /* ─── Verdrahtung ───────────────────────────────────────────────────── */
  function _wire() {
    var plz = _el('plz'), str = _el('str');
    if (plz && !plz._dpAdrWired) {
      plz._dpAdrWired = 1;
      plz.addEventListener('input', function () {
        clearTimeout(_plzTimer);
        _plzTimer = setTimeout(_plzPruefen, 500);
      });
      plz.addEventListener('change', _plzPruefen);
    }
    if (str && !str._dpAdrWired) {
      str._dpAdrWired = 1;
      str.addEventListener('input', function () {
        clearTimeout(_timer);
        _timer = setTimeout(_strSuchen, 320);
      });
      str.addEventListener('keydown', function (ev) {
        var b = _el(BOX_ID);
        if (!b || b.hidden) return;
        if (ev.key === 'ArrowDown') { ev.preventDefault(); _aktiv = Math.min(_aktiv + 1, _treffer.length - 1); _markieren(); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); _aktiv = Math.max(_aktiv - 1, -1); _markieren(); }
        else if (ev.key === 'Enter') { if (_aktiv >= 0) { ev.preventDefault(); _waehlen(_aktiv); } }
        else if (ev.key === 'Escape') { _schliessen(); }
      });
      str.addEventListener('blur', function () { setTimeout(_schliessen, 120); });
    }
    return !!(plz && str);
  }

  window.addEventListener('scroll', function () { _schliessen(); }, true);
  window.addEventListener('resize', function () { _schliessen(); });

  var _n = 0;
  (function _start() {
    if (_wire()) return;
    if (_n++ < 40) setTimeout(_start, 250);
  })();

  /* Pruefhaken - damit die Automatik messbar ist, ohne im Feld zu tippen.
     Der Merker laesst sich hier zuruecksetzen, sonst prueft ein zweiter
     Lauf mit derselben Postleitzahl nichts mehr. */
  window.DealPilotAdresse = {
    plzPruefen: function () { _plzMerker = ''; return _plzPruefen(); },
    strSuchen: _strSuchen,
    schliessen: _schliessen
  };
})();
