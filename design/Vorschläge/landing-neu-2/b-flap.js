/* landing-neu-2 · Split-Flap-Anzeige (Idee 06, auch 10 nutzbar). Reines JS, Web Animations. */
(function () {
  'use strict';
  var ZEICHEN = ' ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.,:/%€·+>';
  var ruhig = window.B ? B.ruhig : false;
  function zelle(ch) {
    var z = document.createElement('span');
    z.className = 'fz';
    z.innerHTML = '<span class="o"><i></i></span><span class="u"><i></i></span><span class="fo"><i></i></span><span class="fu"><i></i></span>';
    z._ch = ch || ' ';
    z.querySelectorAll('i').forEach(function (i) { i.textContent = z._ch; });
    return z;
  }
  function setz(z, sel, ch) { z.querySelector(sel + ' i').textContent = ch; }
  function schritt(z, nach, ms) {
    var von = z._ch; z._ch = nach;
    setz(z, '.o', nach); setz(z, '.u', von); setz(z, '.fo', von); setz(z, '.fu', nach);
    var fo = z.querySelector('.fo'), fu = z.querySelector('.fu');
    if (z._a) z._a.forEach(function (a) { a.cancel(); });
    var a1 = fo.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: ms / 2, easing: 'ease-in', fill: 'forwards' });
    var a2 = fu.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: ms / 2, delay: ms / 2, easing: 'cubic-bezier(.3,1.6,.6,1)', fill: 'forwards' });
    a2.onfinish = function () { setz(z, '.u', nach); };
    z._a = [a1, a2];
  }
  function fahre(z, ziel, opt) {
    clearTimeout(z._t);
    if (ruhig || !z.animate) { z._ch = ziel; z.querySelectorAll('i').forEach(function (i) { i.textContent = ziel; }); return; }
    if (z._ch === ziel) return;
    var n = (opt.min || 3) + Math.floor(Math.random() * (opt.streu || 6)), ms = opt.ms || 90, k = 0;
    (function weiter() {
      var ch = k < n ? ZEICHEN.charAt(1 + Math.floor(Math.random() * (ZEICHEN.length - 1))) : ziel;
      schritt(z, ch, ms); k++;
      if (k <= n) z._t = setTimeout(weiter, ms * 0.9);
    })();
  }
  /* el = Behälter, len = Zellenzahl. Rückgabe: { setze(text, opt) } */
  function Tafel(el, len, start) {
    el.classList.add('fl-zeile');
    el.setAttribute('role', 'text');
    var zz = [];
    for (var i = 0; i < len; i++) { var z = zelle(' '); zz.push(z); el.appendChild(z); }
    var api = {
      zellen: zz,
      setze: function (text, opt) {
        opt = opt || {};
        text = String(text).toUpperCase();
        var t = opt.rechts ? (Array(len + 1).join(' ') + text).slice(-len) : (text + Array(len + 1).join(' ')).slice(0, len);
        el.setAttribute('aria-label', text.trim());
        zz.forEach(function (z, i) {
          var ch = t.charAt(i);
          setTimeout(function () { fahre(z, ch, opt); }, ruhig ? 0 : i * (opt.versatz == null ? 35 : opt.versatz));
        });
      }
    };
    if (start) api.setze(start, { versatz: 0, min: 0, streu: 1 });
    return api;
  }
  window.Flap = { Tafel: Tafel };
})();
