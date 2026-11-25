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
  var API = null, _offen = false, _vorher = null, _rueck = [], _zug = null, _klein = false;

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
  function modul(k) { return API.ansicht.filter(function (a) { return a.k === k; })[0] || null; }
  function kz(k) { return API.kzdef.filter(function (d) { return d.k === k; })[0] || { k: k, t: k }; }

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
      return '<div id="dashboard-main" class="' + esc(dm.className) + '" style="all:unset;display:block"><div id="dp-stage" class="' + esc(st.className) + '"><div class="' + esc(app.className) + '">' + inner + '</div></div></div>';
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
    var kzH = '<div class="pw-pg"><div class="pw-pt">Kennzahlen oben</div><div class="pw-pl">' + API.kzdef.filter(function (d) { return !kzan[d.k]; }).map(function (d) {
      return '<button type="button" class="pw-pi pw-pkz" draggable="true" data-pw="kzhinzu" data-k="' + d.k + '" title="Ziehen oder klicken zum Hinzufügen"><span class="pw-kzmini" aria-hidden="true">123</span><b>' + esc(d.t) + '</b><i aria-hidden="true">+</i></button>';
    }).join('') + '</div></div>';
    var h = '';
    var gesehen = {};
    GRUPPEN.forEach(function (g) { g.m.forEach(function (k) { gesehen[k] = 1; }); });
    var rest = API.ansicht.filter(function (a) { return !a.fest && !a.vb && !gesehen[a.k]; }).map(function (a) { return a.k; });
    GRUPPEN.concat(rest.length ? [{ k: 'rest', t: 'Weitere', m: rest }] : []).forEach(function (g) {
      var L = g.m.filter(function (k) { var a = modul(k); return a && !a.fest && !a.vb && !an[k]; });
      if (g.k === 'wert') { API.vbk.forEach(function (v) { if (!A.an[v]) L.push(v); }); }
      if (!L.length) return;
      h += '<div class="pw-pg"><div class="pw-pt">' + esc(g.t) + '</div><div class="pw-pl">' + L.map(function (k) {
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
    p.querySelector('.pw-kz').innerHTML = K.map(function (k) {
      return '<div class="pw-kzc" draggable="true" tabindex="0" role="listitem" data-kz="' + k + '" aria-label="Kennzahl ' + esc(kz(k).t) + '. Pfeiltasten verschieben, Entfernen löschen"><small>' + esc(kz(k).t) + '</small><button type="button" data-pw="kzweg" data-k="' + k + '" aria-label="' + esc(kz(k).t) + ' entfernen">×</button></div>';
    }).join('') + '<div class="pw-kzdrop" data-kz-ende="1">Kennzahl hierher ziehen</div>';
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
      /* verkleinert: die Vorschau rechnet mit gut doppelter Breite und wird auf die Blockbreite gestaucht */
      var box = x.parentNode.clientWidth || 300, w = Math.max(Number(x.getAttribute('data-ew')) || 900, Math.round(box * 2.2)), f = Math.min(1, box / w);
      x.style.width = w + 'px'; x.style.transform = 'scale(' + f.toFixed(3) + ')';
      x.parentNode.style.height = Math.min(170, Math.max(60, Math.round((x.scrollHeight || 300) * f))) + 'px';
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
    API = api; if (_offen) { zeichnen(); return; }
    _offen = true; _vorher = document.activeElement; _rueck = []; stil();
    var hg = document.createElement('div'); hg.id = 'dp-pw-hg'; hg.className = 'pw-hg'; hg.setAttribute('aria-hidden', 'true'); document.body.appendChild(hg);
    var p = document.createElement('div'); p.id = 'dp-pw'; p.className = 'pw'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'pw-t');
    p.innerHTML = '<div class="pw-k"><div class="pw-kt"><span class="pw-eye">Portfolio-Cockpit · Arbeitsbereich</span><b id="pw-t">Ansicht zusammenbauen</b>'
      + '<small>Ziehen zum Verschieben, links anklicken oder hineinziehen zum Hinzufügen, × entfernt. Alles speichert sofort.</small></div>'
      + '<div class="pw-kb"><button type="button" class="pw-btn" data-pw="rueck" title="Rückgängig (Strg Z)">↶ Rückgängig</button><button type="button" class="pw-btn" data-pw="reset">Zurücksetzen</button>'
      + '<button type="button" class="pw-btn pw-alt" data-pw="leiste" title="Die bisherige Liste">Als Liste</button><button type="button" class="pw-x" data-pw="zu" aria-label="Schließen">×</button></div></div>'
      + '<div class="pw-vlw"><span class="pw-h">Vorlagen</span><div class="pw-vl"></div></div>'
      + '<div class="pw-body"><aside class="pw-pal" aria-label="Module zum Hinzufügen"></aside>'
      + '<section class="pw-ab" aria-label="Arbeitsbereich"><div class="pw-score" aria-label="Score-Kopf, fest"><span>🔒</span><b>Investor Portfolio Score</b><small>steht immer oben, mit Investment- und Finanzierungs-Score</small></div>'
      + '<div class="pw-h">Kennzahlen oben</div><div class="pw-kz" role="list"></div>'
      + '<div class="pw-h">Module</div><div class="pw-raster" role="list"></div></section></div>'
      + '<div class="pw-f"><span id="pw-live-msg" class="pw-msg" aria-live="polite"></span><button type="button" class="pw-btn pw-ok" data-pw="zu">Fertig</button></div>';
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
    var G = 'var(--wl-c9a84c,#C9A84C)', GH = 'var(--wl-e8cc7a,#E8CC7A)', s = document.createElement('style'); s.id = 'dp-pw-stil';
    s.textContent = [
      'html.pw-offen,html.pw-offen body{overflow:hidden}',
      '.pw-hg{position:fixed;inset:0;background:rgba(5,5,5,.62);z-index:100040}',
      '.pw{position:fixed;inset:3vh 3vw;z-index:100041;display:flex;flex-direction:column;background:#0D0C0A;color:#EDE6D6;border:1px solid color-mix(in srgb,' + G + ' 45%,transparent);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif;overflow:hidden}',
      '.pw-k{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid #2A2620;background:linear-gradient(180deg,#14120E,#0D0C0A)}',
      '.pw-eye{display:block;font:600 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:' + GH + '}',
      '.pw-kt b{display:block;font:600 20px "Space Grotesk",Inter,sans-serif;color:#FDFCFA;margin:2px 0}',
      '.pw-kt small{font:400 12.5px Inter,sans-serif;color:#B8AE9B}',
      '.pw-kb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}',
      '.pw-btn{font:600 12.5px Inter,sans-serif;color:#EDE6D6;background:#1C1914;border:1px solid #3A342A;border-radius:9px;padding:8px 13px;cursor:pointer;min-height:36px}',
      '.pw-btn:hover:not(:disabled){border-color:' + G + '}', '.pw-btn:disabled{opacity:.4;cursor:default}',
      '.pw-ok{background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,var(--wl-b8932f,#b8932f));color:#1A160C;border:0;padding:9px 22px}',
      '.pw-x{width:38px;height:38px;border-radius:50%;border:1px solid #3A342A;background:#1C1914;color:#EDE6D6;font-size:20px;cursor:pointer}',
      '.pw-x:hover{border-color:' + G + '}',
      '.pw-vlw{display:flex;gap:12px;align-items:center;padding:10px 20px;border-bottom:1px solid #2A2620;overflow-x:auto}',
      '.pw-h{font:600 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#9C927F;white-space:nowrap}',
      '.pw-vl{display:flex;gap:8px}',
      '.pw-v{display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:118px;padding:8px 10px;background:#16140F;border:1px solid #2E2A22;border-radius:10px;color:#EDE6D6;cursor:pointer;text-align:left}',
      '.pw-v b{font:600 11.5px Inter,sans-serif;white-space:nowrap}', '.pw-v:hover{border-color:' + G + '}',
      '.pw-v.an{border-color:' + G + ';box-shadow:0 0 0 1px ' + G + ' inset;background:#1F1B13}',
      '.pw-vm{display:grid;grid-template-columns:1fr 1fr;gap:2px;width:96px}', '.pw-vm i{height:7px;border-radius:2px;background:#3A342A}', '.pw-vm i.g{grid-column:span 2}',
      '.pw-v.an .pw-vm i{background:color-mix(in srgb,' + G + ' 70%,#3A342A)}',
      '.pw-body{flex:1;display:grid;grid-template-columns:270px 1fr;min-height:0}',
      '.pw-pal{overflow:auto;padding:12px 12px 20px;border-right:1px solid #2A2620;background:#100E0B}',
      '.pw-pg{margin-bottom:12px}', '.pw-pt{font:600 10px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:' + GH + ';margin:4px 2px 6px}',
      '.pw-pl{display:flex;flex-direction:column;gap:5px}',
      '.pw-pi{display:flex;align-items:center;gap:9px;width:100%;padding:7px 9px;background:#17150F;border:1px solid #2A2620;border-radius:9px;color:#EDE6D6;cursor:grab;text-align:left}',
      '.pw-pi:hover,.pw-pi:focus-visible{border-color:' + G + ';outline:none}',
      '.pw-pi b{flex:1;font:500 12px/1.3 Inter,sans-serif}', '.pw-pi b small{display:block;font:400 10px Inter,sans-serif;color:#9C927F}',
      '.pw-pi i{font-style:normal;font:600 15px Inter,sans-serif;color:' + GH + '}',
      '.pw-kzmini{font:600 10px "Space Grotesk",sans-serif;color:' + GH + ';background:#221E16;border-radius:5px;padding:3px 5px}',
      '.pw-pik{flex:0 0 38px;height:24px;display:flex;align-items:flex-end;gap:2px;padding:3px;border-radius:5px;background:#221E16;color:' + G + '}',
      '.pw-pik-balken i{flex:1;background:' + G + ';border-radius:1px;opacity:.85}',
      '.pw-pik-linie svg{width:100%;height:100%}',
      '.pw-pik-tab{flex-direction:column;align-items:stretch;justify-content:space-between}', '.pw-pik-tab i{height:2px;background:#6B6150}',
      '.pw-pik-karten{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}', '.pw-pik-karten i{background:#6B6150;border-radius:1px}',
      '.pw-pik-kacheln{align-items:stretch}', '.pw-pik-kacheln i{flex:1;background:#4A4336;border-top:2px solid ' + G + ';border-radius:2px}',
      '.pw-pik-text{flex-direction:column;align-items:flex-start;justify-content:space-around}', '.pw-pik-text i{height:2px;background:#6B6150}',
      '.pw-ab{overflow:auto;padding:14px 18px 24px;background:#F4F1EA;color:#2A2727}',
      '.pw-ab .pw-h{color:#6B645A;margin:14px 0 6px}',
      '.pw-score{display:flex;gap:10px;align-items:baseline;background:#0A0A0A;color:#FDFCFA;border-radius:10px;padding:11px 14px;border-bottom:2px solid ' + G + '}',
      '.pw-score b{font:600 13px "Space Grotesk",sans-serif}', '.pw-score small{font:400 11.5px Inter,sans-serif;color:#B8AE9B}',
      '.pw-kz{display:flex;flex-wrap:wrap;gap:6px}',
      '.pw-kzc{position:relative;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #E2DACB;border-top:2px solid ' + G + ';border-radius:8px;padding:7px 26px 7px 10px;cursor:grab;min-width:110px}',
      '.pw-kzc small{font:500 10px Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#4E483F}',
      '.pw-kzc button,.pw-akt button[data-pw="weg"]{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:#8A8274;cursor:pointer;font-size:14px}',
      '.pw-kzc button:hover,.pw-akt button[data-pw="weg"]:hover{background:#B8625C;color:#fff}',
      '.pw-kzdrop,.pw-drop{border:1.5px dashed #CFC5B2;border-radius:8px;color:#8A8274;font:500 11px Inter,sans-serif;display:flex;align-items:center;justify-content:center;padding:8px 12px}',
      '.pw-drop{grid-column:1/-1;min-height:46px}',
      '.pw-raster{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.pw-b{grid-column:1/-1;position:relative;background:#fff;border:1px solid #E2DACB;border-radius:10px;padding:8px 10px;cursor:grab;min-width:0;transition:box-shadow .15s,transform .15s}',
      '.pw-b.pw-halb{grid-column:span 1}',
      '.pw-b:hover,.pw-b:focus-visible{border-color:' + G + ';outline:none;box-shadow:0 0 0 2px color-mix(in srgb,' + G + ' 35%,transparent)}',
      '.pw-bk{display:flex;align-items:center;gap:8px}', '.pw-bk b{flex:1;font:600 12.5px "Space Grotesk",Inter,sans-serif;color:#2A2727;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pw-griff{color:#A79D8C;font-size:12px;letter-spacing:-2px}',
      '.pw-akt{display:flex;gap:4px;align-items:center;position:relative;padding-right:24px}',
      '.pw-akt button[data-pw="breite"]{font:600 11px Inter,sans-serif;border:1px solid #DDD3C2;background:#FAF7F0;color:#2A2727;border-radius:6px;padding:3px 8px;cursor:pointer;min-width:40px}',
      '.pw-akt button[data-pw="breite"]:hover{border-color:' + G + '}',
      '.pw-sub{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px}', '.pw-sub span{display:inline-flex;align-items:center;gap:4px;font:500 10.5px Inter,sans-serif;background:#F1ECE2;border-radius:999px;padding:2px 4px 2px 9px}',
      '.pw-sub button{border:0;background:transparent;color:#8A8274;cursor:pointer;font-size:13px;width:18px;height:18px;border-radius:50%}', '.pw-sub button:hover{background:#B8625C;color:#fff}',
      '.pw-live{position:relative;overflow:hidden;margin-top:7px;border-radius:7px;background:#FBF9F4;pointer-events:none}',
      '.pw-live-in{transform-origin:0 0;position:absolute;left:0;top:0}',
      '.pw-leer{margin-top:7px;height:64px;border-radius:7px;background:#FBF9F4;display:flex;align-items:center;justify-content:center}',
      '.pw-leer .pw-pik{flex:0 0 96px;height:44px;background:#F1ECE2}',
      '.pw-zieht{opacity:.45}', '.pw-ueber{box-shadow:-4px 0 0 0 ' + G + ' !important;border-color:' + G + ' !important}',
      '.pw-zug-mod .pw-drop,.pw-zug-kz .pw-kzdrop{border-color:' + G + ';color:#4E483F;background:color-mix(in srgb,' + G + ' 10%,#fff)}',
      '.pw-f{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;border-top:1px solid #2A2620;background:#0D0C0A}',
      '.pw-msg{font:400 12px Inter,sans-serif;color:#B8AE9B}',
      /* Unter 820 px: Liste mit Ziehgriffen, Palette unter dem Arbeitsbereich, keine Vorschau */
      '.pw.pw-klein{inset:0;border-radius:0}',
      '.pw-klein .pw-k{flex-direction:column;gap:8px}', '.pw-klein .pw-kt small{display:none}', '.pw-klein .pw-alt{display:none}',
      '.pw-klein .pw-body{display:flex;flex-direction:column;overflow:auto}', '.pw-klein .pw-pal{order:2;border-right:0;border-top:1px solid #2A2620;overflow:visible}',
      '.pw-klein .pw-ab{order:1;overflow:visible}', '.pw-klein .pw-raster{grid-template-columns:1fr}', '.pw-klein .pw-b.pw-halb{grid-column:1/-1}',
      '.pw-klein .pw-score small{display:none}',
      '@media (prefers-reduced-motion:reduce){.pw-b{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.DpPfWerkstatt = {
    aktiv: function () { try { return localStorage.getItem('dp_pf_werkstatt') !== '0'; } catch (e) { return true; } },
    oeffnen: oeffnen, zu: zu, version: 'v4870'
  };
})();
