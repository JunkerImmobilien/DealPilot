/* ═══════════════════════════════════════════════════════════════════════
   dp2-live.js · landing-videothek-1 · DealPilot live und die Videothek
   ───────────────────────────────────────────────────────────────────────
   Eine Quelle: assets/videothek/videos.json. Daraus baut dieses Skript
     · auf der Landing (#dplRoot) den Abschnitt "DealPilot live": ein
       Bildschirm, der stumm durch die Videos einer Ebene laeuft, daneben
       die Bordkarte mit der Geschichte zum Video, darunter der Streifen;
     · auf videothek.html (#vtRoot) die Videothek mit allen Videos,
       gegliedert nach Ueberblick / Basis / Erweitert, und das Kinofenster.

   Regeln, die hier gelten:
   · Autoplay NUR stumm und nur, solange der Bildschirm im Blick ist.
     Wer selbst anhaelt, dem startet kein Beobachter das Video wieder.
   · Geladen wird erst, wenn der Abschnitt in die Naehe kommt
     (preload="none" bis dahin) - 10 MB je Video sollen niemanden
     treffen, der nur die Preise sucht.
   · Ein fehlendes Video ist KEIN 404: der Server antwortet auf jeden
     unbekannten Pfad mit index.html und 200. Deshalb zaehlt das
     error-Ereignis des Videos, nicht der Statuscode.
   · Wer weniger Bewegung eingestellt hat, bekommt kein Autoplay.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var QUELLE = 'assets/videothek/videos.json?v=landing-videothek-1';
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>';
  var VOR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5v15l10-7.5zM16 4.5h3v15h-3z"/></svg>';
  var ZURUECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4.5v15L9 12zM5 4.5h3v15H5z"/></svg>';
  var VOLL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mmss(s) {
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function laden() {
    return fetch(QUELLE, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();   /* index.html statt JSON (Server-Rueckfall) wirft hier */
    });
  }
  function nrLabel(v, D) {
    var k = (D.kategorien || []).filter(function (x) { return x.id === v.kategorie; })[0];
    /* 1a: "Überblick 1 · Überblick" sagte dasselbe zweimal */
    if (v.kategorie === 'ueberblick') return 'Überblick ' + String(v.nr).replace('Ü', '') + ' · Der ganze Weg';
    return 'Modul ' + v.nr + (k ? ' · ' + k.name : '');
  }

  /* ══ DealPilot live (Landing) ═════════════════════════════════════════ */
  function live(root, D) {
    var V = D.videos || [], K = D.kategorien || [];
    var start = root.getAttribute('data-start') || 'ueberblick';
    var kat = start, liste = [], idx = 0, selbstAngehalten = false, imBlick = false, scharf = false;

    root.innerHTML =
      '<div class="dpl-kopf">' +
        '<div class="head"><div class="eye">DealPilot live · Bordkino</div>' +
          '<h2>Nicht erklärt. <span class="ac">Vorgeflogen.</span></h2>' +
          '<p>Echte Bildschirmaufnahmen aus der laufenden App, kein Werbespot. Wähle deine Flughöhe: der ganze Weg im Überblick, die Basismodule oder die Spezialthemen.</p></div>' +
        '<div class="dpl-tabs" role="tablist" aria-label="Videoreihe wählen">' +
          K.map(function (k) {
            var n = V.filter(function (v) { return v.kategorie === k.id; }).length;
            return '<button class="dpl-tab" role="tab" data-kat="' + esc(k.id) + '" aria-selected="false">' + esc(k.name) + '<small>' + n + '</small></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="dpl-buehne">' +
        '<div class="dpl-schirm">' +
          '<div class="dpl-hud"><span class="dpl-live"><i></i>Live aus der App</span><span class="dpl-flug" id="dplFlug">Flug DP</span><span class="dpl-zeit" id="dplZeit">0:00 / 0:00</span></div>' +
          '<div class="dpl-bild" id="dplBild">' +
            '<video id="dplVideo" muted playsinline preload="none" aria-label="DealPilot-Erklärvideo"></video>' +
            '<button class="dpl-knopf" id="dplKnopf" aria-label="Video abspielen">' + PLAY + '</button>' +
          '</div>' +
          '<div class="dpl-fuss">' +
            '<button class="dpl-mini" id="dplZur" aria-label="Vorheriges Video">' + ZURUECK + '</button>' +
            '<button class="dpl-mini" id="dplPP" aria-label="Abspielen oder anhalten">' + PLAY + '</button>' +
            '<button class="dpl-mini" id="dplVor" aria-label="Nächstes Video">' + VOR + '</button>' +
            '<div class="dpl-bahn" id="dplBahn" role="progressbar" aria-label="Fortschritt"><i id="dplBahnI"></i></div>' +
            '<button class="dpl-mini" id="dplVoll" aria-label="Vollbild">' + VOLL + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="dpl-karte" id="dplKarte" aria-live="polite"><div class="dpl-inhalt" id="dplInhalt"></div></div>' +
      '</div>' +
      '<div class="dpl-streifen" id="dplStreifen"></div>' +
      '<p class="dpl-hinweis">Die Videos laufen stumm und automatisch, solange du hier bist. Alle ' + V.length +
        ' Videos mit Kapiteln findest du in der <a href="videothek.html">Videothek</a>.</p>';

    var $ = function (id) { return root.querySelector('#' + id); };
    var vid = $('dplVideo'), bild = $('dplBild'), schirm = root.querySelector('.dpl-schirm');
    var karte = $('dplKarte'), inhalt = $('dplInhalt'), streifen = $('dplStreifen');

    function zeigeKat(k, ohneStart) {
      kat = k;
      liste = V.filter(function (v) { return v.kategorie === k; });
      root.querySelectorAll('.dpl-tab').forEach(function (b) {
        b.setAttribute('aria-selected', b.getAttribute('data-kat') === k ? 'true' : 'false');
      });
      streifen.innerHTML = liste.map(function (v, i) {
        return '<button class="dpl-w" data-i="' + i + '" aria-label="' + esc(v.titel) + ' abspielen">' +
          '<span class="dpl-wp"></span>' +
          '<img src="' + esc(D.basis_bilder + v.poster) + '" alt="" loading="lazy" width="212" height="119">' +
          '<span class="dpl-wd">' + mmss(v.dauer) + '</span>' +
          '<span class="dpl-wt"><span class="dpl-wn">' + esc(v.kategorie === 'ueberblick' ? 'ÜBERBLICK ' + String(v.nr).replace('Ü', '') : 'MODUL ' + v.nr) + '</span><b>' + esc(v.titel) + '</b></span>' +
        '</button>';
      }).join('');
      waehle(0, ohneStart);
    }

    function karteFuellen(v) {
      inhalt.innerHTML =
        '<div class="dpl-k-kick"><span>' + esc(nrLabel(v, D)) + '</span><span>' + mmss(v.dauer) + ' Min.</span></div>' +
        '<h3>' + esc(v.titel) + '</h3>' +
        '<p class="dpl-unter">' + esc(v.unterzeile) + '</p>' +
        '<p class="dpl-story">' + esc(v.story) + '</p>' +
        '<div class="dpl-gewinn"><b>Dein Gewinn</b><span>' + esc(v.nutzen) + '</span></div>' +
        '<div class="dpl-kapitel">' + (v.kapitel || []).slice(0, 7).map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
        '<div class="dpl-spruch">„' + esc(v.spruch) + '“</div>' +
        '<div class="dpl-aktion"><a class="btn-l" href="videothek.html#' + esc(v.id) + '">In der Videothek ansehen →</a></div>';
    }

    function waehle(i, ohneStart) {
      if (!liste.length) return;
      idx = (i + liste.length) % liste.length;
      var v = liste[idx];
      bild.classList.add('wechsel'); karte.classList.add('wechsel');
      setTimeout(function () {
        vid.setAttribute('poster', D.basis_bilder + v.poster);
        vid.preload = scharf ? 'metadata' : 'none';
        vid.src = D.basis_medien + v.datei;
        karteFuellen(v);
        $('dplFlug').textContent = 'Flug DP-' + String(v.nr).replace('Ü', 'U');
        $('dplZeit').textContent = '0:00 / ' + mmss(v.dauer);
        $('dplBahnI').style.width = '0%';
        bild.classList.remove('wechsel'); karte.classList.remove('wechsel');
        streifen.querySelectorAll('.dpl-w').forEach(function (b, j) {
          b.classList.toggle('on', j === idx); b.style.removeProperty('--p');
        });
        var akt = streifen.querySelector('.dpl-w.on');
        if (akt && imBlick) streifen.scrollTo({ left: akt.offsetLeft - 8, behavior: ruhig ? 'auto' : 'smooth' });
        if (!ohneStart) spielen();
      }, ruhig ? 0 : 260);
    }

    function spielen() {
      if (!imBlick || document.visibilityState !== 'visible') return;
      vid.muted = true;
      var p = vid.play();
      if (p && p.catch) p.catch(function () { schirm.classList.remove('laeuft'); });
    }
    function knopfStand() {
      var l = !vid.paused && !vid.ended;
      schirm.classList.toggle('laeuft', l);
      $('dplPP').innerHTML = l ? PAUSE : PLAY;
    }

    vid.addEventListener('play', knopfStand);
    vid.addEventListener('pause', knopfStand);
    vid.addEventListener('timeupdate', function () {
      var d = vid.duration || liste[idx].dauer || 1, p = Math.min(100, vid.currentTime / d * 100);
      $('dplBahnI').style.width = p + '%';
      $('dplZeit').textContent = mmss(vid.currentTime) + ' / ' + mmss(d);
      var akt = streifen.querySelector('.dpl-w.on');
      if (akt) akt.style.setProperty('--p', p + '%');
    });
    vid.addEventListener('ended', function () { waehle(idx + 1); });
    vid.addEventListener('error', function () {
      /* Datei fehlt auf dem Server: Bild stehen lassen, ehrlich sagen. */
      $('dplZeit').textContent = 'Video folgt';
      schirm.classList.remove('laeuft');
    });

    function umschalten() {
      if (vid.paused) { selbstAngehalten = false; imBlick = true; spielen(); }
      else { selbstAngehalten = true; vid.pause(); }
    }
    vid.addEventListener('click', umschalten);
    $('dplKnopf').addEventListener('click', function () { selbstAngehalten = false; imBlick = true; spielen(); });
    $('dplPP').addEventListener('click', umschalten);
    $('dplVor').addEventListener('click', function () { selbstAngehalten = false; waehle(idx + 1); });
    $('dplZur').addEventListener('click', function () { selbstAngehalten = false; waehle(idx - 1); });
    $('dplVoll').addEventListener('click', function () {
      var z = vid.requestFullscreen ? vid : (vid.webkitEnterFullscreen ? vid : null);
      if (!z) return;
      if (vid.requestFullscreen) vid.requestFullscreen(); else vid.webkitEnterFullscreen();
    });
    $('dplBahn').addEventListener('click', function (e) {
      if (!vid.duration) return;
      var r = this.getBoundingClientRect();
      vid.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * vid.duration;
    });
    streifen.addEventListener('click', function (e) {
      var b = e.target.closest('.dpl-w[data-i]');
      if (b) { selbstAngehalten = false; imBlick = true; waehle(parseInt(b.getAttribute('data-i'), 10)); }
    });
    root.querySelector('.dpl-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.dpl-tab[data-kat]');
      if (b && b.getAttribute('data-kat') !== kat) { selbstAngehalten = false; zeigeKat(b.getAttribute('data-kat')); }
    });

    /* Erst in der Naehe scharf schalten (Vorladen), erst im Blick spielen. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !scharf) { scharf = true; vid.preload = 'metadata'; }
        });
      }, { rootMargin: '600px 0px' }).observe(schirm);
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          imBlick = e.isIntersecting;
          if (imBlick && !selbstAngehalten && !ruhig) spielen();
          if (!imBlick && !vid.paused) vid.pause();
        });
      }, { threshold: 0.35 }).observe(schirm);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') { if (!vid.paused) vid.pause(); }
      else if (imBlick && !selbstAngehalten && !ruhig) spielen();
    });

    zeigeKat(start, true);
  }

  /* ══ Videothek (videothek.html) ═══════════════════════════════════════ */
  function thek(root, D) {
    var V = D.videos || [], K = D.kategorien || [];
    var summe = V.reduce(function (a, v) { return a + (v.dauer || 0); }, 0);
    var z = document.getElementById('vtZahlen');
    if (z) z.innerHTML =
      '<div><b>' + V.length + '</b><span>Videos</span></div>' +
      '<div><b>' + Math.round(summe / 60) + '</b><span>Minuten</span></div>' +
      '<div><b>' + K.length + '</b><span>Reihen</span></div>';

    var leiste = document.getElementById('vtLeiste');
    if (leiste) leiste.innerHTML =
      '<div class="dpl-tabs" role="tablist" aria-label="Reihe filtern">' +
        '<button class="dpl-tab" data-kat="alle" aria-selected="true">Alle<small>' + V.length + '</small></button>' +
        K.map(function (k) {
          return '<button class="dpl-tab" data-kat="' + esc(k.id) + '" aria-selected="false">' + esc(k.name) +
            '<small>' + V.filter(function (v) { return v.kategorie === k.id; }).length + '</small></button>';
        }).join('') +
      '</div><input class="vt-suche" id="vtSuche" type="search" placeholder="Suchen: Steuer, Bank, Miete …" aria-label="Videos durchsuchen">';

    root.innerHTML = K.map(function (k) {
      var vs = V.filter(function (v) { return v.kategorie === k.id; });
      return '<section class="vt-gruppe" data-kat="' + esc(k.id) + '" id="reihe-' + esc(k.id) + '">' +
        '<div class="vt-gk"><span>' + esc(k.kurz) + '</span><h2>' + esc(k.name) + '</h2><p>' + esc(k.text) + '</p></div>' +
        '<div class="vt-raster">' + vs.map(function (v) {
          var such = [v.titel, v.unterzeile, v.story, v.nutzen, (v.kapitel || []).join(' '), v.nr].join(' ').toLowerCase();
          return '<button class="vt-k" data-id="' + esc(v.id) + '" data-such="' + esc(such) + '">' +
            '<span class="vt-kb"><img src="' + esc(D.basis_bilder + v.poster) + '" alt="" loading="lazy" width="480" height="256">' +
              '<span class="vt-nr">' + esc(v.nr) + '</span><span class="vt-d">' + mmss(v.dauer) + '</span><span class="vt-play">' + PLAY + '</span></span>' +
            '<span class="vt-kt"><b>' + esc(v.titel) + '</b><span class="vt-u">' + esc(v.unterzeile) + '</span><span class="vt-s">' + esc(v.story) + '</span></span>' +
          '</button>';
        }).join('') + '</div></section>';
    }).join('') + '<p class="vt-leer" id="vtLeer" hidden>Kein Video passt zur Suche.</p>';

    var filter = 'alle';
    function anwenden() {
      var q = ((document.getElementById('vtSuche') || {}).value || '').trim().toLowerCase();
      var treffer = 0;
      root.querySelectorAll('.vt-gruppe').forEach(function (g) {
        var sichtbar = 0;
        g.querySelectorAll('.vt-k').forEach(function (k) {
          var ok = (!q || k.getAttribute('data-such').indexOf(q) >= 0);
          k.hidden = !ok; if (ok) sichtbar++;
        });
        g.hidden = (filter !== 'alle' && g.getAttribute('data-kat') !== filter) || !sichtbar;
        if (!g.hidden) treffer += sichtbar;
      });
      document.getElementById('vtLeer').hidden = treffer > 0;
    }
    if (leiste) {
      leiste.addEventListener('click', function (e) {
        var b = e.target.closest('.dpl-tab[data-kat]'); if (!b) return;
        filter = b.getAttribute('data-kat');
        leiste.querySelectorAll('.dpl-tab').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        anwenden();
      });
      leiste.addEventListener('input', anwenden);
    }

    /* Kinofenster */
    var kino = document.createElement('div');
    kino.className = 'vt-kino'; kino.setAttribute('role', 'dialog'); kino.setAttribute('aria-modal', 'true');
    kino.innerHTML = '<div class="vt-kino-in"><video id="vtVideo" controls playsinline preload="metadata"></video>' +
      '<div class="vt-kino-t"><button class="vt-zu" id="vtZu" aria-label="Schließen">×</button><div id="vtKinoText"></div>' +
      '<div class="vt-kino-n"><button id="vtZur">‹ Vorheriges</button><button id="vtVor">Nächstes ›</button></div></div></div>';
    document.body.appendChild(kino);
    var kv = kino.querySelector('#vtVideo'), aktuell = -1;

    function oeffne(id, ohneHash) {
      var i = -1; V.forEach(function (v, j) { if (v.id === id) i = j; });
      if (i < 0) return;
      aktuell = i; var v = V[i];
      kv.setAttribute('poster', D.basis_bilder + v.poster);
      kv.src = D.basis_medien + v.datei;
      kino.querySelector('#vtKinoText').innerHTML =
        '<div class="dpl-k-kick"><span>' + esc(nrLabel(v, D)) + '</span><span>' + mmss(v.dauer) + ' Min.</span></div>' +
        '<h3>' + esc(v.titel) + '</h3><div class="vt-u">' + esc(v.unterzeile) + '</div>' +
        '<p>' + esc(v.story) + '</p>' +
        '<div class="dpl-gewinn"><b>Dein Gewinn</b><span>' + esc(v.nutzen) + '</span></div>' +
        '<div class="dpl-kapitel">' + (v.kapitel || []).map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
        '<div class="dpl-spruch">„' + esc(v.spruch) + '“</div>';
      kino.classList.add('auf');
      document.documentElement.style.overflow = 'hidden';
      if (!ohneHash && history.replaceState) history.replaceState(null, '', '#' + v.id);
      var p = kv.play(); if (p && p.catch) p.catch(function () {});
      kino.querySelector('#vtZu').focus();
    }
    function zu() {
      kv.pause(); kino.classList.remove('auf');
      document.documentElement.style.overflow = '';
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    }
    root.addEventListener('click', function (e) {
      var k = e.target.closest('.vt-k[data-id]'); if (k) oeffne(k.getAttribute('data-id'));
    });
    kino.addEventListener('click', function (e) { if (e.target === kino) zu(); });
    kino.querySelector('#vtZu').addEventListener('click', zu);
    kino.querySelector('#vtVor').addEventListener('click', function () { oeffne(V[(aktuell + 1) % V.length].id); });
    kino.querySelector('#vtZur').addEventListener('click', function () { oeffne(V[(aktuell - 1 + V.length) % V.length].id); });
    kv.addEventListener('ended', function () { oeffne(V[(aktuell + 1) % V.length].id); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && kino.classList.contains('auf')) zu(); });

    var h = decodeURIComponent((location.hash || '').slice(1));
    if (h) oeffne(h, true);
  }

  var lr = document.getElementById('dplRoot'), tr = document.getElementById('vtRoot');
  if (!lr && !tr) return;
  laden().then(function (D) {
    if (lr) live(lr, D);
    if (tr) thek(tr, D);
  }).catch(function () {
    /* Ohne Liste kein Abschnitt - lieber nichts als ein leerer Rahmen. */
    if (lr) { var s = lr.closest('section'); if (s) s.hidden = true; }
    if (tr) tr.innerHTML = '<p class="vt-leer">Die Videothek ist gerade nicht erreichbar.</p>';
  });
})();
