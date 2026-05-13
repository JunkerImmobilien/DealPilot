/**
 * V156 — Auto-401-Handler für Auth.apiCall
 * ═════════════════════════════════════════════════════════════════
 *
 * Problem: Backend-JWT läuft schneller ab als Frontend-Session.
 * Beispiel: JWT gültig 1h, Frontend-Session 24h. Nach 1h Aktivität
 * antwortet jeder API-Call mit HTTP 401, obwohl Frontend "weiß"
 * dass User eingeloggt ist.
 *
 * Symptom für User: "Server zurzeit nicht erreichbar (HTTP 401)" beim
 * Speichern/Senden — Aktion geht verloren, User-Frust.
 *
 * Lösung: Auth.apiCall wird gewrappt. Bei 401:
 *   1. Original-Request wird zurückgehalten (Promise pending)
 *   2. Login-Modal öffnet sich
 *   3. User logged sich neu ein
 *   4. Original-Request wird automatisch wiederholt
 *   5. User sieht nur kurzen Re-Login statt verlorene Aktion
 *
 * Wird nach auth.js geladen und monkey-patched Auth.apiCall.
 */
(function () {
  'use strict';

  if (!window.Auth || typeof window.Auth.apiCall !== 'function') {
    console.warn('[401-handler] Auth.apiCall nicht gefunden — Handler nicht installiert');
    return;
  }

  // Original speichern für Retry
  var originalApiCall = window.Auth.apiCall.bind(window.Auth);

  // Globaler Re-Login-Promise — wenn Re-Login läuft, warten alle Requests
  var pendingReloginPromise = null;

  // Anti-Loop: wenn /auth/login selbst 401 gibt, nicht endlos retryen
  function isAuthEndpoint(path) {
    return /^\/auth\/(login|register|logout|change-password|reset-password)/.test(path);
  }

  // Re-Login-Flow: Modal anzeigen, auf Erfolg warten
  function triggerReLogin() {
    if (pendingReloginPromise) return pendingReloginPromise;

    pendingReloginPromise = new Promise(function (resolve, reject) {
      // Session-Daten löschen damit getSession() null gibt
      try {
        localStorage.removeItem('ji_token');
        localStorage.removeItem('ji_session');
      } catch (e) {}

      if (typeof window.showAuthModal !== 'function') {
        reject(new Error('Re-Login nicht möglich — showAuthModal fehlt. Bitte Seite neu laden.'));
        return;
      }

      // V157: Statt aufdringlichem Banner im Modal → dezenter Toast oben rechts.
      // Das Login-Modal bleibt sauber wie beim normalen Login.
      var existingToast = document.getElementById('reauth-toast');
      if (existingToast) existingToast.remove();
      var toast = document.createElement('div');
      toast.id = 'reauth-toast';
      toast.style.cssText =
        'position:fixed;top:20px;right:20px;z-index:10000;' +
        'background:rgba(42,39,39,0.92);color:#F8F6F1;' +
        'padding:10px 16px;border-radius:6px;' +
        'border-left:3px solid #C9A84C;' +
        'font-size:12px;line-height:1.4;max-width:300px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.25);' +
        'backdrop-filter:blur(6px);' +
        'animation:reauthToastIn 0.3s ease-out';
      toast.innerHTML =
        '<style>@keyframes reauthToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}</style>' +
        '<div style="color:#C9A84C;font-weight:600;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px">Sitzung abgelaufen</div>' +
        '<div>Letzte Aktion wird nach Login automatisch fortgesetzt.</div>';
      document.body.appendChild(toast);

      // Modal mit dem Login öffnen — OHNE Banner im Modal
      window.showAuthModal('login');

      // MutationObserver: wenn das Modal entfernt wird (= Login erfolgreich
      // oder User schließt) → resolve/reject
      var modal = document.getElementById('auth-modal');
      if (!modal) {
        reject(new Error('Login-Modal konnte nicht geöffnet werden.'));
        return;
      }

      var modalObserver = new MutationObserver(function () {
        if (!document.getElementById('auth-modal')) {
          modalObserver.disconnect();
          // V157: Toast wieder entfernen (egal ob erfolgreich oder abgebrochen)
          var t = document.getElementById('reauth-toast');
          if (t) {
            t.style.animation = 'reauthToastIn 0.2s reverse';
            setTimeout(function () { if (t.parentNode) t.remove(); }, 220);
          }
          // Prüfen ob Login erfolgreich war
          var token = localStorage.getItem('ji_token');
          if (token) {
            console.log('[401-handler] ✓ Re-Login erfolgreich — Request wird wiederholt');
            resolve();
          } else {
            console.warn('[401-handler] Re-Login abgebrochen oder fehlgeschlagen');
            reject(new Error('Re-Login abgebrochen.'));
          }
        }
      });
      modalObserver.observe(document.body, { childList: true, subtree: false });

      // Timeout-Safety: nach 5 Min Re-Login-Versuch abbrechen
      setTimeout(function () {
        if (document.getElementById('auth-modal')) {
          modalObserver.disconnect();
          var t = document.getElementById('reauth-toast');
          if (t && t.parentNode) t.remove();
          reject(new Error('Re-Login-Zeitüberschreitung (5 Min).'));
        }
      }, 5 * 60 * 1000);
    });

    // Nach Erfolg/Misserfolg: Slot freigeben
    pendingReloginPromise.then(
      function () { pendingReloginPromise = null; },
      function () { pendingReloginPromise = null; }
    );

    return pendingReloginPromise;
  }

  // Gewrappte apiCall
  window.Auth.apiCall = async function patchedApiCall(path, options) {
    options = options || {};
    try {
      return await originalApiCall(path, options);
    } catch (err) {
      // Nur bei 401, und nicht bei Auth-Endpoints selbst
      var is401 = err && (err.status === 401 ||
        (err.message && /HTTP 401|401/.test(err.message)));
      if (!is401 || isAuthEndpoint(path) || options.noAuth) {
        throw err;
      }
      // Anti-Doppel-Retry: einmal ist genug
      if (options._v156_retried) {
        console.warn('[401-handler] Auch nach Re-Login wieder 401 — gebe auf');
        throw err;
      }

      console.log('[401-handler] 401 erkannt für', path, '— starte Re-Login-Flow');

      try {
        await triggerReLogin();
      } catch (reloginErr) {
        console.error('[401-handler] Re-Login fehlgeschlagen:', reloginErr);
        throw err;  // ursprünglichen 401 weiterleiten
      }

      // Re-Login OK — Original-Request mit Retry-Flag wiederholen
      var retryOptions = Object.assign({}, options, { _v156_retried: true });
      return await originalApiCall(path, retryOptions);
    }
  };

  console.log('[401-handler] V156 installiert — Auto-Re-Login bei abgelaufenem Token aktiv');
})();
