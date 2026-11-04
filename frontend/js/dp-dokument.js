/* ═══════════════════════════════════════════════════════════════════════
   dp-dokument.js · v3179 — EIN Gestaltungssystem für alle DealPilot-Dokumente
   Marcel 04.11.2026: „einheitliche Dokumente für Marktbericht, Investment-PDF,
   Bankfassung, Kurzfassung, Track Record, Kaufpreisaufteilung, Finanzamt und
   Bankexport … Marktbericht Profi find ich gut, eine Kombi aus den hellen
   Varianten … alle vorher abnehmen“.

   Was hier steht: Satzspiegel A4 (hoch und quer), Schriften, Farben,
   Deckblatt, Kopf/Fuss, Kennzahl-Kacheln, Tabellen, Rechenstaffel,
   Diagramme, Energieskala, Vorschau. Was hier NICHT steht: Inhalte. Jedes
   Dokument baut seine Seiten in dp-dokumente.js aus diesen Bausteinen.

   Regeln (aus der Profi-Fassung uebernommen):
   · Schriften Inter (Text), Space Grotesk (Ueberschriften), JetBrains Mono
     (Zahlen) — selbst gehostet, keine Serifen.
   · Gold folgt der Marke (--gold der App), Rueckfall var(--wl-b8932f,…).
   · Statusfarben (gruen/rot) bleiben in jeder Marke gleich.
   · Gerechnet wird hier nichts.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VERSION = 'v3179';

  /* ── Helfer ───────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function istZahl(v) { return v !== null && v !== undefined && v !== '' && isFinite(Number(v)); }
  function zahl(v, d) { return istZahl(v) ? Number(v).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '–'; }
  function eur(v, d) { return istZahl(v) ? zahl(v, d || 0) + ' €' : '–'; }
  function eurS(v, d) { if (!istZahl(v)) return '–'; var n = Number(v); return (n > 0 ? '+' : n < 0 ? '−' : '') + zahl(Math.abs(n), d || 0) + ' €'; }
  function pct(v, d) { return istZahl(v) ? zahl(v, d == null ? 2 : d) + ' %' : '–'; }
  function jahr(v) { return istZahl(v) ? String(Math.round(Number(v))) : '–'; }
  function datum(s) { if (!s) return ''; try { var d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleDateString('de-DE'); } catch (e) { return ''; } }

  /* ── Marke, Logo, Karten, Fotos ───────────────────────────────────── */
  function marke() {
    try { var b = window.DealPilotConfig && DealPilotConfig.branding; if (b) return (b.fuerPdf ? b.fuerPdf() : b.get()) || {}; } catch (e) {}
    return {};
  }
  function logo(b) { return window.DealPilotPdfLogo ? DealPilotPdfLogo.fuerMarke(b || marke()).catch(function () { return null; }) : Promise.resolve(null); }
  function alsDataUrl(blob) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { ok(null); }; r.readAsDataURL(blob); }); }
  function karte(lat, lon, zoom, w, h) {
    if (!istZahl(lat) || !istZahl(lon)) return Promise.resolve(null);
    var t = ''; try { t = localStorage.getItem('ji_token') || ''; } catch (e) {}
    return fetch('/api/v1/marktbericht/static-map?lat=' + lat + '&lon=' + lon + '&zoom=' + (zoom || 16) + '&width=' + (w || 1200) + '&height=' + (h || 620), { headers: t ? { Authorization: 'Bearer ' + t } : {} })
      .then(function (r) { return r.ok && /image/.test(r.headers.get('content-type') || '') ? r.blob() : null; })
      .then(function (b) { return b ? alsDataUrl(b) : null; }).catch(function () { return null; });
  }
  function absenderZeilen(b) {
    b = b || {};
    return [b.company, b.name && b.name !== b.company ? b.name : '', [b.address, ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(', '),
      [b.phone, b.email].filter(Boolean).join(' · ')].filter(Boolean);
  }
  function markenGold() {
    try { var g = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(); return /^(#[0-9a-f]{3,8}|rgb)/i.test(g) ? ':root{--gold:' + g + '}' : ''; } catch (e) { return ''; }
  }

  /* ── Gestaltung ───────────────────────────────────────────────────── */
  var CSS = [
    '@page{size:A4;margin:13mm 0 17mm}@page:first{margin:0}',
    '@page quer{size:A4 landscape;margin:12mm 0 14mm}',
    ':root{--ink:#16161A;--muted:#5F5E66;--line:#E3E1DA;--soft:#F6F4EF;--gold:var(--wl-b8932f, #b8932f);--gold-l:color-mix(in srgb,var(--gold) 13%,#fff);--gold-d:color-mix(in srgb,var(--gold) 70%,#000);--obs:#0B0B0D;--gruen:#2E8B57;--rot:#B8625C}',
    '*{box-sizing:border-box}html,body{margin:0;background:#fff;color:var(--ink)}',
    'body{font:9.4pt/1.5 Inter,system-ui,"Segoe UI",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.seite{width:210mm;padding:3mm 17mm 0;page-break-before:always;break-before:page}',
    '.seite.quer{width:297mm;page:quer;padding:2mm 14mm 0}',
    '.seite.deck{page-break-before:auto;break-before:auto}',
    '.num{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}',
    'h1,h2,h3,h4{font-family:"Space Grotesk",Inter,sans-serif;font-weight:600;margin:0;letter-spacing:-.01em}',
    'h2{font-size:17pt;margin-bottom:1.5mm}h3{font-size:11pt;margin:6mm 0 2.5mm;break-after:avoid}',
    '.kopf{display:flex;justify-content:space-between;align-items:center;border-bottom:.3mm solid var(--ink);padding-bottom:3mm;margin-bottom:7mm}',
    '.kopf img{height:9mm;width:auto}.kopf strong{font:600 11pt "Space Grotesk",sans-serif}.kopf .r{font:7.2pt/1.35 "JetBrains Mono",monospace;color:var(--muted);text-align:right;letter-spacing:.04em;text-transform:uppercase}',
    '.eyebrow{font:7.5pt/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:2mm}',
    '.sub{color:var(--muted);margin:0 0 5mm}p{margin:0 0 2.5mm}',
    /* v3180c · Fliesstext im Blocksatz mit Silbentrennung (lang=de) - Marcel 04.11.2026; Tabellen bleiben buendig */
    'p,li,.hinweis,.zitat{text-align:justify;hyphens:auto;-webkit-hyphens:auto}ul{padding-left:5mm;margin:0 0 2.5mm}li{margin-bottom:1.2mm;break-inside:avoid}.fliess p{orphans:3;widows:3}',
    '.fuss{margin-top:8mm;display:flex;justify-content:space-between;gap:6mm;font:7pt/1.3 Inter,sans-serif;color:var(--muted);border-top:.2mm solid var(--line);padding-top:2mm;break-inside:avoid}',
    '.block{break-inside:avoid}',
    /* Deckblatt */
    '.deck{padding:0;display:flex;flex-direction:column;height:297mm;overflow:hidden}',
    '.deck .bild{height:118mm;background:var(--soft) center/cover no-repeat;position:relative}',
    '.deck .bild.ohne{height:62mm;background:linear-gradient(135deg,var(--soft),#fff)}',
    '.deck .bild .logo{position:absolute;top:12mm;left:17mm;background:#fff;padding:3mm 4mm;border-radius:1.5mm;box-shadow:0 .5mm 3mm rgba(0,0,0,.08)}',
    '.deck .bild .logo img{height:11mm;width:auto;display:block}.deck .bild .logo strong{font:600 13pt "Space Grotesk",sans-serif}',
    '.deck .inhalt{padding:12mm 17mm 0;flex:1}',
    '.deck h1{font-size:24pt;line-height:1.12;margin:2mm 0 2mm}',
    '.deck .adr{font-size:11.5pt;color:var(--muted);margin-bottom:8mm}',
    '.deck .wertbox{display:grid;grid-template-columns:1.2fr 1fr;gap:8mm;align-items:end;border-top:.3mm solid var(--ink);border-bottom:.2mm solid var(--line);padding:6mm 0}',
    '.deck .wert{font:500 28pt/1 "JetBrains Mono",monospace;letter-spacing:-.02em}',
    '.deck .lbl{font:7.5pt/1.3 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2.5mm}',
    '.deck .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:6mm;font-size:8.6pt}',
    '.deck .meta b{display:block;font:7pt/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:400;margin-bottom:1mm}',
    '.deck .zitat{margin-top:7mm;font-size:9pt;color:var(--muted);border-left:.8mm solid var(--gold);padding-left:4mm}',
    '.deck .abs{padding:0 17mm 14mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;font-size:8.4pt;color:var(--muted)}',
    '.deck .abs strong{color:var(--ink);font-weight:600}',
    /* Kennzahl-Kacheln (hell, Goldkante oben) */
    '.kz{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3mm;margin:3mm 0 4mm}.kz.drei{grid-template-columns:repeat(3,minmax(0,1fr))}',
    '.kz>div{border:.2mm solid var(--line);border-top:.8mm solid var(--gold);border-radius:0 0 1mm 1mm;padding:2.6mm 3mm 2.4mm;background:#fff;break-inside:avoid}',
    '.kz .l{font:6.8pt/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}',
    '.kz .v{font:500 13.5pt/1.25 "JetBrains Mono",monospace;margin-top:1mm;white-space:nowrap}',
    '.kz .s{font-size:7.2pt;color:var(--muted);margin-top:.4mm}',
    '.kz .gut .v{color:var(--gruen)}.kz .schlecht .v{color:var(--rot)}.kz .hi{background:var(--gold-l)}',
    /* Tabellen */
    'table{border-collapse:collapse;width:100%;font-size:8.6pt;page-break-inside:auto}tr{page-break-inside:avoid}',
    'th{font:6.8pt/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:1.8mm 2mm;border-bottom:.3mm solid var(--ink)}',
    'td{padding:1.7mm 2mm;border-bottom:.2mm solid var(--line);vertical-align:top}',
    '.r{text-align:right}td.num,.r.num{white-space:nowrap}td.op{width:5mm;color:var(--muted);font-family:"JetBrains Mono",monospace}',
    'td.q{color:var(--muted);font-size:7.6pt;width:34%}.det{color:var(--muted);font-size:7.6pt;margin-top:.6mm;font-weight:400}',
    'tr.ein td:first-child{padding-left:6mm;color:var(--muted)}',
    'tr.summe td{font-weight:600;border-bottom:.3mm solid var(--ink)}tr.ende td{font-weight:600;background:var(--gold-l);border-bottom:0}',
    'td.pos{color:var(--gruen)}td.neg{color:var(--rot)}',
    'table.dicht{font-size:7.6pt}table.dicht td,table.dicht th{padding:1.2mm 1.4mm}',
    '.kv{display:grid;grid-template-columns:1fr 1fr;gap:0 9mm}.kv div{display:flex;justify-content:space-between;gap:4mm;border-bottom:.2mm solid var(--line);padding:1.7mm 0}',
    '.kv span:first-child{color:var(--muted)}',
    '.hinweis{border-left:.8mm solid var(--gold);background:var(--gold-l);padding:3mm 4mm;margin:4mm 0;font-size:8.4pt;break-inside:avoid}',
    '.hinweis.gut{border-left-color:var(--gruen);background:color-mix(in srgb,var(--gruen) 8%,#fff)}',
    '.zwei{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7mm}.drei3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5mm}',
    '.galerie{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:4mm 0}.galerie img{width:100%;height:52mm;object-fit:cover;display:block;border-radius:1mm}',
    '.karte{width:100%;height:auto;display:block;border:.2mm solid var(--line);border-radius:1mm}',
    '.tag{display:inline-block;font:6.8pt/1 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;padding:1mm 1.5mm;border-radius:.8mm;background:var(--soft);color:var(--muted)}.tag.g{background:var(--obs);color:#fff}',
    /* Phasen-Spalten */
    '.phase{border:.2mm solid var(--line);border-radius:1mm;overflow:hidden;break-inside:avoid}.phase h4{font-size:9pt;padding:2.2mm 3mm;background:var(--soft);border-bottom:.2mm solid var(--line)}',
    '.phase.p1 h4{border-top:.8mm solid var(--gruen)}.phase.p2 h4{border-top:.8mm solid var(--gold)}.phase.p3 h4{border-top:.8mm solid var(--rot)}',
    '.phase table td{padding:1.3mm 3mm}',
    /* Diagramme */
    '.dg{width:100%;height:auto;font-family:"JetBrains Mono",monospace}.dg .g{stroke:var(--line);stroke-width:.6}.dg .a{font-size:7px;fill:#5F5E66}',
    '.dg .l1{fill:none;stroke:var(--gold);stroke-width:1.8}.dg .l2{fill:none;stroke:var(--rot);stroke-width:1.6}.dg .l3{fill:none;stroke:var(--gruen);stroke-width:1.8}',
    '.dg .f1{fill:color-mix(in srgb,var(--gruen) 12%,#fff)}.dg .b1{fill:var(--gold)}.dg .b2{fill:var(--gruen)}.dg .b3{fill:color-mix(in srgb,var(--gold) 70%,#000)}.dg .bt{font-size:7.5px;fill:#16161A}',
    '.legende{display:flex;gap:5mm;font-size:7.4pt;color:var(--muted);margin-top:1mm}.legende i{display:inline-block;width:3mm;height:1mm;margin-right:1.2mm;vertical-align:middle}',
    /* Energieskala */
    '.ek{margin:3mm 0 1mm}.ek-band{display:grid;grid-template-columns:repeat(9,1fr);gap:.8mm;height:11mm}',
    '.ek-seg{position:relative;display:flex;align-items:center;justify-content:center;clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%,14% 50%);opacity:.38}',
    '.ek-seg:first-child{clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%)}.ek-seg span{font:600 9.5pt/1 "Space Grotesk",sans-serif;color:#16161A}',
    '.ek-seg.an{opacity:1;transform:scaleY(1.18)}.ek-seg.an span{font-size:11pt}',
    '.ek-skala{display:grid;grid-template-columns:repeat(9,1fr);font:6.8pt "JetBrains Mono",monospace;color:var(--muted);margin-top:1.4mm}.ek-txt{font-size:8.4pt;margin-top:2mm}',
    'ol.quellen{padding-left:5mm;font-size:8pt;color:var(--muted)}ol.quellen li{margin-bottom:1.6mm}',
    '.score{display:flex;align-items:center;gap:4mm}.score svg{width:24mm;height:24mm}.score .w{font:600 12pt "Space Grotesk",sans-serif}'
  ].join('\n');

  /* ── Bausteine ────────────────────────────────────────────────────── */
  function kopf(c, titel) {
    var l = c.logo && c.logo.b64 ? '<img src="' + c.logo.b64 + '" alt="">' : '<strong>' + esc((c.marke && c.marke.company) || '') + '</strong>';
    return '<div class="kopf">' + l + '<div class="r">' + esc(c.dokument || '') + ' · ' + esc(titel) + '<br>' + esc(c.zeile || '') + '</div></div>';
  }
  function fuss(c) {
    var a = absenderZeilen(c.marke).filter(function (x, i) { return i !== 1; }).join(' · ');
    return '<div class="fuss"><span>' + esc(a) + '</span><span>' + esc(c.dokument || '') + (c.stand ? ' · Stand ' + esc(c.stand) : '') + '</span></div>';
  }
  /** Eine Seite. opt.quer = Querformat */
  function seite(c, titel, innen, opt) {
    return '<section class="seite' + (opt && opt.quer ? ' quer' : '') + '">' + kopf(c, titel) + innen + fuss(c) + '</section>';
  }
  function abschnitt(eyebrow, titel, unter) {
    return (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + '</div>' : '') + '<h2>' + esc(titel) + '</h2>' + (unter ? '<p class="sub">' + esc(unter) + '</p>' : '');
  }
  /** Deckblatt. o: {bild, eyebrow, titel, unter, wertLabel, wert, wertNeben, meta:[[k,v]], zitat, hinweisRechts} */
  function deckblatt(c, o) {
    var lg = c.logo && c.logo.b64 ? '<img src="' + c.logo.b64 + '" alt="">' : '<strong>' + esc((c.marke && c.marke.company) || '') + '</strong>';
    var z = absenderZeilen(c.marke);
    return '<section class="seite deck"><div class="bild' + (o.bild ? '' : ' ohne') + '"' + (o.bild ? ' style="background-image:url(\'' + o.bild + '\')"' : '') + '><div class="logo">' + lg + '</div></div>'
      + '<div class="inhalt"><div class="eyebrow">' + esc(o.eyebrow || '') + '</div><h1>' + esc(o.titel || '') + '</h1><div class="adr">' + esc(o.unter || '') + '</div>'
      + (o.wert != null ? '<div class="wertbox"><div>' + (o.wertLabel ? '<div class="lbl">' + esc(o.wertLabel) + '</div>' : '') + '<div class="wert">' + (o.wert != null ? esc(o.wert) : '') + '</div></div>'
        + '<div style="font-size:8.6pt;color:var(--muted)">' + (o.wertNeben || '') + '</div></div>' : '')
      + (o.kz ? kacheln(o.kz) : '')
      + (o.meta && o.meta.length ? '<div class="meta">' + o.meta.map(function (m) { return '<div><b>' + esc(m[0]) + '</b>' + esc(m[1]) + '</div>'; }).join('') + '</div>' : '')
      + (o.zitat ? '<div class="zitat">' + esc(o.zitat) + '</div>' : '') + '</div>'
      + '<div class="abs"><div>' + (z[0] ? '<strong>' + esc(z[0]) + '</strong>' : '') + z.slice(1).map(function (x) { return '<br>' + esc(x); }).join('') + '</div>'
      + '<div style="text-align:right">' + (o.hinweisRechts || 'Erstellt am ' + esc(datum(new Date()))) + '</div></div></section>';
  }
  /** Kacheln: [{l, v, s, art:'gut'|'schlecht'|'hi'}] */
  function kacheln(liste, drei) {
    return '<div class="kz' + (drei ? ' drei' : '') + '">' + (liste || []).filter(Boolean).map(function (k) {
      return '<div class="' + (k.art || '') + '"><div class="l">' + esc(k.l) + '</div><div class="v">' + esc(k.v) + '</div>' + (k.s ? '<div class="s">' + esc(k.s) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  /** Zweispaltige Liste [[k, v, art]] (art: 'summe'|'ende'|'ein') als Tabelle */
  function liste(zeilen, kopfZeile) {
    return '<table>' + (kopfZeile ? '<thead><tr>' + kopfZeile.map(function (h, i) { return '<th' + (i ? ' class="r"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead>' : '') + '<tbody>'
      + (zeilen || []).filter(Boolean).map(function (z) {
        var werte = z.slice(1, z.length - (typeof z[z.length - 1] === 'object' && z[z.length - 1] !== null && !Array.isArray(z[z.length - 1]) ? 1 : 0));
        var o = (typeof z[z.length - 1] === 'object' && z[z.length - 1] !== null) ? z[z.length - 1] : {};
        return '<tr class="' + (o.art || '') + '"><td>' + esc(z[0]) + (o.det ? '<div class="det">' + esc(o.det) + '</div>' : '') + '</td>'
          + werte.map(function (w) { var s = String(w == null ? '–' : w); var cls = o.farbe ? (/^[+]/.test(s) ? ' pos' : /^[−-]/.test(s) ? ' neg' : '') : ''; return '<td class="r num' + cls + '">' + esc(s) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  /** Rechenstaffel aus dem Kern ({pos, detail, wert, faktor, summe}) mit Fundstellen */
  function staffel(rows, fundstellen) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return '<table><thead><tr><th></th><th>Position</th><th class="r">Betrag</th>' + (fundstellen ? '<th>Fundstelle</th>' : '') + '</tr></thead><tbody>' + rows.map(function (z, i) {
      var pos = String(z.pos || ''), op = /^[×x−\-+=]/.test(pos) ? pos.charAt(0).replace('x', '×').replace('-', '−') : '', text = op ? pos.slice(1).trim() : pos;
      var ende = i === rows.length - 1, summe = z.summe || op === '=';
      return '<tr class="' + (ende ? 'ende' : summe ? 'summe' : '') + '"><td class="op">' + esc(op) + '</td><td>' + esc(text) + (z.detail ? '<div class="det">' + esc(z.detail) + '</div>' : '') + '</td>'
        + '<td class="r num">' + (istZahl(z.wert) ? eur(Math.abs(Number(z.wert))) : (istZahl(z.faktor) ? zahl(z.faktor, 3) : '')) + '</td>'
        + (fundstellen ? '<td class="q">' + esc(fundstellen[i] || '') + '</td>' : '') + '</tr>';
    }).join('') + '</tbody></table>';
  }

  /* ── Diagramme (SVG, maßstäblich, Farben über CSS-Klassen) ──────────── */
  /** Linien: reihen [{name, klasse:'l1'|'l2'|'l3', werte:[{x, y}]}], opt {flaeche:[i,j], fmt} */
  function linien(reihen, opt) {
    opt = opt || {};
    var alle = [].concat.apply([], reihen.map(function (r) { return r.werte; })).filter(function (p) { return istZahl(p.y); });
    if (alle.length < 2) return '';
    var W = opt.w || 520, H = opt.h || 170, L = 46, R = 12, T = 12, B = 22;
    var xs = alle.map(function (p) { return p.x; }), ys = alle.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.12 || Math.abs(y1) * 0.1 || 1;
    y0 = opt.null ? Math.min(0, y0) : y0 - pad; y1 += pad;
    var X = function (x) { return L + (x - x0) / Math.max(1, x1 - x0) * (W - L - R); }, Y = function (y) { return T + (1 - (y - y0) / (y1 - y0)) * (H - T - B); };
    var fmt = opt.fmt || function (v) { return zahl(v / 1000, 0) + ' T€'; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dg" role="img" aria-label="' + esc(opt.titel || 'Diagramm') + '">';
    [0, .5, 1].forEach(function (t) { var v = y0 + (y1 - y0) * t; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="g"/><text x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end" class="a">' + fmt(v) + '</text>'; });
    if (opt.flaeche && reihen[opt.flaeche[0]] && reihen[opt.flaeche[1]]) {
      var a = reihen[opt.flaeche[0]].werte, b = reihen[opt.flaeche[1]].werte.slice().reverse();
      s += '<path class="f1" d="' + a.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ') + ' ' + b.map(function (p) { return 'L' + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ') + ' Z"/>';
    }
    reihen.forEach(function (r) {
      var w = r.werte.filter(function (p) { return istZahl(p.y); });
      s += '<path class="' + (r.klasse || 'l1') + '" d="' + w.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ') + '"/>';
    });
    var schritt = Math.max(1, Math.ceil((x1 - x0) / 7));
    for (var x = x0; x <= x1; x += schritt) s += '<text x="' + X(x).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="a">' + x + '</text>';
    s += '</svg>';
    var leg = '<div class="legende">' + reihen.map(function (r) { return '<span><i style="background:' + (r.klasse === 'l2' ? 'var(--rot)' : r.klasse === 'l3' ? 'var(--gruen)' : 'var(--gold)') + '"></i>' + esc(r.name) + '</span>'; }).join('') + '</div>';
    return s + leg;
  }
  /** Wasserfall/Balken: [{name, wert, klasse}] mit Summe am Ende */
  function wasserfall(teile, summeName) {
    var W = 520, H = 170, L = 10, R = 10, T = 16, B = 26, n = teile.length + 1, bw = (W - L - R) / n * 0.62, gap = (W - L - R) / n;
    var summe = teile.reduce(function (a, t) { return a + (Number(t.wert) || 0); }, 0), max = Math.max(summe, 1);
    var Y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="dg" role="img" aria-label="Vermögenszuwachs">', lauf = 0;
    teile.forEach(function (t, i) {
      var x = L + i * gap + (gap - bw) / 2, v = Number(t.wert) || 0, y1 = Y(lauf + Math.max(0, v)), y2 = Y(lauf + Math.min(0, v));
      s += '<rect x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, y2 - y1).toFixed(1) + '" rx="1.5" class="' + (t.klasse || 'b2') + '"/>'
        + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y1 - 3).toFixed(1) + '" text-anchor="middle" class="bt">' + (v >= 0 ? '+' : '−') + zahl(Math.abs(v) / 1000, 0) + ' T€</text>'
        + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="a">' + esc(t.name) + '</text>';
      lauf += v;
    });
    var xs = L + teile.length * gap + (gap - bw) / 2;
    s += '<rect x="' + xs.toFixed(1) + '" y="' + Y(summe).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (Y(0) - Y(summe)).toFixed(1) + '" rx="1.5" class="b3"/>'
      + '<text x="' + (xs + bw / 2).toFixed(1) + '" y="' + (Y(summe) - 3).toFixed(1) + '" text-anchor="middle" class="bt">+' + zahl(summe / 1000, 0) + ' T€</text>'
      + '<text x="' + (xs + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="a">' + esc(summeName || 'Gesamt') + '</text></svg>';
    return s;
  }
  /** Score-Ring 0-100 */
  function scoreRing(score, wort) {
    if (!istZahl(score)) return '';
    var r = 30, u = 2 * Math.PI * r, t = Math.max(0, Math.min(100, Number(score))) / 100;
    return '<div class="score"><svg viewBox="0 0 80 80" role="img" aria-label="Deal Score ' + zahl(score, 0) + '"><circle cx="40" cy="40" r="' + r + '" fill="none" stroke="#E3E1DA" stroke-width="7"/>'
      + '<circle cx="40" cy="40" r="' + r + '" fill="none" style="stroke:var(--gold)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (u * t).toFixed(1) + ' ' + u.toFixed(1) + '" transform="rotate(-90 40 40)"/>'
      + '<text x="40" y="46" text-anchor="middle" style="font:600 20px \'Space Grotesk\',sans-serif;fill:#16161A">' + zahl(score, 0) + '</text></svg>'
      + '<div><div class="w">' + esc(wort || '') + '</div><div class="det">Deal Score von 100</div></div></div>';
  }
  var EFFIZIENZ = [['A+', 0, 30, '#00843d'], ['A', 30, 50, '#2ba13a'], ['B', 50, 75, '#8cbf26'], ['C', 75, 100, '#cddc28'], ['D', 100, 130, '#fde70a'], ['E', 130, 160, '#fbb913'], ['F', 160, 200, '#f18a1d'], ['G', 200, 250, '#e5361d'], ['H', 250, null, '#b3191e']];
  function energieSkala(klasse, kwh) {
    var k = klasse ? String(klasse).toUpperCase().replace(/\s/g, '') : null;
    if (!k && istZahl(kwh)) { for (var i = 0; i < EFFIZIENZ.length; i++) { if (EFFIZIENZ[i][2] == null || Number(kwh) < EFFIZIENZ[i][2]) { k = EFFIZIENZ[i][0]; break; } } }
    return '<div class="ek"><div class="ek-band">' + EFFIZIENZ.map(function (e) { return '<div class="ek-seg' + (e[0] === k ? ' an' : '') + '" style="background:' + e[3] + '"><span>' + e[0] + '</span></div>'; }).join('')
      + '</div><div class="ek-skala">' + EFFIZIENZ.map(function (e) { return '<span>' + (e[2] == null ? '&gt; 250' : e[1]) + '</span>'; }).join('') + '</div>'
      + '<p class="ek-txt">' + (k ? 'Energieeffizienzklasse <b>' + esc(k) + '</b>' + (istZahl(kwh) ? ' · ' + zahl(kwh, 0) + ' kWh/(m²·a)' : ' · laut Angabe, Kennwert nicht erfasst') : 'Keine Angabe zur Energieeffizienz') + '</p></div>';
  }

  /* ── Dokument und Vorschau ───────────────────────────────────────── */
  function dokument(titel, seiten, opt) {
    var fonts = (location && location.origin ? location.origin : '') + '/fonts/dp-fonts.css';
    /* Querformat fuer das ganze Dokument (Bankexport): die Seitenregel kommt NACH der hochkant-Regel */
    var quer = opt && opt.quer ? '@page{size:A4 landscape;margin:12mm 0 14mm}@page:first{size:A4 landscape;margin:12mm 0 14mm}' : '';
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' + esc(titel) + '</title><link rel="stylesheet" href="' + fonts + '"><style>' + CSS + quer + markenGold() + '</style></head><body>' + seiten.join('') + '</body></html>';
  }
  function vorschau(doc, titel) {
    var alt = document.getElementById('dp-dok-vorschau'); if (alt) alt.remove();
    var w = document.createElement('div'); w.id = 'dp-dok-vorschau';
    w.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(5,5,5,.72);display:flex;flex-direction:column';
    w.innerHTML = '<div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:10px 16px;background:#0B0B0D;color:#fff;font:13px Inter,sans-serif">'
      + '<span style="margin-right:auto">' + esc(titel) + '</span>'
      + '<button type="button" data-a="druck" style="background:var(--wl-c9a84c,#C9A84C);color:#0a0a0a;border:0;border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer">Drucken / als PDF speichern</button>'
      + '<button type="button" data-a="zu" style="background:transparent;color:#fff;border:1px solid #444;border-radius:999px;padding:8px 14px;cursor:pointer">Schließen</button></div>'
      + '<iframe title="' + esc(titel) + '" style="flex:1;border:0;background:#E9E7E1"></iframe>';
    document.body.appendChild(w);
    var f = w.querySelector('iframe');
    f.srcdoc = doc.replace('</style>', 'body{background:#E9E7E1}.seite{background:#fff;margin:8mm auto;box-shadow:0 2px 14px rgba(0,0,0,.18)}@media print{body{background:#fff}.seite{margin:0;box-shadow:none}}</style>');
    w.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'zu') w.remove();
      if (a === 'druck') { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) {} }
    });
  }

  window.DpDokument = {
    VERSION: VERSION, CSS: CSS,
    esc: esc, istZahl: istZahl, zahl: zahl, eur: eur, eurS: eurS, pct: pct, jahr: jahr, datum: datum,
    marke: marke, logo: logo, karte: karte, absenderZeilen: absenderZeilen,
    kopf: kopf, fuss: fuss, seite: seite, abschnitt: abschnitt, deckblatt: deckblatt, kacheln: kacheln, liste: liste, staffel: staffel,
    linien: linien, wasserfall: wasserfall, scoreRing: scoreRing, energieSkala: energieSkala,
    dokument: dokument, vorschau: vorschau
  };
})();
