/* ══════════════════════════════════════════════════════════════════════
 * jahresbuch-grafik.js — v3364 · Verlaufsgrafik „Plan gegen Ist"
 *
 * Bericht Dateien/Fehler/zielbild-jahresverlauf-2026-11-14.md, Paket 6.
 * Vorlage: design/Vorschläge/plan-gegen-ist.html (lädt DIESE Datei mit
 * Beispielzahlen, es gibt keine zweite Zeichnung).
 *
 * Zwei Bilder über derselben Jahresachse, nie zwei Skalen in einem Bild:
 *   oben   Kaltmiete je Jahr: Plan vom Ankauf (grau gestrichelt), Ist
 *          (Gold, gefüllte Punkte), Projektion heute für Jahre ohne Ist
 *          (Gold gepunktet, hohle Punkte), Ziel aus der Zielbild-Fassung
 *          des Jahres (Textfarbe, Stufenlinie).
 *          Markierungen: Mieterhöhungen (Dreieck an der Achse),
 *          Zielbild-Wechsel, Ende der Zinsbindung, Ende der Zehnjahresfrist.
 *   unten  Cashflow vor Steuer je Jahr: Plan (hohler Balken) gegen den
 *          Jahresstand (gefüllter Balken).
 *
 * Gold nur über var(--wl-c9a84c) im style-Attribut (var() wirkt nicht in
 * SVG-Präsentationsattributen, CLAUDE.md). Kein Kern, nur Darstellung der
 * Zahlen aus jahresbuch.js. Hover: senkrechte Linie und Kästchen je Jahr.
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpJahresbuchGrafik) return;
  var VERSION = 'v3364';
  var GOLD = 'var(--wl-c9a84c, #C9A84C)', GRAU = '#8A8278';
  var W = 720, L = 64, R = 16, H1 = 210, H2 = 130, LUECKE = 34, OBEN = 22;

  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function kurz(x) { if (!istZahl(x)) return ''; var a = Math.abs(x); return (x < 0 ? '−' : '') + (a >= 1e6 ? (a / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.' : a >= 1000 ? Math.round(a / 1000).toLocaleString('de-DE') + ' T' : Math.round(a)); }
  function schritt(max) { var r = Math.pow(10, Math.floor(Math.log10(max || 1))), n = max / r; return (n <= 2 ? 0.5 : n <= 5 ? 1 : 2) * r; }

  /** d = { jahre: [{ jahr, miete_plan, miete_ist, miete_proj, ziel_j, cf_plan, cf_ist, ist_jahr (bool) }],
          ereignisse: [{ jahr, monat, art: 'erhoehung'|'zielbild'|'zinsbindung'|'frist', text }], heute } */
  function svg(d) {
    var J = (d && d.jahre) || [];
    if (J.length < 2) return '';
    var n = J.length, x0 = L, x1 = W - R, dx = (x1 - x0) / n;
    var xm = function (i) { return x0 + dx * (i + 0.5); };
    var xJahr = function (jahr, monat) { var i = jahr - J[0].jahr; return x0 + dx * (i + ((monat || 6.5) - 0.5) / 12); };
    /* oben: Miete */
    var mw = []; J.forEach(function (z) { ['miete_plan', 'miete_ist', 'miete_proj', 'ziel_j'].forEach(function (k) { if (istZahl(z[k])) mw.push(z[k]); }); });
    var mMax = mw.length ? Math.max.apply(null, mw) * 1.08 : 1, mMin = 0;
    var st = schritt(mMax / 4); mMax = Math.ceil(mMax / st) * st;
    var y1 = function (v) { return OBEN + H1 - (v - mMin) / (mMax - mMin) * H1; };
    var g = [];
    for (var t = 0; t <= mMax + 1e-6; t += st) g.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y1(t).toFixed(1) + '" y2="' + y1(t).toFixed(1) + '" style="stroke:currentColor;stroke-opacity:.12"/><text x="' + (x0 - 6) + '" y="' + (y1(t) + 3.5).toFixed(1) + '" text-anchor="end" class="jbg-ax">' + kurz(t) + '</text>');
    function linie(k, filter) {
      var pts = []; J.forEach(function (z, i) { if (istZahl(z[k]) && (!filter || filter(z))) pts.push([xm(i), y1(z[k])]); });
      return pts;
    }
    function pfad(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); }
    var plan = linie('miete_plan'), ist = linie('miete_ist'), proj = linie('miete_proj', function (z) { return !istZahl(z.miete_ist); });
    /* Ziel als Stufenlinie über die Jahresbreite */
    var ziel = ''; J.forEach(function (z, i) { if (istZahl(z.ziel_j)) ziel += 'M' + (x0 + dx * i).toFixed(1) + ' ' + y1(z.ziel_j).toFixed(1) + 'H' + (x0 + dx * (i + 1)).toFixed(1); });
    var marken = (d.ereignisse || []).map(function (e) {
      var x = xJahr(e.jahr, e.monat); if (x < x0 || x > x1) return '';
      if (e.art === 'erhoehung') return '<path d="M' + x.toFixed(1) + ' ' + (OBEN + H1 + 1) + 'l-4.5 7h9z" style="fill:' + GOLD + '"><title>' + esc(e.text) + '</title></path>';
      return '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (OBEN - 4) + '" y2="' + (OBEN + H1) + '" style="stroke:currentColor;stroke-opacity:.45" stroke-dasharray="2 3"/>'
        + '<text x="' + (x + 3).toFixed(1) + '" y="' + (OBEN - 8) + '" class="jbg-mk">' + esc(e.kurz || e.text) + '</text>';
    }).join('');
    var punkte = ist.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5" style="fill:' + GOLD + ';stroke:var(--jbg-flaeche, #FDFCFA);stroke-width:2"/>'; }).join('')
      + proj.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" style="fill:var(--jbg-flaeche, #FDFCFA);stroke:' + GOLD + ';stroke-width:2"/>'; }).join('');
    /* Direktbeschriftung am Ende jeder Linie */
    function etikett(pts, text, stil) { if (!pts.length) return ''; var p = pts[pts.length - 1]; return '<text x="' + Math.min(x1 - 2, p[0] + 8).toFixed(1) + '" y="' + (p[1] - 7).toFixed(1) + '" text-anchor="end" class="jbg-lb"' + (stil ? ' style="' + stil + '"' : '') + '>' + text + '</text>'; }
    var oben = g.join('')
      + (plan.length > 1 ? '<path d="' + pfad(plan) + '" fill="none" style="stroke:' + GRAU + '" stroke-width="2" stroke-dasharray="6 4"/>' : '')
      + (proj.length ? '<path d="' + pfad((ist.length ? [ist[ist.length - 1]] : []).concat(proj)) + '" fill="none" style="stroke:' + GOLD + '" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round"/>' : '')
      + (ist.length > 1 ? '<path d="' + pfad(ist) + '" fill="none" style="stroke:' + GOLD + '" stroke-width="2.5" stroke-linejoin="round"/>' : '')
      + (ziel ? '<path d="' + ziel + '" fill="none" style="stroke:currentColor" stroke-width="2" stroke-dasharray="8 3 2 3"/>' : '')
      + punkte + marken
      + etikett(plan, 'Plan', 'fill:' + GRAU) + etikett(ziel ? linie('ziel_j') : [], 'Ziel');
    /* unten: Cashflow */
    var cw = []; J.forEach(function (z) { if (istZahl(z.cf_plan)) cw.push(z.cf_plan); if (istZahl(z.cf_ist)) cw.push(z.cf_ist); });
    var cMax = cw.length ? Math.max(0, Math.max.apply(null, cw)) : 1, cMin = cw.length ? Math.min(0, Math.min.apply(null, cw)) : 0;
    if (cMax === cMin) cMax = cMin + 1;
    var sp = (cMax - cMin) * 0.1; cMax += sp; if (cMin < 0) cMin -= sp;
    var top2 = OBEN + H1 + LUECKE;
    var y2 = function (v) { return top2 + H2 - (v - cMin) / (cMax - cMin) * H2; };
    var bw = Math.min(16, dx / 2 - 4);
    var balken = J.map(function (z, i) {
      var out = '', xc = xm(i);
      function b(v, x, voll) {
        if (!istZahl(v)) return '';
        var ya = y2(Math.max(0, v)), yb = y2(Math.min(0, v)), h = Math.max(1, yb - ya);
        return '<rect x="' + x.toFixed(1) + '" y="' + ya.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"'
          + (voll ? ' style="fill:' + GOLD + '"' : ' style="fill:none;stroke:' + GRAU + ';stroke-width:1.5"') + '/>';
      }
      out += b(z.cf_plan, xc - bw - 1, false) + b(z.cf_ist, xc + 1, true);
      return out;
    }).join('');
    var unten = '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y2(0).toFixed(1) + '" y2="' + y2(0).toFixed(1) + '" style="stroke:currentColor;stroke-opacity:.35"/>'
      + '<text x="' + (x0 - 6) + '" y="' + (y2(0) + 3.5).toFixed(1) + '" text-anchor="end" class="jbg-ax">0</text>'
      + (cMax > 0 ? '<text x="' + (x0 - 6) + '" y="' + (top2 + 8) + '" text-anchor="end" class="jbg-ax">' + kurz(cMax) + '</text>' : '')
      + (cMin < 0 ? '<text x="' + (x0 - 6) + '" y="' + (top2 + H2) + '" text-anchor="end" class="jbg-ax">' + kurz(cMin) + '</text>' : '')
      + balken;
    var achse = J.map(function (z, i) { return '<text x="' + xm(i).toFixed(1) + '" y="' + (top2 + H2 + 16) + '" text-anchor="middle" class="jbg-ax' + (z.jahr === d.heute ? ' jbg-heute' : '') + '">' + z.jahr + '</text>'; }).join('');
    var titel = '<text x="' + x0 + '" y="12" class="jbg-t">Kaltmiete je Jahr</text><text x="' + x0 + '" y="' + (top2 - 8) + '" class="jbg-t">Cashflow vor Steuer je Jahr</text>';
    var treffer = J.map(function (z, i) { return '<rect data-jbg-i="' + i + '" x="' + (x0 + dx * i).toFixed(1) + '" y="' + OBEN + '" width="' + dx.toFixed(1) + '" height="' + (top2 + H2 - OBEN) + '" fill="transparent"/>'; }).join('');
    var hoehe = top2 + H2 + 24;
    return '<svg class="jbg-svg" viewBox="0 0 ' + W + ' ' + hoehe + '" role="img" aria-label="Kaltmiete und Cashflow je Jahr, Plan gegen Ist">'
      + titel + oben + unten + achse + '<line class="jbg-cross" x1="0" x2="0" y1="' + OBEN + '" y2="' + (top2 + H2) + '" style="stroke:currentColor;stroke-opacity:0"/>' + treffer + '</svg>';
  }
  function legende(d) {
    var J = (d && d.jahre) || [];
    var hat = function (k) { return J.some(function (z) { return istZahl(z[k]); }); };
    var e = [];
    if (hat('miete_plan')) e.push('<span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" style="stroke:' + GRAU + '" stroke-width="2" stroke-dasharray="6 4"/></svg>Plan vom Ankauf</span>');
    if (hat('miete_ist')) e.push('<span><svg width="22" height="10"><line x1="0" x2="22" y1="5" y2="5" style="stroke:' + GOLD + '" stroke-width="2.5"/><circle cx="11" cy="5" r="4" style="fill:' + GOLD + '"/></svg>Ist (eingetragen)</span>');
    if (hat('miete_proj')) e.push('<span><svg width="22" height="10"><circle cx="11" cy="5" r="3.5" style="fill:none;stroke:' + GOLD + '" stroke-width="2"/></svg>Projektion heute</span>');
    if (hat('ziel_j')) e.push('<span><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" style="stroke:currentColor" stroke-width="2" stroke-dasharray="8 3 2 3"/></svg>Ziel (Zielbild des Jahres)</span>');
    e.push('<span><svg width="22" height="10"><rect x="2" y="1" width="8" height="8" rx="2" style="fill:none;stroke:' + GRAU + '" stroke-width="1.5"/><rect x="12" y="1" width="8" height="8" rx="2" style="fill:' + GOLD + '"/></svg>Cashflow Plan · Jahresstand</span>');
    if ((d.ereignisse || []).some(function (x) { return x.art === 'erhoehung'; })) e.push('<span><svg width="12" height="10"><path d="M6 1l-5 8h10z" style="fill:' + GOLD + '"/></svg>Mieterhöhung</span>');
    return '<div class="jbg-leg">' + e.join('') + '</div>';
  }
  function tipp(d, i) {
    var z = d.jahre[i]; if (!z) return '';
    var r = function (w, v) { return istZahl(v) ? '<div><span>' + w + '</span><b>' + eur(v) + '</b></div>' : ''; };
    var ev = (d.ereignisse || []).filter(function (e) { return e.jahr === z.jahr; }).map(function (e) { return '<div class="jbg-tev">' + esc(e.text) + '</div>'; }).join('');
    return '<div class="jbg-tj">' + z.jahr + (z.jahr === d.heute ? ' · laufend' : '') + '</div>'
      + r('Miete Plan', z.miete_plan) + r('Miete Ist', z.miete_ist) + (istZahl(z.miete_ist) ? '' : r('Projektion heute', z.miete_proj)) + r('Ziel', z.ziel_j)
      + r('Cashflow Plan', z.cf_plan) + r('Cashflow Jahresstand', z.cf_ist) + ev;
  }
  function stil(doc) {
    if (!doc || doc.getElementById('dp-jbg-stil') || !doc.head) return;
    var s = doc.createElement('style'); s.id = 'dp-jbg-stil';
    s.textContent = [
      '.jbg{position:relative;margin:4px 0 14px;font:400 12px/1.4 Inter,system-ui,sans-serif}',
      '.jbg-svg{width:100%;height:auto;display:block;overflow:visible}',
      '.jbg-ax{font:400 10.5px "JetBrains Mono",monospace;fill:currentColor;fill-opacity:.6}',
      '.jbg-heute{font-weight:700;fill-opacity:1}',
      '.jbg-t{font:600 11px Inter,sans-serif;fill:currentColor;fill-opacity:.75}',
      '.jbg-lb{font:600 11px Inter,sans-serif;fill:currentColor}',
      '.jbg-mk{font:400 10px Inter,sans-serif;fill:currentColor;fill-opacity:.7}',
      '.jbg-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:2px 0 6px;font-size:11.5px;color:inherit}',
      '.jbg-leg span{display:inline-flex;align-items:center;gap:5px}',
      '.jbg-tip{position:absolute;pointer-events:none;min-width:170px;background:var(--surface, #FDFCFA);color:var(--text, #2A2727);border:1px solid rgba(128,128,128,.35);border-radius:8px;padding:7px 9px;box-shadow:0 4px 16px rgba(0,0,0,.18);font-size:11.5px;display:none;z-index:5}',
      '.jbg-tip div{display:flex;justify-content:space-between;gap:12px}.jbg-tj{font-weight:700;margin-bottom:3px}.jbg-tev{color:#6B645A;display:block!important}'
    ].join('\n');
    doc.head.appendChild(s);
  }
  /** Zeichnet in host; d wie bei svg(). */
  function zeichnen(host, d) {
    if (!host) return;
    var doc = host.ownerDocument; stil(doc);
    var s = svg(d);
    if (!s) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="jbg">' + legende(d) + s + '<div class="jbg-tip" role="status"></div></div>';
    var box = host.querySelector('.jbg'), tip = host.querySelector('.jbg-tip'), kreuz = host.querySelector('.jbg-cross');
    host.querySelectorAll('[data-jbg-i]').forEach(function (r) {
      function zeig() {
        var i = +r.getAttribute('data-jbg-i'), x = +r.getAttribute('x') + (+r.getAttribute('width')) / 2;
        tip.innerHTML = tipp(d, i); tip.style.display = 'block';
        kreuz.setAttribute('x1', x); kreuz.setAttribute('x2', x); kreuz.style.strokeOpacity = '.3';
        var sv = host.querySelector('.jbg-svg'), f = sv.getBoundingClientRect().width / W, bx = box.getBoundingClientRect().width;
        var px = x * f + 12; if (px + 190 > bx) px = x * f - 190;
        tip.style.left = Math.max(0, px) + 'px'; tip.style.top = '30px';
      }
      r.addEventListener('mouseenter', zeig); r.addEventListener('click', zeig);
      r.addEventListener('mouseleave', function () { tip.style.display = 'none'; kreuz.style.strokeOpacity = '0'; });
    });
  }

  /* ── Daten aus dem Jahresbuch (jahresbuch.js) ──────────────────── */
  function daten() {
    var B = global.DpJahresbuch; if (!B || !B.verfuegbar()) return null;
    var Z = B.zeilen().slice().reverse();
    if (!Z.length) return null;
    var heute = new Date().getFullYear();
    var a = global.DealPilotAnkauf && global.DealPilotAnkauf.stand ? global.DealPilotAnkauf.stand() : null;
    var plan = a && Array.isArray(a.plan) ? a.plan : [], rows = (global.State && global.State.cfRows) || [];
    var zj = parseInt((global.document.getElementById('zb_fertig_jahr') || {}).value, 10);
    var bis = Math.min(Z[0].jahr + 14, Math.max(heute + 3, zj >= heute && zj <= heute + 10 ? zj : 0));
    var jahre = Z.map(function (z) { return { jahr: z.jahr, miete_plan: z.miete_plan, miete_ist: z.miete_ist, miete_proj: z.miete_proj,
      ziel_j: istZahl(z.ziel_nkm) ? z.ziel_nkm * 12 : null, cf_plan: z.cf_plan, cf_ist: z.cf_stand }; });
    var zielHeute = Z[Z.length - 1] && istZahl(Z[Z.length - 1].ziel_nkm) ? Z[Z.length - 1].ziel_nkm * 12 : null;
    for (var y = heute + 1; y <= bis; y++) {
      var p = plan.filter(function (x) { return x && x.cal === y; })[0], r = rows.filter(function (x) { return x && x.cal === y; })[0];
      jahre.push({ jahr: y, miete_plan: p && istZahl(p.nkm_y) ? p.nkm_y : null, miete_ist: null, miete_proj: r && istZahl(r.nkm_y) ? Math.round(r.nkm_y) : null,
        ziel_j: zielHeute, cf_plan: p && istZahl(p.cfop_y) ? p.cfop_y : null, cf_ist: null });
    }
    var ev = [];
    try { (global.DpErhoehungen ? global.DpErhoehungen.alle() : []).forEach(function (x) { ev.push({ jahr: +x.datum.slice(0, 4), monat: +x.datum.slice(5, 7), art: 'erhoehung', text: 'Mieterhöhung ' + x.datum.split('-').reverse().join('.') + (x.nr ? ', Wohnung ' + x.nr : '') + ' auf ' + eur(x.auf) }); }); } catch (e) {}
    try { (global.DpZielbildFassungen ? global.DpZielbildFassungen.liste() : []).forEach(function (f) { if (f && f.abgeloest_am) ev.push({ jahr: +f.abgeloest_am.slice(0, 4), monat: +f.abgeloest_am.slice(5, 7), art: 'zielbild', kurz: 'neues Zielbild', text: 'Zielbild-Wechsel ' + f.abgeloest_am.split('-').reverse().join('.') + ' (vorher ' + (f.titel || 'Zielbild') + ')' }); }); } catch (e) {}
    try {
      var an = global.DpBestand && global.DpBestand.anschluss ? global.DpBestand.anschluss(new Date()) : null;
      (an && an.darlehen || []).forEach(function (dl) { if (dl.ende) ev.push({ jahr: dl.ende.getFullYear(), monat: dl.ende.getMonth() + 1, art: 'zinsbindung', kurz: 'Zinsbindung', text: 'Ende der Zinsbindung ' + (dl.name || '') }); });
      var ex = global.DpBestand && global.DpBestand.exit ? global.DpBestand.exit(new Date()) : null;
      if (ex && ex.frist_ende) ev.push({ jahr: ex.frist_ende.getFullYear(), monat: ex.frist_ende.getMonth() + 1, art: 'frist', kurz: '10 Jahre', text: 'Ende der Zehnjahresfrist (§ 23 EStG)' });
    } catch (e) {}
    return { jahre: jahre, ereignisse: ev, heute: heute };
  }
  function mountAll() {
    var doc = global.document; if (!doc || !doc.querySelectorAll) return;
    var hs = doc.querySelectorAll('[data-dp-jb-grafik]'); if (!hs.length) return;
    var d = null; try { d = daten(); } catch (e) { d = null; }
    for (var i = 0; i < hs.length; i++) { try { zeichnen(hs[i], d); } catch (e) { hs[i].innerHTML = ''; } }
  }

  global.DpJahresbuchGrafik = { VERSION: VERSION, svg: svg, legende: legende, zeichnen: zeichnen, daten: daten, mountAll: mountAll };
})(typeof window !== 'undefined' ? window : globalThis);
