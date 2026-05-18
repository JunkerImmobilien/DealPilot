// DealPilot Admin V197 — Login-Logik
'use strict';

const Auth = (function() {
  const TOKEN_KEY = 'dp_admin_token';

  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function isLoggedIn() { return !!getToken(); }

  async function tryLogin(email, password, totpCode) {
    const r = await API.login(email, password, totpCode);
    if (r.requires_totp) return { requires_totp: true };
    if (r.token) {
      setToken(r.token);
      return { admin: r.admin };
    }
    throw new Error('unexpected_response');
  }

  function logout() {
    clearToken();
    location.reload();
  }

  return { tryLogin, logout, isLoggedIn, getToken, setToken };
})();
