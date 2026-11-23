/* js/vivi-copilot.js — v4130 · Co-Pilot im Reiter ViVi (Pilot-Analyse › ViVi)
 *
 * Marcel 23.11.2026: „kann im Reiter ViVi man auch KI-Anfragen machen zu seinem Objekt? … mit dem Co-Pilot kombinieren?
 * … so kann man über die Einheit alles fragen.“ Datenregel: „Mieter kann man abkürzen falls notwendig, mit z. B. Hr. M“.
 *
 * Ein Fragefeld mit Einheiten-Wahl im Kopf des Reiters. Die Frage geht an POST /vivi/objekt/:id/frage
 * (backend services/vivi/viviAuskunft.js frage): derselbe Agent wie Telegram und Flow, mit den lesenden ViVi-Werkzeugen.
 * Mieter kommen dort schon abgekürzt an, hier wird nichts zusammengesetzt, was Namen tragen könnte.
 *
 * Eingehängt über DpViviReiter.html() (eine Zeile in vivi-reiter.js). Der Reiter zeichnet sich bei jedem Abgleich neu,
 * deshalb liegt der Stand (Frage, Verlauf, gewählte Einheit) hier je Objekt im Speicher und wird neu gezeichnet.
 * Gestaltung: die Bausteine des Co-Piloten (dp-cp-* in css/style.css), nichts Eigenes außer dem Rahmen.
 */
(function (global) {
  'use strict';
  var VERSION = 'v4130a';
  var doc = global.document;
  var _stand = {};   /* objektKey -> { verlauf: [{rolle, text}], einheit, laeuft, fehler, entwurf } */
  var PLANE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';
  var BEISPIELE = ['Wann war die letzte Mieterhöhung?', 'Welche Belege gab es 2025?', 'Gibt es offene Vorgänge?', 'Wie hoch ist die Restschuld laut ViVi?'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function key() { return global._currentObjKey || null; }
  function st() { var k = key(); if (!k) return null; return _stand[k] || (_stand[k] = { verlauf: [], einheit: '', laeuft: false, fehler: null, entwurf: '' }); }
  function einheiten() {
    var E = (global._dpMfh && Array.isArray(global._dpMfh.einheiten)) ? global._dpMfh.einheiten : [];
    if (E.length < 2) return [];
    return E.map(function (e, i) {
      var nr = e && e.nr != null && String(e.nr).trim() ? String(e.nr).trim() : String(i + 1);
      var art = e && /stell|garage|tg/i.test(String(e.typ || e.art || '')) ? 'Stellplatz ' : 'Wohnung ';
      return { wert: nr, text: art + nr };
    });
  }

  /* Vorschau-Funktion 'vivi' (tools/vorschau-pruefen.mjs): ohne Freigabe kein Fragefeld, auch wenn der Reiter es ruft */
  var _frei = false, _fragt = false;
  function pruefeFrei() {
    if (_frei || _fragt || !(global.DpVorschau && typeof global.DpVorschau.frei === 'function')) return;
    _fragt = true;
    global.DpVorschau.frei('vivi').then(function (f) {
      _fragt = false; if (!f || _frei) return; _frei = true;
      try { if (global.DpViviReiter && global.DpViviReiter.mountAll) global.DpViviReiter.mountAll(); } catch (e) {}
    }, function () { _fragt = false; });
  }
  function html() {
    if (!_frei) { pruefeFrei(); return ''; }
    var s = st(); if (!s) return '';
    stil();
    var E = einheiten();
    var wahl = E.length ? '<select class="dp-cp-in vc-wahl" data-vc="einheit" aria-label="Einheit wählen"><option value="">Ganzes Objekt</option>'
      + E.map(function (e) { return '<option value="' + esc(e.wert) + '"' + (s.einheit === e.wert ? ' selected' : '') + '>' + esc(e.text) + '</option>'; }).join('') + '</select>' : '';
    var log = s.verlauf.length
      ? s.verlauf.map(function (m) { return '<div class="dp-cp-msg dp-cp-' + (m.rolle === 'user' ? 'u' : 'a') + '">' + esc(m.text) + '</div>'; }).join('')
      : '<div class="dp-cp-hint">Frag den Co-Piloten zu diesem Objekt. Er liest dafür die Daten aus ViVi und rechnet mit DealPilot. Mieter erscheinen nur abgekürzt, zum Beispiel Hr. M.</div>'
        + '<div class="vc-bsp">' + BEISPIELE.map(function (b) { return '<button type="button" class="btn-clean vc-b" data-vc="bsp">' + esc(b) + '</button>'; }).join('') + '</div>';
    if (s.laeuft) log += '<div class="dp-cp-msg dp-cp-a dp-cp-think">Der Co-Pilot liest ViVi und rechnet …</div>';
    if (s.fehler) log += '<div class="vc-fehler">' + esc(s.fehler) + '</div>';
    return '<div class="vc-box" data-vc-box="1">'
      + '<div class="dp-cp-head"><span class="dp-cp-ic">' + PLANE + '</span>'
      + '<div class="dp-cp-tt"><span class="dp-cp-t">Frag den Co-Piloten zu diesem Objekt</span><span class="dp-cp-s">Daten aus ViVi und DealPilot, nur lesend</span></div>'
      + (s.verlauf.length ? '<button type="button" class="btn-clean vc-neu" data-vc="neu">Neues Gespräch</button>' : '') + '</div>'
      + '<div class="dp-cp-log vc-log">' + log + '</div>'
      + '<div class="dp-cp-bar">' + wahl
      + '<textarea class="dp-cp-in" data-vc="text" rows="1" maxlength="1500" placeholder="' + (s.einheit ? 'Frage zu Wohnung ' + esc(s.einheit) + ' …' : 'Frage zum Objekt …') + '"' + (s.laeuft ? ' disabled' : '') + '>' + esc(s.entwurf || '') + '</textarea>'
      + '<button type="button" class="dp-cp-send" data-vc="senden"' + (s.laeuft ? ' disabled' : '') + '>Fragen</button></div></div>';
  }

  function neuZeichnen() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-vc-box]'), function (b) {
      var w = doc.createElement('div'); w.innerHTML = html();
      if (w.firstChild) b.parentNode.replaceChild(w.firstChild, b);
    });
    Array.prototype.forEach.call(doc.querySelectorAll('.vc-log'), function (l) { l.scrollTop = l.scrollHeight; });
  }

  function senden(text) {
    var s = st(), k = key(); if (!s || !k || s.laeuft) return;
    text = String(text || '').trim(); if (text.length < 2) return;
    if (!(global.Auth && typeof global.Auth.apiCall === 'function')) { s.fehler = 'Nicht angemeldet.'; neuZeichnen(); return; }
    var verlauf = s.verlauf.slice(-6);
    s.verlauf.push({ rolle: 'user', text: text + (s.einheit ? ' (Wohnung ' + s.einheit + ')' : '') });
    s.entwurf = ''; s.laeuft = true; s.fehler = null; neuZeichnen();
    global.Auth.apiCall('/vivi/objekt/' + encodeURIComponent(k) + '/frage', { method: 'POST', body: { text: text, einheit: s.einheit || null, verlauf: verlauf } })
      .then(function (r) {
        s.verlauf.push({ rolle: 'assistant', text: (r && r.antwort) || 'Darauf habe ich keine Antwort gefunden.' });
      })
      .catch(function (e) {
        var m = (e && (e.message || e.error)) || 'Die Frage ging nicht durch.';
        if (/429|Tageslimit/i.test(String(m))) m = 'Das Tageslimit des Co-Piloten ist für heute erreicht.';
        s.fehler = m; s.verlauf.pop();
        s.entwurf = text;
      })
      .then(function () { s.laeuft = false; if (k === key()) neuZeichnen(); });
  }

  doc.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-vc]') : null; if (!b || !b.closest('[data-vc-box]')) return;
    var a = b.getAttribute('data-vc'), s = st(); if (!s) return;
    if (a === 'senden') { var t = b.closest('[data-vc-box]').querySelector('[data-vc="text"]'); senden(t ? t.value : ''); }
    else if (a === 'bsp') senden(b.textContent);
    else if (a === 'neu') { s.verlauf = []; s.fehler = null; neuZeichnen(); }
  });
  doc.addEventListener('change', function (ev) {
    var e = ev.target; if (!e || !e.getAttribute || e.getAttribute('data-vc') !== 'einheit') return;
    var s = st(); if (!s) return; s.einheit = e.value || ''; neuZeichnen();
  });
  doc.addEventListener('input', function (ev) {
    var e = ev.target; if (!e || !e.getAttribute || e.getAttribute('data-vc') !== 'text') return;
    var s = st(); if (s) s.entwurf = e.value;
    e.style.height = 'auto'; e.style.height = Math.min(120, e.scrollHeight) + 'px';
  });
  doc.addEventListener('keydown', function (ev) {
    var e = ev.target; if (!e || !e.getAttribute || e.getAttribute('data-vc') !== 'text') return;
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); senden(e.value); }
  });

  function stil() {
    if (doc.getElementById('vc-stil')) return;
    var s = doc.createElement('style'); s.id = 'vc-stil';
    s.textContent = [
      /* Rahmen wie #dp-cp (css/style.css v585-copilot), der Rest sind die dp-cp-Bausteine */
      '.vc-box{margin:0 0 14px;border:1px solid #E7E4DC;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(40,35,20,.04);overflow:hidden;font-family:Inter,sans-serif}',
      '.vc-box .dp-cp-tt{display:flex;flex-direction:column;min-width:0;flex:1}',
      '.vc-box .dp-cp-log{max-height:300px}',
      '.vc-box .dp-cp-in{height:40px;min-height:40px}',
      '.vc-neu{margin-left:auto;border:1px solid #E7E4DC!important;background:#fff!important;border-radius:99px;padding:4px 10px;font:600 11px Inter,sans-serif;color:#5E5856;cursor:pointer;white-space:nowrap}',
      '.vc-bsp{display:flex;flex-wrap:wrap;gap:6px}',
      '.vc-b{border:1px solid var(--wl-ece0be,#ECE0BE)!important;background:#FBFAF6!important;border-radius:99px;padding:5px 10px;font:500 11.5px Inter,sans-serif;color:#2A2826;cursor:pointer}',
      '.vc-b:hover{border-color:var(--wl-c9a84c,#C9A84C)!important}',
      '.vc-wahl{flex:0 0 auto;max-width:150px;background:#fff}',
      '.vc-fehler{font-size:12px;color:#B8625C}',
      '.vc-box .dp-cp-msg{white-space:pre-wrap}',
      '@media (max-width:640px){.vc-box .dp-cp-bar{flex-wrap:wrap}.vc-wahl{max-width:none;flex:1 1 100%}.vc-box .dp-cp-send{min-height:40px}}'
    ].join('');
    doc.head.appendChild(s);
  }

  global.DpViviCopilot = { VERSION: VERSION, html: html, senden: senden };
})(window);
