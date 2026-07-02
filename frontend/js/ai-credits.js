'use strict';
/* ═══════════════════════════════════════════════════════════════
   V63.86 → v489 — Pilot-Tank-Frontend-Modul (vorher: KI-Credits)
   - Holt /api/v1/ai/credits beim Login + nach jeder Pilot-Anfrage
   - Aktualisiert Header-Fuel-Pill (Tank-Icon + Stand + Mini-Füllbalken)
   - Stellt window.AiCredits.refresh(), .render(), .getStatus() bereit
   v489-HINWEIS:
   - Die separate Marktdaten-(AVM)-Pille ist entfernt; refreshAvm/renderAvm
     bleiben als No-Ops erhalten (object-actions.js ruft sie weiter auf).
   - v490: Anzeige in Litern. Die Backend-Einheit ist bereits 1 = 1 Anfrage
     (ai.js zieht consume(1) pro Anfrage) = 1 Liter — die Zahl ist also korrekt.
     Der Backend-Merge (v491) hebt nur die Plan-Limits aufs Marketing-Niveau.
═══════════════════════════════════════════════════════════════ */
(function(){
  var _cache = null;
  var _lastFetch = 0;
  var CACHE_TTL = 60000;  // 1 Minute Cache

  function _apiBase() {
    var m = document.querySelector('meta[name="ji-api-base"]');
    return m ? m.content : '';
  }

  function _token() {
    return localStorage.getItem('ji_token') || '';
  }

  async function refresh(force) {
    if (!force && _cache && (Date.now() - _lastFetch) < CACHE_TTL) {
      return _cache;
    }
    var t = _token();
    if (!t) { _cache = null; render(null); return null; }
    try {
      var resp = await fetch(_apiBase() + '/ai/credits', {
        headers: { 'Authorization': 'Bearer ' + t }
      });
      if (!resp.ok) { _cache = null; render(null); return null; }
      _cache = await resp.json();
      _lastFetch = Date.now();
      render(_cache);
      return _cache;
    } catch (e) {
      _cache = null; render(null);
      return null;
    }
  }

  function getStatus() { return _cache; }

  /* v489-fuel-pill: Tank-Icon + Stand + Mini-Füllbalken in der Header-Pille */
  function render(s) {
    var pill = document.getElementById('hdr-credits-pill');
    if (!pill) return;
    if (!s) { pill.style.display = 'none'; return; }
    var label = document.getElementById('hdr-credits-pill-label');
    var total = s.total_remaining;
    pill.style.display = 'inline-flex';
    pill.classList.add('fuel-pill');
    pill.classList.remove('low', 'empty');
    if (total === 0) pill.classList.add('empty');
    else if (total <= 2) pill.classList.add('low');

    /* v490: 1 Backend-Einheit = 1 Anfrage = 1 Liter -> direkte Liter-Anzeige */
    if (label) {
      label.textContent = total + ' L';
    }

    /* Mini-Füllbalken: Anteil des Monatskontingents, das noch im Tank ist */
    var bar = document.getElementById('hdr-credits-pill-bar');
    if (!bar) {
      bar = document.createElement('span');
      bar.id = 'hdr-credits-pill-bar';
      bar.className = 'fuel-pill-bar';
      bar.innerHTML = '<i></i>';
      pill.appendChild(bar);
    }
    var fill = bar.querySelector('i');
    if (fill) {
      var pct = 0;
      if (s.monthly_limit > 0) {
        pct = Math.max(0, Math.min(100, Math.round((s.monthly_remaining / s.monthly_limit) * 100)));
      } else if (total > 0) {
        pct = 100;
      }
      fill.style.width = pct + '%';
    }

    var titleParts = [
      'Pilot-Tank · Kerosin',
      'Monat: ' + s.monthly_used + '/' + s.monthly_limit + ' L verbraucht',
      'Verbleibend: ' + s.monthly_remaining + ' L',
      'Bonus-Tank: ' + s.bonus_credits + ' L (verfällt nicht)',
      'Reset Monatskontingent: ' + (s.period_reset_at || '')
    ];
    pill.title = titleParts.join('\n');
  }

  // Render Settings-Pilot-Tab Tank-Box (wird von settings.js aufgerufen)
  function renderSettingsBox(host) {
    if (!host) return;
    var s = _cache;
    if (!s) {
      host.innerHTML = '<div class="hint">Pilot-Tank-Status wird geladen…</div>';
      /* v840-kerosin-load: Cache leer -> selbst refresh() triggern + nach Laden neu rendern.
         Vorher haing die Box, bis refresh() zufaellig woanders lief. */
      try {
        if (typeof refresh === 'function' && !host._v840Loading) {
          host._v840Loading = true;
          refresh(false).then(function(fresh) {
            host._v840Loading = false;
            if (fresh) { try { renderSettingsBox(host); } catch(e){} }
            else { host.innerHTML = '<div class="hint">Tank-Status nicht verfuegbar.</div>'; }
          }).catch(function(){ host._v840Loading = false; });
        }
      } catch(e) {}
      return;
    }
    var resetDate = s.period_reset_at || '—';
    var pctUsed = s.monthly_limit > 0 ? Math.round((s.monthly_used / s.monthly_limit) * 100) : 0;
    host.innerHTML = '' +
      '<div class="ai-credits-box">' +
        '<div class="ai-credits-row">' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Monatslimit</div>' +
            '<div class="ai-credits-value">' + s.monthly_limit + ' L</div>' +
            '<div class="ai-credits-sub">aus Plan</div>' +
          '</div>' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Verbraucht</div>' +
            '<div class="ai-credits-value">' + s.monthly_used + ' L</div>' +
            '<div class="ai-credits-sub">in diesem Monat</div>' +
          '</div>' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Verbleibend</div>' +
            '<div class="ai-credits-value' + (s.monthly_remaining === 0 ? ' rd' : ' gn') + '">' + s.monthly_remaining + ' L</div>' +
            '<div class="ai-credits-sub">aus Monatslimit</div>' +
          '</div>' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Bonus-Tank</div>' +
            '<div class="ai-credits-value gold">' + s.bonus_credits + ' L</div>' +
            '<div class="ai-credits-sub">aus Käufen</div>' +
          '</div>' +
        '</div>' +
        '<div class="ai-credits-bar">' +
          '<div class="ai-credits-bar-fill" style="width:' + pctUsed + '%"></div>' +
        '</div>' +
        '<div class="hint">Monatskontingent resettet am 1. — der Bonus-Tank (gekauftes Kerosin) verfällt nie und wird zuletzt verbraucht.</div>' + /* v491-hybrid */
        '<div class="ai-credits-meta">' +
          '<span>Reset am ' + resetDate + ' (1. des Monats, 00:00 UTC)</span>' +
          '<button class="btn btn-outline btn-sm" type="button" onclick="if(typeof showSettings===\'function\')showSettings(\'plan\');">Kerosin tanken</button>' +  // V225: öffnet Plan-Tab statt eigenes Modal
        '</div>' +
      '</div>';
  }

  function _buyClick() {
    // V197: redirect zu CreditsModal (neues Stripe-System ersetzt Demo-Stub)
    if (typeof window.CreditsModal === 'object' && typeof window.CreditsModal.open === 'function') {
      window.CreditsModal.open();
      return;
    }
    // Fallback falls credits-modal.js nicht geladen ist
    alert('Kerosin-Modal konnte nicht geladen werden. Bitte Seite neu laden.');
  }

  function _packCard(amount, price, label, desc, recommended) {
    return '<div class="cb-pack' + (recommended ? ' recommended' : '') + '">' +
      (recommended ? '<div class="cb-pack-badge">Empfohlen</div>' : '') +
      '<div class="cb-pack-amount">' + amount + ' Liter</div>' +
      '<div class="cb-pack-price">' + price + '</div>' +
      '<div class="cb-pack-label">' + label + '</div>' +
      '<div class="cb-pack-desc">' + desc + '</div>' +
      '<button type="button" class="btn btn-gold cb-pack-btn" onclick="window.AiCredits._purchase(' + amount + ', this)">Demo-Kauf</button>' +
    '</div>';
  }

  async function _purchase(amount, btn) {
    if (!btn) return;
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Wird gutgeschrieben…';
    try {
      var t = _token();
      if (!t) throw new Error('Nicht eingeloggt');
      var resp = await fetch(_apiBase() + '/ai/credits/demo-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + t
        },
        body: JSON.stringify({ amount: amount })
      });
      var data = null;
      try { data = await resp.json(); } catch(e) { data = {}; }
      if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
      if (typeof toast === 'function') {
        toast('✓ ' + amount + ' in den Bonus-Tank gutgeschrieben (Demo)');
      }
      // Cache invalidieren + neu rendern
      _cache = data.status || null;
      _lastFetch = Date.now();
      render(_cache);
      var modal = document.getElementById('credit-buy-modal');
      if (modal) modal.remove();
      // Settings-Box ggf. updaten
      var box = document.getElementById('ai-credits-settings-host');
      if (box) renderSettingsBox(box);
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = orig;
      if (typeof toast === 'function') toast('✗ Fehler: ' + e.message);
      else alert('Fehler: ' + e.message);
    }
  }

  // ── v489: AVM-Pille entfernt — Kerosin ist die eine Währung. ──
  // No-Ops bleiben, weil object-actions.js (v435-credit-refresh) refreshAvm()
  // nach Live-Abrufen aufruft. Eine evtl. noch vorhandene Pille aus altem
  // Markup wird ausgeblendet.
  function renderAvm() {
    var avm = document.getElementById('hdr-avm-pill');
    if (avm) avm.style.display = 'none';
  }

  async function refreshAvm() {
    renderAvm();
    /* v489: Kerosin-Stand mitziehen, damit die Fuel-Pill nach AVM-Abrufen
       (sobald die über Kerosin laufen, E2/v490) aktuell ist. */
    try { refresh(true); } catch (e) {}
  }

  window.AiCredits = {
    refresh: refresh,
    getStatus: getStatus,
    render: render,
    renderSettingsBox: renderSettingsBox,
    _buyClick: _buyClick,
    _purchase: _purchase,
    refreshAvm: refreshAvm
  };

  // Auto-Refresh beim Laden + nach Login
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ refresh(true); }, 500);
    setTimeout(function(){ renderAvm(); }, 700);
  });
  // Auto-Refresh wenn der User in den Settings-Pilot-Tab wechselt (auch bei Erst-Öffnung)
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-st-tab="ai"]');
    if (t) setTimeout(function(){ refresh(true); }, 100);
  });
})();
