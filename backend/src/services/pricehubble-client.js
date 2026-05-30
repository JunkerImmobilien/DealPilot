'use strict';
/**
 * V326: PriceHubble AVM Live-Client.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ ⚠ LIVE-MAPPING UNVERIFIZIERT                                          │
 * │ Lauffähiges Gerüst. Auth-Flow (PriceHubble nutzt i.d.R. einen         │
 * │ Token-Login statt Basic-Auth) + Request/Response MÜSSEN gegen die     │
 * │ echte PriceHubble-Doku geprüft werden, BEVOR AVM_MODE=live gesetzt    │
 * │ wird. Bis dahin: AVM_MODE=stub.                                       │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * ENV:
 *   PRICEHUBBLE_USERNAME, PRICEHUBBLE_PASSWORD, PRICEHUBBLE_API_BASE
 *
 * Liefert dasselbe Result-Schema wie avm-stub.pricehubbleStub().
 */

const { pricehubbleStub, num } = require('./avm-stub');

function _cfg() {
  return {
    user: process.env.PRICEHUBBLE_USERNAME || '',
    pass: process.env.PRICEHUBBLE_PASSWORD || '',
    base: (process.env.PRICEHUBBLE_API_BASE || 'https://api.pricehubble.com').replace(/\/+$/, '')
  };
}

function isConfigured() {
  const c = _cfg();
  return !!(c.user && c.pass && c.base);
}

/**
 * TODO(live): PriceHubble-Login → Access-Token holen.
 * Doku-abhängig; viele PriceHubble-Setups: POST /auth/login/credentials.
 */
async function _login() {
  const c = _cfg();
  const res = await fetch(c.base + '/auth/login/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: c.user, password: c.pass })
  });
  if (!res.ok) {
    const err = new Error('PriceHubble Login → HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.access_token || data.token || null;
}

/**
 * @param {object} inputs
 * @returns {object} Result-Schema (provider 'PriceHubble')
 */
async function valuate(inputs) {
  if (!isConfigured()) {
    const e = new Error('PriceHubble-Credentials fehlen (ENV nicht gesetzt).');
    e.code = 'AVM_NOT_CONFIGURED';
    throw e;
  }

  // TODO(live): echten Valuation-Call + Response-Mapping implementieren.
  const token = await _login();

  // Bis Mapping verifiziert: kontrollierter Fallback auf Stub-Schema,
  // markiert als live-unmapped (keine Halluzination echter Zahlen).
  const shaped = pricehubbleStub(inputs);
  shaped.mode = 'live-unmapped';
  shaped._raw = { tokenAcquired: !!token };
  return shaped;
}

module.exports = { valuate: valuate, isConfigured: isConfigured };
