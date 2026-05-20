'use strict';
/* ═══════════════════════════════════════════════════════════════
   V63.86 — KI-Credits-Frontend-Modul
   - Holt /api/v1/ai/credits beim Login + nach jeder KI-Anfrage
   - Aktualisiert Sidebar-Pill (Header)
   - Stellt window.AiCredits.refresh(), .render(), .getStatus() bereit
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

  function render(s) {
    var pill = document.getElementById('hdr-credits-pill');
    if (!pill) return;
    if (!s) { pill.style.display = 'none'; return; }
    var label = document.getElementById('hdr-credits-pill-label');
    var total = s.total_remaining;
    pill.style.display = 'inline-flex';
    pill.classList.remove('low', 'empty');
    if (total === 0) pill.classList.add('empty');
    else if (total <= 2) pill.classList.add('low');

    if (label) {
      label.textContent = total + ' KI-Credit' + (total === 1 ? '' : 's');
    }
    var titleParts = [
      'Monat: ' + s.monthly_used + '/' + s.monthly_limit + ' verbraucht',
      'Verbleibend: ' + s.monthly_remaining,
      'Bonus: ' + s.bonus_credits,
      'Reset: ' + (s.period_reset_at || '')
    ];
    pill.title = titleParts.join('\n');
  }

  // Render Settings-KI-Tab Credits-Box (wird von settings.js aufgerufen)
  function renderSettingsBox(host) {
    if (!host) return;
    var s = _cache;
    if (!s) {
      host.innerHTML = '<div class="hint">KI-Credit-Status wird geladen…</div>';
      return;
    }
    var resetDate = s.period_reset_at || '—';
    var pctUsed = s.monthly_limit > 0 ? Math.round((s.monthly_used / s.monthly_limit) * 100) : 0;
    host.innerHTML = '' +
      '<div class="ai-credits-box">' +
        '<div class="ai-credits-row">' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Monatslimit</div>' +
            '<div class="ai-credits-value">' + s.monthly_limit + '</div>' +
            '<div class="ai-credits-sub">aus Plan</div>' +
          '</div>' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Verbraucht</div>' +
            '<div class="ai-credits-value">' + s.monthly_used + '</div>' +
            '<div class="ai-credits-sub">in diesem Monat</div>' +
          '</div>' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Verbleibend</div>' +
            '<div class="ai-credits-value' + (s.monthly_remaining === 0 ? ' rd' : ' gn') + '">' + s.monthly_remaining + '</div>' +
            '<div class="ai-credits-sub">aus Monatslimit</div>' +
          '</div>' +
          '<div class="ai-credits-cell">' +
            '<div class="ai-credits-label">Bonus-Credits</div>' +
            '<div class="ai-credits-value gold">' + s.bonus_credits + '</div>' +
            '<div class="ai-credits-sub">aus Käufen</div>' +
          '</div>' +
        '</div>' +
        '<div class="ai-credits-bar">' +
          '<div class="ai-credits-bar-fill" style="width:' + pctUsed + '%"></div>' +
        '</div>' +
        '<div class="ai-credits-meta">' +
          '<span>Reset am ' + resetDate + ' (1. des Monats, 00:00 UTC)</span>' +
          '<button class="btn btn-outline btn-sm" type="button" onclick="if(typeof showSettings===\'function\')showSettings(\'plan\');">Credits dazukaufen</button>' +  // V225: öffnet Plan-Tab statt eigenes Modal
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
    alert('Credit-Modal konnte nicht geladen werden. Bitte Seite neu laden.');
  }

  function _packCard(amount, price, label, desc, recommended) {
    return '<div class="cb-pack' + (recommended ? ' recommended' : '') + '">' +
      (recommended ? '<div class="cb-pack-badge">Empfohlen</div>' : '') +
      '<div class="cb-pack-amount">' + amount + ' Credits</div>' +
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
        toast('✓ ' + amount + ' Bonus-Credits gutgeschrieben (Demo)');
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

  window.AiCredits = {
    refresh: refresh,
    getStatus: getStatus,
    render: render,
    renderSettingsBox: renderSettingsBox,
    _buyClick: _buyClick,
    _purchase: _purchase
  };

  // Auto-Refresh beim Laden + nach Login
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ refresh(true); }, 500);
  });
  // Auto-Refresh wenn der User in den Settings-KI-Tab wechselt (auch bei Erst-Öffnung)
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-st-tab="ai"]');
    if (t) setTimeout(function(){ refresh(true); }, 100);
  });
})();
