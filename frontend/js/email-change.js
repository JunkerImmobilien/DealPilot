'use strict';
/*
 * email-change.js (v774) — E-Mail-Adresse ändern (verify-before-active).
 * - Toggle + Submit-Logik fürs Settings-Feld (#dp-email-change-box).
 * - Verarbeitet Redirect-Parameter nach dem Bestätigungs-Klick:
 *     ?email_changed=1        -> Token verwerfen (Re-Login erzwingen) + Hinweis
 *     ?email_change_error=... -> Fehlermeldung
 */
(function () {
  function $(id) { return document.getElementById(id); }

  function _toast(msg, ok) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    try { alert(msg); } catch (e) {}
  }

  window._dpEmailChangeToggle = function () {
    var box = $('dp-email-change-box');
    if (!box) return;
    box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none';
  };

  window._dpEmailChangeSubmit = async function () {
    var neEl = $('dp-ec-new'), pwEl = $('dp-ec-pw'), msg = $('dp-ec-msg');
    var ne = (neEl && neEl.value ? neEl.value : '').trim();
    var pw = (pwEl && pwEl.value ? pwEl.value : '');
    function show(t, color) { if (msg) { msg.textContent = t; msg.style.color = color || '#B86250'; } }

    if (!ne || ne.indexOf('@') < 1) { show('Bitte eine gültige E-Mail-Adresse eingeben.'); return; }
    if (!pw) { show('Bitte dein aktuelles Passwort eingeben.'); return; }
    show('Sende Bestätigungslink …', '#8a8473');

    try {
      if (typeof Auth === 'undefined' || !Auth.apiCall) { show('Nur im Online-Modus verfügbar.'); return; }
      await Auth.apiCall('/auth/change-email', { method: 'POST', body: { newEmail: ne, password: pw } });
      show('\u2713 Bestätigungslink an ' + ne + ' gesendet. Bitte dort klicken \u2014 danach mit der neuen Adresse neu anmelden.', '#3FA56C');
      if (pwEl) pwEl.value = '';
    } catch (e) {
      var m = (e && (e.message || e.error)) || 'Fehler beim Senden';
      if (/already|registered|409|vergeben|taken/i.test(m)) m = 'Diese E-Mail ist bereits vergeben.';
      else if (/passwort|password|401|403/i.test(m)) m = 'Aktuelles Passwort ist falsch.';
      else if (/aktuelle/i.test(m)) m = 'Das ist bereits deine aktuelle Adresse.';
      show('\u26a0 ' + m);
    }
  };

  // Redirect-Parameter nach dem Bestätigungs-Klick
  function _handleRedirectParams() {
    try {
      var p = new URLSearchParams(window.location.search || '');
      if (p.get('email_changed') === '1') {
        try { localStorage.removeItem('ji_token'); } catch (e) {}
        setTimeout(function () { _toast('\u2713 E-Mail geändert \u2014 bitte mit der neuen Adresse neu anmelden.'); }, 500);
        try { history.replaceState({}, '', window.location.pathname); } catch (e) {}
      } else if (p.get('email_change_error')) {
        var er = p.get('email_change_error');
        var m = er === 'taken' ? 'E-Mail ist inzwischen vergeben.'
              : er === 'invalid' ? 'Bestätigungslink ungültig oder abgelaufen.'
              : 'E-Mail-Wechsel fehlgeschlagen.';
        setTimeout(function () { _toast('\u26a0 ' + m); }, 500);
        try { history.replaceState({}, '', window.location.pathname); } catch (e) {}
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _handleRedirectParams);
  else _handleRedirectParams();
})();
