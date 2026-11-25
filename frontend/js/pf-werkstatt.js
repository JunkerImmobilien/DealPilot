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
    } catch (e) { r = null; }
    _mini[k] = r; return r;
  }
  /* Kasten mit verkleinertem Bild; skalieren() setzt Faktor und Höhe nach der Breite des Kastens */
  function miniBox(k, cls, maxH) {
    var m = _klein && cls === 'pw-live' ? null : miniHtml(k);
    if (!m) return '<div class="pw-leer ' + cls + '-leer">' + piktogramm(k) + '</div>';
    return '<div class="pw-mini ' + cls + '" data-maxh="' + maxH + '" aria-hidden="true" inert><div class="pw-mini-in" data-ew="' + m.w + '" style="width:' + m.w + 'px">' + huelle(m.h) + '</div></div>';
  }
  /* Score-Kopf so, wie er im Cockpit steht (echte Werte), sonst gekennzeichnete Beispielwerte */
  function scoreHtml() {
    if (_score) return _score;
    var h = document.getElementById('dp-pscore-hero');
    if (h && h.innerHTML.length > 80 && h.offsetHeight) _score = { h: saeubern(h.cloneNode(true)).outerHTML, w: h.offsetWidth, echt: true };
    else _score = { h: '<div style="background:#0A0A0A;color:#FDFCFA;border-radius:12px;padding:18px 22px;font:600 18px Space Grotesk,sans-serif">Investor Portfolio Score <span style="color:var(--wl-c9a84c, #C9A84C)">72</span> · Investment 70 · Finanzierung 75 <small style="font:400 13px Inter;color:#C9C1B1">Beispielwerte, noch keine Objekte im Bestand</small></div>', w: appBreite(), echt: false };
    return _score;
  }
  /* Vorlage als echtes, verkleinertes Bild: Score-Kopf und die ersten Bausteine im Raster der Vorlage */
  function vorlageMini(v) {
    if (!_vmini[v.k]) {
      var W = appBreite(), s = scoreHtml();
      var mods = v.m.slice(0, 5).map(function (x) {
        var m = miniHtml(x[0]);
        return '<div style="grid-column:' + (x[1] === 'ganz' ? '1/-1' : 'auto') + ';min-width:0;max-height:420px;overflow:hidden">' + (m ? m.h : '<div style="height:160px;border-radius:10px;background:#EFE9DC"></div>') + '</div>';
      }).join('');
      _vmini[v.k] = '<span class="pw-vm pw-mini" data-maxh="78" aria-hidden="true" inert><span class="pw-mini-in" data-ew="' + W + '" style="width:' + W + 'px;display:block">' + huelle(s.h + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">' + mods + '</div>') + '</span></span>';
    }
    return _vmini[v.k];
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
  function palette() {
    var A = API.stand(), an = {}; aktiv().forEach(function (k) { an[k] = 1; });
    var kzan = {}; kzAktiv().forEach(function (k) { kzan[k] = 1; });
    /* v4900 · Kennzahlen zuerst (Marcel), jede als kleine Karte mit ihrem echten Wert */
    var kzL = API.kzdef.filter(function (d) { return !kzan[d.k]; });
    var kzH = kzL.length ? '<div class="pw-pg" data-g="kz"><div class="pw-pt">' + symbol('kz') + 'Kennzahlen oben</div><div class="pw-pl pw-pl-kz">' + kzL.map(function (d) {
      var w = kzWert(d.k);
      return '<button type="button" class="pw-pi pw-pkz" draggable="true" data-pw="kzhinzu" data-k="' + d.k + '" title="Ziehen oder klicken: erscheint oben in der Kennzahl-Leiste"><span class="pw-kzl">' + esc(w.l) + '</span><b class="pw-kzv' + (w.c ? ' pw-' + w.c : '') + '">' + esc(w.v || '·') + '</b><i aria-hidden="true">+</i></button>';
    }).join('') + '</div></div>' : '';
    var h = kzH, tabs = kzL.length ? [{ k: 'kz', t: 'Kennzahlen' }] : [];
    var gesehen = {};
    GRUPPEN.forEach(function (g) { g.m.forEach(function (k) { gesehen[k] = 1; }); });
    var rest = API.ansicht.filter(function (a) { return !a.fest && !a.vb && !gesehen[a.k]; }).map(function (a) { return a.k; });
    GRUPPEN.concat(rest.length ? [{ k: 'rest', t: 'Weitere', m: rest }] : []).forEach(function (g) {
      var L = g.m.filter(function (k) { var a = modul(k); return a && !a.fest && !a.vb && !an[k]; });
      if (g.k === 'wert') { API.vbk.forEach(function (v) { if (!A.an[v]) L.push(v); }); }
      if (!L.length) return;
      tabs.push({ k: g.k, t: g.t.replace(' und Cashflow', '').replace(' und Ziele', '').replace(' und Vermögen', '') });
      /* jeder Baustein mit seinem echten Mini-Bild; beim Überfahren erscheint es groß (pw-pop) */
      h += '<div class="pw-pg" data-g="' + g.k + '"><div class="pw-pt">' + symbol(g.k) + esc(g.t) + '</div><div class="pw-pl">' + L.map(function (k) {
        var a = modul(k);
        return '<button type="button" class="pw-pi pw-pim" draggable="true" data-pw="hinzu" data-k="' + k + '" title="' + esc(a.w || '') + '"><span class="pw-pit"><b>' + esc(a.t) + (a.vb ? '<small>in Projektion und Verlauf</small>' : '') + '</b><i aria-hidden="true">+</i></span>'
          + miniBox(a.vb ? 'projektion' : k, 'pw-pmini', 88) + '</button>';
      }).join('') + '</div></div>';
    });
    _tabs = tabs;
    return h;
  }
  var _tabs = [];
  function reiterHtml() {
    return _tabs.map(function (t, i) { return '<button type="button" class="pw-tab' + (i === 0 ? ' an' : '') + '" data-pw="tab" data-k="' + t.k + '">' + symbol(t.k) + '<span>' + esc(t.t) + '</span></button>'; }).join('');
  }
  function zeichnen() {
    var p = document.getElementById('dp-pw'); if (!p) return;
    _klein = window.innerWidth < 820; p.classList.toggle('pw-klein', _klein);
    var A = API.stand();
    var fok = document.activeElement && p.contains(document.activeElement) ? [document.activeElement.getAttribute('data-pw') || 'blk', document.activeElement.getAttribute('data-k')] : null;
    p.querySelector('.pw-vl').innerHTML = API.vorlagen.map(function (v) {
      return '<button type="button" class="pw-v' + (A.vorlage === v.k ? ' an' : '') + '" data-pw="vorlage" data-k="' + v.k + '" aria-pressed="' + (A.vorlage === v.k) + '" title="' + esc(v.u) + '">' + vorlageMini(v) + '<b>' + esc(v.t) + '</b></button>';
    }).join('');
    var pl = p.querySelector('.pw-pliste'), st = pl.scrollTop;
    pl.innerHTML = palette(); pl.scrollTop = st;
    p.querySelector('.pw-ptabs').innerHTML = reiterHtml(); reiterAktiv();
    var s = scoreHtml();
    p.querySelector('.pw-score').innerHTML = '<div class="pw-mini pw-scorebild" data-maxh="150" aria-hidden="true" inert><div class="pw-mini-in" data-ew="' + s.w + '" style="width:' + s.w + 'px">' + huelle(s.h) + '</div></div>'
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
  function skalieren() {
    var p = document.getElementById('dp-pw'); if (!p) return;
    [].forEach.call(p.querySelectorAll('.pw-mini-in'), function (x) {
      /* maßstäblich: das Bild rechnet mit der echten Breite des Bausteins im Cockpit und wird auf die Kastenbreite verkleinert */
      var box = x.parentNode.clientWidth || 300, w = Number(x.getAttribute('data-ew')) || 900, f = Math.min(1, box / w), mx = Number(x.parentNode.getAttribute('data-maxh')) || 210;
      x.style.width = w + 'px'; x.style.transform = 'scale(' + f.toFixed(4) + ')';
      x.parentNode.style.height = Math.min(mx, Math.max(24, Math.round((x.scrollHeight || 300) * f))) + 'px';
    });
  }
  /* Reiter der Palette: Klick springt zur Gruppe, beim Blättern folgt der aktive Reiter */
  function reiterAktiv() {
    var p = document.getElementById('dp-pw'); if (!p) return;
    var pl = p.querySelector('.pw-pliste'), top = pl.getBoundingClientRect().top, akt = null;
    [].forEach.call(pl.querySelectorAll('.pw-pg'), function (g) { if (g.getBoundingClientRect().top - top < 40) akt = g.getAttribute('data-g'); });
    if (!akt) { var f = pl.querySelector('.pw-pg'); akt = f && f.getAttribute('data-g'); }
    [].forEach.call(p.querySelectorAll('.pw-tab'), function (t) { t.classList.toggle('an', t.getAttribute('data-k') === akt); });
  }
  function reiterSprung(g) {
    var p = document.getElementById('dp-pw'); if (!p) return;
    var pl = p.querySelector('.pw-pliste'), z = pl.querySelector('.pw-pg[data-g="' + g + '"]'); if (!z) return;
    pl.scrollTo({ top: z.offsetTop - pl.offsetTop - 4, behavior: 'smooth' });
    [].forEach.call(p.querySelectorAll('.pw-tab'), function (t) { t.classList.toggle('an', t.getAttribute('data-k') === g); });
  }
  /* Große Live-Vorschau beim Überfahren eines Bausteins in der Palette */
  function popZeigen(btn) {
    var p = document.getElementById('dp-pw'), pop = document.getElementById('pw-pop'); if (!p || !pop || _klein) return;
    var k = btn.getAttribute('data-k'), a = modul(k); if (!a) return;
    pop.innerHTML = '<div class="pw-pop-k"><b>' + esc(a.t) + '</b><small>' + esc(a.w || 'Klicken oder in den Arbeitsbereich ziehen') + '</small></div>' + miniBox(a.vb ? 'projektion' : k, 'pw-popbild', 340);
    pop.hidden = false; skalieren();
    var pr = p.getBoundingClientRect(), br = btn.getBoundingClientRect(), pal = p.querySelector('.pw-pal').getBoundingClientRect();
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
    _mini = {}; _vmini = {}; _score = null;
    _offen = false; _rueck = []; document.removeEventListener('keydown', taste, true); window.removeEventListener('resize', zeichnen);
    document.documentElement.classList.remove('pw-offen');
    try { if (_vorher && _vorher.focus) _vorher.focus(); } catch (e) {}
  }

  function oeffnen(api) {
    if (window.DpVorschau && !api.__frei) { window.DpVorschau.frei('grafiken_neu').then(function (an) { if (an) { api.__frei = true; oeffnen(api); } }); return; }
    API = api; if (_offen) { zeichnen(); return; }
    _offen = true; _vorher = document.activeElement; _rueck = []; stil();
    var hg = document.createElement('div'); hg.id = 'dp-pw-hg'; hg.className = 'pw-hg'; hg.setAttribute('aria-hidden', 'true'); document.body.appendChild(hg);
    var p = document.createElement('div'); p.id = 'dp-pw'; p.className = 'pw'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'pw-t');
    _kzCache = {};
    /* v4890 · Aufbau wie die übrigen DealPilot-Fenster (modal-boarding-skin): schwarze Markenleiste mit Logo und
       goldgerahmtem ×, goldener Kopf mit Kicker und Titel, heller Inhalt, Fußleiste mit schwarzem Hauptknopf */
    var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    p.innerHTML = '<div class="pw-brand"><span class="pw-logo">Deal<b>Pilot</b></span><span class="pw-tag">PORTFOLIO-COCKPIT · ANSICHT</span><button type="button" class="pw-x" data-pw="zu" aria-label="Schließen">' + X + '</button></div>'
      + '<div class="pw-hero"><div class="pw-kt"><span class="pw-eye">Ansicht anpassen</span><b id="pw-t">Cockpit zusammenbauen</b>'
      + '<small>Links Bausteine und Kennzahlen anklicken oder hineinziehen, im Arbeitsbereich verschieben, × entfernt. Alles speichert sofort.</small></div>'
      + '<div class="pw-kb"><button type="button" class="pw-btn" data-pw="rueck" title="Rückgängig (Strg Z)">↶ Rückgängig</button><button type="button" class="pw-btn" data-pw="reset">Zurücksetzen</button>'
      + '<button type="button" class="pw-btn pw-alt" data-pw="leiste" title="Die bisherige Liste">Als Liste</button></div></div>'
      + '<div class="pw-vlw"><span class="pw-h">Vorlagen</span><div class="pw-vl"></div></div>'
      + '<div class="pw-body"><aside class="pw-pal" aria-label="Bausteine zum Hinzufügen"><nav class="pw-ptabs" aria-label="Gruppen"></nav><div class="pw-pliste"></div></aside>'
      + '<section class="pw-ab" aria-label="Arbeitsbereich"><div class="pw-abk"><span class="pw-h">So sieht dein Cockpit aus</span>'
      + '<span class="pw-geraet" role="group" aria-label="Ansicht"><button type="button" class="an" data-pw="geraet" data-k="pc" aria-pressed="true">Bildschirm</button><button type="button" data-pw="geraet" data-k="handy" aria-pressed="false">Handy</button></span></div>'
      + '<div class="pw-buehne">'
      + '<div class="pw-score" aria-label="Score-Kopf mit Investment- und Finanzierungs-Score, fest"></div>'
      + '<div class="pw-h">Kennzahlen oben</div><div class="pw-kz" role="list"></div>'
      + '<div class="pw-h">Bausteine</div><div class="pw-raster" role="list"></div></div></section></div>'
      + '<div class="pw-f"><span id="pw-live-msg" class="pw-msg" aria-live="polite"></span><button type="button" class="pw-ok" data-pw="zu">Fertig</button></div>'
      + '<div id="pw-pop" class="pw-pop" hidden aria-hidden="true"></div>';
    _mini = {}; _vmini = {}; _score = null;
    document.body.appendChild(p); document.documentElement.classList.add('pw-offen');
    try {   /* Helligkeit der Akzentfarbe (Partner) messen: dunkel => heller Kopftext */
      var m = (getComputedStyle(p.querySelector('.pw-sym') || p).color || '').match(/\d+(\.\d+)?/g);
      var hel = getComputedStyle(document.documentElement).getPropertyValue('--wl-c9a84c').trim();
      var c = hel.charAt(0) === '#' ? [parseInt(hel.substr(1, 2), 16), parseInt(hel.substr(3, 2), 16), parseInt(hel.substr(5, 2), 16)] : (m ? m.slice(0, 3).map(Number) : [201, 168, 76]);
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
      else if (a === 'hinzu') hinzu(k, null);
      else if (a === 'kzhinzu') kzHinzu(k, null);
      else if (a === 'weg') weg(k);
      else if (a === 'vbweg') aendern(function (A) { A.an[k] = false; });
      else if (a === 'kzweg') kzWeg(k);
      else if (a === 'breite') breiteUm(k);
      else if (a === 'tab') reiterSprung(k);
      else if (a === 'geraet') {   /* „so sieht es am Handy aus“: Bühne in Handybreite, eine Spalte */
        var hy = k === 'handy'; p.querySelector('.pw-ab').classList.toggle('pw-als-handy', hy);
        [].forEach.call(p.querySelectorAll('[data-pw="geraet"]'), function (x) { var an = x.getAttribute('data-k') === k; x.classList.toggle('an', an); x.setAttribute('aria-pressed', String(an)); });
        skalieren(); melden(hy ? 'Handy-Ansicht: so stehen die Bausteine untereinander' : 'Bildschirm-Ansicht');
      }
    });
    var pal = p.querySelector('.pw-pal');
    pal.addEventListener('mouseover', function (ev) { var b = ev.target.closest && ev.target.closest('.pw-pim'); if (b) popZeigen(b); });
    pal.addEventListener('focusin', function (ev) { var b = ev.target.closest && ev.target.closest('.pw-pim'); if (b) popZeigen(b); });
    pal.addEventListener('mouseleave', popWeg); pal.addEventListener('focusout', function (ev) { if (!pal.contains(ev.relatedTarget)) popWeg(); });
    p.querySelector('.pw-pliste').addEventListener('scroll', function () { popWeg(); reiterAktiv(); });
    ziehenEinrichten(p);
    document.addEventListener('keydown', taste, true); window.addEventListener('resize', zeichnen);
    zeichnen();
    var f = p.querySelector('.pw-b') || p.querySelector('.pw-x'); if (f) f.focus();
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
      '.pw-hg{position:fixed;inset:0;background:rgba(20,18,16,.55);z-index:100040}',
      '.pw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1180px,96vw);height:min(880px,94vh);z-index:100041;display:flex;flex-direction:column;background:#fff;color:' + T + ';border:1px solid ' + G35 + ';border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.45);font-family:Inter,system-ui,sans-serif;overflow:hidden}',
      '.pw-brand{flex:none;background:#070707;padding:14px 22px;display:flex;align-items:center;gap:12px}',
      '.pw-logo{font:700 17px "Space Grotesk",Inter,system-ui,sans-serif;color:#fff;letter-spacing:.3px}', '.pw-logo b{color:' + GH + ';font-weight:700}',
      '.pw-tag{margin-left:auto;font:700 10px "JetBrains Mono",monospace;letter-spacing:2px;color:' + GH + '}',
      '.pw .pw-x{width:32px;height:32px;border-radius:9px;background:#17130d;border:1.5px solid ' + GH + ';color:' + GH + ';box-shadow:0 2px 8px rgba(0,0,0,.45);display:inline-flex;align-items:center;justify-content:center;padding:0 !important;min-height:0 !important;margin-left:8px;cursor:pointer;position:relative;flex:0 0 auto}',
      '.pw .pw-x svg{width:15px;height:15px;pointer-events:none}', '.pw .pw-x::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px}',
      '.pw .pw-x:hover{background:' + G + ';color:#fff}',
      '.pw-hero{flex:none;display:flex;gap:16px;align-items:flex-end;justify-content:space-between;padding:14px 22px 14px;background:linear-gradient(110deg,' + GH + ',' + G + ' 60%,' + GD + ')}',
      '.pw-eye{display:block;font:700 11px "JetBrains Mono",monospace;letter-spacing:3px;text-transform:uppercase;color:#5A4A14;margin-bottom:4px}',
      '.pw-kt b{display:block;font:700 21px/1.2 "Space Grotesk",Inter,sans-serif;color:#1A1407;margin:0 0 3px}',
      '.pw-kt small{font:400 13px/1.5 Inter,sans-serif;color:#3A2E08}',
      '.pw-dunkel .pw-eye{color:rgba(255,255,255,.78)}', '.pw-dunkel .pw-kt b{color:#fff}', '.pw-dunkel .pw-kt small{color:rgba(255,255,255,.86)}',
      '.pw-dunkel .pw-btn{color:#fff;background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35)}', '.pw-dunkel .pw-btn:hover:not(:disabled){background:rgba(255,255,255,.26)}',
      '.pw-kb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}',
      '.pw-btn{font:600 12.5px Inter,sans-serif;color:#1A1407;background:rgba(255,255,255,.6);border:1px solid rgba(26,20,7,.22);border-radius:8px;padding:8px 14px;cursor:pointer;min-height:34px}',
      '.pw-btn:hover:not(:disabled){background:#fff}', '.pw-btn:disabled{opacity:.45;cursor:default}',
      /* Vorlagen: echte verkleinerte Bilder */
      '.pw-vlw{flex:none;display:flex;gap:12px;align-items:center;padding:10px 22px;border-bottom:1px solid ' + G25 + ';overflow-x:auto;background:#fff}',
      '.pw-h{font:700 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:' + GD + ';white-space:nowrap}',
      '.pw-vl{display:flex;gap:10px}',
      '.pw-v{display:flex;flex-direction:column;gap:6px;align-items:stretch;width:156px;flex:0 0 156px;padding:6px;background:' + W4 + ';border:1px solid ' + G25 + ';border-radius:10px;color:' + T + ';cursor:pointer;text-align:left}',
      '.pw-v b{font:600 11.5px Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}', '.pw-v:hover{border-color:' + G + '}',
      '.pw-v.an{border-color:' + G + ';box-shadow:0 0 0 1.5px ' + G + ' inset}',
      '.pw-vm{display:block;width:100%;border-radius:6px;background:#fff;border:1px solid ' + G25 + '}',
      /* Echte Mini-Bilder */
      '.pw-mini{position:relative;overflow:hidden;pointer-events:none}', '.pw-mini-in{transform-origin:0 0;position:absolute;left:0;top:0}',
      '.pw-body{flex:1;display:grid;grid-template-columns:300px 1fr;min-height:0}',
      '.pw-pal{display:flex;flex-direction:column;min-height:0;border-right:1px solid ' + G25 + ';background:' + W2 + '}',
      '.pw-ptabs{flex:none;display:flex;flex-wrap:wrap;gap:4px;padding:10px 10px 8px;border-bottom:1px solid ' + G25 + ';background:#fff}',
      '.pw-tab{display:inline-flex;align-items:center;gap:5px;font:600 11.5px Inter,sans-serif;color:' + T + ';background:#fff;border:1px solid ' + G25 + ';border-radius:8px;padding:5px 8px 5px 5px;cursor:pointer;min-height:0 !important}',
      '.pw-tab .pw-sym{width:14px;height:14px;flex:0 0 14px;padding:2px}', '.pw-tab:hover{border-color:' + G + '}',
      '.pw-tab.an{background:' + G + ';border-color:' + G + ';color:#fff}', '.pw-tab.an .pw-sym{background:rgba(255,255,255,.22);color:#fff}',
      '.pw-pliste{flex:1;overflow:auto;padding:10px 12px 24px;position:relative}',
      '.pw-pg{margin-bottom:16px}',
      '.pw-pt{display:flex;align-items:center;gap:7px;font:700 11px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:' + GD + ';margin:2px 2px 8px}',
      '.pw-sym{width:18px;height:18px;flex:0 0 18px;color:' + GD + ';background:' + W8 + ';border-radius:6px;padding:3px;box-sizing:content-box}',
      '.pw-pl{display:flex;flex-direction:column;gap:7px}', '.pw-pl-kz{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '.pw-pi{position:relative;display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;background:' + W4 + ';border:1px solid ' + G25 + ';border-radius:10px;color:' + T + ';cursor:grab;text-align:left}',
      '.pw-pi:hover,.pw-pi:focus-visible{border-color:' + G + ';outline:none;box-shadow:0 2px 8px rgba(0,0,0,.07)}',
      '.pw-pim{flex-direction:column;align-items:stretch;gap:6px;padding:8px}',
      '.pw-pit{display:flex;align-items:flex-start;gap:8px}', '.pw-pit b{flex:1;font:600 12px/1.3 Inter,sans-serif;min-width:0}', '.pw-pit b small{display:block;font:400 10px Inter,sans-serif;color:' + M + '}',
      '.pw-pi i{font-style:normal;font:700 16px/1 Inter,sans-serif;color:' + GD + '}',
      '.pw-pmini{width:100%;border-radius:6px;background:#fff;border:1px solid ' + G25 + '}', '.pw-pmini-leer{height:44px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed ' + G25 + ';border-radius:6px}',
      '.pw-pkz{flex-direction:column;align-items:flex-start;gap:1px;padding:7px 22px 7px 9px;border-top:2px solid ' + G + '}', '.pw-pkz i{position:absolute;right:7px;top:6px}',
      /* Große Vorschau beim Überfahren */
      '.pw-pop{position:absolute;z-index:3;width:min(560px,52vw);background:#fff;border:1px solid ' + G35 + ';border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:10px 12px 12px;pointer-events:none}',
      '.pw-pop-k b{display:block;font:600 14px "Space Grotesk",Inter,sans-serif;color:' + T + '}', '.pw-pop-k small{display:block;font:400 12px/1.4 Inter,sans-serif;color:' + M + ';margin:2px 0 8px}',
      '.pw-popbild{border:1px solid ' + G25 + ';border-radius:8px;background:#fff}', '.pw-popbild-leer{height:120px;display:flex;align-items:center;justify-content:center}',
      /* Arbeitsbereich */
      '.pw-ab{overflow:auto;padding:12px 18px 24px;background:#F6F4EF}',
      '.pw-abk{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:780px;margin:0 auto 8px}',
      '.pw-geraet{display:inline-flex;border:1px solid ' + G25 + ';border-radius:8px;overflow:hidden;background:#fff}',
      '.pw-geraet button{font:600 11.5px Inter,sans-serif;color:' + T + ';background:#fff;border:0;padding:5px 11px;cursor:pointer;min-height:0 !important}', '.pw-geraet button.an{background:' + G + ';color:#fff}',
      '.pw-buehne{max-width:780px;margin:0 auto;transition:max-width .25s}',
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
      '.pw-f{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-top:1px solid rgba(42,39,39,.08);background:#fff}',
      '.pw-msg{font:400 12px Inter,sans-serif;color:' + M + '}',
      '.pw .pw-ok{font:600 12.5px Inter,sans-serif;background:#0A0A0A;color:' + GH + ';border:1px solid transparent;border-radius:8px;padding:8px 22px;cursor:pointer;min-height:37px}', '.pw .pw-ok:hover{background:#141414}',
      '.pw.pw-klein{left:0;top:0;transform:none;width:100%;height:100%;border-radius:0}',
      '.pw-klein .pw-hero{flex-direction:column;align-items:stretch;gap:8px}', '.pw-klein .pw-kt small{display:none}', '.pw-klein .pw-alt{display:none}', '.pw-klein .pw-tag{display:none}',
      '.pw-klein .pw-kb{justify-content:flex-start}', '.pw-klein .pw-geraet{display:none}',
      '.pw-klein .pw-body{display:flex;flex-direction:column;overflow:auto}', '.pw-klein .pw-pal{order:2;border-right:0;border-top:1px solid ' + G25 + '}', '.pw-klein .pw-pliste{overflow:visible}',
      '.pw-klein .pw-ab{order:1;overflow:visible}', '.pw-klein .pw-raster{grid-template-columns:1fr}', '.pw-klein .pw-b.pw-halb{grid-column:1/-1}',
      '.pw-klein .pw-kz{grid-template-columns:repeat(2,minmax(0,1fr))}', '.pw-klein .pw-pop{display:none}',
      '@media (prefers-reduced-motion:reduce){.pw-b,.pw-buehne{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.DpPfWerkstatt = {
    aktiv: function () { try { return localStorage.getItem('dp_pf_werkstatt') !== '0'; } catch (e) { return true; } },
    oeffnen: oeffnen, zu: zu, version: 'v4900'
  };
})();
