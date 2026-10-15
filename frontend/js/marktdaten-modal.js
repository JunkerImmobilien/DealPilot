/* ═══════════════════════════════════════════════════════════════════════
   v2247 · MARKTDATEN & KONDITIONEN — das Fenster hinter „Marktdaten ansehen"
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 15.10.2026: „die Grafik zum Verlauf … unter Finanzierung und
   dann Marktdaten ansehen integrieren und wie sich das dann zusammensetzt.
   Dann kannst du … dieses Modal … optisch anpassen, dass das zur
   DealPilot-Optik passt. … Sachen, die nicht relevant sind, kannst du
   auch rausnehmen."

   GEMESSEN vorher: 2.476 px hoch, drei Karten auf Beige mit Tuerkis-
   Akzenten (EZB/Euribor · MFI-Statistik mit 12-Monats-Chart, Linien-
   Schaltern und Empfehlung · Konditionen). Die Karten wurden beim Oeffnen
   aus #v10-cards-source ins Fenster VERSCHOBEN (v10.js).

   JETZT: eigenes Fenster in der Hausoptik, die alten Karten bleiben
   unberuehrt in ihrem versteckten Behaelter (ihre Module rechnen dort
   weiter und speisen die Kopfzeile). Inhalt, in der Reihenfolge der
   Frage, die ein Investor hat:
     1. Was kostet mein Geld?  — Zins fuer Bindung x LTV, gross
     2. Woraus besteht er?     — Bundesanleihe + Marktaufschlag
                                 + Angebotsniveau + Beleihungszuschlag
     3. Wie hat er sich bewegt? — Verlauf (12 Wochen / 13 Monate)
     4. Was gilt je Bindung?   — vier Kacheln
     5. Wo steht der Geldmarkt? — EZB-Leitzins, Euribor, Ø abgeschlossen
   Weggefallen: die Linien-Schalter der MFI-Grafik (die Linien stehen jetzt
   in der Verlaufsgrafik), die doppelte Quellen-Zeile je Karte.

   Zahlen kommen aus /market-rates/pfandbrief (bauzinsService, v2245) —
   dieselbe Antwort wie Kacheln und Landingpage. Die Summe wird aus
   dpGetIndicativeZins genommen, der Marktaufschlag als Rest gezeigt: so
   geht die Gleichung immer auf den Cent auf.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var D = null, CTX = null, CUR = null;
  var wahl = { b: 10, ltv: 80, ansicht: 'monate' };
  var chart = null, escH = null;

  function $(id) { return document.getElementById(id); }
  function pz(v, s) { if (v == null || !isFinite(v)) return '–'; return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + (s === false ? '' : ' %'); }
  function pp(v) { if (v == null || !isFinite(v)) return '–'; var r = Math.round(v * 100) / 100; return (r < 0 ? '−' : '+') + Math.abs(r).toFixed(2).replace('.', ','); }
  var MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function monat(m) { if (!m) return '–'; var p = String(m).split('-'); return MON[(+p[1] || 1) - 1] + ' ' + p[0].slice(2); }
  function datum(d) { if (!d) return '–'; var p = String(d).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function zuschlag(ltv) {
    var st = (D && D.formel && D.formel.zuschlaege) || [[60, -0.2], [70, -0.1], [80, 0], [90, 0.22], [100, 0.45], [110, 0.95]];
    if (ltv <= st[0][0]) return st[0][1];
    for (var i = 1; i < st.length; i++) {
      if (ltv <= st[i][0]) { var a = st[i - 1], b = st[i]; return a[1] + (b[1] - a[1]) * (ltv - a[0]) / (b[0] - a[0]); }
    }
    return st[st.length - 1][1];
  }
  function zins(b, ltv) {
    try { if (typeof global.dpGetIndicativeZins === 'function') { var z = global.dpGetIndicativeZins(b, null, ltv); if (z != null) return z; } } catch (e) {}
    if (!D || !D.formel) return null;
    return Math.round((D.formel.bund[b] + D.formel.aufschlag[b] + D.formel.k + zuschlag(ltv)) * 100) / 100;
  }

  /* LTV des offenen Objekts, wenn es einen hat - sonst 80 %. */
  function objektLtv() {
    try { var l = global.State && State.kpis && +State.kpis.ltv; if (l > 0 && l < 200) return Math.round(l); } catch (e) {}
    return 80;
  }

  function css() {
    if ($('dpmd-css')) return;
    var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GD = 'var(--wl-b8932f, #b8932f)';
    var s = document.createElement('style');
    s.id = 'dpmd-css';
    /* IDs vorn: ein Blatt im HEAD verliert sonst gegen style.css (Probe-Lehre). */
    var P = '#v10-market-modal .v10-modal-content.dpmd-an';
    s.textContent = [
      P + '{background:#FDFCFA;padding:0;width:min(940px,96vw);max-width:96vw;max-height:92vh;overflow:auto;border-radius:14px;color:#1b1916}',
      P + ' > .v10-modal-header,' + P + ' > .v10-modal-body{display:none}',
      P + ' > .v10-modal-close{z-index:3;color:#f3ead0;background:transparent;border-color:color-mix(in srgb,' + G + ' 45%,transparent)}',
      '#dpmd{font-family:Inter,system-ui,sans-serif}',
      '#dpmd .md-kopf{background:var(--obsidian,#050505);color:#f3ead0;padding:22px 64px 20px 26px;position:relative}',
      '#dpmd .md-kopf::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GD + ')}',
      '#dpmd .md-eye{font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:' + GH + '}',
      '#dpmd .md-t{font:600 22px/1.2 "Space Grotesk",Inter,sans-serif;margin:7px 0 4px}',
      '#dpmd .md-s{font-size:12.5px;opacity:.78}',
      '#dpmd .md-in{padding:20px 24px 22px;display:flex;flex-direction:column;gap:18px}',
      '#dpmd .md-karte{background:#fff;border:1px solid #ece4cf;border-radius:12px;padding:18px 18px 16px}',
      '#dpmd .md-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
      '#dpmd .md-h b{font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#6b6252}',
      '#dpmd .md-h span{font-size:11.5px;color:#7a7160}',
      /* Wahl: Bindung + Beleihung */
      '#dpmd .md-wahl{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center}',
      '#dpmd .md-gr{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '#dpmd .md-gr > i{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#7a7160;font-style:normal;margin-right:4px}',
      /* !important: style.css faerbt jeden Knopf in .sec mit
         `.sec button:not(...)` !important weiss (gemessen am Kaskaden-Walker). */
      '#dpmd .md-chip{border:1px solid #e3d9bf !important;background:#fff !important;color:#3b3528 !important;border-radius:999px !important;padding:6px 11px !important;font:600 12px/1 Inter,sans-serif !important;cursor:pointer;min-height:30px}',
      '#dpmd .md-chip.an{background:var(--obsidian,#050505) !important;color:#f3ead0 !important;border-color:var(--obsidian,#050505) !important}',
      '#dpmd .md-chip:focus-visible{outline:2px solid ' + G + ';outline-offset:2px}',
      /* Held: Zins + Gleichung */
      '#dpmd .md-held{display:grid;grid-template-columns:minmax(0,200px) minmax(0,1fr);gap:20px;align-items:center;margin-top:16px}',
      '#dpmd .md-zins{font:600 44px/1 "Space Grotesk",Inter,sans-serif;color:#1b1916;letter-spacing:-.01em}',
      '#dpmd .md-zins-u{font-size:12px;color:#6b6252;margin-top:6px}',
      '#dpmd .md-gl{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px}',
      '#dpmd .md-tl{flex:1 1 110px;min-width:0;border-radius:10px;padding:10px 11px;background:#FBF6E9;border:1px solid #efe5c8}',
      '#dpmd .md-tl.bund{background:#f3f1ec;border-color:#e4e0d6}',
      '#dpmd .md-tl.summe{background:var(--obsidian,#050505);border-color:var(--obsidian,#050505);color:#f3ead0}',
      '#dpmd .md-tl em{display:block;font:600 9.5px/1.25 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;font-style:normal;color:#6b6252}',
      '#dpmd .md-tl.summe em{color:' + GH + '}',
      '#dpmd .md-tl strong{display:block;font:600 19px/1.15 "Space Grotesk",Inter,sans-serif;margin-top:6px}',
      '#dpmd .md-tl small{display:block;font-size:10.5px;line-height:1.35;color:#7a7160;margin-top:4px}',
      '#dpmd .md-tl.summe small{color:#d9cfb4}',
      '#dpmd .md-op{align-self:center;font:600 16px/1 "Space Grotesk",sans-serif;color:#8a806c}',
      /* Verlauf */
      '#dpmd .md-cw{position:relative;height:260px}',
      '#dpmd .md-satz{font-size:13px;line-height:1.5;color:#3b3528;margin:0 0 10px}',
      '#dpmd .md-satz b{color:#1b1916}',
      '#dpmd .md-leg{display:flex;flex-wrap:wrap;gap:14px;font-size:11.5px;color:#5d5546;margin-top:10px}',
      '#dpmd .md-leg i{display:inline-block;width:12px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}',
      '#dpmd .md-leg i.bar{height:10px;width:10px;border-radius:2px}',
      /* Konditionen */
      '#dpmd .md-k4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '#dpmd .md-k{display:block !important;width:100%;min-width:0;height:auto !important;border:1px solid #ece4cf !important;border-radius:10px !important;padding:12px !important;cursor:pointer;background:#fff !important;text-align:left;font:inherit;color:#1b1916 !important}',
      '#dpmd .md-k.an{border-color:' + G + ' !important;box-shadow:0 0 0 1px ' + G + ' inset;background:#FBF6E9 !important}',
      '#dpmd .md-k em{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.1em;color:#6b6252;font-style:normal}',
      '#dpmd .md-k strong{display:block;font:600 22px/1.1 "Space Grotesk",sans-serif;margin:7px 0 4px}',
      '#dpmd .md-k small{font-size:10.5px;color:#7a7160;line-height:1.35;display:block}',
      /* Geldmarkt */
      '#dpmd .md-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
      '#dpmd .md-g{border-left:3px solid ' + G + ';padding:4px 0 4px 12px}',
      '#dpmd .md-g em{font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6252;font-style:normal}',
      '#dpmd .md-g strong{display:block;font:600 20px/1.15 "Space Grotesk",sans-serif;margin-top:5px}',
      '#dpmd .md-g small{font-size:10.5px;color:#7a7160;line-height:1.35;display:block;margin-top:3px}',
      '#dpmd .md-einord{margin-top:14px;font-size:12.5px;line-height:1.5;color:#3b3528;background:#FBF6E9;border-radius:8px;padding:10px 12px}',
      '#dpmd .md-fuss{font-size:11px;line-height:1.5;color:#7a7160;padding:0 2px}',
      '@media (max-width:640px){',
      '  #dpmd .md-kopf{padding:18px 56px 16px 18px}',
      '  #dpmd .md-in{padding:14px 12px 16px;gap:14px}',
      '  #dpmd .md-karte{padding:14px 12px}',
      '  #dpmd .md-held{grid-template-columns:minmax(0,1fr)}',
      '  #dpmd .md-zins{font-size:38px}',
      '  #dpmd .md-op{display:none}',
      '  #dpmd .md-tl{flex:1 1 calc(50% - 6px)}',
      '  #dpmd .md-tl.summe{flex-basis:100%}',
      '  #dpmd .md-k4{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '  #dpmd .md-g3{grid-template-columns:minmax(0,1fr)}',
      '  #dpmd .md-cw{height:220px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function chip(gruppe, wert, text, an) {
    return '<button type="button" class="md-chip' + (an ? ' an' : '') + '" data-md="' + gruppe + '" data-w="' + wert + '" aria-pressed="' + (an ? 'true' : 'false') + '">' + text + '</button>';
  }

  function heldHtml() {
    var f = D && D.formel; if (!f) return '<p class="md-satz">Die Zinsdaten sind gerade nicht erreichbar.</p>';
    var b = wahl.b, L = wahl.ltv;
    var z = zins(b, L), bund = f.bund[b], k = f.k, zs = Math.round(zuschlag(L) * 100) / 100;
    var auf = (z != null && bund != null) ? z - bund - k - zs : f.aufschlag[b];
    var m = (D.verlauf && D.verlauf.monate || []).slice(-1)[0] || {};
    return '<div class="md-wahl">'
      + '<div class="md-gr"><i>Zinsbindung</i>' + [5, 10, 15, 20].map(function (x) { return chip('b', x, x + ' J', x === b); }).join('') + '</div>'
      + '<div class="md-gr"><i>Beleihung</i>' + [60, 70, 80, 90, 100].map(function (x) { return chip('ltv', x, x + ' %', x === L); }).join('')
      + ([60, 70, 80, 90, 100].indexOf(L) < 0 ? chip('ltv', L, L + ' % (Objekt)', true) : '') + '</div>'
      + '</div>'
      + '<div class="md-held">'
      + '<div><div class="md-zins">' + pz(z) + '</div><div class="md-zins-u">' + b + ' Jahre fest · ' + L + ' % Beleihung · effektiv, indikativ</div></div>'
      + '<div class="md-gl">'
      + '<div class="md-tl bund"><em>Bundesanleihe ' + b + ' J</em><strong>' + pz(bund) + '</strong><small>Tageswert ' + datum(f.bund_datum && f.bund_datum[b]) + '</small></div>'
      + '<span class="md-op">+</span>'
      + '<div class="md-tl"><em>Marktaufschlag</em><strong>' + pz(auf, false) + '</strong><small>Ø abgeschlossene Bauzinsen ' + pz(m.mfi) + ' − Ø Bundesanleihe ' + pz(m.bund_avg) + ' · ' + monat(f.aufschlag_monat) + '</small></div>'
      + '<span class="md-op">+</span>'
      + '<div class="md-tl"><em>Angebotsniveau</em><strong>' + pz(k, false) + '</strong><small>Angebot statt Durchschnitt, kalibriert ' + datum(f.k_stand) + '</small></div>'
      + '<span class="md-op">' + (zs < 0 ? '−' : '+') + '</span>'
      + '<div class="md-tl"><em>Beleihung ' + L + ' %</em><strong>' + pz(Math.abs(zs), false) + '</strong><small>' + (zs < 0 ? 'Abschlag' : zs > 0 ? 'Zuschlag' : 'Bezugsgröße') + ' gegenüber 80 %</small></div>'
      + '</div></div>';
  }

  function verlaufSatz() {
    var v = D && D.verlauf; if (!v) return '';
    if (wahl.ansicht === 'wochen') {
      var w = v.wochen || []; if (w.length < 2) return '';
      var a = w[Math.max(0, w.length - 5)], e = w[w.length - 1];
      return 'Vor vier Wochen lag der Bauzins <b>' + pz(a.bauzins10 - a.bund10, false) + ' Punkte</b> über der Bundesanleihe, jetzt sind es <b>'
        + pz(e.bauzins10 - e.bund10, false) + '</b>. Bundesanleihe ' + pz(a.bund10) + ' → ' + pz(e.bund10) + ', Bauzins ' + pz(a.bauzins10) + ' → ' + pz(e.bauzins10)
        + '. <span style="color:#7a7160">Der Aufschlag wechselt monatlich, sobald die Bundesbank den nächsten Monat veröffentlicht.</span>';
    }
    var m = v.monate || []; if (m.length < 2) return '';
    var auf = m.map(function (x) { return x.aufschlag; }), lo = Math.min.apply(null, auf), hi = Math.max.apply(null, auf);
    var e2 = m[m.length - 1], a2 = m[Math.max(0, m.length - 4)];
    return 'Abgeschlossene Bauzinsen (5–10 J) lagen zuletzt <b>' + pz(e2.aufschlag, false) + ' Punkte</b> über der Bundesanleihe (' + monat(e2.monat) + '), drei Monate davor '
      + pz(a2.aufschlag, false) + '. Spanne über ' + m.length + ' Monate: ' + pz(lo, false) + ' bis ' + pz(hi, false) + '.';
  }

  /* Canvas kennt kein var(): die Markenfarbe ueber ein Probe-Element
     aufloesen (whitelabel-faehig, ohne hartes Gold-Literal). */
  function markenGold(alpha) {
    var p = document.createElement('span'); p.style.color = 'var(--wl-c9a84c, #C9A84C)'; p.style.display = 'none';
    document.body.appendChild(p); var c = getComputedStyle(p).color; p.remove();
    var m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return c;
    var t = m[1].split(',').slice(0, 3).join(',');
    return alpha == null ? 'rgb(' + t + ')' : 'rgba(' + t + ',' + alpha + ')';
  }

  function chartZeichnen() {
    var c = $('dpmd-chart'); if (!c || typeof global.Chart !== 'function' || !D || !D.verlauf) return;
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
    var gold = markenGold(), goldHell = markenGold(0.45), dunkel = '#2b2722', grau = '#9a9284';
    var w = wahl.ansicht === 'wochen', r = w ? (D.verlauf.wochen || []) : (D.verlauf.monate || []);
    var lab = r.map(function (x) { return w ? 'KW ' + String(x.woche).split('W')[1] : monat(x.monat); });
    var linie1 = r.map(function (x) { return w ? x.bund10 : x.bund_avg; });
    var linie2 = r.map(function (x) { return w ? x.bauzins10 : x.mfi; });
    var balken = r.map(function (x) { return w ? Math.round((x.bauzins10 - x.bund10) * 100) / 100 : x.aufschlag; });
    chart = new global.Chart(c.getContext('2d'), {
      data: {
        labels: lab,
        datasets: [
          { type: 'bar', label: 'Aufschlag', data: balken, yAxisID: 'y2', backgroundColor: goldHell, borderColor: gold, borderWidth: 1, borderRadius: 3, order: 3 },
          { type: 'line', label: 'Bundesanleihe 10 J', data: linie1, yAxisID: 'y', borderColor: grau, backgroundColor: grau, borderWidth: 2, pointRadius: 2, tension: .25, order: 1 },
          { type: 'line', label: w ? 'Bauzins 10 J / 80 %' : 'Ø abgeschlossen 5–10 J', data: linie2, yAxisID: 'y', borderColor: dunkel, backgroundColor: dunkel, borderWidth: 2.4, pointRadius: 2, tension: .25, order: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (t) { return t.dataset.label + ': ' + pz(t.parsed.y, t.dataset.type !== 'bar') + (t.dataset.type === 'bar' ? ' Punkte' : ''); } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#7a7160', font: { size: 10 } } },
          y: { position: 'left', ticks: { color: '#7a7160', font: { size: 10 }, callback: function (v) { return pz(v); } }, grid: { color: '#efe9da' } },
          y2: { position: 'right', min: 0, suggestedMax: 1.4, ticks: { color: gold, font: { size: 10 }, callback: function (v) { return pz(v, false); } }, grid: { display: false } }
        }
      }
    });
  }

  function kondHtml() {
    var f = D && D.formel; if (!f) return '';
    return [5, 10, 15, 20].map(function (b) {
      return '<button type="button" class="md-k' + (b === wahl.b ? ' an' : '') + '" data-md="b" data-w="' + b + '"><em>' + b + ' JAHRE</em><strong>' + pz(zins(b, wahl.ltv))
        + '</strong><small>Bundesanleihe ' + pz(f.bund[b]) + '</small></button>';
    }).join('');
  }

  function geldHtml() {
    var e = CTX && CTX.ecb_mrr, u = CTX && CTX.euribor_3m, r = CUR && CUR.rates;
    var ein = '';
    /* Die Empfehlung aus market-rates.js gezielt aus IHREN Feldern lesen -
       innerText des ganzen Blocks klebte Ueberschrift und Risiko zusammen
       und zog den Eigenkapital-Regler mit (gemessen in der Messkabine). */
    try {
      var rb = $('mr-rec-body');
      var tx = function (s) { var e = rb && rb.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      var rs = tx('.mr-rec-risk'), hl = tx('.mr-rec-headline').replace(rs, '').trim(), gr = tx('.mr-rec-reasoning');
      if (hl) ein = hl + (rs ? ' (' + rs + ')' : '') + (gr ? '. ' + gr : '');
    } catch (x) {}
    return '<div class="md-g3">'
      + '<div class="md-g"><em>EZB-Leitzins (Hauptrefinanzierung)</em><strong>' + pz(e && e.value) + '</strong><small>Stand ' + datum(e && e.period) + ' · steuert die kurzfristige Refinanzierung</small></div>'
      + '<div class="md-g"><em>Euribor 3 Monate</em><strong>' + pz(u && u.value) + '</strong><small>' + monat(u && u.period) + ' · Basis variabler Kredite</small></div>'
      + '<div class="md-g"><em>Ø abgeschlossen ' + monat(CUR && CUR.asOf && CUR.asOf.slice(0, 7)) + '</em><strong>' + pz(r && r['5_10']) + '</strong><small>5–10 J · über 10 J ' + pz(r && r.over10) + ' · variabel ' + pz(r && r['var']) + '</small></div>'
      + '</div>'
      + (ein ? '<div class="md-einord"><b>Einordnung Zinsbindung:</b> ' + esc(ein) + '</div>' : '');
  }

  function render() {
    var host = $('dpmd'); if (!host) return;
    var stand = D && D.formel && D.formel.bund_datum ? datum(D.formel.bund_datum[10]) : '–';
    host.innerHTML =
      '<div class="md-kopf"><div class="md-eye">Pre-Flight · Marktdaten</div><div class="md-t">Marktdaten &amp; Konditionen</div>'
      + '<div class="md-s">Indikativer Bauzins aus Bundesanleihe und Marktaufschlag · Stand ' + stand + '</div></div>'
      + '<div class="md-in">'
      + '<section class="md-karte" aria-label="Bauzins und Zusammensetzung"><div class="md-h"><b>Dein Bauzins und woraus er besteht</b><span>Bauzins = Bundesanleihe + Marktaufschlag + Angebotsniveau ± Beleihung</span></div><div id="dpmd-held">' + heldHtml() + '</div></section>'
      + '<section class="md-karte" aria-label="Verlauf"><div class="md-h"><b>Verlauf des Aufschlags</b><span class="md-gr">'
      + chip('ansicht', 'monate', '13 Monate', wahl.ansicht === 'monate') + chip('ansicht', 'wochen', '12 Wochen', wahl.ansicht === 'wochen') + '</span></div>'
      + '<p class="md-satz" id="dpmd-satz">' + verlaufSatz() + '</p><div class="md-cw"><canvas id="dpmd-chart" aria-label="Verlauf Bundesanleihe, Bauzins und Aufschlag" role="img"></canvas></div>'
      + '<div class="md-leg" id="dpmd-leg"></div></section>'
      + '<section class="md-karte" aria-label="Konditionen nach Zinsbindung"><div class="md-h"><b>Konditionen nach Zinsbindung</b><span>bei ' + wahl.ltv + ' % Beleihung</span></div><div class="md-k4" id="dpmd-k4">' + kondHtml() + '</div></section>'
      + '<section class="md-karte" aria-label="Geldmarkt"><div class="md-h"><b>Geldmarkt &amp; Einordnung</b></div>' + geldHtml() + '</section>'
      + '<div class="md-fuss">Quellen: Deutsche Bundesbank (Rendite Bundeswertpapiere täglich, Effektivzinsen Wohnungsbaukredite Neugeschäft monatlich), Europäische Zentralbank. '
      + 'Indikative Schätzung, kein Bankangebot · keine Finanzierungsberatung (§ 34c GewO).</div>'
      + '</div>';
    legende();
    chartZeichnen();
  }

  function legende() {
    var l = $('dpmd-leg'); if (!l) return;
    var w = wahl.ansicht === 'wochen';
    l.innerHTML = '<span><i class="bar" style="background:color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 45%,transparent);border:1px solid var(--wl-c9a84c,#C9A84C)"></i>Aufschlag (rechte Achse, Punkte)</span>'
      + '<span><i style="background:#9a9284"></i>Bundesanleihe 10 J</span>'
      + '<span><i style="background:#2b2722"></i>' + (w ? 'Bauzins 10 J / 80 % (Modell)' : 'Ø abgeschlossene Bauzinsen 5–10 J') + '</span>';
  }

  function klick(e) {
    var t = e.target.closest ? e.target.closest('[data-md]') : null; if (!t) return;
    var g = t.getAttribute('data-md'), w = t.getAttribute('data-w');
    if (g === 'b') wahl.b = +w; else if (g === 'ltv') wahl.ltv = +w; else if (g === 'ansicht') wahl.ansicht = w;
    render();
  }

  function laden() {
    var a = fetch('/api/v1/market-rates/pfandbrief').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    var b = fetch('/api/v1/market-rates/market-context').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    var c = fetch('/api/v1/market-rates/current').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return Promise.all([a, b, c]).then(function (x) { D = x[0] && x[0].formel ? x[0] : D; CTX = x[1] || CTX; CUR = x[2] || CUR; });
  }

  function oeffnen() {
    var modal = $('v10-market-modal'); if (!modal) return;
    var box = modal.querySelector('.v10-modal-content'); if (!box) return;
    css();
    box.classList.add('dpmd-an');
    var host = $('dpmd');
    if (!host) { host = document.createElement('div'); host.id = 'dpmd'; box.appendChild(host); host.addEventListener('click', klick); }
    wahl.ltv = objektLtv();
    try { var bj = parseInt((($('d1_bindj') || {}).value || ''), 10); if ([5, 10, 15, 20].indexOf(bj) >= 0) wahl.b = bj; } catch (e) {}
    modal.style.display = 'flex';
    box.scrollTop = 0;
    if (D) render(); else host.innerHTML = '<div class="md-kopf"><div class="md-t">Marktdaten &amp; Konditionen</div><div class="md-s">Lädt …</div></div>';
    laden().then(render);
    escH = function (e) { if (e.key === 'Escape') schliessen(); };
    document.addEventListener('keydown', escH);
  }

  function schliessen() {
    var modal = $('v10-market-modal'); if (modal) modal.style.display = 'none';
    if (escH) { document.removeEventListener('keydown', escH); escH = null; }
    if (chart) { try { chart.destroy(); } catch (e) {} chart = null; }
  }

  /* An V10 einhaengen: der Knopf ruft V10.openMarketModal(), Kreuz und
     Schleier rufen V10.closeMarketModal()/handleOverlayClick. Die alten
     Karten werden NICHT mehr verschoben. */
  function einhaengen() {
    var V = global.V10; if (!V) return false;
    V.openMarketModal = oeffnen;
    V.closeMarketModal = schliessen;
    V.handleOverlayClick = function (e) { if (e.target === $('v10-market-modal')) schliessen(); };
    return true;
  }
  if (!einhaengen()) document.addEventListener('DOMContentLoaded', einhaengen);
  global.DealPilotMarktdaten = { oeffnen: oeffnen, schliessen: schliessen, _wahl: wahl };
})(window);
