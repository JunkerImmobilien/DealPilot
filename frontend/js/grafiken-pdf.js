/* ═══════════════════════════════════════════════════════════════════════
   grafiken-pdf.js · v4370 — die Karten der Pilot-Analyse für die PDFs

   Marcel 24.11.2026: Kurzfassung (~8 Seiten), Kompakt (~15) und Vollständig,
   „mit den neuen Grafiken“. Die Dokumente (dp-dokumente.js) sind HTML, das
   der PDF-Dienst druckt (Chromium, ohne Skript). Deshalb werden hier dieselben
   Karten wie in der Pilot-Analyse (grafiken-premium.js) offscreen in fester
   Breite gezeichnet, ohne Bewegung (gx-still), und als HTML zurückgegeben,
   samt Stilblatt (dp-gx-stil) und den Whitelabel-Tokens des Dokuments.
   Gerechnet wird nichts neu: MODELL.basis() und dieselben Kartenfunktionen.

   Farben im Dokument: --gx-* sind im Stilblatt mit festen Werten belegt
   (#2A2727, #3FA56C, #B8625C, Fläche #F8F6F1); Gold kommt über die
   --wl-*-Tokens, die hier aus dem <html> der App ins Dokument kopiert werden.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpGrafikenPdf) return;

  /* Marktberichte des Objekts wie ui.js _dpLoadVerlauf (Wertverlauf, Markt, Lage), nur wenn die Pilot-Analyse sie noch nicht geladen hat */
  function histLaden(I) {
    var h = I.hist(); if (h && h.length) return Promise.resolve(h);
    var key = typeof window._currentObjKey === 'string' ? window._currentObjKey : null;
    if (!key || !window.Auth || !Auth.apiCall) return Promise.resolve([]);
    return Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + key), { method: 'GET' }).then(function (d) {
      var hist = ((d && d.history) || []).filter(function (x) { return x && x.market_value != null; });
      hist.forEach(function (x) {
        delete x.deal_score;
        var ab = x.angebot_abschlag_pct != null && x.angebot_abschlag_pct !== '' ? Number(x.angebot_abschlag_pct) : null;
        x.abschlag_pct = ab != null && isFinite(ab) ? ab : 0;
        x.mpi_ohne_abschlag = x.market_value_roh != null ? Number(x.market_value_roh) : (!(ab > 0) ? Number(x.market_value) : null);
        x.mpi_nach_abschlag = ab > 0 ? Number(x.market_value) : null;
      });
      I.hist(hist); return hist;
    }).catch(function () { return []; });
  }

  function tokens() {
    var s = document.documentElement.style, out = [];
    for (var i = 0; i < s.length; i++) { var n = s[i]; if (/^--wl-/.test(n)) out.push(n + ':' + s.getPropertyValue(n)); }
    return out.length ? ':root{' + out.join(';') + '}' : '';
  }

  /* Dokument-Regeln: Karte als Block, keine Seitenumbrüche darin, Tooltips und Umschalter aus */
  var DOK = [
    '.dp-gx{break-inside:avoid;page-break-inside:avoid;margin:0 0 4mm!important;--surface:#F8F6F1}',
    '.dp-gx.dp-gx-frei{background:#F8F6F1!important;border:1px solid color-mix(in srgb,#2A2727 10%,transparent)!important;border-radius:3mm!important;padding:4mm 4.5mm 3.5mm!important}',
    '.dp-gx .gx-tip,.dp-gx .dp-gn-seg,.dp-gx button{display:none!important}',
    '.dp-gx .gx-t{font-size:12pt!important}.dp-gx .gx-s{font-size:8.2pt!important;margin-bottom:2.5mm!important;text-align:left;hyphens:manual}',
    '.dp-gx .gx-fuss{font-size:7.4pt!important}.dp-gx .gx-leg{font-size:7.6pt!important}',
    '.gx-pdf-klein .dp-gx svg{max-height:60mm}',
    '.dp-gx-paar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4mm;break-inside:avoid}.dp-gx-paar>.dp-gx{margin:0!important}'
  ].join('\n');

  /**
   * namen: Liste aus fahrplan, einordnung, ziel, finger, heat, heatKompakt, mieteuro, faecher, hebel, ausstieg, steuer, hausgeld, wertverlauf, markt, lage
   * opt.breite: Pixelbreite der Karte (Standard 660 = 176 mm Satzspiegel), opt.halb: Breite für Kartenpaare
   * Ergebnis: { css, html: { name: '<div class="dp-gx …">…</div>' } } - fehlende oder leere Karten fehlen im Objekt
   */
  function karten(namen, opt) {
    opt = opt || {};
    var PR = window.DpGrafikenPremium, I = PR && PR._pdf, M = window.DpGrafiken && window.DpGrafiken.modell;
    if (!I || !M) return Promise.resolve(null);
    /* v4370e · opt.ohneBericht: der letzte Bericht passt nicht zum Objektstand, keine Zahl aus ihm (Wertverlauf ohne Punkte, kein Markt, keine Lage, Einordnung ohne Objektwert) */
    var altHist = I.hist().slice();
    return (opt.ohneBericht ? Promise.resolve(I.hist([])) : histLaden(I)).then(function () {
      var P = null; try { P = M.basis(); } catch (e) { P = null; }
      if (!P) return null;
      I.stil();
      var C = I.cache(P, 'pdf|' + (window._currentObjKey || '') + '|' + JSON.stringify(P.J.map(function (r) { return [r.j, r.cfop, r.cfns, r.rs, r.wert]; })));
      var buehne = document.createElement('div');
      buehne.setAttribute('aria-hidden', 'true');
      buehne.style.cssText = 'position:fixed;left:-12000px;top:0;width:' + (opt.breite || 660) + 'px;pointer-events:none';
      document.body.appendChild(buehne);
      var html = {};
      try {
        (namen || []).forEach(function (n) {
          var halb = opt.halb && opt.halb.indexOf(n) >= 0, w = halb ? Math.round(((opt.breite || 660) - 15) / 2) : (opt.breite || 660);
          var k = document.createElement('div'); k.className = 'dp-gn dp-gx dp-gx-frei gx-still'; k.style.width = w + 'px';
          buehne.appendChild(k);
          var F = I.karten[n === 'heatKompakt' ? 'heat' : n];
          if (!F) return;
          try {
            if (n === 'einordnung') F(k, w, true);
            else if (n === 'heat') F(k, w, P, C, false);
            else if (n === 'heatKompakt') F(k, w, P, C, true);
            else F(k, w, P, C);
          } catch (e) { try { console.warn('[grafiken-pdf]', n, e); } catch (x) {} return; }
          if (opt.ohneBericht && n === 'einordnung') [].forEach.call(k.querySelectorAll('.gx-bz'), function (z) { var t = z.querySelector('.n'); if (t && /^Objektwert/.test(String(t.textContent || '').trim())) z.remove(); });
          if (opt.ohneBericht && (n === 'markt' || n === 'lage')) return;
          if (!k.innerHTML.trim()) return;
          k.classList.add('gx-still');
          [].forEach.call(k.querySelectorAll('[data-gx-tip]'), function (e) { e.removeAttribute('data-gx-tip'); });
          [].forEach.call(k.querySelectorAll('.gx-tip'), function (e) { e.remove(); });
          k.style.width = '';
          html[n] = k.outerHTML;
        });
      } finally { buehne.remove(); if (opt.ohneBericht) I.hist(altHist); }
      var st = document.getElementById('dp-gx-stil');
      return { css: tokens() + (st ? st.textContent : '') + '\n' + DOK, html: html };
    });
  }

  /* v4370e · Marcel 24.11.2026: „da hast du den alten Marktbericht genommen … das kannst du so nicht angeben“.
     Gemessen Demostraße 5: der letzte (einzige) Bericht 616 vom 24.11.2026 trägt den Wertermittlungsstichtag 01.03.2024
     (eigene Angabe = Kaufdatum), das Objekt ist im Bestand. Ein Bericht passt nur, wenn er zum heutigen Objektstand gehört:
     im Bestand Stichtag im laufenden Jahr, gleiche Wohnfläche und gleiches Baujahr, Ist-Miete je m² (Wohnung) höchstens
     2 % daneben. Sonst: keine Wertzahl aus ihm im PDF, kein Anhang, Hinweis „Marktbericht neu abrufen“. */
  function feldZahl(id) { var e = document.getElementById(id); if (!e) return null; var t = String(e.value || '').trim().replace(/\./g, '').replace(',', '.'); var n = parseFloat(t); return isFinite(n) ? n : null; }
  function berichtPruefen(h) {
    if (!h) return { ok: false, grund: 'Zu diesem Objekt gibt es noch keinen Marktbericht.' };
    var st = h.wertermittlungsstichtag, sd = null;
    try { var so = typeof st === 'string' ? JSON.parse(st) : st; sd = so && so.datum ? so.datum : null; } catch (e) { sd = typeof st === 'string' && /^\d{4}-\d{2}-\d{2}/.test(st) ? st.slice(0, 10) : null; }
    var stJahr = sd ? Number(sd.slice(0, 4)) : null, stDe = sd ? sd.slice(8, 10) + '.' + sd.slice(5, 7) + '.' + sd.slice(0, 4) : '';
    var bestand = false; try { bestand = !!(window.DpBestand && DpBestand.istBestand()); } catch (e) {}
    var heute = new Date().getFullYear(), gruende = [];
    if (bestand && stJahr && stJahr < heute) gruende.push('Stichtag ' + stDe + ' statt ' + heute);
    var wfl = feldZahl('wfl'), bj = feldZahl('baujahr');
    if (wfl && h.living_area != null && Math.abs(Number(h.living_area) - wfl) > 0.5) gruende.push('Wohnfläche ' + Number(h.living_area) + ' statt ' + wfl + ' m²');
    if (bj && h.build_year != null && Number(h.build_year) !== bj) gruende.push('Baujahr ' + h.build_year + ' statt ' + bj);
    var nkm = feldZahl('nkm'), istQm = (nkm && wfl) ? nkm / wfl : null, art = String((document.getElementById('objart') || {}).value || '');
    if (art === 'ETW' && istQm && h.ew_miete_ist_qm != null && Math.abs(Number(h.ew_miete_ist_qm) - istQm) / istQm > 0.02) gruende.push('Ist-Miete ' + String(Number(h.ew_miete_ist_qm).toFixed(2)).replace('.', ',') + ' statt ' + String(istQm.toFixed(2)).replace('.', ',') + ' €/m²');
    var datum = new Date(h.created_at).toLocaleDateString('de-DE');
    return gruende.length ? { ok: false, bericht: h, grund: 'Der letzte Marktbericht vom ' + datum + ' passt nicht zum heutigen Objektstand (' + gruende.join(', ') + '). Bitte im Reiter Bewertung den Marktbericht neu abrufen.' }
      : { ok: true, bericht: h, grund: 'Bericht vom ' + datum + (stDe ? ', Stichtag ' + stDe : '') };
  }
  function letzterBericht(key) {
    key = key || window._currentObjKey;
    if (!key || !window.Auth || !Auth.apiCall) return Promise.resolve(null);
    return Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + key), { method: 'GET' }).then(function (d) {
      var h = ((d && d.history) || []).filter(function (x) { return x && x.report_id; });
      h.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      return h.length ? h[h.length - 1] : null;
    }).catch(function () { return null; });
  }

  window.DpGrafikenPdf = { VERSION: 'v4370e', karten: karten, berichtPruefen: berichtPruefen, letzterBericht: letzterBericht };
})();
