'use strict';
/**
 * branding-darstellung.js (W8) — Farb-Editor mit Live-Vorschau
 *
 * Warum: Die Farbwaehler sassen im Branding-Tab, wo man das Ergebnis NICHT sieht —
 * man tippt eine Hex-Zahl und hofft. Hier stellt man ein und sieht sofort, was der
 * Mandant sieht: die echte App faerbt sich live mit (ueber DealPilotWhitelabel),
 * dazu eine Mail-Vorschau (die Mail-Farbe ist bewusst vom App-Akzent entkoppelt).
 *
 * API:
 *   DealPilotBrandingEditor.open({accent, obsidian, mail, name, logo}, onApply)
 *     onApply({accent, obsidian, mail})  — nur bei "Uebernehmen"
 *   Abbrechen stellt den vorherigen Zustand wieder her.
 */
(function () {
  var GOLD = '#C9A84C', OBS = '#0a0a0a';
  var _prev = null, _cb = null, _st = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ok(h) { return /^#[0-9a-fA-F]{6}$/.test(h || ''); }
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
  function hex(r,g,b){ function c(x){x=Math.max(0,Math.min(255,Math.round(x)));return ('0'+x.toString(16)).slice(-2);} return '#'+c(r)+c(g)+c(b); }
  function lighten(h,p){ var a=rgb(h); return hex(a[0]+(255-a[0])*p/100, a[1]+(255-a[1])*p/100, a[2]+(255-a[2])*p/100); }
  function darken(h,p){ var a=rgb(h); return hex(a[0]*(1-p/100), a[1]*(1-p/100), a[2]*(1-p/100)); }

  function css() {
    if ($('dpbe-css')) return;
    var s = document.createElement('style'); s.id = 'dpbe-css';
    s.textContent = [
      '.dpbe-ov{position:fixed;inset:0;z-index:100000;background:rgba(6,5,4,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}',
      '.dpbe{max-width:1000px;width:100%;max-height:92vh;background:#FDFCFA;border-radius:14px;overflow:hidden;display:grid;grid-template-columns:300px 1fr;box-shadow:0 30px 90px -20px #000}',
      '.dpbe-l{background:#faf8f3;border-right:1px solid #ece5d8;padding:20px;overflow:auto}',
      '.dpbe-r{background:#151515;position:relative;overflow:hidden;min-height:440px}',
      '.dpbe-t{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:17px;color:#2a2727;margin-bottom:3px}',
      '.dpbe-s{font-size:11.5px;color:#8a8473;line-height:1.5;margin-bottom:18px}',
      '.dpbe-fl{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:#8a8473;margin-bottom:5px}',
      '.dpbe-fg{margin-bottom:14px}',
      '.dpbe-pick{width:100%;height:38px;border:1px solid #e6e0d4;border-radius:8px;background:#fff;cursor:pointer;padding:2px}',
      '.dpbe-hint{font-size:11px;color:#a09a8d;margin-top:5px;line-height:1.45}',
      '.dpbe-pre{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}',
      '.dpbe-pre button{padding:6px 10px;border:1px solid #d8d1c0;border-radius:7px;background:#fff;font:500 11px Inter;color:#5a5648;cursor:pointer;display:flex;align-items:center;gap:5px}',
      '.dpbe-pre i{width:10px;height:10px;border-radius:3px;display:inline-block;border:1px solid #0002}',
      '.dpbe-foot{margin-top:20px;padding-top:15px;border-top:1px solid #e6e0d4;display:flex;gap:8px}',
      '.dpbe-btn{padding:11px 16px;border-radius:9px;border:none;cursor:pointer;font:600 13.5px Inter}',
      '.dpbe-go{flex:1;background:linear-gradient(110deg,var(--gold-hi,#E8CC7A),var(--gold,#C9A84C) 55%,var(--gold-lo,#b8932f));color:#1a1407;font-weight:700}',
      '.dpbe-x{background:#fff;border:1px solid #d8d1c0;color:#5a5648}',
      '.dpbe-lab{position:absolute;top:11px;left:14px;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.14em;color:#6f6a60;z-index:2}',
      '.dpbe-mini{padding:30px 16px 0;transform:scale(.86);transform-origin:top left;width:116%}',
      '.dpbe-top{display:flex;gap:10px}',
      '.dpbe-side{width:118px;background:var(--dpbe-obs,#0a0a0a);border:1px solid #1e1e1e;border-radius:9px;padding:11px 9px;flex:none}',
      '.dpbe-wm{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:13px;color:#f6f2e8;margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpbe-wm img{max-height:20px;max-width:96px}',
      '.dpbe-c{background:#0d0d0d;border:1px solid #1e1e1e;border-radius:7px;padding:7px;margin-bottom:6px}',
      '.dpbe-k{font-family:"JetBrains Mono",monospace;font-size:7px;letter-spacing:.1em;color:#6f6a60}',
      '.dpbe-v{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:12px;color:var(--dpbe-acc,#C9A84C)}',
      '.dpbe-main{flex:1}',
      '.dpbe-bar{background:linear-gradient(110deg,var(--dpbe-hi,#E8CC7A),var(--dpbe-acc,#C9A84C) 55%,var(--dpbe-lo,#b8932f));border-radius:7px;padding:8px 11px;font-family:"JetBrains Mono",monospace;font-size:8.5px;letter-spacing:.12em;color:#1a1407;font-weight:700;margin-bottom:8px}',
      '.dpbe-sc{display:flex;gap:9px;align-items:center;background:#0d0d0d;border:1px solid #1e1e1e;border-radius:7px;padding:9px;margin-bottom:8px}',
      '.dpbe-dial{width:42px;height:42px;border-radius:50%;border:3px solid var(--dpbe-acc,#C9A84C);display:grid;place-items:center;font:700 13px "Space Grotesk";color:var(--dpbe-acc,#C9A84C)}',
      '.dpbe-b{display:inline-block;background:linear-gradient(110deg,var(--dpbe-hi,#E8CC7A),var(--dpbe-acc,#C9A84C) 55%,var(--dpbe-lo,#b8932f));color:#1a1407;font:700 8.5px "JetBrains Mono",monospace;letter-spacing:.1em;padding:6px 10px;border-radius:5px;margin-right:5px}',
      '.dpbe-row{background:#fff;border:1px solid #eee;border-radius:7px;padding:7px 9px;display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}',
      '.dpbe-rn{font:600 9.5px Inter;color:#2a2727}',
      '.dpbe-mail{background:#fff;border:1px solid #e6e0d4;border-radius:7px;overflow:hidden;margin-top:9px}',
      '.dpbe-mh{background:var(--dpbe-obs,#0a0a0a);padding:8px 10px;font:700 10.5px "Space Grotesk";color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpbe-ms{height:3px;background:var(--dpbe-mail,#C9A84C)}',
      '.dpbe-mb{padding:8px 10px;font-size:8.5px;color:#3a352c}',
      '.dpbe-mc{display:inline-block;background:var(--dpbe-mail,#C9A84C);color:#fff;font:700 8px Inter;padding:5px 9px;border-radius:4px;margin-top:5px}',
      '@media(max-width:860px){.dpbe{grid-template-columns:1fr}.dpbe-r{display:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* Vorschau-Variablen (nur im Editor-Panel) */
  function paintMini() {
    var a = $('dpbe-acc').value, o = $('dpbe-obs').value, m = $('dpbe-mail').value;
    var r = document.documentElement.style;
    r.setProperty('--dpbe-acc', a);
    r.setProperty('--dpbe-hi', lighten(a, 22));
    r.setProperty('--dpbe-lo', darken(a, 16));
    r.setProperty('--dpbe-obs', o);
    r.setProperty('--dpbe-mail', m);
  }
  /* Die ECHTE App live mitfaerben — der eigentliche Sinn der Uebung */
  function paintApp() {
    try {
      if (!window.DealPilotWhitelabel) return;
      var a = $('dpbe-acc').value;
      if (!ok(a)) return;
      window.DealPilotWhitelabel.apply({ accent: a, obsidian: $('dpbe-obs').value });
    } catch (e) {}
  }
  function live() { paintMini(); paintApp(); }

  function open(init, onApply) {
    css();
    init = init || {}; _cb = onApply || null;
    _prev = {
      accent: ok(init.accent) ? init.accent : GOLD,
      obsidian: ok(init.obsidian) ? init.obsidian : OBS,
      mail: ok(init.mail) ? init.mail : (ok(init.accent) ? init.accent : GOLD)
    };
    var name = init.name || 'Deine Kanzlei';
    var logo = init.logo || '';

    var ov = document.createElement('div');
    ov.className = 'dpbe-ov'; ov.id = 'dpbe-ov';
    ov.innerHTML =
      '<div class="dpbe">' +
        '<div class="dpbe-l">' +
          '<div class="dpbe-t">Darstellung</div>' +
          '<div class="dpbe-s">Änderungen erscheinen sofort — rechts in der Vorschau <b>und</b> in der App dahinter. Erst „Übernehmen" schreibt sie ins Branding.</div>' +
          '<div class="dpbe-fg"><div class="dpbe-fl">Akzentfarbe — Buttons, Balken, Werte</div>' +
            '<input type="color" class="dpbe-pick" id="dpbe-acc" value="' + esc(_prev.accent) + '"></div>' +
          '<div class="dpbe-fg"><div class="dpbe-fl">Header &amp; Sidebar-Fläche</div>' +
            '<input type="color" class="dpbe-pick" id="dpbe-obs" value="' + esc(_prev.obsidian) + '"></div>' +
          '<div class="dpbe-fg"><div class="dpbe-fl">Mail-Farbe</div>' +
            '<input type="color" class="dpbe-pick" id="dpbe-mail" value="' + esc(_prev.mail) + '">' +
            '<div class="dpbe-hint">Bewusst getrennt vom App-Akzent — Mail und App sind verschiedene Bühnen.</div></div>' +
          '<div class="dpbe-fg"><div class="dpbe-fl">Schnell übernehmen</div>' +
            '<div class="dpbe-pre">' +
              '<button type="button" data-p="#b33d29|#141210"><i style="background:#b33d29"></i>Kanzlei-Rot</button>' +
              '<button type="button" data-p="#1d5fa8|#0b1018"><i style="background:#1d5fa8"></i>Makler-Blau</button>' +
              '<button type="button" data-p="#2c7a5b|#0a1210"><i style="background:#2c7a5b"></i>Finanz-Grün</button>' +
              '<button type="button" data-p="#C9A84C|#0a0a0a"><i style="background:#C9A84C"></i>DealPilot</button>' +
            '</div></div>' +
          '<div class="dpbe-foot">' +
            '<button class="dpbe-btn dpbe-go" id="dpbe-ok">Übernehmen</button>' +
            '<button class="dpbe-btn dpbe-x" id="dpbe-no">Abbrechen</button>' +
          '</div>' +
        '</div>' +
        '<div class="dpbe-r">' +
          '<div class="dpbe-lab">✈ LIVE-VORSCHAU · SO SEHEN ES DEINE MANDANTEN</div>' +
          '<div class="dpbe-mini"><div class="dpbe-top">' +
            '<div class="dpbe-side">' +
              '<div class="dpbe-wm" id="dpbe-wm">' + (logo ? '<img src="' + esc(logo) + '" alt="">' : esc(name)) + '</div>' +
              '<div class="dpbe-c"><div class="dpbe-k">DSCR</div><div class="dpbe-v">1,25</div></div>' +
              '<div class="dpbe-c"><div class="dpbe-k">CF / JAHR</div><div class="dpbe-v">+760 €</div></div>' +
              '<div class="dpbe-c"><div class="dpbe-k">RENDITE</div><div class="dpbe-v">6,27 %</div></div>' +
            '</div>' +
            '<div class="dpbe-main">' +
              '<div class="dpbe-bar">BEREIT FÜR DIE BANK · 100 %</div>' +
              '<div class="dpbe-sc"><div class="dpbe-dial">69</div><div>' +
                '<div class="dpbe-k">INVESTOR DEAL SCORE</div>' +
                '<div style="font:700 11px \'Space Grotesk\';color:#f6f2e8">Verhandeln</div></div></div>' +
              '<div style="margin-bottom:8px"><span class="dpbe-b">BOARDING</span><span class="dpbe-b">ABGEFLOGEN</span></div>' +
              '<div class="dpbe-bar" style="margin-bottom:6px">DOKUMENTE &amp; EXPORTE</div>' +
              '<div class="dpbe-row"><span class="dpbe-rn">Investment-PDF</span><span class="dpbe-b" style="margin:0">PDF</span></div>' +
              '<div class="dpbe-row"><span class="dpbe-rn">Track Record</span><span class="dpbe-b" style="margin:0">PDF</span></div>' +
              '<div class="dpbe-mail">' +
                '<div class="dpbe-mh" id="dpbe-mn">' + esc(name) + '</div><div class="dpbe-ms"></div>' +
                '<div class="dpbe-mb">Einladungs-Mail an deinen Mandanten<br><span class="dpbe-mc">Einladung annehmen</span></div>' +
              '</div>' +
            '</div>' +
          '</div></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    ['dpbe-acc', 'dpbe-obs', 'dpbe-mail'].forEach(function (id) {
      $(id).addEventListener('input', live);
    });
    Array.prototype.forEach.call(ov.querySelectorAll('.dpbe-pre button'), function (b) {
      b.addEventListener('click', function () {
        var p = (b.getAttribute('data-p') || '').split('|');
        $('dpbe-acc').value = p[0]; $('dpbe-obs').value = p[1]; $('dpbe-mail').value = p[0];
        live();
      });
    });
    $('dpbe-ok').addEventListener('click', function () { close(true); });
    $('dpbe-no').addEventListener('click', function () { close(false); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(false); });
    document.addEventListener('keydown', _esc);
    live();
  }

  function _esc(e) { if (e.key === 'Escape') close(false); }

  function close(apply) {
    var out = null;
    if (apply) {
      out = { accent: $('dpbe-acc').value, obsidian: $('dpbe-obs').value, mail: $('dpbe-mail').value };
    } else if (_prev) {
      /* Abbrechen: App auf den vorherigen Stand zuruecksetzen */
      try {
        if (window.DealPilotWhitelabel && window.DealPilotWhitelabel.isActive()) {
          window.DealPilotWhitelabel.apply({ accent: _prev.accent, obsidian: _prev.obsidian });
        }
      } catch (e) {}
    }
    document.removeEventListener('keydown', _esc);
    var ov = $('dpbe-ov'); if (ov) ov.remove();
    if (apply && _cb) { try { _cb(out); } catch (e) {} }
    _cb = null; _prev = null;
  }

  window.DealPilotBrandingEditor = { open: open };
})();
