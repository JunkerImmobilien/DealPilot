/* pa-potenzial.js — v3323 · PILOT-ANALYSE: REITER „POTENZIALANALYSE"
   ───────────────────────────────────────────────────────────────────────────
   Marcel 12.11.2026: „was ich aber wichtig finde, dass wir dann noch einen Reiter haben: Potenzialanalyse,
   dass wir da noch mal genau sehen: Was können wir machen? Also du hast ja in der Übersicht unten Potenzial."

   RECHNET NICHTS. Alle Zahlen kommen aus dem Potenzial-Kern, der auch die Tafel „Ankauf · Bestand · Soll ·
   Zielbild" füllt (potenzial.js pilotPayload() → zusammenfassung(), ergebnis(); die zulässige Miete aus
   mietpotenzial-kern.js über potenzial.js). Der Absatz des Piloten (potenzial_text) stand bis v3319 unten im
   Gesamtstatement der Übersicht und steht jetzt hier, ganz.

     html(a, bestand)  Inhalt des Unterreiters (Einfach: Karten + Treppe, Detail: Rechenwege und Wohnungen)
     kurz()            { zahl, unter } für die Wegweiser-Karte der Übersicht, null ohne Potenzial
   Gold nur als var(--wl-…), Statusfarben fest. */
(function () {
  'use strict';
  if (window.DpPaPotenzial) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function txt(s) { try { if (typeof window._escClean === 'function') return window._escClean(s); } catch (e) {} return esc(s); }
  function zahl(v) { return v != null && v !== '' && isFinite(Number(v)); }
  function eur(v) { return (v < 0 ? '− ' : '') + Math.round(Math.abs(v)).toLocaleString('de-DE') + ' €'; }
  function sEur(v) { var r = Math.round(v); return (r > 0 ? '+ ' : r < 0 ? '− ' : '') + Math.abs(r).toLocaleString('de-DE') + ' €'; }
  function saetze(t, n) { try { return window.DpPilotV4 && window.DpPilotV4.saetze ? window.DpPilotV4.saetze(t, n) : String(t || ''); } catch (e) { return String(t || ''); } }
  function karte(inner, kl) { return '<div class="dp-pa-card' + (kl ? ' ' + kl : '') + '">' + inner + '</div>'; }
  function kopf(lbl) { return '<div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">' + esc(lbl) + '</span><span class="dp-pa-rule"></span></div>'; }

  function daten() {
    var P = window.DpPotenzial; if (!P) return null;
    var pp = null, mr = null, im = null, auf = null;
    try { pp = P.pilotPayload ? P.pilotPayload() : null; } catch (e) { pp = null; }
    try { mr = P.mietrechtDaten ? P.mietrechtDaten() : null; } catch (e) { mr = null; }
    try { im = P.indexmieteDaten ? P.indexmieteDaten() : null; } catch (e) { im = null; }
    /* Aufteilung: der Aufteilerwert, wie ihn Ankauf · Bestand · Zielbild führt (wert-zielbild.js daten().wert.aufteilung) */
    try { var d = window.DpWertZielbild && window.DpWertZielbild.daten ? window.DpWertZielbild.daten() : null; auf = d && d.wert && d.wert.aufteilung ? d.wert.aufteilung : null; } catch (e) { auf = null; }
    return { pp: pp, mr: mr, im: im, auf: auf };
  }

  /** Mehrmiete je Monat gegen heute und der Wertzuwachs nach Kosten je Stufe */
  function stufen(pp) {
    var S = pp && pp.stufen; if (!S || !S.bestand) return null;
    var b = S.bestand, out = { bestand: b, mh: S.mieterhoehung || null, zb: S.zielbild || null };
    /* Ertragswert und Restnutzungsdauer je Stufe: ohne Lauf in dieser Sitzung aus dem gespeicherten Stand – dieselbe
       Quelle wie die Tafel Ankauf · Bestand · Soll · Zielbild (potenzial.js stufenWerte(): Lauf oder Abruf mit Datum) */
    var sw = null; try { sw = window.DpPotenzial && window.DpPotenzial.stufenWerte ? window.DpPotenzial.stufenWerte() : null; } catch (e) { sw = null; }
    if (sw && !sw.gesperrt && sw.S) [['bestand', 'bestand'], ['mh', 'mieterhoehung'], ['zb', 'zielbild']].forEach(function (p) {
      var s = out[p[0]], w = sw.S[p[1]]; if (!s || !w) return;
      if (!zahl(s.ertragswert) && zahl(w.ertragswert)) { s.ertragswert = w.ertragswert; s._ewQuelle = sw; }
      if (!zahl(s.rnd) && zahl(w.rnd)) s.rnd = w.rnd;
    });
    out._sw = sw;
    ['mh', 'zb'].forEach(function (k) {
      var s = out[k]; if (!s) return;
      s._mehr = zahl(s.kaltmiete_monat) && zahl(b.kaltmiete_monat) ? s.kaltmiete_monat - b.kaltmiete_monat : null;
      s._zuw = zahl(s.ertragswert) && zahl(b.ertragswert) && !pp.ertragswert_gesperrt ? s.ertragswert - b.ertragswert - (Number(s.kosten) || 0) : null;
    });
    return out;
  }

  function kurz() {
    var d = daten(); if (!d || !d.pp) return null;
    var s = stufen(d.pp); if (!s) return null;
    var top = s.zb && zahl(s.zb._mehr) ? s.zb : (s.mh && zahl(s.mh._mehr) ? s.mh : null);
    if (!top || !(top._mehr > 0)) return null;
    return { zahl: sEur(top._mehr) + ' / Monat', unter: 'Kaltmiete ' + (top === s.zb ? 'im Zielbild' : 'nach Mieterhöhung') + ' gegen heute' };
  }

  function stil() {
    if (document.getElementById('dp-pap-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-pap-stil';
    s.textContent = [
      '.dp-pap-stufen{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 12px}',
      '@media (max-width:700px){.dp-pap-stufen{grid-template-columns:1fr}}',
      '.dp-pap-st{border:1px solid #E6DCC2;border-top:4px solid var(--c,#2A2727);border-radius:12px;background:#fff;padding:12px 14px;display:grid;gap:3px;align-content:start;min-width:0}',
      '.dp-pap-st small{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-pap-st b{font:700 22px "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums}',
      '.dp-pap-st em{font-style:normal;font:500 12px Inter,sans-serif;color:#7A7370}',
      '.dp-pap-st .plus{font:600 13px "Space Grotesk",Inter,sans-serif;color:#2E7D50}',
      '.dp-pap-st .minus{font:600 13px "Space Grotesk",Inter,sans-serif;color:#B8625C}',
      '.dp-pap-st dl{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:6px 0 0;font:400 12px Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-pap-st dt{color:#7A7370}.dp-pap-st dd{margin:0;text-align:right;font-weight:600;color:#2A2727}',
      /* Treppe: Kaltmiete je Stufe als Balken */
      '.dp-pap-treppe{display:grid;gap:7px;margin:4px 0 2px}',
      '.dp-pap-tr{display:grid;grid-template-columns:150px minmax(0,1fr) 110px;gap:10px;align-items:center;font:500 12.5px Inter,sans-serif;color:#2A2727}',
      '.dp-pap-tr .bahn{background:#F1ECE1;border-radius:0 5px 5px 0;height:16px;position:relative;overflow:hidden}',
      '.dp-pap-tr .bahn i{position:absolute;left:0;top:0;bottom:0;border-radius:0 5px 5px 0;background:var(--c,var(--wl-c9a84c,#C9A84C))}',
      '.dp-pap-tr b{text-align:right;font:700 13px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '@media (max-width:620px){.dp-pap-tr{grid-template-columns:96px minmax(0,1fr) 84px;font-size:12px}}',
      '.dp-pap-hebel{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}',
      '.dp-pap-h{border:1px solid #E6DCC2;border-radius:12px;background:#fff;padding:12px 14px;display:grid;gap:4px;align-content:start;min-width:0}',
      '.dp-pap-h small{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-pap-h b{font:700 17px "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums}',
      '.dp-pa-wrap .dp-pap-h p{margin:0;font:400 12.5px/1.55 Inter,sans-serif;color:#4A4542;text-align:left !important;hyphens:auto}',
      '.dp-pap-h.aus{background:#FBF6E9}',
      '.dp-pap-mr{display:grid;gap:6px}',
      '.dp-pap-mr div{display:grid;grid-template-columns:150px minmax(0,1fr);gap:4px 12px;font:400 12.5px/1.5 Inter,sans-serif;color:#2A2727}',
      '.dp-pap-mr span{color:#7A7370}.dp-pap-mr .w{color:#8a6d1f}',
      '@media (max-width:620px){.dp-pap-mr div{grid-template-columns:1fr}}',
      '.dp-pap-tab{overflow-x:auto;border:1px solid #E6DCC2;border-radius:12px}',
      '.dp-pap-tab table{border-collapse:collapse;width:100%;min-width:560px;font:400 12.5px Inter,sans-serif;font-variant-numeric:tabular-nums}',
      '.dp-pap-tab th{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#7A7370;text-align:right;padding:8px 10px;border-bottom:1px solid #E6DCC2;background:#FBF6E9;white-space:nowrap}',
      '.dp-pap-tab td{padding:6px 10px;border-bottom:1px solid #F1ECE1;text-align:right;color:#2A2727;white-space:nowrap}',
      '.dp-pap-tab th:first-child,.dp-pap-tab td:first-child,.dp-pap-tab td.l{text-align:left}',
      '.dp-pap-tab td.l{white-space:normal;min-width:160px;color:#7A7370}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function stufeKarte(titel, farbe, s, b, jahr, art) {
    if (!s) return '';
    var mehr = art !== 'bestand' && zahl(s._mehr) ? s._mehr : null, zuw = art !== 'bestand' && zahl(s._zuw) ? s._zuw : null;
    return '<div class="dp-pap-st" style="--c:' + farbe + '"><small>' + esc(titel) + (jahr ? ' · ab ' + esc(jahr) : '') + '</small>'
      + '<b>' + (zahl(s.kaltmiete_monat) ? eur(s.kaltmiete_monat) : '–') + '</b><em>Kaltmiete je Monat</em>'
      + (mehr != null ? '<span class="' + (mehr >= 0 ? 'plus' : 'minus') + '">' + sEur(mehr) + ' / Monat gegen heute</span>' : '')
      + '<dl>'
      + (zahl(s.kosten) && s.kosten > 0 ? '<dt>Maßnahmen</dt><dd>' + eur(s.kosten) + '</dd>' : '')
      + (zahl(s.ertragswert) ? '<dt>Ertragswert</dt><dd>' + eur(s.ertragswert) + '</dd>' : '')
      + (zuw != null ? '<dt>Wertzuwachs nach Kosten</dt><dd style="color:' + (zuw >= 0 ? '#2E7D50' : '#B8625C') + '">' + sEur(zuw) + '</dd>' : '')
      + (zahl(s.rnd) ? '<dt>Restnutzungsdauer</dt><dd>' + Math.round(s.rnd) + ' J.</dd>' : '')
      + (zahl(s.bmy) ? '<dt>Bruttorendite</dt><dd>' + Number(s.bmy).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %</dd>' : '')
      + '</dl></div>';
  }

  function treppe(S) {
    var z = [['Heute', S.bestand, '#2A2727'], ['nach Mieterhöhung', S.mh, 'var(--wl-b8932f,#b8932f)'], ['im Zielbild', S.zb, 'var(--wl-c9a84c,#C9A84C)']]
      .filter(function (x) { return x[1] && zahl(x[1].kaltmiete_monat); });
    if (z.length < 2) return '';
    var max = Math.max.apply(null, z.map(function (x) { return Number(x[1].kaltmiete_monat); })) || 1;
    return '<div class="dp-pap-treppe" role="img" aria-label="Kaltmiete je Monat: heute, nach Mieterhöhung und im Zielbild">' + z.map(function (x) {
      var w = Math.max(2, Math.round(Number(x[1].kaltmiete_monat) / max * 100));
      return '<div class="dp-pap-tr"><span>' + esc(x[0]) + '</span><span class="bahn"><i style="width:' + w + '%;--c:' + x[2] + '"></i></span><b>' + eur(x[1].kaltmiete_monat) + '</b></div>';
    }).join('') + '</div>';
  }

  /** Inhalt des Reiters */
  function html(a, bestand) {
    stil();
    a = a || {};
    var d = daten(); if (!d) return '';
    var pp = d.pp, S = stufen(pp), h = '';
    var hatText = a.potenzial_text != null && String(a.potenzial_text).trim() !== '';
    if (S) {
      var J = pp.jahre || {};
      h += karte(kopf('Was in dem Objekt steckt · Kaltmiete je Monat') + treppe(S)
        + '<p class="dp-pa4-erkl" style="margin-top:8px"><b>Heute</b> ist die Ist-Miete. <b>Nach Mieterhöhung</b> ist die Miete, die du nach § 558 BGB verlangen darfst (Vergleichsmiete, Kappungsgrenze, Sperrfrist). <b>Im Zielbild</b> steht je Wohnung deine Zielmiete, ohne eigene Angabe das rechtliche Maximum bei Neuvermietung (begrenzt auf den Markt), dazu deine Maßnahmen. </p>');
      h += '<div class="dp-pap-stufen dp-pa4-mt">'
        + stufeKarte('Heute', '#2A2727', S.bestand, S.bestand, null, 'bestand')
        + stufeKarte('Nach Mieterhöhung', 'var(--wl-b8932f,#b8932f)', S.mh, S.bestand, J.mieterhoehung, 'mh')
        + stufeKarte('Zielbild', 'var(--wl-c9a84c,#C9A84C)', S.zb, S.bestand, J.zielbild, 'zb') + '</div>';
      if (pp.ertragswert_gesperrt && pp.ertragswert_hinweis) h += '<p class="dp-pa-fuss">' + esc(pp.ertragswert_hinweis) + '</p>';
      else if (S._sw && S._sw.quelle === 'abruf' && S._sw.datum && [S.bestand, S.mh, S.zb].some(function (x) { return x && x._ewQuelle; }))
        h += '<p class="dp-pa-fuss">Ertragswerte aus dem gespeicherten Abruf vom ' + esc(S._sw.datum) + (S._sw.veraltet ? ' – seitdem hat sich am Objekt etwas geändert; im Reiter Ankauf · Bestand · Soll · Zielbild neu rechnen' : '') + '.</p>';
    }
    /* Die Hebel einzeln: Mieterhöhung, Mieterwechsel, Modernisierung, Aufteilung, Indexmiete */
    var hebel = [];
    if (S && S.mh && zahl(S.mh._mehr) && S.mh._mehr > 0)
      hebel.push(['Nächste Mieterhöhung (§ 558)',   /* v3356 · A8: S.mh ist die nächste Stufe bis zur Kappung, nicht der ganze Weg */ sEur(S.mh._mehr * 12) + ' im Jahr', pp.mieterhoehung_rechenweg && pp.mieterhoehung_rechenweg.satz ? saetze(pp.mieterhoehung_rechenweg.satz, 1) : (pp.kappung && pp.kappung.text ? pp.kappung.text : '')]);
    if (pp && pp.neuvermietung && zahl(pp.neuvermietung.barwert_eur) && pp.neuvermietung.barwert_eur > 0)
      hebel.push(['Bei Mieterwechsel', sEur(pp.neuvermietung.barwert_eur) + ' Barwert', saetze(pp.neuvermietung.satz, 1)]);
    if (S && S.zb && zahl(S.zb.kosten) && S.zb.kosten > 0)
      hebel.push(['Modernisierung und Zielbild', eur(S.zb.kosten) + ' Maßnahmen', (pp.massnahmen_herkunft && pp.massnahmen_herkunft.text ? pp.massnahmen_herkunft.text + ' ' : '')
        + (zahl(S.zb._zuw) ? 'Wertzuwachs nach Kosten ' + sEur(S.zb._zuw) + '.' : '')]);
    if (d.auf) {
      if (d.auf.gesperrt) hebel.push(['Aufteilung in Eigentumswohnungen', 'nicht gerechnet', String(d.auf.gesperrt)]);
      else if (zahl(d.auf.wert)) hebel.push(['Aufteilung in Eigentumswohnungen', eur(d.auf.wert), (d.auf.n ? d.auf.n + ' Wohnungen einzeln, ' : '') + (d.auf.bezeichnung || 'Vergleichswert') + ' führend' + (zahl(d.auf.kosten) && d.auf.kosten > 0 ? ', nach ' + eur(d.auf.kosten) + ' Aufteilungskosten' : '') + '.']);   /* v3334a · ohne bekannte Kosten keine „0 €“ */
    }
    if (d.im && d.im.zeile) hebel.push(['Indexmiete', 'Indexvertrag', String(d.im.zeile)]);
    if (hebel.length) h += karte(kopf('Deine Hebel') + '<div class="dp-pap-hebel">' + hebel.map(function (x) {
      return '<div class="dp-pap-h"><small>' + esc(x[0]) + '</small><b>' + esc(x[1]) + '</b>' + (x[2] ? '<p>' + esc(x[2]) + '</p>' : '') + '</div>';
    }).join('') + '</div>', 'dp-pa4-mt');
    /* Ohne Soll-Miete und Zielbild: was eingetragen werden muss, und was rechtlich gilt */
    if (!S) {
      var mfh = false; try { mfh = !!(window.DpMfhEinheiten && window.DpMfhEinheiten.artMitEinheiten && window.DpMfhEinheiten.artMitEinheiten()); } catch (e) {}
      h += karte(kopf('Noch kein Potenzial erfasst') + '<p class="dp-pa-p">Hier steht, was in dem Objekt steckt: die Miete nach Mieterhöhung, das Zielbild nach Modernisierung oder Neuvermietung und – bei einem Haus mit mehreren Wohnungen – die Aufteilung. '
        + 'Dafür fehlen noch die Soll-Miete und das Zielbild. ' + (mfh ? 'Bei einem Haus mit Einheiten trägst du beides je Wohnung ein (Einheiten erfassen › Details).' : 'Trag sie im Reiter Objekt in der Karte „Mieterhöhung und Zielbild“ ein.') + '</p>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
        + (mfh ? '<button type="button" class="btn-clean dp-pa4-btn" onclick="try{DpMfhEinheiten.oeffnen(1)}catch(e){}">Einheiten erfassen öffnen</button>' : '')
        + '<button type="button" class="btn-clean dp-pa4-btn leise" onclick="try{switchTab(0)}catch(e){}">Zum Reiter Objekt</button></div>');
    }
    if (d.mr && Array.isArray(d.mr.zeilen) && d.mr.zeilen.length)
      h += karte(kopf('Was rechtlich gilt') + '<div class="dp-pap-mr">' + d.mr.zeilen.map(function (z) {
        return '<div><span>' + esc(z.k) + '</span><p style="margin:0"' + (z.warn ? ' class="w"' : '') + '><b>' + esc(z.v) + '</b>' + (z.u ? ' – ' + esc(z.u) : '') + '</p></div>';
      }).join('') + '</div>', 'dp-pa4-mt');
    /* Der Absatz des Piloten: Einfach zwei ganze Sätze, Detail ganz */
    if (hatText) h += karte(kopf('Was der Pilot dazu sagt') + '<p class="dp-pa-p dp-pa-e">' + txt(saetze(a.potenzial_text, 2)) + '</p><p class="dp-pa-p dp-pa-d">' + txt(a.potenzial_text) + '</p>', 'dp-pa4-mt');
    /* Detail: Rechenwege und je Wohnung */
    if (pp) {
      var rw = [];
      if (pp.mieterhoehung_rechenweg && pp.mieterhoehung_rechenweg.satz) rw.push(['Mieterhöhung', pp.mieterhoehung_rechenweg.satz]);
      if (pp.miete_nach_modernisierung && pp.miete_nach_modernisierung.satz) rw.push(['Miete nach Modernisierung', pp.miete_nach_modernisierung.satz]);
      if (pp.neuvermietung && pp.neuvermietung.satz) rw.push(['Mieterwechsel', pp.neuvermietung.satz]);
      if (pp.ertragswert_basis) rw.push(['Ertragswert je Stufe', pp.ertragswert_basis]);
      if (pp.sanierung_regel) rw.push(['Sanierung aus dem Ankauf', pp.sanierung_regel]);
      if (pp.kennzeichnung) rw.push(['Einordnung', pp.kennzeichnung]);
      if (rw.length) h += '<div class="dp-pa-d">' + karte(kopf('So ist gerechnet') + rw.map(function (x) { return '<div class="dp-pa-kv"><strong>' + esc(x[0]) + ':</strong> ' + esc(x[1]) + '</div>'; }).join(''), 'dp-pa4-mt') + '</div>';
      var W = Array.isArray(pp.wohnungen) ? pp.wohnungen : [];
      if (W.length > 1) h += '<div class="dp-pa-d">' + karte(kopf('Je Wohnung') + '<div class="dp-pap-tab"><table><thead><tr><th>Wohnung</th><th>Fläche</th><th>Ist</th><th>nach § 558</th><th>Zielbild</th><th>Maßnahmen</th><th>Wann</th></tr></thead><tbody>'
        + W.map(function (w) {
          var s = zahl(w.soll) ? w.soll : (zahl(w.soll558) ? w.soll558 : null);
          return '<tr><td>' + esc((w.nr ? 'Nr. ' + w.nr : '') + (w.lage ? ' · ' + w.lage : '')) + '</td><td>' + (zahl(w.wfl) ? Math.round(w.wfl) + ' m²' : '–') + '</td><td>' + (zahl(w.ist) ? eur(w.ist) : (w.status === 'leer' ? 'leer' : '–')) + '</td>'
            + '<td>' + (s != null ? eur(s) : '–') + '</td><td>' + (zahl(w.ziel) ? eur(w.ziel) : '–') + '</td><td>' + (zahl(w.kosten) && w.kosten > 0 ? eur(w.kosten) : '–') + '</td><td class="l">' + esc(w.soll_ab || w.ziel_wann || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>', 'dp-pa4-mt') + '</div>';
    }
    return h;
  }

  /* Der Ertragswert je Stufe kommt oft erst NACH dem Zeichnen (potenzial.js rechnen() → Ereignis dp:potenzial).
     Gemessen 12.11.2026: beim ersten Öffnen fehlte die Stufe „Nach Mieterhöhung“ samt Ertragswert. Dann neu zeichnen –
     und ebenso beim Öffnen des Reiters. */
  function neuZeichnen() {
    Array.prototype.forEach.call(document.querySelectorAll('.dp-pa-wrap[data-dp-pa-v4] #dp-pa-pot'), function (p) {
      try { var w = p.closest('.dp-pa-wrap'); var h = html(window._dpPaLetzte || {}, !!(w && w.classList.contains('dp-pa-bestand'))); if (h) p.innerHTML = h; } catch (e) {}
    });
    try { if (window.DpPilotV4 && window.DpPilotV4.wegNeu) window.DpPilotV4.wegNeu(); } catch (e) {}
  }
  ['dp:potenzial', 'dp:potenzial-markt'].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(neuZeichnen, 0); }); });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('.dp-pa-wrap[data-dp-pa-v4] .dp-pa-rail .dp-pa-tab') : null;
    if (t && (t.getAttribute('onclick') || '').indexOf("'pot'") >= 0) setTimeout(neuZeichnen, 0);
  });

  window.DpPaPotenzial = { VERSION: 'v3323', html: html, kurz: kurz, daten: daten, neuZeichnen: neuZeichnen };
})();
