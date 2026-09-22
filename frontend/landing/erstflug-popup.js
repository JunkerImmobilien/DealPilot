/* ═══════════════════════════════════════════════════════════════════════
   erstflug-popup.js · v1522
   ───────────────────────────────────────────────────────────────────────
   Marcel am 22.09.2026:
     "Nur derjenige, der eingibt dealpilot.immo/erstflug — also über den Link
      kommt oder auch über dealpilot.junker-immobilien.io/erstflug —, dass
      dann so ein Pop-up kommt und man das auswählen kann. Aber direkt
      ausgewiesen, wenn man auf die Seite klickt, soll er nicht sein."

   Damit bleibt die Grundentscheidung vom 07.09.2026 bestehen: auf der
   offenen Seite wird kein Dauerrabatt beworben (promo-erstflug.js:
   ANZEIGE_AKTIV = false). Neu ist allein der Empfang für die, die den Link
   vom Flyer eingeben.

   Wer den Weg schon kennt: flyer-code.js liest das Pfadsegment `/erstflug`,
   legt den Code in Cookie und localStorage und räumt die Adresszeile auf.
   Diese Datei macht daraus statt eines stillen Balkens ein Fenster, in dem
   man den Rabatt ANNEHMEN kann — eine Wahl, keine Ankündigung.

   Gezeigt wird es genau einmal je Besuch (sessionStorage). Wer ablehnt,
   behält den Code trotzdem — er liegt im Cookie und greift im Checkout;
   abgelehnt wird nur das Fenster, nicht der Rabatt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var GESEHEN = 'dp_erstflug_popup_gesehen';
  var ID = 'dp-erstflug-popup';

  function code() {
    try {
      var l = localStorage.getItem('dp_flyer_code');
      if (l) return l;
    } catch (e) {}
    var m = document.cookie.match(/(?:^|;\s*)dp_flyer=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* Kommt der Besucher gerade über /erstflug herein? flyer-code.js hat den
     Pfad zu diesem Zeitpunkt eventuell schon aufgeräumt - deshalb zählt
     beides: der Pfad UND der frisch gesetzte Code. */
  function ueberFlyer() {
    if (/\/erstflug\/?$/i.test(location.pathname)) return true;
    try { if (sessionStorage.getItem('dp_flyer_frisch') === '1') return true; } catch (e) {}
    return false;
  }

  function prozent(cb) {
    var basis = (location.hostname.indexOf('localhost') >= 0)
      ? '/api/v1' : 'https://app.dealpilot.immo/api/v1';
    var fertig = false;
    var zeit = setTimeout(function () { if (!fertig) { fertig = true; cb(null); } }, 2500);
    try {
      fetch(basis + '/plans/promo', { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (fertig) return;
          fertig = true; clearTimeout(zeit);
          cb(d && d.active && d.percent ? d : null);
        })
        .catch(function () { if (!fertig) { fertig = true; clearTimeout(zeit); cb(null); } });
    } catch (e) { if (!fertig) { fertig = true; clearTimeout(zeit); cb(null); } }
  }

  function stil() {
    if (document.getElementById(ID + '-stil')) return;
    var s = document.createElement('style');
    s.id = ID + '-stil';
    s.textContent = [
      '#' + ID + '{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;',
      '  justify-content:center;padding:22px;background:rgba(5,5,5,.62);opacity:0;',
      '  transition:opacity .28s ease}',
      '#' + ID + '.an{opacity:1}',
      '#' + ID + ' .k{background:#0F0E0B;color:#F6F3EC;border:1px solid rgba(201,168,76,.42);',
      '  border-radius:16px;max-width:470px;width:100%;padding:30px 32px 26px;text-align:center;',
      '  box-shadow:0 26px 70px rgba(0,0,0,.55);transform:translateY(16px) scale(.98);',
      '  transition:transform .34s cubic-bezier(.3,.9,.3,1)}',
      '#' + ID + '.an .k{transform:none}',
      '#' + ID + ' .b{display:inline-block;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);',
      '  color:#1a1509;font:700 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.14em;',
      '  padding:8px 13px;border-radius:99px;margin-bottom:17px}',
      '#' + ID + ' h2{margin:0 0 9px;font:600 27px/1.2 "Space Grotesk",Inter,sans-serif;letter-spacing:-.5px}',
      '#' + ID + ' h2 em{font-style:normal;color:#E8CC7A}',
      '#' + ID + ' p{margin:0 0 20px;font:15px/1.55 Inter,system-ui,sans-serif;color:rgba(246,243,236,.76)}',
      '#' + ID + ' .z{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}',
      '#' + ID + ' .ja{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1509;',
      '  border:0;border-radius:99px;padding:12px 24px;font:600 14.5px Inter,sans-serif;cursor:pointer}',
      '#' + ID + ' .ja:hover{filter:brightness(1.06)}',
      '#' + ID + ' .nein{background:none;border:1px solid rgba(246,243,236,.26);color:rgba(246,243,236,.72);',
      '  border-radius:99px;padding:12px 20px;font:500 14px Inter,sans-serif;cursor:pointer}',
      '#' + ID + ' .nein:hover{border-color:rgba(246,243,236,.5)}',
      '#' + ID + ' .f{margin:17px 0 0;font-size:11.5px;color:rgba(246,243,236,.42);line-height:1.5}',
      '@media(prefers-reduced-motion:reduce){#' + ID + ',#' + ID + ' .k{transition:none}}',
    ].join('');
    document.head.appendChild(s);
  }

  function appZiel(c) {
    var b = 'https://app.dealpilot.immo/?register=1';
    return c ? b + '&code=' + encodeURIComponent(c) : b;
  }

  function zeigen(pct, c) {
    stil();
    var d = document.createElement('div');
    d.id = ID;
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.innerHTML =
      '<div class="k">' +
        '<div class="b">ERSTFLUG</div>' +
        '<h2>Dein Rabatt liegt<br><em>' + pct + ' % dauerhaft</em> bereit.</h2>' +
        '<p>Du bist über den Erstflug-Link gekommen. Nimm den Rabatt an, dann gilt er ' +
          'für jedes Paket — und er bleibt, solange du fliegst.</p>' +
        '<div class="z">' +
          '<button type="button" class="ja">Rabatt annehmen →</button>' +
          '<button type="button" class="nein">Erst einmal umsehen</button>' +
        '</div>' +
        '<p class="f">Der Code ist hinterlegt — du musst nichts eingeben. ' +
          'Auch wenn du dich erst umsiehst, bleibt er gültig.</p>' +
      '</div>';
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('an'); });

    function zu() {
      d.classList.remove('an');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 300);
    }
    d.querySelector('.ja').addEventListener('click', function () { location.href = appZiel(c); });
    d.querySelector('.nein').addEventListener('click', zu);
    d.addEventListener('click', function (e) { if (e.target === d) zu(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { zu(); document.removeEventListener('keydown', esc); }
    });
  }

  function start() {
    if (!ueberFlyer()) return;                 /* nur über den Flyer-Link */
    try { if (sessionStorage.getItem(GESEHEN) === '1') return; } catch (e) {}
    var c = code();
    prozent(function (d) {
      var pct = (d && d.percent) ? d.percent : 15;
      try { sessionStorage.setItem(GESEHEN, '1'); } catch (e) {}
      setTimeout(function () { zeigen(pct, c || 'ERSTFLUG'); }, 700);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
