'use strict';
/**
 * mobile-redirect.js — MB1-hardblock (23.07.2026)
 *
 * Ersetzt die alte v939-"Handy-Weiche". Die bot zwei Knoepfe an:
 *   Knopf 1 "App oeffnen"   -> fuehrte auf mobile-demo.html, die per MA35
 *                              selbst gesperrt ist (Empfehlung ins Nichts)
 *   Knopf 2 "bleiben"       -> merkte sich dp_mobile_choice='desktop' und
 *                              liess das Geraet DAUERHAFT durch
 * Damit stand die volle Desktop-App auf dem Handy offen — auch direkt nach
 * Registrierung/Login.
 *
 * Jetzt: harter Block, kein Ausweg, Optik wie der MA35-Block.
 *
 * ERKENNUNG — bewusst zweigleisig:
 *   Regel A  Touch-Primaerzeiger UND schmaler Viewport (<=700px)
 *            = der Normalfall.
 *   Regel B  Touch-Primaerzeiger UND kleine PHYSISCHE Bildschirmflaeche
 *            (kurze Kante x devicePixelRatio <= 1400 px)
 *            = faengt "Desktop-Site anfordern", das den Viewport auf ~980px
 *              faelscht. Das physische Pixelmass bleibt dabei erhalten, weil
 *              devicePixelRatio gegenlaeuft.
 *   Tablets bleiben draussen: iPad Mini 1488, iPad 1620, iPad Air 1640 —
 *   alle ueber der Schwelle. Touch-Notebooks ebenfalls, weil deren
 *   Primaerzeiger das Trackpad ist (hover:hover / pointer:fine).
 *
 * Hintertuer zum Testen:  ?nomobileblock=1   (haelt fuer die Sitzung)
 */
(function () {
  var MARK        = 'MB1-hardblock';
  var LEGACY_KEY  = 'dp_mobile_choice';   // Altlast der Weiche — wird entsorgt
  var BYPASS_KEY  = 'dp_mb_bypass';
  var OV_ID       = 'dp-mobile-block';
  var SHORT_EDGE_MAX = 1400;              // physische Pixel der kurzen Kante
  var NARROW_MAX     = 700;               // CSS-px Viewport

  function mq(q) {
    try { return !!(window.matchMedia && window.matchMedia(q).matches); }
    catch (e) { return false; }
  }

  function alreadyOnPwa() {
    return /mobile-demo\.html$/i.test(location.pathname);
  }

  function bypassed() {
    try {
      if (location.search.indexOf('nomobileblock') !== -1) {
        sessionStorage.setItem(BYPASS_KEY, '1');
        return true;
      }
      return sessionStorage.getItem(BYPASS_KEY) === '1';
    } catch (e) { return false; }
  }

  function shortEdgePhysical() {
    try {
      var w = screen.width || 0, h = screen.height || 0;
      var dpr = window.devicePixelRatio || 1;
      if (!w || !h) return 0;
      return Math.round(Math.min(w, h) * dpr);
    } catch (e) { return 0; }
  }

  function isPhone() {
    try {
      // Primaerzeiger ist ein Finger. Beide Abfragen sind eingabebasiert und
      // werden vom UA-Spoofing des Desktop-Modus nicht angefasst.
      var primaryTouch = mq('(pointer: coarse)') || mq('(hover: none)');
      if (!primaryTouch) return false;

      var narrow = (window.innerWidth || 9999) <= NARROW_MAX;
      if (narrow) return true;                                  // Regel A

      var sp = shortEdgePhysical();
      if (sp > 0 && sp <= SHORT_EDGE_MAX) return true;          // Regel B

      return false;
    } catch (e) { return false; }
  }

  function css() {
    if (document.getElementById('dp-mb-css')) return;
    var s = document.createElement('style');
    s.id = 'dp-mb-css';
    s.textContent = [
      '#' + OV_ID + '{position:fixed;inset:0;z-index:2147483647;',
      'background:radial-gradient(120% 90% at 50% 0%,#151310,#050505 70%);',
      'color:#FDFCFA;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;text-align:center;padding:32px 26px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif}',
      '#' + OV_ID + ' .mb-wm{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:700;',
      'font-size:26px;letter-spacing:-.4px}',
      '#' + OV_ID + ' .mb-wm b{color:#C9A84C;font-weight:700}',
      '#' + OV_ID + ' .mb-rw{height:3px;width:64px;margin:14px auto 22px;border-radius:2px;',
      'background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f)}',
      '#' + OV_ID + ' h2{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;',
      'font-size:25px;line-height:1.15;margin:0 0 10px}',
      '#' + OV_ID + ' p{font-size:14.5px;line-height:1.6;color:#b5b0a4;margin:0;max-width:310px}',
      '#' + OV_ID + ' .mb-hint{margin-top:22px;font-size:11.5px;color:#7d776b;letter-spacing:.02em}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  function show() {
    if (!document.body) return;
    if (document.getElementById(OV_ID)) return;
    css();
    var ov = document.createElement('div');
    ov.id = OV_ID;
    ov.setAttribute('data-mark', MARK);
    ov.innerHTML =
      '<div class="mb-wm">Deal<b>Pilot</b></div>' +
      '<div class="mb-rw"></div>' +
      '<h2>Mobile-Version im Aufbau</h2>' +
      '<p>Die Analyse-Oberfl\u00e4che ist f\u00fcr den gro\u00dfen Bildschirm gebaut. ' +
      'Bitte \u00f6ffne DealPilot am Rechner \u2014 dort steht dir der volle ' +
      'Funktionsumfang zur Verf\u00fcgung.</p>' +
      '<div class="mb-hint">Die Handy-App ist in Arbeit.</div>';
    document.body.appendChild(ov);
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
  }

  function hide() {
    var ov = document.getElementById(OV_ID);
    if (ov) ov.parentNode.removeChild(ov);
    try { document.documentElement.style.overflow = ''; } catch (e) {}
  }

  function evaluate() {
    if (alreadyOnPwa()) return;   // dort greift MA35
    if (bypassed()) return;
    if (isPhone()) show(); else hide();
  }

  function boot() {
    // Altlast der Weiche entsorgen: wer frueher den Bleiben-Knopf getippt
    // hat, waere sonst dauerhaft durchgelassen worden.
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
    evaluate();
  }

  // Kein setTimeout: bei einer Sperre darf es kein offenes Zeitfenster geben.
  if (document.body) boot();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Moduswechsel im Browser (Desktop-Site an/aus), Drehen, Fenstergroesse
  var _t = null;
  function rearm() {
    if (_t) clearTimeout(_t);
    _t = setTimeout(evaluate, 150);
  }
  window.addEventListener('resize', rearm);
  window.addEventListener('orientationchange', rearm);

  // Die App rendert nach dem Login neu — der Block bleibt oben drauf.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) evaluate();
  });

  window._dpMobileBlock = { mark: MARK, isPhone: isPhone, evaluate: evaluate };
})();
