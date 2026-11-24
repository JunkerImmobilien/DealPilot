/* v4460 · Objekt-Cockpit (Marcel 24.11.2026):
   „wenn wir ein Objekt in der Deal-Aktion auf gewonnen setzen, dass wir ganz vorne vor dem Tab Objekt dann das
   Objekt-Cockpit hinsetzen … nur wenn Objekte gewonnen sind … die Pilot-Analyse ist wirklich nur im Ankauf …
   goldfarben hinterlegen, dass es sich ein bisschen abhebt“.

   Umgezogen, nicht kopiert: der Reiter s5 ist derselbe Container mit denselben Render-Funktionen
   (pilot-analyse-v4.js huelle). Bei gewonnenen Objekten heisst sein Knopf „Objekt-Cockpit“, steht per CSS-order
   ganz vorne und ist gold hinterlegt; einen Reiter „Pilot-Analyse“ gibt es dann nicht mehr. Im Ankauf heisst
   er „Pilot-Analyse“ und steht an seinem alten Platz.

   Die DOM-Reihenfolge der .tab-Knoepfe bleibt unveraendert, weil switchTab(i) und viele Absprünge nach Index
   bzw. data-target-sec="s5" arbeiten (ui.js switchTab, _v235GoToNextTab). Nur die Anzeige wandert (order:-1).

   Gewonnen = DealPilotDealAction.isWon() bzw. #_deal_won_state, sonst _currentObjData._deal_won.
   Steht der Nutzer bei einem gewonnenen Objekt in der Ankauf-Ansicht (DealPilotAnkaufAnsicht.aktiv(),
   Umschalter „Stand: Ankauf“), schaut er auf den Kauf: dann wieder „Pilot-Analyse“. */
(function () {
  'use strict';

  function gewonnen() {
    try {
      var el = document.getElementById('_deal_won_state');
      if (el && el.value === 'true') return true;
      var d = window._currentObjData;
      if (d && (d._deal_lost === true || d._deal_lost === 'true')) return false;
      if (el && el.value === 'false' && window.DealPilotDealAction) {
        /* Eingabe existiert und sagt nein: das gilt, ausser sie ist noch nicht mit dem Objekt abgeglichen */
        if (!(d && (d._deal_won === true || d._deal_won === 'true'))) return false;
      }
      return !!(d && (d._deal_won === true || d._deal_won === 'true'));
    } catch (e) { return false; }
  }
  function ankaufAnsicht() {
    try { var AA = window.DealPilotAnkaufAnsicht; return !!(AA && typeof AA.aktiv === 'function' && AA.aktiv()); } catch (e) { return false; }
  }
  function aktiv() {
    try { if (!window._currentObjKey) return false; } catch (e) { return false; }
    return gewonnen() && !ankaufAnsicht();
  }
  function name() { return aktiv() ? 'Objekt-Cockpit' : 'Pilot-Analyse'; }

  function stil() {
    if (document.getElementById('dp-oc-stil')) return;
    var s = document.createElement('style');
    s.id = 'dp-oc-stil';
    /* Gold ist der AKZENT (Flaeche, Rand), die Schrift bleibt die der Leiste; aktiv: volle Goldflaeche mit dunkler
       Schrift. Farben nur ueber Whitelabel-Token, damit ein Partner seine Farbe bekommt. */
    /* Spezifitaet: layout-varianten.css setzt html[data-dp-layout][data-dp-layout] body:has(#sb-user) nav.tabs .tab
       (und alle Kinder) mit !important auf transparent - gemessen v4460. Daher dieselbe Kette plus eigene Klasse. */
    var P = ['nav.tabs', 'html[data-dp-layout][data-dp-layout] body:has(#sb-user) nav.tabs', 'html[data-dp-layout^="v"] body:has(#sb-user) nav.tabs'];
    var sel = function (suf) { return P.map(function (p) { return p + ' .tab.dp-tab-cockpit[data-dp-oc="1"]' + suf; }).join(','); };
    var G = 'var(--gold,var(--wl-c9a84c,#C9A84C))';
    s.textContent = ''
      + sel('') + '{order:-1;position:relative;border-radius:8px;margin-right:6px;'
      + 'background:color-mix(in srgb,' + G + ' 20%,transparent)!important;'
      + 'box-shadow:inset 0 0 0 1px color-mix(in srgb,' + G + ' 75%,transparent)!important}'
      + sel(' .tab-ico') + '{color:' + G + '!important}'
      + sel('.active') + '{background:linear-gradient(110deg,var(--gold-hi,var(--wl-e8cc7a,#E8CC7A)),' + G + ' 55%,var(--gold-lo,var(--wl-b8932f,#b8932f)))!important;color:#1a1712!important;box-shadow:none!important}'
      + sel('.active *') + '{color:#1a1712!important;background:transparent!important}'
      + sel('.active::after') + '{display:none!important}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* Flaeche und Schrift direkt am Knopf (style, !important): gemessen v4460 kam die Stylesheet-Regel gegen die
     !important-Ketten von layout-varianten.css / style.css (header.hdr.has-v64-score + nav.tabs .tab) nicht an,
     backgroundColor blieb transparent. Inline schlaegt jede Stylesheet-Regel. */
  var G = 'var(--gold,var(--wl-c9a84c,#C9A84C))';
  function faerben(k) {
    var an = k.classList.contains('dp-tab-cockpit'), akt = k.classList.contains('active');
    var setz = function (el, p, v) { if (v == null) el.style.removeProperty(p); else el.style.setProperty(p, v, 'important'); };
    var kinder = k.querySelectorAll('.tab-lbl,.tab-ico');
    /* gemessen v4460b: .tab hat transition all .2s, damit wurde auch order animiert und blieb in einem
       Hintergrund-Tab bei -1 haengen. order nie animieren. */
    setz(k, 'transition-property', 'background, background-color, box-shadow, color, border-color');
    if (!an) {
      ['background', 'box-shadow', 'color', 'border-radius', 'margin-right'].forEach(function (p) { setz(k, p, null); });
      k.style.setProperty('order', '0');   /* gemessen v4460a: ohne Klasse blieb order -1 stehen, daher ausdruecklich */
      Array.prototype.forEach.call(kinder, function (c) { setz(c, 'color', null); });
      return;
    }
    setz(k, 'order', '-1'); setz(k, 'border-radius', '8px'); setz(k, 'margin-right', '6px');
    if (akt) {
      setz(k, 'background', 'linear-gradient(110deg,var(--gold-hi,var(--wl-e8cc7a,#E8CC7A)),' + G + ' 55%,var(--gold-lo,var(--wl-b8932f,#b8932f)))');
      setz(k, 'box-shadow', 'none'); setz(k, 'color', '#1a1712');
      Array.prototype.forEach.call(kinder, function (c) { setz(c, 'color', '#1a1712'); });
    } else {
      setz(k, 'background', 'color-mix(in srgb,' + G + ' 28%,transparent)');
      setz(k, 'box-shadow', 'inset 0 0 0 1px color-mix(in srgb,' + G + ' 75%,transparent)');
      setz(k, 'color', null);
      Array.prototype.forEach.call(kinder, function (c) { setz(c, 'color', c.classList.contains('tab-ico') ? G : null); });
    }
  }

  var _zuletzt = null;
  function anwenden(erzwingen) {
    var an = aktiv(), sig = an ? '1' : '0';
    var knopf = document.querySelector('nav.tabs .tab[data-target-sec="s5"]');
    if (!knopf) return;
    if (!erzwingen && sig === _zuletzt && knopf.getAttribute('data-dp-oc') === sig) return;
    _zuletzt = sig;
    stil();
    knopf.setAttribute('data-dp-oc', sig);
    knopf.classList.toggle('dp-tab-cockpit', an);
    faerben(knopf);
    if (!knopf._dpOcBeob && window.MutationObserver) {
      /* aktiv/inaktiv wechselt ueber die Klasse .active (switchTab) - dann neu faerben */
      knopf._dpOcBeob = new MutationObserver(function () { faerben(knopf); });
      knopf._dpOcBeob.observe(knopf, { attributes: true, attributeFilter: ['class'] });
    }
    var lbl = knopf.querySelector('.tab-lbl');
    if (lbl) lbl.textContent = an ? 'Objekt-Cockpit' : 'Pilot-Analyse';
    var ico = knopf.querySelector('.tab-ico');
    var icoName = an ? 'compass' : 'brain';
    if (ico && ico.getAttribute('data-ico') !== icoName) {
      /* Symbol aus icons.js (global Icons): Kompass fuers Cockpit, Gehirn fuer die Analyse */
      try {
        if (window.Icons && typeof window.Icons[icoName] === 'function') {
          ico.setAttribute('data-ico', icoName); ico.innerHTML = window.Icons[icoName]({ size: 18 }); ico.dataset.icoFilled = '1';
        }
      } catch (e) {}
    }
    knopf.title = an ? 'Objekt-Cockpit: Jahresabgleich, Wert, Steuer, Haus und Potenzial dieses Objekts' : 'Pilot-Analyse: Fragen und Reiter für die Kaufentscheidung';
    /* Ueberschrift und Weiter-Hinweise */
    var h = document.querySelector('#s5 > .sec-title'); if (h) h.textContent = name();
    Array.prototype.forEach.call(document.querySelectorAll('[data-dp-pa-name]'), function (el) { el.textContent = name(); });
    var rail = document.querySelector('#s5 .dp-pa-rail'); if (rail) rail.setAttribute('aria-label', 'Reiter ' + (an ? 'des Objekt-Cockpits' : 'der Pilot-Analyse'));
    /* Weiter-Leiste unter Steuer: im Cockpit kommt nach Steuer die Bewertung */
    var fn = document.querySelector('#s3-tax .v235-tab-nav-footer');
    if (fn) {
      var st = fn.querySelector('.v235-tab-nav-hint strong'), bt = fn.querySelector('.v235-next-btn');
      var ziel = an ? 'Bewertung' : 'Pilot-Analyse';
      if (st) st.textContent = ziel;
      if (bt && bt.firstChild && bt.firstChild.nodeType === 3) bt.firstChild.nodeValue = 'Weiter: ' + ziel;
    }
  }

  /* Weiter-Knopf: im Cockpit-Modus steht s5 vorne, also beim Weiterblaettern ueberspringen */
  function weiterAnpassen() {
    var orig = window._v235GoToNextTab;
    if (typeof orig !== 'function' || orig._dpOc) return;
    var neu = function (cur) {
      if (!aktiv()) return orig.apply(this, arguments);
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs .tab[data-target-sec]'))
        .filter(function (t) { return t.getAttribute('data-target-sec') !== 's5'; });
      var i = tabs.findIndex(function (t) { return t.getAttribute('data-target-sec') === cur; });
      if (i < 0 || i >= tabs.length - 1) return orig.apply(this, arguments);
      tabs[i + 1].click();
      try { setTimeout(function () { window.scrollTo(0, 0); }, 100); } catch (e) {}
    };
    neu._dpOc = true;
    window._v235GoToNextTab = neu;
  }

  /* Zum Reiter springen (fuer Absprünge aus anderen Modulen): immer s5, egal wie er heisst */
  function oeffnen(unter) {
    var k = document.querySelector('nav.tabs .tab[data-target-sec="s5"]');
    if (k) k.click();
    if (unter) setTimeout(function () {
      try { var b = document.querySelector('#s5 .dp-pa-tab[onclick*="\'' + unter + '\'"]'); if (b) b.click(); } catch (e) {}
    }, 150);
  }

  window.DpObjektCockpit = { aktiv: aktiv, name: name, anwenden: anwenden, oeffnen: oeffnen };

  function los() {
    anwenden(true); weiterAnpassen();
    /* Handy: die Leiste scrollt; gemessen v4460c stand sie nach dem Laden bei 75 px, das Cockpit lag links ausserhalb.
       Nach dem Laden eines gewonnenen Objekts an den Anfang rollen. */
    var anfang = function () { try { if (aktiv()) { var n = document.querySelector('nav.tabs'); if (n && n.scrollWidth > n.clientWidth) n.scrollLeft = 0; } } catch (e) {} };
    window.addEventListener('dp:object-ready', function () { setTimeout(function () { anwenden(true); anfang(); }, 50); setTimeout(function () { anwenden(true); anfang(); }, 600); setTimeout(anfang, 1500); });
    /* Status-Wechsel in der Deal-Aktion und der Umschalter Ankauf/Bestand feuern kein eigenes Ereignis:
       leichter Abgleich (nur Lesen, kein Schreiben), wirkt sofort ohne Neuladen */
    setInterval(function () { try { anwenden(false); } catch (e) {} }, 700);
    try {
      var DA = window.DealPilotDealAction;
      if (DA && typeof DA.setStatus === 'function' && !DA.setStatus._dpOc) {
        var o = DA.setStatus; DA.setStatus = function () { var r = o.apply(this, arguments); setTimeout(function () { anwenden(true); }, 0); return r; }; DA.setStatus._dpOc = true;
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
})();
