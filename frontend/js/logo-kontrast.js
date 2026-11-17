/* ══════════════════════════════════════════════════════════════════════
   logo-kontrast.js · v3299 — Partnerlogo auf hellem UND dunklem Grund

   WARUM ES DIESE DATEI GIBT

   Ein Partner laedt EIN Logo hoch. Es erscheint auf Obsidian (Menueleiste,
   Bewertungs-Chip, Mail-Kopf, Obsidian-Deckblatt) und auf Weiss (PDF-Boegen,
   Logo-Plakette der einheitlichen Dokumente). Gemessen am 11.11.2026
   (Dateien/Partner-Demo/Befund.md): das dunkle Kessler-Logo stand auf der
   Menueleiste bei Kontrast 1,30 : 1, das helle Nordwind-Logo verschwand auf
   jedem weissen Deckblatt.

   DER WEG (Vorschlag aus logo-kontrast-vorschlag-DEMO.html, umgesetzt)

     1. Einmal vermessen: mittlere Leuchtdichte der deckenden Pixel,
        Farbstreuung (ein-/mehrfarbig), eigene Flaeche (Ecken deckend).
     2. Je Grund: Kontrast >= 3 : 1 -> unveraendert. Darunter wird ein
        EINFARBIGES Logo eingefaerbt (weiss auf dunkel, fast schwarz auf
        hell), ein MEHRFARBIGES bekommt eine Platte (hell auf dunkel,
        dunkel auf hell). Ein Logo mit eigener Flaeche bleibt, wie es ist.
     3. Ein zweites, optionales Logo "fuer dunklen Grund" hat dort Vorrang.
     4. Das Ergebnis ist ein fertiges PNG je Grund - jsPDF und Mail kennen
        weder var() noch CSS-Filter, und SVG druckt jsPDF nicht.

   Dieses Modul rechnet nur. Wer welche Variante wo einsetzt, steht in
   whitelabel-override.js (App, Quick-Check, Marktbericht), pdf.js /
   pdf-logo.js (PDFs) und im Backend (Mails, oeffentliche Logo-Route).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotLogoKontrast) return;

  /* Die Gruende, gemessen (Befund.md, Demo):
     app   Menueleiste / Schiene Obsidian      #0A0A0C
     pdf   Obsidian-Deckblatt jsPDF (C.CH)     #2A2727
     mail  Kopf der Einladungs-Mail            #0B0B0A
     weiss PDF-Bogen, Logo-Plakette            #FFFFFF                */
  var GRUENDE_DUNKEL = [[10, 10, 12], [42, 39, 39], [11, 11, 10], [21, 21, 21]];
  var GRUND_HELL = [255, 255, 255];
  var MINDEST = 3;
  var PLATTE_HELL = [255, 255, 255];
  var PLATTE_DUNKEL = [10, 10, 12];
  var TINTE_DUNKEL = [20, 20, 22];
  /* v3630f · 240 -> 400: Marcels Logo (958 x 589) wurde auf 390 x 240 gerechnet,
     in der Menueleiste stehen bei voller Breite 216 x 133 px, am Retina-Schirm
     also 266 Bildpunkte Hoehe - mehr als 240, das Bild wurde hochgezogen. */
  var ZIEL_H = 400;            /* Rasterhoehe der Varianten in px */
  var MAX_ZEICHEN = 560000;    /* Backend nimmt je Variante hoechstens 600.000 Zeichen */
  /* PNG als Data-URL, notfalls verkleinert, bis es ins Backend passt. */
  function png(c) {
    var u = c.toDataURL('image/png'), f = 1;
    while (u.length > MAX_ZEICHEN && f > 0.3) {
      f *= 0.8;
      var o = document.createElement('canvas');
      o.width = Math.max(1, Math.round(c.width * f)); o.height = Math.max(1, Math.round(c.height * f));
      var x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, o.width, o.height);
      u = o.toDataURL('image/png');
    }
    return u;
  }

  function lum(c) {
    function f(x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function kontrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function rund(k) { return k == null ? null : Math.round(k * 100) / 100; }

  function laden(src) {
    return new Promise(function (ok, nein) {
      if (!src) return nein(new Error('kein Bild'));
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { nein(new Error('Bild nicht lesbar')); };
      img.src = src;
    });
  }

  /* SVG ohne Groessenangabe hat naturalWidth 0 - dann aus dem viewBox-
     Verhaeltnis rechnen, sonst 3 : 1 annehmen. */
  function masse(img) {
    var w = img.naturalWidth || img.width || 0, h = img.naturalHeight || img.height || 0;
    if (!w || !h) { w = 720; h = 240; }
    var f = ZIEL_H / h;
    if (w * f > ZIEL_H * 6) f = (ZIEL_H * 6) / w;     /* sehr breite Logos deckeln */
    return { w: Math.max(1, Math.round(w * f)), h: Math.max(1, Math.round(h * f)) };
  }

  function raster(img) {
    var m = masse(img);
    var c = document.createElement('canvas');
    c.width = m.w; c.height = m.h;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0, m.w, m.h);
    return c;
  }

  function vermessen(c) {
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    var n = 0, r = 0, g = 0, b = 0, px = [];
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      n++; r += d[i]; g += d[i + 1]; b += d[i + 2];
      if (n % 7 === 0) px.push([d[i], d[i + 1], d[i + 2]]);
    }
    if (!n) return { mittel: [128, 128, 128], streuung: 0, eigeneFlaeche: false, deckend: 0 };
    var mt = [r / n, g / n, b / n], st = 0;
    px.forEach(function (p) { st += Math.hypot(p[0] - mt[0], p[1] - mt[1], p[2] - mt[2]); });
    st /= px.length || 1;
    /* Eigene Flaeche: Punkte 6 % / 12 % innerhalb der Ecken deckend
       (abgerundete Ecken zaehlen mit) - wie in der Demo. */
    var ix = Math.round(c.width * 0.06), iy = Math.round(c.height * 0.12);
    var ecken = [[ix, iy], [c.width - 1 - ix, iy], [ix, c.height - 1 - iy], [c.width - 1 - ix, c.height - 1 - iy]]
      .filter(function (q) { return d[(q[1] * c.width + q[0]) * 4 + 3] > 200; }).length;
    /* v3630f · transparenter Grund? (Ecken durchsichtig) */
    var tr = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]]
      .filter(function (q) { return d[(q[1] * c.width + q[0]) * 4 + 3] < 16; }).length;
    return {
      mittel: mt.map(Math.round), streuung: Math.round(st * 10) / 10,
      eigeneFlaeche: ecken >= 3, deckend: Math.round(n / (c.width * c.height) * 100) / 100,
      transparent: tr >= 3, _px: px
    };
  }
  /* v3630f · Anteil der Logopunkte, die gegen ALLE Gruende 3 : 1 erreichen.
     Der Mittelwert allein taeuscht: Marcels Logo (Gold + Dunkelgrau) hatte im
     Mittel 3,9 : 1 auf Obsidian - die dunkelgrauen Daecher und die Unterzeile
     (#4a4a4a, 2,1 : 1) gingen trotzdem unter, und "Automatisch" liess es so. */
  function anteilLesbar(px, gruende) {
    if (!px || !px.length) return 1;
    var gut = 0;
    px.forEach(function (p) { if (Math.min.apply(null, gruende.map(function (g) { return kontrast(p, g); })) >= MINDEST) gut++; });
    return gut / px.length;
  }

  /* Entscheidung fuer einen Satz Gruende (der schlechteste zaehlt). */
  function entscheidung(m, gruende) {
    var hell = lum(gruende[0]) > 0.5;
    var k = Math.min.apply(null, gruende.map(function (g) { return kontrast(m.mittel, g); }));
    if (m.eigeneFlaeche) return { art: 'unveraendert', k: null, k_nachher: null, k_mittel: rund(k), grund: 'eigene Flaeche' };   /* der Mittelwert misst hier die Flaeche, nicht das Zeichen */
    var al = anteilLesbar(m._px, gruende);
    if (k >= MINDEST && (hell || al >= 0.9)) return { art: 'unveraendert', k: rund(k), k_nachher: rund(k), anteil_lesbar: rund(al), grund: 'Kontrast reicht' };
    /* v3630f · mehrfarbig auf dunklem Grund: erst die helle Fassung ohne Flaeche
       (dunkle neutrale Teile hell, Farbe bleibt), nur wenn die nicht reicht die Platte */
    if (!hell && m.streuung >= 45 && m._hellAnteil != null && m._hellAnteil >= 0.9) {
      return { art: 'hell-gedreht', k: rund(k), k_nachher: null, anteil_lesbar: rund(al), anteil_nachher: rund(m._hellAnteil), grund: 'mehrfarbig, dunkle Teile hell gedreht' };
    }
    if (m.streuung < 45) {
      var tinte = hell ? TINTE_DUNKEL : [255, 255, 255];
      var kn = Math.min.apply(null, gruende.map(function (g) { return kontrast(tinte, g); }));
      return { art: hell ? 'dunkel' : 'weiss', k: rund(k), k_nachher: rund(kn), grund: 'einfarbig, eingefaerbt' };
    }
    var platte = hell ? PLATTE_DUNKEL : PLATTE_HELL;
    return { art: hell ? 'platte-dunkel' : 'platte-hell', k: rund(k),
             k_nachher: rund(kontrast(m.mittel, platte)), grund: 'mehrfarbig, Platte' };
  }

  function variante(c, e) {
    if (e.art === 'hell-gedreht') return png(hellFassung(c).c);   /* v3630f */
    var o = document.createElement('canvas');
    if (e.art === 'platte-hell' || e.art === 'platte-dunkel') {
      var pad = Math.round(c.height * 0.18), rad = Math.round(c.height * 0.14);
      o.width = c.width + 2 * pad; o.height = c.height + 2 * pad;
      var x = o.getContext('2d');
      var p = e.art === 'platte-hell' ? PLATTE_HELL : PLATTE_DUNKEL;
      x.fillStyle = 'rgb(' + p.join(',') + ')';
      x.beginPath();
      if (x.roundRect) x.roundRect(0, 0, o.width, o.height, rad); else x.rect(0, 0, o.width, o.height);
      x.fill();
      x.drawImage(c, pad, pad);
      return png(o);
    }
    o.width = c.width; o.height = c.height;
    var y = o.getContext('2d');
    y.drawImage(c, 0, 0);
    if (e.art === 'weiss' || e.art === 'dunkel') {
      var t = e.art === 'weiss' ? [255, 255, 255] : TINTE_DUNKEL;
      var id = y.getImageData(0, 0, o.width, o.height), d = id.data;
      for (var i = 0; i < d.length; i += 4) { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; }
      y.putImageData(id, 0, 0);
    }
    return png(o);
  }

  /* ── v3630 · Darstellung auf dunklem Grund, vom Partner gewaehlt ─────────
     Marcel 17.11.2026: „Für dunklen Hintergrund direkt eine passende
     Darstellung." Vier Wege, jeder ein fertiges PNG (Mail und jsPDF kennen
     kein CSS):
       auto         die Kontrastlogik von v3299 (unten in entscheidung())
       weiss        Logo auf weissem, abgerundetem Kasten
       gold         abgerundeter Kasten, innen weiss, duenner Rahmen in der
                    AKZENTFARBE der Marke (Vorbild design/logo/dealpilot-logo-
                    rahmen-512.png). Akzent statt festem DealPilot-Gold: das
                    PNG gehoert dem Partner - ein Partner mit roter Marke
                    bekaeme sonst einen DealPilot-Rahmen. Standard bleibt
                    #C9A84C, solange die Marke kein eigenes Akzent fuehrt.
       gold-dunkel  derselbe Rahmen, innen dunkel, neutrale dunkle Teile des
                    Logos hell gedreht, Farbiges bleibt. Wird nur angeboten,
                    wenn danach >= 90 % der Logo-Pixel 3 : 1 gegen die dunkle
                    Innenflaeche erreichen (sonst ok:false). */
  /* v3630f · 'hell' = hell eingefaerbt, ohne Flaeche (Marcel 17.11.2026: "eine echte
     helle Fassung des Logos fuer dunklen Grund ohne Kasten"). Nur angeboten, wenn
     danach >= 90 % der Logopunkte 3 : 1 auf allen dunklen Gruenden erreichen. */
  var DARSTELLUNGEN = ['auto', 'hell', 'weiss', 'gold', 'gold-dunkel'];
  var INNEN_DUNKEL = [11, 11, 10];
  function hexRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
    if (!m) return [201, 168, 76];
    var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /* Kasten um das Logo: Innenflaeche, optional Rahmen. Masse relativ zur
     Hoehe, damit es bei 36 px (Mail) wie bei 60 px (Leiste) gleich aussieht.
     Rahmen 2,2 % der Gesamthoehe: bei 60 px Anzeige ~1,3 px - duenner
     verschwindet er beim Verkleinern (gemessen am Rahmen-Logo: 2 px auf 158). */
  function kasten(c, innen, rahmen) {
    var pad = Math.round(c.height * 0.2);
    var o = document.createElement('canvas');
    o.width = c.width + 2 * pad; o.height = c.height + 2 * pad;
    var x = o.getContext('2d');
    var rad = Math.round(o.height * 0.16);
    var bw = rahmen ? Math.max(3, Math.round(o.height * 0.022)) : 0;
    var weg = function (inset, r) {
      x.beginPath();
      if (x.roundRect) x.roundRect(inset, inset, o.width - 2 * inset, o.height - 2 * inset, Math.max(0, r));
      else x.rect(inset, inset, o.width - 2 * inset, o.height - 2 * inset);
    };
    if (rahmen) { x.fillStyle = 'rgb(' + rahmen.join(',') + ')'; weg(0, rad); x.fill(); }
    x.fillStyle = 'rgb(' + innen.join(',') + ')'; weg(bw, rad - bw); x.fill();
    x.drawImage(c, pad, pad);
    return o;
  }
  /* v3630f · WEISSE INNENFLAECHEN. Gemessen an Marcels Upload (958 x 589, Grund
     transparent): die Innenraeume von O, D, B, R, P, & und der Punkt im A sind
     DECKEND WEISS - Reste eines Freistellers. Auf Weiss unsichtbar, auf dunklem
     Grund stehen weisse Kleckse in jedem Buchstaben. Das war "die dunkle Version
     wird nicht richtig erstellt": die Kontrastlogik zaehlte Weiss auf Dunkel
     sogar als gut lesbar.
     Regel: nur fuer Fassungen OHNE helle Flaeche dahinter. Zusammenhaengende
     fast weisse Flaechen (alle Kanaele >= 225, kaum Farbe), die NICHT an den
     transparenten Grund grenzen, werden herausgerechnet (Farbe zu Alpha gegen
     Weiss, wie beim Zuschnitt - kein Saum). Weisse Schrift, die frei auf dem
     transparenten Grund steht, grenzt an ihn und bleibt. */
  function innenWeissWeg(c) {
    var W = c.width, H = c.height;
    var o = document.createElement('canvas'); o.width = W; o.height = H;
    var x = o.getContext('2d'); x.drawImage(c, 0, 0);
    var id = x.getImageData(0, 0, W, H), d = id.data, n = W * H;
    var weiss = new Uint8Array(n), komp = new Int32Array(n), q = new Int32Array(n), weg = 0;
    for (var i = 0; i < n; i++) {
      var p = i * 4, r = d[p], g = d[p + 1], b = d[p + 2];
      if (d[p + 3] >= 200 && r >= 225 && g >= 225 && b >= 225 && Math.max(r, g, b) - Math.min(r, g, b) < 24) weiss[i] = 1;
    }
    var nr = 0;
    for (var s0 = 0; s0 < n; s0++) {
      if (!weiss[s0] || komp[s0]) continue;
      nr++; var kopf = 0, fuss = 0, randOffen = false; komp[s0] = nr; q[fuss++] = s0;
      while (kopf < fuss) {
        var j = q[kopf++], px = j % W, py = (j - px) / W;
        var nb = [px > 0 ? j - 1 : -1, px < W - 1 ? j + 1 : -1, py > 0 ? j - W : -1, py < H - 1 ? j + W : -1];
        if (px === 0 || py === 0 || px === W - 1 || py === H - 1) randOffen = true;
        for (var t = 0; t < 4; t++) {
          var k = nb[t]; if (k < 0) continue;
          if (d[k * 4 + 3] < 16) randOffen = true;
          if (weiss[k] && !komp[k]) { komp[k] = nr; q[fuss++] = k; }
        }
      }
      if (randOffen) continue;
      /* Komponente samt 1-px-Kantensaum herausrechnen */
      for (var z = 0; z < fuss; z++) {
        var m0 = q[z];
        [m0, m0 - 1, m0 + 1, m0 - W, m0 + W].forEach(function (k2) {
          if (k2 < 0 || k2 >= n) return;
          var p2 = k2 * 4;
          if (d[p2 + 3] === 0) return;
          var a = Math.max(255 - d[p2], 255 - d[p2 + 1], 255 - d[p2 + 2]) / 255;
          if (a < 0.06) { d[p2 + 3] = 0; return; }
          if (!weiss[k2] && a > 0.5) return;   /* echter Logopunkt am Rand: bleibt */
          for (var c3 = 0; c3 < 3; c3++) d[p2 + c3] = Math.max(0, Math.min(255, Math.round(255 + (d[p2 + c3] - 255) / a)));
          d[p2 + 3] = Math.round(d[p2 + 3] * a);
        });
        weg++;
      }
    }
    x.putImageData(id, 0, 0);
    return { c: o, weg: weg };
  }
  /* Helle Fassung fuer dunklen Grund: Innenweiss weg, dann dunkle neutrale Teile hell. */
  function hellFassung(c) {
    var w0 = innenWeissWeg(c);
    var h = hellGedreht(w0.c, GRUENDE_DUNKEL);
    h.innenWeiss = w0.weg;
    return h;
  }
  /* Neutrale, dunkle Pixel hell drehen (Helligkeit gespiegelt), farbige
     bleiben. Liefert die Kopie und den Anteil lesbarer Pixel. */
  function hellGedreht(c, grund) {
    var o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
    var x = o.getContext('2d'); x.drawImage(c, 0, 0);
    var id = x.getImageData(0, 0, o.width, o.height), d = id.data, n = 0, gut = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 24) continue;
      var r = d[i], g = d[i + 1], b = d[i + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 48) {                       /* neutral (grau/schwarz/weiss) */
        var l = (mx + mn) / 2;
        if (l < 150) { var ziel = 255 - l; var dl = ziel - l; d[i] = Math.min(255, r + dl); d[i + 1] = Math.min(255, g + dl); d[i + 2] = Math.min(255, b + dl); }
      }
      if (d[i + 3] >= 128) {
        n++;
        var gl = (grund && grund[0] && grund[0].length) ? grund : [grund];   /* v3630f · ein Grund oder eine Liste */
        if (Math.min.apply(null, gl.map(function (gg) { return kontrast([d[i], d[i + 1], d[i + 2]], gg); })) >= MINDEST) gut++;
      }
    }
    x.putImageData(id, 0, 0);
    return { c: o, anteil: n ? gut / n : 0 };
  }
  function nachDarstellung(c, art, akzent, eAuto) {
    if (art === 'hell') {   /* v3630f */
      var hf = hellFassung(c);
      return { src: png(hf.c), ok: hf.anteil >= 0.9, anteil: Math.round(hf.anteil * 100) / 100,
        e: { art: 'hell-gedreht', k: null, k_nachher: null, anteil_lesbar: Math.round(hf.anteil * 100) / 100, innen_weiss_px: hf.innenWeiss, grund: 'Darstellung: hell eingefaerbt, ohne Flaeche' } };
    }
    if (art === 'weiss') return { src: png(kasten(c, PLATTE_HELL, null)), ok: true,
      e: { art: 'platte-hell', k: null, k_nachher: rund(kontrast(vermessen(c).mittel, PLATTE_HELL)), grund: 'Darstellung: weisse Flaeche' } };
    if (art === 'gold') return { src: png(kasten(c, PLATTE_HELL, hexRgb(akzent))), ok: true,
      e: { art: 'rahmen-hell', k: null, k_nachher: rund(kontrast(vermessen(c).mittel, PLATTE_HELL)), grund: 'Darstellung: Rahmen in Akzentfarbe, innen hell' } };
    if (art === 'gold-dunkel') {
      var h = hellFassung(c);   /* v3630f · auch hier ohne weisse Innenflaechen */
      return { src: png(kasten(h.c, INNEN_DUNKEL, hexRgb(akzent))), ok: h.anteil >= 0.9, anteil: Math.round(h.anteil * 100) / 100,
        e: { art: 'rahmen-dunkel', k: null, k_nachher: null, anteil_lesbar: Math.round(h.anteil * 100) / 100, grund: 'Darstellung: Rahmen in Akzentfarbe, innen dunkel, Logo hell gedreht' } };
    }
    return { src: variante(c, eAuto), ok: true, e: eAuto };
  }

  /** Alle vier Darstellungen fuer die Auswahl im Portal (Vorschaubilder).
   *  @returns {Promise<{auto,weiss,gold,'gold-dunkel'}>} je {src, ok, e} */
  function darstellungen(src, srcDunkel, akzent) {
    return laden(src).then(function (img) {
      var c = raster(img), m = vermessen(c);
      m._hellAnteil = hellFassung(c).anteil;   /* v3630f */
      var ed = entscheidung(m, GRUENDE_DUNKEL), aus = {};
      DARSTELLUNGEN.forEach(function (a) { aus[a] = nachDarstellung(c, a, akzent, ed); });
      if (!srcDunkel) return aus;
      return laden(srcDunkel).then(function (i2) {
        var c2 = raster(i2);
        aus.auto = { src: png(c2), ok: true, e: { art: 'eigenes Logo' } };
        var gd = nachDarstellung(c2, 'gold-dunkel', akzent, ed);
        /* eigenes dunkles Logo: unveraendert in den dunklen Rahmen */
        aus['gold-dunkel'] = { src: png(kasten(c2, INNEN_DUNKEL, hexRgb(akzent))), ok: true, e: gd.e };
        return aus;
      }, function () { return aus; });
    });
  }

  /* ── v3630 · Zuschneiden beim Hochladen ───────────────────────────────
     Marcel 17.11.2026: „Überschuss wird weggeschnitten, nur das Logo
     bleibt." Und ein weisser, NICHT transparenter Grund wird transparent -
     aber nur, soweit er von den Raendern her zusammenhaengt (Flutfuellung),
     damit weisse Flaechen IM Logo bleiben.
     Kantenglaettung: im gefluteten Bereich wird die Randfarbe nicht hart
     weggestanzt, sondern herausgerechnet (Farbe-zu-Alpha wie GIMP): ein
     Kantenpixel, das zu 60 % Schrift und zu 40 % Weiss war, wird zur
     Schriftfarbe mit 60 % Deckung. Sonst stuende auf dunklem Grund ein
     heller Saum um jeden Buchstaben. */
  var FLUT_TOLERANZ = 150;    /* max. Kanalabstand zur Randfarbe, der noch geflutet wird */
  var RAND_GLEICH = 30;       /* Ecken gelten als eine Farbe bis zu diesem Abstand */
  var MAX_KANTE = 1600;       /* groesste Seite der Arbeitsflaeche */
  function zuschneiden(src) {
    return laden(src).then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, svg = /^data:image\/svg/i.test(src);
      if (!w || !h) { w = 720; h = 240; }
      var f = 1;
      if (svg) f = Math.max(1, 480 / h);                     /* SVG scharf rastern */
      if (w * f > MAX_KANTE || h * f > MAX_KANTE) f = MAX_KANTE / Math.max(w, h);
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * f)); c.height = Math.max(1, Math.round(h * f));
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0, c.width, c.height);
      var W = c.width, H = c.height, id = x.getImageData(0, 0, W, H), d = id.data;
      var info = { vorher: [W, H], randFarbe: null, transparentGemacht: 0, beschnitten: null };
      /* Randfarbe aus den vier Ecken (je 3 x 3 gemittelt) */
      var ecke = function (cx, cy) {
        var s = [0, 0, 0, 0], n = 0;
        for (var yy = Math.max(0, cy - 1); yy <= Math.min(H - 1, cy + 1); yy++)
          for (var xx = Math.max(0, cx - 1); xx <= Math.min(W - 1, cx + 1); xx++) {
            var p = (yy * W + xx) * 4; s[0] += d[p]; s[1] += d[p + 1]; s[2] += d[p + 2]; s[3] += d[p + 3]; n++;
          }
        return s.map(function (v) { return v / n; });
      };
      var ek = [ecke(0, 0), ecke(W - 1, 0), ecke(0, H - 1), ecke(W - 1, H - 1)];
      var transparent = ek.filter(function (e) { return e[3] < 16; }).length;
      var deckend = ek.filter(function (e) { return e[3] > 240; });
      var abst = function (a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); };
      var bg = null;
      if (transparent < 3 && deckend.length >= 3) {
        var mitte = [0, 1, 2].map(function (k) { return deckend.reduce(function (s, e) { return s + e[k]; }, 0) / deckend.length; });
        if (deckend.every(function (e) { return abst(e, mitte) <= RAND_GLEICH; })) bg = mitte;
      }
      if (bg) {
        info.randFarbe = bg.map(Math.round);
        /* Flutfuellung von allen Randpixeln, 4er-Nachbarschaft */
        var drin = new Uint8Array(W * H), q = new Int32Array(W * H), kopf = 0, fuss = 0;
        var passt = function (i) { var p = i * 4; return d[p + 3] < 16 || abst([d[p], d[p + 1], d[p + 2]], bg) <= FLUT_TOLERANZ; };
        var rein = function (i) { if (!drin[i] && passt(i)) { drin[i] = 1; q[fuss++] = i; } };
        for (var xi = 0; xi < W; xi++) { rein(xi); rein((H - 1) * W + xi); }
        for (var yi = 0; yi < H; yi++) { rein(yi * W); rein(yi * W + W - 1); }
        while (kopf < fuss) {
          var i = q[kopf++], px = i % W, py = (i - px) / W;
          if (px > 0) rein(i - 1); if (px < W - 1) rein(i + 1);
          if (py > 0) rein(i - W); if (py < H - 1) rein(i + W);
        }
        /* Farbe zu Alpha im gefluteten Bereich */
        for (var j = 0; j < W * H; j++) {
          if (!drin[j]) continue;
          var p = j * 4, a = 0;
          for (var k = 0; k < 3; k++) {
            var cv = d[p + k], bv = bg[k], ak = Math.abs(cv - bv) / Math.max(48, cv > bv ? 255 - bv : bv);   /* Nenner >= 48: ein Pixel 255 auf Rand 254 ist Rauschen, nicht Deckung (gemessen: sonst weisser Saum) */
            if (ak > a) a = ak;
          }
          if (a < 0.06) { d[p + 3] = 0; info.transparentGemacht++; continue; }
          for (var k2 = 0; k2 < 3; k2++) d[p + k2] = Math.max(0, Math.min(255, Math.round(bg[k2] + (d[p + k2] - bg[k2]) / a)));
          d[p + 3] = Math.round(d[p + 3] * a);
        }
        x.putImageData(id, 0, 0);
      }
      /* Beschnitt: Rechteck der sichtbaren Pixel, 1 px Luft fuer die Kantenglaettung */
      var l = W, t = H, r = -1, b = -1;
      for (var yy2 = 0; yy2 < H; yy2++) for (var xx2 = 0; xx2 < W; xx2++) {
        if (d[(yy2 * W + xx2) * 4 + 3] > 10) { if (xx2 < l) l = xx2; if (xx2 > r) r = xx2; if (yy2 < t) t = yy2; if (yy2 > b) b = yy2; }
      }
      if (r < 0) return { src: src, info: Object.assign(info, { leer: true }) };   /* nichts Sichtbares - Original lassen */
      l = Math.max(0, l - 1); t = Math.max(0, t - 1); r = Math.min(W - 1, r + 1); b = Math.min(H - 1, b + 1);
      info.beschnitten = [l, t, W - 1 - r, H - 1 - b];
      var aus = function (fak) {
        var o = document.createElement('canvas');
        o.width = Math.max(1, Math.round((r - l + 1) * fak)); o.height = Math.max(1, Math.round((b - t + 1) * fak));
        var ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
        ox.drawImage(c, l, t, r - l + 1, b - t + 1, 0, 0, o.width, o.height);
        return o.toDataURL('image/png');
      };
      var fak = 1, png = aus(fak);
      /* Backend nimmt hoechstens 400.000 Zeichen - lieber kleiner rechnen als scheitern */
      while (png.length > 380000 && fak > 0.2) { fak *= 0.75; png = aus(fak); }
      info.nachher = [Math.round((r - l + 1) * fak), Math.round((b - t + 1) * fak)];
      return { src: png, info: info };
    });
  }

  /** Beide Varianten und die Messung.
   *  @param {string} src        Logo (Data-URL, PNG/SVG/JPG)
   *  @param {string} srcDunkel  optional: eigenes Logo fuer dunklen Grund
   *  @param {object} opt        v3630: {darstellung: 'auto'|'weiss'|'gold'|'gold-dunkel', akzent: '#hex'}
   *  @returns {Promise<{auf_dunkel:string, auf_hell:string, messung:object}>} */
  function varianten(src, srcDunkel, opt) {
    opt = opt || {};
    var art = DARSTELLUNGEN.indexOf(opt.darstellung) >= 0 ? opt.darstellung : 'auto';
    return laden(src).then(function (img) {
      var c = raster(img);
      var m = vermessen(c);
      m._hellAnteil = hellFassung(c).anteil;   /* v3630f */
      var eh = entscheidung(m, [GRUND_HELL]);
      var ed = entscheidung(m, GRUENDE_DUNKEL);
      var hell = variante(c, eh);
      var fertig = function (dunkel, eDunkel, mDunkel) {
        return {
          auf_dunkel: dunkel, auf_hell: hell,
          messung: {
            fassung: 'v3630f', mittel: m.mittel, streuung: m.streuung, eigeneFlaeche: m.eigeneFlaeche,
            darstellung: art,
            hell: eh, dunkel: eDunkel, logo_dunkel: mDunkel || null, gemessen: new Date().toISOString()
          }
        };
      };
      /* v3630 · gewaehlte Darstellung (nicht auto): fertiges PNG fuer dunklen Grund */
      if (art !== 'auto') {
        if (art === 'gold-dunkel' && srcDunkel) {
          return laden(srcDunkel).then(function (i2) {
            var c2 = raster(i2);
            return fertig(png(kasten(c2, INNEN_DUNKEL, hexRgb(opt.akzent))),
              { art: 'rahmen-dunkel', k: null, k_nachher: null, grund: 'Darstellung: Rahmen, eigenes Logo fuer dunklen Grund' }, null);
          }, function () { var g = nachDarstellung(c, art, opt.akzent, ed); return fertig(g.src, g.e, null); });
        }
        var g = nachDarstellung(c, art, opt.akzent, ed);
        return fertig(g.src, g.e, null);
      }
      if (!srcDunkel) return fertig(variante(c, ed), ed, null);
      /* Das eigene Logo fuer dunklen Grund hat Vorrang - unveraendert,
         aber vermessen, damit das Portal die Ampel zeigen kann. */
      return laden(srcDunkel).then(function (i2) {
        var c2 = raster(i2), m2 = vermessen(c2);
        var k2 = Math.min.apply(null, GRUENDE_DUNKEL.map(function (g) { return kontrast(m2.mittel, g); }));
        var e2 = { art: 'eigenes Logo', k: rund(m2.eigeneFlaeche ? null : k2), k_nachher: rund(m2.eigeneFlaeche ? null : k2),
                   grund: m2.eigeneFlaeche ? 'eigene Flaeche' : 'eigenes Logo fuer dunklen Grund' };
        return fertig(png(c2), e2, { mittel: m2.mittel, streuung: m2.streuung, eigeneFlaeche: m2.eigeneFlaeche });
      }, function () { return fertig(variante(c, ed), ed, null); });
    });
  }

  /* Hintergrund eines Elements: erster Vorfahr mit deckender Farbe. */
  function grundVon(el) {
    var a = el;
    while (a && a.nodeType === 1) {
      var c = getComputedStyle(a).backgroundColor || '';
      var m = c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        var p = m[1].split(',').map(function (s) { return parseFloat(s); });
        if (p.length < 4 || p[3] > 0.5) return [p[0], p[1], p[2]];
      }
      a = a.parentElement;
    }
    return [255, 255, 255];
  }
  function istDunkel(rgb) { return lum(rgb) < 0.18; }

  window.DealPilotLogoKontrast = {
    varianten: varianten,
    zuschneiden: zuschneiden,          /* v3630 */
    darstellungen: darstellungen,      /* v3630 */
    DARSTELLUNGEN: DARSTELLUNGEN,      /* v3630 */
    kontrast: kontrast,
    lum: lum,
    grundVon: grundVon,
    istDunkel: istDunkel,
    MINDEST: MINDEST
  };
})();
