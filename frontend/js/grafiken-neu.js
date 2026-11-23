/* ═══════════════════════════════════════════════════════════════════════════
   v4140 · NEUE GRAFIKEN (Vorschau-Funktion „grafiken_neu“)

   Marcel 23.11.2026: „bau mir bitte die Grafiken im Tab Pilot-Analyse neu, alle
   Charts mit den neuen Skills … mach 5–6 neue Ideen fertig“ und „Kannst du das
   mal komplett im Tab darstellen, wie es fertig aussehen würde?“
   Vorlage: Dateien/Demos/pilot-analyse-charts-2026-11-23.html (sechs Ideen) und
   Dateien/Demos/portfolio-cockpit-2026-11-23.html (Dashboard), gebaut mit den
   Skills dataviz und chart-dashboard. Hier als eigenes SVG nachgebaut statt der
   815 KB großen charts-lib: Farben über Whitelabel-Token (var() steht nur in
   style, nie in SVG-Attributen), Statusfarben fest.

   Nur sichtbar, wenn DpVorschau.frei('grafiken_neu'). Ohne Freigabe passiert
   hier nichts, die alten Grafiken bleiben. Mit Freigabe:
     Pilot-Analyse › Übersicht      Vermögensaufbau, Cashflow-Brücke (statt „Wohin es läuft“)
     Pilot-Analyse › Jahresabgleich Plan vom Kauf gegen Ist, Weg zum positiven Cashflow (statt der Karten)
     Pilot-Analyse › Potenzial      Mietspielraum je Wohnung (DpMieteMax)
     Pilot-Analyse › Steuer         Ergebnis aus Vermietung (statt Steuerverlauf)
     Portfolio-Cockpit              Portfolio auf einen Blick (Kennzahlen, Vermögen, Zinsbindung,
                                    Cashflow je Objekt, Rendite gegen DSCR, Steuer, Tabelle, Prüfung)
   Daten immer live: State.cfRows, DpJahresbuch.zeilen(), DpMieteMax.alle(),
   DealPilotDashboard.portfolioPayload() und .grafikDaten(). Gerechnet wird nur
   für die Darstellung (Summen, Projektion im Cockpit), jede Summe wird gegengeprüft.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpGrafikenNeu) return;

  var AN = false, _timer = null, _breite = {};
  var GRUEN = '#3FA56C', ROT = '#B8625C';

  /* ── kleine Helfer ─────────────────────────────────────────────────── */
  function zahl(v) { return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function eur(v) { return v == null ? 'keine Angabe' : (v < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function eurV(v) { return v == null ? 'keine Angabe' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function kurzEur(v) {
    if (v == null) return '';
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e6) return s + nf2.format(a / 1e6).replace(/,?0+$/, '') + ' Mio';
    if (a >= 1e4) return s + nf0.format(Math.round(a / 1000)) + ' T';
    return s + nf0.format(Math.round(a));
  }
  function mio(v) { return v == null ? 'keine Angabe' : (Math.abs(v) >= 1e6 ? nf2.format(v / 1e6) + ' Mio €' : nf0.format(Math.round(v / 1000)) + ' T€'); }
  function f1(v) { return Math.round(v * 10) / 10; }
  function heuteJahr() { return new Date().getFullYear(); }
  function summe(a, f) { return a.reduce(function (s, x) { var v = f(x); return s + (v == null || !isFinite(v) ? 0 : v); }, 0); }
  function reduziert() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  /* „schöne“ Achsenschritte */
  function ticks(min, max, n) {
    if (min === max) { max = min + 1; }
    var roh = (max - min) / (n || 4), p = Math.pow(10, Math.floor(Math.log10(roh))), q = roh / p;
    var st = (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * p;
    var a = Math.floor(min / st) * st, b = Math.ceil(max / st) * st, out = [];
    for (var t = a; t <= b + st / 2; t += st) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  }

  /* ── Stil ──────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-gn-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-gn-stil';
    s.textContent = [
      '.dp-gn{--gn-gold:var(--wl-c9a84c,#C9A84C);--gn-gold-d:var(--wl-b8932f,#b8932f);--gn-gold-h:var(--wl-e8cc7a,#E8CC7A);--gn-gruen:#3FA56C;--gn-rot:#B8625C;',
      '--gn-tinte:currentColor;--gn-grau:color-mix(in srgb,currentColor 30%,transparent);--gn-netz:color-mix(in srgb,currentColor 10%,transparent);--gn-leise:color-mix(in srgb,currentColor 62%,transparent)}',
      '.dp-gn-karte{position:relative;margin:0 0 16px;min-width:0}',
      '.dp-gn-k-t{font:600 15px/1.3 "Space Grotesk",Inter,sans-serif;margin:0 0 2px;letter-spacing:-.01em}',
      '.dp-gn-k-s{font:400 12px/1.4 Inter,sans-serif;color:var(--gn-leise);margin:0 0 10px}',
      '.dp-gn-reihe{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;margin:0 0 16px}',
      '.dp-gn-reihe>.dp-gn-karte{margin:0}',
      '@media (max-width:900px){.dp-gn-reihe{grid-template-columns:minmax(0,1fr)}}',
      '.dp-gn svg{display:block;width:100%;height:auto;overflow:visible}',
      '.dp-gn .gn-ax{font:400 11px "JetBrains Mono",ui-monospace,monospace;fill:var(--gn-leise)}',
      '.dp-gn .gn-wert{font:600 11px "JetBrains Mono",ui-monospace,monospace;fill:currentColor}',
      '.dp-gn .gn-netz{stroke:var(--gn-netz);stroke-width:1}',
      '.dp-gn .gn-null{stroke:var(--gn-grau);stroke-width:1}',
      '.dp-gn .gn-heute{stroke:var(--gn-gold);stroke-width:1;stroke-dasharray:3 3}',
      '.dp-gn .gn-proj{fill:currentColor;fill-opacity:.035}',
      '.dp-gn .gn-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0 0;font:400 11.5px Inter,sans-serif;color:var(--gn-leise)}',
      '.dp-gn .gn-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      '.dp-gn .gn-leg i.l{height:2px;border-radius:1px;vertical-align:3px;width:14px}',
      '.dp-gn .gn-tip{position:absolute;pointer-events:none;z-index:5;background:#050505;color:#FDFCFA;font:500 12px/1.45 Inter,sans-serif;padding:7px 10px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap;display:none}',
      '.dp-gn .gn-tip b{font-family:"JetBrains Mono",monospace;font-weight:600}',
      '.dp-gn .gn-tip .gn-tip-j{font:600 11px "JetBrains Mono",monospace;color:var(--gn-gold-h);margin-bottom:2px}',
      '.dp-gn .gn-treff{fill:transparent;cursor:crosshair}',
      '.dp-gn .gn-treff:hover+.gn-hl,.dp-gn .gn-hl.an{opacity:1}',
      '.dp-gn .gn-hl{opacity:0;fill:currentColor;fill-opacity:.05;pointer-events:none;transition:opacity .15s}',
      '.dp-gn .gn-bar{transform-box:fill-box;transform-origin:50% 100%}',
      '.dp-gn .gn-bar.neg{transform-origin:50% 0}',
      '.dp-gn .gn-hbar{transform-box:fill-box;transform-origin:0 50%}',
      '.dp-gn.gn-anim .gn-bar{animation:gnWachs .7s cubic-bezier(.2,.7,.2,1) both}',
      '.dp-gn.gn-anim .gn-hbar{animation:gnWachsH .7s cubic-bezier(.2,.7,.2,1) both}',
      '.dp-gn.gn-anim .gn-linie{stroke-dasharray:var(--gn-len);stroke-dashoffset:var(--gn-len);animation:gnZieh 1s ease-out .1s forwards}',
      '.dp-gn.gn-anim .gn-punkt{animation:gnAuf .4s ease-out both}',
      '@keyframes gnWachs{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
      '@keyframes gnWachsH{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
      '@keyframes gnZieh{to{stroke-dashoffset:0}}',
      '@keyframes gnAuf{from{opacity:0}to{opacity:1}}',
      '@media (prefers-reduced-motion:reduce){.dp-gn.gn-anim *{animation:none!important;stroke-dasharray:none!important}}',
      /* alte Grafiken weg, solange die Vorschau an ist */
      'body.dp-gn-an .dp-gn-weg{display:none!important}',
      /* Cockpit */
      '.dp-gn-cp{margin:0 0 22px}',
      '.dp-gn-cp-kopf{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 18px;margin:0 0 12px}',
      '.dp-gn-cp-kopf h3{font:600 18px "Space Grotesk",Inter,sans-serif;margin:0;letter-spacing:-.01em}',
      '.dp-gn-cp-kopf small{display:block;font:400 12px Inter,sans-serif;color:var(--gn-leise);margin-top:2px}',
      '.dp-gn-filter{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;font:500 12px Inter,sans-serif}',
      '.dp-gn-filter label{display:flex;align-items:center;gap:6px;color:var(--gn-leise)}',
      '.dp-gn-filter select,.dp-gn-filter input[type=range]{font:500 12px Inter,sans-serif;color:inherit;background:transparent;border:1px solid var(--gn-netz);border-radius:8px;padding:5px 8px;max-width:190px}',
      '.dp-gn-filter select option{color:#050505}',
      '.dp-gn-cp .dp-gn-filter select{font-size:12.5px!important;height:auto!important;min-height:0!important;padding:5px 8px!important;width:auto!important;line-height:1.3!important}',
      '@media (max-width:640px){.dp-gn-filter{width:100%}.dp-gn-filter label{flex:1 1 140px}.dp-gn-cp .dp-gn-filter select{max-width:none;flex:1}}',
      '.dp-gn-filter input[type=range]{padding:0;accent-color:var(--gn-gold);width:120px}',
      '.dp-gn-seg{display:inline-flex;border:1px solid var(--gn-netz);border-radius:8px;overflow:hidden}',
      '.dp-gn-seg button{font:600 11.5px Inter,sans-serif;color:inherit;background:transparent;border:0;padding:6px 10px;cursor:pointer}',
      '.dp-gn-seg button[aria-pressed=true]{background:color-mix(in srgb,var(--gn-gold) 22%,transparent)}',
      '.dp-gn-kz{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin:0 0 16px}',
      '@media (max-width:1100px){.dp-gn-kz{grid-template-columns:repeat(4,minmax(0,1fr))}}',
      '@media (max-width:640px){.dp-gn-kz{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '.dp-gn-kz>div{border:1px solid var(--gn-netz);border-radius:12px;padding:11px 12px;min-width:0}',
      '.dp-gn-kz span{display:block;font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--gn-leise)}',
      '.dp-gn-kz b{display:block;font:600 19px/1.2 "Space Grotesk",Inter,sans-serif;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dp-gn-kz small{display:block;font:400 11px Inter,sans-serif;color:var(--gn-leise);margin-top:2px}',
      '.dp-gn-raster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}',
      '.dp-gn-raster>.dp-gn-breit{grid-column:1/-1}',
      '@media (max-width:900px){.dp-gn-raster{grid-template-columns:minmax(0,1fr)}}',
      '.dp-gn-cp .dp-gn-karte{border:1px solid var(--gn-netz);border-radius:14px;padding:14px 16px;margin:0}',
      '.dp-gn-tab{width:100%;border-collapse:collapse;font:400 12.5px Inter,sans-serif}',
      '.dp-gn-tab th{font:600 10px "JetBrains Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--gn-leise);text-align:right;padding:6px 8px;border-bottom:1px solid var(--gn-netz);white-space:nowrap}',
      '.dp-gn-tab th:first-child,.dp-gn-tab td:first-child{text-align:left}',
      '.dp-gn-tab td{padding:7px 8px;border-bottom:1px solid var(--gn-netz);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dp-gn-tab td:first-child{white-space:normal;max-width:240px}',
      '.dp-gn-pill{display:inline-block;font:600 10px Inter,sans-serif;padding:1px 7px;border-radius:999px;margin:2px 4px 0 0;background:color-mix(in srgb,var(--gn-gold) 20%,transparent);color:inherit;white-space:nowrap}',
      /* am Handy übernimmt js/tabellen-karten.js die Tabelle (Kartenmodus mit Schalter „alle Spalten“), wie überall in der App */
      '.dp-gn-pruef{list-style:none;margin:0;padding:0;font:400 12px/1.5 Inter,sans-serif}',
      '.dp-gn-pruef li{padding:3px 0 3px 22px;position:relative}',
      '.dp-gn-pruef li::before{content:"✓";position:absolute;left:2px;font-weight:700;color:#3FA56C}',
      '.dp-gn-pruef li.warn::before{content:"!";color:var(--gn-gold-d)}',
      '.dp-gn-pruef li.fehler::before{content:"✕";color:#B8625C}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ── Tooltip je Karte ──────────────────────────────────────────────── */
  function tipBinden(karte, inhalt) {
    var tip = karte.querySelector('.gn-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'gn-tip'; karte.appendChild(tip); }
    karte.onmousemove = function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-gn-i]') : null;
      karte.querySelectorAll('.gn-hl.an').forEach(function (h) { h.classList.remove('an'); });
      if (!t) { tip.style.display = 'none'; return; }
      var html = inhalt(+t.getAttribute('data-gn-i'), t.getAttribute('data-gn-r'));
      if (!html) { tip.style.display = 'none'; return; }
      var hl = t.nextElementSibling; if (hl && hl.classList && hl.classList.contains('gn-hl')) hl.classList.add('an');
      tip.innerHTML = html; tip.style.display = 'block';
      var b = karte.getBoundingClientRect(), w = tip.offsetWidth, x = ev.clientX - b.left + 14;
      if (x + w > b.width - 4) x = Math.max(4, ev.clientX - b.left - w - 14);
      tip.style.left = x + 'px'; tip.style.top = Math.max(4, ev.clientY - b.top - tip.offsetHeight - 8) + 'px';
    };
    karte.onmouseleave = function () { tip.style.display = 'none'; karte.querySelectorAll('.gn-hl.an').forEach(function (h) { h.classList.remove('an'); }); };
  }
  function legende(eintraege) {
    return '<div class="gn-leg">' + eintraege.map(function (e) {
      return '<span><i class="' + (e.linie ? 'l' : '') + '" style="background:' + e.farbe + (e.muster ? ';background-image:repeating-linear-gradient(45deg,transparent 0 2px,rgba(255,255,255,.55) 2px 4px)' : '') + '"></i>' + esc(e.name) + '</span>';
    }).join('') + '</div>';
  }
  function karteHtml(id, titel, unter, svg, leg) {
    return '<div class="dp-gn-k-t">' + esc(titel) + '</div>' + (unter ? '<div class="dp-gn-k-s">' + esc(unter) + '</div>' : '') + svg + (leg || '');
  }
  /* Länge eines Pfads für die Zeichen-Animation */
  function linieLen(svgRoot) {
    try { svgRoot.querySelectorAll('.gn-linie').forEach(function (p) { var l = p.getTotalLength ? Math.ceil(p.getTotalLength()) : 2000; p.style.setProperty('--gn-len', l); }); } catch (e) {}
  }

  /* ── Grafik-Bausteine (geben SVG-Text zurück) ───────────────────────── */
  /* Säulen gestapelt oder einfach, mit Projektionsfeld und optionaler Linie */
  function saeulen(o) {
    var W = o.breite, H = o.hoehe || 240, L = 54, R = 10, T = 12, B = 26;
    var n = o.x.length; if (!n) return '';
    var gesMax = 0, gesMin = 0;
    for (var i = 0; i < n; i++) {
      var pos = 0, neg = 0;
      o.reihen.forEach(function (r) { var v = r.werte[i] || 0; if (o.gestapelt) { if (v >= 0) pos += v; else neg += v; } else { pos = Math.max(pos, v); neg = Math.min(neg, v); } });
      gesMax = Math.max(gesMax, pos); gesMin = Math.min(gesMin, neg);
    }
    var tk = ticks(gesMin, gesMax, 4), y0 = tk[0], y1 = tk[tk.length - 1];
    var ph = H - T - B, pw = W - L - R, dx = pw / n, bw = Math.min(46, dx * (o.gestapelt ? 0.66 : 0.66 / Math.max(1, o.reihen.length)));
    var yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    out.push('<defs><pattern id="gn-schraffur-' + o.id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style="fill:transparent"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:rgba(255,255,255,.55);stroke-width:2"/></pattern></defs>');
    if (o.projAb != null) { var pi = o.x.indexOf(o.projAb); if (pi >= 0) out.push('<rect class="gn-proj" x="' + f1(L + dx * pi) + '" y="' + T + '" width="' + f1(pw - dx * pi) + '" height="' + ph + '"/>'); }
    tk.forEach(function (t) { out.push('<line class="gn-netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="gn-ax" x="' + (L - 7) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurzEur(t) + '</text>'); });
    if (y0 < 0) out.push('<line class="gn-null" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '"/>');
    var jede = Math.ceil(n / Math.max(1, Math.floor(pw / 44)));
    for (i = 0; i < n; i++) {
      var cx = L + dx * i + dx / 2, basisP = 0, basisN = 0;
      o.reihen.forEach(function (r, k) {
        var v = r.werte[i]; if (v == null || !isFinite(v)) return;
        var x = o.gestapelt ? cx - bw / 2 : cx - (bw * o.reihen.length) / 2 + bw * k;
        var a, b;
        if (o.gestapelt) { if (v >= 0) { a = basisP; basisP += v; b = basisP; } else { a = basisN; basisN += v; b = basisN; } } else { a = 0; b = v; }
        var yt = yv(Math.max(a, b)), yb = yv(Math.min(a, b)), farbe = typeof r.farbe === 'function' ? r.farbe(v, i) : r.farbe;
        var proj = o.projAb != null && o.x[i] >= o.projAb;
        out.push('<rect class="gn-bar' + (v < 0 ? ' neg' : '') + '" x="' + f1(x) + '" y="' + f1(yt) + '" width="' + f1(bw - (o.gestapelt ? 0 : 2)) + '" height="' + f1(Math.max(0.5, yb - yt)) + '" rx="2" style="fill:' + farbe + ';animation-delay:' + (i * 25) + 'ms"/>');
        if (proj) out.push('<rect x="' + f1(x) + '" y="' + f1(yt) + '" width="' + f1(bw - (o.gestapelt ? 0 : 2)) + '" height="' + f1(Math.max(0.5, yb - yt)) + '" rx="2" style="fill:url(#gn-schraffur-' + o.id + ');pointer-events:none" class="gn-bar' + (v < 0 ? ' neg' : '') + '"/>');
      });
      if (i % jede === 0) out.push('<text class="gn-ax" x="' + f1(cx) + '" y="' + (H - 8) + '" text-anchor="middle"' + (o.x[i] === o.heute ? ' style="fill:var(--gn-gold-d);font-weight:600"' : '') + '>' + esc(o.xText ? o.xText(o.x[i]) : o.x[i]) + '</text>');
      out.push('<rect class="gn-treff" data-gn-i="' + i + '" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/><rect class="gn-hl" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/>');
    }
    out.push('</svg>');
    return out.join('');
  }

  /* Linien mit Nulllinie, Projektionsfeld, Marken */
  function linien(o) {
    var W = o.breite, H = o.hoehe || 230, L = 54, R = 12, T = 14, B = 26;
    var n = o.x.length; if (n < 2) return '';
    var alle = []; o.reihen.forEach(function (r) { r.werte.forEach(function (v) { if (v != null && isFinite(v)) alle.push(v); }); });
    if (!alle.length) return '';
    var tk = ticks(Math.min(0, Math.min.apply(null, alle)), Math.max(0, Math.max.apply(null, alle)), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    var ph = H - T - B, pw = W - L - R, dx = pw / (n - 1);
    var xv = function (i) { return L + dx * i; }, yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    if (o.projAb != null) { var pi = o.x.indexOf(o.projAb); if (pi > 0) out.push('<rect class="gn-proj" x="' + f1(xv(pi) - dx / 2) + '" y="' + T + '" width="' + f1(W - R - xv(pi) + dx / 2) + '" height="' + ph + '"/>'); }
    tk.forEach(function (t) { out.push('<line class="gn-netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="gn-ax" x="' + (L - 7) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurzEur(t) + '</text>'); });
    if (y0 < 0) out.push('<line class="gn-null" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '"/>');
    o.reihen.forEach(function (r) {
      var d = '', auf = false;
      r.werte.forEach(function (v, i) { if (v == null || !isFinite(v)) { auf = false; return; } d += (auf ? 'L' : 'M') + f1(xv(i)) + ' ' + f1(yv(v)); auf = true; });
      out.push('<path class="gn-linie" d="' + d + '" style="fill:none;stroke:' + r.farbe + ';stroke-width:' + (r.dick || 2.25) + ';stroke-linejoin:round;stroke-linecap:round' + (r.gestrichelt ? ';stroke-dasharray:5 4;animation:none' : '') + '"/>');
      r.werte.forEach(function (v, i) { if (v == null || !isFinite(v) || n > 24) return; out.push('<circle class="gn-punkt" cx="' + f1(xv(i)) + '" cy="' + f1(yv(v)) + '" r="2.6" style="fill:' + r.farbe + ';animation-delay:' + (300 + i * 30) + 'ms"/>'); });
    });
    (o.marken || []).forEach(function (m) {
      var i = o.x.indexOf(m.x); if (i < 0) return;
      var x = xv(i); out.push('<line x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + T + '" y2="' + (T + ph) + '" style="stroke:' + (m.farbe || 'var(--gn-gold)') + ';stroke-width:1;stroke-dasharray:3 3"/>');
      out.push('<text class="gn-wert" x="' + f1(Math.min(x + 5, W - R - 4)) + '" y="' + (T + 10) + '" text-anchor="' + (x > W - 120 ? 'end' : 'start') + '" style="fill:' + (m.farbe || 'var(--gn-gold-d)') + '">' + esc(m.text) + '</text>');
    });
    var jede = Math.ceil(n / Math.max(1, Math.floor(pw / 44)));
    for (var i = 0; i < n; i++) {
      if (i % jede === 0 || (i === n - 1 && (n - 1) % jede >= jede / 2)) out.push('<text class="gn-ax" x="' + f1(xv(i)) + '" y="' + (H - 8) + '" text-anchor="middle"' + (o.x[i] === o.heute ? ' style="fill:var(--gn-gold-d);font-weight:600"' : '') + '>' + esc(o.x[i]) + '</text>');
      out.push('<rect class="gn-treff" data-gn-i="' + i + '" x="' + f1(xv(i) - dx / 2) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/><rect class="gn-hl" x="' + f1(xv(i) - dx / 2) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/>');
    }
    out.push('</svg>');
    return out.join('');
  }

  /* Wasserfall (senkrecht): schritte [{name, wert, art:'start'|'delta'|'summe'}] */
  function wasserfall(o) {
    var W = o.breite, H = o.hoehe || 240, L = 54, R = W < 460 ? 22 : 8, T = 18, B = 34;
    var S = o.schritte, n = S.length, stand = 0, zeilen = [];
    S.forEach(function (s) {
      if (s.art === 'start') { zeilen.push({ a: 0, b: s.wert, s: s }); stand = s.wert; }
      else if (s.art === 'summe') { zeilen.push({ a: 0, b: stand, s: s, summe: true }); }
      else { zeilen.push({ a: stand, b: stand + s.wert, s: s }); stand += s.wert; }
    });
    var werte = []; zeilen.forEach(function (z) { werte.push(z.a, z.b); });
    var tk = ticks(Math.min(0, Math.min.apply(null, werte)), Math.max(0, Math.max.apply(null, werte)), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    var ph = H - T - B, pw = W - L - R, dx = pw / n, bw = Math.min(54, dx * 0.62);
    var yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { out.push('<line class="gn-netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="gn-ax" x="' + (L - 7) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurzEur(t) + '</text>'); });
    out.push('<line class="gn-null" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '"/>');
    var schmal = dx < 62;
    zeilen.forEach(function (z, i) {
      var x = L + dx * i + (dx - bw) / 2, yt = yv(Math.max(z.a, z.b)), yb = yv(Math.min(z.a, z.b));
      var farbe = z.summe || z.s.art === 'start' ? (z.b < 0 ? 'var(--gn-rot)' : 'var(--gn-gold)') : (z.b >= z.a ? 'var(--gn-gruen)' : 'var(--gn-rot)');
      if (z.summe || z.s.art === 'start') farbe = z.b < 0 ? 'var(--gn-rot)' : (z.s.art === 'start' ? 'var(--gn-grau)' : 'var(--gn-gold)');
      out.push('<rect class="gn-bar' + (z.b < z.a ? ' neg' : '') + '" x="' + f1(x) + '" y="' + f1(yt) + '" width="' + f1(bw) + '" height="' + f1(Math.max(1, yb - yt)) + '" rx="2" style="fill:' + farbe + ';animation-delay:' + (i * 70) + 'ms"/>');
      if (i < n - 1) { var yn = yv(z.b); out.push('<line x1="' + f1(x + bw) + '" x2="' + f1(L + dx * (i + 1) + (dx - bw) / 2) + '" y1="' + f1(yn) + '" y2="' + f1(yn) + '" style="stroke:var(--gn-grau);stroke-width:1;stroke-dasharray:2 2"/>'); }
      var w = z.summe || z.s.art === 'start' ? z.b : z.b - z.a;
      if (!schmal || z.summe) out.push('<text class="gn-wert" x="' + f1(x + bw / 2) + '" y="' + f1(Math.max(T - 4, yt - 5)) + '" text-anchor="middle">' + kurzEur(w) + '</text>');
      out.push('<text class="gn-ax" x="' + f1(x + bw / 2) + '" y="' + (H - (schmal && i % 2 ? 2 : 14)) + '" text-anchor="middle">' + esc(schmal && z.s.kurz ? z.s.kurz : z.s.name) + '</text>');
      out.push('<rect class="gn-treff" data-gn-i="' + i + '" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/><rect class="gn-hl" x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/>');
    });
    out.push('</svg>');
    return { svg: out.join(''), zeilen: zeilen };
  }

  /* Hantel: Plan gegen Ist je Jahr (waagerecht je Jahr eine Zeile) */
  function hantel(o) {
    var W = o.breite, zeileH = 34, T = 8, L = 52, R = 70, n = o.x.length, H = T + n * zeileH + 22;
    var alle = []; o.plan.concat(o.ist).forEach(function (v) { if (v != null) alle.push(v); });
    if (!alle.length) return '';
    /* Achse um die Werte, nicht ab 0: sonst kleben die Hanteln am Rand */
    var mn = Math.min.apply(null, alle), mx = Math.max.apply(null, alle), pad = Math.max(1, (mx - mn) * 0.15);
    var tk = ticks(mn - pad, mx + pad, Math.max(2, Math.min(4, Math.floor((W - 122) / 70)))), x0 = tk[0], x1 = tk[tk.length - 1];
    var pw = W - L - R, xv = function (v) { return L + (v - x0) / (x1 - x0) * pw; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { out.push('<line class="gn-netz" x1="' + f1(xv(t)) + '" x2="' + f1(xv(t)) + '" y1="' + T + '" y2="' + (H - 20) + '"/><text class="gn-ax" x="' + f1(xv(t)) + '" y="' + (H - 6) + '" text-anchor="middle">' + kurzEur(t) + '</text>'); });
    if (x0 < 0) out.push('<line class="gn-null" x1="' + f1(xv(0)) + '" x2="' + f1(xv(0)) + '" y1="' + T + '" y2="' + (H - 20) + '"/>');
    o.x.forEach(function (j, i) {
      var y = T + zeileH * i + zeileH / 2, p = o.plan[i], s = o.ist[i];
      out.push('<text class="gn-ax" x="' + (L - 10) + '" y="' + f1(y + 4) + '" text-anchor="end"' + (j === o.heute ? ' style="fill:var(--gn-gold-d);font-weight:600"' : '') + '>' + esc(j) + '</text>');
      if (p != null && s != null) {
        var besser = s >= p, farbe = Math.abs(s - p) < 0.5 ? 'var(--gn-grau)' : (besser ? 'var(--gn-gruen)' : 'var(--gn-rot)');
        out.push('<line class="gn-hbar" x1="' + f1(Math.min(xv(p), xv(s))) + '" x2="' + f1(Math.max(xv(p), xv(s))) + '" y1="' + f1(y) + '" y2="' + f1(y) + '" style="stroke:' + farbe + ';stroke-width:4;stroke-linecap:round;opacity:.55"/>');
        out.push('<text class="gn-wert" x="' + (W - 4) + '" y="' + f1(y + 4) + '" text-anchor="end" style="fill:' + farbe + '">' + eurV(s - p) + '</text>');
      }
      if (p != null) out.push('<circle class="gn-punkt" cx="' + f1(xv(p)) + '" cy="' + f1(y) + '" r="5.5" style="fill:var(--gn-card,#FFFFFF);stroke:var(--gn-grau);stroke-width:2"/>');
      if (s != null) out.push('<circle class="gn-punkt" cx="' + f1(xv(s)) + '" cy="' + f1(y) + '" r="6" style="fill:var(--gn-gold);animation-delay:200ms"/>');
      out.push('<rect class="gn-treff" data-gn-i="' + i + '" x="0" y="' + f1(y - zeileH / 2) + '" width="' + W + '" height="' + zeileH + '"/><rect class="gn-hl" x="0" y="' + f1(y - zeileH / 2) + '" width="' + W + '" height="' + zeileH + '"/>');
    });
    out.push('</svg>');
    return out.join('');
  }

  /* Waagerechte Balken je Zeile (Spielraum, Cashflow je Objekt, Steuer je Objekt)
     zeilen: [{name, segs:[{von, bis, farbe, muster}], wert, wertText, hinweis}] */
  function balkenH(o) {
    var W = o.breite, zeileH = o.zeileH || 30, T = 6, n = o.zeilen.length;
    var L = Math.min(o.namenBreite || 150, Math.round(W * 0.36)), R = o.rechts == null ? 74 : o.rechts, H = T + n * zeileH + 22;
    var alle = [0]; o.zeilen.forEach(function (z) { z.segs.forEach(function (s) { alle.push(s.von, s.bis); }); });
    var tk = ticks(Math.min.apply(null, alle), Math.max.apply(null, alle), Math.max(2, Math.min(5, Math.floor((W - L - R) / 70)))), x0 = tk[0], x1 = tk[tk.length - 1];
    var pw = W - L - R, xv = function (v) { return L + (v - x0) / (x1 - x0) * pw; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    out.push('<defs><pattern id="gn-schraffur-' + o.id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" style="fill:transparent"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:rgba(255,255,255,.6);stroke-width:2"/></pattern></defs>');
    tk.forEach(function (t) { out.push('<line class="gn-netz" x1="' + f1(xv(t)) + '" x2="' + f1(xv(t)) + '" y1="' + T + '" y2="' + (H - 20) + '"/><text class="gn-ax" x="' + f1(xv(t)) + '" y="' + (H - 6) + '" text-anchor="middle">' + kurzEur(t) + '</text>'); });
    if (x0 < 0) out.push('<line class="gn-null" x1="' + f1(xv(0)) + '" x2="' + f1(xv(0)) + '" y1="' + T + '" y2="' + (H - 20) + '"/>');
    var maxZ = Math.max(6, Math.floor(L / 6.6));
    o.zeilen.forEach(function (z, i) {
      var y = T + zeileH * i, bh = Math.min(16, zeileH - 10), yb = y + (zeileH - bh) / 2;
      var nm = String(z.name); if (nm.length > maxZ) nm = nm.slice(0, maxZ - 1) + '…';
      out.push('<text class="gn-ax" x="' + (L - 8) + '" y="' + f1(yb + bh / 2 + 4) + '" text-anchor="end" style="fill:currentColor">' + esc(nm) + '</text>');
      z.segs.forEach(function (s) {
        var a = xv(Math.min(s.von, s.bis)), b = xv(Math.max(s.von, s.bis));
        out.push('<rect class="gn-hbar" x="' + f1(a) + '" y="' + f1(yb) + '" width="' + f1(Math.max(1, b - a)) + '" height="' + bh + '" rx="2" style="fill:' + s.farbe + ';animation-delay:' + (i * 40) + 'ms"/>');
        if (s.muster) out.push('<rect class="gn-hbar" x="' + f1(a) + '" y="' + f1(yb) + '" width="' + f1(Math.max(1, b - a)) + '" height="' + bh + '" rx="2" style="fill:url(#gn-schraffur-' + o.id + ');pointer-events:none;animation-delay:' + (i * 40) + 'ms"/>');
      });
      if (z.wertText != null && R > 0) out.push('<text class="gn-wert" x="' + (W - 2) + '" y="' + f1(yb + bh / 2 + 4) + '" text-anchor="end"' + (z.wertFarbe ? ' style="fill:' + z.wertFarbe + '"' : '') + '>' + esc(z.wertText) + '</text>');
      out.push('<rect class="gn-treff" data-gn-i="' + i + '" x="0" y="' + f1(y) + '" width="' + W + '" height="' + zeileH + '"/><rect class="gn-hl" x="0" y="' + f1(y) + '" width="' + W + '" height="' + zeileH + '"/>');
    });
    out.push('</svg>');
    return out.join('');
  }

  /* Streudiagramm Rendite gegen DSCR, Blase = Kaufpreis */
  function streuung(o) {
    var W = o.breite, H = o.hoehe || 260, L = 46, R = 14, T = 14, B = 34;
    var P = o.punkte.filter(function (p) { return p.x != null && p.y != null; }); if (!P.length) return '';
    var xs = P.map(function (p) { return p.x; }), ys = P.map(function (p) { return p.y; }).concat([1]);
    var tx = ticks(Math.min.apply(null, xs) - 0.3, Math.max.apply(null, xs) + 0.3, 4), ty = ticks(Math.min(0.6, Math.min.apply(null, ys)), Math.max.apply(null, ys) + 0.1, 4);
    var pw = W - L - R, ph = H - T - B, zmax = Math.max.apply(null, P.map(function (p) { return p.z || 1; }));
    var xv = function (v) { return L + (v - tx[0]) / (tx[tx.length - 1] - tx[0]) * pw; }, yv = function (v) { return T + ph - (v - ty[0]) / (ty[ty.length - 1] - ty[0]) * ph; };
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    ty.forEach(function (t) { out.push('<line class="gn-netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="gn-ax" x="' + (L - 7) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + nf1.format(t) + '</text>'); });
    tx.forEach(function (t) { out.push('<text class="gn-ax" x="' + f1(xv(t)) + '" y="' + (H - 18) + '" text-anchor="middle">' + nf1.format(t) + ' %</text>'); });
    out.push('<text class="gn-ax" x="' + (L + pw / 2) + '" y="' + (H - 3) + '" text-anchor="middle">Bruttomietrendite</text>');
    out.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(1)) + '" y2="' + f1(yv(1)) + '" style="stroke:var(--gn-rot);stroke-width:1;stroke-dasharray:4 3"/><text class="gn-wert" x="' + (W - R - 2) + '" y="' + f1(yv(1) - 5) + '" text-anchor="end" style="fill:var(--gn-rot)">DSCR 1,0</text>');
    P.forEach(function (p, i) {
      var r = 5 + 13 * Math.sqrt((p.z || 1) / zmax), farbe = p.y < 1 ? 'var(--gn-rot)' : 'var(--gn-gold)';
      out.push('<circle class="gn-punkt" data-gn-i="' + o.punkte.indexOf(p) + '" cx="' + f1(xv(p.x)) + '" cy="' + f1(yv(p.y)) + '" r="' + f1(r) + '" style="fill:' + farbe + ';fill-opacity:.55;stroke:' + farbe + ';stroke-width:1.5;cursor:crosshair;animation-delay:' + (i * 40) + 'ms"/>');
    });
    out.push('</svg>');
    return out.join('');
  }

  /* ── Ort finden, Karte anlegen, nur bei Änderung neu zeichnen ───────── */
  function platz(container, schluessel, vor, klasse) {
    if (!container) return null;
    var k = container.querySelector(':scope > [data-dp-gn="' + schluessel + '"]') || container.querySelector('[data-dp-gn="' + schluessel + '"]');
    if (k) return k;
    k = document.createElement('div'); k.setAttribute('data-dp-gn', schluessel); k.className = 'dp-gn ' + (klasse || '');
    if (vor && vor.parentNode) vor.parentNode.insertBefore(k, vor); else container.insertBefore(k, container.firstChild);
    return k;
  }
  function zeichnen(k, sig, fn) {
    var w = k.clientWidth || 0;
    try { var cs = getComputedStyle(k); w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0); } catch (e) {}
    w = Math.round(w);
    if (w < 120) return;   /* versteckter Reiter: beim Sichtbarwerden neu */
    var s = sig + '|' + w;
    if (k.getAttribute('data-gn-sig') === s) return;
    var erst = !k.getAttribute('data-gn-sig');
    k.setAttribute('data-gn-sig', s);
    try { fn(k, w); } catch (e) { try { console.warn('[grafiken-neu]', e); } catch (x) {} k.innerHTML = ''; return; }
    if (erst && !reduziert()) { k.classList.add('gn-anim'); linieLen(k); setTimeout(function () { k.classList.remove('gn-anim'); }, 1600); }
  }
  function weg(el) { if (el && !el.classList.contains('dp-gn-weg')) el.classList.add('dp-gn-weg'); }

  /* ── Pilot-Analyse: Daten ──────────────────────────────────────────── */
  function jahre() {
    var R = (window.State && Array.isArray(window.State.cfRows)) ? window.State.cfRows : [];
    return R.slice(0, 15).map(function (r) {
      return { j: +r.cal, nkm: zahl(r.nkm_y), bwk: zahl(r.bwk_cf_y), zins: zahl(r.zy), tilg: zahl(r.ty), su: zahl(r.su_y) || 0, bspar: zahl(r.bspar_y) || 0,
        cfop: zahl(r.cfop_y), cfns: zahl(r.cfns_y), rs: zahl(r.rs), wert: zahl(r.wert_y), steuer: zahl(r.tax_y), afa: zahl(r.afa_y), vuv: zahl(r.zve_y) };
    }).filter(function (r) { return r.j > 1900; });
  }
  function sigJ(J) { return J.map(function (r) { return [r.j, Math.round(r.cfop || 0), Math.round(r.cfns || 0), Math.round(r.rs || 0), Math.round(r.wert || 0), Math.round(r.vuv || 0)].join(','); }).join(';'); }

  /* 1 · Vermögensaufbau */
  function vermoegen(k, w, J) {
    var x = J.map(function (r) { return r.j; }), H = heuteJahr();
    var rs = J.map(function (r) { return r.rs; }), ek = J.map(function (r) { return r.wert != null && r.rs != null ? r.wert - r.rs : null; });
    var e0 = ek[0], eN = ek[ek.length - 1];
    var titel = e0 != null && eN != null ? 'Dein Anteil am Objekt wächst von ' + eur(e0) + ' auf ' + eur(eN) + ' bis ' + x[x.length - 1] : 'Vermögensaufbau';
    k.innerHTML = karteHtml('verm', titel, 'Wert des Objekts = Restschuld der Bank + dein Eigenkapital · schraffiert ab ' + (H + 1) + ' Projektion',
      saeulen({ id: 'verm', breite: w, hoehe: 250, x: x, heute: H, projAb: H + 1, gestapelt: true, aria: 'Restschuld und Eigenkapital je Jahr',
        reihen: [{ name: 'Restschuld', werte: rs, farbe: 'var(--gn-grau)' }, { name: 'Eigenkapital', werte: ek, farbe: function (v) { return v < 0 ? 'var(--gn-rot)' : 'var(--gn-gold)'; } }] }),
      legende([{ name: 'Restschuld der Bank', farbe: 'color-mix(in srgb,currentColor 30%,transparent)' }, { name: 'Dein Eigenkapital', farbe: 'var(--gn-gold)' }, { name: 'Projektion', farbe: 'var(--gn-gold)', muster: true }]));
    tipBinden(k, function (i) { var r = J[i]; if (!r) return ''; return '<div class="gn-tip-j">' + r.j + (r.j > H ? ' · Projektion' : '') + '</div>Wert <b>' + eur(r.wert) + '</b><br>Restschuld <b>' + eur(r.rs) + '</b><br>Eigenkapital <b>' + eur(ek[i]) + '</b>'; });
  }
  /* 2 · Cashflow-Brücke des laufenden Jahres */
  function bruecke(k, w, J) {
    var H = heuteJahr(), r = J.filter(function (x) { return x.j === H; })[0] || J[0]; if (!r || r.nkm == null || r.cfop == null) { k.innerHTML = ''; return; }
    var rest = r.cfop - (r.nkm - (r.bwk || 0) - (r.zins || 0) - (r.tilg || 0));
    var S = [{ name: 'Miete', wert: r.nkm, art: 'start' }, { name: 'Kosten', wert: -(r.bwk || 0) }, { name: 'Zins', wert: -(r.zins || 0) }, { name: 'Tilgung', kurz: 'Tilg.', wert: -(r.tilg || 0) }];
    if (Math.abs(rest) >= 1) S.push({ name: 'Sonstiges', kurz: 'Sonst.', wert: rest });
    S.push({ name: 'vor Steuer', kurz: 'vor St.', art: 'summe' });
    var st = r.cfns != null ? r.cfns - r.cfop : null;
    if (st != null && Math.abs(st) >= 1) { S.push({ name: 'Steuer', wert: st }); S.push({ name: 'nach Steuer', kurz: 'nach St.', art: 'summe' }); }
    var wf = wasserfall({ breite: w, hoehe: 250, schritte: S, aria: 'Cashflow-Brücke ' + r.j });
    /* Prüfung: die Brücke endet beim Cashflow der App */
    var ende = wf.zeilen[wf.zeilen.length - 1].b, soll = st != null && Math.abs(st) >= 1 ? r.cfns : r.cfop;
    if (Math.abs(ende - soll) > 1) try { console.warn('[grafiken-neu] Brücke geht nicht auf', ende, soll); } catch (e) {}
    var titel = r.cfop < 0 ? r.j + ' fehlen nach Zins und Tilgung ' + eur(-r.cfop) : r.j + ' bleiben nach Zins und Tilgung ' + eur(r.cfop);
    k.innerHTML = karteHtml('br', titel, '€ im Jahr' + (st != null && Math.abs(st) >= 1 ? ' · die Steuer ' + (st > 0 ? 'bringt ' + eur(st) + ' zurück' : 'kostet ' + eur(-st)) : ''), wf.svg);
    tipBinden(k, function (i) { var z = wf.zeilen[i]; if (!z) return ''; var v = z.summe || z.s.art === 'start' ? z.b : z.b - z.a; return '<div class="gn-tip-j">' + esc(z.s.name) + '</div><b>' + (z.summe || z.s.art === 'start' ? eur(v) : eurV(v)) + '</b> im Jahr'; });
  }
  /* 3 · Weg zum positiven Cashflow */
  function wegPositiv(k, w, J) {
    var x = J.map(function (r) { return r.j; }), H = heuteJahr();
    var vor = J.filter(function (r) { return r.cfop > 0; })[0], nach = J.filter(function (r) { return r.cfns > 0; })[0];
    var titel = vor && nach ? (vor.j === nach.j ? 'Ab ' + vor.j + ' im Plus' : 'Vor Steuer ab ' + vor.j + ' im Plus, nach Steuer ab ' + nach.j) : (vor ? 'Vor Steuer ab ' + vor.j + ' im Plus' : (nach ? 'Nach Steuer ab ' + nach.j + ' im Plus' : 'In den nächsten ' + J.length + ' Jahren kein positiver Cashflow'));
    if (J[0] && J[0].cfop > 0 && J[0].cfns > 0) titel = 'Der Cashflow ist von Anfang an positiv';
    var marken = []; if (nach && nach.j !== x[0]) marken.push({ x: nach.j, text: 'nach Steuer im Plus' });
    k.innerHTML = karteHtml('weg', titel, 'Cashflow im Jahr · rechts von ' + H + ' Projektion',
      linien({ breite: w, hoehe: 230, x: x, heute: H, projAb: H + 1, marken: marken, aria: 'Cashflow vor und nach Steuer je Jahr',
        reihen: [{ name: 'vor Steuer', werte: J.map(function (r) { return r.cfop; }), farbe: 'var(--gn-grau)' }, { name: 'nach Steuer', werte: J.map(function (r) { return r.cfns; }), farbe: 'var(--gn-gold)', dick: 2.75 }] }),
      legende([{ name: 'vor Steuer', farbe: 'color-mix(in srgb,currentColor 30%,transparent)', linie: true }, { name: 'nach Steuer', farbe: 'var(--gn-gold)', linie: true }]));
    tipBinden(k, function (i) { var r = J[i]; if (!r) return ''; return '<div class="gn-tip-j">' + r.j + (r.j > H ? ' · Projektion' : '') + '</div>vor Steuer <b>' + eurV(r.cfop) + '</b><br>Steuer <b>' + eurV(r.cfns - r.cfop) + '</b><br>nach Steuer <b>' + eurV(r.cfns) + '</b>'; });
  }
  /* 4 · Plan vom Kauf gegen Ist */
  function planIst(k, w) {
    var Z = []; try { Z = window.DpJahresbuch && window.DpJahresbuch.zeilen ? window.DpJahresbuch.zeilen() : []; } catch (e) { Z = []; }
    Z = Z.filter(function (z) { return z && z.jahr && !z.ohne_plan && (z.miete_plan != null || z.cf_plan != null); }).sort(function (a, b) { return a.jahr - b.jahr; });
    if (!Z.length) { k.innerHTML = ''; return ''; }
    var H = heuteJahr(), x = Z.map(function (z) { return z.jahr; });
    var mP = Z.map(function (z) { return zahl(z.miete_plan); }), mI = Z.map(function (z) { return zahl(z.miete_ist); });
    var cP = Z.map(function (z) { return zahl(z.cf_plan); }), cI = Z.map(function (z) { return zahl(z.cf_stand) != null ? zahl(z.cf_stand) : zahl(z.cf_proj); });
    var lz = Z.length - 1, dm = mI[lz] != null && mP[lz] != null ? mI[lz] - mP[lz] : null;
    var besser = Z.filter(function (z, i) { return mI[i] != null && mP[i] != null && mI[i] >= mP[i] - 0.5; }).length;
    var titel = dm == null ? 'Plan vom Kauf gegen Ist' : (besser === Z.length ? 'Jedes Jahr mindestens wie beim Kauf geplant, ' + x[lz] + ' ' + eurV(dm) + ' Miete' : x[lz] + ' ' + eurV(dm) + ' Miete gegen den Plan vom Kauf');
    var schmal = w < 560, bw = schmal ? w : Math.floor((w - 24) / 2);
    var teil = function (t, p, s) { return '<div style="min-width:0"><div class="dp-gn-k-s" style="margin:0 0 2px;font-weight:600;color:inherit">' + t + '</div>' + hantel({ breite: bw, x: x, plan: p, ist: s, heute: H, aria: t + ' Plan gegen Ist' }) + '</div>'; };
    k.innerHTML = karteHtml('pi', titel, '€ im Jahr · grauer Punkt Plan vom Kauf, goldener Punkt Ist' + (x.indexOf(H) >= 0 ? ' · ' + H + ' läuft noch' : ''),
      '<div style="display:grid;grid-template-columns:' + (schmal ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))') + ';gap:12px 24px">' + teil('Kaltmiete', mP, mI) + teil('Cashflow vor Steuer', cP, cI) + '</div>',
      legende([{ name: 'Plan vom Kauf', farbe: 'color-mix(in srgb,currentColor 30%,transparent)' }, { name: 'Ist', farbe: 'var(--gn-gold)' }, { name: 'besser als Plan', farbe: 'var(--gn-gruen)', linie: true }, { name: 'schlechter', farbe: 'var(--gn-rot)', linie: true }]));
    tipBinden(k, function (i) { var z = Z[i]; if (!z) return ''; return '<div class="gn-tip-j">' + z.jahr + '</div>Miete Plan <b>' + eur(mP[i]) + '</b> · Ist <b>' + eur(mI[i]) + '</b><br>Cashflow Plan <b>' + eurV(cP[i]) + '</b> · Ist <b>' + eurV(cI[i]) + '</b>'; });
    return x.join(',') + mI.join(',') + cI.join(',');
  }
  /* 5 · Mietspielraum je Wohnung */
  function spielraum(k, w) {
    var A = null; try { A = window.DpMieteMax && window.DpMieteMax.alle ? window.DpMieteMax.alle() : null; } catch (e) { A = null; }
    var W = A && Array.isArray(A.W) ? A.W : []; if (!W.length) { k.innerHTML = ''; return; }
    var zeilen = W.map(function (e) {
      var h = zahl(e.heute) || 0, b = Math.max(h, zahl(e.bestand && e.bestand.monat) || 0), m = Math.max(b, zahl(e.max) || 0, zahl(e.neu && e.neu.monat) || 0);
      return { e: e, h: h, b: b, m: m, name: (A.mfh ? 'Whg. ' + (e.nr || (e.i + 1)) : 'Wohnung') + (e.leer || !(h > 0) ? ' (leer)' : ''),
        segs: [{ von: 0, bis: h, farbe: 'color-mix(in srgb,currentColor 30%,transparent)' }, { von: h, bis: b, farbe: 'var(--gn-gold)' }, { von: b, bis: m, farbe: 'var(--gn-gold-h)', muster: true }].filter(function (s) { return s.bis - s.von > 0.4; }),
        wertText: m - h >= 1 ? eurV(m - h) : 'kein Spielraum', wertFarbe: m - h >= 1 ? 'var(--gn-gruen)' : null };
    });
    var ges = summe(zeilen, function (z) { return z.m - z.h; }), sof = summe(zeilen, function (z) { return z.b - z.h; });
    if (!A.mfh && ges < 1) { k.innerHTML = ''; return 'leer'; }   /* eine Wohnung ohne Spielraum: der Satz darunter sagt es schon */
    var titel = ges >= 1 ? 'Zusammen ' + eurV(ges) + ' Miete im Monat möglich, davon ' + eur(sof) + ' sofort im Bestand' : 'Kein Spielraum für eine höhere Miete';
    k.innerHTML = karteHtml('sp', titel, '€ Kaltmiete im Monat je Wohnung · heute, im Bestand erhöhbar, nur bei Neuvermietung',
      balkenH({ id: 'sp', breite: w, zeilen: zeilen, namenBreite: 110, aria: 'Mietspielraum je Wohnung' }),
      legende([{ name: 'Miete heute', farbe: 'color-mix(in srgb,currentColor 30%,transparent)' }, { name: 'sofort im Bestand', farbe: 'var(--gn-gold)' }, { name: 'nur bei Neuvermietung', farbe: 'var(--gn-gold-h)', muster: true }]));
    tipBinden(k, function (i) { var z = zeilen[i]; if (!z) return ''; return '<div class="gn-tip-j">' + esc(z.name) + '</div>heute <b>' + eur(z.h) + '</b><br>im Bestand bis <b>' + eur(z.b) + '</b><br>bei Neuvermietung bis <b>' + eur(z.m) + '</b>'; });
    return zeilen.map(function (z) { return [z.h, z.b, z.m].map(Math.round).join('/'); }).join(',');
  }
  /* 6 · Ergebnis aus Vermietung */
  function ergebnisVuV(k, w, J) {
    var R = J.filter(function (r) { return r.vuv != null; }); if (R.length < 2) { k.innerHTML = ''; return; }
    var H = heuteJahr(), erst = R.filter(function (r) { return r.vuv > 0; })[0];
    var titel = R[0].vuv > 0 ? 'Das Objekt erzielt von Anfang an einen steuerlichen Überschuss' : (erst ? 'Ab ' + erst.j + ' wird aus dem Verlust ein Überschuss' : 'In den nächsten ' + R.length + ' Jahren bleibt ein steuerlicher Verlust');
    k.innerHTML = karteHtml('vuv', titel, 'Ergebnis Anlage V im Jahr · ein Verlust senkt deine Steuer, ein Überschuss erhöht sie',
      saeulen({ id: 'vuv', breite: w, hoehe: 220, x: R.map(function (r) { return r.j; }), heute: H, projAb: H + 1, aria: 'Ergebnis aus Vermietung je Jahr',
        reihen: [{ name: 'Ergebnis', werte: R.map(function (r) { return r.vuv; }), farbe: function (v) { return v < 0 ? 'var(--gn-gold-h)' : 'var(--gn-gold-d)'; } }] }),
      legende([{ name: 'Verlust (Steuer sinkt)', farbe: 'var(--gn-gold-h)' }, { name: 'Überschuss (Steuer steigt)', farbe: 'var(--gn-gold-d)' }]));
    tipBinden(k, function (i) { var r = R[i]; if (!r) return ''; return '<div class="gn-tip-j">' + r.j + (r.j > H ? ' · Projektion' : '') + '</div>Ergebnis <b>' + eurV(r.vuv) + '</b><br>davon AfA <b>' + eur(r.afa) + '</b><br>Steuer <b>' + (r.steuer <= 0 ? 'Erstattung ' + eur(-r.steuer) : eur(r.steuer)) + '</b>'; });
  }

  /* 4b · v4160 · Verlauf im Jahresabgleich: EIN Bild je Jahr mit Plan vom Kauf, Ist, Projektion (gestrichelt),
     umschaltbar Kaltmiete / Cashflow vor Steuer / nach Steuer, Abweichung als Band (grün darüber, rot darunter),
     festgeschriebene Jahre mit Schloss. Marcel 23.11.2026: „Kann man das besser darstellen, Verlauf vor Steuer und
     alles? Geht da noch was?“ Ersetzt die Karten Plan gegen Ist und Weg zum positiven Cashflow (v4140).
     Plan = Ankauf-Stand (DealPilotAnkauf.stand().plan), Ist/Projektion = State.cfRows, Ist-Miete = DpJahresbuch. */
  var _jaModus = 'cfop';
  function verlaufJa(k, w) {
    var H = heuteJahr(), R = (window.State && Array.isArray(window.State.cfRows)) ? window.State.cfRows : [];
    var plan = []; try { var A = window.DealPilotAnkauf, st = A && A.vorhanden && A.vorhanden() ? A.stand() : null; plan = st && Array.isArray(st.plan) ? st.plan : []; } catch (e) { plan = []; }
    var Z = []; try { Z = window.DpJahresbuch && window.DpJahresbuch.zeilen ? window.DpJahresbuch.zeilen() : []; } catch (e) { Z = []; }
    var feld = { miete: 'nkm_y', cfop: 'cfop_y', cfns: 'cfns_y' }[_jaModus], wort = { miete: 'Kaltmiete', cfop: 'Cashflow vor Steuer', cfns: 'Cashflow nach Steuer' }[_jaModus];
    var start = plan.length ? plan[0].cal : (R[0] ? R[0].cal : H), X = [];
    for (var j = start; j < start + 15; j++) X.push(j);
    var pv = X.map(function (j) { var p = plan.filter(function (x) { return x.cal === j; })[0]; return p ? zahl(p[feld]) : null; });
    var iv = X.map(function (j) {
      var r = R.filter(function (x) { return x.cal === j; })[0], v = r ? zahl(r[feld]) : null;
      if (_jaModus === 'miete') { var z = Z.filter(function (q) { return q.jahr === j; })[0]; if (z && j <= H && zahl(z.miete_ist) != null) v = zahl(z.miete_ist); }
      return v;
    });
    if (iv.filter(function (v) { return v != null; }).length < 2) { k.innerHTML = ''; return ''; }
    var festJ = X.map(function (j) { if (j >= H) return null; try { var f = window.DpJahresbuch && window.DpJahresbuch.fest ? window.DpJahresbuch.fest(j) : {}; var n = Object.keys(f || {}).length; return n ? { n: n, ks: Object.keys(f) } : null; } catch (e) { return null; } });
    /* Titel */
    var hi = X.indexOf(H), dH = hi >= 0 && pv[hi] != null && iv[hi] != null ? iv[hi] - pv[hi] : null;
    var vergangen = X.map(function (j, i) { return j <= H && pv[i] != null && iv[i] != null ? iv[i] - pv[i] : null; }).filter(function (v) { return v != null; });
    var immer = vergangen.length && vergangen.every(function (d) { return d >= -0.5; });
    var plus = _jaModus !== 'miete' ? X.filter(function (j, i) { return j > H && iv[i] != null && iv[i] > 0; })[0] : null;
    var titel = !plan.length ? wort + ': Projektion der App' + (plus ? ', im Plus ab ' + plus : '')
      : (immer ? wort + ': jedes Jahr mindestens wie beim Kauf geplant' : wort + (dH != null ? ' ' + H + ' ' + eurV(dH) + ' gegen den Plan vom Kauf' : ' gegen den Plan vom Kauf')) + (dH != null && immer ? ', ' + H + ' ' + eurV(dH) : '') + (plus ? ', im Plus ab ' + plus : '');
    /* Zeichnung */
    var Hh = 270, L = 56, Rr = 14, T = 16, B = 44, n = X.length;
    var alle = pv.concat(iv).filter(function (v) { return v != null && isFinite(v); });
    var tk = ticks(Math.min(0, Math.min.apply(null, alle)), Math.max(0, Math.max.apply(null, alle)), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    var pw = w - L - Rr, ph = Hh - T - B, dx = pw / (n - 1), xv = function (i) { return L + dx * i; }, yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var o = ['<svg viewBox="0 0 ' + w + ' ' + Hh + '" role="img" aria-label="' + esc(wort + ' Plan gegen Ist je Jahr') + '">'];
    if (hi >= 0 && hi < n - 1) o.push('<rect class="gn-proj" x="' + f1(xv(hi)) + '" y="' + T + '" width="' + f1(w - Rr - xv(hi)) + '" height="' + ph + '"/>');
    tk.forEach(function (t) { o.push('<line class="gn-netz" x1="' + L + '" x2="' + (w - Rr) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="gn-ax" x="' + (L - 7) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end">' + kurzEur(t) + '</text>'); });
    if (y0 < 0) o.push('<line class="gn-null" x1="' + L + '" x2="' + (w - Rr) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '"/>');
    /* Band: Abweichung Ist gegen Plan, an Kreuzungen geteilt */
    for (var i = 0; i < n - 1; i++) {
      var a0 = pv[i], a1 = pv[i + 1], b0 = iv[i], b1 = iv[i + 1]; if ([a0, a1, b0, b1].some(function (v) { return v == null; })) continue;
      var d0 = b0 - a0, d1 = b1 - a1, xa = xv(i), xb = xv(i + 1);
      var poly = function (pts, gut) { o.push('<polygon points="' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') + '" style="fill:' + (gut ? 'var(--gn-gruen)' : 'var(--gn-rot)') + ';fill-opacity:.22"/>'); };
      if (d0 * d1 >= 0) poly([[xa, yv(a0)], [xb, yv(a1)], [xb, yv(b1)], [xa, yv(b0)]], d0 + d1 >= 0);
      else { var t = d0 / (d0 - d1), xc = xa + (xb - xa) * t, yc = yv(a0 + (a1 - a0) * t); poly([[xa, yv(a0)], [xc, yc], [xa, yv(b0)]], d0 >= 0); poly([[xc, yc], [xb, yv(a1)], [xb, yv(b1)]], d1 >= 0); }
    }
    var pfad = function (werte, von, bis) { var d = '', auf = false; for (var q = von; q <= bis; q++) { var v = werte[q]; if (v == null) { auf = false; continue; } d += (auf ? 'L' : 'M') + f1(xv(q)) + ' ' + f1(yv(v)); auf = true; } return d; };
    o.push('<path class="gn-linie" d="' + pfad(pv, 0, n - 1) + '" style="fill:none;stroke:var(--gn-grau);stroke-width:2;stroke-dasharray:2 4;stroke-linecap:round"/>');
    var bisIst = hi >= 0 ? hi : n - 1;
    o.push('<path class="gn-linie" d="' + pfad(iv, 0, bisIst) + '" style="fill:none;stroke:var(--gn-gold);stroke-width:2.75;stroke-linejoin:round;stroke-linecap:round"/>');
    if (bisIst < n - 1) o.push('<path d="' + pfad(iv, bisIst, n - 1) + '" style="fill:none;stroke:var(--gn-gold);stroke-width:2.25;stroke-dasharray:6 5;opacity:.85"/>');
    iv.forEach(function (v, q) { if (v == null || X[q] > H) return; o.push('<circle class="gn-punkt" cx="' + f1(xv(q)) + '" cy="' + f1(yv(v)) + '" r="3.6" style="fill:var(--gn-gold);stroke:var(--gn-card,#0E0D0B);stroke-width:2;animation-delay:' + (300 + q * 40) + 'ms"/>'); });
    if (hi >= 0) o.push('<line class="gn-heute" x1="' + f1(xv(hi)) + '" x2="' + f1(xv(hi)) + '" y1="' + T + '" y2="' + (T + ph) + '"/><text class="gn-wert" x="' + f1(xv(hi) + 5) + '" y="' + (T + 10) + '" style="fill:var(--gn-gold-h)">HEUTE</text>');
    var jede = Math.ceil(n / Math.max(1, Math.floor(pw / 44)));
    X.forEach(function (j, q) {
      if (q % jede === 0 || q === n - 1) o.push('<text class="gn-ax" x="' + f1(xv(q)) + '" y="' + (Hh - 24) + '" text-anchor="middle"' + (j === H ? ' style="fill:var(--gn-gold-h);font-weight:600"' : '') + '>' + j + '</text>');
      var fj = festJ[q];
      if (fj) { var lx = xv(q), ly = Hh - 12, voll = fj.n >= 4; o.push('<g><rect x="' + f1(lx - 4.5) + '" y="' + (ly - 3) + '" width="9" height="7" rx="1.5" style="fill:' + (voll ? 'var(--gn-gold)' : 'none') + ';stroke:var(--gn-gold);stroke-width:1.3"/><path d="M' + f1(lx - 2.6) + ' ' + (ly - 3) + ' v-2.2 a2.6 2.6 0 0 1 5.2 0 v2.2" style="fill:none;stroke:var(--gn-gold);stroke-width:1.3"/></g>'); }
      o.push('<rect class="gn-treff" data-gn-i="' + q + '" x="' + f1(xv(q) - dx / 2) + '" y="' + T + '" width="' + f1(dx) + '" height="' + (Hh - T) + '"/><rect class="gn-hl" x="' + f1(xv(q) - dx / 2) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '"/>');
    });
    o.push('</svg>');
    var seg = '<div class="dp-gn-seg" role="group" aria-label="Kennzahl" style="margin:0 0 10px">' + [['miete', 'Kaltmiete'], ['cfop', 'vor Steuer'], ['cfns', 'nach Steuer']].map(function (m) { return '<button type="button" data-gn-ja-modus="' + m[0] + '" aria-pressed="' + (_jaModus === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>';
    k.innerHTML = karteHtml('ja', titel, '€ im Jahr · gepunktet Plan vom Kauf, gold Ist, gestrichelt Projektion ab ' + H + ' · Band: grün über, rot unter dem Plan · Schloss: festgeschrieben', seg + o.join(''),
      legende([{ name: 'Plan vom Kauf', farbe: 'color-mix(in srgb,currentColor 30%,transparent)', linie: true }, { name: 'Ist', farbe: 'var(--gn-gold)', linie: true }, { name: 'Projektion', farbe: 'var(--gn-gold)', muster: true }, { name: 'besser als Plan', farbe: 'var(--gn-gruen)' }, { name: 'schlechter', farbe: 'var(--gn-rot)' }]));
    k.onclick = function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('[data-gn-ja-modus]') : null; if (!b) return; _jaModus = b.getAttribute('data-gn-ja-modus'); k.removeAttribute('data-gn-sig'); lauf(); };
    var SW = { miete: 'Kaltmiete', cfop: 'vor Steuer', cfns: 'nach Steuer' };
    tipBinden(k, function (q) {
      var j = X[q]; if (j == null) return ''; var p = pv[q], s = iv[q], f = festJ[q];
      return '<div class="gn-tip-j">' + j + (j > H ? ' · Projektion' : j === H ? ' · läuft' : '') + '</div>' + SW[_jaModus] + '<br>Plan vom Kauf <b>' + (p == null ? 'keine Angabe' : eurV(p)) + '</b><br>' + (j > H ? 'Projektion' : 'Ist') + ' <b>' + (s == null ? 'keine Angabe' : eurV(s)) + '</b>'
        + (p != null && s != null ? '<br>Abweichung <b>' + eurV(s - p) + '</b>' : '') + (f ? '<br>festgeschrieben: ' + f.ks.map(function (x) { return { miete: 'Miete', steuer: 'Steuer', wert: 'Wert', haus: 'Haus' }[x] || x; }).join(', ') : '');
    });
    return _jaModus + pv.join(',') + iv.map(function (v) { return v == null ? '' : Math.round(v); }).join(',') + festJ.map(function (f) { return f ? f.n : 0; }).join('');
  }

  function pilotAnalyse() {
    var wr = document.querySelector('.dp-pa-wrap'); if (!wr) return;
    var J = jahre(), sj = sigJ(J);
    /* Übersicht */
    var ue = document.getElementById('dp-pa-uebersicht');
    if (ue && J.length >= 2) {
      var alt = ue.querySelector('[data-dp-pa4-mini="vermoegen"]');
      var reihe = ue.querySelector('[data-dp-gn="ue-reihe"]');
      if (!reihe) { reihe = document.createElement('div'); reihe.setAttribute('data-dp-gn', 'ue-reihe'); reihe.className = 'dp-gn-reihe'; if (alt) alt.parentNode.insertBefore(reihe, alt); else ue.appendChild(reihe); }
      var k1 = platz(reihe, 'verm', null, 'dp-pa-card dp-gn-karte'), k2 = reihe.querySelector('[data-dp-gn="br"]');
      if (!k2) { k2 = document.createElement('div'); k2.setAttribute('data-dp-gn', 'br'); k2.className = 'dp-gn dp-pa-card dp-gn-karte'; reihe.appendChild(k2); }
      zeichnen(k1, sj, function (k, w) { vermoegen(k, w, J); });
      zeichnen(k2, sj, function (k, w) { bruecke(k, w, J); });
      weg(alt);
    }
    /* Jahresabgleich: statt der Karten Kaltmiete/Cashflow */
    var ja = document.getElementById('dp-pa-jahr');
    if (ja) {
      var karten = ja.querySelector('.jbg-karten');
      if (karten) {
        var anker = karten.parentNode;
        var kpi = platz(anker, 'pi', karten, 'dp-pa-card dp-gn-karte'), kw = platz(anker, 'weg', karten, 'dp-pa-card dp-gn-karte');
        var sigZ = ''; try { sigZ = JSON.stringify((window.DpJahresbuch && DpJahresbuch.zeilen ? DpJahresbuch.zeilen() : []).map(function (z) { return [z.jahr, z.miete_ist, z.miete_plan, z.cf_plan, z.cf_proj, z.cf_stand, JSON.stringify(DpJahresbuch.fest ? DpJahresbuch.fest(z.jahr) : '')]; })); } catch (e) {}
        /* v4160 · ein gemeinsamer Verlauf statt zwei Karten (planIst, wegPositiv bleiben für andere Stellen) */
        zeichnen(kpi, _jaModus + sj + sigZ, function (k, w) { verlaufJa(k, w); });
        kw.innerHTML = ''; kw.style.display = 'none';
        weg(karten);
      }
    }
    /* Potenzial */
    var pot = document.getElementById('dp-pa-pot');
    if (pot) {
      var sigM = ''; try { sigM = JSON.stringify((window.DpMieteMax && DpMieteMax.alle ? DpMieteMax.alle().W : []).map(function (e) { return [e.heute, e.bestand && e.bestand.monat, e.max]; })); } catch (e) {}
      var ks = platz(pot, 'sp', pot.firstChild, 'dp-pa-card dp-gn-karte');
      zeichnen(ks, sigM, function (k, w) { spielraum(k, w); });
    }
    /* Steuer: statt Steuerverlauf */
    var st = document.getElementById('dp-pa-steuer');
    if (st && J.length >= 2) {
      var sv = st.querySelector('[data-dp-steuerverlauf]'), svK = sv ? sv.closest('.dp-pa-card') : null;
      var kv = platz(st, 'vuv', svK || null, 'dp-pa-card dp-gn-karte');
      if (!svK && kv.parentNode === st && st.lastChild !== kv) { /* ohne alten Verlauf ans Ende des Kopfs */ }
      zeichnen(kv, sj, function (k, w) { ergebnisVuV(k, w, J); });
      weg(svK);
    }
  }

  /* ── Portfolio-Cockpit ─────────────────────────────────────────────── */
  var _cp = { art: 'all', obj: 'all', cf: 'ns', jahr: null };
  function cpDaten() {
    var D = window.DealPilotDashboard; if (!D || !D.portfolioPayload) return [];
    var p = null, det = []; try { p = D.portfolioPayload(); det = D.grafikDaten ? D.grafikDaten() : []; } catch (e) { return []; }
    var O = (p && p.objekte) || [];
    return O.map(function (o, i) {
      var d = det[i] || {}, kp = zahl(o.kaufpreis_eur) || 0, sv = zahl(String(d.svwert || '').replace(/\./g, '').replace(',', '.'));
      var dar = zahl(o.darlehen_eur) || 0, zinsJ = zahl(o.zins_eur_jahr) || 0, tilgJ = zahl(o.tilgung_eur_jahr) || 0;
      var afaB = zahl(d._kpis_afa_geb_basis), afaS = zahl(d._kpis_afa_satz);
      return { id: o.id, name: o.name || ('Objekt ' + (i + 1)), art: o.objektart || 'Objekt', kp: kp, marktwert: sv > 0 ? sv : kp, belegt: sv > 0,
        darlehen: dar, rest: zahl(o.restschuld_eur) || 0, zinsPct: dar ? zinsJ / dar * 100 : null, rateJ: zinsJ + tilgJ,
        mieteJ: zahl(o.miete_kalt_eur_jahr), cfvs: zahl(o.cashflow_vor_steuer_eur_jahr), cfns: zahl(o.cashflow_nach_steuer_eur_jahr),
        dscr: zahl(o.dscr), bmy: zahl(o.bruttomietrendite_prozent), wfl: zahl(o.wohnflaeche_qm), we: zahl(o.wohneinheiten),
        score: zahl(o.investor_deal_score) != null ? zahl(o.investor_deal_score) : zahl(o.dealpilot_score),
        bindEnde: d._kpis_bindung_ende || null, rsBind: zahl(d._kpis_rs_bindung), afa: afaB != null && afaS != null ? afaB * afaS / 100 : null,
        wertstg: zahl(String(d.wertstg == null ? '' : d.wertstg).replace(',', '.')) };
    });
  }
  function hinweise(rows) {
    var H = {}; rows.forEach(function (r) { H[r.id] = []; });
    var dup = {}; rows.forEach(function (r) { if (!r.kp) return; var s = Math.round(r.kp) + '|' + Math.round(r.darlehen) + '|' + Math.round(r.rest); (dup[s] = dup[s] || []).push(r); });
    Object.keys(dup).forEach(function (s) { if (dup[s].length > 1) dup[s].forEach(function (r) { H[r.id].push('gleiche Finanzierung wie ' + dup[s].filter(function (x) { return x !== r; }).map(function (x) { return x.name; }).join(', ') + ', doppelt angelegt?'); }); });
    rows.forEach(function (r) {
      if (r.wfl != null && r.wfl / Math.max(1, r.we || 1) > 400) H[r.id].push('Wohnfläche ' + nf0.format(r.wfl) + ' m² prüfen');
      if (r.kp && r.darlehen / r.kp > 1.05) H[r.id].push('Darlehen ' + nf1.format(r.darlehen / r.kp * 100) + ' % des Kaufpreises');
    });
    return H;
  }
  function projektion(rows, bis) {
    var J0 = heuteJahr(), out = [];
    var P = rows.map(function (r) {
      var g = (r.wertstg != null ? r.wertstg : 1.5) / 100, z = (r.zinsPct || 0) / 100, rest = r.rest, a = [];
      for (var j = J0; j <= bis; j++) { var wert = r.marktwert * Math.pow(1 + g, j - J0); a.push({ wert: wert, rest: rest }); rest = Math.max(0, rest * (1 + z) - r.rateJ); }
      return a;
    });
    for (var j = J0, i = 0; j <= bis; j++, i++) out.push({ jahr: j, wert: summe(P, function (p) { return p[i].wert; }), rest: summe(P, function (p) { return p[i].rest; }) });
    out.forEach(function (p) { p.netto = p.wert - p.rest; });
    return out;
  }
  function cockpit() {
    var m = document.getElementById('dashboard-main'); if (!m || m.style.display === 'none' || m.getAttribute('data-dp-built') !== '1') return;
    var hero = document.getElementById('dp-pscore-hero'); if (!hero) return;
    var alle = cpDaten(); if (!alle.length) return;
    var host = m.querySelector('[data-dp-gn="cp"]');
    if (!host) {
      host = document.createElement('div'); host.setAttribute('data-dp-gn', 'cp'); host.className = 'dp-gn dp-gn-cp';
      hero.parentNode.insertBefore(host, hero.nextSibling);
      host.addEventListener('change', function (ev) {
        var t = ev.target; if (!t || !t.getAttribute) return; var f = t.getAttribute('data-gn-f'); if (!f) return;
        _cp[f] = f === 'jahr' ? +t.value : t.value; if (f === 'art') _cp.obj = 'all'; host.removeAttribute('data-gn-sig'); cockpit();
      });
      host.addEventListener('input', function (ev) { var t = ev.target; if (t && t.getAttribute && t.getAttribute('data-gn-f') === 'jahr') { _cp.jahr = +t.value; host.removeAttribute('data-gn-sig'); cockpit(); } });
      host.addEventListener('click', function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('[data-gn-cf]') : null; if (!b) return; _cp.cf = b.getAttribute('data-gn-cf'); host.removeAttribute('data-gn-sig'); cockpit(); });
    }
    var sig = JSON.stringify(alle.map(function (r) { return [r.id, Math.round(r.rest), Math.round(r.cfns || 0), Math.round(r.marktwert)]; })) + JSON.stringify(_cp);
    zeichnen(host, sig, function (k, w) { cockpitZeichnen(k, w, alle); });
  }
  function cockpitZeichnen(k, w, alle) {
    var J0 = heuteJahr(), JE = J0 + 29; if (!_cp.jahr) _cp.jahr = J0 + 10;
    var arten = []; alle.forEach(function (r) { if (arten.indexOf(r.art) < 0) arten.push(r.art); });
    var rows = _cp.obj !== 'all' ? alle.filter(function (r) { return r.id === _cp.obj; }) : alle.filter(function (r) { return _cp.art === 'all' || r.art === _cp.art; });
    if (!rows.length) { rows = alle; _cp.obj = 'all'; _cp.art = 'all'; }
    var cfK = _cp.cf === 'ns' ? 'cfns' : 'cfvs', cfW = _cp.cf === 'ns' ? 'nach Steuer' : 'vor Steuer';
    var scope = _cp.obj !== 'all' ? rows[0].name : (_cp.art === 'all' ? rows.length + ' Objekte' : rows.length + ' × ' + _cp.art);
    var W = summe(rows, function (r) { return r.marktwert; }), RS = summe(rows, function (r) { return r.rest; }), KP = summe(rows, function (r) { return r.kp; });
    var MJ = summe(rows, function (r) { return r.mieteJ; }), CF = summe(rows, function (r) { return r[cfK]; });
    var KD = summe(rows, function (r) { return r.rateJ; });
    var proj = projektion(rows, JE), pj = proj[_cp.jahr - J0] || proj[proj.length - 1];
    var unter1 = rows.filter(function (r) { return r.dscr != null && r.dscr < 1; }).length;
    var ds = rows.map(function (r) { return r.dscr; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    var med = ds.length ? (ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2) : null;
    var H = hinweise(alle);
    var halbe = w > 900 ? Math.floor((w - 16) / 2) - 34 : w - 34;
    var opt = function (v, t, an) { return '<option value="' + esc(v) + '"' + (an ? ' selected' : '') + '>' + esc(t) + '</option>'; };
    var kopf = '<div class="dp-gn-cp-kopf"><div><h3>Portfolio auf einen Blick</h3><small>Neue Grafiken (Vorschau) · ' + esc(scope) + ' · Werte heute aus DealPilot, Projektion mit der Wertsteigerung je Objekt, Zins und Rate wie heute</small></div>'
      + '<div class="dp-gn-filter">'
      + '<label>Art <select data-gn-f="art">' + opt('all', 'alle', _cp.art === 'all') + arten.map(function (a) { return opt(a, a, _cp.art === a); }).join('') + '</select></label>'
      + '<label>Objekt <select data-gn-f="obj">' + opt('all', 'alle', _cp.obj === 'all') + alle.filter(function (r) { return _cp.art === 'all' || r.art === _cp.art; }).map(function (r) { return opt(r.id, r.name, _cp.obj === r.id); }).join('') + '</select></label>'
      + '<span class="dp-gn-seg" role="group" aria-label="Cashflow"><button type="button" data-gn-cf="vs" aria-pressed="' + (_cp.cf === 'vs') + '">vor Steuer</button><button type="button" data-gn-cf="ns" aria-pressed="' + (_cp.cf === 'ns') + '">nach Steuer</button></span>'
      + '<label>Jahr <input type="range" data-gn-f="jahr" min="' + (J0 + 1) + '" max="' + JE + '" value="' + _cp.jahr + '"><b style="font-family:JetBrains Mono,monospace">' + _cp.jahr + '</b></label>'
      + '</div></div>';
    var kz = '<div class="dp-gn-kz">'
      + '<div><span>Vermögen netto</span><b>' + mio(W - RS) + '</b><small>Wert minus Restschuld</small></div>'
      + '<div><span>Cashflow ' + cfW + '</span><b style="color:' + (CF < 0 ? ROT : GRUEN) + '">' + eur(CF / 12) + '</b><small>im Monat, ' + eur(CF) + ' im Jahr</small></div>'
      + '<div><span>Bruttorendite</span><b>' + (KP ? nf2.format(MJ / KP * 100) + ' %' : 'keine Angabe') + '</b><small>Kaltmiete zu Kaufpreis</small></div>'
      + '<div><span>DSCR Median</span><b style="color:' + (med == null ? 'inherit' : med >= 1 ? GRUEN : ROT) + '">' + (med == null ? 'keine Angabe' : nf2.format(med)) + '</b><small>' + (unter1 ? unter1 + ' von ' + rows.length + ' unter 1,0' : 'alle ab 1,0') + '</small></div>'
      + '<div><span>LTV</span><b>' + (W ? nf1.format(RS / W * 100) + ' %' : 'keine Angabe') + '</b><small>Restschuld zu Wert</small></div>'
      + '<div><span>Restschuld</span><b>' + mio(RS) + '</b><small>Rate ' + eur(KD / 12) + ' im Monat</small></div>'
      + '<div><span>Netto ' + _cp.jahr + '</span><b>' + mio(pj.netto) + '</b><small>Projektion</small></div>'
      + '</div>';
    /* Grafiken */
    var x = proj.map(function (p) { return p.jahr; });
    var verdopplung = proj[0].netto > 0 ? proj.filter(function (p) { return p.jahr > J0 && p.netto >= 2 * proj[0].netto; })[0] : null;
    var gV = linien({ breite: w > 900 ? w - 34 : w - 34, hoehe: 250, x: x, heute: J0, marken: [{ x: _cp.jahr, text: String(_cp.jahr) }], aria: 'Vermögensaufbau Projektion',
      reihen: [{ name: 'Wert', werte: proj.map(function (p) { return p.wert; }), farbe: 'var(--gn-grau)', gestrichelt: true }, { name: 'Restschuld', werte: proj.map(function (p) { return p.rest; }), farbe: 'var(--gn-rot)', gestrichelt: true }, { name: 'Netto', werte: proj.map(function (p) { return p.netto; }), farbe: 'var(--gn-gold)', dick: 3 }] });
    /* Zinsbindung */
    var bj = {}; rows.forEach(function (r) { var j = String(r.bindEnde || '').slice(0, 4); if (/^\d{4}$/.test(j) && r.rsBind != null) bj[j] = (bj[j] || 0) + r.rsBind; });
    var bJ = Object.keys(bj).sort(), bMax = bJ.reduce(function (a, j) { return bj[j] > (bj[a] || 0) ? j : a; }, bJ[0]);
    var gB = bJ.length ? saeulen({ id: 'bind', breite: halbe, hoehe: 220, x: bJ.map(Number), aria: 'Restschuld zum Ende der Zinsbindung', reihen: [{ name: 'Restschuld', werte: bJ.map(function (j) { return bj[j]; }), farbe: function (v, i) { return bJ[i] === bMax ? 'var(--gn-gold)' : 'var(--gn-grau)'; } }] }) : '<p class="dp-gn-k-s">Keine Zinsbindung eingetragen.</p>';
    /* Cashflow je Objekt */
    var cfR = rows.filter(function (r) { return r[cfK] != null; }).sort(function (a, b) { return b[cfK] - a[cfK]; });
    var gC = balkenH({ id: 'cf', breite: halbe, zeilen: cfR.map(function (r) { return { name: r.name, segs: [{ von: 0, bis: r[cfK], farbe: r[cfK] >= 0 ? 'var(--gn-gruen)' : 'var(--gn-rot)' }], wertText: eurV(r[cfK]) }; }), zeileH: 26, namenBreite: 170, aria: 'Cashflow je Objekt' });
    var traeger = cfR.filter(function (r) { return r[cfK] > 0; }).length;
    /* Rendite gegen DSCR */
    var gS = streuung({ breite: halbe, hoehe: 260, aria: 'Bruttomietrendite gegen DSCR', punkte: rows.map(function (r) { return { x: r.bmy, y: r.dscr, z: r.kp, r: r }; }) });
    /* Steuer je Objekt */
    var stR = rows.filter(function (r) { return r.cfns != null && r.cfvs != null; }).map(function (r) { return { r: r, eff: r.cfns - r.cfvs }; }).sort(function (a, b) { return b.eff - a.eff; });
    var entl = summe(stR, function (s) { return s.eff; }), afaS = summe(rows, function (r) { return r.afa; });
    var gT = balkenH({ id: 'st', breite: halbe, zeilen: stR.map(function (s) { return { name: s.r.name, segs: [{ von: 0, bis: s.eff, farbe: s.eff >= 0 ? 'var(--gn-gruen)' : 'var(--gn-rot)' }], wertText: eurV(s.eff) }; }), zeileH: 26, namenBreite: 170, aria: 'Steuereffekt je Objekt' });
    /* Tabelle */
    var tab = '<table class="dp-gn-tab"><thead><tr><th>Objekt</th><th>Art</th><th>Wert</th><th>Restschuld</th><th>LTV</th><th>Rendite</th><th>Cashflow</th><th>DSCR</th><th>Bindung bis</th><th>Score</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var h = H[r.id] || [];
        return '<tr><td>' + esc(r.name) + (h.length ? '<br>' + h.map(function (t) { return '<span class="dp-gn-pill" title="Bitte prüfen">Bitte prüfen: ' + esc(t) + '</span>'; }).join('') : '') + '</td>'
          + '<td data-l="Art"><span>' + esc(r.art) + '</span></td><td data-l="Wert"><span>' + mio(r.marktwert) + (r.belegt ? '' : ' <small title="ohne Bewertung gilt der Kaufpreis">KP</small>') + '</span></td>'
          + '<td data-l="Restschuld">' + mio(r.rest) + '</td><td data-l="LTV">' + (r.marktwert ? nf1.format(r.rest / r.marktwert * 100) + ' %' : '') + '</td>'
          + '<td data-l="Rendite">' + (r.bmy != null ? nf2.format(r.bmy) + ' %' : '') + '</td><td data-l="Cashflow" style="color:' + ((r[cfK] || 0) < 0 ? ROT : GRUEN) + '">' + eurV(r[cfK]) + '</td>'
          + '<td data-l="DSCR"' + (r.dscr != null && r.dscr < 1 ? ' style="color:' + ROT + '"' : '') + '>' + (r.dscr != null ? nf2.format(r.dscr) : '') + '</td>'
          + '<td data-l="Bindung bis">' + (r.bindEnde ? esc(String(r.bindEnde).split('-').reverse().join('/')) : '') + '</td><td data-l="Score">' + (r.score != null ? Math.round(r.score) : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    /* Prüfung: jede Summe ein zweites Mal auf anderem Weg */
    var L = [], ok = function (b, t, art) { L.push('<li class="' + (b ? '' : (art || 'fehler')) + '">' + esc(t) + '</li>'); };
    var cfB = summe(cfR, function (r) { return r[cfK]; });
    ok(Math.abs(cfB - CF) < 1, 'Die Balken Cashflow je Objekt ergeben die Summe ' + eur(CF) + ' im Jahr');
    ok(Math.abs(proj[0].netto - (W - RS)) < 1, 'Projektion ' + J0 + ' gleich Vermögen netto heute (' + mio(W - RS) + ')');
    var effA = summe(rows, function (r) { return r.cfns; }) - summe(rows, function (r) { return r.cfvs; });
    ok(Math.abs(effA - entl) < 1 || stR.length < rows.length, 'Steuereffekte je Objekt summiert gleich Cashflow nach minus vor Steuer (' + eurV(effA) + ')');
    var bindS = summe(bJ, function (j) { return bj[j]; }), bindR = summe(rows, function (r) { return String(r.bindEnde || '').length >= 4 ? r.rsBind : null; });
    ok(Math.abs(bindS - bindR) < 1, 'Zinsbindungs-Kalender gleich Summe der Restschuld zum Bindungsende (' + mio(bindS) + ')');
    var ohneB = rows.filter(function (r) { return !r.bindEnde; }).length; if (ohneB) ok(false, ohneB + ' Objekt' + (ohneB === 1 ? '' : 'e') + ' ohne Zinsbindung, im Kalender nicht enthalten', 'warn');
    var nH = 0; Object.keys(H).forEach(function (id) { if (rows.some(function (r) { return r.id === id; })) nH += H[id].length; }); if (nH) ok(false, nH + ' Angabe' + (nH === 1 ? '' : 'n') + ' bitte prüfen, siehe Tabelle', 'warn');
    var ohneS = rows.filter(function (r) { return r.score == null; }).length; if (ohneS) ok(false, ohneS + ' Objekt' + (ohneS === 1 ? '' : 'e') + ' ohne Score, als Lücke gezeigt', 'warn');
    var karte = function (id, titel, unter, inhalt, breit) { return '<div class="dp-gn-karte' + (breit ? ' dp-gn-breit' : '') + '" data-gn-k="' + id + '"><div class="dp-gn-k-t">' + esc(titel) + '</div><div class="dp-gn-k-s">' + esc(unter) + '</div>' + inhalt + '</div>'; };
    k.innerHTML = kopf + kz + '<div class="dp-gn-raster">'
      + karte('verm', verdopplung ? 'Das Nettovermögen verdoppelt sich bis ' + verdopplung.jahr : 'Das Nettovermögen wächst bis ' + JE + ' auf ' + mio(proj[proj.length - 1].netto), 'Projektion · Wert, Restschuld und Netto · ' + esc(scope), gV + legende([{ name: 'Wert', farbe: 'color-mix(in srgb,currentColor 30%,transparent)', linie: true }, { name: 'Restschuld', farbe: ROT, linie: true }, { name: 'Netto', farbe: 'var(--gn-gold)', linie: true }]), true)
      + karte('cf', rows.length > 1 ? traeger + ' von ' + cfR.length + ' Objekten bringen Geld, zusammen ' + eurV(CF) + ' im Jahr' : 'Cashflow ' + cfW + ' ' + eurV(CF) + ' im Jahr', 'Cashflow ' + cfW + ' je Objekt in € im Jahr', gC)
      + karte('bind', bJ.length ? 'Größte Anschlussfinanzierung ' + bMax + ' mit ' + mio(bj[bMax]) : 'Zinsbindung', 'Restschuld am Ende der Zinsbindung je Jahr', gB)
      + karte('sc', unter1 ? (unter1 === 1 ? '1 Objekt deckt' : unter1 + ' Objekte decken') + ' die Rate nicht aus der Miete' : 'Die Miete deckt überall die Rate', 'Bruttomietrendite gegen DSCR · Kreisgröße = Kaufpreis', gS)
      + karte('st', (entl >= 0 ? 'Die Steuer entlastet um ' : 'Die Steuer kostet ') + eur(Math.abs(entl)) + ' im Jahr', 'Steuereffekt je Objekt in € im Jahr · AfA zusammen ' + eur(afaS) + ' im Jahr', gT)
      + karte('tab', 'Objekte im Einzelnen', 'Werte heute · Wert ohne Bewertung = Kaufpreis (KP)', tab, true)
      + karte('pr', 'Rechenprüfung', 'Jede Summe auf einem zweiten Weg nachgerechnet', '<ul class="dp-gn-pruef">' + L.join('') + '</ul>', true)
      + '</div>';
    /* Tooltips je Karte */
    var tk = function (id, f) { var c = k.querySelector('[data-gn-k="' + id + '"]'); if (c) { c.style.position = 'relative'; tipBinden(c, f); } };
    tk('verm', function (i) { var p = proj[i]; return p ? '<div class="gn-tip-j">' + p.jahr + '</div>Wert <b>' + mio(p.wert) + '</b><br>Restschuld <b>' + mio(p.rest) + '</b><br>Netto <b>' + mio(p.netto) + '</b>' : ''; });
    tk('cf', function (i) { var r = cfR[i]; return r ? '<div class="gn-tip-j">' + esc(r.name) + '</div>Cashflow ' + cfW + ' <b>' + eurV(r[cfK]) + '</b> im Jahr<br>DSCR <b>' + (r.dscr != null ? nf2.format(r.dscr) : 'keine Angabe') + '</b>' : ''; });
    tk('bind', function (i) { var j = bJ[i]; if (!j) return ''; var obs = rows.filter(function (r) { return String(r.bindEnde || '').slice(0, 4) === j; }); return '<div class="gn-tip-j">' + j + '</div>Restschuld <b>' + mio(bj[j]) + '</b><br>' + obs.map(function (r) { return esc(r.name); }).join('<br>'); });
    tk('sc', function (i) { var r = rows[i]; return r ? '<div class="gn-tip-j">' + esc(r.name) + '</div>Rendite <b>' + (r.bmy != null ? nf2.format(r.bmy) + ' %' : '') + '</b><br>DSCR <b>' + (r.dscr != null ? nf2.format(r.dscr) : '') + '</b><br>Kaufpreis <b>' + eur(r.kp) + '</b>' : ''; });
    tk('st', function (i) { var s = stR[i]; return s ? '<div class="gn-tip-j">' + esc(s.r.name) + '</div>Steuereffekt <b>' + eurV(s.eff) + '</b> im Jahr<br>AfA <b>' + eur(s.r.afa) + '</b>' : ''; });
  }

  /* ── Lauf ──────────────────────────────────────────────────────────── */
  function lauf() {
    if (!AN) return;
    try { pilotAnalyse(); } catch (e) { try { console.warn('[grafiken-neu] Pilot-Analyse', e); } catch (x) {} }
    try { if (window.DpGrafikenPremium) window.DpGrafikenPremium.lauf(HILFEN); } catch (e) { try { console.warn('[grafiken-neu] Premium', e); } catch (x) {} }   /* v4160 */
    try { cockpit(); } catch (e) { try { console.warn('[grafiken-neu] Cockpit', e); } catch (x) {} }
  }
  function spaeter() { if (_timer) clearTimeout(_timer); _timer = setTimeout(lauf, 220); }
  function start() {
    if (AN) return; AN = true; stil();
    document.body.classList.add('dp-gn-an');
    try { new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t && t.closest && t.closest('[data-dp-gn]')) continue; spaeter(); return; }
    }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    window.addEventListener('resize', spaeter);
    document.addEventListener('click', function () { setTimeout(spaeter, 60); }, true);   /* Reiterwechsel: versteckte Karten bekommen Breite */
    spaeter();
  }
  function pruefeFreigabe() {
    try { if (window.DpVorschau) window.DpVorschau.frei('grafiken_neu').then(function (an) { if (an) start(); }); } catch (e) {}
  }
  /* v4160 · Hilfen für grafiken-premium.js (Platz, Zeichnen nur bei Änderung und nur sichtbar, alte Grafik ausblenden) */
  var HILFEN = { platz: platz, zeichnen: zeichnen, weg: weg, jahre: jahre, sigJ: sigJ, karteHtml: karteHtml, legende: legende, tipBinden: tipBinden };
  window.DpGrafikenNeu = { an: function () { return AN; }, _h: HILFEN, neu: function () { document.querySelectorAll('[data-dp-gn]').forEach(function (k) { k.removeAttribute('data-gn-sig'); }); lauf(); },
    _test: { ticks: ticks, saeulen: saeulen, wasserfall: wasserfall, linien: linien, hantel: hantel, balkenH: balkenH, streuung: streuung, projektion: projektion, hinweise: hinweise } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pruefeFreigabe); else pruefeFreigabe();
  window.addEventListener('dp:vorschau', pruefeFreigabe);
  window.addEventListener('dp:plan-ready', function () { setTimeout(pruefeFreigabe, 300); });
})();
