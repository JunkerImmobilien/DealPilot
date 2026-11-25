/* v4850 · Kontrast für kleine Schrift (Marcel 25.11.2026: „Kontrast, ja, das kannst du machen“)
   Gemessen (Westerfeldstr. 146, alle Reiter): 623 von 5.986 kleinen Textstellen unter 4,5 : 1, fast nur
   Status-Grün #3FA56C (3,1 : 1), Status-Rot #B8625C (4,3 : 1) und gedämpfte Grautöne (3,1 bis 4,3 : 1).
   Die Farben sitzen an hunderten Stellen als Literal und Inline-Stil, eine Regel je Stelle wäre nie fertig.
   Deshalb EINE Stelle: Text bis 13,5 px in diesen Farben bekommt, wenn er auf seinem Grund unter 4,5 : 1 liegt,
   eine feste dunklere (auf hellem Grund) bzw. hellere (auf dunklem Grund) Textvariante als Klasse.
   Flächen, Balken, Ampeln, Ränder und große Zahlen behalten die Markenfarbe. Statusfarben sind keine
   Whitelabel-Tokens und werden es auch hier nicht: die Varianten sind feste Ableitungen.
   Gold (Akzent, Whitelabel) bleibt unberührt. */
(function () {
  'use strict';
  if (window.DpKontrastText) return;

  function rgb(s) { var m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; var p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function kontrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function grund(el) {
    var st = [], e = el;
    while (e && e.nodeType === 1) {
      var cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;   /* Verlauf/Bild: nicht sicher messbar */
      var c = rgb(cs.backgroundColor);
      if (c && c.a > 0) { st.push(c); if (c.a >= 0.99) break; }
      e = e.parentElement;
    }
    var b = { r: 255, g: 255, b: 255 };
    for (var i = st.length - 1; i >= 0; i--) { var c2 = st[i]; b = { r: c2.r * c2.a + b.r * (1 - c2.a), g: c2.g * c2.a + b.g * (1 - c2.a), b: c2.b * c2.a + b.b * (1 - c2.a) }; }
    return b;
  }
  /* Familie der Textfarbe: gruen | rot | grau | null */
  function familie(c) {
    var r = c.r, g = c.g, b = c.b;
    if (g > r + 40 && g > b + 20 && g > 110) return 'gruen';                 /* #3FA56C und Verwandte */
    if (r > g + 50 && r > b + 50 && r > 150 && r < 225) return 'rot';         /* #B8625C, #D8564C */
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn <= 30 && mx >= 95 && mx <= 185) return 'grau';                /* gedämpfte Grautöne */
    return null;
  }

  var KL = ['dp-kt-gruen', 'dp-kt-rot', 'dp-kt-grau', 'dp-kt-gruen-d', 'dp-kt-rot-d', 'dp-kt-grau-d'];
  var laeuft = false, offen = false;

  function pruefe() {
    laeuft = true; offen = false;
    try {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t, gesehen = new Set();
      while ((t = w.nextNode())) {
        if (!t.nodeValue || t.nodeValue.trim().length < 1) continue;
        var el = t.parentElement; if (!el || gesehen.has(el)) continue; gesehen.add(el);
        if (el.closest('svg, .dp-kt-aus, [data-dp-kt="aus"], #dp-kv-panel')) continue;
        var cs = getComputedStyle(el);
        if (parseFloat(cs.fontSize) > 13.5) continue;
        /* schon eingestuft: nicht erneut anfassen (jede Klassenänderung löst den Beobachter aus) */
        if (KL.some(function (k) { return el.classList.contains(k); })) continue;
        /* unsichtbar (display:none, eingeklappter Reiter): beim Aufklappen meldet der Beobachter die Änderung */
        if (!el.getClientRects().length) continue;
        var fg = rgb(cs.color);
        if (!fg) continue;
        var fam = familie(fg); if (!fam) continue;
        var b = grund(el); if (!b) continue;
        if (fg.a < 1) fg = { r: fg.r * fg.a + b.r * (1 - fg.a), g: fg.g * fg.a + b.g * (1 - fg.a), b: fg.b * fg.a + b.b * (1 - fg.a) };
        if (kontrast(fg, b) >= 4.5) continue;
        var dunkelGrund = lum(b) < 0.25;
        el.classList.add('dp-kt-' + fam + (dunkelGrund ? '-d' : ''));
      }
    } catch (e) { /* nie die App stören */ }
    laeuft = false;
    if (offen) planen();   /* während des Laufs gemeldete Änderungen nachholen */
  }
  var timer = null;
  function planen() { if (laeuft) { offen = true; return; } clearTimeout(timer); timer = setTimeout(pruefe, 350); }

  function start() {
    pruefe();
    try {
      new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) { var n = ms[i].target; if (ms[i].type === 'attributes' && n && n.className && /dp-kt-/.test(String(n.className))) continue; planen(); return; }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });   /* Reiterwechsel schalten nur Sichtbarkeit um */
    } catch (e) {}
  }
  window.DpKontrastText = { pruefe: pruefe, version: 'v4850c' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
