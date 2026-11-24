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
    return histLaden(I).then(function () {
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
          if (!k.innerHTML.trim()) return;
          k.classList.add('gx-still');
          [].forEach.call(k.querySelectorAll('[data-gx-tip]'), function (e) { e.removeAttribute('data-gx-tip'); });
          [].forEach.call(k.querySelectorAll('.gx-tip'), function (e) { e.remove(); });
          k.style.width = '';
          html[n] = k.outerHTML;
        });
      } finally { buehne.remove(); }
      var st = document.getElementById('dp-gx-stil');
      return { css: tokens() + (st ? st.textContent : '') + '\n' + DOK, html: html };
    });
  }

  window.DpGrafikenPdf = { VERSION: 'v4370', karten: karten };
})();
