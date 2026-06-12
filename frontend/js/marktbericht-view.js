/* v649 (Boarding-Band): Marktbericht inline im PRE-FLIGHT/Boarding-Stil.
 * - Obsidian-Stub + Gold-Band + grosse Ueberschrift + Kosten-Chip + PDF-Export + "Zurueck".
 * - PDF-Export in der Band klickt intern den iframe-Button #mbTopPdf (same-origin).
 * - iframe waechst auf Content-Hoehe (kein innerer Scrollbalken) -> Seite scrollt wie Objekt-Tab.
 * - Theme aus localStorage 'dp_mb_theme' (Default hell), Schalter in den Einstellungen (v648).
 */
(function (global) {
  'use strict';
  function $(id) { return document.getElementById(id); }
  /* v653-klassik: dekoratives PRE-FLIGHT-QR (wie object-actions _qrSvg) */
  var MBV_QR = '<svg class="dp-qr" viewBox="0 0 37 37" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-label="QR DealPilot"><rect width="37" height="37" fill="#fff"/><path d="M4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM13 4h1v1h-1zM17 4h1v1h-1zM20 4h1v1h-1zM22 4h1v1h-1zM23 4h1v1h-1zM24 4h1v1h-1zM26 4h1v1h-1zM27 4h1v1h-1zM28 4h1v1h-1zM29 4h1v1h-1zM30 4h1v1h-1zM31 4h1v1h-1zM32 4h1v1h-1zM4 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM16 5h1v1h-1zM19 5h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM13 6h1v1h-1zM14 6h1v1h-1zM15 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM23 6h1v1h-1zM26 6h1v1h-1zM28 6h1v1h-1zM29 6h1v1h-1zM30 6h1v1h-1zM32 6h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM17 7h1v1h-1zM18 7h1v1h-1zM21 7h1v1h-1zM23 7h1v1h-1zM26 7h1v1h-1zM28 7h1v1h-1zM29 7h1v1h-1zM30 7h1v1h-1zM32 7h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM14 8h1v1h-1zM17 8h1v1h-1zM23 8h1v1h-1zM24 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM29 8h1v1h-1zM30 8h1v1h-1zM32 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM13 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM21 9h1v1h-1zM22 9h1v1h-1zM26 9h1v1h-1zM32 9h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h1v1h-1zM27 10h1v1h-1zM28 10h1v1h-1zM29 10h1v1h-1zM30 10h1v1h-1zM31 10h1v1h-1zM32 10h1v1h-1zM12 11h1v1h-1zM13 11h1v1h-1zM16 11h1v1h-1zM18 11h1v1h-1zM20 11h1v1h-1zM22 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM14 12h1v1h-1zM16 12h1v1h-1zM21 12h1v1h-1zM22 12h1v1h-1zM23 12h1v1h-1zM26 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM29 12h1v1h-1zM30 12h1v1h-1zM4 13h1v1h-1zM6 13h1v1h-1zM7 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM17 13h1v1h-1zM20 13h1v1h-1zM21 13h1v1h-1zM22 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM26 13h1v1h-1zM27 13h1v1h-1zM28 13h1v1h-1zM32 13h1v1h-1zM4 14h1v1h-1zM8 14h1v1h-1zM9 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM16 14h1v1h-1zM17 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM20 14h1v1h-1zM24 14h1v1h-1zM25 14h1v1h-1zM28 14h1v1h-1zM7 15h1v1h-1zM8 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM15 15h1v1h-1zM16 15h1v1h-1zM17 15h1v1h-1zM19 15h1v1h-1zM20 15h1v1h-1zM24 15h1v1h-1zM25 15h1v1h-1zM27 15h1v1h-1zM29 15h1v1h-1zM31 15h1v1h-1zM4 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM11 16h1v1h-1zM12 16h1v1h-1zM16 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM21 16h1v1h-1zM24 16h1v1h-1zM29 16h1v1h-1zM30 16h1v1h-1zM5 17h1v1h-1zM9 17h1v1h-1zM11 17h1v1h-1zM16 17h1v1h-1zM20 17h1v1h-1zM21 17h1v1h-1zM22 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM25 17h1v1h-1zM26 17h1v1h-1zM27 17h1v1h-1zM28 17h1v1h-1zM32 17h1v1h-1zM4 18h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM12 18h1v1h-1zM13 18h1v1h-1zM15 18h1v1h-1zM19 18h1v1h-1zM20 18h1v1h-1zM22 18h1v1h-1zM25 18h1v1h-1zM26 18h1v1h-1zM27 18h1v1h-1zM28 18h1v1h-1zM29 18h1v1h-1zM30 18h1v1h-1zM5 19h1v1h-1zM7 19h1v1h-1zM8 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM18 19h1v1h-1zM19 19h1v1h-1zM23 19h1v1h-1zM28 19h1v1h-1zM31 19h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM9 20h1v1h-1zM10 20h1v1h-1zM11 20h1v1h-1zM12 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM21 20h1v1h-1zM23 20h1v1h-1zM29 20h1v1h-1zM30 20h1v1h-1zM4 21h1v1h-1zM9 21h1v1h-1zM15 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM20 21h1v1h-1zM21 21h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM24 21h1v1h-1zM25 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM28 21h1v1h-1zM30 21h1v1h-1zM32 21h1v1h-1zM4 22h1v1h-1zM7 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM17 22h1v1h-1zM18 22h1v1h-1zM19 22h1v1h-1zM26 22h1v1h-1zM27 22h1v1h-1zM28 22h1v1h-1zM30 22h1v1h-1zM4 23h1v1h-1zM6 23h1v1h-1zM11 23h1v1h-1zM12 23h1v1h-1zM14 23h1v1h-1zM17 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM23 23h1v1h-1zM24 23h1v1h-1zM25 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM31 23h1v1h-1zM4 24h1v1h-1zM7 24h1v1h-1zM8 24h1v1h-1zM10 24h1v1h-1zM11 24h1v1h-1zM16 24h1v1h-1zM18 24h1v1h-1zM21 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM27 24h1v1h-1zM28 24h1v1h-1zM30 24h1v1h-1zM31 24h1v1h-1zM32 24h1v1h-1zM12 25h1v1h-1zM14 25h1v1h-1zM15 25h1v1h-1zM20 25h1v1h-1zM21 25h1v1h-1zM22 25h1v1h-1zM24 25h1v1h-1zM28 25h1v1h-1zM29 25h1v1h-1zM30 25h1v1h-1zM31 25h1v1h-1zM32 25h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM7 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM10 26h1v1h-1zM19 26h1v1h-1zM20 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM29 26h1v1h-1zM30 26h1v1h-1zM4 27h1v1h-1zM10 27h1v1h-1zM12 27h1v1h-1zM13 27h1v1h-1zM14 27h1v1h-1zM15 27h1v1h-1zM16 27h1v1h-1zM18 27h1v1h-1zM19 27h1v1h-1zM24 27h1v1h-1zM28 27h1v1h-1zM31 27h1v1h-1zM32 27h1v1h-1zM4 28h1v1h-1zM6 28h1v1h-1zM7 28h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM12 28h1v1h-1zM13 28h1v1h-1zM14 28h1v1h-1zM16 28h1v1h-1zM21 28h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM27 28h1v1h-1zM28 28h1v1h-1zM30 28h1v1h-1zM4 29h1v1h-1zM6 29h1v1h-1zM7 29h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM12 29h1v1h-1zM13 29h1v1h-1zM17 29h1v1h-1zM18 29h1v1h-1zM20 29h1v1h-1zM21 29h1v1h-1zM22 29h1v1h-1zM29 29h1v1h-1zM30 29h1v1h-1zM31 29h1v1h-1zM32 29h1v1h-1zM4 30h1v1h-1zM6 30h1v1h-1zM7 30h1v1h-1zM8 30h1v1h-1zM10 30h1v1h-1zM12 30h1v1h-1zM13 30h1v1h-1zM14 30h1v1h-1zM17 30h1v1h-1zM19 30h1v1h-1zM21 30h1v1h-1zM23 30h1v1h-1zM25 30h1v1h-1zM26 30h1v1h-1zM27 30h1v1h-1zM28 30h1v1h-1zM29 30h1v1h-1zM30 30h1v1h-1zM31 30h1v1h-1zM4 31h1v1h-1zM10 31h1v1h-1zM13 31h1v1h-1zM14 31h1v1h-1zM15 31h1v1h-1zM16 31h1v1h-1zM23 31h1v1h-1zM24 31h1v1h-1zM26 31h1v1h-1zM28 31h1v1h-1zM29 31h1v1h-1zM31 31h1v1h-1zM4 32h1v1h-1zM5 32h1v1h-1zM6 32h1v1h-1zM7 32h1v1h-1zM8 32h1v1h-1zM9 32h1v1h-1zM10 32h1v1h-1zM12 32h1v1h-1zM15 32h1v1h-1zM17 32h1v1h-1zM18 32h1v1h-1zM19 32h1v1h-1zM21 32h1v1h-1zM23 32h1v1h-1zM26 32h1v1h-1zM27 32h1v1h-1zM28 32h1v1h-1zM30 32h1v1h-1z" fill="#141210"/></svg>';

  function injectCss() {
    if ($('mbv-style')) return;
    var s = document.createElement('style'); s.id = 'mbv-style';
    s.textContent = [
      'body.mb-standalone-active .sec:not(#s-marktbericht){display:none!important}',
      'body.mb-standalone-active #s-marktbericht{display:block!important;background:#fff;min-height:auto;padding:0}',
      '#s-marktbericht{background:#fff}',
      /* Boarding-Band */
      '.mbv-band{position:relative;display:flex;align-items:stretch;border-radius:16px;overflow:visible;border:1px solid rgba(201,168,76,.45);margin:8px 0 16px;box-shadow:0 12px 30px -18px rgba(0,0,0,.4)}',
      /* v653-klassik: Reisszone + QR + Stanzkerben + closex */
      '.mbv-rz{position:relative;display:flex;align-items:center;gap:14px;padding:0 18px;background:#fff;border-left:2px dashed rgba(26,20,7,.32);border-radius:0 16px 16px 0;min-width:150px}',
      '.mbv-qr svg{width:54px;height:54px;display:block;border-radius:7px;border:1px solid rgba(5,5,5,.2);background:#fff;padding:2px;box-shadow:0 4px 12px -6px rgba(0,0,0,.4)}',
      '.mbv-closex{position:absolute;top:-10px;right:-10px;width:26px;height:26px;border-radius:50%;background:#fff;border:1px solid rgba(201,168,76,.55);color:#7a6a3a;font-family:"JetBrains Mono",monospace;font-weight:700;font-size:15px;line-height:1;display:grid;place-items:center;cursor:pointer;z-index:7;box-shadow:0 2px 8px rgba(0,0,0,.18);padding:0}',
      '.mbv-closex:hover{background:#fff7e6;color:#1a1407}',
      '.mbv-stub::before,.mbv-stub::after,.mbv-rz::before,.mbv-rz::after{content:"";position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;border:1px solid rgba(201,168,76,.35);z-index:6}',
      '.mbv-stub::before{top:-8px;right:-9px}',
      '.mbv-stub::after{bottom:-8px;right:-9px}',
      '.mbv-rz::before{top:-8px;left:-9px}',
      '.mbv-rz::after{bottom:-8px;left:-9px}',
      '.mbv-stub{position:relative;background:#0a0a0a;color:#e9e3d2;padding:16px 22px;display:flex;flex-direction:column;justify-content:center;gap:3px;border-right:2px dashed rgba(255,255,255,.30);min-width:172px;border-radius:16px 0 0 16px}',
      '.mbv-stub .bp{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.2em;color:#bda767}',
      '.mbv-stub .k{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:30px;color:#fff;line-height:1}',
      '.mbv-stub .s{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.1em;color:#cdbb85}',
      '.mbv-bandmain{flex:1;background:linear-gradient(100deg,#C9A84C,#d8bd66 55%,#C9A84C);display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 24px;flex-wrap:wrap}',
      '.mbv-bandmain .ttl{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:30px;color:#1a1407;line-height:1.05}',
      '.mbv-bandmain .ttl .sub{display:block;font-weight:500;font-size:13px;color:#3a2f12;opacity:.9;margin-top:5px;font-family:"Inter",sans-serif;max-width:560px}',
      '.mbv-band-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.mbv-cost{display:inline-flex;align-items:center;gap:7px;font-family:"JetBrains Mono",monospace;font-size:11px;font-weight:700;color:#1a1407;background:rgba(255,255,255,.55);border:1px solid rgba(26,20,7,.25);border-radius:999px;padding:6px 11px;white-space:nowrap}',
      '.mbv-bc{width:84px;height:36px;background:repeating-linear-gradient(90deg,#0a0a0a 0 2px,transparent 2px 4px);opacity:.65;border-radius:3px}',
      '.mbv-back{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(26,20,7,.5);background:rgba(255,255,255,.88);color:#1a1407;border-radius:10px;padding:9px 15px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit}',
      '.mbv-back:hover{background:#fff}',
      '.mbv-pdf{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(26,20,7,.55);background:#0a0a0a;color:#E8CC7A;border-radius:10px;padding:9px 15px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit}',
      '.mbv-pdf:hover{background:#161310}',
      '.mbv-frame{width:100%;border:0;display:block;height:640px;background:#fff;border-radius:14px;overflow:hidden}',
      '@media (max-width:760px){.mbv-band{flex-direction:column}.mbv-stub{border-right:0;border-bottom:2px dashed rgba(255,255,255,.30);flex-direction:row;align-items:center;gap:10px;border-radius:16px 16px 0 0}.mbv-stub .k{font-size:22px}.mbv-bandmain{padding:14px 16px}.mbv-bandmain .ttl{font-size:24px}.mbv-bc{display:none}.mbv-stub::before,.mbv-stub::after,.mbv-rz::before,.mbv-rz::after{display:none}.mbv-rz{border-left:0;border-top:2px dashed rgba(26,20,7,.32);border-radius:0 0 16px 16px;justify-content:center;padding:12px 16px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function currentObjAsQuery() {
    var d = global._currentObjData || {};
    function g(k) { return d[k]; }
    var addr = '';
    var str = g('str'), hnr = g('hnr'), plz = g('plz'), ort = g('ort');
    if (str || ort || plz) addr = (str ? str + (hnr ? ' ' + hnr : '') + ', ' : '') + ((plz || '') + ' ' + (ort || '')).trim();
    var q = new URLSearchParams();
    if (addr) q.set('address', addr);
    var pt = g('objart') || g('objektart'); if (pt) q.set('ptype', pt);
    if (g('wfl')) q.set('area', g('wfl'));
    if (g('baujahr')) q.set('year', g('baujahr'));
    if (g('kp')) q.set('price', g('kp'));
    return q.toString();
  }

  function mbTheme() {
    try { var t = localStorage.getItem('dp_mb_theme'); if (t === 'dark' || t === 'light') return t; } catch (e) {}
    return 'light';
  }

  function frameSrc(query) {
    return '/marktbericht-app/index.html?v=647&theme=' + mbTheme() + (query ? '&' + query : '');
  }

  // iframe waechst auf Content-Hoehe -> kein innerer Scrollbalken, Seite scrollt
  function attachAutoHeight(fr) {
    function sizeFrame() {
      try {
        var d = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
        if (!d || !d.documentElement) return;
        var h = d.documentElement.scrollHeight;
        var cur = parseInt(fr.style.height, 10) || 0;
        if (h > 0 && Math.abs(cur - h) > 2) fr.style.height = (h + 6) + 'px';
      } catch (e) {}
    }
    fr.addEventListener('load', function () {
      sizeFrame();
      try {
        var d = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
        if (d && window.ResizeObserver && d.documentElement && !fr._mbRO) {
          fr._mbRO = new ResizeObserver(function () { sizeFrame(); });
          fr._mbRO.observe(d.documentElement);
        }
      } catch (e) {}
      // Fallback fuer asynchron nachwachsenden Bericht (gebremst, endlich)
      var n = 0; var iv = setInterval(function () { sizeFrame(); if (++n > 40) clearInterval(iv); }, 1000);
      fr._mbIv = iv;
    });
    window.addEventListener('resize', sizeFrame);
  }

  function render() {
    var host = $('s-marktbericht'); if (!host) return;
    host.innerHTML =
      '<div class="mbv-band">' +
        '<button type="button" class="mbv-closex" id="mbv-back" title="Zur\u00fcck">\u00d7</button>' +
        '<div class="mbv-stub"><span class="bp">BOARDING PASS</span><span class="k">MB</span><span class="s">DealPilot \u00b7 Bericht</span></div>' +
        '<div class="mbv-bandmain">' +
          '<div class="ttl">Marktbericht<span class="sub">Voller Marktbericht \u2013 Daten aus dem gew\u00e4hlten Objekt vorbef\u00fcllt, im Bericht anpassbar.</span></div>' +
          '<div class="mbv-band-actions">' +
            '<span class="mbv-cost" title="Wird nur bei vorhandenem Marktwert abgebucht">\u25f7 5 L bei Marktwert \u00b7 keine Daten = kostenlos</span>' + /* v654-cost-text */
          '</div>' +
        '</div>' +
        '<div class="mbv-rz"><span class="mbv-qr">' + MBV_QR + '</span>' +
          '<button type="button" class="mbv-pdf" id="mbv-pdf">PDF-Export</button>' +
        '</div>' +
      '</div>' +
      '<iframe id="mbv-frame" class="mbv-frame" src="' + frameSrc(currentObjAsQuery()) + '" allow="clipboard-write"></iframe>';
    var bk = $('mbv-back'); if (bk) bk.addEventListener('click', closeMarktberichtView);
    var pdf = $('mbv-pdf'); if (pdf) pdf.addEventListener('click', triggerFramePdf);
    var fr = $('mbv-frame'); if (fr) attachAutoHeight(fr);
  }

  // PDF-Export der Band -> klickt den (ausgeblendeten) iframe-Button #mbTopPdf (same-origin)
  function triggerFramePdf() {
    try {
      var fr = $('mbv-frame');
      var d = fr && fr.contentWindow && fr.contentWindow.document;
      var b = d && d.getElementById('mbTopPdf');
      if (b) { b.click(); return; }
    } catch (e) {}
    if (typeof global.toast === 'function') global.toast('PDF erst nach der Berichterstellung verf\u00fcgbar.');
  }

  async function openMarktberichtView() {
    injectCss();
    if (document.body.classList.contains('dp-dash-fullscreen') && global.DealPilotDashboard && typeof global.DealPilotDashboard.close === 'function') {
      try { global.DealPilotDashboard.close(); } catch (e) {}
    }
    if (document.body.classList.contains('qc-standalone-active') && typeof global.exitQuickCheckMode === 'function') {
      try { global.exitQuickCheckMode(); } catch (e) {}
    }
    document.body.classList.add('mb-standalone-active');
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    var mb = $('s-marktbericht'); if (mb) { mb.classList.add('active'); }
    render();
    window.scrollTo(0, 0);
  }

  function closeMarktberichtView() {
    var mb = $('s-marktbericht'); if (mb) { mb.classList.remove('active'); mb.innerHTML = ''; }
    document.body.classList.remove('mb-standalone-active');
    var idx = -1;
    var secs = [].slice.call(document.querySelectorAll('.sec:not(.sec-hidden)'));
    for (var i = 0; i < secs.length; i++) { if (secs[i].classList.contains('active')) { idx = i; break; } }
    if (typeof global.switchTab === 'function') global.switchTab(idx >= 0 ? idx : 0);
    if (typeof global._updateWfTop === 'function') setTimeout(global._updateWfTop, 50);
  }

  global.openMarktberichtView = openMarktberichtView;
  window.addEventListener('message', function (ev) {
    try { if (ev.data && ev.data.type === 'mbv-close') closeMarktberichtView(); } catch (e) {}
  });
  global.closeMarktberichtView = closeMarktberichtView;
})(window);
