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

  /* ── Zeichnen ── */
  function vorlageMini(v) {
    return '<span class="pw-vm" aria-hidden="true">' + v.m.slice(0, 6).map(function (x) { return '<i class="' + (x[1] === 'halb' ? 'h' : 'g') + '"></i>'; }).join('') + '</span>';
  }
  function vorschau(k) {
    if (_klein) return '';
    var el = API.ziel(k);
    if (!el || !el.offsetHeight) return '<div class="pw-leer">' + piktogramm(k) + '</div>';
    var c = el.cloneNode(true);
    [].forEach.call(c.querySelectorAll('[id]'), function (n) { n.removeAttribute('id'); }); c.removeAttribute('id');
    [].forEach.call(c.querySelectorAll('button,a,input,select,textarea,[tabindex]'), function (n) { n.setAttribute('tabindex', '-1'); });
    c.classList.remove('gp-aus'); c.style.order = ''; c.style.margin = '0';
    /* Die Cockpit-Regeln hängen an #dashboard-main #dp-stage .app: die Vorschau bekommt dieselbe Hülle (nur Klassen,
       die IDs bleiben, die echten Elemente stehen im Dokument davor und gewinnen bei getElementById) */
    var app = el.parentNode, st = document.getElementById('dp-stage'), dm = document.getElementById('dashboard-main');
    var huelle = function (inner) {
      if (!st || !dm || !app) return inner;
      return '<div id="dashboard-main" class="' + esc(dm.className) + '" style="all:unset;display:block"><div id="dp-stage" class="' + esc(st.className) + '" style="max-width:none;margin:0;padding:0"><div class="' + esc(app.className) + '" style="max-width:none;margin:0;padding:0">' + inner + '</div></div></div>';
    };
    return '<div class="pw-live" aria-hidden="true" inert><div class="pw-live-in" data-ew="' + (el.offsetWidth || 900) + '">' + huelle(c.outerHTML) + '</div></div>';
  }
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
    var kzH = '<div class="pw-pg"><div class="pw-pt">' + symbol('kz') + 'Kennzahlen oben</div><div class="pw-pl">' + API.kzdef.filter(function (d) { return !kzan[d.k]; }).map(function (d) {
      var w = kzWert(d.k);
      return '<button type="button" class="pw-pi pw-pkz" draggable="true" data-pw="kzhinzu" data-k="' + d.k + '" title="Ziehen oder klicken: erscheint oben in der Kennzahl-Leiste"><span class="pw-kzmini" aria-hidden="true">' + esc(w.v || '123') + '</span><b>' + esc(d.t) + '</b><i aria-hidden="true">+</i></button>';
    }).join('') + '</div></div>';
    var h = '';
    var gesehen = {};
    GRUPPEN.forEach(function (g) { g.m.forEach(function (k) { gesehen[k] = 1; }); });
    var rest = API.ansicht.filter(function (a) { return !a.fest && !a.vb && !gesehen[a.k]; }).map(function (a) { return a.k; });
    GRUPPEN.concat(rest.length ? [{ k: 'rest', t: 'Weitere', m: rest }] : []).forEach(function (g) {
      var L = g.m.filter(function (k) { var a = modul(k); return a && !a.fest && !a.vb && !an[k]; });
      if (g.k === 'wert') { API.vbk.forEach(function (v) { if (!A.an[v]) L.push(v); }); }
      if (!L.length) return;
      h += '<div class="pw-pg"><div class="pw-pt">' + symbol(g.k) + esc(g.t) + '</div><div class="pw-pl">' + L.map(function (k) {
        var a = modul(k);
        return '<button type="button" class="pw-pi" draggable="true" data-pw="hinzu" data-k="' + k + '" title="' + esc(a.w || '') + '">' + piktogramm(k) + '<b>' + esc(a.t) + (a.vb ? '<small>in Projektion und Verlauf</small>' : '') + '</b><i aria-hidden="true">+</i></button>';
      }).join('') + '</div></div>';
    });
    return h + kzH;   /* Module zuerst, Kennzahlen am Ende der Palette */
  }
  function zeichnen() {
    var p = document.getElementById('dp-pw'); if (!p) return;
    _klein = window.innerWidth < 820; p.classList.toggle('pw-klein', _klein);
    var A = API.stand();
    var fok = document.activeElement && p.contains(document.activeElement) ? [document.activeElement.getAttribute('data-pw') || 'blk', document.activeElement.getAttribute('data-k')] : null;
    p.querySelector('.pw-vl').innerHTML = API.vorlagen.map(function (v) {
      return '<button type="button" class="pw-v' + (A.vorlage === v.k ? ' an' : '') + '" data-pw="vorlage" data-k="' + v.k + '" aria-pressed="' + (A.vorlage === v.k) + '" title="' + esc(v.u) + '">' + vorlageMini(v) + '<b>' + esc(v.t) + '</b></button>';
    }).join('');
    p.querySelector('.pw-pal').innerHTML = palette();
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
    [].forEach.call(p.querySelectorAll('.pw-live-in'), function (x) {
      /* v4890 · maßstäblich: die Vorschau rechnet mit der echten Breite des Moduls im Cockpit und wird auf die Blockbreite
         verkleinert (bei 1440 px etwa 60 %), statt mit doppelter Breite winzig zu werden */
      var box = x.parentNode.clientWidth || 300, w = Number(x.getAttribute('data-ew')) || 900, f = Math.min(1, box / w);
      x.style.width = w + 'px'; x.style.transform = 'scale(' + f.toFixed(3) + ')';
      x.parentNode.style.height = Math.min(210, Math.max(60, Math.round((x.scrollHeight || 300) * f))) + 'px';
    });
  }
  function melden(t) { var m = document.getElementById('pw-live-msg'); if (m) { m.textContent = ''; setTimeout(function () { m.textContent = t; }, 30); } }

  /* ── Ziehen ── */
  function dropZiel(ev, sel) { var t = ev.target && ev.target.closest ? ev.target.closest(sel) : null; return t; }
  function ziehenEinrichten(p) {
    p.addEventListener('dragstart', function (ev) {
      var b = ev.target.closest('.pw-b,.pw-pi,.pw-kzc'); if (!b) return;
      _zug = b.classList.contains('pw-b') ? { art: 'mod', k: b.getAttribute('data-k') }
        : b.classList.contains('pw-kzc') ? { art: 'kz', k: b.getAttribute('data-kz') }
        : b.classList.contains('pw-pkz') ? { art: 'kzneu', k: b.getAttribute('data-k') } : { art: 'neu', k: b.getAttribute('data-k') };
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', _zug.k); } catch (e) {}
      b.classList.add('pw-zieht'); p.classList.add('pw-zug-' + (_zug.art.indexOf('kz') === 0 ? 'kz' : 'mod'));
    });
    p.addEventListener('dragend', function () { _zug = null; p.classList.remove('pw-zug-kz', 'pw-zug-mod'); [].forEach.call(p.querySelectorAll('.pw-zieht,.pw-ueber'), function (x) { x.classList.remove('pw-zieht', 'pw-ueber'); }); });
    p.addEventListener('dragover', function (ev) {
      if (!_zug) return;
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
      + '<div class="pw-body"><aside class="pw-pal" aria-label="Bausteine zum Hinzufügen"></aside>'
      + '<section class="pw-ab" aria-label="Arbeitsbereich"><div class="pw-buehne">'
      + '<div class="pw-score" aria-label="Score-Kopf, fest"><span class="pw-ring" aria-hidden="true"></span><b>Investor Portfolio Score</b><small>steht immer oben, mit Investment- und Finanzierungs-Score</small><span class="pw-fest">fest</span></div>'
      + '<div class="pw-h">Kennzahlen oben</div><div class="pw-kz" role="list"></div>'
      + '<div class="pw-h">Bausteine</div><div class="pw-raster" role="list"></div></div></section></div>'
      + '<div class="pw-f"><span id="pw-live-msg" class="pw-msg" aria-live="polite"></span><button type="button" class="pw-ok" data-pw="zu">Fertig</button></div>';
    document.body.appendChild(p); document.documentElement.classList.add('pw-offen');
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
    });
    ziehenEinrichten(p);
    document.addEventListener('keydown', taste, true); window.addEventListener('resize', zeichnen);
    zeichnen();
    var f = p.querySelector('.pw-b') || p.querySelector('.pw-x'); if (f) f.focus();
  }

  function stil() {
    if (document.getElementById('dp-pw-stil')) return;
    /* v4890 · DealPilot-Fensterstil wie modal-boarding-skin.js (Markenleiste #070707, Goldkopf, heller Inhalt),
       jede Goldfläche über Whitelabel-Token, damit ein Partner seine Farbe bekommt. Statusfarben fest. */
    var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GD = 'var(--wl-b8932f, #b8932f)', s = document.createElement('style'); s.id = 'dp-pw-stil';
    var T = '#2A2727', M = '#6B655C', L = '#E6DFD1', C = '#FBF6E9', W = '#FDFCFA';
    s.textContent = [
      'html.pw-offen,html.pw-offen body{overflow:hidden}',
      '.pw-hg{position:fixed;inset:0;background:rgba(5,5,5,.6);z-index:100040}',
      '.pw{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1180px,96vw);height:min(880px,94vh);z-index:100041;display:flex;flex-direction:column;background:#fff;color:' + T + ';border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.45);font-family:Inter,system-ui,sans-serif;overflow:hidden}',
      '.pw-brand{flex:none;background:#070707;padding:12px 20px;display:flex;align-items:center;gap:12px}',
      '.pw-logo{font:700 17px "Space Grotesk",Inter,system-ui,sans-serif;color:#fff;letter-spacing:.3px}', '.pw-logo b{color:' + GH + ';font-weight:700}',
      '.pw-tag{margin-left:auto;font:700 10px "JetBrains Mono",monospace;letter-spacing:2px;color:' + G + '}',
      '.pw .pw-x{width:32px;height:32px;border-radius:9px;background:#17130d;border:1.5px solid ' + GH + ';color:' + GH + ';box-shadow:0 2px 8px rgba(0,0,0,.45);display:inline-flex;align-items:center;justify-content:center;padding:0 !important;min-height:0 !important;margin-left:8px;cursor:pointer;position:relative;flex:0 0 auto}',
      '.pw .pw-x svg{width:15px;height:15px;pointer-events:none}', '.pw .pw-x::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px}',
      '.pw .pw-x:hover{background:' + G + ';color:#fff}',
      '.pw-hero{flex:none;display:flex;gap:16px;align-items:flex-end;justify-content:space-between;padding:14px 20px 14px;background:linear-gradient(110deg,' + GH + ',' + G + ' 60%,' + GD + ')}',
      '.pw-eye{display:block;font:700 11px "JetBrains Mono",monospace;letter-spacing:3px;text-transform:uppercase;color:#5a4a14;margin-bottom:4px}',
      '.pw-kt b{display:block;font:700 21px/1.2 "Space Grotesk",Inter,sans-serif;color:#1a1407;margin:0 0 3px}',
      '.pw-kt small{font:400 13px/1.5 Inter,sans-serif;color:#3a2e08}',
      '.pw-kb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}',
      '.pw-btn{font:600 12.5px Inter,sans-serif;color:#1a1407;background:rgba(255,255,255,.55);border:1px solid rgba(26,20,7,.25);border-radius:9px;padding:7px 12px;cursor:pointer;min-height:34px}',
      '.pw-btn:hover:not(:disabled){background:#fff}', '.pw-btn:disabled{opacity:.45;cursor:default}',
      '.pw-vlw{flex:none;display:flex;gap:12px;align-items:center;padding:10px 20px;border-bottom:1px solid ' + L + ';overflow-x:auto;background:' + W + '}',
      '.pw-h{font:600 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:' + M + ';white-space:nowrap}',
      '.pw-vl{display:flex;gap:8px}',
      '.pw-v{display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:112px;padding:8px 10px;background:#fff;border:1px solid ' + L + ';border-radius:10px;color:' + T + ';cursor:pointer;text-align:left}',
      '.pw-v b{font:600 11.5px Inter,sans-serif;white-space:nowrap}', '.pw-v:hover{border-color:' + G + '}',
      '.pw-v.an{border-color:' + G + ';box-shadow:0 0 0 1px ' + G + ' inset;background:' + C + '}',
      '.pw-vm{display:grid;grid-template-columns:1fr 1fr;gap:2px;width:92px}', '.pw-vm i{height:7px;border-radius:2px;background:#E2DACB}', '.pw-vm i.g{grid-column:span 2}',
      '.pw-v.an .pw-vm i{background:color-mix(in srgb, ' + G + ' 65%, #E2DACB)}',
      '.pw-body{flex:1;display:grid;grid-template-columns:236px 1fr;min-height:0}',
      '.pw-pal{overflow:auto;padding:12px 12px 20px;border-right:1px solid ' + L + ';background:' + C + '}',
      '.pw-pg{margin-bottom:14px}',
      '.pw-pt{display:flex;align-items:center;gap:7px;font:700 10px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:' + T + ';margin:4px 2px 7px}',
      '.pw-sym{width:18px;height:18px;flex:0 0 18px;color:' + GD + ';background:color-mix(in srgb, ' + G + ' 16%, #fff);border-radius:6px;padding:3px;box-sizing:content-box}',
      '.pw-pl{display:flex;flex-direction:column;gap:5px}',
      '.pw-pi{display:flex;align-items:center;gap:9px;width:100%;padding:6px 8px;background:#fff;border:1px solid ' + L + ';border-radius:9px;color:' + T + ';cursor:grab;text-align:left}',
      '.pw-pi:hover,.pw-pi:focus-visible{border-color:' + G + ';outline:none;box-shadow:0 1px 4px rgba(0,0,0,.06)}',
      '.pw-pi b{flex:1;font:500 12px/1.3 Inter,sans-serif;min-width:0}', '.pw-pi b small{display:block;font:400 10px Inter,sans-serif;color:' + M + '}',
      '.pw-pi i{font-style:normal;font:600 15px Inter,sans-serif;color:' + GD + '}',
      '.pw-kzmini{flex:0 0 auto;max-width:74px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 10.5px "Space Grotesk",sans-serif;color:' + T + ';background:#fff;border:1px solid ' + L + ';border-top:2px solid ' + G + ';border-radius:5px;padding:3px 6px}',
      '.pw-pik{flex:0 0 40px;height:26px;display:flex;align-items:flex-end;gap:2px;padding:3px;border-radius:5px;background:#F4EFE4;border:1px solid ' + L + ';color:' + G + ';box-sizing:border-box}',
      '.pw-pik-balken i{flex:1;background:' + G + ';border-radius:1px}',
      '.pw-pik-linie svg{width:100%;height:100%}',
      '.pw-pik-tab{flex-direction:column;align-items:stretch;justify-content:space-between}', '.pw-pik-tab i{height:2px;background:#B9AE99}', '.pw-pik-tab i:first-child{background:' + G + '}',
      '.pw-pik-karten{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}', '.pw-pik-karten i{background:#D9CFBC;border-radius:1px}', '.pw-pik-karten i:nth-child(2){background:' + G + '}',
      '.pw-pik-kacheln{align-items:stretch}', '.pw-pik-kacheln i{flex:1;background:#fff;border:1px solid #D9CFBC;border-top:2px solid ' + G + ';border-radius:2px}',
      '.pw-pik-text{flex-direction:column;align-items:flex-start;justify-content:space-around}', '.pw-pik-text i{height:2px;background:#B9AE99}',
      '.pw-ab{overflow:auto;padding:16px 18px 24px;background:#F4F1EA}',
      '.pw-buehne{max-width:900px;margin:0 auto}',
      '.pw-ab .pw-h{margin:14px 0 6px}',
      '.pw-score{display:flex;gap:10px;align-items:center;background:#0A0A0A;color:#FDFCFA;border-radius:10px;padding:10px 14px;border-bottom:2px solid ' + G + '}',
      '.pw-ring{width:22px;height:22px;border-radius:50%;border:3px solid ' + G + ';border-right-color:#333;flex:0 0 22px;box-sizing:border-box}',
      '.pw-score b{font:600 13px "Space Grotesk",sans-serif}', '.pw-score small{font:400 11.5px Inter,sans-serif;color:#C9C1B1}',
      '.pw-fest{margin-left:auto;font:700 9.5px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:' + GH + ';border:1px solid ' + G + ';border-radius:999px;padding:2px 8px}',
      '.pw-kz{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:7px}',
      '.pw-kzc{position:relative;display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid ' + L + ';border-top:2px solid ' + G + ';border-radius:8px;padding:7px 22px 7px 10px;cursor:grab;min-width:0}',
      '.pw-kzc.pw-kzh{background:' + C + '}',
      '.pw-kzl{font:500 9.5px Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:' + M + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pw-kzv{font:600 15px "Space Grotesk",sans-serif;color:' + T + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}', '.pw-kzv.pw-pos{color:#27704A}', '.pw-kzv.pw-neg{color:#9E4943}',
      '.pw-kzs{font:400 10px Inter,sans-serif;color:' + M + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pw-kzc button,.pw-akt button[data-pw="weg"]{position:absolute;right:3px;top:3px;width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:#8A8274;cursor:pointer;font-size:14px;padding:0 !important;min-height:0 !important;line-height:20px}',
      '.pw-akt button[data-pw="weg"]{top:50%;transform:translateY(-50%)}',
      '.pw-kzc button:hover,.pw-akt button[data-pw="weg"]:hover{background:#B8625C;color:#fff}',
      '.pw-kzdrop,.pw-drop{border:1.5px dashed #CFC5B2;border-radius:8px;color:' + M + ';font:500 11px Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:8px 12px;min-height:44px;text-align:center}',
      '.pw-drop{grid-column:1/-1;min-height:46px}',
      '.pw-raster{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.pw-b{grid-column:1/-1;position:relative;background:#fff;border:1px solid ' + L + ';border-radius:10px;padding:8px 10px;cursor:grab;min-width:0;transition:box-shadow .15s,transform .15s}',
      '.pw-b.pw-halb{grid-column:span 1}',
      '.pw-b:hover,.pw-b:focus-visible{border-color:' + G + ';outline:none;box-shadow:0 0 0 2px color-mix(in srgb, ' + G + ' 35%, transparent)}',
      '.pw-bk{display:flex;align-items:center;gap:8px}', '.pw-bk b{flex:1;font:600 12.5px "Space Grotesk",Inter,sans-serif;color:' + T + ';min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pw-griff{color:#A79D8C;font-size:12px;letter-spacing:-2px}',
      '.pw-akt{display:flex;gap:4px;align-items:center;position:relative;padding-right:24px}',
      '.pw-akt button[data-pw="breite"]{font:600 11px Inter,sans-serif;border:1px solid #DDD3C2;background:' + W + ';color:' + T + ';border-radius:6px;padding:3px 8px !important;min-height:0 !important;cursor:pointer;min-width:40px}',
      '.pw-akt button[data-pw="breite"]:hover{border-color:' + G + '}',
      '.pw-sub{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}', '.pw-sub span{display:inline-flex;align-items:center;gap:4px;font:500 10.5px Inter,sans-serif;background:#F1ECE2;border-radius:999px;padding:2px 4px 2px 9px}',
      '.pw-sub button{border:0;background:transparent;color:#8A8274;cursor:pointer;font-size:13px;width:18px;height:18px;border-radius:50%;padding:0 !important;min-height:0 !important}', '.pw-sub button:hover{background:#B8625C;color:#fff}',
      '.pw-live{position:relative;overflow:hidden;margin-top:7px;border-radius:7px;background:' + W + ';border:1px solid #EFE9DC;pointer-events:none}',
      '.pw-live-in{transform-origin:0 0;position:absolute;left:0;top:0}',
      '.pw-leer{margin-top:7px;height:64px;border-radius:7px;background:' + W + ';border:1px dashed ' + L + ';display:flex;align-items:center;justify-content:center}',
      '.pw-leer .pw-pik{flex:0 0 96px;height:44px}',
      '.pw-zieht{opacity:.45}', '.pw-ueber{box-shadow:-4px 0 0 0 ' + G + ' !important;border-color:' + G + ' !important}',
      '.pw-zug-mod .pw-drop,.pw-zug-kz .pw-kzdrop{border-color:' + G + ';color:' + T + ';background:color-mix(in srgb, ' + G + ' 10%, #fff)}',
      '.pw-f{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;border-top:1px solid ' + L + ';background:#fff}',
      '.pw-msg{font:400 12px Inter,sans-serif;color:' + M + '}',
      '.pw .pw-ok{font:600 13px Inter,sans-serif;background:#0a0a0a;color:' + GH + ';border:0;border-radius:9px;padding:9px 24px;cursor:pointer;min-height:38px}', '.pw .pw-ok:hover{background:#141414}',
      '.pw.pw-klein{left:0;top:0;transform:none;width:100%;height:100%;border-radius:0}',
      '.pw-klein .pw-hero{flex-direction:column;align-items:stretch;gap:8px}', '.pw-klein .pw-kt small{display:none}', '.pw-klein .pw-alt{display:none}', '.pw-klein .pw-tag{display:none}',
      '.pw-klein .pw-kb{justify-content:flex-start}',
      '.pw-klein .pw-body{display:flex;flex-direction:column;overflow:auto}', '.pw-klein .pw-pal{order:2;border-right:0;border-top:1px solid ' + L + ';overflow:visible}',
      '.pw-klein .pw-ab{order:1;overflow:visible}', '.pw-klein .pw-raster{grid-template-columns:1fr}', '.pw-klein .pw-b.pw-halb{grid-column:1/-1}',
      '.pw-klein .pw-kz{grid-template-columns:repeat(2,minmax(0,1fr))}', '.pw-klein .pw-score small{display:none}',
      '@media (prefers-reduced-motion:reduce){.pw-b{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.DpPfWerkstatt = {
    aktiv: function () { try { return localStorage.getItem('dp_pf_werkstatt') !== '0'; } catch (e) { return true; } },
    oeffnen: oeffnen, zu: zu, version: 'v4890'
  };
})();
