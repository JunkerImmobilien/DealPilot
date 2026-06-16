/* quick-boarding-share.js  ·  Quick Boarding · Teilen (qb-share)
   Selbst-einhaengend: MutationObserver injiziert "Teilen" in #obj-action-bar.
   Kein Eingriff in object-actions.js. API ueber window.Auth.apiCall('/passes', ...). */
(function () {
  'use strict';
  if (window.__qbShareLoaded) return; window.__qbShareLoaded = true;

  var MOUNT_ID = 'obj-action-bar';
  var BTN_ID = 'qb-share-btn';
  var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  function toast(m) { try { if (typeof window.toast === 'function') return window.toast(m); } catch (e) {} try { console.log('[qb-share]', m); } catch (e) {} }
  function plane() { return '<svg viewBox="0 0 24 24" fill="currentColor"><g transform="rotate(90 12 12)"><path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></g></svg>'; }

  // ── Styles (einmalig) ─────────────────────────────
  function ensureStyles() {
    if (document.getElementById('qbs-style')) return;
    var s = document.createElement('style'); s.id = 'qbs-style';
    s.textContent = [
      '#qb-share-btn{display:inline-flex;align-items:center;gap:7px;margin:10px 0 0;padding:9px 16px;border-radius:9px;border:1px solid #C9A84C;background:linear-gradient(180deg,#fff,#fbf6ea);color:#5a4a14;font:600 12.5px "DM Sans",system-ui,sans-serif;cursor:pointer}',
      '#qb-share-btn:hover{box-shadow:0 4px 14px rgba(201,168,76,.30);transform:translateY(-1px)}',
      '#qb-share-btn svg{height:15px;width:auto}',
      '.qbs-ov{position:fixed;inset:0;z-index:9000;background:rgba(5,4,3,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,system-ui,sans-serif}',
      '.qbs-modal{width:100%;max-width:440px;border-radius:18px;overflow:hidden;border:1px solid rgba(201,168,76,.22);background:linear-gradient(180deg,#15110a,#0a0908);color:#fff;box-shadow:0 40px 90px -40px #000}',
      '.qbs-h{position:relative;overflow:hidden;display:flex;align-items:center;gap:9px;padding:13px 16px;background:linear-gradient(110deg,#E8CC7A,#C9A84C 52%,#b8932f)}',
      '.qbs-h .t{font:700 11px/1 "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#5a4a14}',
      '.qbs-h .x{margin-left:auto;background:none;border:0;color:#5a4a14;font-size:20px;cursor:pointer;line-height:1}',
      '.qbs-h .fly{position:absolute;top:50%;color:#070707;transform:translate(-50%,-50%);animation:qbsfly 5s ease-in-out infinite}.qbs-h .fly svg{height:16px}',
      '@keyframes qbsfly{0%{left:12%;opacity:.25}10%{opacity:1}55%{left:52%;opacity:1}55.01%{opacity:0}56%{left:12%}66%{opacity:.25}100%{left:12%;opacity:.25}}',
      '.qbs-b{padding:18px}',
      '.qbs-prev{background:rgba(255,255,255,.03);border:1px solid rgba(201,168,76,.18);border-radius:12px;padding:12px 14px;margin-bottom:16px}',
      '.qbs-prev .nm{font:600 14px "Space Grotesk",sans-serif}.qbs-prev .ad{font:400 9px "JetBrains Mono",monospace;color:#9a9080;margin-top:3px;letter-spacing:.03em}',
      '.qbs-lbl{font:700 9px "JetBrains Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:#8d7430;margin-bottom:8px}',
      '.qbs-seg{display:flex;gap:8px;margin-bottom:18px}',
      '.qbs-seg button{flex:1;border:1px solid rgba(201,168,76,.22);background:rgba(255,255,255,.04);color:#cfc6ad;font:600 13px "Space Grotesk",sans-serif;padding:11px;border-radius:10px;cursor:pointer}',
      '.qbs-seg button.on{background:linear-gradient(180deg,#E8CC7A,#C9A84C);color:#0a0a0a;border-color:transparent}',
      '.qbs-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:12px;padding:14px;font:700 15px "Space Grotesk",sans-serif;cursor:pointer;background:linear-gradient(180deg,#E8CC7A,#C9A84C);color:#0a0a0a}',
      '.qbs-primary[disabled]{opacity:.6;cursor:default}.qbs-primary svg{height:17px}',
      '.qbs-note{font-size:11px;color:#8d846d;text-align:center;margin-top:10px;line-height:1.5}',
      '.qbs-done{text-align:center}',
      '.qbs-qr{width:160px;height:160px;margin:2px auto 14px;background:#fff;border-radius:14px;padding:10px;display:flex;align-items:center;justify-content:center}',
      '.qbs-qr img,.qbs-qr canvas{display:block;border-radius:4px}',
      '.qbs-no{display:inline-block;font:700 14px "JetBrains Mono",monospace;letter-spacing:.16em;color:#E8CC7A;border:1px dashed #8d7430;border-radius:9px;padding:6px 14px;margin-bottom:14px}',
      '.qbs-lnk{display:flex;gap:8px;margin-bottom:14px}',
      '.qbs-lnk input{flex:1;min-width:0;background:rgba(255,255,255,.05);border:1px solid rgba(201,168,76,.22);border-radius:9px;padding:10px 12px;color:#cfc6ad;font:500 11px "JetBrains Mono",monospace}',
      '.qbs-lnk button{flex:none;border:1px solid rgba(201,168,76,.22);border-radius:9px;padding:0 14px;background:#0a0a0a;color:#E8CC7A;font:700 12px "Space Grotesk",sans-serif;cursor:pointer}',
      '.qbs-share{display:flex;gap:9px;margin-bottom:16px}',
      '.qbs-share a{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;border-radius:10px;padding:12px;font:600 13px "Space Grotesk",sans-serif}',
      '.qbs-share .wa{background:#1f8a4c;color:#fff}.qbs-share .ma{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(201,168,76,.22)}',
      '.qbs-exp{font:400 10px "JetBrains Mono",monospace;color:#9a9080;margin-bottom:12px}.qbs-exp b{color:#E8CC7A}',
      '.qbs-mini{display:flex;gap:14px;justify-content:center}.qbs-mini button{background:none;border:0;color:#9a9080;font:600 11px Inter,sans-serif;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.qbs-mini button.danger{color:#D9685F}',
      '@media (prefers-reduced-motion: reduce){.qbs-h .fly{animation:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── QR-Lib bei Bedarf laden ───────────────────────
  function loadQR(cb) {
    if (window.QRCode) { cb(true); return; }
    var sc = document.createElement('script'); sc.src = QR_LIB;
    sc.onload = function () { cb(!!window.QRCode); };
    sc.onerror = function () { cb(false); };
    document.head.appendChild(sc);
  }

  function objMeta() {
    function v(id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }
    var str = v('str'), hnr = v('hnr'), plz = v('plz'), ort = v('ort');
    var name = (v('kuerzel') || ((str ? str + ' ' : '') + hnr).trim() || ort || 'Immobilie');
    var addr = ((plz ? plz + ' ' : '') + ort).trim();
    return { name: name, addr: addr };
  }

  // ── Modal ─────────────────────────────────────────
  var _days = 30, _ov = null;
  function close() { if (_ov && _ov.parentNode) _ov.parentNode.removeChild(_ov); _ov = null; }

  function shellHtml(inner) {
    return '<div class="qbs-modal" role="dialog" aria-modal="true">' +
      '<div class="qbs-h"><span class="fly">' + plane() + '</span><span class="t" id="qbs-title">Quick Boarding Pass teilen</span>' +
      '<button class="x" id="qbs-x" aria-label="Schlie\u00dfen">\u00d7</button></div>' +
      '<div class="qbs-b" id="qbs-body">' + inner + '</div></div>';
  }

  function viewCreate() {
    var m = objMeta();
    var seg = [7, 14, 30].map(function (d) { return '<button data-d="' + d + '"' + (d === _days ? ' class="on"' : '') + '>' + d + ' Tage</button>'; }).join('');
    var html =
      '<div class="qbs-prev"><div class="nm">' + esc(m.name) + '</div>' + (m.addr ? '<div class="ad">' + esc(m.addr) + '</div>' : '') + '</div>' +
      '<div class="qbs-lbl">G\u00fcltig f\u00fcr</div><div class="qbs-seg" id="qbs-seg">' + seg + '</div>' +
      '<button class="qbs-primary" id="qbs-create">' + plane() + ' Pass erstellen</button>' +
      '<div class="qbs-note">Friert die aktuellen Daten + Bilder ein. Der Empf\u00e4nger sieht eine Read-only-Karte und kann das Objekt \u00fcbernehmen. Frische Analysen auf seinem Klon kosten wie immer Kerosin.</div>';
    setBody('Quick Boarding Pass teilen', html);
    var segEl = document.getElementById('qbs-seg');
    segEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; _days = +b.getAttribute('data-d'); [].forEach.call(segEl.querySelectorAll('button'), function (x) { x.classList.remove('on'); }); b.classList.add('on'); });
    document.getElementById('qbs-create').addEventListener('click', createPass);
  }

  async function createPass() {
    var btn = document.getElementById('qbs-create');
    if (!(window.Auth && (typeof Auth.isApiMode !== 'function' || Auth.isApiMode()))) {
      toast('Zum Teilen bitte anmelden.'); return;
    }
    btn.disabled = true; btn.innerHTML = 'Erstelle Pass\u2026';
    try {
      if (typeof window.saveObj === 'function') { try { await window.saveObj(); } catch (e) {} }
      var id = window._currentObjKey;
      if (!id) { toast('Bitte das Objekt zuerst speichern.'); btn.disabled = false; btn.innerHTML = plane() + ' Pass erstellen'; return; }
      var res = await window.Auth.apiCall('/passes', { method: 'POST', body: { objectId: id, days: _days } });
      try { if (window._oabRefreshShareQr) setTimeout(window._oabRefreshShareQr, 400); } catch (e) {}
      if (!res || !res.code) throw new Error('no code');
      viewDone(res.code, res.expires_at);
    } catch (e) {
      toast('Pass konnte nicht erstellt werden.'); btn.disabled = false; btn.innerHTML = plane() + ' Pass erstellen';
    }
  }

  function viewDone(code, expiresAt) {
    var url = location.origin + '/pass.html?c=' + encodeURIComponent(code);
    var until = expiresAt ? new Date(expiresAt) : new Date(Date.now() + _days * 864e5);
    var untilTxt = isFinite(until) ? until.toLocaleDateString('de-DE') : '\u2014';
    var html =
      '<div class="qbs-done">' +
        '<div class="qbs-qr" id="qbs-qr"><span style="font:11px monospace;color:#888">QR\u2026</span></div>' +
        '<div class="qbs-no">' + esc(code) + '</div>' +
        '<div class="qbs-lnk"><input id="qbs-link" readonly value="' + esc(url) + '"><button id="qbs-cp">Kopieren</button></div>' +
        '<div class="qbs-share">' +
          '<a class="wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Schau dir diesen Deal an: ' + url) + '">WhatsApp</a>' +
          '<a class="ma" href="mailto:?subject=' + encodeURIComponent('Quick Boarding Pass') + '&body=' + encodeURIComponent('Schau dir diesen Deal an:\n' + url) + '">Mail</a>' +
        '</div>' +
        '<div class="qbs-exp" id="qbs-exp">L\u00e4uft ab am <b>' + untilTxt + '</b></div>' +
        '<div class="qbs-mini"><button id="qbs-ext">Verl\u00e4ngern (+30 Tage)</button><button class="danger" id="qbs-rev">Widerrufen</button></div>' +
      '</div>';
    setBody('Pass ist bereit', html);

    loadQR(function (ok) {
      var box = document.getElementById('qbs-qr'); if (!box) return; box.innerHTML = '';
      if (ok) { try { new window.QRCode(box, { text: url, width: 140, height: 140, colorDark: '#141210', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); return; } catch (e) {} }
      box.innerHTML = '<span style="font:10px monospace;color:#888;text-align:center;padding:10px">QR nicht verf\u00fcgbar \u2014 Link nutzen</span>';
    });

    document.getElementById('qbs-cp').addEventListener('click', function () {
      var i = document.getElementById('qbs-link'); try { i.select(); } catch (e) {}
      try { navigator.clipboard.writeText(url); } catch (e) {}
      var b = this; b.textContent = 'Kopiert \u2713'; setTimeout(function () { b.textContent = 'Kopieren'; }, 1500);
    });
    document.getElementById('qbs-ext').addEventListener('click', async function () {
      var b = this; b.disabled = true;
      try { var r = await window.Auth.apiCall('/passes/' + encodeURIComponent(code) + '/extend', { method: 'POST', body: { days: 30 } });
        var u = r && r.expires_at ? new Date(r.expires_at) : null;
        document.getElementById('qbs-exp').innerHTML = 'L\u00e4uft ab am <b>' + (u && isFinite(u) ? u.toLocaleDateString('de-DE') : untilTxt) + '</b>';
        b.textContent = 'Verl\u00e4ngert \u2713';
      } catch (e) { toast('Verl\u00e4ngern fehlgeschlagen.'); b.disabled = false; }
    });
    document.getElementById('qbs-rev').addEventListener('click', async function () {
      try { await window.Auth.apiCall('/passes/' + encodeURIComponent(code), { method: 'DELETE' }); try { if (window._oabRefreshShareQr) setTimeout(window._oabRefreshShareQr, 400); if (window._dpDealShareRefresh) setTimeout(window._dpDealShareRefresh, 400); } catch (e) {}
        setBody('Pass widerrufen', '<div class="qbs-done"><div class="qbs-no" style="color:#D9685F;border-color:#D9685F">' + esc(code) + ' widerrufen</div><div class="qbs-note">Der Link funktioniert nicht mehr. Du kannst jederzeit einen neuen Pass erstellen.</div></div>');
      } catch (e) { toast('Widerrufen fehlgeschlagen.'); }
    });
  }

  function setBody(title, html) {
    var t = document.getElementById('qbs-title'); if (t) t.textContent = title;
    var b = document.getElementById('qbs-body'); if (b) b.innerHTML = html;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function open() {
    ensureStyles(); close();
    _ov = document.createElement('div'); _ov.className = 'qbs-ov';
    _ov.innerHTML = shellHtml('');
    document.body.appendChild(_ov);
    _ov.addEventListener('click', function (e) { if (e.target === _ov) close(); });
    document.getElementById('qbs-x').addEventListener('click', close);
    viewCreate();
  }
  window.QuickBoardingShare = { open: open };

  // ── Teilen-Button selbst einhaengen ───────────────
  function injectBtn() {
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;
    if (mount.querySelector('#' + BTN_ID)) return;
    ensureStyles();
    var btn = document.createElement('button');
    btn.id = BTN_ID; btn.type = 'button';
    btn.innerHTML = plane() + ' Quick Boarding teilen';
    btn.addEventListener('click', open);
    var bar = mount.querySelector('.dp-pf') || mount.firstElementChild;
    if (bar && bar.parentNode === mount) { bar.insertAdjacentElement('afterend', btn); }
    else { mount.appendChild(btn); }
  }

  var _obs = new MutationObserver(function () { try { injectBtn(); } catch (e) {} });
  function start() { try { injectBtn(); } catch (e) {} try { _obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
