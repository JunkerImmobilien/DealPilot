'use strict';
/* W35-wl-token: Gold zeigt auf die Whitelabel-Ebene. */

/* modal-boarding-skin.js (v666)
   Legt den "Boarding-Look" (Obsidian-Brand-Bar + Gold-Hero + Obsidian-CTA, wie die
   welcome-mail / ImmoMetrica-Demo) ueber ALLE oabi-Modale: Exposé/Marktbericht-Import,
   Sprachaufzeichnung, ImmoMetrica. Per MutationObserver -> kein Eingriff in die
   Modal-Logik. Marktbericht-PDF (pdfi-*) ist KEIN oabi -> bleibt unberuehrt. */
(function () {
  if (window.__bdgSkin) return; window.__bdgSkin = true;

  function injectStyle() {
    if (document.getElementById('bdg-skin-style')) return;
    var css = [
      ".oabi-ov.oabi-boarding .oabi-modal{display:flex;flex-direction:column;overflow:hidden;padding:0;background:#fff}",
      ".oabi-boarding .bdg-brand{flex:none;background:#070707;padding:14px 22px;display:flex;align-items:center;gap:12px}",
      ".oabi-boarding .bdg-brand .logo{font:700 17px 'Space Grotesk','DM Sans',system-ui,sans-serif;color:#fff;letter-spacing:.3px}",
      ".oabi-boarding .bdg-brand .logo b{color:var(--wl-e8cc7a, #E8CC7A);font-weight:700}",
      ".oabi-boarding .bdg-brand .tag{margin-left:auto;font:700 10px 'JetBrains Mono',monospace;letter-spacing:2px;color:var(--wl-c9a84c, #C9A84C)}",
      ".oabi-boarding .bdg-brand .x{background:none;border:0;color:#8a8a90;font-size:24px;line-height:1;cursor:pointer;padding:0 2px;margin-left:8px}",
      ".oabi-boarding .bdg-brand .x:hover{color:#fff}",
      ".oabi-boarding .bdg-hero{flex:none;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 60%,var(--wl-b8932f, #b8932f))}",
      ".oabi-boarding .bdg-hero .oabi-head{background:none;padding:16px 22px 4px;margin:0;display:block}",
      ".oabi-boarding .bdg-hero .oabi-head>span{display:none}",
      ".oabi-boarding #imo-x{display:none}",
      ".oabi-boarding .bdg-kick{font:700 11px 'JetBrains Mono',monospace;letter-spacing:3px;color:#5a4a14;margin-bottom:5px}",
      ".oabi-boarding .bdg-hero .oabi-head h3{color:#1a1407;font:700 21px 'Space Grotesk','DM Sans',system-ui,sans-serif;margin:0;line-height:1.2}",
      ".oabi-boarding .bdg-hero .oabi-sub{background:none;color:#3a2e08;padding:3px 22px 16px;margin:0;font-size:13px;line-height:1.5}",
      ".oabi-boarding .oabi-body{flex:1 1 auto;min-height:0;overflow:auto;background:#fff}",
      ".oabi-boarding .oabi-foot{flex:none;background:#fff}",
      ".oabi-boarding .oabi-btn.primary{background:#0a0a0a;color:var(--wl-e8cc7a, #E8CC7A);border-color:transparent}",
      ".oabi-boarding .oabi-btn.primary:hover{background:#141414}",
      ".oabi-boarding .oabi-btn.primary[disabled]{opacity:.5}"
    ].join('\n');
    var st = document.createElement('style'); st.id = 'bdg-skin-style'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // Hero-Text je Modal (anhand des h3-Titels erkannt)
  function heroFor(title) {
    var t = (title || '').toLowerCase();
    if (t.indexOf('immometrica') >= 0) return { kick: 'OBJEKT-IMPORT', title: 'ImmoMetrica' };
    if (t.indexOf('sprach') >= 0) return { kick: 'FREI EINSPRECHEN', title: 'Sprachaufzeichnung' };
    if (t.indexOf('expos') >= 0 || t.indexOf('markt') >= 0) return { kick: 'OBJEKT EINLESEN', title: 'Expos\u00e9 & Marktbericht' };
    return { kick: 'DEALPILOT', title: null };
  }

  function decorate(ov) {
    if (!ov || !ov.classList || !ov.classList.contains('oabi-ov')) return;
    var modal = ov.querySelector('.oabi-modal');
    if (!modal || modal.dataset.bdg === '1') return;
    modal.dataset.bdg = '1';
    ov.classList.add('oabi-boarding');

    // Brand-Bar
    var brand = document.createElement('div');
    brand.className = 'bdg-brand';
    brand.innerHTML = '<span class="logo">Deal<b>Pilot</b></span>' +
      '<span class="tag">PRE-FLIGHT \u00b7 BOARDING</span>' +
      '<button type="button" class="x" aria-label="Schlie\u00dfen">\u00d7</button>';
    modal.insertBefore(brand, modal.firstChild);

    // Gold-Hero um head + sub
    var head = modal.querySelector('.oabi-head');
    var sub = modal.querySelector('.oabi-sub');
    if (head) {
      var hero = document.createElement('div');
      hero.className = 'bdg-hero';
      modal.insertBefore(hero, head);
      hero.appendChild(head);
      if (sub) hero.appendChild(sub);
      var h3 = head.querySelector('h3');
      var cfg = heroFor(h3 ? h3.textContent : '');
      var kick = document.createElement('div');
      kick.className = 'bdg-kick';
      kick.textContent = cfg.kick;
      head.insertBefore(kick, head.firstChild);
      if (cfg.title && h3) h3.textContent = cfg.title;
    }

    // × -> bestehenden Abbrechen/Schliessen-Button klicken (sauberer Cleanup), sonst entfernen
    var x = brand.querySelector('.x');
    if (x) x.onclick = function () {
      var cancel = ov.querySelector('.oabi-foot .oabi-btn:not(.primary)');
      if (cancel) cancel.click();
      else if (ov.parentNode) ov.parentNode.removeChild(ov);
    };
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && node.classList.contains('oabi-ov')) { decorate(node); return; }
    if (node.querySelector) { var ov = node.querySelector('.oabi-ov'); if (ov) decorate(ov); }
  }

  function start() {
    injectStyle();
    try { document.querySelectorAll('.oabi-ov').forEach(decorate); } catch (e) {}
    try {
      var mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.addedNodes) { for (var i = 0; i < m.addedNodes.length; i++) scan(m.addedNodes[i]); }
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
