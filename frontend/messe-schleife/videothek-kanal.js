/* ═══════════════════════════════════════════════════════════════════════
   videothek-kanal.js · messe-schleife-8 — Kanal „Videothek" (Taste V), mit Kapitelleiste
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
  var VER = 'messe-schleife-8a';
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
            return { id: v.id, nr: v.nr, kategorie: kat[v.kategorie] || v.kategorie, titel: v.titel, unterzeile: v.unterzeile, datei: v.datei, dauer: v.dauer,
              kapitel: (v.kapitel || []).filter(function (c) { return c && typeof c.t === 'number' && isFinite(c.t); }).map(function (c) { return { t: c.t, titel: c.titel }; }) };
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
    baueKap();   /* messe-schleife-8 */
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
    tafelEl.classList.add('an'); tafelOffen = true; kopf.classList.add('leer'); kapAus();
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

  /* ── messe-schleife-8 · Kapitelleiste im laufenden Video ──────────────────
     Marcel 28.10.2026: „das in der Messe-Schleife-Seite auch machen können bei
     den Videos" (die Kapitelmarken der Landing-Videothek). Bei Maus- oder
     Touch-Bewegung blendet unten im Bild eine Leiste ein (wie die Umschalt-
     Leiste, weg nach 4 s): Zeitleiste mit einer Marke je Kapitel, beim
     Überfahren/Ziehen Titel und Zeit, Tipp springt (nahe an einer Marke rastet
     er auf das Kapitel ein). Knöpfe ‹ / ❚❚ / › mit 72 px Tippfläche auf der
     1920er-Bühne. Tasten: ← / → Kapitel zurück/vor (→ im letzten Kapitel und
     auf einer Tafel: weiter wie bisher), Leertaste Pause/Weiter, N nächstes Video.
     Die Schleife läuft nach dem Springen normal weiter; eine Pause hält höchstens
     PAUSE_MAX, dann geht es von selbst weiter — der Stand bleibt nie stehen.
     Der Wächter (stockt / Neustart) schläft, solange angehalten ist.
     Menü (Taste E) „Kapitelleiste im Video“ schaltet sie ab. */
  var PAUSE_MAX = 180000;
  /* Nach einem Sprung muss das Video an der neuen Stelle erst puffern - online über eine langsame
     Leitung gemessen über 8 s (Staging, 240 KB/s). Der Wächter wartet dann bis 30 s statt 8 s,
     sonst überspränge er das Video, an das gerade jemand gesprungen ist. */
  var SPRUNG_GEDULD = 30000, sprungAm = -1e9;
  var K = null, kapI = -1, kapNr = -2, angehalten = false, pauseUhr = null, kapUhr = null, kapBereit = 0, kapZieht = false, kapUeber = false;
  function kapErlaubt() { return !(window.DPS_EINST && window.DPS_EINST.get('kapitel') === false); }
  function kapListe() { var v = V && V[kapI]; return v && v.kapitel ? v.kapitel : []; }
  function kapDauer() { return aktiv && isFinite(aktiv.duration) && aktiv.duration > 0 ? aktiv.duration : ((V[kapI] || {}).dauer || 0); }
  function mmss(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function kapAn(t) { var a = -1; kapListe().forEach(function (c, j) { if (c.t <= t + 0.25) a = j; }); return a; }
  function q(s) { return K.querySelector(s); }
  function baueKap() {
    K = el('div', 'vk',
      '<div class="vk-zeile">'
      + '<button type="button" class="vk-k" data-a="zur" aria-label="Voriges Kapitel"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 5 8 12 15 19"/></svg></button>'
      + '<button type="button" class="vk-k vk-pp" data-a="pp" aria-label="Pause oder weiter"><i></i></button>'
      + '<button type="button" class="vk-k" data-a="vor" aria-label="Nächstes Kapitel"><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button>'
      + '<div class="vk-text"><div class="vk-kick"></div><div class="vk-titel"></div></div>'
      + '<div class="vk-rechts"><div class="vk-zeit"></div><div class="vk-naechst"></div></div></div>'
      + '<div class="vk-bahn"><div class="vk-spur"><i class="vk-fill"></i><div class="vk-marken"></div><i class="vk-kopf"></i></div></div>'
      + '<div class="vk-tip" hidden><b></b><span></span></div>'   /* über der Leiste, damit er den Kapiteltitel nicht verdeckt */
      + '<div class="vk-hilfe">Tippen springt · ← → Kapitel · Leertaste Pause · N nächstes Video</div>');
    B.appendChild(K);
    K.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') kapUeber = true; });
    K.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { kapUeber = false; if (!kapZieht) tipZeig(null); } });
    K.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b || performance.now() < kapBereit) return;
      var a = b.getAttribute('data-a');
      if (a === 'pp') pausieren(); else kapSchritt(a === 'vor' ? 1 : -1);
    });
    var bahn = q('.vk-bahn');
    bahn.addEventListener('pointerdown', function (e) {
      if (performance.now() < kapBereit || !kapDauer()) return;
      kapZieht = true; try { bahn.setPointerCapture(e.pointerId); } catch (x) { /* leer */ }
      tipZeig(bahnZeit(e.clientX)); kapZeig();
    });
    bahn.addEventListener('pointermove', function (e) { if (kapZieht || e.pointerType === 'mouse') tipZeig(bahnZeit(e.clientX)); });
    bahn.addEventListener('pointerup', function (e) {
      if (!kapZieht) return; kapZieht = false;
      var z = bahnZeit(e.clientX); if (z) springe(z.t, 'leiste');
      setTimeout(function () { if (!kapZieht && !kapUeber) tipZeig(null); }, 1400);
    });
    bahn.addEventListener('pointercancel', function () { kapZieht = false; tipZeig(null); });
  }
  /* Position -> Zeit. Die Bühne ist skaliert: gerechnet wird im Verhältnis zur gemessenen Breite. */
  function bahnZeit(x) {
    var s = q('.vk-spur'), r = s.getBoundingClientRect(), d = kapDauer(); if (!d || !r.width) return null;
    var f = Math.max(0, Math.min(1, (x - r.left) / r.width)), best = -1, bd = 0.018;   /* ≈ 30 px der Bühne */
    kapListe().forEach(function (c, j) { var dx = Math.abs(c.t / d - f); if (dx <= bd) { bd = dx; best = j; } });
    var t = best >= 0 ? kapListe()[best].t : f * d;
    return { t: t, j: best >= 0 ? best : kapAn(t), rastet: best >= 0, f: best >= 0 ? t / d : f };
  }
  function tipZeig(z) {
    var tip = q('.vk-tip');
    if (!z) { tip.hidden = true; return; }
    var c = kapListe()[z.j];
    tip.querySelector('b').textContent = mmss(z.t);
    tip.querySelector('span').textContent = c ? c.titel : '';
    tip.hidden = false;
    var bahn = q('.vk-bahn'), sp = q('.vk-spur'), w = tip.offsetWidth, x = bahn.offsetLeft + sp.offsetLeft + z.f * sp.offsetWidth;
    tip.style.left = Math.max(0, Math.min(K.offsetWidth - w, x - w / 2)) + 'px';
  }
  function kapNeu(i) {
    kapI = i; kapNr = -2; angehalten = false; clearTimeout(pauseUhr);
    if (!K) return;
    K.classList.remove('pause');
    var d = kapDauer(), k = kapListe();
    q('.vk-marken').innerHTML = d ? k.filter(function (c) { return c.t > 0.5 && c.t < d; }).map(function (c) {
      return '<i style="left:' + (c.t / d * 100).toFixed(3) + '%" data-t="' + c.t + '"></i>';
    }).join('') : '';
    K.classList.toggle('ohne-kapitel', !k.length);
    kapStand(0);
  }
  function kapStand(t) {
    if (!K || kapI < 0) return;
    var d = kapDauer(), p = d ? Math.min(100, 100 * t / d) : 0;
    if (!K.classList.contains('an') && kapNr !== -2) return;   /* versteckt: nur beim Wechsel rechnen */
    q('.vk-fill').style.width = p + '%'; q('.vk-kopf').style.left = p + '%';
    q('.vk-zeit').textContent = mmss(t) + ' / ' + mmss(d);
    var j = kapAn(t), k = kapListe();
    if (j === kapNr) return;
    kapNr = j;
    q('.vk-kick').textContent = k.length ? 'Kapitel ' + (j + 1) + ' / ' + k.length : modulName(V[kapI]);
    q('.vk-titel').textContent = k.length && j >= 0 ? k[j].titel : V[kapI].titel;
    q('.vk-naechst').innerHTML = k[j + 1] ? 'Als Nächstes · <b>' + esc(k[j + 1].titel) + '</b>' : (V.length > 1 ? 'Danach · <b>nächstes Video</b>' : '');
    Array.prototype.forEach.call(q('.vk-marken').children, function (m) { m.classList.toggle('vorbei', +m.getAttribute('data-t') <= t + 0.25); });
    window.DPS_KAPITEL = { video: kapI + 1, kapitel: j + 1, von: k.length, titel: k[j] ? k[j].titel : '', angehalten: angehalten };
  }
  function kapZeig() {
    if (!K || tafelOffen || kapI < 0 || !aktiv || !kapErlaubt()) return;
    if (!K.classList.contains('an')) { kapBereit = performance.now() + 350; K.classList.add('an'); kapNr = -3; kapStand(aktiv.currentTime); }
    clearTimeout(kapUhr); kapUhr = setTimeout(kapWeg, 4000);
  }
  function kapWeg() {
    if (angehalten || kapZieht || kapUeber) { kapUhr = setTimeout(kapWeg, 1000); return; }
    if (K) { K.classList.remove('an'); tipZeig(null); }
  }
  function kapAus() { clearTimeout(kapUhr); if (K) { K.classList.remove('an'); tipZeig(null); } }
  function springe(t, wie) {
    var v = aktiv; if (!v || tafelOffen) return;
    var d = kapDauer(); t = Math.max(0, Math.min(t, d ? d - 0.3 : t));
    try { v.currentTime = t; } catch (e) { /* leer */ }
    sprungAm = performance.now();
    log('sprung', wie + ' ' + V[kapI].datei + ' ' + t.toFixed(1));
    kapNr = -3; kapStand(t); kapZeig();
  }
  function kapSchritt(r) {
    if (!aktiv || tafelOffen) { if (r > 0) naechsterSprung = true; return; }
    var k = kapListe(), t = aktiv.currentTime, ziel = null;
    if (r > 0) {
      k.forEach(function (c) { if (ziel == null && c.t > t + 0.5) ziel = c.t; });
      if (ziel == null) { log('sprung', 'naechstes video'); naechsterSprung = true; return; }
    } else {
      /* zurück: in den ersten 3 s eines Kapitels aufs vorige, sonst an den Anfang des laufenden */
      k.forEach(function (c) { if (c.t < t - 3) ziel = c.t; });
      if (ziel == null) ziel = 0;
    }
    springe(ziel, r > 0 ? 'vor' : 'zurueck');
  }
  function pausieren() {
    if (!aktiv || tafelOffen) return;
    angehalten = !angehalten; clearTimeout(pauseUhr);
    if (angehalten) { aktiv.pause(); pauseUhr = setTimeout(function () { if (angehalten) { log('pause', 'von selbst weiter'); pausieren(); } }, PAUSE_MAX); }
    else { var p = aktiv.play(); if (p && p.catch) p.catch(function () {}); }
    log('pause', angehalten ? 'an' : 'aus');
    K.classList.toggle('pause', angehalten);
    if (window.DPS_KAPITEL) window.DPS_KAPITEL.angehalten = angehalten;
    kapZeig();
  }

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
    kapNeu(i);   /* messe-schleife-8 */
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
        kapStand(t);
        /* messe-schleife-8 · angehalten: kein "stockt", kein Neustart - nur warten */
        if (angehalten) { letzt = t; seit = jetzt; if (isFinite(v.duration) && v.duration > 0) balken.style.width = Math.min(100, 100 * t / v.duration) + '%'; requestAnimationFrame(schau); return; }
        if (t !== letzt) { letzt = t; seit = jetzt; }
        else if (jetzt - seit > (jetzt - sprungAm < SPRUNG_GEDULD ? SPRUNG_GEDULD : 8000)) { fehler('Videothek: stockt ' + V[i].datei); log('stockt', V[i].datei); fertig(); return; }
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
      /* messe-schleife-8 · ← / → Kapitel, Leertaste Pause; N bleibt "nächstes Video" */
      if (e.key === 'ArrowRight') { e.preventDefault(); kapSchritt(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); kapSchritt(-1); }
      else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); pausieren(); }
      else if (e.key === 'n' || e.key === 'N') naechsterSprung = true;
      else if (e.key === 'f' || e.key === 'F') {
        var d = document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        else if (d.requestFullscreen) d.requestFullscreen().catch(function () {});
      }
    });
    /* Maus bewegen oder antippen blendet die Kapitelleiste ein */
    addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') kapZeig(); });
    addEventListener('pointerdown', kapZeig, true);
    addEventListener('dps:einstellungen', function (e) { if (e.detail && e.detail.k === 'kapitel' && !e.detail.v) kapAus(); });
    var s = Math.max(1, Math.min(V.length, parseInt(Q.get('start'), 10) || 1)) - 1;
    lauf(s).catch(function (e) { fehler('Videothek: ' + (e && e.message)); });
  }

  window.DealPilotVideothek = { start: start, version: VER, liste: function () { return V; } };
})();
