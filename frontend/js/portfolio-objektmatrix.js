/* v4690 · Portfolio-Cockpit: Objektmatrix (Demo 07, Marcel 25.11.2026: „Cockpit mit Demo 07“)
 *
 * Jedes Objekt als Karte, per Klick, Enter oder Leertaste umzudrehen.
 *   Vorderseite: Objektfoto (data._thumb), sonst Lagekarte mit Häuschen-Pin (lagekarte.js, eigene OSM-Kacheln),
 *                Score-Ring in der Stufenfarbe (score-tiers.js), Kernzahlen.
 *   Rückseite:   EK-Rendite in vier Stufen (ek-rendite-ui.js, Klick schaltet die Stufe, Tooltip mit Hebel),
 *                Finanzierung, Miete, Risiken. Nur Felder, zu denen es Daten gibt.
 * Gerechnet wird hier NICHTS: alle Zahlen kommen als Zeilen aus grafiken-portfolio.js (daten()),
 * dort aus DealPilotDashboard (portfolioPayload, blickDaten, ekr4Obj).
 */
(function () {
  'use strict';
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var GOLD = 'var(--wl-c9a84c, #C9A84C)', GRUEN = '#3FA56C', ROT = '#B8625C';
  var SORT = [
    { k: 'score', t: 'Score', f: function (r) { return r.score; } },
    { k: 'cfns', t: 'Cashflow nach Steuer', f: function (r) { return r.cfns; } },
    { k: 'ekr', t: 'EK-Rendite', f: function (r) { return r.ekr4 ? r.ekr4.haupt : null; } },
    { k: 'zb', t: 'Zinsbindung, bald zuerst', f: function (r) { var j = /^\d{4}/.test(String(r.bindEnde || '')) ? Number(String(r.bindEnde).slice(0, 4)) : null; return j == null ? null : -j; } },
    { k: 'name', t: 'Name', f: null }
  ];
  var _sort = 'score', _gedreht = {}, _karten = {};
  try { var s0 = sessionStorage.getItem('dp_om_sort'); if (s0 && SORT.some(function (x) { return x.k === s0; })) _sort = s0; } catch (e) {}

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function eur(v) { return nf0.format(Math.round(v)) + ' €'; }
  function eurV(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v))) + ' €'; }
  function kurz(v) { var a = Math.abs(v); return (v < 0 ? '−' : '') + (a >= 1e6 ? nf2.format(a / 1e6) + ' Mio €' : nf0.format(Math.round(a / 1000)) + ' T€'); }
  function pct(v, d) { return (d === 0 ? nf0 : d === 2 ? nf2 : nf1).format(v) + ' %'; }
  function da(v) { return v != null && isFinite(v); }
  function ton(v) { return !da(v) ? '' : v >= 0 ? 'om-plus' : 'om-minus'; }
  function monatJahr(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})/); return m ? m[2] + '/' + m[1] : null; }
  function jahreBis(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})/); if (!m) return null; var n = new Date(); return (Number(m[1]) - n.getFullYear()) + (Number(m[2]) - 1 - n.getMonth()) / 12; }

  function ring(score) {
    if (!da(score)) return '';
    var st = window.ScoreTier && ScoreTier.stufe ? ScoreTier.stufe(score) : null;
    var F = { top: '#2E7D50', green: GRUEN, gold: GOLD, red: ROT }, f = (st && F[st.farbe]) || GOLD;
    var u = 2 * Math.PI * 15, l = Math.max(0, Math.min(100, score)) / 100 * u;
    return '<svg class="om-ring" viewBox="0 0 36 36" role="img" aria-label="Score ' + Math.round(score) + (st ? ', ' + esc(st.wort) : '') + '">'
      + '<circle cx="18" cy="18" r="15" fill="none" stroke="var(--gx-linie2,#D9CFBC)" stroke-width="3"/>'
      + '<circle cx="18" cy="18" r="15" fill="none" stroke="' + f + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + l.toFixed(1) + ' ' + u.toFixed(1) + '" transform="rotate(-90 18 18)"/>'
      + '<text x="18" y="22.5" text-anchor="middle">' + Math.round(score) + '</text></svg>';
  }
  function adresse(r) {
    var str = [r.str, r.hnr].filter(Boolean).join(' ').trim(), ort = [r.plz, r.ort].filter(Boolean).join(' ').trim();
    return str && ort ? str + ', ' + ort : '';
  }
  function bild(r) {
    if (r.thumb && /^data:image\/|^https?:\/\/|^\//.test(String(r.thumb))) return '<div class="om-bild om-foto" style="background-image:url(\'' + esc(r.thumb) + '\')" role="img" aria-label="Foto ' + esc(r.name) + '"></div>';
    var a = adresse(r);
    var k = _karten[r.id];
    if (k && k.src) return '<div class="om-bild om-karte" style="background-image:url(\'' + k.src + '\')" role="img" aria-label="Lagekarte ' + esc(r.name) + '"></div>';
    return '<div class="om-bild om-leer" data-om-adr="' + esc(a) + '" data-om-id="' + esc(r.id) + '" aria-hidden="true"><span>' + (a ? 'Karte lädt' : 'kein Foto, keine Anschrift') + '</span></div>';
  }

  function vorn(r, ziel) {
    var zb = monatJahr(r.bindEnde), zbBald = jahreBis(r.bindEnde), ek = r.ekr4 && da(r.ekr4.haupt) ? r.ekr4.haupt : null;
    var dsTon = ziel && da(ziel.dscr) && da(r.dscr) ? (r.dscr >= ziel.dscr ? 'om-plus' : 'om-minus') : (da(r.dscr) && r.dscr < 1 ? 'om-minus' : '');
    var dl = [];
    var z = function (l, v, cls) { if (v == null) return; dl.push('<div class="om-z"><span>' + esc(l) + '</span><b class="' + (cls || '') + '">' + v + '</b></div>'); };
    z('CF vor St.', da(r.cfvs) ? eurV(r.cfvs / 12) : null, ton(r.cfvs));
    z('CF nach St.', da(r.cfns) ? eurV(r.cfns / 12) : null, ton(r.cfns));
    z('DSCR', da(r.dscr) ? nf2.format(r.dscr) : null, dsTon);
    z('Zins bis', zb, zbBald != null && zbBald <= 3 ? 'om-minus' : '');
    z('EK-Rendite', ek != null ? pct(ek, 1) : null, ton(ek));
    z('EK im Objekt', da(r.wert) && da(r.rest) ? kurz(r.wert - r.rest) : null, da(r.wert) && da(r.rest) && r.wert - r.rest < 0 ? 'om-minus' : '');
    var art = [r.ort, r.art, r.we > 1 ? r.we + ' WE' : ''].filter(Boolean).join(' · ');
    return bild(r) + '<div class="om-kopf"><div class="om-n">' + esc(r.name) + '</div><div class="om-o">' + esc(art) + '</div></div>' + ring(r.score)
      + '<div class="om-dl">' + dl.join('') + '</div><div class="om-dreh" aria-hidden="true">↻ mehr</div>';
  }

  function hinten(r, ziel) {
    var h = '', z = [];
    var kz = function (l, v, cls) { if (v == null || v === '') return; z.push('<div class="om-rz"><span>' + esc(l) + '</span><b class="' + (cls || '') + '">' + v + '</b></div>'); };
    var block = function (t) { if (!z.length) return; h += '<div class="om-rt">' + esc(t) + '</div>' + z.join(''); z = []; };
    var e = r.ekr4;
    if (e && da(e.haupt)) {
      var ek = '<div class="om-ek"><span class="om-ek-l">EK-Rendite nach Steuer mit Vermögensdelta</span><b class="om-ek-v ' + ton(e.haupt) + '">' + pct(e.haupt, 1) + '</b></div>';
      h += window.DpEkrUi ? DpEkrUi.einbauen(ek, e, 'om-ek-v', 'om-ek-l') : ek;
      var st = [['1 Operativ', e.k1], ['2 Nach Steuer', e.k2], ['3 Mit Wert', e.k3], ['4 Haupt', e.k4]].filter(function (x) { return da(x[1]); });
      if (st.length > 1) h += '<div class="om-stufen">' + st.map(function (x) { return '<span><small>' + x[0] + '</small><b class="' + ton(x[1]) + '">' + pct(x[1], 1) + '</b></span>'; }).join('') + '</div>';
      if (e.hebel && e.hebel.richtung) h += '<div class="om-hebel ' + (e.hebel.richtung === 'positiv' ? 'om-plus' : 'om-minus') + '">Hebel ' + esc(e.hebel.richtung) + (da(e.hebel.gkr) && da(e.hebel.fk_zins) ? ': Objekt ' + pct(e.hebel.gkr, 1) + ' gegen Darlehen ' + pct(e.hebel.fk_zins, 1) : '') + '</div>';
    }
    var ltv = da(r.rest) && r.wert > 0 ? r.rest / r.wert * 100 : null, zbB = jahreBis(r.bindEnde);
    kz('Restschuld', da(r.rest) && r.rest > 0 ? kurz(r.rest) : null);
    kz('Zinsbindung bis', monatJahr(r.bindEnde), zbB != null && zbB <= 3 ? 'om-minus' : '');
    kz('Restschuld dann', da(r.rsBind) ? kurz(r.rsBind) : null);
    kz('Zins · Tilgung', da(r.zinsPct) ? pct(r.zinsPct, 2) + (da(r.tilgJ) && r.tilgJ > 0 ? ' · ' + kurz(r.tilgJ) + ' / J' : '') : null);
    kz('Beleihung', ltv != null ? pct(ltv, 0) : null, ltv != null && ltv > 90 ? 'om-minus' : '');
    block('Finanzierung');
    var zb = r.zb, qm = da(r.mieteJ) && r.wfl > 0 ? r.mieteJ / 12 / r.wfl : null, mehr = zb && da(zb.mZ) && da(zb.mB) ? zb.mZ - zb.mB : null;
    kz('Kaltmiete', da(r.mieteJ) ? eur(r.mieteJ / 12) + ' / M' : null);
    kz('je m²', qm != null ? nf2.format(qm) + ' €' : null);
    kz('Zielbild', zb && da(zb.mZ) && mehr ? eur(zb.mZ / 12) + ' / M' : null);
    kz('Potenzial', mehr != null && mehr > 0 ? eurV(mehr) + ' / J' : null, 'om-plus');
    kz('Leerstand', da(r.leer) && r.leer > 0 ? pct(r.leer, 0) : null, da(r.leer) && r.leer > 3 ? 'om-minus' : '');
    block('Miete');
    var ri = [];
    if (da(r.dscr) && r.dscr < 1) ri.push('Kapitaldienst nicht gedeckt (DSCR ' + nf2.format(r.dscr) + ')');
    else if (ziel && da(ziel.dscr) && da(r.dscr) && r.dscr < ziel.dscr) ri.push('DSCR unter deinem Ziel ' + nf2.format(ziel.dscr));
    if (ltv != null && ltv > 90) ri.push('Beleihung über 90 %');
    if (zbB != null && zbB <= 3) ri.push('Zinsbindung endet in ' + nf1.format(Math.max(0, zbB)) + ' Jahren');
    if (/^[FGH]$/.test(String(r.energie || ''))) ri.push('Energieklasse ' + r.energie);
    if (da(r.leer) && r.leer > 3) ri.push('Leerstand ' + pct(r.leer, 0));
    if (e && e.hebel && e.hebel.richtung === 'negativ') ri.push('Hebel negativ: das Darlehen kostet mehr, als das Objekt bringt');
    if (ri.length) h += '<div class="om-rt">Risiken</div><ul class="om-ri">' + ri.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    return h || '<div class="om-rt">Keine weiteren Angaben</div>';
  }

  function html(rows, ctx) {
    ctx = ctx || {};
    var s = SORT.filter(function (x) { return x.k === _sort; })[0] || SORT[0];
    var L = rows.slice().sort(function (a, b) {
      if (!s.f) return String(a.name).localeCompare(String(b.name), 'de');
      var va = s.f(a), vb = s.f(b);
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return vb - va;
    });
    var ziel = ctx.ziel || null;
    var neg = rows.filter(function (r) { return da(r.cfns) && r.cfns < 0; }).length;
    var titel = rows.length + ' Objekte als Karten' + (neg ? ', ' + neg + (neg === 1 ? ' zahlt' : ' zahlen') + ' nach Steuer zu' : ', alle tragen sich nach Steuer');
    var wahl = '<label class="om-sort">Sortieren <select data-om-sort>' + SORT.map(function (x) { return '<option value="' + x.k + '"' + (x.k === s.k ? ' selected' : '') + '>' + esc(x.t) + '</option>'; }).join('') + '</select></label>';
    return '<div class="gp-sl sl"><h2>Objekte</h2><span class="tag">jedes Objekt als Karte</span><span class="rule"></span></div>'
      + '<div class="gp-karte dp-gx dp-gx-frei om-karte-w" data-gp-k="om"><div class="gx-kopf"><div class="gx-eye">Objektmatrix · zum Umdrehen</div>' + wahl + '</div>'
      + '<div class="gx-t gp-t">' + esc(titel) + '</div><div class="gx-s gp-u">Klick auf eine Karte dreht sie um: EK-Rendite in vier Stufen, Finanzierung, Miete und Risiken. Ohne Foto die Lage mit Pin.</div>'
      + '<div class="om-raster">' + L.map(function (r) {
        var an = !!_gedreht[r.id];
        return '<div class="om-k' + (an ? ' om-gedreht' : '') + '" data-om-k="' + esc(r.id) + '" tabindex="0" role="button" aria-pressed="' + an + '" aria-label="' + esc(r.name) + ', Karte umdrehen für weitere Angaben">'
          + '<div class="om-in"><div class="om-vorn">' + vorn(r, ziel) + '</div><div class="om-hinten"><div class="om-hn">' + esc(r.name) + '</div>' + hinten(r, ziel) + '</div></div></div>';
      }).join('') + '</div>'
      + '<div class="om-fuss">Kartenbild ohne Foto: © OpenStreetMap-Mitwirkende. Werte je Objekt wie in der Tabelle darunter.</div></div>';
  }

  function drehen(el) { var id = el.getAttribute('data-om-k'), an = !_gedreht[id]; _gedreht[id] = an; el.classList.toggle('om-gedreht', an); el.setAttribute('aria-pressed', String(an)); }
  function einrichten(host, neuZeichnen) {
    if (!host || host._omOn) return; host._omOn = true;
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-dp-ekr]') || e.target.closest('select,label')) return;   /* EK-Karte schaltet ihre Stufe, dreht nicht */
      var el = e.target.closest('.om-k'); if (el && host.contains(el)) drehen(el);
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('[data-dp-ekr]') || e.target.closest('select')) return;
      var el = e.target.closest('.om-k'); if (!el || el !== e.target) return; e.preventDefault(); drehen(el);
    });
    host.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-om-sort')) return;
      _sort = t.value; try { sessionStorage.setItem('dp_om_sort', _sort); } catch (x) {}
      if (neuZeichnen) neuZeichnen();
    });
  }
  /* Lagekarten nachladen (nur Objekte ohne Foto), je Objekt einmal je Sitzung */
  function nachladen(host) {
    if (!host || !window.DpLagekarte || !DpLagekarte.fuerAdresse) return;
    [].forEach.call(host.querySelectorAll('.om-leer[data-om-adr]'), function (el) {
      var id = el.getAttribute('data-om-id'), a = el.getAttribute('data-om-adr'); if (!a) return;
      var k = _karten[id];
      if (!k) { k = _karten[id] = { p: DpLagekarte.fuerAdresse(a, { breite: 420, hoehe: 200, pin: 'haus' }).then(function (b) { k.src = b && b.src; return k.src; }).catch(function () { return null; }) }; }
      k.p.then(function (src) {
        [].forEach.call(host.querySelectorAll('.om-leer[data-om-id="' + id.replace(/"/g, '') + '"]'), function (x) {
          if (src) { x.className = 'om-bild om-karte'; x.style.backgroundImage = 'url(\'' + src + '\')'; x.setAttribute('role', 'img'); x.removeAttribute('aria-hidden'); x.innerHTML = ''; }
          else { var s = x.querySelector('span'); if (s) s.textContent = 'keine Karte'; }
        });
      });
    });
  }

  var _stil = false;
  function stil() {
    if (_stil) return; _stil = true;
    var H = '.dp-gp-om', s = document.createElement('style'); s.id = 'dp-om-stil';
    s.textContent = [
      H + ' .gx-kopf{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}',
      H + ' .om-sort{font:500 10.5px Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--gx-tinte3)}',
      H + ' .om-sort select{margin-left:6px;font:500 12px Inter,system-ui,sans-serif;text-transform:none;letter-spacing:0;color:var(--gx-tinte);background:var(--gx-karte);border:1px solid var(--gx-linie2);border-radius:8px;padding:3px 6px}',
      H + ' .om-raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-top:12px}',
      H + ' .om-k{perspective:1200px;outline:none;cursor:pointer;min-width:0}',
      H + ' .om-in{display:grid;transition:transform .55s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d;min-height:100%;position:relative}',
      H + ' .om-gedreht .om-in{transform:rotateY(180deg)}',
      H + ' .om-vorn,' + H + ' .om-hinten{grid-area:1/1;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--gx-karte);border:1px solid var(--gx-linie2);border-radius:12px;padding:10px 12px 22px;position:relative;overflow:hidden;min-width:0;color:var(--gx-tinte)}',
      H + ' .om-hinten{transform:rotateY(180deg);background:linear-gradient(var(--gx-flaeche),var(--gx-flaeche)),var(--gx-karte)}',
      H + ' .om-k:hover .om-vorn,' + H + ' .om-k:hover .om-hinten{border-color:var(--wl-c9a84c,#C9A84C)}',
      H + ' .om-k:focus-visible .om-vorn,' + H + ' .om-k:focus-visible .om-hinten{box-shadow:0 0 0 2px var(--wl-c9a84c,#C9A84C)}',
      H + ' .om-bild{display:block;height:98px;margin:-10px -12px 9px;background:var(--gx-flaeche) center/cover no-repeat;border-bottom:1px solid var(--gx-linie)}',
      H + ' .om-leer{display:flex;align-items:center;justify-content:center}',
      H + ' .om-leer span{font:500 10.5px Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--gx-tinte3)}',
      H + ' .om-kopf{padding-right:44px}',
      H + ' .om-n{font:600 13.5px/1.25 "Space Grotesk",Inter,sans-serif;color:var(--gx-tinte)}',
      H + ' .om-o{font:400 11.5px Inter,system-ui,sans-serif;color:var(--gx-tinte3);margin:1px 0 8px}',
      H + ' .om-ring{position:absolute;right:9px;top:104px;width:38px;height:38px;background:var(--gx-karte);border-radius:50%}',
      H + ' .om-ring text{font:600 12px "Space Grotesk",Inter,sans-serif;fill:var(--gx-tinte)}',
      H + ' .om-dl{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}',
      H + ' .om-z span{display:block;font:500 9.5px Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--gx-tinte3)}',
      H + ' .om-z b{display:block;font:600 14px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums;color:var(--gx-tinte)}',
      H + ' .om-plus{color:' + GRUEN + ' !important}' + H + ' .om-minus{color:' + ROT + ' !important}',
      H + ' .om-dreh{position:absolute;right:10px;bottom:6px;font:600 9px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--dp-gold-txt,#7d682f)}',
      H + ' .om-hn{font:600 12.5px "Space Grotesk",Inter,sans-serif;margin-bottom:4px}',
      H + ' .om-ek{border:1px solid var(--gx-linie2);border-radius:9px;padding:6px 8px;display:flex;justify-content:space-between;align-items:baseline;gap:8px;cursor:pointer;background:var(--gx-karte)}',
      H + ' .om-ek:hover{border-color:var(--wl-c9a84c,#C9A84C)}',
      H + ' .om-ek-l{font:500 9.5px Inter,system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--gx-tinte3)}',
      H + ' .om-ek-v{font:600 15px "Space Grotesk",Inter,sans-serif;white-space:nowrap}',
      H + ' .om-stufen{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 6px;margin-top:5px}',
      H + ' .om-stufen span{display:flex;justify-content:space-between;gap:4px;font:400 10.5px Inter,system-ui,sans-serif;color:var(--gx-tinte2)}',
      H + ' .om-stufen b{font:600 11px "Space Grotesk",Inter,sans-serif}',
      H + ' .om-hebel{font:500 10.5px Inter,system-ui,sans-serif;margin-top:4px}',
      H + ' .om-rt{font:500 9.5px Inter,system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--dp-gold-txt,#7d682f);margin:8px 0 2px}',
      H + ' .om-rz{display:flex;justify-content:space-between;gap:8px;font:400 11.5px Inter,system-ui,sans-serif;padding:1px 0}',
      H + ' .om-rz span{color:var(--gx-tinte3)}' + H + ' .om-rz b{font:600 11.5px "Space Grotesk",Inter,sans-serif;white-space:nowrap;color:var(--gx-tinte)}',
      H + ' .om-ri{margin:0;padding-left:15px;font:400 11px/1.35 Inter,system-ui,sans-serif;color:' + ROT + '}',
      H + ' .om-fuss{margin-top:10px;font:400 10.5px Inter,system-ui,sans-serif;color:var(--gx-tinte3)}',
      'html[data-gx-stil="dunkel"] ' + H + ' .om-dreh,html[data-gx-stil="dunkel"] ' + H + ' .om-rt{color:var(--wl-e8cc7a,#E8CC7A)}',
      '@media (max-width:640px){' + H + ' .om-raster{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px}' + H + ' .om-dl{grid-template-columns:1fr 1fr}}',
      '@media (max-width:400px){' + H + ' .om-raster{grid-template-columns:1fr}}',
      '@media (prefers-reduced-motion:reduce){' + H + ' .om-in{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.DpObjektmatrix = { html: function (rows, ctx) { stil(); return html(rows, ctx); }, einrichten: einrichten, nachladen: nachladen, version: 'v4690' };
})();
