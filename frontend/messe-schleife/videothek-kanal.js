/* ═══════════════════════════════════════════════════════════════════════
   videothek-kanal.js · messe-schleife-5 — Kanal „Videothek" (Taste V)
   Marcel 21.10.2026: „die normalen Videos auch als Schleife … einen extra
   Kanal, wo die alle ablaufen".

   Spielt ALLE Videos der Videothek in der Reihenfolge der Module (videos.json)
   nacheinander, stumm (Messe), endlos. Oben Modul, Titel, „Video n / N“,
   darunter die Spur als Fortschritt. Zwischen zwei Videos eine Tafel:
     · Gewinnspiel (tafeln.js, 15 s), solange es eingeschaltet ist und das Bild
       da ist — sonst die kurze Aufruftafel „Jetzt kostenlos testen“ mit
       dealpilot.immo-QR (6 s). Nie zwei QR-Tafeln hintereinander.
     · nach dem 10. und 20. Video zusätzlich die Register-Tafel (14 s).
     · messe-schleife-7: nach jedem n-ten Video ein Werbebild (werbung.js,
       Menü „Werbung“); dann entfällt die kurze Aufruftafel.

   Woher die Videos kommen: landing/medien/videothek/<datei> — online die
   Videothek der App, offline (file://) derselbe Pfad im Ordner zum Mitnehmen.
   Liste: online videos.json, sonst videothek-liste.js (window.DPS_VIDEOTHEK).
   Fehlt eine Datei oder hängt sie: überspringen, nie stehen bleiben.

   Prüfhilfen: window.DPS, DPS_LOG (Wechsel mit Zeit), DPS_SCHWARZ (längste
   Strecke ohne Bild in ms), DPS_TAFELN (gemessene Tafeldauern in ms).
   &rate=4 (Videos schneller) · &tafelrate=5 (Tafeln schneller) ·
   &kurz=3 (nur die letzten 3 s je Video) · &start=12 · &fehlt=5 (Video 5
   mit falschem Dateinamen — Überspringen prüfen).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VER = 'messe-schleife-5c';
  var Q = new URLSearchParams(location.search);
  var RATE = Math.max(0.5, Math.min(16, parseFloat(Q.get('rate')) || 1));
  var TRATE = Math.max(0.2, Math.min(20, parseFloat(Q.get('tafelrate')) || 1));
  var KURZ = parseFloat(Q.get('kurz')) || 0;
  var FEHLT = parseInt(Q.get('fehlt'), 10) || 0;
  var DATEI = location.protocol === 'file:';
  var BASIS = 'landing/medien/videothek/';
  var URL_AUFRUF = 'https://dealpilot.immo';
  var REGISTER_NACH = 10;     /* Register-Tafel nach dem 10. und 20. Video (nicht nach dem letzten: dort folgt die Starttafel) */

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fehler(t) { (window.DPS_FEHLER = window.DPS_FEHLER || []).push(t); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  window.DPS_LOG = []; window.DPS_TAFELN = [];
  function log(was, x) { var l = window.DPS_LOG; l.push({ t: Math.round(performance.now()), was: was, x: x }); if (l.length > 600) l.shift(); }
  function logo(cls) { return '<div class="marke ' + (cls || '') + '">Deal<b>Pilot</b></div>'; }
  var FLIEGER = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 2c2 0 3 3 3 6v16l22 12v6l-22-6v12l7 5v4l-10-3-10 3v-4l7-5V36L7 42v-6l22-12V8c0-3 1-6 3-6z"/></svg>';
  function modulName(v) { var m = /^Ü(\d+)$/.exec(v.nr); return m ? 'Überblick ' + m[1] : 'Modul ' + v.nr; }

  /* ── Liste ── */
  async function ladeListe() {
    if (!DATEI) {
      try {
        var r = await fetch('landing/assets/videothek/videos.json', { cache: 'no-cache' });
        if (r.ok) {
          var j = await r.json();
          var kat = {}; (j.kategorien || []).forEach(function (k) { kat[k.id] = k.name; });
          var l = (j.videos || []).filter(function (v) { return v.datei; }).map(function (v) {
            return { id: v.id, nr: v.nr, kategorie: kat[v.kategorie] || v.kategorie, titel: v.titel, unterzeile: v.unterzeile, datei: v.datei, dauer: v.dauer };
          });
          if (l.length) { log('liste', 'videos.json ' + l.length); return l; }
        }
      } catch (e) { log('liste', 'videos.json nicht lesbar'); }
    }
    var d = window.DPS_VIDEOTHEK;
    log('liste', 'videothek-liste.js ' + (d && d.videos ? d.videos.length : 0));
    return d && d.videos ? d.videos.slice() : [];
  }

  /* ── Bühne ── */
  var V, B, kopf, rahmen, vids, tafelEl, spur, naechsterSprung = false;
  function baue(buehne) {
    B = el('div', 'rg vt ebene');
    kopf = el('div', 'rg-kopf leer',
      '<div class="rg-text"><div class="rg-kick"></div><h2 class="rg-titel"></h2><p class="rg-satz"></p></div>'
      + '<div class="rg-marke">' + logo() + '<div class="rg-url">dealpilot.immo</div></div>');
    spur = el('div', 'rg-spur');
    V.forEach(function (v) { var s = el('i', '', '<b></b>'); s.style.flexGrow = v.dauer || 200; s.title = v.titel; spur.appendChild(s); });
    rahmen = el('div', 'rg-rahmen');
    vids = [0, 1].map(function () {
      var v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      rahmen.appendChild(v); return v;
    });
    tafelEl = el('div', 'rg-tafel');
    B.appendChild(kopf); B.appendChild(spur); B.appendChild(rahmen); B.appendChild(tafelEl);
    buehne.appendChild(B);
  }
  function urlVon(i) { return BASIS + (FEHLT === i + 1 ? 'fehlt-' : '') + V[i].datei; }

  /* Ein Video vorbereiten: laden, bei &kurz an das Ende springen, warten bis
     das erste Bild dekodiert ist. Ergebnis: true oder null (überspringen). */
  function bereite(v, i) {
    return new Promise(function (fertig) {
      var url = urlVon(i), aus = false, mein = {}, hoerer = [];
      v._vt = mein;
      function an(t, f) { v.addEventListener(t, f); hoerer.push([t, f]); }
      function ende(ok) {
        if (aus) return; aus = true; clearTimeout(uhr);
        hoerer.forEach(function (h) { v.removeEventListener(h[0], h[1]); });
        fertig(v._vt === mein && ok ? true : null);
      }
      var uhr = setTimeout(function () { fehler('Videothek: Zeitueberschreitung ' + url); log('zeit', url); ende(false); }, 15000);
      an('error', function () { fehler('Videothek: Ladefehler ' + url); log('fehlt', url); ende(false); });
      an('loadedmetadata', function () {
        var ziel = KURZ && isFinite(v.duration) ? Math.max(0, v.duration - KURZ) : 0;
        if (ziel > 0.05) { an('seeked', function () { if (v.readyState >= 2) ende(true); else an('loadeddata', function () { ende(true); }); }); v.currentTime = ziel; }
        else if (v.readyState >= 2) ende(true);
        else an('loadeddata', function () { ende(true); });
      });
      v.pause();
      v.setAttribute('src', url);
      v.load();
    });
  }

  function setzeKopf(i) {
    var v = V[i];
    kopf.classList.remove('neu'); void kopf.offsetWidth;
    kopf.querySelector('.rg-kick').innerHTML = 'Videothek · Video <b>' + String(i + 1).padStart(2, '0') + '</b> / ' + V.length + ' · ' + esc(v.kategorie || '');
    kopf.querySelector('.rg-titel').textContent = modulName(v) + ' · ' + v.titel;
    kopf.querySelector('.rg-satz').textContent = v.unterzeile || '';
    kopf.classList.add('neu'); kopf.classList.remove('leer');
    Array.prototype.forEach.call(spur.children, function (s, k) {
      s.classList.toggle('fertig', k < i); s.classList.toggle('jetzt', k === i);
      if (k !== i) s.firstChild.style.width = k < i ? '100%' : '0%';
    });
  }

  /* ── Tafeln ── */
  function weiterZeile(i) { return i == null ? '' : 'Als Nächstes · <b>' + esc(modulName(V[i]) + ' · ' + V[i].titel) + '</b>'; }
  function startHtml() {
    return '<div class="rg-t rg-t-marke"><div class="rg-bahn"><span class="rg-flieger">' + FLIEGER + '</span></div>'
      + logo('rg-logo-gross') + '<div class="rg-claim">Die <em>Videothek</em> am Stück.</div>'
      + '<div class="rg-unter">' + V.length + ' Videos · jedes Modul der App</div></div>';
  }
  function aufrufHtml(i) {
    var qr = '';
    try { if (window.DpQr && window.DpQr.svg) qr = '<div class="rg-qr">' + window.DpQr.svg(URL_AUFRUF, { ecc: 'M', border: 2, dark: '#050505', light: '#FDFCFA' }) + '<span>Scannen und loslegen</span></div>'; } catch (e) { qr = ''; }
    return '<div class="rg-t rg-t-aufruf' + (qr ? '' : ' ohne-qr') + '"><div class="rg-aufruf-text">' + logo('rg-logo-mittel')
      + '<div class="rg-aufruf-titel">Jetzt kostenlos testen</div><div class="rg-aufruf-url gold">dealpilot.immo</div>'
      + '<div class="rg-unter">Immobilien prüfen wie ein Pilot.</div></div>' + qr
      + '<div class="rg-weiter">' + weiterZeile(i) + '</div></div>';
  }
  var tafelOffen = false;
  async function tafel(art, html, sek) {
    tafelEl.innerHTML = html; void tafelEl.offsetWidth;
    tafelEl.classList.add('an'); tafelOffen = true; kopf.classList.add('leer');
    var t0 = performance.now();
    log('tafel', art);
    window.DPS = { idee: 'videothek', version: VER, art: 'tafel', tafel: art, runde: runde, zeit: Date.now() };
    setTimeout(function () { if (tafelOffen) vids.forEach(function (v) { v.pause(); v.classList.remove('an'); }); }, 900);
    var ende = t0 + sek * 1000 / TRATE;
    while (performance.now() < ende && !naechsterSprung) await warte(100);
    naechsterSprung = false;
    var ms = Math.round(performance.now() - t0);
    window.DPS_TAFELN.push({ art: art, ms: ms }); if (window.DPS_TAFELN.length > 200) window.DPS_TAFELN.shift();
    log('tafel-ende', art + ' ' + ms);
  }
  function schliesseTafel() { if (!tafelOffen) return; tafelOffen = false; tafelEl.classList.remove('an'); }

  /* ── Ablauf ── */
  var aktiv = null, vorbereitet = null, runde = 1;
  function frei() { return vids[0] === aktiv ? vids[1] : vids[0]; }
  function vorbereiten(i) { var v = frei(); vorbereitet = { i: i, v: v, p: bereite(v, i) }; log('vor', V[i].datei); }

  async function spiele(i) {
    var vb = vorbereitet && vorbereitet.i === i ? vorbereitet : (vorbereiten(i), vorbereitet);
    vorbereitet = null;
    var ok = await vb.p;
    if (!ok) { fehler('Videothek: uebersprungen ' + V[i].datei); log('skip', V[i].datei); return false; }
    var v = vb.v, alt = aktiv;
    v.playbackRate = RATE;
    var p = v.play(); if (p && p.catch) p.catch(function (e) { fehler('Videothek: play ' + (e && e.message)); });
    await Promise.race([new Promise(function (r) { v.addEventListener('playing', r, { once: true }); }), warte(1500)]);
    setzeKopf(i);
    v.classList.add('an'); aktiv = v;
    if (alt && alt !== v) alt.classList.remove('an');
    schliesseTafel();
    log('start', V[i].datei + ' ' + v.currentTime.toFixed(1) + '/' + (isFinite(v.duration) ? v.duration.toFixed(1) : '?'));
    window.DPS = { idee: 'videothek', version: VER, art: 'video', video: i + 1, von: V.length, datei: V[i].datei, runde: runde, zeit: Date.now() };
    setTimeout(function () {
      if (alt && alt !== v) { alt.pause(); alt.removeAttribute('src'); try { alt.load(); } catch (e) { /* leer */ } }
      if (aktiv === v && !vorbereitet) vorbereiten((i + 1) % V.length);
    }, 2500);
    var balken = spur.children[i].firstChild;
    var letzt = v.currentTime, seit = performance.now();
    await new Promise(function (fertig) {
      (function schau() {
        if (naechsterSprung) { naechsterSprung = false; fertig(); return; }
        var t = v.currentTime, jetzt = performance.now();
        if (t !== letzt) { letzt = t; seit = jetzt; }
        else if (jetzt - seit > 8000) { fehler('Videothek: stockt ' + V[i].datei); log('stockt', V[i].datei); fertig(); return; }
        if (v.paused && !v.ended && jetzt - seit > 800) { var pp = v.play(); if (pp && pp.catch) pp.catch(function () {}); }
        if (isFinite(v.duration) && v.duration > 0) balken.style.width = Math.min(100, 100 * t / v.duration) + '%';
        if (v.ended || (isFinite(v.duration) && t >= v.duration - 0.05)) { fertig(); return; }
        requestAnimationFrame(schau);
      })();
    });
    log('ende', V[i].datei);
    return true;
  }

  async function lauf(start) {
    var T = window.DPSTafeln;
    var i = start;
    vorbereiten(i);
    await tafel('start', startHtml(), 6);
    for (;;) {
      var ok = await spiele(i);
      var n = (i + 1) % V.length;
      if (ok) {
        /* messe-schleife-6 · Abstaende und Schalter aus dem Menue (einstellungen.js) */
        var regNach = T && T.register.nach ? T.register.nach() : REGISTER_NACH, regDa = false;
        if ((i + 1) % regNach === 0 && i + 1 < V.length && T && T.register.da()) { regDa = true; await tafel('register', T.register.html(null), T.register.sekunden); }
        if (!regDa && T && T.app && T.app.da() && (i + 1) % T.app.nach() === 0 && i + 1 < V.length) { var sa = T.app.sekunden(); await tafel('app', T.app.html(null, sa / TRATE), sa);
          if (T.amtlich && T.amtlich.da()) await tafel('amtlich', T.amtlich.html(null, sa / TRATE), sa); }   /* v2941 */
        /* messe-schleife-7 · Werbebild nach jedem n-ten Video (werbung.js); ersetzt dann die kurze Aufruftafel */
        var wbDa = false;
        if (T && T.werbung && T.werbung.da() && (i + 1) % T.werbung.nach() === 0 && i + 1 < V.length) { var wh = T.werbung.html(); if (wh) { wbDa = true; await tafel('werbung', wh, T.werbung.sekunden()); } }
        if (T && T.gewinnspiel.aktiv()) { var s = T.gewinnspiel.sekunden(); await tafel('gewinnspiel', T.gewinnspiel.html(n === 0 ? null : weiterZeile(n), s / TRATE), s); }
        else if (n !== 0 && !wbDa && !(T && T.aufruf && !T.aufruf.an())) await tafel('aufruf', aufrufHtml(n), 6);
      }
      if (n === 0) {
        runde++; log('runde', runde);
        Array.prototype.forEach.call(spur.children, function (x) { x.classList.remove('fertig', 'jetzt'); x.firstChild.style.width = '0%'; });
        if (!vorbereitet) vorbereiten(0);
        await tafel('start', startHtml(), 6);
      }
      i = n;
    }
  }

  function schwarzMesser() {
    window.DPS_SCHWARZ = 0; var ab = null, gesehen = false;
    (function m() {
      var ok = tafelOffen || (aktiv && aktiv.classList.contains('an') && aktiv.readyState >= 2);
      var t = performance.now();
      if (ok) { gesehen = true; if (ab !== null) { window.DPS_SCHWARZ = Math.max(window.DPS_SCHWARZ, Math.round(t - ab)); ab = null; } }
      else if (gesehen && ab === null) ab = t;
      requestAnimationFrame(m);
    })();
  }

  async function start(buehne) {
    V = await ladeListe();
    if (!V.length) { fehler('Videothek: keine Liste'); buehne.appendChild(el('div', 'fuss', 'Videothek: keine Videoliste gefunden')); return; }
    baue(buehne);
    schwarzMesser();
    addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') naechsterSprung = true;
      else if (e.key === 'f' || e.key === 'F') {
        var d = document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        else if (d.requestFullscreen) d.requestFullscreen().catch(function () {});
      }
    });
    var s = Math.max(1, Math.min(V.length, parseInt(Q.get('start'), 10) || 1)) - 1;
    lauf(s).catch(function (e) { fehler('Videothek: ' + (e && e.message)); });
  }

  window.DealPilotVideothek = { start: start, version: VER, liste: function () { return V; } };
})();
