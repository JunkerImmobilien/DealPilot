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
  if (STUDIO) { try { document.documentElement.classList.add('dpm-studio', 'dpm-laeuft'); var _ps = document.createElement('style'); _ps.textContent = 'html.dpm-studio #dp-pilot,html.dpm-studio #dp-tower,html.dpm-studio .dp-pilot-fab{display:none!important}'; document.head.appendChild(_ps); } catch (e) {} }
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
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), h = el('dpm-huelle');
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
  var RH_BUSTER = 'v2257';
  /* v2257 · dazu BMF (Modul 10b, abgespielt), die RND-Gutachten-Anfrage und
     alles, was eine Anfrage an Dritte oder eine Zahlung ausloest */
  var RH_SPERRE = /\/marktbericht\/reports|\/ai\/|\/avm\/|immometrica|\/voice|\/transcri|\/passes|\/bmf\/|\/rnd-request|\/deal-action\/submit|\/checkout|gutachten/i;
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
    var D = window.DPM_REIHE_DATEN, steps = D.schritte[st] || [], p = JSON.parse(JSON.stringify(D.mb[st])), enc = new TextEncoder(), i = 0;
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
    /* v2257 · BMF-Kaufpreisaufteilung (Modul 10b): einmal echt gerechnet, hier
       abgespielt. Mit Datei (PDF/XLSX) wird nichts gespielt - das sperrt RH_SPERRE. */
    if (m === 'POST' && D.bmf && /\/bmf\/(aufteilung|pipeline)/.test(u) && !(body && (body.include_pdf || body.include_file))) {
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
  function r6Text(e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
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
    if (opt.bwk) { try { DealPilotBwkProfil.einsetzen(true); } catch (e) {} }
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
      async function (s) {   /* 3 · Notar, Grundbuch, Sonstige */
        await zeigeGruppe(feldVon('notar_p'), feldVon('gba_e'), 8);
        await b2oZeile(s, 'Notar und Grundbuch', 'Notar <b>' + r6Pz(wert('notar_p')) + ' %</b> = ' + eur(zahl('notar_e')) + ' — aus deinen Standardwerten. Grundbuchamt <b>' + r6Pz(wert('gba_p')) + ' %</b> = ' + eur(zahl('gba_e')) + ', fest vorbelegt.');
        await zeigeGruppe(feldVon('ji_p'), feldVon('ji_e'), 8);
        await b2oZeile(s, 'Sonstige Kosten', '<b>' + r6Pz(wert('ji_p')) + ' %</b> = ' + eur(zahl('ji_e')) + ' für Bausachverständigen, Anfahrt, Gutachten — fest vorbelegt, jederzeit änderbar.');
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
        var bl = r6SwkWert(/^Standort & Nebenkosten$/, /^Bundesland$/), ng = r6SwkWert(/^Standort & Nebenkosten$/, /^Notar\/Grundbuch$/);
        await b2oZeile(s, 'Woher die Vorbelegung kommt', 'Einstellungen › <b>Standardwerte</b>: Bundesland ' + (bl || '–') + ', Notar ' + (ng || '–') + '. Was du hier änderst, gilt für jedes neue Objekt.');
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
        var zb = r6Beginn(s, 'Inventar', 'Küche und Möbel, die mitverkauft werden — getrennt vom Gebäude erfasst.');
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
        await b2oZeile(s, 'Gesamtinvestition', 'Kaufpreis, Nebenkosten, Sanierung und Inventar: <b>' + r6Id('gi_val').replace(/^€\s*/, '') + ' €</b> — die Grundlage für Finanzierung und Steuer.', 600);
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
        await b2oZeile(s, 'Pro Quadratmeter', 'Bezogen auf die Wohnfläche aus dem Reiter Objekt: <b>' + r6Id('miete_qm') + '</b> kalt.');
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
        await b2oZeile(s, 'Oder im Detail', '<b>' + wert('me_anz') + ' Erhöhungen</b> alle ' + wert('me_int') + ' Jahre, zusammen ' + r6Pz(wert('me_pct')) + ' % — Soll-Mietspiegel ' + wert('me_soll') + ' €/m²' + (r6Id('me_opp') && r6Id('me_opp') !== '—' ? ', Abstand ' + r6Id('me_opp') : '') + '.');
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
        var kt = (q('#v10-market-modal .md-karte') || {}).innerText || '';
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
        await b2oZeile(s, 'Die Beleihung', 'Beleihungsauslauf <b>' + r6Id('r-ltv') + '</b> — über 80 % rechnet die Bank mit Zuschlag, siehe oben.');
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
        await zeige(function () { return q('#bwk-standard-bar'); }, 8);
        var tx = r6Text(q('#bwk-standard-bar .bwk-std-t'));
        await b2oZeile(s, 'Standardwerte je Objektart', 'Für eine Eigentumswohnung: ' + (tx || '–') + '.');
        var b = r6Knopf('#bwk-standard-bar', /Standardwerte einsetzen/);
        if (b) { await zeige(function () { return r6Knopf('#bwk-standard-bar', /Standardwerte einsetzen/); }, 10); await warte(1300); b.click(); }
        await warte(1200);
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

  /* ── MODUL 10a · STEUER: AfA, ZEITRÄUME, RESTNUTZUNGSDAUER ───── */
  function r6Wiz() { return q('.rnd-wiz-overlay'); }
  function r6WizTitel() { var h = r6Wiz() && r6Wiz().querySelector('h2,h3'); return h ? r6Text(h) : ''; }
  async function r6WizWeiter() {
    var w = r6Wiz(); if (!w) return false;
    [].forEach.call(w.querySelectorAll('select'), function (x) { if (x.offsetWidth && !x.value && x.options.length > 1) { x.selectedIndex = 1; x.dispatchEvent(new Event('change', { bubbles: true })); } });
    var b = [].filter.call(w.querySelectorAll('button'), function (x) { return x.offsetWidth && /Weiter|Berechnen/.test(x.textContent); }).slice(-1)[0];
    if (!b) return false;
    b.click(); await warte(500); return true;
  }
  DREHBUECHER['reihe-steuer'] = {
    titel: 'Steuer: AfA, Zeiträume, Restnutzungsdauer', unterzeile: 'Was die Immobilie dir steuerlich bringt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () {
      var w = r6Wiz(); if (w) { var x = [].filter.call(w.querySelectorAll('button'), function (b) { return b.textContent.trim() === '×'; })[0]; try { if (x) x.click(); else w.remove(); } catch (e) {} }
      r6EinstellungenZu(); rhAufraeumen();
    },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6Start({ kp: true, nkm: true, bwk: true, kaufdat: true });
        await r6Beispiel(s, ' Gekauft für 180.000 €, vermietet für 900 € kalt — heute: der Reiter <b>Steuer</b>.');
      },
      async function (s) {   /* 2 · persönliche Steuer */
        reiter('s3-tax'); await warte(900);
        await zeigeGruppe(feldVon('zve'), feldVon('grenz'), 8);
        await b2oZeile(s, 'Deine persönliche Steuer', 'Zu versteuerndes Einkommen <b>' + eur(zahl('zve')) + '</b> — daraus rechnet DealPilot den Grenzsteuersatz nach § 32a selbst: <b>' + r6Pz(wert('grenz')) + ' %</b>.');
      },
      async function (s) {   /* 3 · Steuerzeiträume */
        await zeige(function () { return q('#s3-tax .v842-tax-link'); }, 10);
        await warte(1200);
        try { window._v842OpenTaxPeriods(); } catch (e) {}
        await warteAuf(function () { return rhIm('.settings-modal', /^Steuerzeiträume verwalten$/); }, 6000);
        kegelHoch(true);
        await warte(800);
        var kopf = rhIm('.settings-modal', /^Steuerzeiträume verwalten$/);
        var tab = kopf && kopf.closest('div[class]') && (kopf.closest('section,.card,div[style]') || kopf.parentElement);
        var box = kopf; for (var i = 0; i < 4 && box && !box.querySelector('table,[class*=row]'); i++) box = box.parentElement;
        if (box) box.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(function () { return box; }, 8);
        var zeilen = box ? [].filter.call(box.querySelectorAll('tr,[class*=row]'), function (r) { return /\d{2}\.\d{2}\.\d{4}/.test(r.textContent) && /€/.test(r.textContent); }).slice(0, 2).map(function (r) {
          var t = r6Text(r), d = t.match(/\d{2}\.\d{2}\.\d{4}/g) || [], z = /([\d.]+ €)/.exec(t);
          return (d[0] ? 'ab ' + d[0] : '') + (z ? ': <b>' + z[1] + '</b>' : '');
        }) : [];
        await b2oZeile(s, 'Steuerzeiträume', 'Dein Einkommen je Zeitraum' + (zeilen.length ? ' — ' + zeilen.join(', ') : '') + '. Jedes Objekt bekommt automatisch den passenden, nach Kaufdatum.');
        r6EinstellungenZu();
        await warte(700);
      },
      async function (s) {   /* 4 · AfA */
        await zeigeGruppe(feldVon('afa_satz'), function () { return q('#afa_kalk') && q('#afa_kalk').closest('.f'); }, 8);
        var n = (q('#afa_satz') || { options: [] }).options.length;
        await b2oZeile(s, 'Die Abschreibung', 'AfA-Satz <b>' + r6Optionstext('afa_satz') + '</b>, Gebäudeanteil ' + wert('geb_ant') + ' % — das ergibt <b>' + r6Id('afa_kalk') + '</b> im Jahr.');
        await b2oZeile(s, 'Die Abschreibung', 'Zur Wahl: 2,5 % vor 1925, 3 % für Neubauten ab 2023, 5 % degressiv — und ein <b>eigener Satz</b> mit Restnutzungsdauer.');
      },
      async function (s) {   /* 5 · eigener Satz -> Restnutzungsdauer ermitteln */
        var sel = q('#afa_satz'); if (sel) { sel.value = 'eigen'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await warte(800);
        await zeige(function () { return q('#afa-eigen-box'); }, 8);
        await b2oZeile(s, 'Eigener Satz', 'Mit kürzerer Restnutzungsdauer steigt die AfA: 100 ÷ Restnutzungsdauer. Das Finanzamt will dafür ein <b>Gutachten</b>.');
        await zeige(function () { return q('#afa-rnd-ermitteln'); }, 10);
        await warte(1300);
        var b = q('#afa-rnd-ermitteln'); if (b) b.click();
        await warteAuf(r6Wiz, 5000);
        kegelHoch(true);
        await warte(900);
        await zeige(function () { var w = r6Wiz(); return w && (w.querySelector('.rnd-wiz-modal,[class*=modal]') || w.firstElementChild); }, 6);
        await b2oZeile(s, 'Restnutzungsdauer ermitteln', 'Neun Schritte, die Objektdaten sind schon da: ' + wert('str') + ' ' + wert('hnr') + ', Baujahr ' + wert('baujahr') + ', ' + wert('wfl') + ' m².');
      },
      async function (s) {   /* 6 · durch den Wizard */
        var zb = r6Beginn(s, 'Restnutzungsdauer ermitteln', 'Bauweise, Technik, Modernisierungen, Zustand der Gewerke, Schäden — Schritt für Schritt.');
        for (var i = 0; i < 8 && !/Schritt 9/.test(r6WizTitel()); i++) { if (!(await r6WizWeiter())) break; await warte(1100); }
        await warteAuf(function () { return /Schritt 9/.test(r6WizTitel()); }, 4000);
        await warte(700);
        var t = (r6Wiz() || {}).innerText || '';
        var rnd = /GESCHÄTZTE RESTNUTZUNGSDAUER[\s\S]*?(\d+)\s*Jahre/i.exec(t), urt = /(Gutachten lohnt[^\n]*)/.exec(t), net = /Netto-Vorteil\s*([−\-+]?[\d.]+\s*€)/.exec(t);
        await r6Ende(zb);
        await zeige(function () { var e = rhIm(r6Wiz(), /GESCHÄTZTE RESTNUTZUNGSDAUER/i); return e && (e.closest('div[style]') || e.parentElement); }, 8);
        await b2oZeile(s, 'Das Ergebnis', 'Geschätzte Restnutzungsdauer <b>' + (rnd ? rnd[1] + ' Jahre' : '–') + '</b>. ' + (urt ? '„' + urt[1].trim() + '“' : '') + (net ? ' — Netto-Vorteil ' + net[1] : '') + '.');
      },
      async function (s) {   /* 7 · Anfrage: nur zeigen */
        await zeige(function () { var w = r6Wiz(); return w && [].filter.call(w.querySelectorAll('button'), function (b) { return b.offsetWidth && /Anfrage senden/.test(b.textContent); })[0]; }, 10);
        await b2oZeile(s, 'Gutachten anfragen', 'Lohnt es sich, geht von hier die <b>Anfrage</b> an einen Sachverständigen — mit allen Angaben. Bei einem Baujahr 1998 sagt DealPilot ehrlich: lieber nicht.');
        var w = r6Wiz(); if (w) { var x = [].filter.call(w.querySelectorAll('button'), function (b) { return b.textContent.trim() === '×'; })[0]; if (x) x.click(); }
        kegelHoch(false);
        await warte(600);
        var sel = q('#afa_satz'); if (sel) { sel.value = '2.0'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await warte(700);
      },
      async function (s) {   /* 8 · Steuer-Modul */
        var e = rhIm('#s3-tax', /^Überschuss \/ Verlust V\+V \(diese Immobilie\)$/);
        var box = e && e.closest('.card'); if (box) box.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeige(function () { var x = rhIm('#s3-tax', /^Überschuss \/ Verlust V\+V \(diese Immobilie\)$/); return x && (x.closest('.tax-grid,.card') || x.parentElement); }, 8);
        var ein = r6Neben('#s3-tax', /^Einnahmen V\+V/), wk = r6Neben('#s3-tax', /^Werbungskosten gesamt/), erg = r6Neben('#s3-tax', /^Überschuss \/ Verlust V\+V \(diese Immobilie\)$/);
        await b2oZeile(s, 'Was im ersten Jahr übrig bleibt', 'Einnahmen <b>' + (ein || '–') + '</b>, Werbungskosten ' + (wk || '–') + ' — Zinsen, Bewirtschaftung, AfA. Ergebnis aus Vermietung: <b>' + (erg || '–') + '</b>.');
        var w = rhIm('#s3-tax', /^STEUERVERLAUF/i) || rhIm('#s3-tax', /Steuerverlauf/i);
        if (w) { (w.closest('.card') || w).scrollIntoView({ block: 'start' }); await warte(400); }
        await zeige(function () { var x = rhIm('#s3-tax', /Steuerverlauf/i); return x && (x.closest('.card') || x.parentElement); }, 8);
        var sum = rhIm('#s3-tax', /^Summe über 15 Jahre:?$/);
        await b2oZeile(s, 'Über 15 Jahre', 'Erstattung oder Nachzahlung — Jahr für Jahr, mit echter Progression' + (sum && sum.nextElementSibling ? '. Summe: <b>' + r6Text(sum.nextElementSibling) + '</b>' : '') + '. Die Kaufpreisaufteilung zeigt Modul 10b.', 600);
      }
    ]
  };

  /* ── MODUL 10b · BMF-KAUFPREISAUFTEILUNG ──────────────────────── */
  function r6Bmf() { return q('#bmfOverlay'); }
  function r6BmfPane() { return q('#bmfOverlay .bmfmo-pane.active'); }
  async function r6BmfWeiter() { var b = q('#btnBmfNext'); if (b) b.click(); await warte(1600); }
  DREHBUECHER['reihe-bmf'] = {
    titel: 'BMF-Kaufpreisaufteilung', unterzeile: 'Gebäude und Boden — Abschlag, Klausel, Absprünge', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { try { if (r6Bmf() && typeof window.closeBMFModal === 'function') window.closeBMFModal(); } catch (e) {} rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6Start({ kp: true, nkm: true, bwk: true, kaufdat: true, bmf: true });
        await r6Beispiel(s, '');
        await zeigeGruppe(feldVon('kaufdat'), feldVon('mea'), 8);
        await b2oZeile(s, 'Was der Rechner braucht', 'Kaufdatum <b>02.11.2026</b>, Grundstück <b>' + de(zahl('gsfl')) + ' m²</b>, Miteigentumsanteil <b>' + wert('mea') + ' %</b> — dazu den Bodenrichtwert, den DealPilot selbst holt.');
      },
      async function (s) {   /* 2 · BMF-Rechner öffnen, Schritt 1 */
        reiter('s3-tax'); await warte(800);
        var b = r6Knopf('#s3-tax', /BMF-Rechner/) ; var bb = [].filter.call(document.querySelectorAll('#s3-tax button'), function (x) { return /openBMFModal/.test(x.getAttribute('onclick') || ''); })[0];
        await zeige(function () { return bb; }, 10);
        await b2oZeile(s, 'Der BMF-Rechner', 'Teilt den Kaufpreis in <b>Gebäude</b> und <b>Boden</b> — nach der Arbeitshilfe des Finanzministeriums. Nur das Gebäude wird abgeschrieben.');
        if (bb) bb.click(); else { try { openBMFModal(); } catch (e) {} }
        await warteAuf(function () { return r6BmfPane(); }, 6000);
        kegelHoch(true);
        await warte(1000);
        await zeige(function () { var p = r6BmfPane(); return p && (p.querySelector('.bmfmo-ak-box,[class*=summary],[class*=box]') || p.firstElementChild); }, 6);
        var t = (r6BmfPane() || {}).innerText || '';
        var kp = /Brutto-Kaufpreis\s*\n?\s*([\d.]+ €)/.exec(t), nk = /\+\s*Nebenkosten\s*\n?\s*([\d.]+ €)/.exec(t), ak = /Prognose-AK[^\n]*\n?[^\d]*([\d.]+ €)/.exec(t);
        await b2oZeile(s, 'Schritt 1 · Anschaffungskosten', 'Aus dem Reiter Investition: Kaufpreis ' + (kp ? kp[1] : '–') + ' + Nebenkosten ' + (nk ? nk[1] : '–') + ' = <b>' + (ak ? ak[1] : '–') + '</b>. Fahrten zum Objekt und Notar kommen hier dazu.');
      },
      async function (s) {   /* 3 · Schritt 2: amtliche Aufteilung */
        await r6BmfWeiter();
        await warteAuf(function () { return rhIm('#bmfOverlay', /Nach Jacoby/); }, 8000);
        await warte(600);
        await zeigeGruppe(function () { return q('#bmf_gsfl') && q('#bmf_gsfl').closest('div'); }, function () { return q('#bmf_mea') && q('#bmf_mea').closest('div'); }, 6);
        await b2oZeile(s, 'Schritt 2 · Die Aufteilung', 'Grundstück ' + wert('bmf_gsfl') + ' m², Bodenrichtwert <b>' + wert('bmf_brw') + ' €/m²</b>, Anteil ' + wert('bmf_mea') + ' % — alles aus dem Objekt übernommen.');
        var j = rhIm('#bmfOverlay', /Nach Jacoby/), jt = j ? r6Text(j.closest('div') || j) : '';
        var am = /([\d,]+)\s*%\s*Gebäude per Ertragswert/.exec(((r6BmfPane() || {}).innerText || '')), jm = /Nach Jacoby[^:]*:\s*([\d,]+ %)/.exec(jt);
        await zeige(function () { var e = rhIm('#bmfOverlay', /Nach Jacoby/); return e && (e.closest('div[class]') || e); }, 8);
        await b2oZeile(s, 'Schritt 2 · Die Aufteilung', 'Zum Vergleich rechnet DealPilot die umgekehrte Ertragswertmethode (BFH IX R 12/21) mit: <b>' + (jm ? jm[1] : '–') + ' Gebäude</b>.');
      },
      async function (s) {   /* 4 · Schritt 3: vier Varianten */
        await r6BmfWeiter();
        await warteAuf(function () { var p = r6BmfPane(); return p && p.id === 'p-afa' && p.querySelector('table'); }, 6000);
        await warte(600);
        await zeige(function () { var p = r6BmfPane(); return p && p.querySelector('table'); }, 6);
        var tt = ((r6BmfPane() || {}).innerText || '');
        var g = /Gebäude %\s+([\d,]+ %)\s+([\d,]+ %)\s+([\d,]+ %)\s+([\d,]+ %)/.exec(tt), a = /AfA Gebäude\/Jahr\s+([\d.]+ €)\s+([\d.]+ €)\s+([\d.]+ €)\s+([\d.]+ €)/.exec(tt);
        await b2oZeile(s, 'Schritt 3 · Amtlich und drei Abweichungen', 'Amtlich <b>' + (g ? g[1] : '–') + '</b> Gebäude — mit Boden −15/−20/−25 % bis ' + (g ? g[4] : '–') + '. AfA ' + (a ? a[1] + ' bis ' + a[4] : '–') + ' im Jahr.');
      },
      async function (s) {   /* 5 · Schritt 4: Variante wählen */
        await r6BmfWeiter();
        await warteAuf(function () { var p = r6BmfPane(); return p && p.id === 'p-hebel'; }, 6000);
        await warte(600);
        function karte(v) { return [].filter.call(document.querySelectorAll('#bmfOverlay [onclick*="_v292SelectVariant"]'), function (x) { return x.tagName !== 'INPUT' && new RegExp("'" + v + "'").test(x.getAttribute('onclick')); })[0] || null; }
        await zeige(function () { var a = karte('amtlich'), b = karte('aggressiv'); return a && b ? b2oHuelle(a, b) : (a || b); }, 6);
        var zb = r6Beginn(s, 'Schritt 4 · Du wählst', 'Vier Karten, jede mit Risiko-Score — grün ist die Arbeitshilfe, rot kann das Finanzamt beanstanden.');
        await warte(3200);
        var o = karte('optimiert'); if (o) o.click();
        await warte(900);
        await r6Ende(zb);
        await zeige(function () { return karte('optimiert'); }, 8);
        var kt = r6Text(karte('optimiert'));
        var gp = /Gebäude\s*([\d,]+ %)/.exec(kt), af = /AfA Gebäude \/ Jahr\s*([\d.]+ €)/.exec(kt), sc = /Risiko Score (\d)/.exec(kt);
        await b2oZeile(s, 'Optimiert · Boden −20 %', 'Gebäude <b>' + (gp ? gp[1] : '–') + '</b>, AfA <b>' + (af ? af[1] : '–') + '</b> im Jahr' + (sc ? ' — Risiko-Score ' + sc[1] : '') + '. Mit Begründung vertretbar.');
      },
      async function (s) {   /* 6 · Bodenabschlag: 20 % */
        var t = q('#bmf-boden-tab'); if (t) t.click();
        await warteAuf(function () { var p = r6BmfPane(); return p && p.id === 'p-boden' && p.querySelector('table'); }, 6000);
        await warte(800);
        var p = r6BmfPane(); if (p) { var sc = p.closest('.bmfmo-body'); if (sc) sc.scrollTop = 0; }
        await zeige(function () { var x = r6BmfPane(); return x && x.querySelector('table'); }, 6);
        var tt = ((r6BmfPane() || {}).innerText || '');
        var kopf = /MIT\s+(\d+)\s*%\s*ABSCHLAG/i.exec(tt), bo = /davon Grund und Boden\s+([\d.]+ €)\s+([\d.]+ €)/.exec(tt), af = /AfA pro Jahr bei [\d,]+ %\s+([\d.]+ €)\s+([\d.]+ €)\s+([+−\-]?[\d.]+ €)/.exec(tt);
        await b2oZeile(s, 'Bodenabschlag ' + (kopf ? kopf[1] : '20') + ' %', 'Die amtliche Zahl bleibt stehen, das Szenario daneben: Boden <b>' + (bo ? bo[2] : '–') + '</b> statt ' + (bo ? bo[1] : '–') + ', AfA <b>' + (af ? af[2] : '–') + '</b> statt ' + (af ? af[1] : '–') + ' im Jahr.');
      },
      async function (s) {   /* 7 · Notarklausel */
        var k = rhIm('#bmfOverlay .bmfmo-pane.active', /^TEXT FÜR DEN KAUFVERTRAG$/i) || rhIm('#bmfOverlay .bmfmo-pane.active', /Text für den Kaufvertrag/i);
        var box = k && (k.closest('div[class]') || k.parentElement); if (box) box.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(function () { var e = rhIm('#bmfOverlay .bmfmo-pane.active', /Text für den Kaufvertrag/i); var b = e; for (var i = 0; i < 3 && b && !/kopieren/i.test(b.textContent); i++) b = b.parentElement; return b || e; }, 8);
        await b2oZeile(s, 'Die Notarklausel', 'Der <b>Text für den Kaufvertrag</b> steht fertig da — mit Begründung zum Kopieren für den Notar. Ohne Begründung bleibt ein Abschlag angreifbar.');
      },
      async function (s) {   /* 8 · Absprünge */
        var b1 = r6Knopf('#bmfOverlay .bmfmo-pane.active', /Restnutzungsdauer berechnen/);
        await zeige(function () { return r6Knopf('#bmfOverlay .bmfmo-pane.active', /Restnutzungsdauer berechnen/) || r6BmfPane(); }, 8);
        await b2oZeile(s, 'Die Absprünge', '<b>Restnutzungsdauer berechnen</b> öffnet den Rechner aus Modul 10a. Dazu PDF der Aufteilung, die ausgefüllte BMF-Arbeitshilfe und das Original als Excel.');
      },
      async function (s) {   /* 9 · Übernehmen */
        var tb = q('#bmfOverlay .bmfmo-tab[data-pane="p-hebel"]'); if (tb) tb.click();
        await warte(1000);
        var ub = r6Knopf('#bmfOverlay', /Übernehmen/);
        await zeige(function () { return r6Knopf('#bmfOverlay', /Übernehmen/); }, 10);
        var zb = r6Beginn(s, 'Übernehmen', 'Ein Klick — der Gebäudeanteil der gewählten Variante geht in den Reiter Steuer.');
        await warte(2600);
        if (ub) ub.click();
        await warteAuf(function () { return !r6Bmf() || !r6Bmf().classList.contains('open'); }, 5000);
        kegelHoch(false);
        await warte(1200);
        if (!q('#s3-tax.active')) reiter('s3-tax');
        await r6Ende(zb);
        await zeigeGruppe(feldVon('geb_ant'), function () { return q('#afa_kalk') && q('#afa_kalk').closest('.f'); }, 8);
        await b2oZeile(s, 'Im Reiter Steuer', 'Gebäudeanteil <b>' + r6Pz(wert('geb_ant')) + ' %</b> — die Abschreibung steigt auf <b>' + r6Id('afa_kalk') + '</b> im Jahr.', 600);
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
