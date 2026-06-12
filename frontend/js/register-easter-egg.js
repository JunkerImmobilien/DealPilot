/**
 * V169 — Register Easter Egg
 * ═══════════════════════════════════════════════════════════════════
 *
 * Funktionen:
 *  1. Schwarzer Punkt unten links (8px) als versteckter Trigger
 *     → Klick öffnet Register-Modal mit E-Mail-Bestätigungs-Flow
 *
 *  2. URL-Parameter-Handler:
 *     - ?register=1     → Register-Modal direkt öffnen (für Landingpage-Link)
 *     - ?welcome=1&t=X  → Token aus URL in localStorage, Welcome-Toast, App laden
 *     - ?verify_error=X → Error-Modal
 *
 * Für Landingpage-Verlinkung:
 *   https://dealpilot.junker-immobilien.io/?register=1
 */
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── 1. Easter Egg Dot ───────────────────────────────────────────
  // V173: Punkt erscheint NUR wenn Login-Modal sichtbar ist.
  // Im normalen App-Betrieb ist er weg.
  function _injectEasterEgg() {
    if (document.getElementById('dp-register-easter-egg')) return;
    var dot = document.createElement('button');
    dot.id = 'dp-register-easter-egg';
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Konto erstellen');
    dot.title = '';
    dot.style.cssText =
      'position:fixed;bottom:14px;left:14px;width:10px;height:10px;' +
      'border-radius:50%;background:#C9A84C;border:none;cursor:pointer;' +
      'opacity:0.55;transition:opacity 0.2s;z-index:9998;padding:0;outline:none;' +
      'display:none';  // V173: default versteckt — nur sichtbar wenn Login-Modal da
    dot.addEventListener('mouseenter', function () { dot.style.opacity = '0.95'; });
    dot.addEventListener('mouseleave', function () { dot.style.opacity = '0.55'; });
    dot.addEventListener('click', function (e) {
      e.preventDefault();
      showRegisterModal();
    });
    document.body.appendChild(dot);
  }

  // V173: Sichtbarkeit des Punkts steuern — nur wenn Login-Modal sichtbar
  function _updateEasterEggVisibility() {
    var dot = document.getElementById('dp-register-easter-egg');
    if (!dot) return;
    var authModal = document.getElementById('auth-modal');
    var registerModal = document.getElementById('dp-register-modal');
    // Punkt sichtbar wenn entweder Login-Modal offen ist (Pre-Login-State)
    // ODER unser Register-Modal offen ist
    var shouldShow = !!authModal || !!registerModal;
    dot.style.display = shouldShow ? 'block' : 'none';
  }

  // ─── 2. Register-Modal ───────────────────────────────────────────
  function showRegisterModal() {
    var existing = document.getElementById('dp-register-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'dp-register-modal';
    modal.className = 'auth-overlay-v39';
    modal.innerHTML =
      '<div class="auth-bg-v39">' +
        '<div class="auth-bg-glow"></div>' +
      '</div>' +
      '<div class="auth-card-v39" role="dialog" aria-labelledby="dp-register-title">' +
        '<button type="button" id="dp-register-close" style="position:absolute;top:14px;right:14px;background:transparent;border:none;color:#888;font-size:22px;cursor:pointer;width:32px;height:32px;border-radius:50%" aria-label="Schließen">×</button>' +

        '<div class="auth-logo-v39">' +
          '<div class="auth-logo-text">' +
            '<span class="auth-logo-deal">Deal</span><span class="auth-logo-pilot">Pilot</span>' +
          '</div>' +
          '<div class="auth-logo-by">by Junker Immobilien</div>' +
        '</div>' +

        '<h2 id="dp-register-title" class="auth-title-v39">Konto erstellen</h2>' +
        '<p class="auth-sub-v39">Du erhältst eine Bestätigungs-Mail mit Aktivierungs-Link.<br>Dann startest du mit dem Free-Plan.</p>' +

        '<div class="auth-form-v39">' +
          // Honeypot (für Bots, normal versteckt)
          '<input type="text" id="dp-reg-hp" name="hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0;height:0;width:0">' +

          '<div class="auth-field-v39">' +
            '<label for="dp-reg-name">Name</label>' +
            '<div class="auth-input-wrap">' +
              '<input type="text" id="dp-reg-name" placeholder="Vor- und Nachname" autocomplete="name" required maxlength="100">' +
            '</div>' +
          '</div>' +

          '<div class="auth-field-v39">' +
            '<label for="dp-reg-email">E-Mail</label>' +
            '<div class="auth-input-wrap">' +
              '<input type="email" id="dp-reg-email" placeholder="name@firma.de" autocomplete="email" required maxlength="200">' +
            '</div>' +
          '</div>' +

          '<div class="auth-field-v39">' +
            '<label for="dp-reg-pass">Passwort</label>' +
            '<div class="auth-input-wrap">' +
              '<input type="password" id="dp-reg-pass" placeholder="Mindestens 10 Zeichen" autocomplete="new-password" required minlength="10" maxlength="128">' +
            '</div>' +
          '</div>' +

          '<div id="dp-reg-error" class="auth-error-v39" style="display:none"></div>' +
          '<div id="dp-reg-success" style="display:none;background:#E8F5E9;border-left:3px solid #3FA56C;padding:14px 18px;border-radius:4px;margin:8px 0 0;color:#2A2727;font-size:13px;line-height:1.5"></div>' +

          // v428: B2C/B2B-Auswahl entfernt – Verbraucher-/Unternehmer-Status ergibt
          // sich aus dem Gesetz (§ 13/14 BGB, AGB Ziffer V); Erhebung erst beim Kauf.
          '<label id="dp-reg-consent-label" style="display:flex;align-items:flex-start;gap:8px;margin:10px 0 6px;cursor:pointer;font-size:12px;line-height:1.5;color:rgba(250,246,232,0.85)">' +
            '<input type="checkbox" id="dp-reg-consent" style="margin-top:3px;accent-color:#C9A84C;flex-shrink:0">' +
            '<span>Ich habe die <a href="/agb.html" target="_blank" style="color:#C9A84C">AGB</a>, die ' +
            '<a href="/datenschutz.html" target="_blank" style="color:#C9A84C">Datenschutzerklaerung</a> und ' +
            'die <a href="#" onclick="if(window.DealPilotLegal){DealPilotLegal.showInfo();return false;}" style="color:#C9A84C">Nutzungshinweise</a> ' +
            'gelesen und akzeptiere sie. Mir ist bewusst, dass DealPilot <strong>keine Beratung</strong> ist.</span>' +
          '</label>' +

          // v428: Newsletter-Opt-in (freiwillig, default AUS)
          '<label style="display:flex;align-items:flex-start;gap:8px;margin:4px 0 6px;cursor:pointer;font-size:12px;line-height:1.5;color:rgba(250,246,232,0.70)">' +
            '<input type="checkbox" id="dp-reg-newsletter" style="margin-top:3px;accent-color:#C9A84C;flex-shrink:0">' +
            '<span>Ich möchte gelegentlich Produkt-News, Tipps und Angebote zu DealPilot per E-Mail erhalten. <em style="opacity:.8">(Freiwillig, jederzeit abbestellbar.)</em></span>' +
          '</label>' +

          '<button class="auth-btn-v39" id="dp-reg-submit" type="button" disabled style="opacity:0.45;cursor:not-allowed">' +
            '<span>Konto erstellen</span>' +
            '<span class="auth-btn-arrow">→</span>' +
          '</button>' +

          '<p style="text-align:center;font-size:11px;color:#888;margin:16px 0 0;line-height:1.5">' +
            'Mit der Anmeldung stimmst du unserer Datenschutzerklärung zu.<br>' +
            'Keine Werbung. Keine Weitergabe. DSGVO-konform.' +
          '</p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    // V173: Punkt-Visibility updaten (Register-Modal ist jetzt sichtbar)
    setTimeout(_updateEasterEggVisibility, 50);

    // Close-Handler
    document.getElementById('dp-register-close').addEventListener('click', function () { if (typeof showAuthModal === 'function') setTimeout(function(){ showAuthModal('login'); }, 50);
      try { sessionStorage.removeItem('dp_auth_flow'); } catch (e) {}
      modal.remove();
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) { try { sessionStorage.removeItem('dp_auth_flow'); } catch (e2) {} modal.remove(); if (typeof showAuthModal === 'function') setTimeout(function(){ showAuthModal('login'); }, 50); }
    });

    // V271a-register-consent: Submit nur aktiv wenn Checkbox an
    var consentBox = document.getElementById('dp-reg-consent');
    var submitBtn = document.getElementById('dp-reg-submit');
    if (consentBox && submitBtn) {
      consentBox.addEventListener('change', function() {
        if (consentBox.checked) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        } else {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.45';
          submitBtn.style.cursor = 'not-allowed';
        }
      });
    }

    // Submit
    document.getElementById('dp-reg-submit').addEventListener('click', _handleSubmit);
    ['dp-reg-name', 'dp-reg-email', 'dp-reg-pass'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') _handleSubmit();
      });
    });

    setTimeout(function () {
      var first = document.getElementById('dp-reg-name');
      if (first) first.focus();
    }, 100);
  }

  async function _handleSubmit() {
    var nameEl = document.getElementById('dp-reg-name');
    var emailEl = document.getElementById('dp-reg-email');
    var passEl = document.getElementById('dp-reg-pass');
    var hpEl = document.getElementById('dp-reg-hp');
    var errEl = document.getElementById('dp-reg-error');
    var sucEl = document.getElementById('dp-reg-success');
    var btn = document.getElementById('dp-reg-submit');

    errEl.style.display = 'none';
    sucEl.style.display = 'none';

    var name = (nameEl.value || '').trim();
    var email = (emailEl.value || '').trim();
    var pass = passEl.value || '';
    var hp = hpEl.value || '';

    // V271a-register-consent: Consent-Validation
    var consentEl = document.getElementById('dp-reg-consent');
    if (!consentEl || !consentEl.checked) {
      _error(errEl, 'Bitte AGB, Datenschutz und Nutzungshinweise akzeptieren');
      return;
    }
    var userTypeEl = document.querySelector('input[name="dp-reg-usertype"]:checked');
    var isConsumer = userTypeEl ? (userTypeEl.value === 'consumer') : true;

    try {
      localStorage.setItem('dp_pending_consent', JSON.stringify({
        accepted: true,
        version: (window.DealPilotLegal && DealPilotLegal.VERSION) || '1.1',
        accepted_at: new Date().toISOString(),
        is_consumer: isConsumer,
        terms_version: '1.0',
        privacy_version: '1.0'
      }));
    } catch(e) {}

    if (name.length < 2) { _error(errEl, 'Bitte Namen eingeben'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { _error(errEl, 'Bitte gültige E-Mail-Adresse eingeben'); return; }
    if (pass.length < 10) { _error(errEl, 'Passwort muss mindestens 10 Zeichen haben'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span>Wird gesendet…</span>';

    try {
      var resp = await fetch('/api/v1/auth/register-with-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, password: pass, hp: hp,
          newsletter: !!(document.getElementById('dp-reg-newsletter') && document.getElementById('dp-reg-newsletter').checked) })
      });
      var data = await resp.json().catch(function () { return {}; });

      if (!resp.ok) {
        var msg = (data && data.error) || 'Anmeldung fehlgeschlagen (HTTP ' + resp.status + ')';
        _error(errEl, msg);
        btn.disabled = false;
        btn.innerHTML = '<span>Konto erstellen</span><span class="auth-btn-arrow">→</span>';
        return;
      }

      // Erfolg
      sucEl.style.display = 'block';
      sucEl.innerHTML =
        '<strong style="color:#3FA56C">✓ Anmeldung erfolgreich!</strong><br>' +
        'Wir haben eine Bestätigungs-Mail an <strong>' + _esc(email) + '</strong> gesendet.<br>' +
        '<span style="color:#666;font-size:12px">Bitte klicke auf den Link in der Mail um dein Konto zu aktivieren. Der Link ist 24h gültig.</span>';
      // Form-Felder ausblenden
      nameEl.parentNode.parentNode.style.display = 'none';
      emailEl.parentNode.parentNode.style.display = 'none';
      passEl.parentNode.parentNode.style.display = 'none';
      btn.style.display = 'none';
    } catch (e) {
      _error(errEl, 'Netzwerkfehler — bitte später erneut versuchen');
      btn.disabled = false;
      btn.innerHTML = '<span>Konto erstellen</span><span class="auth-btn-arrow">→</span>';
    }
  }

  function _error(el, msg) {
    el.textContent = '⚠ ' + msg;
    el.style.display = 'block';
  }

  // ─── 3. URL-Parameter-Handler ────────────────────────────────────
  function _handleUrlParams() {
    var params = new URLSearchParams(window.location.search);

    // V204 SECURITY-FIX (C2): Token kommt jetzt im Hash-Fragment statt Query,
    // damit er nicht in Server-Logs / Referrer-Headers leaked.
    // Backward-compat: alte Verify-Links aus früher versendeten Mails nutzen
    // noch ?welcome=1&t=… → lesen wir auch.
    var hashParams = null;
    try {
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (hash && hash.indexOf('welcome=1') >= 0) {
        hashParams = new URLSearchParams(hash);
      }
    } catch(e) {}

    var welcomeOk = (params.get('welcome') === '1' && params.get('t')) ||
                    (hashParams && hashParams.get('welcome') === '1' && hashParams.get('t'));

    if (welcomeOk) {
      var token = (hashParams && hashParams.get('t')) || params.get('t');
      try {
        localStorage.setItem('ji_token', token);
        // v629-jwt-session: Name/E-Mail/Role direkt aus dem JWT lesen, damit die
        // Session NICHT leer bleibt (sonst "?"-Avatar trotz gueltigem Token).
        var _claims = {};
        try {
          var _b = (token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
          while (_b.length % 4) { _b += '='; }
          _claims = JSON.parse(decodeURIComponent(escape(atob(_b)))) || {};
        } catch (e) { console.warn('[v629] JWT-Decode fehlgeschlagen', e); }
        var nullSession = {
          mode: 'api',
          userId: _claims.userId || _claims.sub || null,
          email: _claims.email || '',
          name: _claims.name || '',
          role: _claims.role || 'user',
          token: token,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 Tage
        };
        localStorage.setItem('ji_session', JSON.stringify(nullSession));
        console.log('[register V204] Mail bestätigt — Token gespeichert, Welcome-Toast');

        // URL bereinigen — Query UND Hash entfernen
        var clean = window.location.pathname;
        history.replaceState({}, '', clean);

        // Welcome-Toast nach Page-Load
        setTimeout(function () {
          _showWelcomeToast();
        }, 600);
      } catch (e) {
        console.error('[register V204] Auto-Login fehlgeschlagen:', e);
      }
    }

    // ?register=1 → Register-Modal direkt öffnen (Landingpage-Link)
    if (params.get('register') === '1') {
      try { sessionStorage.setItem('dp_auth_flow', '1'); } catch (e) {}
      var clean2 = window.location.pathname;
      history.replaceState({}, '', clean2);
      setTimeout(showRegisterModal, 400);  // Etwas warten bis DOM/Auth-Modal etc. ready
    }

    // ?verify_error=X → Fehlermeldung anzeigen
    var verifyErr = params.get('verify_error');
    if (verifyErr) {
      var clean3 = window.location.pathname;
      history.replaceState({}, '', clean3);
      setTimeout(function () {
        var msg = verifyErr === 'invalid' ? 'Bestätigungs-Link ungültig oder bereits genutzt.' :
                  verifyErr === 'expired' ? 'Bestätigungs-Link abgelaufen. Bitte erneut anmelden.' :
                  'Bei der Bestätigung ist ein Fehler aufgetreten. Bitte erneut versuchen.';
        _showErrorToast(msg);
      }, 600);
    }
  }

  function _showWelcomeToast() {
    var toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;top:24px;right:24px;background:#1A1818;color:#F8F6F1;' +
      'padding:18px 22px;border-radius:8px;border-left:4px solid #3FA56C;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:99999;max-width:360px;' +
      'font-size:14px;line-height:1.5';
    toast.innerHTML =
      '<div style="color:#3FA56C;font-weight:600;margin-bottom:6px;font-size:12px;text-transform:uppercase;letter-spacing:0.6px">✓ Konto aktiviert</div>' +
      '<div>Willkommen bei DealPilot! Du bist jetzt eingeloggt. Free-Plan ist aktiv.</div>';
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; }, 6000);
    setTimeout(function () { toast.remove(); }, 7000);
  }

  function _showErrorToast(msg) {
    var toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;top:24px;right:24px;background:#1A1818;color:#F8F6F1;' +
      'padding:18px 22px;border-radius:8px;border-left:4px solid #B8625C;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:99999;max-width:360px;' +
      'font-size:14px;line-height:1.5';
    toast.innerHTML =
      '<div style="color:#B8625C;font-weight:600;margin-bottom:6px;font-size:12px;text-transform:uppercase;letter-spacing:0.6px">Bestätigung fehlgeschlagen</div>' +
      '<div>' + _esc(msg) + '</div>';
    document.body.appendChild(toast);
    setTimeout(function () { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; }, 8000);
    setTimeout(function () { toast.remove(); }, 9000);
  }

  // ─── Init ────────────────────────────────────────────────────────
  function init() {
    _injectEasterEgg();
    _handleUrlParams();
    _watchAuthModal();
    // V173: Initial check + periodisch (für robusten Initial-Load)
    _updateEasterEggVisibility();
    setTimeout(_updateEasterEggVisibility, 300);
    setTimeout(_updateEasterEggVisibility, 1500);
  }

  // V172: Beobachte ob ein Auth-Login-Modal erscheint und aktiviere den
  // "Konto erstellen — Coming Soon" Button so dass er gold+klickbar wird
  // und unser Register-Modal öffnet.
  // V173: Plus Sichtbarkeit des Easter-Egg-Punkts steuern.
  function _watchAuthModal() {
    if (typeof MutationObserver === 'undefined') return;

    /* V10_EE_OBSERVER_DISABLED: auskommentiert weil auth.js den Button direkt clickable hat
var mo = new MutationObserver(function () {
      // V173: Bei jeder DOM-Mutation Punkt-Sichtbarkeit neu prüfen
      _updateEasterEggVisibility();

      var btn = document.querySelector('.auth-register-v39');
      if (!btn || btn._v172_patched) return;
      btn._v172_patched = true;

      // Disabled-State entfernen
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-disabled');
      btn.title = '';

      // Inline-Style → gold, klickbar
      btn.style.cssText =
        'background:#C9A84C !important;color:#1A1818 !important;' +
        'border:1px solid #C9A84C !important;cursor:pointer !important;' +
        'opacity:1 !important;padding:10px 14px !important;' +
        'border-radius:8px !important;font-weight:600 !important;' +
        'font-size:14px !important;width:100% !important;' +
        'transition:opacity 0.2s !important;margin-top:6px';

      // "Coming Soon"-Tag entfernen
      btn.innerHTML = 'Konto erstellen';

      // Click-Handler: schließe Login-Modal, öffne unser Register-Modal
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var loginModal = document.getElementById('auth-modal');
        if (loginModal) loginModal.remove();
        setTimeout(showRegisterModal, 100);
      });

      btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.92'; });
      btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
    });
    mo.observe(document.body, { childList: true, subtree: true });
*/
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose für manuellen Trigger
  window.DealPilotRegister = {
    show: showRegisterModal
  };

  // V270.5b-alias: auth.js sucht window.RegisterModal (Legacy-Name)
  // Wir aliasen damit _v10OpenRegister() auch funktioniert.
  window.RegisterModal = window.DealPilotRegister;

  console.log('[register V169] Easter Egg aktiv — DealPilotRegister.show() zum Öffnen');
})();
