/* ═══════════════════════════════════════════════════════════════════════
   umgebung.js · v1644 — die Landing zeigt auf DIE App, in der sie steht

   Marcel am 26.09.2026: „auf Staging, auf der Landingpage, wenn ich dort
   auf Login oder Registrieren klicke, komme ich immer auf die
   Produktivumgebung."

   ── GEMESSEN ─────────────────────────────────────────────────────────
   `landing/index.html` trägt **13 feste Verweise** auf
   `https://app.dealpilot.immo/…` — Anmelden, Kostenlos starten, vier
   Tarifknöpfe, drei Nachlege-Knöpfe, Guthaben, und drei weitere CTAs.
   Dazu je zwei bis drei in `api.html`, `fragen.html`,
   `leistungsumfang.html` und `sicherheit.html`.

   Auf `staging.dealpilot.immo` führt jeder davon aus der Testumgebung
   heraus in die Produktion. Wer dort „Registrieren" drückt, legt ein
   ECHTES Konto an.

   > Das ist kein Schönheitsfehler. Eine Testumgebung, deren Knöpfe in
   > die Produktion führen, ist keine Testumgebung.

   ── WARUM EINE STELLE STATT DREIZEHN ─────────────────────────────────
   Dreizehn Verweise von Hand umzuschreiben hiesse: beim vierzehnten
   fällt es niemandem auf. Diese Datei liest den HOST und schreibt um,
   was sie findet — auch jeden Link, den es heute noch nicht gibt.

   ── DIE ZUORDNUNG ────────────────────────────────────────────────────
     staging.dealpilot.immo        →  app.staging.dealpilot.immo
     dealpilot.immo / www.…        →  app.dealpilot.immo   (unverändert)
     localhost / 127.0.0.1         →  bleibt, wie es dasteht

   Die Produktion wird ausdrücklich NICHT angefasst: dort stimmt das
   Ziel schon, und eine Umschreibung, die dort nichts tut, kann dort
   auch nichts kaputtmachen.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PROD = 'app.dealpilot.immo';

  function zielHost() {
    var h = String(location.hostname || '').toLowerCase();
    /* `staging.dealpilot.immo` UND alles darunter. Ein `indexOf` würde
       auch `nichtstaging.…` treffen — deshalb der Anker. */
    if (h === 'staging.dealpilot.immo' || /(^|\.)staging\.dealpilot\.immo$/.test(h)) {
      return 'app.staging.dealpilot.immo';
    }
    return null;   /* null heisst: nichts umschreiben */
  }

  function umschreiben() {
    var ziel = zielHost();
    if (!ziel) return 0;
    var n = 0;
    [].forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var h = a.getAttribute('href') || '';
      if (h.indexOf('//' + PROD) < 0) return;
      a.setAttribute('href', h.replace('//' + PROD, '//' + ziel));
      n++;
    });
    return n;
  }

  var n = umschreiben();
  if (n) {
    /* Laut sagen, was passiert ist. Eine stille Umschreibung ist beim
       nächsten Fehlersuchen nicht auffindbar. */
    try {
      console.info('[umgebung] ' + n + ' Verweise auf ' + zielHost() + ' umgeschrieben (Staging).');
    } catch (e) {}
  }

  /* Links, die erst später entstehen (Preisrechner, eingeblendete
     Blöcke), werden mitgenommen. */
  if (window.MutationObserver) {
    new MutationObserver(function () { umschreiben(); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  window.DealPilotUmgebung = { ziel: zielHost, umschreiben: umschreiben };
})();
