/* ════════════════════════════════════════════════════════════════════
   v1450 · STEUERN: EIGENER AfA-SATZ UND RESTNUTZUNGSDAUER
   ════════════════════════════════════════════════════════════════════
   Backlog v22 Punkt 22 (Konzept design/Vorschlaege/afa-rnd-gutachten.md,
   Teile A und B). Gemessen: #afa_satz bot nur feste Werte (2,0 / 2,5 / 3,0 /
   5,0 degressiv); ein eigener Satz nach § 7 Abs. 4 Satz 2 EStG (kuerzere
   Nutzungsdauer, Nachweis per Gutachten) war nicht moeglich, und das
   Ergebnis des RND-Wizards kam nie im Steuer-Tab an.

   So geloest, dass KEIN Leser von #afa_satz geaendert werden muss:
   der eigene Satz wird als ZAHL-Option in die Auswahl gelegt und gewaehlt
   (Afa.parseSelectValue versteht jede Zahl als lineare AfA). calc.js,
   tax.js und das BMF-Fenster rechnen damit unveraendert weiter.
   Gespeichert werden Satz, Grundlage und RND in eigenen Feldern
   (storage.js FIELDS); beim Laden wird die Option wieder angelegt.
   Ein eigener Satz wird nie von einer Automatik ueberschrieben: nur der
   Nutzer setzt ihn, nur der Nutzer nimmt ihn zurueck.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function zahl(s) { s = String(s == null ? '' : s).trim(); if (!s) return null; var n = (typeof window.parseDe === 'function') ? window.parseDe(s) : parseFloat(s.replace(',', '.')); return isFinite(n) && n > 0 ? n : null; }
  function fmt(n, d) { return n.toFixed(d).replace('.', ','); }

  function aufbauen() {
    var sel = el('afa_satz'); if (!sel || el('afa-eigen-box')) return !!sel;
    var grp = document.createElement('optgroup'); grp.label = 'Eigener Satz (§ 7 Abs. 4 Satz 2 EStG)'; grp.id = 'afa-eigen-grp';
    var o = document.createElement('option'); o.value = 'eigen'; o.textContent = 'Eigenen Satz / Restnutzungsdauer eingeben …';
    grp.appendChild(o); sel.appendChild(grp);
    var f = sel.closest('.f');
    var box = document.createElement('div'); box.id = 'afa-eigen-box'; box.hidden = true;
    box.style.cssText = 'margin-top:8px;padding:10px 12px;border:1px solid var(--line,#E6E0D3);border-radius:8px;background:#FBFAF7';
    box.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px">' +
        '<label style="font-size:12px">Restnutzungsdauer (Jahre)<input id="afa_rnd_jahre" type="text" inputmode="decimal" placeholder="z. B. 34" class="tr" style="width:100%"></label>' +
        '<label style="font-size:12px">AfA-Satz (%)<input id="afa_eigen" type="text" inputmode="decimal" placeholder="z. B. 2,94" class="tr" style="width:100%"></label>' +
        '<label style="font-size:12px;grid-column:1/-1">Grundlage<input id="afa_eigen_grundlage" type="text" placeholder="z. B. Gutachten Gutachten.org vom 03/2026" style="width:100%"></label>' +
      '</div>' +
      '<div class="cf-hint" id="afa-eigen-hinweis" style="margin-top:6px">Eine eingetragene Restnutzungsdauer ergibt den Satz: 100 ÷ RND. Das Finanzamt verlangt dafür einen Nachweis (Gutachten).</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
        '<button type="button" class="btn btn-outline btn-sm" id="afa-rnd-ermitteln">Restnutzungsdauer ermitteln</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="afa-rnd-letzte" hidden>Letzte Ermittlung übernehmen</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="afa-gutachten">Gutachten anfragen (Gutachten.org)</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="afa-eigen-weg" style="margin-left:auto">Eigenen Satz entfernen</button>' +
      '</div>';
    (f || sel.parentNode).appendChild(box);

    sel.addEventListener('change', function () { if (sel.value === 'eigen') { box.hidden = false; letzteZeigen(); var e = el('afa_rnd_jahre'); if (e) e.focus(); } else if (!istEigen(sel.value)) box.hidden = true; });
    el('afa_rnd_jahre').addEventListener('input', function () { var r = zahl(this.value); if (r) { el('afa_eigen').value = fmt(100 / r, 2); anwenden(); } });
    el('afa_eigen').addEventListener('input', anwenden);
    el('afa_eigen_grundlage').addEventListener('input', anwenden);
    el('afa-rnd-ermitteln').onclick = function () { var D = window.DealPilotDealAction; if (D && D.openExpertWithRnd) D.openExpertWithRnd(); };
    el('afa-gutachten').onclick = function () { if (window.DpGutachtenOrg) window.DpGutachtenOrg.anfragen(window._lastRndResult || { result: { final_rnd: zahl(el('afa_rnd_jahre').value) } }); };
    el('afa-rnd-letzte').onclick = function () {
      var r = window._lastRndResult && window._lastRndResult.result && window._lastRndResult.result.final_rnd;
      if (r) { el('afa_rnd_jahre').value = fmt(r, 0); el('afa_eigen').value = fmt(100 / r, 2); if (!el('afa_eigen_grundlage').value) el('afa_eigen_grundlage').value = 'RND-Ermittlung DealPilot (indikativ)'; anwenden(); }
    };
    el('afa-eigen-weg').onclick = function () {
      ['afa_eigen', 'afa_eigen_grundlage', 'afa_rnd_jahre'].forEach(function (id) { el(id).value = ''; });
      entfernen(); sel.value = '2.0'; box.hidden = true; sel.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof window.calc === 'function') window.calc();
    };
    return true;
  }
  function letzteZeigen() { var b = el('afa-rnd-letzte'); if (b) b.hidden = !(window._lastRndResult && window._lastRndResult.result && window._lastRndResult.result.final_rnd); }
  function istEigen(v) { var o = el('afa_satz') && el('afa_satz').querySelector('option[data-eigen]'); return !!(o && o.value === v); }
  function entfernen() { var o = el('afa_satz') && el('afa_satz').querySelector('option[data-eigen]'); if (o) o.remove(); }

  /* Den eigenen Satz als Zahl-Option setzen und waehlen. */
  function anwenden() {
    var sel = el('afa_satz'), satz = zahl(el('afa_eigen') && el('afa_eigen').value);
    var h = el('afa-eigen-hinweis');
    if (!sel) return;
    if (!satz || satz < 0.5 || satz > 33.4) { if (h && satz) h.textContent = 'Ein AfA-Satz zwischen 0,5 und 33,3 % ist plausibel (Nutzungsdauer 3 bis 200 Jahre).'; return; }
    var wert = String(Math.round(satz * 100) / 100);
    var o = sel.querySelector('option[data-eigen]');
    if (!o) { o = document.createElement('option'); o.setAttribute('data-eigen', '1'); el('afa-eigen-grp').insertBefore(o, el('afa-eigen-grp').firstChild); }
    o.value = wert;
    var grund = String(el('afa_eigen_grundlage').value || '').trim();
    o.textContent = fmt(satz, 2) + ' % eigener Satz' + (grund ? ' — ' + grund : '');
    sel.value = wert;
    if (h) h.textContent = 'Gerechnet wird mit ' + fmt(satz, 2) + ' % linear' + (zahl(el('afa_rnd_jahre').value) ? ' (Nutzungsdauer ' + fmt(zahl(el('afa_rnd_jahre').value), 0) + ' Jahre)' : '') + '. Grundlage: ' + (grund || 'bitte angeben') + '.';
    if (typeof window.calc === 'function') window.calc();
  }
  /* Nach dem Laden: gespeicherten eigenen Satz wiederherstellen. storage.js
     setzt afa_satz auf eine Zahl, die es als Option noch nicht gibt - die
     Auswahl faellt dann leer; hier wird die Option angelegt und gewaehlt. */
  function wiederherstellen() {
    if (!aufbauen()) return;
    var satz = zahl(el('afa_eigen') && el('afa_eigen').value);
    if (satz) { el('afa-eigen-box').hidden = false; anwenden(); }
    else { entfernen(); var sel = el('afa_satz'); if (sel && (!sel.value || sel.value === 'eigen')) { sel.value = '2.0'; } el('afa-eigen-box').hidden = true; }
  }
  window.addEventListener('dp:object-ready', function () { setTimeout(wiederherstellen, 150); });
  function start() { if (!aufbauen()) setTimeout(start, 400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.DpAfaEigen = { anwenden: anwenden, wiederherstellen: wiederherstellen };
})();
