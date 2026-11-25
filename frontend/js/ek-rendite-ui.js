/* v4620 · EK-Rendite-Karte: EIN Tooltip und Durchschalten der Stufen (Marcel 25.11.2026).
 *
 * Jede Stelle, die die EK-Rendite zeigt, baut ihre Karte wie bisher und reicht das HTML durch
 * DpEkrUi.einbauen(html, r, wertKlasse, lblKlasse). Danach gilt überall dasselbe:
 *   - Klick, Enter oder Leertaste schaltet Haupt → 1 Operativ → 2 Nach Steuer → 3 Mit Wert → Haupt,
 *     Zahl und Beschriftung wechseln an ALLEN Karten der Seite mit, Punkte zeigen die Stufe.
 *   - Überfahren oder Fokus zeigt EINEN Tooltip: Erklärung der angezeigten Stufe, alle vier
 *     Stufen und den Hebel. Er wächst mit dem Inhalt und bleibt im Fenster (auch 390 px).
 *   - Die gewählte Stufe gilt nur für die Sitzung (sessionStorage).
 * Rechnen tut diese Datei nichts: alle Zahlen kommen aus ek-rendite.js (r = DpEkRendite.rechne()).
 */
(function () {
  'use strict';
  var KEY = 'dp_ekr_stufe';
  var REIHE = ['haupt', 'k1', 'k2', 'k3'];
  var NAME = {
    haupt: 'Nach Steuer mit Vermögensdelta',
    k1: 'Operativ',
    k2: 'Nach Steuer',
    k3: 'Vor Steuer mit Vermögensdelta'
  };
  var KURZ = { haupt: 'Haupt', k1: '1 Operativ', k2: '2 Nach Steuer', k3: '3 Mit Wert' };
  var ERKL = {
    haupt: 'Überschuss nach Steuer plus Tilgung plus Wertentwicklung im Jahr, geteilt durch dein Eigenkapital. Das ist die eigentliche Rendite deines Geldes.',
    haupt_k2: 'Überschuss nach Steuer plus Tilgung, geteilt durch dein Eigenkapital. Ohne Bewertung fehlt die Wertentwicklung.',
    k1: 'Überschuss nach Zins und Tilgung plus Tilgung, geteilt durch dein Eigenkapital. Nur das laufende Geschäft, ohne Steuer und ohne Wert.',
    k2: 'Wie Operativ, dazu die Steuererstattung oder die Nachzahlung.',
    k3: 'Wie Operativ, dazu die Wertentwicklung im Jahr. Ohne Steuer.'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pz(x) { return x == null || !isFinite(x) ? 'k. A.' : x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'; }
  function eur(x) { return x == null || !isFinite(x) ? 'k. A.' : Math.round(x).toLocaleString('de-DE') + ' €'; }

  function stufen(r) {
    if (!r) return ['haupt'];
    var s = ['haupt', 'k1'];
    if (r.haupt_art === 'k4') { s.push('k2'); if (r.k3 != null) s.push('k3'); }
    return s;
  }
  function gewaehlt() { try { var v = sessionStorage.getItem(KEY); return REIHE.indexOf(v) >= 0 ? v : 'haupt'; } catch (e) { return 'haupt'; } }
  function merken(v) { try { sessionStorage.setItem(KEY, v); } catch (e) {} }
  function stufeFuer(r) { var s = gewaehlt(), m = stufen(r); return m.indexOf(s) >= 0 ? s : 'haupt'; }
  function zahl(r, s) { return s === 'haupt' ? r.haupt : r[s]; }
  function name(r, s) { return s === 'haupt' && r.haupt_art !== 'k4' ? NAME.k2 : NAME[s]; }
  function punkte(r, s) {
    return '<span class="dp-ekr-pk" aria-hidden="true">' + stufen(r).map(function (x) { return '<i' + (x === s ? ' class="an"' : '') + '></i>'; }).join('') + '</span>';
  }

  /* Liest r aus dem Attribut der Karte */
  function lies(el) { try { return JSON.parse(el.getAttribute('data-dp-ekr') || 'null'); } catch (e) { return null; } }

  /* Karte auf die gewählte Stufe stellen */
  function anwenden(el) {
    var r = lies(el); if (!r) return;
    var s = stufeFuer(r);
    var w = el.querySelector('[data-dp-ekr-wert]'), l = el.querySelector('[data-dp-ekr-lbl]');
    var v = zahl(r, s);
    if (w) {
      w.textContent = pz(v);
      w.classList.toggle('dp-ekr-neg', v != null && v < 0);
    }
    if (l) l.innerHTML = esc(s === 'haupt' ? name(r, s) : KURZ[s]) + punkte(r, s);
    el.setAttribute('aria-label', 'EK-Rendite ' + name(r, s) + ' ' + pz(v) + '. Klicken wechselt die Stufe.');
  }
  function alleAnwenden() { var l = document.querySelectorAll('[data-dp-ekr]'); for (var i = 0; i < l.length; i++) anwenden(l[i]); }

  /* HTML einer Karte umbauen: Attribut an das erste Element, eigener title weg, Wert und Beschriftung markiert */
  function einbauen(html, r, wertKlasse, lblKlasse) {
    if (!r || !html) return html;
    var s = stufeFuer(r), v = zahl(r, s);
    var a = ' data-dp-ekr="' + esc(JSON.stringify(knapp(r))) + '" tabindex="0" role="button"';
    html = html.replace(/^(\s*<[a-z]+)([^>]*)>/i, function (m, tag, rest) {
      rest = rest.replace(/\s(title|data-dp-pa4-tip|data-bwe)="[^"]*"/g, '').replace(/\stabindex="[^"]*"/g, '').replace(/\srole="[^"]*"/g, '');
      return tag + rest + a + '>';
    });
    if (wertKlasse) html = html.replace(new RegExp('(<[a-z]+[^>]*class="[^"]*\\b' + wertKlasse + '\\b[^"]*")'), '$1 data-dp-ekr-wert');
    if (lblKlasse) html = html.replace(new RegExp('(<[a-z]+[^>]*class="[^"]*\\b' + lblKlasse + '\\b[^"]*")'), '$1 data-dp-ekr-lbl');
    return html;
  }
  /* Bestehendes Element (Reiter Kennzahlen) einrichten */
  function einrichten(el, r, wertEl, lblEl) {
    if (!el || !r) return;
    el.removeAttribute('title'); if (wertEl) wertEl.removeAttribute('title'); if (lblEl) lblEl.removeAttribute('title');
    el.removeAttribute('data-bwe');
    el.setAttribute('data-dp-ekr', JSON.stringify(knapp(r)));
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
    if (wertEl) wertEl.setAttribute('data-dp-ekr-wert', '');
    if (lblEl) lblEl.setAttribute('data-dp-ekr-lbl', '');
    anwenden(el);
  }
  /* Nur was der Tooltip braucht, damit das Attribut klein bleibt */
  function knapp(r) {
    var o = {}, k;
    ['haupt', 'haupt_art', 'k1', 'k2', 'k3', 'k4', 'ek', 'cf_op', 'steuer', 'tilg', 'bspar', 'wert', 'darlehen0', 'delta', 'delta_pa', 'delta_weg', 'haltejahre', 'wstg', 'wert_text', 'mit_delta', 'anzahl', 'portfolio']
      .forEach(function (k2) { if (r[k2] != null) o[k2] = r[k2]; });
    if (r.hebel) { o.hebel = {}; for (k in r.hebel) if (r.hebel[k] != null) o.hebel[k] = r.hebel[k]; }
    return o;
  }

  /* ---------- Tooltip ---------- */
  var pop = null, an = null;
  function stil() {
    if (document.getElementById('dp-ekr-stil')) return;
    var st = document.createElement('style'); st.id = 'dp-ekr-stil';
    st.textContent =
      '[data-dp-ekr]{cursor:pointer;user-select:none}' +
      '[data-dp-ekr]:focus-visible{outline:2px solid var(--gold,#C9A84C);outline-offset:2px}' +
      '.dp-ekr-pk{display:inline-flex;gap:3px;margin-left:6px;vertical-align:1px}' +
      '.dp-ekr-pk i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.28;display:inline-block}' +
      '.dp-ekr-pk i.an{opacity:1;background:var(--gold,#C9A84C)}' +
      '.dp-ekr-pop{position:fixed;z-index:9600;box-sizing:border-box;width:max-content;max-width:min(440px,calc(100vw - 24px));background:#FFFFFF;color:#2A2727;border:1px solid #E6E0D3;border-radius:12px;box-shadow:0 12px 32px rgba(20,16,8,.16);padding:12px 14px;font:400 12.5px/1.45 Inter,sans-serif;pointer-events:none;opacity:0;transition:opacity .12s;white-space:normal;overflow-wrap:anywhere}' +
      '.dp-ekr-pop.an{opacity:1}' +
      '.dp-ekr-pop b.t{display:block;font:600 13.5px/1.3 "Space Grotesk",Inter,sans-serif;margin-bottom:4px}' +
      '.dp-ekr-pop p{margin:0 0 8px}' +
      '.dp-ekr-pop table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;margin:0 0 6px}' +
      '.dp-ekr-pop td{padding:3px 0;border-bottom:1px solid #F0EBDF}.dp-ekr-pop td:last-child{text-align:right;padding-left:12px;white-space:nowrap}' +
      '.dp-ekr-pop tr.an td{font-weight:600;color:var(--wl-b8932f,#b8932f)}' +
      '.dp-ekr-pop ul{margin:6px 0 0;padding:6px 0 0 16px;border-top:1px solid #F0EBDF}.dp-ekr-pop li{margin:0 0 3px}' +
      '.dp-ekr-pop .f{margin:8px 0 0;color:#7A7368;font-size:11.5px}' +
      '.dp-ekr-neg{color:#B8625C !important}';
    document.head.appendChild(st);
  }
  function inhalt(r) {
    var s = stufeFuer(r), v = zahl(r, s);
    var erkl = s === 'haupt' ? (r.haupt_art === 'k4' ? ERKL.haupt : ERKL.haupt_k2) : ERKL[s];
    var zeilen = [['haupt', 'Nach Steuer mit Vermögensdelta (Haupt)', r.k4 != null ? r.k4 : r.haupt], ['k1', '1 Operativ', r.k1], ['k2', '2 Nach Steuer', r.k2], ['k3', '3 Vor Steuer mit Vermögensdelta', r.k3]]
      .filter(function (z) { return stufen(r).indexOf(z[0]) >= 0; });
    var h = '<b class="t">' + esc((r.portfolio ? 'EK-Rendite Portfolio · ' : 'EK-Rendite · ') + name(r, s)) + ' ' + esc(pz(v)) + '</b>'
      + '<p>' + esc(erkl) + '</p>'
      + '<table>' + zeilen.map(function (z) { return '<tr' + (z[0] === s ? ' class="an"' : '') + '><td>' + esc(z[1]) + '</td><td>' + esc(pz(z[2])) + '</td></tr>'; }).join('')
      + '<tr><td>Eigenkapital</td><td>' + esc(eur(r.ek)) + '</td></tr>'
      + (r.delta_pa != null ? '<tr><td>Wertentwicklung im Jahr</td><td>' + esc(eur(r.delta_pa)) + '</td></tr>' : '')
      + '</table>';
    var hz = (window.DpEkRendite && DpEkRendite.hebelZeilen && r.hebel) ? DpEkRendite.hebelZeilen(r.hebel) : [];
    if (hz.length) h += '<ul>' + hz.map(function (z) { return '<li>' + esc(z) + '</li>'; }).join('') + '</ul>';
    if (r.portfolio && r.anzahl != null) h += '<p class="f">Nach Eigenkapital gewichtet über ' + r.anzahl + ' Objekte, ' + (r.mit_delta || 0) + ' mit Bewertung.</p>';
    h += '<p class="f">Klicken wechselt die angezeigte Stufe.</p>';
    return h;
  }
  function zeigen(el) {
    var r = lies(el); if (!r) return;
    stil();
    if (!pop) { pop = document.createElement('div'); pop.className = 'dp-ekr-pop'; pop.setAttribute('role', 'tooltip'); document.body.appendChild(pop); }
    an = el;
    pop.innerHTML = inhalt(r);
    pop.style.left = '0px'; pop.style.top = '0px'; pop.classList.add('an');
    var b = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(12, b.left + b.width / 2 - pw / 2), vw - pw - 12);
    var top = b.bottom + 8;
    if (top + ph > vh - 8) {
      if (b.top - ph - 8 >= 8) top = b.top - ph - 8;                       /* darüber */
      else {                                                               /* daneben, senkrecht mittig, im Fenster */
        top = Math.min(Math.max(8, b.top + b.height / 2 - ph / 2), Math.max(8, vh - ph - 8));
        if (b.right + 8 + pw <= vw - 8) left = b.right + 8;
        else if (b.left - 8 - pw >= 8) left = b.left - 8 - pw;
      }
    }
    pop.style.left = Math.max(12, left) + 'px'; pop.style.top = top + 'px';
  }
  function weg() { if (pop) pop.classList.remove('an'); an = null; }
  function weiter(el) {
    var r = lies(el); if (!r) return;
    var m = stufen(r), s = stufeFuer(r), n = m[(m.indexOf(s) + 1) % m.length];
    merken(n); alleAnwenden();
    if (an === el || pop && pop.classList.contains('an')) zeigen(el);
  }

  function ziel(e) { return e.target && e.target.closest ? e.target.closest('[data-dp-ekr]') : null; }
  document.addEventListener('mouseover', function (e) { var el = ziel(e); if (el && el !== an) zeigen(el); else if (!el && an) weg(); }, true);
  document.addEventListener('focusin', function (e) { var el = ziel(e); if (el) zeigen(el); }, true);
  document.addEventListener('focusout', function (e) { if (ziel(e)) weg(); }, true);
  document.addEventListener('scroll', function () { if (an) weg(); }, true);
  document.addEventListener('click', function (e) { var el = ziel(e); if (!el) return; e.preventDefault(); e.stopPropagation(); weiter(el); }, true);
  document.addEventListener('keydown', function (e) {
    var el = ziel(e); if (!el) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); e.stopPropagation(); weiter(el); }
    else if (e.key === 'Escape') weg();
  }, true);
  /* Karten, die nach dem Rendern dazukommen, auf die gewählte Stufe stellen */
  try {
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) {
        var n = ms[i].addedNodes[j]; if (n.nodeType !== 1) continue;
        if (n.hasAttribute && n.hasAttribute('data-dp-ekr')) anwenden(n);
        if (n.querySelectorAll) { var l = n.querySelectorAll('[data-dp-ekr]'); for (var k = 0; k < l.length; k++) anwenden(l[k]); }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  stil();

  window.DpEkrUi = { einbauen: einbauen, einrichten: einrichten, anwenden: alleAnwenden, stufe: gewaehlt, version: 'v4620c' };
})();
