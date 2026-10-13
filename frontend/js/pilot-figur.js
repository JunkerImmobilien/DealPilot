'use strict';
/* ═════════════════════════════════════════════════════════════════════
   pilot-figur.js — v2189 · Der Kapitän als ganze Figur

   Marcel, 13.10.2026, mit einem Vorlagebild (Dateien/pilot.png): „das als
   ganzes Männchen wäre toll, das sich bewegt und auch auf die Sachen
   zeigt. Vielleicht bei den Prozessen auch mit einem Pilotenkoffer."

   Die Vorlage ist ein Stockbild mit Wasserzeichen (iStock, ET-ARTWORKS)
   und wird NICHT übernommen. Gezeichnet ist eine eigene Figur im selben
   flachen Stil: Kapitänsmütze mit Goldband und Schwinge, Pilotenbrille,
   weißes Hemd mit vier Streifen auf den Schulterklappen, Krawatte —
   jede Fläche zweigeteilt hell/dunkel wie in der Vorlage.

   Eine Figur, ein Modul: der Tower (pilot-tower.js) und der Atlas
   (prozess-atlas.js) bauen sie beide hier — zwei gezeichnete Kapitäne
   laufen auseinander, sobald einer angefasst wird.

   Zustände (Klassen am Wurzelelement .pf):
     winkt · zeigt (Winkel über --pf-zeig) · laeuft · erklaert (Brille
     rutscht hoch, die Augen kommen vor) · links (gespiegelt) · koffer
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotFigur) return;
  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)';

  function css() {
    if (document.getElementById('dp-figur-css')) return;
    var st = document.createElement('style'); st.id = 'dp-figur-css';
    st.textContent = [
      '.pf{display:block;overflow:visible}',
      '.pf .haut{fill:#EDBE98}.pf .haut2{fill:#DCA77F}.pf .haar{fill:#7a5235}',
      '.pf .hemd{fill:#F7F7F5}.pf .hemd2{fill:#E3E3DF}.pf .kragen{fill:#FFFFFF;stroke:#d6d6d0;stroke-width:.6}',
      '.pf .muetze{fill:#45464A}.pf .muetze2{fill:#36373A}.pf .schirm{fill:#26272A}',
      '.pf .gold{fill:' + G + '}.pf .goldh{fill:' + GH + '}',
      '.pf .glas{fill:#151517}.pf .glanz{fill:#fff;opacity:.28}.pf .steg{fill:none;stroke:#151517;stroke-width:1.4}',
      '.pf .auge{fill:#2a2420}.pf .mund{fill:none;stroke:#8a4a35;stroke-width:1.5;stroke-linecap:round}',
      '.pf .schlips{fill:#2C2D31}.pf .klappe{fill:#26272A}',
      '.pf .hose{fill:#2F3440}.pf .hose2{fill:#262A34}.pf .schuh{fill:#141416}.pf .guertel{fill:#1d1d20}',
      '.pf .kof{fill:#22232A}.pf .kof2{fill:#1A1B20}.pf .rad{fill:#0d0d0f}.pf .stange{fill:#8d8f96}',
      '.pf .schatten{fill:#000;opacity:.18}',
      '.pf .oben{animation:pf-atem 3.2s ease-in-out infinite;transform-origin:50px 110px}',
      '@keyframes pf-atem{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.4px)}}',
      '.pf .arm-r{transform-origin:31px 71px;transition:transform .45s cubic-bezier(.3,1.4,.5,1)}',
      '.pf .arm-l{transform-origin:69px 71px;transition:transform .45s}',
      '.pf.winkt .arm-r{animation:pf-wink .42s ease-in-out 5 alternate}',
      '@keyframes pf-wink{from{transform:rotate(150deg)}to{transform:rotate(118deg)}}',
      '.pf.zeigt .arm-r{transform:rotate(var(--pf-zeig,125deg))}',
      '.pf .brille{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}',
      '.pf.erklaert .brille{transform:translateY(-8.5px)}',
      '.pf .bein-l{transform-origin:41px 114px}.pf .bein-r{transform-origin:59px 114px}',
      '.pf.laeuft .bein-l{animation:pf-schritt .44s ease-in-out infinite alternate}',
      '.pf.laeuft .bein-r{animation:pf-schritt .44s ease-in-out infinite alternate-reverse}',
      '.pf.laeuft .oben{animation:pf-wipp .22s ease-in-out infinite alternate}',
      '.pf.laeuft .arm-r:not(.x){animation:pf-pendel .44s ease-in-out infinite alternate}',
      '@keyframes pf-schritt{from{transform:rotate(-16deg)}to{transform:rotate(16deg)}}',
      '@keyframes pf-wipp{from{transform:translateY(0)}to{transform:translateY(-2.2px)}}',
      '@keyframes pf-pendel{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}',
      '.pf .koffer{display:none}.pf.koffer .koffer{display:inline}',
      '.pf.koffer .arm-l{transform:rotate(-8deg)}',
      '.pf.laeuft .koffer{animation:pf-rollen .22s ease-in-out infinite alternate;transform-origin:88px 158px}',
      '@keyframes pf-rollen{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}',
      '.pf-wrap{display:inline-block;transition:transform .25s}',
      '.pf-wrap.links{transform:scaleX(-1)}',
      '@media (prefers-reduced-motion:reduce){.pf .oben,.pf.laeuft .bein-l,.pf.laeuft .bein-r,.pf.laeuft .oben,.pf.winkt .arm-r{animation:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* viewBox 0 0 110 175 — Figur um x=50, Koffer rechts daneben */
  function svg(opts) {
    opts = opts || {};
    return '<svg class="pf' + (opts.koffer ? ' koffer' : '') + '" viewBox="0 0 110 175" aria-hidden="true">'
      + '<ellipse class="schatten" cx="54" cy="170" rx="34" ry="4"/>'
      /* Koffer (hinter dem linken Arm) */
      + '<g class="koffer"><rect class="stange" x="78" y="104" width="1.8" height="16"/><rect class="stange" x="93" y="104" width="1.8" height="16"/>'
      + '<rect class="kof2" x="75" y="102" width="23" height="4" rx="2"/>'
      + '<rect class="kof" x="72" y="119" width="29" height="40" rx="5"/><rect class="kof2" x="87" y="119" width="14" height="40" rx="5"/>'
      + '<rect class="gold" x="72" y="135" width="29" height="2.2"/><rect class="goldh" x="74" y="122" width="5" height="2" rx="1"/>'
      + '<circle class="rad" cx="78" cy="161" r="3.2"/><circle class="rad" cx="95" cy="161" r="3.2"/></g>'
      /* Beine */
      + '<g class="bein-l"><rect class="hose" x="34" y="112" width="14" height="50" rx="3"/><ellipse class="schuh" cx="39" cy="164" rx="9" ry="4.2"/></g>'
      + '<g class="bein-r"><rect class="hose2" x="52" y="112" width="14" height="50" rx="3"/><ellipse class="schuh" cx="61" cy="164" rx="9" ry="4.2"/></g>'
      + '<g class="oben">'
      /* linker Arm (Betrachter rechts) — hält den Koffer */
      + '<g class="arm-l"><path class="hemd2" d="M76 68 Q81 72 79 84 L70 84 L68 70 Z"/><rect class="haut2" x="71" y="83" width="7.5" height="21" rx="3.5"/><circle class="haut2" cx="75" cy="106" r="4.4"/></g>'
      /* Rumpf */
      + '<path class="hemd" d="M30 68 Q50 61 50 61 L50 114 L29 114 Z"/><path class="hemd2" d="M50 61 Q70 61 70 68 L71 114 L50 114 Z"/>'
      + '<rect class="guertel" x="29" y="110" width="42" height="4.5" rx="1"/><rect class="gold" x="47.5" y="110.3" width="5" height="3.8" rx=".8"/>'
      /* Schulterklappen mit vier Streifen */
      + '<g><rect class="klappe" x="27" y="65" width="15" height="6.5" rx="1.4" transform="rotate(-8 34 68)"/>'
      + '<g transform="rotate(-8 34 68)" class="gold"><rect x="29" y="66" width="1.6" height="4.5"/><rect x="32" y="66" width="1.6" height="4.5"/><rect x="35" y="66" width="1.6" height="4.5"/><rect x="38" y="66" width="1.6" height="4.5"/></g>'
      + '<rect class="klappe" x="58" y="65" width="15" height="6.5" rx="1.4" transform="rotate(8 66 68)"/>'
      + '<g transform="rotate(8 66 68)" class="gold"><rect x="60" y="66" width="1.6" height="4.5"/><rect x="63" y="66" width="1.6" height="4.5"/><rect x="66" y="66" width="1.6" height="4.5"/><rect x="69" y="66" width="1.6" height="4.5"/></g></g>'
      /* Hals, Kragen, Krawatte */
      + '<rect class="haut2" x="45" y="57" width="10" height="8"/>'
      + '<path class="schlips" d="M47.6 65 L52.4 65 L53.4 69 L51.6 98 L50 101 L48.4 98 L46.6 69 Z"/>'
      + '<path class="kragen" d="M44 61 L50 66 L46 71 Z"/><path class="kragen" d="M56 61 L50 66 L54 71 Z"/>'
      /* rechter Arm (Betrachter links) — winkt und zeigt */
      + '<g class="arm-r"><path class="hemd" d="M24 68 Q19 72 21 84 L30 84 L32 70 Z"/><rect class="haut" x="21.5" y="83" width="7.5" height="21" rx="3.5"/><circle class="haut" cx="25.2" cy="106" r="4.4"/></g>'
      /* Kopf */
      + '<circle class="haut" cx="34.5" cy="44" r="3.2"/><circle class="haut2" cx="65.5" cy="44" r="3.2"/>'
      + '<path class="haut" d="M50 26 C40 26 35 33 35 43 C35 53 41 60 50 60 Z"/><path class="haut2" d="M50 26 C60 26 65 33 65 43 C65 53 59 60 50 60 Z"/>'
      + '<path class="haar" d="M35.5 33 Q34 40 36.5 45 L38 37 Z"/><path class="haar" d="M64.5 33 Q66 40 63.5 45 L62 37 Z"/>'
      + '<circle class="auge" cx="43.5" cy="42" r="1.9"/><circle class="auge" cx="56.5" cy="42" r="1.9"/>'
      + '<path class="mund" d="M45.5 52 Q50 55.5 54.5 52"/>'
      + '<g class="brille"><path class="glas" d="M36.5 38.5 Q37 36.5 40 36.5 L47 36.5 Q49 37 48.4 40.5 Q47.4 46 42 45.8 Q37 45.4 36.5 38.5 Z"/>'
      + '<path class="glas" d="M63.5 38.5 Q63 36.5 60 36.5 L53 36.5 Q51 37 51.6 40.5 Q52.6 46 58 45.8 Q63 45.4 63.5 38.5 Z"/>'
      + '<path class="steg" d="M48 37.6 Q50 36.6 52 37.6"/><path class="glanz" d="M39 38 L43 38 L40 42 Z"/><path class="glanz" d="M55 38 L59 38 L56 42 Z"/></g>'
      /* Mütze */
      + '<path class="muetze" d="M25 25 Q50 4 75 25 L71 32 L29 32 Z"/><path class="muetze2" d="M50 9.5 Q65 12 75 25 L71 32 L50 32 Z"/>'
      + '<rect class="gold" x="29" y="28.6" width="42" height="3.6" rx="1"/>'
      + '<path class="schirm" d="M30 32.2 Q50 39 70 32.2 L68 35.6 Q50 41 32 35.6 Z"/>'
      + '<path class="gold" d="M42.5 19 Q46 16.6 49.2 19.8 L50 18.4 L50.8 19.8 Q54 16.6 57.5 19 Q54 20.6 51 21.8 L50 23.6 L49 21.8 Q46 20.6 42.5 19 Z"/>'
      + '<circle class="goldh" cx="50" cy="19.6" r="1.6"/>'
      + '</g></svg>';
  }

  /* Zeigewinkel des rechten Arms: Ausgang hängt nach unten, im Uhrzeigersinn
     gedreht zeigt er nach links (90°) und nach oben (180°). Liegt das Ziel
     rechts, wird die ganze Figur gespiegelt. */
  function zeigeAuf(wrap, zielRect) {
    var svgEl = wrap.querySelector('svg.pf'); if (!svgEl || !zielRect) return;
    var r = svgEl.getBoundingClientRect();
    var sx = r.left + r.width * (31 / 110), sy = r.top + r.height * (71 / 175);
    var tx = zielRect.left + zielRect.width / 2, ty = zielRect.top + zielRect.height / 2;
    var rechts = tx > r.left + r.width / 2;
    if (rechts) sx = r.left + r.width * (1 - 31 / 110);
    wrap.classList.toggle('links', rechts);
    var dx = tx - sx, dy = ty - sy;
    var ang = Math.atan2(rechts ? dx : -dx, dy) * 180 / Math.PI;
    ang = Math.max(40, Math.min(172, ang));
    svgEl.style.setProperty('--pf-zeig', ang.toFixed(0) + 'deg');
    svgEl.classList.remove('winkt'); svgEl.classList.add('zeigt');
  }
  function zustand(wrap, k, an) { var s = wrap && wrap.querySelector('svg.pf'); if (s) s.classList.toggle(k, an !== false); }
  function bauen(opts) {
    css();
    var w = document.createElement('span'); w.className = 'pf-wrap'; w.innerHTML = svg(opts);
    return w;
  }

  window.DealPilotFigur = { css: css, svg: svg, bauen: bauen, zeigeAuf: zeigeAuf, zustand: zustand };
})();
