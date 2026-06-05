/* ════════════════════════════════════════════════════════════════════
   DealPilot score-fx.js  (v459)
   Bewegte Hintergrund-Partikel + Glow-Orbs fuer die Score-Karten im
   Bewertungs-Tab (.ds-mockup = DealPilot Score, .ds2-mockup = Investor
   Deal Score) — gleiche Mechanik wie das Portfolio-Cockpit.
   Additiv, kein Eingriff in die Render-Logik. Findet die Karten per
   Watcher (re-attach nach Re-Render), animiert nur wenn sichtbar.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if (window._dsFxInstalled) return;
  window._dsFxInstalled = true;

  var SEL = '.ds-mockup, .ds2-mockup, #dashboard-main .pscore-hero';
  var reg = [];   // {card, layer, canvas, ctx, w, h, parts, raf, running}

  function isVisible(el){
    return !!(el && el.offsetParent !== null && el.clientWidth > 0 && el.clientHeight > 0);
  }
  function hasFx(card){
    var ch = card.children;
    for (var i=0;i<ch.length;i++){
      var cl = ch[i].className;
      if (cl && (''+cl).indexOf('ds-fx') >= 0) return true;
    }
    return false;
  }

  function build(card){
    var layer = document.createElement('div');
    layer.className = 'ds-fx';
    layer.innerHTML = '<span class="ds-fx-orb a"></span><span class="ds-fx-orb b"></span><canvas></canvas>';
    card.insertBefore(layer, card.firstChild);
    var canvas = layer.querySelector('canvas');
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch(e){}
    var fx = { card:card, layer:layer, canvas:canvas, ctx:ctx, parts:[], raf:0, running:false, w:0, h:0 };
    reg.push(fx);
    return fx;
  }

  function size(fx){
    var w = Math.max(fx.card.clientWidth  || 0, 320);
    var h = Math.max(fx.card.clientHeight || 0, 200);
    fx.w = fx.canvas.width  = w;
    fx.h = fx.canvas.height = h;
    var N = Math.min(60, Math.max(22, Math.round(w * h / 12000)));
    fx.parts = [];
    for (var i=0;i<N;i++){
      fx.parts.push({
        x: Math.random()*w, y: Math.random()*h,
        r: Math.random()*1.5 + 0.4,
        vx: (Math.random()-0.5)*0.16, vy: (Math.random()-0.5)*0.16,
        tw: Math.random()*Math.PI*2
      });
    }
  }

  function start(fx){
    if (fx.running || !fx.ctx) return;
    size(fx);
    fx.running = true;
    function draw(){
      if (!fx.running || !fx.ctx) return;
      var ctx = fx.ctx, w = fx.w, h = fx.h;
      ctx.clearRect(0,0,w,h);
      var col = '201,168,76';
      for (var i=0;i<fx.parts.length;i++){
        var p = fx.parts[i];
        p.x += p.vx; p.y += p.vy; p.tw += 0.03;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        var a = 0.28 + Math.sin(p.tw)*0.28; if (a < 0) a = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(2) + ')';
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(' + col + ',0.5)';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      fx.raf = requestAnimationFrame(draw);
    }
    draw();
  }

  function stop(fx){
    fx.running = false;
    if (fx.raf) cancelAnimationFrame(fx.raf);
    fx.raf = 0;
  }

  function tick(){
    // 1) neue Karten finden + Layer einsetzen
    var cards = document.querySelectorAll(SEL);
    for (var i=0;i<cards.length;i++){
      if (!hasFx(cards[i])) build(cards[i]);
    }
    // 2) Lauf-Status verwalten (sichtbar = an, weg/versteckt = aus)
    for (var j=reg.length-1;j>=0;j--){
      var fx = reg[j];
      if (!document.body.contains(fx.card) || !document.body.contains(fx.layer)){
        stop(fx); reg.splice(j,1); continue;
      }
      if (isVisible(fx.card)){ if (!fx.running) start(fx); }
      else { if (fx.running) stop(fx); }
    }
  }

  function boot(){
    tick();
    if (window._dsFxTimer) clearInterval(window._dsFxTimer);
    window._dsFxTimer = setInterval(tick, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
