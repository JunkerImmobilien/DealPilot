/* grafiken-portfolio.js · v4180 · Portfolio auf einen Blick (Portfolio-Cockpit, Vorschau grafiken_neu)
 *
 * Marcel 23.11.2026 zu v4140: „die 12 von 18 Objekte in Gelb, mit den Mieteinnahmen, Cashflow nach Steuer und dem
 * Steuereffekt je Objekt nebeneinander“, „die größte Anschlussfinanzierung haben wir gar nicht optimiert“, „oben die
 * Kennzahlen und ganz unten wieder Kennzahlen und Gesamtbewertung: kombinieren, oben anzeigen“, „zu viel Text raus“.
 *
 * Ersetzt die Cockpit-Ansicht aus grafiken-neu.js (v4140): eigener Host direkt unter dem Portfolio-Score, der
 * v4140-Host und der Abschnitt „Kennzahlen“ (Kennzahlen p. a. + Gesamtbewertung, data-sek="kennzahlen") werden bei
 * freigeschalteter Vorschau ausgeblendet, nicht entfernt.
 *
 * RECHNET KEINE KENNZAHL NEU. Gelesen wird:
 *   Leiste, Gesamtportfolio   DealPilotDashboard.blickDaten(): aggStats(true) (Miete, Cashflow, Rendite, DSCR, Restschuld),
 *                             Wert heute je Objekt (Marktbericht, sonst Kaufpreis), Gesamtbewertung (_bewSummen), Ø-Zins
 *   je Objekt                 DealPilotDashboard.portfolioPayload() + grafikDaten() (gleiche Reihenfolge)
 *   Zinsbindung               _kpis_bindung_ende, _kpis_rs_bindung je Objekt (gespeichert am Objekt)
 * Eigene Rechnung nur: Summen über eine Auswahl (Filter), Mehrbelastung = Restschuld × Prozentpunkte ÷ 12 und die
 * Projektion des Vermögens (Modell: Wertsteigerung je Objekt, Zins und Rate wie heute, wie v4140).
 */
(function () {
  'use strict';
  var AN = false, _timer = null, _f = { art: 'all', obj: 'all', jahr: 0 };
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }), nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var GOLD = 'var(--wl-c9a84c, #C9A84C)', GRUEN = 'var(--c-greenl, #387652)', ROT = 'var(--c-redl, #965c53)';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zahl(v) { if (v == null || v === '') return null; var n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '')); return isFinite(n) ? n : null; }
  function summe(L, f) { return L.reduce(function (t, x) { var v = f(x); return t + (v == null || !isFinite(v) ? 0 : v); }, 0); }
  function eur(v) { return v == null ? 'keine Angabe' : nf0.format(Math.round(v)) + ' €'; }
  function eurV(v) { return v == null ? 'keine Angabe' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function mio(v) { if (v == null) return 'keine Angabe'; var a = Math.abs(v); return (v < 0 ? '−' : '') + (a >= 1e6 ? nf2.format(a / 1e6) + ' Mio €' : nf0.format(Math.round(a / 1000)) + ' T€'); }
  function heuteJahr() { return new Date().getFullYear(); }

  /* ── Daten ──────────────────────────────────────────────────────── */
  function daten() {
    var D = window.DealPilotDashboard; if (!D || !D.portfolioPayload || !D.blickDaten) return null;
    var B = null, p = null, det = [];
    try { B = D.blickDaten(); p = D.portfolioPayload(); det = D.grafikDaten ? D.grafikDaten() : []; } catch (e) { return null; }
    if (!B || !p || !Array.isArray(p.objekte) || !p.objekte.length) return null;
    var Wk = {}; (B.W || []).forEach(function (x) { if (x.key) Wk[x.key] = x; });
    var Bk = {}; (B.BW || []).forEach(function (x) { if (x.key) Bk[x.key] = x; });
    var rows = p.objekte.map(function (o, i) {
      var d = det[i] || {}, w = Wk[o.id] || {}, bw = Bk[o.id] || {};
      var dar = zahl(o.darlehen_eur) || 0, zinsJ = zahl(o.zins_eur_jahr) || 0, tilgJ = zahl(o.tilgung_eur_jahr) || 0;
      var cfvs = zahl(o.cashflow_vor_steuer_eur_jahr), cfns = zahl(o.cashflow_nach_steuer_eur_jahr);
      return { id: o.id, name: o.name || ('Objekt ' + (i + 1)), art: o.objektart || 'Objekt', kp: zahl(o.kaufpreis_eur) || 0,
        wert: w.wert != null ? w.wert : (zahl(o.kaufpreis_eur) || 0), wertQ: w.quelle || 'kp', rest: zahl(o.restschuld_eur) || 0, darlehen: dar,
        zinsPct: dar ? zinsJ / dar * 100 : null, rateJ: zinsJ + tilgJ, mieteJ: zahl(o.miete_kalt_eur_jahr), cfvs: cfvs, cfns: cfns,
        steuer: cfns != null && cfvs != null ? cfns - cfvs : null, dscr: zahl(o.dscr), bmy: zahl(o.bruttomietrendite_prozent),
        wfl: zahl(o.wohnflaeche_qm), we: zahl(o.wohneinheiten),
        score: zahl(o.investor_deal_score) != null ? zahl(o.investor_deal_score) : zahl(o.dealpilot_score),
        bindEnde: d._kpis_bindung_ende || null, rsBind: zahl(d._kpis_rs_bindung), ew: bw.ew != null ? bw.ew : null, mpi: bw.mpi != null ? bw.mpi : null,
        wertstg: zahl(String(d.wertstg == null ? '' : d.wertstg).replace(',', '.')) };
    });
    return { B: B, rows: rows };
  }
  /* „Bitte prüfen“ wie v4140 (gleiche Finanzierung doppelt, Wohnfläche, Darlehen über Kaufpreis) */
  function hinweise(rows) {
    var H = {}; rows.forEach(function (r) { H[r.id] = []; });
    var dup = {}; rows.forEach(function (r) { if (!r.kp) return; var s = Math.round(r.kp) + '|' + Math.round(r.darlehen) + '|' + Math.round(r.rest); (dup[s] = dup[s] || []).push(r); });
    Object.keys(dup).forEach(function (s) { if (dup[s].length > 1) dup[s].forEach(function (r) { H[r.id].push('gleiche Finanzierung wie ' + dup[s].filter(function (x) { return x !== r; }).map(function (x) { return x.name; }).join(', ')); }); });
    rows.forEach(function (r) {
      if (r.wfl != null && r.wfl / Math.max(1, r.we || 1) > 400) H[r.id].push('Wohnfläche ' + nf0.format(r.wfl) + ' m²');
      if (r.kp && r.darlehen / r.kp > 1.05) H[r.id].push('Darlehen ' + nf1.format(r.darlehen / r.kp * 100) + ' % des Kaufpreises');
    });
    return H;
  }
  /* Modell wie v4140: je Objekt Wert × (1 + Wertsteigerung)^n, Restschuld mit heutigem Zins und heutiger Rate */
  function projektion(rows, bis) {
    var J0 = heuteJahr(), out = [];
    var P = rows.map(function (r) {
      var g = (r.wertstg != null ? r.wertstg : 1.5) / 100, z = (r.zinsPct || 0) / 100, rest = r.rest, a = [];
      for (var j = J0; j <= bis; j++) { a.push({ wert: r.wert * Math.pow(1 + g, j - J0), rest: rest }); rest = Math.max(0, rest * (1 + z) - r.rateJ); }
      return a;
    });
    for (var j = J0, i = 0; j <= bis; j++, i++) out.push({ jahr: j, wert: summe(P, function (p) { return p[i].wert; }), rest: summe(P, function (p) { return p[i].rest; }) });
    out.forEach(function (p) { p.netto = p.wert - p.rest; });
    return out;
  }
  /* Zinsbindung je Jahr mit Mehrbelastung bei +1 und +2 Prozentpunkten (Restschuld × pp ÷ 12) */
  function bindKalender(rows) {
    var J = {}; rows.forEach(function (r) {
      var j = String(r.bindEnde || '').slice(0, 4); if (!/^\d{4}$/.test(j) || r.rsBind == null) return;
      (J[j] = J[j] || { jahr: +j, rest: 0, obs: [] }).rest += r.rsBind; J[j].obs.push(r);
    });
    var L = Object.keys(J).sort().map(function (k) { var x = J[k]; x.p1 = x.rest * 0.01 / 12; x.p2 = x.rest * 0.02 / 12; return x; });
    var max = L.reduce(function (a, x) { return !a || x.rest > a.rest ? x : a; }, null);
    return { L: L, max: max, ohne: rows.filter(function (r) { return !/^\d{4}/.test(String(r.bindEnde || '')) || r.rsBind == null; }) };
  }

  /* ── Zeichnen ──────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-gp-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-gp-stil';
    var B = '#dashboard-main .dp-gp', A = 'body.dp-gp-an #dp-stage .app', E = 'body.dp-gp-an #dp-stage.cp-einfach .app';
    s.textContent = [
      /* v4180 · der v4140-Cockpit-Host und der Abschnitt Kennzahlen (p. a. + Gesamtbewertung) stehen jetzt oben in der Leiste */
      'body.dp-gp-an #dashboard-main [data-dp-gn="cp"],body.dp-gp-an #dashboard-main .cp-sek[data-sek="kennzahlen"]{display:none !important}',
      /* v4240 · Marcel 23.11.2026: „von der Sortierung nicht optimal … wo muss was hin?" Reihenfolge vom Ganzen ins Detail:
         Kopf, Vermögen (Gesamtbewertung + Projektion & Verlauf), Cashflow und Steuer, Finanzierung, Potenzial, Pilot,
         Gesamt-Projektion, Details. Umgestellt wird nur per order (die Abschnitte bleiben, wo dashboard.js sie baut). */
      A + '{display:flex;flex-direction:column}',
      A + ' > *{order:50}',
      A + ' > .sl-head{order:0}' + A + ' > #dp-pscore-hero{order:1}' + A + ' > .cp-ansicht{order:2}' + A + ' > [data-dp-gp="kopf"]{order:3}' + A + ' > #dp-einfach{order:4}',
      A + ' > [data-dp-gp="gb"]{order:5}' + A + ' > .cp-sek[data-sek="projektion"]{order:6}' + A + ' > [data-dp-gp="ob"]{order:7}' + A + ' > .cp-sek[data-sek="steuer"]{order:8}',
      A + ' > [data-dp-gp="bk"]{order:9}' + A + ' > .cp-sek[data-sek="zielbild"]{order:10}' + A + ' > #dp-pp-slot{order:11}' + A + ' > .cp-sek[data-sek="gesamtproj"]{order:12}' + A + ' > [data-dp-gp="det"]{order:13}',
      A + ' .sl > .e{display:none}',   /* die alten Nummern 02 bis 06 passen nach dem Umstellen nicht mehr */
      /* Einfach: Leiste, die Karten (ohne „Heute", das steht in der Leiste), je Objekt und Finanzierung. Genau: alles. */
      E + ' > [data-dp-gp="gb"],' + E + ' > [data-dp-gp="det"]{display:none !important}',
      E + ' .gp-klein{display:none}' + E + ' #dp-einfach .ke2-k:first-child{display:none}',
      B + ' .gp-sl{margin:6px 0 10px}',
      B + '{margin:14px 0 18px;color:var(--c-ptext,#1b1815);font-family:Inter,system-ui,sans-serif}',
      B + ' .gp-kopf{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 16px;margin:0 2px 10px}',
      B + ' .gp-kopf h3{margin:0;font:700 20px/1.2 "Space Grotesk",sans-serif}',
      B + ' .gp-kopf small{display:block;color:var(--c-pmut,#6b6660);font-size:11px;margin-top:2px}',
      B + ' .gp-filter{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12px;color:var(--c-pmut,#6b6660)}',
      B + ' .gp-filter select{font:inherit;color:var(--c-ptext,#1b1815);background:#fff;border:1px solid var(--c-line,#e0dbd3);border-radius:8px;padding:4px 6px;max-width:190px}',
      B + ' .gp-filter input[type=range]{accent-color:' + GOLD + ';width:110px;vertical-align:middle}',
      B + ' .gp-filter b{font:600 12px "JetBrains Mono",monospace;color:var(--c-ptext,#1b1815)}',
      /* Leiste: vier große Werte, darunter eine ruhige Reihe kleiner */
      B + ' .gp-gross{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      B + ' .gp-k{background:color-mix(in srgb,#fff 70%,#FBF6E9);border:1px solid var(--c-line,#e0dbd3);border-radius:10px;padding:10px 12px;min-width:0}',
      B + ' .gp-k.gp-haupt{border-color:color-mix(in srgb,' + GOLD + ' 55%,transparent);background:color-mix(in srgb,' + GOLD + ' 8%,#fff)}',
      B + ' .gp-l{display:block;font:600 10px/1.3 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--c-pmut,#6b6660)}',
      B + ' .gp-v{display:block;font:700 22px/1.2 "Space Grotesk",sans-serif;margin-top:3px;white-space:nowrap}',
      B + ' .gp-s{display:block;font-size:11px;color:var(--c-pmut,#6b6660);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      B + ' .gp-klein{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin-top:8px}',
      B + ' .gp-klein .gp-k{padding:7px 9px}',
      B + ' .gp-klein .gp-v{font-size:15px}',
      B + ' .gp-pos{color:' + GRUEN + '}' + B + ' .gp-neg{color:' + ROT + '}' + B + ' .gp-gold{color:var(--dp-gold-txt,#7d682f)}',
      B + ' .gp-gb{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;margin:8px 2px 0;font-size:12px;color:var(--c-pmut,#6b6660)}',
      B + ' .gp-gb b{color:var(--c-ptext,#1b1815);font-family:"JetBrains Mono",monospace;font-weight:600}',
      /* Karten */
      B + ' .gp-raster{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;margin-top:12px}',
      B + ' .gp-karte{background:#fff;border:1px solid var(--c-line,#e0dbd3);border-radius:14px;padding:14px 16px;min-width:0;position:relative}',
      B + ' .gp-breit{grid-column:1/-1}',
      B + ' .gp-t{font:600 15px/1.3 "Space Grotesk",Inter,sans-serif}',
      B + ' .gp-t em{font-style:normal;color:var(--dp-gold-txt,#7d682f);background:color-mix(in srgb,' + GOLD + ' 22%,transparent);border-radius:5px;padding:0 5px}',
      B + ' .gp-u{font-size:11.5px;color:var(--c-pmut,#6b6660);margin:2px 0 10px}',
      /* je Objekt: drei Spalten Balken */
      B + ' .gp-ob{display:grid;grid-template-columns:minmax(90px,1.1fr) repeat(3,minmax(0,1fr));gap:3px 10px;align-items:center;font-size:12px}',
      B + ' .gp-ob .gp-oh{font:600 10px/1.2 Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--c-pmut,#6b6660);padding-bottom:4px;border-bottom:1px solid var(--c-line,#e0dbd3)}',
      B + ' .gp-ob .gp-on{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      B + ' .gp-bar{position:relative;height:18px}',
      B + ' .gp-bar i{position:absolute;top:3px;height:12px;border-radius:2px}',
      B + ' .gp-bar span{position:absolute;top:0;font:500 10.5px/18px "JetBrains Mono",monospace;white-space:nowrap}',
      B + ' .gp-c{display:grid;grid-template-columns:minmax(0,1fr) 62px;gap:5px;align-items:center}',
      B + ' .gp-w{font:500 10.5px/18px "JetBrains Mono",monospace;white-space:nowrap;text-align:right}',
      B + ' .gp-bar .gp-null{position:absolute;top:0;bottom:0;width:1px;background:var(--c-line,#e0dbd3)}',
      B + ' .gp-ob .gp-sum{font-weight:600;border-top:1px solid var(--c-line,#e0dbd3);padding-top:4px}',
      B + ' .gp-ob .gp-tr{display:contents}',
      B + ' .gp-ob .gp-tr:hover > *{background:color-mix(in srgb,' + GOLD + ' 7%,transparent)}',
      /* Zinsbindung */
      B + ' .gp-bk{display:grid;grid-template-columns:52px minmax(0,1fr) auto auto;gap:4px 10px;align-items:center;font-size:12px}',
      B + ' .gp-bk .gp-oh{font:600 10px/1.2 Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--c-pmut,#6b6660);padding-bottom:4px;border-bottom:1px solid var(--c-line,#e0dbd3)}',
      B + ' .gp-bk .gp-j{font:600 12px "JetBrains Mono",monospace}',
      B + ' .gp-bk .gp-z{font:500 11.5px "JetBrains Mono",monospace;text-align:right;white-space:nowrap}',
      B + ' .gp-bk .gp-max{color:var(--dp-gold-txt,#7d682f)}',
      B + ' .gp-bk small{display:block;color:var(--c-pmut,#6b6660);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      B + ' details.gp-det{margin-top:8px;font-size:12px}',
      B + ' details.gp-det summary{cursor:pointer;color:var(--c-pmut,#6b6660)}',
      B + ' .gp-tab{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}',
      B + ' .gp-tab th{text-align:left;font:600 10px Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--c-pmut,#6b6660);border-bottom:1px solid var(--c-line,#e0dbd3);padding:4px 6px}',
      B + ' .gp-tab td{border-bottom:1px solid color-mix(in srgb,var(--c-line,#e0dbd3) 60%,transparent);padding:4px 6px;font-family:"JetBrains Mono",monospace;font-size:11.5px}',
      B + ' .gp-tab td:first-child{font-family:Inter,sans-serif}',
      B + ' .gp-pill{display:inline-block;margin:2px 4px 0 0;padding:0 6px;border-radius:9px;font-size:10.5px;background:color-mix(in srgb,' + GOLD + ' 20%,transparent);color:var(--dp-gold-txt,#7d682f)}',
      B + ' .gp-pruef li{margin:2px 0}' + B + ' .gp-pruef li.warn{color:var(--dp-gold-txt,#7d682f)}' + B + ' .gp-pruef li.fehler{color:' + ROT + '}',
      B + ' svg text{font-family:"JetBrains Mono",monospace;font-size:10px;fill:var(--c-pmut,#6b6660)}',
      B + ' .gp-tip{position:absolute;pointer-events:none;background:#050505;color:#FDFCFA;font-size:11.5px;line-height:1.45;padding:7px 9px;border-radius:7px;z-index:5;white-space:nowrap;display:none}',
      '@media (max-width:1100px){' + B + ' .gp-klein{grid-template-columns:repeat(4,minmax(0,1fr))}' + B + ' .gp-raster{grid-template-columns:minmax(0,1fr)}}',
      '@media (max-width:640px){' + B + ' .gp-gross{grid-template-columns:repeat(2,minmax(0,1fr))}' + B + ' .gp-klein{grid-template-columns:repeat(2,minmax(0,1fr))}'
        + B + ' .gp-v{font-size:18px}' + B + ' .gp-ob{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)}' + B + ' .gp-ob .gp-on{grid-column:1/-1;margin-top:6px;font-weight:600}' + B + ' .gp-ob .gp-oh:first-child{display:none}'
        + B + ' .gp-bk{grid-template-columns:44px minmax(0,1fr) auto}' + B + ' .gp-bk .gp-p2{display:none}' + B + ' .gp-karte{padding:12px}}',
      '@media (prefers-reduced-motion:no-preference){' + B + ' .gp-bar i{animation:gpWachs .5s ease-out both}@keyframes gpWachs{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function kachel(l, v, s, cls, tip, haupt) {
    return '<div class="gp-k' + (haupt ? ' gp-haupt' : '') + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><span class="gp-l">' + esc(l) + '</span><span class="gp-v' + (cls ? ' ' + cls : '') + '">' + v + '</span>' + (s ? '<span class="gp-s">' + s + '</span>' : '') + '</div>';
  }
  function ton(v) { return v == null ? '' : v >= 0 ? 'gp-pos' : 'gp-neg'; }
  /* Balken in einer Zelle, gemeinsame Skala je Spalte: [lo, hi] */
  function zelle(v, lo, hi, farbe, text) {
    if (v == null) return '<div class="gp-c"><div class="gp-bar"></div><span class="gp-w" style="color:var(--c-pmut,#6b6660)">keine Angabe</span></div>';
    var sp = hi - lo || 1, x0 = (0 - lo) / sp * 100, x1 = (v - lo) / sp * 100, a = Math.min(x0, x1), b = Math.max(x0, x1);
    return '<div class="gp-c"><div class="gp-bar">' + (lo < 0 ? '<b class="gp-null" style="left:' + x0.toFixed(1) + '%"></b>' : '') + '<i style="left:' + a.toFixed(1) + '%;width:' + Math.max(0.6, b - a).toFixed(1) + '%;background:' + farbe + '"></i></div><span class="gp-w">' + text + '</span></div>';
  }
  function bereich(L, f) { var lo = 0, hi = 0; L.forEach(function (r) { var v = f(r); if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); var p = (hi - lo) * 0.03; return [lo < 0 ? lo - p : 0, hi > 0 ? hi + p : 0]; }

  function linie(proj, w, J0, jahr) {
    var h = 210, l = 46, r = 10, t = 10, b = 24, W = w - l - r, H = h - t - b;
    var max = Math.max.apply(null, proj.map(function (p) { return p.wert; })) * 1.05 || 1, n = proj.length;
    var X = function (i) { return l + i / Math.max(1, n - 1) * W; }, Y = function (v) { return t + H - v / max * H; };
    var pfad = function (k) { return proj.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[k]).toFixed(1); }).join(''); };
    var g = '', step = max > 2e7 ? 5e6 : max > 8e6 ? 2e6 : 1e6;
    for (var v = 0; v <= max; v += step) g += '<line x1="' + l + '" x2="' + (l + W) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--c-line,#e0dbd3)"/><text x="' + (l - 6) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end">' + (v / 1e6) + ' Mio</text>';
    proj.forEach(function (p, i) { if ((p.jahr - J0) % 5 === 0) g += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + p.jahr + '</text>'; });
    var ij = jahr - J0, mx = X(ij);
    var area = pfad('netto') + 'L' + X(n - 1).toFixed(1) + ' ' + Y(0).toFixed(1) + 'L' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1) + 'Z';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img" aria-label="Vermögensaufbau, Projektion">' + g
      + '<path d="' + area + '" fill="color-mix(in srgb,' + GOLD + ' 14%,transparent)"/>'
      + '<path d="' + pfad('wert') + '" fill="none" stroke="color-mix(in srgb,currentColor 35%,transparent)" stroke-width="1.5" stroke-dasharray="4 3"/>'
      + '<path d="' + pfad('rest') + '" fill="none" stroke="' + ROT + '" stroke-width="1.5" stroke-dasharray="4 3"/>'
      + '<path d="' + pfad('netto') + '" fill="none" stroke="' + GOLD + '" stroke-width="2.6"/>'
      + (ij >= 0 && ij < n ? '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + t + '" y2="' + (t + H) + '" stroke="' + GOLD + '" stroke-dasharray="2 3"/><circle cx="' + mx.toFixed(1) + '" cy="' + Y(proj[ij].netto).toFixed(1) + '" r="4" fill="' + GOLD + '"/>' : '')
      + '</svg>';
  }

  function zeichnen(host, hosts) {
    var D = daten(); if (!D) return false;
    var alle = D.rows, B = D.B, S = B.S, J0 = heuteJahr(), JE = J0 + 29;
    if (!_f.jahr) _f.jahr = J0 + 10;
    var arten = []; alle.forEach(function (r) { if (arten.indexOf(r.art) < 0) arten.push(r.art); });
    var rows = _f.obj !== 'all' ? alle.filter(function (r) { return r.id === _f.obj; }) : alle.filter(function (r) { return _f.art === 'all' || r.art === _f.art; });
    if (!rows.length) { rows = alle; _f.obj = 'all'; _f.art = 'all'; }
    var gesamt = rows.length === alle.length;
    var scope = _f.obj !== 'all' ? rows[0].name : (gesamt ? 'alle ' + rows.length + ' Objekte' : rows.length + ' × ' + _f.art);
    /* Summen: Gesamtportfolio aus dem Dashboard (dieselben Zahlen wie bisher unten), Auswahl aus den Objektzeilen */
    var Wert = summe(rows, function (r) { return r.wert; }), Rest = gesamt ? S.rest : summe(rows, function (r) { return r.rest; });
    var MJ = gesamt ? S.mieteJ : summe(rows, function (r) { return r.mieteJ; }), CFns = gesamt ? S.cfNsJ : summe(rows, function (r) { return r.cfns; });
    var CFvs = gesamt ? S.cfVsJ : summe(rows, function (r) { return r.cfvs; }), KP = gesamt ? S.kp : summe(rows, function (r) { return r.kp; });
    var brutto = gesamt ? S.brutto : (KP ? MJ / KP * 100 : null);
    var dscr = gesamt ? S.dscr : (rows.length === 1 ? rows[0].dscr : null);
    var proj = projektion(rows, JE), pj = proj[_f.jahr - J0] || proj[proj.length - 1];
    var nMb = rows.filter(function (r) { return r.wertQ === 'mb'; }).length;
    var BS = B.BS || {}, ewS = summe(rows, function (r) { return r.ew; }), kpEw = summe(rows.filter(function (r) { return r.ew != null; }), function (r) { return r.kp; });
    var nEw = rows.filter(function (r) { return r.ew != null; }).length, mpiS = summe(rows, function (r) { return r.mpi; }), kpMpi = summe(rows.filter(function (r) { return r.mpi != null; }), function (r) { return r.kp; });
    var nMpi = rows.filter(function (r) { return r.mpi != null; }).length;
    var opt = function (v, t, an) { return '<option value="' + esc(v) + '"' + (an ? ' selected' : '') + '>' + esc(t) + '</option>'; };

    var kopf = '<div class="gp-kopf"><div><h3>Portfolio auf einen Blick</h3><small>' + esc(scope) + ' · Werte heute' + '</small></div><div class="gp-filter">'
      + '<label>Art <select data-gp-f="art">' + opt('all', 'alle', _f.art === 'all') + arten.map(function (a) { return opt(a, a, _f.art === a); }).join('') + '</select></label>'
      + '<label>Objekt <select data-gp-f="obj">' + opt('all', 'alle', _f.obj === 'all') + alle.filter(function (r) { return _f.art === 'all' || r.art === _f.art; }).map(function (r) { return opt(r.id, r.name, _f.obj === r.id); }).join('') + '</select></label>'
      + '<label>Projektion bis <input type="range" data-gp-f="jahr" min="' + (J0 + 1) + '" max="' + JE + '" value="' + _f.jahr + '"> <b>' + _f.jahr + '</b></label></div></div>';

    var gross = '<div class="gp-gross">'
      + kachel('Vermögen netto', mio(Wert - Rest), 'Wert ' + mio(Wert) + ' minus Restschuld', '', 'Wert heute je Objekt: letzter Marktbericht, sonst Kaufpreis (' + nMb + ' von ' + rows.length + ' mit Marktbericht). Minus Restschuld heute.', true)
      + kachel('Cashflow nach Steuer', eurV(CFns / 12), 'im Monat · ' + eurV(CFns) + ' im Jahr', ton(CFns), 'Summe der Objekte nach Zins, Tilgung, Bewirtschaftung und Steuer. Vor Steuer ' + eurV(CFvs) + ' im Jahr.')
      + kachel('Mieteinnahmen', eur(MJ / 12), 'im Monat · Rendite ' + (brutto != null ? nf2.format(brutto) + ' %' : 'keine Angabe'), '', 'Nettokaltmiete plus Zusatzeinnahmen. Rendite brutto = Jahresmiete zu Kaufpreisen.')
      + kachel('Netto ' + _f.jahr, mio(pj.netto), 'Projektion · heute ' + mio(proj[0].netto), 'gp-gold', 'Modell: Wertsteigerung je Objekt (sonst 1,5 % im Jahr), Zins und Rate wie heute. Keine Garantie.')
      + '</div>';
    var ltv = Wert ? Rest / Wert * 100 : null;
    var klein = '<div class="gp-klein">'
      + kachel('Restschuld', mio(Rest), '', '', 'Offener Teil aller Darlehen heute.')
      + kachel('LTV', ltv != null ? nf1.format(ltv) + ' %' : 'keine Angabe', '', ltv == null ? '' : ltv <= 80 ? 'gp-pos' : 'gp-neg', 'Restschuld zu Wert heute.')
      + kachel('DSCR', dscr != null ? nf2.format(dscr) : 'keine Angabe', '', dscr == null ? '' : dscr >= 1 ? 'gp-pos' : 'gp-neg', gesamt ? 'Jahresmiete zu Kapitaldienst über alle Objekte, wie bisher in den Kennzahlen.' : 'Für eine Auswahl nur je Objekt.')
      + kachel('Ø-Zins', B.avgZins != null && gesamt ? nf2.format(B.avgZins) + ' %' : (rows.length === 1 && rows[0].zinsPct != null ? nf2.format(rows[0].zinsPct) + ' %' : 'keine Angabe'), '', '', 'Nach Restschuld gewichtet.')
      + kachel('Cashflow vor St.', eurV(CFvs / 12), '', ton(CFvs), 'Im Monat. ' + eurV(CFvs) + ' im Jahr.')
      + kachel('EK-Rendite', gesamt && S.ek > 100 ? nf1.format(S.cfNsJ / S.ek * 100) + ' %' : 'keine Angabe', '', '', 'Cashflow nach Steuer zu eingesetztem Eigenkapital (' + mio(S.ek) + ').')
      + kachel('Ertragswert', nEw ? (kpEw ? (ewS / kpEw >= 1 ? '+' : '−') + nf1.format(Math.abs(ewS / kpEw * 100 - 100)) + ' %' : '') : 'keine Angabe', nEw ? nEw + ' von ' + rows.length + ' Obj.' : '', nEw && kpEw ? (ewS >= kpEw ? 'gp-pos' : 'gp-neg') : '', 'Gesamtbewertung: Summe Ertragswerte ' + mio(ewS) + ' gegen die Kaufpreise derselben Objekte ' + mio(kpEw) + '.')
      + kachel('Marktpreis', nMpi ? (kpMpi ? (mpiS / kpMpi >= 1 ? '+' : '−') + nf1.format(Math.abs(mpiS / kpMpi * 100 - 100)) + ' %' : '') : 'keine Angabe', nMpi ? nMpi + ' von ' + rows.length + ' Obj.' : '', nMpi && kpMpi ? (mpiS >= kpMpi ? 'gp-pos' : 'gp-neg') : '', 'Gesamtbewertung: Marktpreisindikation ' + mio(mpiS) + ' gegen die Kaufpreise derselben Objekte ' + mio(kpMpi) + '.')
      + '</div>';
    var ohneEw = rows.filter(function (r) { return r.ew == null; });
    var gb = false ? '<div class="gp-gb"><span>Investiert <b>' + mio(S.gi) + '</b></span><span>Darlehen <b>' + mio(S.darl) + '</b></span><span>Eigenkapital eingesetzt <b>' + mio(S.ek) + '</b></span>'
      + (ohneEw.length ? '<span title="' + esc(ohneEw.map(function (r) { return r.name; }).join(', ')) + '">ohne Ertragswert: ' + ohneEw.length + '</span>' : '') + '</div>' : '';

    /* je Objekt: Miete, Cashflow nach Steuer, Steuereffekt */
    var obR = rows.slice().sort(function (a, b) { return (b.cfns == null ? -1e12 : b.cfns) - (a.cfns == null ? -1e12 : a.cfns); });
    var mit = obR.filter(function (r) { return r.cfns != null; }), plus = mit.filter(function (r) { return r.cfns > 0; }).length;
    var bM = bereich(obR, function (r) { return r.mieteJ; }), bC = bereich(obR, function (r) { return r.cfns; }), bS = bereich(obR, function (r) { return r.steuer; });
    var stS = summe(obR, function (r) { return r.steuer; });
    var ob = '<div class="gp-ob" role="table" aria-label="Je Objekt: Miete, Cashflow nach Steuer, Steuereffekt"><div class="gp-oh">Objekt</div><div class="gp-oh">Miete im Jahr</div><div class="gp-oh">Cashflow n. St.</div><div class="gp-oh">Steuereffekt</div>'
      + obR.map(function (r, i) {
        return '<div class="gp-tr" data-gp-i="' + i + '"><div class="gp-on" title="' + esc(r.name) + '">' + esc(r.name) + '</div>'
          + zelle(r.mieteJ, bM[0], bM[1], 'color-mix(in srgb,' + GOLD + ' 55%,transparent)', r.mieteJ != null ? nf0.format(Math.round(r.mieteJ / 100) / 10) + ' T€' : '')
          + zelle(r.cfns, bC[0], bC[1], r.cfns >= 0 ? GRUEN : ROT, eurV(r.cfns))
          + zelle(r.steuer, bS[0], bS[1], r.steuer >= 0 ? GRUEN : ROT, eurV(r.steuer)) + '</div>';
      }).join('')
      + (obR.length > 1 ? '<div class="gp-on gp-sum">Summe</div><div class="gp-sum">' + eur(summe(obR, function (r) { return r.mieteJ; })) + '</div><div class="gp-sum ' + ton(CFns) + '">' + eurV(summe(obR, function (r) { return r.cfns; })) + '</div><div class="gp-sum ' + ton(stS) + '">' + eurV(stS) + '</div>' : '')
      + '</div>';
    var fehlCf = rows.filter(function (r) { return r.cfns == null; });
    var obT = rows.length > 1 ? '<em>' + plus + ' von ' + rows.length + '</em> Objekten bringen nach Steuer Geld' : esc(rows[0].name);
    var obU = 'Je Objekt im Jahr · die Steuer ' + (stS >= 0 ? 'entlastet' : 'kostet') + ' zusammen ' + eur(Math.abs(stS)) + (fehlCf.length ? ' · ohne Cashflow: ' + esc(fehlCf.map(function (r) { return r.name; }).join(', ')) : '');

    /* Zinsbindung */
    var K = bindKalender(rows), kMax = K.L.reduce(function (m, x) { return Math.max(m, x.rest); }, 0) || 1;
    var bald = K.L.filter(function (x) { return x.jahr - J0 <= 3; }), baldS = summe(bald, function (x) { return x.rest; });
    var bk = K.L.length ? '<div class="gp-bk"><div class="gp-oh">Jahr</div><div class="gp-oh">Restschuld zum Bindungsende</div><div class="gp-oh" style="text-align:right">+1 Pkt.</div><div class="gp-oh gp-p2" style="text-align:right">+2 Pkt.</div>'
      + K.L.map(function (x) {
        var istMax = x === K.max;
        return '<div class="gp-j' + (istMax ? ' gp-max' : '') + '">' + x.jahr + '</div><div><div class="gp-bar"><i style="left:0;width:' + (x.rest / kMax * 78).toFixed(1) + '%;background:' + (istMax ? GOLD : 'color-mix(in srgb,currentColor 22%,transparent)') + '"></i><span style="left:calc(' + (x.rest / kMax * 78).toFixed(1) + '% + 4px)">' + mio(x.rest) + '</span></div>'
          + '<small title="' + esc(x.obs.map(function (r) { return r.name; }).join(', ')) + '">' + esc(x.obs.length === 1 ? x.obs[0].name : x.obs.length + ' Objekte: ' + x.obs.map(function (r) { return r.name; }).join(', ')) + '</small></div>'
          + '<div class="gp-z' + (istMax ? ' gp-max' : '') + '">+' + nf0.format(Math.round(x.p1)) + ' €</div><div class="gp-z gp-p2' + (istMax ? ' gp-max' : '') + '">+' + nf0.format(Math.round(x.p2)) + ' €</div>';
      }).join('') + '</div>' : '<p class="gp-u">Keine Zinsbindung eingetragen.</p>';
    var bkT = K.max ? 'Größte Anschlussfinanzierung <em>' + K.max.jahr + '</em> mit ' + mio(K.max.rest) : 'Zinsbindung';
    var bkU = K.max ? 'Mehrbelastung im Monat bei 1 oder 2 Prozentpunkten mehr Zins · ' + K.max.jahr + ': +' + nf0.format(Math.round(K.max.p1)) + ' € bzw. +' + nf0.format(Math.round(K.max.p2)) + ' €'
      + (bald.length ? ' · in den nächsten 3 Jahren ' + mio(baldS) : '') : '';
    var bkOhne = K.ohne.length ? '<p class="gp-u" style="margin:8px 0 0">Ohne Zinsbindung: ' + esc(K.ohne.map(function (r) { return r.name; }).join(', ')) + '</p>' : '';


    /* Objekte im Einzelnen (eingeklappt) und Rechenprüfung */
    var H = hinweise(alle), nH = 0; rows.forEach(function (r) { nH += (H[r.id] || []).length; });
    var tab = '<details class="gp-det"><summary>Objekte im Einzelnen' + (nH ? ' · ' + nH + ' Angabe' + (nH === 1 ? '' : 'n') + ' bitte prüfen' : '') + '</summary><div style="overflow-x:auto"><table class="gp-tab"><thead><tr><th>Objekt</th><th>Wert</th><th>Restschuld</th><th>LTV</th><th>Rendite</th><th>DSCR</th><th>Bindung bis</th><th>Score</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var h = H[r.id] || [];
        return '<tr><td>' + esc(r.name) + (h.length ? '<br>' + h.map(function (t) { return '<span class="gp-pill">Bitte prüfen: ' + esc(t) + '</span>'; }).join('') : '') + '</td><td>' + mio(r.wert) + (r.wertQ === 'mb' ? '' : ' <small title="kein Marktbericht, Kaufpreis">KP</small>') + '</td><td>' + mio(r.rest) + '</td>'
          + '<td>' + (r.wert ? nf1.format(r.rest / r.wert * 100) + ' %' : '') + '</td><td>' + (r.bmy != null ? nf2.format(r.bmy) + ' %' : '') + '</td><td' + (r.dscr != null && r.dscr < 1 ? ' class="gp-neg"' : '') + '>' + (r.dscr != null ? nf2.format(r.dscr) : '') + '</td>'
          + '<td>' + (r.bindEnde ? esc(String(r.bindEnde).slice(0, 7).split('-').reverse().join('/')) : '') + '</td><td>' + (r.score != null ? Math.round(r.score) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
    var P = [], ok = function (b, t, art) { P.push({ ok: b, t: t, art: art || 'fehler' }); };
    ok(Math.abs(summe(rows, function (r) { return r.cfns; }) - CFns) < 1, 'Cashflow nach Steuer je Objekt ergibt die Summe ' + eurV(CFns));
    ok(Math.abs(summe(rows, function (r) { return r.mieteJ; }) - MJ) < 1, 'Miete je Objekt ergibt die Summe ' + eur(MJ));
    ok(Math.abs(stS - (CFns - CFvs)) < 1, 'Steuereffekte je Objekt ergeben Cashflow nach minus vor Steuer (' + eurV(CFns - CFvs) + ')');
    ok(Math.abs(proj[0].netto - (Wert - Rest)) < 1, 'Projektion ' + J0 + ' gleich Vermögen netto heute');
    var bindR = summe(rows.filter(function (r) { return /^\d{4}/.test(String(r.bindEnde || '')) && r.rsBind != null; }), function (r) { return r.rsBind; });
    ok(Math.abs(summe(K.L, function (x) { return x.rest; }) - bindR) < 1, 'Zinsbindungs-Kalender gleich Summe der Restschuld zum Bindungsende');
    if (gesamt) ok(Math.abs(Wert - summe(B.W || [], function (x) { return x.wert; })) < 1, 'Wert heute gleich Summe der Kennzahlen (' + mio(Wert) + ')');
    var nOk = P.filter(function (x) { return x.ok; }).length;
    var pruef = '<details class="gp-det"><summary>Rechenprüfung: ' + nOk + ' von ' + P.length + ' stimmen' + (B.mbLaedt ? ' · Marktberichte laden noch' : '') + '</summary><ul class="gp-pruef">' + P.map(function (x) { return '<li class="' + (x.ok ? '' : x.art) + '">' + (x.ok ? '✓ ' : '✗ ') + esc(x.t) + '</li>'; }).join('') + '</ul></details>';

    /* v4240 · Teile statt eines Blocks: jeder Teil steht an seinem Platz (lauf). Der Vermögensaufbau entfällt hier,
       er steht in „Projektion & Verlauf" (Eigenkapital-Entwicklung). */
    var T = {
      kopf: kopf + gross + klein,
      ob: sl('Cashflow und Steuer', 'je Objekt im Jahr') + '<div class="gp-karte" data-gp-k="ob"><div class="gp-t">' + obT + '</div><div class="gp-u">' + obU + '</div>' + ob + '</div>',
      bk: sl('Finanzierung', 'Zinsbindung und Anschluss') + '<div class="gp-karte" data-gp-k="bk"><div class="gp-t">' + bkT + '</div><div class="gp-u">' + bkU + '</div>' + bk + bkOhne + '</div>',
      det: sl('Details', 'je Objekt und Rechenprüfung') + '<div class="gp-karte">' + tab + pruef + '</div>'
    };
    if (hosts) Object.keys(T).forEach(function (k) { if (hosts[k]) hosts[k].innerHTML = T[k]; });
    else host.innerHTML = T.kopf + T.ob + T.bk + T.det;
    (hosts ? hosts.kopf : host).setAttribute('data-gp-pruef', nOk + '/' + P.length);
    return true;
  }
  function sl(t, tag) { return '<div class="sl gp-sl"><h2>' + esc(t) + '</h2><span class="tag">' + esc(tag) + '</span><span class="rule"></span></div>'; }

  /* ── Lauf ──────────────────────────────────────────────────────── */
  function lauf() {
    if (!AN) return;
    var m = document.getElementById('dashboard-main'); if (!m || m.style.display === 'none' || m.getAttribute('data-dp-built') !== '1') return;
    var hero = document.getElementById('dp-pscore-hero'); if (!hero) return;
    var app = hero.parentNode;
    var alt = app.querySelector(':scope > [data-dp-gp="1"]'); if (alt) alt.parentNode.removeChild(alt);   /* v4180-Host */
    var hosts = {};
    ['kopf', 'gb', 'ob', 'bk', 'det'].forEach(function (k) {
      var h = app.querySelector(':scope > [data-dp-gp="' + k + '"]');
      if (!h) { h = document.createElement('div'); h.setAttribute('data-dp-gp', k); h.className = 'dp-gp dp-gp-' + k; app.appendChild(h); }
      hosts[k] = h;
    });
    var host = hosts.kopf;
    if (!host._gpOn) {
      host._gpOn = true;
      host.addEventListener('change', function (ev) { var t = ev.target, f = t && t.getAttribute && t.getAttribute('data-gp-f'); if (!f) return; _f[f] = f === 'jahr' ? +t.value : t.value; if (f === 'art') _f.obj = 'all'; host.removeAttribute('data-gp-sig'); lauf(); });
      host.addEventListener('input', function (ev) { var t = ev.target; if (t && t.getAttribute && t.getAttribute('data-gp-f') === 'jahr') { _f.jahr = +t.value; host.removeAttribute('data-gp-sig'); lauf(); } });
    }
    /* Vermögen: Überschrift und die Gesamtbewertung aus dashboard.js (Investiert, Bilanz heute, nach Bewertung) hierher */
    if (!hosts.gb.querySelector('.gp-sl')) hosts.gb.insertAdjacentHTML('afterbegin', sl('Vermögen', 'investiert, dir gehört heute, Wert'));
    var gbe = document.getElementById('dp-gesamtbew'); if (gbe && gbe.parentNode !== hosts.gb) hosts.gb.appendChild(gbe);
    /* Steuer über alle Objekte steht jetzt unter „Cashflow und Steuer" als Detail: einmalig zugeklappt */
    try { if (!localStorage.getItem('dp_gp_steuer_zu')) { var stk = app.querySelector(':scope > .cp-sek[data-sek="steuer"]'); if (stk) { stk.classList.add('cp-zu'); var z = {}; try { z = JSON.parse(localStorage.getItem('dp_cockpit_zu') || '{}') || {}; } catch (e) {} z.steuer = 1; localStorage.setItem('dp_cockpit_zu', JSON.stringify(z)); localStorage.setItem('dp_gp_steuer_zu', '1'); } } } catch (e) {}
    var D = null; try { D = window.DealPilotDashboard.blickDaten(); } catch (e) { D = null; }
    var sig = D ? JSON.stringify([D.n, Math.round(D.S.cfNsJ), Math.round(D.S.rest), (D.W || []).map(function (x) { return Math.round(x.wert); }), _f, Math.round(host.getBoundingClientRect().width / 40)]) : '';
    if (sig && host.getAttribute('data-gp-sig') === sig) return;
    if (zeichnen(host, hosts)) { host.setAttribute('data-gp-sig', sig); document.body.classList.add('dp-gp-an'); }
  }
  function spaeter() { if (_timer) clearTimeout(_timer); _timer = setTimeout(function () { try { lauf(); } catch (e) { try { console.warn('[grafiken-portfolio]', e); } catch (x) {} } }, 260); }
  function start() {
    if (AN) return; AN = true; stil();
    try { new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t && t.closest && t.closest('[data-dp-gp],[data-dp-gn]')) continue; spaeter(); return; }
    }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    window.addEventListener('resize', spaeter);
    spaeter();
  }
  function pruefeFreigabe() { try { if (window.DpVorschau) window.DpVorschau.frei('grafiken_neu').then(function (an) { if (an) start(); }); } catch (e) {} }
  window.DpGrafikenPortfolio = { zeichnen: function (host) { stil(); return zeichnen(host); }, an: function () { return AN; }, neu: function () { var h = document.querySelector('[data-dp-gp="kopf"]'); if (h) h.removeAttribute('data-gp-sig'); lauf(); },
    _test: { projektion: projektion, bindKalender: bindKalender, hinweise: hinweise, bereich: bereich } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pruefeFreigabe); else pruefeFreigabe();
  window.addEventListener('dp:vorschau', pruefeFreigabe);
  window.addEventListener('dp:plan-ready', function () { setTimeout(pruefeFreigabe, 300); });
})();
