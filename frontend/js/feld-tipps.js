/* v5000 · Lange Erklärtexte unter Feldern wandern ins ⓘ (Marcel 25.11.2026:
   „bei Miete … Mieterhöhung auch auf die zusätzlichen Einnahmen. Da steht darunter
   ein langer Text, den vielleicht eher mit in den Tooltip übernehmen“).

   Markiert wird im HTML mit data-als-tip:
     data-als-tip=""            Ziel ist das Label des Feldes (.f > label) oder,
                                ohne Feld, der Kartentitel (.ct / .card-title)
     data-als-tip="<Selektor>"  Ziel ausdrücklich (z. B. "#ze-auft > summary")
     data-als-tip-titel="…"     Titel des Tooltips, sonst der Text des Ziels
   Der Text bleibt im HTML (Suche, Co-Pilot, Prüfer), er wird nur ausgeblendet
   und als Tooltip der bestehenden Hilfe (tooltip-engine.js) registriert.
   Ohne DpTooltips bleibt alles, wie es war. */
(function () {
  'use strict';
  var n = 0;

  function sauber(html) {
    /* escSafe in tooltip-engine.js kennt nur nackte <b>/<i>/<br>: Attribute weg, alles andere raus */
    return String(html || '')
      .replace(/<(b|strong|i|em|br)(\s[^>]*)?>/gi, '<$1>')
      .replace(/<(?!\/?(b|strong|i|em|br)>)[^>]+>/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function zielVon(h) {
    var sel = h.getAttribute('data-als-tip');
    if (sel) { try { return document.querySelector(sel) || (h.closest('label') && h.closest('label').querySelector(sel)); } catch (e) { return null; } }
    var f = h.closest('.f');
    if (f) { var l = f.querySelector(':scope > label'); if (l) return l; }
    var k = h.closest('.card');
    if (k) return k.querySelector('.ct, .card-title');
    return null;
  }

  function titelVon(h, ziel) {
    var t = h.getAttribute('data-als-tip-titel');
    if (t) return t;
    var c = ziel.cloneNode(true);
    [].slice.call(c.querySelectorAll('button, .dp-tip, .ds2-tag, .hint, .oe-ct-hint, .ct-ico, svg')).forEach(function (x) { x.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70) || 'Hinweis';
  }

  function umziehen() {
    var inhalt = window.DpTooltips && window.DpTooltips.content;
    if (!inhalt) return;
    var liste = document.querySelectorAll('[data-als-tip]:not([data-als-tip-fertig])');
    for (var i = 0; i < liste.length; i++) {
      var h = liste[i];
      var ziel = zielVon(h);
      if (!ziel) continue;
      var id = 'feld.auto_' + (++n);
      inhalt[id] = { title: titelVon(h, ziel), body: sauber(h.innerHTML), severity: 'pro' };
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dp-tip';
      b.setAttribute('data-tip-id', id);
      b.setAttribute('tabindex', '-1');
      b.setAttribute('aria-label', 'Hilfe');
      ziel.appendChild(document.createTextNode(' '));
      ziel.appendChild(b);
      h.setAttribute('data-als-tip-fertig', '1');
      h.classList.add('dp-als-tip-weg');
    }
    try { if (window.DpTip && DpTip.applyMode) DpTip.applyMode(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', umziehen);
  else umziehen();
  window.DpFeldTipps = { umziehen: umziehen };
})();
