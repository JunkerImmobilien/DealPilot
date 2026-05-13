'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – auth.js V9
   Hybrid Auth: Backend API (production) ODER localStorage (offline)

   Configure via:
     window.JI_API_BASE = 'https://api.example.com/api/v1';
   Or in HTML:
     <meta name="ji-api-base" content="http://localhost:3001/api/v1">
═══════════════════════════════════════════════════ */

var Auth = (function() {
  var SESSION_KEY = 'ji_session';
  var TOKEN_KEY = 'ji_token';
  var USERS_KEY = 'ji_users';
  var SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;  // V174: 7d (matches Backend JWT)

  function getApiBase() {
    if (window.JI_API_BASE) return window.JI_API_BASE;
    var meta = document.querySelector('meta[name="ji-api-base"]');
    if (meta && meta.content) return meta.content;
    return null;
  }

  function isApiMode() { return getApiBase() !== null; }

  async function apiCall(path, options) {
    options = options || {};
    var base = getApiBase();
    if (!base) throw new Error('Kein API-Base konfiguriert');
    var url = base + path;
    var headers = options.headers || {};
    headers['Content-Type'] = 'application/json';
    var token = localStorage.getItem(TOKEN_KEY);
    if (token && !options.noAuth) headers['Authorization'] = 'Bearer ' + token;
    var fetchOpts = { method: options.method || 'GET', headers: headers, credentials: 'omit' };
    if (options.body) fetchOpts.body = JSON.stringify(options.body);
    // V203: AbortSignal durchreichen + Default-Timeout 15s falls keiner gesetzt
    var defaultCtrl = null;
    if (options.signal) {
      fetchOpts.signal = options.signal;
    } else {
      defaultCtrl = new AbortController();
      fetchOpts.signal = defaultCtrl.signal;
      setTimeout(function() { defaultCtrl.abort(); }, 15000);
    }
    var res;
    try { res = await fetch(url, fetchOpts); }
    catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('Anfrage-Timeout (Server antwortet nicht binnen 15s)');
      }
      throw new Error('Server nicht erreichbar (' + err.message + ')');
    }
    var data = null;
    try { data = await res.json(); } catch(e) {}
    if (!res.ok) {
      var msg = (data && data.error) || ('HTTP ' + res.status);
      var error = new Error(msg);
      error.status = res.status; error.data = data;
      throw error;
    }
    return data;
  }

  // ── localStorage Implementation ──
  var localImpl = {
    async hashPassword(password, salt) {
      var encoder = new TextEncoder();
      var data = encoder.encode(password + ':' + salt);
      var hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    },
    generateSalt() {
      return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    },
    getUsers() {
      try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch(e) { return []; }
    },
    saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); },

    async register(email, password, name) {
      var users = this.getUsers();
      var emailLower = email.toLowerCase();
      if (users.find(u => u.email === emailLower)) throw new Error('E-Mail bereits registriert.');
      var salt = this.generateSalt();
      var hash = await this.hashPassword(password, salt);
      users.push({
        id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        email: emailLower, name: name, salt: salt, hash: hash,
        created: new Date().toISOString(),
        role: users.length === 0 ? 'admin' : 'user'
      });
      this.saveUsers(users);
      return this.login(email, password);
    },

    async login(email, password) {
      var users = this.getUsers();
      var user = users.find(u => u.email === email.toLowerCase());
      if (!user) throw new Error('E-Mail nicht gefunden.');
      var hash = await this.hashPassword(password, user.salt);
      if (hash !== user.hash) throw new Error('Falsches Passwort.');
      var session = {
        userId: user.id, email: user.email, name: user.name, role: user.role,
        expires: Date.now() + SESSION_DURATION_MS, mode: 'local'
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    },

    logout() { localStorage.removeItem(SESSION_KEY); },

    getSession() {
      try {
        var sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!sess) return null;
        if (sess.expires && sess.expires < Date.now()) {
          localStorage.removeItem(SESSION_KEY); return null;
        }
        return sess;
      } catch(e) { return null; }
    },

    async changePassword(oldPwd, newPwd) {
      var sess = this.getSession();
      if (!sess) throw new Error('Nicht angemeldet.');
      var users = this.getUsers();
      var user = users.find(u => u.id === sess.userId);
      if (!user) throw new Error('Benutzer nicht gefunden.');
      var oldHash = await this.hashPassword(oldPwd, user.salt);
      if (oldHash !== user.hash) throw new Error('Falsches aktuelles Passwort.');
      user.salt = this.generateSalt();
      user.hash = await this.hashPassword(newPwd, user.salt);
      this.saveUsers(users);
    },

    listUsers() {
      return this.getUsers().map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, created: u.created }));
    }
  };

  // ── API Implementation ──
  var apiImpl = {
    async register(email, password, name) {
      var resp = await apiCall('/auth/register', {
        method: 'POST', noAuth: true,
        body: { email: email, password: password, name: name }
      });
      this._storeSession(resp);
      return this.getSession();
    },
    async login(email, password) {
      var resp = await apiCall('/auth/login', {
        method: 'POST', noAuth: true,
        body: { email: email, password: password }
      });
      this._storeSession(resp);
      return this.getSession();
    },
    _storeSession(resp) {
      localStorage.setItem(TOKEN_KEY, resp.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        userId: resp.user.id, email: resp.user.email, name: resp.user.name,
        role: resp.user.role, mode: 'api',
        expires: Date.now() + SESSION_DURATION_MS
      }));
    },
    async logout() {
      try { await apiCall('/auth/logout', { method: 'POST' }); } catch(e) {}
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
    },
    getSession() {
      try {
        var sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!sess) return null;
        if (sess.expires && sess.expires < Date.now()) {
          localStorage.removeItem(SESSION_KEY); localStorage.removeItem(TOKEN_KEY);
          return null;
        }
        return sess;
      } catch(e) { return null; }
    },
    async changePassword(oldPwd, newPwd) {
      await apiCall('/auth/change-password', {
        method: 'POST', body: { oldPassword: oldPwd, newPassword: newPwd }
      });
    },
    async listUsers() {
      var resp = await apiCall('/users');
      return resp.users || [];
    }
  };

  function impl() { return isApiMode() ? apiImpl : localImpl; }

  return {
    isApiMode: isApiMode,
    getApiBase: getApiBase,
    register: function(email, password, name) {
      if (!email || !email.includes('@')) throw new Error('Bitte gültige E-Mail.');
      if (!password || password.length < 10) throw new Error('Passwort min. 10 Zeichen.');
      if (!name) throw new Error('Bitte Name angeben.');
      return impl().register(email, password, name);
    },
    login: function(email, password) {
      if (!email || !password) throw new Error('E-Mail und Passwort erforderlich.');
      return impl().login(email, password);
    },
    logout: function() { return impl().logout(); },
    getSession: function() { return impl().getSession(); },
    isLoggedIn: function() { return this.getSession() !== null; },
    changePassword: function(oldPwd, newPwd) {
      if (!newPwd || newPwd.length < 10) throw new Error('Neues Passwort min. 10 Zeichen.');
      return impl().changePassword(oldPwd, newPwd);
    },
    getUsers: function() { return impl().listUsers ? impl().listUsers() : []; },
    getStorageKey: function(suffix) {
      var sess = this.getSession();
      var prefix = sess ? 'ji_u_' + sess.userId + '_' : 'ji_';
      return prefix + suffix;
    },
    apiCall: apiCall
  };
})();

// ═══ AUTH UI ═══
function showAuthModal(mode) {
  mode = mode || 'login';
  var existing = document.getElementById('auth-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-overlay-v39';
  modal.innerHTML =
    // V39: Hintergrund-Glow + dezenter App-Vorschau-Layer
    '<div class="auth-bg-v39">' +
      '<div class="auth-bg-glow"></div>' +
      '<div class="auth-bg-coming">COMING SOON</div>' +
    '</div>' +

    // ── Login-Card ────────────────────────────────
    '<div class="auth-card-v39" role="dialog" aria-labelledby="auth-title">' +
      // Logo-Kopf mit goldener Welle
      '<div class="auth-logo-v39">' +
        '<div class="auth-logo-wave">' +
          '<svg viewBox="0 0 320 100" preserveAspectRatio="none" aria-hidden="true">' +
            '<defs>' +
              '<linearGradient id="logoWaveGrad" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0%" stop-color="#C9A84C" stop-opacity="0"/>' +
                '<stop offset="50%" stop-color="#E0BB5C" stop-opacity="0.95"/>' +
                '<stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/>' +
              '</linearGradient>' +
            '</defs>' +
            '<path d="M0,50 C 60,20 110,80 160,50 C 210,20 260,80 320,50" stroke="url(#logoWaveGrad)" stroke-width="2" fill="none"/>' +
            '<path d="M0,55 C 70,30 120,80 160,55 C 200,30 260,75 320,55" stroke="url(#logoWaveGrad)" stroke-width="1" fill="none" opacity="0.6"/>' +
          '</svg>' +
        '</div>' +
        '<div class="auth-logo-text">' +
          '<span class="auth-logo-deal">Deal</span><span class="auth-logo-pilot">Pilot</span>' +
        '</div>' +
        '<div class="auth-logo-by">by Junker Immobilien</div>' +
      '</div>' +

      '<h2 id="auth-title" class="auth-title-v39">Willkommen zurück</h2>' +
      '<p class="auth-sub-v39">Melde dich an, um deine<br>Immobilien-Analysen fortzusetzen.</p>' +

      '<div class="auth-form-v39">' +
        '<div class="auth-field-v39">' +
          '<label for="auth-email">E-Mail</label>' +
          '<div class="auth-input-wrap">' +
            '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">' +
              '<rect x="3" y="5" width="18" height="14" rx="2.5"/>' +
              '<path d="M3 7l9 6 9-6"/>' +
            '</svg>' +
            '<input type="email" id="auth-email" placeholder="name@firma.de" autocomplete="email" required>' +
          '</div>' +
        '</div>' +

        '<div class="auth-field-v39">' +
          '<label for="auth-password">Passwort</label>' +
          '<div class="auth-input-wrap">' +
            '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">' +
              '<rect x="4" y="11" width="16" height="10" rx="2"/>' +
              '<path d="M8 11V7a4 4 0 0 1 8 0v4"/>' +
            '</svg>' +
            '<input type="password" id="auth-password" placeholder="Mindestens 10 Zeichen" autocomplete="current-password" required>' +
            '<button type="button" class="auth-eye-btn" id="auth-eye" tabindex="-1" aria-label="Passwort anzeigen">' +
              '<svg class="auth-eye-icon-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">' +
                '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>' +
                '<circle cx="12" cy="12" r="2.5"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<div id="auth-error" class="auth-error-v39" style="display:none"></div>' +

        '<button class="auth-btn-v39" id="auth-submit" type="button">' +
          '<span>Anmelden</span>' +
          '<span class="auth-btn-arrow">→</span>' +
        '</button>' +

        // V42: Passwort-vergessen jetzt aktiv
        '<div class="auth-forgot-v39">' +
          '<button type="button" class="auth-link" onclick="showPasswordReset()">' +
            'Passwort vergessen?' +
          '</button>' +
        '</div>' +

        // V39: Trennlinie + Aktions-Buttons darunter
        '<div class="auth-divider-v39"><span>oder</span></div>' +

        // Beta-Tester (prominent goldener Button — keine Durchstreichung mehr)
        '<button type="button" class="auth-beta-v39" onclick="showBetaSignup()">' +
          '<span class="auth-beta-icon">✨</span>' +
          '<span>Beta-Tester werden</span>' +
        '</button>' +

        // V42: Registrieren-Button — kommt bald
        '<button type="button" class="auth-register-v39" onclick="_v10OpenRegister()" title="Konto erstellen">' +
          'Konto erstellen' +
        '</button>' +

        // Footer: Sicher / DSGVO
        '<div class="auth-footer-v39">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">' +
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
          '</svg>' +
          '<span>Sicher. Verschlüsselt. DSGVO-konform.</span>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // Submit
  document.getElementById('auth-submit').addEventListener('click', function() { handleAuthSubmit('login'); });
  modal.querySelectorAll('input').forEach(function(inp) {
    inp.addEventListener('keypress', function(e) { if (e.key === 'Enter') handleAuthSubmit('login'); });
  });

  // V39: Eye-Toggle für Passwort
  var eyeBtn = document.getElementById('auth-eye');
  var pwInput = document.getElementById('auth-password');
  if (eyeBtn && pwInput) {
    eyeBtn.addEventListener('click', function() {
      var isHidden = pwInput.type === 'password';
      pwInput.type = isHidden ? 'text' : 'password';
      eyeBtn.classList.toggle('auth-eye-active', isHidden);
      eyeBtn.setAttribute('aria-label', isHidden ? 'Passwort verbergen' : 'Passwort anzeigen');
    });
  }

  setTimeout(function() {
    var firstField = document.getElementById('auth-email');
    if (firstField) firstField.focus();
  }, 100);
}

// V30: _heroFeature entfernt — Hero ist jetzt das Werbebild als <img>.


async function handleAuthSubmit(mode) {
  var errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';
  var btn = document.getElementById('auth-submit');
  btn.disabled = true;
  btn.textContent = '⏳ Bitte warten...';
  try {
    var email = document.getElementById('auth-email').value.trim();
    var password = document.getElementById('auth-password').value;
    var session;
    if (mode === 'register') {
      var name = document.getElementById('auth-name').value.trim();
      session = await Auth.register(email, password, name);
    } else {
      session = await Auth.login(email, password);
    }
    document.getElementById('auth-modal').remove();
    if (typeof toast === 'function') toast('✓ Willkommen, ' + session.name);

    // V185: Plan + Feature-Gates SOFORT nach Login laden (sonst zeigt UI free für 1-2 Sek)
    if (typeof Sub !== 'undefined' && typeof Sub.getCurrent === 'function') {
      try {
        await Sub.getCurrent(true);  // forceFresh
      } catch(e) { console.warn('[auth V185] Sub.getCurrent fehlgeschlagen:', e); }
    }
    if (typeof window.AiCredits !== 'undefined' && typeof window.AiCredits.refresh === 'function') {
      try { window.AiCredits.refresh(true); } catch(e) {}
    }

    if (typeof onLoginSuccess === 'function') onLoginSuccess(session);
  } catch(e) {
    errEl.textContent = '⚠ ' + e.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = mode === 'register' ? 'Registrieren' : 'Anmelden';
  }
}

async function logout() {
  if (!confirm('Wirklich abmelden?')) return;
  await Auth.logout();
  location.reload();
}

function initAuth() {
  var session = Auth.getSession();
  if (!session) {
    // V37: Konto-Erstellung deaktiviert — immer Login-Modus.
    // Demo-User existiert über Backend-Seed oder muss vom Admin angelegt werden.
    showAuthModal('login');
    return false;
  } else {
    updateUserDisplay(session);
    return true;
  }
}

function updateUserDisplay(session) {
  var footer = document.querySelector('.sb-footer');
  if (footer && !document.getElementById('sb-user')) {
    var userBox = document.createElement('div');
    userBox.id = 'sb-user';
    userBox.className = 'sb-user-box';
    var modeBadge = session.mode === 'api'
      ? '<span class="sb-mode-badge api" title="Backend verbunden">☁</span>'
      : '<span class="sb-mode-badge local" title="Lokaler Modus">📦</span>';

    // V177: 3 direkte Icons (kein Submenü mehr) — Account / Plan / Abmelden
    userBox.innerHTML =
      '<div class="sb-user-main" style="display:flex;align-items:center;gap:10px;padding:10px 12px">' +
        '<div class="sb-user-avatar">' + (session.name ? session.name.charAt(0).toUpperCase() : '?') + '</div>' +
        '<div class="sb-user-text" style="flex:1;min-width:0">' +
          '<div class="sb-user-name">' + session.name + ' ' + modeBadge + '</div>' +
          '<div class="sb-user-email">' + session.email + '</div>' +
        '</div>' +

        // V178: 2 Icon-Buttons direkt nebeneinander (wie im Original-Bild)
        '<div class="sb-user-icons" style="display:flex;gap:6px;align-items:center;flex-shrink:0">' +

          // Icon 1: Aktueller Plan (Häkchen im Kreis) → öffnet Settings → Plan-Tab
          '<button type="button" class="sb-user-icon-btn" ' +
                  'onclick="openUpgradeFromMenu()" ' +
                  'title="Aktueller Plan" aria-label="Aktueller Plan" ' +
                  'style="background:transparent;border:1px solid rgba(255,255,255,0.12);' +
                         'color:#C9A84C;width:34px;height:34px;border-radius:8px;cursor:pointer;' +
                         'display:flex;align-items:center;justify-content:center;padding:0;transition:background 0.15s">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"/>' +
              '<polyline points="8 12 11 15 16 9"/>' +
            '</svg>' +
          '</button>' +

          // Icon 2: Abmelden (Pfeil-aus-Box)
          '<button type="button" class="sb-user-icon-btn" ' +
                  'onclick="logout()" ' +
                  'title="Abmelden" aria-label="Abmelden" ' +
                  'style="background:transparent;border:1px solid rgba(255,255,255,0.12);' +
                         'color:#C9A84C;width:34px;height:34px;border-radius:8px;cursor:pointer;' +
                         'display:flex;align-items:center;justify-content:center;padding:0;transition:background 0.15s">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
              '<polyline points="16 17 21 12 16 7"/>' +
              '<line x1="21" y1="12" x2="9" y2="12"/>' +
            '</svg>' +
          '</button>' +

        '</div>' +
      '</div>';

    footer.parentNode.insertBefore(userBox, footer);

    // V177: Hover-Effekt per JS (inline styles brauchen das so)
    userBox.querySelectorAll('.sb-user-icon-btn').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        btn.style.background = 'rgba(201,168,76,0.12)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.background = 'transparent';
      });
    });
  }
}

// V177: Legacy-Submenu-Funktionen — bleiben definiert für Rückwärtskompatibilität
// aber tun nichts mehr (Submenu existiert nicht mehr im DOM)
function toggleUserMenu(e) { /* V177: noop — kein Submenu mehr */ }
function closeUserMenu() { /* V177: noop */ }

window.toggleUserMenu = toggleUserMenu;
window.closeUserMenu = closeUserMenu;

// V175: Plan-Wechsel aus User-Menü → öffnet das Upgrade-Modal (siehe upgrade-cta.js)
// V176: Statt Upgrade-Modal → Settings-Modal mit Plan-Tab (echte Plan-Übersicht)
function openUpgradeFromMenu() {
  closeUserMenu();
  if (typeof showSettings === 'function') {
    showSettings();
    // Plan-Tab aktivieren nach DOM-Ready
    setTimeout(function () {
      var planTab = document.querySelector('.st-tab[data-tab="plan"]');
      if (planTab) {
        planTab.click();
      } else if (typeof _swSet === 'function') {
        var tabBtn = document.querySelector('[data-tab="plan"]');
        if (tabBtn) _swSet(tabBtn);
      }
    }, 100);
  } else {
    alert('Settings nicht verfügbar — bitte Seite neu laden.');
  }
}
window.openUpgradeFromMenu = openUpgradeFromMenu;

// V177: Account-Icon → Settings-Modal auf Tab "Persönlich"
function openAccountFromMenu() {
  if (typeof showSettings === 'function') {
    showSettings();
    setTimeout(function () {
      // Tab-Switcher kann verschiedene IDs haben — wir probieren mehrere
      var tab = document.querySelector('.st-tab[data-tab="personal"]') ||
                document.querySelector('.st-tab[data-tab="profile"]') ||
                document.querySelector('.st-tab[data-tab="account"]');
      if (tab) {
        tab.click();
      }
      // Wenn keiner gefunden wird: Settings öffnet sich trotzdem auf dem Default-Tab
    }, 100);
  } else {
    alert('Account-Einstellungen nicht verfügbar.');
  }
}
window.openAccountFromMenu = openAccountFromMenu;

/* ═══════════════════════════════════════════════════════════════
   V37: Beta-Tester-Anmelde-Formular
   Sendet Anfrage an Backend → POST /api/v1/beta-signup
═══════════════════════════════════════════════════════════════ */

function showBetaSignup() {
  // Existierendes Modal entfernen falls schon offen
  var existing = document.getElementById('beta-signup-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'beta-signup-modal';
  modal.className = 'beta-overlay';
  modal.innerHTML =
    '<div class="beta-modal" role="dialog" aria-labelledby="beta-title">' +
      '<button class="beta-close" type="button" aria-label="Schließen" onclick="closeBetaSignup()">×</button>' +
      '<div class="beta-header">' +
        '<div class="beta-icon"></div>' +
        '<h3 id="beta-title">Beta-Tester werden</h3>' +
        '<div class="beta-sub">Sei einer der Ersten und teste DealPilot vor dem offiziellen Launch.</div>' +
      '</div>' +
      '<form class="beta-form" id="beta-form" onsubmit="event.preventDefault(); submitBetaSignup();">' +
        '<div class="beta-field">' +
          '<label>Name</label>' +
          '<input type="text" id="beta-name" placeholder="Max Mustermann" required autocomplete="name">' +
        '</div>' +
        '<div class="beta-field">' +
          '<label>E-Mail-Adresse</label>' +
          '<input type="email" id="beta-email" placeholder="name@firma.de" required autocomplete="email">' +
        '</div>' +
        '<div class="beta-field beta-field-msg">' +
          '<label>Nachricht <span class="beta-optional">(optional)</span></label>' +
          '<textarea id="beta-msg" rows="3" placeholder="Was interessiert dich an DealPilot? Welche Funktionen sind dir wichtig?"></textarea>' +
        '</div>' +
        // Honeypot — versteckt für User, Bots tragen meist alles aus
        '<div class="beta-hp" aria-hidden="true">' +
          '<label>Website</label><input type="text" id="beta-hp" tabindex="-1" autocomplete="off">' +
        '</div>' +
        '<div id="beta-error" class="beta-error" style="display:none"></div>' +
        '<div id="beta-success" class="beta-success" style="display:none"></div>' +
        '<div class="beta-actions">' +
          '<button type="button" class="btn btn-ghost" onclick="closeBetaSignup()">Abbrechen</button>' +
          '<button type="submit" class="btn btn-gold" id="beta-submit">Anfrage senden</button>' +
        '</div>' +
        '<div class="beta-note">Mit dem Absenden willigst du ein, dass wir dich per E-Mail kontaktieren. Keine Weitergabe an Dritte.</div>' +
      '</form>' +
    '</div>';
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeBetaSignup();
  });
  document.body.appendChild(modal);

  // Sparkles-Icon einsetzen
  var iconBox = modal.querySelector('.beta-icon');
  if (iconBox && window.Icons && window.Icons.sparkles) {
    iconBox.innerHTML = window.Icons.sparkles({ size: 28 });
  }
  setTimeout(function() {
    var f = document.getElementById('beta-name');
    if (f) f.focus();
  }, 100);
}

function closeBetaSignup() {
  var m = document.getElementById('beta-signup-modal');
  if (m) m.remove();
}

async function submitBetaSignup() {
  var btn   = document.getElementById('beta-submit');
  var errEl = document.getElementById('beta-error');
  var okEl  = document.getElementById('beta-success');
  errEl.style.display = 'none';
  okEl.style.display = 'none';

  var name  = (document.getElementById('beta-name')  || {}).value || '';
  var email = (document.getElementById('beta-email') || {}).value || '';
  var msg   = (document.getElementById('beta-msg')   || {}).value || '';
  var hp    = (document.getElementById('beta-hp')    || {}).value || '';
  name = name.trim(); email = email.trim().toLowerCase(); msg = msg.trim();

  // Client-side Validierung
  if (!name || name.length < 2) {
    errEl.textContent = '⚠ Bitte gib deinen Namen ein (mindestens 2 Zeichen).';
    errEl.style.display = 'block';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = '⚠ Bitte gib eine gültige E-Mail-Adresse ein.';
    errEl.style.display = 'block';
    return;
  }
  if (msg.length > 1000) {
    errEl.textContent = '⚠ Nachricht zu lang (max. 1000 Zeichen).';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Wird gesendet…';

  try {
    var resp = await fetch('/api/v1/beta-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, message: msg, hp: hp })
    });
    var data;
    try { data = await resp.json(); } catch(e) { data = {}; }
    if (!resp.ok) {
      throw new Error(data.error || ('HTTP ' + resp.status));
    }
    okEl.innerHTML = '✓ Vielen Dank! Wir haben deine Anfrage erhalten und melden uns in Kürze bei dir.';
    okEl.style.display = 'block';
    btn.style.display = 'none';
    document.getElementById('beta-form').querySelectorAll('input,textarea').forEach(function(i) { i.disabled = true; });
    // Modal nach 4s automatisch schließen
    setTimeout(closeBetaSignup, 4000);
  } catch (err) {
    errEl.textContent = '⚠ ' + (err.message || 'Anfrage konnte nicht gesendet werden.');
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Anfrage senden';
  }
}

window.showBetaSignup   = showBetaSignup;
window.closeBetaSignup  = closeBetaSignup;
window.submitBetaSignup = submitBetaSignup;

/* ═══════════════════════════════════════════════════════════════
   V42: Passwort vergessen — Modal + Reset-Request
═══════════════════════════════════════════════════════════════ */
function showPasswordReset() {
  var existing = document.getElementById('pw-reset-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'pw-reset-modal';
  modal.className = 'auth-overlay-v39';
  modal.style.zIndex = '10100';
  modal.innerHTML =
    '<div class="auth-card-v39" style="max-width:380px;animation:none">' +
      '<div class="auth-logo-v39"><div class="auth-logo-text"><span class="auth-logo-deal">Deal</span><span class="auth-logo-pilot">Pilot</span></div></div>' +
      '<h2 class="auth-title-v39" style="font-size:18px">Passwort zurücksetzen</h2>' +
      '<p class="auth-sub-v39" style="font-size:12.5px">Trag deine E-Mail-Adresse ein. Wir schicken dir einen Reset-Link.</p>' +
      '<div class="auth-form-v39">' +
        '<div class="auth-input-wrap">' +
          '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' +
            '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
            '<polyline points="22,6 12,13 2,6"/>' +
          '</svg>' +
          '<input type="email" id="pw-reset-email" placeholder="deine@email.de" autocomplete="email" autofocus>' +
        '</div>' +
        '<button type="button" class="auth-btn-v39" id="pw-reset-submit" onclick="handlePwReset()">' +
          '<span>Reset-Link anfordern</span>' +
          '<span class="auth-btn-arrow">→</span>' +
        '</button>' +
        '<button type="button" class="auth-link" style="margin-top:8px" onclick="document.getElementById(\'pw-reset-modal\').remove()">Zurück zum Login</button>' +
      '</div>' +
      '<div id="pw-reset-msg" style="margin-top:12px;font-size:12px;text-align:center;display:none"></div>' +
    '</div>';
  document.body.appendChild(modal);
}

async function handlePwReset() {
  var email = (document.getElementById('pw-reset-email').value || '').trim();
  var msg = document.getElementById('pw-reset-msg');
  var btn = document.getElementById('pw-reset-submit');
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    msg.style.display = 'block';
    msg.style.color = '#DDA29E';
    msg.textContent = 'Bitte gültige E-Mail eingeben.';
    return;
  }
  btn.disabled = true;
  btn.querySelector('span:first-child').textContent = 'Sende…';
  try {
    var resp = await fetch('/api/v1/auth/password-reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    });
    // Aus Sicherheitsgründen IMMER selbe Antwort, egal ob User existiert
    msg.style.display = 'block';
    msg.style.color = '#6FCB91';
    msg.textContent = 'Falls die E-Mail registriert ist, ist eine Reset-Anleitung unterwegs. Bitte Posteingang prüfen.';
    btn.querySelector('span:first-child').textContent = 'Erneut senden';
    btn.disabled = false;
  } catch(e) {
    msg.style.display = 'block';
    msg.style.color = '#DDA29E';
    msg.textContent = 'Fehler beim Senden — bitte später erneut versuchen.';
    btn.disabled = false;
    btn.querySelector('span:first-child').textContent = 'Reset-Link anfordern';
  }
}

window.showPasswordReset = showPasswordReset;
window.handlePwReset = handlePwReset;

/* ═══════════════════════════════════════════════════════════════
   V42: Reset-Token aus URL erkennen → Reset-Form öffnen
═══════════════════════════════════════════════════════════════ */
(function() {
  function checkResetToken() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('reset');
    if (!token) return;
    showPasswordResetForm(token);
    // Token aus URL entfernen
    history.replaceState(null, '', window.location.pathname);
  }

  function showPasswordResetForm(token) {
    var existing = document.getElementById('pw-reset-form-modal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'pw-reset-form-modal';
    modal.className = 'auth-overlay-v39';
    modal.style.zIndex = '10100';
    modal.innerHTML =
      '<div class="auth-card-v39" style="max-width:380px;animation:none">' +
        '<div class="auth-logo-v39"><div class="auth-logo-text"><span class="auth-logo-deal">Deal</span><span class="auth-logo-pilot">Pilot</span></div></div>' +
        '<h2 class="auth-title-v39" style="font-size:18px">Neues Passwort setzen</h2>' +
        '<p class="auth-sub-v39" style="font-size:12.5px">Trag dein neues Passwort ein. Mindestens 10 Zeichen.</p>' +
        '<div class="auth-form-v39">' +
          '<div class="auth-input-wrap">' +
            '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' +
              '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
            '</svg>' +
            '<input type="password" id="pw-new" placeholder="Neues Passwort (min 10 Zeichen)" autocomplete="new-password" autofocus>' +
          '</div>' +
          '<div class="auth-input-wrap">' +
            '<svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' +
              '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
            '</svg>' +
            '<input type="password" id="pw-new-confirm" placeholder="Neues Passwort wiederholen" autocomplete="new-password">' +
          '</div>' +
          '<button type="button" class="auth-btn-v39" id="pw-confirm-submit" onclick="handlePwResetConfirm(\'' + token + '\')">' +
            '<span>Passwort speichern</span>' +
          '</button>' +
        '</div>' +
        '<div id="pw-confirm-msg" style="margin-top:12px;font-size:12px;text-align:center;display:none"></div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  async function handlePwResetConfirm(token) {
    var pw1 = document.getElementById('pw-new').value;
    var pw2 = document.getElementById('pw-new-confirm').value;
    var msg = document.getElementById('pw-confirm-msg');
    msg.style.display = 'block';
    if (!pw1 || pw1.length < 6) {
      msg.style.color = '#DDA29E';
      msg.textContent = 'Passwort muss mindestens 10 Zeichen haben.';
      return;
    }
    if (pw1 !== pw2) {
      msg.style.color = '#DDA29E';
      msg.textContent = 'Die Passwörter stimmen nicht überein.';
      return;
    }
    var btn = document.getElementById('pw-confirm-submit');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Speichere…';
    try {
      var resp = await fetch('/api/v1/auth/password-reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, newPassword: pw1 })
      });
      if (resp.ok) {
        msg.style.color = '#6FCB91';
        msg.textContent = '✓ Passwort gespeichert. Du kannst dich jetzt anmelden.';
        setTimeout(function() {
          document.getElementById('pw-reset-form-modal').remove();
        }, 2500);
      } else {
        var err = await resp.json().catch(function(){ return {}; });
        msg.style.color = '#DDA29E';
        msg.textContent = err.error || 'Fehler — Token ungültig oder abgelaufen. Bitte erneut anfordern.';
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Passwort speichern';
      }
    } catch(e) {
      msg.style.color = '#DDA29E';
      msg.textContent = 'Netzwerk-Fehler.';
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Passwort speichern';
    }
  }

  window.handlePwResetConfirm = handlePwResetConfirm;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkResetToken);
  } else {
    setTimeout(checkResetToken, 50);
  }
})();

/* V10_KONTO_BUTTON_PATCHED — Helper für den Button-Click */
function _v10OpenRegister() {
  var m = document.getElementById('auth-modal');
  if (m) m.remove();
  setTimeout(function() {
    if (window.RegisterModal && RegisterModal.show) RegisterModal.show();
    else if (typeof showRegisterModal === 'function') showRegisterModal();
  }, 80);
}
