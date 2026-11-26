/* foerderung-karte.js · v5120 · Karte „Förderung" für Kapitalanleger (JJ6)
   v5120a · Marcel 26.11.2026 „Förderkarte: ja": für alle frei (Vorschau-Sperre entfernt).
   Ort: Pilot-Analyse › Potenzial (unter #dp-pa-pot).
   Liest die geplanten Maßnahmen aus dem Block „Sanierungsbedarf" (fesh_*), die Energieklasse
   (ds2_energie) und das Baujahr, rechnet mit dem Kern js/foerderung.js (DpFoerderung.passend,
   Nutzung „vermietet") und zeigt nur dann Programme, wenn eine Sanierung geplant ist.
   Kein Beobachter auf dem DOM (v4850e-Lehre): ein leiser Takt alle 2 s, nur wenn frei. */
(function () {
  'use strict';
  function start() {
  (function () {
    var letzte = '';
    function an(id) { var e = document.getElementById(id); return !!(e && e.checked); }
    function wert(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function eingabe() {
      var m = [];
      if (an('fesh_h')) m.push('heizung');
      if (an('fesh_f') || an('fesh_d')) m.push('huelle');
      if (an('fesh_b')) m.push('barriere');
      return { nutzung: 'vermietet', kauf: true, neubau: false, massnahmen: m,
        baujahr: parseInt(wert('baujahr'), 10) || null, energieklasse: wert('ds2_energie') || null };
    }
    function html(r) {
      var k = '<div class="dp-foerder-kopf"><b>Förderung</b><span class="dp-foerder-tag">KfW · BAFA</span></div>';
      if (!r.liste.length) return k + '<p class="dp-foerder-leer">' + esc(r.leer_grund || 'Keine passende Bundesförderung hinterlegt.') + '</p>';
      return k + '<div class="dp-foerder-liste">' + r.liste.map(function (p) {
        return '<div class="dp-foerder-p"><div class="dp-foerder-n">' + esc(p.name) + '</div>'
          + '<div class="dp-foerder-w">' + esc(p.warum) + '</div>'
          + '<div class="dp-foerder-b">' + esc(p.betrag) + '</div>'
          + '<div class="dp-foerder-a">Antrag: ' + esc(p.antrag) + '</div>'
          + (p.pruefen && p.pruefen.length ? '<div class="dp-foerder-a">Bitte prüfen: ' + esc(p.pruefen.join(', ')) + '</div>' : '')
          + '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">Zum Programm</a></div>';
      }).join('') + '</div><p class="dp-foerder-h">' + esc(r.hinweis) + ' Stand ' + esc(String(r.stand || '').split('-').reverse().join('.')) + '.</p>';
    }
    function css() {
      if (document.getElementById('dp-foerder-css')) return;
      var s = document.createElement('style'); s.id = 'dp-foerder-css';
      s.textContent = '.dp-foerder-karte{margin:14px 0;padding:14px 16px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:12px;background:var(--surface,#FBF6E9);font:13px/1.45 Inter,system-ui,sans-serif;color:inherit}'
        + '.dp-foerder-kopf{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-family:"Space Grotesk",Inter,sans-serif;font-size:15px}'
        + '.dp-foerder-tag{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius:6px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent)}'
        + '.dp-foerder-liste{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}'
        + '.dp-foerder-p{padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.03)}'
        + '.dp-foerder-n{font-weight:600;margin-bottom:4px}.dp-foerder-w,.dp-foerder-b{margin-bottom:4px}'
        + '.dp-foerder-a,.dp-foerder-h,.dp-foerder-leer{font-size:12px;opacity:.75;margin:4px 0}'
        + '.dp-foerder-p a{font-size:12px;color:var(--wl-b8932f, #b8932f)}';
      document.head.appendChild(s);
    }
    function takt() {
      try {
        var ziel = document.getElementById('dp-pa-pot');
        if (ziel && window.DpFoerderung) {
          var e = eingabe(), sig = JSON.stringify(e);
          var karte = document.getElementById('dp-foerder-karte');
          if (!karte || sig !== letzte) {
            css();
            if (!karte) { karte = document.createElement('div'); karte.id = 'dp-foerder-karte'; karte.className = 'dp-foerder-karte'; ziel.appendChild(karte); }
            var r = window.DpFoerderung.passend(e, window.DpFoerderregister);
            karte.style.display = r.liste.length ? '' : 'none';   /* nur wenn sinnvoll (Marcel): ohne geplante Sanierung keine Karte */
            karte.innerHTML = html(r);
            letzte = sig;
          }
        }
      } catch (x) { /* Demo: leise */ }
      setTimeout(takt, 2000);
    }
    takt();
  })();
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
