/* v4870 · Arbeitsbereich „Ansicht anpassen“ für das Portfolio-Cockpit.
   Marcel 25.11.2026: „Der Baukasten ist viel zu schwierig. Ein Modal im DealPilot-Stil, man sieht den Arbeitsbereich
   und kann sich das modular zusammenschieben und zusammenbauen. Wirklich interaktiv.“
   Ein großes Fenster: oben Vorlagen mit Mini-Vorschau, links die Palette (gruppiert), in der Mitte der Arbeitsbereich
   als verkleinerte Vorschau des Cockpits. Module und Kennzahlen werden gezogen, in der Breite umgestellt, hinzugefügt
   und entfernt. Score-Kopf fest oben. Schließt nur über ×, Fertig oder Esc, nie per Klick daneben (Marcel 24.11.2026).
   Gespeichert wird über grafiken-portfolio.js (DpGrafikenPortfolio.api), dasselbe Datenformat wie die Seitenleiste
   (cockpit_ansicht v: 2). Ohne diese Datei öffnet „Ansicht anpassen“ weiter die Seitenleiste. */
(function () {
  'use strict';
  var API = null, _offen = false, _vorher = null, _rueck = [], _zug = null, _klein = false, _kzCache = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  /* Gruppen der Palette. Was hier fehlt, landet unter „Wert und Vermögen“. */
  var GRUPPEN = [
    { k: 'obj', t: 'Objekte', m: ['om', 'zielbild', 'x-gal', 'det', 'x-mieteist', 'x-qm'] },
    { k: 'fin', t: 'Finanzierung', m: ['bk', 'x-zb', 'x-fj', 'x-zs', 'x-treppe', 'x-sich', 'x-argu', 'x-kapdienst', 'x-wertdarl', 'x-spread', 'gesamtproj'] },
    { k: 'ren', t: 'Rendite und Cashflow', m: ['ob', 'x-cf', 'x-br', 'x-ek', 'x-rq', 'x-ke', 'x-ekstapel', 'x-hebelsens', 'x-streu', 'x-umsch'] },
    { k: 'st', t: 'Steuer', m: ['steuer', 'x-st', 'x-tp'] },
    { k: 'ris', t: 'Risiko und Ziele', m: ['x-rm', 'x-rd', 'x-todo', 'x-zbal'] },
    { k: 'wert', t: 'Wert und Vermögen', m: ['gb', 'projektion', 'x-wz', 'x-vp', 'x-restwert', 'x-mh', 'x-zus', 'pp', 'x-lead'] }
  ];
  /* Bildzeichen je Modul für Palette und leere Vorschau */
  function bildArt(k) {
    if (/zielbild|gesamtproj|det|x-rm|x-sich|x-zs/.test(k)) return 'tab';
    if (/om|x-gal/.test(k)) return 'karten';
    if (/projektion|x-vp|x-restwert|x-hebelsens|x-fj/.test(k)) return 'linie';
    if (/x-todo|x-argu|x-lead|pp|x-umsch/.test(k)) return 'text';
    if (/gb|x-zus|x-tp/.test(k)) return 'kacheln';
    return 'balken';
  }
  function piktogramm(k) {
    var a = bildArt(k), h = '<span class="pw-pik pw-pik-' + a + '" aria-hidden="true">';
    if (a === 'balken') h += '<i style="height:60%"></i><i style="height:85%"></i><i style="height:40%"></i><i style="height:70%"></i><i style="height:52%"></i>';
    else if (a === 'linie') h += '<svg viewBox="0 0 60 24" preserveAspectRatio="none"><polyline points="0,20 12,16 24,17 36,10 48,8 60,4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    else if (a === 'tab') h += '<i></i><i></i><i></i><i></i>';
    else if (a === 'karten') h += '<i></i><i></i><i></i><i></i><i></i><i></i>';
    else if (a === 'kacheln') h += '<i></i><i></i><i></i>';
    else h += '<i style="width:90%"></i><i style="width:70%"></i><i style="width:80%"></i>';
    return h + '</span>';
  }
  /* v4890 · Symbol je Gruppe der Palette (Marcel 25.11.2026: „ein kleines Bild für Objekte, Finanzierung, Rendite, Steuern …“).
     Linien in currentColor, die Farbe kommt aus dem Whitelabel-Token der Gruppe-Überschrift. */
  var SYM = {
    obj: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    fin: '<path d="M3 9l9-5 9 5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
    ren: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    st: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6"/>',
    ris: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    wert: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/>',
    kz: '<path d="M4 18a8 8 0 1116 0"/><path d="M12 18l4-6"/><circle cx="12" cy="18" r="1.4"/>',
    rest: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
  };
  function symbol(g) { return '<svg class="pw-sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SYM[g] || SYM.rest) + '</svg>'; }
  function modul(k) { return API.ansicht.filter(function (a) { return a.k === k; })[0] || null; }
  function kz(k) { return API.kzdef.filter(function (d) { return d.k === k; })[0] || { k: k, t: k }; }
  /* v4890 · Wert einer Kennzahl wie im Cockpit (Karte aus grafiken-portfolio.js, nur gelesen) */
  var _kzCache = {};
  function kzWert(k) {
    if (_kzCache[k]) return _kzCache[k];
    var r = { l: kz(k).t, v: '', s: '', c: '' };
    try {
      var h = API.kzKachel ? API.kzKachel(k) : null;
      if (h) {
        var d = document.createElement('div'); d.innerHTML = h;
        var l = d.querySelector('.gp-l'), v = d.querySelector('.gp-v'), s = d.querySelector('.gp-s');
        if (l) r.l = l.textContent.trim(); if (v) { r.v = v.textContent.trim(); r.c = /gp-pos/.test(v.className) ? 'pos' : /gp-neg/.test(v.className) ? 'neg' : ''; }
        if (s) r.s = s.textContent.trim();
      }
    } catch (e) {}
    _kzCache[k] = r; return r;
  }

  /* ── Stand ändern, mit Rückgängig ── */
  function merken() { _rueck.push(kopie(API.stand())); if (_rueck.length > 40) _rueck.shift(); }
  function anwenden(mitKz) { var A = API.stand(); A.vorlage = A.vorlage || null; API.speichern(!!mitKz); zeichnen(); }
  function aendern(fn, mitKz) { merken(); var A = API.stand(); fn(A); A.vorlage = null; A.gewaehlt = true; anwenden(mitKz); }

  /* Reihenfolge der sichtbaren Module im Raster */
  function aktiv() { var A = API.stand(); return A.ord.filter(function (k) { var a = modul(k); if (!a) return false; if (a.gruppe) return A.ordVb.some(function (v) { return A.an[v]; }); return !!A.an[k]; }); }
  function kzAktiv() { return (API.stand().kz || API.kzStandard()).filter(function (x) { return x.an; }).map(function (x) { return x.k; }); }

  function verschieben(k, ziel) {   /* k vor das Modul ziel (null = ans Ende der sichtbaren) */
    aendern(function (A) {
      var L = A.ord, i = L.indexOf(k); if (i < 0) return; L.splice(i, 1);
      var j = ziel ? L.indexOf(ziel) : -1;
      if (j < 0) { var vis = aktiv().filter(function (x) { return x !== k; }), last = vis.length ? L.indexOf(vis[vis.length - 1]) : -1; L.splice(last + 1, 0, k); }
      else L.splice(j, 0, k);
    });
  }
  function schritt(k, r) { var vis = aktiv(), i = vis.indexOf(k), j = i + r; if (i < 0 || j < 0 || j >= vis.length) return; verschieben(k, r < 0 ? vis[j] : (vis[j + 1] || null)); }
  function hinzu(k, ziel) {
    var a = modul(k); if (!a) return;
    aendern(function (A) {
      if (a.vb) { A.an[k] = true; return; }
      A.an[k] = true; var L = A.ord, i = L.indexOf(k); if (i >= 0) L.splice(i, 1);
      var j = ziel ? L.indexOf(ziel) : -1;
      if (j < 0) { var vis = aktiv(), last = vis.length ? L.indexOf(vis[vis.length - 1]) : -1; L.splice(last + 1, 0, k); } else L.splice(j, 0, k);
    });
    melden(a.t + ' hinzugefügt');
  }
  function weg(k) {
    var a = modul(k); if (!a) return;
    aendern(function (A) { if (a.gruppe) API.vbk.forEach(function (v) { A.an[v] = false; }); else A.an[k] = false; });
    melden(a.t + ' entfernt');
  }
  function breiteUm(k) { aendern(function (A) { A.br[k] = (A.br[k] === 'halb') ? 'ganz' : 'halb'; }); }
  function kzSchieben(k, ziel) {
    aendern(function (A) {
      var L = A.kz || (A.kz = API.kzStandard()), i = L.findIndex(function (x) { return x.k === k; }); if (i < 0) return;
      var x = L.splice(i, 1)[0]; x.an = true;
      var j = ziel ? L.findIndex(function (y) { return y.k === ziel; }) : -1;
      if (j < 0) { var last = -1; L.forEach(function (y, n) { if (y.an) last = n; }); L.splice(last + 1, 0, x); } else L.splice(j, 0, x);
    }, true);
  }
  function kzSchritt(k, r) { var v = kzAktiv(), i = v.indexOf(k), j = i + r; if (i < 0 || j < 0 || j >= v.length) return; kzSchieben(k, r < 0 ? v[j] : (v[j + 1] || null)); }
  function kzWeg(k) { aendern(function (A) { (A.kz || []).forEach(function (x) { if (x.k === k) x.an = false; }); }, true); melden(kz(k).t + ' entfernt'); }
  function kzHinzu(k, ziel) { kzSchieben(k, ziel); melden(kz(k).t + ' hinzugefügt'); }
  function vorlage(k) {
    var v = API.vorlagen.filter(function (x) { return x.k === k; })[0]; if (!v) return;
    merken(); var A = API.ausVorlage(v); A.gewaehlt = true;
    if (v.kz) { A.kz = v.kz.map(function (x) { return { k: x, an: true }; }); API.kzdef.forEach(function (d) { if (v.kz.indexOf(d.k) < 0) A.kz.push({ k: d.k, an: false }); }); }
    API.setzen(A); var B = API.stand(); B.vorlage = v.k; B.gewaehlt = true; API.speichern(true); zeichnen(); melden('Vorlage ' + v.t + ' übernommen');
  }
  function zuruecksetzen() { merken(); var v = API.vorlagen[0], A = API.ausVorlage(v); A.kz = API.kzStandard(); API.setzen(A); API.stand().vorlage = v.k; API.speichern(true); zeichnen(); melden('Auf ' + v.t + ' zurückgesetzt'); }
  function rueckgaengig() { if (!_rueck.length) return; API.setzen(_rueck.pop()); API.speichern(true); zeichnen(); melden('Rückgängig'); }

  /* ── Echte Mini-Bilder (v4900, Marcel 25.11.2026: „echtes verkleinertes Vorschaubild wie in den Demos“) ──
     Jeder Baustein wird so gezeigt, wie er im Cockpit aussieht: steht er schon im Cockpit, als Klon; sonst wird er
     unsichtbar außerhalb des Bildschirms mit demselben Zeichner (DpPfModell.zeichne) und denselben Daten gezeichnet.
     Ergebnis je Baustein zwischengespeichert, solange das Fenster offen ist. Nur gelesen, nichts gespeichert. */
  var _mini = {}, _vmini = {}, _score = null;
  function appEl() { var h = document.getElementById('dp-pscore-hero'); return h ? h.parentNode : null; }
  function appBreite() { var a = appEl(); return (a && a.offsetWidth) || 1100; }
  /* Die Cockpit-Regeln hängen an #dashboard-main #dp-stage .app: die Vorschau bekommt dieselbe Hülle (nur Klassen;
     die echten Elemente stehen im Dokument davor und gewinnen bei getElementById) */
  function huelle(inner) {
    var app = appEl(), st = document.getElementById('dp-stage'), dm = document.getElementById('dashboard-main');
    if (!st || !dm || !app) return inner;
    return '<div id="dashboard-main" class="' + esc(dm.className) + '" style="all:unset;display:block"><div id="dp-stage" class="' + esc(st.className) + '" style="max-width:none;margin:0;padding:0"><div class="' + esc(app.className) + '" style="max-width:none;margin:0;padding:0">' + inner + '</div></div></div>';
  }
  function saeubern(c) {
    [].forEach.call(c.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); }); c.removeAttribute('id');
    [].forEach.call(c.querySelectorAll('[tabindex]'), function (n) { n.setAttribute('tabindex', '-1'); });
    /* Bedienelemente im Bild werden zu reinen Spans: ein <button> im Bild würde den Knopf der Palette bzw. Vorlage
       beim Einlesen des HTML schließen (verschachtelte Knöpfe sind nicht erlaubt) und das Fenster zerreißen */
    [].slice.call(c.querySelectorAll('button,a,select,textarea,input,label')).reverse().forEach(function (n) {   /* innen zuerst */
      var s = document.createElement('span'); s.className = n.className; var st = n.getAttribute('style'); if (st) s.setAttribute('style', st);
      s.style.display = s.style.display || (/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName) ? 'inline-block' : '');
      s.innerHTML = n.tagName === 'INPUT' ? esc(n.value || n.getAttribute('placeholder') || '') : n.tagName === 'SELECT' ? esc((n.options[n.selectedIndex] || {}).text || '') : n.innerHTML;
      if (n.parentNode) n.parentNode.replaceChild(s, n);
    });
    c.classList.remove('gp-aus'); c.style.order = ''; c.style.margin = '0'; c.style.display = '';
    return c;
  }
  function offscreen() {
    var o = document.getElementById('pw-off'); if (o) return o.querySelector('.pw-off-ziel');
    o = document.createElement('div'); o.id = 'pw-off'; o.setAttribute('aria-hidden', 'true');
    o.style.cssText = 'position:absolute;left:-30000px;top:0;width:' + appBreite() + 'px;visibility:hidden;pointer-events:none';
    o.innerHTML = huelle('<div class="pw-off-ziel"></div>'); document.body.appendChild(o);
    return o.querySelector('.pw-off-ziel');
  }
  function miniHtml(k) {
    if (Object.prototype.hasOwnProperty.call(_mini, k)) return _mini[k];
    var a = modul(k), el = API.ziel(k), W = appBreite(), halb = a && a.b === 'halb', r = null;
    try {
      if (el && el.innerHTML && el.innerHTML.length > 80 && el.offsetHeight) r = { h: saeubern(el.cloneNode(true)).outerHTML, w: el.offsetWidth || W };
      else if (a && a.x && window.DpPfModell && DpPfModell.E) {
        var z = offscreen(), host = document.createElement('div'), ww = halb ? Math.round(W / 2 - 8) : W;
        host.setAttribute('data-dp-gp', k); host.className = 'dp-gp gp-karte gp-pfm dp-gx dp-gx-frei pfm'; host.style.width = ww + 'px';
        z.appendChild(host);
        if (DpPfModell.zeichne(host, a.x) !== false && host.innerHTML.length > 40) r = { h: saeubern(host.cloneNode(true)).outerHTML, w: ww };
        z.removeChild(host);
      } else if (el && el.innerHTML && el.innerHTML.length > 80) {   /* im Cockpit ausgeblendet, aber gezeichnet */
        var z2 = offscreen(), c = saeubern(el.cloneNode(true)); z2.appendChild(c);
        if (c.offsetHeight > 20) r = { h: c.outerHTML, w: c.offsetWidth || W };
        z2.removeChild(c);
      }
      if (!r && API.modulHtml) {   /* v4900 · ausgeblendete Cockpit-Bausteine (Objektmatrix, Gesamtbewertung …) aus dem letzten Zeichnen */
        var hh = API.modulHtml(k);
        if (hh) {
          var z3 = offscreen(), h3 = document.createElement('div'), w3 = halb ? Math.round(W / 2 - 8) : W;
          h3.setAttribute('data-dp-gp', k); h3.className = 'dp-gp'; h3.style.width = w3 + 'px'; h3.innerHTML = hh; z3.appendChild(h3);
          if (h3.offsetHeight > 20) r = { h: saeubern(h3.cloneNode(true)).outerHTML, w: w3 };
          z3.removeChild(h3);
        }
      }
    } catch (e) { r = null; }
    _mini[k] = r; return r;
  }
  /* Kasten mit verkleinertem Bild; skalieren() setzt Faktor und Höhe nach der Breite des Kastens */
  /* v4900g · Ein Modul offscreen zu zeichnen kostet ~350 ms (gemessen), 42 Module + Vorlagen blockierten das Öffnen 20 s.
     Deshalb: sofort Piktogramm, das echte Bild kommt einzeln nach (nachladen), Sichtbares zuerst */
  function billig(k) {
    if (Object.prototype.hasOwnProperty.call(_mini, k)) return true;
    var el = API.ziel(k); return !!(el && el.innerHTML && el.innerHTML.length > 80 && el.offsetHeight);
  }
  function miniBox(k, cls, maxH) {
    if (_klein && (cls === 'pw-live' || cls === 'pw-pmini')) return '<div class="pw-leer ' + cls + '-leer">' + piktogramm(k) + '</div>';   /* Handy: nur die Vorlagen zeichnen, der Rest bremst die Bedienung */
    if (!billig(k)) { warte(k); return '<div class="pw-leer pw-wartet ' + cls + '-leer" data-mk="' + k + '" data-cls="' + cls + '" data-mh="' + maxH + '">' + piktogramm(k) + '</div>'; }
    var m = miniHtml(k);
    if (!m) return '<div class="pw-leer ' + cls + '-leer">' + piktogramm(k) + '</div>';
    return '<div class="pw-mini ' + cls + '" data-maxh="' + maxH + '" aria-hidden="true" inert><div class="pw-mini-in" data-ew="' + m.w + '" style="width:' + m.w + 'px">' + huelle(m.h) + '</div></div>';
  }
  /* Score-Kopf so, wie er im Cockpit steht (echte Werte), sonst gekennzeichnete Beispielwerte */
  /* v4985 · Der Klon verliert die ID (keine doppelten IDs), und damit fielen die kompakten Regeln von
     dpsh-score-hero.js (v4830, alle an #dp-pscore-hero) weg: die Vorschau zeigte die große, aufgeklappte Fassung.
     Deshalb werden genau diese Regeln aus den geladenen Stylesheets auf #dp-pw .pw-psk umgeschrieben. */
  function scoreRegeln() {
    if (document.getElementById('pw-psk-stil')) return;
    function lauf(rules) {
      var out = [];
      [].forEach.call(rules || [], function (r) {
        if (r.media && r.cssRules) { var inn = lauf(r.cssRules); if (inn.length) out.push('@media ' + r.media.mediaText + '{' + inn.join('') + '}'); return; }
        if (!r.selectorText || r.selectorText.indexOf('#dp-pscore-hero') < 0) return;
        var sel = r.selectorText.split(',').filter(function (x) { return x.indexOf('#dp-pscore-hero') >= 0; })
          .map(function (x) { return x.slice(x.indexOf('#dp-pscore-hero')).replace(/#dp-pscore-hero/g, '#dp-pw .pw-psk'); }).join(',');
        out.push(sel + '{' + r.style.cssText + '}');
      });
      return out;
    }
    var alle = [];
    [].forEach.call(document.styleSheets, function (sh) { try { alle = alle.concat(lauf(sh.cssRules)); } catch (e) {} });
    var st = document.createElement('style'); st.id = 'pw-psk-stil'; st.textContent = alle.join('\n'); document.head.appendChild(st);
  }
  function scoreHtml() {
    if (_score) return _score;
    var h = document.getElementById('dp-pscore-hero');
    if (h && h.innerHTML.length > 80 && h.offsetHeight) {
      scoreRegeln();
      var c = saeubern(h.cloneNode(true)); c.classList.add('pw-psk');
      _score = { h: c.outerHTML, w: h.offsetWidth, echt: true };
    }
    else _score = { h: '<div style="background:#0A0A0A;color:#FDFCFA;border-radius:12px;padding:18px 22px;font:600 18px Space Grotesk,sans-serif">Investor Portfolio Score <span style="color:var(--wl-c9a84c, #C9A84C)">72</span> · Investment 70 · Finanzierung 75 <small style="font:400 13px Inter;color:#C9C1B1">Beispielwerte, noch keine Objekte im Bestand</small></div>', w: appBreite(), echt: false };
    return _score;
  }
  /* Vorlage als echtes, verkleinertes Bild: Score-Kopf und die ersten Bausteine im Raster der Vorlage */
  function vorlageMini(v) {
    if (!_vmini[v.k]) {
      var fehlt = v.m.slice(0, 5).filter(function (x) { return !billig(x[0]); });
      if (fehlt.length) { fehlt.forEach(function (x) { warte(x[0]); }); return '<span class="pw-vm pw-leer pw-wartet pw-vwartet" data-vk="' + v.k + '">' + piktogramm('kz') + '</span>'; }
      var W = appBreite(), s = scoreHtml();
      var mods = v.m.slice(0, 5).map(function (x) {
        var m = miniHtml(x[0]);
        return '<div style="grid-column:' + (x[1] === 'ganz' ? '1/-1' : 'auto') + ';min-width:0;max-height:420px;overflow:hidden">' + (m ? m.h : '<div style="height:160px;border-radius:10px;background:#EFE9DC"></div>') + '</div>';
      }).join('');
      _vmini[v.k] = '<span class="pw-vm pw-mini" data-maxh="56" aria-hidden="true" inert><span class="pw-mini-in" data-ew="' + W + '" style="width:' + W + 'px;display:block">' + huelle(s.h + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">' + mods + '</div>') + '</span></span>';
    }
    return _vmini[v.k];
  }
  var _warte = [], _wLauf = 0, _wGen = 0;
  function warte(k) { if (_warte.indexOf(k) < 0) _warte.push(k); if (!_wLauf) { _wLauf = 1; var g = _wGen; setTimeout(function () { ladeSchritt(g); }, 30); } }
  function sichtbar(el, box) { var r = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right; }
  function ladeSchritt(g) {
    var p = document.getElementById('dp-pw');
    if (g !== _wGen || !p) { _wLauf = 0; return; }
    _warte = _warte.filter(function (k) { return !Object.prototype.hasOwnProperty.call(_mini, k); });
    if (!_warte.length) { _wLauf = 0; vorlagenNach(p); return; }
    /* Vorrang: was gerade im Arbeitsbereich oder in der Palette zu sehen ist */
    var k = null;
    [p.querySelector('.pw-ab'), p.querySelector('.pw-pliste')].some(function (box) {
      if (!box) return false;
      var e = [].filter.call(box.querySelectorAll('.pw-wartet[data-mk]'), function (x) { return sichtbar(x, box); })[0];
      if (e) k = e.getAttribute('data-mk'); return !!k;
    });
    if (!k || _warte.indexOf(k) < 0) k = _warte[0];
    _warte.splice(_warte.indexOf(k), 1);
    miniHtml(k);
    [].slice.call(p.querySelectorAll('.pw-wartet[data-mk="' + k + '"]')).forEach(function (x) {
      var t = document.createElement('div'); t.innerHTML = miniBox(k, x.getAttribute('data-cls'), Number(x.getAttribute('data-mh')));
      var n = t.firstChild; x.parentNode.replaceChild(n, x); skalierenIn(n);
    });
    vorlagenNach(p);
    setTimeout(function () { ladeSchritt(g); }, 16);
  }
  function vorlagenNach(p) {
    [].slice.call(p.querySelectorAll('.pw-vwartet')).forEach(function (x) {
      var v = API.vorlagen.filter(function (y) { return y.k === x.getAttribute('data-vk'); })[0];
      if (!v || v.m.slice(0, 5).some(function (y) { return !Object.prototype.hasOwnProperty.call(_mini, y[0]); })) return;
      var t = document.createElement('div'); t.innerHTML = vorlageMini(v); var n = t.firstChild; x.parentNode.replaceChild(n, x); skalierenIn(n);
    });
  }
  function vorschau(k) { return miniBox(k, 'pw-live', 210); }
  function block(k) {
    var a = modul(k), A = API.stand(), halb = (A.br[k] || a.b) === 'halb';
    var sub = a.gruppe ? '<div class="pw-sub">' + A.ordVb.filter(function (v) { return A.an[v]; }).map(function (v) { var m = modul(v); return '<span>' + esc(m.t) + '<button type="button" data-pw="vbweg" data-k="' + v + '" aria-label="' + esc(m.t) + ' entfernen">×</button></span>'; }).join('') + '</div>' : '';
    return '<div class="pw-b' + (halb ? ' pw-halb' : '') + '" draggable="true" tabindex="0" role="listitem" data-k="' + k + '" aria-label="' + esc(a.t) + ', ' + (halb ? 'halbe' : 'volle') + ' Breite. Pfeiltasten verschieben, B Breite, Entfernen löschen">'
      + '<div class="pw-bk"><span class="pw-griff" aria-hidden="true">⋮⋮</span><b>' + esc(a.t) + '</b>'
      + '<span class="pw-akt"><button type="button" data-pw="breite" data-k="' + k + '" title="Breite umstellen">' + (halb ? '½' : 'ganz') + '</button>'
      + '<button type="button" data-pw="weg" data-k="' + k + '" title="Entfernen" aria-label="' + esc(a.t) + ' entfernen">×</button></span></div>'
      + sub + vorschau(a.gruppe ? 'projektion' : k) + '</div>';
  }
  /* v4985 · Runde 4: Gruppen als Reiter wie im Einstellungen-Fenster. v4995 · Runde 5: Gruppen als Symbolleiste über der Palette in der dunklen Spalte (siehe palette()). */
  var _gruppe = 'kz', _tabs = [];
  function gruppenListe() {
    var A = API.stand(), an = {}; aktiv().forEach(function (k) { an[k] = 1; });
    var kzan = {}, kzA = kzAktiv(); kzA.forEach(function (k) { kzan[k] = 1; });
    var out = [{ k: 'kz', t: 'Kennzahlen', d: kzA.length + ' oben im Cockpit', L: API.kzdef.filter(function (d) { return !kzan[d.k]; }).map(function (d) { return d.k; }) }];
    var gesehen = {};
    GRUPPEN.forEach(function (g) { g.m.forEach(function (k) { gesehen[k] = 1; }); });
    var rest = API.ansicht.filter(function (a) { return !a.fest && !a.vb && !gesehen[a.k]; }).map(function (a) { return a.k; });
    GRUPPEN.concat(rest.length ? [{ k: 'rest', t: 'Weitere', m: rest }] : []).forEach(function (g) {
      var alle = g.m.filter(function (k) { var a = modul(k); return a && !a.fest && !a.vb; });
      var L = alle.filter(function (k) { return !an[k]; }), drin = alle.length - L.length;
      if (g.k === 'wert') { API.vbk.forEach(function (v) { if (!A.an[v]) L.push(v); }); }
      out.push({ k: g.k, t: g.t, d: drin + ' im Cockpit · ' + L.length + ' zur Auswahl', L: L });
    });
    return out;
  }
  /* v4995 · Runde 5 (Marcel): „alles, was man reinziehen kann, links im Schwarzen … oben nur Symbole für die Bereiche,
     dann scrollt er da automatisch hin“. Die dunkle Seitenspalte ist die Palette, alle Gruppen untereinander. */
  function palette() {
    var G = gruppenListe(); _tabs = G;
    return G.map(function (g) {
      var kopf = '<div class="pw-pt" id="pw-g-' + g.k + '">' + symbol(g.k) + '<span>' + esc(g.t) + '</span><small>' + esc(g.d) + '</small></div>';
      if (!g.L.length) return '<div class="pw-pg" data-g="' + g.k + '">' + kopf + '<p class="pw-pleer">' + (g.k === 'kz' ? 'Alle Kennzahlen stehen schon oben im Cockpit.' : 'Alle Bausteine dieser Gruppe stehen schon im Cockpit.') + '</p></div>';
      if (g.k === 'kz') return '<div class="pw-pg" data-g="kz">' + kopf + '<div class="pw-pl pw-pl-kz">' + g.L.map(function (k) {
        var w = kzWert(k);
        return '<button type="button" class="pw-pi pw-pkz" draggable="true" data-pw="kzhinzu" data-k="' + k + '" title="Ziehen oder klicken: erscheint oben in der Kennzahl-Leiste"><span class="pw-kzl">' + esc(w.l) + '</span><b class="pw-kzv' + (w.c ? ' pw-' + w.c : '') + '">' + esc(w.v || '·') + '</b><i aria-hidden="true">+</i></button>';
      }).join('') + '</div></div>';
      return '<div class="pw-pg" data-g="' + g.k + '">' + kopf + '<div class="pw-pl">' + g.L.map(function (k) {
        var a = modul(k);
        return '<button type="button" class="pw-pi pw-pim" draggable="true" data-pw="hinzu" data-k="' + k + '" title="' + esc(a.w || '') + '"><span class="pw-pit"><b>' + esc(a.t) + (a.vb ? '<small>in Projektion und Verlauf</small>' : '') + '</b><i aria-hidden="true">+</i></span>'
          + miniBox(a.vb ? 'projektion' : k, 'pw-pmini', 88) + '</button>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function reiterHtml() {
    return (_klein ? '<button type="button" class="pw-lade" data-pw="schublade" aria-expanded="false">Bausteine</button>' : '')
      + _tabs.map(function (t) {
        return '<button type="button" class="pw-symk" data-pw="tab" data-k="' + t.k + '" title="' + esc(t.t) + '" aria-label="' + esc(t.t) + '">' + symbol(t.k) + '</button>';
      }).join('');
  }
  function zeichnen() {
    var p = document.getElementById('dp-pw'); if (!p) return;
    _klein = window.innerWidth <= 768;   /* Umbruch wie das Einstellungen-Fenster */ p.classList.toggle('pw-klein', _klein);
    var A = API.stand();
    var fok = document.activeElement && p.contains(document.activeElement) ? [document.activeElement.getAttribute('data-pw') || 'blk', document.activeElement.getAttribute('data-k')] : null;
    p.querySelector('.pw-vl').innerHTML = API.vorlagen.map(function (v) {
      return '<button type="button" class="pw-v' + (A.vorlage === v.k ? ' an' : '') + '" data-pw="vorlage" data-k="' + v.k + '" aria-pressed="' + (A.vorlage === v.k) + '" title="' + esc(v.u) + '">' + vorlageMini(v) + '<b>' + esc(v.t) + '</b></button>';
    }).join('');
    var pl = p.querySelector('.pw-pliste'), st = pl.scrollTop;
    pl.innerHTML = palette(); pl.scrollTop = st;
    p.querySelector('.pw-ptabs').innerHTML = reiterHtml(); reiterAktiv();
    if (_klein) schublade(p.classList.contains('pw-lade-auf'));
    var s = scoreHtml();
    p.querySelector('.pw-score').innerHTML = '<div class="pw-mini pw-scorebild" data-maxh="320" aria-hidden="true" inert><div class="pw-mini-in" data-ew="' + s.w + '" style="width:' + s.w + 'px">' + huelle(s.h) + '</div></div>'
      + '<span class="pw-fest" title="Der Score-Kopf steht immer oben">fest' + (s.echt ? '' : ' · Beispielwerte') + '</span>';
    var K = kzAktiv();
    /* v4890 · Kennzahlen erscheinen so, wie sie oben im Cockpit stehen: Karte mit Bezeichnung, Wert und Zusatz */
    p.querySelector('.pw-kz').innerHTML = K.map(function (k, i) {
      var w = kzWert(k);
      return '<div class="pw-kzc' + (i === 0 ? ' pw-kzh' : '') + '" draggable="true" tabindex="0" role="listitem" data-kz="' + k + '" aria-label="Kennzahl ' + esc(w.l) + (w.v ? ', ' + esc(w.v) : '') + '. Pfeiltasten verschieben, Entfernen löschen">'
        + '<span class="pw-kzl">' + esc(w.l) + '</span><b class="pw-kzv' + (w.c ? ' pw-' + w.c : '') + '">' + esc(w.v || '·') + '</b>' + (w.s ? '<span class="pw-kzs">' + esc(w.s) + '</span>' : '')
        + '<button type="button" data-pw="kzweg" data-k="' + k + '" aria-label="' + esc(w.l) + ' entfernen">×</button></div>';
    }).join('') + '<div class="pw-kzdrop" data-kz-ende="1">+ Kennzahl hierher ziehen</div>';
    p.querySelector('.pw-raster').innerHTML = aktiv().map(block).join('') + '<div class="pw-drop" data-ende="1">Modul hierher ziehen oder links anklicken</div>';
    skalieren();
    p.querySelector('[data-pw="rueck"]').disabled = !_rueck.length;
    if (fok) {
      var sel = fok[0] === 'blk' ? (fok[1] ? '.pw-b[data-k="' + fok[1] + '"]' : null) : '[data-pw="' + fok[0] + '"]' + (fok[1] ? '[data-k="' + fok[1] + '"]' : '');
      var el = sel && p.querySelector(sel); if (!el && fok[1]) el = p.querySelector('[data-kz="' + fok[1] + '"],.pw-b[data-k="' + fok[1] + '"]');
      if (el) el.focus();
    }
  }
  function skalieren() { skalierenIn(document.getElementById('dp-pw')); }
  function skalierenIn(p) {
    if (!p) return;
    [].forEach.call(p.classList && p.classList.contains('pw-mini') ? p.querySelectorAll(':scope > .pw-mini-in') : p.querySelectorAll('.pw-mini-in'), function (x) {
      /* maßstäblich: das Bild rechnet mit der echten Breite des Bausteins im Cockpit und wird auf die Kastenbreite verkleinert */
      var box = x.parentNode.clientWidth || 300, w = Number(x.getAttribute('data-ew')) || 900, f = Math.min(1, box / w), mx = Number(x.parentNode.getAttribute('data-maxh')) || 210;
      x.style.width = w + 'px'; x.style.transform = 'scale(' + f.toFixed(4) + ')';
      x.parentNode.style.height = Math.min(mx, Math.max(24, Math.round((x.scrollHeight || 300) * f))) + 'px';
    });
  }
  function reiterAktiv() {
    var p = document.getElementById('dp-pw'); if (!p) return;
    var pl = p.querySelector('.pw-pliste'), top = pl.getBoundingClientRect().top, akt = null;
    [].forEach.call(pl.querySelectorAll('.pw-pg'), function (g) { if (g.getBoundingClientRect().top - top < 48) akt = g.getAttribute('data-g'); });
    if (pl.scrollTop + pl.clientHeight >= pl.scrollHeight - 4) { var l = pl.querySelectorAll('.pw-pg'); if (l.length) akt = l[l.length - 1].getAttribute('data-g'); }
    if (_sprungZiel) akt = _sprungZiel;
    if (!akt) { var f0 = pl.querySelector('.pw-pg'); akt = f0 && f0.getAttribute('data-g'); }
    _gruppe = akt;
    [].forEach.call(p.querySelectorAll('.pw-symk'), function (t) { var an = t.getAttribute('data-k') === akt; t.classList.toggle('an', an); if (an) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
  }
  var _sprungZiel = null, _sprungUhr = 0;
  function reiterSprung(g) {
    var p = document.getElementById('dp-pw'); if (!p) return;
    popWeg();
    if (_klein) schublade(true);
    var pl = p.querySelector('.pw-pliste'), z = pl.querySelector('.pw-pg[data-g="' + g + '"]'); if (!z) return;
    _sprungZiel = g; clearTimeout(_sprungUhr); _sprungUhr = setTimeout(function () { _sprungZiel = null; reiterAktiv(); }, 700);
    pl.scrollTo({ top: Math.max(0, z.getBoundingClientRect().top - pl.getBoundingClientRect().top + pl.scrollTop - 6), behavior: 'smooth' });
    reiterAktiv();
  }
  function schublade(auf) {
    var p = document.getElementById('dp-pw'); if (!p) return;
    auf = auf == null ? !p.classList.contains('pw-lade-auf') : auf;
    p.classList.toggle('pw-lade-auf', auf);
    var b = p.querySelector('.pw-lade'); if (b) { b.setAttribute('aria-expanded', String(auf)); b.textContent = auf ? 'Schließen' : 'Bausteine'; }
  }
  /* Große Live-Vorschau beim Überfahren eines Bausteins in der Palette */
  function popZeigen(btn) {
    var p = document.getElementById('dp-pw'), pop = document.getElementById('pw-pop'); if (!p || !pop || _klein) return;
    var k = btn.getAttribute('data-k'), a = modul(k); if (!a) return;
    pop.innerHTML = '<div class="pw-pop-k"><b>' + esc(a.t) + '</b><small>' + esc(a.w || 'Klicken oder in den Arbeitsbereich ziehen') + '</small></div>' + miniBox(a.vb ? 'projektion' : k, 'pw-popbild', 340);
    pop.hidden = false; skalieren();
    var pr = p.getBoundingClientRect(), br = btn.getBoundingClientRect(), pal = p.querySelector('.modal-side').getBoundingClientRect();
    var top = Math.max(pr.top + 120, Math.min(br.top - 20, pr.bottom - pop.offsetHeight - 70));
    pop.style.left = (pal.right - pr.left + 10) + 'px'; pop.style.top = (top - pr.top) + 'px';
  }
  function popWeg() { var pop = document.getElementById('pw-pop'); if (pop) { pop.hidden = true; pop.innerHTML = ''; } }
  function melden(t) { var m = document.getElementById('pw-live-msg'); if (m) { m.textContent = ''; setTimeout(function () { m.textContent = t; }, 30); } }

  /* ── Ziehen ── */
  function dropZiel(ev, sel) { var t = ev.target && ev.target.closest ? ev.target.closest(sel) : null; return t; }
  function ziehenEinrichten(p) {
    p.addEventListener('dragstart', function (ev) {
      var b = ev.target.closest('.pw-b,.pw-pi,.pw-kzc'); if (!b) return; popWeg();
      _zug = b.classList.contains('pw-b') ? { art: 'mod', k: b.getAttribute('data-k') }
        : b.classList.contains('pw-kzc') ? { art: 'kz', k: b.getAttribute('data-kz') }
        : b.classList.contains('pw-pkz') ? { art: 'kzneu', k: b.getAttribute('data-k') } : { art: 'neu', k: b.getAttribute('data-k') };
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', _zug.k); } catch (e) {}
      b.classList.add('pw-zieht'); p.classList.add('pw-zug-' + (_zug.art.indexOf('kz') === 0 ? 'kz' : 'mod'));
    });
    p.addEventListener('dragend', function () { _zug = null; p.classList.remove('pw-zug-kz', 'pw-zug-mod'); [].forEach.call(p.querySelectorAll('.pw-zieht,.pw-ueber'), function (x) { x.classList.remove('pw-zieht', 'pw-ueber'); }); });
    p.addEventListener('dragover', function (ev) {
      if (!_zug) return;
      /* v4900 · Arbeitsbereich blättert beim Ziehen am oberen und unteren Rand mit */
      var ab = p.querySelector('.pw-ab'), r = ab && ab.getBoundingClientRect();
      if (r && ev.clientX > r.left && ev.clientX < r.right) { if (ev.clientY < r.top + 56) ab.scrollTop -= 16; else if (ev.clientY > r.bottom - 56) ab.scrollTop += 16; }
      var kzZiel = _zug.art === 'kz' || _zug.art === 'kzneu', t = dropZiel(ev, kzZiel ? '.pw-kzc,.pw-kzdrop' : '.pw-b,.pw-drop');
      [].forEach.call(p.querySelectorAll('.pw-ueber'), function (x) { if (x !== t) x.classList.remove('pw-ueber'); });
      if (!t) return; ev.preventDefault(); t.classList.add('pw-ueber');
    });
    p.addEventListener('drop', function (ev) {
      if (!_zug) return; ev.preventDefault();
      var z = _zug; _zug = null;
      if (z.art === 'kz' || z.art === 'kzneu') { var t = dropZiel(ev, '.pw-kzc,.pw-kzdrop'); if (!t) return; var vor = t.getAttribute('data-kz') || null; if (vor === z.k) return; z.art === 'kz' ? kzSchieben(z.k, vor) : kzHinzu(z.k, vor); return; }
      var m = dropZiel(ev, '.pw-b,.pw-drop'); if (!m) return; var ziel = m.getAttribute('data-k') || null; if (ziel === z.k) return;
      if (z.art === 'neu') hinzu(z.k, ziel); else verschieben(z.k, ziel);
    });
  }

  /* ── Tastatur ── */
  function taste(ev) {
    var p = document.getElementById('dp-pw'); if (!p) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); zu(); return; }
    var t = document.activeElement;
    if (t && p.contains(t) && (t.classList.contains('pw-b') || t.classList.contains('pw-kzc'))) {
      var istKz = t.classList.contains('pw-kzc'), k = t.getAttribute(istKz ? 'data-kz' : 'data-k');
      var r = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[ev.key];
      if (r) { ev.preventDefault(); istKz ? kzSchritt(k, r) : schritt(k, r); return; }
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); istKz ? kzWeg(k) : weg(k); return; }
      if (!istKz && (ev.key === 'b' || ev.key === 'B')) { ev.preventDefault(); breiteUm(k); return; }
    }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z')) { ev.preventDefault(); rueckgaengig(); return; }
    if (ev.key !== 'Tab') return;
    var F = [].filter.call(p.querySelectorAll('button,[tabindex="0"]'), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!F.length) return;
    var a = F[0], b = F[F.length - 1];
    if (!p.contains(document.activeElement)) { ev.preventDefault(); a.focus(); return; }
    if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); b.focus(); }
    else if (!ev.shiftKey && document.activeElement === b) { ev.preventDefault(); a.focus(); }
  }

  function zu() {
    var p = document.getElementById('dp-pw'), h = document.getElementById('dp-pw-hg');
    if (p) p.parentNode.removeChild(p); if (h) h.parentNode.removeChild(h);
    var off = document.getElementById('pw-off'); if (off) off.parentNode.removeChild(off);
    var pss = document.getElementById('pw-psk-stil'); if (pss) pss.parentNode.removeChild(pss);
    _mini = {}; _vmini = {}; _score = null; _warte = []; _wLauf = 0; _wGen++;
    _offen = false; _rueck = []; document.removeEventListener('keydown', taste, true); window.removeEventListener('resize', zeichnen);
    document.documentElement.classList.remove('pw-offen');
    try { if (_vorher && _vorher.focus) _vorher.focus(); } catch (e) {}
  }

  function vlZu() { try { return localStorage.getItem('dp_pw_vorlagen_zu') === '1'; } catch (e) { return false; } }
  function oeffnen(api) {
    if (window.DpVorschau && !api.__frei) { window.DpVorschau.frei('grafiken_neu').then(function (an) { if (an) { api.__frei = true; oeffnen(api); } }); return; }
    API = api; if (_offen) { zeichnen(); return; }
    _offen = true; _vorher = document.activeElement; _rueck = []; stil();
    /* v4985 · Runde 4: Aufbau und Klassen wie das Einstellungen-Fenster (settings.js, help.js): global-view-overlay,
       set-modal-v2 set-modal-cream, dp-modal-topband (Markenleiste + goldener Kopf), modal-side (seit v4995 die Palette mit Symbolleiste),
       set-modal-content mit pane-wrap und settings-footer (btn-ghost, btn-gold). Das Raster setzt stil() unter #dp-pw.
       Bewusst OHNE .settings-tabs: reseller-portal, mandant-freigaben und netzwerk-einreichung hängen ihre Reiter in die
       erste .settings-tabs der Seite (gemessen: „Partner-Verwaltung“ erschien hier). */
    var p = document.createElement('div'); p.id = 'dp-pw'; p.className = 'pw global-view-overlay'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'pw-t');
    _kzCache = {};
    var X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    p.innerHTML = '<div class="global-view-modal set-modal-v2 set-modal-cream pw-m">'
      + '<div class="dp-modal-topband"><div class="dp-mtb-brand"><span class="dp-mtb-logo">Deal<span class="dp-mtb-logo-g">Pilot</span></span><span class="dp-mtb-tag">PORTFOLIO-COCKPIT</span>'
      + '<button type="button" class="set-modal-close dp-band-close pw-x" data-pw="zu" aria-label="Schließen" title="Schließen (ESC)">' + X + '</button></div>'
      + '<div class="dp-mtb-hero dp-mtb-hero-titled"><div class="dp-mtb-h-title" id="pw-t">Ansicht anpassen</div>'
      + '<div class="dp-mtb-h-sub">Links Bausteine und Kennzahlen anklicken oder in die Vorschau ziehen, oben springen die Symbole zum Bereich. Alles speichert sofort.</div></div></div>'
      + '<aside class="modal-side"><div class="ms-h"><div class="ms-title"><span class="gold">Bausteine</span></div><div class="ms-sub">Gruppen des Cockpits</div></div>'
      + '<nav class="pw-ptabs pw-symleiste" aria-label="Bereiche"></nav><div class="pw-pliste" aria-label="Bausteine und Kennzahlen zum Hinzufügen"></div></aside>'
      + '<div class="set-modal-content"><div class="pane-wrap pw-pane">'
      + '<div class="pw-vlw' + (vlZu() ? ' pw-vl-zu' : '') + '"><button type="button" class="pw-vlk" data-pw="vlzu" aria-expanded="' + !vlZu() + '"><span class="pw-h">Vorlagen</span><i aria-hidden="true">▾</i></button><div class="pw-vl"></div></div>'
      + '<div class="pw-body">'
      + '<section class="pw-ab" aria-label="Arbeitsbereich"><div class="pw-abk"><span class="pw-h">So sieht dein Cockpit aus</span>'
      + '<span class="pw-geraet" role="group" aria-label="Ansicht"><button type="button" class="an" data-pw="geraet" data-k="pc" aria-pressed="true">Bildschirm</button><button type="button" data-pw="geraet" data-k="handy" aria-pressed="false">Handy</button></span></div>'
      + '<div class="pw-buehne">'
      + '<div class="pw-score" aria-label="Score-Kopf mit Investment- und Finanzierungs-Score, fest"></div>'
      + '<div class="pw-h">Kennzahlen oben</div><div class="pw-kz" role="list"></div>'
      + '<div class="pw-h">Bausteine</div><div class="pw-raster" role="list"></div></div></section></div></div>'
      + '<div class="settings-footer save-row"><div class="save-info"><span class="save-info-text" id="pw-live-msg" aria-live="polite">Änderungen werden automatisch gespeichert</span></div>'
      + '<div class="btns"><button type="button" class="btn btn-ghost" data-pw="rueck" title="Rückgängig (Strg Z)">Rückgängig</button><button type="button" class="btn btn-ghost" data-pw="reset">Zurücksetzen</button>'
      + '<button type="button" class="btn btn-ghost pw-alt" data-pw="leiste" title="Die bisherige Liste">Als Liste</button><button type="button" class="btn btn-gold" data-pw="zu">Fertig</button></div></div>'
      + '</div></div>'
      + '<div id="pw-pop" class="pw-pop" hidden aria-hidden="true"></div>';
    _mini = {}; _vmini = {}; _score = null; _warte = []; _wLauf = 0; _wGen++;
    document.body.appendChild(p); document.documentElement.classList.add('pw-offen');
    try {   /* Helligkeit der Akzentfarbe (Partner) messen: dunkel => heller Kopftext */
      var m = (getComputedStyle(p.querySelector('.pw-sym') || p).color || '').match(/\d+(\.\d+)?/g);
      /* v4985 · der Kopf malt mit --gold (dp-mtb-hero), also entscheidet --gold; --wl-c9a84c ist ohne Partner leer */
      var hel = (getComputedStyle(document.documentElement).getPropertyValue('--gold') || '').trim() || '#C9A84C';
      var c = hel.charAt(0) === '#' ? [parseInt(hel.substr(1, 2), 16), parseInt(hel.substr(3, 2), 16), parseInt(hel.substr(5, 2), 16)] : ((hel.match(/\d+(\.\d+)?/g) || m || [201, 168, 76]).slice(0, 3).map(Number));
      var lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; p.classList.toggle('pw-dunkel', lum < 0.45);
    } catch (e) {}
    p.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-pw]') : null; if (!b || !p.contains(b) || b.disabled) return;
      var a = b.getAttribute('data-pw'), k = b.getAttribute('data-k');
      if (a === 'zu') zu();
      else if (a === 'rueck') rueckgaengig();
      else if (a === 'reset') zuruecksetzen();
      else if (a === 'leiste') { zu(); API.seitenleiste(); }
      else if (a === 'vorlage') vorlage(k);
      else if (a === 'hinzu') { hinzu(k, null); if (_klein) schublade(false); }
      else if (a === 'kzhinzu') { kzHinzu(k, null); if (_klein) schublade(false); }
      else if (a === 'schublade') schublade();
      else if (a === 'vlzu') {   /* Vorlagen einklappen: mehr Platz für die Vorschau, Merker nur in diesem Browser */
        var zu2 = !p.querySelector('.pw-vlw').classList.contains('pw-vl-zu'); p.querySelector('.pw-vlw').classList.toggle('pw-vl-zu', zu2); b.setAttribute('aria-expanded', String(!zu2));
        try { localStorage.setItem('dp_pw_vorlagen_zu', zu2 ? '1' : '0'); } catch (e) {}
        if (!zu2) skalieren();
      }
      else if (a === 'weg') weg(k);
      else if (a === 'vbweg') aendern(function (A) { A.an[k] = false; });
      else if (a === 'kzweg') kzWeg(k);
      else if (a === 'breite') breiteUm(k);
      else if (a === 'tab') reiterSprung(k);
      else if (a === 'geraet') {   /* „so sieht es am Handy aus“: Bühne in Handybreite, eine Spalte */
        var hy = k === 'handy'; p.querySelector('.pw-ab').classList.toggle('pw-als-handy', hy);
        [].forEach.call(p.querySelectorAll('[data-pw="geraet"]'), function (x) { var an = x.getAttribute('data-k') === k; x.classList.toggle('an', an); x.setAttribute('aria-pressed', String(an)); });
        skalieren(); setTimeout(skalieren, 320);   /* nach dem Übergang der Bühnenbreite neu messen */
        melden(hy ? 'Handy-Ansicht: so stehen die Bausteine untereinander' : 'Bildschirm-Ansicht');
      }
    });
    var pal = p.querySelector('.modal-side');
    pal.addEventListener('mouseover', function (ev) { var b = ev.target.closest && ev.target.closest('.pw-pim'); if (b) popZeigen(b); });
    pal.addEventListener('focusin', function (ev) { var b = ev.target.closest && ev.target.closest('.pw-pim'); if (b) popZeigen(b); });
    pal.addEventListener('mouseleave', popWeg); pal.addEventListener('focusout', function (ev) { if (!pal.contains(ev.relatedTarget)) popWeg(); });
    var _spy = 0; p.querySelector('.pw-pliste').addEventListener('scroll', function () { popWeg(); if (!_spy) _spy = requestAnimationFrame(function () { _spy = 0; reiterAktiv(); }); });
    p.querySelector('.pw-buehne').addEventListener('transitionend', function (ev) { if (ev.propertyName === 'max-width') skalieren(); });
    ziehenEinrichten(p);
    document.addEventListener('keydown', taste, true); window.addEventListener('resize', zeichnen);
    zeichnen();
    var f = p.querySelector('.pw-x'); if (f) f.focus({ preventScroll: true });   /* nicht in den Arbeitsbereich springen */
  }

  function stil() {
    if (document.getElementById('dp-pw-stil')) return;
    /* v4900 · Farben am 25.11.2026 im Browser per getComputedStyle an den Vorbild-Fenstern gemessen:
       „Belege, Unterlagen & Rechnungen einlesen“ (oabi-boarding): Hintergrund rgba(20,18,16,.55), Fenster weiß, Rand Gold 35 %,
       Radius 16, Markenleiste #070707 (14px 22px), Kicker #5A4A14, Titel 21px 700 #1A1407, Unterzeile #3A2E08,
       Seitenspalte = Weiß mit 2 % Gold, linker Rand Gold 25 %, Spaltentitel JetBrains Mono 11px 700 #B8932F,
       Kacheln = Weiß mit 4 % Gold, Rand Gold 25 %, Radius 10, Ablagefeld gestrichelt Gold 45 % Radius 12,
       aktiver Jahresknopf Gold mit weißer Schrift Radius 8, Fußleiste weiß mit Linie rgba(42,39,39,.08),
       Hauptknopf #0A0A0A / #E8CC7A Radius 8, Nebenknopf weiß Rand #E0DBD3.
       BMF-Rechner: Reiter #FBF6E9 mit Rand #EAD9B0. Kein Creme-Hintergrund für die ganze Palette.
       Jede Goldangabe über Whitelabel-Token; Statusfarben fest. */
    var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GD = 'var(--wl-b8932f, #b8932f)', s = document.createElement('style'); s.id = 'dp-pw-stil';
    var T = '#2A2727', M = '#6B655C';
    var G25 = 'color-mix(in srgb, ' + G + ' 25%, transparent)', G35 = 'color-mix(in srgb, ' + G + ' 35%, transparent)', G45 = 'color-mix(in srgb, ' + G + ' 45%, transparent)';
    var W2 = 'color-mix(in srgb, ' + G + ' 2%, #fff)', W4 = 'color-mix(in srgb, ' + G + ' 4%, #fff)', W8 = 'color-mix(in srgb, ' + G + ' 8%, #fff)';
    s.textContent = [
      'html.pw-offen,html.pw-offen body{overflow:hidden}',
      /* Gerüst wie das Einstellungen-Fenster, am 25.11.2026 per getComputedStyle gemessen: Fenster 1180 x 828, weiß, Radius 14,
         Rand Gold 30 %, Schatten 0 30px 80px rgba(0,0,0,.5) + 1,5 px Gold, Seite 280 px dunkler Verlauf, Inhalt #FAFAF7,
         Fuß dunkler Verlauf mit btn-gold. Markenleiste, Kopf, Reiter und Knöpfe kommen aus denselben Klassen in style.css. */
      '#dp-pw.global-view-overlay{z-index:100040}',
      '#dp-pw .pw-m{display:grid !important;grid-template-columns:280px minmax(0,1fr) !important;grid-template-rows:auto minmax(0,1fr) !important;grid-template-areas:"band band" "side main" !important;width:100% !important;max-width:1180px !important;height:min(828px,92vh) !important;max-height:92vh !important;padding:0 !important;margin:0 auto;background:#fff !important;border:1px solid color-mix(in srgb, ' + G + ' 30%, transparent) !important;border-radius:14px !important;box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 0 1.5px ' + G + ' !important;overflow:hidden !important;color:' + T + ';font-family:Inter,system-ui,sans-serif}',
      '#dp-pw .dp-modal-topband{grid-area:band !important}',
      '#dp-pw .modal-side{grid-area:side !important;min-height:0;display:flex;flex-direction:column}', '#dp-pw .ms-h{display:none}',

      '#dp-pw .help-sidebar-item-icon .pw-sym{width:16px;height:16px;flex:0 0 16px;padding:0;background:none;color:inherit;box-sizing:border-box}',
      '#dp-pw .set-modal-content{grid-area:main !important;display:flex !important;flex-direction:column !important;min-height:0;overflow:hidden !important}',
      '#dp-pw .pw-pane{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:0 !important;overflow:hidden !important;background:#fff}',
      '#dp-pw .settings-footer{flex:none}', '#dp-pw .settings-footer .btns{display:flex;gap:8px;align-items:center}',
      '#dp-pw .settings-footer .btn:disabled{opacity:.4;cursor:default}',
      '#dp-pw.pw-dunkel .dp-mtb-h-title{color:#fff !important}', '#dp-pw.pw-dunkel .dp-mtb-h-sub{color:rgba(255,255,255,.86) !important}',
      /* Vorlagen: echte verkleinerte Bilder */
      '.pw-vlw{flex:none;display:flex;gap:10px;align-items:center;padding:8px 20px;border-bottom:1px solid ' + G25 + ';overflow-x:auto;background:#fff}',
      '.pw-vlk{display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:4px 2px !important;min-height:0 !important;cursor:pointer;flex:none}', '.pw-vlk i{font-style:normal;color:' + GD + ';transition:transform .2s}', '.pw-vl-zu .pw-vlk i{transform:rotate(-90deg)}',
      '.pw-h{font:700 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:' + GD + ';white-space:nowrap}',
      '.pw-vl{display:flex;gap:8px}',
      '.pw-v{display:flex;flex-direction:column;gap:3px;align-items:stretch;width:112px;flex:0 0 112px;padding:4px;background:#fff;border:1px solid ' + G25 + ';border-radius:8px;color:' + T + ';cursor:pointer;text-align:left}',
      '.pw-v b{font:600 10.5px Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}', '.pw-v:hover{border-color:' + G + '}',
      '.pw-v.an{border-color:' + G + ';box-shadow:0 0 0 1.5px ' + G + ' inset;background:' + W4 + '}',
      '.pw-vm{display:block;width:100%;border-radius:5px;background:#fff;border:1px solid ' + G25 + '}', '.pw-vwartet{height:56px !important}',
      '.pw-vl-zu .pw-vm{display:none !important}', '.pw-vl-zu .pw-v{width:auto;flex:0 0 auto;padding:5px 10px;border-radius:999px}', '.pw-vl-zu .pw-v b{font-size:11.5px}',
      /* Echte Mini-Bilder */
      '.pw-mini{position:relative;overflow:hidden;pointer-events:none}', '#dp-pw .pw-mini-in > *,#dp-pw .pw-mini-in > * > *,#dp-pw .pw-mini-in > * > * > *{min-height:0 !important;height:auto !important}',   /* Hülle erbt sonst min-height 100vh: Leerfläche unter dem Score */ '.pw-mini-in{transform-origin:0 0;position:absolute;left:0;top:0}',
      '.pw-body{flex:1;display:flex;min-height:0}', '.pw-body > .pw-ab{flex:1;min-width:0}',
      '.pw-pleer{font:400 12px/1.5 Inter,sans-serif;color:' + M + ';margin:4px 2px}',
      '.pw-pliste{flex:1;overflow:auto;padding:16px 16px 24px;position:relative}',
      '.pw-pg{margin-bottom:16px}',
      '.pw-pt{display:flex;align-items:center;gap:10px;font:700 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:' + GD + ';margin:2px 2px 10px}', '.pw-pt::after{content:"";flex:1;height:1px;background:' + G25 + '}',
      '.pw-sym{width:18px;height:18px;flex:0 0 18px;color:' + GD + ';background:' + W8 + ';border-radius:6px;padding:3px;box-sizing:content-box}',
      '.pw-pl{display:flex;flex-direction:column;gap:7px}', '.pw-pl-kz{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
      '.pw-pi{position:relative;display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;background:' + W4 + ';border:1px solid ' + G25 + ';border-radius:10px;color:' + T + ';cursor:grab;text-align:left}',
      '.pw-pi:hover,.pw-pi:focus-visible{border-color:' + G + ';outline:none;box-shadow:0 2px 8px rgba(0,0,0,.07)}',
      '.pw-pim{flex-direction:column;align-items:stretch;gap:6px;padding:8px}',
      '.pw-pit{display:flex;align-items:flex-start;gap:8px}', '.pw-pit b{flex:1;font:600 12px/1.3 Inter,sans-serif;min-width:0}', '.pw-pit b small{display:block;font:400 10px Inter,sans-serif;color:' + M + '}',
      '.pw-pi i{font-style:normal;font:700 16px/1 Inter,sans-serif;color:' + GD + '}',
      '.pw-pmini{width:100%;border-radius:6px;background:#fff;border:1px solid ' + G25 + '}', '.pw-pmini-leer{height:44px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed ' + G25 + ';border-radius:6px}',
      '.pw-pkz{min-width:0;overflow-wrap:anywhere;flex-direction:column;align-items:flex-start;gap:1px;padding:7px 22px 7px 9px;border-top:2px solid ' + G + '}', '.pw-pkz i{position:absolute;right:7px;top:6px}',
      /* v4995 · Palette in der dunklen Seitenspalte. Text #F4EFE3, Nebentext #A39C90, Karten #1C1916 mit Rand weiß 8 %,
         Gruppentitel und Plus in --wl-e8cc7a (dasselbe Gold wie die aktiven Reiter der Einstellungen). */
      '#dp-pw .modal-side{min-height:0}',
      '#dp-pw .pw-symleiste{flex:none;display:flex;gap:2px;padding:10px 10px 9px;border-bottom:1px solid rgba(255,255,255,.08)}',
      '#dp-pw .pw-symk{width:30px;height:30px;flex:0 0 30px;border-radius:8px;border:1px solid transparent;background:rgba(255,255,255,.04);color:#A39C90;display:inline-flex;align-items:center;justify-content:center;padding:0 !important;min-height:0 !important;cursor:pointer}',
      '#dp-pw .pw-symk:hover,#dp-pw .pw-symk:focus-visible{color:' + GH + ';border-color:color-mix(in srgb, ' + G + ' 35%, transparent);outline:none}',
      '#dp-pw .pw-symk.an{background:linear-gradient(135deg, color-mix(in srgb, ' + G + ' 22%, transparent), color-mix(in srgb, ' + G + ' 8%, transparent));border-color:color-mix(in srgb, ' + G + ' 50%, transparent);color:' + GH + '}',
      '#dp-pw .pw-symk .pw-sym,#dp-pw .modal-side .pw-pt .pw-sym{width:16px;height:16px;flex:0 0 16px;padding:0;background:none;color:inherit;box-sizing:border-box}',
      '#dp-pw .modal-side .pw-pliste{flex:1;min-height:0;overflow:auto;padding:12px 12px 28px;position:relative;scrollbar-color:#3A342C transparent}',
      '#dp-pw .modal-side .pw-pg{margin-bottom:18px}',
      '#dp-pw .modal-side .pw-pt{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;color:' + GH + ';margin:0 2px 8px;font:700 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase}',
      '#dp-pw .modal-side .pw-pt::after{display:none}', '#dp-pw .modal-side .pw-pt small{flex-basis:100%;font:400 10.5px Inter,sans-serif;letter-spacing:0;text-transform:none;color:#A39C90}',
      '#dp-pw .modal-side .pw-pi{background:#1C1916;border:1px solid rgba(255,255,255,.08);color:#F4EFE3}',
      '#dp-pw .modal-side .pw-pi:hover,#dp-pw .modal-side .pw-pi:focus-visible{border-color:' + G + ';box-shadow:0 0 0 1px ' + G + '}',
      '#dp-pw .modal-side .pw-pkz{border-top:2px solid ' + G + '}',
      '#dp-pw .modal-side .pw-pit b{color:#F4EFE3}', '#dp-pw .modal-side .pw-pit b small{color:#A39C90}', '#dp-pw .modal-side .pw-pi i{color:' + GH + '}',
      '#dp-pw .modal-side .pw-kzl{color:#A39C90}', '#dp-pw .modal-side .pw-kzv{color:#F4EFE3}', '#dp-pw .modal-side .pw-kzv.pw-pos{color:#3FA56C}', '#dp-pw .modal-side .pw-kzv.pw-neg{color:#D8564C}',
      '#dp-pw .modal-side .pw-pmini{border:0;border-radius:6px;background:#fff}',
      '#dp-pw .modal-side .pw-leer{background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.16)}', '#dp-pw .modal-side .pw-pleer{color:#A39C90}',
      '#dp-pw .modal-side .pw-pik{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14)}',
      /* Große Vorschau beim Überfahren */
      '.pw-pop{position:absolute;z-index:3;width:min(560px,52vw);background:#fff;border:1px solid ' + G35 + ';border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:10px 12px 12px;pointer-events:none}',
      '.pw-pop-k b{display:block;font:600 14px "Space Grotesk",Inter,sans-serif;color:' + T + '}', '.pw-pop-k small{display:block;font:400 12px/1.4 Inter,sans-serif;color:' + M + ';margin:2px 0 8px}',
      '.pw-popbild{border:1px solid ' + G25 + ';border-radius:8px;background:#fff}', '.pw-popbild-leer{height:120px;display:flex;align-items:center;justify-content:center}',
      /* Arbeitsbereich */
      '.pw-ab{overflow:auto;padding:14px 24px 24px;background:#FAFAF7}',
      '.pw-abk{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1100px;margin:0 auto 8px}',
      '.pw-geraet{display:inline-flex;border:1px solid ' + G25 + ';border-radius:8px;overflow:hidden;background:#fff}',
      '.pw-geraet button{font:600 11.5px Inter,sans-serif;color:' + T + ';background:#fff;border:0;padding:5px 11px;cursor:pointer;min-height:0 !important}', '.pw-geraet button.an{background:' + G + ';color:#fff}',
      '.pw-buehne{max-width:1100px;margin:0 auto;transition:max-width .25s}',   /* v4995 · Vorschau so groß wie der Platz */
      '.pw-als-handy .pw-buehne,.pw-als-handy .pw-abk{max-width:390px}', '.pw-als-handy .pw-raster{grid-template-columns:1fr}', '.pw-als-handy .pw-b.pw-halb{grid-column:1/-1}', '.pw-als-handy .pw-kz{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '.pw-ab .pw-buehne > .pw-h{margin:14px 0 6px;display:block}',
      '.pw-score{position:relative;border-radius:12px;overflow:hidden}', '.pw-scorebild{border-radius:12px}',
      '.pw-fest{position:absolute;right:8px;top:8px;font:700 9.5px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:' + GH + ';background:rgba(7,7,7,.8);border:1px solid ' + G + ';border-radius:999px;padding:2px 8px}',
      '.pw-kz{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:7px}',
      '.pw-kzc{position:relative;display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid ' + G25 + ';border-top:2px solid ' + G + ';border-radius:10px;padding:7px 22px 7px 10px;cursor:grab;min-width:0}',
      '.pw-kzc.pw-kzh{background:' + W4 + '}',
      '.pw-kzl{font:500 9.5px/1.25 Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:' + M + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.pw-kzv{font:600 15px "Space Grotesk",sans-serif;color:' + T + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}', '.pw-kzv.pw-pos{color:#27704A}', '.pw-kzv.pw-neg{color:#9E4943}',
      '.pw-kzs{font:400 10px Inter,sans-serif;color:' + M + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pw-kzc button,.pw-akt button[data-pw="weg"]{position:absolute;right:3px;top:3px;width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:#8A8274;cursor:pointer;font-size:14px;padding:0 !important;min-height:0 !important;line-height:20px}',
      '.pw-akt button[data-pw="weg"]{top:50%;transform:translateY(-50%)}',
      '.pw-kzc button:hover,.pw-akt button[data-pw="weg"]:hover{background:#B8625C;color:#fff}',
      '.pw-kzdrop,.pw-drop{border:1.11px dashed ' + G45 + ';border-radius:12px;color:' + M + ';font:500 11.5px Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:8px 12px;min-height:44px;text-align:center;background:' + W2 + '}',
      '.pw-drop{grid-column:1/-1;min-height:46px}',
      '.pw-raster{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.pw-b{grid-column:1/-1;position:relative;background:#fff;border:1px solid ' + G25 + ';border-radius:10px;padding:8px 10px;cursor:grab;min-width:0;transition:box-shadow .15s,transform .15s}',
      '.pw-b.pw-halb{grid-column:span 1}',
      '.pw-b:hover,.pw-b:focus-visible{border-color:' + G + ';outline:none;box-shadow:0 0 0 2px color-mix(in srgb, ' + G + ' 35%, transparent)}',
      '.pw-bk{display:flex;align-items:center;gap:8px}', '.pw-bk b{flex:1;font:600 12.5px "Space Grotesk",Inter,sans-serif;color:' + T + ';min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pw-griff{color:#A79D8C;font-size:12px;letter-spacing:-2px}',
      '.pw-akt{display:flex;gap:4px;align-items:center;position:relative;padding-right:24px}',
      '.pw-akt button[data-pw="breite"]{font:600 11px Inter,sans-serif;border:1px solid #E0DBD3;background:#fff;color:' + T + ';border-radius:8px;padding:3px 8px !important;min-height:0 !important;cursor:pointer;min-width:40px}',
      '.pw-akt button[data-pw="breite"]:hover{border-color:' + G + '}',
      '.pw-sub{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}', '.pw-sub span{display:inline-flex;align-items:center;gap:4px;font:500 10.5px Inter,sans-serif;background:' + W8 + ';border-radius:999px;padding:2px 4px 2px 9px}',
      '.pw-sub button{border:0;background:transparent;color:#8A8274;cursor:pointer;font-size:13px;width:18px;height:18px;border-radius:50%;padding:0 !important;min-height:0 !important}', '.pw-sub button:hover{background:#B8625C;color:#fff}',
      '.pw-live{margin-top:7px;border-radius:8px;background:#fff;border:1px solid #EFE9DC}',
      '.pw-leer{margin-top:7px;border-radius:8px;background:' + W2 + ';border:1px dashed ' + G25 + ';display:flex;align-items:center;justify-content:center;min-height:56px}',
      '.pw-vwartet{display:flex;height:78px;margin:0;min-height:0}.pw-wartet svg{animation:pwPuls 1.4s ease-in-out infinite}@keyframes pwPuls{50%{opacity:.35}}@media (prefers-reduced-motion:reduce){.pw-wartet svg{animation:none}}',
      '.pw-pik{flex:0 0 40px;height:26px;display:flex;align-items:flex-end;gap:2px;padding:3px;border-radius:5px;background:' + W8 + ';border:1px solid ' + G25 + ';color:' + G + ';box-sizing:border-box}',
      '.pw-pik-balken i{flex:1;background:' + G + ';border-radius:1px}', '.pw-pik-linie svg{width:100%;height:100%}',
      '.pw-pik-tab{flex-direction:column;align-items:stretch;justify-content:space-between}', '.pw-pik-tab i{height:2px;background:#B9AE99}', '.pw-pik-tab i:first-child{background:' + G + '}',
      '.pw-pik-karten{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}', '.pw-pik-karten i{background:#D9CFBC;border-radius:1px}', '.pw-pik-karten i:nth-child(2){background:' + G + '}',
      '.pw-pik-kacheln{align-items:stretch}', '.pw-pik-kacheln i{flex:1;background:#fff;border:1px solid #D9CFBC;border-top:2px solid ' + G + ';border-radius:2px}',
      '.pw-pik-text{flex-direction:column;align-items:flex-start;justify-content:space-around}', '.pw-pik-text i{height:2px;background:#B9AE99}',
      '.pw-zieht{opacity:.45}',
      '.pw-b.pw-ueber{box-shadow:0 -4px 0 0 ' + G + ' !important;border-color:' + G + ' !important}', '.pw-kzc.pw-ueber{box-shadow:-4px 0 0 0 ' + G + ' !important;border-color:' + G + ' !important}',
      '.pw-zug-mod .pw-drop,.pw-zug-kz .pw-kzdrop{border-color:' + G + ';border-width:2px;color:' + T + ';background:color-mix(in srgb, ' + G + ' 12%, #fff)}',
      '.pw-zug-mod .pw-raster,.pw-zug-kz .pw-kz{outline:2px dashed ' + G45 + ';outline-offset:6px;border-radius:10px}',
      '.pw-ueber.pw-drop,.pw-ueber.pw-kzdrop{background:color-mix(in srgb, ' + G + ' 22%, #fff) !important}',
      /* Handy: wie das Einstellungen-Fenster vollflächig, Reiter als waagerecht scrollbare Leiste, Inhalt scrollt */
      '#dp-pw.pw-klein{padding:0 !important}',
      '#dp-pw.pw-klein .pw-m{grid-template-columns:minmax(0,1fr) !important;grid-template-rows:auto auto minmax(0,1fr) !important;grid-template-areas:"band" "side" "main" !important;height:100vh !important;height:100dvh !important;max-height:none !important;max-width:100vw !important;border-radius:0 !important;border:0 !important;box-shadow:none !important}',
      '#dp-pw.pw-klein .dp-mtb-hero{display:none !important}',
      '#dp-pw.pw-klein .modal-side{position:relative;flex-direction:column !important;height:auto !important;overflow:visible !important;z-index:4}',
      '#dp-pw.pw-klein .pw-symleiste{gap:4px;overflow-x:auto;padding:8px 10px;scrollbar-width:none !important}', '#dp-pw.pw-klein .pw-symleiste::-webkit-scrollbar{display:none}',
      '#dp-pw.pw-klein .pw-symk{width:40px;height:40px;flex:0 0 40px}',
      '#dp-pw .pw-lade{flex:0 0 auto;height:40px;padding:0 14px !important;min-height:0 !important;border-radius:8px;border:1px solid color-mix(in srgb, ' + G + ' 50%, transparent);background:linear-gradient(135deg, color-mix(in srgb, ' + G + ' 22%, transparent), color-mix(in srgb, ' + G + ' 8%, transparent));color:' + GH + ';font:600 12.5px Inter,sans-serif;cursor:pointer;margin-right:4px}',
      '#dp-pw.pw-klein .modal-side .pw-pliste{display:none;position:absolute;left:0;right:0;top:100%;height:min(64vh,560px);background:linear-gradient(#141312,#0A0A0A);box-shadow:0 18px 40px rgba(0,0,0,.45);border-bottom:1px solid color-mix(in srgb, ' + G + ' 35%, transparent)}',
      '#dp-pw.pw-klein.pw-lade-auf .modal-side .pw-pliste{display:block}',
      '#dp-pw.pw-klein .pw-pane{overflow-y:auto !important;overflow-x:hidden !important}',
      '#dp-pw.pw-klein .pw-vlw{padding:8px 12px;scrollbar-width:none !important}', '#dp-pw.pw-klein .pw-vlw::-webkit-scrollbar{display:none}',
      '#dp-pw.pw-klein .pw-body{display:flex;flex-direction:column;flex:none}',
      '#dp-pw.pw-klein .pw-ab{overflow:visible;padding:12px}', '#dp-pw.pw-klein .pw-raster{grid-template-columns:1fr}', '#dp-pw.pw-klein .pw-b.pw-halb{grid-column:1/-1}',
      '#dp-pw.pw-klein .pw-kz{grid-template-columns:repeat(2,minmax(0,1fr))}', '#dp-pw.pw-klein .pw-pop,#dp-pw.pw-klein .pw-geraet,#dp-pw.pw-klein .pw-alt{display:none !important}',
      '#dp-pw.pw-klein .settings-footer{padding:10px 12px !important;gap:8px !important}', '#dp-pw.pw-klein .save-info{display:none !important}',
      '#dp-pw.pw-klein .settings-footer .btns{width:100%;justify-content:flex-end}',
      '@media (prefers-reduced-motion:reduce){.pw-b,.pw-buehne{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.DpPfWerkstatt = {
    aktiv: function () { try { return localStorage.getItem('dp_pf_werkstatt') !== '0'; } catch (e) { return true; } },
    oeffnen: oeffnen, zu: zu, version: 'v4995'
  };
})();
