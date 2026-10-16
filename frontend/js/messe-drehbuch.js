'use strict';
/* ═══════════════════════════════════════════════════════════════════
   messe-drehbuch.js — v2219 · Selbstlaufende Drehbücher für Messe-Videos

   Marcel, 14.10.2026: „ich brauche Messe-Videos … mach mal so ein Drehbuch
   fertig." Vorschlag (angenommen): kein abgefilmtes Klicken, sondern ein
   Drehbuch IN der App. Es bedient die echte Oberfläche, legt einen Lichtkegel
   auf die Stelle und schreibt eine Untertitelzeile darunter. Aufnehmen mit
   OBS oder Win+Alt+R; am Stand kann es auch live in Schleife laufen.

   Videoreihe (v2253/v2255): boarding-zum-objekt (Modul 02), reihe-datenaufnahme
   (03), reihe-stufen (04), reihe-sprache-stufe2 (05) - Mitschnitte der Module
   03-05 in js/messe-reihe-daten.js.
   Drehbücher: parkstrasse (v2219), immometrica (v2228), sprache (v2231), quickcheck (v2222: Datenaufnahme mit zwei
   PDFs, Marktwertindikation, Spanne, Bewertung, Lage), quickcheck-tippen (v2221)
   Start:  ?messe=parkstrasse            einmal
           ?messe=parkstrasse&schleife   immer wieder (Messebildschirm)
           DealPilotMesse.start('parkstrasse')
   Ende:   Esc oder der ■-Knopf unten rechts.

   REGEL: Jede Zahl im Untertitel wird LIVE aus der App gelesen (Ankauf-Stand,
   Abweichung, Steuerverlauf) - nichts ist abgetippt. Fehlt eine Zahl, fällt der
   Satzteil weg, statt eine erfundene einzusetzen.

   Das Drehbuch ÄNDERT nichts am Objekt: es klickt nur Reiter und den Ist/Soll-
   Umschalter und stellt am Ende „Ist" wieder her.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotMesse) return;
  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GL = 'var(--wl-b8932f, #b8932f)';
  function mix(c, p) { return 'color-mix(in srgb, ' + c + ' ' + p + '%, transparent)'; }
  function de(n, st) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: st || 0, maximumFractionDigits: st || 0 }); }
  function eur(n) { return (n == null || !isFinite(n)) ? null : de(Math.round(n)) + ' €'; }
  function datum(iso) { var t = String(iso || '').split('-'); return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : ''; }
  /* v2233 · TEMPO: Marcel 14.10.2026 - die Kunden muessen Zeit haben zu sehen, was passiert. Steh- und Lesezeiten (ab 600 ms) werden gestreckt; ?tempo=1.6 o. ae. ueberschreibt. Kurze Takte (Tippen, Nachfuehren) bleiben. */
  /* v2234 · Marcel 14.10.2026: der Erklaertext soll nicht immer unten stehen,
     sondern als Karte am Feld, mit Linie und Pfeil dorthin. ?zeile=unten
     holt den alten Untertitel zurueck. */
  var HAFT = (function () { try { return new URLSearchParams(location.search).get('zeile') !== 'unten'; } catch (e) { return true; } })();
  /* v2235 · Studio: läuft die App im Rahmen von messe-studio.html (?studio=1),
     gehen die Zeilen als Kapitel ans Studio (Band unten), Titelkarte und
     Abspann übernimmt das Studio (Intro/Outro aus dem Baukasten). */
  var STUDIO = (function () { try { return new URLSearchParams(location.search).has('studio') && window.parent !== window; } catch (e) { return false; } })();
  /* v2235d · Marcel: „den Pilot musst du ausblenden!" - im Studio ab dem
     ersten Laden, nicht erst ab start() (vorher stand er gemessen links unten) */
  if (STUDIO) { try { document.documentElement.classList.add('dpm-studio', 'dpm-laeuft'); var _ps = document.createElement('style'); _ps.textContent = 'html.dpm-studio #dp-pilot,html.dpm-studio #dp-tower,html.dpm-studio .dp-pilot-fab{display:none!important}html.dpm-studio .sb-user-email,html.dpm-studio .sb-user-name,html.dpm-studio .sb-user-avatar,html.dpm-studio .settings-modal .ms-foot .ml,html.dpm-studio .settings-modal .ms-foot .nm,html.dpm-studio .settings-modal .ms-foot .av{visibility:hidden!important}'; document.head.appendChild(_ps); } catch (e) {} }
  function anStudio(m) { try { m.source = 'dp-messe-studio'; window.parent.postMessage(m, location.origin); } catch (e) {} }
  var TEMPO = (function () { try { var t = parseFloat(new URLSearchParams(location.search).get('tempo')); return (t > 0.3 && t < 4) ? t : 1.4; } catch (e) { return 1.4; } })();
  function warte(ms) { if (ms >= 600) ms = Math.round(ms * TEMPO); return new Promise(function (r, x) { var l = lauf; setTimeout(function () { l === lauf ? r() : x('stopp'); }, ms); }); }
  function q(sel) { return document.querySelector(sel); }
  /* v2219 · nur SICHTBARE Treffer: #ai-content steht zweimal im Dokument, die
     erste Kopie war unsichtbar - der Lichtkegel fiel auf 16 x 16 px zusammen. */
  function qs(sel) { return [].filter.call(document.querySelectorAll(sel), function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })[0] || null; }

  /* ── Bühne: Lichtkegel, Untertitel, Titelkarte ─────────────────── */
  function css() {
    if (q('#dpm-css')) return;
    var st = document.createElement('style'); st.id = 'dpm-css';
    st.textContent = [
      '#dpm-kegel{position:fixed;z-index:10070;pointer-events:none;border-radius:14px;box-shadow:0 0 0 9999px rgba(5,5,5,.58),0 0 0 3px ' + GH + ',0 0 40px 6px ' + mix(GH, 45) + ';transition:all .7s cubic-bezier(.5,0,.2,1);opacity:0}',
      '#dpm-kegel.an{opacity:1}',
      '#dpm-zeile{position:fixed;z-index:10072;left:50%;bottom:34px;transform:translate(-50%,20px);max-width:min(980px,92vw);padding:16px 26px 18px;border-radius:16px;background:rgba(10,9,7,.94);border:1px solid ' + mix(G, 60) + ';box-shadow:0 20px 60px rgba(0,0,0,.6);opacity:0;transition:opacity .4s,transform .4s;text-align:center}',
      '#dpm-zeile.an{opacity:1;transform:translate(-50%,0)}',
      /* v2234 · Karte am Feld */
      '#dpm-zeile.haft{left:0;top:0;bottom:auto;transform:none;max-width:440px;width:max-content;text-align:left;padding:14px 20px 16px;border-color:' + mix(GH, 80) + ';transition:opacity .4s,left .6s cubic-bezier(.5,0,.2,1),top .6s cubic-bezier(.5,0,.2,1)}',
      '#dpm-zeile.haft.an{transform:none}',
      '#dpm-zeile.haft .t{font-size:21px;line-height:1.35}',
      '#dpm-zeile.haft .p{justify-content:flex-start}',
      '#dpm-linie{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:10071;pointer-events:none;opacity:0;transition:opacity .35s;overflow:visible}',
      '#dpm-linie.an{opacity:1}',
      '#dpm-linie line{stroke:' + GH + ';stroke-width:2.5;stroke-linecap:round;filter:drop-shadow(0 0 6px ' + mix(GH, 70) + ')}',
      '#dpm-linie circle{fill:' + GH + '}',
      '#dpm-linie path{fill:' + GH + '}',
      '#dpm-zeile .k{font:600 11px "JetBrains Mono",monospace;letter-spacing:.2em;text-transform:uppercase;color:' + G + '}',
      '#dpm-zeile .t{font:600 26px/1.3 "Space Grotesk",sans-serif;color:#FDFCFA;margin-top:4px}',
      '#dpm-zeile .t b{color:' + GH + '}',
      '#dpm-zeile .p{display:flex;gap:6px;justify-content:center;margin-top:10px}',
      '#dpm-zeile .p i{width:22px;height:3px;border-radius:2px;background:#3a3324}',
      '#dpm-zeile .p i.an{background:' + GH + '}',
      '#dpm-karte{position:fixed;inset:0;z-index:10074;display:grid;place-items:center;text-align:center;background:radial-gradient(120% 80% at 20% 0%,' + mix(GH, 16) + ',transparent 60%),#050505;opacity:0;pointer-events:none;transition:opacity .6s}',
      '#dpm-karte.an{opacity:1;pointer-events:auto}',
      '#dpm-karte .k{font:600 13px "JetBrains Mono",monospace;letter-spacing:.26em;text-transform:uppercase;color:' + G + '}',
      '#dpm-karte h1{font:700 64px/1.05 "Space Grotesk",sans-serif;margin:14px 0 10px;letter-spacing:-.02em;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#dpm-karte p{font:400 20px/1.5 Inter,sans-serif;color:#d9cfb8;margin:0}',
      '#dpm-karte .m{margin-top:34px;font:700 18px "Space Grotesk",sans-serif;color:#FDFCFA}',
      '#dpm-karte .m b{background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      /* v2226 · Abspann: Zeilen nacheinander, dann die Wortmarke groß */
      '@keyframes dpmAuf{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}',
      '@keyframes dpmLogo{0%{opacity:0;transform:scale(.55);filter:blur(10px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:scale(1)}}',
      '@keyframes dpmGlanz{0%{background-position:-160% 0}100%{background-position:260% 0}}',
      '@keyframes dpmBahn{from{width:0}to{width:100%}}',
      '@keyframes dpmKante{from{box-shadow:0 0 0 0 ' + mix(GH, 0) + '}to{box-shadow:0 0 0 2px ' + G + ',0 0 70px 6px ' + mix(GH, 35) + '}}',
      '#dpm-karte .ab{opacity:0;animation:dpmAuf .8s cubic-bezier(.2,.7,.2,1) forwards}',
      '#dpm-karte .ab.z2{animation-delay:.9s}#dpm-karte .ab.z3{animation-delay:1.8s}#dpm-karte .ab.z4{animation-delay:2.7s}',
      '#dpm-logo{display:inline-block;padding:26px 54px 30px;border-radius:28px;background:#050505;opacity:0;animation:dpmLogo 1.3s cubic-bezier(.2,.7,.2,1) forwards,dpmKante 1.2s .9s forwards}',
      '#dpm-logo .w{font:700 132px/1 "Space Grotesk",sans-serif;letter-spacing:-.03em;color:#FDFCFA}',
      '#dpm-logo .w b{font-weight:700;background:linear-gradient(110deg,' + G + ' 0%,' + G + ' 40%,#FFF6D8 50%,' + G + ' 60%,' + G + ' 100%);background-size:260% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:dpmGlanz 2.4s 1.2s ease-in-out 2}',
      '#dpm-bahn{height:3px;margin:22px auto 0;max-width:620px;border-radius:2px;overflow:hidden}',
      '#dpm-bahn i{display:block;height:100%;width:0;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');animation:dpmBahn 1.4s 1.6s cubic-bezier(.6,0,.2,1) forwards}',
      '#dpm-karte .unter{margin-top:20px;font:600 14px "JetBrains Mono",monospace;letter-spacing:.3em;text-transform:uppercase;color:' + G + ';opacity:0;animation:dpmAuf .8s 2.6s forwards}',
      '@media (max-width:640px){#dpm-logo .w{font-size:56px}#dpm-logo{padding:14px 26px 16px}}',
      '#dpm-stopp{position:fixed;z-index:10076;right:14px;bottom:14px;border:1px solid ' + mix(G, 50) + ';background:rgba(10,9,7,.8);color:' + GH + ';border-radius:8px;padding:4px 10px;font:600 12px "JetBrains Mono",monospace;cursor:pointer;opacity:.35}',
      '#dpm-stopp:hover{opacity:1}',
      'html.dpm-studio #dpm-stopp{display:none}',
      /* v2233 · die Pilot-Hilfe stoert im Video - waehrend eines Laufs ausgeblendet */
      'html.dpm-laeuft #dp-pilot,html.dpm-laeuft #dp-tower{display:none!important}',
      /* v2266a · keine Kontaktdaten im Bild: die Konto-Adresse unten in der
         Seitenleiste stand in allen Reihen-Videos bis 11 (gemessen am Bild) */
      /* v2270 · auch der Name (Seitenleiste und Fuss der Einstellungen) */
      'html.dpm-laeuft .sb-user-email,html.dpm-laeuft .sb-user-name,html.dpm-laeuft .sb-user-avatar,html.dpm-laeuft .settings-modal .ms-foot .ml,html.dpm-laeuft .settings-modal .ms-foot .nm,html.dpm-laeuft .settings-modal .ms-foot .av{visibility:hidden!important}',
      '@media (max-width:640px){#dpm-zeile .t{font-size:18px}#dpm-karte h1{font-size:40px}#dpm-karte p{font-size:16px}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function el(id, tag) { var e = document.getElementById(id); if (!e) { e = document.createElement(tag || 'div'); e.id = id; document.body.appendChild(e); } return e; }
  /* v2221 · Ziele im Quick-Check liegen in einem iframe (eigenes Dokument):
     ihr Rechteck ist relativ zum iframe - für den Kegel im Hauptdokument
     wird der Rahmen jeder Ebene dazugerechnet. */
  function rect(e) {
    var r = e.getBoundingClientRect(), x = r.left, y = r.top;
    /* v2235e · nur bis zum EIGENEN Dokument hochrechnen. Im Studio liegt die
       App selbst in einem iframe - gemessen (Marcel: „der nicht ausgegraute
       Bereich ist verschoben") kam dessen Lage im Studio noch einmal dazu. */
    for (var d = e.ownerDocument; d && d !== document; ) {
      var fe = d.defaultView.frameElement; if (!fe) break;
      var fr = fe.getBoundingClientRect(); x += fr.left + fe.clientLeft; y += fr.top + fe.clientTop;
      d = fe.ownerDocument;
    }
    return { left: x, top: y, width: r.width, height: r.height, bottom: y + r.height, right: x + r.width };
  }
  function kegel(ziel, pad) {
    var k = el('dpm-kegel');
    if (!ziel) { k.classList.remove('an'); return; }
    var r = rect(ziel); pad = pad == null ? 10 : pad;
    k.style.left = (r.left - pad) + 'px'; k.style.top = (r.top - pad) + 'px';
    k.style.width = (r.width + pad * 2) + 'px'; k.style.height = (r.height + pad * 2) + 'px';
    k.classList.add('an');
  }
  function zeile(kick, text, i, n) {
    if (STUDIO) { anStudio({ type: 'kapitel', kick: (_aktiv && _aktiv.titel) || 'DealPilot', titel: kick, text: text, i: i, n: n }); return; }
    var z = el('dpm-zeile');
    z.innerHTML = '<div class="k">' + kick + '</div><div class="t">' + text + '</div><div class="p">'
      + Array.apply(null, { length: n }).map(function (_, j) { return '<i class="' + (j <= i ? 'an' : '') + '"></i>'; }).join('') + '</div>';
    z.classList.add('an');
    z.removeAttribute('data-seite');   /* jede neue Zeile waehlt ihre Seite neu */
    platziere();
  }
  function zeileWeg() { var z = q('#dpm-zeile'); if (z) z.classList.remove('an'); linie(null); }
  /* v2234 · die Zeile als Karte neben dem Ziel: rechts, links, darunter oder
     darüber - die erste Seite, auf der sie ganz ins Fenster passt, ohne das
     Ziel zu verdecken. Passt keine, steht sie wie früher unten. Die Linie geht
     von der Kartenkante zur Zielkante, der Pfeil zeigt aufs Ziel. Gerechnet
     wird gegen innerWidth/innerHeight (Zoom 90 %: Bildrahmen ist kleiner). */
  var ABST = 64, RAND = 18;
  function linie(a, b) {
    var sv = q('#dpm-linie');
    if (!a) { if (sv) sv.classList.remove('an'); return; }
    if (!sv) {
      sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.id = 'dpm-linie';
      sv.innerHTML = '<line/><circle r="5"/><path/>'; document.body.appendChild(sv);
    }
    var l = sv.querySelector('line'), c = sv.querySelector('circle'), pf = sv.querySelector('path');
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
    var sx = b.x - ux * 14, sy = b.y - uy * 14;   /* Linie endet am Pfeilfuss */
    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', sx); l.setAttribute('y2', sy);
    c.setAttribute('cx', a.x); c.setAttribute('cy', a.y);
    pf.setAttribute('d', 'M' + b.x + ' ' + b.y + ' L' + (sx - uy * 8) + ' ' + (sy + ux * 8) + ' L' + (sx + uy * 8) + ' ' + (sy - ux * 8) + ' Z');
    sv.classList.add('an');
  }
  function platziere() {
    var z = q('#dpm-zeile'); if (!z || !z.classList.contains('an')) return;
    var t = HAFT && zielEl();
    if (!t) { if (z.classList.contains('haft')) { z.classList.remove('haft'); z.style.left = z.style.top = ''; } linie(null); return; }
    var r = rect(t), pad = _pad, W = innerWidth, H = innerHeight;
    r = { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad };
    var neu = !z.classList.contains('haft');
    z.classList.add('haft');
    var w = z.offsetWidth, h = z.offsetHeight, cy = (r.top + r.bottom) / 2, cx = (r.left + r.right) / 2;
    function klemm(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    var seiten = [
      { x: r.right + ABST, y: klemm(cy - h / 2, RAND, H - h - RAND), ok: r.right + ABST + w <= W - RAND, k: 'l' },
      { x: r.left - ABST - w, y: klemm(cy - h / 2, RAND, H - h - RAND), ok: r.left - ABST - w >= RAND, k: 'r' },
      { x: klemm(cx - w / 2, RAND, W - w - RAND), y: r.bottom + ABST, ok: r.bottom + ABST + h <= H - RAND, k: 'o' },
      { x: klemm(cx - w / 2, RAND, W - w - RAND), y: r.top - ABST - h, ok: r.top - ABST - h >= RAND, k: 'u' }
    ].filter(function (o) { return o.ok; });
    if (!seiten.length) { z.classList.remove('haft'); z.style.left = z.style.top = ''; linie(null); return; }
    /* dieselbe Seite behalten, solange sie passt - sonst springt die Karte */
    var o = seiten.filter(function (x) { return x.k === z.getAttribute('data-seite'); })[0] || seiten[0];
    z.setAttribute('data-seite', o.k);
    /* v2234c · Seitenwechsel: springen statt gleiten - gemessen lief die Karte
       sonst 0,15-0,3 s quer ueber das Feld, das sie erklaert */
    var spring = neu || (_lz && _lz.k !== o.k);
    if (spring) { z.style.transition = 'opacity .4s'; }
    z.style.left = Math.round(o.x) + 'px'; z.style.top = Math.round(o.y) + 'px';
    if (spring) { void z.offsetWidth; z.style.transition = ''; }
    /* v2234b · die Linie wird aus dem AKTUELLEN Kartenrechteck gezogen und
       waehrend des Gleitens (0,6 s) in jedem Bild nachgefuehrt. GEMESSEN: aus
       der Zielposition gerechnet hing sie beim Szenenwechsel lose neben der
       Karte, die noch unterwegs war. */
    _lz = { k: o.k, r: r }; linieNach();
    var bis = Date.now() + 750;
    (function nach() { linieNach(); if (Date.now() < bis) requestAnimationFrame(nach); })();
  }
  var _lz = null;
  function linieNach() {
    var z = q('#dpm-zeile'); if (!_lz || !z || !z.classList.contains('haft')) return;
    var c = z.getBoundingClientRect(), r = _lz.r, k = _lz.k, a, b;
    function klemm(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    var my = c.top + c.height / 2, mx = c.left + c.width / 2;
    if (k === 'l') { a = { x: c.left, y: my }; b = { x: r.right, y: klemm(my, r.top + 8, r.bottom - 8) }; }
    else if (k === 'r') { a = { x: c.right, y: my }; b = { x: r.left, y: klemm(my, r.top + 8, r.bottom - 8) }; }
    else if (k === 'o') { a = { x: mx, y: c.top }; b = { x: klemm(mx, r.left + 8, r.right - 8), y: r.bottom }; }
    else { a = { x: mx, y: c.bottom }; b = { x: klemm(mx, r.left + 8, r.right - 8), y: r.top }; }
    linie(a, b);
  }
  function karte(html) { var k = el('dpm-karte'); if (html == null) { k.classList.remove('an'); return; } k.innerHTML = '<div>' + html + '</div>'; k.classList.add('an'); }
  /* v2219b · Der Kegel FOLGT seinem Ziel: über einen Selektor, alle 200 ms neu
     aufgelöst. GEMESSEN: der Umschalter Ist/Soll baut sich beim Klick neu (der
     alte Knoten ist ausgehängt, Rechteck 0 x 0), und Reiter rendern nach - ein
     einmal gemessenes Rechteck war in vier von fünf Szenen 16 x 16 px. */
  var _ziel = null, _pad = 10, _folge = null;
  function zielEl() {
    if (!_ziel) return null;
    if (typeof _ziel === 'string') return qs(_ziel);
    if (typeof _ziel === 'function') { var f = _ziel(); return (f && f.getBoundingClientRect().width > 0) ? f : null; }
    return (_ziel.isConnected && _ziel.getBoundingClientRect().width > 0) ? _ziel : null;
  }
  /* v2219e/f · Ein Ziel, das nach dem Scrollen noch wächst (Soll/Ist-Kasten: 89 ->
     163 px), kann aus dem freien Bereich rutschen; dann wird nachgescrollt -
     höchstens dreimal je Ziel, frühestens alle 1,2 s, ohne Animation.
     ZURÜCKGENOMMEN: "Unterkante 9 px unter dem Fensterrand" war ein Messfehler -
     CSS-Pixel gegen die Höhe des Bildschirmfotos (726) verglichen; das Fenster
     hat bei 90 % Zoom 987 CSS-px, der Kasten lag frei. Immer innerHeight messen. */
  var _nachScroll = 0, _letzterScroll = 0;
  /* v2235c · im Studio steht die Zeile ausserhalb der App: unten nichts freihalten */
  function unten() { return STUDIO ? 24 : 170; }
  function frei(r) { return r.top >= 70 && r.bottom <= innerHeight - unten(); }
  /* v2219f · scrollIntoView(smooth) kam im Drehbuch gemessen NIE an (Kasten blieb
     bei 572-736 stehen; dieselbe Zeile ohne smooth scrollte sofort). Gescrollt wird
     deshalb der Container selbst (.main-col), mittig in den freien Bereich. */
  function scroller(e) {
    /* v2221 · durch iframes hindurch: das Quick-Check-Dokument scrollt nicht
       selbst (es ist so hoch wie sein Inhalt), gescrollt wird .main-col */
    for (var a = e; a; a = a.ownerDocument === document ? null : a.ownerDocument.defaultView.frameElement) {   /* v2235e: nicht ins Studio hinauf */
      var w = a.ownerDocument.defaultView;
      for (var s = a.parentElement; s && s !== a.ownerDocument.body; s = s.parentElement) {
        /* v2222b · nur SENKRECHTE Scroller: die Spannen-Kacheln liegen in einem
           waagerechten Rollstreifen (overflow-x:auto setzt overflow-y mit) -
           er wurde als Scroller genommen, gescrollt wurde nie (gemessen 4 s
           bei Unterkante 856 von 817 freien px). */
        if (/auto|scroll/.test(w.getComputedStyle(s).overflowY) && s.clientHeight > 120 && s.scrollHeight - s.clientHeight > 20) return s;
      }
    }
    return document.scrollingElement;
  }
  function holen(e, sanft) {
    var r = rect(e), s = scroller(e), mitte = (70 + innerHeight - unten()) / 2;
    var d = r.height > innerHeight - 260 ? r.top - 80 : (r.top + r.height / 2) - mitte;
    /* v2222b · immer sofort: sanftes Scrollen brauchte gemessen bis zu 3 s,
       so lange stand der Kegel außerhalb des Bildes. Die Bewegung liefert der
       Kegel selbst (Übergang 0,7 s). */
    try { s.scrollTo({ top: s.scrollTop + d, behavior: 'auto' }); } catch (x) { s.scrollTop += d; }
  }
  function folgen() {
    if (_folge) return;
    _folge = setInterval(function () {
      var z = zielEl(); if (!z) { kegel(null); platziere(); return; }
      var r = rect(z);
      if (!frei(r) && _nachScroll < 3 && Date.now() - _letzterScroll > 1200) {
        _nachScroll++; _letzterScroll = Date.now();
        holen(z, false);
      }
      kegel(z, _pad);
      platziere();
    }, 200);
  }
  async function zeige(ziel, pad) {
    _ziel = ziel || null; _pad = pad == null ? 10 : pad;
    /* v2219d · Szenenwechsel: die alte Zeile geht mit dem alten Ziel (sie stand
       gemessen 2-3 s über dem nächsten Reiter) */
    if (!_ziel) { kegel(null); zeileWeg(); return; }
    var z = zielEl();
    /* nur scrollen, wenn das Ziel nicht frei sichtbar ist - sonst schiebt es den
       Umschalter oben aus dem Bild; unten liegt die Zeile (rund 160 px) */
    _nachScroll = 0; _letzterScroll = 0;
    if (z && !frei(rect(z))) { _letzterScroll = Date.now(); holen(z, true); }
    folgen();
    await warte(750);
  }
  /* v2219f · jeder Reiter beginnt oben: die Scrollposition des vorigen blieb
     stehen, der kürzere Steuer-Reiter zeigte gemessen eine leere Fläche */
  function reiter(sec) { var t = q('.tab[data-target-sec="' + sec + '"]'); if (t) t.click(); var m = q('.main-col'); if (m) m.scrollTop = 0; }
  /* v2221 · Quick-Check: Dokument, Feld, Tippen wie von Hand (Zeichen für
     Zeichen mit input-Ereignis - der Quick-Check rechnet bei jedem Zeichen) */
  function qcDoc() { var f = q('#qc-v17-frame'); try { return f && f.contentDocument; } catch (e) { return null; } }
  function qcEl(id) { var d = qcDoc(); return d && d.getElementById(id); }
  function qcGruppe(k) { var i = qcEl('ico-grp-' + k); return i && i.closest('.card'); }
  async function tippe(id, text, ms) {
    var e = qcEl(id); if (!e) return; var w = e.ownerDocument.defaultView;
    function los(typ) { e.dispatchEvent(new w.Event(typ, { bubbles: true })); }
    if (e.tagName === 'SELECT') { e.value = text; los('input'); los('change'); await warte(ms || 300); return; }
    e.value = ''; los('input');
    for (var i = 0; i < text.length; i++) { e.value = text.slice(0, i + 1); los('input'); await warte(ms || 95); }   /* v2233: etwas ruhiger getippt */
    los('change');
  }
  function qcText(id) { var e = qcEl(id); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }
  /* KPI-Kachel: "Cashflow/Mo-147€Ziel ≥0€" -> der Wert zwischen Titel und "Ziel" */
  function qcKpi(id, titel) { var t = qcText(id); var m = t.replace(titel, '').split('Ziel')[0].trim(); return m || null; }
  function qcWin() { var f = q('#qc-v17-frame'); return f && f.contentWindow; }
  function qcSetze(id, v) {
    var e = qcEl(id); if (!e) return; var w = e.ownerDocument.defaultView;
    e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  function qcSel(sel) { var d = qcDoc(); return d && d.querySelector(sel); }
  function qcScore() { return { n: qcText('sb-num'), stufe: qcText('sb-tier'), urteil: qcText('ai-verdict-headline') }; }
  function qcAufraeumen() {
    /* „Neuer Vorgang": löscht den Boarding-Pass, den der Quick-Check beim ersten
       Score selbst anlegt, und leert das Fenster - sonst hinterlässt jede
       Schleife einen Pass (gemessen: DELETE /passes/<code>) */
    try { window.postMessage({ source: 'dp-qc', type: 'qc-reset-buffer' }, '*'); } catch (e) {}
  }
  function nkmFeld() { var n = q('#nkm'); return n && n.closest('.f'); }
  async function warteAuf(fn, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { var v = fn(); if (v) return v; await warte(150); } return null; }

  /* ── Objekt finden: über die Anschrift, nicht über eine Kennung ─────
     Die UUID auf Staging ist auf Prod eine andere. */
  async function objektFinden(muster) {
    var r = await Auth.apiCall('/objects', { method: 'GET' });
    var l = Array.isArray(r) ? r : (r.data || r.items || r.objects || Object.values(r).filter(Array.isArray)[0] || []);
    var o = l.filter(function (x) { return muster.test(JSON.stringify(x)); })[0];
    return o ? o.id : null;
  }

  var ABSPANN_LOGO = '<div id="dpm-logo"><span class="w">Deal<b>Pilot</b></span></div><div id="dpm-bahn"><i></i></div><div class="unter">dealpilot.immo</div>';   /* v2228: gemeinsam für alle Abspänne */
  /* ═══ DREHBUCH 1 · PARKSTRASSE 9 — ALTBAU MIT HEBEL ══════════════════ */
  var DREHBUECHER = {
    parkstrasse: {
      titel: 'Altbau mit Hebel',
      unterzeile: 'Parkstraße 9 · Bad Oeynhausen · Mehrfamilienhaus von 1905',
      objekt: /Parkstr(\.|aße|asse) ?9/i,
      szenen: [
        async function (s) {
          reiter('s0'); await warte(600);
          await zeige('.ank-ansicht-kopf', 8);
          var A = window.DealPilotAnkauf && DealPilotAnkauf.stand();
          var kp = A && A.kurz ? eur(A.kurz.kp) : null;
          s.zeile('Gekauft', 'Gekauft am <b>' + datum(A && A.stichtag) + '</b>' + (kp ? ' für <b>' + kp + '</b>' : '') + ' — im Bestand.');
          await warte(5200);
        },
        async function (s) {
          /* v2219d · Der Kegel zeigt erst den Umschalter, dann die Miete selbst:
             vorher stand die Zahl nur in der Zeile, in der App sah man sie nicht */
          await zeige(null); reiter('s2'); await warte(900);
          var seg = await warteAuf(function () { return [].filter.call(document.querySelectorAll('.ank-wahl .ank-seg'), function (b) { return /Soll/.test(b.textContent); })[0]; });
          await zeige('.ank-wahl', 8);
          if (seg) seg.click();
          await warteAuf(function () { return window.DealPilotAnkaufAnsicht && DealPilotAnkaufAnsicht.aktiv(); }, 8000);
          await warte(500);
          await zeige(nkmFeld, 10);
          var K = (DealPilotAnkauf.stand() || {}).kurz || {};
          var teile = [];
          if (K.nkm != null) teile.push('<b>' + eur(K.nkm) + '</b> Nettokaltmiete');
          if (K._leer_einheiten) teile.push('<b>' + K._leer_einheiten + '</b> ' + (K._leer_einheiten === 1 ? 'Wohnung' : 'Wohnungen') + ' leer');
          if (K._kpis_dscr != null) teile.push('DSCR <b>' + de(K._kpis_dscr, 2) + '</b>');
          s.zeile('Soll · der Plan beim Kauf', 'Eingefroren mit dem Nutzen-/Lastenwechsel: ' + teile.join(', ') + '.');
          await warte(6500);
        },
        async function (s) {
          var seg = [].filter.call(document.querySelectorAll('.ank-wahl .ank-seg'), function (b) { return /Ist/.test(b.textContent); })[0];
          zeileWeg(); await zeige('.ank-wahl', 8);
          if (seg) seg.click();
          /* erst weiter, wenn die Ankauf-Ansicht wirklich gelöst ist (der Ist-Stand neu geladen) */
          await warteAuf(function () { return window.DealPilotAnkaufAnsicht && !DealPilotAnkaufAnsicht.aktiv(); }, 8000);
          await warte(400);
          /* gemessen: das Zurückladen des Ist springt auf den Reiter Objekt */
          reiter('s2'); await warte(700);
          await zeige(nkmFeld, 10);
          var nkm = parseFloat(String((q('#nkm') || {}).value || '').replace(/\./g, '').replace(',', '.'));
          s.zeile('Ist · heute', 'Eine Wohnung saniert und neu vermietet: <b>' + (isFinite(nkm) ? eur(nkm) : '–') + '</b> Nettokaltmiete.');
          await warte(5500);
        },
        async function (s) {
          await zeige(null); reiter('s5'); await warte(1200);
          var tab = await warteAuf(function () { return [].filter.call(document.querySelectorAll('#ai-content .dp-pa-tab'), function (b) { return /Soll\/Ist/.test(b.textContent) && b.getBoundingClientRect().width > 0; })[0]; });
          if (tab) tab.click();
          await warte(600);
          var a = null; try { a = DealPilotAnkauf.abweichung(); } catch (e) {}
          function z(wort) { return a && a.zeilen.filter(function (x) { return x.wort === wort; })[0]; }
          var teile = [], d = z('DSCR'), c = z('Cashflow n. Steuer'), sc = z('DealScore');
          if (d) teile.push('DSCR <b>' + de(d.ankauf, 2) + ' → ' + de(d.bestand, 2) + '</b>');
          /* v2219d · kürzer: mit "Cashflow n. St." und "DealScore" brach die Zeile
             bei 1568 px um, die 59 stand allein in der zweiten */
          if (c) teile.push('Cashflow <b>' + eur(c.ankauf) + ' → ' + eur(c.bestand) + '</b>');
          if (sc) teile.push('Score <b>' + de(sc.ankauf) + ' → ' + de(sc.bestand) + '</b>');
          await zeige(qs('#ai-content .abw-bewegt') ? '#ai-content .abw-bewegt' : '#ai-content .abw-tafel', 10);
          s.zeile('Soll gegen Ist · automatisch', teile.join(' · ') || 'Plan gegen heute, Kennzahl für Kennzahl.');
          await warte(7500);
        },
        async function (s) {
          await zeige(null); reiter('s3-tax'); await warte(1400);
          /* der Steuerverlauf baut sich nach dem Laden der Steuerdaten NEU - das
             Ziel wird deshalb bei jedem Nachführen frisch gesucht */
          var balken2025 = function () { return [].filter.call(document.querySelectorAll('#s3-tax .tax-tl-bar'), function (b) { return /^\s*2025/.test(b.textContent) && b.getBoundingClientRect().width > 0; })[0] || null; };
          var bar = await warteAuf(balken2025, 8000);
          await warte(800);
          bar = balken2025() || bar;
          var betrag = bar ? (bar.querySelector('.tax-tl-amount') || {}).textContent : null;
          await zeige(bar ? balken2025 : '#s3-tax .tax-timeline-card', 8);
          s.zeile('Steuer 2025', 'Die Sanierung als Erhaltungsaufwand sofort abgesetzt' + (betrag ? ' — Erstattung <b>' + String(betrag).replace(/^\+/, '').trim() + '</b>' : '') + '.');
          await warte(7500);   /* v2219e: der Weg zum Balken 2025 kostet gemessen gut 2 s Scrollen */
        }
      ],
      schluss: '<div class="k">DealPilot</div><h1>Plan gegen Ist.</h1><p>Der Ankauf bleibt stehen — jedes Jahr misst sich daran.</p><div class="m">Deal<b>Pilot</b> · dealpilot.immo</div>'
    },

    /* ═══ DREHBUCH 2 · QUICK-CHECK — LOHNT SICH DAS EXPOSÉ? (v2221) ════════
       Beispielwohnung, bewusst als solche erkennbar (Musterweg). Nur die
       getippten Eingaben stehen fest; Score und Kennzahlen rechnet der echte
       Quick-Check und das Drehbuch liest sie ab. Kein „Abrufen" - das kostet
       Kontingent. Am Ende „Neuer Vorgang" (räumt den Boarding-Pass ab). */
    'quickcheck-tippen': {
      titel: 'Lohnt sich das Exposé?',
      unterzeile: 'Quick Boarding · eine Wohnung, eine Minute, ein Urteil',
      objekt: null,
      aufraeumen: function () { qcAufraeumen(); reiter('s0'); },
      szenen: [
        async function (s) {
          if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
          await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value; }, 10000);
          await warte(900);
          var m = q('.main-col'); if (m) m.scrollTop = 0;
          await zeige(function () { return qcGruppe('adr'); }, 6);
          s.zeile('Exposé auf dem Tisch', 'Eine Eigentumswohnung in Bielefeld — die Eckdaten aus dem Exposé.');
          await tippe('qc_str', 'Musterweg'); await tippe('qc_hnr', '7'); await tippe('qc_plz', '33602'); await tippe('qc_ort', 'Bielefeld');
          await zeige(function () { return qcGruppe('obj'); }, 6);
          await tippe('qc_objektart', 'ETW'); await tippe('qc_wfl', '72'); await tippe('qc_bj', '1994');
          await zeige(function () { return qcGruppe('miete'); }, 6);
          await tippe('qc_nkm_grund', '680');
          await zeige(function () { return qcGruppe('bewirt'); }, 6);
          await tippe('qc_hg', '230');
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Exposé auf dem Tisch', 'Kaufpreis laut Exposé: <b>159.000 €</b>. Eigenkapital, Zins und Tilgung kommen aus deinen Standardwerten.');
          await tippe('qc_kp', '159000', 90);
          await warte(1800);
        },
        async function (s) {
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warteAuf(function () { return /\d/.test(qcText('sb-num')); }, 5000);
          await warte(900);
          var sc = qcText('sb-num'), st = qcText('sb-tier'), dscr = qcKpi('kpi-dscr', 'DSCR'), cf = qcKpi('kpi-cf', 'Cashflow/Mo');
          s.zeile('Das Urteil · in Sekunden', 'Score <b>' + sc + '</b> · ' + st + (dscr ? ' — DSCR <b>' + dscr + '</b>' : '') + (cf ? ', Cashflow <b>' + cf + '</b> im Monat' : '') + '.');
          await warte(6500);
        },
        async function (s) {
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Und wenn der Preis fällt?', 'Verhandelt auf <b>129.000 €</b> …');
          await tippe('qc_kp', '129000', 110);
          await warte(1200);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(1200);
          var sc = qcText('sb-num'), st = qcText('sb-tier'), dscr = qcKpi('kpi-dscr', 'DSCR'), cf = qcKpi('kpi-cf', 'Cashflow/Mo');
          s.zeile('Und wenn der Preis fällt?', 'Bei 129.000 €: Score <b>' + sc + '</b> · ' + st + (dscr ? ' — DSCR <b>' + dscr + '</b>' : '') + (cf ? ', Cashflow <b>' + cf + '</b>' : '') + '. Jetzt lohnt die Besichtigung.');
          await warte(7500);
        }
      ],
      schluss: '<div class="k">DealPilot</div><h1>Erst rechnen, dann besichtigen.</h1><p>Quick Boarding prüft ein Exposé, bevor du ins Auto steigst.</p><div class="m">Deal<b>Pilot</b> · dealpilot.immo</div>'
    },

    /* ═══ DREHBUCH 3 · QUICK BOARDING MIT DATENAUFNAHME (v2222) ════════════
       Marcel 14.10.2026: „mit der Datenaufnahme … ein Exposé laden und auch
       die Marktwertindikation abrufen … wo dann auch Spanne reingeht … den
       Score zeigen mit schwach, solide und gut, unten die Bewertung und wie
       der Lagewert eingeht" - mit seinen zwei PDFs aus Dokumente/Expose.

       ZWEI MITSCHNITTE, beide am 14.10.2026 echt erzeugt und hier nur
       wiedergegeben (kein KI-, kein Marktbericht-Abruf je Durchgang):
       QC_IMPORT  = ObjectActions._voice.mitschnitt() nach dem echten Einlesen
                    beider PDFs (Typ-Erkennung und KI-Auslese wie im Betrieb).
                    Dateinamen neutral; die Auslesewerte sind unverändert -
                    auch der Fehler „wertentwicklung_3jahre_pct 14,1" (im PDF
                    steht -1,65 %), er erscheint im Quick-Check nicht.
       MB_KARTE   = #_mb_state.card nach DealPilotMBQc.run() für dieses Objekt.
       Alles danach rechnet der echte Quick-Check; Score, Urteil, Zielpreis
       und Lagesatz liest das Drehbuch ab. Die Klicks auf die Spanne ändern
       qc_span_config im Browser - der Wert wird vorher gesichert und beim
       Aufräumen zurückgeschrieben. */
    quickcheck: {
      titel: 'Exposé rein, Urteil raus',
      unterzeile: 'Quick Boarding · zwei PDFs, eine Marktwertindikation, ein Urteil',
      objekt: null,
      aufraeumen: function () {
        var ov = q('#oabi-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        /* v2225a · zweimal: das Quick-Check-Fenster schreibt den Wert beim
           Neuladen nach „Neuer Vorgang" noch einmal (gemessen: danach 'high') */
        var _sv = _spanVorher, zurueck = function () { try { if (_sv === null) localStorage.removeItem('qc_span_config'); else if (_sv !== undefined) localStorage.setItem('qc_span_config', _sv); } catch (e) {} };
        zurueck(); setTimeout(zurueck, 2500);
        _spanVorher = undefined; _kiFrei = null;
        try { if (q('#settings-modal') && typeof closeSettings === 'function') { if (window._SetDraft) window._SetDraft.dirty = false; closeSettings(); } } catch (e) {}
        qcAufraeumen(); reiter('s0');
      },
      szenen: [
        async function (s) {   /* 1 · Einstellungen: Standardwerte-Set und Lageklassen */
          try { _spanVorher = localStorage.getItem('qc_span_config'); } catch (e) { _spanVorher = undefined; }
          if (typeof window.showSettings !== 'function') return;
          showSettings('standardwerte');
          await warteAuf(function () { return q('#settings-modal .swk-set.an'); }, 6000);
          await warte(600);
          var set = q('#settings-modal .swk-set.an');
          await zeige(function () { return q('#settings-modal .swk-set.an'); }, 8);
          var setName = ''; try { var _sid = set && set.getAttribute('data-set'); var _so = (window.DpStandardKarten && DpStandardKarten.SETS || []).filter(function (x) { return x.id === _sid; })[0]; setName = _so ? _so.name : ''; } catch (e) {}
          s.zeile('Deine Vorgaben', 'Einmal eingestellt: dein Standardwerte-Set' + (setName ? ' <b>„' + setName + '“</b>' : '') + ' — Tilgung, Eigenkapital, Mietausfall, Mindest-DSCR.');
          await warte(4200);
          var karte = [].filter.call(document.querySelectorAll('#settings-modal .swk-karte'), function (k) { return /Lageklassen/.test(k.textContent); })[0];
          if (karte) { karte.click(); await warte(800); }
          await zeige(function () { return q('#settings-modal .ip-lage-box') || karte; }, 8);
          var LP = window.DealPilotLageProfil, zb = function (k) { try { var v = LP.zielBmr(k); return v != null ? Number(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' %' : '–'; } catch (e) { return '–'; } };
          s.zeile('Deine Vorgaben', 'Und deine Zielrendite je Lage: <b>A ' + zb('A') + '</b> · <b>B ' + zb('B') + '</b> · <b>C ' + zb('C') + '</b>.');
          await warte(4600);
          try { if (window._SetDraft) window._SetDraft.dirty = false; } catch (e) {}
          try { closeSettings(); } catch (e) {}
          await warte(500);
        },
        async function (s) {   /* 2 · Quick Boarding startet vorbelegt */
          if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
          await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value && qcEl('qc7-sources'); }, 10000);
          await warteAuf(function () { return qcEl('qc_zins') && qcEl('qc_zins').value; }, 4000);
          await warte(700);
          await zeige(function () { return qcGruppe('fin'); }, 6);
          var zins = (qcEl('qc_zins') || {}).value, tilg = (qcEl('qc_tilg') || {}).value;
          s.zeile('Schon vorbelegt', 'Quick Boarding startet mit deinen Werten: Zins <b>' + (zins || '–') + ' %</b>, Tilgung <b>' + (tilg || '–') + ' %</b>.');
          await warte(3800);
          var lk = (qcEl('qc_lageklasse') || {}).value;
          if (lk) {
            await zeige(function () { var e = qcEl('qc_lageklasse'); return e && (e.closest('.field,.f,.fg') || e.parentElement); }, 8);
            s.zeile('Schon vorbelegt', 'Und die Lage <b>' + lk + '</b> als Vorgabe aus deinem Profil — überschreibbar.');
            await warte(3600);
          }
        },
        async function (s) {   /* 3 · Datenaufnahme: zwei PDFs */
          var m = q('.main-col'); if (m) m.scrollTop = 0;
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          s.zeile('Datenaufnahme', 'Zwei PDFs zur Wohnung: das Exposé vom Makler und ein Marktbericht.');
          await warte(2600);
          window.postMessage({ source: 'dp-qc', type: 'qc-import-pdf' }, '*');
          await warteAuf(function () { return q('#oabi-files'); }, 5000);
          await warte(700);
          ObjectActions._voice.wiedergabe(QC_IMPORT);
          await zeige('#oabi-files', 8);
          s.zeile('Datenaufnahme', 'Beide auf einmal eingelesen — DealPilot erkennt selbst, was Exposé und was Marktbericht ist.');
          await warte(3600);
          var kasten = function () {
            return [].filter.call(document.querySelectorAll('#oabi-result div'), function (d) {
              return /Unterschiedliche Adressen/.test(d.textContent) && d.querySelector('input[type=radio]');
            }).sort(function (x, y) { return x.getBoundingClientRect().height - y.getBoundingClientRect().height; })[0] || null;
          };
          await zeige(kasten, 8);
          s.zeile('Zwei Adressen?', 'Die PDFs nennen zwei verschiedene Adressen — DealPilot merkt es und fragt, welche gilt.');
          await warte(3200);
          var r = [].filter.call(document.querySelectorAll('#oabi-result input[type=radio]'), function (x) { return /Exposé/.test(x.parentElement.textContent); })[0];
          if (r) r.click();
          await warte(1300);
          await zeige(function () { return q('#oabi-ov .oabi-body') || q('#oabi-result'); }, 4);
          s.zeile('Jeder Wert mit Quelle', 'Das Exposé gilt — die Werte der anderen Wohnung bleiben draußen. Jeder Wert mit Quelle, ein Klick übernimmt.');   /* v2236 */
          await warte(4400);
          var ap = q('#oabi-apply'); if (ap) ap.click();
          await warte(1300);
        },
        async function (s) {   /* 4 · Marktwertindikation (Mitschnitt) */
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          var st = qcEl('_mb_state');
          if (!st) { var d = qcDoc(); st = d.createElement('input'); st.type = 'hidden'; st.id = '_mb_state'; d.body.appendChild(st); }
          _mbAkt = mbKarte(); st.value = JSON.stringify({ ts: Date.now(), card: _mbAkt, mode: 'med', collapsed: false });   /* v2237: mit Abschlag wie ein echter Abruf */
          try { qcWin()._oabFeedTrigger(); } catch (e) {}
          await warte(900);
          await zeige(function () { return qcEl('oab-results'); }, 6);
          var mw = _mbAkt.mw, mm = _mbAkt.mm;
          s.zeile('Marktwertindikation', 'Die Wohnung ist leer — DealPilot schätzt den Markt: Marktwert <b>' + eur(mw.low) + ' – ' + eur(mw.high) + '</b>, Miete <b>' + eur(mm.low) + ' – ' + eur(mm.high) + '</b> kalt.');
          await warte(5200);
        },
        async function (s) {   /* 5 · Spanne Unten -> sofort eine Einschätzung */
          await zeige(function () { return qcSel('.avs-spanne'); }, 8);
          s.zeile('Die Spanne', 'Ein Klick auf „Unten“ — die vorsichtige Marktmiete geht in die Rechnung …');
          await warte(1800);
          var t = qcSel('.avs-spanne [data-spanne="low"]'); if (t) t.click();
          await warte(700);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Sofort eine Einschätzung', 'Miete <b>' + eur(MB_KARTE.mm.low) + '</b> → Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(4600);
        },
        async function (s) {   /* 6 · Mehr Eigenkapital */
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Mehr Eigenkapital', '20 % Eigenkapital statt Vollfinanzierung …');
          await warte(1500);
          var b80 = [].filter.call((qcDoc() || document).querySelectorAll('.ltv-btn'), function (x) { return /^80/.test(x.textContent.trim()); })[0];
          if (b80) b80.click();
          await warte(900);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Mehr Eigenkapital', 'Mit 20 % Eigenkapital: Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(4600);
        },
        async function (s) {   /* 7 · Gegen deine Lage: B passt, C kippt das Urteil (v2226) */
          function lagesatz() { return qcText('ai-opinion').match(/Bruttomietrendite von ([\d,]+ ?%) liegt ([^.]*?) deinem Ziel von ([\d,]+ ?%) für die ([ABC])-Lage/); }
          qcSetze('qc_lageklasse', 'B');
          await warte(800);
          await zeige(function () { return qcEl('ai-verdict'); }, 10);
          var lb = lagesatz();
          s.zeile('Gegen deine Lage', 'In der <b>B-Lage</b> verlangst du ' + (lb ? lb[3] : '–') + ' — die Wohnung bringt ' + (lb ? lb[1] : '–') + ': „' + qcText('ai-verdict-headline') + '“.');
          await warte(5200);
          var lf = function () { var e = qcEl('qc_lageklasse'); return e && (e.closest('.field,.f,.fg') || e.parentElement); };
          await zeige(lf, 8);
          s.zeile('Gegen deine Lage', 'Dieselbe Wohnung — aber du stufst die Lage als <b>C</b> ein …');
          await warte(1800);
          qcSetze('qc_lageklasse', 'C');
          await warte(1100);
          await zeige(function () { return qcEl('ai-verdict'); }, 10);
          var lc = lagesatz();
          s.zeile('Gegen deine Lage', 'Ganz oben: <b>„' + qcText('ai-verdict-headline') + '“</b>' + (lc ? ' — ' + lc[1] + ' statt deiner ' + lc[3] : '') + '. Der Score bleibt, das Urteil nicht.');
          await warte(6500);
          await zeige(function () { var n = qcEl('ai-negotiate-v'); return n && (n.closest('.ai-negotiate,.ai-box,div') || n); }, 8);
          var tz = (qcText('ai-negotiate-v').match(/Rechnerisch trägt[^—]*/) || [''])[0].trim();
          var preis = (qcText('ai-negotiate-v').match(/Kaufpreis von ([\d.]+ €)/) || [])[1];
          s.zeile('Und warum er trotzdem gut ist', (tz ? tz + '. ' : '') + (preis ? 'Deine Zielrendite gäbe es bei <b>' + preis + '</b>.' : ''));
          await warte(7500);
        },
        async function (s) {   /* 8 · Oben -> Gut, auch in der C-Lage */
          await zeige(function () { return qcSel('.avs-spanne'); }, 8);
          s.zeile('Und wenn die Miete stimmt?', 'Marktmiete „Oben“ …');
          await warte(1500);
          var t = qcSel('.avs-spanne [data-spanne="high"]'); if (t) t.click();
          await warte(900);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Und wenn die Miete stimmt?', 'Miete ' + eur(MB_KARTE.mm.high) + ': Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — und auch in der C-Lage „' + sc.urteil + '“.');
          await warte(5600);
        },
        async function (s) {   /* 8 · Pilot-Analyse (Mitschnitt für genau diesen Stand) */
          _kiFrei = KI_ANALYSE;
          qcSetze('qc_lageklasse', 'C');   /* neu rechnen -> die Automatik fragt nach 1,8 s */
          await zeige(function () { return qcEl('ai-card'); }, 6);
          s.zeile('Die Pilot-Analyse', 'Zum Schluss liest der Pilot alles zusammen …');
          await warteAuf(function () { return /KI-Analyse/.test(qcText('ai-source')) && qcText('ai-pros').length > 20; }, 9000);
          await warte(800);
          /* v2227 · Marcel: nach „Starker Kauf" kam im Satz direkt „verhandeln" -
             jetzt zeigt die Szene die Brücke: guter Deal, und warum trotzdem */
          await zeige(function () { var n = qcEl('ai-negotiate-v'); return n && (n.parentElement || n); }, 8);
          s.zeile('Die Pilot-Analyse', 'Ein guter Deal — und der Pilot sagt dir, warum du <b>trotzdem verhandeln</b> solltest: Zins über Marktzins, Hausgeld hoch.');
          await warte(7500);
          await zeige(function () { return qcEl('ai-card'); }, 6);
          s.zeile('Die Pilot-Analyse', 'Dazu Pro und Contra und eine Experten-Meinung — gemessen an deiner C-Lage.');
          await warte(5500);
          _kiFrei = null;
        }
      ],
      schluss: '<div class="k">DealPilot</div><h1>Exposé rein. Urteil raus.</h1><p>Quick Boarding liest, schätzt und bewertet — bevor du ins Auto steigst.</p><div class="m">Deal<b>Pilot</b> · dealpilot.immo</div>',
      /* v2226 · Marcel: „am Schluss irgendwas animieren … 30 Sekunden eine
         fundierte Einschätzung … und dann das DealPilot-Logo groß animiert" */
      abspann: [
        { ms: 5200, html: '<div class="k ab">Quick Boarding</div><h1 class="ab z2">30 Sekunden.</h1><p class="ab z3">Eine fundierte Einschätzung — mit Marktwert, deiner Lage und der Pilot-Analyse.</p>' },
        { ms: 6200, html: '<div id="dpm-logo"><span class="w">Deal<b>Pilot</b></span></div><div id="dpm-bahn"><i></i></div><div class="unter">dealpilot.immo</div>' }
      ]
    },

    /* ═══ DREHBUCH 4 · IMMOMETRICA — VOM INSERAT ZUM URTEIL (v2228) ═══════
       Marcel 14.10.2026: „eins mit ImmoMetrica und immer mit Marktbewertung".
       Echtes Inserat aus Marcels gespeicherter Suche „Haus" (14.10.2026,
       ImmobilienScout24): 2,5-Familienhaus Herford, 3 WE, 210 m², Bj 1963,
       350.000 €, leer, Straße nicht veröffentlicht. IMO_MIT ist die einmal
       echt abgerufene Liste (gekürzt auf das, was das Fenster zeigt), IMO_KARTE
       die echte DealPilot-Marktbewertung danach (#_mb_state). Je Durchgang
       KEIN ImmoMetrica- und KEIN Marktbericht-Abruf: die fünf ImmoMetrica-Wege
       beantwortet _imoFetchAn() aus dem Mitschnitt, nur solange das Drehbuch läuft. */
    immometrica: {
      titel: 'Vom Inserat zum Urteil',
      unterzeile: 'ImmoMetrica · Quick Boarding · DealPilot-Marktbewertung',
      objekt: null,
      abspann: [
        { ms: 5200, html: '<div class="k ab">Quick Boarding</div><h1 class="ab z2">Inserat rein. Urteil raus.</h1><p class="ab z3">Aus über tausend Treffern das eine Haus — mit Marktwert, Spanne und klarer Ansage.</p>' },
        { ms: 6200, html: ABSPANN_LOGO }
      ],
      aufraeumen: function () {
        _imoFetchAus();
        var ov = q('#imo-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        var _sv = _spanVorher, zurueck = function () { try { if (_sv === null) localStorage.removeItem('qc_span_config'); else if (_sv !== undefined) localStorage.setItem('qc_span_config', _sv); } catch (e) {} };
        zurueck(); setTimeout(zurueck, 2500);
        _spanVorher = undefined;
        qcAufraeumen(); reiter('s0');
      },
      szenen: [
        async function (s) {   /* 1 · Quick Boarding, Quellen */
          try { _spanVorher = localStorage.getItem('qc_span_config'); } catch (e) { _spanVorher = undefined; }
          if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
          await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value && qcEl('qc7-sources'); }, 10000);
          await warte(800);
          var m = q('.main-col'); if (m) m.scrollTop = 0;
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          s.zeile('Datenaufnahme', 'ImmoMetrica sammelt Inserate aus allen Portalen — deine gespeicherte Suche liegt schon bereit.');
          await warte(3600);
        },
        async function (s) {   /* 2 · ImmoMetrica-Fenster: Suche, Inserat, übernehmen */
          _imoFetchAn();
          if (!(window.ImmoMetricaImport && ImmoMetricaImport.open)) return;
          ImmoMetricaImport.open(function (picked) { try { qcWin().ImmoMetricaQcFill(picked); } catch (e) {} }, { target: 'qc' });
          await warteAuf(function () { return q('#imo-src .imo-pill'); }, 6000);
          await warte(700);
          await zeige('#imo-src', 8);
          s.zeile('ImmoMetrica', 'Deine Quellen: Favoriten und gespeicherte Suchen.');
          await warte(2600);
          var pill = [].filter.call(document.querySelectorAll('#imo-src .imo-pill'), function (x) { return /Suche/.test(x.textContent); })[0];
          if (pill) pill.click();
          await warteAuf(function () { return q('#imo-list .imo-o[data-i="3"]'); }, 6000);
          await warte(600);
          await zeige('#imo-list', 6);
          s.zeile('ImmoMetrica', 'Suche „' + IMO_MIT.searches[0].name + '“: <b>' + de(IMO_MIT.suche.count) + '</b> Treffer aus den Portalen.');
          await warte(3400);
          var o = q('#imo-list .imo-o[data-i="3"]'); if (o) o.click();
          await warte(900);
          await zeige('#imo-detail', 6);
          var d = IMO_MIT.suche.items[3].dp;
          s.zeile('Ein Treffer', 'Ein 2,5-Familienhaus in ' + d.ort + ': <b>' + d.einheiten + ' Einheiten</b>, ' + de(d.wfl) + ' m², Baujahr ' + d.baujahr + ', <b>' + eur(d.kp) + '</b> — leer, Straße nicht veröffentlicht.');
          await warte(5200);
          var ok = q('#imo-confirm'); if (ok) ok.click();
          await warte(1400);
        },
        async function (s) {   /* 3 · Ortskern */
          await zeige(function () { return qcGruppe('adr'); }, 6);
          var h = qcText('qc-ortskern-hinweis');
          s.zeile('Ohne Straße', h ? h.replace(/\.\s*Straße nachtragen.*$/, '') + ' — Straße nachtragen macht es genauer.' : 'Ohne Straße rechnet Quick Boarding mit dem Ortskern.');
          await warte(4600);
        },
        async function (s) {   /* 4 · DealPilot-Marktbewertung (Mitschnitt) */
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          var st = qcEl('_mb_state');
          if (!st) { var dd = qcDoc(); st = dd.createElement('input'); st.type = 'hidden'; st.id = '_mb_state'; dd.body.appendChild(st); }
          st.value = JSON.stringify({ ts: Date.now(), card: IMO_KARTE, mode: 'med', collapsed: false });
          try { qcWin()._oabFeedTrigger(); } catch (e) {}
          await warte(900);
          await zeige(function () { return qcEl('oab-results'); }, 6);
          s.zeile('Marktbewertung', 'DealPilot schätzt das Haus: Marktwert <b>' + eur(IMO_KARTE.mw.low) + ' – ' + eur(IMO_KARTE.mw.high) + '</b>, Miete <b>' + eur(IMO_KARTE.mm.low) + ' – ' + eur(IMO_KARTE.mm.high) + '</b> im Monat.');
          await warte(5400);
        },
        async function (s) {   /* 5 · Spanne: Unten, Ø, Oben */
          var stufen = [['low', 'Unten', 'die vorsichtige Miete'], ['mid', 'Ø', 'die mittlere Miete'], ['high', 'Oben', 'die gute Miete']];
          for (var k = 0; k < stufen.length; k++) {
            await zeige(function () { return qcSel('.avs-spanne'); }, 8);
            s.zeile('Die Spanne', '„' + stufen[k][1] + '“ — ' + stufen[k][2] + ' geht in die Rechnung …');
            await warte(1400);
            var t = qcSel('.avs-spanne [data-spanne="' + stufen[k][0] + '"]'); if (t) t.click();
            await warte(700);
            await zeige(function () { return qcEl('score-block'); }, 4);
            await warte(900);
            var sc = qcScore();
            s.zeile('Die Spanne', stufen[k][1] + ': Miete <b>' + eur(IMO_KARTE.mm[stufen[k][0] === 'mid' ? 'med' : stufen[k][0]]) + '</b> → Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
            await warte(4200);
          }
        },
        async function (s) {   /* 6 · 20 % Eigenkapital -> Gut */
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Mehr Eigenkapital', 'Miete „Oben“ und 20 % Eigenkapital …');
          await warte(1500);
          var b80 = [].filter.call((qcDoc() || document).querySelectorAll('.ltv-btn'), function (x) { return /^80/.test(x.textContent.trim()); })[0];
          if (b80) b80.click();
          await warte(900);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Mehr Eigenkapital', 'Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(3800);
          await zeige(function () { return qcEl('ai-verdict'); }, 10);
          s.zeile('Die Bewertung', 'Unten steht, warum: Rendite, Cashflow, DSCR — und was vor dem Kaufvertrag noch zu prüfen ist.');
          await warte(5200);
        }
      ],
      schluss: ''
    },

    /* ═══ DREHBUCH 5 · SPRACHE — ERZÄHLEN STATT TIPPEN (v2231) ═══════════
       Marcel 14.10.2026: „nach dem Video dann auch mit Sprache … und immer
       mit Marktbewertung". Das echte Sprachfenster läuft (Aufnahme, Live-
       Mitschrift, Chips, Auswertung, Tabelle, Übernahme); ersetzt sind nur
       das Mikrofon (stummer Ton) und die drei Sprach-Abrufe (SPR_*). */
    sprache: {
      titel: 'Erzählen statt tippen',
      unterzeile: 'Quick Boarding · Sprache · DealPilot-Marktbewertung',
      objekt: null,
      abspann: [
        { ms: 5200, html: '<div class="k ab">Quick Boarding</div><h1 class="ab z2">Erzählen statt tippen.</h1><p class="ab z3">Ein Satz pro Wert — DealPilot hört zu, rechnet und sagt dir, wo du stehst.</p>' },
        { ms: 6200, html: ABSPANN_LOGO }
      ],
      aufraeumen: function () {
        var ab = q('#oabi-ov #oabi-cancel'); if (ab) { try { ab.click(); } catch (e) {} }
        var ov = q('#oabi-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        _imoFetchAus(); _mikroAus(); _sprSchritt = 0;
        var _sv = _spanVorher, zurueck = function () { try { if (_sv === null) localStorage.removeItem('qc_span_config'); else if (_sv !== undefined) localStorage.setItem('qc_span_config', _sv); } catch (e) {} };
        zurueck(); setTimeout(zurueck, 2500);
        _spanVorher = undefined;
        qcAufraeumen(); reiter('s0');
      },
      szenen: [
        async function (s) {   /* 1 · Quick Boarding */
          try { _spanVorher = localStorage.getItem('qc_span_config'); } catch (e) { _spanVorher = undefined; }
          if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
          await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value && qcEl('qc7-sources'); }, 10000);
          await warte(800);
          var m = q('.main-col'); if (m) m.scrollTop = 0;
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          s.zeile('Datenaufnahme', 'Kein Exposé zur Hand? Dann einfach erzählen.');
          await warte(3000);
        },
        async function (s) {   /* 2 · Freisprechen mit Live-Mitschrift */
          _sprSchritt = 0; _mikroAn(); _fetchAn(_sprAntwort);
          window.postMessage({ source: 'dp-qc', type: 'qc-voice' }, '*');
          await warteAuf(function () { return q('#oabi-ov #vi-live'); }, 6000);
          await warte(600);
          await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 4);
          s.zeile('Freisprechen', 'DealPilot hört mit — die Mitschrift läuft, erkannte Werte leuchten grün.');
          /* v2231b · die Mitschrift ist eingeklappt (<details>) - im Video soll
             man mitlesen können, was gesagt wird */
          var det = q('#oabi-ov details.vi-transcript'); if (det) det.open = true;
          await warte(4500);
          await zeige(function () { return q('#oabi-ov details.vi-transcript'); }, 8);
          s.zeile('Freisprechen', 'Einfach so, wie du es einem Kollegen erzählen würdest.');
          /* die App fragt alle 5 s nach der Mitschrift: so kommt Satz für Satz */
          await warteAuf(function () { var l = q('#vi-live'); return l && l.value && l.value.length >= SPR_TEXT.join(' ').length; }, 45000);
          await warte(2200);
          var nx = q('#vi-next'); if (nx) nx.click();
          await warteAuf(function () { return q('#oabi-result .oabi-tbl'); }, 10000);
          await warte(700);
          await zeige(function () { return q('#oabi-ov .oabi-body') || q('#oabi-result'); }, 4);
          s.zeile('Ausgewertet', '<b>' + Object.keys(SPR_FELDER).length + ' Werte</b> aus dem Gesagten — Adresse, Fläche, Lage, Miete, Kaufpreis und Finanzierung.');
          await warte(4800);
          var ap = q('#oabi-apply'); if (ap) ap.click();
          await warte(1400);
        },
        async function (s) {   /* 3 · erstes Urteil mit der gesprochenen Miete */
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warteAuf(function () { return /\d/.test(qcText('sb-num')); }, 5000);
          await warte(800);
          var sc = qcScore();
          s.zeile('Erstes Urteil', 'Mit deiner Miete von <b>' + eur(+SPR_FELDER.nkm) + '</b>: Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(4800);
        },
        async function (s) {   /* 4 · DealPilot-Marktbewertung */
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          var st = qcEl('_mb_state');
          if (!st) { var dd = qcDoc(); st = dd.createElement('input'); st.type = 'hidden'; st.id = '_mb_state'; dd.body.appendChild(st); }
          st.value = JSON.stringify({ ts: Date.now(), card: SPR_KARTE, mode: 'med', collapsed: false });
          try { qcWin()._oabFeedTrigger(); } catch (e) {}
          await warte(900);
          await zeige(function () { return qcEl('oab-results'); }, 6);
          s.zeile('Marktbewertung', 'Marktwert <b>' + eur(SPR_KARTE.mw.low) + ' – ' + eur(SPR_KARTE.mw.high) + '</b> — der Kaufpreis liegt darunter. Marktmiete <b>' + eur(SPR_KARTE.mm.low) + ' – ' + eur(SPR_KARTE.mm.high) + '</b>.');
          await warte(5600);
        },
        async function (s) {   /* 5 · Spanne Ø und Oben */
          var stufen = [['mid', 'Ø', 'med'], ['high', 'Oben', 'high']];
          for (var k = 0; k < stufen.length; k++) {
            await zeige(function () { return qcSel('.avs-spanne'); }, 8);
            s.zeile('Die Spanne', 'Marktmiete „' + stufen[k][1] + '“ statt deiner Schätzung …');
            await warte(1400);
            var t = qcSel('.avs-spanne [data-spanne="' + stufen[k][0] + '"]'); if (t) t.click();
            await warte(700);
            await zeige(function () { return qcEl('score-block'); }, 4);
            await warte(900);
            var sc = qcScore();
            s.zeile('Die Spanne', stufen[k][1] + ': Miete <b>' + eur(SPR_KARTE.mm[stufen[k][2]]) + '</b> → Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
            await warte(4300);
          }
        },
        async function (s) {   /* 6 · 20 % Eigenkapital */
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Mehr Eigenkapital', '20 % Eigenkapital statt der gesprochenen 32.000 € …');
          await warte(1500);
          var b80 = [].filter.call((qcDoc() || document).querySelectorAll('.ltv-btn'), function (x) { return /^80/.test(x.textContent.trim()); })[0];
          if (b80) b80.click();
          await warte(900);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Mehr Eigenkapital', 'Eigenkapital ' + eur(parseFloat(String((qcEl('qc_ek') || {}).value || '0'))) + ': Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(5200);
        }
      ],
      schluss: ''
    }
  };

  /* v2228 · ImmoMetrica-Mitschnitt (Drehbuch 4) und Abruf-Ersatz */
  var IMO_MIT = {"searches":[{"id":110695,"name":"Haus","count":null}],"suche":{"count":1527,"items":[{"raw":{"id":29057744,"title":"Immobilie mit Weitsicht! Familienleben auf großzügigem Grundstück","address_raw":"32584 Nordrhein-Westfalen - Löhne"},"dp":{"plz":"32584","ort":"Löhne","str":"","hnr":"","objart":"EFH","wfl":248,"baujahr":1910,"kp":459000,"kuerzel":"Immobilie mit Weitsicht! Familienleben a"}},{"raw":{"id":29056646,"title":"Zeitlose Architektur - elegante Doppelhaushälfte auf 3 Etagen","address_raw":"32602 Vlotho (Valdorf)"},"dp":{"plz":"32602","ort":"Vlotho","str":"","hnr":"","objart":"DHH","wfl":140,"baujahr":2027,"kp":389550,"kuerzel":"Zeitlose Architektur - elegante Doppelha"}},{"raw":{"id":29056607,"title":"Alles auf einer Ebene: Klein, gut gelegen und voller Komfort","address_raw":"32549 Nordrhein-Westfalen - Bad Oeynhausen"},"dp":{"plz":"32549","ort":"Bad Oeynhausen","str":"","hnr":"","objart":"EFH","wfl":79.9,"baujahr":1996,"kp":269000,"kuerzel":"Alles auf einer Ebene: Klein, gut gelege"}},{"raw":{"id":29054110,"title":"Attraktives 2,5-Familienhaus in Herford mit Entwicklungspotenzial in gefragter Wohnlage ","address_raw":"32049, Herford","online_since":"2026-10-14T09:22:10+02:00","reactivated_at":null},"dp":{"plz":"32049","ort":"Herford","str":"","hnr":"","objart":"MFH","wfl":210,"gsfl":700,"baujahr":1963,"kp":350000,"nkm":null,"zimmer":9,"bad_anz":3,"etage":null,"etagen_ges":3,"einheiten":3,"kuerzel":"Attraktives 2,5-Familienhaus in Herford ","vermstand":"Leer","ds2_zustand":"renovierungsbeduerftig","notizen":"— Aus ImmoMetrica übernommen —\nAttraktives 2,5-Familienhaus in Herford mit Entwicklungspotenzial in gefragter Wohnlage \n\nQuelle: ImmobilienScout24 – https://www.immobilienscout24.de/expose/171754199\nI","_immometrica_id":29054110,"_quelle":"IS24","_expose":"https://www.immobilienscout24.de/expose/171754199","_immometrica_online_since":"2026-10-14T09:22:10+02:00","_immometrica_reaktiviert":null,"_immometrica_portals":1}},{"raw":{"id":29053942,"title":"Ein-/Zweifamilienhaus in Lübbecke","address_raw":"32312 Nordrhein-Westfalen - Lübbecke"},"dp":{"plz":"32312","ort":"Lübbecke","str":"","hnr":"","objart":"EFH","wfl":239,"baujahr":1963,"kp":219000,"kuerzel":"Ein-/Zweifamilienhaus in Lübbecke"}}]},"fav":{"count":7,"items":[{"raw":{"id":28984357,"title":"Modernisiertes Familienhaus mit großer Gewerbefläche","address_raw":"32602, Vlotho"},"dp":{"plz":"32602","ort":"Vlotho","str":"","hnr":"","objart":"EFH","wfl":107,"baujahr":null,"kp":298000,"kuerzel":"Modernisiertes Familienhaus mit großer G"}},{"raw":{"id":28960072,"title":"Mehrfamilienhaus in Enger Pödinghausen zu verkaufen.","address_raw":"32130 Nordrhein-Westfalen - Enger"},"dp":{"plz":"32130","ort":"Enger","str":"","hnr":"","objart":"MFH","wfl":270,"baujahr":1922,"kp":188500,"kuerzel":"Mehrfamilienhaus in Enger Pödinghausen z"}},{"raw":{"id":28948841,"title":"Grundstücke mit Projektentwicklung suchen Anleger/Investor!","address_raw":"32049 Herford (Innenstadt)"},"dp":{"plz":"32049","ort":"Herford","str":"","hnr":"","objart":"MFH","wfl":665,"baujahr":2027,"kp":2976750,"kuerzel":"Grundstücke mit Projektentwicklung suche"}},{"raw":{"id":28927948,"title":"32361 Preußisch Oldendorf: Pure-Home-Aktion für clevere Familienplanung","address_raw":"32361 Nordrhein-Westfalen - Preußisch Oldendorf"},"dp":{"plz":"32361","ort":"Preußisch Oldendorf","str":"","hnr":"","objart":"EFH","wfl":146.36,"baujahr":null,"kp":354139,"kuerzel":"32361 Preußisch Oldendorf: Pure-Home-Akt"}}]}};
  var IMO_KARTE = {"area":210,"rating":"Attraktiv","conf":{"label":"Mittel","pct":66},"mikro":"Gut · 6,5","makro":"Durchschnittlich · 5,9","microRaw":65,"macroRaw":59,"trendRaw":null,"trend":"–","zensus":{"ebene":"Gemeinde","name":"Herford, Hansestadt","leer":4,"eig":42.1,"miete":4.66},"brw":{"wert":110,"quelle":"BORIS-NRW","stichtag":"2026-01-01"},"makroGemessen":4,"mw":{"low":361000,"med":393000,"high":461000,"sqm":"1.870 €/m²"},"mm":{"low":1499,"med":1756,"high":2327,"sqm":"8,36 €/m² kalt"}};
  var _fetchEcht = null;
  function _imoAntwort(url) {
    var u = String(url || '');
    if (u.indexOf('/api/v1/immometrica/') < 0) return null;
    if (/\/health/.test(u)) return { mode: 'live' };
    if (/\/credentials/.test(u)) return { immometrica: { exists: true } };
    if (/\/searches\/\d+\/results/.test(u)) return { count: IMO_MIT.suche.count, next: "mitschnitt", items: IMO_MIT.suche.items };   /* v2228a: wie echt "weitere laden" statt "Mehr liefert die Schnittstelle nicht" */
    if (/\/searches(\?|$)/.test(u)) return IMO_MIT.searches;
    if (/\/favorites\//.test(u)) return { count: IMO_MIT.fav.count, next: "mitschnitt", items: IMO_MIT.fav.items };
    return null;
  }
  /* v2231 · allgemein: jedes Drehbuch bringt seine Antwortfunktion mit */
  var _fetchAntwort = null;
  function _imoFetchAn() { _fetchAn(_imoAntwort); }
  function _fetchAn(fn) {
    _fetchAntwort = fn;
    if (_fetchEcht) return;
    _fetchEcht = window.fetch;
    window.fetch = function (url, opt) {
      var a = (lauf && _fetchAntwort) ? _fetchAntwort(typeof url === 'string' ? url : (url && url.url), opt) : null;
      if (a) return Promise.resolve(new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return _fetchEcht.apply(this, arguments);
    };
  }
  function _imoFetchAus() { if (_fetchEcht) { window.fetch = _fetchEcht; _fetchEcht = null; } _fetchAntwort = null; }

  /* v2231 · Sprache: Mikrofon und die drei Sprach-Abrufe nur im Lauf ersetzt.
     SPR_TEXT ist der Sprechtext (Satz für Satz die Live-Mitschrift),
     SPR_FELDER die ECHTE Auslese dieses Textes (/ai/extract-text mit dem
     Quick-Check-Katalog, 14.10.2026) - dieselbe Extraktion, die
     /ai/extract-voice nach der Spracherkennung macht. SPR_KARTE ist die echte
     DealPilot-Marktbewertung für 33602 Bielefeld. Die grünen Chips während
     des Sprechens zeigen, welche dieser Felder im bisher Gesagten stehen. */
  var SPR_TEXT = ['Ich habe hier eine Eigentumswohnung im Musterweg 7 in 33602 Bielefeld.', 'Zweiundsiebzig Quadratmeter, Baujahr 1994, drei Zimmer, Energieklasse C.', 'Die Lage sehe ich als B-Lage.', 'Kaltmiete 680 Euro, Hausgeld 230 Euro im Monat.', 'Kaufpreis laut Exposé 159.000 Euro.', 'Ich bringe 32.000 Euro Eigenkapital mit, Zins 4,2 Prozent, Tilgung eineinhalb Prozent.'];   /* v2231a: mit Lage und Energieklasse - sonst fragt der Co-Pilot zu Recht nach */
  var SPR_IDS = [['objart', 'str', 'hnr', 'plz', 'ort'], ['wfl', 'baujahr', 'zimmer', 'ds2_energie'], ['lageklasse'], ['nkm', 'hg_ul'], ['kp'], ['ek', 'd1z', 'd1t']];
  var SPR_FELDER = {"objart":"ETW","str":"Musterweg","hnr":"7","plz":"33602","ort":"Bielefeld","wfl":"72","zimmer":"3","baujahr":"1994","kp":"159000","nkm":"680","hg_ul":"230","ek":"32000","d1z":"4.2","d1t":"1.5","ds2_energie":"C","lageklasse":"B"};
  var SPR_KARTE = {"area":72,"rating":"Attraktiv","conf":{"label":"Mittel","pct":64},"mikro":"Sehr gut · 9,5","makro":"Durchschnittlich · 5,0","microRaw":95,"macroRaw":50,"trendRaw":null,"trend":"–","zensus":{"ebene":"Gemeinde","name":"Bielefeld, Stadt","leer":3.1,"eig":33.3,"miete":6.81},"brw":{"wert":1250,"quelle":"BORIS-NRW","stichtag":"2026-01-01"},"makroGemessen":4,"mw":{"low":186000,"med":216000,"high":267000,"sqm":"2.995 €/m²"},"mm":{"low":646,"med":724,"high":831,"sqm":"10,06 €/m² kalt"}};
  var _sprSchritt = 0, _gumEcht = null, _sprTon = null;
  function _sprAntwort(url) {
    var u = String(url || '');
    if (/\/ai\/transcribe-chunk/.test(u)) { _sprSchritt = Math.min(SPR_TEXT.length, _sprSchritt + 1); return { text: SPR_TEXT.slice(0, _sprSchritt).join(' ') }; }
    if (/\/ai\/voice-quickmatch/.test(u)) { var ids = []; for (var i = 0; i < _sprSchritt; i++) ids = ids.concat(SPR_IDS[i]); return { ids: ids }; }
    if (/\/ai\/extract-voice/.test(u)) return { transcript: SPR_TEXT.join(' '), fields: SPR_FELDER, unsicher: [], kosten: null };
    return null;
  }
  function _mikroAn() {
    /* ein stummer Tonstrom statt des Mikrofons: MediaRecorder braucht eine
       echte Tonspur, sonst bricht die Aufnahme ab (Auswertung erst ab 2 KB) */
    if (_gumEcht || !navigator.mediaDevices) return;
    try {
      var ac = new (window.AudioContext || window.webkitAudioContext)(), dst = ac.createMediaStreamDestination();
      var osc = ac.createOscillator(), g = ac.createGain(); g.gain.value = 0.02; osc.connect(g); g.connect(dst); osc.start();
      _sprTon = { ac: ac, stream: dst.stream };
      _gumEcht = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = function () { return lauf ? Promise.resolve(_sprTon.stream) : _gumEcht.apply(navigator.mediaDevices, arguments); };
    } catch (e) {}
  }
  function _mikroAus() {
    if (_gumEcht) { navigator.mediaDevices.getUserMedia = _gumEcht; _gumEcht = null; }
    if (_sprTon) { try { _sprTon.ac.close(); } catch (e) {} _sprTon = null; }
  }

  /* v2222 · die beiden Mitschnitte (siehe Drehbuch 3) */
  var _spanVorher, _kiFrei = null;
  /* v2225 · Pilot-Analyse für den Endstand von Drehbuch 3 (Oben, 20 % EK,
     C-Lage), am 14.10.2026 einmal echt über /ai/quickcheck-analyse erzeugt -
     nach v2224/v2227b: angezeigter Score (76 · Gut), Brücke „guter Deal - trotzdem verhandeln, weil …“, im Du. */
  var KI_ANALYSE = {"negotiate":"Dies ist ein guter Deal, da die Bruttomietrendite mit 8,7 % und die Eigenkapitalrendite mit 10,1 % beide überdurchschnittlich stark ausfallen und damit klar über deiner Zielvorgabe von 7 % liegen. Obwohl die Kennzahlen insgesamt sehr gut passen, liegt dein Zinssatz mit 4,22 % leicht über dem aktuellen Marktzins von 3,81 % (laut Bundesbank, Stand 08.2026), und das Hausgeld ist mit 415 EUR/Monat relativ hoch. Daher solltest du versuchen, beim Kaufpreis um mindestens 3-5 % zu verhandeln.","pros":["Sehr hohe Bruttomietrendite von 8,7 %, deutlich über Zielwert","Nettomietrendite mit 6,9 % solide für eine C-Lage","Eigenkapitalrendite mit 10,1 % überdurchschnittlich attraktiv","Positiver monatlicher Cashflow von 357 EUR"],"cons":["Zinssatz liegt über dem aktuellen Marktzins","Hausgeld im Verhältnis zur Miete hoch","Objekt erfordert noch Prüfungen (Bonität, Hausgeld, Protokolle, Energieausweis)"],"opinion":"Die Investitionskennzahlen sprechen für einen starken Kauf: Rendite und Cashflow sind überdurchschnittlich, insbesondere im Vergleich zur C-Lage und deiner Zielsetzung. Ein leicht erhöhter Zinssatz und ein hohes Hausgeld bieten jedoch Potenzial für Kaufpreisverhandlungen. Insgesamt ein überzeugender Deal, die noch offenen Prüfpunkte solltest du vor Abschluss klären."};
  var QC_IMPORT = {"files":[{"name":"Expose.pdf","type":"expose","userType":null,"cache":{"expose":{"adresse":"Hölderlinstr. 1, 32547 Bad Oeynhausen","plz":"32547","ort":"Bad Oeynhausen","objektart":"Eigentumswohnung","energieklasse":"D","heizungsart":"Gas-Zentralheizung","stellplatz":"Tiefgarage","kaufpreis":139000,"wohnflaeche":73.31,"baujahr":1983,"zimmer":2,"hausgeld":415,"energieverbrauch":117.7,"balkon":true,"keller":true}}},{"name":"Marktbericht.pdf","type":"market","userType":null,"cache":{"market":{"adresse":"Sachsenstraße 16, 32052 Herford","plz":"32052","ort":"Herford","objektart":"Wohnung","bewertungsdatum":"2025-10-15","konfidenz":"Gut","makrolage":"gut","mikrolage":"gut","bevoelkerung_entwicklung":"stabil","nachfrage":"mittel","wertsteigerung":"mittel","entwicklung":"begrenzt","kueche_qualitaet":"Gehoben","bad_qualitaet":"Normal","boden_qualitaet":"Standard","fenster_qualitaet":"Gehoben","kueche_zustand":"Neu / kürzlich modernisiert","bad_zustand":"Gut in Stand gehalten","boden_zustand":"Gut in Stand gehalten","fenster_zustand":"Gut in Stand gehalten","badezimmer":"1","etage":"1","etagen":"3","modernisierungsjahr":"2025","garagen":"1","balkon_flaeche":"10","energie_label":"B","wohnflaeche":96,"baujahr":1994,"sanierungsjahr":2025,"zimmer":3,"verkehrswert":215200,"verkehrswert_min":196000,"verkehrswert_max":233000,"preis_pro_qm":2242,"lage_geraeusch":5,"lage_einkaufen":4.7,"lage_bildung":4.3,"lage_gastronomie":4.2,"lage_gesundheit":4.6,"lage_freizeit":2.8,"wertentwicklung_3jahre_pct":14.1,"wertentwicklung_1jahr_pct":4.17,"prognose_naechstes_jahr_pct":3.49,"markt_durchschnittspreis":279000,"markt_tage_auf_dem_markt":139}}}]};
  /* v2236 · Marcel: „die Bewertung ist viel zu hoch". Der alte Mitschnitt
     rechnete 96 m² / Bj 1994 aus dem Marktbericht der ANDEREN Wohnung. Neu
     einmal echt abgerufen (14.10.2026, Staging) für Hölderlinstr. 1, 73,31 m²,
     Bj 1983, Eigentumswohnung: Ø 189.000 €, Spanne 153.000–277.000 €. */
  var MB_KARTE = {"area":73.31,"rating":"Attraktiv","conf":{"label":"Niedrig","pct":39},"mikro":"Sehr gut · 8,2","makro":"Gut · 6,0","microRaw":82,"macroRaw":60,"trendRaw":null,"trend":"–","zensus":{"ebene":"Gemeinde","name":"Bad Oeynhausen, Stadt","leer":3.6,"eig":47.3,"miete":5.84},"brw":{"wert":200,"quelle":"BORIS-NRW","stichtag":"2026-01-01"},"makroGemessen":4,"mw":{"low":153000,"med":189000,"high":277000,"sqm":"2.580 €/m²"},"mm":{"low":597,"med":683,"high":776,"sqm":"9,32 €/m² kalt"}};
  /* v2237 · Pilot-Analyse einmal echt für den Endstand des Rundgangs (Miete Ø,
     20 % EK, C-Lage, Score 60) - MIT DealPilot-Marktwert (178.000 € nach 5,8 %
     Abschlag) und dem Zwei-Sichten-Prompt. */
  var KI_RUNDGANG = {"negotiate": "Du solltest zu diesem Preis nicht kaufen, da die Bruttomietrendite mit 5,9 % deutlich unter deinem Zielwert von 7 % für eine C-Lage liegt. Rechnerisch erreichst du deine Zielrendite erst bei einem Kaufpreis von 117.086 €. Das wäre der Betrag, den du konkret anstreben solltest – also rund 16 % unter dem aktuellen Angebotspreis.", "pros": ["Cashflow mit +28 €/Monat ist positiv, das Objekt trägt sich rechnerisch selbst.", "DSCR von 1,29 sorgt für ausreichend Schuldendienstdeckung.", "Score von 60/100 zeigt eine solide Ausgangslage.", "DealPilot-Marktbewertung: Der Kaufpreis liegt 39.000 € (28 %) unter dem geschätzten Marktwert – Wertpuffer ab dem ersten Tag."], "cons": ["Bruttomietrendite liegt mit 5,9 % klar unter deinem Zielwert von 7 % für diese Lageklasse.", "Eigenkapitalrendite mit nur 0,8 % ist niedrig.", "Hausgeld mit 415 €/Monat belastet die Rendite zusätzlich."], "opinion": "Nach deiner Zielvorgabe für C-Lagen ist das Objekt aktuell kein Kauf, weil die gewünschte Rendite nicht erreicht wird. Die Kennzahlen zeigen aber, dass der Deal sich selbst trägt und im Marktvergleich ein Wertpuffer vorhanden ist – der Kaufpreis liegt 39.000 € unter der DealPilot-Marktbewertung. Als klassisches Renditeobjekt passt die Wohnung nicht zu deinen Anforderungen, als wertgesicherter Substanzkauf bleibt sie jedoch interessant."};
  /* v2237 · Der Mitschnitt ist die ROHE Antwort (Angebotsniveau). Wie bei einem
     echten Abruf geht er durch DealPilotAbschlag.anwenden (Satz aus den
     Einstellungen, sonst Marktdurchschnitt) - im Quick-Check-Fenster. */
  var _mbAkt = MB_KARTE;
  function mbKarte() {
    var c = JSON.parse(JSON.stringify(MB_KARTE));
    try { var A = (qcWin() && qcWin().DealPilotAbschlag) || window.DealPilotAbschlag; if (A) A.anwenden(c); } catch (e) {}
    return c;
  }

  /* ═══ DREHBUCH 6 · QUICK BOARDING — DER RUNDGANG (v2235) ═══════════════
     Marcel 14.10.2026: „oben bei der Datenaufnahme die Methoden vorstellen,
     nacheinander, dann mit einer weitermachen und weiter erklären … bis zum
     ‚Als Objekt speichern'". Gedacht fürs Studio (messe-studio.html, Intro 03
     Boarding Pass, Outro 02 Am Stand), läuft aber auch allein. Ab dem PDF-Weg
     dieselben Szenen wie 'quickcheck' - dieselben Mitschnitte, kein Abruf.
     Gespeichert wird NICHT: die letzte Szene zeigt den Knopf. */
  function qcTile(src) { return function () { return qcSel('.qc7-src[data-src="' + src + '"]'); }; }
  var QC = DREHBUECHER.quickcheck.szenen;
  DREHBUECHER['quickcheck-rundgang'] = {
    titel: 'Quick Boarding',
    unterzeile: 'Fünf Wege zu den Daten · ein Urteil · ein Objekt',
    objekt: null,
    aufraeumen: DREHBUECHER.quickcheck.aufraeumen,
    abspann: DREHBUECHER.quickcheck.abspann,
    szenen: [
      async function (s) {   /* 1 · Quick Boarding öffnen - vorbelegt */
        try { _spanVorher = localStorage.getItem('qc_span_config'); } catch (e) { _spanVorher = undefined; }
        if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
        await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value && qcEl('qc7-sources'); }, 10000);
        await warteAuf(function () { return qcEl('qc_zins') && qcEl('qc_zins').value; }, 4000);
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await warte(600);
        await zeige(function () { return qcEl('qc7-sources'); }, 6);
        s.zeile('Die Datenaufnahme', 'Oben die Datenaufnahme: <b>fünf Wege</b>, wie ein Objekt in DealPilot kommt — einer reicht.');
        await warte(4600);
      },
      async function (s) {   /* 2 · Exposé / Marktbericht */
        await zeige(qcTile('expose'), 8);
        s.zeile('Exposé & Marktbericht', 'PDFs hineinziehen — Exposé, Marktbericht, Mietaufstellung. DealPilot liest jeden Wert <b>mit Quelle</b>.');
        await warte(5000);
      },
      async function (s) {   /* 3 · Sprache */
        await zeige(qcTile('voice'), 8);
        s.zeile('Sprache', 'Bei der Besichtigung einfach <b>erzählen</b> — Fläche, Miete, Zustand. DealPilot schreibt mit und füllt die Felder.');
        await warte(5000);
      },
      async function (s) {   /* 4 · ImmoMetrica */
        await zeige(function () { return qcEl('qc-imo-tile'); }, 8);
        s.zeile('ImmoMetrica', 'Direkt aus dem Inserat: deine gespeicherte Suche öffnen, Objekt wählen, <b>übernehmen</b>.');
        await warte(5000);
      },
      async function (s) {   /* 5 · DealPilot-Marktbewertung */
        await zeige(qcTile('dpmb'), 8);
        s.zeile('DealPilot-Marktbewertung', 'Kein Exposé zur Hand? <b>Abrufen</b> — Marktwert und Marktmiete für die Adresse, aus DealPilots eigener Bewertung.');
        await warte(5200);
      },
      async function (s) {   /* 6 · Von Hand */
        await zeige(function () { return qcGruppe('obj'); }, 6);
        s.zeile('Oder von Hand', 'Oder einfach <b>tippen</b> — jedes Feld rechnet sofort mit, Score und Urteil laufen mit.');
        await warte(4600);
      },
      QC[2],   /* 7 · Weiter mit den PDFs (Exposé + Marktbericht) */
      QC[3],   /* 8 · Marktwertindikation (echter Mitschnitt, richtige Wohnung) */
      async function (s) {   /* 9 · Angebotspreise -> realistischer Wert */
        await zeige(function () { return qcEl('oab-results'); }, 6);
        var ab = _mbAkt.abschlag || {}, pz = String(ab.pct || '').replace('.', ',');
        s.zeile('Achtung: Angebotspreise', 'Vergleichswerte aus Inseraten sind <b>Angebotspreise</b>. DealPilot zieht deinen Abschlag gleich ab: <b>' + pz + ' %</b>, den aktuellen Marktdurchschnitt — Ø ' + eur(ab.roh && ab.roh.med) + ' → realistisch <b>' + eur(_mbAkt.mw.med) + '</b>.');
        await warte(7000);
      },
      async function (s) {   /* 10 · Miete Ø -> erste Einschätzung */
        await zeige(function () { return qcSel('.avs-spanne'); }, 8);
        var t = qcSel('.avs-spanne [data-spanne="mid"]'); if (t) t.click();
        s.zeile('Die Miete', 'Für die Rechnung die mittlere Marktmiete: <b>' + eur(_mbAkt.mm.med) + '</b> kalt …');
        await warte(2600);
        await zeige(function () { return qcEl('score-block'); }, 4);
        await warte(900);
        var sc = qcScore();
        s.zeile('Sofort eine Einschätzung', 'Voll finanziert: Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
        await warte(4800);
      },
      QC[5],   /* 11 · Mehr Eigenkapital */
      QC[6],   /* 12 · Gegen deine Lage (B passt, C kippt das Urteil) */
      async function (s) {   /* 13 · Pilot-Analyse (einmal echt für diesen Stand) */
        _kiFrei = KI_RUNDGANG;
        qcSetze('qc_lageklasse', 'C');   /* neu rechnen -> die Automatik fragt nach 1,8 s */
        await zeige(function () { return qcEl('ai-card'); }, 6);
        s.zeile('Die Pilot-Analyse', 'Zum Schluss liest der Pilot alles zusammen …');
        await warteAuf(function () { return /KI-Analyse/.test(qcText('ai-source')) && qcText('ai-pros').length > 20; }, 9000);
        await warte(800);
        await zeige(function () { var n = qcEl('ai-negotiate-v'); return n && (n.parentElement || n); }, 8);
        s.zeile('Die Pilot-Analyse', 'Der Pilot bleibt ehrlich: für deine <b>C-Lage</b> zu wenig Rendite — dein Ziel gäbe es erst bei <b>117.086 €</b>.');
        await warte(6500);
        await zeige(function () { return qcEl('ai-card'); }, 6);
        s.zeile('Die Pilot-Analyse', 'Und er sieht mehr: <b>39.000 € unter Marktwert</b> — als Renditeobjekt nein, als <b>Substanzkauf</b> interessant.');
        await warte(5500);
        _kiFrei = null;
      },
      async function (s) {   /* 14 · Wertpuffer ab Tag 1 - steht seit v2237 im Urteil selbst */
        await zeige(function () { var n = qcEl('ai-negotiate-v'); return n && /Wertpuffer/.test(n.textContent) ? (n.parentElement || n) : qcEl('oab-results'); }, 8);
        var real = _mbAkt.mw.med, kp = Number((qcEl('qc_kp') || {}).value) || 0;   /* v2237: Marktwert nach Abschlag, Kaufpreis live */
        s.zeile('Und trotzdem spannend', 'Nicht deine Lage-Rendite — aber gekauft für <b>' + eur(kp) + '</b>, realistisch wert rund <b>' + eur(real) + '</b>: <b>+' + eur(real - kp) + '</b> Wertpuffer ab dem ersten Tag.');
        await warte(7500);
      },
      async function (s) {   /* 15 · Als Objekt speichern - gezeigt, nicht geklickt */
        await zeige(function () { var b = qcEl('save-btn'); return b && b.getBoundingClientRect().width ? b : null; }, 12);
        s.zeile('Als Objekt speichern', 'Passt er zu dir? <b>Ein Klick</b> — als Objekt gespeichert, mit allen Werten, Quellen und der Pilot-Analyse.');
        await warte(6000);
      }
    ]
  };

  /* ═══ DREHBUCH 7 · VOM QUICK BOARDING ZUM OBJEKT (v2253, Reihe Modul 02) ═══
     Videoreihe „So funktioniert DealPilot" (Dateien/Messe/Videos/
     Videoreihe.md). Zwei Wege ins Portfolio: (a) Quick Boarding prüfen und
     „Als Objekt speichern", (b) „Neues Objekt" leer anlegen.
     GEMESSEN am 15.10.2026 auf Staging, bevor das Drehbuch stand:
     - „Als Objekt speichern" öffnet im Hauptfenster „Diese Daten werden
       übernommen" (#qcpm-ov, qc-bridge.js) mit zwei Reitern: Übernahme
       (DealPilot-Marktwert und -Marktmiete, Spanne) und „Ausgelesene Daten"
       (die im Quick Boarding gesetzten Werte). „Speichern & übernehmen"
       legt das Objekt an (POST /objects) und springt in den Reiter Objekt.
     - Mit wandern: Adresse, Objektart, Wohnfläche, Baujahr, Kaufpreis,
       Kaltmiete, Hausgeld (280 €/Monat -> 2.352 € umlagefähig + 1.008 €
       nicht umlagefähig im Jahr, 70/30), Eigenkapital, Zins, Tilgung,
       Darlehen. Der Marktwert kam bis v2253 NICHT an (quickcheck-app.html
       confirmSave) - behoben. Nicht mit: Makro-/Mikrolage, die Karte der
       Marktbewertung selbst (#_mb_state), die Lageklasse.
     - „Neues Objekt" legt SOFORT eine leere Karte an (POST /objects,
       newobj-fixes.js). Die Quellen-Auswahl beim Anlegen
       (neues-objekt-quellen.js) ist seit v1697 auf Marcels Wunsch
       ausgehängt (index.html, Kommentar am Ende) - es erscheint die
       Datenaufnahme-Leiste oben im Reiter Objekt.
     MB_SACHSEN ist die ROHE DealPilot-Marktbewertung (Angebotsniveau) für
     Sachsenstraße 18, 32052 Herford, ETW 100 m², Bj 1998 - einmal echt
     abgerufen am 15.10.2026; der Abschlag läuft wie im Betrieb über
     DealPilotAbschlag.anwenden. Je Durchgang KEIN Abruf: eine Sperre im
     fetch beider Fenster weist Marktbericht-, KI-, Bewertungs-, ImmoMetrica-
     und Sprach-Abrufe ab und schreibt sie in DPM_B2O.gesperrt.
     ANGELEGT werden zwei Objekte; ihre Kennungen liest das Drehbuch aus der
     Antwort auf POST /objects und löscht genau diese beim Aufräumen - auch
     bei Esc. Der lokale Nummernzähler (seq_<Jahr>) wird zurückgesetzt. */
  var MB_SACHSEN = {"area":100,"rating":"Sehr attraktiv","conf":{"label":"Mittel","pct":64},"mikro":"Sehr gut · 9,5","makro":"Durchschnittlich · 5,9","microRaw":95,"macroRaw":59,"trendRaw":null,"trend":"–","zensus":{"ebene":"Gemeinde","name":"Herford, Hansestadt","leer":4,"eig":42.1,"miete":5.56},"brw":{"wert":190,"quelle":"BORIS-NRW","stichtag":"2026-01-01"},"makroGemessen":4,"mw":{"low":204000,"med":244000,"high":284000,"sqm":"2.440 €/m²"},"mm":{"low":633,"med":802,"high":922,"sqm":"8,02 €/m² kalt"}};
  var B2O_SPERRE = /\/marktbericht\/reports|\/ai\/|\/avm\/|immometrica|\/voice|\/transcri|\/passes/i;
  var _b2o = null;
  window.DPM_B2O = { angelegt: [], gesperrt: [], geloescht: [] };
  function b2oSpion(w) {
    if (!w || w.__dpmB2o) return;
    var echt = w.fetch; w.__dpmB2o = echt;
    DPM_B2O.fenster = (DPM_B2O.fenster || 0) + 1;   /* Nachweis: wie viele Fenster die Sperre tragen */
    w.fetch = function (url, opt) {
      var u = typeof url === 'string' ? url : (url && url.url) || '', m = String((opt && opt.method) || 'GET').toUpperCase();
      if (lauf && m !== 'GET' && B2O_SPERRE.test(u)) {
        DPM_B2O.gesperrt.push(m + ' ' + u.replace(location.origin, ''));
        return Promise.resolve(new w.Response(JSON.stringify({ error: 'Vorführung: Abruf gesperrt' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      }
      var p = echt.apply(this, arguments);
      if (m === 'POST' && /\/api\/v1\/objects\/?(\?|$)/.test(u)) {
        p.then(function (r) { return r.clone().json(); }).then(function (j) {
          var id = j && (j.id || (j.data && j.data.id) || (j.object && j.object.id));
          if (id && DPM_B2O.angelegt.indexOf(id) < 0) DPM_B2O.angelegt.push(id);
        }).catch(function () {});
      }
      return p;
    };
  }
  function b2oSpionAus(w) { try { if (w && w.__dpmB2o) { w.fetch = w.__dpmB2o; delete w.__dpmB2o; } } catch (e) {} }
  function b2oKarte() {
    var c = JSON.parse(JSON.stringify(MB_SACHSEN));
    try { var A = (qcWin() && qcWin().DealPilotAbschlag) || window.DealPilotAbschlag; if (A) A.anwenden(c); } catch (e) {}
    return c;
  }
  function textLen(h) { return String(h || '').replace(/<[^>]+>/g, '').length; }
  /* Lesezeit nach Regel 6 (4 s + 1 s je 15 Zeichen) - in echter Zeit, also
     durch TEMPO geteilt, weil warte() wieder streckt */
  function lies(titel, text) { return Math.round((4000 + 1000 * (textLen(titel) + textLen(text)) / 15) / TEMPO); }
  function sbKnopf(akt) { return function () { return qs('.sb-act-item[onclick*="\'' + akt + '\'"]'); }; }
  function wert(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  function zahl(id) { var v = wert(id).replace(/\./g, '').replace(',', '.'); var n = parseFloat(v); return isFinite(n) && v !== '' ? n : null; }
  function feldVon(id) { return function () { var e = document.getElementById(id); return e && (e.closest('.f,.field,.fg,.form-group') || e.parentElement); }; }
  function pz(n) { return n == null ? null : String(n).replace('.', ','); }
  async function b2oZeile(s, titel, text, extra) { s.zeile(titel, text); await warte(lies(titel, text) + (extra || 0)); }
  /* Ein Kegel über zwei Knöpfe: ein unsichtbarer Rahmen um beide (nur
     im Lauf, pointer-events:none, beim Aufräumen entfernt) */
  function b2oHuelle(a, b) {
    if (!a || !b) return a || b || null;
    /* v2273 · rect() statt getBoundingClientRect: Ziele im Marktbericht-Fenster (iframe) lagen sonst um die Lage des Fensters verschoben (Prüflauf 16: Kegel 5 %) */
    var ra = rect(a), rb = rect(b), h = el('dpm-huelle');
    h.style.cssText = 'position:fixed;pointer-events:none;visibility:hidden;left:' + Math.min(ra.left, rb.left) + 'px;top:' + Math.min(ra.top, rb.top) + 'px;width:' + (Math.max(ra.right, rb.right) - Math.min(ra.left, rb.left)) + 'px;height:' + (Math.max(ra.bottom, rb.bottom) - Math.min(ra.top, rb.top)) + 'px';
    return h;
  }
  /* Das Übernahme-Fenster liegt auf z-index 100000 - der Kegel darüber */
  function kegelHoch(an) { var k = el('dpm-kegel'); k.style.zIndex = an ? '100001' : ''; }

  DREHBUECHER['boarding-zum-objekt'] = {
    titel: 'Vom Quick Boarding zum Objekt',
    unterzeile: 'Zwei Wege ins Portfolio — und was dabei mitwandert',
    objekt: null,
    abspann: [
      { ms: 5200, html: '<div class="k ab">So funktioniert DealPilot · Modul 02</div><h1 class="ab z2">Dein Objekt ist an Bord.</h1><p class="ab z3">Aus dem Quick Boarding übernommen — oder leer angelegt und selbst gefüllt.</p>' },
      { ms: 6200, html: ABSPANN_LOGO }
    ],
    aufraeumen: function () {
      var b = _b2o; _b2o = null;
      var ov = q('#qcpm-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      var nq = q('#dp-nq'); if (nq && nq.parentNode) nq.parentNode.removeChild(nq);
      var hu = q('#dpm-huelle'); if (hu && hu.parentNode) hu.parentNode.removeChild(hu);
      kegelHoch(false);
      if (!b) return;   /* zweiter Aufruf (stopp nach dem Ende) */
      try { qcAufraeumen(); } catch (e) {}
      function ls(k, v) { try { if (v === null) localStorage.removeItem(k); else if (v !== undefined) localStorage.setItem(k, v); } catch (e) {} }
      var zurueck = function () { ls('qc_span_config', b.span); ls('dp_mb_pref_span', b.pref); if (b.seqKey) ls(b.seqKey, b.seq); };
      zurueck(); setTimeout(zurueck, 2500);
      /* genau die Objekte, die dieser Lauf angelegt hat */
      var ids = DPM_B2O.angelegt.slice();
      (async function () {
        await new Promise(function (r) { setTimeout(r, 900); });   /* ein letzter Save darf noch ankommen */
        ids = DPM_B2O.angelegt.slice();
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          try {
            if (window._currentObjKey === id && typeof window.delSaved === 'function') {
              var oc = window.confirm; window.confirm = function () { return true; };
              try { await window.delSaved(id); } finally { window.confirm = oc; }
            } else await Auth.apiCall('/objects/' + id, { method: 'DELETE' });
            DPM_B2O.geloescht.push(id);
          } catch (e) { DPM_B2O.geloescht.push('FEHLER ' + id + ' ' + (e && e.message)); }
        }
        try { if (typeof window.renderSaved === 'function') window.renderSaved({ forceFresh: true, _immediate: true }); } catch (e) {}
        b2oSpionAus(window); b2oSpionAus(qcWin());
        zurueck();
        DPM_B2O.fertig = Date.now();
      })();
      reiter('s0');
    },
    szenen: [
      async function (s) {   /* 1 · Zwei Wege */
        DPM_B2O.angelegt = []; DPM_B2O.gesperrt = []; DPM_B2O.geloescht = []; DPM_B2O.fertig = null; DPM_B2O.fenster = 0;
        var sk = null; try { sk = Auth.getStorageKey('seq_') + new Date().getFullYear(); } catch (e) {}
        _b2o = { span: localStorage.getItem('qc_span_config'), pref: localStorage.getItem('dp_mb_pref_span'), seqKey: sk, seq: sk ? localStorage.getItem(sk) : undefined };
        b2oSpion(window);
        try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
        /* beide Knöpfe in EINEM Kegel: ihr gemeinsamer Rahmen */
        await zeige(function () { return b2oHuelle(sbKnopf('new')(), sbKnopf('quickcheck')()); }, 6);
        await b2oZeile(s, 'Zwei Wege ins Portfolio', 'Erst im <b>Quick Boarding</b> prüfen und übernehmen — oder direkt ein <b>neues Objekt</b> anlegen.');
      },
      async function (s) {   /* 2 · Quick Boarding: die Wohnung */
        var kb = sbKnopf('quickcheck')(); if (kb) kb.click(); else if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
        await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value && qcEl('qc7-sources'); }, 10000);
        await warteAuf(function () { return qcEl('qc_zins') && qcEl('qc_zins').value; }, 4000);
        b2oSpion(qcWin());
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await warte(600);
        await zeige(function () { return qcGruppe('adr'); }, 6);
        s.zeile('Weg 1 · Quick Boarding', 'Eine Eigentumswohnung in Herford — die Eckdaten kurz eingetippt.');
        await tippe('qc_str', 'Sachsenstraße', 70); await tippe('qc_hnr', '18'); await tippe('qc_plz', '32052'); await tippe('qc_ort', 'Herford');
        await zeige(function () { return qcGruppe('obj'); }, 6);
        await tippe('qc_objektart', 'ETW'); await tippe('qc_wfl', '100'); await tippe('qc_bj', '1998');
        var t = '<b>' + (qcEl('qc_str') || {}).value + ' ' + (qcEl('qc_hnr') || {}).value + '</b>, ' + (qcEl('qc_wfl') || {}).value + ' m², Baujahr ' + (qcEl('qc_bj') || {}).value + '.';
        await b2oZeile(s, 'Weg 1 · Quick Boarding', t);
      },
      async function (s) {   /* 3 · Miete, Hausgeld, Kaufpreis */
        await zeige(function () { return qcGruppe('miete'); }, 6);
        await tippe('qc_nkm_grund', '900');
        await zeige(function () { return qcGruppe('bewirt'); }, 6);
        await tippe('qc_hg', '280');
        await zeige(function () { return qcGruppe('fin'); }, 6);
        await tippe('qc_kp', '180000', 90);
        await warte(700);
        var z = (qcEl('qc_zins') || {}).value, tl = (qcEl('qc_tilg') || {}).value;
        await b2oZeile(s, 'Miete und Preis', 'Kaltmiete <b>' + eur(+qcEl('qc_nkm_grund').value) + '</b>, Hausgeld <b>' + eur(+qcEl('qc_hg').value) + '</b>, Kaufpreis <b>' + eur(+qcEl('qc_kp').value) + '</b>' + (z ? ' — Zins ' + z + ' % und Tilgung ' + tl + ' % aus deinen Standardwerten' : '') + '.');
      },
      async function (s) {   /* 4 · Score */
        await zeige(function () { return qcEl('score-block'); }, 4);
        await warteAuf(function () { return /\d/.test(qcText('sb-num')); }, 5000);
        await warte(800);
        var sc = qcScore();
        await b2oZeile(s, 'Das erste Urteil', 'Score <b>' + sc.n + '</b> · ' + sc.stufe + (sc.urteil ? ' — „' + sc.urteil + '“' : '') + '.');
      },
      async function (s) {   /* 5 · Marktbewertung (Mitschnitt) */
        await zeige(function () { return qcEl('qc7-sources'); }, 6);
        var st = qcEl('_mb_state');
        if (!st) { var d = qcDoc(); st = d.createElement('input'); st.type = 'hidden'; st.id = '_mb_state'; d.body.appendChild(st); }
        _b2o && (_b2o.karte = b2oKarte());
        var k = (_b2o && _b2o.karte) || b2oKarte();
        st.value = JSON.stringify({ ts: Date.now(), card: k, mode: 'med', collapsed: false });
        try { qcWin()._oabFeedTrigger(); } catch (e) {}
        await warte(900);
        await zeige(function () { return qcEl('oab-results'); }, 6);
        await b2oZeile(s, 'Der Markt schätzt mit', 'DealPilot-Marktbewertung: Marktwert <b>' + eur(k.mw.med) + '</b> (Spanne ' + eur(k.mw.low) + ' – ' + eur(k.mw.high) + '), Marktmiete <b>' + eur(k.mm.med) + '</b> kalt.');
      },
      async function (s) {   /* 6 · Als Objekt speichern -> Übernahme-Fenster */
        await zeige(function () { var b = qcEl('save-btn'); return b && b.getBoundingClientRect().width ? b : null; }, 12);
        await b2oZeile(s, 'Als Objekt speichern', 'Passt die Wohnung? <b>Ein Klick</b> — und DealPilot fragt, was mitkommt.');
        var sb = qcEl('save-btn'); if (sb && !sb.disabled) sb.click();
        await warteAuf(function () { return q('#qcpm-ov .qcpm-box'); }, 5000);
        kegelHoch(true);
        await warte(700);
        await zeige(function () { return q('#qcpm-ov #qcpm-secs') || q('#qcpm-ov .qcpm-box'); }, 8);
        var mw = (q('#qcpm-ov span.v[data-k="mw"]') || {}).textContent, mm = (q('#qcpm-ov span.v[data-k="mm"]') || {}).textContent;
        await b2oZeile(s, 'Was mitkommt', 'Aus der Marktbewertung: Marktwert <b>' + (mw || '–') + '</b> und Marktmiete <b>' + (mm || '–') + '</b> — angehakt, die Spanne wählst du hier.');
      },
      async function (s) {   /* 7 · Ausgelesene Daten, dann speichern */
        var tab = q('#qcpm-ov .qcpm-tab[data-tab="src"]'); if (tab) tab.click();
        await warte(600);
        var bd = q('#qcpm-ov .qcpm-body'); if (bd) bd.scrollTop = 0;
        /* die ganze Box: sie scrollt nicht, die Liste darin bleibt oben */
        await zeige(function () { return q('#qcpm-ov .qcpm-box'); }, 6);
        var n = [].filter.call(document.querySelectorAll('#qcpm-ov .qcpm-pane[data-pane="src"] .qcpm-item'), function (x) { return x.offsetWidth; }).length;
        await b2oZeile(s, 'Was mitkommt', 'Dazu alles, was du eingegeben hast: <b>' + n + ' Werte</b> — Adresse, Fläche, Baujahr, Miete, Hausgeld, Kaufpreis, Finanzierung.');
        var ok = q('#qcpm-ov #qcpm-ok');
        await zeige(function () { return q('#qcpm-ov #qcpm-ok'); }, 8);
        await warte(1600);
        if (ok) ok.click();
        kegelHoch(false);
        await warteAuf(function () { return !q('#qcpm-ov') && !document.body.classList.contains('qc-standalone-active') && /Sachsen/.test((q('#hdr-obj') || {}).textContent || ''); }, 8000);
        await warteAuf(function () { return DPM_B2O.angelegt.length >= 1; }, 6000);
        await warte(700);
      },
      async function (s) {   /* 8 · Reiter Objekt */
        reiter('s0'); await warte(600);
        await zeige(feldVon('wfl'), 10);
        var oa = (function () { var e = document.getElementById('objart'); return e && e.selectedIndex >= 0 ? e.options[e.selectedIndex].text : wert('objart'); })();
        await b2oZeile(s, 'Das neue Objekt', 'Angelegt: <b>' + ((q('#hdr-obj') || {}).textContent || '').trim() + '</b> — ' + oa + ', ' + wert('wfl') + ' m², Baujahr ' + wert('baujahr') + '. Alles im Reiter Objekt.');
        var sv = zahl('svwert');
        if (sv) {
          await zeige(feldVon('svwert'), 10);
          /* v2254: die Beschriftung live ablesen - Stufe 1/2 ist eine Marktwertindikation, kein Verkehrswert */
          var svSt = (function () { var l = document.getElementById('svwert'); l = l && l.closest('.f'); l = l && l.querySelector('label'); return l ? Number(l.getAttribute('data-sv-stufe')) || 0 : 0; })();
          await b2oZeile(s, 'Das neue Objekt', svSt >= 3
            ? 'Aus der amtlichen Wertermittlung (Stufe 3) steht der Verkehrswert bereit: <b>' + eur(sv) + '</b>.'
            : 'Der Marktwert kommt als <b>Marktwertindikation</b> mit (Stufe ' + (svSt || 1) + '): <b>' + eur(sv) + '</b>. Verkehrswert heißt er erst ab Stufe 3, amtlich.');
        }
      },
      async function (s) {   /* 9 · Investition */
        reiter('s1'); await warte(700);
        await zeige(feldVon('kp'), 10);
        var nk = (q('#nk_sum') || {}).textContent;
        await b2oZeile(s, 'Reiter Investition', 'Kaufpreis <b>' + eur(zahl('kp')) + '</b>' + (nk && /\d/.test(nk) ? ' — die Kaufnebenkosten rechnet DealPilot dazu: <b>' + nk.trim() + '</b>' : '') + '.');
      },
      async function (s) {   /* 10 · Miete und Bewirtschaftung */
        reiter('s2'); await warte(700);
        await zeige(feldVon('nkm'), 10);
        var mm = wert('ds2_marktmiete');
        await b2oZeile(s, 'Reiter Miete', 'Deine Kaltmiete <b>' + eur(zahl('nkm')) + '</b>' + (mm ? ', dazu die Marktmiete <b>' + mm + ' €/m²</b> zum Vergleich' : '') + '.');
        reiter('s4'); await warte(700);
        await zeige(feldVon('hg_ul'), 10);
        await b2oZeile(s, 'Reiter Bewirtschaftung', 'Das Hausgeld schon aufgeteilt: <b>' + eur(zahl('hg_ul')) + '</b> umlagefähig, <b>' + eur(zahl('hg_nul')) + '</b> nicht, im Jahr.');
      },
      async function (s) {   /* 11 · Finanzierung */
        reiter('s3'); await warte(700);
        await zeige(feldVon('d1'), 10);
        await b2oZeile(s, 'Reiter Finanzierung', 'Darlehen <b>' + eur(zahl('d1')) + '</b> zu <b>' + pz(wert('d1z')) + ' %</b>, Tilgung <b>' + pz(wert('d1t')) + ' %</b>, Eigenkapital <b>' + eur(zahl('ek')) + '</b> — wie im Quick Boarding.');
      },
      async function (s) {   /* 12 · Weg 2: Neues Objekt */
        reiter('s0'); await warte(500);
        /* GEMESSEN: mit geladenem Objekt deckt der Deal-Score-Hinweis der
           Seitenleiste den Knopf ab - geklickt wird über den Bedienweg,
           gezeigt wird danach der Kopf „Neues Objekt" */
        var kn = sbKnopf('new')();
        if (kn) kn.click(); else if (typeof window.sbActionsAction === 'function') sbActionsAction('new');
        await warteAuf(function () { return DPM_B2O.angelegt.length >= 2 && /Neues Objekt/.test((q('#hdr-obj') || {}).textContent || ''); }, 8000);
        await warte(600);
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#hdr-obj'); }, 8);
        await b2oZeile(s, 'Weg 2 · Neues Objekt', 'Oder ohne Umweg: <b>„Neues Objekt“</b> legt sofort ein leeres Objekt an.');
        var NAME = { dealpilot: 'DealPilot-Marktbewertung', dpmb: 'DealPilot-Marktbewertung', import: 'Exposé / Marktbericht', expose: 'Exposé / Marktbericht', voice: 'Sprache', immometrica: 'ImmoMetrica', gefuehrt: 'Geführte Eingabe' };
        var kac = [].filter.call(document.querySelectorAll('.dp-pf-tile'), function (e) { return e.getBoundingClientRect().width > 0 && !e.classList.contains('dp-pf-disabled'); });
        var wege = kac.filter(function (e) { return !/^(dealpilot|dpmb)$/.test(e.dataset.src || ''); }).map(function (e) { return NAME[e.dataset.src] || ((e.querySelector('.dp-pf-lbl') || e).textContent || '').trim(); });
        await zeige(function () { return q('#oab-bar') || b2oHuelle(kac[0], kac[kac.length - 1]); }, 8);
        await b2oZeile(s, 'Die Datenaufnahme', 'Oben die DealPilot-Marktbewertung und <b>' + wege.length + ' Wege</b> für deine Daten: ' + wege.join(' · ') + '.');
      }
    ]
  };

  /* ═══ VIDEOREIHE · MODULE 03, 04, 05 (v2255) ════════════════════════════
     Marcel 15.10.2026 (Dateien/Messe/Videos/Videoreihe.md): Datenaufnahme
     (vier Wege), Marktbewertung in drei Stufen, Komplettbeispiel Sprache +
     Stufe 2. Dasselbe Beispielobjekt wie Modul 02: Sachsenstraße 18, 32052
     Herford, ETW.

     KEIN ABRUF JE DURCHGANG. Die Mitschnitte liegen in js/messe-reihe-daten.js
     (einmal echt erzeugt, Kopf der Datei) und werden erst beim Start geladen.
     Ein Ersatz für fetch (nur im Lauf) spielt sie ab:
       - Marktbericht Stufe 1/2/3: der echte Stream-Weg (generate-stream) mit
         Etappen und dem ROHEN Bericht - der Abschlag auf Angebotspreise läuft
         wie im Betrieb in dealpilot-mb.js (DealPilotAbschlag).
       - Verlauf (#oe-vw) für das angelegte Objekt: aus den gespielten Berichten.
       - Sprache: Mitschrift Satz für Satz, Chips, Auswertung; Mikrofon ist ein
         stummer Ton (je Aufruf ein neuer - ein gestoppter Strom liefert nichts).
       - Geführte Eingabe: die Auslese der ersten Antwort (Adresse).
       - ImmoMetrica: derselbe Mitschnitt wie Drehbuch 4.
     Alles andere, was Geld kostet (KI, Marktbericht, Bewertung, Sprache,
     Boarding-Pass), wird abgewiesen und in DPM_REIHE.gesperrt notiert - auch
     noch 6 s nach einem Abbruch (ein Fenster, das beim Schließen weiterläuft).
     ANGELEGT wird je Drehbuch ein Objekt („Neues Objekt"); seine Kennung kommt
     aus der Antwort auf POST /objects und wird beim Aufräumen gelöscht, auch
     bei Esc. Zurückgesetzt: Eingabetiefe, Kachelwahl, Nummernzähler,
     Marktbericht-Aufträge, Spannenwahl. */
  var RH_BUSTER = 'v2276a';   /* v2276a: Stufe-3-Mitschnitt Westerfeldstr. (Modul 16) */
  /* v2257 · dazu BMF (Modul 10b, abgespielt), die RND-Gutachten-Anfrage und
     alles, was eine Anfrage an Dritte oder eine Zahlung ausloest */
  var RH_SPERRE = /\/marktbericht\/reports|\/ai\/|\/avm\/|immometrica|\/voice|\/transcri|\/passes|\/bmf\/|\/rnd-request|\/deal-action\/submit|\/checkout|gutachten|\/network-cards\/(einreichen|partner-interest)|\/unterlagen|\/portfolio-spiegel|\/objects\/track-usage/i;
  /* v2263 · dazu Netzwerk-Einreichung, Partner-Anfrage, Ämter-Anfragen (Modul 13) und
     der Portfolio-Spiegel: eine gewonnene KOPIE (Modul 14) ginge sonst als zweites
     Objekt in die Zahlen des Telegram-Bots (gemessen: 12 statt 11 Objekte). */
  /* v2271 · dazu der Nutzungszaehler: das Investment-PDF in Ueberblick 2 zaehlte je
     Lauf einen PDF-Export im Konto (usage_counters pdf_export, gemessen 11 -> 12).
     Gesperrt rechnet der Export weiter (pdf.js warnt nur). */
  /* v2273 · Prüfung der im Lauf erzeugten PDFs (Module 18, 19): Konto-, Firmen-, Portal- und Dienstnamen im Text */
  var RH_PDF_NAMEN = /Junker|info@|Marcel|scout|immowelt|wohnungsboerse|immonet|kleinanzeig|sprengnetter|pricehubble|openai|geoapify/gi;
  window.DPM_REIHE = { angelegt: [], gesperrt: [], gespielt: [], geloescht: [], abrufe: [], fertig: null };
  var _rh = null, _rhNachlauf = 0, _rhToene = [], _rhGum = null;
  function rhLaden() {
    return new Promise(function (ok) {
      if (window.DPM_REIHE_DATEN) { ok(true); return; }
      var s = document.createElement('script'); s.src = 'js/messe-reihe-daten.js?v=' + RH_BUSTER;
      s.onload = function () { ok(!!window.DPM_REIHE_DATEN); }; s.onerror = function () { ok(false); };
      document.head.appendChild(s);
    });
  }
  function rhJ(x) { return new Response(JSON.stringify(x), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  function rhStrom(st) {
    /* v2263 · ein Lauf kann einen eigenen Satz spielen (Überblick 2: Westerfeldstr.) */
    var D0 = window.DPM_REIHE_DATEN, D = (_rh && _rh.satz && D0[_rh.satz] && D0[_rh.satz].mb[st]) ? D0[_rh.satz] : D0;
    var steps = D.schritte[st] || [], p = JSON.parse(JSON.stringify(D.mb[st])), enc = new TextEncoder(), i = 0;
    if (_rh) _rh.berichte.push({ stufe: st, at: new Date().toISOString(), p: p });
    var rs = new ReadableStream({ pull: function (c) {
      return new Promise(function (ok) {
        setTimeout(function () {
          if (i < steps.length) c.enqueue(enc.encode(JSON.stringify({ type: 'step', msg: steps[i++] }) + '\n'));
          else { c.enqueue(enc.encode(JSON.stringify({ type: 'done', result: { report_id: null, object_key: null, cost: 0, data: JSON.parse(JSON.stringify(p)) } }) + '\n')); c.close(); }
          ok();
        }, i < steps.length ? Math.round(430 * TEMPO) : 300);
      });
    } });
    return new Response(rs, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
  }
  /* der Verlauf so, wie /objects/history ihn liefert (dieselben Spalten) */
  function rhVerlauf() {
    return ((_rh && _rh.berichte) || []).slice().reverse().map(function (b, i) {
      var p = b.p, cc = p.cross_check || {}, vw = cc.verfahrenswahl || {}, mv = (p.valuation && p.valuation.market_value) || {};
      function weg(x) { return ((x && x.staffel) || []).map(function (e) { return { pos: e.pos, wert: e.wert == null ? null : String(e.wert) }; }); }
      return { id: 990000 + i, created_at: b.at, ai_mode: b.stufe === 1 ? 'schnell' : 'openai',
        market_value: mv.estimated != null ? String(mv.estimated) : null,
        ertragswert_eur: (cc.ertragswert && cc.ertragswert.value_eur) || null, sachwert_eur: (cc.sachwert && cc.sachwert.value_eur) || null,
        ertrag_weg: weg(cc.ertragswert), sachwert_weg: weg(cc.sachwert),
        fuehrend: vw.verfahren || null, fuehrend_grund: vw.grund || null, fuehrend_quelle: vw.quelle || null };
    });
  }
  function rhAntwort(u, m, opt) {
    var D = window.DPM_REIHE_DATEN; if (!D || !_rh) return null;
    var body = null; try { body = opt && typeof opt.body === 'string' ? JSON.parse(opt.body) : null; } catch (e) {}
    if (/\/ai\/transcribe-chunk/.test(u)) { _rh.spr = Math.min(_rh.sprMax || D.sprache.text.length, (_rh.spr || 0) + 1); return rhJ({ text: D.sprache.text.slice(0, _rh.spr).join(' ') }); }
    if (/\/ai\/voice-quickmatch/.test(u)) { var ids = []; for (var i = 0; i < (_rh.spr || 0); i++) ids = ids.concat(D.sprache.ids[i] || []); return rhJ({ ids: ids }); }
    if (/\/ai\/extract-voice/.test(u)) return rhJ({ transcript: D.sprache.text.join(' '), fields: D.sprache.felder, unsicher: D.sprache.unsicher, kosten: null });
    if (/\/ai\/extract-text/.test(u) && body && String(body.text || '').trim() === D.gefuehrt.text) return rhJ({ transcript: D.gefuehrt.text, fields: D.gefuehrt.felder, unsicher: [], kosten: null, modus: 'antwort' });
    if (m === 'POST' && /\/marktbericht\/reports\/generate-stream/.test(u)) return rhStrom(body && body.wert_stufe >= 2 ? Number(body.wert_stufe) : 1);
    if (m === 'GET' && /\/marktbericht\/objects\/history\?/.test(u)) {
      var ref = decodeURIComponent((u.match(/[?&]ref=([^&]+)/) || [])[1] || '');
      if (ref && DPM_REIHE.angelegt.indexOf(ref) >= 0) return rhJ({ history: rhVerlauf() });
    }
    if (/\/api\/v1\/immometrica\//.test(u)) { var a = _imoAntwort(u); if (a) return rhJ(a); }
    /* v2273 · Belege einlesen (Modul 15): die Auslese der beiden Beispielbelege, einmal echt */
    if (m === 'POST' && D.belege && /\/ai\/extract-beleg/.test(u)) return rhJ(JSON.parse(JSON.stringify(D.belege)));
    /* v2257 · BMF-Kaufpreisaufteilung (Modul 10b): einmal echt gerechnet, hier
       abgespielt. Mit Datei (PDF/XLSX) wird nichts gespielt - das sperrt RH_SPERRE. */
    /* v2273 · nur im BMF-Modul: der stille Vorlauf (bmf-modal.js, 6 s nach dem Laden) bekam in Modul 15 die Ravensberger-Antwort - jetzt gesperrt */
    if (m === 'POST' && D.bmf && _aktiv === DREHBUECHER['reihe-bmf'] && /\/bmf\/(aufteilung|pipeline)/.test(u) && !(body && (body.include_pdf || body.include_file))) {
      return rhJ(JSON.parse(JSON.stringify(/pipeline/.test(u) ? D.bmf.pipeline : D.bmf.aufteilung)));
    }
    return null;
  }
  function rhSpion() {
    if (window.__dpmRh) return;
    var echt = window.fetch; window.__dpmRh = echt;
    window.fetch = function (url, opt) {
      var u = typeof url === 'string' ? url : (url && url.url) || '', m = String((opt && opt.method) || 'GET').toUpperCase();
      var kurz = u.replace(location.origin, ''), pfad = kurz.split('?')[0];
      if (lauf && _rh) {
        if (m !== 'GET') DPM_REIHE.abrufe.push(m + ' ' + pfad);
        var a = rhAntwort(kurz, m, opt);
        if (a) { DPM_REIHE.gespielt.push(m + ' ' + pfad); return Promise.resolve(a); }
      }
      if (m !== 'GET' && RH_SPERRE.test(kurz) && ((lauf && _rh) || Date.now() < _rhNachlauf)) {
        DPM_REIHE.gesperrt.push(m + ' ' + pfad);
        return Promise.resolve(new Response(JSON.stringify({ error: 'Vorführung: Abruf gesperrt' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      }
      var p = echt.apply(this, arguments);
      if (m === 'POST' && /\/api\/v1\/objects\/?(\?|$)/.test(u)) {
        p.then(function (r) { return r.clone().json(); }).then(function (j) {
          var id = j && (j.id || (j.data && j.data.id) || (j.object && j.object.id));
          if (id && DPM_REIHE.angelegt.indexOf(id) < 0) DPM_REIHE.angelegt.push(id);
        }).catch(function () {});
      }
      return p;
    };
  }
  function rhSpionAus() { if (window.__dpmRh) { window.fetch = window.__dpmRh; delete window.__dpmRh; } }
  function rhMikroAn() {
    if (_rhGum || !navigator.mediaDevices) return;
    _rhGum = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = function () {
      if (!lauf) return _rhGum.apply(navigator.mediaDevices, arguments);
      try {
        var ac = new (window.AudioContext || window.webkitAudioContext)(), dst = ac.createMediaStreamDestination();
        var osc = ac.createOscillator(), g = ac.createGain(); g.gain.value = 0.02; osc.connect(g); g.connect(dst); osc.start();
        _rhToene.push(ac); return Promise.resolve(dst.stream);
      } catch (e) { return Promise.reject(e); }
    };
  }
  function rhMikroAus() {
    if (_rhGum) { navigator.mediaDevices.getUserMedia = _rhGum; _rhGum = null; }
    _rhToene.forEach(function (ac) { try { ac.close(); } catch (e) {} }); _rhToene = [];
  }
  function rhKachel(src) { return function () { return qs('.dp-pf-tile[data-src="' + src + '"]'); }; }
  function rhGewaehlt(src) { var c = q('.dp-pf-tile[data-src="' + src + '"] input[type=checkbox]'); return !!(c && c.checked); }
  function rhWaehle(src, an) { if (rhGewaehlt(src) !== !!an) { var t = q('.dp-pf-tile[data-src="' + src + '"]'); if (t) t.click(); } }
  function rhNur(srcs) { ['dealpilot', 'import', 'voice', 'immometrica', 'gefuehrt'].forEach(function (s) { rhWaehle(s, srcs.indexOf(s) >= 0); }); }
  function rhNameKachel(src) { var t = q('.dp-pf-tile[data-src="' + src + '"] .dp-pf-lbl') || q('.dp-pf-tile[data-src="' + src + '"]'); return t ? t.textContent.replace(/\s+/g, ' ').trim() : src; }
  /* kleinstes Element im Fenster, dessen Text passt */
  function rhIm(wurzel, re) {
    var w = typeof wurzel === 'string' ? q(wurzel) : wurzel; if (!w) return null;
    var best = null;
    [].forEach.call(w.querySelectorAll('*'), function (e) {
      if (!e.offsetWidth || !re.test(e.textContent || '')) return;
      if (!best || (e.textContent.length < best.textContent.length)) best = e;
    });
    return best;
  }
  async function tippeH(id, text, ms) {
    var e = document.getElementById(id); if (!e) return;
    function los(t) { e.dispatchEvent(new Event(t, { bubbles: true })); }
    if (e.tagName === 'SELECT') { e.value = text; los('input'); los('change'); await warte(ms || 380); return; }
    e.value = ''; los('input');
    for (var i = 0; i < text.length; i++) { e.value = text.slice(0, i + 1); los('input'); await warte(ms || 75); }
    los('change');
  }
  function svBeschriftung() {
    var sv = document.getElementById('svwert'), l = sv && sv.closest('.f'); l = l && l.querySelector('label'); if (!l) return { titel: '', hinweis: '', stufe: 0 };
    var h = l.querySelector('.cf-hint'), t = '';
    for (var i = 0; i < l.childNodes.length; i++) { var n = l.childNodes[i]; if (n.nodeType === 3 && n.nodeValue.trim()) { t = n.nodeValue.trim(); break; } }
    return { titel: t, hinweis: h ? h.textContent.trim() : '', stufe: Number(l.getAttribute('data-sv-stufe')) || 0, art: l.getAttribute('data-sv-art') || '' };
  }
  function feldNamen(liste) {
    var F = (window.DealPilotObjektReiter && DealPilotObjektReiter.FELDNAMEN) || {};
    return liste.map(function (id) { return String(F[id] || id).replace(/\s*\(Reiter[^)]*\)/, ''); });
  }
  function fehlt(s) { try { return DealPilotObjektReiter.fehltFuer(s); } catch (e) { return []; } }
  function stufeZeile(s) { return function () { var b = q('#oe-stufen [data-oe-stufe="' + s + '"]'); return b && b.closest('.oe-row'); }; }
  /* nur die Zelle „N frei" - gemessen las der ganze Zeilentext „Stufe 1" + „10 frei" als 110 */
  function kontingentFrei(s) { var r = stufeZeile(s)(), w = r && r.querySelector('.oe-w'); var m = w && /(\d+)\s*frei/.exec(w.textContent); return m ? m[1] : null; }
  function mbKarteH() { try { return DealPilotMB.letzter(); } catch (e) { return null; } }
  /* ein Kegel über eine Feldgruppe. Die Hülle (b2oHuelle) hängt am body -
     gemessen fand scroller() für sie nur das Dokument, .main-col blieb
     stehen und die Gruppe lag halb unter dem Rand. Gescrollt wird deshalb
     über das erste Feld, gezeigt die Hülle. */
  async function zeigeGruppe(fa, fb, pad) {
    var a = fa(), b = fb();
    if (a && b) {
      var ra = rect(a), rb = rect(b), oben = Math.min(ra.top, rb.top), unten2 = Math.max(ra.bottom, rb.bottom);
      var s = scroller(a), sr = (s && s !== document.scrollingElement) ? rect(s) : null;
      /* in einem Fenster mit eigenem Scrollbereich: dessen Mitte, sonst die des Bildes */
      var lo = sr ? Math.max(70, sr.top) : 70, hi = sr ? Math.min(innerHeight - unten(), sr.bottom) : innerHeight - unten();
      if (oben < lo || unten2 > hi) s.scrollTop += ((oben + unten2) / 2) - (lo + hi) / 2;
    }
    await zeige(function () { return b2oHuelle(fa(), fb()); }, pad);
  }

  /* gemeinsamer Anfang: Merker sichern, Spion, „Neues Objekt" */
  async function rhStart(sprMax) {
    DPM_REIHE.angelegt = []; DPM_REIHE.gesperrt = []; DPM_REIHE.gespielt = []; DPM_REIHE.geloescht = []; DPM_REIHE.abrufe = []; DPM_REIHE.fertig = null;
    var sk = null; try { sk = Auth.getStorageKey('seq_') + new Date().getFullYear(); } catch (e) {}
    var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    _rh = { start: Date.now() - 1000, berichte: [], spr: 0, sprMax: sprMax || 0, seqKey: sk, seq: sk ? ls(sk) : undefined,
      merker: { dp_zielstufe: ls('dp_zielstufe'), dp_mb_auftraege: ls('dp_mb_auftraege'), dp_mb_pref_span: ls('dp_mb_pref_span'), qc_span_config: ls('qc_span_config') },
      kacheln: ['dealpilot', 'import', 'voice', 'immometrica', 'gefuehrt'].filter(rhGewaehlt) };
    await rhLaden();
    rhSpion(); rhMikroAn();
    try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
    reiter('s0');
    var kn = sbKnopf('new')();
    if (kn) kn.click(); else if (typeof window.sbActionsAction === 'function') sbActionsAction('new');
    await warteAuf(function () { return DPM_REIHE.angelegt.length >= 1 && /Neues Objekt/.test((q('#hdr-obj') || {}).textContent || ''); }, 9000);
    await warte(700);
    rhNur([]);
    var m = q('.main-col'); if (m) m.scrollTop = 0;
  }
  function rhAufraeumen() {
    var r = _rh; _rh = null;
    var c = q('#oabi-ov #oabi-cancel'); if (c) { try { c.click(); } catch (e) {} }
    var ov = q('#oabi-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    var ic = q('#imo-cancel'); if (ic) { try { ic.click(); } catch (e) {} }
    var im = q('#imo-ov'); if (im && im.parentNode) im.parentNode.removeChild(im);
    var mb = q('#dp-mba [data-mba="schliessen"], #dp-mba [data-mba="hintergrund"]'); if (mb) { try { mb.click(); } catch (e) {} }
    var hu = q('#dpm-huelle'); if (hu && hu.parentNode) hu.parentNode.removeChild(hu);
    kegelHoch(false);
    if (!r) return;
    _rhNachlauf = Date.now() + 6000;   /* ein Fenster, das beim Schließen weiterläuft, kostet trotzdem nichts */
    rhMikroAus();
    function ls(k, v) { try { if (v === null) localStorage.removeItem(k); else if (v !== undefined) localStorage.setItem(k, v); } catch (e) {} }
    var zurueck = function () {
      Object.keys(r.merker).forEach(function (k) { ls(k, r.merker[k]); });
      if (r.seqKey) ls(r.seqKey, r.seq);
    };
    zurueck(); setTimeout(zurueck, 2500);
    try { rhNur(r.kacheln); } catch (e) {}
    (async function () {
      await new Promise(function (ok) { setTimeout(ok, 900); });
      var ids = DPM_REIHE.angelegt.slice();
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        try {
          if (window._currentObjKey === id && typeof window.delSaved === 'function') {
            var oc = window.confirm; window.confirm = function () { return true; };
            try { await window.delSaved(id); } finally { window.confirm = oc; }
          } else await Auth.apiCall('/objects/' + id, { method: 'DELETE' });
          DPM_REIHE.geloescht.push(id);
        } catch (e) { DPM_REIHE.geloescht.push('FEHLER ' + id + ' ' + (e && e.message)); }
      }
      try { if (typeof window.renderSaved === 'function') window.renderSaved({ forceFresh: true, _immediate: true }); } catch (e) {}
      zurueck();
      try { if (window.DealPilotObjektReiter) DealPilotObjektReiter.zielSetzen(parseInt(r.merker.dp_zielstufe, 10) || 1); } catch (e) {}
      ls('dp_zielstufe', r.merker.dp_zielstufe);
      await new Promise(function (ok) { setTimeout(ok, Math.max(0, _rhNachlauf - Date.now())); });
      /* GEMESSEN (Esc während Stufe 2): der gespielte Stream lief nach dem
         Abbruch zu Ende, der Auftrag wurde als „fertig, ungesehen" gemerkt
         und stand beim nächsten Laden als „Marktbericht fertig … öffnen"
         im Bild - mitten in der nächsten Aufnahme. Erst warten, bis kein
         Auftrag dieses Laufs mehr läuft, dann alle dieses Laufs entfernen. */
      try {
        var M = window.MbAuftrag, t0 = Date.now();
        while (M && Date.now() - t0 < 15000 && M.liste().some(function (a) { return a.start >= r.start && a.status === 'laeuft'; })) await new Promise(function (ok) { setTimeout(ok, 500); });
        if (M) M.liste().forEach(function (a) { if (a.start >= r.start) M.abbrechen(a.id); });
      } catch (e) {}
      zurueck();
      rhSpionAus();
      DPM_REIHE.fertig = Date.now();
    })();
    reiter('s0');
  }
  /* Abruf einer Stufe über ihren Knopf, dann warten, bis das Fenster zu ist */
  async function rhStufeAbrufen(s, zeigeModal) {
    var n0 = ((_rh && _rh.berichte) || []).length;
    var b = q('#oe-stufen [data-oe-stufe="' + s + '"]'); if (b) b.click();
    await warteAuf(function () { return q('#dp-mba .k'); }, 5000);
    if (zeigeModal) {
      kegelHoch(true);
      await zeige(function () { return q('#dp-mba .k'); }, 8);
      zeigeModal();
    }
    await warteAuf(function () { return _rh && _rh.berichte.length > n0 && !q('#dp-mba .k') && mbKarteH() && mbKarteH().stufe === s; }, 30000);
    kegelHoch(false);
    await warte(800);
  }
  /* der Knopf der Karte; gemessen lag er bei einem Lauf mit 0 px Breite vor
     - geklickt wird er trotzdem (der Handler hängt am Dokument). Was dabei
     passiert ist, steht in DPM_REIHE.uebernahme. */
  function kartenUebernehmen() {
    var b = [].filter.call(document.querySelectorAll('#avsec [data-apply="dp"]'), function (x) { return /übernehmen/.test(x.textContent); });
    var vis = b.filter(function (x) { return x.offsetWidth; })[0] || b[0];
    if (vis) vis.click();
    DPM_REIHE.uebernahme = (DPM_REIHE.uebernahme || []).concat([{ knoepfe: b.length, sichtbar: !!(vis && vis.offsetWidth), sv: wert('svwert') }]);
    return !!vis;
  }
  /* die Stufe wählen, ohne zum ersten fehlenden Feld zu springen: der Knopf
     „was fehlt" wechselt dafür den Reiter - gemessen sprang Stufe 2 nach
     Investition, und alle folgenden Kegel lagen auf verborgenen Feldern */
  async function stufeWaehlen(n) {
    var p = q('#oab-dp-stufen [data-oe-ziel="' + n + '"]');
    if (p) p.click(); else { try { DealPilotObjektReiter.zielSetzen(n); } catch (e) {} }
    await warte(700);
    if (!q('#s0.active')) reiter('s0');
  }
  function kartenText(re) { var a = q('#avsec'); var t = a ? a.innerText.replace(/\s+/g, ' ') : ''; var m = re.exec(t); return m ? m[1].trim() : null; }

  /* ── MODUL 03 · DATENAUFNAHME: VIER WEGE ─────────────────────────── */
  DREHBUECHER['reihe-datenaufnahme'] = {
    titel: 'Datenaufnahme: vier Wege',
    unterzeile: 'Exposé · Sprache · ImmoMetrica · Geführte Eingabe',
    objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · die Leiste */
        await rhStart(2);
        await zeige(function () { return q('#oab-bar'); }, 8);
        var wege = ['import', 'voice', 'immometrica', 'gefuehrt'].filter(function (x) { return rhKachel(x)(); }).map(rhNameKachel);
        await b2oZeile(s, 'Die Datenaufnahme', 'Oben im Reiter Objekt: <b>' + wege.length + ' Wege</b>, wie Daten ins Objekt kommen — ' + wege.join(' · ') + '.');
      },
      async function (s) {   /* 2 · anhaken, abrufen */
        await zeige(function () { return b2oHuelle(rhKachel('import')(), q('#oab-run')); }, 8);
        await b2oZeile(s, 'Anhaken, dann Abrufen', 'Einen Weg oder mehrere anhaken und <b>Abrufen</b> drücken. Mehrere laufen nacheinander: erst Dokumente, dann Sprache.');
      },
      async function (s) {   /* 3 · Exposé / Marktbericht */
        rhNur(['import']);
        await zeige(rhKachel('import'), 8);
        s.zeile('Weg 1 · ' + rhNameKachel('import'), 'Kachel anhaken, <b>Abrufen</b> — das Fenster öffnet sich.');
        await warte(2900);
        var r = q('#oab-run'); if (r) r.click();
        await warteAuf(function () { return q('#oabi-ov #oabi-drop'); }, 5000);
        kegelHoch(true);
        await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 6);
        await b2oZeile(s, 'Weg 1 · ' + rhNameKachel('import'), 'PDFs hineinziehen — Exposé, Marktbericht, Unterlagen. DealPilot erkennt den Typ, auch bei Scans.');
        try { ObjectActions._voice.wiedergabe(window.DPM_REIHE_DATEN.expose); } catch (e) {}
        await warteAuf(function () { return q('#oabi-ov #oabi-result tr'); }, 4000);
        await warte(600);
        await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 6);
        var n = [].filter.call(document.querySelectorAll('#oabi-ov #oabi-result tr'), function (x) { return x.offsetWidth && x.querySelector('input[type=checkbox]'); }).length;
        await b2oZeile(s, 'Weg 1 · ' + rhNameKachel('import'), 'Aus einem Beispiel-Exposé gelesen: <b>' + n + ' Werte</b> — Adresse, Fläche, Baujahr, Kaufpreis, Hausgeld, Energie. Du hakst ab, was ins Objekt geht.');
        var c = q('#oabi-ov #oabi-cancel'); if (c) c.click();
        kegelHoch(false);
        await warte(700);
      },
      async function (s) {   /* 4 · Sprache */
        rhNur(['voice']);
        await zeige(rhKachel('voice'), 8);
        s.zeile('Weg 2 · ' + rhNameKachel('voice'), 'Kachel anhaken, <b>Abrufen</b> — das Fenster öffnet sich.');
        await warte(2900);
        var r = q('#oab-run'); if (r) r.click();
        await warteAuf(function () { return q('#oabi-ov #vi-live'); }, 6000);
        kegelHoch(true);
        var det = q('#oabi-ov details.vi-transcript'); if (det) det.open = true;
        await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 4);
        await b2oZeile(s, 'Weg 2 · ' + rhNameKachel('voice'), 'Einfach erzählen. Die Mitschrift läuft mit, erkannte Angaben werden grün.');
        await warteAuf(function () { return _rh && _rh.spr >= 2 && /Obergeschoss/.test((q('#vi-live') || {}).value || ''); }, 20000);
        await warte(2600);
        var z = rhIm('#oabi-ov', /\d+\s*von\s*\d+\s*Angaben/i), m = z && /(\d+)\s*von\s*(\d+)\s*Angaben/i.exec(z.textContent);
        await zeige(function () { return q('#oabi-ov details.vi-transcript') || q('#oabi-ov .oabi-modal'); }, 6);
        await b2oZeile(s, 'Weg 2 · ' + rhNameKachel('voice'), 'Zwei Sätze gesprochen' + (m ? ' — <b>' + m[1] + ' von ' + m[2] + '</b> Angaben schon erkannt' : '') + '. Das ganze Beispiel zeigt Modul 05.');
        var c = q('#oabi-ov #oabi-cancel'); if (c) c.click();
        kegelHoch(false);
        await warte(700);
      },
      async function (s) {   /* 5 · ImmoMetrica */
        rhNur(['immometrica']);
        await zeige(rhKachel('immometrica'), 8);
        s.zeile('Weg 3 · ' + rhNameKachel('immometrica'), 'Kachel anhaken, <b>Abrufen</b> — das Fenster öffnet sich.');
        await warte(2900);
        var r = q('#oab-run'); if (r) r.click();
        await warteAuf(function () { return q('#imo-src .imo-pill'); }, 6000);
        kegelHoch(true);
        await warte(500);
        await zeige('#imo-src', 8);
        await b2oZeile(s, 'Weg 3 · ' + rhNameKachel('immometrica'), 'Deine Favoriten und gespeicherten Suchen — Inserate aus allen Portalen.');
        var pill = [].filter.call(document.querySelectorAll('#imo-src .imo-pill'), function (x) { return /Suche/.test(x.textContent); })[0];
        if (pill) pill.click();
        await warteAuf(function () { return q('#imo-list .imo-o[data-i="3"]'); }, 6000);
        await warte(500);
        var o = q('#imo-list .imo-o[data-i="3"]'); if (o) o.click();
        await warte(900);
        await zeige(function () { return q('#imo-ov .imo-body') || q('#imo-detail'); }, 6);
        /* die Trefferzahl so, wie das Fenster sie zeigt („5 von 1.527 geladen") */
        var nt = (function () { var e = rhIm('#imo-ov', /von\s+[\d.]+\s+geladen/); var m = e && /von\s+([\d.]+)\s+geladen/.exec(e.textContent); return m ? de(parseInt(m[1].replace(/\./g, ''), 10)) : null; })();
        await b2oZeile(s, 'Weg 3 · ' + rhNameKachel('immometrica'), (nt ? 'Eine gespeicherte Suche: <b>' + nt + ' Treffer</b>. ' : '') + 'Ein Klick aufs Inserat — Ort, Fläche, Baujahr und Preis gehen ins Objekt.');
        var c = q('#imo-cancel'); if (c) c.click();
        kegelHoch(false);
        await warte(700);
      },
      async function (s) {   /* 6 · Geführte Eingabe */
        rhNur(['gefuehrt']);
        await zeige(rhKachel('gefuehrt'), 8);
        s.zeile('Weg 4 · ' + rhNameKachel('gefuehrt'), 'Kachel anhaken, <b>Abrufen</b> — das Fenster öffnet sich.');
        await warte(2900);
        var r = q('#oab-run'); if (r) r.click();
        await warteAuf(function () { return q('#oabi-ov #vi-rf-in'); }, 6000);
        kegelHoch(true);
        await warte(600);
        await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 4);
        var b1 = rhIm('#oabi-ov', /\d+\s*Fragen in\s*\d+\s*Etappen/), m = b1 && /(\d+)\s*Fragen in\s*(\d+)\s*Etappen/.exec(b1.textContent);
        await b2oZeile(s, 'Weg 4 · ' + rhNameKachel('gefuehrt'), (m ? '<b>' + m[1] + ' Fragen in ' + m[2] + ' Etappen</b>' : 'Frage für Frage') + ' — DealPilot fragt, du sprichst oder tippst.');
        var inp = q('#vi-rf-in');
        await zeige(function () { return q('#vi-rf-in'); }, 8);
        if (inp) {
          var t = window.DPM_REIHE_DATEN.gefuehrt.text;
          for (var i = 0; i < t.length; i++) { inp.value = t.slice(0, i + 1); inp.dispatchEvent(new Event('input', { bubbles: true })); await warte(70); }
          await warte(500);
          var ok = q('#vi-rf-ok'); if (ok) ok.click();
        }
        var ja = await warteAuf(function () { return [].filter.call(document.querySelectorAll('#oabi-ov button'), function (x) { return /Ja, stimmt/.test(x.textContent) && x.offsetWidth; })[0]; }, 8000);
        await zeige(function () { return rhIm('#oabi-ov', /Ich habe verstanden/) && rhIm('#oabi-ov', /Ich habe verstanden/).closest('div[class]'); }, 8);
        await b2oZeile(s, 'Weg 4 · ' + rhNameKachel('gefuehrt'), 'Erste Frage: die Adresse. DealPilot wiederholt, was es verstanden hat — du bestätigst.');
        if (ja) ja.click();
        await warte(1200);
        await zeige(function () { var e = rhIm('#oabi-ov', /Was schon steht/i); return e && (e.closest('aside') || e.parentElement); }, 6);
        await b2oZeile(s, 'Weg 4 · ' + rhNameKachel('gefuehrt'), 'Rechts wächst mit, was schon steht. Was du nicht weißt, überspringst du einfach.');
        var c = q('#oabi-ov #oabi-cancel'); if (c) c.click();
        kegelHoch(false);
        await warte(700);
      },
      async function (s) {   /* 7 · und die Marktbewertung */
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#oab-dp-stufen') && q('#oab-dp-stufen').closest('.dp-pf-tile'); }, 8);
        await b2oZeile(s, 'Dazu die Marktbewertung', 'Die DealPilot-Kachel holt Marktwert und Miete — in <b>drei Stufen</b>. Das zeigt Modul 04.');
      }
    ]
  };

  /* ── MODUL 04 · MARKTBEWERTUNG IN DREI STUFEN ────────────────────── */
  DREHBUECHER['reihe-stufen'] = {
    titel: 'Marktbewertung in drei Stufen',
    unterzeile: 'Was jede Stufe braucht — und was sie liefert',
    objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · drei Stufen */
        await rhStart(0);
        try { DealPilotObjektReiter.zielSetzen(1); } catch (e) {}
        await warte(600);
        await zeige(function () { return q('#oe-abruf-box'); }, 8);
        var f = [kontingentFrei(1), kontingentFrei(2), kontingentFrei(3)];
        await b2oZeile(s, 'Drei Stufen', 'Je tiefer die Stufe, desto mehr Angaben — und desto mehr Ergebnis.' + (f[0] ? ' Frei im Plan: <b>' + f.join(' · ') + '</b>.' : ''));
      },
      async function (s) {   /* 2 · Stufe 1 braucht */
        await stufeWaehlen(1);
        await zeige(function () { return q('#oe-fehlt'); }, 8);
        var l = feldNamen(fehlt(1));
        await b2oZeile(s, 'Stufe 1 · Einfach', 'Braucht <b>' + l.length + ' Angaben</b>: ' + l.join(', ') + '.');
      },
      async function (s) {   /* 3 · ausfüllen, abrufen */
        await zeigeGruppe(feldVon('plz'), feldVon('etage'), 8);
        s.zeile('Stufe 1 · Einfach', 'Die Wohnung aus Modul 02, kurz eingetippt.');
        await tippeH('plz', '32052'); await tippeH('ort', 'Herford'); await tippeH('str', 'Sachsenstraße', 60); await tippeH('hnr', '18');
        await tippeH('objart', 'ETW'); await tippeH('wfl', '100'); await tippeH('baujahr', '1998');
        await warte(900);
        await warteAuf(function () { var r = stufeZeile(1)(); return r && /bereit/.test(r.textContent); }, 5000);   /* die Zeile zieht verzögert nach */
        await zeige(stufeZeile(1), 8);
        await b2oZeile(s, 'Stufe 1 · Einfach', fehlt(1).length ? 'Noch offen: ' + feldNamen(fehlt(1)).join(', ') + '.'
          : '<b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('wfl') + ' m², Baujahr ' + wert('baujahr') + ' — <b>bereit</b>.');
        await rhStufeAbrufen(1, function () { s.zeile('Stufe 1 · Marktpreisindikation', 'Standort, Vergleichspreise, Mieten, Lage — Etappe für Etappe.'); });
      },
      async function (s) {   /* 4 · Ergebnis Stufe 1, Abschlag */
        var k = mbKarteH() || {};
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#avsec'); }, 8);
        await b2oZeile(s, 'Ergebnis Stufe 1', 'Marktwert <b>' + eur(k.mw && k.mw.med) + '</b> (Spanne ' + eur(k.mw && k.mw.low) + ' – ' + eur(k.mw && k.mw.high) + '), Marktmiete <b>' + eur(k.mm && k.mm.med) + '</b> kalt.');
        if (k.abschlag && k.abschlag.roh) {
          await zeige(function () { return q('#avsec .dp-abschlag') || q('#avsec .legal') || q('#avsec'); }, 10);
          await b2oZeile(s, 'Der Abschlag', 'Geschätzt aus <b>Angebotspreisen</b> (' + eur(k.abschlag.roh.med) + ') — DealPilot zieht <b>' + String(k.abschlag.pct).replace('.', ',') + ' %</b> ab (' + k.abschlag.quelle + ').');
        }
        kartenUebernehmen();
        await warte(900);
        await zeige(feldVon('svwert'), 10);
        await warte(1400);
        var b = svBeschriftung();
        await b2oZeile(s, 'Im Feld', '„<b>' + b.titel + '</b> ' + b.hinweis + '“ — <b>' + eur(zahl('svwert')) + '</b>.');
      },
      async function (s) {   /* 5 · Stufe 2 braucht */
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await stufeWaehlen(2);
        await zeige(function () { return q('#oe-fehlt'); }, 8);
        var l = feldNamen(fehlt(2));
        await b2oZeile(s, 'Stufe 2 · Mittel', 'Dazu <b>' + l.length + ' Angaben</b>: ' + l.join(', ') + '.');
        await zeigeGruppe(feldVon('zimmer'), feldVon('standardstufe'), 8);
        s.zeile('Stufe 2 · Mittel', 'Eingetippt — Kaufpreis und Miete stehen in den Reitern Investition und Miete.');
        await tippeH('kp', '180000', 40); await tippeH('nkm', '900', 40);
        await tippeH('zimmer', '3'); await tippeH('etage', '1');
        await tippeH('ds2_zustand', 'gut'); await tippeH('ds2_energie', 'C'); await tippeH('standardstufe', '3');
        await warte(1000);
        await warteAuf(function () { var r = stufeZeile(2)(); return r && /bereit/.test(r.textContent); }, 5000);   /* die Zeile zieht verzögert nach */
        await zeige(stufeZeile(2), 8);
        await b2oZeile(s, 'Stufe 2 · Mittel', fehlt(2).length ? 'Noch offen: ' + feldNamen(fehlt(2)).join(', ') + '.'
          : 'Kaufpreis <b>' + eur(zahl('kp')) + '</b>, Kaltmiete <b>' + eur(zahl('nkm')) + '</b> — <b>bereit</b>.');
        await rhStufeAbrufen(2, function () { s.zeile('Stufe 2 · erweiterte Indikation', 'Dazu Makrolage und der Abgleich mit deinem Preis.'); });
      },
      async function (s) {   /* 6 · Ergebnis Stufe 2 */
        var k = mbKarteH() || {};
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#avsec'); }, 8);
        var ein = kartenText(/EINORDNUNG\s+(.+?)\s+GENAUIGKEIT/i), gen = kartenText(/GENAUIGKEIT\s+(\S+)/i);
        await b2oZeile(s, 'Ergebnis Stufe 2', 'Marktwert <b>' + eur(k.mw && k.mw.med) + '</b> nach Abschlag' + (ein ? ' — gegen deinen Kaufpreis von ' + eur(zahl('kp')) + ': <b>' + ein + '</b>' : '') + (gen ? ', Genauigkeit ' + gen : '') + '.');
        kartenUebernehmen();
        await warte(900);
        await zeige(feldVon('svwert'), 10);
        await warte(1600);
        var b = svBeschriftung();
        await b2oZeile(s, 'Im Feld', 'Weiter eine <b>' + b.titel + '</b> ' + b.hinweis + ': ' + eur(zahl('svwert')) + '.');
      },
      async function (s) {   /* 7 · Stufe 3 braucht */
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await stufeWaehlen(3);
        await zeige(function () { return q('#oe-fehlt'); }, 8);
        var l = feldNamen(fehlt(3));
        var brw = wert('brw');
        await b2oZeile(s, 'Stufe 3 · Ausgiebig', 'Für die Wertermittlung noch <b>' + l.length + ' Angaben</b>: ' + l.join(', ') + '.' + (brw ? ' Den Bodenrichtwert (' + brw + ' €/m²) hat DealPilot schon geholt.' : ''));
        var ids = fehlt(3), wertVon = { gsfl: '1200', mea: '12', bgf: '135', brw: '190', nutzungsart: 'kapitalanlage' };
        s.zeile('Stufe 3 · Ausgiebig', 'Eingetippt: Nutzung, Grundstück, Miteigentumsanteil, Bruttogrundfläche.');
        for (var i = 0; i < ids.length; i++) {
          if (!wertVon[ids[i]]) continue;
          await zeige(feldVon(ids[i]), 10);
          await tippeH(ids[i], wertVon[ids[i]]);
        }
        await warte(900);
        await warteAuf(function () { var r = stufeZeile(3)(); return r && /bereit/.test(r.textContent); }, 5000);   /* die Zeile zieht verzögert nach */
        await zeige(stufeZeile(3), 8);
        await b2oZeile(s, 'Stufe 3 · Ausgiebig', fehlt(3).length ? 'Noch offen: ' + feldNamen(fehlt(3)).join(', ') + '.'
          : 'Grundstück ' + de(zahl('gsfl')) + ' m², Anteil ' + wert('mea') + ' %, BGF ' + wert('bgf') + ' m² — <b>bereit</b>.');
        await rhStufeAbrufen(3, function () { s.zeile('Stufe 3 · Wertermittlung', 'Bodenwert, Liegenschaftszins, Restnutzungsdauer — nach ImmoWertV.'); });
      },
      async function (s) {   /* 8 · Ergebnis Stufe 3: Verkehrswert */
        await warteAuf(function () { var w = q('#oe-vw-wahl'); return w && w.options.length >= 2; }, 8000);
        await zeige(function () { return q('#oe-vw'); }, 10);
        var opts = [].map.call((q('#oe-vw-wahl') || { options: [] }).options, function (o) { return o.textContent; });
        var ew = opts.filter(function (t) { return /^Ertragswert/.test(t); })[0], sw = opts.filter(function (t) { return /^Sachwert/.test(t); })[0];
        function betrag(t) { var m = t && /·\s*([\d.]+ €)/.exec(t); return m ? m[1] : null; }
        await b2oZeile(s, 'Ergebnis Stufe 3', 'Nach ImmoWertV gerechnet: Ertragswert <b>' + betrag(ew) + '</b>' + (sw ? ', vorläufiger Sachwert ' + betrag(sw) : '') + '. Welchen Wert du ansetzt, entscheidest du.');
        var sel = q('#oe-vw-wahl');
        if (sel) { var ix = [].findIndex.call(sel.options, function (o) { return /^Ertragswert/.test(o.textContent); }); if (ix >= 0) { sel.selectedIndex = ix; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
        await warte(900);
        await zeige(function () { return q('#oe-vw-btn'); }, 8);
        await warte(1400);
        var bt = q('#oe-vw-btn'); if (bt) bt.click();
        await warte(1800);
        await zeige(feldVon('svwert'), 10);
        await warte(1200);
        var b = svBeschriftung();
        await b2oZeile(s, 'Erst jetzt: Verkehrswert', '„<b>' + b.titel + '</b> ' + b.hinweis + '“ — <b>' + eur(zahl('svwert')) + '</b>, der Ertragswert aus Stufe 3.', 1200);
      }
    ]
  };

  /* ── MODUL 05 · KOMPLETTBEISPIEL: SPRACHE + STUFE 2 ─────────────── */
  DREHBUECHER['reihe-sprache-stufe2'] = {
    titel: 'Komplettbeispiel: Sprache + Stufe 2',
    unterzeile: 'Erzählen, übernehmen, einschätzen',
    objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · Stufe 2 wählen */
        await rhStart(5);
        try { DealPilotObjektReiter.zielSetzen(1); } catch (e) {}
        await zeige(function () { return q('#oab-bar'); }, 8);
        await b2oZeile(s, 'Komplettbeispiel', 'Eine Wohnung, nur erzählt — und gleich mit der Marktbewertung <b>Stufe 2</b>.');
        await zeige(function () { return q('#oab-dp-stufen'); }, 10);
        await warte(900);
        var p = q('#oab-dp-stufen [data-oe-ziel="2"]'); if (p) p.click();
        await warte(700);
        await b2oZeile(s, 'Stufe 2 wählen', 'Mittel · Stufe 2: die erweiterte Indikation — mit Kaufpreis, Miete, Zustand, Energie und Ausstattung.');
      },
      async function (s) {   /* 2 · Sprache und DealPilot anhaken, Abrufen */
        rhNur(['dealpilot', 'voice']);
        await zeige(function () { return b2oHuelle(rhKachel('dealpilot')(), rhKachel('voice')()); }, 8);
        await b2oZeile(s, 'Anhaken', '<b>DealPilot</b> und <b>' + rhNameKachel('voice') + '</b> angehakt — erst wird erzählt, dann bewertet.');
        await zeige(function () { return q('#oab-run'); }, 8);
        await warte(1200);
        var r = q('#oab-run'); if (r) r.click();
        await warteAuf(function () { return q('#oabi-ov #vi-live'); }, 6000);
      },
      async function (s) {   /* 3 · einsprechen */
        kegelHoch(true);
        var det = q('#oabi-ov details.vi-transcript'); if (det) det.open = true;
        await warte(500);
        await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 4);
        s.zeile('Das Fenster hört zu', 'Sprich einfach los — die Mitschrift läuft live mit.');
        await warteAuf(function () { return _rh && _rh.spr >= 2; }, 20000);
        await zeige(function () { return q('#oabi-ov details.vi-transcript') || q('#oabi-ov .oabi-modal'); }, 6);
        s.zeile('Eingesprochen', 'Adresse, Fläche, Baujahr, Zimmer, Etage — erkannte Angaben werden grün.');
        await warteAuf(function () { return _rh && _rh.spr >= 5 && ((q('#vi-live') || {}).value || '').length >= window.DPM_REIHE_DATEN.sprache.text.join(' ').length; }, 40000);
        await warte(2800);
        var z = rhIm('#oabi-ov', /\d+\s*von\s*\d+\s*Angaben/i), m = z && /(\d+)\s*von\s*(\d+)\s*Angaben/i.exec(z.textContent);
        await b2oZeile(s, 'Eingesprochen', 'Zustand, Energie, Standardstufe, Miete, Hausgeld, Kaufpreis' + (m ? ' — <b>' + m[1] + ' von ' + m[2] + '</b> Angaben erkannt' : '') + '.');
        var nx = q('#vi-next'); if (nx) nx.click();
      },
      async function (s) {   /* 4 · ausgewertet, erste Rechnung */
        var b = await warteAuf(function () { return rhIm('#oabi-ov', /Angaben aus deiner Aufnahme/); }, 12000);
        await warte(800);
        await zeige(function () { var e = rhIm('#oabi-ov', /Angaben aus deiner Aufnahme/); return e && (e.closest('[class*="blase"],[class*="bubble"]') || e); }, 8);
        var m = b && /(\d+)\s*Angaben aus deiner Aufnahme/.exec(b.textContent);
        await b2oZeile(s, 'Ausgewertet', (m ? '<b>' + m[1] + ' Angaben</b> aus der Aufnahme gelesen' : 'Ausgewertet') + '. Was noch fehlt, fragt DealPilot nach — oder du gehst gleich zur Übersicht.');
        var f = q('#vi-rf-ende'); if (f) f.click();
        /* die Karte „Investor Deal Score 2.0" (voice-import.js _scoreKopf):
           Zahl aus data-ziel (sie zählt hoch), Wort aus der Pille. GEMESSEN:
           die ganze Karte ist höher als das Bild (Kegel lag mit der Zahl
           oberhalb des Rands) - gezeigt wird Kopf bis Fazit. */
        function ds2() { return [].filter.call(document.querySelectorAll('#oabi-ov .vi-sc'), function (e) { var t = e.querySelector('.vi-sc-titel'); return t && /Investor Deal Score/i.test(t.textContent) && e.offsetWidth; })[0] || null; }
        await warteAuf(ds2, 6000);
        await warte(500);
        await zeigeGruppe(function () { var e = ds2(); return e && e.querySelector('.vi-sc-kopf'); }, function () { var e = ds2(); return e && (e.querySelector('.vi-sc-fazit') || e.querySelector('.vi-sc-bar')); }, 8);
        var k2 = ds2(), n2 = k2 && k2.querySelector('.vi-sc-zahl-n'), w2 = k2 && k2.querySelector('.vi-sc-pille');
        var zahl2 = n2 ? n2.getAttribute('data-ziel') : null, wort2 = w2 ? w2.textContent.trim() : '';
        await b2oZeile(s, 'Erste Einschätzung', 'Schon im Fenster gerechnet: Investor Deal Score' + (zahl2 ? ' <b>' + zahl2 + '</b>' : '') + (wort2 ? ' · ' + wort2.charAt(0) + wort2.slice(1).toLowerCase() : '') + ' — dazu die Hebel, die den Score heben.');
      },
      async function (s) {   /* 5 · Übersicht, übernehmen */
        var b = [].filter.call(document.querySelectorAll('#oabi-ov button'), function (x) { return /Zur Übersicht — Werte/.test(x.textContent) && x.offsetWidth; })[0];
        if (b) b.click();
        await warteAuf(function () { return q('#oabi-ov #oabi-apply'); }, 6000);
        await warte(700);
        await zeige(function () { return q('#oabi-ov .oabi-modal'); }, 4);
        var n = [].filter.call(document.querySelectorAll('#oabi-ov .oabi-tbl tr'), function (x) { return x.offsetWidth && x.querySelector('input[type=checkbox]'); }).length;
        await b2oZeile(s, 'Die Übersicht', '<b>' + n + ' Werte</b> mit Herkunft — was DealPilot geschätzt hat, steht dabei. Abhaken, übernehmen.');
        await zeige(function () { return q('#oabi-apply'); }, 8);
        await warte(1300);
        var ap = q('#oabi-apply'); if (ap) ap.click();
        kegelHoch(false);
        await warteAuf(function () { return !q('#oabi-ov') && /Sachsen/.test(wert('str')); }, 8000);
        await warte(900);
      },
      async function (s) {   /* 6 · Werte in den Feldern, Stufe 2 läuft */
        /* GEMESSEN: die Stufe 2 startet sofort nach der Übernahme - erst das
           Fenster zeigen, danach die Felder (die Zeile dazu stand sonst 0,9 s) */
        var mod = await warteAuf(function () { return q('#dp-mba .k'); }, 12000);
        if (mod) {
          kegelHoch(true);
          await zeige(function () { return q('#dp-mba .k'); }, 8);
          s.zeile('Stufe 2 läuft', 'Erweiterte Marktpreisindikation — mit allem, was du gerade erzählt hast.');
        }
        await warteAuf(function () { return _rh && _rh.berichte.length >= 1 && !q('#dp-mba .k') && mbKarteH() && mbKarteH().stufe === 2; }, 30000);
        kegelHoch(false);
        await warte(700);
        if (!q('#s0.active')) reiter('s0');
        await zeigeGruppe(feldVon('plz'), feldVon('ds2_energie'), 8);
        var oa = (function () { var e = document.getElementById('objart'); return e && e.selectedIndex >= 0 ? e.options[e.selectedIndex].text : wert('objart'); })();
        await b2oZeile(s, 'In den Feldern', '<b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + oa + ', ' + wert('wfl') + ' m², Baujahr ' + wert('baujahr') + ', Zustand und Energie — alles aus dem Gesagten.');
      },
      async function (s) {   /* 7 · Einschätzung */
        var k = mbKarteH() || {};
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#avsec'); }, 8);
        var ein = kartenText(/EINORDNUNG\s+(.+?)\s+GENAUIGKEIT/i);
        await b2oZeile(s, 'Die Einschätzung', 'Marktwert <b>' + eur(k.mw && k.mw.med) + '</b>' + (k.abschlag ? ' (nach ' + String(k.abschlag.pct).replace('.', ',') + ' % Abschlag auf Angebotspreise)' : '') + (ein ? ' — dein Kaufpreis ' + eur(zahl('kp')) + ': <b>' + ein + '</b>' : '') + '. Marktmiete ' + eur(k.mm && k.mm.med) + '.');
        kartenUebernehmen();
        await warte(900);
        await zeige(feldVon('svwert'), 10);
        await warte(1600);
        var b = svBeschriftung();
        await b2oZeile(s, 'Übernommen', '„<b>' + b.titel + '</b> ' + b.hinweis + '“: ' + eur(zahl('svwert')) + '. Erzählt, bewertet, eingeordnet.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · MODULE 06 – 10 (v2257) ═══════════════════════════════
     Die Reiter Investition, Miete, Finanzierung, Bewirtschaftung, Steuer -
     Modul 10 geteilt in 10a (AfA, Zeitraeume, Restnutzungsdauer) und 10b
     (BMF-Kaufpreisaufteilung). Je Drehbuch EIN neues Objekt (rhStart), am
     Ende geloescht (rhAufraeumen, auch bei Esc). Die Wohnung ist dieselbe wie
     in 02-05; sie wird zu Beginn in den Reiter Objekt gesetzt.
     Kosten: keine. BMF wird abgespielt (DPM_REIHE_DATEN.bmf), die RND-
     Gutachten-Anfrage nie abgeschickt (der Knopf wird nur gezeigt, RH_SPERRE
     sperrt /rnd-request, /deal-action/submit und alles mit „gutachten").
     Einstellungen werden nur ANGESEHEN (closeSettings, nie Speichern).
     Hilfsfunktionen tragen das Praefix r6 - im selben Gueltigkeitsbereich
     liegen frei(), zeile(), fehlt() & Co. (v2255f). */
  function r6Setz(id, v) {
    var e = document.getElementById(id); if (!e) return;
    e.value = v;
    ['input', 'change', 'blur'].forEach(function (t) { e.dispatchEvent(new Event(t, { bubbles: true })); });
  }
  function r6Text(e) { return e ? String(e.textContent || '').replace(/[\s\u00a0]+/g, ' ').trim() : ''; }
  /* innerText ohne geschützte Leerzeichen (gemessen: „4,34\u00a0%" - die Muster mit „ %" griffen nicht) */
  function r6Inner(e) { return e ? String(e.innerText || '').replace(/\u00a0/g, ' ') : ''; }
  function r6Id(id) { return r6Text(document.getElementById(id)); }
  /* der Wert neben einer Beschriftung: kleinstes Element mit passendem Text,
     dessen naechstes Geschwister den Wert traegt */
  function r6Neben(wurzel, re) {
    var w = typeof wurzel === 'string' ? q(wurzel) : wurzel; if (!w) return null;
    var best = null;
    [].forEach.call(w.querySelectorAll('*'), function (e) {
      if (!e.offsetWidth || !e.nextElementSibling || !re.test(e.textContent || '')) return;
      if (!best || e.textContent.length < best.textContent.length) best = e;
    });
    return best ? r6Text(best.nextElementSibling) : null;
  }
  function r6Gruppe(id) { return function () { var e = document.getElementById(id); return e && (e.closest('.f') || e.parentElement); }; }
  function r6Karte(wurzel, re) {
    return function () {
      var w = q(wurzel); if (!w) return null;
      var h = [].filter.call(w.querySelectorAll('h3,h4,.ct,.ct-pro'), function (x) { return x.offsetWidth && re.test(x.textContent || ''); })[0];
      return h ? (h.closest('.card,.swk-karte') || h.parentElement) : null;
    };
  }
  function r6Optionstext(id) { var e = document.getElementById(id); return e && e.selectedIndex >= 0 ? r6Text(e.options[e.selectedIndex]) : ''; }
  function r6Pz(s) { return String(s == null ? '' : s).replace('.', ','); }
  /* eine Zeile, während derer etwas passiert (tippen, klicken): sie steht
     mindestens ihre Lesezeit - gemessen standen solche Zeilen nur 3 s */
  function r6Beginn(s, titel, text) { s.zeile(titel, text); return { t0: Date.now(), soll: lies(titel, text) * TEMPO }; }
  async function r6Ende(b) { var rest = b.soll - (Date.now() - b.t0); if (rest > 300) await warte(rest >= 600 * TEMPO ? rest / TEMPO : rest); }
  function r6Knopf(wurzel, re) { var w = typeof wurzel === 'string' ? q(wurzel) : wurzel; return w ? [].filter.call(w.querySelectorAll('button,a'), function (b) { return b.offsetWidth && re.test(b.textContent || ''); })[0] || null : null; }
  /* Einstellungen nur ansehen - nie speichern */
  async function r6Einstellungen(bereich) {
    try { if (typeof window.showSettings === 'function') window.showSettings(bereich); } catch (e) {}
    await warteAuf(function () { return q('.settings-modal .swk-karte, .settings-modal .ip-section, .settings-modal table'); }, 5000);
    kegelHoch(true);
    await warte(700);
  }
  function r6EinstellungenZu() { try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (e) {} kegelHoch(false); }
  function r6SwkWert(karte, re) { return r6Neben(r6Karte('.settings-modal', karte)(), re); }

  /* gemeinsamer Anfang: neues Objekt, die Wohnung aus 02-05 */
  async function r6Start(opt) {
    opt = opt || {};
    await rhStart(0);
    [['plz', '32052'], ['ort', 'Herford'], ['str', 'Sachsenstraße'], ['hnr', '18'], ['objart', 'ETW'],
     ['wfl', '100'], ['baujahr', '1998'], ['zimmer', '3'], ['etage', '1']].forEach(function (x) { r6Setz(x[0], x[1]); });
    if (opt.kaufdat) r6Setz('kaufdat', '2026-11-02');
    if (opt.bmf) { r6Setz('gsfl', '1200'); r6Setz('mea', '12'); }
    if (opt.kp) { r6Setz('kp', '180000'); try { DealPilotInvestmentProfile.nachziehen('kp'); } catch (e) {} }
    if (opt.nkm) { r6Setz('nkm', '900'); try { DealPilotInvestmentProfile.nachziehen('nkm'); } catch (e) {} }
    await warte(900);
    if (opt.kp) { try { if (typeof window.dpDarlehenNachziehen === 'function') window.dpDarlehenNachziehen(); } catch (e) {} }
    /* GEMESSEN (Prueflauf 09): bwk-profil.js setzt die Standardwerte nur nach
       ECHTEN Eingaben in Objektart/Wohnflaeche - gesetzte Felder loesen es
       nicht aus, die Leiste blieb auf „sobald ... stehen". Hier geschieht,
       was eine Eingabe von Hand ausloest (nur leere Felder). */
    try { DealPilotBwkProfil.einsetzen(false); } catch (e) {}
    try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
    await warte(600);
  }
  async function r6Beispiel(s, rest) {
    var m = q('.main-col'); if (m) m.scrollTop = 0;
    await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
    await b2oZeile(s, 'Das Beispiel', 'Die Wohnung aus den Modulen 02–05: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('plz') + ' ' + wert('ort') + ' — ' + r6Optionstext('objart') + ', ' + wert('wfl') + ' m², Baujahr ' + wert('baujahr') + '.' + (rest || ''));
  }

  /* ── MODUL 06 · INVESTITION ───────────────────────────────────── */
  DREHBUECHER['reihe-investition'] = {
    titel: 'Investition', unterzeile: 'Kaufpreis, Nebenkosten, Sanierung und Inventar', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6Start({});
        await r6Beispiel(s, ' Heute: der Reiter <b>Investition</b>.');
      },
      async function (s) {   /* 2 · Kaufpreis */
        reiter('s1'); await warte(700);
        await zeige(r6Gruppe('kp'), 10);
        var zb = r6Beginn(s, 'Der Kaufpreis', 'Eingetippt — alles andere in diesem Reiter rechnet DealPilot daraus.');
        await tippeH('kp', '180000', 80);
        try { DealPilotInvestmentProfile.nachziehen('kp'); } catch (e) {}
        await warte(1200);
        await r6Ende(zb);
        await zeigeGruppe(feldVon('notar_p'), feldVon('ji_e'), 8);
        await b2oZeile(s, 'Schon vorbelegt', 'Kaufpreis <b>' + eur(zahl('kp')) + '</b> — die Nebenkosten stehen sofort da, in Prozent und in Euro.');
      },
      async function (s) {   /* 3 · Makler, Notar, Grundbuch, Sonstige (v2263: alle vier aus den Standardwerten, v2261) */
        await zeigeGruppe(feldVon('makler_p'), feldVon('makler_e'), 8);
        await b2oZeile(s, 'Makler', 'Maklerprovision <b>' + r6Pz(wert('makler_p')) + ' %</b> = ' + eur(zahl('makler_e')) + ' — aus deinen Standardwerten. Ohne Makler einfach auf 0 setzen.');
        await zeigeGruppe(feldVon('notar_p'), feldVon('gba_e'), 8);
        await b2oZeile(s, 'Notar und Grundbuch', 'Notar <b>' + r6Pz(wert('notar_p')) + ' %</b> = ' + eur(zahl('notar_e')) + ', Grundbuchamt <b>' + r6Pz(wert('gba_p')) + ' %</b> = ' + eur(zahl('gba_e')) + ' — beide aus deinen Standardwerten.');
        await zeigeGruppe(feldVon('ji_p'), feldVon('ji_e'), 8);
        await b2oZeile(s, 'Sonstige Kosten', '<b>' + r6Pz(wert('ji_p')) + ' %</b> = ' + eur(zahl('ji_e')) + ' für Bausachverständigen, Anfahrt, Gutachten — ebenfalls vorbelegt, jederzeit änderbar.');
      },
      async function (s) {   /* 4 · Grunderwerbsteuer nach PLZ */
        await zeigeGruppe(feldVon('gest_p'), feldVon('gest_e'), 8);
        var h = q('#s1 .grest-auto-hint'), m = h && /ermittelt:\s*(.+?)\s+([\d.,]+)\s*%/.exec(h.textContent);
        await b2oZeile(s, 'Grunderwerbsteuer', (m ? 'Aus der Postleitzahl ermittelt: <b>' + m[1] + ' ' + r6Pz(m[2]) + ' %</b>' : 'Grunderwerbsteuer <b>' + r6Pz(wert('gest_p')) + ' %</b>') + ' = ' + eur(zahl('gest_e')) + '. Jedes Land hat seinen eigenen Satz.');
      },
      async function (s) {   /* 5 · Summe, Gesamtinvestition */
        await zeigeGruppe(function () { return q('#nk_sum') && q('#nk_sum').closest('.f'); }, function () { return q('#qm_gi') && q('#qm_gi').closest('div'); }, 8);
        await b2oZeile(s, 'Gesamtinvestition', 'Nebenkosten <b>' + r6Id('nk_sum') + '</b> — zusammen <b>' + r6Id('gi_val').replace(/^€\s*/, '') + ' €</b>, das sind ' + r6Id('qm_gi') + '.');
      },
      async function (s) {   /* 6 · woher die Standardwerte kommen */
        await r6Einstellungen('standardwerte');
        await zeige(r6Karte('.settings-modal', /^Standort & Nebenkosten$/), 8);
        var SN = /^Standort & Nebenkosten$/, bl = r6SwkWert(SN, /^Bundesland$/), no = r6SwkWert(SN, /^Notar$/), gb = r6SwkWert(SN, /^Grundbuch$/), so = r6SwkWert(SN, /^Sonstige$/), mk = r6SwkWert(SN, /^Makler$/);
        await b2oZeile(s, 'Woher die Vorbelegung kommt', 'Einstellungen › <b>Standardwerte</b>: Notar ' + (no || '–') + ', Grundbuch ' + (gb || '–') + ', Sonstige ' + (so || '–') + ', Makler ' + (mk || '–') + ' — Bundesland ' + (bl || '–') + '. Gilt für jedes neue Objekt.');
        r6EinstellungenZu();
        await warte(700);
      },
      async function (s) {   /* 7 · Sanierung */
        var t = q('#sanbedarf_toggle'); if (t && !t.checked) t.click();
        await warte(700);
        await zeige(function () { return q('#sanbedarf_body .fesh-grid'); }, 8);
        var zb = r6Beginn(s, 'Sanierung', 'Welche Bereiche müssen gemacht werden? Ein Klick je Gewerk — mit Richtwert.');
        await warte(1800);
        ['fesh_b', 'fesh_e'].forEach(function (id) { var c = document.getElementById(id); if (c && !c.checked) c.click(); });
        await warte(1200);
        var b = document.getElementById('fesh_b_cost'), e = document.getElementById('fesh_e_cost');
        await r6Ende(zb);
        await b2oZeile(s, 'Sanierung', 'Bäder <b>' + eur(zahl('fesh_b_cost')) + '</b> und Elektrik <b>' + eur(zahl('fesh_e_cost')) + '</b> angehakt — Summe <b>' + r6Id('fesh_total') + '</b>. Die Beträge sind änderbar.');
        await zeige(function () { return q('.fesh-apply-btn'); }, 10);
        await warte(1400);
        var ab = q('.fesh-apply-btn'); if (ab) ab.click();
        await warte(1200);
      },
      async function (s) {   /* 8 · was die Sanierung bewirkt */
        await zeige(r6Gruppe('san'), 10);
        var hint = r6Id('san_limit_hint');
        await b2oZeile(s, 'Was sie bewirkt', 'Sanierungskosten <b>' + eur(zahl('san')) + '</b> — sie erhöhen die Gesamtinvestition auf <b>' + r6Id('gi_val').replace(/^€\s*/, '') + ' €</b>.');
        await zeige(function () { return q('#san_tax_active') && q('#san_tax_active').closest('.san-tax-options'); }, 10);
        await b2oZeile(s, 'Und in der Steuer', 'Als Werbungskosten verteilt — ' + (r6Optionstext('san_tax_years') || 'automatisch') + '. ' + (hint ? 'Die 15-%-Grenze prüft DealPilot mit: ' + hint.replace(/\(\s+/g, '(') : ''));
      },
      async function (s) {   /* 9 · Inventar */
        var t = q('#inv_detail_toggle'); if (t && !t.checked) t.click();
        await warte(700);
        await zeigeGruppe(feldVon('inv_kueche'), feldVon('inv_geraete'), 8);
        var zb = r6Beginn(s, 'Inventar', 'Küche und Möbel, die mitverkauft werden — sie stecken im Kaufpreis und werden getrennt vom Gebäude erfasst.');
        await tippeH('inv_kueche', '6000', 90); await tippeH('inv_moebel', '2500', 90);
        await warte(1000);
        await r6Ende(zb);
        await zeige(function () { return q('#inv_sum') && q('#inv_sum').closest('.kv'); }, 10);
        await b2oZeile(s, 'Inventar', 'Küche ' + eur(zahl('inv_kueche')) + ' + Möbel ' + eur(zahl('inv_moebel')) + ' = <b>' + r6Id('inv_sum') + '</b>.');
      },
      async function (s) {   /* 10 · was das Inventar bewirkt */
        var it = q('#inv_tax_active'); if (it && !it.checked) it.click();
        await zeige(function () { return q('#moebl') && q('#moebl').closest('.card'); }, 8);
        await b2oZeile(s, 'Was es bewirkt', 'Eigene Abschreibung über <b>' + r6Optionstext('inv_tax_years') + '</b> — und es zählt nicht zur 15-%-Grenze der Sanierung.');
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#gi_val') && q('#gi_val').closest('.total-bar'); }, 10);
        await b2oZeile(s, 'Gesamtinvestition', 'Kaufpreis (mit Inventar), Nebenkosten und Sanierung: <b>' + r6Id('gi_val').replace(/^€\s*/, '') + ' €</b> — das Inventar zählt nicht doppelt. Die Grundlage für Finanzierung und Steuer.', 600);
      }
    ]
  };

  /* ── MODUL 07 · MIETE UND MIETVERTRAG ─────────────────────────── */
  DREHBUECHER['reihe-miete'] = {
    titel: 'Miete und Mietvertrag', unterzeile: 'Ist-Miete, Marktmiete, Vertragsart, Mietentwicklung', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6Start({ kp: true });
        await r6Beispiel(s, ' Heute: der Reiter <b>Miete</b>.');
      },
      async function (s) {   /* 2 · Nettokaltmiete */
        reiter('s2'); await warte(700);
        await zeige(r6Gruppe('nkm'), 10);
        var zb = r6Beginn(s, 'Die Ist-Miete', 'Was der Mieter heute kalt zahlt — eingetippt.');
        await tippeH('nkm', '900', 90);
        try { DealPilotInvestmentProfile.nachziehen('nkm'); } catch (e) {}
        await tippeH('ze', '40', 90);
        await tippeH('umlagef', '230', 90);
        await warte(1000);
        await r6Ende(zb);
        await zeigeGruppe(feldVon('nkm'), function () { return q('#wm_m') && q('#wm_m').closest('.f'); }, 8);
        await b2oZeile(s, 'Die Ist-Miete', 'Kaltmiete <b>' + eur(zahl('nkm')) + '</b>, Stellplatz ' + eur(zahl('ze')) + ', Nebenkosten-Vorauszahlung ' + eur(zahl('umlagef')) + ' — Warmmiete <b>' + r6Id('wm_m') + '</b>.');
        await zeige(function () { return q('#miete_qm') && q('#miete_qm').closest('.f'); }, 10);
        await b2oZeile(s, 'Pro Quadratmeter', 'Bezogen auf die Wohnfläche aus dem Reiter Objekt: <b>' + r6Id('miete_qm') + '</b> — der Stellplatz zählt mit.');
      },
      async function (s) {   /* 3 · Zensus-Miete */
        await warteAuf(function () { return q('#dp-zi-miete .dp-zi-z'); }, 5000);
        await zeige(function () { return q('#dp-zi-miete'); }, 8);
        var g = r6Neben('#dp-zi-miete', /^Gemeinde/), bj = r6Neben('#dp-zi-miete', /^Baujahr/);
        await b2oZeile(s, 'Was der Bestand zahlt', 'Zensus 2022: in der Gemeinde <b>' + (g || '–') + '</b>' + (bj ? ', für dieses Baujahr ' + bj : '') + ' — laufende Verträge, keine Neuvermietung.');
      },
      async function (s) {   /* 4 · Marktmiete */
        await zeige(r6Gruppe('ds2_marktmiete'), 10);
        var zb = r6Beginn(s, 'Die Marktmiete', 'Was eine Neuvermietung heute bringt — aus der Marktbewertung (Modul 04) oder von dir.');
        var k = window.DPM_REIHE_DATEN && DPM_REIHE_DATEN.mb && DPM_REIHE_DATEN.mb[1];
        var qm = (function () { try { return k.valuation.inputs.market_rent_sqm; } catch (e) { return null; } })();
        if (!(qm > 0)) qm = 8;   /* nur Rückfall, gelesen wird unten aus dem Feld */
        await warte(1600);
        await tippeH('ds2_marktmiete', String(qm).replace('.', ','), 110);
        await warte(1000);
        await r6Ende(zb);
        await b2oZeile(s, 'Die Marktmiete', 'Marktmiete <b>' + wert('ds2_marktmiete') + ' €/m²</b> gegen deine ' + r6Id('miete_qm') + ' — der Abstand fließt in den Investor Deal Score.');
      },
      async function (s) {   /* 5 · Mietausfall-Risiko aus dem Leerstand */
        await warteAuf(function () { return q('#dp-zi-leer .dp-zi-z'); }, 5000);
        await zeige(function () { return q('#dp-zi-leer'); }, 8);
        var l = r6Neben('#dp-zi-leer', /^Marktaktiver Leerstand/), st = r6Neben('#dp-zi-leer', /^Anhalt/);
        await b2oZeile(s, 'Mietausfall-Risiko', 'Marktaktiver Leerstand in Herford: <b>' + (l || '–') + '</b> — Anhalt <b>' + (st || '–') + '</b>. Ein Klick übernimmt die Stufe.');
        var b = q('#dp-zi-leer .dp-zi-btn'); if (b) b.click();
        await warte(1000);
        await zeige(r6Gruppe('ds2_mietausfall'), 10);
        await b2oZeile(s, 'Mietausfall-Risiko', 'Übernommen: <b>' + r6Optionstext('ds2_mietausfall') + '</b>.');
      },
      async function (s) {   /* 6 · Mietvertrag */
        await zeigeGruppe(feldVon('mv_art'), feldVon('mv_letzte_erhoehung'), 8);
        var zb = r6Beginn(s, 'Der Mietvertrag', 'Vertragsart, Beginn und letzte Erhöhung — für jede Objektart.');
        await warte(1500);
        var sel = document.getElementById('mv_art');
        var idx = sel ? [].findIndex.call(sel.options, function (o) { return /Index/i.test(o.textContent); }) : -1;
        if (idx >= 0) { sel.selectedIndex = idx; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await warte(800);
        r6Setz('mv_beginn', '2019-04-01'); await warte(600);
        r6Setz('mv_letzte_erhoehung', '2024-04-01'); await warte(900);
        var n = sel ? sel.options.length : 0;
        await r6Ende(zb);
        await b2oZeile(s, 'Der Mietvertrag', '<b>' + r6Optionstext('mv_art') + '</b> seit 04/2019, zuletzt erhöht 04/2024' + (n ? ' — ' + (n - 1) + ' Vertragsarten zur Auswahl' : '') + '.');
      },
      async function (s) {   /* 7 · Mietentwicklung: Prognose */
        await zeige(function () { return q('#me-block-prog') && q('#me-block-prog').closest('.card'); }, 8);
        await b2oZeile(s, 'Mietentwicklung', 'Prognose: Mietsteigerung <b>' + r6Pz(wert('mietstg')) + ' % im Jahr</b> — vorbelegt aus deinen Standardwerten, bewusst vorsichtig.');
      },
      async function (s) {   /* 8 · Detail: Erhöhungstreppe */
        var b = q('#me-mode-detail'); if (b) b.click();
        await warte(900);
        await zeige(function () { return q('#me-block-detail .g2'); }, 8);
        var zb = r6Beginn(s, 'Oder im Detail', 'Einzelne Erhöhungen, z. B. bei Staffel- oder Indexmiete — gegen den Mietspiegel.');
        await tippeH('me_soll', '8,50', 110);
        await warte(1200);
        await r6Ende(zb);
        await b2oZeile(s, 'Oder im Detail', '<b>' + wert('me_anz') + ' Erhöhungen</b> alle ' + wert('me_int') + ' Jahre, zusammen ' + r6Pz(wert('me_pct')) + ' % — Soll-Mietspiegel ' + wert('me_soll') + ' €/m²' + (r6Id('me_opp') && r6Id('me_opp') !== '—' ? ', Abstand deiner Miete: ' + r6Id('me_opp') : '') + '.');
        var p = q('#me-mode-prog'); if (p) p.click();
        await warte(700);
      },
      async function (s) {   /* 9 · Prognose-Annahmen */
        await zeigeGruppe(feldVon('wertstg'), feldVon('exit_bmy'), 8);
        await zeige(function () { var e = document.getElementById('wertstg'); return e && e.closest('.card'); }, 8);
        await b2oZeile(s, 'Prognose-Annahmen', 'Wertsteigerung ' + r6Pz(wert('wertstg')) + ' %, Leerstand ' + r6Pz(wert('leerstand')) + ' % — aus den Standardwerten. Kostensteigerung ' + r6Pz(wert('kostenstg')) + ' %, Betrachtung ' + wert('btj') + ' Jahre.', 600);
      }
    ]
  };

  /* ── MODUL 08 · FINANZIERUNG ──────────────────────────────────── */
  function r6Rate10() { return { zins: r6Id('mrpf-top-rate-10'), weg: r6Id('mrpf-top-detail-10') }; }
  async function r6Ltv(key) { var b = q('#dpfk-band .dpfk-ltv-btn[data-margin="' + key + '"]'); if (b) b.click(); await warte(900); return r6Rate10(); }
  DREHBUECHER['reihe-finanzierung'] = {
    titel: 'Finanzierung', unterzeile: 'Wie der Zins entsteht — und wo du die Standardwerte setzt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: function () { try { var b = q('#dpfk-band .dpfk-ltv-btn[data-margin="standard"]'); if (b) b.click(); } catch (e) {} var c = q('#v10-market-modal .v10-modal-close'); if (c) { try { c.click(); } catch (e) {} } r6EinstellungenZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6Start({ kp: false, nkm: true });
        await r6Beispiel(s, ' Heute: der Reiter <b>Finanzierung</b>.');
      },
      async function (s) {   /* 2 · Konditionen-Karte */
        reiter('s3'); await warte(900);
        await warteAuf(function () { return /\d/.test(r6Id('mrpf-top-rate-10')); }, 6000);
        await zeige(function () { return q('#dpfk-band'); }, 8);
        var r = r6Rate10();
        await b2oZeile(s, 'Der indikative Zins', 'Bauzinsen nach Zinsbindung, täglich aktuell — 10 Jahre: <b>' + r.zins + '</b> bei 80 % Beleihung.');
        await zeige(function () { return q('#mrpf-top-detail-10') && q('#mrpf-top-detail-10').closest('.mrpf-top-tile'); }, 10);
        await b2oZeile(s, 'Woraus er besteht', r.weg.replace(/Bundesanleihe/, '<b>Bundesanleihe</b>').replace(/Marktaufschlag/, '<b>Marktaufschlag</b>') + '.');
      },
      async function (s) {   /* 3 · Zuschlag nach Beleihung */
        await zeige(function () { return q('#dpfk-band .dpfk-ltv'); }, 10);
        var zb = r6Beginn(s, 'Zuschlag nach Beleihung', 'Je mehr die Bank finanziert, desto höher der Zins — die Knöpfe zeigen es.');
        await warte(1800);
        var a = await r6Ltv('premium'); await warte(700);
        var c = await r6Ltv('schwach'); await warte(700);
        var d = await r6Ltv('voll'); await warte(500);
        await r6Ende(zb);
        await zeige(function () { return q('#mrpf-top-detail-10') && q('#mrpf-top-detail-10').closest('.mrpf-top-tile'); }, 10);
        await b2oZeile(s, 'Zuschlag nach Beleihung', '10 Jahre: 60 % → <b>' + a.zins + '</b> · 90 % → <b>' + c.zins + '</b> · 100 % → <b>' + d.zins + '</b>. ' + (/Beleihung\s+([\d,]+)/.test(d.weg) ? 'Bei 100 % kommen ' + /Beleihung\s+([\d,]+)/.exec(d.weg)[1] + ' Punkte dazu.' : ''));
        await r6Ltv('standard');
      },
      async function (s) {   /* 4 · Marktdaten-Fenster */
        var b = q('#dpfk-band .v10-zc-btn') || q('.v10-zc-btn'); if (b) b.click(); else { try { V10.openMarketModal(); } catch (e) {} }
        await warteAuf(function () { return q('#v10-market-modal .md-karte'); }, 6000);
        kegelHoch(true);
        await warte(900);
        await zeige(function () { return q('#v10-market-modal .md-karte'); }, 8);
        var kt = ((q('#v10-market-modal .md-karte') || {}).innerText || '').replace(/\u00a0/g, ' ');   /* gemessen: geschütztes Leerzeichen vor % */
        var bund = /BUNDESANLEIHE[^\n]*\n\s*([\d,]+ %)/i.exec(kt), mk = /MARKTAUFSCHLAG\s*\n\s*([\d,]+)/i.exec(kt), an = /ANGEBOTSNIVEAU\s*\n\s*([\d,]+)/i.exec(kt), gz = /\n\s*([\d,]+ %)\s*\n[^\n]*Jahre fest/i.exec(kt);
        await b2oZeile(s, 'Marktdaten ansehen', (gz ? '<b>' + gz[1] + '</b> = ' : '') + 'Bundesanleihe ' + (bund ? bund[1] : '–') + ' + Marktaufschlag ' + (mk ? mk[1] : '–') + ' + Angebotsniveau ' + (an ? an[1] : '–') + ' ± Zuschlag nach Beleihung.');
        var vt = rhIm('#v10-market-modal', /lagen zuletzt\s+[\d,]+\s+Punkte/);
        var vm = vt && /lagen zuletzt\s+([\d,]+)\s+Punkte über der Bundesanleihe\s*\(([^)]+)\)/.exec(vt.textContent);
        await zeige(function () { var e = rhIm('#v10-market-modal', /VERLAUF DES AUFSCHLAGS/i); return e && (e.closest('section') || e.parentElement); }, 8);
        await b2oZeile(s, 'Der Verlauf', 'Der Aufschlag der Banken über 13 Monate' + (vm ? ' — zuletzt <b>' + vm[1] + ' Punkte</b> über der Bundesanleihe (' + vm[2] + ')' : '') + '.');
        var c = q('#v10-market-modal .v10-modal-close'); if (c) c.click();
        kegelHoch(false);
        await warte(700);
      },
      async function (s) {   /* 5 · Zins, Tilgung, Zinsbindung im Darlehen */
        await zeigeGruppe(feldVon('d1z'), feldVon('d1_bindj'), 8);
        await b2oZeile(s, 'Im Darlehen', 'Zins <b>' + r6Pz(wert('d1z')) + ' %</b> — schon eingetragen: der indikative Satz deiner Zinsbindung. Tilgung <b>' + r6Pz(wert('d1t')) + ' %</b>, Zinsbindung <b>' + wert('d1_bindj') + ' Jahre</b>.');
      },
      async function (s) {   /* 6 · Kaufpreis -> Eigenkapital -> Darlehen */
        reiter('s1'); await warte(600);
        await zeige(r6Gruppe('kp'), 10);
        var zb = r6Beginn(s, 'Erst der Kaufpreis', 'Im Reiter Investition: 180.000 € — mit Nebenkosten die Gesamtinvestition.');
        await tippeH('kp', '180000', 70);
        try { DealPilotInvestmentProfile.nachziehen('kp'); } catch (e) {}
        await warte(1400);
        await r6Ende(zb);
        reiter('s3'); await warte(800);
        await zeigeGruppe(feldVon('ek'), feldVon('d1'), 8);
        await warteAuf(function () { return zahl('d1') > 0; }, 4000);
        await warte(600);
        await b2oZeile(s, 'Eigenkapital und Darlehen', 'Eigenkapital <b>' + eur(zahl('ek')) + '</b> — ' + (Math.round(zahl('ek') / zahl('kp') * 100)) + ' % vom Kaufpreis aus deinen Standardwerten. Das Darlehen rechnet sich selbst: <b>' + eur(zahl('d1')) + '</b>.');
        await zeige(function () { return q('#d1-herleitung'); }, 10);
        await b2oZeile(s, 'So kommt es zustande', r6Id('d1-herleitung').replace(/^Automatisch:\s*/, '').replace(/\. Du kannst.*$/, '') + '.');
      },
      async function (s) {   /* 7 · Rate, Restschuld, LTV */
        await zeigeGruppe(function () { return q('#d1_rate') && q('#d1_rate').closest('.f'); }, function () { return q('#restschuld') && q('#restschuld').closest('.f'); }, 8);
        await b2oZeile(s, 'Rate und Restschuld', 'Monatliche Rate <b>' + r6Id('d1_rate') + '</b>. Nach ' + wert('d1_bindj') + ' Jahren stehen noch <b>' + r6Id('restschuld') + '</b> offen.');
        await zeige(function () { return q('#r-ltv') && q('#r-ltv').closest('.card'); }, 8);
        await b2oZeile(s, 'Die Beleihung', 'Beleihungsauslauf <b>' + r6Id('r-ltv') + '</b> — den passenden Zins dazu zeigt die Konditionen-Karte oben (Knopf 100 %). Den Satz im Darlehen bestimmst du.');
      },
      async function (s) {   /* 8 · Standardwerte in den Einstellungen */
        await r6Einstellungen('standardwerte');
        await zeige(r6Karte('.settings-modal', /^Finanzierung$/), 8);
        var z = r6SwkWert(/^Finanzierung$/, /^Zinssatz$/), t = r6SwkWert(/^Finanzierung$/, /^Tilgung/), b = r6SwkWert(/^Finanzierung$/, /^Zinsbindung$/), e = r6SwkWert(/^Finanzierung$/, /^Eigenkapital/);
        await b2oZeile(s, 'Deine Standardwerte', 'Einstellungen › <b>Standardwerte</b>: Zinssatz ' + (z || '–') + ', Tilgung ' + (t || '–') + ', Zinsbindung ' + (b || '–') + ', Eigenkapital ' + (e || '–') + '.');
        await zeige(function () { return q('.settings-modal .swk-karten') || q('.settings-modal .swk-karte'); }, 8);
        await b2oZeile(s, 'Deine Standardwerte', 'Oder ein ganzes Set: <b>Vorsichtig</b> oder <b>Renditeorientiert</b> — eigener Zins statt Marktzins geht auch. Gilt für jedes neue Objekt.', 600);
        r6EinstellungenZu();
        await warte(600);
      }
    ]
  };

  /* ── MODUL 09 · BEWIRTSCHAFTUNG ───────────────────────────────── */
  DREHBUECHER['reihe-bewirtschaftung'] = {
    titel: 'Bewirtschaftung', unterzeile: 'Umlagefähig, nicht umlagefähig, Rücklage, Mietausfall', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: function () { r6EinstellungenZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6Start({ kp: true });
        await r6Beispiel(s, ' Heute: der Reiter <b>Bewirtschaftung</b>.');
      },
      async function (s) {   /* 2 · Miete eintragen (Mietausfall kommt nach) */
        reiter('s2'); await warte(600);
        await zeige(r6Gruppe('nkm'), 10);
        var zb = r6Beginn(s, 'Erst die Miete', 'Im Reiter Miete: 900 € kalt — daran hängt der kalkulatorische Mietausfall.');
        await tippeH('nkm', '900', 90);
        try { DealPilotInvestmentProfile.nachziehen('nkm'); } catch (e) {}
        await warte(1300);
        await r6Ende(zb);
      },
      async function (s) {   /* 3 · zwei Rechenwege */
        reiter('s4'); await warte(800);
        await zeige(function () { var b = q('#s4 .mode-btn[data-mode="detail"]'); return b && (b.closest('.card') || b.parentElement); }, 8);
        await b2oZeile(s, 'Zwei Rechenwege', '<b>Detailliert</b> in Euro je Position — wie Banken und ImmoWertV — oder als <b>Prozent der Kaltmiete</b>, die Faustregel.');
      },
      async function (s) {   /* 4 · Standardwerte der Objektart */
        try { DealPilotBwkProfil.leisteZeichnen(); } catch (e) {}
        await warte(400);
        await zeige(function () { return q('#bwk-standard-bar'); }, 8);
        var tx = r6Text(q('#bwk-standard-bar .bwk-std-t'));
        await b2oZeile(s, 'Standardwerte je Objektart', 'Schon eingesetzt, als Objektart und Wohnfläche standen — für eine Eigentumswohnung: ' + (tx || '–') + '.');
        await zeige(function () { return r6Knopf('#bwk-standard-bar', /Standardwerte einsetzen/) || q('#bwk-standard-bar'); }, 10);
        await b2oZeile(s, 'Standardwerte je Objektart', 'Eigene Zahlen gehen immer vor — aus Wirtschaftsplan oder Abrechnung. Der Knopf setzt die Standardwerte neu.');
      },
      async function (s) {   /* 5 · umlagefähig */
        await zeigeGruppe(feldVon('hg_ul'), feldVon('ul_sonst'), 8);
        var zb = r6Beginn(s, 'Umlagefähig', 'Zahlt der Mieter über die Nebenkosten — dazu die Grundsteuer.');
        await tippeH('grundsteuer', '190', 110);
        await warte(1100);
        await r6Ende(zb);
        await zeige(function () { return q('#ul_sum') && q('#ul_sum').closest('.card'); }, 8);
        await b2oZeile(s, 'Umlagefähig', 'Hausgeld-Anteil <b>' + eur(zahl('hg_ul')) + '</b> + Grundsteuer ' + eur(zahl('grundsteuer')) + ' = <b>' + r6Id('ul_sum') + '</b> im Jahr — für dich ein durchlaufender Posten.');
      },
      async function (s) {   /* 6 · nicht umlagefähig, Rücklagen */
        await zeigeGruppe(feldVon('hg_nul'), feldVon('eigen_r'), 8);
        var zb = r6Beginn(s, 'Nicht umlagefähig', 'Das bleibt bei dir: Verwaltung und Rücklage aus dem Hausgeld.');
        await tippeH('weg_r', '480', 110);
        await warte(1000);
        await r6Ende(zb);
        await b2oZeile(s, 'Nicht umlagefähig', 'Hausgeld-Anteil <b>' + eur(zahl('hg_nul')) + '</b> — darin steckt die WEG-Rücklage (' + eur(zahl('weg_r')) + ', nur zur Info, nicht doppelt gezählt). Eigene Rücklage für Bad, Küche, Böden: <b>' + eur(zahl('eigen_r')) + '</b>.');
      },
      async function (s) {   /* 7 · Mietausfall */
        await zeige(r6Gruppe('mietausfall'), 10);
        var p = (function () { try { return DealPilotInvestmentProfile.get('mietausfall_pct'); } catch (e) { return null; } })();
        await b2oZeile(s, 'Kalkulatorischer Mietausfall', '<b>' + eur(zahl('mietausfall')) + '</b> im Jahr' + (p ? ' — ' + r6Pz(p) + ' % der Jahreskaltmiete aus deinen Standardwerten' : '') + '. Eingetragen, sobald die Miete stand.');
      },
      async function (s) {   /* 8 · Zusammenfassung */
        await zeige(function () { return q('#r-bwk') && q('#r-bwk').closest('.card'); }, 8);
        await b2oZeile(s, 'Zusammen', 'Umlagefähig ' + r6Neben(q('#r-bwk').closest('.card'), /^Umlagefähig \/ Jahr$/) + ', nicht umlagefähig ' + r6Neben(q('#r-bwk').closest('.card'), /^Nicht umlagefähig \/ Jahr$/) + ' — gesamt <b>' + r6Id('r-bwk') + '</b>, ' + r6Id('r-bwk-pct') + ' der Kaltmiete.');
      },
      async function (s) {   /* 9 · Prozent-Modus */
        var b = q('#s4 .mode-btn[data-mode="percent"]'); if (b) b.click();
        await warte(900);
        await zeigeGruppe(feldVon('bwk_ul_pct'), feldVon('bwk_nul_pct'), 8);
        await b2oZeile(s, 'Oder in Prozent', 'Faustregel: <b>' + r6Pz(wert('bwk_ul_pct')) + ' %</b> umlagefähig, <b>' + r6Pz(wert('bwk_nul_pct')) + ' %</b> nicht umlagefähig — ebenfalls aus den Standardwerten.');
        var d = q('#s4 .mode-btn[data-mode="detail"]'); if (d) d.click();
        await warte(700);
      },
      async function (s) {   /* 10 · Einstellungen */
        await r6Einstellungen('standardwerte');
        await zeige(r6Karte('.settings-modal', /^Bewirtschaftung$/), 8);
        var v = r6SwkWert(/^Bewirtschaftung$/, /^Verwaltung je/), i = r6SwkWert(/^Bewirtschaftung$/, /^Instandhaltung$/), h = r6SwkWert(/^Bewirtschaftung$/, /^ETW-Hausgeld$/), m = r6SwkWert(/^Bewirtschaftung$/, /^Mietausfall/);
        await b2oZeile(s, 'Woher die Vorbelegung kommt', 'Einstellungen › <b>Standardwerte</b>: ETW-Hausgeld ' + (h || '–') + ', Mietausfall ' + (m || '–') + ' — für Häuser Verwaltung ' + (v || '–') + ', Instandhaltung ' + (i || '–') + '.', 600);
        r6EinstellungenZu();
        await warte(600);
      }
    ]
  };

  /* ── MODUL 10a/10b · STEUER AM MEHRFAMILIENHAUS ───────────────────
     Marcel 15.10.2026: „ein Beispiel mit einem größeren Objekt … ein
     Mehrfamilienhaus mit 6–8 Einheiten“ — Ravensberger Weg 38, Bielefeld
     (8 WE, Bj 1978), ein ECHTES Objekt im Konto. Es wird nie geladen und nie
     gespeichert: r6KopieStart legt eine KOPIE an (GET + POST /objects, wie
     „Duplizieren“), deren Kennung landet über den fetch-Ersatz in
     DPM_REIHE.angelegt und wird beim Aufräumen gelöscht, auch bei Esc. */
  var R6_MFH = '72082555-b960-4868-a409-b241fbaf86ed';
  async function r6KopieStart(id, opt) {
    opt = opt || {};
    DPM_REIHE.angelegt = []; DPM_REIHE.gesperrt = []; DPM_REIHE.gespielt = []; DPM_REIHE.geloescht = []; DPM_REIHE.abrufe = []; DPM_REIHE.fertig = null;
    var sk = null; try { sk = Auth.getStorageKey('seq_') + new Date().getFullYear(); } catch (e) {}
    var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    _rh = { start: Date.now() - 1000, berichte: [], spr: 0, sprMax: 0, seqKey: sk, seq: sk ? ls(sk) : undefined,
      merker: { dp_zielstufe: ls('dp_zielstufe'), dp_mb_auftraege: ls('dp_mb_auftraege'), dp_mb_pref_span: ls('dp_mb_pref_span'), qc_span_config: ls('qc_span_config') },
      kacheln: ['dealpilot', 'import', 'voice', 'immometrica', 'gefuehrt'].filter(rhGewaehlt) };
    await rhLaden();
    rhSpion(); rhMikroAn();
    try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
    reiter('s0');
    var o = await Auth.apiCall('/objects/' + id);
    var d = JSON.parse(JSON.stringify((o && o.data) || {}));
    /* v2263 · opt.behalte: Gewonnen-Status bleibt (Modul 14, Bestand) */
    (opt.behalte ? ['_obj_seq'] : ['_obj_seq', '_deal_won', '_deal_won_at', '_deal_lost']).forEach(function (k) { delete d[k]; });   /* wie dupSaved() */
    if (opt.ohneAnkauf) delete d._ankauf;   /* v2263: ein offener Deal hat noch keinen eingefrorenen Ankauf-Stand */
    /* v2263 · die Analyse trägt die Kennung ihres Objekts (_fuer.objekt_id) - an
       der Kopie hieße es sonst „gehört zu einem anderen Objekt". Ohne Kennung
       prüft die App nur den Zahlenabdruck, wie bei jeder Analyse. */
    var ai = opt.ohneAnalyse ? null : o.ai_analysis;   /* v2263: Überblick 2 braucht keine (und das PDF druckte sie) */
    /* v2266 · opt.analyse: ein MITSCHNITT statt der gespeicherten Analyse (Modul 11,
       DPM_REIHE_DATEN.pilot) - das echte Objekt behält seine. */
    if (opt.analyse) ai = JSON.stringify(opt.analyse);
    try { var aj = typeof ai === 'string' ? JSON.parse(ai) : ai; if (aj && aj._fuer) { delete aj._fuer.objekt_id; ai = JSON.stringify(aj); } } catch (e) {}
    var neu = await Auth.apiCall('/objects', { method: 'POST', body: { data: d, aiAnalysis: ai, photos: o.photos || [] } });
    var nid = neu && (neu.id || (neu.data && neu.data.id) || (neu.object && neu.object.id));
    if (nid && DPM_REIHE.angelegt.indexOf(nid) < 0) DPM_REIHE.angelegt.push(nid);
    if (nid && typeof window.loadSaved === 'function') await window.loadSaved(nid);
    await warteAuf(function () { return window._currentObjKey === nid && /\S/.test(wert('str')); }, 9000);
    await warte(900);
    var m = q('.main-col'); if (m) m.scrollTop = 0;
  }
  async function r6MfhBeispiel(s, rest) {
    var m = q('.main-col'); if (m) m.scrollTop = 0;
    await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
    var we = wert('einheiten');
    await b2oZeile(s, 'Das Beispiel', 'Ein Mehrfamilienhaus aus dem Bestand: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + de(zahl('wfl')) + ' m², Baujahr ' + wert('baujahr') + ', Kaufpreis ' + eur(zahl('kp')) + '.' + (rest || ''));
  }
  function r6San15() {
    function t(id) { return r6Id(id); }
    return { max: t('san_limit_max'), netto: t('san_limit_actual'), status: t('san_limit_status').replace(/^✓\s*/, '').replace(/(\d)\.(\d)%/g, '$1,$2 %'), geb: wert('geb_ant') };
  }
  function r6Wiz() { return q('.rnd-wiz-overlay'); }
  function r6TaxZeilen() { var h = q('#mand-tax-periods-host'); return h ? [].filter.call(h.querySelectorAll('div'), function (d) { return d.style.display === 'grid' && /\d{2}\.\d{2}\.\d{4}/.test(d.textContent) && d.textContent.length < 160; }) : []; }
  /* Kacheln des Steuer-Moduls: .tax-item > .tax-label + .tax-val (tax.js) */
  function r6TaxItem(re) { return [].filter.call(document.querySelectorAll('#s3-tax .tax-item'), function (x) { var l = x.querySelector('.tax-label'); return x.offsetWidth && l && re.test(r6Text(l)); })[0] || null; }
  function r6TaxWert(re) { var i = r6TaxItem(re); return i ? r6Text(i.querySelector('.tax-val')).replace(/\s*▸$/, '') : null; }
  function r6WizTitel() { var h = r6Wiz() && r6Wiz().querySelector('h2,h3'); return h ? r6Text(h) : ''; }
  async function r6WizWeiter() {
    var w = r6Wiz(); if (!w) return false;
    [].forEach.call(w.querySelectorAll('select'), function (x) { if (x.offsetWidth && !x.value && x.options.length > 1) { x.selectedIndex = 1; x.dispatchEvent(new Event('change', { bubbles: true })); } });
    var b = [].filter.call(w.querySelectorAll('button'), function (x) { return x.offsetWidth && /Weiter|Berechnen/.test(x.textContent); }).slice(-1)[0];
    if (!b) return false;
    b.click(); await warte(500); return true;
  }
  function r6WizZu() { var w = r6Wiz(); if (w) { var x = [].filter.call(w.querySelectorAll('button'), function (b) { return b.textContent.trim() === '×'; })[0]; try { if (x) x.click(); else w.remove(); } catch (e) {} } }
  DREHBUECHER['reihe-steuer'] = {
    titel: 'Steuer: AfA, Zeiträume, Restnutzungsdauer', unterzeile: 'Was ein Mehrfamilienhaus dir steuerlich bringt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r6WizZu(); r6EinstellungenZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel (Kopie) */
        await r6KopieStart(R6_MFH);
        await r6MfhBeispiel(s, ' Heute: der Reiter <b>Steuer</b>.');
      },
      async function (s) {   /* 2 · persönliche Steuer */
        reiter('s3-tax'); await warte(900);
        await zeigeGruppe(feldVon('zve'), feldVon('grenz'), 8);
        await b2oZeile(s, 'Deine persönliche Steuer', 'Grenzsteuersatz <b>' + r6Pz(wert('grenz')) + ' %</b> — DealPilot rechnet ihn nach § 32a selbst aus deinem zu versteuernden Einkommen.');
      },
      async function (s) {   /* 3 · Steuerzeiträume */
        await zeige(function () { return q('#s3-tax .v842-tax-link'); }, 10);
        await warte(1200);
        try { window._v842OpenTaxPeriods(); } catch (e) {}
        await warteAuf(function () { return q('#mand-tax-periods-host') && r6TaxZeilen().length; }, 6000);
        kegelHoch(true);
        var h = q('#mand-tax-periods-host'); if (h) h.scrollIntoView({ block: 'start' });
        await warte(800);
        /* gemessen: die Zeilen sind DIVs mit display:grid (keine Tabelle) */
        await zeige(function () { var z = r6TaxZeilen(), h2 = q('#mand-tax-periods-host'); return z.length && h2 ? b2oHuelle(h2.firstElementChild || h2, z[z.length - 1]) : h2; }, 8);
        var zl = r6TaxZeilen().slice(0, 2).map(function (r) {
          var c = [].map.call(r.children, function (x) { return r6Text(x); });
          return c[0] + '–' + c[1] + ': <b>' + c[2] + '</b>' + (c[3] && c[3] !== '–' ? ' (' + c[3] + ')' : '');
        });
        await b2oZeile(s, 'Steuerzeiträume', 'Dein Einkommen je Zeitraum' + (zl.length ? ' — ' + zl.join(', ') : '') + '. Jedes Objekt bekommt automatisch den passenden.');
        r6EinstellungenZu();
        await warte(700);
      },
      async function (s) {   /* 4 · AfA */
        await zeigeGruppe(feldVon('afa_satz'), function () { return q('#afa_kalk') && q('#afa_kalk').closest('.f'); }, 8);
        await b2oZeile(s, 'Die Abschreibung', 'AfA-Satz <b>' + r6Optionstext('afa_satz') + '</b>, Gebäudeanteil ' + r6Pz(wert('geb_ant')) + ' % — das ergibt <b>' + r6Id('afa_kalk') + '</b> im Jahr.');
        await b2oZeile(s, 'Die Abschreibung', 'Bei Baujahr ' + wert('baujahr') + ' rechnet das Gesetz mit 50 Jahren Nutzung. Ist das Haus früher verbraucht, gilt ein <b>eigener Satz</b> — mit Gutachten.');
      },
      async function (s) {   /* 5 · eigener Satz -> Restnutzungsdauer ermitteln */
        var sel = q('#afa_satz'); if (sel) { sel.value = 'eigen'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await warte(800);
        await zeige(function () { return q('#afa-eigen-box'); }, 8);
        await b2oZeile(s, 'Eigener Satz', 'Aus der Restnutzungsdauer: 100 ÷ Jahre. Wie viele Jahre bleiben, schätzt DealPilot vorab.');
        await zeige(function () { return q('#afa-rnd-ermitteln'); }, 10);
        await warte(1300);
        var b = q('#afa-rnd-ermitteln'); if (b) b.click();
        await warteAuf(r6Wiz, 5000);
        /* GEMESSEN (Prueflauf 10a, Studio-Hoehe 770 px): css/rnd-styles.css:1278
           setzt max-height 915px !important und hebt die 92vh auf - die Fusszeile
           mit „Weiter" und „Anfrage senden" lag unter dem Bildrand (y 775). Nur
           fuer diesen Lauf inline begrenzt; der Fehler selbst ist gemeldet. */
        try { var wm = r6Wiz().querySelector('.rnd-wiz-modal'); if (wm) wm.style.setProperty('max-height', (innerHeight - 40) + 'px', 'important'); } catch (e) {}
        kegelHoch(true);
        await warte(900);
        await zeige(function () { var w = r6Wiz(); return w && (w.querySelector('.rnd-wiz-modal,[class*=modal]') || w.firstElementChild); }, 6);
        await b2oZeile(s, 'Restnutzungsdauer ermitteln', 'Neun Schritte — die Objektdaten sind schon da: ' + wert('str') + ' ' + wert('hnr') + ', Baujahr ' + wert('baujahr') + ', ' + de(zahl('wfl')) + ' m².');
      },
      async function (s) {   /* 6 · durch den Wizard */
        var zb = r6Beginn(s, 'Restnutzungsdauer ermitteln', 'Bauweise, Technik, Modernisierungen, Zustand der Gewerke, Schäden — vorbelegt aus dem Objekt.');
        for (var i = 0; i < 8 && !/Schritt 9/.test(r6WizTitel()); i++) { if (!(await r6WizWeiter())) break; await warte(1100); }
        await warteAuf(function () { return /Schritt 9/.test(r6WizTitel()); }, 4000);
        await warte(700);
        var t = r6Inner(r6Wiz());
        /* v2258 (Hauptsitzung): die Spanne steht jetzt mit Komma („30,8–34,8 Jahre") */
        var rnd = /GESCHÄTZTE RESTNUTZUNGSDAUER[\s\S]*?(\d[\d,]*(?:\s*[–\-]\s*\d[\d,]*)?)\s*Jahre/i.exec(t), urt = /(Gutachten lohnt[^\n]*)/.exec(t);
        await r6Ende(zb);
        await zeige(function () { var e = rhIm(r6Wiz(), /GESCHÄTZTE RESTNUTZUNGSDAUER/i); return e && (e.closest('div[style]') || e.parentElement); }, 8);
        await b2oZeile(s, 'Das Ergebnis', 'Geschätzte Restnutzungsdauer <b>' + (rnd ? rnd[1] + ' Jahre' : '–') + '</b> statt 50. ' + (urt ? '„' + urt[1].trim() + '“' : '') + '.');
      },
      async function (s) {   /* 7 · was es bringt */
        var t = r6Inner(r6Wiz());
        var red = /(?:Reduzierte|Verlängerte) AfA\s*([\d,]+ %)/.exec(t), mehr = /Mehr-AfA pro Jahr\s*([+−\-]?[\d.]+ €)/.exec(t), spar = /Steuerersparnis pro Jahr\s*([\d.]+ €)/.exec(t), net = /Netto-Vorteil\s*([−\-+]?[\d.]+ €)/.exec(t);
        var e = rhIm(r6Wiz(), /^AfA-Vergleich$/i); if (e) e.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeige(function () { var x = rhIm(r6Wiz(), /^AfA-Vergleich$/i); return x && (x.closest('table') || x.parentElement); }, 8);
        await b2oZeile(s, 'Was das Gutachten bringt', 'AfA <b>' + (red ? red[1] : '–') + '</b> statt 2 %: ' + (mehr ? mehr[1] : '–') + ' AfA und ' + (spar ? spar[1] : '–') + ' weniger Steuer im Jahr. Netto-Vorteil über die Restnutzungsdauer: <b>' + (net ? net[1] : '–') + '</b>.');
      },
      async function (s) {   /* 8 · Anfrage: nur zeigen (NIE klicken) */
        function knopf() { var w = r6Wiz(); return w && [].filter.call(w.querySelectorAll('button'), function (b) { return b.offsetWidth && /Anfrage senden/.test(b.textContent); })[0]; }
        var k = knopf(); if (k) k.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(knopf, 10);
        await b2oZeile(s, 'Gutachten anfragen', 'Von hier geht die <b>Anfrage</b> an einen Sachverständigen — mit allen Angaben aus den neun Schritten. Im Video schicken wir sie nicht ab.');
        r6WizZu();
        kegelHoch(false);
        await warte(600);
        var sel = q('#afa_satz'); if (sel) { sel.value = '2.0'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await warte(700);
      },
      async function (s) {   /* 9 · Steuer-Modul */
        var e = r6TaxItem(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/);
        var box = e && (e.closest('.card') || e); if (box) box.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeige(function () { var x = r6TaxItem(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/); return x && (x.parentElement || x); }, 8);
        var ein = r6TaxWert(/^Einnahmen V\+V/), wk = r6TaxWert(/^Werbungskosten gesamt/), erg = r6TaxWert(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/);
        await b2oZeile(s, 'Was im Jahr übrig bleibt', 'Mieteinnahmen <b>' + (ein || '–') + '</b>, Werbungskosten ' + (wk || '–') + ' — Zinsen, Bewirtschaftung, AfA. Ergebnis aus Vermietung: <b>' + (erg || '–') + '</b>.');
        var w = rhIm('#s3-tax', /Steuerverlauf/i);
        if (w) { (w.closest('.card') || w).scrollIntoView({ block: 'start' }); await warte(400); }
        await zeige(function () { var x = rhIm('#s3-tax', /Steuerverlauf/i); return x && (x.closest('.card') || x.parentElement); }, 8);
        var sum = rhIm('#s3-tax', /^Summe über 15 Jahre:?$/);
        await b2oZeile(s, 'Über 15 Jahre', 'Grün Erstattung, rot Nachzahlung — Jahr für Jahr, mit echter Progression' + (sum && sum.nextElementSibling ? '. Summe: <b>' + r6Text(sum.nextElementSibling) + '</b>' : '') + '. Die Kaufpreisaufteilung zeigt Modul 10b.', 600);
      }
    ]
  };

  /* ── MODUL 10b · BMF-KAUFPREISAUFTEILUNG + 15-%-GRENZE (MFH) ───── */
  function r6Bmf() { return q('#bmfOverlay'); }
  function r6Sichtbar(w, sel) { return w ? [].filter.call(w.querySelectorAll(sel), function (x) { return x.offsetWidth > 0; })[0] || null : null; }
  function r6BmfPane() { return q('#bmfOverlay .bmfmo-pane.active'); }
  /* GEMESSEN (Marcel: „Schritt 4 und 5 sieht man die Karten nicht"): scrollIntoView
     legte Tabellen- und Kartenkopf UNTER die feste Kopfzeile des Fensters (Karte
     ab y 139 = Oberkante des Rollbereichs, Spaltenköpfe verdeckt). Gerollt wird
     deshalb der Rollbereich selbst, das Ziel 14 px unter seiner Oberkante. */
  function r6BmfOben(e) { var bd = e && e.closest('.bmfmo-body'); if (!bd) return; bd.scrollTop += e.getBoundingClientRect().top - bd.getBoundingClientRect().top - 14; }
  async function r6BmfWeiter() { var b = q('#btnBmfNext'); if (b) b.click(); await warte(1600); }
  function r6BmfKarte(v) { return [].filter.call(document.querySelectorAll('#bmfOverlay [onclick*="_v292SelectVariant"]'), function (x) { return x.tagName !== 'INPUT' && new RegExp("'" + v + "'").test(x.getAttribute('onclick')); })[0] || null; }
  var _r6Vorher = null;
  DREHBUECHER['reihe-bmf'] = {
    titel: 'BMF-Kaufpreisaufteilung', unterzeile: 'Gebäude und Boden — Abschlag, Klausel, 15-%-Grenze', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { try { if (r6Bmf() && typeof window.closeBMFModal === 'function') window.closeBMFModal(); } catch (e) {} r6WizZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel (Kopie), Sanierung 87.000 € */
        await r6KopieStart(R6_MFH);
        await r6MfhBeispiel(s, '');
        reiter('s1'); await warte(700);
        await zeige(r6Gruppe('san'), 10);
        var zb = r6Beginn(s, 'Angenommen: eine Sanierung', 'In den ersten drei Jahren sollen 87.000 € in das Haus fließen.');
        await tippeH('san', '87000', 90);
        await warte(1400);
        await r6Ende(zb);
        _r6Vorher = r6San15();
        await zeige(function () { return q('#san_limit_hint') && (q('#san_limit_hint').closest('.f') || q('#san_limit_hint')); }, 8);
        await b2oZeile(s, 'Die 15-%-Grenze', 'Bei ' + r6Pz(_r6Vorher.geb) + ' % Gebäudeanteil: höchstens <b>' + _r6Vorher.max + '</b> netto in drei Jahren. ' + eur(zahl('san')) + ' brutto sind ' + _r6Vorher.netto + ' netto — ' + _r6Vorher.status + '.');
      },
      async function (s) {   /* 2 · BMF-Rechner öffnen, Schritt 1 */
        reiter('s3-tax'); await warte(800);
        var bb = [].filter.call(document.querySelectorAll('#s3-tax button'), function (x) { return /openBMFModal/.test(x.getAttribute('onclick') || ''); })[0];
        await zeige(function () { return bb; }, 10);
        await b2oZeile(s, 'Der BMF-Rechner', 'Teilt den Kaufpreis in <b>Gebäude</b> und <b>Boden</b> — nach der Arbeitshilfe des Finanzministeriums. Nur das Gebäude wird abgeschrieben.');
        if (bb) bb.click(); else { try { openBMFModal(); } catch (e) {} }
        await warteAuf(function () { return r6BmfPane(); }, 6000);
        kegelHoch(true);
        await warte(1000);
        await zeige(function () { var p = r6BmfPane(); return p && (p.querySelector('.bmfmo-ak-box,[class*=summary],[class*=box]') || p.firstElementChild); }, 6);
        var t = r6Inner(r6BmfPane());
        var kp = /Brutto-Kaufpreis\s*\n?\s*([\d.]+ €)/.exec(t), nk = /\+\s*Nebenkosten\s*\n?\s*([\d.]+ €)/.exec(t);
        await b2oZeile(s, 'Schritt 1 · Anschaffungskosten', 'Aus dem Reiter Investition: Kaufpreis ' + (kp ? kp[1] : '–') + ', Nebenkosten ' + (nk ? nk[1] : '–') + ' (in diesem Objekt nicht erfasst). Fahrten zum Objekt und Notar kämen hier dazu.');
      },
      async function (s) {   /* 3 · Schritt 2: amtliche Aufteilung */
        await r6BmfWeiter();
        await warteAuf(function () { return q('#bmfJacobyZeile') && /Jacoby/.test(q('#bmfJacobyZeile').textContent); }, 8000);
        await warte(600);
        await zeigeGruppe(function () { return q('#bmf_gsfl') && q('#bmf_gsfl').closest('div'); }, function () { return q('#bmf_mea') && q('#bmf_mea').closest('div'); }, 6);
        await b2oZeile(s, 'Schritt 2 · Die Aufteilung', 'Grundstück ' + wert('bmf_gsfl') + ' m², Bodenrichtwert <b>' + wert('bmf_brw') + ' €/m²</b>, Anteil ' + wert('bmf_mea') + ' % — alles aus dem Objekt übernommen.');
        var jz = q('#bmfJacobyZeile'); if (jz) jz.scrollIntoView({ block: 'center' });
        await warte(400);
        var jm = /Nach Jacoby[^:]*:\s*([\d,]+ %)/.exec(r6Text(q('#bmfJacobyZeile')));
        await zeige(function () { return q('#bmfJacobyZeile'); }, 8);
        await b2oZeile(s, 'Schritt 2 · Die Aufteilung', 'Zum Vergleich rechnet DealPilot die umgekehrte Ertragswertmethode (BFH IX R 12/21) mit: <b>' + (jm ? jm[1] : '–') + ' Gebäude</b>.');
      },
      async function (s) {   /* 4 · Schritt 3: vier Varianten */
        await r6BmfWeiter();
        await warteAuf(function () { var p = r6BmfPane(); return p && p.id === 'p-afa' && r6Sichtbar(p, 'table'); }, 6000);
        await warte(600);
        var tb = r6Sichtbar(r6BmfPane(), 'table'); r6BmfOben(tb && (tb.previousElementSibling || tb));
        await warte(400);
        await zeige(function () { return r6Sichtbar(r6BmfPane(), 'table'); }, 6);
        var tt = r6Inner(r6BmfPane());
        var g = /Gebäude %\s+([\d,]+ %)\s+([\d,]+ %)\s+([\d,]+ %)\s+([\d,]+ %)/.exec(tt), a = /AfA Gebäude\/Jahr\s+([\d.]+ €)\s+([\d.]+ €)\s+([\d.]+ €)\s+([\d.]+ €)/.exec(tt);
        await b2oZeile(s, 'Schritt 3 · Amtlich und drei Abweichungen', 'Amtlich <b>' + (g ? g[1] : '–') + '</b> Gebäude — mit Boden −15/−20/−25 % bis ' + (g ? g[4] : '–') + '. AfA ' + (a ? a[1] + ' bis ' + a[4] : '–') + ' im Jahr.');
      },
      async function (s) {   /* 5 · Schritt 4: Variante wählen */
        await r6BmfWeiter();
        await warteAuf(function () { var p = r6BmfPane(); return p && p.id === 'p-hebel' && r6BmfKarte('amtlich'); }, 6000);
        await warte(600);
        r6BmfOben(r6BmfKarte('amtlich'));
        await warte(400);
        await zeige(function () { var a = r6BmfKarte('amtlich'), b = r6BmfKarte('aggressiv'); return a && b ? b2oHuelle(a, b) : (a || b); }, 6);
        var zb = r6Beginn(s, 'Schritt 4 · Du wählst', 'Vier Karten, jede mit Risiko-Score — grün ist die Arbeitshilfe, rot kann das Finanzamt beanstanden.');
        await warte(3200);
        var o = r6BmfKarte('optimiert'); if (o) o.click();
        await warte(900);
        await r6Ende(zb);
        await zeige(function () { return r6BmfKarte('optimiert'); }, 8);
        var kt = r6Text(r6BmfKarte('optimiert'));
        var gp = /Gebäude\s*([\d,]+ %)/.exec(kt), af = /AfA Gebäude \/ Jahr\s*([\d.]+ €)/.exec(kt), sc = /Risiko Score (\d)/.exec(kt), se = /Steuerersparnis\s*~?\s*([\d.]+ €)/.exec(kt);
        await b2oZeile(s, 'Optimiert · Boden −20 %', 'Gebäude <b>' + (gp ? gp[1] : '–') + '</b>, AfA <b>' + (af ? af[1] : '–') + '</b> im Jahr' + (se ? ', rund ' + se[1] + ' Steuerersparnis' : '') + (sc ? ' — Risiko-Score ' + sc[1] + ', gelb' : '') + '.');
      },
      async function (s) {   /* 6 · Bodenabschlag: 20 % */
        var t = q('#bmf-boden-tab'); if (t) t.click();
        await warteAuf(function () { var p = r6BmfPane(); return p && p.id === 'p-boden' && r6Sichtbar(p, 'table'); }, 6000);
        await warte(800);
        var p = r6BmfPane(); if (p) { var sc = p.closest('.bmfmo-body'); if (sc) sc.scrollTop = 0; }
        var tb = r6Sichtbar(r6BmfPane(), 'table'); if (tb) tb.scrollIntoView({ block: 'center' });
        await warte(400);
        await zeige(function () { return r6Sichtbar(r6BmfPane(), 'table'); }, 6);
        var tt = r6Inner(r6BmfPane());
        var kopf = /MIT\s+(\d+)\s*%\s*ABSCHLAG/i.exec(tt), bo = /davon Grund und Boden\s+([\d.]+ €)\s+([\d.]+ €)/.exec(tt), af = /AfA pro Jahr bei [\d,]+ %\s+([\d.]+ €)\s+([\d.]+ €)/.exec(tt);
        await b2oZeile(s, 'Bodenabschlag ' + (kopf ? kopf[1] : '20') + ' %', 'Die amtliche Zahl bleibt stehen, das Szenario daneben: Boden <b>' + (bo ? bo[2] : '–') + '</b> statt ' + (bo ? bo[1] : '–') + ', AfA <b>' + (af ? af[2] : '–') + '</b> statt ' + (af ? af[1] : '–') + ' im Jahr.');
      },
      async function (s) {   /* 7 · Notarklausel */
        var ta = q('#bmf-boden-klausel-text'); if (ta) ta.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(function () { var e = q('#bmf-boden-klausel-text'); var b = e; for (var i = 0; i < 3 && b && !/kopieren/i.test(b.textContent); i++) b = b.parentElement; return b || e; }, 8);
        var kl = (q('#bmf-boden-klausel-text') || {}).value || '', kb = /Grund und Boden entfallen\s+([\d.,]+\s*€)/.exec(kl), kg = /Gebäude[^.]*?entfallen\s+([\d.,]+\s*€)/.exec(kl);
        await b2oZeile(s, 'Die Notarklausel', 'Der <b>Text für den Kaufvertrag</b> steht fertig da' + (kb && kg ? ': Boden ' + kb[1] + ', Gebäude ' + kg[1] : '') + ' — zum Kopieren für den Notar. Die Begründung gehört hinein.');
      },
      async function (s) {   /* 8 · Absprünge */
        await zeige(function () { return r6Knopf('#bmfOverlay .bmfmo-pane.active', /Restnutzungsdauer berechnen/) || r6BmfPane(); }, 8);
        await b2oZeile(s, 'Die Absprünge', '<b>Restnutzungsdauer berechnen</b> öffnet den Rechner aus Modul 10a. Dazu PDF der Aufteilung, die ausgefüllte BMF-Arbeitshilfe und das Original als Excel.');
      },
      async function (s) {   /* 9 · Übernehmen -> Reiter Steuer */
        var tb = q('#bmfOverlay .bmfmo-tab[data-pane="p-hebel"]'); if (tb) tb.click();
        await warte(1000);
        await zeige(function () { return q('#btnBmfApply') || r6Knopf('#bmfOverlay', /Übernehmen/); }, 10);
        var zb = r6Beginn(s, 'Übernehmen', 'Ein Klick — der Gebäudeanteil der gewählten Variante geht in den Reiter Steuer.');
        await warte(2600);
        var ub = q('#btnBmfApply') || r6Knopf('#bmfOverlay', /Übernehmen/); if (ub) ub.click();
        await warteAuf(function () { return !r6Bmf() || !r6Bmf().classList.contains('open'); }, 5000);
        kegelHoch(false);
        await warte(1200);
        if (!q('#s3-tax.active')) reiter('s3-tax');
        await r6Ende(zb);
        await zeigeGruppe(feldVon('geb_ant'), function () { return q('#afa_kalk') && q('#afa_kalk').closest('.f'); }, 8);
        await b2oZeile(s, 'Im Reiter Steuer', 'Gebäudeanteil <b>' + r6Pz(wert('geb_ant')) + ' %</b> statt ' + r6Pz((_r6Vorher || {}).geb) + ' % — die Abschreibung steigt auf <b>' + r6Id('afa_kalk') + '</b> im Jahr.');
      },
      async function (s) {   /* 10 · 15-%-Grenze nach der Übernahme */
        reiter('s1'); await warte(900);
        var n = r6San15(), v = _r6Vorher || {};
        await zeige(function () { return q('#san_limit_hint') && (q('#san_limit_hint').closest('.f') || q('#san_limit_hint')); }, 8);
        await b2oZeile(s, 'Die 15-%-Grenze zieht mit', 'Mehr Gebäude, höhere Grenze: <b>' + n.max + '</b> statt ' + (v.max || '–') + '. Die Sanierung (' + n.netto + ' netto) bleibt darunter — ' + n.status + '.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODULE 11–14 (v2263) ═══════════════════════
     Videoreihe.md, Teil C. Alle vier an KOPIEN (r6KopieStart, beim Aufräumen
     gelöscht, auch bei Esc); die echten Objekte werden nie geladen.
       11 Pilot-Analyse  Westerfeldstr. 140 (MFH, 4 WE) - seit v2266 mit einer
          NEUEN Analyse als Mitschnitt (DPM_REIHE_DATEN.pilot, einmal echt erzeugt
          am 15.10.2026 nach v2264: keine Anbieternamen, Offerte 530.000 € bei
          545.000 € Kaufpreis). Die gespeicherte Analyse des Objekts (Offerte
          910.000 €, Portalnamen) wird an der Kopie ersetzt, nie angezeigt.
       12 Bewertung, 13 Deal-Aktion  Westerfeldstr. 140 (MFH, 4 WE)
       14 Bestand  Parkstr. 9 (gewonnen, Ankauf-Stand) - Kopie MIT Gewonnen-Status
     Kein KI-Abruf: die Analyse ist ein Mitschnitt (11) oder die gespeicherte (12-14). Gesperrt (RH_SPERRE):
     KI, Marktbericht, BMF, Partner-/Netzwerk-/Ämter-Anfragen, Pässe,
     Portfolio-Spiegel. Geklickt werden nur Reiter, Unter-Reiter und der
     Soll/Ist-Umschalter - kein Deal-Status, kein PDF, kein „Stand neu nehmen". */
  var R11_WESTERFELD = 'ae155d38-c0ea-462b-8b69-253e9eb311a8', R11_PARK = '0da7e9b6-da19-4910-8259-905f5ac10123';
  var R11_VERBOTEN = /scout|immowelt|wohnungsboerse|immonet|kleinanzeig/i;
  function r11Panel() { return [].filter.call(document.querySelectorAll('#ai-content .dp-pa-panel'), function (x) { return x.offsetWidth > 0; })[0] || null; }
  async function r11PaTab(re) {
    var t = [].filter.call(document.querySelectorAll('#ai-content .dp-pa-tab'), function (b) { return b.offsetWidth && re.test(r6Text(b)); })[0];
    /* GEMESSEN (Prueflauf 11): der neue Unter-Reiter erbte die Rollposition des
       vorigen - im Abschnitt Lage stand 0,6 s die Quellenliste im Bild. Erst
       nach oben, dann umschalten. */
    var m = q('.main-col'); if (m) m.scrollTop = 0;
    if (t) t.click();
    await warte(700);
    return !!t;
  }
  /* die Karte eines Abschnitts: .dp-pa-card, deren erster Kopf passt */
  function r11Karte(re) {
    return function () {
      var p = r11Panel(); if (!p) return null;
      return [].filter.call(p.querySelectorAll('.dp-pa-card'), function (c) { var s = c.querySelector('.dp-pa-sec'); return s && re.test(r6Text(s)); })[0] || null;
    };
  }
  function r11Text(re, wo) { var m = re.exec(r6Inner(wo || r11Panel())); return m ? m[1].trim() : null; }
  /* liegt ein Portalname gerade im Bild? (Regel: keine Datenquelle nach außen) */
  function r11VerbotenImBild() {
    var tw = document.createTreeWalker(q('#ai-content') || document.body, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())) {
      if (!R11_VERBOTEN.test(n.nodeValue) || !n.parentElement || !n.parentElement.offsetWidth) continue;
      var rg = document.createRange(); rg.selectNodeContents(n); var b = rg.getBoundingClientRect();
      if (b.width && b.bottom > 0 && b.top < innerHeight) return true;
    }
    return false;
  }
  /* ein Element mit seiner UNTERKANTE an den unteren Bildrand (darunter liegt
     im Abschnitt Lage die Gegenüberstellung mit den Portal-Quellen) */
  async function r11Unten(fn) {
    var e = fn(); if (!e) return;
    var s = scroller(e), r = rect(e);
    s.scrollTop += r.bottom - (innerHeight - unten() - 30);
    await warte(300);
  }
  function r11Kurz(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t; }

  /* ── MODUL 11 · PILOT-ANALYSE IM DETAIL ──────────────────────────── */
  DREHBUECHER['reihe-pilot'] = {
    titel: 'Pilot-Analyse im Detail', unterzeile: 'Die KI-Einschätzung Abschnitt für Abschnitt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await rhLaden();
        var pa = (window.DPM_REIHE_DATEN || {}).pilot; if (!pa) throw new Error('Mitschnitt pilot fehlt - die gespeicherte Analyse nennt Portale');
        await r6KopieStart(R11_WESTERFELD, { ohneAnkauf: true, analyse: pa });
        await r11Beispiel(s, ' Heute: die <b>Pilot-Analyse</b>.');
      },
      async function (s) {   /* 2 · Aufruf und was sie liest */
        reiter('s5'); await warte(1200);
        await warteAuf(function () { return q('#ai-content .dp-pa-tab'); }, 6000);
        var n = [].filter.call(document.querySelectorAll('#ai-content .dp-pa-tab'), function (b) { return b.offsetWidth; }).length;
        await zeige(function () { var t = q('#ai-content .dp-pa-tab'); return t && t.parentElement; }, 8);
        await b2oZeile(s, 'Was der Pilot liest', 'Alle Reiter auf einmal: Objekt, Miete, Finanzierung, Steuer, Marktbewertung und Lage. Heraus kommen <b>' + n + ' Abschnitte</b>.');
      },
      async function (s) {   /* 3 · Stand */
        await zeige(function () { return q('#ai-content .dp-pa-stand'); }, 8);
        var st = r6Text(q('#ai-content .dp-pa-stand')), d = /Stand ([\d.]+)/.exec(st), ab = /seitdem (?:hat|haben) sich (.+?) geändert/.exec(st);
        await b2oZeile(s, 'Der Stand', 'Die Analyse ist vom <b>' + (d ? d[1] : '–') + '</b>. ' + (ab ? 'Seitdem geändert: <b>' + ab[1] + '</b> — der Pilot sagt es dir, statt alte Sätze als aktuell zu verkaufen.' : 'Ändern sich die Zahlen, sagt der Pilot es dir hier.'));
      },
      async function (s) {   /* 4 · Gesamturteil */
        await r11PaTab(/^Briefing$/);
        var urteil = r6Text(q('#ai-content .dp-pa-empf-row'));
        await zeige(function () { return q('#ai-content .dp-pa-empf-row') && q('#ai-content .dp-pa-empf-row').closest('.dp-pa-card'); }, 8);
        await b2oZeile(s, 'Das Gesamturteil', 'Ganz oben die Empfehlung: <b>' + (urteil || '–') + '</b>. Darunter Gesamtbewertung und Begründung — in ganzen Sätzen, mit deinen Zahlen.');
        await zeige(r11Karte(/^SCORE-VERGLEICH$/), 8);
        await b2oZeile(s, 'Score-Vergleich und Investor-Fit', 'Warum DealScore und Investor-DealScore auseinanderliegen — und ob das Objekt zu deinen Zielen passt.');
      },
      async function (s) {   /* 5 · Stärken und Risiken */
        await r11PaTab(/^Stärken/);
        var k = function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-cols'); };
        await zeige(k, 8);
        var c = k(), ns = c ? c.children[0].querySelectorAll('li').length : 0, nr = c && c.children[1] ? c.children[1].querySelectorAll('li').length : 0;
        await b2oZeile(s, 'Stärken und Risiken', '<b>' + ns + ' Stärken</b>, <b>' + nr + ' Risiken</b> — jeweils kurz begründet, nebeneinander zum Abwägen.');
        var f = r11Karte(/^OPTISCHER EINDRUCK/);
        if (f()) { await zeige(f, 8); await b2oZeile(s, 'Der Blick auf die Fotos', 'Liegen Fotos am Objekt, schaut der Pilot hin: Zustand, Pflege, was ins Auge fällt.'); }
      },
      async function (s) {   /* 6 · Risiko und Szenarien */
        await r11PaTab(/^Risiko/);
        await zeige(r11Karte(/^ANSCHLUSSFINANZIERUNG$/), 8);
        await b2oZeile(s, 'Anschlussfinanzierung', 'Was passiert nach der Zinsbindung, wenn der Zins steigt? Der Pilot rechnet es durch.');
        var w = function () { var p = r11Panel(); var c = p && [].filter.call(p.querySelectorAll('.dp-pa-cols'), function (x) { return /WORST CASE/.test(x.textContent); })[0]; return c || null; };
        await zeige(w, 8);
        /* v2266 · die Unterzeile der Karte (.dp-pa-kv-sub) per textContent - innerText
           lieferte sie in Versalien („MIETE -10%") */
        var sub = function (re) { var c = w(); var k = c && [].filter.call(c.querySelectorAll('.dp-pa-card'), function (x) { return re.test(r6Text(x.querySelector('.dp-pa-sec') || x)); })[0]; var u = k && k.querySelector('.dp-pa-kv-sub'); return u ? u.textContent.trim().replace(/(\d)%/g, '$1 %') : null; };
        var wc = sub(/WORST CASE/i) || r11Text(/WORST CASE\s*\n\s*([^\n]+)/), bc = sub(/BEST CASE/i) || r11Text(/BEST CASE\s*\n\s*([^\n]+)/);
        await b2oZeile(s, 'Worst Case und Best Case', 'Zwei Szenarien' + (wc ? ': schlecht <b>' + wc + '</b>' : '') + (bc ? ', gut <b>' + bc + '</b>' : '') + ' — mit dem, was dann vom Cashflow bleibt.');
      },
      async function (s) {   /* 7 · Lage und Markt (ohne die Portal-Quellen) */
        await r11PaTab(/^Lage/);
        var k1 = function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-card'); };
        await zeige(k1, 8);
        await r11Unten(k1);
        if (!r11VerbotenImBild()) await b2oZeile(s, 'Lage und Markt', 'Makro- und Mikrolage recherchiert: Einwohner, Arbeitsmarkt, Nachfrage, Umfeld der Straße.');
        /* v2266 · der Abgleich steht nur, wenn ein Marktbericht vorlag (an der Kopie
           der Westerfeldstr. nicht) - dann die Gegenüberstellung je Merkmal */
        var k2 = function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-abgl'); };
        var k3 = function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-ggs'); };
        if (k2()) {
          await zeige(k2, 8);
          await r11Unten(k2);
          if (!r11VerbotenImBild()) await b2oZeile(s, 'Abgleich mit dem Marktbericht', 'Wo die Recherche dem Marktbericht zustimmt — und wo sie abweicht. Abweichungen nennt der Pilot ausdrücklich.');
        } else if (k3()) {
          await zeige(k3, 8);
          await r11Unten(k3);
          if (!r11VerbotenImBild()) await b2oZeile(s, 'Gegenüberstellung', 'Je Merkmal deine Angabe neben der Recherche — mit Quelle und Urteil. Wo es nicht passt, sagt der Pilot es.');
        }
      },
      async function (s) {   /* 8 · Verhandlung */
        await r11PaTab(/^Verhandlung/);
        await zeige(r11Karte(/^VERHANDLUNGSEMPFEHLUNG$/), 8);
        await b2oZeile(s, 'Verhandlungsempfehlung', 'Wo du ansetzen kannst — mit den Argumenten aus deinen Zahlen und dem Marktbericht.');
        var o = function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-offerte'); };
        await zeige(o, 8);
        var off = r11Text(/KAUFPREIS-OFFERTE\s*\n\s*([\d.]+ €)/), kp = zahl('kp'), on = off ? Number(off.replace(/\D/g, '')) : null;
        var ab = (on && kp) ? Math.round((1 - on / kp) * 1000) / 10 : null;
        await b2oZeile(s, 'Die Kaufpreis-Offerte', 'Empfohlen: <b>' + (off || '–') + '</b> statt ' + eur(kp) + (ab != null && ab > 0 ? ' — ' + String(ab).replace('.', ',') + ' % darunter' : '') + '. Mit Begründung, die du dem Verkäufer nennen kannst.');
        var m = function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-offmail'); };
        await zeige(m, 8);
        await b2oZeile(s, 'Offerte als E-Mail', 'Fertig formuliert — als E-Mail öffnen oder kopieren. Abgeschickt wird nur, was du selbst abschickst.');
      },
      async function (s) {   /* 9 · Bank und Steuer */
        await r11PaTab(/^Bank$/);
        await zeige(r11Karte(/^BANKARGUMENTE$/), 8);
        await b2oZeile(s, 'Bankargumente', 'Was du im Bankgespräch sagst: Kapitaldienst, Beleihung, Sicherheiten — kurz und belastbar.');
        await r11PaTab(/^Steuer$/);
        await zeige(function () { var p = r11Panel(); return p && p.querySelector('.dp-pa-card'); }, 8);
        await b2oZeile(s, 'Steuerliche Zusammenfassung', 'Was die Abschreibung und die Werbungskosten im Jahr bringen. Keine Steuerberatung — der Pilot sagt das auch dazu.');
      },
      async function (s) {   /* 10 · was sie NICHT tut */
        await r11PaTab(/^Briefing$/);
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#ai-content .dp-pa-stand'); }, 8);
        await b2oZeile(s, 'Was der Pilot nicht tut', 'Kennzahlen und Scores kommen aus DealPilot, der Pilot ordnet sie ein. Er ersetzt kein Gutachten und keine Steuerberatung — und er kauft nichts für dich.', 600);
      }
    ]
  };

  async function r11Beispiel(s, rest) {
    var m = q('.main-col'); if (m) m.scrollTop = 0;
    await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
    var we = wert('einheiten');
    await b2oZeile(s, 'Das Beispiel', 'Ein Mehrfamilienhaus: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + de(zahl('wfl')) + ' m², Baujahr ' + wert('baujahr') + ', Kaufpreis ' + eur(zahl('kp')) + '.' + (rest || ''));
  }
  /* ── MODUL 12 · BEWERTUNG UND KPIS ───────────────────────────────── */
  function r12Karte(i) { return function () { return document.querySelectorAll('#s6 .dpsh-body')[i] || null; }; }
  function r12Kopf(i) {   /* Score, Stufe, Datentiefe aus dem Kopf der Karte */
    var k = r12Karte(i)(), t = k ? r6Inner(k.querySelector('.dpsh-mainrow') || k) : '';
    var sc = /(\d+)\s*\n\s*\/\s*100/.exec(t), dt = /DATENTIEFE\s*([\d,]+\s*%)/i.exec(t), w = /DATENTIEFE[^\n]*\n\s*([A-ZÄÖÜ ]+)\n/.exec(t);
    return { score: sc ? sc[1] : null, tiefe: dt ? dt[1] : null, wort: w ? w[1].trim() : null };
  }
  function r12Wort(w) { return w ? w.charAt(0) + w.slice(1).toLowerCase() : '–'; }   /* Fließtext in Kamelschrift (SEHR GUT -> Sehr gut) */
  function r12Teile(i) {   /* [Name, Gewicht, Teilnote] je Balken */
    var k = r12Karte(i)(); if (!k) return [];
    return [].map.call(k.querySelectorAll('.dpsh-cbar'), function (b) {
      var n = b.querySelector('.dpsh-cbar-name'), g = n && n.querySelector('.dpsh-kpi'), sc = b.querySelector('.dpsh-cbar-score');
      var name = n ? r6Text(n).replace(g ? r6Text(g) : '', '').trim() : '';
      return { name: name, gewicht: g ? r6Text(g).replace(/\s*%/, ' %') : '', note: sc ? (/(\d+)/.exec(r6Text(sc)) || [])[1] : '' };
    });
  }
  function r12Bewertung(re) {   /* Zeile der Kennzahlen-Bewertung: Wert und Wort */
    var t = q('#s6 .kpi-eval-card table'); if (!t) return null;
    var r = [].filter.call(t.rows, function (x) { return x.cells[0] && re.test(r6Text(x.cells[0])); })[0];
    return r ? { wert: r6Text(r.cells[1]), wort: r6Text(r.cells[2]) } : null;
  }
  function r12Kpi(re) {   /* Zeile im Fenster „Alle KPIs" */
    var o = q('.dpshm-overlay'); if (!o) return null;
    return [].filter.call(o.querySelectorAll('.dpshm-kpi'), function (x) { var n = x.querySelector('.dpshm-kpi-nm'); return n && re.test(r6Text(n).replace(/f\(x\)$/, '')); })[0] || null;
  }
  function r12SetFeld(re, treppe) {   /* Eingabe in den Einstellungen über ihre Beschriftung; treppe: nur Grenzwerte („0.9:0, …“) */
    var c = q('.settings-modal .set-modal-content'); if (!c) return null;
    return [].filter.call(c.querySelectorAll('input'), function (x) { var f = x.closest('div'), l = f && f.querySelector('label'); return x.offsetWidth && l && re.test(r6Text(l)) && (!treppe || /:/.test(x.value)); })[0] || null;
  }
  function r12Punkte(v) {   /* „0.9:0, 1:40, 1.3:100" -> „ab 1,0 → 40 Punkte …" */
    return String(v || '').split(',').map(function (p) { var a = p.split(':'); return a.length === 2 ? r6Pz(a[0].trim()) + ' → ' + a[1].trim() : ''; }).filter(Boolean).join(' · ');
  }
  function r12Zu() {
    try { if (window.DealPilotScoreHero) { DealPilotScoreHero.closeParts(); DealPilotScoreHero.closeKpi(); } } catch (e) {}
    try { if (window._SetDraft) window._SetDraft.dirty = false; } catch (e) {}
    r6EinstellungenZu();
  }
  DREHBUECHER['reihe-bewertung'] = {
    titel: 'Bewertung und KPIs', unterzeile: 'Kennzahlen, Ampeln, DealScore und Investor-DealScore', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: function () { r12Zu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R11_WESTERFELD, { ohneAnkauf: true });
        await r11Beispiel(s, ' Heute: der Reiter <b>Bewertung</b>.');
      },
      async function (s) {   /* 2 · Kennzahlen mit Ampel */
        reiter('s6'); await warte(1400);
        var tb = function () { return q('#s6 .kpi-eval-card'); };
        await warteAuf(tb, 6000);
        await zeige(tb, 8);
        var d = r12Bewertung(/^DSCR/), c = r12Bewertung(/^Cashflow vor/), b = r12Bewertung(/^Bruttomiet/), n = r12Bewertung(/^Nettomiet/), e = r12Bewertung(/^EK-Rendite/), l = r12Bewertung(/^LTV/);
        function f(x, nm) { return x ? nm + ' <b>' + x.wert + '</b> ' + x.wort.toLowerCase() : ''; }
        await b2oZeile(s, 'Jede Kennzahl mit Ampel', [f(d, 'DSCR'), f(c, 'Cashflow'), f(b, 'Bruttorendite')].filter(Boolean).join(', ') + '.');
        await b2oZeile(s, 'Jede Kennzahl mit Ampel', [f(n, 'Nettorendite'), f(e, 'EK-Rendite'), f(l, 'LTV')].filter(Boolean).join(', ') + ' — mit einem Satz, was das heißt.');
      },
      async function (s) {   /* 3 · Formel und Zielwert */
        try { DealPilotScoreHero.openKpi(); } catch (e) {}
        await warteAuf(function () { return q('.dpshm-overlay .dpshm-kpi'); }, 5000);
        kegelHoch(true); await warte(800);
        var br = function () { return r12Kpi(/^Bruttorendite/); };
        await zeige(br, 6);
        var h = br() ? r6Inner(br()).split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : [];
        await b2oZeile(s, 'Zielwert je Kennzahl', 'Bruttorendite <b>' + (h[2] || '–') + '</b>, ' + String(h[3] || '').replace(/\/100$/, '') + ' von 100 Punkten. Daneben der Maßstab: „' + (h[1] || '') + '“');
        var zb = r6Beginn(s, 'Die Formel', 'Ein Klick auf die Kennzahl zeigt, wie sie gerechnet wird — und welche Felder einfließen.');
        await warte(1500);
        if (br()) br().click();
        await warteAuf(function () { return q('#dpsh-parts-overlay .dpshp-formula'); }, 4000);
        await r6Ende(zb);
        await zeige(function () { return q('#dpsh-parts-overlay .dpshp-modal'); }, 6);
        await b2oZeile(s, 'Die Formel', 'Bruttorendite = <b>' + r6Text(q('#dpsh-parts-overlay .dpshp-formula')).replace(/^FORMEL\s*/i, '') + '</b>. Jedes Feld darunter springt direkt in seinen Reiter.');
        try { DealPilotScoreHero.closeParts(); } catch (e) {}
        await warte(700);
        var ds = function () { return r12Kpi(/^DSCR/); };
        await zeige(ds, 6);
        var hd = ds() ? r6Inner(ds()).split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : [];
        await b2oZeile(s, 'Und so für jede Kennzahl', 'DSCR <b>' + (hd[2] || '–') + '</b>: „' + (hd[1] || '') + '“ — Rendite, Finanzierung, Risiko, Lage, Potenzial.');
        try { DealPilotScoreHero.closeKpi(); } catch (e) {}
        kegelHoch(false); await warte(700);
      },
      async function (s) {   /* 4 · eigene Schwellen */
        await r6Einstellungen('standardwerte');
        var K = /^Persönliche Mindest/;
        await zeige(r6Karte('.settings-modal', K), 8);
        var dm = r6SwkWert(K, /^DSCR$/), cm = r6SwkWert(K, /^Cashflow$/), lm = r6SwkWert(K, /^max\. LTV$/);
        function da(x) { return x && !/^[–—-]$/.test(x.trim()); }
        var gz = [da(dm) ? 'Mindest-DSCR <b>' + dm + '</b>' : '', da(cm) ? 'Mindest-Cashflow <b>' + cm + '</b>' : '', da(lm) ? 'höchstens <b>' + lm + '</b> LTV' : ''].filter(Boolean);
        await b2oZeile(s, 'Deine eigenen Grenzen', 'Einstellungen › Standardwerte: ' + (gz.length ? gz.join(', ') : 'Mindest-DSCR, Mindest-Cashflow, höchster LTV') + ' — als Marker an den Kennzahlen.');
        r6EinstellungenZu(); await warte(700);
      },
      async function (s) {   /* 5 · DealPilot Score */
        reiter('s6'); await warte(1000);
        await zeige(function () { var k = r12Karte(0)(); return k && k.querySelector('.dpsh-mainrow'); }, 8);
        var h = r12Kopf(0), st = [85, 70, 50, 35, 34].map(function (x) { try { return ScoreTier.stufe(x).wort; } catch (e) { return null; } });
        await b2oZeile(s, 'Der DealPilot Score', '<b>' + (h.score || '–') + ' von 100 · ' + r12Wort(h.wort) + '</b>. Die Stufen: ab 85 ' + st[0] + ', ab 70 ' + st[1] + ', ab 50 ' + st[2] + ', ab 35 ' + st[3] + ', darunter ' + st[4] + '.');
      },
      async function (s) {   /* 6 · Teilnoten und Gewichte */
        await zeige(function () { var k = r12Karte(0)(); var b = k && k.querySelectorAll('.dpsh-cbar'); return b && b.length ? b2oHuelle(b[0], b[b.length - 1]) : null; }, 8);
        var t = r12Teile(0);
        await b2oZeile(s, 'Teilnoten und Gewichte', t.map(function (x) { return x.name.replace(/\s*\(.*\)$/, '') + ' ' + x.gewicht + ': <b>' + x.note + '</b>'; }).join(' · ') + '.');
      },
      async function (s) {   /* 7 · Gewichte und Grenzwerte in den Einstellungen */
        await r6Einstellungen('dealscore');
        await warteAuf(function () { return q('#set-ds-cashflow'); }, 5000);
        await zeigeGruppe(function () { return q('#set-ds-cashflow') && q('#set-ds-cashflow').closest('div'); }, function () { return q('#set-ds-potenzial') && q('#set-ds-potenzial').closest('div'); }, 8);
        await b2oZeile(s, 'Die Gewichte stellst du ein', 'Einstellungen › Deal Score: Cashflow ' + wert('set-ds-cashflow') + ' %, Rendite ' + wert('set-ds-rendite') + ' %, LTV ' + wert('set-ds-ltv') + ' %, DSCR ' + wert('set-ds-risiko') + ' %, Potenzial ' + wert('set-ds-potenzial') + ' %.');
        var g = function () { return r12SetFeld(/^DSCR$/, true); };
        await zeige(function () { var e = g(); return e && e.closest('div'); }, 10);
        await b2oZeile(s, 'Punkte je Wert', 'Wie viele Punkte ein Wert bringt, steht als Treppe: DSCR <b>' + r12Punkte(g() && g().value) + '</b>.');
      },
      async function (s) {   /* 8 · Investor-Profile */
        function pc(i) { return function () { var a = document.querySelectorAll('.settings-modal .ds2-preset-card'); return a.length ? a[i < 0 ? a.length - 1 : i] : null; }; }
        await zeigeGruppe(pc(0), pc(-1), 8);   /* GEMESSEN: die Hülle allein scrollte das Fenster nicht, Kegel 0 % */
        var namen = [].map.call(document.querySelectorAll('.settings-modal .ds2-preset-card .ds2-preset-label'), function (x) { return r6Text(x); }).filter(Boolean);
        var akt = q('.settings-modal .ds2-preset-card.ds2-preset-active .ds2-preset-label');
        await b2oZeile(s, 'Investor-DealScore: dein Profil', namen.slice(0, 6).join(', ') + ' — oder eigene Gewichte. In diesem Konto aktiv: <b>' + (akt ? r6Text(akt) : '–') + '</b>.');
        r12Zu(); await warte(700);
      },
      async function (s) {   /* 9 · Investor-DealScore */
        reiter('s6'); await warte(900);
        await zeige(r12Karte(1), 8);
        var h = r12Kopf(1), t = r12Teile(1), kp = /(\d+\s*\/\s*\d+)\s*\n\s*DATENTIEFE\s*\n/i.exec(r6Inner(r12Karte(1)()));   /* GEMESSEN: „ALLE KPIS" steht auch im Kopf, davor griff das Muster den Score (74/100) */
        await b2oZeile(s, 'Der Investor-DealScore', '<b>' + (h.score || '–') + ' von 100 · ' + r12Wort(h.wort) + '</b> aus ' + (kp ? kp[1].replace(/\s/g, '') : '–') + ' Kennzahlen — ' + t.map(function (x) { return x.name + ' ' + x.gewicht; }).join(', ') + '.');
        var lk = wert('lageklasse');
        await b2oZeile(s, 'Lage zählt mit', 'Lage & Markt: Teilnote <b>' + ((t.filter(function (x) { return /^Lage/.test(x.name); })[0] || {}).note || '–') + '</b>' + (lk ? ', das Objekt steht in Lageklasse <b>' + lk + '</b>' : '') + ' — Mikrolage, Nachfrage, Bevölkerung, Marktmiete gegen Ist.');
      },
      async function (s) {   /* 10 · warum zwei Scores */
        function kopf(i) { return function () { var k = r12Karte(i)(); return k && k.querySelector('.dpsh-headrow'); }; }
        await zeigeGruppe(kopf(0), kopf(1), 6);   /* beide Karten zusammen sind höher als das Bild (gemessen Kegel 69 %) */
        await b2oZeile(s, 'Warum zwei Scores', 'Der <b>DealPilot Score</b> braucht nur fünf Kennzahlen — wie im Quick Boarding. Der <b>Investor-DealScore</b> wiegt alles, auch Lage und Zustand.', 600);
      }
    ]
  };

  /* ── MODUL 13 · DEAL-AKTION ──────────────────────────────────────── */
  function r13Band(re) {
    return function () {
      var b = [].filter.call(document.querySelectorAll('#s8 .dab-band'), function (x) { return x.offsetWidth && re.test(r6Text(x.querySelector('.dab-band-t') || x)); })[0];
      var p = b && b.nextElementSibling;
      return b && p ? b2oHuelle(b, p) : b;
    };
  }
  /* Band und Feld darunter über zeigeGruppe - die Hülle allein scrollte nicht
     (gemessen Bordkarte: Kegel 4 %) */
  async function r13Zeige(re) {
    function band() { return [].filter.call(document.querySelectorAll('#s8 .dab-band'), function (x) { return x.offsetWidth && re.test(r6Text(x.querySelector('.dab-band-t') || x)); })[0] || null; }
    await zeigeGruppe(band, function () { var b = band(); return b && b.nextElementSibling; }, 6);
  }
  function r13Bp(re) {   /* Netzwerk-Karte über ihren Namen */
    return [].filter.call(document.querySelectorAll('#s8 .dab-bp'), function (x) { return x.offsetWidth && re.test(x.textContent); })[0] || null;
  }
  DREHBUECHER['reihe-dealaktion'] = {
    titel: 'Deal-Aktion', unterzeile: 'Bereit für die Bank, Unterlagen, Netzwerk', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: rhAufraeumen,
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R11_WESTERFELD, { ohneAnkauf: true });
        await r11Beispiel(s, ' Heute: die <b>Deal-Aktion</b> — was nach der Analyse kommt.');
      },
      async function (s) {   /* 2 · Bereit für die Bank */
        reiter('s8'); await warte(1400);
        await warteAuf(function () { return q('#dab-cockpit .dab-donut'); }, 6000);
        await zeige(function () { var r = q('#dab-cockpit .dab-rowflex'); return r && r.parentElement; }, 8);
        var t = r6Inner(q('#dab-cockpit .dab-rowflex')), pz = /(\d+)\s*\n?\s*\/\s*100/.exec(t), fe = /(\d+\s*\/\s*\d+)\s*Grundfelder/.exec(t);
        await b2oZeile(s, 'Bereit für die Bank?', 'Der Vorflug-Check: <b>' + (pz ? pz[1] + ' %' : '–') + '</b> — ' + (fe ? fe[1].replace(/\s/g, '') : '–') + ' Grundfelder befüllt, die eine Bank für ihre Bewertung braucht.');
        var ch = [].map.call(document.querySelectorAll('#dab-cockpit .dab-chip'), function (x) { return r6Text(x); });
        await zeige(function () { return q('#dab-cockpit .dab-chips'); }, 8);
        await b2oZeile(s, 'Was noch fehlt', ch.length ? 'Fehlt: <b>' + ch.slice(0, 4).join(', ') + '</b> — ein Klick springt ins Feld.' : 'Alle Grundfelder sind da.');
      },
      async function (s) {   /* 3 · Deal-Status und Ankauf-Stand */
        await zeige(function () { return q('#dab-cockpit .dab-tafel'); }, 8);
        var a = q('#dab-cockpit .da-status-tile.active .dab-row-main');
        await b2oZeile(s, 'Bereit zum Abflug', 'Der Deal-Status: <b>' + (a ? r6Text(a).replace(/\s*(Deal|BOARDING|ABGEFLOGEN|GESTRICHEN).*$/, '') : 'Offen') + '</b>. Steht der Zuschlag fest: gewonnen oder verloren.');
        await b2oZeile(s, 'Gewonnen heißt: Soll steht fest', 'Bei „Gewonnen“ friert DealPilot den Ankauf-Stand ein — das Soll für den Soll-Ist-Vergleich im Bestand (Modul 14). Im Video bleibt der Deal offen.');
      },
      async function (s) {   /* 4 · Dokumente und Exporte */
        await r13Zeige(/^Dokumente/);
        var n = [].filter.call(document.querySelectorAll('#s8 .dab-panel'), function (p) { return /Investment-PDF/.test(p.textContent); })[0];
        /* aus dem Text, nicht aus Blattknoten: „Investment-PDF" trägt ein Abzeichen und ist kein Blatt (gemessen: fehlte) */
        var z = n ? (r6Inner(n).match(/^\s*(Investment-PDF|Finanzamt-PDF|Kaufpreisaufteilung|Track Record)/gm) || []).map(function (x) { return x.trim(); }) : [];
        await b2oZeile(s, 'Dokumente und Exporte', (z.length ? '<b>' + z.join(', ') + '</b>' : 'Die PDFs') + ' — fertig aus den Daten des Objekts, für Bank, Finanzamt und dich.');
      },
      async function (s) {   /* 5 · Bordkarte und Unterlagen */
        await r13Zeige(/^Bordkarte/);
        var p = [].filter.call(document.querySelectorAll('#s8 .dab-ct'), function (x) { return /Persönliche/.test(x.textContent); })[0], o = [].filter.call(document.querySelectorAll('#s8 .dab-ct'), function (x) { return /Objekt-Unterlagen/.test(x.textContent); })[0];
        function n(e) { return e && e.parentElement ? e.parentElement.querySelectorAll('li').length || ([].filter.call(e.parentElement.children, function (c) { return c !== e; }).length) : 0; }
        await b2oZeile(s, 'Bordkarte und Unterlagen', 'Die Checkliste fürs Bankgespräch: <b>' + n(p) + ' persönliche</b> und <b>' + n(o) + ' Objekt-Unterlagen</b> — Ausweis, Gehaltsnachweise, Grundbuch, Wohnflächenberechnung.');
        var am = function () { return r6Knopf('#s8', /Unterlagen beim Amt anfordern/); };
        await zeige(function () { var b = am(); return b && (b.parentElement || b); }, 8);
        await b2oZeile(s, 'Unterlagen vom Amt', 'Flurkarte, Grundbuch, Baulasten, Altlasten, Bauakte: DealPilot findet die zuständige Stelle und schreibt den Antrag. Abgeschickt wird hier nichts.');
        var dr = function () { var t = q('#s8 .dab-dr-t'); return t && (t.closest('.dab-dr') || t.parentElement.parentElement); };
        await zeige(dr, 8);
        await b2oZeile(s, 'Der Datenraum', 'Persönlicher und Objekt-Datenraum: einmal hochgeladen, gehen die Unterlagen jeder Bank-Anfrage automatisch mit.');
      },
      async function (s) {   /* 6 · Netzwerk */
        await r13Zeige(/^Dein Netzwerk/);
        var n = [].filter.call(document.querySelectorAll('#s8 .dab-bp'), function (x) { return x.offsetWidth; }).length;
        await b2oZeile(s, 'Dein Netzwerk', 'Geprüfte Partner: Finanzierung und Banken, Gutachter, Beratung — das Objekt geht mit allen Daten an den, den du wählst.');
        var bp = function () { return [].filter.call(document.querySelectorAll('#s8 .dab-bp'), function (x) { return x.offsetWidth && x.querySelector('.dab-req'); })[0] || null; };
        /* gemessen: .dab-req ist der Kasten, die Bedingungen sind seine li */
        await zeigeGruppe(function () { var b = bp(); return b && b.querySelector('.dab-req'); }, function () { var b = bp(), a = b ? b.querySelectorAll('.dab-req ~ *, .dab-req') : []; return a.length ? a[a.length - 1] : null; }, 8);
        var rq = bp() ? [].map.call(bp().querySelectorAll('.dab-req li'), function (r) { return r6Text(r).replace(/^✕\s*/, '').replace(/\s*Beheben$/, ''); }) : [];
        await b2oZeile(s, 'Erst die Voraussetzungen', 'Weitergereicht wird erst, wenn alles da ist: <b>' + (rq.join(', ') || '–') + '</b>. Bis dahin bleibt die Anfrage gesperrt.');
      },
      async function (s) {   /* 7 · Gutachter und Beratung */
        var g = function () { var h = [].filter.call(document.querySelectorAll('#s8 .dab-rh-n'), function (x) { return /^Gutachter/.test(r6Text(x)); })[0]; return h && h.closest('.dab-rail-head'); };
        await zeigeGruppe(g, function () { var h = g(); return h && h.nextElementSibling; }, 8);   /* Kopf + Schiene (gemessen: Kegel 65 % auf dem ganzen Feld) */
        await b2oZeile(s, 'Gutachter und Beratung', 'Verkehrswert- oder Restnutzungsdauer-Gutachten, Zweitmeinung vor dem Kauf — die Anfrage nimmt die Objektdaten mit. Im Video schicken wir nichts ab.', 600);
      }
    ]
  };

  /* ── MODUL 14 · VOM ANKAUF IN DEN BESTAND ────────────────────────── */
  function r14Seg(re) { return [].filter.call(document.querySelectorAll('.ank-wahl .ank-seg'), function (b) { return re.test(b.textContent); })[0] || null; }
  DREHBUECHER['reihe-bestand'] = {
    titel: 'Vom Ankauf in den Bestand', unterzeile: 'Gewonnen, eingefroren, verglichen', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { try { var i = r14Seg(/Ist/); if (i && window.DealPilotAnkaufAnsicht && DealPilotAnkaufAnsicht.aktiv()) i.click(); } catch (e) {} rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Objekt */
        await r6KopieStart(R11_PARK, { behalte: true });
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var we = wert('einheiten');
        await b2oZeile(s, 'Das Beispiel', 'Ein Altbau im Bestand: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + 'Baujahr ' + wert('baujahr') + '.');
      },
      async function (s) {   /* 2 · gewonnen -> Bestand */
        reiter('s8'); await warte(1400);
        await warteAuf(function () { return q('#dab-cockpit .dab-tafel'); }, 6000);
        await zeige(function () { return q('#dab-cockpit .dab-tafel'); }, 8);
        var a = q('#dab-cockpit .da-status-tile.active .dab-row-main');
        await b2oZeile(s, 'Auf „gewonnen“ gestellt', 'In der Deal-Aktion: <b>' + (a ? r6Text(a).replace(/\s*(Deal|BOARDING|ABGEFLOGEN|GESTRICHEN).*$/, '') : '–') + '</b>. Damit wandert das Objekt in den Bestand — die Liste links trennt Ankauf und Bestand.');
      },
      async function (s) {   /* 3 · Ankauf-Stand eingefroren */
        var A = null; try { A = DealPilotAnkauf.stand(); } catch (e) {}
        var row = function () { return rhIm('#dab-cockpit .dab-tafel', /Ankauf-Stand festgeschrieben/); };
        await zeige(function () { var r = row(); return r && (r.closest('div[class]') || r); }, 8);
        await b2oZeile(s, 'Der Ankauf-Stand', 'Eingefroren zum <b>' + datum(A && A.stichtag) + '</b>' + (A && A.kurz && A.kurz.kp ? ', Kaufpreis ' + eur(A.kurz.kp) : '') + ' — alle Zahlen des Kaufs. Das ist dein Soll.');
      },
      async function (s) {   /* 4 · Soll · der Plan */
        reiter('s2'); await warte(900);
        await zeige('.ank-wahl', 8);
        var zb = r6Beginn(s, 'Soll und Ist umschalten', 'Oben im Objekt: der Stand beim Kauf oder der von heute.');
        await warte(1500);
        var seg = r14Seg(/Soll/); if (seg) seg.click();
        await warteAuf(function () { return window.DealPilotAnkaufAnsicht && DealPilotAnkaufAnsicht.aktiv(); }, 8000);
        await warte(600);
        await r6Ende(zb);
        if (!q('#s2.active')) reiter('s2');
        await zeige(nkmFeld, 10);
        var K = (DealPilotAnkauf.stand() || {}).kurz || {};
        await b2oZeile(s, 'Soll · der Plan beim Kauf', 'Nettokaltmiete <b>' + eur(K.nkm) + '</b>' + (K._leer_einheiten ? ', ' + K._leer_einheiten + (K._leer_einheiten === 1 ? ' Wohnung' : ' Wohnungen') + ' leer' : '') + (K._kpis_dscr != null ? ', DSCR ' + de(K._kpis_dscr, 2) : '') + '.');
      },
      async function (s) {   /* 5 · Ist · heute */
        var seg = r14Seg(/Ist/);
        await zeige('.ank-wahl', 8);
        if (seg) seg.click();
        await warteAuf(function () { return window.DealPilotAnkaufAnsicht && !DealPilotAnkaufAnsicht.aktiv(); }, 8000);
        await warte(500);
        reiter('s2'); await warte(700);
        await zeige(nkmFeld, 10);
        await b2oZeile(s, 'Ist · heute', 'Nettokaltmiete heute: <b>' + eur(zahl('nkm')) + '</b>. Jede Änderung am Objekt ist das Ist — der Ankauf bleibt stehen.');
      },
      async function (s) {   /* 6 · Soll/Ist-Abgleich */
        reiter('s5'); await warte(1200);
        await r11PaTab(/Soll\/Ist/);
        var p = r11Panel(), t = r6Inner(p);
        var vg = /Von (\d+) vergleichbaren Kennzahlen stehen (\d+) besser und (\d+) schlechter/.exec(t);
        /* GEMESSEN (Aufnahme 14): die erste .dp-pa-card des Panels ist die Analyse-Tafel weiter unten - der Kegel lag dort */
        await zeige(function () { var x = rhIm(r11Panel(), /Von \d+ vergleichbaren Kennzahlen/); return x && (x.closest('p,div') || x); }, 8);
        await b2oZeile(s, 'Soll gegen Ist · automatisch', vg ? 'Von <b>' + vg[1] + ' Kennzahlen</b> stehen heute <b>' + vg[2] + ' besser</b> und <b>' + vg[3] + ' schlechter</b> als beim Kauf.' : 'Plan gegen heute, Kennzahl für Kennzahl.');
      },
      async function (s) {   /* 7 · was sich bewegt hat */
        await zeige(function () { var x = q('#ai-content .abw-bewegt'); return x || q('#ai-content .abw-tafel'); }, 8);
        var a = null; try { a = DealPilotAnkauf.abweichung(); } catch (e) {}
        function z(w) { return a && a.zeilen.filter(function (x) { return x.wort === w; })[0]; }
        var d = z('DSCR'), c = z('Cashflow n. Steuer'), sc = z('DealScore'), teile = [];
        if (d) teile.push('DSCR <b>' + de(d.ankauf, 2) + ' → ' + de(d.bestand, 2) + '</b>');
        if (c) teile.push('Cashflow nach Steuer <b>' + eur(c.ankauf) + ' → ' + eur(c.bestand) + '</b>');
        if (sc) teile.push('DealScore <b>' + de(sc.ankauf) + ' → ' + de(sc.bestand) + '</b>');
        await b2oZeile(s, 'Was sich bewegt hat', (teile.join(' · ') || '–') + ' — im Jahr.');
      },
      async function (s) {   /* 8 · die Tafel */
        await zeige(function () { return q('#ai-content .abw-tafel'); }, 6);
        var t = r6Inner(q('#ai-content .abw-tafel')), nk = /Nettokaltmiete\s+([\d.]+ €)\s+([\d.]+ €)/.exec(t), mq = /Miete je m²\s+([\d,]+ €\/m²)\s+([\d,]+ €\/m²)/.exec(t);
        await b2oZeile(s, 'Kennzahl für Kennzahl', 'Ertrag, Kosten, Finanzierung, Steuer, Ergebnis — z. B. Nettokaltmiete <b>' + (nk ? nk[1] + ' → ' + nk[2] : '–') + '</b>' + (mq ? ', je m² ' + mq[1] + ' → ' + mq[2] : '') + '. Was nicht vorlag, wird nicht geschätzt.');
      },
      async function (s) {   /* 9 · Entwicklung in der Pilot-Analyse */
        var k = function () { var x = rhIm('#ai-content', /^PILOT-ANALYSE: ANKAUF GEGEN HEUTE$/); return x && x.closest('.dp-pa-card'); };
        await zeige(k, 8);
        var t = r6Inner(k()), e = /Empfehlung\s+([^\t\n]+)\t\s*([^\n]+)/.exec(t), st = /Stand\s+([\d.]+)\s+([\d.]+)/.exec(t);
        await b2oZeile(s, 'Die Pilot-Analyse: damals und heute', 'Zwei Spalten: was der Pilot beim Ankauf sagte und was er heute sagt' + (e ? ' — hier beide <b>' + e[1].trim() + '</b>' : '') + '. Ein neuer Abruf füllt die Spalte „Heute“.', 600);
      }
    ]
  };

  /* ═══ ÜBERBLICK 2 · VOM NEUEN OBJEKT ZUM DEALSCORE UND INVESTMENT-PDF (v2263)
     Videoreihe.md, Ebene A. Kopie der Westerfeldstr. 140 (ohne Analyse, ohne
     Ankauf-Stand), am Ende gelöscht. Marktbewertung Stufe 2 = Bericht 214,
     einmal echt erzeugt (DPM_REIHE_DATEN.westerfeld), hier abgespielt.
     Das Investment-PDF entsteht lokal (exportPDFBlob, kein Abruf, kein
     Download) und wird im Bild gezeigt. Für die Dauer des Laufs trägt es
     KEINE persönlichen Kontaktdaten: branding.get liefert Name, Anschrift,
     Telefon und E-Mail leer (Marcel: Kontakt & Logo nie ins Bild). */
  var _ue2Pdf = null, _ue2Brand = null;
  function ue2Aufraeumen() {
    var o = q('#dpm-pdf'); if (o && o.parentNode) o.parentNode.removeChild(o);
    if (_ue2Pdf) { try { URL.revokeObjectURL(_ue2Pdf); } catch (e) {} _ue2Pdf = null; }
    if (_ue2Brand) { try { DealPilotConfig.branding.get = _ue2Brand; } catch (e) {} _ue2Brand = null; }
    r12Zu(); rhAufraeumen();
  }
  async function ue2PdfSeite(n) {
    var o = el('dpm-pdf');
    o.style.cssText = 'position:fixed;left:4%;right:4%;top:3%;bottom:4%;z-index:100002;background:#2b2b2b;border:2px solid ' + G + ';border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    o.innerHTML = '<iframe title="Investment-PDF" style="width:100%;height:100%;border:0" src="' + _ue2Pdf + '#page=' + n + '&toolbar=0&navpanes=0&view=FitH"></iframe>';
    await warte(4000);
  }
  DREHBUECHER['reihe-ueberblick2'] = {
    titel: 'Vom neuen Objekt zum DealScore', unterzeile: 'Der ganze Weg am Stück', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }], aufraeumen: ue2Aufraeumen,
    szenen: [
      async function (s) {   /* 1 · neues Objekt */
        await r6KopieStart(R11_WESTERFELD, { ohneAnkauf: true, ohneAnalyse: true });
        if (_rh) _rh.satz = 'westerfeld';
        await zeige(sbKnopf('new'), 10);
        await b2oZeile(s, 'Ein neues Objekt', 'Links „Neues Objekt“ — oder du übernimmst ein Ergebnis aus dem Quick Boarding (Überblick 1).');
        await r11Beispiel(s, ' Adresse, Objektart, Fläche, Baujahr — mehr braucht der Start nicht.');
      },
      async function (s) {   /* 2 · Marktbewertung Stufe 2 */
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await stufeWaehlen(2);
        await zeige(stufeZeile(2), 8);
        await b2oZeile(s, 'Marktbewertung · Stufe 2', 'Mit Kaufpreis und Miete: <b>bereit</b>. Ein Klick — DealPilot holt Lage, Vergleichspreise und Mieten.');
        await rhStufeAbrufen(2, function () { s.zeile('Marktbewertung · Stufe 2', 'Standort, Vergleichsdaten, Bodenrichtwert — Schritt für Schritt.'); });
        var k = mbKarteH() || {};
        if (m) m.scrollTop = 0;
        await zeige(function () { return q('#avsec'); }, 8);
        var ein = kartenText(/EINORDNUNG\s+(.+?)\s+GENAUIGKEIT/i);
        await b2oZeile(s, 'Marktwert und Lage', 'Marktwertindikation <b>' + (eur(k.mw && k.mw.med) || '–') + '</b>' + (ein ? ' — dein Preis: <b>' + ein + '</b>' : '') + '. Mikrolage ' + (k.mikro || '–') + ', Makrolage ' + (k.makro || '–') + '.');
      },
      async function (s) {   /* 3 · Investition */
        reiter('s1'); await warte(900);
        await zeigeGruppe(feldVon('kp'), function () { return q('#gi_val') && q('#gi_val').closest('.total-bar'); }, 8);
        /* GEMESSEN (Prueflauf Ü2): das Demo-Objekt stammt von vor v2261 und trägt
           alte Sätze (Notar/Grundbuch 2,2 %, GrESt 5,5 % in NRW). Ein neues Objekt
           bekäme die Standardwerte - die setzen wir hier sichtbar ein, die
           Grunderwerbsteuer über die PLZ-Automatik. Nur an der Kopie. */
        var zb = r6Beginn(s, 'Investition', 'Kaufpreis ' + eur(zahl('kp')) + ' — die Nebenkosten kommen aus deinen Standardwerten.');
        try {
          var IP = window.DealPilotInvestmentProfile;
          [['makler', 'maklerkosten'], ['notar', 'notar_pct'], ['gba', 'grundbuch_pct'], ['ji', 'sonstige_nk_pct']].forEach(function (x) {
            var v = IP && IP.get(x[1]); if (v == null || v === '') return;
            var e = document.getElementById(x[0] + '_p'); if (!e) return;
            e.value = String(v).replace('.', ','); e.dispatchEvent(new Event('input', { bubbles: true }));
            if (typeof window.syncCostPct === 'function') window.syncCostPct(x[0]);
          });
          var gp = q('#gest_p'); if (gp) { gp.value = ''; delete gp.dataset.userEdited; }
          var pz = q('#plz'); if (pz) pz.dispatchEvent(new Event('change', { bubbles: true }));
          if (typeof window.calc === 'function') window.calc();
        } catch (e) {}
        await warte(1500);
        try { var gp2 = q('#gest_p'); if (gp2 && !String(gp2.value).trim()) DPM_REIHE.gestLeer = true; } catch (e) {}
        await r6Ende(zb);
        var gest =(function () { var h = q('#s1 .grest-auto-hint'), x = h && /ermittelt:\s*(.+?)\s+([\d.,]+)\s*%/.exec(h.textContent); return x ? x[1] + ' ' + r6Pz(x[2]) + ' %' : r6Pz(wert('gest_p')) + ' %'; })();
        await b2oZeile(s, 'Investition', 'Kaufpreis <b>' + eur(zahl('kp')) + '</b>. Nebenkosten: Makler ' + r6Pz(wert('makler_p')) + ' %, Notar ' + r6Pz(wert('notar_p')) + ' %, Grundbuch ' + r6Pz(wert('gba_p')) + ' %, Grunderwerbsteuer ' + gest + ' nach PLZ — zusammen <b>' + r6Id('nk_sum') + '</b>.');
      },
      async function (s) {   /* 4 · Miete */
        reiter('s2'); await warte(900);
        await zeigeGruppe(feldVon('nkm'), function () { return q('#miete_qm') && q('#miete_qm').closest('.f'); }, 8);
        var mm = wert('ds2_marktmiete'), k = mbKarteH() || {}, km = k.mm && k.mm.sqm ? String(k.mm.sqm).replace(/\s*kalt$/, '') : null;
        await b2oZeile(s, 'Miete', 'Ist: <b>' + eur(zahl('nkm')) + '</b> kalt im Monat, ' + r6Id('miete_qm') + (mm ? ' — Marktmiete <b>' + mm + ' €/m²</b>' : (km ? ' — die Marktbewertung sieht <b>' + km + '</b>' : '')) + '. Der Abstand ist dein Potenzial.');
      },
      async function (s) {   /* 5 · Finanzierung */
        reiter('s3'); await warte(1000);
        await warteAuf(function () { return /\d/.test(r6Id('mrpf-top-rate-10')); }, 5000);
        /* v2272 · Kapitaldeckung: deckt das (aeltere) Darlehen die Gesamtinvestition
           nicht, zeigt die App „Es fehlen …“ - der Knopf „Darlehen anpassen“
           gleicht aus. Gemessen Westerfeld-Kopie: 592.415 gegen 620.047 EUR. */
        var _kdBtn = q('#kd-btn-d1');
        if (_kdBtn && _kdBtn.offsetParent && _kdBtn.style.display !== 'none') {
          var _kdTxt = ((q('#kd-btn-d1').closest('div') || {}).textContent || '').match(/Es fehlen[^.]*\./);
          await zeige(function () { return q('#kd-btn-d1'); }, 8);
          await b2oZeile(s, 'Kapitaldeckung', (_kdTxt ? _kdTxt[0] + ' ' : '') + 'Eigenkapital und Darlehen müssen die Gesamtinvestition decken — ein Klick passt das Darlehen an.');
          try { q('#kd-btn-d1').click(); } catch (e) {}
          await warte(900);
        }
        await zeigeGruppe(feldVon('ek'), feldVon('d1t'), 8);
        await b2oZeile(s, 'Finanzierung', 'Eigenkapital ' + eur(zahl('ek')) + ', Darlehen <b>' + eur(zahl('d1')) + '</b> zu ' + r6Pz(wert('d1z')) + ' % — der Marktzins für 10 Jahre liegt bei ' + (r6Id('mrpf-top-rate-10') || '–') + '.');
        await zeige(function () { return q('#d1_rate') && q('#d1_rate').closest('.f'); }, 10);
        await b2oZeile(s, 'Finanzierung', 'Rate <b>' + r6Id('d1_rate') + '</b> im Monat, Beleihung ' + (r6Id('r-ltv') || '–') + '.');
      },
      async function (s) {   /* 6 · Bewirtschaftung */
        reiter('s4'); await warte(900);
        await zeige(function () { return q('#r-bwk') && q('#r-bwk').closest('.card'); }, 8);
        await b2oZeile(s, 'Bewirtschaftung', 'Laufende Kosten <b>' + r6Id('r-bwk') + '</b> im Jahr, ' + r6Id('r-bwk-pct') + ' der Kaltmiete — umlagefähig und nicht umlagefähig getrennt, mit Rücklage.');
      },
      async function (s) {   /* 7 · Steuer */
        reiter('s3-tax'); await warte(1100);
        await zeigeGruppe(feldVon('afa_satz'), function () { return q('#afa_kalk') && q('#afa_kalk').closest('.f'); }, 8);
        await b2oZeile(s, 'Steuer', 'Gebäudeanteil ' + r6Pz(wert('geb_ant')) + ' %, AfA ' + r6Optionstext('afa_satz').split(' — ')[0] + ' — <b>' + r6Id('afa_kalk') + '</b> Abschreibung im Jahr.');
        var e = r6TaxItem(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/);
        if (e) { var bx = e.closest('.card') || e; bx.scrollIntoView({ block: 'center' }); await warte(400); await zeige(function () { return r6TaxItem(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/); }, 8); }
        await b2oZeile(s, 'Steuer', 'Ergebnis aus Vermietung: <b>' + (r6TaxWert(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/) || '–') + '</b> im ersten Jahr — mit deinem Grenzsteuersatz verrechnet.');
      },
      async function (s) {   /* 8 · Kennzahlen mit Ampel */
        reiter('s6'); await warte(1300);
        await warteAuf(function () { return q('#s6 .kpi-eval-card'); }, 6000);
        await zeige(function () { return q('#s6 .kpi-eval-card'); }, 8);
        function f(re, nm) { var x = r12Bewertung(re); return x ? nm + ' <b>' + x.wert + '</b> ' + x.wort.toLowerCase() : ''; }
        await b2oZeile(s, 'Kennzahlen mit Ampel', [f(/^Cashflow vor/, 'Cashflow'), f(/^DSCR/, 'DSCR'), f(/^Nettomiet/, 'Nettorendite'), f(/^LTV/, 'LTV')].filter(Boolean).join(', ') + '.');
      },
      async function (s) {   /* 9 · DealScore und Investor-DealScore */
        await zeigeGruppe(function () { var k = r12Karte(0)(); return k && k.querySelector('.dpsh-headrow'); }, function () { var k = r12Karte(1)(); return k && k.querySelector('.dpsh-headrow'); }, 6);
        var a = r12Kopf(0), b = r12Kopf(1);
        await b2oZeile(s, 'Das Urteil', 'DealPilot Score <b>' + (a.score || '–') + ' · ' + r12Wort(a.wort) + '</b>, Investor-DealScore <b>' + (b.score || '–') + ' · ' + r12Wort(b.wort) + '</b> — Modul 12 zeigt, wie sie entstehen.');
      },
      async function (s) {   /* 10 · Investment-PDF */
        reiter('s8'); await warte(1300);
        var zeileFn = function () { var e = rhIm('#s8', /^\s*Investment-PDF/); return e && (e.closest('[class*=row]') || e.parentElement); };
        await warteAuf(zeileFn, 5000);
        await zeige(zeileFn, 8);
        var zb = r6Beginn(s, 'Das Investment-PDF', 'Ein Klick — der Business-Case für die Bank: Kaufpreis, Finanzierung, Cashflow, DSCR und LTV, Stresstest.');
        try { _ue2Brand = DealPilotConfig.branding.get; DealPilotConfig.branding.get = function () { var b = _ue2Brand.apply(this, arguments) || {}; var c = {}; Object.keys(b).forEach(function (k) { c[k] = b[k]; }); ['name', 'role', 'address', 'plz', 'city', 'phone', 'email', 'website'].forEach(function (k) { c[k] = ''; }); return c; }; } catch (e) {}
        /* GEMESSEN (Prueflauf Ü2): exportPDFBlob ruft exportPDF - das ist seit
           pdf-wahl.js die Fassungs-Rückfrage und lieferte kein Blob (null). Für
           diesen einen Aufruf ohne Rückfrage, danach wieder die Hülle. */
        var r = null, huelle = window.exportPDF;
        try { window.exportPDF = function () { return huelle({ ohneRueckfrage: true }); }; r = await window.exportPDFBlob(); } catch (e) {} finally { window.exportPDF = huelle; }
        try { if (_ue2Brand) { DealPilotConfig.branding.get = _ue2Brand; _ue2Brand = null; } } catch (e) {}
        DPM_REIHE.pdf = r && r.blob ? { bytes: r.blob.size, name: r.filename } : null;
        await r6Ende(zb);
        if (!(r && r.blob)) { await b2oZeile(s, 'Das Investment-PDF', 'Hier entsteht das PDF.'); return; }
        _ue2Pdf = URL.createObjectURL(r.blob);
        zeige(null); kegelHoch(true);
        await ue2PdfSeite(1);
        await b2oZeile(s, 'Deckblatt', 'Objekt, Kaufpreis, Eckdaten — in deiner Marke oder als neutrale Bankfassung.');
        await ue2PdfSeite(2);
        await b2oZeile(s, 'Die Kennzahlen', 'Executive Summary: Rendite, Cashflow, DSCR, LTV — mit denselben Ampeln wie in der App.');
        await ue2PdfSeite(4);
        await b2oZeile(s, 'Der Cashflow in drei Phasen', 'Heute, am Ende der Zinsbindung und in der Anschlussfinanzierung — das will die Bank sehen.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 15 · STEUER IM BESTAND (v2273) ════════════
     Videoreihe.md, Teil C. KOPIE der Parkstr. 9, Bad Oeynhausen (gewonnen, mit
     Ankauf-Stand, behalte), beim Aufräumen gelöscht. Die Jahreswerte der
     Steuer (_taxYearlyOverrides) stehen im Objekt und kommen mit der Kopie.
     Belege einlesen: zwei Beispielbelege werden im Lauf als Bild gezeichnet
     (r15Belege, Beispieldaten, keine echte Firma), die Auslese der KI ist ein
     Mitschnitt (DPM_REIHE_DATEN.belege, EINMAL echt erzeugt am 16.10.2026 mit
     genau diesen beiden Bildern). Übernommen wird nur in die Kopie.
     GEMESSEN (Prüfung am 16.10.2026): Die Steuerwirkung steht in der App an
     drei Stellen mit drei Zahlen (Soll/Ist-Tafel, Steuer-Modul, Jahreszeile) -
     das Drehbuch zeigt deshalb je Szene nur EINE Quelle und nennt sie. */
  function r15Box() { return q('#yearly-tax-form-box'); }
  function r15Modus(n) { var b = r15Box(); var k = b ? b.querySelectorAll('.ytf-mode-btn') : []; if (k[n] && !k[n].classList.contains('active')) k[n].click(); }
  /* Quick-Modus: die Zeile eines Jahres; Zellen: Jahr, Einnahmen, Zinsen, AfA (Felder), Bewirtschaftung, Sonstige WK, Ergebnis, Steuer-Effekt */
  function r15Zeile(j) { var b = r15Box(); return b ? [].filter.call(b.querySelectorAll('tr'), function (t) { return t.offsetWidth && t.firstElementChild && r6Text(t.firstElementChild) === String(j); })[0] || null : null; }
  function r15Zellen(j) { var t = r15Zeile(j); return t ? [].map.call(t.children, function (c) { var i = c.querySelector('input'); return i ? (i.value ? eur(Number(i.value)) : '–') : r6Text(c); }) : []; }
  /* Detail-Modus: Jahr wählen, Zeile über ihre Beschriftung */
  async function r15Jahr(j) {
    var s = r15Box() && r15Box().querySelector('select'); if (!s) return;
    var o = [].filter.call(s.options, function (x) { return r6Text(x) === String(j); })[0];
    if (o && s.value !== o.value) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); await warte(700); }
  }
  function r15Det(re) { var b = r15Box(); return b ? [].filter.call(b.querySelectorAll('tr'), function (t) { return t.offsetWidth && t.firstElementChild && re.test(r6Text(t.firstElementChild).replace(/\s*ℹ\s*$/, '')); })[0] || null : null; }
  function r15DetWert(re) { var t = r15Det(re), i = t && t.querySelector('input'); return i && i.value ? eur(Number(i.value)) : null; }
  function r15Gruppe(re) { var b = r15Box(); return b ? [].filter.call(b.querySelectorAll('tr,div'), function (t) { return t.offsetWidth && t.children.length <= 2 && re.test(r6Text(t)); }).pop() || null : null; }
  function r15Summe(re) { var t = r6Inner(r15Box()), m = re.exec(t); return m ? m[1].trim() : null; }
  function r15Oben(e) { if (!e) return; var s = scroller(e); if (s) s.scrollTop += rect(e).top - 110; }
  function r15BiZu() { try { if (window.DealPilotBelegImport) DealPilotBelegImport.close(); } catch (e) {} var o = q('#beleg-import-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); }
  /* zwei Beispielbelege als Bild (Canvas -> PNG-Datei). Genau diese Bilder
     lagen der KI beim Mitschnitt vor. */
  async function r15Belege() {
    function blatt(zeilen) {
      var c = document.createElement('canvas'); c.width = 1240; c.height = 1754;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111';
      zeilen.forEach(function (z) { x.font = (z[3] || 'normal') + ' ' + (z[2] || 26) + 'px Arial'; x.textAlign = z[4] || 'left'; x.fillText(z[0], z[4] === 'right' ? 1140 : 100, z[1]); });
      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
    }
    var a = await blatt([
      ['Beispiel-Dachdeckerei GmbH', 140, 40, 'bold'], ['Am Werkhof 4 · 32545 Bad Oeynhausen · USt-IdNr. DE000000000', 180, 22],
      ['RECHNUNG', 320, 44, 'bold'], ['Rechnungsnummer: 2025-0815', 380], ['Rechnungsdatum: 14.08.2025', 420], ['Leistungszeitraum: 04.08.2025 – 08.08.2025', 460],
      ['Objekt: Parkstr. 9, 32545 Bad Oeynhausen (Mehrfamilienhaus)', 520],
      ['Pos.  Leistung', 620, 26, 'bold'], ['Betrag', 620, 26, 'bold', 'right'],
      ['1     Dachrinne erneuert, 18 m, Zink, inkl. Halter', 670], ['1.080,00 €', 670, 26, 'normal', 'right'],
      ['2     Fallrohr ausgetauscht, 2 Stück', 715], ['420,00 €', 715, 26, 'normal', 'right'],
      ['3     Arbeitszeit Geselle, 8 Std. à 42,50 €', 760], ['340,00 €', 760, 26, 'normal', 'right'],
      ['Nettobetrag', 860, 26, 'bold'], ['1.840,00 €', 860, 26, 'bold', 'right'],
      ['zzgl. 19 % Umsatzsteuer', 900], ['349,60 €', 900, 26, 'normal', 'right'],
      ['Rechnungsbetrag', 960, 30, 'bold'], ['2.189,60 €', 960, 30, 'bold', 'right'],
      ['Es handelt sich um eine Instandhaltung (Erhaltungsaufwand).', 1060, 22], ['Zahlbar innerhalb von 14 Tagen ohne Abzug.', 1095, 22]
    ]);
    var b = await blatt([
      ['Beispiel-Versicherung AG', 140, 40, 'bold'], ['Versicherungsweg 1 · 30159 Hannover', 180, 22],
      ['BEITRAGSRECHNUNG 2025', 320, 44, 'bold'], ['Verbundene Wohngebäudeversicherung', 380], ['Vertragsnummer: WG-000-000-000', 420], ['Datum: 02.01.2025', 460],
      ['Versichertes Objekt: Parkstr. 9, 32545 Bad Oeynhausen', 520], ['Versicherungszeitraum: 01.01.2025 – 31.12.2025', 560],
      ['Nettobeitrag (Feuer, Leitungswasser, Sturm/Hagel)', 670], ['1.165,04 €', 670, 26, 'normal', 'right'],
      ['Versicherungsteuer 19 %', 715], ['221,36 €', 715, 26, 'normal', 'right'],
      ['Jahresbeitrag 2025', 790, 30, 'bold'], ['1.386,40 €', 790, 30, 'bold', 'right'],
      ['Der Beitrag wird am 15.01.2025 von Ihrem Konto abgebucht.', 880, 22]
    ]);
    return [new File([a], 'Rechnung-Dachrinne-2025.png', { type: 'image/png' }), new File([b], 'Wohngebaeudeversicherung-2025.png', { type: 'image/png' })];
  }
  var R15_JAHR = 2025;   /* das erste volle Jahr im Bestand (Kauf 23.12.2024) */
  DREHBUECHER['reihe-steuer-bestand'] = {
    titel: 'Steuer im Bestand', unterzeile: 'Soll und Ist, das Steuerformular pro Jahr, Belege', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r15BiZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Objekt */
        await r6KopieStart(R11_PARK, { behalte: true });
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var we = wert('einheiten');
        await b2oZeile(s, 'Das Beispiel', 'Im Bestand: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + 'Baujahr ' + wert('baujahr') + ', gekauft am ' + datum(wert('kaufdat')) + '. Heute: die <b>Steuer</b> nach dem Kauf.');
      },
      async function (s) {   /* 2 · Soll gegen Ist: die Steuer-Zeilen der Tafel */
        reiter('s5'); await warte(1200);
        await r11PaTab(/Soll\/Ist/);
        await warteAuf(function () { return q('#ai-content .abw-tafel'); }, 6000);
        var grp = function () { return [].filter.call(document.querySelectorAll('#ai-content .abw-tafel tr.abw-gruppe'), function (t) { return /^Steuer$/.test(r6Text(t)); })[0] || null; };
        var letzte = function () { var g = grp(), t = g, l = null; while (t && (t = t.nextElementSibling) && !t.classList.contains('abw-gruppe')) l = t; return l; };
        r15Oben(grp()); await warte(400);
        await zeigeGruppe(grp, letzte, 6);
        var a = null; try { a = DealPilotAnkauf.abweichung(); } catch (e) {}
        function z(w) { return a && a.zeilen.filter(function (x) { return x.wort === w; })[0]; }
        var sw = z('Steuerwirkung p. a.'), ga = z('Gebäudeanteil (AfA-Basis)');
        await b2oZeile(s, 'Soll gegen Ist · Steuer', 'Steuerwirkung im Jahr: geplant <b>' + (sw ? eur(sw.ankauf) : '–') + '</b>, heute <b>' + (sw ? eur(sw.bestand) : '–') + '</b>.' + (ga ? ' Gebäudeanteil ' + de(ga.bestand, 2) + ' % und AfA-Satz bleiben, wie beim Kauf.' : ''));
        var nk = z('Nettokaltmiete'), cf = z('Cashflow n. Steuer');
        if (nk && cf) await b2oZeile(s, 'Warum weniger Erstattung?', 'Nettokaltmiete <b>' + eur(nk.ankauf) + ' → ' + eur(nk.bestand) + '</b> im Monat: mehr Überschuss, weniger Erstattung. Unterm Strich: Cashflow nach Steuer <b>' + eur(cf.ankauf) + ' → ' + eur(cf.bestand) + '</b> im Jahr.');
      },
      async function (s) {   /* 3 · das Steuerformular pro Jahr (Quick) */
        reiter('s3-tax'); await warte(1100);
        r15Modus(0); await warte(600);
        var kopf = function () { var b = r15Box(); return b && b.closest('.card'); };
        r15Oben(kopf()); await warte(400);
        await zeige(function () { var k = kopf(); return k && k.querySelector('.ct-row'); }, 8);
        await b2oZeile(s, 'Steuerformular pro Jahr', 'Eine Zeile je Jahr: Einnahmen, Schuldzinsen, AfA, Bewirtschaftung, sonstige Werbungskosten — und was davon bei der Steuer ankommt.');
        var zl = function () { return r15Zeile(R15_JAHR); };
        await zeige(zl, 6);
        var c = r15Zellen(R15_JAHR);
        await b2oZeile(s, 'Das Jahr ' + R15_JAHR, 'Einnahmen <b>' + (c[1] || '–') + '</b>, Schuldzinsen ' + (c[2] || '–') + ', AfA ' + (c[3] || '–') + ' — Ergebnis <b>' + (c[6] || '–') + '</b>, Steuer-Effekt <b>' + (c[7] || '–') + '</b>.');
      },
      async function (s) {   /* 4 · was man einträgt */
        var f = function () { var t = r15Zeile(R15_JAHR); return t && t.querySelector('input'); };
        await zeige(function () { var t = r15Zeile(R15_JAHR), i = t ? t.querySelectorAll('input') : []; return i.length ? b2oHuelle(i[0], i[i.length - 1]) : t; }, 8);
        await b2oZeile(s, 'Was du einträgst', 'Die App schlägt jede Zahl vor. Liegt die Erklärung vor, trägst du die echten ein: <b>Mieteinnahmen</b> aus der Anlage V, <b>Schuldzinsen</b> aus der Zinsbescheinigung der Bank.');
        await b2oZeile(s, 'Was du einträgst', 'Die <b>AfA</b> so, wie sie im Steuerbescheid anerkannt ist. Der Pfeil ↺ neben einem Feld setzt es auf den Vorschlag zurück.');
      },
      async function (s) {   /* 5 · Detail-Modus */
        r15Modus(1); await warte(900);
        await r15Jahr(R15_JAHR);
        var kopf = function () { var b = r15Box(); return b && b.querySelector('select'); };
        r15Oben(kopf()); await warte(400);
        await zeigeGruppe(function () { var b = r15Box(); return b && b.querySelector('.ytf-mode-btn.active'); }, kopf, 8);
        await b2oZeile(s, 'Detail-Modus', 'Ein Veranlagungsjahr, gegliedert wie die Anlage V: Finanzierung, Betrieb, Verwaltung, sonstige Kosten, AfA, Erhaltung.');
        var fin = function () { return r15Det(/^Schuldzinsen$/); }, finE = function () { return r15Det(/^Vermittlungsprovision/); };
        r15Oben(fin()); await warte(400);
        await zeigeGruppe(fin, finE, 6);
        await b2oZeile(s, 'Finanzierungskosten', 'Schuldzinsen <b>' + (r15DetWert(/^Schuldzinsen$/) || '–') + '</b>, Kontoführung ' + (r15DetWert(/^Kontoführungsgebühren$/) || '–') + ' — dazu Bereitstellungszinsen, Grundschuld beim Notar, Vermittlung.');
        var vw = function () { return r15Det(/^Steuerberatung$/); }, vwE = function () { return r15Det(/^Telefon\/Internet$/); };
        r15Oben(vw()); await warte(400);
        await zeigeGruppe(vw, vwE, 6);
        var teile = [['Steuerberatung', /^Steuerberatung$/], ['Fahrten zum Objekt', /^Fahrtkosten zur Immobilie$/], ['Inserate', /^Inseratskosten$/], ['Telefon', /^Telefon\/Internet$/]].map(function (x) { var w = r15DetWert(x[1]); return w ? x[0] + ' ' + w : null; }).filter(Boolean);
        await b2oZeile(s, 'Verwaltung und Sonstiges', 'Was oft vergessen wird: ' + (teile.join(', ') || '–') + '. Eingetragene Werte tragen das ↺.');
      },
      async function (s) {   /* 6 · Erhaltung und was es im Jahr bedeutet */
        var er = function () { return r15Det(/^Erhaltungsaufwendungen/); };
        r15Oben(er()); await warte(400);
        await zeige(er, 8);
        await b2oZeile(s, 'Erhaltungsaufwand', 'In ' + R15_JAHR + ' eingetragen: <b>' + (r15DetWert(/^Erhaltungsaufwendungen/) || '–') + '</b> für Reparaturen. In den ersten drei Jahren nach dem Kauf zählt dabei die 15-%-Grenze — Modul 10b zeigt sie.');
        var sm = function () { return rhIm(r15Box(), /^Werbungskosten gesamt:?$/); };
        var sb = function () { var e = sm(); return e && (e.closest('div[style*=grid],div[class]') || e.parentElement); };
        r15Oben(sb()); await warte(400);
        await zeige(sb, 8);
        var wk = r15Summe(/Werbungskosten gesamt:\s*([^\n]+)/), ein = r15Summe(/Einnahmen V\+V:\s*([^\n]+)/), erg = r15Summe(/Verlust\/Überschuss V\+V:\s*([^\n]+)/), eff = r15Summe(/Steuer-Effekt:\s*([^\n]+)/);
        await b2oZeile(s, 'Was das im Jahr bedeutet', 'Werbungskosten <b>' + (wk || '–') + '</b> gegen Einnahmen ' + (ein || '–') + ': Ergebnis <b>' + (erg || '–') + '</b>. Mit deiner Progression: <b>' + (eff || '–') + '</b> Erstattung.');
      },
      async function (s) {   /* 7 · Belege einlesen (Mitschnitt) */
        var kn = function () { return r6Knopf(r15Box() && r15Box().closest('.card'), /Belege & Abrechnungen einlesen/); };
        r15Oben(kn()); await warte(400);
        await zeige(kn, 10);
        await b2oZeile(s, 'Belege einlesen', 'Statt abzutippen: Rechnungen, Hausgeld- und Nebenkostenabrechnungen als PDF oder Foto. Die KI liest Datum, Betrag, Steuer, Aussteller.');
        r15Modus(0); await warte(500);
        var vor = r15Zellen(R15_JAHR);
        try { DealPilotBelegImport.open('wk'); } catch (e) {}
        await warteAuf(function () { return q('#bi-files'); }, 3000);
        try {
          var fs = await r15Belege(), dt = new DataTransfer(); fs.forEach(function (f) { dt.items.add(f); });
          var inp = q('#bi-files'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
        } catch (e) {}
        kegelHoch(true);
        await warteAuf(function () { return q('#bi-review table') || q('#bi-review tr'); }, 15000);
        await warte(700);
        await zeige(function () { var t = q('#bi-review table'); return t || q('#bi-review'); }, 6);
        var R = [].filter.call(document.querySelectorAll('#bi-review tbody tr'), function (t) { return t.offsetWidth && t.querySelector('input[type=checkbox]'); });
        var zt = R.map(function (t) { var c = [].map.call(t.children, r6Text); var br = c.filter(function (x) { return /€/.test(x); }); var sel = t.querySelector('select'); return '<b>' + (br[2] || br[br.length - 1] || '–') + '</b> ' + (sel ? sel.value : ''); });
        await b2oZeile(s, 'Zwei Belege gelesen', (zt.join(' und ') || '–') + ' — beide für ' + R15_JAHR + '. Jede Zeile prüfst du, bevor etwas übernommen wird.');
        _r15Vor = vor;
      },
      async function (s) {   /* 8 · übernehmen -> das Jahr bewegt sich */
        var tk = function () { return q('#bi-take'); };
        await zeige(tk, 10);
        var zb = r6Beginn(s, 'Übernehmen', 'Ein Klick — die Beträge gehen in das Jahr ' + R15_JAHR + ' dieses Objekts.');
        await warte(2400);
        var oc = window.confirm; window.confirm = function () { return true; };
        try { DealPilotBelegImport.apply(); } catch (e) {} finally { window.confirm = oc; }
        await warteAuf(function () { return !q('#beleg-import-ov'); }, 4000);
        kegelHoch(false);
        await warte(1200);
        if (!q('#s3-tax.active')) reiter('s3-tax');
        r15Modus(0); await warte(700);
        /* GEMESSEN (Prüflauf 15): der Knopf verschwindet mit dem Fenster - erst die Zeile zeigen, dann die Restzeit (Kegel 50 %) */
        var zl = function () { return r15Zeile(R15_JAHR); };
        r15Oben(zl()); await warte(400);
        await zeige(zl, 6);
        await r6Ende(zb);
        var v = _r15Vor || [], n = r15Zellen(R15_JAHR);
        await b2oZeile(s, 'Das Jahr ' + R15_JAHR + ' danach', 'Bewirtschaftung <b>' + (n[4] || '–') + '</b> statt ' + (v[4] || '–') + ', Ergebnis ' + (n[6] || '–') + ' — Steuer-Effekt <b>' + (n[7] || '–') + '</b> statt ' + (v[7] || '–') + '.');
      },
      async function (s) {   /* 9 · Finanzamt-PDF (nur zeigen) */
        var k = function () { var b = r15Box(); return b && b.closest('.card').querySelector('.fa-pdf-ctrl'); };
        r15Oben(k()); await warte(400);
        await zeige(k, 8);
        await b2oZeile(s, 'Für die Erklärung', 'Steuerjahr wählen, auf Wunsch mit den Zeilen der <b>Anlage V</b> — das Finanzamt-PDF fasst alles zusammen, für dich oder deinen Steuerberater.', 600);
      }
    ]
  };
  var _r15Vor = null;

  /* ═══ VIDEOREIHE · SPEZIALMODUL 16 · STUFE 3 GENAUER (v2276) ═════════════
     v2276 · Marcel 16.10.2026: „das Video mit Ertragswert wäre toll, wo alles drin
     ist und auch amtlich - Beispiel anpassen". Das Beispiel ist jetzt eine KOPIE
     der Westerfeldstr. 140, Bielefeld (MFH, 4 WE, Bj 1967): dort greift Anlage 2
     (gemessen am Register: 2 Punkte RND 23,6 J., 6 Punkte 32,3 J.) und es gibt
     einen Ertragswert mit amtlichem Liegenschaftszins (2,6 %, Oberer
     Gutachterausschuss NRW). GEMESSEN: für Bielefeld ist KEIN Sachwertfaktor
     hinterlegt (für MFH auch sonst bei keinem Objekt im Konto) - der Sachwert
     bleibt vorläufig, und das Video sagt es. Angenommen im Lauf (nur an der
     Kopie): Fassade gedämmt (< 5 Jahre, bleibt für den Bericht stehen),
     Hinterland 250 m² à 5 €, zwei Garagen 36 m² Stufe 4, Reparaturen 25.000 €
     (boG). Mit genau diesen Angaben ist der Stufe-3-Bericht EINMAL echt erzeugt
     (DPM_REIHE_DATEN.westerfeld.mb[3]) - hier abgespielt.
     Bis v2275 stand hier: KOPIE der Bismarckstr. 27,
     Detmold (MFH, 6 WE, Bj 1908 - Vierspänner, 9 Modernisierungspunkte,
     Standardstufe 4 stehen schon im Objekt), ohne Analyse und Ankauf-Stand, beim
     Aufräumen gelöscht. Im Lauf ANGENOMMEN (nur an der Kopie, im Untertitel so
     gesagt): Hinterland 250 m² à 5 €, zwei Garagen 36 m² Stufe 4, Sanierung
     25.000 € (boG). Mit genau diesen Angaben ist Marktbericht 215 EINMAL echt
     erzeugt (DPM_REIHE_DATEN.bismarck) - hier abgespielt.
     Der Marktbericht wird danach im Marktbericht-Fenster gezeigt: GET des
     gespeicherten Berichts 215 (kein Abruf mit Kosten). Das Fenster ist ein
     eigenes Dokument - r16MbSpion hängt sich an sein fetch, sperrt alles außer
     GET und beantwortet die Adresssuche (externer Dienst) leer.
     GEMESSEN: Bj 1908 liegt hinter dem Scheitel der Anlage 2 - die Punkte
     bewegen die Restnutzungsdauer NICHT, und für Mehrfamilienhäuser in Lippe
     führt der Ausschuss keinen Sachwertfaktor: der boG wirkt deshalb nicht im
     vorläufigen Sachwert. Das Drehbuch sagt beides, statt es zu verschweigen. */
  var R16_OBJ = R11_WESTERFELD;   /* v2276 · die Berichtsnummer steht beim Mitschnitt: DPM_REIHE_DATEN.westerfeld.bericht3 */
  function r16Bericht() { var D = window.DPM_REIHE_DATEN; return (D && D.westerfeld && D.westerfeld.bericht3) || null; }
  var _r16Iv = null;
  function r16Frame() { return q('#mbv-frame'); }
  function r16Doc() { var f = r16Frame(); try { return f && f.contentDocument; } catch (e) { return null; } }
  function r16MbSpion() {
    if (_r16Iv) return;
    _r16Iv = setInterval(function () {
      var f = r16Frame(); if (!f) return;
      try {
        var w = f.contentWindow, d = w.document;
        if (!d || !/marktbericht-app/.test(d.URL) || w.__dpmMb) return;
        var echt = w.fetch; w.__dpmMb = 1;
        w.fetch = function (u, o) {
          var m = String((o && o.method) || 'GET').toUpperCase(), p = String(typeof u === 'string' ? u : (u && u.url) || '').replace(location.origin, '').split('?')[0];
          DPM_REIHE.abrufe.push('MB ' + m + ' ' + p);
          if (/\/geocode\//.test(p)) { DPM_REIHE.gespielt.push('MB ' + m + ' ' + p); return Promise.resolve(new Response('{"results":[],"features":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } })); }
          /* v2273 · Kartenbilder fürs PDF (Modul 18): der Server holt sie je Abruf beim externen
             Kartendienst - im Lauf gesperrt, das PDF entsteht dann ohne die beiden Karten */
          if (/\/(static-map|streetview)\b/.test(p)) { DPM_REIHE.gesperrt.push('MB ' + m + ' ' + p); return Promise.resolve(new Response('', { status: 404 })); }
          if (m !== 'GET') { DPM_REIHE.gesperrt.push('MB ' + m + ' ' + p); return Promise.resolve(new Response('{"error":"Vorführung: Abruf gesperrt"}', { status: 503, headers: { 'Content-Type': 'application/json' } })); }
          return echt.apply(this, arguments);
        };
      } catch (e) {}
    }, 5);
  }
  function r16MbZu() {
    if (_r16Iv) { clearInterval(_r16Iv); _r16Iv = null; }
    try { if (window._mbLeiseSchliessen) window._mbLeiseSchliessen(); } catch (e) {}
    try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
  }
  /* Marktbericht-Fenster öffnen und einen gespeicherten Bericht zeigen */
  async function r16MbOeffnen(rid) {
    r16MbSpion();
    try { await window.openMarktberichtView(); } catch (e) {}
    await warteAuf(function () { var f = r16Frame(); try { return f && f.contentWindow._mbOpenReport && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, 12000);
    await warte(900);
    try { await r16Frame().contentWindow._mbOpenReport(rid, false); } catch (e) {}
    await warteAuf(function () { var d = r16Doc(); return d && d.getElementById('wv-box'); }, 10000);
    await warte(1200);
  }
  function r16Mb(sel) { var d = r16Doc(); return d ? d.querySelector(sel) : null; }
  function r16Aufklappen(re) {
    var d = r16Doc(); if (!d) return;
    [].forEach.call(d.querySelectorAll('#wv-box .wv-mehr'), function (x) { if (re.test(x.textContent) && /▸/.test(x.textContent)) x.click(); });
  }
  /* ein Element im Marktbericht-Fenster mittig ins Bild (gescrollt wird .main-col) */
  async function r16Hin(e, oben) {
    if (!e) return; var s = scroller(e), r = rect(e);
    if (s) s.scrollTop += oben ? r.top - 110 : (r.top + r.height / 2) - innerHeight / 2;
    await warte(400);
  }
  function r16Leiste(re) { return [].filter.call(document.querySelectorAll('.oe-row'), function (r) { return r.offsetWidth && re.test(r6Text(r.querySelector('.oe-k'))); })[0] || null; }
  function r16LeisteWert(re) { var r = r16Leiste(re); return r ? r6Text(r.querySelector('.oe-w')) : null; }
  function r16Gewerk(id) { return function () { var e = document.getElementById(id); return e && e.closest('tr'); }; }
  async function r16Setze(id, v) { var e = document.getElementById(id); if (!e) return; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); await warte(500); }
  DREHBUECHER['reihe-stufe3'] = {
    titel: 'Stufe 3 genauer', unterzeile: 'Pflichtfelder, optionale Felder — und was sie bewegen', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r16MbZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R16_OBJ, { ohneAnkauf: true, ohneAnalyse: true });
        if (_rh) _rh.satz = 'westerfeld';
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var we = wert('einheiten');
        await b2oZeile(s, 'Das Beispiel', 'Ein Mehrfamilienhaus: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + de(zahl('wfl')) + ' m², Baujahr ' + wert('baujahr') + '. Heute: <b>Stufe 3</b> genauer.');
      },
      async function (s) {   /* 2 · Stufe 3 wählen, Pflichtfelder */
        await stufeWaehlen(3);
        await zeige(stufeZeile(3), 8);
        var nur3 = DealPilotObjektReiter.pflichtFuer(3).filter(function (id) { return DealPilotObjektReiter.pflichtFuer(2).indexOf(id) < 0 && !/^garagen_/.test(id); });
        /* v2273i · zusammengelegt (Länge): Status und die zusätzlichen Pflichtfelder in einer Zeile */
        await b2oZeile(s, 'Stufe 3 · nur ' + nur3.length + ' Pflichtfelder mehr', 'Status <b>' + (fehlt(3).length ? fehlt(3).length + ' Angaben fehlen</b> (' + feldNamen(fehlt(3)).join(', ') + ' — kommt gleich)' : 'bereit</b>') + '. Zu Stufe 2 kommen nur: <b>' + feldNamen(nur3).join(', ') + '</b>.');
        await zeige(feldVon('bgf'), 10);
        await b2oZeile(s, 'Warum nur die?', 'Das ist das Minimum für Boden-, Sach- und Ertragswert. Alles andere hat einen Ansatz der ImmoWertV — es <b>verfeinert</b>.');
      },
      async function (s) {   /* 3 · was DealPilot vorab aus dem Register liest */
        var a = function () { return r16Leiste(/^Liegenschaftszins/); }, b = function () { return r16Leiste(/^GND \/ RND/); };
        await warteAuf(b, 8000);
        r15Oben(a()); await warte(400);
        await zeigeGruppe(a, b, 6);
        /* v2276 · der Ausschuss steht in der Zeile (span[title]); ein Sachwertfaktor „1,00 · Standard" ist KEIN amtlicher Wert und wird so nicht genannt */
        var lq = (function () { var r = r16Leiste(/^Liegenschaftszins/), e = r && r.querySelector('span[title]:not(.oe-st)'), t = e ? e.getAttribute('title') || '' : ''; return /Obere Gutachterausschuss[^,]*Nordrhein-Westfalen/.test(t) ? 'Oberer Gutachterausschuss NRW' : (e ? r6Text(e) : null); })();
        var swR = r16Leiste(/^Sachwertfaktor/), swStd = swR && /ohne Marktanpassung/.test(r6Text(swR));
        await b2oZeile(s, 'Vorab aus dem Register', 'Liegenschaftszins <b>' + (r16LeisteWert(/^Liegenschaftszins/) || '–') + '</b>' + (lq ? ' (' + lq + ')' : '') + ', Nutzungsdauer ' + (r16LeisteWert(/^GND \/ RND/) || '–') + ' — vorab, ohne Kosten.');
        if (swStd) {
          await zeige(function () { return r16Leiste(/^Sachwertfaktor/); }, 6);
          await b2oZeile(s, 'Sachwertfaktor', 'Für diesen Ort ist im Register noch <b>keiner</b> hinterlegt — gerechnet wird ohne Marktanpassung. Beim Mehrfamilienhaus führt ohnehin der <b>Ertragswert</b>.');
        } else await b2oZeile(s, 'Sachwertfaktor', (r16LeisteWert(/^Sachwertfaktor/) || '–') + ' — der Faktor wird im Bericht aus dem vorläufigen Sachwert abgelesen.');
      },
      async function (s) {   /* 4 · Modernisierung -> Punkte -> Restnutzungsdauer */
        var tab = function () { return q('#oe-gewerke'); };
        r15Oben(tab()); await warte(400);
        await zeigeGruppe(r16Gewerk('mod_aussenwand'), r16Gewerk('mod_grundriss'), 6);
        await b2oZeile(s, 'Optional: Modernisierung', 'Die Spalte „modernisiert“ ergibt die Punkte der Anlage 2: hier <b>' + wert('mod_punkte') + ' von 20</b>.');
        await zeige(r16Gewerk('mod_aussenwand'), 6);
        var zb = r6Beginn(s, 'Ein Feld mehr', 'Angenommen, die Fassade wurde vor drei Jahren gedämmt …');
        var vor = wert('mod_punkte'), rndVor = r16LeisteWert(/^GND \/ RND/);
        await warte(1600);
        await r16Setze('mod_aussenwand', '< 5 Jahre');
        await warte(1800);
        await warteAuf(function () { return r16Leiste(/^GND \/ RND/); }, 6000);
        await r6Ende(zb);
        var nach = wert('mod_punkte'), rndNach = r16LeisteWert(/^GND \/ RND/), bewegt = rndVor && rndNach && rndVor !== rndNach;
        var rr = function () { return r16Leiste(/^GND \/ RND/); };
        await zeigeGruppe(rr, function () { return r16Leiste(/^Modernisierungspunkte/); }, 6);
        /* die Leiste rechnet live (Register, ohne Kosten): bewegt sich die Restnutzungsdauer, steht es da - sonst der Grund */
        if (bewegt) await b2oZeile(s, 'Was sich bewegt', 'Punkte <b>' + vor + ' → ' + nach + '</b>, Nutzungsdauer gesamt / rest <b>' + rndVor + ' → ' + rndNach + '</b> — nach Anlage 2. Längere Restnutzung heißt: höherer Ertragswert.');
        else {
          await b2oZeile(s, 'Was sich bewegt', 'Punkte <b>' + vor + ' → ' + nach + '</b>, Nutzungsdauer bleibt <b>' + (rndNach || '–') + '</b>: Baujahr ' + wert('baujahr') + ' liegt hinter der Anlage 2. DealPilot rechnet nichts hoch — „sachverständig zu würdigen“.');
        }
        /* v2276 · die Dämmung bleibt stehen - der Bericht rechnet mit ihr */
        await warte(900);
      },
      async function (s) {   /* 5 · Standardstufe je Gewerk */
        await zeigeGruppe(function () { var e = q('#ausst_dach'); return e && e.closest('tr'); }, function () { var e = q('#ausst_heizung'); return e && e.closest('tr'); }, 6);
        var sst = (function () { var e = q('#standardstufe'); return e && e.selectedIndex >= 0 ? r6Text(e.options[e.selectedIndex]) : wert('standardstufe'); })();
        await b2oZeile(s, 'Optional: Standardstufe je Gewerk', 'Dach <b>' + r6Pz(wert('ausst_dach')) + '</b>, Fenster ' + r6Pz(wert('ausst_fenster')) + ', Heizung ' + r6Pz(wert('ausst_heizung')) + ' — gewichtet ergibt das <b>' + sst + '</b>: die Herstellungskosten je m².');
      },
      async function (s) {   /* 6 · Grundrissart */
        await zeige(feldVon('grundriss'), 10);
        var g = (function () { var e = q('#grundriss'); return e && e.selectedIndex > 0 ? r6Text(e.options[e.selectedIndex]) : null; })();
        await b2oZeile(s, 'Optional: Grundrissart', (g ? '<b>' + g + '</b>' : 'Keine Angabe') + ' — der Faktor geht direkt auf die Herstellungskosten.');
      },
      async function (s) {   /* 7 · Hinterland (angenommen) */
        await zeigeGruppe(feldVon('hinterland_qm'), feldVon('hinterland_eur_qm'), 8);
        var zb = r6Beginn(s, 'Optional: Hinterland', 'Angenommen: 250 m² Gartenland à 5 €/m² — es zählt zum Bodenwert, nicht zum Preis des Baulands.');
        await tippeH('hinterland_qm', '250', 110);
        await tippeH('hinterland_eur_qm', '5', 110);
        await warte(800);
        await r6Ende(zb);
      },
      async function (s) {   /* 8 · Garagen (angenommen) */
        await zeige(feldVon('garagen'), 10);
        var zb = r6Beginn(s, 'Optional: Garagen', 'Angenommen: zwei massive Garagen, zusammen 36 m².');
        await tippeH('garagen', '2', 120);
        await warte(500);
        await zeigeGruppe(feldVon('garagen_bgf_qm'), feldVon('garagen_stufe'), 8);
        await tippeH('garagen_bgf_qm', '36', 110);
        await tippeH('garagen_stufe', '4', 400);
        await warte(700);
        await r6Ende(zb);
        var gs = (function () { var e = q('#garagen_stufe'); return e && e.selectedIndex > 0 ? r6Text(e.options[e.selectedIndex]) : ''; })();
        await b2oZeile(s, 'Optional: Garagen', '<b>' + wert('garagen_bgf_qm') + ' m², ' + gs + '</b> — mit eigenen Herstellungskosten, getrennt vom Wohnhaus.');
      },
      async function (s) {   /* 9 · boG über die Sanierung (angenommen) */
        reiter('s1'); await warte(900);
        await zeige(r6Gruppe('san'), 10);
        var zb = r6Beginn(s, 'Optional: Besonderheiten (boG)', 'Angenommen: 25.000 € Reparaturen am Dach.');
        await tippeH('san', '25000', 100);
        await warte(900);
        await r6Ende(zb);
        await b2oZeile(s, 'Optional: Besonderheiten (boG)', 'Im Bericht ein <b>besonderes objektspezifisches Grundstücksmerkmal</b>: Abzug nach der Marktanpassung.');
        reiter('s0'); await warte(900);
      },
      async function (s) {   /* 10 · Abruf (Mitschnitt) */
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(stufeZeile(3), 8);
        await warte(900);   /* v2273i: Zeile „Jetzt abrufen“ gestrichen (Länge) - die Etappen erklären es */
        await rhStufeAbrufen(3, function () { s.zeile('Stufe 3 · Wertermittlung', 'Bodenwert, Liegenschaftszins, Ertrags- und Sachwert — Schritt für Schritt.'); });
        await warteAuf(function () { var w = q('#oe-vw-wahl'); return w && w.options.length >= 1; }, 8000);
        await warteAuf(function () { var v = q('#oe-vw'); return v && v.offsetHeight > 20; }, 6000);   /* Prüflauf 16: Kegel 69 % */
        await zeige(function () { return q('#oe-vw'); }, 10);
        var opts = [].map.call((q('#oe-vw-wahl') || { options: [] }).options, function (o) { return r6Text(o); });
        var sw = opts.filter(function (o) { return /^Sachwert/.test(o); })[0], ew = opts.filter(function (o) { return /^Ertragswert/.test(o); })[0];
        function kurz(o) { return o.replace(/\s*·\s*\d{2}\.\d{2}\.\d{4}\s*·\s*/, ': '); }
        await warte(600);
        /* v2276 · beide Verfahren, wenn der Bericht beide liefert (Westerfeldstr.) */
        await b2oZeile(s, 'Das Ergebnis', (ew ? '<b>' + kurz(ew) + '</b>' + (sw ? ', ' + kurz(sw) : '') : (sw ? '<b>' + kurz(sw) + '</b>' : 'Sachwert')) + '. Den Rechenweg zeigt der Marktbericht.');
      },
      async function (s) {   /* 11 · Bodenwert mit Hinterland (Marktbericht-Fenster) */
        await r16MbOeffnen(r16Bericht());
        r16Aufklappen(/Rechenweg/);
        await warte(600);
        var bw = function () { var t = r16Mb('#wv-box .wv-rw'); return t || r16Mb('#wv-box .wv-boden'); };
        await r16Hin(r16Mb('#wv-box'), true);
        await zeigeGruppe(function () { return r16Mb('#wv-box .wv-boden'); }, bw, 8);
        var t = r6Inner(r16Mb('#wv-box')), g = /Grundstücksfläche × Bodenrichtwert\s*\n?\s*([^\n]+)\s*\n?\s*\t?([\d.]+ €)/.exec(t), h = /\+ Hinterlandfläche\s*\n?\s*([^\n]+)\s*\n?\s*\t?([\d.]+ €)/.exec(t), su = /Bodenwert\s*\t\s*([\d.]+ €)/.exec(t);
        await b2oZeile(s, 'Bodenwert · Rechenweg', (g ? g[1].trim() + ' = ' + g[2] : '–') + (h ? ', <b>Hinterland ' + h[1].trim() + ' = ' + h[2] + '</b>' : '') + ' — zusammen <b>' + (su ? su[1] : '–') + '</b>.');
      },
      async function (s) {   /* 12 · v2276: Ertragswert (führend), Sachwert (vorläufig), Quellen */
        /* alles aus dem gespielten Bericht gelesen (= Bericht im Fenster), nichts angenommen */
        var P = (window.DPM_REIHE_DATEN && _rh && DPM_REIHE_DATEN[_rh.satz] && DPM_REIHE_DATEN[_rh.satz].mb[3]) || {}, cc = P.cross_check || {}, sw = cc.sachwert || {}, ew = cc.ertragswert || {}, no = (cc.notes || []).join(' ');
        function kv(re) { return function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#wv-box .wv-k'), function (x) { return re.test(r6Text(x.querySelector('.wv-t'))); })[0]; }; }
        var e = kv(/^Ertragswert/i), k = kv(/^Sachwert/i);
        await r16Hin(e(), false);
        await zeige(e, 8);
        var bog = /objektspezifischen Grundstücksmerkmale \((-?[\d.]+ €)\) wirken im vorläufigen Sachwert nicht/.exec(no);
        if (ew.available) {
          /* v2276 · eine Zeile statt zwei (Länge) */
          await b2oZeile(s, 'Ertragswert · führend', '<b>' + eur(ew.value_eur) + '</b>: Reinertrag ' + eur(ew.reinertrag_pa_eur) + ', Liegenschaftszins <b>' + de(ew.liegenschaftszins_pct, 1) + ' %</b>, Restnutzungsdauer <b>' + de(ew.restnutzungsdauer_jahre, 1) + ' J.</b>, Bodenwert ' + eur(ew.bodenwert_eur) + (bog ? ' — abzüglich der Reparaturen (' + bog[1].replace('-', '') + ').' : '.'));
        } else await b2oZeile(s, 'Ertragswert', 'Ein Strich: die Rechnung war hier nicht vollständig. Wo die Quelle endet, endet die Rechnung.');
        await r16Hin(k(), false);
        await zeige(k, 8);
        var ohneSwf = /KEINE Marktanpassung/.test(no);
        await b2oZeile(s, 'Sachwert · zur Plausibilität', '<b>' + eur(sw.value_eur) + '</b>' + (ohneSwf ? ' — vorläufig: ohne amtlichen <b>Sachwertfaktor</b> keine Marktanpassung' + (bog ? ', der Abzug entfällt hier' : '') + '. DealPilot erfindet keinen Faktor.' : '.'));
        var qn = function () { return r16Mb('#wv-box .wv-nachweis') || r16Mb('#wv-box .wv-hk'); };
        if (qn()) {
          await r16Hin(qn(), false);
          await zeige(qn, 8);
          var lk = (sw.sachwertfaktor_quelle_link || {}), q0 = ((cc.quellen_nachweis || P.quellen_nachweis || [])[0] || {});
          var lzsWer = /Obere Gutachterausschuss[^,]*Nordrhein-Westfalen/.test(q0.vermerk || '') ? 'Oberer Gutachterausschuss NRW' : String(q0.vermerk || '').split(',')[0];
          await b2oZeile(s, 'Quellennachweis', 'Liegenschaftszins: <b>' + (lzsWer || '–') + '</b>' + (/zero-2-0/.test(q0.vermerk || '') ? ' (dl-de/zero-2-0)' : '') + '. Wo ein Wert fehlt, steht der Weg dorthin' + (lk.stelle ? ' — beim Sachwertfaktor: ' + lk.stelle.replace(/ für Grundstückswerte in Nordrhein-Westfalen/, ' NRW') : '') + '.');
        }
      },
      async function (s) {   /* 13 · je mehr, desto genauer */
        await zeige(function () { return r16Mb('#wv-box'); }, 6);
        await b2oZeile(s, 'Je mehr, desto genauer', 'Jede optionale Angabe ersetzt einen Pauschalansatz durch dein Objekt — und der Bericht sagt, wo er an Grenzen stößt.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 19 · DAS BANK-PDF (v2273) ═════════════════
     Videoreihe.md, Teil C. KOPIE der Westerfeldstr. 140, Bielefeld (ohne
     Analyse, ohne Ankauf-Stand), beim Aufräumen gelöscht. Gezeigt werden die
     Fassungs-Rückfrage (pdf-wahl.js, echt) und die Bankfassung
     (pdf-investment-bank.js) - weißes Papier, Logo der Marke, alle Blöcke
     aufgerollt. Sie entsteht LOKAL (jsPDF), kein Abruf, kein Download: die
     Bankfassung kennt kein Blob, ihr doc.save wird nur für diesen einen
     Aufruf auf output('blob') umgelenkt (jsPDF.API.save).
     GEMESSEN: das Investment-PDF hell brauchte im Prüflauf 45 s Rechenzeit
     bei stehendem Bild - es wird deshalb nur in der Rückfrage genannt.
     Der Nutzungszähler (/objects/track-usage) ist im Lauf gesperrt (v2271),
     branding.get liefert keine Kontaktdaten (wie Ü2), der Merker
     dp_pdf_wahl wird gesichert und zurückgeschrieben. */
  var _r19 = { url: [], brand: null, save: null, wahl: undefined };
  function r19Zu() {
    var o = q('#dpm-pdf'); if (o && o.parentNode) o.parentNode.removeChild(o);
    var w = q('#dp-pdf-wahl'); if (w && w.parentNode) w.parentNode.removeChild(w);
    _r19.url.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} }); _r19.url = [];
    if (_r19.brand) { try { DealPilotConfig.branding.get = _r19.brand; } catch (e) {} _r19.brand = null; }
    if (_r19.save) { try { window.jspdf.jsPDF.API.save = _r19.save; } catch (e) {} _r19.save = null; }
    if (_r19.wahl !== undefined) { try { if (_r19.wahl === null) localStorage.removeItem('dp_pdf_wahl'); else localStorage.setItem('dp_pdf_wahl', _r19.wahl); } catch (e) {} _r19.wahl = undefined; }
  }
  function r19OhneKontakt() {
    if (_r19.brand) return;
    try {
      _r19.brand = DealPilotConfig.branding.get;
      DealPilotConfig.branding.get = function () { var b = _r19.brand.apply(this, arguments) || {}, c = {}; Object.keys(b).forEach(function (k) { c[k] = b[k]; }); ['name', 'role', 'address', 'plz', 'city', 'phone', 'email', 'website'].forEach(function (k) { c[k] = ''; }); return c; };
    } catch (e) {}
  }
  function r19MitKontakt() { if (_r19.brand) { try { DealPilotConfig.branding.get = _r19.brand; } catch (e) {} _r19.brand = null; } }
  async function r19Bank() {
    var fang = null, api = window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API;
    if (!api || typeof window.exportPDFBank !== 'function') return null;
    r19OhneKontakt();
    _r19.save = api.save;
    api.save = function () { fang = this.output('blob'); return this; };
    try { await window.exportPDFBank({ ohneRueckfrage: true }); } catch (e) {} finally { api.save = _r19.save; _r19.save = null; r19MitKontakt(); }
    return fang;
  }
  async function r19Seite(blob, n, oben) {   /* v2276d · oben = PDF-y von unten (FitH,top), gemessen an den Textpositionen der Bankfassung */
    var u = blob.__url || (blob.__url = URL.createObjectURL(blob)); if (_r19.url.indexOf(u) < 0) _r19.url.push(u);
    var o = el('dpm-pdf');
    o.style.cssText = 'position:fixed;left:4%;right:4%;top:3%;bottom:4%;z-index:100002;background:#2b2b2b;border:2px solid ' + G + ';border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    o.innerHTML = '<iframe title="PDF" style="width:100%;height:100%;border:0" src="' + u + '#page=' + n + '&toolbar=0&navpanes=0&view=FitH' + (oben ? ',' + oben : '') + '"></iframe>';
    await warte(4000);
  }
  function r19K() { return (window.State && State.kpis) || {}; }
  function r19Pz(n, st) { return n == null || !isFinite(n) ? '–' : de(n, st == null ? 2 : st) + ' %'; }
  DREHBUECHER['reihe-bankpdf'] = {
    titel: 'Das Bank-PDF', unterzeile: 'Deine Marke, die Bankfassung — der Investment Case', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r19Zu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R11_WESTERFELD, { ohneAnkauf: true, ohneAnalyse: true });
        try { _r19.wahl = localStorage.getItem('dp_pdf_wahl'); localStorage.removeItem('dp_pdf_wahl'); } catch (e) {}
        await r11Beispiel(s, ' Heute: was die <b>Bank</b> davon bekommt.');
      },
      async function (s) {   /* 2 · wo die PDFs liegen, die Rückfrage */
        reiter('s8'); await warte(1300);
        var zeileFn = function () { var e = rhIm('#s8', /^\s*Investment-PDF/); return e && (e.closest('[class*=row]') || e.parentElement); };
        await warteAuf(zeileFn, 5000);
        await zeige(zeileFn, 8);
        await b2oZeile(s, 'Deal-Aktion · Dokumente', 'Hier entstehen die PDFs — aus den Daten des Objekts, ohne Abtippen.');
        try { DealPilotPdfWahl.zeige('bank'); } catch (e) {}
        await warteAuf(function () { return q('#dp-pdf-wahl .dpw-kasten'); }, 3000);
        kegelHoch(true);
        await zeige(function () { return q('#dp-pdf-wahl .dpw-liste'); }, 8);
        var W = (window.DealPilotPdfWahl && DealPilotPdfWahl.wahlen) || [];
        await b2oZeile(s, 'Drei Fassungen', W.map(function (w) { return '<b>' + w.titel + '</b> (' + w.fuer.split(' · ')[0] + ')'; }).join(', ') + '. Der Inhalt ist derselbe.');
        var x = q('#dp-pdf-wahl'); if (x && x.parentNode) x.parentNode.removeChild(x);
        kegelHoch(false);
      },
      async function (s) {   /* 3 · die Bankfassung entsteht: Deckblatt */
        /* GEMESSEN (Prüflauf 19): das Investment-PDF hell brauchte 45 s Rechenzeit, das Bild stand so lange still -
           gezeigt wird deshalb nur die Bankfassung (13 s). Sie ist die weiße Fassung und trägt das Logo der Marke. */
        /* Prüflauf 19: während der 13 s Rechenzeit stand kein Kegel (Ziel war das geschlossene Fenster) */
        await zeige(function () { var e = rhIm('#s8', /^\s*Investment-PDF/); return e && (e.closest('[class*=row]') || e.parentElement); }, 8);
        var zb = r6Beginn(s, 'Die Bankfassung', 'Weißes Papier, alles aufgerollt: jeder Block als Tabelle, so wie eine Bank ihn prüft.');
        var bank = await r19Bank();
        await r6Ende(zb);
        if (!bank) { await b2oZeile(s, 'Die Bankfassung', 'Hier entsteht das PDF.'); return; }
        _r19.bank = bank;
        try { var tx = await bank.text(), mm = /Seite 1 von (\d+)/.exec(tx); _r19.seiten = mm ? Number(mm[1]) : null; _r19.tok = (tx.match(/\(([^()]{1,80})\) Tj/g) || []).map(function (x) { return x.slice(1, -4); }); DPM_REIHE.pdf19 = { bytes: bank.size, seiten: _r19.seiten, namen: (tx.match(RH_PDF_NAMEN) || []).slice(0, 8) }; } catch (e) {}
        zeige(null); kegelHoch(true);
        await r19Seite(bank, 1);
        await b2oZeile(s, 'Oben: deine Marke', 'Kopf mit Logo — mit Whitelabel steht hier deins, nicht unseres. Darunter Objekt, Foto und Stand.');
        await r19Seite(bank, 1, 375);   /* INVESTITION 353 · FINANZIERUNG 202 */
        var K = r19K();
        await b2oZeile(s, 'Seite 1 · Objekt und Finanzierung', 'Kaufpreis <b>' + eur(K.kp) + '</b> mit jeder Nebenkostenzeile, Gesamtinvestition ' + eur(K.gi) + '. Eigenkapital ' + eur(K.ek) + ', Darlehen <b>' + eur(K.d1) + '</b> zu ' + r19Pz(K.d1z_pct) + '.');
      },
      async function (s) {   /* 5 · Kennzahlen */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 2, 700);   /* KENNZAHLEN 663 */
        var K = r19K();
        await b2oZeile(s, 'Seite 2 · Kennzahlen', 'Bruttorendite <b>' + r19Pz(K.bmy) + '</b>, Nettorendite ' + r19Pz(K.nmy) + ', DSCR <b>' + de(K.dscr, 2) + '</b>, Beleihung ' + r19Pz(K.ltv, 1) + ', Cashflow ' + eur(K.cf_m) + ' im Monat.');
        await r19Seite(_r19.bank, 2, 400);   /* VON DER WARMMIETE ZUM CASHFLOW 380 */
        await b2oZeile(s, 'Von der Warmmiete zum Cashflow', 'Darunter die Rechnung Zeile für Zeile: Miete, Bewirtschaftung, Zinsen, Tilgung, Steuer — am Ende <b>' + eur(K.cf_ns) + '</b> nach Steuern im Jahr.');
      },
      async function (s) {   /* 6 · drei Phasen */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 3, 455);   /* CASHFLOW JE PHASE 439 */
        var K = r19K();
        await b2oZeile(s, 'Heute, Zinsbindung, Anschluss', 'Cashflow nach Steuern im Jahr: heute <b>' + eur(K.cf_ns) + '</b>, am Ende der Zinsbindung ' + eur(K.cf_ns_ezb) + ', in der Anschlussfinanzierung ' + eur(K.cf_ns_an) + '.');
      },
      async function (s) {   /* 7 · Vermögen und Exit */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 6);
        var K = r19K();
        /* aus dem PDF gelesen, nicht aus den Kennzahlen: der Exit dort rechnet mit eigener Haltedauer */
        var T = _r19.tok || [], iw = T.indexOf('Angenommene Wertsteigerung p. a.'), ws = iw >= 0 ? T[iw + 1] : null;
        await b2oZeile(s, 'Vermögensaufbau und Exit', 'Wert, Restschuld und Eigenkapital über die Jahre' + (ws ? ', gerechnet mit <b>' + ws + '</b> Wertsteigerung im Jahr' : '') + ' — und was beim Verkauf bliebe. Equity Multiple ' + de(K.em, 1) + '.');
      },
      async function (s) {   /* 8 · Belastungsprobe */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 7);
        await b2oZeile(s, 'Die Belastungsprobe', 'Der DSCR, wenn der Zins steigt oder die Miete fällt — genau die Frage, die jede Bank stellt. Die Antwort steht schon drin.');
      },
      async function (s) {   /* 9 · Annahmen */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 8);
        await b2oZeile(s, 'Annahmen und Hinweise', 'Mietsteigerung, Kostensteigerung, Wertentwicklung: jede Annahme steht offen da. Was fehlt, ist ein Strich — keine Null.');
      },
      async function (s) {   /* 10 · was die Bank bekommt */
        var o = q('#dpm-pdf'); if (o && o.parentNode) o.parentNode.removeChild(o);
        kegelHoch(false);
        await zeige(function () { var e = rhIm('#s8', /^\s*Investment-PDF/); return e && (e.closest('[class*=row]') || e.parentElement); }, 8);
        await b2oZeile(s, 'Der Investment Case', 'Objekt, Finanzierung, Kennzahlen, Phasen, Belastungsprobe' + (_r19.seiten ? ' — <b>' + _r19.seiten + ' Seiten</b>' : '') + ', die eine Kreditanfrage tragen. Ein Klick, jedes Mal aktuell.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 18 · DER MARKTBERICHT (v2273) ════════════
     Videoreihe.md, Teil C. Ein VORHANDENER Bericht: Marktbericht 205 (Stufe 3,
     14.10.2026) der Parkstr. 9, Bad Oeynhausen - geöffnet aus einer KOPIE des
     Objekts (beim Aufräumen gelöscht) über das Marktbericht-Fenster. Gelesen
     wird der gespeicherte Bericht (GET, keine Kosten); im Fenster sperrt
     r16MbSpion alles außer GET, die Adresssuche (externer Dienst) bekommt eine
     leere Antwort. Das PDF entsteht lokal in diesem Fenster (jsPDF, doc.save
     für diesen Aufruf auf Blob umgelenkt) und wird im Bild gezeigt.
     Keine Anbieter- oder Portalnamen in den Kapiteltexten; der Prüflauf
     misst Portal- und Dienstnamen auch im Fenster und im PDF. */
  var R18_BERICHT = 205;
  var _r18 = { pdf: null, url: null, save: null };
  function r18Zu() {
    var o = q('#dpm-pdf'); if (o && o.parentNode) o.parentNode.removeChild(o);
    if (_r18.url) { try { URL.revokeObjectURL(_r18.url); } catch (e) {} _r18.url = null; }
    if (_r18.save) { try { r16Frame().contentWindow.jspdf.jsPDF.API.save = _r18.save; } catch (e) {} _r18.save = null; }
    _r18.pdf = null;
  }
  function r18Mb(re) { var d = r16Doc(); return d ? rhIm(d.body, re) : null; }
  /* Karte eines Abschnitts im Bericht: der Kasten um die Überschrift */
  function r18Karte(re) { return function () { var h = r18Mb(re); return h && (h.closest('.card,.panel,section,.box') || h.parentElement); }; }
  function r18Assess(re) { var d = r16Doc(); if (!d) return null; var a = [].filter.call(d.querySelectorAll('#assessGrid .assess'), function (x) { var l = x.querySelector('.l'); return x.offsetWidth && l && re.test(r6Text(l)); })[0]; return a ? r6Text(a.querySelector('.v')) : null; }
  function r18AssessEl(re) { return function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#assessGrid .assess'), function (x) { var l = x.querySelector('.l'); return x.offsetWidth && l && re.test(r6Text(l)); })[0]; }; }
  async function r18Pdf() {
    var f = r16Frame(), w = f && f.contentWindow, fang = null;
    if (!w || !w.jspdf || !w._lastOut || typeof w.exportPdf !== 'function') return null;
    var api = w.jspdf.jsPDF.API; _r18.save = api.save;
    api.save = function () { fang = this.output('blob'); return this; };
    /* das Deckblatt nennt die Marke des Kontos - im Lauf neutral (wie branding.get in Ü2) */
    var mk = w._mbMarkenName; w._mbMarkenName = 'DealPilot';
    try { await w.exportPdf(w._lastOut); } catch (e) {} finally { api.save = _r18.save; _r18.save = null; w._mbMarkenName = mk; }
    return fang;
  }
  async function r18Seite(n, oben) {   /* v2276c · oben = PDF-y von unten (FitH,top): Deckblatt ab der Adresse */
    if (!_r18.pdf) return;
    if (!_r18.url) _r18.url = URL.createObjectURL(_r18.pdf);
    var o = el('dpm-pdf');
    o.style.cssText = 'position:fixed;left:4%;right:4%;top:3%;bottom:4%;z-index:100002;background:#2b2b2b;border:2px solid ' + G + ';border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    o.innerHTML = '<iframe title="Marktbericht-PDF" style="width:100%;height:100%;border:0" src="' + _r18.url + '#page=' + n + '&toolbar=0&navpanes=0&view=FitH' + (oben ? ',' + oben : '') + '"></iframe>';
    await warte(4000);
  }
  DREHBUECHER['reihe-marktbericht'] = {
    titel: 'Der Marktbericht', unterzeile: 'Lage, Vergleichsdaten, Wertermittlung, Quellen — und das PDF', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r18Zu(); r16MbZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Objekt */
        await r6KopieStart(R11_PARK, { ohneAnkauf: true, ohneAnalyse: true });
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var we = wert('einheiten');
        await b2oZeile(s, 'Das Beispiel', 'Ein Mehrfamilienhaus: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + de(zahl('wfl')) + ' m², Baujahr ' + wert('baujahr') + '. Für das Objekt liegt ein Marktbericht vor.');
      },
      async function (s) {   /* 2 · Bericht öffnen */
        await zeige(function () { return qs('.sb-act-item[onclick*="arktbericht"]') || rhIm('aside.sidebar', /^Marktbericht$/); }, 10);
        await b2oZeile(s, 'Der Marktbericht', 'Links unter Analyse. Er öffnet sich mit den Daten des Objekts — vorhandene Berichte stehen in der Liste.');
        await r16MbOeffnen(R18_BERICHT);
        var sb = function () { return r16Mb('#resultBody .scorebox'); };
        await r16Hin(sb(), true);
        await zeigeGruppe(sb, function () { return r16Mb('#resultBody .kpis'); }, 8);
        var sc = r6Text(r16Mb('#resultBody .scorebox')), num = /(\d+)\s*\/\s*100/.exec(sc), wort = /(Sehr gut|Gut|Solide|Schwach|Kritisch)/i.exec(sc);
        await b2oZeile(s, 'Das Ergebnis oben', 'Deal-Score <b>' + (num ? num[1] : '–') + ' · ' + (wort ? wort[1] : '–') + '</b>, daneben Marktwert, Bruttorendite ' + (r6Text(r16Mb('#kYield')) || '–') + ', Kaufpreisfaktor und Abstand zum Marktwert.');
      },
      async function (s) {   /* 3 · Marktwert und Spanne */
        var vb = function () { return r16Mb('#valBox'); };
        await r16Hin(vb(), false);
        await zeige(vb, 8);
        var t = r6Inner(vb()), mw = /([\d.]+ €)/.exec(t), sp = /Spanne\s*([\d.]+\s*[–-]\s*[\d.]+ €\/m²)/.exec(t), az = /(\d+) Vergleiche/.exec(t);
        await b2oZeile(s, 'Marktwert · Indikation', '<b>' + (mw ? mw[1] : '–') + '</b> — aus ' + (az ? az[1] : '–') + ' vergleichbaren Angeboten der Umgebung' + (sp ? ', Spanne ' + sp[1] : '') + '. Eine Indikation, kein Gutachten.');
      },
      async function (s) {   /* 4 · Lage */
        var ag = function () { return r16Mb('#assessGrid'); };
        await r16Hin(r16Mb('#map'), true);
        await zeigeGruppe(function () { return r16Mb('#map'); }, r18AssessEl(/^Mietentwicklung/), 8);
        await b2oZeile(s, 'Lage', 'Mikrolage <b>' + (r18Assess(/^Mikrolage$/) || '–') + '</b>, Makrolage ' + (r18Assess(/^Makrolage$/) || '–') + ', Nachfrage ' + (r18Assess(/^Nachfrage$/) || '–') + ', Entwicklung ' + (r18Assess(/^Entwicklung$/) || '–') + ' — gemessen, nicht geschätzt.');
      },
      async function (s) {   /* 5 · Bodenrichtwert und Zensus */
        var a = r18AssessEl(/^Bodenrichtwert/), b = r18AssessEl(/^Eigentümerquote/);
        await r16Hin(a(), false);
        await zeigeGruppe(a, function () { return b() || a(); }, 8);
        await b2oZeile(s, 'Bodenrichtwert und Zensus', 'Bodenrichtwert <b>' + (r18Assess(/^Bodenrichtwert/) || '–') + '</b> vom Gutachterausschuss. Zensus 2022: Durchschnittsmiete der Gemeinde ' + (r18Assess(/^Ø Nettokaltmiete Gemeinde/) || '–') + ', Leerstand ' + (r18Assess(/^Leerstandsquote Gemeinde/) || '–') + '.');
      },
      async function (s) {   /* 6 · Marktentwicklung und Vergleichspreise */
        var h = r18Karte(/^Marktentwicklung/i);
        await r16Hin(h(), true);
        await zeige(h, 8);
        await b2oZeile(s, 'Marktentwicklung', 'Wie sich die Preise je m² hier entwickelt haben — echte Historie, keine Prognose.');
        var c = r18Karte(/^Vergleichspreise/i);
        await r16Hin(c(), false);
        await zeige(c, 8);
        var kp = r6Text(r16Mb('#kSqmSp')) || '';
        await b2oZeile(s, 'Vergleichspreise', 'Die Verteilung der Angebotspreise je m² — und wo dein Kaufpreis darin liegt.');
      },
      async function (s) {   /* 7 · Wertermittlung */
        var wv = function () { return r16Mb('#wv-box'); };
        await r16Hin(wv(), true);
        await zeigeGruppe(function () { return r16Mb('#wv-box .wv-boden'); }, function () { var d = r16Doc(); var k = d && d.querySelectorAll('#wv-box .wv-k'); return k && k.length ? k[k.length - 1] : null; }, 8);
        /* innerText liefert die Überschrift in Versalien (CSS) - daher /i (Prüflauf 18: „Bodenwert –“) */
        var t = r6Inner(wv()), bw = /Bodenwert\s*\n?\s*([\d.]+ €)/i.exec(t), lz = /Liegenschaftszinssatz:\s*([\d,]+ %)/.exec(t);
        function karte(re) { var d = r16Doc(); var k = d && [].filter.call(d.querySelectorAll('#wv-box .wv-k'), function (x) { return re.test(r6Text(x.querySelector('.wv-t'))); })[0]; return k ? r6Text(k.querySelector('.wv-v')) : '–'; }
        await b2oZeile(s, 'Wertermittlung · Stufe 3', 'Bodenwert <b>' + (bw ? bw[1] : '–') + '</b>, Liegenschaftszins ' + (lz ? lz[1] : '–') + '. Ertragswert <b>' + karte(/^Ertragswert/i) + '</b>, Sachwert ' + karte(/^Sachwert/i) + ' — mit Rechenweg zum Aufklappen.');
      },
      async function (s) {   /* 8 · Quellennachweis */
        var nw = function () { return r16Mb('#wv-box .wv-nachweis') || r16Mb('#wv-box .wv-hk'); };
        await r16Hin(nw(), false);
        await zeige(nw, 8);
        await b2oZeile(s, 'Quellennachweis', 'Jede amtliche Zahl mit Herkunft: welcher Ausschuss, welcher Jahrgang, welche Lizenz — und ein Link, wo du sie selbst nachschlägst.');
      },
      async function (s) {   /* 9 · der Text */
        var rm = function () { return r16Mb('#reportMd'); };
        await r16Hin(rm(), true);
        await zeige(function () { var r = rm(); return r && (r.querySelector('h1,h2') ? b2oHuelle(r.querySelector('h1,h2'), r.querySelector('p') || r) : r); }, 8);
        var hs = []; try { hs = [].map.call(rm().querySelectorAll('h1,h2'), function (h) { return r6Text(h).replace(/^[—–-]\s*/, ''); }).slice(0, 4); } catch (e) {}
        await b2oZeile(s, 'Der Bericht in Worten', (hs.length ? hs.join(' · ') : 'Zusammenfassung, Lage, Bewertung, Ausblick') + ' — geschrieben aus genau diesen Zahlen.');
      },
      async function (s) {   /* 10 · das PDF */
        var pb = function () { return q('#mbv-pdf'); };
        await zeige(pb, 8);
        var zb = r6Beginn(s, 'Das PDF', 'Ein Klick oben rechts: derselbe Bericht als Dokument.');
        _r18.pdf = await r18Pdf();
        await r6Ende(zb);
        if (!_r18.pdf) { await b2oZeile(s, 'Das PDF', 'Hier entsteht das PDF.'); return; }
        try { var tx = await _r18.pdf.text(), mm = /\/Type \/Pages[\s\S]{0,2000}?\/Count (\d+)/.exec(tx); _r18.seiten = mm ? Number(mm[1]) : null; DPM_REIHE.pdf18 = { bytes: _r18.pdf.size, seiten: _r18.seiten, namen: (tx.match(RH_PDF_NAMEN) || []).slice(0, 8) }; } catch (e) {}
        zeige(null); kegelHoch(true);
        await r18Seite(1, 460);
        await b2oZeile(s, 'Das PDF', 'Deckblatt mit Marktwert und Eckdaten' + (_r18.seiten ? ' — ' + _r18.seiten + ' Seiten' : '') + ': für die Bank, den Verkäufer oder deine Unterlagen.');
        await r18Seite(3);
        await b2oZeile(s, 'Im Dokument', 'Dieselben Kapitel wie am Bildschirm — Lage, Vergleichsdaten, Wertermittlung mit Rechenweg und Quellennachweis.', 600);
      }
    ]
  };

  /* ── Ablauf ───────────────────────────────────────────────────── */
  var lauf = 0, _aktiv = null;
  function stopp() {
    /* v2221 · auch bei Esc mitten im Lauf aufräumen (Boarding-Pass) */
    if (_aktiv && _aktiv.aufraeumen) { try { _aktiv.aufraeumen(); } catch (e) {} }
    _aktiv = null;
    try { document.documentElement.classList.remove('dpm-laeuft'); } catch (e) {}
    lauf = 0; _ziel = null; if (_folge) { clearInterval(_folge); _folge = null; } kegel(null); zeileWeg(); karte(null);
    var s = q('#dpm-stopp'); if (s) s.remove();
    document.removeEventListener('keydown', esc, true);
  }
  function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); stopp(); } }
  async function start(name, opts) {
    var D = DREHBUECHER[name]; if (!D) { console.warn('[messe] unbekanntes Drehbuch: ' + name); return; }
    css(); stopp();
    try { document.documentElement.classList.add('dpm-laeuft'); if (STUDIO) document.documentElement.classList.add('dpm-studio'); } catch (e) {}
    var g = lauf = Date.now(); _aktiv = D;
    var b = el('dpm-stopp', 'button'); b.type = 'button'; b.textContent = '■'; b.title = 'Drehbuch beenden (Esc)'; b.onclick = stopp;
    document.addEventListener('keydown', esc, true);
    var n = D.szenen.length;
    try {
      do {
        if (!STUDIO) karte('<div class="k">DealPilot · Geschichte</div><h1>' + D.titel + '</h1><p>' + D.unterzeile + '</p>');
        if (D.objekt) {   /* v2221: der Quick-Check braucht kein Objekt */
          var id = await objektFinden(D.objekt);
          if (!id) { karte('<h1>Objekt fehlt</h1><p>Für dieses Drehbuch fehlt das Demo-Objekt in diesem Konto.</p>'); await warte(4000); break; }
          if (window._currentObjKey !== id && typeof window.loadSaved === 'function') await window.loadSaved(id);
        }
        if (STUDIO) {
          /* das Studio spielt das Intro; los geht es auf sein Zeichen */
          anStudio({ type: 'bereit', titel: D.titel, n: n });
          await new Promise(function (ok, x) {
            var l = lauf, t = setInterval(function () { if (l !== lauf) { clearInterval(t); x('stopp'); } }, 300);
            addEventListener('message', function h(e) {
              if (e.origin === location.origin && e.data && e.data.source === 'dp-messe-studio' && e.data.type === 'los') { removeEventListener('message', h); clearInterval(t); ok(); }
            });
          });
        } else { await warte(3200); karte(null); await warte(700); }
        for (var i = 0; i < n; i++) {
          var ii = i;
          await D.szenen[i]({ zeile: function (k, t) { zeile(k, t, ii, n); } });
        }
        /* v2235 · im Studio erst das Outro, dann aufräumen (es deckt den Rahmen) */
        if (STUDIO) { anStudio({ type: 'ende' }); await warte(1400); }
        _ziel = null; kegel(null); zeileWeg();
        if (D.aufraeumen) D.aufraeumen(); else reiter('s0');
        if (STUDIO) break;
        if (D.abspann && D.abspann.length) {
          for (var ai = 0; ai < D.abspann.length; ai++) { karte(null); await warte(120); karte(D.abspann[ai].html); await warte(D.abspann[ai].ms); }
        } else { karte(D.schluss); await warte(5500); }
        karte(null); await warte(600);
      } while (opts && opts.schleife && g === lauf);
    } catch (e) { if (e !== 'stopp') console.warn('[messe]', e); }
    if (g === lauf) stopp();
  }
  /* v2221c · Kein Boarding-Pass aus dem Drehbuch - die Sperre steht in
     qc-bridge.js an der Weiche für 'qc-autopass' und fragt laeuft().
     ZURÜCKGENOMMEN (v2221b): ein Erfassungs-Empfänger hier, der die Nachricht
     vor qc-bridge abfangen sollte. Gemessen: am Fenster gilt die Reihenfolge
     der Anmeldung, nicht „Erfassung zuerst" - qc-bridge lädt früher. */

  window.DealPilotMesse = { start: start, stopp: stopp, drehbuecher: function () { return Object.keys(DREHBUECHER); },
    laeuft: function () { return !!lauf; },
    kiAntwort: function () { return lauf ? _kiFrei : null; } };   /* v2225: aufgenommene Analyse, nur im Lauf */   /* v2221: qc-ai-bridge setzt die KI-Bewertung so lange aus */

  /* ?messe=<name>[&schleife] — erst nach Anmeldung und geladenem Plan */
  try {
    var p = new URLSearchParams(location.search), name = p.get('messe');
    if (name) {
      var los = function () { setTimeout(function () { start(name, { schleife: p.has('schleife') }); }, 1500); };
      var bereit = function () { return window.Auth && Auth.isLoggedIn && Auth.isLoggedIn() && !document.getElementById('auth-modal') && typeof window.loadSaved === 'function'; };
      var t = setInterval(function () { if (bereit()) { clearInterval(t); los(); } }, 500);
    }
  } catch (e) {}
})();
