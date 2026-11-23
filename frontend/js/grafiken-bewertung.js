/* ═══════════════════════════════════════════════════════════════════
   v4170 · REITER BEWERTUNG: Zinsrisiko, Schuldendienstdeckung, Beleihung neu
   (Vorschau-Funktion „grafiken_neu“, dieselbe Sperre wie grafiken-neu.js)

   Marcel 23.11.2026: „Schau dir doch da auch mal im Tab Bewertung die Grafiken an.
   Also das Zinsrisiko, Beleihungsauslauf, Schuldendienstdeckung.“ Vorbild sind die
   Heatmap Anschlusszins × Miete, die Einordnung (Bullets), der Verlauf und der
   Fahrplan aus Dateien/Demos/pilot-analyse-premium-2026-11-23.html.

   Was ersetzt wird (nur bei freigeschalteter Vorschau, sonst bleibt alles wie heute):
     #bc-cockpit  „DSCR & LTV im Verlauf“             → Einordnung + DSCR-Verlauf + Beleihungsverlauf
     #bc-stress   „Wie reagiert der Deal bei …?“       → Zinsrisiko als Heatmap Anschlusszins × Miete
   Die alten Grafiken rechnen weiter (die PDFs lesen BankCharts._lastCockpitData), sie
   werden nur ausgeblendet.

   RECHNET KEINEN KERN NACH. Gelesen wird:
     DSCR je Jahr, LTV je Jahr, Jahre, Ende Zinsbindung   BankCharts._lastCockpitData (aus Dscr.compute)
     DSCR heute, LTV heute, Cashflow heute                State.kpis (calc.js)
     Anschlussphase                                       State.kpis.nkm_an, bwk_cf_an, zins_an, tilg_an,
                                                          bspar_an, cf_op_an, State.az (Anschlusszins)
     DSCR je Szenario                                     Dscr.compute (derselbe Kern wie die Ampel)
     Schwellen                                            DealPilotSchwellen.get() (Einstellungen)
   Eigenes Modell (gekennzeichnet) nur in der Heatmap: Zins je Szenario = Zinsanteil der Anschlussrate
   skaliert auf den Szenariozins, Tilgung und Kosten fest, Miete um den Prozentsatz verändert. Die Zelle
   „Annahme heute“ ist damit genau cf_op_an der App (Prüfung im Fuß der Karte).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpGrafikenBewertung) return;

  var AN = false, GRUEN = '#3FA56C', ROT = '#B8625C', _sig = '';

  function zahl(v) { return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function eurV(v) { return v == null ? 'keine Angabe' : (v > 0.5 ? '+' : v < -0.5 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function pct1(v) { return nf1.format(v) + ' %'; }
  function sw() { try { return window.DealPilotSchwellen ? window.DealPilotSchwellen.get() : null; } catch (e) { return null; } }
  function schwellen() { var s = sw() || {}; return { dg: zahl(s.dscrGruen) || 1.2, dy: zahl(s.dscrGelb) || 1.0, lg: zahl(s.ltvGruen) || 90, lr: zahl(s.ltvRot) || 100 }; }
  function reduziert() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  /* ── Stil ─────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-gb-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-gb-stil';
    s.textContent = [
      'body.dp-gb-an .dp-gb-weg{display:none!important}',
      '.dp-gb{--gb-gold:var(--wl-c9a84c,#C9A84C);--gb-gold-h:var(--wl-e8cc7a,#E8CC7A);--gb-gruen:#3FA56C;--gb-rot:#B8625C;',
      '--gb-netz:color-mix(in srgb,currentColor 10%,transparent);--gb-leise:color-mix(in srgb,currentColor 62%,transparent);--gb-neutral:color-mix(in srgb,currentColor 7%,transparent);margin:0 0 18px}',
      '.dp-gb-karte{position:relative;background:var(--surface,#fff);border:1px solid var(--gb-netz);border-radius:14px;padding:18px 20px 16px;margin:0 0 16px;min-width:0}',
      '.dp-gb-eti{font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--gb-gold);margin:0 0 8px}',
      '.dp-gb-t{font:600 18px/1.25 "Space Grotesk",Inter,sans-serif;letter-spacing:-.01em;margin:0 0 4px}',
      '.dp-gb-s{font:400 12.5px/1.45 Inter,sans-serif;color:var(--gb-leise);margin:0 0 14px;max-width:760px}',
      '.dp-gb-reihe{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}',
      '.dp-gb-reihe>.dp-gb-karte{margin:0}',
      '@media (max-width:900px){.dp-gb-reihe{grid-template-columns:minmax(0,1fr)}.dp-gb-reihe>.dp-gb-karte{margin:0 0 16px}}',
      '.dp-gb svg{display:block;width:100%;height:auto;overflow:visible}',
      '.dp-gb .gb-ax{font:400 11px "JetBrains Mono",ui-monospace,monospace;fill:var(--gb-leise)}',
      '.dp-gb .gb-netz{stroke:var(--gb-netz);stroke-width:1}',
      '.dp-gb .gb-schw{stroke-width:1;stroke-dasharray:4 3}',
      '.dp-gb .gb-lab{font:600 10.5px Inter,sans-serif}',
      '.dp-gb .gb-wert{font:600 11px "JetBrains Mono",ui-monospace,monospace;fill:currentColor}',
      '.dp-gb .gb-zone{fill-opacity:.07}',
      '.dp-gb .gb-ezb{stroke:var(--gb-gold);stroke-width:1;stroke-dasharray:3 3}',
      '.dp-gb .gb-linie{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}',
      '.dp-gb .gb-treff{fill:transparent;cursor:crosshair}',
      '.dp-gb .gb-tip{position:absolute;pointer-events:none;z-index:6;background:#050505;color:#FDFCFA;font:500 12px/1.45 Inter,sans-serif;padding:7px 10px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap;opacity:0;transition:opacity .12s}',
      '.dp-gb .gb-tip b{font-family:"JetBrains Mono",monospace;font-weight:600}',
      '.dp-gb .gb-tip .j{font:600 11px "JetBrains Mono",monospace;color:var(--gb-gold-h);margin-bottom:2px}',
      '.dp-gb .gb-kopfzahl{display:flex;flex-wrap:wrap;gap:4px 18px;align-items:baseline;margin:0 0 10px}',
      '.dp-gb .gb-kopfzahl b{font:600 28px/1 "Space Grotesk",Inter,sans-serif;letter-spacing:-.02em}',
      '.dp-gb .gb-kopfzahl span{font:500 12px Inter,sans-serif;color:var(--gb-leise)}',
      '.dp-gb .gb-pille{display:inline-flex;align-items:center;gap:5px;font:600 11px/1 Inter,sans-serif;padding:4px 8px;border-radius:99px;border:1px solid currentColor}',
      '.dp-gb .gb-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:10px 0 0;font:400 11.5px Inter,sans-serif;color:var(--gb-leise)}',
      '.dp-gb .gb-leg i{display:inline-block;width:14px;height:2px;margin-right:5px;vertical-align:3px}',
      '.dp-gb .gb-leg i.d{border-top:1px dashed currentColor;height:0;background:none}',
      /* Einordnung */
      '.dp-gb-bul{display:flex;flex-direction:column;gap:10px}.dp-gb-bul .zl{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr) 92px;gap:6px 14px;align-items:center}',
      '.dp-gb-bul .n{font:600 13px/1.3 Inter,sans-serif}.dp-gb-bul .n small{display:block;font:400 11px/1.3 Inter,sans-serif;color:var(--gb-leise)}',
      '.dp-gb-bul .w{font:600 13px "JetBrains Mono",monospace;text-align:right}.dp-gb-bul .w small{display:block;font:600 10.5px Inter,sans-serif;letter-spacing:.02em}',
      '.dp-gb-bul .bahn{position:relative;height:18px;border-radius:4px;overflow:hidden;display:flex;gap:2px}',
      '.dp-gb-bul .bahn i{display:block;height:100%}',
      '.dp-gb-bul .mark{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;border-radius:2px;background:currentColor;box-shadow:0 0 0 2px var(--surface,#fff)}',
      '.dp-gb-bul .ziel{position:absolute;top:2px;bottom:2px;width:2px;margin-left:-1px;background:var(--gb-gold)}',
      '@media (max-width:640px){.dp-gb-bul .zl{grid-template-columns:minmax(0,1fr) auto}.dp-gb-bul .bahn{grid-column:1/-1;order:3}}',
      /* Heatmap */
      '.dp-gb-hm{display:grid;gap:2px;font:600 12px "JetBrains Mono",ui-monospace,monospace}',
      '.dp-gb-hm .k{font:500 11px "JetBrains Mono",monospace;color:var(--gb-leise);display:flex;align-items:center;justify-content:center;padding:4px 2px;text-align:center}',
      '.dp-gb-hm .k.z{justify-content:flex-end;padding-right:8px}',
      '.dp-gb-hm .c{position:relative;border-radius:4px;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;cursor:default;transition:transform .12s}',
      '.dp-gb-hm .c small{font:500 10px Inter,sans-serif;opacity:.85}',
      '.dp-gb-hm .c.basis{box-shadow:0 0 0 2px var(--gb-gold)}',
      '.dp-gb-hm .c:hover{transform:scale(1.04);z-index:2}',
      '.dp-gb-hm .c .warn{position:absolute;top:3px;right:5px;font:700 10px Inter,sans-serif}',
      '.dp-gb-ach{display:flex;justify-content:space-between;font:500 11px Inter,sans-serif;color:var(--gb-leise);margin:6px 0 0}',
      '@media (max-width:640px){.dp-gb-hm{font-size:10.5px}.dp-gb-hm .c{min-height:38px}.dp-gb-hm .c small{display:none}.dp-gb-karte{padding:14px 12px}}',
      '.dp-gb-fuss{font:400 11px/1.45 Inter,sans-serif;color:var(--gb-leise);margin:12px 0 0}',
      '.dp-gb-fuss b{font-weight:600}',
      '.dp-gb.gb-anim .gb-linie{stroke-dasharray:var(--gb-len);stroke-dashoffset:var(--gb-len);animation:gbZieh 1s ease-out .1s forwards}',
      '.dp-gb.gb-anim .dp-gb-hm .c{animation:gbAuf .45s ease-out both}',
      '.dp-gb.gb-anim .dp-gb-bul .bahn .mark{animation:gbAuf .5s ease-out .2s both}',
      '@keyframes gbZieh{to{stroke-dashoffset:0}}@keyframes gbAuf{from{opacity:0}to{opacity:1}}',
      '@media (prefers-reduced-motion:reduce){.dp-gb.gb-anim *{animation:none!important;stroke-dasharray:none!important}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Daten (nur lesen) ────────────────────────────────────────────── */
  function daten() {
    var S = window.State, K = S && S.kpis, C = window.BankCharts && window.BankCharts._lastCockpitData;
    if (!S || !K || !C || !Array.isArray(C.dscrArr) || !Array.isArray(C.years) || C.years.length < 2) return null;
    return { S: S, K: K, C: C, sw: schwellen() };
  }
  function dscrKern(nkm_j, zins_j, tilg_j, bsv_j, bwk_cf, ze_j) {
    try { return window.Dscr.compute({ nkm_j: nkm_j, ze_j: ze_j || 0, zins_j: zins_j, tilg_j: tilg_j, bsv_j: bsv_j || 0, bwk_cf: bwk_cf }).netto; } catch (e) { return null; }
  }

  /* ── Tooltip ──────────────────────────────────────────────────────── */
  function tipBinden(karte) {
    var tip = karte.querySelector('.gb-tip'); if (!tip) return;
    karte.addEventListener('mousemove', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
      if (!t) { tip.style.opacity = '0'; return; }
      tip.innerHTML = t.getAttribute('data-tip');
      var r = karte.getBoundingClientRect(), x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
      var w = tip.offsetWidth; if (x + w > r.width - 4) x = ev.clientX - r.left - w - 14;
      tip.style.left = Math.max(4, x) + 'px'; tip.style.top = y + 'px'; tip.style.opacity = '1';
    });
    karte.addEventListener('mouseleave', function () { tip.style.opacity = '0'; });
  }

  /* ── 1 · Einordnung: vier Kennzahlen gegen die Schwellen ──────────── */
  function bullet(o) {
    /* o: name, sub, wert, text, min, max, baender [{bis, farbe}], ziel, gut (true = hoch ist gut) */
    var span = o.max - o.min, pos = function (v) { return Math.max(0, Math.min(100, (v - o.min) / span * 100)); };
    var start = o.min, teile = o.baender.map(function (b) { var w = pos(Math.min(b.bis, o.max)) - pos(start); start = Math.min(b.bis, o.max); return '<i style="width:' + w.toFixed(2) + '%;background:' + b.farbe + '"></i>'; }).join('');
    var farbe = o.farbe;
    return '<div class="zl"><div class="n">' + esc(o.name) + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</div>'
      + '<div class="bahn" data-tip="' + esc(o.tip) + '">' + teile
      + (o.ziel != null ? '<span class="ziel" style="left:' + pos(o.ziel).toFixed(2) + '%"></span>' : '')
      + '<span class="mark" style="left:' + pos(o.wert).toFixed(2) + '%;color:' + farbe + '"></span></div>'
      + '<div class="w">' + esc(o.text) + '<small style="color:' + farbe + '">' + esc(o.wort) + '</small></div></div>';
  }
  function einordnungHtml(D) {
    var K = D.K, s = D.sw, C = D.C;
    var gruen = 'color-mix(in srgb,' + GRUEN + ' 30%,transparent)', rot = 'color-mix(in srgb,' + ROT + ' 30%,transparent)', mitte = 'var(--gb-neutral)';
    var dscrH = zahl(K.dscr), dscrA = dscrKern(K.nkm_an, K.zins_an, K.tilg_an, K.bspar_an, K.bwk_cf_an, (D.S.ze || 0) * 12);
    var ltvH = zahl(K.ltv), cfm = zahl(K.cf_op) != null ? K.cf_op / 12 : null;
    var dWort = function (v) { return v >= s.dg ? '✓ solide' : v >= s.dy ? '◐ knapp' : '✕ kritisch'; };
    var dFarbe = function (v) { return v >= s.dg ? GRUEN : v >= s.dy ? 'currentColor' : ROT; };
    var z = [];
    if (dscrH != null) z.push(bullet({ name: 'DSCR heute', sub: 'Schuldendienstdeckung', wert: dscrH, text: nf2.format(dscrH), min: 0, max: 2,
      baender: [{ bis: s.dy, farbe: rot }, { bis: s.dg, farbe: mitte }, { bis: 2, farbe: gruen }], ziel: s.dg, farbe: dFarbe(dscrH), wort: dWort(dscrH),
      tip: 'DSCR heute <b>' + nf2.format(dscrH) + '</b><br>Bankschwelle ' + nf2.format(s.dy) + ', solide ab ' + nf2.format(s.dg) }));
    if (dscrA != null) z.push(bullet({ name: 'DSCR Anschluss', sub: 'erstes Jahr nach der Zinsbindung', wert: dscrA, text: nf2.format(dscrA), min: 0, max: 2,
      baender: [{ bis: s.dy, farbe: rot }, { bis: s.dg, farbe: mitte }, { bis: 2, farbe: gruen }], ziel: s.dg, farbe: dFarbe(dscrA), wort: dWort(dscrA),
      tip: 'DSCR nach der Zinsbindung <b>' + nf2.format(dscrA) + '</b><br>mit ' + pct1((D.S.az || 0) * 100) + ' Anschlusszins' }));
    if (ltvH != null) {
      var lW = ltvH <= 60 ? '✓ sehr sicher' : ltvH <= s.lg ? '✓ im Rahmen' : ltvH <= s.lr ? '◐ erhöht' : '✕ über Wert';
      var lF = ltvH <= s.lg ? GRUEN : ltvH <= s.lr ? 'currentColor' : ROT;
      z.push(bullet({ name: 'Beleihung heute', sub: 'Restschuld zum Wert', wert: Math.min(ltvH, 120), text: pct1(ltvH), min: 0, max: 120,
        baender: [{ bis: 60, farbe: gruen }, { bis: s.lg, farbe: mitte }, { bis: s.lr, farbe: 'color-mix(in srgb,currentColor 14%,transparent)' }, { bis: 120, farbe: rot }], ziel: 60,
        farbe: lF, wort: lW, tip: 'Beleihung heute <b>' + pct1(ltvH) + '</b><br>sehr sicher bis 60 %, deine Grenze ' + nf0.format(s.lg) + ' %' }));
    }
    if (cfm != null) {
      var cfMin = Math.min(-400, Math.floor(cfm / 100) * 100 - 100), cfMax = Math.max(400, Math.ceil(cfm / 100) * 100 + 100);
      z.push(bullet({ name: 'Cashflow heute', sub: 'vor Steuer, im Monat', wert: cfm, text: eurV(cfm), min: cfMin, max: cfMax,
        baender: [{ bis: 0, farbe: rot }, { bis: cfMax, farbe: gruen }], ziel: 0, farbe: cfm >= 0 ? GRUEN : ROT, wort: cfm >= 0 ? '✓ trägt sich' : '✕ Zuzahlung',
        tip: 'Cashflow vor Steuer <b>' + eurV(cfm) + '</b> im Monat' }));
    }
    if (!z.length) return '';
    var ezbJ = C.years[C.ezbIdx] != null ? C.years[C.ezbIdx] : null;
    return '<div class="dp-gb-karte" data-gb="einordnung"><div class="gb-tip"></div><div class="dp-gb-eti">Einordnung</div>'
      + '<div class="dp-gb-t">Wo das Objekt gegenüber den Bankschwellen steht</div>'
      + '<p class="dp-gb-s">Goldener Strich: Zielmarke. Schwellen aus deinen Einstellungen (DSCR ' + nf2.format(s.dy) + ' und ' + nf2.format(s.dg) + ', Beleihung ' + nf0.format(s.lg) + ' %)' + (ezbJ ? '. Zinsbindung endet ' + ezbJ : '') + '.</p>'
      + '<div class="dp-gb-bul">' + z.join('') + '</div></div>';
  }

  /* ── 2 · Verlauf DSCR bzw. Beleihung ─────────────────────────────── */
  function verlaufHtml(D, art) {
    var C = D.C, s = D.sw, J = C.years.slice(), n = J.length;
    var W = (art === 'dscr' ? C.dscrArr : C.ltvArr).map(zahl);
    if (W.filter(function (v) { return v != null; }).length < 2) return '';
    var w = 560, h = 230, L = 40, R = 14, T = 14, B = 26, iw = w - L - R, ih = h - T - B;
    var max, min = 0, lines, zonen = '';
    if (art === 'dscr') {
      max = Math.max(2, Math.ceil(Math.max.apply(null, W.filter(function (v) { return v != null; })) * 4) / 4);
      lines = [{ v: s.dy, t: 'Bank ' + nf2.format(s.dy), f: ROT }, { v: s.dg, t: 'solide ' + nf2.format(s.dg), f: GRUEN }];
    } else {
      max = Math.max(100, Math.ceil(Math.max.apply(null, W.filter(function (v) { return v != null; })) / 10) * 10);
      lines = [{ v: 60, t: '60 %', f: GRUEN }, { v: 80, t: '80 %', f: 'currentColor' }];
    }
    var x = function (i) { return L + (n === 1 ? iw / 2 : i / (n - 1) * iw); };
    var y = function (v) { return T + (1 - (v - min) / (max - min)) * ih; };
    if (art === 'dscr') zonen = '<rect class="gb-zone" x="' + L + '" y="' + y(s.dy) + '" width="' + iw + '" height="' + (y(min) - y(s.dy)) + '" style="fill:' + ROT + '"/>'
      + '<rect class="gb-zone" x="' + L + '" y="' + y(max) + '" width="' + iw + '" height="' + (y(s.dg) - y(max)) + '" style="fill:' + GRUEN + '"/>';
    else zonen = '<rect class="gb-zone" x="' + L + '" y="' + y(60) + '" width="' + iw + '" height="' + (y(min) - y(60)) + '" style="fill:' + GRUEN + '"/>';
    var tk = art === 'dscr' ? [0, 0.5, 1, 1.5, 2, 2.5, 3].filter(function (v) { return v <= max; }) : [0, 20, 40, 60, 80, 100, 120].filter(function (v) { return v <= max; });
    var netz = tk.map(function (v) { return '<line class="gb-netz" x1="' + L + '" x2="' + (w - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="gb-ax" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (art === 'dscr' ? nf1.format(v) : v + ' %') + '</text>'; }).join('');
    var schritt = n > 10 ? (n > 20 ? 5 : 2) : 1;
    var jx = J.map(function (j, i) { return (i % schritt === 0 || i === n - 1) ? '<text class="gb-ax" x="' + x(i) + '" y="' + (h - 6) + '" text-anchor="middle">' + j + '</text>' : ''; }).join('');
    var sl = lines.map(function (l) { return '<line class="gb-schw" x1="' + L + '" x2="' + (w - R) + '" y1="' + y(l.v) + '" y2="' + y(l.v) + '" style="stroke:' + l.f + '"/><text class="gb-lab" x="' + (w - R) + '" y="' + (y(l.v) - 4) + '" text-anchor="end" style="fill:' + l.f + '">' + esc(l.t) + '</text>'; }).join('');
    var ei = zahl(C.ezbIdx), ezb = ei != null && ei < n ? '<line class="gb-ezb" x1="' + x(ei) + '" x2="' + x(ei) + '" y1="' + T + '" y2="' + (T + ih) + '"/><text class="gb-lab" x="' + (x(ei) + 4) + '" y="' + (T + 10) + '" style="fill:var(--gb-gold)">Ende Zinsbindung</text>' : '';
    var pts = []; W.forEach(function (v, i) { if (v != null) pts.push([x(i), y(Math.min(v, max))]); });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var len = 0; for (var k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    var gold = 'var(--gb-gold)';
    /* Meilenstein Beleihung unter 60 % */
    var meil = '', kopf = '', sub = '';
    if (art === 'ltv') {
      var i60 = -1; W.some(function (v, i) { if (v != null && v < 60) { i60 = i; return true; } return false; });
      if (i60 >= 0) meil = '<circle cx="' + x(i60) + '" cy="' + y(W[i60]) + '" r="5" style="fill:' + GRUEN + ';stroke:var(--surface,#fff);stroke-width:2"/><text class="gb-lab" x="' + (x(i60) + 8) + '" y="' + (y(W[i60]) + 16) + '" style="fill:' + GRUEN + '">✓ unter 60 % ab ' + J[i60] + '</text>';
      var lh = zahl(D.K.ltv) != null ? D.K.ltv : W[0];
      kopf = '<b>' + pct1(lh) + '</b><span>heute</span><span>' + (W[n - 1] != null ? pct1(W[n - 1]) + ' im Jahr ' + J[n - 1] : '') + '</span>';
      sub = 'Restschuld zum Immobilienwert je Jahr. Banken rechnen bis 60 % mit dem günstigsten Zins, bis 80 % ist üblich.' + (i60 >= 0 ? ' Ab ' + J[i60] + ' liegt die Beleihung unter 60 %, gut für die Anschlussfinanzierung.' : ' Im Zeitraum fällt die Beleihung nicht unter 60 %.');
    } else {
      var dh = zahl(D.K.dscr) != null ? D.K.dscr : W[0], i1 = -1;
      W.some(function (v, i) { if (v != null && v >= s.dy) { i1 = i; return true; } return false; });
      if (i1 > 0) meil = '<circle cx="' + x(i1) + '" cy="' + y(Math.min(W[i1], max)) + '" r="5" style="fill:' + GRUEN + ';stroke:var(--surface,#fff);stroke-width:2"/><text class="gb-lab" x="' + (x(i1) - 6) + '" y="' + (y(Math.min(W[i1], max)) - 9) + '" text-anchor="end" style="fill:' + GRUEN + '">✓ ab ' + J[i1] + ' über ' + nf2.format(s.dy) + '</text>';
      kopf = '<b style="color:' + (dh >= s.dg ? GRUEN : dh >= s.dy ? 'inherit' : ROT) + '">' + nf2.format(dh) + '</b><span>heute</span><span>' + (W[n - 1] != null ? nf2.format(W[n - 1]) + ' im Jahr ' + J[n - 1] : '') + '</span>';
      sub = 'Miete nach nicht umlagefähigen Kosten geteilt durch Zins und Tilgung, je Jahr. Unter ' + nf2.format(s.dy) + ' muss Geld zugeschossen werden, ab ' + nf2.format(s.dg) + ' gilt die Finanzierung als solide.' + (i1 > 0 ? ' Ab ' + J[i1] + ' deckt die Miete den Schuldendienst.' : (i1 === 0 ? ' Die Miete deckt den Schuldendienst in jedem Jahr.' : ' Im Zeitraum deckt die Miete den Schuldendienst nie ganz.'));
    }
    var treff = J.map(function (j, i) {
      var v = W[i]; if (v == null) return '';
      var bx = x(i) - iw / (2 * Math.max(1, n - 1)), bw = iw / Math.max(1, n - 1);
      var t = '<div class=j>' + j + (i === ei ? ' · Ende Zinsbindung' : '') + '</div>' + (art === 'dscr' ? 'DSCR <b>' + nf2.format(v) + '</b>' : 'Beleihung <b>' + pct1(v) + '</b>');
      return '<rect class="gb-treff" x="' + bx.toFixed(1) + '" y="' + T + '" width="' + bw.toFixed(1) + '" height="' + ih + '" data-tip="' + esc(t) + '"/>';
    }).join('');
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + (art === 'dscr' ? 'DSCR je Jahr' : 'Beleihung je Jahr') + '">' + zonen + netz + sl + ezb
      + '<path class="gb-linie" d="' + d + '" style="stroke:' + gold + ';--gb-len:' + Math.ceil(len) + '"/>'
      + pts.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.5" style="fill:' + gold + '"/>'; }).join('')
      + meil + jx + treff + '</svg>';
    return '<div class="dp-gb-karte" data-gb="' + art + '"><div class="gb-tip"></div><div class="dp-gb-eti">' + (art === 'dscr' ? 'Schuldendienstdeckung' : 'Beleihungsauslauf') + '</div>'
      + '<div class="dp-gb-t">' + (art === 'dscr' ? 'Trägt die Miete den Kredit?' : 'Wie schnell sinkt die Beleihung?') + '</div>'
      + '<div class="gb-kopfzahl">' + kopf + '</div><p class="dp-gb-s">' + esc(sub) + '</p>' + svg
      + '<div class="gb-leg"><span><i style="background:var(--gb-gold)"></i>' + (art === 'dscr' ? 'DSCR je Jahr' : 'Beleihung je Jahr') + '</span><span><i class="d" style="color:var(--gb-gold)"></i>Ende Zinsbindung</span></div></div>';
  }

  /* ── 3 · Zinsrisiko: Anschlusszins × Miete ───────────────────────── */
  function zinsrisikoHtml(D) {
    var K = D.K, S = D.S, s = D.sw;
    var az = zahl(S.az), zA = zahl(K.zins_an), tA = zahl(K.tilg_an), nA = zahl(K.nkm_an), bA = zahl(K.bwk_cf_an), cfA = zahl(K.cf_op_an), bsA = zahl(K.bspar_an) || 0, ze = (zahl(S.ze) || 0) * 12;
    if (az == null || !(az > 0) || zA == null || tA == null || nA == null || bA == null || cfA == null) return '';
    var azP = Math.round(az * 1000) / 10;                       /* Anschlusszins in % */
    var zinsen = []; for (var p = Math.max(1, Math.round(azP) - 2); p <= Math.round(azP) + 4; p++) zinsen.push(p);
    if (zinsen.indexOf(azP) < 0) { zinsen.push(azP); zinsen.sort(function (a, b) { return a - b; }); }
    var mieten = [20, 10, 0, -10, -20];
    var zelle = function (zp, mp) {
      var zins = zA * (zp / 100) / az, miete = nA * (1 + mp / 100);
      var cf = cfA + (miete - nA) - (zins - zA);                 /* Jahr, vor Steuer */
      return { cf: cf / 12, dscr: dscrKern(miete, zins, tA, bsA, bA, ze) };
    };
    var alle = []; mieten.forEach(function (m) { zinsen.forEach(function (z) { alle.push(zelle(z, m).cf); }); });
    var maxA = Math.max.apply(null, alle.map(Math.abs)) || 1;
    var basis = zelle(azP, 0);
    var kopfZ = '<div class="k"></div>' + zinsen.map(function (z) { return '<div class="k"' + (z === azP ? ' style="color:var(--gb-gold)"' : '') + '>' + nf1.format(z).replace(',0', '') + ' %</div>'; }).join('');
    var reihen = mieten.map(function (m) {
      return '<div class="k z">' + (m > 0 ? '+' : m < 0 ? '−' : '±') + Math.abs(m) + ' %</div>' + zinsen.map(function (z) {
        var c = zelle(z, m), t = Math.min(1, Math.abs(c.cf) / maxA), f = c.cf >= 0 ? GRUEN : ROT;
        var bg = 'color-mix(in srgb,' + f + ' ' + Math.round(12 + t * 78) + '%,var(--gb-neutral))';
        var hell = t > 0.55, warn = c.dscr != null && c.dscr < s.dy;
        var tip = '<div class=j>Anschlusszins ' + nf1.format(z) + ' %, Miete ' + (m > 0 ? '+' : m < 0 ? '−' : '±') + Math.abs(m) + ' %</div>Cashflow vor Steuer <b>' + eurV(c.cf) + '</b> im Monat<br>DSCR <b>' + (c.dscr != null ? nf2.format(c.dscr) : 'keine Angabe') + '</b>' + (warn ? ' · unter der Bankschwelle' : '') + (z === azP && m === 0 ? '<br>Annahme heute' : '');
        return '<div class="c' + (z === azP && m === 0 ? ' basis' : '') + '" style="background:' + bg + ';color:' + (hell ? '#FDFCFA' : 'inherit') + '" data-tip="' + esc(tip) + '">'
          + (warn ? '<span class="warn" aria-label="unter der Bankschwelle">!</span>' : '')
          + eurV(c.cf).replace(' €', '') + '<small>DSCR ' + (c.dscr != null ? nf2.format(c.dscr) : '') + '</small></div>';
      }).join('');
    }).join('');
    /* ab welchem Zins kippt der Cashflow bei heutiger Miete? */
    var kipp = null; for (var zz = 0.5; zz <= 15; zz += 0.1) { if (zelle(zz, 0).cf < 0) { kipp = Math.round(zz * 10) / 10; break; } }
    var dscrKipp = null; for (var zd = 0.5; zd <= 15; zd += 0.1) { var dv = zelle(zd, 0).dscr; if (dv != null && dv < s.dy) { dscrKipp = Math.round(zd * 10) / 10; break; } }
    var satz = 'Bei ' + nf1.format(azP) + ' % Anschlusszins und heutiger Miete bleiben ' + eurV(basis.cf) + ' im Monat'
      + (kipp != null ? (kipp > azP ? '. Ins Minus rutscht der Cashflow erst ab rund ' + nf1.format(kipp) + ' % Zins' : '. Schon bei dieser Annahme fehlt Geld, positiv wird es erst unter rund ' + nf1.format(kipp) + ' % Zins') : ', auch bei 15 % Zins bleibt er positiv')
      + (dscrKipp != null ? ', die Bankschwelle DSCR ' + nf2.format(s.dy) + ' reißt ab rund ' + nf1.format(dscrKipp) + ' %.' : '.');
    var pruef = Math.abs(basis.cf * 12 - cfA) < 1;
    var ezbJ = D.C.years[D.C.ezbIdx];
    return '<div class="dp-gb-karte" data-gb="zinsrisiko"><div class="gb-tip"></div><div class="dp-gb-eti">Zinsrisiko · Modell</div>'
      + '<div class="dp-gb-t">Cashflow nach der Zinsbindung je Anschlusszins und Miete</div>'
      + '<p class="dp-gb-s">' + esc(satz) + ' Jede Zelle: Cashflow vor Steuer im Monat im ersten Jahr nach der Zinsbindung' + (ezbJ ? ' (' + ezbJ + ')' : '') + '. Gold umrandet ist die Annahme aus dem Reiter Finanzierung, „!“ heißt DSCR unter der Bankschwelle.</p>'
      + '<div class="dp-gb-hm" style="grid-template-columns:52px repeat(' + zinsen.length + ',minmax(0,1fr))">' + kopfZ + reihen + '</div>'
      + '<div class="dp-gb-ach"><span>↕ Miete gegenüber der Planung</span><span>Anschlusszins →</span></div>'
      + '<p class="dp-gb-fuss"><b>Modell:</b> Der Zinsanteil der Anschlussrate wird auf den Szenariozins umgerechnet, Tilgung und nicht umlagefähige Kosten bleiben gleich, die Miete ändert sich um den Prozentsatz. Kein Versprechen, sondern eine Rechnung mit deinen Annahmen.'
      + (pruef ? ' Prüfung: die gold umrandete Zelle entspricht dem Cashflow der Anschlussphase im Reiter.' : ' Prüfung: Abweichung zur Anschlussphase, bitte neu rechnen.') + '</p></div>';
  }

  /* ── Zeichnen ─────────────────────────────────────────────────────── */
  function zeichnen() {
    if (!AN) return;
    var sec = document.getElementById('s6'), cock = document.getElementById('bc-cockpit'), stress = document.getElementById('bc-stress');
    if (!sec || !cock) return;
    var D = daten(); if (!D) return;
    var sig = [window._currentObjKey, D.K.dscr, D.K.ltv, D.K.cf_op, D.K.cf_op_an, D.S.az, D.C.dscrArr.join(','), JSON.stringify(D.sw)].join('|');
    var host = document.getElementById('dp-gb-bank');
    if (host && host._sig === sig && host.isConnected) return;
    stil();
    document.body.classList.add('dp-gb-an');
    if (!host) { host = document.createElement('div'); host.id = 'dp-gb-bank'; host.className = 'dp-gb'; cock.parentNode.insertBefore(host, cock); }
    cock.classList.add('dp-gb-weg'); if (stress) stress.classList.add('dp-gb-weg');
    var html = '';
    try { html += einordnungHtml(D); } catch (e) { try { console.warn('[grafiken-bewertung] Einordnung', e); } catch (x) {} }
    try { html += '<div class="dp-gb-reihe">' + verlaufHtml(D, 'dscr') + verlaufHtml(D, 'ltv') + '</div>'; } catch (e) { try { console.warn('[grafiken-bewertung] Verlauf', e); } catch (x) {} }
    try { html += zinsrisikoHtml(D); } catch (e) { try { console.warn('[grafiken-bewertung] Zinsrisiko', e); } catch (x) {} }
    host.innerHTML = html;
    host._sig = sig;
    if (!reduziert()) { host.classList.remove('gb-anim'); void host.offsetWidth; host.classList.add('gb-anim'); }
    Array.prototype.forEach.call(host.querySelectorAll('.dp-gb-karte'), tipBinden);
  }

  /* nach jedem Lauf der Bank-Charts neu (dort entsteht _lastCockpitData) */
  function einhaengen() {
    var BC = window.BankCharts; if (!BC || !BC.renderAll || BC.renderAll._dpGb) return;
    var alt = BC.renderAll;
    var neu = function () { var r = alt.apply(this, arguments); try { zeichnen(); } catch (e) { try { console.warn('[grafiken-bewertung]', e); } catch (x) {} } return r; };
    neu._dpGb = true; BC.renderAll = neu;
  }
  function start() {
    AN = true; einhaengen();
    try { if (window.State && window.State.cfRows && window.BankCharts && window.BankCharts.renderAll) window.BankCharts.renderAll(window.State); } catch (e) {}
  }
  function los() {
    try { if (window.DpVorschau) window.DpVorschau.frei('grafiken_neu').then(function (an) { if (an) start(); }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();

  window.DpGrafikenBewertung = { an: function () { return AN; }, zeichnen: function () { var h = document.getElementById('dp-gb-bank'); if (h) h._sig = ''; zeichnen(); }, _zinsrisikoHtml: zinsrisikoHtml, _einordnungHtml: einordnungHtml, _verlaufHtml: verlaufHtml };
})();
