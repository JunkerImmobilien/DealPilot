'use strict';
/* W30-wl-token: Gold-Literale zeigen auf die Whitelabel-Ebene
   (var(--wl-<hex>, #<hex>)). Ohne Whitelabel greift der Fallback = unveraendert. */
/**
 * mandant-freigaben.js — Mandanten-Seite der Freigaben (Paket 19)
 * Settings-Eintrag "Meine Freigaben" (nur wenn der User Mandant eines Resellers
 * ist, probe-gated über GET /reseller-invite/my-reseller). Der Mandant gibt
 * eigene Objekte an seinen Betreuer frei -> object_shares (eingereicht).
 */
(function () {
  var _st = { open: false, reseller: null };
  function api(p, o) { return Auth.apiCall(p, o || {}); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function toast(m) {
    try {
      var t = document.createElement('div');
      t.textContent = m;
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100001;background:#0b0b0a;color:#fff;border:1px solid var(--wl-c9a84c, #C9A84C);border-radius:10px;padding:12px 20px;font:600 13.5px Inter;box-shadow:0 12px 40px rgba(0,0,0,.5);pointer-events:none';
      document.body.appendChild(t); setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 2400);
    } catch (e) {}
  }
  function eur(n) { if (n == null || n === '') return ''; try { return Number(n).toLocaleString('de-DE') + ' €'; } catch (e) { return String(n); } }

  function injectCss() {
    if ($('mf-css')) return;
    var s = document.createElement('style'); s.id = 'mf-css';
    s.textContent = [
      '.mf-ov{position:fixed;inset:0;z-index:99999;background:rgba(8,7,5,.62);display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(2px)}',
      '.mf-modal{width:100%;max-width:720px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);box-shadow:0 40px 100px rgba(0,0,0,.6);display:flex;flex-direction:column}',
      '.mf-bar{background:#0b0b0a;display:flex;align-items:center;padding:14px 22px}',
      '.mf-logo{font:700 18px "Space Grotesk";color:#fff}.mf-logo b{color:var(--wl-c9a84c, #C9A84C)}',
      '.mf-ctx{margin-left:auto;font:600 11px "JetBrains Mono";letter-spacing:.22em;color:var(--wl-c9a84c, #C9A84C);text-transform:uppercase}',
      '.mf-x{margin-left:20px;width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.15);color:#fff;font-size:15px;cursor:pointer;background:none}',
      '.mf-hero{background:linear-gradient(105deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 52%,var(--wl-b8932f, #b8932f));padding:20px 26px}',
      '.mf-hero h1{font:600 26px "Cormorant Garamond",serif;color:#241c05;line-height:1.05}.mf-hero p{font-size:12.5px;color:#3a2e08;margin-top:2px}',
      '.mf-work{padding:22px 26px;overflow-y:auto;background:#fff}',
      '.mf-intro{font-size:12.5px;color:#6f685d;font-style:italic;margin-bottom:16px}',
      '.mf-label{font:600 10px "JetBrains Mono";letter-spacing:.15em;text-transform:uppercase;color:var(--wl-9a7f3a, #9a7f3a);margin:0 0 12px}',
      '.mf-row{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #e6e0d4}.mf-row:last-child{border-bottom:none}',
      '.mf-th{width:40px;height:40px;border-radius:9px;background:var(--wl-f6ecd0, #f6ecd0);color:var(--wl-b8932f, #b8932f);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}',
      '.mf-nm{font:600 13.5px "Space Grotesk"}.mf-mt{font-size:11.5px;color:#6f685d;margin-top:1px}',
      '.mf-r{margin-left:auto;display:flex;align-items:center;gap:8px}',
      '.mf-btn{font:600 12px Inter;padding:7px 12px;border-radius:8px;border:1px solid var(--wl-e8d9a8, #e8d9a8);background:#fff;color:var(--wl-b8932f, #b8932f);cursor:pointer;white-space:nowrap}.mf-btn:hover{background:var(--wl-faf4e6, #faf4e6)}',
      '.mf-btn.red{color:#B86250;border-color:#e6cbc5}',
      '.mf-bg{font:600 9px "JetBrains Mono";padding:4px 8px;border-radius:20px;white-space:nowrap}',
      '.mf-bg.ein{background:var(--wl-fbf1dc, #fbf1dc);color:var(--wl-b8932f, #b8932f)}.mf-bg.best{background:#e2f0e6;color:#3FA56C}.mf-bg.zur{background:#fbeeec;color:#B86250}',
      '.mf-ph{color:#9a9284;font-size:12.5px;padding:14px 0;font-style:italic}',
      '.mf-foot{background:#FAF7F0;border-top:1px solid #e6e0d4;padding:11px 26px;display:flex;align-items:center;gap:12px}',
      '.mf-foot .st{font-size:12px;color:#6f685d;display:flex;align-items:center;gap:8px}.mf-foot .st .d{width:8px;height:8px;border-radius:50%;background:#3FA56C}',
      '.mf-foot .close{margin-left:auto;border:1px solid #e6e0d4;background:#fff;font:600 13px Inter;padding:9px 18px;border-radius:9px;cursor:pointer}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function open() {
    if (_st.open) return; injectCss();
    var brand = (_st.reseller && _st.reseller.brand_name) ? _st.reseller.brand_name : 'deinen Betreuer';
    var ov = document.createElement('div'); ov.className = 'mf-ov'; ov.id = 'mf-ov';
    ov.innerHTML =
      '<div class="mf-modal">' +
        '<div class="mf-bar"><span class="mf-logo">Deal<b>Pilot</b></span><span class="mf-ctx">Meine Freigaben</span><button class="mf-x" id="mf-x">✕</button></div>' +
        '<div class="mf-hero"><h1>Objekte freigeben</h1><p>Gib Objekte an <b>' + esc(brand) + '</b> zur Prüfung frei.</p></div>' +
        '<div class="mf-work" id="mf-work"><p class="mf-ph">Lade…</p></div>' +
        '<div class="mf-foot"><span class="st"><span class="d"></span>betreut von ' + esc(brand) + '</span><button class="close" id="mf-close">Schließen</button></div>' +
      '</div>';
    document.body.appendChild(ov); _st.open = true;
    $('mf-x').addEventListener('click', close); $('mf-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', _esc);
    load();
  }
  function _esc(e) { if (e.key === 'Escape') close(); }
  function close() { var o = $('mf-ov'); if (o) o.remove(); document.removeEventListener('keydown', _esc); _st.open = false; }

  async function load() {
    var w = $('mf-work'); if (!w) return;
    try {
      /* W24-items: Die API liefert { items: [...], count: n } — hier stand `or.objects`.
         Ergebnis: objs war IMMER leer, und die Meldung unten log den Mandanten an
         ("Alle Objekte sind bereits freigegeben"), obwohl gar nichts freigegeben war.
         Gemessen: Auth.apiCall('/objects?limit=100') -> {items: Array(1), count: 1}.
         Beide Namen akzeptieren, falls die API mal wechselt. */
      var or = await api('/objects?limit=100');
      var objs = (or && (or.items || or.objects)) || [];
      var sr = await api('/reseller-invite/my-shares'); var shares = (sr && sr.shares) || [];
      var sharedIds = {}; shares.forEach(function (s) { sharedIds[s.object_id] = s.status; });
      var brand = (_st.reseller && _st.reseller.brand_name) ? _st.reseller.brand_name : 'deinem Betreuer';

      var free = objs.filter(function (o) { return !sharedIds[o.id]; });
      var objRows = free.length ? free.map(function (o) {
        var nm = o.name || o.kuerzel || 'Objekt';
        var mt = [o.seq_no, o.ort, eur(o.kaufpreis)].filter(Boolean).map(esc).join(' · ');
        return '<div class="mf-row"><div class="mf-th">🏢</div><div><div class="mf-nm">' + esc(nm) + '</div><div class="mf-mt">' + mt + '</div></div>' +
          '<div class="mf-r"><button class="mf-btn" data-share="' + o.id + '">Freigeben →</button></div></div>';
      }).join('') : (objs.length
          ? '<p class="mf-ph">Alle deine Objekte sind bereits freigegeben.</p>'
          /* W24-items: vorher stand hier auch bei NULL Objekten "alle freigegeben" —
             das ist keine Info, sondern eine Falschmeldung. */
          : '<p class="mf-ph">Du hast noch keine Objekte. Lege eines an, dann kannst du es hier freigeben.</p>');

      var shRows = shares.map(function (s) {
        var badge = s.status === 'bestaetigt' ? '<span class="mf-bg best">BESTÄTIGT</span>'
          : (s.status === 'zurueckgegeben' ? '<span class="mf-bg zur">ZURÜCKGEGEBEN</span>' : '<span class="mf-bg ein">EINGEREICHT</span>');
        var mt = ['an ' + brand, s.ort].filter(Boolean).map(esc).join(' · ');
        return '<div class="mf-row"><div class="mf-th">📄</div><div><div class="mf-nm">' + esc(s.obj_name || 'Objekt') + '</div><div class="mf-mt">' + mt + '</div></div>' +
          '<div class="mf-r">' + badge + '<button class="mf-btn red" data-revoke="' + s.id + '">Widerrufen</button></div></div>';
      }).join('');

      w.innerHTML = '<p class="mf-intro">Freigegebene Objekte kann ' + esc(brand) + ' einsehen und prüfen — du behältst die Kontrolle und kannst jederzeit widerrufen.</p>' +
        '<p class="mf-label">Meine Objekte</p>' + objRows +
        (shRows ? '<p class="mf-label" style="margin-top:20px">Bereits freigegeben</p>' + shRows : '');
      w.querySelectorAll('[data-share]').forEach(function (b) { b.addEventListener('click', function () { share(b.getAttribute('data-share')); }); });
      w.querySelectorAll('[data-revoke]').forEach(function (b) { b.addEventListener('click', function () { revoke(b.getAttribute('data-revoke')); }); });
    } catch (e) { w.innerHTML = '<p class="mf-ph">Konnte nicht geladen werden.</p>'; }
  }
  async function share(objectId) {
    try { await api('/reseller-invite/my-shares', { method: 'POST', body: { objectId: objectId } }); toast('✓ Freigegeben'); load(); }
    catch (e) { toast('Freigeben fehlgeschlagen'); }
  }
  async function revoke(id) {
    if (!window.confirm('Freigabe widerrufen?')) return;
    try { await api('/reseller-invite/my-shares/' + id + '/revoke', { method: 'POST', body: {} }); toast('Widerrufen'); load(); }
    catch (e) { toast('Fehlgeschlagen'); }
  }

  // ── Settings-Eintrag (nur für Mandanten) ───────────────────
  function ensureEntry() {
    var tabs = document.querySelector('.settings-tabs') || (document.querySelector('.st-tab') && document.querySelector('.st-tab').parentNode);
    if (!tabs || tabs.querySelector('.st-tab[data-mf="1"]')) return;
    var src = tabs.querySelector('.st-tab[data-tab="plan"]') || tabs.querySelector('.st-tab');
    if (!src) return;
    var btn = src.cloneNode(true);
    btn.setAttribute('data-mf', '1'); btn.removeAttribute('data-tab'); btn.removeAttribute('onclick'); btn.classList.remove('active');
    var t = btn.querySelector('.help-sidebar-item-title'); if (t) t.textContent = 'Meine Freigaben'; else btn.textContent = 'Meine Freigaben';
    var d = btn.querySelector('.help-sidebar-item-desc'); if (d) d.textContent = 'Objekte an Betreuer freigeben';
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); });
    src.parentNode.insertBefore(btn, src.nextSibling);
  }

  var _mo = new MutationObserver(function () { if (_st.reseller) { try { ensureEntry(); } catch (e) {} } });
  async function boot() {
    try { if (!localStorage.getItem('ji_token')) return; } catch (e) { return; }
    try {
      var r = await api('/reseller-invite/my-reseller');
      _st.reseller = r && r.reseller;
    } catch (e) { return; }
    if (!_st.reseller) return;   // kein Mandant -> nichts injizieren
    _mo.observe(document.body, { childList: true, subtree: true });
    ensureEntry();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 800); });
  else setTimeout(boot, 800);

  window.openMeineFreigaben = open;
})();
