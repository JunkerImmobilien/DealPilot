'use strict';
/**
 * mobile-redirect.js (v939) — Handy-Weiche zur PWA
 * Auf schmalen Touch-Geraeten bietet die App an, in die fuers Handy optimierte
 * DealPilot-App (mobile-demo.html) zu wechseln, statt die gedraengte
 * Desktop-Ansicht zu zeigen. Kein Zwang: der User kann am Desktop-Layout bleiben
 * (Wahl wird gemerkt). Laeuft NICHT auf mobile-demo.html selbst.
 */
(function () {
  var CHOICE_KEY = 'dp_mobile_choice';   // 'desktop' = Weiche nicht mehr zeigen
  var PWA_URL = '/mobile-demo.html';

  function isPhone() {
    try {
      // schmaler Viewport + grober Zeiger (Finger) = Handy; Tablets/Desktop raus
      var narrow = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
      var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      return !!(narrow && coarse);
    } catch (e) { return false; }
  }

  function alreadyOnPwa() {
    return /mobile-demo\.html$/i.test(location.pathname);
  }

  function css() {
    if (document.getElementById('dp-mw-css')) return;
    var s = document.createElement('style'); s.id = 'dp-mw-css';
    s.textContent = [
      '.dp-mw-ov{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(120% 90% at 50% 0%,#151310,#0a0a0a 70%);display:flex;align-items:center;justify-content:center;padding:22px;font-family:Inter,system-ui,sans-serif}',
      '.dp-mw{max-width:360px;width:100%;text-align:center;color:#FDFCFA}',
      '.dp-mw .wm{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:30px;letter-spacing:-.5px;margin-bottom:6px}',
      '.dp-mw .wm b{color:#C9A84C}',
      '.dp-mw .rw{height:3px;width:64px;margin:0 auto 20px;border-radius:2px;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f)}',
      '.dp-mw h2{font-family:"Cormorant Garamond",serif;font-weight:600;font-size:24px;line-height:1.15;margin:0 0 8px}',
      '.dp-mw p{font-size:14px;line-height:1.55;color:#b8b2a4;margin:0 0 24px}',
      '.dp-mw .go{display:block;width:100%;padding:15px;border:none;border-radius:12px;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1407;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit}',
      '.dp-mw .stay{display:block;width:100%;margin-top:12px;padding:13px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:transparent;color:#cfc9bb;font-size:13.5px;cursor:pointer;font-family:inherit}',
      '.dp-mw .hint{margin-top:16px;font-size:11.5px;color:#7d776b}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function show() {
    css();
    var ov = document.createElement('div'); ov.className = 'dp-mw-ov'; ov.id = 'dp-mw-ov';
    ov.innerHTML =
      '<div class="dp-mw">' +
        '<div class="wm">Deal<b>Pilot</b></div><div class="rw"></div>' +
        '<h2>Am Handy bist du in der App besser aufgehoben</h2>' +
        '<p>Die Analyse-Oberfläche ist für großen Bildschirm gebaut. Fürs Handy gibt es die optimierte DealPilot-App — mit Cockpit, Boarding-Pass und deinen Kennzahlen.</p>' +
        '<button class="go" id="dp-mw-go">DealPilot-App öffnen</button>' +
        '<button class="stay" id="dp-mw-stay">Am Desktop-Layout bleiben</button>' +
        '<div class="hint">Für volle Bearbeitung: DealPilot am Rechner öffnen.</div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('dp-mw-go').addEventListener('click', function () {
      location.href = PWA_URL;
    });
    document.getElementById('dp-mw-stay').addEventListener('click', function () {
      try { localStorage.setItem(CHOICE_KEY, 'desktop'); } catch (e) {}
      ov.remove();
    });
  }

  function boot() {
    if (alreadyOnPwa()) return;
    if (!isPhone()) return;
    try { if (localStorage.getItem(CHOICE_KEY) === 'desktop') return; } catch (e) {}
    // kurz warten, damit die App zuerst rendert (kein Flackern beim Login-Redirect)
    setTimeout(show, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
