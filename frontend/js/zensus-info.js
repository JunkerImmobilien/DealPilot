/* zensus-info.js — Zensus 2022 an den Feldern, wo er hilft (v2162, N62.4)
 *
 * Marcel am 13.10.2026: „im Tab Miete machen wir einmal eine Recherche, wie
 * so die Marktmiete dort ist. Vielleicht koennen wir das dann mit Census noch
 * erweitern, dass wir da auch noch Daten bekommen fuer die Groesse … Und wir
 * haben ja irgendwo auch, dass wir den Leerstand angeben. Ist das der
 * Leerstand, den wir auch meinen in der App?"
 *
 * Zwei Hinweise, keine Eingaben:
 *   1. unter „Marktmiete": die Zensus-BESTANDSMIETE der Gemeinde und des
 *      Kreises, passend zu Baujahr und Groesse des Objekts.
 *   2. unter „Leerstand p.a." (Investitionen): Leerstand und marktaktiver
 *      Leerstand, dazu wie lange die leeren Wohnungen schon leer stehen.
 *
 * Es wird NICHTS eingetragen. Die Bestandsmiete ist keine Marktmiete (alle
 * laufenden Vertraege am 15.05.2022, nicht Neuvermietung), und die
 * Leerstandsquote ist keine Mietausfallannahme — beides steht so daneben.
 * Kein Treffer heisst kein Wert: ist die Gemeinde gesperrt oder nicht
 * eindeutig, steht nur der Kreis da, und er heisst Kreis.
 */
(function () {
  'use strict';
  if (window.DealPilotZensusInfo) return;

  var LIZENZ = 'Quelle: Zensus 2022 (Stichtag 15.05.2022), © Statistische Ämter des Bundes und der Länder, '
    + 'Datenlizenz Deutschland – Namensnennung – 2.0';
  var _letzt = '', _timer = null, _daten = null;

  function $(id) { return document.getElementById(id); }
  function v(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function de(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return null;
    return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function eur(n) { var t = de(n, 2); return t ? t + ' €/m²' : null; }
  function pct(n) { var t = de(n, 1); return t ? t + ' %' : null; }

  function stil() {
    if ($('dp-zi-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-zi-stil';
    s.textContent = [
      '.dp-zi{margin-top:8px;padding:9px 11px;border:1px solid var(--border,rgba(0,0,0,.12));border-radius:8px;font:400 12px/1.5 Inter,system-ui,sans-serif}',
      '.dp-zi-k{font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-bottom:5px}',
      '.dp-zi-z{display:flex;justify-content:space-between;gap:10px}',
      '.dp-zi-z span:first-child{opacity:.8;min-width:0}',
      '.dp-zi-z b{white-space:nowrap}',
      '.dp-zi-f{margin-top:6px;font-size:10.5px;opacity:.65}',
      '.dp-zi-h{margin-top:6px;font-size:11.5px}'
    ].join('');
    document.head.appendChild(s);
  }

  function zeile(l, w) { return w ? '<div class="dp-zi-z"><span>' + esc(l) + '</span><b>' + esc(w) + '</b></div>' : ''; }

  function mieteHtml(z) {
    var g = z.gemeinde, k = z.kreis, o = '';
    if (g && g.nettokaltmiete_qm != null) o += zeile('Gemeinde ' + g.name, eur(g.nettokaltmiete_qm));
    /* kreisfreie Stadt: Gemeinde = Kreis, die Zeile stuende doppelt da */
    if (k && !(g && g.name === k.name && g.nettokaltmiete_qm === k.nettokaltmiete_qm)) o += zeile('Kreis ' + k.name, eur(k.nettokaltmiete_qm));
    function stufe(feld, wort) {
      var a = g && g[feld] && g[feld].wert != null ? g[feld] : null;
      var b = k && k[feld] && k[feld].wert != null ? k[feld] : null;
      if (!a && !b) return '';
      var kl = (a || b).klasse;
      return zeile(wort + ' ' + kl + (a ? ' (Gemeinde)' : ' (Kreis)'), eur((a || b).wert));
    }
    o += stufe('miete_baujahr', 'Baujahr');
    var n = parseInt(v('einheiten'), 10);
    o += stufe('miete_flaeche', n > 1 ? 'Ø Wohnung' : 'Größe');
    if (!o) return '';
    return '<div class="dp-zi" id="dp-zi-miete"><div class="dp-zi-k">Zensus 2022 · Bestandsmiete</div>' + o
      + '<div class="dp-zi-f">Durchschnitt aller laufenden Mietverträge am Stichtag — keine Angebots- '
      + 'oder Neuvertragsmiete, liegt daher meist darunter. ' + esc(LIZENZ) + '</div></div>';
  }

  function leerHtml(z) {
    var b = (z.gemeinde && z.gemeinde.leerstandsquote != null) ? z.gemeinde : z.kreis;
    if (!b) return '';
    var wo = b === z.gemeinde ? 'Gemeinde ' + b.name : 'Kreis ' + b.name;
    var o = zeile('Leerstand ' + wo, pct(b.leerstandsquote))
      + zeile('davon marktaktiv (Geschosswohnungen)', pct(b.leerstandsquote_marktaktiv));
    if (b.leerstandsdauer && b.leerstandsdauer.length) {
      o += '<div class="dp-zi-h">Wie lange die leeren Wohnungen leer stehen:</div>';
      b.leerstandsdauer.forEach(function (d) { o += zeile(d.text, pct(d.anteil_pct)); });
    }
    return '<div class="dp-zi" id="dp-zi-leer"><div class="dp-zi-k">Zensus 2022 · Leerstand</div>' + o
      + '<div class="dp-zi-h"><b>Nicht dasselbe wie „Leerstand p.a.":</b> das Feld hier ist deine Annahme für den '
      + 'Mietausfall pro Jahr. Der Zensus zählt alle leeren Wohnungen am Stichtag, auch die, die seit Jahren '
      + 'leer stehen. Als Anhalt taugt eher der marktaktive Wert.</div>'
      + '<div class="dp-zi-f">' + esc(LIZENZ) + '</div></div>';
  }

  function einsetzen(anker, id, html) {
    var alt = $(id); if (alt) alt.remove();
    if (!anker || !html) return;
    anker.insertAdjacentHTML('afterend', html);
  }

  function zeichnen() {
    var z = _daten;
    var mm = $('ds2_marktmiete'), ls = $('leerstand');
    var fMiete = mm && mm.closest ? mm.closest('.f') : null;
    var fLeer = ls && ls.closest ? ls.closest('.ass-row') : null;
    if (!z || !z.available) { einsetzen(null, 'dp-zi-miete'); einsetzen(null, 'dp-zi-leer'); return; }
    stil();
    einsetzen(fMiete, 'dp-zi-miete', mieteHtml(z));
    einsetzen(fLeer, 'dp-zi-leer', leerHtml(z));
  }

  function laden() {
    var plz = v('plz');
    if (!/^\d{5}$/.test(plz) || !window.Auth || !Auth.apiCall) { _daten = null; zeichnen(); return; }
    var q = 'plz=' + encodeURIComponent(plz) + '&ort=' + encodeURIComponent(v('ort'))
      + '&baujahr=' + encodeURIComponent(v('baujahr')) + '&wfl=' + encodeURIComponent(wflJeWohnung());
    if (q === _letzt && _daten) { zeichnen(); return; }
    _letzt = q;
    Auth.apiCall('/marktbericht/zensus/objekt?' + q, { method: 'GET' })
      .then(function (r) { if (q === _letzt) { _daten = r || null; zeichnen(); } })
      .catch(function () { if (q === _letzt) { _daten = null; zeichnen(); } });
  }

  /* v2162c · Die Zensus-Groessenklassen gelten JE WOHNUNG. Gemessen an einem
     MFH mit 12 Einheiten und 852 m²: es landete in „200 m² und mehr". Bei
     mehreren Einheiten zaehlt die mittlere Wohnungsgroesse. */
  function wflJeWohnung() {
    var w = Number(String(v('wfl')).replace(/\./g, '').replace(',', '.'));
    var n = parseInt(v('einheiten'), 10);
    if (!isFinite(w) || w <= 0) return '';
    return String(Math.round((n > 1 ? w / n : w) * 10) / 10);
  }

  function spaeter() { clearTimeout(_timer); _timer = setTimeout(laden, 700); }

  window.addEventListener('dp:object-ready', spaeter);
  document.addEventListener('change', function (e) {
    var id = e.target && e.target.id;
    if (id === 'plz' || id === 'ort' || id === 'baujahr' || id === 'wfl' || id === 'einheiten') spaeter();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spaeter); else spaeter();

  window.DealPilotZensusInfo = { laden: laden, daten: function () { return _daten; } };
})();
