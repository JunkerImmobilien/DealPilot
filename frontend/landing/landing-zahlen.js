/* ═══════════════════════════════════════════════════════════════════════
   landing-zahlen.js · landing-zahlen-live-1 (Backend v3930)
   — DIE ZAHLEN DER LANDING LIVE AUS DER DATENBANK

   Marcel 20.11.2026: „1 Million amtliche Datenpunkte", die Registerzahlen,
   die Videothek-Zahlen und die Kacheln auf „Wie wir rechnen" sollen sich
   nach der Datenbank aktualisieren.

   Holt GET /api/v1/public/datenumfang vom App-Host (zählt auf den
   Datenbanken des Servers, auf dem er läuft; 6 h im Speicher) und setzt
     data-umfang="…"  aus kopf            (außer data-nutzer: das macht dp2.js
                                            aus /public/stats, dieselbe Zahl)
     data-reg="…"     aus register.kopf
     data-k="…"       aus register.kopf, data-k="stand" = Tag der Messung
   Videos und Stunden (data-umfang="videos" / "video_stunden") zählt das
   Skript selbst aus assets/videothek/videos.json — die Datei liegt auf der
   Landing, nicht in der Datenbank.

   RÜCKFALL: die Zahlen stehen statisch im HTML (tools/datenumfang-messen.mjs).
   Antwortet der Endpunkt nicht, bleibt alles, wie es dasteht.

   „1 MILLION" NUR, WENN DIE MESSUNG DARÜBER LIEGT: liegt sie darunter,
   ersetzt das Skript jedes „über 1 Million" / „über 1,1 Millionen" im
   Seitentext durch die gemessene Rundung (dieselbe Regel wie
   amtlichRund() in backend/src/services/datenumfang.js).

   Gesetzte Elemente tragen data-live="1"; dp2.js und methodik.html
   überschreiben sie danach nicht mehr mit register-stand.js.
   Prüfer: tools/landing-zahlen-pruefen.mjs
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var doc = document;
  if (!doc.querySelector('[data-umfang],[data-reg],[data-k]')) return;

  /* Landing auf dealpilot.immo, API auf app.dealpilot.immo (CORS frei); Staging:
     staging.dealpilot.immo -> app.staging.dealpilot.immo. Wie appApi() in dp2-dealcheck.js. */
  function apiBasis() {
    var h = String(location.hostname || '').replace(/^www\./i, '');
    if (!h || h.indexOf('localhost') >= 0 || h.indexOf('127.0.0.1') === 0) return '/api/v1';
    return location.protocol + '//' + (h.indexOf('app.') === 0 ? h : 'app.' + h) + '/api/v1';
  }
  function zahlText(v) { return typeof v === 'number' ? v.toLocaleString('de-DE') : String(v); }
  function setze(el, v) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return;
    el.setAttribute('data-live', '1');
    if (typeof v === 'number' && el.hasAttribute('data-zaehl') && typeof window.DP2_setzeZahl === 'function' && Math.round(v) === v) {
      window.DP2_setzeZahl(el, v); return;
    }
    el.textContent = zahlText(v);
  }
  function alle(sel, fn) { [].forEach.call(doc.querySelectorAll(sel), fn); }

  /* Regel wie amtlichRund() im Backend */
  function amtlichRund(n) {
    if (n >= 1e6) { var m = Math.floor(n / 1e5) / 10; return 'über ' + m.toLocaleString('de-DE') + (m === 1 ? ' Million' : ' Millionen'); }
    return 'über ' + (Math.floor(n / 1e4) * 1e4).toLocaleString('de-DE');
  }
  /* „über 1 Million", „über 1,1 Millionen" (Million(en)?, nicht Millionen? — das verlangte „Millione") */
  var MILLION = /([Üü])ber 1(,\d+)? Million(en)?/, MILLION_G = /([Üü])ber 1(,\d+)? Million(en)?/g;
  function millionWeg(n) {
    var rund = amtlichRund(n);
    function ersetze(t) { return t.replace(MILLION_G, function (m, u) { return (u === 'Ü' ? 'Ü' : 'ü') + rund.slice(1); }); }
    var w = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */, null, false), knoten;
    while ((knoten = w.nextNode())) { if (MILLION.test(knoten.nodeValue)) knoten.nodeValue = ersetze(knoten.nodeValue); }
    alle('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]', function (m) {
      var c = m.getAttribute('content') || ''; if (MILLION.test(c)) m.setAttribute('content', ersetze(c));
    });
  }

  function anwenden(d) {
    if (!d || !d.ok || !d.kopf || !d.register || !d.register.kopf) return false;
    var K = d.kopf, R = d.register.kopf, gesamt = K.amtlich_gesamt;
    if (typeof gesamt !== 'number' || !isFinite(gesamt)) return false;
    alle('[data-umfang]', function (el) {
      var k = el.getAttribute('data-umfang');
      if (el.hasAttribute('data-nutzer') || k === 'videos' || k === 'video_stunden') return;
      var v = K[k];
      /* Gegenprobe zur Million-Regel: eine Rundung, die nicht zur Summe passt, wird nicht gezeigt */
      if (/^amtlich_rund/.test(k) && (typeof v !== 'string' || /Million/.test(v) !== (gesamt >= 1e6))) return;
      setze(el, v);
    });
    alle('[data-reg]', function (el) { setze(el, R[el.getAttribute('data-reg')]); });
    alle('[data-k]', function (el) {
      var k = el.getAttribute('data-k');
      if (k === 'stand') { if (/^\d{4}-\d\d-\d\d$/.test(d.register.stand || '')) setze(el, d.register.stand.split('-').reverse().join('.')); return; }
      setze(el, R[k]);
    });
    if (gesamt < 1e6) millionWeg(gesamt);
    window.DPS_ZAHLEN_LIVE = d;
    return true;
  }

  function videosAnwenden(v) {
    var liste = v && v.videos;
    if (!liste || !liste.length) return;
    var sek = 0; liste.forEach(function (x) { sek += Number(x.dauer) || 0; });
    /* dieselbe Regel wie tools/datenumfang-messen.mjs: Stunden auf eine Stelle */
    var werte = { videos: liste.length, video_stunden: Math.round(sek / 360) / 10 };
    alle('[data-umfang="videos"],[data-umfang="video_stunden"]', function (el) { setze(el, werte[el.getAttribute('data-umfang')]); });
  }

  function holen(url, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal, credentials: 'omit' } : { credentials: 'omit' })
      .then(function (r) { if (t) clearTimeout(t); return r.ok ? r.json() : null; });
  }

  var fertig = holen(apiBasis() + '/public/datenumfang', 10000).then(anwenden).catch(function () { return false; });
  var vid = doc.querySelector('[data-umfang="videos"],[data-umfang="video_stunden"]')
    ? holen('assets/videothek/videos.json', 10000).then(videosAnwenden).catch(function () {})
    : null;
  window.DPS_ZAHLEN_FERTIG = Promise.all([fertig, vid]);
})();
