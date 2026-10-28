/* ═══════════════════════════════════════════════════════════════════════
   dp2-live.js · landing-videothek-5 · DealPilot live und die Videothek
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
  var QUELLE = 'assets/videothek/videos.json?v=landing-videothek-5';
  /* landing-videothek-4 · Jedes Video gibt es mit und ohne Sprecher (Marcel 19.10.2026:
     „die Videos muss es vertont und unvertont geben"). videos.json traegt je Eintrag
     `datei_ton`; die Wahl merkt sich der Browser, Standard: mit Sprecher. */
  var TON = true;
  try { TON = localStorage.getItem('dp_vt_ton') !== '0'; } catch (e) {}
  function datei(v) { return ((TON && v && v.datei_ton) ? v.datei_ton : v.datei) + '?v=marcel-20261026b'; }   /* v2967 · neue Stimme: Videos neu laden statt aus dem Cache */
  function bildUrl(v, D) { return D.basis_bilder + v.poster + '?v=v2968'; }   /* v2968 · Vorschaubilder Modul 14/18 neu: neu laden statt aus dem Cache */
  function tonText() { return TON ? 'Mit Sprecher ✓' : 'Ohne Sprecher'; }
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
  /* landing-videothek-5 · Kapitel tragen seit 28.10.2026 eine Zeit: {t, titel, stichworte}.
     Alte Eintraege (nur Name) bleiben lesbar - dann ohne Sprungmarke (t null). */
  function kapListe(v) {
    return (v.kapitel || []).map(function (c) {
      return typeof c === 'string' ? { t: null, titel: c, stichworte: '' }
        : { t: (typeof c.t === 'number' && isFinite(c.t)) ? c.t : null, titel: c.titel || '', stichworte: c.stichworte || '' };
    });
  }
  /* Suche: klein, Umlaute und ß gleichgesetzt (ä = ae, ß = ss = s - auch das Fugen-s verzeiht), Akzente weg */
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.replace(/ß/g, 's').replace(/ss/g, 's').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
      .replace(/[^a-z0-9%]+/g, ' ').trim();
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
        /* landing-module-1 · Marcel 27.10.2026: „Nicht erklärt. Vorgeflogen.“ war ihm zu albern, Investoren brauchen eine deutliche Sprache */ '<div class="head"><div class="eye">DealPilot in Aktion · echte Aufnahmen</div>' +
          '<h2>Vom Exposé zur <span class="ac">belastbaren Entscheidung.</span></h2>' +
          '<p>So rechnet DealPilot ein Objekt durch: Cashflow, Finanzierung, Steuer, Wert und Risiko, nachvollziehbar Schritt für Schritt. Starte mit dem Überblick oder geh direkt in das Modul, das dich interessiert.</p></div>' +
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
          '<img src="' + esc(bildUrl(v, D)) + '" alt="" loading="lazy" width="212" height="119">' +
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
        '<div class="dpl-kapitel">' + kapListe(v).filter(function (c) { return c.t !== 0; }).slice(0, 7).map(function (c) { return '<span>' + esc(c.titel) + '</span>'; }).join('') + '</div>' +
        '<div class="dpl-spruch">„' + esc(v.spruch) + '“</div>' +
        '<div class="dpl-aktion"><a class="btn-l" href="videothek.html#' + esc(v.id) + '">In der Videothek ansehen →</a></div>';
    }

    function waehle(i, ohneStart) {
      if (!liste.length) return;
      idx = (i + liste.length) % liste.length;
      var v = liste[idx];
      bild.classList.add('wechsel'); karte.classList.add('wechsel');
      setTimeout(function () {
        vid.setAttribute('poster', bildUrl(v, D));
        vid.preload = scharf ? 'metadata' : 'none';
        vid.src = D.basis_medien + datei(v);
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
    /* landing-videothek-5 · Marcel 28.10.2026: "jedes, was ich abspiele, wiederholt sich automatisch".
       Weiter zum naechsten nur im stummen Vorschau-Rundlauf; hat der Nutzer selbst gewaehlt
       (Abspielen, Vor/Zurueck, Streifen, Spur, Vollbild, Ton an), bleibt das Video am Ende stehen. */
    var selbstGewaehlt = false;
    function gewaehlt() { selbstGewaehlt = true; }
    vid.addEventListener('volumechange', function () { if (!vid.muted) gewaehlt(); });
    vid.addEventListener('ended', function () { if (selbstGewaehlt) { knopfStand(); return; } waehle(idx + 1); });
    vid.addEventListener('error', function () {
      /* Datei fehlt auf dem Server: Bild stehen lassen, ehrlich sagen. */
      $('dplZeit').textContent = 'Video folgt';
      schirm.classList.remove('laeuft');
    });

    function umschalten() {
      if (vid.paused) { selbstAngehalten = false; imBlick = true; spielen(); }
      else { selbstAngehalten = true; vid.pause(); }
    }
    vid.addEventListener('click', function () { gewaehlt(); umschalten(); });
    $('dplKnopf').addEventListener('click', function () { gewaehlt(); selbstAngehalten = false; imBlick = true; spielen(); });
    $('dplPP').addEventListener('click', function () { gewaehlt(); umschalten(); });
    $('dplVor').addEventListener('click', function () { gewaehlt(); selbstAngehalten = false; waehle(idx + 1); });
    $('dplZur').addEventListener('click', function () { gewaehlt(); selbstAngehalten = false; waehle(idx - 1); });
    $('dplVoll').addEventListener('click', function () {
      gewaehlt();
      var z = vid.requestFullscreen ? vid : (vid.webkitEnterFullscreen ? vid : null);
      if (!z) return;
      if (vid.requestFullscreen) vid.requestFullscreen(); else vid.webkitEnterFullscreen();
    });
    $('dplBahn').addEventListener('click', function (e) {
      gewaehlt();
      if (!vid.duration) return;
      var r = this.getBoundingClientRect();
      vid.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * vid.duration;
    });
    streifen.addEventListener('click', function (e) {
      var b = e.target.closest('.dpl-w[data-i]');
      if (b) { gewaehlt(); selbstAngehalten = false; imBlick = true; waehle(parseInt(b.getAttribute('data-i'), 10)); }
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
  /* landing-videothek-5 · Marcel 28.10.2026: "eine Suche, wo man in den Videos das Richtige
     suchen kann ... Minute 1 das und Minute 3 Thema 2 - dann findet man schneller, was man
     braucht." Je Video Kapitelmarken mit Zeit (aus den Zeitmarken der Vertonung), die Suche
     geht ueber Titel, Story, Kapitel und Stichworte und springt an die Stelle im Video.
     Deeplink: videothek.html?v=<id>&t=<sek> (alt: #<id>). */
  function thek(root, D) {
    var V = D.videos || [], K = D.kategorien || [];
    var summe = V.reduce(function (a, v) { return a + (v.dauer || 0); }, 0);
    var nKap = V.reduce(function (a, v) { return a + kapListe(v).filter(function (c) { return c.t != null; }).length; }, 0);
    var z = document.getElementById('vtZahlen');
    if (z) z.innerHTML =
      '<div><b>' + V.length + '</b><span>Videos</span></div>' +
      '<div><b>' + Math.round(summe / 60) + '</b><span>Minuten</span></div>' +
      (nKap ? '<div><b>' + nKap + '</b><span>Kapitelmarken</span></div>' : '') +
      '<div><b>' + K.length + '</b><span>Reihen</span></div>';

    /* Suchindex je Video: Kopf (Titel, Story ...) und je Kapitel Titel + Stichworte */
    var IDX = V.map(function (v) {
      var kap = kapListe(v);
      return {
        kopf: norm([v.nr, v.titel, v.unterzeile, v.story, v.nutzen, v.spruch].join(' ')),
        titel: norm(v.titel + ' ' + v.nr),
        kap: kap.map(function (c) { return { titel: norm(c.titel), such: norm(c.titel + ' ' + c.stichworte), worte: (c.stichworte || '').split(/\s+/).filter(Boolean) }; })
      };
    });

    var leiste = document.getElementById('vtLeiste');
    if (leiste) leiste.innerHTML =
      '<div class="dpl-tabs" role="tablist" aria-label="Reihe filtern">' +
        '<button class="dpl-tab" data-kat="alle" aria-selected="true">Alle<small>' + V.length + '</small></button>' +
        K.map(function (k) {
          return '<button class="dpl-tab" data-kat="' + esc(k.id) + '" aria-selected="false">' + esc(k.name) +
            '<small>' + V.filter(function (v) { return v.kategorie === k.id; }).length + '</small></button>';
        }).join('') +
      '</div><label class="vt-suchfeld"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>' +
      '<input class="vt-suche" id="vtSuche" type="search" autocomplete="off" spellcheck="false" placeholder="In allen Videos suchen: AfA, Bank-PDF, Grunderwerbsteuer …" aria-label="In allen Videos und Kapiteln suchen" aria-controls="vtTreffer"></label>';

    root.innerHTML = '<div class="vt-treffer" id="vtTreffer" aria-live="polite" hidden></div>' +
      K.map(function (k) {
      var vs = V.filter(function (v) { return v.kategorie === k.id; });
      return '<section class="vt-gruppe" data-kat="' + esc(k.id) + '" id="reihe-' + esc(k.id) + '">' +
        '<div class="vt-gk"><span>' + esc(k.kurz) + '</span><h2>' + esc(k.name) + '</h2><p>' + esc(k.text) + '</p></div>' +
        '<div class="vt-raster">' + vs.map(function (v) {
          var nk = kapListe(v).filter(function (c) { return c.t != null; }).length;
          return '<button class="vt-k" data-id="' + esc(v.id) + '">' +
            '<span class="vt-kb"><img src="' + esc(bildUrl(v, D)) + '" alt="" loading="lazy" width="480" height="256">' +
              '<span class="vt-nr">' + esc(v.nr) + '</span><span class="vt-d">' + mmss(v.dauer) + (nk ? ' · ' + nk + ' Kapitel' : '') + '</span><span class="vt-play">' + PLAY + '</span></span>' +
            '<span class="vt-kt"><b>' + esc(v.titel) + '</b><span class="vt-u">' + esc(v.unterzeile) + '</span><span class="vt-s">' + esc(v.story) + '</span></span>' +
          '</button>';
        }).join('') + '</div></section>';
    }).join('') + '<p class="vt-leer" id="vtLeer" hidden>Kein Video passt zur Suche.</p>';

    var filter = 'alle';
    var trefferEl = document.getElementById('vtTreffer');

    /* Ein Video passt, wenn JEDES Suchwort irgendwo darin steht (Kopf oder ein Kapitel).
       Kapitel werden nach Zahl der getroffenen Worte gereiht, dann nach Zeit. */
    function suche(q) {
      var W = norm(q).split(' ').filter(function (w) { return w.length >= 2 || /\d/.test(w); });
      if (!W.length) return null;
      var out = [];
      V.forEach(function (v, i) {
        if (filter !== 'alle' && v.kategorie !== filter) return;
        var x = IDX[i], alle = true, punkte = 0;
        W.forEach(function (w) {
          var inKopf = x.kopf.indexOf(w) >= 0, inKap = x.kap.some(function (c) { return c.such.indexOf(w) >= 0; });
          if (!inKopf && !inKap) alle = false;
          if (x.titel.indexOf(w) >= 0) punkte += 6; else if (inKap) punkte += 3; else if (inKopf) punkte += 1;
        });
        if (!alle) return;
        var kap = kapListe(v), treffer = [];
        x.kap.forEach(function (c, j) {
          var n = 0, imTitel = 0, worte = [];
          W.forEach(function (w) {
            if (c.such.indexOf(w) >= 0) n++;
            if (c.titel.indexOf(w) >= 0) imTitel++;
            c.worte.forEach(function (s) { if (norm(s).indexOf(w) >= 0 && worte.indexOf(s) < 0) worte.push(s); });
          });
          if (n) treffer.push({ k: kap[j], n: n, rang: n * 10 + imTitel * 4, worte: worte.slice(0, 4) });
        });
        treffer.sort(function (a, b) { return (b.rang - a.rang) || ((a.k.t || 0) - (b.k.t || 0)); });
        punkte += treffer.length ? treffer[0].rang / 10 : 0;
        out.push({ v: v, punkte: punkte, kap: treffer });
      });
      out.sort(function (a, b) { return b.punkte - a.punkte; });
      return out;
    }

    function zeigeTreffer(q, liste) {
      var nKapT = liste.reduce(function (a, r) { return a + r.kap.length; }, 0);
      if (!liste.length) {
        trefferEl.innerHTML = '<p class="vt-t-zahl">Nichts gefunden zu „' + esc(q) + '“. Versuch ein anderes Wort — etwa <button class="vt-t-vorschlag" data-q="Steuer">Steuer</button> <button class="vt-t-vorschlag" data-q="Bank">Bank</button> <button class="vt-t-vorschlag" data-q="Miete">Miete</button></p>';
        return;
      }
      trefferEl.innerHTML = '<p class="vt-t-zahl"><b>' + liste.length + '</b> ' + (liste.length === 1 ? 'Video' : 'Videos') +
        (nKapT ? ' · <b>' + nKapT + '</b> passende Kapitel' : '') + ' zu „' + esc(q) + '“</p>' +
        liste.map(function (r) {
          var v = r.v, zeig = r.kap.slice(0, 5), mehr = r.kap.length - zeig.length;
          return '<article class="vt-t">' +
            '<button class="vt-t-kopf" data-id="' + esc(v.id) + '" data-t="0">' +
              '<span class="vt-t-bild"><img src="' + esc(bildUrl(v, D)) + '" alt="" loading="lazy" width="480" height="256"><span class="vt-nr">' + esc(v.nr) + '</span></span>' +
              '<span class="vt-t-text"><span class="vt-t-kick">' + esc(nrLabel(v, D)) + ' · ' + mmss(v.dauer) + ' Min.</span><b>' + esc(v.titel) + '</b><span class="vt-u">' + esc(v.unterzeile) + '</span></span>' +
            '</button>' +
            (zeig.length ? '<div class="vt-t-kap">' + zeig.map(function (h) {
              var t = h.k.t;
              return '<button class="vt-t-k" data-id="' + esc(v.id) + '" data-t="' + (t == null ? 0 : t) + '">' +
                '<span class="vt-zeit">' + (t == null ? '—' : mmss(t)) + '</span>' +
                '<span class="vt-t-kt">' + esc(h.k.titel) + (h.worte.length ? '<small>' + h.worte.map(esc).join(' · ') + '</small>' : '') + '</span>' +
                '<span class="vt-t-pfeil" aria-hidden="true">' + PLAY + '</span></button>';
            }).join('') + (mehr > 0 ? '<span class="vt-t-mehr">+ ' + mehr + ' weitere Kapitel im Video</span>' : '') + '</div>' : '') +
          '</article>';
        }).join('');
    }

    function anwenden() {
      var q = ((document.getElementById('vtSuche') || {}).value || '').trim();
      var liste = suche(q);
      var suchend = !!liste;
      trefferEl.hidden = !suchend;
      if (suchend) zeigeTreffer(q, liste);
      root.querySelectorAll('.vt-gruppe').forEach(function (g) {
        g.hidden = suchend || (filter !== 'alle' && g.getAttribute('data-kat') !== filter);
      });
      document.getElementById('vtLeer').hidden = true;
      try {
        if (history.replaceState && !kino.classList.contains('auf')) {
          var u = new URL(location.href);
          if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
          history.replaceState(null, '', u.pathname + u.search + u.hash);
        }
      } catch (e) {}
    }
    if (leiste) {
      leiste.addEventListener('click', function (e) {
        var b = e.target.closest('.dpl-tab[data-kat]'); if (!b) return;
        filter = b.getAttribute('data-kat');
        leiste.querySelectorAll('.dpl-tab').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        anwenden();
      });
      var tmr = null;
      leiste.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(anwenden, 120); });
      leiste.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.id === 'vtSuche') {
          e.preventDefault(); anwenden();
          var erster = trefferEl.querySelector('.vt-t-k, .vt-t-kopf'); if (erster) erster.focus();
        }
      });
    }

    /* Kinofenster */
    var kino = document.createElement('div');
    kino.className = 'vt-kino'; kino.setAttribute('role', 'dialog'); kino.setAttribute('aria-modal', 'true');
    kino.innerHTML = '<div class="vt-kino-in"><div class="vt-kino-v"><video id="vtVideo" controls playsinline preload="metadata"></video>' +
      '<div class="vt-ende" id="vtEnde" hidden></div></div>' +
      '<div class="vt-kino-t"><button class="vt-zu" id="vtZu" aria-label="Schließen">×</button><div id="vtKinoText"></div>' +
      '<div class="vt-kino-n"><button id="vtZur">‹ Vorheriges</button><button id="vtVor">Nächstes ›</button>' +
      '<button id="vtTon" aria-pressed="' + (TON ? 'true' : 'false') + '" title="Zwischen der Fassung mit Sprecher und der ohne Ton wechseln">' + tonText() + '</button></div></div></div>';
    document.body.appendChild(kino);
    var kv = kino.querySelector('#vtVideo'), aktuell = -1, kapAkt = [];
    /* landing-videothek-4 · Umschalten mit/ohne Sprecher - Stelle im Video bleibt */
    kino.querySelector('#vtTon').addEventListener('click', function () {
      TON = !TON;
      try { localStorage.setItem('dp_vt_ton', TON ? '1' : '0'); } catch (e) {}
      this.textContent = tonText(); this.setAttribute('aria-pressed', TON ? 'true' : 'false');
      if (aktuell < 0) return;
      var v = V[aktuell], t = kv.currentTime || 0, lief = !kv.paused;
      kv.src = D.basis_medien + datei(v);
      kv.addEventListener('loadedmetadata', function f() { kv.removeEventListener('loadedmetadata', f); try { kv.currentTime = t; } catch (e) {} if (lief) { var p = kv.play(); if (p && p.catch) p.catch(function () {}); } });
    });

    /* An eine Stelle springen - vor den Metadaten erst, wenn sie da sind */
    function springe(t, spielen) {
      t = Math.max(0, +t || 0);
      function los() { try { kv.currentTime = t; } catch (e) {} if (spielen) { var p = kv.play(); if (p && p.catch) p.catch(function () {}); } kapMarkieren(); }
      if (kv.readyState >= 1) los();
      else kv.addEventListener('loadedmetadata', function f() { kv.removeEventListener('loadedmetadata', f); los(); });
    }
    function kapMarkieren() {
      var t = kv.currentTime || 0, an = -1;
      kapAkt.forEach(function (c, j) { if (c.t != null && c.t <= t + 0.25) an = j; });
      kino.querySelectorAll('.vt-kap button').forEach(function (b, j) {
        var ist = (+b.getAttribute('data-j') === an);
        if (b.classList.contains('an') !== ist) { b.classList.toggle('an', ist); if (ist) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
      });
    }
    kv.addEventListener('timeupdate', kapMarkieren);
    kv.addEventListener('seeked', kapMarkieren);

    function oeffne(id, ohneHash, t) {
      var i = -1; V.forEach(function (v, j) { if (v.id === id) i = j; });
      if (i < 0) return;
      var gleich = (i === aktuell && kino.classList.contains('auf'));
      aktuell = i; var v = V[i];
      if (ende) endeZu();
      if (!gleich) {
        kv.setAttribute('poster', bildUrl(v, D));
        kv.src = D.basis_medien + datei(v);
        kapAkt = kapListe(v);
        var mitZeit = kapAkt.some(function (c) { return c.t != null; });
        kino.querySelector('#vtKinoText').innerHTML =
          '<div class="dpl-k-kick"><span>' + esc(nrLabel(v, D)) + '</span><span>' + mmss(v.dauer) + ' Min.</span></div>' +
          '<h3>' + esc(v.titel) + '</h3><div class="vt-u">' + esc(v.unterzeile) + '</div>' +
          (mitZeit
            ? '<div class="vt-kap-kopf">Kapitel · zum Springen antippen</div><ol class="vt-kap">' + kapAkt.map(function (c, j) {
                return c.t == null ? '<li><span class="vt-kap-ohne">' + esc(c.titel) + '</span></li>'
                  : '<li><button data-j="' + j + '" data-t="' + c.t + '"><span class="vt-zeit">' + mmss(c.t) + '</span><span>' + esc(c.titel) + '</span></button></li>';
              }).join('') + '</ol>'
            : '<div class="dpl-kapitel">' + kapAkt.map(function (c) { return '<span>' + esc(c.titel) + '</span>'; }).join('') + '</div>') +
          '<p>' + esc(v.story) + '</p>' +
          '<div class="dpl-gewinn"><b>Dein Gewinn</b><span>' + esc(v.nutzen) + '</span></div>' +
          '<div class="dpl-spruch">„' + esc(v.spruch) + '“</div>';
        kino.classList.add('auf');
        document.documentElement.style.overflow = 'hidden';
        kino.querySelector('.vt-kino-t').scrollTop = 0;
      }
      if (!ohneHash && history.replaceState) {
        var u = '?v=' + encodeURIComponent(v.id) + (t ? '&t=' + Math.round(t) : '');
        history.replaceState(null, '', location.pathname + u);
      }
      springe(t || 0, true);
      if (!gleich) kino.querySelector('#vtZu').focus();
    }
    function zu() {
      kv.pause(); kino.classList.remove('auf');
      document.documentElement.style.overflow = '';
      if (history.replaceState) {
        var q = ((document.getElementById('vtSuche') || {}).value || '').trim();
        history.replaceState(null, '', location.pathname + (q ? '?q=' + encodeURIComponent(q) : ''));
      }
    }
    root.addEventListener('click', function (e) {
      var vs = e.target.closest('.vt-t-vorschlag[data-q]');
      if (vs) { var f = document.getElementById('vtSuche'); f.value = vs.getAttribute('data-q'); anwenden(); f.focus(); return; }
      var h = e.target.closest('[data-id][data-t]');
      if (h) { oeffne(h.getAttribute('data-id'), false, +h.getAttribute('data-t') || 0); return; }
      var k = e.target.closest('.vt-k[data-id]'); if (k) oeffne(k.getAttribute('data-id'));
    });
    kino.addEventListener('click', function (e) {
      if (e.target === kino) { zu(); return; }
      var b = e.target.closest('.vt-kap button[data-t]');
      if (b) {
        var t = +b.getAttribute('data-t') || 0;
        if (history.replaceState && aktuell >= 0) history.replaceState(null, '', location.pathname + '?v=' + encodeURIComponent(V[aktuell].id) + (t ? '&t=' + t : ''));
        springe(t, true);
      }
    });
    kino.querySelector('#vtZu').addEventListener('click', zu);
    kino.querySelector('#vtVor').addEventListener('click', function () { oeffne(V[(aktuell + 1) % V.length].id); });
    kino.querySelector('#vtZur').addEventListener('click', function () { oeffne(V[(aktuell - 1 + V.length) % V.length].id); });
    /* landing-videothek-5 · kein automatischer Start mehr am Ende (Marcel 28.10.2026: "laeuft alles in
       der Endlosschleife"). Das Video bleibt stehen, eine Karte bietet das naechste an. */
    var ende = kino.querySelector('#vtEnde');
    function endeZu() { ende.hidden = true; ende.innerHTML = ''; }
    kv.addEventListener('ended', function () {
      if (aktuell < 0) return;
      var n = V[aktuell + 1];
      ende.innerHTML = (n
        ? '<button class="vt-ende-vor" data-id="' + esc(n.id) + '"><small>Nächstes Video · ' + esc(n.nr) + '</small><b>' + esc(n.titel) + ' <span aria-hidden="true">▸</span></b></button>'
        : '<button class="vt-ende-vor" data-zu="1"><small>Das war das letzte Video</small><b>Zur Übersicht</b></button>') +
        '<button class="vt-ende-nochmal" data-nochmal="1">↺ Nochmal ansehen</button>';
      ende.hidden = false;
    });
    kv.addEventListener('play', endeZu);
    ende.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.getAttribute('data-nochmal')) { endeZu(); springe(0, true); }
      else if (b.getAttribute('data-zu')) { endeZu(); zu(); }
      else if (b.getAttribute('data-id')) { endeZu(); oeffne(b.getAttribute('data-id')); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && kino.classList.contains('auf')) zu(); });

    /* Einstieg: ?q= fuellt die Suche, ?v=&t= (oder #id) oeffnet das Video an der Stelle */
    var P = new URLSearchParams(location.search);
    if (P.get('q')) { var f = document.getElementById('vtSuche'); if (f) { f.value = P.get('q'); anwenden(); } }
    var hid = P.get('v') || decodeURIComponent((location.hash || '').slice(1));
    if (hid) oeffne(hid, true, Math.max(0, parseInt(P.get('t'), 10) || 0));
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
