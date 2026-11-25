/* grafiken-portfolio.js · v4180 (v4640 Baukasten, Farbe nach Grafik-Stil) · Portfolio auf einen Blick (Portfolio-Cockpit, Vorschau grafiken_neu)
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
  var GOLD = 'var(--wl-c9a84c, #C9A84C)', GRUEN = '#3FA56C', ROT = '#B8625C';   /* v4280 · dieselben Statusfarben wie Reiter Bewertung und Pilot-Analyse (vorher --c-greenl/--c-redl, dunkler) */
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
        wfl: zahl(o.wohnflaeche_qm), we: zahl(o.wohneinheiten), ekr4: (function () { try { return D.ekr4Obj ? D.ekr4Obj(d) : null; } catch (e) { return null; } })(),   /* v4610 */
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
      E + ' .gp-klein{display:none}' + E + ' #dp-einfach .ke2 > .ke2-k:first-child{display:none}',
      B + ' .gp-sl{margin:6px 0 10px}',
      B + '{margin:14px 0 18px;color:var(--c-ptext,#2A2727);font-family:Inter,system-ui,sans-serif;--c-ptext:#2A2727;--c-pmut:color-mix(in srgb,#2A2727 62%,transparent);--c-line:color-mix(in srgb,#2A2727 10%,transparent)}',   /* v4280 · Farbschema Reiter Bewertung */
      B + ' .gp-kopf{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 16px;margin:0 2px 10px}',
      B + ' .gp-kopf h3{margin:0;font:700 20px/1.2 "Space Grotesk",sans-serif}',
      B + ' .gp-kopf small{display:block;color:var(--c-pmut,#6b6660);font-size:11px;margin-top:2px}',
      B + ' .gp-filter{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12px;color:var(--c-pmut,#6b6660)}',
      B + ' .gp-filter select{font:inherit;color:var(--c-ptext,#1b1815);background:#fff;border:1px solid var(--c-line,#e0dbd3);border-radius:8px;padding:4px 6px;max-width:190px}',
      B + ' .gp-filter input[type=range]{accent-color:' + GOLD + ';width:110px;vertical-align:middle}',
      B + ' .gp-filter b{font:600 12px "JetBrains Mono",monospace;color:var(--c-ptext,#1b1815)}',
      /* Leiste: vier große Werte, darunter eine ruhige Reihe kleiner */
      B + ' .gp-gross{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      B + ' .gp-k{background:var(--surface,#F8F6F1);border:1px solid var(--c-line,#e0dbd3);border-radius:10px;padding:10px 12px;min-width:0}',
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
      B + ' .gp-karte{background:var(--surface,#F8F6F1);border:1px solid var(--c-line,#e0dbd3);border-radius:14px;padding:18px 20px 16px;min-width:0;position:relative}',
      B + ' .gp-breit{grid-column:1/-1}',
      B + ' .gp-t{font:600 15px/1.3 "Space Grotesk",Inter,sans-serif}',
      B + ' .gp-t em{font-style:normal;color:var(--dp-gold-txt,#7d682f);background:color-mix(in srgb,' + GOLD + ' 22%,transparent);border-radius:5px;padding:0 5px}',
      B + ' .gp-u{font-size:11.5px;color:var(--c-pmut,#6b6660);margin:2px 0 10px}',
      /* je Objekt: drei Spalten Balken */
      B + ' .gp-ob-w{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      B + ' .gp-ob{display:grid;grid-template-columns:minmax(110px,1.1fr) repeat(4,minmax(0,1fr));gap:3px 10px;align-items:center;font-size:12px;min-width:760px}',   /* v4480 · fünf Spalten, schmal waagerecht scrollen */
      B + ' .gp-ob .gp-on{position:sticky;left:0;z-index:1;background:var(--gx-karte,#fff)}',
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
        + B + ' .gp-v{font-size:18px}' + B + ' .gp-ob{min-width:640px;grid-template-columns:96px repeat(4,minmax(0,1fr))}'
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
      + '<label>Projektion bis <input type="range" data-gp-f="jahr" min="' + (J0 + 1) + '" max="' + JE + '" value="' + _f.jahr + '"> <b>' + _f.jahr + '</b></label>'
      + '<button type="button" class="gp-zahn" data-gp-a="ansicht" title="Module wählen, sortieren und Vorlagen" aria-haspopup="dialog">⚙ Ansicht anpassen</button></div></div>';   /* v4260 */

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
      + (function () {   /* v4610 · Hauptkennzahl nach Steuer mit Vermögensdelta, EK-gewichtet über die gewählten Objekte */
        var E = window.DpEkRendite ? DpEkRendite.portfolio(rows.map(function (r) { return r.ekr4; })) : null;
        if (!E) return kachel('EK-Rendite', 'keine Angabe', '', '', 'Kein Eigenkapital oder kein Cashflow gespeichert.');
        var p = function (x) { return nf1.format(x) + ' %'; };
        if (window.DpEkrUi) return DpEkrUi.einbauen(kachel('EK-Rendite', p(E.haupt), 'nach Steuer mit Vermögensdelta', E.haupt >= 0 ? 'gp-pos' : 'gp-neg', ''), E, 'gp-v', 'gp-s');   /* v4620 */
        return kachel('EK-Rendite', p(E.haupt), 'nach Steuer mit Vermögensdelta', E.haupt >= 0 ? 'gp-pos' : 'gp-neg',
          'EK-Rendite in vier Stufen, nach Eigenkapital gewichtet (' + mio(E.ek) + '). 1 Operativ ' + p(E.k1) + '. 2 Nach Steuer ' + p(E.k2) + '. 3 Vor Steuer mit Vermögensdelta ' + p(E.k3) + '. 4 Nach Steuer mit Vermögensdelta ' + p(E.k4) + ', Hauptkennzahl. Vermögensdelta = Bewertung minus Darlehen bei Kauf minus Eigenkapital, je Haltejahr.');
      })()
      + kachel('Ertragswert', nEw ? (kpEw ? (ewS / kpEw >= 1 ? '+' : '−') + nf1.format(Math.abs(ewS / kpEw * 100 - 100)) + ' %' : '') : 'keine Angabe', nEw ? nEw + ' von ' + rows.length + ' Obj.' : '', nEw && kpEw ? (ewS >= kpEw ? 'gp-pos' : 'gp-neg') : '', 'Gesamtbewertung: Summe Ertragswerte ' + mio(ewS) + ' gegen die Kaufpreise derselben Objekte ' + mio(kpEw) + '.')
      + kachel('Marktpreis', nMpi ? (kpMpi ? (mpiS / kpMpi >= 1 ? '+' : '−') + nf1.format(Math.abs(mpiS / kpMpi * 100 - 100)) + ' %' : '') : 'keine Angabe', nMpi ? nMpi + ' von ' + rows.length + ' Obj.' : '', nMpi && kpMpi ? (mpiS >= kpMpi ? 'gp-pos' : 'gp-neg') : '', 'Gesamtbewertung: Marktpreisindikation ' + mio(mpiS) + ' gegen die Kaufpreise derselben Objekte ' + mio(kpMpi) + '.')
      + '</div>';
    var ohneEw = rows.filter(function (r) { return r.ew == null; });
    var gb = false ? '<div class="gp-gb"><span>Investiert <b>' + mio(S.gi) + '</b></span><span>Darlehen <b>' + mio(S.darl) + '</b></span><span>Eigenkapital eingesetzt <b>' + mio(S.ek) + '</b></span>'
      + (ohneEw.length ? '<span title="' + esc(ohneEw.map(function (r) { return r.name; }).join(', ')) + '">ohne Ertragswert: ' + ohneEw.length + '</span>' : '') + '</div>' : '';

    /* je Objekt: Miete, Cashflow nach Steuer, Steuereffekt */
    var obR = rows.slice().sort(function (a, b) { return (b.cfns == null ? -1e12 : b.cfns) - (a.cfns == null ? -1e12 : a.cfns); });
    var mit = obR.filter(function (r) { return r.cfns != null; }), plus = mit.filter(function (r) { return r.cfns > 0; }).length;
    var bM = bereich(obR, function (r) { return r.mieteJ; }), bC = bereich(obR, function (r) { return r.cfns; }), bS = bereich(obR, function (r) { return r.steuer; }), bV = bereich(obR, function (r) { return r.cfvs; });   /* v4480 · vor Steuer dazu */
    var NEUTRAL = 'color-mix(in srgb,var(--gx-tinte2,#6b6660) 38%,transparent)';
    var stS = summe(obR, function (r) { return r.steuer; });
    /* v4480 · Marcel 24.11.2026: Cashflow vor und nach Steuer und was die Steuer ausmacht nebeneinander. Reihenfolge wie die Rechnung: vor Steuer, Steuer, nach Steuer */
    var ob = '<div class="gp-ob-w"><div class="gp-ob" role="table" aria-label="Je Objekt: Miete, Cashflow vor Steuer, Steuereffekt, Cashflow nach Steuer"><div class="gp-oh">Objekt</div><div class="gp-oh">Miete ' + J0 + '</div><div class="gp-oh">Cashflow vor Steuer</div><div class="gp-oh" title="nach Steuer minus vor Steuer">Steuereffekt</div><div class="gp-oh">Cashflow nach Steuer</div>'
      + obR.map(function (r, i) {
        return '<div class="gp-tr" data-gp-i="' + i + '"><div class="gp-on" title="' + esc(r.name) + '">' + esc(r.name) + '</div>'
          + zelle(r.mieteJ, bM[0], bM[1], NEUTRAL, r.mieteJ != null ? nf0.format(Math.round(r.mieteJ / 100) / 10) + ' T€' : '')
          + zelle(r.cfvs, bV[0], bV[1], r.cfvs >= 0 ? GRUEN : ROT, eurV(r.cfvs))
          + zelle(r.steuer, bS[0], bS[1], r.steuer >= 0 ? GRUEN : ROT, eurV(r.steuer))
          + zelle(r.cfns, bC[0], bC[1], r.cfns >= 0 ? GRUEN : ROT, eurV(r.cfns)) + '</div>';
      }).join('')
      + (obR.length > 1 ? '<div class="gp-on gp-sum">Summe</div><div class="gp-sum">' + eur(summe(obR, function (r) { return r.mieteJ; })) + '</div><div class="gp-sum ' + ton(CFvs) + '">' + eurV(summe(obR, function (r) { return r.cfvs; })) + '</div><div class="gp-sum ' + ton(stS) + '">' + eurV(stS) + '</div><div class="gp-sum ' + ton(CFns) + '">' + eurV(summe(obR, function (r) { return r.cfns; })) + '</div>' : '')
      + '</div></div>';
    var fehlCf = rows.filter(function (r) { return r.cfns == null; });
    var obT = rows.length > 1 ? '<em>' + plus + ' von ' + rows.length + '</em> Objekten bringen nach Steuer Geld' : esc(rows[0].name);
    var obU = 'Je Objekt, volles Jahr ' + J0 + ' · die Steuer ' + (stS >= 0 ? 'entlastet' : 'kostet') + ' zusammen ' + eur(Math.abs(stS)) + (fehlCf.length ? ' · ohne Cashflow: ' + esc(fehlCf.map(function (r) { return r.name; }).join(', ')) : '');

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
    ok(Math.abs(summe(rows, function (r) { return r.cfvs; }) - CFvs) < 1, 'Cashflow vor Steuer je Objekt ergibt die Summe ' + eurV(CFvs));   /* v4480 */
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

  /* ══ v4260 · Restliche Grafiken im neuen Stil und Grundsetup ══════════════════════════════════════
     Marcel 23.11.2026: „Vermögensbilanz heute, Eigenkapitalentwicklung, Vermögen nach Objekt, Das Vermögen wächst,
     Steuer über alle Objekte … ein Grundsetup … in den Einstellungen gewisse Charts ausblenden." Daten nur gelesen:
     DealPilotDashboard.vermoegenBlick() (_bilanzHeute und projectAll, dieselben Reihen wie die alten Grafiken in
     buildCharts) und .steuerKetteDaten() (steuerKette). Gezeichnet über window.DpGrafiken (karte, verlauf), die Balken
     lokal als SVG mit denselben Klassen und Farben. Die alten Karten bleiben im DOM und werden nur ausgeblendet. */
  /* ══ v4640 · Baukasten „Ansicht anpassen“ ════════════════════════════════════════════════════════
     Marcel 25.11.2026 zu den Demos Runde 3: „Richtig geil mit dem Baukasten. Setz das mal so um.“
     Jedes vorhandene Cockpit-Modul: an oder aus, Reihenfolge (ziehen oder Pfeile), halbe oder volle Breite.
     Vorlagen wie in den Demos (Standard = Demo 01). Module einer Vorlage, die es in der App noch nicht gibt,
     stehen ausgegraut mit „kommt“. Score-Kopf und Kennzahlenleiste stehen fest oben.
     Gespeichert im Einstellungsspeicher (cockpit_ansicht, v: 2), localStorage nur als schneller Rückfall.
     Die Grafiken unter „Projektion und Verlauf“ (vb-*) liegen in EINER Karte: sie sortieren sich untereinander,
     die Gruppe als Ganzes steht im Hauptraster. */
  var ANSICHT = [
    { k: 'kopf', t: 'Kennzahlen auf einen Blick', fest: true, w: 'Die wichtigsten Zahlen des Portfolios in einer Leiste.' },
    { k: 'gb', t: 'Vermögen und Gesamtbewertung', b: 'ganz', w: 'Was investiert ist, was dir heute gehört und was es nach Bewertung wert ist.' },
    { k: 'zielbild', t: 'Bestand und Zielbild je Objekt', b: 'ganz', w: 'Die Tabelle wie in der Pilot-Analyse, für alle Objekte. Fahr über ein Objekt für die Details.' },
    { k: 'ob', t: 'Cashflow und Steuer je Objekt', b: 'halb', w: 'Welches Objekt Geld bringt und welches kostet.' },
    { k: 'bk', t: 'Finanzierung und Anschluss', b: 'halb', w: 'Wann wie viel Restschuld neu finanziert wird.' },
    { k: 'projektion', t: 'Projektion und Verlauf', b: 'ganz', gruppe: true, w: 'Die Verlaufsgrafiken in einer Karte.' },
    { k: 'vb-eq', t: 'Eigenkapital-Entwicklung', b: 'ganz', vb: true, w: 'Wie dein Anteil am Portfolio über die Jahre wächst.' },
    { k: 'vb-cf', t: 'Cashflow vor und nach Steuer im Verlauf', b: 'ganz', vb: true, w: 'Wie sich der Cashflow aller Objekte entwickelt und was die Steuer ausmacht.' },
    { k: 'vb-bilanz', t: 'Vermögensbilanz heute', b: 'halb', vb: true, w: 'Was du besitzt gegen das, was der Bank gehört.' },
    { k: 'vb-objekte', t: 'Vermögen nach Objekt und Lage', b: 'halb', vb: true, w: 'Wo dein Vermögen steckt, mit Klumpen nach Ort.' },
    { k: 'vb-quellen', t: 'Woraus das Vermögen wächst', b: 'ganz', vb: true, w: 'Zuwachs je Jahr aus Tilgung, Wertsteigerung und Überschuss.' },
    { k: 'pp', t: 'Portfolio-Pilot', b: 'ganz', w: 'Die KI-Einschätzung über alle Objekte.' },
    { k: 'steuer', t: 'Steuer über alle Objekte', b: 'ganz', w: 'Wirkung jedes Objekts auf deine Steuer, Progression und Steuer-Mappe.' },
    { k: 'gesamtproj', t: 'Gesamt-Projektion als Tabelle', b: 'ganz', w: 'Alle Jahre der Modellprojektion in Zahlen.' },
    { k: 'det', t: 'Objekte im Einzelnen und Rechenprüfung', b: 'ganz', w: 'Liste je Objekt mit Hinweisen und die Prüfung der Summen.' }
  ];
  function modul(k) { return ANSICHT.filter(function (x) { return x.k === k; })[0] || null; }
  var TOP = ANSICHT.filter(function (a) { return !a.fest && !a.vb; }).map(function (a) { return a.k; });
  var VBK = ANSICHT.filter(function (a) { return a.vb; }).map(function (a) { return a.k; });
  /* Vorlagen nach den Demos (Dateien/Portfolio-Cockpit/Demos-2026-11-25c/baukasten.js). m: [Schlüssel, Breite] in Reihenfolge. */
  var VORLAGEN = [
    { k: 'standard', t: 'Standard', u: 'Was ein Bestandshalter jeden Monat sehen will',
      m: [['zielbild', 'ganz'], ['ob', 'halb'], ['bk', 'halb'], ['vb-eq', 'ganz'], ['vb-cf', 'ganz'], ['gb', 'ganz'], ['pp', 'ganz'], ['det', 'ganz']],
      kommt: ['Was jetzt zu tun ist', 'EK-Rendite je Objekt', 'Wohin die Miete geht'] },
    { k: 'risiko', t: 'Risiko', u: 'Wo der Bestand verwundbar ist',
      m: [['bk', 'ganz'], ['ob', 'ganz'], ['zielbild', 'ganz'], ['det', 'ganz']],
      kommt: ['Risikomatrix', 'Rendite gegen Tragfähigkeit', 'Deine Ziele', 'Anschlussfinanzierung je Jahr', 'Zinsstress beim Anschluss'] },
    { k: 'steuer', t: 'Steuer', u: 'Was die Steuer aus dem Cashflow macht',
      m: [['steuer', 'ganz'], ['ob', 'ganz'], ['vb-cf', 'ganz'], ['zielbild', 'ganz']],
      kommt: ['Wohin die Miete geht', 'Woher die Rendite kommt'] },
    { k: 'bank', t: 'Finanzierung · Bank-Mappe', u: 'Für das Gespräch mit der Bank',
      m: [['bk', 'ganz'], ['gb', 'ganz'], ['vb-bilanz', 'halb'], ['vb-objekte', 'halb'], ['vb-eq', 'ganz'], ['zielbild', 'ganz']],
      kommt: ['Anschlussfinanzierung je Jahr', 'Was dein Eigenkapital verdient', 'Deine Ziele', 'Zinsstress beim Anschluss'] },
    { k: 'bericht', t: 'Bericht', u: 'Ruhig, zum Lesen und Weitergeben',
      m: [['gb', 'ganz'], ['zielbild', 'ganz'], ['vb-eq', 'halb'], ['vb-quellen', 'halb'], ['pp', 'ganz']],
      kommt: ['Woher die Rendite kommt', 'Deine Objekte mit Bild'] }
  ];
  function vorlageVon(k) { return VORLAGEN.filter(function (v) { return v.k === k; })[0] || null; }
  /* Stand aus einer Vorlage: nur ihre Module an, in ihrer Reihenfolge und Breite, der Rest dahinter und aus */
  function ausVorlage(v) {
    var an = {}, br = {}, ord = [], ordVb = [];
    ANSICHT.forEach(function (a) { if (!a.fest && !a.gruppe) an[a.k] = false; });
    v.m.forEach(function (x) {
      an[x[0]] = true; br[x[0]] = x[1];
      if (VBK.indexOf(x[0]) >= 0) { ordVb.push(x[0]); if (ord.indexOf('projektion') < 0) ord.push('projektion'); }
      else if (ord.indexOf(x[0]) < 0) ord.push(x[0]);
    });
    TOP.forEach(function (k) { if (ord.indexOf(k) < 0) ord.push(k); });
    VBK.forEach(function (k) { if (ordVb.indexOf(k) < 0) ordVb.push(k); });
    br.projektion = 'ganz';
    return { v: 2, an: an, ord: ord, ordVb: ordVb, br: br, vorlage: v.k };
  }
  var _ans = null, _ansServer = false, _bkOffen = false, _bkVorher = null, _bkPut = null;
  /* v1 (v4260) kannte nur an/aus: die Häkchen bleiben, Reihenfolge und Breite kommen aus Standard */
  function normal(s) {
    var basis = ausVorlage(VORLAGEN[0]);
    if (!s || typeof s !== 'object') return basis;
    var an = s.an && typeof s.an === 'object' ? s.an : (s.v ? {} : s);
    var out = { v: 2, an: {}, ord: [], ordVb: [], br: {}, vorlage: s.v === 2 ? (s.vorlage || null) : (Object.keys(an).length ? null : 'standard') };
    Object.keys(basis.an).forEach(function (k) { out.an[k] = Object.prototype.hasOwnProperty.call(an, k) ? !!an[k] : basis.an[k]; });
    var o = Array.isArray(s.ord) ? s.ord.filter(function (k) { return TOP.indexOf(k) >= 0; }) : [];
    basis.ord.forEach(function (k) { if (o.indexOf(k) < 0) o.push(k); }); out.ord = o;
    var ov = Array.isArray(s.ordVb) ? s.ordVb.filter(function (k) { return VBK.indexOf(k) >= 0; }) : [];
    basis.ordVb.forEach(function (k) { if (ov.indexOf(k) < 0) ov.push(k); }); out.ordVb = ov;
    ANSICHT.forEach(function (a) { if (a.fest) return; var b = s.br && s.br[a.k]; out.br[a.k] = b === 'halb' || b === 'ganz' ? b : (basis.br[a.k] || a.b || 'ganz'); });
    return out;
  }
  function ansLaden() {
    if (_ans) return _ans;
    var roh = null; try { roh = JSON.parse(localStorage.getItem('dp_gp_ansicht') || 'null'); } catch (e) { roh = null; }
    _ans = normal(roh);
    if (!_ansServer) {
      _ansServer = true;
      try { if (window.Auth && Auth.apiCall) Auth.apiCall('/user-settings/cockpit_ansicht').then(function (r) {
        var w = r && r.wert; if (!w || typeof w !== 'object') return;
        _ans = normal(w.v === 2 ? w : (w.an || null));
        try { localStorage.setItem('dp_gp_ansicht', JSON.stringify(_ans)); } catch (e) {}
        ansichtAnwenden(); if (_bkOffen) bkListe();
      }).catch(function () {}); } catch (e) {}
    }
    return _ans;
  }
  function ansSpeichern() {
    try { localStorage.setItem('dp_gp_ansicht', JSON.stringify(_ans)); } catch (e) {}
    if (_bkPut) clearTimeout(_bkPut);
    _bkPut = setTimeout(function () {
      try { if (window.Auth && Auth.apiCall) Auth.apiCall('/user-settings/cockpit_ansicht', { method: 'PUT', body: { wert: _ans } }).catch(function () {}); } catch (e) {}
    }, 500);
  }
  function sichtbar(k) {
    var a = modul(k); if (!a) return true; if (a.fest) return true;
    var A = ansLaden();
    if (a.gruppe) return VBK.some(function (x) { return A.an[x]; });
    return !!A.an[k];
  }
  function breite(k) { var A = ansLaden(); return (A.br && A.br[k]) || (modul(k) || {}).b || 'ganz'; }
  function ansichtZiele(app) {
    var q = function (s) { return app ? app.querySelector(s) : null; };
    return {
      'vb-eq': q('[data-gp-k="vb-eq"]'), 'vb-bilanz': q('[data-gp-k="vb-bilanz"]'), 'vb-objekte': q('[data-gp-k="vb-objekte"]'), 'vb-quellen': q('[data-gp-k="vb-quellen"]'), 'vb-cf': q('[data-gp-k="vb-cf"]'),
      gb: q(':scope > [data-dp-gp="gb"]'), ob: q(':scope > [data-dp-gp="ob"]'), bk: q(':scope > [data-dp-gp="bk"]'), det: q(':scope > [data-dp-gp="det"]'),
      zielbild: q(':scope > .cp-sek[data-sek="zielbild"]'), steuer: q(':scope > .cp-sek[data-sek="steuer"]'),
      gesamtproj: q(':scope > .cp-sek[data-sek="gesamtproj"]'), pp: q(':scope > #dp-pp-slot'),
      projektion: q(':scope > .cp-sek[data-sek="projektion"]')
    };
  }
  function ansichtAnwenden() {
    var hero = document.getElementById('dp-pscore-hero'), app = hero && hero.parentNode; if (!app || !AN) return;
    var A = ansLaden(), Z = ansichtZiele(app);
    app.classList.add('gp-bk-raster');
    Object.keys(Z).forEach(function (k) { if (Z[k]) Z[k].classList.toggle('gp-aus', !sichtbar(k)); });
    A.ord.forEach(function (k, i) { var el = Z[k]; if (!el) return; el.style.order = String(10 + i); el.classList.toggle('gp-halb', breite(k) === 'halb'); });
    A.ordVb.forEach(function (k, i) { var el = Z[k]; if (!el) return; el.style.order = String(i); el.classList.toggle('gp-breit', breite(k) !== 'halb'); });
    var gb = Z.gb; if (gb) gb.removeAttribute('data-gp-fest');
  }

  /* ── Seitenleiste ── */
  function bkZeile(k, i, n, inGruppe) {
    var a = modul(k), A = ansLaden(), an = a.gruppe ? sichtbar(k) : !!A.an[k], br = breite(k);
    var pfeil = function (r, t, aus) { return '<button type="button" class="gpbk-p" data-bk="' + r + '" data-k="' + k + '" aria-label="' + esc(a.t) + ' ' + t + '"' + (aus ? ' disabled' : '') + '>' + (r === 'hoch' ? '↑' : '↓') + '</button>'; };
    var wahl = '<span class="gpbk-br" role="group" aria-label="Breite ' + esc(a.t) + '">'
      + '<button type="button" data-bk="br" data-k="' + k + '" data-w="halb" aria-pressed="' + (br === 'halb') + '">½</button>'
      + '<button type="button" data-bk="br" data-k="' + k + '" data-w="ganz" aria-pressed="' + (br !== 'halb') + '">ganz</button></span>';
    var kopf = a.gruppe
      ? '<span class="gpbk-txt"><b>' + esc(a.t) + '</b><small>' + esc(a.w) + '</small></span>'
      : '<label class="gpbk-txt"><input type="checkbox" data-bk="an" data-k="' + k + '"' + (an ? ' checked' : '') + '><span><b>' + esc(a.t) + '</b><small>' + esc(a.w) + '</small></span></label>';
    return '<li class="gpbk-z' + (an ? '' : ' gpbk-aus') + (a.gruppe ? ' gpbk-gr' : '') + '" draggable="true" data-k="' + k + '" data-liste="' + (inGruppe ? 'vb' : 'top') + '">'
      + '<span class="gpbk-griff" aria-hidden="true">⋮⋮</span>' + kopf + '<span class="gpbk-akt">' + wahl + pfeil('hoch', 'nach oben', i === 0) + pfeil('runter', 'nach unten', i === n - 1) + '</span>'
      + (a.gruppe ? '<ol class="gpbk-sub">' + A.ordVb.map(function (v, j) { return bkZeile(v, j, A.ordVb.length, true); }).join('') + '</ol>' : '')
      + '</li>';
  }
  function bkListe() {
    var p = document.getElementById('dp-gp-bk'); if (!p) return;
    var A = ansLaden(), v = vorlageVon(A.vorlage);
    var fok = document.activeElement && p.contains(document.activeElement) ? [document.activeElement.getAttribute('data-bk'), document.activeElement.getAttribute('data-k'), document.activeElement.getAttribute('data-w')] : null;
    p.querySelector('.gpbk-vl').innerHTML = VORLAGEN.map(function (x) {
      return '<button type="button" class="gpbk-v' + (A.vorlage === x.k ? ' an' : '') + '" data-bk="vorlage" data-k="' + x.k + '" aria-pressed="' + (A.vorlage === x.k) + '"><b>' + esc(x.t) + '</b><small>' + esc(x.u) + '</small></button>';
    }).join('');
    p.querySelector('.gpbk-liste').innerHTML = A.ord.map(function (k, i) { return bkZeile(k, i, A.ord.length, false); }).join('');
    var kommt = v ? v.kommt : [];
    p.querySelector('.gpbk-kommt-w').innerHTML = kommt.length ? '<div class="gpbk-h">Kommt in dieser Vorlage dazu</div><ul class="gpbk-kommt">'
      + kommt.map(function (t) { return '<li><span>' + esc(t) + '</span><i>kommt</i></li>'; }).join('') + '</ul>' : '';
    if (fok && fok[0]) {
      var sel = '[data-bk="' + fok[0] + '"]' + (fok[1] ? '[data-k="' + fok[1] + '"]' : '') + (fok[2] ? '[data-w="' + fok[2] + '"]' : '');
      var el = p.querySelector(sel); if (el && !el.disabled) el.focus();
    }
  }
  function bkGeaendert() { var A = ansLaden(); A.vorlage = null; ansSpeichern(); ansichtAnwenden(); bkListe(); }
  function bkVerschieben(k, r) {
    var A = ansLaden(), L = VBK.indexOf(k) >= 0 ? A.ordVb : A.ord, i = L.indexOf(k), j = i + r;
    if (i < 0 || j < 0 || j >= L.length) return;
    L.splice(i, 1); L.splice(j, 0, k); bkGeaendert();
  }
  function bkZu() {
    var p = document.getElementById('dp-gp-bk'), h = document.getElementById('dp-gp-bk-hg');
    if (p) p.parentNode.removeChild(p); if (h) h.parentNode.removeChild(h);
    _bkOffen = false; document.removeEventListener('keydown', bkTaste, true);
    try { if (_bkVorher && _bkVorher.focus) _bkVorher.focus(); } catch (e) {}
  }
  function bkTaste(ev) {
    var p = document.getElementById('dp-gp-bk'); if (!p) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); bkZu(); return; }
    if (ev.key !== 'Tab') return;
    var F = [].filter.call(p.querySelectorAll('button,input,[tabindex]'), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!F.length) return;
    var a = F[0], b = F[F.length - 1];
    if (!p.contains(document.activeElement)) { ev.preventDefault(); a.focus(); return; }
    if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); b.focus(); }
    else if (!ev.shiftKey && document.activeElement === b) { ev.preventDefault(); a.focus(); }
  }
  function ansichtOeffnen() {
    ansLaden(); if (_bkOffen) { bkListe(); return; }
    _bkOffen = true; _bkVorher = document.activeElement; stil4();
    /* Hintergrund dunkelt ab, schließt aber NIE per Klick (Marcel 24.11.2026): nur ×, Fertig oder Esc */
    var hg = document.createElement('div'); hg.id = 'dp-gp-bk-hg'; hg.className = 'gpbk-hg'; hg.setAttribute('aria-hidden', 'true'); document.body.appendChild(hg);
    var p = document.createElement('div'); p.id = 'dp-gp-bk'; p.className = 'gpbk'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'gpbk-t');
    p.innerHTML = '<div class="gpbk-k"><div><b id="gpbk-t">Ansicht anpassen</b><small>Score und Kennzahlen stehen immer oben. Alles darunter stellst du hier zusammen.</small></div>'
      + '<button type="button" class="gpbk-x" data-bk="zu" aria-label="Schließen">×</button></div>'
      + '<div class="gpbk-body"><div class="gpbk-h">Vorlagen</div><div class="gpbk-vl"></div>'
      + '<div class="gpbk-h">Module <span>ziehen oder mit den Pfeilen sortieren</span></div><ol class="gpbk-liste"></ol><div class="gpbk-kommt-w"></div></div>'
      + '<div class="gpbk-f"><button type="button" class="gpbk-b" data-bk="reset">Zurücksetzen</button><button type="button" class="gpbk-b gpbk-ok" data-bk="zu">Fertig</button></div>';
    document.body.appendChild(p);
    p.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('button[data-bk]') : null; if (!b || !p.contains(b)) return;
      var a = b.getAttribute('data-bk'), k = b.getAttribute('data-k'), A = ansLaden();
      if (a === 'zu') bkZu();
      else if (a === 'reset') { _ans = ausVorlage(VORLAGEN[0]); ansSpeichern(); ansichtAnwenden(); bkListe(); }
      else if (a === 'vorlage') { var v = vorlageVon(k); if (v) { _ans = ausVorlage(v); ansSpeichern(); ansichtAnwenden(); bkListe(); } }
      else if (a === 'hoch' || a === 'runter') bkVerschieben(k, a === 'hoch' ? -1 : 1);
      else if (a === 'br') { A.br[k] = b.getAttribute('data-w') === 'halb' ? 'halb' : 'ganz'; bkGeaendert(); }
    });
    p.addEventListener('change', function (ev) {
      var t = ev.target; if (!t || t.getAttribute('data-bk') !== 'an') return;
      ansLaden().an[t.getAttribute('data-k')] = !!t.checked; bkGeaendert();
    });
    /* Ziehen: nur innerhalb derselben Liste (Hauptraster oder Projektion und Verlauf) */
    var zieh = null;
    p.addEventListener('dragstart', function (ev) { var z = ev.target && ev.target.closest ? ev.target.closest('.gpbk-z') : null; if (!z) return; zieh = z; ev.stopPropagation(); z.classList.add('gpbk-zieht'); try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', z.getAttribute('data-k')); } catch (e) {} });
    p.addEventListener('dragend', function () { if (zieh) zieh.classList.remove('gpbk-zieht'); zieh = null; [].forEach.call(p.querySelectorAll('.gpbk-ueber'), function (x) { x.classList.remove('gpbk-ueber'); }); });
    p.addEventListener('dragover', function (ev) {
      var z = ev.target && ev.target.closest ? ev.target.closest('.gpbk-z') : null;
      if (!zieh || !z || z === zieh || z.getAttribute('data-liste') !== zieh.getAttribute('data-liste')) return;
      ev.preventDefault(); [].forEach.call(p.querySelectorAll('.gpbk-ueber'), function (x) { if (x !== z) x.classList.remove('gpbk-ueber'); }); z.classList.add('gpbk-ueber');
    });
    p.addEventListener('drop', function (ev) {
      var z = ev.target && ev.target.closest ? ev.target.closest('.gpbk-z') : null;
      if (!zieh || !z || z === zieh || z.getAttribute('data-liste') !== zieh.getAttribute('data-liste')) return;
      ev.preventDefault();
      var A = ansLaden(), L = zieh.getAttribute('data-liste') === 'vb' ? A.ordVb : A.ord, von = zieh.getAttribute('data-k'), nach = z.getAttribute('data-k');
      var i = L.indexOf(von), j = L.indexOf(nach); if (i < 0 || j < 0) return;
      L.splice(i, 1); L.splice(j, 0, von); bkGeaendert();
    });
    document.addEventListener('keydown', bkTaste, true);
    bkListe();
    try { p.querySelector('.gpbk-x').focus(); } catch (e) {}
  }
  function panelNeu() {}   /* v4640 · die Seitenleiste hängt am body, kein Panel mehr im Kopf */

  /* v4640 · Zeile der Tabelle „Bestand und Zielbild je Objekt“: eigener Tooltip statt des Browser-Titels.
     Bezug zu deinen Zielen NUR, wenn im Investmentprofil eingetragen (wie v4490e in der Pilot-Analyse). */
  function zielWert(key) {
    try { var P = window.DealPilotInvestmentProfile, p = P && P.load ? P.load() : null, v = p ? p[key] : null; if (v == null || v === '') return null;
      if (typeof v !== 'number') { v = String(v).trim(); if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.'); v = Number(v); }
      return isFinite(v) ? v : null; } catch (e) { return null; }
  }
  function zbTipps(app) {
    var sek = app && app.querySelector(':scope > .cp-sek[data-sek="zielbild"]'); if (!sek) return;
    var D = daten(), nachName = {}; (D ? D.rows : []).forEach(function (r) { nachName[String(r.name).trim()] = r; });
    var zDs = zielWert('min_dscr'), zCf = zielWert('min_cashflow_vor_st');
    [].forEach.call(sek.querySelectorAll('tr[title], tr[data-gp-zt]'), function (tr) {
      var th = tr.querySelector('th'); if (!th) return;
      var basis = tr.getAttribute('title') || tr.getAttribute('data-gp-zt-basis') || '';
      tr.setAttribute('data-gp-zt-basis', basis); tr.removeAttribute('title');
      var name = (th.firstChild && th.firstChild.nodeType === 3 ? th.firstChild.nodeValue : th.textContent).trim(), r = nachName[name];
      var z = ['<b>' + esc(name) + '</b>'].concat(basis.split(' · ').filter(Boolean).map(esc));
      if (r) {
        if (r.cfvs != null) z.push('Cashflow vor Steuer ' + eurV(r.cfvs / 12) + ' im Monat' + (zCf != null ? (r.cfvs / 12 >= zCf ? ', dein Ziel ' + eurV(zCf) + ' erreicht' : ', dein Ziel ' + eurV(zCf) + ' nicht erreicht') : ''));
        if (r.dscr != null) z.push('DSCR ' + nf2.format(r.dscr) + (zDs != null ? (r.dscr >= zDs ? ', dein Ziel ' + nf2.format(zDs) + ' erreicht' : ', dein Ziel ' + nf2.format(zDs) + ' nicht erreicht') : ''));
        if (r.ekr4 && r.ekr4.haupt != null) z.push('EK-Rendite ' + nf1.format(r.ekr4.haupt) + ' % nach Steuer mit Vermögensdelta');
      }
      tr.setAttribute('data-gp-zt', z.join('<br>'));
    });
    if (sek._gpZt) return; sek._gpZt = true;
    var tip = document.createElement('div'); tip.className = 'gp-zt'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    var zeig = function (tr, x, y) {
      tip.innerHTML = tr.getAttribute('data-gp-zt'); tip.style.display = 'block';
      var w = tip.offsetWidth, h = tip.offsetHeight, vw = window.innerWidth;
      var l = Math.min(Math.max(8, x + 14), vw - w - 8), t = y - h - 12; if (t < 8) t = y + 18;
      tip.style.left = l + 'px'; tip.style.top = t + 'px';
    };
    sek.addEventListener('mousemove', function (ev) { var tr = ev.target.closest ? ev.target.closest('tr[data-gp-zt]') : null; if (!tr) { tip.style.display = 'none'; return; } zeig(tr, ev.clientX, ev.clientY); });
    sek.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    sek.addEventListener('focusin', function (ev) { var tr = ev.target.closest ? ev.target.closest('tr[data-gp-zt]') : null; if (!tr) return; var b = tr.getBoundingClientRect(); zeig(tr, b.left + 20, b.top); });
    sek.addEventListener('focusout', function () { tip.style.display = 'none'; });
    window.addEventListener('scroll', function () { tip.style.display = 'none'; }, true);
  }

  /* v4640 · Farbe wie die Grafiken der Pilot-Analyse (grafiken-premium.js stil(), html[data-gx-stil]): hell heißt hell,
     dunkel heißt dunkel, auch Score-Kopf, Schalter und die Karten aus dashboard.js. Gold nur über Whitelabel-Token. */
  function stil4() {
    if (document.getElementById('dp-gp-stil4')) return;
    var s = document.createElement('style'); s.id = 'dp-gp-stil4';
    var G = 'var(--wl-c9a84c, #C9A84C)', A = 'body.dp-gp-an #dp-stage .app.gp-bk-raster', M = 'body.dp-gp-an #dashboard-main';
    var H = 'html:not([data-gx-stil="dunkel"]) body.dp-gp-an #dp-pscore-hero', DK = 'html[data-gx-stil="dunkel"] body.dp-gp-an #dashboard-main';
    s.textContent = [
      /* Raster: volle oder halbe Breite je Modul, Reihenfolge über order (Kopf, Score, Ansicht, Leiste bleiben vorn) */
      A + '{flex-direction:row !important;flex-wrap:wrap;column-gap:14px;align-items:flex-start}',
      A + ' > *{flex:0 0 100%;max-width:100%;min-width:0;box-sizing:border-box}',
      '@media (min-width:1000px){' + A + ' > .gp-halb{flex:0 0 calc(50% - 7px);max-width:calc(50% - 7px)}}',
      M + ' .gp-vb-raster > .gp-vbk:not(.gp-breit){grid-column:auto}',
      /* Hell: Score-Kopf hell wie die Grafikkarten (vorher Obsidian-Band) */
      H + ' .dpz-kopf{background:var(--surface,#F8F6F1);color:#2A2727;border:1px solid color-mix(in srgb,' + G + ' 40%,transparent)}',
      H + ' .dpz-lbl,' + H + ' .dpz-wie summary,' + H + ' .dpz-eck .k{color:color-mix(in srgb,#2A2727 58%,transparent)}',
      H + ' .dpz-wort,' + H + ' .dpz-eck .v,' + H + ' .dpz-warum b{color:#2A2727}',
      H + ' .dpz-wert,' + H + ' .dpz-wie,' + H + ' .dpz-warum{color:color-mix(in srgb,#2A2727 72%,transparent)}',
      H + ' .dpz-knopf{color:color-mix(in srgb,#2A2727 70%,transparent) !important;border-color:color-mix(in srgb,#2A2727 18%,transparent) !important}',
      H + ' .dpz-knopf:hover{color:var(--dp-gold-txt,#7d682f) !important;border-color:' + G + ' !important}',
      H + ' .dpz-empf-halb{color:var(--dp-gold-txt,#7d682f)}' + H + ' .dpz-empf-nein{background:color-mix(in srgb,#B8625C 14%,transparent);color:#B8625C}',
      /* Hell: Schalter Einfach/Genau und Tabelle/Grafik ohne dunkle Flächen, aktiver Zustand golden */
      'html:not([data-gx-stil="dunkel"]) ' + M + ' .cp-ans-sw{background:color-mix(in srgb,#2A2727 6%,#fff) !important}',
      'html:not([data-gx-stil="dunkel"]) ' + M + ' .cp-ans-sw button{color:color-mix(in srgb,#2A2727 70%,transparent) !important}',
      'html:not([data-gx-stil="dunkel"]) ' + M + ' .cp-ans-sw button.on,html:not([data-gx-stil="dunkel"]) ' + M + ' .pj-sw button.on{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),' + G + ' 55%,var(--wl-b8932f, #b8932f)) !important;color:#2c2410 !important}',
      /* Dunkel: Variablen des Cockpits und die Karten aus dashboard.js */
      DK + ' .stage.fc,' + DK + '{--c-panel:#0E0D0B;--c-ptext:#E9E3D6;--c-pmut:#B9B2A3;--c-ink:#E9E3D6;--c-mut:#B9B2A3;--c-line:#26231E;--c-front:#0E0D0B;--c-front-tx:#E9E3D6;--c-front-mut:#B9B2A3}',
      DK + ' .dpz-karte,' + DK + ' .cp-ansicht,' + DK + ' .zb-card,' + DK + ' #dp-pp,' + DK + ' .dp-pp-bar,' + DK + ' #dp-proj-box,' + DK + ' .proj .ph,' + DK + ' .gb-wrap{background:linear-gradient(180deg,#16140F,#0E0D0B) !important;color:#E9E3D6 !important;border-color:#26231E !important}',
      DK + ' .dp-pp-head,' + DK + ' .zb-wh,' + DK + ' .zb-ot-tab th,' + DK + ' .zb-ot-tab td{background:#16140F !important;color:#E9E3D6;border-color:#26231E !important}',
      DK + ' .zb-ot-tab small,' + DK + ' .zb-ot-gl,' + DK + ' .dpz-was,' + DK + ' .dpz-anteil,' + DK + ' .dpz-m,' + DK + ' .dpz-summe{color:#B9B2A3 !important}',
      DK + ' .dpz-n,' + DK + ' .dpz-h3,' + DK + ' .dpz-t,' + DK + ' .dpz-p{color:#E9E3D6 !important}',
      DK + ' .dpz-bar{background:#26231E !important}' + DK + ' .dpz-o{background:color-mix(in srgb,' + G + ' 14%,#0E0D0B) !important;border-color:#3A352D !important;color:var(--wl-e8cc7a,#E8CC7A) !important}',
      DK + ' .dpz-kopf{background:linear-gradient(180deg,#16140F,#0E0D0B);border:1px solid #26231E}',
      DK + ' select,' + DK + ' textarea,' + DK + ' input:not([type=checkbox]):not([type=range]),' + DK + ' .cp-ans-sw button:not(.on),' + DK + ' .pj-sw button:not(.on),' + DK + ' .sl-yrs button:not(.active),' + DK + ' .sl .cp-chev{background:#16140F !important;color:#E9E3D6 !important;border-color:#3A352D !important}',
      DK + ' .cp-ans-sw{background:#16140F !important}',
      /* Seitenleiste „Ansicht anpassen“ (am body, nie per Klick daneben zu) */
      '.gpbk-hg{position:fixed;inset:0;background:rgba(5,5,5,.22);z-index:2147482990}',
      '.gpbk{position:fixed;top:0;right:0;bottom:0;width:min(420px,100vw);z-index:2147482991;display:flex;flex-direction:column;background:#FDFCFA;color:#2A2727;border-left:1px solid color-mix(in srgb,' + G + ' 45%,transparent);box-shadow:-16px 0 40px rgba(5,5,5,.18);font-family:Inter,system-ui,sans-serif}',
      '.gpbk-k{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid color-mix(in srgb,#2A2727 10%,transparent)}',
      '.gpbk-k::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),' + G + ' 55%,var(--wl-b8932f, #b8932f))}',
      '.gpbk-k b{display:block;font:700 18px/1.2 "Space Grotesk",sans-serif}',
      '.gpbk-k small{display:block;font-size:12px;color:color-mix(in srgb,#2A2727 62%,transparent);margin-top:3px}',
      '.gpbk-x{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:color-mix(in srgb,#2A2727 62%,transparent);padding:2px 6px;border-radius:6px}',
      '.gpbk-x:hover,.gpbk-x:focus-visible{color:#2A2727;outline:2px solid ' + G + '}',
      '.gpbk-body{flex:1 1 auto;overflow:auto;padding:4px 18px 14px}',
      '.gpbk-h{font:600 10.5px/1.2 "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:color-mix(in srgb,#2A2727 58%,transparent);margin:14px 0 6px}',
      '.gpbk-h span{text-transform:none;letter-spacing:0;font-family:Inter,sans-serif;font-weight:400}',
      '.gpbk-vl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
      '.gpbk-v{text-align:left;border:1px solid color-mix(in srgb,#2A2727 12%,transparent);background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer;color:inherit;font:inherit}',
      '.gpbk-v b{display:block;font:600 13px "Space Grotesk",sans-serif}.gpbk-v small{display:block;font-size:11px;color:color-mix(in srgb,#2A2727 60%,transparent);margin-top:2px}',
      '.gpbk-v:hover,.gpbk-v:focus-visible{border-color:' + G + ';outline:none}',
      '.gpbk-v.an{border-color:' + G + ';background:color-mix(in srgb,' + G + ' 12%,#fff)}',
      '.gpbk-liste,.gpbk-sub{list-style:none;margin:0;padding:0}',
      '.gpbk-sub{margin:6px 0 2px 18px;padding-left:8px;border-left:2px solid color-mix(in srgb,' + G + ' 35%,transparent)}',
      '.gpbk-z{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:4px 8px;align-items:center;padding:7px 8px;margin:4px 0;border:1px solid color-mix(in srgb,#2A2727 10%,transparent);border-radius:10px;background:#fff}',
      '.gpbk-z .gpbk-sub{grid-column:1/-1}',
      '.gpbk-z.gpbk-gr{background:color-mix(in srgb,' + G + ' 5%,#fff)}',
      '.gpbk-z.gpbk-aus > .gpbk-txt{opacity:.55}',
      '.gpbk-z.gpbk-zieht{opacity:.45}.gpbk-z.gpbk-ueber{border-color:' + G + ';box-shadow:0 -2px 0 ' + G + ' inset}',
      '.gpbk-griff{cursor:grab;color:color-mix(in srgb,#2A2727 40%,transparent);font-size:12px;letter-spacing:-2px;user-select:none}',
      '.gpbk-txt{display:flex;gap:8px;align-items:flex-start;min-width:0;cursor:pointer;font-size:12.5px}',
      '.gpbk-txt b{font-weight:600}.gpbk-txt small{display:block;font-size:11px;color:color-mix(in srgb,#2A2727 60%,transparent);line-height:1.35}',
      '.gpbk-txt input{margin-top:2px;accent-color:' + G + ';width:15px;height:15px;flex:0 0 auto}',
      '.gpbk-akt{display:flex;gap:4px;align-items:center}',
      '.gpbk-br{display:inline-flex;border:1px solid color-mix(in srgb,#2A2727 14%,transparent);border-radius:7px;overflow:hidden}',
      '.gpbk-br button{border:0;background:transparent;font:600 11px "JetBrains Mono",monospace;padding:4px 7px;cursor:pointer;color:color-mix(in srgb,#2A2727 70%,transparent);min-height:26px}',
      '.gpbk-br button[aria-pressed="true"]{background:color-mix(in srgb,' + G + ' 24%,#fff);color:#2A2727}',
      '.gpbk-p{border:1px solid color-mix(in srgb,#2A2727 14%,transparent);background:#fff;border-radius:7px;width:26px;height:26px;cursor:pointer;color:#2A2727;font-size:13px;line-height:1}',
      '.gpbk-p:disabled{opacity:.3;cursor:default}',
      '.gpbk-br button:focus-visible,.gpbk-p:focus-visible,.gpbk-txt input:focus-visible,.gpbk-b:focus-visible{outline:2px solid ' + G + ';outline-offset:1px}',
      '.gpbk-kommt{list-style:none;margin:0;padding:0}',
      '.gpbk-kommt li{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin:4px 0;border:1px dashed color-mix(in srgb,#2A2727 16%,transparent);border-radius:10px;font-size:12.5px;color:color-mix(in srgb,#2A2727 52%,transparent)}',
      '.gpbk-kommt i{font-style:normal;font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dp-gold-txt,#7d682f);background:color-mix(in srgb,' + G + ' 16%,transparent);border-radius:9px;padding:2px 7px}',
      '.gpbk-f{display:flex;justify-content:space-between;gap:8px;padding:12px 18px;border-top:1px solid color-mix(in srgb,#2A2727 10%,transparent)}',
      '.gpbk-b{font:600 12.5px Inter,sans-serif;border:1px solid color-mix(in srgb,#2A2727 16%,transparent);background:#fff;color:#2A2727;border-radius:9px;padding:8px 14px;cursor:pointer;min-height:36px}',
      '.gpbk-ok{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),' + G + ' 55%,var(--wl-b8932f, #b8932f));color:#2c2410;border-color:transparent}',
      '@media (max-width:640px){.gpbk-vl{grid-template-columns:minmax(0,1fr)}.gpbk-z{grid-template-columns:14px minmax(0,1fr)}.gpbk-akt{grid-column:2;justify-content:flex-start}}',
      'html[data-gx-stil="dunkel"] .gpbk{background:#0E0D0B;color:#E9E3D6;border-left-color:#3A352D}',
      'html[data-gx-stil="dunkel"] .gpbk-v,html[data-gx-stil="dunkel"] .gpbk-z,html[data-gx-stil="dunkel"] .gpbk-p,html[data-gx-stil="dunkel"] .gpbk-b:not(.gpbk-ok){background:#16140F;color:#E9E3D6;border-color:#3A352D}',
      'html[data-gx-stil="dunkel"] .gpbk-z.gpbk-gr,html[data-gx-stil="dunkel"] .gpbk-v.an{background:color-mix(in srgb,' + G + ' 14%,#16140F)}',
      'html[data-gx-stil="dunkel"] .gpbk-br button[aria-pressed="true"]{background:color-mix(in srgb,' + G + ' 30%,#16140F);color:#E9E3D6}',
      'html[data-gx-stil="dunkel"] .gpbk small,html[data-gx-stil="dunkel"] .gpbk-h,html[data-gx-stil="dunkel"] .gpbk-br button,html[data-gx-stil="dunkel"] .gpbk-x,html[data-gx-stil="dunkel"] .gpbk-kommt li{color:#B9B2A3}',
      'html[data-gx-stil="dunkel"] .gpbk-p,html[data-gx-stil="dunkel"] .gpbk-x:hover{color:#E9E3D6}',
      /* Tooltip der Zielbild-Tabelle */
      '.gp-zt{position:fixed;z-index:2147482980;display:none;max-width:min(380px,calc(100vw - 16px));background:#050505;color:#FDFCFA;font:12px/1.5 Inter,system-ui,sans-serif;padding:8px 10px;border-radius:8px;box-shadow:0 8px 24px rgba(5,5,5,.25);pointer-events:none}',
      'html[data-gx-stil="dunkel"] .gp-zt{background:#F3EEE4;color:#0B0A09}',
      M + ' .cp-sek[data-sek="zielbild"] tr[data-gp-zt]{cursor:default}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function stil2() {
    if (document.getElementById('dp-gp-stil2')) return;
    var s = document.createElement('style'); s.id = 'dp-gp-stil2';
    var B = '#dashboard-main .dp-gp';
    s.textContent = [
      'body.dp-gp-an #dashboard-main .gp-aus{display:none !important}',
      /* alte Karten von Projektion & Verlauf nur, wenn die neuen stehen */
      'body.dp-gp-vb #dashboard-main .vb-charts > .chart,body.dp-gp-vb #dashboard-main .vb-charts > .vb-strip,body.dp-gp-vb #dashboard-main .vb-charts > .vb-strip-erkl,body.dp-gp-vb #dashboard-main .vb-charts > .vb-fuss{display:none !important}',
      'body.dp-gp-vb #dashboard-main .vb-charts{display:block !important}',
      'body.dp-gp-an #dashboard-main #dp-steuerkette .sk-box.sk-box-h.gp-ersetzt{display:none !important}',
      B + '.gp-vb{margin:4px 0 0}',
      B + ' .gp-vb-raster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}',
      B + ' .gp-vb-raster > .gp-vbk{min-width:0}',
      B + ' .gp-vb-raster > .gp-vbk.gp-breit{grid-column:1/-1}',
      B + ' .gp-vb-fuss{font-size:11px;color:var(--c-pmut,#6b6660);margin:8px 2px 0}',
      '#dashboard-main .gp-sk{margin:10px 0}',
      /* Zahnrad und Panel */
      B + ' .gp-kopf{position:relative}',
      B + ' .gp-zahn{font:600 12px Inter,sans-serif;color:var(--c-ptext,#1b1815);background:#fff;border:1px solid var(--c-line,#e0dbd3);border-radius:8px;padding:4px 9px;cursor:pointer}',
      B + ' .gp-zahn:hover{border-color:' + GOLD + '}',
      B + ' .gp-an{position:absolute;right:0;top:100%;z-index:30;width:min(380px,calc(100vw - 32px));max-height:70vh;overflow:auto;background:#fff;border:1px solid var(--c-line,#e0dbd3);border-radius:12px;box-shadow:0 12px 32px rgba(5,5,5,.16);padding:12px 14px}',
      B + ' .gp-an-k{display:flex;justify-content:space-between;align-items:center;font:600 15px "Space Grotesk",sans-serif;margin-bottom:4px}',
      B + ' .gp-an-x{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:var(--c-pmut,#6b6660)}',
      B + ' .gp-an-h{font:600 10px/1.2 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--c-pmut,#6b6660);margin:10px 0 4px}',
      B + ' .gp-an-z{display:flex;gap:8px;align-items:flex-start;padding:5px 0;font-size:12.5px;cursor:pointer}',
      B + ' .gp-an-z input{margin-top:2px;accent-color:' + GOLD + '}',
      B + ' .gp-an-z small{display:block;color:var(--c-pmut,#6b6660);font-size:11px}',
      B + ' .gp-an-z i{font-style:normal;font-size:10.5px;color:var(--dp-gold-txt,#7d682f)}',
      B + ' .gp-an-fest{cursor:default;opacity:.8}',
      B + ' .gp-an-f{display:flex;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--c-line,#e0dbd3)}',
      B + ' .gp-an-b{font:600 12px Inter,sans-serif;border:1px solid var(--c-line,#e0dbd3);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}',
      B + ' .gp-an-ok{background:#050505;color:#FDFCFA;border-color:#050505}',
      '@media (max-width:900px){' + B + ' .gp-vb-raster{grid-template-columns:minmax(0,1fr)}}',
      /* v4260c · Einstellung „Grafiken: hell / dunkel / wie App“ (grafiken-premium.js setzt html[data-gx-stil]) gilt auch hier.
         Die Karten aus DpGrafiken.karte folgen ihr über --gx-*; die eigenen Teile (Leiste, je Objekt, Finanzierung, Panel) hier. */
      'html[data-gx-stil="dunkel"] ' + B + '{--c-ptext:#E9E3D6;--c-pmut:#B9B2A3;--c-line:#2B2720;--dp-gold-txt:var(--wl-e8cc7a,#E8CC7A);color:#E9E3D6}',
      'html[data-gx-stil="dunkel"] ' + B + ' .gp-karte,html[data-gx-stil="dunkel"] ' + B + ' .gp-k,html[data-gx-stil="dunkel"] ' + B + ' .gp-an{background:linear-gradient(180deg,#16140F,#0E0D0B);border-color:#2B2720}',
      'html[data-gx-stil="dunkel"] ' + B + ' .gp-k.gp-haupt{background:color-mix(in srgb,' + GOLD + ' 12%,#0E0D0B);border-color:color-mix(in srgb,' + GOLD + ' 45%,transparent)}',
      'html[data-gx-stil="dunkel"] ' + B + ' .gp-zahn,html[data-gx-stil="dunkel"] ' + B + ' .gp-an-b,html[data-gx-stil="dunkel"] ' + B + ' .gp-filter select{background:#16140F;color:#E9E3D6;border-color:#2B2720}',
      'html[data-gx-stil="dunkel"] ' + B + ' .gp-an-ok{background:var(--wl-c9a84c,#C9A84C);color:#050505;border-color:var(--wl-c9a84c,#C9A84C)}',
      'html[data-gx-stil="dunkel"] ' + B + ' svg text{fill:#B9B2A3}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* SVG-Hilfen (gleiche Klassen wie DpGrafiken: gx-ax, gx-netz, gx-fade) */
  function svgTicks(min, max, n) {
    var span = Math.max(1, max - min), roh = span / n, p = Math.pow(10, Math.floor(Math.log10(roh))), st = [1, 2, 2.5, 5, 10].map(function (m) { return m * p; }).filter(function (s) { return s >= roh; })[0] || p * 10;
    var a = Math.floor(min / st) * st, out = []; for (var v = a; v <= max + st * 0.001; v += st) out.push(Math.round(v)); if (out.length < 2) out.push(a + st); return out;
  }
  function kurzE(v) { var a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e6) return s + nf1.format(a / 1e6) + ' Mio'; if (a >= 1e4) return s + nf0.format(Math.round(a / 1000)) + ' T'; return s + nf0.format(Math.round(a)); }
  function tipA(h) { return ' data-gx-tip="' + esc(h) + '"'; }
  function legende(L) { return '<div class="gx-leg">' + L.map(function (e) { return '<span><i style="background:' + e.f + '"></i>' + esc(e.n) + '</span>'; }).join('') + '</div>'; }
  function f1(v) { return Math.round(v * 10) / 10; }
  /* gestapelte Säulen je Jahr, positiv nach oben, negativ nach unten */
  function saeulen(host, d) {
    var W = Math.max(260, host.clientWidth || 560), H = Math.round(Math.min(300, Math.max(200, W * 0.42))), m = { l: 52, r: 8, t: 12, b: 24 };
    var n = d.x.length, pos = [], neg = [];
    for (var i = 0; i < n; i++) { var p = 0, q = 0; d.reihen.forEach(function (r) { var v = r.werte[i] || 0; if (v >= 0) p += v; else q += v; }); pos.push(p); neg.push(q); }
    var tk = svgTicks(Math.min(0, Math.min.apply(null, neg)), Math.max.apply(null, pos.concat([1])), 4), y0 = tk[0], y1 = tk[tk.length - 1];
    var ys = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b); }, bw = (W - m.l - m.r) / n, sw = Math.max(3, bw * 0.62);
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(d.aria || '') + '">'];
    tk.forEach(function (v) { out.push('<line class="gx-netz" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(ys(v)) + '" y2="' + f1(ys(v)) + '"/><text class="gx-ax" x="' + (m.l - 6) + '" y="' + f1(ys(v) + 4) + '" text-anchor="end">' + kurzE(v) + '</text>'); });
    var schritt = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - m.l - m.r) / 44))));
    for (var j = 0; j < n; j++) {
      var x = m.l + j * bw + (bw - sw) / 2, oben = 0, unten = 0;
      d.reihen.forEach(function (r) {
        var v = r.werte[j] || 0; if (!v) return;
        var a = v >= 0 ? oben : unten, b = a + v; if (v >= 0) oben = b; else unten = b;
        var yA = ys(Math.max(a, b)), yB = ys(Math.min(a, b));
        out.push('<rect class="gx-fade" x="' + f1(x) + '" y="' + f1(yA) + '" width="' + f1(sw) + '" height="' + f1(Math.max(0.5, yB - yA)) + '" rx="1.5" style="fill:' + (v < 0 && r.fNeg ? r.fNeg : r.f) + ';animation-delay:' + (j * 12) + 'ms"/>');
      });
      out.push('<rect x="' + f1(m.l + j * bw) + '" y="' + m.t + '" width="' + f1(bw) + '" height="' + (H - m.t - m.b) + '" style="fill:transparent"' + tipA(d.tip(j)) + '/>');
      if (j % schritt === 0) out.push('<text class="gx-ax" x="' + f1(m.l + j * bw + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + d.x[j] + '</text>');
    }
    if (y0 < 0) out.push('<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(ys(0)) + '" y2="' + f1(ys(0)) + '" style="stroke:currentColor;stroke-opacity:.35"/>');
    out.push('</svg>');
    host.innerHTML = out.join('') + legende(d.reihen.map(function (r) { return { n: r.n, f: r.f }; }));
  }
  /* waagerechte Balken, Teile nebeneinander (Bilanz, je Objekt) */
  function stapelZeile(teile, max) {
    return '<div class="gp-sz">' + teile.map(function (t) { var w = max > 0 ? Math.max(0, t.v) / max * 100 : 0; return w > 0 ? '<i class="gx-fade" style="width:' + w.toFixed(2) + '%;background:' + t.f + '"' + (t.tip ? tipA(t.tip) : '') + '></i>' : ''; }).join('') + '</div>';
  }
  /* waagerechte Balken um null (Steuerwirkung je Objekt) */
  function nullBalken(host, L, summeV, F) {
    var max = Math.max.apply(null, L.map(function (x) { return Math.abs(x.v); }).concat([Math.abs(summeV), 1]));
    var zeile = function (x, sum) {
      var w = Math.abs(x.v) / max * 50, rechts = x.v >= 0, farbe = sum ? F.tinte : (x.v >= 0 ? F.gruen : F.rot);
      return '<div class="gp-nb' + (sum ? ' gp-nb-sum' : '') + '"' + (x.tip ? tipA(x.tip) : '') + '><span class="gp-nb-n" title="' + esc(x.n) + '">' + esc(x.n) + '</span><span class="gp-nb-b"><i class="gp-nb-0"></i>'
        + '<i class="gx-fade" style="' + (rechts ? 'left:50%' : 'right:50%') + ';width:' + w.toFixed(2) + '%;background:' + farbe + '"></i></span><span class="gp-nb-v" style="color:' + (sum ? 'inherit' : farbe) + '">' + eurV(x.v) + '</span></div>';
    };
    host.innerHTML = '<div class="gp-nbs">' + L.map(function (x) { return zeile(x, false); }).join('') + zeile({ n: 'Summe', v: summeV }, true) + '</div>';
  }

  function vbZeichnen(app) {
    var G = window.DpGrafiken; if (!G || !G.karte || !G.verlauf) return;
    var sec = app.querySelector(':scope > .cp-sek[data-sek="projektion"]') || document.getElementById('dp-charts-sec');
    var vc = sec && sec.querySelector('.vb-charts'); if (!vc) return;
    var V = null; try { V = window.DealPilotDashboard.vermoegenBlick(); } catch (e) { V = null; }
    if (!V || !V.H || !V.PR || !V.PR.length) return;
    var host = vc.querySelector(':scope > [data-dp-gp="vb"]');
    if (!host) { host = document.createElement('div'); host.setAttribute('data-dp-gp', 'vb'); host.className = 'dp-gp gp-vb'; vc.insertBefore(host, vc.firstChild); }
    var PR = V.PR, H = V.H, last = PR[PR.length - 1], X = PR.map(function (r) { return r.yr; }), A = V.annahmen || {};
    document.body.classList.add('dp-gp-vb');
    var sig = JSON.stringify([Math.round(H.wert), Math.round(H.rest), PR.length, Math.round(last.eq), Math.round(last.cumCf || 0), Math.round((vc.clientWidth || 0) / 40), document.documentElement.getAttribute('data-gx-stil') || '']);
    if (host.getAttribute('data-gp-sig') === sig && host.querySelector('svg')) return;
    document.body.classList.add('dp-gp-vb');   /* vorher: .vb-charts ist sonst ein Raster und die Karten messen nur eine Spalte */
    var F = G.farben || {}, pz = function (v) { return nf1.format(v * 100) + ' %'; };
    var annahme = 'Modell: Wertansatz Kaufpreis, Wert ' + pz(A.wert || 0.02) + ' und Miete ' + pz(A.miete || 0.015) + ' im Jahr, Zins rund ' + pz(A.zins || 0.035) + '. Kein Verkehrswert.';
    host.innerHTML = '<div class="gp-vb-raster"><div class="gp-vbk gp-breit" data-gp-k="vb-eq"></div><div class="gp-vbk" data-gp-k="vb-bilanz"></div><div class="gp-vbk" data-gp-k="vb-objekte"></div><div class="gp-vbk gp-breit" data-gp-k="vb-cf"></div><div class="gp-vbk gp-breit" data-gp-k="vb-quellen"></div></div><p class="gp-vb-fuss">' + esc(annahme) + '</p>';
    var el = function (k) { return host.querySelector('[data-gp-k="' + k + '"]'); };

    /* 1 · Eigenkapital-Entwicklung */
    var zuw = last.eq - H.ek;
    var i1 = G.karte(el('vb-eq'), { eyebrow: 'Vermögen · Projektion', titel: 'Dein Eigenkapital wächst bis ' + last.yr + ' auf ' + mio(last.eq), unter: 'Heute ' + mio(H.ek) + ', das sind ' + (zuw >= 0 ? '+' : '−') + mio(Math.abs(zuw)) + ' in ' + PR.length + ' Jahren. Die grüne Fläche zwischen Wert und Restschuld ist dein Anteil.', chips: ['Modell'] });
    /* v4480 · Stil wie Wertverlauf der Pilot-Analyse: grün, wo dir etwas gehört, rot, wo die Restschuld den Wert übersteigt, Gold nur für den Wert */
    var gruenF = 'color-mix(in srgb,' + F.gruen + ' 16%,transparent)', rotF = 'color-mix(in srgb,' + F.rot + ' 18%,transparent)', ueber = PR.some(function (r) { return r.wert < r.rest; });
    G.verlauf(i1, { x: X, heute: X[0],
      baender: [{ ohneRand: true, farbe: gruenF, lo: PR.map(function (r) { return r.wert >= r.rest ? r.rest : null; }), hi: PR.map(function (r) { return r.wert >= r.rest ? r.wert : null; }) },
        { ohneRand: true, farbe: rotF, lo: PR.map(function (r) { return r.wert < r.rest ? r.wert : null; }), hi: PR.map(function (r) { return r.wert < r.rest ? r.rest : null; }) }],
      reihen: [{ werte: PR.map(function (r) { return r.wert; }), farbe: F.gold, dick: 2.4 }, { werte: PR.map(function (r) { return r.rest; }), farbe: F.tinte2, dick: 2 }, { werte: PR.map(function (r) { return r.eq; }), farbe: F.gruen, dick: 2.4, gestrichelt: true }],
      legende: [{ n: 'Objektwert', f: F.gold }, { n: 'Restschuld', f: F.tinte2 }, { n: 'Eigenkapital', f: F.gruen }, { n: 'dein Anteil', f: gruenF }].concat(ueber ? [{ n: 'Restschuld über Wert', f: rotF }] : []),
      tip: function (i, j) { var r = PR[i]; return '<b>' + j + '</b><br>Objektwert ' + eur(r.wert) + '<br>Restschuld ' + eur(r.rest) + '<br>Eigenkapital ' + eur(r.eq) + '<br>Beleihung ' + (r.wert ? nf1.format(r.rest / r.wert * 100) + ' %' : 'keine Angabe'); } },
      { aria: 'Eigenkapital-Entwicklung' });

    /* 2 · Vermögensbilanz heute */
    var objs = H.objs.slice().sort(function (a, b) { return b.wert - a.wert; }), tot = Math.max(H.wert, H.rest + Math.max(H.ek, 0)) || 1;
    var toene = [F.tinte2, F.tinte3, F.neutral], ekQ = H.wert > 0 ? H.ek / H.wert * 100 : null;
    var i2 = G.karte(el('vb-bilanz'), { eyebrow: 'Vermögen · heute', titel: 'Dir gehören ' + (ekQ != null ? nf0.format(Math.round(ekQ)) + ' %' : 'keine Angabe') + ' deines Portfolios', unter: 'Aktiva ' + mio(H.wert) + ' zu Kaufpreisen. Passiva: Restschuld ' + mio(H.rest) + ' und Eigenkapital ' + mio(H.ek) + '.' });
    i2.innerHTML = '<div class="gp-bil"><div class="gp-bil-z"><span>Aktiva</span>' + stapelZeile(objs.map(function (x, i) { return { v: x.wert, f: 'color-mix(in srgb,' + toene[i % 3] + ' ' + (100 - Math.min(i, 8) * 7) + '%,transparent)', tip: '<b>' + esc(x.name) + '</b><br>' + eur(x.wert) + ' · ' + nf1.format(x.wert / (H.wert || 1) * 100) + ' %' }; }), tot) + '<b>' + mio(H.wert) + '</b></div>'
      + '<div class="gp-bil-z"><span>Passiva</span>' + stapelZeile([{ v: H.rest, f: F.tinte3, tip: '<b>Restschuld</b><br>' + eur(H.rest) }, { v: Math.max(H.ek, 0), f: F.gruen, tip: '<b>Eigenkapital</b><br>' + eur(H.ek) }], tot) + '<b>' + mio(H.rest + H.ek) + '</b></div></div>'
      + legende([{ n: 'Restschuld ' + mio(H.rest), f: F.tinte3 }, { n: 'Eigenkapital ' + mio(H.ek), f: F.gruen }])
      + (H.ek < 0 ? '<p class="gx-s" style="color:' + F.rot + '">Die Restschuld liegt über dem Wertansatz, das Eigenkapital ist negativ.</p>' : '');

    /* 3 · Vermögen nach Objekt und Lage */
    var mx = 0; objs.forEach(function (x) { mx = Math.max(mx, x.wert, x.rest); }); mx = mx || 1;
    var byOrt = {}; objs.forEach(function (x) { byOrt[x.ort] = (byOrt[x.ort] || 0) + x.wert; });
    var orte = Object.keys(byOrt).sort(function (a, b) { return byOrt[b] - byOrt[a]; }), top1 = objs[0];
    var i3 = G.karte(el('vb-objekte'), { eyebrow: 'Vermögen · je Objekt', titel: top1 && H.wert > 0 ? 'Größtes Objekt trägt ' + nf0.format(Math.round(top1.wert / H.wert * 100)) + ' %, größter Ort ' + nf0.format(Math.round(byOrt[orte[0]] / H.wert * 100)) + ' %' : 'Vermögen nach Objekt', unter: 'Balken: grau der Teil der Bank, grün dein Eigenkapital, rot die Restschuld über dem Wert.' });
    i3.innerHTML = '<div class="gp-vo">' + objs.map(function (x) {
      return '<div class="gp-vo-z"' + tipA('<b>' + esc(x.name) + '</b><br>Wert ' + eur(x.wert) + '<br>Restschuld ' + eur(x.rest) + '<br>Eigenkapital ' + eur(x.ek)) + '><span class="gp-vo-n" title="' + esc(x.name) + '">' + esc(x.name) + '<small>' + esc(x.ort) + '</small></span>'
        + stapelZeile([{ v: Math.min(x.rest, x.wert), f: F.tinte3 }, { v: Math.max(x.ek, 0), f: F.gruen }, { v: Math.max(x.rest - x.wert, 0), f: F.rot }], mx)
        + '<span class="gp-vo-v">' + mio(x.wert) + '<small style="color:' + (x.ek >= 0 ? F.gruen : F.rot) + '">EK ' + mio(x.ek) + '</small></span></div>';
    }).join('') + '</div>'
      + '<div class="gp-ort"><span class="gx-eye">Verteilung nach Lage · ' + orte.length + ' Ort' + (orte.length === 1 ? '' : 'e') + '</span>' + stapelZeile(orte.map(function (o, i) { return { v: byOrt[o], f: 'color-mix(in srgb,' + toene[i % 3] + ' ' + (100 - Math.floor(i / 3) * 25) + '%,transparent)', tip: '<b>' + esc(o) + '</b><br>' + nf1.format(byOrt[o] / (H.wert || 1) * 100) + ' %' }; }), H.wert || 1)
      + legende(orte.slice(0, 6).map(function (o, i) { return { n: o + ' ' + nf0.format(Math.round(byOrt[o] / (H.wert || 1) * 100)) + ' %', f: 'color-mix(in srgb,' + toene[i % 3] + ' ' + (100 - Math.floor(i / 3) * 25) + '%,transparent)' }; }).concat(orte.length > 6 ? [{ n: '+ ' + (orte.length - 6) + ' weitere', f: 'transparent' }] : [])) + '</div>';

    /* 4 · Woraus das Vermögen wächst */
    /* v4480 · Quellen in Grün abgestuft wie der Vermögenszuwachs im Reiter Bewertung, ein Minus rot */
    var R = [{ n: 'Schuldenabbau (Tilgung)', f: 'color-mix(in srgb,' + F.gruen + ' 35%,transparent)', fNeg: F.rot, werte: PR.map(function (r) { return r.tilg; }) },
      { n: 'Wertsteigerung', f: 'color-mix(in srgb,' + F.gruen + ' 65%,transparent)', fNeg: F.rot, werte: PR.map(function (r, i) { return i ? r.wert - PR[i - 1].wert : 0; }) },
      { n: 'Überschuss nach Steuer', f: F.gruen, fNeg: 'color-mix(in srgb,' + F.rot + ' 75%,transparent)', werte: PR.map(function (r) { return r.cfNach; }) }];
    var sumZ = 0; for (var q = 0; q < PR.length; q++) R.forEach(function (r) { sumZ += r.werte[q] || 0; });
    var i4 = G.karte(el('vb-quellen'), { eyebrow: 'Vermögen · Zuwachs je Jahr', titel: 'Zusammen ' + mio(sumZ) + ' Zuwachs in ' + PR.length + ' Jahren', unter: 'Je Jahr aus Tilgung, Wertsteigerung und Überschuss nach Steuer.', chips: ['Modell'] });
    saeulen(i4, { x: X, reihen: R, aria: 'Woraus das Vermögen wächst', tip: function (j) { var s = 0; return '<b>' + X[j] + '</b>' + R.map(function (r) { s += r.werte[j] || 0; return '<br>' + esc(r.n) + ' ' + eurV(r.werte[j]); }).join('') + '<br><b>Zuwachs ' + eurV(s) + '</b>'; } });

    /* 5 · v4480 · Cashflow vor und nach Steuer im Verlauf, Stil „Verlauf mit Steuern" der Pilot-Analyse */
    var cfEl = el('vb-cf');
    if (cfEl && PR.some(function (r) { return r.cfVor != null; })) {
      var c0 = PR[0], cE = last, stS = 0; PR.forEach(function (r) { stS += (r.cfNach || 0) - (r.cfVor || 0); });
      var plusJ = null; for (var u = 0; u < PR.length; u++) if ((PR[u].cfNach || 0) >= 0) { plusJ = PR[u].yr; break; }
      var i5 = G.karte(cfEl, { eyebrow: 'Cashflow · Verlauf', titel: 'Nach Steuer ' + eurV(c0.cfNach / 12) + ' im Monat ' + c0.yr + ', ' + eurV(cE.cfNach / 12) + ' im Monat ' + cE.yr,
        unter: 'Alle Objekte zusammen je Jahr. Grüne Fläche: die Steuer bringt Geld. Rote Fläche: sie kostet Geld. Über ' + PR.length + ' Jahre wirkt die Steuer mit ' + eurV(stS) + '.', chips: ['Modell'] });
      var mk5 = []; if (plusJ && plusJ !== X[0]) mk5.push({ j: plusJ, text: 'nach Steuer im Plus', farbe: F.gruen, zeile: 0 });
      G.verlauf(i5, { x: X, heute: X[0],
        baender: [{ ohneRand: true, farbe: gruenF, lo: PR.map(function (r) { return r.cfNach >= r.cfVor ? r.cfVor : null; }), hi: PR.map(function (r) { return r.cfNach >= r.cfVor ? r.cfNach : null; }) },
          { ohneRand: true, farbe: rotF, lo: PR.map(function (r) { return r.cfNach < r.cfVor ? r.cfNach : null; }), hi: PR.map(function (r) { return r.cfNach < r.cfVor ? r.cfVor : null; }) }],
        reihen: [{ werte: PR.map(function (r) { return r.cfVor; }), farbe: F.tinte3, dick: 2, gestrichelt: true }, { werte: PR.map(function (r) { return r.cfNach; }), farbe: F.tinte, dick: 2.6 }],
        marken: mk5,
        legende: [{ n: 'vor Steuer', f: F.tinte3 }, { n: 'nach Steuer', f: F.tinte }, { n: 'Steuer bringt Geld', f: gruenF }, { n: 'Steuer kostet Geld', f: rotF }],
        tip: function (q, j) { var r = PR[q]; return '<b>' + j + '</b><br>Miete ' + eur(r.miete) + '<br>vor Steuer ' + eurV(r.cfVor) + '<br>Steuer ' + eurV((r.cfNach || 0) - (r.cfVor || 0)) + '<br>nach Steuer ' + eurV(r.cfNach); } },
        { aria: 'Cashflow vor und nach Steuer über die Jahre' });
    }

    host.setAttribute('data-gp-sig', sig);
    document.body.classList.add('dp-gp-vb');
  }

  function skZeichnen(app) {
    var G = window.DpGrafiken; if (!G || !G.karte) return;
    var k = document.getElementById('dp-steuerkette'); if (!k) return;
    var boxen = [].slice.call(k.querySelectorAll('.sk-box.sk-box-h')); if (!boxen.length) return;
    var D = null; try { D = window.DealPilotDashboard.steuerKetteDaten(); } catch (e) { D = null; }
    if (!D || !D.toepfe || !D.toepfe.length) return;
    var F = G.farben || {};
    boxen.forEach(function (box) {
      var cv = box.querySelector('canvas'), m = cv && /dpc-kette-(\d+)/.exec(cv.id || ''), t = m ? D.toepfe[+m[1]] : null; if (!t || !t.schritte || !t.schritte.length) return;
      var h = box.nextElementSibling && box.nextElementSibling.getAttribute('data-dp-gp') === 'sk' ? box.nextElementSibling : null;
      var sig = JSON.stringify([t.name, Math.round(t.summe), t.schritte.length, Math.round((box.parentNode.clientWidth || 0) / 40)]);
      if (h && h.getAttribute('data-gp-sig') === sig) { box.classList.add('gp-ersetzt'); return; }
      if (!h) { h = document.createElement('div'); h.setAttribute('data-dp-gp', 'sk'); h.className = 'gp-sk'; box.parentNode.insertBefore(h, box.nextSibling); }
      var spar = t.summe >= 0;
      var inn = G.karte(h, { eyebrow: 'Steuer · ' + (t.name || ''), titel: 'Deine Objekte ' + (spar ? 'senken' : 'erhöhen') + ' die Steuer um ' + eur(Math.abs(t.summe)), unter: 'Je Objekt in der Reihenfolge des Kaufs. Grün spart Steuer, rot kostet Steuer.' });
      nullBalken(inn, t.schritte.map(function (s, i) { return { n: (i + 1) + '  ' + (s.name || 'Objekt'), v: s.wirkung, tip: '<b>' + esc(s.name || 'Objekt') + '</b><br>Ergebnis ' + eurV(s.erg) + '<br>Grenzsteuersatz ' + nf1.format(s.satzVor || 0) + ' % auf ' + nf1.format(s.satzNach || 0) + ' %<br>Wirkung ' + eurV(s.wirkung) }; }), t.summe, F);
      h.setAttribute('data-gp-sig', sig);
      box.classList.add('gp-ersetzt');
    });
  }
  function stil3() {
    if (document.getElementById('dp-gp-stil3')) return;
    var s = document.createElement('style'); s.id = 'dp-gp-stil3';
    var B = '#dashboard-main';
    s.textContent = [
      '#dp-stage.cp-genau .gp-kpbox{display:none}', '#dp-stage.cp-einfach .gp-kp-orig{display:none}',
      '#dp-stage .gp-kpbox{margin:4px 0 8px;padding-left:18px;font-size:12.5px;line-height:1.55;color:var(--gx-tinte,#2A2727)}', '#dp-stage .gp-kpbox li{margin:2px 0}', '#dp-stage .gp-kpbox li::marker{color:var(--gx-tinte3,#8A8276)}',   /* v4480 */
      '#dashboard-main i.zb-wh-m{background:color-mix(in srgb,#3FA56C 55%,transparent)}', '#dashboard-main i.zb-wh-z{background:#3FA56C}',   /* v4480 · Woher das Plus: grün abgestuft statt Gold/Schwarz */
      B + ' .gp-sz{position:relative;display:flex;height:14px;border-radius:4px;overflow:hidden;background:color-mix(in srgb,currentColor 6%,transparent);flex:1;min-width:0}',
      B + ' .gp-sz i{display:block;height:100%}',
      B + ' .gp-bil{display:flex;flex-direction:column;gap:12px;margin:6px 0 10px}',
      B + ' .gp-bil-z{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:10px;align-items:center;font-size:12px}',
      B + ' .gp-bil-z .gp-sz{height:26px;border-radius:6px}',
      B + ' .gp-bil-z span{font:600 10px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--gx-tinte2,#6b6660)}',
      B + ' .gp-bil-z b{font:600 13px "Space Grotesk",sans-serif;white-space:nowrap}',
      B + ' .gp-vo{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto;padding-right:2px}',
      B + ' .gp-vo-z{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) auto;gap:8px;align-items:center;font-size:12px}',
      B + ' .gp-vo-n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      B + ' .gp-vo-n small,' + B + ' .gp-vo-v small{display:block;font-size:10.5px;color:var(--gx-tinte3,#8A8276)}',
      B + ' .gp-vo-v{font:500 11.5px "JetBrains Mono",monospace;text-align:right;white-space:nowrap}',
      B + ' .gp-ort{margin-top:12px;padding-top:10px;border-top:1px solid var(--gx-linie,#EFE8DA)}',
      B + ' .gp-ort .gp-sz{height:12px;margin:6px 0 4px}',
      B + ' .gp-nbs{display:flex;flex-direction:column;gap:3px}',
      B + ' .gp-nb{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,2fr) 92px;gap:8px;align-items:center;font-size:12px}',
      B + ' .gp-nb-n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      B + ' .gp-nb-b{position:relative;height:14px}',
      B + ' .gp-nb-b i{position:absolute;top:2px;height:10px;border-radius:2px}',
      B + ' .gp-nb-b .gp-nb-0{left:50%;top:-2px;bottom:-2px;height:auto;width:1px;border-radius:0;background:var(--gx-linie2,#D9CFBC)}',
      B + ' .gp-nb-v{font:500 11.5px "JetBrains Mono",monospace;text-align:right;white-space:nowrap}',
      B + ' .gp-nb-sum{font-weight:600;border-top:1px solid var(--gx-linie,#EFE8DA);padding-top:4px;margin-top:2px}',
      '@media (max-width:640px){' + B + ' .gp-nb{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 78px}' + B + ' .gp-vo-z{grid-template-columns:minmax(0,1fr) auto}' + B + ' .gp-vo-z .gp-sz{grid-column:1/-1;order:3}' + B + ' .gp-bil-z{grid-template-columns:54px minmax(0,1fr)}' + B + ' .gp-bil-z b{grid-column:2}}'
    ].join('\n');
    document.head.appendChild(s);
  }

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
      host.addEventListener('click', function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('[data-gp-a]') : null; if (!b || !host.contains(b)) return; var a = b.getAttribute('data-gp-a');
        if (a === 'ansicht') ansichtOeffnen(); });   /* v4640 · Seitenleiste statt Panel */
    }
    /* Vermögen: Überschrift und die Gesamtbewertung aus dashboard.js (Investiert, Bilanz heute, nach Bewertung) hierher */
    if (!hosts.gb.querySelector('.gp-sl')) hosts.gb.insertAdjacentHTML('afterbegin', sl('Vermögen', 'investiert, dir gehört heute, Wert'));
    var gbe = document.getElementById('dp-gesamtbew'); if (gbe && gbe.parentNode !== hosts.gb) hosts.gb.appendChild(gbe);
    /* Steuer über alle Objekte steht jetzt unter „Cashflow und Steuer" als Detail: einmalig zugeklappt */
    try { if (!localStorage.getItem('dp_gp_steuer_zu')) { var stk = app.querySelector(':scope > .cp-sek[data-sek="steuer"]'); if (stk) { stk.classList.add('cp-zu'); var z = {}; try { z = JSON.parse(localStorage.getItem('dp_cockpit_zu') || '{}') || {}; } catch (e) {} z.steuer = 1; localStorage.setItem('dp_cockpit_zu', JSON.stringify(z)); localStorage.setItem('dp_gp_steuer_zu', '1'); } } } catch (e) {}
    var D = null; try { D = window.DealPilotDashboard.blickDaten(); } catch (e) { D = null; }
    var sig = D ? JSON.stringify([D.n, Math.round(D.S.cfNsJ), Math.round(D.S.rest), (D.W || []).map(function (x) { return Math.round(x.wert); }), _f, Math.round(host.getBoundingClientRect().width / 40)]) : '';
    stil2(); stil3(); stil4();   /* v4640 */
    /* v4260 · die übrigen Cockpit-Grafiken im neuen Stil (zeichnen nur, wenn sich ihre Daten geändert haben) */
    try { vbZeichnen(app); } catch (e) { try { console.warn('[grafiken-portfolio] Vermögen', e); } catch (x) {} }
    try { skZeichnen(app); } catch (e) { try { console.warn('[grafiken-portfolio] Steuer', e); } catch (x) {} }
    try { textPflege(document.getElementById('dp-stage')); } catch (e) {}   /* v4480 */
    try { zbTipps(app); } catch (e) {}   /* v4640 */
    if (sig && host.getAttribute('data-gp-sig') === sig) { ansichtAnwenden(); return; }
    if (zeichnen(host, hosts)) { host.setAttribute('data-gp-sig', sig); document.body.classList.add('dp-gp-an'); panelNeu(); }
    ansichtAnwenden();
  }
  /* v4480 · Marcel 24.11.2026: „mit Bullet Points arbeiten, übersichtlich". Lange Sätze im Cockpit werden in der Ansicht
     Einfach zu Stichpunkten (der Absatz bleibt für Genau stehen, CSS wählt). Dazu Kundentext ohne Gedankenstrich und
     Semikolon (Regel seit 22.11.): nur Anzeige, die Quelltexte in dashboard.js bleiben unverändert. */
  function saetze(s) {
    var out = [], buf = '';
    String(s).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„"])/).forEach(function (x) {
      x = x.trim(); if (!x) return;
      var ganz = (buf + x).trim();
      if (/(^|\s)(z|d|u|v|vgl|ca|bzw|inkl|ggf|Nr|S|Abs|B|h|a|Mio|Tsd)\.$/.test(ganz)) { buf = ganz + ' '; return; }   /* Abkürzung am Ende: mit dem nächsten Stück verbinden */
      out.push(ganz); buf = '';
    });
    if (buf) out.push(buf.trim());
    return out.filter(function (x) { return x.length > 1; });
  }
  function textPflege(app) {
    if (!app) return;
    /* Gedankenstrich und Semikolon im sichtbaren Text */
    try {
      var W = document.createTreeWalker(app, NodeFilter.SHOW_TEXT), n, L = [];
      while ((n = W.nextNode())) { if (/ [–—] |; /.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest('script,style,textarea,input,[contenteditable]'))) L.push(n); }
      L.forEach(function (n) {
        n.nodeValue = n.nodeValue.replace(/ [—–] (?=\d+ KPI)/g, ' · ').replace(/ [–—] /g, ', ').replace(/; (\S)/g, function (m, c) { return '. ' + c.toUpperCase(); });
      });
    } catch (e) {}
    /* Stichpunkte: Absätze ab 140 Zeichen mit mindestens zwei Sätzen */
    var K = app.querySelectorAll('#dp-einfach p, #dp-einfach .ke2-satz, #dp-pp-slot p, .gp-karte .gp-u, .cp-sek p.cp-erkl, .cp-sek .zb-det-satz');
    Array.prototype.forEach.call(K, function (el) {
      if (el.hasAttribute('data-gp-kp') || el.closest('table, details, .gp-kpbox, svg, .gp-tip')) return;
      if (el.querySelector('p, ul, ol, table, input, button, select, a')) return;
      var tx = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (tx.length < 140) return;
      var s = saetze(tx); if (s.length < 2 && tx.split(' · ').length >= 3) s = tx.split(' · ');
      if (s.length < 2) return;
      el.setAttribute('data-gp-kp', '1'); el.classList.add('gp-kp-orig');
      var ul = document.createElement('ul'); ul.className = 'gp-kpbox';
      ul.innerHTML = s.slice(0, 5).map(function (x) { return '<li>' + esc(x.replace(/[.]$/, '')) + '</li>'; }).join('');
      el.parentNode.insertBefore(ul, el);
    });
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
  window.DpGrafikenPortfolio = { zeichnen: function (host) { stil(); return zeichnen(host); }, an: function () { return AN; }, ansichtOeffnen: ansichtOeffnen, ANSICHT: ANSICHT, sichtbar: sichtbar, neu: function () { var h = document.querySelector('[data-dp-gp="kopf"]'); if (h) h.removeAttribute('data-gp-sig'); lauf(); },
    _test: { projektion: projektion, bindKalender: bindKalender, hinweise: hinweise, bereich: bereich } };
  /* v4260 · Einstellungen › Anzeige-Optionen › „Portfolio-Cockpit: Grafiken auswählen“: Einstellungen zu, Cockpit auf, Panel auf */
  window._dpCockpitAnsicht = function () {
    try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (e) {}
    setTimeout(function () {
      try { if (window.DealPilotDashboard && window.DealPilotDashboard.open) window.DealPilotDashboard.open(); } catch (e) {}
      var n = 0, t = setInterval(function () { n++; if (document.querySelector('[data-dp-gp="kopf"] .gp-kopf')) { clearInterval(t); ansichtOeffnen(); } else if (n > 40) clearInterval(t); }, 250);
    }, 160);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pruefeFreigabe); else pruefeFreigabe();
  window.addEventListener('dp:vorschau', pruefeFreigabe);
  window.addEventListener('dp:plan-ready', function () { setTimeout(pruefeFreigabe, 300); });
})();
