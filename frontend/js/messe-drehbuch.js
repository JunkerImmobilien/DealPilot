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
      /* v2481k · die gewählte Option sichtbar markiert halten (Modul 26, „Aus Wohnungen") */
      /* v2481l · gemessen am Prüflauf: nur ein Rahmen ging im Goldrand des Kegels unter, der Knopf
         blieb weiß wie seine Nachbarn - jetzt zusätzlich gefüllt (Gold, dunkle Schrift) */
      '.dpm-wahl{background:' + GH + '!important;color:#050505!important;font-weight:700!important;outline:3px solid ' + GH + '!important;outline-offset:4px!important;box-shadow:0 0 22px 6px ' + mix(GH, 60) + '!important;animation:dpmWahl 1.1s ease-in-out infinite alternate}',
      '@keyframes dpmWahl{from{outline-offset:3px}to{outline-offset:7px}}',
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
  /* v2374b · DER RAHMEN NUR UM DEN SICHTBAREN TEIL. GEMESSEN im Mitschnitt-Lauf Modul 25
     (DPM_KEGEL_MESSUNG, 300-ms-Proben): die Score-Karten im Chat sind 472 bzw. 667 px hoch,
     der Chat (#vi-rf-chat, overflow auto) zeigt 400 px. Der Kegel rahmte das GANZE Element -
     beim Investor Deal Score von y 104 an, der Chat beginnt bei 278: der Rahmen lag über
     Kopf und Eingabe, in 44 von 47 Proben. rect() kennt nur iframes, keine Scrollbehälter.
     sichtRect schneidet mit jedem Vorfahren, der überläuft (auto/scroll/hidden/clip), auch
     über iframe-Grenzen. null = ganz verdeckt. */
  function docVersatz(d) {
    var x = 0, y = 0;
    while (d && d !== document) { var fe = d.defaultView.frameElement; if (!fe) break; var fr = fe.getBoundingClientRect(); x += fr.left + fe.clientLeft; y += fr.top + fe.clientTop; d = fe.ownerDocument; }
    return { x: x, y: y };
  }
  function sichtRect(e) {
    if (!e || !e.getBoundingClientRect) return null;
    var r = rect(e), L = r.left, T = r.top, R = r.right, B = r.bottom, node = e, d = e.ownerDocument;
    while (d) {
      var w = d.defaultView, o = docVersatz(d);
      /* ein fest positioniertes Element entkommt dem Überlauf seiner Vorfahren */
      for (var c = node, s = node.parentElement; s && s !== d.documentElement && s !== d.body; c = s, s = s.parentElement) {
        if (w.getComputedStyle(c).position === 'fixed') break;
        var cs = w.getComputedStyle(s);
        if (/auto|scroll|hidden|clip/.test(cs.overflowY + ' ' + cs.overflowX)) {
          var sr = s.getBoundingClientRect();
          L = Math.max(L, sr.left + o.x + s.clientLeft); T = Math.max(T, sr.top + o.y + s.clientTop);
          R = Math.min(R, sr.left + o.x + s.clientLeft + s.clientWidth); B = Math.min(B, sr.top + o.y + s.clientTop + s.clientHeight);
        }
      }
      if (d === document) break;
      var fe = w.frameElement; if (!fe) break;
      /* der Inhalt eines iframes endet an dessen Rand */
      var fr = fe.getBoundingClientRect(), of = docVersatz(fe.ownerDocument);
      L = Math.max(L, fr.left + of.x); T = Math.max(T, fr.top + of.y); R = Math.min(R, fr.right + of.x); B = Math.min(B, fr.bottom + of.y);
      node = fe; d = fe.ownerDocument;
    }
    if (R - L < 2 || B - T < 2) return null;
    return { left: L, top: T, width: R - L, height: B - T, right: R, bottom: B, voll: r };
  }
  function kegel(ziel, pad) {
    var k = el('dpm-kegel');
    if (!ziel) { k.classList.remove('an'); return; }
    var r = sichtRect(ziel) || rect(ziel); pad = pad == null ? 10 : pad;
    k.style.left = (r.left - pad) + 'px'; k.style.top = (r.top - pad) + 'px';
    k.style.width = (r.width + pad * 2) + 'px'; k.style.height = (r.height + pad * 2) + 'px';
    k.classList.add('an');
  }
  /* v2371 · Zeitmarken je Zeile (Marcel 17.10.2026: ein Sprecher soll später
     genau auf die Untertitel gelegt werden). window.DPM_ZEILEN =
     [{t_ms ab Beginn der ersten Szene, t_abs (Date.now), szene, kick, text}],
     dazu DPM_ZEILEN_META {drehbuch, start_abs, ende_ms, tempo, studio}.
     Text ohne HTML, so wie er im Bild steht. */
  var _zt0 = 0;
  function nurText(h) { var d = document.createElement('div'); d.innerHTML = String(h == null ? '' : h); return d.textContent.replace(/\s+/g, ' ').trim(); }
  function zeileMerken(kick, text, i) {
    try { var j = Date.now(); (window.DPM_ZEILEN = window.DPM_ZEILEN || []).push({ t_ms: _zt0 ? j - _zt0 : null, t_abs: j, szene: i + 1, kick: nurText(kick), text: nurText(text) }); } catch (e) {}
  }
  function zeile(kick, text, i, n) {
    zeileMerken(kick, text, i);
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
    var r = sichtRect(t) || rect(t), pad = _pad, W = innerWidth, H = innerHeight;   /* v2374b: sichtbarer Teil */
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
    /* v2374b · DIE KARTE ZAPPELTE. Marcel live: „Der Text … zappelt rum, wird immer hin und her
       eingeblendet." GEMESSEN (100-ms-Proben, 20 s, eine Zeile): kein Seitenwechsel, aber die
       Karte bewegte sich in 46 von 200 Proben - sie wurde in jedem 200-ms-Takt neu ans Ziel
       gerechnet, und das Ziel (Chat, Liste) wächst und rückt mit jeder Antwort; jede neue
       Lage startete das 0,6-s-Gleiten neu. Jetzt bleibt sie stehen, solange dieselbe Seite
       passt, sie das Ziel nicht verdeckt und die neue Lage weniger als 90 px entfernt ist.
       Die Linie folgt dem Ziel weiter (linieNach). */
    if (!spring && _lz && _lz.x != null && Math.abs(_lz.x - o.x) < 90 && Math.abs(_lz.y - o.y) < 90
        && _lz.y + h <= H - RAND && _lz.x + w <= W - RAND
        && !(_lz.x < r.right && _lz.x + w > r.left && _lz.y < r.bottom && _lz.y + h > r.top)) { o.x = _lz.x; o.y = _lz.y; }
    if (spring) { z.style.transition = 'opacity .4s'; }
    var nx = Math.round(o.x) + 'px', ny = Math.round(o.y) + 'px';
    if (z.style.left !== nx) z.style.left = nx;
    if (z.style.top !== ny) z.style.top = ny;
    if (spring) { void z.offsetWidth; z.style.transition = ''; }
    /* v2234b · die Linie wird aus dem AKTUELLEN Kartenrechteck gezogen und
       waehrend des Gleitens (0,6 s) in jedem Bild nachgefuehrt. GEMESSEN: aus
       der Zielposition gerechnet hing sie beim Szenenwechsel lose neben der
       Karte, die noch unterwegs war. */
    _lz = { k: o.k, r: r, x: o.x, y: o.y }; linieNach();
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
  /* v2374b · liegt das Ziel in einem INNEREN Scrollbehälter (Chat, Liste) und ist dort
     beschnitten, wird dieser gerollt: ein Ziel, das höher ist als der Behälter, mit seiner
     Oberkante an dessen Oberkante (dort steht die Zahl), sonst mittig. Gemessen mit dem
     Behälter, nicht mit dem Fenster. true = gerollt. */
  function holenInnen(e) {
    var s = scroller(e); if (!s || s === document.scrollingElement || s.ownerDocument !== e.ownerDocument) return false;
    var er = e.getBoundingClientRect(), sr = s.getBoundingClientRect(), top = sr.top + s.clientTop, hoch = s.clientHeight;
    if (er.top >= top - 1 && er.bottom <= top + hoch + 1) return false;
    var d = er.height > hoch - 16 ? er.top - top - 8 : (er.top + er.height / 2) - (top + hoch / 2);
    if (Math.abs(d) < 4) return false;
    s.scrollTop += d; return true;
  }
  function holen(e, sanft) {
    if (holenInnen(e)) return;
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
      var r = rect(z), sv = sichtRect(z);
      /* v2374b · auch ein im Behälter beschnittenes Ziel ist nicht frei */
      var beschnitten = !sv || (sv.height < Math.min(r.height, innerHeight) - 6);
      if ((!frei(r) || beschnitten) && _nachScroll < 3 && Date.now() - _letzterScroll > 1200) {
        _nachScroll++; _letzterScroll = Date.now();
        holen(z, false);
      }
      kegel(z, _pad);
      platziere();
    }, 200);
  }
  /* v2374a · Messpunkt für den Prüflauf: Ziel, Kegel (Soll laut Stil, Ist im Bild) und der
     sichtbare Ausschnitt des nächsten Scrollbehälters - so lässt sich messen, OB und WARUM der
     Rahmen nicht passt (Versatz, Nachlauf, abgeschnittenes Ziel). Liest nur. */
  window.DPM_KEGEL_MESSUNG = function () {
    var z = zielEl(), k = q('#dpm-kegel'); if (!z || !k) return null;
    var r = rect(z), sv = sichtRect(z), ki = k.getBoundingClientRect(), sc = scroller(z), sr = sc && sc !== document.scrollingElement ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
    var f = function (o) { return { x: Math.round(o.left), y: Math.round(o.top), w: Math.round(o.width != null ? o.width : o.right - o.left), h: Math.round(o.height != null ? o.height : o.bottom - o.top) }; };
    return { ziel: f(r), sichtbar: sv ? f(sv) : null, pad: _pad, kegelStil: { x: parseFloat(k.style.left), y: parseFloat(k.style.top), w: parseFloat(k.style.width), h: parseFloat(k.style.height) }, kegelIst: f(ki),
      sicht: f(sr), scroller: sc ? (sc.id || sc.className || sc.tagName).toString().slice(0, 40) : null, zielName: (z.id || z.className || z.tagName).toString().slice(0, 40) };
  };
  async function zeige(ziel, pad) {
    _ziel = ziel || null; _pad = pad == null ? 10 : pad;
    /* v2219d · Szenenwechsel: die alte Zeile geht mit dem alten Ziel (sie stand
       gemessen 2-3 s über dem nächsten Reiter) */
    if (!_ziel) { kegel(null); zeileWeg(); return; }
    var z = zielEl();
    /* nur scrollen, wenn das Ziel nicht frei sichtbar ist - sonst schiebt es den
       Umschalter oben aus dem Bild; unten liegt die Zeile (rund 160 px) */
    _nachScroll = 0; _letzterScroll = 0;
    if (z && (!frei(rect(z)) || !sichtRect(z) || sichtRect(z).height < Math.min(rect(z).height, innerHeight) - 6)) { _letzterScroll = Date.now(); holen(z, true); }   /* v2374b */
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
        /* v2370 · die Zahlen kamen hier als Text ins Drehbuch - jetzt aus der angezeigten Analyse gelesen (Regel 1) */
        var kiT = qcText('ai-card') || '', kiZiel = /Kaufpreis von ([\d.]+ ?€)/.exec(qcText('ai-negotiate-v') || kiT), kiUnter = /([\d.]+ ?€)[^.\n]{0,20}unter de[rm] (?:geschätzten Marktwert|DealPilot-Marktbewertung)/.exec(kiT);
        s.zeile('Die Pilot-Analyse', 'Der Pilot bleibt ehrlich: für deine <b>C-Lage</b> zu wenig Rendite' + (kiZiel ? ' — dein Ziel gäbe es erst bei <b>' + kiZiel[1] + '</b>' : '') + '.');
        await warte(6500);
        await zeige(function () { return qcEl('ai-card'); }, 6);
        s.zeile('Die Pilot-Analyse', 'Und er sieht mehr: ' + (kiUnter ? '<b>' + kiUnter[1] + ' unter Marktwert</b>' : 'einen Preis <b>unter Marktwert</b>') + ' — als Renditeobjekt nein, als <b>Substanzkauf</b> interessant.');
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
    /* v2374b · der SICHTBARE Teil beider Ziele (sichtRect), sonst ragt die Hülle aus dem Chat */
    var ra = sichtRect(a) || rect(a), rb = sichtRect(b) || rect(b), h = el('dpm-huelle');
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
  var RH_BUSTER = 'v2481q';   /* v2481q: zielbild26-Analyse neu mit Kaufdatum und Ankauf-Stand; v2481n: zielbild26 nach v2540-v2543 mit Marktpreisen; v2481j: zielbild26 nach v2520; v2481g: Modul 26 Mieterhoehung und Zielbild (zielbild26); v2395vr3: Portfolio-Analyse neu (Modul 21); v2395: BMF-Mitschnitt Ravensberger Weg mit Nebenkosten neu; v2374: Modul 25 MFH Fürth (gefuehrt25, gefuehrt25geo); v2372: Modul-25-Auslese; v2353 Portfolio-Pilot neu; v2305: Telegram-Mitschnitt (Modul 22); v2303 Portfolio-Analyse; v2278 Modul-16-Sachwert */
  /* v2257 · dazu BMF (Modul 10b, abgespielt), die RND-Gutachten-Anfrage und
     alles, was eine Anfrage an Dritte oder eine Zahlung ausloest */
  var RH_SPERRE = /\/marktbericht\/reports|\/ai\/|\/avm\/|immometrica|\/voice|\/transcri|\/passes|\/bmf\/|\/rnd-request|\/deal-action\/submit|\/checkout|gutachten|\/network-cards\/(einreichen|partner-interest)|\/unterlagen|\/portfolio-spiegel|\/objects\/track-usage|\/marktbericht\/potenzial/i;
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
    /* v3015 · Webinar komplett-mfh: eigener Mitschnitt (Bericht 371), vor allen anderen */
    var kma = kmAntwort(u, m, opt); if (kma) return kma;
    var body = null; try { body = opt && typeof opt.body === 'string' ? JSON.parse(opt.body) : null; } catch (e) {}
    if (/\/ai\/transcribe-chunk/.test(u)) { _rh.spr = Math.min(_rh.sprMax || D.sprache.text.length, (_rh.spr || 0) + 1); return rhJ({ text: D.sprache.text.slice(0, _rh.spr).join(' ') }); }
    if (/\/ai\/voice-quickmatch/.test(u)) { var ids = []; for (var i = 0; i < (_rh.spr || 0); i++) ids = ids.concat(D.sprache.ids[i] || []); return rhJ({ ids: ids }); }
    if (/\/ai\/extract-voice/.test(u)) return rhJ({ transcript: D.sprache.text.join(' '), fields: D.sprache.felder, unsicher: D.sprache.unsicher, kosten: null });
    /* v2371 · Modul 25: jede getippte Antwort der geführten Eingabe, einmal echt ausgelesen
       (D.gefuehrt25, Schlüssel = Antworttext). Im Mitschnitt-Lauf (?mitschnitt=25) geht der
       Abruf echt hinaus und wird in DPM_REIHE.mitschnitt notiert - siehe rhSpion. */
    /* v2374 · im Mitschnitt-Lauf geht nur hinaus, was noch keinen Eintrag hat (geänderte Antworttexte) */
    if (/\/ai\/extract-text/.test(u) && body && _rh.mitschnitt && !(D.gefuehrt25 && D.gefuehrt25[String(body.text || '').trim()])) return null;
    if (/\/ai\/extract-text/.test(u) && body && D.gefuehrt25 && _rh.gef25 && D.gefuehrt25[String(body.text || '').trim()]) {
      var g25 = String(body.text || '').trim();
      return rhJ({ transcript: g25, fields: JSON.parse(JSON.stringify(D.gefuehrt25[g25])), unsicher: [], kosten: null, modus: 'antwort' });
    }
    if (/\/ai\/extract-text/.test(u) && body && String(body.text || '').trim() === D.gefuehrt.text) return rhJ({ transcript: D.gefuehrt.text, fields: D.gefuehrt.felder, unsicher: [], kosten: null, modus: 'antwort' });
    if (m === 'POST' && /\/marktbericht\/reports\/generate-stream/.test(u)) return rhStrom(body && body.wert_stufe >= 2 ? Number(body.wert_stufe) : 1);
    if (m === 'GET' && /\/marktbericht\/objects\/history\?/.test(u)) {
      var ref = decodeURIComponent((u.match(/[?&]ref=([^&]+)/) || [])[1] || '');
      if (ref && DPM_REIHE.angelegt.indexOf(ref) >= 0) return rhJ({ history: rhVerlauf() });
    }
    if (/\/api\/v1\/immometrica\//.test(u)) { var a = _imoAntwort(u); if (a) return rhJ(a); }
    /* v2300 · Modul 24: die Geokodierung vor dem BORIS-Abruf ist ein externer, bezahlter Dienst -
       gespielt mit den Koordinaten aus dem gespeicherten Bericht desselben Objekts (_rh.geo).
       Der BORIS-Abruf selbst (Open Data, GET) läuft echt. */
    if (m === 'GET' && _rh.geo && /\/marktbericht\/geocode\?/.test(u)) return rhJ(JSON.parse(JSON.stringify(_rh.geo)));
    /* v2388 · GEMESSEN im Prüflauf Modul 25 (19.10.2026): nach „Übernehmen" holt das Adressfeld
       (adress-autocomplete.js _koordHolen) zweimal /marktbericht/geocode/autocomplete - Geoapify,
       ein bezahlter Dienst, je Durchgang. Im Lauf wird nichts vorgeschlagen: leere Liste. */
    if (m === 'GET' && /\/marktbericht\/geocode\/autocomplete/.test(u)) return rhJ({ results: [] });
    /* v2300 · Modul 21: die Portfolio-Analyse ist EIN echter Abruf (Mitschnitt D.portfolioPilot);
       ihre Ablage in den Einstellungen wird im Lauf beantwortet, nicht geschrieben. */
    if (m === 'POST' && D.portfolioPilot && /\/ai\/copilot$/.test(u.split('?')[0]) && body && /GESAMTES Portfolio/.test(String(body.message || ''))) return rhJ(JSON.parse(JSON.stringify(D.portfolioPilot)));
    if (m === 'PUT' && /\/user-settings\/portfolio_analyse/.test(u)) return rhJ({ ok: true, vorfuehrung: true });
    /* v2273 · Belege einlesen (Modul 15): die Auslese der beiden Beispielbelege, einmal echt */
    if (m === 'POST' && D.belege && /\/ai\/extract-beleg/.test(u)) return rhJ(JSON.parse(JSON.stringify(D.belege)));
    /* v2257 · BMF-Kaufpreisaufteilung (Modul 10b): einmal echt gerechnet, hier
       abgespielt. Mit Datei (PDF/XLSX) wird nichts gespielt - das sperrt RH_SPERRE. */
    /* v2273 · nur im BMF-Modul: der stille Vorlauf (bmf-modal.js, 6 s nach dem Laden) bekam in Modul 15 die Ravensberger-Antwort - jetzt gesperrt */
    if (m === 'POST' && D.bmf && _aktiv === DREHBUECHER['reihe-bmf'] && /\/bmf\/(aufteilung|pipeline)/.test(u) && !(body && (body.include_pdf || body.include_file))) {
      return rhJ(JSON.parse(JSON.stringify(/pipeline/.test(u) ? D.bmf.pipeline : D.bmf.aufteilung)));
    }
    /* v2480 · Modul 26: Ertragswert je Stufe (Schlüssel = Auftrag ohne Objektkennung) und die
       Pilot-Analyse - einmal echt (?mitschnitt=26), hier gespielt. Fehlt ein Schlüssel, sperrt RH_SPERRE. */
    if (m === 'POST' && D.zielbild26 && !_rh.mitschnitt26 && _aktiv === DREHBUECHER['reihe-zielbild']) {
      var p26 = u.split('?')[0];
      if (/\/marktbericht\/potenzial$/.test(p26)) { var k26 = r26Schluessel(body), a26 = k26 && D.zielbild26.potenzial && D.zielbild26.potenzial[k26]; if (a26) return rhJ(JSON.parse(JSON.stringify(a26))); }
      /* v2481p · Mitschnitt-Lauf ?mitschnitt=26ki: NUR die Pilot-Analyse geht echt hinaus (Ertragswerte und Marktpreise gespielt) */
      if (/\/ai\/analyze$/.test(p26) && D.zielbild26.analyse && !_rh.mitschnitt26ki) return rhJ(JSON.parse(JSON.stringify(D.zielbild26.analyse)));
      /* v2481m · Marktpreise (v2542): der Abruf bucht 1 × erweiterte Marktpreisindikation - nur gespielt */
      if (/\/marktbericht\/potenzial\/markt$/.test(p26) && D.zielbild26.markt && D.zielbild26.markt.post) { _rh.markt26 = true; return rhJ(JSON.parse(JSON.stringify(D.zielbild26.markt.post))); }
    }
    /* v2481m · ... und der Verlauf dazu: vor dem gespielten Abruf leer, danach der Mitschnitt
       (das Objekt ist je Lauf neu, ein echter GET fände nie etwas) */
    if (m === 'GET' && D.zielbild26 && !_rh.mitschnitt26 && _aktiv === DREHBUECHER['reihe-zielbild'] && /\/marktbericht\/potenzial\/markt\/verlauf/.test(u)) {
      return rhJ(_rh.markt26 && D.zielbild26.markt && D.zielbild26.markt.verlauf ? JSON.parse(JSON.stringify(D.zielbild26.markt.verlauf)) : { abrufe: [], einordnung: null });
    }
    return null;
  }
  function rhSpion() {
    if (window.__dpmRh) return;
    var echt = window.fetch; window.__dpmRh = echt;
    window.fetch = function (url, opt) {
      var u = typeof url === 'string' ? url : (url && url.url) || '', m = String((opt && opt.method) || 'GET').toUpperCase();
      var kurz = u.replace(location.origin, ''), pfad = kurz.split('?')[0];
      /* v2481p · Modul 27: die zwei gespeicherten Objekte werden nur gelesen - jeder Schreibweg
         an Objekt und Steuer wird beantwortet (200), nicht geschrieben (r27Gesperrt) */
      if (r27Gesperrt(m, pfad)) {
        try { DPM_REIHE.gesperrt.push(m + ' ' + pfad); } catch (e) {}
        return Promise.resolve(new Response(JSON.stringify(m === 'PUT' && /\/objects\//.test(pfad) ? { id: window._currentObjKey, ok: true, vorfuehrung: true } : { ok: true, vorfuehrung: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (lauf && _rh) {
        if (m !== 'GET') DPM_REIHE.abrufe.push(m + ' ' + pfad);
        var a = rhAntwort(kurz, m, opt);
        if (a) { DPM_REIHE.gespielt.push(m + ' ' + pfad); return Promise.resolve(a); }
        /* v2371 · Mitschnitt-Lauf Modul 25: NUR die Auslese der Antworten geht echt hinaus */
        if (_rh.mitschnitt && m === 'POST' && /\/ai\/extract-text$/.test(pfad)) {
          var mt = ''; try { mt = String(JSON.parse(opt.body).text || '').trim(); } catch (e) {}
          var pm = echt.apply(this, arguments);
          pm.then(function (r) { return r.clone().json(); }).then(function (j) {
            (DPM_REIHE.mitschnitt = DPM_REIHE.mitschnitt || {})[mt] = (j && j.fields) || {};
          }).catch(function () {});
          return pm;
        }
        /* v2373a · ... und die Geokodierung vor dem Bodenrichtwert (Fürth): einmal echt, dann als
           DPM_REIHE_DATEN.gefuehrt25geo gespielt (_rh.geo, wie Modul 24). BORIS selbst ist ein freies GET. */
        /* v2480 · Mitschnitt-Lauf Modul 26: Ertragswert je Stufe und Pilot-Analyse gehen echt hinaus */
        if ((_rh.mitschnitt26 && m === 'POST' && /\/marktbericht\/potenzial$|\/ai\/analyze$/.test(pfad)) || (_rh.mitschnitt26ki && m === 'POST' && /\/ai\/analyze$/.test(pfad) && !(DPM_REIHE.mitschnitt26 && DPM_REIHE.mitschnitt26.analyse))) {
          var mk = /potenzial$/.test(pfad) ? r26Schluessel(opt && opt.body) : null;
          var p26 = echt.apply(this, arguments);
          p26.then(function (r) { return r.clone().json(); }).then(function (j) {
            var M = DPM_REIHE.mitschnitt26 = DPM_REIHE.mitschnitt26 || { potenzial: {}, analyse: null };
            if (mk) M.potenzial[mk] = j; else M.analyse = j;
          }).catch(function () {});
          return p26;
        }
        /* v2481m · Mitschnitt-Lauf: der EINE Marktpreis-Abruf (bucht 1 × erweiterte MPI) und
           der Verlauf danach - nur EIN POST je Lauf, ein zweiter wird gesperrt */
        if (_rh.mitschnitt26 && ((m === 'POST' && /\/marktbericht\/potenzial\/markt$/.test(pfad) && !(DPM_REIHE.mitschnitt26 && DPM_REIHE.mitschnitt26.markt && DPM_REIHE.mitschnitt26.markt.post)) || (m === 'GET' && /\/marktbericht\/potenzial\/markt\/verlauf$/.test(pfad)))) {
          var istPost = m === 'POST', pm26 = echt.apply(this, arguments);
          pm26.then(function (r) { return r.clone().json(); }).then(function (j) {
            var M = DPM_REIHE.mitschnitt26 = DPM_REIHE.mitschnitt26 || { potenzial: {}, analyse: null };
            M.markt = M.markt || { post: null, verlauf: null };
            if (istPost) M.markt.post = j; else if (M.markt.post) M.markt.verlauf = j;
          }).catch(function () {});
          return pm26;
        }
        if (_rh.mitschnitt && m === 'GET' && /\/marktbericht\/geocode$/.test(pfad)) {
          var pg = echt.apply(this, arguments);
          pg.then(function (r) { return r.clone().json(); }).then(function (j) { DPM_REIHE.mitschnittGeo = j; }).catch(function () {});
          return pg;
        }
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
        /* v2371 · Modul 25 tippt: ein stummer Strom (Freisprechen ist dort aus, der Ton haette sonst eine Sprechpause ausgeloest) */
        var osc = ac.createOscillator(), g = ac.createGain(); g.gain.value = (_rh && _rh.stumm) ? 0 : 0.02; osc.connect(g); g.connect(dst); osc.start();
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
      async function (s) {   /* 3 · Pilot-Mietpreis-Analyse (v2481h: der Zensus-Kasten ist seit v2500 raus) */
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#ki-miete-box'); }, 8);
        /* NICHT geklickt: die Recherche ist ein KI-Abruf (je Durchgang Geld) - ein Mitschnitt dafür fehlt noch */
        await b2oZeile(s, 'Pilot-Mietpreis-Analyse', 'Ganz oben im Reiter: DealPilot recherchiert die <b>marktübliche Miete</b> für Adresse und Fläche, mit Vergleichswerten — und schätzt das <b>Mietausfall-Risiko</b>.');
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
      async function (s) {   /* 5 · Mietausfall-Risiko (v2481h: ohne Zensus-Kasten) */
        await zeige(r6Gruppe('ds2_mietausfall'), 10);
        await b2oZeile(s, 'Mietausfall-Risiko', 'Die Stufe übernimmst du per Klick aus der Pilot-Mietpreis-Analyse — oder wählst sie selbst' + (wert('ds2_mietausfall') ? ': hier <b>' + r6Optionstext('ds2_mietausfall') + '</b>' : ' — hier noch offen') + '.');
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
    /* v2967 · opt.ankauf: der Ankauf-Stand der KOPIE wird nachgezogen - das echte Objekt behält
       seinen. Seit v2968 von keinem Drehbuch benutzt (Modul 14 nimmt den Stand des echten Objekts). */
    if (opt.ankauf && d._ankauf && d._ankauf.daten) {
      Object.keys(opt.ankauf.daten).forEach(function (k) { d._ankauf.daten[k] = opt.ankauf.daten[k]; });
      delete d._ankauf.daten._ds2_categories;   /* rechnet die App beim Laden des Soll neu */
      d._ankauf.kurz = JSON.parse(JSON.stringify(opt.ankauf.kurz));
      if (opt.ankauf.stichtag) d._ankauf.stichtag = opt.ankauf.stichtag;
    }
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
        /* v2395 · „(in diesem Objekt nicht erfasst)" stand fest im Text - das Demo-Objekt trägt seit dem 16.10. Nebenkosten (170.748 €) */
        var nkNull = !nk || /^0 €$/.test(nk[1]);
        await b2oZeile(s, 'Schritt 1 · Anschaffungskosten', 'Aus dem Reiter Investition: Kaufpreis ' + (kp ? kp[1] : '–') + ', Nebenkosten ' + (nk ? nk[1] : '–') + (nkNull ? ' (in diesem Objekt nicht erfasst).' : ' — Grunderwerbsteuer, Notar, Grundbuch, Makler. Sie zählen anteilig zum Gebäude: für die AfA und die 15-%-Grenze.'));
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
        await b2oZeile(s, 'Die Absprünge', '<b>Restnutzungsdauer berechnen</b> öffnet den Rechner aus Modul 10c. Dazu PDF der Aufteilung, die ausgefüllte BMF-Arbeitshilfe und das Original als Excel.');
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
  /* v2967 · Ankauf-Stand der Parkstr. 9 zum Kaufpreis 395.000 € (Marcel 26.10.2026: Module 14/18
     auf den heutigen Demo-Stand). Der Stand am echten Objekt (DEMO-BO6) ist zum 23.12.2024 mit
     Kaufpreis 780.000 € / Darlehen 640.000 € eingefroren - die Kaufpreise wurden am 25.10. nur im
     Ist angeglichen. Gegen ihn zeigte die Soll/Ist-Tafel „Kaufpreis 780.000 -> 395.000 €“.
     Erzeugt EINMAL von der App selbst (26.10.2026): Kopie mit dem eingefrorenen Datensatz, darin
     nur Kaufpreis, Darlehen, EK, Nebenkosten-Sätze und Grenzsteuersatz vom heutigen Objekt;
     geladen, gerechnet, DealPilotAnkauf.festschreiben('2024-12-23'), Kopie gelöscht. Mieten,
     Leerstand und Modernisierung bleiben der Stand beim Kauf. Kein Abruf mit Kosten.
     v2968 · NICHT MEHR BENUTZT: seit 26.10.2026 trägt das echte Objekt selbst diesen Ankauf-Stand
     (23.12.2024, KP 395.000 €, Darlehen 324.000 €, Miete 2.321 €, DSCR 1,79, Score 65) und dazu
     eine eigene Pilot-Analyse im Ankauf-Stand. Die Kopie übernimmt beides unverändert (gemessen:
     _ankauf.kurz der DB = R14_ANKAUF bis auf CF n. St. 3.626 statt 3.599). Kein anderes Drehbuch
     nutzt R14_ANKAUF; der Weg opt.ankauf in r6KopieStart bleibt für einen späteren Bedarf. */
  var R14_ANKAUF = {"stichtag":"2024-12-23","kurz":{"kp":395000,"nkm":2321,"_kpis_miete_j":28932,"_kpis_bmy":7.324556962025317,"_kpis_nmy":3.624199873292843,"_kpis_dscr":1.785925925925926,"_kpis_cf_ns":3599,"_kpis_ltv":66.52977412731006,"_ds2_score":65,"_steuerwirkung":-1453,"_nkm_qm":5.44,"_leer_einheiten":1,"_kpis_bwk_nul_y":7680,"eigen_r":0,"d1z":4,"_kpis_cf_vs":5052,"geb_ant":54.31,"afa_satz":2},"daten":{"d1":"324000","ek":"262392","kp":"395000","ji_p":"1.5","gba_p":"0.5","grenz":"47.00","gest_p":"6.5","notar_p":"1.7","makler_p":"3.57","_kpis_bmy":7.324556962025317,"_kpis_ltv":66.52977412731006,"_ds2_score":65,"_kpis_dscr":1.785925925925926,"_kpis_cf_ns":3599,"_kpis_cf_vs":5052,"ds2_marktfaktor":"8,2","_dealpilot_score":87,"_kpis_miete_j":28932,"_kpis_nmy":3.624199873292843}};
  var _r14 = { merker: undefined };   /* v2967 · Merker Einfach|Genau des Unterreiters (dp_pa_si_ansicht) */
  function r14Seg(re) { return [].filter.call(document.querySelectorAll('.ank-wahl .ank-seg'), function (b) { return re.test(b.textContent); })[0] || null; }
  DREHBUECHER['reihe-bestand'] = {
    titel: 'Vom Ankauf in den Bestand', unterzeile: 'Gewonnen, eingefroren, verglichen', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () {
      try { var i = r14Seg(/Ist/); if (i && window.DealPilotAnkaufAnsicht && DealPilotAnkaufAnsicht.aktiv()) i.click(); } catch (e) {}
      try { if (_r14.merker !== undefined) { if (_r14.merker === null) localStorage.removeItem('dp_pa_si_ansicht'); else localStorage.setItem('dp_pa_si_ansicht', _r14.merker); } } catch (e) {}
      _r14.merker = undefined;
      rhAufraeumen();
    },
    szenen: [
      async function (s) {   /* 1 · das Objekt */
        await r6KopieStart(R11_PARK, { behalte: true });   /* v2968: Ankauf-Stand kommt vom echten Objekt */
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
        /* v2967 · GEMESSEN 26.10.: der Unterreiter heißt seit v2430 „Ankauf · Bestand · Zielbild“ und
           hat seit v2951 Einfach | Genau - mit /Soll\/Ist/ fand das Drehbuch ihn nicht, Szenen 6-9
           liefen ohne Kegel auf dem Briefing. Genau zeigt die Tafel; der Merker kommt beim Aufräumen zurück. */
        await r11PaTab(/Soll\/Ist|Ankauf · Bestand/);
        try { if (_r14.merker === undefined) _r14.merker = localStorage.getItem('dp_pa_si_ansicht'); } catch (e) {}
        var gk = r11Panel() && r11Panel().querySelector('.dp-si-um [data-dp-si-knopf="genau"]');
        if (gk && gk.getAttribute('aria-pressed') !== 'true') { gk.click(); await warte(700); }
        var ah = function () { var x = r11Panel(); return x && x.querySelector('.abw-tafel-host'); };
        var sx = scroller(ah()); if (sx && ah()) { sx.scrollTop += rect(ah()).top - 120; await warte(500); }
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
        if (c) teile.push('Cashflow nach Steuer im Jahr <b>' + eur(c.ankauf) + ' → ' + eur(c.bestand) + '</b>');
        if (sc) teile.push('DealScore <b>' + de(sc.ankauf) + ' → ' + de(sc.bestand) + '</b>');
        await b2oZeile(s, 'Was sich bewegt hat', (teile.join(' · ') || '–') + '.');
      },
      async function (s) {   /* 8 · die Tafel */
        await zeige(function () { return q('#ai-content .abw-tafel'); }, 6);
        var t = r6Inner(q('#ai-content .abw-tafel')), nk = /Nettokaltmiete\s+([\d.]+ €)\s+([\d.]+ €)/.exec(t), mq = /Miete je m²\s+([\d,]+ €\/m²)\s+([\d,]+ €\/m²)/.exec(t);
        await b2oZeile(s, 'Kennzahl für Kennzahl', 'Ertrag, Kosten, Finanzierung, Steuer, Ergebnis — z. B. Nettokaltmiete <b>' + (nk ? nk[1] + ' → ' + nk[2] : '–') + '</b>' + (mq ? ', je m² ' + mq[1] + ' → ' + mq[2] : '') + '. Was nicht vorlag, wird nicht geschätzt.');
      },
      async function (s) {   /* 9 · Entwicklung in der Pilot-Analyse */
        var k = function () { var x = rhIm('#ai-content', /^PILOT-ANALYSE: ANKAUF GEGEN HEUTE$/); return x && x.closest('.dp-pa-card'); };
        await zeige(k, 8);
        /* v2968 · seit 26.10.2026 trägt die Parkstr. 9 ZWEI Analysen (Ankauf-Stand und heute, beide
           mit KP 395.000 €). Empfehlung und empfohlener Kaufpreis werden aus der Tabelle der Karte
           gelesen (Zeilen „Empfehlung“, „Empfohlener Kaufpreis“: td Wort | Beim Ankauf | Heute).
           Zeigt die Karte noch dieselbe Analyse in beiden Spalten, bleibt der alte Satz. */
        var t = r6Inner(k()), gleich = /beide Spalten zeigen dieselbe/i.test(t);
        function pz(re) { var c = k(), tr = c ? [].filter.call(c.querySelectorAll('tr'), function (r) { var w = r.querySelector('td.abw-wort'); return w && re.test(r6Text(w)); })[0] : null, td = tr ? tr.querySelectorAll('td') : []; return td.length > 2 ? [r6Text(td[1]), r6Text(td[2])] : null; }
        var em = pz(/^Empfehlung$/), kp = pz(/^Empfohlener Kaufpreis$/);
        function sp(i) { return '<b>' + em[i] + '</b>' + (kp && kp[i] && kp[i] !== '–' ? ', empfohlener Kaufpreis <b>' + kp[i] + '</b>' : ''); }
        if (gleich || !em) await b2oZeile(s, 'Die Pilot-Analyse: damals und heute', 'Zwei Spalten: was der Pilot beim Ankauf sagte und was er heute sagt.' + (gleich ? ' Seit dem Festschreiben kein neuer Abruf — DealPilot sagt das dazu.' : '') + ' Ein neuer Abruf füllt die Spalte „Heute“.', 600);
        else await b2oZeile(s, 'Die Pilot-Analyse: damals und heute', 'Beim Ankauf: ' + sp(0) + '. Heute: ' + sp(1) + '. Beide Analysen bleiben nebeneinander stehen.', 600);
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
  function r15DetFest(re) { var t = r15Det(re), f = t && t.querySelector('.ytf-readonly'); return f ? r6Text(f) : null; }   /* v2395 · übernommene Werte ohne Eingabefeld */
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
        /* v2395 · die Spalte heißt „Einnahmen V+V", trägt aber nur die KALTMIETE (tax.js _renderQuickForm:
           einnahmen_km; die umlagefähigen NK fehlen dort auf beiden Seiten). Der Detail-Modus nennt als
           „Einnahmen V+V" Kaltmiete + NK - im Video standen so 39.652 und 41.396 € bei gleichem Ergebnis. */
        await b2oZeile(s, 'Das Jahr ' + R15_JAHR, 'Kaltmiete <b>' + (c[1] || '–') + '</b>, Schuldzinsen ' + (c[2] || '–') + ', AfA ' + (c[3] || '–') + ' — Ergebnis <b>' + (c[6] || '–') + '</b>, Steuer-Effekt <b>' + (c[7] || '–') + '</b>.');
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
        /* v2395 · Einnahmen im Detail: Kaltmiete + umlagefähige NK (durchlaufender Posten, auch als Kosten) */
        var km = function () { return r15Det(/^Kaltmiete$/); }, nkr = function () { return r15Det(/^Nebenkosten \(umlagefähig\)$/); };
        var kmW = r15DetFest(/^Kaltmiete$/), nkW = r15DetFest(/^Nebenkosten \(umlagefähig\)$/), einW = r15Summe(/Einnahmen V\+V:\s*([^\n]+)/);
        if (km() && kmW && nkW && einW) {
          r15Oben(km()); await warte(400);
          await zeigeGruppe(km, nkr, 6);
          await b2oZeile(s, 'Die Einnahmen', 'Einnahmen V+V <b>' + einW + '</b>: Kaltmiete ' + kmW + ' plus umlagefähige Nebenkosten ' + nkW + ' — die gehen als Kosten wieder ab. Die Jahreszeile zeigt nur die Kaltmiete.');
        }
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
          /* v2279 · Modul 16: gespeicherter Bericht 216 trägt noch den Sachwert vor v2277 (EFH-Notweg, RND 21).
             Der Mitschnitt ist mit dem v2277-Kern neu gerechnet (v2278) - das Fenster zeigt dieselbe Rechnung
             wie die App: cross_check aus dem Mitschnitt, alles andere aus der Datenbank. Kein Abruf, kein Schreiben. */
          var rid = /\/reports\/one$/.test(p) ? (String(typeof u === 'string' ? u : (u && u.url) || '').match(/[?&]id=(\d+)/) || [])[1] : null, D16 = window.DPM_REIHE_DATEN && DPM_REIHE_DATEN.westerfeld;
          if (rid && D16 && D16.bericht3 && Number(rid) === Number(D16.bericht3) && D16.mb && D16.mb[3] && D16.mb[3].cross_check) {
            return echt.apply(this, arguments).then(function (r) { return r.json().then(function (j) {
              var cc = JSON.parse(JSON.stringify(D16.mb[3].cross_check)), n = 0;
              (function ers(o, t) { if (!o || typeof o !== 'object' || t > 3) return; if (o.cross_check) { o.cross_check = cc; n++; } Object.keys(o).forEach(function (k) { if (k !== 'cross_check') ers(o[k], t + 1); }); })(j, 0);
              DPM_REIHE.gespielt.push('MB GET /reports/one ' + rid + ' cross_check×' + n);
              return new Response(JSON.stringify(j), { status: r.status, headers: { 'Content-Type': 'application/json' } });
            }); });
          }
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
  async function r19Seite(blob, n, oben) {   /* v2276e · oben = FitH,top. GEMESSEN (Testseite mit Marken je 40 pt): der Chrome-Viewer liest top in px bei 100 % VON OBEN (1 pt = 4/3 px), nicht in PDF-y von unten. Werte = Abstand von oben in pt × 4/3, an den Textpositionen der echten Bankfassung */
    var u = blob.__url || (blob.__url = URL.createObjectURL(blob)); if (_r19.url.indexOf(u) < 0) _r19.url.push(u);
    var o = el('dpm-pdf');
    o.style.cssText = 'position:fixed;left:4%;right:4%;top:3%;bottom:4%;z-index:100002;background:#2b2b2b;border:2px solid ' + G + ';border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)';
    /* v2942 · die neue Seite lädt UNSICHTBAR über der alten und wird erst nach der Ladezeit
       eingeblendet - direkt vor dem nächsten Kapitelband. Gemessen in Aufnahme v2941b: die
       Seite sprang sonst ~4 s vor dem Band, weil warte(4000) NACH dem Wechsel lief. */
    var alt = [].slice.call(o.querySelectorAll('iframe')), f = document.createElement('iframe');
    f.title = 'PDF'; f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;opacity:' + (alt.length ? 0 : 1);
    f.src = u + '#page=' + n + '&toolbar=0&navpanes=0&view=FitH' + (oben ? ',' + oben : '');
    o.appendChild(f);
    await warte(4000);
    f.style.opacity = 1; alt.forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
  }
  /* v2940 · SEITE NACH UEBERSCHRIFT, NICHT NACH NUMMER. Gemessen bei der Neuaufnahme
     23.10.2026: die Bankfassung hat inzwischen 11 statt 8 Seiten - Szene 8 zeigte die
     Exit-Seite unter „Belastungsprobe", Szene 9 „Wertpotenzial" unter „Annahmen".
     Die Textbausteine des PDFs (_r19.tok) stehen in Seitenreihenfolge; jede Seite endet
     mit ihrer Fusszeile „Seite n von m". Gesucht wird die erste Seite, auf der ein
     Baustein auf das Muster passt; ohne Treffer gilt die alte Nummer. */
  function r19SeiteVon(muster, ersatz) {
    var T = _r19.tok || [], seite = 1;
    for (var i = 0; i < T.length; i++) {
      var m = /Seite (\d+) von \d+/.exec(T[i]);
      if (m) { seite = Number(m[1]) + 1; continue; }
      if (muster.test(T[i])) return seite;
    }
    return ersatz;
  }
  /* v2940b · und die STELLE auf der Seite. Gemessen in der zweiten Aufnahme: die Kopie hat
     11 Seiten, VERMOEGENSAUFBAU und ANNAHMEN stehen weiter unten - gezeigt wurde nur der
     Seitenkopf. jsPDF schreibt „x y Td (Text) Tj", y von unten, A4 = 841,89 pt. r19Seite()
     will den Abstand von oben in pt x 4/3 (v2276e); 24 pt Luft ueber der Ueberschrift. */
  function r19Stelle(muster, ersatzSeite) {
    var tx = _r19.roh || '', re = /([\d.]+) ([\d.]+) Td\s*\(([^()]{1,80})\) Tj/g, m, seite = 1;
    while ((m = re.exec(tx))) {
      var f = /Seite (\d+) von \d+/.exec(m[3]);
      if (f) { seite = Number(f[1]) + 1; continue; }
      if (muster.test(m[3])) {
        var vonOben = 841.89 - Number(m[2]);
        return { seite: seite, oben: vonOben > 120 ? Math.round((vonOben - 24) * 4 / 3) : 0 };
      }
    }
    return { seite: r19SeiteVon(muster, ersatzSeite), oben: 0 };
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
        await b2oZeile(s, W.length === 4 ? 'Vier Fassungen' : W.length + ' Fassungen', W.map(function (w) { return '<b>' + w.titel + '</b> (' + w.fuer.split(' · ')[0] + ')'; }).join(', ') + '. Die Kurzfassung bündelt das Wesentliche, die übrigen tragen den vollen Inhalt.');
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
        try { var tx = await bank.text(), mm = /Seite 1 von (\d+)/.exec(tx); _r19.roh = tx; _r19.seiten = mm ? Number(mm[1]) : null; _r19.tok = (tx.match(/\(([^()]{1,80})\) Tj/g) || []).map(function (x) { return x.slice(1, -4); }); DPM_REIHE.pdf19 = { bytes: bank.size, seiten: _r19.seiten, namen: (tx.match(RH_PDF_NAMEN) || []).slice(0, 8) }; } catch (e) {}
        zeige(null); kegelHoch(true);
        await r19Seite(bank, 1);
        await b2oZeile(s, 'Oben: deine Marke', 'Kopf mit Logo — mit Whitelabel steht hier deins, nicht unseres. Darunter Objekt, Foto und Stand.');
        await r19Seite(bank, 1, 627);   /* ab 470 pt: INVESTITION 489 … Darlehen 678 pt von oben */
        var K = r19K();
        await b2oZeile(s, 'Seite 1 · Objekt und Finanzierung', 'Kaufpreis <b>' + eur(K.kp) + '</b> mit jeder Nebenkostenzeile, Gesamtinvestition ' + eur(K.gi) + '. Eigenkapital ' + eur(K.ek) + ', Darlehen <b>' + eur(K.d1) + '</b> zu ' + r19Pz(K.d1z_pct) + '.');
      },
      async function (s) {   /* 5 · Kennzahlen */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 2, 190);   /* ab 142 pt: Restschuld 159, KENNZAHLEN 179 */
        var K = r19K();
        await b2oZeile(s, 'Seite 2 · Kennzahlen', 'Bruttorendite <b>' + r19Pz(K.bmy) + '</b>, Nettorendite ' + r19Pz(K.nmy) + ', DSCR <b>' + de(K.dscr, 2) + '</b>, Beleihung ' + r19Pz(K.ltv, 1) + ', Cashflow ' + eur(K.cf_m) + ' im Monat.');
        await r19Seite(_r19.bank, 2, 593);   /* ab 445 pt: WARMMIETE 462 … Cashflow/Monat 667 */
        await b2oZeile(s, 'Von der Warmmiete zum Cashflow', 'Darunter die Rechnung Zeile für Zeile: Miete, Bewirtschaftung, Zinsen, Tilgung, Steuer — am Ende <b>' + eur(K.cf_ns) + '</b> nach Steuern im Jahr.');
      },
      async function (s) {   /* 6 · drei Phasen */
        if (!_r19.bank) return;
        await r19Seite(_r19.bank, 3, 513);   /* ab 385 pt: CASHFLOW JE PHASE 403 … 586 */
        var K = r19K();
        await b2oZeile(s, 'Heute, Zinsbindung, Anschluss', 'Cashflow nach Steuern im Jahr: heute <b>' + eur(K.cf_ns) + '</b>, am Ende der Zinsbindung ' + eur(K.cf_ns_ezb) + ', in der Anschlussfinanzierung ' + eur(K.cf_ns_an) + '.');
      },
      async function (s) {   /* 7 · Vermögen und Exit */
        if (!_r19.bank) return;
        var _st7 = r19Stelle(/^VERM.{1,3}GENSAUFBAU/, 6); await r19Seite(_r19.bank, _st7.seite, _st7.oben);   /* v2940 */
        var K = r19K();
        /* aus dem PDF gelesen, nicht aus den Kennzahlen: der Exit dort rechnet mit eigener Haltedauer */
        var T = _r19.tok || [], iw = T.indexOf('Angenommene Wertsteigerung p. a.'), ws = iw >= 0 ? T[iw + 1] : null;
        await b2oZeile(s, 'Vermögensaufbau und Exit', 'Wert, Restschuld und Eigenkapital über die Jahre' + (ws ? ', gerechnet mit <b>' + ws + '</b> Wertsteigerung im Jahr' : '') + ' — und was beim Verkauf bliebe. Equity Multiple ' + de(K.em, 1) + '.');
      },
      async function (s) {   /* 8 · Belastungsprobe */
        if (!_r19.bank) return;
        var _st8 = r19Stelle(/^BELASTUNGSPROBE/, 7); await r19Seite(_r19.bank, _st8.seite, _st8.oben);   /* v2940 */
        await b2oZeile(s, 'Die Belastungsprobe', 'Der DSCR, wenn der Zins steigt oder die Miete fällt — genau die Frage, die jede Bank stellt. Die Antwort steht schon drin.');
      },
      async function (s) {   /* 9 · Annahmen */
        if (!_r19.bank) return;
        var _st9 = r19Stelle(/^ANNAHMEN$/, 8); await r19Seite(_r19.bank, _st9.seite, _st9.oben);   /* v2940 */
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
  /* v2967 · Bericht 346 (Stufe 3, 25.10.2026, Kaufpreis 395.000 €, Modernisierung eingetragen,
     RND 32 J.) statt 205 (14.10.2026, Kaufpreis 780.000 €) - gelesen, nicht neu abgerufen */
  var R18_BERICHT = 346;
  var _r18 = { pdf: null, url: null, save: null };
  function r18Zu() {
    var o = q('#dpm-pdf'); if (o && o.parentNode) o.parentNode.removeChild(o);
    if (_r18.url) { try { URL.revokeObjectURL(_r18.url); } catch (e) {} _r18.url = null; }
    if (_r18.save) { try { r16Frame().contentWindow.jspdf.jsPDF.API.save = _r18.save; } catch (e) {} _r18.save = null; }
    _r18.pdf = null;
  }
  function r18Mb(re) { var d = r16Doc(); return d ? rhIm(d.body, re) : null; }
  /* Karte eines Abschnitts im Bericht: der Kasten um die Überschrift */
  /* v2967 · GEMESSEN 26.10. (Bericht 346): „Marktentwicklung“ und „Vergleichspreise“ sind H1 direkt im
     5.400 px hohen .panel, ohne eigene Karte - der Kegel lag auf dem ganzen Bericht, gerollt wurde zum
     Ergebnis oben. Jetzt: Überschrift + der Block darunter (#histChart/#histNote bzw. #chart). */
  function r18Karte(re) { return function () {
    var h = r18Mb(re); if (!h) return null;
    var c = h.closest('.card,.panel,section,.box'), n = h.nextElementSibling;
    if (n && !/^H\d$/.test(n.tagName) && (!c || rect(c).height > 2.5 * (rect(n).height + rect(h).height + 40))) {
      var n2 = n.nextElementSibling;
      return b2oHuelle(h, (n2 && !/^H\d$/.test(n2.tagName) && rect(n2).height < 60) ? n2 : n);
    }
    return c || h.parentElement;
  }; }
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
  async function r18Seite(n, oben) {   /* v2276c/e · oben = FitH,top in px von oben (siehe r19Seite): Deckblatt ab der Adresse */
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
        /* v2967 · GEMESSEN 26.10.: die Beschriftung trägt jetzt eine Erläuterung („Mikrolage · Umfeld-Score …“),
           der Wert eine Zahl („sehr gut · 98 Score“) - mit /^Mikrolage$/ stand im Satz „Mikrolage –“ */
        var lg = function (re) { var v = r18Assess(re); return v ? v.split(' · ')[0] : '–'; };
        await b2oZeile(s, 'Lage', 'Mikrolage <b>' + lg(/^Mikrolage(\s*·|$)/) + '</b>, Makrolage ' + lg(/^Makrolage(\s*·|$)/) + ', Nachfrage ' + lg(/^Nachfrage(\s*·|$)/) + ', Entwicklung ' + lg(/^Entwicklung(\s*·|$)/) + ' — gemessen, nicht geschätzt.');
      },
      async function (s) {   /* 5 · Bodenrichtwert und Zensus */
        var a = r18AssessEl(/^Bodenrichtwert/), b = r18AssessEl(/^Eigentümerquote/);
        await r16Hin(a(), false);
        await zeigeGruppe(a, function () { return b() || a(); }, 8);
        await b2oZeile(s, 'Bodenrichtwert und Zensus', 'Bodenrichtwert <b>' + (r18Assess(/^Bodenrichtwert/) || '–') + '</b> vom Gutachterausschuss. Zensus 2022: Durchschnittsmiete der Gemeinde ' + (r18Assess(/^Ø Nettokaltmiete Gemeinde/) || '–') + ', Leerstand ' + (r18Assess(/^Leerstandsquote Gemeinde/) || '–') + '.');
      },
      async function (s) {   /* 6 · Marktentwicklung und Vergleichspreise */
        var h = r18Karte(/^Marktentwicklung/i);
        await r16Hin(r18Mb(/^Marktentwicklung/i), true);   /* v2967: zur Überschrift, nicht zum ganzen Panel */
        await zeige(h, 8);
        await b2oZeile(s, 'Marktentwicklung', 'Wie sich die Preise je m² hier entwickelt haben — echte Historie, keine Prognose.');
        var c = r18Karte(/^Vergleichspreise/i);
        await r16Hin(r18Mb(/^Vergleichspreise/i), true);
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
        /* v2967 · Bericht 346: die eingetragene Modernisierung trägt die Restnutzungsdauer (32 J. statt 12) -
           sichtbar im Rechenweg des Ertragswerts, Zeile „Barwertfaktor (Zins / Jahre)“ */
        var ewK = function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#wv-box .wv-k'), function (x) { return /^Ertragswert/i.test(r6Text(x.querySelector('.wv-t'))); })[0]; };
        var rw = ewK() && [].filter.call(ewK().querySelectorAll('.wv-mehr'), function (x) { return /Rechenweg/.test(x.textContent) && /▸/.test(x.textContent); })[0];
        if (rw) {
          rw.click(); await warte(700);
          var bwz = function () { var k = ewK(); return k && [].filter.call(k.querySelectorAll('tr'), function (r) { return /Barwertfaktor/.test(r.textContent); })[0]; };
          var bt = bwz() ? /Barwertfaktor\s*\(([\d,]+\s*%)\s*\/\s*(\d+)\s*Jahre\)/.exec(r6Text(bwz())) : null;
          if (bt) {
            await r16Hin(bwz(), false);
            await zeige(bwz, 8);
            await b2oZeile(s, 'Im Rechenweg', 'Der Barwertfaktor aus <b>' + bt[1] + '</b> und <b>' + bt[2] + ' Jahren</b> Restnutzungsdauer — Zeile für Zeile bis zum Ertragswert.');
          }
        }
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
        await r18Seite(1, 573);   /* ab 430 pt: Eckdaten 450, Marktwert 671, Spanne 700 (sichtbar sind im Studio rund 290 pt) */
        await b2oZeile(s, 'Das PDF', 'Deckblatt mit Marktwert und Eckdaten' + (_r18.seiten ? ' — ' + _r18.seiten + ' Seiten' : '') + ': für die Bank, den Verkäufer oder deine Unterlagen.');
        await r18Seite(3);
        await b2oZeile(s, 'Im Dokument', 'Dieselben Kapitel wie am Bildschirm — Lage, Vergleichsdaten, Wertermittlung mit Rechenweg und Quellennachweis.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · MODUL 10c · DER RESTNUTZUNGSDAUER-RECHNER (v2283) ════════
     Marcel 16.10.2026 („mach weiter … auch die Videos“): der Rechner nach
     v2274/v2275 als eigenes Modul. Zwei KOPIEN, beide beim Aufräumen gelöscht:
     Ravensberger Weg 38 (MFH, Bj 1978) - Rechner aus dem Reiter Steuer, Ergebnis
     in ganzen Jahren mit Spanne ± 2, „übernehmen“ -> eigener AfA-Satz und die
     Tafel Steuer vorher/nachher; danach Parkstr. 9 (Bj 1905): Alter über der
     GND, Anlage 2 hält den Wert am Scheitel (v2275), „sachverständig zu
     würdigen“, Übernahme gesperrt (v2283). Die Gutachten-Anfrage wird NIE
     geklickt (RH_SPERRE sperrt /rnd-request ohnehin). */
  async function r10cZweiteKopie(id) {
    /* wie r6KopieStart, aber OHNE den Lauf neu aufzusetzen: die erste Kopie bleibt in DPM_REIHE.angelegt */
    var o = await Auth.apiCall('/objects/' + id);
    var d = JSON.parse(JSON.stringify((o && o.data) || {}));
    ['_obj_seq', '_deal_won', '_deal_won_at', '_deal_lost', '_ankauf'].forEach(function (k) { delete d[k]; });
    var neu = await Auth.apiCall('/objects', { method: 'POST', body: { data: d, aiAnalysis: null, photos: o.photos || [] } });
    var nid = neu && (neu.id || (neu.data && neu.data.id) || (neu.object && neu.object.id));
    if (nid && DPM_REIHE.angelegt.indexOf(nid) < 0) DPM_REIHE.angelegt.push(nid);
    if (nid && typeof window.loadSaved === 'function') await window.loadSaved(nid);
    await warteAuf(function () { return window._currentObjKey === nid && /\S/.test(wert('str')); }, 9000);
    await warte(900);
    var m = q('.main-col'); if (m) m.scrollTop = 0;
  }
  async function r10cRechnerAuf() {
    reiter('s3-tax'); await warte(900);
    var sel = q('#afa_satz'); if (sel && sel.value !== 'eigen') { sel.value = 'eigen'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await warte(800);
    await zeige(function () { return q('#afa-rnd-ermitteln'); }, 10);
    await warte(1100);
    var b = q('#afa-rnd-ermitteln'); if (b) b.click();
    await warteAuf(r6Wiz, 5000);
    try { var wm = r6Wiz().querySelector('.rnd-wiz-modal'); if (wm) wm.style.setProperty('max-height', (innerHeight - 40) + 'px', 'important'); } catch (e) {}
    kegelHoch(true);
    await warte(700);
  }
  async function r10cDurch() {
    for (var i = 0; i < 8 && !/Schritt 9/.test(r6WizTitel()); i++) { if (!(await r6WizWeiter())) break; await warte(900); }
    await warteAuf(function () { return /Schritt 9/.test(r6WizTitel()); }, 4000);
    await warte(900);
  }
  function r10cErgebnis() {
    var t = r6Inner(r6Wiz());
    var sp = /GESCHÄTZTE RESTNUTZUNGSDAUER[\s\S]*?(\d+(?:\s*[–\-]\s*\d+)?)\s*Jahre/i.exec(t), mw = /Modellwert\s*(\d+)\s*Jahre/.exec(t);
    return { spanne: sp ? sp[1].replace(/\s*[–\-]\s*/, '–') : null, mitte: mw ? mw[1] : null };
  }
  function r10cKarte() { var e = rhIm(r6Wiz(), /^Geschätzte Restnutzungsdauer$/i); return e && e.parentElement; }
  DREHBUECHER['reihe-rnd'] = {
    titel: 'Der Restnutzungsdauer-Rechner', unterzeile: 'Ganze Jahre, Spanne, übernehmen — und wo die Anlage 2 endet', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r6WizZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R6_MFH, { ohneAnkauf: true, ohneAnalyse: true });
        await r6MfhBeispiel(s, ' Heute: der <b>Restnutzungsdauer-Rechner</b>.');
      },
      async function (s) {   /* 2 · gesetzliche AfA */
        reiter('s3-tax'); await warte(900);
        await zeigeGruppe(feldVon('afa_satz'), function () { return q('#afa_kalk') && q('#afa_kalk').closest('.f'); }, 8);
        await b2oZeile(s, 'Die gesetzliche AfA', 'Baujahr ' + wert('baujahr') + ': <b>' + r6Optionstext('afa_satz') + '</b> — das Gesetz unterstellt 50 Jahre. Ist das Haus früher verbraucht, gilt ein eigener Satz.');
      },
      async function (s) {   /* 3 · Rechner öffnen */
        await r10cRechnerAuf();
        await zeige(function () { var w = r6Wiz(); return w && (w.querySelector('.rnd-wiz-modal,[class*=modal]') || w.firstElementChild); }, 6);
        await b2oZeile(s, 'Den Rechner öffnen', 'Reiter Steuer, „eigener Satz“, <b>Restnutzungsdauer ermitteln</b>. Die Objektdaten sind schon eingetragen.');
      },
      async function (s) {   /* 4 · die Schritte */
        var zb = r6Beginn(s, 'Neun Schritte', 'Bauweise, Technik, Modernisierungen, Zustand der Gewerke, Schäden — jeder Schritt ist vorbelegt, du korrigierst nur.');
        for (var i = 0; i < 8 && !/Schritt 9/.test(r6WizTitel()); i++) { if (!(await r6WizWeiter())) break; await warte(1300); }
        await warteAuf(function () { return /Schritt 9/.test(r6WizTitel()); }, 4000);
        await r6Ende(zb);
      },
      async function (s) {   /* 5 · Ergebnis in ganzen Jahren */
        await warte(700);
        await zeige(r10cKarte, 8);
        var E = r10cErgebnis();
        await b2oZeile(s, 'Das Ergebnis', '<b>' + (E.spanne || '–') + ' Jahre</b> — ganze Jahre, als Spanne: Modellwert ' + (E.mitte || '–') + ' Jahre, ± 2. Eine einzelne Zahl täte genauer, als eine Ersteinschätzung ist.');
      },
      async function (s) {   /* 6 · übernehmen -> eigener AfA-Satz, vorher/nachher */
        var k = function () { return q('#rnd-uebernehmen'); };
        var b = k(); if (b) b.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(k, 10);
        await b2oZeile(s, 'Übernehmen', 'Ein Klick: die Restnutzungsdauer wird dein <b>eigener AfA-Satz</b> — 100 ÷ Jahre.');
        b = k(); if (b && !b.disabled) b.click();
        await warteAuf(function () { var v = q('#rnd-uebernahme-vergleich'); return v && v.textContent.length > 20; }, 4000);
        await warte(600);
        await zeigeGruppe(function () { return q('#rnd-uebernehmen'); }, function () { return q('#rnd-uebernahme-vergleich'); }, 8);
        var t = r6Inner(q('#rnd-uebernahme-vergleich'));
        var afa = /AfA ([\d,]+ %) \(100 ÷ (\d+) Jahre\)/i.exec(t), za = /AfA im Jahr\s+([\d.]+ €)\s+→\s+([\d.]+ €)/.exec(t), st = /Steuer im Jahr\s+([^\n→]+?)\s+→\s+([^\n]+)/.exec(t), vt = /(Steuervorteil|Steuernachteil) ([\d.]+ €) im Jahr/.exec(t);
        await b2oZeile(s, 'Vorher und nachher', 'AfA ' + (afa ? '<b>' + afa[1] + '</b>' : '–') + (za ? ': ' + za[1] + ' → <b>' + za[2] + '</b> im Jahr' : '') + (st ? ', Steuer ' + st[1].trim() + ' → ' + st[2].trim() : '') + (vt ? ' — <b>' + vt[1] + ' ' + vt[2] + '</b> im Jahr.' : '.'));
      },
      async function (s) {   /* 7 · indikativ, kein Gutachten */
        var e = function () { return rhIm(r6Wiz(), /^Ersteinschätzung — die verbindliche Berechnung steht im Gutachten$/) || r10cKarte(); };
        var x = e(); if (x) x.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(e, 8);
        await b2oZeile(s, 'Indikativ, kein Gutachten', 'Eine <b>Ersteinschätzung</b>. Das Finanzamt erkennt den kürzeren Satz nur mit Gutachten an — die Anfrage geht von hier, im Video nicht.');
        r6WizZu();
        kegelHoch(false);
        await warte(800);
      },
      async function (s) {   /* 8 · im Reiter Steuer */
        reiter('s3-tax'); await warte(700);
        await zeigeGruppe(feldVon('afa_satz'), function () { return q('#afa-eigen-box') || q('#afa_kalk'); }, 8);
        await b2oZeile(s, 'Im Reiter Steuer', 'Eigener Satz aus <b>' + (wert('afa_rnd_jahre') || '–') + ' Jahren</b> — AfA ' + (r6Id('afa_kalk') || '–') + ' im Jahr. Die Grundlage steht dabei: ' + (wert('afa_eigen_grundlage') || '–') + '.');
      },
      async function (s) {   /* 9 · ein Altbau */
        await r10cZweiteKopie(R11_PARK);   /* Prüflauf: eigene Zeile während des Kopierens hatte keinen Kegel - die vorige bleibt stehen */
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var alter = new Date().getFullYear() - Number(wert('baujahr'));
        await b2oZeile(s, 'Und ein Altbau?', 'Baujahr ' + wert('baujahr') + ': <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + alter + ' Jahre alt, älter als die Gesamtnutzungsdauer von 80 Jahren.');
      },
      async function (s) {   /* 10 · Plateau */
        await r10cRechnerAuf();
        var zb = r6Beginn(s, 'Derselbe Rechner', 'Gleiche Schritte, vorbelegt aus dem Objekt.');
        await r10cDurch();
        await r6Ende(zb);
        await zeige(r10cKarte, 8);
        var E = r10cErgebnis();
        await b2oZeile(s, 'Alter höchstens die GND', '<b>' + (E.spanne || '–') + ' Jahre</b>. Ist das Haus älter als seine Gesamtnutzungsdauer, setzt DealPilot wie die ImmoWertA als Alter die Gesamtnutzungsdauer an.');   /* v2939 · bis v2938 „Am Scheitel gehalten" */
        var p = function () { return q('#rnd-pruefpflicht'); };
        var x = p(); if (x) x.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeigeGruppe(p, function () { return q('#rnd-uebernehmen') || p(); }, 8);
        var gs = q('#rnd-uebernehmen'), gesperrt = gs && gs.disabled;
        await b2oZeile(s, 'Sachverständig zu würdigen', p() ? 'So steht es da, mit Begründung' + (gesperrt ? ' — und die Übernahme als AfA-Satz ist <b>gesperrt</b>, bis ein Sachverständiger urteilt.' : '.') : 'Die Kennzeichnung fehlt hier.');
      },
      async function (s) {   /* 11 · Schluss */
        await zeige(r10cKarte, 8);
        await b2oZeile(s, 'Ersteinschätzung in Minuten', 'Wie viele Jahre bleiben, was es steuerlich bringt — und wo die Rechnung endet. Für die Erklärung zählt das Gutachten.', 600);
        r6WizZu(); kegelHoch(false);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 23 · DIE 15-%-GRENZE (v2285) ═══════════════
     Kapitelgerüst (Videoreihe.md): anschaffungsnahe Herstellungskosten -
     Schwelle, netto/brutto, 3 Jahre, vor/nach BMF. KOPIE des Ravensberger Weg 38
     (MFH, Sanierung 87.000 € brutto), beim Aufräumen gelöscht. Angenommen im
     Lauf: netto statt brutto, dann 180.000 € Sanierung, dann der Gebäudeanteil
     „optimiert" aus der Kaufpreisaufteilung (Mitschnitt Modul 10b, gelesen aus
     DPM_REIHE_DATEN.bmf - für genau dieses Objekt gerechnet). Kein Abruf. */
  function r23(id) { return r6Id(id); }
  function r23Kv(id) { return function () { var e = document.getElementById(id); return e && (e.closest('.kv') || e); }; }
  function r23Auf() { var d = q('#san_15pct_details'); if (d && !d.open) d.open = true; return d; }
  DREHBUECHER['reihe-15pct'] = {
    titel: 'Die 15-%-Grenze', unterzeile: 'Anschaffungsnahe Herstellungskosten — Schwelle, netto, drei Jahre', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R6_MFH, { ohneAnkauf: true, ohneAnalyse: true });
        await r6MfhBeispiel(s, ' Heute: die <b>15-%-Grenze</b>.');
      },
      async function (s) {   /* 2 · die Sanierung */
        reiter('s1'); await warte(900);
        var g = r6Gruppe('san'); var e = g(); if (e) e.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeigeGruppe(g, feldVon('san_ust'), 8);
        /* Prüflauf 23: das Demo-Objekt trägt keine Sanierung (Modul 10b hatte sie im Lauf eingetippt) */
        if (!zahl('san')) {
          var zb = r6Beginn(s, 'Angenommen: eine Sanierung', 'Dach, Fenster, Bäder in den ersten drei Jahren — 87.000 € laut Angebot, brutto.');
          await tippeH('san_ust', 'brutto', 300);
          await tippeH('san', '87000', 110);
          await warte(900);
          await r6Ende(zb);
        }
        await b2oZeile(s, 'Die Sanierung', '<b>' + (eur(zahl('san')) || '–') + '</b> geplant, eingetragen <b>' + r6Optionstext('san_ust').replace(/\s*\(.*\)$/, '') + '</b>. In den ersten drei Jahren nach dem Kauf zählt das gegen eine Grenze.');
      },
      async function (s) {   /* 3 · die Grenze */
        var d = r23Auf(); if (d) d.scrollIntoView({ block: 'start' });
        await warte(700);
        await zeigeGruppe(r23Kv('san_limit_max'), r23Kv('san_limit_status'), 8);
        await b2oZeile(s, '15 % in drei Jahren', 'Höchstens <b>' + r23('san_limit_max') + '</b> netto (brutto ' + r23('san_limit_max_brutto') + '). Mehr, und die Kosten werden <b>Anschaffungskosten</b> — nur noch über die AfA, nicht sofort.');
      },
      async function (s) {   /* 4 · so wird gerechnet */
        var b = q('#ahk_detail_block'), sicht = b && b.offsetHeight > 0;
        if (sicht) {
          await zeige(function () { return q('#ahk_detail_block'); }, 8);
          /* v2395 · #ahk_geb_anteil zeigt den Anteil auf ganze Prozent gerundet („75 %"), Szene 8 sagt 74,82 % - beide aus geb_ant */
          await b2oZeile(s, 'So wird gerechnet', 'Gebäudeanteil <b>' + r6Pz(wert('geb_ant')) + ' %</b> vom Kaufpreis, plus anteilige Nebenkosten — die Gebäude-Anschaffungskosten. Davon 15 %: <b>' + r23('ahk_15pct') + '</b>.');
        } else {
          await zeige(r23Kv('san_limit_max'), 8);
          await b2oZeile(s, 'So wird gerechnet', 'Gebäudeanteil ' + r6Pz(wert('geb_ant')) + ' % vom Kaufpreis plus anteilige Nebenkosten — davon 15 %.');
        }
      },
      async function (s) {   /* 5 · netto */
        await zeigeGruppe(r23Kv('san_brutto_val'), r23Kv('san_limit_actual'), 8);
        await b2oZeile(s, 'Netto zählt', 'Das Gesetz misst <b>ohne Umsatzsteuer</b>: ' + r23('san_brutto_val') + (q('#san_ust_row') && q('#san_ust_row').offsetHeight ? ' − ' + r23('san_ust_val').replace(/^[−\-]\s*/, '') + ' Umsatzsteuer' : '') + ' = <b>' + r23('san_limit_actual') + '</b> maßgeblich. Status: <b>' + r23('san_limit_status').replace(/^✓\s*/, '') + '</b>.');
      },
      async function (s) {   /* 6 · als netto eingetragen */
        await zeige(feldVon('san_ust'), 10);
        var zb = r6Beginn(s, 'Angenommen: netto', 'Dieselbe Zahl, aber als Nettobetrag eingetragen …');
        await warte(1300);
        await tippeH('san_ust', 'netto', 600);
        await warte(900);
        await r6Ende(zb);
        await zeigeGruppe(r23Kv('san_limit_actual'), r23Kv('san_limit_status'), 8);
        await b2oZeile(s, 'Angenommen: netto', 'Jetzt zählt der volle Betrag: <b>' + r23('san_limit_actual') + '</b>. Status: <b>' + r23('san_limit_status').replace(/^✓\s*/, '') + '</b>. Brutto oder netto — die Angabe entscheidet mit.');
      },
      async function (s) {   /* 7 · über die Grenze */
        var g = r6Gruppe('san'); var e = g(); if (e) e.scrollIntoView({ block: 'center' });
        await warte(400);
        await zeige(g, 8);
        var zb = r6Beginn(s, 'Angenommen: mehr Sanierung', '180.000 € netto in den ersten drei Jahren …');
        await tippeH('san', '180000', 110);
        await warte(1100);
        await r6Ende(zb);
        var d = r23Auf(); if (d) d.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeigeGruppe(r23Kv('san_limit_actual'), r23Kv('san_limit_status'), 8);
        await b2oZeile(s, 'Über der Grenze', '<b>' + r23('san_limit_actual') + '</b> gegen ' + r23('san_limit_max') + ': <b>' + r23('san_limit_status').replace(/^[✓⚠✕!]\s*/, '') + '</b>. Die Kosten gehen dann in die Abschreibung des Gebäudes.');
        await zeige(feldVon('san_tax_years'), 10);
        await b2oZeile(s, 'Steuerlich verteilt', 'Die Verteilung steht auf <b>' + r6Optionstext('san_tax_years') + '</b> — DealPilot wählt nach der Grenze: sofort oder über die Nutzungsdauer.');
      },
      async function (s) {   /* 8 · vor und nach der Kaufpreisaufteilung */
        var B = window.DPM_REIHE_DATEN && DPM_REIHE_DATEN.bmf && DPM_REIHE_DATEN.bmf.pipeline && DPM_REIHE_DATEN.bmf.pipeline.phase5_varianten, opt = B && B.optimiert && B.optimiert.gebaeude_pct;
        var vorMax = r23('san_limit_max'), vorAnt = wert('geb_ant');
        reiter('s3-tax'); await warte(900);
        await zeige(feldVon('geb_ant'), 10);
        await b2oZeile(s, 'Der Gebäudeanteil', 'Die Grenze hängt am Gebäudeanteil: hier <b>' + r6Pz(vorAnt) + ' %</b>. Die Kaufpreisaufteilung (Modul 10b) kann ihn begründet anheben.');
        if (opt) {
          var zb = r6Beginn(s, 'Nach der Kaufpreisaufteilung', 'Variante „optimiert“ aus Modul 10b: ' + de(opt, 2) + ' % Gebäude …');
          await tippeH('geb_ant', de(opt, 2), 140);
          await warte(1000);
          await r6Ende(zb);
          reiter('s1'); await warte(800);
          var d = r23Auf(); if (d) d.scrollIntoView({ block: 'start' });
          await warte(500);
          await zeigeGruppe(r23Kv('san_limit_max'), r23Kv('san_limit_status'), 8);
          await b2oZeile(s, 'Vor und nach der Aufteilung', 'Grenze <b>' + vorMax + ' → ' + r23('san_limit_max') + '</b>. Status: <b>' + r23('san_limit_status').replace(/^[✓⚠✕!]\s*/, '') + '</b>. Mehr Gebäude heißt mehr Spielraum — und mehr AfA.', 600);
        }
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 24 · BODENRICHTWERT UND UNTERLAGEN (v2300) ═══
     Kapitelgerüst: Bodenrichtwert holen (BORIS) · Unterlagen bei den Ämtern -
     nur bis vor die Bestellung · Restnutzungsdauer-Gutachten (nur zeigen).
     KOPIE der Westerfeldstr. 140, beim Aufräumen gelöscht. Der BORIS-Abruf
     läuft ECHT (Open Data, kostenlos, GET); die Geokodierung davor ist ein
     bezahlter Dienst und wird mit den Koordinaten aus Bericht 216 desselben
     Objekts gespielt (_rh.geo). Unterlagen: nur das Modal mit dem, was das
     Register schon weiß (GET /aemter); keine Amtssuche (POST /amt), kein
     Entwurf (POST /entwurf trägt den Kontonamen) - beides sperrt RH_SPERRE
     ohnehin. Nichts wird verschickt. */
  function r24Ul() { return q('#dp-unterlagen-modal'); }
  function r24UlZu() { try { if (window.DealPilotUnterlagen) DealPilotUnterlagen.schliessen(); } catch (e) {} var m = r24Ul(); if (m && m.parentNode) m.parentNode.removeChild(m); }
  DREHBUECHER['reihe-brw-unterlagen'] = {
    titel: 'Bodenrichtwert und Unterlagen', unterzeile: 'BORIS, die zuständigen Ämter — und was DealPilot nicht verschickt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r24UlZu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R11_WESTERFELD, { ohneAnkauf: true, ohneAnalyse: true });
        try { var R = DPM_REIHE_DATEN.westerfeld.mb[3].ref; if (_rh && R && R.lat != null) _rh.geo = { lat: R.lat, lon: R.lon }; } catch (e) {}
        await r11Beispiel(s, ' Heute: <b>Bodenrichtwert</b> und <b>Unterlagen vom Amt</b>.');
      },
      async function (s) {   /* 2 · der Bodenrichtwert */
        reiter('s0'); await warte(700);
        var f = feldVon('brw'); var e = f(); if (e) e.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeigeGruppe(f, function () { return q('#brw-boris-btn'); }, 8);
        await b2oZeile(s, 'Der Bodenrichtwert', 'Er trägt den Bodenwert — und damit Ertrags- und Sachwert. Hier steht <b>' + (wert('brw') || '–') + ' €/m²</b>. Woher? Einmal neu abrufen.');
      },
      async function (s) {   /* 3 · BORIS abrufen */
        var vor = wert('brw');
        await zeige(function () { return q('#brw-boris-btn'); }, 10);
        var zb = r6Beginn(s, 'Bodenrichtwert abrufen', 'Ein Klick: DealPilot fragt das Bodenrichtwert-Portal des Landes — kostenlos, amtlich.');
        await tippeH('brw', '', 80);
        await warte(900);
        var b = q('#brw-boris-btn'); if (b) b.click();
        await warteAuf(function () { return wert('brw') && !/sucht|läuft/i.test(r6Id('brw-ai-status')); }, 15000);
        await warte(900);
        await r6Ende(zb);
        await zeigeGruppe(f2(), function () { return q('#brw-ai-status') || q('#brw-boris-btn'); }, 8);
        function f2() { return feldVon('brw'); }
        var st = r6Id('brw-ai-status');
        await b2oZeile(s, 'Aus BORIS', '<b>' + (wert('brw') || '–') + ' €/m²</b>' + (st ? ' — ' + st.replace(/^✓\s*/, '') : '') + (vor && vor !== wert('brw') ? ' (vorher ' + vor + ')' : '') + '.');
      },
      async function (s) {   /* 4 · das Portal */
        var p = function () { return [].filter.call(document.querySelectorAll('.btn-brw'), function (x) { return x.offsetWidth && /Bodenrichtwert-Portal|BORIS-Portal/.test(x.textContent); })[0] || null; };
        await zeige(p, 10);
        await b2oZeile(s, 'Zum Nachsehen', 'Der Knopf daneben öffnet das <b>Bodenrichtwert-Portal</b> des Bundeslands — mit Karte, Zone und Stichtag.');
      },
      async function (s) {   /* 5 · Unterlagen beim Amt */
        reiter('s8'); await warte(1200);
        var am = function () { return r6Knopf('#s8', /Unterlagen beim Amt anfordern/); };
        var k = am(); if (k) k.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(function () { var b = am(); return b && (b.parentElement || b); }, 8);
        await b2oZeile(s, 'Unterlagen vom Amt', 'Flurkarte, Grundbuch, Baulasten, Altlasten, Bauakte — in der Deal-Aktion, und im Reiter Objekt beim Bodenrichtwert.');
        try { await window.DealPilotUnterlagen.oeffnen(); } catch (e) {}
        await warteAuf(function () { var m = r24Ul(); return m && /Flurkarte|Grundbuch/.test(m.textContent); }, 8000);
        await warte(800);
        kegelHoch(true);
        await zeige(function () { var m = r24Ul(); return m && (m.querySelector('[class*=modal],[class*=box]') || m.firstElementChild); }, 6);
        /* Prüflauf 24: für Bielefeld liegt im Register noch kein Amt - die Zeile sagt, was das Modal sagt */
        var mt = r6Inner(r24Ul()), offen = /(\d+) von (\d+) Zuständigkeiten noch nicht ermittelt/.exec(mt);
        await b2oZeile(s, 'Je Unterlage die Stelle', offen
          ? 'Hier: <b>' + offen[1] + ' von ' + offen[2] + '</b> Zuständigkeiten noch nicht ermittelt. „Amt ermitteln“ sucht die Stelle — rund 20 Sekunden, dann steht sie im Register, mit Beleg.'
          : 'Die zuständigen Ämter stehen schon im Register — mit Beleg, Gebühr und Weg.');
      },
      async function (s) {   /* 6 · Entwurf, nicht Versand */
        var m = r24Ul(); var b = m && [].filter.call(m.querySelectorAll('button'), function (x) { return x.offsetWidth && /Anschreiben|Entwurf|Antrag|Mail/i.test(x.textContent); })[0];
        if (b) { b.scrollIntoView({ block: 'center' }); await warte(400); await zeige(function () { return b; }, 8); }
        else await zeige(function () { var mm = r24Ul(); return mm && (mm.querySelector('#dp-ul-body') || mm.firstElementChild); }, 6);
        await b2oZeile(s, 'Entwurf, nicht Versand', 'Aus jeder Zeile wird ein fertiger Antrag — zum Kopieren oder für dein Mailprogramm. <b>DealPilot verschickt nichts</b>; im Video bleibt es hier.');
        r24UlZu(); kegelHoch(false);
        await warte(700);
      },
      async function (s) {   /* 7 · Restnutzungsdauer-Gutachten */
        var g = function () { var h = [].filter.call(document.querySelectorAll('#s8 .dab-rh-n'), function (x) { return /^Gutachter/.test(r6Text(x)); })[0]; return h && h.closest('.dab-rail-head'); };
        var x = g(); if (x) x.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeigeGruppe(g, function () { var h = g(); return h && h.nextElementSibling; }, 8);
        await b2oZeile(s, 'Restnutzungsdauer-Gutachten', 'Die Ersteinschätzung macht der Rechner im Reiter Steuer (Modul 10c). Für das Finanzamt geht von hier die Anfrage an einen Gutachter — im Video nicht.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODULE 20 UND 21 · BANKEXPORT, COCKPIT (v2300) ═══
     Beide laufen am KONTO, ohne Kopie: sie lesen nur. rhNurStart setzt den
     Lauf auf wie r6KopieStart (Sperren, Merker, Mitschnitte), legt aber kein
     Objekt an. Gesperrt bleibt alles aus RH_SPERRE, dazu die Ablage der
     Portfolio-Analyse (PUT /user-settings/portfolio_analyse): im Lauf
     beantwortet, nicht geschrieben. */
  async function rhNurStart() {
    DPM_REIHE.angelegt = []; DPM_REIHE.gesperrt = []; DPM_REIHE.gespielt = []; DPM_REIHE.geloescht = []; DPM_REIHE.abrufe = []; DPM_REIHE.fertig = null;
    var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    _rh = { start: Date.now() - 1000, berichte: [], spr: 0, sprMax: 0, seqKey: null, seq: undefined,
      merker: { dp_zielstufe: ls('dp_zielstufe'), dp_mb_auftraege: ls('dp_mb_auftraege'), dp_mb_pref_span: ls('dp_mb_pref_span'), qc_span_config: ls('qc_span_config') },
      kacheln: ['dealpilot', 'import', 'voice', 'immometrica', 'gefuehrt'].filter(rhGewaehlt) };
    await rhLaden();
    rhSpion(); rhMikroAn();
  }
  /* ── 20 · Bankexport Portfolio ── */
  var _r20All;
  function r20M() { return q('#bankexport-modal'); }
  function r20Zu() { var m = r20M(); if (m && m.parentNode) m.parentNode.removeChild(m); if (_r20All !== undefined) { window._bankexportIncludeAll = _r20All; _r20All = undefined; } }
  function r20Karte(re) { var m = r20M(); return m && [].filter.call(m.querySelectorAll('.bank-sum-card'), function (c) { return re.test(r6Text(c.querySelector('.bank-sum-label'))); })[0] || null; }
  function r20Wert(re) { var c = r20Karte(re); return c ? r6Text(c.querySelector('.bank-sum-val')) : '–'; }
  DREHBUECHER['reihe-bankexport'] = {
    titel: 'Bankexport Portfolio', unterzeile: 'Alle Darlehen in einer Tabelle — für das Bankgespräch', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r20Zu(); kegelHoch(false); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · der Einstieg */
        await rhNurStart();
        _r20All = window._bankexportIncludeAll;
        var k = function () { return qs('.sb-act-item[onclick*="bankexport"]'); };
        await zeige(k, 10);
        await b2oZeile(s, 'Bankexport', 'Links unter den Aktionen: <b>Bankexport</b> — das ganze Portfolio so, wie eine Bank es für eine Anschlussfinanzierung sehen will.');
      },
      async function (s) {   /* 2 · die Summen */
        window._bankexportIncludeAll = false;
        try { await window.showBankexportView(); } catch (e) {}
        await warteAuf(function () { return r20M() && r20Karte(/^Objekte mit Darlehen/); }, 8000);
        await warte(700);
        kegelHoch(true);
        await zeige(function () { var m = r20M(); return m && m.querySelector('.bank-summary-grid'); }, 8);
        await b2oZeile(s, 'Auf einen Blick', 'Objekte mit Darlehen <b>' + r20Wert(/^Objekte mit Darlehen/) + '</b>, ' + r20Wert(/^Anzahl Darlehen/) + ' Darlehen, Kaufpreise zusammen <b>' + r20Wert(/^Summe Kaufpreis/) + '</b>, Restschuld heute <b>' + r20Wert(/^Summe Restschuld/) + '</b>.');
      },
      async function (s) {   /* 3 · welche Objekte */
        await zeige(function () { var m = r20M(); return m && m.querySelector('.bank-filter-bar'); }, 8);
        await b2oZeile(s, 'Welche Objekte', 'Vorgabe: nur, was im <b>Bestand</b> ist — gewonnene Deals. Ein Häkchen nimmt alle Objekte dazu, eins je Zeile nimmt ein Darlehen heraus.');
      },
      async function (s) {   /* 4 · die Tabelle */
        var t = function () { var m = r20M(); return m && m.querySelector('.bank-table thead'); };
        var x = t(); if (x) x.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeigeGruppe(t, function () { var m = r20M(); var r = m && m.querySelectorAll('.bank-table tbody tr'); return r && r.length ? r[Math.min(3, r.length - 1)] : null; }, 6);
        var n = r20M() ? r20M().querySelectorAll('.bank-table tbody tr').length : 0;
        await b2oZeile(s, 'Je Darlehen eine Zeile', n + ' Zeilen: Fläche, Nettokaltmiete, €/m², Bewirtschaftung, <b>Darlehenssumme, Zins, Tilgung, Kapitaldienst, Zinsbindung</b>, Restschuld heute und am Ende der Bindung.');
      },
      async function (s) {   /* 5 · Ausgabe */
        var a = function () { var m = r20M(); return m && m.querySelector('.global-view-actions'); };
        var x = a(); if (x) x.scrollIntoView({ block: 'center' });
        await warte(400);
        await zeige(a, 8);
        await b2oZeile(s, 'Für die Bank', '<b>PDF</b> zum Mitnehmen, <b>Excel</b> und CSV zum Weiterrechnen — dieselben Zahlen wie in den Objekten. Im Video laden wir nichts herunter.', 600);
        r20Zu(); kegelHoch(false);
      }
    ]
  };
  /* ── 21 · Portfolio-Cockpit und Portfolio-Pilot ── */
  function r21(sel) { return q('#dp-stage ' + sel); }
  function r21T(sel) { return r6Inner(r21(sel)).replace(/\s+/g, ' '); }
  function r21Zu() { try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {} }
  DREHBUECHER['reihe-cockpit'] = {
    titel: 'Portfolio-Cockpit und Pilot', unterzeile: 'Alle Objekte auf einer Seite — und ein Pilot, der sie kennt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r21Zu(); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · Einstieg */
        await rhNurStart();
        await zeige(function () { return qs('.sb-act-item[onclick*="cockpit"]'); }, 10);
        await b2oZeile(s, 'Das Portfolio-Cockpit', 'Links unter den Aktionen. Hier steht nicht ein Objekt, sondern <b>alle</b>.');
        try { sbActionsAction('cockpit'); } catch (e) {}
        await warteAuf(function () { return r21('#dp-pscore-hero .hbody'); }, 10000);
        await warte(1200);
      },
      async function (s) {   /* 2 · der Portfolio-Score */
        await zeige(function () { return r21('#dp-pscore-hero .hgate') || r21('#dp-pscore-hero'); }, 8);
        var t = r21T('#dp-pscore-hero .hbody'), sc = /SCORE\s*(\d+)\s*\/\s*100\s*([A-ZÄÖÜ ]+?)\s*OBJEKTE/.exec(t), ob = /OBJEKTE\s*(\d+)/.exec(t), vol = /VOL\.\s*([\d,]+ Mio)/.exec(t), cf = /CF\/MON\s*([+−\-]?[\d.]+)/.exec(t);
        await b2oZeile(s, 'Der Portfolio-Score', '<b>' + (sc ? sc[1] + ' · ' + sc[2].trim().charAt(0) + sc[2].trim().slice(1).toLowerCase() : '–') + '</b> über ' + (ob ? ob[1] : '–') + ' Objekte, Volumen ' + (vol ? vol[1] + ' €' : '–') + ', Cashflow ' + (cf ? cf[1] + ' €' : '–') + ' im Monat.');
      },
      async function (s) {   /* 3 · woraus er besteht */
        await zeige(function () { return r21('#dp-pscore-hero .hbars'); }, 8);
        var t = r21T('#dp-pscore-hero .hbars'), teile = [];
        var re = /(Rendite|Finanzierung|Risiko & Vermietung|Lage & Diversifikation|Upside-Potenzial)\s*\d+\s*KPIs\s*(\d+)\/100/g, m;
        while ((m = re.exec(t))) teile.push(m[1] + ' <b>' + m[2] + '</b>');
        await b2oZeile(s, 'Fünf Bereiche', (teile.join(', ') || '–') + ' — dieselben Kennzahlen wie im einzelnen Objekt, gewichtet über den Bestand.');
      },
      async function (s) {   /* 4 · Kennzahlen aggregiert */
        var o = function () { return r21('#dp-overview-strip'); };
        var x = o(); if (x) x.scrollIntoView({ block: 'center' });
        await warte(500);
        await zeige(o, 8);
        var t = r21T('#dp-overview-strip'), mi = /MIETEINNAHMEN \/ MONAT\s*([\d.,]+ €)/.exec(t), gi = /GESAMTINVESTITION\s*([\d.,]+ Mio €)/.exec(t), rs = /RESTSCHULD GESAMT\s*([\d.,]+ Mio €)/.exec(t);
        await b2oZeile(s, 'Kennzahlen über alles', 'Mieteinnahmen <b>' + (mi ? mi[1] : '–') + '</b> im Monat, Gesamtinvestition ' + (gi ? gi[1] : '–') + ', Restschuld ' + (rs ? '<b>' + rs[1] + '</b>' : '–') + '. Ein Klick wechselt zwischen Bestand und Ankauf-Stand.');
      },
      async function (s) {   /* 5 · Steuer über alle Objekte */
        var k = function () { return r21('#dp-steuerkette'); };
        var x = k(); if (x) x.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeige(k, 8);
        await b2oZeile(s, 'Steuer über alle Objekte', 'Die Einkommensteuer mit Progression — privat und je Gesellschaft, aus den echten Objektdaten. Was ein Objekt mehr bringt, sieht man im Ganzen.');
      },
      async function (s) {   /* 6 · Projektion */
        /* Aufnahme 21: der ganze Abschnitt ist 1.121 px hoch - der Kegel auf ihm scrollte bis zur Steuer-Mappe. Jetzt Kopf + erstes Diagramm. */
        var p = function () { return r21('#dp-charts-sec .dp-charts-summary') || r21('#dp-charts-sec'); };
        var x = p(); if (x) x.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeigeGruppe(p, function () { var c = r21('#dp-charts-sec .charts'); return c && (c.firstElementChild || c); }, 8);
        await b2oZeile(s, 'Die Projektion', 'Restschuld, Eigenkapital, Cashflow über 10, 20 oder 30 Jahre — eine vereinfachte Modellrechnung über den ganzen Bestand.');
      },
      async function (s) {   /* 7 · der Portfolio-Pilot */
        var pp = function () { return q('#dp-pp'); };
        var x = pp(); if (x) x.scrollIntoView({ block: 'start' });
        await warte(500);
        await zeige(function () { return q('#dp-pp .dp-pp-head') || pp(); }, 8);
        await b2oZeile(s, 'Der Portfolio-Pilot', 'Er kennt die Vermögensbilanz und jedes Objekt darin. Ein Klick: die Analyse über alles.');
      },
      async function (s) {   /* 8 · die Analyse (Mitschnitt) */
        var D = window.DPM_REIHE_DATEN;
        if (!(D && D.portfolioPilot)) { await b2oZeile(s, 'Die Analyse', 'Hier läuft die Portfolio-Analyse.'); return; }
        var g = q('#dp-pp-go');
        await zeige(function () { return q('#dp-pp-go'); }, 10);
        var zb = r6Beginn(s, 'Die Analyse', 'Vermögensbilanz, Ertrag, die einzelnen Objekte, Klumpenrisiken, Entwicklung — und was als Nächstes zu tun ist.');
        if (g) g.click();
        await warteAuf(function () { var l = q('#dp-pp-log'); return l && l.querySelectorAll('[class*=msg]').length >= 2 && !/denkt|analysiert/i.test(l.lastElementChild ? l.lastElementChild.textContent.slice(0, 40) : ''); }, 15000);
        await warte(900);
        await r6Ende(zb);
        var log = function () { return q('#dp-pp-log'); };
        var l = log(); if (l) l.scrollTop = 0;
        await zeige(log, 6);
        /* v2395 · vorher nur die Überschriften („1. Vermögensbilanz heute: · 2. Ertragslage: ·") - unter
           „mit Zahlen" stand keine Zahl. Jetzt je Abschnitt Überschrift + erster Posten, aus der Antwort gelesen. */
        var txt = (D.portfolioPilot.reply || ''), ab = txt.split(/^\s*(?:#+\s*)?\d\.\s+/m).slice(1, 3), h = ab.map(function (a) {
          var kopf = /^\**([^*\n:]{3,50})\**:?/.exec(a), p = /^\s*[-•]\s*\**([^*\n:]{3,40})\**:\s*([^\n(]{2,40})/m.exec(a);
          return kopf && p ? kopf[1].trim() + ': <b>' + p[1].trim() + ' ' + p[2].trim().replace(/\s*EUR\b/g, ' €') + '</b>' : null;
        }).filter(Boolean);
        await b2oZeile(s, 'Gegliedert, mit Zahlen', (h.length ? h.join(' · ') : 'Vermögensbilanz · Ertragslage · die Objekte') + ' — gerechnet mit den Zahlen des Cockpits, nichts erfunden.');
        if (l) { l.scrollTop = l.scrollHeight * 0.45; await warte(500); }
        await b2oZeile(s, 'Die Objekte beim Namen', 'Welche tragen, welche belasten — mit Objekt und Zahl. Am Ende drei konkrete Schritte, priorisiert.');
      },
      async function (s) {   /* 9 · Fragen */
        await zeige(function () { return q('#dp-pp-chips'); }, 8);
        await b2oZeile(s, 'Und dann fragen', 'Schnellfragen oder eigene: „Welches Objekt zieht den Schnitt runter?“ — der Pilot antwortet zu jedem Objekt und zum Ganzen.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 17 · OBJEKT ÜBERTRAGEN (v2305) ═════════════
     Marcel 16.10.2026: Hauptweg ist die DealPilot-Sicherung (.dpkt). KOPIE der
     Westerfeldstr. 140 (mit Analyse und Ankauf-Stand). Exportiert wird die
     Kopie - die Datei entsteht LOKAL, nichts wird heruntergeladen: der Klick
     auf den Download-Anker wird für diesen einen Aufruf abgefangen. Die
     Rückfrage „Analysen veraltet - trotzdem exportieren?" beantwortet der Lauf
     mit Ja (window.confirm nur für diesen Aufruf). Danach der Import DERSELBEN
     Datei im selben Konto: er legt ein zweites Objekt an, das beim Aufräumen
     mit der Kopie gelöscht wird. Kein zweites Konto. */
  var _r17 = null;
  function r17Zu() {
    try { if (typeof closeIexpModal === 'function') closeIexpModal(); } catch (e) {}
    var m = q('#iexp-modal'); if (m && m.parentNode) m.parentNode.removeChild(m);
    var b = q('#dpm-dpkt'); if (b && b.parentNode) b.parentNode.removeChild(b);
    if (_r17 && _r17.klick) { HTMLAnchorElement.prototype.click = _r17.klick; _r17.klick = null; }
    if (_r17 && _r17.confirm) { window.confirm = _r17.confirm; _r17.confirm = null; }
  }
  function r17Karte(re) { return [].filter.call(document.querySelectorAll('#iexp-modal .iexp-card'), function (c) { return c.offsetWidth && re.test(c.textContent); })[0] || null; }
  function r17Blick(P, name, bytes) {
    var o = (P.objekte || [])[0] || {}, d = o.daten || {};
    var felder = Object.keys(d).length, analyse = !!o.analyse, ankauf = !!o.ankauf_stand, mb = o.marktbericht ? ((o.marktbericht.verlauf || o.marktbericht.punkte || []).length || 1) : 0;
    var steuer = ['_taxYearlyOverrides', 'afa_satz', 'geb_ant'].filter(function (k) { return d[k] != null && d[k] !== ''; }).length;
    var lex = P.lexikon && P.lexikon.felder ? Object.keys(P.lexikon.felder).length : 0;
    /* v2352 · seit v2351 trägt die Einzelobjekt-Sicherung kein Konto-Wissen mehr - die Karte liest, was WIRKLICH im Paket steht */
    var KONTO = ['eigenes', 'portfolio_analyse', 'lage_profil', 'datenraum'], WN = { eigenes: 'eigene Ergänzung', portfolio_analyse: 'Portfolio-Analyse', lage_profil: 'Lageprofil', datenraum: 'Datenraum-Liste' };
    var wk = P.wissen ? Object.keys(P.wissen) : [], kontoDrin = KONTO.filter(function (k) { return wk.indexOf(k) >= 0; }).map(function (k) { return WN[k]; }), projektDrin = wk.indexOf('projekt') >= 0;
    var c = document.createElement('div'); c.id = 'dpm-dpkt';
    c.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:760px;z-index:100002;background:#FDFCFA;color:#2A2727;border-radius:14px;border-top:3px solid var(--wl-c9a84c,#C9A84C);box-shadow:0 24px 70px rgba(0,0,0,.5);padding:24px 28px;font:14px/1.5 Inter,sans-serif';
    function z(k, v, ok) { return '<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #EEE8DC"><span>' + k + '</span><b style="color:' + (ok === false ? '#B8625C' : '#2A2727') + '">' + v + '</b></div>'; }
    c.innerHTML = '<div style="font:600 10.5px/1 JetBrains Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--wl-9a7f33,#9a7f33);margin-bottom:6px">Was in der Datei steckt</div>'
      + '<div style="font:600 18px Space Grotesk,sans-serif;margin-bottom:12px">' + name.replace(/</g, '&lt;') + ' · ' + de(Math.round(bytes / 1024)) + ' KB</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 28px">'
      + '<div><div style="font-weight:700;color:#3FA56C;margin:4px 0">Geht mit</div>'
      + z('Eingaben des Objekts', de(felder) + ' Felder')
      + z('Steuer (AfA, Gebäudeanteil, Jahre)', steuer ? 'ja' : '–')
      + z('Pilot-Analyse', analyse ? 'ja' : 'keine')
      + z('Ankauf-Stand (Soll)', ankauf ? 'ja' : 'keiner')
      + z('Marktbericht-Verlauf', mb ? 'ja' : '–')
      + z('Feld-Lexikon', lex ? de(lex) + ' Einträge' : '–')
      + (projektDrin ? z('Projektwissen (Score-Stufen, Begriffe)', 'ja') : '')
      + (P.fotos_enthalten ? z('Objektfotos', 'ja') : '')
      + '</div><div><div style="font-weight:700;color:#B8625C;margin:4px 0">Bleibt hier</div>'
      + z('Konto, Login, Passwort', 'nein', false)
      + z('Abo und Kontingent', 'nein', false)
      + z('Darstellung und Standardwerte', 'nein', false)
      + (kontoDrin.length ? '' : z('Konto-Wissen (Ergänzung, Analysen, Lage)', 'nein', false))
      + (P.fotos_enthalten ? '' : z('Objektfotos', 'nur mit Häkchen', false))
      + '</div></div>'
      + (kontoDrin.length ? '<div style="margin-top:12px;padding:10px 12px;background:rgba(184,98,92,.07);border-left:3px solid #B8625C;border-radius:6px;font-size:12.5px;color:#4A4440"><b>Auch im Paket:</b> ' + kontoDrin.join(', ') + '. Vor der Weitergabe beachten.</div>' : '');
    document.body.appendChild(c);
    return c;
  }
  DREHBUECHER['reihe-uebertragen'] = {
    titel: 'Objekt übertragen', unterzeile: 'Die DealPilot-Sicherung — was mitgeht und was nicht', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r17Zu(); kegelHoch(false); rhAufraeumen(); _r17 = null; },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await r6KopieStart(R11_WESTERFELD, {});
        _r17 = { id: window._currentObjKey, text: null, name: null, klick: null, confirm: null };
        await r11Beispiel(s, ' Heute: das Objekt <b>als Datei</b> weitergeben.');
      },
      async function (s) {   /* 2 · Export: die Sicherung */
        try { openExportHub(); } catch (e) {}
        await warteAuf(function () { return r17Karte(/DealPilot-Sicherung/); }, 5000);
        kegelHoch(true); await warte(600);
        await zeige(function () { return r17Karte(/DealPilot-Sicherung/); }, 8);
        await b2oZeile(s, 'Die DealPilot-Sicherung', 'Eine Datei (<b>.dpkt</b>) mit allem, was das Objekt ausmacht — für dich als Sicherung oder für jemanden, der damit weiterarbeitet.');
      },
      async function (s) {   /* 3 · einzelnes Objekt wählen */
        try { iexpExportJsonChoose(); } catch (e) {}
        await warte(900);
        try { await iexpExportJsonSingle(); } catch (e) {}
        await warteAuf(function () { return q('#iexp-modal .iexp-obj-current'); }, 8000);
        await warte(500);
        await zeige(function () { return q('#iexp-modal .iexp-obj-current'); }, 8);
        await b2oZeile(s, 'Ein Objekt oder alle', 'Hier das geladene: <b>' + wert('str') + ' ' + wert('hnr') + '</b>. Wahlweise mit Passwort verschlüsselt (AES-256).');
      },
      async function (s) {   /* 4 · die Datei entsteht (lokal) */
        var zb = r6Beginn(s, 'Die Datei entsteht', 'Ein Klick — die Sicherung wird gebaut. Im Video laden wir sie nicht herunter, wir schauen hinein.');
        _r17.klick = HTMLAnchorElement.prototype.click;
        _r17.confirm = window.confirm;
        window.confirm = function () { return true; };
        HTMLAnchorElement.prototype.click = function () {
          var dl = String(this.download || '');
          if (/\.dpkt$/.test(dl) && /^blob:/.test(this.href)) { _r17.name = dl; var h = this.href; fetch(h).then(function (r) { return r.text(); }).then(function (t) { _r17.text = t; }); return; }
          if (/\.csv$/.test(dl)) return;
          return _r17.klick.apply(this, arguments);
        };
        /* Prüflauf 17: nach dem Klick schließt das Fenster - der Kegel bekommt das Objekt in der Liste (36 Messpunkte ohne Kegel) */
        var exp = iexpDoExportJsonSingle(_r17.id);
        await warte(400); kegelHoch(false);
        zeige(function () { return q('aside.sidebar .sb-card') || q('aside.sidebar'); }, 8);
        try { await exp; } catch (e) {}
        await warteAuf(function () { return _r17.text; }, 20000);
        HTMLAnchorElement.prototype.click = _r17.klick; _r17.klick = null;
        window.confirm = _r17.confirm; _r17.confirm = null;
        await r6Ende(zb);
      },
      async function (s) {   /* 5 · was drinsteckt */
        var P = null; try { P = JSON.parse(_r17.text || 'null'); } catch (e) {}
        if (!P) { await b2oZeile(s, 'Die Datei', 'Hier steht, was in der Datei steckt.'); return; }
        kegelHoch(true);
        r17Blick(P, _r17.name || 'Sicherung.dpkt', (_r17.text || '').length);
        await warte(700);
        await zeige(function () { return q('#dpm-dpkt'); }, 6);
        var o = (P.objekte || [])[0] || {};
        await b2oZeile(s, 'Was mitgeht', 'Alle <b>' + de(Object.keys(o.daten || {}).length) + ' Eingaben</b>, Steuer, Pilot-Analyse, Ankauf-Stand — und ein Lexikon, das jedes Kürzel erklärt. Lesbar auch ohne DealPilot.');
        await b2oZeile(s, 'Was hierbleibt', 'Dein <b>Konto</b>, Abo und Kontingent, Darstellung und Standardwerte. Fotos gehen mit, solange sie angehakt sind.');
        /* v2351: die Einzelsicherung laesst das Konto-Wissen weg - die Zeile sagt jetzt das. */
        await b2oZeile(s, 'Sicher weitergeben', 'Bei einem einzelnen Objekt bleibt dein <b>Konto-Wissen</b> hier — eigene Ergänzung, Portfolio-Analyse, Lageprofil und Datenraum gehen nur mit der Sicherung <b>aller</b> Objekte mit.');
        var b = q('#dpm-dpkt'); if (b && b.parentNode) b.parentNode.removeChild(b);
      },
      async function (s) {   /* 6 · Import beim Empfänger */
        try { openImportHub(); } catch (e) {}
        await warteAuf(function () { return r17Karte(/JSON-Backup importieren|Sicherung/); }, 5000);
        await warte(500);
        await zeige(function () { return r17Karte(/JSON-Backup importieren|Sicherung/); }, 8);
        await b2oZeile(s, 'Beim Empfänger', 'Er öffnet die Datei über <b>Import</b>. Im Video importieren wir sie ins selbe Konto — gleich wieder gelöscht.');
        var vorher = DPM_REIHE.angelegt.length;
        var zb = r6Beginn(s, 'Importiert', 'Die Datei wird gelesen, das Objekt neu angelegt …');
        try { if (typeof closeIexpModal === 'function') closeIexpModal(); } catch (e) {}
        kegelHoch(false);
        zeige(function () { return q('aside.sidebar'); }, 6);
        try { await importJSON({ files: [new File([_r17.text || ''], _r17.name || 'Sicherung.dpkt', { type: 'application/json' })], value: '' }); } catch (e) {}
        await warteAuf(function () { return DPM_REIHE.angelegt.length > vorher; }, 15000);
        await warte(2500);
        await r6Ende(zb);
        var nid = DPM_REIHE.angelegt[DPM_REIHE.angelegt.length - 1];
        /* Prüflauf 17: die Karte war über ihre Kennung nicht zu finden - jetzt wird das importierte Objekt geöffnet */
        if (nid && typeof window.loadSaved === 'function') { try { await window.loadSaved(nid); } catch (e) {} }
        await warteAuf(function () { return window._currentObjKey === nid && /\S/.test(wert('str')); }, 9000);
        reiter('s0'); var mc = q('.main-col'); if (mc) mc.scrollTop = 0;
        await warte(700);
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        await b2oZeile(s, 'Ein eigenes Objekt', 'Beim Empfänger steht es als <b>eigenes Objekt</b> mit allen Eingaben und der Analyse — seine Änderungen berühren deins nicht.');
      },
      async function (s) {   /* 7 · die anderen Wege */
        await zeige(function () { return qs('.sb-act-item[onclick*="cockpit"]') || q('aside.sidebar'); }, 8);
        await b2oZeile(s, 'Und sonst', 'Mandanten eines Betreuers geben Objekte über die <b>Mandanten-Freigabe</b> frei. Ins Netzwerk reichst du ein Objekt aus der Deal-Aktion weiter — Modul 13.', 600);
      }
    ]
  };

  /* ═══ VIDEOREIHE · SPEZIALMODUL 22 · DER TELEGRAM-BOT (v2305) ══════════════
     Marcel 16.10.2026: „vlt. kannst du einfach was nachstellen, demo dummy".
     Der Bot läuft in Telegram, außerhalb der App - im Video steht deshalb
     eine NACHSTELLUNG: ein eigenes Chatfenster (kein Telegram-Logo, kein
     Bild des echten Dienstes) mit dem Vermerk „Nachgestellt · Demo“.
     Die Antworten sind ECHT: der Agent des Bots (agentLauf, dieselben
     Werkzeuge, dieselbe Datenbank) lief EINMAL im Staging-Container ohne
     Telegram-Versand (Mitschnitt DPM_REIHE_DATEN.telegram, drei Fragen in
     einem Gespräch). Das dort angelegte Objekt wurde sofort gelöscht. Im
     Lauf wird es mit denselben Angaben in der App angelegt (Kopie) und beim
     Aufräumen gelöscht. Keine Telefonnummer, kein Name, kein Chatverlauf. */
  var _r22 = null;
  function r22Zu() { var c = q('#dpm-tg'); if (c && c.parentNode) c.parentNode.removeChild(c); }
  function r22Md(t) {
    function e(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    return e(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,])/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
  }
  function r22Fenster() {
    var c = q('#dpm-tg'); if (c) return c;
    c = document.createElement('div'); c.id = 'dpm-tg';
    c.style.cssText = 'position:fixed;right:6%;top:6%;bottom:8%;width:540px;z-index:100002;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.08);background:#0f1418;font:14px/1.45 Inter,system-ui,sans-serif';
    c.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#17212b;color:#fff">'
      + '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-b8932f,#b8932f));display:flex;align-items:center;justify-content:center;color:#1c1b18;font:700 15px Space Grotesk,sans-serif">DP</div>'
      + '<div style="flex:1"><div style="font-weight:600">DealPilot-Bot</div><div style="font-size:12px;color:#8fa3b5">Bot · antwortet aus deinem Portfolio</div></div>'
      + '<div style="font:600 10.5px/1 JetBrains Mono,monospace;letter-spacing:.12em;text-transform:uppercase;color:#1c1b18;background:var(--wl-e8cc7a,#E8CC7A);padding:6px 9px;border-radius:6px">Nachgestellt · Demo</div></div>'
      + '<div id="dpm-tg-log" style="flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:10px;background:#0e1621"></div>'
      + '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#17212b"><div id="dpm-tg-in" style="flex:1;min-height:20px;color:#cfd8e0;font-size:14px;padding:8px 12px;background:#242f3d;border-radius:18px">Nachricht</div>'
      + '<div style="width:36px;height:36px;border-radius:50%;background:var(--wl-c9a84c,#C9A84C);display:flex;align-items:center;justify-content:center;color:#1c1b18;font-weight:700">➤</div></div>';
    document.body.appendChild(c);
    return c;
  }
  function r22Blase(wer, html) {
    var log = q('#dpm-tg-log'); if (!log) return null;
    var b = document.createElement('div');
    b.className = 'dpm-tg-b';
    b.style.cssText = 'max-width:86%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;'
      + (wer === 'ich' ? 'align-self:flex-end;background:#2b5278;color:#fff;border-bottom-right-radius:4px' : 'align-self:flex-start;background:#182533;color:#e9eef2;border-bottom-left-radius:4px');
    b.innerHTML = html;
    log.appendChild(b); log.scrollTop = log.scrollHeight;
    return b;
  }
  async function r22Tippen(text) {
    var i = q('#dpm-tg-in'); if (!i) return;
    for (var k = 0; k < text.length; k += 2) { i.textContent = text.slice(0, k + 2); await warte(45); }
    await warte(500); i.textContent = 'Nachricht';
    r22Blase('ich', r22Md(text));
  }
  async function r22Antwort(nr) {
    var D = window.DPM_REIHE_DATEN && DPM_REIHE_DATEN.telegram, d = D && D.dialog[nr];
    var tip = r22Blase('bot', '<span style="color:#8fa3b5">schreibt …</span>');
    await warte(1600);
    if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
    return d ? r22Blase('bot', r22Md(d.antwort)) : r22Blase('bot', '–');
  }
  DREHBUECHER['reihe-telegram'] = {
    titel: 'Der Telegram-Bot', unterzeile: 'Dein Portfolio im Chat — nachgestellt mit echten Antworten', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { r22Zu(); kegelHoch(false); rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · Einordnung */
        await rhNurStart();
        _r22 = { neu: null };
        r22Fenster(); kegelHoch(true);
        await warte(600);
        await zeige(function () { return q('#dpm-tg'); }, 6);
        await b2oZeile(s, 'Der Telegram-Bot', 'Er läuft in Telegram, nicht in der App — hier <b>nachgestellt</b>. Die Antworten sind echt: der Bot hat sie einmal mit dem Demo-Konto gegeben.');
      },
      async function (s) {   /* 2 · Objekte erfragen */
        var zb = r6Beginn(s, 'Objekte erfragen', 'Einfach schreiben, wie man fragt.');
        await r22Tippen('Welche Objekte habe ich?');
        var b = await r22Antwort(0);
        await r6Ende(zb);
        await zeige(function () { return b; }, 6);
        var t = r6Text(b), n = /aktuell (\d+) Objekte/.exec(t);
        await b2oZeile(s, 'Die Liste', (n ? '<b>' + n[1] + ' Objekte</b>' : 'Die Objekte') + ', die stärksten zuerst — mit Kaufpreis, DealScore und Investor-Score, dieselben Zahlen wie auf der Karte.');
      },
      async function (s) {   /* 3 · Steuer-Soll-Ist */
        var zb = r6Beginn(s, 'Soll gegen Ist', 'Und ein einzelnes Objekt gegen den Plan beim Kauf …');
        await r22Tippen('Wie steht die Parkstraße steuerlich gegen den Plan?');
        var b = await r22Antwort(1);
        await r6Ende(zb);
        await zeige(function () { return b; }, 6);
        var t = r6Text(b), cf = /Cashflow nach Steuer ist von ([−\-]?[\d.]+ EUR) \(Ankauf\) auf jetzt ([−\-]?[\d.]+ EUR)/.exec(t), k = /(\d+) von (\d+) vergleichbaren Kennzahlen besser/.exec(t);
        await b2oZeile(s, 'Aus dem Ankauf-Stand', (cf ? 'Cashflow nach Steuer <b>' + cf[1] + ' → ' + cf[2] + '</b>' : 'Plan gegen heute') + (k ? ', ' + k[1] + ' von ' + k[2] + ' Kennzahlen besser' : '') + ' — derselbe Soll-Ist-Vergleich wie in Modul 14.');
      },
      async function (s) {   /* 4 · ein Objekt anlegen */
        var zb = r6Beginn(s, 'Ein Objekt anlegen', 'Eine Wohnung, in einem Satz diktiert …');
        await r22Tippen('Leg mir eine Eigentumswohnung in der Musterstraße 12 in Hannover an. 85 m², vier Zimmer, zweites Obergeschoss, vermietet.');
        var b = await r22Antwort(2);
        await r6Ende(zb);
        await zeige(function () { return b; }, 6);
        await b2oZeile(s, 'Angelegt — und nachgefragt', 'Der Bot übernimmt, was gesagt wurde, und fragt nur nach dem, was fehlt: Baujahr, Kaufpreis, Postleitzahl.');
      },
      async function (s) {   /* 5 · in der App */
        var zb = r6Beginn(s, 'In der App', 'Dasselbe Objekt erscheint im Portfolio — hier als Kopie mit denselben Angaben, nach dem Video gelöscht.');
        r22Zu(); kegelHoch(false);
        zeige(function () { return q('aside.sidebar'); }, 6);   /* Prüflauf 22: ohne Ziel 34 Messpunkte ohne Kegel */
        var d = { objart: 'ETW', str: 'Musterstraße', hnr: '12', ort: 'Hannover', wfl: '85', zimmer: '4', etage: '2', vermstand: 'Vollvermietet' };
        var neu = await Auth.apiCall('/objects', { method: 'POST', body: { data: d, aiAnalysis: null, photos: [] } });
        var nid = neu && (neu.id || (neu.data && neu.data.id) || (neu.object && neu.object.id));
        if (nid && DPM_REIHE.angelegt.indexOf(nid) < 0) DPM_REIHE.angelegt.push(nid);
        if (nid && typeof window.loadSaved === 'function') await window.loadSaved(nid);
        await warteAuf(function () { return window._currentObjKey === nid && /\S/.test(wert('str')); }, 9000);
        await warte(800);
        reiter('s0'); var m = q('.main-col'); if (m) m.scrollTop = 0;
        await r6Ende(zb);
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        await b2oZeile(s, 'Im Reiter Objekt', '<b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + wert('wfl') + ' m². Der Rest kommt in der App oder im nächsten Satz an den Bot.', 600);
      }
    ]
  };

  /* ═══ MODUL 25 · DIE GEFÜHRTE EINGABE (v2371) ═══════════════════════════
     Marcel 17.10.2026: ein eigenes Video zur geführten Eingabe, Kategorie
     Erweitert. Neues Objekt -> Datenaufnahme -> Kachel „Geführte Eingabe" ->
     Frage für Frage getippt -> Zwischenstände Deal Score und Investor Deal
     Score 2.0 -> Übersicht -> Objekt mit Score. Dieselbe Wohnung wie die
     Module 02-05 (Sachsenstraße 18, 32052 Herford, ETW 100 m², Bj 1998,
     180.000 €).
     KEIN ABRUF JE DURCHGANG: die Auslese jeder Antwort (/ai/extract-text)
     ist EINMAL echt erzeugt (?messe=reihe-gefuehrt&mitschnitt=25, Ergebnis in
     DPM_REIHE.mitschnitt) und liegt in DPM_REIHE_DATEN.gefuehrt25; alles
     andere unter /ai/ und der Marktbericht sperrt RH_SPERRE. Eingabetiefe
     für den Lauf auf 1 - sonst hängt die Wertermittlung (Stufe 3) hinten an;
     rhAufraeumen stellt sie zurück. Freisprechen aus (hier wird getippt), das
     Mikrofon ist ohnehin ein stummer Strom. Das angelegte Objekt löscht
     rhAufraeumen, wie in 03-05. Jeder Antwortschritt steht in DPM_REIHE.r25.

     v2373a · NEUES BEISPIEL (Marcel 19.10.2026): ein Mehrfamilienhaus in FÜRTH, das am
     Ende im Reiter Bewertung mit Deal Score SOLIDE und Investor Deal Score GUT steht -
     sichtbar „wandert" es von der einen Stufe zur anderen. Erst Herford (v2373), dann
     Nürnberg verworfen: Fürther Str. 112 liegt in BORIS-Zone 262239, deren Wert in
     Bayern gebührenpflichtig ist (reason wert_gebuehrenpflichtig) - Marcel will den
     Bodenrichtwert-Abruf im Video ZEIGEN. Gemessen am Staging-Endpunkt
     /api/v1/marktbericht/boris?land=BY: Dambacher Straße (Fürth-Südstadt, Straßenpunkt
     49,46616 / 10,98334 - borisHolen geokodiert OHNE Hausnummer) -> 1.150 €/m²,
     Wohnbaufläche, Zone 522, Stichtag 01.01.2026.
     Die Eingaben sind VORAB mit den echten Kernen gerechnet (node + vm: deal-kpis.js
     DealKpis.compute, dealscore.js computeFromKpis, dealscore2.js compute,
     score-tiers.js; beide Wege - Zwischenstand im Chat wie voice-import
     _rfKennzahlen/_rfScore1/_rfScore2 und Reiter Bewertung wie _buildDeal2FromState;
     Profil: Makler 3,57 + Notar 1,7 + Grundbuch 0,5 + GrESt 3,5 (Bayern, die App nimmt
     sie über DealPilotGrest.forPlz aus der PLZ) = 9,27 %, Mietausfall 1 %, Gewichte ab Werk):
       6 WE, 420 m², Bj 1970, 3 VG, KP 1.000.000 (2.381 €/m²), NKM 4.410/Mon (10,50 €/m²)
       + 360 für sechs Stellplätze, BWK 22.000/J davon 10.500 nicht umlagefähig,
       EK 200.000, 3,6 % / 1,5 % / 10 J, Mietsteigerung 2,5 %, Wertsteigerung 2 %,
       Leerstand 1 %, Zustand gut, Energie C, B-Lage, Region und Straße gut, Mietausfall
       niedrig, Bevölkerung wachsend, Nachfrage sehr stark, Wertsteigerung hoch, eine
       starke Entwicklungsmöglichkeit (Dachgeschoss), Grundstück 600 m²
       -> Cashflow v. St. +57 €/Mon, NMR 4,2 %, Bruttorendite 5,7 %, LTV 89,3 %, DSCR 1,26
       -> Deal Score 64 SOLIDE (Cashflow 64, Rendite 74, LTV 52, DSCR 84, Potenzial 40)
       -> Investor Deal Score 75 (Reiter) / 76 (Chat) GUT (Rendite 52, Finanzierung 91,
          Risiko 91, Lage 83, Upside 80)
     Empfindlichkeit gerechnet: Mietsteigerung 1,5 % -> 63/75; Wertsteigerung mittel oder
     Entwicklung begrenzt -> DS2 74; alle drei zusammen -> 64/73; eigener Teil 11.000 ->
     61/75; Miete 4.300 -> 55/72; GrESt 6,5 statt 3,5 -> 52/72. KIPPT: Tilgung 2 % statt
     1,5 % -> 44/68, ohne die Stellplätze -> 40/66 - beide Auslesen im Mitschnitt prüfen.
     Im Bild steht immer, was die App rechnet (Regel 1) - die Rechnung oben ist die Wahl
     der Eingaben, nicht der Text.
     Der Mitschnitt gefuehrt25 muss zu DIESEN Antworttexten passen (Schlüssel = Text):
     nach jeder Änderung hier ?messe=reihe-gefuehrt&mitschnitt=25 neu laufen lassen. */
  var R25 = {
    adresse: 'Dambacher Straße 60, 90763 Fürth',
    art: 'Mehrfamilienhaus, 420 Quadratmeter Wohnfläche',
    details: '6 Wohneinheiten, 3 Vollgeschosse',
    bjkp: 'Baujahr 1970, Kaufpreis 1.000.000 Euro',
    miete: '4.410 Euro kalt im Monat, dazu 360 Euro für sechs Stellplätze',
    fin: '200.000 Euro Eigenkapital, 3,6 Prozent Zins, 1,5 Prozent Tilgung, 10 Jahre fest',
    einst: 'Übernimm die Werte aus den Einstellungen',
    klasse: 'B-Lage',
    lage: 'Region gut, Straße gut',
    zustand: 'Guter Zustand, Energieklasse C',
    san: 'Keine Sanierung, nichts wird mitverkauft',
    grund: '600 Quadratmeter, kein Erbbaurecht',
    bwk: '22.000 Euro im Jahr, davon 10.500 nicht umlagefähig',
    langfrist: 'Mietsteigerung 2,5 Prozent, Wertsteigerung 2 Prozent, Leerstand 1 Prozent',
    ausfall: 'Niedrig',
    ort: 'Bevölkerung wachsend, Nachfrage sehr stark, Wertsteigerung hoch, Entwicklungsmöglichkeiten: eine starke',
    weissNicht: 'Weiß ich nicht',
    sicht: 'Dafür spricht: sechs Wohnungen verteilen das Mietrisiko, das Dachgeschoss lässt sich ausbauen. Das Risiko: das Dach von 1970'
  };
  /* v2373 · v2369 stellt das Abruf-Angebot (Marktpreisindikation, Bodenrichtwert,
     Lage) als Auswahl-Blase IN DEN CHAT (.vi-rf-abruf, Knöpfe .vi-rf-abruf-b[data-akt]).
     Gewählt wird hier NUR „Nein, überspringen" (data-akt="ueberspringen") - jeder
     andere Knopf wäre ein Abruf. Beim ersten Mal mit einer Zeile, danach still. */
  var _r25s = null, _r25AbrufGesagt = 0;
  function r25AbrufBlase() { var e = q('#vi-rf-chat .vi-rf-abruf'); return e && e.offsetWidth ? e : null; }
  async function r25AbrufWeg() {
    var b = r25AbrufBlase(); if (!b || !b.querySelector('.vi-rf-abruf-b[data-akt="ueberspringen"]')) return false;
    var kn = [].map.call(b.querySelectorAll('.vi-rf-abruf-b'), function (x) { return x.getAttribute('data-akt') === 'ueberspringen' ? '' : ((x.firstChild && x.firstChild.nodeType === 3 ? x.firstChild.textContent : x.textContent) || '').trim(); }).filter(Boolean);
    if (!_r25AbrufGesagt && _r25s) {
      _r25AbrufGesagt = 1;
      await zeige(r25AbrufBlase, 8);
      await b2oZeile(_r25s, 'Auf Wunsch abrufen', 'Was DealPilot selbst holen kann, bietet es im Chat an' + (kn.length ? ' — <b>' + kn.join(' · ') + '</b>' : '') + '. Hier: <b>„Nein, überspringen“</b>.');
    }
    var n = r25AbrufBlase(), k = n && n.querySelector('.vi-rf-abruf-b[data-akt="ueberspringen"]');
    DPM_REIHE.r25abruf = (DPM_REIHE.r25abruf || []).concat([{ angebot: kn, geklickt: k ? 'ueberspringen' : null, frage: r25Frage().slice(0, 60) }]);
    if (k) k.click();
    await warte(900);
    return !!k;
  }
  function r25Frage() { var e = q('#oabi-ov .vi-rf-frage-txt'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function r25Bereich() { return b2oHuelle(q('#vi-rf-frage'), q('#oabi-ov .vi-rf-zeile')); }
  function r25Uebersicht() { return [].filter.call(document.querySelectorAll('#oabi-ov button'), function (x) { return x.offsetWidth && /Zur Übersicht/.test(x.textContent); })[0] || null; }
  function r25Karte(re) {
    var k = [].filter.call(document.querySelectorAll('#vi-rf-chat .vi-rf-blase'), function (b) { return b.querySelector('.vi-sc') && re.test(b.textContent); });
    return k[k.length - 1] || null;
  }
  function r25Score(b) {
    var n = b && b.querySelector('.vi-sc-zahl-n'), p = b && b.querySelector('.vi-sc-pille');
    var z = n ? parseInt(n.getAttribute('data-ziel'), 10) : NaN;
    return isFinite(z) ? { n: z, wort: p ? p.textContent.trim() : '' } : null;
  }
  function r25StandZeile(re) {
    var s = q('#vi-rf-stand'); if (!s) return null;
    var e = [].filter.call(s.querySelectorAll('*'), function (x) { return x.offsetWidth && x.children.length >= 2 && re.test(x.textContent) && x.textContent.length < 90; });
    e.sort(function (a, b) { return a.textContent.length - b.textContent.length; });
    return e[0] || null;
  }
  /* eine Antwort tippen, abschicken und warten, bis die NÄCHSTE Frage steht
     (Messhinweis: nach Adresse, Basis und Lage kommen Zwischenstände -
     erst weiter, wenn sich die Frage wirklich geändert hat) */
  async function r25Antwort(text, bisUebersicht) {
    /* v2373 · ein offenes Abruf-Angebot im Chat zuerst ausdrücklich überspringen (v2369, v2368:
       sonst kann eine getippte Antwort beim Angebot statt bei der Frage landen) */
    if (r25AbrufBlase()) { await r25AbrufWeg(); await zeige(r25Bereich, 6); }
    var f0 = r25Frage(), inp = q('#vi-rf-in'), t0 = Date.now();
    if (!inp) { DPM_REIHE.r25 = (DPM_REIHE.r25 || []).concat([{ antwort: text, fehler: 'kein Eingabefeld' }]); return false; }
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
    for (var i = 0; i < text.length; i++) { inp.value = text.slice(0, i + 1); inp.dispatchEvent(new Event('input', { bubbles: true })); await warte(55); }
    await warte(450);
    var ok = q('#vi-rf-ok'); if (ok) ok.click();
    await warte(500);
    var weiter = await warteAuf(function () {
      if (typeof bisUebersicht === 'function') return bisUebersicht();
      if (bisUebersicht) return r25Uebersicht();
      var f = r25Frage(), e = q('#vi-rf-in');
      return f && f !== f0 && e && !e.disabled;
    }, 20000);
    DPM_REIHE.r25 = (DPM_REIHE.r25 || []).concat([{ antwort: text, vorher: f0.slice(0, 60), nachher: (bisUebersicht === true ? 'Übersicht' : r25Frage().slice(0, 60)), ok: !!weiter, ms: Date.now() - t0 }]);
    await warte(650);
    return !!weiter;
  }
  /* mehrere Antworten am Stück, der Kegel auf Frage, Verlauf und Eingabe */
  async function r25Reihe(liste) { for (var i = 0; i < liste.length; i++) { await zeige(r25Bereich, 6); await r25Antwort(liste[i]); } }
  DREHBUECHER['reihe-gefuehrt'] = {
    titel: 'Die geführte Eingabe', unterzeile: 'Ein Mehrfamilienhaus, Frage für Frage — bis zu Deal Score und Investor Deal Score', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: rhAufraeumen,
    /* v2373 · jede Szene meldet ihr s an r25AbrufWeg (die Zeile zum Abruf-Angebot) */
    szenen: [
      async function (s) {   /* 1 · neues Objekt, die Kachel */
        await rhStart(0);
        _rh.gef25 = 1; _rh.stumm = 1; _r25AbrufGesagt = 0;
        try { _rh.mitschnitt = new URLSearchParams(location.search).get('mitschnitt') === '25'; } catch (e) {}
        /* v2373a · Geokodierung für den Bodenrichtwert-Abruf aus dem Mitschnitt (nie im Mitschnitt-Lauf selbst) */
        if (!_rh.mitschnitt && window.DPM_REIHE_DATEN && DPM_REIHE_DATEN.gefuehrt25geo) _rh.geo = JSON.parse(JSON.stringify(DPM_REIHE_DATEN.gefuehrt25geo));
        try { DealPilotObjektReiter.zielSetzen(1); } catch (e) {}
        await zeige(function () { return q('#oab-bar'); }, 8);
        await b2oZeile(s, 'Ein neues Objekt', 'Leer angelegt. Oben im Reiter Objekt die Datenaufnahme — einer der Wege ist die <b>' + rhNameKachel('gefuehrt') + '</b>.');
        rhNur(['gefuehrt']);
        await zeige(function () { return b2oHuelle(rhKachel('gefuehrt')(), q('#oab-run')); }, 8);
        await b2oZeile(s, 'Anhaken, Abrufen', 'Kachel anhaken, <b>Abrufen</b> — der Co-Pilot übernimmt das Fragen.');
      },
      async function (s) {   /* 2 · der Fahrplan */
        var r = q('#oab-run'); if (r) r.click();
        await warteAuf(function () { return q('#oabi-ov #vi-rf-in'); }, 6000);
        kegelHoch(true);
        /* hier wird getippt: Freisprechen aus (der Schalter ist versteckt, gelesen wird er weiter) */
        var fs = q('#vi-rf-fs'); if (fs && fs.checked) { fs.checked = false; fs.dispatchEvent(new Event('change', { bubbles: true })); }
        await warte(900);
        var b1 = rhIm('#vi-rf-chat', /\d+\s*Fragen in\s*\d+\s*Etappen/), t1 = b1 ? b1.textContent : '';
        var m = /(\d+)\s*Fragen in\s*(\d+)\s*Etappen:?\s*([^.]+)\./.exec(t1);
        await zeige(function () { var e = rhIm('#vi-rf-chat', /Fragen in\s*\d+\s*Etappen/); return e && e.closest('.vi-rf-blase'); }, 8);
        await b2oZeile(s, 'Der Fahrplan', m ? '<b>' + m[1] + ' Fragen in ' + m[2] + ' Etappen</b>: ' + m[3].trim() + '.' : 'Frage für Frage, in Etappen.');
        await zeige(function () { return q('#vi-rf-stand'); }, 6);
        await b2oZeile(s, 'Was schon steht', 'Rechts die Liste — sie füllt sich mit jeder Antwort. Sprechen geht genauso, hier wird getippt.');
      },
      async function (s) {   /* 3 · Adresse */
        await zeige(r25Bereich, 6);
        var zb = r6Beginn(s, 'Frage 1 · Adresse', 'Straße, Hausnummer, PLZ und Ort — in einem Satz.');
        /* v2372 · GEMESSEN: nach der Adresse bleibt die Frage stehen (Rückfrage „Stimmt das so?") -
           auf die nächste Frage zu warten kostete 20 s Stillstand im Bild. Gewartet wird auf die Rückfrage. */
        var bl = function () { var e = rhIm('#vi-rf-chat', /Ich habe verstanden/); return e && e.closest('.vi-rf-blase'); };
        await r25Antwort(R25.adresse, bl);
        await r6Ende(zb);
        await zeige(bl, 8);
        /* v2372 · das Land steht in .vi-rf-zaehler; der Text der ganzen Blase klebt Ort und Land
           ohne Leerzeichen aneinander (gemessen: „HerfordNordrhein-W…") */
        var bz = bl() && bl().querySelector('.vi-rf-zaehler'), bt = bz ? bz.textContent.replace(/\s+/g, ' ').trim() : '', gr = /^(.+?)\s*·\s*Grunderwerbsteuer\s*([\d,]+\s*%)/.exec(bt);
        await b2oZeile(s, 'Frage 1 · Adresse', 'DealPilot wiederholt, was es verstanden hat' + (gr ? ' — und kennt schon das Land: <b>' + gr[1] + ', Grunderwerbsteuer ' + gr[2] + '</b>' : '') + '. Ein „ja", und weiter.');
        await zeige(r25Bereich, 6);
        await r25Antwort('ja');
      },
      async function (s) {   /* 4 · Art, Größe, Details */
        /* v2388 · GEMESSEN: das Abruf-Angebot erscheint erst nach der Adress-Bestätigung - die
           Kapitelzeile „Objekt und Größe" stand nur 1 s, dann kam „Auf Wunsch abrufen". Erst das
           Angebot erledigen, dann die Frage. */
        await warteAuf(r25AbrufBlase, 2500);
        if (r25AbrufBlase()) await r25AbrufWeg();
        await zeige(r25Bereich, 6);
        var zb = r6Beginn(s, 'Objekt und Größe', 'Art und Wohnfläche …');
        await r25Antwort(R25.art);
        await r6Ende(zb);
        var f = r25Frage();
        /* v2372c · GEMESSEN: #vi-rf-frage ist hier ausgeblendet (der Streifen erscheint erst, wenn die
           Frage aus dem Verlauf gescrollt ist) - der Kegel blieb unsichtbar. Dann die letzte Co-Pilot-Blase. */
        await zeige(function () { var e = q('#vi-rf-frage'); if (e && e.offsetWidth) return e; var b = document.querySelectorAll('#vi-rf-chat .vi-rf-blase.vi-rf-co'); return b[b.length - 1] || null; }, 8);
        await b2oZeile(s, 'Die Art bestimmt die Fragen', 'Ein Mehrfamilienhaus — also fragt DealPilot nach: <b>' + f.replace(/^Und noch zum Objekt:\s*/, '') + '</b>');
        await r25Reihe([R25.details, R25.bjkp]);
      },
      async function (s) {   /* 5 · Miete -> Deal Score */
        await zeige(r25Bereich, 6);
        var zb = r6Beginn(s, 'Die Miete', 'Kaltmiete und Zusatzeinnahmen im Monat …');
        await r25Antwort(R25.miete);
        await r6Ende(zb);
        var k = function () { return r25Karte(/Deal Score\s*·\s*Zwischenstand/i); };
        await warteAuf(k, 4000);
        await warte(1200);
        await zeige(k, 6);
        var sc = r25Score(k()), kt = (k() || {}).textContent || '', cf = /Cashflow\s*([−\-+]?[\d.]+\s*€\/Mon)/.exec(kt);
        await b2oZeile(s, 'Erster Zwischenstand', 'Nach der Basis schon der <b>Deal Score' + (sc ? ': ' + sc.n + ' · ' + sc.wort : '') + '</b>' + (cf ? ', Cashflow ' + cf[1].replace(/\s+/g, ' ') : '') + '. Was noch fehlt, schätzt DealPilot — und sagt dazu, was.', 1500);
      },
      async function (s) {   /* 6 · Geld */
        await zeige(r25Bereich, 6);
        var zb = r6Beginn(s, 'Etappe 2 · Geld', 'Eigenkapital, Zins, Tilgung, Zinsbindung — in einem Satz.');
        await r25Antwort(R25.fin);
        await r6Ende(zb);
        /* v2372 · GEMESSEN: der Vorschlag steht in der Blase im Verlauf (.vi-rf-vorschlag),
           #vi-rf-frage trägt nur den Fragetext (_rfFrageAnheften) - die Summe fiel weg */
        var nkv = function () { var a = [].filter.call(document.querySelectorAll('#vi-rf-chat .vi-rf-vorschlag'), function (x) { return x.offsetWidth && /Notar|Grunderwerbsteuer/.test(x.textContent); }); return a[a.length - 1] || null; };
        var h = function () { var e = nkv(); return (e && (e.closest('.vi-rf-blase') || e)) || q('#vi-rf-frage'); };
        await zeige(h, 8);
        var ht = (nkv() || {}).textContent || '', z = /zusammen\s*([\d.]+\s*€)\s*\(([\d,]+\s*%)\)/.exec(ht);
        await b2oZeile(s, 'Aus deinen Einstellungen', 'Was du hinterlegt hast, schlägt DealPilot vor — die Kaufnebenkosten' + (z ? ', zusammen <b>' + z[1] + ' (' + z[2] + ')</b>' : '') + '. Ein Satz übernimmt sie.');
        await zeige(r25Bereich, 6);
        await r25Antwort(R25.einst);
      },
      async function (s) {   /* 7 · Lage & Zustand */
        await zeige(r25Bereich, 6);
        var zb = r6Beginn(s, 'Etappe 3 · Lage & Zustand', 'Lageklasse, Lage, Zustand, Sanierung, Grundstück — Auswahlfragen gehen auch per Klick.');
        await r25Antwort(R25.klasse);
        await r25Antwort(R25.lage);
        await r6Ende(zb);
        await r25Reihe([R25.zustand, R25.san]);
        /* v2373a · Marcel: der Bodenrichtwert-Abruf wird GEZEIGT (frei, BORIS Bayern liefert in
           Fürth den Wert). Gewählt wird nur der Knopf data-akt="brw"; Markt und Lage bleiben
           übersprungen (r25AbrufWeg). Ergebnis und Fehler stehen in DPM_REIHE.r25brw. */
        var bk = function () { var b = r25AbrufBlase(), k = b && b.querySelector('.vi-rf-abruf-b[data-akt="brw"]'); return k && k.offsetWidth ? k : null; };
        await warteAuf(bk, 5000);
        if (bk()) {
          var kl = ((bk().firstChild && bk().firstChild.nodeType === 3 ? bk().firstChild.textContent : bk().textContent) || '').trim();
          await zeige(r25AbrufBlase, 8);
          await b2oZeile(s, 'Der Bodenrichtwert', 'Beim Grundstück bietet DealPilot den amtlichen Bodenrichtwert an — aus BORIS, ohne Kosten. Ein Klick auf <b>„' + kl + '“</b>.');
          var bkn = bk(); if (bkn) bkn.click();
          var bw = function () { var e = rhIm('#vi-rf-chat', /amtlicher Bodenrichtwert/); return e && e.closest('.vi-rf-blase'); };
          var bf = function () { var e = rhIm('#vi-rf-chat', /Abruf (hat nichts geliefert|ist fehlgeschlagen)/); return e && e.closest('.vi-rf-blase'); };
          await warteAuf(function () { return bw() || bf(); }, 15000);
          var bt = (bw() || {}).textContent || '', bm = /([\d.,]+)\s*€\/m²/.exec(bt), bh = /(BORIS[^\n]*?)(?:Herkunft|$)/.exec(bt.replace(/\s+/g, ' '));
          DPM_REIHE.r25brw = { ok: !!bw(), text: (bw() || bf() || {}).textContent ? String((bw() || bf()).textContent).replace(/\s+/g, ' ').slice(0, 160) : null };
          if (bw()) {
            await zeige(bw, 8);
            await b2oZeile(s, 'Amtlich, mit Herkunft', (bm ? '<b>' + bm[1] + ' €/m²</b>' : 'Der Bodenrichtwert') + (bh ? ' — ' + bh[1].trim() : '') + '. Den Wert holt DealPilot, die Fläche sagst du.');
          }
        }
        await zeige(r25Bereich, 6);
        await r25Antwort(R25.grund);
      },
      async function (s) {   /* 8 · Investor Deal Score 2.0 */
        var k = function () { return r25Karte(/Investor Deal Score 2\.0/i); };
        await warteAuf(k, 4000);
        await warte(1200);
        await zeige(k, 6);
        var sc = r25Score(k());
        await b2oZeile(s, 'Investor Deal Score 2.0', 'Mit Lage und Zustand wird aus der Rechnung eine Einschätzung' + (sc ? ': <b>' + sc.n + ' · ' + sc.wort + '</b>' : '') + ' — derselbe Score wie in der Pilot-Analyse.');
        var hb = function () { var c = k(), e = c && rhIm(c, /Was den Score hebt/i); return e && (e.parentElement || e); };
        var he = hb(), ht = he ? he.textContent.replace(/\s+/g, ' ') : '', h1 = /([+]\d+)\s*([^()]+\([^)]+\))/.exec(ht);
        await zeige(hb, 6);
        await b2oZeile(s, 'Was den Score hebt', 'Dazu die Hebel' + (h1 ? ' — der erste: <b>' + h1[2].trim() + '</b>, ' + h1[1] + ' Punkte' : '') + '.');
      },
      async function (s) {   /* 9 · Feinschliff */
        await zeige(r25Bereich, 6);
        /* v2373 · Mehrfamilienhaus: kein Hausgeld, sondern die Bewirtschaftungskosten im Jahr
           (_rfNachArt fragt beim MFH „wie viel davon ist nicht umlagefähig") */
        var zb = r6Beginn(s, 'Etappe 4 · Feinschliff', 'Die Bewirtschaftungskosten im Jahr — und wie viel davon nicht umlagefähig ist.');
        await r25Antwort(R25.bwk);
        await r6Ende(zb);
        var HZ = /^\s*✓?\s*(Hausgeld|Bewirtschaftung\w*)/;
        var hz = function () { return r25StandZeile(HZ); };
        await zeige(function () { return hz() || q('#vi-rf-stand'); }, 8);
        /* seit v2368 trägt die Liste die Einheit selbst - der Wert wird so gezeigt, wie er dort steht */
        var hw = hz(), hv = hw ? hw.textContent.replace(/\s+/g, ' ').replace(HZ, '').trim() : '';
        await b2oZeile(s, 'Umlagefähig und eigener Teil', 'Gesagt sind die Summe und der eigene Teil — in der Liste stehen beide Seiten getrennt' + (hv ? ': <b>' + hv + '</b>' : '') + '. In den Cashflow geht nur der nicht umlagefähige Teil.');
        /* v2388 · GEMESSEN: ohne eigene Zeile stand „Umlagefähig und eigener Teil" 40 s über drei
           ganz anderen Antworten */
        await zeige(r25Bereich, 6);
        var zb1 = r6Beginn(s, 'Annahmen und Standort', 'Mietsteigerung, Wertsteigerung, Leerstand, Mietausfall — und wie sich der Ort entwickelt.');
        await r25Reihe([R25.langfrist, R25.ausfall, R25.ort]);
        await r6Ende(zb1);
        await zeige(r25Bereich, 6);
        var zb2 = r6Beginn(s, 'Überspringen', '„Weiß ich nicht" — und es geht weiter. Erfunden wird nichts.');
        await r25Antwort(R25.weissNicht);
        await r6Ende(zb2);
        await r25Reihe([R25.einst]);
      },
      async function (s) {   /* 10 · deine Sicht, Ende der Fragen */
        await zeige(r25Bereich, 6);
        var zb = r6Beginn(s, 'Etappe 5 · Deine Sicht', 'Warum dieses Objekt, was könnte schiefgehen — in deinen Worten.');
        /* v2372 · GEMESSEN (18.10.): nach der letzten Pflichtfrage bietet der Co-Pilot erst die
           Feinheiten an (_rfTiefeAnbieten, v1282) - „Zur Übersicht" kommt erst nach einem „Nein".
           Vorher wartete das Drehbuch auf den Knopf, die Übersicht blieb leer, nichts kam ins Objekt. */
        var fb = function () { var e = rhIm('#vi-rf-chat', /Feinheiten auch noch/); return e && (e.closest('.vi-rf-blase') || e); };
        await r25Antwort(R25.sicht, function () { return fb() || r25Uebersicht(); });
        await r6Ende(zb);
        await zeige(function () { return q('#vi-rf-stand'); }, 6);
        var kopf = (q('#vi-rf-stand .vi-rf-stand-kopf') || {}).textContent || '', n = /(\d+)\s*\/\s*(\d+)/.exec(kopf);
        await b2oZeile(s, 'Alle Fragen durch', (n ? '<b>' + n[1] + ' von ' + n[2] + '</b> Angaben stehen' : 'Die Liste steht') + ' — abgehakt, was gesagt ist; übersprungen bleibt offen.');
        if (fb() && !r25Uebersicht()) {
          await zeige(fb, 8);
          var fm = /(\d+)\s*weitere Angaben\s*in\s*(\d+)\s*Fragen/.exec(fb().textContent || '');
          /* v2372b · GEMESSEN im Aufnahmelauf: ein getipptes „Nein" ging an das noch offene
             Markt-Angebot („Nein, überspringen" - „ich hole nichts"), die Feinheiten-Frage blieb
             stehen. Deshalb der Knopf oben: _rfFertig(true), ausdrücklich beendet. */
          var fe = function () { var e = q('#vi-rf-ende'); return e && e.offsetWidth ? e : null; };
          await b2oZeile(s, 'Feinheiten nach Wahl', 'Auf Wunsch geht es weiter ins Detail' + (fm ? ' — <b>' + fm[1] + ' Angaben in ' + fm[2] + ' Fragen</b>' : '') + '. Für heute reicht das Wichtigste.');
          if (fe()) {
            await zeige(fe, 8);
            await b2oZeile(s, 'Fertig', 'Ein Klick auf <b>„' + fe().textContent.trim() + '“</b>: die Feinheiten bleiben für später.');
            var fk = fe(); if (fk) fk.click();
            await warteAuf(r25Uebersicht, 8000);
            await warte(900);
          }
        }
      },
      async function (s) {   /* 11 · die Übersicht */
        await zeige(r25Uebersicht, 8);
        s.zeile('Zur Übersicht', 'Ein Klick — und alles steht in einer Tabelle.');
        await warte(2600);
        var u = r25Uebersicht(); if (u) u.click();
        await warteAuf(function () { return q('#oabi-ov #oabi-result tr'); }, 6000);
        await warte(800);
        var zeilen = function () { return [].filter.call(document.querySelectorAll('#oabi-ov #oabi-result tr'), function (x) { return x.offsetWidth && x.querySelector('input[type=checkbox]'); }); };
        await zeige(function () { return q('#oabi-ov #oabi-result') || q('#oabi-ov .oabi-modal'); }, 6);
        await b2oZeile(s, 'Die Übersicht', '<b>' + zeilen().length + ' Werte</b>, jeder mit Herkunft — gesagt oder aus deinen Einstellungen. Du entscheidest, was ins Objekt geht.');
        /* v2374 · GEMESSEN im Mitschnitt-Lauf Fürth: nicht vorgehakt waren SIEBEN Werte -
           Grunderwerbsteuer 3,5 (Objekt 6,5), Miet-/Wertsteigerung, Leerstand, AfA, Grenzsteuersatz,
           Zins. Nur Zins/Tilgung anzuhaken liess die bayerische GrESt und die gesagten Annahmen
           draussen - der Reiter Bewertung rechnete mit 12,27 % Nebenkosten. Angehakt wird alles. */
        var ab = function () { return zeilen().filter(function (x) { return !x.querySelector('input[type=checkbox]').checked; }); };
        var a = ab();
        DPM_REIHE.r25ab = zeilen().filter(function (x) { return !x.querySelector('input[type=checkbox]').checked; }).map(function (x) { return x.textContent.replace(/\s+/g, ' ').trim().slice(0, 80); });
        if (a.length) {
          var a0 = a[0], a1 = a[a.length - 1];
          /* v2372c · GEMESSEN: die Zeilen lagen unter dem Rand (Kegel bei y 1203) - erst in die Mitte holen */
          try { a0.scrollIntoView({ block: 'center' }); } catch (e) {}
          await warte(300);
          await zeige(function () { return b2oHuelle(a0, a1); }, 6);
          var anm = a.map(function (x) { return String(x.textContent || '').replace(/\s+/g, ' ').trim().split(/\s*(?:%|in Prozent|im Objekt)/)[0].trim(); }).filter(Boolean);
          await b2oZeile(s, 'Abweichungen', 'Was vom Objekt abweicht, ist nicht vorgehakt — hier ' + (a.length === 1 ? 'ein Wert' : a.length + ' Werte') + (anm.length ? ', darunter <b>' + anm.slice(0, 3).join(', ') + '</b>' : '') + '. Gesagt ist gesagt: anhaken.');
          a.forEach(function (x) { var c = x.querySelector('input[type=checkbox]'); if (c && !c.checked) c.click(); });
          await warte(1400);
        }
        await zeige(function () { return q('#oabi-apply'); }, 8);
        s.zeile('Übernehmen', '<b>' + (((q('#oabi-apply') || {}).textContent || 'Übernehmen').trim()) + '</b> — die Werte gehen ins Objekt.');
        await warte(3200);
        var ap = q('#oabi-apply'); if (ap) ap.click();
        kegelHoch(false);
        await warteAuf(function () { var o = q('#oabi-ov'); return !o || !o.offsetWidth; }, 8000);
        await warte(1500);
      },
      async function (s) {   /* 12 · das Objekt im Reiter Objekt */
        /* v2373 · erst das Objekt, dann (Szene 13) der Reiter Bewertung - das Video endet dort */
        reiter('s0'); var m = q('.main-col'); if (m) m.scrollTop = 0;
        await warte(900);
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var we = wert('einheiten');
        await b2oZeile(s, 'Im Reiter Objekt', '<b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — ' + (we ? we + ' Wohnungen, ' : '') + wert('wfl') + ' m², Baujahr ' + wert('baujahr') + '. Miete, Finanzierung und Bewirtschaftung stehen in ihren Reitern.', 600);
      },
      async function (s) {   /* 13 · Reiter Bewertung: zwei Scores, zwei Gewichtungen */
        /* v2373 · Marcel 19.10.2026: das Video endet im Reiter Bewertung, beide Scores groß im
           Bild, und eine sachliche Szene, warum dasselbe Objekt einmal SOLIDE und einmal GUT ist.
           Alle Zahlen aus den Karten (r12Kopf, r12Teile) - Gewichte eingeschlossen. */
        reiter('s6'); await warte(1300);
        await warteAuf(function () { return r12Karte(1)() && r12Kopf(1).score; }, 8000);
        await warte(600);
        /* v2388 · GEMESSEN im Prüflauf (Studio, 653 px App-Höhe): die beiden Köpfe (.dpsh-mainrow,
           mit allen fünf Balken) sind zusammen höher als das Bild - der Ring des Deal Score lag
           oben ausserhalb, die Zahl 60 war in „Zwei Scores" nicht zu sehen. Jetzt je Score der
           Ring (.dpsh-colring: Ring + Stufe) einzeln; zusammen nur, wenn beide ins Bild passen. */
        var ring = function (i) { return function () { var k = r12Karte(i)(); return k && (k.querySelector('.dpsh-colring') || k.querySelector('.dpsh-mainrow') || k.querySelector('.dpsh-headrow')); }; };
        var passt = function (fa, fb) { var x = fa(), y = fb(); if (!x || !y) return false; var ra = rect(x), rb = rect(y); return Math.max(ra.bottom, rb.bottom) - Math.min(ra.top, rb.top) <= innerHeight - unten() - 70 - 24; };
        var a = r12Kopf(0), b = r12Kopf(1), t1 = r12Teile(0), t2 = r12Teile(1);
        DPM_REIHE.r25scores = { deal: a, investor: b, passt: passt(ring(0), ring(1)) };
        await zeige(ring(0), 10);
        await b2oZeile(s, 'Der Deal Score', 'Deal Score <b>' + (a.score || '–') + ' · ' + r12Wort(a.wort) + '</b> — gerechnet aus ' + (t1.length || 'den') + ' Kennzahlen des Objekts.', 800);
        var such = function (t, re) { return t.filter(function (x) { return re.test(x.name); })[0] || null; };
        var cf = such(t1, /^Cashflow/i), nr = such(t1, /Rendite/i);
        var balken = function (i) { return function () { var k = r12Karte(i)(), bb = k && k.querySelectorAll('.dpsh-cbar'); return bb && bb.length ? b2oHuelle(bb[0], bb[bb.length - 1]) : null; }; };
        await zeige(balken(0), 8);
        var gw = function (x) { return x && x.gewicht ? ' (' + x.gewicht + ')' : ''; };
        /* v2374 · GEMESSEN im Demo-Konto: die Gewichte sind dort NICHT die ab Werk (30/25/15/15/15),
           sondern 20/22/14/14/30 - Potenzial wiegt am meisten. „Vor allem Cashflow und Rendite"
           sagt die Zeile deshalb nur, wenn die beiden wirklich vorn liegen; sonst alle fünf. */
        var gn = function (x) { var m = /([\d,.]+)/.exec((x && x.gewicht) || ''); return m ? parseFloat(m[1].replace(',', '.')) : 0; };
        var vorn = t1.slice().sort(function (p, q2) { return gn(q2) - gn(p); }).slice(0, 2);
        var cfNr = cf && nr && vorn.indexOf(cf) >= 0 && vorn.indexOf(nr) >= 0;
        await b2oZeile(s, 'Seine Gewichte', cfNr
          ? 'Er schaut vor allem auf <b>Cashflow' + gw(cf) + '</b> und <b>Nettorendite' + gw(nr) + '</b> — hier ' + cf.note + ' und ' + nr.note + ' von 100 Punkten.'
          : 'Fünf Kennzahlen, deine Gewichte: ' + t1.map(function (x) { return x.name.replace(/\s*\(.*\)$/, '') + ' ' + x.gewicht + ': <b>' + x.note + '</b>'; }).join(' · ') + '.');
        var weitere = ['Finanzierung', 'Risiko', 'Lage', 'Upside'].map(function (nm) { var x = such(t2, new RegExp('^' + nm, 'i')); return x ? nm + ' <b>' + x.note + '</b>' : nm; });
        await zeige(ring(1), 10);
        await b2oZeile(s, 'Der Investor Deal Score', 'Investor Deal Score <b>' + (b.score || '–') + ' · ' + r12Wort(b.wort) + '</b> — dasselbe Objekt, andere Gewichtung.', 800);
        await zeige(balken(1), 8);
        await b2oZeile(s, 'Was er zusätzlich bewertet', 'Neben der Rendite auch Finanzierung, Risiko, Lage und Upside — hier ' + weitere.join(' · ') + '.');
        /* beide Zahlen zum Schluss: zusammen, wenn sie ins Bild passen - sonst Urteil des Deal Score
           (Stufe in der Zeile darunter) und der Ring des Investor Deal Score */
        if (passt(ring(0), ring(1))) await zeigeGruppe(ring(0), ring(1), 10);
        else await zeigeGruppe(function () { var k = r12Karte(0)(); return k && (k.querySelector('.dpsh-verdictbar') || k.querySelector('.dpsh-statstrip')); }, ring(1), 10);
        await b2oZeile(s, 'Von ' + r12Wort(a.wort) + ' zu ' + r12Wort(b.wort), 'Gleiche Zahlen, andere Gewichte: <b>' + (a.score || '–') + '</b> im Deal Score, <b>' + (b.score || '–') + '</b> im Investor Deal Score.', 1500);
      }
    ].map(function (f) { return function (s) { _r25s = s; return f(s); }; })
  };

  /* ═══ VIDEOREIHE · MODUL 26 · MIETERHÖHUNG UND ZIELBILD (v2480) ═════════
     Marcel 20.10.2026: „Ein Video mit einem Mehrfamilienhaus, und auch die
     einzelnen Einheiten mit allem eingetragen, mit Soll und Zielbild, und auch
     die Übernahme in Miete gezeigt, sowie in der Pilot-Analyse das Zielbild."
     Ein ERFUNDENES Haus (R26), „Neues Objekt", beim Aufräumen gelöscht (auch bei Esc).
     KEIN ABRUF JE DURCHGANG, zwei Mitschnitte (DPM_REIHE_DATEN.zielbild26):
       potenzial[schluessel]  POST /marktbericht/potenzial (Ertragswert je Stufe;
                              der Dienst geokodiert - ein bezahlter Dienst). Schlüssel =
                              Varianten + Wohnungen + Aufteilung des Auftrags, ohne die
                              Objektkennung (die ist je Lauf neu).
       analyse                POST /ai/analyze, EINMAL echt (Marcel: ein echter Abruf).
     Erzeugt im Mitschnitt-Lauf ?messe=reihe-zielbild&mitschnitt=26: nur diese beiden
     gehen dann echt hinaus und landen in DPM_REIHE.mitschnitt26. Nach jeder Änderung an
     R26 oder an den Eingaben der Szenen neu erzeugen - sonst passt er nicht zum Endstand.
     v2481p · ?mitschnitt=26ki: NUR /ai/analyze geht echt hinaus, Ertragswerte und Marktpreise
     kommen aus dem vorhandenen Mitschnitt (für Änderungen, die nur den Analyse-Auftrag berühren,
     z. B. das Kaufdatum: es reist nicht im Auftrag an /marktbericht/potenzial mit).
     Gezeigt wird ein PDF (Bankfassung, lokal erzeugt, Nutzungszähler gesperrt). */
  var R26 = {
    kuerzel: 'DEMO Zielbild MFH', str: 'Teutoburger Straße', hnr: '60', plz: '33604', ort: 'Bielefeld',
    baujahr: '1962', gsfl: '640', kp: '505000', etagen: '3', zbJahr: '2028',
    /* v2481p · Marcel 20.10.2026: ein Kaufdatum, damit die Pilot-Tafel „Ankauf 2025 · Bestand heute ·
       Mieterhöhung · Zielbild 2028" zeigt. GEMESSEN (potenzial.js tafelHtml): das Jahr über „Bestand"
       kommt aus #kaufdat, die Spalte „Ankauf" aber nur aus einem festgeschriebenen Ankauf-Stand
       (DealPilotAnkauf.stand(), nur bei gewonnen) - deshalb nach dem Übernehmen gewonnen + festgeschrieben. */
    kaufdat: '2025-01-01',
    /* nr, lage, wfl, zimmer, ist (leer = ''), status - Marcel 20.10.2026: eine DEUTLICHE Entwicklung,
       Ist 5,90-6,40 EUR/m2 (an der unteren Kante des Marktueblichkeitsbands, klar unter der Vergleichsmiete; die Kappung fuehrt auf 6,8-7,4), letzte Erhoehungen lange her */
    we: [['1', 'EG links', '68', '3', '408', 'vermietet'], ['2', 'EG rechts', '58', '2', '360', 'vermietet'],
         ['3', '1. OG links', '68', '3', '435', 'vermietet'], ['4', '1. OG rechts', '58', '2', '342', 'vermietet'],
         ['5', '2. OG links', '68', '3', '', 'leer'], ['6', '2. OG rechts', '58', '2', '365', 'vermietet']],
    /* Mietvertrag und Plan je Wohnung (Index in we) */
    plan: {
      0: { mv_art: 'unbefristet', mv_beginn: '2012-04-01', mv_letzte_erhoehung: '2019-04-01', vgl_qm: '7,80',
           mass: [['bad', '14000'], ['boeden', '6000']], ziel_qm: '9,50', ziel_wann: 'bei Mieterwechsel' },
      1: { mv_art: 'unbefristet', mv_beginn: '2015-09-01', mv_letzte_erhoehung: '2020-02-01', vgl_qm: '8,20',
           mass: [['fenster', '5500'], ['bad', '12000']], ziel_qm: '10,00', ziel_wann: 'bei Mieterwechsel' },
      2: { mv_art: 'unbefristet', mv_letzte_erhoehung: '2019-10-01', vgl_qm: '7,80' },
      3: { mv_art: 'unbefristet', mv_letzte_erhoehung: '2018-07-01', vgl_qm: '8,20', mass: [['bad', '11000'], ['boeden', '5000']], ziel_qm: '9,50', ziel_wann: 'bei Mieterwechsel' },
      4: { mass: [['renovierung', '9000'], ['boeden', '5000'], ['bad', '11000']], ziel_qm: '9,80', ziel_wann: 'Neuvermietung' },
      5: { mv_art: 'unbefristet', mv_letzte_erhoehung: '2020-11-01', vgl_qm: '8,20' }
    }
  };
  function r26Mfh(sel) { return q('#mfh-modal ' + sel); }
  function r26We(sel) { return q('#mfh-we-ov ' + sel); }
  function r26Zelle(i, k) { return r26Mfh('[data-i="' + i + '"][data-k="' + k + '"]'); }
  /* tippen wie von Hand: Zeichen für Zeichen mit input-Ereignis (die Fenster hören am Behälter) */
  async function r26Tippe(e, text, ms) {
    if (!e) return; text = String(text == null ? '' : text);
    function los(t) { e.dispatchEvent(new Event(t, { bubbles: true })); }
    if (e.tagName === 'SELECT' || e.type === 'date' || e.type === 'month') { e.value = text; los('input'); los('change'); await warte(ms || 260); return; }
    e.value = ''; los('input');
    for (var i = 0; i < text.length; i++) { e.value = text.slice(0, i + 1); los('input'); await warte(ms || 70); }
    los('change');
  }
  function r26Kv(sel) {   /* .mfh-we-kv / .mfh-we-ew3: Beschriftung -> Wert */
    var o = {}; [].forEach.call(document.querySelectorAll(sel + ' > div'), function (d) { var a = d.querySelector('span'), b = d.querySelector('b'); if (a && b) o[r6Text(a)] = r6Text(b); }); return o;
  }
  function r26Summe() { return r6Text(q('#mfh-summe')); }
  /* der Auftrag ohne Objektkennung - Schlüssel des Mitschnitts */
  function r26Schluessel(body) {
    try { var b = typeof body === 'string' ? JSON.parse(body) : body; return JSON.stringify({ v: b.varianten || null, w: b.wohnungen || null, a: b.aufteilung ? { aktiv: !!b.aufteilung.aktiv, k: b.aufteilung.kosten_eur } : null }); } catch (e) { return null; }
  }
  async function r26WohnungAuf(i) {
    var b = r26Mfh('[data-det="' + i + '"]'); if (b) b.click();
    await warteAuf(function () { return r26We('.mfh-we-karte'); }, 4000);
    await warte(700);
    var l = r26We('.mfh-we-leib'); if (l) l.scrollTop = 0;
  }
  function r26Block(cls) { return function () { return r26We('.mfh-we-blk' + (cls ? '.' + cls : '')); }; }
  function r26BlockTitel(re) { return function () { return [].filter.call(document.querySelectorAll('#mfh-we-ov .mfh-we-blk'), function (b) { var t = b.querySelector('.mfh-we-blk-t'); return t && re.test(r6Text(t)); })[0] || null; }; }
  async function r26Feld(k, v, ms) { await r26Tippe(r26We('[data-wk="' + k + '"]'), v, ms); }
  async function r26Massnahmen(liste) {
    for (var j = 0; j < liste.length; j++) {
      var c = r26We('[data-zb-chip="' + liste[j][0] + '"]'); if (c && !c.classList.contains('on')) c.click();
      await warte(450);
      var n = [].filter.call(document.querySelectorAll('#mfh-we-ov [data-zb-k]'), function () { return true; }).length;
      await r26Tippe(r26We('[data-zb-k="' + (n - 1) + '"]'), liste[j][1], 60);
    }
  }
  async function r26WohnungZu() { var ok = r26We('#mfh-we-ok'); if (ok) ok.click(); await warteAuf(function () { return !q('#mfh-we-ov'); }, 3000); await warte(500); }
  /* Ertragswerte dieser Wohnung: Knopf, dann warten, bis die Kacheln stehen */
  async function r26Ertragswert() {
    var b = r26We('#mfh-we-ew-los'); if (b) b.click();
    await warteAuf(function () { return r26We('.mfh-we-ew3') || (r26We('#mfh-we-ew .mfh-we-hint b') && /Stufe 3/.test(r6Text(r26We('#mfh-we-ew')))); }, 45000);
    await warte(600);
  }
  /* jsPDF: Seite mit „Wertpotenzial" im Kopf finden (Seitenzahl ab 1) */
  var _r26 = { pdf: null, seite: null };
  async function r26Bank() {
    var fang = null, seite = null, seiteN = null, api = window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API;
    if (!api || typeof window.exportPDFBank !== 'function') return null;
    r19OhneKontakt();
    _r19.save = api.save;
    api.save = function () {
      try { var P = this.internal.pages; for (var n = 1; n < P.length; n++) { if (/\((WERTPOTENZIAL|Wertpotenzial)[^)]*\) Tj/.test((P[n] || []).join('\n'))) { if (seite == null) seite = seiteN = n; else if (n === seiteN + 1) seiteN = n; } } } catch (e) {}
      fang = this.output('blob'); return this;
    };
    try { await window.exportPDFBank({ ohneRueckfrage: true }); } catch (e) {} finally { api.save = _r19.save; _r19.save = null; r19MitKontakt(); }
    _r26.seite = seite; _r26.seiteN = seiteN;   /* v2481o · letzte Seite mit dem Kopf „Wertpotenzial" (Fortsetzung) */
    return fang;
  }
  DREHBUECHER['reihe-zielbild'] = {
    titel: 'Mieterhöhung und Zielbild', unterzeile: 'Ein Mehrfamilienhaus, Wohnung für Wohnung — Ist, Soll und Zielbild bis zum Wertpotenzial', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () { if (_r26.wahl) { clearInterval(_r26.wahl); _r26.wahl = null; } [].forEach.call(document.querySelectorAll('.dpm-wahl'), function (b) { b.classList.remove('dpm-wahl'); ['background', 'color', 'font-weight'].forEach(function (p) { b.style.removeProperty(p); }); }); var w = q('#mfh-we-ov'); if (w) w.remove(); var m = q('#mfh-modal'); if (m) m.remove(); r19Zu();
      /* v2481p · Gewonnen-Status und Ankauf-Stand gehören nur zum erfundenen Objekt (es wird gelöscht) */
      try { if (window.DealPilotAnkauf) DealPilotAnkauf.verwerfen(); } catch (e) {}
      var dw = q('#_deal_won_state'); if (dw) dw.value = 'false'; var da = q('#_deal_won_at_state'); if (da) da.value = '';
      rhAufraeumen(); },
    szenen: [
      async function (s) {   /* 1 · das Haus */
        await rhStart(0);
        try { _rh.mitschnitt26 = new URLSearchParams(location.search).get('mitschnitt') === '26'; } catch (e) {}
        try { _rh.mitschnitt26ki = new URLSearchParams(location.search).get('mitschnitt') === '26ki'; } catch (e) {}   /* v2481p */
        if (_rh.mitschnitt26 || _rh.mitschnitt26ki) DPM_REIHE.mitschnitt26 = { potenzial: {}, analyse: null };
        [['kuerzel', R26.kuerzel], ['plz', R26.plz], ['ort', R26.ort], ['str', R26.str], ['hnr', R26.hnr], ['objart', 'MFH'],
         ['baujahr', R26.baujahr], ['gsfl', R26.gsfl], ['etagen_ges', R26.etagen], ['kaufdat', R26.kaufdat]].forEach(function (x) { r6Setz(x[0], x[1]); });
        r6Setz('kp', R26.kp); try { DealPilotInvestmentProfile.nachziehen('kp'); } catch (e) {}
        await warte(900);
        try { if (typeof window.dpDarlehenNachziehen === 'function') window.dpDarlehenNachziehen(); } catch (e) {}
        try { DealPilotBwkProfil.einsetzen(false); } catch (e) {}
        try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
        await warte(700);
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        await b2oZeile(s, 'Das Beispiel', 'Ein erfundenes Mehrfamilienhaus: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — Baujahr ' + wert('baujahr') + ', Kaufpreis <b>' + eur(zahl('kp')) + '</b>' + (datum(wert('kaufdat')) ? ', gekauft am <b>' + datum(wert('kaufdat')) + '</b>' : '') + '.');
        await zeige(function () { var b = q('#mfh-oeffnen'); return b && b.offsetWidth ? b : null; }, 10);
        await b2oZeile(s, 'Einheiten erfassen', 'Bei einem Mehrfamilienhaus erscheint unter der Wohnfläche <b>„Einheiten erfassen“</b> — jede Wohnung einzeln.');
      },
      async function (s) {   /* 2 · Schritt 1: das Haus, der Haken „aufgeteilt" */
        var b = q('#mfh-oeffnen'); if (b) b.click();
        await warteAuf(function () { return r26Mfh('#mfh-body'); }, 4000);
        kegelHoch(true); await warte(700);
        await zeige(function () { return r26Mfh('#mfh-body table'); }, 6);
        await b2oZeile(s, 'Schritt 1 · Das Haus', 'Der Zustand nach Anlage 2: Dach, Fassade, Leitungen, Heizung fürs ganze Haus — hier noch nichts modernisiert.');
        var w = r26Mfh('#mfh-weg');
        await zeige(function () { var x = r26Mfh('#mfh-weg'); return x && x.closest('div'); }, 8);
        if (w && !w.checked) w.click();
        await b2oZeile(s, 'In Wohnungseigentum aufgeteilt', 'Ein Haken — dann zeigt DealPilot jede Wohnung auch als <b>Eigentumswohnung</b>, die Aufteilungskosten mit Vorbelegung.');
        /* v2481m · v2541: das Jahr, in dem das Zielbild erreicht ist (gespiegelt nach zb_fertig_jahr) */
        var zj = function () { var x = r26Mfh('#mfh-zbjahr'); return x && x.offsetWidth ? x : null; };
        if (zj()) {
          await zeige(function () { var x = zj(); return x && x.parentElement; }, 8);
          var zbz = r6Beginn(s, 'Zielbild fertig (Jahr)', 'Wann ist der Plan umgesetzt? Hier <b>' + R26.zbJahr + '</b>.');
          await r26Tippe(zj(), R26.zbJahr, 120);
          await r6Ende(zbz);
          var zjw = (q('#zb_fertig_jahr') || {}).value || '';
          await b2oZeile(s, 'Ein Jahr je Stufe', 'Ankauf, Mieterhöhung und Zielbild bekommen je ein Jahr' + (zjw ? ' — das Zielbild <b>' + zjw + '</b>' : '') + '. Es steht über den Spalten in Pilot-Analyse und PDF.', 800);
        }
      },
      async function (s) {   /* 3 · Schritt 2: sechs Wohnungen */
        var wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return r26Zelle(0, 'nr'); }, 3000);
        await warte(500);
        await zeige(function () { return r26Mfh('.mfh-tab'); }, 6);
        var zb = r6Beginn(s, 'Schritt 2 · Die Wohnungen', 'Nummer, Lage, Fläche, Zimmer, Ist-Miete, Status — nur das Nötigste.');
        for (var i = 0; i < R26.we.length; i++) {
          if (i > 0) { var nb = r26Mfh('#mfh-neu'); if (nb) nb.click(); await warteAuf(function () { return r26Zelle(i, 'nr'); }, 2000); }
          var r = R26.we[i];
          var nr = r26Zelle(i, 'nr'); if (nr && nr.value !== r[0]) await r26Tippe(nr, r[0], 60);
          await r26Tippe(r26Zelle(i, 'lage'), r[1], 55);
          await r26Tippe(r26Zelle(i, 'wfl'), r[2], 60);
          await r26Tippe(r26Zelle(i, 'zimmer'), r[3], 60);
          if (r[4]) await r26Tippe(r26Zelle(i, 'ist'), r[4], 60);
          await r26Tippe(r26Zelle(i, 'status'), r[5]);
        }
        await r6Ende(zb);
        await zeige(function () { return b2oHuelle(r26Mfh('.mfh-tab'), r26Mfh('#mfh-summe')); }, 6);
        var su = r26Summe(), sm = /(\d+) Einheiten.*?·\s*([\d.]+ m²).*?Ist ([\d.]+ €)\/Monat/.exec(su), le = /Leerstand (\d+) WE/.exec(su);
        await b2oZeile(s, 'Sechs Wohnungen', sm ? '<b>' + sm[1] + ' Einheiten, ' + sm[2] + '</b>, Ist-Miete <b>' + sm[3] + '</b> im Monat' + (le ? ' — ' + le[1] + ' Wohnung steht leer' : '') + '.' : su);
        await zeige(function () { return r26Mfh('[data-det="0"]'); }, 8);
        await b2oZeile(s, 'Details', 'Alles Weitere steht in der Wohnung: <b>Details</b> öffnet Mietvertrag, Soll-Miete, Zielbild und Ertragswert.');
      },
      async function (s) {   /* 4 · Wohnung 1: Mietvertrag */
        await r26WohnungAuf(0);
        var P = R26.plan[0];
        await zeige(r26BlockTitel(/^Mietvertrag/), 6);
        var zb = r6Beginn(s, 'Wohnung 1 · Der Mietvertrag', 'Vertragsart, Mietbeginn — und das Datum der letzten Erhöhung.');
        await r26Feld('mv_art', P.mv_art); await r26Feld('mv_beginn', P.mv_beginn); await r26Feld('mv_letzte_erhoehung', P.mv_letzte_erhoehung);
        await r6Ende(zb);
        await b2oZeile(s, 'Die Frist', 'Letzte Erhöhung am <b>' + datum(P.mv_letzte_erhoehung) + '</b>: die nächste ist frühestens 15 Monate später möglich (§ 558 BGB).');
      },
      async function (s) {   /* 5 · Wohnung 1: Soll-Miete */
        var P = R26.plan[0];
        await zeige(r26Block('soll'), 6);
        var zb = r6Beginn(s, 'Wohnung 1 · Soll-Miete', 'Der Mieter bleibt. Eingetragen wird nur die Vergleichsmiete aus dem Mietspiegel …');
        await r26Feld('vgl_qm', P.vgl_qm, 90);
        await warteAuf(function () { return r26Kv('#mfh-we-soll .mfh-we-kv')['Soll-Miete']; }, 6000);
        await r6Ende(zb);
        var kv = r26Kv('#mfh-we-soll .mfh-we-kv'), kt = (function () { var h = document.querySelectorAll('#mfh-we-soll .mfh-we-hint'); return h.length ? r6Text(h[h.length - 1]) : ''; })();
        var kg = /Kappungsgrenze (\d+) %/.exec(kt), vo = /steht in der ([^(.]+?)\s*\(/.exec(kt);
        await zeige(function () { return r26We('#mfh-we-soll'); }, 6);
        await b2oZeile(s, 'Der Vorschlag von DealPilot', 'Vergleichsmiete <b>' + P.vgl_qm + ' €/m²</b> — DealPilot rechnet die Soll-Miete: <b>' + (kv['Soll-Miete'] || '–') + '</b>, ' + (kv['Herkunft'] || '').replace(/^gerechnet \(§ 558\) · /, '') + '.');
        await b2oZeile(s, 'Die Kappungsgrenze', (kg ? '<b>' + kg[1] + ' % in drei Jahren</b>' : 'Die Kappungsgrenze') + (vo ? ' — Bielefeld steht in der <b>' + vo[1] + '</b>' : '') + '. DealPilot setzt sie je Gemeinde selbst. Erreichbar ab: <b>' + (kv['erreichbar ab'] || '–') + '</b>.');
        /* v2481m · Erklärkarte: was die Soll-Miete ist (keine Zahl, nur die Regel) */
        await zeige(function () { return r26We('#mfh-we-soll'); }, 6);
        await b2oZeile(s, 'Was „Soll-Miete“ heißt', 'Die Miete, die der Vermieter ohne Umbau verlangen darf: höchstens die Vergleichsmiete, höchstens die Kappungsgrenze — und frühestens 15 Monate nach der letzten Erhöhung.', 1500);
      },
      async function (s) {   /* 6 · Wohnung 1: Zielbild */
        var P = R26.plan[0];
        await zeige(r26Block('ziel'), 6);
        var zb = r6Beginn(s, 'Wohnung 1 · Zielbild', 'Nach Umbau oder Mieterwechsel: Maßnahmen als Chips, jede mit Kosten.');
        await r26Massnahmen(P.mass);
        await r26Feld('ziel_qm', P.ziel_qm, 90); await r26Feld('ziel_wann', P.ziel_wann, 45);
        await r6Ende(zb);
        var kv = r26Kv('#mfh-we-ziel .mfh-we-kv');
        await zeige(function () { return r26We('#mfh-we-ziel'); }, 6);
        await b2oZeile(s, 'Kosten und Punkte', 'Bad und Böden: <b>' + (kv['Kosten gesamt'] || '–') + '</b>, ' + (kv['Modernisierungspunkte'] || '–').replace(/\s*\(Anlage 2\)/, '') + ' Modernisierungspunkte nach Anlage 2. Zielmiete <b>' + P.ziel_qm + ' €/m²</b> = <b>' + (kv['Zielmiete'] || '–') + '</b>.');
        /* v2481m · Erklärkarte: Soll gegen Zielbild */
        await b2oZeile(s, 'Soll und Zielbild', 'Die Soll-Miete gibt der laufende Vertrag her. Das Zielbild ist ein Plan: Umbau, Kosten, neue Miete nach Mieterwechsel — mit Punkten, die die Restnutzungsdauer verlängern.', 1500);
      },
      async function (s) {   /* 7 · Wohnung 1: Ertragswert */
        await zeige(r26Block('ew'), 6);
        var zb = r6Beginn(s, 'Ertragswert dieser Wohnung', 'Derselbe Rechenkern wie der Marktbericht Stufe 3 — je Stufe: Bestand, Mieterhöhung, Zielbild.');
        await r26Ertragswert();
        await r6Ende(zb);
        var gesp = !r26We('.mfh-we-ew3');
        DPM_REIHE.r26ew = (DPM_REIHE.r26ew || []).concat([{ we: 1, gesperrt: gesp, text: r6Text(r26We('#mfh-we-ew')).slice(0, 200) }]);
        if (gesp) { await b2oZeile(s, 'Ertragswert mit Stufe 3', 'Der Ertragswert gehört zur Wertermittlung (Stufe 3) — ohne sie bleibt es bei Mieten, Kosten und Rendite.'); await r26WohnungZu(); return; }
        var e3 = r26Kv('#mfh-we-ew .mfh-we-ew3'), zt = r6Text(r26We('#mfh-we-ew .mfh-we-hint')), zi = /Zins ([\d,]+ %)/.exec(zt);
        await zeige(function () { return r26We('#mfh-we-ew'); }, 6);
        await b2oZeile(s, 'Als Eigentumswohnung', 'Bestand <b>' + (e3['Bestand'] || '–') + '</b>, mit Mieterhöhung <b>' + (e3['Mieterhöhung'] || '–') + '</b>, im Zielbild <b>' + (e3['Zielbild'] || '–') + '</b>' + (zi ? ' — Zins ' + zi[1] + ' für Wohnungseigentum' : '') + '.');
        var ha = r26We('[data-ewart="haus"]'); if (ha) ha.click();
        await warte(700);
        var h3 = r26Kv('#mfh-we-ew .mfh-we-ew3');
        await b2oZeile(s, 'Oder als Anteil am Haus', 'Umgeschaltet: <b>' + (h3['Bestand'] || '–') + '</b> · <b>' + (h3['Mieterhöhung'] || '–') + '</b> · <b>' + (h3['Zielbild'] || '–') + '</b> — der Anteil am Ertragswert des ganzen Hauses.');
        await r26WohnungZu();
      },
      async function (s) {   /* 8 · Wohnung 2 */
        await r26WohnungAuf(1);
        var P = R26.plan[1];
        await zeige(r26BlockTitel(/^Mietvertrag/), 6);
        var zb = r6Beginn(s, 'Wohnung 2', 'Zuletzt erhöht im <b>' + ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][+P.mv_letzte_erhoehung.slice(5, 7) - 1] + ' ' + P.mv_letzte_erhoehung.slice(0, 4) + '</b>, Vergleichsmiete <b>' + P.vgl_qm + ' €/m²</b>.');
        await r26Feld('mv_art', P.mv_art); await r26Feld('mv_beginn', P.mv_beginn); await r26Feld('mv_letzte_erhoehung', P.mv_letzte_erhoehung);
        await zeige(r26Block('soll'), 6);
        await r26Feld('vgl_qm', P.vgl_qm, 80);
        await warteAuf(function () { return r26Kv('#mfh-we-soll .mfh-we-kv')['Soll-Miete']; }, 6000);
        await r6Ende(zb);
        var kv = r26Kv('#mfh-we-soll .mfh-we-kv');
        await zeige(function () { return r26We('#mfh-we-soll'); }, 6);
        var kap2 = /Kappung/.test(kv['Herkunft'] || '');
        await b2oZeile(s, kap2 ? 'Wieder die Kappungsgrenze' : 'Hier begrenzt der Mietspiegel', 'Soll-Miete <b>' + (kv['Soll-Miete'] || '–') + '</b> — ' + (kv['Herkunft'] || '').replace(/^gerechnet \(§ 558\) · /, '') + (kap2 ? ': die Miete liegt weit unter dem Mietspiegel' : ', nicht die Kappung') + '. Erreichbar ab <b>' + (kv['erreichbar ab'] || '–') + '</b>.');
        await zeige(r26Block('ziel'), 6);
        var zb2 = r6Beginn(s, 'Wohnung 2 · Zielbild', 'Fenster und Bad, danach 10 €/m² bei Mieterwechsel.');
        await r26Massnahmen(P.mass);
        await r26Feld('ziel_qm', P.ziel_qm, 80); await r26Feld('ziel_wann', P.ziel_wann, 40);
        await r6Ende(zb2);
        var kz = r26Kv('#mfh-we-ziel .mfh-we-kv');
        await zeige(function () { return r26We('#mfh-we-ziel'); }, 6);
        await b2oZeile(s, 'Wohnung 2 · Zielbild', 'Zielmiete <b>' + (kz['Zielmiete'] || '–') + '</b>, Maßnahmen <b>' + (kz['Kosten gesamt'] || '–') + '</b>, ' + (kz['Modernisierungspunkte'] || '–').replace(/\s*\(Anlage 2\)/, '') + ' Punkte.');
        await r26WohnungZu();
      },
      async function (s) {   /* 9 · die übrigen Wohnungen, zügig */
        await zeige(function () { return r26Mfh('.mfh-tab'); }, 6);
        var zb = r6Beginn(s, 'Die übrigen Wohnungen', 'Dasselbe zügig: Vergleichsmiete, letzte Erhöhung, wo geplant ein Zielbild — die leere Wohnung bekommt nur das Zielbild.');
        for (var i = 2; i < R26.we.length; i++) {
          var P = R26.plan[i]; if (!P) continue;
          await r26WohnungAuf(i);
          if (P.mv_art) { await zeige(r26BlockTitel(/^Mietvertrag/), 6); await r26Feld('mv_art', P.mv_art); await r26Feld('mv_letzte_erhoehung', P.mv_letzte_erhoehung); }
          if (P.vgl_qm) { await zeige(r26Block('soll'), 6); await r26Feld('vgl_qm', P.vgl_qm, 60); await warte(500); }
          if (P.mass) { await zeige(r26Block('ziel'), 6); await r26Massnahmen(P.mass); await r26Feld('ziel_qm', P.ziel_qm, 60); await r26Feld('ziel_wann', P.ziel_wann, 35); await warte(500); }
          await r26WohnungZu();
          await zeige(function () { return r26Mfh('.mfh-tab'); }, 6);
        }
        await r6Ende(zb);
        await zeige(function () { return r26Mfh('.mfh-tab'); }, 6);
        var n = [].filter.call(document.querySelectorAll('#mfh-modal .mfh-det.mit-plan'), function () { return true; }).length;
        await b2oZeile(s, 'Jede Wohnung für sich', '<b>' + n + ' Wohnungen</b> mit Zielbild („Details · Plan“), die übrigen mit Vergleichsmiete — gerechnet wird je Wohnung, nicht pauschal.');
      },
      async function (s) {   /* 10 · Ergebnis, Übernehmen */
        var wb = r26Mfh('#mfh-weiter'); if (wb) wb.click(); await warte(500);
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return r26Mfh('#mfh-uep'); }, 3000);
        await warte(600);
        await zeige(function () { return r26Mfh('#mfh-body'); }, 6);
        var et = r6Text(r26Mfh('#mfh-body')), rg = /Restnutzungsdauer (\d+) Jahre/.exec(et), pg = /Gebäude gesamt:\s*([\d,]+) Punkte/.exec(et);
        await b2oZeile(s, 'Schritt 4 · Ergebnis', 'Heute ' + (pg ? '<b>' + pg[1].replace(/,0$/, '') + ' Punkte</b> nach Anlage 2' : 'die Punkte nach Anlage 2') + (rg ? ', Restnutzungsdauer <b>' + rg[1] + ' Jahre</b>' : '') + ' — Score und Verkehrswert rechnen weiter mit dem Bestand.');
        /* Die Maßnahmenkosten NICHT als Sanierung ins Objekt: das Zielbild ist ein Plan, der Bestand
           rechnet ohne ihn (Haken ist vorbelegt, wenn keine Sanierung eingetragen ist) */
        var san = r26Mfh('#mfh-san'), sanZ = r26Mfh('#mfh-san-zeile');
        if (san && sanZ && sanZ.offsetWidth) {
          await zeige(function () { return r26Mfh('#mfh-san-zeile'); }, 8);
          if (san.checked) san.click();
          await b2oZeile(s, 'Kein Umbau im Bestand', 'Den Haken „' + r6Text(r26Mfh('#mfh-san-text')).replace(/ als Sanierung übernehmen.*$/, '') + ' als Sanierung“ lassen wir weg — das Zielbild ist ein Plan, die Investition bleibt der Kauf.');
        }
        await zeige(function () { return r26Mfh('#mfh-weiter'); }, 8);
        s.zeile('Übernehmen', 'Ein Klick: Fläche, Einheiten, Ist-Miete und die Pläne gehen ins Objekt.');
        await warte(3200);
        DPM_REIHE.r26toast = null;
        var tw = window.toast, tt = null;
        window.toast = function (m) { tt = m; try { DPM_REIHE.r26toast = String(m); } catch (e) {} return tw.apply(this, arguments); };
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return !q('#mfh-modal'); }, 5000);
        window.toast = tw;
        kegelHoch(false);
        await warte(1600);
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('wfl'), feldVon('einheiten'), 8);
        await b2oZeile(s, 'Im Objekt', 'Übernommen: <b>' + wert('einheiten') + ' Einheiten</b>, ' + wert('wfl') + ' m², Kaltmiete <b>' + eur(zahl('nkm')) + '</b> im Monat' + (/aus Wohnungen/.test(tt || '') ? ' — und die Mietentwicklung steht auf <b>„aus Wohnungen“</b>' : '') + '.');
        /* v2481p · das Haus ist seit dem Kaufdatum im Bestand: gewonnen + Ankauf-Stand zum Kaufdatum
           festgeschrieben (wie unter Deal-Aktion „Gewonnen", Modul 14). Ohne ihn hat die Pilot-Tafel
           keine Spalte „Ankauf". Nur im Lauf, nur am erfundenen Objekt; aufraeumen nimmt beides zurück. */
        var kd = wert('kaufdat');
        if (/^\d{4}-\d{2}-\d{2}$/.test(kd || '') && window.DealPilotAnkauf) {
          var dw = q('#_deal_won_state'); if (dw) dw.value = 'true';
          var da = q('#_deal_won_at_state'); if (da) da.value = kd + 'T00:00:00.000Z';
          try { DealPilotAnkauf.festschreiben(kd); } catch (e) { DPM_REIHE.r26ankauf = 'FEHLER ' + (e && e.message); }
          DPM_REIHE.r26ankauf = DPM_REIHE.r26ankauf || (DealPilotAnkauf.stand() ? { stichtag: DealPilotAnkauf.stand().stichtag, nkm: DealPilotAnkauf.stand().kurz.nkm } : null);
          await warte(600);
          await zeige(feldVon('kaufdat'), 10);
          await b2oZeile(s, 'Im Bestand seit ' + kd.slice(0, 4), 'Gekauft am <b>' + datum(kd) + '</b>. Der Stand beim Kauf ist festgeschrieben — die Pilot-Analyse stellt ihn später neben Bestand, Mieterhöhung und Zielbild.');
        }
      },
      async function (s) {   /* 11 · Tab Miete: Mietentwicklung aus Wohnungen */
        reiter('s2'); await warte(1200);
        var ME = window.MietEntwicklung;
        var knopf = function () { var b = q('#me-mode-einheiten'); return b && b.offsetWidth ? b : null; };
        await warteAuf(knopf, 4000);
        /* v2481k · Marcel 20.10.2026: „das geht sehr schnell mit dem ‚Aus Wohnungen', und man sieht
           nicht genau, welches ausgewählt wurde." Jetzt: erst der ganze Schalter (Rahmen, stehen
           lassen), dann der eine Knopf, Klick, und die gewählte Option trägt einige Sekunden eine
           eigene Markierung (.dpm-wahl). Die Modi liest die Zeile live aus den Knöpfen. */
        var modi = [].map.call(document.querySelectorAll('.me-mode-toggle .me-mode-btn'), function (b) { return b.offsetWidth ? r6Text(b) : null; }).filter(Boolean);
        await zeige(function () { var b = knopf(); return b && b.parentElement; }, 10);
        await b2oZeile(s, 'Tab Miete · Mietentwicklung', (modi.length ? modi.length + ' Wege, die Miete fortzuschreiben: ' + modi.map(function (x) { return '„' + x + '“'; }).join(', ') : 'Mehrere Wege, die Miete fortzuschreiben') + '. Für das Mehrfamilienhaus der letzte.', 1800);
        await zeige(knopf, 10);
        var schon = !!(ME && ME.getMode && ME.getMode() === 'einheiten' && knopf() && knopf().classList.contains('active'));
        await b2oZeile(s, '„' + (knopf() ? r6Text(knopf()) : 'Aus Wohnungen') + '“', schon ? 'Das Übernehmen hat ihn schon vorgewählt — ein Klick, und die Tabelle rechnet je Wohnung.' : 'Ein Klick, und die Tabelle rechnet je Wohnung.', 1200);
        /* ein Klick auch dann, wenn der Modus schon steht: er zeichnet die Tabelle (setMietModus) */
        var k = knopf(); if (k && !k.disabled) k.click();
        /* v2481n · GEMESSEN (getComputedStyle im Mitschnitt-Lauf): Rahmen kam an, Füllung und Schrift nicht -
           eine !important-Regel der App mit höherer Spezifität gewinnt. Füllung daher inline mit !important. */
        var wahl = function () { var b = knopf(); if (b && !b.classList.contains('dpm-wahl')) { b.classList.add('dpm-wahl'); b.style.setProperty('background', GH, 'important'); b.style.setProperty('color', '#050505', 'important'); b.style.setProperty('font-weight', '700', 'important'); } return b; };
        wahl(); _r26.wahl = setInterval(wahl, 300);
        await warte(900);
        DPM_REIHE.r26wahl = { aktiv: !!(knopf() && knopf().classList.contains('active')), markiert: !!(knopf() && knopf().classList.contains('dpm-wahl')), modus: ME && ME.getMode ? ME.getMode() : null };
        await zeige(knopf, 10);
        await b2oZeile(s, 'Gewählt: „' + (knopf() ? r6Text(knopf()) : 'Aus Wohnungen') + '“', 'Der Knopf ist aktiv — die Mietentwicklung des Hauses kommt jetzt aus den einzelnen Wohnungen.', 2500);
        clearInterval(_r26.wahl); _r26.wahl = null;
        [].forEach.call(document.querySelectorAll('.dpm-wahl'), function (b) { b.classList.remove('dpm-wahl'); ['background', 'color', 'font-weight'].forEach(function (p) { b.style.removeProperty(p); }); });
        var tw = function () { return q('#me_table_wrap'); };
        await warteAuf(function () { return q('#me_table_wrap table'); }, 4000);
        await zeige(tw, 8);
        await b2oZeile(s, 'Was sich geändert hat', 'Statt einer pauschalen Steigerung fürs ganze Haus: je Wohnung die Ist-Miete und die Soll-Miete nach Mieterhöhung, jede mit ihrem eigenen Termin.', 2500);
        var zeilen = [].filter.call(document.querySelectorAll('#me_table_wrap tbody tr'), function (r) { return r.cells.length >= 4; });
        /* die erste Zeile, deren Faktor mehr springt als die Prognose-Steigerung: dort greifen die Soll-Mieten */
        var fx = function (r) { return parseFloat(r6Text(r.cells[3]).replace(',', '.')) || 0; }, stg = (parseFloat(wert('mietstg').replace(',', '.')) || 0) / 100;
        var hz = null, vorF = 1;
        for (var j = 0; j < zeilen.length && !hz; j++) { var f = fx(zeilen[j]); if (f / vorF - 1 > stg + 0.005) hz = zeilen[j]; vorF = f; }
        var hj = hz ? r6Text(hz.cells[0]).replace(/\s*⬆/, '') : null, hv = hz ? r6Text(hz.cells[1]) : null;
        var hp = hz && hz.previousElementSibling ? r6Text(hz.previousElementSibling.cells[1]) : eur((zahl('nkm') || 0) * 12);
        var kopf = r6Text(q('#me_table_wrap .me-herkunft'));
        DPM_REIHE.r26me = { modus: ME && ME.getMode ? ME.getMode() : null, sprung: hj, vor: hp, nach: hv, kopf: kopf };
        await b2oZeile(s, 'Der Sprung zur Soll-Miete', hz ? 'In <b>' + hj + '</b> greifen die Soll-Mieten: Kaltmiete <b>' + hv + '</b> statt ' + hp + ' im Jahr — danach weiter mit der Prognose.' : 'Ab ihrem Termin rechnet jede Wohnung mit ihrer Soll-Miete.');
        await zeige(function () { return q('#me_table_wrap .me-herkunft'); }, 8);
        await b2oZeile(s, 'Je Wohnung ihr Termin', '15 Monate nach der letzten Erhöhung — oder eine eigene Angabe. Das Zielbild bleibt draußen: es ist ein Plan, kein Vertrag.');
      },
      async function (s) {   /* 12 · Pilot-Analyse */
        reiter('s5'); await warte(1200);
        var btn = function () { var b = q('#ai-btn'); return b && b.offsetWidth ? b : null; };
        await zeige(btn, 10);
        var zb = r6Beginn(s, 'Pilot-Analyse', 'Der Pilot liest alles — auch die Pläne je Wohnung und die Ertragswerte je Stufe.');
        /* v2488vr · Mitschnitt-Lauf: HALT vor dem einen KI-Abruf, wenn der Ertragswert nicht
           Bestand < Mieterhöhung < Zielbild steigt - sonst wäre der bezahlte Abruf für Zahlen,
           die so nicht ins Video gehören. Ergebnis in DPM_REIHE.r26halt. */
        if (_rh && (_rh.mitschnitt26 || _rh.mitschnitt26ki)) {
          var r0 = null; try { r0 = await window.DpPotenzial.rechnen(); } catch (e) {}
          var H = (r0 && r0.haus) || {}, w3 = ['bestand', 'mieterhoehung', 'zielbild'].map(function (k) { return H[k] ? H[k].wert : null; });
          DPM_REIHE.r26halt = { werte: w3, ok: w3[0] != null && w3[1] != null && w3[2] != null && w3[0] < w3[1] && w3[1] < w3[2] };
          if (!DPM_REIHE.r26halt.ok) { stopp(); throw 'stopp'; }
        }
        var b = btn(); if (b) b.click();
        await warteAuf(function () { return q('#ai-content .dp-pa-tab'); }, 120000);
        await r6Ende(zb);
        await warte(900);
        var t = [].filter.call(document.querySelectorAll('#ai-content .dp-pa-tab'), function (x) { return x.offsetWidth && /Zielbild/.test(r6Text(x)); })[0];
        await zeige(function () { return t; }, 8);
        await b2oZeile(s, 'Ein eigener Reiter', 'Neben Briefing, Risiko und Bank: <b>„' + (t ? r6Text(t) : 'Ankauf · Bestand · Zielbild') + '“</b>.');
        await r11PaTab(/Zielbild/);
        var tab = function () { var p = r11Panel(); return p && p.querySelector('[data-dp-pot-wirt] table'); };
        await zeige(tab, 6);
        /* v2481n · GEMESSEN: der Kopf trägt das Jahr als eigenes Kind („Mieterhöhung" + „2026") - r6Text klebte es an */
        var T = tab(), kopf = T && T.querySelector('thead tr') ? [].map.call(T.querySelector('thead tr').querySelectorAll('th'), function (x) { return [].map.call(x.childNodes, function (n) { return String(n.textContent || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean).join(' '); }).filter(Boolean) : [];
        var zeile = function (re) { var r = T && [].filter.call(T.querySelectorAll('tbody tr'), function (x) { return re.test(r6Text(x.cells[0])); })[0]; return r ? [].map.call(r.cells, function (c) { return r6Text(c); }) : null; };
        var ew = zeile(/^Ertragswert/), km = zeile(/^Kaltmiete p\. a\./), mpi = zeile(/^Marktpreisindikation/), rf = zeile(/^Rohertragsfaktor/);
        /* v2481m · seit v2541 tragen die Köpfe ein Jahr („Bestand 2026", „Zielbild Jahr offen") - Spalte per Muster */
        var sx = function (re) { for (var i = 1; i < kopf.length; i++) if (re.test(kopf[i])) return i; return -1; };
        var iB = sx(/^Bestand/), iM = sx(/^Mieterh/), iZ = sx(/^Zielbild/), iA = sx(/^Ankauf/);
        DPM_REIHE.r26pa = { kopf: kopf, ertragswert: ew, kaltmiete: km, mpi: mpi, rf: rf };
        var sp = kopf.slice(1);   /* ohne die Spalte „Kennzahl" */
        await b2oZeile(s, sp.length + ' Spalten nebeneinander', sp.join(' · ') + (km && iB > 0 ? ' — Kaltmiete im Jahr von <b>' + km[iB] + '</b> bis <b>' + km[iZ > 0 ? iZ : km.length - 1] + '</b>' : '') + '.', 800);
        var kz = function () { var t = tab(); return t && t.querySelector('thead'); };
        if (kz()) { await zeige(kz, 6); await b2oZeile(s, 'Jede Stufe hat ihr Jahr', (iA > 0 ? '<b>' + kopf[iA] + '</b> aus dem Kaufdatum, ' : '') + (iM > 0 ? '<b>' + kopf[iM] + '</b> ab dem frühesten Termin der Soll-Mieten, ' : '') + (iZ > 0 ? '<b>' + kopf[iZ] + '</b> aus dem eingetragenen Jahr.' : ''), 1000); }
        var zr = function (re) { return function () { var t = tab(); var r = t && [].filter.call(t.querySelectorAll('tbody tr'), function (x) { return re.test(r6Text(x.cells[0])); })[0]; return r || null; }; };
        if (ew && iB > 0) { await zeige(zr(/^Ertragswert/), 6); await b2oZeile(s, 'Ertragswert je Stufe', 'Bestand <b>' + ew[iB] + '</b>, mit Mieterhöhung <b>' + ew[iM] + '</b>, im Zielbild <b>' + ew[iZ] + '</b> — Potenzialwert, keine Verkehrswertermittlung.', 1000); }
        if (mpi && iB > 0) { await zeige(function () { var a = zr(/^Marktpreisindikation/)(), b = zr(/^Rohertragsfaktor/)(); return a && b ? b2oHuelle(a, b) : a; }, 6);
          await b2oZeile(s, 'Daneben der Markt', 'Marktpreisindikation aus Angeboten: Bestand <b>' + mpi[iB] + '</b>, Zielbild <b>' + mpi[iZ] + '</b>' + (rf ? ' — und als Gegenprobe Rohertragsfaktor × Miete: <b>' + rf[iB] + '</b> bis <b>' + rf[iZ] + '</b>' : '') + '.', 1500);
          await b2oZeile(s, 'Zwei Blickwinkel', 'Der Ertragswert rechnet aus der Miete. Die Marktpreisindikation sagt, was vergleichbare Häuser am Ort im Angebot kosten — abzüglich des üblichen Abschlags.', 1500); }
        /* v2481g · GEMESSEN: die Aufteilung steht als ZEILEN in derselben Tafel, nicht als eigene Tabelle - gezeigt werden diese Zeilen samt Begründung */
        var auf = function () {
          var p = r11Panel(); if (!p) return null;
          var z = [].filter.call(p.querySelectorAll('[data-dp-pot-wirt] tr'), function (r) { return r.offsetWidth && /Aufteilung/i.test(r6Text(r.cells[0] || r)); });
          return z.length ? b2oHuelle(z[0], z[z.length - 1]) : null;
        };
        var au = auf();
        if (au) {
          await zeige(auf, 6);
          var at = [].map.call(r11Panel().querySelectorAll('[data-dp-pot-wirt] tr'), function (r) { return /Aufteilung/i.test(r6Text(r.cells[0] || r)) ? r6Text(r) : ''; }).join(' '), neg = /kein Potenzial/i.test(at);
          await b2oZeile(s, 'Nach der Aufteilung', neg ? 'Jede Wohnung als Eigentumswohnung, die Summe gegen das Haus — hier <b>kein Potenzial</b>, und DealPilot sagt warum.' : 'Jede Wohnung als Eigentumswohnung, die Summe nach Aufteilungskosten gegen den Wert des Hauses.');
        }
        var pt = function () { var p = r11Panel(); var e = p && rhIm(p, /^\s*PILOT: WAS IM HAUS STECKT\s*$/); return e && (e.closest('div[style*="margin-top:12px"]') || e.parentElement); };
        if (pt()) {
          await zeige(pt, 6);
          await b2oZeile(s, 'Der Pilot dazu', 'Ein Absatz in ganzen Sätzen: was im Haus steckt, welche Wohnung den größten Hebel hat — und was davon nur Plan ist.', 1200);
        }
      },
      async function (s) {   /* 12b · Pilot-Analyse: Abschnitt Marktpreise (v2481m) */
        /* v2481m · Abschnitt „Marktpreise" (v2542): Abruf mit Rückfrage. Bucht 1 × erweiterte MPI -
           im Lauf NUR gespielt (rhAntwort), im Mitschnitt-Lauf genau einmal echt. */
        var mk = function () { var p = r11Panel(); var x = p && p.querySelector('[data-dp-pot-markt]'); return x && x.offsetWidth ? x : null; };
        var mkKnopf = function (a) { var x = mk(); var b = x && x.querySelector('[' + a + ']'); return b && b.offsetWidth ? b : null; };
        if (mk() && mkKnopf('data-dp-markt-abruf')) {
          await zeige(function () { var x = mk(); return x && (x.querySelector('.dp-markt-kopf') || x); }, 8);
          await b2oZeile(s, 'Marktpreise', 'Darunter der Abschnitt <b>„Marktpreise“</b>: Kaufpreise und Angebotsmieten am Ort, je Stufe und je Wohnung — mit Spannen.', 1000);
          await zeige(function () { return mkKnopf('data-dp-markt-abruf'); }, 10);
          s.zeile('Abrufen', 'Ein Klick auf <b>„' + r6Text(mkKnopf('data-dp-markt-abruf')) + '“</b> …');
          await warte(2600);
          var ab = mkKnopf('data-dp-markt-abruf'); if (ab) ab.click();
          await warteAuf(function () { return mkKnopf('data-dp-markt-ja'); }, 4000);
          await zeige(function () { var b = mkKnopf('data-dp-markt-ja'); return b && (b.closest('.dp-pot-stufe3') || b); }, 8);
          await b2oZeile(s, 'Erst die Rückfrage', 'Der Abruf kostet <b>1 × erweiterte Marktpreisindikation</b> aus dem Kontingent — DealPilot fragt vorher. Das Ergebnis bleibt gespeichert.', 1200);
          var ja = mkKnopf('data-dp-markt-ja'); if (ja) ja.click();
          var mt = function () { var x = mk(); return x && x.querySelectorAll('table').length >= 3 ? x : null; };
          await warteAuf(mt, 60000);
          await warte(900);
          var tabs = function (i) { return function () { var x = mk(); var t = x && x.querySelectorAll('table')[i]; return t || null; }; };
          var T0 = tabs(0)(), zz = function (T, re) { var r = T && [].filter.call(T.querySelectorAll('tbody tr'), function (x) { return re.test(r6Text(x.cells[0])); })[0]; return r ? [].map.call(r.cells, function (c) { return r6Text(c); }) : null; };
          var kh = zz(T0, /^Kaufpreis (Mehrfam|Haus)/), ke = zz(T0, /^Kaufpreis Eigentum/), am = zz(T0, /^Angebotsmiete/);
          DPM_REIHE.r26markt = { haus: kh, etw: ke, miete: am };
          if (T0) {
            await zeige(tabs(0), 6);
            await b2oZeile(s, 'Markt am Ort', (kh ? 'Mehrfamilienhäuser im Angebot: Median <b>' + kh[1] + '</b>' : '') + (ke ? ', Eigentumswohnungen <b>' + ke[1] + '</b>' : '') + (am ? ', Angebotsmiete <b>' + am[1] + '</b>' : '') + ' — jeweils mit Spanne und Zahl der Angebote.', 1500);
          }
          var T1 = tabs(1)(), m1 = zz(T1, /^Marktpreisindikation/), e1 = zz(T1, /^Ertragswert/);
          if (T1 && m1) {
            await zeige(tabs(1), 6);
            await b2oZeile(s, 'Je Stufe', 'Marktpreisindikation <b>' + m1.slice(1).join('</b> · <b>') + '</b>' + (e1 ? ' — neben dem Ertragswert ' + e1.slice(1).join(' · ') : '') + '.', 1500);
          }
          var T2 = (function () { var x = mk(); return x && [].filter.call(x.querySelectorAll('table'), function (t) { return /Je Wohnung als ETW/.test(r6Text(t.querySelector('thead') || t)); })[0]; })();
          if (T2) {
            var su = zz(T2, /^Summe/);
            await zeige(function () { var x = mk(); return x && [].filter.call(x.querySelectorAll('table'), function (t) { return /Je Wohnung als ETW/.test(r6Text(t.querySelector('thead') || t)); })[0]; }, 6);
            await b2oZeile(s, 'Je Wohnung als Eigentumswohnung', 'Jede Wohnung einzeln am ETW-Markt: gleiches Baujahr, gleiche Flächenklasse' + (su && su[3] ? ' — zusammen <b>' + su[3] + '</b>' + (su[2] && su[2] !== '—' ? ', als Ertragswert ' + su[2] : '') : '') + '.', 1500);
          }
          var T3 = (function () { var x = mk(); return x && [].filter.call(x.querySelectorAll('table'), function (t) { return /Verlauf/.test(r6Text(t.querySelector('thead') || t)); })[0]; })();
          if (T3) {
            await zeige(function () { var x = mk(); var t = x && [].filter.call(x.querySelectorAll('table'), function (t) { return /Verlauf/.test(r6Text(t.querySelector('thead') || t)); })[0]; return t ? (t.closest('.dp-pot-scroll') || t) : null; }, 6);
            await b2oZeile(s, 'Der Verlauf', 'Jeder Abruf bleibt mit Datum stehen — mehrere ergeben den Verlauf, und er geht mit in den Marktbericht.', 1200);
          }
        }
      },
      async function (s) {   /* 13 · Tab Bewertung: Wertpotenzial */
        reiter('s6'); await warte(1400);
        var k = function () { var x = q('#card-wertpotenzial'); return x && x.offsetWidth ? x : null; };
        await warteAuf(function () { var x = k(); return x && !/wird gerechnet/i.test(x.textContent); }, 45000);
        var kopf = function () { var x = k(); return x && (x.querySelector('.ct') || x); };
        await zeige(kopf, 8);
        await b2oZeile(s, 'Tab Bewertung', 'Dieselben Zahlen im Reiter Bewertung: die Karte <b>„' + r6Text(kopf()).replace(/\s*Potenzialwert.*$/i, '') + '“</b>.');
        /* v2481m · v2543: „Wertüberleitung" (table.dp-wp-ueb) statt Wertbrücke - Zeilen live gelesen */
        var ue = function () { var x = k(); return x && x.querySelector('table.dp-wp-ueb'); };
        if (ue()) {
          await zeige(ue, 8);
          var uz = [].map.call(ue().querySelectorAll('tr'), function (r) { var l = r.querySelector('td.l'), v = r.querySelector('td.v'); return { t: l ? r6Text(l.childNodes[0] || l) : '', v: v ? r6Text(v) : '', cls: r.className }; });
          var un = uz.filter(function (z) { return /netto/.test(z.cls); })[0], ub = uz[0];
          DPM_REIHE.r26ueb = uz;
          await b2oZeile(s, 'Die Wertüberleitung', 'Zeile für Zeile: ' + (ub && ub.v ? 'vom Ertragswert im Bestand (<b>' + ub.v + '</b>)' : 'vom Ertragswert im Bestand') + ' über die Mehrwerte aus Mieterhöhung und Zielbild, abzüglich der Maßnahmen.', 1500);
          if (un) { await zeige(function () { var t = ue(); return t && t.querySelector('tr.netto'); }, 8); await b2oZeile(s, 'Potenzial netto', '<b>' + un.v + '</b> — die Balken stehen um null: was den Wert hebt, nach rechts, was ihn kostet, nach links.', 1200); }
        }
        var kpm = function () { var x = k(); var r = x && [].filter.call(x.querySelectorAll('table:not(.dp-wp-ueb) tbody tr'), function (r) { return /^Marktpreisindikation/.test(r6Text(r.cells[0] || r)); })[0]; return r ? (r.closest('table') || r) : null; };
        if (kpm()) {
          await zeige(kpm, 6);
          await b2oZeile(s, 'Kennzahlen je Stufe', 'Miete, Rendite, DSCR und Ertragswert je Stufe — und darunter die Marktpreisindikation, als Gegenprobe zum Ertragswert.', 1200);
        }
      },
      async function (s) {   /* 14 · Bank-PDF: Seite Wertpotenzial */
        reiter('s8'); await warte(1200);
        var zeileFn = function () { var e = rhIm('#s8', /^\s*Investment-PDF/); return e && (e.closest('[class*=row]') || e.parentElement); };
        await warteAuf(zeileFn, 5000);
        await zeige(zeileFn, 8);
        var zb = r6Beginn(s, 'Das Bank-PDF', 'Und für die Bank: das Bank-PDF bekommt eine eigene Seite „Wertpotenzial“.');
        var bank = await r26Bank();
        await r6Ende(zb);
        if (!bank) return;
        _r26.pdf = bank;
        try { var tx = await bank.text(); DPM_REIHE.pdf26 = { bytes: bank.size, seite: _r26.seite, namen: (tx.match(RH_PDF_NAMEN) || []).slice(0, 8) }; } catch (e) {}
        zeige(null); kegelHoch(true);
        await r19Seite(bank, _r26.seite || 1);
        await b2oZeile(s, 'Seite Wertpotenzial', 'Oben die Wohnungen: Ist, Mieterhöhung mit Termin, Zielmiete und Maßnahmen.');
        await r19Seite(bank, _r26.seite || 1, 330);   /* v2481g · gemessen: ab 330 px die ganze Wertbrücke (v2543: Wertüberleitung - Lage im Stichbild nachmessen) */
        await b2oZeile(s, 'Die Wertüberleitung', 'Auch im PDF: vom Bestand über Mieterhöhung und Zielbild, minus Maßnahmen — bis zum Potenzial netto.');
        /* v2481o · GEMESSEN im Video v2481n: bei 720 px auf der Seite stand nur noch der leere Seitenfuß -
           seit der Wertüberleitung (v2543) stehen die Kennzahlen je Stufe auf der Fortsetzungsseite */
        if (_r26.seiteN && _r26.seiteN > (_r26.seite || 1)) await r19Seite(bank, _r26.seiteN, 0); else await r19Seite(bank, _r26.seite || 1, 720);
        await b2oZeile(s, 'Kennzahlen je Stufe', 'Miete, Rendite, DSCR, Miete im Ertragswert und Ertragswert je Stufe — gekennzeichnet als Potenzialwert, keine Verkehrswertermittlung.', 1500);
        var o = q('#dpm-pdf'); if (o && o.parentNode) o.parentNode.removeChild(o);
        kegelHoch(false);
      },
      async function (s) {   /* 15 · Schluss */
        reiter('s0'); var m = q('.main-col'); if (m) m.scrollTop = 0; await warte(700);
        await zeige(function () { var b = q('#mfh-oeffnen'); return b && b.offsetWidth ? b : null; }, 10);
        await b2oZeile(s, 'Ist, Soll, Zielbild', 'Je Wohnung erfasst, je Stufe bewertet und am Markt gespiegelt — in Mietentwicklung, Pilot-Analyse, Bewertung und PDF. Gerechnet wird mit dem Bestand, das Potenzial steht daneben.', 1500);
      }
    ]
  };

  /* ═══ VIDEOREIHE · MODUL 27 · STEUERVERLAUF MIT WENDEPUNKT (v2481p) ═══════
     Marcel 20.10.2026: die Grafik aus v2544 (steuer-verlauf.js) - wann ein
     Objekt steuerlich positiv wird. Vorlage Funktionshandbuch 14 und 13.
     Paradefall DEMO-DT4 Bismarckstr. 27, Detmold; Gegenbild DEMO-BI1
     Westerfeldstr. 140, Bielefeld. BEIDE SIND GESPEICHERTE OBJEKTE UND
     WERDEN NICHT VERÄNDERT: es gibt keine Kopie, das Drehbuch LIEST nur.
     GEMESSEN (20.10.2026, eigener Tab mit Sperre): schon das LADEN schreibt -
     PUT /objects/<id> (Autospeichern) und POST /tax-snapshots/<id>, jeder
     Reiterwechsel noch einmal PUT /objects. Deshalb beantwortet der Spion im
     Lauf jedes Nicht-GET an /objects, /tax-records, /tax-snapshots und
     /tax-periods selbst (200, nichts geschrieben, DPM_REIHE.gesperrt) - mit
     Erfolg statt Fehler, sonst stünde „Fehler beim Speichern" im Bild.
     Nach dem Lauf bleibt die Sperre in DIESEM Tab, solange eins der beiden
     Objekte geladen ist (ein späteres Autospeichern schriebe den im Lauf
     umgeschalteten Zustand). Kein KI-Abruf: die Pilot-Analyse ist die
     gespeicherte. Jede Zahl liest das Drehbuch aus der Grafik, dem Tooltip,
     dem Steuerformular oder DpSteuerVerlauf.reihe() - keine steht im Text. */
  var R27_DT = 'c5278bb5-7012-4e1b-8372-7e5cef3500a1', R27_BI = R11_WESTERFELD;
  var _r27 = { schutz: [] };
  function r27Gesperrt(m, pfad) {
    /* v2481p · GEMESSEN im ersten Prüflauf (20.10.2026): beim Laden rechnet der Unterreiter
       „Marktbericht-Verlauf" der Pilot-Analyse einen KI-Text (POST /marktbericht/verlauf-text,
       OpenAI, dem Nutzer nicht berechnet) - zwei Abrufe je Durchgang. Im Lauf beantwortet. */
    if (m === 'POST' && /\/marktbericht\/verlauf-text$/.test(pfad) && lauf && _aktiv === DREHBUECHER['reihe-steuerverlauf']) return true;
    if (m === 'GET' || !_r27.schutz.length || !/\/api\/v1\/(objects|tax-records|tax-snapshots|tax-periods)(\/|$)/.test(pfad)) return false;
    if (lauf && _aktiv === DREHBUECHER['reihe-steuerverlauf']) return true;
    return !lauf && _r27.schutz.indexOf(window._currentObjKey) >= 0;
  }
  async function r27Laden(id, kuerzel) {
    if (_r27.schutz.indexOf(id) < 0) _r27.schutz.push(id);
    try { if (typeof setMainView === 'function') setMainView('single'); } catch (e) {}
    reiter('s0');
    if (typeof window.loadSaved === 'function') await window.loadSaved(id);
    await warteAuf(function () { return window._currentObjKey === id && /\S/.test(wert('str')); }, 9000);
    if (wert('kuerzel') !== kuerzel) { DPM_REIHE.r27fehler = 'falsches Objekt: ' + wert('kuerzel'); stopp(); throw 'stopp'; }
    await warte(900);
    var m = q('.main-col'); if (m) m.scrollTop = 0;
  }
  function r27Host() { var h = q('#tax-verlauf-chart'); return h && h.offsetWidth ? h : null; }
  function r27PaHost() { var p = r11Panel(); var h = p && p.querySelector('[data-dp-steuerverlauf]'); return h && h.offsetWidth ? h : null; }
  function r27Zahl(i, host) { return function () { var h = (host || r27Host)(); var z = h && h.querySelectorAll('.dp-stv-z'); return z && z[i] || null; }; }
  function r27ZahlW(i, host) { var z = r27Zahl(i, host)(); return z ? { t: r6Text(z.querySelector('span')), w: r6Text(z.querySelector('b')), u: r6Text(z.querySelector('em')) } : { t: '', w: '–', u: '' }; }
  function r27Sel(sel, host) { return function () { var h = (host || r27Host)(); return h ? h.querySelector(sel) : null; }; }
  function r27Reihe() { try { return window.DpSteuerVerlauf ? DpSteuerVerlauf.reihe() : null; } catch (e) { return null; } }
  function r27Idx(jahr) { var R = r27Reihe() || []; for (var i = 0; i < R.length; i++) if (R[i].jahr === jahr) return i; return -1; }
  function r27Hit(jahr, host) { return function () { var h = (host || r27Host)(); var i = r27Idx(jahr); return h && i >= 0 ? h.querySelector('.hit[data-i="' + i + '"]') : null; }; }
  /* Tooltip wie mit der Maus: mousemove auf die Trefferfläche des Jahres (steuer-verlauf.js hört darauf) */
  function r27Zeigen(jahr, host) {
    var t = r27Hit(jahr, host)(); if (!t) return null;
    var b = t.getBoundingClientRect();
    t.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height * 0.3 }));
    var tip = (host || r27Host)().querySelector('.dp-stv-tip');
    var o = {}; if (tip) [].forEach.call(tip.querySelectorAll('div'), function (d) { var s = d.querySelectorAll('span'); if (s.length === 2) o[r6Text(s[0])] = r6Text(s[1]); });
    return o;
  }
  function r27TipWeg() { [].forEach.call(document.querySelectorAll('.dp-stv-tip'), function (t) { t.style.display = 'none'; }); }
  /* Ereignislinien: Jahr über die Lage der Linie (x1 = linke Kante der Trefferfläche dieses Jahres) */
  function r27Ereignisse(host) {
    var h = (host || r27Host)(), R = r27Reihe() || []; if (!h) return [];
    var hits = [].slice.call(h.querySelectorAll('.hit')), txt = h.querySelectorAll('text.evt');
    return [].map.call(h.querySelectorAll('line.ev'), function (l, k) {
      var x = parseFloat(l.getAttribute('x1')), i = -1;
      hits.forEach(function (t, j) { if (Math.abs(parseFloat(t.getAttribute('x')) - x) < 0.3) i = j; });
      return { jahr: i >= 0 && R[i] ? R[i].jahr : null, text: txt[k] ? r6Text(txt[k]) : '', linie: l, beschr: txt[k] || l };
    });
  }
  function r27Oben(e, px) { if (!e) return; var s = scroller(e); if (s) s.scrollTop += rect(e).top - (px || 110); }
  function r27Eur(v) { return (v < 0 ? '−' : '+') + ' ' + Math.round(Math.abs(v)).toLocaleString('de-DE') + ' €'; }

  DREHBUECHER['reihe-steuerverlauf'] = {
    titel: 'Steuerverlauf mit Wendepunkt', unterzeile: 'Wann ein Objekt steuerlich positiv wird — und warum das der Zeitpunkt fürs nächste Investment ist', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () {
      r27TipWeg();
      try { if (typeof window.setTaxFormMode === 'function' && window._taxFormMode === 'detail') window.setTaxFormMode('quick'); } catch (e) {}
      rhAufraeumen();
    },
    szenen: [
      async function (s) {   /* 1 · das Beispiel */
        await rhNurStart();
        await r27Laden(R27_DT, 'DEMO-DT4');
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        var we = wert('einheiten');
        await b2oZeile(s, 'Das Beispiel', 'Ein Mehrfamilienhaus aus dem Bestand: <b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + (we ? ' — ' + we + ' Wohnungen' : '') + ', Kaufpreis <b>' + eur(zahl('kp')) + '</b>, gekauft am <b>' + datum(wert('kaufdat')) + '</b>.');
        await zeige(feldVon('kaufdat'), 10);
        await b2oZeile(s, 'Die Frage', 'Wann wird dieses Haus steuerlich positiv — ab wann zahlst du darauf Steuern? DealPilot zeigt es im Reiter Steuer auf einen Blick.', 800);
      },
      async function (s) {   /* 2 · Reiter Steuer: die Grafik, was V+V heißt */
        reiter('s3-tax'); await warte(1500);
        await warteAuf(r27Host, 6000);
        r27Oben(q('#tax-timeline-header'), 90); await warte(500);
        await zeige(function () { var k = q('#tax-timeline-header'); return k; }, 8);
        await b2oZeile(s, 'Steuerverlauf', 'Neu im Reiter Steuer: <b>' + r6Text(q('#tax-timeline-header')).replace(/^\s*/, '') + '</b>.');
        await zeige(r27Sel('.dp-stv-fuss'), 8);
        await b2oZeile(s, 'Was ist das Ergebnis aus V+V?', 'Einnahmen aus Vermietung minus Werbungskosten: Zinsen, Abschreibung, Bewirtschaftung, Erhaltung. Negativ senkt es deine Steuer — positiv zahlst du darauf.', 1500);
        var R = r27Reihe() || [];
        r27Oben(r27Sel('.dp-stv-leg')(), 90); await warte(400);
        await zeige(r27Sel('.dp-stv-ch svg'), 6);
        await b2oZeile(s, 'Ein Balken je Jahr', (R.length ? '<b>' + R[0].jahr + ' bis ' + R[R.length - 1].jahr + '</b>, die ganze Haltedauer. ' : '') + 'Grün: Verlust, das Finanzamt erstattet. Gold: Gewinn, Steuer fällig. Die Linie: Cashflow nach Steuern.', 1000);
      },
      async function (s) {   /* 3 · der Wendepunkt */
        var R = r27Reihe() || [], A = window.DpSteuerVerlauf ? DpSteuerVerlauf.auswerten(R) : {};
        DPM_REIHE.r27dt = { reihe: R.map(function (r) { return [r.jahr, Math.round(r.erg), Math.round(r.steuer), r.cf == null ? null : Math.round(r.cf)]; }), auswertung: A };
        r27Oben(r27Host(), 110); await warte(400);
        var z0 = r27ZahlW(0);
        await zeige(r27Zahl(0), 8);
        await b2oZeile(s, z0.t.charAt(0) + z0.t.slice(1).toLowerCase() + ' ' + z0.w, 'Erst ' + z0.u + ' dreht das Ergebnis ins Plus. Ab hier zahlst du auf dieses Objekt Steuern.');
        await zeigeGruppe(r27Sel('text.wpt'), r27Sel('line.wp'), 8);
        await b2oZeile(s, 'Die Linie', '„' + r6Text(r27Sel('text.wpt')()) + '“ — gestrichelt im Bild, links grün, rechts gold.');
        if (A.wende > 0) {
          await zeigeGruppe(r27Hit(R[0].jahr), r27Hit(R[A.wende - 1].jahr), 4);
          var j1 = R[A.wende - 1].jahr, rz = r15Zellen(j1);
          DPM_REIHE.r27quick = { jahr: j1, zellen: rz };
          await b2oZeile(s, 'Warum am Anfang Verluste?', (rz.length >= 4 ? 'In ' + j1 + ': Zinsen <b>' + rz[2] + '</b>, Abschreibung <b>' + rz[3] + '</b> — dazu Sanierung als Erhaltungsaufwand. ' : '') + 'Die Zinsen sind am Anfang am höchsten, die Abschreibung läuft jedes Jahr gleich.', 1500);
        }
      },
      async function (s) {   /* 4 · Tooltip je Jahr */
        var R = r27Reihe() || [], A = DpSteuerVerlauf.auswerten(R);
        if (A.wende > 0) {
          var jv = R[A.wende - 1].jahr, jw = R[A.wende].jahr;
          var tv = r27Zeigen(jv); await warte(300);
          await zeige(r27Sel('.dp-stv-tip'), 8);
          DPM_REIHE.r27tip = { vor: tv };
          await b2oZeile(s, 'Je Jahr der Tooltip · ' + jv, 'Einnahmen <b>' + (tv['Einnahmen'] || '–') + '</b>, Werbungskosten <b>' + (tv['Werbungskosten'] || '–') + '</b> — Ergebnis <b>' + (tv['Ergebnis V+V'] || '–') + '</b>, Erstattung <b>' + (tv['Erstattung'] || '–') + '</b>.', 1000);
          var tw = r27Zeigen(jw); await warte(300);
          await zeige(r27Sel('.dp-stv-tip'), 8);
          DPM_REIHE.r27tip.wende = tw;
          await b2oZeile(s, jw + ' · der Wendepunkt', 'Einnahmen <b>' + (tw['Einnahmen'] || '–') + '</b> statt ' + (tv['Einnahmen'] || '–') + ' — Ergebnis <b>' + (tw['Ergebnis V+V'] || '–') + '</b>, Steuer <b>' + (tw['Steuer'] || '–') + '</b>.' + (tw['Cashflow nach Steuern'] ? ' Cashflow nach Steuern ' + tw['Cashflow nach Steuern'] + '.' : ''), 1000);
          r27TipWeg();
        }
      },
      async function (s) {   /* 5 · die übrigen Kennzahlen und der Satz */
        r27Oben(r27Host(), 110); await warte(400);
        var z1 = r27ZahlW(1), z2 = r27ZahlW(2);
        await zeige(r27Zahl(1), 8);
        await b2oZeile(s, 'Erstattungen bis dahin', '<b>' + z1.w + '</b> in den Jahren ' + z1.u.replace('–', ' bis ') + ' — so viel hat das Haus deine Steuer gesenkt.');
        await zeige(r27Zahl(2), 8);
        await b2oZeile(s, 'Steuern ab dem Wendepunkt', '<b>' + z2.w + '</b> von ' + z2.u.replace('–', ' bis ') + ' — mit deinem Grenzsteuersatz gerechnet.');
        await zeige(r27Sel('.dp-stv-satz'), 8);
        await b2oZeile(s, 'Der Satz dazu', 'DealPilot fasst das Bild in Worte: wie lange das Haus deine Steuer senkt — und ab wann du darauf zahlst.', 800);
      },
      async function (s) {   /* 6 · Erklärkarte: der Zeitpunkt fürs nächste Investment */
        await zeigeGruppe(r27Sel('text.wpt'), r27Sel('line.wp'), 8);
        await b2oZeile(s, 'Der Zeitpunkt fürs nächste Investment', 'Ab dem Wendepunkt kostet das Haus Steuern. Ein weiteres Objekt mit Anfangsverlusten — Zinsen, AfA, Sanierung — oder geplanter Erhaltungsaufwand gleicht das aus.', 2000);
      },
      async function (s) {   /* 7 · Ereignislinien: Zinsbindung, § 23 */
        var E = r27Ereignisse();
        DPM_REIHE.r27ev = E.map(function (e) { return [e.jahr, e.text]; });
        var zb = E.filter(function (e) { return /Zinsbindung/.test(e.text); })[0], st = E.filter(function (e) { return /23/.test(e.text); })[0];
        if (zb) {
          await zeigeGruppe(function () { return zb.beschr; }, function () { return zb.linie; }, 8);
          var a = r15Zellen(zb.jahr - 1), b = r15Zellen(zb.jahr);
          DPM_REIHE.r27zins = { vor: a, nach: b };
          var zv = a[2], zn = b[2], mehr = (function () { var p = function (x) { return parseFloat(String(x || '').replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.')); }; return p(zn) > p(zv); })();
          await b2oZeile(s, 'Zinsbindung endet ' + zb.jahr, 'Kauf ' + String(wert('kaufdat')).slice(0, 4) + ' plus ' + wert('d1_bindj') + ' Jahre Zinsbindung.' + (mehr ? ' Danach rechnet DealPilot mit dem Anschlusszins: Zinsen ' + (zb.jahr - 1) + ' <b>' + zv + '</b>, ' + zb.jahr + ' <b>' + zn + '</b> — der Balken wird kleiner.' : ''));
        }
        if (st) {
          await zeigeGruppe(function () { return st.beschr; }, function () { return st.linie; }, 8);
          await b2oZeile(s, 'Die 10-Jahres-Frist · ' + st.jahr, 'Im Privatvermögen ist ein Verkaufsgewinn nach zehn Jahren steuerfrei (§ 23 EStG), gezählt von Kauf bis Verkauf. Bei einer GmbH gilt das nicht — dort fehlt die Linie.', 1500);
        }
      },
      async function (s) {   /* 8 · die Jahres-Kärtchen */
        var tl = function () { var b = q('#tax-timeline-box'); return b && b.offsetWidth ? b : null; };
        r27Oben(tl(), 140); await warte(400);
        await zeige(tl, 8);
        var su = /Summe über (\d+) Jahre:\s*([^\n]+)/.exec(String((tl() || {}).innerText || ''));
        DPM_REIHE.r27summe = su ? [su[1], su[2]] : null;
        await b2oZeile(s, 'Die Jahres-Kärtchen', 'Darunter dieselben Jahre als Kärtchen: Erstattung grün, Nachzahlung rot' + (su ? ' — Summe über ' + su[1] + ' Jahre: <b>' + su[2].trim() + '</b>' : '') + '.');
      },
      async function (s) {   /* 9 · Werbungskosten im Detail eines Verlustjahres */
        var R = r27Reihe() || [], A = DpSteuerVerlauf.auswerten(R);
        var J = A.wende > 0 ? R[A.wende - 1].jahr : (R[0] && R[0].jahr);
        r15Modus(1); await warte(900);
        await r15Jahr(J);
        var kopf = function () { var b = r15Box(); return b && b.querySelector('select'); };
        r15Oben(kopf()); await warte(400);
        await zeigeGruppe(function () { var b = r15Box(); return b && b.querySelector('.ytf-mode-btn.active'); }, kopf, 8);
        await b2oZeile(s, 'Werbungskosten im Detail · ' + J, 'Ein Jahr, jede Kostenart einzeln — gegliedert wie die Anlage V, jede Zeile mit Bemerkung.');
        var bem = function (re) { var t = r15Det(re); var i = t && [].filter.call(t.querySelectorAll('input,textarea'), function (x) { return x.type !== 'number' && x.value; })[0]; return i ? i.value : ''; };
        var kurz = function (t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + ' …' : t; };
        var er = function () { return r15Det(/^Erhaltungsaufwendungen/); };
        var ew = r15DetWert(/^Erhaltungsaufwendungen/), eb = bem(/^Erhaltungsaufwendungen/);
        if (er() && ew) {
          r15Oben(er()); await warte(400);
          await zeige(er, 6);
          await b2oZeile(s, 'Erhaltungsaufwand', '<b>' + ew + '</b>' + (eb ? ' — „' + kurz(eb, 110) + '“' : '') + '.', 1200);
          if (/3-Jahres-Frist|Drei-Jahres-Frist/i.test(eb)) await b2oZeile(s, 'Warum dieser Termin?', 'Nach dem Ende der Drei-Jahres-Frist zählt die 15-%-Grenze nicht mehr. Davor hätte die Sanierung zu Herstellungskosten werden können — Modul 23 zeigt die Grenze.', 1000);
        }
        var bw = r15DetWert(/^Bewegliche Wirtschaftsgüter/), bb = bem(/^Bewegliche Wirtschaftsgüter/);
        if (bw) {
          var bwz = function () { return r15Det(/^Bewegliche Wirtschaftsgüter/); };
          r15Oben(bwz()); await warte(300);
          await zeige(bwz, 6);
          await b2oZeile(s, 'Bewegliche Wirtschaftsgüter', '<b>' + bw + '</b>' + (bb ? ' — „' + kurz(bb, 90) + '“' : '') + '. Über zehn Jahre, getrennt vom Gebäude.');
        }
        var wk = r15Summe(/Werbungskosten gesamt:\s*([^\n]+)/), ein = r15Summe(/Einnahmen V\+V:\s*([^\n]+)/), erg = r15Summe(/Verlust\/Überschuss V\+V:\s*([^\n]+)/), eff = r15Summe(/Steuer-Effekt:\s*([^\n]+)/);
        DPM_REIHE.r27detail = { jahr: J, erhaltung: ew, bem: eb, bewegl: bw, wk: wk, ein: ein, erg: erg, eff: eff };
        var sum = function () { var b = r15Box(); return b ? [].filter.call(b.querySelectorAll('div'), function (d) { return d.offsetWidth && d.children.length <= 12 && /Werbungskosten gesamt/.test(d.textContent) && /Steuer-Effekt/.test(d.textContent); }).pop() || null : null; };
        if (wk && sum()) {
          r15Oben(sum(), 260); await warte(400);
          await zeige(sum, 8);
          await b2oZeile(s, 'Das Jahr ' + J + ' in Summe', 'Werbungskosten <b>' + wk + '</b>, Einnahmen <b>' + ein + '</b> — Ergebnis <b>' + erg + '</b>, Steuer-Effekt <b>' + eff + '</b>: genau der Balken ' + J + '.', 800);
          await b2oZeile(s, 'Eine Rechnung', 'Was hier steht, rechnet die Grafik mit — dieselben Jahreswerte wie das Steuerformular, kein zweiter Weg.');
        }
        r15Modus(0); await warte(600);
      },
      async function (s) {   /* 10 · Pilot-Analyse, Unterreiter Steuer (gespeicherte Analyse, kein Abruf) */
        reiter('s5'); await warte(1500);
        await warteAuf(function () { return q('#ai-content .dp-pa-tab'); }, 8000);
        await r11PaTab(/^Steuer$/);
        await warteAuf(r27PaHost, 5000);
        var karte = function () { var h = r27PaHost(); return h && h.closest('.dp-pa-card'); };
        r27Oben(karte(), 90); await warte(500);
        await zeige(karte, 8);
        var p0 = r27ZahlW(0, r27PaHost), p1 = r27ZahlW(1, r27PaHost);
        DPM_REIHE.r27pa = [p0, p1];
        await b2oZeile(s, 'Pilot-Analyse · Steuer', 'Dieselbe Grafik steht in der Pilot-Analyse: positiv ab <b>' + p0.w + '</b>, Erstattungen bis dahin <b>' + p1.w + '</b>.', 800);
      },
      async function (s) {   /* 11 · Gegenbild Westerfeldstr. 140 */
        await r27Laden(R27_BI, 'DEMO-BI1');
        await zeigeGruppe(feldVon('plz'), feldVon('baujahr'), 8);
        await b2oZeile(s, 'Das Gegenbild', '<b>' + wert('str') + ' ' + wert('hnr') + '</b>, ' + wert('ort') + ' — Kaufpreis <b>' + eur(zahl('kp')) + '</b>, gekauft am <b>' + datum(wert('kaufdat')) + '</b>.');
        reiter('s3-tax'); await warte(1500);
        await warteAuf(r27Host, 6000);
        r27Oben(r27Host(), 110); await warte(500);
        var R = r27Reihe() || [], A = DpSteuerVerlauf.auswerten(R), z0 = r27ZahlW(0);
        await zeige(r27Zahl(0), 8);
        await b2oZeile(s, 'Positiv ab ' + z0.w, z0.u.charAt(0).toUpperCase() + z0.u.slice(1) + ': kein Verlustjahr' + (R[0] && R[0].steuer < 0 ? ', Steuer ' + R[0].jahr + ' <b>' + eur(-R[0].steuer) + '</b>' : '') + '.');
        /* der Knick: Jahre NACH dem Wendepunkt, in denen erstattet wird (zusammenhängend, das erste Band) */
        var k0 = -1, k1 = -1;
        for (var i = Math.max(A.wende, 0) + 1; i < R.length; i++) { if (R[i].steuer > 0) { if (k0 < 0) k0 = i; k1 = i; } else if (k0 >= 0) break; }
        DPM_REIHE.r27bi = { reihe: R.map(function (r) { return [r.jahr, Math.round(r.erg), Math.round(r.steuer)]; }), auswertung: A, knick: k0 >= 0 ? [R[k0].jahr, R[k1].jahr] : null };
        if (k0 >= 0) {
          await zeigeGruppe(r27Hit(R[k0].jahr), r27Hit(R[k1].jahr), 4);
          var bs = []; for (var j = k0; j <= k1; j++) bs.push(r27Eur(R[j].steuer));
          await b2oZeile(s, 'Der gesteuerte Knick', R[k0].jahr + (k1 > k0 ? ' bis ' + R[k1].jahr : '') + ' werden zur Erstattung: <b>' + bs.join(' · ') + '</b>.', 800);
          var tk = r27Zeigen(R[k0].jahr); await warte(300);
          await zeige(r27Sel('.dp-stv-tip'), 8);
          await b2oZeile(s, R[k0].jahr + ' im Tooltip', 'Werbungskosten <b>' + (tk['Werbungskosten'] || '–') + '</b>, Ergebnis <b>' + (tk['Ergebnis V+V'] || '–') + '</b>, Erstattung <b>' + (tk['Erstattung'] || '–') + '</b>.');
          r27TipWeg();
          /* woher: Erhaltungsaufwand im Detail dieses Jahres, mit Bemerkung */
          r15Modus(1); await warte(900); await r15Jahr(R[k0].jahr);
          var er = function () { return r15Det(/^Erhaltungsaufwendungen/); };
          var ew = r15DetWert(/^Erhaltungsaufwendungen/), et = er(), ei = et && [].filter.call(et.querySelectorAll('input,textarea'), function (x) { return x.type !== 'number' && x.value; })[0];
          DPM_REIHE.r27bi.erhaltung = [ew, ei ? ei.value : ''];
          if (et && ew) {
            r15Oben(et); await warte(400);
            await zeige(er, 6);
            var eb = ei ? ei.value : '';
            await b2oZeile(s, 'Woher', 'Erhaltungsaufwand ' + R[k0].jahr + ': <b>' + ew + '</b>' + (eb ? ' — „' + (eb.length > 100 ? eb.slice(0, 99).replace(/\s+\S*$/, '') + ' …' : eb) + '“' : '') + '.', 1000);
          }
          r15Modus(0); await warte(600);
          r27Oben(r27Host(), 110); await warte(400);
          if (k1 + 1 < R.length && R[k1 + 1].steuer < 0) {
            await zeige(r27Hit(R[k1 + 1].jahr), 4);
            await b2oZeile(s, 'Ab ' + R[k1 + 1].jahr + ' wieder Steuer', 'Steuer <b>' + eur(-R[k1 + 1].steuer) + '</b> im Jahr ' + R[k1 + 1].jahr + ' — der Balken ist wieder gold.');
          }
          await zeigeGruppe(r27Hit(R[k0].jahr), r27Hit(R[k1].jahr), 4);
          await b2oZeile(s, 'Geplant, nicht zufällig', 'Die Maßnahmen liegen in den Jahren mit Steuerlast — nach der Drei-Jahres-Frist, sonst griffe die 15-%-Grenze. Die Grafik zeigt, wo eine Maßnahme die Kurve dreht.', 1500);
        }
      },
      async function (s) {   /* 12 · Schluss: keine Steuerberatung */
        await zeige(r27Sel('.dp-stv-fuss'), 8);
        await b2oZeile(s, 'Keine Steuerberatung', 'DealPilot rechnet mit deinen Eingaben und deinem Grenzsteuersatz. Was du aus dem Wendepunkt machst, besprichst du mit deinem Steuerberater.', 1200);
        r27Oben(r27Host(), 110); await warte(400);
        await zeige(r27Sel('.dp-stv-ch svg'), 6);
        await b2oZeile(s, 'Steuerverlauf mit Wendepunkt', 'Wann das Haus steuerlich positiv wird — und wann es Zeit fürs nächste Investment ist.', 1000);
      }
    ]
  };

  /* ═══ WEBINAR · KOMPLETTBEISPIEL MEHRFAMILIENHAUS (v3015) ════════════════
     Marcel 27.10.2026: „Das Video und die Eingaben laufen viel zu schnell, das
     kann keiner in der Schnelle verarbeiten. Das darf gerne ein großes Webinar
     sein, detailliert erklärt.“ Neun Kapitel mit Zwischentitel (Einführung ·
     Objekt anlegen · Einheiten erfassen · Miete · Finanzierung · Steuer ·
     Marktbericht und Wertermittlung · Zielbild · Ergebnis und Bank-PDF).
     Jede Eingabe in Tipptempo (KM_TIPP), vor jedem Feld 2,5 s Pause, nach jedem
     Ergebnis 5 s Standzeit; zu jedem Schritt eine Tafel mit drei Punkten (was du
     eingibst, warum, was daraus folgt) - im Studio rechts neben der App.
     Zu jeder Zeile ein längerer Sprechtext in DPM_ZEILEN[].sprich (für die
     Vertonung, als Datei abgelegt); die Zeile steht so lange, wie er dauert.

     DAS HAUS: Parkstr. 9, 32545 Bad Oeynhausen, aus dem Demo-Konto - mit seinen
     ECHTEN Eingaben (Zeile vom 27.10.2026, md5 data d166b005…). Das echte Objekt
     wird NIE geladen und nie gespeichert: „Neues Objekt“ (rhStart), alles getippt,
     beim Aufräumen gelöscht (auch bei Esc). Zielbild-Pläne (Kapitel 8) sind
     Beispiele des Drehbuchs, nicht die des Demo-Objekts.

     KEIN ABRUF JE DURCHGANG. Der Marktbericht Stufe 3 ist der echte Bericht 371
     dieses Hauses (Staging, 27.10.2026, Stichtag 27.10.2026), in
     js/messe-komplett-daten.js als ROHER Payload (mb.market_reports 371) - im
     Lauf über den Stream gespielt. Seine Eingaben (ref) sind genau die, die das
     Drehbuch tippt (geprüft im Prüflauf: kmRefPruefen). Den vollen Bericht zeigt
     das Marktbericht-Fenster per GET (/reports/one?id=371, kein Kontingent);
     der Verlauf des neuen Objekts zeigt auf ihn. Geokodierung, Webrecherche,
     Pilot-Analyse, Ertragswert je Stufe: nicht im Video (gesperrt, RH_SPERRE).
     Entwicklung: window.DPM_HALT = N hält VOR Szene N, window.DPM_WEITER = 1. */
  var KM = {
    kuerzel: 'Parkstr. 9 · Webinar', str: 'Parkstr.', hnr: '9', plz: '32545', ort: 'Bad Oeynhausen',
    baujahr: '1905', etagen: '3', gsfl: '720', bgf: '576', kaufdat: '2024-12-23', brw: '250', brwStichtag: '2026-01-01',
    stellpl: '4', kp: '395000', makler: '3,57', moebl: '7000', d1: '324000', d1z: '4,0', d1t: '1,0', bindj: '10', gebAnt: '54,31',
    /* Modernisierung in den letzten Jahren - je Gewerk die volle Punktzahl nach Anlage 2 (zusammen 8, wie im Bericht) */
    mod: [['mod_heizung', '< 5 Jahre', 'Heizung'], ['mod_baeder', '< 5 Jahre', 'Bäder'], ['mod_leitungen', '< 5 Jahre', 'Leitungen'], ['mod_innenausbau', '< 5 Jahre', 'Innenausbau']],
    ausst: [['ausst_dach', '2'], ['ausst_fenster', '2'], ['ausst_heizung', '2']],
    lage: [['lageklasse', 'C', 'Lageklasse'], ['makrolage', 'durchschnittlich', 'Makrolage'], ['mikrolage', 'sehr_schwach', 'Mikrolage'],
           ['ds2_bevoelkerung', 'stabil', 'Bevölkerung'], ['ds2_nachfrage', 'mittel', 'Nachfrage'], ['ds2_wertsteigerung', 'mittel', 'Wertsteigerung'], ['ds2_entwicklung', 'eine_starke', 'Entwicklung']],
    /* nr, lage, wfl, zimmer, ist, status, Gesamtzustand (5 neuwertig … 1 stark sanierungsbedürftig) */
    we: [['1', 'EG links', '92', '3', '644', 'vermietet', '2'], ['2', 'EG rechts', '86', '3', '602', 'vermietet', '2'],
         ['3', '1. OG links', '92', '3', '874', 'vermietet', '1'], ['4', '1. OG rechts', '86', '3', '620', 'vermietet', '2'],
         ['5', 'DG', '71', '2', '455', 'vermietet', '1']],
    /* Wohnung 1: Staffelmiete wie im Demo-Objekt */
    staffel: { mv_art: 'staffel', mv_beginn: '2022-04-01', mv_letzte_erhoehung: '2025-04-01', mv_erhoehung_art: 'prozent', mv_erhoehung_wert: '3', mv_rhythmus_jahre: '2', mv_stufen_offen: '4', mv_naechste_anpassung: '2027-04-01' },
    grundsteuer: '336', hgNul: '7680', wegR: '798',
    /* Kapitel 8 · Zielbild (Beispiel des Drehbuchs) */
    zbJahr: '2029',
    haus: [['fassade', '60000', true, '30']],
    plan: {
      1: { mv_art: 'unbefristet', mv_letzte_erhoehung: '2023-03-01', vgl_qm: '7,60' },
      2: { mass: [['bad', '18000'], ['boeden', '9000']], ziel_qm: '10,00', ziel_wann: 'bei Mieterwechsel' },
      4: { mass: [['bad', '15000'], ['renovierung', '6000']], ziel_qm: '9,50', ziel_wann: 'bei Mieterwechsel' }
    }
  };
  var KM_TIPP = 150;   /* ms je Zeichen - Tipptempo */
  var KM_BERICHT = 371;   /* der echte Stufe-3-Bericht der Parkstr. 9 (Staging) */
  var KM_BUSTER = 'v3015';
  var _km = {};
  window.DPM_KM = window.DPM_KM || { gespielt: [], tafeln: [] };
  function kmParam(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
  async function kmHalt(i) {
    var h = Number(kmParam('halt') || window.DPM_HALT || 0);
    if (!h || i + 1 < h) return;
    window.DPM_HALT_STEHT = i + 1;
    await new Promise(function (ok, x) {
      var l = lauf, t = setInterval(function () {
        if (l !== lauf) { clearInterval(t); x('stopp'); return; }
        if (window.DPM_WEITER) { window.DPM_WEITER = 0; window.DPM_HALT_STEHT = 0; clearInterval(t); ok(); }
      }, 300);
    });
  }
  function kmOpt(id) { var e = document.getElementById(id); return e && e.selectedIndex >= 0 ? r6Text(e.options[e.selectedIndex]) : ''; }
  function kmMonat(iso) { var m = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']; return iso ? m[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4) : ''; }
  function kmEur(id) { var n = zahl(id); return n == null ? '–' : eur(n); }

  /* ── Tempo, Tafel, Kapitel ──────────────────────────────────────────── */
  /* window.DPM_KM_SCHNELL (nur Entwicklung, z. B. 0.2) kürzt Pausen und Tippen - im Video nie gesetzt */
  function kmT() { return Math.max(15, Math.round(KM_TIPP * kmF())); }
  function kmF() { var f = Number(window.DPM_KM_SCHNELL); return f > 0 && f < 1 ? f : 1; }
  async function kmPause(ms) { await warte(Math.round(ms * kmF() / TEMPO)); }   /* echte Millisekunden */
  function kmTafelText(t) { return t ? [t.was, t.warum, t.folge].join(' ') : ''; }
  /* Standzeit: Lesezeit des Bandes, der Tafel (4 s + 1 s je 15 Zeichen) oder Sprechdauer (13 Zeichen/s + 1,5 s) - das Längste */
  function kmDauer(titel, text, sprich, tafel) {
    /* v3015b · gemessen am Prüflauf (104 Zeilen): mit der Sprechdauer als Untergrenze wären es ~45 min geworden.
       Das stumme Video steht nach der Lesezeit: Band (4 s + 1 s je 15 Zeichen) oder Tafel (3 s + 1 s je 20 Zeichen,
       sie steht neben dem Band und wird mitgelesen). ?sprechtempo (später, mit Sprecher) nimmt die Sprechdauer dazu. */
    var l = lies(titel, text), tf = tafel ? Math.round((3000 + 1000 * kmTafelText(tafel).length / 20) / TEMPO) : 0;
    var sp = sprich && kmParam('sprechtempo') != null ? Math.round((1500 + 1000 * String(sprich).length / 13) / TEMPO) : 0;
    return Math.round(Math.max(l, tf, sp) * kmF());
  }
  function kmMerke(sprich, tafel) { try { var z = window.DPM_ZEILEN; if (z && z.length) { z[z.length - 1].sprich = sprich || null; if (tafel) z[z.length - 1].tafel = tafel; } } catch (e) {} }
  /* die Tafel: im Studio rechts neben der App, sonst oben rechts im Bild */
  function kmTafel(t) {
    _km.tafel = t || null;
    if (t) DPM_KM.tafeln.push(t.was);
    if (STUDIO) { anStudio({ type: 'tafel', tafel: t || null }); return; }
    var e = el('dpm-tafel');
    if (!t) { e.style.display = 'none'; return; }
    e.style.cssText = 'position:fixed;z-index:10073;right:16px;top:70px;width:360px;padding:14px 16px;border-radius:12px;background:rgba(10,9,7,.94);border:1px solid ' + G + ';color:#FDFCFA;font:400 14px/1.45 Inter,sans-serif;pointer-events:none';
    e.innerHTML = [['Was du eingibst', t.was], ['Warum', t.warum], ['Was daraus folgt', t.folge]].map(function (x) { return '<div style="margin:0 0 8px"><div style="font:600 10px JetBrains Mono,monospace;letter-spacing:.16em;text-transform:uppercase;color:' + G + '">' + x[0] + '</div>' + x[1] + '</div>'; }).join('');
  }
  async function kmSag(s, titel, text, sprich, nach, tafel) {
    if (tafel !== undefined) kmTafel(tafel);
    s.zeile(titel, text); kmMerke(sprich, tafel);
    await warte(kmDauer(titel, text, sprich, tafel));
    await kmPause(nach == null ? 4500 : nach);
  }
  /* eine Eingabe: Ziel zeigen, Band und Tafel, 2,5 s Pause, tippen, Standzeit (mindestens Sprech-/Lesedauer), 5 s Ruhe */
  async function kmEingabe(s, ziel, titel, text, tafel, sprich, aktion, nach) {
    if (Array.isArray(ziel)) await zeigeGruppe(ziel[0], ziel[1], 8); else if (ziel) await zeige(ziel, 10);
    kmTafel(tafel);
    s.zeile(titel, text); kmMerke(sprich, tafel);
    var t0 = Date.now(), soll = kmDauer(titel, text, sprich, tafel) * TEMPO;
    await kmPause(2500);
    if (aktion) await aktion();
    var rest = soll - (Date.now() - t0); if (rest > 300) await warte(rest >= 600 * TEMPO ? rest / TEMPO : rest);
    await kmPause(nach == null ? 4500 : nach);
  }
  async function kmTipp(id, v) {
    await kmPause(2200);   /* vor jedem Feld */
    var e = document.getElementById(id); if (e) { try { e.focus(); } catch (x) {} }
    await tippeH(id, String(v), kmT());
    if (e) e.dispatchEvent(new Event('blur', { bubbles: true }));
    await kmPause(900);
  }
  /* Maßnahmen einer Wohnung in Tipptempo: Baustein wählen, Pause, Kosten tippen */
  async function kmMassnahmen(liste) {
    for (var j = 0; j < liste.length; j++) {
      await kmPause(1500);
      var c = r26We('[data-zb-chip="' + liste[j][0] + '"]'); if (c && !c.classList.contains('on')) c.click();
      await kmPause(1500);
      var n = document.querySelectorAll('#mfh-we-ov [data-zb-k]').length;
      await r26Tippe(r26We('[data-zb-k="' + (n - 1) + '"]'), liste[j][1], kmT());
    }
  }
  async function kmWahl(id, v) { await kmPause(2200); r6Setz(id, v); await kmPause(1500); }
  /* Zwischentitel: im Studio das Reihen-Intro des Baukastens mit „Kapitel n“, sonst die Titelkarte */
  async function kmKapitel(s, nr, titel, unter, sprich) {
    zeige(null); kegelHoch(false); kmTafel(null);
    if (STUDIO) anStudio({ type: 'zwischentitel', nr: nr, titel: titel, unter: unter });
    else karte('<div class="k">Kapitel ' + nr + ' von 9</div><h1>' + titel + '</h1><p>' + unter + '</p>');
    s.zeile('Kapitel ' + nr + ' · ' + titel, unter); kmMerke(sprich);
    await warte(Math.max(kmDauer('Kapitel ' + nr + ' · ' + titel, unter, sprich), Math.round(8500 * kmF() / TEMPO)));
    if (STUDIO) anStudio({ type: 'zwischentitel-weg' }); else karte(null);
    await kmPause(1200);
  }

  /* ── Mitschnitt: Bericht 371 über den Stream, Verlauf zeigt auf ihn ────── */
  function kmLaden() {
    return new Promise(function (ok) {
      if (window.DPM_KOMPLETT_DATEN) { ok(true); return; }
      var s = document.createElement('script'); s.src = 'js/messe-komplett-daten.js?v=' + KM_BUSTER;
      s.onload = function () { ok(!!window.DPM_KOMPLETT_DATEN); }; s.onerror = function () { ok(false); };
      document.head.appendChild(s);
    });
  }
  function kmStrom(steps, data) {
    var enc = new TextEncoder(), i = 0;
    var rs = new ReadableStream({ pull: function (c) {
      return new Promise(function (ok) {
        setTimeout(function () {
          if (i < steps.length) c.enqueue(enc.encode(JSON.stringify({ type: 'step', msg: steps[i++] }) + '\n'));
          else { c.enqueue(enc.encode(JSON.stringify({ type: 'done', result: { report_id: null, object_key: null, cost: 0, data: JSON.parse(JSON.stringify(data)) } }) + '\n')); c.close(); }
          ok();
        }, i < steps.length ? Math.round(900 * TEMPO) : 300);
      });
    } });
    return new Response(rs, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
  }
  /* wird aus rhAntwort gefragt (nur in diesem Drehbuch) - null = nicht zuständig */
  function kmAntwort(u, m, opt) {
    var D = window.DPM_KOMPLETT_DATEN; if (!D || !_rh || _aktiv !== DREHBUECHER['komplett-mfh']) return null;
    var body = null; try { body = opt && typeof opt.body === 'string' ? JSON.parse(opt.body) : null; } catch (e) {}
    if (m === 'POST' && /\/marktbericht\/reports\/generate-stream/.test(u)) {
      var st = body && body.wert_stufe ? Number(body.wert_stufe) : 1;
      if (st !== 3) { DPM_REIHE.gesperrt.push('POST generate-stream Stufe ' + st); return new Response(JSON.stringify({ error: 'Vorführung: Abruf gesperrt' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }   /* nur Stufe 3 liegt vor - nie der Mitschnitt eines anderen Hauses */
      _km.ref = (body && body.object) || body;
      _rh.berichte.push({ stufe: 3, at: new Date().toISOString(), p: JSON.parse(JSON.stringify(D.mb3.data)) });
      DPM_KM.gespielt.push('mb3');
      return kmStrom(D.mb3.steps || [], D.mb3.data);
    }
    if (m === 'GET' && /\/marktbericht\/objects\/history\?/.test(u) && _rh.berichte.length) {
      var ref = decodeURIComponent((u.match(/[?&](?:ref|key)=([^&]+)/) || [])[1] || '').replace(/^dp:/, '');
      if (ref && DPM_REIHE.angelegt.indexOf(ref) >= 0) {
        var h = rhVerlauf().map(function (r) { r.report_id = KM_BERICHT; r.wert_stufe = 3; return r; });
        DPM_KM.gespielt.push('verlauf');
        return rhJ({ history: h });
      }
    }
    return null;
  }
  /* Prüfung im Lauf: kommen die getippten Eingaben im Auftrag so an, wie der Bericht sie trägt? */
  /* die Felder des echten Objekts (Zeile vom 27.10.2026), aus denen Bericht 371 entstand */
  var KM_SOLL = { plz: '32545', ort: 'Bad Oeynhausen', str: 'Parkstr.', hnr: '9', objart: 'MFH', baujahr: '1905', wfl: '427', gsfl: '720', kp: '395000',
    einheiten: '5', nkm: '3195', mod_punkte: '8', standardstufe: '2', ds2_energie: 'G', ds2_zustand: 'renovierungsbeduerftig', stellpl_aussen: '4',
    etagen_ges: '3', bgf: '576', brw: '250', vermstand: 'Vollvermietet', nutzungsart: 'kapitalanlage', kaufdat: '2024-12-23', garagen: '0',
    ausst_dach: '2', ausst_fenster: '2', ausst_heizung: '2' };
  function kmNorm(v) { var s = String(v == null ? '' : v).trim(), n = s.replace(/\./g, '').replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(n) ? String(parseFloat(n)) : s; }
  function kmRefPruefen() {
    var o = _km.ref || {}, ab = [];
    Object.keys(KM_SOLL).forEach(function (k) {
      if (!(k in o)) { ab.push(k + ': fehlt im Auftrag'); return; }
      if (kmNorm(o[k]) !== kmNorm(KM_SOLL[k])) ab.push(k + ': Bericht ' + KM_SOLL[k] + ' / Lauf ' + o[k]);
    });
    DPM_KM.refAbweichung = ab; DPM_KM.refAuftrag = o;
    return ab;
  }

  /* ── Bank-PDF (wie Modul 19) ─────────────────────────────────────────── */
  async function kmBankPdf() {
    var bank = await r19Bank();
    if (bank) { try { var tx = await bank.text(), mm = /Seite 1 von (\d+)/.exec(tx); _r19.roh = tx; _r19.seiten = mm ? Number(mm[1]) : null; _r19.tok = (tx.match(/\(([^()]{1,80})\) Tj/g) || []).map(function (x) { return x.slice(1, -4); }); DPM_KM.pdf = { bytes: bank.size, seiten: _r19.seiten, namen: (tx.match(RH_PDF_NAMEN) || []).slice(0, 8), ziel: (function () { var T = _r19.tok || [], i = -1; T.forEach(function (x, j) { if (i < 0 && /^(WERTPOTENZIAL|ZIELBILD)/.test(x)) i = j; }); return i < 0 ? null : T.slice(i, i + 40).join(' | ').slice(0, 900); })() }; } catch (e) {} }
    return bank;
  }

  DREHBUECHER['komplett-mfh'] = {
    titel: 'Komplettbeispiel Mehrfamilienhaus', unterzeile: 'Das große Webinar — ein Haus, alle Schritte, ausführlich erklärt', objekt: null,
    abspann: [{ ms: 6200, html: ABSPANN_LOGO }],
    aufraeumen: function () {
      var w = q('#mfh-we-ov'); if (w) w.remove(); var m = q('#mfh-modal'); if (m) m.remove();
      try { r19Zu(); } catch (e) {} try { r16MbZu(); } catch (e) {}
      kmTafel(null); var t = q('#dpm-tafel'); if (t) t.remove();
      try { document.documentElement.classList.remove('dpm-km'); } catch (e) {}
      karte(null);
      rhAufraeumen();
    },
    szenen: [
      /* ════ KAPITEL 1 · EINFÜHRUNG ════ */
      async function (s) {
        _km = {}; DPM_KM.gespielt = []; DPM_KM.tafeln = []; DPM_KM.refAbweichung = null;
        /* fremde Hinweise aus dem Konto (Pille „Marktbericht fertig · …“ eines anderen Objekts) nicht im Bild */
        try { document.documentElement.classList.add('dpm-km'); if (!q('#dpm-km-css')) { var kc = document.createElement('style'); kc.id = 'dpm-km-css'; kc.textContent = 'html.dpm-km #dp-mba-pille{display:none!important}'; document.head.appendChild(kc); } } catch (e) {}
        await kmLaden();
        await rhStart(0);
        await kmKapitel(s, 1, 'Einführung', 'Ein Mehrfamilienhaus, von der ersten Eingabe bis zum Bank-PDF.',
          'Willkommen zum großen Komplettbeispiel. Wir nehmen uns heute Zeit und gehen mit einem einzigen Mehrfamilienhaus den ganzen Weg durch DealPilot: wir legen es an, erfassen jede Wohnung, die Miete, die Finanzierung und die Steuer, holen den Marktbericht mit der Wertermittlung, planen ein Zielbild und landen am Ende beim Ergebnis und beim PDF für die Bank.');
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeige(function () { return q('#hdr-obj') || q('header.hdr'); }, 8);
        await kmSag(s, 'Ein neues Objekt', 'Wir starten leer: <b>„Neues Objekt“</b> — und tippen jedes Feld selbst.',
          'Wir beginnen mit einem leeren Objekt. DealPilot könnte ein Exposé auslesen oder eine Sprachaufnahme verstehen. Heute tippen wir jedes Feld selbst, damit du siehst, was wofür gebraucht wird.', null,
          { was: 'Nichts — ein leeres Objekt über „Neues Objekt“.', warum: 'Jedes Feld einmal sehen und verstehen, wofür es gebraucht wird.', folge: 'Alle Zahlen im Video rechnet die App aus genau diesen Eingaben.' });
        await zeige(function () { return q('nav.tabs'); }, 6);
        var tabs = [].map.call(document.querySelectorAll('nav.tabs .tab[data-target-sec]'), function (t) { return t.offsetWidth ? r6Text(t) : null; }).filter(Boolean);
        await kmSag(s, 'Die Reiter', (tabs.length ? tabs.length + ' Reiter: ' + tabs.join(' · ') : 'Die Reiter oben') + '. Die wichtigsten gehen wir heute durch.',
          'Oben siehst du die Reiter: ' + (tabs.length ? tabs.join(', ') : 'Objekt, Investition, Miete und so weiter') + '. Sie sind die Kapitel eines Objekts. Wir gehen die wichtigsten durch — in der Reihenfolge, in der man ein Haus durchdenkt: erst das Objekt und seine Wohnungen, dann Miete, Finanzierung und Steuer, dann Wert, Plan und Ergebnis.', null,
          { was: 'Noch nichts — wir schauen uns die Reiter an.', warum: 'Jeder Reiter ist ein Kapitel des Objekts.', folge: 'Was du in einem Reiter einträgst, rechnet in allen anderen mit.' });
        var stz = function () { return q('#oe-stufen') || q('#oab-dp-stufen'); };
        if (stz()) {
          await zeige(stz, 8);
          await kmSag(s, 'Drei Eingabestufen', 'Oben steht, was für die Marktbewertung noch fehlt — <b>Stufe 1, 2 und 3</b>.',
            'Ganz oben zeigt DealPilot die Eingabestufen. Für eine schnelle Marktpreisindikation reicht wenig, für die amtliche Wertermittlung in Stufe drei braucht es mehr Angaben. Die Liste darunter sagt dir jederzeit, was noch fehlt. Unser Ziel heute ist Stufe drei.', null,
            { was: 'Noch nichts — die Liste zeigt, was fehlt.', warum: 'Die Wertermittlung braucht vollständige Angaben.', folge: 'Ist Stufe 3 erreicht, kann der Marktbericht amtlich rechnen.' });
        }
        await kmSag(s, 'Das Beispiel', 'Ein Haus aus dem Demo-Konto: <b>' + KM.str + ' ' + KM.hnr + ', ' + KM.ort + '</b> — fünf Wohnungen, Baujahr ' + KM.baujahr + '.',
          'Unser Beispiel ist ein echtes Haus aus dem Demo-Konto: die ' + KM.str.replace('Parkstr.', 'Parkstraße') + ' ' + KM.hnr + ' in ' + KM.ort + '. Ein Altbau von ' + KM.baujahr + ' mit fünf Wohnungen. Wir tippen seine echten Angaben ab — und das Original im Konto bleibt dabei unberührt.', null,
          { was: 'Die Angaben eines echten Hauses aus dem Demo-Konto.', warum: 'Echte Daten zeigen echte Ergebnisse — keine geschönten.', folge: 'Am Ende stehen Score, Marktwert, Zielbild und Bank-PDF für dieses Haus.' });
      },

      /* ════ KAPITEL 2 · OBJEKT ANLEGEN ════ */
      async function (s) {
        await kmKapitel(s, 2, 'Objekt anlegen', 'Adresse, Objektart, Baujahr, Grundstück, Modernisierung, Lage.',
          'Kapitel zwei: das Objekt anlegen. Hier entstehen die Grundlagen, auf denen später jede Rechnung steht — Adresse, Objektart, Baujahr, Grundstück, der Stand der Modernisierung und die Lage.');
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        await kmEingabe(s, [feldVon('plz'), feldVon('hnr')], 'Die Adresse', 'PLZ, Ort, Straße und Hausnummer: <b>' + KM.plz + ' ' + KM.ort + ', ' + KM.str + ' ' + KM.hnr + '</b>.',
          { was: 'Postleitzahl, Ort, Straße, Hausnummer.', warum: 'An der Adresse hängen Lage, Bodenrichtwert und der zuständige Gutachterausschuss.', folge: 'Der Marktbericht findet später genau diese Stelle auf der Karte.' },
          'Zuerst die Adresse. Das ist mehr als eine Anschrift: an ihr hängen die Lage, der Bodenrichtwert und der zuständige Gutachterausschuss, dessen Daten später in die Wertermittlung gehen.',
          async function () { await kmTipp('plz', KM.plz); await kmTipp('ort', KM.ort); await kmTipp('str', KM.str); await kmTipp('hnr', KM.hnr); });
        await kmEingabe(s, feldVon('objart'), 'Objektart', '<b>Mehrfamilienhaus</b> — davon hängt ab, welche Felder und welche Rechenwege gelten.',
          { was: 'Objektart: Mehrfamilienhaus.', warum: 'Die Art bestimmt Felder, Bewirtschaftungskosten und den Liegenschaftszins.', folge: 'Darunter erscheint die Erfassung der einzelnen Einheiten.' },
          'Die Objektart: Mehrfamilienhaus. Das ist keine Formsache. Davon hängt ab, welche Felder erscheinen, welche Bewirtschaftungskosten angesetzt werden und welcher Liegenschaftszins in der Wertermittlung gilt.',
          async function () { await kmWahl('objart', 'MFH'); });
        await kmEingabe(s, feldVon('nutzungsart'), 'Nutzungsart', '<b>' + (function () { var e = document.getElementById('nutzungsart'); var o = e && [].filter.call(e.options, function (x) { return x.value === 'kapitalanlage'; })[0]; return o ? r6Text(o) : 'Vermietet'; })() + '</b> — wir sind Vermieter.',
          { was: 'Nutzungsart: vermietet als Kapitalanlage.', warum: 'Vermieter rechnen anders als Selbstnutzer.', folge: 'Steuer als Einkünfte aus Vermietung, Cashflow aus Sicht des Vermieters.' },
          'Die Nutzungsart: vermietet, als Kapitalanlage. Dadurch rechnet DealPilot die Steuer als Einkünfte aus Vermietung und Verpachtung und den Cashflow aus Sicht des Vermieters. Der Marktbericht braucht die Angabe ebenfalls.',
          async function () { await kmWahl('nutzungsart', 'kapitalanlage'); });
        var kasten = function () { var k = q('#mff-kasten'); return k && k.offsetWidth ? k : null; };
        await warteAuf(kasten, 3000);
        if (kasten()) {
          await zeige(kasten, 8);
          await kmSag(s, 'Mit Einheiten erfassen', 'Der Erklärkasten: Fläche, Miete, Vermietungsstand und Zustand kommen bei einem Haus <b>aus den Einheiten</b>.',
            'Sofort erscheint ein Erklärkasten. Bei einem Haus mit Einheiten erfassen wir jede Wohnung einzeln. Daraus füllen sich Wohnfläche, Anzahl der Wohnungen, Zimmer, Nettokaltmiete, Vermietungsstand und der Zustand des Gebäudes von selbst. Das machen wir im nächsten Kapitel.', null,
            { was: 'Noch nichts — der Kasten erklärt die Einheiten.', warum: 'Ein Haus ist die Summe seiner Wohnungen.', folge: 'Fläche, Miete und Zustand kommen später aus den Einheiten.' });
        }
        await kmEingabe(s, [feldVon('baujahr'), feldVon('etagen_ges')], 'Baujahr und Etagen', 'Baujahr <b>' + KM.baujahr + '</b>, ' + KM.etagen + ' Etagen.',
          { was: 'Baujahr ' + KM.baujahr + ', Anzahl Etagen ' + KM.etagen + '.', warum: 'Aus Baujahr und Modernisierung ergibt sich die Restnutzungsdauer.', folge: 'Sie steckt im Ertragswert, im Sachwert und in der Abschreibung.' },
          'Baujahr ' + KM.baujahr + ', drei Etagen. Das Baujahr ist eine der wichtigsten Zahlen überhaupt: aus ihm und den Modernisierungen ergibt sich die Restnutzungsdauer, und die steckt im Ertragswert, im Sachwert und in der Abschreibung.',
          async function () { await kmTipp('baujahr', KM.baujahr); await kmTipp('etagen_ges', KM.etagen); });
        await kmEingabe(s, [feldVon('standardstufe'), feldVon('ds2_energie')], 'Ausstattung und Energie', 'Standardstufe <b>2</b> (einfach), Energieklasse <b>G</b>.',
          { was: 'Standardstufe 2 nach NHK 2010, Energieklasse G.', warum: 'Die Standardstufe bestimmt die Herstellungskosten im Sachwert.', folge: 'Die Energieklasse geht ins Risiko des Deal Score ein.' },
          'Die Standardstufe nach den Normalherstellungskosten: zwei, also einfach. Sie bestimmt im Sachwertverfahren, was das Gebäude neu kosten würde. Dazu die Energieklasse G — die geht in die Risikobewertung des Deal Score ein.',
          async function () { await kmWahl('standardstufe', '2'); await kmWahl('ds2_energie', 'G'); });
        await kmEingabe(s, [feldVon('gsfl'), feldVon('kuerzel')], 'Grundstück und Kürzel', 'Grundstück <b>' + KM.gsfl + ' m²</b>, dazu ein Kürzel für die Liste.',
          { was: 'Grundstücksfläche ' + KM.gsfl + ' m² und ein Kürzel.', warum: 'Fläche mal Bodenrichtwert ergibt den Bodenwert.', folge: 'Boden wird nicht abgeschrieben — er fehlt in der AfA.' },
          'Die Grundstücksfläche: ' + KM.gsfl + ' Quadratmeter. Mit dem Bodenrichtwert ergibt sich daraus der Bodenwert — wichtig, weil Boden sich nicht abnutzt und deshalb steuerlich nicht abgeschrieben wird. Dazu ein Kürzel, unter dem wir das Haus in der Liste wiederfinden.',
          async function () { await kmTipp('gsfl', KM.gsfl); await kmTipp('kuerzel', KM.kuerzel); });
        await kmEingabe(s, feldVon('kaufdat'), 'Kaufdatum', 'Gekauft am <b>' + datum(KM.kaufdat) + '</b>.',
          { was: 'Das Datum des Kaufvertrags.', warum: 'Ab hier laufen Abschreibung, Fristen und der Steuerverlauf.', folge: 'Auch die Drei-Jahres-Frist der 15-%-Grenze zählt ab diesem Tag.' },
          'Das Kaufdatum, hier der dreiundzwanzigste Dezember zweitausendvierundzwanzig. Ab diesem Tag laufen Abschreibung und Steuerverlauf, und auch die Drei-Jahres-Frist für anschaffungsnahe Herstellungskosten.',
          async function () { await kmTipp('kaufdat', KM.kaufdat); });
        await kmEingabe(s, [feldVon('brw'), feldVon('brw_stichtag')], 'Bodenrichtwert', '<b>' + KM.brw + ' €/m²</b>, Stichtag ' + datum(KM.brwStichtag) + ' — vom amtlichen Portal.',
          { was: 'Bodenrichtwert ' + KM.brw + ' €/m² mit Stichtag.', warum: 'Er ist der amtliche Wert für den Boden in dieser Zone.', folge: 'Bodenwert, Gebäudeanteil und Ertragswert hängen daran.' },
          'Der Bodenrichtwert. DealPilot kann ihn selbst beim amtlichen Bodenrichtwert-Portal abfragen; hier tragen wir den Wert direkt ein: ' + KM.brw + ' Euro je Quadratmeter, Stichtag erster Januar zweitausendsechsundzwanzig. Daraus entsteht der Bodenwert, und der entscheidet mit über den Gebäudeanteil für die Abschreibung.',
          async function () { await kmTipp('brw', KM.brw); await kmTipp('brw_stichtag', KM.brwStichtag); });
        /* Modernisierung: vier Gewerke, je volle Punkte nach Anlage 2 */
        var gw = function () { return b2oHuelle(feldVon(KM.mod[0][0])(), feldVon(KM.mod[KM.mod.length - 1][0])()); };
        await kmEingabe(s, [feldVon(KM.mod[0][0]), feldVon(KM.mod[KM.mod.length - 1][0])], 'Modernisierung', KM.mod.map(function (x) { return x[2]; }).join(', ') + ': in den letzten <b>fünf Jahren</b> erneuert.',
          { was: 'Je Gewerk: wann zuletzt modernisiert.', warum: 'Anlage 2 ImmoWertV gibt dafür Modernisierungspunkte.', folge: 'Mehr Punkte, längere Restnutzungsdauer — höherer Wert.' },
          'Jetzt der Stand der Modernisierung, Gewerk für Gewerk. Bei unserem Haus sind Heizung, Bäder, Leitungen und Innenausbau in den letzten fünf Jahren erneuert worden. Die Anlage 2 der Immobilienwertermittlungsverordnung vergibt dafür Punkte — und die verlängern die Restnutzungsdauer.',
          async function () { for (var i = 0; i < KM.mod.length; i++) await kmWahl(KM.mod[i][0], KM.mod[i][1]); KM.ausst.forEach(function (x) { r6Setz(x[0], x[1]); }); });
        var mp = function () { var e = document.getElementById('mod_punkte'); return e && (e.closest('.f') || e); };
        if (mp()) {
          await zeige(mp, 8);
          await kmSag(s, 'Modernisierungspunkte', 'DealPilot zählt: <b>' + (wert('mod_punkte') || '–') + ' Punkte</b> nach Anlage 2.',
            'DealPilot zählt die Punkte selbst zusammen: ' + (wert('mod_punkte') || 'keine') + ' Punkte. Mit diesem Wert rechnen die Restnutzungsdauer und später die Wertermittlung.', null,
            { was: 'Nichts — die Punkte rechnet DealPilot.', warum: 'Eine Zahl statt vier Einzelangaben für die Wertermittlung.', folge: 'Die Restnutzungsdauer verlängert sich mit jedem Punkt.' });
        }
        await kmEingabe(s, [feldVon('garagen'), feldVon('stellpl_aussen')], 'Stellplätze', 'Keine Garage, <b>' + KM.stellpl + ' Außenstellplätze</b>.',
          { was: 'Garagen und Außenstellplätze.', warum: 'Stellplätze haben einen eigenen Wert und eigene Miete.', folge: 'Sie fließen in Marktwert und Ertragswert ein.' },
          'Keine Garage, aber vier Außenstellplätze. Stellplätze haben einen eigenen Wert und oft eine eigene Miete — sie fließen in Marktwert und Ertragswert ein.',
          async function () { await kmTipp('garagen', '0'); await kmTipp('stellpl_aussen', KM.stellpl); });
        await kmEingabe(s, feldVon('bgf'), 'Bruttogrundfläche', 'Bruttogrundfläche <b>' + KM.bgf + ' m²</b> — für das Sachwertverfahren.',
          { was: 'Die Bruttogrundfläche in m².', warum: 'Das Sachwertverfahren rechnet Herstellungskosten je m² BGF.', folge: 'Ohne BGF schätzt DealPilot sie — mit ihr rechnet der Sachwert genauer.' },
          'Die Bruttogrundfläche, ' + KM.bgf + ' Quadratmeter. Die braucht das Sachwertverfahren: dort werden die Herstellungskosten je Quadratmeter Bruttogrundfläche gerechnet.',
          async function () { await kmTipp('bgf', KM.bgf); });
        await kmEingabe(s, [feldVon('lageklasse'), feldVon('ds2_entwicklung')], 'Die Lage — deine Einschätzung', 'Lageklasse <b>C</b>, Makrolage durchschnittlich, Mikrolage — zunächst vorsichtig — <b>sehr schwach</b>.',
          { was: 'Lageklasse, Makro- und Mikrolage, Markt am Ort.', warum: 'Eine schwächere Lage verlangt eine höhere Rendite.', folge: 'Der Marktbericht misst die Lage später nach — und vergleicht.' },
          'Die Lage, zunächst als eigene Einschätzung. Lageklasse C, die Stadt insgesamt durchschnittlich, die Straße schätzen wir vorsichtig als sehr schwach ein. Dazu Bevölkerung stabil, Nachfrage und Wertsteigerung mittel. Warum das zählt: eine schwächere Lage braucht eine höhere Rendite. Der Marktbericht misst die Lage später nach — wir werden sehen, ob wir zu vorsichtig waren.',
          async function () { for (var i = 0; i < KM.lage.length; i++) await kmWahl(KM.lage[i][0], KM.lage[i][1]); });
        var wa = function () { var e = document.getElementById('svwert'); return e && (e.closest('.wa-raster') || e.closest('.f')); };
        if (wa()) {
          await zeige(wa, 8);
          var hk = [].map.call((q('#svw_herkunft') || { options: [] }).options, function (o) { return o.value ? r6Text(o).replace(/\s*\(.*\)$/, '') : null; }).filter(Boolean);
          await kmSag(s, 'Wertangabe in einer Zeile', 'Marktwert/Verkehrswert · <b>Herkunft</b> · Bericht. Herkunft: ' + hk.join(', ') + '.',
            'Eine Zeile für den Wert des Hauses: Marktwert oder Verkehrswert, daneben die Herkunft und der Bericht. Als Herkunft wählst du ' + hk.join(', ') + '. Eine Bankbewertung ist also kein eigenes Feld mehr, sondern eine Herkunft. Wir lassen die Zeile vorerst leer — der Marktbericht liefert gleich einen Wert.', null,
            { was: 'Vorerst nichts — die Zeile bleibt leer.', warum: 'Nur ein Gutachten oder eine Bankbewertung trägt den Beleihungsauslauf.', folge: 'Ohne Wert rechnet der LTV mit dem Kaufpreis.' });
        }
        var ws = function () { var e = document.getElementById('wertermittlungsstichtag'); return e && (e.closest('.f') || e.parentElement); };
        if (ws()) {
          await zeige(ws, 8);
          await kmSag(s, 'Wertermittlungsstichtag', 'Leer heißt <b>heute</b>. Der Knopf „= Kaufdatum“ setzt den Tag des Kaufs.',
            'Neu ist das Feld Wertermittlungsstichtag. Leer bedeutet: bewertet wird zum heutigen Tag. Mit dem Knopf daneben übernimmst du das Kaufdatum — dann rechnet die Wertermittlung mit dem Baupreisindex, dem Alter und den Mieten zu diesem Tag. Wir lassen es leer.', null,
            { was: 'Nichts — leer bedeutet heute.', warum: 'Jeder Wert gilt für einen Tag: Index, Alter und Mieten.', folge: 'Der Stichtag steht oben im Marktbericht.' });
        }
      },

      /* ════ KAPITEL 3 · EINHEITEN ERFASSEN ════ */
      async function (s) {
        await kmKapitel(s, 3, 'Einheiten erfassen', 'Fünf Wohnungen, jede für sich: Fläche, Zimmer, Miete, Zustand.',
          'Kapitel drei: die Einheiten. Ein Mehrfamilienhaus ist die Summe seiner Wohnungen. Wir erfassen jede einzeln — und das Haus rechnet sich daraus von selbst zusammen.');
        var m = q('.main-col'); if (m) m.scrollTop = 0;
        var kn = function () { var b = q('#mff-oeffnen') || q('#mfh-oeffnen'); return b && b.offsetWidth ? b : null; };
        await zeige(kn, 10);
        await kmSag(s, 'Einheiten erfassen', 'Der Knopf im Erklärkasten öffnet die Erfassung — <b>vier Schritte</b>.',
          'Ein Klick auf „Einheiten erfassen“ öffnet die Erfassung. Sie hat vier Schritte: das Gebäude, die Einheiten, den Zustand je Einheit und das Ergebnis.', 2500,
          { was: 'Ein Klick auf „Einheiten erfassen“.', warum: 'Wohnungen einzeln erfassen statt Summen schätzen.', folge: 'Vier Schritte: Gebäude, Einheiten, Zustand, Ergebnis.' });
        var b = kn(); if (b) b.click();
        await warteAuf(function () { return r26Mfh('#mfh-body'); }, 4000);
        kegelHoch(true); await kmPause(1000);
        await zeige(function () { return r26Mfh('#mfh-body table'); }, 6);
        var gp = r6Text(r26Mfh('#mfh-geb-p'));
        await kmSag(s, 'Schritt 1 · Das Gebäude', 'Die Gewerke nach <b>Anlage 2</b> — übernommen aus dem Reiter Objekt' + (gp ? ': <b>' + gp + ' von 20 Punkten</b>' : '') + '.',
          'Schritt eins: das Gebäude. Hier stehen die Gewerke der Anlage 2 — Dach, Außenwände, Leitungen und Heizung gehören dem ganzen Haus, Fenster, Bäder und Innenausbau sind die Vorgabe für die Wohnungen. Die Angaben aus dem Reiter Objekt sind schon übernommen. Wir ändern nichts.', null,
          { was: 'Nichts — die Modernisierung steht schon.', warum: 'Dach, Fassade, Heizung und Leitungen gehören dem ganzen Haus.', folge: 'Jede Wohnung erbt diese Angaben, bis sie widerspricht.' });
        var wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return r26Zelle(0, 'nr'); }, 3000);
        await kmPause(900);
        await zeige(function () { return r26Mfh('.mfh-tab'); }, 6);
        await kmSag(s, 'Schritt 2 · Die Wohnungen', 'Je Zeile eine Wohnung: Nummer, Lage, Fläche, Zimmer, <b>Ist-Miete</b> kalt, Status.',
          'Schritt zwei: die Wohnungen. Jede Zeile ist eine Wohnung — Nummer, Lage im Haus, Wohnfläche, Zimmer, die heutige Kaltmiete und der Status, also vermietet oder leer. Mehr braucht es beim Anlegen nicht; alles Weitere steht in den Details.', 2500,
          { was: 'Je Wohnung: Nummer, Lage, Fläche, Zimmer, Kaltmiete, Status.', warum: 'Die Miete jeder Wohnung ist die Grundlage der Rendite.', folge: 'Summen für Fläche und Miete bildet DealPilot selbst.' });
        for (var i = 0; i < KM.we.length; i++) {
          if (i > 0) { var nb = r26Mfh('#mfh-neu'); if (nb) nb.click(); await warteAuf(function () { return r26Zelle(i, 'nr'); }, 2000); }
          var r = KM.we[i], T = kmT();
          s.zeile('Wohnung ' + r[0] + ' · ' + r[1], r[2] + ' m², ' + r[3] + ' Zimmer, Ist-Miete <b>' + r[4] + ' €</b> kalt, ' + r[5] + '.');
          kmMerke(i === 0 ? 'Wohnung eins, Erdgeschoss links: ' + r[2] + ' Quadratmeter, ' + r[3] + ' Zimmer, ' + r[4] + ' Euro Kaltmiete, vermietet.' : 'Wohnung ' + r[0] + ', ' + r[1].replace('EG', 'Erdgeschoss').replace('OG', 'Obergeschoss').replace('DG', 'Dachgeschoss') + ': ' + r[2] + ' Quadratmeter, ' + r[4] + ' Euro.');
          await kmPause(2200);
          var nr = r26Zelle(i, 'nr'); if (nr && nr.value !== r[0]) await r26Tippe(nr, r[0], T);
          await kmPause(700); await r26Tippe(r26Zelle(i, 'lage'), r[1], T);
          await kmPause(700); await r26Tippe(r26Zelle(i, 'wfl'), r[2], T);
          await kmPause(700); await r26Tippe(r26Zelle(i, 'zimmer'), r[3], T);
          await kmPause(700); await r26Tippe(r26Zelle(i, 'ist'), r[4], T);
          await kmPause(700); await r26Tippe(r26Zelle(i, 'status'), r[5]);
          await kmPause(2500);
        }
        await zeige(function () { return b2oHuelle(r26Mfh('.mfh-tab'), r26Mfh('#mfh-summe')); }, 6);
        var su = r26Summe(), sm = /(\d+) Einheiten.*?·\s*([\d.,]+ m²).*?Ist ([\d.]+ €)\/Monat/.exec(su);
        await kmSag(s, 'Das Haus in Zahlen', sm ? '<b>' + sm[1] + ' Einheiten, ' + sm[2] + '</b>, Ist-Miete <b>' + sm[3] + '</b> im Monat.' : su,
          sm ? 'Die Summenzeile rechnet mit: ' + sm[1] + ' Wohnungen, ' + sm[2].replace('m²', 'Quadratmeter') + ' und ' + sm[3].replace('€', 'Euro') + ' Kaltmiete im Monat.' : 'Die Summenzeile rechnet mit.', null,
          { was: 'Nichts — die Summe rechnet sich selbst.', warum: 'Kein Abtippen von Summen, keine Rechenfehler.', folge: 'Diese Summen gehen gleich ins Objekt.' });
        /* Gesamtzustand je Wohnung (Details · Stammdaten) */
        await zeige(function () { return r26Mfh('[data-det="0"]'); }, 8);
        await kmSag(s, 'Der Zustand je Wohnung', 'In den <b>Details</b> jeder Wohnung steht ihr Gesamtzustand — von neuwertig bis stark sanierungsbedürftig.',
          'Eine Angabe holen wir noch nach: den Zustand jeder Wohnung. Er steht in den Details. Aus allen fünf rechnet DealPilot nach Fläche gewichtet den Zustand des Gebäudes.', 2500,
          { was: 'Je Wohnung: Gesamtzustand in den Details.', warum: 'Wohnungen sind unterschiedlich gut in Schuss.', folge: 'Daraus ergibt sich der Zustand des Gebäudes, nach Fläche gewichtet.' });
        for (var j = 0; j < KM.we.length; j++) {
          await r26WohnungAuf(j);
          var zs = function () { var x = r26We('[data-wk="zustand"]'); return x && (x.closest('.mfh-we-f') || x); };
          await zeige(zs, 8);
          var w = KM.we[j];
          s.zeile('Wohnung ' + w[0] + ' · Zustand', 'Gesamtzustand: <b>' + ({ 5: 'neuwertig', 4: 'gut', 3: 'normal', 2: 'renovierungsbedürftig', 1: 'stark sanierungsbedürftig' })[w[6]] + '</b>.');
          kmMerke(j === 0 ? 'Wohnung eins: renovierungsbedürftig.' : 'Wohnung ' + w[0] + ': ' + ({ 2: 'renovierungsbedürftig', 1: 'stark sanierungsbedürftig' })[w[6]] + '.');
          await kmPause(2200);
          await r26Tippe(r26We('[data-wk="zustand"]'), w[6]);
          await kmPause(j === 0 ? 3500 : 2500);
          await r26WohnungZu();
        }
        /* Schritt 3 und 4 ansehen, dann übernehmen */
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await kmPause(900);
        await zeige(function () { return r26Mfh('#mfh-body table') || r26Mfh('#mfh-body'); }, 6);
        await kmSag(s, 'Schritt 3 · Zustand je Einheit', 'Vorgabe ist <b>„wie Gebäude“</b> — nur Wohnungen, die abweichen, bekommen eigene Angaben.',
          'Schritt drei zeigt Fenster, Bäder, Innenausbau und Grundriss je Wohnung. Die Vorgabe ist „wie Gebäude“ — nur eine Wohnung, die abweicht, bekommt eigene Angaben. Bei uns stimmt alles.', null,
          { was: 'Nichts — die Vorgabe „wie Gebäude“ passt.', warum: 'Nur Abweichungen kosten Zeit, nicht der Normalfall.', folge: 'Jede Wohnung bekommt ihre Modernisierungspunkte.' });
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return r26Mfh('#mfh-uep') || r26Mfh('#mfh-body'); }, 3000);
        await kmPause(900);
        await zeige(function () { return r26Mfh('#mfh-body'); }, 6);
        var et = r6Text(r26Mfh('#mfh-body')), rg = /Restnutzungsdauer(?: des Gebäudes)? (\d+) Jahre/.exec(et), pg = /angesetzt (\d+) Punkte|Gebäude gesamt:\s*([\d,]+) Punkte/.exec(et);
        _km.rnd = rg ? rg[1] : null;
        await kmSag(s, 'Schritt 4 · Ergebnis', (pg ? '<b>' + (pg[1] || pg[2]) + ' Punkte</b> nach Anlage 2' : 'Punkte nach Anlage 2') + (rg ? ', Restnutzungsdauer <b>' + rg[1] + ' Jahre</b>' : '') + '.',
          'Schritt vier, das Ergebnis: ' + (pg ? (pg[1] || pg[2]) + ' Modernisierungspunkte' : 'die Modernisierungspunkte') + (rg ? ' und daraus eine Restnutzungsdauer von ' + rg[1] + ' Jahren' : '') + '. Mit diesem Stand rechnen Score und Wertermittlung.', null,
          { was: 'Nichts — das Ergebnis rechnet DealPilot.', warum: 'Punkte und Restnutzungsdauer für das ganze Haus auf einen Blick.', folge: 'Die Restnutzungsdauer trägt Ertragswert und Sachwert.' });
        var san = r26Mfh('#mfh-san'); if (san && san.checked) san.click();
        await zeige(function () { return r26Mfh('#mfh-weiter'); }, 8);
        await kmSag(s, 'Übernehmen', 'Ein Klick: Fläche, Einheiten, Miete, Zustand und Vermietungsstand gehen ins Objekt.', 'Ein Klick auf Übernehmen …', 1200,
          { was: 'Ein Klick auf „Übernehmen“.', warum: 'Die Summen gehören ins Objekt.', folge: 'Diese Felder sind danach schreibgeschützt — sie kommen aus den Einheiten.' });
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return !q('#mfh-modal'); }, 5000);
        kegelHoch(false);
        await kmPause(1800);
        m = q('.main-col'); if (m) m.scrollTop = 0;
        await zeigeGruppe(feldVon('wfl'), feldVon('vermstand'), 8);
        var ro = ['wfl', 'einheiten', 'vermstand', 'ds2_zustand'].filter(function (id) { var e = document.getElementById(id); return e && e.classList.contains('mff-gesperrt'); }).length;
        _km.ro = ro;
        await kmSag(s, 'Aus den Einheiten', '<b>' + wert('einheiten') + ' Einheiten</b>, ' + wert('wfl') + ' m², Vermietungsstand <b>' + kmOpt('vermstand') + '</b>, Zustand <b>' + kmOpt('ds2_zustand') + '</b> — schreibgeschützt.',
          'Und alles steht im Objekt: ' + wert('einheiten') + ' Einheiten, ' + wert('wfl') + ' Quadratmeter, Vermietungsstand ' + kmOpt('vermstand') + ', Zustand des Gebäudes ' + kmOpt('ds2_zustand') + '. Diese Felder sind jetzt schreibgeschützt: sie kommen aus den Einheiten. Wer etwas ändern will, ändert die Wohnung — so können Haus und Wohnungen nie auseinanderlaufen.', null,
          { was: 'Nichts — die Felder sind übernommen.', warum: 'Eine Quelle für Fläche, Miete und Zustand.', folge: 'Der Vermietungsstand wird gegen die übrigen Felder geprüft.' });
      },

      /* ════ KAPITEL 4 · MIETE ════ */
      async function (s) {
        await kmKapitel(s, 4, 'Miete', 'Kaltmiete aus den Wohnungen, ein Mietvertrag im Detail, Bewirtschaftung.',
          'Kapitel vier: die Miete. Sie entscheidet, ob ein Haus sich trägt. Wir sehen, wo die Kaltmiete herkommt, tragen einen Mietvertrag mit Staffelmiete ein und schauen auf die Kosten der Bewirtschaftung.');
        reiter('s2'); await kmPause(1300);
        await zeige(feldVon('nkm'), 10);
        await kmSag(s, 'Nettokaltmiete', '<b>' + kmEur('nkm') + '</b> im Monat — die Summe der fünf Wohnungen.',
          'Im Reiter Miete steht die Nettokaltmiete: ' + de(zahl('nkm') || 0) + ' Euro im Monat. Wir haben sie nicht getippt — sie ist die Summe der fünf Wohnungen.', null,
          { was: 'Nichts — die Miete kommt aus den Einheiten.', warum: 'Die Summe der Wohnungen ist die Miete des Hauses.', folge: 'Sie trägt Rendite, Cashflow und Ertragswert.' });
        /* Mietvertrag Wohnung 1: Staffelmiete */
        reiter('s0'); await kmPause(900);
        var kn = function () { var b = q('#mff-oeffnen') || q('#mfh-oeffnen'); return b && b.offsetWidth ? b : null; };
        await zeige(kn, 10);
        await kmSag(s, 'Der Mietvertrag gehört zur Wohnung', 'Mietverträge stehen <b>je Wohnung</b> in den Details — wir öffnen Wohnung 1.',
          'Mietverträge gehören zur einzelnen Wohnung. Wir öffnen die Einheiten noch einmal, diesmal die Details von Wohnung eins.', 2500,
          { was: 'Ein Klick auf „Einheiten bearbeiten“.', warum: 'Jede Wohnung hat ihren eigenen Vertrag.', folge: 'Vertragsart und Fristen gelten genau für diese Wohnung.' });
        var b = kn(); if (b) b.click();
        await warteAuf(function () { return r26Mfh('#mfh-body'); }, 4000);
        kegelHoch(true);
        var t2 = r26Mfh('[data-s="1"]'); if (t2) t2.click();
        await warteAuf(function () { return r26Mfh('[data-det="0"]'); }, 3000);
        await r26WohnungAuf(0);
        var P = KM.staffel;
        await kmEingabe(s, r26BlockTitel(/^Mietvertrag/), 'Wohnung 1 · Staffelmiete', 'Seit ' + kmMonat(P.mv_beginn) + ', <b>+' + P.mv_erhoehung_wert + ' % alle ' + P.mv_rhythmus_jahre + ' Jahre</b>, noch ' + P.mv_stufen_offen + ' Stufen.',
          { was: 'Vertragsart Staffelmiete, Beginn, letzte Stufe, Höhe und Rhythmus.', warum: 'Eine Staffel legt die Erhöhungen im Vertrag fest.', folge: 'Daneben ist keine Erhöhung nach § 558 BGB möglich.' },
          'Wohnung eins hat eine Staffelmiete: seit April zweitausendzweiundzwanzig, die letzte Stufe im April zweitausendfünfundzwanzig, plus drei Prozent alle zwei Jahre, noch vier Stufen offen. Wichtig: bei einer Staffelmiete ist eine Erhöhung auf die Vergleichsmiete nach Paragraf 558 BGB ausgeschlossen. Die Miete steigt genau so, wie der Vertrag es sagt.',
          async function () {
            for (var k in P) { await kmPause(1500); await r26Feld(k, P[k], kmT()); }
          });
        await zeige(r26BlockTitel(/^Mietvertrag/), 6);
        var na = r26We('[data-wk="mv_naechste_anpassung"]');
        await kmSag(s, 'Die nächste Stufe', na && na.value ? 'Nächste Anpassung: <b>' + datum(na.value) + '</b>.' : 'Die Staffel steht im Vertrag der Wohnung.',
          na && na.value ? 'Die nächste Stufe ist am ' + datum(na.value) + ' fällig. Genau so rechnet die Mietentwicklung dieser Wohnung weiter.' : 'Die Staffel steht jetzt im Vertrag der Wohnung, und die Mietentwicklung rechnet mit ihr.', null,
          { was: 'Nichts — die nächste Stufe steht im Vertrag.', warum: 'Fristen sind Geld: sie bestimmen, wann die Miete steigt.', folge: 'Die Mietentwicklung des Hauses rechnet mit der Staffel.' });
        await r26WohnungZu();
        var wbx;
        /* über „Übernehmen“ schließen (Schritt 4), damit der Vertrag ins Objekt geht */
        var s4 = r26Mfh('[data-s="3"]'); if (s4) s4.click(); await kmPause(600);
        wbx = r26Mfh('#mfh-weiter'); if (wbx) wbx.click();
        await warteAuf(function () { return !q('#mfh-modal'); }, 5000);
        kegelHoch(false);
        /* Mietentwicklung aus Wohnungen */
        reiter('s2'); await kmPause(1300);
        var me = function () { var x = q('#me-mode-einheiten'); return x && x.offsetWidth ? x : null; };
        if (me()) {
          await zeige(function () { var x = me(); return x && x.parentElement; }, 10);
          var modi = [].map.call(document.querySelectorAll('.me-mode-toggle .me-mode-btn'), function (x) { return x.offsetWidth ? r6Text(x) : null; }).filter(Boolean);
          await kmEingabe(s, function () { var x = me(); return x && x.parentElement; }, 'Mietentwicklung', (modi.length ? modi.map(function (x) { return '„' + x + '“'; }).join(', ') : '') + ' — für das Haus: <b>„' + r6Text(me()) + '“</b>.',
            { was: 'Wie die Miete fortgeschrieben wird.', warum: 'Jede Wohnung hat ihren eigenen Vertrag und Termin.', folge: 'Die Tabelle rechnet Jahr für Jahr je Wohnung.' },
            'Darunter die Mietentwicklung. Es gibt mehrere Wege, die Miete in die Zukunft zu schreiben. Für ein Haus mit erfassten Wohnungen nehmen wir „' + r6Text(me()) + '“: dann rechnet jede Wohnung mit ihrem eigenen Vertrag, die Staffel von Wohnung eins eingeschlossen.',
            async function () { var k = me(); if (k && !k.classList.contains('active')) k.click(); await kmPause(900); });
        }
        var stg = pz(wert('mietstg')) || '–';
        await kmEingabe(s, feldVon('ds2_mietausfall'), 'Mietausfall und Steigerung', 'Mietausfall-Risiko <b>mittel</b>, Mietsteigerung <b>' + stg + ' %</b> im Jahr.',
          { was: 'Mietausfall-Risiko; die Steigerung kommt aus deinem Profil.', warum: 'Leerstand und Ausfall kosten Geld.', folge: 'Beides geht in Cashflow und Investor Deal Score ein.' },
          'Zwei Annahmen noch: das Mietausfall-Risiko setzen wir auf mittel. Die jährliche Mietsteigerung von ' + stg + ' Prozent kommt aus deinem Investmentprofil — du setzt sie einmal in den Einstellungen, und jedes neue Objekt startet damit.',
          async function () { await kmWahl('ds2_mietausfall', 'mittel'); });
        /* Bewirtschaftung - die Werte des Demo-Objekts, getippt */
        reiter('s4'); await kmPause(1300);
        await kmEingabe(s, [feldVon('grundsteuer'), feldVon('weg_r')], 'Bewirtschaftung', 'Grundsteuer <b>' + eur(+KM.grundsteuer) + '</b>, nicht umlagefähige Kosten <b>' + eur(+KM.hgNul) + '</b>, Rücklage <b>' + eur(+KM.wegR) + '</b> — je Jahr.',
          { was: 'Grundsteuer, nicht umlagefähige Kosten und Rücklage je Jahr.', warum: 'Nur was nicht umlagefähig ist, bleibt beim Eigentümer.', folge: 'Diese Kosten mindern Cashflow und Rendite.' },
          'Im Reiter Bewirtschaftung die laufenden Kosten, je Jahr. Die Grundsteuer, dreihundertsechsunddreißig Euro, zahlt der Mieter über die Nebenkosten — sie ist umlagefähig. Was beim Eigentümer bleibt — Verwaltung und Instandhaltung, hier siebentausendsechshundertachtzig Euro, und die Rücklage von siebenhundertachtundneunzig Euro — ist nicht umlagefähig. Nur das schmälert den Cashflow.',
          async function () { await kmTipp('grundsteuer', KM.grundsteuer); await kmTipp('hg_nul', KM.hgNul); await kmTipp('weg_r', KM.wegR); try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} });
      },

      /* ════ KAPITEL 5 · FINANZIERUNG ════ */
      async function (s) {
        await kmKapitel(s, 5, 'Finanzierung', 'Kaufpreis, Nebenkosten, Inventar — und das Darlehen.',
          'Kapitel fünf: die Finanzierung. Erst was das Haus insgesamt kostet — Kaufpreis, Nebenkosten, Inventar —, dann wie wir es bezahlen.');
        reiter('s1'); await kmPause(1300);
        await kmEingabe(s, feldVon('kp'), 'Kaufpreis', '<b>' + eur(+KM.kp) + '</b>.',
          { was: 'Der Kaufpreis laut Vertrag.', warum: 'Er ist die Basis für Nebenkosten, Rendite und Finanzierung.', folge: 'Die Nebenkosten rechnen sich in Prozent davon.' },
          'Im Reiter Investition: der Kaufpreis, dreihundertfünfundneunzigtausend Euro. Er ist die Basis für alles Weitere — für die Nebenkosten, die Rendite und die Finanzierung.',
          async function () { await kmTipp('kp', KM.kp); try { DealPilotInvestmentProfile.nachziehen('kp'); } catch (e) {} });
        await kmEingabe(s, [feldVon('makler_p'), feldVon('ji_p')], 'Nebenkosten', 'Makler <b>' + KM.makler + ' %</b>; Notar, Grundbuch und Grunderwerbsteuer kommen aus dem Profil und dem Bundesland.',
          { was: 'Maklerprovision in Prozent.', warum: 'Nebenkosten zahlst du meist aus Eigenkapital.', folge: 'Grunderwerbsteuer setzt DealPilot je Bundesland — hier 6,5 %.' },
          'Die Nebenkosten. Die Maklerprovision tragen wir ein: drei Komma fünf sieben Prozent. Notar und Grundbuch kommen aus deinem Profil, die Grunderwerbsteuer setzt DealPilot nach dem Bundesland — Nordrhein-Westfalen, sechs Komma fünf Prozent.',
          async function () { await kmTipp('makler_p', KM.makler); });
        var gestVor = zahl('gest_e') != null ? de(zahl('gest_e')) : '';
        await zeige(feldVon('gest_e'), 10);
        await kmSag(s, 'Grunderwerbsteuer', '<b>' + (gestVor || '–') + ' €</b> — 6,5 % auf den Kaufpreis.',
          'Die Grunderwerbsteuer beträgt jetzt ' + (gestVor || 'einen Betrag') + ' Euro. Merken wir uns die Zahl.', null,
          { was: 'Nichts — DealPilot rechnet die Steuer.', warum: 'Sie ist der größte Posten der Nebenkosten.', folge: 'Gleich sehen wir, warum Inventar sie senkt.' });
        var inv = function () { var e = document.getElementById('moebl'); return e && (e.closest('.f') || e); };
        var it = q('#inv_detail_toggle'); if (it && !it.checked && !(document.getElementById('moebl') || {}).offsetWidth) { it.click(); await kmPause(600); }
        await kmEingabe(s, inv, 'Inventar', 'Mitverkauftes Inventar — Einbauküchen, Möbel: <b>' + eur(+KM.moebl) + '</b>.',
          { was: 'Wert des mitverkauften Inventars.', warum: 'Auf Inventar fällt keine Grunderwerbsteuer an.', folge: 'Inventar wird schneller abgeschrieben als das Gebäude.' },
          'Jetzt das Inventar: mitverkaufte Einbauküchen und Möbel für siebentausend Euro. Das ist mehr als eine Randnotiz. Auf Inventar fällt keine Grunderwerbsteuer an, und steuerlich wird es über wenige Jahre abgeschrieben statt über Jahrzehnte.',
          async function () { await kmTipp('moebl', KM.moebl); });
        var gestNach = zahl('gest_e') != null ? de(zahl('gest_e')) : '';
        await zeige(feldVon('gest_e'), 10);
        await kmSag(s, 'Keine Grunderwerbsteuer auf Inventar', 'Grunderwerbsteuer jetzt <b>' + (gestNach || '–') + ' €</b>' + (gestVor && gestNach && gestVor !== gestNach ? ' statt ' + gestVor + ' €' : '') + '.',
          'Und tatsächlich: die Grunderwerbsteuer sinkt auf ' + (gestNach || 'einen kleineren Betrag') + ' Euro' + (gestVor && gestNach && gestVor !== gestNach ? ', vorher waren es ' + gestVor + ' Euro' : '') + '. Sie wird nur auf den Kaufpreis ohne das Inventar erhoben.', null,
          { was: 'Nichts — DealPilot rechnet neu.', warum: 'Grunderwerbsteuer gilt nur für Grundstück und Gebäude.', folge: 'Weniger Nebenkosten, weniger Eigenkapital.' });
        /* Darlehen */
        reiter('s3'); await kmPause(1300);
        await kmEingabe(s, [feldVon('d1'), feldVon('d1_bindj')], 'Das Darlehen', '<b>' + eur(+KM.d1) + '</b> zu ' + KM.d1z + ' %, Tilgung ' + KM.d1t + ' %, Zinsbindung ' + KM.bindj + ' Jahre.',
          { was: 'Darlehensbetrag, Zins, Tilgung, Zinsbindung.', warum: 'Zins und Tilgung bestimmen die monatliche Rate.', folge: 'Daraus folgen Cashflow, DSCR und Beleihungsauslauf.' },
          'Im Reiter Finanzierung das Darlehen: dreihundertvierundzwanzigtausend Euro, vier Prozent Zins, ein Prozent Tilgung, zehn Jahre Zinsbindung. Zins und Tilgung ergeben die Rate, und die Rate entscheidet über den Cashflow.',
          async function () { await kmTipp('d1', KM.d1); await kmTipp('d1z', KM.d1z); await kmTipp('d1t', KM.d1t); await kmTipp('d1_bindj', KM.bindj); try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} });
        await kmPause(800);
        /* Kapitaldeckung: Eigenkapital aus dem Profil + Darlehen decken die Gesamtinvestition nicht */
        var kd = function () { var b = q('#kd-box'); return b && b.offsetWidth ? b : null; };
        var kdz = r6Text(q('#kd-zeile')), fehltB = /Es fehlen ([\d.]+ €)/.exec(kdz);
        DPM_KM.kapital = kdz.slice(0, 200);
        if (kd() && fehltB && q('#kd-btn-ek') && q('#kd-btn-ek').offsetWidth) {
          await zeige(kd, 8);
          await kmSag(s, 'Es fehlen ' + fehltB[1], 'Eigenkapital aus dem Profil und Darlehen decken die <b>Gesamtinvestition</b> nicht — DealPilot sagt es sofort.',
            'Und hier meldet sich DealPilot: es fehlen ' + fehltB[1].replace('€', 'Euro') + '. Das Eigenkapital stand noch auf dem Wert aus deinem Profil, und zusammen mit dem Darlehen deckt es die Gesamtinvestition — Kaufpreis plus Nebenkosten — nicht. Eine Lücke in der Finanzierung fällt so nicht erst bei der Bank auf.', null,
            { was: 'Noch nichts — DealPilot prüft die Deckung.', warum: 'Eigenkapital plus Darlehen muss die Gesamtinvestition decken.', folge: 'Ein Knopf setzt Eigenkapital oder Darlehen passend.' });
          await kmEingabe(s, function () { var b = q('#kd-btn-ek'); return b && b.offsetWidth ? b : kd(); }, 'Eigenkapital passend setzen', 'Ein Klick: das Eigenkapital deckt den Rest — das Darlehen bleibt bei <b>' + eur(+KM.d1) + '</b>.',
            { was: 'Ein Klick auf „Eigenkapital passend setzen“.', warum: 'Das Darlehen steht fest, den Rest bringst du ein.', folge: 'Eigenkapital-Rendite und Cashflow rechnen mit dem echten Einsatz.' },
            'Wir klicken auf „Eigenkapital passend setzen“. Das Darlehen bleibt, wie es mit der Bank verhandelt ist, und das Eigenkapital deckt genau den Rest.',
            async function () { var b = q('#kd-btn-ek'); if (b) b.click(); await kmPause(1200); try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} });
        }
        var K = (window.State && State.kpis) || {};
        await zeige(feldVon('ek'), 10);
        await kmSag(s, 'Eigenkapital', 'Eigenkapital <b>' + kmEur('ek') + '</b>' + (K.ltv != null ? ', Beleihungsauslauf <b>' + de(K.ltv, 1) + ' %</b>' : '') + '.',
          'Das Eigenkapital ergibt sich: ' + de(zahl('ek') || 0) + ' Euro' + (K.ltv != null ? '. Der Beleihungsauslauf liegt bei ' + de(K.ltv, 1).replace(',', ' Komma ') + ' Prozent — gerechnet auf den Kaufpreis, weil wir noch keinen Wert aus Gutachten oder Bank haben' : '') + '.', null,
          { was: 'Nichts — das Eigenkapital ergibt sich.', warum: 'Gesamtkosten minus Darlehen musst du selbst aufbringen.', folge: 'Der Beleihungsauslauf ist die Kennzahl der Bank.' });
      },

      /* ════ KAPITEL 6 · STEUER ════ */
      async function (s) {
        await kmKapitel(s, 6, 'Steuer', 'Abschreibung, Gebäudeanteil — und was am Jahresende übrig bleibt.',
          'Kapitel sechs: die Steuer. Wir sehen, wie viel vom Kaufpreis abgeschrieben wird, wie hoch die Abschreibung ist und was nach Steuern übrig bleibt. Wichtig vorab: DealPilot rechnet mit deinen Eingaben, eine Steuerberatung ersetzt das nicht.');
        reiter('s3-tax'); await kmPause(1300);
        await zeigeGruppe(feldVon('zve'), feldVon('grenz'), 8);
        var gz = pz(wert('grenz'));
        await kmSag(s, 'Dein Steuersatz', 'zvE und Grenzsteuersatz <b>' + (gz || '–') + ' %</b> kommen aus deinem <b>Profil</b> — sie gehören zu dir, nicht zum Haus.',
          'Oben stehen dein zu versteuerndes Einkommen und dein Grenzsteuersatz, hier ' + (gz ? gz.replace(',', ' Komma ') : 'aus dem Profil') + ' Prozent. Die tippen wir hier nicht: sie gehören zu dir als Steuerpflichtigem, nicht zum Haus, und kommen aus deinem Investmentprofil.', null,
          { was: 'Nichts — beides steht in deinem Profil.', warum: 'Der Steuersatz gehört zur Person, nicht zur Immobilie.', folge: 'Jeder Euro Verlust spart Steuer zu diesem Satz.' });
        await kmEingabe(s, feldVon('geb_ant'), 'Gebäudeanteil', '<b>' + KM.gebAnt + ' %</b> des Kaufpreises entfallen auf das Gebäude.',
          { was: 'Anteil des Gebäudes am Kaufpreis.', warum: 'Nur das Gebäude nutzt sich ab — der Boden nicht.', folge: 'Nur dieser Anteil wird abgeschrieben.' },
          'Der Gebäudeanteil: vierundfünfzig Komma drei eins Prozent. Nur dieser Teil des Kaufpreises wird abgeschrieben, denn der Boden nutzt sich nicht ab. Den Anteil kann DealPilot auch mit der Arbeitshilfe des Bundesfinanzministeriums aufteilen — dazu gibt es ein eigenes Video.',
          async function () { await kmTipp('geb_ant', KM.gebAnt); try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} });
        var afaVor = kmOpt('afa_satz');
        await kmEingabe(s, feldVon('afa_satz'), 'Der AfA-Satz', 'Vorgabe: ' + afaVor + '. Unser Haus ist von ' + KM.baujahr + ' — wir wählen <b>2,5 % · Baujahr vor 1925</b>.',
          { was: 'Den AfA-Satz: 2,5 % linear.', warum: 'Fertigstellung vor 1925: 2,5 %, danach 2 % (§ 7 Abs. 4 EStG).', folge: 'Das Gebäude wird in 40 statt 50 Jahren abgeschrieben.' },
          'Der AfA-Satz. Vorgegeben sind zwei Prozent, der Regelfall. Der Satz richtet sich aber nach dem Jahr der Fertigstellung: für Gebäude, die vor neunzehnhundertfünfundzwanzig fertig wurden, gelten zweieinhalb Prozent. Unser Haus ist von ' + KM.baujahr + ', also wählen wir zweieinhalb Prozent.',
          async function () { await kmWahl('afa_satz', '2.5'); try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} });
        await zeigeGruppe(feldVon('afa_satz'), function () { return q('#afa_kalk') && (q('#afa_kalk').closest('.f') || q('#afa_kalk')); }, 8);
        await kmSag(s, 'Die Abschreibung', 'AfA-Satz <b>' + kmOpt('afa_satz').replace(/\s*—.*$/, '') + '</b> auf den Gebäudeanteil: <b>' + (r6Id('afa_kalk') || '–') + '</b> im Jahr.',
          'Das ergibt eine Abschreibung von ' + (r6Id('afa_kalk') || 'einem festen Betrag') + ' im Jahr — Jahr für Jahr, ohne dass Geld fließt. Genau das macht vermietete Immobilien steuerlich interessant.', null,
          { was: 'Nichts — DealPilot rechnet die AfA.', warum: 'Gebäudeanteil am Kaufpreis mal AfA-Satz.', folge: 'Die AfA mindert das steuerliche Ergebnis Jahr für Jahr.' });
        var ein = r6TaxWert(/^Einnahmen V\+V/), wk = r6TaxWert(/^Werbungskosten gesamt/), erg = r6TaxWert(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/);
        await zeige(function () { return r6TaxItem(/^Überschuss \/ Verlust V\+V \(diese Immobilie\)/) || r6TaxItem(/^Einnahmen V\+V/); }, 8);
        await kmSag(s, 'Was im Jahr übrig bleibt', 'Einnahmen <b>' + (ein || '–') + '</b>, Werbungskosten ' + (wk || '–') + ' — Ergebnis aus Vermietung <b>' + (erg || '–') + '</b>.',
          'Unten die Rechnung für das Jahr: Mieteinnahmen ' + (ein || 'aus den Wohnungen') + ', Werbungskosten ' + (wk || '') + ' — das sind Zinsen, Bewirtschaftung und Abschreibung. Das Ergebnis aus Vermietung: ' + (erg || 'siehe Bild') + '. Mit deinem Grenzsteuersatz verrechnet ergibt sich daraus der Cashflow nach Steuern.', null,
          { was: 'Nichts — das Ergebnis rechnet DealPilot.', warum: 'Zinsen, Kosten und AfA mindern die Einnahmen.', folge: 'Das Ergebnis bestimmt den Cashflow nach Steuern.' });
      },

      /* ════ KAPITEL 7 · MARKTBERICHT UND WERTERMITTLUNG ════ */
      async function (s) {
        await kmKapitel(s, 7, 'Marktbericht und Wertermittlung', 'Marktwert, Lage, Ertrags- und Sachwert — mit Rechenweg und Quelle.',
          'Kapitel sieben: der Marktbericht mit der Wertermittlung. Jetzt zeigt sich, ob unsere Eingaben vollständig sind — und was das Haus aus Sicht des Marktes und nach den amtlichen Verfahren wert ist.');
        reiter('s0'); var m = q('.main-col'); if (m) m.scrollTop = 0;
        await kmPause(900);
        var zeileS3 = stufeZeile(3);
        await zeige(function () { return zeileS3() || q('#oe-stufen'); }, 8);
        var fehlt3 = fehlt(3);
        await kmSag(s, 'Stufe 3 ist erreicht', fehlt3 && fehlt3.length ? 'Es fehlen noch: ' + feldNamen(fehlt3) + '.' : 'Alle Angaben für die <b>amtliche Wertermittlung</b> sind da.',
          fehlt3 && fehlt3.length ? 'Für Stufe drei fehlen noch: ' + feldNamen(fehlt3) + '.' : 'Die Liste ist leer: alle Angaben für die amtliche Wertermittlung sind da. Wir rufen den Marktbericht in Stufe drei ab.', null,
          { was: 'Ein Klick auf „Abrufen“ in Stufe 3.', warum: 'Stufe 3 rechnet nach den Verfahren der ImmoWertV.', folge: 'Marktwert, Ertragswert und Sachwert mit Rechenweg.' });
        kegelHoch(true);
        await rhStufeAbrufen(3, function () { s.zeile('Der Bericht entsteht', 'Standort, Vergleichsdaten, Bodenrichtwert, Liegenschaftszins — Schritt für Schritt.'); kmMerke('Der Bericht entsteht: DealPilot ermittelt den Standort, lädt Vergleichsdaten und Strukturdaten, den Bodenrichtwert und den Liegenschaftszins des zuständigen Gutachterausschusses.'); });
        kegelHoch(false);
        kmRefPruefen();
        await kmPause(1500);
        var k = mbKarteH() || {};
        await zeige(function () {
          var a = q('#avsec'); if (a && a.offsetWidth) return a;
          return [].filter.call(document.querySelectorAll('#s0 div'), function (x) { return x.offsetWidth && /MARKTEINSCHÄTZUNG/i.test(x.innerText || '') && (x.innerText || '').length < 900; })[0] || null;
        }, 8);
        var mw = kartenText(/MARKTEINSCHÄTZUNG\s+\S+\s+([\d.]+ €)/i), un = kartenText(/UNTEN\s+([\d.]+ €)/i), ob = kartenText(/OBEN\s+([\d.]+ €)/i), abs = kartenText(/inkl\.\s*([\d,]+ %) Abschlag/);
        _km.mw = mw;
        await kmSag(s, 'Das Ergebnis im Objekt', 'Marktpreisindikation <b>' + (mw || '–') + '</b>' + (un && ob ? ', Spanne ' + un + ' bis ' + ob : '') + (abs ? ' — nach ' + abs + ' Abschlag auf Angebotspreise' : '') + '.',
          'Das Ergebnis steht direkt im Objekt: eine Marktpreisindikation von ' + (mw ? mw.replace('€', 'Euro') : 'einem Betrag') + (un && ob ? ', in einer Spanne von ' + un.replace('€', 'Euro') + ' bis ' + ob.replace('€', 'Euro') : '') + '. ' + (abs ? 'Angebotspreise liegen über den echten Kaufpreisen; deshalb zieht DealPilot ' + abs.replace('%', 'Prozent') + ' ab, örtlich gemessen an den Kauffällen des Gutachterausschusses. ' : '') + 'Den vollen Bericht öffnen wir jetzt.', null,
          { was: 'Nichts — der Bericht ist da.', warum: 'Angebotspreise sind keine Kaufpreise — der Abschlag ist örtlich gemessen.', folge: 'Der volle Bericht zeigt jeden Rechenweg.' });
        /* der volle Bericht (gespeicherter Bericht 371, nur gelesen) */
        await r16MbOeffnen(KM_BERICHT);
        var kopf = function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#resultBody *'), function (x) { return x.children.length < 3 && /Wertermittlungsstichtag/.test(x.textContent) && x.offsetWidth; })[0]; };
        if (kopf()) {
          await r16Hin(kopf(), true);
          await zeige(kopf, 8);
          var kt = r6Text(kopf());
          await kmSag(s, 'Der Stichtag oben', '<b>' + kt.replace(/^.*?(Wertermittlungsstichtag[^·|]*).*$/, '$1').trim() + '</b>.',
            'Ganz oben im Bericht steht der Wertermittlungsstichtag: ' + kt.replace(/^.*?Wertermittlungsstichtag:?\s*/, '').replace(/\(.*$/, '').trim() + '. Für diesen Tag gelten alle Werte darunter.', null,
            { was: 'Nichts — der Bericht nennt seinen Stichtag.', warum: 'Ein Wert gilt immer für einen bestimmten Tag.', folge: 'Leer gelassen bedeutet: der Tag der Berichtserstellung.' });
        }
        var sb = function () { return r16Mb('#resultBody .scorebox'); };
        if (sb()) {
          await r16Hin(sb(), true);
          await zeigeGruppe(sb, function () { return r16Mb('#resultBody .kpis') || sb(); }, 8);
          var sc = r6Text(sb()), num = /(\d+)\s*\/\s*100/.exec(sc);
          await kmSag(s, 'Oben das Ergebnis', 'Marktwert, Bruttorendite <b>' + (r6Text(r16Mb('#kYield')) || '–') + '</b>, Abstand des Kaufpreises zum Marktwert — und eine Kurzwertung des Berichts.',
            'Darunter die Übersicht: Marktwert, Bruttorendite ' + (r6Text(r16Mb('#kYield')) || '').replace(',', ' Komma ').replace('%', 'Prozent') + ' und der Abstand des Kaufpreises zum Marktwert. Der Bericht trägt dazu eine eigene Kurzwertung aus seinen Marktdaten. Den Deal Score und den Investor Deal Score, die alle deine Eingaben einbeziehen — auch Finanzierung und Steuer —, sehen wir am Ende im Reiter Bewertung.', null,
            { was: 'Nichts — alles aus den Eingaben gerechnet.', warum: 'Erst der Überblick, dann die Herleitung.', folge: 'Jede Zahl hat darunter ihren Rechenweg.' });
        }
        var ag = function () { return r16Mb('#assessGrid'); };
        if (ag()) {
          await r16Hin(ag(), true);
          /* gemessen (Studio-Prüflauf): das ganze Raster ist höher als das Bild - nur Mikrolage bis Nachfrage */
          if (r18AssessEl(/^Mikrolage/)() && r18AssessEl(/^Nachfrage/)()) await zeigeGruppe(r18AssessEl(/^Mikrolage/), r18AssessEl(/^Nachfrage/), 8); else await zeige(ag, 8);
          var lg = function (re) { var v = r18Assess(re); return v ? v.split(' · ')[0] : '–'; };
          _km.mikro = lg(/^Mikrolage(\s*·|$)/);
          await kmSag(s, 'Die Lage — gemessen', 'Mikrolage <b>' + _km.mikro + '</b>, Makrolage ' + lg(/^Makrolage(\s*·|$)/) + ', Nachfrage ' + lg(/^Nachfrage(\s*·|$)/) + '.',
            'Die Lage, diesmal gemessen statt geschätzt: Mikrolage ' + _km.mikro + ', Makrolage ' + lg(/^Makrolage(\s*·|$)/) + ', Nachfrage ' + lg(/^Nachfrage(\s*·|$)/) + '. Erinnern wir uns: wir hatten die Mikrolage als sehr schwach eingeschätzt. Darauf kommen wir gleich zurück.', null,
            { was: 'Nichts — die Lage wird gemessen.', warum: 'Infrastruktur und Umfeld lassen sich zählen.', folge: 'Weicht deine Einschätzung ab, sagt es dir das Objekt.' });
        }
        var wv = function () { return r16Mb('#wv-box'); };
        if (wv()) {
          await r16Hin(wv(), true);
          await zeigeGruppe(function () { return r16Mb('#wv-box .wv-boden') || wv(); }, function () { var d = r16Doc(); var kk = d && d.querySelectorAll('#wv-box .wv-k'); return kk && kk.length ? kk[kk.length - 1] : wv(); }, 8);
          var t = r6Inner(wv()), bw = /Bodenwert\s*\n?\s*([\d.]+ €)/i.exec(t), lz = /Liegenschaftszinssatz:?\s*([\d,]+ %)/.exec(t);
          function kartenW(re) { var d = r16Doc(); var kk = d && [].filter.call(d.querySelectorAll('#wv-box .wv-k'), function (x) { return re.test(r6Text(x.querySelector('.wv-t'))); })[0]; return kk ? r6Text(kk.querySelector('.wv-v')) : '–'; }
          _km.ew = kartenW(/^Ertragswert/i); _km.sw = kartenW(/^Sachwert/i); _km.vw = kartenW(/^Vergleichswert/i);
          await kmSag(s, 'Wertermittlung · Stufe 3', 'Bodenwert <b>' + (bw ? bw[1] : '–') + '</b>, Ertragswert <b>' + _km.ew + '</b>, Sachwert ' + _km.sw + '.',
            'Das Herzstück: die Wertermittlung nach der Immobilienwertermittlungsverordnung. Bodenwert ' + (bw ? bw[1] : '') + ', Ertragswert ' + _km.ew + ', Sachwert ' + _km.sw + '. Weil wir ein Renditeobjekt bewerten, führt das Ertragswertverfahren.', null,
            { was: 'Nichts — drei Verfahren, eine Herleitung.', warum: 'Bei Renditeobjekten führt der Ertragswert (§ 6 ImmoWertV).', folge: 'Jeder Wert trägt Quelle, Stufe und Rechenweg.' });
          /* der Liegenschaftszins: im Bericht „Liegenschaftszinssatz: x % · amtlich“ samt Quelle (gemessen am Bericht 371).
             „A, angepasst“ (§ 33) steht dort nur, wo der Ausschuss eine Formel oder Koeffizienten führt. */
          var lzE = function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#wv-box *'), function (x) { return x.offsetWidth && /^Liegenschaftszinssatz:/.test(r6Text(x)) && r6Text(x).length < 120; }).pop(); };
          var lzQ = function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#wv-box *'), function (x) { return x.offsetWidth && /^Liegenschaftszinssätze für dieses Gebiet/.test(r6Text(x)) && r6Text(x).length < 320; }).pop(); };
          if (lzE()) {
            await r16Hin(lzE(), false);
            if (lzQ()) await zeigeGruppe(lzE, lzQ, 8); else await zeige(lzE, 8);
            var lzt = r6Text(lzE()), ang = /angepasst/.test(lzt);
            var CCk = (window.DPM_KOMPLETT_DATEN && DPM_KOMPLETT_DATEN.mb3.data.cross_check) || {}, EWk = CCk.ertragswert || {};
            var lzA = String(EWk.liegenschaftszins_quelle || '').split(',')[0];
            if (EWk.liegenschaftszins_anpassung && EWk.liegenschaftszins_anpassung.angepasst) ang = true;
            _km.lzsZeile = lzt;
            await kmSag(s, 'Der Liegenschaftszins', '<b>' + lzt.replace(/^Liegenschaftszinssatz:\s*/, '') + '</b>' + (lzA ? ' — ' + lzA : '') + (ang ? ', objektspezifisch angepasst („A, angepasst“).' : '.'),
              'Der stärkste Hebel im Ertragswert ist der Liegenschaftszins: hier ' + lzt.replace(/^Liegenschaftszinssatz:\s*/, '').replace(/\s*·.*$/, '').replace(',', ' Komma ').replace('%', 'Prozent') + ', amtlich, vom zuständigen Gutachterausschuss, mit Jahrgang und Link zur Quelle. Führt ein Ausschuss eine Formel oder Koeffizienten, passt DealPilot den Zins nach Paragraf 33 an das Objekt an; im Bericht steht dann „A, angepasst“. ' + (ang ? 'Genau das ist hier der Fall.' : 'Für dieses Haus führt der Ausschuss einen festen Satz — er gilt unverändert.'), null,
              { was: 'Nichts — der Zins kommt vom Gutachterausschuss.', warum: 'Der Zins ist der stärkste Hebel im Ertragswert.', folge: 'Mit Formel des Ausschusses: angepasst nach § 33, „A, angepasst“.' });
          }
          /* Vergleichswert: nur mit vollständig anpassbaren amtlichen Vergleichsfaktoren - hier keine Karte */
          var vkK = function () { var d = r16Doc(); return d && [].filter.call(d.querySelectorAll('#wv-box .wv-k'), function (x) { return /^Vergleichswert/i.test(r6Text(x.querySelector('.wv-t'))); })[0]; };
          var avf = ((window.DPM_KOMPLETT_DATEN && DPM_KOMPLETT_DATEN.mb3.data.cross_check) || {}).amtlicher_vergleichsfaktor || {};
          var nKarten = (function () { var d = r16Doc(); return d ? d.querySelectorAll('#wv-box .wv-k').length : 0; })();
          if (!vkK()) {
            await r16Hin(wv(), true);
            await zeigeGruppe(function () { var d = r16Doc(); var kk = d && d.querySelectorAll('#wv-box .wv-k'); return kk && kk[0]; }, function () { var d = r16Doc(); var kk = d && d.querySelectorAll('#wv-box .wv-k'); return kk && kk[kk.length - 1]; }, 8);
            DPM_KM.vergleich = { karten: nKarten, grund: avf.grund || null, verfuegbar: avf.verfuegbar };
            await kmSag(s, 'Kein Vergleichswert', nKarten + ' Karten, <b>kein Vergleichswert</b> — ' + (avf.grund === 'objektart_ohne_tabelle' ? 'für Mehrfamilienhäuser führt der Ausschuss keine Vergleichsfaktoren.' : 'ohne vollständig anpassbare Vergleichsfaktoren keine Zahl.'),
              'Und was fehlt? Ein Vergleichswert. DealPilot rechnet ihn nur mit amtlichen Vergleichsfaktoren, die sich vollständig an das Objekt anpassen lassen. ' + (avf.grund === 'objektart_ohne_tabelle' ? 'Für Mehrfamilienhäuser führt der Gutachterausschuss hier keine Vergleichsfaktoren.' : 'Fehlt eine Anpassung, rechnet DealPilot nicht halb.') + ' Dann gibt es keinen Wert — statt einer Zahl, die nur so aussieht wie eine.', null,
              { was: 'Nichts — DealPilot prüft die Vergleichsfaktoren.', warum: 'Ein halb angepasster Faktor wäre eine erfundene Zahl.', folge: 'Ohne volle Anpassung: kein Vergleichswert.' });
          }
        }
        r16MbZu(); await kmPause(1200);
        /* Abgleich im Reiter Objekt */
        reiter('s0'); await kmPause(900);
        try { if (window.DpMbAbgleich) await DpMbAbgleich.laden(true); } catch (e) {}
        await kmPause(1200);
        var ab = function () { var h = q('#mba-objekt'); return h && h.offsetWidth ? h : null; };
        await warteAuf(ab, 6000);
        if (ab()) {
          var auf = q('#mba-objekt [data-mba-auf]'); if (auf && !q('#mba-objekt [data-mba-ueb]')) { auf.click(); await kmPause(700); }
          await zeige(ab, 8);
          var hz = [].map.call(document.querySelectorAll('#mba-objekt li, #mba-objekt .mba-satz'), function (x) { return r6Text(x); }).filter(Boolean);
          _km.hinweise = hz; DPM_KM.hinweise = hz;
          await kmSag(s, 'Abgleich mit dem Marktbericht', r6Text(q('#mba-objekt [data-mba-auf]') || ab()).replace(/[▾▸]/g, '').trim().slice(0, 90) + (hz.length ? ' — z. B. ' + hz[0].slice(0, 110) + (hz[0].length > 110 ? ' …' : '') : '') + '.',
            'Zurück im Objekt wartet ein kompakter Abgleich mit dem Marktbericht. Er zeigt nur, was eine Folge hat: geänderte Eingaben seit dem Bericht, eine eigene Lage-Einschätzung, die deutlich von der Messung abweicht, einen anderen Bodenrichtwert oder einen Verkehrswert, der weit weg liegt. ' + (hz.length ? 'Hier meldet er: ' + hz[0] : ''), null,
            { was: 'Nichts — der Abgleich meldet sich selbst.', warum: 'Er zeigt nur Abweichungen, die eine Folge haben.', folge: 'Ein Klick übernimmt die Messung ins Objekt.' });
          var ueb = function () { return q('#mba-objekt [data-mba-ueb="mikrolage"]') || q('#mba-objekt [data-mba-ueb]'); };
          if (ueb()) {
            await zeige(ueb, 10);
            var vor = kmOpt('mikrolage');
            await kmSag(s, 'Messung übernehmen', 'Ein Klick — die Mikrolage aus dem Bericht ersetzt unsere Schätzung „' + vor + '“.', 'Wir waren zu vorsichtig. Ein Klick auf „Messung übernehmen“ …', 1200,
              { was: 'Ein Klick auf „Messung übernehmen“.', warum: 'Die Messung ist belastbarer als unsere Schätzung.', folge: 'Deal Score und Investor Deal Score rechnen neu.' });
            var u = ueb(); if (u) u.click();
            await kmPause(1500);
            await zeige(feldVon('mikrolage'), 10);
            await kmSag(s, 'Übernommen', 'Mikrolage jetzt <b>' + kmOpt('mikrolage') + '</b> — Herkunft: gemessen.',
              '… und die Mikrolage steht jetzt auf ' + kmOpt('mikrolage') + ', mit der Herkunft „gemessen“. Score und Investor Deal Score rechnen ab sofort damit.', null,
              { was: 'Nichts — der Wert ist übernommen.', warum: 'Jede Lage-Angabe trägt ihre Herkunft.', folge: 'Die Bewertung des Objekts steigt mit der besseren Lage.' });
          }
        }
        /* Wertangabe: Marktwert aus dem Bericht */
        var wa = function () { var e = document.getElementById('svwert'); return e && (e.closest('.wa-raster') || e.closest('.f')); };
        if (wa()) {
          await zeige(wa, 8);
          var vwb = kmOpt('oe-vw-wahl');
          await kmSag(s, 'Die Wertangabe', 'Bericht: <b>' + (vwb || '–') + '</b>. Marktwert/Verkehrswert bleibt leer — Herkunft „automatisch“.',
            'Und die Wertangabe: in der Zeile steht jetzt der Bericht' + (vwb ? ', ' + vwb.replace(/ · /g, ', ').replace('€', 'Euro') : '') + '. Das Feld Marktwert oder Verkehrswert lassen wir trotzdem leer. Für den Beleihungsauslauf zählt nur ein Wert aus einem Gutachten oder einer Bankbewertung — ein Marktbericht ist eine Indikation, kein Gutachten.', null,
            { was: 'Die Herkunft des Werts.', warum: 'Gutachten, Bank, Marktbericht oder Schätzung wiegen verschieden.', folge: 'Nur Gutachten und Bank tragen den Beleihungsauslauf.' });
        }
      },

      /* ════ KAPITEL 8 · ZIELBILD ════ */
      async function (s) {
        await kmKapitel(s, 8, 'Zielbild', 'Mieterhöhung, Maßnahmen am Haus und je Wohnung — der Plan.',
          'Kapitel acht: das Zielbild. Bisher haben wir beschrieben, was ist. Jetzt planen wir: welche Mieterhöhung der Vertrag erlaubt, was wir am ganzen Haus machen und was in einzelnen Wohnungen nach einem Mieterwechsel.');
        reiter('s0'); var m = q('.main-col'); if (m) m.scrollTop = 0;
        var kn = function () { var b = q('#mff-oeffnen') || q('#mfh-oeffnen'); return b && b.offsetWidth ? b : null; };
        await zeige(kn, 10); await kmPause(1500);
        var b = kn(); if (b) b.click();
        await warteAuf(function () { return r26Mfh('#mfh-body'); }, 4000);
        kegelHoch(true); await kmPause(900);
        var zj = function () { var x = r26Mfh('#mfh-zbjahr'); return x && x.offsetWidth ? x : null; };
        if (zj()) {
          await kmEingabe(s, function () { var x = zj(); return x && x.parentElement; }, 'Zielbild fertig ' + KM.zbJahr, 'Bis wann ist der Plan umgesetzt? <b>' + KM.zbJahr + '</b>.',
            { was: 'Das Jahr, in dem der Plan umgesetzt ist.', warum: 'Ein Plan braucht einen Zeitpunkt.', folge: 'Ab diesem Jahr rechnet die Mietentwicklung mit dem Ziel.' },
            'Im ersten Schritt das Jahr, in dem das Zielbild fertig sein soll: ' + KM.zbJahr + '. Dieses Jahr steht später über den Spalten in Pilot-Analyse und PDF.',
            async function () { await kmPause(800); await r26Tippe(zj(), KM.zbJahr, kmT()); });
        }
        var hm = function () { var x = r26Mfh('#mfh-haus-mass'); return x && x.closest('.mfh-haus-mass'); };
        var hx = hm(); if (hx) { var sc = scroller(hx); if (sc) sc.scrollTop += rect(hx).top - 140; }
        await kmPause(700);
        var chips = [].map.call(document.querySelectorAll('#mfh-haus-mass [data-zb-chip]'), function (c) { return r6Text(c).replace(/\s*\+\d+\s*P\.?\s*$/, ''); }).filter(Boolean);
        await zeige(hm, 8);
        await kmSag(s, 'Maßnahmen am ganzen Haus', chips.length + ' Bausteine: ' + chips.join(', ') + '.',
          'Darunter die Maßnahmen am ganzen Haus. ' + chips.length + ' Bausteine stehen zur Auswahl: ' + chips.join(', ') + '. Was die Anlage 2 als Element kennt, bringt Modernisierungspunkte; die übrigen zählen nur mit ihren Kosten. Die Kosten werden nach Wohnfläche auf die Wohnungen verteilt.', null,
          { was: 'Eine oder mehrere Maßnahmen am Haus, mit Kosten.', warum: 'Dach, Fassade oder Heizung betreffen alle Wohnungen.', folge: 'Kosten nach Fläche verteilt, Punkte für jede Wohnung.' });
        for (var j = 0; j < KM.haus.length; j++) {
          var H = KM.haus[j];
          await kmEingabe(s, hm, 'Fassade dämmen', 'Fassade/Dämmung für <b>' + de(+H[1]) + ' €</b>. Die Mieter bleiben im Haus — <b>' + H[3] + ' %</b> davon sind Erhaltung.',
            { was: 'Fassade/Dämmung, Kosten, „Mieter bleibt drin“ und Erhaltungsanteil.', warum: 'Modernisierung darf auf die Miete umgelegt werden (§ 559 BGB).', folge: '8 % der Kosten ohne Erhaltungsanteil pro Jahr auf die Miete.' },
            'Wir planen eine Maßnahme: die Fassade dämmen, sechzigtausend Euro laut Angebot. Die Mieter bleiben während der Arbeiten im Haus — deshalb setzen wir das Häkchen „Mieter bleibt drin — Kosten auf die Miete umlegen“. Das ist die Modernisierungsumlage nach Paragraf 559 BGB. Aber nicht alles ist Modernisierung: dreißig Prozent sind ohnehin fällige Instandsetzung, also Erhaltung. Die tragen wir ein — sie dürfen nicht umgelegt werden.',
            async function () {
              var c = r26Mfh('#mfh-haus-mass [data-zb-chip="' + H[0] + '"]'); if (c && !c.classList.contains('on')) c.click();
              await kmPause(1500);
              var ks = r26Mfh('#mfh-haus-mass') ? r26Mfh('#mfh-haus-mass').querySelectorAll('[data-zb-k]') : [], idx = ks.length - 1;
              await r26Tippe(ks[idx], H[1], kmT());
              if (H[2]) {
                await kmPause(1800);
                var cb = r26Mfh('#mfh-haus-mass [data-zb-b="' + idx + '"]'); if (cb && !cb.checked) cb.click();
                await kmPause(1800);
                var e = r26Mfh('#mfh-haus-mass [data-zb-e="' + idx + '"]'); if (e) await r26Tippe(e, H[3], kmT());
              }
            }, 3000);
        }
        var info = function () { return r26Mfh('#mfh-haus-mass .dp-zb-bew-info'); };
        if (info()) {
          await zeige(info, 8);
          await kmSag(s, 'Die Modernisierungsumlage', r6Text(info()).replace(/^Modernisierungsumlage \(§ 559 BGB\):\s*/, '').slice(0, 160) + (r6Text(info()).length > 200 ? ' …' : ''),
            'Die Regel steht direkt darunter: acht Prozent der Kosten pro Jahr dürfen auf die Miete — ohne den Erhaltungsanteil, und gedeckelt: höchstens drei Euro je Quadratmeter in sechs Jahren, bei einer Miete unter sieben Euro höchstens zwei Euro. Das geht in die Soll-Miete jeder Wohnung ein.', null,
            { was: 'Nichts — DealPilot rechnet die Umlage.', warum: 'Die Kappung schützt die Mieter.', folge: 'Die Umlage erscheint in der Soll-Miete jeder Wohnung.' });
        }
        await zeige(hm, 8);
        await kmSag(s, 'Am Haus', r6Text(r26Mfh('#mfh-haus-sum')).replace(/ — in den Kosten.*$/, '').replace(/^Am Haus:\s*/, '') + ' — nach Fläche auf die Wohnungen verteilt.',
          'Zusammen: ' + r6Text(r26Mfh('#mfh-haus-sum')).replace(/ — in den Kosten.*$/, '').replace(/^Am Haus:\s*/, '') + '. Die Kosten stecken anteilig in jeder Wohnung.', 3000,
          { was: 'Nichts — die Summe am Haus.', warum: 'Eine Maßnahme, fünf Wohnungen.', folge: 'Jede Wohnung trägt ihren Anteil nach Fläche.' });
        /* Wohnungen */
        var wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return r26Zelle(0, 'nr'); }, 3000);
        await kmPause(900);
        /* Wohnung 2: Mieterhöhung nach § 558 */
        var P = KM.plan[1];
        await r26WohnungAuf(1);
        await kmEingabe(s, r26BlockTitel(/^Mietvertrag/), 'Wohnung 2 · Mietvertrag', 'Unbefristet, zuletzt erhöht im <b>' + kmMonat(P.mv_letzte_erhoehung) + '</b>.',
          { was: 'Vertragsart und Datum der letzten Erhöhung.', warum: 'Erhöhung frühestens 15 Monate nach der letzten (§ 558 BGB).', folge: 'Daraus ergibt sich, ab wann die Soll-Miete gilt.' },
          'Wohnung zwei hat einen normalen, unbefristeten Vertrag. Zuletzt erhöht wurde im ' + kmMonat(P.mv_letzte_erhoehung) + '. Das Datum ist wichtig: nach Paragraf 558 BGB darf die Miete frühestens fünfzehn Monate nach der letzten Erhöhung wieder steigen.',
          async function () { await kmPause(800); await r26Feld('mv_art', P.mv_art, kmT()); await kmPause(1500); await r26Feld('mv_letzte_erhoehung', P.mv_letzte_erhoehung, kmT()); });
        await kmEingabe(s, r26Block('soll'), 'Wohnung 2 · Vergleichsmiete', 'Aus dem Mietspiegel: <b>' + P.vgl_qm + ' €/m²</b>.',
          { was: 'Die ortsübliche Vergleichsmiete je m².', warum: 'Bis dahin darf die Miete im laufenden Vertrag steigen.', folge: 'DealPilot rechnet Soll-Miete und Kappungsgrenze.' },
          'Für die Mieterhöhung tragen wir nur die ortsübliche Vergleichsmiete aus dem Mietspiegel ein: ' + P.vgl_qm.replace(',', ' Komma ') + ' Euro je Quadratmeter. Alles Weitere rechnet DealPilot.',
          async function () { await kmPause(800); await r26Feld('vgl_qm', P.vgl_qm, kmT()); await warteAuf(function () { return r26Kv('#mfh-we-soll .mfh-we-kv')['Soll-Miete']; }, 6000); });
        var kv = r26Kv('#mfh-we-soll .mfh-we-kv'), kt = (function () { var h = document.querySelectorAll('#mfh-we-soll .mfh-we-hint'); return h.length ? r6Text(h[h.length - 1]) : ''; })();
        var kg = /Kappungsgrenze (\d+) %/.exec(kt);
        await zeige(function () { return r26We('#mfh-we-soll'); }, 6);
        var hk2 = String(kv['Herkunft'] || '').replace(/^gerechnet \(§ 558\) · /, '');
        DPM_KM.soll2 = { kv: kv, hinweis: kt };
        await kmSag(s, 'Die Soll-Miete', '<b>' + (kv['Soll-Miete'] || '–') + '</b>, erreichbar ab <b>' + (kv['erreichbar ab'] || '–') + '</b>' + (hk2 ? ' — ' + hk2 : '') + '.',
          'Das Ergebnis: eine Soll-Miete von ' + String(kv['Soll-Miete'] || '').replace('€/Monat', 'Euro im Monat').replace('€/m²', 'Euro je Quadratmeter') + ', erreichbar ab ' + (kv['erreichbar ab'] || '') + '. Sie liegt über der Vergleichsmiete, weil die Umlage der Fassadendämmung dazukommt: die Erhöhung nach Paragraf 558 bis zur Vergleichsmiete' + (kg ? ', begrenzt durch die Kappungsgrenze von ' + kg[1] + ' Prozent in drei Jahren,' : '') + ' und die Modernisierungsumlage nach Paragraf 559 stehen nebeneinander. Die Soll-Miete ist das, was der laufende Vertrag hergibt — ohne Mieterwechsel.', null,
          { was: 'Nichts — DealPilot rechnet die Soll-Miete.', warum: 'Vergleichsmiete und Kappungsgrenze (§ 558) plus Umlage (§ 559).', folge: 'Ab dem Termin rechnet die Mietentwicklung mit ihr.' });
        await r26WohnungZu();
        /* Wohnungen 3 und 5: Zielbild nach Mieterwechsel */
        var ziele = [2, 4];
        for (var z = 0; z < ziele.length; z++) {
          var i = ziele[z], Q = KM.plan[i], W = KM.we[i];
          await r26WohnungAuf(i);
          await kmEingabe(s, r26Block('ziel'), 'Wohnung ' + W[0] + ' · Zielbild', (z === 0 ? 'Bad für 18.000 €, Böden für 9.000 €' : 'Bad für 15.000 €, Renovierung 6.000 €') + ' — danach <b>' + Q.ziel_qm + ' €/m²</b> ' + Q.ziel_wann + '.',
            { was: 'Maßnahmen als Bausteine, Kosten, Zielmiete und Zeitpunkt.', warum: 'Nach einem Mieterwechsel ist Neuvermietung zur Marktmiete möglich.', folge: 'Kosten, Punkte und Zielmiete je Wohnung.' },
            z === 0 ? 'Wohnung drei ist stark sanierungsbedürftig. Für den nächsten Mieterwechsel planen wir ein neues Bad für achtzehntausend Euro und neue Böden für neuntausend. Danach vermieten wir neu, zu zehn Euro je Quadratmeter.' : 'Ebenso Wohnung fünf im Dachgeschoss: neues Bad für fünfzehntausend Euro und eine Renovierung für sechstausend, danach neun Euro fünfzig je Quadratmeter.',
            async function () { await kmPause(800); await kmMassnahmen(Q.mass); await kmPause(1200); await r26Feld('ziel_qm', Q.ziel_qm, kmT()); await kmPause(1200); await r26Feld('ziel_wann', Q.ziel_wann, 60); });
          var kz = r26Kv('#mfh-we-ziel .mfh-we-kv'), kg1 = /^(-?[\d.]+ €)/.exec(String(kz['Kosten gesamt'] || '')), kgH = /Anteil Haus ([\d.]+ €)/.exec(String(kz['Kosten gesamt'] || ''));
          var kgs = kg1 ? kg1[1] : (kz['Kosten gesamt'] || '–');
          await zeige(function () { return r26We('#mfh-we-ziel'); }, 6);
          await kmSag(s, 'Wohnung ' + W[0] + ' · Kosten und Punkte', 'Kosten <b>' + kgs + '</b>' + (kgH ? ', davon ' + kgH[1] + ' Anteil an der Fassade' : '') + '; ' + String(kz['Modernisierungspunkte'] || '–').replace(/\s*\(Anlage 2\)/, '') + ' Punkte, Zielmiete <b>' + (kz['Zielmiete'] || '–') + '</b>.',
            'DealPilot zeigt die Kosten dieser Wohnung, ' + kgs.replace('€', 'Euro') + (kgH ? ' — darin ' + kgH[1].replace('€', 'Euro') + ' als ihr Anteil an der Fassade' : '') + ' —, die zusätzlichen Modernisierungspunkte nach Anlage 2 und die Zielmiete von ' + String(kz['Zielmiete'] || '').replace('€/Monat', 'Euro im Monat') + '.', null,
            { was: 'Nichts — Kosten und Punkte rechnet DealPilot.', warum: 'Jede Maßnahme hat Kosten und bringt Punkte.', folge: 'Das Zielbild steht neben Ist und Soll — als Plan, nicht als Ist.' });
          await r26WohnungZu();
        }
        /* Ergebnis und übernehmen */
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click(); await kmPause(800);
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return r26Mfh('#mfh-uep'); }, 3000);
        await kmPause(900);
        await zeige(function () { return r26Mfh('#mfh-body'); }, 6);
        var et = r6Text(r26Mfh('#mfh-body'));
        DPM_KM.ergebnisText = et.slice(0, 1500);
        var zr = /Zielbild[^.]*?Restnutzungsdauer[^\d]*(\d+) Jahre/.exec(et) || /nach (?:dem )?Zielbild[^\d]*(\d+) Jahre/.exec(et);
        await kmSag(s, 'Heute und im Zielbild', 'Restnutzungsdauer heute <b>' + (_km.rnd || '–') + ' Jahre</b>' + (zr ? ', im Zielbild <b>' + zr[1] + ' Jahre</b>' : '') + ' — gerechnet wird mit dem Bestand.',
          'Das Ergebnis zeigt beides: das Haus heute und nach dem Zielbild. Score und Wertermittlung rechnen weiter mit dem Bestand, denn das Zielbild ist ein Plan. In Pilot-Analyse und Bank-PDF steht es neben Ist und Soll.', null,
          { was: 'Nichts — Bestand und Zielbild nebeneinander.', warum: 'Ein Plan ist kein Ist.', folge: 'Bewertet wird der Bestand; das Zielbild zeigt das Potenzial.' });
        var san = r26Mfh('#mfh-san'); if (san && san.checked) san.click();
        await zeige(function () { return r26Mfh('#mfh-weiter'); }, 8);
        await kmPause(2500);
        wb = r26Mfh('#mfh-weiter'); if (wb) wb.click();
        await warteAuf(function () { return !q('#mfh-modal'); }, 5000);
        kegelHoch(false);
        await kmPause(1500);
        reiter('s1'); await kmPause(1300);
        var zbf = function () { var e = document.getElementById('zb_soll_qm'); return e && e.offsetWidth ? (e.closest('.card') || e.closest('.f')) : null; };
        if (zbf()) {
          await zeigeGruppe(feldVon('zb_fertig_jahr'), feldVon('zb_ziel_wann'), 8);
          await kmSag(s, 'Im Reiter Investition', 'Zielbild <b>' + (wert('zb_fertig_jahr') || KM.zbJahr) + '</b>: Soll-Miete ' + (wert('zb_soll_qm') || '–') + ' €/m², Zielmiete <b>' + (wert('zb_ziel_qm') || '–') + ' €/m²</b>.',
            'Im Reiter Investition steht das Zielbild zusammengefasst: das Jahr ' + (wert('zb_fertig_jahr') || KM.zbJahr) + ', die Soll-Miete und die Zielmiete im Schnitt des Hauses.', null,
            { was: 'Nichts — die Zusammenfassung aus den Wohnungen.', warum: 'Ein Blick auf den ganzen Plan.', folge: 'Pilot-Analyse und Bank-PDF zeigen Ist, Soll und Zielbild.' });
        }
      },

      /* ════ KAPITEL 9 · ERGEBNIS UND BANK-PDF ════ */
      async function (s) {
        await kmKapitel(s, 9, 'Ergebnis und Bank-PDF', 'Deal Score, Investor Deal Score, Kennzahlen — und das PDF für die Bank.',
          'Kapitel neun: das Ergebnis. Wir sehen, wie DealPilot das Haus bewertet, und erzeugen das PDF für das Gespräch mit der Bank.');
        reiter('s6'); await kmPause(1500);
        await warteAuf(function () { return r12Karte(1)() && r12Kopf(1).score; }, 8000);
        await kmPause(800);
        var ring = function (i) { return function () { var k = r12Karte(i)(); return k && (k.querySelector('.dpsh-colring') || k.querySelector('.dpsh-mainrow') || k.querySelector('.dpsh-headrow')); }; };
        var a = r12Kopf(0), bb = r12Kopf(1);
        DPM_KM.scores = { deal: a, investor: bb };
        await zeige(ring(0), 10);
        await kmSag(s, 'Der Deal Score', 'Deal Score <b>' + (a.score || '–') + ' · ' + r12Wort(a.wort) + '</b> — aus Cashflow, Rendite und weiteren Kennzahlen.',
          'Im Reiter Bewertung: der Deal Score, ' + (a.score || '') + ' von hundert, Stufe ' + r12Wort(a.wort) + '. Er fasst die Kennzahlen des Objekts zusammen — Cashflow, Rendite, Finanzierung — gewichtet nach deinen Einstellungen.', null,
          { was: 'Nichts — der Score rechnet sich aus allen Eingaben.', warum: 'Eine Zahl für den schnellen Vergleich von Objekten.', folge: 'Die Gewichte stellst du in den Einstellungen ein.' });
        await zeige(ring(1), 10);
        await kmSag(s, 'Der Investor Deal Score', 'Investor Deal Score <b>' + (bb.score || '–') + ' · ' + r12Wort(bb.wort) + '</b> — dazu Lage, Risiko und Potenzial.',
          'Daneben der Investor Deal Score, ' + (bb.score || '') + ' von hundert, ' + r12Wort(bb.wort) + '. Er schaut zusätzlich auf Lage, Risiko und Upside — hier fließen die gemessene Mikrolage und die Angaben zum Markt am Ort ein.', null,
          { was: 'Nichts — die Lage aus dem Marktbericht ist schon drin.', warum: 'Rendite allein sagt nichts über das Risiko.', folge: 'Zwei Blickwinkel auf dasselbe Haus.' });
        var K = (window.State && State.kpis) || {};
        var kb = function () { return q('#s6 .dpsh-statstrip') || q('#s6 .kpi-grid') || r12Karte(0)(); };
        await zeige(kb, 8);
        DPM_KM.kpis = { bmy: K.bmy, dscr: K.dscr, cf_op: K.cf_op, cf_ns: K.cf_ns, ltv: K.ltv };
        await kmSag(s, 'Die Kennzahlen', 'Bruttomietrendite <b>' + (K.bmy != null ? de(K.bmy, 2) + ' %' : '–') + '</b>, DSCR <b>' + (K.dscr != null ? de(K.dscr, 2) : '–') + '</b>, Cashflow vor Steuern <b>' + (K.cf_op != null ? eur(K.cf_op) : '–') + '</b> im Jahr' + (K.cf_ns != null ? ', nach Steuern ' + eur(K.cf_ns) : '') + '.',
          'Die wichtigsten Kennzahlen: Bruttomietrendite ' + (K.bmy != null ? de(K.bmy, 2) : '') + ' Prozent. Schuldendienstdeckung ' + (K.dscr != null ? de(K.dscr, 2) : '') + '' + (K.dscr != null ? ' — der Reinertrag deckt Zins und Tilgung ' + de(K.dscr, 1).replace(',', ' Komma ') + '-fach' : '') + '. Und der Cashflow vor Steuern: ' + (K.cf_op != null ? de(Math.round(K.cf_op)) + ' Euro' : '') + ' im Jahr' + (K.cf_ns != null ? ', nach Steuern ' + de(Math.round(K.cf_ns)) + ' Euro' : '') + '.', null,
          { was: 'Nichts — alles aus den Eingaben gerechnet.', warum: 'Die Bank schaut auf DSCR und Beleihungsauslauf.', folge: 'Genau diese Zahlen stehen im Bank-PDF.' });
        /* Bank-PDF */
        try { _r19.wahl = localStorage.getItem('dp_pdf_wahl'); localStorage.removeItem('dp_pdf_wahl'); } catch (e) {}
        await zeige(function () { return qs('.sb-act-item[onclick*="bank"]') || qs('[onclick*="exportPDFBank"]') || q('nav.tabs'); }, 8);
        await kmSag(s, 'Das Bank-PDF', 'Ein Klick erzeugt die <b>Bankfassung</b>: Objekt, Finanzierung, Kennzahlen, Belastungsprobe.',
          'Zum Schluss das PDF für die Bank. Ein Klick erzeugt die Bankfassung — mit deinem Logo, wenn du eins hinterlegt hast.', 2000,
          { was: 'Ein Klick auf das Bank-PDF.', warum: 'Die Bank will Zahlen sauber und vollständig.', folge: 'Ein PDF mit Objekt, Finanzierung, Kennzahlen und Annahmen.' });
        var bank = await kmBankPdf();
        _r19.bank = bank;
        if (!bank) { await kmSag(s, 'Das Bank-PDF', 'Das PDF entsteht im Browser — nichts wird verschickt.', null, 2000); return; }
        zeige(null); kegelHoch(true); kmTafel(null);
        await r19Seite(bank, 1);
        var Kk = r19K();
        await kmSag(s, 'Seite 1 · Objekt und Investition', 'Kaufpreis <b>' + eur(Kk.kp) + '</b>, Gesamtinvestition ' + eur(Kk.gi) + ', Darlehen <b>' + eur(Kk.d1) + '</b>.',
          'Seite eins: das Objekt mit allen Eckdaten, die Investition mit jeder Nebenkostenzeile — Gesamtinvestition ' + (eur(Kk.gi) || '') + ' — und die Finanzierung.', null,
          { was: 'Nichts — das PDF entsteht aus dem Objekt.', warum: 'Die Bank prüft zuerst Objekt und Investition.', folge: 'Jede Zahl ist dieselbe wie in der App.' });
        await r19Seite(bank, 2, 190);
        await kmSag(s, 'Seite 2 · Kennzahlen', 'Rendite, Cashflow, DSCR, Beleihungsauslauf — mit Ampeln.',
          'Seite zwei: die Kennzahlen mit Ampeln — Rendite, Cashflow, Schuldendienstdeckung und Beleihungsauslauf.', null,
          { was: 'Nichts.', warum: 'Die Bank entscheidet über DSCR und Beleihungsauslauf.', folge: 'Ampeln zeigen, wo das Haus stark oder schwach ist.' });
        var st = r19Stelle(/^BELASTUNGSPROBE/, 7);
        await r19Seite(bank, st.seite, st.oben);
        await kmSag(s, 'Die Belastungsprobe', 'Was passiert, wenn Zins oder Leerstand steigen?',
          'Und die Belastungsprobe: was passiert mit dem Cashflow, wenn der Zins bei der Anschlussfinanzierung steigt oder Wohnungen leer stehen. Genau diese Frage stellt jede Bank.', null,
          { was: 'Nichts.', warum: 'Jede Bank fragt nach dem Risiko.', folge: 'Die Antwort steht schon im PDF.' });
        var wp = r19Stelle(/^WERTPOTENZIAL|^ZIELBILD/, null);
        if (wp && wp.seite && /WERTPOTENZIAL|ZIELBILD/.test((_r19.tok || []).join(' '))) {
          await r19Seite(bank, wp.seite, wp.oben);
          await kmSag(s, 'Zielbild im PDF', 'Der Plan aus Kapitel 8 — auch im PDF für die Bank.',
            'Auch das Zielbild aus Kapitel acht steht im PDF.', null,
            { was: 'Nichts.', warum: 'Die Bank sieht nicht nur das Heute, sondern den Plan.', folge: 'Das Potenzial des Hauses ist belegt, nicht behauptet.' });
        }
        r19Zu(); kegelHoch(false);
        reiter('s0'); var mm = q('.main-col'); if (mm) mm.scrollTop = 0;
        await zeige(function () { return q('#hdr-obj') || q('header.hdr'); }, 8);
        await kmSag(s, 'Geschafft', 'Ein Haus, neun Kapitel: angelegt, erfasst, finanziert, bewertet, geplant — <b>bereit für die Bank</b>.',
          'Geschafft. Ein Mehrfamilienhaus, neun Kapitel: angelegt, Wohnung für Wohnung erfasst, finanziert, steuerlich eingeordnet, amtlich bewertet, mit Zielbild geplant und bereit für das Gespräch mit der Bank. Jede Zahl, die du gesehen hast, hat DealPilot aus unseren Eingaben gerechnet. Danke fürs Zuschauen.', 3000,
          { was: 'Deine eigenen Objekte — genauso.', warum: 'Erst rechnen, dann kaufen.', folge: 'dealpilot.immo' });
      }
    ].map(function (f, i) { return async function (s) { await kmHalt(i); return f(s); }; })
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
        _zt0 = Date.now(); window.DPM_ZEILEN = []; window.DPM_ZEILEN_META = { drehbuch: name, start_abs: _zt0, ende_ms: null, tempo: TEMPO, studio: STUDIO };   /* v2371 */
        for (var i = 0; i < n; i++) {
          var ii = i;
          await D.szenen[i]({ zeile: function (k, t) { zeile(k, t, ii, n); } });
        }
        try { window.DPM_ZEILEN_META.ende_ms = Date.now() - _zt0; } catch (e) {}
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
