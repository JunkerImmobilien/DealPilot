'use strict';
/* W40-pdf-svg: jsPDF kennt kein CSS — dort stehen RGB-Tripel. Im Hauptdokument
   liefert pdf.js seine Palette (W1) und _dpPdfSetAccent() mutiert C.GOLD in
   place. Im Marktbericht-iframe gibt es pdf.js nicht — dort faellt die Funktion
   auf --wl-c9a84c zurueck, das die Bruecke aus W36 setzt.
   Ohne Whitelabel: [201,168,76], also unveraendert. */
if (!window._pdfGold) {
  window._pdfGold = function () {
    try {
      var c = window._dpPdfColors;
      if (c && c.GOLD && c.GOLD.length === 3) return [c.GOLD[0], c.GOLD[1], c.GOLD[2]];
    } catch (e) {}
    try {
      var v = (getComputedStyle(document.documentElement).getPropertyValue('--wl-c9a84c') || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
      }
    } catch (e) {}
    return [201, 168, 76];
  };
}

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
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100001;background:#0b0b0a;color:#fff;border:1px solid var(--wl-c9a84c, #C9A84C);border-radius:10px;padding:12px 20px;font:600 13.5px Inter;box-shadow:0 12px 40px rgba(0,0,0,.5);max-width:80vw;text-align:center;pointer-events:none';
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
      '.rp-modal{width:100%;max-width:1080px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);box-shadow:0 40px 100px rgba(0,0,0,.6);display:flex;flex-direction:column}',
      '.rp-bar{background:#0b0b0a;display:flex;align-items:center;padding:14px 22px}',
      '.rp-logo{font:700 18px "Space Grotesk";color:#fff}.rp-logo b{color:var(--rp-akzent-dunkel, var(--wl-c9a84c, #C9A84C))}',
      '.rp-ctx{margin-left:auto;font:600 11px "JetBrains Mono";letter-spacing:.22em;color:var(--rp-akzent-dunkel, var(--wl-c9a84c, #C9A84C));text-transform:uppercase}',
      '.rp-x{margin-left:20px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.15);color:#fff;font-size:15px;cursor:pointer;background:none}',
      '.rp-hero{background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 52%,var(--wl-b8932f, #b8932f));padding:20px 28px}',
      '.rp-hero h1{font:600 28px "Cormorant Garamond",serif;color:var(--rp-tinte, #241c05);line-height:1.05}',
      '.rp-hero p{font-size:12.5px;color:var(--rp-tinte-2, #3a2e08);margin-top:2px}',
      '.rp-body{display:flex;flex:1;min-height:0}',
      '.rp-side{width:238px;flex-shrink:0;background:#0d0d0c;padding:13px 11px;display:flex;flex-direction:column}',
      '.rp-nav{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:9px;margin-bottom:3px;cursor:pointer;background:none;border:none;text-align:left;width:100%}',
      '.rp-nav svg{width:17px;height:17px;stroke:#9a9284;stroke-width:1.6;fill:none;flex-shrink:0}',
      '.rp-nav .t{font:600 13px "Space Grotesk";color:rgba(255,255,255,.82)}',
      '.rp-nav .s{font-size:10.5px;color:rgba(255,255,255,.38);margin-top:1px}',
      '.rp-nav:hover{background:rgba(255,255,255,.04)}',
      '.rp-nav.on{background:#161511;box-shadow:inset 2px 0 0 var(--rp-akzent-dunkel, var(--wl-c9a84c, #C9A84C))}.rp-nav.on svg{stroke:var(--rp-akzent-dunkel, var(--wl-c9a84c, #C9A84C))}.rp-nav.on .t{color:var(--rp-akzent-dunkel, var(--wl-c9a84c, #C9A84C))}',
      '.rp-work{flex:1;background:#fff;padding:24px 30px;overflow-y:auto}',
      '.rp-intro{font-size:13px;color:#6f685d;font-style:italic;margin-bottom:22px}',
      '.rp-label{font:600 10.5px "JetBrains Mono";letter-spacing:.16em;text-transform:uppercase;color:var(--wl-9a7f3a, #9a7f3a);margin:0 0 14px}',
      '.rp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}',
      '.rp-stat{border:1px solid #e6e0d4;border-radius:13px;padding:16px 18px;background:#FDFCFA}',
      '.rp-stat .l{font:600 9.5px "JetBrains Mono";letter-spacing:.12em;text-transform:uppercase;color:#9a9284}',
      '.rp-stat .v{font:600 30px "Space Grotesk";margin-top:6px}.rp-stat.zug .v{color:#3FA56C}.rp-stat.frei .v{color:var(--wl-b8932f, #b8932f)}',
      '.rp-poolbar{height:9px;border-radius:5px;background:#efe9dc;overflow:hidden;display:flex;border:1px solid #e6e0d4}',
      '.rp-poolbar i{display:block;height:100%}.rp-poolbar .z{background:#3FA56C}.rp-poolbar .f{background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C),var(--wl-b8932f, #b8932f))}',
      '.rp-buy{margin-top:20px;background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 52%,var(--wl-b8932f, #b8932f));color:var(--rp-tinte, #241c05);font:700 13.5px Inter;padding:12px 20px;border-radius:10px;border:none;cursor:pointer}',
      '.rp-panel{border:1px solid #e6e0d4;border-radius:14px;padding:20px 22px;margin-top:18px}',
      '.rp-row{display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}',
      '.rp-fl{font:600 9.5px "JetBrains Mono";letter-spacing:.1em;text-transform:uppercase;color:#9a9284;margin-bottom:8px}',
      '.rp-seg{display:inline-flex;background:#f1ece0;border-radius:9px;padding:3px;border:1px solid #e6e0d4}',
      '.rp-seg button{padding:8px 14px;font:600 12.5px Inter;border-radius:7px;color:#6f685d;border:none;background:none;cursor:pointer}.rp-seg button.on{background:var(--wl-c9a84c, #C9A84C);color:var(--rp-tinte, #241c05)}',
      '.rp-step{display:flex;border:1px solid #e6e0d4;border-radius:9px;overflow:hidden}',
      '.rp-step button{width:38px;height:42px;font-size:19px;color:var(--wl-b8932f, #b8932f);background:#f7f2e8;border:none;cursor:pointer}',
      '.rp-step input{width:54px;height:42px;text-align:center;border:none;font:600 16px "JetBrains Mono";outline:none;color:#1c1a17}',
      '.rp-price{margin-left:auto;text-align:right}.rp-price .per{font-size:12px;color:#6f685d}.rp-price .per b{color:var(--wl-b8932f, #b8932f);font-family:"JetBrains Mono"}',
      '.rp-price .tot{font:600 24px "Space Grotesk";margin-top:2px}.rp-price .tot small{font-size:13px;color:#6f685d;font-weight:400}',
      '.rp-buyfoot{display:flex;align-items:center;gap:14px;margin-top:18px;padding-top:16px;border-top:1px solid #e6e0d4}',
      '.rp-staffel{font-size:11.5px;color:#6f685d;line-height:1.6}.rp-staffel b{color:#1c1a17}',
      '.rp-checkout{margin-left:auto;background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C),var(--wl-b8932f, #b8932f));color:var(--rp-tinte, #241c05);font:700 13px Inter;padding:11px 20px;border-radius:9px;border:none;cursor:pointer}',
      '.rp-mrow{display:flex;align-items:center;gap:15px;padding:14px 4px;border-bottom:1px solid #e6e0d4}.rp-mrow:last-child{border-bottom:none}',
      '.rp-av{width:38px;height:38px;border-radius:10px;background:var(--wl-f6ecd0, #f6ecd0);color:var(--wl-b8932f, #b8932f);display:flex;align-items:center;justify-content:center;font:600 14px "Space Grotesk";flex-shrink:0}',
      '.rp-nm{font:600 14px "Space Grotesk"}.rp-mt{font-size:12px;color:#6f685d;margin-top:2px}',
      '.rp-mr{margin-left:auto;display:flex;align-items:center;gap:14px}',
      '.rp-seat{font:600 10px "JetBrains Mono";padding:5px 11px;border-radius:20px;white-space:nowrap}.rp-seat.on{background:#e2f0e6;color:#3FA56C}.rp-seat.off{background:#f0ece2;color:#6f685d}',
      '.rp-act{font:600 12.5px Inter;padding:8px 14px;border-radius:8px;border:1px solid #e6e0d4;background:#fff;cursor:pointer;white-space:nowrap}.rp-act.assign{color:var(--wl-b8932f, #b8932f)}.rp-act.remove{color:#B86250;border-color:#e6cbc5}',
      '.rp-add{border:1px solid #e6e0d4;color:var(--wl-b8932f, #b8932f);font:600 12.5px Inter;padding:8px 14px;border-radius:8px;background:#fff;cursor:pointer;float:right}',
      '.rp-share{border:1px solid #e6e0d4;border-radius:12px;padding:16px 18px;margin-bottom:11px;display:flex;align-items:center;gap:15px;background:#FDFCFA}',
      '.rp-bg{font:600 9.5px "JetBrains Mono";letter-spacing:.06em;background:#fbeed8;color:#c8791f;padding:4px 9px;border-radius:6px;margin-left:auto}',
      '.rp-ph{color:#9a9284;font-size:13px;padding:30px 0;text-align:center;font-style:italic}',
      '.rp-foot{background:#FAF7F0;border-top:1px solid #e6e0d4;padding:12px 28px;display:flex;align-items:center;gap:12px}',
      '.rp-foot .st{font-size:12px;color:#6f685d;display:flex;align-items:center;gap:8px}.rp-foot .st .d{width:8px;height:8px;border-radius:50%;background:#3FA56C}',
      '.rp-foot .close{margin-left:auto;border:1px solid #e6e0d4;background:#fff;font:600 13px Inter;padding:9px 18px;border-radius:9px;cursor:pointer}',
      '.rp-sec{display:none}.rp-sec.on{display:block}',
      /* v1112b-rp-mobile: Diese Datei hatte KEINE einzige Media-Query — das
         Partner-Portal war nie fuer das Handy gebaut. Gemessen bei 370 px:
         .rp-ov traegt padding:22px und align-items:center, .rp-modal hat
         width:100% mit flex-shrink:1 -> 325,6 px statt 370. Im .rp-body
         (flex-row) haelt .rp-side ihre festen 238 px mit flex-shrink:0,
         fuer .rp-work bleiben 86 px: der Text bricht auf EIN Wort je Zeile,
         Zahlen laufen aus der Kachel. Derselbe Sachverhalt wie v1112 im
         Einstellungs-Modal, nur ein anderes Modal.
         Fix: Vollbild, Navigation als waagerecht scrollbare Leiste oben,
         Arbeitsflaeche darunter ueber die volle Breite. 44-px-Trefferflaeche
         aus v650/v652 gehalten. */
      '@media (max-width:768px){',
      '  .rp-ov{padding:0!important;align-items:stretch!important;justify-content:stretch!important}',
      '  .rp-modal{width:100%!important;max-width:100%!important;max-height:100dvh!important;height:100dvh!important;border-radius:0!important;border:none!important;flex:1 1 auto!important}',
      '  .rp-hero{padding:14px 16px!important}',
      '  .rp-hero h1{font-size:22px!important}',
      '  .rp-bar{padding:12px 16px!important}',
      '  .rp-body{flex-direction:column!important}',
      '  .rp-side{width:100%!important;flex:0 0 auto!important;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;padding:8px 10px!important;gap:6px!important;-webkit-overflow-scrolling:touch}',
      '  .rp-nav{width:auto!important;flex:0 0 auto!important;min-width:44px!important;min-height:44px!important;white-space:nowrap!important;margin-bottom:0!important;padding:9px 12px!important}',
      '  .rp-nav .s{display:none!important}',
      '  .rp-nav.on{box-shadow:inset 0 -2px 0 var(--wl-c9a84c, #C9A84C)!important}',
      '  .rp-work{flex:1 1 auto!important;min-height:0!important;padding:18px 16px!important}',
      '  .rp-foot{padding:10px 16px!important}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  var META = {
    ueber: ['Übersicht & Lizenz-Pool', 'Seats kaufen und an deine Mandanten verteilen.'],
    mand: ['Mandanten', 'Kunden verwalten und Seats zuweisen.'],
    frei: ['Freigaben', 'Eingereichte Objekte prüfen und bestätigen.'],
    ueberg: ['Objekte übergeben', 'Durchgerechnete Objekte per E-Mail an Kunden übergeben.'],   /* v3317 */
    brand: ['Branding', 'Whitelabel — Farben, Logo, Subdomain.'],
    abr: ['Abrechnung', 'Dein Partner-Abo und die Seat-Abrechnung.']
  };

  // ── Modal öffnen ───────────────────────────────────────────
  /* v3301 · Text auf Akzentflaechen (Hero, Kauf-Knopf, Segment): der Partner
     sieht das Portal jetzt in SEINER Farbe. Dunkler Text (#241c05) war fuer
     Gold gebaut - auf Bordeaux waere er unlesbar. Je nach Akzent hell oder
     dunkel, gemessen nach WCAG (>= 4,5 : 1 fuer dunkel, sonst weiss). */
  function _rpTinte() {
    try {
      var cs = getComputedStyle(document.documentElement);
      var a = (cs.getPropertyValue('--wl-c9a84c') || cs.getPropertyValue('--gold') || '').trim();
      var r = document.documentElement.style;
      if (!/^#[0-9a-f]{6}$/i.test(a)) { r.removeProperty('--rp-tinte'); r.removeProperty('--rp-tinte-2'); return; }
      var lum = function (h) {
        var c = [1, 3, 5].map(function (i) { var x = parseInt(h.substr(i, 2), 16) / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      var la = lum(a), ld = lum('#241c05');
      var dunkel = (Math.max(la, ld) + 0.05) / (Math.min(la, ld) + 0.05) >= 4.5;
      if (dunkel) { r.removeProperty('--rp-tinte'); r.removeProperty('--rp-tinte-2'); }
      else { r.setProperty('--rp-tinte', '#ffffff'); r.setProperty('--rp-tinte-2', 'rgba(255,255,255,.86)'); }
      /* Akzent als Schrift auf der schwarzen Leiste/Seitenleiste: bei dunklem
         Partnerakzent (Bordeaux auf #161511 ~1,6 : 1) der fuer dunklen Grund
         aufgehellte Ton --gold-2 (whitelabel-override, tonAufDunkel). Nur mit
         Whitelabel - ohne bleibt es das Gold von heute. */
      var wl = (cs.getPropertyValue('--wl-c9a84c') || '').trim();
      var g2 = (cs.getPropertyValue('--gold-2') || '').trim();
      if (wl && g2) r.setProperty('--rp-akzent-dunkel', g2); else r.removeProperty('--rp-akzent-dunkel');
    } catch (e) {}
  }
  window._rpTinte = _rpTinte;

  /* v3392 · Das Partner-Cockpit (partner-kunden.js, Reiter „Verwaltung“) baut seine Oberflaeche selbst (Marcel 15.11.2026:
     „sieht aus, als haettest du es einfach so uebernommen“). Von hier holt es nur die LOGIK: Pool, Staffel, Kauf,
     und das Marken-Formular (loadBranding in ein fremdes Ziel, Speichern unveraendert ueber saveBranding).
     Die v3390-Einbettung des ganzen Portals ist damit entfallen. */
  async function poolHolen() { var r = await api('/pool?refresh=1'); _st.pool = r.pool || { gekauft: 0, zugewiesen: 0, frei: 0 }; return _st.pool; }
  function seatsKaufen(qty, iv) { _st.qty = Math.max(1, parseInt(qty, 10) || 1); _st.iv = iv === 'yearly' ? 'yearly' : 'monthly'; return doCheckout(); }
  /* v3500 · Übergeben im Partner-Cockpit (Reiter Übergeben): dieselbe Strecke, fremdes Ziel */
  function uebergabeZeichnen(ziel) { if (!ziel) return; injectCss(); _rpTinte(); _st.uebZiel = ziel; return loadUebergaben(); }
  function markeZeichnen(ziel) { if (!ziel) return; injectCss(); _rpTinte(); _st.markeZiel = ziel; return loadBranding(); }
  function geruest() {
    return '<div class="rp-modal" role="dialog" aria-modal="true">' +
        '<div class="rp-bar"><span class="rp-logo">Deal<b>Pilot</b></span><span class="rp-ctx">Partner-Portal</span><button class="rp-x" id="rp-close">✕</button></div>' +
        '<div class="rp-hero"><h1 id="rp-htitle">Übersicht &amp; Lizenz-Pool</h1><p id="rp-hsub">Seats kaufen und an deine Mandanten verteilen.</p></div>' +
        '<div class="rp-body">' +
          '<div class="rp-side">' +
            nav('ueber', 'Übersicht', 'Lizenz-Pool, Seats', '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>') +
            nav('mand', 'Mandanten', 'Kunden, Seat-Zuweisung', '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>') +
            nav('frei', 'Freigaben', 'Objekte prüfen', '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>') +
            nav('ueberg', 'Übergeben', 'Objekt an Kunden', '<path d="M4 12h13M12 6l6 6-6 6"/><path d="M20 4v16"/>') +   /* v3317 */
            nav('brand', 'Branding', 'Whitelabel, Logo', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2 2M17 17l2 2M2 12h3M19 12h3"/>') +
            nav('abr', 'Abrechnung', 'Abo & Rechnungen', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>') +
          '</div>' +
          '<div class="rp-work" id="rp-work"></div>' +
        '</div>' +
        '<div class="rp-foot"><span class="st"><span class="d"></span>Partner-Plan aktiv</span><button class="close" id="rp-close2">Schließen</button></div>' +
      '</div>';
  }
  function openResellerPortal(alsFenster) {
    /* v3390 · gibt es das Partner-Cockpit, fuehrt der Weg dort in den Reiter „Verwaltung“ statt ins Fenster.
       v3392 · alsFenster === true nur noch fuer „Übergeben“ aus dem Objekt (steht in keinem Cockpit-Reiter). */
    if (alsFenster !== true && window.DpPartnerKunden && typeof DpPartnerKunden.reiterWahl === 'function' && window.DealPilotAnsichten && DpPartnerKunden._state && DpPartnerKunden._state.partner) {
      try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (e) {}
      DpPartnerKunden.reiterWahl('verwaltung'); return;
    }
    if (_st.open) return;
    injectCss();
    _rpTinte();
    var ov = document.createElement('div'); ov.className = 'rp-ov'; ov.id = 'rp-overlay';
    ov.innerHTML = geruest();
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
    _st.sec = s; _st.markeZiel = null;   /* v3392 · im Fenster zeichnet loadBranding wieder in #rp-work */
    var ov = $('rp-overlay'); if (!ov) return;
    ov.querySelectorAll('.rp-nav').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === s); });
    $('rp-htitle').textContent = META[s][0]; $('rp-hsub').textContent = META[s][1];
    if (s === 'ueber') loadOverview();
    else if (s === 'mand') loadMandanten();
    else if (s === 'frei') loadFreigaben();
    else if (s === 'ueberg') loadUebergaben();   /* v3317 */
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
        '<div class="rp-buyfoot"><div class="rp-staffel">' + staffelText()
          + '<br>Der Stückpreis gilt für alle Seats.'
          /* v3303 · Marcel 11.11.2026: keine Plaetze mehr im Partner-Paket enthalten */
          + '<br>Im Partner-Paket ist kein Mandanten-Platz enthalten \u2014 jeden Platz buchen Sie hier dazu.</div>' +
        '<button class="rp-checkout" id="rp-checkout">Zur Kasse (Stripe)</button></div></div>';
    box.querySelectorAll('.rp-seg button').forEach(function (b) { b.addEventListener('click', function () { _st.iv = b.getAttribute('data-iv'); box.querySelectorAll('.rp-seg button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); calcPrice(); }); });
    $('rp-minus').addEventListener('click', function () { _st.qty = Math.max(1, _st.qty - 1); $('rp-qty').value = _st.qty; calcPrice(); });
    $('rp-plus').addEventListener('click', function () { _st.qty += 1; $('rp-qty').value = _st.qty; calcPrice(); });
    $('rp-checkout').addEventListener('click', doCheckout);
    calcPrice();
  }
  /* ═══ v1535 · Marcel 22.09.2026 ═══════════════════════════════════════
     Gemessen am 22.09.2026: der Hinweistext im Kaufpanel sagte
     "1-9 -> 19 EUR", der Rechner zwei Zeilen darunter rechnete mit
     35/29/24 - der ALTEN Staffel von vor v1423. Wer fuenf Seats waehlte,
     las 175 EUR und bekam 95 EUR abgebucht (5 x 19).
     Gegengeprueft in Stripe (beide Konten, lookup_key dp_seat_monthly):
     Volume-Staffel 19/15/12, jaehrlich 209/165/132 - also elf Monatsraten,
     ein Freimonat. Der Rechner nahm m*10, also zehn.
     Die Staffel steht jetzt EINMAL in STAFFEL; Text und Summe lesen
     dieselbe Liste. Abgerechnet wird ohnehin der Stripe-Preis - diese
     Zahlen sind reine Vorschau und muessen deshalb zu ihm passen. */
  var STAFFEL = [
    { bis: 9,        monat: 19, jahr: 209 },
    { bis: 24,       monat: 15, jahr: 165 },
    { bis: Infinity, monat: 12, jahr: 132 },
  ];
  function staffelSatz(q, iv) {
    for (var i = 0; i < STAFFEL.length; i++) {
      if (q <= STAFFEL[i].bis) return iv === 'yearly' ? STAFFEL[i].jahr : STAFFEL[i].monat;
    }
    return STAFFEL[STAFFEL.length - 1][iv === 'yearly' ? 'jahr' : 'monat'];
  }
  function staffelText() {
    return 'Volume-Staffel: <b>1\u20139 \u2192 ' + STAFFEL[0].monat + ' \u20ac</b> \u00b7 '
      + '<b>10\u201324 \u2192 ' + STAFFEL[1].monat + ' \u20ac</b> \u00b7 '
      + '<b>25+ \u2192 ' + STAFFEL[2].monat + ' \u20ac</b>';
  }
  function calcPrice() {
    var q = _st.qty, per = staffelSatz(q, _st.iv), tot = per * q;
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

  // ── v3317 · Objekte an Kunden übergeben (services/objektUebergabe.js) ──
  /* Marcel 12.11.2026: Partner rechnet ein Objekt durch und übergibt es per E-Mail.
     Der Kunde bekommt eine Mail in Partnermarke und eine KOPIE in sein Konto.
     Vor dem Senden fragt das Portal den Server, ob die Adresse schon Mandant ist
     und ob ein Platz frei ist - ein neuer Kunde braucht einen. */
  var UEB_STATUS = {
    gesendet:    ['GESENDET', 'background:#f0ece2;color:#6f685d'],
    geoeffnet:   ['GEÖFFNET', 'background:#fbeed8;color:#c8791f'],
    uebernommen: ['ÜBERNOMMEN', 'background:#e2f0e6;color:#3FA56C'],
    widerrufen:  ['WIDERRUFEN', 'background:#fbeeec;color:#B86250'],
    abgelaufen:  ['ABGELAUFEN', 'background:#f0ece2;color:#9a9284']
  };
  var UEB_FEHLER = {
    kein_freier_platz: 'Kein freier Platz: Diese Adresse ist noch kein Mandant. Kauf zuerst einen Platz (Übersicht › Seats kaufen).',
    objekt_nicht_gefunden: 'Das Objekt gehört nicht zu deinem Konto.',
    email_ungueltig: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    eigene_adresse: 'Das ist deine eigene Adresse.',
    tagesgrenze: 'Für heute sind genug Übergaben verschickt - bitte morgen weiter.',
    kein_partner: 'Nur Partner dürfen Objekte übergeben.'
  };
  function _uebDatum(s) { try { return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } }
  var _uebVp = null;
  async function loadUebergaben() {
    var w = (_st.uebZiel && _st.uebZiel.isConnected) ? _st.uebZiel : $('rp-work'); if (!w) return; w.innerHTML = '<p class="rp-ph">Lade Übergaben…</p>';   /* v3500 · Ziel aus dem Partner-Cockpit (Reiter Übergeben) */
    try {
      var r = await api('/uebergaben');
      var or = await Auth.apiCall('/objects?limit=200');
      var objs = (or && (or.items || or.objects)) || [];
      var akt = window._currentObjKey || '';
      var wahl = _st.uebObj || (objs.some(function (o) { return o.id === akt; }) ? akt : (objs[0] ? objs[0].id : ''));
      var opts = objs.map(function (o) {
        var t = [o.seq_no, o.name || o.ort].filter(Boolean).join(' · ') + (o.dealpilot_score != null ? ' · Score ' + o.dealpilot_score : '') + (o.id === akt ? ' (gerade geöffnet)' : '');
        return '<option value="' + esc(o.id) + '"' + (o.id === wahl ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
      var inp = 'width:100%;padding:9px 11px;border:1px solid #e6e0d4;border-radius:8px;font:400 13px Inter;outline:none;box-sizing:border-box';
      var liste = (r.uebergaben || []).map(function (u) {
        var s = UEB_STATUS[u.status] || [String(u.status || '').toUpperCase(), ''];
        var zeit = u.status === 'uebernommen' ? 'übernommen ' + _uebDatum(u.uebernommen_at)
          : (u.status === 'geoeffnet' ? 'geöffnet ' + _uebDatum(u.geoeffnet_at) : 'gesendet ' + _uebDatum(u.created_at));
        var hinweis = u.mail_status === 'testadresse' ? 'Testadresse, keine Mail' : (u.mail_status === 'fehler' ? 'Mail nicht zugestellt' : '');
        var mt = [esc(u.anzeige_name ? u.anzeige_name + ' · ' + u.email : u.email), zeit, hinweis].filter(Boolean).join(' · ');
        var weg = (u.status === 'gesendet' || u.status === 'geoeffnet') ? '<button class="rp-act remove" data-uw="' + esc(u.id) + '">widerrufen</button>' : '';
        /* v3317b · mitgeschickter Platz */
        var platz = u.platz_reserviert ? '<span class="rp-bg" style="background:#e2f0e6;color:#3FA56C" title="Ein Platz ist für diese Übergabe reserviert. Widerruf oder Ablauf gibt ihn frei.">1 PLATZ RESERVIERT</span>' : '';
        return '<div class="rp-share"><div><div class="rp-nm">' + esc(u.adresse || 'Objekt') + (u.score != null ? ' <span style="font:500 12px Inter;color:#6f685d">· Score ' + esc(u.score) + '</span>' : '') + '</div>' +
          '<div class="rp-mt">' + mt + (u.platz_reserviert ? ' · 1 Platz reserviert für ' + esc(u.email) : '') + '</div></div>' +
          '<div style="margin-left:auto;display:flex;gap:8px;align-items:center">' + platz + '<span class="rp-bg" style="' + s[1] + '">' + s[0] + '</span>' + weg + '</div></div>';
      }).join('');
      w.innerHTML = '<p class="rp-intro">Ein durchgerechnetes Objekt per E-Mail an einen Kunden übergeben. Die Mail kommt in deiner Marke; der Kunde bekommt eine Kopie des Objekts in sein Konto. Ein neuer Kunde legt dabei ein Konto an und erhält einen freien Platz.</p>' +
        '<p class="rp-label">Objekt übergeben</p>' +
        (objs.length ? (
        '<div class="rp-panel" style="margin-top:0">' +
          '<div class="rp-fl">Objekt</div><select id="rp-ub-obj" style="' + inp + ';margin-bottom:14px">' + opts + '</select>' +
          '<div class="rp-row" style="align-items:flex-start">' +
            '<div style="flex:1;min-width:200px"><div class="rp-fl">E-Mail des Kunden</div><input id="rp-ub-email" type="email" autocomplete="off" style="' + inp + '"></div>' +
            '<div style="flex:1;min-width:200px"><div class="rp-fl">Name (optional, für die Anrede)</div><input id="rp-ub-name" style="' + inp + '"></div>' +
          '</div>' +
          '<div class="rp-fl" style="margin-top:14px">Persönlicher Satz (optional)</div><textarea id="rp-ub-satz" maxlength="600" rows="2" style="' + inp + ';resize:vertical" placeholder="z. B. Wie besprochen - schau dir die Zahlen in Ruhe an."></textarea>' +
          '<div id="rp-ub-vp" class="rp-staffel" style="margin-top:10px;min-height:18px"></div>' +
          /* v3317b · Kundenplatz mitschicken (nur neue Adresse mit freiem Platz) */
          '<label id="rp-ub-platz-wrap" style="display:none;align-items:center;gap:8px;margin-top:8px;font:500 13px Inter;color:#1c1a17;cursor:pointer">' +
            '<input type="checkbox" id="rp-ub-platz" style="width:16px;height:16px;accent-color:var(--wl-c9a84c, #C9A84C)"> Kundenplatz mitschicken <span style="color:#6f685d;font-weight:400">- wird beim Senden reserviert, der Zugang ist sofort freigeschaltet</span></label>' +
          '<div class="rp-buyfoot"><span class="rp-staffel">Der Link ist 30 Tage gültig und lässt sich einmal übernehmen. Du siehst unten, ob er geöffnet und übernommen wurde.</span>' +
            '<button class="rp-checkout" id="rp-ub-send">An Kunden übergeben</button>' +
            '<button class="rp-checkout" id="rp-ub-kauf2" style="display:none">Erst einen Platz kaufen →</button></div>' +
        '</div>') : '<p class="rp-ph">Noch keine eigenen Objekte. Leg zuerst ein Objekt an und rechne es durch.</p>') +
        '<p class="rp-label" style="margin-top:24px">Bisherige Übergaben' + (r.pool ? ' <span style="text-transform:none;letter-spacing:0;font:500 11.5px Inter;color:#6f685d;margin-left:8px">Plätze: ' + (r.pool.frei || 0) + ' frei · ' + (r.pool.reserviert || 0) + ' reserviert</span>' : '') + '</p>' + (liste || '<p class="rp-ph">Noch keine Übergaben.</p>');
      w.querySelectorAll('[data-uw]').forEach(function (b) { b.addEventListener('click', function () { uebWiderrufen(b.getAttribute('data-uw')); }); });
      var em = $('rp-ub-email'); if (em) em.addEventListener('input', function () { clearTimeout(_uebVp); _uebVp = setTimeout(uebVorpruefung, 450); });
      var sb = $('rp-ub-send'); if (sb) sb.addEventListener('click', uebSenden);
      /* v3317b · kein Platz: Verweis auf den vorhandenen Platz-Kauf (Übersicht › Seats kaufen) */
      var k2 = $('rp-ub-kauf2'); if (k2) k2.addEventListener('click', function () {
        /* v3500 · im Cockpit liegt der Platz-Kauf unter Verwaltung */
        if (_st.uebZiel && _st.uebZiel.isConnected && window.DpPartnerKunden) { DpPartnerKunden.reiterWahl('verwaltung'); return; }
        go('ueber'); setTimeout(function () { try { toggleBuy(); } catch (e) {} }, 400); });
    } catch (e) { w.innerHTML = '<p class="rp-ph">Übergaben konnten nicht geladen werden.</p>'; }
  }
  var _uebPlatzFuer = null;   /* v3317b · für welche Adresse das Häkchen vorbelegt wurde */
  async function uebVorpruefung() {
    var em = ($('rp-ub-email') || {}).value || '', box = $('rp-ub-vp'), sb = $('rp-ub-send'), k2 = $('rp-ub-kauf2'), pw = $('rp-ub-platz-wrap'), pc = $('rp-ub-platz'); if (!box) return null;
    /* v3317b · statt gesperrtem Knopf: ohne freien Platz steht dort der Weg zum Platz-Kauf */
    var knopf = function (senden) { if (sb) sb.style.display = senden ? '' : 'none'; if (k2) k2.style.display = senden ? 'none' : ''; };
    var haken = function (zeigen) {
      if (!pw) return; pw.style.display = zeigen ? 'flex' : 'none';
      if (zeigen && pc && _uebPlatzFuer !== em.trim().toLowerCase()) { pc.checked = true; _uebPlatzFuer = em.trim().toLowerCase(); }
    };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.trim())) { box.innerHTML = ''; knopf(true); haken(false); return null; }
    try {
      var v = await api('/uebergaben/vorpruefung?email=' + encodeURIComponent(em.trim()));
      if (v.bestehender_mandant) box.innerHTML = '<span style="color:#3FA56C">●</span> Bereits dein Mandant - die Kopie landet direkt in seinem Konto, ein Platz wird nicht gebraucht.';
      else if (v.frei > 0) box.innerHTML = '<span style="color:#3FA56C">●</span> Neuer Kunde: legt ein Konto an. Frei: ' + v.frei + (v.frei === 1 ? ' Platz' : ' Plätze') + (v.reserviert ? ', reserviert: ' + v.reserviert : '') + '.';
      else box.innerHTML = '<span style="color:#B86250">●</span> <b>Kein freier Platz.</b> Diese Adresse ist noch kein Mandant - kauf zuerst einen Platz' + (v.reserviert ? ' (' + v.reserviert + ' reserviert für offene Übergaben)' : '') + '.';
      knopf(v.kann_senden); haken(!!v.platz_moeglich);
      return v;
    } catch (e) { box.innerHTML = ''; return null; }
  }
  async function uebSenden() {
    var oid = ($('rp-ub-obj') || {}).value, em = (($('rp-ub-email') || {}).value || '').trim();
    var nm = (($('rp-ub-name') || {}).value || '').trim(), satz = (($('rp-ub-satz') || {}).value || '').trim();
    if (!oid || !em) { toast('Objekt und E-Mail nötig'); return; }
    var v = await uebVorpruefung();
    if (v && !v.kann_senden) { toast(UEB_FEHLER.kein_freier_platz); return; }
    var sb = $('rp-ub-send'); if (sb) { sb.disabled = true; sb.textContent = 'Sende…'; }
    try {
      var pw = $('rp-ub-platz-wrap'), pc = $('rp-ub-platz');
      var mitPlatz = !!(v && v.platz_moeglich && pw && pw.style.display !== 'none' && pc && pc.checked);   /* v3317b */
      var r = await api('/uebergaben', { method: 'POST', body: { objectId: oid, email: em, anzeigeName: nm, nachricht: satz, platzMitschicken: mitPlatz } });
      var st = r && r.mail && r.mail.status;
      toast(st === 'gesendet' ? '✓ Objekt an ' + em + ' übergeben' : (st === 'testadresse' ? 'Übergabe angelegt (Testadresse - keine Mail)' : 'Übergabe angelegt - Mail nicht versendet'));
      _st.uebObj = oid;
      loadUebergaben();
    } catch (e) {
      toast(UEB_FEHLER[e && e.message] || ('Übergabe fehlgeschlagen' + (e && e.message ? ': ' + e.message : '')));
      if (sb) { sb.disabled = false; sb.textContent = 'An Kunden übergeben'; }
    }
  }
  async function uebWiderrufen(id) {
    if (!window.confirm('Diese Übergabe widerrufen? Der Link in der Mail funktioniert dann nicht mehr.')) return;
    try { await api('/uebergaben/' + id + '/widerrufen', { method: 'POST', body: {} }); toast('Übergabe widerrufen'); loadUebergaben(); }
    catch (e) { toast('Widerruf fehlgeschlagen'); }
  }

  // ── Cross-Account: freigegebenes Objekt read-only anzeigen ──
  function _n(v) { var n = parseFloat(v); return (isNaN(n) || !isFinite(n)) ? null : n; }
  function _pick() { for (var i = 0; i < arguments.length; i++) { if (arguments[i] != null && arguments[i] !== '') return arguments[i]; } return null; }
  function _eur(v) { v = _n(v); return v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'; }
  function _pct(v) { v = _n(v); return v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %'; }
  function _num(v, d) { v = _n(v); return v == null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: d == null ? 2 : d }); }

  function _osCss() {
    _rpTinte();   /* v3301 */
    if ($('rp-os-css')) return;
    var s = document.createElement('style'); s.id = 'rp-os-css';
    s.textContent = [
      '.rp-os-ov{position:fixed;inset:0;z-index:100000;background:rgba(8,7,5,.7);display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(2px)}',
      '.rp-os{width:100%;max-width:760px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);box-shadow:0 40px 100px rgba(0,0,0,.6);display:flex;flex-direction:column}',
      '.rp-os-bar{background:#0b0b0a;display:flex;align-items:center;padding:14px 22px}',
      '.rp-os-bar .l{font:700 17px "Space Grotesk";color:#fff}.rp-os-bar .l b{color:var(--rp-akzent-dunkel, var(--wl-c9a84c, #C9A84C))}',
      '.rp-os-bar .x{margin-left:auto;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.15);color:#fff;font-size:15px;cursor:pointer;background:none}',
      '.rp-os-hero{background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 52%,var(--wl-b8932f, #b8932f));padding:18px 26px}',
      '.rp-os-hero h1{font:600 24px "Cormorant Garamond",serif;color:var(--rp-tinte, #241c05);line-height:1.05}.rp-os-hero p{font-size:12px;color:var(--rp-tinte-2, #3a2e08);margin-top:2px}',
      '.rp-os-body{padding:22px 26px;overflow-y:auto}',
      '.rp-os-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px}',
      '.rp-os-k{border:1px solid #e6e0d4;border-radius:11px;padding:11px 13px;background:#fdfbf6}',
      '.rp-os-k .t{font:600 9px "JetBrains Mono";letter-spacing:.12em;text-transform:uppercase;color:var(--wl-9a7f3a, #9a7f3a)}',
      '.rp-os-k .v{font:700 18px "Space Grotesk";color:#1c1a17;margin-top:3px}',
      '.rp-os-sec{font:600 10px "JetBrains Mono";letter-spacing:.15em;text-transform:uppercase;color:var(--wl-9a7f3a, #9a7f3a);margin:18px 0 10px}',
      '.rp-os-dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}',
      '.rp-os-dl .r{display:flex;justify-content:space-between;border-bottom:1px solid #f0ebdf;padding:6px 0;font-size:13px}',
      '.rp-os-dl .r .k{color:#6f685d}.rp-os-dl .r .v{font-weight:600;color:#1c1a17}',
      '.rp-os-txt{font-size:13px;line-height:1.6;color:#3a352c;white-space:pre-wrap;background:#faf7f0;border:1px solid #ece4d3;border-radius:10px;padding:14px 16px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* W27-modalpdf */
  function _osPdfBar(o) {
    var host = $('rp-os-pdfs'); if (!host || !o || !o.id) return;
    if (!window.DealPilotResellerPdf) {
      host.innerHTML = '<span style="font:400 11px Inter;color:#8a8473">PDF-Engine nicht geladen</span>';
      return;
    }
    var years = window.DealPilotResellerPdf.yearsFor(o);
    var opts = '<option value="all">Alle Jahre</option>' +
      years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    host.innerHTML =
      '<button class="rp-act" id="rp-os-pdf-inv">\u2193 Investment-PDF</button>' +
      '<span style="display:inline-flex;align-items:center;gap:0">' +
        '<select id="rp-os-year" style="background:#1a1a1a;color:#e8e2d6;border:1px solid #2f2f2f;' +
          'border-right:0;border-radius:8px 0 0 8px;padding:6px 8px;font:600 11.5px Inter;cursor:pointer">' + opts + '</select>' +
        '<button class="rp-act" id="rp-os-pdf-tax" style="border-radius:0 8px 8px 0">\u2193 Werbungskosten</button>' +
      '</span>';
    $('rp-os-pdf-inv').addEventListener('click', function () {
      window.DealPilotResellerPdf.export('invest', o.id);
    });
    $('rp-os-pdf-tax').addEventListener('click', function () {
      var y = ($('rp-os-year') || {}).value || 'all';
      window.DealPilotResellerPdf.export('tax', o.id, y);
    });
  }

  async function openSharedObject(shareId) {
    _osCss();
    var ex = $('rp-os-ov'); if (ex) ex.remove();
    var ov = document.createElement('div'); ov.className = 'rp-os-ov'; ov.id = 'rp-os-ov';
    /* W27-modalpdf: Hier stand EIN Knopf, der ein selbstgebautes Kurz-PDF erzeugte.
       Ein Steuerberater braucht das echte Investment-PDF und die Werbungskosten
       PRO JAHR (Anlage V). Beides kann nur die Rechen-Engine -> rp-pdf-engine.js.
       Track Record fehlt BEWUSST: der enthaelt das ganze Portfolio des Mandanten,
       nicht nur das freigegebene Objekt. */
    ov.innerHTML = '<div class="rp-os"><div class="rp-os-bar"><span class="l">Deal<b>Pilot</b></span>' +
      '<span id="rp-os-pdfs" style="margin-left:auto;display:flex;gap:8px;align-items:center"></span>' +
      '<button class="x" id="rp-os-x" style="margin-left:14px">✕</button></div>' +
      '<div class="rp-os-body" id="rp-os-body"><p class="rp-ph">Lade Objekt…</p></div></div>';
    document.body.appendChild(ov);
    $('rp-os-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    try {
      var r = await api('/shares/' + shareId + '/object'); var o = r.object || {};
      var d = o.data || {};
      _osPdfBar(o);   /*W27-modalpdf*/
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
      var INK = [28, 26, 23], MUT = [122, 115, 112], GOLD = window._pdfGold();
      var d = o.data || {};
      var nm = o.name || o.kuerzel || 'Objekt';
      var adr = [ (d.str || '') + ' ' + (d.hnr || ''), [(d.plz || ''), (d.ort || o.ort || '')].join(' ').trim() ].map(function (x) { return (x || '').trim(); }).filter(Boolean).join(', ');

      // Header
      doc.setFillColor(11, 11, 10); doc.rect(0, 0, W, 26, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('DealPilot', M, 16);
      doc.setTextColor.apply(doc, window._pdfGold()); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(String(company), W - M, 16, { align: 'right' });
      doc.setFillColor.apply(doc, window._pdfGold()); doc.rect(0, 26, W, 1.2, 'F');

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
    /* v2200 · N63.1: NUR die Einstellungen. Der Rueckfall auf das erste .st-tab der Seite traf bei offener Hilfe deren ersten Eintrag (Ablaeufe & Pilot) und klonte ihn samt help-sidebar-item-active in die Hilfe - zwei goldene Markierungen. */
    var tabs = document.querySelector('.settings-tabs:not(#help-sidebar)');   /* v2200: die Hilfe-Leiste traegt dieselbe Klasse */
    if (!tabs || tabs.querySelector('.st-tab[data-rp="1"]')) return;
    var src = tabs.querySelector('.st-tab[data-tab="plan"]') || tabs.querySelector('.st-tab');
    if (!src) return;
    var btn = src.cloneNode(true);
    btn.setAttribute('data-rp', '1'); btn.removeAttribute('data-tab'); btn.removeAttribute('onclick'); btn.classList.remove('active'); btn.classList.remove('help-sidebar-item-active');
    var t = btn.querySelector('.help-sidebar-item-title'); if (t) t.textContent = 'Partner-Verwaltung'; else btn.textContent = 'Partner-Verwaltung';   /* v3392 */
    var d = btn.querySelector('.help-sidebar-item-desc'); if (d) d.textContent = 'Plätze, Marke, Abrechnung im Partner-Cockpit';   /* v3390/v3392 */
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
        /* v1535: der Kommentar hier darueber fuehrte bis heute die Staffel
           24/19/15. Gueltig ist 19/15/12 - so steht es in Stripe unter
           dp_seat_monthly, und danach wird abgerechnet. */
        var _pf = {}, _pl = {};
        try { _pf = JSON.parse(JSON.stringify(_pro.features || {})); } catch (e) { _pf = {}; }
        try { _pl = JSON.parse(JSON.stringify(_pro.limits   || {})); } catch (e) { _pl = {}; }
        _pf.reseller = true; _pf.reseller_whitelabel = true; _pf.custom_logo = true;
        _pl.objects = -1; _pl.max_saves = -1; _pl.ai_credits = 100;
        _pl.photos_per_obj = 30; _pl.watermark = false;
        DealPilotConfig.pricing.plans.partner = {
          key: 'partner', label: 'Partner', tagline: 'Makler · Steuerberater · Finanzierer',
          /* v1176: Grundgebuehr 149 -> 99. Der Seat faellt mit (24/19/15),
             sonst spart der Mandant gegenueber dem neuen Investor-Preis von
             39,99 nur noch 40 % statt der heutigen 59 %. */
          price_monthly_eur: 99, price_yearly_eur: 1089 /* v1536 */, sort_order: 5,   /* v1250 */
          limits: _pl,
          /* v1176: der Partner ist ein Pro-Klon — er erbt dessen Kontingent. */
          kontingent: (_pro && _pro.kontingent)
            ? JSON.parse(JSON.stringify(_pro.kontingent))
            : { mpi: 5, mpi_plus: 5, wev: 5, sparfaktor: 3 },
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
      'background:linear-gradient(135deg,var(--wl-e8c964, #E8C964),var(--wl-9a7f33, #9a7f33))!important;',   /* v3630e Whitelabel-Pflicht */
      'color:#2A2727!important;font-weight:800!important;letter-spacing:.4px!important;',
      'border-color:transparent!important;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Whitelabel-Branding ─────────────────────────────────────
  /* v3630e · Standard-Akzent (DealPilot-Gold) und Akzent-Auswahl.
     Gemessen 17.11.2026, Kontrast (WCAG) auf Obsidian #0A0A0C / auf Weiss:
       Messing #A8862E 5,76/3,43 · Altgold #9C7A2A 4,93/4,01 · Bronze #8F7335 4,40/4,50
       Stahlblau #2F6F8F 3,57/5,54 · Koenigsblau #1D5FA8 3,07/6,45 · Himmelblau #2B6CB0 3,65/5,42 · Indigo #3E63A8 3,35/5,91
       Petrol #1F7A7A 3,88/5,09 · Tiefsee #2A6F77 3,43/5,77
       Bordeaux #9E4256 3,17/6,24 · Weinrot #B03A52 3,37/5,88
       Violett #7A55A8 3,48/5,69 · Blauviolett #5F5BA8 3,34/5,92
       Anthrazit #5E6670 3,40/5,82 · Schiefer #707782 4,38/4,52
       Kupfer #B0632E 4,40/4,50 · Rost #A65A2A 3,88/5,10 · Cognac #9A5B34 3,69/5,36
     Ausgeschieden (< 3 : 1 auf einem Grund): #8E2C3C, #A3354A, #7B2D3B, #6A4C9C, #5B4A8A,
     #3A5BA0. Keine Gruentoene und kein Hellrot - die Statusfarben #3FA56C und
     #B8625C/#D8564C muessen unterscheidbar bleiben. Der Standard selbst liegt auf Weiss
     bei 2,29 : 1 - er ist die Marke DealPilot und bleibt trotzdem die erste Wahl. */
  var STANDARD_AKZENT = { a: '#C9A84C', hi: '#E8CC7A', lo: '#b8932f' };
  var AKZENT_GRUPPEN = [
    ['Gold und Messing', [['#A8862E', 'Messing'], ['#9C7A2A', 'Altgold'], ['#8F7335', 'Bronze']]],
    ['Blau', [['#2F6F8F', 'Stahlblau'], ['#1D5FA8', 'Königsblau'], ['#2B6CB0', 'Himmelblau'], ['#3E63A8', 'Indigo']]],
    ['Petrol', [['#1F7A7A', 'Petrol'], ['#2A6F77', 'Tiefsee']]],
    ['Rot und Bordeaux', [['#9E4256', 'Bordeaux'], ['#B03A52', 'Weinrot']]],
    ['Violett', [['#7A55A8', 'Violett'], ['#5F5BA8', 'Blauviolett']]],
    ['Grau', [['#5E6670', 'Anthrazit'], ['#707782', 'Schiefer']]],
    ['Orange und Kupfer', [['#B0632E', 'Kupfer'], ['#A65A2A', 'Rost'], ['#9A5B34', 'Cognac']]]
  ];
  function _ico(n, g) { try { return window.Icons && Icons[n] ? Icons[n]({ size: g || 16 }) : ''; } catch (e) { return ''; } }   /* v3630k */
  function _kontrastText(hex) {
    var K = window.DealPilotLogoKontrast; if (!K || !K.kontrast) return '';
    var n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    var f = function (x) { return (Math.round(x * 100) / 100).toFixed(2).replace('.', ','); };
    return f(K.kontrast(c, [10, 10, 12])) + ' : 1 auf dunkel, ' + f(K.kontrast(c, [255, 255, 255])) + ' : 1 auf hell';
  }
  /* Abstufungen wie DealPilotWhitelabel.apply (hell +22 %, dunkel -16 %); fuer den
     Standard die festen Toene. Wird mitgespeichert, damit keine alte Abstufung bleibt. */
  function _akzentStufen(hex) {
    if (String(hex).toLowerCase() === STANDARD_AKZENT.a.toLowerCase()) return { hi: STANDARD_AKZENT.hi, lo: STANDARD_AKZENT.lo };
    var n = parseInt(String(hex).slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    var h = function (a) { return '#' + a.map(function (x) { x = Math.max(0, Math.min(255, Math.round(x))); return ('0' + x.toString(16)).slice(-2); }).join(''); };
    return { hi: h(c.map(function (x) { return x + (255 - x) * 0.22; })), lo: h(c.map(function (x) { return x * 0.84; })) };
  }
  var _brandState = { logo: undefined, current_logo: '', logoDark: undefined, current_logo_dark: '', vari: null }; // logo undefined = unverändert, '' = entfernt
  function _currentLogo() { return _brandState.logo !== undefined ? _brandState.logo : (_brandState.current_logo || ''); }
  /* v3299 · zweites, optionales Logo fuer dunklen Grund (Vorrang dort) */
  function _currentLogoDark() { return _brandState.logoDark !== undefined ? _brandState.logoDark : (_brandState.current_logo_dark || ''); }
  /* v3299 · Logo-Kontrast: Varianten je Grund (logo-kontrast.js), einmal je
     Logo-Paar gerechnet und gemerkt. */
  /* v3630 · Darstellung auf dunklem Grund und Akzent gehoeren in den Schluessel -
     sonst bliebe nach einem Wechsel das alte PNG stehen. */
  function _akzentJetzt() { var a = ($('rp-b-accent') || {}).value || ''; return /^#[0-9a-fA-F]{6}$/.test(a) ? a : ''; }   /* leer = Standard-Gold in logo-kontrast.js */
  function _variantenFuer() {
    var l = _currentLogo(), d = _currentLogoDark();
    if (!l) return Promise.resolve(null);
    var opt = { darstellung: _brandState.darstellung || 'auto', akzent: _akzentJetzt() };
    var key = l.length + ':' + l.slice(-40) + '|' + d.length + ':' + d.slice(-40) + '|' + opt.darstellung + '|' + opt.akzent;
    if (_brandState.vari && _brandState.vari.key === key) return Promise.resolve(_brandState.vari.v);
    if (!window.DealPilotLogoKontrast) return Promise.resolve(null);
    return window.DealPilotLogoKontrast.varianten(l, d || null, opt).then(function (v) {
      _brandState.vari = { key: key, v: v }; return v;
    }, function () { return null; });
  }
  /* v3630 · alle vier Darstellungen als Vorschaubilder fuer die Auswahl */
  function _darstellungenFuer() {
    var l = _currentLogo(), d = _currentLogoDark();
    if (!l || !window.DealPilotLogoKontrast || !window.DealPilotLogoKontrast.darstellungen) return Promise.resolve(null);
    var key = l.length + ':' + l.slice(-40) + '|' + d.length + ':' + d.slice(-40) + '|' + _akzentJetzt();
    if (_brandState.dvari && _brandState.dvari.key === key) return Promise.resolve(_brandState.dvari.v);
    return window.DealPilotLogoKontrast.darstellungen(l, d || null, _akzentJetzt()).then(function (v) {
      _brandState.dvari = { key: key, v: v }; return v;
    }, function () { return null; });
  }
  async function loadBranding() {
    var w = _st.markeZiel || $('rp-work'); if (!w) return;   /* v3392 · Ziel aus dem Partner-Cockpit */ w.innerHTML = '<p class="rp-ph">Lade Branding…</p>';
    try {
      var r = await api('/branding'); var b = r.branding || {};
      _brandState = { logo: undefined, current_logo: b.brand_logo_b64 || '',
                      logoDark: undefined, current_logo_dark: b.brand_logo_dark_b64 || '', vari: null,
                      /* v3630 */
                      darstellung: b.brand_logo_darstellung || 'auto', darstellung_gespeichert: b.brand_logo_darstellung || 'auto',
                      groesse: b.brand_logo_groesse == null ? 100 : b.brand_logo_groesse,
                      groesse_gespeichert: b.brand_logo_groesse == null ? 100 : b.brand_logo_groesse,
                      zuschnitt: null, dvari: null,
                      ausrichtung: b.brand_logo_ausrichtung === 'mitte' ? 'mitte' : 'links',   /* v3630e */
                      wlGespeichert: !!b.whitelabel_enabled };   /* v3630i */
      /* v3299 · Branding vor v3299 gespeichert: Varianten einmal nachrechnen und
         ablegen - sonst fehlen sie in Mails (oeffentliche Logo-Route) und beim
         Kunden muss jeder Browser selbst rechnen. Aendert am Logo nichts. */
      if (b.brand_logo_b64 && !(b.brand_logo_auf_hell && b.brand_logo_auf_dunkel)) {
        _variantenFuer().then(function (v) {
          if (!v) return;
          api('/branding-logo-varianten', { method: 'PUT', body: { auf_dunkel: v.auf_dunkel, auf_hell: v.auf_hell, messung: v.messung } })
            .catch(function () {});
        });
      }
      var accent = b.brand_accent || STANDARD_AKZENT.a;
      var obsidian = b.brand_obsidian || '#0b0b0a';
      var inp = 'width:100%;padding:9px 11px;border:1px solid #e6e0d4;border-radius:8px;font:400 13px Inter;outline:none';
      var pick = 'width:100%;height:38px;border:1px solid #e6e0d4;border-radius:8px;background:#fff;cursor:pointer';
      /* v3630b · Marcel 17.11.2026: Verwaltung einfacher, klare Abschnitte (Marke · Logo ·
         Farben · Dokumente), kurze Saetze, sofort sichtbare Wirkung. Farben stehen jetzt
         direkt hier statt im Fenster (DealPilotBrandingEditor): jede Aenderung geht ueber
         _applyPreview() -> DealPilotWhitelabel.apply() sofort in die App, dauerhaft erst
         mit Speichern, Zuruecksetzen holt den gespeicherten Stand. Kundentext ohne
         Gedankenstrich und ohne Semikolon. */
      var mailAcc = b.brand_mail_accent || accent;
      _brandState.pdfGroesse = b.brand_logo_pdf_groesse == null ? 100 : b.brand_logo_pdf_groesse;
      _brandState.gespeichert = { accent: accent, obsidian: obsidian, mail: mailAcc, pdflight: !!b.brand_pdf_light,
        darstellung: _brandState.darstellung, groesse: _brandState.groesse, pdfGroesse: _brandState.pdfGroesse, ausrichtung: _brandState.ausrichtung };
      var abschnitt = function (titel, satz) {
        /* v3630k · wie h2.sec-title / p.sec-desc im Reiter Objekt (gemessen: Space Grotesk 24/700, -0,3 px,
           #2A2727, Strich 3 px links; Unterzeile Inter 12, #625C59, 3 px oben, 18 px unten) */
        return '<h2 class="dp-verw-titel">' + titel + '</h2><p class="dp-verw-desc">' + satz + '</p>';
      };
      var farbe = function (id, titel, wert, satz) {
        return '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #E6E1D6;border-radius:2px;background:#fff;cursor:pointer;min-width:0">' +
          '<input type="color" id="' + id + '" value="' + esc(wert) + '" style="width:38px;height:30px;border:0;padding:0;background:none;cursor:pointer;flex:none">' +
          '<span style="min-width:0"><b style="display:block;font:600 12.5px Inter;color:#3a352c">' + titel + '</b>' +
          '<span style="font:400 11px/1.4 Inter;color:#8a8473">' + satz + '</span></span></label>';
      };
      /* v3630e · kleiner Knopf „Standard" neben jeder Einstellung, die einen hat */
      var stdKnopf = function (was) {
        return ' <button type="button" class="rp-b-std" data-std="' + was + '" style="margin-left:8px;padding:2px 9px;border:1px solid #e6e0d4;border-radius:999px;background:#fff;cursor:pointer;font:500 11px Inter;color:#6b6558;vertical-align:1px">Standard</button>';
      };
      var mini = 'font:600 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a8473;margin-bottom:5px';
      w.innerHTML =
        /* v3630f · jeder Abschnitt in einer eigenen Huelle (data-marke-teil): das
           Partner-Cockpit verteilt sie auf Reiter (partner-kunden.js verwaltungZeichnen) */
        '<div data-marke-teil="marke">' +
        '<p class="rp-intro">Deine Marke sehen deine Kunden in der App, in den Einladungs-Mails und in jedem PDF. Was du hier änderst, siehst du sofort in der App. Dauerhaft wird es mit Speichern.</p>' +
        /* ── 1 · Marke ── */
        abschnitt('Marke', 'Wirkt auf die ganze App deiner Kunden, auf Mails und PDFs. Schalte deine Marke ein und gib ihr einen Namen.') +
        '<div class="card dp-verw-karte"><div class="ct ct-pro dp-verw-ct">So sieht es aus</div><div id="rp-b-kopf"></div></div>' +   /* v3630k · Kopfkarte */
        '<div class="card dp-verw-karte">' +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px">' +
            '<input type="checkbox" id="rp-b-wl"' + (b.whitelabel_enabled ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--wl-c9a84c, #C9A84C)">' +
            '<span>Eigene Marke statt DealPilot zeigen</span></label>' +
          '<div class="hint dp-verw-hint" style="margin:5px 0 0 28px">Einschalten siehst du sofort. Ausschalten wird mit Speichern wirksam, die App lädt dann einmal neu.</div>' +
          '<div style="margin-top:14px;max-width:420px"><label class="dp-verw-lbl">Name der Marke oder Kanzlei</label><input type="text" id="rp-b-name" value="' + esc(b.brand_name || '') + '" style="' + inp + '"></div>' +
        '</div>' +
        /* v3630i · gut auffindbar: zurueck auf DealPilot */
        '<div class="card dp-verw-karte" style="margin-top:12px;display:flex;flex-wrap:wrap;align-items:center;gap:12px">' +
          '<div style="flex:1 1 240px;font:400 12.5px/1.5 Inter;color:#6b6558"><b style="color:#3a352c">Zurück zu DealPilot</b><br>Wirkt auf die ganze App, Mails und PDFs. Du wählst danach, ob deine Einstellungen gespeichert bleiben.</div>' +
          '<button type="button" class="dp-verw-btn" id="rp-b-aufdp">Auf DealPilot zurücksetzen</button>' +
        '</div>' +
        /* W6-preview / v3301: Haken nur fuer Admins mit Test-Reseller */
        '<div class="card dp-verw-karte" style="margin-top:18px' + ((_istAdmin() && !_partnerSiehtMarke()) ? '' : ';display:none') + '">'   /* v3630i · nur Admins (gemessen: Partner mit Marke AUS sah den Haken) */ +
          '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13.5px">' +
            '<input type="checkbox" id="rp-b-prev" style="width:18px;height:18px;accent-color:var(--gold,#C9A84C)">' +
            '<span><b>Ansicht meiner Kunden</b>. Die App in meiner Marke anzeigen</span></label>' +
          '<div class="hint dp-verw-hint" style="margin-top:7px;padding-left:28px">Nur für dich, nur in diesem Browser. Zum Zurücksetzen Haken entfernen.</div>' +
        '</div>' +
        '</div>' +
        /* ── 2 · Logo ── */
        '<div data-marke-teil="logo">' +
        abschnitt('Logo', 'Wirkt auf die Menüleiste oben links, den Kopf der Mails und die PDFs. Ein einfarbiger Rand wird beim Hochladen abgeschnitten und durchsichtig.') +
        '<div class="card dp-verw-karte">' +
          '<div id="rp-b-logo-prev" style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;margin-bottom:9px">' +
            '<div style="flex:none;max-width:100%"><div style="' + mini + '">Menüleiste</div>' +
              '<div id="rp-b-logo-box" style="width:248px;max-width:100%;min-height:100px;box-sizing:border-box;padding:0 14px;border:1px dashed #ddd6c8;border-radius:8px;background:#0e0d0b;display:flex;align-items:center;justify-content:flex-start;overflow:hidden"></div></div>' +
            '<div style="flex:none;max-width:100%"><div style="' + mini + '">Heller Grund</div>' +
              '<div id="rp-b-logo-box-hell" style="width:248px;max-width:100%;min-height:100px;box-sizing:border-box;padding:0 14px;border:1px dashed #ddd6c8;border-radius:8px;background:#ffffff;display:flex;align-items:center;justify-content:flex-start;overflow:hidden"></div></div>' +
          '</div>' +
          '<div id="rp-b-logo-txt" class="hint dp-verw-hint" style="margin-bottom:6px"></div>' +
          '<div id="rp-b-logo-ampel" style="font:400 11.5px/1.55 Inter;color:#6b6558;margin-bottom:9px"></div>' +
          '<label class="dp-verw-ablage" id="rp-b-logo-ablage" for="rp-b-logo"><span class="dp-verw-ablage-ico">' + _ico('upload', 20) + '</span><span><b>Logo hierher ziehen</b> oder klicken und Datei wählen<small>PNG, SVG oder JPG, höchstens 300 KB. Der Rand wird automatisch abgeschnitten.</small></span>' +
            '<input type="file" id="rp-b-logo" accept="image/*" class="dp-verw-datei"></label>' +
          '<button type="button" class="dp-verw-btn dp-verw-btn-weg" id="rp-b-logo-x">Logo entfernen</button>' +
          '<div class="ct ct-pro dp-verw-ct" style="margin-top:16px">Logo auf dunklem Grund' + stdKnopf('darst') + '</div>' +
          '<div class="hint dp-verw-hint" style="margin-bottom:7px">Wirkt auf die Menüleiste, den Kopf der Mails und dunkle PDF-Deckblätter. Der Rahmen nimmt deine Akzentfarbe.</div>' +
          '<div id="rp-b-darst" role="radiogroup" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px"></div>' +
          '<div class="ct ct-pro dp-verw-ct" style="margin-top:16px">Größe in der Menüleiste <b id="rp-b-gr-wert" style="color:#3a352c">' + _brandState.groesse + ' %</b>' + stdKnopf('gr') + '</div>' +
          '<input type="range" id="rp-b-gr" min="60" max="250" step="5" value="' + _brandState.groesse + '" style="width:100%;max-width:420px;accent-color:var(--wl-c9a84c, #C9A84C)">' +
          '<div class="hint dp-verw-hint" style="margin-top:3px">Wirkt auf die Menüleiste oben links, am Handy in der Schublade. Ab 165 % nutzt das Logo die volle Breite der Leiste, darüber wächst es nur noch in der Höhe bis 150 px.</div>' +
          /* v3630e · Ausrichtung in der Menueleiste (Marcel 17.11.2026) */
          '<div class="ct ct-pro dp-verw-ct" style="margin-top:16px">Ausrichtung in der Menüleiste' + stdKnopf('aus') + '</div>' +
          '<div id="rp-b-aus" style="display:inline-flex;border:1px solid #e6e0d4;border-radius:9px;overflow:hidden">' +
            '<button type="button" data-aus="links" style="padding:7px 14px;border:0;cursor:pointer;font:600 12px Inter">Links (Standard)</button>' +
            '<button type="button" data-aus="mitte" style="padding:7px 14px;border:0;cursor:pointer;font:600 12px Inter">Mittig</button></div>' +
          '<div class="hint dp-verw-hint" style="margin-top:3px">Wirkt auf die Menüleiste. Auf dem Deckblatt und im Mail-Kopf steht das Logo ohnehin mittig. Im Seitenkopf der PDFs bleibt es links, weil dort mittig der Seitentitel steht.</div>' +
          '<details style="margin-top:14px"><summary style="cursor:pointer;font:600 12.5px Inter;color:#3a352c">Eigenes Logo für dunklen Grund (selten nötig)</summary>' +
            '<div class="hint dp-verw-hint" style="margin:7px 0">Hast du eine helle Fassung deines Logos, lade sie hier hoch. Sie steht dann überall auf dunklem Grund.</div>' +
            '<label class="dp-verw-ablage dp-verw-ablage-klein" id="rp-b-logo-dark-ablage" for="rp-b-logo-dark"><span class="dp-verw-ablage-ico">' + _ico('upload', 18) + '</span><span><b>Helle Fassung hierher ziehen</b> oder klicken</span>' +
            '<input type="file" id="rp-b-logo-dark" accept="image/*" class="dp-verw-datei"></label>' +
            '<button type="button" class="dp-verw-btn dp-verw-btn-weg" id="rp-b-logo-dark-x">entfernen</button></details>' +
        '</div>' +
        '</div>' +
        /* ── 3 · Farben ── */
        '<div data-marke-teil="farben">' +
        abschnitt('Farben', 'Wirkt auf Knöpfe, Linien und Werte in der App, auf den Logorahmen und die Mails. Jede Farbe siehst du sofort in der App.') +
        '<div class="card dp-verw-karte">' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px">' +
            farbe('rp-b-accent', 'Akzentfarbe', accent, 'Knöpfe, Linien, Werte und der Logorahmen') +
            farbe('rp-b-obsidian', 'Menü und Kopfleiste', obsidian, 'die dunkle Fläche links und oben') +
            farbe('rp-b-mail', 'Farbe der Mails', mailAcc, 'Knopf und Linie in Einladungs-Mails') +
          '</div>' +
          /* v3630e · Marcel: „Bitte noch mehr Akzent-Auswahl angeben. Und immer den Standard."
             Erste Kachel Standard (DealPilot-Gold), dann Toene in Gruppen. Jeder Ton ist
             gemessen >= 3 : 1 auf Obsidian #0A0A0C UND auf Weiss (AKZENT_TOENE, Werte im
             Kommentar dort). Gruen und Hellrot fehlen bewusst: Statusfarben. */
          '<div class="ct ct-pro dp-verw-ct" style="margin-top:12px">Akzent schnell wählen</div>' +
          '<div id="rp-b-pre">' +
            '<button type="button" data-p="std" style="display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:2px solid ' + STANDARD_AKZENT.a + ';border-radius:999px;background:#fff;cursor:pointer;font:600 12px Inter;color:#3a352c;margin-bottom:8px">' +
              '<i style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,' + STANDARD_AKZENT.hi + ',' + STANDARD_AKZENT.a + ' 55%,' + STANDARD_AKZENT.lo + ');display:inline-block"></i>Standard (DealPilot-Gold)</button>' +
            AKZENT_GRUPPEN.map(function (g) {
              return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px">' +
                '<span style="font:600 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.06em;text-transform:uppercase;color:#8a8473;width:110px;flex:none">' + g[0] + '</span>' +
                g[1].map(function (t) {
                  return '<button type="button" data-p="' + t[0] + '" title="' + t[1] + ', Kontrast ' + _kontrastText(t[0]) + '" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid #e6e0d4;border-radius:999px;background:#fff;cursor:pointer;font:500 12px Inter;color:#3a352c">' +
                    '<i style="width:12px;height:12px;border-radius:50%;background:' + t[0] + ';display:inline-block"></i>' + t[1] + '</button>';
                }).join('') + '</div>';
            }).join('') +
          '</div>' +
        '</div>' +
        '</div>' +
        /* ── 4 · Dokumente ── */
        '<div data-marke-teil="dokumente">' +
        abschnitt('Dokumente', 'Wirkt auf jedes PDF deiner Kunden und auf die Einladungs-Mail. Die Vorschau zeigt Deckblatt und Seitenkopf.') +
        '<div class="card dp-verw-karte">' +
          '<input type="hidden" id="rp-b-pdflight" value="' + (b.brand_pdf_light ? '1' : '0') + '">' +
          '<div class="ct ct-pro dp-verw-ct">Deckblatt</div><div class="hint dp-verw-hint" style="margin-bottom:6px">Wirkt auf das Deckblatt und die Seitenköpfe aller PDFs.</div>' +
          '<div id="rp-b-pdfart" style="display:inline-flex;border:1px solid #e6e0d4;border-radius:9px;overflow:hidden;margin-bottom:12px">' +
            '<button type="button" data-hell="0" style="padding:7px 14px;border:0;cursor:pointer;font:600 12px Inter">Dunkel (Standard)</button>' +
            '<button type="button" data-hell="1" style="padding:7px 14px;border:0;cursor:pointer;font:600 12px Inter">Hell</button></div>' +
          '<div class="ct ct-pro dp-verw-ct">Logogröße in den Dokumenten <b id="rp-b-pdfgr-wert" style="color:#3a352c">' + _brandState.pdfGroesse + ' %</b>' + stdKnopf('pdfgr') + '</div>' +
          '<input type="range" id="rp-b-pdfgr" min="60" max="150" step="5" value="' + _brandState.pdfGroesse + '" style="width:100%;max-width:420px;accent-color:var(--wl-c9a84c, #C9A84C)">' +
          '<div class="hint dp-verw-hint" style="margin:3px 0 10px">Wirkt auf Deckblatt und Seitenkopf. Größer geht nur, solange das Logo nicht in Text oder Linien läuft. Steht es an dieser Grenze, wächst es nicht weiter.</div>' +
          '<div id="rp-b-pdfprev" style="display:flex;flex-wrap:wrap;gap:12px"></div>' +
          '<div class="ct ct-pro dp-verw-ct" style="margin-top:16px">Absender im Fuß jedes PDFs</div>' +
          '<div class="hint dp-verw-hint" style="margin-bottom:8px">Wirkt auf den Fuß jedes PDFs. Leere Felder bleiben leer, DealPilot setzt nichts ein.</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px">' +
            '<div style="flex:2 1 200px"><label class="dp-verw-lbl">Firma (falls anders als die Marke)</label><input type="text" id="rp-b-company" value="' + esc(b.brand_company || '') + '" placeholder="' + esc(b.brand_name || 'Kanzlei Muster GmbH') + '" style="' + inp + '"></div>' +
            '<div style="flex:2 1 200px"><label class="dp-verw-lbl">Untertitel</label><input type="text" id="rp-b-tagline" value="' + esc(b.brand_tagline || '') + '" placeholder="Ihre Kanzlei für Immobilien" style="' + inp + '"></div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px">' +
            '<div style="flex:3 1 200px"><label class="dp-verw-lbl">Straße und Hausnummer</label><input type="text" id="rp-b-address" value="' + esc(b.brand_address || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:0 1 96px"><label class="dp-verw-lbl">PLZ</label><input type="text" id="rp-b-plz" value="' + esc(b.brand_plz || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:2 1 140px"><label class="dp-verw-lbl">Ort</label><input type="text" id="rp-b-city" value="' + esc(b.brand_city || '') + '" style="' + inp + '"></div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px">' +
            '<div style="flex:1 1 150px"><label class="dp-verw-lbl">Telefon</label><input type="text" id="rp-b-phone" value="' + esc(b.brand_phone || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:1 1 150px"><label class="dp-verw-lbl">E-Mail</label><input id="rp-b-email" type="email" value="' + esc(b.brand_email || '') + '" style="' + inp + '"></div>' +
            '<div style="flex:1 1 150px"><label class="dp-verw-lbl">Website</label><input type="text" id="rp-b-website" value="' + esc(b.brand_website || '') + '" style="' + inp + '"></div>' +
          '</div>' +
          '<div id="rp-b-foot" style="margin-top:14px;padding:11px 13px;background:#faf8f3;border:1px dashed #ddd6c8;border-radius:8px;font:400 11.5px/1.6 Inter;color:#6b6558"></div>' +
          '<div class="ct ct-pro dp-verw-ct" style="margin-top:16px">Einladungs-Mail</div><div id="rp-b-preview"></div>' +
        '</div>' +
        '</div>' +
        '<div data-marke-teil="leiste" style="position:sticky;bottom:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:18px;padding:12px 0;background:linear-gradient(transparent,#fbf8f1 30%)">' +
          '<button type="button" class="dp-verw-btn dp-verw-btn-haupt" id="rp-b-save">Speichern</button>' +
          '<button type="button" class="dp-verw-btn" id="rp-b-reset">Änderungen verwerfen</button>' +
          '<span id="rp-b-stand" style="font:400 12px Inter;color:#8a8473"></span></div>';
      var upd = function () { _brandPreview(); _logoPrev(); try { if (_previewOn()) _applyPreview(); } catch (e) {} };  /*W7-livepreview W22-logoprev*/
      $('rp-b-wl').addEventListener('change', upd);
      $('rp-b-name').addEventListener('input', upd);
      /* v3630b · Farben direkt hier, live in der App (vorher Fenster DealPilotBrandingEditor) */
      ['rp-b-accent', 'rp-b-obsidian', 'rp-b-mail'].forEach(function (id) {
        $(id).addEventListener('input', function () { _brandState.vari = null; _brandState.dvari = null; _standZeigen(); upd(); _pdfPrev(); });
      });
      $('rp-b-pre').addEventListener('click', function (e) {
        var bt = e.target && e.target.closest ? e.target.closest('[data-p]') : null; if (!bt) return;
        /* v3630e · Standard setzt Akzent UND Mail auf DealPilot-Gold, die Menueflaeche bleibt */
        var p = bt.getAttribute('data-p'), a = p === 'std' ? STANDARD_AKZENT.a : p;
        $('rp-b-accent').value = a; $('rp-b-mail').value = a;
        _brandState.vari = null; _brandState.dvari = null; _standZeigen(); upd(); _pdfPrev(); _wahlMarkieren();
      });
      /* v3630e · Ausrichtung */
      $('rp-b-aus').addEventListener('click', function (e) {
        var bt = e.target && e.target.closest ? e.target.closest('[data-aus]') : null; if (!bt) return;
        _brandState.ausrichtung = bt.getAttribute('data-aus');
        _logoPrevGroesse(); _standZeigen(); _wahlMarkieren();
        try { if (_previewOn() && window.DealPilotWhitelabel && DealPilotWhitelabel.logoAusrichtung) DealPilotWhitelabel.logoAusrichtung(_brandState.ausrichtung); } catch (e2) {}
      });
      /* v3630e · Knoepfe „Standard" */
      [].forEach.call(w.querySelectorAll('.rp-b-std'), function (bt) {
        bt.addEventListener('click', function () {
          var was = bt.getAttribute('data-std');
          if (was === 'gr') { var g1 = $('rp-b-gr'); g1.value = '100'; g1.dispatchEvent(new Event('input', { bubbles: true })); }
          else if (was === 'pdfgr') { var g2 = $('rp-b-pdfgr'); g2.value = '100'; g2.dispatchEvent(new Event('input', { bubbles: true })); }
          else if (was === 'aus') { var k1 = w.querySelector('#rp-b-aus [data-aus="links"]'); if (k1) k1.click(); }
          else if (was === 'darst') { _brandState.darstellung = 'auto'; upd(); }
          _wahlMarkieren();
        });
      });
      $('rp-b-pdfart').addEventListener('click', function (e) {
        var bt = e.target && e.target.closest ? e.target.closest('[data-hell]') : null; if (!bt) return;
        $('rp-b-pdflight').value = bt.getAttribute('data-hell'); _standZeigen(); _pdfPrev();
      });
      $('rp-b-pdfgr').addEventListener('input', function () {
        _brandState.pdfGroesse = parseInt(this.value, 10) || 100;
        var x = $('rp-b-pdfgr-wert'); if (x) x.textContent = _brandState.pdfGroesse + ' %';
        _standZeigen(); _pdfPrev();
      });
      $('rp-b-aufdp').addEventListener('click', _aufDealPilot);   /* v3630i */
      $('rp-b-name').addEventListener('input', function () { try { window.dispatchEvent(new Event('dp:marke-stand')); } catch (e11) {} });
      $('rp-b-wl').addEventListener('change', function () { try { _standZeigen(); } catch (e12) {} });
      $('rp-b-reset').addEventListener('click', function () {
        var g = _brandState.gespeichert || {};
        $('rp-b-accent').value = g.accent; $('rp-b-obsidian').value = g.obsidian; $('rp-b-mail').value = g.mail;
        $('rp-b-pdflight').value = g.pdflight ? '1' : '0';
        _brandState.darstellung = g.darstellung || 'auto';
        _brandState.ausrichtung = g.ausrichtung || 'links';   /* v3630e */
        try { if (window.DealPilotWhitelabel && DealPilotWhitelabel.logoAusrichtung) DealPilotWhitelabel.logoAusrichtung(_brandState.ausrichtung); } catch (e3) {}
        _brandState.groesse = g.groesse || 100; $('rp-b-gr').value = _brandState.groesse; $('rp-b-gr-wert').textContent = _brandState.groesse + ' %';
        _brandState.pdfGroesse = g.pdfGroesse || 100; $('rp-b-pdfgr').value = _brandState.pdfGroesse; $('rp-b-pdfgr-wert').textContent = _brandState.pdfGroesse + ' %';
        _brandState.logo = undefined; _brandState.logoDark = undefined; _brandState.vari = null; _brandState.dvari = null;
        try { if (window.DealPilotWhitelabel && DealPilotWhitelabel.logoGroesse) DealPilotWhitelabel.logoGroesse(_brandState.groesse); } catch (e2) {}
        upd(); _pdfPrev(); _standZeigen(); _wahlMarkieren(); _logoPrevGroesse();
        toast('Ungespeicherte Änderungen verworfen');
      });
      $('rp-b-logo').addEventListener('change', function (e) { _brandLogoPick(e, upd); });
      /* v3630k · Ablageflaeche: Datei hineinziehen statt nacktem Browser-Knopf */
      ['rp-b-logo', 'rp-b-logo-dark'].forEach(function (id) {
        var feld = $(id), zone = $(id + '-ablage'); if (!feld || !zone) return;
        ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (ev) { ev.preventDefault(); zone.classList.add('ueber'); }); });
        ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function (ev) { ev.preventDefault(); zone.classList.remove('ueber'); }); });
        zone.addEventListener('drop', function (ev) {
          var f = ev.dataTransfer && ev.dataTransfer.files; if (!f || !f.length) return;
          try { feld.files = f; } catch (e15) {}
          feld.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
      $('rp-b-logo-x').addEventListener('click', function () { _brandState.logo = ''; var f = $('rp-b-logo'); if (f) f.value = ''; upd(); });
      /* v3299 · zweites Logo fuer dunklen Grund */
      $('rp-b-logo-dark').addEventListener('change', function (e) { _brandLogoPick(e, upd, 'logoDark'); });
      $('rp-b-logo-dark-x').addEventListener('click', function () { _brandState.logoDark = ''; var f = $('rp-b-logo-dark'); if (f) f.value = ''; upd(); });
      /* v3630 · Darstellung und Groesse */
      $('rp-b-darst').addEventListener('click', function (e) {
        var k = e.target && e.target.closest ? e.target.closest('[data-darst]') : null;
        if (!k || k.getAttribute('aria-disabled') === 'true') return;
        _brandState.darstellung = k.getAttribute('data-darst'); upd();
      });
      $('rp-b-gr').addEventListener('input', function () {
        _brandState.groesse = parseInt(this.value, 10) || 100;
        var w = $('rp-b-gr-wert'); if (w) w.textContent = _brandState.groesse + ' %';
        _logoPrevGroesse(); _standZeigen();
        try { if (_previewOn() && window.DealPilotWhitelabel && DealPilotWhitelabel.logoGroesse) DealPilotWhitelabel.logoGroesse(_brandState.groesse); } catch (e2) {}
      });
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
      _brandPreview(); _logoPrev();   /*W22-logoprev*/
      _pdfPrev(); _standZeigen();     /* v3630b */
      _wahlMarkieren();               /* v3630e */
      /* v3630f · Reihenfolge und Reiter baut jetzt partner-kunden.js verwaltungZeichnen() (data-marke-teil) */
    } catch (e) { w.innerHTML = '<p class="rp-ph">Branding konnte nicht geladen werden.</p>'; }
  }
  /* W22-logoprev · v3630: Vorschau in Groesse der echten Menueleiste, Auswahl der Darstellung */
  var DARST_TITEL = { 'auto': 'Automatisch (Standard)', 'hell': 'Hell eingefärbt, ohne Fläche', 'weiss': 'Weiße Fläche', 'gold': 'Rahmen, innen hell', 'gold-dunkel': 'Rahmen, innen dunkel' };
  var DARST_TEXT = { 'auto': 'passt sich an, nur wenn der Kontrast nicht reicht',
                     'hell': 'dunkle Teile werden hell, Farbiges bleibt, kein Kasten',   /* v3630f */
                     'weiss': 'Logo auf weißem, abgerundetem Kasten',
                     'gold': 'dünner Rahmen in deiner Akzentfarbe, innen weiß',
                     'gold-dunkel': 'Rahmen in Akzentfarbe, innen dunkel, dunkle Teile hell' };
  /* Masse der echten Schiene ab 901 px (layout-varianten.css v1667/v3630): Logo max 60 x 216 px */
  function _logoPrevGroesse() {
    var s = (_brandState.groesse || 100) / 100;
    ['rp-b-logo-box', 'rp-b-logo-box-hell'].forEach(function (id) {
      var box = $(id); if (!box) return;
      var img = box.querySelector('img'); if (!img) return;
      img.style.maxHeight = Math.round(60 * s) + 'px';
      var gross = s > 1.6;   /* v3630f · wie layout-varianten.css: ueber 160 % volle Innenbreite (231 px, Rand 8 px) */
      box.style.paddingLeft = box.style.paddingRight = gross ? '8px' : '14px';
      img.style.maxWidth = gross ? '100%' : Math.round(Math.min(216 * s, 216)) + 'px';
      box.style.minHeight = Math.max(100, Math.round(60 * s + 30)) + 'px';
      box.style.justifyContent = _brandState.ausrichtung === 'mitte' ? 'center' : 'flex-start';   /* v3630e */
    });
  }
  /* v3630e · gewaehlte Knoepfe und Kacheln markieren, Knopf „Standard" nur aktiv, wenn abweichend */
  function _wahlMarkieren() {
    var paar = function (sel, attr, wert) {
      [].forEach.call(document.querySelectorAll(sel), function (bt) {
        var an = bt.getAttribute(attr) === wert;
        bt.style.background = an ? '#2a2727' : '#fff'; bt.style.color = an ? '#fff' : '#3a352c';
      });
    };
    paar('#rp-b-aus [data-aus]', 'data-aus', _brandState.ausrichtung || 'links');
    var acc = String(_v('rp-b-accent')).toLowerCase();
    [].forEach.call(document.querySelectorAll('#rp-b-pre [data-p]'), function (bt) {
      var p = bt.getAttribute('data-p'), hex = (p === 'std' ? STANDARD_AKZENT.a : p).toLowerCase();
      bt.style.boxShadow = hex === acc ? '0 0 0 2px #2a2727' : 'none';
    });
    var abw = { gr: (_brandState.groesse || 100) !== 100, pdfgr: (_brandState.pdfGroesse || 100) !== 100,
                aus: (_brandState.ausrichtung || 'links') !== 'links', darst: (_brandState.darstellung || 'auto') !== 'auto' };
    [].forEach.call(document.querySelectorAll('.rp-b-std'), function (bt) {
      var an = !!abw[bt.getAttribute('data-std')];
      bt.disabled = !an; bt.style.opacity = an ? 1 : 0.45; bt.style.cursor = an ? 'pointer' : 'default';
      bt.title = an ? 'Auf den Standard zurücksetzen' : 'Steht auf dem Standard';
    });
  }
  /* v3630b · Stand: was ist geaendert und noch nicht gespeichert */
  function _standZeigen() {
    var el = $('rp-b-stand'); if (!el) return;
    var g = _brandState.gespeichert || {}, an = [];
    if (!!($('rp-b-wl') && $('rp-b-wl').checked) !== !!_brandState.wlGespeichert) an.push('Marke an/aus');   /* v3630i */
    if (_brandState.logo !== undefined || _brandState.logoDark !== undefined) an.push('Logo');
    var gl = function (x) { return String(x || '').toLowerCase(); };   /* type=color liefert Kleinbuchstaben */
    if (gl(_v('rp-b-accent')) !== gl(g.accent) || gl(_v('rp-b-obsidian')) !== gl(g.obsidian) || gl(_v('rp-b-mail')) !== gl(g.mail)) an.push('Farben');
    if (_brandState.darstellung !== g.darstellung || _brandState.groesse !== g.groesse || _brandState.ausrichtung !== g.ausrichtung) an.push('Logo in der App');
    if ((_v('rp-b-pdflight') === '1') !== !!g.pdflight || _brandState.pdfGroesse !== g.pdfGroesse) an.push('Dokumente');
    try { _wahlMarkieren(); } catch (e9) {}   /* v3630e */
    try { _kopfZeigen(); } catch (e13) {}   /* v3630k */
    try { window.dispatchEvent(new Event('dp:marke-stand')); } catch (e10) {}   /* v3630i · Liste links in der Verwaltung */
    el.innerHTML = an.length ? 'Geändert: ' + an.join(', ') + '. <b style="color:#3a352c">Noch nicht gespeichert.</b>' : 'Alles gespeichert.';
  }
  /* v3630b · Vorschau der Dokumente in echten Massen (1 mm = 1,15 px): Deckblatt
     (Logo ab 14 mm, Goldlinie bei 56 mm, Rahmen 76 x 36 mm, Grenze 120 x 40) und
     Seitenkopf (Balken 22 mm, Logo ab 15/3 mm, Rahmen 50 x 17 mm, Grenze 65 x 18).
     Die Rahmen rechnet DealPilotPdfLogo.box - dieselbe Funktion wie pdf.js. */
  function _pdfPrev() {
    var host = $('rp-b-pdfprev'); if (!host) return;
    var k = 1.15, hell = _v('rp-b-pdflight') === '1', s = (_brandState.pdfGroesse || 100) / 100;
    var acc = _v('rp-b-accent') || '', L = window.DealPilotPdfLogo;
    var box = function (b, h, gb, gh) { return (L && L.box) ? L.box(b, h, gb, gh, s) : { b: b, h: h }; };
    var v = _brandState.vari && _brandState.vari.v;
    var logo = _currentLogo() ? (v ? (hell ? v.auf_hell : v.auf_dunkel) : _currentLogo()) : '';
    var grund = hell ? '#ffffff' : '#2A2727', schrift = hell ? '#2A2727' : '#ffffff';
    var cb = box(76, 36, 120, 40), kb = box(50, 17, 65, 18);
    var bild = function (bb, stil) {
      return logo ? '<img src="' + esc(logo) + '" alt="" style="position:absolute;' + stil + ';max-width:' + (bb.b * k).toFixed(1) + 'px;max-height:' + (bb.h * k).toFixed(1) + 'px">'
                  : '<span style="position:absolute;' + stil + ';font:700 12px Inter;color:' + (hell ? '#2A2727' : '#fff') + '">' + esc(_v('rp-b-name') || 'Deine Marke') + '</span>';
    };
    var seite = 'position:relative;width:' + Math.round(210 * k) + 'px;max-width:100%;overflow:hidden;border:1px solid #e6e0d4;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.06)';
    host.innerHTML =
      '<div style="flex:none;max-width:100%"><div style="font:600 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a8473;margin-bottom:5px">Deckblatt</div>' +
        '<div style="' + seite + ';height:' + Math.round(76 * k) + 'px;background:' + grund + '">' +
          '<div style="position:absolute;left:0;right:0;top:' + (14 * k).toFixed(1) + 'px;height:' + (40 * k).toFixed(1) + 'px;display:flex;justify-content:center;align-items:flex-start">' +
            '<div style="position:relative;width:' + (cb.b * k).toFixed(1) + 'px;height:' + (cb.h * k).toFixed(1) + 'px;display:flex;justify-content:center">' + bild(cb, 'top:0') + '</div></div>' +
          '<div style="position:absolute;left:0;right:0;top:' + (56 * k).toFixed(1) + 'px;height:1px;background:' + esc(acc || '#888') + '"></div>' +
          '<div style="position:absolute;left:0;right:0;top:' + (61 * k).toFixed(1) + 'px;text-align:center;font:700 8px Inter;letter-spacing:.3em;color:' + esc(acc || '#888') + '">INVESTMENT CASE</div>' +
        '</div></div>' +
      '<div style="flex:none;max-width:100%"><div style="font:600 10px/1 \'JetBrains Mono\',monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a8473;margin-bottom:5px">Seitenkopf</div>' +
        '<div style="' + seite + ';height:' + Math.round(34 * k) + 'px;background:#fff">' +
          '<div style="position:absolute;left:0;right:0;top:0;height:' + (22 * k).toFixed(1) + 'px;background:' + (hell ? '#F4F1EA' : '#2A2727') + '">' +
            bild(kb, 'left:' + (15 * k).toFixed(1) + 'px;top:' + (3 * k).toFixed(1) + 'px') +
            '<span style="position:absolute;left:50%;transform:translateX(-50%);top:' + (11 * k).toFixed(1) + 'px;font:700 8px Inter;color:' + schrift + '">OBJEKT</span></div>' +
          '<div style="position:absolute;left:0;right:0;top:' + (22 * k).toFixed(1) + 'px;height:1px;background:' + esc(acc || '#888') + '"></div>' +
        '</div></div>';
    /* Knopf Dunkel/Hell markieren */
    [].forEach.call(document.querySelectorAll('#rp-b-pdfart [data-hell]'), function (bt) {
      var an = bt.getAttribute('data-hell') === (hell ? '1' : '0');
      bt.style.background = an ? '#2a2727' : '#fff'; bt.style.color = an ? '#fff' : '#3a352c';
    });
  }
  function _logoPrev() {
    var box = $('rp-b-logo-box'), txt = $('rp-b-logo-txt'); if (!box) return;
    var boxH = $('rp-b-logo-box-hell'), amp = $('rp-b-logo-ampel'), wahl = $('rp-b-darst');
    var l = _currentLogo();
    var bild = function (src) { return '<img src="' + esc(src) + '" alt="" style="display:block;width:auto;height:auto">'; };
    if (l) {
      if (!box.querySelector('img')) box.innerHTML = bild(_currentLogoDark() || l);
      if (boxH && !boxH.querySelector('img')) boxH.innerHTML = bild(l);
      box.style.borderStyle = 'solid';
      _logoPrevGroesse();
      /* v3299 · Vorschau mit den Varianten, die Mandanten wirklich sehen, und Ampel */
      if (amp) amp.textContent = 'Kontrast wird gemessen …';
      _variantenFuer().then(function (v) {
        if (!v || l !== _currentLogo()) { if (amp && !v) amp.textContent = ''; return; }
        box.innerHTML = bild(v.auf_dunkel);
        if (boxH) boxH.innerHTML = bild(v.auf_hell);
        _logoPrevGroesse();
        try { _pdfPrev(); } catch (e6) {}   /* v3630b · Dokumente zeigen dieselbe Variante */
        try { _kopfZeigen(); window.dispatchEvent(new Event('dp:marke-stand')); } catch (e14) {}   /* v3630k · Vorschauen mit der neuen Variante */
        if (!amp) return;
        var ART = { 'unveraendert': 'unverändert', 'weiss': 'weiß eingefärbt', 'dunkel': 'dunkel eingefärbt',
                    'platte-hell': 'auf heller Platte', 'platte-dunkel': 'auf dunkler Platte', 'eigenes Logo': 'eigenes Logo für dunklen Grund',
                    'rahmen-hell': 'Rahmen, innen hell', 'rahmen-dunkel': 'Rahmen, innen dunkel', 'hell-gedreht': 'hell eingefärbt, ohne Fläche' };
        var zeile = function (titel, e) {
          if (!e) return '';
          /* v3630 · gewaehlte Darstellung: eigene Flaeche, kein Kontrastwert gegen den Grund */
          if (e.art === 'rahmen-hell' || e.art === 'rahmen-dunkel' || e.art === 'hell-gedreht' || (e.grund || '').indexOf('Darstellung:') === 0) {
            return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#3FA56C;margin-right:6px;vertical-align:0"></span>' +
              '<b style="color:#3a352c">' + titel + ':</b> ' + esc(ART[e.art] || DARST_TITEL[_brandState.darstellung] || e.art) + (e.anteil_lesbar != null ? ', ' + Math.round(e.anteil_lesbar * 100) + ' % der Logopunkte gut lesbar' : '') + '<br>';   /* v3630f */
          }
          var ok = e.k_nachher == null || e.k_nachher >= 3;
          var k = function (x) { return x == null ? 'eigene Fläche' : String(x).replace('.', ',') + ' : 1'; };
          return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + (ok ? '#3FA56C' : '#B8625C') +
            ';margin-right:6px;vertical-align:0"></span><b style="color:#3a352c">' + titel + ':</b> ' +
            (e.k == null ? 'eigene Fläche, unverändert' : 'Kontrast ' + k(e.k) + (e.art !== 'unveraendert' ? ' → ' + esc(ART[e.art] || e.art) + ', jetzt ' + k(e.k_nachher) : ', reicht')) + '<br>';
        };
        amp.innerHTML = zeile('Dunkler Grund', v.messung.dunkel) + zeile('Heller Grund', v.messung.hell);
        /* Live in der App, wenn der Partner seine Marke sieht */
        try { if (_previewOn()) _applyPreview(); } catch (e3) {}
      });
      /* v3630 · Auswahl mit echten Vorschaubildern */
      if (wahl) {
        _darstellungenFuer().then(function (d) {
          if (l !== _currentLogo()) return;
          /* gewaehlte Darstellung passt nicht zum (neuen) Logo -> zurueck auf Automatisch */
          if (d && d[_brandState.darstellung] && !d[_brandState.darstellung].ok) { _brandState.darstellung = 'auto'; _logoPrev(); return; }
          wahl.innerHTML = window.DealPilotLogoKontrast.DARSTELLUNGEN.map(function (k) {
            var x = d && d[k], an = _brandState.darstellung === k, geht = !x || x.ok;
            return '<div data-darst="' + k + '" role="radio" aria-checked="' + an + '" aria-disabled="' + (!geht) + '" tabindex="0" ' +
              'style="cursor:' + (geht ? 'pointer' : 'not-allowed') + ';opacity:' + (geht ? 1 : .45) + ';border:' + (an ? '2px solid var(--wl-c9a84c, #C9A84C)' : '1px solid #e6e0d4') +
              ';border-radius:9px;padding:' + (an ? '7px' : '8px') + ';background:#fff">' +
              '<div style="height:54px;border-radius:6px;background:#0e0d0b;display:flex;align-items:center;justify-content:center;padding:6px;box-sizing:border-box">' +
                (x ? '<img src="' + esc(x.src) + '" alt="" style="max-height:42px;max-width:100%">' : '') + '</div>' +
              '<div style="font:600 12px Inter;color:#3a352c;margin-top:6px">' + (an ? '● ' : '') + DARST_TITEL[k] + '</div>' +
              '<div style="font:400 10.5px/1.4 Inter;color:#8a8473">' + (geht ? DARST_TEXT[k] : 'nicht lesbar genug für dieses Logo (' + Math.round((x.anteil || 0) * 100) + ' % der Logopunkte erreichen 3 : 1)') + '</div>' +
            '</div>';
          }).join('');
        });
      }
      if (txt) {
        var z = _brandState.zuschnitt, zt = '';
        if (z && z.info && !z.info.leer && _brandState.logo !== undefined) {
          zt = ' Zugeschnitten: ' + z.info.vorher[0] + ' × ' + z.info.vorher[1] + ' → ' + z.info.nachher[0] + ' × ' + z.info.nachher[1] + ' px' +
            (z.info.randFarbe ? ', Rand rgb(' + z.info.randFarbe.join(', ') + ') transparent gemacht.' : ', Rand war schon transparent.');
        }
        /* v3630b · ohne Gedankenstrich, der Stand steht unten neben Speichern */
        txt.innerHTML = (_brandState.logo !== undefined
          ? '<b style="color:#3FA56C">Neues Logo.</b> Noch nicht gespeichert.' + esc(zt)
          : 'Dein gespeichertes Logo. Eine neue Datei ersetzt es.');
      }
      try { _standZeigen(); } catch (e5) {}
    } else {
      box.innerHTML = '<span style="font:400 10px Inter;color:#6f6a60">kein Logo</span>';
      if (boxH) boxH.innerHTML = '';
      if (amp) amp.textContent = '';
      if (wahl) wahl.innerHTML = '<div style="font:400 11.5px Inter;color:#8a8473">Erst ein Logo hochladen.</div>';
      box.style.borderStyle = 'dashed';
      if (txt) txt.textContent = 'Ohne Logo erscheint dein Marken-/Kanzleiname als Schriftzug.';
    }
  }
  function _brandLogoPick(e, cb, feld) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 300 * 1024) { toast('Logo zu groß (max ~300 KB)'); e.target.value = ''; return; }
    var rd = new FileReader();
    rd.onload = function () {
      /* v3630 · automatisch zuschneiden (Rand weg, einfarbiger Grund transparent).
         Scheitert das, bleibt das Bild, wie es kam. */
      var K = window.DealPilotLogoKontrast;
      if (!K || !K.zuschneiden) { _brandState[feld || 'logo'] = rd.result; if (cb) cb(); return; }
      K.zuschneiden(rd.result).then(function (z) {
        _brandState[feld || 'logo'] = z.src;
        if (!feld || feld === 'logo') _brandState.zuschnitt = z;
        if (cb) cb();
      }, function () { _brandState[feld || 'logo'] = rd.result; if (cb) cb(); });
    };
    rd.readAsDataURL(f);
  }
  function _brandPreview() {
    var host = $('rp-b-preview'); if (!host) return;
    var wl = $('rp-b-wl') && $('rp-b-wl').checked;
    var name = ($('rp-b-name') || {}).value || 'Deine Kanzlei';
    /* v3630b · die Mail nimmt die Mail-Farbe (brand_mail_accent), nicht den App-Akzent */
    var accent = ($('rp-b-mail') || {}).value || ($('rp-b-accent') || {}).value || STANDARD_AKZENT.a;
    var obsidian = ($('rp-b-obsidian') || {}).value || '#0b0b0a';
    var logo = _currentLogo();
    /* v3299 · im Mail-Kopf (dunkel) steht die Variante fuer dunklen Grund */
    try { if (_brandState.vari && _brandState.vari.v && _brandState.vari.v.auf_dunkel) logo = _brandState.vari.v.auf_dunkel; else if (_currentLogoDark()) logo = _currentLogoDark(); } catch (e) {}
    var brandName = wl ? name : 'DealPilot';
    var head = (wl && logo) ? '<img src="' + esc(logo) + '" style="max-height:40px">' : '<div style="font:700 20px Georgia,serif;color:#fff">' + esc(brandName) + '</div>';
    host.innerHTML =
      '<div style="max-width:440px;border:1px solid #e6e0d4;border-radius:12px;overflow:hidden">' +
        '<div style="background:' + esc(wl ? obsidian : '#0b0b0a') + ';padding:16px 18px">' + head + '</div>' +
        '<div style="height:4px;background:' + esc(accent) + '"></div>' +
        '<div style="padding:18px;background:#fff">' +
          '<div style="font-size:13px;color:#3a352c">' + (wl ? '<b>' + esc(brandName) + '</b> lädt dich ein.' : '<b>' + esc(brandName) + '</b> lädt dich zu DealPilot ein.') + '</div>' +   /* v3299 */
          '<div style="margin-top:12px"><span style="background:' + esc(accent) + ';color:var(--rp-tinte, #241c05);font-weight:700;padding:9px 16px;border-radius:8px;font-size:13px;display:inline-block">Einladung annehmen</span></div>' +
        '</div></div>';
  }
  function _v(id) { var el = $(id); return el && el.value ? String(el.value).trim() : ''; }
  function _footPreview() {
    var host = $('rp-b-foot'); if (!host) return;
    var comp = _v('rp-b-company') || _v('rp-b-name') || 'Deine Kanzlei';
    var line2 = [_v('rp-b-address'), [_v('rp-b-plz'), _v('rp-b-city')].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    var line3 = [_v('rp-b-phone'), _v('rp-b-email'), _v('rp-b-website')].filter(Boolean).join(' · ');
    host.innerHTML = '<b style="color:#3a352c">So sieht der Fuß im PDF deiner Kunden aus:</b><br>' +
      '<span style="color:#2a2727;font-weight:600">' + esc(comp) + '</span>' +
      (_v('rp-b-tagline') ? '<br>' + esc(_v('rp-b-tagline')) : '') +
      (line2 ? '<br>' + esc(line2) : '') +
      (line3 ? '<br>' + esc(line3) : '') +
      (!line2 && !line3 ? '<br><i style="color:#b8625c">Noch keine Kontaktdaten. Der Fuß bleibt leer.</i>' : '');
  }
  /* W7-livepreview: las vorher das beim Tab-Oeffnen geladene Objekt -> ein
     Farbwechsel im Waehler kam nie an (W6-Bug). Jetzt LIVE aus dem Formular. */
  /* v3301 · Partner sieht seine Marke selbst (mandant-branding.js, rolle 'partner') */
  function _istAdmin() { try { var se = window.Auth && Auth.getSession && Auth.getSession(); return !!(se && se.role === 'admin'); } catch (e) { return false; } }   /* v3630i */
  function _partnerSiehtMarke() {
    try { return !!(window.DealPilotMandantBranding && DealPilotMandantBranding.rolle &&
                    DealPilotMandantBranding.rolle() === 'partner'); } catch (e) { return false; }
  }
  function _previewOn() {
    var el = $('rp-b-prev');
    /* v3301 · beim Partner laeuft die Live-Vorschau immer, solange Whitelabel an ist */
    if (_partnerSiehtMarke() || !_istAdmin()) {   /* v3630i · auch bei Marke AUS (dann liefert my-branding keine Rolle) */  var wl = $('rp-b-wl'); return !!(wl && wl.checked); }
    return !!(el && el.checked);
  }
  /* v1114: reichte NUR accent und obsidian durch — von fuenf Werten zwei.
     Die drei anderen Aufrufer derselben API geben alles mit
     (mandant-branding.js:57 und :240, _ownerBoot unten in dieser Datei).

     GEMESSEN, Partner-Konto mit gespeichertem Logo und Namen: nach
     "Branding speichern" blieb die Wortmarke DealPilot und das Logo das
     alte (0 ersetzte Wortmarken, Logo keine Data-URI). Nach dem NEULADEN
     kam beides — weil dann _ownerBoot mit dem vollstaendigen Satz laeuft.
     Das ist Marcels "erst nach dem Neuladen sieht man die Aenderung": es
     fehlt nicht der Repaint, es fehlt der halbe Datensatz. Derselbe
     Fehlertyp wie v1096b — zwei Wege, einer unvollstaendig. */
  function _applyPreview() {
    try {
      if (!window.DealPilotWhitelabel) return;
      var acc = _v('rp-b-accent');
      if (!/^#[0-9a-fA-F]{6}$/.test(acc)) return;
      var obs = _v('rp-b-obsidian');
      var _stp = _akzentStufen(acc);   /* v3630e · Standard mit den festen Gold-Toenen */
      window.DealPilotWhitelabel.apply({
        accent: acc, accentHi: _stp.hi, accentLo: _stp.lo,
        obsidian: /^#[0-9a-fA-F]{6}$/.test(obs) ? obs : null,
        name: _v('rp-b-name') || '',
        logo: _currentLogo() || '',
        /* v3630 · gewaehlte Darstellung und Groesse live in der App */
        logoDunkel: (_brandState.vari && _brandState.vari.v && _brandState.vari.v.auf_dunkel) || '',
        logoHell: (_brandState.vari && _brandState.vari.v && _brandState.vari.v.auf_hell) || '',
        logoGroesse: _brandState.groesse || 100,
        logoAusrichtung: _brandState.ausrichtung || 'links'   /* v3630e */
      });
      _rpTinte();   /* v3301 · Hero-Text folgt der Vorschaufarbe */
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
    if (_brandState.logoDark !== undefined) body.brand_logo_dark_b64 = _brandState.logoDark;   /* v3299 */
    body.brand_logo_darstellung = _brandState.darstellung || 'auto';   /* v3630 */
    body.brand_logo_groesse = _brandState.groesse || 100;              /* v3630 */
    body.brand_logo_pdf_groesse = _brandState.pdfGroesse || 100;       /* v3630b */
    body.brand_logo_ausrichtung = _brandState.ausrichtung || 'links';  /* v3630e */
    /* v3630e · Abstufungen zum Akzent mitspeichern (Standard: die festen Gold-Toene) */
    if (/^#[0-9a-fA-F]{6}$/.test(body.brand_accent)) { var _st3 = _akzentStufen(body.brand_accent); body.brand_accent_hi = _st3.hi; body.brand_accent_lo = _st3.lo; }
    /* v3299 · Logo-Kontrast: Varianten je Grund mitschicken (PNG, auch fuer SVG-Logos) */
    try {
      if (_currentLogo()) {
        /* v3630 · hiess bis hier _v - und verdeckte damit (var wird gehoben) die Hilfsfunktion _v()
           in der GANZEN Funktion: _v('rp-b-company') unten warf, Kontaktdaten blieben ungespeichert,
           der Partner sah 'Speichern fehlgeschlagen'. Seit v3299. */
        var _vv = await _variantenFuer();
        if (_vv) body.brand_logo_varianten = { auf_dunkel: _vv.auf_dunkel, auf_hell: _vv.auf_hell, messung: _vv.messung };
      } else if (_brandState.logo === '') {
        body.brand_logo_varianten = null;
      }
    } catch (e) {}
    try {
      await api('/branding', { method: 'PUT', body: body });
      /* W1b-contact-ui: Kontaktdaten ueber die eigene Route (laesst Logo-/Accent-Logik unangetastet) */
      await api('/branding-contact', { method: 'PUT', body: {
        brand_company: _v('rp-b-company'), brand_tagline: _v('rp-b-tagline'),
        brand_address: _v('rp-b-address'), brand_plz: _v('rp-b-plz'), brand_city: _v('rp-b-city'),
        brand_phone: _v('rp-b-phone'), brand_email: _v('rp-b-email'), brand_website: _v('rp-b-website'),
        brand_mail_accent: _v('rp-b-mail'),   /*W8-editor*/
        brand_pdf_light: _v('rp-b-pdflight') === '1'   /*W12-portallight*/
      } });
      toast('✓ Branding gespeichert');
      try { if (_previewOn()) _applyPreview(); } catch (e) {}   /*W7-livepreview*/
      if (_brandState.logo !== undefined) { _brandState.current_logo = _brandState.logo; _brandState.logo = undefined; }
      if (_brandState.logoDark !== undefined) { _brandState.current_logo_dark = _brandState.logoDark; _brandState.logoDark = undefined; }   /* v3299 */
      _brandState.darstellung_gespeichert = _brandState.darstellung; _brandState.groesse_gespeichert = _brandState.groesse;   /* v3630 */
      /* v3630b · gespeicherter Stand fuer Zuruecksetzen, und sofort in den Markensatz (PDFs) */
      _brandState.gespeichert = { accent: _v('rp-b-accent'), obsidian: _v('rp-b-obsidian'), mail: _v('rp-b-mail'),
        pdflight: _v('rp-b-pdflight') === '1', darstellung: _brandState.darstellung, groesse: _brandState.groesse, pdfGroesse: _brandState.pdfGroesse, ausrichtung: _brandState.ausrichtung };
      try {
        if (window.DealPilotMandantBranding && DealPilotMandantBranding.merke) {
          var mf = { brand_logo_pdf_groesse: _brandState.pdfGroesse, brand_pdf_light: _v('rp-b-pdflight') === '1',
                     brand_logo_groesse: _brandState.groesse, brand_logo_darstellung: _brandState.darstellung, brand_logo_ausrichtung: _brandState.ausrichtung,
                     brand_accent: body.brand_accent, brand_accent_hi: body.brand_accent_hi, brand_accent_lo: body.brand_accent_lo, brand_obsidian: body.brand_obsidian, brand_mail_accent: _v('rp-b-mail') };
          if (body.brand_logo_b64 !== undefined) mf.brand_logo_b64 = body.brand_logo_b64 || null;
          if (body.brand_logo_varianten) { mf.brand_logo_auf_dunkel = body.brand_logo_varianten.auf_dunkel; mf.brand_logo_auf_hell = body.brand_logo_varianten.auf_hell; }
          DealPilotMandantBranding.merke(mf);
        }
      } catch (e8) {}
      try { _logoPrev(); } catch (e4) {}
      /* v3630i · Marcel: „Zuruecksetzen geht nicht auf DealPilot." Gemessen am Partner-Testkonto:
         Haken aus -> live nichts (die Vorschau laeuft nur, solange die Marke AN ist), nach dem
         Speichern nichts, nach dem ersten Neuladen weiter die Marke (dp_wl_cache faerbt vor dem
         Abruf, der Abruf liefert null und loescht nur den Merker), erst das zweite Neuladen
         zeigt DealPilot. Logo im Markenfeld, Groesse und Ausrichtung baut die Seite beim Start -
         sauber zurueck kommt sie nur mit einem Neustart. Deshalb: Marke an/aus gewechselt ->
         Merker weg, einmal neu laden, danach die Verwaltung wieder oeffnen. */
      var wlNeu = !!body.whitelabel_enabled;
      if (wlNeu !== !!_brandState.wlGespeichert) {
        _brandState.wlGespeichert = wlNeu;
        try { localStorage.removeItem('dp_wl_cache'); localStorage.removeItem('dp_wl_preview'); sessionStorage.setItem('dp_verw_oeffnen', 'marke'); } catch (e9) {}
        toast(wlNeu ? 'Deine Marke ist an. Die App lädt neu.' : 'DealPilot ist wieder aktiv. Die App lädt neu.');
        setTimeout(function () { location.reload(); }, 900);
      }
      return true;
    } catch (e) { toast(e && e.status === 413 ? 'Logo zu groß (max ~300 KB)' : 'Speichern fehlgeschlagen'); return false; }
  }
  /* v3630i · „Auf DealPilot zuruecksetzen" mit Bestaetigung: nur ausschalten oder alles auf Standard */
  function _aufDealPilot() {
    var alt = document.getElementById('rp-b-dp-dlg'); if (alt) alt.remove();
    var d = document.createElement('div'); d.id = 'rp-b-dp-dlg';
    d.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(10,10,12,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    var knopf = 'display:block;width:100%;text-align:left;padding:12px 14px;border:1px solid #e6e0d4;border-radius:10px;background:#fff;cursor:pointer;font:400 12.5px/1.45 Inter;color:#3a352c;margin-top:8px';
    d.innerHTML = '<div role="dialog" aria-modal="true" style="max-width:460px;width:100%;background:#fff;border-radius:14px;padding:20px 20px 16px;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
      '<div style="font:700 17px \'Space Grotesk\',Inter,sans-serif;color:#2a2727">Auf DealPilot zurücksetzen</div>' +
      '<p style="font:400 13px/1.5 Inter;color:#6b6558;margin:8px 0 4px">Deine Kunden und du sehen danach wieder DealPilot: Logo, Gold und dunkles Menü. Die App lädt dafür einmal neu.</p>' +
      '<button type="button" data-dp="aus" style="' + knopf + '"><b style="font-size:13.5px">Nur ausschalten</b><br>Eigene Marke aus. Logo, Farben und Einstellungen bleiben gespeichert, du kannst sie später wieder einschalten.</button>' +
      '<button type="button" data-dp="alles" style="' + knopf + '"><b style="font-size:13.5px">Alles auf Standard</b><br>Eigene Marke aus, Logo entfernen, Farben auf DealPilot-Gold, Größe 100 %, links, Darstellung automatisch, Deckblatt dunkel, PDF-Logo 100 %. Name und Absender im PDF-Fuß bleiben.</button>' +
      '<div style="text-align:right;margin-top:12px"><button type="button" data-dp="nein" style="padding:9px 14px;border:1px solid #e6e0d4;border-radius:9px;background:#fff;cursor:pointer;font:600 13px Inter;color:#3a352c">Abbrechen</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-dp]') : null;
      if (!b) { if (e.target === d) d.remove(); return; }
      var was = b.getAttribute('data-dp'); d.remove();
      if (was === 'nein') return;
      var wl = $('rp-b-wl'); if (wl) wl.checked = false;
      if (was === 'alles') {
        _brandState.logo = ''; _brandState.logoDark = '';
        $('rp-b-accent').value = STANDARD_AKZENT.a; $('rp-b-mail').value = STANDARD_AKZENT.a; $('rp-b-obsidian').value = '#0b0b0a';
        $('rp-b-pdflight').value = '0';
        _brandState.darstellung = 'auto'; _brandState.groesse = 100; _brandState.ausrichtung = 'links'; _brandState.pdfGroesse = 100;
        $('rp-b-gr').value = '100'; $('rp-b-pdfgr').value = '100';
      }
      saveBranding();
    });
  }
  /* v3630k · Marcel: „Koennen wir die einzelnen Reiter ... noch cooler darstellen, unter Marke
     vielleicht mit Bild?" Kleine, lebendige Vorschauen aus dem AKTUELLEN Formularstand (nicht dem
     gespeicherten): Liste links (markeVorschau) und Kopfkarte im Bereich Marke (_kopfZeigen). */
  function _vorschauDaten() {
    var v = _brandState.vari && _brandState.vari.v;
    var l = _currentLogo();
    return {
      wl: !!($('rp-b-wl') && $('rp-b-wl').checked),
      name: _v('rp-b-name') || 'Deine Marke',
      akz: _v('rp-b-accent') || STANDARD_AKZENT.a, obs: _v('rp-b-obsidian') || '#0b0b0a', mail: _v('rp-b-mail') || _v('rp-b-accent') || STANDARD_AKZENT.a,
      dunkel: l ? ((v && v.auf_dunkel) || _currentLogoDark() || l) : '', hell: l ? ((v && v.auf_hell) || l) : '',
      pdfHell: _v('rp-b-pdflight') === '1', mitte: _brandState.ausrichtung === 'mitte'
    };
  }
  function markeVorschau() {
    var d = _vorschauDaten(), dpAkz = STANDARD_AKZENT.a;
    var akz = d.wl ? d.akz : dpAkz, obs = d.wl ? d.obs : '#0b0b0a';
    var bild = function (src, mh, mw) { return '<img src="' + esc(src) + '" alt="" style="display:block;max-height:' + mh + 'px;max-width:' + mw + 'px">'; };
    var wort = function (gr) { return '<span style="font:700 ' + gr + 'px \'Space Grotesk\',sans-serif;color:#F2EDE3;white-space:nowrap">Deal<i style="font-style:normal;color:' + dpAkz + '">Pilot</i></span>'; };
    var markeMini = (d.wl && d.dunkel) ? bild(d.dunkel, 18, 54) : (d.wl ? '<span style="font:700 9px Inter;color:#F2EDE3;white-space:nowrap;overflow:hidden;max-width:54px;display:block;text-overflow:ellipsis">' + esc(d.name) + '</span>' : wort(10));
    return {
      marke: '<span style="display:flex;align-items:center;justify-content:' + (d.mitte ? 'center' : 'flex-start') + ';width:66px;height:30px;padding:0 6px;box-sizing:border-box;border-radius:4px;background:' + esc(obs) + ';box-shadow:inset 0 -2px 0 ' + esc(akz) + '">' + markeMini + '</span>',
      logo: d.dunkel
        ? '<span style="display:flex;gap:3px"><span style="width:31px;height:30px;border-radius:4px;background:#0e0d0b;display:flex;align-items:center;justify-content:center;padding:3px;box-sizing:border-box">' + bild(d.dunkel, 22, 25) + '</span>' +
          '<span style="width:31px;height:30px;border-radius:4px;background:#fff;border:1px solid #E6E1D6;display:flex;align-items:center;justify-content:center;padding:3px;box-sizing:border-box">' + bild(d.hell, 22, 25) + '</span></span>'
        : '<span style="width:66px;height:30px;border-radius:4px;border:1px dashed #D9CFB8;display:flex;align-items:center;justify-content:center;font:500 9px Inter;color:#7A7370">kein Logo</span>',
      farben: '<span style="display:flex;gap:3px">' + [akz, obs, d.wl ? d.mail : dpAkz].map(function (f) { return '<i style="display:block;width:20px;height:30px;border-radius:4px;background:' + esc(f) + ';border:1px solid rgba(0,0,0,.08)"></i>'; }).join('') + '</span>',
      dokumente: '<span style="position:relative;display:block;width:24px;height:32px;margin-left:21px;border-radius:2px;background:' + (d.pdfHell ? '#fff' : '#2A2727') + ';border:1px solid #E6E1D6;overflow:hidden">' +
        (d.wl && (d.pdfHell ? d.hell : d.dunkel) ? '<img src="' + esc(d.pdfHell ? d.hell : d.dunkel) + '" alt="" style="position:absolute;left:3px;right:3px;top:4px;margin:auto;max-width:18px;max-height:9px">' : '') +
        '<i style="position:absolute;left:0;right:0;top:17px;height:1px;background:' + esc(akz) + '"></i><i style="position:absolute;left:5px;right:5px;top:21px;height:2px;background:' + (d.pdfHell ? '#2A2727' : '#fff') + ';opacity:.5"></i></span>'
    };
  }
  /* Kopfkarte im Bereich Marke: so sieht die App mit deiner Marke aus (Menueleiste, Kopf, eine Karte) */
  function _kopfZeigen() {
    var host = $('rp-b-kopf'); if (!host) return;
    var d = _vorschauDaten(), dpAkz = STANDARD_AKZENT.a;
    var akz = d.wl ? d.akz : dpAkz, obs = d.wl ? d.obs : '#0b0b0a';
    var marke = (d.wl && d.dunkel) ? '<img src="' + esc(d.dunkel) + '" alt="" style="display:block;max-width:100%;max-height:' + Math.round(34 * Math.min(1.6, (_brandState.groesse || 100) / 100)) + 'px">'
      : (d.wl ? '<span style="font:700 13px \'Space Grotesk\',sans-serif;color:#F2EDE3">' + esc(d.name) + '</span>'
              : '<span style="font:700 18px \'Space Grotesk\',sans-serif;color:#F2EDE3">Deal<i style="font-style:normal;color:' + dpAkz + '">Pilot</i></span>');
    var zeile = function (t, an) { return '<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:4px;font:500 10.5px Inter;color:' + (an ? '#fff' : 'rgba(242,237,227,.62)') + ';background:' + (an ? 'rgba(255,255,255,.07)' : 'none') + (an ? ';box-shadow:inset 2px 0 0 ' + esc(akz) : '') + '">' + t + '</div>'; };
    host.innerHTML =
      '<div style="display:grid;grid-template-columns:150px 1fr;height:196px;border-radius:6px;overflow:hidden;border:1px solid #E6E1D6;background:#F4F2ED">' +
        '<div style="background:' + esc(obs) + ';padding:10px 8px;display:flex;flex-direction:column;gap:3px">' +
          '<div style="height:48px;display:flex;align-items:center;justify-content:' + (d.mitte ? 'center' : 'flex-start') + ';padding:0 4px;margin-bottom:6px">' + marke + '</div>' +
          '<div style="font:700 8px \'JetBrains Mono\',monospace;letter-spacing:1px;color:' + esc(akz) + ';padding:0 8px 3px">ANSICHTEN</div>' +
          zeile('Einzelobjekt', true) + zeile('Portfolio-Cockpit') + zeile('Partner-Cockpit') + '</div>' +
        '<div style="display:flex;flex-direction:column;min-width:0">' +
          '<div style="height:34px;background:' + esc(obs) + ';border-bottom:2px solid ' + esc(akz) + ';display:flex;align-items:center;gap:12px;padding:0 12px;font:600 10.5px Inter;color:#F2EDE3">Objekt<span style="opacity:.55;font-weight:500">Investition</span><span style="opacity:.55;font-weight:500">Miete</span></div>' +
          '<div style="padding:12px;flex:1;min-width:0">' +
            '<div style="background:#fff;border:1px solid color-mix(in srgb,' + esc(akz) + ' 22%,transparent);border-radius:2px;padding:10px 12px;display:flex;align-items:center;gap:12px">' +
              '<span style="flex:none;width:44px;height:44px;border-radius:50%;background:conic-gradient(' + esc(akz) + ' 0 74%,#EDE6D6 0);display:flex;align-items:center;justify-content:center"><span style="width:34px;height:34px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font:700 12px \'Space Grotesk\',sans-serif;color:#2A2727">74</span></span>' +
              '<span style="min-width:0"><span style="display:block;font:700 9px \'JetBrains Mono\',monospace;letter-spacing:1.2px;color:#6B645A">OBJEKTDATEN</span>' +
              '<span style="display:block;font:600 12px Inter;color:#2A2727;margin-top:2px">Musterstraße 1, Musterstadt</span>' +
              '<span style="display:inline-block;margin-top:6px;padding:4px 9px;border-radius:8px;background:' + esc(akz) + ';color:#fff;font:600 10px Inter">Bericht abrufen</span></span>' +
            '</div></div></div></div>' +
      '<div class="hint dp-verw-hint" style="margin-top:6px">' + (d.wl ? 'So sehen deine Kunden die App mit deiner Marke. Stand des Formulars, gespeichert wird mit Speichern.' : 'Deine Marke ist aus. Deine Kunden sehen DealPilot.') + '</div>';
  }
  /* v3630i · Stand je Bereich, eine Zeile fuer die Liste links in der Verwaltung */
  function markeStand() {
    var akz = String(_v('rp-b-accent') || '').toLowerCase(), name = '';
    if (akz === STANDARD_AKZENT.a.toLowerCase()) name = 'Standard (DealPilot-Gold)';
    else AKZENT_GRUPPEN.forEach(function (g) { g[1].forEach(function (t) { if (t[0].toLowerCase() === akz) name = t[1]; }); });
    var wl = $('rp-b-wl') && $('rp-b-wl').checked;
    var dst = { auto: 'Automatisch', hell: 'Hell eingefärbt', weiss: 'Weiße Fläche', gold: 'Rahmen hell', 'gold-dunkel': 'Rahmen dunkel' }[_brandState.darstellung || 'auto'];
    return {
      marke: (wl ? 'An' : 'Aus, DealPilot') + (_v('rp-b-name') ? ' · ' + _v('rp-b-name') : ''),
      logo: (_currentLogo() ? dst + ' · ' + (_brandState.groesse || 100) + ' % · ' + ((_brandState.ausrichtung || 'links') === 'mitte' ? 'mittig' : 'links') : 'Kein Logo'),
      farben: name || (akz ? 'Eigene Farbe ' + akz.toUpperCase() : 'Standard'),
      dokumente: 'Deckblatt ' + (_v('rp-b-pdflight') === '1' ? 'hell' : 'dunkel') + ' · Logo ' + (_brandState.pdfGroesse || 100) + ' %',
      plaetze: 'Plätze und Abrechnung'
    };
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
      /* v3357 · Konzept 13.11.2026: ein BESTEHENDES Konto wird nie still verbunden - erst fragen (mein-partner.js) */
      if (window.DpMeinPartner && typeof window.DpMeinPartner.einladungFragen === 'function') {
        try {
          var _ri = await fetch('/api/v1/reseller-invite/info?token=' + encodeURIComponent(token));
          var _info = _ri.ok ? await _ri.json() : null;
          if (!_info || !_info.valid) { try { localStorage.removeItem('rp_invite_token'); } catch (e) {} return; }
          window.DpMeinPartner.einladungFragen(token, _info);
          return;
        } catch (e) { return; }
      }
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
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#0b0b0a;color:#fff;border-top:2px solid var(--wl-c9a84c, #C9A84C);padding:14px 22px;display:flex;align-items:center;gap:12px;font-family:Inter,sans-serif;font-size:13.5px;flex-wrap:wrap';
      b.innerHTML = '<span style="flex:1;min-width:220px"><b style="color:var(--wl-e8cc7a, #E8CC7A)">' + esc(info.brand_name) + '</b> hat dich zu DealPilot eingeladen. Leg ein Konto mit <b>' + esc(info.email) + '</b> an, um loszulegen.</span>' +
        '<button id="rp-inv-reg" style="background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C),var(--wl-b8932f, #b8932f));color:var(--rp-tinte, #241c05);border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;font-family:inherit">Konto anlegen</button>' +
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

  // ── v3317 · Objekt-Übergabe annehmen (läuft für ALLE, wie die Einladung) ──
  /* Link aus der Mail: /?rp_uebergabe=<token>. Angemeldet -> Band mit "Objekt übernehmen"
     (ausdrücklich, damit nicht ein falsches Konto das Objekt bekommt). Nicht angemeldet
     -> Band mit Konto anlegen / anmelden; nach der Anmeldung wird übernommen. Danach
     wird die Kopie geöffnet. */
  var UEB_ANNAHME_FEHLER = {
    schon_uebernommen: 'Dieses Objekt wurde schon übernommen.',
    uebernommen: 'Dieses Objekt wurde schon übernommen.',
    abgelaufen: 'Der Link ist abgelaufen - bitte deinen Ansprechpartner um eine neue Übergabe.',
    widerrufen: 'Diese Übergabe wurde zurückgezogen.',
    partnerkonto: 'Mit einem Partner-Konto lässt sich keine Übergabe annehmen - bitte mit dem Kundenkonto anmelden.',
    mandant_anderer_partner: 'Dein Konto wird schon von einem anderen Partner betreut.',
    objekt_geloescht: 'Das Objekt gibt es nicht mehr.',
    uebergabe_nicht_gefunden: 'Diese Übergabe gibt es nicht.'
  };
  function _uebTokenWeg() {
    try { localStorage.removeItem('rp_uebergabe_token'); } catch (e) {}
    try { var q2 = new URLSearchParams(location.search); q2.delete('rp_uebergabe'); history.replaceState({}, '', location.pathname + (q2.toString() ? '?' + q2.toString() : '')); } catch (e) {}
  }
  async function handleUebergabe() {
    var token = null;
    try {
      token = new URLSearchParams(location.search).get('rp_uebergabe');
      if (token) { try { localStorage.setItem('rp_uebergabe_token', token); } catch (e) {} }
      else { try { token = localStorage.getItem('rp_uebergabe_token'); } catch (e) {} }
    } catch (e) {}
    if (!token) return;
    var info = null;
    try {
      var resp = await fetch('/api/v1/objekt-uebergabe/info?token=' + encodeURIComponent(token));
      if (resp.ok) info = await resp.json(); else if (resp.status === 404) { _uebTokenWeg(); toast(UEB_ANNAHME_FEHLER.uebergabe_nicht_gefunden); return; }
    } catch (e) {}
    if (!info) return;
    if (!info.valid) { _uebTokenWeg(); toast(UEB_ANNAHME_FEHLER[info.status] || 'Diese Übergabe ist nicht mehr gültig.'); return; }
    var loggedIn = false; try { loggedIn = !!localStorage.getItem('ji_token'); } catch (e) {}
    uebBand(token, info, loggedIn);
  }
  function uebBand(token, info, loggedIn) {
    var alt = $('rp-ueb-band'); if (alt) alt.remove();
    var ich = ''; try { var _s = Auth.getSession && Auth.getSession(); ich = (_s && _s.email) || ''; } catch (e) {}
    var o = info.objekt || {};
    var b = document.createElement('div'); b.id = 'rp-ueb-band';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#0b0b0a;color:#fff;border-top:2px solid var(--wl-c9a84c, #C9A84C);padding:14px 22px;display:flex;align-items:center;gap:12px;font-family:Inter,sans-serif;font-size:13.5px;flex-wrap:wrap';
    var knopf = 'background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C),var(--wl-b8932f, #b8932f));color:var(--rp-tinte, #241c05);border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;font-family:inherit';
    var zweit = 'background:none;border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;padding:9px 14px;cursor:pointer;font-family:inherit';
    var text = '<b style="color:var(--wl-e8cc7a, #E8CC7A)">' + esc(info.brand_name) + '</b> übergibt dir das Objekt <b>' + esc(o.adresse || '') + '</b>' +
      (o.score != null ? ' (Score ' + esc(o.score) + (o.stufe ? ' · ' + esc(o.stufe) : '') + ')' : '') + '. ' +
      (info.platz_reserviert ? 'Dein Zugang ist schon freigeschaltet. ' : '');   /* v3317b · Platz mitgeschickt */
    b.innerHTML = loggedIn
      ? '<span style="flex:1;min-width:220px">' + text + 'Eine Kopie in dein Konto' + (ich ? ' <b>' + esc(ich) + '</b>' : '') + ' übernehmen?</span>' +
        '<button id="rp-ueb-ja" style="' + knopf + '">Objekt übernehmen</button><button id="rp-ueb-x" style="' + zweit + '">Später</button>'
      : '<span style="flex:1;min-width:220px">' + text + 'Leg ein Konto an' + (info.email ? ' (mit <b>' + esc(info.email) + '</b>)' : '') + ' oder melde dich an - danach liegt eine Kopie in deinem Konto.</span>' +
        '<button id="rp-ueb-reg" style="' + knopf + '">Konto anlegen</button><button id="rp-ueb-login" style="' + zweit + '">Schon ein Konto</button><button id="rp-ueb-x" style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:18px;font-family:inherit">✕</button>';
    document.body.appendChild(b);
    $('rp-ueb-x').addEventListener('click', function () { b.remove(); });
    if (loggedIn) { $('rp-ueb-ja').addEventListener('click', function () { uebAnnehmen(token); }); return; }
    var inf = { email: info.email, display_name: info.anzeige_name };
    $('rp-ueb-reg').addEventListener('click', function () { openAuth('register', inf); });
    $('rp-ueb-login').addEventListener('click', function () { openAuth('login', inf); });
    uebWatcher(token);
  }
  var _uebWatch = null;
  function uebWatcher(token) {
    if (_uebWatch) return;
    var tries = 0;
    _uebWatch = setInterval(function () {
      tries++;
      var li = false; try { li = !!localStorage.getItem('ji_token'); } catch (e) {}
      if (li) { clearInterval(_uebWatch); _uebWatch = null; setTimeout(function () { uebAnnehmen(token); }, 900); }
      if (tries > 400) { clearInterval(_uebWatch); _uebWatch = null; }
    }, 1500);
  }
  var _uebLaeuft = false;
  async function uebAnnehmen(token) {
    if (_uebLaeuft) return; _uebLaeuft = true;
    var b = $('rp-ueb-band');
    try {
      var r = await Auth.apiCall('/objekt-uebergabe/uebernehmen', { method: 'POST', body: { token: token } });
      _uebTokenWeg(); if (b) b.remove();
      toast('✓ Objekt von ' + (r.brand_name || 'deinem Partner') + ' übernommen' + (r.seat_assigned ? ' - Zugang freigeschaltet' : ''));
      /* neuer Mandant: Marke und Plan frisch laden, die Kopie öffnet sich nach dem Neuladen (rp_offen) */
      if (r.neuer_mandant) { setTimeout(function () { location.href = location.pathname + '?rp_offen=' + encodeURIComponent(r.object_id); }, 1100); return; }
      setTimeout(function () { try { if (typeof window.loadSaved === 'function') window.loadSaved(r.object_id); if (typeof window.renderSaved === 'function') window.renderSaved(); } catch (e) {} }, 300);
    } catch (e) {
      var code = e && e.message;
      if (e && (e.status === 409 || e.status === 410 || e.status === 404) && code !== 'partnerkonto' && code !== 'mandant_anderer_partner') _uebTokenWeg();
      if (b) b.remove();
      toast(UEB_ANNAHME_FEHLER[code] || ('Übernahme fehlgeschlagen' + (code ? ': ' + code : '')));
    } finally { _uebLaeuft = false; }
  }
  /* nach dem Neuladen (neuer Mandant): die Kopie öffnen */
  function uebOffen() {
    var id = null; try { id = new URLSearchParams(location.search).get('rp_offen'); } catch (e) {}
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    try { var q2 = new URLSearchParams(location.search); q2.delete('rp_offen'); history.replaceState({}, '', location.pathname + (q2.toString() ? '?' + q2.toString() : '')); } catch (e) {}
    var n = 0;
    (function versuch() {
      n++;
      if (typeof window.loadSaved === 'function' && window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) {
        setTimeout(function () { try { window.loadSaved(id); if (typeof window.renderSaved === 'function') window.renderSaved(); } catch (e) {} }, 1500);
        return;
      }
      if (n < 20) setTimeout(versuch, 700);
    })();
  }

  // ── Boot ───────────────────────────────────────────────────
  var _mo = new MutationObserver(function () { if (_st.gated) { try { ensureEntry(); } catch (e) {} } });
  async function boot() {
    try {
      await handleInvite();
      if (!_st._uebGelaufen) { _st._uebGelaufen = true; try { await handleUebergabe(); uebOffen(); } catch (e) {} }   /* v3317 · einmal je Seite, boot() laeuft bis zu siebenmal */
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
  /* W17-portallisten: Statt nur zu pollen (W7) hoeren wir jetzt auf das Signal.
     Der Retry bleibt als zweites Netz — falls das Event schon gefeuert hat,
     bevor dieses Modul geladen war, faengt DealPilotPlanReady das ab. */
  window.addEventListener('dp:plan-ready', function () { _bootRetry(0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { _bootRetry(0); });
  else _bootRetry(0);

  // Partner-Config SOFORT & ungated einspritzen (gegen Free->Partner-Race ohne Hard-Reload)
  function _earlyPill() {
    injectPartnerConfig();
    try { if (typeof window.renderSubscriptionBadge === 'function') window.renderSubscriptionBadge(); } catch (e) {}
  }
  _earlyPill();
  [400, 1200, 2500, 4000].forEach(function (ms) { setTimeout(_earlyPill, ms); });

  /* ── W26-ownerboot ────────────────────────────────────────────────────
     Gemessen am 16.07.: Der Partner meldet sich an -> DealPilot-Gold. Erst beim
     Klick auf Einstellungen -> Partner-Portal -> Branding faerbte es sich
     ploetzlich um. Grund: _applyPreview() haengt an loadBranding(), und das laeuft
     NUR, wenn der Tab geoeffnet wird. Der Haken "Ansicht meiner Mandanten" stand
     laengst auf 1 — es hat ihn nur niemand beim Login ausgewertet.
     Jetzt: beim Start pruefen und anwenden. */
  (function _ownerBoot(n) {
    var on = false;
    try { on = localStorage.getItem('dp_wl_preview') === '1'; } catch (e) {}
    if (!on) return;
    if (!window.DealPilotWhitelabel || !window.Auth || !Auth.apiCall) {
      if ((n || 0) > 20) return;
      return setTimeout(function () { _ownerBoot((n || 0) + 1); }, 700);
    }
    Auth.apiCall('/reseller/branding').then(function (r) {
      var b = r && r.branding; if (!b || !b.brand_accent) return;
      window.DealPilotWhitelabel.apply({
        accent: b.brand_accent, accentHi: b.brand_accent_hi, accentLo: b.brand_accent_lo,
        obsidian: b.brand_obsidian, name: b.brand_name, logo: b.brand_logo_b64,
        logoDunkel: b.brand_logo_auf_dunkel || '', logoHell: b.brand_logo_auf_hell || '',   /* v3299 */
        logoGroesse: b.brand_logo_groesse == null ? 100 : b.brand_logo_groesse,   /* v3630 */
        logoAusrichtung: b.brand_logo_ausrichtung || 'links'   /* v3630e */
      });
    }).catch(function () { /* kein Partner / kein Branding -> normal weiter */ });
  })(0);

  window.openResellerPortal = openResellerPortal;
  /* v3630i · nach dem Neuladen (Marke an/aus) die Verwaltung wieder oeffnen */
  (function verwNachNeuladen(n) {
    var f = null; try { f = sessionStorage.getItem('dp_verw_oeffnen'); } catch (e) {}
    if (!f) return;
    if (!window.DpPartnerKunden || !DpPartnerKunden.cockpitOeffnen || !localStorage.getItem('ji_token')) {
      if ((n || 0) > 40) return;
      return setTimeout(function () { verwNachNeuladen((n || 0) + 1); }, 500);
    }
    try { sessionStorage.removeItem('dp_verw_oeffnen'); } catch (e) {}
    setTimeout(function () {
      try { DpPartnerKunden.cockpitOeffnen(); setTimeout(function () { DpPartnerKunden.reiterWahl('verwaltung'); }, 1500); } catch (e) {}
    }, 2500);
  })(0);
  window.DealPilotResellerPortal = { boot: boot, open: openResellerPortal, poolHolen: poolHolen, seatsKaufen: seatsKaufen, markeZeichnen: markeZeichnen, markeStand: markeStand, markeVorschau: markeVorschau,   /* v3630i, v3630k */ uebergabeZeichnen: uebergabeZeichnen, markeSpeichern: function () { return saveBranding(); },   /* v3392 */
    staffelSatz: staffelSatz, staffelText: staffelText,
    /* v3317 · direkt in "Übergeben" öffnen, optional mit vorgewähltem Objekt */
    uebergeben: function (objectId) { if (objectId) _st.uebObj = objectId; if (window.DpPartnerKunden) { DpPartnerKunden.reiterWahl('uebergeben'); return; } _st.sec = 'ueberg'; if (_st.open) go('ueberg'); else openResellerPortal(true); } };   /* v3500 · führt in den Cockpit-Reiter Übergeben */   /* v3390: openResellerPortal fuehrt ins Cockpit, Verwaltung oeffnet _st.sec */
})();
