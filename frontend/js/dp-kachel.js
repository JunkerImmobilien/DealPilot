/* v4660 · Kachel-Baustein (css/dp-kachel.css)
   - setzt html[data-dp-kachel] für die Kachel-Optik (Entwurf a|b|c),
     bis Marcel gewählt hat nur auf Staging voreingestellt
     (?kachel=a|b|c wählt, ?kachel=aus schaltet ab, gemerkt in dp_kachel)
   - gibt der Score-Karte (.dp-pa4-urteil) Score und Stufenfarbe als
     Variablen für den Ring; die Stufe kommt aus ScoreTier (score-tiers.js) */
(function () {
  'use strict';
  var html = document.documentElement;
  var STANDARD_STAGING = 'a';
  var wahl = null;
  try {
    var q = new URLSearchParams(location.search).get('kachel');
    if (q) { localStorage.setItem('dp_kachel', q); }
    wahl = localStorage.getItem('dp_kachel');
  } catch (e) { /* ohne Speicher gilt die Voreinstellung */ }
  if (!wahl && /(^|\.)staging\./.test(location.hostname)) wahl = STANDARD_STAGING;
  if (wahl && /^[abc]$/.test(wahl)) html.setAttribute('data-dp-kachel', wahl);

  var FARBE = { top: '#2E7D50', green: '#3FA56C', gold: 'var(--wl-c9a84c,#C9A84C)', red: '#B8625C' };
  function score(el) {
    var z = el.querySelector('.z');
    if (!z) return;
    var n = parseInt(String(z.textContent).replace(/[^\d]/g, ''), 10);
    if (!isFinite(n) || n < 0 || n > 100) return;
    if (el.getAttribute('data-dpk-s') === String(n)) return;
    var st = (window.ScoreTier && window.ScoreTier.stufe) ? window.ScoreTier.stufe(n) : null;
    el.setAttribute('data-dpk-s', String(n));
    el.style.setProperty('--dpk-s', String(n));
    el.style.setProperty('--dpk-t', FARBE[st && st.farbe] || FARBE.gold);
  }
  function lauf() { document.querySelectorAll('.dp-pa4-urteil').forEach(score); }
  var t = null;
  function bald() { if (t) return; t = setTimeout(function () { t = null; lauf(); }, 120); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lauf); else lauf();
  try { new MutationObserver(bald).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  window.DpKachel = { version: 'v4660', lauf: lauf };
})();
