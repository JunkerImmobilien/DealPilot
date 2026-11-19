/* hausgeld-positionen.js · v3860 · Zusammensetzung des Hausgelds aus dem Wirtschaftsplan
 *
 * Marcel 19.11.2026 (Hinweis seines Steuerberaters): „können wir die umlagefähigen und nicht umlagefähigen Kosten
 * noch untergliedern? Wenn wir einen Wirtschaftsplan eingelesen haben, dass wir das aufklappen und die
 * Zusammensetzung sehen."
 *
 * Daten: verstecktes Feld #hg_pos (JSON), geschrieben beim Einlesen des Plans (dokument-import.js
 * _abgleichHausgeld, Haken „Aufstellung des Hausgelds"): { jahr, art, wie, p: [{ b: Bezeichnung, e: Euro im Jahr
 * (Anteil des Objekts), u: 1 umlagefähig | 0 nicht | null offen }] }. Reine Anzeige, rechnet nichts - die Summen in
 * hg_ul / hg_nul bleiben die Eingabe, die zählt. Weicht die Summe der Positionen ab, steht es da. Kundentext nur
 * mit Punkt und Komma.
 */
(function () {
  'use strict';
  if (window.DpHausgeldPositionen) return;
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return Math.round(x).toLocaleString('de-DE') + ' €'; }
  function zahl(v) { var n = typeof window.parseDe === 'function' ? window.parseDe(String(v == null ? '' : v)) : parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function daten() {
    var f = el('hg_pos'); if (!f || !f.value) return null;
    try { var d = JSON.parse(f.value); return d && Array.isArray(d.p) && d.p.length ? d : null; } catch (e) { return null; }
  }
  function stil() {
    if (el('dp-hgp-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-hgp-stil';
    s.textContent = [
      '.dp-hgp{margin:0 0 14px;border:1px solid var(--border,#E6E0D3);border-radius:12px;padding:10px 14px;background:var(--surface,#fff)}',
      '.dp-hgp>summary{cursor:pointer;font:600 13.5px "Space Grotesk",sans-serif;list-style:none;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}',
      '.dp-hgp>summary::-webkit-details-marker{display:none}',
      '.dp-hgp>summary small{font:400 11.5px Inter,sans-serif;color:#7A7370}',
      '.dp-hgp>summary::after{content:"aufklappen";margin-left:auto;font:400 11.5px Inter,sans-serif;color:#7A7370}',
      '.dp-hgp[open]>summary::after{content:"einklappen"}',
      '.dp-hgp-gr{margin-top:10px}.dp-hgp-gr h4{margin:0 0 4px;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#7A7370}',
      '.dp-hgp-z{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-top:1px solid #F1ECE1;font-size:12.5px;font-variant-numeric:tabular-nums}',
      '.dp-hgp-s{font-weight:600}',
      '.dp-hgp-hin{font-size:11.5px;color:#7A7370;margin-top:8px;line-height:1.45}'
    ].join('');
    document.head.appendChild(s);
  }
  function html(d) {
    var gr = [[1, 'Umlagefähig, auf den Mieter umlegbar', 'hg_ul'], [0, 'Nicht umlagefähig', 'hg_nul'], [null, 'Ohne Zuordnung im Plan', null]];
    var summe = 0;
    var teile = gr.map(function (g) {
      var L = d.p.filter(function (x) { return x.u === g[0]; }); if (!L.length) return '';
      var s = L.reduce(function (a, x) { return a + (Number(x.e) || 0); }, 0); summe += s;
      var feld = g[2] ? zahl((el(g[2]) || {}).value) : 0;
      var abw = g[2] && feld > 0 && Math.abs(feld - s) >= 1
        ? '<div class="dp-hgp-hin">Im Feld steht ' + eur(feld) + '. ' + (g[2] === 'hg_nul' ? 'Dort ist die Zuführung zur Rücklage mit drin, in den Positionen meist nicht. ' : '') + 'Es zählt das Feld.</div>' : '';
      return '<div class="dp-hgp-gr"><h4>' + esc(g[1]) + '</h4>' + L.map(function (x) { return '<div class="dp-hgp-z"><span>' + esc(x.b) + '</span><span>' + eur(Number(x.e) || 0) + '</span></div>'; }).join('')
        + '<div class="dp-hgp-z dp-hgp-s"><span>Summe</span><span>' + eur(s) + '</span></div>' + abw + '</div>';
    }).join('');
    return '<details class="dp-hgp"><summary>Zusammensetzung des Hausgelds <small>' + esc(d.art || 'Wirtschaftsplan') + (d.jahr ? ' ' + esc(d.jahr) : '') + ', ' + d.p.length + ' Positionen, ' + eur(summe) + ' im Jahr</small></summary>'
      + teile + '<div class="dp-hgp-hin">Aus dem eingelesenen Plan. ' + esc(d.wie || '') + (d.wie ? '. ' : '') + 'Reine Aufstellung, gerechnet wird mit den Feldern oben.</div></details>';
  }
  function zeichnen() {
    var h = el('hg-pos-box'); if (!h) return;
    var d = daten();
    if (!d) { h.innerHTML = ''; return; }
    stil();
    var auf = h.querySelector('details') ? h.querySelector('details').open : false;
    h.innerHTML = html(d);
    if (auf) h.querySelector('details').open = true;
  }
  document.addEventListener('change', function (e) { var id = e.target && e.target.id; if (id === 'hg_pos' || id === 'hg_ul' || id === 'hg_nul') zeichnen(); });
  window.addEventListener('dp:object-ready', function () { setTimeout(zeichnen, 300); });
  if (document.readyState !== 'loading') setTimeout(zeichnen, 0); else document.addEventListener('DOMContentLoaded', zeichnen);
  window.DpHausgeldPositionen = { zeichnen: zeichnen, daten: daten, html: html };
})();
