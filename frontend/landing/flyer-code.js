/* ============================================================================
   flyer-code.js — der Weg vom gedruckten Flyer in den Stripe-Checkout.
   v1421 · Marcel 16.09.2026: „Ich will den Code auf einen Flyer drucken.
   Koennen wir das was machen das man direkt dort hingelangt mit dem Rabatt?
   Der Kunde soll es einfach haben."

   DER WEG
     1. Auf dem Flyer steht  dealpilot.immo/erstflug
     2. Caddy kennt den Pfad nicht -> try_files faellt auf die Landing
        (gemessen 16.09.2026: beide Domains antworten dort mit 200)
     3. Diese Datei liest das Pfadsegment, merkt sich ERSTFLUG und raeumt
        die Adresszeile wieder auf
     4. Beim Checkout schickt subscription.js den Code mit; das Backend
        loest ihn bei Stripe auf und legt ihn als discounts[] in die
        Session. Der Kunde tippt NICHTS.

   WARUM EIN COOKIE UND NICHT NUR localStorage
     Landing und App liegen auf VERSCHIEDENEN Rechnernamen:
       staging.dealpilot.immo   <- hier kommt der Flyer-Gast an
       app.staging.dealpilot.immo <- hier kauft er
     localStorage gilt je Origin und traegt ueber diese Grenze NICHT.
     Ein Cookie auf der Elterndomain (.dealpilot.immo) schon. Deshalb
     beides: Cookie fuer den Uebergang, localStorage als Gedaechtnis in
     der jeweiligen Ansicht. Zusaetzlich bekommen Links, die auf die
     App-Domain zeigen, den Code als ?code= angehaengt — falls ein
     Browser Drittanbieter-Regeln verschaerft.

   WAS SIE NICHT TUT
     Sie prueft den Code NICHT. Das kann nur Stripe. Ein abgelaufener oder
     falsch gedruckter Code laeuft hier stumm durch und wird im Backend
     verworfen (fail-open, siehe stripeService.js) — der Kauf gelingt dann
     ohne Rabatt statt gar nicht.

   DIESE DATEI LIEGT ZWEIMAL, wie promo-erstflug.js:
     frontend/landing/flyer-code.js   (Landing, /srv/landing)
     frontend/js/flyer-code.js        (App,     /srv/frontend)
   Beide muessen gleich bleiben.
   ========================================================================= */
(function (global) {
  'use strict';

  var SCHLUESSEL   = 'dp_flyer_code';
  var COOKIE_NAME  = 'dp_flyer';
  var TAGE         = 90;
  var ELTERNDOMAIN = '.dealpilot.immo';

  /* Pfade, die AUSSEHEN wie ein Code, aber keiner sind. Caddy liefert echte
     Seiten selbst aus, hierher faellt normalerweise nur Unbekanntes — die
     Liste ist der Guertel zum Hosentraeger. */
  var KEINE_CODES = [
    'index', 'impressum', 'datenschutz', 'agb', 'legal', 'app', 'admin',
    'api', 'reseller', 'leistungsumfang', 'api-docs', 'preise', 'pricing',
    'login', 'register', 'account', 'favicon'
  ];

  /* ═══════════════════════════════════════════════════════════════
     REINE LOGIK (ohne DOM testbar)
     ═══════════════════════════════════════════════════════════════ */

  /** '/ErstFlug/' -> 'ERSTFLUG' · '/impressum' -> null · '/a/b' -> null */
  function ausPfad(pfad) {
    if (!pfad) return null;
    var teile = String(pfad).split('/').filter(function (t) { return t !== ''; });
    if (teile.length !== 1) return null;          /* nur ein einzelnes Segment */
    var s = teile[0];
    if (s.indexOf('.') !== -1) return null;       /* Dateiname, kein Code */
    if (!/^[A-Za-z0-9_-]{2,50}$/.test(s)) return null;
    if (KEINE_CODES.indexOf(s.toLowerCase()) !== -1) return null;
    return s.toUpperCase();
  }

  /** ?code=erstflug / ?promo= / ?rabatt= -> 'ERSTFLUG' */
  function ausQuery(suche) {
    var m = /[?&](?:code|promo|rabatt)=([A-Za-z0-9_-]{2,50})(?:&|$)/.exec(suche || '');
    return m ? m[1].toUpperCase() : null;
  }

  function istGueltig(code) {
    return typeof code === 'string' && /^[A-Za-z0-9_-]{2,50}$/.test(code);
  }

  /* ═══════════════════════════════════════════════════════════════
     SPEICHER
     ═══════════════════════════════════════════════════════════════ */

  function cookieLesen(name) {
    var m = new RegExp('(?:^|; )' + name + '=([^;]*)').exec(document.cookie || '');
    return m ? decodeURIComponent(m[1]) : null;
  }

  function cookieSchreiben(name, wert) {
    var ablauf = new Date(Date.now() + TAGE * 864e5).toUTCString();
    var basis = name + '=' + encodeURIComponent(wert) + ';expires=' + ablauf + ';path=/;SameSite=Lax';
    /* Auf der Elterndomain, damit Landing und App denselben Wert sehen.
       Auf localhost/fremder Domain scheitert das stumm — dann greift der
       zweite Versuch ohne domain=. */
    try {
      if (location.hostname.indexOf('dealpilot.immo') !== -1) {
        document.cookie = basis + ';domain=' + ELTERNDOMAIN +
          (location.protocol === 'https:' ? ';Secure' : '');
      }
    } catch (e) { /* egal */ }
    try { document.cookie = basis + (location.protocol === 'https:' ? ';Secure' : ''); } catch (e) {}
  }

  function merken(code) {
    if (!istGueltig(code)) return null;
    code = code.toUpperCase();
    try { localStorage.setItem(SCHLUESSEL, code); } catch (e) {}
    cookieSchreiben(COOKIE_NAME, code);
    return code;
  }

  /** Reihenfolge: localStorage (schnell, gleicher Origin) vor Cookie. */
  function holen() {
    var v = null;
    try { v = localStorage.getItem(SCHLUESSEL); } catch (e) {}
    if (istGueltig(v)) return v;
    v = cookieLesen(COOKIE_NAME);
    return istGueltig(v) ? v.toUpperCase() : null;
  }

  function loeschen() {
    try { localStorage.removeItem(SCHLUESSEL); } catch (e) {}
    cookieSchreiben(COOKIE_NAME, '');
    try {
      document.cookie = COOKIE_NAME + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + ELTERNDOMAIN;
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     DOM
     ═══════════════════════════════════════════════════════════════ */

  /* Haengt den Code an Links, die auf eine ANDERE dealpilot-Subdomain zeigen.

     v1421b · HIER STAND EIN FEHLER, und er war unsichtbar:
     verglichen wurde mit `href.indexOf(location.hostname) !== -1`. Auf der
     Landing ist `location.hostname` = staging.dealpilot.immo — und das ist
     eine TEILZEICHENKETTE von app.staging.dealpilot.immo. Jeder Link in die
     App galt damit als "dieselbe Domain" und wurde uebersprungen. Gemessen
     am 16.09.2026 im Browser: fuenf Links auf ?register=1, kein einziger
     mit code=. Dass der Flyer-Code trotzdem ankam, lag allein am Cookie —
     der Guertel hat gehalten, waehrend der Hosentraeger riss.

     Jetzt wird der Host GEPARST und exakt verglichen. `a.href` (nicht
     getAttribute) liefert die bereits aufgeloeste absolute Adresse. */
  function linkeAnreichern(code) {
    if (!code) return 0;
    var n = 0;
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], u;
      try { u = new URL(a.href, location.href); } catch (e) { continue; }
      if (u.hostname === location.hostname) continue;             /* dieselbe Domain */
      if (!/(^|\.)dealpilot\.immo$/i.test(u.hostname)) continue;  /* fremd: nichts anhaengen */
      if (u.searchParams.has('code')) continue;                   /* schon dran */
      u.searchParams.set('code', code);
      a.setAttribute('href', u.toString());
      n++;
    }
    return n;
  }

  /* ═══════════════════════════════════════════════════════════════
     EMPFANGSBALKEN

     v1421b · Marcels Befund: „Wenn ich über den Link Erstflug reingehe,
     komme ich einfach nur auf die Startseite."

     Das Banner aus promo-erstflug.js gibt es zwar, aber es steht bei der
     Preistabelle — auf der Staging-Landing gemessen **5544 px** unter der
     Oberkante. Wer oben ankommt, sieht es nie. Deshalb hier ein zweiter,
     schlanker Balken ganz oben: er sagt in einem Satz, dass der Rabatt
     angekommen ist, und bietet den Weg weiter an.

     BEWUSST OHNE ANIMATION. Er steht sofort da, statt sich einzublenden.
     Eine Einblendung haengt an requestAnimationFrame bzw. einer
     CSS-Transition — und beide laufen nicht, solange der Tab verborgen
     ist. Ein Willkommensgruss, der erst beim Hinsehen erscheint, ist
     genau das, was hier gefehlt hat.

     Der Prozentsatz wird NICHT hier bestimmt. flyer-code.js kennt nur den
     Code, nicht seinen Wert — die Wahrheit steht in Stripe. Deshalb
     startet der Balken ohne Zahl und promo-erstflug.js traegt sie nach
     (prozentNachtragen). Lieber kurz keine Zahl als eine erfundene.
     ═══════════════════════════════════════════════════════════════ */

  var BALKEN_ID = 'dp-flyer-balken';
  var ZUGEKLAPPT = 'dp_flyer_balken_zu';

  function appAdresse(code) {
    /* Bevorzugt einen echten Link aus der Seite — der kennt die richtige
       Adresse sicher. Nur wenn keiner da ist, wird sie abgeleitet. */
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var u; try { u = new URL(links[i].href, location.href); } catch (e) { continue; }
      if (u.hostname !== location.hostname && /(^|\.)dealpilot\.immo$/i.test(u.hostname)) {
        u.searchParams.set('register', '1');
        u.searchParams.set('code', code);
        return u.toString();
      }
    }
    var host = location.hostname.indexOf('app.') === 0 ? location.hostname : 'app.' + location.hostname;
    return location.protocol + '//' + host + '/?register=1&code=' + encodeURIComponent(code);
  }

  function balkenStil() {
    if (document.getElementById(BALKEN_ID + '-stil')) return;
    var s = document.createElement('style');
    s.id = BALKEN_ID + '-stil';
    s.textContent = [
      '#' + BALKEN_ID + '{display:flex;align-items:center;gap:14px;flex-wrap:wrap;',
      ' padding:11px 20px;background:#0E0D0B;color:#EFEAE0;',
      ' border-bottom:1px solid var(--wl-c9a84c, #C9A84C);',
      " font-family:Inter,system-ui,sans-serif;font-size:13.5px;line-height:1.45}",
      '#' + BALKEN_ID + ' .m{font-family:"JetBrains Mono",monospace;font-size:9.5px;',
      ' letter-spacing:.2em;font-weight:700;color:#050505;flex:none;padding:4px 9px;border-radius:2px;',
      ' background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f))}',
      '#' + BALKEN_ID + ' .t b{color:var(--wl-e8cc7a, #E8CC7A);font-weight:700}',
      '#' + BALKEN_ID + ' .f{color:#9A9384;font-size:12px}',
      '#' + BALKEN_ID + ' .c{margin-left:auto;flex:none;text-decoration:none;font-weight:600;font-size:13px;',
      ' padding:8px 16px;border-radius:3px;color:#050505;',
      ' background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f))}',
      '#' + BALKEN_ID + ' .c:focus-visible{outline:2px solid #fff;outline-offset:2px}',
      '#' + BALKEN_ID + ' .z{flex:none;background:none;border:0;color:#6F6858;font-size:19px;',
      ' line-height:1;cursor:pointer;padding:4px 6px}',
      '#' + BALKEN_ID + ' .z:hover{color:#EFEAE0}',
      '@media(max-width:640px){#' + BALKEN_ID + '{padding:10px 16px;font-size:12.5px}',
      ' #' + BALKEN_ID + ' .c{margin-left:0;width:100%;text-align:center}}'
    ].join('');
    document.head.appendChild(s);
  }

  function balkenZeigen(code) {
    if (!code || !document.body) return null;
    if (document.getElementById(BALKEN_ID)) return document.getElementById(BALKEN_ID);
    try { if (sessionStorage.getItem(ZUGEKLAPPT) === '1') return null; } catch (e) {}

    balkenStil();
    var d = document.createElement('div');
    d.id = BALKEN_ID;
    d.setAttribute('role', 'status');
    d.innerHTML =
      '<span class="m">ERSTFLUG</span>' +
      '<span class="t">Dein Rabatt ist aktiviert<b data-prozent></b></span>' +
      '<span class="f">Der Code ist hinterlegt — du musst nichts eingeben.</span>' +
      '<a class="c" href="' + appAdresse(code) + '">Kostenlos starten →</a>' +
      '<button class="z" type="button" aria-label="Hinweis schließen">×</button>';
    document.body.insertBefore(d, document.body.firstChild);
    d.querySelector('.z').addEventListener('click', function () {
      try { sessionStorage.setItem(ZUGEKLAPPT, '1'); } catch (e) {}
      if (d.parentNode) d.parentNode.removeChild(d);
    });
    return d;
  }

  /** Von promo-erstflug.js aufgerufen, sobald Stripe den Prozentsatz nennt. */
  function prozentNachtragen(prozent) {
    var p = Number(prozent);
    if (!isFinite(p) || p <= 0) return false;
    var ziel = document.querySelector('#' + BALKEN_ID + ' [data-prozent]');
    if (!ziel) return false;
    var text = String(p).replace('.', ',');
    ziel.textContent = ' · ' + text + ' % dauerhaft';
    return true;
  }

  /** Adresszeile aufraeumen: /erstflug -> / , ohne Neuladen. */
  function adresseAufraeumen() {
    try {
      if (global.history && history.replaceState) {
        history.replaceState(null, '', '/' + location.hash);
      }
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     START
     ═══════════════════════════════════════════════════════════════ */

  function start() {
    var neu = ausQuery(location.search) || ausPfad(location.pathname);
    var code = neu ? merken(neu) : holen();

    /* v1522 · Marcel 22.09.2026: wer ueber /erstflug hereinkommt, bekommt
       ein Fenster zum Annehmen statt eines stillen Balkens. Weil die
       Adresszeile gleich aufgeraeumt wird, merkt sich dieser Schalter den
       Zugang fuer erstflug-popup.js - sonst waere der Weg nicht mehr
       erkennbar, sobald der Pfad weg ist. */
    if (neu) { try { sessionStorage.setItem('dp_flyer_frisch', '1'); } catch (e) {} }

    if (neu) adresseAufraeumen();

    if (code) {
      try { document.documentElement.setAttribute('data-flyer-code', code); } catch (e) {}
      linkeAnreichern(code);
      /* Der Balken nur auf der LANDING. In der App sitzt der Nutzer schon
         im Cockpit; dort fuehrt die Preisansicht den Rabatt selbst. */
      /* v1522: Auf der Landing uebernimmt das Fenster (erstflug-popup.js).
         Der Balken bleibt fuer alle anderen Faelle - etwa wenn jemand den
         Code aus einem frueheren Besuch mitbringt und KEIN Fenster bekommt. */
      var frisch = false;
      try { frisch = sessionStorage.getItem('dp_flyer_frisch') === '1'; } catch (e) {}
      if (!global.Auth && !frisch) balkenZeigen(code);
      /* Nachzuegler: die Landing baut Teile ihrer Navigation per JS. */
      setTimeout(function () { linkeAnreichern(code); }, 1200);
    }
    return code;
  }

  var API = {
    get:     holen,
    set:     merken,
    clear:   loeschen,
    prozentNachtragen: prozentNachtragen,
    /* fuer Tests / Diagnose */
    _ausPfad:  ausPfad,
    _ausQuery: ausQuery
  };

  global.DealPilotFlyerCode = API;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : globalThis);
