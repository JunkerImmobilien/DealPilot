/* ═══════════════════════════════════════════════════════════════════
   avsec-spanne.js · v1875 — die Spanne steht IN der DealPilot-Karte

   Marcel am 05.10.2026: „bei der Markteinschätzung vom Deal Piloten
   haben wir ja diesen Streifen. Da wäre es cool, wenn wir die Spanne
   unten, durchschnittlich und oben einfach mit in die Karte setzen,
   nicht direkt daneben. Und dass wir dann die Möglichkeit haben, das
   direkt zu übernehmen, indem wir das anklicken."

   avm-section.js ist „nicht anfassen". Deshalb ein Aufsatz:
   - `AvmSection.setDealpilot` wird umhüllt, um die Bänder (mw.low /
     med / high) mitzulesen — die Karte selbst zeigt nur das gewählte.
   - Nach jedem render() (MutationObserver) kommen drei Kacheln unter
     den Marktwert: Unten · Ø · Oben, jede mit ihrem Betrag.
   - Ein Klick drückt den (versteckten) Spannen-Knopf der Leiste und
     dann „übernehmen" der Karte — beides Wege, die es schon gibt.
   Die alte Leiste `.av-bar` blendet avsec-streifen.css aus.
   Läuft in der Haupt-App UND im QuickBoarding-iframe (eigenes Dokument).
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var A = global.AvmSection;
  if (!A || typeof A.setDealpilot !== 'function') return;

  var _D = null;
  var origSet = A.setDealpilot, origClear = A.clearDealpilot;
  A.setDealpilot = function (D) { _D = (D && D.mw) ? D : null; return origSet.apply(this, arguments); };
  A.clearDealpilot = function () { _D = null; return origClear.apply(this, arguments); };

  var ORDER = [['low', 'Unten', 'low'], ['mid', 'Ø', 'med'], ['high', 'Oben', 'high']];
  function fmt(n) {
    if (n == null || !isFinite(n)) return '–';
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €';
  }
  function inject() {
    var host = document.getElementById('avsec'); if (!host || !_D) return;
    var card = host.querySelector('.mc.dp'); if (!card || card.querySelector('.avs-spanne')) return;
    var body = card.querySelector('.mbody'); if (!body) return;
    var span = (A._state && A._state.span) || 'mid';
    var row = document.createElement('div'); row.className = 'avs-spanne';
    row.innerHTML = '<span class="avs-sp-lab">Spanne · anklicken = übernehmen</span>' + ORDER.map(function (o) {
      var v = _D.mw[o[2]]; if (v == null) return '';
      return '<button type="button" class="avs-sp' + (span === o[0] ? ' on' : '') + '" data-spanne="' + o[0] + '" title="' + o[1] + ' übernehmen">' +
        '<small>' + o[1] + '</small><b>' + fmt(v) + '</b></button>';
    }).join('');
    var mw = body.querySelector('.mw');
    if (mw && mw.nextSibling) body.insertBefore(row, mw.nextSibling); else body.appendChild(row);
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.avs-spanne [data-spanne]') : null;
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var host = document.getElementById('avsec'); if (!host) return;
    var k = t.getAttribute('data-spanne');
    var sb = host.querySelector('.av-bar [data-span="' + k + '"]');
    if (sb) sb.click();                       /* Spanne setzen → avm-section rendert neu */
    var ap = host.querySelector('.mc.dp [data-apply="dp"]');
    if (ap) ap.click();                       /* und übernehmen, wie der Knopf unten */
  }, true);

  var _raf = 0;
  function schedule() { if (_raf) return; _raf = requestAnimationFrame(function () { _raf = 0; inject(); }); }
  function arm() {
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    schedule();
  }
  if (document.body) arm(); else document.addEventListener('DOMContentLoaded', arm);
})(window);
