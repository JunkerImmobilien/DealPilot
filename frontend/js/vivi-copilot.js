/* js/vivi-copilot.js — v4190 · Fragen zu ViVi gehen an den EINEN Co-Piloten
 *
 * Marcel 23.11.2026: „Im Reiter ViVi steht oben jetzt ‚Frag den Co-Piloten zu diesem Objekt‘. Den Co-Piloten haben wir
 * unten doch schon. Reicht das nicht? Ist das nicht dasselbe?“ Bis v4130 stand hier ein eigenes Fragefeld mit eigener
 * Route (/vivi/objekt/:id/frage). Jetzt kennt der normale Co-Pilot ViVi selbst: der Server legt bei einer Frage nach
 * Verwaltungsdaten das ViVi-Wissen in den Kontext (routes/ai.js _copilotObjektwissen -> services/vivi/viviAuskunft.js
 * copilotWissen, Mieter abgekürzt). Hier bleibt nur eine schmale Zeile mit Beispielfragen. Ein Klick öffnet die
 * Pilot-Blase (DealPilotBlase.auf) und schickt die Frage dort ab, wie wenn sie getippt wäre.
 *
 * Eingehängt über DpViviReiter.html() (eine Zeile in vivi-reiter.js), sichtbar nur mit Vorschau-Freigabe 'vivi'.
 */
(function (global) {
  'use strict';
  var VERSION = 'v4190';
  var doc = global.document;
  var BEISPIELE = ['Wann war die letzte Mieterhöhung?', 'Welche Belege gab es 2025?', 'Gibt es offene Vorgänge?', 'Wie hoch ist die Restschuld laut ViVi?'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Vorschau-Funktion 'vivi' (tools/vorschau-pruefen.mjs): ohne Freigabe keine Zeile, auch wenn der Reiter sie ruft */
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
    if (!global._currentObjKey) return '';
    stil();
    return '<div class="vc-zeile" data-vc-box="1"><span class="vc-l">Frag den Co-Piloten</span>'
      + BEISPIELE.map(function (b) { return '<button type="button" class="btn-clean vc-b" data-vc="bsp">' + esc(b) + '</button>'; }).join('')
      + '</div>';
  }

  /** Frage an den Co-Piloten unten: Blase öffnen, Text ins Feld, absenden (copilot.js send über den Knopf) */
  function fragen(text) {
    text = String(text || '').trim(); if (!text) return;
    var B = global.DealPilotBlase;
    try { if (B && typeof B.auf === 'function') B.auf(); } catch (e) {}
    var versuch = 0;
    (function los() {
      var inp = doc.getElementById('dp-cp-in'), snd = doc.getElementById('dp-cp-send');
      if (!inp || !snd) { if (++versuch < 20) setTimeout(los, 100); return; }
      inp.value = text;
      try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      if (!snd.disabled) snd.click();
    })();
  }

  doc.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-vc="bsp"]') : null; if (!b || !b.closest('[data-vc-box]')) return;
    fragen(b.textContent);
  });

  function stil() {
    if (doc.getElementById('vc-stil')) return;
    var s = doc.createElement('style'); s.id = 'vc-stil';
    s.textContent = [
      '.vc-zeile{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 12px;font-family:Inter,sans-serif}',
      '.vc-l{font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#7A746E;margin-right:4px}',
      '.vc-b{border:1px solid var(--wl-ece0be,#ECE0BE)!important;background:#FBFAF6!important;border-radius:99px;padding:5px 10px;font:500 11.5px Inter,sans-serif;color:#2A2826;cursor:pointer}',
      '.vc-b:hover{border-color:var(--wl-c9a84c,#C9A84C)!important}',
      '@media (max-width:640px){.vc-l{flex:1 1 100%}}'
    ].join('');
    doc.head.appendChild(s);
  }

  global.DpViviCopilot = { VERSION: VERSION, html: html, fragen: fragen };
})(window);
