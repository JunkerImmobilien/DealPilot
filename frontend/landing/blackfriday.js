/* ═══════════════════════════════════════════════════════════════════════
   blackfriday.js · landing-blackfriday-1 (24.11.2026), landing-blackweek-1 (25.11.2026)
   Marcel 25.11.2026: Aktion heisst Black Week und laeuft bis 06.12.2026 23:59:59 MEZ.
   Stripe live: Promotion-Code BLACKFRIDAY26 neu promo_1UfaqzGefFev8arzdA5HFh3y
   (expires_at 1796597999) auf Coupon 8dyzOqc2, alter promo_1UfDsfGefFev8arz0gnfuns4 inaktiv.
   ───────────────────────────────────────────────────────────────────────
   Marcel 24.11.2026: "ein kleines Popup wie das letzte zum Erstflug auf der
   Landingpage zu Black Friday und unten die Preise dann reduzieren, so
   durchstreichen".

   Angebot (Marcel 24.11.2026, in Stripe live angelegt): Code BLACKFRIDAY26,
   20 % auf die Zahlungen der ersten zwoelf Monate, nur Investor und Pro, nur
   neue Abos, Code laeuft am 01.12.2026 23:59:59 Europe/Berlin ab
   (expires_at 1796165999). Gemessen im Live-Checkout: 27,99 / 307,20 /
   39,99 / 439,20 EUR.

   Zwei Teile, beide nur bis ENDE:
     1. Fenster nach dem Vorbild erstflug-popup.js, einmal je Besucher
        (localStorage), nur auf der Startseite.
     2. Preise der Tickets Investor und Pro: regulaer durchgestrichen, daneben
        der Preis mit 20 %. Gerechnet aus data-m/data-y der Seite (x 0,8,
        auf den Cent gerundet), nie hart eingetragen.

   Nach ENDE tut die Datei nichts mehr, ohne Rollout.

   Flyer-Gaeste (ERSTFLUG): Wer einen Flyer-Code mitbringt, bekommt im
   Checkout diesen Code fest gesetzt, das Codefeld fehlt dann
   (stripeService allow_promotion_codes vs discounts). Fuer sie zeigt sich
   ERSTFLUG wie bisher und Black Friday GAR NICHT, sonst versprechen wir
   einen Code, den sie nicht eingeben koennen.

   Test: localStorage 'dp_bf_jetzt' = ISO-Zeit taeuscht die Uhr vor
   (nur zum Nachmessen; ohne den Eintrag gilt die echte Uhr).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CODE = 'BLACKFRIDAY26';
  var ENDE = Date.UTC(2026, 11, 6, 22, 59, 59);      /* 06.12.2026 23:59:59 MEZ (Black Week, landing-blackweek-1) */
  var FAKTOR = 0.8;
  var PLAENE = { investor: 1, pro: 1 };
  var GESEHEN = 'dp_bw26_popup_gesehen'; /* landing-blackweek-2: neuer Merker, Black-Week-Fenster erscheint einmal neu */
  var ID = 'dp-bf-popup';

  function jetzt() {
    try {
      var t = localStorage.getItem('dp_bf_jetzt');
      if (t) { var v = Date.parse(t); if (!isNaN(v)) return v; }
    } catch (e) {}
    return Date.now();
  }

  function flyerGast() {
    if (/\/erstflug\/?$/i.test(location.pathname)) return true;
    try { if (sessionStorage.getItem('dp_flyer_frisch') === '1') return true; } catch (e) {}
    try { if (localStorage.getItem('dp_flyer_code')) return true; } catch (e) {}
    return /(?:^|;\s*)dp_flyer=/.test(document.cookie || '');
  }

  function aktiv() { return jetzt() <= ENDE && !flyerGast(); }

  function rabatt(n) { return Math.round(n * 100 * FAKTOR) / 100; }
  function eur(n) { return Number(n).toFixed(2).replace('.', ',').replace(/,00$/, ''); }

  /* ── Stil ─────────────────────────────────────────────────────────── */
  function stil() {
    if (document.getElementById('dp-bf-stil')) return;
    var s = document.createElement('style');
    s.id = 'dp-bf-stil';
    s.textContent = [
      /* Fenster, Massstab erstflug-popup.js */
      '#' + ID + '{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;',
      '  justify-content:center;padding:22px;background:rgba(5,5,5,.62);opacity:0;transition:opacity .28s ease}',
      '#' + ID + '.an{opacity:1}',
      '#' + ID + ' .k{position:relative;background:#0F0E0B;color:#F6F3EC;border:1px solid rgba(201,168,76,.42);',
      '  border-radius:16px;max-width:470px;width:100%;padding:30px 32px 26px;text-align:center;',
      '  box-shadow:0 26px 70px rgba(0,0,0,.55);transform:translateY(16px) scale(.98);',
      '  transition:transform .34s cubic-bezier(.3,.9,.3,1)}',
      '#' + ID + '.an .k{transform:none}',
      '#' + ID + ' .x{position:absolute;top:10px;right:12px;background:none;border:0;color:rgba(246,243,236,.5);',
      '  font:400 22px/1 Inter,sans-serif;cursor:pointer;padding:6px}',
      '#' + ID + ' .x:hover{color:#F6F3EC}',
      '#' + ID + ' .b{display:inline-block;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);',
      '  color:#1a1509;font:700 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.14em;',
      '  padding:8px 13px;border-radius:99px;margin-bottom:17px}',
      '#' + ID + ' h2{margin:0 0 9px;font:600 27px/1.2 "Space Grotesk",Inter,sans-serif;letter-spacing:-.5px}',
      '#' + ID + ' h2 em{font-style:normal;color:#E8CC7A}',
      '#' + ID + ' p{margin:0 0 18px;font:15px/1.55 Inter,system-ui,sans-serif;color:rgba(246,243,236,.76)}',
      '#' + ID + ' .c{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 20px;',
      '  border:1px dashed rgba(201,168,76,.6);border-radius:10px;padding:10px 12px;max-width:330px;cursor:pointer;',
      '  background:rgba(201,168,76,.06)}',
      '#' + ID + ' .c b{font:700 19px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;color:#E8CC7A}',
      '#' + ID + ' .c span{font:500 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;',
      '  color:rgba(246,243,236,.6);text-transform:uppercase}',
      '#' + ID + ' .z{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}',
      '#' + ID + ' .ja{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1509;',
      '  border:0;border-radius:99px;padding:12px 24px;font:600 14.5px Inter,sans-serif;cursor:pointer}',
      '#' + ID + ' .ja:hover{filter:brightness(1.06)}',
      '#' + ID + ' .nein{background:none;border:1px solid rgba(246,243,236,.26);color:rgba(246,243,236,.72);',
      '  border-radius:99px;padding:12px 20px;font:500 14px Inter,sans-serif;cursor:pointer}',
      '#' + ID + ' .nein:hover{border-color:rgba(246,243,236,.5)}',
      '#' + ID + ' .f{margin:17px 0 0;font-size:11.5px;color:rgba(246,243,236,.42);line-height:1.5}',
      '@media(max-width:480px){#' + ID + ' .k{padding:26px 20px 22px}#' + ID + ' h2{font-size:23px}}',
      '@media(prefers-reduced-motion:reduce){#' + ID + ',#' + ID + ' .k{transition:none}}',
      /* Preise */
      '.dpbf-alt{position:relative;display:inline-block;margin-right:11px;font-size:.62em;font-weight:600;',
      '  color:#7A7366;vertical-align:.32em;white-space:nowrap}',
      '.dpbf-alt:after{content:"";position:absolute;left:-3px;right:-3px;top:53%;height:2px;',
      '  background:#D8564C;transform:rotate(-8deg)}',
      '.dpbf-etk{display:block;width:-moz-fit-content;width:fit-content;margin:8px 0 2px;',
      '  background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1509;',
      '  font:700 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;padding:6px 10px;border-radius:99px}',
      '.dpbf-code{display:block;margin-top:5px;font:500 11.5px/1.4 Inter,sans-serif;color:#5C5648}',
      '.dpbf-code b{color:#2A2727;font-family:"JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Preise ───────────────────────────────────────────────────────── */
  function planVon(tk) {
    var a = tk && tk.querySelector('a.tk-cta[href*="plan="]');
    var m = a && /[?&]plan=([a-z]+)/.exec(a.getAttribute('href') || '');
    return m ? m[1] : null;
  }

  function malen() {
    if (!aktiv()) return;
    document.querySelectorAll('.tk-price[data-m]').forEach(function (el) {
      var tk = el.closest('.tk');
      if (!PLAENE[planVon(tk)]) return;
      var m = parseFloat(el.getAttribute('data-m')), y = parseFloat(el.getAttribute('data-y'));
      if (!(m > 0) || !(y > 0)) return;
      var per = el.querySelector('.per');
      var jahr = /Jahr/i.test((per && per.textContent) || '');
      var basis = jahr ? y : m;
      var b = el.querySelector('b'); if (!b) return;
      var alt = el.querySelector('.dpbf-alt'); if (alt) alt.remove();
      b.textContent = eur(rabatt(basis));
      alt = document.createElement('span');
      alt.className = 'dpbf-alt';
      alt.textContent = eur(basis) + ' €';
      el.insertBefore(alt, el.firstChild);

      var body = el.parentNode;
      var note = body && body.querySelector('.tk-note');
      if (note) {
        note.textContent = jahr
          ? 'im ersten Jahr, danach ' + eur(y) + ' €/Jahr'
          : 'die ersten 12 Monate, oder ' + eur(rabatt(y)) + ' € statt ' + eur(y) + ' € im ersten Jahr';
      }
      if (body && !body.querySelector('.dpbf-etk')) {
        var etk = document.createElement('span');
        etk.className = 'dpbf-etk';
        etk.textContent = 'BLACK WEEK − 20 %';
        var code = document.createElement('span');
        code.className = 'dpbf-code';
        code.innerHTML = 'Code <b>' + CODE + '</b> im Checkout eingeben';
        var anker = note ? note.nextSibling : el.nextSibling;
        body.insertBefore(etk, anker);
        body.insertBefore(code, anker);
      }
    });
  }

  /* Der Umschalter (dp2-inhalt.js preise()) setzt Preis und Notiz neu,
     danach malen wir wieder: 0-Timeout wie promo-erstflug.js. */
  function anUmschalter() {
    ['segZeit', 'segArt'].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) s.addEventListener('click', function () { setTimeout(malen, 0); });
    });
  }

  /* ── Fenster ──────────────────────────────────────────────────────── */
  function startseite() {
    return !/preise\.html$|\/preise\/?$/i.test(location.pathname);
  }

  function kopieren(el) {
    var fertig = function () {
      var s = el.querySelector('span'); if (!s) return;
      var t = s.textContent; s.textContent = 'kopiert';
      setTimeout(function () { s.textContent = t; }, 1600);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CODE).then(fertig, function () {});
        return;
      }
    } catch (e) {}
    try {
      var r = document.createRange(); r.selectNodeContents(el.querySelector('b'));
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.execCommand('copy'); fertig();
    } catch (e) {}
  }

  function zeigen() {
    stil();
    var d = document.createElement('div');
    d.id = ID;
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', 'Black Week Angebot');
    d.innerHTML =
      '<div class="k">' +
        '<button type="button" class="x" aria-label="Schließen">×</button>' +
        '<div class="b">BLACK WEEK</div>' +
        '<h2>20 % auf Investor und Pro<br><em>das ganze erste Jahr.</em></h2>' +
        '<p>Für neue Abos bis 06.12.2026. Gib den Code im Checkout ein.</p>' +
        '<div class="c" role="button" tabindex="0" title="Code kopieren"><b>' + CODE + '</b><span>kopieren</span></div>' +
        '<div class="z">' +
          '<button type="button" class="ja">Zu den Paketen →</button>' +
          '<button type="button" class="nein">Später</button>' +
        '</div>' +
        '<p class="f">20 % auf die Zahlungen der ersten zwölf Monate, danach regulärer Preis. ' +
          'Nicht mit anderen Codes kombinierbar.</p>' +
      '</div>';
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add('an'); }, 30);   /* kein rAF: Hintergrund-Tab, siehe erstflug-popup v1522b */

    function zu() {
      d.classList.remove('an');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 300);
    }
    var c = d.querySelector('.c');
    c.addEventListener('click', function () { kopieren(c); });
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kopieren(c); } });
    d.querySelector('.ja').addEventListener('click', function () {
      zu();
      var p = document.getElementById('pricing');
      if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else location.href = 'preise.html';
    });
    d.querySelector('.nein').addEventListener('click', zu);
    d.querySelector('.x').addEventListener('click', zu);
    /* einzelcheck-2 (Marcel 24.11.2026): Klick daneben schliesst nicht mehr, nur ×, Später und Esc */
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { zu(); document.removeEventListener('keydown', esc); }
    });
  }

  /* landing-deal-sprung-1 (Marcel 26.11.2026): statt Vollbild-Fenster eine schmale Leiste am unteren Rand,
     erst nach 20 s oder ab gut einem Drittel der Seite. Schließen gilt für die Sitzung. Das Fenster zeigen() bleibt
     als Funktion stehen, wird aber nicht mehr aufgerufen. */
  var LZU = "dp_bw26_leiste_zu";
  function leiste() {
    if (document.getElementById("dp-bf-leiste")) return;
    var st = document.createElement("style");
    st.id = "dp-bf-leiste-stil";
    st.textContent = [
      "#dp-bf-leiste{position:fixed;left:12px;right:12px;bottom:12px;z-index:9000;max-width:760px;margin:0 auto;display:flex;align-items:center;gap:12px;",
      "background:rgba(12,11,9,.96);color:#ECE6D6;border:1px solid rgba(201,168,76,.28);border-radius:10px;padding:10px 10px 10px 16px;",
      "box-shadow:0 18px 40px rgba(0,0,0,.35);transform:translateY(160%);transition:transform .45s cubic-bezier(.2,.7,.3,1);font-family:Inter,system-ui,sans-serif}",
      "#dp-bf-leiste.an{transform:none}",
      "#dp-bf-leiste p{margin:0;flex:1;font-size:13.5px;line-height:1.35}",
      "#dp-bf-leiste p b{color:var(--wl-e8cc7a,#E8CC7A);font:600 11.5px 'JetBrains Mono',monospace;letter-spacing:.12em;margin-right:6px}",
      "#dp-bf-leiste code{font:600 12.5px 'JetBrains Mono',monospace;color:#fff;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;cursor:pointer}",
      "#dp-bf-leiste a{flex:0 0 auto;display:inline-flex;align-items:center;min-height:40px;padding:8px 14px;border-radius:4px;",
      "background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#3a2e08;font-weight:600;font-size:14px;text-decoration:none}",
      "#dp-bf-leiste button{flex:0 0 40px;height:40px;border:0;background:transparent;color:rgba(255,255,255,.5);font-size:22px;cursor:pointer;border-radius:6px}",
      "#dp-bf-leiste button:hover{color:#fff;background:rgba(255,255,255,.06)}",
      "@media(max-width:520px){#dp-bf-leiste{left:8px;right:8px;bottom:8px;padding:8px 6px 8px 12px}#dp-bf-leiste p{font-size:12.5px}#dp-bf-leiste .lang{display:none}#dp-bf-leiste a{padding:8px 11px;font-size:13.5px}}",
      "@media(prefers-reduced-motion:reduce){#dp-bf-leiste{transition:none}}"
    ].join("");
    document.head.appendChild(st);
    var l = document.createElement("aside");
    l.id = "dp-bf-leiste";
    l.setAttribute("aria-label", "Black Week Angebot");
    l.innerHTML = "<p><b>BLACK WEEK</b>20 % auf Investor und Pro<span class=\"lang\"> im ersten Jahr</span> bis 06.12. mit Code <code title=\"Code kopieren\">" + CODE + "</code></p>" +
      "<a href=\"#pricing\">Zu den Paketen</a><button type=\"button\" aria-label=\"Angebot schließen\">×</button>";
    document.body.appendChild(l);
    setTimeout(function () { l.classList.add("an"); }, 30);
    var c = l.querySelector("code");
    c.addEventListener("click", function () { kopieren(c); });
    l.querySelector("a").addEventListener("click", function (e) {
      var p = document.getElementById("pricing");
      if (p) { e.preventDefault(); p.scrollIntoView({ behavior: "smooth", block: "start" }); }
      else { e.preventDefault(); location.href = "preise.html"; }
    });
    l.querySelector("button").addEventListener("click", function () {
      l.classList.remove("an");
      setTimeout(function () { if (l.parentNode) l.parentNode.removeChild(l); }, 450);
      try { sessionStorage.setItem(LZU, "1"); } catch (e) {}
    });
  }

  function start() {
    if (!aktiv()) return;
    stil();
    malen();
    anUmschalter();
    if (!startseite()) return;
    try { if (sessionStorage.getItem(LZU) === "1") return; } catch (e) {}
    var an = false;
    function los() { if (an || !aktiv()) return; an = true; removeEventListener("scroll", sc); leiste(); }
    function sc() { if (scrollY > document.documentElement.scrollHeight * 0.35) los(); }
    setTimeout(los, 20000);
    addEventListener("scroll", sc, { passive: true });
  }

  window.DpBlackFriday = { aktiv: aktiv, rabatt: rabatt, ende: ENDE, code: CODE };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
