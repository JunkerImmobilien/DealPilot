/* ============================================================================
   promo-erstflug.js — Founding-Member-Rabatt (ERSTFLUG) fuer LANDING und APP.

   EINE Datei, zwei Ansichten. Beide rendern dasselbe Markup:
     <div class="tk-price" data-m="29" data-y="290"><b>29</b>…</div>
   Landing: Ticket-Grid  .tkg   (Umschalter #ptoggle)
   App    : Plan-Karten  .ppg   im #pricing-plugin-host (Umschalter .dp-toggle-btn)

   WAHRHEIT KOMMT AUS STRIPE. Das Backend liest den aktiven Promotion-Code und
   liefert Prozentsatz + Restplaetze. Kein Treffer / kein Netz -> KEIN Banner
   (fail closed). Lieber gar keine Werbung als ein Code, den es nicht gibt.

   Zustaende:
     'promo'    Banner + rabattierte Preise (Landing immer; App nur ohne bezahlten Plan)
     'founding' Bestandskunde MIT Rabatt -> "Du fliegst als Founding Member"
     'off'      nichts (Plaetze weg, Stripe stumm, oder zahlender Kunde ohne Rabatt)

   Gold laeuft ueber die --wl-Ebene (White-Label-Pflicht).
   ========================================================================= */
(function (global) {
  'use strict';

  var CACHE_KEY = 'dp_promo_v2';   /* v2: alte Eintraege aus offenen Tabs verwerfen */
  var CACHE_TTL = 10 * 60 * 1000;      /* 10 min */
  var PLAN_WAIT = 4000;                /* max. Wartezeit auf dp:plan-ready */

  /* ═══════════════════════════════════════════════════════════════
     REINE LOGIK  (in node testbar, kein DOM)
     ═══════════════════════════════════════════════════════════════ */

  /** 15 % von 29 -> 24.65 ; auf Cent gerundet wie Stripe */
  function discount(base, percent) {
    var v = base * (1 - percent / 100);
    return Math.round(v * 100) / 100;
  }

  /** 24.65 -> "24,65" · 246.5 -> "246,50" · 20 -> "20" */
  function fmtNum(v) {
    var r = Math.round(v * 100) / 100;
    if (Math.abs(r - Math.round(r)) < 0.005) return String(Math.round(r));
    return r.toFixed(2).replace('.', ',');
  }

  /** Zustand aus Backend-Antwort + App-Kontext ableiten */
  function decideState(promo, ctx) {
    /* ctx = { app:bool, plan:'free'|…|null, founding:bool, foundingPercent:num } */
    if (ctx && ctx.founding) return 'founding';
    if (!promo || !promo.active) return 'off';
    if (promo.left != null && promo.left <= 0) return 'off';
    if (!ctx || !ctx.app) return 'promo';                 /* Landing */
    if (!ctx.plan || ctx.plan === 'free') return 'promo'; /* App, noch nichts gebucht */
    return 'off';                                         /* zahlt schon, ohne Rabatt */
  }

  /** Notiz unter dem Preis neu texten (Landing hat data-save, App nicht) */
  function noteText(orig, o) {
    /* o = { yearly:bool, y:num, save:num|null, percent:num } */
    if (o.yearly) {
      if (o.save != null) return 'spart ' + fmtNum(discount(o.save, o.percent)) + ' \u20ac / Jahr';
      return orig;
    }
    if (!o.y) return orig;
    return 'oder ' + fmtNum(discount(o.y, o.percent)) + ' \u20ac/Jahr';
  }

  var LOGIC = { discount: discount, fmtNum: fmtNum, decideState: decideState, noteText: noteText };

  /* Node-Selbsttest: kein document -> nur Logik exportieren, nichts rendern. */
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) module.exports = LOGIC;
    if (global) global.DealPilotPromo = { _logic: LOGIC };
    return;
  }

  /* ═══════════════════════════════════════════════════════════════
     CSS (selbst injiziert — kein zweiter Tag in der index.html)
     ═══════════════════════════════════════════════════════════════ */
  function css() {
    if (document.getElementById('dpp-css')) return;
    var s = document.createElement('style');
    s.id = 'dpp-css';
    s.textContent = [
      '.dpp-banner{position:relative;overflow:hidden;margin:0 auto 26px;max-width:900px;display:flex;',
      ' align-items:center;justify-content:center;gap:8px 18px;flex-wrap:wrap;padding:15px 26px;border-radius:14px;',
      ' border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 42%,transparent);',
      ' background:linear-gradient(180deg,color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 13%,transparent),',
      ' color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 4%,transparent));',
      ' opacity:0;transform:translateY(14px);transition:opacity .7s,transform .8s cubic-bezier(.2,.85,.25,1)}',
      '.dpp-banner.in{opacity:1;transform:translateY(0)}',
      '.dpp-banner:before{content:"";position:absolute;top:0;left:-40%;width:40%;height:100%;pointer-events:none;',
      ' background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--wl-e8cc7a, #E8CC7A) 20%,transparent),transparent);',
      ' animation:dppSheen 3.8s infinite}',
      '@keyframes dppSheen{0%{left:-40%}55%,100%{left:120%}}',
      ".dpp-banner .tag{font:700 10px/1 'JetBrains Mono',monospace;letter-spacing:.2em;color:#2c2410;",
      ' background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));',
      ' padding:8px 12px;border-radius:6px;white-space:nowrap}',
      '.dpp-banner .txt{font:600 15.5px/1.45 Inter,sans-serif;color:var(--wl-e8cc7a, #E8CC7A)}',
      '.dpp-banner .txt b{color:#fff}',
      ".dpp-banner .code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#fff;",
      ' border:1px dashed color-mix(in srgb,var(--wl-e8cc7a, #E8CC7A) 65%,transparent);border-radius:6px;',
      ' padding:3px 9px;margin:0 2px;letter-spacing:.08em}',
      '.dpp-banner .fine{font:400 12px/1.4 Inter,sans-serif;color:#8a8376;flex-basis:100%;text-align:center}',
      ".dpp-banner .cnt{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;",
      ' letter-spacing:.06em;color:var(--wl-e8cc7a, #E8CC7A);background:rgba(0,0,0,.35);',
      ' border-radius:20px;padding:4px 11px;white-space:nowrap}',
      /* Bestandskunde: gruener statt goldener Rahmen — Bindung, nicht Werbung */
      '.dpp-banner.founding{border-color:rgba(63,165,108,.45);',
      ' background:linear-gradient(180deg,rgba(63,165,108,.12),rgba(63,165,108,.03))}',
      '.dpp-banner.founding .tag{background:linear-gradient(110deg,#57c187,#3FA56C 60%,#2f8a58);color:#04180e}',
      '.dpp-banner.founding .txt{color:#8fd8b0}',
      /* Alter Preis mit Streichung */
      /* v4: alter Preis deutlich groesser — man soll sehen, was er vorher war */
      '.dpp-old{position:relative;display:inline-block;margin-right:11px;font-size:.66em;font-weight:600;',
      ' color:#9a9184;opacity:.9;vertical-align:baseline;white-space:nowrap;letter-spacing:-.01em}',
      '.dpp-old:after{content:"";position:absolute;left:-3px;top:53%;height:2px;width:var(--dppw,0);',
      ' background:#D8564C;box-shadow:0 0 9px rgba(216,86,76,.85);border-radius:2px;',
      ' transform:translateY(-50%);transition:width .6s cubic-bezier(.6,0,.3,1)}',
      /* Rabatt-Chip unter dem Preis */
      /* v4: Rabatt-Chip in Rot und auf EIGENER Zeile. Vorher inline-block ->
         er floss neben "oder 243,60 EUR/Jahr" und quetschte die Karte.
         Rot ist Statusfarbe und bleibt bewusst hart (nicht in WL_TINTS). */
      ".dpp-badge{display:block;width:-moz-fit-content;width:fit-content;clear:both;",
      " margin:9px 0 0;font:700 9.5px/1 'JetBrains Mono',monospace;",
      ' letter-spacing:.12em;color:#D8564C;background:rgba(216,86,76,.09);',
      ' border:1px solid rgba(216,86,76,.42);border-radius:5px;',
      ' padding:5px 9px;opacity:0;transform:scale(.85);transform-origin:left center;',
      ' transition:opacity .45s,transform .5s cubic-bezier(.2,1.5,.4,1)}',
      /* Notiz darf umbrechen, damit der Chip nie danebengedrueckt wird */
      '.tk-note{min-height:0}',
      '.dpp-badge.in{opacity:1;transform:scale(1)}',
      '@media(max-width:560px){.dpp-banner{padding:13px 16px}.dpp-banner .txt{font-size:14px}}',
      '@media(prefers-reduced-motion:reduce){.dpp-banner,.dpp-badge{transition:none}.dpp-banner:before{animation:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════════════════════
     BACKEND
     ═══════════════════════════════════════════════════════════════ */
  function apiBase() {
    try {
      if (global.Auth && typeof Auth.getApiBase === 'function') {
        var b = Auth.getApiBase();               /* enthaelt bereits /api/v1 */
        if (b) return String(b).replace(/\/+$/, '');
      }
    } catch (e) {}
    /* Landing: App-Host = "app." + Landing-Host (deckt alle 4 Domains) */
    try {
      var h = (location.hostname || '').toLowerCase();
      if (!/dealpilot/.test(h)) return null;     /* lokale Vorschau -> kein Promo */
      var app = h.indexOf('app.') === 0 ? h : 'app.' + h;
      return location.protocol + '//' + app + '/api/v1';
    } catch (e) { return null; }
  }

  function cacheGet() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY); if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || (Date.now() - o.t) > CACHE_TTL) return null;
      return o.d;
    } catch (e) { return null; }
  }
  function cacheSet(d) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  }

  /* Vorschau-Modus: ?promo=demo  -> feste Werte, Stripe wird NICHT gefragt.
     Damit laesst sich die Optik abnehmen, bevor der Code im richtigen
     Stripe-Konto liegt. ?promo=founding zeigt die Bestandskunden-Variante. */
  function demoMode() {
    try {
      var m = /[?&]promo=(demo|founding)\b/.exec(location.search || '');
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  function loadPromo() {
    /* Notausgang fuers Debuggen: ?promo=fresh ignoriert den Cache komplett */
    try {
      if (/[?&]promo=fresh\b/.test(location.search || '')) {
        sessionStorage.removeItem(CACHE_KEY);
        sessionStorage.removeItem('dp_promo_v1');
      }
    } catch (e) {}
    if (demoMode()) {
      return Promise.resolve({ active: true, code: 'ERSTFLUG', percent: 16,
                               duration: 'forever', max: 100, used: 3, left: 97 });
    }
    var c = cacheGet();
    if (c) return Promise.resolve(c);
    var base = apiBase();
    if (!base) return Promise.resolve(null);
    /* Oeffentlicher Endpoint — nacktes fetch ist hier richtig: er liefert nie 401,
       der zentrale 401-Handler haette also nichts zu tun. */
    return fetch(base + '/plans/promo', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var p = j && j.promo ? j.promo : null;
        /* v5-FIX: NUR aktive Antworten cachen. Vorher landete auch
           { active:false } fuer 10 Minuten im sessionStorage — stand der
           Endpoint kurz auf "aus", blieb die Seite stumm, obwohl Stripe
           laengst wieder lieferte. Kein Reload half, weil sessionStorage
           den Tab ueberlebt. Ein "aus" wird jetzt nie eingefroren. */
        if (p && p.active) cacheSet(p);
        return p;
      })
      .catch(function () { return null; });
  }

  function loadFounding() {
    /* Nur in der App und nur eingeloggt sinnvoll. */
    try {
      if (!(global.Auth && typeof Auth.apiCall === 'function' && Auth.isLoggedIn && Auth.isLoggedIn()))
        return Promise.resolve(null);
    } catch (e) { return Promise.resolve(null); }
    return Auth.apiCall('/subscription/promo')
      .then(function (r) { return r || null; })
      .catch(function () { return null; });
  }

  /** Plan abwarten — NIE vor dp:plan-ready lesen (Architektur-Regel). */
  function planReady() {
    return new Promise(function (res) {
      try {
        if (global.DealPilotPlanReady && global.DealPilotPlanReady.plan)
          return res(global.DealPilotPlanReady.plan);
        var done = false;
        var fin = function (p) { if (!done) { done = true; res(p); } };
        global.addEventListener('dp:plan-ready', function (e) {
          fin(e && e.detail ? e.detail.plan : null);
        });
        setTimeout(function () { fin(null); }, PLAN_WAIT);
      } catch (e) { res(null); }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  var ST = { state: 'off', percent: 0, code: '', left: null, max: null };

  function bannerHtml() {
    if (ST.state === 'founding') {
      return '<span class="tag">FOUNDING MEMBER</span>' +
        '<span class="txt">Du fliegst als Founding Member \u2014 <b>' + fmtNum(ST.percent) +
        '\u00a0% dauerhaft</b>.</span>' +
        '<span class="fine">Der Rabatt bleibt auf deinem Abo, solange es l\u00e4uft \u2014 monatlich wie j\u00e4hrlich.</span>';
    }
    var rest = (ST.left != null && ST.max != null)
      ? ('<span class="cnt">Noch ' + ST.left + ' von ' + ST.max + ' Pl\u00e4tzen</span>')
      : '<span class="cnt">Begrenzte Anzahl Pl\u00e4tze</span>';
    return '<span class="tag">FOUNDING MEMBER</span>' +
      '<span class="txt"><b>' + fmtNum(ST.percent) + '\u00a0% dauerhaft</b> mit Code ' +
      '<span class="code">' + esc(ST.code) + '</span></span>' +
      '<span class="fine">' + rest + ' \u00b7 gilt monatlich und j\u00e4hrlich, solange dein Abo l\u00e4uft \u00b7 ' +
      'Code im Bezahlvorgang eingeben</span>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mountBanner(grid) {
    if (!grid || !grid.parentNode) return;
    var b = grid.parentNode.querySelector(':scope > .dpp-banner');
    if (!b) {
      b = document.createElement('div');
      b.className = 'dpp-banner' + (ST.state === 'founding' ? ' founding' : '');
      grid.parentNode.insertBefore(b, grid);
    } else {
      b.className = 'dpp-banner in' + (ST.state === 'founding' ? ' founding' : '');
    }
    b.innerHTML = bannerHtml();
    try {
      if (!b.classList.contains('in')) {
        new IntersectionObserver(function (es, o) {
          es.forEach(function (x) { if (x.isIntersecting) { b.classList.add('in'); o.disconnect(); } });
        }, { threshold: .2 }).observe(b);
        setTimeout(function () { b.classList.add('in'); }, 1600);  /* Sicherheitsnetz */
      }
    } catch (e) { b.classList.add('in'); }
  }

  /** Preise einer Ansicht neu zeichnen. Laeuft NACH dem Umschalter der Seite. */
  function paint(grid) {
    if (!grid) return;
    var P = ST.percent; if (!P) return;
    var prices = grid.querySelectorAll('.tk-price[data-m]');
    Array.prototype.forEach.call(prices, function (el, i) {
      var m = parseFloat(el.getAttribute('data-m') || '0');
      var y = parseFloat(el.getAttribute('data-y') || '0');
      var b = el.querySelector('b'); if (!b) return;

      /* Alt-Zustand raeumen — der Seiten-Renderer hat <b> gerade neu gesetzt */
      var old = el.querySelector('.dpp-old'); if (old) old.remove();
      var body = el.parentNode;
      var oldBadge = body ? body.querySelector('.dpp-badge') : null;
      if (oldBadge) oldBadge.remove();

      var per = el.querySelector('.per');
      var yearly = /Jahr/i.test((per && per.textContent) || '');
      var base = yearly ? y : m;
      if (!base) return;                                   /* Free-Ticket */

      var neu = discount(base, P);

      /* Notiz (oder 290 €/Jahr  /  spart 58 € / Jahr) */
      var note = body ? body.querySelector('.tk-note') : null;
      if (note) {
        if (!note.getAttribute('data-dpp-orig')) note.setAttribute('data-dpp-orig', note.textContent || '');
        var saveAttr = note.getAttribute('data-save');
        note.textContent = noteText(note.getAttribute('data-dpp-orig'), {
          yearly: yearly, y: y, save: saveAttr ? parseFloat(saveAttr) : null, percent: P
        });
      }

      /* Alter Preis + Durchstreichen */
      var o = document.createElement('span');
      o.className = 'dpp-old';
      o.textContent = fmtNum(base) + ' \u20ac';
      el.insertBefore(o, el.firstChild);

      /* Chip */
      var bd = null;
      if (note) {
        bd = document.createElement('div');
        bd.className = 'dpp-badge';
        bd.textContent = '\u2212 ' + fmtNum(P) + ' % \u00b7 ' + (ST.state === 'founding' ? 'FOUNDING MEMBER' : ST.code);
        note.appendChild(bd);
      }

      /* Animation: Strich zieht durch, Zahl rollt runter */
      var d = i * 130;
      setTimeout(function () { o.style.setProperty('--dppw', 'calc(100% + 6px)'); }, 240 + d);
      setTimeout(function () {
        var t0 = performance.now();
        (function step(t) {
          var p = Math.min((t - t0) / 700, 1);
          var e = 1 - Math.pow(1 - p, 3);
          b.textContent = fmtNum(base + (neu - base) * e);
          if (p < 1) requestAnimationFrame(step); else b.textContent = fmtNum(neu);
        })(performance.now());
      }, 620 + d);
      setTimeout(function () { if (bd) bd.classList.add('in'); }, 1150 + d);
    });
  }

  function repaint(grid) {
    /* 0-Timeout: erst laeuft der Umschalter der Seite, dann wir. */
    setTimeout(function () { paint(grid); }, 0);
  }

  /* v3: Rabatt-Animation alle 10 s neu abspielen, solange das Preis-Grid im Bild
     ist. Aufmerksamkeit, ohne im Hintergrund zu rechnen. */
  function loopPaint(grid) {
    if (!grid || grid._dppLoop) return;
    grid._dppLoop = 1;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduce) return;
    var timer = null;
    function replay() {
      Array.prototype.forEach.call(grid.querySelectorAll('.tk-price[data-m]'), function (el) {
        var o = el.querySelector('.dpp-old'); if (o) o.remove();
        var b = el.querySelector('b');
        var per = el.querySelector('.per');
        var yearly = /Jahr/i.test((per && per.textContent) || '');
        var base = parseFloat(el.getAttribute(yearly ? 'data-y' : 'data-m') || '0');
        if (b && base) b.textContent = fmtNum(base);      /* auf Startwert zurueck */
      });
      paint(grid);
    }
    try {
      new IntersectionObserver(function (es) {
        es.forEach(function (x) {
          if (x.isIntersecting) { if (!timer) timer = setInterval(replay, 10000); }
          else { if (timer) { clearInterval(timer); timer = null; } }
        });
      }, { threshold: .2 }).observe(grid);
    } catch (e) {}
  }

  /* ── Landing: .tkg + #ptoggle ───────────────────────────────── */
  function wireLanding() {
    var g = document.querySelector('.tkg'); if (!g) return false;
    mountBanner(g);
    paint(g);
    loopPaint(g);
    var t = document.getElementById('ptoggle');
    if (t && !t.getAttribute('data-dpp')) {
      t.setAttribute('data-dpp', '1');
      t.addEventListener('click', function () { repaint(g); });
    }
    return true;
  }

  /* ── App: .ppg im #pricing-plugin-host (Modal wird dynamisch gebaut) ── */
  function wireApp() {
    var host = document.getElementById('pricing-plugin-host'); if (!host) return false;
    var g = host.querySelector('.ppg'); if (!g) return false;
    mountBanner(g);
    paint(g);
    loopPaint(g);
    Array.prototype.forEach.call(host.querySelectorAll('.dp-toggle-btn'), function (bt) {
      if (bt.getAttribute('data-dpp')) return;
      bt.setAttribute('data-dpp', '1');
      bt.addEventListener('click', function () { repaint(g); });
    });
    return true;
  }

  /** Wartet, bis das Pricing-Modal seine Karten gerendert hat (max. ~3 s). */
  function waitForApp() {
    var tries = 0;
    (function tick() {
      if (wireApp()) return;
      if (++tries > 180) return;                 /* ~3 s bei 60 fps */
      requestAnimationFrame(tick);
    })();
  }

  function watchModal() {
    try {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var added = recs[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n && n.nodeType === 1 && n.id === 'pricing-modal') { waitForApp(); return; }
          }
        }
      }).observe(document.body, { childList: true });   /* bewusst OHNE subtree */
    } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════════════ */
  function boot() {
    var isApp = !!(global.Auth && typeof Auth.getApiBase === 'function');

    loadPromo().then(function (promo) {
      if (!promo) return;
      var dm = demoMode();
      var ctx = { app: isApp, plan: null, founding: (dm === 'founding') };
      if (dm === 'founding') ST.percent = 16;

      var chain = (isApp && !dm)
        ? planReady().then(function (plan) {
            ctx.plan = plan;
            if (!plan || plan === 'free') return null;    /* kein Abo -> kein Rabatt-Check */
            return loadFounding();
          })
        : Promise.resolve(null);

      return chain.then(function (f) {
        if (f && f.founding) { ctx.founding = true; ST.percent = f.percent || promo.percent; }
        var st = decideState(promo, ctx);
        if (st === 'off') return;
        ST.state = st;
        ST.code = promo.code || 'ERSTFLUG';
        ST.left = (promo.left == null ? null : promo.left);
        ST.max = (promo.max == null ? null : promo.max);
        if (!ST.percent) ST.percent = promo.percent;
        if (!ST.percent) return;

        css();
        if (isApp) { watchModal(); waitForApp(); }
        else { if (!wireLanding()) setTimeout(wireLanding, 400); }
      });
    }).catch(function () { /* still: reguläre Preise bleiben stehen */ });
  }

  global.DealPilotPromo = { _logic: LOGIC, _state: ST, repaint: function () {
    var g = document.querySelector('.tkg') ||
            (document.getElementById('pricing-plugin-host') || document).querySelector('.ppg');
    if (g) paint(g);
  } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : this);
