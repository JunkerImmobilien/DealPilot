'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   brw-karte.js — v3237 · Bodenrichtwert-Karte im Reiter Objekt

   Marcel am 09.11.2026: „Bei Bodenrichtwert könnte noch die Karte
   abgerufen werden mit den Bodenrichtwerten der anderen Gebiete mit den
   roten Linien. Also ein Button mit Karte oder so."

   NICHTS NEU ERFUNDEN — erst gesucht (Regel „Erst suchen, dann bauen"):
     · der Dienst: der bundesweite WMS der Gutachterausschüsse
       (https://www.wms.nrw.de/boris/wms_de_bodenrichtwerte), derselbe wie
       in der Web-Ansicht des Marktberichts (marktbericht-app/app.js, v3209)
       und auf der Nahkarte des Profi-PDFs (marktbericht-profi.js, v3210).
       Er antwortet mit CORS; Bayern und Schleswig-Holstein sind dort NICHT
       enthalten — dort zeigt das Fenster den Link zum Landesportal.
     · Leaflet 1.9.4 aus dem eigenen Spiegel /vendor/cdn/leaflet/1.9.4/
       (wie marktbericht-app/angebot.html), erst beim ersten Öffnen geladen.
     · Kacheln: OSM-Standard ohne Schlüssel und ohne {s}/{r} (Begründung
       in marktbericht-app/app.js beim Kartenaufbau).
     · Geokodierung: /marktbericht/geocode, derselbe Weg wie
       DealPilotBrw.borisHolen (mit Hausnummer, PLZ-Gegenprüfung v2374).
     · Landesportal: DealPilotBrw.openBoris() und dessen Liste.

   Ein Klick in die Karte fragt GetFeatureInfo desselben Dienstes und
   zeigt Bodenrichtwert, Stichtag, Nutzung und Zone. Der Vermerk
   dl-de/by-2-0 steht in der Attribution (Pflicht der Lizenz).
   Nach aussen nur amtliche Portale — keine Anbieter (CLAUDE.md).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var LEAFLET = '/vendor/cdn/leaflet/1.9.4/';
  var BRW_WMS = 'https://www.wms.nrw.de/boris/wms_de_bodenrichtwerte';
  var BRW_LAYER = 'brw_wohnbauflaeche,brw_gemischte_bauweise,brw_gewerbliche_bauweise,brw_sonderbauflaeche';
  var BRW_NUTZUNG = { brw_wohnbauflaeche: 'Wohnbaufläche', brw_gemischte_bauweise: 'gemischte Baufläche',
    brw_gewerbliche_bauweise: 'gewerbliche Baufläche', brw_sonderbauflaeche: 'Sonderbaufläche' };
  var VERMERK = '© Gutachterausschüsse für Grundstückswerte, dl-de/by-2-0 (bodenrichtwerte-boris.de)';
  var OHNE_ZONEN = { BY: 1, SH: 1 };   /* im bundesweiten Dienst nicht enthalten (gemessen v3209) */
  var LAND_AUS_NAME = { 'Baden-Württemberg': 'BW', 'Bayern': 'BY', 'Berlin': 'BE', 'Brandenburg': 'BB', 'Bremen': 'HB',
    'Hamburg': 'HH', 'Hessen': 'HE', 'Mecklenburg-Vorpommern': 'MV', 'Niedersachsen': 'NI', 'Nordrhein-Westfalen': 'NRW',
    'Rheinland-Pfalz': 'RP', 'Saarland': 'SL', 'Sachsen': 'SN', 'Sachsen-Anhalt': 'ST', 'Schleswig-Holstein': 'SH', 'Thüringen': 'TH' };

  var $ = function (id) { return document.getElementById(id); };
  var _v = function (id) { var e = $(id); return e ? String(e.value || '').trim() : ''; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* var() greift in Leaflet nicht - v3241: Farbe ueber ein Messelement mit dem Whitelabel-Token auslesen (gold-audit) */
  var gold = function () {
    try {
      var m = document.createElement('span'); m.style.color = 'var(--wl-c9a84c, #C9A84C)'; m.style.display = 'none';
      document.body.appendChild(m); var c = getComputedStyle(m).color; m.remove(); return c;
    } catch (e) { return 'goldenrod'; }
  };

  var _leaflet = null;
  function leafletLaden() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (_leaflet) return _leaflet;
    _leaflet = new Promise(function (ok, nein) {
      if (!document.querySelector('link[data-brw-leaflet]')) {
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAFLET + 'leaflet.css'; l.setAttribute('data-brw-leaflet', '1');
        document.head.appendChild(l);
      }
      var s = document.createElement('script'); s.src = LEAFLET + 'leaflet.js';
      s.onload = function () { window.L ? ok(window.L) : nein(new Error('Leaflet fehlt')); };
      s.onerror = function () { _leaflet = null; nein(new Error('Leaflet nicht ladbar')); };
      document.head.appendChild(s);
    });
    return _leaflet;
  }

  function apiBase() {
    try { if (window.Auth && typeof Auth.getApiBase === 'function') return Auth.getApiBase(); } catch (e) {}
    var m = document.querySelector('meta[name="ji-api-base"]'); return m ? m.content : '/api/v1';
  }
  async function geokodieren() {
    var plz = _v('plz'), ort = _v('ort'), str = _v('str'), hnr = _v('hnr');
    if (str && hnr && str.indexOf(hnr) < 0) str = str + ' ' + hnr;
    var addr = [str, (plz + ' ' + ort).trim()].filter(Boolean).join(', ');
    if (!addr) return { fehler: 'Für die Karte braucht es eine Adresse (mindestens PLZ und Ort).' };
    var gd = null;
    try {
      if (window.Auth && typeof Auth.apiCall === 'function') gd = await Auth.apiCall('/marktbericht/geocode?address=' + encodeURIComponent(addr));
      else {
        var t = ''; try { t = localStorage.getItem('ji_token') || ''; } catch (e) {}
        var r = await fetch(apiBase() + '/marktbericht/geocode?address=' + encodeURIComponent(addr), { headers: t ? { Authorization: 'Bearer ' + t } : {} });
        gd = r.ok ? await r.json() : null;
      }
    } catch (e) { gd = null; }
    if (!gd || gd.lat == null || gd.lon == null) return { fehler: 'Die Adresse ließ sich nicht auf der Karte finden.' };
    var gp = gd.components && gd.components.postcode ? String(gd.components.postcode).trim() : '';
    if (gp && /^\d{5}$/.test(plz) && gp !== plz) return { fehler: 'Die Adresse wurde nicht eindeutig gefunden (PLZ ' + gp + ' statt ' + plz + ').' };
    var st = gd.components && gd.components.state;
    return { lat: Number(gd.lat), lon: Number(gd.lon), land: st && LAND_AUS_NAME[st] ? LAND_AUS_NAME[st] : null, adresse: addr };
  }
  function landAusPlz() {
    try {
      var c = window.DealPilotBrw && DealPilotBrw._debug && DealPilotBrw._debug.plzToBundesland(_v('plz'));
      return c && String(c).indexOf('-') < 0 ? String(c) : null;
    } catch (e) { return null; }
  }
  function portal(code) {
    try { var u = window.DealPilotBrw && DealPilotBrw._debug && DealPilotBrw._debug.BORIS_URLS; return code && u && u[code] ? u[code] : null; } catch (e) { return null; }
  }

  /* ── Fenster ─────────────────────────────────────────────────────── */
  var _map = null;
  function schliessen() {
    var o = $('brw-karte-ov'); if (!o) return;
    try { if (_map) _map.remove(); } catch (e) {}
    _map = null;
    o.parentNode.removeChild(o);
    document.removeEventListener('keydown', _esc, true);
  }
  function _esc(e) { if (e.key === 'Escape') { e.stopPropagation(); schliessen(); } }

  function fensterBauen() {
    schliessen();
    var o = document.createElement('div');
    o.id = 'brw-karte-ov'; o.className = 'brw-karte-ov';
    o.innerHTML = '<div class="brw-karte-dlg" role="dialog" aria-modal="true" aria-labelledby="brw-karte-titel">'
      + '<div class="brw-karte-kopf"><span class="brw-karte-titel" id="brw-karte-titel">Bodenrichtwertzonen</span>'
      + '<span class="brw-karte-adr" id="brw-karte-adr"></span>'
      + '<button type="button" class="brw-karte-zu" aria-label="Schließen" title="Schließen (Esc)">×</button></div>'
      + '<div class="brw-karte-hinweis" id="brw-karte-hinweis">Karte wird geladen …</div>'
      + '<div class="brw-karte-map" id="brw-karte-map"></div>'
      + '<div class="brw-karte-fuss"><span id="brw-karte-info">Klick in eine Zone zeigt ihren Bodenrichtwert und Stichtag.</span>'
      + '<button type="button" class="brw-karte-portal" id="brw-karte-portal">Landesportal öffnen</button></div>'
      + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('.brw-karte-zu')) schliessen(); });
    $('brw-karte-portal').addEventListener('click', function () { if (window.DealPilotBrw && DealPilotBrw.openBoris) DealPilotBrw.openBoris(); });
    document.addEventListener('keydown', _esc, true);
    return o;
  }

  function zoneAbfragen(L, map, latlng) {
    var b = map.getBounds(), size = map.getSize();
    var sw = L.CRS.EPSG3857.project(b.getSouthWest()), ne = L.CRS.EPSG3857.project(b.getNorthEast());
    var p = map.latLngToContainerPoint(latlng);
    var url = BRW_WMS + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&STYLES=&CRS=EPSG:3857&INFO_FORMAT=application/geo%2Bjson&FEATURE_COUNT=10'
      + '&LAYERS=' + BRW_LAYER + '&QUERY_LAYERS=' + BRW_LAYER + '&WIDTH=' + size.x + '&HEIGHT=' + size.y
      + '&BBOX=' + [sw.x, sw.y, ne.x, ne.y].map(function (v) { return v.toFixed(2); }).join(',')
      + '&I=' + Math.round(p.x) + '&J=' + Math.round(p.y);
    var pop = L.popup({ maxWidth: 260 }).setLatLng(latlng).setContent('<span class="brw-karte-pop">Zone wird abgefragt …</span>').openOn(map);
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var f = ((j && j.features) || []).filter(function (x) { return x && x.properties && x.properties.Bodenrichtwert != null; });
      if (!f.length) { pop.setContent('<span class="brw-karte-pop">Hier liegt keine Bodenrichtwertzone im bundesweiten Dienst.</span>'); return; }
      /* je Zone der juengste Stichtag (wie marktbericht-profi.js zonenListe) */
      f.sort(function (a, b) { return String(b.properties.Stichtag || '').localeCompare(String(a.properties.Stichtag || '')); });
      var gesehen = {};
      var html = f.filter(function (x) { var k = (x.properties.BodenrichtwertNummer || '') + '|' + (x.layerName || x.id || ''); if (gesehen[k]) return false; gesehen[k] = 1; return true; })
        .slice(0, 3).map(function (x) {
          var q = x.properties, wert = parseFloat(String(q.Bodenrichtwert).replace(',', '.'));
          var nutz = BRW_NUTZUNG[x.layerName] || '';
          return '<div class="brw-karte-pop"><b>' + (isFinite(wert) ? wert.toLocaleString('de-DE') + ' €/m²' : esc(q.Bodenrichtwert)) + '</b>'
            + (q.Stichtag ? ' · Stichtag ' + esc(q.Stichtag) : '')
            + (nutz ? '<br>' + esc(nutz) : '')
            + (q.BodenrichtwertNummer ? '<br>Zone ' + esc(q.BodenrichtwertNummer) : '')
            + (q.ortsteilName || q.Gemeindename ? ' · ' + esc(q.ortsteilName || q.Gemeindename) : '')
            + (q.Geschossflaechenzahl ? '<br>GFZ ' + esc(q.Geschossflaechenzahl) : '') + '</div>';
        }).join('');
      pop.setContent(html);
    }).catch(function () { pop.setContent('<span class="brw-karte-pop">Der Dienst der Gutachterausschüsse antwortet gerade nicht.</span>'); });
  }

  async function oeffnen() {
    fensterBauen();
    var hinweis = $('brw-karte-hinweis'), adrEl = $('brw-karte-adr');
    var geo, L;
    try {
      var erg = await Promise.all([geokodieren(), leafletLaden()]);
      geo = erg[0]; L = erg[1];
    } catch (e) {
      if (hinweis) hinweis.textContent = 'Die Karte ließ sich nicht laden. Das Landesportal zeigt die Zonen ebenfalls.';
      return;
    }
    if (!$('brw-karte-ov')) return;   /* in der Zwischenzeit geschlossen */
    if (geo.fehler) { if (hinweis) hinweis.textContent = geo.fehler; return; }
    if (adrEl) adrEl.textContent = geo.adresse;
    var code = geo.land || landAusPlz();
    var pt = portal(code);
    var pk = $('brw-karte-portal'); if (pk && pt) pk.textContent = 'Landesportal ' + pt.name;
    if (code && OHNE_ZONEN[code]) {
      hinweis.innerHTML = 'Für ' + esc(pt ? pt.name : code) + ' liefert der bundesweite Dienst der Gutachterausschüsse keine Zonen. '
        + 'Die Bodenrichtwerte stehen im Landesportal' + (pt ? ': <a href="' + esc(pt.url) + '" target="_blank" rel="noopener noreferrer">' + esc(pt.name) + '</a>' : '') + '.';
    } else {
      hinweis.textContent = 'Rote Linien: Grenzen der Bodenrichtwertzonen, blaue Zahlen: Bodenrichtwert in €/m² (ab Straßenebene). Gold: das Objekt.'   /* gemessen 09.11.2026 an Herford, Sachsenstr. 18 */;
    }
    var el = $('brw-karte-map'); if (!el) return;
    _map = L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView([geo.lat, geo.lon], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap-Mitwirkende', maxZoom: 19 }).addTo(_map);
    if (!(code && OHNE_ZONEN[code])) {
      L.tileLayer.wms(BRW_WMS, { layers: BRW_LAYER, format: 'image/png', transparent: true, version: '1.3.0', tileSize: 512,
        minZoom: 13, maxZoom: 19, opacity: 0.9, attribution: VERMERK }).addTo(_map);
      _map.on('click', function (e) { zoneAbfragen(L, _map, e.latlng); });
    }
    L.circleMarker([geo.lat, geo.lon], { radius: 8, color: '#fff', weight: 2, fillColor: gold(), fillOpacity: 1 }).addTo(_map)
      .bindTooltip('Objekt', { direction: 'top', offset: [0, -6] });
    setTimeout(function () { try { _map && _map.invalidateSize(); } catch (e) {} }, 120);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-brw-karte]');
    if (b) { e.preventDefault(); e.stopPropagation(); oeffnen(); }
  }, true);

  window.DpBrwKarte = { oeffnen: oeffnen, schliessen: schliessen };
})();
