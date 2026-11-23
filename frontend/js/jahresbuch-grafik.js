/* ══════════════════════════════════════════════════════════════════════
 * jahresbuch-grafik.js — v3430 · Verlaufsgrafiken je Jahr (Plan gegen Ist)
 *
 * Bis v3364b: eine feste Zeichnung „Kaltmiete + Cashflow". Seit v3430 (Marcel
 * 15.11.2026: „gerne noch professionelle Grafiken rein") eine kleine Engine
 * für Bilder über EINER Jahresachse, gezeichnet nach dem Skill dataviz:
 *   - je Bild eine Skala, nie zwei Skalen in einem Bild (keine Doppelachse)
 *   - Linien 2 px rund, Punkte r 4 mit 2-px-Ring in der Fläche
 *   - Balken höchstens 14 px, 4 px rund am Datenende, eckig an der Nulllinie,
 *     2 px Luft zwischen Nachbarn, kein Rand um Marken
 *   - Gitter: Haarlinie, durchgezogen, zurückhaltend
 *   - Legende immer (ab 2 Reihen), sparsame Direktbeschriftung am Ende
 *   - Text in Textfarbe, nie in der Reihenfarbe; Grün/Rot nur Status
 *   - Hover: senkrechte Linie + Kästchen je Jahr; Klick wählt das Jahr
 * Gold nur über var(--wl-c9a84c) im style-Attribut (var() wirkt nicht in
 * SVG-Präsentationsattributen, CLAUDE.md).
 *
 * Nutzer: Jahresabgleich (Kaltmiete + Cashflow, jahresabgleich.js) und
 * Haus & Unterlagen (Hausgeld + Rücklage, hausverlauf.js). Vorlage:
 * design/Vorschläge/pilot-analyse-demo.html (lädt DIESE Datei, alte Form
 * zeichnen(host, d) bleibt).
 *
 *   bild(spec)  → SVG-Text      spec = { jahre: [JJJJ…], heute, gewaehlt,
 *                 panels: [{ titel, art: 'linie'|'balken', hoehe, serien: [{ name, typ: 'linie'|'balken',
 *                 farbe, strich: 'ist'|'plan'|'proj'|'ziel'|'stufe', werte: { JJJJ: zahl }, ende: bool }],
 *                 marken: [{ jahr, monat, text, farbe }] }], ereignisse: [{ jahr, monat, kurz, text }] }
 *   malen(host, spec)  zeichnet mit Legende, Kästchen, Klick (spec.onJahr)
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpJahresbuchGrafik) return;
  var VERSION = 'v4090';
  var GOLD = 'var(--wl-c9a84c, #C9A84C)', GRAU = '#8A8278', TINTE = '#5B544C', ROT = '#B8625C';
  var FLAECHE = 'var(--jbg-flaeche, #FDFCFA)';
  var W0 = 720, WMAX = 1400, L = 60, R = 54, OBEN = 26, LUECKE = 56;   /* v4090 · WMAX: das Bild wird nicht mehr über 720 hochskaliert (am Desktop war die Schrift 1,6-fach groß) */   /* v3432 · W je Bild: so breit wie der Platz (340-720), sonst wird die Schrift am Handy 4 px klein */

  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  /* Achsenbeschriftung: unter 10.000 voll, darüber „40 Tsd." - eine Art je Achse */
  function tick(x, kompakt) {
    if (!istZahl(x)) return '';
    var a = Math.abs(x), v = x < 0 ? '−' : '';
    if (a === 0) return '0';
    if (a >= 1e6) return v + (a / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.';
    if (kompakt) return v + (a / 1000).toLocaleString('de-DE', { maximumFractionDigits: a % 1000 ? 1 : 0 }) + ' Tsd.';
    return v + Math.round(a).toLocaleString('de-DE');
  }
  function schritt(spanne) { var r = Math.pow(10, Math.floor(Math.log10(spanne || 1))), n = spanne / r; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * r; }
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }

  /** Skala eines Bildes: Linien beginnen knapp unter dem kleinsten Wert, Balken an der Null */
  function skala(werte, mitNull) {
    if (!werte.length) return { lo: 0, hi: 1, st: 1 };
    var lo = Math.min.apply(null, werte), hi = Math.max.apply(null, werte);
    if (mitNull) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    else { var sp = (hi - lo) || Math.abs(hi) * 0.2 || 1; lo = Math.max(0, lo - sp * 0.25); hi = hi + sp * 0.12; }
    if (hi === lo) hi = lo + 1;
    var st = schritt((hi - lo) / 4);
    return { lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, st: st };
  }
  /** Balkenpfad: 4 px rund am Datenende, eckig an der Nulllinie */
  function balkenPfad(x, w, y0, y1) {
    var hoch = Math.abs(y1 - y0); if (hoch < 0.5) return '';
    var r = Math.min(4, w / 2, hoch), oben = y1 < y0;
    if (oben) return 'M' + f1(x) + ' ' + f1(y0) + 'V' + f1(y1 + r) + 'Q' + f1(x) + ' ' + f1(y1) + ' ' + f1(x + r) + ' ' + f1(y1) + 'H' + f1(x + w - r) + 'Q' + f1(x + w) + ' ' + f1(y1) + ' ' + f1(x + w) + ' ' + f1(y1 + r) + 'V' + f1(y0) + 'Z';
    return 'M' + f1(x) + ' ' + f1(y0) + 'V' + f1(y1 - r) + 'Q' + f1(x) + ' ' + f1(y1) + ' ' + f1(x + r) + ' ' + f1(y1) + 'H' + f1(x + w - r) + 'Q' + f1(x + w) + ' ' + f1(y1) + ' ' + f1(x + w) + ' ' + f1(y1 - r) + 'V' + f1(y0) + 'Z';
  }
  function strichStil(s) {
    if (s.strich === 'plan') return 'stroke:' + (s.farbe || GRAU) + ';stroke-width:2;stroke-dasharray:6 4;stroke-linecap:round';
    if (s.strich === 'proj') return 'stroke:' + (s.farbe || GOLD) + ';stroke-width:2;stroke-dasharray:0.1 5;stroke-linecap:round';
    if (s.strich === 'ziel' || s.strich === 'stufe') return 'stroke:' + (s.farbe || TINTE) + ';stroke-width:1.5;stroke-opacity:.75;stroke-dasharray:8 3 2 3';
    return 'stroke:' + (s.farbe || GOLD) + ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round';
  }

  /** Das SVG. Rückgabe '' bei weniger als zwei Jahren. */
  function bild(spec) {
    var J = (spec && spec.jahre) || [];
    if (J.length < 2 || !spec.panels || !spec.panels.length) return '';
    var W = spec.W || W0;
    var n = J.length, x0 = L, x1 = W - R, dx = (x1 - x0) / n;
    var xm = function (i) { return x0 + dx * (i + 0.5); };
    var xJahr = function (jahr, monat) { var i = jahr - J[0]; return x0 + dx * (i + ((istZahl(monat) ? monat : 6.5) - 0.5) / 12); };
    var out = [], top = OBEN, marken = [], etik = [];
    var gi = J.indexOf(spec.gewaehlt);
    var hoeheGes = 0; spec.panels.forEach(function (p, k) { hoeheGes += (p.hoehe || 150) + (k ? LUECKE : 0); });
    /* gewähltes Jahr: ruhiges Band über alle Bilder */
    if (gi >= 0) out.push('<rect class="jbg-band" x="' + f1(x0 + dx * gi) + '" y="' + (OBEN - 6) + '" width="' + f1(dx) + '" height="' + f1(hoeheGes + 6) + '" rx="4" style="fill:' + GOLD + ';fill-opacity:.09"/>');
    spec.panels.forEach(function (p, k) {
      if (k) top += LUECKE;
      var H = p.hoehe || 150, mitNull = p.art === 'balken';
      var werte = [];
      p.serien.forEach(function (s) { J.forEach(function (y) { var v = s.werte[y]; if (istZahl(v)) werte.push(v); }); });
      var sk = skala(werte, mitNull), kompakt = Math.max(Math.abs(sk.lo), Math.abs(sk.hi)) >= 10000;
      var yv = function (v) { return top + H - (v - sk.lo) / (sk.hi - sk.lo) * H; };
      if (!spec.ohneTitel) out.push('<text x="' + x0 + '" y="' + (top - 12) + '" class="jbg-t">' + esc(p.titel) + '</text>');
      for (var t = sk.lo; t <= sk.hi + sk.st * 1e-6; t += sk.st) {
        var yy = f1(yv(t));
        out.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + yy + '" y2="' + yy + '" style="stroke:currentColor;stroke-opacity:' + (Math.abs(t) < 1e-9 && mitNull ? '.38' : '.10') + ';stroke-width:1"/>'
          + '<text x="' + (x0 - 8) + '" y="' + f1(yv(t) + 3.5) + '" text-anchor="end" class="jbg-ax">' + tick(t, kompakt) + '</text>');
      }
      /* Balken je Jahr, gruppiert, 2 px Luft */
      var bS = p.serien.filter(function (s) { return s.typ === 'balken'; });
      if (bS.length) {
        var bw = Math.max(4, Math.min(14, (dx - 10) / bS.length - 2));
        J.forEach(function (y, i) {
          var gesamt = bS.length * bw + (bS.length - 1) * 2, xa = xm(i) - gesamt / 2;
          bS.forEach(function (s, j) {
            var v = s.werte[y]; if (!istZahl(v)) return;
            var d = balkenPfad(xa + j * (bw + 2), bw, yv(0), yv(v));
            if (d) out.push('<path d="' + d + '" style="fill:' + (s.farbe || GOLD) + (s.deckkraft ? ';fill-opacity:' + s.deckkraft : '') + '"/>');
          });
        });
      }
      /* Linien */
      p.serien.filter(function (s) { return s.typ !== 'balken'; }).forEach(function (s) {
        var pts = [];
        J.forEach(function (y, i) { var v = s.werte[y]; if (istZahl(v)) pts.push([xm(i), yv(v), y]); });
        if (!pts.length) return;
        if (s.strich === 'stufe' || s.strich === 'ziel') {
          var dz = ''; pts.forEach(function (q) { var i = J.indexOf(q[2]); dz += 'M' + f1(x0 + dx * i + 3) + ' ' + f1(q[1]) + 'H' + f1(x0 + dx * (i + 1) - 3); });
          out.push('<path d="' + dz + '" fill="none" style="' + strichStil(s) + '"/>');
        } else {
          var anschluss = s.anschluss && istZahl(s.anschluss.wert) ? [[xm(J.indexOf(s.anschluss.jahr)), yv(s.anschluss.wert)]] : [];
          var alle = anschluss.concat(pts);
          if (alle.length > 1) out.push('<path d="' + alle.map(function (q, i) { return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join('') + '" fill="none" style="' + strichStil(s) + '"/>');
          if (s.strich === 'ist') pts.forEach(function (q) { out.push('<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="4.5" style="fill:' + (s.farbe || GOLD) + ';stroke:' + FLAECHE + ';stroke-width:2"/>'); });
          if (s.strich === 'proj') pts.forEach(function (q) { out.push('<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="3.5" style="fill:' + FLAECHE + ';stroke:' + (s.farbe || GOLD) + ';stroke-width:2"/>'); });
        }
        if (s.ende) { var lz = pts[pts.length - 1]; etik.push({ x: (s.strich === 'stufe' || s.strich === 'ziel') ? x0 + dx * (J.indexOf(lz[2]) + 1) : lz[0], y: lz[1], text: s.kurz || s.name }); }
      });
      /* Marken an der Grundlinie des Bildes (Mieterhöhung, Sonderumlage) */
      (p.marken || []).forEach(function (m) {
        var x = xJahr(m.jahr, m.monat); if (x < x0 || x > x1) return;
        marken.push('<path class="jbg-marke" d="M' + f1(x) + ' ' + f1(top + H + 2) + 'l-5 8h10z" style="fill:' + (m.farbe || GOLD) + '"><title>' + esc(m.text) + '</title></path>');
      });
      top += H;
    });
    /* Direktbeschriftung am Ende, ohne Stapeln: eine, die zu nah liegt, entfällt (Legende trägt sie) */
    var gesetzt = [];
    etik.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) {
      if (gesetzt.some(function (g) { return Math.abs(g.y - e.y) < 12 && Math.abs(g.x - e.x) < 40; })) return;
      gesetzt.push(e);
      out.push('<text x="' + f1(Math.min(W - 4, e.x + 9)) + '" y="' + f1(e.y + 4) + '" class="jbg-lb">' + esc(e.text) + '</text>');
    });
    /* Ereignisse über alle Bilder: Zinsbindung, Zehnjahresfrist, Zielbild-Wechsel */
    var ev = (spec.ereignisse || []).map(function (e) {
      var x = xJahr(e.jahr, e.monat); if (x < x0 || x > x1) return '';
      return '<line x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + (OBEN - 4) + '" y2="' + f1(top) + '" style="stroke:currentColor;stroke-opacity:.32;stroke-width:1"/>'
        + '<text x="' + f1(x + 4) + '" y="' + (OBEN - 6) + '" class="jbg-mk">' + esc(e.kurz || e.text) + '<title>' + esc(e.text) + '</title></text>';
    }).join('');
    /* heute: Haarlinie mit Wort */
    var hx = spec.heute && J.indexOf(spec.heute) >= 0 ? xJahr(spec.heute, new Date().getMonth() + 1) : null;
    var heuteL = hx ? '<line x1="' + f1(hx) + '" x2="' + f1(hx) + '" y1="' + (OBEN - 2) + '" y2="' + f1(top) + '" style="stroke:currentColor;stroke-opacity:.55;stroke-width:1"/>' : '';
    var achse = J.map(function (y, i) { return '<text x="' + f1(xm(i)) + '" y="' + f1(top + 24) + '" text-anchor="middle" class="jbg-ax' + (y === spec.heute ? ' jbg-heute' : '') + (y === spec.gewaehlt ? ' jbg-gew' : '') + '">' + y + '</text>'; }).join('');
    var treffer = J.map(function (y, i) { return '<rect data-jbg-i="' + i + '" data-jbg-jahr="' + y + '" x="' + f1(x0 + dx * i) + '" y="' + (OBEN - 6) + '" width="' + f1(dx) + '" height="' + f1(top - OBEN + 30) + '" fill="transparent" style="cursor:pointer"/>'; }).join('');
    var hoehe = top + 32;
    return '<svg class="jbg-svg" viewBox="0 0 ' + W + ' ' + f1(hoehe) + '" role="img" aria-label="' + esc(spec.titel || spec.panels.map(function (p) { return p.titel; }).join(', ')) + '">'
      + out.join('') + heuteL + ev + marken.join('') + achse
      + '<line class="jbg-cross" x1="0" x2="0" y1="' + (OBEN - 6) + '" y2="' + f1(top) + '" style="stroke:currentColor;stroke-opacity:0;stroke-width:1"/>' + treffer + '</svg>';
  }

  function schluessel(s) {
    var f = s.farbe || (s.strich === 'plan' ? GRAU : s.strich === 'ziel' || s.strich === 'stufe' ? TINTE : GOLD);
    if (s.typ === 'balken') return '<svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2.5" style="fill:' + f + (s.deckkraft ? ';fill-opacity:' + s.deckkraft : '') + '"/></svg>';
    return '<svg width="24" height="10" aria-hidden="true"><line x1="1" x2="23" y1="5" y2="5" style="' + strichStil(s) + '"/>'
      + (s.strich === 'ist' ? '<circle cx="12" cy="5" r="3.5" style="fill:' + f + '"/>' : s.strich === 'proj' ? '<circle cx="12" cy="5" r="3" style="fill:' + FLAECHE + ';stroke:' + f + ';stroke-width:1.5"/>' : '') + '</svg>';
  }
  function legendeHtml(spec) {
    var e = [], seen = {};
    spec.panels.forEach(function (p) {
      p.serien.forEach(function (s) {
        var k = s.name + '|' + s.typ; if (seen[k]) return;
        if (!spec.jahre.some(function (y) { return istZahl(s.werte[y]); })) return;
        seen[k] = 1; e.push('<span>' + schluessel(s) + esc(s.name) + '</span>');
      });
      (p.marken || []).forEach(function (m) { var k = 'm|' + (m.art || m.farbe); if (seen[k]) return; seen[k] = 1; e.push('<span><svg width="12" height="10" aria-hidden="true"><path d="M6 1l-5 8h10z" style="fill:' + (m.farbe || GOLD) + '"/></svg>' + esc(m.legende || m.art || 'Ereignis') + '</span>'); });
    });
    return e.length > 1 || (spec.panels.length === 1 && e.length) ? '<div class="jbg-leg">' + e.join('') + '</div>' : '';
  }
  function tippHtml(spec, i) {
    var y = spec.jahre[i]; if (y == null) return '';
    var h = '<div class="jbg-tj">' + y + (y === spec.heute ? ' · läuft' : '') + '</div>';
    spec.panels.forEach(function (p) {
      var zeilen = p.serien.filter(function (s) { return istZahl(s.werte[y]); }).map(function (s) {
        return '<div><span>' + schluessel(s) + esc(s.name) + '</span><b>' + (s.format ? s.format(s.werte[y]) : eur(s.werte[y])) + '</b></div>';
      });
      if (zeilen.length) h += '<div class="jbg-tp">' + esc(p.kurz || p.titel) + '</div>' + zeilen.join('');
      (p.marken || []).filter(function (m) { return m.jahr === y; }).forEach(function (m) { h += '<div class="jbg-tev">' + esc(m.text) + '</div>'; });
    });
    (spec.ereignisse || []).filter(function (e) { return e.jahr === y; }).forEach(function (e) { h += '<div class="jbg-tev">' + esc(e.text) + '</div>'; });
    return h;
  }
  function stil(doc) {
    if (!doc || doc.getElementById('dp-jbg-stil') || !doc.head) return;
    var s = doc.createElement('style'); s.id = 'dp-jbg-stil';
    s.textContent = [
      '.jbg{position:relative;margin:2px 0 8px;font:400 12px/1.4 Inter,system-ui,sans-serif;color:#2A2727}',
      '.jbg-svg{width:100%;height:auto;display:block;overflow:visible}',
      '.jbg-ax{font:500 10.5px "JetBrains Mono",monospace;fill:currentColor;fill-opacity:.55}',
      '.jbg-heute{fill-opacity:.9;font-weight:600}.jbg-gew{fill-opacity:1;font-weight:700}',
      '.jbg-t{font:600 12px Inter,sans-serif;fill:currentColor;fill-opacity:.8}',
      '.jbg-lb{font:600 11px Inter,sans-serif;fill:currentColor;fill-opacity:.8}',
      '.jbg-mk{font:500 10px Inter,sans-serif;fill:currentColor;fill-opacity:.65}',
      '.jbg-leg{display:flex;flex-wrap:wrap;gap:4px 16px;margin:0 0 6px;font-size:11.5px;color:#6B645A}',
      '.jbg-leg span{display:inline-flex;align-items:center;gap:6px}',
      '.jbg-tip{position:absolute;pointer-events:none;min-width:190px;background:var(--surface, #FDFCFA);color:var(--text, #2A2727);border:1px solid rgba(128,128,128,.28);border-radius:10px;padding:8px 10px;box-shadow:0 6px 22px rgba(0,0,0,.14);font-size:11.5px;display:none;z-index:5}',
      '.jbg-tip div{display:flex;justify-content:space-between;align-items:center;gap:14px;font-variant-numeric:tabular-nums}',
      '.jbg-tip div span{display:inline-flex;align-items:center;gap:6px;color:#6B645A}',
      '.jbg-tj{font:600 12.5px "Space Grotesk",Inter,sans-serif;margin-bottom:2px}',
      '.jbg-tp{font:500 9.5px "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#9A9285;margin-top:5px;display:block!important}',
      '.jbg-tev{color:#6B645A;display:block!important;margin-top:4px;max-width:240px;white-space:normal}',
      /* v4090 · Karten je Kennzahl */
      '.jbg-karten{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px}',
      '.jbg-karte{border:1px solid #EFE8D6;border-radius:10px;background:#fff;padding:12px 14px 6px;min-width:0}',
      '.jbg-karte header{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}',
      '.jbg-karte h5{margin:0;font:500 10px "JetBrains Mono",monospace;letter-spacing:.09em;text-transform:uppercase;color:#6B645A}',
      '.jbg-kz{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 10px;font-variant-numeric:tabular-nums}',
      '.jbg-kz-l{font:500 11.5px Inter,sans-serif;color:#9A9285}',
      '.jbg-kz-w{font:600 22px "Space Grotesk",Inter,sans-serif;color:#2A2727;letter-spacing:-.01em}',
      '.jbg-kz-p{font:400 12.5px Inter,sans-serif;color:#6B645A}',
      '.jbg-kz-d{font:600 12px Inter,sans-serif;color:#6B645A}.jbg-kz-d.gut{color:#2f7d52}.jbg-kz-d.schlecht{color:#B8625C}',
      '.jbg-kz-n{font:500 13px Inter,sans-serif;color:#9A9285}',
      '.jbg-karte .jbg-leg{margin:4px 0 2px}'
    ].join('\n');
    doc.head.appendChild(s);
  }
  /** Zeichnet spec in host: Legende, Bild, Kästchen; spec.onJahr(jahr) beim Klick */
  function malen(host, spec) {
    if (!host) return;
    var doc = host.ownerDocument; stil(doc);
    var bw = host.clientWidth || 0;
    spec.W = bw > 0 ? Math.max(300, Math.min(WMAX, Math.round(bw))) : W0;
    host._jbgSpec = spec;   /* nachziehen(): neu zeichnen, wenn der Platz sich ändert (verdeckter Reiter, Drehen) */
    if (spec.karten && spec.panels && spec.panels.length > 1) { kartenMalen(host, spec); return; }
    var s = bild(spec);
    if (!s) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="jbg">' + legendeHtml(spec) + s + '<div class="jbg-tip" role="status"></div></div>';
    zeigen(host, spec);
  }
  function zeigen(host, spec) {
    var box = host.querySelector('.jbg'), tip = host.querySelector('.jbg-tip'), kreuz = host.querySelector('.jbg-cross'), W = spec.W || W0;
    Array.prototype.forEach.call(host.querySelectorAll('[data-jbg-i]'), function (r) {
      function zeig() {
        var i = +r.getAttribute('data-jbg-i'), x = +r.getAttribute('x') + (+r.getAttribute('width')) / 2;
        tip.innerHTML = tippHtml(spec, i); tip.style.display = 'block';
        kreuz.setAttribute('x1', x); kreuz.setAttribute('x2', x); kreuz.style.strokeOpacity = '.28';
        var sv = host.querySelector('.jbg-svg'), f = sv.getBoundingClientRect().width / W, bx = box.getBoundingClientRect().width;
        var tw = tip.getBoundingClientRect().width || 200, px = x * f + 14; if (px + tw > bx) px = x * f - tw - 14;
        tip.style.left = Math.max(0, px) + 'px'; tip.style.top = '34px';
      }
      r.addEventListener('mouseenter', zeig);
      r.addEventListener('mouseleave', function () { tip.style.display = 'none'; kreuz.style.strokeOpacity = '0'; });
      r.addEventListener('click', function () { zeig(); if (typeof spec.onJahr === 'function') spec.onJahr(+r.getAttribute('data-jbg-jahr')); });
    });
  }

  /** v4090 · Marcel 23.11.2026: „Auch die Grafik dürfte deutlich professioneller aussehen." Gemessen (Demostraße, 1.188 px
      breit): ein Bild mit zwei Teilen, auf 720 gezeichnet und 1,65-fach hochskaliert (Achsenschrift 17 px), der Titel des
      zweiten Teils stand zwischen den Marken des ersten. Jetzt je Kennzahl eine Karte (kleine Vielfache, je eine Achse):
      Kopf mit Titel und der Zahl des gewählten Jahres (Ist, Plan, Abstand mit Wort), Legende, Bild in echter Größe. */
  function kopfZahl(p, spec) {
    var y = spec.gewaehlt, ist = null, plan = null, f = null;
    p.serien.forEach(function (s) {
      if (s.rolle === 'ist' && istZahl(s.werte[y])) { ist = s.werte[y]; f = s.format; }
      if (s.rolle === 'plan' && istZahl(s.werte[y])) plan = s.werte[y];
    });
    var fm = f || eur;
    if (!istZahl(ist) && !istZahl(plan)) return '<div class="jbg-kz"><span class="jbg-kz-l">' + (y || '') + '</span><span class="jbg-kz-n">keine Zahl</span></div>';
    var d = istZahl(ist) && istZahl(plan) ? ist - plan : null;
    var dT = d == null ? '' : (Math.abs(d) < 0.5 ? '<span class="jbg-kz-d">wie geplant</span>'
      : '<span class="jbg-kz-d ' + (d > 0 ? 'gut' : 'schlecht') + '">' + (d > 0 ? '▲ ' : '▼ ') + fm(Math.abs(d)) + (d > 0 ? ' über' : ' unter') + ' Plan</span>');
    return '<div class="jbg-kz"><span class="jbg-kz-l">' + y + (y === spec.heute ? ' · läuft' : '') + '</span>'
      + '<span class="jbg-kz-w">' + (istZahl(ist) ? fm(ist) : '<span class="jbg-kz-n">' + esc(p.ohneIst || 'Ist fehlt') + '</span>') + '</span>'
      + (istZahl(plan) ? '<span class="jbg-kz-p">Plan ' + fm(plan) + '</span>' : '') + dT + '</div>';
  }
  function kartenMalen(host, spec) {
    host.innerHTML = '<div class="jbg-karten">' + spec.panels.map(function (p, k) {
      return '<section class="jbg-karte" data-jbg-k="' + k + '"><header><h5>' + esc(p.titel) + '</h5>' + kopfZahl(p, spec) + '</header><div class="jbg-k-bild"></div></section>';
    }).join('') + '</div>';
    spec.panels.forEach(function (p, k) {
      var ziel = host.querySelector('[data-jbg-k="' + k + '"] .jbg-k-bild'); if (!ziel) return;
      var bw = ziel.clientWidth || 0;
      var sub = { jahre: spec.jahre, heute: spec.heute, gewaehlt: spec.gewaehlt, onJahr: spec.onJahr, titel: p.titel, ohneTitel: true,
        ereignisse: k === 0 ? spec.ereignisse : [], panels: [Object.assign({}, p, { hoehe: p.hoeheKarte || p.hoehe })],
        W: bw > 0 ? Math.max(280, Math.min(WMAX, Math.round(bw))) : W0 };
      var sv = bild(sub);
      if (!sv) { ziel.innerHTML = ''; return; }
      ziel.innerHTML = '<div class="jbg">' + legendeHtml(sub) + sv + '<div class="jbg-tip" role="status"></div></div>';
      zeigen(ziel, sub);
    });
  }

  /** Bilder, deren Platz sich geändert hat (in einem verdeckten Reiter gezeichnet, Fenster gedreht), neu zeichnen */
  function nachziehen() {
    var doc = global.document; if (!doc || !doc.querySelectorAll) return;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-dp-jb-grafik],[data-dp-hv-grafik]'), function (h) {
      var sp = h._jbgSpec, bw = h.clientWidth || 0; if (!sp || !bw) return;
      if (Math.abs(Math.max(300, Math.min(WMAX, Math.round(bw))) - (sp.W || W0)) > 8) { try { malen(h, sp); } catch (e) {} }
    });
  }
  if (global.document && global.document.addEventListener) {
    global.document.addEventListener('click', function (ev) { if (ev.target && ev.target.closest && ev.target.closest('.dp-pa-tab,.tab')) setTimeout(nachziehen, 80); });
    if (global.addEventListener) global.addEventListener('resize', function () { clearTimeout(nachziehen._t); nachziehen._t = setTimeout(nachziehen, 200); });
  }

  /* ── Alte Form (bis v3364b): d = { jahre: [{ jahr, miete_plan, miete_ist, miete_proj, ziel_j, cf_plan, cf_ist }], ereignisse, heute } ── */
  function ausAlt(d) {
    var J = (d && d.jahre) || [];
    var w = function (k) { var o = {}; J.forEach(function (z) { if (istZahl(z[k])) o[z.jahr] = z[k]; }); return o; };
    var proj = {}; J.forEach(function (z) { if (istZahl(z.miete_proj) && !istZahl(z.miete_ist)) proj[z.jahr] = z.miete_proj; });
    var letzteIst = null; J.forEach(function (z) { if (istZahl(z.miete_ist)) letzteIst = { jahr: z.jahr, wert: z.miete_ist }; });
    var mErh = (d.ereignisse || []).filter(function (e) { return e.art === 'erhoehung'; }).map(function (e) { return { jahr: e.jahr, monat: e.monat, text: e.text, art: 'Mieterhöhung', legende: 'Mieterhöhung' }; });
    return {
      jahre: J.map(function (z) { return z.jahr; }), heute: d.heute, gewaehlt: d.gewaehlt, onJahr: d.onJahr, karten: !!d.karten,   /* v4090 */
      titel: 'Kaltmiete und Cashflow je Jahr, Plan gegen Ist',
      ereignisse: (d.ereignisse || []).filter(function (e) { return e.art !== 'erhoehung'; }),
      panels: [
        { titel: 'Kaltmiete je Jahr', kurz: 'Kaltmiete', art: 'linie', hoehe: 190, hoeheKarte: 170, ohneIst: 'Ist fehlt noch', marken: mErh, serien: [
          { name: 'Plan vom Ankauf', kurz: 'Plan', rolle: 'plan', typ: 'linie', strich: 'plan', farbe: GRAU, werte: w('miete_plan'), ende: true },
          { name: 'Ziel (Zielbild des Jahres)', kurz: 'Ziel', typ: 'linie', strich: 'ziel', werte: w('ziel_j'), ende: true },
          { name: 'Ist', kurz: 'Ist', rolle: 'ist', typ: 'linie', strich: 'ist', werte: w('miete_ist'), ende: true },
          { name: 'Projektion heute', typ: 'linie', strich: 'proj', werte: proj, anschluss: letzteIst }
        ] },
        { titel: 'Cashflow vor Steuer je Jahr', kurz: 'Cashflow vor Steuer', art: 'balken', hoehe: 120, hoeheKarte: 170, ohneIst: 'kein Jahresstand', serien: [
          { name: d.cf_projektion ? 'Plan oder Projektion' : 'Plan vom Ankauf', rolle: 'plan', typ: 'balken', farbe: GRAU, deckkraft: 0.45, werte: w('cf_plan') },
          { name: 'Ist (Jahresstand)', rolle: 'ist', typ: 'balken', farbe: GOLD, werte: w('cf_ist') }
        ] }
      ]
    };
  }
  function svg(d) { return bild(ausAlt(d)); }
  function legende(d) { return legendeHtml(ausAlt(d)); }
  function zeichnen(host, d) { malen(host, d && d.panels ? d : ausAlt(d)); }

  /* ── Daten aus dem Jahresbuch (jahresbuch.js) ──────────────────── */
  function daten(gewaehlt) {
    var B = global.DpJahresbuch; if (!B || !B.verfuegbar()) return null;
    var Z = B.zeilen().slice().reverse();
    if (!Z.length) return null;
    var heute = new Date().getFullYear();
    var a = global.DealPilotAnkauf && global.DealPilotAnkauf.stand ? global.DealPilotAnkauf.stand() : null;
    var plan = a && Array.isArray(a.plan) ? a.plan : [], rows = (global.State && global.State.cfRows) || [];
    var zj = parseInt((global.document.getElementById('zb_fertig_jahr') || {}).value, 10);
    var bis = Math.min(Z[0].jahr + 14, Math.max(heute + 3, zj >= heute && zj <= heute + 10 ? zj : 0));
    var jahre = Z.map(function (z) { return { jahr: z.jahr, miete_plan: z.miete_plan, miete_ist: z.jahr < heute ? z.miete_ist : null, miete_proj: z.jahr >= heute ? z.miete_proj : null,
      ziel_j: istZahl(z.ziel_nkm) ? z.ziel_nkm * 12 : null, cf_plan: istZahl(z.cf_plan) ? z.cf_plan : z.cf_proj, cf_ist_projektion: !istZahl(z.cf_plan) && istZahl(z.cf_proj), cf_ist: z.cf_stand }; });
    var zielHeute = Z[Z.length - 1] && istZahl(Z[Z.length - 1].ziel_nkm) ? Z[Z.length - 1].ziel_nkm * 12 : null;
    for (var y = heute + 1; y <= bis; y++) {
      var p = plan.filter(function (x) { return x && x.cal === y; })[0], r = rows.filter(function (x) { return x && x.cal === y; })[0];
      jahre.push({ jahr: y, miete_plan: p && istZahl(p.nkm_y) ? p.nkm_y : null, miete_ist: null, miete_proj: r && istZahl(r.nkm_y) ? Math.round(r.nkm_y) : null,
        ziel_j: zielHeute, cf_plan: p && istZahl(p.cfop_y) ? p.cfop_y : (r && istZahl(r.cfop_y) ? Math.round(r.cfop_y) : null), cf_ist_projektion: !(p && istZahl(p.cfop_y)), cf_ist: null });
    }
    var cfProj = jahre.some(function (z) { return z.cf_ist_projektion && istZahl(z.cf_plan); });
    var ev = [];
    try { (global.DpErhoehungen ? global.DpErhoehungen.alle() : []).forEach(function (x) { ev.push({ jahr: +x.datum.slice(0, 4), monat: +x.datum.slice(5, 7), art: 'erhoehung', text: 'Mieterhöhung ' + x.datum.split('-').reverse().join('.') + (x.nr ? ', Wohnung ' + x.nr : '') + ' auf ' + eur(x.auf) }); }); } catch (e) {}
    try { (global.DpZielbildFassungen ? global.DpZielbildFassungen.liste() : []).forEach(function (f) { if (f && f.abgeloest_am) ev.push({ jahr: +f.abgeloest_am.slice(0, 4), monat: +f.abgeloest_am.slice(5, 7), art: 'zielbild', kurz: 'neues Zielbild', text: 'Zielbild-Wechsel ' + f.abgeloest_am.split('-').reverse().join('.') + ' (vorher ' + (f.titel || 'Zielbild') + ')' }); }); } catch (e) {}
    try {
      var an = global.DpBestand && global.DpBestand.anschluss ? global.DpBestand.anschluss(new Date()) : null;
      (an && an.darlehen || []).forEach(function (dl) { if (dl.ende) ev.push({ jahr: dl.ende.getFullYear(), monat: dl.ende.getMonth() + 1, art: 'zinsbindung', kurz: 'Zinsbindung', text: 'Ende der Zinsbindung ' + (dl.name || '') }); });
      var ex = global.DpBestand && global.DpBestand.exit ? global.DpBestand.exit(new Date()) : null;
      if (ex && ex.frist_ende) ev.push({ jahr: ex.frist_ende.getFullYear(), monat: ex.frist_ende.getMonth() + 1, art: 'frist', kurz: '10 Jahre', text: 'Ende der Zehnjahresfrist (§ 23 EStG)' });
    } catch (e) {}
    return { jahre: jahre, ereignisse: ev, heute: heute, cf_projektion: cfProj, gewaehlt: gewaehlt };
  }
  function mountAll(opt) {
    var doc = global.document; if (!doc || !doc.querySelectorAll) return;
    var hs = doc.querySelectorAll('[data-dp-jb-grafik]'); if (!hs.length) return;
    /* v3430 · gewähltes Jahr und Klick kommen vom Jahresabgleich, wenn er da ist */
    opt = opt || (global.DpJahresabgleich && global.DpJahresabgleich.grafikOpt ? global.DpJahresabgleich.grafikOpt() : {});
    var d = null; try { d = daten(opt.gewaehlt); } catch (e) { d = null; }
    if (d && opt.onJahr) d.onJahr = opt.onJahr;
    if (d && opt.karten) d.karten = true;   /* v4090 · Jahresabgleich: je Kennzahl eine Karte */
    for (var i = 0; i < hs.length; i++) { try { zeichnen(hs[i], d); } catch (e) { hs[i].innerHTML = ''; } }
  }

  global.DpJahresbuchGrafik = { VERSION: VERSION, bild: bild, malen: malen, legendeHtml: legendeHtml, tippHtml: tippHtml, ausAlt: ausAlt,
    svg: svg, legende: legende, zeichnen: zeichnen, daten: daten, mountAll: mountAll, nachziehen: nachziehen, GOLD: GOLD, GRAU: GRAU, TINTE: TINTE, ROT: ROT };
})(typeof window !== 'undefined' ? window : globalThis);
