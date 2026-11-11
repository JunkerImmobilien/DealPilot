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
  var ZIEL_H = 240;            /* Rasterhoehe der Varianten in px (PDF 36 mm ~ 170 dpi) */

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
    return {
      mittel: mt.map(Math.round), streuung: Math.round(st * 10) / 10,
      eigeneFlaeche: ecken >= 3, deckend: Math.round(n / (c.width * c.height) * 100) / 100
    };
  }

  /* Entscheidung fuer einen Satz Gruende (der schlechteste zaehlt). */
  function entscheidung(m, gruende) {
    var hell = lum(gruende[0]) > 0.5;
    var k = Math.min.apply(null, gruende.map(function (g) { return kontrast(m.mittel, g); }));
    if (m.eigeneFlaeche) return { art: 'unveraendert', k: rund(k), k_nachher: rund(k), grund: 'eigene Flaeche' };
    if (k >= MINDEST) return { art: 'unveraendert', k: rund(k), k_nachher: rund(k), grund: 'Kontrast reicht' };
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
      return o.toDataURL('image/png');
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
    return o.toDataURL('image/png');
  }

  /** Beide Varianten und die Messung.
   *  @param {string} src        Logo (Data-URL, PNG/SVG/JPG)
   *  @param {string} srcDunkel  optional: eigenes Logo fuer dunklen Grund
   *  @returns {Promise<{auf_dunkel:string, auf_hell:string, messung:object}>} */
  function varianten(src, srcDunkel) {
    return laden(src).then(function (img) {
      var c = raster(img);
      var m = vermessen(c);
      var eh = entscheidung(m, [GRUND_HELL]);
      var ed = entscheidung(m, GRUENDE_DUNKEL);
      var hell = variante(c, eh);
      var fertig = function (dunkel, eDunkel, mDunkel) {
        return {
          auf_dunkel: dunkel, auf_hell: hell,
          messung: {
            fassung: 'v3299', mittel: m.mittel, streuung: m.streuung, eigeneFlaeche: m.eigeneFlaeche,
            hell: eh, dunkel: eDunkel, logo_dunkel: mDunkel || null, gemessen: new Date().toISOString()
          }
        };
      };
      if (!srcDunkel) return fertig(variante(c, ed), ed, null);
      /* Das eigene Logo fuer dunklen Grund hat Vorrang - unveraendert,
         aber vermessen, damit das Portal die Ampel zeigen kann. */
      return laden(srcDunkel).then(function (i2) {
        var c2 = raster(i2), m2 = vermessen(c2);
        var k2 = Math.min.apply(null, GRUENDE_DUNKEL.map(function (g) { return kontrast(m2.mittel, g); }));
        var e2 = { art: 'eigenes Logo', k: rund(m2.eigeneFlaeche ? null : k2), k_nachher: rund(m2.eigeneFlaeche ? null : k2),
                   grund: m2.eigeneFlaeche ? 'eigene Flaeche' : 'eigenes Logo fuer dunklen Grund' };
        return fertig(c2.toDataURL('image/png'), e2, { mittel: m2.mittel, streuung: m2.streuung, eigeneFlaeche: m2.eigeneFlaeche });
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
    kontrast: kontrast,
    lum: lum,
    grundVon: grundVon,
    istDunkel: istDunkel,
    MINDEST: MINDEST
  };
})();
