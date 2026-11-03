/* ══════════════════════════════════════════════════════════════════════
   v3110 · BORDBUCH — Fehler und Wünsche mit Screenshot, Markierung, Diktat

   Marcel am 03.11.2026: „ein Männchen für Fehler oder fürs Backlog … wir klicken
   drauf, es wird ein Screenshot gemacht, dann wird es gleich dargestellt, dann
   können wir dazu schreiben: Was fällt uns auf, was fehlt uns dort, wo ist das
   Problem … und noch ein paar Sachen markieren … und per Sprache rein diktieren.“
   Freigeschaltet im Admin für ausgewählte Nutzer („Backlog-User“, Zusatz
   'entwicklungspartner').

   Bild aus der Luftfahrt: Im technischen Bordbuch trägt die Crew ein, was ihr
   auffällt — die Wartung arbeitet es ab. Deshalb steht unten rechts ein
   Mechaniker mit Klemmbrett (unten links liegt die Benutzerkarte der
   Seitenleiste, gemessen 03.11.: dort verdeckte er sie).

   Ablauf: Klick auf den Mechaniker → html2canvas fotografiert den sichtbaren
   Ausschnitt (Mechaniker und Fenster ausgenommen) → Fenster mit dem Bild:
   Stift, Rahmen, Rückgängig; Art (Fehler/Wunsch/Idee), Titel, Beschreibung mit
   Diktat (DealPilotDiktat, derselbe Transkriptionsweg wie überall), Bereich,
   Dringlichkeit; weiteres Bild per Einfügen oder Datei. Gespeichert wird in
   umsetzungswuensche (routes/wuensche.js) mit Reiter, Objekt und Version als
   Kontext. Die Liste aller Einträge öffnet DpWuensche (umsetzungswuensche.js).
   Taste: Alt+B.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpBordbuch) return;

  var ROT = '#D8564C';
  var G = 'var(--wl-c9a84c,#C9A84C)';
  var zugang = false, laeuft = false;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function meld(t) { try { if (typeof window.toast === 'function') return window.toast(t); } catch (e) {} try { console.log('[Bordbuch]', t); } catch (e) {} }

  function stil() {
    if (document.getElementById('dp-bb-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-bb-stil';
    s.textContent = [
      '#dp-bb-fab{position:fixed;right:18px;bottom:14px;width:46px;height:76px;z-index:10057;cursor:pointer;border:0;padding:0;background:transparent;filter:drop-shadow(0 8px 10px rgba(0,0,0,.35));display:none}',
      '#dp-bb-fab.an{display:block}',
      '#dp-bb-fab svg{width:100%;height:100%;overflow:visible}',
      '#dp-bb-fab .bb-schild{position:absolute;right:0;bottom:calc(100% + 4px);white-space:nowrap;font:600 10.5px "JetBrains Mono",monospace;letter-spacing:.04em;background:#141210;color:#f3ead0;border:1px solid ' + G + ';border-radius:6px;padding:3px 7px;opacity:0;transition:opacity .2s;pointer-events:none}',
      '#dp-bb-fab:hover .bb-schild,#dp-bb-fab:focus-visible .bb-schild{opacity:1}',
      '#dp-bb-fab.knipst svg{animation:bb-blitz .5s ease-in-out infinite alternate}',
      '@keyframes bb-blitz{from{opacity:1}to{opacity:.45}}',
      '#dp-bb-fab .bb-oben{animation:bb-atem 3.4s ease-in-out infinite;transform-origin:50px 110px}',
      '@keyframes bb-atem{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.3px)}}',
      '#dp-bb-fab:hover .bb-arm{transform:rotate(-24deg)}',
      '#dp-bb-fab .bb-arm{transform-origin:31px 71px;transition:transform .35s cubic-bezier(.3,1.4,.5,1)}',
      '@media (max-width:640px){#dp-bb-fab{right:10px;bottom:84px;width:38px;height:62px}}',
      '@media print{#dp-bb-fab{display:none!important}}',
      '@media (prefers-reduced-motion:reduce){#dp-bb-fab .bb-oben{animation:none}}',
      /* Fenster */
      '.bb-hg{position:fixed;inset:0;background:rgba(5,5,5,.6);z-index:100060;display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}',
      '.bb{background:#FDFCFA;color:#2A2727;border-radius:16px;width:100%;max-width:1060px;box-shadow:0 24px 70px rgba(0,0,0,.4);font:400 14px/1.5 Inter,system-ui,sans-serif}',
      '.bb-kopf{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid #EFE7D6}',
      '.bb-kopf h3{margin:0;font:600 18px "Space Grotesk",sans-serif}',
      '.bb-kopf p{margin:1px 0 0;font-size:12px;color:#7A7370}',
      '.bb-zu{border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#7A7370}',
      '.bb-rumpf{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,1fr);gap:18px;padding:16px 20px 20px}',
      '.bb-bild{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.bb-werkzeug{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.bb-werkzeug button{border:1px solid #E3D9C4;background:#fff;border-radius:8px;padding:5px 10px;font:500 12.5px Inter,sans-serif;cursor:pointer;color:#2A2727}',
      '.bb-werkzeug button.an{background:#2A2727;color:#FDFCFA;border-color:#2A2727}',
      '.bb-werkzeug .bb-hinweis{font-size:11.5px;color:#7A7370;margin-left:auto}',
      '.bb-leinwand{position:relative;border:1px solid #E3D9C4;border-radius:10px;overflow:hidden;background:#F1ECE1;line-height:0}',
      '.bb-leinwand canvas{width:100%;height:auto;display:block;cursor:crosshair;touch-action:none}',
      '.bb-leer{padding:40px 16px;text-align:center;color:#7A7370;font-size:13px;line-height:1.5}',
      '.bb-weitere{display:flex;gap:8px;flex-wrap:wrap}',
      '.bb-weitere figure{margin:0;position:relative;width:96px;height:64px;border:1px solid #E3D9C4;border-radius:8px;overflow:hidden;background:#fff}',
      '.bb-weitere img{width:100%;height:100%;object-fit:cover}',
      '.bb-weitere figure button{position:absolute;top:2px;right:2px;border:0;border-radius:50%;width:18px;height:18px;line-height:16px;font-size:13px;background:rgba(5,5,5,.7);color:#fff;cursor:pointer;padding:0}',
      '.bb-form{display:flex;flex-direction:column;gap:11px;min-width:0}',
      '.bb-l{display:block;font:600 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;margin:0 0 4px}',
      '.bb input[type=text],.bb textarea,.bb select{width:100%;box-sizing:border-box;border:1px solid #E3D9C4;border-radius:9px;padding:8px 10px;font:inherit;background:#fff;color:#2A2727}',
      '.bb textarea{min-height:150px;resize:vertical}',
      '.bb-textzeile{display:flex;gap:6px;align-items:flex-start}.bb-textzeile textarea{flex:1}',
      '.bb-art{display:inline-flex;border:1px solid #E3D9C4;border-radius:10px;padding:2px;gap:2px;background:#fff}',
      '.bb-art button{border:0;background:transparent;border-radius:8px;padding:6px 12px;font:600 12.5px "Space Grotesk",sans-serif;cursor:pointer;color:#2A2727}',
      '.bb-art button.an{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505}',
      '.bb-reihe{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.bb-kontext{font-size:11.5px;color:#7A7370;background:#FBF6E9;border-radius:8px;padding:6px 9px;line-height:1.45}',
      '.bb-fuss{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.bb-knopf{border:0;border-radius:9px;padding:9px 16px;font:600 13.5px "Space Grotesk",sans-serif;cursor:pointer;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505}',
      '.bb-knopf[disabled]{opacity:.55;cursor:default}',
      '.bb-link{border:0;background:transparent;color:var(--wl-b8932f,#b8932f);font:500 12.5px Inter,sans-serif;cursor:pointer;padding:0;text-decoration:underline}',
      '.bb-meldung{font-size:12.5px;color:#7A7370}.bb-meldung.fehler{color:#B8625C}',
      '@media (max-width:820px){.bb-rumpf{grid-template-columns:1fr}.bb-hg{padding:10px 6px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* Der Mechaniker: gleiche Proportionen wie der Pilot (pilot-figur.js, viewBox 0 0 110 175),
     Overall, Warnweste, Gehörschutz, Klemmbrett (das Bordbuch) und Schraubenschlüssel. */
  function figur() {
    return '<svg viewBox="0 0 110 175" aria-hidden="true">'
      + '<ellipse cx="54" cy="170" rx="32" ry="4" fill="#000" opacity=".18"/>'
      + '<rect x="34" y="112" width="14" height="50" rx="3" fill="#2C3E5C"/><rect x="52" y="112" width="14" height="50" rx="3" fill="#24344D"/>'
      + '<ellipse cx="39" cy="164" rx="9" ry="4.2" fill="#141416"/><ellipse cx="61" cy="164" rx="9" ry="4.2" fill="#141416"/>'
      + '<g class="bb-oben">'
      /* linker Arm mit Klemmbrett */
      + '<path d="M76 68 Q81 72 79 84 L70 84 L68 70 Z" fill="#24344D"/><rect x="71" y="83" width="7.5" height="19" rx="3.5" fill="#DCA77F"/>'
      + '<g transform="rotate(8 82 104)"><rect x="70" y="90" width="26" height="33" rx="2.5" fill="#6B5A3E"/><rect x="72.5" y="94" width="21" height="26" rx="1" fill="#FDFCFA"/>'
      + '<rect x="77" y="87.5" width="12" height="5" rx="1.5" style="fill:' + G + '"/>'
      + '<rect x="75" y="99" width="15" height="1.6" fill="#B8B0A0"/><rect x="75" y="103.5" width="12" height="1.6" fill="#B8B0A0"/><rect x="75" y="108" width="14" height="1.6" fill="#B8B0A0"/>'
      + '<path d="M75 113.5 l2.5 2.5 l5-5" fill="none" stroke="' + ROT + '" stroke-width="1.8" stroke-linecap="round"/></g>'
      + '<circle cx="75" cy="104" r="4.2" fill="#DCA77F"/>'
      /* Rumpf: Overall und Warnweste */
      + '<path d="M30 68 Q50 61 50 61 L50 114 L29 114 Z" fill="#2C3E5C"/><path d="M50 61 Q70 61 70 68 L71 114 L50 114 Z" fill="#24344D"/>'
      + '<path d="M32 68 L45 64 L45 104 L31 104 Z" fill="#E0812E"/><path d="M55 64 L68 68 L69 104 L55 104 Z" fill="#C9701F"/>'
      + '<rect x="31" y="84" width="14" height="3" fill="#E9E6DD"/><rect x="55" y="84" width="14" height="3" fill="#D9D5CB"/>'
      + '<rect x="31" y="94" width="14" height="3" fill="#E9E6DD"/><rect x="55" y="94" width="14" height="3" fill="#D9D5CB"/>'
      + '<rect x="29" y="110" width="42" height="4.5" rx="1" fill="#1d1d20"/><rect x="47.5" y="110.3" width="5" height="3.8" rx=".8" style="fill:' + G + '"/>'
      + '<rect x="45" y="57" width="10" height="8" fill="#DCA77F"/>'
      /* rechter Arm mit Schraubenschlüssel */
      + '<g class="bb-arm"><path d="M24 68 Q19 72 21 84 L30 84 L32 70 Z" fill="#2C3E5C"/><rect x="21.5" y="83" width="7.5" height="19" rx="3.5" fill="#EDBE98"/>'
      + '<g transform="rotate(-20 25 106)"><rect x="23.4" y="96" width="3.4" height="22" rx="1.4" fill="#9AA0A8"/>'
      + '<path d="M21 118 a4.6 4.6 0 1 0 9.2 0 l-2 0 l0 3 l-5.2 0 l0 -3 Z" fill="#9AA0A8"/></g>'
      + '<circle cx="25.2" cy="104" r="4.4" fill="#EDBE98"/></g>'
      /* Kopf */
      + '<path d="M50 26 C40 26 35 33 35 43 C35 53 41 60 50 60 Z" fill="#EDBE98"/><path d="M50 26 C60 26 65 33 65 43 C65 53 59 60 50 60 Z" fill="#DCA77F"/>'
      + '<circle cx="43.5" cy="42" r="1.9" fill="#2a2420"/><circle cx="56.5" cy="42" r="1.9" fill="#2a2420"/>'
      + '<path d="M45.5 51 Q50 54.5 54.5 51" fill="none" stroke="#8a4a35" stroke-width="1.5" stroke-linecap="round"/>'
      /* Kappe nach hinten, Gehörschutz */
      + '<path d="M34 34 Q36 22 50 21 Q64 22 66 34 Z" fill="#2C3E5C"/><path d="M60 26 Q70 27 74 31 L66 33 Z" fill="#1F2D44"/>'
      + '<rect x="47" y="24" width="6" height="3" rx="1" style="fill:' + G + '"/>'
      + '<path d="M33 40 Q33 20 50 19 Q67 20 67 40" fill="none" stroke="#141416" stroke-width="2.4"/>'
      + '<rect x="28.5" y="37" width="8" height="12" rx="3.5" fill="#E0812E"/><rect x="63.5" y="37" width="8" height="12" rx="3.5" fill="#C9701F"/>'
      + '</g></svg>';
  }

  /* ─── Kontext ─────────────────────────────────────────────── */
  var version = null;
  function holeVersion() {
    if (version !== null) return;
    version = '';
    fetch('/version.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (v) { version = (v && v.major != null) ? (v.major + '.' + v.minor + '.' + v.patch + (v.paket ? ' (' + v.paket + ')' : '')) : ''; })
      .catch(function () {});
  }
  function reiterText() {
    var kand = ['nav.tabs .active', 'nav.tabs [aria-selected="true"]', '.tabs .tab.active', '[role="tab"][aria-selected="true"]'];
    for (var i = 0; i < kand.length; i++) {
      var e = document.querySelector(kand[i]);
      if (e && e.offsetParent !== null && e.textContent.trim()) return e.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
    }
    return '';
  }
  function kontext() {
    return {
      reiter: reiterText(),
      objekt: window._currentObjKey || '',
      seite: location.pathname + location.hash,
      fenster: window.innerWidth + ' × ' + window.innerHeight,
      version: version || '',
      ansicht: document.body.classList.contains('dp-chrome-hell') ? 'hell' : 'dunkel',
      browser: navigator.userAgent
    };
  }
  function bereichAus(reiter) {
    var r = String(reiter || '').toLowerCase();
    if (/steuer/.test(r)) return 'steuer';
    if (/finanz|bank|kredit|darlehen/.test(r)) return 'finanzierung';
    if (/markt|bewert|pilot/.test(r)) return 'marktbericht';
    if (/quick|boarding/.test(r)) return 'quickcheck';
    if (/unterlag|import|dokument/.test(r)) return 'unterlagen';
    if (r) return 'objekt';
    return 'sonstiges';
  }

  /* ─── Aufnahme ───────────────────────────────────────────── */
  /* v3110c · html2canvas 1.4.1 kennt keine modernen Farbangaben. Die App nutzt
     color-mix(); der Browser liefert das berechnet als „color(srgb r g b / a)“,
     und html2canvas bricht mit „unsupported color function "color"“ ab (gemessen
     03.11.2026 auf Staging, radial-gradient). In der KOPIE, die html2canvas
     fotografiert, werden diese Werte vorher in rgba() umgeschrieben. Die echte
     Seite bleibt unberührt. */
  var FARB_PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-shadow', 'fill', 'stroke',
    'text-decoration-color', 'column-rule-color'];
  function zuRgba(wert) {
    return String(wert)
      .replace(/color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.e+-]+%?))?\)/g, function (_, r, g, b, a) {
        var al = a == null ? 1 : (/%$/.test(a) ? parseFloat(a) / 100 : parseFloat(a));
        var k = function (v) { return Math.max(0, Math.min(255, Math.round(parseFloat(v) * 255))); };
        return 'rgba(' + k(r) + ', ' + k(g) + ', ' + k(b) + ', ' + (isFinite(al) ? al : 1) + ')';
      })
      .replace(/(?:color|oklab|oklch|lab|lch)\([^()]*\)/g, 'rgba(0, 0, 0, 0)');
  }
  /* v3110d · ERST ALLES LESEN, DANN ALLES SCHREIBEN. Abwechselnd lesen und
     schreiben ließ den Browser nach jedem setProperty alle Stile neu rechnen —
     bei dieser Seite fror der Tab ein (gemessen 03.11.2026). Unsichtbare
     Teilbäume (display:none) werden übersprungen, sie fotografiert niemand. */
  var FARB_RE = /(?:^|[\s,(])(?:color|oklab|oklch|lab|lch)\(/;
  function farbenGlaetten(doc) {
    var win = doc.defaultView, aend = [];
    var pruefe = function (el) {
        var cs; try { cs = win.getComputedStyle(el); } catch (e) { return 3; }
        if (cs.display === 'none') return 2;   /* FILTER_REJECT: ganzen Teilbaum auslassen */
        for (var j = 0; j < FARB_PROPS.length; j++) {
          var v = cs.getPropertyValue(FARB_PROPS[j]);
          if (v && FARB_RE.test(v)) aend.push([el, FARB_PROPS[j], zuRgba(v)]);
        }
        return 1;
    };
    [doc.documentElement, doc.body].forEach(function (el) { if (el) pruefe(el); });   /* Wurzel und body besucht der TreeWalker nicht */
    var gang = doc.createTreeWalker(doc.body || doc.documentElement, 1, { acceptNode: pruefe });
    while (gang.nextNode()) { /* nur sammeln */ }
    for (var i = 0; i < aend.length; i++) aend[i][0].style.setProperty(aend[i][1], aend[i][2], 'important');
    return aend.length;
  }
  /* Rückfall: die Bildschirmaufnahme des Browsers (fragt einmal nach, zeigt aber
     genau das, was man sieht — auch den Inhalt von iframes). Braucht einen Klick. */
  function bildschirmAufnahme() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) return Promise.resolve(null);
    return navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' })
      .then(function (stream) {
        return new Promise(function (ok) {
          var v = document.createElement('video'); v.muted = true; v.srcObject = stream;
          v.onloadedmetadata = function () {
            v.play().then(function () {
              setTimeout(function () {
                var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
                c.getContext('2d').drawImage(v, 0, 0);
                stream.getTracks().forEach(function (t) { t.stop(); });
                ok(c);
              }, 350);
            }).catch(function () { stream.getTracks().forEach(function (t) { t.stop(); }); ok(null); });
          };
        });
      }).catch(function () { return null; });
  }

  function aufnehmen() {
    if (typeof window.html2canvas !== 'function') return Promise.resolve(null);
    var w = document.documentElement.clientWidth || window.innerWidth, h = window.innerHeight;
    var scale = Math.min(1.25, Math.max(0.6, 1600 / w)) * Math.min(window.devicePixelRatio || 1, 1.5);
    scale = Math.min(scale, 1.5);
    return window.html2canvas(document.body, {
      x: window.scrollX, y: window.scrollY, width: w, height: h, windowWidth: w, windowHeight: h,
      scale: scale, useCORS: true, logging: false, backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      onclone: function (doc) { try { farbenGlaetten(doc); } catch (e) { console.warn('[Bordbuch] Farben', e); } },
      ignoreElements: function (el) {
        return el.id === 'dp-bb-fab' || (el.classList && (el.classList.contains('bb-hg') || el.classList.contains('toast')));
      }
    }).catch(function (e) { console.warn('[Bordbuch] Screenshot', e); return null; });
  }

  /* Bild verkleinern (Breite höchstens 1800 px) und als JPEG ausgeben */
  function alsJpeg(quelle, maxB) {
    maxB = maxB || 1800;
    var f = Math.min(1, maxB / quelle.width);
    var c = document.createElement('canvas'); c.width = Math.round(quelle.width * f); c.height = Math.round(quelle.height * f);
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(quelle, 0, 0, c.width, c.height);
    var q = 0.85, url = c.toDataURL('image/jpeg', q);
    while (url.length > 3.6 * 1024 * 1024 && q > 0.4) { q -= 0.15; url = c.toDataURL('image/jpeg', q); }
    return url;
  }
  function dateiAlsBild(datei) {
    return new Promise(function (ok, nein) {
      var r = new FileReader();
      r.onload = function () { var img = new Image(); img.onload = function () { ok(alsJpeg(img, 1800)); }; img.onerror = nein; img.src = r.result; };
      r.onerror = nein; r.readAsDataURL(datei);
    });
  }

  /* ─── Zeichnen ───────────────────────────────────────────── */
  function zeichenflaeche(canvas, basis) {
    var ctx = canvas.getContext('2d'), formen = [], werkzeug = 'rahmen', aktuell = null;
    var lw = Math.max(3, Math.round(canvas.width / 320));
    function neu() {
      ctx.drawImage(basis, 0, 0);
      formen.concat(aktuell ? [aktuell] : []).forEach(function (f) {
        ctx.strokeStyle = ROT; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (f.t === 'rahmen') { ctx.strokeRect(f.x, f.y, f.w, f.h); }
        else { ctx.beginPath(); f.p.forEach(function (pt, i) { if (i) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]); }); ctx.stroke(); }
      });
    }
    function punkt(e) {
      var r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
    }
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      var p = punkt(e);
      aktuell = werkzeug === 'rahmen' ? { t: 'rahmen', x0: p[0], y0: p[1], x: p[0], y: p[1], w: 0, h: 0 } : { t: 'stift', p: [p] };
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!aktuell) return;
      var p = punkt(e);
      if (aktuell.t === 'rahmen') { aktuell.x = Math.min(aktuell.x0, p[0]); aktuell.y = Math.min(aktuell.y0, p[1]); aktuell.w = Math.abs(p[0] - aktuell.x0); aktuell.h = Math.abs(p[1] - aktuell.y0); }
      else aktuell.p.push(p);
      neu();
    });
    function ende() {
      if (!aktuell) return;
      if ((aktuell.t === 'rahmen' && aktuell.w > 4 && aktuell.h > 4) || (aktuell.t === 'stift' && aktuell.p.length > 1)) formen.push(aktuell);
      aktuell = null; neu();
    }
    canvas.addEventListener('pointerup', ende); canvas.addEventListener('pointercancel', ende);
    neu();
    return {
      werkzeug: function (w) { werkzeug = w; },
      zurueck: function () { formen.pop(); neu(); },
      leeren: function () { formen = []; neu(); },
      anzahl: function () { return formen.length; }
    };
  }

  /* ─── Fenster ────────────────────────────────────────────── */
  function oeffnen(basis) {
    stil();
    var alt = document.querySelector('.bb-hg'); if (alt) alt.remove();
    var k = kontext(), bereich = bereichAus(k.reiter), art = 'fehler', weitere = [];
    var opts = function (liste, wert) { return liste.map(function (e) { return '<option value="' + e[0] + '"' + (e[0] === wert ? ' selected' : '') + '>' + e[1] + '</option>'; }).join(''); };
    var BEREICHE = [['quickcheck', 'Quick-Check'], ['objekt', 'Objekt & Kennzahlen'], ['steuer', 'Steuer'], ['finanzierung', 'Finanzierung & Bank'],
      ['marktbericht', 'Marktbericht & Bewertung'], ['unterlagen', 'Unterlagen & Import'], ['admin', 'Admin & Konten'], ['design', 'Optik & Bedienung'], ['sonstiges', 'Sonstiges']];
    var hg = document.createElement('div'); hg.className = 'bb-hg';
    hg.innerHTML = '<div class="bb" role="dialog" aria-modal="true" aria-labelledby="bb-titel">'
      + '<div class="bb-kopf"><div><h3 id="bb-titel">Bordbuch</h3><p>Was ist dir aufgefallen? Markiere die Stelle, beschreibe oder diktiere es — es landet im Backlog.</p></div>'
      + '<button class="bb-zu" type="button" aria-label="Schließen">×</button></div>'
      + '<div class="bb-rumpf"><div class="bb-bild">'
      + '<div class="bb-werkzeug"><button type="button" data-w="rahmen" class="an">▭ Rahmen</button><button type="button" data-w="stift">✎ Stift</button>'
      + '<button type="button" data-a="zurueck">↶ Rückgängig</button><button type="button" data-a="leeren">Markierungen weg</button>'
      + '<span class="bb-hinweis">Bild einfügen: Strg+V</span></div>'
      + '<div class="bb-leinwand">' + (basis ? '<canvas></canvas>' : '<div class="bb-leer">Der automatische Screenshot ging hier nicht.<br><button type="button" class="bb-knopf" data-a="aufnahme" style="margin:10px 0 6px">Bildschirm aufnehmen</button><br>Der Browser fragt einmal, welcher Tab — „Diesen Tab“ wählen. Oder ein Bild mit Strg+V einfügen.</div>') + '</div>'
      + '<div class="bb-weitere"></div>'
      + '<div><button type="button" class="bb-link" data-a="datei">+ weiteres Bild aus Datei</button><input type="file" accept="image/*" hidden></div>'
      + '</div><div class="bb-form">'
      + '<div><span class="bb-l">Was ist es?</span><div class="bb-art"><button type="button" data-art="fehler" class="an">Fehler</button><button type="button" data-art="wunsch">Wunsch</button><button type="button" data-art="idee">Idee</button></div></div>'
      + '<div><label class="bb-l" for="bb-titel-in">Kurz in einem Satz</label><input type="text" id="bb-titel-in" maxlength="200" placeholder="z. B. Cashflow-Kachel zeigt 0 € statt −165 €"></div>'
      + '<div><label class="bb-l" for="dp-bb-text">Was fällt auf, was fehlt, wo ist das Problem?</label><div class="bb-textzeile"><textarea id="dp-bb-text" maxlength="8000" placeholder="Was hast du gemacht, was ist passiert, was hättest du erwartet? Du kannst auch diktieren."></textarea></div></div>'
      + '<div class="bb-reihe"><div><label class="bb-l" for="bb-bereich">Bereich</label><select id="bb-bereich">' + opts(BEREICHE, bereich) + '</select></div>'
      + '<div><label class="bb-l" for="bb-dringlich">Dringlichkeit</label><select id="bb-dringlich">' + opts([['spaeter', 'Irgendwann'], ['normal', 'Normal'], ['dringend', 'Dringend']], 'normal') + '</select></div></div>'
      + '<div class="bb-kontext">Wird mitgeschickt: ' + esc([k.reiter && ('Reiter „' + k.reiter + '“'), k.objekt && ('Objekt ' + k.objekt), 'Fenster ' + k.fenster, k.version && ('Version ' + k.version)].filter(Boolean).join(' · ')) + '</div>'
      + '<div class="bb-fuss"><button type="button" class="bb-knopf" data-a="senden">Ins Bordbuch eintragen</button><span class="bb-meldung"></span></div>'
      + '<div><button type="button" class="bb-link" data-a="liste">Alle Einträge ansehen</button></div>'
      + '</div></div></div>';
    document.body.appendChild(hg);

    var flaeche = null, canvas = hg.querySelector('canvas');
    if (basis && canvas) { canvas.width = basis.width; canvas.height = basis.height; flaeche = zeichenflaeche(canvas, basis); }
    var zu = function () { hg.remove(); document.removeEventListener('keydown', taste); document.removeEventListener('paste', einfuegen); try { if (window.DealPilotDiktat && DealPilotDiktat.laeuft()) DealPilotDiktat.stoppen(); } catch (e) {} };
    var taste = function (e) { if (e.key === 'Escape') zu(); };
    document.addEventListener('keydown', taste);
    hg.addEventListener('mousedown', function (e) { if (e.target === hg) zu(); });
    hg.querySelector('.bb-zu').addEventListener('click', zu);

    var zeigeWeitere = function () {
      hg.querySelector('.bb-weitere').innerHTML = weitere.map(function (u, i) { return '<figure><img alt="Bild ' + (i + 2) + '" src="' + u + '"><button type="button" data-weg="' + i + '" aria-label="Bild entfernen">×</button></figure>'; }).join('');
    };
    hg.querySelector('.bb-weitere').addEventListener('click', function (e) { var b = e.target.closest('[data-weg]'); if (b) { weitere.splice(+b.getAttribute('data-weg'), 1); zeigeWeitere(); } });
    var nimmBild = function (datei) {
      if (!datei || !/^image\//.test(datei.type)) return;
      if (weitere.length >= 3) { meldung('Höchstens vier Bilder.', true); return; }
      dateiAlsBild(datei).then(function (u) { weitere.push(u); zeigeWeitere(); }).catch(function () { meldung('Bild nicht lesbar.', true); });
    };
    var einfuegen = function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { e.preventDefault(); nimmBild(items[i].getAsFile()); }
    };
    document.addEventListener('paste', einfuegen);
    var datei = hg.querySelector('input[type=file]');
    datei.addEventListener('change', function () { Array.prototype.forEach.call(datei.files || [], nimmBild); datei.value = ''; });

    var meldEl = hg.querySelector('.bb-meldung');
    function meldung(t, fehler) { meldEl.className = 'bb-meldung' + (fehler ? ' fehler' : ''); meldEl.textContent = t; }

    hg.querySelectorAll('[data-w]').forEach(function (b) { b.addEventListener('click', function () {
      hg.querySelectorAll('[data-w]').forEach(function (x) { x.classList.toggle('an', x === b); }); if (flaeche) flaeche.werkzeug(b.getAttribute('data-w'));
    }); });
    hg.querySelectorAll('[data-art]').forEach(function (b) { b.addEventListener('click', function () {
      art = b.getAttribute('data-art'); hg.querySelectorAll('[data-art]').forEach(function (x) { x.classList.toggle('an', x === b); });
    }); });
    hg.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return;
      var was = a.getAttribute('data-a');
      if (was === 'zurueck' && flaeche) flaeche.zurueck();
      if (was === 'leeren' && flaeche) flaeche.leeren();
      if (was === 'datei') datei.click();
      if (was === 'liste') { zu(); if (window.DpWuensche) DpWuensche.oeffnen(); }
      if (was === 'senden') senden(a);
      if (was === 'aufnahme') {
        hg.style.visibility = 'hidden';
        bildschirmAufnahme().then(function (c) {
          hg.style.visibility = '';
          if (!c) { meldung('Keine Aufnahme — Bild mit Strg+V einfügen geht immer.', true); return; }
          var lw = hg.querySelector('.bb-leinwand');
          lw.innerHTML = '<canvas></canvas>';
          canvas = lw.querySelector('canvas'); canvas.width = c.width; canvas.height = c.height;
          flaeche = zeichenflaeche(canvas, c);
        });
      }
    });
    try { if (window.DealPilotDiktat) DealPilotDiktat.knopfAn('dp-bb-text'); } catch (e) {}

    function senden(knopf) {
      var titel = hg.querySelector('#bb-titel-in').value.trim();
      var text = hg.querySelector('#dp-bb-text').value.trim();
      if (titel.length < 3) {
        if (text.length >= 3) titel = text.split(/[.\n!?]/)[0].slice(0, 120);
        else { meldung('Bitte kurz beschreiben, was dir aufgefallen ist.', true); hg.querySelector('#bb-titel-in').focus(); return; }
      }
      var bilder = [];
      if (canvas) bilder.push(alsJpeg(canvas, 1800));
      bilder = bilder.concat(weitere);
      knopf.disabled = true; meldung('wird eingetragen …');
      Auth.apiCall('/wuensche', { method: 'POST', timeout: 60000, body: {
        titel: titel, beschreibung: text, art: art,
        bereich: hg.querySelector('#bb-bereich').value, dringlichkeit: hg.querySelector('#bb-dringlich').value,
        bilder: bilder, kontext: kontext()
      } }).then(function (r) {
        meldung('Eingetragen als W-' + r.id + '. Danke!');
        meld('✓ Bordbuch: W-' + r.id + ' eingetragen');
        setTimeout(zu, 1200);
      }).catch(function (e) { knopf.disabled = false; meldung('Nicht eingetragen: ' + e.message, true); });
    }
    setTimeout(function () { var t = hg.querySelector('#bb-titel-in'); if (t) t.focus(); }, 40);
  }

  function start() {
    if (laeuft || !zugang) return;
    laeuft = true; holeVersion();
    var fab = document.getElementById('dp-bb-fab'); if (fab) fab.classList.add('knipst');
    aufnehmen().then(function (c) {
      if (fab) fab.classList.remove('knipst');
      laeuft = false; oeffnen(c);
    });
  }

  function fabBauen() {
    if (document.getElementById('dp-bb-fab')) return;
    stil();
    var b = document.createElement('button');
    b.id = 'dp-bb-fab'; b.type = 'button';
    b.setAttribute('aria-label', 'Bordbuch: Fehler oder Wunsch mit Screenshot eintragen (Alt+B)');
    b.innerHTML = figur() + '<span class="bb-schild">Bordbuch · Alt+B</span>';
    b.addEventListener('click', start);
    document.body.appendChild(b);
  }

  function pruefeZugang() {
    try {
      if (!(window.Auth && Auth.isApiMode && Auth.isApiMode() && Auth.isLoggedIn())) return;
      Auth.apiCall('/wuensche/zugang').then(function (r) {
        zugang = !!(r && r.ok);
        fabBauen();
        var f = document.getElementById('dp-bb-fab'); if (f) f.classList.toggle('an', zugang);
        if (zugang) holeVersion();
      }).catch(function () {});
    } catch (e) { /* still */ }
  }

  document.addEventListener('keydown', function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'b' || e.key === 'B') && zugang) { e.preventDefault(); start(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(pruefeZugang, 1600); });
  else setTimeout(pruefeZugang, 1600);
  window.addEventListener('dp:plan-ready', pruefeZugang);

  window.DpBordbuch = { start: start, oeffnen: oeffnen, pruefeZugang: pruefeZugang };
})();
