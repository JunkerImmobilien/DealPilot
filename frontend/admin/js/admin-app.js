// DealPilot Admin V197 — Hauptanwendung mit Test-User-Flag
'use strict';

(function() {

  // ── Helpers ────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function fmtMoney(cents) {
    if (cents == null || isNaN(cents)) return '–';
    return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function fmtDate(d) {
    if (!d) return '–';
    return new Date(d).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function fmtDay(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.getDate() + '.' + (dt.getMonth() + 1) + '.';
  }
  function fmtNum(n) {
    if (n == null || isNaN(n)) return '–';
    return Number(n).toLocaleString('de-DE');
  }
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    $('#toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Login-Screen ────────────────────────────────────────
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const totpCode = $('#login-totp').value;
    const errEl = $('#login-error');
    errEl.style.display = 'none';
    try {
      const r = await Auth.tryLogin(email, password, totpCode);
      if (r.requires_totp) {
        $('#totp-row').style.display = 'block';
        $('#login-totp').focus();
        errEl.style.display = 'none';
        return;
      }
      mountApp(r.admin);
    } catch (err) {
      errEl.textContent = err.data?.message || err.data?.error || err.message || 'Login fehlgeschlagen';
      errEl.style.display = 'block';
    }
  });

  // ── App-Mount nach Login ───────────────────────────────
  async function mountApp(admin) {
    $('#login-screen').style.display = 'none';
    $('#app-shell').style.display = 'block';
    $('#user-email').textContent = admin.email;
    $('#user-role').textContent = admin.role;

    $$('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(link.dataset.view);
      });
    });

    $('#logout-link').addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
    });

    $('#open-create-user').addEventListener('click', openCreateUser);
    $('#open-create-user-2').addEventListener('click', openCreateUser);
    $('#cu-cancel').addEventListener('click', () => { $('#modal-create-user').style.display = 'none'; });
    $('#create-user-form').addEventListener('submit', submitCreateUser);
    $('#reveal-close').addEventListener('click', () => { $('#modal-reveal').style.display = 'none'; });
    $('#reveal-copy').addEventListener('click', () => {
      navigator.clipboard.writeText($('#reveal-value').textContent);
      toast('In Zwischenablage kopiert', 'success');
    });

    $('#user-search-btn').addEventListener('click', loadUsers);
    $('#user-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadUsers(); });
    $('#filter-plan').addEventListener('change', loadUsers);
    $('#filter-status').addEventListener('change', loadUsers);
    $('#export-users-csv').addEventListener('click', exportUsersCsv);

    $('#audit-filter-btn').addEventListener('click', loadAudit);
    $('#audit-filter').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadAudit(); });
    $('#export-audit-csv').addEventListener('click', exportAuditCsv);

    $('#back-to-users').addEventListener('click', (e) => { e.preventDefault(); switchView('users'); });

    $$('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadCharts(parseInt(btn.dataset.days, 10));
      });
    });

    try {
      const plansRes = await API.listPlans();
      window._plans = plansRes.plans || [];
      updatePlanDropdowns();
    } catch (e) { console.warn('Plans laden fehlgeschlagen:', e); }

    loadDashboard();
  }

  function switchView(view) {
    $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));
    $$('.view').forEach(v => v.style.display = 'none');
    $('#view-' + view).style.display = 'block';
    if (view === 'dashboard') loadDashboard();
    if (view === 'users') loadUsers();
    if (view === 'audit') loadAudit();
    if (view === 'credits') loadCredits();
    if (view === 'lifecycle') loadLifecycle();
    if (view === 'broadcast') loadBroadcast();
    if (view === 'support') loadTickets();
    if (view === 'satisfaction') loadFeedback();
    if (view === 'invoices') loadInvoices();
  }

  // ── v554: Guthaben & Kosten ────────────────
  // v776: Rechnungen
  async function loadInvoices() {
    var tbody = document.getElementById('invoices-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7">L\u00e4dt\u2026</td></tr>';
    var from = (document.getElementById('inv-from') || {}).value || '';
    var to = (document.getElementById('inv-to') || {}).value || '';
    try {
      var r = await API.invoices({ from: from, to: to });
      var rows = (r && r.invoices) || [];
      if (!tbody) return;
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted)">Keine Rechnungen</td></tr>'; return; }
      tbody.innerHTML = rows.map(function (i) {
        var d = i.invoice_date ? new Date(i.invoice_date).toLocaleDateString('de-DE') : '\u2013';
        var amt = (i.amount_total != null) ? (Number(i.amount_total) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (i.currency || 'EUR').toUpperCase() : '\u2013';
        var pdf = i.has_pdf
          ? '<a href="#" onclick="return window._invPdf(\'' + i.id + '\')">PDF</a>'
          : (i.hosted_invoice_url ? '<a href="' + i.hosted_invoice_url + '" target="_blank" rel="noopener">Stripe</a>' : '\u2013');
        return '<tr><td>' + (i.invoice_number || '\u2013') + '</td><td>' + d + '</td><td>' + amt + '</td><td>' + (i.status || '\u2013') + '</td><td>' + escapeHtml(i.user_email || '\u2013') + '</td><td>' + pdf + '</td><td class="dpx-del-td"><button type="button" class="dpx-row-del" title="Rechnung l\u00f6schen" onclick="window._dpxRowDel(this)" data-del-kind="invoice" data-del-id="' + i.id + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>';
      }).join('');
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7"><div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div></td></tr>';
    }
  }
  function _invPdf(id) { try { API.downloadInvoicePdf(id); } catch (e) {} return false; }
  function _invCsv() { var f = (document.getElementById('inv-from') || {}).value || ''; var t = (document.getElementById('inv-to') || {}).value || ''; try { API.invoiceCsv(f, t); } catch (e) {} }
  window._invPdf = _invPdf; window._invReload = loadInvoices; window._invCsv = _invCsv; // v776-invoices

  // v777-support: Support-Tickets + Kundenzufriedenheit
  function _tkAge(iso, status) {
    if (status === 'closed') return '<span style="color:#999">\u25cf</span>';
    var days = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (days < 1) return '<span style="color:#3FA56C">\u25cf</span>';
    if (days < 3) return '<span style="color:#C9A84C">\u25cf</span>';
    return '<span style="color:#B86250">\u25cf</span>';
  }
  function _tkStatusLabel(s) {
    var L = ({ 'new': 'Neu', open: 'Offen', waiting: 'Wartet', closed: 'Geschlossen' })[s] || s;
    var C = ({ 'new': '#3FA56C', open: '#3FA56C', waiting: '#C9A84C', closed: '#9a9184' })[s] || '#9a9184';
    return '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:9px;height:9px;border-radius:50%;background:' + C + ';display:inline-block;flex:none;"></span>' + L + '</span>'; // v777e-status-dot
  }
  async function loadTickets() {
    var listEl = document.getElementById('tickets-list');
    var detEl = document.getElementById('ticket-detail');
    if (detEl) detEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';
    var tbody = document.getElementById('tickets-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7">L\u00e4dt\u2026</td></tr>';
    var status = (document.getElementById('tk-status-filter') || {}).value || 'all';
    try {
      var r = await API.tickets({ status: status });
      var rows = (r && r.tickets) || [];
      if (!tbody) return;
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted)">Keine Tickets</td></tr>'; return; }
      tbody.innerHTML = rows.map(function (t) {
        var d = t.last_activity_at ? new Date(t.last_activity_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '\u2013';
        var mail = escapeHtml(t.user_email || t.contact_email || '\u2013');
        return '<tr style="cursor:pointer" onclick="window._tkOpen(\'' + t.id + '\')">' +
          '<td>' + _tkAge(t.last_activity_at, t.status) + '</td>' +
          '<td>' + escapeHtml(t.subject || '(ohne Betreff)') + '</td>' +
          '<td>' + escapeHtml(t.category || '\u2013') + '</td>' +
          '<td>' + mail + '</td>' +
          '<td>' + _tkStatusLabel(t.status) + ' \u00b7 ' + t.msg_count + '</td>' +
          '<td>' + d + '</td>' +
          '<td class="dpx-del-td"><button type="button" class="dpx-row-del" title="Ticket l\u00f6schen" onclick="event.stopPropagation();window._dpxRowDel(this)" data-del-kind="ticket" data-del-id="' + t.id + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>';
      }).join('');
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7"><div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div></td></tr>';
    }
  }
  async function _tkOpen(id) {
    var listEl = document.getElementById('tickets-list');
    var detEl = document.getElementById('ticket-detail');
    if (listEl) listEl.style.display = 'none';
    if (detEl) { detEl.style.display = 'block'; detEl.innerHTML = 'L\u00e4dt\u2026'; }
    try {
      var r = await API.getTicket(id);
      if (!r || !r.ticket) { if (detEl) detEl.innerHTML = '<div class="error-msg">Ticket nicht gefunden</div>'; return; }
      var t = r.ticket;
      var _atts = r.attachments || []; // v777g-att
      function _attBlock(mid) {
        var mine = _atts.filter(function (a) { return a.message_id === mid; });
        if (!mine.length) return '';
        return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">' + mine.map(function (a) {
          return '<a href="#" data-att-id="' + a.id + '" title="' + escapeHtml(a.filename || '') + '" ' +
            'style="width:84px;height:84px;border:1px solid #e7e1d4;border-radius:8px;overflow:hidden;background:#faf7f0 center/cover no-repeat;display:inline-block;"></a>';
        }).join('') + '</div>';
      }
      var thread = (r.messages || []).map(function (m) {
        var who = m.sender === 'admin' ? 'Support' : 'Kunde';
        var bg = m.sender === 'admin' ? '#FAF6EC' : '#fff';
        var bd = m.sender === 'admin' ? '#C9A84C' : '#ddd';
        var dt = new Date(m.created_at).toLocaleString('de-DE');
        return '<div style="border:1px solid ' + bd + ';background:' + bg + ';border-radius:8px;padding:10px 12px;margin:8px 0;">' +
          '<div style="font-size:11px;color:#888;margin-bottom:4px;">' + who + ' \u00b7 ' + dt + '</div>' +
          '<div style="white-space:pre-wrap;font-size:14px;">' + escapeHtml(m.body || '') + '</div>' + _attBlock(m.id) + '</div>';
      }).join('');
      detEl.innerHTML =
        '<button class="btn" onclick="window._tkBack()">\u2190 Zur\u00fcck</button>' +
        '<h3 style="margin:12px 0 4px;">' + escapeHtml(t.subject || '(ohne Betreff)') + '</h3>' +
        '<div style="font-size:12px;color:#888;margin-bottom:6px;">' + escapeHtml(t.user_email || t.contact_email || '\u2013') + ' \u00b7 ' + _tkStatusLabel(t.status) + ' \u00b7 ' + escapeHtml(t.category || '') + '</div>' +
        '<div>' + thread + '</div>' +
        '<textarea id="tk-reply-body" rows="5" style="width:100%;margin-top:10px;padding:8px;box-sizing:border-box;" placeholder="Antwort an den Kunden\u2026"></textarea>' +
        '<div style="margin-top:8px;font-size:13px;color:#6f675b;">\ud83d\udcce Bilder anh\u00e4ngen: <input type="file" id="tk-reply-files" accept="image/*" multiple style="font-size:12px;"></div>' + // v777h-reply-files
        '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn btn-primary" onclick="window._tkReply(\'' + t.id + '\')">Antwort senden</button>' +
        '<button class="btn" onclick="window._tkStatus(\'' + t.id + '\',\'open\')">Offen</button>' +
        '<button class="btn" onclick="window._tkStatus(\'' + t.id + '\',\'waiting\')">Wartet</button>' +
        '<button class="btn" onclick="window._tkStatus(\'' + t.id + '\',\'closed\')">Geschlossen</button>' +
        (t.object_snapshot ? '<button class="btn" onclick="window._tkObjDownload(\'' + t.id + '\')">\u2b07 Objekt (JSON)</button>'                            : '<span style="font-size:12px;color:#aaa;align-self:center;">kein Objekt angeh\u00e4ngt</span>') +
        '</div><div id="tk-msg" style="margin-top:8px;font-size:13px;"></div>';
      _tkLoadAttachments();
    } catch (e) {
      if (detEl) detEl.innerHTML = '<div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div>';
    }
  }
  function _tkBack() { loadTickets(); }
  async function _tkLoadAttachments() { // v777g-att
    var nodes = document.querySelectorAll('#ticket-detail [data-att-id]');
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        var id = el.getAttribute('data-att-id');
        API.fetchAttachmentUrl(id).then(function (url) {
          el.style.backgroundImage = 'url(' + url + ')';
          el.onclick = function (ev) { ev.preventDefault(); _tkAttFull(url); };
        }).catch(function () { el.textContent = '\u00d7'; el.style.color = '#B86250'; el.style.fontSize = '20px'; el.style.textAlign = 'center'; el.style.lineHeight = '84px'; });
      })(nodes[i]);
    }
  }
  function _tkAttFull(url) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(8,7,6,.86);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;padding:24px;';
    var img = document.createElement('img');
    img.src = url; img.style.cssText = 'max-width:94vw;max-height:92vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5);';
    ov.appendChild(img);
    ov.onclick = function () { document.body.removeChild(ov); };
    document.body.appendChild(ov);
  }
  async function _tkObjDownload(id) {
    try { await API.downloadCsv('/tickets/' + id + '/object.json', 'ticket-' + String(id).slice(0,8) + '-objekt.json'); }
    catch (e) { alert('Download fehlgeschlagen: ' + (e.message || '')); }
  }
  window._tkObjDownload = _tkObjDownload; // v777c-object-download
  async function _tkReply(id) {
    var body = (document.getElementById('tk-reply-body') || {}).value || '';
    var msg = document.getElementById('tk-msg');
    if (!body.trim()) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Antwort ist leer.'; } return; }
    if (msg) { msg.style.color = '#888'; msg.textContent = 'Senden\u2026'; }
    try {
      var _rf = (document.getElementById('tk-reply-files') || {}).files;
      await API.replyTicket(id, body, _rf);
      if (msg) { msg.style.color = '#3FA56C'; msg.textContent = 'Antwort gesendet \u2713'; }
      setTimeout(function () { _tkOpen(id); }, 700);
    } catch (e) {
      if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Fehler: ' + (e.message || ''); }
    }
  }
  async function _tkStatus(id, status) {
    var msg = document.getElementById('tk-msg');
    try {
      await API.setTicketStatus(id, status);
      if (msg) { msg.style.color = '#3FA56C'; msg.textContent = 'Status: ' + _tkStatusLabel(status); }
      setTimeout(function () { _tkOpen(id); }, 450);
    } catch (e) {
      if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Fehler: ' + (e.message || ''); }
    }
  }
  var _fbPeriod = 'all';
  var _fbFrom = '';
  var _fbTo = '';
  function _fbSetPeriod(p) { _fbPeriod = p; _fbFrom = ''; _fbTo = ''; loadFeedback(); }
  function _fbApplyRange() { _fbFrom = (document.getElementById('fb-from') || {}).value || ''; _fbTo = (document.getElementById('fb-to') || {}).value || ''; loadFeedback(); }
  function _fbExportCsv() { API.feedbackCsv({ period: _fbPeriod, from: _fbFrom, to: _fbTo }); }
  var _FB_CRIT_LABELS = { ux: 'Bedienung & UX', workflow: 'Workflow-Verst\u00e4ndlichkeit', onboarding: 'Onboarding', kpis: 'Kennzahlen-Aufbereitung', score: 'DealScore-Logik', pdf: 'PDF-Qualit\u00e4t', ai: 'Pilot-Analyse', performance: 'Geschwindigkeit' };
  async function loadFeedback() {
    var statEl = document.getElementById('fb-stats');
    var tbody = document.getElementById('feedback-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">L\u00e4dt\u2026</td></tr>';
    try {
      var r = await API.feedbackQuery({ period: _fbPeriod, from: _fbFrom, to: _fbTo });
      var s = (r && r.stats) || {};
      if (statEl) {
        var avg = (s.avg_rating != null) ? Number(s.avg_rating).toFixed(2) : '\u2013';
        var rangeActive = !!(_fbFrom || _fbTo);
        function pb(p, lbl) { return '<button class="btn' + ((!rangeActive && _fbPeriod === p) ? ' btn-primary' : '') + '" onclick="window._fbSetPeriod(\'' + p + '\')">' + lbl + '</button>'; }
        var toggle = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">' +
          pb('all', 'Gesamt') + pb('year', 'Jahr') + pb('month', 'Monat') +
          '<span style="margin:0 4px;color:#ccc;">|</span>' +
          '<input type="date" id="fb-from" value="' + _fbFrom + '" style="padding:5px;border:1px solid #ddd;border-radius:6px;">' +
          '<span style="color:#888;font-size:13px;">bis</span>' +
          '<input type="date" id="fb-to" value="' + _fbTo + '" style="padding:5px;border:1px solid #ddd;border-radius:6px;">' +
          '<button class="btn' + (rangeActive ? ' btn-primary' : '') + '" onclick="window._fbApplyRange()">Filtern</button>' +
          '<button class="btn" onclick="window._fbExportCsv()">\u2b07 CSV exportieren</button>' +
        '</div>';
        var periodTxt = _fbPeriod === 'year' ? ' (dieses Jahr)' : (_fbPeriod === 'month' ? ' (dieser Monat)' : '');
        var head = '<div style="font-size:28px;font-weight:700;color:#C9A84C;">' + avg + ' <span style="font-size:16px;color:#888;">/ 5</span></div>' +
          '<div style="color:#888;font-size:13px;margin-bottom:14px;">' + (s.n || 0) + ' Bewertungen' + periodTxt + '</div>';
        var bc = (s.byCriterion) || {};
        var bars = Object.keys(_FB_CRIT_LABELS).map(function (k) {
          var d = bc[k] || {};
          var v = (d.avg != null) ? d.avg : 0;
          var pct = Math.round(v / 5 * 100);
          var valTxt = (d.avg != null) ? (d.avg.toFixed(2) + ' <span style="color:#aaa;">(' + (d.n || 0) + ')</span>') : '<span style="color:#bbb;">\u2013</span>';
          return '<div style="margin:7px 0;">' +
            '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px;"><span>' + _FB_CRIT_LABELS[k] + '</span><span>' + valTxt + '</span></div>' +
            '<div style="height:8px;background:#eee;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#E8CC7A,#C9A84C);"></div></div>' +
          '</div>';
        }).join('');
        statEl.innerHTML = toggle + head + '<div style="font-weight:600;font-size:13px;margin:8px 0 4px;">Schnitt je Bereich</div>' + bars;
      }
      var rows = (r && r.feedback) || [];
      if (!tbody) return;
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted)">Noch kein Feedback</td></tr>'; return; }
      tbody.innerHTML = rows.map(function (f) {
        var dt = f.created_at ? new Date(f.created_at).toLocaleString('de-DE') : '\u2013';
        var n = f.overall_rating || 0;
        var stars = n ? (new Array(n + 1).join('\u2605') + new Array(Math.max(0, 5 - n) + 1).join('\u2606')) : '\u2013';
        return '<tr><td style="color:#C9A84C;white-space:nowrap;">' + stars + '</td><td>' + escapeHtml(f.message || '\u2013') + '</td><td>' + escapeHtml(f.user_email || f.contact_email || '\u2013') + '</td><td style="white-space:nowrap;">' + dt + '</td><td class="dpx-del-td"><button type="button" class="dpx-row-del" title="Endg\u00fcltig l\u00f6schen" onclick="window._dpxRowDel(this)" data-del-kind="feedback" data-del-id="' + f.id + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>';
      }).join('');
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5"><div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div></td></tr>';
    }
  }
  window._fbSetPeriod = _fbSetPeriod; window._fbApplyRange = _fbApplyRange; window._fbExportCsv = _fbExportCsv;
  window._loadTickets = loadTickets; window._loadFeedback = loadFeedback;
  window._tkOpen = _tkOpen; window._tkBack = _tkBack; window._tkReply = _tkReply; window._tkStatus = _tkStatus; // v777-support

  // v778-broadcast: Massenmail
  function _bcModeVal() { return (document.getElementById('bc-mode') || {}).value || 'operational'; }
  async function _bcUpdateCount() {
    var el = document.getElementById('bc-count');
    if (el) el.textContent = '\u2026';
    var opBox = document.getElementById('bc-op-confirm-box');
    if (opBox) opBox.style.display = (_bcModeVal() === 'operational') ? 'block' : 'none';
    try {
      var r = await API.broadcastRecipients(_bcModeVal());
      var n = (r && r.count != null) ? r.count : '?';
      if (el) el.textContent = n;
      var warn = document.getElementById('bc-newsletter-warn');
      if (warn) warn.style.display = (_bcModeVal() === 'newsletter' && r && r.count === 0) ? 'block' : 'none';
    } catch (e) { if (el) el.textContent = '?'; }
  }
  var _BC_TEMPLATE = 'Hallo,\n\nkurze Info aus dem DealPilot-Team:\n\n\n\nViele Gr\u00fc\u00dfe\nDein DealPilot-Team';
  var _bcPrevT = null;
  function _bcPreviewSoon() { clearTimeout(_bcPrevT); _bcPrevT = setTimeout(_bcRenderPreview, 400); }
  async function _bcRenderPreview() {
    var fr = document.getElementById('bc-preview-frame'); if (!fr) return;
    var subj = (document.getElementById('bc-subject') || {}).value || '';
    var body = (document.getElementById('bc-body') || {}).value || '';
    try { var r = await API.broadcastPreview({ subject: subj, body: body, mode: _bcModeVal(), html: true }) /* v778f-html-flag */; fr.srcdoc = (r && r.html) || ''; }
    catch (e) { /* Vorschau still lassen bei Fehler */ }
  }
  function _bcWirePreview() {
    if (window._bcPreviewWired) return; window._bcPreviewWired = true;
    ['bc-subject', 'bc-body'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('input', _bcPreviewSoon); });
    var m = document.getElementById('bc-mode'); if (m) m.addEventListener('change', _bcPreviewSoon);
  }
  // v778e-preview
  async function loadBroadcast() {
    window._bcTested = false;
    var sb = document.getElementById('bc-send-btn'); if (sb) sb.disabled = true;
    var _bcBodyEl = document.getElementById('bc-body');
    if (_bcBodyEl && !_bcBodyEl.value.trim()) _bcBodyEl.value = _BC_TEMPLATE;
    _bcWirePreview();
    _bcRenderPreview();
    await _bcUpdateCount();
    var tbody = document.getElementById('bc-history-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7">L\u00e4dt\u2026</td></tr>';
    try {
      var r = await API.broadcastHistory();
      var rows = (r && r.broadcasts) || [];
      if (!tbody) return;
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted)">Noch nichts versendet</td></tr>'; return; }
      tbody.innerHTML = rows.map(function (b) {
        var d = b.created_at ? new Date(b.created_at).toLocaleString('de-DE') : '\u2013';
        var modeL = b.mode === 'newsletter' ? 'Newsletter' : 'Betrieb';
        return '<tr><td>' + d + '</td><td>' + escapeHtml(b.subject || '\u2013') + '</td><td>' + modeL + '</td><td>' + (b.sent_count || 0) + ' / ' + (b.recipient_count || 0) + '</td><td>' + (b.status || '') + '</td><td>' + escapeHtml(b.admin_label || '') + '</td></tr>';
      }).join('');
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7"><div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div></td></tr>';
    }
  }
  async function _bcTest() {
    var msg = document.getElementById('bc-msg');
    var subj = (document.getElementById('bc-subject') || {}).value || '';
    var body = (document.getElementById('bc-body') || {}).value || '';
    var to = (document.getElementById('bc-test-email') || {}).value || '';
    if (!to) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Bitte Test-Adresse eingeben.'; } return; }
    if (!subj.trim() || !body.trim()) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Betreff und Text d\u00fcrfen nicht leer sein.'; } return; }
    if (msg) { msg.style.color = '#888'; msg.textContent = 'Testmail wird gesendet\u2026'; }
    try {
      await API.broadcastTest({ subject: subj, body: body, mode: _bcModeVal(), toEmail: to, html: true });
      window._bcTested = true;
      var sb = document.getElementById('bc-send-btn'); if (sb) sb.disabled = false;
      if (msg) { msg.style.color = '#3FA56C'; msg.textContent = 'Testmail gesendet an ' + to + ' \u2713 \u2014 pr\u00fcfe dein Postfach, dann unten senden.'; }
    } catch (e) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Fehler: ' + (e.message || ''); } }
  }
  async function _bcSend() {
    var msg = document.getElementById('bc-msg');
    var subj = (document.getElementById('bc-subject') || {}).value || '';
    var body = (document.getElementById('bc-body') || {}).value || '';
    var mode = _bcModeVal();
    var label = (document.getElementById('bc-label') || {}).value || '';
    if (!subj.trim() || !body.trim()) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Betreff und Text d\u00fcrfen nicht leer sein.'; } return; }
    if (!window._bcTested) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Bitte zuerst eine Testmail an dich senden.'; } return; }
    if (mode === 'operational') {
      var chk = document.getElementById('bc-confirm-op');
      if (!chk || !chk.checked) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Bitte best\u00e4tigen: nur Betriebs-/Wartungsinfo, keine Werbung.'; } return; }
    }
    var cnt = (document.getElementById('bc-count') || {}).textContent || '?';
    if (!window.confirm('Wirklich an ' + cnt + ' Empf\u00e4nger senden? L\u00e4sst sich nicht zur\u00fccknehmen.')) return;
    if (msg) { msg.style.color = '#888'; msg.textContent = 'Versand wird gestartet\u2026'; }
    try {
      var r = await API.broadcastSend({ adminLabel: label, mode: mode, subject: subj, body: body, confirmOperational: true, html: true });
      if (msg) { msg.style.color = '#3FA56C'; msg.textContent = 'Versand gestartet an ' + ((r && r.recipientCount) || '?') + ' Empf\u00e4nger. Fortschritt im Verlauf unten.'; }
      window._bcTested = false;
      var sb = document.getElementById('bc-send-btn'); if (sb) sb.disabled = true;
      setTimeout(loadBroadcast, 1500);
    } catch (e) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Fehler: ' + (e.message || ''); } }
  }
  window._loadBroadcast = loadBroadcast; window._bcMode = _bcUpdateCount; window._bcTest = _bcTest; window._bcSend = _bcSend; window._bcRefresh = loadBroadcast; // v778-broadcast

  // v779-lifecycle: Kundenbindung
  async function loadLifecycle() {
    var msg = document.getElementById('lc-msg'); if (msg) msg.textContent = '';
    try {
      var c = await API.lifecycleConfig();
      var cfg = (c && c.config) || c || {};
      function set(id, v) { var e = document.getElementById(id); if (e && v != null) e.value = v; }
      var en = document.getElementById('lc-enabled'); if (en) en.checked = !!cfg.enabled;
      set('lc-days_reminder', cfg.days_reminder); set('lc-days_warn_delete', cfg.days_warn_delete);
      set('lc-days_soft_delete', cfg.days_soft_delete); set('lc-days_hard_delete', cfg.days_hard_delete);
      set('lc-coupon_percent', cfg.coupon_percent); set('lc-coupon_days', cfg.coupon_days);
      var badge = document.getElementById('lc-state-badge');
      if (badge) { badge.textContent = cfg.enabled ? 'AKTIV' : 'AUS (Dry-Run)'; badge.style.color = cfg.enabled ? '#B86250' : '#3FA56C'; }
    } catch (e) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Config-Fehler: ' + (e.message || ''); } }
    await _lcLoadEvents();
  }
  async function _lcLoadEvents() {
    var tbody = document.getElementById('lc-events-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">L\u00e4dt\u2026</td></tr>';
    try {
      var r = await API.lifecycleEvents();
      var rows = (r && r.events) || [];
      if (!tbody) return;
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted)">Noch keine Ereignisse</td></tr>'; return; }
      tbody.innerHTML = rows.map(function (e) {
        var d = e.created_at ? new Date(e.created_at).toLocaleString('de-DE') : '\u2013';
        return '<tr><td>' + d + '</td><td>' + escapeHtml(e.stage || '') + '</td><td>' + escapeHtml(e.email || '\u2013') + '</td></tr>';
      }).join('');
    } catch (e) { if (tbody) tbody.innerHTML = '<tr><td colspan="3"><div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div></td></tr>'; }
  }
  function _lcNum(id) { var v = parseInt((document.getElementById(id) || {}).value, 10); return isNaN(v) ? undefined : v; }
  async function _lcSave() {
    var msg = document.getElementById('lc-msg');
    var enabled = !!(document.getElementById('lc-enabled') || {}).checked;
    if (enabled && !window.confirm('Lifecycle WIRKLICH scharf schalten? Ab jetzt werden Mails versendet und nach Ablauf der Fristen Konten deaktiviert und gel\u00f6scht.')) return;
    var patch = {
      enabled: enabled,
      days_reminder: _lcNum('lc-days_reminder'), days_warn_delete: _lcNum('lc-days_warn_delete'),
      days_soft_delete: _lcNum('lc-days_soft_delete'), days_hard_delete: _lcNum('lc-days_hard_delete'),
      coupon_percent: _lcNum('lc-coupon_percent'), coupon_days: _lcNum('lc-coupon_days')
    };
    if (msg) { msg.style.color = '#888'; msg.textContent = 'Speichern\u2026'; }
    try { await API.lifecycleSaveConfig(patch); if (msg) { msg.style.color = '#3FA56C'; msg.textContent = 'Gespeichert \u2713'; } loadLifecycle(); }
    catch (e) { if (msg) { msg.style.color = '#B86250'; msg.textContent = 'Fehler: ' + (e.message || ''); } }
  }
  async function _lcDryRun() {
    var out = document.getElementById('lc-dryrun-out');
    if (out) out.innerHTML = 'Simuliere\u2026';
    try {
      var r = await API.lifecycleDryRun();
      var acts = (r && r.actions) || [];
      var hdr = '<div style="margin-bottom:6px;">Status: <strong>' + (r && r.enabled ? 'AKTIV' : 'AUS') + '</strong> \u00b7 ' + (acts.length) + ' Aktion(en) f\u00e4llig' + ((r && r.dryRun) ? ' (Vorschau, nichts ausgef\u00fchrt)' : '') + '</div>';
      if (!acts.length) { if (out) out.innerHTML = hdr + '<div style="color:var(--text-muted)">Aktuell nichts f\u00e4llig.</div>'; return; }
      var rows = acts.map(function (a) { return '<tr><td>' + escapeHtml(a.stage) + '</td><td>' + escapeHtml(a.email || a.userId) + '</td></tr>'; }).join('');
      if (out) out.innerHTML = hdr + '<table class="data-table"><thead><tr><th>Stufe</th><th>Kontakt</th></tr></thead><tbody>' + rows + '</tbody></table>';
    } catch (e) { if (out) out.innerHTML = '<div class="error-msg">' + escapeHtml(e.message || 'Fehler') + '</div>'; }
  }
  window._loadLifecycle = loadLifecycle; window._lcSave = _lcSave; window._lcDryRun = _lcDryRun; // v779-lifecycle

  async function loadCredits() {
    function eur(v) { return (v == null) ? '–' : Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
    try {
      const c = await API.credits();
      const balEl = document.getElementById('cred-geomap-balance');
      const noteEl = document.getElementById('cred-geomap-note');
      const cardEl = document.getElementById('cred-geomap-card');
      const bal = c.geomap && c.geomap.balance_eur;
      const thr = (c.geomap && c.geomap.threshold_eur) || 10;
      if (balEl) balEl.textContent = eur(bal);
      if (cardEl) {
        cardEl.style.borderLeft = '4px solid ' +
          (bal == null ? '#666' : bal <= 0 ? '#dc2626' : bal < thr ? '#f59e0b' : '#10b981');
      }
      if (noteEl) noteEl.textContent = (bal != null && bal < thr) ? ('⚠ unter Schwelle ' + eur(thr)) : '';
      const gsp = document.getElementById('cred-geomap-spent');
      if (gsp) gsp.textContent = eur(c.geomap && c.geomap.spent_tracked_eur);
      const osp = document.getElementById('cred-openai-spent');
      if (osp) osp.textContent = eur(c.openai && c.openai.spent_tracked_eur);
    } catch (e) {
      const balEl = document.getElementById('cred-geomap-balance');
      if (balEl) balEl.textContent = 'Fehler';
    }
    try {
      const m = await API.marktberichtCosts();
      const labels = { qc: 'QuickCheck (2 L)', objekt: 'Objekt-Tab (2 L)', voll: 'Vollbericht (5 L)' };
      const bk = document.getElementById('mbcost-bykind');
      if (bk) bk.innerHTML = (m.by_kind && m.by_kind.length)
        ? m.by_kind.map(function (r) { return '<tr><td>' + (labels[r.kind] || r.kind) + '</td><td>' + r.n + '</td><td>' + r.liters + '</td><td>' + eur(r.geomap_eur) + '</td><td>' + eur(r.openai_eur) + '</td></tr>'; }).join('')
        : '<tr><td colspan="5" style="color:var(--text-muted)">Noch keine Abrufe</td></tr>';
      const rc = document.getElementById('mbcost-recent');
      if (rc) rc.innerHTML = (m.recent && m.recent.length)
        ? m.recent.map(function (r) {
            var d = new Date(r.ts);
            var ds = d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return '<tr><td>' + ds + '</td><td>' + (labels[r.kind] || r.kind) + '</td><td>' + r.liters + '</td><td>' + eur(r.geomap_eur) + '</td><td>' + eur(r.geomap_balance_eur) + '</td><td>' + (r.ok ? '✓' : '✗') + '</td></tr>';
          }).join('')
        : '<tr><td colspan="6" style="color:var(--text-muted)">Noch keine Abrufe</td></tr>';
    } catch (e) {
      const bk = document.getElementById('mbcost-bykind');
      if (bk) bk.innerHTML = '<tr><td colspan="5">Fehler beim Laden</td></tr>';
    }
  }

  // ── Dashboard ───────────────────────────────────────────
  async function loadDashboard() {
    try {
      const d = await API.dashboard();
      const k = d.kpis;
      $('#kpi-total').textContent = fmtNum(k.total_users);
      $('#kpi-active-30d').textContent = fmtNum(k.active_30d);
      $('#kpi-new-7d').textContent = fmtNum(k.new_7d);
      $('#kpi-new-30d').textContent = fmtNum(k.new_30d);
      $('#kpi-mrr').textContent = fmtMoney(k.mrr_cents);
      $('#kpi-arr').textContent = fmtMoney(k.arr_cents);
      $('#kpi-paying').textContent = k.paying_users + ' zahlende User';

      // V197: Test-User-Count anzeigen falls vorhanden
      if (k.test_users > 0 && $('#kpi-test-users-count')) {
        $('#kpi-test-users-count').textContent = `(zzgl. ${k.test_users} Test-User ausgeblendet)`;
        $('#kpi-test-users-count').style.display = 'block';
      }

      const planColors = { free: '#94a3b8', starter: '#10b981', investor: '#3b82f6', pro: '#c9a042' };
      const donutData = d.plan_distribution.map(p => ({
        label: p.plan_name,
        value: p.user_count,
        color: planColors[p.plan_id] || '#666'
      }));
      Charts.renderDonut($('#plan-donut'), donutData);

      // V197: 🧪-Badge bei Test-Usern in Recent-Listen
      $('#recent-signups').innerHTML = d.recent_signups.length
        ? d.recent_signups.map(s => `
            <tr>
              <td>${s.is_test_user ? '🧪 ' : ''}<a href="#" class="row-link" data-user-id="${s.id}">${escapeHtml(s.email)}</a></td>
              <td>${fmtDate(s.created_at)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="2" style="color:var(--text-muted)">Keine Daten</td></tr>';

      $('#recent-logins').innerHTML = d.recent_logins.length
        ? d.recent_logins.map(l => `
            <tr>
              <td>${l.is_test_user ? '🧪 ' : ''}<a href="#" class="row-link" data-user-id="${l.id}">${escapeHtml(l.email)}</a></td>
              <td>${fmtDate(l.last_login_at)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="2" style="color:var(--text-muted)">Keine Daten</td></tr>';

      $$('.row-link[data-user-id]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          showUserDetail(a.dataset.userId);
        });
      });

      const activeRange = document.querySelector('.range-btn.active');
      const days = activeRange ? parseInt(activeRange.dataset.days, 10) : 30;
      loadCharts(days);

    } catch (err) {
      toast('Dashboard-Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function loadCharts(days) {
    days = days || 30;
    const usersChartEl = $('#chart-users-trend');
    const mrrChartEl = $('#chart-mrr-trend');
    usersChartEl.innerHTML = '<div style="padding:40px;color:var(--text-muted);">Lädt…</div>';
    mrrChartEl.innerHTML = '<div style="padding:40px;color:var(--text-muted);">Lädt…</div>';

    try {
      const [usersR, mrrR] = await Promise.all([API.usersTrend(days), API.mrrTrend(days)]);
      Charts.renderLineChart(
        usersChartEl,
        usersR.series.map(p => ({ label: fmtDay(p.day), value: p.cumulative })),
        { color: '#c9a042', valueFormat: v => fmtNum(Math.round(v)), height: 220 }
      );
      Charts.renderLineChart(
        mrrChartEl,
        mrrR.series.map(p => ({ label: fmtDay(p.day), value: p.mrr_cents / 100 })),
        { color: '#3b82f6', valueFormat: v => v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €', height: 220 }
      );
    } catch (err) {
      usersChartEl.innerHTML = `<div class="error-msg">${escapeHtml(err.message || 'Fehler')}</div>`;
      mrrChartEl.innerHTML = '';
    }
  }

  // ── User-Liste mit Test-Badge ─────────────────────────
  async function loadUsers() {
    const q = $('#user-search').value.trim();
    const plan = $('#filter-plan').value;
    const status = $('#filter-status').value;
    const tbody = $('#users-list');
    tbody.innerHTML = '<tr><td colspan="7">Lädt…</td></tr>';
    $('#users-error').style.display = 'none';
    try {
      const r = await API.listUsers({ q, plan, status, limit: 100, offset: 0 });
      if (!r.users || r.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted)">Keine User gefunden</td></tr>';
        return;
      }
      tbody.innerHTML = r.users.map(u => `
        <tr>
          <td>${u.is_test_user ? '<span title="Test-User" style="margin-right:4px;">🧪</span>' : ''}<a href="#" class="row-link" data-user-id="${u.id}">${escapeHtml(u.email)}</a></td>
          <td>${escapeHtml(u.name || '–')}</td>
          <td><span class="pill ${u.plan_id === 'free' ? 'pill-plan' : 'pill-plan-paid'}">${escapeHtml(u.plan_name)}</span></td>
          <td><span class="pill ${u.is_active ? 'pill-active' : 'pill-inactive'}">${u.is_active ? 'Aktiv' : 'Gesperrt'}</span></td>
          <td>${u.object_count || 0}</td>
          <td>${u.last_login_at ? fmtDate(u.last_login_at) : '<span style="color:var(--text-light)">nie</span>'}</td>
          <td><a href="#" class="row-link" data-user-id="${u.id}">Details</a></td>
        </tr>
      `).join('');

      $$('.row-link[data-user-id]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          showUserDetail(a.dataset.userId);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="error-msg">${escapeHtml(err.message || 'Fehler')}</div></td></tr>`;
    }
  }

  async function exportUsersCsv() {
    const q = $('#user-search').value.trim();
    const plan = $('#filter-plan').value;
    const status = $('#filter-status').value;
    try {
      toast('CSV wird generiert…', 'info');
      await API.exportUsersCsv({ q, plan, status });
      toast('✓ CSV heruntergeladen', 'success');
    } catch (err) {
      toast('Export-Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function exportAuditCsv() {
    const filter = $('#audit-filter').value.trim();
    try {
      toast('CSV wird generiert…', 'info');
      await API.exportAuditCsv(filter);
      toast('✓ CSV heruntergeladen', 'success');
    } catch (err) {
      toast('Export-Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  // ── User-Detail-Page (V197: Test-User-Toggle) ─────────────
  async function showUserDetail(id) {
    switchView('users');
    $('#view-users').style.display = 'none';
    $('#view-user-detail').style.display = 'block';
    $('#user-detail-content').innerHTML = 'Lädt…';

    try {
      const r = await API.getUser(id);
      const u = r.user;
      const audit = r.audit || [];

      /* v859-plan-filter: nur die vier echten Plaene anzeigen */
      const planOptions = (window._plans || []).filter(p => ['starter', 'investor', 'pro'].includes(p.id)).map(p =>
        `<option value="${p.id}" ${u.plan_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
      ).join('');

      $('#user-detail-content').innerHTML = `
        <div class="user-detail-grid">
          <div class="user-info">
            <h3>Stammdaten</h3>
            <div class="user-info-row"><div class="user-info-label">User-ID</div><div class="user-info-value" style="font-family:monospace;font-size:0.85em">${u.id}</div></div>
            <div class="user-info-row"><div class="user-info-label">E-Mail</div><div class="user-info-value">${u.is_test_user ? '🧪 ' : ''}${escapeHtml(u.email)}</div></div>
            <div class="user-info-row"><div class="user-info-label">Name</div><div class="user-info-value">${escapeHtml(u.name || '–')}</div></div>
            <div class="user-info-row"><div class="user-info-label">Rolle</div><div class="user-info-value">${escapeHtml(u.role)}</div></div>
            <div class="user-info-row"><div class="user-info-label">Plan</div><div class="user-info-value"><span class="pill ${u.plan_id === 'free' ? 'pill-plan' : 'pill-plan-paid'}">${escapeHtml(u.plan_name)}</span> ${u.billing_interval ? `(${u.billing_interval})` : ''}</div></div>
            <div class="user-info-row"><div class="user-info-label">Status</div><div class="user-info-value"><span class="pill ${u.is_active ? 'pill-active' : 'pill-inactive'}">${u.is_active ? 'Aktiv' : 'Gesperrt'}</span></div></div>
            <div class="user-info-row"><div class="user-info-label">Test-User</div><div class="user-info-value">${u.is_test_user ? '<span class="pill pill-test">🧪 Ja</span> <span style="font-size:0.85em;color:var(--text-muted);">(MRR/Wachstum ignoriert)</span>' : '<span class="pill pill-plan">Nein</span>'}</div></div>
            <div class="user-info-row"><div class="user-info-label">Email verifiziert</div><div class="user-info-value">${u.email_verified_at ? '✓ ' + fmtDate(u.email_verified_at) : '✗ Nein'}</div></div>
            <div class="user-info-row"><div class="user-info-label">2FA aktiv</div><div class="user-info-value">${u.totp_enabled ? '✓ Ja' : '✗ Nein'}</div></div>
            <div class="user-info-row"><div class="user-info-label">Registriert</div><div class="user-info-value">${fmtDate(u.created_at)}</div></div>
            <div class="user-info-row"><div class="user-info-label">Letzter Login</div><div class="user-info-value">${u.last_login_at ? fmtDate(u.last_login_at) : '<span style="color:var(--text-light)">nie</span>'}</div></div>
            <div class="user-info-row"><div class="user-info-label">Objekte</div><div class="user-info-value">${u.object_count || 0}</div></div>
            <div class="user-info-row"><div class="user-info-label">KI-Credits</div><div class="user-info-value">${u.credits_used != null ? `${u.credits_used} verbraucht / ${u.bonus_credits || 0} Bonus` : '–'}</div></div>
            ${u.stripe_subscription_id ? `<div class="user-info-row"><div class="user-info-label">Stripe-Sub-ID</div><div class="user-info-value" style="font-family:monospace;font-size:0.85em">${escapeHtml(u.stripe_subscription_id)}</div></div>` : ''}
          </div>

          <div class="user-actions">
            <div class="action-section">
              <h4>Plan ändern</h4>
              <div class="action-row">
                <select id="action-plan">${planOptions}<option value="free" ${u.plan_id === 'free' ? 'selected' : ''}>Free</option></select>
                <select id="action-interval">
                  <option value="monthly" ${u.billing_interval === 'monthly' ? 'selected' : ''}>Monatlich</option>
                  <option value="yearly" ${u.billing_interval === 'yearly' ? 'selected' : ''}>Jährlich</option>
                </select>
                <button class="btn btn-primary btn-sm" data-action="change-plan">Setzen</button>
              </div>
            </div>

            <div class="action-section">
              <h4>KI-Credits gutschreiben</h4>
              <div class="action-row">
                <input type="number" id="action-credits" placeholder="Anzahl (z.B. 10)" min="1" max="10000">
                <button class="btn btn-primary btn-sm" data-action="grant-credits">Gutschreiben</button>
              </div>
            </div>

            <div class="action-section">
              <h4>Test-User-Flag</h4>
              <p style="font-size:0.85em;color:var(--text-muted);margin:0 0 8px 0;">${u.is_test_user ? 'Aktuell als Test-User markiert — wird in MRR/Wachstum/Charts ignoriert.' : 'Aktueller User zählt zu MRR/Wachstum. Beta/Test-User hier markieren.'}</p>
              <button class="btn btn-sm ${u.is_test_user ? '' : 'btn-primary'}" data-action="toggle-test">
                ${u.is_test_user ? '🧪 Test-Flag ENTFERNEN' : '🧪 Als Test-User markieren'}
              </button>
            </div>

            <div class="action-section">
              <h4>Passwort zurücksetzen</h4>
              <p style="font-size:0.85em;color:var(--text-muted);margin:0 0 8px 0;">Generiert ein neues Passwort. Wird nur einmal angezeigt!</p>
              <button class="btn btn-sm" data-action="reset-password">Neues Passwort generieren</button>
            </div>

            <div class="action-section">
              <h4>Konto ${u.is_active ? 'sperren' : 'entsperren'}</h4>
              <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-primary'}" data-action="toggle-active">
                ${u.is_active ? '🚫 Sperren' : '✓ Entsperren'}
              </button>
            </div>

            <div class="action-section">
              <h4>DSGVO-Löschung</h4>
              <p style="font-size:0.85em;color:var(--text-muted);margin:0 0 8px 0;">Anonymisiert alle Daten unwiderruflich. Bestätige mit Email-Eingabe.</p>
              <button class="btn btn-sm btn-danger" data-action="delete-dsgvo">⚠ DSGVO-Löschung starten</button>
            </div>
          </div>
        </div>

        ${audit.length ? `
          <div class="card" style="margin-top:16px;">
            <h3>Audit-Historie</h3>
            <table class="data-table">
              <thead><tr><th>Zeit</th><th>Aktion</th><th>IP</th></tr></thead>
              <tbody>${audit.map(a => `
                <tr>
                  <td>${fmtDate(a.created_at)}</td>
                  <td><code>${escapeHtml(a.action)}</code></td>
                  <td style="color:var(--text-muted);font-size:0.85em">${escapeHtml(a.ip || '–')}</td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        ` : ''}
      `;

      $$('[data-action="change-plan"]')[0].addEventListener('click', () => handleChangePlan(id));
      $$('[data-action="grant-credits"]')[0].addEventListener('click', () => handleGrantCredits(id));
      $$('[data-action="toggle-test"]')[0].addEventListener('click', () => handleToggleTest(id, u.is_test_user, u.email));
      $$('[data-action="reset-password"]')[0].addEventListener('click', () => handleResetPassword(id, u.email));
      $$('[data-action="toggle-active"]')[0].addEventListener('click', () => handleToggleActive(id, u.is_active, u.email));
      $$('[data-action="delete-dsgvo"]')[0].addEventListener('click', () => handleDeleteDsgvo(id, u.email));

    } catch (err) {
      $('#user-detail-content').innerHTML = `<div class="error-msg">${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  }

  async function handleChangePlan(id) {
    const plan_id = $('#action-plan').value;
    const interval = $('#action-interval').value;
    const reason = prompt('Grund für Plan-Wechsel (optional):') || '';
    try {
      await API.changePlan(id, plan_id, interval, reason);
      toast(`✓ Plan auf ${plan_id} (${interval}) gesetzt`, 'success');
      showUserDetail(id);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function handleGrantCredits(id) {
    const amount = parseInt($('#action-credits').value, 10);
    if (!amount || amount < 1) { toast('Bitte Anzahl eingeben', 'error'); return; }
    const reason = prompt(`${amount} Credits gutschreiben. Grund (optional):`) || '';
    try {
      const r = await API.grantCredits(id, amount, reason);
      toast(`✓ ${r.granted} Credits gutgeschrieben. Bonus jetzt: ${r.balance?.bonus_credits || '?'}`, 'success');
      showUserDetail(id);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function handleToggleTest(id, isTestUser, email) {
    const action = isTestUser ? 'aus Test-Status entfernen' : 'als Test-User markieren';
    if (!confirm(`${email} ${action}?\n\n${isTestUser
        ? 'User wird wieder zu MRR/Wachstum gezählt.'
        : 'User wird AUS MRR/Wachstum/Charts ausgeblendet (für Beta-Tester, etc.).'}`)) return;
    const reason = prompt('Grund (optional, z.B. "Beta-Tester"):') || '';
    try {
      const r = await API.toggleTestUser(id, reason);
      toast(`✓ ${r.is_test_user ? 'als Test-User markiert' : 'Test-Flag entfernt'}`, 'success');
      showUserDetail(id);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function handleResetPassword(id, email) {
    if (!confirm(`Wirklich neues Passwort für ${email} generieren?\n\nDas alte Passwort wird ungültig — der User kann sich nicht mehr einloggen, bis du ihm das neue mitteilst.`)) return;
    const reason = prompt('Grund (optional):') || '';
    try {
      const r = await API.resetPassword(id, reason);
      $('#reveal-title').textContent = '🔐 Neues Passwort';
      $('#reveal-message').textContent = r.warning || 'Dieses Passwort wird nur einmal angezeigt. Notiere es jetzt und sende es sicher an den User.';
      $('#reveal-value').textContent = r.new_password;
      $('#modal-reveal').style.display = 'flex';
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function handleToggleActive(id, isActive, email) {
    const action = isActive ? 'sperren' : 'entsperren';
    if (!confirm(`Konto ${email} wirklich ${action}?`)) return;
    const reason = prompt('Grund (optional):') || '';
    try {
      const r = await API.toggleActive(id, reason);
      toast(`✓ Konto ist jetzt ${r.is_active ? 'AKTIV' : 'GESPERRT'}`, 'success');
      showUserDetail(id);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  async function handleDeleteDsgvo(id, email) {
    const confirm_email = prompt(`⚠ DSGVO-LÖSCHUNG IST UNWIDERRUFLICH!\n\nDaten von ${email} werden anonymisiert.\n\nZum Bestätigen gib die Email ein:`);
    if (!confirm_email) return;
    if (confirm_email !== email) {
      toast('Email stimmt nicht überein', 'error');
      return;
    }
    const reason = prompt('Grund (z.B. "Auf User-Anfrage"):') || '';
    if (!confirm(`Letzte Bestätigung — wirklich löschen?\n\nUser: ${email}\nGrund: ${reason || '(kein Grund angegeben)'}`)) return;
    try {
      await API.deleteUser(id, confirm_email, reason);
      toast(`✓ User ${email} DSGVO-gelöscht`, 'success');
      switchView('users');
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  // ── User anlegen (V197: mit is_test_user-Checkbox) ───────
  function openCreateUser() {
    $('#cu-email').value = '';
    $('#cu-name').value = '';
    $('#cu-plan').value = 'free';
    if ($('#cu-is-test')) $('#cu-is-test').checked = false;
    $('#cu-error').style.display = 'none';
    updatePlanDropdowns();
    $('#modal-create-user').style.display = 'flex';
    setTimeout(() => $('#cu-email').focus(), 100);
  }

  async function submitCreateUser(e) {
    e.preventDefault();
    const email = $('#cu-email').value.trim();
    const name = $('#cu-name').value.trim();
    const plan_id = $('#cu-plan').value;
    const is_test_user = $('#cu-is-test') ? $('#cu-is-test').checked : false;
    $('#cu-error').style.display = 'none';
    try {
      const r = await API.createUser(email, name, plan_id, is_test_user);
      $('#modal-create-user').style.display = 'none';
      $('#reveal-title').textContent = '✓ User angelegt';
      $('#reveal-message').textContent = `Initial-Passwort für ${r.user.email} ${r.user.is_test_user ? '(🧪 Test-User)' : ''} — wird nur einmal angezeigt:`;
      $('#reveal-value').textContent = r.temp_password;
      $('#modal-reveal').style.display = 'flex';
      loadUsers();
      loadDashboard();
    } catch (err) {
      $('#cu-error').textContent = err.data?.message || err.data?.error || err.message;
      $('#cu-error').style.display = 'block';
    }
  }

  function updatePlanDropdowns() {
    const plans = window._plans || [];
    if (!plans.length) return;
    const sel = $('#cu-plan');
    if (!sel) return;
    sel.innerHTML = '<option value="free">Free</option>' + plans.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)} – ${fmtMoney(p.price_monthly_cents)}/Monat</option>`
    ).join('');

    const filterSel = $('#filter-plan');
    if (filterSel) {
      filterSel.innerHTML = '<option value="">Alle Pläne</option>'
        + '<option value="free">Free</option>'
        + plans.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    }
  }

  // ── Audit-Log ──────────────────────────────────────────
  async function loadAudit() {
    const filter = $('#audit-filter').value.trim();
    const tbody = $('#audit-list');
    tbody.innerHTML = '<tr><td colspan="6">Lädt…</td></tr>';
    try {
      const r = await API.auditLog(filter);
      if (!r.entries || r.entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted)">Keine Einträge</td></tr>';
        return;
      }
      tbody.innerHTML = r.entries.map(a => {
        let meta = '';
        try {
          if (a.meta) {
            const m = typeof a.meta === 'string' ? JSON.parse(a.meta) : a.meta;
            meta = Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(', ');
          }
        } catch {}
        return `
          <tr>
            <td>${fmtDate(a.created_at)}</td>
            <td>${escapeHtml(a.admin_email || '–')}</td>
            <td><code>${escapeHtml(a.action)}</code></td>
            <td>${a.target_user_email ? `<a href="#" class="row-link" data-user-id="${a.target_user_id}">${escapeHtml(a.target_user_email)}</a>` : '<span style="color:var(--text-light)">–</span>'}</td>
            <td style="font-size:0.85em;color:var(--text-muted)">${escapeHtml(a.ip || '–')}</td>
            <td style="font-size:0.85em;color:var(--text-muted)">${escapeHtml(meta)}</td>
          </tr>
        `;
      }).join('');

      $$('.row-link[data-user-id]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          showUserDetail(a.dataset.userId);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="error-msg">${escapeHtml(err.message || 'Fehler')}</div></td></tr>`;
    }
  }

  // ── Boot ────────────────────────────────────────────────
  async function boot() {
    if (Auth.isLoggedIn()) {
      try {
        const r = await API.me();
        mountApp(r.admin);
      } catch {
        Auth.logout();
      }
    }
  }
  boot();

  // v798-row-delete: generischer Loeschen-Handler fuer Admin-Tabellen-Zeilen
  var _DPX_DEL = {
    feedback: { label: 'Diesen Zufriedenheits-Eintrag endg\u00fcltig l\u00f6schen?', fn: function (id) { return API.deleteFeedback(id); } },
    ticket:   { label: 'Dieses Support-Ticket endg\u00fcltig l\u00f6schen (inkl. Nachrichten)?', fn: function (id) { return API.deleteSupportTicket(id); } },
    invoice:  { label: 'Diese Rechnung endg\u00fcltig l\u00f6schen?', fn: function (id) { return API.deleteInvoice(id); } }
  };
  window._dpxRowDel = function (btn) {
    if (!btn) return;
    var kind = btn.getAttribute('data-del-kind');
    var id = btn.getAttribute('data-del-id');
    var cfg = _DPX_DEL[kind];
    if (!cfg || !id) return;
    if (!window.confirm(cfg.label)) return;
    btn.disabled = true;
    cfg.fn(id).then(function () {
      if (typeof toast === 'function') toast('\u2713 Gel\u00f6scht', 'success');
      var tr = btn.closest('tr');
      if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
    }).catch(function (err) {
      btn.disabled = false;
      if (typeof toast === 'function') toast('Fehler: ' + (err.message || 'unbekannt'), 'error');
      else alert('Fehler: ' + (err.message || 'unbekannt'));
    });
  };

})();
