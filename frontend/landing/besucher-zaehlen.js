/* besucher-zaehlen.js · landing-zaehlen-1 (23.11.2026)
   Marcel 23.11.2026: „wie viel Kunden auf meiner Internetseite gewesen sind und wo sie abgesprungen sind“.
   Gemessen: landing_events hat seit 23.09.2026 keinen Eintrag mehr. Ursache: die neue Startseite (v1594, 24.09.2026)
   hat das Zaehlskript der alten Seite (alt-original.html, v973) nicht uebernommen. Hier dasselbe Skript als eigene
   Datei, geladen von dp2.js auf allen Seiten der Landing. Anonym: kein Cookie, keine IP, keine personenbezogenen Daten,
   die Sitzungskennung lebt nur im Tab (sessionStorage). Endpunkt /api/v1/track (routes/track.js), Caddy leitet ihn auf
   der Landing-Domain ans Backend. */
/* v973-track: anonymes Landing-Tracking - kein Cookie, keine IP, keine PII. session_id verfaellt beim Tab-Schliessen. */
(function () {
  try {
    var EP = '/api/v1/track';
    var sid = sessionStorage.getItem('dp_sid');
    if (!sid) { sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('dp_sid', sid); }
    var q = new URLSearchParams(location.search);
    var dev = (function () { var w = Math.min(screen.width || 9999, window.innerWidth || 9999);
      if (matchMedia && matchMedia('(pointer:coarse)').matches && w < 900) return w < 560 ? 'mobile' : 'tablet'; return 'desktop'; })();
    var ref = (function () { try { var r = document.referrer; if (!r) return 'direct';
      var h = new URL(r).hostname.replace(/^www\./, ''); if (location.hostname && h === location.hostname) return 'direct';
      if (/google|bing|duckduck|ecosia|yahoo/.test(h)) return 'search';
      if (/facebook|instagram|linkedin|twitter|x\.com|t\.co|youtube|tiktok/.test(h)) return 'social'; return h; } catch (e) { return 'direct'; } })();
    var t0 = Date.now(), maxScroll = 0, lastSection = 'hero', sent = {};
    function send(type, extra) { try {
      var body = Object.assign({ session_id: sid, event_type: type, path: location.pathname, referrer: ref, device: dev,
        utm_source: q.get('utm_source'), utm_campaign: q.get('utm_campaign') }, extra || {});
      var s = JSON.stringify(body);
      if (navigator.sendBeacon) navigator.sendBeacon(EP, new Blob([s], { type: 'application/json' }));
      else fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: s, keepalive: true }).catch(function () {});
    } catch (e) {} }
    send('pageview');
    window.addEventListener('scroll', function () {
      var sc = (window.scrollY / ((document.documentElement.scrollHeight - window.innerHeight) || 1)) * 100;
      if (sc > maxScroll) maxScroll = sc;
      [25, 50, 75, 100].forEach(function (m) { if (sc >= m && !sent['s' + m]) { sent['s' + m] = 1; send('scroll', { value: m }); } });
    }, { passive: true });
    try { if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) {
        var id = e.target.id; lastSection = id; if (!sent['sec_' + id]) { sent['sec_' + id] = 1; send('section', { section: id }); } } }); }, { threshold: 0.4 });
      document.querySelectorAll('section[id]').forEach(function (s) { io.observe(s); });
    } } catch (e) {}
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a,button'); if (!a) return;
      var lbl = (a.getAttribute('data-cta') || a.textContent || '').trim().slice(0, 60);
      var href = (a.getAttribute('href') || '');
      if (/mailto:|#pricing|register|anfrage|jetzt|starten|kostenlos|test|tanken/i.test(href + ' ' + lbl)) send('cta', { section: lbl });
    }, true);
    function bye() { if (sent.exit) return; sent.exit = 1; send('exit', { section: lastSection, value: Math.round((Date.now() - t0) / 1000) }); }
    window.addEventListener('pagehide', bye); window.addEventListener('beforeunload', bye);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') bye(); });
  } catch (e) {}
})();
