/* ═══════════════════════════════════════════════════════════
   V219 — auth-constellation.js
   Sternbild-Effekt (Konstellation) im Hintergrund jeder .auth-card-v39
   Vanilla JS, Canvas, kein Framework
   30 goldene Punkte driften, Linien werden bei Nähe < 100px gezeichnet
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Konfiguration
  var CFG = {
    pointCount: 30,
    color: 'rgba(232, 200, 120, ',      // mit Komma-Lücke für Alpha-Ergänzung
    lineColor: 'rgba(201, 168, 76, ',
    pointSize: 1.6,
    pointSizeRange: 1.4,                 // tatsächliche Größe = pointSize + random * Range
    maxSpeed: 0.18,                       // px/frame, sehr langsam
    linkDistance: 100,                    // Linien werden gezogen wenn Punkte näher als das
    fadeOut: true                         // Linien-Alpha proportional zur Distanz
  };

  function initConstellation(card) {
    if (!card || card.dataset.constellation === '1') return;
    card.dataset.constellation = '1';

    // Canvas-Element
    var canvas = document.createElement('canvas');
    canvas.className = 'auth-constellation-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    if (card.firstChild) {
      card.insertBefore(canvas, card.firstChild);
    } else {
      card.appendChild(canvas);
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var width = 0;
    var height = 0;
    var points = [];
    var rafId = null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      var rect = card.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnPoints() {
      points = [];
      for (var i = 0; i < CFG.pointCount; i++) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * CFG.maxSpeed * 2,
          vy: (Math.random() - 0.5) * CFG.maxSpeed * 2,
          r: CFG.pointSize + Math.random() * CFG.pointSizeRange
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      // Punkte bewegen + zeichnen
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        p.x += p.vx;
        p.y += p.vy;
        // An Rändern abprallen
        if (p.x < 0 || p.x > width)  p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        ctx.beginPath();
        ctx.fillStyle = CFG.color + '0.85)';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Linien zwischen nahen Punkten
      for (var a = 0; a < points.length; a++) {
        for (var b = a + 1; b < points.length; b++) {
          var dx = points[a].x - points[b].x;
          var dy = points[a].y - points[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CFG.linkDistance) {
            var alpha = CFG.fadeOut ? (1 - dist / CFG.linkDistance) * 0.5 : 0.5;
            ctx.beginPath();
            ctx.strokeStyle = CFG.lineColor + alpha.toFixed(3) + ')';
            ctx.lineWidth = 0.8;
            ctx.moveTo(points[a].x, points[a].y);
            ctx.lineTo(points[b].x, points[b].y);
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (rafId !== null) return;
      resize();
      spawnPoints();
      step();
    }
    function stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    // prefers-reduced-motion respektieren
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      resize();
      spawnPoints();
      // Single Frame zeichnen, dann anhalten
      step();
      stop();
    } else {
      start();
    }

    // Resize Card-Größe
    var resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(function () {
        resize();
        spawnPoints();
      });
      resizeObserver.observe(card);
    } else {
      window.addEventListener('resize', function () {
        resize();
        spawnPoints();
      });
    }

    // Wenn Card aus DOM verschwindet: Animation stoppen + Cleanup
    var removalObserver = new MutationObserver(function (mutations) {
      if (!document.contains(card)) {
        stop();
        if (resizeObserver) resizeObserver.disconnect();
        removalObserver.disconnect();
      }
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
  }

  function scanAndInit() {
    var cards = document.querySelectorAll('.auth-card-v39');
    for (var i = 0; i < cards.length; i++) {
      initConstellation(cards[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndInit);
  } else {
    scanAndInit();
  }

  // MutationObserver: neue Auth-Karten sofort bestücken
  var observer = new MutationObserver(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var added = mutations[m].addedNodes;
      for (var n = 0; n < added.length; n++) {
        var node = added[n];
        if (node.nodeType !== 1) continue;
        if (node.classList && node.classList.contains('auth-card-v39')) {
          initConstellation(node);
        }
        if (node.querySelectorAll) {
          var subCards = node.querySelectorAll('.auth-card-v39');
          for (var s = 0; s < subCards.length; s++) initConstellation(subCards[s]);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
