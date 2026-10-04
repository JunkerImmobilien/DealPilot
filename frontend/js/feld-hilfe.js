'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   feld-hilfe.js — v1858 · Hover-Hilfe an JEDEM Feld
   ═══════════════════════════════════════════════════════════════════════

   Marcel, 04.10.2026: „wenn man mit der Maus drüber fährt … kommt so ein
   Fragezeichen und dann werden die Hilfen angezeigt. Kannst du das bei
   allen anderen auch so machen? Also wirklich bei allen Feldern? Weil
   dann hat man diese gelben Tooltip-Dinger nicht mehr … Das kann man ja
   unter Einstellungen einstellen."

   Was dieses Modul tut:
   · Mauszeiger über einem Feldkasten (`.f`) → nach 300 ms ein Popup.
   · Text: der gepflegte Tooltip aus tooltip-content.js, wenn das Feld
     einen `.dp-tip[data-tip-id]` trägt (89 Texte) — sonst ein ehrlicher
     Satz aus dem, was messbar ist: Beschriftung, und WOFÜR das Feld
     gebraucht wird (Pflicht für Stufe 1/2/3 aus objekt-reiter.js, Investor
     Deal Score, Marktbericht-Verfeinerung). Nichts Erfundenes.
   · Folgt dem Tooltip-Modus der Einstellungen (dp_tooltip_mode): „Aus"
     schaltet die Hover-Hilfe ab; „Profi"/„Anfänger" schalten sie an. Dann
     sind die gelben i-Knöpfe ausgeblendet (Klasse am body) — sie bleiben
     im DOM, damit nichts anderes bricht.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DS2 = ['ds2_zustand', 'ds2_energie', 'makrolage', 'mikrolage', 'ds2_bevoelkerung', 'ds2_nachfrage', 'ds2_wertsteigerung', 'ds2_entwicklung',
             'ausst_aussenwaende', 'ausst_dach', 'ausst_fenster', 'ausst_innenwaende', 'ausst_decken', 'ausst_fussboeden', 'ausst_sanitaer', 'ausst_heizung', 'ausst_technik'];
  var _pop = null, _timer = null, _aktiv = null;

  function modusAn() {
    try { return !(window.DpTip && typeof DpTip.getMode === 'function' && DpTip.getMode() === 'off'); } catch (e) { return true; }
  }
  function bodyKlasse() { document.body.classList.toggle('dp-feldhilfe-an', modusAn()); }

  function beschriftung(f) {
    var lab = f.querySelector('label'); if (!lab) return '';
    var k = lab.cloneNode(true);
    k.querySelectorAll('button, .ds2-tag, .oe-opt, .dp-oa-pflicht, .dp-oa-tipp, .dp-oa-warum, span[style*="font-size:11px"]').forEach(function (x) { x.remove(); });
    return k.textContent.replace(/\s+/g, ' ').replace(/\*/g, '').trim();
  }
  function wofuer(id) {
    var R = window.DealPilotObjektReiter, teile = [];
    try {
      if (R && typeof R.pflichtFuer === 'function') {
        var p1 = R.pflichtFuer(1), p2 = R.pflichtFuer(2), p3 = R.pflichtFuer(3);
        if (p1.indexOf(id) >= 0) teile.push('Pflicht für jede Marktbewertung (Stufe 1)');
        else if (p2.indexOf(id) >= 0) teile.push('Pflicht ab Stufe 2 (erweiterte Indikation)');
        else if (p3.indexOf(id) >= 0) teile.push('Pflicht für Stufe 3 (Sach- und Ertragswert)');
      }
    } catch (e) {}
    if (DS2.indexOf(id) >= 0) teile.push('geht in den Investor Deal Score');
    var e3 = document.querySelector('.card[data-oe-stufe-min="3"]');
    var el = $(id);
    if (el && e3 && e3.contains(el) && !teile.some(function (t) { return /Stufe 3/.test(t); })) teile.push('verfeinert Sach- und Ertragswert (ohne Angabe gilt der Ansatz der Anlage 3 ImmoWertV)');
    if (el && /^(eq_|mod_)/.test(id)) teile.push(/^mod_/.test(id) ? 'Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)' : 'Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)');
    return teile;
  }
  function textFuer(f) {
    var el = f.querySelector('input,select,textarea'); if (!el) return null;
    var tipBtn = f.querySelector('.dp-tip[data-tip-id]');
    var id = tipBtn && tipBtn.getAttribute('data-tip-id');
    var t = id && window.DpTooltips && window.DpTooltips.content && window.DpTooltips.content[id];
    var titel = beschriftung(f) || (t && t.title) || el.id;
    if (t) return { titel: t.title || titel, body: t.body || '', zusatz: t.paragraph ? ('§ ' + String(t.paragraph).replace(/^§\s*/, '')) : '', gepflegt: true, id: el.id };
    var w = wofuer(el.id);
    var hint = f.querySelector('.hint, .cf-hint, .dz-sub');
    var body = (el.getAttribute('title') || (el.querySelector && el.querySelector('option[selected]') ? '' : '') || (hint ? hint.textContent.trim() : '') || (el.placeholder ? 'Beispiel: ' + el.placeholder : ''));
    return { titel: titel, body: body, wofuer: w, gepflegt: false, id: el.id };
  }
  function zeigen(f) {
    if (!modusAn()) return;
    var d = textFuer(f); if (!d) return;
    verstecken();
    var pop = document.createElement('div');
    pop.className = 'dp-tip-popup dp-feldhilfe-popup';
    var w = (d.wofuer || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    pop.innerHTML = '<div class="dp-feldhilfe-titel">' + esc(d.titel) + (d.zusatz ? ' <span class="dp-feldhilfe-par">' + esc(d.zusatz) + '</span>' : '') + '</div>'
      + (d.body ? '<div class="dp-feldhilfe-body">' + esc(d.body) + '</div>' : '')
      + (w ? '<ul class="dp-feldhilfe-wofuer">' + w + '</ul>' : '')
      + (!d.gepflegt && !d.body && !w ? '<div class="dp-feldhilfe-body dp-feldhilfe-leer">Zu diesem Feld gibt es noch keinen Hilfetext.</div>' : '');
    document.body.appendChild(pop);
    var r = f.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 4, left = r.left + window.scrollX;
    var maxLeft = window.innerWidth + window.scrollX - pr.width - 12; if (left > maxLeft) left = maxLeft; if (left < 8) left = 8;
    if (r.bottom + pr.height + 16 > window.innerHeight) top = r.top + window.scrollY - pr.height - 4;
    pop.style.top = top + 'px'; pop.style.left = left + 'px';
    _pop = pop; _aktiv = f;
  }
  function verstecken() { if (_pop && _pop.parentNode) _pop.parentNode.removeChild(_pop); _pop = null; _aktiv = null; }

  function verdrahten() {
    document.addEventListener('mouseover', function (e) {
      var f = e.target.closest && e.target.closest('.f');
      if (!f || f === _aktiv) return;
      if (e.target.closest('.dp-tip, .oe-btn, button')) return;
      clearTimeout(_timer);
      _timer = setTimeout(function () { zeigen(f); }, 300);
    });
    document.addEventListener('mouseout', function (e) {
      var f = e.target.closest && e.target.closest('.f'); if (!f) return;
      var nach = e.relatedTarget; if (nach && f.contains(nach)) return;
      clearTimeout(_timer); verstecken();
    });
    document.addEventListener('scroll', verstecken, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') verstecken(); });
    bodyKlasse();
    /* Modus-Wechsel in den Einstellungen: DpTip.setMode ruft applyBodyClass — wir hängen uns dahinter */
    try {
      if (window.DpTip && typeof DpTip.setMode === 'function' && !DpTip.setMode._dpFeldhilfe) {
        var orig = DpTip.setMode;
        DpTip.setMode = function (m) { var ok = orig.apply(this, arguments); bodyKlasse(); verstecken(); return ok; };
        DpTip.setMode._dpFeldhilfe = true;
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten); else verdrahten();
  window.DealPilotFeldHilfe = { zeigen: zeigen, verstecken: verstecken, textFuer: textFuer, modusAn: modusAn };
})();
