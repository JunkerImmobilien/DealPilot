'use strict';
/**
 * reseller-portal.js — Partner-Portal als EIGENES Modal (Paket 4)
 *
 * Öffnet sich über den Einstellungen (eigenes Overlay, hoher z-index) mit
 * eigener linker Sidebar (Übersicht · Mandanten · Freigaben · Branding ·
 * Abrechnung) im DealPilot-Look: dunkle Bar, Gold-Hero, WEISSER Arbeitsbereich.
 *
 * Auslöser: ein Settings-Eintrag "Partner-Portal", der NUR bei Partner-Plan
 * injiziert wird (Sub.getCurrent().plan_id==='partner' / features.reseller).
 * Global aufrufbar via window.openResellerPortal().
 *
 * Verdrahtet an /api/v1/reseller/* (Paket 3).
 */
(function () {
  var _st = { pool: null, clients: [], iv: 'monthly', qty: 10, sec: 'ueber', gated: false, open: false };

  function api(p, o) { return Auth.apiCall('/reseller' + p, o || {}); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function eur(n) { try { return Number(n).toLocaleString('de-DE'); } catch (e) { return String(n); } }
  function toast(m) {
    try {
      var t = document.createElement('div');
      t.textContent = m;
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100001;background:#0b0b0a;color:#fff;border:1px solid #C9A84C;border-radius:10px;padding:12px 20px;font:600 13.5px Inter;box-shadow:0 12px 40px rgba(0,0,0,.5);max-width:80vw;text-align:center;pointer-events:none';
      document.body.appendChild(t);
      setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 2600);
    } catch (e) {}
  }
  function $(id) { return document.getElementById(id); }

  async function isPartner() {
    try {
      if (typeof Sub === 'undefined' || typeof Sub.getCurrent !== 'function') return false;
      var s = await Sub.getCurrent(); if (!s) return false;
      if ((s.plan_id || '').toLowerCase() === 'partner') return true;
      var f = s.plan_features || s.features || {}; return !!(f && f.reseller);
    } catch (e) { return false; }
  }

  // ── CSS ────────────────────────────────────────────────────
  function injectCss() {
    if ($('rp-css')) return;
    var st = document.createElement('style'); st.id = 'rp-css';
    st.textContent = [
      '.rp-ov{position:fixed;inset:0;z-index:99999;background:rgba(8,7,5,.62);display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(2px)}',
      '.rp-modal{width:100%;max-width:1080px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(201,168,76,.4);box-shadow:0 40px 100px rgba(0,0,0,.6);display:flex;flex-direction:column}',
      '.rp-bar{background:#0b0b0a;display:flex;align-items:center;padding:14px 22px}',
      '.rp-logo{font:700 18px "Space Grotesk";color:#fff}.rp-logo b{color:#C9A84C}',
      '.rp-ctx{margin-left:auto;font:600 11px "JetBrains Mono";letter-spacing:.22em;color:#C9A84C;text-transform:uppercase}',
      '.rp-x{margin-left:20px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.15);color:#fff;font-size:15px;cursor:pointer;background:none}',
      '.rp-hero{background:linear-gradient(105deg,#E8CC7A,#C9A84C 52%,#b8932f);padding:20px 28px}',
      '.rp-hero h1{font:600 28px "Cormorant Garamond",serif;color:#241c05;line-height:1.05}',
      '.rp-hero p{font-size:12.5px;color:#3a2e08;margin-top:2px}',
      '.rp-body{display:flex;flex:1;min-height:0}',
      '.rp-side{width:238px;flex-shrink:0;background:#0d0d0c;padding:13px 11px;display:flex;flex-direction:column}',
      '.rp-nav{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:9px;margin-bottom:3px;cursor:pointer;background:none;border:none;text-align:left;width:100%}',
      '.rp-nav svg{width:17px;height:17px;stroke:#9a9284;stroke-width:1.6;fill:none;flex-shrink:0}',
      '.rp-nav .t{font:600 13px "Space Grotesk";color:rgba(255,255,255,.82)}',
      '.rp-nav .s{font-size:10.5px;color:rgba(255,255,255,.38);margin-top:1px}',
      '.rp-nav:hover{background:rgba(255,255,255,.04)}',
      '.rp-nav.on{background:#161511;box-shadow:inset 2px 0 0 #C9A84C}.rp-nav.on svg{stroke:#C9A84C}.rp-nav.on .t{color:#C9A84C}',
      '.rp-work{flex:1;background:#fff;padding:24px 30px;overflow-y:auto}',
      '.rp-intro{font-size:13px;color:#6f685d;font-style:italic;margin-bottom:22px}',
      '.rp-label{font:600 10.5px "JetBrains Mono";letter-spacing:.16em;text-transform:uppercase;color:#9a7f3a;margin:0 0 14px}',
      '.rp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}',
      '.rp-stat{border:1px solid #e6e0d4;border-radius:13px;padding:16px 18px;background:#FDFCFA}',
      '.rp-stat .l{font:600 9.5px "JetBrains Mono";letter-spacing:.12em;text-transform:uppercase;color:#9a9284}',
      '.rp-stat .v{font:600 30px "Space Grotesk";margin-top:6px}.rp-stat.zug .v{color:#3FA56C}.rp-stat.frei .v{color:#b8932f}',
      '.rp-poolbar{height:9px;border-radius:5px;background:#efe9dc;overflow:hidden;display:flex;border:1px solid #e6e0d4}',
      '.rp-poolbar i{display:block;height:100%}.rp-poolbar .z{background:#3FA56C}.rp-poolbar .f{background:linear-gradient(105deg,#E8CC7A,#C9A84C,#b8932f)}',
      '.rp-buy{margin-top:20px;background:linear-gradient(105deg,#E8CC7A,#C9A84C 52%,#b8932f);color:#241c05;font:700 13.5px Inter;padding:12px 20px;border-radius:10px;border:none;cursor:pointer}',
      '.rp-panel{border:1px solid #e6e0d4;border-radius:14px;padding:20px 22px;margin-top:18px}',
      '.rp-row{display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}',
      '.rp-fl{font:600 9.5px "JetBrains Mono";letter-spacing:.1em;text-transform:uppercase;color:#9a9284;margin-bottom:8px}',
      '.rp-seg{display:inline-flex;background:#f1ece0;border-radius:9px;padding:3px;border:1px solid #e6e0d4}',
      '.rp-seg button{padding:8px 14px;font:600 12.5px Inter;border-radius:7px;color:#6f685d;border:none;background:none;cursor:pointer}.rp-seg button.on{background:#C9A84C;color:#241c05}',
      '.rp-step{display:flex;border:1px solid #e6e0d4;border-radius:9px;overflow:hidden}',
      '.rp-step button{width:38px;height:42px;font-size:19px;color:#b8932f;background:#f7f2e8;border:none;cursor:pointer}',
      '.rp-step input{width:54px;height:42px;text-align:center;border:none;font:600 16px "JetBrains Mono";outline:none;color:#1c1a17}',
      '.rp-price{margin-left:auto;text-align:right}.rp-price .per{font-size:12px;color:#6f685d}.rp-price .per b{color:#b8932f;font-family:"JetBrains Mono"}',
      '.rp-price .tot{font:600 24px "Space Grotesk";margin-top:2px}.rp-price .tot small{font-size:13px;color:#6f685d;font-weight:400}',
      '.rp-buyfoot{display:flex;align-items:center;gap:14px;margin-top:18px;padding-top:16px;border-top:1px solid #e6e0d4}',
      '.rp-staffel{font-size:11.5px;color:#6f685d;line-height:1.6}.rp-staffel b{color:#1c1a17}',
      '.rp-checkout{margin-left:auto;background:linear-gradient(105deg,#E8CC7A,#C9A84C,#b8932f);color:#241c05;font:700 13px Inter;padding:11px 20px;border-radius:9px;border:none;cursor:pointer}',
      '.rp-mrow{display:flex;align-items:center;gap:15px;padding:14px 4px;border-bottom:1px solid #e6e0d4}.rp-mrow:last-child{border-bottom:none}',
      '.rp-av{width:38px;height:38px;border-radius:10px;background:#f6ecd0;color:#b8932f;display:flex;align-items:center;justify-content:center;font:600 14px "Space Grotesk";flex-shrink:0}',
      '.rp-nm{font:600 14px "Space Grotesk"}.rp-mt{font-size:12px;color:#6f685d;margin-top:2px}',
      '.rp-mr{margin-left:auto;display:flex;align-items:center;gap:14px}',
      '.rp-seat{font:600 10px "JetBrains Mono";padding:5px 11px;border-radius:20px;white-space:nowrap}.rp-seat.on{background:#e2f0e6;color:#3FA56C}.rp-seat.off{background:#f0ece2;color:#6f685d}',
      '.rp-act{font:600 12.5px Inter;padding:8px 14px;border-radius:8px;border:1px solid #e6e0d4;background:#fff;cursor:pointer;white-space:nowrap}.rp-act.assign{color:#b8932f}.rp-act.remove{color:#B86250;border-color:#e6cbc5}',
      '.rp-add{border:1px solid #e6e0d4;color:#b8932f;font:600 12.5px Inter;padding:8px 14px;border-radius:8px;background:#fff;cursor:pointer;float:right}',
      '.rp-share{border:1px solid #e6e0d4;border-radius:12px;padding:16px 18px;margin-bottom:11px;display:flex;align-items:center;gap:15px;background:#FDFCFA}',
      '.rp-bg{font:600 9.5px "JetBrains Mono";letter-spacing:.06em;background:#fbeed8;color:#c8791f;padding:4px 9px;border-radius:6px;margin-left:auto}',
      '.rp-ph{color:#9a9284;font-size:13px;padding:30px 0;text-align:center;font-style:italic}',
      '.rp-foot{background:#FAF7F0;border-top:1px solid #e6e0d4;padding:12px 28px;display:flex;align-items:center;gap:12px}',
      '.rp-foot .st{font-size:12px;color:#6f685d;display:flex;align-items:center;gap:8px}.rp-foot .st .d{width:8px;height:8px;border-radius:50%;background:#3FA56C}',
      '.rp-foot .close{margin-left:auto;border:1px solid #e6e0d4;background:#fff;font:600 13px Inter;padding:9px 18px;border-radius:9px;cursor:pointer}',
      '.rp-sec{display:none}.rp-sec.on{display:block}'
    ].join('\n');
    document.head.appendChild(st);
  }

  var META = {
    ueber: ['Übersicht & Lizenz-Pool', 'Seats kaufen und an deine Mandanten verteilen.'],
    mand: ['Mandanten', 'Kunden verwalten und Seats zuweisen.'],
    frei: ['Freigaben', 'Eingereichte Objekte prüfen und bestätigen.'],
    brand: ['Branding', 'Whitelabel — Farben, Logo, Subdomain.'],
    abr: ['Abrechnung', 'Dein Partner-Abo und die Seat-Abrechnung.']
  };

  // ── Modal öffnen ───────────────────────────────────────────
  function openResellerPortal() {
    if (_st.open) return;
    injectCss();
    var ov = document.createElement('div'); ov.className = 'rp-ov'; ov.id = 'rp-overlay';
    ov.innerHTML =
      '<div class="rp-modal" role="dialog" aria-modal="true">' +
        '<div class="rp-bar"><span class="rp-logo">Deal<b>Pilot</b></span><span class="rp-ctx">Partner-Portal</span><button class="rp-x" id="rp-close">✕</button></div>' +
        '<div class="rp-hero"><h1 id="rp-htitle">Übersicht &amp; Lizenz-Pool</h1><p id="rp-hsub">Seats kaufen und an deine Mandanten verteilen.</p></div>' +
        '<div class="rp-body">' +
          '<div class="rp-side">' +
            nav('ueber', 'Übersicht', 'Lizenz-Pool, Seats', '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>') +
            nav('mand', 'Mandanten', 'Kunden, Seat-Zuweisung', '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>') +
            nav('frei', 'Freigaben', 'Objekte prüfen', '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>') +
            nav('brand', 'Branding', 'Whitelabel, Logo', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2 2M17 17l2 2M2 12h3M19 12h3"/>') +
            nav('abr', 'Abrechnung', 'Abo & Rechnungen', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>') +
          '</div>' +
          '<div class="rp-work" id="rp-work"></div>' +
        '</div>' +
        '<div class="rp-foot"><span class="st"><span class="d"></span>Partner-Plan aktiv</span><button class="close" id="rp-close2">Schließen</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    _st.open = true;

    ov.querySelectorAll('.rp-nav').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-s')); }); });
    $('rp-close').addEventListener('click', closePortal);
    $('rp-close2').addEventListener('click', closePortal);
    ov.addEventListener('click', function (e) { if (e.target === ov) closePortal(); });
    document.addEventListener('keydown', escClose);
    go(_st.sec || 'ueber');
  }
  function nav(s, t, sub, svg) {
    return '<button class="rp-nav' + (s === 'ueber' ? ' on' : '') + '" data-s="' + s + '">' +
      '<svg viewBox="0 0 24 24">' + svg + '</svg><span><span class="t">' + t + '</span><span class="s" style="display:block">' + sub + '</span></span></button>';
  }
  function escClose(e) { if (e.key === 'Escape') closePortal(); }
  function closePortal() {
    var ov = $('rp-overlay'); if (ov) ov.remove();
    document.removeEventListener('keydown', escClose);
    _st.open = false;
  }
  function go(s) {
    _st.sec = s;
    var ov = $('rp-overlay'); if (!ov) return;
    ov.querySelectorAll('.rp-nav').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === s); });
    $('rp-htitle').textContent = META[s][0]; $('rp-hsub').textContent = META[s][1];
    if (s === 'ueber') loadOverview();
    else if (s === 'mand') loadMandanten();
    else if (s === 'frei') loadFreigaben();
    else if (s === 'brand') loadBranding();
    else if (s === 'abr') $('rp-work').innerHTML = '<p class="rp-intro">Dein Partner-Abo und die Seat-Abrechnung.</p><p class="rp-label">Abo &amp; Rechnungen</p><p class="rp-ph">Partner-Basis · Seat-Pool · Stripe-Rechnungen — kommt im Abrechnungs-Paket.</p>';
  }

  // ── Übersicht ──────────────────────────────────────────────
  async function loadOverview() {
    var w = $('rp-work'); if (!w) return; w.innerHTML = '<p class="rp-ph">Lade Pool…</p>';
    try {
      var r = await api('/pool?refresh=1'); _st.pool = r.pool || { gekauft: 0, zugewiesen: 0, frei: 0 };
      var p = _st.pool, tot = p.gekauft || 1, zw = Math.round((p.zugewiesen / tot) * 100);
      w.innerHTML =
        '<p class="rp-intro">Dein Lizenz-Pool: gekaufte Seats, die du deinen Mandanten zuweist. Freie Seats sind jederzeit neu vergebbar.</p>' +
        '<p class="rp-label">Lizenz-Pool</p>' +
        '<div class="rp-stats"><div class="rp-stat"><div class="l">Gekauft</div><div class="v">' + p.gekauft + '</div></div>' +
          '<div class="rp-stat zug"><div class="l">Zugewiesen</div><div class="v">' + p.zugewiesen + '</div></div>' +
          '<div class="rp-stat frei"><div class="l">Frei</div><div class="v">' + p.frei + '</div></div></div>' +
        '<div class="rp-poolbar"><i class="z" style="width:' + zw + '%"></i><i class="f" style="width:' + (100 - zw) + '%"></i></div>' +
        '<button class="rp-buy" id="rp-buytoggle">+ Seats kaufen</button><div id="rp-buypanel"></div>';
      $('rp-buytoggle').addEventListener('click', toggleBuy);
    } catch (e) { w.innerHTML = '<p class="rp-ph">Pool konnte nicht geladen werden.</p>'; }
  }
  function toggleBuy() {
    var box = $('rp-buypanel'); if (!box) return;
    if (box.getAttribute('data-open')) { box.removeAttribute('data-open'); box.innerHTML = ''; return; }
    box.setAttribute('data-open', '1');
    box.innerHTML =
      '<div class="rp-panel"><p class="rp-label">Seats kaufen</p><div class="rp-row">' +
        '<div><div class="rp-fl">Abrechnung</div><div class="rp-seg"><button class="on" data-iv="monthly">Monatlich</button><button data-iv="yearly">Jährlich · 2 Mon. frei</button></div></div>' +
        '<div><div class="rp-fl">Anzahl Seats</div><div class="rp-step"><button id="rp-minus">–</button><input id="rp-qty" value="' + _st.qty + '" readonly><button id="rp-plus">+</button></div></div>' +
        '<div class="rp-price"><div class="per"></div><div class="tot"></div></div></div>' +
        '<div class="rp-buyfoot"><div class="rp-staffel">Volume-Staffel: <b>1–9 → 35 €</b> · <b>10–24 → 29 €</b> · <b>25+ → 24 €</b><br>Der Stückpreis gilt für alle Seats.</div>' +
        '<button class="rp-checkout" id="rp-checkout">Zur Kasse (Stripe)</button></div></div>';
    box.querySelectorAll('.rp-seg button').forEach(function (b) { b.addEventListener('click', function () { _st.iv = b.getAttribute('data-iv'); box.querySelectorAll('.rp-seg button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); calcPrice(); }); });
    $('rp-minus').addEventListener('click', function () { _st.qty = Math.max(1, _st.qty - 1); $('rp-qty').value = _st.qty; calcPrice(); });
    $('rp-plus').addEventListener('click', function () { _st.qty += 1; $('rp-qty').value = _st.qty; calcPrice(); });
    $('rp-checkout').addEventListener('click', doCheckout);
    calcPrice();
  }
  function calcPrice() {
    var q = _st.qty, m = q <= 9 ? 35 : (q <= 24 ? 29 : 24), per = _st.iv === 'yearly' ? m * 10 : m, tot = per * q;
    var box = $('rp-buypanel'); if (!box) return;
    box.querySelector('.per').innerHTML = '<b>' + per + ' €</b> / Seat / ' + (_st.iv === 'yearly' ? 'Jahr' : 'Monat');
    box.querySelector('.tot').innerHTML = eur(tot) + ' €<small> / ' + (_st.iv === 'yearly' ? 'Jahr' : 'Monat') + '</small>';
  }
  async function doCheckout() {
    try {
      var r = await api('/seats/checkout', { method: 'POST', body: { quantity: _st.qty, interval: _st.iv } });
      if (r && r.url) {
        if (r.sessionId) { try { localStorage.setItem('rp_pending_checkout', r.sessionId); } catch (e) {} }
        location.href = r.url; return;
      }
      toast('Checkout konnte nicht gestartet werden.');
    } catch (e) { toast('Fehler beim Checkout: ' + (e && e.message ? e.message : '')); }
  }

  // ── Mandanten ──────────────────────────────────────────────
  async function loadMandanten() {
    var w = $('rp-work'); if (!w) return; w.innerHTML = '<p class="rp-ph">Lade Mandanten…</p>';
    try {
      var r = await api('/clients'); _st.clients = r.clients || []; var invites = r.invites || [];
      var rows = _st.clients.map(function (c) {
        var ini = (c.display_name || '?').split(' ').map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase();
        var on = c._seat === 'zugewiesen' || c.seat_status === 'zugewiesen';
        return '<div class="rp-mrow"><div class="rp-av">' + esc(ini) + '</div><div><div class="rp-nm">' + esc(c.display_name) + '</div><div class="rp-mt">' + esc(c.status || 'aktiv') + '</div></div><div class="rp-mr">' +
          (on ? '<span class="rp-seat on">● Seat</span><button class="rp-act remove" data-un="' + c.id + '">entziehen</button>' : '<span class="rp-seat off">kein Seat</span><button class="rp-act assign" data-as="' + c.id + '">Seat zuweisen</button>') +
          '<button class="rp-act remove" data-del="' + c.id + '" title="Mandant entfernen" style="color:#B86250">entfernen</button></div></div>';
      }).join('');
      var invRows = invites.map(function (i) {
        var ini = (i.display_name || '?').split(' ').map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase();
        return '<div class="rp-mrow"><div class="rp-av" style="background:#f0ece2;color:#9a9284">' + esc(ini) + '</div><div><div class="rp-nm">' + esc(i.display_name) + '</div><div class="rp-mt">' + esc(i.email) + '</div></div>' +
          '<div class="rp-mr"><span class="rp-seat off">Einladung ausstehend</span><button class="rp-act remove" data-rev="' + i.id + '">zurückziehen</button></div></div>';
      }).join('');
      w.innerHTML = '<p class="rp-intro">Lade Mandanten per E-Mail ein — sie legen über den Link selbst ein Konto an und bekommen automatisch einen freien Seat.</p>' +
        '<p class="rp-label">Mandanten <button class="rp-add" id="rp-addc">+ Mandant einladen</button></p>' +
        '<div id="rp-inviteform"></div>' +
        (rows || (invRows ? '' : '<p class="rp-ph">Noch keine Mandanten.</p>')) +
        (invRows ? '<p class="rp-label" style="margin-top:24px">Offene Einladungen</p>' + invRows : '');
      w.querySelectorAll('[data-as]').forEach(function (b) { b.addEventListener('click', function () { seat(b.getAttribute('data-as'), 'assign'); }); });
      w.querySelectorAll('[data-un]').forEach(function (b) { b.addEventListener('click', function () { seat(b.getAttribute('data-un'), 'unassign'); }); });
      w.querySelectorAll('[data-rev]').forEach(function (b) { b.addEventListener('click', function () { revokeInvite(b.getAttribute('data-rev')); }); });
      w.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { removeClient(b.getAttribute('data-del')); }); });
      var a = $('rp-addc'); if (a) a.addEventListener('click', toggleInviteForm);
    } catch (e) { w.innerHTML = '<p class="rp-ph">Mandanten konnten nicht geladen werden.</p>'; }
  }
  function toggleInviteForm() {
    var host = $('rp-inviteform'); if (!host) return;
    if (host.getAttribute('data-open')) { host.removeAttribute('data-open'); host.innerHTML = ''; return; }
    host.setAttribute('data-open', '1');
    host.innerHTML =
      '<div class="rp-panel" style="margin-top:14px">' +
        '<div class="rp-row">' +
          '<div style="flex:1"><div class="rp-fl">Name des Mandanten</div>' +
            '<input id="rp-inv-name" style="width:100%;padding:9px 11px;border:1px solid #e6e0d4;border-radius:8px;font:400 13px Inter;outline:none"></div>' +
          '<div style="flex:1"><div class="rp-fl">E-Mail (bekommt die Einladung)</div>' +
            '<input id="rp-inv-email" type="email" style="width:100%;padding:9px 11px;border:1px solid #e6e0d4;border-radius:8px;font:400 13px Inter;outline:none"></div>' +
        '</div>' +
        '<div class="rp-buyfoot"><span class="rp-staffel">Der Mandant erhält einen Link, legt selbst ein Konto an und bekommt automatisch einen freien Seat.</span>' +
          '<button class="rp-checkout" id="rp-inv-send">Einladung senden</button></div>' +
      '</div>';
    $('rp-inv-send').addEventListener('click', submitInvite);
    var nm = $('rp-inv-name'); if (nm) nm.focus();
  }
  async function submitInvite() {
    var n = ($('rp-inv-name') || {}).value, em = ($('rp-inv-email') || {}).value;
    if (!n || !em) { toast('Name + E-Mail nötig'); return; }
    try {
      var r = await api('/clients', { method: 'POST', body: { email: em, displayName: n } });
      toast(r && r.mail_sent ? ('✓ Einladung an ' + em + ' gesendet') : 'Mandant angelegt — Mail nicht versendet (SMTP prüfen)');
      loadMandanten();
    } catch (e) { toast('Einladen fehlgeschlagen: ' + (e && e.message ? e.message : '')); }
  }
  async function revokeInvite(id) {
    try { await api('/invites/' + id + '/revoke', { method: 'POST', body: {} }); loadMandanten(); toast('Einladung zurückgezogen'); }
    catch (e) { toast('Fehlgeschlagen'); }
  }
  async function removeClient(id) {
    if (!window.confirm('Diesen Mandanten entfernen? Ein zugewiesener Seat geht zurück in den Pool.')) return;
    try { await api('/clients/' + id + '/remove', { method: 'POST', body: {} }); loadMandanten(); toast('Mandant entfernt'); }
    catch (e) { toast('Entfernen fehlgeschlagen'); }
  }
  async function seat(id, kind) {
    try { await api('/clients/' + id + '/' + kind, { method: 'POST', body: {} }); loadMandanten(); toast(kind === 'assign' ? 'Seat zugewiesen' : 'Seat entzogen'); }
    catch (e) { toast(e && e.status === 409 ? 'Kein freier Seat — erst welche kaufen.' : 'Aktion fehlgeschlagen'); }
  }

  // ── Freigaben ──────────────────────────────────────────────
  async function loadFreigaben() {
    var w = $('rp-work'); if (!w) return; w.innerHTML = '<p class="rp-ph">Lade Freigaben…</p>';
    try {
      var r = await api('/shares'); var all = r.shares || [];
      var pend = all.filter(function (s) { return s.status === 'eingereicht'; });
      var done = all.filter(function (s) { return s.status !== 'eingereicht'; });
      function eck(s) { var a = []; if (s.seq_no) a.push(esc(s.seq_no)); if (s.ort) a.push(esc(s.ort)); if (s.mandant) a.unshift(esc(s.mandant)); return a.join(' · '); }
      function row(s, right) {
        return '<div class="rp-share"><div><div class="rp-nm">' + esc(s.obj_name || 'Objekt') + '</div><div class="rp-mt">' + eck(s) + '</div></div>' +
          '<div style="margin-left:auto;display:flex;gap:8px;align-items:center">' + right + '</div></div>';
      }
      var pendHtml = pend.map(function (s) {
        return row(s, '<button class="rp-act" data-open="' + s.id + '">Öffnen</button>' +
          '<button class="rp-act" data-ok="' + s.id + '" style="color:#3FA56C;border-color:#bfe3cc">✓ Bestätigen</button>' +
          '<button class="rp-act remove" data-back="' + s.id + '">Zurückgeben</button>');
      }).join('');
      var doneHtml = done.map(function (s) {
        var b = s.status === 'bestaetigt' ? '<span class="rp-bg" style="background:#e2f0e6;color:#3FA56C">BESTÄTIGT</span>'
          : '<span class="rp-bg" style="background:#fbeeec;color:#B86250">ZURÜCKGEGEBEN</span>';
        var openBtn = s.status === 'bestaetigt' ? '<button class="rp-act" data-open="' + s.id + '">Öffnen</button>' : '';
        return row(s, b + openBtn);
      }).join('');
      w.innerHTML = '<p class="rp-intro">Von deinen Mandanten zur Prüfung eingereichte Objekte — einzeln bestätigen oder zurückgeben.</p>' +
        '<p class="rp-label">Wartet auf Prüfung (' + pend.length + ')</p>' + (pendHtml || '<p class="rp-ph">Keine offenen Prüfungen.</p>') +
        (doneHtml ? '<p class="rp-label" style="margin-top:22px">Erledigt</p>' + doneHtml : '');
      w.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { reviewShare(b.getAttribute('data-ok'), 'bestaetigt'); }); });
      w.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { reviewShare(b.getAttribute('data-back'), 'zurueckgegeben'); }); });
      w.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openSharedObject(b.getAttribute('data-open')); }); });
    } catch (e) { w.innerHTML = '<p class="rp-ph">Freigaben konnten nicht geladen werden.</p>'; }
  }
  async function reviewShare(id, decision) {
    try { await api('/shares/' + id + '/review', { method: 'POST', body: { decision: decision } }); loadFreigaben(); toast(decision === 'bestaetigt' ? '✓ Bestätigt' : 'Zurückgegeben'); }
    catch (e) { toast('Fehlgeschlagen'); }
  }

  // ── Cross-Account: freigegebenes Objekt read-only anzeigen ──
  function _n(v) { var n = parseFloat(v); return (isNaN(n) || !isFinite(n)) ? null : n; }
  function _pick() { for (var i = 0; i < arguments.length; i++) { if (arguments[i] != null && arguments[i] !== '') return arguments[i]; } return null; }
  function _eur(v) { v = _n(v); return v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'; }
  function _pct(v) { v = _n(v); return v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %'; }
  function _num(v, d) { v = _n(v); return v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: d == null ? 2 : d }); }

  function _osCss() {
    if ($('rp-os-css')) return;
    var s = document.createElement('style'); s.id = 'rp-os-css';
    s.textContent = [
      '.rp-os-ov{position:fixed;inset:0;z-index:100000;background:rgba(8,7,5,.7);display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(2px)}',
      '.rp-os{width:100%;max-width:760px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(201,168,76,.4);box-shadow:0 40px 100px rgba(0,0,0,.6);display:flex;flex-direction:column}',
      '.rp-os-bar{background:#0b0b0a;display:flex;align-items:center;padding:14px 22px}',
      '.rp-os-bar .l{font:700 17px "Space Grotesk";color:#fff}.rp-os-bar .l b{color:#C9A84C}',
      '.rp-os-bar .x{margin-left:auto;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.15);color:#fff;font-size:15px;cursor:pointer;background:none}',
      '.rp-os-hero{background:linear-gradient(105deg,#E8CC7A,#C9A84C 52%,#b8932f);padding:18px 26px}',
      '.rp-os-hero h1{font:600 24px "Cormorant Garamond",serif;color:#241c05;line-height:1.05}.rp-os-hero p{font-size:12px;color:#3a2e08;margin-top:2px}',
      '.rp-os-body{padding:22px 26px;overflow-y:auto}',
      '.rp-os-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px}',
      '.rp-os-k{border:1px solid #e6e0d4;border-radius:11px;padding:11px 13px;background:#fdfbf6}',
      '.rp-os-k .t{font:600 9px "JetBrains Mono";letter-spacing:.12em;text-transform:uppercase;color:#9a7f3a}',
      '.rp-os-k .v{font:700 18px "Space Grotesk";color:#1c1a17;margin-top:3px}',
      '.rp-os-sec{font:600 10px "JetBrains Mono";letter-spacing:.15em;text-transform:uppercase;color:#9a7f3a;margin:18px 0 10px}',
      '.rp-os-dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}',
      '.rp-os-dl .r{display:flex;justify-content:space-between;border-bottom:1px solid #f0ebdf;padding:6px 0;font-size:13px}',
      '.rp-os-dl .r .k{color:#6f685d}.rp-os-dl .r .v{font-weight:600;color:#1c1a17}',
      '.rp-os-txt{font-size:13px;line-height:1.6;color:#3a352c;white-space:pre-wrap;background:#faf7f0;border:1px solid #ece4d3;border-radius:10px;padding:14px 16px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  async function openSharedObject(shareId) {
    _osCss();
    var ex = $('rp-os-ov'); if (ex) ex.remove();
    var ov = document.createElement('div'); ov.className = 'rp-os-ov'; ov.id = 'rp-os-ov';
    ov.innerHTML = '<div class="rp-os"><div class="rp-os-bar"><span class="l">Deal<b>Pilot</b></span>' +
      '<button class="rp-act" id="rp-os-pdf" disabled style="margin-left:auto;opacity:.5;cursor:not-allowed">⬇ PDF</button>' +
      '<button class="x" id="rp-os-x" style="margin-left:14px">✕</button></div>' +
      '<div class="rp-os-body" id="rp-os-body"><p class="rp-ph">Lade Objekt…</p></div></div>';
    document.body.appendChild(ov);
    $('rp-os-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    try {
      var r = await api('/shares/' + shareId + '/object'); var o = r.object || {};
      var d = o.data || {};
      var nm = o.name || o.kuerzel || 'Objekt';
      var adr = [ (d.str || '') + ' ' + (d.hnr || ''), [(d.plz || ''), (d.ort || o.ort || '')].join(' ').trim() ].map(function (x) { return (x || '').trim(); }).filter(Boolean).join(', ');

      var dscr = _pick(d._kpis_dscr, d._dscr, o.dscr);
      var cfY = _pick(d._kpis_cf_ns, d._cf_ns);
      var cfMon = cfY != null ? _n(cfY) / 12 : (o.cf_ns != null ? _n(o.cf_ns) / 100 / 12 : null);
      var bmr = _pick(d._kpis_bmy, d._bmy, o.bmy);
      var ltv = _pick(d._kpis_ltv, d._ltv);
      var bwkY = _pick(d._kpis_bwk_y, d._bwk_y);
      var kp = _pick(d.kp, o.kaufpreis != null ? _n(o.kaufpreis) / 100 : null);

      function kpi(t, v) { return '<div class="rp-os-k"><div class="t">' + t + '</div><div class="v">' + v + '</div></div>'; }
      var kpis = kpi('DSCR', _num(dscr, 2)) + kpi('CF/Monat', cfMon == null ? '–' : _eur(cfMon)) +
        kpi('Rendite', _pct(bmr)) + kpi('LTV', _pct(ltv)) + kpi('BWK/Jahr', _eur(bwkY));

      function rowD(k, v) { return '<div class="r"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
      var eck = rowD('Kaufpreis', _eur(kp)) + rowD('Wohnfläche', d.wfl ? _num(d.wfl, 0) + ' m²' : '–') +
        rowD('Baujahr', d.baujahr || '–') + rowD('Objektart', esc(d.objart || '–')) +
        rowD('Kaltmiete/Monat', _eur(d.nkm)) + rowD('Eigenkapital', _eur(d.ek));

      var notiz = d.notizen ? '<div class="rp-os-sec">Notizen</div><div class="rp-os-txt">' + esc(d.notizen) + '</div>' : '';
      var ai = o.ai_analysis ? '<div class="rp-os-sec">KI-Analyse</div><div class="rp-os-txt">' + esc(String(o.ai_analysis).slice(0, 4000)) + '</div>' : '';

      $('rp-os-body').innerHTML =
        '<div class="rp-os-hero" style="margin:-22px -26px 20px"><h1>' + esc(nm) + '</h1><p>' + (esc(adr) || 'Freigegebenes Objekt') + (o.seq_no ? ' · ' + esc(o.seq_no) : '') + '</p></div>' +
        '<div class="rp-os-kpi">' + kpis + '</div>' +
        '<div class="rp-os-sec">Eckdaten</div><div class="rp-os-dl">' + eck + '</div>' +
        notiz + ai +
        '<p style="font-size:11px;color:#9a9284;margin-top:18px;font-style:italic">Read-only Ansicht der Mandanten-Freigabe · Marktpreisindikation, kein Gutachten n. § 194 BauGB.</p>';

      var pdfBtn = $('rp-os-pdf');
      if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.style.opacity = '1'; pdfBtn.style.cursor = 'pointer'; pdfBtn.addEventListener('click', function () { _sharedPdf(o); }); }
    } catch (e) {
      $('rp-os-body').innerHTML = '<p class="rp-ph">Objekt konnte nicht geladen werden' + ((e && e.status === 403) ? ' (Freigabe nicht mehr aktiv).' : '.') + '</p>';
    }
  }

  // Gebrandetes read-only Objekt-PDF direkt aus den Freigabe-Daten (ohne Haupt-Engine)
  function _sharedPdf(o) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF-Bibliothek lädt noch…'); return; }
    try {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var W = 210, M = 16;
      var b = (window.DealPilotConfig && DealPilotConfig.branding && DealPilotConfig.branding.get) ? DealPilotConfig.branding.get() : {};
      var company = b.company || b.product_name || 'DealPilot';
      var INK = [28, 26, 23], MUT = [122, 115, 112], GOLD = [201, 168, 76];
      var d = o.data || {};
      var nm = o.name || o.kuerzel || 'Objekt';
      var adr = [ (d.str || '') + ' ' + (d.hnr || ''), [(d.plz || ''), (d.ort || o.ort || '')].join(' ').trim() ].map(function (x) { return (x || '').trim(); }).filter(Boolean).join(', ');

      // Header
      doc.setFillColor(11, 11, 10); doc.rect(0, 0, W, 26, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('DealPilot', M, 16);
      doc.setTextColor(201, 168, 76); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(String(company), W - M, 16, { align: 'right' });
      doc.setFillColor(201, 168, 76); doc.rect(0, 26, W, 1.2, 'F');

      var y = 40;
      doc.setTextColor.apply(doc, INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(String(nm), M, y);
      y += 7; doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, MUT);
      doc.text((adr || 'Freigegebenes Objekt') + (o.seq_no ? '  ·  ' + o.seq_no : ''), M, y);
      y += 12;

      var dscr = _pick(d._kpis_dscr, d._dscr, o.dscr);
      var cfY = _pick(d._kpis_cf_ns, d._cf_ns);
      var cfMon = cfY != null ? _n(cfY) / 12 : (o.cf_ns != null ? _n(o.cf_ns) / 100 / 12 : null);
      var bmr = _pick(d._kpis_bmy, d._bmy, o.bmy);
      var ltv = _pick(d._kpis_ltv, d._ltv);
      var bwkY = _pick(d._kpis_bwk_y, d._bwk_y);
      var kp = _pick(d.kp, o.kaufpreis != null ? _n(o.kaufpreis) / 100 : null);

      var kpis = [['DSCR', _num(dscr, 2)], ['CF/Monat', cfMon == null ? '–' : _eur(cfMon)], ['Rendite', _pct(bmr)], ['LTV', _pct(ltv)], ['BWK/Jahr', _eur(bwkY)]];
      var bw = (W - 2 * M - 4 * 4) / 5, bh = 20, bx = M;
      kpis.forEach(function (k) {
        doc.setDrawColor(230, 224, 212); doc.setFillColor(253, 251, 246); doc.roundedRect(bx, y, bw, bh, 2, 2, 'FD');
        doc.setTextColor.apply(doc, MUT); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text(k[0].toUpperCase(), bx + 3, y + 6);
        doc.setTextColor.apply(doc, INK); doc.setFontSize(12); doc.text(String(k[1]), bx + 3, y + 14);
        bx += bw + 4;
      });
      y += bh + 12;

      doc.setTextColor.apply(doc, GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('ECKDATEN', M, y); y += 6;
      var eck = [['Kaufpreis', _eur(kp)], ['Wohnfläche', d.wfl ? _num(d.wfl, 0) + ' m²' : '–'], ['Baujahr', String(d.baujahr || '–')], ['Objektart', String(d.objart || '–')], ['Kaltmiete/Monat', _eur(d.nkm)], ['Eigenkapital', _eur(d.ek)]];
      doc.setFontSize(10.5);
      eck.forEach(function (row, i) {
        var col = i % 2, cx = M + col * ((W - 2 * M) / 2), ry = y + Math.floor(i / 2) * 8;
        doc.setTextColor.apply(doc, MUT); doc.setFont('helvetica', 'normal'); doc.text(row[0], cx, ry);
        doc.setTextColor.apply(doc, INK); doc.setFont('helvetica', 'bold'); doc.text(String(row[1]), cx + (W - 2 * M) / 2 - 4, ry, { align: 'right' });
      });
      y += Math.ceil(eck.length / 2) * 8 + 8;

      function block(title, txt) {
        if (!txt) return;
        doc.setTextColor.apply(doc, GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(title.toUpperCase(), M, y); y += 5;
        doc.setTextColor(58, 53, 44); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        var lines = doc.splitTextToSize(String(txt).slice(0, 2600), W - 2 * M);
        for (var i = 0; i < lines.length; i++) { if (y > 275) { doc.addPage(); y = 24; } doc.text(lines[i], M, y); y += 5; }
        y += 4;
      }
      block('Notizen', d.notizen);
      block('KI-Analyse', o.ai_analysis);

      doc.setDrawColor(230, 224, 212); doc.line(M, 285, W - M, 285);
      doc.setTextColor.apply(doc, MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(String(company) + ' · Marktpreisindikation, kein Gutachten n. § 194 BauGB', M, 290);
      doc.text(new Date().toLocaleDateString('de-DE'), W - M, 290, { align: 'right' });

      var fn = (String(company).replace(/[^a-zA-Z0-9]/g, '_') + '_' + String(nm).replace(/[^a-zA-Z0-9]/g, '_')).slice(0, 80);
      doc.save(fn + '.pdf');
      toast('✓ PDF erstellt');
    } catch (e) { toast('PDF fehlgeschlagen'); }
  }

  // ── Checkout-Return ────────────────────────────────────────
  async function handleReturn() {
    try {
      var q = new URLSearchParams(location.search);
      var sid = (q.get('reseller_pool') === 'success' && q.get('session_id')) ? q.get('session_id') : null;
      if (!sid) { try { sid = localStorage.getItem('rp_pending_checkout'); } catch (e) {} }
      if (!sid) return;
      var ok = false;
      try { await api('/pool/confirm', { method: 'POST', body: { sessionId: sid } }); ok = true; toast('✓ Seats hinzugefügt'); }
      catch (e) { if (e && e.status && e.status >= 400 && e.status < 500) ok = true; /* definitiv -> nicht endlos retryen */ }
      if (ok) { try { localStorage.removeItem('rp_pending_checkout'); } catch (e) {} }
      try { q.delete('reseller_pool'); q.delete('session_id'); history.replaceState({}, '', location.pathname + (q.toString() ? '?' + q.toString() : '')); } catch (e) {}
      if (ok) { try { openResellerPortal(); } catch (e) {} }
    } catch (e) {}
  }

  // ── Settings-Eintrag (Auslöser) ────────────────────────────
  function ensureEntry() {
    var tabs = document.querySelector('.settings-tabs') || (document.querySelector('.st-tab') && document.querySelector('.st-tab').parentNode);
    if (!tabs || tabs.querySelector('.st-tab[data-rp="1"]')) return;
    var src = tabs.querySelector('.st-tab[data-tab="plan"]') || tabs.querySelector('.st-tab');
    if (!src) return;
    var btn = src.cloneNode(true);
    btn.setAttribute('data-rp', '1'); btn.removeAttribute('data-tab'); btn.removeAttribute('onclick'); btn.classList.remove('active');
    var t = btn.querySelector('.help-sidebar-item-title'); if (t) t.textContent = 'Partner-Portal'; else btn.textContent = 'Partner-Portal';
    var d = btn.querySelector('.help-sidebar-item-desc'); if (d) d.textContent = 'Lizenzen, Mandanten, Freigaben';
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openResellerPortal(); });
    src.parentNode.insertBefore(btn, src.nextSibling);
  }

  // ── Plan-Label-Fix ─────────────────────────────────────────
  // 'partner' fehlt (bewusst) in config.js -> Pill fällt sonst auf "Free".
  // Config-Eintrag SOFORT (synchron, ungated) einspritzen, damit die Pille
  // "Partner" zeigt sobald Sub.getCurrent 'partner' liefert — ohne Hard-Reload.
  function injectPartnerConfig() {
    try {
      injectPillCss();
      if (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.plans &&
          !DealPilotConfig.pricing.plans.partner) {
        /* W9-partnerfeatures: hier standen NUR drei Features
           (reseller/reseller_whitelabel/custom_logo) — alles andere war fuer den
           Partner damit GESPERRT ("Portfolio: alle KPIs ab Investor-Plan", Deal
           Score, Track-Record ...). Die DB-Zeile 'partner' hat laengst alle
           Features (Migration 056), das Frontend hat sie ueberschrieben.
           Partner ist ein erweiterter Pro -> Pro KLONEN statt eine Liste pflegen,
           die beim naechsten Pro-Feature wieder veraltet ist. */
        var _pro = DealPilotConfig.pricing.plans.pro || {};
        var _pf = {}, _pl = {};
        try { _pf = JSON.parse(JSON.stringify(_pro.features || {})); } catch (e) { _pf = {}; }
        try { _pl = JSON.parse(JSON.stringify(_pro.limits   || {})); } catch (e) { _pl = {}; }
        _pf.reseller = true; _pf.reseller_whitelabel = true; _pf.custom_logo = true;
        _pl.objects = -1; _pl.max_saves = -1; _pl.ai_credits = 100;
        _pl.photos_per_obj = 30; _pl.watermark = false;
        DealPilotConfig.pricing.plans.partner = {
          key: 'partner', label: 'Partner', tagline: 'Makler · Steuerberater · Finanzierer',
          price_monthly_eur: 149, price_yearly_eur: 1490, sort_order: 5,
          limits: _pl,
          features: _pf,
          stripe_price_id_monthly: null, stripe_price_id_yearly: null
        };
      }
    } catch (e) {}
  }
  function fixPlanLabel() {
    injectPartnerConfig();
    try { if (typeof window.renderSubscriptionBadge === 'function') window.renderSubscriptionBadge(); } catch (e) {}
  }

  // Gold-Pille für plan-partner (gleiche Optik wie bezahlte Pläne)
  function injectPillCss() {
    if ($('rp-pill-css')) return;
    var s = document.createElement('style'); s.id = 'rp-pill-css';
    s.textContent = [
      '.sb-user-plan-pill.plan-partner,.sb-user-name .plan-partner{',
      'background:linear-gradient(135deg,#E8C964,#9a7f33)!important;',
      'color:#2A2727!important;font-weight:800!important;letter-spacing:.4px!important;',
      'border-color:transparent!important;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Whitelabel-Branding ─────────────────────────────────────
  var _brandState = { logo: undefined, current_logo: '' }; // logo undefined = unverändert, '' = entfernt
  function _currentLogo() { return _brandState.logo !== undefined ? _brandState.logo : (_brandState.current_logo || ''); }
  async function loadBranding() {
    var w = $('rp-work'); if (!w) return; w.innerHTML = '<p class="rp-ph">Lade Branding…</p>';
    try {
      var r = await api('/branding'); var b = r.branding || {};
      _brandState = { logo: undefined, current_logo: b.brand_logo_b64 || '' };
      var accent = b.brand_accent || '#C9A84C';
      var obsidian = b.brand_obsidian || '#0b0b0a';
      var inp = 'width:100%;padding:9px 11px;border:1px solid #e6e0d4;border-radius:8px;font:400 13px Inter;outline:none';
      var pick = 'width:100%;height:38px;border:1px solid #e6e0d4;border-radius:8px;background:#fff;cursor:pointer';
      w.innerHTML =
        '<p class="rp-intro">Dein Whitelabel — Logo, Akzentfarbe und Kontaktdaten erben deine Mandanten: in der App, in den Einladungs-Mails und im Fuß jedes PDFs.</p>' +
        '<div class="rp-panel">' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px">' +
            '<input type="checkbox" id="rp-b-wl"' + (b.whitelabel_enabled ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#C9A84C">' +
            '<span>Whitelabel aktiv — eigenes Branding statt DealPilot</span></label>' +
          '<div style="display:flex;gap:12px;margin-top:16px">' +
            '<div style="flex:1"><div class="rp-fl">Marken-/Kanzleiname</div><input id="rp-b-name" value="' + esc(b.brand_name || '') + '" style="' + inp + '"></div>' +
            /* W8-editor: Farbwaehler sassen hier, wo man das Ergebnis NICHT sieht.
               Jetzt: Knopf -> Editor mit Live-Vorschau. Die IDs bleiben als
               Hidden-Felder erhalten, damit saveBranding() unveraendert weiterlaeuft. */
            '<div style="flex:1"><div class="rp-fl">Farben &amp; Darstellung</div>' +
              '<button type="button" id="rp-b-disp" style="width:100%;text-align:left;padding:9px 11px;border:1px solid #e6e0d4;border-radius:8px;background:#fff;cursor:pointer;font:400 13px Inter;color:#3a352c">' +
                '<span id="rp-b-dot" style="display:inline-block;width:13px;height:13px;border-radius:3px;background:' + esc(accent) + ';vertical-align:-2px;margin-right:8px;border:1px solid rgba(0,0,0,.14)"></span>' +
                'Darstellung öffnen — live einstellen →</button></div>' +
          '</div>' +
          '<input type="hidden" id="rp-b-accent" value="' + esc(accent) + '">' +
          '<input type="hidden" id="rp-b-obsidian" value="' + esc(obsidian) + '">' +
          '<input type="hidden" id="rp-b-mail" value="' + esc(b.brand_mail_accent || accent) + '">' +
          '<div style="margin-top:14px"><div class="rp-fl">Logo (PNG/SVG, max ~300 KB)</div>' +
            '<input type="file" id="rp-b-logo" accept="image/*" style="font:400 12px Inter">' +
            '<button class="rp-act remove" id="rp-b-logo-x" type="button" style="margin-left:8px">entfernen</button></div>' +
        '</div>' +
        /* W1b-contact-ui: Kontaktdaten fuer den PDF-Footer der Mandanten.
           Ohne die faellt config.js auf JUNKER_DEFAULTS zurueck. */
        '<p class="rp-label" style="margin-top:22px">Impressum / PDF-Footer</p>' +
        '<p class="rp-intro" style="margin-top:4px">Diese Angaben stehen im Fuß jedes PDFs, das deine Mandanten erzeugen. Leer gelassene Felder bleiben leer — es wird nichts von DealPilot eingesetzt.</p>' +
        '<div class="rp-panel">' +
          '<div style="display:flex;gap:12px">' +
            '<div style="flex:2"><div class="rp-fl">Firma (rechtlich, falls abweichend)</div><input id="rp-b-company" value="' + esc(b.brand_company || '') + '" placeholder="' + esc(b.brand_name || 'Kanzlei Muster GmbH') + '" style="' + inp + '"></div>' +
            '<div style="flex:2"><div class="rp-fl">Claim / Untertitel</div><input id="rp-b-tagline" value="' + esc(b.brand_tagline || '') + '" placeholder="Ihre Kanzlei fuer Immobilien" style="' + inp + '"></div>' +
          '</div>' +
          '<div style="display:flex;gap:12px;margin-top:12px">' +
            '<div style="flex:3"><div class="rp-fl">Straße &amp; Hausnummer</div><input id="rp-b-address" value="' + esc(b.brand_address || '') + '" style="' + inp + '"></div>' +
            '<div style="width:96px"><div class="rp-fl">PLZ</div><input id="rp-b-plz" value="' + esc(b.brand_plz || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:2"><div class="rp-fl">Ort</div><input id="rp-b-city" value="' + esc(b.brand_city || '') + '" style="' + inp + '"></div>' +
          '</div>' +
          '<div style="display:flex;gap:12px;margin-top:12px">' +
            '<div style="flex:1"><div class="rp-fl">Telefon</div><input id="rp-b-phone" value="' + esc(b.brand_phone || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:1"><div class="rp-fl">E-Mail</div><input id="rp-b-email" type="email" value="' + esc(b.brand_email || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:1"><div class="rp-fl">Website</div><input id="rp-b-website" value="' + esc(b.brand_website || '') + '" style="' + inp + '"></div>' +
          '</div>' +
          '<div id="rp-b-foot" style="margin-top:14px;padding:11px 13px;background:#faf8f3;border:1px dashed #ddd6c8;border-radius:8px;font:400 11.5px/1.6 Inter;color:#6b6558"></div>' +
        '</div>' +
        '<p class="rp-label" style="margin-top:22px">Vorschau (Einladungs-Mail)</p><div id="rp-b-preview"></div>' +
        /* W6-preview: Der Owner sieht sein eigenes Whitelabel sonst NIE — /my-branding
           liefert nur fuer reseller_clients etwas. Ohne das muesste er sich als Mandant
           einloggen, um sein eigenes Branding zu pruefen. */
        '<div class="rp-panel" style="margin-top:18px">' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px">' +
            '<input type="checkbox" id="rp-b-prev" style="width:18px;height:18px;accent-color:var(--gold,#C9A84C)">' +
            '<span><b>Ansicht meiner Mandanten</b> — die App in meinem Branding anzeigen</span></label>' +
          '<div style="font-size:11.5px;color:#8a8473;margin-top:7px;padding-left:28px">Nur fuer dich, nur in diesem Browser. Zum Zuruecksetzen Haken entfernen.</div>' +
        '</div>' +
        '<div style="margin-top:18px"><button class="rp-checkout" id="rp-b-save">Branding speichern</button></div>';
      var upd = function () { _brandPreview(); try { if (_previewOn()) _applyPreview(); } catch (e) {} };  /*W7-livepreview*/
      $('rp-b-wl').addEventListener('change', upd);
      $('rp-b-name').addEventListener('input', upd);
      /* W8-editor: die Farb-Inputs sind jetzt hidden -> kein 'input'-Event. */
      $('rp-b-disp').addEventListener('click', function () {
        if (!window.DealPilotBrandingEditor) { toast('Editor konnte nicht geladen werden'); return; }
        window.DealPilotBrandingEditor.open({
          accent: _v('rp-b-accent'), obsidian: _v('rp-b-obsidian'), mail: _v('rp-b-mail'),
          name: _v('rp-b-name') || 'Deine Kanzlei', logo: _currentLogo()
        }, function (res) {
          if (!res) return;
          $('rp-b-accent').value = res.accent;
          $('rp-b-obsidian').value = res.obsidian;
          $('rp-b-mail').value = res.mail;
          var dot = $('rp-b-dot'); if (dot) dot.style.background = res.accent;
          upd();
          toast('Übernommen — jetzt noch „Branding speichern"');
        });
      });
      $('rp-b-logo').addEventListener('change', function (e) { _brandLogoPick(e, upd); });
      $('rp-b-logo-x').addEventListener('click', function () { _brandState.logo = ''; var f = $('rp-b-logo'); if (f) f.value = ''; upd(); });
      ['rp-b-company','rp-b-address','rp-b-plz','rp-b-city','rp-b-phone','rp-b-email','rp-b-website','rp-b-tagline']
        .forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', _footPreview); });
      _footPreview();
      (function () {
        var pv = $('rp-b-prev'); if (!pv) return;
        var on = false;
        try { on = localStorage.getItem('dp_wl_preview') === '1'; } catch (e) {}
        pv.checked = on;
        if (on) _applyPreview();
        pv.addEventListener('change', function () {
          try { localStorage.setItem('dp_wl_preview', pv.checked ? '1' : '0'); } catch (e) {}
          if (pv.checked) { _applyPreview(); toast('Ansicht deiner Mandanten aktiv'); }
          else { location.reload(); }   // sauber zurueck = neu laden
        });
      })();
      $('rp-b-save').addEventListener('click', saveBranding);
      _brandPreview();
    } catch (e) { w.innerHTML = '<p class="rp-ph">Branding konnte nicht geladen werden.</p>'; }
  }
  function _brandLogoPick(e, cb) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 300 * 1024) { toast('Logo zu groß (max ~300 KB)'); e.target.value = ''; return; }
    var rd = new FileReader();
    rd.onload = function () { _brandState.logo = rd.result; if (cb) cb(); };
    rd.readAsDataURL(f);
  }
  function _brandPreview() {
    var host = $('rp-b-preview'); if (!host) return;
    var wl = $('rp-b-wl') && $('rp-b-wl').checked;
    var name = ($('rp-b-name') || {}).value || 'Deine Kanzlei';
    var accent = ($('rp-b-accent') || {}).value || '#C9A84C';
    var obsidian = ($('rp-b-obsidian') || {}).value || '#0b0b0a';
    var logo = _currentLogo();
    var brandName = wl ? name : 'DealPilot';
    var head = (wl && logo) ? '<img src="' + esc(logo) + '" style="max-height:40px">' : '<div style="font:700 20px Georgia,serif;color:#fff">' + esc(brandName) + '</div>';
    host.innerHTML =
      '<div style="max-width:440px;border:1px solid #e6e0d4;border-radius:12px;overflow:hidden">' +
        '<div style="background:' + esc(wl ? obsidian : '#0b0b0a') + ';padding:16px 18px">' + head + '</div>' +
        '<div style="height:4px;background:' + esc(accent) + '"></div>' +
        '<div style="padding:18px;background:#fff">' +
          '<div style="font-size:13px;color:#3a352c"><b>' + esc(brandName) + '</b> lädt dich zu DealPilot ein.</div>' +
          '<div style="margin-top:12px"><span style="background:' + esc(accent) + ';color:#241c05;font-weight:700;padding:9px 16px;border-radius:8px;font-size:13px;display:inline-block">Einladung annehmen</span></div>' +
        '</div></div>';
  }
  function _v(id) { var el = $(id); return el && el.value ? String(el.value).trim() : ''; }
  function _footPreview() {
    var host = $('rp-b-foot'); if (!host) return;
    var comp = _v('rp-b-company') || _v('rp-b-name') || 'Deine Kanzlei';
    var line2 = [_v('rp-b-address'), [_v('rp-b-plz'), _v('rp-b-city')].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    var line3 = [_v('rp-b-phone'), _v('rp-b-email'), _v('rp-b-website')].filter(Boolean).join(' · ');
    host.innerHTML = '<b style="color:#3a352c">So sieht der PDF-Footer beim Mandanten aus:</b><br>' +
      '<span style="color:#2a2727;font-weight:600">' + esc(comp) + '</span>' +
      (_v('rp-b-tagline') ? '<br>' + esc(_v('rp-b-tagline')) : '') +
      (line2 ? '<br>' + esc(line2) : '') +
      (line3 ? '<br>' + esc(line3) : '') +
      (!line2 && !line3 ? '<br><i style="color:#b8625c">Noch keine Kontaktdaten — der Footer bleibt leer.</i>' : '');
  }
  /* W7-livepreview: las vorher das beim Tab-Oeffnen geladene Objekt -> ein
     Farbwechsel im Waehler kam nie an (W6-Bug). Jetzt LIVE aus dem Formular. */
  function _previewOn() { var el = $('rp-b-prev'); return !!(el && el.checked); }
  function _applyPreview() {
    try {
      if (!window.DealPilotWhitelabel) return;
      var acc = _v('rp-b-accent');
      if (!/^#[0-9a-fA-F]{6}$/.test(acc)) return;
      var obs = _v('rp-b-obsidian');
      window.DealPilotWhitelabel.apply({
        accent: acc,
        obsidian: /^#[0-9a-fA-F]{6}$/.test(obs) ? obs : null
      });
    } catch (e) {}
  }
  async function saveBranding() {
    var body = {
      brand_name: ($('rp-b-name') || {}).value || '',
      whitelabel_enabled: !!($('rp-b-wl') && $('rp-b-wl').checked),
      brand_accent: ($('rp-b-accent') || {}).value || '',
      brand_obsidian: ($('rp-b-obsidian') || {}).value || ''
    };
    if (_brandState.logo !== undefined) body.brand_logo_b64 = _brandState.logo;
    try {
      await api('/branding', { method: 'PUT', body: body });
      /* W1b-contact-ui: Kontaktdaten ueber die eigene Route (laesst Logo-/Accent-Logik unangetastet) */
      await api('/branding-contact', { method: 'PUT', body: {
        brand_company: _v('rp-b-company'), brand_tagline: _v('rp-b-tagline'),
        brand_address: _v('rp-b-address'), brand_plz: _v('rp-b-plz'), brand_city: _v('rp-b-city'),
        brand_phone: _v('rp-b-phone'), brand_email: _v('rp-b-email'), brand_website: _v('rp-b-website'),
        brand_mail_accent: _v('rp-b-mail')   /*W8-editor*/
      } });
      toast('✓ Branding gespeichert');
      try { if (_previewOn()) _applyPreview(); } catch (e) {}   /*W7-livepreview*/
      if (_brandState.logo !== undefined) { _brandState.current_logo = _brandState.logo; _brandState.logo = undefined; }
    } catch (e) { toast(e && e.status === 413 ? 'Logo zu groß (max ~300 KB)' : 'Speichern fehlgeschlagen'); }
  }

  // ── Einladung annehmen (läuft für ALLE User, auch Mandanten ohne Partner-Plan) ──
  async function handleInvite() {
    var token = null;
    try {
      var q = new URLSearchParams(location.search);
      token = q.get('rp_invite');
      if (token) { try { localStorage.setItem('rp_invite_token', token); } catch (e) {} }
      else { try { token = localStorage.getItem('rp_invite_token'); } catch (e) {} }
    } catch (e) {}
    if (!token) return;

    var loggedIn = false;
    try { loggedIn = !!localStorage.getItem('ji_token'); } catch (e) {}

    if (loggedIn) {
      try {
        var r = await Auth.apiCall('/reseller-invite/accept', { method: 'POST', body: { token: token } });
        try { localStorage.removeItem('rp_invite_token'); } catch (e) {}
        toast('✓ Einladung von ' + (r && r.brand_name ? r.brand_name : 'deinem Partner') + ' angenommen' + (r && r.seat_assigned ? ' — Lizenz zugewiesen' : ''));
        try { var q2 = new URLSearchParams(location.search); q2.delete('rp_invite'); history.replaceState({}, '', location.pathname + (q2.toString() ? '?' + q2.toString() : '')); } catch (e) {}
      } catch (e) {
        if (e && (e.status === 409 || e.status === 410 || e.status === 404)) { try { localStorage.removeItem('rp_invite_token'); } catch (_) {} }
      }
    } else {
      showInviteBanner(token);
    }
  }
  async function showInviteBanner(token) {
    try {
      if (document.getElementById('rp-invite-banner')) { startAcceptWatcher(token); return; }
      var resp = await fetch('/api/v1/reseller-invite/info?token=' + encodeURIComponent(token));
      if (!resp.ok) return;
      var info = await resp.json();
      if (!info || !info.valid) return;
      var b = document.createElement('div');
      b.id = 'rp-invite-banner';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#0b0b0a;color:#fff;border-top:2px solid #C9A84C;padding:14px 22px;display:flex;align-items:center;gap:12px;font-family:Inter,sans-serif;font-size:13.5px;flex-wrap:wrap';
      b.innerHTML = '<span style="flex:1;min-width:220px"><b style="color:#E8CC7A">' + esc(info.brand_name) + '</b> hat dich zu DealPilot eingeladen. Leg ein Konto mit <b>' + esc(info.email) + '</b> an, um loszulegen.</span>' +
        '<button id="rp-inv-reg" style="background:linear-gradient(105deg,#E8CC7A,#C9A84C,#b8932f);color:#241c05;border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;font-family:inherit">Konto anlegen</button>' +
        '<button id="rp-inv-login" style="background:none;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;padding:9px 14px;cursor:pointer;font-family:inherit">Schon ein Konto</button>' +
        '<button id="rp-inv-x" style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:18px;font-family:inherit">✕</button>';
      document.body.appendChild(b);
      document.getElementById('rp-inv-reg').addEventListener('click', function () { openAuth('register', info); });
      document.getElementById('rp-inv-login').addEventListener('click', function () { openAuth('login', info); });
      document.getElementById('rp-inv-x').addEventListener('click', function () { b.remove(); });
      startAcceptWatcher(token);
      // Direkt zur Registrierung (einmalig) — statt erst Login
      if (!_st._regAuto) { _st._regAuto = true; setTimeout(function () { openAuth('register', info); }, 500); }
    } catch (e) {}
  }
  function openAuth(mode, info) {
    try {
      if (mode === 'register') {
        var opened = false;
        if (typeof window._v10OpenRegister === 'function') { window._v10OpenRegister(); opened = true; }
        else if (window.RegisterModal && window.RegisterModal.show) { window.RegisterModal.show(); opened = true; }
        else if (window.DealPilotRegister && window.DealPilotRegister.show) { window.DealPilotRegister.show(); opened = true; }
        if (!opened) { location.href = '/?register=1'; return; }
        // E-Mail best-effort vorausfüllen (Register-Modal hat eigene Feld-IDs)
        setTimeout(function () {
          try {
            var scope = document.querySelector('#dp-register-modal, [data-register-modal], #auth-modal') || document;
            var em = scope.querySelector('input[type=email]'); if (em && info && info.email && !em.value) em.value = info.email;
            var nm = scope.querySelector('input[name=name], #auth-name'); if (nm && info && info.display_name && !nm.value) nm.value = info.display_name;
          } catch (e) {}
        }, 250);
        return;
      }
      // Login
      if (typeof window.showAuthModal === 'function') {
        window.showAuthModal('login');
        setTimeout(function () { var em = document.getElementById('auth-email'); if (em && info && info.email) em.value = info.email; }, 130);
      } else { toast('Bitte oben anmelden'); }
    } catch (e) {}
  }
  var _acceptWatch = null;
  function startAcceptWatcher(token) {
    if (_acceptWatch) return;
    var tries = 0;
    _acceptWatch = setInterval(function () {
      tries++;
      var loggedIn = false; try { loggedIn = !!localStorage.getItem('ji_token'); } catch (e) {}
      if (loggedIn) {
        clearInterval(_acceptWatch); _acceptWatch = null;
        Auth.apiCall('/reseller-invite/accept', { method: 'POST', body: { token: token } }).then(function (r) {
          try { localStorage.removeItem('rp_invite_token'); } catch (e) {}
          var bn = document.getElementById('rp-invite-banner'); if (bn) bn.remove();
          toast('✓ Einladung von ' + (r && r.brand_name ? r.brand_name : 'deinem Partner') + ' angenommen' + (r && r.seat_assigned ? ' — Lizenz zugewiesen' : ''));
          setTimeout(function () { location.reload(); }, 900);
        }).catch(function () {});
      }
      if (tries > 400) { clearInterval(_acceptWatch); _acceptWatch = null; }
    }, 1500);
  }

  // ── Boot ───────────────────────────────────────────────────
  var _mo = new MutationObserver(function () { if (_st.gated) { try { ensureEntry(); } catch (e) {} } });
  async function boot() {
    try {
      await handleInvite();
      _st.gated = await isPartner(); if (!_st.gated) return false;
      fixPlanLabel();
      handleReturn();
      _mo.observe(document.body, { childList: true, subtree: true });
      ensureEntry();
      return true;
    } catch (e) { return false; }
  }
  /* W7-bootretry: boot() lief GENAU EINMAL. isPartner() wartet auf Sub.getCurrent() —
     ist Auth.isLoggedIn() da noch nicht bereit, liefert getCurrent() das synthetische
     'free' OHNE Fetch -> _st.gated=false -> return -> der MutationObserver startete nie
     und ensureEntry() lief nie. Ergebnis: Partner-Portal erst nach Hard-Reload.
     Jetzt: nachfassen, bis der Plan wirklich bekannt ist. */
  async function _bootRetry(n) {
    if (_st.gated) return;
    var ok = await boot();
    if (ok || (n || 0) >= 6) return;
    setTimeout(function () { _bootRetry((n || 0) + 1); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { _bootRetry(0); });
  else _bootRetry(0);

  // Partner-Config SOFORT & ungated einspritzen (gegen Free->Partner-Race ohne Hard-Reload)
  function _earlyPill() {
    injectPartnerConfig();
    try { if (typeof window.renderSubscriptionBadge === 'function') window.renderSubscriptionBadge(); } catch (e) {}
  }
  _earlyPill();
  [400, 1200, 2500, 4000].forEach(function (ms) { setTimeout(_earlyPill, ms); });

  window.openResellerPortal = openResellerPortal;
  window.DealPilotResellerPortal = { boot: boot, open: openResellerPortal };
})();
