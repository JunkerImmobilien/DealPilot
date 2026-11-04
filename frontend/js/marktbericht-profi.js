/* ═══════════════════════════════════════════════════════════════════════
   marktbericht-profi.js · v3176 — der Marktbericht in der PROFI-FASSUNG
   Marcel 04.11.2026: „bau mal eine zusätzliche Fassung mit allem was wir
   können, professionell, und auch eine schöne Energieeffizienzskala so wie
   man die kennt, mit Logo und Anschrift und allem … und Bilder“ und
   „bitte nutze professionelle Schriften, nicht so ein Geschnörkel“.

   WAS ES IST
     Ein A4-Dokument aus HTML, kein jsPDF: Fotos, Lagekarte, Energieskala
     und Rechentabellen setzt der Browser sauber. Gedruckt wird es
       · in der App über das Druckfenster des Browsers (Vorschau + Knopf),
       · auf dem Server vom PDF-Dienst (Art `marktbericht_profi`), der
         `DpProfi.html()` in der App ruft und das Ergebnis mit Chrome druckt.
     Beide Wege bauen dasselbe HTML an EINER Stelle (hier).

   WOHER DIE ZAHLEN KOMMEN
     Nur aus dem gespeicherten Stufe-3-Bericht (cross_check, valuation,
     land_value, micro, makro_kennzahlen, zensus, sale, rent) und dem Objekt
     (Fotos, Effizienzklasse). Hier wird NICHTS gerechnet — jede Zeile ist
     eine Zeile des Kerns, mit seiner Fundstelle. Fehlt ein Verfahren, fehlt
     sein Abschnitt (Kein Verfahren rechnet halb).

   Schriften: Inter (Text), Space Grotesk (Überschriften), JetBrains Mono
   (Zahlen) — selbst gehostet unter /fonts/dp-fonts.css. Keine Serifen.
   Quellen: amtliche Stellen werden genannt; Angebotsdaten nur als
   „aktueller Marktdurchschnitt“ (keine Anbieter nach außen).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VERSION = 'v3177';

  /* ── kleine Helfer ─────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function istZahl(v) { return v !== null && v !== undefined && v !== '' && isFinite(Number(v)); }
  function eur(v) { return istZahl(v) ? Math.round(Number(v)).toLocaleString('de-DE') + ' €' : '–'; }
  function zahl(v, d) {
    if (!istZahl(v)) return '–';
    return Number(v).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function jahr(v) { return istZahl(v) ? String(Math.round(Number(v))) : '–'; }   /* Baujahr nie durch Intl */
  function datum(s) { if (!s) return ''; try { var d = new Date(s); return isNaN(d) ? String(s) : d.toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  function nz(v) { return v != null && v !== ''; }

  /* ── Energieeffizienzskala nach GEG (Anlage 10), kWh/(m²·a) ─────────── */
  var EFFIZIENZ = [
    { k: 'A+', von: 0,   bis: 30,  f: '#00843d' },
    { k: 'A',  von: 30,  bis: 50,  f: '#2ba13a' },
    { k: 'B',  von: 50,  bis: 75,  f: '#8cbf26' },
    { k: 'C',  von: 75,  bis: 100, f: '#cddc28' },
    { k: 'D',  von: 100, bis: 130, f: '#fde70a' },
    { k: 'E',  von: 130, bis: 160, f: '#fbb913' },
    { k: 'F',  von: 160, bis: 200, f: '#f18a1d' },
    { k: 'G',  von: 200, bis: 250, f: '#e5361d' },
    { k: 'H',  von: 250, bis: null, f: '#b3191e' }
  ];
  function klasseAusKwh(kwh) {
    if (!istZahl(kwh)) return null;
    for (var i = 0; i < EFFIZIENZ.length; i++) {
      var e = EFFIZIENZ[i];
      if (e.bis == null || Number(kwh) < e.bis) return e.k;
    }
    return 'H';
  }
  function energieSkala(klasse, kwh) {
    var k = klasse ? String(klasse).toUpperCase().replace(/\s/g, '') : klasseAusKwh(kwh);
    var seg = EFFIZIENZ.map(function (e) {
      var an = e.k === k;
      return '<div class="ek-seg' + (an ? ' an' : '') + '" style="background:' + e.f + '">'
        + '<span>' + e.k + '</span>' + (an ? '<i class="ek-pfeil"></i>' : '') + '</div>';
    }).join('');
    var skala = EFFIZIENZ.map(function (e) { return '<span>' + (e.bis == null ? '&gt; 250' : e.von) + '</span>'; }).join('');
    var txt = k
      ? 'Energieeffizienzklasse <b>' + esc(k) + '</b>' + (istZahl(kwh) ? ' · ' + zahl(kwh, 0) + ' kWh/(m²·a)' : '')
        + (istZahl(kwh) ? '' : ' · laut Angabe zum Objekt, Kennwert nicht erfasst')
      : 'Keine Angabe zur Energieeffizienz';
    return '<div class="ek"><div class="ek-band">' + seg + '</div><div class="ek-skala">' + skala + '</div>'
      + '<p class="ek-txt">' + txt + '</p></div>';
  }

  /* ── Rechentabelle aus einer Staffel des Kerns ─────────────────────── */
  function staffelTabelle(staffel, fundstellen) {
    if (!Array.isArray(staffel) || !staffel.length) return '';
    var zeilen = staffel.map(function (z, i) {
      var pos = String(z.pos || '');
      var op = /^[×x−\-+=]/.test(pos) ? pos.charAt(0).replace('x', '×').replace('-', '−') : '';
      var text = op ? pos.slice(1).trim() : pos;
      var summe = z.summe || op === '=';
      var ende = i === staffel.length - 1;
      var q = (fundstellen && fundstellen[i]) || '';
      return '<tr class="' + (ende ? 'ende' : summe ? 'summe' : '') + '"><td class="op">' + esc(op) + '</td>'
        + '<td>' + esc(text) + (z.detail ? '<div class="det">' + esc(z.detail) + '</div>' : '') + '</td>'
        + '<td class="r num">' + (istZahl(z.wert) ? eur(Math.abs(Number(z.wert))) : (istZahl(z.faktor) ? zahl(z.faktor, 3) : '')) + '</td>'
        + (fundstellen ? '<td class="q">' + esc(q) + '</td>' : '') + '</tr>';
    }).join('');
    return '<table class="rt"><thead><tr><th></th><th>Position</th><th class="r">Betrag</th>'
      + (fundstellen ? '<th>Fundstelle</th>' : '') + '</tr></thead><tbody>' + zeilen + '</tbody></table>';
  }

  /* ── welches Verfahren führt (aus dem Kern, sonst nach Objektart) ───── */
  function verfahren(p) {
    var c = p.cross_check || {};
    var sw = c.sachwert || {}, ew = c.ertragswert || {}, irw = c.vergleichswert_irw || {}, rvf = c.register_vergleichsfaktor || {};
    var mv = (p.valuation && p.valuation.market_value) || {};
    var liste = [];
    var swMarkt = sw.value_eur != null && sw.sachwertfaktor && sw.sachwertfaktor.wert;
    if (istZahl(sw.value_eur)) liste.push({ id: 'sachwert', name: swMarkt ? 'Sachwert (marktangepasst)' : 'Sachwert (vorläufig, ohne Sachwertfaktor)', wert: sw.value_eur, recht: '§§ 35–39 ImmoWertV', tag: swMarkt ? 'amtlich angepasst' : 'ohne Marktanpassung', voll: !!swMarkt });
    if (irw.verfuegbar && istZahl(irw.vergleichswert_eur)) liste.push({ id: 'vergleichswert', name: 'Vergleichswert (Immobilienrichtwert)', wert: irw.vergleichswert_eur, recht: '§§ 24–26 ImmoWertV', tag: 'amtlich · Stufe ' + (irw.stufe || 'A'), voll: true });
    else if (rvf.verfuegbar && istZahl(rvf.vergleichswert_eur)) liste.push({ id: 'vergleichswert', name: 'Vergleichswert (Vergleichsfaktor)', wert: rvf.vergleichswert_eur, recht: '§ 20 ImmoWertV', tag: 'amtlich', voll: true });
    if (istZahl(ew.value_eur)) liste.push({ id: 'ertragswert', name: 'Ertragswert', wert: ew.value_eur, recht: '§§ 27–34 ImmoWertV', tag: 'Zins Stufe ' + (ew.liegenschaftszins_stufe || '–'), voll: true });
    if (istZahl(mv.estimated)) liste.push({ id: 'angebote', name: 'Marktpreisindikation aus Angeboten', wert: mv.estimated, recht: 'bereinigt um den Angebotsabschlag', tag: (p.sale && p.sale.sample_size ? p.sale.sample_size + ' Angebote' : 'Angebote'), voll: true, low: mv.low, high: mv.high });

    var vw = c.verfahrenswahl || {};
    var art = String((p.ref && p.ref.property_type) || '').toLowerCase();
    var soll = vw.verfahren || (/etw|wohnung/.test(art) ? 'vergleichswert' : /haus|efh|zfh|dhh|reihen/.test(art) ? 'sachwert' : 'ertragswert');
    var fuehrend = liste.filter(function (x) { return x.id === soll && x.voll; })[0]
      || liste.filter(function (x) { return x.id === 'vergleichswert'; })[0]
      || liste.filter(function (x) { return x.id === 'angebote'; })[0] || liste[0] || null;
    if (fuehrend) fuehrend.fuehrend = true;
    return { liste: liste, fuehrend: fuehrend, grund: vw.grund || '', grundQuelle: vw.quelle || '' };
  }

  /* ── Spanne der Verfahren als waagerechtes Band (SVG, maßstäblich) ── */
  function spanneSvg(liste, kp) {
    var werte = liste.map(function (x) { return Number(x.wert); }).concat(istZahl(kp) ? [Number(kp)] : []);
    if (werte.length < 2) return '';
    var min = Math.min.apply(null, werte), max = Math.max.apply(null, werte);
    var pad = (max - min) * 0.12 || max * 0.05; min -= pad; max += pad;
    var B = 640, x = function (v) { return 20 + (Number(v) - min) / (max - min) * (B - 40); };
    var s = '<svg viewBox="0 0 ' + B + ' ' + (60 + liste.length * 26) + '" class="spanne" role="img" aria-label="Werte der Verfahren im Vergleich">';
    s += '<line x1="20" y1="30" x2="' + (B - 20) + '" y2="30" stroke="#C9C6BC" stroke-width="2"/>';
    if (istZahl(kp)) s += '<line x1="' + x(kp) + '" y1="16" x2="' + x(kp) + '" y2="' + (44 + liste.length * 26) + '" stroke="#16161A" stroke-dasharray="3 3" stroke-width="1"/>'
      + '<text x="' + x(kp) + '" y="11" text-anchor="middle" font-size="10" fill="#16161A">Kaufpreis ' + eur(kp) + '</text>';
    liste.forEach(function (v, i) {
      var y = 52 + i * 26;
      s += '<circle cx="' + x(v.wert) + '" cy="30" r="' + (v.fuehrend ? 7 : 5) + '" class="' + (v.fuehrend ? 'pf' : 'pn') + '" stroke="#fff" stroke-width="2"/>';
      s += '<line x1="' + x(v.wert) + '" y1="36" x2="' + x(v.wert) + '" y2="' + (y - 9) + '" stroke="#E3E1DA" stroke-width="1"/>';
      var anker = x(v.wert) > B * 0.7 ? 'end' : x(v.wert) < B * 0.3 ? 'start' : 'middle';
      s += '<text x="' + x(v.wert) + '" y="' + y + '" text-anchor="' + anker + '" font-size="10.5" class="' + (v.fuehrend ? 'tf' : 'tn') + '">'
        + esc(v.name.replace(/ \(.*\)$/, '')) + ' · ' + eur(v.wert) + '</text>';
    });
    return s + '</svg>';
  }

  /* ── Markdown des KI-Textes: nur Abschnitt A, als Absätze ─────────── */
  function zusammenfassung(md) {
    if (!md) return '';
    var t = String(md).split(/\n#\s/)[0].replace(/^#[^\n]*\n/, '');
    var abs = t.split(/\n\s*\n/).map(function (a) { return a.replace(/\*\*/g, '').replace(/^[-*]\s+/gm, '').trim(); })
      .filter(function (a) { return a && !/^#/.test(a); }).slice(0, 3);
    return abs.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('');
  }

  /* ── Lage: Teilnoten der Mikrolage ────────────────────────────────── */
  var KAT = { verkehr: 'Verkehr', bildung: 'Bildung', einkaufen: 'Einkaufen', gesundheit: 'Gesundheit',
    freizeit: 'Freizeit', gastronomie: 'Gastronomie', natur: 'Natur', kultur: 'Kultur' };
  function mikrolage(m) {
    if (!m || !m.categories) return '';
    var z = Object.keys(m.categories).map(function (k) {
      var c = m.categories[k] || {};
      var naechst = m.groups && m.groups[k] && m.groups[k].items && m.groups[k].items[0];
      return '<tr><td>' + esc(KAT[k] || k) + '</td><td><div class="balken"><span style="width:' + Math.max(2, Math.min(100, Number(c.subscore) || 0)) + '%"></span></div></td>'
        + '<td class="r num">' + zahl(c.subscore, 0) + '</td><td class="q">' + (naechst ? esc(String(naechst.name).split(',')[0]) + ' · ' + zahl(naechst.distance_m, 0) + ' m' : (istZahl(c.nearest_m) ? zahl(c.nearest_m, 0) + ' m' : '–')) + '</td></tr>';
    }).join('');
    return '<table class="lt"><thead><tr><th>Bereich</th><th style="width:38%">Teilnote</th><th class="r">0–100</th><th>Nächster Ort</th></tr></thead><tbody>' + z + '</tbody></table>';
  }

  /* ── v3177 · Was in der Nähe ist (wie der normale Bericht: je Bereich bis zu fünf Orte) ── */
  var KAT_ORD = ['einkaufen', 'verkehr', 'gesundheit', 'bildung', 'freizeit', 'gastronomie'];
  function umgebung(m) {
    var g = m && m.groups; if (!g) return '';
    var bloecke = KAT_ORD.filter(function (k) { return g[k] && (g[k].items || []).length; }).map(function (k) {
      var it = g[k].items.slice(0, 5).map(function (x) {
        return '<li><span>' + esc(String(x.name || '').split(',')[0]) + '</span><span class="num">' + (istZahl(x.distance_m) ? zahl(x.distance_m, 0) + ' m' : '–') + '</span></li>';
      }).join('');
      return '<div class="umg"><b>' + esc(KAT[k] || k) + (istZahl(g[k].count) ? ' <span>· ' + zahl(g[k].count, 0) + ' im Umkreis</span>' : '') + '</b><ul>' + it + '</ul></div>';
    }).join('');
    return bloecke ? '<h3>In der Nähe</h3><div class="umg-raster">' + bloecke + '</div>' : '';
  }

  /* ── v3177 · Vergleichsangebote (entdoppelt wie _mbCompsEindeutig im normalen Bericht) ── */
  var ARTWORT = { apartment: 'Wohnung', wohnung: 'Wohnung', etw: 'Wohnung', house: 'Haus', haus: 'Haus', efh: 'Haus', mfh: 'Mehrfamilienhaus', multi_family: 'Mehrfamilienhaus' };
  function vergleichsangebote(p) {
    var comps = (p.sale && p.sale.comparables) || [];
    if (!comps.length) return '';
    var mp = new Map();
    comps.forEach(function (c) {
      var k = [c.postcode || '', c.city || '', c.living_area, c.price, c.build_year].join('|');
      var alt = mp.get(k);
      if (!alt || (c.distance_m != null && (alt.distance_m == null || c.distance_m < alt.distance_m))) mp.set(k, c);
    });
    var e = comps.filter(function (c) { return Array.from(mp.values()).indexOf(c) >= 0; })
      .sort(function (a, b) { return (a.distance_m == null ? 1e9 : a.distance_m) - (b.distance_m == null ? 1e9 : b.distance_m); });
    var ges = (p.sale && p.sale.sample_size) || e.length;
    var zeig = e.slice(0, 14);
    var z = zeig.map(function (c) {
      return '<tr><td>' + esc(ARTWORT[String(c.property_type || '').toLowerCase()] || c.property_type || '–') + '</td><td>' + esc([c.postcode, c.city].filter(Boolean).join(' ') || '–') + '</td>'
        + '<td class="r num">' + (istZahl(c.living_area) ? zahl(c.living_area, 0) + ' m²' : '–') + '</td><td class="r num">' + jahr(c.build_year) + '</td>'
        + '<td class="r num">' + eur(c.price) + '</td><td class="r num">' + (istZahl(c.price_per_sqm) ? zahl(c.price_per_sqm, 0) : '–') + '</td>'
        + '<td class="r num">' + (istZahl(c.distance_m) ? zahl(c.distance_m, 0) + ' m' : '–') + '</td></tr>';
    }).join('');
    return '<h3>Vergleichsangebote (' + zeig.length + (ges > zeig.length ? ' von ' + zahl(ges, 0) : '') + ')</h3>'
      + '<table><thead><tr><th>Art</th><th>Ort</th><th class="r">Fläche</th><th class="r">Baujahr</th><th class="r">Angebotspreis</th><th class="r">€/m²</th><th class="r">Entfernung</th></tr></thead><tbody>' + z + '</tbody></table>'
      + '<p class="det">Angebotspreise, keine Kaufpreise. ' + (ges > zeig.length ? 'Median und Quartile oben stammen aus allen ' + zahl(ges, 0) + ' Angeboten. ' : '')
      + (comps.length > e.length ? (comps.length - e.length) + ' doppelt eingestellte Angebote sind nur einmal gezählt.' : '') + '</p>';
  }

  /* ── v3177 · Führendes Verfahren, deutlich und begründet ──────────── */
  var VERF_NAME = { sachwert: 'Sachwertverfahren', vergleichswert: 'Vergleichswertverfahren', ertragswert: 'Ertragswertverfahren', angebote: 'Marktpreisindikation aus Angeboten' };
  function fuehrendBox(v) {
    if (!v.fuehrend) return '';
    var f = v.fuehrend;
    var rest = v.liste.filter(function (x) { return !x.fuehrend; }).map(function (x) { return x.name + ' ' + eur(x.wert); });
    return '<div class="fuehrt"><div class="fuehrt-k">Führendes Verfahren</div><div class="fuehrt-n">' + esc(VERF_NAME[f.id] || f.name) + ' · ' + eur(f.wert) + '</div>'
      + '<p>' + esc(v.grund || '') + (v.grundQuelle ? ' <span class="det">(' + esc(v.grundQuelle) + ')</span>' : '') + '</p>'
      + (rest.length ? '<p class="det">Zur Plausibilisierung: ' + esc(rest.join(' · ')) + '.</p>' : '') + '</div>';
  }

  /* ── Daten sammeln ────────────────────────────────────────────────── */
  function api(pfad, opt) { return window.Auth.apiCall(pfad, opt); }
  function alsDataUrl(blob) {
    return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { ok(null); }; r.readAsDataURL(blob); });
  }
  function karte(lat, lon, zoom, w, h) {
    if (!istZahl(lat) || !istZahl(lon)) return Promise.resolve(null);
    var t = ''; try { t = localStorage.getItem('ji_token') || ''; } catch (e) {}
    var url = '/api/v1/marktbericht/static-map?lat=' + lat + '&lon=' + lon + '&zoom=' + zoom + '&width=' + w + '&height=' + h;
    return fetch(url, { headers: t ? { Authorization: 'Bearer ' + t } : {} })
      .then(function (r) { return r.ok && /image/.test(r.headers.get('content-type') || '') ? r.blob() : null; })
      .then(function (b) { return b ? alsDataUrl(b) : null; }).catch(function () { return null; });
  }
  function marke() {
    try {
      var b = window.DealPilotConfig && DealPilotConfig.branding;
      if (b) return (b.fuerPdf ? b.fuerPdf() : b.get()) || {};
    } catch (e) {}
    return {};
  }
  /** Neuester Stufe-3-Bericht zu einem Objekt, oder null. */
  function berichtFuer(objKey) {
    return api('/marktbericht/objects/history?ref=' + encodeURIComponent(objKey)).then(function (h) {
      var l = (h && h.history) || [];
      var drei = l.filter(function (x) { return String(x.wert_stufe || '') === '3'; });
      var x = drei[0] || null;
      return x ? x.report_id : null;
    }).catch(function () { return null; });
  }
  function sammeln(objKey, reportId) {
    var rid = reportId ? Promise.resolve(reportId) : berichtFuer(objKey);
    return rid.then(function (id) {
      if (!id) throw new Error('Für dieses Objekt liegt kein Marktbericht der Stufe 3 vor. Bitte zuerst die Wertermittlung (Stufe 3) erstellen.');
      return Promise.all([
        api('/marktbericht/reports/one?id=' + encodeURIComponent(id)),
        objKey ? api('/objects/' + encodeURIComponent(objKey)).catch(function () { return null; }) : Promise.resolve(null)
      ]).then(function (r) {
        var rep = r[0] || {}, obj = r[1] || {};
        var p = rep.payload || rep.data || rep;
        if (!p || !p.cross_check || p.cross_check.nicht_im_umfang || !p.cross_check.available) {
          throw new Error('Dieser Bericht enthält keine Wertermittlung (Stufe 3).');
        }
        var lat = p.ref && p.ref.lat, lon = p.ref && p.ref.lon;
        var b = marke();
        return Promise.all([
          karte(lat, lon, 16, 1200, 620),
          karte(lat, lon, 12, 1200, 620),
          window.DealPilotPdfLogo ? DealPilotPdfLogo.fuerMarke(b).catch(function () { return null; }) : Promise.resolve(null)
        ]).then(function (z) {
          return { id: id, p: p, md: rep.report_md || p.report_md || '', erstellt: rep.created_at || null,
            obj: obj, fotos: (obj && obj.photos) || [], karteNah: z[0], karteFern: z[1], logo: z[2], marke: b };
        });
      });
    });
  }

  /* ── das Dokument ─────────────────────────────────────────────────── */
  var CSS = [
    '@page{size:A4;margin:13mm 0 17mm}@page:first{margin:0}',
    ':root{--ink:#16161A;--muted:#5F5E66;--line:#E3E1DA;--soft:#F5F3EE;--gold:var(--wl-b8932f, #b8932f);--gold-l:color-mix(in srgb,var(--gold) 14%,#fff);--obs:#0B0B0D}',
    '.spanne .pf{fill:var(--gold)}.spanne .pn{fill:#5F5E66}.spanne .tf{fill:color-mix(in srgb,var(--gold) 70%,#000)}.spanne .tn{fill:#5F5E66}',
    '*{box-sizing:border-box}html,body{margin:0;background:#fff;color:var(--ink)}',
    'body{font:9.6pt/1.5 Inter,system-ui,"Segoe UI",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.seite{width:210mm;padding:3mm 17mm 0;page-break-before:always;break-before:page}',
    '.seite.deck{page-break-before:auto;break-before:auto}',
    '.num{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}',
    'h1,h2,h3{font-family:"Space Grotesk",Inter,sans-serif;font-weight:600;margin:0;letter-spacing:-.01em}',
    'h2{font-size:17pt;margin-bottom:2mm}h3{font-size:11pt;margin:6mm 0 2.5mm}',
    '.kopf{display:flex;justify-content:space-between;align-items:center;border-bottom:.3mm solid var(--ink);padding-bottom:3mm;margin-bottom:8mm}',
    '.kopf img{height:9mm;width:auto}.kopf .r{font:7.5pt/1.3 "JetBrains Mono",monospace;color:var(--muted);text-align:right;letter-spacing:.04em;text-transform:uppercase}',
    '.eyebrow{font:7.5pt/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:2mm}',
    '.sub{color:var(--muted);margin:0 0 5mm}',
    'p{margin:0 0 2.5mm}',
    '.fuss{margin-top:8mm;display:flex;justify-content:space-between;gap:6mm;font:7pt/1.3 Inter,sans-serif;color:var(--muted);border-top:.2mm solid var(--line);padding-top:2mm;break-inside:avoid}',
    'td.num,.r.num{white-space:nowrap}',
    /* Deckblatt */
    '.deck{padding:0;display:flex;flex-direction:column;height:297mm;overflow:hidden}',
    '.deck .bild{height:128mm;background:var(--soft) center/cover no-repeat;position:relative}',
    '.deck .bild .logo{position:absolute;top:12mm;left:17mm;background:#fff;padding:3mm 4mm;border-radius:1.5mm}',
    '.deck .bild .logo img{height:11mm;width:auto;display:block}',
    '.deck .inhalt{padding:12mm 17mm 0;flex:1}',
    '.deck h1{font-size:25pt;line-height:1.12;margin:2mm 0 2mm}',
    '.deck .adr{font-size:12pt;color:var(--muted);margin-bottom:9mm}',
    '.deck .wertbox{display:grid;grid-template-columns:1.1fr 1fr;gap:8mm;align-items:end;border-top:.3mm solid var(--ink);border-bottom:.2mm solid var(--line);padding:6mm 0}',
    '.deck .wert{font:500 30pt/1 "JetBrains Mono",monospace;letter-spacing:-.02em}',
    '.deck .lbl{font:7.5pt/1.3 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2.5mm}',
    '.deck .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:7mm;font-size:8.6pt}',
    '.deck .meta b{display:block;font:7pt/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:400;margin-bottom:1mm}',
    '.deck .abs{padding:0 17mm 14mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;font-size:8.4pt;color:var(--muted)}',
    '.deck .abs strong{color:var(--ink);font-weight:600}',
    /* Kacheln der Verfahren */
    '.verf{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border:.2mm solid var(--line);margin:4mm 0}',
    '.verf>div{padding:3.5mm 4mm;border-bottom:.2mm solid var(--line)}.verf>div:nth-child(odd){border-right:.2mm solid var(--line)}',
    '.verf .t{font-size:8pt;color:var(--muted)}.verf .v{font:500 14pt/1.3 "JetBrains Mono",monospace;margin:.5mm 0 1mm}',
    '.verf .f{background:var(--gold-l)}',
    '.tag{display:inline-block;font:6.8pt/1 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;padding:1mm 1.5mm;border-radius:.8mm;background:var(--soft);color:var(--muted)}',
    '.tag.g{background:var(--obs);color:#fff}',
    '.spanne{width:100%;height:auto;margin:3mm 0;font-family:Inter,sans-serif}',
    /* Tabellen */
    'table{border-collapse:collapse;width:100%;font-size:8.6pt;page-break-inside:auto}tr{page-break-inside:avoid}',
    'th{font:6.8pt/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:1.8mm 2mm;border-bottom:.3mm solid var(--ink)}',
    'td{padding:1.8mm 2mm;border-bottom:.2mm solid var(--line);vertical-align:top}',
    '.r{text-align:right}td.op{width:5mm;color:var(--muted);font-family:"JetBrains Mono",monospace}',
    'td.q{color:var(--muted);font-size:7.6pt;width:34%}.det{color:var(--muted);font-size:7.6pt;margin-top:.6mm;font-weight:400}',
    'tr.summe td{font-weight:600;border-bottom:.3mm solid var(--ink)}tr.ende td{font-weight:600;background:var(--gold-l);border-bottom:0}',
    '.kv{display:grid;grid-template-columns:1fr 1fr;gap:0 9mm}.kv div{display:flex;justify-content:space-between;gap:4mm;border-bottom:.2mm solid var(--line);padding:1.8mm 0}',
    '.kv span:first-child{color:var(--muted)}',
    '.hinweis{border-left:.8mm solid var(--gold);background:var(--gold-l);padding:3mm 4mm;margin:4mm 0;font-size:8.4pt}',
    '.zwei{display:grid;grid-template-columns:1fr 1fr;gap:6mm}',
    '.galerie{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:4mm 0}.galerie img{width:100%;height:52mm;object-fit:cover;display:block;border-radius:1mm}',
    '.karte{width:100%;height:auto;display:block;border:.2mm solid var(--line);border-radius:1mm}',
    '.balken{height:2.2mm;background:var(--soft);border-radius:1mm;overflow:hidden}.balken span{display:block;height:100%;background:var(--gold)}',
    /* Energieskala */
    '.ek{margin:3mm 0 1mm}.ek-band{display:grid;grid-template-columns:repeat(9,1fr);gap:.8mm;height:11mm}',
    '.ek-seg{position:relative;display:flex;align-items:center;justify-content:center;clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%,14% 50%);opacity:.38}',
    '.ek-seg:first-child{clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%)}',
    '.ek-seg span{font:600 9.5pt/1 "Space Grotesk",sans-serif;color:#16161A}',
    '.ek-seg.an{opacity:1;transform:scaleY(1.18)}.ek-seg.an span{font-size:11pt}',
    '.ek-skala{display:grid;grid-template-columns:repeat(9,1fr);font:6.8pt "JetBrains Mono",monospace;color:var(--muted);margin-top:1.4mm}',
    '.ek-txt{font-size:8.4pt;margin-top:2mm}',
    'ol.quellen{padding-left:5mm;font-size:8pt;color:var(--muted)}ol.quellen li{margin-bottom:1.6mm}',
    '.lt td,.lt th{padding:1.4mm 2mm}',
    '.umg-raster{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm 6mm}.umg{break-inside:avoid}',
    '.umg b{display:block;font:600 8.6pt/1.3 Inter,sans-serif;border-bottom:.3mm solid var(--ink);padding-bottom:1mm;margin-bottom:1mm}.umg b span{font-weight:400;color:var(--muted)}',
    '.umg ul{list-style:none;margin:0;padding:0;font-size:7.8pt}.umg li{display:flex;justify-content:space-between;gap:2mm;padding:.8mm 0;border-bottom:.2mm solid var(--line)}',
    '.umg li span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.fuehrt{border:.3mm solid var(--ink);border-left:1.6mm solid var(--gold);padding:3.5mm 4.5mm;margin:4mm 0 2mm;break-inside:avoid}',
    '.fuehrt-k{font:7pt/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:1.5mm}',
    '.fuehrt-n{font:600 13pt/1.25 "Space Grotesk",Inter,sans-serif;margin-bottom:1.5mm}.fuehrt p{font-size:8.6pt;margin:0 0 1mm}'
  ].join('\n');

  /* Gold der aktiven Marke (Whitelabel setzt --gold am <html>), sonst bleibt der Rueckfall im :root. */
  function markenGold() {
    try {
      var g = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
      return /^(#[0-9a-f]{3,8}|rgb)/i.test(g) ? ':root{--gold:' + g + '}' : '';
    } catch (e) { return ''; }
  }
  function kopf(d, titel) {
    var l = d.logo && d.logo.b64 ? '<img src="' + d.logo.b64 + '" alt="">' : '<strong>' + esc(d.marke.company || '') + '</strong>';
    return '<div class="kopf">' + l + '<div class="r">' + esc(titel) + '<br>' + esc((d.p.ref && d.p.ref.address) || '') + '</div></div>';
  }
  function fuss(d) {
    var b = d.marke || {};
    var a = [b.company, [b.address, ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(', '), b.phone, b.email].filter(Boolean).join(' · ');
    return '<div class="fuss"><span>' + esc(a) + '</span><span>Marktbericht Profi · Bericht ' + esc(d.id) + '</span></div>';
  }
  function seite(d, titel, innen) { return '<section class="seite">' + kopf(d, titel) + innen + fuss(d) + '</section>'; }

  var OBJART = { haus: 'Ein-/Zweifamilienhaus', efh: 'Einfamilienhaus', zfh: 'Zweifamilienhaus', etw: 'Eigentumswohnung', wohnung: 'Eigentumswohnung',
    mfh: 'Mehrfamilienhaus', gewerbe: 'Gewerbeobjekt', dhh: 'Doppelhaushälfte', rh: 'Reihenhaus' };

  function html(d) {
    var p = d.p, r = p.ref || {}, c = p.cross_check || {};
    var od = (d.obj && d.obj.data) || {};
    var v = verfahren(p);
    var stichtag = (p.wertermittlungsstichtag && typeof p.wertermittlungsstichtag === 'object' ? p.wertermittlungsstichtag.datum : p.wertermittlungsstichtag) || (p.ref && p.ref.wertermittlungsstichtag) || d.erstellt;
    var titelbild = d.fotos[0] || d.karteNah || '';
    var ergebnis = v.fuehrend ? v.fuehrend.wert : null;
    var art = OBJART[String(od.objart || r.property_type || '').toLowerCase()] || OBJART[String(r.property_type || '').toLowerCase()] || (od.objart || r.property_type || 'Immobilie');
    var b = d.marke || {};
    var teile = [];

    /* 1 · Deckblatt */
    teile.push('<section class="seite deck">'
      + '<div class="bild" style="background-image:url(\'' + titelbild + '\')">'
      + (d.logo && d.logo.b64 ? '<div class="logo"><img src="' + d.logo.b64 + '" alt=""></div>' : '') + '</div>'
      + '<div class="inhalt"><div class="eyebrow">Marktbericht Profi · Wertermittlung mit Herleitung</div>'
      + '<h1>' + esc(r.address || '') + '</h1><div class="adr">' + esc(art) + (istZahl(r.build_year) ? ', Baujahr ' + jahr(r.build_year) : '')
      + (istZahl(r.living_area) ? ', ' + zahl(r.living_area, 0) + ' m² Wohnfläche' : '') + (istZahl(r.plot_area) ? ', ' + zahl(r.plot_area, 0) + ' m² Grundstück' : '') + '</div>'
      + '<div class="wertbox"><div><div class="lbl">Marktwert-Indikation' + (v.fuehrend ? ' · ' + esc(v.fuehrend.name) : '') + '</div>'
      + '<div class="wert">' + eur(ergebnis) + '</div></div>'
      + '<div style="font-size:8.6pt;color:var(--muted)">' + (istZahl(r.purchase_price) ? 'Kaufpreis ' + eur(r.purchase_price) + ' · ' : '')
      + (istZahl(ergebnis) && istZahl(r.living_area) ? zahl(Number(ergebnis) / Number(r.living_area), 0) + ' €/m² Wohnfläche' : '') + '</div></div>'
      + '<div class="meta"><div><b>Wertermittlungsstichtag</b>' + esc(datum(stichtag)) + '</div><div><b>Grundlage</b>ImmoWertV 2021</div><div><b>Bericht</b>Nr. ' + esc(d.id) + '</div></div></div>'
      + '<div class="abs"><div><strong>' + esc(b.company || '') + '</strong>' + (b.name && b.name !== b.company ? '<br>' + esc(b.name) : '')
      + '<br>' + esc([b.address, ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(', '))
      + '<br>' + esc([b.phone, b.email].filter(Boolean).join(' · ')) + '</div>'
      + '<div style="text-align:right">Indikative Wertermittlung,<br>kein Gutachten nach § 194 BauGB</div></div></section>');

    /* 2 · Ergebnis */
    var kacheln = v.liste.map(function (x) {
      return '<div class="' + (x.fuehrend ? 'f' : '') + '"><div class="t">' + esc(x.name) + ' · ' + esc(x.recht) + '</div><div class="v">' + eur(x.wert) + '</div>'
        + '<span class="tag' + (x.fuehrend ? ' g' : '') + '">' + (x.fuehrend ? 'führend' : esc(x.tag)) + '</span></div>';
    }).join('');
    teile.push(seite(d, 'Ergebnis', '<div class="eyebrow">Ergebnis</div><h2>Marktwert-Indikation ' + eur(ergebnis) + '</h2>'
      + '<p class="sub">' + esc(v.grund) + (v.grundQuelle ? ' (' + esc(v.grundQuelle) + ')' : '') + '</p>'
      + fuehrendBox(v) + spanneSvg(v.liste, r.purchase_price) + '<div class="verf">' + kacheln + '</div>'
      + (d.md ? '<h3>Einschätzung</h3>' + zusammenfassung(d.md) : '')));

    /* 3 · Objekt */
    var kv = [
      ['Objektart', art], ['Baujahr', jahr(r.build_year)], ['Wohnfläche', istZahl(r.living_area) ? zahl(r.living_area, 0) + ' m²' : '–'],
      ['Grundstück', istZahl(r.plot_area) ? zahl(r.plot_area, 0) + ' m²' : '–'], ['Einheiten', istZahl(r.units) ? zahl(r.units, 0) : '–'],
      ['Zimmer', istZahl(r.rooms) ? zahl(r.rooms, 0) : (istZahl(od.zimmer) ? zahl(od.zimmer, 0) : '–')],
      ['Zustand', r.condition || od.ds2_zustand || '–'], ['Ausstattung', r.quality || '–'],
      ['Modernisierungspunkte', istZahl(r.mod_punkte) ? zahl(r.mod_punkte, 0) + ' (Anlage 2 ImmoWertV)' : 'keine Angabe'],
      ['Garagen / Stellplätze', istZahl(r.garages) ? zahl(r.garages, 0) : (od.garagen || '–')]
    ].map(function (z) { return '<div><span>' + esc(z[0]) + '</span><span>' + esc(z[1]) + '</span></div>'; }).join('');
    var gal = d.fotos.slice(1, 5).map(function (f) { return '<img src="' + f + '" alt="">'; }).join('');
    teile.push(seite(d, 'Objekt', '<div class="eyebrow">Abschnitt 1</div><h2>Das Objekt</h2><p class="sub">Angaben zum Objekt, wie sie dem Bericht zugrunde liegen.</p>'
      + '<div class="kv">' + kv + '</div><h3>Energieeffizienz</h3>' + energieSkala(od.ds2_energie || r.eq_energie, od.endenergie || od.energie_kwh || null)
      + (gal ? '<h3>Ansichten</h3><div class="galerie">' + gal + '</div>' : '')));

    /* 4 · Lage */
    var mk = (p.makro_kennzahlen && p.makro_kennzahlen.werte) || [];
    var makro = mk.slice(0, 8).map(function (w) {
      return '<tr><td>' + esc(w.label) + '</td><td>' + esc(w.gebiet || '') + '</td><td class="r num">'
        + (istZahl(w.wert) ? (w.vorzeichen && Number(w.wert) > 0 ? '+' : '') + zahl(w.wert, istZahl(w.nachkomma) ? w.nachkomma : 1) : '–') + ' ' + esc(w.einheit || '') + '</td><td class="q">' + esc(w.jahr ? 'Stand ' + w.jahr : '') + '</td></tr>';
    }).join('');
    var z = p.zensus || {};
    teile.push(seite(d, 'Lage', '<div class="eyebrow">Abschnitt 2</div><h2>Lage</h2>'
      + '<p class="sub">' + esc([r.ortsteil, r.gemeinde].filter(Boolean).join(', ')) + (p.assessment ? ' · Mikrolage ' + esc(p.assessment.mikrolage || '–') + ', Makrolage ' + esc(p.assessment.makrolage || '–') : '') + '</p>'
      + '<div class="zwei">' + (d.karteNah ? '<img class="karte" src="' + d.karteNah + '" alt="Karte Umgebung">' : '') + (d.karteFern ? '<img class="karte" src="' + d.karteFern + '" alt="Karte Region">' : '') + '</div>'
      + '<h3>Mikrolage' + (p.micro && istZahl(p.micro.score) ? ' · ' + zahl(p.micro.score, 0) + ' von 100' : '') + '</h3>' + mikrolage(p.micro) + umgebung(p.micro)
      + (makro ? '<h3>Region</h3><table><thead><tr><th>Kennzahl</th><th>Gebiet</th><th class="r">Wert</th><th></th></tr></thead><tbody>' + makro + '</tbody></table>' : '')
      + (z.available ? '<p class="det" style="margin-top:3mm">Zensus 2022 (' + esc((z.gemeinde && z.gemeinde.name) || z.kreis_name || '') + '): Leerstandsquote ' + zahl(z.leerstandsquote, 1) + ' %, Eigentümerquote ' + zahl(z.eigentuemerquote, 1) + ' %.</p>' : '')));

    /* 5 · Markt */
    var s = p.sale || {}, m = p.rent || {};
    var markt = '<table><thead><tr><th></th><th class="r">Unteres Quartil</th><th class="r">Median</th><th class="r">Oberes Quartil</th><th class="r">Angebote</th></tr></thead><tbody>'
      + (istZahl(s.median_per_sqm) ? '<tr><td>Kaufpreise €/m²</td><td class="r num">' + zahl(s.q25_per_sqm, 0) + '</td><td class="r num">' + zahl(s.median_per_sqm, 0) + '</td><td class="r num">' + zahl(s.q75_per_sqm, 0) + '</td><td class="r num">' + zahl(s.sample_size, 0) + '</td></tr>' : '')
      + (istZahl(m.median_per_sqm) ? '<tr><td>Mieten €/m²</td><td class="r num">' + zahl(m.q25_per_sqm, 2) + '</td><td class="r num">' + zahl(m.median_per_sqm, 2) + '</td><td class="r num">' + zahl(m.q75_per_sqm, 2) + '</td><td class="r num">' + zahl(m.sample_size, 0) + '</td></tr>' : '')
      + '</tbody></table>';
    var mv = (p.valuation && p.valuation.market_value) || {};
    teile.push(seite(d, 'Markt', '<div class="eyebrow">Abschnitt 3</div><h2>Markt</h2>'
      + '<p class="sub">Aktueller Marktdurchschnitt vergleichbarer Angebote im Umkreis von ' + zahl((s.used_radius_m || 0) / 1000, 0) + ' km. Angebotspreise sind keine Kaufpreise; sie werden um den Angebotsabschlag bereinigt.</p>'
      + markt
      + '<div class="kv" style="margin-top:4mm">'
      + '<div><span>Preisentwicklung</span><span class="num">' + (istZahl(p.price_trend_pct) ? (p.price_trend_pct > 0 ? '+' : '') + zahl(p.price_trend_pct, 1) + ' %' : '–') + '</span></div>'
      + '<div><span>Mietentwicklung</span><span class="num">' + (istZahl(p.rent_trend_pct) ? (p.rent_trend_pct > 0 ? '+' : '') + zahl(p.rent_trend_pct, 1) + ' %' : '–') + '</span></div>'
      + '<div><span>Vermarktungsdauer</span><span class="num">' + (p.market_dynamics && istZahl(p.market_dynamics.days_on_market) ? zahl(p.market_dynamics.days_on_market, 0) + ' Tage' : '–') + '</span></div>'
      + '<div><span>Marktpreisindikation</span><span class="num">' + eur(mv.estimated) + (istZahl(mv.low) ? ' (' + eur(mv.low) + ' – ' + eur(mv.high) + ')' : '') + '</span></div></div>'
      + ((p.valuation && p.valuation.notes || []).length ? '<p class="det" style="margin-top:3mm">' + esc(p.valuation.notes.join(' ')) + '</p>' : '')
      + vergleichsangebote(p)));

    /* 6 · Bodenwert + Sachwert */
    var bw = c.bodenwert || {}, sw = c.sachwert || {}, lv = p.land_value || {};
    var bwRows = (bw.schritte || []).map(function (x) { return { pos: x.pos, detail: x.detail, wert: x.wert }; });
    if (bwRows.length) bwRows.push({ pos: '= Bodenwert', wert: bw.wert, summe: true });
    var bwQ = bwRows.map(function (x, i) {
      return i === 0 ? ('Bodenrichtwert ' + zahl(lv.value_sqm, 0) + ' €/m², ' + (lv.source || '') + (lv.stichtag ? ', Stichtag ' + datum(lv.stichtag) : '') + (lv.license ? ', ' + lv.license : '')) : (i === bwRows.length - 1 ? '§ 40 ImmoWertV' : '');
    });
    var swQ = (sw.staffel || []).map(function (x) {
      var t = String(x.pos || '');
      if (/Normalherstellungskosten/.test(t)) return 'NHK 2010, Anlage 4 ImmoWertV';
      if (/Baupreisindex/.test(t)) return (sw.baupreisindex && sw.baupreisindex.text) || 'Statistisches Bundesamt';
      if (/Alterswertminderung/.test(t)) return '§ 38 ImmoWertV, RND ' + zahl(sw.restnutzungsdauer_jahre, 0) + '/' + zahl(sw.gesamtnutzungsdauer_jahre, 0) + ' J.';
      if (/Sachwertfaktor/.test(t)) return sw.sachwertfaktor ? (sw.sachwertfaktor.quelle || '') + ' · Stufe ' + (sw.sachwertfaktor.stufe || '') : '';
      if (/Garage/.test(t)) return 'NHK 2010, Garagen';
      if (/marktangepasst/.test(t)) return '§ 39 ImmoWertV';
      return '';
    });
    if (bwRows.length || istZahl(sw.value_eur)) {
      teile.push(seite(d, 'Bodenwert und Sachwert', '<div class="eyebrow">Abschnitt 4</div><h2>Bodenwert und Sachwert</h2><p class="sub">Zeile für Zeile, mit der Fundstelle jeder Zahl.</p>'
        + (bwRows.length ? '<h3>Bodenwert</h3>' + staffelTabelle(bwRows, bwQ) : '')
        + (istZahl(sw.value_eur) ? '<h3>Sachwert</h3>' + staffelTabelle(sw.staffel, swQ)
          + (sw.restnutzungsdauer_herkunft && sw.restnutzungsdauer_herkunft.hinweis ? '<p class="det">' + esc(sw.restnutzungsdauer_herkunft.hinweis) + '</p>' : '')
          + (sw.sachwertfaktor ? '<div class="hinweis">Sachwertfaktor: ' + esc(sw.sachwertfaktor_ausschuss || 'zuständiger Gutachterausschuss') + '. Er ist nach demselben Modell abgeleitet, in dem hier gerechnet wird (NHK 2010, lineare Alterswertminderung, § 10 ImmoWertV).</div>'
            : '<div class="hinweis">Für diesen Ort liegt kein Sachwertfaktor vor. Ausgewiesen ist der vorläufige Sachwert ohne Marktanpassung; er ist eine Herstellungskostenrechnung, kein Marktwert.</div>') : '')));
    }

    /* 7 · Vergleichswert */
    var irw = c.vergleichswert_irw || {}, rvf = c.register_vergleichsfaktor || {};
    if (irw.verfuegbar && Array.isArray(irw.rechenweg)) {
      var irwRows = irw.rechenweg.map(function (x) { return { pos: x.pos, detail: x.detail, wert: x.einheit === '€' ? x.wert : null, faktor: x.faktor }; });
      var irwT = '<table class="rt"><thead><tr><th>Position</th><th>Merkmal</th><th class="r">Faktor / Wert</th></tr></thead><tbody>'
        + irw.rechenweg.map(function (x, i) {
          var ende = i === irw.rechenweg.length - 1;
          var w = istZahl(x.faktor) ? zahl(x.faktor, 3) : (istZahl(x.wert) ? (x.einheit === '€/m²' ? zahl(x.wert, 2) + ' €/m²' : eur(x.wert)) : (istZahl(x.zuschlag_prozent) ? zahl(x.zuschlag_prozent, 1) + ' %' : ''));
          return '<tr class="' + (ende ? 'ende' : /^=/.test(x.pos) ? 'summe' : '') + '"><td>' + esc(x.pos) + '</td><td class="q">' + esc(x.detail || '') + '</td><td class="r num">' + w + '</td></tr>';
        }).join('') + '</tbody></table>';
      teile.push(seite(d, 'Vergleichswert', '<div class="eyebrow">Abschnitt 5</div><h2>Vergleichswert</h2><p class="sub">Immobilienrichtwert des Gutachterausschusses, umgerechnet nach seinen Koeffizienten.</p>'
        + irwT + (irw.hinweise || []).map(function (h) { return '<p class="det">' + esc(h) + '</p>'; }).join('')
        + (irw.quellennachweis ? '<p class="det">' + esc(irw.quellennachweis) + '</p>' : '')));
      void irwRows;
    } else if (rvf.verfuegbar && rvf.rechenweg) {
      teile.push(seite(d, 'Vergleichswert', '<div class="eyebrow">Abschnitt 5</div><h2>Vergleichswert</h2><p>' + esc(rvf.rechenweg) + '</p><p class="det">' + esc(rvf.quelle || rvf.hinweis || '') + '</p>'));
    }

    /* 8 · Ertragswert */
    var ew = c.ertragswert || {};
    if (istZahl(ew.value_eur) && Array.isArray(ew.staffel)) {
      var ewQ = ew.staffel.map(function (x) {
        var t = String(x.pos || '');
        if (/^Rohertrag/.test(t)) return 'marktüblich erzielbar' + (istZahl(ew.miete_qm) ? ', ' + zahl(ew.miete_qm, 2) + ' €/m²' : '');
        if (/Bewirtschaftungskosten \(/.test(t)) return 'Anlage 3 ImmoWertV bzw. Modell des Ausschusses';
        if (/Bodenwertverzinsung/.test(t)) return 'Liegenschaftszins ' + zahl(ew.liegenschaftszins_pct, 2) + ' %, Stufe ' + (ew.liegenschaftszins_stufe || '–');
        if (/Barwertfaktor/.test(t)) return '§ 34 ImmoWertV, RND ' + zahl(ew.restnutzungsdauer_jahre, 1) + ' J.';
        if (/Ertragswert$|vorläufiger Ertragswert/.test(t)) return '§ 28 ImmoWertV';
        return '';
      });
      teile.push(seite(d, 'Ertragswert', '<div class="eyebrow">Abschnitt 6</div><h2>Ertragswert</h2><p class="sub">Allgemeines Ertragswertverfahren. Liegenschaftszins: ' + esc(ew.liegenschaftszins_quelle || '–') + '.</p>'
        + staffelTabelle(ew.staffel, ewQ)));
    }

    /* 9 · Erbbaurecht */
    var eb = p.erbbaurecht;
    if (eb && eb.ok) {
      teile.push(seite(d, 'Erbbaurecht', '<div class="eyebrow">Abschnitt 7</div><h2>Erbbaurecht</h2>'
        + '<div class="kv"><div><span>Wert bei Volleigentum</span><span class="num">' + eur((eb.teile && eb.teile.gebaeudeanteil || 0) + (eb.teile && eb.teile.bodenwert || 0)) + '</span></div>'
        + '<div><span>Abschlag nach § 50 ImmoWertV</span><span class="num">' + eur(eb.abschlag) + ' (' + zahl(eb.abschlagPct, 1) + ' %)</span></div>'
        + '<div><span>Erbbauzins vertraglich</span><span class="num">' + eur(eb.teile && eb.teile.zinsVertragEur) + ' / Jahr</span></div>'
        + '<div><span>Erbbauzins angemessen</span><span class="num">' + eur(eb.teile && eb.teile.zinsAngemessenEur) + ' / Jahr (' + zahl(eb.annahmen && eb.annahmen.zinssatzAngemessen, 1) + ' %)</span></div>'
        + '<div><span>Restlaufzeit</span><span class="num">' + zahl(eb.annahmen && eb.annahmen.restlaufzeit, 0) + ' Jahre</span></div>'
        + '<div><span>Erbbaurechtswert</span><span class="num"><b>' + eur(eb.erbbaurechtswert) + '</b></span></div></div>'
        + (eb.hinweise || []).map(function (h) { return '<p class="det">' + esc(h) + '</p>'; }).join('')
        + '<p class="det">' + esc(eb.annahmen && eb.annahmen.quelle || '') + '</p>'));
    }

    /* 10 · Quellen */
    var q = [];
    if (lv.source) q.push('Bodenrichtwert: ' + lv.source + (lv.stichtag ? ', Stichtag ' + datum(lv.stichtag) : '') + (lv.quellenvermerk ? ' — ' + lv.quellenvermerk : (lv.license ? ', ' + lv.license : '')));
    (c.quellen_nachweis || []).forEach(function (x) { q.push((x.kennzahlen ? x.kennzahlen.join(', ') + ': ' : '') + (x.vermerk || '') + (x.url ? ' (' + x.url + ')' : '')); });
    if (sw.sachwertfaktor && sw.sachwertfaktor.quelle) q.push('Sachwertfaktor: ' + sw.sachwertfaktor.quelle);
    if (irw.quellennachweis) q.push('Immobilienrichtwert: ' + irw.quellennachweis);
    var mq = p.makro_kennzahlen && p.makro_kennzahlen.quellennachweis;
    if (mq) q.push('Regionaldaten: ' + (typeof mq === 'object' ? [mq.vermerk, mq.lizenz].filter(Boolean).join(' · ') : mq));
    if (z.available) q.push('Zensus 2022: Statistische Ämter des Bundes und der Länder' + (z.license ? ', ' + z.license : ''));
    q.push('Normalherstellungskosten: Anlage 4 ImmoWertV (NHK 2010). Baupreisindex: Statistisches Bundesamt.');
    q.push('Angebotsdaten: aktueller Marktdurchschnitt vergleichbarer Angebote.');
    var uniq = q.filter(function (x, i) { return x && q.indexOf(x) === i; });
    teile.push(seite(d, 'Quellen', '<div class="eyebrow">Anhang</div><h2>Quellen und Grundlagen</h2>'
      + '<ol class="quellen">' + uniq.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>'
      + ((c.notes || []).length ? '<h3>Hinweise zur Rechnung</h3>' + c.notes.map(function (n) { return '<p class="det" style="font-size:7.8pt">' + esc(n) + '</p>'; }).join('') : '')
      + '<h3>Zu diesem Bericht</h3><p>Die Wertermittlung folgt der Immobilienwertermittlungsverordnung 2021. Sie ist indikativ und ersetzt kein Verkehrswertgutachten nach § 194 BauGB. Grundlage sind die Angaben zum Objekt; eine Besichtigung hat nicht stattgefunden. Jede Zahl stammt aus einer genannten Quelle oder ist als Annahme gekennzeichnet.</p>'
      + '<p class="det">Erstellt am ' + esc(datum(d.erstellt || new Date())) + ' mit DealPilot · Fassung ' + VERSION + '</p>'));

    var fonts = (location && location.origin ? location.origin : '') + '/fonts/dp-fonts.css';
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Marktbericht Profi · ' + esc(r.address || '') + '</title>'
      + '<link rel="stylesheet" href="' + fonts + '"><style>' + CSS + markenGold() + '</style></head><body>' + teile.join('') + '</body></html>';
  }

  /* ── in der App: Vorschau mit Druckknopf ──────────────────────────── */
  function vorschau(doc, titel) {
    var alt = document.getElementById('dp-profi-vorschau'); if (alt) alt.remove();
    var w = document.createElement('div');
    w.id = 'dp-profi-vorschau';
    w.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(5,5,5,.72);display:flex;flex-direction:column';
    w.innerHTML = '<div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:10px 16px;background:#0B0B0D;color:#fff;font:13px Inter,sans-serif">'
      + '<span style="margin-right:auto">' + esc(titel) + '</span>'
      + '<button type="button" data-a="druck" style="background:var(--wl-c9a84c,#C9A84C);color:#0a0a0a;border:0;border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer">Drucken / als PDF speichern</button>'
      + '<button type="button" data-a="zu" style="background:transparent;color:#fff;border:1px solid #444;border-radius:999px;padding:8px 14px;cursor:pointer">Schließen</button></div>'
      + '<iframe title="Marktbericht Profi" style="flex:1;border:0;background:#E9E7E1"></iframe>';
    document.body.appendChild(w);
    var f = w.querySelector('iframe');
    f.srcdoc = doc.replace('</style>', 'body{background:#E9E7E1}.seite{background:#fff;margin:8mm auto;box-shadow:0 2px 14px rgba(0,0,0,.18)}@media print{body{background:#fff}.seite{margin:0;box-shadow:none}}</style>');
    w.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'zu') w.remove();
      if (a === 'druck') { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) {} }
    });
  }
  function oeffnen(objKey, reportId) {
    /* Mit Bericht-Nummer, aber ohne Objekt: KEIN Rueckgriff auf das offene Objekt - dessen Fotos gehoerten
       sonst in einen fremden Bericht. Dann eben ohne Fotos. */
    var key = objKey || (reportId ? null : window._currentObjKey);
    if (!key && !reportId) { alertlos('Bitte zuerst ein Objekt öffnen.'); return Promise.resolve(); }
    if (typeof window.toast === 'function') window.toast('Marktbericht Profi wird zusammengestellt …');
    return sammeln(key, reportId).then(function (d) { vorschau(html(d), 'Marktbericht Profi · ' + ((d.p.ref && d.p.ref.address) || '')); })
      .catch(function (e) { alertlos(e && e.message ? e.message : 'Der Marktbericht Profi ließ sich nicht erstellen.'); });
  }
  function alertlos(t) {
    if (typeof window.toast === 'function') window.toast(t);
    else try { console.warn('[profi] ' + t); } catch (e) {}
  }

  window.DpProfi = {
    VERSION: VERSION,
    oeffnen: oeffnen,
    /** Für den PDF-Dienst: fertiges HTML-Dokument (String). */
    dokument: function (objKey, reportId) { return sammeln(objKey, reportId).then(html); },
    berichtFuer: berichtFuer,
    _html: html, _energieSkala: energieSkala, _verfahren: verfahren
  };
})();
