/* ═══════════════════════════════════════════════════════════════════════
   rundgang.js · messe-schleife-4 — „Rundgang“: die App in echten Aufnahmen
   Marcel 21.10.2026: „Teile unserer jetzigen Videothek einbauen … quasi ein
   Rundgang mit allem als Schleife“. Startansicht der Messe-Schleife.

   Quelle der Bilder: die stummen Fassungen der Videothek
   (frontend/landing/assets/videothek/videos.json, Feld „datei“). Je Station
   ein oder zwei Ausschnitte [von, bis] in Sekunden — am Standbild geprüft
   (ffmpeg, 21.10.2026), dass dort die App zu sehen ist.

   Woher die Videos kommen:
     online  (http/https)  landing/medien/videothek/<datei>  — volle Videos,
                           Sprung per currentTime, Ende per Zeitmarke
     offline (file://)     messe-schleife/clips/rundgang/rg-<id>-<n>.mp4 —
                           genau dieser Ausschnitt, mit ffmpeg geschnitten
     ?quelle=clips | ?quelle=videothek erzwingt eine Quelle.
   Fehlt ein Video online, wird der geschnittene Clip versucht; fehlt auch
   der, wird der Ausschnitt übersprungen (nie hängen).

   Keine Abrufe von JSON (file:// kann das nicht) — die Liste steht hier.
   Prüfhilfen: window.DPS (Zustand), window.DPS_LOG (Wechsel mit Zeit),
   window.DPS_SCHWARZ (längste Strecke ohne Bild in ms), &rate=4 (schneller).
   messe-schleife-7: nach jeder n-ten Station ein Werbebild (werbung.js,
   Menü „Werbung“), Favoriten 01/03 doppelt so oft.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VER = 'messe-schleife-5';
  var Q = new URLSearchParams(location.search);
  var RATE = Math.max(0.5, Math.min(8, parseFloat(Q.get('rate')) || 1));
  var DATEI = location.protocol === 'file:';
  var QUELLE = Q.get('quelle') === 'clips' || Q.get('quelle') === 'videothek' ? Q.get('quelle') : (DATEI ? 'clips' : 'videothek');
  var BASIS_VIDEOTHEK = 'landing/medien/videothek/';
  var BASIS_CLIPS = 'messe-schleife/clips/rundgang/';
  var URL_AUFRUF = 'https://dealpilot.immo';

  /* ── Die Stationen. Reihenfolge = Weg eines Objekts durch die App:
        erfassen → bewerten → finanzieren/Steuer → wachsen.
        modul/datei aus videos.json; teile in Sekunden der stummen Fassung. ── */
  var M = {
    'Ü1': 'dealpilot-ueberblick-1-quick-boarding.mp4',
    '03': 'dealpilot-modul-03-datenaufnahme-vier-wege.mp4',
    '08': 'dealpilot-modul-08-finanzierung.mp4',
    '11': 'dealpilot-modul-11-pilot-analyse.mp4',
    '12': 'dealpilot-modul-12-bewertung-und-kpis.mp4',
    '18': 'dealpilot-modul-18-der-marktbericht.mp4',
    '19': 'dealpilot-modul-19-das-bank-pdf.mp4',
    '21': 'dealpilot-modul-21-portfolio-cockpit-und-pilot.mp4',
    '22': 'dealpilot-modul-22-telegram-bot.mp4',
    '26': 'dealpilot-modul-26-mieterhoehung-und-zielbild.mp4',
    '27': 'dealpilot-modul-27-steuerverlauf-mit-wendepunkt.mp4'
  };
  var BLOECKE = { erfassen: 'Erfassen', bewerten: 'Bewerten', finanzieren: 'Finanzieren & Steuern', wachsen: 'Wachsen' };
  var ABSCHNITTE = [
    { id: 'quickcheck', block: 'erfassen', modul: 'Ü1', kapitel: 'Quick-Check',
      satz: 'Vom Exposé zum ersten Urteil — Marktwert, Spanne und Score in Minuten.', teile: [[89, 127]] },
    { id: 'immometrica', block: 'erfassen', modul: '03', kapitel: 'ImmoMetrica-Import',
      satz: 'Ein Inserat aus der gespeicherten Suche — Ort, Fläche, Baujahr und Preis gehen ins Objekt.', teile: [[110, 138]] },
    { id: 'mfh', block: 'erfassen', modul: '26', kapitel: 'Mehrfamilienhaus · Wohnungen',
      satz: 'Sechs Wohnungen in einer Liste — Fläche, Miete, Status und Details je Einheit.', teile: [[95, 125]] },
    { id: 'marktbericht', block: 'bewerten', modul: '18', kapitel: 'Marktbericht',
      satz: 'Score, Marktwert-Indikation mit Spanne und die Lage auf der Karte.', teile: [[43, 73]] },
    { id: 'score', block: 'bewerten', modul: '12', kapitel: 'DealScore',
      satz: 'Fünf Teilnoten, ein Urteil — 78 von 100, Gut.', teile: [[123, 147]] },
    { id: 'pilot', block: 'bewerten', modul: '11', kapitel: 'Pilot-Analyse',
      satz: 'Der Co-Pilot urteilt in ganzen Sätzen — bis zur begründeten Kaufpreis-Offerte.', teile: [[53, 62], [161, 181]] },
    { id: 'finanzierung', block: 'finanzieren', modul: '08', kapitel: 'Finanzierung',
      satz: 'Der Zins nach Beleihung — mit Marktdaten und Zinsverlauf dahinter.', teile: [[30, 41], [80, 96]] },
    { id: 'bank', block: 'finanzieren', modul: '19', kapitel: 'Bank-PDF',
      satz: 'Der Investment Case für die Bank — in deiner Marke, mit allen Kennzahlen.', teile: [[68, 79], [102, 116]] },
    { id: 'steuer', block: 'finanzieren', modul: '27', kapitel: 'Steuerverlauf',
      satz: 'Das Ergebnis aus Vermietung Jahr für Jahr — und der Wendepunkt 2027.', teile: [[72, 98]] },
    { id: 'zielbild', block: 'wachsen', modul: '26', kapitel: 'Mieterhöhung · Zielbild',
      satz: 'Bestand, Mieterhöhung, Zielbild — das Wertpotenzial des Hauses als PDF.', teile: [[860, 889]] },
    { id: 'portfolio', block: 'wachsen', modul: '21', kapitel: 'Portfolio-Cockpit',
      satz: 'Alle Objekte, ein Portfolio-Score — Kennzahlen und Steuer über den ganzen Bestand.', teile: [[22, 46], [64, 73]] },
    { id: 'telegram', block: 'wachsen', modul: '22', kapitel: 'Telegram-Bot',
      satz: 'Dein Portfolio im Chat — fragen, vergleichen, Soll gegen Ist.', teile: [[27, 55]] }
  ];
  /* Tafeln zwischen den Blöcken (Sekunden). */
  var TAFELN = {
    start:     { art: 'marke', dauer: 6, weiter: 'erfassen' },
    bewerten:  { art: 'zwischen', dauer: 5, zeile: 'Erst rechnen, dann boarden.', weiter: 'bewerten' },
    aufruf1:   { art: 'aufruf', dauer: 8, weiter: 'finanzieren' },
    wachsen:   { art: 'zwischen', dauer: 5, zeile: 'Immobilien prüfen wie ein Pilot.', weiter: 'wachsen' },
    aufruf2:   { art: 'aufruf', dauer: 9 },
    /* messe-schleife-5: Register-Tafel und Gewinnspiel (tafeln.js); fehlt die
       Grundlage oder ist das Gewinnspiel aus, entfällt die Tafel. */
    register:  { art: 'register', dauer: 14 },
    gewinn1:   { art: 'gewinnspiel', dauer: 15 },
    gewinn2:   { art: 'gewinnspiel', dauer: 15 },
    /* v2937 · DealPilot in Zahlen (tafeln.js, Daten aus app-zahlen.js) */
    app:       { art: 'app', dauer: 16 },
    amtlich:   { art: 'amtlich', dauer: 16 }   /* v2941 */
  };
  var FOLGE = ['T:start', 'quickcheck', 'immometrica', 'T:gewinn1', 'mfh', 'T:bewerten', 'marktbericht', 'T:register', 'score', 'pilot',
    'T:aufruf1', 'finanzierung', 'bank', 'T:gewinn2', 'steuer', 'T:wachsen', 'zielbild', 'portfolio', 'T:app', 'T:amtlich', 'telegram', 'T:aufruf2'];

  /* Schritte: Tafel oder ein Ausschnitt (Stück) eines Abschnitts. */
  var SCHRITTE = [];
  FOLGE.forEach(function (k) {
    if (k.indexOf('T:') === 0) { var t = TAFELN[k.slice(2)]; SCHRITTE.push({ typ: 'tafel', id: k.slice(2), t: t }); return; }
    var a = ABSCHNITTE.filter(function (x) { return x.id === k; })[0];
    a.nr = ABSCHNITTE.indexOf(a) + 1;
    a.dauer = a.teile.reduce(function (s, p) { return s + p[1] - p[0]; }, 0);
    var schon = 0;
    a.teile.forEach(function (p, n) {
      SCHRITTE.push({ typ: 'stueck', a: a, n: n + 1, erstes: n === 0, offset: schon, datei: M[a.modul], von: p[0], bis: p[1],
        clip: 'rg-' + a.id + '-' + (n + 1) });
      schon += p[1] - p[0];
    });
  });
  var RUNDE_S = SCHRITTE.reduce(function (s, x) { return s + (x.typ === 'tafel' ? x.t.dauer : x.bis - x.von); }, 0);

  /* ── Werkzeuge ── */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fehler(t) { (window.DPS_FEHLER = window.DPS_FEHLER || []).push(t); }
  window.DPS_LOG = [];
  function log(was, x) { var l = window.DPS_LOG; l.push({ t: Math.round(performance.now()), was: was, x: x }); if (l.length > 400) l.shift(); }
  function quelleVon(s, art) {
    if (art === 'clips') return { url: BASIS_CLIPS + s.clip + '.mp4?v=' + VER, von: 0, bis: s.bis - s.von, art: 'clips' };
    return { url: BASIS_VIDEOTHEK + s.datei, von: s.von, bis: s.bis, art: 'videothek' };
  }
  var FLIEGER = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 2c2 0 3 3 3 6v16l22 12v6l-22-6v12l7 5v4l-10-3-10 3v-4l7-5V36L7 42v-6l22-12V8c0-3 1-6 3-6z"/></svg>';
  function logo(cls) { return '<div class="marke ' + (cls || '') + '">Deal<b>Pilot</b></div>'; }

  /* ── Bühne ── */
  var B, kopf, rahmen, vids, tafelEl, spur, abbruch = false, naechsterSprung = false;
  function baue(buehne) {
    B = el('div', 'rg ebene');
    kopf = el('div', 'rg-kopf',
      '<div class="rg-text"><div class="rg-kick"></div><h2 class="rg-titel"></h2><p class="rg-satz"></p></div>'
      + '<div class="rg-marke">' + logo() + '<div class="rg-url">dealpilot.immo</div></div>');
    spur = el('div', 'rg-spur');
    ABSCHNITTE.forEach(function (a) { var s = el('i', '', '<b></b>'); s.style.flexGrow = a.dauer; s.title = a.kapitel; spur.appendChild(s); });
    rahmen = el('div', 'rg-rahmen');
    vids = [0, 1].map(function () {
      var v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.playbackRate = RATE;
      rahmen.appendChild(v); return v;
    });
    tafelEl = el('div', 'rg-tafel');
    B.appendChild(kopf); B.appendChild(spur); B.appendChild(rahmen); B.appendChild(tafelEl);
    buehne.appendChild(B);
  }

  /* ── Ein Video auf einen Ausschnitt vorbereiten: Quelle setzen, an den
        Anfang springen, warten, bis das erste Bild dekodiert ist. ── */
  function bereite(v, s) {
    return new Promise(function (fertig) {
      var versuche = [QUELLE];
      if (QUELLE === 'videothek') versuche.push('clips');
      var aus = false, uhr = null, mein = {};
      v._rg = mein;
      function fremd() { if (v._rg === mein) return false; aus = true; clearTimeout(uhr); weg(); return true; }
      function ende(ok, q) { if (aus || fremd()) return; aus = true; clearTimeout(uhr); weg(); fertig(ok ? q : null); }
      var hoerer = [];
      function an(typ, f) { v.addEventListener(typ, f); hoerer.push([typ, f]); }
      function weg() { hoerer.forEach(function (h) { v.removeEventListener(h[0], h[1]); }); hoerer = []; }
      function versuch() {
        if (aus || fremd()) return;
        weg();
        var art = versuche.shift();
        if (!art) { ende(false); return; }
        var q = quelleVon(s, art);
        clearTimeout(uhr);
        uhr = setTimeout(function () { fehler('Rundgang: Zeitueberschreitung ' + q.url); log('zeit', q.url); versuch(); }, 12000);
        function springe() {
          var dauer = isFinite(v.duration) ? v.duration : Infinity;
          q.bis = Math.min(q.bis, dauer - 0.06);
          if (Math.abs(v.currentTime - q.von) < 0.03 && v.readyState >= 2) { ende(true, q); return; }
          an('seeked', function f() { if (v.readyState >= 2) ende(true, q); else an('loadeddata', function () { ende(true, q); }); });
          try { v.currentTime = q.von; } catch (e) { versuch(); }
        }
        an('error', function () { fehler('Rundgang: Ladefehler ' + q.url); log('fehlt', q.url); versuch(); });
        var gleich = v.getAttribute('src') === q.url && !v.error;
        v.pause();
        if (gleich && v.readyState >= 1) { springe(); return; }
        an('loadedmetadata', springe);
        v.setAttribute('src', q.url);
        v.load();
      }
      versuch();
    });
  }

  /* ── Kopf: Kapitel und Satz, mit sanftem Einblenden ── */
  function setzeKopf(a) {
    var k = kopf;
    k.classList.remove('neu'); void k.offsetWidth;
    k.querySelector('.rg-kick').innerHTML = 'Station <b>' + String(a.nr).padStart(2, '0') + '</b> / ' + ABSCHNITTE.length + ' · ' + BLOECKE[a.block];
    k.querySelector('.rg-titel').textContent = a.kapitel;
    k.querySelector('.rg-satz').textContent = a.satz;
    k.classList.add('neu');
    kopf.classList.remove('leer');
    Array.prototype.forEach.call(spur.children, function (s, i) { s.classList.toggle('fertig', i < a.nr - 1); s.classList.toggle('jetzt', i === a.nr - 1); if (i !== a.nr - 1) s.firstChild.style.width = i < a.nr - 1 ? '100%' : '0%'; });
  }

  /* ── Tafeln ── */
  function tafelHtml(t) {
    var T = window.DPSTafeln;
    if (t.art === 'register') return T && T.register.da() ? T.register.html(null) : null;
    if (t.art === 'gewinnspiel') return T && T.gewinnspiel.aktiv() ? T.gewinnspiel.html(null, T.gewinnspiel.sekunden() / RATE) : null;
    if (t.art === 'app') return T && T.app && T.app.da() ? T.app.html(null, T.app.sekunden() / RATE) : null;
    if (t.art === 'amtlich') return T && T.amtlich && T.amtlich.da() ? T.amtlich.html(null, T.amtlich.sekunden() / RATE) : null;
    if (t.art === 'aufruf' && T && T.aufruf && !T.aufruf.an()) return null;
    var weiter = t.weiter ? '<div class="rg-weiter">Als Nächstes · <b>' + BLOECKE[t.weiter] + '</b></div>' : '';
    if (t.art === 'marke') return '<div class="rg-t rg-t-marke"><div class="rg-bahn"><span class="rg-flieger">' + FLIEGER + '</span></div>'
      + logo('rg-logo-gross') + '<div class="rg-claim">Immobilien prüfen wie ein <em>Pilot</em>.</div>'
      + '<div class="rg-unter">Ein Rundgang durch die App · ' + ABSCHNITTE.length + ' Stationen</div>' + weiter + '</div>';
    if (t.art === 'zwischen') return '<div class="rg-t rg-t-zwischen">' + logo('rg-logo-mittel') + '<div class="rg-claim">' + t.zeile + '</div>' + weiter + '</div>';
    var qr = '';
    try { if (window.DpQr && window.DpQr.svg) qr = '<div class="rg-qr">' + window.DpQr.svg(URL_AUFRUF, { ecc: 'M', border: 2, dark: '#050505', light: '#FDFCFA' }) + '<span>Scannen und loslegen</span></div>'; } catch (e) { qr = ''; }
    return '<div class="rg-t rg-t-aufruf' + (qr ? '' : ' ohne-qr') + '"><div class="rg-aufruf-text">' + logo('rg-logo-mittel')
      + '<div class="rg-aufruf-titel">Jetzt kostenlos testen</div><div class="rg-aufruf-url gold">dealpilot.immo</div>'
      + '<div class="rg-unter">Immobilien prüfen wie ein Pilot.</div></div>' + qr + weiter + '</div>';
  }
  var tafelOffen = false;
  function zeigeTafel(t, html) {
    tafelEl.innerHTML = html;
    void tafelEl.offsetWidth;
    tafelEl.classList.add('an'); tafelOffen = true;
    kopf.classList.add('leer');
    /* ist die Tafel deckend, das alte Video ausblenden — sonst scheint es beim Abblenden der Tafel durch */
    setTimeout(function () { if (tafelOffen) vids.forEach(function (v) { v.pause(); v.classList.remove('an'); }); }, 900);
  }
  function schliesseTafel() { if (!tafelOffen) return; tafelOffen = false; tafelEl.classList.remove('an'); }

  /* ── Ablauf ── */
  var aktiv = null, vorbereitet = null, runde = 1;
  function frei() { return vids[0] === aktiv ? vids[1] : vids[0]; }
  function naechstesStueck(i) {
    for (var k = 1; k <= SCHRITTE.length; k++) { var j = (i + k) % SCHRITTE.length; if (SCHRITTE[j].typ === 'stueck') return j; }
    return -1;
  }
  function vorbereiten(j) {
    var v = frei();
    vorbereitet = { idx: j, v: v, p: bereite(v, SCHRITTE[j]) };
    log('vor', SCHRITTE[j].clip);
  }
  function status(i, s, extra) {
    window.DPS = { idee: 'rundgang', version: VER, quelle: QUELLE, runde: runde, schritt: i, von: SCHRITTE.length,
      art: s.typ, abschnitt: s.typ === 'stueck' ? s.a.id : s.id, teil: s.n || 0, zeit: Date.now(), extra: extra || null };
  }

  async function spieleStueck(i, s) {
    var vb = (vorbereitet && vorbereitet.idx === i) ? vorbereitet : (function () { vorbereiten(i); return vorbereitet; })();
    vorbereitet = null;
    var q = await vb.p;
    if (!q) { fehler('Rundgang: uebersprungen ' + s.clip); log('skip', s.clip); return; }
    var v = vb.v, alt = aktiv;
    v.playbackRate = RATE;
    var p = v.play(); if (p && p.catch) p.catch(function (e) { fehler('Rundgang: play ' + (e && e.message)); });
    await Promise.race([new Promise(function (r) { v.addEventListener('playing', r, { once: true }); }), warte(1500)]);
    if (s.erstes) setzeKopf(s.a);
    v.classList.add('an'); aktiv = v;
    if (alt && alt !== v) { alt.classList.remove('an'); }
    schliesseTafel();
    log('start', s.clip + ' ' + q.art + ' ' + q.von.toFixed(1));
    status(i, s, { quelle: q.art, von: q.von, bis: q.bis });
    setTimeout(function () { if (alt && alt !== v) alt.pause(); var j = naechstesStueck(i); if (j >= 0 && aktiv === v && !vorbereitet) vorbereiten(j); }, 700);
    /* bis zur Zeitmarke spielen; hängt das Bild 5 s, weiter */
    var balken = spur.children[s.a.nr - 1].firstChild;
    var letzt = v.currentTime, seit = performance.now();
    await new Promise(function (fertig) {
      (function schau() {
        if (naechsterSprung) { naechsterSprung = false; fertig(); return; }
        var t = v.currentTime, jetzt = performance.now();
        if (t !== letzt) { letzt = t; seit = jetzt; }
        else if (jetzt - seit > 5000) { fehler('Rundgang: stockt ' + s.clip); log('stockt', s.clip); fertig(); return; }
        if (v.paused && !v.ended && jetzt - seit > 800) { var pp = v.play(); if (pp && pp.catch) pp.catch(function () {}); }
        balken.style.width = Math.min(100, 100 * (s.offset + Math.max(0, t - q.von)) / s.a.dauer) + '%';
        if (t >= q.bis - 0.04 || v.ended) { fertig(); return; }
        requestAnimationFrame(schau);
      })();
    });
  }

  async function lauf() {
    var i = 0, stationen = 0;
    while (!abbruch) {
      var s = SCHRITTE[i];
      if (s.typ === 'tafel') {
        var html = tafelHtml(s.t);
        if (html) {
          status(i, s);
          log('tafel', s.id);
          zeigeTafel(s.t, html);
          if (!vorbereitet) { var j = naechstesStueck(i); if (j >= 0) vorbereiten(j); }
          var dauer = s.t.art === 'gewinnspiel' ? window.DPSTafeln.gewinnspiel.sekunden() : (s.t.art === 'app' ? window.DPSTafeln.app.sekunden() : (s.t.art === 'amtlich' ? window.DPSTafeln.amtlich.sekunden() : s.t.dauer));
          var t0 = performance.now(), ende = t0 + dauer * 1000 / RATE;
          while (performance.now() < ende && !naechsterSprung) await warte(100);
          naechsterSprung = false;
          log('tafel-ende', s.id + ' ' + Math.round(performance.now() - t0));
        } else log('tafel-aus', s.id);
      } else {
        await spieleStueck(i, s);
        /* messe-schleife-7 · Werbebild nach jeder n-ten Station (werbung.js, Menü: werbung, werbung_nach, werbung_sek) */
        var nachS = SCHRITTE[i + 1];
        if (!(nachS && nachS.typ === 'stueck' && nachS.a === s.a)) {
          stationen++;
          var WB = window.DPSTafeln && window.DPSTafeln.werbung;
          if (WB && WB.da() && stationen % WB.nach() === 0) {
            var wh = WB.html();
            if (wh) {
              status(i, { typ: 'tafel', id: 'werbung' }, { bild: window.DPS_WERBUNG && window.DPS_WERBUNG.bild });
              log('tafel', 'werbung ' + (window.DPS_WERBUNG && window.DPS_WERBUNG.bild));
              zeigeTafel({ art: 'werbung' }, wh);
              if (!vorbereitet) { var jw = naechstesStueck(i); if (jw >= 0) vorbereiten(jw); }
              var tw = performance.now(), endeW = tw + WB.sekunden() * 1000 / RATE;
              while (performance.now() < endeW && !naechsterSprung) await warte(100);
              naechsterSprung = false;
              log('tafel-ende', 'werbung ' + Math.round(performance.now() - tw));
            }
          }
        }
      }
      i++;
      if (i >= SCHRITTE.length) {
        i = 0; runde++; log('runde', runde);
        Array.prototype.forEach.call(spur.children, function (x) { x.classList.remove('fertig', 'jetzt'); x.firstChild.style.width = '0%'; });
      }
    }
  }

  /* Prüfhilfe: längste Strecke ohne sichtbares Bild (keine Tafel, kein
     spielbereites, eingeblendetes Video) — gezählt ab dem ersten Bild. */
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

  function start(buehne) {
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
    lauf().catch(function (e) { fehler('Rundgang: ' + (e && e.message)); });
  }

  window.DealPilotRundgang = { start: start, abschnitte: ABSCHNITTE, schritte: SCHRITTE, rundeSekunden: RUNDE_S, version: VER, quelle: QUELLE };
})();
