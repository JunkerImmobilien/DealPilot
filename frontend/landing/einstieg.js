/* ═══════════════════════════════════════════════════════════════════════
   einstieg.js · landing-einstieg-1 — Anmelden und Konto erstellen direkt
   unter dem Hero, ohne Zwischenseite.

   Marcel 27.10.2026: „unter dem Hero-Bereich gleich das Anmelden machen und
   Konto erstellen … wenn wir dann irgendwie auf kostenlos starten klicken,
   dann wird direkt unten das aufgemacht … nur ohne diese Extraseite."

   Jeder Link in die App, der zur Anmeldung (/) oder Registrierung
   (?register=1, mit Tarif/Paket) führt, öffnet stattdessen den Abschnitt
   #einstieg. Die Karte selbst ist die der App (iframe, js/einbettung.js) -
   eine Anmelde- und Registrierungslogik, nicht zwei. Das iframe wird erst
   beim ersten Öffnen geladen, die Startseite bleibt schnell.
   Nach der Anmeldung meldet die App „angemeldet", und die Seite wechselt in
   die App (mit Tarif-/Paketangabe des geklickten Links).
   Ohne JavaScript oder bei Fehlern bleibt der Link, was er war.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var APP_RE = /^https:\/\/app\.(staging\.)?dealpilot\.immo$/;
  var sec = document.getElementById('einstieg');
  if (!sec) return;
  var frame = sec.querySelector('#ein-frame'), laedt = sec.querySelector('.ein-laedt');
  var tabs = [].slice.call(sec.querySelectorAll('[data-ansicht]'));
  var zustand = { origin: null, ansicht: 'anmelden', weiter: '' }, notausT = null;

  function istEinstiegsLink(a) {
    if (a.hasAttribute('data-direkt')) return null;   /* „Lieber direkt in die App" */
    var u; try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (!APP_RE.test(u.origin)) return null;
    /* landing-einstieg-2 · auf der Staging-Landingpage immer die Staging-App - die Auswertung von
       #anmelden lief vor dem Umschreiben der Links und lud sonst die Produktiv-App */
    var org = u.origin;
    if (/^staging\./.test(location.hostname) && org === 'https://app.dealpilot.immo') org = 'https://app.staging.dealpilot.immo';
    if (u.pathname !== '/' && u.pathname !== '/index.html') return null;
    var reg = u.searchParams.get('register') === '1';
    var weiter = new URLSearchParams(u.search); weiter.delete('register');
    return { origin: org, ansicht: reg ? 'registrieren' : 'anmelden', weiter: weiter.toString() };
  }
  function tabsSetzen(ansicht) {
    tabs.forEach(function (t) { var an = t.getAttribute('data-ansicht') === ansicht; t.classList.toggle('an', an); t.setAttribute('aria-selected', an ? 'true' : 'false'); });
  }
  function oeffnen(ziel) {
    zustand = ziel;
    sec.hidden = false;
    sec.classList.add('offen');
    tabsSetzen(ziel.ansicht);
    /* landing-einstieg-2 · eigener Parameter: ein Browser, der die App-Seite noch aus der Zeit VOR der
       Einbettung (X-Frame-Options DENY) im Zwischenspeicher hat, behielt bei der Neuvalidierung (304) den alten
       Kopf und blockierte den Rahmen - Marcels Screenshot 27.10.2026 22:22. Neue Adresse = frische Antwort. */
    var src = ziel.origin + '/?einbettung=1&e=2' + (ziel.ansicht === 'registrieren' ? '&register=1' : '') + (ziel.weiter ? '&' + ziel.weiter : '');
    if (frame.getAttribute('data-src') !== src) {
      /* landing-einstieg-2 · Marcel 27.10.2026: „bei Kostenlos starten sehe ich kein Anmeldefenster, das ist grau".
         Kommt von der Karte binnen 8 s keine Hoehe, geht es ohne Einbettung direkt in die App - nie eine graue Flaeche. */
      clearTimeout(notausT);
      var _ziel = ziel, _gemeldet = false;
      frame._hoeheDa = false;
      notausT = setTimeout(function () {
        if (frame._hoeheDa || _gemeldet) return; _gemeldet = true;
        location.href = _ziel.origin + '/' + (_ziel.ansicht === 'registrieren' ? '?register=1' + (_ziel.weiter ? '&' + _ziel.weiter : '') : (_ziel.weiter ? '?' + _ziel.weiter : ''));
      }, 8000);
      if (frame.getAttribute('data-geladen') === '1' && frame.getAttribute('data-origin') === ziel.origin) {
        frame.contentWindow.postMessage({ dpEinbettung: true, typ: 'ansicht', wert: ziel.ansicht }, ziel.origin);
      } else {
        if (laedt) laedt.hidden = false;
        frame.setAttribute('data-origin', ziel.origin);
        frame.src = src;
      }
      frame.setAttribute('data-src', src);
    }
    setTimeout(function () { try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { sec.scrollIntoView(); } }, 30);
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank') return;
    var ziel = istEinstiegsLink(a);
    if (!ziel) return;
    e.preventDefault();
    oeffnen(ziel);
  }, true);

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var o = zustand.origin || (function () { var a = document.querySelector('a.b-log'); var z = a && istEinstiegsLink(a); return z ? z.origin : 'https://app.dealpilot.immo'; })();
      oeffnen({ origin: o, ansicht: t.getAttribute('data-ansicht'), weiter: zustand.weiter });
    });
  });
  var zu = sec.querySelector('.ein-zu');
  if (zu) zu.addEventListener('click', function () { sec.classList.remove('offen'); sec.hidden = true; });

  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.dpEinbettung || !APP_RE.test(e.origin) || e.origin !== frame.getAttribute('data-origin')) return;
    if (e.data.typ === 'bereit') { frame.setAttribute('data-geladen', '1'); }
    if (e.data.typ === 'hoehe' && e.data.h > 120) { frame._hoeheDa = true; frame.style.height = Math.min(1400, e.data.h) + 'px'; if (laedt) laedt.hidden = true; }
    if (e.data.typ === 'angemeldet') { location.href = e.origin + '/' + (zustand.weiter ? '?' + zustand.weiter : ''); }
  });

  /* #einstieg im Link (z. B. aus einer Mail): gleich öffnen */
  if (location.hash === '#einstieg' || location.hash === '#anmelden' || location.hash === '#registrieren') {
    var a0 = document.querySelector('a.b-' + (location.hash === '#registrieren' ? 'cta' : 'log'));
    var z0 = a0 && istEinstiegsLink(a0);
    if (z0) oeffnen(z0);
  }
})();
