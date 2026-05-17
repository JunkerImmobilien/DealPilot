// DealPilot Admin V195 — Hauptanwendung
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

  function showError(elId, msg) {
    const el = $('#' + elId);
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
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
      // Erfolg → App laden
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

    // Nav-Click-Handler
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
    $('#audit-filter-btn').addEventListener('click', loadAudit);
    $('#audit-filter').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadAudit(); });
    $('#back-to-users').addEventListener('click', (e) => { e.preventDefault(); switchView('users'); });

    // Plans für Dropdown laden
    try {
      const plansRes = await API.listPlans();
      window._plans = plansRes.plans || [];
      updatePlanDropdowns();
    } catch (e) { console.warn('Plans laden fehlgeschlagen:', e); }

    loadDashboard();
  }

  // ── View-Switching ─────────────────────────────────────
  function switchView(view) {
    $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));
    $$('.view').forEach(v => v.style.display = 'none');
    $('#view-' + view).style.display = 'block';

    if (view === 'dashboard') loadDashboard();
    if (view === 'users') loadUsers();
    if (view === 'audit') loadAudit();
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

      // Plan-Verteilung
      const maxCount = Math.max(...d.plan_distribution.map(p => p.user_count), 1);
      $('#plan-distribution').innerHTML = d.plan_distribution.map(p => `
        <div class="plan-item">
          <div class="plan-item-name">${escapeHtml(p.plan_name)}</div>
          <div class="plan-item-bar">
            <div class="plan-item-bar-fill" style="width: ${(p.user_count / maxCount * 100)}%"></div>
          </div>
          <div class="plan-item-count">${fmtNum(p.user_count)}</div>
        </div>
      `).join('') || '<div style="color:var(--text-muted)">Keine Daten</div>';

      // Recent Signups
      $('#recent-signups').innerHTML = d.recent_signups.length
        ? d.recent_signups.map(s => `
            <tr>
              <td><a href="#" class="row-link" data-user-id="${s.id}">${escapeHtml(s.email)}</a></td>
              <td>${fmtDate(s.created_at)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="2" style="color:var(--text-muted)">Keine Daten</td></tr>';

      // Recent Logins
      $('#recent-logins').innerHTML = d.recent_logins.length
        ? d.recent_logins.map(l => `
            <tr>
              <td><a href="#" class="row-link" data-user-id="${l.id}">${escapeHtml(l.email)}</a></td>
              <td>${fmtDate(l.last_login_at)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="2" style="color:var(--text-muted)">Keine Daten</td></tr>';

      // User-Klick-Handler
      $$('.row-link[data-user-id]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          showUserDetail(a.dataset.userId);
        });
      });
    } catch (err) {
      toast('Dashboard-Fehler: ' + (err.message || 'unbekannt'), 'error');
    }
  }

  // ── User-Liste ─────────────────────────────────────────
  async function loadUsers() {
    const q = $('#user-search').value.trim();
    const tbody = $('#users-list');
    tbody.innerHTML = '<tr><td colspan="7">Lädt…</td></tr>';
    $('#users-error').style.display = 'none';
    try {
      const r = await API.listUsers(q, 100, 0);
      if (!r.users || r.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted)">Keine User gefunden</td></tr>';
        return;
      }
      tbody.innerHTML = r.users.map(u => `
        <tr>
          <td><a href="#" class="row-link" data-user-id="${u.id}">${escapeHtml(u.email)}</a></td>
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

  // ── User-Detail-Page ───────────────────────────────────
  async function showUserDetail(id) {
    switchView('users');
    $('#view-users').style.display = 'none';
    $('#view-user-detail').style.display = 'block';
    $('#user-detail-content').innerHTML = 'Lädt…';

    try {
      const r = await API.getUser(id);
      const u = r.user;
      const audit = r.audit || [];

      const planOptions = (window._plans || []).map(p =>
        `<option value="${p.id}" ${u.plan_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
      ).join('');

      $('#user-detail-content').innerHTML = `
        <div class="user-detail-grid">
          <div class="user-info">
            <h3>Stammdaten</h3>
            <div class="user-info-row"><div class="user-info-label">User-ID</div><div class="user-info-value" style="font-family:monospace;font-size:0.85em">${u.id}</div></div>
            <div class="user-info-row"><div class="user-info-label">E-Mail</div><div class="user-info-value">${escapeHtml(u.email)}</div></div>
            <div class="user-info-row"><div class="user-info-label">Name</div><div class="user-info-value">${escapeHtml(u.name || '–')}</div></div>
            <div class="user-info-row"><div class="user-info-label">Rolle</div><div class="user-info-value">${escapeHtml(u.role)}</div></div>
            <div class="user-info-row"><div class="user-info-label">Plan</div><div class="user-info-value"><span class="pill ${u.plan_id === 'free' ? 'pill-plan' : 'pill-plan-paid'}">${escapeHtml(u.plan_name)}</span> ${u.billing_interval ? `(${u.billing_interval})` : ''}</div></div>
            <div class="user-info-row"><div class="user-info-label">Status</div><div class="user-info-value"><span class="pill ${u.is_active ? 'pill-active' : 'pill-inactive'}">${u.is_active ? 'Aktiv' : 'Gesperrt'}</span></div></div>
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

      // Action-Handler
      $$('[data-action="change-plan"]')[0].addEventListener('click', () => handleChangePlan(id));
      $$('[data-action="grant-credits"]')[0].addEventListener('click', () => handleGrantCredits(id));
      $$('[data-action="reset-password"]')[0].addEventListener('click', () => handleResetPassword(id, u.email));
      $$('[data-action="toggle-active"]')[0].addEventListener('click', () => handleToggleActive(id, u.is_active, u.email));
      $$('[data-action="delete-dsgvo"]')[0].addEventListener('click', () => handleDeleteDsgvo(id, u.email));

    } catch (err) {
      $('#user-detail-content').innerHTML = `<div class="error-msg">${escapeHtml(err.message || 'Laden fehlgeschlagen')}</div>`;
    }
  }

  // ── User-Actions ────────────────────────────────────────
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

  // ── User anlegen ───────────────────────────────────────
  function openCreateUser() {
    $('#cu-email').value = '';
    $('#cu-name').value = '';
    $('#cu-plan').value = 'free';
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
    $('#cu-error').style.display = 'none';
    try {
      const r = await API.createUser(email, name, plan_id);
      $('#modal-create-user').style.display = 'none';
      $('#reveal-title').textContent = '✓ User angelegt';
      $('#reveal-message').textContent = `Initial-Passwort für ${r.user.email} — wird nur einmal angezeigt:`;
      $('#reveal-value').textContent = r.temp_password;
      $('#modal-reveal').style.display = 'flex';
      // Refresh listings
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
        // Token ungültig → Login zeigen
        Auth.logout();
      }
    }
    // Sonst bleibt Login-Screen sichtbar (Default)
  }

  boot();
})();
