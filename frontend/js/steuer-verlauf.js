/* steuer-verlauf.js — v2544 · STEUERVERLAUF MIT WENDEPUNKT
   ───────────────────────────────────────────────────────────────────────────
   Marcel 20.10.2026: „Im Tab Steuern etwas Visuelles … wo man den Verlauf über
   die Jahre super sieht und wann ein Objekt ins Positive läuft und man Steuern
   zahlen müsste – das ist ja der Punkt, wo ich investiere."
   Vorlage: design/Vorschläge/steuerverlauf-demo.html (echte Zahlen Detmold,
   Bismarckstr. 27: vier Verlustjahre, Wendepunkt 2027).

   RECHNET NICHTS SELBST. Je Jahr kommen Einnahmen, Werbungskosten, Ergebnis
   aus V+V und Erstattung/Steuer aus _computeYearTotal() (tax.js – dieselbe
   Quelle wie das Steuerformular und die Jahres-Kärtchen), der Cashflow nach
   Steuern aus State.cfRows (cfns_y). Über die ganze Haltedauer, nicht nur 15
   Jahre.
   Ereignisse: Wendepunkt (erstes positives Jahr nach Verlustjahren), Ende der
   Zinsbindung (Kaufjahr + d1_bindj), Ablauf der 10-Jahres-Frist § 23 EStG
   (nur Privatvermögen). */
(function () {
  'use strict';
  var C = { verlust: '#3FA56C', gewinn: 'var(--wl-c9a84c, #C9A84C)', linie: '#2A2727', marke: 'var(--wl-b8932f, #b8932f)', neg: '#B8625C' };
  function el(id) { return document.getElementById(id); }
  function wert(id) { var e = el(id); return e ? e.value : null; }
  function eur(v) { return (v < 0 ? '− ' : '') + Math.round(Math.abs(v)).toLocaleString('de-DE') + ' €'; }
  function sgn(v) { return (v > 0 ? '+ ' : '') + eur(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nice(span) { var r = span / 5, p = Math.pow(10, Math.floor(Math.log(r) / Math.LN10)), f = r / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

  /** Die Jahresreihe aus den vorhandenen Rechnungen. null, wenn nichts da ist. */
  function reihe() {
    var S = window.State;
    if (!S || !Array.isArray(S.cfRows) || !S.cfRows.length || typeof window._computeYearTotal !== 'function') return null;
    try {
      return S.cfRows.map(function (r, i) {
        var t = window._computeYearTotal(r.cal, i) || {};
        return { jahr: r.cal, ein: Number(t.einnahmen) || 0, wk: Number(t.werbungskosten) || 0, erg: Number(t.ergebnis) || 0,
                 steuer: Number(t.refund) || 0, cf: r.cfns_y != null && isFinite(r.cfns_y) ? Number(r.cfns_y) : null };
      });
    } catch (e) { return null; }
  }
  function ereignisse(R) {
    var ev = [], kj = parseInt(String(wert('kaufdat') || '').slice(0, 4), 10);
    var bind = parseInt(String(wert('d1_bindj') || '').replace(',', '.'), 10);
    if (kj > 1900 && bind > 0) ev.push([kj + bind, 'Zinsbindung endet']);
    var halter = String(wert('halter') || 'privat');
    var corp = false;
    try { var M = window.DealPilotMandanten, m = M && M.get ? M.get(halter) : null; corp = !!(m && M.isCorp && M.isCorp(m.rechtsform)); } catch (e) {}
    if (kj > 1900 && !corp) ev.push([kj + 10, 'Verkauf steuerfrei (§ 23 EStG)']);
    return ev.filter(function (e) { return R.some(function (r) { return r.jahr === e[0]; }); });
  }
  function auswerten(R) {
    var w = -1;
    for (var i = 0; i < R.length; i++) { if (R[i].erg > 0 && (i === 0 || R[i - 1].erg <= 0)) { w = i; break; } }
    var erst = 0, steuer = 0;
    R.forEach(function (r, i) { if (w > 0 && i < w) erst += Math.max(0, r.steuer); if (w >= 0 && i >= w) steuer += Math.min(0, r.steuer); });
    return { wende: w, jahr: w >= 0 ? R[w].jahr : null, erstattung: erst, steuer: steuer };
  }

  function stilEinhaengen() {
    if (el('dp-stv-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-stv-stil';
    s.textContent = [
      '.dp-stv{display:grid;gap:12px;margin:0 0 14px}',
      '.dp-stv-zahlen{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
      '@media (max-width:640px){.dp-stv-zahlen{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '.dp-stv-z{border-top:3px solid var(--c,#E6DCC2);padding-top:6px;display:grid;gap:1px;min-width:0}',
      '.dp-stv-z span{font:500 10px Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#6B645A)}',
      '.dp-stv-z b{font:700 19px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums;color:var(--text,#2A2727);overflow-wrap:anywhere}',
      '.dp-stv-z em{font-style:normal;font-size:11px;color:var(--muted,#8A8272)}',
      '.dp-stv-satz{margin:0;padding:9px 12px;background:#FBF6E9;border-left:3px solid var(--wl-c9a84c, #C9A84C);font-size:13px;line-height:1.5;color:#2A2727;max-width:90ch}',
      '.dp-stv-leg{display:flex;flex-wrap:wrap;gap:12px;font:500 10.5px "JetBrains Mono",monospace;color:var(--muted,#6B645A)}',
      '.dp-stv-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
      '.dp-stv-leg i.l{height:2px;border-radius:0;vertical-align:3px}',
      '.dp-stv-ch{position:relative;overflow-x:auto}',
      '.dp-stv-ch svg{display:block;width:100%;height:auto;min-width:540px}',
      '.dp-stv-ch .ax{font:500 10px "JetBrains Mono",monospace;fill:#8A8272}',
      '.dp-stv-ch .gl{stroke:#EFEAE0}.dp-stv-ch .nl{stroke:#2A2727;stroke-width:1.2}',
      '.dp-stv-ch .wp{stroke:var(--wl-b8932f, #b8932f);stroke-width:1.5;stroke-dasharray:4 3}',
      '.dp-stv-ch .wpt{font:700 11px Inter,sans-serif;fill:#2A2727}',
      '.dp-stv-ch .ev{stroke:#8A8272;stroke-dasharray:2 3}.dp-stv-ch .evt{font:500 10px Inter,sans-serif;fill:#8A8272}',
      '.dp-stv-ch .hit{fill:transparent}',
      '.dp-stv-tip{position:absolute;pointer-events:none;background:#fff;border:1px solid #E6DCC2;border-radius:8px;padding:7px 10px;font:400 12px Inter,sans-serif;color:#2A2727;box-shadow:0 6px 18px rgba(0,0,0,.12);min-width:200px;display:none;font-variant-numeric:tabular-nums;z-index:3}',
      '.dp-stv-tip b{display:block;font:700 13px "Space Grotesk",Inter,sans-serif;margin-bottom:3px}',
      '.dp-stv-tip div{display:flex;justify-content:space-between;gap:12px}',
      '.dp-stv-fuss{font-size:11px;color:var(--muted,#8A8272);margin:0}'
    ].join('');
    document.head.appendChild(s);
  }

  /** Baut die Grafik in `host`. Gibt false zurück, wenn es nichts zu zeigen gibt. */
  function mount(host) {
    if (!host) return false;
    var R = reihe();
    if (!R || R.length < 2) { host.innerHTML = ''; return false; }
    stilEinhaengen();
    var A = auswerten(R), E = ereignisse(R), w = A.wende, n = R.length;
    var zahlen = [
      ['Steuerlich positiv ab', A.jahr ? String(A.jahr) : 'nicht im Zeitraum', w === 0 ? 'vom ersten Jahr an' : (w > 0 ? 'nach ' + w + ' Verlustjahr' + (w === 1 ? '' : 'en') : R[0].jahr + '–' + R[n - 1].jahr), C.marke],
      ['Erstattungen bis dahin', w > 0 ? sgn(A.erstattung) : '0 €', w > 0 ? R[0].jahr + '–' + R[w - 1].jahr : 'keine Verlustjahre', C.verlust],
      ['Steuern ab dem Wendepunkt', w >= 0 ? eur(A.steuer) : '0 €', w >= 0 ? R[w].jahr + '–' + R[n - 1].jahr : '—', C.gewinn],
      ['Ergebnis V+V im letzten Jahr', sgn(R[n - 1].erg), String(R[n - 1].jahr), '#E6DCC2']
    ];
    var satz = w > 0
      ? 'Bis ' + R[w - 1].jahr + ' senkt das Objekt deine Steuer (Erstattungen ' + sgn(A.erstattung) + '). <b>Ab ' + A.jahr + ' wird das Ergebnis positiv</b> – ab hier zahlst du auf dieses Objekt Steuern. Das ist der Zeitpunkt, an dem ein weiteres Investment mit Anfangsverlusten (Zinsen, AfA, Sanierung) die Steuerlast wieder ausgleichen kann.'
      : (w === 0 ? 'Dieses Objekt ist <b>vom ersten Jahr an steuerlich positiv</b> – es bringt keine Erstattung, die Steuer steigt mit der Miete (' + R[0].jahr + ': ' + eur(Math.max(0, -R[0].steuer)) + ', ' + R[n - 1].jahr + ': ' + eur(Math.max(0, -R[n - 1].steuer)) + ' im Jahr). Ein Objekt mit Anfangsverlusten daneben würde die Last senken.'
        : 'Das Objekt bleibt im Betrachtungszeitraum steuerlich negativ – es senkt deine Steuer in jedem Jahr (zusammen ' + sgn(R.reduce(function (a, r) { return a + Math.max(0, r.steuer); }, 0)) + ').');
    /* Diagramm */
    var W = 900, H = 320, L = 62, Rr = 14, T = 46, U = 36;
    var vs = []; R.forEach(function (r) { vs.push(r.erg); if (r.cf != null) vs.push(r.cf); });
    var lo = Math.min.apply(null, [0].concat(vs)), hi = Math.max.apply(null, [0].concat(vs));
    if (hi === lo) hi = lo + 1000;
    var st = nice(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var y = function (v) { return T + (H - T - U) * (1 - (v - lo) / (hi - lo)); };
    var gap = (W - L - Rr) / n, bw = Math.min(26, gap * 0.62), x = function (i) { return L + i * gap + gap / 2; };
    var s = '';
    for (var v = lo; v <= hi + 0.5; v += st) s += '<line class="gl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="ax" x="' + (L - 7) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + Math.round(v / 1000).toLocaleString('de-DE') + ' T€</text>';
    s += '<line class="nl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    E.forEach(function (e, k) { var i = -1; R.forEach(function (r, j) { if (r.jahr === e[0]) i = j; }); if (i < 0) return; var xx = L + i * gap;
      s += '<line class="ev" x1="' + xx.toFixed(1) + '" x2="' + xx.toFixed(1) + '" y1="' + (T - 8 - k * 12) + '" y2="' + (H - U) + '"/><text class="evt" x="' + (xx + 4).toFixed(1) + '" y="' + (T - 10 - k * 12) + '">' + esc(e[1]) + '</text>'; });
    if (w > 0) { var xw = L + w * gap; s += '<line class="wp" x1="' + xw.toFixed(1) + '" x2="' + xw.toFixed(1) + '" y1="' + (T - 34) + '" y2="' + (H - U) + '"/><text class="wpt" x="' + (xw + 4).toFixed(1) + '" y="' + (T - 36) + '">Wendepunkt ' + A.jahr + ': ab hier Steuern</text>'; }
    R.forEach(function (r, i) {
      var h = Math.max(1.5, Math.abs(y(r.erg) - y(0)));
      s += '<rect x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + (r.erg < 0 ? y(0) : y(r.erg)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" style="fill:' + (r.erg < 0 ? C.verlust : C.gewinn) + '"/>';
      if (i % (n > 14 ? 2 : 1) === 0 || i === n - 1) s += '<text class="ax" x="' + x(i).toFixed(1) + '" y="' + (H - U + 15) + '" text-anchor="middle">' + r.jahr + '</text>';
    });
    var pkt = []; R.forEach(function (r, i) { if (r.cf != null) pkt.push([x(i), y(r.cf)]); });
    if (pkt.length > 1) s += '<polyline fill="none" stroke="' + C.linie + '" stroke-width="2" points="' + pkt.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>'
      + pkt.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#fff" stroke="' + C.linie + '" stroke-width="1.5"/>'; }).join('');
    R.forEach(function (r, i) { s += '<rect class="hit" data-i="' + i + '" x="' + (L + i * gap).toFixed(1) + '" y="' + (T - 30) + '" width="' + gap.toFixed(1) + '" height="' + (H - U - T + 30) + '"><title>' + r.jahr + ': Ergebnis V+V ' + esc(sgn(r.erg)) + ', ' + (r.steuer >= 0 ? 'Erstattung ' : 'Steuer ') + esc(eur(Math.abs(r.steuer))) + '</title></rect>'; });
    host.innerHTML = '<div class="dp-stv">'
      + '<div class="dp-stv-zahlen">' + zahlen.map(function (z) { return '<div class="dp-stv-z" style="--c:' + z[3] + '"><span>' + esc(z[0]) + '</span><b>' + esc(z[1]) + '</b><em>' + esc(z[2]) + '</em></div>'; }).join('') + '</div>'
      + '<p class="dp-stv-satz">' + satz + '</p>'
      + '<div class="dp-stv-leg"><span><i style="background:' + C.verlust + '"></i>Verlust · Steuererstattung</span><span><i style="background:' + C.gewinn + '"></i>Gewinn · Steuer fällig</span>'
      + (pkt.length > 1 ? '<span><i class="l" style="background:' + C.linie + '"></i>Cashflow nach Steuern</span>' : '') + (w > 0 ? '<span><i class="l" style="background:' + C.marke + '"></i>Wendepunkt</span>' : '') + '</div>'
      + '<div class="dp-stv-ch"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Steuerverlauf über ' + n + ' Jahre' + (A.jahr ? ', steuerlich positiv ab ' + A.jahr : '') + '">' + s + '</svg><div class="dp-stv-tip"></div></div>'
      + '<p class="dp-stv-fuss">Ergebnis aus V+V = Einnahmen minus Werbungskosten (Zinsen, AfA, Bewirtschaftung, Werbungskosten im Detail) – dieselbe Rechnung wie das Steuerformular. Steuerwirkung mit deinem Grenzsteuersatz. Keine Steuerberatung.</p>'
      + '</div>';
    var ch = host.querySelector('.dp-stv-ch'), tip = host.querySelector('.dp-stv-tip');
    Array.prototype.forEach.call(host.querySelectorAll('.hit'), function (h) {
      h.addEventListener('mousemove', function (ev) {
        var r = R[+h.getAttribute('data-i')], b = ch.getBoundingClientRect();
        tip.innerHTML = '<b>' + r.jahr + '</b><div><span>Einnahmen</span><span>' + eur(r.ein) + '</span></div><div><span>Werbungskosten</span><span>' + eur(-r.wk) + '</span></div>'
          + '<div><span>Ergebnis V+V</span><span>' + sgn(r.erg) + '</span></div><div><span>' + (r.steuer >= 0 ? 'Erstattung' : 'Steuer') + '</span><span style="color:' + (r.steuer >= 0 ? C.verlust : C.neg) + '">' + sgn(r.steuer) + '</span></div>'
          + (r.cf != null ? '<div><span>Cashflow nach Steuern</span><span>' + sgn(r.cf) + '</span></div>' : '');
        tip.style.display = 'block';
        tip.style.left = Math.min(ev.clientX - b.left + ch.scrollLeft + 14, ch.scrollWidth - 220) + 'px';
        tip.style.top = (ev.clientY - b.top + 10) + 'px';
      });
      h.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
    });
    return true;
  }
  function mountAll() { Array.prototype.forEach.call(document.querySelectorAll('[data-dp-steuerverlauf]'), function (h) { try { mount(h); } catch (e) {} }); }
  window.DpSteuerVerlauf = { mount: mount, mountAll: mountAll, reihe: reihe, auswerten: auswerten };
})();
