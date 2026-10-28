/* ═══════════════════════════════════════════════════════════════════════
   werbung.js · messe-schleife-7 — WERBEBILDER AM STAND (28.10.2026)
   Marcel 28.10.2026: „kannst du die Werbung, die wir gerade gebaut haben,
   auch in die Messe-Schleife packen? … zwischenzeitlich angezeigt …
   einschaltbar? Und auch hintereinander weg in Dauerschleife?"

   Bilder: messe-schleife/werbung/*.webp, 1920 x 1080, eigens fuer den
   Messebildschirm gerendert aus
   Dateien/Social-Media/Ertragswert-ImmoWertV-2026-10-28/quelle/
   (wb.html Format „tv" = Layout „li" auf 1200 x 675 bei Pixeldichte 1,6).
   Neu rendern nach jeder Ernte (Idee 05 traegt Registerzahlen).

   1 · ZWISCHENDURCH: Tafel window.DPSTafeln.werbung — Rundgang (nach jeder
       n-ten Station) und Videothek (nach jedem n-ten Video) streuen sie ein.
       Menue (Taste E): werbung an/aus, werbung_nach, werbung_sek.
       Favoriten 01 Boarding-Pass und 03 Akte mit Siegel kommen doppelt so
       oft (Zug unten). Der Zug laeuft ueber Neustarts weiter (localStorage).
   2 · DAUERSCHLEIFE: Kanal „Werbung" (?idee=werbung, Taste W) — alle Bilder
       hintereinander, Ueberblendung, Dauer = werbung_sek.

   Fehlt ein Bild, faellt es still aus dem Zug (Eintrag in DPS_FEHLER).
   Laeuft auch von der Platte (file://), ohne Netz, alle Pfade relativ.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VER = 'messe-schleife-7';
  var Q = new URLSearchParams(location.search);
  var EIN = window.DPS_EINST || null;
  function fehler(t) { (window.DPS_FEHLER = window.DPS_FEHLER || []).push(t); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Reihenfolge der Dauerschleife: Favoriten (01, 03) je zweimal, mit und ohne Motiv. */
  var BILDER = [
    { id: '01m', datei: '01-boarding-pass-motiv.webp', titel: 'Boarding-Pass · Ertragswert', fav: true },
    { id: '02m', datei: '02-cockpit-motiv.webp', titel: 'Cockpit · Instrumentenflug' },
    { id: '03m', datei: '03-akte-siegel-motiv.webp', titel: 'Akte mit Siegel · Rechenweg', fav: true },
    { id: '04m', datei: '04-bauchgefuehl-motiv.webp', titel: 'Bauchgefühl oder ImmoWertV' },
    { id: '01', datei: '01-boarding-pass.webp', titel: 'Boarding-Pass · Ertragswert', fav: true },
    { id: '05m', datei: '05-register-karte-motiv.webp', titel: 'Register · amtliche Daten' },
    { id: '03', datei: '03-akte-siegel.webp', titel: 'Akte mit Siegel · Rechenweg', fav: true },
    { id: '06m', datei: '06-statement-motiv.webp', titel: 'Kein Faktor. Kein Bauchgefühl.' }
  ];
  /* Zug fuer die eingestreute Tafel: 8 von 12 Plaetzen sind Favoriten. */
  var ZUG = ['01m', '03m', '02m', '01', '03', '04m', '01m', '03m', '05m', '01', '03', '06m'];

  var OK = {};   /* id -> true (geladen) / false (fehlt); unbekannt = noch nicht geladen */
  function pfad(b) { return 'messe-schleife/werbung/' + b.datei + '?v=' + VER; }
  BILDER.forEach(function (b) {
    var im = new Image();
    im.onload = function () { OK[b.id] = true; };
    im.onerror = function () { OK[b.id] = false; fehler('Werbung: Bild fehlt ' + b.datei); };
    im.src = pfad(b);
  });
  function bild(id) { return BILDER.filter(function (b) { return b.id === id; })[0]; }
  function bereit() { return BILDER.filter(function (b) { return OK[b.id] === true; }); }

  function an() { return !(EIN && EIN.get('werbung') === false); }
  function sekunden() { return Math.max(4, Number(EIN && EIN.get('werbung_sek')) || 10); }
  function nach() { return Math.max(1, Number(EIN && EIN.get('werbung_nach')) || 3); }

  /* naechstes Bild aus dem Zug (Stand ueber Neustarts) */
  var zugPos = 0;
  try { zugPos = parseInt(localStorage.getItem('dps_werbung_zug'), 10) || 0; } catch (e) { /* ohne Speicher */ }
  function naechstes() {
    for (var k = 0; k < ZUG.length; k++) {
      var id = ZUG[(zugPos + k) % ZUG.length];
      if (OK[id] === true) {
        zugPos = (zugPos + k + 1) % ZUG.length;
        try { localStorage.setItem('dps_werbung_zug', String(zugPos)); } catch (e) { /* ohne Speicher */ }
        return bild(id);
      }
    }
    return null;
  }

  function tafelHtml() {
    var b = naechstes(); if (!b) return null;
    window.DPS_WERBUNG = { bild: b.id, datei: b.datei, zeit: Date.now() };
    return '<div class="rg-t wb-t" data-wb="' + b.id + '"><img alt="' + b.titel + '" src="' + pfad(b) + '"></div>';
  }

  window.DPSTafeln = window.DPSTafeln || {};
  window.DPSTafeln.werbung = {
    da: function () { return an() && bereit().length > 0; },
    html: tafelHtml, sekunden: sekunden, nach: nach, bilder: BILDER, zug: ZUG
  };

  /* ── Kanal „Werbung" (Dauerschleife) ─────────────────────────────────── */
  function start(buehne) {
    var RATE = Math.max(0.2, Math.min(20, parseFloat(Q.get('tafelrate')) || 1));
    var W = el('div', 'wb-kanal ebene');
    var lagen = [el('div', 'wb-lage'), el('div', 'wb-lage')];
    lagen.forEach(function (l) { l.appendChild(el('img')); W.appendChild(l); });
    var leiste = el('div', 'wb-leiste'); var balken = el('i'); leiste.appendChild(balken); W.appendChild(leiste);
    var punkte = el('div', 'wb-punkte'); W.appendChild(punkte);
    buehne.appendChild(W);
    var sprung = false;
    addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') sprung = true; });
    window.DPS_LOG = window.DPS_LOG || [];

    (async function lauf() {
      /* bis zu 3 s auf die Bilder warten (file:// laedt sofort, Netz etwas spaeter) */
      for (var t = 0; t < 30 && bereit().length < BILDER.length && BILDER.some(function (b) { return OK[b.id] === undefined; }); t++) await warte(100);
      var runde = 0, oben = 0, i = 0;
      for (;;) {
        var liste = bereit();
        if (!liste.length) { fehler('Werbung: keine Bilder'); await warte(3000); continue; }
        if (i === 0) {
          runde++;
          punkte.innerHTML = liste.map(function () { return '<i></i>'; }).join('');
        }
        var b = liste[i % liste.length];
        var neu = lagen[1 - oben], alt = lagen[oben];
        var img = neu.firstChild;
        img.alt = b.titel; img.src = pfad(b);
        try { if (img.decode) await img.decode(); } catch (e) { /* trotzdem zeigen */ }
        neu.classList.remove('an'); void neu.offsetWidth;
        neu.classList.add('an'); neu.style.zIndex = 2; alt.style.zIndex = 1;
        setTimeout(function (a) { return function () { a.classList.remove('an'); }; }(alt), 1300);
        oben = 1 - oben;
        Array.prototype.forEach.call(punkte.children, function (p, j) { p.classList.toggle('jetzt', j === i); });
        var ms = sekunden() * 1000 / RATE;
        balken.style.transition = 'none'; balken.style.width = '0'; void balken.offsetWidth;
        balken.style.transition = 'width ' + ms + 'ms linear'; balken.style.width = '100%';
        window.DPS = { idee: 'werbung', version: VER, runde: runde, bild: b.id, nr: i + 1, von: liste.length, zeit: Date.now() };
        window.DPS_LOG.push({ t: Math.round(performance.now()), was: 'werbung', x: b.id });
        var ende = performance.now() + ms;
        while (performance.now() < ende && !sprung) await warte(100);
        sprung = false;
        i = (i + 1) % liste.length;
      }
    })();
  }
  window.DealPilotWerbung = { start: start, bilder: BILDER, version: VER };
})();
