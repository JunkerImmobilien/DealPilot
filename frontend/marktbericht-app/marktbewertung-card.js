/* W36-wl-token: Whitelabel-Farbe zur Laufzeit.
   Canvas und SVG-Praesentationsattribute verstehen kein var().
   _wlrgbaH(hex, alpha) ist neu: die Partikel brauchen auch var(--wl-e8c766, #E8C766) als rgba,
   nicht nur das Basisgold. Eigener Guard, damit es sich neben dem schon
   ausgelieferten _wlrgba(alpha) installiert. */
if (!window._wlc) {
  window._wlc = function (h) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--wl-' + h.slice(1).toLowerCase());
      v = (v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch (e) {}
    return h;
  };
}
if (!window._wlrgbaH) {
  window._wlrgbaH = function (h, a) {
    var c = window._wlc(h);
    return 'rgba(' + parseInt(c.substr(1, 2), 16) + ',' + parseInt(c.substr(3, 2), 16) + ',' + parseInt(c.substr(5, 2), 16) + ',' + a + ')';
  };
}
/* =====================================================================
   DealPilot · Marktbewertung-Karte  —  Komponente (Vanilla JS, kein Build)
   Nutzung:
     const card = DealPilotMarktbewertung.mount('#mein-container', DATA);
     card.update(neueDaten);   // Werte spaeter aktualisieren
   DATA-Form siehe README.md / unten im Default.
   ===================================================================== */
(function (global) {
  'use strict';

  const DEFAULT = {
    rating: 'Attraktiv',
    confidence: { label: 'Hoch', pct: 75 },
    meta: { mikro: '100', makro: '53', trend: '+4,2%/J' },
    marktwert: { low: 149000, med: 201000, high: 258000, sqm: '2.055 €/m²' },
    miete:     { low: 572,    med: 674,    high: 814,    sqm: '7,09 €/m² kalt' },
  };

  const eur = n => new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' €';
  const GC = { cx: 52, cy: 50, r: 39 };
  function pt(cx, cy, r, d) { const a = d * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  function arc(cx, cy, r, d1, d2) { const [x1, y1] = pt(cx, cy, r, d1), [x2, y2] = pt(cx, cy, r, d2); return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; }
  function tween(from, to, dur, cb) { const t0 = performance.now(); (function s(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); cb(from + (to - from) * e); if (p < 1) requestAnimationFrame(s); })(performance.now()); }
  function countUp(el, to, fmt, ms) { ms = ms || 750; const from = el._cur || 0, t0 = performance.now(); (function s(t) { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(s); else el._cur = to; })(performance.now()); }

  let GID = 0;
  function tachoSVG(fid) {
    const { cx, cy, r } = GC;
    return `<svg viewBox="0 0 104 60"><defs><filter id="${fid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path d="${arc(cx, cy, r, 180, 124)}" stroke="var(--dpmb-green)" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#${fid})"/>
      <path d="${arc(cx, cy, r, 118, 62)}" stroke="var(--dpmb-gold-t)" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#${fid})"/>
      <path d="${arc(cx, cy, r, 56, 0)}" stroke="var(--dpmb-red)" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#${fid})"/>
      <line class="dpmb-ndl" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - (r - 4)}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" filter="url(#${fid})"/>
      <circle cx="${cx}" cy="${cy}" r="5" fill="var(--dpmb-gold)" stroke="#040405" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="1.9" fill="#fff"/></svg>`;
  }
  function setNeedle(gz, frac) {
    const { cx, cy, r } = GC; const ln = gz.querySelector('.dpmb-ndl'); if (!ln) return;
    const [nx, ny] = pt(cx, cy, r - 4, 180 - Math.max(0, Math.min(1, frac)) * 180);
    ln.setAttribute('x2', nx.toFixed(2)); ln.setAttribute('y2', ny.toFixed(2));
  }

  function particles(canvas) {
    const x = canvas.getContext('2d'); let w, h, ps; const DP = Math.min(2, global.devicePixelRatio || 1);
    function size() { const r = canvas.getBoundingClientRect(); if (!r.width) return; w = r.width; h = r.height; canvas.width = w * DP; canvas.height = h * DP; x.setTransform(DP, 0, 0, DP, 0, 0);
      const n = Math.max(12, Math.min(34, Math.floor(w * h / 9000))); ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .15, vy: (Math.random() - .5) * .15, r: Math.random() * 1.3 + .4, o: Math.random() * .5 + .16, g: Math.random() > .45 })); }
    function loop() { if (w) { x.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy); if (d < 76) { x.strokeStyle = window._wlrgbaH('var(--wl-c9a84c, #C9A84C)', (1 - d / 76) * .12); x.lineWidth = .55; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
      for (const p of ps) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fillStyle = p.g ? window._wlrgbaH('#E8C766', p.o) : `rgba(205,205,215,${p.o * .45})`; x.fill(); } }
      requestAnimationFrame(loop); }
    if ('ResizeObserver' in global) new ResizeObserver(size).observe(canvas); else global.addEventListener('resize', size);
    size(); loop();
  }

  const LOGO = '<span class="dpmb-logo"><span class="dpmb-d">Deal</span><span class="dpmb-p">Pilot</span></span>';
  const ICON_HOME = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + window._wlc('#C9A84C') + '" stroke-width="2" style="vertical-align:-2px;margin-right:5px"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>';
  const ICON_RENT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#83838e" stroke-width="2" style="vertical-align:-2px;margin-right:5px"><path d="M4 21V9l8-6 8 6v12M9 21v-6h6v6"/></svg>';

  function mount(target, data) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) { console.error('[DealPilotMarktbewertung] Ziel-Element nicht gefunden:', target); return null; }
    const fidMw = 'dpmb-f' + (GID++), fidMm = 'dpmb-f' + (GID++);
    el.classList.add('dpmb-card');
    el.innerHTML =
      '<canvas class="dpmb-cfx"></canvas><div class="dpmb-sheen"></div><div class="dpmb-inner">' +
        '<div class="dpmb-head"><div class="dpmb-hl"><span class="dpmb-brand">' + LOGO + '</span>' +
          '<span class="dpmb-eyebrow">Marktbewertung</span><span class="dpmb-rating" data-rating></span></div>' +
          '<span class="dpmb-conf"><span class="dpmb-cd"></span>Aussagekraft: <b data-conf-l></b> · <b data-conf-p></b></span></div>' +
        '<div class="dpmb-sub"><div class="dpmb-it">Mikro <b data-mikro></b></div><div class="dpmb-it">Makro <b data-makro></b></div><div class="dpmb-it">Wertentw. <span class="dpmb-up" data-trend></span></div></div>' +
        '<div class="dpmb-spanne"><span class="dpmb-lab">Spanne</span><div class="dpmb-seg" data-seg><button data-k="unten">Unten</button><button data-k="med" class="dpmb-on">Ø</button><button data-k="oben">Oben</button></div></div>' +
        '<div class="dpmb-mtg">' +
          '<div class="dpmb-b dpmb-mw"><div class="dpmb-mg" data-gz="mw">' + tachoSVG(fidMw) + '</div><div><span class="dpmb-lab">Marktwert</span><div class="dpmb-val" data-val="mw">–</div><span class="dpmb-sqm" data-sqm="mw"></span></div></div>' +
          '<div class="dpmb-b dpmb-mm"><div class="dpmb-mg" data-gz="mm">' + tachoSVG(fidMm) + '</div><div><span class="dpmb-lab">Marktmiete (kalt)</span><div class="dpmb-val" data-val="mm">–</div><span class="dpmb-sqm" data-sqm="mm"></span></div></div>' +
        '</div>' +
        '<div class="dpmb-foot"><small>Marktpreisindikation — kein Gutachten n. § 194 BauGB</small><span class="dpmb-mk2">' + LOGO + '</span></div>' +
      '</div>';

    let D = Object.assign({}, DEFAULT, data || {});
    let mode = 'med'; const lf = { mw: 0, mm: 0 };
    const pick = o => mode === 'unten' ? o.low : mode === 'oben' ? o.high : o.med;
    const fr = o => (pick(o) - o.low) / ((o.high - o.low) || 1);

    function render(newData) {
      if (newData) D = Object.assign({}, DEFAULT, newData);
      el.querySelector('[data-rating]').textContent = D.rating;
      el.querySelector('[data-conf-l]').textContent = D.confidence.label;
      el.querySelector('[data-conf-p]').textContent = D.confidence.pct + ' %';
      el.querySelector('[data-mikro]').textContent = D.meta.mikro;
      el.querySelector('[data-makro]').textContent = D.meta.makro;
      el.querySelector('[data-trend]').textContent = D.meta.trend;
      [['mw', D.marktwert], ['mm', D.miete]].forEach(([k, o]) => {
        const v = pick(o), f = fr(o);
        countUp(el.querySelector('[data-val="' + k + '"]'), v, eur);
        el.querySelector('[data-sqm="' + k + '"]').textContent = o.sqm;
        const gz = el.querySelector('[data-gz="' + k + '"]');
        tween(lf[k], f, 820, ff => setNeedle(gz, ff));
        lf[k] = f;
      });
    }
    el.querySelectorAll('[data-seg] button').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('[data-seg] button').forEach(x => x.classList.remove('dpmb-on'));
      b.classList.add('dpmb-on'); mode = b.dataset.k; render();
    }));
    particles(el.querySelector('.dpmb-cfx'));
    setTimeout(() => render(), 80);
    return { el, update: render, get data() { return D; } };
  }

  global.DealPilotMarktbewertung = { mount: mount };
})(window);
