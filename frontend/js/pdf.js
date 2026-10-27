'use strict';

/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN - pdf.js V5.0
   Professioneller 7-seitiger Investment Case
   Seiten: 1=Deckblatt 2=Executive Summary 3=Objekt&Finanzierung
           4=Cashflow-Tabelle 5=KI-Analyse 6=Annahmen 7=Kontakt&QR
═══════════════════════════════════════════════════ */

/* v2240 · Ampel-Schwellen fuer DSCR und LTV aus den Einstellungen
   (DealPilotSchwellen; Vorgabe DSCR gruen ab 1,2 / gelb ab 1,0,
   LTV gruen bis 90 / gelb bis 100). EINE Quelle fuer alle Seiten. */
function _pdfSw() {
  var s = window.DealPilotSchwellen ? DealPilotSchwellen.get()
    : { dscrGruen: 1.2, dscrGelb: 1.0, ltvGruen: 90, ltvRot: 100 };
  s.dscrGruenTxt = Number(s.dscrGruen).toFixed(2).replace(/0$/, '').replace('.', ',');
  s.dscrGelbTxt  = Number(s.dscrGelb).toFixed(2).replace(/0$/, '').replace('.', ',');
  s.ltvGruenTxt  = String(Math.round(Number(s.ltvGruen) * 10) / 10).replace('.', ',');
  s.ltvRotTxt    = String(Math.round(Number(s.ltvRot) * 10) / 10).replace('.', ',');
  return s;
}

/* ═══════════════════════════════════════════════════
   V63.86: html2canvas-Hybrid für 1:1-Tabellen-Capture
   Marcels Wunsch: Tab-Kennzahlen-Tabellen sollen pixel-perfekt
   ins PDF. Wir capturen die DOM-Elemente als hochauflösendes
   Bild und embedden sie ins jsPDF-Doc.
═══════════════════════════════════════════════════ */
async function _captureElementAsImage(elemId, opts) {
  opts = opts || {};
  var scale = opts.scale || 2;  // V63.88: default 2 bleibt, aber Aufrufer kann 1.5 wählen
  var maxWidth = opts.maxWidth || null;
  var format = (opts.format || 'png').toLowerCase();
  var quality = opts.quality != null ? opts.quality : (format === 'jpeg' ? 0.85 : 0.95);

  if (typeof window.html2canvas !== 'function') {
    console.warn('[pdf] html2canvas nicht geladen — Fallback nötig');
    return null;
  }
  var elem = document.getElementById(elemId);
  if (!elem) {
    console.warn('[pdf] Element nicht gefunden:', elemId);
    return null;
  }

  // Sicherstellen dass Element sichtbar ist (parent-Tab muss aktiv sein, sonst leere Capture)
  // Wir holen den nächst-höheren .sec-Container und aktivieren ihn temporär
  var secAncestor = elem.closest('.sec');
  var prevDisplay = null, prevActive = false, prevSecHidden = false;
  if (secAncestor) {
    prevActive = secAncestor.classList.contains('active');
    prevSecHidden = secAncestor.classList.contains('sec-hidden');
    if (!prevActive) {
      secAncestor.classList.remove('sec-hidden');
      secAncestor.classList.add('active');
      secAncestor.style.display = 'block';
      // Kurze Frame-Pause damit Layout/Reflow durch ist
      await new Promise(function(r){ setTimeout(r, 50); });
    }
  }

  try {
    var canvas = await window.html2canvas(elem, {
      scale: scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      // Sehr breite Tabellen ggf. schmaler machen
      windowWidth: elem.scrollWidth,
      width: elem.scrollWidth,
      height: elem.scrollHeight
    });
    // V63.88: JPEG-Format spart ~5x Bytes vs. PNG (PDF von 45 MB → 5 MB)
    var mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    var dataUrl = canvas.toDataURL(mime, quality);
    return {
      dataUrl: dataUrl,
      width:   canvas.width,
      height:  canvas.height,
      aspectRatio: canvas.width / canvas.height,
      format:  format
    };
  } catch (e) {
    console.warn('[pdf] html2canvas-Capture fehlgeschlagen für', elemId, e);
    return null;
  } finally {
    // Tab-State zurücksetzen
    if (secAncestor && !prevActive) {
      secAncestor.classList.remove('active');
      if (prevSecHidden) secAncestor.classList.add('sec-hidden');
      secAncestor.style.display = '';
    }
  }
}

// Asset-Cache
var _ASSETS = { logo: null, logoQuer: null, logoSidebar: null, qr: null, google: null, loaded: false };
// Photo metadata cache (aspect ratios)
var _PHOTO_META = [];

async function loadAssets() {
  if (_ASSETS.loaded) return;
  var files = [
    /* v1634 · HIER STAND `assets/dealpilot_logo.png` - MIT UNTERSTRICH.
       Die Datei gibt es nicht; sie heisst `dealpilot-logo-rahmen-hell.png`.
       Der Fehlgriff blieb jahrelang unsichtbar, weil die App auf JEDEN
       Pfad mit 200 antwortet und die index.html liefert: das <img> bekam
       HTML, loeste `onerror` aus, und `_getBrandingLogo()` gab still
       `null` zurueck. **Das DealPilot-Logo stand auf keinem PDF.**
       Ein 200 ist kein Nachweis - nur der Inhaltstyp ist einer.
       Variante "hell" = schwarze Plakette, lesbar auf weissem Bogen.
       Siehe `js/pdf-logo.js` fuer die Begruendung der Auswahl. */
    { key: 'logoDealpilot', path: (window.DealPilotPdfLogo && window.DealPilotPdfLogo.pfad) || 'assets/dealpilot-logo-rahmen-hell.png' }
  ];
  await Promise.all(files.map(function(f) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          _ASSETS[f.key] = canvas.toDataURL('image/png');
          // Cache natural size for proportional rendering
          _logoSizeCache[_ASSETS[f.key]] = { w: img.naturalWidth, h: img.naturalHeight };
        } catch(e) {}
        resolve();
      };
      img.onerror = function() { resolve(); };
      img.src = f.path;
    });
  }));
  _ASSETS.loaded = true;
}
// Branding-Helpers - delegieren an zentrale Config (config.js)
function _getBranding() {
  if (window.DealPilotConfig && DealPilotConfig.branding) return DealPilotConfig.branding.get();
  // Fallback minimal
  return { product_name: 'DealPilot', company: 'DealPilot', name: '', role: '',
           address: '', plz: '', city: '', phone: '', email: '', website: '', logo_b64: '' };
}
function _formatBrandingFooter(b, sep) {
  if (window.DealPilotConfig && DealPilotConfig.branding) return DealPilotConfig.branding.formatFooter(b, sep);
  // Minimal fallback
  return b.company || '';   /* v1632 · kein Ersatzabsender */
}
// Logo: Custom-Logo aus Settings hat Vorrang, sonst geladenes DealPilot-Logo
function _getBrandingLogo() {
  var b = _getBranding();
  return b.logo_b64 || _ASSETS.logoDealpilot || null;
}
// Proportionale Maße berechnen - Logo nicht verzerren
function _getLogoSize(imgB64, maxWidth, maxHeight) {
  if (!imgB64) return { w: maxWidth, h: maxHeight };
  if (!_logoSizeCache) _logoSizeCache = {};
  if (_logoSizeCache[imgB64]) return _fitProportional(_logoSizeCache[imgB64], maxWidth, maxHeight);
  // Try sync via offscreen image (works because data: urls are decoded immediately when set)
  try {
    var img = new Image();
    img.src = imgB64;
    if (img.complete && img.naturalWidth > 0) {
      _logoSizeCache[imgB64] = { w: img.naturalWidth, h: img.naturalHeight };
      return _fitProportional(_logoSizeCache[imgB64], maxWidth, maxHeight);
    }
  } catch (e) {}
  // Fallback: typische DealPilot-Aspect-Ratio
  var aspect = 2.5;
  var byW = { w: maxWidth, h: maxWidth / aspect };
  if (byW.h <= maxHeight) return byW;
  return { w: maxHeight * aspect, h: maxHeight };
}
var _logoSizeCache = {};
function _fitProportional(natural, maxW, maxH) {
  var aspect = natural.w / natural.h;
  var byW = { w: maxW, h: maxW / aspect };
  if (byW.h <= maxH) return byW;
  return { w: maxH * aspect, h: maxH };
}
// Backwards compat
function _getUserContact() { return _getBranding(); }
function _formatContact(c, sep) { return _formatBrandingFooter(c, sep); }
window._getUserContact = _getUserContact;
window._formatContact  = _formatContact;
window._getBranding    = _getBranding;
window._getBrandingLogo = _getBrandingLogo;

// Wasserzeichen für Free-Plan (auf jeder Seite diagonal)
function _applyWatermarkIfFree(doc, W) {
  try {
    /* TR7-trial: Das Wasserzeichen hing am PLAN-SCHLUESSEL ("planKey !== free").
       Waehrend der 7-Tage-Testphase ist der Schluessel 'pro' — das Wasserzeichen
       waere komplett ausgefallen. Jetzt entscheidet das LIMIT plus der
       Trial-Zustand. Bezahlte Plaene bleiben unveraendert sauber. */
    if (doc.__dpWmDone) return;          // Doppel-Stempel verhindern
    var _isTrial = false;
    try { _isTrial = (typeof Sub !== 'undefined' && Sub.isTrial && Sub.isTrial()); }
    catch (e) {}
    var limits = (window.DealPilotConfig && DealPilotConfig.pricing
                    ? DealPilotConfig.pricing.current().limits : { watermark: true });
    if (limits.watermark === false && !_isTrial) return;
    doc.__dpWmDone = true;
    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.saveGraphicsState && doc.saveGraphicsState();
      try {
        // V63.5: Wasserzeichen DEUTLICH sichtbarer (vorher fast unsichtbar bei Opacity 0.10)
        // Mehrfaches Wasserzeichen über die Seite verteilt + höhere Opazität
        if (doc.setGState && doc.GState) {
          doc.setGState(new doc.GState({ opacity: 0.18 }));
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(72);
        doc.setTextColor(120, 120, 120);
        // Drei Wasserzeichen auf der Seite verteilt (oben, Mitte, unten) - 30° gedreht
        /* TR7-trial: Text folgt dem Zustand. Waehrend der Testphase ist
           "DealPilot Free" schlicht falsch. _pn() respektiert Whitelabel. */
        var _wmTxt = (typeof _pn === 'function' ? _pn() : 'DealPilot') +
                     (_isTrial ? ' Testphase' : ' Free');
        doc.text(_wmTxt, W / 2, 80,  { align: 'center', angle: 30 });
        doc.text(_wmTxt, W / 2, 165, { align: 'center', angle: 30 });
        doc.text(_wmTxt, W / 2, 250, { align: 'center', angle: 30 });
      } catch(e) {}
      doc.restoreGraphicsState && doc.restoreGraphicsState();
    }
  } catch(e) { console.warn('Watermark failed:', e.message); }
}
window._applyWatermarkIfFree = _applyWatermarkIfFree;

/* ── TR7-trial: EINE Quelle statt neun Kopien ──────────────────────────────
   Von zehn PDF-Erzeugern trugen nur drei ein Wasserzeichen (pdf.js + 2x
   storage.js). BMF-Anlage, Track-Record, Werbungskosten, Selbstauskunft,
   RnD und Marktbericht gingen sauber raus — obwohl die Preistabelle seit
   Monaten "Wasserzeichen" verspricht.
   Statt sechs Einzeleingriffe (und jeder kuenftige PDF-Pfad waere wieder
   vergessen worden): einmal an jsPDF.prototype.save haengen.
   Der Doppel-Stempel-Schutz sitzt in _applyWatermarkIfFree (__dpWmDone),
   die bestehenden expliziten Aufrufe bleiben also gefahrlos stehen.
   Reseller-PDFs sind automatisch aussen vor: Partner hat watermark:false
   und nie einen Trial. */
(function _dpArmWatermarkHook() {
  var tries = 0;
  function arm() {
    tries++;
    try {
      if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.prototype) {
        var P = window.jspdf.jsPDF.prototype;
        if (!P.__dpWmHook) {
          var _origSave = P.save;
          P.save = function () {
            try {
              var w = 210;
              try { w = this.internal.pageSize.getWidth(); } catch (e) {}
              _applyWatermarkIfFree(this, w);
            } catch (e) {}
            return _origSave.apply(this, arguments);
          };
          P.__dpWmHook = true;
        }
        return true;
      }
    } catch (e) {}
    if (tries < 40) setTimeout(arm, 250);   // jsPDF laedt evtl. spaeter
    return false;
  }
  arm();
})();

/* W3-nodp: Bei Whitelabel darf "DealPilot" nicht neben dem Reseller-Namen stehen.
   Eine Kanzlei zahlt fuer die eigene Marke — _pn() liefert den Produktnamen. */
function _pn() {
  try {
    var b = _getBranding();
    if (b && b.is_custom && b.product_name) return b.product_name;
  } catch (e) {}
  return 'DealPilot';
}
window._pn = _pn;



// V182: Fotos beim Laden auf vernünftige Größe runter-resampeln, damit das
// resultierende Investment-PDF nicht 40+ MB groß wird (war oft >Multer-10MB-
// Limit + meist >Mail-Anhangs-Limit von alfahosting/Empfänger).
// Strategie: Längsseite auf MAX_DIM px begrenzen, JPEG q=PHOTO_QUALITY.
// Original-User-Daten (im Objekt-Modell) bleiben unangetastet — wir resampeln
// nur die KOPIE, die später ins PDF embedded wird (`_PHOTO_META[i].src`).
var PHOTO_MAX_DIM = 1600;     // Längsseite in px
var PHOTO_QUALITY = 0.82;     // JPEG-Quality (0..1)

function _resamplePhotoForPdf(srcUrl) {
  return new Promise(function(resolve) {
    var im = new Image();
    im.onload = function() {
      var w = im.naturalWidth;
      var h = im.naturalHeight;
      // Wenn schon klein genug → unverändert zurückgeben (vermeidet
      // Re-Encoding-Verlust für bereits passende Fotos).
      if (w <= PHOTO_MAX_DIM && h <= PHOTO_MAX_DIM) {
        return resolve({ src: srcUrl, w: w, h: h, ratio: w / h, resampled: false });
      }
      var scale = (w >= h) ? (PHOTO_MAX_DIM / w) : (PHOTO_MAX_DIM / h);
      var tw = Math.round(w * scale);
      var th = Math.round(h * scale);
      try {
        var canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        var ctx = canvas.getContext('2d');
        // Bessere Skalierungs-Qualität
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(im, 0, 0, tw, th);
        var dataUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
        resolve({ src: dataUrl, w: tw, h: th, ratio: tw / th, resampled: true });
      } catch (e) {
        console.warn('[pdf] Photo-Resampling fehlgeschlagen, nutze Original', e.message);
        resolve({ src: srcUrl, w: w, h: h, ratio: w / h, resampled: false });
      }
    };
    im.onerror = function() {
      resolve({ src: srcUrl, w: 1, h: 1, ratio: 1, resampled: false });
    };
    im.src = srcUrl;
  });
}

// Lade Metadaten (Dimensionen) für alle User-Fotos
async function loadPhotoMeta() {
  _PHOTO_META = [];
  if (!imgs || !imgs.length) return;
  // V182: parallel resampeln statt nur Dimensionen messen
  await Promise.all(imgs.map(function(img, i) {
    return _resamplePhotoForPdf(img.src).then(function(meta) {
      _PHOTO_META[i] = meta;
    });
  }));
  // Diagnostic log — hilft bei Debugging "warum ist die PDF so groß"
  try {
    var orig = 0, after = 0;
    _PHOTO_META.forEach(function(m, i) {
      // grobe Schätzung Base64-Bytes: length * 3/4
      var bytes = (m.src && m.src.length) ? Math.round(m.src.length * 0.75) : 0;
      after += bytes;
      if (m.resampled) {
        orig += imgs[i] && imgs[i].src ? Math.round(imgs[i].src.length * 0.75) : 0;
      } else {
        orig += bytes;
      }
    });
    console.log('[pdf] Photos: ' + _PHOTO_META.length + ' fotos · '
      + (orig/1024/1024).toFixed(1) + ' MB → '
      + (after/1024/1024).toFixed(1) + ' MB nach Resampling');
  } catch (e) {}
}

// Zeichne ein Foto proportional korrekt in einen Container
// containerW/H = max. Breite/Höhe; Foto wird zentriert und behält Aspect Ratio
function drawPhotoFit(doc, photoMeta, containerX, containerY, containerW, containerH, bgColor) {
  if (!photoMeta || !photoMeta.src) {
    console.warn('drawPhotoFit: kein photoMeta oder src', photoMeta);
    return;
  }
  var containerRatio = containerW / containerH;
  var w, h, x, y;
  if (photoMeta.ratio > containerRatio) {
    // Foto ist breiter -> Breite füllen, Höhe anpassen
    w = containerW;
    h = containerW / photoMeta.ratio;
    x = containerX;
    y = containerY + (containerH - h) / 2;
  } else {
    // Foto ist höher oder gleich -> Höhe füllen, Breite anpassen
    h = containerH;
    w = containerH * photoMeta.ratio;
    x = containerX + (containerW - w) / 2;
    y = containerY;
  }
  // Optional: Hintergrund für den Container
  if (bgColor) {
    doc.setFillColor.apply(doc, bgColor);
    doc.rect(containerX, containerY, containerW, containerH, 'F');
  }
  // V40: Format aus DataURL ablesen statt blind JPEG zu probieren
  var src = photoMeta.src;
  var format = 'JPEG';      // jspdf default fallback
  var m = /^data:image\/(jpe?g|png|webp|gif);base64,/i.exec(src);
  if (m) {
    var ext = m[1].toLowerCase();
    if (ext === 'png') format = 'PNG';
    else if (ext === 'webp') format = 'WEBP';
    else if (ext === 'gif') format = 'GIF';
    else format = 'JPEG';
  }
  try {
    doc.addImage(src, format, x, y, w, h);
  } catch(e) {
    console.warn('drawPhotoFit: addImage als ' + format + ' fehlgeschlagen, versuche Konvertierung', e.message);
    // Fallback: über Canvas zu PNG konvertieren
    try {
      var canvas = document.createElement('canvas');
      var img = new Image();
      img.src = src;
      // synchron - funktioniert nur wenn Bild bereits decodiert (sollte via loadPhotoMeta der Fall sein)
      if (img.complete && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        var pngSrc = canvas.toDataURL('image/png');
        doc.addImage(pngSrc, 'PNG', x, y, w, h);
      } else {
        console.warn('drawPhotoFit: Bild noch nicht decodiert für Fallback-Konvertierung');
      }
    } catch(e2) {
      console.error('drawPhotoFit: auch Fallback fehlgeschlagen', e2.message);
    }
  }
}


/* v2830 · ZUSCHNITT STATT RAHMEN
   Marcel 22.10.2026: „Im PDF im hellen Modus ist bei dem eingefügten Bild
   links und rechts ein schwarzer Rahmen." Gemessen (Westerfeldstr. 140,
   Hochformat 0,75): drawPhotoFit setzte das Foto proportional in den
   Rahmen 180 x 58 mm (3,1 : 1) und füllte den Rest mit [30, 27, 27] -
   auf dem dunklen Deckblatt unsichtbar, auf dem hellen zwei schwarze
   Balken von je 54 mm.
   Jetzt: das Foto wird auf ein Verhältnis ZWISCHEN seinem eigenen und dem
   des Rahmens zugeschnitten (nie verzerrt, senkrecht bei 40 % - oben steht
   das Haus), und der Rest bleibt Papier. Eine Füllung gibt es nur noch auf
   dunklem Grund. */
/* verlust: hoechstens dieser Anteil der Hoehe bzw. Breite wird abgeschnitten */
function _fotoZuschnitt(meta, ziel, verlust) {
  return new Promise(function (fertig) {
    if (!meta || !meta.src || !meta.ratio) return fertig(meta);
    var zr = (meta.ratio < ziel) ? Math.min(ziel, meta.ratio / (1 - verlust)) : Math.max(ziel, meta.ratio * (1 - verlust));
    if (Math.abs(zr - meta.ratio) < 0.01) return fertig(meta);
    var im = new Image();
    im.onload = function () {
      try {
        var w = im.naturalWidth, h = im.naturalHeight, sw = w, sh = h;
        if (w / h > zr) sw = Math.round(h * zr); else sh = Math.round(w / zr);
        var c = document.createElement('canvas'); c.width = sw; c.height = sh;
        var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(im, (w - sw) / 2, (h - sh) * 0.4, sw, sh, 0, 0, sw, sh);
        fertig({ src: c.toDataURL('image/jpeg', 0.86), w: sw, h: sh, ratio: sw / sh, resampled: true });
      } catch (e) { fertig(meta); }
    };
    im.onerror = function () { fertig(meta); };
    im.src = meta.src;
  });
}

// Capture a canvas chart as PNG dataURL for embedding in PDF
function captureChart(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  try {
    return canvas.toDataURL('image/png', 1.0);
  } catch(e) {
    return null;
  }
}

/**
 * V63.67: SVG-Container (Bank-Charts) als PNG-DataURL holen.
 * Async - gibt eine Promise<dataUrl|null> zurück.
 * hostId = 'bc-equity' | 'bc-cockpit' | 'bc-waterfall' | 'bc-stress'
 */
function captureBankChartSvg(hostId, scale) {
  return new Promise(function(resolve) {
    try {
      var host = document.getElementById(hostId);
      if (!host) {
        console.warn('[pdf-svg] host nicht gefunden: ' + hostId);
        return resolve(null);
      }
      // V63.71: Cockpit/Stress haben MEHRERE SVGs (Trend-Icons, Häkchen, Mini-Trends)
      // - wir holen das GRÖSSTE SVG (das ist der eigentliche Chart).
      var allSvgs = host.querySelectorAll('svg');
      if (!allSvgs || !allSvgs.length) {
        console.warn('[pdf-svg] kein <svg> in: ' + hostId);
        return resolve(null);
      }
      var svg = allSvgs[0];
      var bestArea = 0;
      for (var s = 0; s < allSvgs.length; s++) {
        var c = allSvgs[s];
        var vb = c.getAttribute('viewBox');
        var w = 0, h = 0;
        if (vb) {
          var p = vb.split(/\s+/);
          w = parseFloat(p[2]) || 0;
          h = parseFloat(p[3]) || 0;
        } else {
          w = c.clientWidth || 0;
          h = c.clientHeight || 0;
        }
        var area = w * h;
        if (area > bestArea) {
          bestArea = area;
          svg = c;
        }
      }
      console.log('[pdf-svg] ' + hostId + ': ' + allSvgs.length + ' SVGs gefunden, gewählt area=' + bestArea);

      scale = scale || 2;
      var clone = svg.cloneNode(true);
      if (!clone.getAttribute('viewBox')) {
        clone.setAttribute('viewBox', '0 0 ' + (svg.clientWidth || 1200) + ' ' + (svg.clientHeight || 380));
      }
      var vb = clone.getAttribute('viewBox').split(/\s+/);
      var w = parseFloat(vb[2]);
      var h = parseFloat(vb[3]);
      clone.setAttribute('width', w);
      clone.setAttribute('height', h);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      // V63.69: filter-Defs, filter-Attribute, foreignObject entfernen
      var filters = clone.querySelectorAll('filter');
      for (var fi = 0; fi < filters.length; fi++) {
        if (filters[fi].parentNode) filters[fi].parentNode.removeChild(filters[fi]);
      }
      var allElements = clone.querySelectorAll('[filter]');
      for (var ei = 0; ei < allElements.length; ei++) {
        allElements[ei].removeAttribute('filter');
      }
      var fos = clone.querySelectorAll('foreignObject');
      for (var fj = 0; fj < fos.length; fj++) {
        if (fos[fj].parentNode) fos[fj].parentNode.removeChild(fos[fj]);
      }
      // Externe Fonts ersetzen (Google Fonts werden in img-decode nicht geladen)
      /* v2463 · gemessen: die Diagrammschrift im Investment-PDF war Times - die
         Schrift steht im Wasserfall an der Gruppe (<g font-family="DM Sans">), nicht
         am <text>, und Texte ohne Angabe erbten die Bildvorgabe (Serifen). Darum
         jedes Element mit font-family umsetzen und an der Wurzel eine Sans setzen. */
      if (!clone.getAttribute('font-family')) clone.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
      var allTexts = clone.querySelectorAll('[font-family]');
      for (var ti = 0; ti < allTexts.length; ti++) {
        var t = allTexts[ti];
        var ff = t.getAttribute('font-family') || '';
        if (/Cormorant/i.test(ff)) {
          t.setAttribute('font-family', 'Georgia, "Times New Roman", serif');
        } else if (/DM Sans/i.test(ff)) {
          t.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
        }
      }

      // V63.71: Inline-Style-Attribute mit url(#...) raus, externer CSS-Stylesheet wird nicht geladen
      // Stattdessen: alle CSS-classes raus und auf wesentliche Attribute reduzieren
      var serializer = new XMLSerializer();
      var svgString = serializer.serializeToString(clone);

      // V63.71: Sicherstellen dass XML-Header drin ist
      if (!svgString.indexOf('<?xml') === 0) {
        svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
      }

      // V63.71: Blob-URL als robusterer Pfad - funktioniert in mehr Browsern als data:
      var blob;
      try {
        blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      } catch(e) {
        // Fallback auf data-URL
        var dataURL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        return _imgFromUrl(dataURL, w, h, scale, hostId, resolve);
      }
      var blobUrl = URL.createObjectURL(blob);
      _imgFromUrl(blobUrl, w, h, scale, hostId, function(result) {
        try { URL.revokeObjectURL(blobUrl); } catch(_) {}
        resolve(result);
      });
    } catch(e) {
      console.warn('[pdf-svg] Setup-Fehler für ' + hostId + ':', e.message);
      resolve(null);
    }
  });
}

// V63.71: Helper - lädt URL als Image, prüft naturalWidth>0, malt auf Canvas
// V184: Output ist jetzt JPEG (q=0.85) statt PNG. Charts haben keine Transparenz
// und jsPDF embedded PNG-Streams oft unkomprimiert (RGB raw, kein PNG-Filter),
// was die PDF dramatisch aufbläht (5+ MB pro Chart). JPEG wird zuverlässig als
// DCTDecode embedded → ~100-400 KB statt 5 MB pro Chart.
function _imgFromUrl(url, w, h, scale, hostId, cb) {
  var img = new Image();
  // Crossorigin nicht setzen für Blob-URLs (würde tainten)
  img.onload = function() {
    try {
      // V63.71: Validierung - wenn Decode fehlgeschlagen ist, bekommt Image kein naturalWidth
      if (!img.naturalWidth || !img.naturalHeight) {
        console.warn('[pdf-svg] ' + hostId + ': Image geladen aber naturalWidth=' + img.naturalWidth);
        return cb(null);
      }
      var canvas = document.createElement('canvas');
      canvas.width  = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FAFAF7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        // V184: JPEG q=0.85 statt PNG
        var jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
        // V63.71: Validierung - wenn dataURL zu kurz (= leer/grau), abbrechen
        if (!jpegUrl || jpegUrl.length < 1500) {
          console.warn('[pdf-svg] ' + hostId + ': JPEG-DataURL zu kurz (len=' + (jpegUrl||'').length + ')');
          return cb(null);
        }
        // mimeType im Result mitgeben — Caller addImage()-Aufrufe wissen so,
        // dass sie 'JPEG' statt 'PNG' verwenden müssen
        cb({ dataUrl: jpegUrl, width: w, height: h, mimeType: 'JPEG' });
      } catch(taintErr) {
        console.warn('[pdf-svg] ' + hostId + ': Canvas tainted: ' + taintErr.message);
        cb(null);
      }
    } catch(e) {
      console.warn('[pdf-svg] ' + hostId + ': Render-Fehler: ' + e.message);
      cb(null);
    }
  };
  img.onerror = function() {
    console.warn('[pdf-svg] ' + hostId + ': onerror getriggert');
    cb(null);
  };
  img.src = url;
}

/* ── FARBEN ─────────────────────────────────────── */
var C = {
  GOLD:     [201,168, 76], GOLD_L:   [226,201,126], GOLD_D:   [160,130, 55],
  CH:       [ 42, 39, 39], CH2:      [ 61, 58, 58], CH3:      [ 80, 77, 77],
  MID:      [122,115,112], MUTED:    [160,155,150],
  SURF:     [248,246,241], SURF2:    [240,236,228],
  WHITE:    [255,255,255],
  GREEN:    [ 42,154, 90], GREEN_BG: [234,247,240],
  RED:      [201, 76, 76], RED_BG:   [255,240,240],
  BLUE:     [ 24, 95,165], BLUE_BG:  [232,240,250],
  BORDER:   [224,219,211]
};

/* W1a-brandcolor: PDF-Gold war hart verdrahtet -> Whitelabel-Reseller bekamen
   goldene PDFs. Die Palette wird jetzt nach aussen gegeben; mandant-branding.js
   (bzw. jeder Aufrufer) kann die Akzentfarbe hineinschreiben. Die Arrays werden
   IN PLACE mutiert, damit alle bestehenden Referenzen mitziehen. */
window._dpPdfColors = C;

/* W12-pdflight: Deckblatt + Seitenkoepfe hell/dunkel. Der Reseller entscheidet
   (resellers.brand_pdf_light), es gilt fuer alle seine Mandanten. Default =
   dunkel -> fuer normale User aendert sich NICHTS. */
window._dpPdfLight = false;
window._dpPdfSetLight = function (on) { window._dpPdfLight = !!on; };
function _cv(dark, light) { return window._dpPdfLight ? light : dark; }
window._dpPdfSetAccent = function (hex, hexHi, hexLo) {
  function rgb(h) {
    if (!h || !/^#[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.substr(1,2),16), parseInt(h.substr(3,2),16), parseInt(h.substr(5,2),16)];
  }
  function put(target, src) { if (src) { target[0]=src[0]; target[1]=src[1]; target[2]=src[2]; } }
  put(C.GOLD,   rgb(hex));
  put(C.GOLD_L, rgb(hexHi) || (rgb(hex) ? rgb(hex).map(function(v){ return Math.min(255, Math.round(v + (255-v)*0.45)); }) : null));
  put(C.GOLD_D, rgb(hexLo) || (rgb(hex) ? rgb(hex).map(function(v){ return Math.round(v*0.7); }) : null));
};
/* beim Laden einmal aus dem Branding ziehen (falls schon bekannt) */
try {
  var _b0 = (window.DealPilotConfig && DealPilotConfig.branding && DealPilotConfig.branding.get) ? DealPilotConfig.branding.get() : null;
  if (_b0 && _b0.accent) window._dpPdfSetAccent(_b0.accent, _b0.accent_hi, _b0.accent_lo);
} catch (e) {}


/* ── HELPER ─────────────────────────────────────── */
function pE(n, sgn) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  var a = Math.abs(n);
  var s = a.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' EUR';
  return (sgn && n !== undefined) ? ((n >= 0 ? '+' : '-') + s) : s;
}
// V63.73: Kompakte Notation für CF-Projektion-Tabelle (k€ statt EUR)
// Beispiele: pK(940) = "940", pK(7000) = "7,0k", pK(176537) = "176,5k", pK(-2748, true) = "-2,7k"
function pK(n, sgn) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  var a = Math.abs(n);
  var sign = '';
  if (sgn) sign = (n >= 0 ? '+' : '-');
  else if (n < 0) sign = '-';
  // < 1000: ohne k, ohne Dezimalstelle
  if (a < 1000) return sign + Math.round(a).toString();
  // < 10.000: mit einer Dezimalstelle
  if (a < 10000) return sign + (a / 1000).toFixed(1).replace('.', ',') + 'k';
  // < 1.000.000: mit einer Dezimalstelle
  if (a < 1000000) return sign + (a / 1000).toFixed(1).replace('.', ',') + 'k';
  // > 1 Mio
  return sign + (a / 1000000).toFixed(2).replace('.', ',') + 'M';
}
// V63.81: Volle Euro-Werte mit deutscher Tausendertrennung — wie im Frontend
function pE(n, sgn) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  var a = Math.abs(n);
  var sign = '';
  if (sgn) sign = (n >= 0 ? '+' : '-');
  else if (n < 0) sign = '-';
  return sign + Math.round(a).toLocaleString('de-DE');
}
/* ══ v1732 · EIN LEERES PROZENTFELD HAT DAS GANZE PDF ABGEBROCHEN ══
   Gemessen am Objekt 2026-1006 (Löhner Str. 278):

     TypeError: n.toFixed is not a function
       at pP        (pdf.js:653)
       at _exportPDFInner (pdf.js:1274)   <- pP(v('makler_p'), 2)

   `v('makler_p')` liefert den FELDWERT, und der ist ein String - hier
   der leere. `isNaN('')` ist **false**, weil der leere String zu 0
   wird; der Wächter lässt ihn also durch, und `''.toFixed` gibt es
   nicht. Dasselbe gilt für jeden gefüllten Zahlenstring: `isNaN('2.2')`
   ist ebenfalls false.

   > `isNaN` prüft, ob sich etwas in eine Zahl VERWANDELN lässt, nicht,
   > ob es eine ist. Wer danach `toFixed` ruft, verlässt sich auf eine
   > Prüfung, die eine andere Frage beantwortet hat.

   WAS DAS ANRICHTET: der Fehler fliegt in `_exportPDFInner` bei rund
   35 % Fortschritt. `exportPDF` fängt ihn, zeigt einen Toast und
   schliesst das Fenster - es gibt KEIN PDF. Und `deal-action.js:1205`
   hängt das Investment-PDF über `exportPDFBlob()` an die Mail: kommt
   nichts zurück, läuft der Code **still** weiter. Der Absender sieht
   eine versandte Mail, der Empfänger eine ohne Anhang.

   Beide Funktionen wandeln jetzt selbst und prüfen auf ABWESENHEIT,
   bevor sie rechnen - dieselbe Regel wie bei `_euro(null)` und
   `Number(null)` in CLAUDE.md. */
function _pfZahl(n) {
  if (n === null || n === undefined || n === '') return NaN;
  var x = (typeof n === 'number') ? n : Number(String(n).replace(',', '.'));
  return isFinite(x) ? x : NaN;
}
/* v2463 · „d || 2" machte aus 0 Nachkommastellen zwei (Gebäudeanteil „31,71 %" statt „32 %"). */
function pP(n, d) { d = (d == null) ? 2 : d; var x = _pfZahl(n); return isNaN(x) ? '-' : x.toFixed(d).replace('.', ',') + ' %'; }
function pN(n, d) { d = d || 1; var x = _pfZahl(n); return isNaN(x) ? '-' : x.toFixed(d).replace('.', ','); }

/* ── v2832 · zwei Etiketten, die BEIDE PDFs aus derselben Quelle lesen ──
   (1) „Heute": State.kpis rechnet das erste VOLLE Jahr ab Kauf. Bei einem
       Bestandsobjekt ist das das Kaufjahr - unter „Heute (2026)" stand die
       Rechnung von 2023 (Rechenwege-Pruefer 22.10.2026, Fund 8: 2026-1054
       zeigte dort -15.835 €, die Projektionszeile 2026 -16.265 €).
   (2) Mietentwicklung: das PDF nannte immer „Mietstg. 1,5 %", auch wenn der
       Detail- oder Einheiten-Modus rechnete (Fund 9). Jetzt der Modus, der
       wirklich rechnet (MietEntwicklung.getMode). */
window._dpPdfJahr1 = function (lang) {
  var c = null;
  try { c = window.State && State.cfRows && State.cfRows[0] ? Number(State.cfRows[0].cal) : null; } catch (e) {}
  var j = new Date().getFullYear();
  if (!c || !isFinite(c) || c >= j) return lang ? 'Heute (' + j + ')' : 'Heute';
  return lang ? 'Jahr 1 (' + c + ', voll)' : 'Jahr 1 (' + c + ')';
};
window._dpPdfMiete = function () {
  var ME = window.MietEntwicklung, m = 'prog';
  try { if (ME && ME.getMode) m = ME.getMode(); } catch (e) {}
  var zahl = function (id) { var e = document.getElementById(id); if (!e || e.value === '') return null; var n = (typeof parseDe === 'function') ? parseDe(e.value) : Number(String(e.value).replace(',', '.')); return isFinite(n) ? n : null; };
  var p = function (x, d) { return Number(x).toFixed(d).replace('.', ','); };
  var t;
  if (m === 'einheiten') t = 'je Einheit (Mietverträge, Index)';
  else if (m === 'detail') {
    var anz = Math.round(zahl('me_anz') || 0), iv = Math.max(1, Math.round(zahl('me_int') || 1)), pc = zahl('me_pct') || 0;
    t = (anz > 0 && pc) ? 'Erhöhungsplan: ' + p(pc, 1) + ' % in ' + anz + (anz === 1 ? ' Schritt' : ' Schritten') + ', alle ' + iv + ' J.' : 'Erhöhungsplan ohne Erhöhung';
  } else t = (zahl('mietstg') != null ? p(zahl('mietstg'), 1) : '0,0') + ' % p. a.';
  try { var s = ME && ME.sollSprung ? ME.sollSprung() : null; if (s && s.jahr != null && s.faktor && Math.abs(s.faktor - 1) > 0.001) t += ', Soll-Miete ab Jahr ' + s.jahr; } catch (e) {}
  return { modus: m, text: t };
};

/* ── PAGE TEMPLATE ──────────────────────────────── */
function pageTpl(doc, num, subtitle, W, M) {
  W = W || 210; M = M || 15;
  /* W14-pagelight: Kopf-/Fussbalken folgen dem Deckblatt (brand_pdf_light). */
  // Header
  doc.setFillColor.apply(doc, _cv(C.CH, C.SURF2));
  doc.rect(0, 0, W, 22, 'F');
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(0, 22, W, 0.8, 'F');
  // Watermark wird zentral am Ende über _applyWatermarkIfFree(doc, W) gesetzt - nicht mehr hier.

  // Sidebar-Logo im Header (Banner-Format auf dunklem BG)
  // Branding-Logo (Custom oder DealPilot), proportional skaliert
  var _brandImg = _getBrandingLogo();
  if (_brandImg) {
    var _ls = _getLogoSize(_brandImg, 50, 17);
    try { doc.addImage(_brandImg, 'PNG', M, 3, _ls.w, _ls.h); } catch(e) {}
  } else {
    // Fallback: Text-Branding (neutral, ohne Sachverständigen-/Projektentwicklungs-Tagline)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor.apply(doc, C.GOLD);
    doc.text('DEALPILOT', M, 13);
  }
  // Seitenbezeichnung mittig
  if (subtitle) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, _cv(C.WHITE, C.CH));
    doc.text(subtitle.toUpperCase(), W / 2, 13, { align: 'center' });
  }
  // Seitennummer rechts
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor.apply(doc, C.MID);
  doc.text('Seite ' + num, W - M, 17, { align: 'right' });
  // Footer
  doc.setFillColor.apply(doc, _cv(C.CH, C.SURF2));
  doc.rect(0, 285, W, 12, 'F');
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(0, 285, W, 0.4, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  doc.setTextColor.apply(doc, _cv([120, 110, 90], C.MUTED));
  doc.text(_formatContact(_getUserContact()), W / 2, 290, { align: 'center' });
  doc.text('Alle Angaben ohne Gew\u00e4hr \u00b7 Keine Steuer- oder Anlageberatung \u00b7 Vertraulich', W / 2, 294, { align: 'center' });
  return 27;
}

/* ── SECTION HEADER ─────────────────────────────── */
function secH(doc, y, label, x, w) {
  doc.setFillColor.apply(doc, C.CH);
  doc.roundedRect(x, y, w, 8, 2, 2, 'F');
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(x, y, 3, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor.apply(doc, C.GOLD);
  doc.text(label.toUpperCase(), x + 7, y + 5.5);
  return y + 11;
}

/* ── KV TABLE ───────────────────────────────────── */
function kvT(doc, x, y, w, rows, hl) {
  hl = hl || [];
  var cy = y, rh = 5.8;
  rows.forEach(function(row, i) {
    var isHl = hl.indexOf(i) >= 0;
    doc.setFillColor.apply(doc, isHl ? [250,245,230] : (i % 2 === 0 ? C.SURF : C.WHITE));
    doc.setDrawColor.apply(doc, C.BORDER); doc.setLineWidth(0.2);
    doc.rect(x, cy, w, rh, 'FD');
    if (isHl) { doc.setFillColor.apply(doc, C.GOLD); doc.rect(x, cy, 2, rh, 'F'); }
    doc.setFont('helvetica', isHl ? 'bold' : 'normal'); doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, C.MID); doc.text(String(row[0] || ''), x + (isHl ? 5 : 3), cy + rh - 1.7);
    doc.setTextColor.apply(doc, isHl ? C.CH : C.CH);
    doc.text(String(row[1] || '-'), x + w - 3, cy + rh - 1.7, { align: 'right' });
    cy += rh;
  });
  return cy;
}

/* ── KPI BOX ────────────────────────────────────── */
function kBox(doc, x, y, w, h, label, val, vc) {
  vc = vc || C.GOLD;
  doc.setFillColor.apply(doc, C.CH);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
  doc.setFillColor.apply(doc, C.GOLD); doc.rect(x, y, w, 1.5, 'F');
  /* v2463 · Beschriftung war 90/85/80 auf Obsidian (Kontrast unter 2:1) - kaum lesbar. */
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(196, 188, 170);
  doc.text(label.toUpperCase(), x + 3, y + 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
  doc.setTextColor.apply(doc, vc);
  doc.text(String(val), x + 3, y + 16);
}

/* ── SCEN BOX ───────────────────────────────────── */
function sBox(doc, x, y, w, label, val, sub, bg, acc) {
  doc.setFillColor.apply(doc, bg); doc.roundedRect(x, y, w, 18, 2, 2, 'F');
  doc.setFillColor.apply(doc, acc); doc.rect(x, y, 2.5, 18, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, acc);
  doc.text(label.toUpperCase(), x + 6, y + 6);
  doc.setFontSize(14);
  var isDark = JSON.stringify(bg) === JSON.stringify(C.CH);
  doc.setTextColor.apply(doc, isDark ? C.GOLD : C.CH);
  doc.text(String(val), x + 6, y + 14.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.setTextColor.apply(doc, isDark ? [140,130,110] : C.MID);
  doc.text(String(sub), x + 6, y + 17);
}

/* ══════════════════════════════════════════════════
   HAUPT-EXPORT-FUNKTION
══════════════════════════════════════════════════ */
/**
 * V27: Rendert das neue JSON-Format der KI-Analyse strukturiert ins PDF.
 * Wird vom KI-Block in exportPDF verwendet wenn window._aiAnalysis ein Objekt ist.
 *
 * @param doc      jsPDF-Doc
 * @param a        AI-Analyse-Objekt (vom Backend)
 * @param cy       aktuelle Y-Position auf der Seite
 * @param M        margin
 * @param CW       Inhaltsbreite
 * @param W        Seitenbreite
 * @param C        Color-Konstanten
 * @param stripMd  globaler stripMarkdown-Helper (aus ui.js)
 * @param newPage  newPage-Helper aus exportPDF (für Seitenumbruch)
 * @returns        neue cy-Position
 */
/* v603-pdf-sections: Titel -> Checkbox-Key (default an, unbekannt = an) */
function _dpPdfSecKey(title){
  var m={'Gesamtbewertung':'gesamt','Stärken':'staerken','Risiken':'risiken','Risikoanalyse':'risikoanalyse','Szenario-Analyse':'szenarien','Investor-Fit':'investorfit','Empfehlung':'empfehlung','Investmentbewertung':'investbew','Verhandlungsempfehlung':'verhandlung','Kaufpreis-Offerte':'offerte','Bankargumente':'bank','DealPilot-Insight':'insight',
    /* v2552 · die Abschnitte, die die Pilot-Analyse seit v2150-v2544 zeigt */
    'Anschlussfinanzierung':'anschluss','Lage & Markt':'lage','Abgleich mit dem Marktbericht':'abgleich','Optischer Eindruck aus den Fotos':'fotos',
    'Ankauf · Bestand · Zielbild':'zielbild','Ankauf gegen heute':'ankaufheute','Steuerliche Zusammenfassung':'steuer','Steuerverlauf':'steuerverlauf',
    /* v2985 · Bestand: die Bestandsstrategie haengt am Haken der Verhandlung, Exit hat einen eigenen */
    'Bestandsstrategie':'verhandlung','Exit-Strategien':'exit'};
  return m[title]||null;
}
function _dpPdfSectionOn(title){var k=_dpPdfSecKey(title);if(!k)return true;var cb=document.getElementById('ai-pdf-sec-'+k);return !cb||cb.checked;}
function _renderAiJsonInPdf(doc, a, cy, M, CW, W, C, stripMd, newPage) {
  function clean(s) {
    if (s == null) return '';
    var t = '' + s;
    try { if (typeof window._dpOhnePortal === 'function') t = window._dpOhnePortal(t); } catch (e) {}   /* v2947 (N78.3) · kein Portalname im PDF */
    if (typeof stripMd === 'function') t = stripMd(t);
    return t.replace(/\*+/g, '').trim();
  }
  function maybePage(needed) {
    if (cy + needed > 280) cy = newPage('Pilot-Analyse');
  }

  /* v2555 · Ein Abschnitt bricht ueber die Seite um, statt als Ganzes auf die
     naechste zu springen. Gemessen am Westerfeld-PDF (21.10.2026): die Analyse
     belegte zehn Seiten, viele zu einem Viertel gefuellt. Passen Kopf und drei
     Zeilen nicht mehr, beginnt der Abschnitt auf der neuen Seite; sonst laeuft
     er weiter und traegt dort „(Fortsetzung)". */
  function _zeichneBlock(title, lines, accentColor, isDarkBg) {
    var LINE_H = 5.2, KOPF = 12, FUSS = 7, UNTEN = 280;
    if (cy + KOPF + 3 * LINE_H + FUSS > UNTEN) cy = newPage('Pilot-Analyse');
    var i = 0, erst = true;
    while (i < lines.length) {
      var platz = Math.max(1, Math.floor((UNTEN - cy - KOPF - FUSS) / LINE_H));
      var teil = lines.slice(i, i + platz);
      var h = KOPF + teil.length * LINE_H + FUSS;
      doc.setFillColor(255, 255, 255); doc.roundedRect(M, cy, CW, h, 1.8, 1.8, 'F');
      doc.setFillColor.apply(doc, accentColor); doc.rect(M, cy, 2, h, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8);
      doc.setTextColor.apply(doc, accentColor);
      doc.text(title.toUpperCase() + (erst ? '' : ' (FORTSETZUNG)'), M + 6, cy + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.35);
      if (isDarkBg) doc.setTextColor(245, 245, 240); else doc.setTextColor(45, 42, 42);
      var textY = cy + KOPF;
      /* v2830 · Blocksatz: Zeilen sind {t, ende, punkt, einzug}; die letzte
         Zeile eines Absatzes bleibt linksbuendig (DpPdfBlocksatz). */
      teil.forEach(function (line) {
        if (typeof line === 'string') { if (line) doc.text(line, M + 6, textY); }
        else if (line.t) {
          if (line.punkt) doc.text('\u2022', M + 6, textY);
          var lx = M + 6 + (line.einzug || 0), lb = (line.breite || (CW - 24)) - (line.einzug || 0);
          if (window.DpPdfBlocksatz) window.DpPdfBlocksatz.zeile(doc, line, lx, textY, lb, true); else doc.text(line.t, lx, textY);
        }
        textY += LINE_H;
      });
      if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.15);
      i += teil.length; erst = false;
      if (i < lines.length) cy = newPage('Pilot-Analyse'); else cy += h + 4;
    }
  }

  // V63.45: Sicherer Multi-Paragraph-Renderer mit klarem rechtem Padding (10mm).
  // Behandelt \n\n als Absatz-Trenner, \n als Zeilenumbruch.
  function _splitParagraphs(text, maxW) {
    if (!text) return [];
    var paragraphs = String(text).split(/\n\n+/);
    var allLines = [];
    paragraphs.forEach(function(p, i) {
      if (i > 0) allLines.push('');  // Absatz-Trenner als Leerzeile
      // Innerhalb eines Absatzes: \n als hard break, dann pro Zeile splitten
      var hardLines = p.split(/\n/);
      hardLines.forEach(function(hl) {
        if (!hl.trim()) { allLines.push(''); return; }
        /* v2830 · eine Zeile, die mit einem Aufzaehlungszeichen beginnt, bekommt
           einen haengenden Einzug; jede Zeile traegt, ob sie den Absatz beendet */
        var m = /^\s*[\u2022\u00b7-]\s+/.exec(hl), ein = m ? 4 : 0;
        var wrapped = doc.splitTextToSize(m ? hl.slice(m[0].length) : hl.trim(), maxW - ein);
        wrapped.forEach(function(w, j) { allLines.push({ t: String(w).trim(), ende: j === wrapped.length - 1, punkt: !!m && j === 0, einzug: ein, breite: maxW }); });
      });
    });
    return allLines;
  }

  function block(title, text, bgColor, accentColor, isDarkBg) {
    if (typeof _dpPdfSectionOn === 'function' && !_dpPdfSectionOn(title)) return; /* v603-gate */
    bgColor = [255, 255, 255]; accentColor = C.GOLD; isDarkBg = false; /* v596-pdf-clean */
    if (!text) return;
    // V63.71: Schriftgröße VOR splitTextToSize setzen - sonst nimmt jsPDF die alte Größe
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    // V63.71: Sehr konservatives TEXT_W (CW - 24mm = 6 links + 18 rechts Sicherheit)
    var TEXT_W = CW - 24;
    var lines = _splitParagraphs(text, TEXT_W);
    _zeichneBlock(title, lines, accentColor, isDarkBg);   /* v2555 */
  }

  function bulletBlock(title, items, bgColor, accentColor) {
    if (typeof _dpPdfSectionOn === 'function' && !_dpPdfSectionOn(title)) return; /* v603-gate2 */
    bgColor = [255, 255, 255]; accentColor = C.GOLD; /* v596-pdf-clean2 */
    if (!Array.isArray(items) || !items.length) return;
    // V63.71: Schriftgröße VOR splitTextToSize
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    var TEXT_W = CW - 28;
    var rendered = [];
    items.forEach(function(it) {
      var line = clean(it);
      if (!line) return;
      /* v2830 · haengender Einzug und Blocksatz statt eingerueckter Leerzeichen */
      var wrapped = doc.splitTextToSize(line, TEXT_W - 4);
      wrapped.forEach(function(w, idx) {
        rendered.push({ t: String(w).trim(), ende: idx === wrapped.length - 1, punkt: idx === 0, einzug: 4, breite: TEXT_W });
      });
    });
    _zeichneBlock(title, rendered, accentColor, false);   /* v2555 */
  }

  // 1. Gesamtbewertung
  block('Gesamtbewertung', clean(a.gesamtbewertung || a.fazit_kurz), [232, 240, 248], [60, 102, 148]);

  // 2. Stärken / Risiken
  bulletBlock('Stärken', a.staerken,   [232, 247, 234], [42, 138, 86]);
  bulletBlock('Risiken', a.risiken,    [248, 232, 230], [184, 98, 92]);

  // 3. Risikoanalyse
  if (a.risikoanalyse && typeof a.risikoanalyse === 'object') {
    var ra = a.risikoanalyse;
    var raText = '';
    if (ra.finanzierungsrisiko)    raText += '• Finanzierungsrisiko: ' + clean(ra.finanzierungsrisiko) + '\n';
    if (ra.cashflow_stabilitaet)   raText += '• Cashflow-Stabilität: ' + clean(ra.cashflow_stabilitaet) + '\n';
    if (ra.annahmen_abhaengigkeit) raText += '• Abhängigkeit von Annahmen: ' + clean(ra.annahmen_abhaengigkeit);
    if (raText) block('Risikoanalyse', raText, [248, 240, 232], [184, 124, 60]);
  }

  // 4. Szenarien
  if (a.szenarien && typeof a.szenarien === 'object') {
    var sz = '';
    if (a.szenarien.worst_case) sz += 'Worst Case (Miete -10%, Zins +1%): ' + clean(a.szenarien.worst_case) + '\n\n';
    if (a.szenarien.best_case)  sz += 'Best Case (Miete +5%, höhere Wertsteigerung): ' + clean(a.szenarien.best_case);
    /* v2900 · die gerechneten Werte stehen im Stress-Test - hier nur der Verweis, keine zweite Zahlenreihe */
    if (sz) block('Szenario-Analyse', sz + '\n\nDie gerechnete Schuldendeckung je Szenario (Zins und Miete) steht im Stress-Test.', [248, 244, 232], C.GOLD);
  }

  // 5. Investor-Fit
  if (a.investor_fit && typeof a.investor_fit === 'object') {
    var f = a.investor_fit;
    var ft = '';
    if (f.cashflow_investor)        ft += '• Cashflow-Investor: ' + clean(f.cashflow_investor) + '\n';
    if (f.wertsteigerungs_investor) ft += '• Wertsteigerungs-Investor: ' + clean(f.wertsteigerungs_investor) + '\n';
    if (f.sicherheitsorientiert)    ft += '• Sicherheitsorientiert: ' + clean(f.sicherheitsorientiert);
    if (ft) block('Investor-Fit', ft, [240, 240, 245], [90, 90, 120]);
  }

  // 6. Empfehlung
  if (a.empfehlung || a.empfehlung_begruendung) {
    var emp = clean(a.empfehlung || '').toUpperCase() + '\n\n' + clean(a.empfehlung_begruendung || '');
    block('Empfehlung', emp, [248, 244, 232], C.GOLD);
  }

  // V29: Klassische Sektionen aus der alten KI-Analyse
  if (a.investmentbewertung) {
    block('Investmentbewertung', clean(a.investmentbewertung), [235, 241, 248], [60, 102, 148]);
  }
  /* v2985 · BESTAND (Ankauf-Stand vorhanden, Ist-Ansicht - dieselbe Regel wie die Reiter):
     Bestandsstrategie, Anschlussfinanzierung und Exit-Strategien statt Verhandlung/Offerte/Bank.
     Die Rechnung kommt aus bestand-analyse.js (ohne KI), die Fragen aus der Analyse. */
  var _best = false;
  try { _best = !!(window.DpBestand && window.DpBestand.istBestand()); } catch (e) { _best = false; }
  function _qaText(arr) {
    if (!Array.isArray(arr)) return '';
    return arr.filter(function (x) { return x && x.frage && x.antwort; })
      .map(function (x) { return clean(x.frage) + '\n' + clean(x.antwort); }).join('\n\n');
  }
  if (a.verhandlungsempfehlung && (!_best || a.bestand_modus)) {
    block(a.bestand_modus ? 'Bestandsstrategie' : 'Verhandlungsempfehlung', clean(a.verhandlungsempfehlung), [250, 244, 230], C.GOLD);   /* v2982 */
  }
  if (_best) {
    var _neu = 'Analyse neu abrufen, dann beantwortet der Pilot diese Fragen.';
    var _af = [];
    try { _af.push(window.DpBestand.anschlussText()); } catch (e) {}
    var _afQa = _qaText(a.anschlussfinanzierung);
    _af.push(_afQa || (typeof a.anschlussfinanzierung === 'string' && a.anschlussfinanzierung ? clean(a.anschlussfinanzierung) + '\n\n' + _neu : _neu));
    if (Array.isArray(a.bankargumente) && a.bankargumente.length)
      _af.push('Argumente für die Bank:\n' + a.bankargumente.map(function (x) { return '\• ' + clean(x); }).join('\n'));
    block('Anschlussfinanzierung', _af.filter(Boolean).join('\n\n'));
    var _ex = [];
    try { _ex.push(window.DpBestand.exitText()); } catch (e) {}
    var _exQa = _qaText(a.exit_strategien);
    _ex.push(_exQa ? _exQa + '\n\nEine Einordnung aus deinen Eingaben, keine Steuer- oder Rechtsberatung.' : _neu);
    block('Exit-Strategien', _ex.filter(Boolean).join('\n\n'));
  }
  if (!_best && a.kaufpreis_offerte && typeof a.kaufpreis_offerte === 'object') {
    var kpo = a.kaufpreis_offerte;
    var offText = '';
    if (kpo.empfohlen)   offText += 'Empfohlener Kaufpreis: ' + clean(kpo.empfohlen) + '\n\n';
    if (kpo.begruendung) offText += clean(kpo.begruendung) + '\n\n';
    if (Array.isArray(kpo.argumente) && kpo.argumente.length) {
      offText += 'Argumente:\n';
      kpo.argumente.forEach(function(arg) { offText += '• ' + clean(arg) + '\n'; });
    }
    if (offText) block('Kaufpreis-Offerte', offText.trim(), [240, 232, 255], [122, 90, 181]);
  }
  if (!_best && Array.isArray(a.bankargumente) && a.bankargumente.length) {   /* v2985 · im Bestand unter Anschlussfinanzierung */
    bulletBlock('Bankargumente', a.bankargumente, [232, 244, 234], [42, 154, 90]);
  }

  /* v2552 · Marcel 21.10.2026: „in der Pilot-Analyse muss auch der Reiter Bausteine
     im PDF angepasst werden." Gemessen: die Analyse zeigt acht Abschnitte, die das
     PDF nie druckte (Felder kamen in pdf.js nicht vor). Jetzt als Textbausteine,
     jeder mit eigenem Haken unter „Bausteine im PDF". */
  var _eur = function (x) { return (x < 0 ? '-' : '') + Math.round(Math.abs(x)).toLocaleString('de-DE') + ' €'; };
  if (!_best && a.anschlussfinanzierung) block('Anschlussfinanzierung', Array.isArray(a.anschlussfinanzierung) ? _qaText(a.anschlussfinanzierung) : clean(a.anschlussfinanzierung));   /* v2985 */
  (function () {
    var t = [];
    if (a.makrolage_recherche) t.push('Makrolage: ' + clean(a.makrolage_recherche));
    if (a.mikrolage_recherche) t.push('Mikrolage: ' + clean(a.mikrolage_recherche));
    if (a.mietspiegel_eur_qm != null && a.mietspiegel_eur_qm !== '') t.push('Mietspiegel: ' + clean(a.mietspiegel_eur_qm).replace(/\s*(?:€|EUR|Euro)(?:\s*\/\s*(?:m²|m2|qm))?\s*$/i, '') + ' €/m²'   /* v2970 · die KI liefert den Wert oft MIT Einheit ("9,81 €") - sonst "9,81 € €/m²" */
       + (a.mietspiegel_herkunft ? ' (' + clean(a.mietspiegel_herkunft) + ')' : ''));
    if (a.kaufpreisniveau) t.push('Kaufpreisniveau: ' + clean(a.kaufpreisniveau));
    if (t.length) block('Lage & Markt', t.join('\n\n'));
  })();
  if (a.berichts_abgleich) block('Abgleich mit dem Marktbericht', clean(a.berichts_abgleich) + '\n\nSach- und Ertragswert im Bericht sind ein Plausibilitäts-Quercheck nach ImmoWertV-Logik — indikativ, kein Gutachten nach § 194 BauGB.');
  if (a.optischer_eindruck) block('Optischer Eindruck aus den Fotos', clean(a.optischer_eindruck) + '\n\nEin visueller Eindruck aus den mitgesendeten Bildern — keine Feststellung.');
  if (a.potenzial_text) block('Ankauf · Bestand · Zielbild', clean(a.potenzial_text) + '\n\nDie Zahlen je Stand stehen auf der Seite Wertpotenzial.');
  (function () {
    var t = [];
    try {
      var AK = window.DealPilotAnkauf, st = AK && AK.stand ? AK.stand() : (window._dpAnkauf || null);
      var roh = st && st.daten ? st.daten._ai : null, alt = roh ? (typeof roh === 'string' ? JSON.parse(roh) : roh) : null;
      if (alt && typeof alt === 'object' && (alt.empfehlung || alt.gesamtbewertung)) {
        var kp = function (x) { if (x && x.bestand_modus) return 'entfällt (im Bestand)'; var o = x && x.kaufpreis_offerte; return o && o.empfohlen ? clean(String(o.empfohlen)) : '–'; };   /* v2982 */
        t.push('Empfehlung beim Ankauf: ' + clean(alt.empfehlung || '–') + ' · heute: ' + clean(a.empfehlung || '–'));
        t.push('Empfohlener Kaufpreis beim Ankauf: ' + kp(alt) + ' · heute: ' + kp(a));
      }
    } catch (e) {}
    if (a.soll_ist_steuer) t.push('Steuerlich: ' + clean(a.soll_ist_steuer));
    if (t.length) block('Ankauf gegen heute', t.join('\n\n'));
  })();
  if (a.steuer_zusammenfassung) block('Steuerliche Zusammenfassung', clean(a.steuer_zusammenfassung) + '\n\nEine Einordnung aus den Eingaben im Reiter Steuer — keine Steuerberatung.');
  (function () {
    var SV = window.DpSteuerVerlauf, r = null;
    try { r = SV && SV.reihe ? SV.reihe() : null; } catch (e) { r = null; }
    if (!r || !r.length) return;
    var w = SV.auswerten(r), t = [];
    if (w.jahr != null) t.push(w.wende === 0 ? 'Das Objekt ist vom ersten Jahr an steuerlich positiv (Überschuss ab ' + w.jahr + ').'
      : 'Steuerlich positiv ab ' + w.jahr + '. Bis dahin ' + _eur(w.erstattung) + ' Steuererstattung, danach ' + _eur(-w.steuer) + ' Steuer im Betrachtungszeitraum.');
    else t.push('Im Betrachtungszeitraum bleibt das Objekt steuerlich im Verlust.');
    /* v2900 · Steuer und Cashflow nach Steuern je Jahr stehen in der Cashflow-Projektion
       (Spalten ± Steuer, CF n.St.) - hier nur noch das steuerliche Ergebnis, das dort fehlt,
       in einer Zeile statt zwoelf. */
    t.push('Steuerliches Ergebnis je Jahr: ' + r.slice(0, 12).map(function (z) { return z.jahr + ' ' + _eur(z.erg); }).join(' · ') + '.');
    t.push('Steuer und Cashflow nach Steuern je Jahr: siehe Cashflow-Projektion.');
    block('Steuerverlauf', t.join('\n'));
  })();

  // 7. DealPilot-Insight (V63.45: dunkler Hintergrund mit hellem Text)
  if (a.dealpilot_insight) {
    block('DealPilot-Insight', clean(a.dealpilot_insight), [40, 38, 38], C.GOLD, true);
  }

  return cy;
}


async function exportPDF() {

  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  if (typeof window.jspdf === 'undefined') { toast('PDF-Bibliothek l\u00e4dt noch...'); return; }
  if (!State || !State.kpis || !State.kpis.kp) { toast('\u26a0 Bitte zuerst Kaufpreis eingeben'); return; }

  // V65.3: Globaler try/catch um den gesamten PDF-Build damit Crashes (z.B. bei
  // exotischen Finanzierungen wie Tilgungsaussetzungsdarlehen + D2) keinen
  // hängenden Browser hinterlassen. User bekommt klare Fehlermeldung + Console-Trace.
  try {
    await _exportPDFInner();
  } catch (err) {
    console.error('[PDF-EXPORT-CRASH]', err);
    if (err && err.stack) console.error(err.stack);
    if (typeof showPdfModal === 'function') showPdfModal(false);
    var _msg = err && err.message ? err.message : String(err);
    toast('\u26a0 PDF-Export fehlgeschlagen: ' + _msg.slice(0, 100) +
          ' -- bitte schicke einen Screenshot der Browser-Console (F12) an Support.');
  }
}

async function _exportPDFInner() {

  // Track usage (and enforce plan limit) before generating PDF
  if (typeof Sub !== 'undefined' && Sub.isApiMode()) {
    try {
      await Sub.trackUsage('pdf_export');
    } catch (e) {
      if (e.status === 403) {
        toast('\u26a0 PDF-Export-Limit erreicht');
        return;
      }
      console.warn('Usage tracking failed:', e.message);
    }
  }

  // Watermark wird zentral via _applyWatermarkIfFree(doc, W) am Ende gesetzt
  // (liest DealPilotConfig.pricing - eine Source of Truth)

  showPdfModal(true); setPdfProgress(5);
  await new Promise(function(r) { setTimeout(r, 50); });
  await loadAssets();
  await loadPhotoMeta();
  setPdfProgress(12);

  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210, M = 15, CW = W - 2 * M;
  var K = State.kpis;
  var pageNum = 0;

  /* v2263 · Hausnummer gehört zur Straße: hier stand „Westerfeldstr., 140, Bielefeld" */
  var objName = [[g('str'), g('hnr')].filter(Boolean).join(' '), g('ort')].filter(Boolean).join(', ') || 'Kalkulation';
  // V23: Objektnummer (z.B. "2026-007") in der Detailzeile
  var objNum = window._currentObjSeq || '';
  var objDetailParts = [];
  if (objNum) objDetailParts.push('Nr. ' + objNum);
  if (g('objart')) objDetailParts.push(g('objart'));
  if (g('wfl'))    objDetailParts.push(g('wfl') + ' m\u00b2');
  if (g('baujahr')) objDetailParts.push('Baujahr ' + g('baujahr'));
  var objDetail = objDetailParts.join('  \u00b7  ');

  function newPage(sub) {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    return pageTpl(doc, pageNum, sub || objName, W, M);
  }
  var cy;

  /* ══════════════════════════════════════════════════
     SEITE 1: DECKBLATT
  ══════════════════════════════════════════════════ */
  pageNum++;
  doc.setFillColor.apply(doc, _cv(C.CH, C.WHITE)); doc.rect(0, 0, W, 297, 'F');  /*W12-pdflight*/

  // Goldlinien
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(0, 56, W, 0.8, 'F');
  doc.rect(0, 252, W, 0.8, 'F');

  // Logo direkt auf dem Deckblatt-Hintergrund (charcoal) - keine weiße Box
  var _coverLogo = _getBrandingLogo();
  if (_coverLogo) {
    var _csz = _getLogoSize(_coverLogo, 76, 36);
    try { doc.addImage(_coverLogo, 'PNG', W / 2 - _csz.w / 2, 14, _csz.w, _csz.h); } catch(e) {}
  }

  // Investment Case Label
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.setTextColor.apply(doc, C.GOLD);
  doc.text('I N V E S T M E N T   C A S E', W / 2, 64, { align: 'center' });

  // Objektname groß
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.setTextColor.apply(doc, _cv(C.WHITE, C.CH));
  var nl = doc.splitTextToSize(objName.toUpperCase(), CW - 10);
  doc.text(nl, W / 2, 76, { align: 'center' });

  // Details
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.setTextColor.apply(doc, _cv([165, 155, 135], C.MID));
  doc.text(objDetail, W / 2, 87, { align: 'center' });

  // 4 Cover-KPIs
  var cw4 = (CW - 12) / 4;
  [
    { l: 'Kaufpreis',        v: pE(K.kp) },
    { l: 'Gesamtinvestition',v: pE(K.gi) },
    { l: 'Eigenkapital',     v: pE(K.ek) },
    { l: 'Bruttomietrendite',v: pP(K.bmy) }
  ].forEach(function(k, i) {
    var x = M + i * (cw4 + 4), yy = 102;
    doc.setFillColor.apply(doc, _cv([52, 49, 49], C.SURF)); doc.roundedRect(x, yy, cw4, 20, 2, 2, 'F');
    doc.setFillColor.apply(doc, C.GOLD); doc.rect(x, yy, cw4, 1.2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor.apply(doc, _cv([120, 110, 90], C.MUTED));
    doc.text(k.l.toUpperCase(), x + 3, yy + 7);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor.apply(doc, C.GOLD);
    doc.text(k.v, x + cw4 - 3, yy + 16, { align: 'right' });
  });

  // Titelfoto - Aspect Ratio wird respektiert
  cy = 127;
  if (_PHOTO_META.length > 0) {
    /* v2830 · ohne Investitionsthese bleibt die halbe Seite leer (gemessen 185-250 mm) -
       dann darf das Titelbild bis 100 mm hoch werden; die These beginnt bei 198 mm. */
    var containerH = g('thesis') ? 58 : 100;
    /* v2830 · zuschneiden statt Rahmen (siehe _fotoZuschnitt): hoechstens bis
       ein Drittel der Hoehe, die Seiten bleiben Papier bzw. Deckblattgrund. */
    var _tf = await _fotoZuschnitt(_PHOTO_META[0], CW / containerH, 0.35);
    var _tw = Math.min(CW, containerH * _tf.ratio), _th = _tw / _tf.ratio;
    drawPhotoFit(doc, _tf, M + (CW - _tw) / 2, cy + (containerH - _th) / 2, _tw, _th, null);
    if (window._dpPdfLight) { doc.setDrawColor.apply(doc, C.BORDER); doc.setLineWidth(0.25); doc.rect(M + (CW - _tw) / 2, cy + (containerH - _th) / 2, _tw, _th); }
    cy += containerH + 3;
  } else { cy += 2; }

  // Investitionsthese
  var thesis = g('thesis');
  if (thesis) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.setTextColor.apply(doc, _cv([185, 175, 155], C.MID));
    var tl = doc.splitTextToSize('"' + thesis + '"', CW - 10);
    doc.text(tl.slice(0, 4), W / 2, Math.max(cy + 6, 198), { align: 'center' });
  }

  // Datum & Kürzel
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor.apply(doc, _cv([120, 110, 90], C.MUTED));
  (function(){var uc=_getBranding();var creator=uc.name||uc.company||'DealPilot';doc.text('Erstellt am ' + new Date().toLocaleDateString('de-DE') + '  \u00b7  K\u00fcrzel: ' + (g('kuerzel') || '-') + '  \u00b7  ' + _pn() + (creator && creator !== _pn() ? ' \u00b7 ' + creator : '') /*W4-dedup*/, W / 2, 258, { align: 'center' });})();
  doc.text('Vertraulich \u00b7 Nur f\u00fcr den internen Gebrauch', W / 2, 264, { align: 'center' });

  // Footer Deckblatt - zeigt Branding-Daten aus den Settings
  doc.setFillColor.apply(doc, _cv(C.CH2, C.SURF2)); doc.rect(0, 270, W, 27, 'F');
  doc.setFillColor.apply(doc, C.GOLD); doc.rect(0, 270, W, 0.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, C.GOLD);
  (function(){
    var b = _getBranding();
    // Linke Spalte: Firma, Person, Rolle
    var leftLines = [];
    if (b.company) leftLines.push(b.company);
    if (b.name && b.name !== b.company) leftLines.push(b.name);
    if (b.role)    leftLines.push(b.role);
    if (!leftLines.length) leftLines.push('DealPilot');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, C.GOLD);
    leftLines.slice(0, 3).forEach(function(t, i) {
      doc.text(t, M, 277 + i * 4.5);
    });
    // Rechte Spalte: Adresse + Kontakt
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(170, 160, 140);
    var rightLines = [];
    var loc = ((b.plz || '') + ' ' + (b.city || '')).trim();
    if (b.address) rightLines.push(b.address);
    if (loc)       rightLines.push(loc);
    var contactLine = [];
    if (b.phone)   contactLine.push('Tel ' + b.phone);
    if (b.email)   contactLine.push(b.email);
    if (contactLine.length) rightLines.push(contactLine.join('  ' + '\u00b7' + '  '));
    if (b.website) rightLines.push(b.website);
    rightLines.slice(0, 4).forEach(function(t, i) {
      doc.text(t, W - M, 277 + i * 4.5, { align: 'right' });
    });
  })();
  setPdfProgress(22);

  /* ══════════════════════════════════════════════════
     SEITE X: FOTO-GALERIE (nur wenn 2+ Fotos)
  ══════════════════════════════════════════════════ */
  if (_PHOTO_META.length >= 2) {
    cy = newPage('Objektfotos');
    // Grid aus bis zu 4 Fotos (2x2) oder 6 Fotos (2x3)
    var photos = _PHOTO_META.slice(0, 6); // max 6 Fotos
    var cols = 2;
    var gap = 4;
    var cellW = (CW - gap * (cols - 1)) / cols;
    var cellH = 75; // jedes Feld 75mm hoch
    /* v2830 · Galerie: Zuschnitt auf die Zelle (hoechstens ein Viertel),
       im hellen Modus ohne dunkle Fuellung und mit heller Bildzeile. */
    var _gal = [];
    for (var _gi = 0; _gi < photos.length; _gi++) _gal.push(await _fotoZuschnitt(photos[_gi], cellW / cellH, 0.25));
    _gal.forEach(function(pm, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var x = M + col * (cellW + gap);
      var y = cy + row * (cellH + gap);
      // Check if we need a new page
      if (y + cellH > 275) return; // skip if would overflow
      var hell = !!window._dpPdfLight;
      var pw = Math.min(cellW, cellH * pm.ratio), ph = pw / pm.ratio, px = x + (cellW - pw) / 2, py = y + (cellH - ph) / 2;
      drawPhotoFit(doc, pm, x, y, cellW, cellH, hell ? null : [30, 27, 27]);
      // Bildunterschrift - auf der Bildbreite, nicht auf der Zelle
      doc.setFillColor.apply(doc, hell ? C.SURF2 : [30, 27, 27]);
      doc.rect(px, py + ph - 6, pw, 6, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor.apply(doc, hell ? C.CH : C.GOLD);
      doc.text('Foto ' + (i + 1), px + 3, py + ph - 1.8);
      if (hell) { doc.setDrawColor.apply(doc, C.BORDER); doc.setLineWidth(0.25); doc.rect(px, py, pw, ph); }
    });
  }

  /* ══════════════════════════════════════════════════
     SEITE 2: EXECUTIVE SUMMARY / KENNZAHLEN
  ══════════════════════════════════════════════════ */
  cy = newPage('Executive Summary \u00b7 Investitions\u00fcberblick');

  // Objekt-Strip
  doc.setFillColor.apply(doc, C.SURF2); doc.setDrawColor.apply(doc, C.BORDER);
  doc.setLineWidth(0.5); doc.roundedRect(M, cy, CW, 12, 2, 2, 'FD');
  doc.setFillColor.apply(doc, C.GOLD); doc.rect(M, cy, 3, 12, 'F');
  /* v2463 · gemessen mit einer langen Anschrift: der Objektname lief 74 mm über
     den rechten Rand und durch die Angaben rechts. Jetzt passt er in den Platz
     links neben den Angaben (sonst „..."), und die Angaben halten 3 mm Abstand. */
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  var _odW = doc.getTextWidth(objDetail);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, C.CH);
  var _onT = String(objName), _onMax = CW - 7 - _odW - 9;
  if (doc.getTextWidth(_onT) > _onMax) { while (_onT.length > 1 && doc.getTextWidth(_onT + '...') > _onMax) _onT = _onT.slice(0, -1); _onT = _onT.replace(/[\s,;·-]+$/, '') + '...'; }
  doc.text(_onT, M + 7, cy + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
  doc.text(objDetail, W - M - 3, cy + 8, { align: 'right' });
  cy += 15;

  // 4 dunkle KPI-Tiles Reihe 1
  var tw4 = (CW - 9) / 4;
  [
    { l: 'Bruttomietrendite', v: pP(K.bmy),           c: K.bmy >= 5 ? C.GREEN : C.GOLD },
    { l: 'Nettomietrendite',  v: pP(K.nmy),           c: K.nmy >= 3 ? C.GREEN : C.GOLD },
    /* v2463 · K.cf_m ist der Cashflow VOR Steuern / 12 - die Kachel heisst „n.St." */
    { l: 'CF/Monat n.St.',    v: pE(K.cf_ns / 12, true),    c: K.cf_ns >= 0 ? C.GREEN : C.RED },
    /* v2463 · vierte Kachel: die erste Reihe hatte drei Kacheln unter vier Spalten (Lücke rechts) */
    { l: 'EK-Rendite (v. St.)', v: pP(K.ekr, 1),      c: K.ekr >= 0 ? C.GREEN : C.RED }
  ].forEach(function(k, i) { kBox(doc, M + i * (tw4 + 3), cy, tw4, 20, k.l, k.v, k.c); });
  cy += 23;

  // 4 KPI-Tiles Reihe 2
  [
    { l: 'LTV',              v: pP(K.ltv, 1) },
    /* v2240 · „OK" ab der eingestellten Mindest-Schwelle (Vorgabe 1,2) - hier stand 1,5,
       waehrend die Legende derselben Datei 1,2 als „gut" fuehrte */
    { l: 'DSCR',             v: pN(K.dscr, 2) + (K.dscr >= _pdfSw().dscrGruen ? ' OK' : ' !') },
    { l: 'Faktor',           v: pN(K.fak, 1) },
    { l: 'Equity Multiple',  v: pN(K.em, 1) + 'x' }
  ].forEach(function(k, i) { kBox(doc, M + i * (tw4 + 3), cy, tw4, 18, k.l, k.v, C.GOLD); });
  cy += 21;

  // Szenarien
  var sw3 = (CW - 8) / 3;
  sBox(doc, M,             cy, sw3, window._dpPdfJahr1(true), pE(K.cf_ns, true), 'CF p.a. nach Steuern', C.GREEN_BG, C.GREEN);
  /* v2463 · daneben stand „Heute" nach Steuern und hier der Wert VOR Steuern (K.cf_ezb) */
  sBox(doc, M + sw3 + 4,  cy, sw3, 'Ende Zinsbindung',                         pE(K.cf_ns_ezb != null ? K.cf_ns_ezb : K.cf_ezb, true),'CF p.a. nach Steuern (Prognose)',      [250,245,232], C.GOLD);
  sBox(doc, M+(sw3+4)*2,  cy, sw3, 'Exit / Verkauf',                            pE(K.exit_vkp - Math.max(0, State.rs), true), 'M\u00f6gl. Gewinn', C.CH, C.GOLD);
  cy += 22;

  // CF Rechnung + Kennzahlen nebeneinander
  var hw = (CW - 5) / 2;
  var cyA = cy;
  cy = secH(doc, cy, 'Cashflow-Rechnung ' + window._dpPdfJahr1(false).replace(/^Heute$/, 'heute'), M, hw);   /* v2835 */
  // V63.35.1: Anzeige Warmmiete oben -> UL durchlaufend -> Kaltmiete -> NUL -> NOI
  // (mathematisch identisch zur Excel-Logik NKM - NUL)
  var bwk_ul_now = K.bwk_ul || 0;
  var bwk_nul_now = K.bwk_nul || 0;
  var nkm_now = K.nkm_j;
  /* v2484 · EINE Warmmiete (wie Bankfassung und App): Nettokaltmiete +
     Nebenkostenvorauszahlungen der Mieter, Zusatzeinnahmen getrennt. Hier
     stand NKM + ZE + umlagefaehige KOSTEN (Westerfeld 39.756 statt 41.147 in
     der Bankfassung). Kaltmiete, NOI und alles darunter bleiben gleich. */
  var nkv_now = K.nk_vz_j || 0, ze_now = K.ze_j || 0;
  var warmmiete_now = (K.warm_j != null) ? K.warm_j : (nkm_now - ze_now + nkv_now);
  var kaltmiete_now = nkm_now;
  var noi_now = kaltmiete_now - bwk_nul_now;
  var cf_nz_now = noi_now - K.zins_j;
  var cf_vst_now = cf_nz_now - K.tilg_j;
  // V63.51: Bauspar bei Tilgungsaussetzung
  var _bsparY_p2 = (State.bsparRate_m || 0) * 12;
  var _hasBspar_p2 = _bsparY_p2 > 0;
  var _cfRows = [
    ['Warmmiete / Jahr (NKM + NK-Vorauszahlungen)', pE(warmmiete_now)],
    ['- NK-Vorauszahlungen der Mieter',   '- ' + pE(nkv_now)],
    ['= Nettokaltmiete / Jahr',                  pE(nkm_now - ze_now, true)],
    ['+ Zusatzeinnahmen (Stellplatz, Garage)', '+ ' + pE(ze_now)],
    ['= Kaltmiete inkl. Zusatzeinnahmen / Jahr', pE(kaltmiete_now, true)],
    ['- nicht umlagef\u00e4hige BWK',     '- ' + pE(bwk_nul_now)],
    ['= NOI (Net Operating Income)',             pE(noi_now, true)],
    ['- Zinsen / Jahr',                   '- ' + pE(K.zins_j)],
    ['= CF nach Zinsen (vor Tilgung)',           pE(cf_nz_now, true)]
  ];
  if (_hasBspar_p2) {
    // Bei Aussetzung: K.tilg_j ist 0, stattdessen erscheint Bausparrate
    _cfRows.push(['- Bausparrate (BSV) / Jahr',       '- ' + pE(_bsparY_p2)]);
    _cfRows.push(['= CF vor Steuern (nach BSV)',           pE(cf_nz_now - _bsparY_p2, true)]);
  } else {
    _cfRows.push(['- Tilgung / Jahr',                  '- ' + pE(K.tilg_j)]);
    _cfRows.push(['= CF vor Steuern (nach Tilgung)',          pE(cf_vst_now, true)]);
  }
  /* v2463 · Steuer als Differenz der Volljahres-Cashflows (wie die App, calc.js V352) -
     K.steuer ist das anteilige erste Jahr: „+ 771" zwischen zwei gleichen Cashflows. */
  var _stP2 = (K.cf_ns || 0) - (K.cf_op || 0);
  _cfRows.push(['\u00b1 Steuern / Jahr',                    (_stP2 > 0.5 ? '+ ' : (_stP2 < -0.5 ? '- ' : '')) + pE(Math.abs(_stP2))]);
  _cfRows.push(['= CF nach Steuern / Jahr (operativ)',      pE(K.cf_ns, true)]);
  _cfRows.push(['= CF nach Steuern / Monat',                pE(K.cf_ns_m || (K.cf_ns/12), true)]);
  kvT(doc, M, cy, hw, _cfRows, [2, 4, 6, 8, 10, 12, 13]);   /* v2484: zwei Zeilen mehr (Nettokaltmiete, Zusatzeinnahmen) */

  cy = secH(doc, cyA, 'Alle Kennzahlen', M + hw + 5, hw);
  kvT(doc, M + hw + 5, cy, hw, [
    ['Bruttomietrendite',    pP(K.bmy)],
    ['Nettomietrendite',     pP(K.nmy)],
    ['Faktor (KP/NKM)',      pN(K.fak, 1)],
    ['EK-Rendite p.a. (v. St.)', pP(K.ekr, 1)],
    ['Equity Multiple',      pN(K.em, 1) + 'x'],
    ['DSCR',                 pN(K.dscr, 2)],
    ['LTV',                  pP(K.ltv, 1)],
    ['Wertpuffer / Equity',  pE(K.wp_kpi, true)],
    ['AfA / Jahr',           pE(K.afa)],
    ['Zu versteuernder CF',  pE(K.zve_immo, true)],
    ['Zinsrisiko / Mon.',    pE(K.zaer_m) + ' \u20ac'],
    /* v2830 · aus der Bankfassung: interner Zinsfuss und Deal Score (Rechenkern
       DealScore.computeFromKpis, wie dort) */
    ['Interner Zinsfu\u00df (IRR)', (K.irr != null && isFinite(K.irr)) ? pP(K.irr, 2) : 'nicht bestimmbar'],
    ['Deal Score', (function () { try { var sc = window.DealScore && DealScore.computeFromKpis(K); return sc && sc.score ? Math.round(sc.score) + ' / 100' + (sc.label ? ' \u00b7 ' + sc.label : '') : '-'; } catch (e) { return '-'; } })()]
  ], [4, 5, 12]);
  setPdfProgress(35);

  /* ══════════════════════════════════════════════════
     SEITE 3: OBJEKT & FINANZIERUNG
  ══════════════════════════════════════════════════ */
  cy = newPage('Objekt & Finanzierung');
  var hw3 = (CW - 5) / 2;
  var y3A = cy;

  cy = secH(doc, cy, 'Kaufpreis & Nebenkosten', M, hw3);
  kvT(doc, M, cy, hw3, [
    ['Kaufpreis',                 pE(K.kp)],
    ['Makler (' + pP(v('makler_p'), 2) + ')',  pE(K.kp * v('makler_p') / 100)],
    ['Notar (' + pP(v('notar_p'), 2) + ')',    pE(K.kp * v('notar_p') / 100)],
    ['Grundbuchamt',              pE(K.kp * v('gba_p') / 100)],
    ['Grunderwerbsteuer (' + pP(v('gest_p'), 2) + ')', pE(K.kp * v('gest_p') / 100)],
    /* v2273 · hier stand „Junker Immo.“ - ein Firmenname im PDF jedes Nutzers (die Bankfassung sagt seit v1463 „Vermittlung / Beratung“) */
    ['Vermittlung / Beratung (' + pP(v('ji_p'), 2) + ')', pE(K.kp * v('ji_p') / 100)],
    ['Sanierungskosten',          pE(v('san'))],
    /* v2273 \u00b7 seit v2261 steckt das Inventar im Kaufpreis - die Zeile stand wie ein Summand vor der Gesamtinvestition */
    ['davon M\u00f6blierung (im Kaufpreis)', pE(v('moebl'))],
    ['= Gesamtinvestition',  pE(K.gi)]
  ], [8]);

  cy = secH(doc, y3A, 'Finanzierung', M + hw3 + 5, hw3);
  // Build rows dynamic: D1 always, D2 if enabled
  var d1 = K.d1 || 0, d1z = K.d1z_pct || 0, d1t = K.d1t_pct || 0;
  var d2 = (State.d2_enabled && State.d2 > 0) ? State.d2 : 0;
  var d2z = State.d2_enabled ? (State.d2z * 100) : 0;
  var d2t = State.d2_enabled ? (State.d2t * 100) : 0;
  var d_total = d1 + d2;
  var d1_rate = d1 * (d1z + d1t) / 100 / 12;
  var d2_rate = State.d2_rate_m || (d2 * (d2z + d2t) / 100 / 12);
  var totalRate = d1_rate + d2_rate;
  var mischzins = d_total > 0 ? (d1 * d1z + d2 * d2z) / d_total : d1z;
  var finRows = [];
  if (d2 > 0) {
    finRows.push(['Darlehen 1 (Hauptdarlehen)', pE(d1)]);
    finRows.push(['  Zinssatz / Tilgung D1', pP(d1z,2) + ' / ' + pP(d1t,2)]);
    finRows.push(['  Rate D1 / Monat', pE(d1_rate, 2)]);
    finRows.push(['Darlehen 2', pE(d2)]);
    finRows.push(['  Zinssatz / Tilgung D2', pP(d2z,2) + ' / ' + pP(d2t,2)]);
    finRows.push(['  Rate D2 / Monat', pE(d2_rate, 2)]);
    finRows.push(['Darlehen gesamt', pE(d_total)]);
    finRows.push(['Mischzins (gewichtet)', pP(mischzins, 2)]);
    finRows.push(['Gesamtrate / Monat', pE(totalRate, 2)]);
  } else {
    // V63.51: Bei Tilgungsaussetzung anders darstellen
    var _isAussetzung = (g('d1_type') === 'tilgungsaussetzung');
    finRows.push(['Darlehenssumme', pE(d1)]);
    if (_isAussetzung) {
      finRows.push(['Darlehenstyp', 'Tilgungsaussetzung']);
    }
    finRows.push(['Zinssatz nominal', pP(d1z, 2)]);
    if (_isAussetzung) {
      finRows.push(['Anf\u00e4ngl. Tilgung', '- (BSV)']);
    } else {
      finRows.push(['Anf\u00e4ngl. Tilgung', pP(d1t, 2)]);
    }
    finRows.push(['Monatliche Rate', pE(d1_rate)]);   /* v2463: das zweite Argument ist das Vorzeichen, nicht die Stellen („+1.968") */
  }
  finRows.push(['Eigenkapital', pE(K.ek)]);
  finRows.push(['LTV (Loan to Value)', pP(K.ltv, 1)]);
  finRows.push(['Zinsbindung bis', (document.getElementById('r-bindend') || {}).textContent || '-']);
  finRows.push(['Restschuld EZB', pE(State.rs, false)]);
  finRows.push(['Anschluss Zinssatz', pP(v('anschl_z'), 2)]);
  finRows.push(['Anschluss Rate/Mon.', pE(State.rs * (v('anschl_z') + v('anschl_t')) / 100 / 12)]);
  finRows.push(['Zinsrisiko / Monat', pE(K.zaer_m)]);
  kvT(doc, M + hw3 + 5, y3A + 11, hw3, finRows);

  cy = y3A + 11 + finRows.length * 5.8 + 8;

  // Wertpuffer-Box
  if (v('svwert') > 0) {
    doc.setFillColor.apply(doc, C.GREEN_BG);
    doc.setDrawColor(42, 154, 90); doc.setLineWidth(0.4);
    doc.roundedRect(M, cy, CW, 12, 2, 2, 'FD');
    doc.setFillColor.apply(doc, C.GREEN); doc.rect(M, cy, 3, 12, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, C.GREEN);
    doc.text('Sofortiger Wertpuffer / Equity: ' + pE(K.wp_kpi, true) + ' \u20ac', M + 7, cy + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
    /* v2463 · stand bündig auf dem Rahmen (x = W - M) */
    doc.text('Kaufpreis ' + pE(K.kp) + ' \u20ac  vs.  Verkehrswert ' + pE(v('svwert')) + ' \u20ac', W - M - 4, cy + 8, { align: 'right' });
    cy += 15;
  }

  // V63.52: Finanzierungs-Struktur-Übersicht (kurz, oben auf der Seite)
  // Erklärt schnell aus welchen Bausteinen sich die Finanzierung zusammensetzt
  var _isAussetzungPdf = (g('d1_type') === 'tilgungsaussetzung');
  var _hasD2 = State.d2_enabled && State.d2 > 0;
  var _strukturText;
  if (_isAussetzungPdf && _hasD2) {
    _strukturText = 'Tilgungsaussetzungsdarlehen + Bausparvertrag + Zusatzdarlehen ' + (g('d2_inst') || 'D2');
  } else if (_isAussetzungPdf) {
    _strukturText = 'Tilgungsaussetzungsdarlehen kombiniert mit Bausparvertrag';
  } else if (_hasD2) {
    _strukturText = 'Annuitätendarlehen + Zusatzdarlehen ' + (g('d2_inst') || 'D2');
  } else {
    _strukturText = 'Reines Annuitätendarlehen - klassische Finanzierung mit Zins + Tilgung';
  }
  doc.setFillColor.apply(doc, C.SURF2);
  doc.roundedRect(M, cy, CW, 12, 1.8, 1.8, 'F');
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(M, cy, 2, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.setTextColor.apply(doc, [42, 39, 39]);
  doc.text('Finanzierungsstruktur:', M + 6, cy + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(_strukturText, M + 6, cy + 9.5);
  cy += 15;

  // V63.52: Bauspar-Card direkt nach Finanzierung (vor BWK)
  if (_isAussetzungPdf && (v('bspar_sum') > 0 || v('bspar_rate') > 0)) {
    cy = secH(doc, cy, 'Bausparvertrag (Tilgungsaussetzung)', M, CW);
    var bsRows = [
      ['Bausparkasse',                  g('bspar_inst') || '-'],
      ['Vertragsnummer',                g('bspar_vertrag') || '-'],
      ['Bausparsumme',                  pE(v('bspar_sum'))],
      ['Sparrate / Monat',              pE(v('bspar_rate'))],
      ['Sparrate / Jahr (CF-Abfluss)',  pE(v('bspar_rate') * 12)],
      ['Zuteilungsdatum',               g('bspar_zuteil') || '-'],
      ['Guthaben-Zinssatz',             pP(v('bspar_zins'), 2)]
    ];
    // BSV-Aufbau bis EZB hinzufügen wenn berechnet
    if (State.bsvSummary) {
      var bs = State.bsvSummary;
      bsRows.push(['Eingezahlt bis Ende Zinsbindung (' + bs.jahre + ' J.)', pE(bs.eingezahlt)]);
      bsRows.push(['Guthaben inkl. Zinsen bei EZB', pE(bs.guthaben)]);
      bsRows.push(['Restschuld Hauptdarlehen bei EZB', pE(bs.restschuld)]);
      // V66: defensiv — deckungPct kann fehlen wenn alter State, dann aus
      // (guthaben + bauspardarlehen) / restschuld ableiten. Fallback "—" bei rs<=0.
      var _deck = (typeof bs.deckungPct === 'number') ? bs.deckungPct
                : (bs.restschuld > 0
                    ? Math.min(100, ((bs.guthaben || 0) + (bs.bauspardarlehen || 0)) / bs.restschuld * 100)
                    : null);
      bsRows.push(['Deckung durch BSV-Guthaben',
        (_deck === null || !isFinite(_deck)) ? '—' : (_deck.toFixed(0) + ' %')]);
    }
    kvT(doc, M, cy, CW, bsRows, [4, 7, 8, 10]);
    cy += bsRows.length * 5.8 + 6;
    // Hinweis-Box dazu
    doc.setFillColor.apply(doc, C.SURF2);
    doc.roundedRect(M, cy, CW, 11, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
    var _bsH = 'Bei Tilgungsaussetzung wird das Hauptdarlehen \u00fcber den Bausparvertrag abgel\u00f6st. Die Bausparrate ist als Liquidit\u00e4tsabfluss im CF enthalten, aber kein Werbungskostenabzug.';
    if (window.DpPdfBlocksatz) window.DpPdfBlocksatz.absatz(doc, _bsH, { x: M + 5, y: cy + 4.6, breite: CW - 10, zeile: 3.6 });   /* v2830 */
    else doc.text(_bsH, M + 5, cy + 7, { maxWidth: CW - 10 });
    cy += 14;
  }

  // V63.67: BWK an Objekt & Finanzierung anhängen wenn Platz reicht
  // (BWK braucht ca. 75mm; nur neue Seite wenn cy > 200)
  if (cy > 200) {
    cy = newPage('Bewirtschaftungskosten');
  } else {
    cy += 4;
  }
  cy = secH(doc, cy, 'Bewirtschaftungskosten (BWK)', M, CW);
  /* v1895 \u00b7 Dieselbe Kennzeichnung wie im Bank-Expos\u00e9: was DealPilot
     angesetzt hat, traegt `(gesch\u00e4tzt)` am Label. Die Herkunft kommt aus
     `_dp_herkunft`, geschrieben vom Sprechlauf. */
  var _hk1895 = (function () {
    try {
      var e = document.getElementById('_dp_herkunft');
      if (!e || !e.value) return {};
      var o = JSON.parse(e.value);
      return (o && typeof o === 'object') ? o : {};
    } catch (e2) { return {}; }
  })();
  var _gs1895 = 0;
  function _lbl1895(id, label) {
    var t = _hk1895[id];
    if (t == null || String(t).trim() === '') return label;
    if (!/gesch\u00e4tzt|geschaetzt|angesetzt|pauschal|Einstellungen|angenommen/i.test(String(t))) return label;
    _gs1895++;
    return label + '  (gesch\u00e4tzt)';
  }
  cy = kvT(doc, M, cy, CW, [
    [_lbl1895('hg_ul', 'Hausgeld umlagef\u00e4hig / Jahr'),       pE(v('hg_ul'))],
    [_lbl1895('grundsteuer', 'Grundsteuer / Jahr'),               pE(v('grundsteuer'))],
    [_lbl1895('ul_sonst', 'Sonstiges umlagef\u00e4hig'),          pE(v('ul_sonst'))],
    ['Summe umlagef\u00e4hig',                 pE(v('hg_ul') + v('grundsteuer') + v('ul_sonst'))],
    [_lbl1895('hg_nul', 'Hausgeld nicht umlagef\u00e4hig / Jahr'), pE(v('hg_nul'))],
    ['WEG-R\u00fccklage / Jahr (Info)',        pE(v('weg_r'))],
    [_lbl1895('eigen_r', 'Eigene Instandhaltungsr\u00fccklage'),  pE(v('eigen_r'))],
    [_lbl1895('mietausfall', 'Kalkulat. Mietausfall'),            pE(v('mietausfall'))],
    [_lbl1895('nul_sonst', 'Sonderverwaltung'),                   pE(v('nul_sonst'))],
    ['Summe nicht umlagef\u00e4hig',           pE(v('hg_nul') + v('eigen_r') + v('mietausfall') + v('nul_sonst'))],
    ['BWK Gesamt / Jahr',                      pE(K.bwk)],
    ['BWK als % der NKM',                      pP(K.nkm_j > 0 ? K.bwk / K.nkm_j * 100 : 0, 1)]
  ], [3, 9, 10]);
  /* Der Satz steht nur da, wenn wirklich etwas geschaetzt wurde. Ein
     Hinweis an einer Tabelle ohne Schaetzung behauptet eine Unsicherheit,
     die es nicht gibt. */
  if (_gs1895 > 0 && typeof cy === 'number') {
    try {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.4); doc.setTextColor(120);
      doc.splitTextToSize('Die mit (gesch\u00e4tzt) bezeichneten Posten hat DealPilot angesetzt, '
        + 'weil dazu keine Angabe vorlag \u2014 als Anteil der Jahresmiete nach den hinterlegten '
        + 'Standardwerten. Das kalkulatorische Mietausfallwagnis steckt in keiner '
        + 'Hausgeldabrechnung und wird deshalb immer angesetzt.', CW).forEach(function (z, i, a) {
        cy += 3.4;
        if (window.DpPdfBlocksatz) window.DpPdfBlocksatz.zeile(doc, { t: z, ende: i === a.length - 1 }, M, cy, CW, true); else doc.text(z, M, cy);   /* v2830 */
      });
      cy += 3;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 26);
    } catch (e) {}
  }

  setPdfProgress(50);

  /* ══════════════════════════════════════════════════
     SEITE 3b: CASHFLOW-RECHNUNGEN (Heute, EZB, Anschluss)
  ══════════════════════════════════════════════════ */
  cy = newPage('Cashflow-Rechnungen \u00b7 3 Phasen');

  // Intro-Hinweis
  doc.setFillColor.apply(doc, C.SURF2); doc.roundedRect(M, cy, CW, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
  doc.text('Vergleich der Cashflows in 3 Phasen: ' + window._dpPdfJahr1(true) + ', Ende Zinsbindung (' + g('d1_bindj') + ' Jahre), Anschluss (mit kalk. ' + pP(v('anschl_z'), 1) + ')', W/2, cy + 6, { align: 'center' });
  cy += 12;

  var cfColW = (CW - 8) / 3;

  function drawCFCard(x, y, title, accent, data) {
    // V63.51: Bei Tilgungsaussetzung zusätzliche Bauspar-Zeile einbauen
    var hasBspar = (data.bspar || 0) > 0;
    var rows;
    if (hasBspar) {
      rows = [
        ['Mieteinnahmen kalt / Jahr', pE(data.wm)],   /* v2264: wm = NKM + Zusatzeinnahmen, keine Warmmiete */
        ['- Bewirtschaftung', '- ' + pE(data.bwk)],
        ['- Zinsen',            '- ' + pE(data.zins)],
        ['= CF operativ vor BSV',     pE(data.cf_op + data.bspar, true)],
        ['- Bausparrate (BSV)', '- ' + pE(data.bspar)],
        ['- Tilgung',          '- ' + pE(data.tilg)],
        ['- Steuern',          (data.steuer < 0 ? '+ ' : '- ') + pE(Math.abs(data.steuer))],
        ['= CF nach Steuern',         pE(data.cf_ns, true)],
        ['= CF / Monat',              pE(data.cf_ns / 12, true)]
      ];
    } else {
      rows = [
        ['Mieteinnahmen kalt / Jahr', pE(data.wm)],   /* v2264: wm = NKM + Zusatzeinnahmen, keine Warmmiete */
        ['- Bewirtschaftung', '- ' + pE(data.bwk)],
        ['- Zinsen',            '- ' + pE(data.zins)],
        ['= CF operativ',             pE(data.cf_op, true)],
        ['- Tilgung',          '- ' + pE(data.tilg)],
        ['- Steuern',          (data.steuer < 0 ? '+ ' : '- ') + pE(Math.abs(data.steuer))],
        ['= CF nach Steuern',         pE(data.cf_ns, true)],
        ['= CF / Monat',              pE(data.cf_ns / 12, true)]
      ];
    }
    var cardH = hasBspar ? 105 : 95;
    // Card BG
    doc.setFillColor.apply(doc, C.SURF);
    doc.roundedRect(x, y, cfColW, cardH, 2, 2, 'F');
    // Header
    doc.setFillColor.apply(doc, accent);
    doc.rect(x, y, cfColW, 11, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor.apply(doc, C.WHITE);
    doc.text(title, x + cfColW / 2, y + 7, { align: 'center' });
    // Rows
    var ry = y + 14;
    var hlIdx = hasBspar ? [3, 7, 8] : [3, 6, 7];
    var sepIdx = hasBspar ? [3, 6] : [3, 5];
    rows.forEach(function(r, i) {
      var isHL = hlIdx.indexOf(i) !== -1;
      doc.setFont('helvetica', isHL ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, isHL ? C.CH : C.MID);
      doc.text(r[0], x + 3, ry + 4);
      doc.setFont('helvetica', isHL ? 'bold' : 'normal');
      doc.setTextColor.apply(doc, isHL ? C.CH : C.CH);
      doc.text(r[1], x + cfColW - 3, ry + 4, { align: 'right' });
      ry += hlIdx.indexOf(i) !== -1 && (i === hlIdx[0] || i === hlIdx[1]) ? 6.5 : 6;
      if (sepIdx.indexOf(i) !== -1) {
        doc.setDrawColor.apply(doc, C.BORDER);
        doc.setLineWidth(0.2);
        doc.line(x + 3, ry - 1.5, x + cfColW - 3, ry - 1.5);
      }
    });
  }

  // V63.35/V63.51: Bauspar-Rate als eigene CF-Position bei Tilgungsaussetzung.
  // Wichtig: K.cf_op enthält die Bauspar-Rate bereits (abgezogen in calc.js).
  // Für die "vor BSV"-Anzeige addieren wir sie wieder, damit der User sieht
  // wie sich der CF zusammensetzt.
  var _bsparY = (State.bsparRate_m || 0) * 12;
  /* v2463 · Steuer je Phase = Cashflow vor minus nach Steuern (Volljahre, wie die App) -
     gemessen: Ende Zinsbindung 11.216 - 2.467 ergab nicht die gezeigten 8.943. */
  var heuteData = { wm: K.nkm_j, bwk: K.bwk_cf, zins: K.zins_j, tilg: K.tilg_j,
                    cf_op: K.cf_op, steuer: (K.cf_op || 0) - (K.cf_ns || 0), cf_ns: K.cf_ns, bspar: _bsparY };
  var ezbData   = { wm: K.nkm_ezb, bwk: K.bwk_cf_ezb, zins: K.zins_ezb, tilg: K.tilg_ezb,
                    cf_op: K.cf_op_ezb, steuer: (K.cf_op_ezb || 0) - (K.cf_ns_ezb || 0), cf_ns: K.cf_ns_ezb, bspar: _bsparY };
  var anData    = { wm: K.nkm_an, bwk: K.bwk_cf_an, zins: K.zins_an, tilg: K.tilg_an,
                    cf_op: K.cf_op_an, steuer: (K.cf_op_an || 0) - (K.cf_ns_an || 0), cf_ns: K.cf_ns_an, bspar: _bsparY };

  drawCFCard(M,                cy, window._dpPdfJahr1(true).toUpperCase(),     C.GREEN,         heuteData);
  drawCFCard(M + cfColW + 4,   cy, 'ENDE ZINSBINDUNG',                              C.GOLD,     ezbData);
  drawCFCard(M + (cfColW+4)*2, cy, 'ANSCHLUSS (' + pP(v('anschl_z'), 1) + ')',     [231,111,81],     anData);

  cy += (_bsparY > 0 ? 110 : 100);

  // V63.52: Annahmen kommen jetzt ganz am Schluss - wir merken sie nur in einer Variable
  var _annahmenRows = [
    ['Mietentwicklung',               window._dpPdfMiete().text],
    ['Kostensteigerung p.a.',         pP(v('kostenstg'), 1)],
    ['Zinsbindung Hauptdarlehen',     g('d1_bindj') + ' Jahre'],
    ['Anschlusszinssatz (Annahme)',   pP(v('anschl_z'), 1)],
    ['Anschluss-Tilgung (Annahme)',   pP(v('anschl_t'), 1)],
    ['Restschuld am Ende Zinsbindung',pE(State.rs)],
    /* v1383: Seit v1379 rechnet die App die Steuerwirkung als Differenz
       zweier Tarifberechnungen nach \u00a7 32a EStG, nicht mehr mit diesem
       Satz. Ihn im PDF weiter unkommentiert als Annahme zu fuehren, hiesse
       eine Rechengrundlage auszuweisen, die gar nicht mehr greift \u2014 und
       ein PDF ist das, was beim Kunden und beim Finanzamt landet. */
    ['Pers\u00f6nlicher Grenzsteuersatz',
     pP(v('grenz'), 2) + (v('zve') > 0
       ? ' \u2014 Vergleichsgr\u00f6\u00dfe; gerechnet wird nach \u00a7 32a EStG'
       : '')]
  ];

  // V63.66: Wert-Anker für Wertsteigerung (svw > bankval > kp) explizit ausweisen
  if (State.wert_basis && State.wert_basis !== v('kp')) {
    var _wbLabel = (v('svwert') > 0)
      ? 'Verkehrswert (§ 194 BauGB)'
      : (v('bankval') > v('kp'))
        ? 'Bankbewertung'
        : 'Kaufpreis';
    _annahmenRows.push(['Wert-Anker für Wertsteigerung', _wbLabel + ' · ' + pE(State.wert_basis)]);
  }

  if (g('d1_type') === 'tilgungsaussetzung') {
    _annahmenRows.push(['Darlehenstyp D1', 'Tilgungsaussetzung']);
    if (v('bspar_rate') > 0) {
      _annahmenRows.push(['Bausparrate / Monat', pE(v('bspar_rate'))]);
    }
    if (v('bspar_sum') > 0) {
      _annahmenRows.push(['Bausparsumme', pE(v('bspar_sum'))]);
    }
    if (g('bspar_zuteil')) {
      _annahmenRows.push(['BSV-Zuteilungsdatum', g('bspar_zuteil')]);
    }
    // V63.66: Bauspardarlehens-Konditionen
    if (v('bspar_dar_z') > 0) {
      _annahmenRows.push(['Bauspardarlehens-Zins', pP(v('bspar_dar_z'), 2)]);
    }
    if (v('bspar_dar_t') > 0) {
      _annahmenRows.push(['Bauspardarlehens-Tilgung', pP(v('bspar_dar_t'), 2)]);
    }
    if (v('bspar_quote_min') > 0) {
      _annahmenRows.push(['Mindest-Sparquote für Zuteilung', pP(v('bspar_quote_min'), 0)]);
    }
    // V63.66: Aktueller Lifecycle-Status (after_ezb, before_ezb, at_ezb, never)
    if (State.bsvLifecycle && State.bsvLifecycle.zuteilStatus) {
      var _statusLabel = {
        'before_ezb': 'Zuteilung vor Bindungsende',
        'at_ezb':     'Zuteilung am Bindungsende',
        'after_ezb':  'Zuteilung nach Bindungsende',
        'never':      'Mindestquote nicht erreicht'
      }[State.bsvLifecycle.zuteilStatus] || State.bsvLifecycle.zuteilStatus;
      _annahmenRows.push(['BSV-Status', _statusLabel]);
    }
    // V63.66: Sparguthaben am Ende Zinsbindung (aus cfRows berechnet)
    if (State.cfRows && State.cfRows.length > 0) {
      var bindjPdf = parseInt(g('d1_bindj') || 10);
      var ezbRow = State.cfRows[Math.min(bindjPdf - 1, State.cfRows.length - 1)];
      if (ezbRow && ezbRow.bspar_kum > 0) {
        _annahmenRows.push(['Sparguthaben am Bindungsende', pE(ezbRow.bspar_kum)]);
        if (ezbRow.eff_rs != null) {
          _annahmenRows.push(['Effektive Restschuld am Bindungsende', pE(ezbRow.eff_rs) + ' (Bank ' + pE(ezbRow.rs) + ' minus Bausparguthaben)']);
        }
      }
    }
  }
  // _annahmenRows wird am Ende des PDFs in der Annahmen-Seite gerendert

  // 3-Phasen-Kennzahlen-Tabelle (immer auf neue Seite, damit nichts abgeschnitten wird)
  if (State.phaseTable) {
    if (cy > 200) { doc.addPage(); pageNum++; cy = pageTpl(doc, pageNum, 'Kennzahlen-Vergleich \u00b7 3 Phasen', W, M); }
    cy = secH(doc, cy, 'Kennzahlen-Vergleich \u00b7 ' + window._dpPdfJahr1(false) + ' / Ende Zinsbindung / Anschluss', M, CW);   /* v2835 */
    var pt = State.phaseTable;
    // V63.51: Tilgung vs. Bauspar-Rate dynamisch labeln
    var _isAussetzungPhPdf = (g('d1_type') === 'tilgungsaussetzung');
    var _bsparPhPdf = _isAussetzungPhPdf ? (v('bspar_rate') * 12) : 0;
    var _tilgLabel = _isAussetzungPhPdf ? 'Bausparrate / Jahr' : 'Tilgung / Jahr';
    var _tilgNow = _isAussetzungPhPdf ? _bsparPhPdf : pt.now.tilg;
    var _tilgEzb = _isAussetzungPhPdf ? _bsparPhPdf : pt.ezb.tilg;
    var _tilgAn  = _isAussetzungPhPdf ? 0 : pt.an.tilg;
    var rows = [
      ['Mieteinnahmen / Jahr (NKM+ZE)', pE(pt.now.wm), pE(pt.ezb.wm), pE(pt.an.wm)],
      ['Bewirt. nicht-umlagef. / Jahr', '-' + pE(pt.now.bwk), '-' + pE(pt.ezb.bwk), '-' + pE(pt.an.bwk)],
      ['Zinsen / Jahr', '-' + pE(pt.now.zins), '-' + pE(pt.ezb.zins), '-' + pE(pt.an.zins)],
      [_tilgLabel, '-' + pE(_tilgNow), '-' + pE(_tilgEzb), '-' + pE(_tilgAn)],
      ['CF vor Steuern / Jahr', pE(pt.now.cfvst, true), pE(pt.ezb.cfvst, true), pE(pt.an.cfvst, true)],
      // V63.83 Bug-Fix: pE(..., true) liefert bereits Vorzeichen (+/-).
      // Vorher: hardcoded "-" davor → bei Erstattung (negativ) wurde "--663" angezeigt.
      // Steuer-Wert: positiv = Belastung, negativ = Erstattung. Wir drehen Vorzeichen für die Anzeige
      // (Zahllast-Sicht: + = Geld weg, - = Geld zurück), damit es wie im Frontend "± Steuer" wirkt.
      ['Steuern / Jahr', pE(pt.now.cfns - pt.now.cfvst, true), pE(pt.ezb.cfns - pt.ezb.cfvst, true), pE(pt.an.cfns - pt.an.cfvst, true)],   /* v2463: Differenz, wie die App (ph-st-now) */
      ['CF nach Steuern / Jahr', pE(pt.now.cfns, true), pE(pt.ezb.cfns, true), pE(pt.an.cfns, true)],
      ['CF nach Steuern / Monat', pE(pt.now.cfns / 12, true), pE(pt.ezb.cfns / 12, true), pE(pt.an.cfns / 12, true)],
      ['Bruttomietrendite', pP(pt.now.bmy, 2), pP(pt.ezb.bmy, 2), pP(pt.an.bmy, 2)],
      ['Nettomietrendite', pP(pt.now.nmy, 2), pP(pt.ezb.nmy, 2), pP(pt.an.nmy, 2)],
      ['DSCR', pt.now.dscr.toFixed(2), pt.ezb.dscr.toFixed(2), pt.an.dscr.toFixed(2)],
      ['LTV', pP(pt.now.ltv, 1), pP(pt.ezb.ltv, 1), pP(pt.an.ltv, 1)],
      ['Restschuld', pE(pt.now.rs), pE(pt.ezb.rs), pE(pt.an.rs)],
      ['Immobilienwert', pE(pt.now.wert), pE(pt.ezb.wert), pE(pt.an.wert)],
      ['Eigenkapital im Objekt', pE(pt.now.eq), pE(pt.ezb.eq), pE(pt.an.eq)]
    ];
    doc.autoTable({
      startY: cy,
      head: [['Kennzahl', window._dpPdfJahr1(false), 'Ende Zinsbindung', 'Anschluss']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [42, 39, 39], textColor: C.GOLD, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 246, 240] },
      columnStyles: {
        0: { halign: 'left', cellWidth: 60 },
        1: { halign: 'right', cellWidth: 38 },
        2: { halign: 'right', cellWidth: 42 },
        3: { halign: 'right', cellWidth: 38 }
      },
      didParseCell: function(data) {
        // Force header alignment matching its column
        if (data.section === 'head') {
          if (data.column.index === 0) data.cell.styles.halign = 'left';
          else data.cell.styles.halign = 'right';
        }
        // V63.48: Farbgebung der Kennzahlen-Werte
        if (data.section === 'body' && data.column.index >= 1) {
          var label = String((rows[data.row.index] || [])[0] || '');
          var txt = String(data.cell.text[0] || '');
          // CF-Zeilen: + grün, - rot
          if (label.indexOf('CF') === 0 || label.indexOf('Cashflow') === 0) {
            if (txt.charAt(0) === '+') {
              data.cell.styles.textColor = [63, 165, 108];
              data.cell.styles.fontStyle = 'bold';
            } else if (txt.charAt(0) === '-') {
              data.cell.styles.textColor = [184, 98, 92];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // v2240: LTV rot ueber 100, gold ueber max_ltv (Einstellung, Vorgabe 90), sonst gruen
          if (label === 'LTV') {
            var lv = parseFloat(txt.replace('%', '').replace(',', '.'));
            if (!isNaN(lv)) {
              if (lv > _pdfSw().ltvRot) data.cell.styles.textColor = [184, 98, 92];
              else if (lv > _pdfSw().ltvGruen) data.cell.styles.textColor = [184, 151, 64];
              else data.cell.styles.textColor = [63, 165, 108];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // v2240: DSCR rot unter dscrGelb, gold bis min_dscr (Einstellung, Vorgabe 1,0 / 1,2), sonst gruen
          if (label === 'DSCR') {
            var dv = parseFloat(txt.replace(',', '.'));
            if (!isNaN(dv)) {
              if (dv < _pdfSw().dscrGelb) data.cell.styles.textColor = [184, 98, 92];
              else if (dv < _pdfSw().dscrGruen) data.cell.styles.textColor = [184, 151, 64];
              else data.cell.styles.textColor = [63, 165, 108];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Bewirt./Zinsen/Tilgung: rot (negative Größen)
          if (label.indexOf('Bewirt') === 0 || label === 'Zinsen / Jahr' || label === 'Tilgung / Jahr' || label === 'Bausparrate / Jahr') {
            if (txt.charAt(0) === '-') data.cell.styles.textColor = [184, 98, 92];
          }
          // Steuern: grün wenn +, rot wenn -
          if (label === 'Steuern / Jahr') {
            if (txt.charAt(0) === '+') data.cell.styles.textColor = [63, 165, 108];
            else if (txt.charAt(0) === '-') data.cell.styles.textColor = [184, 98, 92];
          }
        }
      },
      margin: { left: M, right: M }
    });
    cy = doc.lastAutoTable.finalY + 4;

    // V63.47/67: Zinsänderungsrisiko · Detail - versucht auf gleicher Seite zu bleiben
    var zaerExists = document.getElementById('zaer-zins-now');
    if (zaerExists) {
      // Block braucht ~50mm - nur neue Seite wenn echt knapp
      if (cy > 245) { doc.addPage(); pageNum++; cy = pageTpl(doc, pageNum, 'Zinsänderungsrisiko · Detail', W, M); }
      cy = secH(doc, cy, 'Zinsänderungsrisiko · Detail', M, CW);
      var _zT = function(id) { var el = document.getElementById(id); return (el && el.textContent.trim()) || '-'; };
      var zaerRows = [
        ['Zinssatz',                 _zT('zaer-zins-now'),  _zT('zaer-zins-ezb'),  _zT('zaer-zins-an')],
        ['Monatliche Rate',          _zT('zaer-rate-now').replace(/^\+/, ''),  _zT('zaer-rate-ezb').replace(/^\+/, ''),  _zT('zaer-rate-an').replace(/^\+/, '')],
        ['CF/Mon (vor Steuer)',      _zT('zaer-cfvst-now'), _zT('zaer-cfvst-ezb'), _zT('zaer-cfvst-an')],
        ['CF/Mon (nach Steuer)',     _zT('zaer-cf-now'),    _zT('zaer-cf-ezb'),    _zT('zaer-cf-an')],
        ['DSCR',                     _zT('zaer-dscr-now'),  _zT('zaer-dscr-ezb'),  _zT('zaer-dscr-an')],
        ['Differenz Rate ggü. Heute', '-',                   _zT('zaer-drate-ezb'), _zT('zaer-drate-an')]
      ];
      doc.autoTable({
        startY: cy,
        head: [['Kennzahl', window._dpPdfJahr1(false), 'Ende Zinsbindung', 'Anschluss']],
        body: zaerRows,
        theme: 'striped',
        headStyles: { fillColor: [42, 39, 39], textColor: C.GOLD, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 246, 240] },
        columnStyles: {
          0: { halign: 'left', cellWidth: 60 },
          1: { halign: 'right', cellWidth: 38 },
          2: { halign: 'right', cellWidth: 42 },
          3: { halign: 'right', cellWidth: 38 }
        },
        didParseCell: function(data) {
          if (data.section === 'head') {
            if (data.column.index === 0) data.cell.styles.halign = 'left';
            else data.cell.styles.halign = 'right';
          }
          // Letzte Zeile (Differenz Rate) hervorheben
          if (data.section === 'body' && data.row.index === 5) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [250, 245, 230];
          }
          // V63.48: CF-Zeilen einfärben + DSCR
          if (data.section === 'body' && data.column.index >= 1) {
            var rIdx = data.row.index;
            var txt2 = String(data.cell.text[0] || '');
            // Zeile 2,3 = CF (vor/nach Steuer)
            if (rIdx === 2 || rIdx === 3) {
              if (txt2.indexOf('+') !== -1) data.cell.styles.textColor = [63, 165, 108];
              else if (txt2.indexOf('-') !== -1 || txt2.charAt(0) === '-') data.cell.styles.textColor = [184, 98, 92];
            }
            // Zeile 4 = DSCR
            if (rIdx === 4) {
              var dv = parseFloat(txt2.replace(',', '.'));
              if (!isNaN(dv)) {
                if (dv < _pdfSw().dscrGelb) data.cell.styles.textColor = [184, 98, 92];          /* v2240 */
                else if (dv < _pdfSw().dscrGruen) data.cell.styles.textColor = [184, 151, 64];
                else data.cell.styles.textColor = [63, 165, 108];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        },
        margin: { left: M, right: M }
      });
      cy = doc.lastAutoTable.finalY + 4;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, C.MID);
      doc.text('Vergleich der Belastung über die drei Phasen - zeigt, wie stark die Anschlussfinanzierung gegenüber heute durchschlägt.', M, cy);
      cy += 5;
    }
  }

  setPdfProgress(58);

  /* ══════════════════════════════════════════════════
     CASHFLOW-PROJEKTION
     V63.92/V63.93: Auf gleicher Seite wie Zinsänderungs-Detail (Marcels Wunsch).
     V63.94: Canvas-Capture komplett raus (Marcels Bug: Tabelle schrumpft auf
     ~50% Seitenbreite). Stattdessen native AutoTable mit 9 wichtigsten Spalten
     auf voller Seitenbreite — gut lesbar, professionell, scharf.
  ══════════════════════════════════════════════════ */
  console.log('[pdf] V63.94 CF-Projektion start, cy=' + cy + ' (Schwelle: > 175)');
  if (cy > 175) {
    cy = newPage('Cashflow-Projektion ' + g('btj') + ' Jahre');
  } else {
    cy += 3;
    cy = secH(doc, cy, 'Cashflow-Projektion ' + g('btj') + ' Jahre', M, CW);
  }

  // Annahmen-Leiste — kompakt, zentriert
  doc.setFillColor.apply(doc, C.SURF2); doc.roundedRect(M, cy, CW, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, C.MID);
  doc.text(
    'Miete ' + window._dpPdfMiete().text + '  \u00b7  Wertstg. ' + pP(v('wertstg'), 1) +
    '  \u00b7  Kostenstg. ' + pP(v('kostenstg'), 1) + '  \u00b7  Anschluss ' + pP(v('anschl_z'), 1) +
    ' ab Jahr ' + g('d1_bindj') + '  \u00b7  Exit-BMY ' + pP(v('exit_bmy'), 1),
    W / 2, cy + 4.2, { align: 'center' }
  );
  cy += 8;

  // V63.95: Native AutoTable — 15 Spalten 1:1 zum Frontend (Marcels Wunsch).
  // Jede € Zahl mit "€"-Suffix, Sum-Row dezent (heller Goldtint mit Goldborder oben),
  // dunkler Header genau wie Frontend.
  if (State.cfRows && State.cfRows.length && doc.autoTable) {
    var bjY = v('d1_bindj');
    var _hasBsparProj = State.cfRows.some(function(r) { return (r.bspar_y || 0) > 0; });

    // V63.99: Marcels Fixes
    //  - BWK n.u.-Spalte raus (war noch zu eng) → 13 Spalten
    //  - Goldene Sum-Row komplett raus (Marcel: "kann weg")
    //  - overflow:visible für Body damit "251.546 €" und "+1.470 €" nicht in 2 Zeilen umbricht
    var _projHead = [
      'Jahr',
      'NKM\n/Mon',
      'Zinsen',
      _hasBsparProj ? 'BSV-Rate' : 'Tilgung',
      'CF v.St./J',
      'CF v.St./M',
      '\u00b1 Steuer',
      'CF n.St./J',
      'CF n.St./M',
      'Restschuld',
      'Immo-Wert',
      'EK Obj',
      'LTV'
    ];

    // Helper: Wert mit € Suffix
    function eFmt(n, signed) {
      if (n == null) return '-';
      var s = pE(n, signed);
      return s + ' \u20ac';
    }
    function eFmtNeg(n) {
      return '-' + pE(n) + ' \u20ac';
    }

    var _projBody = State.cfRows.map(function(r) {
      // V65.3: Defensive Werte gegen null/undefined — bei Tilgungsaussetzung +
      // Bausparvertrag + D2 können einzelne Felder NaN/undefined sein.
      // Vorher: r.ltv_y.toFixed(0) crashte wenn ltv_y undefined.
      var _ltv = (r.ltv_y == null || isNaN(r.ltv_y)) ? 0 : r.ltv_y;
      var _zy  = (r.zy  == null || isNaN(r.zy))  ? 0 : r.zy;
      var _rs  = (r.rs  == null || isNaN(r.rs))  ? 0 : r.rs;
      var _wert= (r.wert_y == null || isNaN(r.wert_y)) ? 0 : r.wert_y;
      var _eq  = (r.eq_y == null || isNaN(r.eq_y)) ? 0 : r.eq_y;
      var _nkm = (r.nkm_m == null || isNaN(r.nkm_m)) ? 0 : r.nkm_m;
      var _cfop= (r.cfop_y == null || isNaN(r.cfop_y)) ? 0 : r.cfop_y;
      var _cfns= (r.cfns_y == null || isNaN(r.cfns_y)) ? 0 : r.cfns_y;
      var _tax = (r.tax_y == null || isNaN(r.tax_y)) ? 0 : r.tax_y;
      var _ty  = (r.ty   == null || isNaN(r.ty))  ? 0 : r.ty;
      var _bspar = (r.bspar_y == null || isNaN(r.bspar_y)) ? 0 : r.bspar_y;
      var cf_vst_j = _cfop;
      var cf_vst_m = cf_vst_j / 12;
      var cf_ns_m  = _cfns / 12;
      var tilgOrBspar = _hasBsparProj ? _bspar : _ty;
      return [
        String(r.cal != null ? r.cal : '-'),
        eFmt(_nkm),
        eFmtNeg(_zy),
        eFmtNeg(tilgOrBspar),
        eFmt(cf_vst_j, true),
        eFmt(cf_vst_m, true),
        eFmt(-_tax, true),
        eFmt(_cfns, true),
        eFmt(cf_ns_m, true),
        eFmt(_rs),
        eFmt(_wert),
        eFmt(_eq),
        _ltv.toFixed(0) + ' %'
      ];
    });

    // V63.99: Sum-Row/Mittel-Zeile komplett raus (Marcels Wunsch)
    var _lastRow = State.cfRows[State.cfRows.length - 1];

    // V63.99: Standard-Margin (15mm), Tabelle 180mm
    var _tblM = M;
    var _tblW = CW;

    doc.autoTable({
      head: [_projHead],
      body: _projBody,
      // V63.99: foot komplett entfernt (Marcels Wunsch — Mittel-Zeile raus)
      startY: cy,
      theme: 'plain',
      tableWidth: _tblW,
      headStyles: {
        fillColor: [42, 39, 39],
        textColor: C.GOLD,
        fontSize: 7.0,
        fontStyle: 'bold',
        font: 'helvetica',
        halign: 'right',
        valign: 'middle',
        cellPadding: { top: 4, bottom: 4, left: 1.5, right: 1.5 },
        lineWidth: 0.1,
        lineColor: [60, 55, 50],
        overflow: 'linebreak',          // Headers dürfen umbrechen, 2 Zeilen reserviert
        minCellHeight: 12
      },
      // V63.99: Body overflow visible — Werte wie "+1.470 €" und "251.546 €" sollen NICHT
      // in zweite Zeile umbrechen (Marcels Bild zeigte Restschuld/Immo-Wert mit € auf Zeile 2)
      bodyStyles: {
        fontSize: 7.5,
        font: 'helvetica',
        halign: 'right',
        cellPadding: { top: 3, bottom: 3, left: 1.5, right: 1.5 },
        textColor: [42, 39, 39],
        lineWidth: 0,
        lineColor: [240, 236, 226],
        overflow: 'visible'
      },
      columnStyles: {
        // V63.99: 13 Spalten auf 180mm (CW). BWK n.u. raus + breitere Spalten für lange €-Werte.
        // Lange Spalten (Restschuld, Immo-Wert): 16mm — die brauchen Platz für "251.546 €"
        // Summe = 9 + 13 + 14 + 14 + 14 + 13 + 14 + 14 + 13 + 16 + 16 + 14 + 16 = 180mm ✓
        0:  { halign: 'left',  fontStyle: 'bold', cellWidth: 9,  textColor: [42, 39, 39] }, // Jahr
        1:  { cellWidth: 13 },  // NKM/Mon
        2:  { cellWidth: 14 },  // Zinsen
        3:  { cellWidth: 14 },  // Tilgung / BSV-Rate
        4:  { cellWidth: 14 },  // CF v.St./J
        5:  { cellWidth: 13 },  // CF v.St./M
        6:  { cellWidth: 14 },  // ± Steuer
        7:  { cellWidth: 14 },  // CF n.St./J
        8:  { cellWidth: 13 },  // CF n.St./M
        9:  { cellWidth: 16 },  // Restschuld (lang!)
        10: { cellWidth: 16 },  // Immo-Wert (lang!)
        11: { cellWidth: 14 },  // EK Obj
        12: { cellWidth: 16 }   // LTV
      },
      alternateRowStyles: { fillColor: [253, 252, 247] },
      didDrawCell: function(d) {
        // Body — nur untere Linie wie Frontend
        if (d.section === 'body') {
          doc.setDrawColor(240, 236, 226);
          doc.setLineWidth(0.15);
          doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        }
      },
      didParseCell: function(d) {
        var ci = d.column.index;
        var txt = String(d.cell.text[0] || '');

        // V63.99: Spalten-Indices für 13 Spalten (BWK n.u. raus)
        // 0=Jahr 1=NKM 2=Zins 3=Tilg 4=CFvJ 5=CFvM 6=±St 7=CFnJ 8=CFnM 9=RS 10=Wert 11=EK 12=LTV
        if (d.section !== 'body') return;
        var ri = d.row.index;

        // V65.3: Goldene Hervorhebung am Ende-Zinsbindung RAUS (Marcels Wunsch).
        // Vorher wurde diese Zeile mit fillColor gold gefüllt + bold gemacht — nicht mehr.

        // Zins/Tilg (2-3): rot Abzüge
        if (ci >= 2 && ci <= 3) {
          d.cell.styles.textColor = [184, 98, 92];
        }
        // CF v.St./J (4), CF v.St./M (5): pos/neg
        if (ci === 4 || ci === 5) {
          if (txt.charAt(0) === '+') {
            d.cell.styles.textColor = [63, 165, 108];
            d.cell.styles.fontStyle = 'bold';
          } else if (txt.charAt(0) === '-' || txt.charAt(0) === '-') {
            d.cell.styles.textColor = [184, 98, 92];
            d.cell.styles.fontStyle = 'bold';
          }
        }
        // ± Steuer (6): pos/neg
        if (ci === 6) {
          if (txt.charAt(0) === '+') d.cell.styles.textColor = [63, 165, 108];
          else if (txt.charAt(0) === '-' || txt.charAt(0) === '-') d.cell.styles.textColor = [184, 98, 92];
        }
        // CF n.St./J (7), CF n.St./M (8): pos/neg
        if (ci === 7 || ci === 8) {
          if (txt.charAt(0) === '+') {
            d.cell.styles.textColor = [63, 165, 108];
            d.cell.styles.fontStyle = 'bold';
          } else if (txt.charAt(0) === '-' || txt.charAt(0) === '-') {
            d.cell.styles.textColor = [184, 98, 92];
            d.cell.styles.fontStyle = 'bold';
          }
        }
        // Restschuld (9): grau
        if (ci === 9) d.cell.styles.textColor = [120, 110, 100];
        // EK Obj (11): grün
        if (ci === 11) d.cell.styles.textColor = [63, 165, 108];
        // LTV (12): farbig nach Skala
        if (ci === 12) {
          var lv = parseFloat(txt.replace('%', '').trim());
          if (!isNaN(lv)) {
            if (lv > _pdfSw().ltvRot) d.cell.styles.textColor = [184, 98, 92];          /* v2240 */
            else if (lv > _pdfSw().ltvGruen) d.cell.styles.textColor = [184, 151, 64];
            else d.cell.styles.textColor = [63, 165, 108];
            d.cell.styles.fontStyle = 'bold';
          }
        }
      },
      /* v2463 · die Fortsetzungsseite hatte weder Kopf noch Fuss und keine
         Seitennummer (alle folgenden Nummern lagen um eins daneben). */
      margin: { left: _tblM, right: _tblM, top: 30, bottom: 16 },
      didDrawPage: function (dp) {
        if (dp.pageNumber > 1 && doc.internal.getNumberOfPages() > pageNum) {
          pageNum++; pageTpl(doc, pageNum, 'Cashflow-Projektion \u00b7 Fortsetzung', W, M);
        }
      }
    });
    cy = doc.lastAutoTable.finalY + 4;

    // V65.3: Legende ohne "Goldene Zeile = ..." (Marcel hat die Hervorhebung entfernt)
    // V191: Unicode math-minus (-) durch ASCII "-" ersetzt — jsPDF helvetica
    // rendert ihn nicht zuverlässig, was zu Sperrschrift-Optik führt. ± durch +/-.
    // Umlaute (CP1252) bleiben.
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, C.MID);
    doc.text('Alle Werte in EUR' +
             (_hasBsparProj ? '  \u00b7  BSV-Rate statt Tilgung (Tilgungsaussetzung)' : ''), _tblM, cy);
    cy += 3.5;
    /* v2463 · lief 9 mm über den rechten Rand, und „ohne Tilgung" stimmte nicht:
       gemessen CF n.St./J 2027 = 7.965 - 388 = 7.577, also nach Tilgung. */
    doc.splitTextToSize('CF v.St./J = NKM - Bewirt. n.uml. - Zinsen - Tilgung (was wirklich am Konto bleibt, vor Steuer)  \u00b7  CF n.St./J = CF v.St./J +/- Steuer', _tblW).forEach(function (z) { doc.text(z, _tblM, cy); cy += 3.5; });
    doc.text('LTV-F\u00e4rbung: gr\u00fcn bis ' + _pdfSw().ltvGruenTxt + ' %  \u00b7  gold ' + _pdfSw().ltvGruenTxt + '-' + _pdfSw().ltvRotTxt + ' %  \u00b7  rot \u00fcber ' + _pdfSw().ltvRotTxt + ' %  \u00b7  Anschluss-Konditionen ab Jahr ' + g('d1_bindj') + ': ' + pP(v('anschl_z'), 1) + ' / ' + pP(v('anschl_t'), 1), _tblM, cy);
    cy += 6;
    console.log('[pdf] V63.99 CF-Projektion 13-Spalten (ohne BWK n.u., ohne Sum-Row), finalY=' + cy);
  }

  // V63.94: Alter 15-Spalten-AutoTable-Fallback entfernt.
  // Neuer schlanker 9-Spalten-AutoTable oben ist jetzt der primäre Pfad.

  setPdfProgress(65);

  /* ══════════════════════════════════════════════════
     SEITE 4b: VERMÖGENSAUFBAU & IMMOBILIENSCHERE (Charts)
  ══════════════════════════════════════════════════ */
  // V63.90: Charts auf Tab 7 (Kennzahlen, s7) müssen sichtbar sein, damit Chart.js sie rendert.
  // Vorher wurde Tab 6 (KI-Analyse) aktiviert — User wurde nach PDF-Klick fälschlicherweise
  // in der KI-Analyse "abgesetzt" und Charts rendern nicht (auf falschem Tab).
  // Konsequenz: Wasserfall + Stress fehlen im PDF, weil nur Cockpit programmatisch gezeichnet wird.
  var prevActiveTab = -1;
  document.querySelectorAll('.tab').forEach(function(t, i) {
    if (t.classList.contains('active')) prevActiveTab = i;
  });

  // V63.90: Force tab 7 (Kennzahlen) active so charts render
  // Wichtig: Sektionen werden normal indexiert (Index = DOM-Position bei :not(.sec-hidden) — siehe ui.js switchTab)
  // Wir nehmen denselben Filter um konsistent zur switchTab-Logik zu bleiben.
  var _allSecs = document.querySelectorAll('.sec:not(.sec-hidden)');
  _allSecs.forEach(function(s, j) { s.classList.toggle('active', j === 7); });

  if (typeof buildCharts === 'function') {
    try { buildCharts(); } catch(e) { console.warn('buildCharts failed:', e); }
  }
  // Sicherstellen, dass Bank-Charts gerendert sind (rendert auch wenn Tab nicht offen)
  if (window.BankCharts && window.BankCharts.renderAll) {
    try { window.BankCharts.renderAll(State); } catch(e) { console.warn('BankCharts.renderAll failed:', e); }
  } else {
    console.warn('[pdf] window.BankCharts nicht verfügbar - Charts werden im PDF fehlen');
  }

  // V63.90: Stress-Test-Daten explizit erzwingen — auch wenn der Host-Container
  // nicht im DOM ist (z.B. weil Tab nicht aktiv beim PDF-Aufruf), legt der Renderer
  // window.BankCharts._lastStressData an, das _drawStressMatrix später konsumiert.
  if (window.BankCharts && window.BankCharts.renderStressMatrix && State && State.cfRows && State.cfRows.length >= 2) {
    var _stressHost = document.getElementById('bc-stress') || document.createElement('div');
    try { window.BankCharts.renderStressMatrix(_stressHost, State); } catch(e) { console.warn('Stress-Render failed:', e); }
  }

  // V63.68: Längere Wartezeit + 2 Render-Frames damit SVG sicher gemalt sind
  await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });
  await new Promise(function(r) { setTimeout(r, 800); });

  // V63.71: Diagnose-Log VOR dem Capture - sehen ob die Charts überhaupt im DOM sind
  ['bc-equity', 'bc-cockpit', 'bc-waterfall', 'bc-stress'].forEach(function(id) {
    var el = document.getElementById(id);
    var svg = el && el.querySelector('svg');
    console.log('[pdf-pre] ' + id + ': host=' + !!el + ', svg=' + !!svg +
      (svg ? ', viewBox=' + svg.getAttribute('viewBox') : ''));
  });

  // V63.67: Bank-Charts (SVG) als PNG. V63.71: Stress wird programmatisch in jsPDF gezeichnet.
  var equityChart    = await captureBankChartSvg('bc-equity', 2);
  var cockpitChart   = await captureBankChartSvg('bc-cockpit', 2);
  var waterfallChart = await captureBankChartSvg('bc-waterfall', 2);

  // V63.68/71: Diagnose-Log
  console.log('[pdf] Bank-Charts captured:', {
    equity: !!equityChart && (equityChart.dataUrl||'').length,
    cockpit: !!cockpitChart && (cockpitChart.dataUrl||'').length,
    waterfall: !!waterfallChart && (waterfallChart.dataUrl||'').length,
    stress: 'programmatisch'
  });

  if (!equityChart && !cockpitChart && !waterfallChart) {
    console.warn('[pdf] Keine Bank-Charts captured - bitte Tab "Kennzahlen" einmal öffnen vor PDF-Export');
  }

  // V63.90: Restore previous tab visually after capture — gleicher Filter wie beim Setzen
  if (prevActiveTab >= 0) {
    _allSecs.forEach(function(s, j) { s.classList.toggle('active', j === prevActiveTab); });
  }

  // V63.72: Helper - liest die DOM-Card-Daten (gleicher Code wie in bank-pdf.js)
  function _readCardDataFromDom(hostId) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    var card = host.querySelector('.bc-card');
    if (!card) return null;

    /* v2463 · Texte aus der Oberfläche tragen U+2212 (Minus) - die Standardschrift
       kennt es nicht, im PDF stand „' 46.092 €". */
    var _pdfT = function (t) { return String(t || '').replace(/[\u2212\u2011\u2012\u2013]/g, '-').replace(/[\u00a0\u202f]/g, ' ').replace(/[^\x00-\xFF\u20AC\u2014]/g, ''); };
    var eyebrow = _pdfT((card.querySelector('.bc-head-eyebrow') || {}).textContent || '');
    var title = _pdfT((card.querySelector('.bc-head-title') || {}).textContent || '');
    var sub = _pdfT((card.querySelector('.bc-head-sub') || {}).textContent || '');
    var headlineKpi = (card.querySelector('.bc-headline-kpi') || {}).textContent || '';
    var headlineKpiLabel = (card.querySelector('.bc-headline-kpi-label') || {}).textContent || '';
    var footerCells = Array.prototype.slice.call(card.querySelectorAll('.bc-footer-cell'));
    var footer = footerCells.map(function(cell) {
      return {
        label: _pdfT((cell.querySelector('.bc-footer-label') || {}).textContent || '').trim(),
        value: _pdfT((cell.querySelector('.bc-footer-value') || {}).textContent || '').trim(),
        sub:   _pdfT((cell.querySelector('.bc-footer-sub')   || {}).textContent || '').trim()
      };
    });
    return {
      eyebrow: eyebrow.trim(),
      title: title.trim(),
      sub: sub.trim(),
      headlineKpi: headlineKpi.trim(),
      headlineKpiLabel: headlineKpiLabel.trim(),
      footer: footer
    };
  }

  // V63.72: Helper - ein Chart auf eigene Seite rendern, jetzt mit dem reichhaltigen
  // Layout aus dem Tab Kennzahlen: Eyebrow, Headline-Story (Title + Sub), Chart, Footer-KPIs.
  // Fällt auf simplere Variante zurück wenn keine Card-Daten verfügbar.
  function _drawChartOnPage(chart, title, sub, hostId) {
    cy = newPage(title);
    cy += 4; // V63.73: mehr Luft vom Header (User-Wunsch: "nicht direkt an Kopfzeile")
    var data = hostId ? _readCardDataFromDom(hostId) : null;

    if (data && (data.title || data.eyebrow)) {
      // ── Reichhaltiger Header (wie Bank-Präsentation / Tab Kennzahlen) ──
      // Eyebrow (Gold, klein, gespert)
      if (data.eyebrow) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.setTextColor.apply(doc, C.GOLD_D);
        doc.text(data.eyebrow.toUpperCase(), M, cy);
        cy += 5;
      }
      // Title (groß, serif, Story-Headline)
      if (data.title) {
        doc.setFont('times', 'normal'); doc.setFontSize(18);
        doc.setTextColor(42, 39, 39);
        var titleLines = doc.splitTextToSize(data.title, CW);
        titleLines.forEach(function(l) {
          doc.text(l, M, cy);
          cy += 7;
        });
      }
      // Sub-Text
      if (data.sub) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.setTextColor(120, 115, 110);
        var subLines = doc.splitTextToSize(data.sub, CW);
        subLines.forEach(function(l) {
          doc.text(l, M, cy);
          cy += 4.5;
        });
      }
      // Trennlinie
      cy += 2;
      doc.setDrawColor.apply(doc, C.GOLD_L);
      doc.setLineWidth(0.3);
      doc.line(M, cy, M + CW, cy);
      cy += 4;
    } else if (sub) {
      // ── Fallback: einfache Variante (wenn Card nicht im DOM) ──
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, C.MID);
      doc.text(sub, M, cy);
      cy += 5;
    }

    if (!chart) {
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'F');
      doc.setDrawColor.apply(doc, C.GOLD);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text('Chart konnte nicht gerendert werden', M + 5, cy + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(80, 75, 70);
      doc.text([
        'Tipp: Tab "Kennzahlen" einmal öffnen, kurz warten bis die Charts',
        'sichtbar sind, dann erneut den PDF-Export starten.'
      ], M + 5, cy + 14);
      cy += 30;
      return;
    }

    // V63.72: Footer-KPIs reservieren Platz, falls vorhanden
    var hasFooter = data && data.footer && data.footer.length > 0;
    var footerH = hasFooter ? 22 : 0; // 16mm Box + 6mm Abstand
    var availableH = 280 - cy - footerH - 8;

    var ratio = chart.width / chart.height;
    var maxW  = CW;
    var imgW  = maxW;
    var imgH  = imgW / ratio;
    if (imgH > availableH) { imgH = availableH; imgW = imgH * ratio; }
    if (imgH < 50) imgH = 50; // Minimum
    var imgX = M + (CW - imgW) / 2;
    try {
      // V184: Chart-Format = JPEG (siehe _imgFromUrl); mimeType-Fallback
      doc.addImage(chart.dataUrl, chart.mimeType || 'JPEG', imgX, cy, imgW, imgH);
      cy += imgH + 6;
    } catch(e) {
      console.warn('[pdf] addImage Fehler für ' + title + ':', e.message);
      cy += 10;
    }

    // V63.72: Footer-KPI-Boxen (wie Bank-Präsentation)
    // V63.90: Limit auf 5 erhöht — Equity-Build hat 5 Boxen (EK, Tilgung, CF, Steuer, Wertsteigerung)
    // und die Wertsteigerung wurde vorher abgeschnitten ("im PDF fehlt Wertsteigerung").
    if (hasFooter) {
      var nF = Math.min(data.footer.length, 5);
      var fW = (CW - (nF - 1) * 2.5) / nF;
      var fH = 16;
      var fY = cy;
      data.footer.slice(0, nF).forEach(function(cell, i) {
        var fX = M + i * (fW + 2.5);
        doc.setDrawColor.apply(doc, C.GOLD_L);
        doc.setFillColor(248, 246, 241);
        doc.setLineWidth(0.3);
        doc.rect(fX, fY, fW, fH, 'FD');
        doc.setFillColor.apply(doc, C.GOLD);
        doc.rect(fX, fY, fW, 0.8, 'F'); // Top-Streifen
        // Label — V63.90: kleinere Schrift bei 5 Boxen damit nichts überlappt
        doc.setFont('helvetica', 'bold'); doc.setFontSize(nF >= 5 ? 6.4 : 7);
        doc.setTextColor.apply(doc, C.GOLD_D);
        var labelLines = doc.splitTextToSize(cell.label.toUpperCase(), fW - 4);
        doc.text(labelLines[0] || '', fX + 2.5, fY + 4);
        // Value
        doc.setFont('helvetica', 'bold'); doc.setFontSize(nF >= 5 ? 9.5 : 11);
        doc.setTextColor(42, 39, 39);
        doc.text(cell.value, fX + 2.5, fY + 9.5);
        // Sub
        if (cell.sub) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(nF >= 5 ? 6.4 : 7);
          doc.setTextColor(120, 115, 110);
          var subS = doc.splitTextToSize(cell.sub, fW - 5);
          doc.text(subS[0] || '', fX + 2.5, fY + 13.5);
        }
      });
      cy = fY + fH + 4;
    }
  }

  // V63.71: Stress-Test wird programmatisch in jsPDF gezeichnet (HTML-Grid lässt sich
  // nicht via SVG->PNG capturen). Daten kommen aus window.BankCharts._lastStressData.
  function _drawStressMatrix(title, sub) {
    cy = newPage(title);
    cy += 4; // V63.73: mehr Luft vom Header
    if (sub) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, C.MID);
      doc.text(sub, M, cy);
      cy += 6;
    }
    var data = window.BankCharts && window.BankCharts._lastStressData;
    if (!data || !data.matrix) {
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'F');
      doc.setDrawColor.apply(doc, C.GOLD);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text('Stress-Test-Daten nicht verfügbar', M + 5, cy + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(80, 75, 70);
      doc.text('Tab "Kennzahlen" einmal öffnen, dann erneut PDF-Export starten.', M + 5, cy + 14);
      cy += 30;
      return;
    }

    var matrix = data.matrix;
    var zinsSzen = data.zinsSzen; // [5.0, 3.0, 1.0, 0.0, -2.0]
    var mietSzen = data.mietSzen; // [-20, -10, 0, 10, 20]

    // Layout: linke Y-Achse 22mm, 5 Spalten × 28mm = 140mm, oben X-Achse 14mm, 5 Zeilen × 16mm = 80mm
    var ax = 22, ay = 14;
    var cellW = 28, cellH = 16;
    var matX = M + ax;
    var matY = cy + ay;

    // Titel-Achsen
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(80, 75, 70);
    doc.text('Mietausfall / -veränderung', matX + (5 * cellW) / 2, cy + 5, { align: 'center' });

    // X-Achse (Mietausfall)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(120, 115, 110);
    mietSzen.forEach(function(m, i) {
      var label = (m > 0 ? '+' : '') + m + ' %';
      doc.text(label, matX + i * cellW + cellW / 2, cy + ay - 2, { align: 'center' });
    });

    // Y-Achse rotiert (Zinsänderung)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(80, 75, 70);
    var yAxLabel = 'Zinsänderung';
    // Vertikales Label links
    doc.text(yAxLabel, M + 4, matY + (5 * cellH) / 2, { align: 'left', angle: 90 });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(120, 115, 110);
    zinsSzen.forEach(function(z, i) {
      var label = (z > 0 ? '+' : (z < 0 ? '-' : '\u00b1')) + Math.abs(z).toFixed(1).replace('.', ',') + ' pp';   /* v2463: Komma */
      doc.text(label, matX - 2, matY + i * cellH + cellH / 2 + 1, { align: 'right' });
    });

    // Matrix-Zellen
    matrix.forEach(function(row, rIdx) {
      row.forEach(function(d, cIdx) {
        var x = matX + cIdx * cellW;
        var y = matY + rIdx * cellH;
        // Farbe basierend auf DSCR
        /* v2240 · gruen/gold nach den Einstellungen, Stress-Band 0,8 fest */
        var _sm = _pdfSw(), _smW = Math.min(0.8, _sm.dscrGelb);
        var fill;
        if (d >= _sm.dscrGruen)     fill = [232, 246, 237]; // grün hell
        else if (d >= _sm.dscrGelb) fill = [248, 240, 210]; // gold hell
        else if (d >= _smW)         fill = [248, 220, 185]; // orange hell
        else                        fill = [248, 220, 215]; // rot hell

        var border;
        if (d >= _sm.dscrGruen)     border = [63, 165, 108];
        else if (d >= _sm.dscrGelb) border = C.GOLD;
        else if (d >= _smW)         border = [220, 130, 80];
        else               border = [184, 98, 92];

        doc.setFillColor(fill[0], fill[1], fill[2]);
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.3);
        doc.rect(x, y, cellW - 0.5, cellH - 0.5, 'FD');

        // Base-Case-Marker (wir wissen baseRow=3, baseCol=2 = ±0/±0)
        if (rIdx === data.baseRow && cIdx === data.baseCol) {
          doc.setLineWidth(1.0);
          doc.setDrawColor(26, 20, 20);
          doc.rect(x, y, cellW - 0.5, cellH - 0.5, 'D');
          doc.setLineWidth(0.3);
        }

        // DSCR-Wert in der Mitte
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.setTextColor(40, 35, 35);
        doc.text(d.toFixed(2).replace('.', ','), x + cellW / 2, y + cellH / 2 + 1.5, { align: 'center' });

        // Label "DSCR" klein darunter
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
        doc.setTextColor(120, 115, 110);
        doc.text('DSCR', x + cellW / 2, y + cellH - 2, { align: 'center' });
      });
    });

    cy = matY + 5 * cellH + 6;

    // Legende
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(80, 75, 70);
    var legX = M;
    var legSpacing = 42;
    /* v2240 · die Legende nennt die eingestellten Zahlen */
    var _lg = _pdfSw();
    var _lgW = Math.min(0.8, _lg.dscrGelb).toFixed(2).replace(/0$/, '').replace('.', ',');
    var legends = [
      { color: [63, 165, 108],  bg: [232, 246, 237], label: 'DSCR >= ' + _lg.dscrGruenTxt + ' (gut)' },
      { color: C.GOLD,  bg: [248, 240, 210], label: 'DSCR ' + _lg.dscrGelbTxt + '-' + _lg.dscrGruenTxt + ' (knapp)' },
      { color: [220, 130, 80],  bg: [248, 220, 185], label: 'DSCR ' + _lgW + '-' + _lg.dscrGelbTxt + ' (warn)' },
      { color: [184, 98, 92],   bg: [248, 220, 215], label: 'DSCR < ' + _lgW + ' (Stress)' }
    ];
    legends.forEach(function(l, i) {
      doc.setFillColor(l.bg[0], l.bg[1], l.bg[2]);
      doc.setDrawColor(l.color[0], l.color[1], l.color[2]);
      doc.setLineWidth(0.3);
      doc.rect(legX + i * legSpacing, cy, 4, 4, 'FD');
      doc.setTextColor(80, 75, 70);
      doc.text(l.label, legX + i * legSpacing + 5, cy + 3.2);
    });
    cy += 8;

    // Hinweis-Text
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    doc.setTextColor(120, 115, 110);
    doc.text('Schwarz umrandete Zelle = Base-Case (heute, volle Vermietung).', M, cy);
    cy += 5;
  }

  // V63.73: Cockpit programmatisch zeichnen (zwei Sparklines DSCR/LTV + KPI-Strip).
  // SVG-Capture liefert hier nur kleine Mini-Trends ohne Kontext - programmatic ist viel reicher.
  function _drawCockpitNative(title, sub) {
    cy = newPage(title);
    cy += 4; // V63.73: mehr Luft vom Header
    var data = window.BankCharts && window.BankCharts._lastCockpitData;

    // Card-Daten aus DOM für Eyebrow/Title
    var dom = _readCardDataFromDom('bc-cockpit');

    // Eyebrow
    if (dom && dom.eyebrow) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text(dom.eyebrow.toUpperCase(), M, cy);
      cy += 5;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text('BANK-COCKPIT \u00b7 RISIKO-KENNZAHLEN', M, cy);
      cy += 5;
    }
    // Title (Story)
    doc.setFont('times', 'normal'); doc.setFontSize(18);
    doc.setTextColor(42, 39, 39);
    var titleStr = (dom && dom.title) ? dom.title : 'DSCR & LTV im Verlauf';
    doc.text(titleStr, M, cy);
    cy += 7;
    // Sub
    if (sub) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(120, 115, 110);
      doc.text(doc.splitTextToSize(sub, CW), M, cy);
      cy += 4.5;
    }
    cy += 2;
    doc.setDrawColor.apply(doc, C.GOLD_L);
    doc.setLineWidth(0.3);
    doc.line(M, cy, M + CW, cy);
    cy += 8;

    if (!data || !data.dscrArr || !data.ltvArr) {
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'F');
      doc.setDrawColor.apply(doc, C.GOLD);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text('Cockpit-Daten nicht verfügbar', M + 5, cy + 8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(80, 75, 70);
      doc.text('Tab "Kennzahlen" einmal öffnen, dann erneut PDF-Export starten.', M + 5, cy + 14);
      cy += 30;
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // V63.79: Headline-Block — 2 große Werte (DSCR + LTV) mit Pill + Slider-Gauge
    // analog zur Frontend-Anzeige (Bild 3)
    // ═══════════════════════════════════════════════════════════════
    var hdrH = 56;        // Höhe des Headline-Blocks
    var hdrColW = (CW - 6) / 2;  // Spaltenbreite

    function _statusPill(value, kind) {
      // kind = 'dscr' oder 'ltv'
      // Liefert {label, color: [r,g,b]}
      var _ps = _pdfSw();   /* v2240 · Schwellen aus den Einstellungen */
      if (kind === 'dscr') {
        if (value >= _ps.dscrGruen) return { label: 'SOLIDE',  rgb: [63, 165, 108] };
        if (value >= _ps.dscrGelb) return { label: 'KNAPP',   rgb: C.GOLD };
        return                  { label: 'KRITISCH', rgb: [184, 98, 92] };
      } else {
        if (value <= _ps.ltvGruen)  return { label: 'SOLIDE',  rgb: [63, 165, 108] };
        if (value <= _ps.ltvRot) return { label: 'GRENZ',   rgb: C.GOLD };
        return                  { label: 'HEBEL HOCH', rgb: [184, 98, 92] };
      }
    }

    function _drawHdrCol(x, y, label, sublabel, value, formatFn, kind, sliderMax, sliderMarks) {
      // Card-Wrapper
      doc.setFillColor(252, 250, 245);
      doc.setDrawColor(220, 215, 205);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, hdrColW, hdrH, 2, 2, 'FD');

      // Eyebrow-Label oben
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text(label, x + 6, y + 6);

      // Großer Wert
      doc.setFont('times', 'bold'); doc.setFontSize(28);
      doc.setTextColor(42, 39, 39);
      var displayVal = formatFn(value);
      doc.text(displayVal, x + 6, y + 19);

      // Status-Pill rechts neben dem Wert
      var pill = _statusPill(value, kind);
      var valW = doc.getTextWidth(displayVal);
      var pillX = x + 6 + valW + 5;
      var pillY = y + 13;
      var pillW = doc.getTextWidth(pill.label) + 8;
      var pillH = 5.5;
      doc.setFillColor(pill.rgb[0], pill.rgb[1], pill.rgb[2]);
      doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(pill.label, pillX + pillW / 2, pillY + 3.7, { align: 'center' });

      // Slider-Gauge
      var sliderY = y + 32;
      var sliderW = hdrColW - 12;
      var sliderX = x + 6;
      // Hintergrund-Gradient simulieren mit 3 Segmenten (rot/gold/grün)
      var seg = sliderW / 3;
      doc.setLineWidth(0);
      doc.setFillColor(238, 218, 215); // rot/rosa
      doc.rect(sliderX, sliderY, seg, 1.6, 'F');
      doc.setFillColor(245, 230, 195); // gold/sand
      doc.rect(sliderX + seg, sliderY, seg, 1.6, 'F');
      doc.setFillColor(220, 235, 222); // grün
      doc.rect(sliderX + 2 * seg, sliderY, seg, 1.6, 'F');

      // Marker auf aktuellem Wert
      var ratio = Math.min(value / sliderMax, 1);
      var markerX = sliderX + sliderW * ratio;
      doc.setFillColor(42, 39, 39);
      doc.roundedRect(markerX - 8, sliderY - 4, 16, 6.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(displayVal, markerX, sliderY + 0.5, { align: 'center' });

      // Skala-Marks (z.B. 0, 1.0, 1.5, 2.0+)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
      doc.setTextColor(140, 130, 120);
      sliderMarks.forEach(function(mark) {
        var mx = sliderX + (mark.value / sliderMax) * sliderW;
        doc.text(mark.label, mx, sliderY + 6, { align: 'center' });
      });

      // Sublabel unten
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.setTextColor(120, 115, 110);
      doc.text(sublabel, x + 6, y + hdrH - 3);
    }

    var dscrFmt = function(v) { return v.toFixed(2).replace('.', ','); };
    var ltvFmt  = function(v) { return v.toFixed(0) + ' %'; };

    _drawHdrCol(M, cy, 'DSCR · SCHULDENDIENSTDECKUNG', 'Heute · Tilgung & Zins gedeckt',
      data.dscrToday, dscrFmt, 'dscr', 2.0, [
        { value: 0,    label: '0' },
        { value: 1.0,  label: '1,0' },
        { value: 1.5,  label: '1,5' },
        { value: 2.0,  label: '2,0+' }
      ]);

    _drawHdrCol(M + hdrColW + 6, cy, 'LTV · BELEIHUNGSAUSLAUF', 'Heute · Hebelgrad gegenüber Marktwert',
      data.ltvToday, ltvFmt, 'ltv', 100, [
        { value: 0,   label: '0%' },
        { value: 60,  label: '60%' },
        { value: _pdfSw().ltvGruen,  label: _pdfSw().ltvGruenTxt + '%' },   /* v2240 */
        { value: 100, label: '100%+' }
      ]);

    cy += hdrH + 6;

    // ═══════════════════════════════════════════════════════════════
    // Bestehender KPI-Strip + Sparklines (V63.73 — ergänzt den Headline-Block)
    // ═══════════════════════════════════════════════════════════════

    // ── KPI-Strip oben: 6 Werte in 2 Zeilen × 3 Spalten ──
    var kpiCellW = (CW - 6) / 3;
    var kpiCellH = 18;
    var kpiY = cy;
    function _kpiCell(x, y, label, value, sub2, color) {
      doc.setDrawColor(220, 215, 205);
      doc.setFillColor(248, 246, 240);
      doc.setLineWidth(0.3);
      doc.rect(x, y, kpiCellW, kpiCellH, 'FD');
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, y, 2.5, kpiCellH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.setTextColor(120, 115, 110);
      doc.text(label.toUpperCase(), x + 5, y + 4.8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(value, x + 5, y + 11);
      if (sub2) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
        doc.setTextColor(140, 130, 120);
        doc.text(sub2, x + 5, y + 15.5);
      }
    }
    function _dscrColor(v) {   /* v2240 · Schwellen aus den Einstellungen */
      if (v >= _pdfSw().dscrGruen) return [63, 165, 108];
      if (v >= _pdfSw().dscrGelb) return C.GOLD;
      return [184, 98, 92];
    }
    function _ltvColor(v) {
      if (v <= _pdfSw().ltvGruen) return [63, 165, 108];
      if (v <= _pdfSw().ltvRot) return C.GOLD;
      return [184, 98, 92];
    }
    /* v2833 · Zeile Ende Zinsbindung aus calc.js (ueber BankCharts), sonst bindj */
    var bindIdx = (typeof data.ezbIdx === 'number') ? data.ezbIdx + 1 : (data.bindj || 10);
    var ezbYearLabel = 'Jahr ' + bindIdx;
    var endYearLabel = 'Jahr ' + (data.years.length || 10);

    /* v2900 · dscrToday ist State.kpis.dscr - das erste VOLLE Jahr (calc.js V352), nicht der Stand heute */
    _kpiCell(M, kpiY,                'DSCR · Jahr 1 (voll)', data.dscrToday.toFixed(2).replace('.', ','), 'erstes volles Jahr', _dscrColor(data.dscrToday));
    _kpiCell(M + kpiCellW + 3, kpiY, 'DSCR · ' + ezbYearLabel, data.dscrEzb.toFixed(2).replace('.', ','), 'Ende Zinsbindung', _dscrColor(data.dscrEzb));
    _kpiCell(M + 2 * (kpiCellW + 3), kpiY, 'DSCR · ' + endYearLabel, data.dscrEnd.toFixed(2).replace('.', ','), 'Anschluss', _dscrColor(data.dscrEnd));

    kpiY += kpiCellH + 3;
    _kpiCell(M, kpiY,                'LTV · Heute', data.ltvToday.toFixed(1).replace('.', ',') + ' %', 'Beleihung', _ltvColor(data.ltvToday));
    _kpiCell(M + kpiCellW + 3, kpiY, 'LTV · ' + ezbYearLabel, data.ltvEzb.toFixed(1).replace('.', ',') + ' %', 'Ende Zinsbindung', _ltvColor(data.ltvEzb));
    _kpiCell(M + 2 * (kpiCellW + 3), kpiY, 'LTV · ' + endYearLabel, data.ltvEnd.toFixed(1).replace('.', ',') + ' %', 'Anschluss', _ltvColor(data.ltvEnd));

    cy = kpiY + kpiCellH + 8;

    // ── Sparkline-Helper ──
    function _drawSparkline(x, y, w, h, values, opts) {
      opts = opts || {};
      var n = values.length;
      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      // Optional: Range erweitern für Threshold-Lines
      if (opts.thresholdValues) {
        opts.thresholdValues.forEach(function(t) {
          if (t < min) min = t;
          if (t > max) max = t;
        });
      }
      /* v2463 · die Schwellen kamen als thresholdLines und weiteten die Achse NICHT:
         „>= 1,2 (gut)" stand im Seitenfuss, „1,0 (knapp)" ausserhalb der Seite und die
         80-%-Linie des LTV im DSCR-Diagramm. */
      if (opts.thresholdLines) {
        opts.thresholdLines.forEach(function(t) {
          if (t.value < min) min = t.value;
          if (t.value > max) max = t.value;
        });
      }
      var range = max - min || 1;
      // Kleiner Puffer
      min -= range * 0.08;
      max += range * 0.08;
      range = max - min;

      // Achsenrahmen
      doc.setDrawColor(220, 215, 205);
      doc.setFillColor(252, 251, 247);
      doc.setLineWidth(0.2);
      doc.rect(x, y, w, h, 'FD');

      // Y-Grid (3 Linien)
      doc.setDrawColor(235, 230, 220);
      doc.setLineWidth(0.15);
      for (var gi = 1; gi < 4; gi++) {
        var gy = y + (h * gi / 4);
        doc.line(x, gy, x + w, gy);
      }

      // Threshold-Lines
      if (opts.thresholdLines) {
        opts.thresholdLines.forEach(function(t) {
          var ty = y + h - ((t.value - min) / range) * h;
          doc.setDrawColor(t.color[0], t.color[1], t.color[2]);
          doc.setLineWidth(0.4);
          doc.setLineDashPattern([1.2, 1.2], 0);
          doc.line(x, ty, x + w, ty);
          doc.setLineDashPattern([], 0);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
          doc.setTextColor(t.color[0], t.color[1], t.color[2]);
          doc.text(t.label, x + w - 1, ty - 1.2, { align: 'right' });
        });
      }

      // EZB-Marker (vertikale Linie)
      if (opts.ezbIdx != null && opts.ezbIdx > 0 && opts.ezbIdx < n) {
        var ex = x + (opts.ezbIdx / (n - 1)) * w;
        doc.setDrawColor.apply(doc, C.GOLD);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1.5], 0);
        doc.line(ex, y, ex, y + h);
        doc.setLineDashPattern([], 0);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor.apply(doc, C.GOLD_D);
        doc.text('EZB', ex - 1, y + 3, { align: 'right' });
      }

      // Linie zeichnen
      doc.setDrawColor(opts.color[0], opts.color[1], opts.color[2]);
      doc.setLineWidth(1.0);
      var prevX = null, prevY = null;
      values.forEach(function(v, i) {
        var px = x + (i / (n - 1)) * w;
        var py = y + h - ((v - min) / range) * h;
        if (prevX != null) doc.line(prevX, prevY, px, py);
        prevX = px; prevY = py;
      });
      // Endpunkte
      doc.setFillColor(opts.color[0], opts.color[1], opts.color[2]);
      doc.circle(x, y + h - ((values[0] - min) / range) * h, 0.9, 'F');
      doc.circle(x + w, y + h - ((values[n-1] - min) / range) * h, 1.2, 'F');

      // Y-Achsen-Labels (3 Stück)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
      doc.setTextColor(150, 145, 135);
      for (var li = 0; li <= 4; li++) {
        var lv = max - (range * li / 4);
        var ly = y + (h * li / 4);
        var lstr = opts.formatY ? opts.formatY(lv) : lv.toFixed(1);
        doc.text(lstr, x - 1, ly + 1.5, { align: 'right' });
      }

      // X-Achsen-Labels (jedes 2. Jahr)
      if (opts.years) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        doc.setTextColor(150, 145, 135);
        opts.years.forEach(function(yr, i) {
          if (i % 2 === 0 || i === n - 1) {
            var px = x + (i / (n - 1)) * w;
            doc.text(String(yr), px, y + h + 3.5, { align: 'center' });
          }
        });
      }
    }

    // ── Sparkline 1: DSCR ──
    var sparkW = CW;
    var sparkH = 38;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(42, 39, 39);
    doc.text('DSCR-Verlauf · Schuldendeckung', M, cy);
    cy += 4;
    _drawSparkline(M + 8, cy, sparkW - 8, sparkH, data.dscrArr, {
      color: [63, 165, 108],
      ezbIdx: bindIdx - 1,
      years: data.years,
      thresholdLines: [
        { value: _pdfSw().dscrGruen, color: [63, 165, 108], label: '>= ' + _pdfSw().dscrGruenTxt + ' (gut)' },   /* v2240 */
        { value: _pdfSw().dscrGelb, color: C.GOLD, label: _pdfSw().dscrGelbTxt + ' (knapp)' }
      ],
      formatY: function(v) { return v.toFixed(2).replace('.', ','); }
    });
    cy += sparkH + 8;

    // ── Sparkline 2: LTV ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(42, 39, 39);
    doc.text('LTV-Verlauf · Beleihungsquote', M, cy);
    cy += 4;
    _drawSparkline(M + 8, cy, sparkW - 8, sparkH, data.ltvArr, {
      color: [184, 98, 92],
      ezbIdx: bindIdx - 1,
      years: data.years,
      thresholdLines: [
        { value: _pdfSw().ltvGruen, color: C.GOLD, label: _pdfSw().ltvGruenTxt + ' %' },   /* v2240 */
        { value: 60, color: [63, 165, 108], label: '60 %' }
      ],
      formatY: function(v) { return v.toFixed(0) + ' %'; }
    });
    cy += sparkH + 8;

    // V63.79: Insight-Banner unten — Frontend-Optik aus Bild 3
    var dscrPill = _statusPill(data.dscrToday, 'dscr');
    var ltvPill  = _statusPill(data.ltvToday, 'ltv');
    var insightDscr = dscrPill.label === 'SOLIDE'
      ? 'Bank-OK: DSCR ' + dscrFmt(data.dscrToday) + ' von Anfang an >= 1,2 - Bedienung klar gewährleistet.'
      : 'DSCR ' + dscrFmt(data.dscrToday) + ' (' + dscrPill.label + ') - Tilgungsplan mit der Bank prüfen.';
    var insightLtv = ltvPill.label === 'SOLIDE'
      ? 'Solider Start-LTV (' + ltvFmt(data.ltvToday) + '): klassische Bank-Finanzierung - verhandelbare Konditionen.'
      : 'Hoher LTV ' + ltvFmt(data.ltvToday) + ' (' + ltvPill.label + ') - Eigenkapital-Erhöhung empfohlen.';

    var bannerH = 12;
    var bannerW = (CW - 6) / 2;
    function _drawInsightBanner(x, label, color) {
      doc.setFillColor(color[0], color[1], color[2], 0.10);
      // jsPDF kann kein RGBA — wir simulieren mit hellem Hintergrund + farbigem Border-Left
      doc.setFillColor(247, 251, 248);
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, cy, bannerW, bannerH, 1.5, 1.5, 'FD');
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, cy, 2, bannerH, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(60, 75, 65);
      var lines = doc.splitTextToSize(label, bannerW - 8);
      doc.text(lines, x + 4, cy + 5);
    }
    _drawInsightBanner(M, insightDscr, dscrPill.rgb);
    _drawInsightBanner(M + bannerW + 6, insightLtv, ltvPill.rgb);
    cy += bannerH + 4;
  }

  // V63.92/V63.93/V63.96: Equity-Build + Wasserfall auf EINE Seite (Marcels Wunsch).
  function _drawEquityAndWaterfallCombined() {
    console.log('[pdf] V63.96 _drawEquityAndWaterfallCombined() AUFGERUFEN — beides auf eine Seite');
    cy = newPage('Vermögensaufbau & Vermögenszuwachs');
    cy += 8;  // V63.96: 2 → 8 (Marcels Wunsch: 2-3 Leerzeilen zwischen Header und Chart-Title)
    var equityData = _readCardDataFromDom('bc-equity');
    var waterfallData = _readCardDataFromDom('bc-waterfall');
    console.log('[pdf] equityChart=' + (equityChart ? 'YES' : 'NO') + ' waterfallChart=' + (waterfallChart ? 'YES' : 'NO'));

    // ── EQUITY-BUILD oben ─────────────────────────────
    if (equityData && equityData.eyebrow) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text(equityData.eyebrow.toUpperCase(), M, cy);
      cy += 4;
    }
    if (equityData && equityData.title) {
      doc.setFont('times', 'normal'); doc.setFontSize(14);
      doc.setTextColor(42, 39, 39);
      var tLines = doc.splitTextToSize(equityData.title, CW);
      doc.text(tLines[0] || '', M, cy);
      cy += 6;
    }
    if (equityData && equityData.sub) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(120, 115, 110);
      var sLines = doc.splitTextToSize(equityData.sub, CW).slice(0, 2);   /* v2463: zweite Zeile fiel weg */
      sLines.forEach(function (l) { doc.text(l, M, cy); cy += 3.8; });
    }
    cy += 1;

    // Equity-Chart (kompakt — ~70mm hoch)
    if (equityChart) {
      var eqRatio = equityChart.width / equityChart.height;
      var eqW = CW;
      var eqH = Math.min(72, eqW / eqRatio);
      var eqX = M + (CW - eqW) / 2;
      try { doc.addImage(equityChart.dataUrl, equityChart.mimeType || 'JPEG', eqX, cy, eqW, eqH); cy += eqH + 3; }
      catch (e) { console.warn('[pdf] equityChart embed:', e.message); cy += 8; }
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
      doc.setTextColor(150, 145, 140);
      doc.text('(Equity-Build-Chart nicht verfügbar)', M, cy);
      cy += 6;
    }

    // KPI-Footer (5 Boxen kompakt)
    // V191: gold-Background statt cream-Background — Boxen waren vorher zu
    // unauffällig auf cream-Hintergrund.
    if (equityData && equityData.footer && equityData.footer.length > 0) {
      var nF = Math.min(equityData.footer.length, 5);
      var fW = (CW - (nF - 1) * 2.5) / nF;
      var fH = 16;  // V191: 14 → 16 für besseres Verhältnis
      var fY = cy;
      equityData.footer.slice(0, nF).forEach(function(cell, i) {
        var fX = M + i * (fW + 2.5);
        // V191: deutlich kräftigere gold-Hinterlegung (war 248/246/241 = fast unsichtbar)
        doc.setDrawColor.apply(doc, C.GOLD);
        doc.setFillColor(252, 248, 233);  // V191: leichtes gold-Tönung statt cream
        doc.setLineWidth(0.5);
        doc.rect(fX, fY, fW, fH, 'FD');
        // Gold-Akzentstrich oben
        doc.setFillColor.apply(doc, C.GOLD);
        doc.rect(fX, fY, fW, 1.2, 'F');  // V191: 0.7 → 1.2 (deutlicher sichtbar)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor.apply(doc, C.GOLD_D);
        var labelLines = doc.splitTextToSize(cell.label.toUpperCase(), fW - 4);
        doc.text(labelLines[0] || '', fX + 2.2, fY + 4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.setTextColor(42, 39, 39);
        doc.text(cell.value, fX + 2.2, fY + 9);
        if (cell.sub) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8);
          doc.setTextColor(120, 115, 110);
          var subS = doc.splitTextToSize(cell.sub, fW - 4);
          doc.text(subS[0] || '', fX + 2.2, fY + 13);
        }
      });
      cy = fY + fH + 11;
    }

    // ── WASSERFALL unten ──────────────────────────────
    // Trennlinie
    doc.setDrawColor.apply(doc, C.GOLD_L);
    doc.setLineWidth(0.25);
    doc.line(M, cy, M + CW, cy);
    cy += 9;  // V63.94: 4 → 9 (Marcels Wunsch: 2 Zeilen mehr Luft nach der Trennlinie)

    if (waterfallData && waterfallData.eyebrow) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, C.GOLD_D);
      doc.text(waterfallData.eyebrow.toUpperCase(), M, cy);
      cy += 4;
    }
    if (waterfallData && waterfallData.title) {
      doc.setFont('times', 'normal'); doc.setFontSize(14);
      doc.setTextColor(42, 39, 39);
      var wfTLines = doc.splitTextToSize(waterfallData.title, CW);
      doc.text(wfTLines[0] || '', M, cy);
      cy += 6;
    }
    if (waterfallData && waterfallData.sub) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(120, 115, 110);
      var wfSLines = doc.splitTextToSize(waterfallData.sub, CW).slice(0, 2);   /* v2463: Satz brach mitten ab */
      wfSLines.forEach(function (l) { doc.text(l, M, cy); cy += 3.8; });
    }
    cy += 1;

    // Wasserfall-Chart — Restplatz nutzen (~80-90mm)
    if (waterfallChart) {
      var wfAvailH = 280 - cy - 18; // KPI-Footer-Reserve
      var wfRatio = waterfallChart.width / waterfallChart.height;
      var wfW = CW;
      var wfH = Math.min(wfAvailH, wfW / wfRatio);
      if (wfH < 50) wfH = 50;
      var wfX = M + (CW - wfW) / 2;
      try { doc.addImage(waterfallChart.dataUrl, waterfallChart.mimeType || 'JPEG', wfX, cy, wfW, wfH); cy += wfH + 3; }
      catch (e) { console.warn('[pdf] waterfallChart embed:', e.message); cy += 8; }
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
      doc.setTextColor(150, 145, 140);
      doc.text('(Wasserfall-Chart nicht verfügbar)', M, cy);
      cy += 6;
    }

    // Wasserfall-Footer-KPIs (3 Boxen)
    if (waterfallData && waterfallData.footer && waterfallData.footer.length > 0) {
      var wfnF = Math.min(waterfallData.footer.length, 3);
      var wffW = (CW - (wfnF - 1) * 3) / wfnF;
      var wffH = 16;   /* v2463: Platz für zwei Zeilen Untertext */
      var wffY = cy;
      waterfallData.footer.slice(0, wfnF).forEach(function(cell, i) {
        var wffX = M + i * (wffW + 3);
        doc.setDrawColor.apply(doc, C.GOLD_L);
        doc.setFillColor(248, 246, 241);
        doc.setLineWidth(0.3);
        doc.rect(wffX, wffY, wffW, wffH, 'FD');
        doc.setFillColor.apply(doc, C.GOLD);
        doc.rect(wffX, wffY, wffW, 0.7, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor.apply(doc, C.GOLD_D);
        var lbl = doc.splitTextToSize(cell.label.toUpperCase(), wffW - 4);
        doc.text(lbl[0] || '', wffX + 2.5, wffY + 3.3);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.setTextColor(42, 39, 39);
        doc.text(cell.value, wffX + 2.5, wffY + 7.8);
        if (cell.sub) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
          doc.setTextColor(120, 115, 110);
          var sub = doc.splitTextToSize(cell.sub, wffW - 4).slice(0, 2);   /* v2463: „— alles aus dem" brach ab */
          sub.forEach(function (l, j) { doc.text(l, wffX + 2.5, wffY + 11 + j * 2.6); });
        }
      });
      cy = wffY + wffH + 3;
    }
  }

  // V63.67/72: Bank-Charts. V63.92: Equity + Wasserfall kombiniert auf einer Seite.
  _drawEquityAndWaterfallCombined();
  // V63.73: Cockpit programmatisch (HTML-Layout lässt sich schlecht capturen)
  _drawCockpitNative('Bank-Cockpit · DSCR & LTV im Verlauf',
    'Die zwei wichtigsten Kennzahlen für die Bank über den Betrachtungszeitraum.');
  // V63.71: Stress-Test programmatisch (HTML-Grid lässt sich nicht capturen)
  _drawStressMatrix('Stress-Test · DSCR-Resilienz',
    'DSCR-Werte für 25 Szenarien aus Mietausfall × Zinsänderung - zeigt die Belastbarkeit.');

  // V63.68: Wenn ALLE Charts fehlten -> Fallback-Seite mit Hinweis (Stress wird programmatisch immer gerendert)
  if (!equityChart && !cockpitChart && !waterfallChart) {
    cy = newPage('Charts · Hinweis');
    doc.setFillColor(255, 248, 230);
    doc.roundedRect(M, cy, CW, 36, 2, 2, 'F');
    doc.setDrawColor.apply(doc, C.GOLD);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, cy, CW, 36, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, C.GOLD_D);
    doc.text('Charts konnten nicht erstellt werden', M + 5, cy + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 75, 70);
    doc.text([
      'Die grafischen Charts (Equity-Build, Bank-Cockpit, Waterfall)',
      'konnten beim PDF-Export nicht aus der App ausgelesen werden.',
      '',
      'Bitte: Tab "Kennzahlen" einmal öffnen, kurz warten bis die Charts',
      'sichtbar sind, dann erneut den PDF-Export starten.'
    ], M + 5, cy + 14);
    cy += 40;
  }

  // Vermögenszuwachs-Block — V63.88: ZURÜCK zu jsPDF-Native (Marcels Bild zeigte
  // dass html2canvas-Capture leer war und 60% weiße Fläche). Werte aus State._vz
  // (= konsistent zu Tab-Tabelle, Wasserfall und Equity-Build).
  // V63.98: ALLE DREI Tabellen (Vermögenszuwachs / CF-Überschuss / Wertsteigerung)
  //         landen jetzt zusammen auf einer eigenen Seite (Marcels Wunsch).
  if (State.cfRows && State.cfRows.length) {
    // V63.98: IMMER neue Seite für diesen 3er-Block — egal wo cy steht
    cy = newPage('Vermögenszuwachs im Detail');
    cy += 3;
    var _vzCapture = null;

    if (!_vzCapture) {
      /* v2463 · das Feld btj ist oft leer - dann stand hier „15 Jahre", während das
         Objekt über 20 Jahre rechnet (Wertsteigerung 245.567 gegen 345.023 darüber). */
      var btjY = State.btj || parseInt(g('btj'), 10) || (State.cfRows || []).length || 15;
      var _vz = State._vz || {};
      var cumT = _vz.tilg_durch_einnahmen || 0;
      var cumC = _vz.cf_ueberschuss_konto || 0;
      var stv  = _vz.steuervorteil || 0;
      var wzg  = _vz.wertsteig_kum || 0;
      var ges  = _vz.verm_zuwachs || (cumT + cumC + stv + wzg);

      cy = secH(doc, cy, 'Verm\u00f6genszuwachs (' + btjY + ' Jahre)', M, CW);
      kvT(doc, M, cy, CW, [
        ['1. Tilgung-vom-Mieter (Schulden abgebaut durch Miete)',           pE(cumT)],
        ['2. Cashflow-\u00dcberschuss (nach Tilgung, vor Steuern)', pE(cumC)],   /* v2832: vorher nach Steuern - Steuer doppelt */
        [stv < 0 ? '3. Steuerlast (kumulierte Mehrsteuer)' : '3. Steuervorteil (kumulierte Erstattung aus V+V-Verlusten)', pE(stv, true)],   /* v2463: negativ hiess es trotzdem „Steuervorteil" */
        ['4. Wertsteigerung ' + pP(v('wertstg'), 1) + ' p.a.',              pE(wzg)],
        ['= GESAMT Verm\u00f6genszuwachs (1+2+3+4)',                       pE(ges, true)]
      ], [4]);
      cy += 5 * 5.8 + 5;  // V63.98: war +6, etwas kompakter
    }

    if (!_vzCapture) {
      var lastRow = State.cfRows[State.cfRows.length - 1];
      var btjY = State.btj || parseInt(g('btj'), 10) || (State.cfRows || []).length || 15;
      var cumNkm = 0, cumBwk = 0, cumZins = 0, cumTax = 0, cumTilg = 0, cumBspar = 0;
      State.cfRows.forEach(function(r){
        cumNkm += r.nkm_y || 0;
        cumBwk += r.bwk_cf_y || r.bwk_y || 0;
        cumZins+= r.zy || 0;
        cumTax += r.tax_y || 0;
        cumTilg+= r.ty || r.tilg_y || 0;
        cumBspar+= r.bspar_y || 0;
      });
      var _wertAnker = (window.State && window.State.wert_basis) || K.kp;
      var _wstgPctPDF = (parseDe(g('wertstg')) || 1.5) / 100;
      var wzg = _wertAnker * Math.pow(1 + _wstgPctPDF, btjY) - _wertAnker;

      // V63.98: KEINE Page-Break-Schwelle mehr — alle 3 Tabellen müssen zusammen passen
      var mstgPct = parseDe(g('mietstg')) || 1.5;
      var kstgPct = parseDe(g('kostenstg')) || 1.0;
      cy = secH(doc, cy, 'Wie der Cashflow-\u00dcberschuss entsteht (' + btjY + ' Jahre)', M, CW);
      var nkmHeute = K.nkm_j || (((K.nkm_m || 0) + (K.ze_m || 0)) * 12);   /* v2463: nkm_m gibt es nicht - „davon statisch 0" */
      var statisch = nkmHeute * btjY;
      var _cumTaxDisplay = -cumTax;
      var _vzData = (window.State && window.State._vz) || {};
      var _cfKontoSoll = _vzData.cf_ueberschuss_konto != null ? _vzData.cf_ueberschuss_konto : (cumNkm - cumBwk - cumZins - cumTilg - cumBspar);   /* v2832: vor Steuern */
      var _rows = [
        ['Kumulierte Mieteinnahmen (Miete ' + window._dpPdfMiete().text + ')', pE(cumNkm)],
        ['  davon statisch (NKM heute \u00d7 Jahre)', pE(statisch)],
        ['  Effekt der Mietsteigerung', '+' + pE(cumNkm - statisch)],
        ['- Bewirtschaftung n.uml. (mit ' + kstgPct.toFixed(1).replace('.', ',') + ' % p.a.)', '-' + pE(cumBwk)],
        ['- Zinsen (\u00fcber die Laufzeit)', '-' + pE(cumZins)],
        ['- Tilgung (\u00fcber die Laufzeit)', '-' + pE(cumTilg)]
      ];
      if (cumBspar > 0) _rows.push(['- Bausparrate (kumuliert, gebunden)', '-' + pE(cumBspar)]);
      /* v2832 · die Steuer steht als eigener Baustein (3.) in der Tabelle darueber */
      _rows.push(['= Kumulierter CF-\u00dcberschuss (nach Tilgung, vor Steuern)', pE(_cfKontoSoll, true)]);
      var _resultIdx = _rows.length - 1;
      kvT(doc, M, cy, CW, _rows, [_resultIdx]);
      cy += _rows.length * 5.8 + 3;  // V63.98: kompakter, +4 → +3

      // V63.98: Hinweis-Text in 1 Zeile, kompakter
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.0);
      doc.setTextColor.apply(doc, C.MID);
      doc.text('Hinweis: Tilgung wird hier mit abgezogen -- Endsumme = Cashflow-\u00dcberschuss aus der Hauptzeile. Tilgung ist gleichzeitig in "Tilgung-vom-Mieter" enthalten.', M, cy);
      cy += 5;

      // V63.98: KEINE Page-Break-Schwelle, dritte Tabelle direkt unten dran
      var wstgPct = parseDe(g('wertstg')) || 1.5;
      var faktor = Math.pow(1 + wstgPct/100, btjY);
      var _ankerLabel;
      if (v('svwert') > 0) {
        _ankerLabel = 'Wert-Anker: Verkehrswert';
      } else if (v('bankval') > K.kp) {
        _ankerLabel = 'Wert-Anker: Bankbewertung';
      } else {
        _ankerLabel = 'Wert-Anker: Kaufpreis';
      }
      cy = secH(doc, cy, 'Wie die Wertsteigerung berechnet wird (' + btjY + ' Jahre)', M, CW);
      kvT(doc, M, cy, CW, [
        [_ankerLabel,                           pE(_wertAnker)],
        ['\u00d7 Wertsteigerungs-Annahme p.a.', wstgPct.toFixed(1).replace('.', ',') + ' %'],
        ['Wachstumsfaktor (1 + p.a.)^' + btjY,  faktor.toFixed(4).replace('.', ',')],
        ['= Marktwert nach ' + btjY + ' Jahren', pE(_wertAnker * faktor)],
        ['- Wert-Anker (Heute)',           '-' + pE(_wertAnker)],
        ['= Wertsteigerung',                    pE(wzg, true)]
      ], [5]);
      cy += 6 * 5.8 + 3;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.0);
      doc.setTextColor.apply(doc, C.MID);
      doc.text('Formel: Wertsteigerung = Wert-Anker \u00d7 ((1 + p.a.)^Jahre - 1)', M, cy);
      cy += 4;
    }
  }

  setPdfProgress(70);

  /* ══════════════════════════════════════════════════
     SEITE 4c · v2430: WERTPOTENZIAL (Mieterhöhung und Zielbild)
     Nur wenn Soll-Miete oder Zielbild eingetragen sind. Gerechnet wird
     hier nichts: DpPotenzial stellt Mieten und Kosten zusammen, die
     Ertragswerte kommen aus dem Marktbericht-Dienst (derselbe Kern wie
     Stufe 3). Kennzeichnung: DpPotenzial.KENNZEICHNUNG (v2870, steht in pdfDaten().fuss).
  ══════════════════════════════════════════════════ */
  try {
    var _PZ = window.DpPotenzial || null, _PD = null;
    if (_PZ && _PZ.modell && _PZ.modell().aktiv) {
      await Promise.race([_PZ.rechnen(), new Promise(function (f) { setTimeout(f, 40000); })]);
      _PD = _PZ.pdfDaten();
    }
    if (_PD) {
      var _pc = function (t) { return String(t == null ? '' : t).replace(/[–—−‑]/g, '-').replace(/[  ]/g, ' ').replace(/[^\x00-\xFF€]/g, '').replace(/\s+/g, ' ').trim(); };
      /* v2530 · Fließtext seitensicher (wie absatz() der Bankfassung): Umbruch,
         vor JEDER Zeile Prüfung gegen den Fußbalken (y 285), sonst Fortsetzung
         mit Kopf/Fuß über newPage() und derselben Schrift - pageTpl() stellt
         die Schrift um. Gemessen 20.10.2026: die Fußnote lief bis an den Rand. */
      var _TEXT_UNTEN = 280;
      var _absatz = function (t, o) {
        o = o || {};
        var gr = o.groesse || 8, lh = o.zeile || 4, dy = o.dy || 0, farbe = o.farbe || C.MID;
        var stil = function () { doc.setFont('helvetica', 'normal'); doc.setFontSize(gr); doc.setTextColor.apply(doc, farbe); };
        /* v2830 · Blocksatz, letzte Zeile linksbuendig */
        if (window.DpPdfBlocksatz) {
          cy = window.DpPdfBlocksatz.absatz(doc, _pc(t), { x: M, y: cy + dy, breite: CW, zeile: lh, unten: _TEXT_UNTEN, stil: stil,
            neueSeite: function () { cy = newPage('Wertpotenzial · Fortsetzung'); return cy + dy; } }) - dy;
          return;
        }
        stil();
        doc.splitTextToSize(_pc(t), CW).forEach(function (z) {
          if (cy + dy > _TEXT_UNTEN) { cy = newPage('Wertpotenzial · Fortsetzung'); stil(); }
          doc.text(z, M, cy + dy); cy += lh;
        });
      };
      /* v2900 · gezeichnet wird im Abschnitt Wert & Zielbild (unten), zwischen den
         Werten je Verfahren und den Erklaerungen - die Stufen standen bis dahin auf
         zwei Seiten (Wertpotenzial und Wert & Zielbild). anschluss=true: im Fluss
         weiter statt neuer Seite. */
      var _pdZeichnen = function (anschluss) {
      if (anschluss) { if (cy > 200) cy = newPage('Wert & Zielbild · Fortsetzung'); else cy += 4; }
      else cy = newPage('Wertpotenzial');
      cy = secH(doc, cy, 'Wertpotenzial · Mieterhöhung und Zielbild', M, CW);
      _absatz(_PD.satz_invest + ' ' + _PD.satz_bank, { groesse: 8.6, farbe: C.CH, zeile: 4.4, dy: 3 });
      cy += 4;
      var _tab = function (kopf, breiten, zeilen, fettRe) {
        var fak = CW / breiten.reduce(function (a, b) { return a + b; }, 0), rh0 = 5.8;
        /* v2464 · gemessen: die Maßnahmen wurden nach der ersten Zeile abgeschnitten
           („Treppenhaus und"), und „kein Potenzial" stand blau/grün wie ein Wert.
           Jetzt bricht die Maßnahmenspalte um (bis drei Zeilen), „kein Potenzial"
           steht neutral grau, und der Text links hält 3 mm Abstand zur Zahl davor. */
        var zeichne = function (werte, istKopf, idx) {
          doc.setFont('helvetica', istKopf ? 'bold' : 'normal'); doc.setFontSize(istKopf ? 7 : 8);
          var zellen = werte.map(function (w, i) {
            var bw = breiten[i] * fak, t = _pc(w);
            if (!istKopf && /Maßnahmen/.test(kopf[i])) return doc.splitTextToSize(t, bw - 5).slice(0, 3);
            if (i === 0) return [doc.splitTextToSize(t, bw - 3)[0] || ''];
            return [t];
          });
          var n = zellen.reduce(function (a, z) { return Math.max(a, z.length); }, 1), rh = rh0 + (n - 1) * 3.4;
          if (!istKopf && cy + rh > 275) { cy = newPage('Wertpotenzial · Fortsetzung'); zeichne(kopf, true, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); }
          var x = M;
          doc.setFillColor.apply(doc, istKopf ? C.CH : (idx % 2 === 0 ? C.SURF : C.WHITE));
          doc.setDrawColor.apply(doc, C.BORDER); doc.setLineWidth(0.2);
          doc.rect(M, cy, CW, rh, istKopf ? 'F' : 'FD');
          var fett = !istKopf && fettRe && fettRe.test(String(werte[0]));
          doc.setFont('helvetica', (istKopf || fett) ? 'bold' : 'normal'); doc.setFontSize(istKopf ? 7 : 8);
          zellen.forEach(function (z, i) {
            var bw = breiten[i] * fak, t0 = z[0];
            if (istKopf) doc.setTextColor.apply(doc, C.GOLD);
            else if (t0 === 'kein Potenzial') doc.setTextColor.apply(doc, C.MID);
            /* v2543c · Stufen nicht mehr blau/grün eingefärbt (Marcel 20.10.2026: Farben der Marke) -
               Werte in Textfarbe; die Stufenfarbe trägt die Wertüberleitung. Zuvor griff der Vergleich
               auch nur noch zufällig (Spaltenkopf jetzt mit Jahr: „Mieterhöhung 2026"). */
            else doc.setTextColor.apply(doc, C.CH);
            z.forEach(function (t, j) {
              var ty = cy + rh0 - 1.8 + j * 3.4;
              if (i === 0) doc.text(t, x + 2, ty);
              else if (/Maßnahmen/.test(kopf[i])) doc.text(t, x + 3, ty);
              else doc.text(t, x + bw - 2, ty, { align: 'right' });
            });
            x += bw;
          });
          cy += rh;
        };
        zeichne(kopf, true, 0);
        zeilen.forEach(function (z, n) { zeichne(z, false, n); });
        cy += 5;
      };
      if (_PD.art === 'mfh' && _PD.wohnungen.length) {
        _tab(['WE', 'm²', 'Ist €/M', 'Mieterhöhung', 'Ziel €/M', 'Maßnahmen'], [30, 11, 18, 30, 18, 48],
          _PD.wohnungen.map(function (w) { return [w.we, String(Math.round(w.wfl || 0)), w.ist, w.soll, w.ziel, w.massnahmen]; }));
      }
      /* v2543 · WERTÜBERLEITUNG statt Wertbrücke (Marcel 20.10.2026: Variante B, Farben der
         Marke) - dieselben Zeilen wie im Tab Bewertung (DpPotenzial.ueberleitungZeilen). Stände als
         Zeilen mit Summenstrich, Veränderungen als Balken um null; keine gekürzte Achse mehr. */
      if (_PD.bruecke && _PZ.ueberleitungZeilen) {
        var _UZ = _PZ.ueberleitungZeilen(_PD.bruecke), _uRh = 7.4;
        if (cy + 12 + _UZ.length * _uRh + 8 > 280) cy = newPage('Wertpotenzial · Fortsetzung');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.CH);
        doc.text('WERTÜBERLEITUNG · ERTRAGSWERT JE STUFE', M, cy + 2); cy += 7;
        var _uG = C.GOLD, _uF = {
          bestand: [42, 39, 39], kosten: [201, 138, 132],
          soll: [Math.round(_uG[0] + (255 - _uG[0]) * 0.45), Math.round(_uG[1] + (255 - _uG[1]) * 0.45), Math.round(_uG[2] + (255 - _uG[2]) * 0.45)],
          ziel: [Math.round(_uG[0] * 0.82), Math.round(_uG[1] * 0.82), Math.round(_uG[2] * 0.82)] };
        var _uM = Math.max.apply(null, _UZ.filter(function (z) { return z.schritt; }).map(function (z) { return Math.abs(z.w); }).concat([1])) * 1.08;
        var _uBx = M + CW * 0.42, _uBw = CW * 0.34, _uMx = _uBx + _uBw / 2;
        var _uE = function (n, vz) { return (n < 0 ? '- ' : (vz && n > 0 ? '+ ' : '')) + Math.round(Math.abs(n)).toLocaleString('de-DE') + ' \u20ac'; };
        _UZ.forEach(function (z) {
          var y0 = cy, f = z.netto ? (z.w >= 0 ? [47, 125, 85] : [184, 98, 92]) : _uF[z.art];
          if (z.netto) { doc.setFillColor(251, 246, 233); doc.rect(M, y0 - 1.2, CW, _uRh, 'F'); doc.setDrawColor.apply(doc, _uG); doc.setLineWidth(0.5); doc.line(M, y0 - 1.2, M + CW, y0 - 1.2); }
          else if (z.summe) { doc.setDrawColor(42, 39, 39); doc.setLineWidth(0.35); doc.line(M, y0 - 1.2, M + CW, y0 - 1.2); }
          if (!z.netto) { doc.setFillColor(f[0], f[1], f[2]); doc.rect(M, y0 + 0.9, 2.2, 2.2, 'F'); }
          var lx = z.netto ? M + 1 : M + 4;
          doc.setFont('helvetica', (z.summe || z.netto) ? 'bold' : 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.CH);
          doc.text(String(z.t).replace(/\u2212/g, '-'), lx, y0 + 2.9);
          if (z.klein) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor.apply(doc, C.MID); doc.text(String(z.klein).replace(/\u2212/g, '-'), lx, y0 + 5.5); }
          if (z.schritt) {
            doc.setDrawColor.apply(doc, C.BORDER); doc.setLineWidth(0.15); doc.line(_uMx, y0, _uMx, y0 + 4.6);
            if (Math.abs(z.w) < 500) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor.apply(doc, C.MID); doc.text('unverändert', _uMx + 1.5, y0 + 3.2); }
            else { var bw0 = Math.abs(z.w) / _uM * (_uBw / 2 - 1), bx0 = z.w >= 0 ? _uMx : _uMx - bw0; doc.setFillColor(f[0], f[1], f[2]); doc.rect(bx0, y0 + 0.6, bw0, 3.4, 'F'); }
          }
          doc.setFont('helvetica', (z.summe || z.netto) ? 'bold' : 'normal'); doc.setFontSize(z.netto ? 9 : 8.2);
          if (z.netto) doc.setTextColor(f[0], f[1], f[2]); else doc.setTextColor.apply(doc, C.CH);
          doc.text(_uE(z.w, z.schritt), M + CW, y0 + 2.9, { align: 'right' });
          if (!z.summe && !z.netto) { doc.setDrawColor(240, 236, 228); doc.setLineWidth(0.15); doc.line(M, y0 + _uRh - 1.2, M + CW, y0 + _uRh - 1.2); }
          cy += _uRh;
        });
        cy += 1.5;
        _absatz('Balken: Veränderung gegen die Zeile darüber, gemeinsame Skala um null. Potenzial netto = Ertragswert ' + (_PD.bruecke.zielbild != null ? 'Zielbild' : 'nach Mieterhöhung') + ' minus Bestand minus Maßnahmenkosten.', { groesse: 7, zeile: 3.4 });
        cy += 2.6;
      }
      if (cy > 230) cy = newPage('Wertpotenzial · Fortsetzung');
      _tab(['Kennzahl'].concat(_PD.spalten.map(function (k) { return _PD.titel[k]; })), [58].concat(_PD.spalten.map(function () { return 30; })),
        _PD.kennzahlen.concat(_PD.kaufpreis ? [['Kaufpreis', Math.round(_PD.kaufpreis).toLocaleString('de-DE') + ' \u20ac'].concat(_PD.spalten.slice(1).map(function () { return ''; }))] : []),
        /^Ertragswert|^nach Aufteilung/);
      /* v2530 · Fußnote in zwei Absätzen (Aufteilung, dann Kennzeichnung/Grundlagen) */
      var _fu = String(_PD.fuss || ''), _au = _PD.aufteilung_hinweis ? 'Aufteilung: ' + _PD.aufteilung_hinweis + ' ' : '';
      cy += 1;
      if (_au && _fu.indexOf(_au) === 0) { _absatz(_au, { groesse: 7, zeile: 3.4 }); cy += 1.4; _fu = _fu.slice(_au.length); }
      _absatz(_fu, { groesse: 7, zeile: 3.4 });
      };
    }
  } catch (e) { try { console.warn('[pdf] Wertpotenzial', e); } catch (x) {} }

  /* ══════════════════════════════════════════════════
     SEITE 4d · v2830: WERT & ZIELBILD
     Werte je Verfahren aus dem letzten Marktbericht (wie die Pilot-Analyse,
     wertvergleich.js) und Ist / Soll / Zielbild. Gezeichnet von
     DpPdfWertZielbild (dieselbe Darstellung in der Bankfassung); ohne
     Daten entfaellt die Seite still.
  ══════════════════════════════════════════════════ */
  try {
    var _WZ = window.DpPdfWertZielbild ? await window.DpPdfWertZielbild.daten({ potenzial: (typeof _PD !== 'undefined' ? _PD : null) }) : null;
    var _pdOk = typeof _pdZeichnen === 'function';
    if (_WZ) {
      cy = newPage('Wert & Zielbild');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor.apply(doc, C.CH);
      cy = window.DpPdfBlocksatz.absatz(doc, 'Was das Objekt nach den Verfahren der Immobilienwertermittlung wert ist, im Vergleich zum Kaufpreis - und wohin sich der Ertragswert mit Mieterh\u00f6hung und Zielbild entwickelt.', { x: M, y: cy + 3, breite: CW, zeile: 4.4 }) + 2;
      /* v2900 · EIN Abschnitt: Werte je Verfahren und Wertlandschaft, dann das
         Wertpotenzial (Wohnungen, Wertueberleitung, Kennzahlen je Stufe), dann
         Ausblick, Kernaussagen und Erklaerung. Die Tafel Ist/Soll/Zielbild entfaellt
         dort, weil die Kennzahlen je Stufe dieselben Ertragswerte, Kosten und
         Marktpreisindikationen fuehren; nur die Indikation OHNE Abschlag steht dort
         nicht - sie kommt als Satz (mpiZeile). Der Hinweis nennt die Kennzeichnung
         nicht noch einmal, sie steht in der Fussnote des Wertpotenzials. */
      var _wzO = function (teile) { return {
        x: M, y: cy, breite: CW, unten: 278, stil: 'invest', teile: teile,
        neueSeite: function () { cy = newPage('Wert & Zielbild \u00b7 Fortsetzung'); return cy; },
        ueberschrift: function (t, yy) { return secH(doc, yy, t, M, CW); },
        f: { gold: C.GOLD, goldD: C.GOLD_D, goldL: C.GOLD_L, tinte: C.CH, text: [50, 45, 45], grau: C.MID, linie: C.BORDER,
          kopfGrund: C.CH, kopfText: C.GOLD, streifen: C.SURF }
      }; };
      if (_pdOk) {
        cy = window.DpPdfWertZielbild.zeichne(doc, _WZ, _wzO(['verfahren', 'landschaft']));
        try { _pdZeichnen(true); } catch (e) { try { console.warn('[pdf] Wertpotenzial', e); } catch (x) {} }
        cy += 4;
        _WZ.hinweis = 'Marktpreisindikation, Ertrags- und Sachwert sind indikativ nach ImmoWertV-Logik, kein Gutachten nach § 194 BauGB.';
        cy = window.DpPdfWertZielbild.zeichne(doc, _WZ, _wzO(['mpiZeile', 'stufenText', 'kern', 'texte', 'hinweis']));
      } else cy = window.DpPdfWertZielbild.zeichne(doc, _WZ, _wzO(null));
    } else if (_pdOk) {
      try { _pdZeichnen(false); } catch (e) { try { console.warn('[pdf] Wertpotenzial', e); } catch (x) {} }
    }
  } catch (e) { try { console.warn('[pdf] Wert & Zielbild', e); } catch (x) {} }

  /* ══════════════════════════════════════════════════
     SEITE 4e · v2830: MIETERLISTE (aus der Bankfassung)
     Nur beim Mehrfamilienhaus mit erfassten Einheiten. Gerechnet wird
     nicht hier: DpMfhEinheiten.berichtDaten() (Anlage-2-Punkte, RND).
  ══════════════════════════════════════════════════ */
  try {
    var _MFH = (window.DpMfhEinheiten && typeof window.DpMfhEinheiten.berichtDaten === 'function') ? window.DpMfhEinheiten.berichtDaten() : null;
    if (_MFH && _MFH.zeilen && _MFH.zeilen.length && doc.autoTable) {
      var _n = function (x) { var z = Number(String(x == null ? '' : x).replace(',', '.')); return isFinite(z) && z > 0 ? z : null; };
      cy = newPage('Einheiten & Zustand');
      cy = secH(doc, cy, 'Mieterliste \u00b7 ' + _MFH.zeilen.length + ' Einheiten', M, CW);
      doc.autoTable({
        startY: cy, theme: 'striped',
        head: [['Nr.', 'Lage', 'm\u00b2', 'Ist \u20ac/Monat', 'Soll \u20ac/Monat', 'Status', 'Anlage 2']],
        body: _MFH.zeilen.map(function (z) {
          return [String(z.e.nr || ''), String(z.e.lage || '').replace(/[\u2013\u2014]/g, '-').replace(/[^\x00-\xFF\u20AC]/g, ''), z.fl ? pE(z.fl) : '-',
            _n(z.e.ist) ? pE(_n(z.e.ist)) : '-', _n(z.e.soll) ? pE(_n(z.e.soll)) : '-', z.e.status === 'leer' ? 'leer' : 'vermietet', z.punkte + ' P.' + (z.geerbt === 4 ? '*' : '')];
        }),
        headStyles: { fillColor: C.CH, textColor: C.GOLD, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.4, cellPadding: 2, textColor: C.CH },
        alternateRowStyles: { fillColor: C.SURF },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } },
        margin: { left: M, right: M, top: 30, bottom: 16 }
      });
      cy = doc.lastAutoTable.finalY + 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, C.MID);
      doc.text('Anlage 2 ImmoWertV: Modernisierungspunkte je Einheit; * = Zustand vollst\u00e4ndig vom Geb\u00e4ude \u00fcbernommen.', M, cy);
      cy += 6;
      var _sollJ = (_MFH.s && _MFH.s.soll ? _MFH.s.soll * 12 : null);
      var _ist = [
        ['Kaltmiete p. a. - Ist', pE(K.nkm_j) + ' \u20ac'],
        ['Kaltmiete p. a. - Soll (nach Ma\u00dfnahmen)', _sollJ != null ? pE(_sollJ) + ' \u20ac' : '-'],
        ['Bruttomietrendite Ist (auf Kaufpreis)', pP(K.bmy, 2)],
        ['Bruttomietrendite Soll (auf Gesamtinvestition)', (_sollJ != null && K.gi > 0) ? pP(_sollJ / K.gi * 100, 2) : '-'],
        ['Rechtliche Einheit', _MFH.aufgeteilt ? 'in Wohnungseigentum aufgeteilt (WEG)' : 'ungeteiltes Geb\u00e4ude'],
        ['Modernisierungsgrad (fl\u00e4chengewichtet)', pN(_MFH.punkteGew, 1) + ' von 20 Punkten, angesetzt ' + _MFH.hausPunkte]
      ];
      if (_MFH.s && _MFH.s.leer) _ist.push(['Leerstand', _MFH.s.leer + ' Einheiten / ' + pE(_MFH.s.leerFl) + ' m\u00b2']);
      if (_MFH.s && _MFH.s.kosten) _ist.push(['Geplante Ma\u00dfnahmen', pE(_MFH.s.kosten) + ' \u20ac']);
      if (_MFH.rndGew > 0) _ist.push(['Restnutzungsdauer des Geb\u00e4udes (Anlage 2, indikativ)', Math.round(_MFH.rndGew) + ' Jahre' + (_MFH.rndInfo && _MFH.rndInfo.gnd ? ' (GND ' + _MFH.rndInfo.gnd + ')' : '')]);
      if (cy + 11 + _ist.length * 5.8 > 278) cy = newPage('Einheiten & Zustand \u00b7 Fortsetzung');
      cy = secH(doc, cy, 'Ist gegen Soll', M, CW);
      cy = kvT(doc, M, cy, CW, _ist, [_ist.length - 1]);
    }
  } catch (e) { try { console.warn('[pdf] Mieterliste', e); } catch (x) {} }

  /* ══════════════════════════════════════════════════
     SEITE 5: KI-INVESTMENT-ANALYSE (optional)
  ══════════════════════════════════════════════════ */
  // Check if user wants KI in PDF
  var aiInPdf = document.getElementById('ai-in-pdf');
  // V27: includeAi gilt auch wenn nur das neue JSON-Format (_aiAnalysis) vorliegt
  var includeAi = (!aiInPdf || aiInPdf.checked) && (window._aiText || window._aiAnalysis);
  if (includeAi) {
  cy = newPage('Pilot-Analyse');

  // Header-Banner
  doc.setFillColor.apply(doc, C.CH); doc.roundedRect(M, cy, CW, 13, 2, 2, 'F');
  doc.setFillColor.apply(doc, C.GOLD); doc.rect(M, cy, CW, 1.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.setTextColor.apply(doc, C.GOLD);
  doc.text('PILOT-ANALYSE', M + 5, cy + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.setTextColor(140, 130, 110);
  (function(){var b=_getBranding();doc.text('KI-Analyse via ' + _pn() + (b.company ? ' \u00b7 ' + b.company : ''), W - M, cy + 9, { align: 'right' });})();
  cy += 16;

  // V27: Wenn neues JSON-Format (_aiAnalysis) vorliegt -> strukturiert rendern und Section-Parser überspringen
  if (window._aiAnalysis && typeof window._aiAnalysis === 'object') {
    cy = _renderAiJsonInPdf(doc, window._aiAnalysis, cy, M, CW, W, C, _stripMd, newPage);
    // Skip die alten String-basierten Sections
  } else {

  // Sektionen der KI-Analyse parsen und darstellen
  {
    var aiSections = [
      { key: 'INVESTITIONSBEWERTUNG',  altKeys: [],                       bg: C.BLUE_BG,    acc: C.BLUE  },
      { key: 'ST\u00c4RKEN',           altKeys: ['STAERKEN', 'STARKEN'],  bg: C.GREEN_BG,   acc: C.GREEN },
      { key: 'RISIKEN',                altKeys: [],                       bg: C.RED_BG,     acc: C.RED   },
      { key: 'VERHANDLUNGSEMPFEHLUNG', altKeys: [],                       bg: [250,245,230],acc: C.GOLD  },
      { key: 'KAUFPREIS-OFFERTE',      altKeys: ['KAUFPREIS_OFFERTE','KAUFPREISOFFERTE','OFFERTE','ANGEBOTSSCHREIBEN'], bg: [240,232,255], acc: [122,90,181] },
      { key: 'BANKARGUMENTE',          altKeys: [],                       bg: C.GREEN_BG,   acc: C.GREEN },
      { key: 'FAZIT',                  altKeys: ['EMPFEHLUNG','ZUSAMMENFASSUNG'], bg: C.CH,  acc: C.GOLD  }
    ];

    // Hilfsfunktion: extrahiert Inhalt einer Section
    function extractSection(text, sec, allSecs, secIdx) {
      var keys = [sec.key].concat(sec.altKeys);
      var nextSec = allSecs[secIdx + 1];
      var nextKeys = nextSec ? [nextSec.key].concat(nextSec.altKeys) : [];
      // Versuche jeden möglichen Key
      for (var k = 0; k < keys.length; k++) {
        var keyEsc = keys[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var rx;
        if (nextKeys.length > 0) {
          var nextKeysEsc = nextKeys.map(function(nk){ return nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
          rx = new RegExp(keyEsc + ':\\s*([\\s\\S]*?)(?=(?:' + nextKeysEsc.join('|') + '):)', 'i');
        } else {
          rx = new RegExp(keyEsc + ':\\s*([\\s\\S]*)$', 'i');
        }
        var m = text.match(rx);
        if (m) return m[1].trim();
      }
      return null;
    }

    // V23: Markdown-Marker entfernen, BEVOR der Text in splitTextToSize läuft.
    // Die KI liefert oft "**fett**" oder "*kursiv*" - das rendert in jsPDF als
    // rohe Sternchen. Wir wandeln in Klartext.
    // V24: Aggressiver - alle übrigen Sterne am Ende löschen, weil die KI
    // manchmal nicht-geschlossene Sterne oder leere "**" am Zeilenende liefert.
    function stripMarkdown(s) {
      if (!s) return '';
      return s
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')  // ***fett+kursiv*** -> text
        .replace(/\*\*([^*]+)\*\*/g, '$1')      // **fett** -> fett
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')  // *kursiv* -> kursiv
        .replace(/__([^_]+)__/g, '$1')          // __fett__ -> fett
        .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1') // _kursiv_ -> kursiv
        .replace(/`([^`]+)`/g, '$1')            // `code` -> code
        .replace(/^\s*#{1,6}\s+/gm, '')         // Markdown-Headlines
        .replace(/^\s*[-*+]\s+/gm, '- ')        // Bulletlist normalisieren
        .replace(/\u2022/g, '-')                // Bullet • -> -
        .replace(/[\u2018\u2019]/g, "'")        // typografische Apostrophe
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // typografische "
        .replace(/-|--/g, '-')         // En/Em-Dash
        .replace(/\u2026/g, '...')              // Ellipsis
        .replace(/\*+/g, '')                    // V24: Alle übriggebliebenen Sterne weg
        .replace(/^\s*[\r\n]+/gm, '')           // Leere Zeilen am Anfang
        .replace(/\n{3,}/g, '\n\n')             // Max 2 Zeilenumbrüche hintereinander
        .trim();
    }

    // Robuste Section-Renderer mit Auto-Pagination
    function renderAISection(sec, secIdx) {
      var bodyRaw = extractSection(window._aiText, sec, aiSections, secIdx);
      if (!bodyRaw) return;
      var body = stripMarkdown(bodyRaw);

      // V23-Fix: Font MUSS vor splitTextToSize gesetzt sein
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);

      // V63.67: Padding 14mm links + 14mm rechts + 6mm Sicherheits-Reserve gegen Wort-Überlauf
      var leftPad = 14;
      var rightPad = 14;
      var maxWidthForText = CW - leftPad - rightPad - 6;
      /* v2830 · Zeilen mit Absatzende (Blocksatz) statt reiner Zeichenketten */
      var lines = window.DpPdfBlocksatz ? window.DpPdfBlocksatz.zeilen(doc, body, maxWidthForText) : doc.splitTextToSize(body, maxWidthForText);

      // V63.67: Bei 8.8pt-Schrift braucht eine Zeile ca. 4.9mm - vorher 4.5 zu eng
      var lineHeight = 4.9;
      var headerH = 9;
      var paddingTop = 4;       // Luft zwischen Header und Text-Anfang
      var paddingBottom = 7;    // genug Boden, damit letzte Zeile sicher in Box bleibt

      var totalH = headerH + paddingTop + (lines.length * lineHeight) + paddingBottom;
      var availableH = 278 - cy;

      // Wenn die ganze Section nicht passt, neue Seite
      if (totalH > availableH) {
        if (totalH > 250) {
          renderAISectionWithBreak(sec, lines, lineHeight, headerH, paddingBottom);
          return;
        }
        doc.addPage(); pageNum++;
        cy = pageTpl(doc, pageNum, 'KI-Analyse (Fortsetzung)', W, M);
      }

      // Render section
      doc.setFillColor.apply(doc, sec.bg);
      doc.roundedRect(M, cy, CW, totalH, 2, 2, 'F');
      doc.setFillColor.apply(doc, sec.acc);
      doc.rect(M, cy, 3, totalH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, sec.acc);
      doc.text(sec.key, M + leftPad, cy + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.32);
      var isDark = JSON.stringify(sec.bg) === JSON.stringify(C.CH);
      doc.setTextColor.apply(doc, isDark ? [215, 205, 180] : [50, 45, 45]);

      var textY = cy + headerH + paddingTop + 2;  // +2 für Baseline-Offset
      lines.forEach(function(line) {
        if (window.DpPdfBlocksatz) window.DpPdfBlocksatz.zeile(doc, line, M + leftPad, textY, maxWidthForText, true); else doc.text(line, M + leftPad, textY);
        textY += lineHeight;
      });
      if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.15);

      cy += totalH + 5;
    }

    // Renderer für lange Sections die nicht auf eine Seite passen
    function renderAISectionWithBreak(sec, lines, lineHeight, headerH, paddingBottom) {
      var paddingTop = 4;
      var availableH = 278 - cy;
      var firstChunkLines = Math.floor((availableH - headerH - paddingTop - paddingBottom) / lineHeight);
      if (firstChunkLines < 5) {
        doc.addPage(); pageNum++;
        cy = pageTpl(doc, pageNum, 'KI-Analyse (Fortsetzung)', W, M);
        availableH = 278 - cy;
        firstChunkLines = Math.floor((availableH - headerH - paddingTop - paddingBottom) / lineHeight);
      }

      var chunks = [];
      for (var i = 0; i < lines.length; i += firstChunkLines) {
        chunks.push(lines.slice(i, i + firstChunkLines));
      }

      chunks.forEach(function(chunkLines, chunkIdx) {
        if (chunkIdx > 0) {
          doc.addPage(); pageNum++;
          cy = pageTpl(doc, pageNum, sec.key + ' (Fortsetzung)', W, M);
        }
        var totalH = headerH + paddingTop + (chunkLines.length * lineHeight) + paddingBottom;
        doc.setFillColor.apply(doc, sec.bg);
        doc.roundedRect(M, cy, CW, totalH, 2, 2, 'F');
        doc.setFillColor.apply(doc, sec.acc);
        doc.rect(M, cy, 3, totalH, 'F');
        if (chunkIdx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor.apply(doc, sec.acc);
          doc.text(sec.key, M + 14, cy + 7);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.32);
        var isDark = JSON.stringify(sec.bg) === JSON.stringify(C.CH);
        doc.setTextColor.apply(doc, isDark ? [215, 205, 180] : [50, 45, 45]);
        var textY = cy + headerH + paddingTop + 2;
        chunkLines.forEach(function(line) {
          if (window.DpPdfBlocksatz) window.DpPdfBlocksatz.zeile(doc, line, M + 14, textY, CW - 34, true); else doc.text(line, M + 14, textY);
          textY += lineHeight;
        });
        if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.15);
        cy += totalH + 5;
      });
    }

    aiSections.forEach(function(sec, i) {
      renderAISection(sec, i);
    });
  }  // end if (window._aiText) block
  } // end else (kein _aiAnalysis JSON)


  // V191: Vermögensaufbau-Tabelle hier ENTFERNT — war redundant zum
  // Chart + KPI-Boxen auf Seite 4b (_drawEquityAndWaterfallCombined).
  // Marcel: "auf der letzten Seite ist nochmal der Vermögensaufbau angegeben.
  // den kannst du rausnehmen."
  }  // end if (includeAi)
  setPdfProgress(80);

  /* ══════════════════════════════════════════════════
     SEITE 6: ANNAHMEN & DISCLAIMER
  ══════════════════════════════════════════════════ */
  cy = newPage('Annahmen & Hinweise');

  cy = secH(doc, cy, 'Verwendete Prognose-Annahmen', M, CW);
  // V63.52: Annahmen-Tabelle erweitern bei Tilgungsaussetzung
  var _baseAnnahmen = [
    ['Mietentwicklung',                window._dpPdfMiete().text, 'Annahme', window._dpPdfMiete().modus === 'prog' ? 'Erfahrungswert' : (window._dpPdfMiete().modus === 'detail' ? 'Erhöhungsplan im Objekt' : 'aus den Einheiten')],
    ['Wertsteigerung p.a.',             pP(v('wertstg'), 1), 'Annahme', 'Konservativ B-/C-Stadt'],
    ['Kostensteigerung p.a.',           pP(v('kostenstg'), 1),'Annahme', 'Orientiert an Inflationsrate'],
    ['Leerstand p.a.',                  pP(v('leerstand'), 1),'Annahme', 'Vollvermietung angenommen'],
    ['Anschlusszinssatz',               pP(v('anschl_z'), 1), 'Annahme', 'Konservativer Puffer \u00fcber aktuellem Niveau'],
    ['Anschluss-Tilgung',               pP(v('anschl_t'), 1), 'Annahme', 'Markt\u00fcblicher Satz'],
    ['Exit-Rendite (Verkaufsszenario)', pP(v('exit_bmy'), 1), 'Annahme', 'Markt\u00fcblich f\u00fcr Standort'],
    ['Betrachtungszeitraum',            ((State.btj || parseInt(g('btj'), 10) || (State.cfRows || []).length) || '-') + ' Jahre',  'Festwert', '-'],   /* v2463: Feld leer ergab „ Jahre" */
    ['Grunderwerbsteuer NRW',           '6,50 %',              'Gesetz',   'GrEStG \u00a7 11 NRW'],
    /* v2463 · stand fest auf „2,00 %" - das Objekt rechnete mit 6,25 % (die Bankfassung zeigte den echten Satz) */
    ['AfA-Satz Geb\u00e4ude',          v('afa_satz') > 0 ? pP(v('afa_satz'), 2) + ' p.a.' : '2,00 % p.a.', v('afa_satz') > 0 && Math.abs(v('afa_satz') - 2) > 0.001 ? 'Eingabe' : 'Gesetz', '\u00a7 7 EStG'],
    ['Geb\u00e4udeanteil am KP',       pP(v('geb_ant'), 0),   'Sch\u00e4tzwert', 'steuerliche Grundlage \u00a7 7 EStG'],
    /* v1383: Herkunft und Fundstelle sagen jetzt, was wirklich rechnet. */
    ['Pers\u00f6nl. Grenzsteuersatz',   pP(v('grenz'), 2),
     v('zve') > 0 ? 'Vergleich' : 'Eingabe',
     v('zve') > 0 ? 'Steuerwirkung nach \u00a7 32a EStG aus dem zvE'
                  : 'Aus Steuer-Modul']
  ];
  if (g('d1_type') === 'tilgungsaussetzung') {
    _baseAnnahmen.push(['Darlehenstyp D1',     'Tilgungsaussetzung',  'Vertrag', 'Hauptdarlehen ohne laufende Tilgung']);
    if (v('bspar_rate') > 0)
      _baseAnnahmen.push(['Bausparrate / Monat', pE(v('bspar_rate')), 'Vertrag', 'Sparrate Bausparvertrag']);
    if (v('bspar_sum') > 0)
      _baseAnnahmen.push(['Bausparsumme',         pE(v('bspar_sum')), 'Vertrag', 'Tilgt am Zuteilungsdatum die Restschuld']);
    if (v('bspar_zins') > 0)
      _baseAnnahmen.push(['BSV-Guthabenzins',     pP(v('bspar_zins'), 2), 'Vertrag', 'Verzinsung des Bausparguthabens']);
    if (g('bspar_zuteil'))
      _baseAnnahmen.push(['BSV-Zuteilungsdatum',  g('bspar_zuteil'),  'Vertrag', 'Ablösungsdatum Hauptdarlehen']);
    // V63.66: Bauspardarlehens-Konditionen ergänzt
    if (v('bspar_dar_z') > 0)
      _baseAnnahmen.push(['Bauspardarlehens-Zins', pP(v('bspar_dar_z'), 2), 'Vertrag', 'Sollzins nach Zuteilung']);
    if (v('bspar_dar_t') > 0)
      _baseAnnahmen.push(['Bauspardarlehens-Tilgung', pP(v('bspar_dar_t'), 2), 'Vertrag', 'Tilgungsrate Bauspardarlehen']);
    if (v('bspar_quote_min') > 0)
      _baseAnnahmen.push(['Mindest-Sparquote', pP(v('bspar_quote_min'), 0), 'Vertrag', 'Voraussetzung für Zuteilung']);
  }
  // V63.66: Wert-Anker für Wertsteigerung explizit, wenn nicht Kaufpreis
  if (State.wert_basis && State.wert_basis !== v('kp')) {
    var _wbLabel2 = (v('svwert') > 0)
      ? 'Verkehrswert'
      : 'Bankbewertung';
    _baseAnnahmen.push(['Wert-Anker', pE(State.wert_basis), _wbLabel2, 'Startwert für Wertsteigerung statt Kaufpreis']);
  }
  if (doc.autoTable) {
    doc.autoTable({
      head: [['Parameter', 'Wert', 'Typ', 'Quelle / Bemerkung']],
      body: _baseAnnahmen,
      startY: cy, theme: 'grid',
      headStyles: { fillColor: C.CH, textColor: [190, 168, 110], fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: C.CH, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { textColor: C.MID }, 3: { textColor: C.MID } },
      alternateRowStyles: { fillColor: C.SURF },
      margin: { left: M, right: M }
    });
    cy = doc.lastAutoTable.finalY + 10;
  }

  // Disclaimer-Box
  doc.setFillColor.apply(doc, C.CH); doc.roundedRect(M, cy, CW, 26, 2, 2, 'F');
  doc.setFillColor.apply(doc, C.GOLD); doc.rect(M, cy, CW, 0.8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, C.GOLD);
  doc.text('WICHTIGER HINWEIS / DISCLAIMER', M + 5, cy + 7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(165, 155, 135);
  var disc = 'Dieses Dokument dient ausschlie\u00dflich der internen Investitionsanalyse und stellt keine Steuer-, Rechts- oder Anlageberatung dar. Alle Angaben ohne Gew\u00e4hr. Prognosen basieren auf Annahmen und k\u00f6nnen von der tats\u00e4chlichen Entwicklung abweichen. Konsultieren Sie einen qualifizierten Steuerberater.';
  /* v2830 · Blocksatz */
  if (window.DpPdfBlocksatz) window.DpPdfBlocksatz.absatz(doc, disc, { x: M + 5, y: cy + 13, breite: CW - 10, zeile: 3.6 });
  else doc.text(doc.splitTextToSize(disc, CW - 10), M + 5, cy + 13);
  cy += 30;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, C.MID);
  doc.text(
    'Erstellt: ' + new Date().toLocaleDateString('de-DE') + ' ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) +
    '  \u00b7  ' + _pn() + (_getBranding().company && _getBranding().company !== _pn() ? ' \u00b7 ' + _getBranding().company : '') + (_getBranding().website ? '  \u00b7  ' + _getBranding().website : ''),
    M, cy
  );
  setPdfProgress(90);

    

  setPdfProgress(72);

  // V23: Letzte Seite (Kontakt & Bewertung) entfernt - der Footer auf jeder Seite
  // zeigt die Kontaktdaten ohnehin schon. Eine separate Schluss-Seite hat sich
  // optisch nicht bewährt.

  /* WASSERZEICHEN für Free-Plan */
  _applyWatermarkIfFree(doc, W);

  /* SPEICHERN - Filename: V63.86 "Investment-PDF_..." statt "DealPilot_..." */
  setPdfProgress(98);
  var _fnSeq = window._currentObjSeq ? window._currentObjSeq + '_' : '';
  var fn = 'Investment-PDF_' + _fnSeq + (g('ort') || 'Objekt').replace(/\s/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';

  // V63.75: Wenn der Aufrufer `__returnBlob` setzt, geben wir ein Blob zurück
  // statt zu speichern (für Anhang an Deal-Aktion-E-Mails).
  // V183: null-safe — typeof null === 'object' bringt sonst Crash beim
  // Property-Read.
  var _retMode = window._exportPdfReturnMode;
  if (_retMode && typeof _retMode === 'object' && _retMode.returnBlob) {
    _retMode.blob = doc.output('blob');
    _retMode.filename = fn;
    showPdfModal(false);
    return;
  }

  doc.save(fn);
  await new Promise(function(r) { setTimeout(r, 400); });
  showPdfModal(false);
  toast('OK PDF gespeichert: ' + fn);
}

// V63.75: Convenience-Wrapper - generiert die PDF und gibt {blob, filename} zurück
// ohne dem User einen Download zu triggern. Wird von deal-action.js verwendet.
// V183: null-safe — wenn _exportPdfReturnMode zwischendurch genullt wird (z.B.
// durch andere async-Pfade), wirft das Lesen sonst eine Exception.
async function exportPDFBlob() {
  window._exportPdfReturnMode = { returnBlob: true };
  try {
    await exportPDF();
    var rm = window._exportPdfReturnMode;
    if (!rm || !rm.blob) return null;
    return { blob: rm.blob, filename: rm.filename };
  } catch (e) {
    console.error('[pdf] exportPDFBlob fehlgeschlagen:', e && e.message);
    return null;
  } finally {
    window._exportPdfReturnMode = null;
  }
}
window.exportPDFBlob = exportPDFBlob;
