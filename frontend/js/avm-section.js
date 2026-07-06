/* avm-section.js · v752 · Alleiniger Renderer der AVM-Ergebnis-Sektion (Objekt-Tab).
 * Konsens-Band + shared Spanne + Karten/Tabelle-Umschalter + Minimieren + 3 Karten.
 * DealPilot zuerst, dann Sprengnetter, dann PriceHubble.
 * Daten:
 *   - Externe (PriceHubble/Sprengnetter): window._oabAvm (von object-actions, via setExternal)
 *   - DealPilot: window.DealPilotMB-Bridge (via setDealpilot)
 * Schreibt NICHTS direkt in die Felder — nutzt object-actions-Bruecken:
 *   window._oabSetSpan(span) · window._oabApplyExternal(name) · window._oabApplyConsensus(mw,mm)
 * und fuer DealPilot die uebergebene api.apply()/api.setMode().
 * Marker: v752-avsec
 */
(function (global) {
  'use strict';
  var HOST = 'oab-results';
  var _ext = {};                 // { PriceHubble:{...}, Sprengnetter:{...} }
  var _dp = null;                // { D, mode, api }
  var st = { span: 'mid', view: 'cards', min: false };

  function $(id) { return document.getElementById(id); }
  function nd(v) {
    if (v == null) return 0;
    var s = String(v).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  function KP() { var e = $('kp'); return e ? nd(e.value) : 0; }
  function WFL() { var e = $('wfl'); return e ? nd(e.value) : 0; }
  function fmt(n) { return Math.round(n).toLocaleString('de-DE'); }
  function dec(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function spanLbl(b) { return b === 'low' ? 'Unten' : b === 'high' ? 'Oben' : '\u00d8'; }

  function lageLbl(s) { return s == null ? '\u2014' : s >= 70 ? 'Sehr gut' : s >= 55 ? 'Gut' : s >= 40 ? 'Durchschn.' : s >= 25 ? 'Schwach' : 'Sehr schwach'; }
  function lageCol(s) { return s == null ? '#bdb6a6' : s >= 55 ? '#3FA56C' : s >= 40 ? '#C9A84C' : '#B8625C'; }
  function lchip(lbl, s) {
    var c = lageCol(s);
    return '<span class="lchip" style="color:' + c + ';background:' + c + '1f;border:1px solid ' + c + '55">' + lbl + ' \u00b7 ' + s + '</span>';
  }
  /* Preis-Einordnung (KP vs Marktwert) */
  function priceClass(mw) {
    var kp = KP();
    if (!kp || !mw) return ['\u2013', '#7A7370'];
    var d = (mw - kp) / kp * 100;
    if (d <= -10) return ['Deutlich unter Markt', '#2f8f57'];
    if (d <= -3) return ['Unter Markt', '#2f8f57'];
    if (d < 3) return ['Marktgerecht', '#9a7f33'];
    if (d <= 10) return ['Leicht \u00fcber Markt', '#c08a2f'];
    return ['Deutlich \u00fcber Markt', '#c0564f'];
  }
  function diffPct(mw) { var kp = KP(); return (kp && mw) ? ((mw - kp) / kp * 100) : null; }

  /* ── Adapter: einheitliches Provider-Objekt ── */
  function uExternal(name, r) {
    var isPh = (name === 'PriceHubble');
    var mwMid = r.marktwert, mwLow = r.low != null ? r.low : r.marktwert, mwHigh = r.high != null ? r.high : r.marktwert;
    var mmMid = (r.marktmieteCold != null ? r.marktmieteCold : null);
    var mmLow = r.marktmieteLow != null ? r.marktmieteLow : mmMid, mmHigh = r.marktmieteHigh != null ? r.marktmieteHigh : mmMid;
    /* Genauigkeit */
    var accLabel, accCol;
    if (name === 'Sprengnetter' && r.standardError != null) {
      var se = r.standardError;
      accLabel = (se < 0.15 ? 'Hoch' : se <= 0.30 ? 'Mittel' : 'Niedrig') + ' \u00b7 ' + se.toFixed(2).replace('.', ',');
      accCol = se < 0.15 ? '#3FA56C' : se <= 0.30 ? '#9a7f33' : '#B8625C';
    } else {
      var ct = String(r.conf || '').toLowerCase();
      accLabel = (r.conf && !/sprengnetter avm/i.test(r.conf)) ? r.conf : (r.conf ? 'AVM' : '\u2013');
      accCol = /hoch|gut|sehr/.test(ct) ? '#3FA56C' : /mittel/.test(ct) ? '#9a7f33' : '#7A7370';
    }
    var bewertung = (name === 'Sprengnetter' && r.score != null) ? (Math.round(r.score) + ' / 100') : '\u2013';
    return {
      key: isPh ? 'ph' : 'sp', name: name, isDP: false,
      brand: isPh ? '#1F3A6E' : '#0F73B8',
      logo: isPh ? 'img/pricehubble.jpg' : 'img/sprengnetter.jpg',
      label: 'Marktbewertung',
      mw: { low: mwLow, mid: mwMid, high: mwHigh },
      mm: { low: mmLow, mid: mmMid, high: mmHigh },
      eurSqm: r.eurPerSqm || null, mmEurSqm: r.marktmieteEurSqm || null,
      accLabel: accLabel, accCol: accCol, bewertung: bewertung,
      accTier: (name === 'Sprengnetter' && r.standardError != null) ? (r.standardError < 0.15 ? 'hoch' : r.standardError <= 0.30 ? 'mittel' : 'niedrig') : tierFromLabel(r.conf),
      microRaw: (r.scoreMicro != null ? r.scoreMicro : null),
      macroRaw: (r.scoreMacro != null ? r.scoreMacro : null),
      compare: (Array.isArray(r.comparePrices) && r.comparePrices.length) ? r.comparePrices : null,
      _ext: name
    };
  }
  function uDealpilot(o) {
    var D = o.D, pct = (D.conf && D.conf.pct != null) ? D.conf.pct : null;
    var accLabel = pct == null ? ((D.conf && D.conf.label) || '\u2013') : ((pct >= 75 ? 'Hoch' : pct >= 50 ? 'Mittel' : 'Niedrig') + ' \u00b7 ' + pct + ' %');
    var accCol = pct == null ? '#7A7370' : (pct >= 75 ? '#3FA56C' : pct >= 50 ? '#9a7f33' : '#B8625C');
    function band(k) { return D.mw ? D.mw[k] : null; }
    function bandM(k) { return D.mm ? D.mm[k] : null; }
    return {
      key: 'dp', name: 'DealPilot', isDP: true, brand: '#C9A84C',
      label: 'Markteinsch\u00e4tzung',
      compare: (D.compare && D.compare.length) ? D.compare : null, /* v783-dp-compare */
      mw: { low: band('low'), mid: band('med'), high: band('high') },
      mm: { low: bandM('low'), mid: bandM('med'), high: bandM('high') },
      eurSqm: null, mmEurSqm: null,
      accLabel: accLabel, accCol: accCol,
      accTier: (pct != null) ? (pct >= 75 ? 'hoch' : pct >= 50 ? 'mittel' : 'niedrig') : tierFromLabel(D.conf && D.conf.label),
      bewertung: D.rating || '\u2013',
      microRaw: (D.microRaw != null ? D.microRaw : null),
      macroRaw: (D.macroRaw != null ? D.macroRaw : null),
      compare: null, _dp: true
    };
  }
  function providers() {
    var out = [];
    if (_dp && _dp.D && _dp.D.mw) out.push(uDealpilot(_dp));
    if (_ext['Sprengnetter']) out.push(uExternal('Sprengnetter', _ext['Sprengnetter']));
    if (_ext['PriceHubble']) out.push(uExternal('PriceHubble', _ext['PriceHubble']));
    return out;
  }
  function mwAt(u, b) { return u.mw[b] != null ? u.mw[b] : u.mw.mid; }
  function mmAt(u, b) { return u.mm[b] != null ? u.mm[b] : u.mm.mid; }
  function sqmAt(u, b) {
    var wfl = WFL(); var mw = mwAt(u, b);
    if (wfl) return Math.round(mw / wfl);
    if (u.eurSqm && u.mw.mid) return Math.round(u.eurSqm * (mw / u.mw.mid));
    return null;
  }
  function mmSqmAt(u, b) {
    var wfl = WFL(); var mm = mmAt(u, b);
    if (mm && wfl) return mm / wfl;
    return u.mmEurSqm || null;
  }
  function hasLage(u) { return u.microRaw != null || u.macroRaw != null; }

  /* ── Konsens ── */
  function consMW(ps, b) { return Math.round(ps.reduce(function (s, u) { return s + mwAt(u, b); }, 0) / ps.length / 100) * 100; }
  function consMM(ps, b) { var a = ps.filter(function (u) { return mmAt(u, b) != null; }); return a.length ? Math.round(a.reduce(function (s, u) { return s + mmAt(u, b); }, 0) / a.length) : null; }
  function consLage(ps, f) { var a = ps.filter(function (u) { return u[f] != null; }); return a.length ? Math.round(a.reduce(function (s, u) { return s + u[f]; }, 0) / a.length) : null; }

  /* ── CSS (scoped unter #avsec) ── */
  function injectCss() {
    if ($('avsec-style')) return;
    var P = '#avsec ';
    var css = [
      '#avsec{margin:0 0 14px;border:1px solid rgba(201,168,76,.32);border-radius:14px;overflow:hidden;background:#ffffff;box-shadow:0 12px 32px -22px rgba(120,90,20,.55)}',
      P + '*{box-sizing:border-box}',
      P + '.av-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;background:#ffffff;border-bottom:1px solid rgba(201,168,76,.32)}',
      P + '.av-kons{display:flex;align-items:center;gap:13px;min-width:0;flex-wrap:wrap}',
      P + '.avs-kicon{width:36px;height:36px;border-radius:9px;background:linear-gradient(150deg,#1f1a12,#0c0b09);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 3px 9px -4px rgba(0,0,0,.55)}',
      P + '.avs-kicon svg{width:19px;height:19px;display:block}',
      P + '.avs-kmain{min-width:0}',
      P + '.av-kons .kt{font:700 8.5px/1 "JetBrains Mono",monospace;letter-spacing:1.4px;text-transform:uppercase;color:#b8932f}',
      P + '.av-kons .kv{font-family:"Space Grotesk",system-ui,sans-serif;font-size:27px;font-weight:700;letter-spacing:-.5px;color:#1b1815;line-height:1;margin-top:2px}',
      P + '.avs-kmeta{display:flex;gap:7px;flex-wrap:wrap}',
      P + '.avs-kpill{font:700 10.5px/1 "JetBrains Mono",monospace;color:#6b5d3a;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.32);border-radius:999px;padding:5px 11px;white-space:nowrap}',
      P + '.avs-klage{color:#2f7a52;background:rgba(63,165,108,.12);border-color:rgba(63,165,108,.32)}',
      P + '.av-kons .single{font:11px/1.3 "JetBrains Mono",monospace;color:#6b6660}',
      P + '.av-konsbtn{margin-left:2px}',
      P + '.av-right{margin-left:auto;display:flex;align-items:center;gap:9px;flex-wrap:wrap}',
      P + '.av-right .lab{font:700 9px/1 "JetBrains Mono",monospace;letter-spacing:1.1px;text-transform:uppercase;color:#6b6660}',
      P + '.av-seg{display:inline-flex;border:1px solid #d8c79a;border-radius:8px;overflow:hidden;background:#fff}',
      P + '.av-seg button{appearance:none;border:0;background:transparent;padding:8px 13px;font:700 11px/1 "JetBrains Mono",monospace;color:#8a7f63;cursor:pointer}',
      P + '.av-seg button+button{border-left:1px solid #ece0c2}',
      P + '.av-seg button.avs-sel{background:#fff;color:#b8932f;box-shadow:inset 0 0 0 1.5px #C9A84C}',
      P + '.av-vsw{display:inline-flex;gap:5px}',
      P + '.av-vsw button{font:700 11px/1 "JetBrains Mono",monospace;color:#8a7f63;background:#fff;border:1px solid #d8c79a;border-radius:8px;padding:8px 11px;cursor:pointer;display:flex;align-items:center;gap:5px}',
      P + '.av-vsw button svg{width:13px;height:13px}',
      P + '.av-vsw button.avs-on{color:#b8932f;background:#fff;border-color:#C9A84C;box-shadow:inset 0 0 0 1px #C9A84C}',
      P + '.av-min{font:700 11px/1 "JetBrains Mono",monospace;color:#8a7f63;cursor:pointer;background:#fff;border:1px solid #d8c79a;border-radius:8px;padding:8px 11px}',
      P + '.av-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:6px;font:700 11.5px/1 "JetBrains Mono",monospace;border:1px solid #C9A84C;border-radius:9px;padding:8px 13px;cursor:pointer;background:#fff;color:#1b1815;box-shadow:none}',
      P + '.av-btn.sm{padding:8px 13px;font-size:11px}',
      P + '.av-btn.full{width:100%}',
      P + '.av-ghost{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:700 10.5px/1 "JetBrains Mono",monospace;border:1px solid #d8c79a;border-radius:9px;padding:8px 12px;cursor:pointer;background:#fff;color:#1b1815;width:100%}',
      P + '.av-body{padding:13px 14px 15px;background:#ffffff}',
      '#avsec.av-min-on .av-body{display:none}',
      '#avsec.av-min-on .av-bar{border-bottom:none}',
      '#oab-credit-hint.avs-credit-below{margin:13px 0 14px !important;padding:9px 16px !important;background:linear-gradient(120deg,#fbf3df,#f6ead0) !important;border:1px solid rgba(201,168,76,.32) !important;border-radius:12px !important;font:12.5px/1.45 "JetBrains Mono",monospace !important;color:#5f5236 !important}',
      '#qb-share-btn{display:none !important}',
      '#oab-pf-qr{cursor:pointer}',
      '#oab-credit-hint.avs-credit-inline{display:inline !important;margin:0 0 0 12px !important;padding:0 !important;background:none !important;border:none !important;border-radius:0 !important;font:600 11px/1.3 "JetBrains Mono",monospace !important;color:#6b5d3a !important;vertical-align:middle !important}',
      '#oab-credit-hint.avs-credit-inline .oab-credit-dot{display:none !important}',
      /* Karten */
      P + '.av-cards{display:flex;gap:12px;flex-wrap:wrap;align-items:stretch}',
      P + '.av-cards.single{display:block}',
      P + '.mc{flex:1 1 0;min-width:230px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;border:1px solid var(--bd,#ece2c8);border-left:4px solid var(--bl,#3FA56C);background:#fff;box-shadow:0 6px 18px -13px rgba(110,82,18,.4)}',
      P + '.mc.dp{border-left:5px solid #0c0b09}',
      P + '.mhead{display:flex;align-items:center;gap:9px;height:46px;padding:0 13px;background:var(--hbg,transparent)}',
      P + '.mhead .mk{height:18px;width:auto;border-radius:5px;display:flex;align-items:center;background:rgba(255,255,255,.92);padding:2px 6px}',
      P + '.mhead .mk img{height:14px;width:auto;display:block}',
      P + '.mhead .avs-nm{font:600 13px/1.1 "Space Grotesk",system-ui,sans-serif;flex:1;min-width:0;color:var(--htx,#1b1815)}',
      P + '.mhead .avs-nm small{display:block;font:400 7.5px/1 "JetBrains Mono",monospace;letter-spacing:.5px;margin-top:2px;text-transform:uppercase;opacity:.75}',
      P + '.mhead .avs-cf{font:700 8.5px/1 "JetBrains Mono",monospace;border-radius:6px;padding:3px 7px;white-space:nowrap;flex:none}',
      /*v877-no-hatch*/P + '.mhead.dphead{position:relative;overflow:hidden;background:linear-gradient(110deg,#E8CC7A,#C9A84C 58%,#b8932f)}',
      P + '.mhead.dphead::after{content:"";position:absolute;inset:0;background:linear-gradient(157deg,rgba(255,255,255,.5),rgba(255,255,255,0) 46%)}',
      P + '.mhead.dphead>*{position:relative;z-index:1}',
      P + '.mhead.dphead .dplogo{font:700 14px/1 "Space Grotesk",sans-serif;color:#0c0b09;flex:1}',
      P + '.mhead.dphead .dplogo small{display:block;font:700 7.5px/1 "JetBrains Mono",monospace;letter-spacing:1.1px;text-transform:uppercase;color:#5c4a18;margin-top:2px}',
      P + '.mhead.dphead .avs-cf{color:#E8CC7A;background:#0c0b09}',
      P + '.mperf{position:relative;height:0;border-top:1.5px dashed rgba(201,168,76,.5);margin:0 12px}',
      P + '.mbody{flex:1;display:flex;flex-direction:column;padding:11px 13px 0}',
      P + '.mbody .mw{font-family:"Space Grotesk",system-ui,sans-serif;font-size:25px;font-weight:700;letter-spacing:-.5px;line-height:1;color:var(--val,#1b1815)}',
      P + '.mbody .mw.dpval{background:linear-gradient(110deg,#b8932f,#C9A84C 55%,#9a7f33);-webkit-background-clip:text;background-clip:text;color:transparent}',
      P + '.mbody .avs-sub{font:11px/1.4 "JetBrains Mono",monospace;margin-top:7px;min-height:15px;color:#5f5a52}',
      P + '.mbody .miete{font:11px/1.4 "JetBrains Mono",monospace;margin-top:9px;min-height:16px;color:#5f5a52}',
      P + '.mbody .miete b{color:#1b1815;font-size:13.5px}',
      P + '.mbody .row3{display:flex;gap:7px;margin-top:10px}',
      P + '.f3{flex:1;border:1px solid #efe7d2;border-radius:9px;padding:6px 8px;min-width:0;background:#ffffff}',
      P + '.f3 .fk{font:700 7.5px/1 "Space Grotesk",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#9a8f72}',
      P + '.f3 .fv{font:700 12.5px/1.2 "JetBrains Mono",monospace;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      P + '.mbody .lage{min-height:26px;display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap}',
      P + '.lchip{display:inline-flex;align-items:center;gap:4px;font:700 10.5px/1 "JetBrains Mono",monospace;padding:4px 10px;border-radius:999px}',
      P + '.nolage{font:9px/1.3 "JetBrains Mono",monospace;color:#b3ab98}',
      P + '.mbody .spacer{flex:1;min-height:6px}',
      P + '.mfoot{padding:11px 13px;display:flex;flex-direction:column;gap:7px}',
      P + '.legal{font:8px/1.3 "JetBrains Mono",monospace;color:#b3ab98;text-align:center;padding:0 13px 11px}',
      /* compare */
      P + '.cmp{margin:10px 0 2px;border:1px solid #e3ecf6;border-radius:10px;overflow:hidden}',
      P + '.cmp summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 11px;background:#f1f6fb;font:700 10.5px/1 "JetBrains Mono",monospace;color:#0f73b8}',
      P + '.cmp summary::-webkit-details-marker{display:none}',
      P + '.cmp summary .ch{margin-left:auto;transition:transform .2s}',
      P + '.cmp[open] summary .ch{transform:rotate(180deg)}',
      P + '.cmp table{width:100%;border-collapse:collapse;font:10px/1.3 "JetBrains Mono",monospace}',
      P + '.cmp th{text-align:right;color:#8a9cc2;font:700 7.5px/1 "Space Grotesk",sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:7px 8px;border-bottom:1px solid #eef3f9}',
      P + '.cmp th:first-child{text-align:left}',
      P + '.cmp td{text-align:right;padding:6px 8px;border-bottom:1px solid #f4f7fb;color:#3f4a5c}',
      P + '.cmp td:first-child{text-align:left;font-weight:700;color:#23303f}',
      /* table */
      P + '.mx{width:100%;border-collapse:collapse;font:12px/1.3 "JetBrains Mono",monospace}',
      P + '.mx th{font:700 8.5px/1 "JetBrains Mono",monospace;letter-spacing:.7px;text-transform:uppercase;color:#6b6660;text-align:right;padding:8px 9px;border-bottom:1px solid rgba(201,168,76,.22)}',
      P + '.mx th:first-child{text-align:left}',
      P + '.mx td{padding:8px 9px;border-bottom:1px solid #f2eee3;text-align:right;color:#4a463f}',
      P + '.mx td:first-child{text-align:left;font-weight:700;color:#1b1815}',
      P + '.mx tr.lage td{background:#fcfaf4}',
      P + '.mx .cons{background:#fcfaf4;color:#b8932f}',
      P + '.mx .pos{color:#2f8f57}.mx .neg{color:#c0564f}.mx .na{color:#bdb6a6}',
      P + '.mx .pill{display:inline-flex;gap:5px;align-items:center}',
      P + '.mx .pill .dpm{width:13px;height:13px;border-radius:4px;background:#0c0b09;display:inline-flex;align-items:center;justify-content:center;font-size:7px;color:#E8CC7A}',
      P + '.mx tr.take td{padding-top:11px;border-bottom:none}',
      '@media(max-width:760px){' + P + '.mc{min-width:100%}}'
    ].join('');
    var s = document.createElement('style'); s.id = 'avsec-style'; s.textContent = css; document.head.appendChild(s);
  }

  /* ── Karten ── */
  function tierFromLabel(s) {
    s = String(s || '').toLowerCase();
    if (/hoch|gut|sehr|high/.test(s)) return 'hoch';
    if (/mittel|medium|durch/.test(s)) return 'mittel';
    if (/niedrig|schwach|gering|low/.test(s)) return 'niedrig';
    return null;
  }
  function accUnified(u) {
    var map = { hoch: ['Hoch', '#3FA56C'], mittel: ['Mittel', '#9a7f33'], niedrig: ['Niedrig', '#B8625C'] };
    return map[u.accTier] || ['\u2013', '#7A7370'];
  }
  function bruttoRendite(u, b) {
    var mw = mwAt(u, b), mm = mmAt(u, b);
    return (mm != null && mw) ? ((mm * 12 / mw * 100).toFixed(1).replace('.', ',') + ' %') : '\u2013';
  }
  /* v876-brutto-out: Bruttorendite aus Karte + Tabelle entfernt */
  function field3(u) {
    var b = st.span, pc = priceClass(mwAt(u, b)), acc = accUnified(u);
    return '<div class="row3">' +
      '<div class="f3"><div class="fk">Einordnung</div><div class="fv" style="color:' + pc[1] + '">' + pc[0] + '</div></div>' +
      '<div class="f3"><div class="fk">Genauigkeit</div><div class="fv" style="color:' + acc[1] + '">' + acc[0] + '</div></div></div>';
  }
  function lageRow(u) {
    if (!hasLage(u)) return '<div class="lage"><span class="nolage">\u2014 keine Lagebewertung von diesem Anbieter</span></div>';
    var s = '';
    if (u.microRaw != null) s += lchip('Mikro', u.microRaw);
    if (u.macroRaw != null) s += lchip('Makro', u.macroRaw);
    return '<div class="lage">' + s + '</div>';
  }
  function comparePanel(u) {
    if (!u.compare) return '';
    var rows = u.compare.slice(0, 6).map(function (c) {
      var dist = (c.distance != null) ? (c.distance >= 1000 ? (c.distance / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(c.distance) + ' m') : '\u2013';
      var fl = (c.livingArea != null) ? (Math.round(c.livingArea) + ' m\u00b2') : '\u2013';
      var by = (c.constructionYear != null) ? c.constructionYear : '\u2013';
      var vv = (c.value != null) ? (fmt(c.value) + ' \u20ac') : '\u2013';
      var sim = (c.similarity != null) ? (Math.round(c.similarity <= 1 ? c.similarity * 100 : c.similarity) + ' %') : '\u2013';
      return '<tr><td>' + dist + '</td><td>' + fl + '</td><td>' + by + '</td><td>' + vv + '</td><td>' + sim + '</td></tr>';
    }).join('');
    return '<details class="cmp"><summary>Vergleichsobjekte (' + u.compare.length + ') <span class="ch">\u25be</span></summary>' +
      '<table><tr><th>Distanz</th><th>Fl\u00e4che</th><th>Baujahr</th><th>Wert</th><th>\u00c4hnl.</th></tr>' + rows + '</table></details>';
  }
  function miniCard(u) {
    var b = st.span, mw = mwAt(u, b), d = diffPct(mw), pc = priceClass(mw);
    var sqm = sqmAt(u, b), mm = mmAt(u, b), mmSqm = mmSqmAt(u, b);
    var head;
    if (u.isDP) {
      head = '<div class="mhead dphead"><span class="dplogo">DealPilot<small>' + u.label + '</small></span><span class="avs-cf">' + accUnified(u)[0] + '</span></div>';
    } else {
      head = '<div class="mhead" style="background:' + u.brand + '"><span class="mk"><img src="' + u.logo + '" alt="' + u.name + '"></span>' +
        '<span class="avs-nm" style="color:#fff">' + u.name + '<small style="color:rgba(255,255,255,.85)">' + u.label + '</small></span>' +
        '<span class="avs-cf" style="color:#fff;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.32)">' + accUnified(u)[0] + '</span></div>';
    }
    var mwCls = 'mw' + (u.isDP ? ' dpval' : '');
    var sub = (sqm ? fmt(sqm) + ' \u20ac/m\u00b2' : '') + (d != null ? ' \u00b7 <span style="color:' + (d >= 0 ? '#2f8f57' : '#c0564f') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%</span>' : '');
    var miete = (mm != null) ? ('Miete <b>' + fmt(mm) + ' \u20ac</b>' + (mmSqm ? ' \u00b7 ' + dec(mmSqm) + ' \u20ac/m\u00b2 kalt' : '')) : '';
    var foot = '<div class="mfoot">';
    /* v782-report-btn-removed: 'Marktbericht erzeugen' entfernt (DealPilot-Karte) */
    foot += '<button type="button" class="av-btn full" data-apply="' + u.key + '">\u21a7 \u00fcbernehmen (' + spanLbl(b) + ')</button>';
    foot += '</div>';
    var body = '<div class="mbody"><div class="' + mwCls + '"' + (u.isDP ? '' : ' style="color:#1b1815"') + '>' + fmt(mw) + ' \u20ac</div>' +
      '<div class="avs-sub">' + sub + '</div><div class="miete">' + miete + '</div>' +
      field3(u) + comparePanel(u) + '<div class="spacer"></div></div>';
    return '<div class="mc' + (u.isDP ? ' dp' : '') + '" style="border-left-color:' + (u.isDP ? '#0c0b09' : u.brand) + '">' +
      head + '<div class="mperf"></div>' + body + foot +
      '<div class="legal">Marktpreisindikation \u2014 kein Gutachten n. \u00a7 194 BauGB</div></div>';
  }

  function tableView(ps) {
    var b = st.span, multi = ps.length >= 2;
    function row(lbl, fn, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + lbl + '</td>' +
        ps.map(function (u) { return '<td>' + fn(u) + '</td>'; }).join('') +
        (multi ? '<td class="cons">' + fn(null) + '</td>' : '') + '</tr>';
    }
    var head = '<tr><th>Kennzahl (' + spanLbl(b) + ')</th>' + ps.map(function (u) {
      return '<th><span class="pill">' + (u.isDP ? '<span class="dpm">\u2708</span>' : '') + u.name + '</span></th>';
    }).join('') + (multi ? '<th class="cons">\u00d8 Konsens</th>' : '') + '</tr>';
    var cMW = consMW(ps, b), cMM = consMM(ps, b);
    var body =
      row('Marktwert', function (u) { return (u ? fmt(mwAt(u, b)) : fmt(cMW)) + ' \u20ac'; }) +
      row('vs. Kaufpreis', function (u) { var mw = u ? mwAt(u, b) : cMW; var d = diffPct(mw); return d == null ? '\u2013' : '<span class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%</span>'; }) +
      row('Einordnung', function (u) { var mw = u ? mwAt(u, b) : cMW; var pc = priceClass(mw); return '<span style="color:' + pc[1] + '">' + pc[0] + '</span>'; }) +
      row('Genauigkeit', function (u) { return u ? accUnified(u)[0] : '\u2014'; }) +
      row('Miete kalt', function (u) { var v = u ? mmAt(u, b) : cMM; return v == null ? '\u2013' : (fmt(v) + ' \u20ac'); });
    var take = '<tr class="take"><td></td>' + ps.map(function (u) { return '<td><button type="button" class="av-btn sm" data-apply="' + u.key + '">\u21a7 ' + spanLbl(b) + '</button></td>'; }).join('') +
      (multi ? '<td><button type="button" class="av-btn sm" data-konsens="1">\u21a7 Konsens</button></td>' : '') + '</tr>';
    return '<table class="mx">' + head + body + take + '</table>';
  }

  function topbar(ps) {
    var b = st.span, k;
    if (ps.length >= 2) {
      var c = consMW(ps, b), mm = consMM(ps, b);
      var wfl = WFL(), sqm = wfl ? Math.round(c / wfl) : null;
      k = '<div class="av-kons">' +
        '<span class="avs-kicon"><svg viewBox="0 0 24 24" fill="none" stroke="#E8CC7A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></svg></span>' +
        '<div class="avs-kmain"><div class="kt">Konsens \u00b7 ' + spanLbl(b) + '</div><div class="kv">' + fmt(c) + ' \u20ac</div></div>' +
        '<div class="avs-kmeta">' +
          (sqm ? '<span class="avs-kpill">' + fmt(sqm) + ' \u20ac/m\u00b2</span>' : '') +
          (mm != null ? '<span class="avs-kpill">Miete ' + fmt(mm) + ' \u20ac</span>' : '') +
        '</div>' +
        '<button type="button" class="av-btn sm av-konsbtn" data-konsens="1">\u21a7 Konsens</button></div>';
    } else {
      k = '<div class="av-kons"><span class="single">' + ps.length + ' Quelle \u00b7 kein Konsens' + (ps[0] ? ' \u00b7 ' + ps[0].name : '') + '</span></div>';
    }
    var seg = '<span class="lab">Spanne</span><span class="av-seg">' +
      '<button type="button" data-span="low"' + (b === 'low' ? ' class="avs-sel"' : '') + '>Unten</button>' +
      '<button type="button" data-span="mid"' + (b === 'mid' ? ' class="avs-sel"' : '') + '>\u00d8</button>' +
      '<button type="button" data-span="high"' + (b === 'high' ? ' class="avs-sel"' : '') + '>Oben</button></span>';
    var vsw = '<span class="av-vsw"><button type="button" data-view="cards"' + (st.view === 'cards' ? ' class="avs-on"' : '') + '>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Karten</button>' +
      '<button type="button" data-view="table"' + (st.view === 'table' ? ' class="avs-on"' : '') + '>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v16"/></svg>Tabelle</button></span>';
    var min = '<button type="button" class="av-min" data-min="1">' + (st.min ? '\u25bc zeigen' : '\u25b2 min') + '</button>';
    return '<div class="av-bar">' + k + '<span class="av-right">' + seg + vsw + min + '</span></div>';
  }

  function render() {
    var host = $(HOST); if (!host) return;
    injectCss();
    var ps = providers();
    if (!ps.length) { host.innerHTML = ''; return; }
    var cards = (ps.length === 1)
      ? '<div class="av-cards single">' + miniCard(ps[0]) + '</div>'
      : '<div class="av-cards">' + ps.map(miniCard).join('') + '</div>';
    var inner = (st.view === 'table') ? tableView(ps) : cards;
    host.innerHTML = '<div id="avsec"' + (st.min ? ' class="av-min-on"' : '') + '>' + topbar(ps) + '<div class="av-body">' + inner + '</div></div>';
    wireShareQr();
    relocateCredit();
  }

  /* v756/v759: Kerosin-Hinweis ins obere Pre-Flight-Pill (hinter "N aktiv") verschieben;
     Fallback unter die Sektion, falls das Pill fehlt. */
  function relocateCredit() {
    var ch = document.getElementById('oab-credit-hint');
    if (!ch) return;
    var trig = document.querySelector('.dp-pf-mtrigger');
    if (trig) {
      ch.classList.remove('avs-credit-below');
      ch.classList.add('avs-credit-inline');
      if (ch.parentNode !== trig) trig.appendChild(ch);
    } else {
      ch.classList.remove('avs-credit-inline');
      ch.classList.add('avs-credit-below');
      var res = document.getElementById('oab-results');
      if (res && res.parentNode && ch !== res.nextSibling) res.parentNode.insertBefore(ch, res.nextSibling);
    }
  }

  /* v759: Pre-Flight-QR als Teilen-Trigger. Kein/abgelaufener Pass (kein data-shared) -> Pass-Modal;
     aktiver Pass -> Link oeffnet wie bisher die Pass-Seite. Ersetzt den "Quick Boarding teilen"-Button. */
  function wireShareQr() {
    if (window._avsQrWired) return; window._avsQrWired = 1;
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('#oab-pf-qr') : null;
      if (!a) return;
      if (!a.getAttribute('data-shared')) {
        e.preventDefault();
        if (window.QuickBoardingShare && typeof window.QuickBoardingShare.open === 'function') window.QuickBoardingShare.open();
      }
    }, true);
  }

  /* ── Events (Delegation am Host) ── */
  function applySpanToConsumers() {
    try { if (typeof global._oabSetSpan === 'function') global._oabSetSpan(st.span); } catch (e) {}
    try { if (_dp && _dp.api && typeof _dp.api.setMode === 'function') _dp.api.setMode(st.span === 'mid' ? 'med' : st.span); } catch (e) {}
  }
  function onClick(e) {
    var host = $(HOST); if (!host || !host.contains(e.target)) return;
    var t;
    if ((t = e.target.closest('[data-span]'))) { st.span = t.getAttribute('data-span'); applySpanToConsumers(); render(); return; }
    if ((t = e.target.closest('[data-view]'))) { st.view = t.getAttribute('data-view'); render(); return; }
    if (e.target.closest('[data-min]')) { st.min = !st.min; render(); return; }
    if ((t = e.target.closest('[data-apply]'))) {
      var k = t.getAttribute('data-apply');
      applySpanToConsumers();
      if (k === 'dp') { try { if (_dp && _dp.api && typeof _dp.api.apply === 'function') _dp.api.apply(); } catch (er) {} }
      else if (k === 'sp') { try { if (typeof global._oabApplyExternal === 'function') global._oabApplyExternal('Sprengnetter'); } catch (er) {} }
      else if (k === 'ph') { try { if (typeof global._oabApplyExternal === 'function') global._oabApplyExternal('PriceHubble'); } catch (er) {} }
      return;
    }
    if (e.target.closest('[data-konsens]')) {
      var ps = providers(); if (ps.length < 2) return;
      var mw = consMW(ps, st.span), mm = consMM(ps, st.span);
      try { if (typeof global._oabApplyConsensus === 'function') global._oabApplyConsensus(mw, mm); } catch (er) {}
      return;
    }
    if (e.target.closest('[data-report]')) {
      try { if (_dp && _dp.api && typeof _dp.api.report === 'function') _dp.api.report(); else if (typeof global.DealPilotMB === 'object' && typeof global.DealPilotMB.run === 'function') global.DealPilotMB.run(); } catch (er) {}
      return;
    }
  }
  document.addEventListener('click', onClick, false);

  global.AvmSection = {
    setExternal: function (avm) { _ext = avm || {}; st.min = true; /* v787c-min-on-switch: bei jedem Objektwechsel minimiert */ },
    setDealpilot: function (D, mode, api) { _dp = (D && D.mw) ? { D: D, mode: mode, api: api } : null; render(); },
    clearDealpilot: function () { _dp = null; render(); },
    render: render,
    _state: st
  };
})(window);
