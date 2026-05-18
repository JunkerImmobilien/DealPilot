/**
 * V197: KI-Credits Kauf-Modal
 *
 * Stellt 4 Kauf-Karten dar (5/15/40/100 Credits), startet Stripe Checkout.
 *
 * Verwendung im Hauptcode:
 *   CreditsModal.open();
 *   CreditsModal.checkPurchaseSuccess();  // im Boot → liest ?credit_purchase=success aus URL
 *
 * Globale Funktion `_buyCreditPack(packId)` wird angeboten — kann von alten Buttons gerufen werden.
 */
'use strict';

const CreditsModal = (function() {

  const PACKS_FALLBACK = [
    { id: 'pack_5',   credits: 5,   requests: 10,  amount_cents: 200,  label: 'Mal schnell prüfen',     popular: false },
    { id: 'pack_15',  credits: 15,  requests: 30,  amount_cents: 500,  label: 'Mehrere Deals',          popular: false },
    { id: 'pack_40',  credits: 40,  requests: 80,  amount_cents: 1200, label: 'Aktiver Investor',       popular: true  },
    { id: 'pack_100', credits: 100, requests: 200, amount_cents: 2500, label: 'Profi / Sachverständiger', popular: false }
  ];

  function fmtMoney(cents) {
    return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }
  function fmtPricePerRequest(cents, requests) {
    const ppr = cents / requests;
    return (ppr / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' € / Anfrage';
  }

  function getApiBase() {
    return (window.JI_API_BASE || '/api/v1');
  }
  function getToken() {
    return localStorage.getItem('ji_token') || '';
  }

  async function apiCall(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(getApiBase() + path, opts);
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) {
      const err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status));
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  let modalEl = null;

  function build() {
    if (modalEl) return modalEl;

    const el = document.createElement('div');
    el.id = 'credits-modal';
    el.className = 'credits-modal-overlay';
    el.innerHTML = `
      <div class="credits-modal-content">
        <div class="credits-modal-header">
          <h2>KI-Credits aufladen</h2>
          <button class="credits-modal-close" aria-label="Schließen">×</button>
        </div>
        <div class="credits-modal-sub">
          1 Credit = 2 KI-Anfragen · Credits verfallen nicht
        </div>

        <div class="credits-packs" id="credits-packs-grid">Lädt…</div>

        <div class="credits-modal-footer">
          Credits sind ab dem Starter-Plan zubuchbar und verfallen nicht.
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('.credits-modal-close').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });

    modalEl = el;
    return el;
  }

  function renderPacks(packs) {
    const grid = document.getElementById('credits-packs-grid');
    grid.innerHTML = packs.map(p => `
      <div class="credit-pack ${p.popular ? 'credit-pack--popular' : ''}">
        ${p.popular ? '<div class="credit-pack-badge">BELIEBT</div>' : ''}
        <div class="credit-pack-credits">${p.credits}</div>
        <div class="credit-pack-label">CREDITS = ${p.requests} ANFRAGEN</div>
        <div class="credit-pack-divider"></div>
        <div class="credit-pack-price">${fmtMoney(p.amount_cents)}</div>
        <div class="credit-pack-perrequest">${fmtPricePerRequest(p.amount_cents, p.requests)}</div>
        <div class="credit-pack-sublabel">${p.label}</div>
        <button class="credit-pack-buy" data-pack-id="${p.id}">Credits kaufen</button>
      </div>
    `).join('');

    grid.querySelectorAll('.credit-pack-buy').forEach(btn => {
      btn.addEventListener('click', () => buy(btn.dataset.packId, btn));
    });
  }

  async function buy(packId, btn) {
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Wird gestartet…';
    try {
      const r = await apiCall('POST', '/credits/checkout', { pack_id: packId });
      if (r && r.url) {
        // Stripe-Checkout-Page öffnen
        window.location.href = r.url;
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = oldText;

      // Upgrade-Required: spezielle Behandlung
      if (err.status === 403 && err.data && err.data.error === 'upgrade_required') {
        alert(err.data.message || 'Bitte upgrade dein Abo auf Starter, um Credits kaufen zu können.');
        // Optional: zum Plan-Tab springen
        if (typeof window.openPlanSettings === 'function') {
          window.openPlanSettings();
        }
      } else {
        alert('Fehler: ' + (err.message || 'unbekannt'));
      }
    }
  }

  async function open() {
    build();
    modalEl.style.display = 'flex';

    // Packs nachladen — frisch aus dem Backend
    try {
      const r = await apiCall('GET', '/credits/packs');
      renderPacks(r.packs || PACKS_FALLBACK);
    } catch (err) {
      renderPacks(PACKS_FALLBACK);
      console.warn('Pack-Liste konnte nicht geladen werden, nutze Fallback:', err);
    }
  }

  function close() {
    if (modalEl) modalEl.style.display = 'none';
  }

  /** Wird im Boot aufgerufen: ?credit_purchase=success | canceled in URL? */
  function checkPurchaseSuccess() {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('credit_purchase');
    if (!result) return;

    // URL bereinigen
    params.delete('credit_purchase');
    params.delete('session_id');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);

    if (result === 'success') {
      showResult('✓ Credits erfolgreich gekauft!',
                 'Deine neuen Credits wurden gutgeschrieben. Es kann bis zu 30 Sekunden dauern bis sie im Saldo erscheinen.',
                 'success');
    } else if (result === 'canceled') {
      showResult('Kauf abgebrochen', 'Du hast den Kauf abgebrochen. Du kannst es jederzeit erneut versuchen.', 'info');
    }
  }

  function showResult(title, msg, type) {
    const el = document.createElement('div');
    el.className = 'credits-result-toast credits-result-' + (type || 'info');
    el.innerHTML = `
      <div class="credits-result-title">${title}</div>
      <div class="credits-result-msg">${msg}</div>
      <button class="credits-result-close">OK</button>
    `;
    document.body.appendChild(el);
    el.querySelector('.credits-result-close').addEventListener('click', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 10000);
  }

  return { open, close, checkPurchaseSuccess };
})();

// Backward-Compat: alte Buttons können diese globale Funktion aufrufen
window._buyCreditPack = function(packId) {
  CreditsModal.open();
  setTimeout(() => {
    const btn = document.querySelector(`.credit-pack-buy[data-pack-id="${packId}"]`);
    if (btn) btn.click();
  }, 200);
};

// Boot-Hook
document.addEventListener('DOMContentLoaded', () => {
  CreditsModal.checkPurchaseSuccess();
});

window.CreditsModal = CreditsModal;
