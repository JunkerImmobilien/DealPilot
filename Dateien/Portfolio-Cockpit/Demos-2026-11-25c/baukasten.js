/* Runde 3 (25.11.2026) · Baukasten „Ansicht anpassen“ für die Portfolio-Cockpit-Demos.
   Sitzt als Knopf in der Kopfleiste. Seitenleiste im DealPilot-Design, Gold über Whitelabel-Token,
   schließt nur über ×, „Fertig“ oder Esc (nie per Klick daneben). Module ein und aus, ziehen oder
   mit Pfeilen sortieren, halbe oder volle Breite, Vorlagen, zurücksetzen. Gespeichert je Demo im
   Browser (localStorage, mit try/catch). In der App käme derselbe Stand in den Einstellungsspeicher.
   Der Score-Kopf und die Kennzahlenleiste stehen fest oben und gehören nicht zum Baukasten. */
window.BK = (function () {
  'use strict';
  var KEY = 'dp_demo_bk_' + location.pathname.split('/').pop();
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lies() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function schreib(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} }

  /* Katalog: jedes Diagramm der Demos als Modul (dieselben Funktionen wie in bausteine.js / kit.js) */
  var KAT = {
    bsz: { t: 'Bestand und Zielbild je Objekt', b: 12, bau: function (s) { K.modul(s, function () { return K.karte('Bestand und Zielbild je Objekt', 'Fahr über ein Objekt für die Details.', K.bszTabelle()); }); } },
    todo: { t: 'Was jetzt zu tun ist', b: 6, bau: function (s) { K.modul(s, function () { return K.karte('Was jetzt zu tun ist', 'Aus deinen Zahlen abgeleitet, wichtigstes zuerst.', K.hinweise(8)); }); } },
    gb: { t: 'Gesamtbewertung', b: 12, bau: function (s) { K.modul(s, function () { return K.gesamtKarte(); }); } },
    ek: { t: 'EK-Rendite je Objekt', b: 6, bau: function (s) { K.modul(s, function (w) { return K.karte('EK-Rendite je Objekt', 'Vier Stufen je Objekt, die gewählte kräftig.', K.ekJeObjekt(w)); }); } },
    rq: { t: 'Woher die Rendite kommt', b: 6, bau: function (s) { K.modul(s, function (w) { return K.karte('Woher die Rendite kommt', 'Alle Objekte zusammen, Euro im Jahr.', K.renditeQuellen(w) + K.stufenListe(K.D.ekrP)); }); } },
    ke: { t: 'Was dein Eigenkapital verdient', b: 6, bau: function (s) { B.kapitalEffizienz(s); } },
    cf: { t: 'Cashflow vor und nach Steuer je Objekt', b: 6, bau: function (s) { B.cfVorNach(s); } },
    br: { t: 'Wohin die Miete geht', b: 6, bau: function (s) { B.cfBruecke(s); } },
    vp: { t: 'Vermögensaufbau', b: 6, bau: function (s) { B.vermoegenProjektion(s); } },
    zb: { t: 'Zinsbindung', b: 6, bau: function (s) { B.zinsbindung(s); } },
    fj: { t: 'Anschlussfinanzierung je Jahr', b: 6, bau: function (s) { B.faelligJeJahr(s); } },
    zs: { t: 'Zinsstress beim Anschluss', b: 12, bau: function (s) { B.zinsStress(s); } },
    rm: { t: 'Risikomatrix', b: 12, bau: function (s) { B.risikoMatrix(s); } },
    rd: { t: 'Rendite gegen Tragfähigkeit', b: 6, bau: function (s) { B.renditeDscr(s, { h: 300 }); } },
    st: { t: 'Steuer je Objekt', b: 6, bau: function (s) { B.steuerJeObjekt(s); } },
    mh: { t: 'Miethebel', b: 6, bau: function (s) { B.mietHebel(s); } },
    wz: { t: 'Wert heute und im Zielbild', b: 6, bau: function (s) { B.wertZielbild(s); } },
    zbal: { t: 'Deine Ziele', b: 6, bau: function (s) { B.zielBalken(s); } },
    zus: { t: 'Wo die Miete herkommt', b: 6, bau: function (s) { B.zusammensetzung(s, 'ort'); } },
    kac: { t: 'Objektkarten zum Umdrehen', b: 12, bau: function (s) { B.objektKacheln(s); } },
    gal: { t: 'Deine Objekte mit Bild', b: 12, bau: function (s) { K.modul(s, function () { return K.karte('Deine Objekte', 'Foto aus dem Objekt, sonst die Lagekarte wie auf dem Bericht.', K.galerie()); }); } }
  };
  var VORLAGEN = [
    { k: 'standard', t: 'Standard', u: 'Was ein Bestandshalter jeden Monat sehen will', m: [['bsz', 12], ['todo', 6], ['ek', 6], ['cf', 6], ['zb', 6], ['br', 6], ['vp', 6]] },
    { k: 'risiko', t: 'Risiko', u: 'Wo der Bestand verwundbar ist', m: [['rm', 12], ['rd', 6], ['zbal', 6], ['fj', 6], ['todo', 6], ['zs', 12]] },
    { k: 'steuer', t: 'Steuer', u: 'Was die Steuer aus dem Cashflow macht', m: [['st', 6], ['cf', 6], ['br', 6], ['rq', 6], ['bsz', 12]] },
    { k: 'bank', t: 'Finanzierung · Bank-Mappe', u: 'Für das Gespräch mit der Bank', m: [['zb', 6], ['fj', 6], ['ke', 6], ['zbal', 6], ['zs', 12], ['bsz', 12]] },
    { k: 'bericht', t: 'Bericht', u: 'Ruhig, zum Lesen und Weitergeben', m: [['gb', 12], ['bsz', 12], ['vp', 6], ['rq', 6], ['gal', 12]] }
  ];

  var raster = null, start = [], st = null, offen = false, panel = null, vorherFokus = null;

  function karten() { return [].filter.call(raster.children, function (c) { return c.id && c.classList.contains('karte'); }); }
  function titel(el) { var h = el.querySelector('h2'); if (h) return h.textContent.trim(); var k = el.getAttribute('data-bk'); return k && KAT[k] ? KAT[k].t : el.id; }
  function breiteVon(el) { var m = /--s:\s*(\d+)/.exec(el.getAttribute('style') || ''); return m ? Number(m[1]) : 6; }
  function stand() {
    return { reihe: karten().map(function (c) { return c.id; }), aus: karten().filter(function (c) { return c.classList.contains('bk-aus'); }).map(function (c) { return c.id; }),
      breite: karten().reduce(function (a, c) { a[c.id] = breiteVon(c); return a; }, {}), extra: karten().filter(function (c) { return c.getAttribute('data-bk'); }).map(function (c) { return c.getAttribute('data-bk'); }), vorlage: st && st.vorlage || null };
  }
  /* Welches Katalog-Modul eine Karte der Seite ist (die Demos bauen dieselben Module unter eigener Kennung) */
  function katKey(c) { var k = c.getAttribute('data-bk'); if (k) return k; if (c.id === 'zs') return /Miete/.test(titel(c)) ? 'zus' : 'zs'; return KAT[c.id] ? c.id : null; }
  function modulDazu(key) {
    var da = karten().filter(function (c) { return katKey(c) === key; })[0]; if (da) return da;
    var id = 'bk-' + key; if (document.getElementById(id)) return document.getElementById(id);
    var el = document.createElement('div'); el.className = 'karte'; el.id = id; el.setAttribute('data-bk', key); el.style.setProperty('--s', KAT[key].b);
    raster.appendChild(el); KAT[key].bau('#' + id); return el;
  }
  function anwenden(s, ohneSpeichern) {
    (s.extra || []).forEach(function (k) { if (KAT[k]) modulDazu(k); });
    (s.reihe || []).forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode === raster) raster.appendChild(el); });
    karten().forEach(function (c) {
      var aus = (s.aus || []).indexOf(c.id) >= 0; c.classList.toggle('bk-aus', aus);
      if (s.breite && s.breite[c.id]) c.style.setProperty('--s', s.breite[c.id]);
    });
    st = s; if (!ohneSpeichern) schreib(s);
    K.neu();
  }
  function vorlage(v) {
    var s = { reihe: [], aus: karten().map(function (c) { return c.id; }), breite: {}, extra: [], vorlage: v.k };
    v.m.forEach(function (x) { var id = modulDazu(x[0]).id; if (id.indexOf('bk-') === 0) s.extra.push(x[0]); s.reihe.push(id); s.breite[id] = x[1]; s.aus = s.aus.filter(function (a) { return a !== id; }); });
    karten().forEach(function (c) { if (s.reihe.indexOf(c.id) < 0) s.reihe.push(c.id); if (s.extra.indexOf(c.getAttribute('data-bk')) < 0 && c.getAttribute('data-bk') && s.aus.indexOf(c.id) < 0) s.aus.push(c.id); });
    anwenden(s); liste();
  }
  function zuruecksetzen() {
    schreib(null); st = null;
    karten().forEach(function (c) { if (c.getAttribute('data-bk')) c.remove(); });
    start.forEach(function (x) { var el = document.getElementById(x.id); if (el) { raster.appendChild(el); el.classList.remove('bk-aus'); el.style.setProperty('--s', x.b); } });
    K.neu(); liste();
  }

  /* ── Seitenleiste ─────────────────────────────────────────────────── */
  function liste() {
    if (!panel) return;
    var s = stand(), drin = {}; karten().forEach(function (c) { var k = katKey(c); if (k) drin[k] = 1; });
    panel.querySelector('.bk-vorl').innerHTML = VORLAGEN.map(function (v) { return '<button type="button" class="bk-chip' + (s.vorlage === v.k ? ' an' : '') + '" data-v="' + v.k + '" title="' + esc(v.u) + '">' + esc(v.t) + '</button>'; }).join('');
    panel.querySelector('.bk-liste').innerHTML = karten().map(function (c, i, a) {
      var aus = c.classList.contains('bk-aus'), b = breiteVon(c);
      return '<li draggable="true" data-id="' + c.id + '" class="' + (aus ? 'aus' : '') + '"><span class="bk-griff" aria-hidden="true">⋮⋮</span>' +
        '<label class="bk-an"><input type="checkbox" ' + (aus ? '' : 'checked') + ' data-a="an" aria-label="' + esc(titel(c)) + ' anzeigen"><i></i></label>' +
        '<span class="bk-t">' + esc(titel(c)) + '</span>' +
        '<span class="bk-br" role="group" aria-label="Breite"><button type="button" data-a="b6" aria-pressed="' + (b < 12) + '">½</button><button type="button" data-a="b12" aria-pressed="' + (b >= 12) + '">ganz</button></span>' +
        '<span class="bk-pf"><button type="button" data-a="hoch" aria-label="nach oben"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" data-a="runter" aria-label="nach unten"' + (i === a.length - 1 ? ' disabled' : '') + '>↓</button></span></li>';
    }).join('');
    panel.querySelector('.bk-kat').innerHTML = Object.keys(KAT).filter(function (k) { return !drin[k]; }).map(function (k) {
      return '<button type="button" class="bk-plus" data-k="' + k + '"><b>+</b> ' + esc(KAT[k].t) + '</button>';
    }).join('');
  }
  function bauPanel() {
    panel = document.createElement('div'); panel.className = 'bk-wrap'; panel.hidden = true;
    panel.innerHTML = '<div class="bk-schleier"></div><aside class="bk-panel" role="dialog" aria-modal="true" aria-labelledby="bk-titel">' +
      '<header><div><div class="bk-eye">Portfolio-Cockpit</div><h2 id="bk-titel">Ansicht anpassen</h2></div><button type="button" class="bk-x" data-a="zu" aria-label="Schließen">×</button></header>' +
      '<div class="bk-inhalt"><p class="bk-hin">Score-Kopf und Kennzahlen bleiben fest oben. Darunter stellst du dir dein Cockpit selbst zusammen.</p>' +
      '<h3>Vorlagen</h3><div class="bk-vorl"></div>' +
      '<h3>Deine Module <small>ziehen oder Pfeile zum Sortieren</small></h3><ul class="bk-liste"></ul>' +
      '<h3>Modul hinzufügen</h3><div class="bk-kat"></div></div>' +
      '<footer><button type="button" class="bk-reset" data-a="reset">Zurücksetzen</button><button type="button" class="bk-ok" data-a="zu">Fertig</button></footer></aside>';
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a'), li = b.closest('li'), el = li && document.getElementById(li.getAttribute('data-id'));
      if (a === 'zu') return schliessen();
      if (a === 'reset') return zuruecksetzen();
      if (b.hasAttribute('data-v')) return vorlage(VORLAGEN.filter(function (v) { return v.k === b.getAttribute('data-v'); })[0]);
      if (b.hasAttribute('data-k')) { var neu = modulDazu(b.getAttribute('data-k')); var s = stand(); s.vorlage = null; anwenden(s); liste(); neu.scrollIntoView({ block: 'nearest' }); return; }
      if (!el) return;
      if (a === 'b6' || a === 'b12') el.style.setProperty('--s', a === 'b6' ? 6 : 12);
      if (a === 'hoch' && el.previousElementSibling) raster.insertBefore(el, el.previousElementSibling);
      if (a === 'runter' && el.nextElementSibling) raster.insertBefore(el.nextElementSibling, el);
      var s2 = stand(); s2.vorlage = null; anwenden(s2); liste();
      var f = panel.querySelector('li[data-id="' + el.id + '"] [data-a="' + a + '"]'); if (f && !f.disabled) f.focus();
    });
    panel.addEventListener('change', function (e) {
      var i = e.target; if (i.getAttribute('data-a') !== 'an') return;
      var el = document.getElementById(i.closest('li').getAttribute('data-id')); el.classList.toggle('bk-aus', !i.checked);
      var s = stand(); s.vorlage = null; anwenden(s); liste();
    });
    var zieh = null;
    panel.addEventListener('dragstart', function (e) { var li = e.target.closest('li'); if (!li) return; zieh = li.getAttribute('data-id'); li.classList.add('zieht'); try { e.dataTransfer.setData('text/plain', zieh); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} });
    panel.addEventListener('dragover', function (e) { var li = e.target.closest('li'); if (!li || !zieh) return; e.preventDefault(); panel.querySelectorAll('li.ziel').forEach(function (x) { x.classList.remove('ziel'); }); li.classList.add('ziel'); });
    panel.addEventListener('dragend', function () { zieh = null; panel.querySelectorAll('li').forEach(function (x) { x.classList.remove('zieht', 'ziel'); }); });
    panel.addEventListener('drop', function (e) {
      var li = e.target.closest('li'); if (!li || !zieh) return; e.preventDefault();
      var von = document.getElementById(zieh), nach = document.getElementById(li.getAttribute('data-id'));
      if (von && nach && von !== nach) { var r = li.getBoundingClientRect(), danach = e.clientY > r.top + r.height / 2; raster.insertBefore(von, danach ? nach.nextSibling : nach); }
      zieh = null; var s = stand(); s.vorlage = null; anwenden(s); liste();
    });
    document.addEventListener('keydown', function (e) {
      if (!offen) return;
      if (e.key === 'Escape') { e.preventDefault(); schliessen(); return; }
      if (e.key === 'Tab') {   /* Fokus bleibt in der Seitenleiste */
        var f = [].filter.call(panel.querySelectorAll('button,input'), function (x) { return !x.disabled && x.offsetParent; });
        if (!f.length) return; var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
  function oeffnen() { if (!panel) bauPanel(); vorherFokus = document.activeElement; liste(); panel.hidden = false; offen = true; document.documentElement.classList.add('bk-offen'); panel.querySelector('.bk-x').focus(); }
  function schliessen() { if (!panel) return; panel.hidden = true; offen = false; document.documentElement.classList.remove('bk-offen'); if (vorherFokus && vorherFokus.focus) vorherFokus.focus(); }

  function start_() {
    raster = document.querySelector('.seite > .raster:not(.nur-detail)'); if (!raster) return;
    start = karten().map(function (c) { return { id: c.id, b: breiteVon(c) }; });
    var lst = document.querySelector('.leiste2') || document.querySelector('.leiste');
    if (lst) { var b = document.createElement('button'); b.type = 'button'; b.className = 'bk-knopf'; b.innerHTML = '<span aria-hidden="true">▦</span> Ansicht anpassen'; b.addEventListener('click', oeffnen); lst.insertBefore(b, lst.firstChild); }
    var s = lies(); if (s) anwenden(s, true);
    if (/bk=offen/.test(location.search)) oeffnen();
    var v = new URLSearchParams(location.search).get('vorlage'); if (v) { var vv = VORLAGEN.filter(function (x) { return x.k === v; })[0]; if (vv) vorlage(vv); }
  }
  return { start: start_, oeffnen: oeffnen, schliessen: schliessen, KAT: KAT, VORLAGEN: VORLAGEN };
})();
