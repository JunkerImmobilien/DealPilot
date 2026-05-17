// DealPilot Admin V195 — API-Wrapper
'use strict';

const API = (function() {
  const BASE = '/api/v1/admin';

  function getToken() {
    return localStorage.getItem('dp_admin_token') || '';
  }

  async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['X-Admin-Token'] = token;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const r = await fetch(BASE + path, opts);
    let data = null;
    try { data = await r.json(); } catch {}

    if (!r.ok) {
      const err = new Error((data && (data.message || data.error)) || `HTTP ${r.status}`);
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    // Auth
    login: (email, password, totpCode) => call('POST', '/auth/login', { email, password, totpCode }),
    me: () => call('GET', '/auth/me'),

    // Dashboard
    dashboard: () => call('GET', '/dashboard'),

    // Users
    listUsers: (query, limit, offset) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (limit) params.set('limit', limit);
      if (offset) params.set('offset', offset);
      return call('GET', '/users?' + params.toString());
    },
    getUser: (id) => call('GET', `/users/${id}`),
    createUser: (email, name, plan_id) => call('POST', '/users', { email, name, plan_id }),
    changePlan: (id, plan_id, billing_interval, reason) => call('POST', `/users/${id}/change-plan`, { plan_id, billing_interval, reason }),
    grantCredits: (id, amount, reason) => call('POST', `/users/${id}/grant-credits`, { amount, reason }),
    resetPassword: (id, reason) => call('POST', `/users/${id}/reset-password`, { reason }),
    toggleActive: (id, reason) => call('POST', `/users/${id}/toggle-active`, { reason }),
    deleteUser: (id, confirm_email, reason) => call('DELETE', `/users/${id}`, { confirm_email, reason }),

    // Audit
    auditLog: (action) => call('GET', '/audit-log' + (action ? `?action=${encodeURIComponent(action)}` : '')),

    // Plans
    listPlans: () => call('GET', '/plans')
  };
})();
