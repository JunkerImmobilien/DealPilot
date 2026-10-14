'use strict';
/* ═══════════════════════════════════════════════════════════════════
   messe-drehbuch.js — v2219 · Selbstlaufende Drehbücher für Messe-Videos

   Marcel, 14.10.2026: „ich brauche Messe-Videos … mach mal so ein Drehbuch
   fertig." Vorschlag (angenommen): kein abgefilmtes Klicken, sondern ein
   Drehbuch IN der App. Es bedient die echte Oberfläche, legt einen Lichtkegel
   auf die Stelle und schreibt eine Untertitelzeile darunter. Aufnehmen mit
   OBS oder Win+Alt+R; am Stand kann es auch live in Schleife laufen.

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
  function warte(ms) { return new Promise(function (r, x) { var l = lauf; setTimeout(function () { l === lauf ? r() : x('stopp'); }, ms); }); }
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
      '#dpm-stopp{position:fixed;z-index:10076;right:14px;bottom:14px;border:1px solid ' + mix(G, 50) + ';background:rgba(10,9,7,.8);color:' + GH + ';border-radius:8px;padding:4px 10px;font:600 12px "JetBrains Mono",monospace;cursor:pointer;opacity:.35}',
      '#dpm-stopp:hover{opacity:1}',
      '@media (max-width:640px){#dpm-zeile .t{font-size:18px}#dpm-karte h1{font-size:40px}#dpm-karte p{font-size:16px}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function el(id, tag) { var e = document.getElementById(id); if (!e) { e = document.createElement(tag || 'div'); e.id = id; document.body.appendChild(e); } return e; }
  function kegel(ziel, pad) {
    var k = el('dpm-kegel');
    if (!ziel) { k.classList.remove('an'); return; }
    var r = ziel.getBoundingClientRect(); pad = pad == null ? 10 : pad;
    k.style.left = (r.left - pad) + 'px'; k.style.top = (r.top - pad) + 'px';
    k.style.width = (r.width + pad * 2) + 'px'; k.style.height = (r.height + pad * 2) + 'px';
    k.classList.add('an');
  }
  function zeile(kick, text, i, n) {
    var z = el('dpm-zeile');
    z.innerHTML = '<div class="k">' + kick + '</div><div class="t">' + text + '</div><div class="p">'
      + Array.apply(null, { length: n }).map(function (_, j) { return '<i class="' + (j <= i ? 'an' : '') + '"></i>'; }).join('') + '</div>';
    z.classList.add('an');
  }
  function zeileWeg() { var z = q('#dpm-zeile'); if (z) z.classList.remove('an'); }
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
    for (var s = e.parentElement; s && s !== document.body; s = s.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight + 5) return s;
    }
    return document.scrollingElement;
  }
  function holen(e, sanft) {
    var r = e.getBoundingClientRect(), s = scroller(e), mitte = (70 + innerHeight - 170) / 2;
    var d = r.height > innerHeight - 260 ? r.top - 80 : (r.top + r.height / 2) - mitte;
    try { s.scrollTo({ top: s.scrollTop + d, behavior: sanft ? 'smooth' : 'auto' }); } catch (x) { s.scrollTop += d; }
  }
  function folgen() {
    if (_folge) return;
    _folge = setInterval(function () {
      var z = zielEl(); if (!z) { kegel(null); return; }
      var r = z.getBoundingClientRect();
      if (!frei(r) && _nachScroll < 3 && Date.now() - _letzterScroll > 1200) {
        _nachScroll++; _letzterScroll = Date.now();
        holen(z, false);
      }
      kegel(z, _pad);
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
    if (z && !frei(z.getBoundingClientRect())) { _letzterScroll = Date.now(); holen(z, true); }
    folgen();
    await warte(750);
  }
  /* v2219f · jeder Reiter beginnt oben: die Scrollposition des vorigen blieb
     stehen, der kürzere Steuer-Reiter zeigte gemessen eine leere Fläche */
  function reiter(sec) { var t = q('.tab[data-target-sec="' + sec + '"]'); if (t) t.click(); var m = q('.main-col'); if (m) m.scrollTop = 0; }
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
    }
  };

  /* ── Ablauf ───────────────────────────────────────────────────── */
  var lauf = 0;
  function stopp() {
    lauf = 0; _ziel = null; if (_folge) { clearInterval(_folge); _folge = null; } kegel(null); zeileWeg(); karte(null);
    var s = q('#dpm-stopp'); if (s) s.remove();
    document.removeEventListener('keydown', esc, true);
  }
  function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); stopp(); } }
  async function start(name, opts) {
    var D = DREHBUECHER[name]; if (!D) { console.warn('[messe] unbekanntes Drehbuch: ' + name); return; }
    css(); stopp();
    var g = lauf = Date.now();
    var b = el('dpm-stopp', 'button'); b.type = 'button'; b.textContent = '■'; b.title = 'Drehbuch beenden (Esc)'; b.onclick = stopp;
    document.addEventListener('keydown', esc, true);
    var n = D.szenen.length;
    try {
      do {
        karte('<div class="k">DealPilot · Geschichte</div><h1>' + D.titel + '</h1><p>' + D.unterzeile + '</p>');
        var id = await objektFinden(D.objekt);
        if (!id) { karte('<h1>Objekt fehlt</h1><p>Für dieses Drehbuch fehlt das Demo-Objekt in diesem Konto.</p>'); await warte(4000); break; }
        if (window._currentObjKey !== id && typeof window.loadSaved === 'function') await window.loadSaved(id);
        await warte(3200);
        karte(null); await warte(700);
        for (var i = 0; i < n; i++) {
          var ii = i;
          await D.szenen[i]({ zeile: function (k, t) { zeile(k, t, ii, n); } });
        }
        _ziel = null; kegel(null); zeileWeg(); reiter('s0');
        karte(D.schluss); await warte(5500);
        karte(null); await warte(600);
      } while (opts && opts.schleife && g === lauf);
    } catch (e) { if (e !== 'stopp') console.warn('[messe]', e); }
    if (g === lauf) stopp();
  }
  window.DealPilotMesse = { start: start, stopp: stopp, drehbuecher: function () { return Object.keys(DREHBUECHER); } };

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
