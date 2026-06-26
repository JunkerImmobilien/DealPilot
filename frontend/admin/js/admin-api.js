// DealPilot Admin V197 — API-Wrapper
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

  async function downloadCsv(path, filename) {
    const token = getToken();
    const r = await fetch(BASE + path, {
      headers: token ? { 'X-Admin-Token': token } : {}
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

    async function fetchAttachmentUrl(id) {
      const token = getToken();
      const r = await fetch(BASE + '/attachments/' + id, { headers: token ? { 'X-Admin-Token': token } : {} });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    }
    function credits() { return call('GET', '/credits'); }
  function marktberichtCosts() { return call('GET', '/marktbericht-costs'); }

return {
    credits, marktberichtCosts,
    fetchAttachmentUrl,
    feedbackPeriod: (period) => call('GET', '/feedback?period=' + encodeURIComponent(period || 'all')),
    feedbackQuery: (q) => { q = q || {}; var p = []; if (q.period) p.push('period=' + encodeURIComponent(q.period)); if (q.from) p.push('from=' + encodeURIComponent(q.from)); if (q.to) p.push('to=' + encodeURIComponent(q.to)); return call('GET', '/feedback' + (p.length ? '?' + p.join('&') : '')); },
    feedbackCsv: (q) => { q = q || {}; var p = []; if (q.period) p.push('period=' + encodeURIComponent(q.period)); if (q.from) p.push('from=' + encodeURIComponent(q.from)); if (q.to) p.push('to=' + encodeURIComponent(q.to)); return downloadCsv('/feedback/export.csv' + (p.length ? '?' + p.join('&') : ''), 'kundenzufriedenheit.csv'); },
    lifecycleConfig: () => call('GET', '/lifecycle/config'),
    lifecycleSaveConfig: (p) => call('POST', '/lifecycle/config', p),
    lifecycleDryRun: () => call('POST', '/lifecycle/dryrun', {}),
    lifecycleEvents: () => call('GET', '/lifecycle/events'),
    broadcastRecipients: (mode) => call('GET', '/broadcast/recipients?mode=' + encodeURIComponent(mode || 'operational')),
    broadcastTest: (p) => call('POST', '/broadcast/test', p),
    broadcastSend: (p) => call('POST', '/broadcast/send', p),
    broadcastPreview: (p) => call('POST', '/broadcast/preview', p),
    broadcastHistory: () => call('GET', '/broadcast/history'),
    tickets: (params) => {
      params = params || {};
      const usp = new URLSearchParams();
      if (params.status) usp.set('status', params.status);
      return call('GET', '/tickets?' + usp.toString());
    },
    getTicket: (id) => call('GET', '/tickets/' + id),
    replyTicket: (id, body, files) => { // v777h-reply
      if (files && files.length) {
        const token = getToken();
        const fd = new FormData();
        fd.append('body', body);
        for (let i = 0; i < files.length; i++) fd.append('screenshots', files[i]);
        return fetch(BASE + '/tickets/' + id + '/reply', { method: 'POST', headers: token ? { 'X-Admin-Token': token } : {}, body: fd })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      }
      return call('POST', '/tickets/' + id + '/reply', { body: body });
    },
    setTicketStatus: (id, status) => call('POST', '/tickets/' + id + '/status', { status: status }),
    feedback: () => call('GET', '/feedback'),
    invoices: (params) => {
      params = params || {};
      const usp = new URLSearchParams();
      if (params.from) usp.set('from', params.from);
      if (params.to) usp.set('to', params.to);
      if (params.q) usp.set('q', params.q);
      return call('GET', '/invoices?' + usp.toString());
    },
    downloadInvoicePdf: (id) => downloadCsv('/invoices/' + id + '/pdf', 'rechnung.pdf'),
    invoiceCsv: (from, to) => {
      const usp = new URLSearchParams();
      if (from) usp.set('from', from);
      if (to) usp.set('to', to);
      return downloadCsv('/invoices.csv?' + usp.toString(), 'rechnungen.csv');
    },
    login: (email, password, totpCode) => call('POST', '/auth/login', { email, password, totpCode }),
    me: () => call('GET', '/auth/me'),

    dashboard: () => call('GET', '/dashboard'),

    usersTrend: (days) => call('GET', `/charts/users-trend?days=${days || 30}`),
    mrrTrend: (days) => call('GET', `/charts/mrr-trend?days=${days || 30}`),

    listUsers: (params) => {
      params = params || {};
      const usp = new URLSearchParams();
      if (params.q) usp.set('q', params.q);
      if (params.limit) usp.set('limit', params.limit);
      if (params.offset) usp.set('offset', params.offset);
      if (params.plan) usp.set('plan', params.plan);
      if (params.status) usp.set('status', params.status);
      return call('GET', '/users?' + usp.toString());
    },
    getUser: (id) => call('GET', `/users/${id}`),
    createUser: (email, name, plan_id, is_test_user) =>
      call('POST', '/users', { email, name, plan_id, is_test_user: !!is_test_user }),
    changePlan: (id, plan_id, billing_interval, reason) =>
      call('POST', `/users/${id}/change-plan`, { plan_id, billing_interval, reason }),
    grantCredits: (id, amount, reason) =>
      call('POST', `/users/${id}/grant-credits`, { amount, reason }),
    resetPassword: (id, reason) =>
      call('POST', `/users/${id}/reset-password`, { reason }),
    toggleActive: (id, reason) =>
      call('POST', `/users/${id}/toggle-active`, { reason }),
    // V197: NEU
    toggleTestUser: (id, reason) =>
      call('POST', `/users/${id}/toggle-test`, { reason }),
    deleteUser: (id, confirm_email, reason) =>
      call('DELETE', `/users/${id}`, { confirm_email, reason }),

    exportUsersCsv: (params) => {
      params = params || {};
      const usp = new URLSearchParams();
      if (params.q) usp.set('q', params.q);
      if (params.plan) usp.set('plan', params.plan);
      if (params.status) usp.set('status', params.status);
      const q = usp.toString();
      const filename = `dealpilot-users-${new Date().toISOString().slice(0, 10)}.csv`;
      return downloadCsv('/users.csv' + (q ? '?' + q : ''), filename);
    },
    exportAuditCsv: (action) => {
      const filename = `dealpilot-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      return downloadCsv('/audit-log.csv' + (action ? '?action=' + encodeURIComponent(action) : ''), filename);
    },

    auditLog: (action) => call('GET', '/audit-log' + (action ? `?action=${encodeURIComponent(action)}` : '')),

    listPlans: () => call('GET', '/plans')
  };
})();
