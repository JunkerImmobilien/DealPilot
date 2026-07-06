'use strict';
/* ============================================================================
   v542 · DealPilot-Marktbewertung — Objekt-Tab (eigenstaendiges Render)
   ----------------------------------------------------------------------------
   Freigegebenes Layout: volle Breite, Tachos links (gross), rechte Steuer-Rail
   mit Spanne (Unten/Ø/Oben) + "In Felder übernehmen", Spanne in Zahlen (weiss)
   unter jedem Tacho, einklappbar per Chevron (wie PriceHubble/Sprengnetter).
   Eigenes gescoptes CSS (Praefix dpx-) -> keine Kollision; schmale Basis-Karte
   (marktbewertung-card) bleibt fuer QC/Modul unberuehrt.
   Abruf: v539-Proxy /reports/from-dealpilot (fast=2 L). Snapshot -> #_mb_state
   (JSONB) fuer Pilot-Analyse + Restore.
   Übernehmen: Marktwert->#svwert (Verkehrswert), Marktmiete €/m²->#ds2_marktmiete
   (wie applyAvm; #nkm wird NICHT angefasst).
   ============================================================================ */
(function (global) {
  var HOST_ID = 'dp-mb-host';
  var STATE_ID = '_mb_state';
  var GC = { cx: 52, cy: 50, r: 39 };
  var GID = 0;
  var D = null;          // gemappte Kartendaten
  var mode = 'med';      // low | med | high
  var collapsed = false;
  var lastJson = '';
  var gz = {};           // gauge hosts

  /* ── Helfer ── */
  function tok() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function $(id) { return document.getElementById(id); }
  function vIn(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function numDe(x) { if (x == null || x === '') return null; var n = parseFloat(String(x).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(n) ? null : n; }
  function fmt0(n) { try { return new Intl.NumberFormat('de-DE').format(Math.round(n)); } catch (e) { return String(Math.round(n)); } }
  function deNum(n, d) { try { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n); } catch (e) { return String(n); } }
  function eur(n) { return fmt0(n) + ' €'; }
  function toast(m) { try { if (typeof global.toast === 'function') return global.toast(m); } catch (e) {} try { console.log('[dp-mb]', m); } catch (e) {} }

  /* ── CSS einmalig injizieren (Praefix dpx-) ── */
  function injectCss() { /* v751-light */
    if ($('dpx-style')) return;
    var css =
      '#' + HOST_ID + '{width:100%;margin-top:14px}' +
      '.dpx{display:flex;flex-direction:column;border:1px solid #ece2c8;border-left:5px solid #0c0b09;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 6px 20px -13px rgba(110,82,18,.45);font-family:"Inter",system-ui,sans-serif}' +
      '.dpx *{box-sizing:border-box}' +
      /*v877-no-hatch*/'.dpx .dpx-head{position:relative;display:flex;align-items:center;gap:9px;height:46px;padding:0 14px;overflow:hidden;background:linear-gradient(110deg,#E8CC7A,#C9A84C 58%,#b8932f)}' +
      '.dpx .dpx-head::after{content:"";position:absolute;inset:0;background:linear-gradient(157deg,rgba(255,255,255,.5),rgba(255,255,255,0) 46%)}' +
      '.dpx .dpx-head>*{position:relative;z-index:1}' +
      '.dpx .dpx-logo{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:15px}.dpx .dpx-logo .d{color:#0c0b09}.dpx .dpx-logo .p{color:#0c0b09}' +
      '.dpx .dpx-eyebrow{font:800 10px/1 "Space Grotesk",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#5c4a18}' +
      '.dpx .dpx-conf{margin-left:auto;font:700 10px/1 "JetBrains Mono",monospace;color:#E8CC7A;background:#0c0b09;border-radius:999px;padding:4px 10px;white-space:nowrap}' +
      '#' + HOST_ID + ' .dpx-chev{width:26px;height:26px;border:1px solid rgba(12,11,9,.3)!important;border-radius:7px;background:rgba(12,11,9,.08)!important;color:#0c0b09!important;display:grid;place-items:center;cursor:pointer;flex:0 0 auto}#' + HOST_ID + ' .dpx-chev svg{transition:transform .25s}#' + HOST_ID + ' .dpx.collapsed .dpx-chev svg{transform:rotate(180deg)!important}' +
      '.dpx .dpx-perf{position:relative;height:0;border-top:1.5px dashed rgba(201,168,76,.55);margin:0 12px}' +
      '.dpx .dpx-body{display:flex;flex-direction:column;padding:12px 14px 0}' +
      '.dpx .dpx-vals{display:flex;gap:14px}' +
      '.dpx .dpx-vb{flex:1;min-width:0}' +
      '.dpx .dpx-lab{font:700 7px/1 "Space Grotesk",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a59c86}' +
      '.dpx .dpx-val{font-family:"Cormorant Garamond",Georgia,serif;font-size:24px;font-weight:700;line-height:1;margin-top:4px;color:#2A2727}' +
      '.dpx .dpx-mw .dpx-val{background:linear-gradient(110deg,#b8932f,#C9A84C 55%,#9a7f33);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.dpx .dpx-sqm{font:9.5px/1.3 "JetBrains Mono",monospace;color:#7A7370;margin-top:4px;min-height:13px;display:block}' +
      '.dpx .dpx-spn{font:10px/1.3 "JetBrains Mono",monospace;color:#7A7370;margin-top:5px}.dpx .dpx-spn .l{font:700 7px/1 "Space Grotesk",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#a59c86;margin-right:5px}.dpx .dpx-spn .sel{color:#9a7f33;font-weight:800}.dpx .dpx-spn .sep{margin:0 4px;opacity:.5}' +
      '.dpx .dpx-f3{display:flex;gap:7px;margin-top:11px}' +
      '.dpx .dpx-fi{flex:1;border:1px solid #efe7d2;border-radius:9px;padding:6px 8px;min-width:0;background:#fffdf8}' +
      '.dpx .dpx-fi .k{font:700 6.5px/1 "Space Grotesk",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#a59c86}' +
      '.dpx .dpx-fi .v{font:700 11px/1.25 "JetBrains Mono",monospace;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2A2727}' +
      '.dpx .dpx-lage{margin-top:11px;min-height:26px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
      '.dpx .dpx-lchip{font:700 9.5px/1 "JetBrains Mono",monospace;padding:4px 9px;border-radius:999px;background:rgba(201,168,76,.14);color:#9a7f33}' +
      '.dpx .dpx-spanrow{display:flex;align-items:center;gap:8px;margin-top:12px}' +
      '.dpx .dpx-spanlbl{font:600 11px/1 "DM Sans",sans-serif;color:#6b6660}' +
      '#' + HOST_ID + ' .dpx-seg{display:inline-flex;border:1px solid rgba(201,168,76,.4);border-radius:11px;overflow:hidden;background:rgba(248,246,241,.7)}#' + HOST_ID + ' .dpx-seg button{appearance:none;border:0;background:transparent;padding:7px 13px;font:600 12.5px/1 "DM Sans",sans-serif;color:#6b6660!important;cursor:pointer}#' + HOST_ID + ' .dpx-seg button+button{border-left:1px solid rgba(201,168,76,.25)}#' + HOST_ID + ' .dpx-seg button.on{background:linear-gradient(180deg,#d4b65a,#bd9c3f)!important;color:#fff!important}' +
      '.dpx .dpx-foot{display:flex;align-items:center;gap:10px;padding:12px 14px 6px}' +
      '#' + HOST_ID + ' .dpx-apply{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none!important;border-radius:11px;padding:9px 14px;font:700 12px/1 "DM Sans",sans-serif;color:#2c2410!important;cursor:pointer;background:linear-gradient(110deg,#E8CC7A,#C9A84C 60%,#b8932f)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 4px 13px -7px rgba(160,120,20,.55)}.dpx .dpx-apply svg{width:14px;height:14px;flex:0 0 auto}' +
      '.dpx .dpx-legal{padding:7px 14px 12px;font:9px/1.3 "JetBrains Mono",monospace;color:#b3ab98;text-align:center}' +
      '.dpx.collapsed .dpx-perf,.dpx.collapsed .dpx-body,.dpx.collapsed .dpx-foot,.dpx.collapsed .dpx-legal{display:none}';
    var st = document.createElement('style'); st.id = 'dpx-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* Tacho-Helfer unten bleiben definiert (im hellen Layout ungenutzt) */
  function pt(cx, cy, r, d) { var a = d * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  function arc(cx, cy, r, d1, d2) { var p1 = pt(cx, cy, r, d1), p2 = pt(cx, cy, r, d2); return 'M ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A ' + r + ' ' + r + ' 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); }
  function tachoSvg() {
    var cx = GC.cx, cy = GC.cy, r = GC.r, fid = 'dpxf' + (GID++);
    return '<svg viewBox="0 0 104 60"><defs><filter id="' + fid + '" filterUnits="userSpaceOnUse" x="-4" y="-4" width="112" height="68"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<path d="' + arc(cx, cy, r, 180, 124) + '" stroke="#D9685F" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<path d="' + arc(cx, cy, r, 118, 62) + '" stroke="#D9B45A" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<path d="' + arc(cx, cy, r, 56, 0) + '" stroke="#43B77C" stroke-width="6.5" fill="none" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<line class="ndl" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - (r - 4)) + '" stroke="#fff" stroke-width="2.8" stroke-linecap="round" filter="url(#' + fid + ')"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#C9A84C" stroke="#040405" stroke-width="2"/><circle cx="' + cx + '" cy="' + cy + '" r="1.9" fill="#fff"/></svg>';
  }
  function setNeedle(h, frac) { if (!h) return; var ln = h.querySelector('.ndl'); if (!ln) return; var p = pt(GC.cx, GC.cy, GC.r - 4, 172 - Math.max(0, Math.min(1, frac)) * 164); ln.setAttribute('x2', p[0].toFixed(2)); ln.setAttribute('y2', p[1].toFixed(2)); }
  function countUp(el, to) { if (!el) return; var from = el._cur || 0, t0 = performance.now(); (function s(t) { var p = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - p, 3); el.textContent = eur(from + (to - from) * e); if (p < 1) requestAnimationFrame(s); else el._cur = to; })(performance.now()); }

  /* ── beweglicher Partikel-Hintergrund (aus Original-Karte portiert) ── */
  function particles(canvas) {
    if (!canvas || canvas._dpxOn) return; canvas._dpxOn = true;
    var x = canvas.getContext('2d'); var w, h, ps; var DP = Math.min(2, global.devicePixelRatio || 1);
    function size() { var r = canvas.getBoundingClientRect(); /* v635-canvas-guard: plausibilitaetspruefung gegen 67M-Canvas (Infinity/NaN/Riesenwerte) */ if (!r.width || !r.height || !isFinite(r.width) || !isFinite(r.height) || r.width > 4000 || r.height > 4000) return; w = r.width; h = r.height; canvas.width = Math.max(1, Math.min(4000, Math.round(w * DP))); canvas.height = Math.max(1, Math.min(4000, Math.round(h * DP))); x.setTransform(DP, 0, 0, DP, 0, 0);
      var n = Math.max(12, Math.min(34, Math.floor(w * h / 9000))); ps = Array.from({ length: n }, function () { return { x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .15, vy: (Math.random() - .5) * .15, r: Math.random() * 1.3 + .4, o: Math.random() * .5 + .16, g: Math.random() > .45 }; }); }
    function loop() {
      if (!canvas.isConnected) { canvas._dpxOn = false; return; } // gestoppt, wenn Karte ersetzt
      if (w) { x.clearRect(0, 0, w, h);
        for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) { var a = ps[i], b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy); if (d < 76) { x.strokeStyle = 'rgba(201,168,76,' + ((1 - d / 76) * .12) + ')'; x.lineWidth = .55; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
        for (var k = 0; k < ps.length; k++) { var p = ps[k]; p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fillStyle = p.g ? 'rgba(232,199,102,' + p.o + ')' : 'rgba(205,205,215,' + (p.o * .45) + ')'; x.fill(); } }
      requestAnimationFrame(loop);
    }
    if ('ResizeObserver' in global) new ResizeObserver(size).observe(canvas); else global.addEventListener('resize', size);
    size(); loop();
  }

  /* ── Daten ── */
  function objId() {
    var c = [global.currentObjectId, global._currentObjectId, global.currentObjId, (global.State && (global.State.objectId || global.State.id))];
    for (var i = 0; i < c.length; i++) if (c[i]) return String(c[i]);
    var el = $('obj-id') || $('object-id'); if (el && el.value) return String(el.value);
    return null;
  }
  function inputs() { return { plz: vIn('plz'), ort: vIn('ort'), str: vIn('str'), hnr: vIn('hnr'), objektart: vIn('objart'), wfl: numDe(vIn('wfl')), baujahr: numDe(vIn('baujahr')), kp: numDe(vIn('kp')) }; }

  function mapCard(d) {
    d = d || {};
    var mv = (d.valuation && d.valuation.market_value) || {};
    var rent = d.rent || {};
    var vin = (d.valuation && d.valuation.inputs) || {};
    var area = (d.ref && d.ref.living_area) || numDe(vIn('wfl')) || 0;
    var out = { area: area };
    out.rating = (d.deal_score && d.deal_score.rating) ? d.deal_score.rating : 'Indikation';
    out.conf = { label: mv.confidence_label || 'Indikation', pct: mv.confidence_pct != null ? mv.confidence_pct : 0 };
    /* v746-mikro-label: Label (wie Pilot) + Score auf 0-10-Skala statt Rohwert 0-100 */
    function _v746lbl(raw) {
      if (raw == null) return '–';
      var s = raw / 10;
      var w = s >= 8 ? 'Sehr gut' : s >= 6 ? 'Gut' : s >= 4 ? 'Durchschnittlich' : s >= 2 ? 'Schwach' : 'Sehr schwach';
      return w + ' · ' + s.toFixed(1).replace('.', ',');
    }
    out.mikro = (d.micro && d.micro.score != null) ? _v746lbl(d.micro.score) : '–';
    out.makro = (d.macro && d.macro.score != null) ? _v746lbl(d.macro.score) : '–';
    out.microRaw = (d.micro && d.micro.score != null) ? d.micro.score : null;
    out.macroRaw = (d.macro && d.macro.score != null) ? d.macro.score : null;
    out.trendRaw = (d.price_trend_pct != null) ? d.price_trend_pct : null;
    out.trend = (d.price_trend_pct != null) ? ((d.price_trend_pct >= 0 ? '+' : '') + deNum(d.price_trend_pct, 1) + '%/J') : '–';
    if (mv.estimated != null) {
      out.mw = { low: mv.low != null ? mv.low : Math.round(mv.estimated * 0.9), med: mv.estimated, high: mv.high != null ? mv.high : Math.round(mv.estimated * 1.1), sqm: (mv.basis_median_sqm != null) ? (deNum(mv.basis_median_sqm, 0) + ' €/m²') : '' };
    }
    var rsqm = rent.median_per_sqm != null ? rent.median_per_sqm : (vin.market_rent_sqm != null ? vin.market_rent_sqm : null);
    if (rsqm != null && area) {
      var lo = rent.q25_per_sqm != null ? rent.q25_per_sqm : rsqm * 0.9;
      var hi = rent.q75_per_sqm != null ? rent.q75_per_sqm : rsqm * 1.1;
      out.mm = { low: Math.round(lo * area), med: Math.round(rsqm * area), high: Math.round(hi * area), sqm: deNum(rsqm, 2) + ' €/m² kalt' };
    }
    /* v783-compare: Vergleichsobjekte aus sale.comparables (Feldnamen an avm-section angleichen) */
    try {
      var _cmp = (d.sale && Array.isArray(d.sale.comparables)) ? d.sale.comparables : null;
      if (_cmp && _cmp.length) {
        out.compare = _cmp.slice(0, 10).map(function (c) {
          return {
            distance: (c.distance_m != null) ? c.distance_m : null,
            livingArea: (c.living_area != null) ? c.living_area : null,
            constructionYear: (c.build_year != null) ? c.build_year : null,
            value: (c.price != null) ? c.price : null,
            ppsm: (c.price_per_sqm != null) ? c.price_per_sqm : null,
            similarity: null
          };
        });
      }
    } catch (e) {}
    return out;
  }

  /* ── Host ── */
  function host() {
    var h = $(HOST_ID); if (h) return h;
    h = document.createElement('div'); h.id = HOST_ID;
    var a = $('oab-results') || $('obj-action-bar');
    if (a && a.parentNode) a.parentNode.insertBefore(h, a); else document.body.appendChild(h);
    return h;
  }

  function spanLabel() { return mode === 'low' ? 'Unten' : mode === 'high' ? 'Oben' : 'Ø'; }
  function frac(o) { return (o[mode] - o.low) / ((o.high - o.low) || 1); }
  function spnHtml(o) {
    function piece(val, k) { return '<span class="' + (mode === k ? 'sel' : '') + '">' + eur(val) + '</span>'; }
    return '<span class="l">Spanne</span>' + piece(o.low, 'low') + '<span class="sep">–</span>' + piece(o.med, 'med') + '<span class="sep">–</span>' + piece(o.high, 'high');
  }

  function render() { /* v752-bridge */
    if (!D) return;
    persistLight();
    /* Section-Renderer (avm-section.js) uebernimmt die Darstellung; eigener Host bleibt leer. */
    if (global.AvmSection && typeof global.AvmSection.setDealpilot === 'function') {
      try { var h0 = $(HOST_ID); if (h0) h0.innerHTML = ''; } catch (e) {}
      global.AvmSection.setDealpilot(D, mode, {
        apply: applyToFields,
        setMode: function (m) { mode = (m === 'mid') ? 'med' : m; persistLight(); },
        report: function () { try { run(); } catch (e) {} }
      });
      return;
    }
    _renderLegacy();
  }

  function _renderLegacy() { /* v751-light Fallback, falls AvmSection fehlt */
    if (!D) return;
    injectCss();
    var h = host();
    var hasMw = !!D.mw, hasMm = !!D.mm;
    h.innerHTML =
      '<div class="dpx' + (collapsed ? ' collapsed' : '') + '" id="dpx-card">' +
        '<div class="dpx-head"><span class="dpx-logo"><span class="d">Deal</span><span class="p">Pilot</span></span>' +
          '<span class="dpx-eyebrow">Marktbewertung</span>' +
          '<span class="dpx-conf">Aussagekraft: ' + ((D.conf && D.conf.label) || '\u2013') + '</span></div>' +
        '<div class="dpx-body"><div class="dpx-vals">' +
          (hasMw ? '<div class="dpx-vb dpx-mw"><span class="dpx-lab">Marktwert</span><div class="dpx-val" id="dpx-v-mw">\u2013</div></div>' : '') +
          (hasMm ? '<div class="dpx-vb dpx-mm"><span class="dpx-lab">Marktmiete (kalt)</span><div class="dpx-val" id="dpx-v-mm">\u2013</div></div>' : '') +
        '</div><div class="dpx-spanrow"><div class="dpx-seg" id="dpx-seg">' +
          '<button data-k="low"' + (mode === 'low' ? ' class="on"' : '') + '>Unten</button>' +
          '<button data-k="med"' + (mode === 'med' ? ' class="on"' : '') + '>\u00d8</button>' +
          '<button data-k="high"' + (mode === 'high' ? ' class="on"' : '') + '>Oben</button></div></div>' +
          '<button class="dpx-apply" id="dpx-apply"><span id="dpx-applytxt"></span></button>' +
        '</div></div>';
    var seg = $('dpx-seg');
    if (seg) seg.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.k; persistLight(); paint(); }); });
    var ap = $('dpx-apply'); if (ap) ap.addEventListener('click', applyToFields);
    paint();
  }

  function paint() {

    if (!D) return;
    if (D.mw) { var e1 = $('dpx-v-mw'); if (e1) e1.textContent = eur(D.mw[mode]); var s1 = $('dpx-s-mw'); if (s1) s1.innerHTML = spnHtml(D.mw); }
    if (D.mm) { var e2 = $('dpx-v-mm'); if (e2) e2.textContent = eur(D.mm[mode]); var s2 = $('dpx-s-mm'); if (s2) s2.innerHTML = spnHtml(D.mm); }
    var hv = $('dpx-hvals');
    if (hv) {
      var hp = [];
      if (D.mw) hp.push('MW ' + fmt0(D.mw[mode]) + ' \u20ac');
      if (D.mm) hp.push('Miete ' + fmt0(D.mm[mode]) + ' \u20ac');
      hv.innerHTML = hp.join(' \u00b7 ');
    }
    var t = $('dpx-applytxt'); if (t) t.textContent = 'In Felder \u00fcbernehmen (' + spanLabel() + ')';
  }

  /* \u2500\u2500 In Felder \u00fcbernehmen (wie applyAvm: svwert + ds2_marktmiete \u20ac/m\u00b2) \u2500\u2500 */
  function setInput(id, val) { var el = $(id); if (!el || val == null || val === '') return; el.value = val; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
  function setSel(id, v) { var el = $(id); if (!el || !v) return; el.value = v; try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
  function applyToFields() {
    if (!D) return; var applied = [];
    if (D.mw) { setInput('svwert', fmt0(D.mw[mode])); applied.push('Verkehrswert'); }
    if (D.mm) {
      var area = D.area || numDe(vIn('wfl')) || 0;
      var sqm = area ? (D.mm[mode] / area) : null;
      if (sqm) { setInput('ds2_marktmiete', sqm.toFixed(2).replace('.', ',')); applied.push('Marktmiete €/m²'); }
    }
    var lc = function (sc) { return sc >= 8 ? 'sehr_gut' : sc >= 6 ? 'gut' : sc >= 4 ? 'durchschnittlich' : sc >= 2 ? 'schwach' : 'sehr_schwach'; };
    var wc = function (p) { return p >= 3 ? 'sehr_hoch' : p >= 2 ? 'hoch' : p >= 1 ? 'mittel' : p > 0 ? 'niedrig' : 'keines'; };
    if (D.macroRaw != null) { setSel('makrolage', lc(D.macroRaw / 10)); applied.push('Makrolage'); }
    if (D.microRaw != null) { setSel('mikrolage', lc(D.microRaw / 10)); applied.push('Mikrolage'); }
    if (D.trendRaw != null) { var _w = wc(D.trendRaw); if (_w) { setSel('ds2_wertsteigerung', _w); applied.push('Wertsteigerung'); } }
    try { if (typeof global.calc === 'function') global.calc(); } catch (e) {}
    try { if (typeof global.renderDealScore2 === 'function') global.renderDealScore2(); } catch (e) {}
    toast('✓ ' + (applied.join(' + ') || 'Werte') + ' übernommen (' + spanLabel() + ')');
  }

  /* ── Persistenz (#_mb_state -> JSONB) ── */
  function snapshot(extra) {
    return Object.assign({ ts: Date.now(), card: D, mode: mode, collapsed: collapsed }, extra || {});
  }
  function persistLight() { // nur Zustand (mode/collapsed) ohne neuen Abruf
    var el = $(STATE_ID); if (!el || !el.value) return;
    try { var s = JSON.parse(el.value); s.mode = mode; s.collapsed = collapsed; el.value = JSON.stringify(s); lastJson = el.value; el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function persistFull(extra) {
    var el = $(STATE_ID); if (!el) return;
    try { el.value = JSON.stringify(snapshot(extra)); lastJson = el.value; el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function restore() {
    var el = $(STATE_ID);
    if (!el || !el.value) { var h = $(HOST_ID); if (h) h.innerHTML = ''; D = null; return; }
    if (el.value === lastJson) return;
    lastJson = el.value;
    var s = null; try { s = JSON.parse(el.value); } catch (e) { return; }
    if (!s || !s.card) return;
    var c = s.card;
    if (!c.mw && !c.mm && (c.marktwert || c.miete)) { // v540/v541-Snapshot -> v542-Form migrieren
      c = { rating: c.rating || 'Indikation', conf: c.confidence || { label: '–', pct: 0 },
            mikro: (c.meta && c.meta.mikro) || '–', makro: (c.meta && c.meta.makro) || '–', trend: (c.meta && c.meta.trend) || '–',
            mw: c.marktwert || null, mm: c.miete || null, area: numDe(vIn('wfl')) || 0 };
    }
    D = c; mode = s.mode || 'med'; collapsed = true; /* v564-collapsed-default */ render();
  }

  /* v772-dpmb-stub: DealPilot-Marktbewertung Demo bei AVM_MODE=stub (kein Microservice/Kerosin). */
  var _dpmbHC=null,_dpmbHT=0;
  function _dpmbHealth(){ return new Promise(function(resolve){
    var now=Date.now();
    if(_dpmbHC!==null && (now-_dpmbHT)<60000){ resolve(_dpmbHC); return; }
    fetch('/api/v1/avm/health',{headers:{'Authorization':'Bearer '+tok()}}).then(function(r){return r.json();})
      .then(function(h){ _dpmbHC=h||{}; _dpmbHT=Date.now(); resolve(_dpmbHC); })
      .catch(function(){ _dpmbHC={}; _dpmbHT=Date.now(); resolve(_dpmbHC); });
  }); }
  function _dpmbStubPayload(i){
    var wfl=(i&&i.wfl)||70, sqm=2600, est=Math.round(wfl*sqm), rsqm=9.2;
    return { valuation:{ market_value:{ estimated:est, low:Math.round(est*0.9), high:Math.round(est*1.1), confidence_label:'Gut', confidence_pct:78, basis_median_sqm:sqm } },
      rent:{ median_per_sqm:rsqm, q25_per_sqm:rsqm*0.9, q75_per_sqm:rsqm*1.1 },
      micro:{ score:72 }, macro:{ score:65 }, price_trend_pct:2.4,
      deal_score:{ rating:'Solide' }, ref:{ living_area:wfl } };
  }
  function _mbSpinner(on) { /* v782-spinner */
    var ID='dp-mb-spin';
    if (on) {
      if (document.getElementById(ID)) return;
      if (!document.getElementById('dp-mb-spin-css')) {
        var st=document.createElement('style'); st.id='dp-mb-spin-css';
        st.textContent='#'+ID+'{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(12,11,9,.45)}'+
          '#'+ID+' .b{background:#fff;border-radius:14px;padding:22px 26px;display:flex;flex-direction:column;align-items:center;gap:13px;box-shadow:0 20px 60px -16px rgba(0,0,0,.5)}'+
          '#'+ID+' .sp{width:34px;height:34px;border:3px solid rgba(201,168,76,.25);border-top-color:#C9A84C;border-radius:50%;animation:dpmbspin .8s linear infinite}'+
          '#'+ID+' .t{font:600 13.5px/1.4 "DM Sans",sans-serif;color:#1b1815}@keyframes dpmbspin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }
      var o=document.createElement('div'); o.id=ID;
      o.innerHTML='<div class="b"><div class="sp"></div><div class="t">Marktdaten werden geladen …</div></div>';
      document.body.appendChild(o);
    } else { var e=document.getElementById(ID); if (e&&e.parentNode) e.parentNode.removeChild(e); }
  }
  async function run() {
    var i = inputs();
    if (!i.plz && !i.ort) { toast('Bitte mindestens PLZ oder Ort ausfüllen'); return; }
    var _dph = await _dpmbHealth();
    if (_dph && _dph.mode === 'stub') { /* v772-dpmb-stub */
      var _p = _dpmbStubPayload(i);
      D = mapCard(_p); mode = 'med'; collapsed = false; /* v830-mb-expanded: nach Abruf offen */
      render();
      persistFull({ object_key:null, cost:0, market_value:_p.valuation.market_value, micro:_p.micro.score, macro:_p.macro.score, price_trend_pct:_p.price_trend_pct });
      toast('\u2713 DealPilot-Marktbewertung (Demo)');
      return;
    }
    var ref = objId();
    _mbSpinner(true);
    try {
      var res = await fetch('/api/v1/marktbericht/reports/from-dealpilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() },
        body: JSON.stringify({ fast: true, external_ref: ref, object: i })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        if (data && data.needs_credits) toast('⚠ Nicht genug Kerosin (' + (data.required || '?') + ' L nötig)');
        else toast('⚠ DealPilot-Marktbewertung fehlgeschlagen' + (data && (data.error || data.message) ? ': ' + (data.error || data.message) : ''));
        return;
      }
      if (data && data.no_data) {
        toast('⚠ Für diese Adresse liegen aktuell keine Marktdaten vor (kein Kerosin berechnet)');
        return;
      }
      var payload = data.data || data;
      D = mapCard(payload); mode = 'med'; collapsed = false; /* v830-mb-expanded: nach Abruf offen */
      render();
      persistFull({
        object_key: data.object_key || null, cost: (typeof data.cost === 'number' ? data.cost : (data.charged || data.liters || 0)),
        market_value: (payload.valuation && payload.valuation.market_value) || null,
        micro: payload.micro ? payload.micro.score : null,
        macro: payload.macro ? payload.macro.score : null,
        price_trend_pct: payload.price_trend_pct != null ? payload.price_trend_pct : null
      });
      var _lc = (data._kerosin && typeof data._kerosin.charged === 'number') ? data._kerosin.charged : ((typeof data.cost === 'number') ? data.cost : (data.charged || data.liters || null));
      toast('✓ DealPilot-Marktbewertung' + (_lc ? ' (−' + _lc + ' L)' : ''));
      try { if (global.AiCredits && typeof global.AiCredits.refreshAvm === 'function') setTimeout(global.AiCredits.refreshAvm, 400); } catch (e) {}
    } catch (e) { toast('⚠ Netzwerkfehler bei der DealPilot-Marktbewertung'); }
    finally { _mbSpinner(false); }
  }

  function watch() {
    var el = $(STATE_ID);
    if (el) { el.addEventListener('input', restore); el.addEventListener('change', restore); }
    setInterval(restore, 1200);
    restore();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  global.DealPilotMB = { run: run, restore: restore, /* v752-api */
    getData: function () { return (D && D.mw) ? { D: D, mode: mode } : null; },
    setMode: function (m) { mode = (m === 'mid') ? 'med' : m; try { persistLight(); } catch (e) {} },
    apply: applyToFields };
})(window);
