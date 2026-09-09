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
  /* v1271: zuletzt aus der Liste gewaehlter Strassenname - er darf keine
     neue Suche ausloesen. */
  var _gewaehlt = '';
  /* v1270b: Koordinaten der Postleitzahl. Sie sind der Ortsbezug fuer die
     Strassensuche - der ORTSNAME im Suchtext taugt dafuer nicht, siehe
     Kommentar bei _strSuchen. { plz, lat, lon } oder null. */
  var _koord = null;

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
     v1270d: position:absolute IM Feld-Container, nicht fixed am Fenster.
     Mit fixed stand die Liste nach jeder Layoutverschiebung falsch -
     gemessen: Feld bei y=488, Liste bei y=501, also 25 px zu hoch und
     mitten auf dem Eingabefeld. Ein absolut gesetztes Kind wandert mit,
     ohne dass irgendetwas nachgerechnet werden muss. Der .f-Container
     bekommt dafuer per Inline-Stil position:relative - gezielt an DIESEM
     einen Element, keine Sammelregel auf .f (die traefe die halbe Maske).
     Alle Vorfahren bis .main-col sind overflow:visible, gemessen - die
     Liste wird also nicht abgeschnitten. Gold tokenisiert. */
  function _stil() {
    if (_el('dp-adr-stil')) return;
    var s = document.createElement('style');
    s.id = 'dp-adr-stil';
    s.textContent = [
      '#dp-adr-box{position:absolute;z-index:9999;max-height:246px;overflow:auto;',
      '  background:#14130f;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 46%, transparent);',
      '  border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.45);padding:4px}',
      '#dp-adr-box[hidden]{display:none}',
      '.dp-adr-opt{padding:7px 10px;border-radius:7px;cursor:pointer;color:#EDE7DA;',
      '  font:500 12.5px/1.25 Inter,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dp-adr-opt:hover,.dp-adr-opt.dp-adr-an{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent);',
      '  color:var(--wl-e8cc7a, #E8CC7A)}',
      '.dp-adr-kopf{padding:5px 10px 3px;color:var(--wl-c9a84c, #C9A84C);opacity:.75;',
      '  font:600 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}',
      '.dp-adr-fremd{float:right;margin-left:10px;opacity:.6;color:#C8C0AE;',
      '  font:500 10.5px/1.5 "JetBrains Mono",ui-monospace,monospace}'
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

  /* Die Liste unter das Feld haengen - im Feld-Container, nicht am Fenster. */
  function _andocken(b, el) {
    var par = el.parentElement; if (!par) return;
    if (getComputedStyle(par).position === 'static') par.style.position = 'relative';
    if (b.parentElement !== par) par.appendChild(b);
    b.style.left = el.offsetLeft + 'px';
    b.style.top = (el.offsetTop + el.offsetHeight + 4) + 'px';
    b.style.width = el.offsetWidth + 'px';
  }

  function _schliessen() { var b = _el(BOX_ID); if (b) b.hidden = true; _aktiv = -1; }

  /* ═══ v1271 · Nach der Wahl bleibt die Liste zu ══════════════════════
     Marcels Befund: "wenn ich die strasse ausgewählt habe bleibt leider das
     dropdown stehen obwohl ich das feld gewechselt habe."

     Ursache war das eigene Setzen: _setzen() feuert ein input-Event, damit
     calc() rechnet - und derselbe input-Handler startet die Suche erneut.
     Die Antwort kam 300 ms spaeter zurueck und riss die Liste wieder auf,
     da war der Fokus laengst in der Hausnummer.

     Zwei Riegel: der gewaehlte Text loest keine neue Suche aus, und
     _zeigen() oeffnet die Liste nur, wenn das Strassenfeld ueberhaupt noch
     den Fokus hat. Der zweite faengt jede spaete Antwort ab, egal woher. */
  function _waehlen(i) {
    if (!(i >= 0) || !_treffer[i]) return;
    clearTimeout(_timer);
    _gewaehlt = _treffer[i].name;
    _setzen(_el('str'), _treffer[i].name);
    _schliessen();
    var h = _el('hnr');
    if (h && !String(h.value || '').trim()) { try { h.focus(); } catch (e) {} }
  }

  function _zeigen(liste) {
    if (!liste || !liste.length) return _schliessen();
    var el = _el('str'); if (!el) return;
    /* v1271: keine Liste ohne Fokus im Feld - sonst reisst eine spaet
       eintreffende Antwort sie wieder auf, waehrend man schon woanders
       tippt. */
    if (document.activeElement !== el) return _schliessen();
    _treffer = liste; _aktiv = -1;
    var plzJetzt = _wert('plz');
    var b = _box();
    b.innerHTML = '<div class="dp-adr-kopf">Straße wählen oder weitertippen</div>' +
      liste.map(function (e, i) {
        /* Nachbarort dazuschreiben - sonst waehlt man ihn versehentlich. */
        var fremd = (e.plz && plzJetzt && e.plz !== plzJetzt)
          ? '<span class="dp-adr-fremd">' + _esc((e.plz + ' ' + e.ort).trim()) + '</span>' : '';
        return '<div class="dp-adr-opt" data-i="' + i + '">' + _esc(e.name) + fremd + '</div>';
      }).join('');
    _andocken(b, el);
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

  /* Koordinaten zur aktuellen Postleitzahl besorgen (einmal je PLZ). */
  function _koordHolen() {
    var plz = _wert('plz');
    if (!/^\d{5}$/.test(plz)) return Promise.resolve(null);
    if (_koord && _koord.plz === plz) return Promise.resolve(_koord);
    return _api('/marktbericht/geocode/autocomplete?type=postcode&limit=1&text=' + encodeURIComponent(plz))
      .then(function (r) {
        var t = (r && r.results && r.results[0]) || null;
        if (!t || t.lat == null || t.lon == null) return null;
        _koord = { plz: plz, lat: t.lat, lon: t.lon, city: t.city || '' };
        return _koord;
      })
      .catch(function () { return null; });
  }

  /* ─── Straßen suchen ──────────────────────────────────────────────────
     Gesucht wird mit einem KREIS um die Postleitzahl, nicht mit dem
     Ortsnamen im Text. Gemessen am 09.09.2026: "32120 Hiddenhausen Löh"
     lieferte die Hiddenhauser Straße in ENGER und eine Hiddenhausener
     Straße in Loitz (Vorpommern) — der Ortsname wiegt bei Geoapify
     schwerer als das Präfix der Straße. Ohne Koordinaten (keine oder halbe
     PLZ) bleibt der alte Weg als Rückfall. */
  function _strSuchen() {
    var el = _el('str'); if (!el) return;
    var q = String(el.value || '').trim();
    var plz = _wert('plz'), ort = _wert('ort');
    if (q.length < 2 || (!plz && !ort)) return _schliessen();
    _koordHolen().then(function (k) {
      if (String(el.value || '').trim() !== q) return;   /* schon weitergetippt */
      var pfad;
      if (k) {
        pfad = '/marktbericht/geocode/autocomplete?type=street&limit=8' +
               '&lat=' + encodeURIComponent(k.lat) + '&lon=' + encodeURIComponent(k.lon) +
               '&text=' + encodeURIComponent(q);
      } else {
        var text = (plz + ' ' + ort + ' ' + q).replace(/\s+/g, ' ').trim();
        pfad = '/marktbericht/geocode/autocomplete?type=street&limit=8&text=' + encodeURIComponent(text);
      }
      return _suchAbruf(pfad, el, q);
    });
  }

  /* v1270c · Die eigene Postleitzahl zuerst, die Nachbarschaft benannt.
     Gemessen: "Her" in 32609 Hüllhorst brachte die Hermannstraße in 32278
     Kirchlengern nach oben — im Umkreis liegt eben mehr als eine. Geoapify
     sortiert nach eigener Gewichtung, nicht streng nach Entfernung. Also
     sortiert die Liste selbst: gleiche PLZ oben. Die übrigen bleiben
     stehen, tragen aber sichtbar ihren Ort — eine Straße stillschweigend
     aus dem Nachbarort zu übernehmen wäre schlimmer, als sie zu zeigen. */
  function _suchAbruf(pfad, el, q) {
    var plzJetzt = _wert('plz');
    return _api(pfad)
      .then(function (r) {
        /* Nur zeigen, wenn der Text seither nicht weitergewandert ist. */
        if (String(el.value || '').trim() !== q) return;
        var gesehen = {}, eigene = [], fremde = [];
        ((r && r.results) || []).forEach(function (x) {
          var n = String(x.street || String(x.formatted || '').split(',')[0] || '').trim();
          if (!n) return;
          var plz = String(x.postcode || '').trim();
          var schl = n + '|' + plz;
          if (gesehen[schl]) return;
          gesehen[schl] = 1;
          var e = { name: n, plz: plz, ort: String(x.city || '').trim() };
          if (plz && plzJetzt && plz === plzJetzt) eigene.push(e); else fremde.push(e);
        });
        _zeigen(eigene.concat(fremde));
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
        /* v1271: der eben gewaehlte Text sucht nicht noch einmal. */
        if (String(str.value || '').trim() === _gewaehlt) { _schliessen(); return; }
        _gewaehlt = '';
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

  /* v1270d: KEIN Schliessen beim Scrollen mehr - die Liste haengt jetzt am
     Feld und wandert mit. Der alte Handler mit capture fing auch das
     Scrollen in .main-col und machte die Liste sofort wieder zu. */
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
