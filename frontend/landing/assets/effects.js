/**
 * DealPilot Landing-Page · Effects-Stack
 * 
 * Enthält:
 * - Particle-Network-Background (Canvas, kleine bewegliche Punkte mit Verbindungslinien)
 * - Story-Slider (Auto-Advance 2 Min, Klick zum Skippen, Fortschrittsanzeige, Dots)
 * - Reveal-on-Scroll (IntersectionObserver)
 * - Cursor-Glow (folgt der Maus)
 * - Magnetic-Buttons (CTAs reagieren leicht auf Cursor-Nähe)
 * - Tilt-Cards (Workflow + Features bekommen 3D-Tilt beim Hover)
 * - Mouse-Tracking auf Feature-Cards (Radial-Glow folgt dem Cursor)
 * - Number-Counter (Hero-Stats zählen hoch beim Sichtbarwerden)
 */
(function() {
  'use strict';

  // Respect reduced motion preference
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════════════
     1. PARTICLE-NETWORK-BACKGROUND
     Kleine bewegliche Goldpunkte mit Verbindungslinien.
     Inspiriert vom App-Login-Hintergrund.
  ═══════════════════════════════════════════════════ */
  function initParticles() {
    var canvas = document.getElementById('bg-particles');
    if (!canvas || prefersReducedMotion) return;
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    // Particle count adapts to screen size
    var density = Math.min((w * h) / 18000, 90);
    var particles = [];
    for (var i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.20,
        vy: (Math.random() - 0.5) * 0.20,
        r: Math.random() * 1.6 + 0.6
      });
    }

    var mouseX = -9999, mouseY = -9999;
    window.addEventListener('mousemove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function loop() {
      ctx.clearRect(0, 0, w, h);

      // Move + draw particles
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Mouse-pull: particles drift toward the mouse subtly
        var dx = mouseX - p.x;
        var dy = mouseY - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          var force = (140 - dist) / 140 * 0.18;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(201, 168, 76, 0.55)';
        ctx.fill();
      }

      // Connection lines between nearby particles
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var a = particles[i];
          var b = particles[j];
          var dx2 = a.x - b.x;
          var dy2 = a.y - b.y;
          var d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d < 130) {
            var op = (1 - d / 130) * 0.28;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = 'rgba(201, 168, 76, ' + op + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ═══════════════════════════════════════════════════
     2. STORY-SLIDER mit Auto-Advance
  ═══════════════════════════════════════════════════ */
  function initSlider() {
    var slider = document.getElementById('story-slider');
    if (!slider) return;
    var slides = slider.querySelectorAll('.story-slide');
    if (!slides.length) return;

    var dotsBox = document.getElementById('story-dots');
    var fill = document.getElementById('story-fill');
    var prevBtn = document.getElementById('story-prev');
    var nextBtn = document.getElementById('story-next');

    var AUTO_MS = 60 * 1000; // 1 Minute
    var current = 0;
    var startTs = 0;
    var rafId = null;
    var paused = false;

    // Dots
    slides.forEach(function(_, idx) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'story-dot';
      d.setAttribute('aria-label', 'Story ' + (idx + 1));
      d.addEventListener('click', function() { goTo(idx); });
      dotsBox.appendChild(d);
    });

    function setActive(idx) {
      slides.forEach(function(s, i) {
        s.classList.remove('active', 'exit-left');
        if (i === idx) s.classList.add('active');
        else if (i < idx) s.classList.add('exit-left');
      });
      dotsBox.querySelectorAll('.story-dot').forEach(function(d, i) {
        d.classList.toggle('active', i === idx);
      });
      current = idx;
      startTs = performance.now();
    }

    function goTo(idx) {
      var n = (idx + slides.length) % slides.length;
      setActive(n);
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function progressLoop(now) {
      if (!paused) {
        var elapsed = now - startTs;
        var pct = Math.min(elapsed / AUTO_MS, 1);
        fill.style.width = (pct * 100) + '%';
        if (pct >= 1) {
          next();
        }
      }
      rafId = requestAnimationFrame(progressLoop);
    }

    prevBtn.addEventListener('click', function() { prev(); });
    nextBtn.addEventListener('click', function() { next(); });

    // Pause on hover
    slider.addEventListener('mouseenter', function() { paused = true; });
    slider.addEventListener('mouseleave', function() { paused = false; startTs = performance.now() - (parseFloat(fill.style.width) / 100 * AUTO_MS); });

    // Keyboard
    document.addEventListener('keydown', function(e) {
      if (!slider.getBoundingClientRect().bottom > 0) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // Touch swipe
    var touchStartX = 0, touchEndX = 0;
    slider.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    slider.addEventListener('touchend', function(e) {
      touchEndX = e.changedTouches[0].screenX;
      var diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) next(); else prev();
      }
    }, { passive: true });

    setActive(0);
    rafId = requestAnimationFrame(progressLoop);
  }

  /* ═══════════════════════════════════════════════════
     3. REVEAL-ON-SCROLL
  ═══════════════════════════════════════════════════ */
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function(el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(function(el) { io.observe(el); });

    // Auto-add reveal to common elements
    var auto = document.querySelectorAll('.feature, .workflow-step, .rate-tile, .livedata-card');
    auto.forEach(function(el, i) {
      if (!el.classList.contains('reveal')) {
        el.classList.add('reveal');
        el.classList.add('reveal-delay-' + Math.min(i % 4, 3));
        io.observe(el);
      }
    });
  }

  /* ═══════════════════════════════════════════════════
     4. CURSOR-FOLLOW GLOW
  ═══════════════════════════════════════════════════ */
  function initCursorGlow() {
    if (prefersReducedMotion) return;
    var glow = document.getElementById('cursor-glow');
    if (!glow) return;
    document.body.classList.add('has-cursor');
    var rafGlow = null;
    var tx = 0, ty = 0, cx = 0, cy = 0;

    window.addEventListener('mousemove', function(e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!rafGlow) rafGlow = requestAnimationFrame(update);
    });
    function update() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      glow.style.transform = 'translate(' + cx + 'px, ' + cy + 'px) translate(-50%, -50%)';
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        rafGlow = requestAnimationFrame(update);
      } else {
        rafGlow = null;
      }
    }

    // Hide cursor on touch devices
    window.addEventListener('touchstart', function() {
      document.body.classList.remove('has-cursor');
    }, { once: true, passive: true });
  }

  /* ═══════════════════════════════════════════════════
     5. MAGNETIC BUTTONS
  ═══════════════════════════════════════════════════ */
  function initMagnetic() {
    if (prefersReducedMotion) return;
    // Apply to all main CTAs automatically
    document.querySelectorAll('.btn-primary, .btn-secondary, .nav-cta').forEach(function(b) {
      b.classList.add('magnetic');
    });
    document.querySelectorAll('.magnetic').forEach(function(el) {
      el.addEventListener('mousemove', function(e) {
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dx = (e.clientX - cx) * 0.22;
        var dy = (e.clientY - cy) * 0.22;
        el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      });
      el.addEventListener('mouseleave', function() {
        el.style.transform = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     6. TILT-CARDS (Workflow-Steps + Feature-Cards)
  ═══════════════════════════════════════════════════ */
  function initTilt() {
    if (prefersReducedMotion) return;
    var cards = document.querySelectorAll('.workflow-step, .feature');
    cards.forEach(function(card) {
      card.classList.add('tilt-card');
      card.addEventListener('mousemove', function(e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top) / r.height;
        var rx = (y - 0.5) * -6;
        var ry = (x - 0.5) * 6;
        card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-2px)';
        // Pass mouse to ::before for radial glow
        card.style.setProperty('--mouse-x', (x * 100) + '%');
        card.style.setProperty('--mouse-y', (y * 100) + '%');
      });
      card.addEventListener('mouseleave', function() {
        card.style.transform = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     7. NUMBER-COUNTER (Hero Stats)
  ═══════════════════════════════════════════════════ */
  function initCounters() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-count]').forEach(function(el) {
        el.textContent = el.getAttribute('data-count');
      });
      return;
    }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        var dur = 1400;
        var start = performance.now();
        function tick(now) {
          var t = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.floor(eased * target);
          if (t < 1) requestAnimationFrame(tick);
          else el.textContent = target;
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(function(el) { io.observe(el); });
  }

  /* ═══════════════════════════════════════════════════
     8. SPOTLIGHT auf Feature-Cards
     CSS-Variablen --mx/--my für radial-gradient
  ═══════════════════════════════════════════════════ */
  function initSpotlight() {
    if (prefersReducedMotion) return;
    document.querySelectorAll('.feature, .rate-tile, .plan').forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     9. SCROLL-PARALLAX auf Background-Orbs
  ═══════════════════════════════════════════════════ */
  function initParallax() {
    if (prefersReducedMotion) return;
    var orbs = document.querySelectorAll('.bg-orb');
    if (!orbs.length) return;

    var rafP = null;
    var lastY = 0;

    function onScroll() {
      lastY = window.scrollY;
      if (!rafP) rafP = requestAnimationFrame(update);
    }
    function update() {
      orbs.forEach(function(orb, i) {
        var speed = (i + 1) * 0.05;
        orb.style.translate = '0 ' + (lastY * speed) + 'px';
      });
      rafP = null;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ═══════════════════════════════════════════════════
     10. RIPPLE-EFFEKT auf Buttons beim Klick
  ═══════════════════════════════════════════════════ */
  function initRipple() {
    if (prefersReducedMotion) return;
    document.querySelectorAll('.btn-primary, .btn-secondary, .nav-cta').forEach(function(btn) {
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.addEventListener('click', function(e) {
        var r = btn.getBoundingClientRect();
        var ripple = document.createElement('span');
        ripple.className = 'btn-ripple';
        ripple.style.position = 'absolute';
        ripple.style.left = (e.clientX - r.left) + 'px';
        ripple.style.top = (e.clientY - r.top) + 'px';
        ripple.style.width = '4px';
        ripple.style.height = '4px';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 255, 255, 0.55)';
        ripple.style.transform = 'translate(-50%, -50%) scale(1)';
        ripple.style.transition = 'transform 0.7s ease-out, opacity 0.7s ease-out';
        ripple.style.pointerEvents = 'none';
        btn.appendChild(ripple);
        requestAnimationFrame(function() {
          ripple.style.transform = 'translate(-50%, -50%) scale(150)';
          ripple.style.opacity = '0';
        });
        setTimeout(function() { ripple.remove(); }, 750);
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     11. LOGO-PARTICLE-BURST beim Hover
     Kleine Goldfunken sprühen kurz um das Logo
  ═══════════════════════════════════════════════════ */
  function initLogoBurst() {
    if (prefersReducedMotion) return;
    document.querySelectorAll('.nav-brand').forEach(function(brand) {
      var lastBurst = 0;
      brand.addEventListener('mouseenter', function() {
        if (Date.now() - lastBurst < 1500) return;
        lastBurst = Date.now();
        for (var i = 0; i < 8; i++) {
          (function(idx) {
            var spark = document.createElement('span');
            spark.style.position = 'absolute';
            spark.style.left = '50%';
            spark.style.top = '50%';
            spark.style.width = '4px';
            spark.style.height = '4px';
            spark.style.borderRadius = '50%';
            spark.style.background = '#e8c878';
            spark.style.boxShadow = '0 0 6px #C9A84C';
            spark.style.pointerEvents = 'none';
            spark.style.zIndex = '10';
            spark.style.opacity = '1';
            spark.style.transition = 'transform 0.9s cubic-bezier(0.2, 0.6, 0.2, 1), opacity 0.9s ease-out';
            brand.appendChild(spark);

            var angle = (idx / 8) * Math.PI * 2 + Math.random() * 0.4;
            var dist = 50 + Math.random() * 30;
            var dx = Math.cos(angle) * dist;
            var dy = Math.sin(angle) * dist;

            requestAnimationFrame(function() {
              spark.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(0)';
              spark.style.opacity = '0';
            });
            setTimeout(function() { spark.remove(); }, 1000);
          })(i);
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════
     12. TYPING-INDICATOR auf Hero-Title (subtil)
     Cursor blinkt nach dem Titel
  ═══════════════════════════════════════════════════ */
  function initHeroAccent() {
    if (prefersReducedMotion) return;
    var title = document.querySelector('.hero-title');
    if (!title) return;
    // Add subtle gradient sweep animation
    title.style.backgroundSize = '200% 100%';
  }

  /* ═══════════════════════════════════════════════════
     KICKOFF — neu zusammensetzen
  ═══════════════════════════════════════════════════ */
  function init() {
    initParticles();
    initSlider();
    initReveal();
    initCursorGlow();
    initMagnetic();
    initTilt();
    initCounters();
    initSpotlight();
    initParallax();
    initRipple();
    initLogoBurst();
    initHeroAccent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
