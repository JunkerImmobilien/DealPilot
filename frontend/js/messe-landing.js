/* M8 26.11.2026 · Drehbuch für die LANDING im Messe-Studio (Video „Der Deal-Check“).
   Das Studio lädt mit REIHE.<x>.seite eine andere Seite als die App (hier landing/index.html) und hängt
   diese Datei nach dem Laden in das iframe. Gleiches Protokoll wie messe-drehbuch.js: 'bereit' an das Studio,
   auf 'los' warten, je Szene 'kapitel', am Ende 'ende'.
   Nichts wird gekauft: der Lauf endet vor „Bericht kaufen“. Die zwei Unterlagen sind die erfundenen
   Muster unter /messe-dateien/lindenallee-14/ (Exposé und Mietaufstellung). Ausgelesen wird echt (Staging). */
(function () {
  'use strict';
  if (window.__dpmLanding) return; window.__dpmLanding = true;
  function an(m) { try { m.source = 'dp-messe-studio'; window.parent.postMessage(m, location.origin); } catch (e) {} }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q(s, w) { return (w || document).querySelector(s); }
  function qa(s, w) { return [].slice.call((w || document).querySelectorAll(s)); }
  function txt(e) { return String((e && e.textContent) || '').replace(/\s+/g, ' ').trim(); }
  async function warteAuf(f, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { try { var x = f(); if (x) return x; } catch (e) {} await warte(250); } return null; }
  function lies(t, x) { return Math.round(4000 + 1000 * (String(t).length + String(x).replace(/<[^>]+>/g, '').length) / 15); }

  /* Rahmen um das Ziel (Gold, wie der Kegel der App), scrollt es in die Mitte */
  var rahmen = null, ziel = null, takt = null;
  function css() {
    if (q('#dpm-l-css')) return;
    var s = document.createElement('style'); s.id = 'dpm-l-css';
    s.textContent = '#dpm-l-rahmen{position:fixed;z-index:2147483000;pointer-events:none;border:3px solid var(--wl-c9a84c, #C9A84C);border-radius:14px;'
      + 'box-shadow:0 0 0 9999px rgba(5,5,5,.28),0 0 26px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 60%, transparent);transition:all .45s cubic-bezier(.2,.8,.2,1);opacity:0}'
      + '#dpm-l-rahmen.an{opacity:1}'
      + 'html.dpm-l #bwPopup,html.dpm-l .bw-popup,html.dpm-l #dp-cookie,html.dpm-l .cookie-banner,html.dpm-l [id*="cookie"],html.dpm-l .ec-demo{display:none!important}';
    document.head.appendChild(s);
    document.documentElement.classList.add('dpm-l');
  }
  function zeige(e, pad) {
    ziel = e || null; pad = pad || 10;
    if (!rahmen) { rahmen = document.createElement('div'); rahmen.id = 'dpm-l-rahmen'; document.body.appendChild(rahmen); }
    if (!ziel) { rahmen.classList.remove('an'); return; }
    try { ziel.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {}
    if (!takt) takt = setInterval(function () {
      if (!ziel || !ziel.isConnected) { rahmen.classList.remove('an'); return; }
      var r = ziel.getBoundingClientRect();
      rahmen.style.left = (r.left - pad) + 'px'; rahmen.style.top = (r.top - pad) + 'px';
      rahmen.style.width = (r.width + 2 * pad) + 'px'; rahmen.style.height = (r.height + 2 * pad) + 'px';
      rahmen.classList.add('an');
    }, 120);
  }
  var N = 0, I = -1, KICK = 'Der Deal-Check';
  async function zeile(titel, text, extra) { I++; an({ type: 'kapitel', kick: KICK, titel: titel, text: text, i: I, n: N }); await warte(lies(titel, text) + (extra || 0)); }
  function fenster() { return q('.ec-fenster:not([hidden]) .ec-box'); }
  function inhalt() { var f = fenster(); return f && (q('.ec-inhalt', f) || f); }

  var SZENEN = [
    async function () {   /* 1 · Deal-Check auf der Startseite */
      var k = await warteAuf(function () { return q('#dkKarte'); }, 6000);
      zeige(k ? (k.closest('.dk-szene') || k) : q('#dealcheck'), 14);
      await warte(1200);
      await zeile('Der Deal-Check', 'Kaufpreis und Miete rein, ein Score raus. Ohne Anmeldung, mit derselben Rechnung wie im Quick-Check.');
    },
    async function () {   /* 2 · Unterlagen statt Tippen */
      var b = await warteAuf(function () { return qa('.ec-start').filter(function (x) { return x.offsetWidth; })[0]; }, 8000);
      if (b) { zeige(b, 8); await warte(1600); b.click(); }
      else if (window.DpEinzelCheck) DpEinzelCheck.auf();
      var inp = await warteAuf(function () { var f = fenster(); return f && q('input[type=file]', f); }, 8000);
      if (inp) {
        var namen = ['01-expose-lindenallee-14.pdf', '02-mietaufstellung-lindenallee-14.pdf'], dt = new DataTransfer();
        for (var i = 0; i < namen.length; i++) {
          try { var r = await fetch('/messe-dateien/lindenallee-14/' + namen[i]); var bl = await r.blob(); dt.items.add(new File([bl], namen[i], { type: 'application/pdf' })); } catch (e) {}
        }
        inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await warteAuf(function () { return q('.ec-ablage .ec-dok', fenster()); }, 6000);
      zeige(q('.ec-ablage', fenster()) || fenster(), 10);
      await zeile('Unterlagen statt Tippen', 'Exposé und Mietaufstellung hochladen. Zwei Unterlagen liest DealPilot kostenlos aus.');
    },
    async function () {   /* 3 · Erst auslesen */
      var los = await warteAuf(function () { var x = q('.ec-los', fenster()); return x && !x.disabled && x; }, 5000);
      if (los) { zeige(los, 8); await warte(1200); los.click(); }
      await warte(600);
      zeige(q('.ec-lesen', fenster()) || inhalt(), 10);
      var t0 = Date.now();
      I++; an({ type: 'kapitel', kick: KICK, titel: 'Erst auslesen', text: 'Die Unterlagen werden geschwärzt und ausgelesen. Erst danach fragt DealPilot, was noch fehlt.', i: I, n: N });
      await warteAuf(function () { return q('.ec-grund', fenster()); }, 120000);
      var rest = lies('Erst auslesen', 'Die Unterlagen werden geschwärzt und ausgelesen. Erst danach fragt DealPilot, was noch fehlt.') - (Date.now() - t0);
      if (rest > 0) await warte(rest);
    },
    async function () {   /* 4 · Grundangaben mit Herkunft */
      var g = q('.ec-grund', fenster());
      /* M9 26.11.: VOR der Zeile füllen, sonst stehen Eigenkapital und Zins leer und rot im Bild. Pflichtfelder, die noch leer sind, mit Musterwerten füllen (nichts Echtes) */
      var setz = function (sel, v) { var e = q(sel, fenster()); if (e && String(e.value).trim() === '') { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
      setz('#ecgEk', '300000'); setz('#ecgZins', '3,9');
      qa('.ec-wahl', fenster()).forEach(function (w) { if (!q('button.an', w)) { var b0 = q('button', w); if (b0) b0.click(); } });
      await warte(400);
      zeige(g || inhalt(), 8);
      await warte(800);
      await zeile('Die Grundangaben', 'Was in den Unterlagen steht, ist schon eingetragen, mit Herkunft. Du ergänzt nur, was fehlt.');
      var sub = g && (q('button[type=submit]', g) || qa('button', g).filter(function (x) { return /weiter|rechnen|prüfen|Ergebnis/i.test(txt(x)); })[0]);
      if (sub) { zeige(sub, 8); await warte(1200); sub.click(); }
    },
    async function () {   /* 5 · Ergebnis */
      var u = await warteAuf(function () { return q('.ec-urteil', fenster()); }, 20000);
      zeige(u || inhalt(), 10);
      await warte(600);
      await zeile('Das Ergebnis', 'Ein Score wie im Quick-Check, darunter Objekt gegen Finanzierung. So siehst du, ob das Haus trägt oder nur die Finanzierung.');
    },
    async function () {   /* 6 · Mietpotenzial und was die Unterlagen sagen */
      var m = qa('.ec-l', fenster()).filter(function (x) { return x.offsetWidth && /^Unterlagen|gelesen/i.test(txt(x)); })[0];
      if (m) zeige(m.parentElement || m, 10);
      await zeile('Gelesen, nicht getippt', 'Was aus den Unterlagen kommt, steht dabei. Weicht etwas von deiner Angabe ab, übernimmst du es mit einem Klick.');
    },
    async function () {   /* 7 · Bericht, vor dem Kauf */
      var k = await warteAuf(function () { return q('.ec-weg-1', fenster()); }, 6000);
      if (k) zeige(k, 10);
      await zeile('Der Bericht', 'Für den ganzen Bericht mit Marktwert, Mietspiegel und Rechenweg als PDF. Vorher siehst du, wie tief er für dieses Haus rechnen kann.');
    }
  ];
  N = SZENEN.length;

  async function lauf() {
    css();
    for (var i = 0; i < SZENEN.length; i++) { try { await SZENEN[i](); } catch (e) { try { console.warn('[messe-landing]', e); } catch (x) {} } }
    an({ type: 'ende' });
    await warte(1400);
    zeige(null);
  }
  addEventListener('message', function h(e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== 'dp-messe-studio' || e.data.type !== 'los') return;
    removeEventListener('message', h); lauf();
  });
  css();
  setTimeout(function () { an({ type: 'bereit', titel: 'Der Deal-Check', n: N }); }, 1500);
  window.DPM_LANDING = { lauf: lauf };
})();
