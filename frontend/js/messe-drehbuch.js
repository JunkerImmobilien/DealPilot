'use strict';
/* ═══════════════════════════════════════════════════════════════════
   messe-drehbuch.js — v2219 · Selbstlaufende Drehbücher für Messe-Videos

   Marcel, 14.10.2026: „ich brauche Messe-Videos … mach mal so ein Drehbuch
   fertig." Vorschlag (angenommen): kein abgefilmtes Klicken, sondern ein
   Drehbuch IN der App. Es bedient die echte Oberfläche, legt einen Lichtkegel
   auf die Stelle und schreibt eine Untertitelzeile darunter. Aufnehmen mit
   OBS oder Win+Alt+R; am Stand kann es auch live in Schleife laufen.

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
    for (var fe = e.ownerDocument.defaultView.frameElement; fe; fe = fe.ownerDocument.defaultView.frameElement) {
      var fr = fe.getBoundingClientRect(); x += fr.left + fe.clientLeft; y += fr.top + fe.clientTop;
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
    var z = el('dpm-zeile');
    z.innerHTML = '<div class="k">' + kick + '</div><div class="t">' + text + '</div><div class="p">'
      + Array.apply(null, { length: n }).map(function (_, j) { return '<i class="' + (j <= i ? 'an' : '') + '"></i>'; }).join('') + '</div>';
    z.classList.add('an');
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
    if (neu) { z.style.transition = 'none'; }
    z.style.left = Math.round(o.x) + 'px'; z.style.top = Math.round(o.y) + 'px';
    if (neu) { void z.offsetWidth; z.style.transition = ''; }
    /* Anfang an der Kartenkante, Ende an der Zielkante (zur Karte hin) */
    var a, b;
    if (o.k === 'l') { a = { x: o.x, y: o.y + h / 2 }; b = { x: r.right, y: klemm(o.y + h / 2, r.top + 8, r.bottom - 8) }; }
    else if (o.k === 'r') { a = { x: o.x + w, y: o.y + h / 2 }; b = { x: r.left, y: klemm(o.y + h / 2, r.top + 8, r.bottom - 8) }; }
    else if (o.k === 'o') { a = { x: o.x + w / 2, y: o.y }; b = { x: klemm(o.x + w / 2, r.left + 8, r.right - 8), y: r.bottom }; }
    else { a = { x: o.x + w / 2, y: o.y + h }; b = { x: klemm(o.x + w / 2, r.left + 8, r.right - 8), y: r.top }; }
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
  function frei(r) { return r.top >= 70 && r.bottom <= innerHeight - 170; }
  /* v2219f · scrollIntoView(smooth) kam im Drehbuch gemessen NIE an (Kasten blieb
     bei 572-736 stehen; dieselbe Zeile ohne smooth scrollte sofort). Gescrollt wird
     deshalb der Container selbst (.main-col), mittig in den freien Bereich. */
  function scroller(e) {
    /* v2221 · durch iframes hindurch: das Quick-Check-Dokument scrollt nicht
       selbst (es ist so hoch wie sein Inhalt), gescrollt wird .main-col */
    for (var a = e; a; a = a.ownerDocument.defaultView.frameElement) {
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
    var r = rect(e), s = scroller(e), mitte = (70 + innerHeight - 170) / 2;
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
          s.zeile('Jeder Wert mit Quelle', 'Kaufpreis und Hausgeld aus dem Exposé, Fläche, Baujahr und Lage aus dem Marktbericht — ein Klick übernimmt.');
          await warte(4400);
          var ap = q('#oabi-apply'); if (ap) ap.click();
          await warte(1300);
        },
        async function (s) {   /* 4 · Marktwertindikation (Mitschnitt) */
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          var st = qcEl('_mb_state');
          if (!st) { var d = qcDoc(); st = d.createElement('input'); st.type = 'hidden'; st.id = '_mb_state'; d.body.appendChild(st); }
          st.value = JSON.stringify({ ts: Date.now(), card: MB_KARTE, mode: 'med', collapsed: false });
          try { qcWin()._oabFeedTrigger(); } catch (e) {}
          await warte(900);
          await zeige(function () { return qcEl('oab-results'); }, 6);
          var mw = MB_KARTE.mw, mm = MB_KARTE.mm;
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
  var MB_KARTE = {"area":96,"rating":"Attraktiv","conf":{"label":"Niedrig","pct":43},"mikro":"Sehr gut · 8,2","makro":"Gut · 6,0","microRaw":82,"macroRaw":60,"trendRaw":null,"trend":"–","zensus":{"ebene":"Gemeinde","name":"Bad Oeynhausen, Stadt","leer":3.6,"eig":47.3,"miete":5.73},"brw":{"wert":200,"quelle":"BORIS-NRW","stichtag":"2026-01-01"},"makroGemessen":4,"mw":{"low":199000,"med":251000,"high":351000,"sqm":"2.615 €/m²"},"mm":{"low":766,"med":881,"high":1012,"sqm":"9,18 €/m² kalt"}};

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
    try { document.documentElement.classList.add('dpm-laeuft'); } catch (e) {}
    var g = lauf = Date.now(); _aktiv = D;
    var b = el('dpm-stopp', 'button'); b.type = 'button'; b.textContent = '■'; b.title = 'Drehbuch beenden (Esc)'; b.onclick = stopp;
    document.addEventListener('keydown', esc, true);
    var n = D.szenen.length;
    try {
      do {
        karte('<div class="k">DealPilot · Geschichte</div><h1>' + D.titel + '</h1><p>' + D.unterzeile + '</p>');
        if (D.objekt) {   /* v2221: der Quick-Check braucht kein Objekt */
          var id = await objektFinden(D.objekt);
          if (!id) { karte('<h1>Objekt fehlt</h1><p>Für dieses Drehbuch fehlt das Demo-Objekt in diesem Konto.</p>'); await warte(4000); break; }
          if (window._currentObjKey !== id && typeof window.loadSaved === 'function') await window.loadSaved(id);
        }
        await warte(3200);
        karte(null); await warte(700);
        for (var i = 0; i < n; i++) {
          var ii = i;
          await D.szenen[i]({ zeile: function (k, t) { zeile(k, t, ii, n); } });
        }
        _ziel = null; kegel(null); zeileWeg();
        if (D.aufraeumen) D.aufraeumen(); else reiter('s0');
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
