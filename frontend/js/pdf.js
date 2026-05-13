'use strict';

/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN - pdf.js V5.0
   Professioneller 7-seitiger Investment Case
   Seiten: 1=Deckblatt 2=Executive Summary 3=Objekt&Finanzierung
           4=Cashflow-Tabelle 5=KI-Analyse 6=Annahmen 7=Kontakt&QR
═══════════════════════════════════════════════════ */

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
    { key: 'logoDealpilot', path: 'assets/dealpilot_logo.png' }
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
  return b.company || 'DealPilot';
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
    var planKey = window.DealPilotConfig && DealPilotConfig.pricing
                    ? DealPilotConfig.pricing.currentKey() : 'free';
    if (planKey !== 'free') return;
    var limits = (window.DealPilotConfig && DealPilotConfig.pricing
                    ? DealPilotConfig.pricing.current().limits : { watermark: true });
    if (limits.watermark === false) return;
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
        doc.text('DealPilot Free', W / 2, 80,  { align: 'center', angle: 30 });
        doc.text('DealPilot Free', W / 2, 165, { align: 'center', angle: 30 });
        doc.text('DealPilot Free', W / 2, 250, { align: 'center', angle: 30 });
      } catch(e) {}
      doc.restoreGraphicsState && doc.restoreGraphicsState();
    }
  } catch(e) { console.warn('Watermark failed:', e.message); }
}
window._applyWatermarkIfFree = _applyWatermarkIfFree;



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
      var allTexts = clone.querySelectorAll('text, tspan');
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
function pP(n, d) { d = d || 2; return isNaN(n) ? '-' : n.toFixed(d).replace('.', ',') + ' %'; }
function pN(n, d) { d = d || 1; return isNaN(n) ? '-' : n.toFixed(d).replace('.', ','); }

/* ── PAGE TEMPLATE ──────────────────────────────── */
function pageTpl(doc, num, subtitle, W, M) {
  W = W || 210; M = M || 15;
  // Header
  doc.setFillColor.apply(doc, C.CH);
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
    doc.setTextColor.apply(doc, C.WHITE);
    doc.text(subtitle.toUpperCase(), W / 2, 13, { align: 'center' });
  }
  // Seitennummer rechts
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor.apply(doc, C.MID);
  doc.text('Seite ' + num, W - M, 17, { align: 'right' });
  // Footer
  doc.setFillColor.apply(doc, C.CH);
  doc.rect(0, 285, W, 12, 'F');
  doc.setFillColor.apply(doc, C.GOLD);
  doc.rect(0, 285, W, 0.4, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  doc.setTextColor(120, 110, 90);
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
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(90,85,80);
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
function _renderAiJsonInPdf(doc, a, cy, M, CW, W, C, stripMd, newPage) {
  function clean(s) {
    if (s == null) return '';
    var t = '' + s;
    if (typeof stripMd === 'function') t = stripMd(t);
    return t.replace(/\*+/g, '').trim();
  }
  function maybePage(needed) {
    if (cy + needed > 280) cy = newPage('KI-Investment-Analyse');
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
        var wrapped = doc.splitTextToSize(hl, maxW);
        wrapped.forEach(function(w) { allLines.push(w); });
      });
    });
    return allLines;
  }

  function block(title, text, bgColor, accentColor, isDarkBg) {
    if (!text) return;
    // V63.71: Schriftgröße VOR splitTextToSize setzen - sonst nimmt jsPDF die alte Größe
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    // V63.71: Sehr konservatives TEXT_W (CW - 24mm = 6 links + 18 rechts Sicherheit)
    var TEXT_W = CW - 24;
    var lines = _splitParagraphs(text, TEXT_W);
    // V63.71: LINE_H 5.2mm - generous für lange dt. Wörter mit Descender
    var LINE_H = 5.2;
    // V63.71: Mehr Header-Luft (6mm) + Bottom-Padding (7mm) für Sicherheit
    var blockH = 6 + 6 + lines.length * LINE_H + 7;
    maybePage(blockH);

    doc.setFillColor.apply(doc, bgColor); doc.roundedRect(M, cy, CW, blockH, 1.8, 1.8, 'F');
    doc.setFillColor.apply(doc, accentColor); doc.rect(M, cy, 2, blockH, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8);
    doc.setTextColor.apply(doc, accentColor);
    doc.text(title.toUpperCase(), M + 6, cy + 6);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.35);
    if (isDarkBg) {
      doc.setTextColor(245, 245, 240);
    } else {
      doc.setTextColor(45, 42, 42);
    }
    var textY = cy + 12;
    lines.forEach(function(line) {
      doc.text(line, M + 6, textY);
      textY += LINE_H;
    });
    if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.15);
    cy += blockH + 4;
  }

  function bulletBlock(title, items, bgColor, accentColor) {
    if (!Array.isArray(items) || !items.length) return;
    // V63.71: Schriftgröße VOR splitTextToSize
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    var TEXT_W = CW - 28;
    var rendered = [];
    items.forEach(function(it) {
      var line = clean(it);
      if (!line) return;
      var wrapped = doc.splitTextToSize(line, TEXT_W);
      wrapped.forEach(function(w, idx) {
        rendered.push((idx === 0 ? '\u2022  ' : '   ') + w);
      });
    });
    var LINE_H = 5.2;
    var blockH = 6 + 6 + rendered.length * LINE_H + 7;
    maybePage(blockH);

    doc.setFillColor.apply(doc, bgColor); doc.roundedRect(M, cy, CW, blockH, 1.8, 1.8, 'F');
    doc.setFillColor.apply(doc, accentColor); doc.rect(M, cy, 2, blockH, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8);
    doc.setTextColor.apply(doc, accentColor);
    doc.text(title.toUpperCase(), M + 6, cy + 6);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.35);
    doc.setTextColor(45, 42, 42);
    var textY = cy + 12;
    rendered.forEach(function(line) {
      doc.text(line, M + 6, textY);
      textY += LINE_H;
    });
    if (typeof doc.setLineHeightFactor === 'function') doc.setLineHeightFactor(1.15);
    cy += blockH + 4;
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
    if (sz) block('Szenario-Analyse', sz, [248, 244, 232], [201, 168, 76]);
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
    block('Empfehlung', emp, [248, 244, 232], [201, 168, 76]);
  }

  // V29: Klassische Sektionen aus der alten KI-Analyse
  if (a.investmentbewertung) {
    block('Investmentbewertung', clean(a.investmentbewertung), [235, 241, 248], [60, 102, 148]);
  }
  if (a.verhandlungsempfehlung) {
    block('Verhandlungsempfehlung', clean(a.verhandlungsempfehlung), [250, 244, 230], [201, 168, 76]);
  }
  if (a.kaufpreis_offerte && typeof a.kaufpreis_offerte === 'object') {
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
  if (Array.isArray(a.bankargumente) && a.bankargumente.length) {
    bulletBlock('Bankargumente', a.bankargumente, [232, 244, 234], [42, 154, 90]);
  }

  // 7. DealPilot-Insight (V63.45: dunkler Hintergrund mit hellem Text)
  if (a.dealpilot_insight) {
    block('DealPilot-Insight', clean(a.dealpilot_insight), [40, 38, 38], [201, 168, 76], true);
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

  var objName = [g('str'), g('hnr'), g('ort')].filter(Boolean).join(', ') || 'Kalkulation';
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
  doc.setFillColor.apply(doc, C.CH); doc.rect(0, 0, W, 297, 'F');

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
  doc.setTextColor.apply(doc, C.WHITE);
  var nl = doc.splitTextToSize(objName.toUpperCase(), CW - 10);
  doc.text(nl, W / 2, 76, { align: 'center' });

  // Details
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  doc.setTextColor(165, 155, 135);
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
    doc.setFillColor(52, 49, 49); doc.roundedRect(x, yy, cw4, 20, 2, 2, 'F');
    doc.setFillColor.apply(doc, C.GOLD); doc.rect(x, yy, cw4, 1.2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(120, 110, 90);
    doc.text(k.l.toUpperCase(), x + 3, yy + 7);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor.apply(doc, C.GOLD);
    doc.text(k.v, x + cw4 - 3, yy + 16, { align: 'right' });
  });

  // Titelfoto - Aspect Ratio wird respektiert
  cy = 127;
  if (_PHOTO_META.length > 0) {
    var containerH = 58;
    drawPhotoFit(doc, _PHOTO_META[0], M, cy, CW, containerH, [30, 27, 27]);
    cy += containerH + 3;
  } else { cy += 2; }

  // Investitionsthese
  var thesis = g('thesis');
  if (thesis) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.setTextColor(185, 175, 155);
    var tl = doc.splitTextToSize('"' + thesis + '"', CW - 10);
    doc.text(tl.slice(0, 4), W / 2, Math.max(cy + 6, 198), { align: 'center' });
  }

  // Datum & Kürzel
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(120, 110, 90);
  (function(){var uc=_getBranding();var creator=uc.name||uc.company||'DealPilot';doc.text('Erstellt am ' + new Date().toLocaleDateString('de-DE') + '  \u00b7  K\u00fcrzel: ' + (g('kuerzel') || '-') + '  \u00b7  DealPilot \u00b7 ' + creator, W / 2, 258, { align: 'center' });})();
  doc.text('Vertraulich \u00b7 Nur f\u00fcr den internen Gebrauch', W / 2, 264, { align: 'center' });

  // Footer Deckblatt - zeigt Branding-Daten aus den Settings
  doc.setFillColor.apply(doc, C.CH2); doc.rect(0, 270, W, 27, 'F');
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
    photos.forEach(function(pm, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var x = M + col * (cellW + gap);
      var y = cy + row * (cellH + gap);
      // Check if we need a new page
      if (y + cellH > 275) return; // skip if would overflow
      drawPhotoFit(doc, pm, x, y, cellW, cellH, [30, 27, 27]);
      // Bildunterschrift
      doc.setFillColor(30, 27, 27);
      doc.rect(x, y + cellH - 6, cellW, 6, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor.apply(doc, C.GOLD);
      doc.text('Foto ' + (i + 1), x + 3, y + cellH - 1.8);
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
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, C.CH);
  doc.text(objName, M + 7, cy + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
  doc.text(objDetail, W - M, cy + 8, { align: 'right' });
  cy += 15;

  // 4 dunkle KPI-Tiles Reihe 1
  var tw4 = (CW - 9) / 4;
  [
    { l: 'Bruttomietrendite', v: pP(K.bmy),           c: K.bmy >= 5 ? C.GREEN : C.GOLD },
    { l: 'Nettomietrendite',  v: pP(K.nmy),           c: K.nmy >= 3 ? C.GREEN : C.GOLD },
    { l: 'CF/Monat n.St.',    v: pE(K.cf_m, true),    c: K.cf_m >= 0 ? C.GREEN : C.RED }
  ].forEach(function(k, i) { kBox(doc, M + i * (tw4 + 3), cy, tw4, 20, k.l, k.v, k.c); });
  cy += 23;

  // 4 KPI-Tiles Reihe 2
  [
    { l: 'LTV',              v: pP(K.ltv, 1) },
    { l: 'DSCR',             v: pN(K.dscr, 2) + (K.dscr >= 1.5 ? ' OK' : ' !') },
    { l: 'Faktor',           v: pN(K.fak, 1) },
    { l: 'Equity Multiple',  v: pN(K.em, 1) + 'x' }
  ].forEach(function(k, i) { kBox(doc, M + i * (tw4 + 3), cy, tw4, 18, k.l, k.v, C.GOLD); });
  cy += 21;

  // Szenarien
  var sw3 = (CW - 8) / 3;
  sBox(doc, M,             cy, sw3, 'Heute (' + new Date().getFullYear() + ')', pE(K.cf_ns, true), 'CF p.a. nach Steuern', C.GREEN_BG, C.GREEN);
  sBox(doc, M + sw3 + 4,  cy, sw3, 'Ende Zinsbindung',                         pE(K.cf_ezb, true),'CF p.a. prognose',      [250,245,232], C.GOLD);
  sBox(doc, M+(sw3+4)*2,  cy, sw3, 'Exit / Verkauf',                            pE(K.exit_vkp - Math.max(0, State.rs), true), 'M\u00f6gl. Gewinn', C.CH, C.GOLD);
  cy += 22;

  // CF Rechnung + Kennzahlen nebeneinander
  var hw = (CW - 5) / 2;
  var cyA = cy;
  cy = secH(doc, cy, 'Cashflow-Rechnung heute', M, hw);
  // V63.35.1: Anzeige Warmmiete oben -> UL durchlaufend -> Kaltmiete -> NUL -> NOI
  // (mathematisch identisch zur Excel-Logik NKM - NUL)
  var bwk_ul_now = K.bwk_ul || 0;
  var bwk_nul_now = K.bwk_nul || 0;
  var nkm_now = K.nkm_j;
  var warmmiete_now = nkm_now + bwk_ul_now;
  var kaltmiete_now = warmmiete_now - bwk_ul_now;  // = nkm_now
  var noi_now = kaltmiete_now - bwk_nul_now;
  var cf_nz_now = noi_now - K.zins_j;
  var cf_vst_now = cf_nz_now - K.tilg_j;
  // V63.51: Bauspar bei Tilgungsaussetzung
  var _bsparY_p2 = (State.bsparRate_m || 0) * 12;
  var _hasBspar_p2 = _bsparY_p2 > 0;
  var _cfRows = [
    ['Warmmiete / Jahr (Kalt + UL-Erstattung)',  pE(warmmiete_now)],
    ['- Umlagef. BWK (durchlaufend)',     '- ' + pE(bwk_ul_now)],
    ['= Kaltmiete (NKM + ZE)',                   pE(kaltmiete_now, true)],
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
  _cfRows.push(['\u00b1 Steuern / Jahr',                    (K.steuer < 0 ? '+ ' : '- ') + pE(Math.abs(K.steuer))]);
  _cfRows.push(['= CF nach Steuern / Jahr (operativ)',      pE(K.cf_ns, true)]);
  _cfRows.push(['= CF nach Steuern / Monat',                pE(K.cf_ns_m || (K.cf_ns/12), true)]);
  kvT(doc, M, cy, hw, _cfRows, [2, 4, 6, 8, 10, 11]);

  cy = secH(doc, cyA, 'Alle Kennzahlen', M + hw + 5, hw);
  kvT(doc, M + hw + 5, cy, hw, [
    ['Bruttomietrendite',    pP(K.bmy)],
    ['Nettomietrendite',     pP(K.nmy)],
    ['Faktor (KP/NKM)',      pN(K.fak, 1)],
    ['EK-Rendite p.a.',      pP(K.ekr, 1)],
    ['Equity Multiple',      pN(K.em, 1) + 'x'],
    ['DSCR',                 pN(K.dscr, 2)],
    ['LTV',                  pP(K.ltv, 1)],
    ['Wertpuffer / Equity',  pE(K.wp_kpi, true)],
    ['AfA / Jahr',           pE(K.afa)],
    ['Zu versteuernder CF',  pE(K.zve_immo, true)],
    ['Zinsrisiko / Mon.',    pE(K.zaer_m) + '/Mon.']
  ], [4, 5]);
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
    ['Junker Immo. (' + pP(v('ji_p'), 2) + ')', pE(K.kp * v('ji_p') / 100)],
    ['Sanierungskosten',          pE(v('san'))],
    ['M\u00f6blierung',           pE(v('moebl'))],
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
    finRows.push(['Monatliche Rate', pE(d1_rate, 2)]);
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
    doc.text('Sofortiger Wertpuffer / Equity: ' + pE(K.wp_kpi, true), M + 7, cy + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
    doc.text('Kaufpreis ' + pE(K.kp) + '  vs.  Verkehrswert ' + pE(v('svwert')), W - M, cy + 8, { align: 'right' });
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
  doc.setFillColor.apply(doc, [201, 168, 76]);
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
    doc.text('Bei Tilgungsaussetzung wird das Hauptdarlehen \u00fcber den Bausparvertrag abgel\u00f6st. Die Bausparrate ist als Liquidit\u00e4tsabfluss im CF enthalten, aber kein Werbungskostenabzug.',
             M + 5, cy + 7, { maxWidth: CW - 10 });
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
  kvT(doc, M, cy, CW, [
    ['Hausgeld umlagef\u00e4hig / Jahr',       pE(v('hg_ul'))],
    ['Grundsteuer / Jahr',                     pE(v('grundsteuer'))],
    ['Sonstiges umlagef\u00e4hig',             pE(v('ul_sonst'))],
    ['Summe umlagef\u00e4hig',                 pE(v('hg_ul') + v('grundsteuer') + v('ul_sonst'))],
    ['Hausgeld nicht umlagef\u00e4hig / Jahr', pE(v('hg_nul'))],
    ['WEG-R\u00fccklage / Jahr (Info)',        pE(v('weg_r'))],
    ['Eigene Instandhaltungsr\u00fccklage',    pE(v('eigen_r'))],
    ['Kalkulat. Mietausfall',                  pE(v('mietausfall'))],
    ['Summe nicht umlagef\u00e4hig',           pE(v('hg_nul') + v('eigen_r') + v('mietausfall') + v('nul_sonst'))],
    ['BWK Gesamt / Jahr',                      pE(K.bwk)],
    ['BWK als % der NKM',                      pP(K.nkm_j > 0 ? K.bwk / K.nkm_j * 100 : 0, 1)]
  ], [3, 8, 9]);

  setPdfProgress(50);

  /* ══════════════════════════════════════════════════
     SEITE 3b: CASHFLOW-RECHNUNGEN (Heute, EZB, Anschluss)
  ══════════════════════════════════════════════════ */
  cy = newPage('Cashflow-Rechnungen \u00b7 3 Phasen');

  // Intro-Hinweis
  doc.setFillColor.apply(doc, C.SURF2); doc.roundedRect(M, cy, CW, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.MID);
  doc.text('Vergleich der Cashflows in 3 Phasen: Heute (aktuelles Jahr), Ende Zinsbindung (' + g('d1_bindj') + ' Jahre), Anschluss (mit kalk. ' + pP(v('anschl_z'), 1) + ')', W/2, cy + 6, { align: 'center' });
  cy += 12;

  var cfColW = (CW - 8) / 3;

  function drawCFCard(x, y, title, accent, data) {
    // V63.51: Bei Tilgungsaussetzung zusätzliche Bauspar-Zeile einbauen
    var hasBspar = (data.bspar || 0) > 0;
    var rows;
    if (hasBspar) {
      rows = [
        ['Warmmiete / Jahr',         pE(data.wm)],
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
        ['Warmmiete / Jahr',         pE(data.wm)],
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
  var heuteData = { wm: K.nkm_j, bwk: K.bwk_cf, zins: K.zins_j, tilg: K.tilg_j,
                    cf_op: K.cf_op, steuer: K.steuer, cf_ns: K.cf_ns, bspar: _bsparY };
  var ezbData   = { wm: K.nkm_ezb, bwk: K.bwk_cf_ezb, zins: K.zins_ezb, tilg: K.tilg_ezb,
                    cf_op: K.cf_op_ezb, steuer: K.ster_ezb, cf_ns: K.cf_ns_ezb, bspar: _bsparY };
  var anData    = { wm: K.nkm_an, bwk: K.bwk_cf_an, zins: K.zins_an, tilg: K.tilg_an,
                    cf_op: K.cf_op_an, steuer: K.ster_an, cf_ns: K.cf_ns_an, bspar: _bsparY };

  drawCFCard(M,                cy, 'HEUTE (' + new Date().getFullYear() + ')',     C.GREEN,         heuteData);
  drawCFCard(M + cfColW + 4,   cy, 'ENDE ZINSBINDUNG',                              [201,168,76],     ezbData);
  drawCFCard(M + (cfColW+4)*2, cy, 'ANSCHLUSS (' + pP(v('anschl_z'), 1) + ')',     [231,111,81],     anData);

  cy += (_bsparY > 0 ? 110 : 100);

  // V63.52: Annahmen kommen jetzt ganz am Schluss - wir merken sie nur in einer Variable
  var _annahmenRows = [
    ['Mietsteigerung p.a.',           pP(v('mietstg'), 1)],
    ['Kostensteigerung p.a.',         pP(v('kostenstg'), 1)],
    ['Zinsbindung Hauptdarlehen',     g('d1_bindj') + ' Jahre'],
    ['Anschlusszinssatz (Annahme)',   pP(v('anschl_z'), 1)],
    ['Anschluss-Tilgung (Annahme)',   pP(v('anschl_t'), 1)],
    ['Restschuld am Ende Zinsbindung',pE(State.rs)],
    ['Pers\u00f6nlicher Grenzsteuersatz', pP(v('grenz'), 2)]
  ];

  // V63.66: Wert-Anker für Wertsteigerung (svw > bankval > kp) explizit ausweisen
  if (State.wert_basis && State.wert_basis !== v('kp')) {
    var _wbLabel = (v('svwert') > 0)
      ? 'Verkehrswert (§194 BauGB)'
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
    cy = secH(doc, cy, 'Kennzahlen-Vergleich \u00b7 Heute / Ende Zinsbindung / Anschluss', M, CW);
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
      ['Steuern / Jahr', pE(-pt.now.ster, true), pE(-pt.ezb.ster, true), pE(-pt.an.ster, true)],
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
      head: [['Kennzahl', 'Heute', 'Ende Zinsbindung', 'Anschluss']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 9, fontStyle: 'bold' },
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
          // LTV: > 100 rot, > 85 gold, sonst grün
          if (label === 'LTV') {
            var lv = parseFloat(txt.replace('%', '').replace(',', '.'));
            if (!isNaN(lv)) {
              if (lv > 100) data.cell.styles.textColor = [184, 98, 92];
              else if (lv > 85) data.cell.styles.textColor = [184, 151, 64];
              else data.cell.styles.textColor = [63, 165, 108];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // DSCR: < 1,0 rot, 1,0-1,2 gold, >= 1,2 grün
          if (label === 'DSCR') {
            var dv = parseFloat(txt.replace(',', '.'));
            if (!isNaN(dv)) {
              if (dv < 1.0) data.cell.styles.textColor = [184, 98, 92];
              else if (dv < 1.2) data.cell.styles.textColor = [184, 151, 64];
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
        ['Monatliche Rate',          _zT('zaer-rate-now'),  _zT('zaer-rate-ezb'),  _zT('zaer-rate-an')],
        ['CF/Mon (vor Steuer)',      _zT('zaer-cfvst-now'), _zT('zaer-cfvst-ezb'), _zT('zaer-cfvst-an')],
        ['CF/Mon (nach Steuer)',     _zT('zaer-cf-now'),    _zT('zaer-cf-ezb'),    _zT('zaer-cf-an')],
        ['DSCR',                     _zT('zaer-dscr-now'),  _zT('zaer-dscr-ezb'),  _zT('zaer-dscr-an')],
        ['Differenz Rate ggü. Heute', '-',                   _zT('zaer-drate-ezb'), _zT('zaer-drate-an')]
      ];
      doc.autoTable({
        startY: cy,
        head: [['Kennzahl', 'Heute', 'Ende Zinsbindung', 'Anschluss']],
        body: zaerRows,
        theme: 'striped',
        headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 9, fontStyle: 'bold' },
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
                if (dv < 1.0) data.cell.styles.textColor = [184, 98, 92];
                else if (dv < 1.2) data.cell.styles.textColor = [184, 151, 64];
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
    'Mietstg. ' + pP(v('mietstg'), 1) + '  \u00b7  Wertstg. ' + pP(v('wertstg'), 1) +
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
      'NKM/Mon',
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
        textColor: [201, 168, 76],
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
            if (lv > 100) d.cell.styles.textColor = [184, 98, 92];
            else if (lv > 85) d.cell.styles.textColor = [184, 151, 64];
            else d.cell.styles.textColor = [63, 165, 108];
            d.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: _tblM, right: _tblM }
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
    doc.text('CF v.St./J = NKM - Bewirt. n.uml. - Zinsen - Tilgung (was wirklich am Konto bleibt, vor Steuer)  \u00b7  CF n.St./J = NKM - Bewirt. n.uml. - Zinsen +/- Steuer (operativ, ohne Tilgung)', _tblM, cy);
    cy += 3.5;
    doc.text('LTV-F\u00e4rbung: gr\u00fcn unter 85 %  \u00b7  gold 85-100 %  \u00b7  rot \u00fcber 100 %  \u00b7  Anschluss-Konditionen ab Jahr ' + g('d1_bindj') + ': ' + pP(v('anschl_z'), 1) + ' / ' + pP(v('anschl_t'), 1), _tblM, cy);
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

    var eyebrow = (card.querySelector('.bc-head-eyebrow') || {}).textContent || '';
    var title = (card.querySelector('.bc-head-title') || {}).textContent || '';
    var sub = (card.querySelector('.bc-head-sub') || {}).textContent || '';
    var headlineKpi = (card.querySelector('.bc-headline-kpi') || {}).textContent || '';
    var headlineKpiLabel = (card.querySelector('.bc-headline-kpi-label') || {}).textContent || '';
    var footerCells = Array.prototype.slice.call(card.querySelectorAll('.bc-footer-cell'));
    var footer = footerCells.map(function(cell) {
      return {
        label: ((cell.querySelector('.bc-footer-label') || {}).textContent || '').trim(),
        value: ((cell.querySelector('.bc-footer-value') || {}).textContent || '').trim(),
        sub:   ((cell.querySelector('.bc-footer-sub')   || {}).textContent || '').trim()
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
        doc.setTextColor(166, 138, 54);
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
      doc.setDrawColor(220, 200, 130);
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
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor(166, 138, 54);
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
        doc.setDrawColor(220, 200, 130);
        doc.setFillColor(248, 246, 241);
        doc.setLineWidth(0.3);
        doc.rect(fX, fY, fW, fH, 'FD');
        doc.setFillColor(201, 168, 76);
        doc.rect(fX, fY, fW, 0.8, 'F'); // Top-Streifen
        // Label — V63.90: kleinere Schrift bei 5 Boxen damit nichts überlappt
        doc.setFont('helvetica', 'bold'); doc.setFontSize(nF >= 5 ? 6.4 : 7);
        doc.setTextColor(166, 138, 54);
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
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor(166, 138, 54);
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
      var label = (z > 0 ? '+' : '') + z.toFixed(1) + ' pp';
      doc.text(label, matX - 2, matY + i * cellH + cellH / 2 + 1, { align: 'right' });
    });

    // Matrix-Zellen
    matrix.forEach(function(row, rIdx) {
      row.forEach(function(d, cIdx) {
        var x = matX + cIdx * cellW;
        var y = matY + rIdx * cellH;
        // Farbe basierend auf DSCR
        var fill;
        if (d >= 1.2)      fill = [232, 246, 237]; // grün hell
        else if (d >= 1.0) fill = [248, 240, 210]; // gold hell
        else if (d >= 0.8) fill = [248, 220, 185]; // orange hell
        else               fill = [248, 220, 215]; // rot hell

        var border;
        if (d >= 1.2)      border = [63, 165, 108];
        else if (d >= 1.0) border = [201, 168, 76];
        else if (d >= 0.8) border = [220, 130, 80];
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
    var legends = [
      { color: [63, 165, 108],  bg: [232, 246, 237], label: 'DSCR >= 1,2 (gut)' },
      { color: [201, 168, 76],  bg: [248, 240, 210], label: 'DSCR 1,0-1,2 (knapp)' },
      { color: [220, 130, 80],  bg: [248, 220, 185], label: 'DSCR 0,8-1,0 (warn)' },
      { color: [184, 98, 92],   bg: [248, 220, 215], label: 'DSCR < 0,8 (Stress)' }
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
      doc.setTextColor(166, 138, 54);
      doc.text(dom.eyebrow.toUpperCase(), M, cy);
      cy += 5;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.setTextColor(166, 138, 54);
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
    doc.setDrawColor(220, 200, 130);
    doc.setLineWidth(0.3);
    doc.line(M, cy, M + CW, cy);
    cy += 8;

    if (!data || !data.dscrArr || !data.ltvArr) {
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'F');
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, cy, CW, 26, 2, 2, 'D');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor(166, 138, 54);
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
      if (kind === 'dscr') {
        if (value >= 1.2) return { label: 'SOLIDE',  rgb: [63, 165, 108] };
        if (value >= 1.0) return { label: 'KNAPP',   rgb: [201, 168, 76] };
        return                  { label: 'KRITISCH', rgb: [184, 98, 92] };
      } else {
        if (value < 85)  return { label: 'SOLIDE',  rgb: [63, 165, 108] };
        if (value <= 100) return { label: 'GRENZ',   rgb: [201, 168, 76] };
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
      doc.setTextColor(166, 138, 54);
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
        { value: 85,  label: '85%' },
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
    function _dscrColor(v) {
      if (v >= 1.2) return [63, 165, 108];
      if (v >= 1.0) return [201, 168, 76];
      return [184, 98, 92];
    }
    function _ltvColor(v) {
      if (v < 60) return [63, 165, 108];
      if (v <= 85) return [63, 165, 108];
      if (v <= 100) return [201, 168, 76];
      return [184, 98, 92];
    }
    var bindIdx = data.bindj || 10;
    var ezbYearLabel = 'Jahr ' + bindIdx;
    var endYearLabel = 'Jahr ' + (data.years.length || 10);

    _kpiCell(M, kpiY,                'DSCR · Heute', data.dscrToday.toFixed(2).replace('.', ','), 'Schuldendeckung', _dscrColor(data.dscrToday));
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
        doc.setDrawColor(201, 168, 76);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1.5], 0);
        doc.line(ex, y, ex, y + h);
        doc.setLineDashPattern([], 0);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor(166, 138, 54);
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
        { value: 1.2, color: [63, 165, 108], label: '>= 1,2 (gut)' },
        { value: 1.0, color: [201, 168, 76], label: '1,0 (knapp)' }
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
        { value: 85, color: [201, 168, 76], label: '85 %' },
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
      doc.setTextColor(166, 138, 54);
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
      var sLines = doc.splitTextToSize(equityData.sub, CW);
      doc.text(sLines[0] || '', M, cy);
      cy += 4;
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
        doc.setDrawColor(201, 168, 76);
        doc.setFillColor(252, 248, 233);  // V191: leichtes gold-Tönung statt cream
        doc.setLineWidth(0.5);
        doc.rect(fX, fY, fW, fH, 'FD');
        // Gold-Akzentstrich oben
        doc.setFillColor(201, 168, 76);
        doc.rect(fX, fY, fW, 1.2, 'F');  // V191: 0.7 → 1.2 (deutlicher sichtbar)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor(166, 138, 54);
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
    doc.setDrawColor(220, 200, 130);
    doc.setLineWidth(0.25);
    doc.line(M, cy, M + CW, cy);
    cy += 9;  // V63.94: 4 → 9 (Marcels Wunsch: 2 Zeilen mehr Luft nach der Trennlinie)

    if (waterfallData && waterfallData.eyebrow) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.setTextColor(166, 138, 54);
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
      var wfSLines = doc.splitTextToSize(waterfallData.sub, CW);
      doc.text(wfSLines[0] || '', M, cy);
      cy += 4;
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
      var wffH = 13;
      var wffY = cy;
      waterfallData.footer.slice(0, wfnF).forEach(function(cell, i) {
        var wffX = M + i * (wffW + 3);
        doc.setDrawColor(220, 200, 130);
        doc.setFillColor(248, 246, 241);
        doc.setLineWidth(0.3);
        doc.rect(wffX, wffY, wffW, wffH, 'FD');
        doc.setFillColor(201, 168, 76);
        doc.rect(wffX, wffY, wffW, 0.7, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor(166, 138, 54);
        var lbl = doc.splitTextToSize(cell.label.toUpperCase(), wffW - 4);
        doc.text(lbl[0] || '', wffX + 2.5, wffY + 3.3);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.setTextColor(42, 39, 39);
        doc.text(cell.value, wffX + 2.5, wffY + 7.8);
        if (cell.sub) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
          doc.setTextColor(120, 115, 110);
          var sub = doc.splitTextToSize(cell.sub, wffW - 4);
          doc.text(sub[0] || '', wffX + 2.5, wffY + 11);
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
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, cy, CW, 36, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(166, 138, 54);
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
      var btjY = parseInt(g('btj') || '15');
      var _vz = State._vz || {};
      var cumT = _vz.tilg_durch_einnahmen || 0;
      var cumC = _vz.cf_ueberschuss_konto || 0;
      var stv  = _vz.steuervorteil || 0;
      var wzg  = _vz.wertsteig_kum || 0;
      var ges  = _vz.verm_zuwachs || (cumT + cumC + stv + wzg);

      cy = secH(doc, cy, 'Verm\u00f6genszuwachs (' + btjY + ' Jahre)', M, CW);
      kvT(doc, M, cy, CW, [
        ['1. Tilgung-vom-Mieter (Schulden abgebaut durch Miete)',           pE(cumT)],
        ['2. Cashflow-\u00dcberschuss (Konto-Reserve, n. Tilgung+Steuer)', pE(cumC)],
        ['3. Steuervorteil (kumulierte Erstattung aus V+V-Verlusten)',     pE(stv)],
        ['4. Wertsteigerung ' + pP(v('wertstg'), 1) + ' p.a.',              pE(wzg)],
        ['= GESAMT Verm\u00f6genszuwachs (1+2+3+4)',                       pE(ges, true)]
      ], [4]);
      cy += 5 * 5.8 + 5;  // V63.98: war +6, etwas kompakter
    }

    if (!_vzCapture) {
      var lastRow = State.cfRows[State.cfRows.length - 1];
      var btjY = parseInt(g('btj') || '15');
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
      var nkmHeute = ((K.nkm_m || 0) + (K.ze_m || 0)) * 12;
      var statisch = nkmHeute * btjY;
      var _cumTaxDisplay = -cumTax;
      var _vzData = (window.State && window.State._vz) || {};
      var _cfKontoSoll = _vzData.cf_ueberschuss_konto != null ? _vzData.cf_ueberschuss_konto : (cumNkm - cumBwk - cumZins - cumTilg - cumBspar + _cumTaxDisplay);
      var _rows = [
        ['Kumulierte Mieteinnahmen (mit ' + mstgPct.toFixed(1).replace('.', ',') + ' % p.a. Mietsteigerung)', pE(cumNkm)],
        ['  davon statisch (NKM heute \u00d7 Jahre)', pE(statisch)],
        ['  Effekt der Mietsteigerung', '+' + pE(cumNkm - statisch)],
        ['- Bewirtschaftung n.uml. (mit ' + kstgPct.toFixed(1).replace('.', ',') + ' % p.a.)', '-' + pE(cumBwk)],
        ['- Zinsen (\u00fcber die Laufzeit)', '-' + pE(cumZins)],
        ['- Tilgung (\u00fcber die Laufzeit)', '-' + pE(cumTilg)]
      ];
      if (cumBspar > 0) _rows.push(['- Bausparrate (kumuliert, gebunden)', '-' + pE(cumBspar)]);
      _rows.push(['\u00b1 Steuern (kumuliert)', pE(_cumTaxDisplay, true)]);
      _rows.push(['= Kumulierter CF-\u00dcberschuss (Konto-Reserve, n. Tilgung+Steuer)', pE(_cfKontoSoll, true)]);
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
     SEITE 5: KI-INVESTMENT-ANALYSE (optional)
  ══════════════════════════════════════════════════ */
  // Check if user wants KI in PDF
  var aiInPdf = document.getElementById('ai-in-pdf');
  // V27: includeAi gilt auch wenn nur das neue JSON-Format (_aiAnalysis) vorliegt
  var includeAi = (!aiInPdf || aiInPdf.checked) && (window._aiText || window._aiAnalysis);
  if (includeAi) {
  cy = newPage('KI-Investment-Analyse');

  // Header-Banner
  doc.setFillColor.apply(doc, C.CH); doc.roundedRect(M, cy, CW, 13, 2, 2, 'F');
  doc.setFillColor.apply(doc, C.GOLD); doc.rect(M, cy, CW, 1.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.setTextColor.apply(doc, C.GOLD);
  doc.text('KI-INVESTMENT-ANALYSE', M + 5, cy + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.setTextColor(140, 130, 110);
  (function(){var b=_getBranding();doc.text('KI-Analyse via DealPilot \u00b7 ' + (b.company || 'DealPilot'), W - M, cy + 9, { align: 'right' });})();
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
      var lines = doc.splitTextToSize(body, maxWidthForText);

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
        doc.text(line, M + leftPad, textY);
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
          doc.text(line, M + 14, textY);
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
    ['Mietsteigerung p.a.',            pP(v('mietstg'), 1), 'Annahme', 'Erfahrungswert'],
    ['Wertsteigerung p.a.',             pP(v('wertstg'), 1), 'Annahme', 'Konservativ B-/C-Stadt'],
    ['Kostensteigerung p.a.',           pP(v('kostenstg'), 1),'Annahme', 'Orientiert an Inflationsrate'],
    ['Leerstand p.a.',                  pP(v('leerstand'), 1),'Annahme', 'Vollvermietung angenommen'],
    ['Anschlusszinssatz',               pP(v('anschl_z'), 1), 'Annahme', 'Konservativer Puffer \u00fcber aktuellem Niveau'],
    ['Anschluss-Tilgung',               pP(v('anschl_t'), 1), 'Annahme', 'Markt\u00fcblicher Satz'],
    ['Exit-Rendite (Verkaufsszenario)', pP(v('exit_bmy'), 1), 'Annahme', 'Markt\u00fcblich f\u00fcr Standort'],
    ['Betrachtungszeitraum',            g('btj') + ' Jahre',  'Festwert', '-'],
    ['Grunderwerbsteuer NRW',           '6,50 %',              'Gesetz',   'GrEStG \u00a7 11 NRW'],
    ['AfA-Satz Geb\u00e4ude',          '2,00 % p.a.',         'Gesetz',   '\u00a7 7 EStG (ab Baujahr 1925)'],
    ['Geb\u00e4udeanteil am KP',       pP(v('geb_ant'), 0),   'Sch\u00e4tzwert', 'steuerliche Grundlage \u00a7 7 EStG'],
    ['Pers\u00f6nl. Grenzsteuersatz',   pP(v('grenz'), 2),    'Eingabe',  'Aus Steuer-Modul']
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
  doc.text(doc.splitTextToSize(disc, CW - 10), M + 5, cy + 13);
  cy += 30;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, C.MID);
  doc.text(
    'Erstellt: ' + new Date().toLocaleDateString('de-DE') + ' ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) +
    '  \u00b7  DealPilot' + (_getBranding().company && _getBranding().company !== 'DealPilot' ? ' \u00b7 ' + _getBranding().company : '') + (_getBranding().website ? '  \u00b7  ' + _getBranding().website : ''),
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
