/* Runde d (25.11.2026) · Portfolio-Cockpit-Demos aus EINER Beschreibung.
   - Jede Demo ist nur noch ein Satz Kennzahlen und Module (DEMOS). Dieselben Sets sind die Vorlagen im Baukasten.
   - Fest ist nur der Score-Kopf. Kennzahl-Karten und Module wählt, ordnet und verbreitert der Nutzer im Baukasten.
   - Grafiken im Stil von Objekt-Cockpit › Steuer: Karten, Achsen, Gitter, Legende und Linien aus grafiken-premium.js
     (DpGrafiken.verlauf und dieselben gx-Klassen), Grün/Rot fest, Gold nur als Akzent über Whitelabel-Token.
   Rechnen: EK-Rendite nur ek-rendite.js, alles andere aus daten.js (Staging-Demokonto, nur gelesen). */
/* v4730 · Katalog der Portfolio-Module (aus Demos-2026-11-25d/cockpit.js): Kennzahl-Karten, Module, Vorlagen. Fabrik: je Datenstand neu. */
window.DpPfKatalogF = function (K, B) {
  'use strict';
  var J0 = new Date().getFullYear(), MON = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  var D = K.D, O = D.objekte, S = D.summe, k = K.kennzahlen(), ZB = D.zielbild;
  function esc(s) { return K.esc(s); }
  function f1(v) { return Math.round(v * 10) / 10; }
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  function tipA(html) { return ' data-gx-tip="' + String(html).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"'; }
  function tz(l, r) { return l + ' <b>' + r + '</b><br>'; }
  function nO(n, sg, pl) { return n + (n === 1 ? ' Objekt ' + sg : ' Objekte ' + pl); }
  function tt(t) { return '<div class="t">' + esc(t) + '</div>'; }

  /* ══ Kennzahl-Karten (Katalog) ══════════════════════════════════════════ */
  var naechste = O.slice().sort(function (a, b) { return a.zbJahr - b.zbJahr; })[0];
  var neg = O.filter(function (o) { return o.cfVs < 0; }), en = O.filter(function (o) { return o.energie === 'F' || o.energie === 'G'; });
  var mitSt = O.filter(function (o) { return o.ergVV != null; }), erg = K.summe(mitSt, function (o) { return o.ergVV; });
  var gm = O.filter(function (o) { return o.halter !== 'Privat'; }), gmV = K.summe(gm, function (o) { return o.ergVV; });
  var bis2030 = O.filter(function (o) { return o.zbJahr < J0 + 5; }), qm = K.summe(O, function (o) { return o.mieteJ; }) / 12 / k.wfl;
  function sumE(f) { return K.summe(O.filter(function (o) { return o.ekr; }), f); }
  var KZ = {
    wert: { t: 'Wertansatz', f: function () { return { l: 'Wertansatz', v: K.mio(k.wert), s: O.length + ' Objekte · ' + k.we + ' Einheiten', tip: '<div class="t-k">Wertansatz</div>Ertragswert im Bestand, wo gerechnet, sonst Kaufpreis.' }; } },
    ek: { t: 'Eigenkapital im Bestand', f: function () { return { l: 'Eigenkapital im Bestand', v: K.mio(k.ekHeute), s: 'eingesetzt ' + K.mio(k.ekEin), hero: 1 }; } },
    miete: { t: 'Kaltmiete', f: function () { return { l: 'Kaltmiete', v: K.eur(S.mieteJ / 12), s: 'im Monat · ' + K.pct(S.brutto) + ' brutto' }; } },
    cfvs: { t: 'Cashflow vor Steuer', f: function () { var z = K.ziele(); return { l: 'Cashflow vor Steuer', v: K.eurV(S.cfVsJ / 12), s: 'im Monat', c: S.cfVsJ >= 0 ? 'ok' : 'nok', tip: z ? K.tz('dein Ziel je Objekt', 'mind. ' + K.eur(z.minCfVs)) + K.tz('erreicht', O.filter(function (o) { return o.cfVs >= z.minCfVs; }).length + ' von ' + O.length) : '' }; } },
    cfns: { t: 'Cashflow nach Steuer', f: function () { return { l: 'Cashflow nach Steuer', v: K.eurV(S.cfNsJ / 12), s: 'im Monat', c: S.cfNsJ >= 0 ? 'ok' : 'nok' }; } },
    dscr: { t: 'DSCR', f: function () { var z = K.ziele(); return { l: 'DSCR', v: K.d2(S.dscr), s: z ? 'Ziel ' + K.d2(z.minDscr) + ' · ' + k.unterZiel.length + ' Objekte darunter' : 'Kapitaldienstdeckung', c: z ? (S.dscr >= z.minDscr ? 'ok' : 'nok') : '' }; } },
    zb: { t: 'Nächste Zinsbindung', f: function () { return { l: 'Nächste Zinsbindung', v: naechste.zb.slice(5, 7) + '/' + naechste.zb.slice(0, 4), s: naechste.name, c: k.bald.length ? 'nok' : 'warn' }; } },
    ekr: { t: 'EK-Rendite', f: function () { return K.ekKachel(); } },
    unterziel: { t: 'Unter DSCR-Ziel', f: function () { var z = K.ziele(); return { l: 'Unter DSCR-Ziel', v: k.unterZiel.length + ' von ' + O.length, s: z ? 'Ziel ' + K.d2(z.minDscr) : 'Grenze 1,20', c: 'nok' }; } },
    zuzahler: { t: 'Zahlen zu', f: function () { return { l: 'Zahlen zu', v: neg.length + ' Objekte', s: K.eurV(K.summe(neg, function (o) { return o.cfVs; }) / 12) + ' im Monat', c: 'nok' }; } },
    ltv: { t: 'Beleihung', f: function () { var z = K.ziele(); return { l: 'Beleihung', v: Math.round(k.ltv) + ' %', s: z ? 'Ziel höchstens ' + z.maxLtv + ' %' : 'Restschuld zu Wert', c: z && k.ltv > z.maxLtv ? 'nok' : '' }; } },
    energie: { t: 'Energie F und G', f: function () { return { l: 'Energie F und G', v: en.length + ' Objekte', s: 'CO₂ Kosten und Auflagen', c: en.length ? 'warn' : 'ok' }; } },
    leer: { t: 'Leerstand', f: function () { return { l: 'Leerstand', v: K.eur(k.leerEur / 12), s: 'entgangene Miete im Monat', c: 'warn' }; } },
    vuv: { t: 'Ergebnis Anlage V', f: function () { return { l: 'Ergebnis Anlage V', v: K.eurV(erg), s: 'alle Objekte im Jahr', c: erg < 0 ? 'ok' : '' }; } },
    stsaldo: { t: 'Steuer-Saldo', f: function () { var w = S.cfNsJ - S.cfVsJ; return { l: 'Steuer-Saldo', v: K.eurV(w), s: 'Wirkung auf den Cashflow', c: w >= 0 ? 'ok' : 'nok' }; } },
    grenz: { t: 'Grenzsteuersatz', f: function () { return { l: 'Grenzsteuersatz', v: K.pct(D.steuer.grenz), s: 'zvE ' + K.eur(D.steuer.zvePrivat), tip: '<div class="t-k">Grenzsteuersatz</div>Einkommensteuer plus Soli auf den letzten Euro, aus deinem Investmentprofil.' }; } },
    gmbh: { t: 'Ergebnis GmbH', f: function () { return { l: 'Ergebnis GmbH', v: K.eurV(gmV), s: gm.length + ' Objekte in der GmbH', c: 'warn' }; } },
    rest: { t: 'Restschuld', f: function () { return { l: 'Restschuld', v: K.mio(S.rest), s: 'Darlehen bei Kauf ' + K.mio(S.darl) }; } },
    faellig: { t: 'In fünf Jahren fällig', f: function () { return { l: 'Bis Ende ' + (J0 + 4) + ' fällig', v: K.mio(K.summe(bis2030, function (o) { return o.restZb; })), s: bis2030.length + (bis2030.length === 1 ? ' Objekt' : ' Objekte') + ' in der Anschlussfinanzierung', c: 'warn' }; } },
    ekein: { t: 'Eigenkapital eingesetzt', f: function () { return { l: 'Eigenkapital eingesetzt', v: K.mio(D.ekrP.ek), s: O.length + ' Objekte' }; } },
    ueber: { t: 'Überschuss vor Steuer', f: function () { var v = sumE(function (o) { return o.ekr.cf_op; }); return { l: 'Überschuss vor Steuer', v: K.kurzEur(v), s: 'im Jahr, nach Zins und Tilgung', c: v >= 0 ? 'ok' : 'nok' }; } },
    tilg: { t: 'Tilgung', f: function () { return { l: 'Tilgung', v: K.kurzEur(sumE(function (o) { return o.ekr.tilg; })), s: 'im Jahr, Vermögensaufbau' }; } },
    stw: { t: 'Steuerwirkung', f: function () { return { l: 'Steuerwirkung', v: K.kurzEur(sumE(function (o) { return -o.ekr.steuer; })), s: 'im Jahr, + heißt Erstattung' }; } },
    delta: { t: 'Vermögensdelta', f: function () { return { l: 'Vermögensdelta', v: K.kurzEur(sumE(function (o) { return o.ekr.delta_pa || 0; })), s: 'im Jahr, Wertentwicklung' }; } },
    ewheute: { t: 'Ertragswert heute', f: function () { return { l: 'Ertragswert heute', v: K.mio(ZB.ewB), s: D.gesamt.ewN + ' Objekte mit Wert' }; } },
    zielnk: { t: 'Zielbild nach Kosten', f: function () { return { l: 'Zielbild nach Kosten', v: K.mio(ZB.nachKosten), s: 'Ertragswert minus Maßnahmen' }; } },
    zuwachs: { t: 'Wertzuwachs', f: function () { return { l: 'Wertzuwachs', v: K.eurV(ZB.zuwachsNK), s: K.pctV(ZB.zuwachsNK / ZB.ewB * 100) + ' auf heute', c: 'ok' }; } },
    massn: { t: 'Maßnahmen', f: function () { return { l: 'Maßnahmen', v: K.kurzEur(ZB.massn), s: 'eingeplant' }; } },
    rendite: { t: 'Rendite heute und Zielbild', f: function () { return { l: 'Rendite', v: K.pct(ZB.renditeB) + ' → ' + K.pct(ZB.renditeZ), s: 'brutto, auf Kaufpreis und Maßnahmen' }; } },
    mpi: { t: 'Marktpreisindikation', f: function () { return { l: 'Marktpreisindikation', v: K.mio(ZB.mpiB), s: 'aus Angeboten, stützend' }; } },
    mietezb: { t: 'Miete im Zielbild', f: function () { return { l: 'Zielbild', v: K.eur(ZB.mieteZ / 12), s: K.pctV((ZB.mieteZ / ZB.mieteB - 1) * 100) + ' auf heute' }; } },
    ohnewechsel: { t: 'Mieterhöhung ohne Wechsel', f: function () { return { l: 'Ohne Mieterwechsel', v: K.eurV((ZB.mieteMh - ZB.mieteB) / 12), s: 'Mieterhöhung im Monat', c: 'ok' }; } },
    mitumbau: { t: 'Mit Umbau und Neuvermietung', f: function () { return { l: 'Mit Umbau und Neuvermietung', v: K.eurV((ZB.mieteZ - ZB.mieteMh) / 12), s: 'zusätzlich im Monat', c: 'ok' }; } },
    mietniveau: { t: 'Mietniveau', f: function () { return { l: 'Mietniveau', v: K.d2(qm) + ' €/m²', s: 'Durchschnitt Bestand' }; } }
  };

  /* ══ Zeichen-Helfer im Stil von grafiken-premium.js ═══════════════════════ */
  function ticks(a, b, n) { if (a === b) b = a + 1; var r = (b - a) / (n || 4), p = Math.pow(10, Math.floor(Math.log10(r))), x = r / p, s = (x <= 1 ? 1 : x <= 2 ? 2 : x <= 2.5 ? 2.5 : x <= 5 ? 5 : 10) * p, o = []; for (var t = Math.floor(a / s) * s; t <= Math.ceil(b / s) * s + s / 2; t += s) o.push(Math.round(t * 1e6) / 1e6); return o; }
  function kurz(v) { var a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e6) return s + (a / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio'; if (a >= 1e4) return s + nf0.format(Math.round(a / 1000)) + ' T'; return s + nf0.format(Math.round(a)); }
  function leg(L) { return '<div class="gx-leg">' + L.map(function (e) { return '<span><i style="background:' + e.f + (e.rand ? ';border:1px solid var(--rand)' : '') + '"></i>' + esc(e.n) + '</span>'; }).join('') + '</div>'; }
  var F = { tinte: 'var(--gx-tinte,var(--tinte))', tinte2: 'var(--gx-tinte2,var(--leise))', tinte3: 'var(--gx-tinte3,var(--tinte3))', linie2: 'var(--gx-linie2,var(--rand))', karte: 'var(--gx-karte,var(--karte))', gold: 'var(--wl-c9a84c,#C9A84C)', goldD: 'var(--wl-b8932f,#b8932f)', gruen: '#3FA56C', rot: '#B8625C' };
  var GRUEN_F = 'color-mix(in srgb,#3FA56C 16%,transparent)', ROT_F = 'color-mix(in srgb,#B8625C 18%,transparent)';

  /* Waagerechte Zeilen je Objekt: Teile gestapelt (auch negativ), optional Marke und Punkte */
  function zeilen(o) {
    var W = o.w, rh = o.rh || 22, L = o.L || (W < 520 ? 104 : 150), R = o.R || 60, T = 4, B = 22, H = T + o.rows.length * rh + B;
    var lo = 0, hi = 0; o.rows.forEach(function (r) { var p = 0, n = 0; (r.teile || []).forEach(function (t) { if (t.v >= 0) p += t.v; else n += t.v; }); lo = Math.min(lo, n, r.marke == null ? 0 : r.marke); hi = Math.max(hi, p, r.marke == null ? 0 : r.marke); (r.punkte || []).forEach(function (pt) { lo = Math.min(lo, pt.v); hi = Math.max(hi, pt.v); }); });
    var tk = ticks(lo, hi, W < 520 ? 3 : 5), x0 = tk[0], x1 = tk[tk.length - 1], pw = W - L - R, xv = function (v) { return L + (v - x0) / (x1 - x0) * pw; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '">'];
    tk.forEach(function (t) { s.push('<line class="gx-netz" x1="' + f1(xv(t)) + '" x2="' + f1(xv(t)) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="gx-ax" x="' + f1(xv(t)) + '" y="' + (H - 6) + '" text-anchor="middle">' + (o.fx || kurz)(t) + '</text>'); });
    if (x0 < 0) s.push('<line x1="' + f1(xv(0)) + '" x2="' + f1(xv(0)) + '" y1="' + T + '" y2="' + (H - B) + '" style="stroke:' + F.linie2 + ';stroke-width:1.2"/>');
    o.rows.forEach(function (r, i) {
      var y = T + i * rh, bh = Math.min(13, rh - 8), yb = y + (rh - bh) / 2, p = 0, n = 0;
      s.push('<g' + tipA(r.tip || '') + '><rect x="0" y="' + y + '" width="' + W + '" height="' + rh + '" class="gx-zeile"/>');
      s.push('<text class="gx-ax2" x="' + (L - 10) + '" y="' + f1(y + rh / 2 + 4) + '" text-anchor="end">' + esc(r.label) + '</text>');
      (r.teile || []).forEach(function (t) { var a, b; if (t.v >= 0) { a = p; p += t.v; b = p; } else { a = n; n += t.v; b = n; } var xa = xv(Math.min(a, b)), xb = xv(Math.max(a, b)); if (xb - xa < 0.3) return; s.push('<rect x="' + f1(xa) + '" y="' + f1(yb) + '" width="' + f1(xb - xa) + '" height="' + bh + '" rx="2" style="fill:' + t.f + '"/>'); });
      if (r.linie) s.push('<line x1="' + f1(xv(r.linie[0])) + '" x2="' + f1(xv(r.linie[1])) + '" y1="' + f1(y + rh / 2) + '" y2="' + f1(y + rh / 2) + '" style="stroke:' + (r.linieF || F.tinte3) + ';stroke-width:2"/>');
      (r.punkte || []).forEach(function (pt) { s.push('<circle cx="' + f1(xv(pt.v)) + '" cy="' + f1(y + rh / 2) + '" r="' + (pt.r || 4.5) + '" style="fill:' + (pt.hohl ? F.karte : pt.f) + ';stroke:' + (pt.hohl ? pt.f : F.karte) + ';stroke-width:2"/>'); });
      if (r.marke != null) s.push('<line x1="' + f1(xv(r.marke)) + '" x2="' + f1(xv(r.marke)) + '" y1="' + f1(yb - 3) + '" y2="' + f1(yb + bh + 3) + '" style="stroke:' + (r.markeF || F.gold) + ';stroke-width:2.4"/>');
      s.push('<text class="gx-wertz" x="' + (W - 2) + '" y="' + f1(y + rh / 2 + 4) + '" text-anchor="end"' + (r.wertF ? ' style="fill:' + r.wertF + '"' : '') + '>' + (r.wert || '') + '</text></g>');
    });
    s.push('</svg>'); return s.join('');
  }
  /* Säulen je Jahr mit Projektionsfeld, Schraffur ab heute+1 und optionaler Linie (wie „Ergebnis aus Vermietung“) */
  var sid = 0;
  function saeulen(o) {
    var W = o.w, H = o.h || 230, L = 56, R = 14, T = 16, B = 26, n = o.x.length, id = 'cp' + (++sid);
    var alle = [0]; o.werte.forEach(function (v) { alle.push(v); }); (o.linie || []).forEach(function (v) { if (v != null) alle.push(v); });
    var tk = ticks(Math.min.apply(null, alle), Math.max.apply(null, alle), 4), y0 = tk[0], y1 = tk[tk.length - 1], ph = H - T - B, pw = W - L - R, dx = pw / n, bw = Math.min(40, dx * 0.62);
    var yv = function (v) { return T + ph - (v - y0) / (y1 - y0) * ph; };
    var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '"><defs><pattern id="' + id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" style="stroke:rgba(255,255,255,.55);stroke-width:2"/></pattern></defs>'];
    var pi = o.projAb != null ? o.x.indexOf(o.projAb) : -1;
    if (pi >= 0) s.push('<rect x="' + f1(L + dx * pi) + '" y="' + T + '" width="' + f1(pw - dx * pi) + '" height="' + ph + '" style="fill:var(--gx-flaeche,var(--flaeche))"/>');
    tk.forEach(function (t) { s.push('<line class="gx-netz" x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(t)) + '" y2="' + f1(yv(t)) + '"/><text class="gx-ax" x="' + (L - 8) + '" y="' + f1(yv(t) + 4) + '" text-anchor="end">' + kurz(t) + '</text>'); });
    if (y0 < 0) s.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + f1(yv(0)) + '" y2="' + f1(yv(0)) + '" style="stroke:' + F.linie2 + ';stroke-width:1.2"/>');
    var jede = Math.ceil(n / Math.max(1, Math.floor(pw / 46)));
    o.x.forEach(function (x, i) {
      var v = o.werte[i], cx = L + dx * i + dx / 2, ya = yv(Math.max(0, v)), yb = yv(Math.min(0, v)), f = typeof o.farbe === 'function' ? o.farbe(v, i) : o.farbe;
      if (v) { s.push('<rect x="' + f1(cx - bw / 2) + '" y="' + f1(ya) + '" width="' + f1(bw) + '" height="' + f1(Math.max(0.6, yb - ya)) + '" rx="2" style="fill:' + f + '"/>'); if (pi >= 0 && i >= pi) s.push('<rect x="' + f1(cx - bw / 2) + '" y="' + f1(ya) + '" width="' + f1(bw) + '" height="' + f1(Math.max(0.6, yb - ya)) + '" rx="2" style="fill:url(#' + id + ')"/>'); }
      if (o.wertOben && v) s.push('<text class="gx-wertz" x="' + f1(cx) + '" y="' + f1(ya - 5) + '" text-anchor="middle">' + kurz(v) + '</text>');
      if (i % jede === 0) s.push('<text class="gx-ax" x="' + f1(cx) + '" y="' + (H - 7) + '" text-anchor="middle"' + (x === o.heute ? ' style="fill:' + F.goldD + ';font-weight:600"' : '') + '>' + esc(String(x)) + '</text>');
    });
    if (o.linie) { var p = ''; o.linie.forEach(function (v, i) { if (v == null) return; var cx = L + dx * i + dx / 2; p += (p ? (o.stufe ? ' H' + f1(cx - dx / 2) + ' V' + f1(yv(v)) + ' H' + f1(cx) : ' L' + f1(cx) + ',' + f1(yv(v))) : 'M' + f1(cx - dx / 2) + ',' + f1(yv(v)) + ' H' + f1(cx)); }); s.push('<path d="' + p + '" style="fill:none;stroke:' + (o.linieF || F.gold) + ';stroke-width:2.2;stroke-linejoin:round"/>'); }
    o.x.forEach(function (x, i) { s.push('<rect x="' + f1(L + dx * i) + '" y="' + T + '" width="' + f1(dx) + '" height="' + ph + '" style="fill:transparent"' + tipA(o.tip ? o.tip(i, x) : '') + '/>'); });
    s.push('</svg>'); return s.join('');
  }
  function seite(teile) { return '<div class="gx-seite">' + teile.map(function (t) { return '<div><span>' + esc(t[0]) + '</span><b' + (t[3] ? ' style="color:' + t[3] + '"' : '') + '>' + t[1] + '</b><small>' + (t[2] || '') + '</small></div>'; }).join('') + '</div>'; }
  /* Linienverlauf über DpGrafiken.verlauf (dieselbe Funktion wie „Verlauf mit Steuern“) */
  function verlauf(d, w, aria) { var h = document.createElement('div'); DpGrafiken.verlauf(h, d, { breite: w, aria: aria }); return h.innerHTML; }

  /* ══ Module (Katalog) ═══════════════════════════════════════════════════ */
  function mod(sel, fn) { K.modul(sel, fn); }
  var MOD = {
    bsz: { t: 'Bestand und Zielbild je Objekt', b: 12, bau: function (s) { mod(s, function () { K.satz('Der Plan bringt ' + K.eurV(ZB.zuwachsNK) + ' Wert nach Kosten und ' + K.eurV(ZB.mieteZ - ZB.mieteB) + ' Miete im Jahr', ['Zielbild']); return K.karte('Bestand und Zielbild je Objekt', 'Sortiert nach Wertzuwachs nach Kosten. Fahr über ein Objekt für die Details' + (K.ziele() ? ' und den Abgleich mit deinen Zielen.' : '.'), K.bszTabelle()); }); } },
    todo: { t: 'Was jetzt zu tun ist', b: 4, bau: function (s) { mod(s, function () { K.satz('Was diesen Monat Aufmerksamkeit braucht'); return K.karte('Was jetzt zu tun ist', 'Aus deinen Zahlen abgeleitet, wichtigstes zuerst.', K.hinweise(8)); }); } },
    gb: { t: 'Gesamtbewertung', b: 12, bau: function (s) { mod(s, function () { K.satz('Investiert ' + K.mio(D.gesamt.gi) + ', dir gehören heute ' + K.mio(D.gesamt.wertKp - D.gesamt.rest), ['Bestand']); return K.gesamtKarte(); }); } },
    ek: { t: 'EK-Rendite je Objekt', b: 7, bau: function (s) { mod(s, function (w) { K.satz('Dein Eigenkapital verdient ' + K.pct(K.ekWert(D.ekrP), 1) + ' im Jahr, ' + K.ekStufe().lang); return K.karte('EK-Rendite je Objekt', 'Vier Stufen je Objekt, die gewählte kräftig. Fahr über ein Objekt für Formel, Zahlen und Hebel.', K.ekJeObjekt(w)); }); } },
    rq: { t: 'Woher die Rendite kommt', b: 5, bau: function (s) { mod(s, function (w) { K.satz('Woher die ' + K.pct(D.ekrP.k4, 1) + ' EK-Rendite kommen'); return K.karte('Woher die Rendite kommt', 'Alle Objekte zusammen, Euro im Jahr, geteilt durch ' + K.mio(D.ekrP.ek) + ' Eigenkapital.', K.renditeQuellen(w) + K.stufenListe(D.ekrP)); }); } },
    ke: { t: 'Was dein Eigenkapital verdient', b: 6, bau: function (s) { B.kapitalEffizienz(s); } },
    cf: { t: 'Cashflow je Objekt', b: 6, bau: function (s) { B.cfVorNach(s); } },
    br: { t: 'Wohin die Miete geht', b: 6, bau: function (s) { B.cfBruecke(s); } },
    vp: { t: 'Vermögensaufbau', b: 6, bau: function (s) { B.vermoegenProjektion(s); } },
    zb: { t: 'Zinsbindung', b: 6, bau: function (s) { B.zinsbindung(s); } },
    fj: { t: 'Anschlussfinanzierung je Jahr', b: 6, bau: function (s) { B.faelligJeJahr(s); } },
    zs: { t: 'Zinsstress beim Anschluss', b: 12, bau: function (s) { B.zinsStress(s); } },
    rm: { t: 'Risikomatrix', b: 7, bau: function (s) { B.risikoMatrix(s); } },
    rd: { t: 'Rendite gegen Tragfähigkeit', b: 5, bau: function (s) { B.renditeDscr(s, { h: 300 }); } },
    st: { t: 'Steuer je Objekt', b: 6, bau: function (s) { B.steuerJeObjekt(s); } },
    mh: { t: 'Miethebel je Objekt', b: 6, bau: function (s) { B.mietHebel(s); } },
    wz: { t: 'Wert heute und im Zielbild', b: 6, bau: function (s) { B.wertZielbild(s); } },
    zbal: { t: 'Deine Ziele', b: 6, bau: function (s) { B.zielBalken(s); } },
    zus: { t: 'Wo die Miete herkommt', b: 5, bau: function (s) { B.zusammensetzung(s, 'ort'); } },
    kac: { t: 'Objektkarten zum Umdrehen', b: 12, bau: function (s) { B.objektKacheln(s, function (a, b) { return (b.score || 0) - (a.score || 0); }); } },
    gal: { t: 'Deine Objekte mit Bild', b: 12, bau: function (s) { mod(s, function () { K.satz('Deine ' + O.length + ' Objekte, sortiert nach EK-Rendite'); return K.karte('Deine Objekte', 'Foto aus dem Objekt, sonst die Lagekarte wie auf dem Bericht.', K.galerie()); }); } },
    tp: { t: 'Steuer nach Halter', b: 5, bau: function (s) { mod(s, function () { var pr = O.filter(function (o) { return o.halter === 'Privat'; });
      var h = seite([['Privat · ' + pr.length + ' Objekte', K.eurV(K.summe(pr, function (o) { return o.steuerWirkung; })), 'Wirkung im Jahr, Ergebnis ' + K.eurV(K.summe(pr, function (o) { return o.ergVV; })), K.summe(pr, function (o) { return o.steuerWirkung; }) >= 0 ? F.gruen : F.rot], ['GmbH · ' + gm.length + ' Objekte', K.eurV(K.summe(gm, function (o) { return o.steuerWirkung; })), 'Ergebnis ' + K.eurV(gmV) + ', Verluste bleiben stehen']]).replace('class="gx-seite"', 'class="gx-seite zwei-sp"');
      h += '<ul class="punkte" style="margin-top:10px"><li>Privat senken die Verluste neuer Objekte die Steuer auf dein Einkommen sofort.</li><li>In der GmbH bleiben Verluste stehen, bis Gewinne kommen.</li></ul>';
      K.satz('Privat entlastet die Steuer, in der GmbH bleiben Verluste stehen', ['Bestand']); return K.karte('Steuer nach Halter', 'Privat gegen GmbH, Wirkung auf den Cashflow im Jahr.', h); }); } },
    sich: { t: 'Sicherheiten je Objekt', b: 8, bau: function (s) { mod(s, function () { var z = K.ziele(), os = O.slice().sort(function (a, b) { return (b.rest / b.wert) - (a.rest / a.wert); });
      K.satz(nO(O.filter(function (o) { return o.rest > o.wert; }).length, 'ist höher beliehen als sein Wertansatz', 'sind höher beliehen als ihr Wertansatz'), ['Bestand']);
      return K.karte('Sicherheiten je Objekt', 'Dunkel die Restschuld, Gold der freie Wert dahinter. Sortiert nach Beleihung' + (z ? ', Strich ist dein Ziel ' + K.pct(z.maxLtv, 0) : '') + '.', '<div class="sich-k">' + os.map(function (o) { var l = o.rest / o.wert * 100;
        return '<div class="sk-o" data-tip="' + K.objTip(o) + '">' + K.bild(o) + '<div><b>' + esc(o.name) + '</b><small>' + K.kurzEur(o.rest) + ' von ' + K.kurzEur(o.wert) + ' · ' + K.pct(l, 0) + '</small><div class="ltv-bar"><i class="' + (l > 100 || (z && l > z.maxLtv) ? 'hoch' : '') + '" style="width:' + Math.min(100, l).toFixed(1) + '%"></i>' + (z ? '<u style="left:' + z.maxLtv + '%"></u>' : '') + '</div></div></div>'; }).join('') + '</div>'); }); } },
    argu: { t: 'Was für die Finanzierung spricht', b: 4, bau: function (s) { mod(s, function () { var z = K.ziele() || D.ziele, gut = O.filter(function (o) { return o.dscr >= z.minDscr; });
      var li = ['<li><span><b>' + gut.length + ' von ' + O.length + ' Objekten</b> tragen den Kapitaldienst mit DSCR über ' + K.d2(z.minDscr) + '. Portfolio ' + K.d2(S.dscr) + '.</span></li>', '<li><span><b>' + K.kurzEur(S.tilgJ) + '</b> Tilgung im Jahr, die Restschuld sinkt planmäßig.</span></li>', '<li><span><b>' + K.kurzEur(ZB.mieteZ - ZB.mieteB) + '</b> Mietpotenzial im Jahr bis zum Zielbild, belegt je Objekt.</span></li>', '<li><span>EK-Rendite <b>' + K.pct(K.ekWert(D.ekrP), 1) + '</b> auf ' + K.mio(D.ekrP.ek) + ' Eigenkapital.</span></li>', '<li class="offen"><span><b>' + neg.length + ' Objekte</b> mit Zuzahlung vor Steuer. Erklärung vorbereiten.</span></li>', '<li class="offen"><span><b>' + bis2030.length + (bis2030.length === 1 ? ' Anschlussfinanzierung' : ' Anschlussfinanzierungen') + '</b> bis Ende 2030 (' + bis2030.map(function (o) { return esc(o.name); }).join(', ') + '), früh anfragen.</span></li>'];
      K.satz('Vier Argumente, zwei offene Punkte'); return K.karte('Was für die Finanzierung spricht', 'Für das Gespräch, aus deinen Zahlen.', '<ul class="argu">' + li.join('') + '</ul>'); }); } },
    streu: { t: 'Wo dein Kapital arbeitet', b: 6, bau: function (s) { mod(s, function (w) { var os = O.filter(function (o) { return o.ekr; });
      K.satz(nO(os.filter(function (o) { return K.ekWert(o.ekr) < 4; }).length, 'verdient unter 4 % auf sein Eigenkapital', 'verdienen unter 4 % auf ihr Eigenkapital'), ['Bestand']);
      return K.karte('Wo dein Kapital arbeitet', 'Je Punkt ein Objekt. Rechts viel Eigenkapital, oben hohe EK-Rendite (' + K.ekStufe().kurz + '). Größe nach Kaltmiete.', K.streu({ w: w, h: 280, aria: 'Eigenkapital gegen EK-Rendite', xText: 'Eigenkapital eingesetzt', fx: function (v) { return K.kurz(v); }, fy: function (v) { return Math.round(v) + ' %'; }, refY: 4,
        punkte: os.map(function (o) { var v = K.ekWert(o.ekr); return { x: o.ek, y: v, r: o.mieteJ, lab: K.kurzName(o, 200), f: v < 0 ? 'var(--rot)' : v >= 8 ? 'var(--gruen)' : 'var(--c-haupt)', tip: K.tipReg(function () { return '<div class="t-bild">' + K.bild(o, 'ob-tip') + '</div>' + K.ekTipHtml(o.ekr, o.name); }) }; }) })); }); } },
    umsch: { t: 'Kapital umschichten?', b: 6, bau: function (s) { mod(s, function () { var os = O.filter(function (o) { return o.ekr; }), med = os.map(function (o) { return o.ek; }).sort(function (a, b) { return a - b; })[Math.floor(os.length / 2)], liste = [];
      os.filter(function (o) { return o.ek >= med && K.ekWert(o.ekr) < 6; }).forEach(function (o) { liste.push({ o: o, t: 'Viel Kapital, wenig Rendite. Refinanzierung oder Verkauf prüfen.' }); });
      os.filter(function (o) { return o.ekr.k1 < 0 && o.ekr.k4 > 0; }).forEach(function (o) { if (!liste.some(function (x) { return x.o === o; })) liste.push({ o: o, t: 'Trägt sich nur über Steuer und Wert, operativ negativ.' }); });
      os.filter(function (o) { return o.ekr.k4 >= 20; }).forEach(function (o) { liste.push({ o: o, t: 'Stark gehebelt, wenig Eigenkapital. Puffer bei Zinsanstieg prüfen.' }); });
      K.satz(nO(liste.length, ', bei dem sich ein zweiter Blick lohnt', ', bei denen sich ein zweiter Blick lohnt').replace(' ,', ','));
      return K.karte('Kapital umschichten?', 'Aus den vier Stufen abgeleitet, nicht als Rat zu verstehen.', '<ul class="umsch">' + liste.slice(0, 7).map(function (x) { var v = K.ekWert(x.o.ekr); return '<li data-tip="' + K.tipReg(function () { return K.ekTipHtml(x.o.ekr, x.o.name); }) + '">' + K.bild(x.o) + '<span><b>' + esc(x.o.name) + '</b><small>' + x.t + '</small></span><span class="w ' + K.ekKlasse(v) + '">' + K.pct(v, 1) + '<small>EK ' + K.kurzEur(x.o.ek) + '</small></span></li>'; }).join('') + '</ul>'); }); } },
    qm: { t: 'Miete je Quadratmeter', b: 6, bau: function (s) { mod(s, function (w) { var os = O.filter(function (o) { return o.qmMiete; }).sort(function (a, b) { return a.qmMiete - b.qmMiete; });
      var rows = os.map(function (o) { var z = o.wfl ? o.mieteZ / 12 / o.wfl : o.qmMiete; return { label: K.kurzName(o, w), a: o.qmMiete, b: Math.max(z, o.qmMiete), tip: K.objTip(o) }; });
      K.satz('Von ' + K.d2(os[0].qmMiete) + ' bis ' + K.d2(os[os.length - 1].qmMiete) + ' € je m², unten liegt der Hebel', ['Bestand']);
      return K.karte('Miete je Quadratmeter', 'Heute gegen Zielbild. Unten die günstigsten Objekte.', K.hantel({ w: w, rows: rows, rh: 19, farbe: function () { return 'var(--c-haupt)'; }, fmtWert: function (v) { return K.d2(v) + ' €'; }, fmtAx: function (v) { return K.d2(v); }, aria: 'Miete je Quadratmeter' })); }); } },
    lead: { t: 'Der Monat in fünf Sätzen', b: 12, bau: function (s) { mod(s, function () { var z = K.ziele();
      K.satz('Der Bestand trägt sich, drei Baustellen bestimmen den Monat');
      return K.karte(MON + ' · ' + O.length + ' Objekte', '', '<ul class="punkte"><li>Nach Steuer bleiben <b>' + K.eurV(S.cfNsJ / 12) + '</b> im Monat. Vor Steuer sind es ' + K.eurV(S.cfVsJ / 12) + '.</li><li>Dein Eigenkapital im Bestand liegt bei <b>' + K.mio(k.ekHeute) + '</b>, eingesetzt hast du ' + K.mio(k.ekEin) + '.</li>' + (z ? '<li><b>' + k.unterZiel.length + ' Objekte</b> liegen unter deinem DSCR-Ziel von ' + K.d2(z.minDscr) + '.</li>' : '') + '<li>Die nächste Zinsbindung endet <b>' + naechste.zb.slice(5, 7) + '/' + naechste.zb.slice(0, 4) + '</b>, ' + esc(naechste.name) + '.</li><li>EK-Rendite <b>' + K.pct(K.ekWert(D.ekrP), 1) + '</b> (' + K.ekStufe().lang + ').</li></ul>'); }); } },

    /* ── Neu in Runde d, im Stil von Objekt-Cockpit › Steuer ─────────────────── */
    treppe: { t: 'Zinsbindungs-Treppe', neu: 1, b: 6, w: 'Wie viel Restschuld in welchem Jahr neu verhandelt wird, und wie sich das aufsummiert.', bau: function (s) { mod(s, function (w) {
      var J = []; for (var y = J0 + 1; y <= J0 + 14; y++) J.push(y);
      var we = J.map(function (y) { return K.summe(O.filter(function (o) { return Math.floor(o.zbJahr) === y; }), function (o) { return o.restZb; }); }), kum = [], a = 0; we.forEach(function (v) { a += v; kum.push(a); });
      var bis35 = a ? kum[J.indexOf(J0 + 9)] / a * 100 : 0;
      K.satz('Bis ' + (J0 + 9) + ' wird ' + Math.round(bis35) + ' % der Restschuld neu verhandelt', ['Projektion']);
      return K.karte('Zinsbindungs-Treppe', 'Säulen: Restschuld, die im Jahr aus der Zinsbindung läuft. Linie: aufsummiert. In den nächsten drei Jahren rot.',
        saeulen({ w: w, h: 230, x: J, werte: we, linie: kum, stufe: true, heute: J0 + 1, farbe: function (v, i) { return J[i] <= J0 + 3 ? F.rot : F.tinte; }, aria: 'Zinsbindungs-Treppe', tip: function (i, y) { var os = O.filter(function (o) { return Math.floor(o.zbJahr) === y; }); return tt(y) + tz('läuft aus', K.eur(we[i])) + tz('aufsummiert', K.eur(kum[i])) + (os.length ? os.map(function (o) { return esc(o.name); }).join(', ') : 'keine Bindung'); } })
        + leg([{ n: 'läuft aus', f: F.tinte }, { n: 'in den nächsten drei Jahren', f: F.rot }, { n: 'aufsummiert', f: F.gold }])); }); } },
    restwert: { t: 'Restschuld und Wert, Portfolio', neu: 1, b: 6, w: 'Wert und Restschuld über zehn Jahre, die Fläche dazwischen ist dein Eigenkapital.', bau: function (s) { mod(s, function (w) {
      var P = D.projektion, X = [], we = [], re = []; for (var j = 0; j <= 10; j++) { X.push(J0 + j); var a = P.filter(function (p) { return p.j <= j; }).pop(), b = P.filter(function (p) { return p.j >= j; })[0], t = b.j === a.j ? 0 : (j - a.j) / (b.j - a.j); we.push(a.wert + (b.wert - a.wert) * t); re.push(a.rest + (b.rest - a.rest) * t); }
      K.satz('In zehn Jahren gehören dir ' + K.mio(we[10] - re[10]) + ' statt ' + K.mio(we[0] - re[0]), ['Projektion']);
      return K.karte('Restschuld und Wert', 'Wertansatz und Restschuld des ganzen Bestands, rechts von heute Projektion der App (dieselbe Rechnung wie die Kachel Netto in der Projektion, gleichmäßig).',
        verlauf({ x: X, heute: J0, baender: [{ ohneRand: true, farbe: GRUEN_F, lo: re, hi: we }], reihen: [{ name: 'Wert', werte: we, farbe: F.tinte, dick: 2.6, punkte: true }, { name: 'Restschuld', werte: re, farbe: F.tinte3, dick: 2, gestrichelt: true }],
          marken: (function () { var c = {}; O.forEach(function (o) { var y = Math.floor(o.zbJahr); if (y > J0 && y <= J0 + 10) c[y] = (c[y] || 0) + 1; }); var b = Object.keys(c).sort(function (x, y) { return c[y] - c[x]; })[0]; return b ? [{ j: Number(b), text: 'die meisten Bindungen enden', farbe: F.goldD, zeile: 0 }] : []; })(),
          tip: function (q, jj) { return tt(jj + (jj > J0 ? ' · Projektion' : '')) + tz('Wert', K.eur(we[q])) + tz('Restschuld', K.eur(re[q])) + 'Eigenkapital <b>' + K.eur(we[q] - re[q]) + '</b>'; },
          legende: [{ n: 'Wert', f: F.tinte }, { n: 'Restschuld', f: F.tinte3 }, { n: 'Eigenkapital', f: GRUEN_F }] }, w, 'Restschuld und Wert') + seite([['Heute ' + J0, K.mio(we[0] - re[0]), 'Eigenkapital im Bestand'], ['In 5 Jahren', K.mio(we[5] - re[5]), 'Restschuld ' + K.mio(re[5])], ['In 10 Jahren', K.mio(we[10] - re[10]), 'Restschuld ' + K.mio(re[10])], ['Tilgung', K.kurzEur(S.tilgJ), 'im Jahr, heute']])); }); } },
    mieteist: { t: 'Miete heute, Plan und Zielbild', neu: 1, b: 6, w: 'Je Objekt die Miete heute gegen den Bestand-Plan und das Zielbild, im Monat.', bau: function (s) { mod(s, function (w) {
      var os = O.slice().sort(function (a, b) { return (b.mieteZ - b.mieteJ) - (a.mieteZ - a.mieteJ); }), unter = O.filter(function (o) { return o.mieteJ < o.mieteB - 1; }).length;
      K.satz(nO(unter, 'liegt heute unter dem Plan', 'liegen heute unter dem Plan') + ', das Zielbild hebt alle zusammen um ' + K.eurV((ZB.mieteZ - S.mieteJ) / 12) + ' im Monat', ['Zielbild']);
      return K.karte('Miete heute, Plan und Zielbild', 'Im Monat. Punkt dunkel heute, Ring der Bestand-Plan, Gold das Zielbild. Sortiert nach dem Abstand zum Zielbild.',
        zeilen({ w: w, rh: 20, aria: 'Miete je Objekt', rows: os.map(function (o) { var h = o.mieteJ / 12, p = o.mieteB / 12, z = o.mieteZ / 12; return { label: K.kurzName(o, w), linie: [Math.min(h, p, z), Math.max(h, p, z)], punkte: [{ v: p, f: F.tinte3, hohl: 1 }, { v: z, f: F.gold }, { v: h, f: F.tinte, r: 4 }], wert: K.eurV(z - h), wertF: z - h > 0 ? F.gruen : F.tinte2, tip: tt(o.name) + tz('heute', K.eur(h)) + tz('Plan Bestand', K.eur(p)) + tz('Zielbild', K.eur(z)) + 'Abstand <b>' + K.eurV(z - h) + '</b>' }; }) })
        + leg([{ n: 'heute', f: F.tinte }, { n: 'Plan Bestand', f: F.karte, rand: 1 }, { n: 'Zielbild', f: F.gold }])); }); } },
    ekstapel: { t: 'EK-Rendite, woraus sie besteht', neu: 1, b: 7, w: 'Je Objekt die Bausteine der EK-Rendite in Prozent vom Eigenkapital: Überschuss, Tilgung, Steuer, Wert.', bau: function (s) { mod(s, function (w) {
      var os = O.filter(function (o) { return o.ekr; }).sort(function (a, b) { return b.ekr.k4 - a.ekr.k4; }), wertMehr = os.filter(function (o) { return (o.ekr.delta_pa || 0) > o.ekr.cf_op + o.ekr.tilg; }).length;
      K.satz('Bei ' + wertMehr + ' von ' + os.length + ' Objekten trägt die Wertentwicklung mehr als Überschuss und Tilgung', ['Bestand']);
      return K.karte('EK-Rendite, woraus sie besteht', 'In Prozent vom Eigenkapital im Jahr. Der Goldstrich ist die Hauptkennzahl (nach Steuer mit Vermögensdelta).',
        zeilen({ w: w, rh: 20, fx: function (v) { return Math.round(v) + ' %'; }, aria: 'EK-Rendite gestapelt', rows: os.map(function (o) { var r = o.ekr, p = function (v) { return v / r.ek * 100; }; return { label: K.kurzName(o, w), teile: [{ v: p(r.cf_op), f: r.cf_op >= 0 ? F.tinte : F.rot }, { v: p(r.tilg), f: F.tinte3 }, { v: p(-r.steuer), f: -r.steuer >= 0 ? F.gruen : 'color-mix(in srgb,#B8625C 55%,transparent)' }, { v: p(r.delta_pa || 0), f: 'color-mix(in srgb,' + F.gold + ' 60%,transparent)' }], marke: r.k4, wert: K.pct(r.k4, 1), wertF: r.k4 < 0 ? F.rot : r.k4 >= 8 ? F.gruen : F.tinte, tip: K.ekTipHtml(r, o.name) }; }) })
        + leg([{ n: 'Überschuss', f: F.tinte }, { n: 'Tilgung', f: F.tinte3 }, { n: 'Steuer', f: F.gruen }, { n: 'Wert', f: 'color-mix(in srgb,' + F.gold + ' 60%,transparent)' }, { n: 'Hauptkennzahl', f: F.gold }])); }); } },
    hebelsens: { t: 'Hebel und Zins', neu: 1, b: 5, w: 'Wie die EK-Rendite des Bestands auf den Darlehenszins reagiert, mit dem Punkt, an dem der Hebel kippt.', bau: function (s) { mod(s, function (w) {
      var P = D.ekrP, h = P.hebel, Dar = K.summe(O.filter(function (o) { return o.ekr; }), function (o) { return o.ekr.darlehen0; }), b4 = P.k4 * P.ek / 100, b1 = P.k1 * P.ek / 100;
      var X = [], y4 = [], y1 = []; for (var z = 2; z <= 8.001; z += 0.5) { var zz = Math.round(z * 10) / 10; X.push(zz); var mehr = (zz - h.fk_zins) / 100 * Dar; y4.push((b4 - mehr) / P.ek * 100); y1.push((b1 - mehr) / P.ek * 100); }
      var null4 = h.fk_zins + b4 / Dar * 100;
      K.satz('Bis ' + K.pct(null4, 1) + ' Zins bleibt dein Eigenkapital im Plus, der Hebel kippt bei ' + K.pct(h.kipp_zins, 1), ['Modell']);
      return K.karte('Hebel und Zins', 'EK-Rendite des Bestands, wenn alle Darlehen zu diesem Zins liefen. Heute im Schnitt ' + K.pct(h.fk_zins, 1) + '. Ab dem Kipppunkt kostet jeder Euro Darlehen mehr, als er bringt.',
        verlauf({ x: X, xText: X.map(function (v) { return v.toLocaleString('de-DE') + ' %'; }), reihen: [{ name: 'Hauptkennzahl', werte: y4, farbe: F.tinte, dick: 2.6, punkte: true }, { name: 'operativ', werte: y1, farbe: F.tinte3, dick: 2, gestrichelt: true }],
          baender: [{ ohneRand: true, farbe: GRUEN_F, lo: y4.map(function (v) { return v > 0 ? 0 : null; }), hi: y4.map(function (v) { return v > 0 ? v : null; }) }, { ohneRand: true, farbe: ROT_F, lo: y4.map(function (v) { return v <= 0 ? v : null; }), hi: y4.map(function (v) { return v <= 0 ? 0 : null; }) }],
          marken: [{ j: Math.round(h.fk_zins * 2) / 2, text: 'heute', farbe: F.goldD, zeile: 0 }, { j: Math.round(h.kipp_zins * 2) / 2, text: 'Hebel kippt', farbe: F.rot, zeile: 1 }],
          tip: function (q, j) { return tt('Zins ' + j.toLocaleString('de-DE') + ' %') + tz('Hauptkennzahl', K.pct(y4[q], 1)) + 'operativ <b>' + K.pct(y1[q], 1) + '</b>'; },
          legende: [{ n: 'Hauptkennzahl', f: F.tinte }, { n: 'operativ', f: F.tinte3 }, { n: 'EK-Rendite positiv', f: GRUEN_F }, { n: 'negativ', f: ROT_F }] }, w, 'Hebel und Zins')); }); } },
    wertdarl: { t: 'Wert gegen Darlehen', neu: 1, b: 6, w: 'Je Objekt die Restschuld als Balken und der Wertansatz als Strich. Rot, wo die Schuld über dem Wert liegt.', bau: function (s) { mod(s, function (w) {
      var os = O.slice().sort(function (a, b) { return b.rest / b.wert - a.rest / a.wert; }), ueber = os.filter(function (o) { return o.rest > o.wert; }).length;
      K.satz(ueber ? nO(ueber, 'hat mehr Schuld als Wert', 'haben mehr Schuld als Wert') : 'Bei jedem Objekt liegt der Wert über der Schuld', ['Bestand']);
      return K.karte('Wert gegen Darlehen', 'Balken Restschuld, Goldstrich Wertansatz (Ertragswert, sonst Kaufpreis). Rechts die Beleihung.',
        zeilen({ w: w, rh: 20, aria: 'Wert gegen Darlehen', rows: os.map(function (o) { var l = o.rest / o.wert * 100; return { label: K.kurzName(o, w), teile: [{ v: o.rest, f: l > 100 ? F.rot : F.tinte }], marke: o.wert, wert: K.pct(l, 0), wertF: l > 100 ? F.rot : l > 90 ? F.goldD : F.tinte, tip: tt(o.name) + tz('Restschuld', K.eur(o.rest)) + tz('Wertansatz', K.eur(o.wert)) + 'Beleihung <b>' + K.pct(l, 0) + '</b>' }; }) })
        + leg([{ n: 'Restschuld', f: F.tinte }, { n: 'über dem Wert', f: F.rot }, { n: 'Wertansatz', f: F.gold }])); }); } },
    kapdienst: { t: 'Wohin der Kapitaldienst geht', neu: 1, b: 6, w: 'Je Objekt Zins und Tilgung im Monat. Tilgung ist Vermögen, Zins geht an die Bank.', bau: function (s) { mod(s, function (w) {
      var os = O.slice().sort(function (a, b) { return b.kapDienst - a.kapDienst; }), tq = S.tilgJ / S.kdJ * 100;
      K.satz('Von ' + K.kurzEur(S.kdJ / 12) + ' Kapitaldienst im Monat werden ' + Math.round(tq) + ' % Vermögen', ['Bestand']);
      return K.karte('Wohin der Kapitaldienst geht', 'Im Monat. Grau der Zins an die Bank, Grün die Tilgung, die dir als Vermögen bleibt.',
        zeilen({ w: w, rh: 20, aria: 'Zins und Tilgung', rows: os.map(function (o) { return { label: K.kurzName(o, w), teile: [{ v: o.zinsJ / 12, f: 'color-mix(in srgb,' + F.tinte + ' 22%,transparent)' }, { v: o.tilgJ / 12, f: F.gruen }], wert: K.eur(o.kapDienst / 12), tip: tt(o.name) + tz('Zins', K.eur(o.zinsJ / 12) + ' / M') + tz('Tilgung', K.eur(o.tilgJ / 12) + ' / M') + 'Tilgungsanteil <b>' + K.pct(o.tilgJ / o.kapDienst * 100, 0) + '</b>' }; }) })
        + leg([{ n: 'Zins an die Bank', f: 'color-mix(in srgb,' + F.tinte + ' 22%,transparent)' }, { n: 'Tilgung = Vermögen', f: F.gruen }])); }); } },
    spread: { t: 'Mietrendite gegen Zins', neu: 1, b: 6, w: 'Je Objekt die Bruttomietrendite gegen den Darlehenszins. Liegt die Rendite darunter, arbeitet das Darlehen gegen dich.', bau: function (s) { mod(s, function (w) {
      var os = O.map(function (o) { return { o: o, r: o.mieteJ / o.kp * 100 }; }).sort(function (a, b) { return (b.r - b.o.zins) - (a.r - a.o.zins); }), unter = os.filter(function (x) { return x.r < x.o.zins; }).length;
      K.satz(unter ? nO(unter, 'bringt brutto weniger, als sein Darlehen kostet', 'bringen brutto weniger, als ihr Darlehen kostet') : 'Jedes Objekt bringt brutto mehr, als sein Darlehen kostet', ['Bestand']);
      return K.karte('Mietrendite gegen Zins', 'Ring der Darlehenszins, Punkt die Bruttomietrendite auf den Kaufpreis. Rechts der Abstand.',
        zeilen({ w: w, rh: 20, fx: function (v) { return v.toLocaleString('de-DE') + ' %'; }, aria: 'Mietrendite gegen Zins', rows: os.map(function (x) { var d = x.r - x.o.zins, f = d >= 0 ? F.gruen : F.rot; return { label: K.kurzName(x.o, w), linie: [Math.min(x.r, x.o.zins), Math.max(x.r, x.o.zins)], linieF: f, punkte: [{ v: x.o.zins, f: F.tinte3, hohl: 1 }, { v: x.r, f: f }], wert: (d >= 0 ? '+' : '−') + Math.abs(d).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %P', wertF: f, tip: tt(x.o.name) + tz('Bruttomietrendite', K.pct(x.r, 1)) + tz('Darlehenszins', K.pct(x.o.zins, 2)) + 'Abstand <b>' + K.pct(d, 1) + '</b>' }; }) })
        + leg([{ n: 'Darlehenszins', f: F.karte, rand: 1 }, { n: 'Rendite über Zins', f: F.gruen }, { n: 'Rendite unter Zins', f: F.rot }])); }); } }
  };

  /* ══ Die Demos: je ein Satz Kennzahlen und Module (= Vorlagen im Baukasten) ══ */
  var DEMOS = {
    '01': { t: 'Asset-Manager-Cockpit', u: 'Alles, was ein Bestandshalter am Montagmorgen sehen will, auf einer Seite.', kz: ['wert', 'ek', 'miete', 'cfvs', 'cfns', 'dscr', 'zb', 'ekr'], m: [['bsz', 8], ['todo', 4], ['cf', 6], ['restwert', 6], ['br', 6], ['zb', 6]] },
    '03': { t: 'Risiko-Radar', u: 'Wo der Bestand verwundbar ist: Tragfähigkeit, Zinsbindung, Energie, Leerstand.', kz: ['unterziel', 'zuzahler', 'zb', 'ltv', 'energie', 'leer', 'ekr'], m: [['rm', 7], ['rd', 5], ['treppe', 6], ['wertdarl', 6], ['zs', 12], ['bsz', 12]] },
    '04': { t: 'Steuer-Jahr', u: 'Was die Steuer aus dem Cashflow macht, je Objekt und je Halter.', kz: ['vuv', 'stsaldo', 'cfvs', 'cfns', 'grenz', 'gmbh', 'ekr'], m: [['st', 6], ['cf', 6], ['br', 7], ['tp', 5], ['bsz', 12]] },
    '05': { t: 'Bank-Mappe', u: 'Der Bestand so, wie ihn eine Bank sieht: Sicherheiten, Beleihung, Kapitaldienst, Anschlussfinanzierung.', kz: ['rest', 'ltv', 'dscr', 'faellig', 'ek', 'ekr'], m: [['sich', 8], ['argu', 4], ['treppe', 6], ['kapdienst', 6], ['wertdarl', 6], ['spread', 6], ['zs', 12], ['bsz', 12]] },
    '06': { t: 'Renditequellen', u: 'Was dein Eigenkapital verdient und woher: Überschuss, Tilgung, Steuer, Wertentwicklung.', kz: ['ekein', 'ueber', 'tilg', 'stw', 'delta', 'ekr'], m: [['rq', 5], ['ekstapel', 7], ['hebelsens', 6], ['spread', 6], ['streu', 6], ['umsch', 6], ['bsz', 12]] },
    '07': { t: 'Objektmatrix', u: 'Jedes Objekt als Karte, per Klick umzudrehen. Für alle, die in Häusern denken, nicht in Summen.', kz: ['wert', 'ek', 'miete', 'cfvs', 'dscr', 'zb', 'ekr'], m: [['kac', 12], ['bsz', 12]] },
    '08': { t: 'Wert und Zielbild', u: 'Was der Bestand heute wert ist und was der Plan daraus macht.', kz: ['ewheute', 'zielnk', 'zuwachs', 'massn', 'rendite', 'mpi', 'ekr'], m: [['bsz', 12], ['wz', 6], ['mh', 6], ['restwert', 7], ['zus', 5]] },
    '09': { t: 'Mieten-Hebel', u: 'Wo Miete liegen bleibt: Potenzial, Leerstand und Mietniveau je Objekt.', kz: ['miete', 'ohnewechsel', 'mitumbau', 'mietezb', 'leer', 'mietniveau', 'ekr'], m: [['mieteist', 7], ['zus', 5], ['mh', 6], ['qm', 6], ['bsz', 12], ['todo', 12]] },
    '10': { t: 'Monatsbericht', u: 'Der Bestand als Bericht zum Lesen, Drucken und Weitergeben. Ruhig, in Sätzen und Zahlen.', kz: ['ek', 'miete', 'cfns', 'dscr', 'ekr'], m: [['lead', 12], ['bsz', 12], ['restwert', 6], ['zb', 6], ['todo', 12]] }
  };
  var NR = Object.keys(DEMOS);

  return { KZ: KZ, MOD: MOD, DEMOS: DEMOS };
};
