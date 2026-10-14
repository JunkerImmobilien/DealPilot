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
 *   2. unter „Mietausfall-Risiko" (seit v2220, vorher unter „Leerstand p.a."):
 *      der MARKTAKTIVE Leerstand als Anhalt für die Stufe des Dropdowns.
 *      Marcel am 14.10.2026: der Gesamtleerstand sei „eigentlich nichtssagend";
 *      bei der Parkstrasse standen 52,5 % der leeren Wohnungen seit über einem
 *      Jahr leer - Dauerleerstand, kein Mietausfall. Die Dauer-Liste entfällt.
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
      '.dp-zi-h{margin-top:6px;font-size:11.5px}',
      '.dp-zi-btn{margin-left:4px;padding:2px 8px;border-radius:6px;border:1px solid var(--wl-c9a84c,#C9A84C);background:transparent;color:inherit;font:600 11px Inter,system-ui,sans-serif;cursor:pointer}'
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

  /* v2220 · Stufe aus dem marktaktiven Leerstand. VORSCHLAG, keine amtliche
     Tabelle: angesetzt an der üblichen Fluktuationsreserve von 2-3 % (darunter
     wird eine frei werdende Wohnung schnell wieder vermietet). Die Schwellen
     stehen sichtbar im Kasten, damit sie geprüft werden können. */
  var STUFEN = [
    { bis: 1.5, wert: 'sehr_niedrig', wort: 'Sehr niedrig' },
    { bis: 3, wert: 'niedrig', wort: 'Niedrig' },
    { bis: 5, wert: 'mittel', wort: 'Mittel' },
    { bis: 8, wert: 'erhoeht', wort: 'Erhöht' },
    { bis: Infinity, wert: 'hoch', wort: 'Hoch' }
  ];
  function stufeAus(pctWert) { for (var i = 0; i < STUFEN.length; i++) if (pctWert < STUFEN[i].bis) return STUFEN[i]; return null; }
  function wortZu(wert) { for (var i = 0; i < STUFEN.length; i++) if (STUFEN[i].wert === wert) return STUFEN[i].wort; return null; }

  function leerHtml(z) {
    /* Gemeinde vor Kreis - aber je Kennzahl: fehlt der Gemeinde der marktaktive
       Wert, steht der Kreis da und heisst Kreis */
    var g = z.gemeinde, k = z.kreis;
    var b = (g && g.leerstandsquote_marktaktiv != null) ? g : (k && k.leerstandsquote_marktaktiv != null ? k : null);
    if (!b) return '';
    var wo = (b === g ? 'Gemeinde ' : 'Kreis ') + b.name;
    var st = stufeAus(Number(b.leerstandsquote_marktaktiv));
    var sel = $('ds2_mietausfall'), ist = sel ? sel.value : '';
    var o = zeile('Marktaktiver Leerstand ' + wo, pct(b.leerstandsquote_marktaktiv));
    if (st) o += zeile('Anhalt für das Risiko', st.wort);
    if (st) {
      if (!ist) o += '<div class="dp-zi-h">Noch keine Stufe gewählt. <button type="button" class="dp-zi-btn" data-wert="' + st.wert + '">„' + esc(st.wort) + '“ übernehmen</button></div>';
      else if (ist !== st.wert) o += '<div class="dp-zi-h">Deine Wahl „' + esc(wortZu(ist) || ist) + '“ weicht vom Zensus-Anhalt ab - begründbar z. B. durch Mieterstruktur oder Objektzustand. <button type="button" class="dp-zi-btn" data-wert="' + st.wert + '">„' + esc(st.wort) + '“ übernehmen</button></div>';
      else o += '<div class="dp-zi-h">Deine Wahl passt zum Zensus-Anhalt.</div>';
    }
    var lang = null;
    (b.leerstandsdauer || []).forEach(function (d) { if (/12 Monaten oder l/i.test(d.text)) lang = d.anteil_pct; });
    var gesamt = b.leerstandsquote != null ? 'Gesamtleerstand ' + pct(b.leerstandsquote) + (lang != null ? ', davon ' + pct(lang) + ' seit über einem Jahr leer (Dauerleerstand, kein Mietausfall)' : '') + '. ' : '';
    return '<div class="dp-zi" id="dp-zi-leer"><div class="dp-zi-k">Zensus 2022 · Leerstand am Markt</div>' + o
      + '<div class="dp-zi-f">Marktaktiv = leere Geschosswohnungen, die kurzfristig vermietbar wären. '
      + 'Stufen: unter 1,5 % sehr niedrig · unter 3 % niedrig · unter 5 % mittel · unter 8 % erhöht · darüber hoch. '
      + esc(gesamt) + 'Stichtag 15.05.2022, Lage der Gemeinde - nicht des Objekts. ' + esc(LIZENZ) + '</div></div>';
  }

  function einsetzen(anker, id, html) {
    var alt = $(id); if (alt) alt.remove();
    if (!anker || !html) return;
    anker.insertAdjacentHTML('afterend', html);
  }

  function zeichnen() {
    var z = _daten;
    var mm = $('ds2_marktmiete'), ma = $('ds2_mietausfall');
    var fMiete = mm && mm.closest ? mm.closest('.f') : null;
    var fLeer = ma && ma.closest ? ma.closest('.f') : null;   /* v2220: am Mietausfall-Risiko */
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
    if (id === 'ds2_mietausfall' && _daten) zeichnen();   /* v2220: Vergleich mit der Wahl */
  });
  /* v2220 · übernehmen setzt nur das Dropdown und löst dessen eigenes change aus
     (Score, Speichern) - wie eine Hand-Auswahl */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.dp-zi-btn') : null;
    var sel = $('ds2_mietausfall');
    if (!b || !sel) return;
    sel.value = b.getAttribute('data-wert');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spaeter); else spaeter();

  window.DealPilotZensusInfo = { laden: laden, daten: function () { return _daten; } };
})();
