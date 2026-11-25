/* Bausatz der Portfolio-Cockpit-Demos (24.11.2026). Bauweise wie grafiken-neu.js:
   SVG als Text, Breite gemessen, Farben über CSS-Variablen in style (nie in SVG-Attributen),
   Tooltip je Marke, neu zeichnen bei Grössenänderung. */
window.K = (function () {
  'use strict';
  if (!document.documentElement.getAttribute('data-theme')) document.documentElement.setAttribute('data-theme', 'light');   /* Runde 3: Hell ist Standard, unabhängig vom System */
  var D = window.DPD;
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var M = '−';
  function eur(v) { return v == null ? 'keine Angabe' : (v < 0 ? M : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function eurV(v) { return v == null ? 'keine Angabe' : (v > 0 ? '+' : v < 0 ? M : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function kurz(v) {
    if (v == null) return '';
    var a = Math.abs(v), s = v < 0 ? M : '';
    if (a >= 1e6) return s + nf2.format(a / 1e6).replace(/,00$/, '').replace(/(,\d)0$/, '$1') + ' Mio';
    if (a >= 1e4) return s + nf0.format(Math.round(a / 1000)) + ' T';
    return s + nf0.format(Math.round(a));
  }
  function kurzEur(v) { return v == null ? '' : (kurz(v) + ' €').replace(' T €', ' T€'); }
  function mio(v) { return Math.abs(v) >= 1e6 ? nf2.format(v / 1e6) + ' Mio €' : nf0.format(Math.round(v / 1000)) + ' T€'; }
  function pct(v, d) { return v == null ? 'keine Angabe' : (d === 0 ? nf0 : nf1).format(v) + ' %'; }
  function pctV(v) { return v == null ? '' : (v > 0 ? '+' : v < 0 ? M : '') + nf1.format(Math.abs(v)) + ' %'; }
  function d2(v) { return v == null ? 'keine Angabe' : nf2.format(v); }
  function f1(v) { return Math.round(v * 10) / 10; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function summe(a, f) { return a.reduce(function (s, x) { var v = f(x); return s + (v == null || !isFinite(v) ? 0 : v); }, 0); }
  function ticks(min, max, n) {
    if (min === max) max = min + 1;
    var roh = (max - min) / (n || 4), p = Math.pow(10, Math.floor(Math.log10(roh))), q = roh / p;
    var st = (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * p;
    var a = Math.floor(min / st) * st, b = Math.ceil(max / st) * st, out = [];
    for (var t = a; t <= b + st / 2; t += st) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  }

  /* ── Ziele: nur wenn im Investmentprofil eingetragen (Schalter in der Demo) ── */
  var zieleAn = true;
  function ziele() { return zieleAn ? D.ziele : null; }
  function setZiele(an) { zieleAn = !!an; neu(); }

  /* ── Tooltip ───────────────────────────────────────────────────────── */
  var tipEl = null, tipFn = {};
  function tip() { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); } return tipEl; }
  function tipZeige(html, ev) {
    var t = tip(); t.innerHTML = html; t.style.display = 'block';
    var w = t.offsetWidth, h = t.offsetHeight, x = ev.clientX + 14, y = ev.clientY - h - 10;
    if (x + w > innerWidth - 6) x = Math.max(6, ev.clientX - w - 14);
    if (y < 6) y = ev.clientY + 16;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  document.addEventListener('mousemove', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!el) { if (tipEl) tipEl.style.display = 'none'; return; }
    var k = el.getAttribute('data-tip'), html = tipFn[k] ? tipFn[k]() : k;
    if (!html) { tipEl && (tipEl.style.display = 'none'); return; }
    tipZeige(html, ev);
  });
  var tipN = 0;
  function tipReg(fn) { var k = 't' + (++tipN); tipFn[k] = fn; return k; }
  function tz(l, r, cls) { return '<div class="t-z"><span>' + esc(l) + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + r + '</b></div>'; }

  /* Objekt-Tooltip: die Zahlen und, falls Ziele eingetragen, der Abgleich */
  function objTip(o) {
    return tipReg(function () {
      var z = ziele(), h = (o.bild ? '<div class="t-bild">' + bild(o, 'ob-tip') + '<span>' + bildText(o) + '</span></div>' : '') + '<div class="t-k">' + esc(o.name) + ' · ' + esc(o.ort) + '</div>';
      h += tz('Objekt', esc(o.art) + (o.we ? ' · ' + o.we + ' WE' : '') + ' · Bj. ' + o.bj);
      h += tz('Kaltmiete', eur(o.mieteJ / 12) + ' / Monat');
      h += tz('Cashflow vor Steuer', eurV(o.cfVs / 12) + ' / Monat', o.cfVs >= 0 ? 't-ok' : 't-nok');
      h += tz('Cashflow nach Steuer', eurV(o.cfNs / 12) + ' / Monat', o.cfNs >= 0 ? 't-ok' : 't-nok');
      h += tz('DSCR', d2(o.dscr));
      if (o.ekr) { var _st = ekStufe(); h += tz('EK-Rendite ' + _st.kurz, pct(ekWert(o.ekr), 1), ekWert(o.ekr) >= 0 ? 't-ok' : 't-nok'); h += '<div class="t-fuss">Stufen: operativ ' + pct(o.ekr.k1, 1) + ', nach Steuer ' + pct(o.ekr.k2, 1) + ', mit Wert ' + pct(o.ekr.k3, 1) + ', gesamt ' + pct(o.ekr.k4, 1) + '</div>'; }
      h += tz('Zinsbindung bis', o.zb.slice(5, 7) + '/' + o.zb.slice(0, 4));
      if (o.mehrMiete > 0) h += tz('Mietpotenzial', eurV(o.mehrMiete) + ' / Jahr', 't-ok');
      if (z) {
        h += '<hr><div class="t-k">Deine Ziele</div>';
        h += tz('DSCR mind. ' + d2(z.minDscr), o.dscr >= z.minDscr ? 'erreicht' : 'nicht erreicht', o.dscr >= z.minDscr ? 't-ok' : 't-nok');
        h += tz('Cashflow vor Steuer mind. ' + eur(z.minCfVs), o.cfVs >= z.minCfVs ? 'erreicht' : 'nicht erreicht', o.cfVs >= z.minCfVs ? 't-ok' : 't-nok');
        h += tz('Beleihung höchstens ' + pct(z.maxLtv, 0), o.ltv <= z.maxLtv ? 'erreicht' : 'darüber', o.ltv <= z.maxLtv ? 't-ok' : 't-nok');
      }
      if (o.empf) h += '<hr>' + tz('Pilot-Empfehlung', esc(o.empf));
      return h;
    });
  }

  function ekKarteSchalten(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-ek-karte]') : null; if (!el) return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault(); setEk(ekNaechste());
    var neuEl = document.querySelector('[data-ek-karte]'); if (neuEl && ev.type === 'keydown') neuEl.focus();
  }
  document.addEventListener('click', ekKarteSchalten); document.addEventListener('keydown', ekKarteSchalten);
  document.addEventListener('focusin', function (ev) { var el = ev.target.closest && ev.target.closest('[data-tip]'); if (!el) return; var k = el.getAttribute('data-tip'), html = tipFn[k] ? tipFn[k]() : k; if (!html) return; var r = el.getBoundingClientRect(); tipZeige(html, { clientX: r.left + r.width / 2, clientY: r.top }); });
  document.addEventListener('focusout', function () { if (tipEl) tipEl.style.display = 'none'; });

  /* ── Module: zeichnen nach gemessener Breite ─────────────────────────── */
  var module = [];
  function modul(sel, fn) { var el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return;
    if (el.id === 'kz' && !el.hasAttribute('data-ohne-ek')) { var _fn = fn; fn = function (w) { var h = _fn(w); if (h.indexOf('EK-Rendite') >= 0) return h; var m = /--kz:(\d+)/.exec(h), n = m ? Number(m[1]) + 1 : null; var kach = kz([ekKachel()], 1).replace(/^<div class="kz"[^>]*>/, '').replace(/<\/div>$/, ''); h = h.replace(/<\/div>$/, kach + '</div>'); return n ? h.replace(/--kz:\d+/, '--kz:' + n) : h; }; } module.push({ el: el, fn: fn }); zeichne(module[module.length - 1]); }
  function zeichne(m) { var w = Math.max(260, Math.floor(m.el.clientWidth)); m.el.innerHTML = m.fn(w); }
  function neu() { module.forEach(zeichne); }
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(neu, 120); });

  function karte(titel, unter, inhalt, extra) {
    return '<div class="k-kopf"><div><h2>' + esc(titel) + '</h2>' + (unter ? '<div class="k-s">' + unter + '</div>' : '') + '</div>' + (extra || '') + '</div>' + inhalt;
  }
  function leg(e) {
    return '<div class="leg">' + e.map(function (x) { return '<span><i class="' + (x.l ? 'l' : x.o ? 'o' : '') + '" style="background:' + x.f + '"></i>' + esc(x.t) + '</span>'; }).join('') + '</div>';
  }
  function kurzName(o, w) { return w < 480 && o.name.length > 16 ? o.name.slice(0, 15) + '…' : o.name; }

  /* 1 · Hantel: zwei Werte je Objekt auf einer Achse (vor/nach, Bestand/Ziel) */
  function hantel(o) {
    var W = o.w, rows = o.rows, rh = o.rh || 22, L = o.L || (W < 480 ? 112 : 150), R = 54, T = 18, B = 20, H = T + rows.length * rh + B;
    var alle = []; rows.forEach(function (r) { alle.push(r.a, r.b); }); if (o.ref != null) alle.push(o.ref);
    var tk = ticks(Math.min(0, Math.min.apply(null, alle)), Math.max(0, Math.max.apply(null, alle)), W < 480 ? 3 : 5);
    var x0 = tk[0], x1 = tk[tk.length - 1], pw = W - L - R, xv = function (v) { return L + (v - x0) / (x1 - x0) * pw; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { s.push('<line class="netz" x1="' + f1(xv(t)) + '" x2="' + f1(xv(t)) + '" y1="' + (T - 4) + '" y2="' + (H - B) + '"/><text class="ax" x="' + f1(xv(t)) + '" y="' + (H - 6) + '" text-anchor="middle">' + (o.fmtAx || kurz)(t) + '</text>'); });
    if (x0 < 0) s.push('<line class="null" x1="' + f1(xv(0)) + '" x2="' + f1(xv(0)) + '" y1="' + (T - 4) + '" y2="' + (H - B) + '"/>');
    if (o.ref != null) s.push('<line class="heute" x1="' + f1(xv(o.ref)) + '" x2="' + f1(xv(o.ref)) + '" y1="' + (T - 8) + '" y2="' + (H - B) + '"/><text class="ax" x="' + f1(xv(o.ref)) + '" y="' + (T - 10) + '" text-anchor="middle" style="fill:var(--gold-d)">' + esc(o.refText || '') + '</text>');
    rows.forEach(function (r, i) {
      var y = T + i * rh + rh / 2, xa = xv(r.a), xb = xv(r.b), up = r.b >= r.a, col = o.farbe ? o.farbe(r) : (up ? 'var(--gruen)' : 'var(--rot)');
      s.push('<g class="z" data-tip="' + r.tip + '"><rect class="zeile-hl" x="0" y="' + (y - rh / 2) + '" width="' + W + '" height="' + rh + '"/>');
      s.push('<text class="lab" x="' + (L - 10) + '" y="' + f1(y + 4) + '" text-anchor="end">' + esc(r.label) + '</text>');
      s.push('<line x1="' + f1(xa) + '" x2="' + f1(xb) + '" y1="' + y + '" y2="' + y + '" style="stroke:' + col + ';stroke-width:3;stroke-linecap:round;opacity:.55"/>');
      s.push('<circle cx="' + f1(xa) + '" cy="' + y + '" r="4.5" style="fill:var(--karte);stroke:var(--grau);stroke-width:2"/>');
      s.push('<circle cx="' + f1(xb) + '" cy="' + y + '" r="5" style="fill:' + col + ';stroke:var(--karte);stroke-width:2"/>');
      s.push('<text class="wl" x="' + (W - 2) + '" y="' + f1(y + 4) + '" text-anchor="end">' + (o.fmtWert || kurz)(r.b) + '</text>');
      s.push('<rect class="treff" x="0" y="' + (y - rh / 2) + '" width="' + W + '" height="' + rh + '"/></g>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* 2 · Gestapelte Querbalken (Teile je Objekt) */
  function stapelQuer(o) {
    var W = o.w, rows = o.rows, rh = o.rh || 20, L = o.L || (W < 480 ? 112 : 150), R = 58, T = 4, B = 20, H = T + rows.length * rh + B;
    var max = Math.max.apply(null, rows.map(function (r) { return summe(r.teile, function (t) { return Math.max(0, t.v); }); }));
    var tk = ticks(0, max, W < 480 ? 3 : 4), x1 = tk[tk.length - 1], pw = W - L - R, xv = function (v) { return L + v / x1 * pw; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { s.push('<line class="netz" x1="' + f1(xv(t)) + '" x2="' + f1(xv(t)) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="ax" x="' + f1(xv(t)) + '" y="' + (H - 6) + '" text-anchor="middle">' + kurz(t) + '</text>'); });
    rows.forEach(function (r, i) {
      var y = T + i * rh, bh = rh - 7, x = L;
      s.push('<g class="z" data-tip="' + r.tip + '"><rect class="zeile-hl" x="0" y="' + y + '" width="' + W + '" height="' + rh + '"/>');
      s.push('<text class="lab" x="' + (L - 10) + '" y="' + f1(y + rh / 2 + 4) + '" text-anchor="end">' + esc(r.label) + '</text>');
      r.teile.forEach(function (t, j) {
        var bw = Math.max(0, xv(t.v) - L); if (bw <= 0) return;
        var last = j === r.teile.length - 1 || !r.teile.slice(j + 1).some(function (u) { return u.v > 0; });
        s.push('<rect x="' + f1(x) + '" y="' + f1(y + 3.5) + '" width="' + f1(Math.max(0, bw - (last ? 0 : 2))) + '" height="' + bh + '" rx="' + (last ? 3 : 0) + '" style="fill:' + t.f + '"/>');
        x += bw;
      });
      s.push('<text class="wl" x="' + (W - 2) + '" y="' + f1(y + rh / 2 + 4) + '" text-anchor="end">' + (r.wert || '') + '</text>');
      s.push('<rect class="treff" x="0" y="' + y + '" width="' + W + '" height="' + rh + '"/></g>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* 3 · Zeitleiste Zinsbindung (Laufbalken bis zum Ende, Punktgrösse = Restschuld) */
  function zeitleiste(o) {
    var W = o.w, rows = o.rows, rh = o.rh || 20, L = W < 480 ? 112 : 150, R = 14, T = 16, B = 20, H = T + rows.length * rh + B;
    var j0 = 2026, j1 = o.bis || 2040, pw = W - L - R, xv = function (j) { return L + (j - j0) / (j1 - j0) * pw; };
    var rMax = Math.max.apply(null, rows.map(function (r) { return r.rest; }));
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Zinsbindung je Objekt">'];
    for (var j = j0; j <= j1; j += (W < 480 ? 4 : 2)) s.push('<line class="netz" x1="' + f1(xv(j)) + '" x2="' + f1(xv(j)) + '" y1="' + (T - 4) + '" y2="' + (H - B) + '"/><text class="ax" x="' + f1(xv(j)) + '" y="' + (H - 6) + '" text-anchor="middle">' + j + '</text>');
    var xh = xv(D.heute); s.push('<line class="heute" x1="' + f1(xh) + '" x2="' + f1(xh) + '" y1="' + (T - 10) + '" y2="' + (H - B) + '"/><text class="ax" x="' + f1(xh + 4) + '" y="' + (T - 8) + '" style="fill:var(--gold-d)">heute</text>');
    var x3 = xv(D.heute + 3); s.push('<rect x="' + f1(xh) + '" y="' + (T - 4) + '" width="' + f1(x3 - xh) + '" height="' + (H - B - T + 4) + '" style="fill:var(--rot);fill-opacity:.06"/>');
    s.push('<text class="ax" x="' + f1((xh + x3) / 2) + '" y="' + (T - 8) + '" text-anchor="middle" style="fill:var(--rot)">' + (W < 480 ? '' : 'nächste 3 Jahre') + '</text>');
    rows.forEach(function (r, i) {
      var y = T + i * rh + rh / 2, xe = xv(Math.min(j1, r.ende)), col = r.ende - D.heute <= 3 ? 'var(--rot)' : r.ende - D.heute <= 5 ? 'var(--amber)' : 'var(--gruen)';
      var rad = 3 + 7 * Math.sqrt(r.rest / rMax);
      s.push('<g class="z" data-tip="' + r.tip + '"><rect class="zeile-hl" x="0" y="' + (y - rh / 2) + '" width="' + W + '" height="' + rh + '"/>');
      s.push('<text class="lab" x="' + (L - 10) + '" y="' + f1(y + 4) + '" text-anchor="end">' + esc(r.label) + '</text>');
      s.push('<line x1="' + f1(xh) + '" x2="' + f1(xe) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--grau);stroke-width:2;stroke-linecap:round;opacity:.7"/>');
      s.push('<circle cx="' + f1(xe) + '" cy="' + y + '" r="' + f1(rad) + '" style="fill:' + col + ';fill-opacity:.85;stroke:var(--karte);stroke-width:2"/>');
      s.push('<rect class="treff" x="0" y="' + (y - rh / 2) + '" width="' + W + '" height="' + rh + '"/></g>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* 4 · Säulen je Jahr (einfach oder gestapelt) */
  function saeulen(o) {
    var W = o.w, H = o.h || 200, L = 48, R = 8, T = 14, B = 24, n = o.x.length;
    var max = 0, min = 0;
    for (var i = 0; i < n; i++) { var p = 0, q = 0; o.reihen.forEach(function (r) { var v = r.werte[i] || 0; if (v >= 0) p += v; else q += v; }); max = Math.max(max, p); min = Math.min(min, q); }
    var tk = ticks(min, max, 4), y0 = tk[0], y1 = tk[tk.length - 1], ph = H - T - B, pw = W - L - R, dx = pw / n, bw = Math.min(34, dx * .62);
    var yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { s.push('<line class="netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="ax" x="' + (L - 6) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurz(t) + '</text>'); });
    if (y0 < 0) s.push('<line class="null" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '"/>');
    var jede = Math.ceil(n / Math.max(1, Math.floor(pw / 38)));
    for (i = 0; i < n; i++) {
      var cx = L + dx * i + dx / 2, bp = 0, bn = 0, k = o.tip ? o.tip(i) : '';
      s.push('<g class="z"' + (k ? ' data-tip="' + k + '"' : '') + '><rect class="zeile-hl" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/>');
      o.reihen.forEach(function (r, ri) {
        var v = r.werte[i] || 0; if (!v) return;
        var a = v >= 0 ? bp : bn, b = a + v; if (v >= 0) bp = b; else bn = b;
        var top = yv(Math.max(a, b)), hh = Math.max(1, Math.abs(yv(a) - yv(b)) - 1);
        s.push('<rect x="' + f1(cx - bw / 2) + '" y="' + f1(top) + '" width="' + f1(bw) + '" height="' + f1(hh) + '" rx="2" style="fill:' + (r.farbe || 'var(--gold)') + '"/>');
      });
      if (o.summe) s.push('<text class="wl" x="' + f1(cx) + '" y="' + f1(yv(bp) - 5) + '" text-anchor="middle">' + (bp ? kurz(bp) : '') + '</text>');
      if (i % jede === 0) s.push('<text class="ax" x="' + f1(cx) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(o.x[i]) + '</text>');
      s.push('<rect class="treff" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/></g>');
    }
    s.push('</svg>'); return s.join('');
  }

  /* 5 · Wasserfall (Cashflow-Brücke, Steuerkette) */
  function wasserfall(o) {
    var W = o.w, H = o.h || 210, L = 50, R = 8, T = 18, B = o.B || 34, n = o.schritte.length, lauf = 0, pts = [];
    o.schritte.forEach(function (st) { if (st.summe) { pts.push([0, st.v]); lauf = st.v; } else { pts.push([lauf, lauf + st.v]); lauf += st.v; } });
    var alle = [0]; pts.forEach(function (p) { alle.push(p[0], p[1]); });
    var tk = ticks(Math.min.apply(null, alle), Math.max.apply(null, alle), 4), y0 = tk[0], y1 = tk[tk.length - 1], ph = H - T - B, pw = W - L - R, dx = pw / n, bw = Math.min(44, dx * .64);
    var yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { s.push('<line class="netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="ax" x="' + (L - 6) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurz(t) + '</text>'); });
    s.push('<line class="null" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '"/>');
    o.schritte.forEach(function (st, i) {
      var p = pts[i], cx = L + dx * i + dx / 2, top = yv(Math.max(p[0], p[1])), hh = Math.max(1.5, Math.abs(yv(p[0]) - yv(p[1])));
      var col = st.summe ? (st.v >= 0 ? 'var(--gold)' : 'var(--rot)') : (st.v >= 0 ? 'var(--gruen)' : 'var(--rot)');
      s.push('<g class="z" data-tip="' + tipReg(function () { return '<div class="t-k">' + esc(st.t) + '</div>' + tz(st.summe ? 'Stand' : 'Beitrag', st.summe ? eur(st.v) : eurV(st.v)) + (st.info ? '<div style="margin-top:3px;color:#BDB6A8;white-space:normal">' + esc(st.info) + '</div>' : ''); }) + '">');
      s.push('<rect class="zeile-hl" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/>');
      s.push('<rect x="' + f1(cx - bw / 2) + '" y="' + f1(top) + '" width="' + f1(bw) + '" height="' + f1(hh) + '" rx="2" style="fill:' + col + (st.summe ? '' : ';fill-opacity:.85') + '"/>');
      if (i < n - 1 && !o.schritte[i + 1].summe) s.push('<line x1="' + f1(cx + bw / 2) + '" x2="' + f1(cx + dx - bw / 2) + '" y1="' + f1(yv(p[1])) + '" y2="' + f1(yv(p[1])) + '" style="stroke:var(--grau);stroke-dasharray:2 2"/>');
      s.push('<text class="wl" x="' + f1(cx) + '" y="' + f1(top - 5) + '" text-anchor="middle">' + (st.summe ? kurz(st.v) : (st.v > 0 ? '+' : '') + kurz(st.v)) + '</text>');
      var lab = dx < 78 && st.k ? st.k : st.t.length > 12 && dx < 70 ? st.t.slice(0, 11) + '…' : st.t;
      s.push('<text class="ax" x="' + f1(cx) + '" y="' + (H - B + 14) + '" text-anchor="middle">' + esc(lab) + '</text>');
      if (st.t2) s.push('<text class="ax" x="' + f1(cx) + '" y="' + (H - B + 26) + '" text-anchor="middle">' + esc(st.t2) + '</text>');
      s.push('<rect class="treff" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/></g>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* 6 · Streupunkte mit Bezugslinien */
  function streu(o) {
    var W = o.w, H = o.h || 260, L = 42, R = 12, T = 14, B = 30, pts = o.punkte;
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    if (o.refX != null) xs.push(o.refX); if (o.refY != null) ys.push(o.refY);
    var tx = ticks(Math.min(0, Math.min.apply(null, xs)), Math.max.apply(null, xs), 5), ty = ticks(Math.min(0, Math.min.apply(null, ys)), Math.max.apply(null, ys), 4);
    var pw = W - L - R, ph = H - T - B, xv = function (v) { return L + (v - tx[0]) / (tx[tx.length - 1] - tx[0]) * pw; }, yv = function (v) { return T + ph - (v - ty[0]) / (ty[ty.length - 1] - ty[0]) * ph; };
    var rMax = Math.max.apply(null, pts.map(function (p) { return p.r || 1; }));
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tx.forEach(function (t) { s.push('<line class="netz" x1="' + f1(xv(t)) + '" x2="' + f1(xv(t)) + '" y1="' + T + '" y2="' + (T + ph) + '"/><text class="ax" x="' + f1(xv(t)) + '" y="' + (H - 14) + '" text-anchor="middle">' + (o.fx || nf1.format)(t) + '</text>'); });
    ty.forEach(function (t) { s.push('<line class="netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="ax" x="' + (L - 6) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + (o.fy || nf1.format)(t) + '</text>'); });
    if (o.refY != null) { s.push('<rect x="' + L + '" y="' + f1(yv(o.refY)) + '" width="' + pw + '" height="' + f1(T + ph - yv(o.refY)) + '" style="fill:var(--rot);fill-opacity:.05"/><line class="heute" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(o.refY)) + '" y2="' + f1(yv(o.refY)) + '"/><text class="ax" x="' + (W - R) + '" y="' + f1(yv(o.refY) - 4) + '" text-anchor="end" style="fill:var(--gold-d)">' + esc(o.refYText || '') + '</text>'); }
    if (o.refX != null) s.push('<line class="heute" x1="' + f1(xv(o.refX)) + '" x2="' + f1(xv(o.refX)) + '" y1="' + T + '" y2="' + (T + ph) + '"/>');
    s.push('<text class="ax" x="' + (L + pw / 2) + '" y="' + (H - 1) + '" text-anchor="middle">' + esc(o.xText || '') + '</text>');
    var belegt = [];
    pts.slice().sort(function (a, b) { return (b.r || 1) - (a.r || 1); }).forEach(function (p) {
      var rad = 4 + 9 * Math.sqrt((p.r || 1) / rMax);
      s.push('<g data-tip="' + p.tip + '"><circle cx="' + f1(xv(p.x)) + '" cy="' + f1(yv(p.y)) + '" r="' + f1(rad) + '" style="fill:' + (p.f || 'var(--gold)') + ';fill-opacity:.8;stroke:var(--karte);stroke-width:2"/><circle cx="' + f1(xv(p.x)) + '" cy="' + f1(yv(p.y)) + '" r="' + f1(rad + 6) + '" class="treff"/></g>');
      var lx = xv(p.x) + rad + 4, ly = yv(p.y) + 4, frei = !belegt.some(function (b) { return Math.abs(b[1] - ly) < 13 && Math.abs(b[0] - lx) < 70; });
      if (p.lab && frei) { belegt.push([lx, ly]); s.push('<text class="lab-l" x="' + f1(lx) + '" y="' + f1(ly) + '"' + (lx > W - 70 ? ' text-anchor="end" dx="' + f1(-2 * rad - 8) + '"' : '') + '>' + esc(p.lab) + '</text>'); }
    });
    s.push('</svg>'); return s.join('');
  }

  /* 7 · Fläche und Linien über Jahre (Vermögensaufbau) */
  function flaeche(o) {
    var W = o.w, H = o.h || 200, L = 52, R = 56, T = 14, B = 24, xs = o.x, n = xs.length;
    var alle = [0]; o.reihen.forEach(function (r) { alle = alle.concat(r.werte); });
    var tk = ticks(0, Math.max.apply(null, alle), 4), y1 = tk[tk.length - 1], ph = H - T - B, pw = W - L - R;
    var xv = function (i) { return L + (xs[i] - xs[0]) / (xs[n - 1] - xs[0]) * pw; }, yv = function (v) { return T + ph - v / y1 * ph; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { s.push('<line class="netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="ax" x="' + (L - 6) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurz(t) + '</text>'); });
    xs.forEach(function (x, i) { s.push('<text class="ax" x="' + f1(xv(i)) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(o.xl ? o.xl[i] : x) + '</text>'); });
    o.reihen.forEach(function (r) {
      var d = r.werte.map(function (v, i) { return (i ? 'L' : 'M') + f1(xv(i)) + ' ' + f1(yv(v)); }).join(' ');
      if (r.flaeche) s.push('<path d="' + d + ' L' + f1(xv(n - 1)) + ' ' + f1(yv(0)) + ' L' + f1(xv(0)) + ' ' + f1(yv(0)) + 'Z" style="fill:' + r.farbe + ';fill-opacity:.16"/>');
      s.push('<path d="' + d + '" style="fill:none;stroke:' + r.farbe + ';stroke-width:2;' + (r.strich ? 'stroke-dasharray:4 3' : '') + '"/>');
      r.werte.forEach(function (v, i) { s.push('<circle cx="' + f1(xv(i)) + '" cy="' + f1(yv(v)) + '" r="3.5" style="fill:' + r.farbe + ';stroke:var(--karte);stroke-width:2"/>'); });
      r._ly = yv(r.werte[n - 1]);
    });
    var lab = o.reihen.slice().sort(function (a, b) { return a._ly - b._ly; }); for (var q = 1; q < lab.length; q++) if (lab[q]._ly - lab[q - 1]._ly < 13) lab[q]._ly = lab[q - 1]._ly + 13;
    lab.forEach(function (r) { s.push('<text class="wl" x="' + f1(xv(n - 1) + 8) + '" y="' + f1(r._ly + 4) + '" style="fill:' + r.farbe + '">' + kurz(r.werte[n - 1]) + '</text>'); });
    xs.forEach(function (x, i) {
      var k = o.tip ? o.tip(i) : ''; var x0 = i ? (xv(i - 1) + xv(i)) / 2 : L, x1 = i < n - 1 ? (xv(i) + xv(i + 1)) / 2 : W - R;
      s.push('<rect class="treff" data-tip="' + k + '" x="' + f1(x0) + '" y="' + T + '" width="' + f1(x1 - x0) + '" height="' + ph + '"/>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* 8 · Fortschrittsbalken gegen ein Ziel (Bullet) */
  function bullet(label, wert, ziel, max, fmt, gut) {
    var p = Math.max(0, Math.min(100, wert / max * 100)), z = ziel != null ? Math.max(0, Math.min(100, ziel / max * 100)) : null;
    var ok = ziel == null ? null : (gut === 'unter' ? wert <= ziel : wert >= ziel);
    return '<div style="margin:0 0 9px"><div style="display:flex;justify-content:space-between;font:500 12px Inter"><span>' + esc(label) + '</span><b style="font:600 12px JetBrains Mono,monospace">' + fmt(wert) + (ziel != null ? ' <span style="color:var(--leise);font-weight:400">Ziel ' + fmt(ziel) + '</span>' : '') + '</b></div>' +
      '<div style="position:relative;height:8px;border-radius:4px;background:var(--netz);margin-top:4px"><div style="position:absolute;left:0;top:0;bottom:0;width:' + p + '%;border-radius:4px;background:' + (ok == null ? 'var(--gold)' : ok ? 'var(--gruen)' : 'var(--rot)') + '"></div>' +
      (z != null ? '<div style="position:absolute;left:' + z + '%;top:-3px;bottom:-3px;width:2px;background:var(--tinte)"></div>' : '') + '</div></div>';
  }

  /* 9 · Score-Ring */
  function ring(score) {
    if (score == null) return '<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" style="fill:none;stroke:var(--netz);stroke-width:3.5"/><text x="18" y="22" text-anchor="middle" class="ax">?</text></svg>';
    var c = 2 * Math.PI * 15, col = score >= 70 ? 'var(--gruen)' : score >= 50 ? 'var(--gold)' : 'var(--rot)';
    return '<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" style="fill:none;stroke:var(--netz);stroke-width:3.5"/><circle cx="18" cy="18" r="15" transform="rotate(-90 18 18)" style="fill:none;stroke:' + col + ';stroke-width:3.5;stroke-linecap:round;stroke-dasharray:' + f1(c * score / 100) + ' ' + f1(c) + '"/><text x="18" y="22" text-anchor="middle" style="font:600 11px Space Grotesk,Inter;fill:var(--tinte)">' + score + '</text></svg>';
  }
  function stufeWort(s) { return s == null ? 'ohne Score' : s >= 85 ? 'Sehr gut' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch'; }

  /* ── Score-Kopf: wie heute oben im Portfolio-Cockpit, in jeder Demo gleich ── */
  function scoreKopf() {
    var s = D.score;
    function teil(t, farbeGut) {
      var col = t[2] >= 70 ? 'var(--gruen)' : 'var(--gold)';
      return '<div class="sk-t" data-tip="' + tipReg(function () { return '<div class="t-k">' + esc(t[0]) + '</div>' + tz('Punkte', t[2] + ' von 100') + tz('Gewicht', nf1.format(t[1]) + ' %') + '<div style="color:#BDB6A8;white-space:normal;margin-top:3px">' + esc(t[3]) + '</div>'; }) + '"><div class="sk-tz"><span>' + esc(t[0]) + ' <small>' + nf1.format(t[1]) + ' %</small></span><b>' + t[2] + '</b></div><div class="sk-bar"><i style="width:' + t[2] + '%;background:' + col + '"></i></div></div>';
    }
    function haelfte(x, titel) {
      return '<div class="sk-h"><div class="sk-hk">' + ring(x.wert).replace('class="ring"', 'class="sk-ring"') + '<div><div class="sk-ht">' + titel + ' <span class="pill">' + stufeWort(x.wert).toUpperCase() + '</span></div><div class="sk-hf">' + esc(x.frage) + ' Zählt ' + x.anteil + ' %.</div></div></div>' + x.teile.map(teil).join('') + '</div>';
    }
    return '<div class="sk"><div class="sk-bar0"><div class="sk-g"><span>Gesamturteil · Investor Portfolio Score</span><b>' + s.wort + ' <small>' + s.gesamt + ' / 100</small></b></div>' +
      '<div class="sk-m"><span>Objekte</span><b>' + D.objekte.length + '</b></div><div class="sk-m"><span>Volumen</span><b>' + mio(s.vol).replace(' €', '') + '</b></div><div class="sk-m"><span>CF / Monat</span><b style="color:#7CCB9C">' + eurV(s.cfMon).replace(' €', '') + '</b></div>' +
      '<div class="sk-txt">Gesamt aus Investment <b>' + s.inv.wert + '</b> (' + s.inv.anteil + ' %) und Finanzierung <b>' + s.fin.wert + '</b> (' + s.fin.anteil + ' %), ' + esc(s.gezaehlt) + '.</div></div>' +
      '<div class="sk-zwei">' + haelfte(s.inv, 'Investment-Score') + haelfte(s.fin, 'Finanzierungs-Score') + '</div></div>';
  }

  /* ── Treemap (Streifen, nach Grösse) ────────────────────────────────── */
  function treemap(o) {
    var W = o.w, H = o.h || 320, items = o.items.slice().sort(function (a, b) { return b.v - a.v; }), tot = summe(items, function (x) { return x.v; });
    var rects = [];
    (function lege(list, x, y, w, h) {
      if (!list.length) return;
      if (list.length === 1) { rects.push({ it: list[0], x: x, y: y, w: w, h: h }); return; }
      var s = summe(list, function (z) { return z.v; }), acc = 0, i = 0;
      while (i < list.length - 1 && (acc + list[i].v) / s < 0.5) acc += list[i++].v;
      if (i === 0) { acc = list[0].v; i = 1; }
      var a = list.slice(0, i), b = list.slice(i), f = acc / s;
      if (w >= h) { lege(a, x, y, w * f, h); lege(b, x + w * f, y, w * (1 - f), h); }
      else { lege(a, x, y, w, h * f); lege(b, x, y + h * f, w, h * (1 - f)); }
    })(items, 0, 0, W, H);
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    rects.forEach(function (r) {
      var gx = 2, big = r.w > 90 && r.h > 44;
      s.push('<g data-tip="' + r.it.tip + '"><rect x="' + f1(r.x + gx / 2) + '" y="' + f1(r.y + gx / 2) + '" width="' + f1(Math.max(0, r.w - gx)) + '" height="' + f1(Math.max(0, r.h - gx)) + '" rx="6" style="fill:' + r.it.f + ';cursor:default"/>');
      if (big) s.push('<text x="' + f1(r.x + 9) + '" y="' + f1(r.y + 19) + '" style="font:600 12px Space Grotesk,Inter;fill:#fff">' + esc(r.it.label.length * 6.5 > r.w - 14 ? r.it.label.slice(0, Math.floor((r.w - 14) / 6.5)) + '…' : r.it.label) + '</text><text x="' + f1(r.x + 9) + '" y="' + f1(r.y + 35) + '" style="font:600 11px JetBrains Mono,monospace;fill:#fff;fill-opacity:.85">' + esc(r.it.sub || '') + '</text>');
      s.push('</g>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* ── Flugplan: Ereignisse je Objekt über die Jahre ───────────────────── */
  function flugplan(o) {
    var W = o.w, rows = o.rows, rh = o.rh || 26, L = W < 480 ? 104 : 168, R = 12, T = 26, B = 22, H = T + rows.length * rh + B, j0 = o.von || 2026, j1 = o.bis || 2037;
    var pw = W - L - R, xv = function (j) { return L + (j - j0) / (j1 - j0) * pw; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Flugplan">'];
    for (var j = j0; j <= j1; j++) { s.push('<line class="netz" x1="' + f1(xv(j)) + '" x2="' + f1(xv(j)) + '" y1="' + (T - 6) + '" y2="' + (H - B) + '"/>'); if (W > 480 || j % 2 === 0) s.push('<text class="ax" x="' + f1(xv(j)) + '" y="' + (H - 6) + '" text-anchor="middle">' + j + '</text>'); }
    var xh = xv(D.heute); s.push('<line class="heute" x1="' + f1(xh) + '" x2="' + f1(xh) + '" y1="' + (T - 14) + '" y2="' + (H - B) + '"/><text class="ax" x="' + f1(xh + 4) + '" y="' + (T - 12) + '" style="fill:var(--gold-d)">heute</text>');
    rows.forEach(function (r, i) {
      var y = T + i * rh + rh / 2;
      s.push('<g class="z"><rect class="zeile-hl" x="0" y="' + (y - rh / 2) + '" width="' + W + '" height="' + rh + '"/>');
      s.push('<text class="lab" x="' + (L - 10) + '" y="' + f1(y + 4) + '" text-anchor="end" data-tip="' + r.tip + '">' + esc(r.label) + '</text>');
      if (r.balken) r.balken.forEach(function (b) { s.push('<rect x="' + f1(xv(Math.max(j0, b.von))) + '" y="' + (y - 4) + '" width="' + f1(Math.max(2, xv(Math.min(j1, b.bis)) - xv(Math.max(j0, b.von)))) + '" height="8" rx="4" style="fill:' + b.f + ';fill-opacity:.35"/>'); });
      r.ev.forEach(function (e) {
        if (e.j < j0 || e.j > j1) return;
        var x = xv(e.j), k = tipReg(function () { return '<div class="t-k">' + esc(r.label) + '</div>' + esc(e.t); });
        if (e.form === 'raute') s.push('<g data-tip="' + k + '"><rect x="' + f1(x - 5.5) + '" y="' + f1(y - 5.5) + '" width="11" height="11" transform="rotate(45 ' + f1(x) + ' ' + f1(y) + ')" style="fill:' + e.f + ';stroke:var(--karte);stroke-width:2"/><circle class="treff" cx="' + f1(x) + '" cy="' + y + '" r="11"/></g>');
        else s.push('<g data-tip="' + k + '"><circle cx="' + f1(x) + '" cy="' + y + '" r="' + (e.r || 5.5) + '" style="fill:' + e.f + ';stroke:var(--karte);stroke-width:2"/><circle class="treff" cx="' + f1(x) + '" cy="' + y + '" r="11"/></g>');
      });
      s.push('</g>');
    });
    s.push('</svg>'); return s.join('');
  }

  /* ── Messinstrument (Halbkreis) ─────────────────────────────────────── */
  function instrument(o) {
    var W = 200, H = 128, cx = 100, cy = 104, r = 78, a0 = Math.PI, a1 = 0;
    function pt(v, rr) { var t = a0 + (a1 - a0) * Math.max(0, Math.min(1, (v - o.min) / (o.max - o.min))); return [cx + Math.cos(t) * rr, cy - Math.sin(t) * rr]; }
    function bogen(v0, v1, col, wd) { var p0 = pt(v0, r), p1 = pt(v1, r); return '<path d="M' + f1(p0[0]) + ' ' + f1(p0[1]) + ' A' + r + ' ' + r + ' 0 0 1 ' + f1(p1[0]) + ' ' + f1(p1[1]) + '" style="fill:none;stroke:' + col + ';stroke-width:' + wd + ';stroke-linecap:round"/>'; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="max-width:240px;margin:0 auto">' + bogen(o.min, o.max, 'var(--instr-spur)', 10);
    (o.zonen || []).forEach(function (z) { s += bogen(z[0], z[1], z[2], 3); });
    s += bogen(o.min, Math.max(o.min, Math.min(o.max, o.wert)), o.farbe || 'var(--gold)', 10);
    if (o.ziel != null) { var a = pt(o.ziel, r - 12), b = pt(o.ziel, r + 12); s += '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" style="stroke:var(--tinte);stroke-width:2"/>'; }
    s += '<text x="' + cx + '" y="' + (cy - 14) + '" text-anchor="middle" style="font:600 26px Space Grotesk,Inter;fill:var(--tinte)">' + esc(o.text) + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 8) + '" text-anchor="middle" style="font:600 9.5px JetBrains Mono,monospace;letter-spacing:.08em;fill:var(--leise)">' + esc(o.label.toUpperCase()) + '</text></svg>';
    return s;
  }

  /* ── Marcels Liebling: Bestand · Soll · Zielbild je Objekt ────────────── */
  function bszTabelle(opt) {
    opt = opt || {};
    var os = D.objekte.slice().sort(function (a, b) { return (b.zuwachs == null ? -1e9 : b.zuwachs) - (a.zuwachs == null ? -1e9 : a.zuwachs); });
    if (opt.top) os = os.slice(0, opt.top);
    var maxMehr = Math.max.apply(null, D.objekte.map(function (o) { return o.mehrMiete / o.mieteB; }));
    var h = '<div class="tab-wrap"><table class="tab"><thead>';
    var det = detailAn && !opt.schmal;
    h += '<tr class="gruppe"><th></th><th colspan="3">Kaltmiete im Jahr</th><th colspan="2">Ertragswert</th><th colspan="' + (opt.schmal ? 2 : 4) + '"></th>' + (det ? '<th colspan="2">EK-Rendite</th>' : '') + '</tr>';
    h += '<tr><th>Objekt</th><th>Bestand</th><th>Zielbild</th><th>Hebel</th><th>Bestand</th><th>Zielbild</th><th>Maßnahmen</th><th>Zuwachs nach Kosten</th>' + (opt.schmal ? '' : '<th>DSCR</th><th>Stand</th>') + (det ? '<th>' + esc(ekStufe().kurz) + '</th><th>Eigenkapital</th>' : '') + '</tr></thead><tbody>';
    os.forEach(function (o) {
      var z = ziele(), dscrCls = z ? (o.dscr >= z.minDscr ? 'plus' : 'minus') : '';
      var mp = o.mieteB ? o.mehrMiete / o.mieteB : 0;
      var st = o.stufe === 'zielbild' ? '<span class="pill">Zielbild</span>' : o.stufe === 'mieterhoehung' ? '<span class="pill a">Mieterhöhung</span>' : '<span class="pill n">nur Bestand</span>';
      h += '<tr data-tip="' + objTip(o) + '"><td class="mit-bild">' + bild(o, 'ob-mini') + '<span class="o-n">' + esc(o.name) + '</span><span class="o-o">' + esc(o.ort) + ' · ' + esc(o.art) + (o.we > 1 ? ' · ' + o.we + ' WE' : '') + '</span></td>';
      h += '<td>' + eur(o.mieteB) + '</td><td>' + eur(o.mieteZ) + '</td>';
      h += '<td class="' + (o.mehrMiete > 0 ? 'plus' : 'leis') + '">' + (o.mehrMiete > 0 ? pctV(mp * 100) : 'keiner') + '<span class="mini"><i style="width:' + Math.round(mp / maxMehr * 100) + '%"></i></span></td>';
      h += '<td>' + (o.ewB != null ? kurzEur(o.ewB) : '<span class="leis">offen</span>') + '</td><td>' + (o.ewZ != null ? kurzEur(o.ewZ) : '<span class="leis">offen</span>') + '</td>';
      h += '<td>' + (o.massn ? kurzEur(o.massn) : '<span class="leis">keine</span>') + '</td>';
      h += '<td class="' + (o.zuwachs > 0 ? 'plus' : o.zuwachs < 0 ? 'minus' : 'leis') + '">' + (o.zuwachs != null ? eurV(o.zuwachs) : 'offen') + '</td>';
      if (!opt.schmal) h += '<td class="' + dscrCls + '">' + d2(o.dscr) + '</td><td>' + st + '</td>';
      if (det) { var _v = ekWert(o.ekr); h += '<td class="' + ekKlasse(_v) + '">' + pct(_v, 1) + '</td><td>' + kurzEur(o.ek) + '</td>'; }
      h += '</tr>';
    });
    var zb = D.zielbild;
    h += '</tbody><tfoot><tr><td>Portfolio' + (opt.top ? ' (alle 18)' : '') + '</td><td>' + kurzEur(zb.mieteB) + '</td><td>' + kurzEur(zb.mieteZ) + '</td><td class="plus">' + pctV((zb.mieteZ / zb.mieteB - 1) * 100) + '</td><td>' + kurzEur(zb.ewB) + '</td><td>' + kurzEur(zb.ewZ) + '</td><td>' + kurzEur(zb.massn) + '</td><td class="plus">' + eurV(zb.zuwachsNK) + '</td>' + (opt.schmal ? '' : '<td>' + d2(D.summe.dscr) + '</td><td></td>') + (det ? '<td class="' + ekKlasse(ekWert(D.ekrP)) + '">' + pct(ekWert(D.ekrP), 1) + '</td><td>' + kurzEur(D.ekrP.ek) + '</td>' : '') + '</tr></tfoot></table></div>';
    return h;
  }

  /* ── Hinweise: was jetzt zu tun ist, aus Regeln ─────────────────────── */
  function hinweise(max) {
    var z = ziele(), out = [], O = D.objekte;
    var zbBald = O.filter(function (o) { return o.zbRest <= 4; }).sort(function (a, b) { return a.zbRest - b.zbRest; });
    zbBald.forEach(function (o) { out.push({ c: o.zbRest <= 3 ? 'r' : 'a', t: '<b>' + esc(o.name) + '</b> Zinsbindung endet ' + o.zb.slice(5, 7) + '/' + o.zb.slice(0, 4) + '. Anschluss jetzt anfragen.', w: 'rund ' + kurzEur(o.restZb) }); });
    var unter = O.filter(function (o) { return z && o.dscr < z.minDscr; }).sort(function (a, b) { return a.dscr - b.dscr; });
    if (unter.length) out.push({ c: 'r', t: '<b>' + unter.length + ' Objekte</b> unter deinem DSCR-Ziel ' + d2(z.minDscr) + ', am tiefsten ' + esc(unter[0].name) + '.', w: 'DSCR ' + d2(unter[0].dscr) });
    var neg = O.filter(function (o) { return o.cfVs < 0; });
    if (neg.length) out.push({ c: 'a', t: '<b>' + neg.length + ' Objekte</b> zahlen monatlich zu. Zusammen ' + eur(summe(neg, function (o) { return o.cfVs; }) / 12) + ' im Monat vor Steuer.', w: eurV(summe(neg, function (o) { return o.cfVs; })) + ' / J' });
    var hebel = O.filter(function (o) { return o.mehrMiete > 0; }).sort(function (a, b) { return b.mehrMiete - a.mehrMiete; });
    if (hebel.length) out.push({ c: 'g', t: 'Größter Miethebel: <b>' + esc(hebel[0].name) + '</b>, danach ' + esc(hebel[1].name) + '.', w: eurV(hebel[0].mehrMiete) + ' / J' });
    var teuer = O.filter(function (o) { return o.zuwachs != null && o.zuwachs < 0; });
    teuer.forEach(function (o) { out.push({ c: 'a', t: '<b>' + esc(o.name) + '</b> Maßnahmen kosten mehr, als sie an Wert bringen. Plan prüfen.', w: eurV(o.zuwachs) }); });
    var en = O.filter(function (o) { return o.energie === 'F' || o.energie === 'G'; });
    if (en.length) out.push({ c: 'a', t: '<b>' + en.length + ' Objekte</b> mit Energieklasse F oder G: ' + en.map(function (o) { return esc(o.name); }).join(', ') + '.', w: 'CO₂ Kosten' });
    var ohne = O.filter(function (o) { return o.ewB == null; });
    if (ohne.length) out.push({ c: 'i', t: '<b>' + ohne.length + ' Objekte</b> ohne Ertragswert. Zielbild rechnen, damit der Bestand vollständig ist.', w: 'kostenlos' });
    var vk = O.filter(function (o) { return o.empf === 'Verkauf prüfen'; });
    if (vk.length) out.push({ c: 'i', t: 'Pilot rät bei <b>' + vk.map(function (o) { return esc(o.name); }).join(' und ') + '</b> zu prüfen, ob ein Verkauf sinnvoll ist.', w: '' });
    out = out.slice(0, max || 8);
    return '<ul class="todo">' + out.map(function (x) { return '<li class="' + x.c + '"><span class="ic">' + (x.c === 'r' ? '!' : x.c === 'a' ? '!' : x.c === 'g' ? '↑' : 'i') + '</span><span>' + x.t + '</span><span class="wert">' + x.w + '</span></li>'; }).join('') + '</ul>';
  }

  /* ── Kennzahlen aus den Objekten ─────────────────────────────────────── */
  function kennzahlen() {
    var O = D.objekte, S = D.summe;
    var wert = summe(O, function (o) { return o.wert; }), rest = S.rest;
    return {
      n: O.length, we: summe(O, function (o) { return o.we || 1; }), wert: wert, rest: rest, ekHeute: wert - rest, ekEin: S.ek,
      ltv: rest / wert * 100, mieteJ: S.mieteJ, cfVsJ: S.cfVsJ, cfNsJ: S.cfNsJ, dscr: S.dscr, zinsJ: S.zinsJ, tilgJ: S.tilgJ,
      coc: S.cfVsJ / S.ek * 100, bald: O.filter(function (o) { return o.zbRest <= 3; }), unterZiel: O.filter(function (o) { return o.dscr < D.ziele.minDscr; }),
      leerEur: summe(O, function (o) { return o.mieteJ * (o.leer || 0) / 100; }), mehrMiete: D.zielbild.mieteZ - D.zielbild.mieteB,
      wfl: summe(O, function (o) { return o.wfl; })
    };
  }
  function kz(fs, spalten) {
    return '<div class="kz" style="--kz:' + (spalten || fs.length) + '">' + fs.map(function (f) {
      return '<div' + (f.hero ? ' class="hero' + (f.ek ? ' ek-karte' : '') + '"' : '') + (f.ek ? ' tabindex="0" role="button" data-ek-karte="1" aria-label="EK-Rendite ' + esc(ekStufe().lang) + ' ' + esc(f.v) + '. Klicken wechselt die Stufe."' : '') + (f.tip ? ' data-tip="' + tipReg(function () { return f.tip; }) + '"' : '') + '><span>' + esc(f.l) + '</span><b' + (f.c ? ' class="' + f.c + '"' : '') + '>' + f.v + '</b>' + (f.s ? '<small>' + f.s + '</small>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function zielSchalter(sel) {
    var el = document.querySelector(sel); if (!el) return;
    el.innerHTML = '<div class="schalter" role="group" aria-label="Ziele aus dem Investmentprofil"><button aria-pressed="true" data-z="1">Mit Zielen</button><button aria-pressed="false" data-z="0">Ohne Ziele</button></div>';
    el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); setZiele(b.getAttribute('data-z') === '1'); if (window.nachZiel) window.nachZiel(); });
  }

  /* ══ Runde 2 (25.11.2026): Objektbilder, Modus Kompakt/Detail, EK-Rendite in vier Stufen ══ */
  function bild(o, cls) {
    if (!o.bild) return '<span class="ob ' + (cls || '') + ' ob-leer"></span>';
    return '<span class="ob ' + (cls || '') + (o.bildArt !== 'foto' ? ' ob-karte' : '') + '" style="background-image:url(\'' + o.bild + '\')"></span>';
  }
  function bildText(o) { return o.bildArt === 'foto' ? 'Objektfoto' : o.bildArt === 'karte' ? 'Lagekarte' : 'Lagekarte nach Postleitzahl'; }

  var detailAn = false;
  function detail() { return detailAn; }
  function setDetail(an) { detailAn = !!an; document.documentElement.classList.toggle('modus-detail', detailAn); document.querySelectorAll('.leiste2 [data-m]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-m') === '1') === detailAn)); }); neu(); }

  var EK_STUFEN = [
    { k: 'k4', kurz: 'Haupt', lang: 'nach Steuer mit Vermögensdelta', formel: '(Überschuss nach Steuer + Tilgung + Vermögensdelta) / Eigenkapital. Die Hauptkennzahl.', erkl: 'Überschuss nach Steuer plus Tilgung plus Wertentwicklung im Jahr, geteilt durch dein Eigenkapital. Das ist die eigentliche Rendite deines Geldes.' },
    { k: 'k1', kurz: '1 Operativ', lang: 'operativ', formel: '(Überschuss + Tilgung) / Eigenkapital', erkl: 'Überschuss nach Zins und Tilgung plus Tilgung, geteilt durch dein Eigenkapital. Nur das laufende Geschäft, ohne Steuer und ohne Wert.' },
    { k: 'k2', kurz: '2 Nach Steuer', lang: 'nach Steuer', formel: '(Überschuss + Tilgung + Steuererstattung oder − Nachzahlung) / Eigenkapital', erkl: 'Wie Operativ, dazu die Steuererstattung oder die Nachzahlung.' },
    { k: 'k3', kurz: '3 Mit Wert', lang: 'vor Steuer mit Vermögensdelta', formel: '(Überschuss + Tilgung + Vermögensdelta) / Eigenkapital', erkl: 'Wie Operativ, dazu die Wertentwicklung im Jahr. Ohne Steuer.' }
  ];
  var ekK = (function () { try { var v = sessionStorage.getItem('dp_ekr_stufe_demo'); return /^k[1-4]$/.test(v) ? v : 'k4'; } catch (e) { return 'k4'; } })();
  function ekNaechste() { var r = ['k4', 'k1', 'k2', 'k3']; return r[(r.indexOf(ekK) + 1) % 4]; }
  function ekStufe() { return EK_STUFEN.filter(function (s) { return s.k === ekK; })[0]; }
  function setEk(k) { ekK = k; try { sessionStorage.setItem('dp_ekr_stufe_demo', k); } catch (e) {} document.querySelectorAll('.leiste2 [data-k]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-k') === k)); }); neu(); }
  function ekWert(r) { return r ? r[ekK] : null; }
  function ekKlasse(v) { return v == null ? '' : v >= 8 ? 'plus' : v >= 4 ? '' : 'minus'; }
  function ekTipHtml(r, titel) {
    if (!r) return '<div class="t-k">' + esc(titel || 'EK-Rendite') + '</div>keine Angaben';
    var h = '<div class="t-k">' + esc(titel || 'EK-Rendite') + ' · Eigenkapital ' + eur(r.ek) + '</div><div class="t-erkl"><b>' + esc(ekStufe().kurz) + ':</b> ' + esc(ekStufe().erkl) + '</div>';
    [['k1', '1 Operativ', 'Überschuss + Tilgung'], ['k2', '2 Nach Steuer', 'wie 1 ' + (r.steuer > 0 ? 'minus Nachzahlung' : 'plus Erstattung')],
     ['k3', '3 Vor Steuer mit Wert', 'wie 1 plus Vermögensdelta'], ['k4', '4 Nach Steuer mit Wert', 'wie 2 plus Vermögensdelta']].forEach(function (z) {
      h += '<div class="t-z' + (z[0] === ekK ? ' t-akt' : '') + '"><span>' + z[1] + (z[0] === 'k4' ? ' · Haupt' : '') + '<small>' + z[2] + '</small></span><b class="' + (r[z[0]] >= 0 ? 't-ok' : 't-nok') + '">' + pct(r[z[0]], 1) + '</b></div>';
    });
    if (r.cf_op != null) {
      h += '<hr>' + tz('Überschuss vor Steuer', eurV(r.cf_op)) + tz('Tilgung', eur(r.tilg + (r.bspar || 0)));
      if (r.steuer != null) h += tz(r.steuer > 0 ? 'Steuernachzahlung' : 'Steuererstattung', eur(Math.abs(r.steuer)));
      if (r.delta_pa != null) h += tz('Vermögensdelta im Jahr', eurV(r.delta_pa)) + '<div class="t-fuss">' + (r.delta_weg === 'seit_kauf'
        ? 'Bewertung ' + eur(r.wert) + ' minus Darlehen bei Kauf ' + eur(r.darlehen0) + ' minus Eigenkapital, verteilt auf die Haltejahre.'
        : 'Bewertung ' + eur(r.wert) + ' mal ' + pct((r.wstg || 0) * 100, 1) + ' Wertsteigerung im Jahr. Einmalig heute ' + eurV(r.delta) + ' (Bewertung minus Darlehen bei Kauf minus Eigenkapital).') + '</div>';
    } else if (r.mit_delta != null) {
      h += '<div class="t-fuss">Nach Eigenkapital gewichtet über alle Objekte. Vermögensdelta bei ' + r.mit_delta + ' von ' + D.objekte.length + ' Objekten.</div>';
    }
    if (r.hebel && window.DpEkRendite && DpEkRendite.hebelZeilen) {
      h += '<hr><div class="t-k">Hebeleffekt ' + (r.hebel.richtung === 'positiv' ? '<span class="t-ok">positiv</span>' : '<span class="t-nok">negativ</span>') + '</div><ul class="t-liste">' + DpEkRendite.hebelZeilen(r.hebel).map(function (z) { return '<li>' + esc(z) + '</li>'; }).join('') + '</ul>';
    }
    return h;
  }
  function ekPunkte() { return ' <span class="ek-pk" aria-hidden="true">' + ['k4', 'k1', 'k2', 'k3'].map(function (x) { return '<i' + (x === ekK ? ' class="an"' : '') + '></i>'; }).join('') + '</span>'; }
  function ekKachel() {
    var P = D.ekrP, s = ekStufe(), v = ekWert(P);
    return { l: 'EK-Rendite · ' + s.kurz, v: pct(v, 1), s: s.lang + ekPunkte(), hero: 1, ek: 1, tip: ekTipHtml(P, 'EK-Rendite Portfolio') };
  }

  /* Gesamtbewertung: dieselben drei Blöcke wie heute im Portfolio-Cockpit (dashboard.js renderGesamtbew) */
  function gesamtKarte() {
    var G = D.gesamt, ab = (G.ewS / G.kpEwS - 1) * 100;
    function z(l, v, cls, sub) { return '<div class="gb-z' + (cls ? ' ' + cls : '') + '"><span>' + l + (sub ? '<small>' + sub + '</small>' : '') + '</span><b>' + v + '</b></div>'; }
    var b1 = '<div class="gb-k"><div class="gb-t"><i>1</i>Investiert</div>' + z('Kaufpreise', mio(G.kp), '', D.objekte.length + ' Objekte') + z('+ Nebenkosten', mio(G.nk))
      + z('+ Sanierung, Inventar u. a.', mio(G.sonst)) + z('= Gesamtinvestition', mio(G.gi), 'gb-sum') + z('Darlehen', mio(G.darl), 'gb-sub') + z('Eigenkapital', mio(G.ek), 'gb-sub') + '</div>';
    var b2 = '<div class="gb-k"><div class="gb-t"><i>2</i>Bilanz heute</div>' + z('Objektwerte (Kaufpreis)', mio(G.wertKp)) + z('− Restschuld', mio(G.rest))
      + z('= Eigenkapital im Bestand', mio(G.wertKp - G.rest), 'gb-sum', 'Quote ' + pct((G.wertKp - G.rest) / G.wertKp * 100, 1))
      + z('Tilgung im Jahr', eur(D.summe.tilgJ), 'gb-sub', 'so viel wächst es ohne Wertänderung') + '</div>';
    var b3 = '<div class="gb-k"><div class="gb-t"><i>3</i>Nach Bewertung</div>' + z('Ertragswert', mio(G.ewS), '', G.ewN + ' von ' + D.objekte.length + ' Objekten')
      + z('Kaufpreise derselben Objekte', mio(G.kpEwS), 'gb-sub') + z('Abstand', '<span class="' + (ab >= 0 ? 'plus' : 'minus') + '">' + pctV(ab) + '</span>', 'gb-sum', 'Ertragswert gegen Kaufpreis')
      + z('Marktpreisindikation', mio(G.mpiS), '', 'aus Angebotspreisen nach Abschlag') + '</div>';
    return karte('Gesamtbewertung', 'Investition, Bilanz und Bewertung, wie im Portfolio-Cockpit heute.', '<div class="gb">' + b1 + b2 + b3 + '</div>');
  }

  /* EK-Rendite je Objekt: vier Stufen als dünne Balken, die gewählte kräftig in Gold */
  function ekJeObjekt(w, opt) {
    opt = opt || {};
    var os = D.objekte.filter(function (o) { return o.ekr; }).sort(function (a, b) { return ekWert(b.ekr) - ekWert(a.ekr); });
    if (opt.top) os = os.slice(0, opt.top);
    var vals = []; os.forEach(function (o) { ['k1', 'k2', 'k3', 'k4'].forEach(function (k) { vals.push(o.ekr[k]); }); });
    var t = ticks(Math.min(0, Math.min.apply(null, vals)), Math.max.apply(null, vals), w < 520 ? 4 : 6), lo = t[0], hi = t[t.length - 1];
    var lw = w < 520 ? 112 : 158, rw = 58, pw = w - lw - rw, rh = 22, H = os.length * rh + 22;
    var x = function (v) { return lw + (v - lo) / (hi - lo) * pw; };
    var s = '<svg viewBox="0 0 ' + w + ' ' + H + '" role="img" aria-label="EK-Rendite je Objekt">';
    t.forEach(function (v) { s += '<line class="netz" x1="' + f1(x(v)) + '" x2="' + f1(x(v)) + '" y1="0" y2="' + (H - 18) + '"/><text class="ax" x="' + f1(x(v)) + '" y="' + (H - 4) + '" text-anchor="middle">' + nf0.format(v) + ' %</text>'; });
    s += '<line style="stroke:var(--grau)" x1="' + f1(x(0)) + '" x2="' + f1(x(0)) + '" y1="0" y2="' + (H - 18) + '"/>';
    os.forEach(function (o, i) {
      var y = i * rh, r = o.ekr, tipK = tipReg(function () { return '<div class="t-bild">' + bild(o, 'ob-tip') + '</div>' + ekTipHtml(r, o.name); });
      s += '<g class="z" data-tip="' + tipK + '"><rect class="zeile-hl" x="0" y="' + y + '" width="' + w + '" height="' + rh + '"/>';
      s += '<text class="lab" x="0" y="' + (y + 15) + '">' + esc(kurzName(o, w)) + '</text>';
      ['k1', 'k2', 'k3', 'k4'].forEach(function (k, q) {
        var v = r[k], akt = k === ekK, x0 = x(Math.min(0, v)), x1 = x(Math.max(0, v));
        s += '<rect x="' + f1(x0) + '" y="' + (y + 3 + q * 4) + '" width="' + f1(Math.max(1, x1 - x0)) + '" height="' + (akt ? 4.5 : 2.5) + '" rx="1.2" style="fill:' + (v < 0 ? 'var(--rot)' : akt ? 'var(--gold)' : 'var(--grau)') + ';opacity:' + (akt ? 1 : .7) + '"/>';
      });
      var v = ekWert(r);
      s += '<text class="wl" x="' + (w - 2) + '" y="' + (y + 15) + '" text-anchor="end" style="fill:' + (v < 0 ? 'var(--rot)' : v >= 8 ? 'var(--gruen)' : 'var(--tinte)') + '">' + pct(v, 1) + '</text>';
      s += '<rect class="treff" x="0" y="' + y + '" width="' + w + '" height="' + rh + '"/></g>';
    });
    return s + '</svg>' + leg([{ t: 'gewählt: ' + ekStufe().lang, f: 'var(--gold)' }, { t: 'die anderen drei Stufen', f: 'var(--grau)' }, { t: 'negativ', f: 'var(--rot)' }]);
  }

  /* Woher die Rendite kommt: Portfolio in Euro im Jahr, Bausteine der vier Stufen */
  function renditeQuellen(w) {
    var O = D.objekte.filter(function (o) { return o.ekr; }), P = D.ekrP;
    var cf = summe(O, function (o) { return o.ekr.cf_op; }), ti = summe(O, function (o) { return o.ekr.tilg; }), st = summe(O, function (o) { return -o.ekr.steuer; }), de = summe(O, function (o) { return o.ekr.delta_pa || 0; });
    return wasserfall({ w: w, h: 230, aria: 'Woher die EK-Rendite kommt', schritte: [
      { t: 'Überschuss', v: cf, info: 'Cashflow vor Steuer nach Zins und Tilgung, alle Objekte.' },
      { t: 'Tilgung', v: ti, info: 'Vermögensaufbau, zählt zur Rendite.' },
      { t: 'Steuer', v: st, info: st >= 0 ? 'Erstattung über alle Objekte.' : 'Nachzahlung über alle Objekte.' },
      { t: 'Wert', v: de, info: 'Vermögensdelta im Jahr, je Objekt Bewertung mal Wertsteigerungsannahme.' },
      { t: 'Gesamt', v: cf + ti + st + de, summe: true, info: pct(P.k4, 1) + ' von ' + mio(P.ek) + ' Eigenkapital.' }
    ] });
  }

  /* Die vier Stufen als kleine Liste (Portfolio oder Objekt), gewählte markiert */
  function stufenListe(r) {
    return '<div class="stufen">' + [['k1', '1', 'Operativ', 'Überschuss + Tilgung'], ['k2', '2', 'Nach Steuer', '+ Steuerwirkung'], ['k3', '3', 'Vor Steuer mit Wert', '+ Vermögensdelta'], ['k4', '4', 'Nach Steuer mit Wert', 'Hauptkennzahl']].map(function (z) {
      var v = r[z[0]]; return '<div class="st' + (z[0] === ekK ? ' akt' : '') + '"><i>' + z[1] + '</i><span>' + z[2] + '<small>' + z[3] + '</small></span><b class="' + ekKlasse(v) + '">' + pct(v, 1) + '</b></div>';
    }).join('') + '</div>';
  }

  /* Galerie: jedes Objekt mit Foto oder Lagekarte */
  function galerie(opt) {
    opt = opt || {};
    var os = D.objekte.slice().sort(opt.sort || function (a, b) { return ekWert(b.ekr) - ekWert(a.ekr); });
    return '<div class="gal' + (opt.gross ? ' gal-gross' : '') + '">' + os.map(function (o) {
      var v = ekWert(o.ekr);
      return '<div class="gal-k" data-tip="' + objTip(o) + '">' + bild(o, 'ob-gal') + (o.bildArt !== 'foto' ? '<span class="gal-hin">' + bildText(o) + '</span>' : '') +
        '<div class="gal-t"><b>' + esc(o.name) + '</b><span>' + esc(o.ort) + ' · ' + esc(o.art) + (o.we > 1 ? ' · ' + o.we + ' WE' : '') + '</span></div>' +
        '<div class="gal-z"><span>EK-Rendite<b class="' + ekKlasse(v) + '">' + pct(v, 1) + '</b></span><span>CF / Monat<b class="' + (o.cfVs >= 0 ? 'plus' : 'minus') + '">' + eurV(o.cfVs / 12) + '</b></span><span>DSCR<b>' + d2(o.dscr) + '</b></span></div></div>';
    }).join('') + '</div>';
  }

  /* Kopf-Schalter (Kompakt/Detail, EK-Rendite-Stufe) und Detail-Bereich für jede Demo */
  function schalterHtml() {
    return '<div class="schalter" role="group" aria-label="Ansicht"><button aria-pressed="' + !detailAn + '" data-m="0">Kompakt</button><button aria-pressed="' + detailAn + '" data-m="1">Detail</button></div>' +
      '<div class="schalter ek-schalter" role="group" aria-label="EK-Rendite Stufe"><span class="sch-l">EK-Rendite</span>' + EK_STUFEN.map(function (s) {
        return '<button aria-pressed="' + (s.k === ekK) + '" data-k="' + s.k + '" data-tip="' + tipReg(function () { return '<div class="t-k">' + esc(s.kurz) + ' · ' + esc(s.lang) + '</div><div style="white-space:normal;max-width:280px">' + esc(s.formel) + '</div>'; }) + '">' + esc(s.kurz) + '</button>';
      }).join('') + '</div>';
  }
  function ausbau(opt) {
    opt = opt || {};
    var lst = document.querySelector('.leiste');
    if (lst) {
      var sp = document.createElement('span'); sp.className = 'leiste2'; sp.innerHTML = schalterHtml(); lst.insertBefore(sp, lst.firstChild);
      sp.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        if (b.hasAttribute('data-m')) setDetail(b.getAttribute('data-m') === '1'); else setEk(b.getAttribute('data-k'));
      });
    }
    var q = new URLSearchParams(location.search);
    if (opt.ohneDetail) { if (q.get('modus') === 'detail') setDetail(true); return; }
    var r = document.querySelectorAll('.seite > .raster'), last = r[r.length - 1];
    var dz = document.createElement('div'); dz.className = 'raster nur-detail';
    dz.innerHTML = '<div class="trenn"><span>Detail</span></div>' +
      (opt.ohneGesamt ? '' : '<div class="karte" style="--s:12" id="d-gb"></div>') +
      (opt.ohneEk ? '' : '<div class="karte" style="--s:7" id="d-ek"></div><div class="karte" style="--s:5" id="d-rq"></div>') +
      (opt.ohneGalerie ? '' : '<div class="karte" style="--s:12" id="d-gal"></div>');
    if (last) last.insertAdjacentElement('afterend', dz); else document.querySelector('.seite').appendChild(dz);
    if (!opt.ohneGesamt) modul('#d-gb', function () { return gesamtKarte(); });
    if (!opt.ohneEk) {
      modul('#d-ek', function (w) { return karte('EK-Rendite je Objekt', 'Vier Stufen je Objekt, die gewählte kräftig, sortiert danach. Fahr über ein Objekt für Formel und Zahlen.', ekJeObjekt(w)); });
      modul('#d-rq', function (w) { return karte('Woher die Rendite kommt', 'Alle Objekte zusammen, in Euro im Jahr. Gesamt geteilt durch ' + mio(D.ekrP.ek) + ' Eigenkapital ergibt ' + pct(D.ekrP.k4, 1) + '.', renditeQuellen(w) + stufenListe(D.ekrP)); });
    }
    if (!opt.ohneGalerie) modul('#d-gal', function () { return karte('Deine Objekte', 'Foto aus dem Objekt, sonst die Lagekarte wie auf dem Bericht. Sortiert nach EK-Rendite, gewählte Stufe.', galerie()); });
    if (q.get('modus') === 'detail') { setDetail(true); }
    if (q.get('ek')) { setEk(q.get('ek')); }
  }

  return { D: D, eur: eur, eurV: eurV, kurz: kurz, kurzEur: kurzEur, mio: mio, pct: pct, pctV: pctV, d2: d2, esc: esc, summe: summe,
    ziele: ziele, setZiele: setZiele, zielSchalter: zielSchalter, tipReg: tipReg, tz: tz, objTip: objTip, modul: modul, neu: neu, karte: karte, leg: leg, kurzName: kurzName,
    hantel: hantel, stapelQuer: stapelQuer, zeitleiste: zeitleiste, saeulen: saeulen, wasserfall: wasserfall, streu: streu, flaeche: flaeche, bullet: bullet, ring: ring, stufeWort: stufeWort,
    scoreKopf: scoreKopf, treemap: treemap, flugplan: flugplan, instrument: instrument, bszTabelle: bszTabelle, hinweise: hinweise, kennzahlen: kennzahlen, kz: kz,
    bild: bild, bildText: bildText, detail: detail, setDetail: setDetail, ekStufe: ekStufe, ekWert: ekWert, ekKlasse: ekKlasse, ekTipHtml: ekTipHtml, ekKachel: ekKachel,
    gesamtKarte: gesamtKarte, stufenListe: stufenListe, ekJeObjekt: ekJeObjekt, renditeQuellen: renditeQuellen, galerie: galerie, ausbau: ausbau };
})();
