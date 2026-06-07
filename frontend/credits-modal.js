/**
 * V197 → v489: Kerosin-Kauf-Modal (vorher: KI-Credits)
 *
 * Stellt 4 Kerosin-Pakete dar (10/28/90/160 Liter), startet Stripe Checkout.
 * 1 Liter = 1 Pilot-Anfrage (kleine Anfrage). Volle Pilot-Analyse 3 L,
 * Markteinschätzung 2 L, Marktreport 4 L (Verbrauch zieht das Backend ab E2/v490).
 *
 * Verwendung im Hauptcode:
 *   CreditsModal.open();
 *   CreditsModal.checkPurchaseSuccess();  // im Boot → liest ?credit_purchase=success aus URL
 *
 * Globale Funktion `_buyCreditPack(packId)` bleibt für alte Buttons erhalten.
 *
 * v489-HINWEIS: Die pack_ids (kerosin_10/28/90/160) kennt das Backend erst nach
 * dem E2-Deploy (v490). Bis dahin liefert /credits/checkout für neue Packs einen
 * Fehler — gewollt, damit keine falschen Gutschriften passieren.
 */
'use strict';

const CreditsModal = (function() {

  /* v489-kerosin: Liter-Pakete — Staffel 10/28/90/160 → 2/5/15/25 € */
  const PACKS_FALLBACK = [
    { id: 'kerosin_10',  liter: 10,  amount_cents: 200,  label: 'Mal schnell prüfen',  flight: '✈ Kurzstrecke',      reach: '≈ 2 Reports oder 5 Markteinschätzungen',   gauge: { off: 164.8, deg: -57.6 }, popular: false },
    { id: 'kerosin_28',  liter: 28,  amount_cents: 500,  label: 'Mehrere Deals',       flight: '✈✈ Mittelstrecke',   reach: '≈ 7 Reports oder 14 Markteinschätzungen',  gauge: { off: 116.6, deg: -14.4 }, popular: false },
    { id: 'kerosin_90',  liter: 90,  amount_cents: 1500, label: 'Aktiver Investor',    flight: '✈✈✈ Langstrecke',    reach: '≈ 22 Reports oder 45 Markteinschätzungen', gauge: { off: 56.3,  deg: 39.6 },  popular: true  },
    { id: 'kerosin_160', liter: 160, amount_cents: 2500, label: 'Maximale Reichweite', flight: '🌍 Interkontinental', reach: '≈ 40 Reports oder 80 Markteinschätzungen', gauge: { off: 14.1,  deg: 77.4 },  popular: false }
  ];

  function fmtMoney(cents) {
    return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }
  function fmtPricePerLiter(cents, liter) {
    const ppl = cents / liter;
    return (ppl / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' € / Liter';
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
          <h2>Kerosin auftanken</h2>
          <button class="credits-modal-close" aria-label="Schließen">×</button>
        </div>
        <div class="credits-modal-sub">
          1 Liter = 1 Pilot-Anfrage · Dein Plan füllt den Tank am 1. jeden Monats —
          gekauftes Kerosin kommt obendrauf, wird zuletzt verbraucht und verfällt nie. <!-- v491-hybrid -->
        </div>

        <div class="credits-packs" id="credits-packs-grid">Lädt…</div>

        <div class="credits-modal-footer">
          Kerosin ist ab dem Starter-Plan zubuchbar und verfällt nicht.
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('.credits-modal-close').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });

    modalEl = el;
    return el;
  }

  /* v489-kerosin: Mini-Tacho-SVG (gleiche Geometrie wie Landing-Karten) */
  function _gaugeSvg(off, deg) {
    const gid = 'kpg' + String(Math.abs(off)).replace('.', '');
    return '<svg class="kp-tacho" viewBox="0 0 184 96" aria-hidden="true">' +
      '<path d="M28 88 A64 64 0 0 1 156 88" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M149 59 A64 64 0 0 1 156 88" fill="none" stroke="rgba(184,98,80,.55)" stroke-width="8" stroke-linecap="round"/>' +
      '<path class="kp-arc" style="--off:' + off + '" d="M28 88 A64 64 0 0 1 156 88" fill="none" stroke="url(#' + gid + ')" stroke-width="8" stroke-linecap="round"/>' +
      '<g stroke="rgba(244,236,216,.2)" stroke-width="2"><line x1="28" y1="88" x2="36" y2="88"/><line x1="46.8" y1="42.8" x2="52.4" y2="48.4"/><line x1="92" y1="24" x2="92" y2="32"/><line x1="137.2" y1="42.8" x2="131.6" y2="48.4"/><line x1="156" y1="88" x2="148" y2="88"/></g>' +
      '<g class="kp-needle" style="--deg:' + deg + 'deg"><line x1="92" y1="88" x2="92" y2="34" stroke="#F4ECD8" stroke-width="3" stroke-linecap="round"/></g>' +
      '<circle cx="92" cy="88" r="5.5" fill="#C9A84C"/>' +
      '<defs><linearGradient id="' + gid + '" x1="0" x2="1"><stop offset="0" stop-color="#C9A84C"/><stop offset="1" stop-color="#3FA56C"/></linearGradient></defs>' +
    '</svg>';
  }

  function renderPacks(packs) {
    const grid = document.getElementById('credits-packs-grid');
    /* v489-kerosin: Backend liefert bis v490 evtl. alte Credit-Packs (ohne .liter)
       → dann konsequent den Liter-Fallback rendern, damit die Anzeige nie
       Credits/Liter mischt. */
    if (!packs || !packs.length || packs[0].liter == null) packs = PACKS_FALLBACK;
    grid.innerHTML = packs.map(p => `
      <div class="credit-pack kp-card ${p.popular ? 'credit-pack--popular' : ''}">
        ${p.popular ? '<div class="credit-pack-badge">BELIEBT</div>' : ''}
        <div class="kp-flight">${p.flight || ''}</div>
        ${_gaugeSvg(p.gauge ? p.gauge.off : 100, p.gauge ? p.gauge.deg : 0)}
        <div class="credit-pack-credits">${p.liter}</div>
        <div class="credit-pack-label">LITER = ${p.liter} PILOT-ANFRAGEN</div>
        <div class="credit-pack-divider"></div>
        <div class="credit-pack-price">${fmtMoney(p.amount_cents)}</div>
        <div class="credit-pack-perrequest">${fmtPricePerLiter(p.amount_cents, p.liter)}</div>
        <div class="credit-pack-sublabel">${p.label}</div>
        <div class="kp-reach">${p.reach || ''}</div>
        <button class="credit-pack-buy" data-pack-id="${p.id}">Kerosin kaufen</button>
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
        alert(err.data.message || 'Bitte upgrade dein Abo auf Starter, um Kerosin kaufen zu können.');
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

    // Packs nachladen — frisch aus dem Backend (ab v490 liefert es Liter-Packs)
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
      showResult('✓ Kerosin erfolgreich getankt!',
                 'Dein Kerosin wurde gutgeschrieben. Es kann bis zu 30 Sekunden dauern bis es im Tank erscheint.',
                 'success');
    } else if (result === 'canceled') {
      showResult('Kauf abgebrochen', 'Du hast den Kauf abgebrochen. Du kannst jederzeit erneut tanken.', 'info');
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
