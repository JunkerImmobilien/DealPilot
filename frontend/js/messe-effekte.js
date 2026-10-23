/* ═══════════════════════════════════════════════════════════════════════
   messe-effekte.js — Baukasten für die DealPilot-Messevideos
   10 Intros · 10 Info-Karten · 10 Outros, alle mit austauschbarem Text.

   Marcel 14.10.2026: „ein ganzes Set: 10 Intros, 10 Outros und 10
   Info-Karten, auch wo man dahinter normal das Video sieht. Dann kann ich
   dem Agenten immer alles mitgeben. Der passt aber den Text an. Und auch
   QR-Codes müssen gehen."

   Benutzung:
     DealPilotMesseFX.spiele(buehne, 'intro', 'radar', { titel: '…' })
     DealPilotMesseFX.liste()   -> { intros: [...], karten: [...], outros: [...] }
   `buehne` ist ein Element mit position:relative (oder fixed, inset:0);
   gerendert wird in eine Ebene darin. Alle Größen in cqw (Breite der Bühne),
   damit es in jedem Format gleich aussieht. Karten sind durchsichtig auf das,
   was dahinter läuft (App oder Video); Intros/Outros sind vollflächig.
   Texte: jedes Stück nennt seine Felder mit Vorgabe (`felder`); der Agent
   überschreibt nur, was er braucht. QR: echte Codes über qrcodejs 1.0.0
   (dieselbe Bibliothek wie quick-boarding-share.js).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotMesseFX) return;
  var G = 'var(--wl-c9a84c,#C9A84C)', GH = 'var(--wl-e8cc7a,#E8CC7A)', GL = 'var(--wl-b8932f,#b8932f)';
  var QR_LIB = '/vendor/cdn/qrcodejs/1.0.0/qrcode.min.js';
  var FLIEGER = '<svg viewBox="0 0 64 64"><path d="M32 2c2 0 3 3 3 6v16l22 12v6l-22-6v12l7 5v4l-10-3-10 3v-4l7-5V36L7 42v-6l22-12V8c0-3 1-6 3-6z"/></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function marke(cls) { return '<div class="mfx-marke ' + (cls || '') + '">Deal<b>Pilot</b></div>'; }

  /* ── Stil (einmal, alles mit mfx- vorne) ─────────────────────────── */
  var CSS = [
    '.mfx-ebene{position:absolute;inset:0;container-type:inline-size;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#FDFCFA;z-index:20}',
    '.mfx-voll{background:#050505}',
    '.mfx-marke{font:700 13cqw/1 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.04em;color:#FDFCFA}',
    '.mfx-marke b{font-weight:700;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
    '.mfx-marke.m{font-size:8cqw}.mfx-marke.s{font-size:4.6cqw}.mfx-marke.xs{font-size:2.6cqw}',
    '.mfx-kick{font:700 1.15cqw "JetBrains Mono",monospace;letter-spacing:.3em;text-transform:uppercase;color:' + G + '}',
    '.mfx-claim{font:600 1.5cqw "JetBrains Mono",monospace;letter-spacing:.28em;text-transform:uppercase;color:' + G + '}',
    '.mfx-gross{font:700 4.4cqw/1.1 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.02em}',
    '.mfx-gross em{font-style:normal;color:' + GH + '}',
    '.mfx-mitte{position:absolute;inset:0;display:grid;place-items:center;text-align:center}',
    '.mfx-a{opacity:0;animation:mfxAuf .9s cubic-bezier(.2,.8,.2,1) forwards}',
    '@keyframes mfxAuf{from{opacity:0;transform:translateY(1.4cqw)}to{opacity:1;transform:none}}',
    '@keyframes mfxZoom{from{opacity:0;transform:scale(.8);filter:blur(.8cqw)}to{opacity:1;transform:none;filter:none}}',
    '@keyframes mfxGlanz{0%{background-position:130% 0}100%{background-position:-130% 0}}',
    '@keyframes mfxPuls{50%{opacity:.55}}',
    '.mfx-glanz b{background:linear-gradient(110deg,' + G + ' 0%,' + G + ' 38%,#FFF6D8 50%,' + G + ' 62%,' + G + ' 100%);background-size:280% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mfxGlanz 2.6s 1.2s ease-in-out}',
    '.mfx-qr{background:#FDFCFA;padding:1.1cqw;border-radius:1.2cqw;display:inline-block;line-height:0}',
    '.mfx-qr img,.mfx-qr canvas{width:100%!important;height:auto!important;display:block}',
    '.mfx-url{font:700 1.6cqw "JetBrains Mono",monospace;letter-spacing:.24em;color:' + G + '}',
    /* Karten-Grundform (Tour-Optik) */
    '.mfx-karte{position:absolute;border-radius:1.4cqw;padding:1.7cqw 1.9cqw;background:linear-gradient(135deg,rgba(16,13,6,.96),rgba(7,6,4,.96));border:.12cqw solid ' + G + ';box-shadow:0 1.6cqw 4cqw rgba(0,0,0,.6);opacity:0;transform:translateY(1.6cqw) scale(.95);animation:mfxKarte .7s .2s cubic-bezier(.18,.89,.32,1.28) forwards}',
    '.mfx-karte::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(ellipse at 50% 0%,color-mix(in srgb,' + G + ' 22%,transparent),transparent 65%);pointer-events:none}',
    '.mfx-karte>*{position:relative}',
    '@keyframes mfxKarte{to{opacity:1;transform:none}}',
    '.mfx-karte h2{margin:.6cqw 0 1cqw;font:700 2.2cqw/1.15 "Space Grotesk",system-ui,sans-serif}',
    '.mfx-karte p{margin:0;font-size:1.15cqw;line-height:1.5;color:#d9cfb8}',
    '.mfx-ziel{position:absolute;border-radius:1cqw;box-shadow:0 0 0 .22cqw ' + GH + ',0 0 3.6cqw .6cqw color-mix(in srgb,' + G + ' 55%,transparent);opacity:0;animation:mfxAuf .6s forwards,mfxZielPuls 2.4s 1s ease-in-out infinite}',
    '@keyframes mfxZielPuls{50%{box-shadow:0 0 0 .22cqw ' + GH + ',0 0 6cqw 1cqw color-mix(in srgb,' + G + ' 70%,transparent)}}',
    '.mfx-kachel{background:#17130c;border:.06cqw solid #3a3324;border-radius:.8cqw;padding:.8cqw 1cqw;opacity:0;animation:mfxAuf .5s forwards}',
    '.mfx-kachel i{display:block;font:600 .7cqw "JetBrains Mono",monospace;font-style:normal;letter-spacing:.16em;text-transform:uppercase;color:#8c8578}',
    '.mfx-kachel b{font:700 2cqw "Space Grotesk",system-ui,sans-serif}',
    '.gr{color:#3FA56C!important}.ro{color:#D8564C!important}',

    /* INTRO 1 · Runway */
    '.i-runway{background:radial-gradient(120% 90% at 50% 110%,#1d1608,#050505 60%)}',
    '.i-runway .bahn{position:absolute;left:50%;bottom:-10%;width:220%;height:85%;transform:translateX(-50%) perspective(30cqw) rotateX(68deg);transform-origin:50% 100%;background:linear-gradient(90deg,transparent 47%,color-mix(in srgb,' + G + ' 40%,transparent) 49%,transparent 49.4%,transparent 50.6%,color-mix(in srgb,' + G + ' 40%,transparent) 51%,transparent 53%)}',
    '.i-runway .licht{position:absolute;left:50%;width:.55cqw;height:.55cqw;border-radius:50%;background:' + GH + ';box-shadow:0 0 1cqw .2cqw ' + G + ';animation:iRunLicht 1.1s linear infinite;opacity:0}',
    '@keyframes iRunLicht{0%{transform:translate(var(--x0),0) scale(.2);opacity:0;top:58%}15%{opacity:1}100%{transform:translate(var(--x1),0) scale(1.6);opacity:0;top:110%}}',
    '.i-runway .fl{position:absolute;left:50%;top:70%;width:8cqw;fill:' + GH + ';opacity:0;animation:iRunAb 2.4s .6s cubic-bezier(.5,0,.3,1) forwards;filter:drop-shadow(0 0 1cqw ' + G + ')}',
    '@keyframes iRunAb{0%{opacity:0;transform:translate(-50%,0) scale(.3)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-34cqw) scale(1.8) rotate(-8deg)}}',
    '.mfx-buchst span{display:inline-block;opacity:0;transform:translateY(3cqw) rotateX(70deg);filter:blur(.5cqw);animation:mfxBuchst .7s cubic-bezier(.2,.8,.2,1) forwards}',
    '@keyframes mfxBuchst{to{opacity:1;transform:none;filter:none}}',
    '.mfx-buchst b{background:none;color:' + GH + '}.mfx-buchst b span{color:' + GH + '}',
    '.mfx-linie{height:.16cqw;width:0;margin:1.1cqw auto 0;background:linear-gradient(90deg,transparent,' + GH + ',transparent);animation:mfxLinie 1.4s cubic-bezier(.6,0,.2,1) forwards}',
    '@keyframes mfxLinie{to{width:48cqw}}',

    /* INTRO 2 · Cockpit */
    '.i-cockpit{background:radial-gradient(80% 80% at 50% 45%,#16120a,#050505 70%)}',
    '.i-cockpit svg{position:absolute;left:50%;top:50%;width:34cqw;transform:translate(-50%,-50%);overflow:visible;animation:mfxWeg 1s 2.9s cubic-bezier(.6,0,.4,1) forwards}',
    '@keyframes mfxWeg{to{transform:translate(-50%,-50%) scale(2.4);opacity:0;filter:blur(.4cqw)}}',
    '.i-cockpit .fuell{stroke-dasharray:942;stroke-dashoffset:942;animation:iCoFuell 2.2s .4s cubic-bezier(.3,0,.2,1) forwards}',
    '@keyframes iCoFuell{to{stroke-dashoffset:120}}',
    '.i-cockpit .zeiger{transform-origin:310px 310px;transform:rotate(-135deg);animation:iCoZeiger 2.2s .4s cubic-bezier(.3,0,.2,1.2) forwards}',
    '@keyframes iCoZeiger{to{transform:rotate(100deg)}}',

    /* INTRO 3 · Boarding Pass */
    '.i-pass{background:radial-gradient(90% 90% at 30% 20%,#1a140a,#050505 65%);perspective:80cqw}',
    '.i-pass .pass{position:absolute;left:50%;top:50%;width:62cqw;height:22cqw;margin:-11cqw 0 0 -31cqw;display:flex;border-radius:1.4cqw;overflow:hidden;box-shadow:0 2cqw 5cqw rgba(0,0,0,.7);transform:rotateX(70deg) translateY(16cqw);opacity:0;animation:iPass 1.2s .2s cubic-bezier(.2,.9,.2,1.05) forwards}',
    '@keyframes iPass{to{transform:none;opacity:1}}',
    '.i-pass .l{flex:1;background:linear-gradient(110deg,' + GH + ',' + G + ' 60%,' + GL + ');color:#1a1407;padding:2cqw 2.6cqw;position:relative}',
    '.i-pass .r{width:17cqw;background:#0c0b09;border-left:.16cqw dashed #3a3324;padding:1.8cqw;display:flex;flex-direction:column;justify-content:space-between}',
    '.i-pass .k{font:700 .85cqw "JetBrains Mono";letter-spacing:.3em;text-transform:uppercase;opacity:.75}',
    '.i-pass .route{display:flex;align-items:center;gap:1.5cqw;margin-top:1.4cqw}',
    '.i-pass .ort b{display:block;font:700 4cqw/1 "Space Grotesk"}',
    '.i-pass .ort i{font:600 .8cqw "JetBrains Mono";font-style:normal;letter-spacing:.2em;opacity:.7}',
    '.i-pass .flug{flex:1;height:.12cqw;background:repeating-linear-gradient(90deg,#1a1407 0 .5cqw,transparent 0 .9cqw);position:relative}',
    '.i-pass .flug::after{content:"✈";position:absolute;top:-1.5cqw;left:0;font-size:2.3cqw;animation:iPassFlug 1.6s 1.3s ease-in-out forwards}',
    '@keyframes iPassFlug{to{left:calc(100% - 2.3cqw)}}',
    '.i-pass .felder{display:flex;gap:2.6cqw;margin-top:2.2cqw}',
    '.i-pass .felder div{opacity:0;animation:mfxAuf .6s forwards}',
    '.i-pass .felder i{display:block;font:600 .7cqw "JetBrains Mono";font-style:normal;letter-spacing:.2em;opacity:.65}',
    '.i-pass .felder b{font:700 1.9cqw "Space Grotesk"}',
    '.i-pass .stempel{position:absolute;right:2.6cqw;top:2.4cqw;border:.26cqw solid #1a1407;border-radius:.6cqw;padding:.4cqw 1cqw;font:700 1.8cqw "Space Grotesk";transform:rotate(-12deg) scale(3);opacity:0;animation:iStempel .35s 2.8s cubic-bezier(.3,1.6,.5,1) forwards}',
    '@keyframes iStempel{to{transform:rotate(-12deg) scale(1);opacity:.85}}',
    '.i-pass .strich{height:6cqw;background:repeating-linear-gradient(90deg,#FDFCFA 0 .16cqw,transparent 0 .32cqw,#FDFCFA 0 .38cqw,transparent 0 .58cqw);clip-path:inset(0 100% 0 0);animation:iStrich 1.2s 1.4s steps(30) forwards}',
    '@keyframes iStrich{to{clip-path:inset(0 0 0 0)}}',
    '.mfx-danach{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:#050505;opacity:0;animation:mfxAuf .9s forwards}',

    /* INTRO 4 · Radar */
    '.i-radar{background:radial-gradient(circle at 50% 50%,#0f0c06,#050505 70%)}',
    '.i-radar .schirm{position:absolute;left:50%;top:50%;width:40cqw;height:40cqw;margin:-20cqw 0 0 -20cqw;border-radius:50%;border:.12cqw solid color-mix(in srgb,' + G + ' 45%,transparent);background:repeating-radial-gradient(circle,transparent 0 4.8cqw,color-mix(in srgb,' + G + ' 18%,transparent) 4.9cqw 5cqw)}',
    '.i-radar .schirm::before,.i-radar .schirm::after{content:"";position:absolute;background:color-mix(in srgb,' + G + ' 25%,transparent)}',
    '.i-radar .schirm::before{left:50%;top:0;bottom:0;width:.08cqw}.i-radar .schirm::after{top:50%;left:0;right:0;height:.08cqw}',
    '.i-radar .strahl{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,transparent 300deg,color-mix(in srgb,' + GH + ' 55%,transparent) 360deg);animation:iRadarDreh 2s linear 2}',
    '@keyframes iRadarDreh{to{transform:rotate(360deg)}}',
    '.i-radar .blip{position:absolute;width:.8cqw;height:.8cqw;margin:-.4cqw;border-radius:50%;background:' + GH + ';box-shadow:0 0 1cqw ' + G + ';opacity:0;animation:iBlip 2s ease-out infinite}',
    '@keyframes iBlip{0%,8%{opacity:0;transform:scale(.4)}12%{opacity:1;transform:scale(1.4)}60%{opacity:.5;transform:scale(1)}100%{opacity:0}}',
    '.i-radar .lock{position:absolute;width:5cqw;height:5cqw;margin:-2.5cqw;border:.2cqw solid ' + GH + ';border-radius:.4cqw;opacity:0;animation:iLock .6s 3.2s cubic-bezier(.3,1.5,.5,1) forwards}',
    '@keyframes iLock{from{opacity:0;transform:scale(2.4) rotate(45deg)}to{opacity:1;transform:none}}',
    '.i-radar .lockt{position:absolute;white-space:nowrap;font:700 .9cqw "JetBrains Mono";letter-spacing:.2em;color:' + GH + ';opacity:0;animation:mfxAuf .5s 3.6s forwards}',

    /* INTRO 5 · Abflugtafel (Split-Flap) */
    '.i-tafel{background:#070604;display:grid;place-items:center}',
    '.i-tafel .tafel{background:#0e0c09;border:.12cqw solid #2a2622;border-radius:1cqw;padding:2cqw 2.4cqw;box-shadow:0 2cqw 5cqw rgba(0,0,0,.7)}',
    '.i-tafel .kopfz{display:flex;justify-content:space-between;font:700 .9cqw "JetBrains Mono";letter-spacing:.3em;color:' + G + ';margin-bottom:1.2cqw}',
    '.i-tafel .zeile{display:flex;gap:.3cqw;margin:.4cqw 0}',
    '.i-tafel .z{width:3.1cqw;height:4.3cqw;background:linear-gradient(#1c1914 50%,#15130f 50%);border-radius:.3cqw;display:grid;place-items:center;font:700 3cqw "JetBrains Mono";color:#FDFCFA;position:relative;overflow:hidden}',
    '.i-tafel .z::after{content:"";position:absolute;left:0;right:0;top:50%;height:.08cqw;background:#050505}',
    '.i-tafel .z.g{color:' + GH + '}',
    '.i-tafel .z.f{animation:iFlap .09s steps(1) infinite}',
    '@keyframes iFlap{50%{transform:scaleY(.86)}}',

    /* INTRO 6 · Pre-Flight-Checkliste */
    '.i-check{background:radial-gradient(90% 90% at 70% 30%,#16120a,#050505 65%)}',
    '.i-check .liste{position:absolute;left:12cqw;top:50%;transform:translateY(-50%)}',
    '.i-check .pz{display:flex;align-items:center;gap:1.6cqw;margin:1.4cqw 0;font:700 3cqw "Space Grotesk";opacity:0;animation:mfxAuf .5s forwards}',
    '.i-check .hk{width:3.6cqw;height:3.6cqw;border-radius:.8cqw;border:.2cqw solid ' + G + ';display:grid;place-items:center;font-size:2.4cqw;color:#050505;position:relative;overflow:hidden}',
    '.i-check .hk::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;background:' + GH + ';transform:scale(0);border-radius:.5cqw;animation:iHaken .35s cubic-bezier(.3,1.6,.5,1) forwards;animation-delay:inherit}',
    '@keyframes iHaken{to{transform:scale(1)}}',
    '.i-check .rechts{position:absolute;right:10cqw;top:50%;transform:translateY(-50%);text-align:right;opacity:0;animation:mfxZoom 1s 3.4s forwards}',

    /* INTRO 7 · Wolkendurchbruch */
    '.i-wolken{background:linear-gradient(#050505,#120e06 55%,#2a1f08)}',
    '.i-wolken .sonne{position:absolute;left:50%;top:42%;width:30cqw;height:30cqw;margin:-15cqw;border-radius:50%;background:radial-gradient(circle,' + GH + ' 0%,color-mix(in srgb,' + G + ' 50%,transparent) 30%,transparent 65%);opacity:0;animation:mfxZoom 2.4s .6s forwards}',
    '.i-wolken .w{position:absolute;height:22cqw;width:80cqw;border-radius:50%;background:radial-gradient(ellipse at 50% 60%,#2b2722,#141210 60%,transparent 72%);filter:blur(.8cqw)}',
    '.i-wolken .w.l{left:-12cqw;top:30%;animation:iWolkeL 3.2s .3s cubic-bezier(.6,0,.3,1) forwards}',
    '.i-wolken .w.r{right:-12cqw;top:38%;animation:iWolkeR 3.2s .3s cubic-bezier(.6,0,.3,1) forwards}',
    '.i-wolken .w.u{left:10cqw;top:62%;animation:iWolkeU 3.2s .3s cubic-bezier(.6,0,.3,1) forwards}',
    '@keyframes iWolkeL{to{transform:translateX(-60cqw);opacity:.2}}@keyframes iWolkeR{to{transform:translateX(60cqw);opacity:.2}}@keyframes iWolkeU{to{transform:translateY(30cqw);opacity:0}}',

    /* INTRO 8 · Blaupause (Haus zeichnet sich) */
    '.i-plan{background:#060a10;background-image:linear-gradient(color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 6%,transparent) .06cqw,transparent .06cqw),linear-gradient(90deg,color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 6%,transparent) .06cqw,transparent .06cqw);background-size:2.4cqw 2.4cqw}',
    '.i-plan svg{position:absolute;left:50%;top:36%;width:24cqw;transform:translate(-50%,-50%)}',
    '.i-plan path{fill:none;stroke:' + GH + ';stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:900;stroke-dashoffset:900;animation:iZeichne 2.4s .3s ease-in-out forwards}',
    '@keyframes iZeichne{to{stroke-dashoffset:0}}',
    '.i-plan .mass{position:absolute;font:600 1.2cqw "JetBrains Mono";color:' + G + ';opacity:0;animation:mfxAuf .5s forwards}',
    '.i-plan .unten{position:absolute;left:0;right:0;bottom:4.5cqw;text-align:center;opacity:0;animation:mfxZoom 1s 2.9s forwards}',

    /* INTRO 9 · Flugroute über Karte */
    '.i-route{background:#050505;background-image:radial-gradient(circle,color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 18%,transparent) .12cqw,transparent .14cqw);background-size:1.8cqw 1.8cqw}',
    '.i-route svg{position:absolute;inset:0;width:100%;height:100%}',
    '.i-route .bahnp{fill:none;stroke:' + GH + ';stroke-width:.35;stroke-dasharray:2 1.2;stroke-dashoffset:0}',
    '.i-route .zug{fill:none;stroke:' + GH + ';stroke-width:.5;stroke-dasharray:160;stroke-dashoffset:160;animation:iZeichne 2.6s .4s ease-in-out forwards}',
    '.i-route .pin{position:absolute;width:1.4cqw;height:1.4cqw;margin:-.7cqw;border-radius:50% 50% 50% 0;transform:rotate(-45deg) scale(0);background:' + GH + ';box-shadow:0 0 1.2cqw ' + G + ';animation:iPin .4s cubic-bezier(.3,1.6,.5,1) forwards}',
    '@keyframes iPin{to{transform:rotate(-45deg) scale(1)}}',
    '.i-route .pint{position:absolute;white-space:nowrap;font:700 1.3cqw "JetBrains Mono";letter-spacing:.16em;color:#d9cfb8;opacity:0;animation:mfxAuf .4s forwards}',

    /* INTRO 10 · Typo-Kinetik */
    '.i-typo{background:#050505}',
    '.i-typo .wort{position:absolute;inset:0;display:grid;place-items:center;font:700 12cqw/1 "Space Grotesk";letter-spacing:-.04em;opacity:0}',
    '.i-typo .wort span{animation:iSchlag 1.05s cubic-bezier(.2,.9,.2,1) forwards}',
    '@keyframes iSchlag{0%{opacity:0;transform:scale(2.4);filter:blur(1cqw)}18%{opacity:1;transform:scale(1);filter:none}75%{opacity:1;transform:scale(.96)}100%{opacity:0;transform:scale(.9)}}',
    '.i-typo .wort.g span{color:' + GH + '}',

    /* KARTEN */
    '.k-ring .ring{width:8cqw;height:8cqw;flex:none;position:relative}',
    '.k-ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
    '.k-ring .hg{fill:none;stroke:#2a2418;stroke-width:10}.k-ring .vg{fill:none;stroke-width:10;stroke-linecap:round;stroke-dasharray:283;transition:stroke-dashoffset 1.6s cubic-bezier(.3,0,.2,1),stroke 1.6s}',
    '.k-ring .wert{position:absolute;inset:0;display:grid;place-items:center;font:700 3cqw "Space Grotesk"}',
    '.mfx-pille{display:inline-block;padding:.35cqw .8cqw;border-radius:9cqw;font:700 .8cqw "JetBrains Mono";letter-spacing:.2em;border:.06cqw solid currentColor}',
    '.k-spanne .bar{position:relative;height:1.2cqw;border-radius:1cqw;background:linear-gradient(90deg,#D8564C,var(--wl-e8cc7a,#E8CC7A) 50%,#3FA56C);margin:2.4cqw 0 1cqw}',
    '.k-spanne .mk{position:absolute;top:50%;width:2cqw;height:2cqw;margin:-1cqw;border-radius:50%;background:#FDFCFA;box-shadow:0 0 0 .3cqw #050505,0 0 1.4cqw ' + GH + ';left:0;transition:left 1.6s cubic-bezier(.3,0,.2,1)}',
    '.k-spanne .stufen{display:flex;justify-content:space-between;font:600 .9cqw "JetBrains Mono";color:#8c8578}',
    '.k-spanne .stufen b{display:block;font:700 1.5cqw "Space Grotesk";color:#FDFCFA}',
    '.k-check .pz{display:flex;align-items:center;gap:.9cqw;margin:.7cqw 0;font-size:1.3cqw;opacity:0;animation:mfxAuf .4s forwards}',
    '.k-check .pz i{width:1.6cqw;height:1.6cqw;border-radius:.4cqw;background:' + GH + ';color:#050505;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:1.1cqw}',
    '.k-check .pz b{margin-left:auto;font-family:"Space Grotesk";color:' + GH + '}',
    '.k-vgl .zwei{display:flex;align-items:center;gap:1.6cqw}',
    '.k-vgl .wert{font:700 4.4cqw/1 "Space Grotesk"}',
    '.k-vgl .pfeil{font-size:3cqw;color:' + GH + ';opacity:0;animation:mfxAuf .5s 1.2s forwards}',
    '.k-vgl .nach{opacity:0;animation:mfxZoom .7s 1.6s forwards}',
    '.k-callout{padding:.9cqw 1.3cqw!important;border-radius:5cqw!important;font:700 1.4cqw "Space Grotesk"}',
    '.k-callout .linie{position:absolute;height:.24cqw;margin-top:-.12cqw;border-radius:.2cqw;background:' + GH + ';box-shadow:0 0 .8cqw ' + G + ';transform-origin:0 50%;transform:scaleX(0);animation:kLinie .5s .7s forwards}',
    '@keyframes kLinie{to{transform:scaleX(1)}}',
    '.k-pilot{display:flex;gap:1.4cqw;align-items:flex-start}',
    '.k-pilot .kopf{width:5cqw;height:5cqw;flex:none;border-radius:50%;background:linear-gradient(135deg,' + GH + ',' + GL + ');display:grid;place-items:center;font-size:2.6cqw;box-shadow:0 0 1.6cqw color-mix(in srgb,' + G + ' 50%,transparent)}',
    '.k-pilot .tipp{font-size:1.3cqw;line-height:1.5;color:#FDFCFA;min-height:6cqw}',
    '.k-pilot .tipp::after{content:"▍";color:' + GH + ';animation:mfxPuls .8s steps(1) infinite}',
    '.k-band{left:0!important;right:0!important;border-radius:0!important;border-width:.12cqw 0!important;display:flex;align-items:center;gap:2cqw;padding:1.1cqw 4cqw!important}',
    '.k-band .nr{font:700 3.2cqw "Space Grotesk";color:' + GH + '}',
    '.k-band .schritte{margin-left:auto;display:flex;gap:.5cqw}.k-band .schritte i{width:2cqw;height:.3cqw;border-radius:.2cqw;background:#3a3324}.k-band .schritte i.an{background:' + GH + '}',
    '.k-raster .raster{display:grid;grid-template-columns:1fr 1fr;gap:.8cqw;perspective:40cqw}',
    '.k-raster .mfx-kachel{animation:kFlip .6s forwards;transform:rotateY(90deg)}',
    '@keyframes kFlip{to{opacity:1;transform:none}}',

    /* OUTROS */
    '.o-start{background:radial-gradient(100% 80% at 50% 50%,#17120a,#050505 70%)}',
    '.o-start .spur{position:absolute;left:-10%;top:62%;width:0;height:.16cqw;background:linear-gradient(90deg,transparent,' + G + ' 30%,' + GH + ');box-shadow:0 0 1cqw ' + G + ';animation:oSpur 1.8s .2s cubic-bezier(.5,0,.3,1) forwards}',
    '@keyframes oSpur{60%{width:70%;opacity:1}100%{width:120%;opacity:0;transform:rotate(-14deg);transform-origin:0 50%}}',
    '.o-start .fl{position:absolute;left:-12%;top:58%;width:6cqw;fill:' + GH + ';transform:rotate(90deg);filter:drop-shadow(0 0 .8cqw ' + G + ');animation:oFl 1.8s .2s cubic-bezier(.5,0,.3,1) forwards}',
    '@keyframes oFl{60%{left:58%;top:58%;transform:rotate(90deg)}100%{left:112%;top:20%;transform:rotate(76deg)}}',
    '.mfx-funke{position:absolute;width:.22cqw;height:.22cqw;border-radius:50%;background:' + GH + ';box-shadow:0 0 .5cqw ' + G + ';opacity:0;animation:mfxFunke 3s ease-out infinite}',
    '@keyframes mfxFunke{0%{opacity:0}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}',
    '.o-gold{background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');color:#1a1407}',
    '.o-gold .mfx-marke{background:#050505;border-radius:1.4cqw;padding:1.2cqw 2.4cqw;display:inline-block;font-size:6cqw}',
    '.o-gold .mfx-url{color:#1a1407}',
    '.o-landung{background:linear-gradient(#050505 55%,#120e06)}',
    '.o-landung .fl{position:absolute;width:7cqw;fill:' + GH + ';left:-10%;top:5%;transform:rotate(120deg);animation:oLand 2.4s .2s cubic-bezier(.3,0,.2,1) forwards;filter:drop-shadow(0 0 1cqw ' + G + ')}',
    '@keyframes oLand{to{left:44%;top:66%;transform:rotate(90deg)}}',
    '.o-landung .lichter{position:absolute;left:0;right:0;top:74%;display:flex;justify-content:space-around}',
    '.o-landung .lichter i{width:.6cqw;height:.6cqw;border-radius:50%;background:' + GH + ';box-shadow:0 0 1cqw ' + G + ';animation:mfxPuls 1s ease-in-out infinite}',
    '.o-gate{background:#0b0a08;display:grid;place-items:center}',
    '.o-gate .schild{display:flex;align-items:center;gap:3cqw;background:#121009;border:.16cqw solid #2a2622;border-radius:1.2cqw;padding:2.4cqw 3cqw;box-shadow:0 2cqw 5cqw rgba(0,0,0,.7);animation:mfxZoom .9s forwards}',
    '.o-gate .gatenr{font:700 9cqw/1 "Space Grotesk";color:' + GH + '}',
    '.o-gate .blink{color:#3FA56C;animation:mfxPuls 1.2s ease-in-out infinite}',
    '.o-karte{background:radial-gradient(circle at 50% 40%,#1a140a,#050505 70%);perspective:90cqw}',
    '.o-karte .vk{position:absolute;left:50%;top:50%;width:48cqw;height:27cqw;margin:-13.5cqw 0 0 -24cqw;transform-style:preserve-3d;animation:oFlip 1.2s 2s cubic-bezier(.6,0,.3,1) forwards}',
    '@keyframes oFlip{to{transform:rotateY(180deg)}}',
    '.o-karte .seite{position:absolute;inset:0;border-radius:1.4cqw;backface-visibility:hidden;display:grid;place-items:center;box-shadow:0 2cqw 5cqw rgba(0,0,0,.6)}',
    '.o-karte .vorne{background:#050505;border:.14cqw solid ' + G + '}',
    '.o-karte .hinten{background:linear-gradient(110deg,' + GH + ',' + G + ' 60%,' + GL + ');color:#1a1407;transform:rotateY(180deg);grid-template-columns:1fr auto;padding:0 3cqw;gap:2cqw;text-align:left}',
    '.o-horizont{background:#050505}',
    '.o-horizont .h{position:absolute;left:50%;top:60%;width:0;height:.2cqw;transform:translateX(-50%);background:linear-gradient(90deg,transparent,' + GH + ',transparent);box-shadow:0 0 3cqw 1cqw color-mix(in srgb,' + G + ' 45%,transparent);animation:oHor 1.6s .2s cubic-bezier(.6,0,.2,1) forwards}',
    '@keyframes oHor{to{width:120cqw}}',
    '.o-horizont .glow{position:absolute;left:0;right:0;top:60%;bottom:0;background:linear-gradient(color-mix(in srgb,' + G + ' 30%,transparent),transparent 60%);opacity:0;animation:mfxAuf 1.4s 1s forwards}',
    '.o-countdown .ring{width:16cqw;height:16cqw;position:relative}',
    '.o-countdown svg{width:100%;height:100%;transform:rotate(-90deg)}',
    '.o-countdown .vg{fill:none;stroke:' + GH + ';stroke-width:6;stroke-linecap:round;stroke-dasharray:283;stroke-dashoffset:0;animation:oUhr 5s linear forwards}',
    '@keyframes oUhr{to{stroke-dashoffset:283}}',
    '.o-countdown .zahl{position:absolute;inset:0;display:grid;place-items:center;font:700 6cqw "Space Grotesk"}',

    /* v2253 · REIHE „So funktioniert DealPilot" - ein Intro und ein Outro
       für alle Module: Nummer, Titel, Unterzeile bzw. Spruch je Video */
    '.r-grund{background:radial-gradient(70% 70% at 50% 38%,#17120a,#050505 70%)}',
    '.r-grund::before{content:"";position:absolute;left:50%;bottom:-6%;width:200%;height:62%;transform:translateX(-50%) perspective(30cqw) rotateX(66deg);transform-origin:50% 100%;background:repeating-linear-gradient(90deg,transparent 0 6cqw,color-mix(in srgb,' + G + ' 10%,transparent) 6cqw 6.08cqw),linear-gradient(90deg,transparent 49.6%,color-mix(in srgb,' + G + ' 45%,transparent) 49.6% 50.4%,transparent 50.4%);opacity:0;animation:mfxAuf 1.6s .2s forwards}',
    '.r-kopf{position:absolute;left:0;right:0;top:7cqw;text-align:center}',
    '.r-mitte{position:absolute;left:0;right:0;top:12.5cqw;text-align:center}',
    '.r-nr{display:inline-flex;align-items:center;gap:1.4cqw;margin-top:2.6cqw;opacity:0;animation:mfxZoom .9s 2.3s cubic-bezier(.2,.8,.2,1) forwards}',
    '.r-nr i{font:700 1.15cqw "JetBrains Mono",monospace;font-style:normal;letter-spacing:.34em;text-transform:uppercase;color:' + G + '}',
    '.r-nr b{display:inline-grid;place-items:center;min-width:7.4cqw;height:7.4cqw;padding:0 1.2cqw;border-radius:1.6cqw;font:700 4.8cqw/1 "Space Grotesk",sans-serif;color:#1a1407;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');box-shadow:0 1cqw 3cqw color-mix(in srgb,' + G + ' 35%,transparent),inset 0 .1cqw 0 rgba(255,255,255,.35)}',
    '.r-titel{font:700 4.6cqw/1.1 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.02em;margin-top:2.2cqw;opacity:0;animation:mfxAuf .9s 2.9s cubic-bezier(.2,.8,.2,1) forwards}',
    '.r-unter{font:400 1.75cqw/1.45 Inter,system-ui,sans-serif;color:#d9cfb8;margin:1.3cqw auto 0;max-width:62cqw;opacity:0;animation:mfxAuf .9s 3.5s cubic-bezier(.2,.8,.2,1) forwards}',
    '.r-spur{position:absolute;left:0;right:0;top:9.6cqw;height:.14cqw;background:linear-gradient(90deg,transparent,' + GH + ',transparent);transform:scaleX(0);animation:rSpur 1.4s 1.2s cubic-bezier(.6,0,.2,1) forwards}',
    '@keyframes rSpur{to{transform:scaleX(1)}}',
    '.r-fl{position:absolute;top:8.2cqw;left:-6cqw;width:3cqw;fill:' + GH + ';transform:rotate(90deg);filter:drop-shadow(0 0 .8cqw ' + G + ');animation:rFlug 2.2s 1s cubic-bezier(.5,0,.4,1) forwards}',
    '@keyframes rFlug{to{left:104cqw}}',
    /* Outro: der Logo-Rahmen zieht sich, die Wortmarke glänzt */
    '.r-logo{position:relative;width:52cqw;margin:0 auto}',
    '.r-logo svg{display:block;width:100%;overflow:visible}',
    '.r-logo rect{fill:none;stroke-width:5;stroke-dasharray:1;stroke-dashoffset:1;animation:rRahmen 2.4s .3s linear forwards;filter:drop-shadow(0 0 .9cqw color-mix(in srgb,' + G + ' 55%,transparent))}',
    '@keyframes rRahmen{0%{stroke-dashoffset:1;animation-timing-function:cubic-bezier(.4,0,.6,1)}45%{stroke-dashoffset:.6474;animation-timing-function:cubic-bezier(.3,0,.3,1)}100%{stroke-dashoffset:0}}',
    '.r-logo .w{position:absolute;inset:0;display:grid;place-items:center;font:700 9.6cqw/1 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.035em;color:#FDFCFA;opacity:0;animation:mfxZoom 1.1s 1.9s cubic-bezier(.2,.8,.2,1) forwards}',
    '.r-logo .w b{font-weight:700;background:linear-gradient(110deg,' + G + ' 0%,' + G + ' 38%,#FFF6D8 50%,' + G + ' 62%,' + G + ' 100%);background-size:280% 100%;background-position:130% 0;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mfxGlanz 2.2s 3s ease-in-out forwards}',
    '.r-logo .fl{position:absolute;top:-1.4cqw;left:1.83cqw;width:3.2cqw;fill:' + GH + ';transform:rotate(90deg);filter:drop-shadow(0 0 .8cqw ' + G + ');opacity:0;animation:rLogoFlug 2.4s .3s linear forwards}',
    '@keyframes rLogoFlug{0%{opacity:1;left:1.83cqw;animation-timing-function:cubic-bezier(.4,0,.6,1)}45%{opacity:1;left:46.97cqw;animation-timing-function:ease-out}60%{opacity:0;left:56cqw}100%{opacity:0;left:56cqw}}',
    '.r-spruch{font:700 3.3cqw/1.2 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.015em;margin-top:3.4cqw;opacity:0;animation:mfxAuf .9s 3.4s cubic-bezier(.2,.8,.2,1) forwards}',
    '.r-spruch em{font-style:normal;color:' + GH + '}',
    '.r-fuss{position:absolute;left:0;right:0;bottom:4.6cqw;display:flex;justify-content:center;align-items:center;gap:2.4cqw;opacity:0;animation:mfxAuf .9s 4.3s forwards}',
    '.r-fuss .mfx-kick{color:#8c8578}',
    '.r-weiter{font:600 1.25cqw Inter,system-ui,sans-serif;color:#d9cfb8}',
    '.r-weiter b{color:' + GH + ';font-weight:600}'
  ].join('\n');

  function stil() {
    if (document.getElementById('mfx-css')) return;
    var s = document.createElement('style'); s.id = 'mfx-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ── Helfer ──────────────────────────────────────────────────────── */
  function zaehle(el, von, bis, ms, verz, fmt) {
    if (!el) return;
    setTimeout(function () {
      var t0 = null;
      function f(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / ms); p = 1 - Math.pow(1 - p, 3); var v = von + (bis - von) * p; el.textContent = fmt ? fmt(v) : Math.round(v); if (p < 1) requestAnimationFrame(f); }
      requestAnimationFrame(f);
    }, verz || 0);
  }
  function de(n, st) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: st || 0, maximumFractionDigits: st || 0 }); }
  var _qrLaden = null;
  function qrLib() {
    if (window.QRCode) return Promise.resolve();
    if (_qrLaden) return _qrLaden;
    _qrLaden = new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = QR_LIB; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
    return _qrLaden;
  }
  function qr(el, url) {
    if (!el || !url) return;
    qrLib().then(function () {
      el.innerHTML = '';
      /* korrekt: hohe Fehlerkorrektur, dunkel auf Creme, schneidet gut ab */
      new window.QRCode(el, { text: url, width: 512, height: 512, colorDark: '#050505', colorLight: '#FDFCFA', correctLevel: window.QRCode.CorrectLevel.M });
    }).catch(function () { el.textContent = url; });
  }
  function funken(ebene, n) {
    for (var k = 0; k < (n || 36); k++) {
      var f = document.createElement('i'); f.className = 'mfx-funke';
      f.style.left = (30 + Math.random() * 40) + '%'; f.style.top = (30 + Math.random() * 40) + '%';
      f.style.setProperty('--dx', (Math.random() * 30 - 15) + 'cqw'); f.style.setProperty('--dy', (Math.random() * 20 - 10) + 'cqw');
      f.style.animationDelay = (1.4 + Math.random() * 2.5) + 's'; ebene.appendChild(f);
    }
  }
  function buchstaben(text, start, schritt, goldAb) {
    return String(text).split('').map(function (c, i) {
      var g = goldAb != null && i >= goldAb;
      return '<span style="animation-delay:' + (start + i * (schritt || 0.08)) + 's' + (g ? ';color:inherit' : '') + '"' + (g ? ' class="gb"' : '') + '>' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>';
    }).join('');
  }
  function pos(t, vorgabe) {
    var p = t.pos || vorgabe || { x: 62, y: 56, w: 34 };
    return 'left:' + p.x + '%;top:' + p.y + '%;width:' + p.w + 'cqw';
  }
  function ziel(t) {
    var z = t.ziel; if (!z) return '';
    return '<div class="mfx-ziel" style="left:' + z.x + '%;top:' + z.y + '%;width:' + z.w + '%;height:' + z.h + '%"></div>';
  }

  /* ═══ 10 INTROS ═══════════════════════════════════════════════════ */
  var INTROS = {
    runway: { name: 'Runway', dauer: 6000, felder: { claim: 'Immobilien prüfen wie ein Pilot' },
      html: function (t) {
        var l = ''; for (var i = 0; i < 18; i++) { var s = i % 2 ? 1 : -1; l += '<i class="licht" style="--x0:' + (s * 2) + 'cqw;--x1:' + (s * 46) + 'cqw;animation-delay:' + (i * .12) + 's"></i>'; }
        return '<div class="mfx-voll i-runway" style="position:absolute;inset:0"><div class="bahn"></div>' + l + '<div class="fl">' + FLIEGER + '</div>' +
          '<div class="mfx-mitte"><div><div class="mfx-marke mfx-buchst">' + buchstaben('Deal', 2.0, .09) + '<b>' + buchstaben('Pilot', 2.36, .09) + '</b></div>' +
          '<div class="mfx-linie" style="animation-delay:3s"></div><div class="mfx-claim mfx-a" style="animation-delay:3.3s;margin-top:1.4cqw">' + esc(t.claim) + '</div></div></div></div>';
      } },
    cockpit: { name: 'Cockpit-Instrument', dauer: 5200, felder: { wert: 92, kick: 'Pre-Flight Check', claim: 'Pre-Flight-Check für dein Investment' },
      html: function (t) {
        var ticks = ''; for (var k = 0; k <= 20; k++) { var a = (135 + k * 13.5) * Math.PI / 180, r2 = k % 5 ? 246 : 258;
          ticks += '<line x1="' + (310 + Math.cos(a) * 232) + '" y1="' + (310 + Math.sin(a) * 232) + '" x2="' + (310 + Math.cos(a) * r2) + '" y2="' + (310 + Math.sin(a) * r2) + '" stroke="#5a4a24" stroke-width="3"/>'; }
        return '<div class="mfx-voll i-cockpit" style="position:absolute;inset:0"><svg viewBox="0 0 620 620"><defs><linearGradient id="mfxGold" x1="0" x2="1"><stop offset="0" style="stop-color:var(--wl-b8932f,#b8932f)"/><stop offset=".55" style="stop-color:var(--wl-c9a84c,#C9A84C)"/><stop offset="1" style="stop-color:var(--wl-e8cc7a,#E8CC7A)"/></linearGradient></defs>' +
          '<circle cx="310" cy="310" r="200" fill="none" stroke="#2a2418" stroke-width="16" stroke-linecap="round" stroke-dasharray="942 1257" transform="rotate(135 310 310)"/>' +
          '<circle class="fuell" cx="310" cy="310" r="200" fill="none" stroke="url(#mfxGold)" stroke-width="16" stroke-linecap="round" transform="rotate(135 310 310)"/>' + ticks +
          '<g class="zeiger"><line x1="310" y1="310" x2="310" y2="140" style="stroke:var(--wl-e8cc7a,#E8CC7A)" stroke-width="6" stroke-linecap="round"/><circle cx="310" cy="310" r="16" style="fill:var(--wl-e8cc7a,#E8CC7A)"/></g>' +
          '<text x="310" y="460" text-anchor="middle" fill="#FDFCFA" style="font:700 120px Space Grotesk" data-zaehl="' + (+t.wert || 92) + '">0</text>' +
          '<text x="310" y="500" text-anchor="middle" style="fill:var(--wl-c9a84c,#C9A84C);font:600 22px JetBrains Mono;letter-spacing:.3em">' + esc(String(t.kick).toUpperCase()) + '</text></svg>' +
          '<div class="mfx-danach" style="animation-delay:3.2s;background:transparent"><div>' + marke() + '<div class="mfx-claim" style="margin-top:1.4cqw">' + esc(t.claim) + '</div></div></div></div>';
      },
      start: function (e) { zaehle(e.querySelector('[data-zaehl]'), 0, +e.querySelector('[data-zaehl]').getAttribute('data-zaehl'), 2200, 400); } },
    boardingpass: { name: 'Boarding Pass', dauer: 5800, felder: { von: 'EXPOSÉ', vonK: 'PDF · SPRACHE · INSERAT', nach: 'URTEIL', nachK: 'SCORE · LAGE · PILOT', gate: 'Messe', zeit: '30 Sek.', sitz: 'Cockpit', stempel: 'CLEARED', claim: 'Bitte anschnallen — es geht los' },
      html: function (t) {
        return '<div class="mfx-voll i-pass" style="position:absolute;inset:0"><div class="pass"><div class="l"><div class="k">Boarding Pass · DealPilot</div>' +
          '<div class="route"><div class="ort"><b>' + esc(t.von) + '</b><i>' + esc(t.vonK) + '</i></div><div class="flug"></div><div class="ort" style="text-align:right"><b>' + esc(t.nach) + '</b><i>' + esc(t.nachK) + '</i></div></div>' +
          '<div class="felder"><div style="animation-delay:1.6s"><i>GATE</i><b>' + esc(t.gate) + '</b></div><div style="animation-delay:1.85s"><i>FLUGZEIT</i><b>' + esc(t.zeit) + '</b></div><div style="animation-delay:2.1s"><i>SITZ</i><b>' + esc(t.sitz) + '</b></div></div>' +
          '<div class="stempel">' + esc(t.stempel) + '</div></div><div class="r">' + marke('xs') + '<div class="strich"></div><div class="mfx-kick" style="color:#8c8578">Quick Boarding</div></div></div>' +
          '<div class="mfx-danach" style="animation-delay:4s"><div>' + marke() + '<div class="mfx-claim" style="margin-top:1.4cqw">' + esc(t.claim) + '</div></div></div></div>';
      } },
    radar: { name: 'Radar', dauer: 5600, felder: { ziel: 'Ziel erfasst · 1 von 1.527', claim: 'Das eine Objekt, das sich rechnet' },
      html: function (t) {
        var b = [[38, 30, .2], [62, 40, .6], [45, 62, 1], [70, 64, 1.3], [30, 50, 1.6], [56, 28, 1.9]].map(function (p) { return '<i class="blip" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-delay:' + p[2] + 's"></i>'; }).join('');
        return '<div class="mfx-voll i-radar" style="position:absolute;inset:0"><div class="schirm"><div class="strahl"></div>' + b +
          '<div class="lock" style="left:62%;top:40%"></div><div class="lockt" style="left:66%;top:34%">' + esc(t.ziel) + '</div></div>' +
          '<div class="mfx-danach" style="animation-delay:4.3s"><div>' + marke() + '<div class="mfx-claim" style="margin-top:1.4cqw">' + esc(t.claim) + '</div></div></div></div>';
      } },
    abflugtafel: { name: 'Abflugtafel', dauer: 5800, felder: { zeilen: ['EXPOSE   URTEIL', 'INSERAT  SCORE', 'SPRACHE  BEWERTUNG'], ende: 'DEALPILOT', kopf: 'Abflug · Departures' },
      html: function (t) {
        function zeile(txt, gold) { return '<div class="zeile">' + String(txt).toUpperCase().split('').map(function (c) { return '<span class="z f' + (gold ? ' g' : '') + '" data-ziel="' + esc(c) + '"> </span>'; }).join('') + '</div>'; }
        var zs = (t.zeilen || []).slice(0, 3), n = Math.max(16, String(t.ende).length + 2), pad = new Array(40).join(' ');
        zs.forEach(function (z) { n = Math.max(n, String(z).length); }); n = Math.min(n, 22);
        var zl = zs.map(function (z) { return zeile((z + pad).slice(0, n)); }).join('');
        return '<div class="mfx-voll i-tafel" style="position:absolute;inset:0"><div class="tafel"><div class="kopfz"><span>' + esc(t.kopf) + '</span><span>ON TIME</span></div>' + zl +
          '<div style="height:1.2cqw"></div>' + zeile(('  ' + t.ende + pad).slice(0, n), true) + '</div></div>';
      },
      start: function (e) {
        var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        [].forEach.call(e.querySelectorAll('.z'), function (z, i) {
          var ende = 700 + i * 55 + Math.random() * 400, t0 = Date.now(), soll = z.getAttribute('data-ziel');
          var iv = setInterval(function () {
            if (Date.now() - t0 > ende) { clearInterval(iv); z.textContent = soll; z.classList.remove('f'); return; }
            z.textContent = ABC.charAt(Math.floor(Math.random() * ABC.length));
          }, 60);
        });
      } },
    checkliste: { name: 'Pre-Flight-Checkliste', dauer: 5400, felder: { punkte: ['Exposé gelesen', 'Marktwert geschätzt', 'Lage geprüft', 'Urteil gefällt'], claim: 'Pre-Flight Check' },
      html: function (t) {
        var p = (t.punkte || []).map(function (x, i) { var d = .5 + i * .6; return '<div class="pz" style="animation-delay:' + d + 's"><span class="hk" style="animation-delay:' + (d + .3) + 's"></span>' + esc(x) + '</div>'; }).join('');
        return '<div class="mfx-voll i-check" style="position:absolute;inset:0"><div class="liste">' + p + '</div><div class="rechts">' + marke('m') + '<div class="mfx-claim" style="margin-top:1cqw">' + esc(t.claim) + '</div></div></div>';
      } },
    wolken: { name: 'Wolkendurchbruch', dauer: 5200, felder: { claim: 'Über den Wolken: klare Sicht auf deinen Deal' },
      html: function (t) {
        return '<div class="mfx-voll i-wolken" style="position:absolute;inset:0"><div class="sonne"></div><div class="w l"></div><div class="w r"></div><div class="w u"></div>' +
          '<div class="mfx-mitte"><div style="opacity:0;animation:mfxZoom 1.2s 2s forwards">' + marke('mfx-glanz') + '<div class="mfx-claim" style="margin-top:1.4cqw">' + esc(t.claim) + '</div></div></div></div>';
      } },
    blaupause: { name: 'Blaupause', dauer: 5200, felder: { mass1: '72 m²', mass2: 'Bj 1994', claim: 'Vom Grundriss zum Urteil' },
      html: function (t) {
        return '<div class="mfx-voll i-plan" style="position:absolute;inset:0"><svg viewBox="0 0 300 220"><path d="M20 200 H280 M40 200 V90 L150 20 L260 90 V200 M90 200 V140 H130 V200 M170 120 H220 V160 H170 Z M40 90 H260"/></svg>' +
          '<div class="mass" style="left:38%;top:47%;animation-delay:2.1s">' + esc(t.mass1) + '</div><div class="mass" style="left:63%;top:22%;animation-delay:2.3s">' + esc(t.mass2) + '</div>' +
          '<div class="unten">' + marke('m') + '<div class="mfx-claim" style="margin-top:1cqw">' + esc(t.claim) + '</div></div></div>';
      } },
    flugroute: { name: 'Flugroute', dauer: 5400, felder: { orte: ['Bielefeld', 'Herford', 'Bad Oeynhausen'], claim: 'Jeder Standort, ein Urteil' },
      html: function (t) {
        var o = t.orte || [], P = [[18, 70], [48, 34], [80, 58]];
        var pins = P.map(function (p, i) { return '<i class="pin" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-delay:' + (.5 + i * .9) + 's"></i><span class="pint" style="left:' + (p[0] + 1.5) + '%;top:' + (p[1] - 5) + '%;animation-delay:' + (.7 + i * .9) + 's">' + esc(o[i] || '') + '</span>'; }).join('');
        return '<div class="mfx-voll i-route" style="position:absolute;inset:0"><svg viewBox="0 0 100 53.2" preserveAspectRatio="none"><path class="zug" d="M18 37.2 Q30 10 48 18 T80 30.9"/></svg>' + pins +
          '<div class="mfx-mitte" style="align-items:end;padding-bottom:6cqw"><div class="mfx-a" style="animation-delay:3.4s">' + marke('m') + '<div class="mfx-claim" style="margin-top:1cqw">' + esc(t.claim) + '</div></div></div></div>';
      } },
    kinetik: { name: 'Typo-Kinetik', dauer: 5400, felder: { worte: ['PRÜFEN.', 'RECHNEN.', 'ENTSCHEIDEN.'] },
      html: function (t) {
        var w = (t.worte || []).map(function (x, i) { return '<div class="wort' + (i === (t.worte.length - 1) ? ' g' : '') + '" style="opacity:1"><span style="opacity:0;animation-delay:' + (i * 1.05) + 's">' + esc(x) + '</span></div>'; }).join('');
        return '<div class="mfx-voll i-typo" style="position:absolute;inset:0">' + w + '<div class="mfx-mitte"><div style="opacity:0;animation:mfxZoom .9s ' + ((t.worte || []).length * 1.05) + 's forwards">' + marke('mfx-glanz') + '</div></div></div>';
      } },
    /* v2253 · Reihen-Intro „So funktioniert DealPilot": Marke, Modulnummer,
       Titel, eine Zeile worum es geht. Gleich für jedes Modul. */
    reihe: { name: 'Reihe · Modul', dauer: 7000, felder: { reihe: 'So funktioniert DealPilot', modul: '02', titel: 'Vom Quick Boarding zum Objekt', unter: 'Zwei Wege ins Portfolio — und was dabei mitwandert.' },
      html: function (t) {
        return '<div class="mfx-voll r-grund" style="position:absolute;inset:0"><div class="r-kopf"><div class="mfx-claim mfx-a" style="animation-delay:.4s">' + esc(t.reihe) + '</div></div>' +
          '<div class="r-spur"></div><div class="r-fl">' + FLIEGER + '</div>' +
          '<div class="r-mitte"><div class="mfx-marke m mfx-buchst">' + buchstaben('Deal', .7, .07) + '<b>' + buchstaben('Pilot', .98, .07) + '</b></div>' +
          '<div class="r-nr"><i>' + esc(t.art || 'Modul') + '</i><b>' + esc(t.modul) + '</b></div>' +
          '<div class="r-titel">' + esc(t.titel) + '</div>' +
          (t.unter ? '<div class="r-unter">' + esc(t.unter) + '</div>' : '') + '</div></div>';
      } }
  };

  /* ═══ 10 INFO-KARTEN (über App oder Video) ════════════════════════ */
  var KARTEN = {
    scorering: { name: 'Score-Ring', dauer: 6500, felder: { kick: 'Mehr Eigenkapital · 20 %', titel: 'Aus Solide wird Gut', von: 54, bis: 71, stufe: 'GUT', kacheln: [['Cashflow / Monat', '+111 €', 'gr'], ['DSCR', '1,45', ''], ['Beleihung', '80 %', '']] },
      html: function (t) {
        var k = (t.kacheln || []).map(function (x, i) { return '<div class="mfx-kachel" style="animation-delay:' + (1.4 + i * .2) + 's"><i>' + esc(x[0]) + '</i><b class="' + (x[2] || '') + '">' + esc(x[1]) + '</b></div>'; }).join('');
        return ziel(t) + '<div class="mfx-karte k-ring" style="' + pos(t) + '"><div class="mfx-kick">' + esc(t.kick) + '</div>' +
          '<div style="display:flex;align-items:center;gap:1.4cqw;margin:1cqw 0"><div class="ring"><svg viewBox="0 0 100 100"><circle class="hg" cx="50" cy="50" r="45"/><circle class="vg" cx="50" cy="50" r="45" style="stroke:var(--wl-c9a84c,#C9A84C)" stroke-dashoffset="' + (283 * (1 - (+t.von || 0) / 100)) + '"/></svg><div class="wert">' + esc(t.von) + '</div></div>' +
          '<div><h2 style="margin:0 0 .6cqw">' + esc(t.titel) + '</h2><span class="mfx-pille gr">' + esc(t.stufe) + '</span></div></div>' +
          '<div style="display:grid;grid-template-columns:repeat(' + Math.max(1, (t.kacheln || []).length) + ',1fr);gap:.7cqw">' + k + '</div></div>';
      },
      start: function (e, t) {
        var vg = e.querySelector('.vg'), w = e.querySelector('.wert');
        setTimeout(function () { vg.style.strokeDashoffset = 283 * (1 - (+t.bis || 0) / 100); vg.style.stroke = (+t.bis >= 70 ? '#3FA56C' : 'var(--wl-c9a84c,#C9A84C)'); zaehle(w, +t.von, +t.bis, 1600); }, 1300);
      } },
    urteil: { name: 'Urteil zweispaltig', dauer: 7000, felder: { kick: 'Gegen deine Lage · C-Lage', titel: 'Nicht kaufen — 6,6 % statt deiner 7,0 %', nein: ['Zielrendite der C-Lage verfehlt', 'Ziel erst bei 131.314 €'], ja: ['Score 71 · Gut', 'Cashflow +111 € · DSCR 1,45'], ton: 'rot' },
      html: function (t) {
        var farbe = t.ton === 'gruen' ? '#3FA56C' : '#D8564C';
        function sp(titel, liste, cls, d) { return '<div class="mfx-kachel" style="animation-delay:' + d + 's;padding:1cqw 1.2cqw"><i class="' + cls + '">' + esc(titel) + '</i>' + (liste || []).map(function (x) { return '<p style="font-size:1.2cqw;color:#FDFCFA;margin:.4cqw 0">' + esc(x) + '</p>'; }).join('') + '</div>'; }
        return ziel(t) + '<div class="mfx-karte" style="' + pos(t, { x: 30, y: 24, w: 42 }) + ';border-color:' + farbe + '"><div class="mfx-kick" style="color:' + farbe + '">' + esc(t.kick) + '</div><h2>' + esc(t.titel) + '</h2>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.9cqw">' + sp('Warum nicht', t.nein, 'ro', 1.4) + sp('Warum trotzdem gut', t.ja, 'gr', 2.2) + '</div></div>';
      } },
    zahl: { name: 'Große Zahl', dauer: 5500, felder: { kick: 'Marktwert', bis: 251000, einheit: '€', unter: 'Spanne 199.000 € – 351.000 €', delta: '+44 % zum Kaufpreis' },
      html: function (t) {
        return ziel(t) + '<div class="mfx-karte" style="' + pos(t, { x: 60, y: 30, w: 32 }) + '"><div class="mfx-kick">' + esc(t.kick) + '</div>' +
          '<div style="font:700 5.4cqw/1.1 Space Grotesk;margin:.8cqw 0"><span data-zahl>0</span> <span style="font-size:3cqw;color:var(--wl-e8cc7a,#E8CC7A)">' + esc(t.einheit) + '</span></div>' +
          '<p>' + esc(t.unter) + '</p><div class="mfx-pille gr mfx-a" style="animation-delay:2s;margin-top:1cqw">▲ ' + esc(t.delta) + '</div></div>';
      },
      start: function (e, t) { zaehle(e.querySelector('[data-zahl]'), 0, +t.bis, 1800, 700, function (v) { return de(Math.round(v)); }); } },
    spanne: { name: 'Spannen-Balken', dauer: 6000, felder: { kick: 'Marktmiete', titel: 'Die Spanne entscheidet', stufen: [['Unten', '766 €'], ['Ø', '881 €'], ['Oben', '1.012 €']], marker: 85 },
      html: function (t) {
        var s = (t.stufen || []).map(function (x) { return '<span>' + esc(x[0]) + '<b>' + esc(x[1]) + '</b></span>'; }).join('');
        return ziel(t) + '<div class="mfx-karte k-spanne" style="' + pos(t, { x: 58, y: 30, w: 36 }) + '"><div class="mfx-kick">' + esc(t.kick) + '</div><h2>' + esc(t.titel) + '</h2><div class="bar"><i class="mk"></i></div><div class="stufen">' + s + '</div></div>';
      },
      start: function (e, t) { var m = e.querySelector('.mk'); setTimeout(function () { m.style.left = (+t.marker || 50) + '%'; }, 1200); } },
    checkliste: { name: 'Checkliste', dauer: 6500, felder: { kick: 'Aus dem Exposé gelesen', titel: '16 Werte erkannt', punkte: [['Adresse', 'Bielefeld'], ['Wohnfläche', '72 m²'], ['Kaltmiete', '680 €'], ['Kaufpreis', '159.000 €']] },
      html: function (t) {
        var p = (t.punkte || []).map(function (x, i) { return '<div class="pz" style="animation-delay:' + (1.1 + i * .45) + 's"><i>✓</i>' + esc(x[0]) + '<b>' + esc(x[1]) + '</b></div>'; }).join('');
        return ziel(t) + '<div class="mfx-karte k-check" style="' + pos(t, { x: 62, y: 22, w: 30 }) + '"><div class="mfx-kick">' + esc(t.kick) + '</div><h2>' + esc(t.titel) + '</h2>' + p + '</div>';
      } },
    vergleich: { name: 'Vorher / Nachher', dauer: 6000, felder: { kick: 'Soll gegen Ist', titel: 'DSCR', vorher: '0,90', nachher: '1,23', unter: 'Cashflow −6.193 € → +775 €' },
      html: function (t) {
        return ziel(t) + '<div class="mfx-karte k-vgl" style="' + pos(t, { x: 58, y: 28, w: 32 }) + '"><div class="mfx-kick">' + esc(t.kick) + '</div><h2>' + esc(t.titel) + '</h2>' +
          '<div class="zwei"><span class="wert" style="color:#8c8578">' + esc(t.vorher) + '</span><span class="pfeil">→</span><span class="wert nach gr">' + esc(t.nachher) + '</span></div><p class="mfx-a" style="animation-delay:2.2s;margin-top:1cqw">' + esc(t.unter) + '</p></div>';
      } },
    callout: { name: 'Callout-Pille', dauer: 4500, felder: { text: 'Hier liest DealPilot die Adresse', linie: 8 },
      html: function (t) {
        return ziel(t) + '<div class="mfx-karte k-callout" style="' + pos(t, { x: 55, y: 18, w: 24 }) + '">' + esc(t.text) + '<span class="linie" style="left:-' + (+t.linie || 8) + 'cqw;top:50%;width:' + (+t.linie || 8) + 'cqw;transform-origin:100% 50%"></span></div>';
      } },
    pilot: { name: 'Pilot sagt', dauer: 7500, felder: { kick: 'Die Pilot-Analyse', text: 'Ein guter Deal: Bruttomietrendite 8,7 % über deinem Ziel. Verhandeln lohnt trotzdem — der Zins liegt über dem Marktzins.' },
      html: function (t) {
        return ziel(t) + '<div class="mfx-karte" style="' + pos(t, { x: 52, y: 58, w: 42 }) + '"><div class="mfx-kick">' + esc(t.kick) + '</div><div class="k-pilot" style="margin-top:1cqw"><div class="kopf">✈</div><div class="tipp" data-text="' + esc(t.text) + '"></div></div></div>';
      },
      start: function (e) {
        var el = e.querySelector('.tipp'), txt = el.getAttribute('data-text'), i = 0;
        setTimeout(function () { var iv = setInterval(function () { el.textContent = txt.slice(0, ++i); if (i >= txt.length) clearInterval(iv); }, 32); }, 900);
      } },
    band: { name: 'Schritt-Band', dauer: 5000, felder: { nr: '03', kick: 'Schritt 3 von 6', titel: 'Marktbewertung — der Markt schätzt mit', schritte: 6, aktiv: 3 },
      html: function (t) {
        var s = ''; for (var i = 1; i <= (+t.schritte || 6); i++) s += '<i class="' + (i <= (+t.aktiv || 1) ? 'an' : '') + '"></i>';
        return ziel(t) + '<div class="mfx-karte k-band" style="top:' + ((t.pos && t.pos.y) != null ? t.pos.y : 82) + '%"><span class="nr">' + esc(t.nr) + '</span><div><div class="mfx-kick">' + esc(t.kick) + '</div><div style="font:700 2cqw Space Grotesk;margin-top:.3cqw">' + esc(t.titel) + '</div></div><div class="schritte">' + s + '</div></div>';
      } },
    raster: { name: 'Kennzahlen-Raster', dauer: 6000, felder: { kick: 'Auf einen Blick', titel: 'Score 76 · Gut', kacheln: [['Bruttorendite', '8,7 %', 'gr'], ['Cashflow', '+357 €', 'gr'], ['DSCR', '1,73', ''], ['Hausgeld', '415 €', 'ro']] },
      html: function (t) {
        var k = (t.kacheln || []).map(function (x, i) { return '<div class="mfx-kachel" style="animation-delay:' + (1 + i * .25) + 's"><i>' + esc(x[0]) + '</i><b class="' + (x[2] || '') + '">' + esc(x[1]) + '</b></div>'; }).join('');
        return ziel(t) + '<div class="mfx-karte k-raster" style="' + pos(t, { x: 62, y: 26, w: 30 }) + '"><div class="mfx-kick">' + esc(t.kick) + '</div><h2>' + esc(t.titel) + '</h2><div class="raster">' + k + '</div></div>';
      } }
  };

  /* ═══ 10 OUTROS ════════════════════════════════════════════════════ */
  var OUTROS = {
    startbahn: { name: 'Startbahn', dauer: 5500, felder: { claim: 'Erst rechnen.', claim2: 'Dann kaufen.', url: 'dealpilot.immo' },
      html: function (t) {
        return '<div class="mfx-voll o-start" style="position:absolute;inset:0"><div class="spur"></div><div class="fl">' + FLIEGER + '</div><div class="fx"></div>' +
          '<div class="mfx-mitte"><div style="opacity:0;animation:mfxZoom 1.1s 1.5s forwards">' + marke() + '<div class="mfx-gross" style="margin-top:1.4cqw">' + esc(t.claim) + '<br><em>' + esc(t.claim2) + '</em></div><div class="mfx-url mfx-a" style="animation-delay:1.2s;margin-top:1.4cqw">' + esc(t.url) + '</div></div></div></div>';
      }, start: function (e) { funken(e.querySelector('.fx').parentNode); } },
    amstand: { name: 'Am Stand (QR)', dauer: 6000, felder: { titel: 'Dein nächstes Objekt —', titel2: 'in 30 Sekunden geprüft.', unter: 'Jetzt am Stand ausprobieren', url: 'https://dealpilot.immo', qrtext: 'Scannen & testen' },
      html: function (t) {
        return '<div class="mfx-voll o-gold" style="position:absolute;inset:0;display:grid;grid-template-columns:1.2fr .8fr;align-items:center;padding:0 8cqw">' +
          '<div class="mfx-a">' + marke() + '<div class="mfx-gross" style="margin:2cqw 0 .8cqw">' + esc(t.titel) + '<br>' + esc(t.titel2) + '</div><div style="font-size:1.4cqw">' + esc(t.unter) + ' · ' + esc(String(t.url).replace(/^https?:\/\//, '')) + '</div></div>' +
          '<div style="justify-self:center;text-align:center;opacity:0;animation:mfxZoom .8s .8s forwards"><div class="mfx-qr" data-qr="' + esc(t.url) + '" style="width:18cqw;background:#FDFCFA"></div><div class="mfx-kick" style="color:#1a1407;margin-top:1cqw">' + esc(t.qrtext) + '</div></div></div>';
      } },
    landung: { name: 'Landeanflug', dauer: 5500, felder: { titel: 'Gelandet.', titel2: 'Dein Urteil steht.', url: 'dealpilot.immo' },
      html: function (t) {
        var l = ''; for (var i = 0; i < 12; i++) l += '<i style="animation-delay:' + (i * .08) + 's"></i>';
        return '<div class="mfx-voll o-landung" style="position:absolute;inset:0"><div class="lichter">' + l + '</div><div class="fl">' + FLIEGER + '</div>' +
          '<div class="mfx-mitte" style="align-items:start;padding-top:9cqw"><div style="opacity:0;animation:mfxZoom 1s 2.2s forwards"><div class="mfx-gross">' + esc(t.titel) + ' <em>' + esc(t.titel2) + '</em></div><div style="margin-top:1.6cqw">' + marke('m') + '</div><div class="mfx-url" style="margin-top:1cqw">' + esc(t.url) + '</div></div></div></div>';
      } },
    gate: { name: 'Gate-Schild (QR)', dauer: 6000, felder: { gate: 'D1', titel: 'Boarding jetzt', unter: 'DealPilot · Halle und Stand', url: 'https://dealpilot.immo' },
      html: function (t) {
        return '<div class="mfx-voll o-gate" style="position:absolute;inset:0"><div class="schild"><div><div class="mfx-kick">Gate</div><div class="gatenr">' + esc(t.gate) + '</div></div>' +
          '<div><div style="font:700 4cqw Space Grotesk">' + esc(t.titel) + ' <span class="blink">●</span></div><div style="font-size:1.4cqw;color:#d9cfb8;margin:.6cqw 0 1.4cqw">' + esc(t.unter) + '</div>' + marke('s') + '</div>' +
          '<div class="mfx-qr" data-qr="' + esc(t.url) + '" style="width:14cqw"></div></div></div>';
      } },
    stempel: { name: 'Freigabe-Stempel (QR)', dauer: 5500, felder: { stempel: 'CLEARED FOR TAKE-OFF', titel: 'Dein Deal ist geprüft.', url: 'https://dealpilot.immo' },
      html: function (t) {
        return '<div class="mfx-voll i-pass" style="position:absolute;inset:0"><div class="pass" style="animation-duration:.9s"><div class="l"><div class="k">Boarding Pass · DealPilot</div><div class="mfx-gross" style="margin-top:2.4cqw;color:#1a1407">' + esc(t.titel) + '</div>' +
          '<div class="stempel" style="top:auto;bottom:2.4cqw;right:2cqw;animation-delay:1.4s">' + esc(t.stempel) + '</div></div><div class="r" style="align-items:center;justify-content:center"><div class="mfx-qr" data-qr="' + esc(t.url) + '" style="width:12cqw"></div></div></div></div>';
      } },
    kennzahlen: { name: 'Kennzahlen-Wirbel', dauer: 5500, felder: { werte: ['Score 76', 'DSCR 1,73', '+357 €', '8,7 %', 'Gut', 'B-Lage'], claim: 'Alles, was zählt — in einem Urteil.', url: 'dealpilot.immo' },
      html: function (t) {
        var w = (t.werte || []).map(function (x, i) { var a = i / (t.werte.length) * Math.PI * 2; return '<span class="mfx-pille" style="position:absolute;left:50%;top:50%;white-space:nowrap;color:var(--wl-e8cc7a,#E8CC7A);font-size:2cqw;padding:.6cqw 1.3cqw;transform:translate(-50%,-50%);animation:oWirbel 2s ' + (i * .12) + 's cubic-bezier(.6,0,.3,1) forwards;--x:' + (Math.cos(a) * 34) + 'cqw;--y:' + (Math.sin(a) * 16) + 'cqw">' + esc(x) + '</span>'; }).join('');
        return '<style>@keyframes oWirbel{0%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y)));opacity:1}80%{opacity:1}100%{transform:translate(-50%,-50%) scale(.2);opacity:0}}</style>' +
          '<div class="mfx-voll" style="position:absolute;inset:0;background:radial-gradient(circle,#17120a,#050505 70%)">' + w +
          '<div class="mfx-mitte"><div style="opacity:0;animation:mfxZoom 1s 2s forwards">' + marke('mfx-glanz') + '<div class="mfx-claim" style="margin-top:1.4cqw">' + esc(t.claim) + '</div><div class="mfx-url" style="margin-top:1cqw">' + esc(t.url) + '</div></div></div></div>';
      } },
    splitflap: { name: 'Abflugtafel-Ende (QR)', dauer: 6000, felder: { text: 'DEALPILOT.IMMO', unter: 'Jetzt testen', url: 'https://dealpilot.immo' },
      html: function (t) {
        var z = String(t.text).toUpperCase().split('').map(function (c) { return '<span class="z f g" data-ziel="' + esc(c) + '"> </span>'; }).join('');
        return '<div class="mfx-voll i-tafel" style="position:absolute;inset:0;grid-template-columns:auto auto;gap:4cqw"><div class="tafel"><div class="kopfz"><span>' + esc(t.unter) + '</span><span>NOW BOARDING</span></div><div class="zeile">' + z + '</div></div>' +
          '<div class="mfx-qr" data-qr="' + esc(t.url) + '" style="width:16cqw;opacity:0;animation:mfxZoom .8s 2.4s forwards"></div></div>';
      },
      start: function (e) { INTROS.abflugtafel.start(e); } },
    visitenkarte: { name: 'Visitenkarte (QR)', dauer: 6500, felder: { name: 'Marcel Junker', rolle: 'DESAG-geprüfter Sachverständiger', kontakt: 'dealpilot.immo', url: 'https://dealpilot.immo' },
      html: function (t) {
        return '<div class="mfx-voll o-karte" style="position:absolute;inset:0"><div class="vk"><div class="seite vorne">' + marke('m') + '</div>' +
          '<div class="seite hinten"><div><div style="font:700 2.8cqw Space Grotesk">' + esc(t.name) + '</div><div style="font-size:1.3cqw;margin:.4cqw 0 1.6cqw;opacity:.85">' + esc(t.rolle) + '</div><div class="mfx-url" style="color:#1a1407">' + esc(t.kontakt) + '</div></div><div class="mfx-qr" data-qr="' + esc(t.url) + '" style="width:12cqw"></div></div></div></div>';
      } },
    horizont: { name: 'Horizont', dauer: 5000, felder: { claim: 'Klare Sicht für jede Investition.', url: 'dealpilot.immo' },
      html: function (t) {
        return '<div class="mfx-voll o-horizont" style="position:absolute;inset:0"><div class="glow"></div><div class="h"></div>' +
          '<div class="mfx-mitte" style="align-items:start;padding-top:12cqw"><div style="opacity:0;animation:mfxZoom 1.1s 1.2s forwards">' + marke('mfx-glanz') + '<div class="mfx-claim" style="margin-top:1.6cqw">' + esc(t.claim) + '</div></div></div>' +
          '<div class="mfx-url mfx-a" style="position:absolute;left:0;right:0;bottom:6cqw;text-align:center;animation-delay:2.2s">' + esc(t.url) + '</div></div>';
      } },
    countdown: { name: 'Countdown (QR)', dauer: 6500, felder: { titel: 'Probier es selbst —', titel2: 'in 30 Sekunden.', url: 'https://dealpilot.immo', von: 30 },
      html: function (t) {
        return '<div class="mfx-voll o-countdown" style="position:absolute;inset:0;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:4cqw;padding:0 8cqw;background:radial-gradient(circle at 30% 50%,#17120a,#050505 70%)">' +
          '<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#2a2418" stroke-width="6"/><circle class="vg" cx="50" cy="50" r="45"/></svg><div class="zahl" data-zahl>' + esc(t.von) + '</div></div>' +
          '<div class="mfx-a">' + marke('s') + '<div class="mfx-gross" style="margin-top:1cqw">' + esc(t.titel) + '<br><em>' + esc(t.titel2) + '</em></div></div>' +
          '<div class="mfx-qr" data-qr="' + esc(t.url) + '" style="width:15cqw;opacity:0;animation:mfxZoom .8s .8s forwards"></div></div>';
      },
      start: function (e, t) {
        /* Sekundentakt, gleichmaessig wie der Ring (linear ueber 5 s) */
        var el = e.querySelector('[data-zahl]'), von = +t.von || 30, t0 = Date.now();
        var iv = setInterval(function () { var p = Math.min(1, (Date.now() - t0) / 5000); el.textContent = Math.ceil(von * (1 - p)); if (p >= 1 || !el.isConnected) clearInterval(iv); }, 100);
      } },
    /* v2253 · Reihen-Outro: der Logo-Rahmen zieht sich hinter dem Flieger
       zu, die Wortmarke glänzt, darunter der Spruch des Moduls */
    reihe: { name: 'Reihe · Logo und Spruch', dauer: 7500, felder: { spruch: 'Vom ersten Blick', spruch2: 'zum eigenen Objekt.', reihe: 'So funktioniert DealPilot', modul: '02', weiter: '', url: 'dealpilot.immo' },
      html: function (t) {
        return '<div class="mfx-voll r-grund" style="position:absolute;inset:0"><div class="mfx-mitte" style="align-items:start;padding-top:9cqw"><div>' +
          '<div class="r-logo"><svg viewBox="0 0 1000 300"><defs><linearGradient id="rGold" x1="0" x2="1"><stop offset="0" style="stop-color:var(--wl-e8cc7a,#E8CC7A)"/><stop offset=".55" style="stop-color:var(--wl-c9a84c,#C9A84C)"/><stop offset="1" style="stop-color:var(--wl-b8932f,#b8932f)"/></linearGradient></defs>' +
          '<rect x="4" y="4" width="992" height="292" rx="62" pathLength="1" stroke="url(#rGold)"/></svg>' +
          '<div class="w"><span>Deal<b>Pilot</b></span></div><div class="fl">' + FLIEGER + '</div></div>' +
          '<div class="r-spruch">' + esc(t.spruch) + (t.spruch2 ? '<br><em>' + esc(t.spruch2) + '</em>' : '') + '</div></div></div>' +
          '<div class="r-fuss"><span class="mfx-kick">' + esc(t.reihe) + (t.modul ? ' · ' + esc(t.art || 'Modul') + ' ' + esc(t.modul) : '') + '</span>' +
          (t.weiter ? '<span class="r-weiter">Weiter: <b>' + esc(t.weiter) + '</b></span>' : '') +
          '<span class="mfx-url" style="font-size:1.25cqw">' + esc(t.url) + '</span></div></div>';
      } }
  };

  /* ── Abspielen ────────────────────────────────────────────────────── */
  var ARTEN = { intro: INTROS, karte: KARTEN, outro: OUTROS };
  function spiele(buehne, art, id, texte) {
    stil();
    var stueck = (ARTEN[art] || {})[id]; if (!stueck || !buehne) return null;
    var t = {}; Object.keys(stueck.felder || {}).forEach(function (k) { t[k] = stueck.felder[k]; });
    Object.keys(texte || {}).forEach(function (k) { t[k] = texte[k]; });
    var alt = buehne.querySelector(':scope > .mfx-ebene[data-art="' + art + '"]'); if (alt) alt.remove();
    var e = document.createElement('div'); e.className = 'mfx-ebene'; e.setAttribute('data-art', art);
    if (art === 'karte') e.style.pointerEvents = 'none';
    e.innerHTML = stueck.html(t);
    buehne.appendChild(e);
    if (stueck.start) { try { stueck.start(e, t); } catch (x) {} }
    [].forEach.call(e.querySelectorAll('[data-qr]'), function (q) { qr(q, q.getAttribute('data-qr')); });
    return { ebene: e, dauer: stueck.dauer, weg: function () { if (e.parentNode) e.parentNode.removeChild(e); } };
  }
  function liste() {
    function l(o) { return Object.keys(o).map(function (k) { return { id: k, name: o[k].name, dauer: o[k].dauer, felder: o[k].felder }; }); }
    return { intros: l(INTROS), karten: l(KARTEN), outros: l(OUTROS) };
  }
  window.DealPilotMesseFX = { spiele: spiele, liste: liste, qr: qr, version: 'v2253a' };
})();
