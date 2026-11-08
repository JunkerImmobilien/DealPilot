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
  var VERSION = 'v3219';

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
    if (istZahl(mv.estimated)) liste.push({ id: 'angebote', name: 'Marktpreisindikation aus Angeboten', wert: mv.estimated, recht: 'bereinigt um den Angebotsabschlag', tag: (p.sale && p.sale.sample_size ? p.sale.sample_size + ' Angebote' : 'Angebote'), voll: true, low: mv.low, high: mv.high,
      abschlag: mv.angebot_abschlag || null });

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
      var it = g[k].items.slice(0, 4).map(function (x) {
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

  /* ── v3178c · Was der normale Bericht hat und die Profi-Fassung noch nicht ──────── */
  /* Ausfuehrlicher Text: KI-Abschnitte B-D (A steht schon als Einschaetzung) */
  function mdInline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function ausfuehrlich(md) {
    if (!md) return '';
    var teile = String(md).replace(/\r/g, '').split(/\n(?=#\s)/).slice(1);
    if (!teile.length) return '';
    return teile.map(function (blk) {
      var zeilen = blk.split('\n'), kopf = zeilen.shift().replace(/^#+\s*/, '').replace(/^[A-Z]\)\s*/, '');
      var html = '', liste = [];
      var flush = function () { if (liste.length) { html += '<ul class="md">' + liste.map(function (l) { return '<li>' + mdInline(l) + '</li>'; }).join('') + '</ul>'; liste = []; } };
      var abs = [];
      var absFlush = function () { if (abs.length) { html += '<p>' + mdInline(abs.join(' ')) + '</p>'; abs = []; } };
      zeilen.forEach(function (z) {
        var t = z.trim();
        if (!t) { absFlush(); flush(); return; }
        if (/^#{2,}\s/.test(t)) { absFlush(); flush(); html += '<h4>' + mdInline(t.replace(/^#+\s*/, '')) + '</h4>'; return; }
        if (/^[-*•]\s+/.test(t)) { absFlush(); liste.push(t.replace(/^[-*•]\s+/, '')); return; }
        flush(); abs.push(t);
      });
      absFlush(); flush();
      return '<div class="md-blk"><h3>' + esc(kopf) + '</h3>' + html + '</div>';
    }).join('');
  }
  /* Bewertung & Potenzial (assessment) wie im normalen Bericht */
  var BEW = [['mikrolage', 'Mikrolage'], ['makrolage', 'Makrolage'], ['nachfrage', 'Nachfrage'], ['entwicklung', 'Entwicklung'],
    ['bevoelkerung', 'Bevölkerung'], ['wertsteigerung', 'Wertsteigerungspotenzial'], ['mietentwicklung', 'Mietentwicklung'], ['mietausfallrisiko', 'Mietausfallrisiko']];
  function bewertung(a) {
    if (!a) return '';
    var z = BEW.filter(function (b) { return a[b[0]]; }).map(function (b) {
      return '<div><span>' + esc(b[1]) + '</span><b>' + esc(String(a[b[0]]).charAt(0).toUpperCase() + String(a[b[0]]).slice(1)) + '</b></div>';
    }).join('');
    return z ? '<h3>Bewertung &amp; Potenzial</h3><div class="bew">' + z + '</div>' : '';
  }
  /* Marktentwicklung: Median je Jahr, Kaufpreis und Miete je m² (SVG, massstaeblich) */
  function verlauf(reihe, titel, nk) {
    var r = (reihe || []).filter(function (x) { return istZahl(x.median) && istZahl(x.year); });
    if (r.length < 2) return '';
    var W = 300, H = 120, L = 34, R = 10, T = 14, B = 22;
    var min = Math.min.apply(null, r.map(function (x) { return x.median; })), max = Math.max.apply(null, r.map(function (x) { return x.median; }));
    var pad = (max - min) * 0.15 || max * 0.05; min = Math.max(0, min - pad); max += pad;
    var x0 = r[0].year, x1 = r[r.length - 1].year;
    var X = function (y) { return L + (y - x0) / Math.max(1, (x1 - x0)) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - min) / (max - min)) * (H - T - B); };
    var pfad = r.map(function (x, i) { return (i ? 'L' : 'M') + X(x.year).toFixed(1) + ' ' + Y(x.median).toFixed(1); }).join(' ');
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="vl" role="img" aria-label="' + esc(titel) + '">';
    [min, (min + max) / 2, max].forEach(function (v) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="g"/>'
        + '<text x="' + (L - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end" class="a">' + zahl(v, nk) + '</text>';
    });
    s += '<path d="' + pfad + '" class="l"/>';
    r.forEach(function (x, i) {
      s += '<circle cx="' + X(x.year).toFixed(1) + '" cy="' + Y(x.median).toFixed(1) + '" r="' + (i === r.length - 1 ? 3.2 : 2.2) + '" class="' + (i === r.length - 1 ? 'pe' : 'p') + '"/>'
        + '<text x="' + X(x.year).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="a">' + x.year + '</text>';
    });
    var e = r[r.length - 1], a0 = r[0];
    var veraend = a0.median > 0 ? (e.median / a0.median - 1) * 100 : null;
    return '<div class="vl-box"><div class="vl-t">' + esc(titel) + ' <span class="num">' + zahl(e.median, nk) + '</span>'
      + (veraend != null ? ' <span class="det">(' + (veraend > 0 ? '+' : '') + zahl(veraend, 0) + ' % seit ' + a0.year + ')</span>' : '') + '</div>' + s + '</svg></div>';
  }
  function marktentwicklung(h) {
    if (!h) return '';
    var a = verlauf(h.price, 'Angebotspreise €/m² (Median)', 0), b = verlauf(h.rent, 'Angebotsmieten €/m² (Median)', 2);
    return (a || b) ? '<div class="block"><h3>Marktentwicklung</h3><div class="zwei">' + a + b + '</div></div>' : '';
  }
  /* Rendite-Kennzahlen (valuation.yield) */
  function kennzahlen(p, r) {
    var y = (p.valuation && p.valuation.yield) || {};
    var z = [];
    if (istZahl(r.purchase_price)) z.push(['Kaufpreis', eur(r.purchase_price) + (istZahl(r.living_area) && r.living_area > 0 ? ' · ' + zahl(r.purchase_price / r.living_area, 0) + ' €/m²' : '')]);
    if (istZahl(y.annual_net_rent)) z.push(['Jahresnettokaltmiete', eur(y.annual_net_rent)]);
    if (istZahl(y.gross_yield_pct)) z.push(['Bruttorendite', zahl(y.gross_yield_pct, 1) + ' %']);
    if (istZahl(y.rent_multiplier)) z.push(['Kaufpreisfaktor', zahl(y.rent_multiplier, 1) + '-fach']);
    return z.length ? '<div class="block"><h3>Kennzahlen</h3><div class="kv">' + z.map(function (k) { return '<div><span>' + esc(k[0]) + '</span><span class="num">' + k[1] + '</span></div>'; }).join('') + '</div></div>' : '';
  }
  /* Sachwertfaktor: wo der Wert zu bekommen ist (wenn er fehlt oder zur Quelle) */
  function swfWeg(sw) {
    var l = sw && sw.sachwertfaktor_quelle_link;
    /* v3207 · satz ist ein Objekt {text, warum_kein_wert, kosten, hinweis} wie in der
       Marktbericht-App (quelleBlock) - hier stand esc(l.satz) und druckte „[object Object]"
       (Bericht 552). Ohne Sachwert gehoert der Kasten nicht auf die Seite. */
    if (!l || !l.satz || !istZahl(sw.value_eur)) return '';
    var s = typeof l.satz === 'string' ? { text: l.satz } : l.satz;
    var t = [s.text, s.warum_kein_wert, s.kosten].filter(Boolean).join(' ');
    if (!t) return '';
    return '<div class="hinweis"><b>Sachwertfaktor – Quelle:</b> ' + esc(t) + (l.url ? ' <span class="det">' + esc(l.url) + '</span>' : '')
      + (s.hinweis ? '<br><span class="det">' + esc(s.hinweis) + '</span>' : '') + '</div>';
  }

  /* ── v3177 · Führendes Verfahren, deutlich und begründet ──────────── */
  var VERF_NAME = { sachwert: 'Sachwertverfahren', vergleichswert: 'Vergleichswertverfahren', ertragswert: 'Ertragswertverfahren', angebote: 'Marktpreisindikation aus Angeboten' };
  /* v3212 · Wertspanne als Band (Variante D): Marken je Verfahren, fuehrendes Gold, Kaufpreis schwarz;
     Beschriftung abwechselnd oben/unten, damit nahe Werte sich nicht ueberdecken. */
  function spanneBand(liste, kp) {
    var m = liste.map(function (x) { return { t: x.name.replace(/ \(.*\)$/, '').replace(/^Marktpreisindikation aus Angeboten$/, 'Angebote'), w: Number(x.wert), f: !!x.fuehrend }; })
      .filter(function (x) { return isFinite(x.w) && x.w > 0; });
    if (istZahl(kp)) m.push({ t: 'Kaufpreis', w: Number(kp), k: true });
    if (m.length < 2) return '';
    var lo = Math.min.apply(null, m.map(function (x) { return x.w; })), hi = Math.max.apply(null, m.map(function (x) { return x.w; }));
    var pad = (hi - lo) * 0.15 || hi * 0.05, a = lo - pad, z = hi + pad;
    var pos = function (w) { return ((w - a) / (z - a) * 100).toFixed(2); };
    var vw = m.filter(function (x) { return !x.k; }).map(function (x) { return x.w; });
    var vLo = Math.min.apply(null, vw), vHi = Math.max.apply(null, vw);
    var h = '<div class="sp"><div class="sb"></div>' + (vw.length > 1 ? '<div class="sband" style="left:' + pos(vLo) + '%;width:' + (pos(vHi) - pos(vLo)).toFixed(2) + '%"></div>' : '');
    m.sort(function (x, y) { return x.w - y.w; }).forEach(function (x, i) {
      var farbe = x.k ? '#050505' : x.f ? 'var(--gold)' : '#8a8478';
      h += '<div class="sm" style="left:' + pos(x.w) + '%;background:' + farbe + '"></div><div class="st' + (i % 2 ? ' u' : '') + '" style="left:' + pos(x.w) + '%">' + esc(x.t) + '<br><b>' + zahl(Math.round(x.w / 1000), 0) + ' T€</b></div>';
    });
    return h + '</div><div class="spl"><span>' + zahl(Math.round(a / 1000), 0) + ' T€</span><span>Spanne der Verfahren ' + zahl(Math.round(vLo / 1000), 0) + '–' + zahl(Math.round(vHi / 1000), 0) + ' T€'
      + (vLo > 0 && vw.length > 1 ? ' (' + zahl((vHi / vLo - 1) * 100, 1) + ' % auseinander)' : '') + '</span><span>' + zahl(Math.round(z / 1000), 0) + ' T€</span></div>';
  }
  /* v3212 · die Verfahren als Balken, senkrechter Strich = Marktwert-Indikation (fuehrendes Verfahren) */
  function verfahrenBalken(v, wfl) {
    if (!v.liste.length) return '';
    var max = Math.max.apply(null, v.liste.map(function (x) { return Number(x.wert) || 0; })) * 1.08;
    var mw = v.fuehrend ? Number(v.fuehrend.wert) : null;
    var h = v.liste.map(function (x) {
      var w = Number(x.wert) || 0, zus = '';
      if (x.id === 'angebote') {
        if (istZahl(x.low) && istZahl(x.high)) zus += 'Spanne ' + eur(x.low) + ' – ' + eur(x.high) + '. ';
        if (x.abschlag && istZahl(x.abschlag.pct)) zus += 'Angebotsabschlag ' + zahl(x.abschlag.pct, 1) + ' %' + (x.abschlag.roh && istZahl(x.abschlag.roh.estimated) ? ' auf ' + eur(x.abschlag.roh.estimated) : '') + '.';
      }
      return '<div class="vb"><div class="vn">' + esc(x.name) + '<i>' + (x.fuehrend ? 'führend · ' : '') + esc(x.recht) + ' · ' + esc(x.tag) + '</i></div>'
        + '<div class="vt"><div class="vf' + (x.fuehrend ? ' g' : '') + '" style="width:' + (w / max * 100).toFixed(1) + '%"></div>'
        + (mw ? '<div class="vm" style="left:' + (mw / max * 100).toFixed(1) + '%"></div>' : '') + '</div>'
        + '<div class="vw">' + eur(w) + (wfl ? '<small>' + zahl(w / wfl, 0) + ' €/m²</small>' : '') + '</div></div>'
        + (zus ? '<p class="det" style="margin:-1mm 0 2mm 49mm">' + esc(zus.trim()) + '</p>' : '');
    }).join('');
    return h + (mw ? '<p class="det">Senkrechter Strich: Marktwert-Indikation ' + eur(mw) + '.</p>' : '');
  }
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
  /* v3210 · Bodenrichtwertzonen ueber die Nahkarte (bundesweiter BORIS-D-WMS, derselbe wie in der
     Web-Ansicht v3209). Der Dienst antwortet mit CORS, also holt der Browser das Bild selbst und
     malt es auf die Geoapify-Karte. ZONEN_KACHEL ist die Kachelgroesse, in der Geoapify den Zoom
     rechnet: 512 (gemessen 07.11. an Minden, 256 traf die Strassen nicht). Faellt der Dienst aus, bleibt die Karte ohne Zonen -
     nie ohne Karte. In BY und SH liefert der Dienst nichts, dann bleibt das Bild ohne Flaechen. */
  var BRW_WMS = 'https://www.wms.nrw.de/boris/wms_de_bodenrichtwerte';
  var BRW_LAYER = 'brw_wohnbauflaeche,brw_gemischte_bauweise,brw_gewerbliche_bauweise,brw_sonderbauflaeche';
  var BRW_VERMERK = 'Bodenrichtwertzonen \u00a9 Gutachteraussch\u00fcsse f\u00fcr Grundst\u00fcckswerte, dl-de/by-2-0 (bodenrichtwerte-boris.de)';
  var ZONEN_KACHEL = 512;
  function zonenBbox(lat, lon, zoom, w, h) {
    var R = 6378137, x = R * lon * Math.PI / 180, y = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    var res = 2 * Math.PI * R / (ZONEN_KACHEL * Math.pow(2, zoom));
    return [x - w / 2 * res, y - h / 2 * res, x + w / 2 * res, y + h / 2 * res];
  }
  function bildLaden(src) {
    return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; });
  }
  function mitZonen(basis, lat, lon, zoom, w, h) {
    if (!basis || !istZahl(lat) || !istZahl(lon)) return Promise.resolve(basis);
    var b = zonenBbox(Number(lat), Number(lon), zoom, w, h);
    var url = BRW_WMS + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&STYLES=&CRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=true'
      + '&LAYERS=' + BRW_LAYER + '&WIDTH=' + w + '&HEIGHT=' + h + '&BBOX=' + b.map(function (v) { return v.toFixed(2); }).join(',');
    var zeit = new Promise(function (ok) { setTimeout(function () { ok(null); }, 15000); });
    var holen = fetch(url).then(function (r) { return r.ok && /image\/png/.test(r.headers.get('content-type') || '') ? r.blob() : null; })
      .then(function (bl) { return bl ? alsDataUrl(bl) : null; }).catch(function () { return null; });
    return Promise.race([holen, zeit]).then(function (zonen) {
      if (!zonen) return basis;
      return Promise.all([bildLaden(basis), bildLaden(zonen)]).then(function (im) {
        if (!im[0] || !im[1]) return basis;
        try {
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var g = c.getContext('2d');
          g.drawImage(im[0], 0, 0, w, h);
          g.globalAlpha = 0.85; g.drawImage(im[1], 0, 0, w, h); g.globalAlpha = 1;
          g.font = '15px Inter, Arial, sans-serif';
          var tw = g.measureText(BRW_VERMERK).width;
          g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, h - 24, tw + 16, 24);
          g.fillStyle = '#333'; g.fillText(BRW_VERMERK, 8, h - 7);
          return c.toDataURL('image/jpeg', 0.9);
        } catch (e) { return basis; }
      });
    });
  }
  /* v3212 · Bodenrichtwerte im Kartenausschnitt (Marcel 08.11.2026: "die Bodenrichtwert-Bereiche
     auch angeben"). GetFeatureInfo desselben WMS an 15 Punkten (5 x 3) der Nahkarte, die Mitte ist das
     Objekt. Je Zone der juengste Stichtag. Eine Stichprobe: sehr kleine Zonen zwischen den Punkten
     koennen fehlen - der Bericht sagt das. */
  var BRW_NUTZUNG = { brw_wohnbauflaeche: 'Wohnbaufläche', brw_gemischte_bauweise: 'gemischte Baufläche',
    brw_gewerbliche_bauweise: 'gewerbliche Baufläche', brw_sonderbauflaeche: 'Sonderbaufläche' };
  function zonenListe(lat, lon, zoom, w, h) {
    if (!istZahl(lat) || !istZahl(lon)) return Promise.resolve(null);
    var b = zonenBbox(Number(lat), Number(lon), zoom, w, h);
    var res = (b[2] - b[0]) / w * Math.cos(Number(lat) * Math.PI / 180);   /* Meter je Pixel am Boden */
    var punkte = [];
    [0.17, 0.5, 0.83].forEach(function (fy) { [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (fx) { punkte.push([Math.round(w * fx), Math.round(h * fy)]); }); });
    var basis = BRW_WMS + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&STYLES=&CRS=EPSG:3857&INFO_FORMAT=application/geo%2Bjson&FEATURE_COUNT=10'
      + '&LAYERS=' + BRW_LAYER + '&QUERY_LAYERS=' + BRW_LAYER + '&WIDTH=' + w + '&HEIGHT=' + h + '&BBOX=' + b.map(function (v) { return v.toFixed(2); }).join(',');
    var zonen = {};
    var abfragen = punkte.map(function (pt) {
      return fetch(basis + '&I=' + pt[0] + '&J=' + pt[1]).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var dist = Math.round(Math.sqrt(Math.pow(pt[0] - w / 2, 2) + Math.pow(pt[1] - h / 2, 2)) * res);
        ((j && j.features) || []).forEach(function (f) {
          var q = f.properties || {}, wert = parseFloat(String(q.Bodenrichtwert || '').replace(',', '.'));
          if (!isFinite(wert)) return;
          var key = (q.Gutachterausschussnummer || '') + '|' + (q.BodenrichtwertNummer || '') + '|' + (f.layerName || '');
          var alt = zonen[key];
          var neu = { wert: wert, stichtag: q.Stichtag || '', nr: q.BodenrichtwertNummer || '', ort: q.ortsteilName || q.Gemeindename || '',
            nutzung: BRW_NUTZUNG[f.layerName] || 'Bodenrichtwertzone', gfz: q.Geschossflaechenzahl || q['wertrelevante Geschossflaechenzahl'] || '',
            ausschuss: q.Gutachterausschussname || '', dist: dist, objekt: dist === 0 };
          if (!alt) { zonen[key] = neu; return; }
          if (neu.stichtag > alt.stichtag) { neu.dist = Math.min(neu.dist, alt.dist); neu.objekt = neu.objekt || alt.objekt; zonen[key] = neu; }
          else { alt.dist = Math.min(alt.dist, dist); alt.objekt = alt.objekt || dist === 0; }
        });
      }).catch(function () {});
    });
    var zeit = new Promise(function (ok) { setTimeout(ok, 15000); });
    return Promise.race([Promise.all(abfragen), zeit]).then(function () {
      var l = Object.keys(zonen).map(function (k) { return zonen[k]; });
      l.sort(function (x, y) { return (y.objekt - x.objekt) || (x.dist - y.dist); });
      return l.length ? { liste: l, punkte: punkte.length } : null;
    });
  }
  function zonenTabelle(z) {
    if (!z || !z.liste || !z.liste.length) return '';
    var l = z.liste.slice(0, 10), werte = z.liste.map(function (x) { return x.wert; });
    var lo = Math.min.apply(null, werte), hi = Math.max.apply(null, werte);
    var obj = z.liste.filter(function (x) { return x.objekt; })[0];
    var st = z.liste.map(function (x) { return x.stichtag; }).sort().pop();
    return '<div class="block"><h3>Bodenrichtwerte im Kartenausschnitt</h3><p class="det" style="margin:0 0 2mm">'
      + (obj ? 'Das Objekt liegt in einer Zone mit ' + zahl(obj.wert, 0) + ' €/m² (' + esc(obj.nutzung) + '). ' : '')
      + 'Im Ausschnitt der Nahkarte ' + (lo === hi ? zahl(lo, 0) + ' €/m²' : zahl(lo, 0) + ' bis ' + zahl(hi, 0) + ' €/m²') + ' in ' + z.liste.length + ' Zone' + (z.liste.length === 1 ? '' : 'n')
      + (st ? ', Stichtag ' + esc(datum(st)) : '') + '.</p>'
      + '<table class="lt"><thead><tr><th>Zone</th><th>Nutzung</th><th class="r">€/m²</th><th class="r">Stichtag</th><th class="r">Entfernung</th></tr></thead><tbody>'
      + l.map(function (x) {
        return '<tr' + (x.objekt ? ' class="ende"' : '') + '><td>' + (x.objekt ? 'Lage des Objekts' : 'Zone ' + esc(x.nr)) + (x.ort && !x.objekt ? ' · ' + esc(x.ort) : '') + '</td><td>' + esc(x.nutzung) + (x.gfz ? ', GFZ ' + esc(x.gfz) : '') + '</td>'
          + '<td class="r num">' + zahl(x.wert, 0) + '</td><td class="r num">' + esc(datum(x.stichtag)) + '</td><td class="r num">' + (x.objekt ? '–' : 'ca. ' + zahl(Math.round(x.dist / 10) * 10, 0) + ' m') + '</td></tr>';
      }).join('') + '</tbody></table>'
      + '<p class="det">Abgefragt an ' + z.punkte + ' Punkten der Nahkarte; sehr kleine Zonen dazwischen können fehlen. Entfernung bis zum nächsten abgefragten Punkt der Zone. '
      + (z.liste.length > l.length ? 'Gezeigt die ' + l.length + ' nächsten von ' + z.liste.length + ' Zonen. ' : '') + esc(BRW_VERMERK.replace(/^Bodenrichtwertzonen /, 'Quelle: ')) + '.</p></div>';
  }
  /* v3219 · Seiten einpassen (Marcel 08.11.2026: "zwei oder drei Zeilen auf ein neues Blatt und der Rest ist
     leer"; "die ausfuehrliche Einschaetzung maximal eine Seite"). Gemessen wird jeder Abschnitt in mm gegen die
     Druckhoehe einer Seite (297 - 13 - 17 mm Rand). Laeuft ein Abschnitt nur um ein kurzes Stueck auf eine neue
     Seite, wird er bis 88 % verkleinert (zoom). Die ausfuehrliche Einschaetzung wird auf eine Seite gebracht:
     erst kleiner, dann von hinten gekuerzt, mit Hinweis. window.__dpFertig sagt dem PDF-Dienst, wann es fertig ist. */
  var EINPASSEN = '(' + function () {
    var MM = 96 / 25.4, SEITE = 262;
    function hoehe(s) { var f = s.querySelector('.fuss'), h = s.getBoundingClientRect().height; if (f) h -= f.getBoundingClientRect().height + 8 * MM; return h / MM; }
    function pass(s, ziel) { return hoehe(s) <= ziel * SEITE; }
    function lauf() {
      [].forEach.call(document.querySelectorAll('section.seite'), function (s) {
        if (s.classList.contains('deck')) return;
        var ausf = !!s.querySelector('.dp-ausf-marke');
        var n = hoehe(s) / SEITE, voll = Math.floor(n), rest = n - voll;
        if (ausf) {
          var z = 1;
          while (!pass(s, 1) && z > 0.86) { z -= 0.02; s.style.zoom = z; s.style.width = 'calc(210mm / ' + z + ')'; }
          if (!pass(s, 1)) {
            var gekuerzt = false, sicher = 400;
            while (!pass(s, 1) && sicher-- > 0) {
              var bl = [].slice.call(s.querySelectorAll('.md-blk'));
              var langer = bl.filter(function (b) { return b.querySelectorAll('p,li').length > 1; }).pop();
              if (!langer) break;
              var el = [].slice.call(langer.querySelectorAll('p,li')).pop();
              (el.parentNode.tagName === 'UL' && el.parentNode.children.length === 1 ? el.parentNode : el).remove();
              gekuerzt = true;
            }
            if (gekuerzt) { var h = document.createElement('p'); h.className = 'det'; h.textContent = 'Auf eine Seite gekürzt. Den vollständigen Text enthält der Marktbericht in der App.'; var l = s.querySelectorAll('.md-blk'); l[l.length - 1].appendChild(h); }
          }
          return;
        }
        if (voll >= 1 && rest > 0 && rest < 0.22) {
          var z2 = 1;
          while (z2 > 0.88 && hoehe(s) / SEITE > voll) { z2 -= 0.02; s.style.zoom = z2; s.style.width = 'calc(210mm / ' + z2 + ')'; }
          if (hoehe(s) / SEITE > voll) { s.style.zoom = ''; s.style.width = ''; }
        }
      });
    }
    var bilder = [].slice.call(document.images).map(function (i) { return i.complete ? null : new Promise(function (ok) { i.onload = i.onerror = ok; }); });
    window.__dpFertig = Promise.all(bilder).then(function () { return document.fonts && document.fonts.ready; }).then(function () { try { lauf(); } catch (e) {} return true; });
  } + ')();';
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
          karte(lat, lon, 16, 1200, 620).then(function (k) { return mitZonen(k, lat, lon, 16, 1200, 620); }),
          karte(lat, lon, 12, 1200, 620),
          ((obj && obj.photos) || []).length ? Promise.resolve(null) : karte(lat, lon, 15, 1000, 800),
          zonenListe(lat, lon, 16, 1200, 620).catch(function () { return null; }),
          window.DealPilotPdfLogo ? DealPilotPdfLogo.fuerMarke(b).catch(function () { return null; }) : Promise.resolve(null)
        ]).then(function (z) {
          return { id: id, p: p, md: rep.report_md || p.report_md || '', erstellt: rep.created_at || null,
            obj: obj, fotos: (obj && obj.photos) || [], karteNah: z[0], karteFern: z[1], karteTitel: z[2], brwZonen: z[3], logo: z[4], marke: b };
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
    /* v3212 · Variante D: Bild ganz zeigen (contain) ueber einer unscharfen Kopie, Karte fuellt */
    /* v3219 · Marcel 08.11.: Kopf links/rechts sauberer - links Obsidian mit Logo, rechts Foto (kaum angeschnitten) */
    '.deck .bild{height:100mm;display:grid;grid-template-columns:76mm 1fr;background:#050505}',
    '.deck .bild .links{position:relative;background:#050505 radial-gradient(ellipse at 20% 0%,color-mix(in srgb,var(--gold) 28%,transparent),transparent 62%);color:#fff;padding:14mm 9mm 10mm 17mm;display:flex;flex-direction:column;justify-content:space-between}',
    '.deck .bild .rechts{position:relative;overflow:hidden;background:#1b1b1d}.deck .bild .rechts img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}',
    '.deck .bild .logo{position:static;align-self:flex-start;background:#fff;border-radius:1.6mm;padding:3mm 4mm;display:inline-flex;align-items:center;justify-content:center;max-width:52mm}',
    '.deck .bild .logo img{display:block;max-height:14mm;max-width:44mm;width:auto;height:auto;object-fit:contain}',
    '.deck .bild .lk{font:6.8pt/1.5 "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--wl-e8cc7a, #E8CC7A)}.deck .bild .lk b{display:block;font:600 11pt/1.3 "Space Grotesk",Inter,sans-serif;letter-spacing:0;text-transform:none;color:#fff;margin-top:1.5mm}',
    '.kpis{display:grid;gap:3mm;margin:2mm 0 0}.kpi{border:.3mm solid var(--line);border-top:.9mm solid var(--gold);border-radius:1.2mm;padding:2.6mm 3.2mm}.kpi.hl{background:var(--gold-l)}',
    '.kpi .kl{font:6.3pt/1.3 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.kpi .kw{font:600 13pt/1.2 "JetBrains Mono",monospace;margin-top:1mm;white-space:nowrap}.kpi .ks{font-size:7.2pt;color:var(--muted);margin-top:.4mm}',
    '.umf{background:var(--gold-l);border-radius:1.4mm;padding:3mm 4mm;margin-top:6mm}.umk{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5mm;font:600 8pt "Space Grotesk",Inter,sans-serif}.umk .eyebrow{margin:0}',
    '.toc2{display:grid;grid-template-columns:1fr 1fr;column-gap:8mm}.tz{display:flex;gap:2.4mm;padding:1.3mm 0;border-bottom:.25mm dotted color-mix(in srgb,var(--gold) 45%,#fff);font-size:8.4pt}.tz .tn{font:600 7pt/1.6 "JetBrains Mono",monospace;color:var(--gold);width:5mm}',
    '.sp{position:relative;height:17mm;margin:10mm 2mm 0}.sp .sb{position:absolute;left:0;right:0;top:6mm;height:2.4mm;border-radius:2mm;background:#efece4}',
    '.sp .sband{position:absolute;top:5.2mm;height:4mm;border-radius:2mm;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--gold) 55%,var(--wl-b8932f, #b8932f));opacity:.5}',
    '.sp .sm{position:absolute;top:4.2mm;width:1mm;height:6mm;margin-left:-.5mm;border-radius:.5mm}.sp .st{position:absolute;top:-7.4mm;transform:translateX(-50%);font-size:6.6pt;color:var(--muted);text-align:center;line-height:1.2;white-space:nowrap}',
    '.sp .st b{font:600 7.2pt "JetBrains Mono",monospace;color:var(--ink)}.sp .st.u{top:11.4mm}.spl{display:flex;justify-content:space-between;font:6.2pt "JetBrains Mono",monospace;color:#888;margin:3mm 2mm 0}',
    '.vb{display:grid;grid-template-columns:46mm 1fr 30mm;align-items:center;gap:3mm;margin-bottom:2.2mm;break-inside:avoid}.vb .vn{font-size:8.2pt;line-height:1.3}.vb .vn i{font-style:normal;color:color-mix(in srgb,var(--gold) 70%,#000);font-size:6.8pt;display:block}',
    '.vb .vt{position:relative;height:3mm;background:#efece4;border-radius:2mm}.vb .vf{height:100%;border-radius:2mm;background:#d9cfb3}.vb .vf.g{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--gold) 55%,var(--wl-b8932f, #b8932f))}.vb .vm{position:absolute;top:-1mm;width:.6mm;height:5mm;background:var(--ink)}',
    '.vb .vw{font:600 8.4pt/1.3 "JetBrains Mono",monospace;text-align:right}.vb .vw small{display:block;font-weight:400;font-size:7pt;color:var(--muted)}',
    /* v3219 · Blocksatz, keine Schusterjungen/Hurenkinder, Rechenwege nicht zerreissen */
    'p,.md-blk li,.hinweis,.fuehrt p,.det{text-align:justify;hyphens:auto;-webkit-hyphens:auto;orphans:3;widows:3}',
    '.karte.gross{width:100%;margin:0 0 4mm;break-inside:avoid}',
    'table{break-inside:auto}h2,h3,h4{break-after:avoid}.rw-blk{break-inside:avoid}',
    '.ausf .md-blk p,.ausf ul.md{font-size:8.6pt;line-height:1.45}.ausf h3{font-size:10pt;margin:3.5mm 0 1.5mm}',
    '.rw-h{font-size:13pt;margin:8mm 0 1mm;padding-top:3mm;border-top:.3mm solid var(--ink)}.rw-h:first-of-type{margin-top:2mm;border-top:0;padding-top:0}',
    '.fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin:2mm 0}.fotos img{width:100%;height:40mm;object-fit:cover;border-radius:1.2mm;display:block}',
    '.deck .bild .logo{position:absolute;top:12mm;left:17mm;background:#fff;padding:3mm 4mm;border-radius:1.5mm}',
    '.deck .bild .logo img{height:11mm;width:auto;display:block}',
    '.deck .inhalt{padding:9mm 17mm 0;flex:1}',
    '.deck h1{font-size:25pt;line-height:1.12;margin:2mm 0 2mm}',
    '.deck .adr{font-size:11pt;color:var(--muted);margin-bottom:5mm}',
    '.deck .wertbox{display:grid;grid-template-columns:1.1fr 1fr;gap:8mm;align-items:end;border-top:.3mm solid var(--ink);border-bottom:.2mm solid var(--line);padding:6mm 0}',
    '.deck .wert{font:500 30pt/1 "JetBrains Mono",monospace;letter-spacing:-.02em}',
    '.deck .lbl{font:7.5pt/1.3 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:2.5mm}',
    '.deck .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:5mm;font-size:8.6pt}',
    '.deck .meta b{display:block;font:7pt/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:400;margin-bottom:1mm}',
    '.deck .abs{padding:0 17mm 14mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;font-size:8.4pt;color:var(--muted)}',
    '.deck .abs strong{color:var(--ink);font-weight:600}',
    /* Kacheln der Verfahren */
    '.verf{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border:.2mm solid var(--line);margin:4mm 0}',
    '.verf>div{padding:3.5mm 4mm;border-bottom:.2mm solid var(--line)}.verf>div:nth-child(odd){border-right:.2mm solid var(--line)}',
    '.verf .t{font-size:8pt;color:var(--muted)}.verf .v{font:500 14pt/1.3 "JetBrains Mono",monospace;margin:.5mm 0 1mm}',
    '.verf .f{background:var(--gold-l)}',
    '.block{break-inside:avoid}h3{break-after:avoid}',
    '.bew{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2mm}.bew div{border:.2mm solid var(--line);border-radius:1mm;padding:2mm 2.5mm}.bew span{display:block;font-size:7pt;color:var(--muted)}.bew b{font:600 9.5pt/1.3 "Space Grotesk",Inter,sans-serif}',
    '.vl-box{break-inside:avoid}.vl-t{font-size:8.4pt;margin-bottom:1mm}.vl{width:100%;height:auto;font-family:"JetBrains Mono",monospace}.vl .g{stroke:var(--line);stroke-width:.6}.vl .a{font-size:7px;fill:#5F5E66}.vl .l{fill:none;stroke:var(--gold);stroke-width:1.6}.vl .p{fill:#fff;stroke:var(--gold);stroke-width:1.2}.vl .pe{fill:var(--gold)}',
    '.md-blk{break-inside:auto}.md-blk p{font-size:9pt;margin:0 0 2mm}.md-blk h4{font:600 9.2pt/1.3 Inter,sans-serif;margin:3mm 0 1mm}ul.md{margin:0 0 2mm;padding-left:5mm;font-size:9pt}ul.md li{margin-bottom:.8mm}',
    '.verf .qm{font:500 9pt/1.3 "JetBrains Mono",monospace;color:var(--muted);margin:-.5mm 0 1mm}.verf .zus{font-size:7.6pt;color:var(--muted);margin-bottom:1mm}',
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
    '.umg-raster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm 6mm}.umg{break-inside:avoid}',
    '.umg b{display:block;font:600 8.6pt/1.3 Inter,sans-serif;border-bottom:.3mm solid var(--ink);padding-bottom:1mm;margin-bottom:1mm}.umg b span{font-weight:400;color:var(--muted)}',
    '.umg ul{list-style:none;margin:0;padding:0;font-size:7.8pt}.umg li{display:flex;justify-content:space-between;gap:2mm;padding:.8mm 0;border-bottom:.2mm solid var(--line)}',
    '.umg li span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.umg li span.num{white-space:nowrap;flex:0 0 auto}',
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
    var ergebnis = v.fuehrend ? v.fuehrend.wert : null;
    var art = OBJART[String(od.objart || r.property_type || '').toLowerCase()] || OBJART[String(r.property_type || '').toLowerCase()] || (od.objart || r.property_type || 'Immobilie');
    var b = d.marke || {};
    var teile = [];
    /* v3212 · Variante D (Marcel 08.11.2026): nummerierte Abschnitte, Inhalt auf dem Deckblatt */
    var inhalt = [];
    function ab(titel) { inhalt.push(titel); return '<div class="eyebrow">Abschnitt ' + ('0' + inhalt.length).slice(-2) + '</div>'; }
    /* Rechenwege laufen hintereinander auf EINER Strecke statt je einer eigenen Seite */
    var rw = [];
    function rwTeil(dd, titel, innen) {
      rw.push('<div class="rw-blk">' + String(innen).replace(/<div class="eyebrow">[^<]*<\/div>/, '').replace('<h2>', '<h2 class="rw-h">') + '</div>');
      return '';
    }

    /* 1 · Deckblatt · v3211 Variante D: Foto ganz (nicht angeschnitten), ohne Foto die Karte (Zoom 15);
       Kennzahl-Karten OHNE Angebotspreis (Marcel 08.11.: "brauchen wir im Ankauf nicht"), Inhalt */
    var titelbild = d.fotos[0] || d.karteTitel || d.karteNah || '';
    var istKarte = !d.fotos[0];
    var werteV = v.liste.map(function (x) { return Number(x.wert); }).filter(function (x) { return isFinite(x) && x > 0; });
    var vMin = werteV.length ? Math.min.apply(null, werteV) : null, vMax = werteV.length ? Math.max.apply(null, werteV) : null;
    var tsd = function (x) { return zahl(Math.round(x / 1000), 0); };
    var lvD = p.land_value || {};
    var kpis = [];
    kpis.push('<div class="kpi hl"><div class="kl">Marktwert-Indikation</div><div class="kw">' + eur(ergebnis) + '</div><div class="ks">'
      + (istZahl(ergebnis) && istZahl(r.living_area) && Number(r.living_area) > 0 ? zahl(Number(ergebnis) / Number(r.living_area), 0) + ' €/m²' : '')
      + (v.fuehrend ? (istZahl(r.living_area) ? ' · ' : '') + esc(({ sachwert: 'Sachwert', vergleichswert: 'Vergleichswert', ertragswert: 'Ertragswert', angebote: 'aus Angeboten' })[v.fuehrend.id] || v.fuehrend.name) : '') + '</div></div>');
    if (werteV.length > 1) kpis.push('<div class="kpi"><div class="kl">Spanne der Verfahren</div><div class="kw">' + tsd(vMin) + '–' + tsd(vMax) + ' T€</div><div class="ks">' + werteV.length + ' Verfahren</div></div>');
    if (istZahl(r.purchase_price)) {
      var abw = istZahl(ergebnis) && Number(ergebnis) > 0 ? (Number(r.purchase_price) / Number(ergebnis) - 1) * 100 : null;
      kpis.push('<div class="kpi"><div class="kl">Kaufpreis</div><div class="kw">' + eur(r.purchase_price) + '</div><div class="ks">'
        + (abw == null ? '' : Math.abs(abw) < 0.5 ? 'gleich dem Marktwert' : zahl(Math.abs(abw), 1) + ' % ' + (abw < 0 ? 'unter' : 'über') + ' dem Marktwert') + '</div></div>');
    }
    if (istZahl(lvD.value_sqm)) kpis.push('<div class="kpi"><div class="kl">Bodenrichtwert</div><div class="kw">' + zahl(lvD.value_sqm, 0) + ' €/m²</div><div class="ks">' + esc(lvD.stichtag ? 'Stichtag ' + datum(lvD.stichtag) : 'amtlich') + '</div></div>');
    teile.push('<section class="seite deck">'
      + '<div class="bild"><div class="links">'
      + (d.logo && d.logo.b64 ? '<div class="logo"><img src="' + d.logo.b64 + '" alt=""></div>' : '<div class="logo" style="font:600 12pt Space Grotesk,sans-serif;color:#111">' + esc(b.company || '') + '</div>')
      + '<div class="lk">Marktbericht Profi<b>' + esc(r.gemeinde || r.city || '') + '</b></div></div>'
      + '<div class="rechts">' + (titelbild ? '<img src="' + titelbild + '" alt="' + (istKarte ? 'Karte' : 'Objektfoto') + '">' : '') + '</div></div>'
      + '<div class="inhalt"><div class="eyebrow">Marktbericht Profi · Wertermittlung mit Herleitung</div>'
      + '<h1>' + esc(r.address || '') + '</h1><div class="adr">' + esc(art) + (istZahl(r.living_area) ? ' · ' + zahl(r.living_area, 0) + ' m² Wohnfläche' : '')
      + (istZahl(r.build_year) ? ' · Baujahr ' + jahr(r.build_year) : '') + (istZahl(r.plot_area) ? ' · Grundstück ' + zahl(r.plot_area, 0) + ' m²' : '') + '</div>'
      + '<div class="kpis" style="grid-template-columns:repeat(' + kpis.length + ',1fr)">' + kpis.join('') + '</div>'
      + '<div class="meta"><div><b>Wertermittlungsstichtag</b>' + esc(datum(stichtag)) + '</div><div><b>Grundlage</b>ImmoWertV 2021</div><div><b>Bericht</b>Nr. ' + esc(d.id) + ' · Stufe 3</div></div>'
      + '%%INHALT%%</div>'
      + '<div class="abs"><div><strong>' + esc(b.company || '') + '</strong>' + (b.name && b.name !== b.company ? '<br>' + esc(b.name) : '')
      + '<br>' + esc([b.address, ((b.plz || '') + ' ' + (b.city || '')).trim()].filter(Boolean).join(', '))
      + '<br>' + esc([b.phone, b.email].filter(Boolean).join(' · ')) + '</div>'
      + '<div style="text-align:right">Indikative Wertermittlung,<br>kein Gutachten nach § 194 BauGB</div></div></section>');

    /* 2 · Ergebnis */
    /* v3178 · je Verfahren der Preis je m² Wohnfläche; bei der Marktpreisindikation dazu Spanne und
       Angebotsabschlag (Marcel 04.11.2026) */
    var wflQm = istZahl(r.living_area) && Number(r.living_area) > 0 ? Number(r.living_area) : null;
    var kacheln = v.liste.map(function (x) {
      var qm = wflQm ? '<div class="qm num">' + zahl(Number(x.wert) / wflQm, 0) + ' €/m²</div>' : '';
      var zus = '';
      if (x.id === 'angebote') {
        if (istZahl(x.low) && istZahl(x.high)) zus += '<div class="zus">Spanne ' + eur(x.low) + ' – ' + eur(x.high)
          + (wflQm ? ' · ' + zahl(x.low / wflQm, 0) + '–' + zahl(x.high / wflQm, 0) + ' €/m²' : '') + '</div>';
        var ab = x.abschlag;
        if (ab && istZahl(ab.pct)) zus += '<div class="zus">Angebotsabschlag ' + zahl(ab.pct, 1) + ' %'
          + (ab.roh && istZahl(ab.roh.estimated) ? ' auf ' + eur(ab.roh.estimated) + ' (Angebotsniveau)' : '')
          + (ab.herkunft ? ' · ' + esc(ab.herkunft) : '') + '</div>';
      }
      return '<div class="' + (x.fuehrend ? 'f' : '') + '"><div class="t">' + esc(x.name) + ' · ' + esc(x.recht) + '</div><div class="v">' + eur(x.wert) + '</div>'
        + qm + zus + '<span class="tag' + (x.fuehrend ? ' g' : '') + '">' + (x.fuehrend ? 'führend' : esc(x.tag)) + '</span></div>';
    }).join('');
    /* v3178 · Mieten je m²: Ist, im Ertragswert angesetzt, Band der Marktüblichkeit, Angebote, Zensus */
    var ewM = c.ertragswert || {}, band = ewM.miete_band || {}, rm = p.rent || {}, zm = p.zensus || {};
    var mieten = [
      ['Ist-Miete laut Objekt', ewM.miete_ist_qm != null ? ewM.miete_ist_qm : band.ist_qm, 'eigene Angabe'],
      ['Im Ertragswert angesetzt', ewM.miete_qm, ewM.miete_modellkonform_grund || (ewM.miete_herkunft && ewM.miete_herkunft.vergleich ? 'marktüblich erzielbar' : 'marktüblich erzielbar')],
      ['Band der Marktüblichkeit', istZahl(band.unten_qm) && istZahl(band.oben_qm) ? null : undefined, istZahl(band.unten_qm) ? zahl(band.unten_qm, 2) + ' – ' + zahl(band.oben_qm, 2) + ' €/m² (± ' + zahl(band.band_pct, 0) + ' %)' : ''],
      ['Angebotsmieten (Median)', rm.median_per_sqm, istZahl(rm.q25_per_sqm) ? 'Quartile ' + zahl(rm.q25_per_sqm, 2) + ' – ' + zahl(rm.q75_per_sqm, 2) + ' €/m², ' + zahl(rm.sample_size, 0) + ' Angebote' : ''],
      ['Bestandsmiete Zensus 2022', zm.nettokaltmiete_qm, zm.available ? 'Gemeinde/Kreis, Stichtag Zensus' : '']
    ].filter(function (z) { return istZahl(z[1]) || (z[1] === null && z[2]); });
    var mietTab = mieten.length ? '<div class="block"><h3>Mieten je m² Wohnfläche</h3><table><tbody>' + mieten.map(function (z) {
      return '<tr><td>' + esc(z[0]) + '</td><td class="r num">' + (istZahl(z[1]) ? zahl(z[1], 2) + ' €/m²' : '') + '</td><td class="q">' + esc(String(z[2] || '').slice(0, 140)) + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '';
    void kacheln;
    teile.push(seite(d, 'Ergebnis', ab('Ergebnis') + '<h2>Marktwert-Indikation ' + eur(ergebnis) + '</h2>'
      + '<p class="sub">' + (istZahl(ergebnis) && wflQm ? zahl(Number(ergebnis) / wflQm, 0) + ' €/m² Wohnfläche' : '')
      + (p.sale && istZahl(p.sale.sample_size) ? (wflQm ? ' · ' : '') + zahl(p.sale.sample_size, 0) + ' Vergleichsangebote' : '') + (v.fuehrend ? '' : ' · ' + esc(v.grund)) + '</p>'
      + fuehrendBox(v) + '<h3>Wertspanne</h3>' + spanneBand(v.liste, r.purchase_price) + '<h3>Die Verfahren</h3>' + verfahrenBalken(v, wflQm)
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
    var gal = d.fotos.slice(1, 4).map(function (f) { return '<img src="' + f + '" alt="">'; }).join('');
    teile.push(seite(d, 'Objekt', ab('Das Objekt') + '<h2>Das Objekt</h2><p class="sub">Angaben zum Objekt, wie sie dem Bericht zugrunde liegen.</p>'
      + '<div class="kv">' + kv + '</div>'
      + (gal ? '<h3>Objektfotos</h3><div class="fotos">' + gal + '</div>' : '')
      + '<h3>Energieeffizienz</h3>' + energieSkala(od.ds2_energie || r.eq_energie, od.endenergie || od.energie_kwh || null)
      + mietTab));

    /* 4 · Lage */
    var mk = (p.makro_kennzahlen && p.makro_kennzahlen.werte) || [];
    var makro = mk.slice(0, 8).map(function (w) {
      return '<tr><td>' + esc(w.label) + '</td><td>' + esc(w.gebiet || '') + '</td><td class="r num">'
        + (istZahl(w.wert) ? (w.vorzeichen && Number(w.wert) > 0 ? '+' : '') + zahl(w.wert, istZahl(w.nachkomma) ? w.nachkomma : 1) : '–') + ' ' + esc(w.einheit || '') + '</td><td class="q">' + esc(w.jahr ? 'Stand ' + w.jahr : '') + '</td></tr>';
    }).join('');
    var z = p.zensus || {};
    var regionTabL = (mk.length ? '<div class="block"><h3>Region</h3><table><thead><tr><th>Kennzahl</th><th>Gebiet</th><th class="r">Wert</th><th></th></tr></thead><tbody>' + makro + '</tbody></table>'
      + ((p.zensus || {}).available ? '<p class="det" style="margin-top:2mm">Zensus 2022 (' + esc((p.zensus.gemeinde && p.zensus.gemeinde.name) || p.zensus.kreis_name || '') + '): Leerstandsquote ' + zahl(p.zensus.leerstandsquote, 1) + ' %, Eigentümerquote ' + zahl(p.zensus.eigentuemerquote, 1) + ' %.</p>' : '') + '</div>' : '');
    teile.push(seite(d, 'Lage', ab('Lage') + '<h2>Lage</h2>'
      + '<p class="sub">' + esc([r.ortsteil, r.gemeinde].filter(Boolean).join(', ')) + (p.assessment ? ' · Mikrolage ' + esc(p.assessment.mikrolage || '–') + ', Makrolage ' + esc(p.assessment.makrolage || '–') : '') + '</p>'
      + (d.karteNah ? '<img class="karte gross" src="' + d.karteNah + '" alt="Karte Umgebung">' : '') + (d.karteFern ? '<img class="karte gross" src="' + d.karteFern + '" alt="Karte Region">' : '')
      + zonenTabelle(d.brwZonen)
      + '<h3>Mikrolage' + (p.micro && istZahl(p.micro.score) ? ' · ' + zahl(p.micro.score, 0) + ' von 100' : '') + '</h3>' + mikrolage(p.micro) + umgebung(p.micro) + regionTabL));
    /* v3178c · Region und Bewertung gehoeren zur Seite Markt & Region (sonst lief Lage ueber) */
    var regionHtml = bewertung(p.assessment);
    var regionTab = (makro ? '<div class="block"><h3>Region</h3><table><thead><tr><th>Kennzahl</th><th>Gebiet</th><th class="r">Wert</th><th></th></tr></thead><tbody>' + makro + '</tbody></table>'
      + (z.available ? '<p class="det" style="margin-top:2mm">Zensus 2022 (' + esc((z.gemeinde && z.gemeinde.name) || z.kreis_name || '') + '): Leerstandsquote ' + zahl(z.leerstandsquote, 1) + ' %, Eigentümerquote ' + zahl(z.eigentuemerquote, 1) + ' %.</p>' : '') + '</div>' : '');

    /* 5 · Markt */
    var s = p.sale || {}, m = p.rent || {};
    var markt = '<table><thead><tr><th></th><th class="r">Unteres Quartil</th><th class="r">Median</th><th class="r">Oberes Quartil</th><th class="r">Angebote</th></tr></thead><tbody>'
      + (istZahl(s.median_per_sqm) ? '<tr><td>Kaufpreise €/m²</td><td class="r num">' + zahl(s.q25_per_sqm, 0) + '</td><td class="r num">' + zahl(s.median_per_sqm, 0) + '</td><td class="r num">' + zahl(s.q75_per_sqm, 0) + '</td><td class="r num">' + zahl(s.sample_size, 0) + '</td></tr>' : '')
      + (istZahl(m.median_per_sqm) ? '<tr><td>Mieten €/m²</td><td class="r num">' + zahl(m.q25_per_sqm, 2) + '</td><td class="r num">' + zahl(m.median_per_sqm, 2) + '</td><td class="r num">' + zahl(m.q75_per_sqm, 2) + '</td><td class="r num">' + zahl(m.sample_size, 0) + '</td></tr>' : '')
      + '</tbody></table>';
    var mv = (p.valuation && p.valuation.market_value) || {};
    teile.push(seite(d, 'Markt', ab('Markt') + '<h2>Markt</h2>'
      + '<p class="sub">Aktueller Marktdurchschnitt vergleichbarer Angebote im Umkreis von ' + zahl((s.used_radius_m || 0) / 1000, 0) + ' km. Angebotspreise sind keine Kaufpreise; sie werden um den Angebotsabschlag bereinigt.</p>'
      + markt
      + '<div class="kv" style="margin-top:4mm">'
      + '<div><span>Preisentwicklung</span><span class="num">' + (istZahl(p.price_trend_pct) ? (p.price_trend_pct > 0 ? '+' : '') + zahl(p.price_trend_pct, 1) + ' %' : '–') + '</span></div>'
      + '<div><span>Mietentwicklung</span><span class="num">' + (istZahl(p.rent_trend_pct) ? (p.rent_trend_pct > 0 ? '+' : '') + zahl(p.rent_trend_pct, 1) + ' %' : '–') + '</span></div>'
      + '<div><span>Vermarktungsdauer</span><span class="num">' + (p.market_dynamics && istZahl(p.market_dynamics.days_on_market) ? zahl(p.market_dynamics.days_on_market, 0) + ' Tage' : '–') + '</span></div>'
      + '<div><span>Marktpreisindikation</span><span class="num">' + eur(mv.estimated) + (istZahl(mv.low) ? ' (' + eur(mv.low) + ' – ' + eur(mv.high) + ')' : '') + '</span></div></div>'
      + ((p.valuation && p.valuation.notes || []).length ? '<p class="det" style="margin-top:3mm">' + esc(p.valuation.notes.join(' ')) + '</p>' : '')
      + kennzahlen(p, r) + marktentwicklung(p.market_history) + regionHtml));
    var vgl = vergleichsangebote(p);
    void regionTab;
    if (vgl) teile.push(seite(d, 'Vergleichsangebote', ab('Vergleichsangebote') + '<h2>Vergleichsangebote</h2><p class="sub">Vergleichbare Angebote im Umkreis, nach Entfernung.</p>' + vgl));

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
      /* v3207 · ohne Sachwert (z. B. Eigentumswohnung) heisst die Seite nur „Bodenwert" */
      var swTitel = istZahl(sw.value_eur) ? (bwRows.length ? 'Bodenwert und Sachwert' : 'Sachwert') : 'Bodenwert';
      teile.push(rwTeil(d, swTitel, '<div class="eyebrow">Abschnitt 4</div><h2>' + swTitel + '</h2><p class="sub">Zeile für Zeile, mit der Fundstelle jeder Zahl.</p>'
        + (bwRows.length ? '<h3>Bodenwert</h3>' + staffelTabelle(bwRows, bwQ) : '')
        + (istZahl(sw.value_eur) ? '<h3>Sachwert</h3>' + staffelTabelle(sw.staffel, swQ)
          + (sw.restnutzungsdauer_herkunft && sw.restnutzungsdauer_herkunft.hinweis ? '<p class="det">' + esc(sw.restnutzungsdauer_herkunft.hinweis) + '</p>' : '')
          + (sw.sachwertfaktor ? '<div class="hinweis">Sachwertfaktor: ' + esc(sw.sachwertfaktor_ausschuss || 'zuständiger Gutachterausschuss') + '. Er ist nach demselben Modell abgeleitet, in dem hier gerechnet wird (NHK 2010, lineare Alterswertminderung, § 10 ImmoWertV).</div>'
            : '<div class="hinweis">Für diesen Ort liegt kein Sachwertfaktor vor. Ausgewiesen ist der vorläufige Sachwert ohne Marktanpassung; er ist eine Herstellungskostenrechnung, kein Marktwert.</div>') : '')
        + swfWeg(sw)));
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
      teile.push(rwTeil(d, 'Vergleichswert', '<div class="eyebrow">Abschnitt 5</div><h2>Vergleichswert</h2><p class="sub">Immobilienrichtwert des Gutachterausschusses, umgerechnet nach seinen Koeffizienten.</p>'
        + irwT + (irw.hinweise || []).map(function (h) { return '<p class="det">' + esc(h) + '</p>'; }).join('')
        + (irw.quellennachweis ? '<p class="det">' + esc(irw.quellennachweis) + '</p>' : '')));
      void irwRows;
    } else if (rvf.verfuegbar && rvf.rechenweg) {
      teile.push(rwTeil(d, 'Vergleichswert', '<div class="eyebrow">Abschnitt 5</div><h2>Vergleichswert</h2><p>' + esc(rvf.rechenweg) + '</p><p class="det">' + esc(rvf.quelle || rvf.hinweis || '') + '</p>'));
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
      teile.push(rwTeil(d, 'Ertragswert', '<div class="eyebrow">Abschnitt 6</div><h2>Ertragswert</h2><p class="sub">Allgemeines Ertragswertverfahren. Liegenschaftszins: ' + esc(ew.liegenschaftszins_quelle || '–') + '.</p>'
        + staffelTabelle(ew.staffel, ewQ)));
    }

    /* 9 · Erbbaurecht */
    var eb = p.erbbaurecht;
    if (eb && eb.ok) {
      teile.push(rwTeil(d, 'Erbbaurecht', '<div class="eyebrow">Abschnitt 7</div><h2>Erbbaurecht</h2>'
        + '<div class="kv"><div><span>Wert bei Volleigentum</span><span class="num">' + eur((eb.teile && eb.teile.gebaeudeanteil || 0) + (eb.teile && eb.teile.bodenwert || 0)) + '</span></div>'
        + '<div><span>Abschlag nach § 50 ImmoWertV</span><span class="num">' + eur(eb.abschlag) + ' (' + zahl(eb.abschlagPct, 1) + ' %)</span></div>'
        + '<div><span>Erbbauzins vertraglich</span><span class="num">' + eur(eb.teile && eb.teile.zinsVertragEur) + ' / Jahr</span></div>'
        + '<div><span>Erbbauzins angemessen</span><span class="num">' + eur(eb.teile && eb.teile.zinsAngemessenEur) + ' / Jahr (' + zahl(eb.annahmen && eb.annahmen.zinssatzAngemessen, 1) + ' %)</span></div>'
        + '<div><span>Restlaufzeit</span><span class="num">' + zahl(eb.annahmen && eb.annahmen.restlaufzeit, 0) + ' Jahre</span></div>'
        + '<div><span>Erbbaurechtswert</span><span class="num"><b>' + eur(eb.erbbaurechtswert) + '</b></span></div></div>'
        + (eb.hinweise || []).map(function (h) { return '<p class="det">' + esc(h) + '</p>'; }).join('')
        + '<p class="det">' + esc(eb.annahmen && eb.annahmen.quelle || '') + '</p>'));
    }

    if (rw.length) teile.push(seite(d, 'Rechenwege', ab('Rechenwege') + '<h2>Rechenwege</h2><p class="sub">Jedes Verfahren Zeile für Zeile, mit der Fundstelle jeder Zahl.</p>' + rw.join('')));

    /* v3178c · Ausfuehrliche Einschaetzung (KI-Abschnitte B-D, wie der normale Bericht) */
    var ausf = ausfuehrlich(d.md);
    if (ausf) teile.push(seite(d, 'Ausführliche Einschätzung', '<span class="dp-ausf-marke"></span>' + ab('Ausführliche Einschätzung') + '<h2>Ausführliche Einschätzung</h2><p class="sub">Text der KI-Auswertung auf Grundlage der Zahlen dieses Berichts. Maßgeblich sind die Rechenwege oben.</p>' + ausf));

    /* 10 · Quellen */
    var q = [];
    if (lv.source) q.push('Bodenrichtwert: ' + lv.source + (lv.stichtag ? ', Stichtag ' + datum(lv.stichtag) : '') + (lv.quellenvermerk ? ' — ' + lv.quellenvermerk : (lv.license ? ', ' + lv.license : '')));
    (c.quellen_nachweis || []).forEach(function (x) { q.push((x.kennzahlen ? x.kennzahlen.join(', ') + ': ' : '') + (x.vermerk || '') + (x.url ? ' (' + x.url + ')' : '')); });
    if (sw.sachwertfaktor && sw.sachwertfaktor.quelle) q.push('Sachwertfaktor: ' + sw.sachwertfaktor.quelle);
    if (d.brwZonen) q.push('Bodenrichtwertzonen in Karte und Tabelle: Gutachterausschüsse für Grundstückswerte, BORIS-D, dl-de/by-2-0 (bodenrichtwerte-boris.de)');
    if (irw.quellennachweis) q.push('Immobilienrichtwert: ' + irw.quellennachweis);
    var mq = p.makro_kennzahlen && p.makro_kennzahlen.quellennachweis;
    if (mq) q.push('Regionaldaten: ' + (typeof mq === 'object' ? [mq.vermerk, mq.lizenz].filter(Boolean).join(' · ') : mq));
    if (z.available) q.push('Zensus 2022: Statistische Ämter des Bundes und der Länder' + (z.license ? ', ' + z.license : ''));
    q.push('Normalherstellungskosten: Anlage 4 ImmoWertV (NHK 2010). Baupreisindex: Statistisches Bundesamt.');
    q.push('Angebotsdaten: aktueller Marktdurchschnitt vergleichbarer Angebote.');
    var uniq = q.filter(function (x, i) { return x && q.indexOf(x) === i; });
    teile.push(seite(d, 'Quellen', ab('Quellen und Grundlagen') + '<h2>Quellen und Grundlagen</h2>'
      + '<ol class="quellen">' + uniq.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>'
      + ((c.notes || []).length ? '<h3>Hinweise zur Rechnung</h3>' + c.notes.map(function (n) { return '<p class="det" style="font-size:7.8pt">' + esc(n) + '</p>'; }).join('') : '')
      + '<h3>Zu diesem Bericht</h3><p>Die Wertermittlung folgt der Immobilienwertermittlungsverordnung 2021. Sie ist indikativ und ersetzt kein Verkehrswertgutachten nach § 194 BauGB. Grundlage sind die Angaben zum Objekt; eine Besichtigung hat nicht stattgefunden. Jede Zahl stammt aus einer genannten Quelle oder ist als Annahme gekennzeichnet.</p>'
      + '<p class="det">Erstellt am ' + esc(datum(d.erstellt || new Date())) + ' mit DealPilot · Fassung ' + VERSION + '</p>'));

    /* v3219 · Marcel 08.11.2026: "keine Semikolons oder Bindestriche, normale Werte, normale Saetze mit Punkt
       und Komma". Gilt fuer jeden Text im Koerper (KI-Text und eigene Saetze), nicht fuer Stil und Attribute.
       Ein einzelnes "–" als Platzhalter fuer "kein Wert" bleibt. */
    function satz(t) {
      return t
        .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 bis $2')
        .replace(/(\d\s?(?:€|%|€\/m²|T€|m²))\s*[–—]\s*(\d)/g, '$1 bis $2')
        .replace(/\s+[–—]\s+/g, ', ')
        .replace(/\s+-\s+/g, ', ')
        .replace(/(&[#\w]+;)|;\s*/g, function (m, e) { return e || ', '; })
        .replace(/,\s*,/g, ',').replace(/,\s*\./g, '.');
    }
    var toc = '<div class="umf"><div class="umk"><span class="eyebrow">Inhalt</span><span>Stufe 3 · Profi</span></div><div class="toc2">'
      + inhalt.map(function (t, i) { return '<div class="tz"><span class="tn">' + ('0' + (i + 1)).slice(-2) + '</span><span>' + esc(t) + '</span></div>'; }).join('') + '</div></div>';
    teile[0] = teile[0].replace('%%INHALT%%', toc);
    var fonts = (location && location.origin ? location.origin : '') + '/fonts/dp-fonts.css';
    var koerper = teile.join('').replace(/>([^<]+)</g, function (m, t) { return '>' + satz(t) + '<'; });
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Marktbericht Profi · ' + esc(r.address || '') + '</title>'
      + '<link rel="stylesheet" href="' + fonts + '"><style>' + CSS + markenGold() + '</style></head><body>' + koerper
      + '<script>' + EINPASSEN + '</scr' + 'ipt></body></html>';
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
    VERSION: VERSION, _zonenBbox: zonenBbox, _mitZonen: mitZonen, _setZonenKachel: function (k) { ZONEN_KACHEL = k; },
    oeffnen: oeffnen,
    /** Für den PDF-Dienst: fertiges HTML-Dokument (String). */
    dokument: function (objKey, reportId) { return sammeln(objKey, reportId).then(html); },
    berichtFuer: berichtFuer,
    _html: html, _zonenListe: zonenListe, _energieSkala: energieSkala, _verfahren: verfahren
  };
})();
