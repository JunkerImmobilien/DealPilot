'use strict';
/* ============================================================================
   v548 · DealPilot-Marktbewertung — QuickCheck (eigenstaendiges Render, QC-Variante)
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
  function injectCss() {
    if ($('dpx-style')) return;
    var css =
      '#' + HOST_ID + '{width:100%;margin-top:14px}' +
      '.dpx{--gold:#C9A84C;--gold2:#E8C766;--gold-deep:#a8761f;--green:#43B77C;--gold-t:#D9B45A;--red:#D9685F;--txt:#ECECEF;--mut:#83838e;--line:rgba(201,168,76,.16);position:relative;border-radius:18px;overflow:hidden;background:radial-gradient(130% 130% at 10% -10%,#0c0c11,#060608 55%,#020203);border:1px solid var(--line);box-shadow:0 30px 70px -34px #000,inset 0 1px 0 rgba(255,255,255,.05);color:var(--txt);font-family:\'Inter\',system-ui,sans-serif}' +
      '.dpx *{box-sizing:border-box}' +
      '.dpx .dpx-cfx{position:absolute;inset:0;z-index:0;pointer-events:none}' +
      '#dp-mb-host .dpx-mg svg,#dp-mb-host .dpx-mg svg *{transform:none !important;rotate:none !important;translate:none !important;scale:none !important;transform-origin:center !important}' +
      '.dpx .dpx-sheen{position:absolute;top:0;left:0;height:1.4px;width:100%;z-index:2;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(232,199,102,.9),transparent);background-size:36% 100%;background-repeat:no-repeat;animation:dpxsweep 5.5s linear infinite}' +
      '@keyframes dpxsweep{0%{background-position:-40% 0}100%{background-position:150% 0}}' +
      '.dpx .dpx-inner{position:relative;z-index:1;padding:16px 22px}' +
      '.dpx .dpx-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}' +
      '.dpx .dpx-logo{font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:18px}.dpx .dpx-logo .d{color:#fff}.dpx .dpx-logo .p{background:linear-gradient(95deg,var(--gold2),var(--gold) 55%,var(--gold-deep));-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.dpx .dpx-eyebrow{font-family:\'Space Grotesk\',sans-serif;font-weight:600;font-size:11px;letter-spacing:.16em;color:var(--gold);text-transform:uppercase}' +
      '.dpx .dpx-rating{font-family:\'Space Grotesk\',sans-serif;font-weight:600;font-size:10.5px;letter-spacing:.04em;padding:3px 10px;border-radius:999px;color:var(--green);border:1px solid rgba(67,183,124,.45);background:rgba(67,183,124,.12)}' +
      '.dpx .dpx-headR{margin-left:auto;display:flex;align-items:center;gap:10px}' +
      '.dpx .dpx-hvals{display:inline-flex;align-items:center;gap:8px;font-family:\'JetBrains Mono\',monospace;font-size:12.5px;color:var(--txt);flex-wrap:wrap}.dpx .dpx-hvals .hl{color:var(--mut);font-family:\'Space Grotesk\',sans-serif;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;margin-right:3px}.dpx .dpx-hvals .hmw{color:var(--gold)}.dpx .dpx-hvals .hs{color:var(--mut);font-size:11px}.dpx .dpx-hvals .hsep{color:var(--mut);margin:0 4px;opacity:.5}' +
      '.dpx .dpx-conf{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:4px 11px}' +
      '.dpx .dpx-conf .cd{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)}.dpx .dpx-conf b{color:var(--txt);font-family:\'JetBrains Mono\',monospace;font-weight:700}' +
      '#dp-mb-host .dpx-chev{width:30px;height:30px;border-radius:9px;border:1px solid var(--gold)!important;background:linear-gradient(var(--gold2),var(--gold))!important;color:#1a1407!important;display:grid;place-items:center;cursor:pointer;transition:.18s;flex:0 0 auto;box-shadow:0 4px 14px -6px rgba(201,168,76,.8)!important}#dp-mb-host .dpx-chev:hover{filter:brightness(1.06)}#dp-mb-host .dpx-chev svg{transition:transform .25s}#dp-mb-host .dpx.collapsed .dpx-chev svg{transform:rotate(180deg)!important}' +
      '.dpx .dpx-sub{display:inline-flex;gap:18px;margin-top:11px;padding:7px 13px;border:1px solid rgba(255,255,255,.05);border-radius:11px;background:rgba(255,255,255,.022)}' +
      '.dpx .dpx-it{font-size:12px;color:var(--mut)}.dpx .dpx-it b{color:var(--txt);font-family:\'JetBrains Mono\',monospace;font-weight:700}.dpx .dpx-up{color:var(--green);font-family:\'JetBrains Mono\',monospace;font-weight:700}' +
      '.dpx .dpx-body{display:flex;gap:18px;margin-top:14px;align-items:stretch}' +
      '.dpx .dpx-gauges{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px}' +
      '.dpx .dpx-b{display:flex;align-items:center;gap:16px;padding:16px 20px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:linear-gradient(150deg,rgba(255,255,255,.028),transparent)}' +
      '.dpx .dpx-mg{flex:0 0 132px}.dpx .dpx-mg svg{width:100%;height:auto;display:block;overflow:visible}' +
      '.dpx .dpx-lab{font-size:10px;letter-spacing:.16em;color:var(--mut);text-transform:uppercase;font-family:\'Space Grotesk\',sans-serif;font-weight:600}' +
      '.dpx .dpx-val{font-family:\'JetBrains Mono\',monospace;font-weight:800;font-size:29px;letter-spacing:-.01em;line-height:1.1;margin-top:3px}' +
      '.dpx .dpx-mw .dpx-val{color:var(--gold);text-shadow:0 0 20px rgba(201,168,76,.45)}.dpx .dpx-mm .dpx-val{color:var(--txt)}' +
      '.dpx .dpx-sqm{font-size:12px;color:var(--mut);font-family:\'JetBrains Mono\',monospace;margin-top:3px}' +
      '.dpx .dpx-spn{font-size:12px;color:#fff;font-family:\'JetBrains Mono\',monospace;font-weight:600;margin-top:6px}.dpx .dpx-spn .l{color:var(--mut);font-family:\'Space Grotesk\',sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-right:5px}.dpx .dpx-spn .sel{color:var(--gold);font-weight:800}.dpx .dpx-spn .sep{color:var(--mut);margin:0 4px}' +
      '.dpx .dpx-rail{flex:0 0 232px;display:flex;flex-direction:column;gap:12px;border-left:1px solid rgba(255,255,255,.07);padding-left:18px}' +
      '#dp-mb-host .dpx-seg{display:inline-flex;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:rgba(0,0,0,.4);margin-top:6px}#dp-mb-host .dpx-seg button{flex:1;font-family:\'Space Grotesk\',sans-serif;font-weight:600;font-size:12.5px;color:var(--mut)!important;background:transparent!important;border:none!important;padding:9px 12px;cursor:pointer;transition:.16s;box-shadow:none!important}#dp-mb-host .dpx-seg button:hover{color:var(--gold2)!important}#dp-mb-host .dpx-seg button.on{background:linear-gradient(var(--gold2),var(--gold-deep))!important;color:#1a1407!important}' +
      '#dp-mb-host .dpx-apply{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;line-height:1;font-family:\'Space Grotesk\',sans-serif;font-weight:600;font-size:12.5px;color:#1a1407!important;background:linear-gradient(var(--gold2),var(--gold))!important;border:none!important;border-radius:12px;padding:11px 12px;cursor:pointer;box-shadow:0 6px 20px -7px rgba(201,168,76,.8);transition:.15s}.dpx .dpx-apply:active{transform:translateY(1px)}.dpx .dpx-apply svg{width:15px;height:15px;flex:0 0 auto}.dpx .dpx-apply span{overflow:hidden;text-overflow:ellipsis}' +
      '.dpx .dpx-foot{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}.dpx .dpx-foot small{font-size:9.5px;color:#5e5e68}.dpx .dpx-foot .mk{font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:12px}.dpx .dpx-foot .mk .d{color:#fff}.dpx .dpx-foot .mk .p{color:var(--gold)}' +
      '.dpx.collapsed .dpx-sub,.dpx.collapsed .dpx-body,.dpx.collapsed .dpx-foot{display:none}' +
      '@media(max-width:780px){.dpx .dpx-body{flex-direction:column}.dpx .dpx-rail{flex:1;border-left:0;border-top:1px solid rgba(255,255,255,.07);padding-left:0;padding-top:14px}}' +
      '@media(max-width:560px){.dpx .dpx-gauges{grid-template-columns:1fr}}';
    var st = document.createElement('style'); st.id = 'dpx-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* ── Tacho ── */
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
  function inputs() { return { plz: vIn('qc_plz'), ort: vIn('qc_ort'), str: vIn('qc_str'), hnr: vIn('qc_hnr'), objektart: vIn('qc_objektart'), wfl: numDe(vIn('qc_wfl')), baujahr: numDe(vIn('qc_baujahr')), kp: numDe(vIn('qc_kp')) }; }

  function mapCard(d) {
    d = d || {};
    var mv = (d.valuation && d.valuation.market_value) || {};
    var rent = d.rent || {};
    var vin = (d.valuation && d.valuation.inputs) || {};
    var area = (d.ref && d.ref.living_area) || numDe(vIn('qc_wfl')) || 0;
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
    return out;
  }

  /* ── Host ── */
  function host() {
    var h = $(HOST_ID); if (h) return h;
    h = document.createElement('div'); h.id = HOST_ID;
    var a = $('avm-results-host');
    if (a && a.parentNode) a.parentNode.insertBefore(h, a.nextSibling); else document.body.appendChild(h);
    return h;
  }

  function spanLabel() { return mode === 'low' ? 'Unten' : mode === 'high' ? 'Oben' : 'Ø'; }
  function frac(o) { return (o[mode] - o.low) / ((o.high - o.low) || 1); }
  function spnHtml(o) {
    function piece(val, k) { return '<span class="' + (mode === k ? 'sel' : '') + '">' + eur(val) + '</span>'; }
    return '<span class="l">Spanne</span>' + piece(o.low, 'low') + '<span class="sep">–</span>' + piece(o.med, 'med') + '<span class="sep">–</span>' + piece(o.high, 'high');
  }

  function render() {
    if (!D) return;
    injectCss();
    var h = host();
    var hasMw = !!D.mw, hasMm = !!D.mm;
    h.innerHTML =
      '<div class="dpx' + (collapsed ? ' collapsed' : '') + '" id="dpx-card"><canvas class="dpx-cfx"></canvas><div class="dpx-sheen"></div><div class="dpx-inner">' +
        '<div class="dpx-head">' +
          '<span class="dpx-logo"><span class="d">Deal</span><span class="p">Pilot</span></span>' +
          '<span class="dpx-eyebrow">Marktbewertung</span>' +
          '<span class="dpx-hvals" id="dpx-hvals"></span>' +
          '<div class="dpx-headR"><span class="dpx-conf"><span class="cd"></span>Aussagekraft: <b>' + D.conf.label + '</b> · <b>' + D.conf.pct + ' %</b></span>' +
            '<button class="dpx-chev" id="dpx-chev" title="Ein-/Ausklappen"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button></div>' +
        '</div>' +
        '<div class="dpx-sub"><div class="dpx-it dpx-rating-it">Bewertung <b>' + D.rating + '</b></div><div class="dpx-it">Mikro <b>' + D.mikro + '</b></div><div class="dpx-it">Makro <b>' + D.makro + '</b></div><div class="dpx-it">Wertentw. <span class="dpx-up">' + D.trend + '</span></div></div>' +
        '<div class="dpx-body"><div class="dpx-gauges">' +
          (hasMw ? '<div class="dpx-b dpx-mw"><div class="dpx-mg" id="dpx-g-mw">' + tachoSvg() + '</div><div><span class="dpx-lab">Marktwert</span><div class="dpx-val" id="dpx-v-mw">–</div><span class="dpx-sqm">' + D.mw.sqm + '</span><div class="dpx-spn" id="dpx-s-mw"></div></div></div>' : '') +
          (hasMm ? '<div class="dpx-b dpx-mm"><div class="dpx-mg" id="dpx-g-mm">' + tachoSvg() + '</div><div><span class="dpx-lab">Marktmiete (kalt)</span><div class="dpx-val" id="dpx-v-mm">–</div><span class="dpx-sqm">' + D.mm.sqm + '</span><div class="dpx-spn" id="dpx-s-mm"></div></div></div>' : '') +
        '</div>' +
        '<div class="dpx-rail"><div><span class="dpx-lab">Spanne</span><div class="dpx-seg" id="dpx-seg">' +
          '<button data-k="low"' + (mode === 'low' ? ' class="on"' : '') + '>Unten</button>' +
          '<button data-k="med"' + (mode === 'med' ? ' class="on"' : '') + '>Ø</button>' +
          '<button data-k="high"' + (mode === 'high' ? ' class="on"' : '') + '>Oben</button></div></div>' +
          '<button class="dpx-apply" id="dpx-apply"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg><span id="dpx-applytxt"></span></button>' +
        '</div></div>' +
        '<div class="dpx-foot"><small>Marktpreisindikation — kein Gutachten n. § 194 BauGB</small><span class="mk"><span class="d">Deal</span><span class="p">Pilot</span></span></div>' +
      '</div></div>';
    gz.mw = $('dpx-g-mw'); gz.mm = $('dpx-g-mm');
    var seg = $('dpx-seg');
    if (seg) seg.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.k; paint(); seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); }); });
    var chev = $('dpx-chev'); if (chev) chev.addEventListener('click', function () { collapsed = !collapsed; $('dpx-card').classList.toggle('collapsed', collapsed); });
    var ap = $('dpx-apply'); if (ap) ap.addEventListener('click', applyToFields);
    var cv = h.querySelector('.dpx-cfx'); if (cv) particles(cv);
    paint();
  }

  function paint() {
    if (D.mw) { countUp($('dpx-v-mw'), D.mw[mode]); setNeedle(gz.mw, frac(D.mw)); var s1 = $('dpx-s-mw'); if (s1) s1.innerHTML = spnHtml(D.mw); }
    if (D.mm) { countUp($('dpx-v-mm'), D.mm[mode]); setNeedle(gz.mm, frac(D.mm)); var s2 = $('dpx-s-mm'); if (s2) s2.innerHTML = spnHtml(D.mm); }
    var hv = $('dpx-hvals');
    if (hv) { var hp = [];
      if (D.mw) hp.push('<span class="hl">MW</span><b class="hmw">' + fmt0(D.mw[mode]) + ' €</b>' + (D.mw.sqm ? ' <span class="hs">' + D.mw.sqm + '</span>' : ''));
      if (D.mm) hp.push('<span class="hl">Miete</span><b>' + fmt0(D.mm[mode]) + ' €</b>');
      hv.innerHTML = hp.join('<span class="hsep">|</span>');
    }
    var t = $('dpx-applytxt'); if (t) t.textContent = 'In Felder übernehmen (' + spanLabel() + ')';
    try { if (global.QcApp && typeof global.QcApp.registerDpmb === 'function') global.QcApp.registerDpmb({
      marktwert: D.mw ? D.mw[mode] : 0, marktmiete: D.mm ? D.mm[mode] : 0,
      micro: D.microRaw, macro: D.macroRaw, trend: D.trendRaw }); } catch (e) {}
  }

  /* ── In Felder übernehmen (wie applyAvm: svwert + ds2_marktmiete €/m²) ── */
  function setInput(id, val) { var el = $(id); if (!el || val == null || val === '') return; el.value = val; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
  function applyToFields() {
    if (!D || !D.mm) { toast('Keine Marktmiete zum Übernehmen'); return; }
    var total = Math.round(D.mm[mode]);
    try {
      if (global.QcApp && typeof global.QcApp.applyAvmNkm === 'function') { global.QcApp.applyAvmNkm(total); }
      else { var el = $('qc_nkm_grund'); if (el) { el.value = String(total); try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} } if (typeof global.mieteAddUp === 'function') global.mieteAddUp(); }
    } catch (e) {}
    toast('✓ Marktmiete übernommen (' + spanLabel() + ')');
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
  async function run() {
    var i = inputs();
    if (!i.plz && !i.ort) { toast('Bitte mindestens PLZ oder Ort ausfüllen'); return; }
    var _dph = await _dpmbHealth();
    if (_dph && _dph.mode === 'stub') { /* v772-dpmb-stub */
      var _p = _dpmbStubPayload(i);
      D = mapCard(_p); mode = 'med'; collapsed = true; /* v782-collapsed-default */
      render();
      try { var _el = $(STATE_ID); if (_el) { _el.value = JSON.stringify({ ts:Date.now(), card:D, mode:mode, collapsed:collapsed }); _el.dispatchEvent(new Event('input',{ bubbles:true })); } } catch (e) {}
      toast('\u2713 DealPilot-Marktbewertung (Demo)');
      return;
    }
    try {
      var res = await fetch('/api/v1/marktbericht/reports/from-dealpilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() },
        body: JSON.stringify({ fast: true, external_ref: null, object: i })
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
      D = mapCard(payload); mode = 'med'; collapsed = true; /* v782-collapsed-default */
      render();
      var _lc = (data._kerosin && typeof data._kerosin.charged === 'number') ? data._kerosin.charged : ((typeof data.cost === 'number') ? data.cost : (data.charged || data.liters || null));
      toast('✓ DealPilot-Marktbewertung' + (_lc ? ' (−' + _lc + ' L)' : ''));
    } catch (e) { toast('⚠ Netzwerkfehler bei der DealPilot-Marktbewertung'); }
  }

  global.DealPilotMBQc = { run: run };
})(window);
