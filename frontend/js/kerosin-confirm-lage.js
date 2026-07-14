/* DealPilot v782 — Kerosin-Bestaetigung vor 'Lage neu analysieren'.
   Wrappt window.runKiLage. Respektiert dasselbe 'nicht mehr fragen'-Flag
   wie der Quick-Boarding-Confirm (localStorage 'dp_skip_kerosin_confirm'). */
(function () {
  'use strict';
  if (window._kclInit) return; window._kclInit = true;

  /* Kosten /ai/lage in Litern. 1 KI-Analyse = 1 L (Tank-Logik). VERIFIZIEREN bei Aenderung. */
  var LAGE_L = 1;

  function style() {
    if (document.getElementById('kcl-css')) return;
    var st = document.createElement('style'); st.id = 'kcl-css';
    st.textContent =
      '.kcl-ov{position:fixed;inset:0;z-index:99997;display:flex;align-items:center;justify-content:center;background:rgba(12,11,9,.5);backdrop-filter:blur(2px)}' +
      '.kcl-modal{width:min(420px,92vw);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.55)}' +
      '.kcl-hero{padding:18px 20px 14px;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f)}' +
      '.kcl-hero .bp{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.18em;color:#5e4d18}' +
      '.kcl-hero h3{margin:6px 0 0;font:700 16px/1.2 "Space Grotesk",sans-serif;color:#2c2410}' +
      '.kcl-body{padding:18px 20px;color:#3a352e;font-size:13.5px;line-height:1.55}' +
      '.kcl-cost{margin:12px 0;padding:11px 13px;background:#faf6ec;border:1px solid rgba(201,168,76,.3);border-radius:10px;font:13px/1.5 "JetBrains Mono",monospace;color:#1b1815}' +
      '.kcl-cost b{color:#9a7f33}' +
      '.kcl-skip{display:flex;align-items:center;gap:7px;margin-top:12px;font-size:12.5px;color:#6b6660;cursor:pointer}' +
      '.kcl-foot{display:flex;gap:10px;padding:0 20px 18px}' +
      '.kcl-btn{flex:1;border:none;border-radius:10px;padding:11px 14px;font:700 13px/1 "Space Grotesk",sans-serif;cursor:pointer}' +
      '.kcl-cancel{background:#f1ede4;color:#3a352e}.kcl-go{background:#0c0b09;color:#E8CC7A}';
    document.head.appendChild(st);
  }

  function ask(go) {
    style();
    var ov = document.createElement('div'); ov.className = 'kcl-ov';
    ov.innerHTML =
      '<div class="kcl-modal" role="dialog" aria-modal="true">' +
        '<div class="kcl-hero"><span class="bp">BOARDING PASS \u00b7 DEALPILOT</span><h3>Lage-Analyse best\u00e4tigen</h3></div>' +
        '<div class="kcl-body">F\u00fcr die KI-Lagebewertung wird Kerosin verbraucht:' +
          '<div class="kcl-cost"><b>' + LAGE_L + '\u00a0L</b> Lage-Analyse (KI)</div>' +
          'M\u00f6chtest du fortfahren?' +
          '<label class="kcl-skip"><input type="checkbox" id="kcl-skip" style="accent-color:#C9A84C"> Nicht mehr fragen</label>' +
        '</div>' +
        '<div class="kcl-foot">' +
          '<button type="button" class="kcl-btn kcl-cancel" id="kcl-cancel">Abbrechen</button>' +
          '<button type="button" class="kcl-btn kcl-go" id="kcl-go">Analysieren (' + LAGE_L + '\u00a0L)</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var c = document.getElementById('kcl-cancel'); if (c) c.addEventListener('click', close);
    var g = document.getElementById('kcl-go'); if (g) g.addEventListener('click', function () {
      try { var sk = document.getElementById('kcl-skip'); if (sk && sk.checked) localStorage.setItem('dp_skip_kerosin_confirm', '1'); } catch (e) {}
      close(); try { go(); } catch (e) {}
    });
    var esc = function (e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
  }

  function wrap() {
    if (typeof window.runKiLage !== 'function') { setTimeout(wrap, 400); return; }
    if (window.runKiLage._kclWrapped) return;
    var orig = window.runKiLage;
    window.runKiLage = function () {
      var self = this, args = arguments;
      try { if (localStorage.getItem('dp_skip_kerosin_confirm') === '1') return orig.apply(self, args); } catch (e) {}
      ask(function () { orig.apply(self, args); });
    };
    window.runKiLage._kclWrapped = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap);
  else wrap();
})();
