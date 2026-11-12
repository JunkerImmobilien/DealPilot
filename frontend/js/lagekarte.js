/* ═══════════════════════════════════════════════════════════════════════
   lagekarte.js · v3336 — Lagekarte mit Punkt statt leerem Bildplatz im PDF

   Marcel 12.11.2026: „Wenn wir kein Bild haben im Investment-PDF, koennte man
   auch ein Geo-Bild reinladen mit Punkt von OpenStreetMap."

   Hat ein Objekt kein Foto, setzen die PDFs (dp-dokumente.js Deckblatt,
   pdf.js Deckblatt, pdf-investment-bank.js Titelbild) diesen Kartenausschnitt
   ein: OpenStreetMap-Kacheln (Zoom 16), in der Mitte ein Punkt in der
   Markenfarbe, unten rechts „© OpenStreetMap-Mitwirkende" (ODbL, Pflicht).

   - Kacheln kommen NUR ueber das eigene Backend
     (GET /api/v1/lagekarte/kachel/z/x/y.png, services/osmKacheln.js): dort
     zwischengespeichert, mit eigenem User-Agent und Ratenbremse - der Browser
     ruft tile.openstreetmap.org nie selbst ab. Kosten 0 EUR.
   - Koordinaten: das Objekt fuehrt keine. Sie kommen aus dem Geocoder des
     Marktberichts (/marktbericht/geocode, in der Datenbank zwischengespeichert)
     - derselbe Weg, den die Adresssuche und der Marktbericht schon gehen. An
     den Kachelserver geht nur die Kachelnummer, nie Adresse oder Koordinate.
   - Ohne Koordinaten oder wenn eine Kachel fehlt: null - das PDF bleibt, wie
     es vorher war. Nie eine halbe Karte.
   - Farbe: var() greift auf der Leinwand nicht (CLAUDE.md) - das Gold wird wie
     in brw-karte.js ueber ein Messelement mit dem Whitelabel-Token gelesen.
   ═══════════════════════════════════════════════════════════════════════ */
(function (wurzel) {
  'use strict';

  var KACHEL = 256;
  var ZOOM = 16;
  var VERMERK = '© OpenStreetMap-Mitwirkende';

  /* Web-Mercator: Weltpixel bei Zoom z (Kachelgroesse 256) */
  function welt(lat, lon, z) {
    var n = KACHEL * Math.pow(2, z);
    var s = Math.sin(lat * Math.PI / 180);
    s = Math.min(Math.max(s, -0.9999), 0.9999);
    return { x: (lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
  }

  function koordOk(lat, lon) {
    if (lat === null || lon === null || lat === undefined || lon === undefined || lat === '' || lon === '') return false;
    lat = Number(lat); lon = Number(lon);
    if (!isFinite(lat) || !isFinite(lon)) return false;
    if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return false;
    if (lat === 0 && lon === 0) return false;   /* Nullinsel = kein Treffer */
    return true;
  }

  /* Welche Kacheln braucht ein Ausschnitt b x h (Pixel) um lat/lon, und wohin kommen sie? */
  function plan(lat, lon, b, h, z) {
    z = z || ZOOM;
    var m = welt(Number(lat), Number(lon), z);
    var x0 = m.x - b / 2, y0 = m.y - h / 2;
    var tx0 = Math.floor(x0 / KACHEL), ty0 = Math.floor(y0 / KACHEL);
    var tx1 = Math.floor((x0 + b - 1) / KACHEL), ty1 = Math.floor((y0 + h - 1) / KACHEL);
    var n = Math.pow(2, z), liste = [];
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (ty < 0 || ty >= n) continue;
        liste.push({ z: z, x: ((tx % n) + n) % n, y: ty, dx: tx * KACHEL - x0, dy: ty * KACHEL - y0 });
      }
    }
    return { z: z, mitte: { x: b / 2, y: h / 2 }, liste: liste };
  }

  function gold() {
    try {
      var m = document.createElement('span'); m.style.color = 'var(--wl-c9a84c, #C9A84C)'; m.style.display = 'none';
      document.body.appendChild(m); var c = getComputedStyle(m).color; m.remove(); return c || 'goldenrod';
    } catch (e) { return 'goldenrod'; }
  }

  function basis() {
    try { if (typeof getApiBase === 'function') return getApiBase(); } catch (e) {}
    return '/api/v1';
  }
  function kachelLaden(k) {
    var t = ''; try { t = localStorage.getItem('ji_token') || ''; } catch (e) {}
    return fetch(basis() + '/lagekarte/kachel/' + k.z + '/' + k.x + '/' + k.y + '.png', { headers: t ? { Authorization: 'Bearer ' + t } : {} })
      .then(function (r) { return r.ok && /image\/png/.test(r.headers.get('content-type') || '') ? r.blob() : null; })
      .then(function (bl) {
        if (!bl) return null;
        return new Promise(function (ok) {
          var u = URL.createObjectURL(bl), i = new Image();
          i.onload = function () { ok(i); setTimeout(function () { URL.revokeObjectURL(u); }, 0); };
          i.onerror = function () { URL.revokeObjectURL(u); ok(null); };
          i.src = u;
        });
      }).catch(function () { return null; });
  }

  /**
   * Kartenausschnitt als JPEG-Data-URL.
   * o.breite/o.hoehe in Kartenpixeln (Zoom 16), o.schaerfe = Leinwandfaktor fuer Punkt und Schrift (Standard 2).
   * Ergebnis { src, w, h, ratio, vermerk, quelle:'osm' } oder null.
   */
  function bild(lat, lon, o) {
    o = o || {};
    if (!koordOk(lat, lon)) return Promise.resolve(null);
    var b = Math.max(200, Math.min(1200, Math.round(o.breite || 640)));
    var h = Math.max(120, Math.min(900, Math.round(o.hoehe || 360)));
    var f = o.schaerfe || 2;
    var p = plan(lat, lon, b, h, o.zoom || ZOOM);
    if (!p.liste.length || p.liste.length > 24) return Promise.resolve(null);
    return Promise.all(p.liste.map(kachelLaden)).then(function (bilder) {
      if (bilder.some(function (x) { return !x; })) return null;   /* nie eine halbe Karte */
      var c = document.createElement('canvas'); c.width = b * f; c.height = h * f;
      var ctx = c.getContext('2d');
      ctx.scale(f, f);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#f2efe9'; ctx.fillRect(0, 0, b, h);
      p.liste.forEach(function (k, i) { ctx.drawImage(bilder[i], k.dx, k.dy, KACHEL, KACHEL); });
      /* Punkt: Schein, weisser Ring, Kern in Markenfarbe */
      var g = gold(), mx = p.mitte.x, my = p.mitte.y;
      ctx.save();
      ctx.globalAlpha = 0.22; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(mx, my, 10.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      /* Namensnennung (ODbL) unten rechts */
      ctx.font = '10px Inter, Helvetica, Arial, sans-serif';
      var tw = ctx.measureText(VERMERK).width;
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fillRect(b - tw - 10, h - 15, tw + 10, 15);
      ctx.fillStyle = '#333333'; ctx.textBaseline = 'middle'; ctx.fillText(VERMERK, b - tw - 5, h - 7.5);
      var src; try { src = c.toDataURL('image/jpeg', 0.86); } catch (e) { return null; }
      return { src: src, w: c.width, h: c.height, ratio: b / h, vermerk: VERMERK, quelle: 'osm' };
    }).catch(function () { return null; });
  }

  /* Koordinaten zur Anschrift (gecachter Geocoder des Marktberichts), je Anschrift einmal je Sitzung */
  var _geo = {};
  function koordinaten(adresse) {
    adresse = String(adresse || '').trim();
    if (!adresse || !/\d/.test(adresse)) return Promise.resolve(null);   /* ohne Hausnummer/PLZ kein verlaesslicher Punkt */
    if (_geo[adresse] !== undefined) return Promise.resolve(_geo[adresse]);
    if (!wurzel.Auth || typeof wurzel.Auth.apiCall !== 'function') return Promise.resolve(null);
    return wurzel.Auth.apiCall('/marktbericht/geocode?address=' + encodeURIComponent(adresse)).then(function (g) {
      var k = g && koordOk(g.lat, g.lon) ? { lat: Number(g.lat), lon: Number(g.lon) } : null;
      _geo[adresse] = k; return k;
    }).catch(function () { return null; });
  }
  function adresseAusFeldern() {
    var v = function (id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
    var str = [v('str'), v('hnr')].filter(Boolean).join(' '), ort = [v('plz'), v('ort')].filter(Boolean).join(' ');
    return [str, ort].filter(Boolean).join(', ');
  }
  /** Lagekarte zur Anschrift (Standard: die Felder des offenen Objekts) oder null */
  function fuerAdresse(adresse, o) {
    return koordinaten(adresse === undefined ? adresseAusFeldern() : adresse).then(function (k) {
      return k ? bild(k.lat, k.lon, o) : null;
    });
  }

  var api = { welt: welt, plan: plan, koordOk: koordOk, bild: bild, koordinaten: koordinaten, fuerAdresse: fuerAdresse, VERMERK: VERMERK, ZOOM: ZOOM, KACHEL: KACHEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (wurzel && wurzel.document) wurzel.DpLagekarte = api;
})(typeof window !== 'undefined' ? window : this);
